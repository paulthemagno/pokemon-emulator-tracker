/**
 * Context packer: converts SaveData or live snapshots into game context for LLM
 */

import type { GameContextSnapshot } from './types';
import type { Pokemon, SaveData } from '../pokemon/types';
import { getSpeciesById } from '../pokemon/data/species';
import { MOVES } from '../pokemon/data/moves';

const moveById = new Map(MOVES.map(move => [move.id, move]));
const specialTypes = new Set(['fire', 'water', 'grass', 'electric', 'ice', 'psychic', 'dragon', 'dark']);

export function packPokemonContext(p: Pokemon, generation: number) {
  const species = getSpeciesById(p.species);
  // Steel and Dark did not exist in Gen 1; Magnemite's historical type differs.
  const types = p.types?.length ? p.types : species?.types.filter(type => generation !== 1 || type !== 'steel') ?? [];
  return {
    name: p.nickname || p.speciesName || species?.name || 'Unknown',
    species: p.speciesName || species?.name || 'Unknown',
    level: p.level || 0, hp: p.currentHP || 0, maxHp: p.maxHP || 0,
    types, status: p.status || 'none', ability: p.abilityName, nature: p.natureName,
    heldItem: p.heldItemName,
    speciesId: p.species, stats: p.stats, ivs: p.ivs, evs: p.evs,
    moves: (p.moves || []).map(m => {
      const reference = moveById.get(m.id);
      const type = m.type ?? reference?.type ?? 'Unknown';
      const power = m.power ?? reference?.power ?? undefined;
      return {
        id: m.id, name: m.name || reference?.name || 'Unknown', type,
        category: !power || m.id === 237 || type === 'Unknown'
          ? 'Unknown' : specialTypes.has(type.toLowerCase()) ? 'Special' : 'Physical',
        power, accuracy: m.accuracy ?? reference?.accuracy ?? undefined,
        pp: m.pp ?? 0, maxPp: m.maxPP ?? reference?.pp ?? 0,
        referenceScope: 'Local cross-game move table; historical power/accuracy may differ.',
      };
    }),
  };
}

/**
 * Pack game state from SaveData into a snapshot for chatbot context
 */
export function packGameContext(saveData: SaveData | null): GameContextSnapshot | undefined {
  if (!saveData) {
    return undefined;
  }

  // Flatten inventory sections into items (full list for tool-calling accuracy)
  const inventoryItems = saveData.inventory.flatMap((section) => section.items);

  // Build detailed party info
  const partyPokemonDetailed = (saveData.party || []).map(p => packPokemonContext(p, saveData.generation));

  return {
    fullState: saveData,
    trainerName: saveData.trainer?.name || 'Unknown',
    location: saveData.location?.name || 'Unknown Location',
    money: saveData.trainer?.money || 0,
    playtime: {
      hours: saveData.trainer?.playTime?.hours || 0,
      minutes: saveData.trainer?.playTime?.minutes || 0,
      seconds: saveData.trainer?.playTime?.seconds || 0,
    },
    badges: saveData.trainer?.badges?.filter((b) => b).length || 0,
    partyPokemon: partyPokemonDetailed.map((p) => ({
      name: p.name,
      level: p.level,
      hp: p.hp,
      maxHp: p.maxHp,
    })),
    partyPokemonDetailed,
    pokedexSeen: saveData.pokedex?.seenCount || 0,
    pokedexOwned: saveData.pokedex?.caughtCount || 0,
    pokedexSeenList: saveData.pokedex?.seenSpecies || [],
    pokedexCaughtList: saveData.pokedex?.caughtSpecies || [],
    inventory: inventoryItems.map((item) => ({
      name: item.name || 'Unknown Item',
      quantity: item.quantity || 0,
    })),
    progressFacts: saveData.progressFacts?.facts.map((fact) => ({
      label: fact.label,
      value: fact.value,
      description: fact.description,
      nextStep: fact.nextStep,
    })),
    battleFrontierSummary: saveData.battleFrontier ? `${saveData.battleFrontier.battlePoints} BP; silver symbols: ${saveData.battleFrontier.facilities.some(f => f.silver === null) ? "unknown" : saveData.battleFrontier.facilities.filter(f => f.silver === true).length}; gold symbols: ${saveData.battleFrontier.facilities.some(f => f.gold === null) ? "unknown" : saveData.battleFrontier.facilities.filter(f => f.gold === true).length}. Details: get_game_state section=battleFrontier.` : undefined,
    gameTitle: `Pokémon ${saveData.game?.toUpperCase() || 'Unknown'}`,
    timestamp: Date.now(),
  };
}

/**
 * Check if two contexts are substantially the same (for deduplication)
 */
export function areContextsEqual(
  ctx1: GameContextSnapshot,
  ctx2: GameContextSnapshot
): boolean {
  return (
    ctx1.trainerName === ctx2.trainerName &&
    ctx1.location === ctx2.location &&
    ctx1.money === ctx2.money &&
    ctx1.badges === ctx2.badges &&
    ctx1.pokedexOwned === ctx2.pokedexOwned &&
    ctx1.battleFrontierSummary === ctx2.battleFrontierSummary &&
    JSON.stringify(ctx1.progressFacts ?? []) === JSON.stringify(ctx2.progressFacts ?? []) &&
    ctx1.partyPokemon.length === ctx2.partyPokemon.length &&
    ctx1.partyPokemon.every(
      (p, i) =>
        p.name === ctx2.partyPokemon[i].name &&
        p.level === ctx2.partyPokemon[i].level
    )
  );
}

/**
 * Snapshot game context before saving conversation (for optional persistence)
 */
export function snapshotContextForStorage(
  context: GameContextSnapshot
): Omit<GameContextSnapshot, 'screenshot'> {
  const { screenshot, fullState, ...rest } = context;
  return rest;
}
