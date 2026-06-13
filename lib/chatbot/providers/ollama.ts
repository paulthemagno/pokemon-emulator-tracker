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
} from '../types';
import { SPECIES } from '../../pokemon/data/species';
import { MOVES } from '../../pokemon/data/moves';
import { MOVE_DESCRIPTIONS } from '../../pokemon/data/move-descriptions';
import { GENERATED_EVENT_GUIDES } from '../../pokemon/knowledge/event-guides';
import gameGuideSources from '../../pokemon/knowledge/sources/game-guide-sources.json';

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

type OllamaTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OllamaChatResponse = {
  message?: OllamaMessage;
};

export class OllamaProvider implements ChatProvider {
  name = 'Ollama (Local)';
  private endpoint: string = 'http://127.0.0.1:11434';
  private modelName: string = 'gemma4:latest';
  private maxTokens: number = 2048;
  private temperature: number = 0.7;
  private ready: boolean = false;
  private enableTools: boolean = true;
  private modelSupportsTools: boolean | null = null;
  private apiKey?: string;
  private thinking: boolean = true;

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

  getInfo() {
    return {
      provider: this.name,
      modelName: this.modelName,
      endpoint: this.endpoint,
      ready: this.ready,
    };
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
        content: msg.content,
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

    // DEBUG: Log the full prompt and request
    console.log('\n[OLLAMA DEBUG] ==========\n');
    console.log('[OLLAMA DEBUG] SYSTEM PROMPT (base):\n', fullSystemPrompt);
    console.log('\n[OLLAMA DEBUG] USER MESSAGE:\n', message);
    console.log('[OLLAMA DEBUG] CONVERSATION HISTORY LENGTH:', conversationHistory.length);
    console.log('[OLLAMA DEBUG] TOOLS ENABLED:', this.enableTools);
    console.log('[OLLAMA DEBUG] MODEL SUPPORTS TOOLS (cached):', this.modelSupportsTools);
    console.log('[OLLAMA DEBUG] ==========\n');

    try {
      const toolReply = await this.tryToolCalling(
        typedMessages,
        fullSystemPrompt,
        gameContext,
        onThinkingChunk
      );

      if (toolReply !== null) {
        if (onStreamChunk) {
          onStreamChunk(toolReply);
        }
        console.log('[OLLAMA DEBUG] RESPONSE (tool-calling):\n', toolReply);
        console.log('[OLLAMA DEBUG] ==========\n');
        return toolReply;
      }

      // Non-tool fallback keeps the richer state dump for models/tool paths that cannot use tools.
      const nonToolSystemPrompt = gameContext
        ? `${fullSystemPrompt}\n\n## Current Game State:\n${this.formatGameContext(gameContext)}`
        : fullSystemPrompt;

      console.log('[OLLAMA DEBUG] SYSTEM PROMPT (non-tool fallback):\n', nonToolSystemPrompt);

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
    onThinkingChunk?: (chunk: string) => void
  ): Promise<string | null> {
    if (!this.enableTools) {
      console.log('[OLLAMA DEBUG][TOOLS] Skipping tool-calling: disabled via OLLAMA_ENABLE_TOOLS');
      return null;
    }

    if (!gameContext) {
      console.log('[OLLAMA DEBUG][TOOLS] Skipping tool-calling: no game context available');
      return null;
    }

    if (this.modelSupportsTools === false) {
      console.log('[OLLAMA DEBUG][TOOLS] Skipping tool-calling: model previously marked unsupported');
      return null;
    }

    const tools = this.getToolDefinitions();
    const toolAwareSystemPrompt = `${fullSystemPrompt}\n\nTool policy: Use tools for exact values when needed.`;

    const workingMessages: OllamaMessage[] = [
      { role: 'system', content: toolAwareSystemPrompt },
      ...messages,
    ];

    console.log('[OLLAMA DEBUG][TOOLS] Attempting tool-calling with model:', this.modelName);
    console.log(
      '[OLLAMA DEBUG][TOOLS] Available tools:',
      tools.map((tool) => tool.function.name).join(', ')
    );

    for (let i = 0; i < 3; i += 1) {
      console.log(`[OLLAMA DEBUG][TOOLS] Round ${i + 1}/3`);
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.modelName,
          messages: workingMessages,
          stream: false,
          think: this.thinking,
          tools,
          options: {
            temperature: this.temperature,
            num_predict: this.maxTokens,
          },
        }),
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
        return assistantMessage.content || '';
      }

      this.modelSupportsTools = true;
      console.log('[OLLAMA DEBUG][TOOLS] Tool calls requested:', toolCalls.length);
      workingMessages.push(assistantMessage);

      for (const call of toolCalls) {
        const name = call.function?.name || '';
        const args = this.parseToolArguments(call.function?.arguments);
        const result = this.executeTool(name, args, gameContext);

        console.log(`[OLLAMA DEBUG][TOOLS] CALL ${name || '<empty-name>'}`);
        console.log('[OLLAMA DEBUG][TOOLS] args:', this.stringifyForDebug(args));
        console.log('[OLLAMA DEBUG][TOOLS] result:', this.stringifyForDebug(result));

        workingMessages.push({
          role: 'tool',
          tool_name: name,
          content: JSON.stringify(result),
        });
      }
    }

    console.log('[OLLAMA DEBUG][TOOLS] Max rounds reached, falling back to standard response flow');

    return null;
  }

  private stringifyForDebug(value: unknown): string {
    try {
      const text = JSON.stringify(value);
      if (!text) {
        return String(value);
      }
      return text.length > 2000 ? `${text.slice(0, 2000)}...[truncated]` : text;
    } catch {
      return String(value);
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  private normalizeForSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
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

  getToolDefinitions(): OllamaTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_move_reference',
          description: 'Look up source-backed local move data and generation-specific flavor/effect text.',
          parameters: {
            type: 'object',
            properties: {
              moveName: {
                type: 'string',
                description: 'Move name, for example Thunder Punch or Surf.',
              },
              game: {
                type: 'string',
                description: 'Optional game name used to select generation-specific text.',
              },
            },
            required: ['moveName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_game_guidance',
          description: 'Search local source-backed event guidance and return relevant walkthrough/code sources.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Story event, location, item, character, or objective to search for.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of matching guidance entries, from 1 to 8.',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_trainer_status',
          description: 'Get current trainer summary with location and progression.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_party_overview',
          description: 'Get current party Pokemon summary including hp, status and types.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_story_context',
          description: 'Get source-backed permanent choices, current story phases, and known next steps.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_pokemon_details',
          description: 'Get detailed info for one party Pokemon by name or 1-based index.',
          parameters: {
            type: 'object',
            properties: {
              pokemonName: { type: 'string', description: 'Pokemon nickname or species.' },
              partyIndex: { type: 'number', description: '1-based index in party order.' },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_pokedex_overview',
          description: 'Get Pokédex progress with seen/caught totals and completion percentage.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_pokedex_lookup',
          description: 'Look up whether a specific Pokémon has been seen or caught. Use the species name exactly as it appears in the game (e.g. "Bulbasaur", "Pikachu").',
          parameters: {
            type: 'object',
            properties: {
              pokemonName: {
                type: 'string',
                description: 'Species name exactly as it appears in the game (e.g. "Bulbasaur").',
              },
            },
            required: ['pokemonName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_inventory_overview',
          description: 'Get inventory summary and full item list (optionally filtered by name).',
          parameters: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Optional maximum items to return. If omitted, returns all matching items.',
              },
              query: {
                type: 'string',
                description:
                  'Optional filter. Write the item name exactly as it appears in Pokémon games (e.g. "Poké Ball", "Great Ball", "Rare Candy", "Escape Rope"). Matching is case-insensitive and ignores spaces/symbols.',
              },
            },
            required: [],
          },
        },
      },
    ];
  }

  executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: GameContextSnapshot
  ): Record<string, unknown> {
    switch (toolName) {
      case 'get_move_reference': {
        const moveName = typeof args.moveName === 'string' ? args.moveName.trim() : '';
        const normalizedName = this.normalizeForSearch(moveName);
        const move = MOVES.find(
          (candidate) => candidate.id > 0 && this.normalizeForSearch(candidate.name) === normalizedName
        );

        if (!move) {
          return { error: `Unknown move: "${moveName}".` };
        }

        const description = MOVE_DESCRIPTIONS[move.id];
        const requestedGame =
          typeof args.game === 'string' && args.game.trim()
            ? args.game
            : context.gameTitle || '';
        const versionGroup = this.getVersionGroup(requestedGame);

        return {
          name: move.name,
          type: move.type,
          power: move.power,
          accuracy: move.accuracy,
          pp: move.pp,
          effect: description?.shortEffect,
          flavorText:
            (versionGroup ? description?.flavorTexts[versionGroup] : undefined) ??
            description?.flavorText,
          appliesTo: versionGroup || 'generic Gen 1-3 data',
          source: description?.source === 'pokeapi'
            ? {
                kind: 'pokeapi',
                name: 'PokeAPI',
                url: `https://pokeapi.co/api/v2/move/${description.slug}`,
              }
            : {
                kind: 'local-fallback',
                name: 'Pokemon Emulator Tracker local move table',
              },
          limitation: 'This tool does not yet prove whether a specific Pokemon learns the move in this game.',
        };
      }

      case 'search_game_guidance': {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query) {
          return { error: 'query is required.' };
        }

        const profile = this.getGameProfile(context.gameTitle);
        if (!profile) {
          return {
            error: `No guide profile is mapped for ${context.gameTitle || 'the current game'}.`,
          };
        }

        const guides = GENERATED_EVENT_GUIDES[profile] ?? {};
        const tokens = query
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length > 2);
        const requestedLimit =
          typeof args.limit === 'number' ? args.limit : Number.parseInt(String(args.limit ?? '4'), 10);
        const limit = Number.isFinite(requestedLimit)
          ? Math.min(Math.max(requestedLimit, 1), 8)
          : 4;

        const matches = Object.entries(guides)
          .map(([key, guide]) => {
            const haystack = [
              key,
              guide.description,
              guide.location,
              ...(guide.steps ?? []),
              guide.completionMeaning,
              guide.notCompletedMeaning,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            const score = tokens.reduce(
              (total, token) => total + (haystack.includes(token) ? 1 : 0),
              0
            );
            return { key, guide, score };
          })
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(({ key, guide }) => ({
            event: key,
            description: guide.description,
            location: guide.location,
            steps: guide.steps,
            completionMeaning: guide.completionMeaning,
            notCompletedMeaning: guide.notCompletedMeaning,
            sourceRefs: guide.sourceRefs,
          }));

        const catalog = gameGuideSources.profiles[profile as keyof typeof gameGuideSources.profiles];
        return {
          game: catalog?.game ?? context.gameTitle,
          query,
          matches,
          generalGuideSources: catalog?.sources ?? [],
          caution:
            'Matches are retrieval hints, not proof that an event is currently available. Current availability requires audited prerequisites and save-state evidence.',
        };
      }

      case 'get_trainer_status':
        return {
          trainerName: context.trainerName,
          location: context.location,
          money: context.money,
          badges: context.badges,
          pokedexSeen: context.pokedexSeen,
          pokedexOwned: context.pokedexOwned,
          gameTitle: context.gameTitle,
          playtime: context.playtime,
        };

      case 'get_story_context':
        return {
          facts: context.progressFacts ?? [],
        };

      case 'get_party_overview':
        return {
          count: context.partyPokemonDetailed?.length ?? context.partyPokemon.length,
          party: (context.partyPokemonDetailed ?? []).map((p, index) => ({
            index: index + 1,
            name: p.name,
            species: p.species,
            level: p.level,
            hp: p.hp,
            maxHp: p.maxHp,
            types: p.types,
            status: p.status,
          })),
        };

      case 'get_pokedex_overview': {
        const seen = context.pokedexSeen;
        const owned = context.pokedexOwned;
        const completionSeen = seen > 0 ? Number(((owned / seen) * 100).toFixed(1)) : 0;

        return {
          gameTitle: context.gameTitle,
          seen,
          owned,
          completionVsSeenPercent: completionSeen,
        };
      }

      case 'get_pokemon_details': {
        const detailed = context.partyPokemonDetailed ?? [];
        const byName = typeof args.pokemonName === 'string' ? args.pokemonName.toLowerCase() : '';
        const index =
          typeof args.partyIndex === 'number'
            ? Math.floor(args.partyIndex) - 1
            : typeof args.partyIndex === 'string'
              ? Number.parseInt(args.partyIndex, 10) - 1
              : -1;

        const selected =
          (Number.isInteger(index) && index >= 0 && index < detailed.length
            ? detailed[index]
            : undefined) ||
          detailed.find(
            (p) => p.name.toLowerCase() === byName || p.species.toLowerCase() === byName
          );

        if (!selected) {
          return {
            error: 'Pokemon not found in current party.',
            available: detailed.map((p, idx) => ({ index: idx + 1, name: p.name, species: p.species })),
          };
        }

        return {
          name: selected.name,
          species: selected.species,
          level: selected.level,
          hp: selected.hp,
          maxHp: selected.maxHp,
          status: selected.status,
          types: selected.types,
          ability: selected.ability,
          nature: selected.nature,
          heldItem: selected.heldItem,
          moves: selected.moves,
        };
      }

      case 'get_inventory_overview': {
        const limitRaw = args.limit;
        const queryRaw = args.query;
        const parsedLimit =
          typeof limitRaw === 'number'
            ? limitRaw
            : typeof limitRaw === 'string'
              ? Number.parseInt(limitRaw, 10)
              : undefined;

        const query =
          typeof queryRaw === 'string' && queryRaw.trim().length > 0
            ? queryRaw.trim().toLowerCase()
            : '';

        const normalizedQuery = query ? this.normalizeForSearch(query) : '';

        const filteredItems = normalizedQuery
          ? context.inventory.filter((item) => {
              const normalizedItemName = this.normalizeForSearch(item.name);
              return normalizedItemName.includes(normalizedQuery);
            })
          : context.inventory;

        const sortedItems = [...filteredItems].sort((a, b) => {
          if (b.quantity !== a.quantity) {
            return b.quantity - a.quantity;
          }
          return a.name.localeCompare(b.name);
        });

        const safeLimit =
          typeof parsedLimit === 'number' && Number.isFinite(parsedLimit)
            ? Math.min(Math.max(parsedLimit, 1), Math.max(sortedItems.length, 1))
            : sortedItems.length;

        const totalItemCount = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
        const items = sortedItems.slice(0, safeLimit);

        return {
          query: query || null,
          totalUniqueItems: filteredItems.length,
          totalItemCount,
          returnedItems: items.length,
          items,
        };
      }

      case 'get_pokedex_lookup': {
        const nameRaw = typeof args.pokemonName === 'string' ? args.pokemonName.trim() : '';
        if (!nameRaw) {
          return { error: 'pokemonName is required.' };
        }
        const nameLower = nameRaw.toLowerCase();
        const species = SPECIES.find((s) => s.name.toLowerCase() === nameLower);
        if (!species || species.id === 0) {
          return { error: `Unknown species: "${nameRaw}". Use the species name exactly as it appears in the game.` };
        }
        const seen = context.pokedexSeenList.includes(species.id);
        const caught = context.pokedexCaughtList.includes(species.id);
        return {
          name: species.name,
          nationalDexId: species.id,
          seen,
          caught,
        };
      }

      default:
        return {
          error: `Unknown tool: ${toolName}`,
        };
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

  private getVersionGroup(game: string): string | undefined {
    const normalized = game.toLowerCase();
    if (normalized.includes('crystal')) return 'crystal';
    if (normalized.includes('gold') || normalized.includes('silver')) return 'gold-silver';
    if (normalized.includes('emerald')) return 'emerald';
    if (normalized.includes('ruby') || normalized.includes('sapphire')) return 'ruby-sapphire';
    if (normalized.includes('firered') || normalized.includes('leafgreen')) return 'firered-leafgreen';
    return undefined;
  }

  private getGameProfile(game?: string): keyof typeof GENERATED_EVENT_GUIDES | undefined {
    const normalized = (game ?? '').toLowerCase();
    if (normalized.includes('yellow')) return 'yellow-en';
    if (normalized.includes('red') || normalized.includes('blue')) return 'red-blue-en';
    if (normalized.includes('crystal')) return 'crystal-en';
    if (normalized.includes('gold') || normalized.includes('silver')) return 'gold-silver-en';
    if (normalized.includes('emerald')) return 'emerald-en';
    if (normalized.includes('ruby') || normalized.includes('sapphire')) return 'ruby-sapphire-en';
    if (normalized.includes('firered') || normalized.includes('leafgreen')) {
      return 'firered-leafgreen-en';
    }
    return undefined;
  }
}
