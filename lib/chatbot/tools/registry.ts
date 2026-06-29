import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { GameContextSnapshot } from "../types";
import { ITEM_DESCRIPTIONS } from "../../pokemon/data/item-descriptions";
import { MOVE_DESCRIPTIONS } from "../../pokemon/data/move-descriptions";
import { MOVES } from "../../pokemon/data/moves";
import { GEN1_ITEMS, GEN2_ITEMS, GEN3_ITEMS } from "../../pokemon/data/items";
import { POKEMON_EVOLUTIONS } from "../../pokemon/data/pokemon-evolutions";
import { getSpeciesById, SPECIES } from "../../pokemon/data/species";
import { GENERATED_EVENT_GUIDES } from "../../pokemon/knowledge/event-guides";
import { EVENT_GUIDANCE_BY_PROFILE } from "../../pokemon/data/event-guidance";
import gameGuideSources from "../../pokemon/knowledge/sources/game-guide-sources.json";
import walkthroughIndex from "../../pokemon/knowledge/walkthrough-index.json";

export type ChatToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "AMBIGUOUS_GAME"
  | "UNSUPPORTED_GAME";

export type KnowledgeToolResult<TData extends Record<string, unknown> = Record<string, unknown>> =
  | {
      ok: true;
      tool: string;
      gameProfile?: string;
      data: TData;
      sources: ToolSource[];
      limitations: string[];
      confidence: "source-backed" | "cross-checked";
    }
  | {
      ok: false;
      tool: string;
      sources: [];
      limitations: [];
      confidence: "unresolved";
      error: string;
      errorDetail: {
        code: ToolErrorCode;
        message: string;
      };
    };

export type ToolExecutionResult = KnowledgeToolResult;

export type ToolSource = {
  kind: "save-state" | "pret" | "pokeapi" | "local-fallback" | "walkthrough";
  name: string;
  url?: string;
  scope?: string;
};

const toolSourceSchema = z.object({
  kind: z.enum(["save-state", "pret", "pokeapi", "local-fallback", "walkthrough"]),
  name: z.string(),
  url: z.string().optional(),
  scope: z.string().optional(),
}).passthrough();

const successfulToolResultSchema = z.object({
  ok: z.literal(true),
  tool: z.string(),
  gameProfile: z.string().optional(),
  data: z.record(z.unknown()),
  sources: z.array(toolSourceSchema),
  limitations: z.array(z.string()),
  confidence: z.enum(["source-backed", "cross-checked"]),
});

const failedToolResultSchema = z.object({
  ok: z.literal(false),
  tool: z.string(),
  sources: z.tuple([]),
  limitations: z.tuple([]),
  confidence: z.literal("unresolved"),
  error: z.string(),
  errorDetail: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const toolResultSchema = z.discriminatedUnion("ok", [
  successfulToolResultSchema,
  failedToolResultSchema,
]);

const nullableStringSchema = z.string().nullable();
const speciesRefSchema = z.object({
  id: z.number(),
  name: z.string(),
});
const namedReferenceSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
}).passthrough();
const answerPolicySchema = z.string();

const moveToolDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  power: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  pp: z.number(),
  effect: z.string().optional(),
  flavorText: z.string().optional(),
  appliesTo: z.string(),
}).passthrough();

const speciesToolDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  introducedGeneration: z.number(),
  types: z.array(z.string()),
  growthRate: z.string(),
  baseStats: z.record(z.unknown()),
}).passthrough();

const typeMatchupToolDataSchema = z.object({
  generation: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  attackingType: z.string(),
  move: z.string().optional(),
  defenderSpecies: z.string().optional(),
  defenderTypes: z.array(z.string()),
  factors: z.array(z.number()),
  multiplier: z.number(),
  effectiveness: z.enum(["immune", "super-effective", "not-very-effective", "neutral"]),
}).passthrough();

const evolutionToolDataSchema = z.object({
  species: speciesRefSchema,
  direction: z.enum(["from", "to", "both"]),
  evolvesFrom: z.array(z.unknown()),
  evolvesTo: z.array(z.unknown()),
}).passthrough();

const learnsetEntrySchema = z.object({
  moveId: z.number(),
  move: z.string(),
  method: z.string(),
  level: z.number().optional(),
}).passthrough();

const learnsetToolDataSchema = z.object({
  species: speciesRefSchema,
  game: z.string(),
  methods: z.array(z.string()),
  requestedMove: namedReferenceSchema.optional(),
  learnsMove: z.boolean().optional(),
  levelMax: z.number().optional(),
  totalMatches: z.number(),
  returnedMatches: z.number(),
  entries: z.array(learnsetEntrySchema),
}).passthrough();

const encounterLocationSummarySchema = z.object({
  location: z.string(),
  locationArea: z.string(),
  methods: z.array(z.string()),
  levelRanges: z.array(z.string()),
  bestChance: z.number(),
  species: z.array(z.string()).optional(),
}).passthrough();

const encounterEntrySchema = z.object({
  speciesId: z.number(),
  species: z.string(),
  locationAreaId: z.number(),
  location: z.string(),
  locationArea: z.string(),
  method: z.string(),
  minLevel: z.number(),
  maxLevel: z.number(),
  chance: z.number(),
  conditions: z.array(z.string()),
}).passthrough();

const encountersToolDataSchema = z.object({
  summary: z.string(),
  game: z.string(),
  requestedSpecies: speciesRefSchema.nullable(),
  requestedLocation: nullableStringSchema,
  requestedMethod: nullableStringSchema,
  requestedTimeOfDay: nullableStringSchema,
  totalMatches: z.number(),
  returnedMatches: z.number(),
  locationSummaries: z.array(encounterLocationSummarySchema),
  entries: z.array(encounterEntrySchema),
  answerPolicy: answerPolicySchema,
}).passthrough();

const itemEntrySchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  pocket: z.string().optional(),
  slug: z.string().optional(),
  profiles: z.array(z.string()),
  flavorText: z.string().optional(),
  effect: z.string().optional(),
  source: z.string(),
}).passthrough();

const itemToolDataSchema = z.object({
  query: z.unknown(),
  game: nullableStringSchema,
  totalMatches: z.number(),
  returnedMatches: z.number(),
  entries: z.array(itemEntrySchema),
}).passthrough();

const guidanceMatchSchema = z.object({
  retrieval: z.object({
    matchedTerms: z.array(z.string()).optional(),
    matchedPhrases: z.array(z.string()).optional(),
    coverage: z.number().optional(),
    embeddingScore: z.number().optional(),
    embeddingModel: z.string().optional(),
  }).passthrough().optional(),
  knowledgeProfile: z.string(),
  game: z.string(),
  event: z.string(),
  description: z.string().optional(),
  actionHint: z.string().optional(),
  location: z.string().optional(),
  steps: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  normalMissingReason: z.string().optional(),
  completionMeaning: z.string().optional(),
  notCompletedMeaning: z.string().optional(),
  sourceRefs: z.array(z.string()),
  audited: z.boolean(),
  walkthrough: z.object({
    source: z.string(),
    part: z.number(),
    section: z.string(),
    parentSection: z.string().optional(),
    revision: z.union([z.string(), z.number()]).optional(),
  }).passthrough().optional(),
}).passthrough();

const itemLocationToolDataSchema = z.object({
  item: z.string(),
  aliases: z.array(z.string()).optional(),
  game: z.string(),
  obtainedOnly: z.boolean().optional(),
  inventoryMatches: z.array(z.unknown()),
  matches: z.array(z.object({
    retrieval: z.object({
      matchedTerms: z.array(z.string()).optional(),
      matchedPhrases: z.array(z.string()).optional(),
      coverage: z.number().optional(),
    }).passthrough().optional(),
    game: z.string(),
    location: z.string(),
    description: z.string(),
    sourceRefs: z.array(z.string()),
    walkthrough: z.object({
      source: z.string(),
      part: z.number(),
      section: z.string(),
      parentSection: z.string().optional(),
      revision: z.union([z.string(), z.number()]).optional(),
    }).passthrough(),
  }).passthrough()),
  answerPolicy: answerPolicySchema,
}).passthrough();

const gameGuidanceToolDataSchema = z.object({
  query: z.string(),
  canonicalQuery: z.string(),
  keywords: z.array(z.string()),
  requestedGame: nullableStringSchema,
  game: nullableStringSchema,
  matchedProfiles: z.array(z.string()),
  matches: z.array(guidanceMatchSchema),
  generalGuideSources: z.array(z.unknown()),
  retrievalMode: z.enum(["lexical", "hybrid-lexical-vector"]),
  embeddingModel: nullableStringSchema,
  answerPolicy: answerPolicySchema,
}).passthrough();

const trainerStatusToolDataSchema = z.object({
  trainerName: z.string().optional(),
  location: z.string().optional(),
  money: z.number().optional(),
  badges: z.array(z.unknown()).optional(),
  pokedexSeen: z.number().optional(),
  pokedexOwned: z.number().optional(),
  gameTitle: z.string().optional(),
  playtime: z.unknown().optional(),
}).passthrough();

const partyOverviewToolDataSchema = z.object({
  count: z.number(),
  party: z.array(z.object({
    index: z.number(),
    name: z.string(),
    species: z.string().optional(),
    level: z.number().optional(),
    hp: z.number().optional(),
    maxHp: z.number().optional(),
    types: z.array(z.string()).optional(),
    status: z.string().optional(),
  }).passthrough()),
}).passthrough();

const storyContextToolDataSchema = z.object({
  facts: z.array(z.unknown()),
}).passthrough();

const pokedexOverviewToolDataSchema = z.object({
  gameTitle: z.string().optional(),
  seen: z.number(),
  owned: z.number(),
  completionVsSeenPercent: z.number(),
}).passthrough();

const pokemonDetailsToolDataSchema = z.object({
  name: z.string(),
  species: z.string().optional(),
  level: z.number().optional(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  status: z.string().optional(),
  types: z.array(z.string()).optional(),
  ability: z.string().optional(),
  nature: z.string().optional(),
  heldItem: z.string().optional(),
  moves: z.array(z.unknown()).optional(),
}).passthrough();

const inventoryOverviewToolDataSchema = z.object({
  query: nullableStringSchema,
  totalUniqueItems: z.number(),
  totalItemCount: z.number(),
  returnedItems: z.number(),
  items: z.array(z.unknown()),
}).passthrough();

const pokedexLookupToolDataSchema = z.object({
  name: z.string(),
  nationalDexId: z.number(),
  seen: z.boolean(),
  caught: z.boolean(),
}).passthrough();

const toolDataSchemas: Record<string, z.ZodTypeAny> = {
  get_move: moveToolDataSchema,
  get_move_reference: moveToolDataSchema,
  get_species: speciesToolDataSchema,
  get_type_matchup: typeMatchupToolDataSchema,
  get_evolution: evolutionToolDataSchema,
  get_learnset: learnsetToolDataSchema,
  get_encounters: encountersToolDataSchema,
  get_item: itemToolDataSchema,
  get_item_location: itemLocationToolDataSchema,
  search_game_guidance: gameGuidanceToolDataSchema,
  get_trainer_status: trainerStatusToolDataSchema,
  get_party_overview: partyOverviewToolDataSchema,
  get_story_context: storyContextToolDataSchema,
  get_pokedex_overview: pokedexOverviewToolDataSchema,
  get_pokemon_details: pokemonDetailsToolDataSchema,
  get_inventory_overview: inventoryOverviewToolDataSchema,
  get_pokedex_lookup: pokedexLookupToolDataSchema,
};

export type MoveToolData = z.infer<typeof moveToolDataSchema>;
export type SpeciesToolData = z.infer<typeof speciesToolDataSchema>;
export type TypeMatchupToolData = z.infer<typeof typeMatchupToolDataSchema>;
export type EvolutionToolData = z.infer<typeof evolutionToolDataSchema>;
export type LearnsetToolData = z.infer<typeof learnsetToolDataSchema>;
export type EncountersToolData = z.infer<typeof encountersToolDataSchema>;
export type ItemToolData = z.infer<typeof itemToolDataSchema>;
export type ItemLocationToolData = z.infer<typeof itemLocationToolDataSchema>;
export type GameGuidanceToolData = z.infer<typeof gameGuidanceToolDataSchema>;
export type TrainerStatusToolData = z.infer<typeof trainerStatusToolDataSchema>;
export type PartyOverviewToolData = z.infer<typeof partyOverviewToolDataSchema>;
export type StoryContextToolData = z.infer<typeof storyContextToolDataSchema>;
export type PokedexOverviewToolData = z.infer<typeof pokedexOverviewToolDataSchema>;
export type PokemonDetailsToolData = z.infer<typeof pokemonDetailsToolDataSchema>;
export type InventoryOverviewToolData = z.infer<typeof inventoryOverviewToolDataSchema>;
export type PokedexLookupToolData = z.infer<typeof pokedexLookupToolDataSchema>;

type ItemReference = {
  id?: number;
  name: string;
  pocket?: string;
  slug?: string;
  profiles: GameProfile[];
};

type GameProfile =
  | "red-blue"
  | "yellow"
  | "gold-silver"
  | "crystal"
  | "ruby-sapphire"
  | "emerald"
  | "firered-leafgreen";

type KnowledgeProfile =
  | "red-blue-en"
  | "yellow-en"
  | "gold-silver-en"
  | "crystal-en"
  | "ruby-sapphire-en"
  | "emerald-en"
  | "firered-leafgreen-en";

type TypeChart = Record<string, Record<string, number>>;

type PokemonLearnsetEntry = readonly [
  speciesId: number,
  moveId: number,
  versionGroup: string,
  method: string,
  level: number,
];

type PokemonEncounterEntry = readonly [
  speciesId: number,
  gameProfile: string,
  locationAreaId: number,
  locationArea: string,
  method: string,
  minLevel: number,
  maxLevel: number,
  chance: number,
  conditions: string,
];

let pokemonLearnsets: readonly PokemonLearnsetEntry[] | null = null;
let pokemonEncounters: readonly PokemonEncounterEntry[] | null = null;

function readGeneratedRows<T extends readonly unknown[]>(filename: string): readonly T[] {
  const startedAt = Date.now();
  const filePath = path.join(process.cwd(), "lib/pokemon/data", filename);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { rows?: T[] };
  const rows = parsed.rows ?? [];
  console.log(
    `[CHATBOT TOOLS] Loaded ${filename}: rows=${rows.length} in ${Date.now() - startedAt}ms`
  );
  return rows;
}

function getPokemonLearnsets(): readonly PokemonLearnsetEntry[] {
  pokemonLearnsets ??= readGeneratedRows<PokemonLearnsetEntry>("pokemon-learnsets.json");
  return pokemonLearnsets;
}

function getPokemonEncounters(): readonly PokemonEncounterEntry[] {
  pokemonEncounters ??= readGeneratedRows<PokemonEncounterEntry>("pokemon-encounters.json");
  return pokemonEncounters;
}

const GAME_PROFILE_INFO: Record<
  GameProfile,
  { generation: 1 | 2 | 3; knowledgeProfile: KnowledgeProfile }
> = {
  "red-blue": { generation: 1, knowledgeProfile: "red-blue-en" },
  yellow: { generation: 1, knowledgeProfile: "yellow-en" },
  "gold-silver": { generation: 2, knowledgeProfile: "gold-silver-en" },
  crystal: { generation: 2, knowledgeProfile: "crystal-en" },
  "ruby-sapphire": { generation: 3, knowledgeProfile: "ruby-sapphire-en" },
  emerald: { generation: 3, knowledgeProfile: "emerald-en" },
  "firered-leafgreen": { generation: 3, knowledgeProfile: "firered-leafgreen-en" },
};

const TYPE_CHART_GEN2_3: TypeChart = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  dragon: { dragon: 2, steel: 0.5 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5 },
};

const TYPE_CHART_GEN1: TypeChart = {
  normal: { rock: 0.5, ghost: 0 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5 },
  ice: { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, bug: 2, rock: 0.5, ghost: 0.5 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 2, flying: 0.5, psychic: 2, ghost: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2 },
  ghost: { normal: 0, psychic: 0, ghost: 2 },
  dragon: { dragon: 2 },
};

const GEN1_SPECIES_TYPE_OVERRIDES: Record<number, string[]> = {
  81: ["electric"],
  82: ["electric"],
};

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[^a-z0-9]/g, "");
}

function tokenizeForSearch(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/♀/g, " f ")
    .replace(/♂/g, " m ")
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

type GuidanceQueryTerm = {
  term: string;
  weight: number;
  source: "query" | "canonical" | "keyword";
};

type SearchableFields = {
  title: string;
  parent?: string;
  topics?: string;
  body?: string;
  url?: string;
};

type GuidanceRetrievalPlan = {
  terms: GuidanceQueryTerm[];
  phrases: string[];
  normalizedCanonicalQuery: string;
};

type WalkthroughEmbeddingRecord = {
  index: number;
  id: string;
  profiles?: string[];
  games?: string[];
};

type WalkthroughEmbeddingManifest = {
  model: string;
  dimensions: number;
  vectorFile: string;
  records: WalkthroughEmbeddingRecord[];
};

type WalkthroughEmbeddings = {
  manifest: WalkthroughEmbeddingManifest;
  vectors: Buffer;
  recordById: Map<string, WalkthroughEmbeddingRecord>;
};

const WALKTHROUGH_DOCUMENT_FREQUENCY = buildWalkthroughDocumentFrequency();
const WALKTHROUGH_EMBEDDINGS = loadWalkthroughEmbeddings();

function buildWalkthroughDocumentFrequency() {
  const frequency = new Map<string, number>();
  for (const chunk of walkthroughIndex.chunks) {
    const tokens = new Set(
      tokenizeForSearch(
        [
          chunk.rootTitle,
          chunk.section,
          chunk.parentSection,
          chunk.partTopics.join(" "),
          chunk.text,
          chunk.url,
        ]
          .filter(Boolean)
          .join(" ")
      )
    );
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return frequency;
}

function getGuidanceTermCorpusWeight(token: string): number {
  const documentCount = Math.max(walkthroughIndex.chunks.length, 1);
  const documentFrequency = WALKTHROUGH_DOCUMENT_FREQUENCY.get(token) ?? 0;
  if (documentFrequency === 0) return 1;
  const ratio = documentFrequency / documentCount;
  if (ratio > 0.25) return 0.2;
  if (ratio > 0.1) return 0.35;
  if (ratio > 0.04) return 0.55;
  return 1;
}

function loadWalkthroughEmbeddings(): WalkthroughEmbeddings | null {
  try {
    const knowledgeDir = path.join(process.cwd(), "lib/pokemon/knowledge");
    const manifestPath = path.join(knowledgeDir, "walkthrough-embeddings.manifest.json");
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8")
    ) as WalkthroughEmbeddingManifest;
    const vectorPath = path.join(knowledgeDir, manifest.vectorFile);
    const vectors = fs.readFileSync(vectorPath);
    const expectedBytes = manifest.records.length * manifest.dimensions * 4;
    if (vectors.length !== expectedBytes) {
      console.warn(
        `[CHATBOT TOOLS] Ignoring walkthrough embeddings: expected ${expectedBytes} bytes, got ${vectors.length}.`
      );
      return null;
    }
    return {
      manifest,
      vectors,
      recordById: new Map(manifest.records.map((record) => [record.id, record])),
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      console.warn("[CHATBOT TOOLS] Failed to load walkthrough embeddings:", error);
    }
    return null;
  }
}

function normalizeOllamaModelName(value: string): string {
  return value.endsWith(":latest") ? value.slice(0, -":latest".length) : value;
}

function sameOllamaModelName(left: string, right: string): boolean {
  return normalizeOllamaModelName(left) === normalizeOllamaModelName(right);
}

function isWeakGuidanceTerm(token: string): boolean {
  return token.length < 3;
}

function setGuidanceTerm(
  terms: Map<string, GuidanceQueryTerm>,
  source: GuidanceQueryTerm["source"],
  token: string,
  excludedTerms: Set<string>
) {
  const sourceWeight = source === "keyword" ? 3 : source === "canonical" ? 2 : 1;
  if (isWeakGuidanceTerm(token) || excludedTerms.has(token)) return;
  const weight = sourceWeight * getGuidanceTermCorpusWeight(token);
  const previous = terms.get(token);
  if (!previous || previous.weight < weight) {
    terms.set(token, { term: token, weight, source });
  }
}

function addGuidanceTerms(
  terms: Map<string, GuidanceQueryTerm>,
  source: GuidanceQueryTerm["source"],
  value: string,
  excludedTerms: Set<string>
) {
  for (const token of tokenizeForSearch(value)) {
    setGuidanceTerm(terms, source, token, excludedTerms);
  }
}

function normalizePhrase(value: string, excludedTerms = new Set<string>()): string {
  return tokenizeForSearch(value)
    .filter((token) => !excludedTerms.has(token))
    .join(" ");
}

function getGuidanceRetrievalPlan(
  query: string,
  canonicalQuery: string,
  keywords: string[],
  excludedTerms = new Set<string>()
): GuidanceRetrievalPlan {
  const terms = new Map<string, GuidanceQueryTerm>();
  addGuidanceTerms(terms, "query", query, excludedTerms);
  addGuidanceTerms(terms, "canonical", canonicalQuery, excludedTerms);
  for (const keyword of keywords) {
    addGuidanceTerms(terms, "keyword", keyword, excludedTerms);
  }

  const phraseInputs = [
    canonicalQuery,
    ...keywords,
    ...keywords.flatMap((keyword, index) =>
      keywords[index + 1] ? [`${keyword} ${keywords[index + 1]}`] : []
    ),
  ];
  const phrases = [
    ...new Set(
      phraseInputs
        .map((phrase) => normalizePhrase(phrase, excludedTerms))
        .filter((phrase) => phrase.length > 3 && phrase.includes(" "))
    ),
  ];

  return {
    terms: [...terms.values()],
    phrases,
    normalizedCanonicalQuery: normalizePhrase(canonicalQuery, excludedTerms),
  };
}

function scoreSearchableFields(
  fields: SearchableFields,
  plan: GuidanceRetrievalPlan,
  weights: {
    title: number;
    parent: number;
    topics: number;
    body: number;
    url: number;
    phrase: number;
    exact: number;
  }
) {
  const tokenFields = {
    title: new Set(tokenizeForSearch(fields.title)),
    parent: new Set(tokenizeForSearch(fields.parent ?? "")),
    topics: new Set(tokenizeForSearch(fields.topics ?? "")),
    body: new Set(tokenizeForSearch(fields.body ?? "")),
    url: new Set(tokenizeForSearch(fields.url ?? "")),
  };
  const phraseFields = {
    title: normalizePhrase(fields.title),
    parent: normalizePhrase(fields.parent ?? ""),
    topics: normalizePhrase(fields.topics ?? ""),
    body: normalizePhrase(fields.body ?? ""),
    url: normalizePhrase(fields.url ?? ""),
  };

  let score = 0;
  const matchedTerms: string[] = [];
  for (const queryTerm of plan.terms) {
    let termScore = 0;
    if (tokenFields.title.has(queryTerm.term)) termScore += weights.title;
    if (tokenFields.parent.has(queryTerm.term)) termScore += weights.parent;
    if (tokenFields.topics.has(queryTerm.term)) termScore += weights.topics;
    if (tokenFields.body.has(queryTerm.term)) termScore += weights.body;
    if (tokenFields.url.has(queryTerm.term)) termScore += weights.url;
    if (termScore > 0) {
      matchedTerms.push(queryTerm.term);
      score += termScore * queryTerm.weight;
    }
  }

  const matchedPhrases = plan.phrases.filter((phrase) => {
    if (phraseFields.title.includes(phrase)) {
      score += weights.phrase;
      return true;
    }
    if (phraseFields.parent.includes(phrase)) {
      score += weights.phrase * 0.7;
      return true;
    }
    if (phraseFields.body.includes(phrase) || phraseFields.url.includes(phrase)) {
      score += weights.phrase * 0.45;
      return true;
    }
    return false;
  });

  const canonical = plan.normalizedCanonicalQuery;
  if (
    canonical.length > 3 &&
    (phraseFields.title.includes(canonical) ||
      phraseFields.parent.includes(canonical) ||
      phraseFields.url.includes(canonical))
  ) {
    score += weights.exact;
  }

  const coverage =
    plan.terms.length > 0
      ? new Set(matchedTerms).size / plan.terms.length
      : matchedPhrases.length > 0
        ? 1
        : 0;

  return {
    score,
    matchedTerms: [...new Set(matchedTerms)],
    matchedPhrases,
    coverage,
  };
}

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

function parseQueryEmbedding(value: unknown, dimensions: number): number[] | null {
  if (!Array.isArray(value) || value.length < dimensions) return null;
  const vector = value
    .slice(0, dimensions)
    .map((entry) => (typeof entry === "number" && Number.isFinite(entry) ? entry : 0));
  return normalizeVector(vector);
}

function scoreWalkthroughEmbedding(
  queryVector: number[] | null,
  record: WalkthroughEmbeddingRecord | undefined
): number | undefined {
  if (!queryVector || !record || !WALKTHROUGH_EMBEDDINGS) return undefined;
  const dimensions = WALKTHROUGH_EMBEDDINGS.manifest.dimensions;
  let score = 0;
  const offset = record.index * dimensions;
  for (let index = 0; index < dimensions; index += 1) {
    score += queryVector[index] * WALKTHROUGH_EMBEDDINGS.vectors.readFloatLE((offset + index) * 4);
  }
  return score;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function findSpecies(value: unknown) {
  const numericId = parseNumber(value);
  if (numericId !== undefined) {
    const species = getSpeciesById(Math.floor(numericId));
    return species.id > 0 ? species : undefined;
  }

  const name = typeof value === "string" ? normalizeForSearch(value) : "";
  if (!name) return undefined;
  const species = SPECIES.find(
    (candidate) => candidate.id > 0 && normalizeForSearch(candidate.name) === name
  );
  return species ? getSpeciesById(species.id) : undefined;
}

function findMove(value: unknown) {
  const numericId = parseNumber(value);
  if (numericId !== undefined) {
    const move = MOVES[Math.floor(numericId)];
    return move?.id > 0 ? move : undefined;
  }

  const name = typeof value === "string" ? normalizeForSearch(value) : "";
  if (!name) return undefined;
  return MOVES.find(
    (candidate) => candidate.id > 0 && normalizeForSearch(candidate.name) === name
  );
}

function getItemDescriptionForName(name: string) {
  const normalized = normalizeForSearch(name);
  return Object.values(ITEM_DESCRIPTIONS).find((description) =>
    [description.slug, ...description.names].some(
      (candidate) => normalizeForSearch(candidate) === normalized
    )
  );
}

function getItemDescriptionForReference(reference: ItemReference) {
  if (reference.slug) return ITEM_DESCRIPTIONS[reference.slug];
  return getItemDescriptionForName(reference.name);
}

function getItemReferences(value: unknown, profile?: GameProfile): ItemReference[] {
  const numericId = parseNumber(value);
  const normalized = typeof value === "string" ? normalizeForSearch(value) : "";
  const references: ItemReference[] = [];

  const addReference = (reference: ItemReference) => {
    if (profile && !reference.profiles.includes(profile)) return;
    const duplicate = references.some(
      (candidate) =>
        candidate.id === reference.id &&
        candidate.name === reference.name &&
        candidate.profiles.join(",") === reference.profiles.join(",")
    );
    if (!duplicate) references.push(reference);
  };

  for (const [idText, name] of Object.entries(GEN1_ITEMS)) {
    const id = Number(idText);
    addReference({ id, name, profiles: ["red-blue", "yellow"] });
  }
  for (const [idText, name] of Object.entries(GEN2_ITEMS)) {
    const id = Number(idText);
    addReference({ id, name, profiles: ["gold-silver", "crystal"] });
  }
  for (const item of GEN3_ITEMS) {
    addReference({
      id: item.id,
      name: item.name,
      pocket: item.pocket,
      profiles: ["ruby-sapphire", "emerald", "firered-leafgreen"],
    });
  }
  for (const description of Object.values(ITEM_DESCRIPTIONS)) {
    addReference({
      name: description.names[0] ?? description.slug.replace(/-/g, " "),
      slug: description.slug,
      profiles: Object.keys(GAME_PROFILE_INFO) as GameProfile[],
    });
  }

  const matches = references.filter((reference) => {
    if (numericId !== undefined && reference.id === Math.floor(numericId)) return true;
    if (!normalized) return false;
    const names = [
      reference.name,
      reference.slug,
      ...(getItemDescriptionForReference(reference)?.names ?? []),
    ].filter((name): name is string => Boolean(name));
    return names.some((name) => {
      const candidate = normalizeForSearch(name);
      return (
        candidate === normalized ||
        candidate.startsWith(normalized) ||
        (candidate.startsWith("tm") || candidate.startsWith("hm")
          ? candidate.includes(normalized)
          : false)
      );
    });
  });

  return matches.sort((left, right) => {
    const leftExact = normalizeForSearch(left.name) === normalized ? 0 : 1;
    const rightExact = normalizeForSearch(right.name) === normalized ? 0 : 1;
    return leftExact - rightExact || (left.id ?? 9999) - (right.id ?? 9999);
  });
}

function humanizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) return part;
      if (part === "hoenn" || part === "kanto" || part === "johto") {
        return part[0].toUpperCase() + part.slice(1);
      }
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function normalizeEncounterMethod(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? normalizePhrase(value) : "";
  if (!normalized) return undefined;
  if (normalized.includes("old rod")) return "old-rod";
  if (normalized.includes("good rod")) return "good-rod";
  if (normalized.includes("super rod")) return "super-rod";
  if (normalized.includes("rock smash")) return "rock-smash";
  if (normalized.includes("surf")) return "surf";
  if (normalized.includes("walk") || normalized.includes("grass")) return "walk";
  return normalized.replace(/\s+/g, "-");
}

function resolveGameProfile(value?: unknown): GameProfile | undefined {
  const normalized = typeof value === "string" ? normalizeForSearch(value) : "";
  if (!normalized) return undefined;
  if (normalized.includes("smeraldo")) return "emerald";
  if (normalized.includes("cristallo")) return "crystal";
  if (normalized.includes("oro") || normalized.includes("argento")) return "gold-silver";
  if (normalized.includes("giallo")) return "yellow";
  if (normalized.includes("rossofuoco") || normalized.includes("verdefoglia")) return "firered-leafgreen";
  if (normalized.includes("rosso") || normalized.includes("blu")) return "red-blue";
  if (normalized.includes("rubino") || normalized.includes("zaffiro")) return "ruby-sapphire";
  if (normalized.includes("firered") || normalized.includes("leafgreen")) return "firered-leafgreen";
  if (normalized.includes("yellow")) return "yellow";
  if (normalized.includes("red") || normalized.includes("blue")) return "red-blue";
  if (normalized.includes("crystal")) return "crystal";
  if (normalized.includes("gold") || normalized.includes("silver")) return "gold-silver";
  if (normalized.includes("emerald")) return "emerald";
  if (normalized.includes("ruby") || normalized.includes("sapphire")) return "ruby-sapphire";
  return undefined;
}

function getGeneration(game: unknown, explicitGeneration: unknown): 1 | 2 | 3 | undefined {
  const parsed = parseNumber(explicitGeneration);
  if (parsed === 1 || parsed === 2 || parsed === 3) return parsed;
  const profile = resolveGameProfile(game);
  return profile ? GAME_PROFILE_INFO[profile].generation : undefined;
}

function getSpeciesTypesForGeneration(
  species: ReturnType<typeof getSpeciesById>,
  generation: 1 | 2 | 3
): string[] {
  if (generation === 1) {
    return GEN1_SPECIES_TYPE_OVERRIDES[species.id] ?? species.types;
  }
  return species.types;
}

function getPokeApiSource(resource: string, slug: string, scope?: string): ToolSource {
  return {
    kind: "pokeapi",
    name: "PokeAPI local snapshot",
    url: `https://pokeapi.co/api/v2/${resource}/${slug}`,
    scope,
  };
}

function success(
  tool: string,
  data: Record<string, unknown>,
  sources: ToolSource[],
  limitations: string[] = [],
  gameProfile?: GameProfile
): ToolExecutionResult {
  const parsedData = (toolDataSchemas[tool] ?? z.record(z.unknown())).parse(data) as Record<
    string,
    unknown
  >;
  return toolResultSchema.parse({
    ok: true,
    tool,
    ...(gameProfile ? { gameProfile } : {}),
    data: parsedData,
    sources,
    limitations,
    confidence: sources.length > 1 ? "cross-checked" : "source-backed",
  }) as ToolExecutionResult;
}

function failure(
  tool: string,
  code: ToolErrorCode,
  message: string
): ToolExecutionResult {
  return toolResultSchema.parse({
    ok: false,
    tool,
    sources: [],
    limitations: [],
    confidence: "unresolved",
    error: message,
    errorDetail: { code, message },
  }) as ToolExecutionResult;
}

function decodeUrlSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function humanizeSourceFragment(value: string): string {
  return decodeUrlSegment(value)
    .replace(/_/g, " ")
    .replace(/\\/g, "")
    .trim();
}

function describeSourceUrl(url: string, fallbackName: string) {
  if (url.includes("github.com/pret/")) {
    const match = url.match(/github\.com\/pret\/([^/]+)\/blob\/[^/]+\/(.+)$/);
    const repo = match?.[1] ?? "pret";
    const filePath = match?.[2]?.split("#")[0] ?? "";
    const fileName = filePath.split("/").pop() ?? repo;
    return {
      siteName: "PRET",
      icon: "GH",
      displayName: `PRET ${repo}: ${fileName}`,
    };
  }

  if (url.includes("bulbapedia.bulbagarden.net")) {
    const hash = url.split("#")[1] ?? "";
    const section = hash ? humanizeSourceFragment(hash) : "";
    const partMatch = url.match(/Walkthrough%3A([^/]+)\/Part_(\d+)/);
    if (partMatch) {
      const game = humanizeSourceFragment(partMatch[1]);
      const part = partMatch[2];
      return {
        siteName: "Bulbapedia",
        icon: "B",
        displayName: `Bulbapedia walkthrough: ${game} Part ${part}${section ? ` - ${section}` : ""}`,
      };
    }

    const titleMatch = url.match(/[?&]title=([^&#]+)/);
    const title = titleMatch ? humanizeSourceFragment(titleMatch[1]) : section;
    return {
      siteName: "Bulbapedia",
      icon: "B",
      displayName: title ? `Bulbapedia: ${title}` : "Bulbapedia",
    };
  }

  return {
    siteName: fallbackName,
    icon: "↗",
    displayName: fallbackName,
  };
}

function formatEvolutionDetail(detail: (typeof POKEMON_EVOLUTIONS)[number]["details"][number]) {
  const requirements: string[] = [];
  if (detail.minLevel !== undefined) requirements.push(`reach level ${detail.minLevel}`);
  if (detail.minHappiness !== undefined) {
    requirements.push(`reach at least ${detail.minHappiness} happiness`);
  }
  if (detail.minBeauty !== undefined) requirements.push(`reach at least ${detail.minBeauty} beauty`);
  if (detail.item) requirements.push(`use ${detail.item.replace(/-/g, " ")}`);
  if (detail.heldItem) requirements.push(`hold ${detail.heldItem.replace(/-/g, " ")}`);
  if (detail.timeOfDay) requirements.push(`during ${detail.timeOfDay}`);
  if (detail.tradeSpecies) {
    requirements.push(`trade for ${detail.tradeSpecies.replace(/-/g, " ")}`);
  } else if (detail.trigger === "trade") {
    requirements.push("trade the Pokemon");
  }
  if (detail.trigger === "level-up" && detail.minLevel === undefined) {
    requirements.push("gain a level");
  }

  return {
    ...detail,
    item: detail.item?.replace(/-/g, " "),
    heldItem: detail.heldItem?.replace(/-/g, " "),
    knownMove: detail.knownMove?.replace(/-/g, " "),
    knownMoveType: detail.knownMoveType?.replace(/-/g, " "),
    location: detail.location?.replace(/-/g, " "),
    tradeSpecies: detail.tradeSpecies?.replace(/-/g, " "),
    requirements,
    summary: requirements.join(", "),
  };
}

function requireContext(tool: string, context?: GameContextSnapshot): ToolExecutionResult | undefined {
  if (context) return undefined;
  return failure(tool, "INVALID_ARGUMENT", "This tool requires a loaded save or live game state.");
}

const REFERENCE_TOOLS = new Set([
  "get_move",
  "get_move_reference",
  "get_species",
  "get_type_matchup",
  "get_evolution",
  "get_learnset",
  "get_encounters",
  "get_item",
  "get_item_location",
  "search_game_guidance",
]);

console.log(
  [
    "[CHATBOT TOOLS] Registry initialized:",
    `moves=${MOVES.length}`,
    `species=${SPECIES.length}`,
    `evolutions=${POKEMON_EVOLUTIONS.length}`,
    "learnsets=lazy",
    "encounters=lazy",
    `walkthroughChunks=${walkthroughIndex.chunks.length}`,
    `embeddings=${WALKTHROUGH_EMBEDDINGS ? `${WALKTHROUGH_EMBEDDINGS.manifest.records.length}x${WALKTHROUGH_EMBEDDINGS.manifest.dimensions}` : "none"}`,
  ].join(" ")
);

export function canExecuteToolWithoutContext(toolName: string): boolean {
  return REFERENCE_TOOLS.has(toolName);
}

export function getChatToolDefinitions(): ChatToolDefinition[] {
  return [
    {
      type: "function",
      function: {
        name: "get_move",
        description: "Look up a Gen 1-3 move from the local PokeAPI-backed snapshot.",
        parameters: {
          type: "object",
          properties: {
            move: { type: "string", description: "Move name or numeric ID." },
            game: { type: "string", description: "Optional game for version-group flavor text." },
          },
          required: ["move"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_move_reference",
        description: "Compatibility alias for get_move using moveName.",
        parameters: {
          type: "object",
          properties: {
            moveName: { type: "string", description: "Move name, for example Thunder Punch." },
            game: { type: "string", description: "Optional game for version-group flavor text." },
          },
          required: ["moveName"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_species",
        description: "Look up local Gen 1-3 species types, National Dex ID, growth rate and reference stats.",
        parameters: {
          type: "object",
          properties: {
            species: { type: "string", description: "Species name or National Dex ID." },
            game: { type: "string", description: "Optional game context." },
          },
          required: ["species"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_type_matchup",
        description: "Calculate a Gen 1, 2 or 3 type effectiveness multiplier.",
        parameters: {
          type: "object",
          properties: {
            attackingType: { type: "string" },
            move: { type: "string" },
            defenderSpecies: { type: "string" },
            defenderTypes: { type: "array", items: { type: "string" }, maxItems: 2 },
            game: { type: "string" },
            generation: { type: "number", enum: [1, 2, 3] },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_evolution",
        description: "Look up Gen 1-3 evolution relationships and trigger conditions from a local PokeAPI snapshot.",
        parameters: {
          type: "object",
          properties: {
            species: { type: "string", description: "Species name or National Dex ID." },
            direction: { type: "string", enum: ["from", "to", "both"] },
            game: { type: "string", description: "Optional game context." },
          },
          required: ["species"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_learnset",
        description: "Look up per-game Gen 1-3 level-up, machine, tutor, and egg move learnsets from a local PokeAPI snapshot.",
        parameters: {
          type: "object",
          properties: {
            species: { type: "string", description: "Species name or National Dex ID." },
            game: { type: "string", description: "Required game or version group, for example Emerald or Pokemon Crystal." },
            methods: {
              type: "array",
              items: {
                type: "string",
                enum: ["level-up", "machine", "tutor", "egg"],
              },
              description: "Optional learn methods to include.",
            },
            move: { type: "string", description: "Optional move name or numeric ID to check." },
            levelMax: { type: "number", description: "Optional maximum level for level-up moves." },
            limit: { type: "number", minimum: 1, maximum: 100 },
          },
          required: ["species", "game"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_encounters",
        description: "Look up Gen 1-3 wild encounter availability by Pokemon, location, method, and time from a local snapshot.",
        parameters: {
          type: "object",
          properties: {
            game: { type: "string", description: "Required game or version group, for example Emerald or Pokemon Crystal." },
            location: { type: "string", description: "Optional location name, for example Route 102 or Granite Cave." },
            species: { type: "string", description: "Optional species name or National Dex ID." },
            method: { type: "string", description: "Optional encounter method, for example walk, surf, old-rod, good-rod, super-rod, rock-smash." },
            timeOfDay: { type: "string", enum: ["morning", "day", "night"] },
            limit: { type: "number", minimum: 1, maximum: 100 },
          },
          required: ["game"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_item",
        description: "Look up Gen 1-3 item metadata, pocket, description, and game availability from local item tables.",
        parameters: {
          type: "object",
          properties: {
            item: { type: "string", description: "Item name, machine label, or numeric ID, for example Exp. Share or TM24." },
            game: { type: "string", description: "Optional game context." },
          },
          required: ["item"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_item_location",
        description: "Find walkthrough-backed guidance for where an item, TM, HM, or key item is obtained.",
        parameters: {
          type: "object",
          properties: {
            item: { type: "string", description: "Item name, TM/HM label, or numeric ID." },
            game: { type: "string", description: "Required game or version group." },
            canonicalQuery: {
              type: "string",
              description: "Optional concise English source-search query, for example Mach Bike location Pokemon Emerald.",
            },
            obtainedOnly: { type: "boolean", description: "When save/live state is available, return only if the item is already in inventory." },
            limit: { type: "number", minimum: 1, maximum: 8 },
          },
          required: ["item", "game"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_game_guidance",
        description: "Search local source-backed event guidance and return relevant walkthrough/code sources.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            canonicalQuery: {
              type: "string",
              description:
                "Rewrite the user's information need as a concise English source-search query using only entities and objectives present in the question. Translate names like locations, games, items, characters, routes, and high-level objectives to official English terms. Do not add solution details that the user did not mention.",
            },
            keywords: {
              type: "array",
              items: { type: "string" },
              maxItems: 12,
              description:
                "Optional official English aliases or named entities from the question, such as Pokemon League for League or Elite Four for Pokemon League. Do not include answer facts or requirements that must be discovered from retrieved sources.",
            },
            game: {
              type: "string",
              description: "Optional game name. Include it when the question names a game.",
            },
            limit: { type: "number", minimum: 1, maximum: 8 },
          },
          required: ["query"],
        },
      },
    },
    ...[
      ["get_trainer_status", "Get current trainer summary with location and progression."],
      ["get_party_overview", "Get current party Pokemon summary including hp, status and types."],
      ["get_story_context", "Get source-backed permanent choices, current story phases, and known next steps."],
      ["get_pokedex_overview", "Get Pokédex progress with seen/caught totals."],
    ].map(([name, description]) => ({
      type: "function" as const,
      function: {
        name,
        description,
        parameters: { type: "object", properties: {}, required: [] },
      },
    })),
    {
      type: "function",
      function: {
        name: "get_pokemon_details",
        description: "Get detailed info for one party Pokemon by name or 1-based index.",
        parameters: {
          type: "object",
          properties: {
            pokemonName: { type: "string" },
            partyIndex: { type: "number" },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_pokedex_lookup",
        description: "Look up whether a specific Pokemon has been seen or caught.",
        parameters: {
          type: "object",
          properties: { pokemonName: { type: "string" } },
          required: ["pokemonName"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_inventory_overview",
        description: "Get inventory summary and item list, optionally filtered by name.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number" },
            query: { type: "string" },
          },
          required: [],
        },
      },
    },
  ];
}

export function executeChatTool(
  toolName: string,
  args: Record<string, unknown>,
  context?: GameContextSnapshot
): ToolExecutionResult {
  if (toolName === "get_move" || toolName === "get_move_reference") {
    const requested = toolName === "get_move" ? args.move : args.moveName;
    const move = findMove(requested);
    if (!move) {
      return failure(toolName, "NOT_FOUND", `Unknown move: "${String(requested ?? "")}".`);
    }

    const profile = resolveGameProfile(args.game ?? context?.gameTitle);
    const description = MOVE_DESCRIPTIONS[move.id];
    const flavorText =
      (profile ? description?.flavorTexts[profile] : undefined) ?? description?.flavorText;
    const source =
      description?.source === "pokeapi"
        ? getPokeApiSource("move", description.slug, profile)
        : {
            kind: "local-fallback" as const,
            name: "Pokemon Emulator Tracker local move table",
          };

    return success(
      toolName,
      {
        id: move.id,
        name: move.name,
        type: move.type,
        power: move.power,
        accuracy: move.accuracy,
        pp: move.pp,
        effect: description?.shortEffect,
        flavorText,
        appliesTo: profile ?? "generic Gen 1-3 reference",
      },
      [source],
      ["The base move table is normalized and does not yet prove a species learns the move in a specific game."],
      profile
    );
  }

  if (toolName === "get_species") {
    const species = findSpecies(args.species);
    if (!species) {
      return failure(toolName, "NOT_FOUND", `Unknown species: "${String(args.species ?? "")}".`);
    }
    const profile = resolveGameProfile(args.game ?? context?.gameTitle);
    const introducedGeneration = species.id <= 151 ? 1 : species.id <= 251 ? 2 : 3;
    if (profile && GAME_PROFILE_INFO[profile].generation < introducedGeneration) {
      return failure(
        toolName,
        "NOT_FOUND",
        `${species.name} is not present in ${profile}; it was introduced in Generation ${introducedGeneration}.`
      );
    }

    return success(
      toolName,
      {
        id: species.id,
        name: species.name,
        introducedGeneration,
        types: species.types,
        growthRate: species.growthRate,
        baseStats: species.baseStats,
      },
      [getPokeApiSource("pokemon-species", String(species.id), profile)],
      ["Types and reference stats come from the local normalized table; some stats and types changed between historical games."],
      profile
    );
  }

  if (toolName === "get_type_matchup") {
    const profile = resolveGameProfile(args.game ?? context?.gameTitle);
    const generation = getGeneration(args.game ?? context?.gameTitle, args.generation);
    if (!generation) {
      return failure(
        toolName,
        "AMBIGUOUS_GAME",
        "A supported game or generation 1, 2, or 3 is required for type effectiveness."
      );
    }

    const move = args.move !== undefined ? findMove(args.move) : undefined;
    const attackingTypeRaw =
      typeof args.attackingType === "string" ? args.attackingType : move?.type;
    const attackingType = normalizeForSearch(attackingTypeRaw ?? "");
    const chart = generation === 1 ? TYPE_CHART_GEN1 : TYPE_CHART_GEN2_3;
    if (!attackingType || !chart[attackingType]) {
      return failure(toolName, "INVALID_ARGUMENT", "A valid attackingType or move is required.");
    }

    const defender = args.defenderSpecies !== undefined ? findSpecies(args.defenderSpecies) : undefined;
    const explicitTypes = Array.isArray(args.defenderTypes)
      ? args.defenderTypes.filter((value): value is string => typeof value === "string")
      : [];
    const defenderTypes = (
      explicitTypes.length > 0
        ? explicitTypes
        : defender
          ? getSpeciesTypesForGeneration(defender, generation)
          : []
    ).map(normalizeForSearch);
    if (defenderTypes.length === 0 || defenderTypes.length > 2) {
      return failure(
        toolName,
        "INVALID_ARGUMENT",
        "Provide defenderSpecies or one or two defenderTypes."
      );
    }

    const unknownType = defenderTypes.find(
      (type) => !TYPE_CHART_GEN2_3[type] && !Object.keys(TYPE_CHART_GEN2_3).some((key) => key === type)
    );
    if (unknownType) {
      return failure(toolName, "INVALID_ARGUMENT", `Unknown defender type: "${unknownType}".`);
    }

    const factors = defenderTypes.map((type) => chart[attackingType]?.[type] ?? 1);
    const multiplier = factors.reduce((total, factor) => total * factor, 1);
    return success(
      toolName,
      {
        generation,
        attackingType,
        move: move?.name,
        defenderSpecies: defender?.name,
        defenderTypes,
        factors,
        multiplier,
        effectiveness:
          multiplier === 0
            ? "immune"
            : multiplier > 1
              ? "super-effective"
              : multiplier < 1
                ? "not-very-effective"
                : "neutral",
      },
      [
        {
          kind: "local-fallback",
          name: `Pokemon main-series Generation ${generation} type chart`,
          url: `https://pokeapi.co/api/v2/type/${attackingType}`,
          scope: profile,
        },
      ],
      ["Abilities and temporary battle effects are not applied."],
      profile
    );
  }

  if (toolName === "get_evolution") {
    const species = findSpecies(args.species);
    if (!species) {
      return failure(toolName, "NOT_FOUND", `Unknown species: "${String(args.species ?? "")}".`);
    }
    const direction =
      args.direction === "from" || args.direction === "to" || args.direction === "both"
        ? args.direction
        : "both";
    const profile = resolveGameProfile(args.game ?? context?.gameTitle);
    const generation = profile ? GAME_PROFILE_INFO[profile].generation : undefined;
    const from = POKEMON_EVOLUTIONS.filter((edge) => edge.fromId === species.id);
    const to = POKEMON_EVOLUTIONS.filter((edge) => edge.toId === species.id);

    const filterByGeneration = (edge: (typeof POKEMON_EVOLUTIONS)[number]) =>
      !generation || edge.toId <= (generation === 1 ? 151 : generation === 2 ? 251 : 386);
    const mapEdge = (edge: (typeof POKEMON_EVOLUTIONS)[number]) => ({
      fromId: edge.fromId,
      from: edge.from,
      toId: edge.toId,
      to: edge.to,
      details: edge.details.map(formatEvolutionDetail),
    });
    const evolvesFrom = direction === "from" ? [] : to.filter(filterByGeneration).map(mapEdge);
    const evolvesTo = direction === "to" ? [] : from.filter(filterByGeneration).map(mapEdge);

    return success(
      toolName,
      {
        species: { id: species.id, name: species.name },
        direction,
        evolvesFrom,
        evolvesTo,
      },
      [getPokeApiSource("pokemon-species", String(species.id), profile)],
      [
        "Evolution triggers are filtered to species available by generation, but version-exclusive availability and trade feasibility are not yet checked.",
      ],
      profile
    );
  }

  if (toolName === "get_learnset") {
    const species = findSpecies(args.species);
    if (!species) {
      return failure(toolName, "NOT_FOUND", `Unknown species: "${String(args.species ?? "")}".`);
    }

    const profile = resolveGameProfile(args.game ?? context?.gameTitle);
    if (!profile) {
      return failure(
        toolName,
        "AMBIGUOUS_GAME",
        "A supported game is required for learnset lookup."
      );
    }
    const generation = GAME_PROFILE_INFO[profile].generation;
    const introducedGeneration = species.id <= 151 ? 1 : species.id <= 251 ? 2 : 3;
    if (generation < introducedGeneration) {
      return failure(
        toolName,
        "NOT_FOUND",
        `${species.name} is not present in ${profile}; it was introduced in Generation ${introducedGeneration}.`
      );
    }

    const requestedMove = args.move !== undefined ? findMove(args.move) : undefined;
    if (args.move !== undefined && !requestedMove) {
      return failure(toolName, "NOT_FOUND", `Unknown move: "${String(args.move ?? "")}".`);
    }
    const requestedMethods = Array.isArray(args.methods)
      ? new Set(
          args.methods.filter(
            (value): value is string =>
              value === "level-up" ||
              value === "machine" ||
              value === "tutor" ||
              value === "egg"
          )
        )
      : new Set<string>();
    const levelMax = parseNumber(args.levelMax);
    const requestedLimit = parseNumber(args.limit) ?? 50;
    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 100);
    const matchingRows = getPokemonLearnsets().filter(([speciesId, moveId, versionGroup, method, level]) => {
      if (speciesId !== species.id || versionGroup !== profile) return false;
      if (requestedMove && moveId !== requestedMove.id) return false;
      if (requestedMethods.size > 0 && !requestedMethods.has(method)) return false;
      if (levelMax !== undefined && method === "level-up" && level > levelMax) return false;
      return true;
    });
    const sortedRows = [...matchingRows].sort(
      (left, right) =>
        left[4] - right[4] ||
        left[3].localeCompare(right[3]) ||
        left[1] - right[1]
    );
    const entries = sortedRows.slice(0, limit).map(([, moveId, , method, level]) => {
      const move = MOVES.find((candidate) => candidate.id === moveId);
      return {
        moveId,
        move: move?.name ?? `Move ${moveId}`,
        method,
        ...(method === "level-up" ? { level } : {}),
      };
    });

    return success(
      toolName,
      {
        species: { id: species.id, name: species.name },
        game: profile,
        methods:
          requestedMethods.size > 0
            ? [...requestedMethods]
            : ["level-up", "machine", "tutor", "egg", "other"],
        ...(requestedMove
          ? {
              requestedMove: { id: requestedMove.id, name: requestedMove.name },
              learnsMove: matchingRows.length > 0,
            }
          : {}),
        ...(levelMax !== undefined ? { levelMax } : {}),
        totalMatches: matchingRows.length,
        returnedMatches: entries.length,
        entries,
      },
      [getPokeApiSource("pokemon", String(species.id), profile)],
      [
        "Learnsets come from a generated local PokeAPI snapshot filtered by version group. PRET-backed exact learnset extraction is still planned.",
      ],
      profile
    );
  }

  if (toolName === "get_encounters") {
    const profile = resolveGameProfile(args.game ?? context?.gameTitle);
    if (!profile) {
      return failure(
        toolName,
        "AMBIGUOUS_GAME",
        "A supported game is required for encounter lookup."
      );
    }

    const species = args.species !== undefined ? findSpecies(args.species) : undefined;
    if (args.species !== undefined && !species) {
      return failure(toolName, "NOT_FOUND", `Unknown species: "${String(args.species ?? "")}".`);
    }
    const locationQuery = typeof args.location === "string" ? normalizePhrase(args.location) : "";
    const method = normalizeEncounterMethod(args.method);
    const timeOfDay =
      args.timeOfDay === "morning" || args.timeOfDay === "day" || args.timeOfDay === "night"
        ? args.timeOfDay
        : undefined;
    if (!species && !locationQuery) {
      return failure(
        toolName,
        "INVALID_ARGUMENT",
        "Provide at least a species or a location for encounter lookup."
      );
    }

    const requestedLimit = parseNumber(args.limit) ?? 12;
    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 100);
    const matchingRows = getPokemonEncounters().filter(
      ([speciesId, gameProfile, , locationArea, encounterMethod, , , , conditions]) => {
        if (gameProfile !== profile) return false;
        if (species && speciesId !== species.id) return false;
        if (locationQuery && !normalizePhrase(locationArea).includes(locationQuery)) return false;
        if (method && encounterMethod !== method) return false;
        if (timeOfDay && conditions && !conditions.includes(timeOfDay)) return false;
        return true;
      }
    );
    const sortedRows = matchingRows.slice().sort(
      (left, right) =>
        left[3].localeCompare(right[3]) ||
        left[5] - right[5] ||
        right[7] - left[7] ||
        left[0] - right[0]
    );
    const entries = sortedRows
      .slice(0, limit)
      .map(([speciesId, , locationAreaId, locationArea, encounterMethod, minLevel, maxLevel, chance, conditions]) => {
        const encounteredSpecies = getSpeciesById(speciesId);
        return {
          speciesId,
          species: encounteredSpecies.name,
          locationAreaId,
          location: humanizeSlug(locationArea),
          locationArea,
          method: encounterMethod,
          minLevel,
          maxLevel,
          chance,
          conditions: conditions ? conditions.split(",").filter(Boolean) : [],
        };
      });
    const locationGroups = new Map<
      string,
      {
        location: string;
        locationArea: string;
        methods: Set<string>;
        levelRanges: Set<string>;
        bestChance: number;
        species: Set<string>;
      }
    >();
    for (const [speciesId, , , locationArea, encounterMethod, minLevel, maxLevel, chance] of sortedRows) {
      const location = humanizeSlug(locationArea);
      const group = locationGroups.get(locationArea) ?? {
        location,
        locationArea,
        methods: new Set<string>(),
        levelRanges: new Set<string>(),
        bestChance: 0,
        species: new Set<string>(),
      };
      group.methods.add(encounterMethod);
      group.levelRanges.add(minLevel === maxLevel ? String(minLevel) : `${minLevel}-${maxLevel}`);
      group.bestChance = Math.max(group.bestChance, chance);
      group.species.add(getSpeciesById(speciesId).name);
      locationGroups.set(locationArea, group);
    }
    const locationSummaries = [...locationGroups.values()]
      .sort(
        (left, right) =>
          right.bestChance - left.bestChance || left.location.localeCompare(right.location)
      )
      .slice(0, 10)
      .map((group) => ({
        location: group.location,
        locationArea: group.locationArea,
        methods: [...group.methods].sort(),
        levelRanges: [...group.levelRanges].sort(),
        bestChance: group.bestChance,
        ...(species ? {} : { species: [...group.species].sort().slice(0, 12) }),
      }));
    const methodSummary = [...new Set(sortedRows.map((row) => row[4]))].sort();
    const topLocationNames = locationSummaries.map((entry) => entry.location).slice(0, 6);
    const summary =
      entries.length === 0
        ? "No matching wild encounter rows were found in the local snapshot."
        : species
          ? `${species.name} is available in ${profile} at ${topLocationNames.join(", ")}${
              locationSummaries.length > topLocationNames.length ? ", and more locations" : ""
            }. Main methods: ${methodSummary.join(", ")}.`
          : `The local encounter snapshot found ${matchingRows.length} matching encounter rows in ${profile}. Top locations: ${topLocationNames.join(", ")}.`;

    return success(
      toolName,
      {
        summary,
        game: profile,
        requestedSpecies: species ? { id: species.id, name: species.name } : null,
        requestedLocation: typeof args.location === "string" ? args.location : null,
        requestedMethod: method ?? null,
        requestedTimeOfDay: timeOfDay ?? null,
        totalMatches: matchingRows.length,
        returnedMatches: entries.length,
        locationSummaries,
        entries,
        answerPolicy:
          "Use summary and locationSummaries first for the answer. Use entries only for exact levels, methods, chances, and conditions. If this is enough to answer the user, answer directly; otherwise call another relevant tool.",
      },
      [
        species
          ? getPokeApiSource("pokemon", String(species.id), profile)
          : {
              kind: "pokeapi",
              name: "PokeAPI local encounter snapshot",
              url: "https://pokeapi.co/api/v2/location-area/",
              scope: profile,
            },
      ],
      [
        "Encounters come from a generated local PokeAPI snapshot. PRET-backed exact slot tables, encounter rates, and version-specific edge cases are still planned.",
      ],
      profile
    );
  }

  if (toolName === "get_item") {
    const profile = resolveGameProfile(args.game ?? context?.gameTitle);
    const references = getItemReferences(args.item, profile);
    if (references.length === 0) {
      return failure(toolName, "NOT_FOUND", `Unknown item: "${String(args.item ?? "")}".`);
    }
    const entries = references.slice(0, 12).map((reference) => {
      const description = getItemDescriptionForReference(reference);
      const flavorText =
        (profile ? description?.flavorTexts[profile] : undefined) ?? description?.flavorText;
      return {
        id: reference.id,
        name: reference.name,
        pocket: reference.pocket,
        slug: description?.slug ?? reference.slug,
        profiles: reference.profiles,
        flavorText,
        effect: description?.shortEffect,
        source: description?.source ?? "local",
      };
    });

    return success(
      toolName,
      {
        query: args.item,
        game: profile ?? null,
        totalMatches: references.length,
        returnedMatches: entries.length,
        entries,
      },
      [
        entries.some((entry) => entry.source === "pokeapi" && entry.slug)
          ? getPokeApiSource("item", String(entries.find((entry) => entry.slug)?.slug), profile)
          : {
              kind: "local-fallback",
              name: "Pokemon Emulator Tracker local item table",
              scope: profile,
            },
      ],
      [
        "Item metadata is normalized for Gen 1-3 and may not include every game-specific acquisition rule.",
      ],
      profile
    );
  }

  if (toolName === "get_item_location") {
    const profile = resolveGameProfile(args.game ?? context?.gameTitle);
    if (!profile) {
      return failure(
        toolName,
        "AMBIGUOUS_GAME",
        "A supported game is required for item location lookup."
      );
    }
    const references = getItemReferences(args.item, profile);
    if (references.length === 0) {
      return failure(toolName, "NOT_FOUND", `Unknown item: "${String(args.item ?? "")}".`);
    }

    const itemNames = [...new Set(references.flatMap((reference) => {
      const description = getItemDescriptionForReference(reference);
      return [reference.name, ...(description?.names ?? [])].filter(Boolean);
    }))].slice(0, 8);
    const canonicalQuery =
      typeof args.canonicalQuery === "string" && args.canonicalQuery.trim()
        ? args.canonicalQuery.trim()
        : `${itemNames[0]} location`;
    const requestedKnowledgeProfile = GAME_PROFILE_INFO[profile].knowledgeProfile;
    const requestedCatalog = gameGuideSources.profiles[requestedKnowledgeProfile];
    const scopeTerms = new Set(
      tokenizeForSearch(
        [
          profile,
          requestedKnowledgeProfile,
          requestedCatalog?.game,
          ...(requestedCatalog?.sources.map((source) => source.title) ?? []),
        ]
          .filter(Boolean)
          .join(" ")
      )
    );
    const retrievalPlan = getGuidanceRetrievalPlan(
      canonicalQuery,
      canonicalQuery,
      itemNames,
      scopeTerms
    );
    const requestedLimit = parseNumber(args.limit) ?? 5;
    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 8);
    const inventoryMatches =
      context?.inventory.filter((entry) =>
        itemNames.some((name) => normalizeForSearch(entry.name) === normalizeForSearch(name))
      ) ?? [];
    if (args.obtainedOnly === true && inventoryMatches.length === 0) {
      return success(
        toolName,
        {
          item: itemNames[0],
          game: profile,
          obtainedOnly: true,
          inventoryMatches: [],
          matches: [],
          answerPolicy:
            "The active save/live inventory does not contain this item. Do not claim it has been obtained.",
        },
        [],
        ["No inventory match was found in the active context."],
        profile
      );
    }

    const matches = walkthroughIndex.chunks
      .filter((chunk) => chunk.profiles.includes(requestedKnowledgeProfile))
      .map((chunk) => {
        const ranking = scoreSearchableFields(
          {
            title: chunk.section.replace(/\([^)]*\)/g, ""),
            parent: chunk.parentSection,
            topics: chunk.partTopics.join(" "),
            body: chunk.text,
            url: chunk.url,
          },
          retrievalPlan,
          {
            title: 7,
            parent: 4,
            topics: 2,
            body: 1,
            url: 2,
            phrase: 12,
            exact: 14,
          }
        );
        return {
          score: ranking.score,
          retrieval: {
            matchedTerms: ranking.matchedTerms,
            matchedPhrases: ranking.matchedPhrases,
            coverage: ranking.coverage,
          },
          game: chunk.games.join(", "),
          location: chunk.section,
          description: chunk.text,
          sourceRefs: [chunk.url],
          walkthrough: {
            source: chunk.source,
            part: chunk.part,
            section: chunk.section,
            parentSection: chunk.parentSection,
            revision: chunk.revision,
          },
        };
      })
      .filter((entry) => entry.score >= 2 && entry.retrieval.coverage > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ score: _score, ...entry }) => entry);
    const sources = matches
      .flatMap((entry) =>
        entry.sourceRefs.map((url) => ({
          kind: "walkthrough" as const,
          name: "Reviewed game guide",
          url,
          scope: requestedKnowledgeProfile,
          ...describeSourceUrl(url, "Reviewed game guide"),
        }))
      )
      .filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index);

    return success(
      toolName,
      {
        item: itemNames[0],
        aliases: itemNames.slice(1),
        game: profile,
        inventoryMatches,
        matches,
        answerPolicy:
          matches.length > 0
            ? "Use these walkthrough matches first and cite their sources."
            : "No local walkthrough match was found. The assistant may answer from general model knowledge only if it explicitly says it could not find a local source-backed match.",
      },
      sources,
      [
        ...(matches.length > 0
          ? ["Item location guidance comes from reviewed walkthrough text, not yet exact PRET item placement extraction."]
          : ["No local walkthrough item-location match was found."]),
      ],
      profile
    );
  }

  if (toolName === "search_game_guidance") {
    const query =
      typeof args.query === "string" && args.query.trim()
        ? args.query.trim()
        : typeof args.canonicalQuery === "string"
          ? args.canonicalQuery.trim()
          : "";
    if (!query) return failure(toolName, "INVALID_ARGUMENT", "query is required.");

    const requestedProfile =
      resolveGameProfile([args.query, args.canonicalQuery].filter(Boolean).join(" ")) ??
      resolveGameProfile(args.game) ??
      resolveGameProfile(context?.gameTitle);
    const knowledgeProfiles = requestedProfile
      ? [GAME_PROFILE_INFO[requestedProfile].knowledgeProfile]
      : Object.values(GAME_PROFILE_INFO).map((entry) => entry.knowledgeProfile);
    const canonicalQuery =
      typeof args.canonicalQuery === "string" && args.canonicalQuery.trim()
        ? args.canonicalQuery.trim()
        : query;
    const keywords = Array.isArray(args.keywords)
      ? args.keywords
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .slice(0, 12)
      : [];
    const requestedKnowledgeProfile = requestedProfile
      ? GAME_PROFILE_INFO[requestedProfile].knowledgeProfile
      : undefined;
    const requestedCatalog = requestedKnowledgeProfile
      ? gameGuideSources.profiles[requestedKnowledgeProfile]
      : undefined;
    const scopeTerms = new Set(
      tokenizeForSearch(
        [
          requestedProfile,
          requestedKnowledgeProfile,
          requestedCatalog?.game,
          ...(requestedCatalog?.sources.map((source) => source.title) ?? []),
        ]
          .filter(Boolean)
          .join(" ")
      )
    );
    const retrievalPlan = getGuidanceRetrievalPlan(
      query,
      canonicalQuery,
      keywords,
      scopeTerms
    );
    const requestedLimit = parseNumber(args.limit) ?? 5;
    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 8);
    const embeddingModelName =
      typeof args._embeddingModelName === "string" ? args._embeddingModelName : undefined;
    const embeddingsAvailable = Boolean(
      WALKTHROUGH_EMBEDDINGS &&
        (!embeddingModelName ||
          sameOllamaModelName(WALKTHROUGH_EMBEDDINGS.manifest.model, embeddingModelName))
    );
    const queryEmbedding =
      embeddingsAvailable && WALKTHROUGH_EMBEDDINGS
        ? parseQueryEmbedding(args._queryEmbedding, WALKTHROUGH_EMBEDDINGS.manifest.dimensions)
        : null;

    const eventMatches = knowledgeProfiles
      .flatMap((knowledgeProfile) => {
        const generated = GENERATED_EVENT_GUIDES[knowledgeProfile] ?? {};
        const audited = EVENT_GUIDANCE_BY_PROFILE[knowledgeProfile] ?? {};
        const keys = new Set([...Object.keys(generated), ...Object.keys(audited)]);
        const catalog = gameGuideSources.profiles[knowledgeProfile];

        return [...keys].map((key) => {
          const generatedGuide = generated[key];
          const auditedGuide = audited[key];
          const sourceRefs = [
            ...(auditedGuide?.sourceRefs ?? []),
            ...(generatedGuide?.sourceRefs ?? []),
          ].filter((url, index, all) => all.indexOf(url) === index);
          const title = key.replace(/^GUIDE_/, "").replace(/_/g, " ");
          const body = [
            auditedGuide?.description,
            auditedGuide?.actionHint,
            ...(auditedGuide?.steps ?? []),
            generatedGuide?.description,
            generatedGuide?.location,
            ...(generatedGuide?.steps ?? []),
            generatedGuide?.completionMeaning,
            generatedGuide?.notCompletedMeaning,
          ].filter(Boolean).join(" ");
          const ranking = scoreSearchableFields(
            {
              title,
              parent: generatedGuide?.location,
              body,
              url: sourceRefs.join(" "),
            },
            retrievalPlan,
            {
              title: 6,
              parent: 3,
              topics: 0,
              body: 1,
              url: 2,
              phrase: 8,
              exact: 10,
            }
          );
          const baseScore = ranking.score;
          const auditedBoost = auditedGuide && baseScore > 0 ? 2 : 0;

          return {
            score: baseScore + auditedBoost,
            retrieval: {
              matchedTerms: ranking.matchedTerms,
              matchedPhrases: ranking.matchedPhrases,
              coverage: ranking.coverage,
            },
            knowledgeProfile,
            game: catalog?.game ?? knowledgeProfile,
            event: key,
            description: auditedGuide?.description ?? generatedGuide?.description,
            actionHint: auditedGuide?.actionHint,
            location: generatedGuide?.location,
            steps: auditedGuide?.steps ?? generatedGuide?.steps,
            prerequisites: auditedGuide?.prerequisites,
            normalMissingReason: auditedGuide?.normalMissingReason,
            completionMeaning: generatedGuide?.completionMeaning,
            notCompletedMeaning: generatedGuide?.notCompletedMeaning,
            sourceRefs,
            audited: Boolean(auditedGuide),
          };
        });
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.audited) - Number(a.audited));
    const walkthroughMatches = walkthroughIndex.chunks
      .filter((chunk) =>
        chunk.profiles.some((profile) =>
          knowledgeProfiles.some(
            (knowledgeProfile) => knowledgeProfile === profile
          )
        )
      )
      .map((chunk) => {
        const embeddingScore = scoreWalkthroughEmbedding(
          queryEmbedding,
          WALKTHROUGH_EMBEDDINGS?.recordById.get(chunk.id)
        );
        const ranking = scoreSearchableFields(
          {
            title: chunk.section.replace(/\([^)]*\)/g, ""),
            parent: chunk.parentSection,
            topics: chunk.partTopics.join(" "),
            body: chunk.text,
            url: chunk.url,
          },
          retrievalPlan,
          {
            title: 7,
            parent: 4,
            topics: 2,
            body: 0.8,
            url: 2,
            phrase: 12,
            exact: 14,
          }
        );
        const weightedEmbeddingScore =
          embeddingScore !== undefined ? Math.max(0, embeddingScore) * 30 : 0;
        return {
          score: ranking.score + weightedEmbeddingScore,
          retrieval: {
            matchedTerms: ranking.matchedTerms,
            matchedPhrases: ranking.matchedPhrases,
            coverage: ranking.coverage,
            ...(embeddingScore !== undefined
              ? {
                  embeddingScore: Number(embeddingScore.toFixed(4)),
                  embeddingModel: WALKTHROUGH_EMBEDDINGS?.manifest.model,
                }
              : {}),
          },
          knowledgeProfile: chunk.profiles[0],
          game: chunk.games.join(", "),
          event: `WALKTHROUGH_PART_${chunk.part}_${chunk.section}`,
          description: chunk.text,
          location: chunk.section,
          steps: undefined,
          sourceRefs: [chunk.url],
          audited: true,
          walkthrough: {
            source: chunk.source,
            part: chunk.part,
            section: chunk.section,
            parentSection: chunk.parentSection,
            revision: chunk.revision,
          },
        };
      })
      .filter(
        (entry) =>
          (entry.retrieval.embeddingScore !== undefined &&
            entry.retrieval.embeddingScore >= 0.45) ||
          (entry.score >= 2 && entry.retrieval.coverage > 0)
      );
    const guideEventMatches = eventMatches.filter((entry) =>
      entry.event.startsWith("GUIDE_")
    );
    const supportingEventMatches = eventMatches.filter(
      (entry) => !entry.event.startsWith("GUIDE_")
    );
    const rankedWalkthroughMatches = walkthroughMatches.sort(
      (left, right) => right.score - left.score
    );
    const matches = [
      ...guideEventMatches.slice(0, 1),
      ...rankedWalkthroughMatches.slice(0, Math.max(limit - 1, 0)),
      ...supportingEventMatches,
    ]
      .slice(0, limit)
      .map(({ score: _score, ...entry }) => entry);

    const matchedProfiles = [...new Set(matches.map((entry) => entry.knowledgeProfile))];
    const generalGuideSources = (
      requestedCatalog
        ? requestedCatalog.sources
        : knowledgeProfiles.flatMap(
            (knowledgeProfile) =>
              gameGuideSources.profiles[knowledgeProfile]?.sources ?? []
          )
    ).slice(0, 12);
    const sources = matches
      .flatMap((entry) =>
        entry.sourceRefs.map((url) => {
          const name = url.includes("github.com/pret/")
            ? "Pinned PRET source"
            : "Reviewed game guide";
          return {
            kind: url.includes("github.com/pret/")
              ? ("pret" as const)
              : ("walkthrough" as const),
            name,
            url,
            scope: entry.knowledgeProfile,
            ...describeSourceUrl(url, name),
          };
        })
      )
      .filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index)
      .slice(0, 8);

    return success(
      toolName,
      {
        query,
        canonicalQuery,
        keywords,
        requestedGame: requestedProfile ?? null,
        game: requestedCatalog?.game ?? null,
        matchedProfiles,
        matches,
        generalGuideSources,
        retrievalMode:
          queryEmbedding && WALKTHROUGH_EMBEDDINGS
            ? "hybrid-lexical-vector"
            : "lexical",
        embeddingModel:
          queryEmbedding && WALKTHROUGH_EMBEDDINGS
            ? WALKTHROUGH_EMBEDDINGS.manifest.model
            : null,
        answerPolicy:
          matches.length > 0
            ? "Use these source-backed matches first and preserve their stated limitations."
            : "No source-backed match was found. The assistant may answer from general model knowledge only if it explicitly says it could not find a local source-backed match and is using its own knowledge instead. Do not show source citations in that case.",
      },
      sources,
      [
        ...(matches.length > 0
          ? ["General guidance is source-backed but is not evidence of the current save-state availability."]
          : ["No local source-backed guidance matched this query."]),
        ...(!WALKTHROUGH_EMBEDDINGS
          ? ["Walkthrough embeddings are not available; retrieval used lexical matching only."]
          : embeddingModelName &&
              !sameOllamaModelName(WALKTHROUGH_EMBEDDINGS.manifest.model, embeddingModelName)
            ? [
                `Walkthrough embeddings were generated with ${WALKTHROUGH_EMBEDDINGS.manifest.model}, but runtime requested ${embeddingModelName}; retrieval used lexical matching only.`,
              ]
            : !queryEmbedding
              ? ["No query embedding was provided; retrieval used lexical matching only."]
              : []),
      ],
      requestedProfile
    );
  }

  const missingContext = requireContext(toolName, context);
  if (missingContext) return missingContext;

  const activeContext = context as GameContextSnapshot;

  switch (toolName) {
    case "get_trainer_status":
      return success(
        toolName,
        {
          trainerName: activeContext.trainerName,
          location: activeContext.location,
          money: activeContext.money,
          badges: activeContext.badges,
          pokedexSeen: activeContext.pokedexSeen,
          pokedexOwned: activeContext.pokedexOwned,
          gameTitle: activeContext.gameTitle,
          playtime: activeContext.playtime,
        },
        [{ kind: "save-state", name: "Current loaded game state" }]
      );
    case "get_story_context":
      return success(
        toolName,
        { facts: activeContext.progressFacts ?? [] },
        [{ kind: "save-state", name: "Current loaded game state" }]
      );
    case "get_party_overview":
      return success(
        toolName,
        {
          count: activeContext.partyPokemonDetailed?.length ?? activeContext.partyPokemon.length,
          party: (activeContext.partyPokemonDetailed ?? []).map((pokemon, index) => ({
            index: index + 1,
            name: pokemon.name,
            species: pokemon.species,
            level: pokemon.level,
            hp: pokemon.hp,
            maxHp: pokemon.maxHp,
            types: pokemon.types,
            status: pokemon.status,
          })),
        },
        [{ kind: "save-state", name: "Current loaded game state" }]
      );
    case "get_pokedex_overview": {
      const seen = activeContext.pokedexSeen;
      const owned = activeContext.pokedexOwned;
      return success(
        toolName,
        {
          gameTitle: activeContext.gameTitle,
          seen,
          owned,
          completionVsSeenPercent: seen > 0 ? Number(((owned / seen) * 100).toFixed(1)) : 0,
        },
        [{ kind: "save-state", name: "Current loaded game state" }]
      );
    }
    case "get_pokemon_details": {
      const detailed = activeContext.partyPokemonDetailed ?? [];
      const byName =
        typeof args.pokemonName === "string" ? normalizeForSearch(args.pokemonName) : "";
      const requestedIndex = parseNumber(args.partyIndex);
      const index = requestedIndex === undefined ? -1 : Math.floor(requestedIndex) - 1;
      const selected =
        (index >= 0 && index < detailed.length ? detailed[index] : undefined) ??
        detailed.find(
          (pokemon) =>
            normalizeForSearch(pokemon.name) === byName ||
            normalizeForSearch(pokemon.species) === byName
        );
      if (!selected) {
        return failure(toolName, "NOT_FOUND", "Pokemon not found in current party.");
      }
      return success(
        toolName,
        {
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
        },
        [{ kind: "save-state", name: "Current loaded game state" }]
      );
    }
    case "get_inventory_overview": {
      const query =
        typeof args.query === "string" && args.query.trim() ? normalizeForSearch(args.query) : "";
      const filtered = query
        ? activeContext.inventory.filter((item) => normalizeForSearch(item.name).includes(query))
        : activeContext.inventory;
      const sorted = [...filtered].sort(
        (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)
      );
      const requestedLimit = parseNumber(args.limit);
      const limit =
        requestedLimit === undefined
          ? sorted.length
          : Math.min(Math.max(Math.floor(requestedLimit), 1), Math.max(sorted.length, 1));
      const items = sorted.slice(0, limit);
      return success(
        toolName,
        {
          query: typeof args.query === "string" ? args.query : null,
          totalUniqueItems: filtered.length,
          totalItemCount: filtered.reduce((sum, item) => sum + item.quantity, 0),
          returnedItems: items.length,
          items,
        },
        [{ kind: "save-state", name: "Current loaded game state" }]
      );
    }
    case "get_pokedex_lookup": {
      const species = findSpecies(args.pokemonName);
      if (!species) {
        return failure(toolName, "NOT_FOUND", `Unknown species: "${String(args.pokemonName ?? "")}".`);
      }
      return success(
        toolName,
        {
          name: species.name,
          nationalDexId: species.id,
          seen: activeContext.pokedexSeenList.includes(species.id),
          caught: activeContext.pokedexCaughtList.includes(species.id),
        },
        [{ kind: "save-state", name: "Current loaded game state" }]
      );
    }
    default:
      return failure(toolName, "NOT_FOUND", `Unknown tool: ${toolName}`);
  }
}
