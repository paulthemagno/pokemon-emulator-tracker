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
import {
  areChatToolsEnabled,
  buildKnowledgeContext,
  buildToolLoopKnowledgeContext,
  CHAT_TOOL_POLICY,
  compactSuccessfulToolResults,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  duplicateToolCallResult,
  executeTool as executeSharedTool,
  extractRetainedSources,
  formatGameContext,
  formatIdentityContext,
  formatToolResultForModel,
  getRetainedKnowledge,
  getToolCallSignature,
  getToolDefinitions as getSharedToolDefinitions,
  logToolCallDebug,
  logToolProviderAvailableTools,
  logToolProviderEvent,
  loadChatToolRegistry,
  missingGameContextToolResult,
  normalizeSources,
  parseToolArguments,
  RETAINED_KNOWLEDGE_PROMPT,
  stringifyForChatDebug,
  stripSourceMetadata,
  stripSourceMetadataFromString,
  TOOL_RESULT_SYNTHESIS_PROMPT,
  withRetainedKnowledge,
} from './shared';

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
    const baseSystemPrompt = systemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT;
    const fullSystemPrompt = `${baseSystemPrompt}${formatIdentityContext(gameContext)}`;

    // Build message history
    const messages = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content:
          withRetainedKnowledge(msg),
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
    console.log('[OLLAMA DEBUG] TOOLS ENABLED:', areChatToolsEnabled());
    console.log('[OLLAMA DEBUG] MODEL SUPPORTS TOOLS (cached):', this.modelSupportsTools);
    console.log('[OLLAMA DEBUG] ==========\n');

    try {
      const retainedKnowledge = getRetainedKnowledge(conversationHistory);
      if (retainedKnowledge.length > 0) {
        const retainedReply = await this.tryRetainedKnowledgeAnswer(
          message,
          retainedKnowledge,
          onThinkingChunk
        );
        if (retainedReply !== null) {
          this.lastKnowledgeContext =
            retainedKnowledge[retainedKnowledge.length - 1];
          this.lastSources = extractRetainedSources(retainedKnowledge);
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
        ? `${fullSystemPrompt}\n\n## Current Game State:\n${formatGameContext(gameContext)}`
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
    if (!areChatToolsEnabled()) {
      logToolProviderEvent('OLLAMA', 'Skipping tool-calling: disabled via CHAT_ENABLE_TOOLS');
      return null;
    }

    if (this.modelSupportsTools === false) {
      logToolProviderEvent('OLLAMA', 'Skipping tool-calling: model previously marked unsupported');
      return null;
    }

    const registry = await loadChatToolRegistry((message) =>
      logToolProviderEvent('OLLAMA', message)
    );
    const tools = registry.getChatToolDefinitions().filter(
      (tool) => gameContext || registry.canExecuteToolWithoutContext(tool.function.name)
    );
    const toolAwareSystemPrompt = `${fullSystemPrompt}\n\n${CHAT_TOOL_POLICY}`;

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

    logToolProviderEvent('OLLAMA', `Attempting tool-calling with model: ${this.modelName}`);
    this.logPromptForDebug(
      'TOOL-CALLING SYSTEM PROMPT (sent to Ollama)',
      toolAwareSystemPrompt
    );
    logToolProviderAvailableTools('OLLAMA', tools);

    for (let i = 0; i < 6; i += 1) {
      logToolProviderEvent('OLLAMA', `Round ${i + 1}/6`);
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
        logToolProviderEvent('OLLAMA', 'Model returned final response without tool calls');
        const finalContent = assistantMessage.content?.trim() ?? '';
        if (!finalContent) {
          logToolProviderEvent(
            'OLLAMA',
            'Empty final response from tool-calling round; falling back to standard response flow'
          );
          return null;
        }
        if (onStreamChunk) {
          onStreamChunk(finalContent);
        }
        return finalContent;
      }

      this.modelSupportsTools = true;
      logToolProviderEvent('OLLAMA', `Tool calls requested: ${toolCalls.length}`);
      workingMessages.push(assistantMessage);

      for (const call of toolCalls) {
        const name = call.function?.name || '';
        const args = parseToolArguments(call.function?.arguments);
        if (name === 'search_game_guidance') {
          await this.attachGuidanceQueryEmbedding(args);
        }
        const toolSignature = getToolCallSignature(name, args);
        const isDuplicateToolCall = executedToolSignatures.has(toolSignature);
        if (!isDuplicateToolCall) {
          executedToolSignatures.add(toolSignature);
        }
        const result: Record<string, unknown> = isDuplicateToolCall
          ? duplicateToolCallResult(name)
          : gameContext || registry.canExecuteToolWithoutContext(name)
            ? registry.executeChatTool(name, args, gameContext)
            : missingGameContextToolResult(name);

        logToolCallDebug('OLLAMA', name, args, result, {
          duplicate: isDuplicateToolCall,
        });

        if (result.ok === true) {
          successfulToolResults.push({ tool: name, result });
          const sources = normalizeSources(result.sources);
          if (sources.length > 0 && this.lastSources.length === 0) {
            this.lastSources = sources;
          }
          this.lastKnowledgeContext = buildKnowledgeContext(name, result);
        }

        workingMessages.push({
          role: 'tool',
          tool_name: name,
          content: JSON.stringify(result),
        });
        if (result.ok === true) {
          workingMessages.push({
            role: 'system',
            content: formatToolResultForModel(name, result),
          });
        }
      }
    }

    logToolProviderEvent('OLLAMA', 'Max rounds reached, synthesizing from tool results');
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
    const compactResults = compactSuccessfulToolResults(successfulToolResults);
    this.lastKnowledgeContext = buildToolLoopKnowledgeContext(
      originalQuestion,
      successfulToolResults
    );

    const firstSources = successfulToolResults
      .map(({ result }) => normalizeSources(result.sources))
      .find((sources) => sources.length > 0);
    if (firstSources) {
      this.lastSources = firstSources;
    }

    this.logPromptForDebug(
      'TOOL-RESULT SYNTHESIS SYSTEM PROMPT (sent to Ollama)',
      TOOL_RESULT_SYNTHESIS_PROMPT
    );

    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: TOOL_RESULT_SYNTHESIS_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify({
              originalQuestion,
              successfulToolResults: stripSourceMetadata(compactResults),
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
    this.logPromptForDebug(
      'RETAINED-KNOWLEDGE SYSTEM PROMPT (sent to Ollama)',
      RETAINED_KNOWLEDGE_PROMPT
    );
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: RETAINED_KNOWLEDGE_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify({
              question,
              retainedKnowledge: retainedKnowledge.map((knowledge) =>
                stripSourceMetadataFromString(knowledge)
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


  private stringifyForDebug(value: unknown): string {
    return stringifyForChatDebug(value);
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

  async getToolDefinitions(): Promise<ChatToolDefinition[]> {
    return getSharedToolDefinitions();
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context?: GameContextSnapshot
  ): Promise<Record<string, unknown>> {
    return executeSharedTool(toolName, args, context);
  }

}
