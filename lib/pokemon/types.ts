// Pokemon Types and Interfaces for Gen 1-3 Save File Parsing

export type Generation = 1 | 2 | 3;

export type GameVersion =
  // Gen 1
  | "red"
  | "blue"
  | "yellow"
  // Gen 2
  | "gold"
  | "silver"
  | "crystal"
  // Gen 3
  | "ruby"
  | "sapphire"
  | "emerald"
  | "firered"
  | "leafgreen";

export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  special?: number; // Gen 1 only
  specialAttack?: number; // Gen 2+
  specialDefense?: number; // Gen 2+
}

export interface Move {
  id: number;
  name: string;
  pp: number;
  maxPP: number;
  type?: string;
  power?: number | null;
  accuracy?: number | null;
}

export interface Pokemon {
  species: number;
  speciesName: string;
  types?: string[];
  nickname: string;
  level: number;
  currentHP: number;
  maxHP: number;
  experience: number;
  moves: Move[];
  stats: Stats;
  ivs?: Stats;
  evs?: Stats;
  originalTrainer: string;
  originalTrainerID: number;
  // Gen 2+
  heldItem?: number;
  heldItemName?: string;
  happiness?: number;
  // Gen 3+
  ability?: number;
  abilityName?: string;
  nature?: number;
  natureName?: string;
  isShiny?: boolean;
  isEgg?: boolean;
  form?: number;
  formName?: string;
  gender?: "male" | "female" | "unknown";
  // Status
  status?: StatusCondition;
  // Caught info
  metLocation?: string;
  metLevel?: number;
}

export type StatusCondition =
  | "none"
  | "sleep"
  | "poison"
  | "burn"
  | "freeze"
  | "paralysis"
  | "bad-poison";

export interface TrainerInfo {
  name: string;
  id: number;
  secretId?: number; // Gen 3+
  money: number;
  badges: boolean[];
  badgeCount: number;
  gender?: "male" | "female";
  playTime: PlayTime;
}

export interface PlayTime {
  hours: number;
  minutes: number;
  seconds?: number;
  frames?: number;
}

export interface LocationInfo {
  mapId: number;
  name: string;
  areaType?: "town" | "route" | "cave" | "building" | "unknown";
  mapGroup?: number;
  x?: number;
  y?: number;
}

export interface PCBox {
  name: string;
  pokemon: (Pokemon | null)[];
  capacity: number;
  isCurrent?: boolean;
  diagnostics?: {
    validSlots: number;
    emptySlots: number;
    noSpeciesSlots: number;
    checksumFailedSlots: number;
    invalidSpeciesSlots: number;
    shortSlots: number;
    sectionIds?: number[];
    sampleSlots?: Array<{
      slot: number;
      status: "valid" | "no-species" | "checksum" | "invalid-species" | "short";
      internalSpecies?: number;
      nationalSpecies?: number;
      personality?: number;
      storedChecksum?: number;
      computedChecksum?: number;
    }>;
  };
}

export interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  pocket?: string;
}

export interface InventorySection {
  name: string;
  items: InventoryItem[];
}

export interface SaveData {
  generation: Generation;
  game: GameVersion;
  trainer: TrainerInfo;
  pokedex?: {
    seenSpecies: number[];
    caughtSpecies: number[];
    seenCount: number;
    caughtCount: number;
    source?: "save" | "live";
    mode?: "regional" | "national";
    regionalDex?: "hoenn" | "kanto";
    dexMax?: number;
  };
  party: Pokemon[];
  pcBoxes: PCBox[];
  inventory: InventorySection[];
  location: LocationInfo;
  valid: boolean;
  checksum?: number;
  rawSize: number;
}

export interface ParseResult {
  success: boolean;
  data?: SaveData;
  error?: string;
  warnings?: string[];
}

// Pokemon type colors for UI
export const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#F7D02C",
  grass: "#7AC74C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
  "???": "#68A090",
};

// Nature stat modifiers (Gen 3+)
export const NATURES = [
  { name: "Hardy", plus: null, minus: null },
  { name: "Lonely", plus: "attack", minus: "defense" },
  { name: "Brave", plus: "attack", minus: "speed" },
  { name: "Adamant", plus: "attack", minus: "specialAttack" },
  { name: "Naughty", plus: "attack", minus: "specialDefense" },
  { name: "Bold", plus: "defense", minus: "attack" },
  { name: "Docile", plus: null, minus: null },
  { name: "Relaxed", plus: "defense", minus: "speed" },
  { name: "Impish", plus: "defense", minus: "specialAttack" },
  { name: "Lax", plus: "defense", minus: "specialDefense" },
  { name: "Timid", plus: "speed", minus: "attack" },
  { name: "Hasty", plus: "speed", minus: "defense" },
  { name: "Serious", plus: null, minus: null },
  { name: "Jolly", plus: "speed", minus: "specialAttack" },
  { name: "Naive", plus: "speed", minus: "specialDefense" },
  { name: "Modest", plus: "specialAttack", minus: "attack" },
  { name: "Mild", plus: "specialAttack", minus: "defense" },
  { name: "Quiet", plus: "specialAttack", minus: "speed" },
  { name: "Bashful", plus: null, minus: null },
  { name: "Rash", plus: "specialAttack", minus: "specialDefense" },
  { name: "Calm", plus: "specialDefense", minus: "attack" },
  { name: "Gentle", plus: "specialDefense", minus: "defense" },
  { name: "Sassy", plus: "specialDefense", minus: "speed" },
  { name: "Careful", plus: "specialDefense", minus: "specialAttack" },
  { name: "Quirky", plus: null, minus: null },
] as const;
