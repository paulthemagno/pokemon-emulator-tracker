import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import {
  generateText,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type UserContent,
} from 'ai';
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
  CHAT_TOOL_POLICY,
  DEFAULT_CHAT_SYSTEM_PROMPT,
  duplicateToolCallResult,
  extractRetainedSources,
  formatGameContext,
  formatIdentityContext,
  getRetainedKnowledge,
  getToolCallSignature,
  logToolCallDebug,
  logToolProviderAvailableTools,
  logToolProviderEvent,
  loadChatToolRegistry,
  missingGameContextToolResult,
  normalizeSources,
  RETAINED_KNOWLEDGE_PROMPT,
  stripSourceMetadataFromString,
  withRetainedKnowledge,
} from './shared';

type AiSdkVendor = 'anthropic' | 'openai' | 'google';

type ResolvedModel = {
  vendor: AiSdkVendor;
  providerModelName: string;
  model: LanguageModel;
};

export class AiSdkByokProvider implements ChatProvider {
  name = 'AI SDK BYOK';
  private modelName = 'anthropic/claude-sonnet-4-5';
  private apiKey?: string;
  private maxTokens = -1;
  private temperature = 0;
  private thinking = true;
  private ready = false;
  private endpoint = 'native-provider-api';
  private lastKnowledgeContext?: string;
  private lastSources: ChatSource[] = [];

  async initialize(config: ProviderConfig): Promise<void> {
    this.modelName = config.modelName?.trim() || process.env.AI_SDK_MODEL || this.modelName;
    this.apiKey = config.apiKey?.trim() || process.env.AI_SDK_API_KEY;
    this.maxTokens = config.maxTokens ?? this.maxTokens;
    this.temperature = config.temperature ?? this.temperature;
    this.thinking = config.thinking !== false;
    await this.validateConfig();
  }

  async validateConfig(): Promise<boolean> {
    this.ready = Boolean(this.apiKey && this.modelName.includes('/'));
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
    attachments: ChatImageAttachment[] = [],
    onThinkingChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!this.ready || !this.apiKey) {
      throw new Error(
        'AI SDK BYOK provider not initialized. Enter a provider/model name and matching API key.'
      );
    }
    this.lastKnowledgeContext = undefined;
    this.lastSources = [];

    const resolvedModel = this.resolveModel(this.modelName, this.apiKey);
    const baseSystemPrompt = systemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT;
    const fullSystemPrompt = `${baseSystemPrompt}${formatIdentityContext(gameContext)}`;
    const messages = this.buildMessages(message, conversationHistory, attachments);

    const retainedKnowledge = getRetainedKnowledge(conversationHistory);
    if (retainedKnowledge.length > 0) {
      const retainedReply = await this.tryRetainedKnowledgeAnswer(
        resolvedModel.model,
        message,
        retainedKnowledge
      );
      if (retainedReply !== null) {
        this.lastKnowledgeContext = retainedKnowledge[retainedKnowledge.length - 1];
        this.lastSources = extractRetainedSources(retainedKnowledge);
        onStreamChunk?.(retainedReply);
        return retainedReply;
      }
    }

    logToolProviderEvent(
      'AI SDK',
      `Attempting tool-calling with model: ${this.modelName}; reasoning: ${this.getReasoningOption()}`
    );
    const tools = await this.buildTools(gameContext);
    const system = `${fullSystemPrompt}\n\n${CHAT_TOOL_POLICY}`;
    if (onStreamChunk) {
      return this.streamWithTools(
        resolvedModel.model,
        system,
        messages,
        tools,
        onStreamChunk,
        onThinkingChunk
      );
    }

    const result = await generateText({
      model: resolvedModel.model,
      messages,
      system,
      tools,
      stopWhen: isStepCount(6),
      temperature: this.temperature,
      reasoning: this.getReasoningOption(),
      ...(this.maxTokens > 0 ? { maxOutputTokens: this.maxTokens } : {}),
    });
    if (result.reasoningText) {
      onThinkingChunk?.(result.reasoningText);
    }

    if (result.text.trim()) {
      return result.text;
    }

    const fallbackSystemPrompt = gameContext
      ? `${fullSystemPrompt}\n\n## Current Game State:\n${formatGameContext(gameContext)}`
      : fullSystemPrompt;
    const fallback = await generateText({
      model: resolvedModel.model,
      messages,
      system: fallbackSystemPrompt,
      temperature: this.temperature,
      reasoning: this.getReasoningOption(),
      ...(this.maxTokens > 0 ? { maxOutputTokens: this.maxTokens } : {}),
    });
    if (fallback.reasoningText) {
      onThinkingChunk?.(fallback.reasoningText);
    }
    return fallback.text;
  }

  private resolveModel(modelName: string, apiKey: string): ResolvedModel {
    const separatorIndex = modelName.indexOf('/');
    if (separatorIndex <= 0 || separatorIndex === modelName.length - 1) {
      throw new Error(
        'AI SDK model must use provider/model format, for example anthropic/claude-sonnet-4-5.'
      );
    }

    const vendor = modelName.slice(0, separatorIndex).toLowerCase();
    const providerModelName = modelName.slice(separatorIndex + 1);

    if (vendor === 'anthropic') {
      return {
        vendor,
        providerModelName,
        model: createAnthropic({ apiKey })(providerModelName),
      };
    }
    if (vendor === 'openai') {
      const openai = createOpenAI({ apiKey });
      return {
        vendor,
        providerModelName,
        model: openai.chat(providerModelName),
      };
    }
    if (vendor === 'google') {
      return {
        vendor,
        providerModelName,
        model: createGoogleGenerativeAI({
          apiKey,
        })(providerModelName),
      };
    }

    throw new Error(
      `Unsupported AI SDK model provider "${vendor}". Use anthropic/model, openai/model, or google/model.`
    );
  }

  private buildMessages(
    message: string,
    conversationHistory: ChatMessage[],
    attachments: ChatImageAttachment[]
  ): ModelMessage[] {
    return [
      ...conversationHistory.map((historyMessage): ModelMessage => {
        if (historyMessage.role === 'user') {
          return {
            role: 'user',
            content: this.formatUserContent(
              withRetainedKnowledge(historyMessage),
              historyMessage.attachments ?? []
            ),
          };
        }
        return {
          role: 'assistant',
          content: withRetainedKnowledge(historyMessage),
        };
      }),
      {
        role: 'user',
        content: this.formatUserContent(message, attachments),
      },
    ];
  }

  private formatUserContent(text: string, attachments: ChatImageAttachment[]): UserContent {
    if (attachments.length === 0) return text;
    return [
      { type: 'text', text },
      ...attachments.map((attachment) => ({
        type: 'image' as const,
        image: attachment.data,
        mediaType: attachment.mediaType,
      })),
    ];
  }

  private async buildTools(gameContext?: GameContextSnapshot): Promise<ToolSet> {
    const registry = await loadChatToolRegistry();
    const definitions = registry.getChatToolDefinitions().filter(
      (definition) => gameContext || registry.canExecuteToolWithoutContext(definition.function.name)
    );
    const executedToolSignatures = new Set<string>();
    const tools: ToolSet = {};
    logToolProviderAvailableTools('AI SDK', definitions);
    for (const definition of definitions) {
      const name = definition.function.name;
      const originalSchema = definition.function.parameters;

      tools[name] = tool({
        description: definition.function.description,
        inputSchema: jsonSchema(this.normalizeInputSchemaForAiSdk(originalSchema)),
        execute: async (args) => {
          const rawArgs = args && typeof args === 'object'
            ? (args as Record<string, unknown>)
            : {};
          const toolArgs = this.normalizeToolArgsForExecution(rawArgs, originalSchema);
          const signature = getToolCallSignature(name, toolArgs);
          const isDuplicate = executedToolSignatures.has(signature);
          if (!isDuplicate) {
            executedToolSignatures.add(signature);
          }
          const result: Record<string, unknown> = isDuplicate
            ? duplicateToolCallResult(name)
            : gameContext || registry.canExecuteToolWithoutContext(name)
              ? registry.executeChatTool(name, toolArgs, gameContext)
              : missingGameContextToolResult(name);

          logToolCallDebug('AI SDK', name, rawArgs, result, {
            normalizedArgs: toolArgs,
            duplicate: isDuplicate,
          });

          if (result.ok === true) {
            const sources = normalizeSources(result.sources);
            if (sources.length > 0 && this.lastSources.length === 0) {
              this.lastSources = sources;
            }
            this.lastKnowledgeContext = buildKnowledgeContext(name, result);
          }
          return result;
        },
      });
    }
    return tools;
  }

  private normalizeInputSchemaForAiSdk(schema: Record<string, unknown>): Record<string, unknown> {
    return this.mapJsonSchema(schema, (node) => {
      const type = node.type;
      const enumValues = node.enum;
      if (
        type === 'number' &&
        Array.isArray(enumValues) &&
        enumValues.some((value) => typeof value === 'number')
      ) {
        return {
          ...node,
          type: 'string',
          enum: enumValues.map((value) => String(value)),
          description: [node.description, 'Use one of these numeric values as a string.']
            .filter(Boolean)
            .join(' '),
        };
      }
      return node;
    }) as Record<string, unknown>;
  }

  private normalizeToolArgsForExecution(
    args: Record<string, unknown>,
    schema: Record<string, unknown>
  ): Record<string, unknown> {
    const properties = schema.properties && typeof schema.properties === 'object'
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {};
    const normalized = { ...args };

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (
        propertySchema.type === 'number' &&
        typeof normalized[key] === 'string' &&
        normalized[key].trim() !== ''
      ) {
        const numericValue = Number(normalized[key]);
        if (Number.isFinite(numericValue)) {
          normalized[key] = numericValue;
        }
      }
    }

    return normalized;
  }

  private mapJsonSchema(
    value: unknown,
    mapper: (node: Record<string, unknown>) => Record<string, unknown>
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.mapJsonSchema(item, mapper));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }

    const mappedEntries = Object.entries(value as Record<string, unknown>).map(
      ([key, childValue]) => [key, this.mapJsonSchema(childValue, mapper)]
    );
    return mapper(Object.fromEntries(mappedEntries));
  }

  private async streamWithTools(
    model: LanguageModel,
    system: string,
    messages: ModelMessage[],
    tools: ToolSet,
    onStreamChunk: (chunk: string) => void,
    onThinkingChunk?: (chunk: string) => void
  ): Promise<string> {
    const result = streamText({
      model,
      messages,
      system,
      tools,
      stopWhen: isStepCount(6),
      temperature: this.temperature,
      reasoning: this.getReasoningOption(),
      ...(this.maxTokens > 0 ? { maxOutputTokens: this.maxTokens } : {}),
    });

    let fullReply = '';
    for await (const part of result.fullStream) {
      if (part.type === 'error') {
        throw new Error(this.formatStreamError(part.error));
      }
      if (part.type === 'text-delta') {
        fullReply += part.text;
        onStreamChunk(part.text);
      }
      if (part.type === 'reasoning-delta') {
        onThinkingChunk?.(part.text);
      }
    }
    return fullReply;
  }

  private formatStreamError(error: unknown): string {
    if (error instanceof Error) {
      const nested = this.getNestedErrorMessage(error);
      return nested || error.message;
    }
    if (error && typeof error === 'object') {
      const nested = this.getNestedErrorMessage(error);
      if (nested) return nested;
    }
    return typeof error === 'string' ? error : 'AI SDK stream failed.';
  }

  private getNestedErrorMessage(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }
    const record = error as Record<string, unknown>;
    const lastError = record.lastError;
    if (lastError instanceof Error && lastError.message.trim()) {
      return lastError.message;
    }
    if (lastError && typeof lastError === 'object') {
      const message = (lastError as Record<string, unknown>).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return null;
  }

  private getReasoningOption(): 'provider-default' | 'none' {
    return this.thinking ? 'provider-default' : 'none';
  }

  private async tryRetainedKnowledgeAnswer(
    model: LanguageModel,
    question: string,
    retainedKnowledge: string[]
  ): Promise<string | null> {
    const result = await generateText({
      model,
      system: RETAINED_KNOWLEDGE_PROMPT,
      messages: [
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
      temperature: Math.min(this.temperature, 0.2),
      reasoning: this.getReasoningOption(),
      ...(this.maxTokens > 0 ? { maxOutputTokens: this.maxTokens } : {}),
    }).catch(() => null);

    const reply = result?.text.trim() ?? '';
    return !reply || reply === 'NEED_TOOL' ? null : reply;
  }
}
