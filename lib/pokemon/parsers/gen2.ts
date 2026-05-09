// Gen 2 Save File Parser (Gold, Silver, Crystal)
// Save file size: 32768 bytes (32 KB)

import type {
  SaveData,
  Pokemon,
  TrainerInfo,
  PCBox,
  InventorySection,
  InventoryItem,
  LocationInfo,
  Move,
  GameVersion,
} from "../types";
import {
  decodeGen1String,
  readBCD,
  readUint16BE,
  readUint16LE,
  getStatusCondition,
} from "../utils";
import { getSpeciesName } from "../data/species";
import { getMoveName } from "../data/moves";
import { getGen2ItemName } from "../data/items";
import { getGen2Location } from "../data/locations";

// Gen 2 Memory Offsets (English versions)
const OFFSETS = {
  // Gold/Silver offsets
  GS: {
    PLAYER_GENDER: -1,
    PLAYER_NAME: 0x200b,
    TRAINER_ID: 0x2009,
    MONEY: 0x23db,
    BADGES_JOHTO: 0x23e4,
    BADGES_KANTO: 0x23e5,
    PLAY_TIME: 0x2053,
    PARTY_COUNT: 0x288a,
    PARTY_SPECIES: 0x288b,
    PARTY_DATA: 0x2892,
    CURRENT_MAP_GROUP: 0x2000,
    CURRENT_MAP: 0x2001,
    BAG_ITEMS: 0x23e6,
    BAG_KEY_ITEMS: 0x2417,
    BAG_BALLS: 0x2449,
  },
  // Crystal offsets (slightly different)
  CRYSTAL: {
    PLAYER_GENDER: 0x2000,
    PLAYER_NAME: 0x200b,
    TRAINER_ID: 0x2009,
    MONEY: 0x23dc,
    BADGES_JOHTO: 0x23e5,
    BADGES_KANTO: 0x23e6,
    PLAY_TIME: 0x2054,
    PARTY_COUNT: 0x2865,
    PARTY_SPECIES: 0x2866,
    PARTY_DATA: 0x286d,
    CURRENT_MAP_GROUP: 0x2000,
    CURRENT_MAP: 0x2001,
    BAG_ITEMS: 0x23e7,
    BAG_KEY_ITEMS: 0x2418,
    BAG_BALLS: 0x244a,
  },
};

const PARTY_POKEMON_SIZE = 48;
const BOX_POKEMON_SIZE = 32;
const BOX_CAPACITY = 20;
const BOX_RECORD_SIZE = 1 + BOX_CAPACITY + 1 + BOX_CAPACITY * BOX_POKEMON_SIZE + BOX_CAPACITY * 11 + BOX_CAPACITY * 11;

function parsePartyPokemon(data: Uint8Array, offset: number): Pokemon | null {
  const species = data[offset];
  if (species === 0 || species === 0xff) return null;

  const heldItem = data[offset + 1];
  const move1 = data[offset + 2];
  const move2 = data[offset + 3];
  const move3 = data[offset + 4];
  const move4 = data[offset + 5];
  const otId = readUint16BE(data, offset + 6);
  const experience = (data[offset + 8] << 16) | (data[offset + 9] << 8) | data[offset + 10];
  const hpEV = readUint16BE(data, offset + 11);
  const attackEV = readUint16BE(data, offset + 13);
  const defenseEV = readUint16BE(data, offset + 15);
  const speedEV = readUint16BE(data, offset + 17);
  const specialEV = readUint16BE(data, offset + 19);
  const ivs = readUint16BE(data, offset + 21);
  const pp1 = data[offset + 23];
  const pp2 = data[offset + 24];
  const pp3 = data[offset + 25];
  const pp4 = data[offset + 26];
  const happiness = data[offset + 27];
  const pokerus = data[offset + 28];
  const caughtData = readUint16LE(data, offset + 29);
  const level = data[offset + 31];
  const status = data[offset + 32];
  const currentHP = readUint16BE(data, offset + 34);
  const maxHP = readUint16BE(data, offset + 36);
  const attack = readUint16BE(data, offset + 38);
  const defense = readUint16BE(data, offset + 40);
  const speed = readUint16BE(data, offset + 42);
  const specialAttack = readUint16BE(data, offset + 44);
  const specialDefense = readUint16BE(data, offset + 46);

  // Parse IVs from packed format
  const attackIV = (ivs >> 12) & 0x0f;
  const defenseIV = (ivs >> 8) & 0x0f;
  const speedIV = (ivs >> 4) & 0x0f;
  const specialIV = ivs & 0x0f;
  const hpIV = ((attackIV & 1) << 3) | ((defenseIV & 1) << 2) | ((speedIV & 1) << 1) | (specialIV & 1);

  // Determine if shiny (Gen 2 shiny calculation)
  const isShiny = attackIV === 10 && defenseIV === 10 && speedIV === 10 && specialIV === 10;

  const moves: Move[] = [];
  if (move1) moves.push({ id: move1, name: getMoveName(move1), pp: pp1 & 0x3f, maxPP: 35 });
  if (move2) moves.push({ id: move2, name: getMoveName(move2), pp: pp2 & 0x3f, maxPP: 35 });
  if (move3) moves.push({ id: move3, name: getMoveName(move3), pp: pp3 & 0x3f, maxPP: 35 });
  if (move4) moves.push({ id: move4, name: getMoveName(move4), pp: pp4 & 0x3f, maxPP: 35 });

  return {
    species,
    speciesName: getSpeciesName(species),
    nickname: "",
    level,
    currentHP,
    maxHP,
    experience,
    moves,
    stats: {
      hp: maxHP,
      attack,
      defense,
      speed,
      specialAttack,
      specialDefense,
    },
    ivs: {
      hp: hpIV,
      attack: attackIV,
      defense: defenseIV,
      speed: speedIV,
      specialAttack: specialIV,
      specialDefense: specialIV,
    },
    evs: {
      hp: hpEV,
      attack: attackEV,
      defense: defenseEV,
      speed: speedEV,
      specialAttack: specialEV,
      specialDefense: specialEV,
    },
    originalTrainer: "",
    originalTrainerID: otId,
    heldItem,
    heldItemName: getGen2ItemName(heldItem),
    happiness,
    status: getStatusCondition(status),
    isShiny,
  };
}

function parseBoxPokemon(
  data: Uint8Array,
  offset: number,
  nickname: string,
  originalTrainer: string
): Pokemon | null {
  const species = data[offset];
  if (species === 0 || species === 0xff || species > 251) return null;

  const heldItem = data[offset + 1];
  const moves: Move[] = [];
  for (let i = 0; i < 4; i++) {
    const moveId = data[offset + 2 + i];
    const pp = data[offset + 23 + i];
    if (moveId) {
      moves.push({ id: moveId, name: getMoveName(moveId), pp: pp & 0x3f, maxPP: 35 });
    }
  }

  const otId = readUint16BE(data, offset + 6);
  const experience = (data[offset + 8] << 16) | (data[offset + 9] << 8) | data[offset + 10];
  const hpEV = readUint16BE(data, offset + 11);
  const attackEV = readUint16BE(data, offset + 13);
  const defenseEV = readUint16BE(data, offset + 15);
  const speedEV = readUint16BE(data, offset + 17);
  const specialEV = readUint16BE(data, offset + 19);
  const ivs = readUint16BE(data, offset + 21);
  const happiness = data[offset + 27];
  const level = data[offset + 31] || calculateLevelFromExperience(experience);

  const attackIV = (ivs >> 12) & 0x0f;
  const defenseIV = (ivs >> 8) & 0x0f;
  const speedIV = (ivs >> 4) & 0x0f;
  const specialIV = ivs & 0x0f;
  const hpIV = ((attackIV & 1) << 3) | ((defenseIV & 1) << 2) | ((speedIV & 1) << 1) | (specialIV & 1);
  const speciesName = getSpeciesName(species);

  return {
    species,
    speciesName,
    nickname: nickname || speciesName,
    level,
    currentHP: 0,
    maxHP: 0,
    experience,
    moves,
    stats: { hp: 0, attack: 0, defense: 0, speed: 0, specialAttack: 0, specialDefense: 0 },
    ivs: {
      hp: hpIV,
      attack: attackIV,
      defense: defenseIV,
      speed: speedIV,
      specialAttack: specialIV,
      specialDefense: specialIV,
    },
    evs: {
      hp: hpEV,
      attack: attackEV,
      defense: defenseEV,
      speed: speedEV,
      specialAttack: specialEV,
      specialDefense: specialEV,
    },
    originalTrainer,
    originalTrainerID: otId,
    heldItem,
    heldItemName: getGen2ItemName(heldItem),
    happiness,
    isShiny: attackIV === 10 && defenseIV === 10 && speedIV === 10 && specialIV === 10,
  };
}

function calculateLevelFromExperience(experience: number): number {
  if (experience < 8) return 1;
  return Math.min(100, Math.max(1, Math.floor(Math.cbrt(experience))));
}

function parseTrainerInfo(data: Uint8Array, offsets: typeof OFFSETS.GS): TrainerInfo {
  const name = decodeGen1String(data, offsets.PLAYER_NAME, 11);
  const gender = offsets.PLAYER_GENDER < 0
    ? undefined
    : (data[offsets.PLAYER_GENDER] & 1) === 1 ? "female" : "male";
  const id = readUint16BE(data, offsets.TRAINER_ID);
  const money = readBCD(data, offsets.MONEY, 3);
  
  const johtoBadges = data[offsets.BADGES_JOHTO];
  const kantoBadges = data[offsets.BADGES_KANTO];
  
  const badges: boolean[] = [];
  // Johto badges (8)
  for (let i = 0; i < 8; i++) {
    badges.push((johtoBadges & (1 << i)) !== 0);
  }
  // Kanto badges (8)
  for (let i = 0; i < 8; i++) {
    badges.push((kantoBadges & (1 << i)) !== 0);
  }

  const hours = data[offsets.PLAY_TIME] | (data[offsets.PLAY_TIME + 1] << 8);
  const minutes = data[offsets.PLAY_TIME + 2];
  const seconds = data[offsets.PLAY_TIME + 3];

  return {
    name,
    gender,
    id,
    money,
    badges,
    badgeCount: badges.filter(b => b).length,
    playTime: {
      hours,
      minutes,
      seconds,
    },
  };
}

function parseParty(data: Uint8Array, offsets: typeof OFFSETS.GS): Pokemon[] {
  const partyCount = data[offsets.PARTY_COUNT];
  const party: Pokemon[] = [];

  for (let i = 0; i < Math.min(partyCount, 6); i++) {
    const pokemon = parsePartyPokemon(data, offsets.PARTY_DATA + i * PARTY_POKEMON_SIZE);
    if (pokemon) {
      // Parse nickname (after all party data + OT names)
      const nicknameOffset = offsets.PARTY_DATA + 6 * PARTY_POKEMON_SIZE + 6 * 11 + i * 11;
      pokemon.nickname = decodeGen1String(data, nicknameOffset, 11);
      if (!pokemon.nickname || pokemon.nickname === pokemon.speciesName.toUpperCase()) {
        pokemon.nickname = pokemon.speciesName;
      }
      // Parse OT name
      const otOffset = offsets.PARTY_DATA + 6 * PARTY_POKEMON_SIZE + i * 11;
      pokemon.originalTrainer = decodeGen1String(data, otOffset, 11);
      party.push(pokemon);
    }
  }

  return party;
}

function parseInventory(data: Uint8Array, offsets: typeof OFFSETS.GS): InventorySection[] {
  const sections: InventorySection[] = [];

  // Regular items
  const bagItems: InventoryItem[] = [];
  const itemCount = data[offsets.BAG_ITEMS];
  for (let i = 0; i < Math.min(itemCount, 20); i++) {
    const itemId = data[offsets.BAG_ITEMS + 1 + i * 2];
    const quantity = data[offsets.BAG_ITEMS + 2 + i * 2];
    if (itemId !== 0xff && itemId !== 0) {
      bagItems.push({
        id: itemId,
        name: getGen2ItemName(itemId),
        quantity,
        pocket: "Items",
      });
    }
  }
  sections.push({ name: "Items", items: bagItems });

  // Key items
  const keyItems: InventoryItem[] = [];
  const keyCount = data[offsets.BAG_KEY_ITEMS];
  for (let i = 0; i < Math.min(keyCount, 26); i++) {
    const itemId = data[offsets.BAG_KEY_ITEMS + 1 + i];
    if (itemId !== 0xff && itemId !== 0) {
      keyItems.push({
        id: itemId,
        name: getGen2ItemName(itemId),
        quantity: 1,
        pocket: "Key Items",
      });
    }
  }
  sections.push({ name: "Key Items", items: keyItems });

  // Poke Balls
  const balls: InventoryItem[] = [];
  const ballCount = data[offsets.BAG_BALLS];
  for (let i = 0; i < Math.min(ballCount, 12); i++) {
    const itemId = data[offsets.BAG_BALLS + 1 + i * 2];
    const quantity = data[offsets.BAG_BALLS + 2 + i * 2];
    if (itemId !== 0xff && itemId !== 0) {
      balls.push({
        id: itemId,
        name: getGen2ItemName(itemId),
        quantity,
        pocket: "Balls",
      });
    }
  }
  sections.push({ name: "Poke Balls", items: balls });

  return sections;
}

function parseLocation(data: Uint8Array, offsets: typeof OFFSETS.GS): LocationInfo {
  const mapGroup = data[offsets.CURRENT_MAP_GROUP];
  const mapId = data[offsets.CURRENT_MAP];
  // Combine for lookup (simplified)
  return {
    mapId: mapId,
    name: getGen2Location(mapId),
    areaType: mapId <= 12 ? "town" : mapId <= 33 ? "route" : "building",
  };
}

function parsePCBoxRecord(data: Uint8Array, offset: number, name: string): PCBox | null {
  const count = data[offset];
  if (count < 0 || count > BOX_CAPACITY) return null;
  if (data[offset + 1 + count] !== 0xff) return null;

  const pokemon: Pokemon[] = [];
  const pokemonDataOffset = offset + 1 + BOX_CAPACITY + 1;
  const otNamesOffset = pokemonDataOffset + BOX_CAPACITY * BOX_POKEMON_SIZE;
  const nicknamesOffset = otNamesOffset + BOX_CAPACITY * 11;

  for (let i = 0; i < count; i++) {
    const species = data[offset + 1 + i];
    if (species === 0 || species === 0xff || species > 251) return null;

    const nickname = decodeGen1String(data, nicknamesOffset + i * 11, 11);
    const originalTrainer = decodeGen1String(data, otNamesOffset + i * 11, 11);
    const parsed = parseBoxPokemon(
      data,
      pokemonDataOffset + i * BOX_POKEMON_SIZE,
      nickname,
      originalTrainer
    );
    if (parsed) pokemon.push(parsed);
  }

  return { name, pokemon, capacity: BOX_CAPACITY };
}

function findPCBoxRecords(data: Uint8Array): PCBox[] {
  const candidates: Array<{ offset: number; box: PCBox }> = [];

  for (let offset = 0x2400; offset <= data.length - BOX_RECORD_SIZE; offset++) {
    const box = parsePCBoxRecord(data, offset, `Box ${candidates.length + 1}`);
    if (!box || box.pokemon.length === 0) continue;

    const overlapsExisting = candidates.some(
      (candidate) => Math.abs(candidate.offset - offset) < BOX_RECORD_SIZE
    );
    if (!overlapsExisting) {
      candidates.push({ offset, box });
    }
  }

  return candidates.slice(0, 14).map((candidate, index) => ({
    ...candidate.box,
    name: `Box ${index + 1}`,
  }));
}

function parsePCBoxes(data: Uint8Array): PCBox[] {
  const parsedBoxes = findPCBoxRecords(data);
  if (parsedBoxes.length > 0) return parsedBoxes;

  const boxes: PCBox[] = [];
  for (let i = 0; i < 14; i++) {
    boxes.push({
      name: `Box ${i + 1}`,
      pokemon: [],
      capacity: BOX_CAPACITY,
    });
  }
  return boxes;
}

function detectGen2Version(data: Uint8Array, filename = ""): { game: GameVersion; offsets: typeof OFFSETS.GS } {
  const lowerFilename = filename.toLowerCase();
  if (/\bcrystal\b/.test(lowerFilename)) {
    return { game: "crystal", offsets: OFFSETS.CRYSTAL };
  }
  if (/\bsilver\b/.test(lowerFilename)) {
    return { game: "silver", offsets: OFFSETS.GS };
  }
  if (/\bgold\b/.test(lowerFilename)) {
    return { game: "gold", offsets: OFFSETS.GS };
  }

  // Try to detect Crystal vs GS by checking party data validity at both offsets
  const gsPartyCount = data[OFFSETS.GS.PARTY_COUNT];
  const crystalPartyCount = data[OFFSETS.CRYSTAL.PARTY_COUNT];

  // Crystal typically has party at different offset
  if (crystalPartyCount >= 1 && crystalPartyCount <= 6) {
    const firstSpecies = data[OFFSETS.CRYSTAL.PARTY_SPECIES];
    if (firstSpecies >= 1 && firstSpecies <= 251) {
      return { game: "crystal", offsets: OFFSETS.CRYSTAL };
    }
  }

  if (gsPartyCount >= 1 && gsPartyCount <= 6) {
    const firstSpecies = data[OFFSETS.GS.PARTY_SPECIES];
    if (firstSpecies >= 1 && firstSpecies <= 251) {
      return { game: "gold", offsets: OFFSETS.GS };
    }
  }

  // Default to Gold/Silver
  return { game: "gold", offsets: OFFSETS.GS };
}

export function parseGen2Save(data: Uint8Array, filename = ""): SaveData {
  const { game, offsets } = detectGen2Version(data, filename);

  return {
    generation: 2,
    game,
    trainer: parseTrainerInfo(data, offsets),
    party: parseParty(data, offsets),
    pcBoxes: parsePCBoxes(data),
    inventory: parseInventory(data, offsets),
    location: parseLocation(data, offsets),
    valid: true,
    rawSize: data.length,
  };
}
