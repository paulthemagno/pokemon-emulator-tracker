import { NextRequest, NextResponse } from 'next/server';
import { OllamaProvider } from '@/lib/chatbot/providers/ollama';
import type {
  ChatImageAttachment,
  ChatMessage,
  ChatProviderInfo,
  ChatRuntimeConfig,
  GameContextSnapshot,
} from '@/lib/chatbot/types';

const DEFAULT_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gemma4:latest';

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

async function createProvider(runtimeConfig: ChatRuntimeConfig = {}) {
  const provider = new OllamaProvider();
  await provider.initialize({
    endpoint: validateEndpoint(
      runtimeConfig.endpoint || DEFAULT_ENDPOINT,
      Boolean(runtimeConfig.endpoint)
    ),
    modelName: runtimeConfig.modelName?.trim() || DEFAULT_MODEL,
    apiKey: runtimeConfig.apiKey?.trim() || process.env.OLLAMA_API_KEY,
    maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '2048'),
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
    thinking: runtimeConfig.thinking ?? process.env.OLLAMA_THINKING !== 'false',
  });
  return provider;
}

function getProviderInfo(
  provider: OllamaProvider,
  credentialSource: ChatProviderInfo['credentialSource']
): ChatProviderInfo {
  return {
    ...provider.getInfo(),
    credentialSource,
  };
}

export async function GET() {
  try {
    const provider = await createProvider();
    return NextResponse.json(
      getProviderInfo(provider, process.env.OLLAMA_API_KEY ? 'environment' : 'none')
    );
  } catch (error) {
    return NextResponse.json(
      {
        provider: 'Ollama (Local)',
        modelName: DEFAULT_MODEL,
        endpoint: DEFAULT_ENDPOINT,
        ready: false,
        credentialSource: process.env.OLLAMA_API_KEY ? 'environment' : 'none',
        error: error instanceof Error ? error.message : 'Provider check failed.',
      },
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

    if (!provider.isReady()) {
      return NextResponse.json(
        {
          error: 'Chatbot provider not ready. Ensure Ollama is running at the configured endpoint.',
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
      runtimeConfig?.apiKey?.trim()
        ? 'request'
        : process.env.OLLAMA_API_KEY
          ? 'environment'
          : 'none'
    );

    // DEBUG: Log incoming request
    console.log('[API CHAT DEBUG] Incoming request');
    console.log('[API CHAT DEBUG] Message:', message);
    console.log('[API CHAT DEBUG] History length:', history.length);
    console.log('[API CHAT DEBUG] Has gameContext:', !!gameContext);
    if (gameContext) {
      console.log('[API CHAT DEBUG] Context trainer:', gameContext.trainerName);
      console.log('[API CHAT DEBUG] Context location:', gameContext.location);
      console.log(
        '[API CHAT DEBUG] Context party count:',
        gameContext.partyPokemonDetailed?.length ?? gameContext.partyPokemon.length
      );
    } else {
      console.log('[API CHAT DEBUG] Context missing: load a save file or live data to enable tool calls');
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

      const customStream = new ReadableStream({
        async start(ctrl) {
          controller = ctrl;

          try {
            controller.enqueue(
              encoder.encode(JSON.stringify({ meta: providerInfo }) + '\n')
            );
            await provider.sendMessage(
              message,
              history,
              gameContext,
              systemPrompt,
              (chunk: string) => {
                // Send each chunk as a line of JSON
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

      return NextResponse.json({ reply, meta: providerInfo }, { status: 200 });
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
