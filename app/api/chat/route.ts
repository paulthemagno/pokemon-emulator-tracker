import { NextRequest, NextResponse } from 'next/server';
import { OllamaProvider } from '@/lib/chatbot/providers/ollama';
import type { ChatMessage, GameContextSnapshot } from '@/lib/chatbot/types';

const provider = new OllamaProvider();

// Initialize provider on first request
let initialized = false;

async function initializeProvider() {
  if (!initialized) {
    try {
      await provider.initialize({
        endpoint: process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434',
        modelName: process.env.OLLAMA_MODEL || 'mistral',
        maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '2048'),
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
      });
      initialized = provider.isReady();
    } catch (error) {
      console.error('Failed to initialize Ollama provider:', error);
      initialized = false;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeProvider();

    if (!provider.isReady()) {
      return NextResponse.json(
        {
          error: 'Chatbot provider not ready. Ensure Ollama is running at the configured endpoint.',
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      message: string;
      history?: ChatMessage[];
      gameContext?: GameContextSnapshot;
      systemPrompt?: string;
      stream?: boolean;
    };

    const { message, history = [], gameContext, systemPrompt, stream = false } = body;

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

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      let controller: ReadableStreamDefaultController<Uint8Array>;

      const customStream = new ReadableStream({
        async start(ctrl) {
          controller = ctrl;

          try {
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
        systemPrompt
      );

      return NextResponse.json({ reply }, { status: 200 });
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
