import { NextRequest, NextResponse } from 'next/server';
import { AiSdkByokProvider } from '@/lib/chatbot/providers/ai-sdk';
import { OllamaProvider } from '@/lib/chatbot/providers/ollama';
import { OpenRouterProvider } from '@/lib/chatbot/providers/openrouter';
import type {
  ChatImageAttachment,
  ChatMessage,
  ChatProvider,
  ChatProviderInfo,
  ChatRuntimeConfig,
  GameContextSnapshot,
} from '@/lib/chatbot/types';

type ChatProviderName = NonNullable<ChatRuntimeConfig['provider']>;

const DEFAULT_PROVIDER: ChatProviderName =
  process.env.CHAT_PROVIDER === 'openrouter' || process.env.CHAT_PROVIDER === 'ai-sdk'
    ? process.env.CHAT_PROVIDER
    : 'ollama';
const DEFAULT_OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:latest';
const DEFAULT_OPENROUTER_ENDPOINT =
  process.env.OPENROUTER_BASE_URL?.replace(/\/+$/, '') || 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';
const DEFAULT_AI_SDK_MODEL =
  process.env.AI_SDK_MODEL || 'anthropic/claude-sonnet-4-5';

function resolveEnvValue(
  providerValue: string | undefined,
  sharedValue: string | undefined
): string | undefined {
  return providerValue?.trim() ? providerValue : sharedValue;
}

function parseMaxTokens(value: string | undefined): number {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return -1;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

function validateEndpoint(endpoint: string, isRuntimeOverride = false): string {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Ollama endpoint must use HTTP or HTTPS.');
  }
  const isLocal =
    url.hostname === '127.0.0.1' ||
    url.hostname === 'localhost' ||
    url.hostname === '::1';
  if (
    isRuntimeOverride &&
    !isLocal &&
    process.env.OLLAMA_ALLOW_RUNTIME_ENDPOINT !== 'true'
  ) {
    throw new Error(
      'Remote endpoint overrides are disabled. Configure OLLAMA_ENDPOINT or set OLLAMA_ALLOW_RUNTIME_ENDPOINT=true.'
    );
  }
  return endpoint.replace(/\/+$/, '');
}

function parseTemperature(value: string | undefined): number {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}

function resolveProviderName(runtimeConfig: ChatRuntimeConfig = {}): ChatProviderName {
  return runtimeConfig.provider === 'ollama' ||
    runtimeConfig.provider === 'openrouter' ||
    runtimeConfig.provider === 'ai-sdk'
    ? runtimeConfig.provider
    : DEFAULT_PROVIDER;
}

async function createProvider(runtimeConfig: ChatRuntimeConfig = {}): Promise<ChatProvider> {
  const providerName = resolveProviderName(runtimeConfig);
  if (providerName === 'ai-sdk') {
    const provider = new AiSdkByokProvider();
    await provider.initialize({
      modelName: runtimeConfig.modelName?.trim() || DEFAULT_AI_SDK_MODEL,
      apiKey: runtimeConfig.apiKey?.trim() || process.env.AI_SDK_API_KEY,
      maxTokens: parseMaxTokens(
        resolveEnvValue(process.env.AI_SDK_MAX_TOKENS, process.env.CHAT_MAX_TOKENS)
      ),
      temperature: parseTemperature(
        resolveEnvValue(process.env.AI_SDK_TEMPERATURE, process.env.CHAT_TEMPERATURE)
      ),
      thinking:
        runtimeConfig.thinking ??
        parseBoolean(
          resolveEnvValue(process.env.AI_SDK_REASONING, process.env.CHAT_THINKING),
          true
        ),
    });
    return provider;
  }

  if (providerName === 'openrouter') {
    const provider = new OpenRouterProvider();
    await provider.initialize({
      modelName: runtimeConfig.modelName?.trim() || DEFAULT_OPENROUTER_MODEL,
      apiKey: runtimeConfig.apiKey?.trim() || process.env.OPENROUTER_API_KEY,
      maxTokens: parseMaxTokens(
        resolveEnvValue(process.env.OPENROUTER_MAX_TOKENS, process.env.CHAT_MAX_TOKENS)
      ),
      temperature: parseTemperature(
        resolveEnvValue(process.env.OPENROUTER_TEMPERATURE, process.env.CHAT_TEMPERATURE)
      ),
    });
    return provider;
  }

  const provider = new OllamaProvider();
  await provider.initialize({
    endpoint: validateEndpoint(
      runtimeConfig.endpoint || DEFAULT_OLLAMA_ENDPOINT,
      Boolean(runtimeConfig.endpoint)
    ),
    modelName: runtimeConfig.modelName?.trim() || DEFAULT_OLLAMA_MODEL,
    embeddingModelName:
      runtimeConfig.embeddingModelName?.trim() || process.env.OLLAMA_EMBEDDING_MODEL,
    apiKey: runtimeConfig.apiKey?.trim() || process.env.OLLAMA_API_KEY,
    maxTokens: parseMaxTokens(
      resolveEnvValue(process.env.OLLAMA_MAX_TOKENS, process.env.CHAT_MAX_TOKENS)
    ),
    temperature: parseTemperature(
      resolveEnvValue(process.env.OLLAMA_TEMPERATURE, process.env.CHAT_TEMPERATURE)
    ),
    thinking:
      runtimeConfig.thinking ??
      parseBoolean(resolveEnvValue(process.env.OLLAMA_THINKING, process.env.CHAT_THINKING), true),
  });
  return provider;
}

function getProviderInfo(
  provider: ChatProvider,
  credentialSource: ChatProviderInfo['credentialSource']
): ChatProviderInfo {
  return {
    ...provider.getInfo(),
    credentialSource,
  };
}

function getCredentialSource(
  providerName: ChatProviderName,
  runtimeConfig: ChatRuntimeConfig = {}
): ChatProviderInfo['credentialSource'] {
  if (runtimeConfig.apiKey?.trim()) {
    return 'request';
  }
  if (providerName === 'openrouter') {
    return process.env.OPENROUTER_API_KEY ? 'environment' : 'none';
  }
  if (providerName === 'ai-sdk') {
    return process.env.AI_SDK_API_KEY ? 'environment' : 'none';
  }
  return process.env.OLLAMA_API_KEY ? 'environment' : 'none';
}

function getFallbackProviderInfo(
  providerName: ChatProviderName,
  error: unknown
): ChatProviderInfo & { error: string } {
  if (providerName === 'openrouter') {
    return {
      provider: 'OpenRouter',
      modelName: DEFAULT_OPENROUTER_MODEL,
      endpoint: DEFAULT_OPENROUTER_ENDPOINT,
      ready: false,
      credentialSource: process.env.OPENROUTER_API_KEY ? 'environment' : 'none',
      error: error instanceof Error ? error.message : 'Provider check failed.',
    };
  }

  if (providerName === 'ai-sdk') {
    return {
      provider: 'AI SDK BYOK',
      modelName: DEFAULT_AI_SDK_MODEL,
      endpoint: 'native-provider-api',
      ready: false,
      credentialSource: process.env.AI_SDK_API_KEY ? 'environment' : 'none',
      error: error instanceof Error ? error.message : 'Provider check failed.',
    };
  }

  return {
    provider: 'Ollama (Local)',
    modelName: DEFAULT_OLLAMA_MODEL,
    embeddingModelName: process.env.OLLAMA_EMBEDDING_MODEL,
    endpoint: DEFAULT_OLLAMA_ENDPOINT,
    ready: false,
    credentialSource: process.env.OLLAMA_API_KEY ? 'environment' : 'none',
    error: error instanceof Error ? error.message : 'Provider check failed.',
  };
}

export async function GET(request: NextRequest) {
  const requestedProvider = request.nextUrl.searchParams.get('provider')?.trim();
  const runtimeConfig: ChatRuntimeConfig = {
    provider:
      requestedProvider === 'ollama' ||
      requestedProvider === 'openrouter' ||
      requestedProvider === 'ai-sdk'
        ? requestedProvider
        : undefined,
  };
  const providerName = resolveProviderName(runtimeConfig);
  try {
    const provider = await createProvider(runtimeConfig);
    return NextResponse.json(
      getProviderInfo(provider, getCredentialSource(providerName, runtimeConfig))
    );
  } catch (error) {
    return NextResponse.json(
      getFallbackProviderInfo(providerName, error),
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message: string;
      history?: ChatMessage[];
      gameContext?: GameContextSnapshot;
      systemPrompt?: string;
      stream?: boolean;
      attachments?: ChatImageAttachment[];
      runtimeConfig?: ChatRuntimeConfig;
    };
    const provider = await createProvider(body.runtimeConfig);
    const providerName = resolveProviderName(body.runtimeConfig);

    if (!provider.isReady()) {
      return NextResponse.json(
        {
          error:
            providerName === 'openrouter'
              ? 'Chat provider not ready. Configure OPENROUTER_API_KEY or enter an OpenRouter API key in chat settings.'
              : providerName === 'ai-sdk'
                ? 'Chat provider not ready. Enter an AI SDK provider/model value like anthropic/claude-sonnet-4-5 and a matching provider API key.'
                : 'Chat provider not ready. Ensure Ollama is running at the configured endpoint.',
        },
        { status: 503 }
      );
    }

    const {
      message,
      history = [],
      gameContext,
      systemPrompt,
      stream = false,
      attachments = [],
      runtimeConfig,
    } = body;
    const providerInfo = getProviderInfo(
      provider,
      getCredentialSource(providerName, runtimeConfig)
    );

    // DEBUG: Log incoming request
    console.log('[API CHAT DEBUG] Incoming request');
    console.log('[API CHAT DEBUG] Message:', message);
    console.log('[API CHAT DEBUG] History length:', history.length);
    console.log('[API CHAT DEBUG] Provider:', providerName);
    console.log('[API CHAT DEBUG] Thinking override:', runtimeConfig?.thinking);
    console.log('[API CHAT DEBUG] Has gameContext:', !!gameContext);
    if (gameContext) {
      console.log('[API CHAT DEBUG] Context trainer:', gameContext.trainerName);
      console.log('[API CHAT DEBUG] Context location:', gameContext.location);
      console.log(
        '[API CHAT DEBUG] Context party count:',
        gameContext.partyPokemonDetailed?.length ?? gameContext.partyPokemon.length
      );
    } else {
      console.log('[API CHAT DEBUG] Context missing: reference and general guide tools remain available');
    }
    console.log('[API CHAT DEBUG] Streaming:', stream);
    console.log('[API CHAT DEBUG] ==================\n');

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }
    const allImageAttachments = [
      ...attachments,
      ...history.flatMap((chatMessage) => chatMessage.attachments ?? []),
    ];
    if (
      allImageAttachments.some(
        (attachment) =>
          attachment.kind !== 'image' ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(attachment.mediaType) ||
          attachment.data.length > 8_000_000
      ) ||
      allImageAttachments.reduce((total, attachment) => total + attachment.data.length, 0) >
        24_000_000
    ) {
      return NextResponse.json(
        { error: 'Invalid or oversized image attachment history.' },
        { status: 400 }
      );
    }

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      let controller: ReadableStreamDefaultController<Uint8Array>;
      let emittedChunk = false;

      const customStream = new ReadableStream({
        async start(ctrl) {
          controller = ctrl;

          try {
            controller.enqueue(
              encoder.encode(JSON.stringify({ meta: providerInfo }) + '\n')
            );
            const finalReply = await provider.sendMessage(
              message,
              history,
              gameContext,
              systemPrompt,
              (chunk: string) => {
                // Send each chunk as a line of JSON
                emittedChunk = true;
                controller.enqueue(
                  encoder.encode(JSON.stringify({ chunk }) + '\n')
                );
              },
              attachments,
              (thinking: string) => {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ thinking }) + '\n')
                );
              }
            );
            if (!emittedChunk && finalReply.trim()) {
              emittedChunk = true;
              controller.enqueue(
                encoder.encode(JSON.stringify({ chunk: finalReply }) + '\n')
              );
            }
            const knowledgeContext = provider.getLastKnowledgeContext();
            if (knowledgeContext) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ knowledgeContext }) + '\n')
              );
            }
            const sources = provider.getLastSources();
            if (sources.length > 0) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ sources }) + '\n')
              );
            }

            controller.close();
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'An unexpected error occurred';
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ error: `Chat failed: ${errorMessage}` }) + '\n'
              )
            );
            controller.close();
          }
        },
      });

      return new NextResponse(customStream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
        },
      });
    } else {
      // Non-streaming response
      const reply = await provider.sendMessage(
        message,
        history,
        gameContext,
        systemPrompt,
        undefined,
        attachments
      );

      return NextResponse.json(
        {
          reply,
          meta: providerInfo,
          knowledgeContext: provider.getLastKnowledgeContext(),
          sources: provider.getLastSources(),
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Chat API error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      { error: `Chat failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
