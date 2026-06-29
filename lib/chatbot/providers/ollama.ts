/**
 * Ollama provider for local LLM inference
 * Connects to Ollama running on http://127.0.0.1:11434 by default
 */

import type {
  ChatProvider,
  ProviderConfig,
  OllamaConfig,
  ChatMessage,
  GameContextSnapshot,
  ChatImageAttachment,
  ChatSource,
} from '../types';
import type { ChatToolDefinition } from '../tools/registry';

type ToolRegistry = typeof import('../tools/registry');

let toolRegistryPromise: Promise<ToolRegistry> | null = null;

async function loadToolRegistry(): Promise<ToolRegistry> {
  if (!toolRegistryPromise) {
    const startedAt = Date.now();
    console.log('[OLLAMA DEBUG][TOOLS] Loading chatbot tool registry...');
    toolRegistryPromise = import('../tools/registry').then((registry) => {
      console.log(
        `[OLLAMA DEBUG][TOOLS] Chatbot tool registry loaded in ${Date.now() - startedAt}ms`
      );
      return registry;
    });
  }
  return toolRegistryPromise;
}

type OllamaMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  thinking?: string;
  images?: string[];
  tool_name?: string;
  tool_calls?: Array<{
    function?: {
      name?: string;
      arguments?: unknown;
    };
  }>;
};

type OllamaChatResponse = {
  message?: OllamaMessage;
};

type OllamaEmbedResponse = {
  embeddings?: number[][];
};

const DEBUG_PROMPT_PREVIEW_CHARS = 6000;

export class OllamaProvider implements ChatProvider {
  name = 'Ollama (Local)';
  private endpoint: string = 'http://127.0.0.1:11434';
  private modelName: string = 'gemma4:latest';
  private embeddingModelName?: string;
  private maxTokens: number = -1;
  private temperature: number = 0;
  private ready: boolean = false;
  private enableTools: boolean = true;
  private modelSupportsTools: boolean | null = null;
  private apiKey?: string;
  private thinking: boolean = true;
  private lastKnowledgeContext?: string;
  private lastSources: ChatSource[] = [];

  async initialize(config: ProviderConfig): Promise<void> {
    const ollamaConfig = config as OllamaConfig;
    if (ollamaConfig.endpoint) {
      this.endpoint = ollamaConfig.endpoint;
    }
    if (ollamaConfig.modelName) {
      this.modelName = ollamaConfig.modelName;
    }
    if (ollamaConfig.embeddingModelName) {
      this.embeddingModelName = ollamaConfig.embeddingModelName;
    }
    if (ollamaConfig.maxTokens !== undefined) {
      this.maxTokens = ollamaConfig.maxTokens;
    }
    if (ollamaConfig.temperature !== undefined) {
      this.temperature = ollamaConfig.temperature;
    }
    this.apiKey = ollamaConfig.apiKey;
    this.thinking = ollamaConfig.thinking !== false;
    this.enableTools = process.env.OLLAMA_ENABLE_TOOLS !== 'false';

    // Test connection
    await this.validateConfig();
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error('Ollama connection failed:', response.statusText);
        this.ready = false;
        return false;
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models || [];
      const modelExists = models.some((m) => this.matchesOllamaModelName(m.name, this.modelName));
      const embeddingModelName = this.embeddingModelName;
      const embeddingModelExists = embeddingModelName
        ? models.some((m) => this.matchesOllamaModelName(m.name, embeddingModelName))
        : false;

      if (!modelExists) {
        console.warn(
          `Model "${this.modelName}" not found on Ollama. Available:`,
          models.map((m) => m.name)
        );
        this.ready = false;
        return false;
      }

      if (this.embeddingModelName && !embeddingModelExists) {
        console.warn(
          `Embedding model "${this.embeddingModelName}" not found on Ollama. Chat remains available; vector retrieval will require pulling or configuring this model. Available:`,
          models.map((m) => m.name)
        );
      }

      this.ready = true;
      return true;
    } catch (error) {
      console.error('Ollama validation error:', error);
      this.ready = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getInfo() {
    return {
      provider: this.name,
      modelName: this.modelName,
      ...(this.embeddingModelName
        ? { embeddingModelName: this.embeddingModelName }
        : {}),
      endpoint: this.endpoint,
      ready: this.ready,
    };
  }

  getLastKnowledgeContext(): string | undefined {
    return this.lastKnowledgeContext;
  }

  getLastSources(): ChatSource[] {
    return this.lastSources;
  }

  async embedTexts(input: string | string[]): Promise<number[][]> {
    const values = Array.isArray(input) ? input : [input];
    if (values.length === 0) return [];
    if (!this.embeddingModelName) {
      throw new Error(
        'OLLAMA_EMBEDDING_MODEL is required before requesting embeddings.'
      );
    }

    const response = await fetch(`${this.endpoint}/api/embed`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.embeddingModelName,
        input: values,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama embedding error for model "${this.embeddingModelName}": ${response.statusText} ${errorText}`
      );
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    if (!Array.isArray(data.embeddings)) {
      throw new Error('Ollama embedding response did not include embeddings.');
    }
    return data.embeddings;
  }

  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[],
    gameContext?: GameContextSnapshot,
    systemPrompt?: string,
    onStreamChunk?: (chunk: string) => void,
    attachments: ChatImageAttachment[] = [],
    onThinkingChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!this.ready) {
      throw new Error('Ollama provider not initialized or not ready');
    }
    this.lastKnowledgeContext = undefined;
    this.lastSources = [];

    // Build short base prompt + minimal identity context (trainer + game)
    const baseSystemPrompt =
      systemPrompt ||
      `You are a Pokémon gameplay co-pilot.
Use only provided state or tool results. Do not invent data.
Give one concrete next action with brief tactical reason.
If data is missing, ask a specific follow-up question.
Keep answers concise and practical.`;
    const fullSystemPrompt = `${baseSystemPrompt}${this.formatIdentityContext(gameContext)}`;

    // Build message history
    const messages = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content:
          msg.role === 'assistant' && msg.knowledgeContext
            ? `${msg.content}\n\n[Verified knowledge retained from earlier tool calls]\n${msg.knowledgeContext}`
            : msg.content,
        images: msg.attachments?.map((attachment) => attachment.data),
      })),
      {
        role: 'user' as const,
        content: message,
        images: attachments.map((attachment) => attachment.data),
      },
    ];

    const typedMessages: OllamaMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      ...('images' in msg && msg.images?.length ? { images: msg.images } : {}),
    }));

    // DEBUG: Log the prompt and request shape.
    console.log('\n[OLLAMA DEBUG] ==========\n');
    this.logPromptForDebug('BASE SYSTEM PROMPT (before tool/fallback layers)', fullSystemPrompt);
    console.log('\n[OLLAMA DEBUG] USER MESSAGE:\n', message);
    console.log('[OLLAMA DEBUG] CONVERSATION HISTORY LENGTH:', conversationHistory.length);
    console.log('[OLLAMA DEBUG] TOOLS ENABLED:', this.enableTools);
    console.log('[OLLAMA DEBUG] MODEL SUPPORTS TOOLS (cached):', this.modelSupportsTools);
    console.log('[OLLAMA DEBUG] ==========\n');

    try {
      const retainedKnowledge = conversationHistory
        .map((historyMessage) => historyMessage.knowledgeContext)
        .filter((value): value is string => Boolean(value))
        .slice(-3);
      if (retainedKnowledge.length > 0) {
        const retainedReply = await this.tryRetainedKnowledgeAnswer(
          message,
          retainedKnowledge,
          onThinkingChunk
        );
        if (retainedReply !== null) {
          this.lastKnowledgeContext =
            retainedKnowledge[retainedKnowledge.length - 1];
          this.lastSources = this.extractRetainedSources(retainedKnowledge);
          if (onStreamChunk) {
            onStreamChunk(retainedReply);
          }
          return retainedReply;
        }
      }

      const toolReply = await this.tryToolCalling(
        typedMessages,
        fullSystemPrompt,
        gameContext,
        onStreamChunk,
        onThinkingChunk
      );

      if (toolReply !== null) {
        console.log('[OLLAMA DEBUG] RESPONSE (tool-calling):\n', toolReply);
        console.log('[OLLAMA DEBUG] ==========\n');
        return toolReply;
      }

      // Non-tool fallback keeps the richer state dump for models/tool paths that cannot use tools.
      const nonToolSystemPrompt = gameContext
        ? `${fullSystemPrompt}\n\n## Current Game State:\n${this.formatGameContext(gameContext)}`
        : fullSystemPrompt;

      this.logPromptForDebug(
        'NON-TOOL FALLBACK SYSTEM PROMPT (sent to Ollama)',
        nonToolSystemPrompt
      );

      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: nonToolSystemPrompt },
            ...messages,
          ],
          stream: Boolean(onStreamChunk),
          think: this.thinking,
          options: {
            temperature: this.temperature,
            num_predict: this.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.statusText} ${errorText}`);
      }

      if (!onStreamChunk) {
        // Non-streaming response
        const data = (await response.json()) as OllamaChatResponse;
        const reply = data.message?.content || '';
        if (data.message?.thinking && onThinkingChunk) {
          onThinkingChunk(data.message.thinking);
        }

        // DEBUG: Log response
        console.log('[OLLAMA DEBUG] RESPONSE (non-streaming):\n', reply);
        console.log('[OLLAMA DEBUG] ==========\n');

        return reply;
      }

      // Streaming response
      let fullReply = '';
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaChatResponse;
            const content = data.message?.content || '';
            const thinking = data.message?.thinking || '';
            if (thinking) {
              onThinkingChunk?.(thinking);
            }
            fullReply += content;
            if (content) {
              onStreamChunk(content);
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      // DEBUG: Log full streaming response
      console.log('[OLLAMA DEBUG] RESPONSE (streaming, accumulated):\n', fullReply);
      console.log('[OLLAMA DEBUG] ==========\n');

      return fullReply;
    } catch (error) {
      console.error('Ollama sendMessage error:', error);
      throw error;
    }
  }

  private async tryToolCalling(
    messages: OllamaMessage[],
    fullSystemPrompt: string,
    gameContext?: GameContextSnapshot,
    onStreamChunk?: (chunk: string) => void,
    onThinkingChunk?: (chunk: string) => void
  ): Promise<string | null> {
    if (!this.enableTools) {
      console.log('[OLLAMA DEBUG][TOOLS] Skipping tool-calling: disabled via OLLAMA_ENABLE_TOOLS');
      return null;
    }

    if (this.modelSupportsTools === false) {
      console.log('[OLLAMA DEBUG][TOOLS] Skipping tool-calling: model previously marked unsupported');
      return null;
    }

    const registry = await loadToolRegistry();
    const tools = registry.getChatToolDefinitions().filter(
      (tool) => gameContext || registry.canExecuteToolWithoutContext(tool.function.name)
    );
    const toolAwareSystemPrompt = `${fullSystemPrompt}

Tool policy:
- For factual Pokemon gameplay questions, use a local tool before answering unless the user is only asking a conversational or configuration question.
- If the user explicitly names a game, that game overrides the loaded save/live context for reference questions.
- Use get_encounters for "where can I find/catch this Pokemon", wild encounter, fishing, surfing, grass, cave, or location availability questions.
- Use search_game_guidance for game progression, location, puzzle, walkthrough, and "how do I continue" questions, even when no save is loaded.
- Include the game argument when the user names a game.
- The guide index uses canonical English source names. Keep query as the original user question. Use canonicalQuery as a concise English rewrite of the user's information need using official source names and only entities/objectives present in the question.
- Do not put solution details in canonicalQuery or keywords unless the user already mentioned them.
- Use official English aliases that help source matching, but do not introduce a different game, location, character, team, or objective than the user's current question.
- After a tool error or an empty guidance result, correct the tool arguments once if they were clearly incomplete. If no source-backed match is found and you still know the answer, you may answer from general knowledge, but explicitly say that no local source-backed match was found and that you are using your own knowledge. Do not invent citations.
- For successful guidance results, use the returned matches first and preserve version-specific limitations.
- A successful general guidance result does not require save-state tools. Answer it directly without requesting trainer, story, party, Pokedex, or inventory state.`;

    const workingMessages: OllamaMessage[] = [
      { role: 'system', content: toolAwareSystemPrompt },
      ...messages,
    ];
    const originalQuestion =
      [...messages].reverse().find((message) => message.role === 'user')
        ?.content ?? '';
    const executedToolSignatures = new Set<string>();
    const successfulToolResults: Array<{
      tool: string;
      result: Record<string, unknown>;
    }> = [];

    console.log('[OLLAMA DEBUG][TOOLS] Attempting tool-calling with model:', this.modelName);
    this.logPromptForDebug(
      'TOOL-CALLING SYSTEM PROMPT (sent to Ollama)',
      toolAwareSystemPrompt
    );
    console.log(
      '[OLLAMA DEBUG][TOOLS] Available tools:',
      tools.map((tool) => tool.function.name).join(', ')
    );

    for (let i = 0; i < 6; i += 1) {
      console.log(`[OLLAMA DEBUG][TOOLS] Round ${i + 1}/6`);
      const requestBody = {
        model: this.modelName,
        messages: workingMessages,
        stream: false,
        think: this.thinking,
        tools,
        options: {
          temperature: this.temperature,
          num_predict: this.maxTokens,
        },
      };
      this.logChatRequestForDebug(`TOOL ROUND ${i + 1} REQUEST BODY`, requestBody);
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (this.looksLikeToolUnsupported(response.status, errorText)) {
          this.modelSupportsTools = false;
          console.warn(
            `[OLLAMA DEBUG] Tool calling disabled for model ${this.modelName}: ${errorText}`
          );
          return null;
        }
        throw new Error(`Ollama tool-calling error: ${response.statusText} ${errorText}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      const assistantMessage: OllamaMessage = data.message ?? {
        role: 'assistant',
        content: '',
      };
      if (assistantMessage.thinking) {
        onThinkingChunk?.(assistantMessage.thinking);
      }

      const toolCalls = assistantMessage.tool_calls ?? [];
      if (toolCalls.length === 0) {
        this.modelSupportsTools = true;
        console.log('[OLLAMA DEBUG][TOOLS] Model returned final response without tool calls');
        const finalContent = assistantMessage.content?.trim() ?? '';
        if (!finalContent) {
          console.log(
            '[OLLAMA DEBUG][TOOLS] Empty final response from tool-calling round; falling back to standard response flow'
          );
          return null;
        }
        if (onStreamChunk) {
          onStreamChunk(finalContent);
        }
        return finalContent;
      }

      this.modelSupportsTools = true;
      console.log('[OLLAMA DEBUG][TOOLS] Tool calls requested:', toolCalls.length);
      workingMessages.push(assistantMessage);

      for (const call of toolCalls) {
        const name = call.function?.name || '';
        const args = this.parseToolArguments(call.function?.arguments);
        if (name === 'search_game_guidance') {
          await this.attachGuidanceQueryEmbedding(args);
        }
        const toolSignature = this.getToolCallSignature(name, args);
        const isDuplicateToolCall = executedToolSignatures.has(toolSignature);
        if (!isDuplicateToolCall) {
          executedToolSignatures.add(toolSignature);
        }
        const result: Record<string, unknown> = isDuplicateToolCall
          ? {
              ok: false,
              error:
                'Duplicate tool call with identical arguments. Use the previous tool result, change the arguments, or answer the user.',
              tool: name,
              sources: [],
              limitations: [],
              confidence: 'unresolved',
              errorDetail: {
                code: 'DUPLICATE_TOOL_CALL',
                message:
                  'Duplicate tool call with identical arguments. Use the previous tool result, change the arguments, or answer the user.',
              },
            }
          : gameContext || registry.canExecuteToolWithoutContext(name)
            ? registry.executeChatTool(name, args, gameContext)
            : {
                ok: false,
                error: 'This tool requires a loaded save or live game state.',
              };

        console.log(`[OLLAMA DEBUG][TOOLS] CALL ${name || '<empty-name>'}`);
        console.log('[OLLAMA DEBUG][TOOLS] args:', this.stringifyForDebug(args));
        console.log('[OLLAMA DEBUG][TOOLS] result:', this.stringifyForDebug(result));

        if (result.ok === true) {
          successfulToolResults.push({ tool: name, result });
          const sources = this.normalizeSources(result.sources);
          if (sources.length > 0 && this.lastSources.length === 0) {
            this.lastSources = sources;
          }
          const resultData = this.getToolResultData(result);
          this.lastKnowledgeContext = JSON.stringify({
            tool: name,
            game: resultData.game,
            gameProfile: result.gameProfile,
            data: result.data,
            sources: result.sources,
            limitations: result.limitations,
          });
        }

        workingMessages.push({
          role: 'tool',
          tool_name: name,
          content: JSON.stringify(result),
        });
        if (result.ok === true) {
          workingMessages.push({
            role: 'system',
            content: this.formatToolResultForModel(name, result),
          });
        }
      }
    }

    console.log('[OLLAMA DEBUG][TOOLS] Max rounds reached, synthesizing from tool results');
    if (successfulToolResults.length > 0) {
      return this.synthesizeToolLoopAnswer(
        originalQuestion,
        successfulToolResults,
        onStreamChunk,
        onThinkingChunk
      );
    }

    return null;
  }

  private getToolCallSignature(name: string, args: Record<string, unknown>): string {
    const stableArgs = Object.fromEntries(
      Object.entries(args)
        .filter(([key]) => !key.startsWith('_'))
        .sort(([left], [right]) => left.localeCompare(right))
    );
    return JSON.stringify({ name, args: stableArgs });
  }

  private async attachGuidanceQueryEmbedding(args: Record<string, unknown>): Promise<void> {
    if (!this.embeddingModelName || Array.isArray(args._queryEmbedding)) return;
    const query =
      typeof args.canonicalQuery === 'string' && args.canonicalQuery.trim()
        ? args.canonicalQuery.trim()
        : typeof args.query === 'string'
          ? args.query.trim()
          : '';
    if (!query) return;

    try {
      const [embedding] = await this.embedTexts(`task: search result | query: ${query}`);
      if (Array.isArray(embedding)) {
        args._queryEmbedding = embedding;
        args._embeddingModelName = this.embeddingModelName;
      }
    } catch (error) {
      console.warn(
        '[OLLAMA DEBUG][TOOLS] Guidance embedding unavailable; falling back to lexical retrieval:',
        error
      );
    }
  }

  private async synthesizeToolLoopAnswer(
    originalQuestion: string,
    successfulToolResults: Array<{ tool: string; result: Record<string, unknown> }>,
    onStreamChunk?: (chunk: string) => void,
    onThinkingChunk?: (chunk: string) => void
  ): Promise<string> {
    const compactResults = successfulToolResults.map(({ tool, result }) => {
      const resultData = this.getToolResultData(result);
      return {
        tool,
        game: resultData.game,
        gameProfile: result.gameProfile,
        data: result.data,
        sources: result.sources,
        limitations: result.limitations,
      };
    });
    this.lastKnowledgeContext = JSON.stringify({
      originalQuestion,
      toolResults: compactResults,
    });

    const firstSources = successfulToolResults
      .map(({ result }) => this.normalizeSources(result.sources))
      .find((sources) => sources.length > 0);
    if (firstSources) {
      this.lastSources = firstSources;
    }

    const toolLoopSystemPrompt = `Answer the original Pokémon question using only the successful tool results below.
Tool calling is disabled for this synthesis step.
Reply in the same language as the original question.
Do not mix languages.
For encounter results, include the encounter method and a few relevant locations when available.
If the useful tool results are insufficient, say exactly what is missing instead of inventing data.
Do not include a sources, citations, links, or references section. The application renders sources separately.`;
    this.logPromptForDebug(
      'TOOL-RESULT SYNTHESIS SYSTEM PROMPT (sent to Ollama)',
      toolLoopSystemPrompt
    );

    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: toolLoopSystemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify({
              originalQuestion,
              successfulToolResults: this.stripSourceMetadata(compactResults),
            }),
          },
        ],
        stream: Boolean(onStreamChunk),
        think: this.thinking,
        options: {
          temperature: Math.min(this.temperature, 0.2),
          num_predict: this.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama tool-loop synthesis error: ${response.statusText} ${errorText}`
      );
    }

    if (!onStreamChunk) {
      const data = (await response.json()) as OllamaChatResponse;
      if (data.message?.thinking) {
        onThinkingChunk?.(data.message.thinking);
      }
      return data.message?.content || '';
    }

    let fullReply = '';
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No readable stream');
    }
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaChatResponse;
          const content = data.message?.content || '';
          const thinking = data.message?.thinking || '';
          if (thinking) {
            onThinkingChunk?.(thinking);
          }
          if (content) {
            fullReply += content;
            onStreamChunk(content);
          }
        } catch {
          // Skip malformed stream fragments.
        }
      }
    }

    return fullReply;
  }

  private async tryRetainedKnowledgeAnswer(
    question: string,
    retainedKnowledge: string[],
    onThinkingChunk?: (chunk: string) => void
  ): Promise<string | null> {
    const retainedKnowledgeSystemPrompt = `Use the retained verified Pokémon knowledge to answer the follow-up.
Reply in the user's language and do not invent facts.
Do not include a sources, citations, links, or references section. The application renders sources separately.
If the retained knowledge is insufficient or unrelated, reply with exactly NEED_TOOL.`;
    this.logPromptForDebug(
      'RETAINED-KNOWLEDGE SYSTEM PROMPT (sent to Ollama)',
      retainedKnowledgeSystemPrompt
    );
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: retainedKnowledgeSystemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify({
              question,
              retainedKnowledge: retainedKnowledge.map((knowledge) =>
                this.stripSourceMetadataFromString(knowledge)
              ),
            }),
          },
        ],
        stream: false,
        think: this.thinking,
        options: {
          temperature: Math.min(this.temperature, 0.2),
          num_predict: this.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as OllamaChatResponse;
    if (data.message?.thinking) {
      onThinkingChunk?.(data.message.thinking);
    }
    const reply = data.message?.content?.trim() ?? '';
    return !reply || reply === 'NEED_TOOL' ? null : reply;
  }

  private stripSourceMetadata(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.stripSourceMetadata(entry));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (
        key === 'sources' ||
        key === 'source' ||
        key === 'sourceRefs' ||
        key === 'url' ||
        key === 'displayName' ||
        key === 'siteName' ||
        key === 'icon' ||
        key === 'logoUrl'
      ) {
        continue;
      }
      result[key] = this.stripSourceMetadata(nestedValue);
    }
    return result;
  }

  private stripSourceMetadataFromString(value: string): unknown {
    try {
      return this.stripSourceMetadata(JSON.parse(value));
    } catch {
      return value;
    }
  }

  private formatToolResultForModel(toolName: string, result: Record<string, unknown>): string {
    const compactResult = this.compactToolResultForModel(result);
    return `Latest tool result "${toolName}" succeeded. If this result contains enough information to answer the user's question, answer directly from it. Do not ask for fields already present in the tool result, such as game, species, item, location, method, or summary.

${JSON.stringify(compactResult)}`;
  }

  private getToolResultData(result: Record<string, unknown>): Record<string, unknown> {
    return result.data && typeof result.data === 'object'
      ? (result.data as Record<string, unknown>)
      : {};
  }

  private compactToolResultForModel(result: Record<string, unknown>): Record<string, unknown> {
    const data = this.getToolResultData(result);
    const compactData = { ...data };

    this.compactArrayFieldForModel(compactData, 'entries', 12);
    this.compactArrayFieldForModel(compactData, 'matches', 8);
    this.compactArrayFieldForModel(compactData, 'locationSummaries', 24);

    return this.stripSourceMetadata({
      ok: result.ok,
      tool: result.tool,
      gameProfile: result.gameProfile,
      summary: compactData.summary,
      answerPolicy: compactData.answerPolicy,
      data: compactData,
      limitations: result.limitations,
    }) as Record<string, unknown>;
  }

  private compactArrayFieldForModel(
    data: Record<string, unknown>,
    fieldName: string,
    limit: number
  ): void {
    const value = data[fieldName];
    if (!Array.isArray(value) || value.length <= limit) {
      return;
    }

    data[fieldName] = value.slice(0, limit);
    data[`${fieldName}Total`] = value.length;
    data[`${fieldName}Omitted`] = value.length - limit;
  }

  private normalizeSources(value: unknown): ChatSource[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((source): ChatSource | undefined => {
        if (!source || typeof source !== 'object') {
          return undefined;
        }
        const record = source as Record<string, unknown>;
        const name = typeof record.name === 'string' ? record.name : 'Source';
        const kind = typeof record.kind === 'string' ? record.kind : 'reference';
        const url = typeof record.url === 'string' ? record.url : undefined;
        const scope = typeof record.scope === 'string' ? record.scope : undefined;
        const displayName =
          typeof record.displayName === 'string' ? record.displayName : undefined;
        const siteName = typeof record.siteName === 'string' ? record.siteName : undefined;
        const icon = typeof record.icon === 'string' ? record.icon : undefined;
        const logoUrl = typeof record.logoUrl === 'string' ? record.logoUrl : undefined;
        return {
          kind,
          name,
          ...(url ? { url } : {}),
          ...(scope ? { scope } : {}),
          ...(displayName ? { displayName } : {}),
          ...(siteName ? { siteName } : {}),
          ...(icon ? { icon } : {}),
          ...(logoUrl ? { logoUrl } : {}),
        };
      })
      .filter((source): source is ChatSource => Boolean(source))
      .filter(
        (source, index, all) =>
          !source.url ||
          all.findIndex((candidate) => candidate.url === source.url) === index
      )
      .slice(0, 8);
  }

  private extractRetainedSources(retainedKnowledge: string[]): ChatSource[] {
    for (const retained of [...retainedKnowledge].reverse()) {
      try {
        const parsed = JSON.parse(retained) as { sources?: unknown };
        const sources = this.normalizeSources(parsed.sources);
        if (sources.length > 0) {
          return sources;
        }
      } catch {
        // Ignore old retained snippets that were not JSON.
      }
    }
    return [];
  }

  private stringifyForDebug(value: unknown): string {
    try {
      const text = JSON.stringify(value, (key, entry) => {
        if (key === '_queryEmbedding' && Array.isArray(entry)) {
          return `[${entry.length} embedding values]`;
        }
        return entry;
      });
      if (!text) {
        return String(value);
      }
      return text.length > 2000 ? `${text.slice(0, 2000)}...[truncated]` : text;
    } catch {
      return String(value);
    }
  }

  private logPromptForDebug(label: string, prompt: string): void {
    const preview =
      prompt.length > DEBUG_PROMPT_PREVIEW_CHARS
        ? `${prompt.slice(0, DEBUG_PROMPT_PREVIEW_CHARS)}\n...[truncated ${prompt.length - DEBUG_PROMPT_PREVIEW_CHARS} chars]`
        : prompt;
    const approxTokens = Math.ceil(prompt.length / 4);
    console.log(
      `[OLLAMA DEBUG] ${label} chars=${prompt.length} approxTokens=${approxTokens} truncated=${prompt.length > DEBUG_PROMPT_PREVIEW_CHARS}:\n${preview}`
    );
  }

  private logChatRequestForDebug(label: string, requestBody: Record<string, unknown>): void {
    const messages = Array.isArray(requestBody.messages)
      ? (requestBody.messages as OllamaMessage[])
      : [];
    const tools = Array.isArray(requestBody.tools)
      ? (requestBody.tools as ChatToolDefinition[])
      : [];
    const messagePreview = messages.map((message, index) => {
      const content = message.content ?? '';
      return {
        index,
        role: message.role,
        tool_name: message.tool_name,
        contentChars: content.length,
        contentPreview:
          content.length > 1200 ? `${content.slice(0, 1200)}...[truncated]` : content,
        tool_calls: message.tool_calls?.map((call) => ({
          name: call.function?.name,
          arguments: call.function?.arguments,
        })),
      };
    });
    const toolNames = tools.map((tool) => tool.function.name);
    console.log(
      `[OLLAMA DEBUG] ${label}: ${this.stringifyForDebug({
        model: requestBody.model,
        stream: requestBody.stream,
        think: requestBody.think,
        options: requestBody.options,
        messageCount: messages.length,
        messages: messagePreview,
        toolCount: tools.length,
        tools: toolNames,
      })}`
    );
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  private formatIdentityContext(context?: GameContextSnapshot): string {
    if (!context) {
      return '';
    }

    return `\n\nTrainer: ${context.trainerName}\nGame: ${context.gameTitle || 'Pokémon'}`;
  }

  private looksLikeToolUnsupported(status: number, responseBody: string): boolean {
    if (status < 400) {
      return false;
    }
    const text = responseBody.toLowerCase();
    return (
      text.includes('tool') ||
      text.includes('tool_calls') ||
      text.includes('unsupported') ||
      text.includes('unknown field')
    );
  }

  private matchesOllamaModelName(available: string, requested: string): boolean {
    return (
      available === requested ||
      available === `${requested}:latest` ||
      (requested.endsWith(':latest') && requested.slice(0, -':latest'.length) === available)
    );
  }

  private parseToolArguments(rawArgs: unknown): Record<string, unknown> {
    if (!rawArgs) {
      return {};
    }

    if (typeof rawArgs === 'string') {
      try {
        return JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        return {};
      }
    }

    if (typeof rawArgs === 'object') {
      return rawArgs as Record<string, unknown>;
    }

    return {};
  }

  async getToolDefinitions(): Promise<ChatToolDefinition[]> {
    return (await loadToolRegistry()).getChatToolDefinitions();
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context?: GameContextSnapshot
  ): Promise<Record<string, unknown>> {
    return (await loadToolRegistry()).executeChatTool(toolName, args, context);
  }

  private formatGameContext(context: GameContextSnapshot): string {
    const playtime = `${context.playtime.hours}h ${context.playtime.minutes}m ${context.playtime.seconds}s`;

    const partyDetails = (context.partyPokemonDetailed ?? [])
      .map((p, i) => {
        const movesStr = p.moves
          .map(
            (m) =>
              `- ${m.name} | ${m.type}${m.power ? ` | Power ${m.power}` : ''} | PP ${m.pp}/${m.maxPp}`
          )
          .join('\n      ');

        return `${i + 1}. ${p.name} (${p.species}) Lv.${p.level}
     HP: ${p.hp}/${p.maxHp}
     Types: ${p.types.join('/')}
     Status: ${p.status}
     ${p.ability ? `Ability: ${p.ability}` : ''}
     ${p.nature ? `Nature: ${p.nature}` : ''}
     ${p.heldItem ? `Held Item: ${p.heldItem}` : 'No item'}
     Moves:
      ${movesStr || '(none)'}`;
      })
      .join('\n\n');
    const storyContext = (context.progressFacts ?? [])
      .map((fact) => `- ${fact.label}: ${fact.value}. ${fact.description}${fact.nextStep ? ` Next: ${fact.nextStep}` : ''}`)
      .join('\n');

    return `## Game State

Game: ${context.gameTitle || 'Pokémon'}
Trainer: ${context.trainerName}
Location: ${context.location}
Money: ₽${context.money.toLocaleString()}
Playtime: ${playtime}
Badges: ${context.badges}
Pokédex: ${context.pokedexOwned}/${context.pokedexSeen}

## Story Context
${storyContext || '(no audited non-boolean story state available)'}

## Party
${partyDetails || '(empty)'}`;
  }

}
