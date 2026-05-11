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
} from '../types';

export class OllamaProvider implements ChatProvider {
  name = 'Ollama (Local)';
  private endpoint: string = 'http://127.0.0.1:11434';
  private modelName: string = 'mistral';
  private maxTokens: number = 2048;
  private temperature: number = 0.7;
  private ready: boolean = false;

  async initialize(config: ProviderConfig): Promise<void> {
    const ollamaConfig = config as OllamaConfig;
    if (ollamaConfig.endpoint) {
      this.endpoint = ollamaConfig.endpoint;
    }
    if (ollamaConfig.modelName) {
      this.modelName = ollamaConfig.modelName;
    }
    if (ollamaConfig.maxTokens) {
      this.maxTokens = ollamaConfig.maxTokens;
    }
    if (ollamaConfig.temperature !== undefined) {
      this.temperature = ollamaConfig.temperature;
    }

    // Test connection
    await this.validateConfig();
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.error('Ollama connection failed:', response.statusText);
        this.ready = false;
        return false;
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models || [];
      const modelExists = models.some((m) => m.name === this.modelName);

      if (!modelExists) {
        console.warn(
          `Model "${this.modelName}" not found on Ollama. Available:`,
          models.map((m) => m.name)
        );
        this.ready = false;
        return false;
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

  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[],
    gameContext?: GameContextSnapshot,
    systemPrompt?: string,
    onStreamChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!this.ready) {
      throw new Error('Ollama provider not initialized or not ready');
    }

    // Build system prompt with game context
    let fullSystemPrompt =
      systemPrompt ||
      'You are a helpful Pokémon expert assistant. Provide friendly, accurate advice about Pokémon games, strategy, and mechanics.';

    if (gameContext) {
      fullSystemPrompt += `\n\n## Current Game State:\n${this.formatGameContext(gameContext)}`;
    }

    // Build message history
    const messages = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // DEBUG: Log the full prompt and request
    console.log('\n[OLLAMA DEBUG] ==========\n');
    console.log('[OLLAMA DEBUG] SYSTEM PROMPT:\n', fullSystemPrompt);
    console.log('\n[OLLAMA DEBUG] USER MESSAGE:\n', message);
    console.log('[OLLAMA DEBUG] CONVERSATION HISTORY LENGTH:', conversationHistory.length);
    console.log('[OLLAMA DEBUG] ==========\n');

    try {
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            ...messages,
          ],
          stream: Boolean(onStreamChunk),
          options: {
            temperature: this.temperature,
            num_predict: this.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      if (!onStreamChunk) {
        // Non-streaming response
        const data = (await response.json()) as { message?: { content?: string } };
        const reply = data.message?.content || '';
        
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
            const data = JSON.parse(line) as { message?: { content?: string } };
            const content = data.message?.content || '';
            fullReply += content;
            onStreamChunk(content);
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

    return `## Game State

Game: ${context.gameTitle || 'Pokémon'}
Trainer: ${context.trainerName}
Location: ${context.location}
Money: ₽${context.money.toLocaleString()}
Playtime: ${playtime}
Badges: ${context.badges}
Pokédex: ${context.pokedexOwned}/${context.pokedexSeen}

## Party
${partyDetails || '(empty)'}`;
  }
}
