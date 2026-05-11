/**
 * Chatbot type definitions and provider interfaces
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationState {
  messages: ChatMessage[];
  gameContext?: GameContextSnapshot;
  modelName?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Game context packed from live or save data for LLM conversation
 */
export interface GameContextSnapshot {
  trainerName: string;
  location: string;
  money: number;
  playtime: {
    hours: number;
    minutes: number;
    seconds: number;
  };
  badges: number;
  partyPokemon: Array<{
    name: string;
    level: number;
    hp: number;
    maxHp: number;
  }>;
  partyPokemonDetailed?: Array<{
    name: string;
    species: string;
    level: number;
    hp: number;
    maxHp: number;
    types: string[];
    status: string;
    ability?: string;
    nature?: string;
    heldItem?: string;
    moves: Array<{
      name: string;
      type: string;
      category?: string;
      power?: number;
      accuracy?: number;
      pp: number;
      maxPp: number;
    }>;
  }>;
  pokedexSeen: number;
  pokedexOwned: number;
  pokedexSeenList: number[];
  pokedexCaughtList: number[];
  inventory: Array<{
    name: string;
    quantity: number;
  }>;
  screenshot?: string; // base64 encoded PNG
  timestamp: number;
  gameTitle?: string;
  battleActive?: boolean;
}

/**
 * Provider interface for LLM integration
 */
export interface ChatProvider {
  name: string;
  initialize(config: ProviderConfig): Promise<void>;
  sendMessage(
    message: string,
    conversationHistory: ChatMessage[],
    gameContext?: GameContextSnapshot,
    systemPrompt?: string,
    onStreamChunk?: (chunk: string) => void
  ): Promise<string>;
  validateConfig(): Promise<boolean>;
  isReady(): boolean;
}

export interface ProviderConfig {
  endpoint?: string;
  apiKey?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OllamaConfig extends ProviderConfig {
  endpoint: string; // e.g., http://127.0.0.1:11434
  modelName: string; // e.g., 'mistral'
}
