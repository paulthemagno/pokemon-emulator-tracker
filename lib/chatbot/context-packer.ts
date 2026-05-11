/**
 * Context packer: converts SaveData or live snapshots into game context for LLM
 */

import type { GameContextSnapshot } from './types';
import type { SaveData } from '../pokemon/types';

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
  const partyPokemonDetailed = (saveData.party || []).map((p) => ({
    name: p.nickname || p.speciesName || 'Unknown',
    species: p.speciesName || 'Unknown',
    level: p.level || 0,
    hp: p.currentHP || 0,
    maxHp: p.maxHP || 0,
    types: p.types || [],
    status: p.status || 'none',
    ability: p.abilityName,
    nature: p.natureName,
    heldItem: p.heldItemName,
    moves: (p.moves || []).map((m) => ({
      name: m.name || 'Unknown',
      type: m.type || 'Unknown',
      category: 'Physical', // Could be determined from move data
      power: m.power || undefined,
      accuracy: m.accuracy || undefined,
      pp: m.pp || 0,
      maxPp: m.maxPP || 0,
    })),
  }));

  return {
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
  const { screenshot, ...rest } = context;
  return rest;
}
