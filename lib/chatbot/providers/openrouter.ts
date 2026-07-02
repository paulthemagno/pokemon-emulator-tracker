import type {
  ChatImageAttachment,
  ChatMessage,
  ChatProvider,
  ChatSource,
  GameContextSnapshot,
  ProviderConfig,
} from '../types';
import {
  buildKnowledgeContext,
  buildToolLoopKnowledgeContext,
  CHAT_TOOL_POLICY,
  compactSuccessfulToolResults,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  duplicateToolCallResult,
  extractRetainedSources,
  formatGameContext,
  formatIdentityContext,
  formatToolResultForModel,
  getRetainedKnowledge,
  getToolCallSignature,
  logToolCallDebug,
  logToolProviderAvailableTools,
  logToolProviderEvent,
  loadChatToolRegistry,
  missingGameContextToolResult,
  normalizeSources,
  parseToolArguments,
  RETAINED_KNOWLEDGE_PROMPT,
  stripSourceMetadata,
  stripSourceMetadataFromString,
  TOOL_RESULT_SYNTHESIS_PROMPT,
  withRetainedKnowledge,
} from './shared';

type OpenRouterContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: OpenRouterContent;
  tool_call_id?: string;
  tool_calls?: Array<{
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string | Record<string, unknown>;
    };
  }>;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    delta?: OpenRouterMessage;
    message?: OpenRouterMessage;
  }>;
};

export class OpenRouterProvider implements ChatProvider {
  name = 'OpenRouter';
  private endpoint = 'https://openrouter.ai/api/v1';
  private modelName = 'google/gemini-2.5-flash-lite';
  private apiKey?: string;
  private maxTokens = -1;
  private temperature = 0;
  private ready = false;
  private lastKnowledgeContext?: string;
  private lastSources: ChatSource[] = [];

  async initialize(config: ProviderConfig): Promise<void> {
    this.modelName = config.modelName?.trim() || process.env.OPENROUTER_MODEL || this.modelName;
    this.apiKey = config.apiKey?.trim() || process.env.OPENROUTER_API_KEY;
    this.maxTokens = config.maxTokens ?? this.maxTokens;
    this.temperature = config.temperature ?? this.temperature;
    if (process.env.OPENROUTER_BASE_URL) {
      this.endpoint = process.env.OPENROUTER_BASE_URL.replace(/\/+$/, '');
    }
    await this.validateConfig();
  }

  async validateConfig(): Promise<boolean> {
    this.ready = Boolean(this.apiKey && this.modelName);
    return this.ready;
  }

  isReady(): boolean {
    return this.ready;
  }

  getInfo() {
    return {
      provider: this.name,
      modelName: this.modelName,
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

  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[],
    gameContext?: GameContextSnapshot,
    systemPrompt?: string,
    onStreamChunk?: (chunk: string) => void,
    attachments: ChatImageAttachment[] = []
  ): Promise<string> {
    if (!this.ready) {
      throw new Error('OpenRouter provider not initialized. Add an OpenRouter API key.');
    }
    this.lastKnowledgeContext = undefined;
    this.lastSources = [];

    const baseSystemPrompt = systemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT;
    const fullSystemPrompt = `${baseSystemPrompt}${formatIdentityContext(gameContext)}`;
    const messages: OpenRouterMessage[] = [
      ...conversationHistory.map((msg): OpenRouterMessage => ({
        role: msg.role,
        content: this.formatUserContent(withRetainedKnowledge(msg), msg.attachments ?? []),
      })),
      {
        role: 'user',
        content: this.formatUserContent(message, attachments),
      },
    ];

    const retainedKnowledge = getRetainedKnowledge(conversationHistory);
    if (retainedKnowledge.length > 0) {
      const retainedReply = await this.tryRetainedKnowledgeAnswer(message, retainedKnowledge);
      if (retainedReply !== null) {
        this.lastKnowledgeContext = retainedKnowledge[retainedKnowledge.length - 1];
        this.lastSources = extractRetainedSources(retainedKnowledge);
        onStreamChunk?.(retainedReply);
        return retainedReply;
      }
    }

    const toolReply = await this.tryToolCalling(messages, fullSystemPrompt, gameContext, onStreamChunk);
    if (toolReply !== null) {
      return toolReply;
    }

    const fallbackSystemPrompt = gameContext
      ? `${fullSystemPrompt}\n\n## Current Game State:\n${formatGameContext(gameContext)}`
      : fullSystemPrompt;
    return this.complete(
      [{ role: 'system', content: fallbackSystemPrompt }, ...messages],
      onStreamChunk
    );
  }

  private async tryToolCalling(
    messages: OpenRouterMessage[],
    fullSystemPrompt: string,
    gameContext?: GameContextSnapshot,
    onStreamChunk?: (chunk: string) => void
  ): Promise<string | null> {
    const registry = await loadChatToolRegistry();
    const tools = registry.getChatToolDefinitions().filter(
      (tool) => gameContext || registry.canExecuteToolWithoutContext(tool.function.name)
    );
    logToolProviderEvent('OPENROUTER', `Attempting tool-calling with model: ${this.modelName}`);
    logToolProviderAvailableTools('OPENROUTER', tools);
    const workingMessages: OpenRouterMessage[] = [
      { role: 'system', content: `${fullSystemPrompt}\n\n${CHAT_TOOL_POLICY}` },
      ...messages,
    ];
    const originalQuestion = this.textFromContent(
      [...messages].reverse().find((entry) => entry.role === 'user')?.content
    );
    const successfulToolResults: Array<{ tool: string; result: Record<string, unknown> }> = [];
    const executedToolSignatures = new Set<string>();

    for (let round = 0; round < 6; round += 1) {
      logToolProviderEvent('OPENROUTER', `Round ${round + 1}/6`);
      const response = await this.chatCompletion({
        messages: workingMessages,
        stream: false,
        tools,
      });
      const assistantMessage = response.choices?.[0]?.message;
      if (!assistantMessage) return null;
      const toolCalls = assistantMessage.tool_calls ?? [];
      if (toolCalls.length === 0) {
        logToolProviderEvent('OPENROUTER', 'Model returned final response without tool calls');
        const content = this.textFromContent(assistantMessage.content).trim();
        if (!content) return null;
        onStreamChunk?.(content);
        return content;
      }

      logToolProviderEvent('OPENROUTER', `Tool calls requested: ${toolCalls.length}`);
      workingMessages.push(assistantMessage);
      for (const call of toolCalls) {
        const name = call.function?.name ?? '';
        const args = parseToolArguments(call.function?.arguments);
        const signature = getToolCallSignature(name, args);
        const isDuplicate = executedToolSignatures.has(signature);
        if (!isDuplicate) executedToolSignatures.add(signature);

        const result: Record<string, unknown> = isDuplicate
          ? duplicateToolCallResult(name)
          : gameContext || registry.canExecuteToolWithoutContext(name)
            ? registry.executeChatTool(name, args, gameContext)
            : missingGameContextToolResult(name);

        logToolCallDebug('OPENROUTER', name, args, result, {
          duplicate: isDuplicate,
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
          tool_call_id: call.id,
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

    if (successfulToolResults.length === 0) return null;
    const compactResults = compactSuccessfulToolResults(successfulToolResults);
    this.lastKnowledgeContext = buildToolLoopKnowledgeContext(
      originalQuestion,
      successfulToolResults
    );
    return this.complete(
      [
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
      onStreamChunk
    );
  }

  private async complete(
    messages: OpenRouterMessage[],
    onStreamChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!onStreamChunk) {
      const response = await this.chatCompletion({ messages, stream: false });
      return this.textFromContent(response.choices?.[0]?.message?.content).trim();
    }

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.buildRequestBody({ messages, stream: true })),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText} ${await response.text()}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('OpenRouter response did not include a stream.');
    const decoder = new TextDecoder();
    let pending = '';
    let fullReply = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice('data:'.length).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const data = JSON.parse(payload) as OpenRouterChatResponse;
          const chunk = this.textFromContent(data.choices?.[0]?.delta?.content);
          if (chunk) {
            fullReply += chunk;
            onStreamChunk(chunk);
          }
        } catch {
          // Ignore malformed SSE frames.
        }
      }
    }
    return fullReply;
  }

  private async tryRetainedKnowledgeAnswer(
    question: string,
    retainedKnowledge: string[]
  ): Promise<string | null> {
    const response = await this.chatCompletion({
      messages: [
        { role: 'system', content: RETAINED_KNOWLEDGE_PROMPT },
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
    }).catch(() => null);

    const reply = this.textFromContent(response?.choices?.[0]?.message?.content).trim();
    return !reply || reply === 'NEED_TOOL' ? null : reply;
  }

  private async chatCompletion(input: {
    messages: OpenRouterMessage[];
    stream: false;
    tools?: unknown[];
  }): Promise<OpenRouterChatResponse> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.buildRequestBody(input)),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText} ${await response.text()}`);
    }
    return (await response.json()) as OpenRouterChatResponse;
  }

  private buildRequestBody(input: {
    messages: OpenRouterMessage[];
    stream: boolean;
    tools?: unknown[];
  }) {
    return {
      model: this.modelName,
      messages: input.messages,
      stream: input.stream,
      ...(input.tools && input.tools.length > 0 ? { tools: input.tools } : {}),
      temperature: this.temperature,
      ...(this.maxTokens > 0 ? { max_tokens: this.maxTokens } : {}),
    };
  }

  private getHeaders(): HeadersInit {
    if (!this.apiKey) throw new Error('OpenRouter API key is required.');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private formatUserContent(text: string, attachments: ChatImageAttachment[]): OpenRouterContent {
    if (attachments.length === 0) return text;
    return [
      { type: 'text', text },
      ...attachments.map((attachment) => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:${attachment.mediaType};base64,${attachment.data}`,
        },
      })),
    ];
  }

  private textFromContent(content: OpenRouterContent | undefined): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content
      .filter((entry): entry is { type: 'text'; text: string } => entry.type === 'text')
      .map((entry) => entry.text)
      .join('');
  }

}
