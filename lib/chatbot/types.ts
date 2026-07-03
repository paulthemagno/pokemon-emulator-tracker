/**
 * Chatbot type definitions and provider interfaces
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: ChatImageAttachment[];
  thinking?: string;
  knowledgeContext?: string;
  sources?: ChatSource[];
}

export interface ChatSource {
  kind: string;
  name: string;
  url?: string;
  scope?: string;
  displayName?: string;
  siteName?: string;
  icon?: string;
  logoUrl?: string;
}

export interface ChatImageAttachment {
  kind: 'image';
  name: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
}

export interface ChatRuntimeConfig {
  provider?: 'ollama' | 'openrouter' | 'ai-sdk';
  endpoint?: string;
  modelName?: string;
  embeddingModelName?: string;
  apiKey?: string;
  thinking?: boolean;
}

export interface ChatProviderInfo {
  provider: string;
  modelName: string;
  embeddingModelName?: string;
  endpoint: string;
  ready: boolean;
  credentialSource: 'request' | 'environment' | 'none';
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
  progressFacts?: Array<{
    label: string;
    value: string;
    description: string;
    nextStep?: string;
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
    onStreamChunk?: (chunk: string) => void,
    attachments?: ChatImageAttachment[],
    onThinkingChunk?: (chunk: string) => void
  ): Promise<string>;
  validateConfig(): Promise<boolean>;
  isReady(): boolean;
  getInfo(): Omit<ChatProviderInfo, 'credentialSource'>;
  getLastKnowledgeContext(): string | undefined;
  getLastSources(): ChatSource[];
}

export interface ProviderConfig {
  endpoint?: string;
  apiKey?: string;
  modelName?: string;
  embeddingModelName?: string;
  maxTokens?: number;
  temperature?: number;
  thinking?: boolean;
}

export interface OllamaConfig extends ProviderConfig {
  endpoint: string; // e.g., http://127.0.0.1:11434
  modelName: string; // e.g., 'gemma4:latest'
  embeddingModelName?: string; // e.g., 'embeddinggemma:latest'
}
