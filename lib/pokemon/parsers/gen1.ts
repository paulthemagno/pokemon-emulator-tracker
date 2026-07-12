// Gen 1 Save File Parser (Red, Blue, Yellow)
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
  getStatusCondition,
} from "../utils";
import { getSpeciesName } from "../data/species";
import { getMoveName } from "../data/moves";
import { decodePackedMovePP } from "../data/move-pp";
import { getGen1ItemName } from "../data/items";
import { getGen1MapLandmark } from "../data/gen1-map-landmarks";
import { getGen1Location } from "../data/locations";
import { parseEventProgress } from "../events";
import { GEN1_EVENT_FLAGS } from "../knowledge/event-flags";
import { GEN1_INVENTORY_LAYOUT, GEN1_YELLOW_INVENTORY_LAYOUT } from "../knowledge/inventory-layouts";
import { GEN1_SAVE_LAYOUTS, type Gen1SaveLayout } from "../knowledge/save-layouts";
import { buildProgressFacts } from "../progress-facts";

// Pokemon data structure sizes
const PARTY_POKEMON_SIZE = 44;
const BOX_POKEMON_SIZE = 33;
const GEN1_NUM_SPECIES = 151;
const BOX_CAPACITY = 20;
const BOX_RECORD_SIZE = 0x462;

function parseGen1Move(id: number, rawPP: number): Move {
  return { id, name: getMoveName(id), ...decodePackedMovePP(rawPP, id, 1) };
}

// Species index conversion (Gen 1 uses internal indices)
const GEN1_INDEX_TO_NATIONAL: Record<number, number> = {
  0x01: 112, // Rhydon
  0x02: 115, // Kangaskhan
  0x03: 32,  // Nidoran♂
  0x04: 35,  // Clefairy
  0x05: 21,  // Spearow
  0x06: 100, // Voltorb
  0x07: 34,  // Nidoking
  0x08: 80,  // Slowbro
  0x09: 2,   // Ivysaur
  0x0a: 103, // Exeggutor
  0x0b: 108, // Lickitung
  0x0c: 102, // Exeggcute
  0x0d: 88,  // Grimer
  0x0e: 94,  // Gengar
  0x0f: 29,  // Nidoran♀
  0x10: 31,  // Nidoqueen
  0x11: 104, // Cubone
  0x12: 111, // Rhyhorn
  0x13: 131, // Lapras
  0x14: 59,  // Arcanine
  0x15: 151, // Mew
  0x16: 130, // Gyarados
  0x17: 90,  // Shellder
  0x18: 72,  // Tentacool
  0x19: 92,  // Gastly
  0x1a: 123, // Scyther
  0x1b: 120, // Staryu
  0x1c: 9,   // Blastoise
  0x1d: 127, // Pinsir
  0x1e: 114, // Tangela
  0x21: 58,  // Growlithe
  0x22: 95,  // Onix
  0x23: 22,  // Fearow
  0x24: 16,  // Pidgey
  0x25: 79,  // Slowpoke
  0x26: 64,  // Kadabra
  0x27: 75,  // Graveler
  0x28: 113, // Chansey
  0x29: 67,  // Machoke
  0x2a: 122, // Mr. Mime
  0x2b: 106, // Hitmonlee
  0x2c: 107, // Hitmonchan
  0x2d: 24,  // Arbok
  0x2e: 47,  // Parasect
  0x2f: 54,  // Psyduck
  0x30: 96,  // Drowzee
  0x31: 76,  // Golem
  0x33: 126, // Magmar
  0x35: 125, // Electabuzz
  0x36: 82,  // Magneton
  0x37: 109, // Koffing
  0x39: 56,  // Mankey
  0x3a: 86,  // Seel
  0x3b: 50,  // Diglett
  0x3c: 128, // Tauros
  0x40: 83,  // Farfetch'd
  0x41: 48,  // Venonat
  0x42: 149, // Dragonite
  0x46: 84,  // Doduo
  0x47: 60,  // Poliwag
  0x48: 124, // Jynx
  0x49: 146, // Moltres
  0x4a: 144, // Articuno
  0x4b: 145, // Zapdos
  0x4c: 132, // Ditto
  0x4d: 52,  // Meowth
  0x4e: 98,  // Krabby
  0x52: 37,  // Vulpix
  0x53: 38,  // Ninetales
  0x54: 25,  // Pikachu
  0x55: 26,  // Raichu
  0x58: 147, // Dratini
  0x59: 148, // Dragonair
  0x5a: 140, // Kabuto
  0x5b: 141, // Kabutops
  0x5c: 116, // Horsea
  0x5d: 117, // Seadra
  0x60: 27,  // Sandshrew
  0x61: 28,  // Sandslash
  0x62: 138, // Omanyte
  0x63: 139, // Omastar
  0x64: 39,  // Jigglypuff
  0x65: 40,  // Wigglytuff
  0x66: 133, // Eevee
  0x67: 136, // Flareon
  0x68: 135, // Jolteon
  0x69: 134, // Vaporeon
  0x6a: 66,  // Machop
  0x6b: 41,  // Zubat
  0x6c: 23,  // Ekans
  0x6d: 46,  // Paras
  0x6e: 61,  // Poliwhirl
  0x6f: 62,  // Poliwrath
  0x70: 13,  // Weedle
  0x71: 14,  // Kakuna
  0x72: 15,  // Beedrill
  0x74: 85,  // Dodrio
  0x75: 57,  // Primeape
  0x76: 51,  // Dugtrio
  0x77: 49,  // Venomoth
  0x78: 87,  // Dewgong
  0x7b: 10,  // Caterpie
  0x7c: 11,  // Metapod
  0x7d: 12,  // Butterfree
  0x7e: 68,  // Machamp
  0x80: 55,  // Golduck
  0x81: 97,  // Hypno
  0x82: 42,  // Golbat
  0x83: 150, // Mewtwo
  0x84: 143, // Snorlax
  0x85: 129, // Magikarp
  0x88: 89,  // Muk
  0x8a: 99,  // Kingler
  0x8b: 91,  // Cloyster
  0x8d: 101, // Electrode
  0x8e: 36,  // Clefable
  0x8f: 110, // Weezing
  0x90: 53,  // Persian
  0x91: 105, // Marowak
  0x93: 93,  // Haunter
  0x94: 63,  // Abra
  0x95: 65,  // Alakazam
  0x96: 17,  // Pidgeotto
  0x97: 18,  // Pidgeot
  0x98: 121, // Starmie
  0x99: 1,   // Bulbasaur
  0x9a: 3,   // Venusaur
  0x9b: 73,  // Tentacruel
  0x9d: 118, // Goldeen
  0x9e: 119, // Seaking
  0xa3: 77,  // Ponyta
  0xa4: 78,  // Rapidash
  0xa5: 19,  // Rattata
  0xa6: 20,  // Raticate
  0xa7: 33,  // Nidorino
  0xa8: 30,  // Nidorina
  0xa9: 74,  // Geodude
  0xaa: 137, // Porygon
  0xab: 142, // Aerodactyl
  0xad: 81,  // Magnemite
  0xb0: 4,   // Charmander
  0xb1: 7,   // Squirtle
  0xb2: 5,   // Charmeleon
  0xb3: 8,   // Wartortle
  0xb4: 6,   // Charizard
  0xb9: 43,  // Oddish
  0xba: 44,  // Gloom
  0xbb: 45,  // Vileplume
  0xbc: 69,  // Bellsprout
  0xbd: 70,  // Weepinbell
  0xbe: 71,  // Victreebel
};

function convertSpeciesIndex(gen1Index: number): number {
  return GEN1_INDEX_TO_NATIONAL[gen1Index] || 0;
}

function parseSpeciesFlagArray(data: Uint8Array, offset: number, speciesCount: number): number[] {
  const species: number[] = [];

  for (let nationalDex = 1; nationalDex <= speciesCount; nationalDex++) {
    const bitIndex = nationalDex - 1;
    const byte = data[offset + Math.floor(bitIndex / 8)];
    if ((byte & (1 << (bitIndex % 8))) !== 0) {
      species.push(nationalDex);
    }
  }

  return species;
}

function detectGameVersion(filename = ""): GameVersion {
  const lowerFilename = filename.toLowerCase();
  if (/\byellow\b/.test(lowerFilename)) return "yellow";
  if (/\bblue\b/.test(lowerFilename)) return "blue";
  return "red";
}

function parsePartyPokemon(data: Uint8Array, offset: number): Pokemon | null {
  const speciesIndex = data[offset];
  if (speciesIndex === 0 || speciesIndex === 0xff) return null;

  const species = convertSpeciesIndex(speciesIndex);
  const currentHP = readUint16BE(data, offset + 1);
  const level = data[offset + 3];
  const status = data[offset + 4];
  const type1 = data[offset + 5];
  const type2 = data[offset + 6];
  const catchRate = data[offset + 7];
  const move1 = data[offset + 8];
  const move2 = data[offset + 9];
  const move3 = data[offset + 10];
  const move4 = data[offset + 11];
  const otId = readUint16BE(data, offset + 12);
  const experience = (data[offset + 14] << 16) | (data[offset + 15] << 8) | data[offset + 16];
  const hpEV = readUint16BE(data, offset + 17);
  const attackEV = readUint16BE(data, offset + 19);
  const defenseEV = readUint16BE(data, offset + 21);
  const speedEV = readUint16BE(data, offset + 23);
  const specialEV = readUint16BE(data, offset + 25);
  const ivs = readUint16BE(data, offset + 27);
  const pp1 = data[offset + 29];
  const pp2 = data[offset + 30];
  const pp3 = data[offset + 31];
  const pp4 = data[offset + 32];
  const levelAgain = data[offset + 33];
  const maxHP = readUint16BE(data, offset + 34);
  const attack = readUint16BE(data, offset + 36);
  const defense = readUint16BE(data, offset + 38);
  const speed = readUint16BE(data, offset + 40);
  const special = readUint16BE(data, offset + 42);

  const moves: Move[] = [];
  if (move1) moves.push(parseGen1Move(move1, pp1));
  if (move2) moves.push(parseGen1Move(move2, pp2));
  if (move3) moves.push(parseGen1Move(move3, pp3));
  if (move4) moves.push(parseGen1Move(move4, pp4));

  return {
    species,
    speciesName: getSpeciesName(species),
    nickname: "", // Will be set from nickname array
    level: levelAgain || level,
    currentHP,
    maxHP,
    experience,
    moves,
    stats: {
      hp: maxHP,
      attack,
      defense,
      speed,
      special,
    },
    evs: {
      hp: hpEV,
      attack: attackEV,
      defense: defenseEV,
      speed: speedEV,
      special: specialEV,
    },
    originalTrainer: "",
    originalTrainerID: otId,
    status: getStatusCondition(status),
  };
}

function parseBoxPokemon(data: Uint8Array, offset: number): Pokemon | null {
  if (offset + BOX_POKEMON_SIZE > data.length) return null;

  const speciesIndex = data[offset];
  if (speciesIndex === 0 || speciesIndex === 0xff) return null;

  const species = convertSpeciesIndex(speciesIndex);
  if (!species) return null;

  const currentHP = readUint16BE(data, offset + 1);
  const level = data[offset + 3];
  const status = data[offset + 4];
  const move1 = data[offset + 8];
  const move2 = data[offset + 9];
  const move3 = data[offset + 10];
  const move4 = data[offset + 11];
  const otId = readUint16BE(data, offset + 12);
  const experience = (data[offset + 14] << 16) | (data[offset + 15] << 8) | data[offset + 16];
  const hpEV = readUint16BE(data, offset + 17);
  const attackEV = readUint16BE(data, offset + 19);
  const defenseEV = readUint16BE(data, offset + 21);
  const speedEV = readUint16BE(data, offset + 23);
  const specialEV = readUint16BE(data, offset + 25);
  const ivs = readUint16BE(data, offset + 27);
  const pp1 = data[offset + 29];
  const pp2 = data[offset + 30];
  const pp3 = data[offset + 31];
  const pp4 = data[offset + 32];

  const moves: Move[] = [];
  if (move1) moves.push(parseGen1Move(move1, pp1));
  if (move2) moves.push(parseGen1Move(move2, pp2));
  if (move3) moves.push(parseGen1Move(move3, pp3));
  if (move4) moves.push(parseGen1Move(move4, pp4));

  return {
    species,
    speciesName: getSpeciesName(species),
    nickname: "",
    level,
    currentHP,
    maxHP: 0,
    experience,
    moves,
    stats: {
      hp: 0,
      attack: 0,
      defense: 0,
      speed: 0,
      special: 0,
    },
    evs: {
      hp: hpEV,
      attack: attackEV,
      defense: defenseEV,
      speed: speedEV,
      special: specialEV,
    },
    originalTrainer: "",
    originalTrainerID: otId,
    status: getStatusCondition(status),
  };
}

function getGen1SaveLayout(game: GameVersion): Gen1SaveLayout {
  return game === "yellow" ? GEN1_SAVE_LAYOUTS.yellow : GEN1_SAVE_LAYOUTS.redBlue;
}

function parseTrainerInfo(data: Uint8Array, layout: Gen1SaveLayout): TrainerInfo {
  const offsets = layout.offsets;
  const name = decodeGen1String(data, offsets.playerName, 11);
  const id = readUint16BE(data, offsets.trainerId);
  const money = readBCD(data, offsets.money, 3);
  const badgeByte = data[offsets.badges];
  
  const badges: boolean[] = [];
  for (let i = 0; i < 8; i++) {
    badges.push((badgeByte & (1 << i)) !== 0);
  }

  const hours = data[offsets.playTimeHours] | (data[offsets.playTimeHours + 1] << 8);
  const minutes = data[offsets.playTimeMinutes];
  const seconds = data[offsets.playTimeSeconds];

  return {
    name,
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

function parseParty(data: Uint8Array, layout: Gen1SaveLayout): Pokemon[] {
  const partyCount = data[layout.offsets.partyCount];
  const party: Pokemon[] = [];

  for (let i = 0; i < Math.min(partyCount, 6); i++) {
    const pokemon = parsePartyPokemon(data, layout.offsets.partyData + i * PARTY_POKEMON_SIZE);
    if (pokemon) {
      // Parse nickname (located after all party data)
      const nicknameOffset = layout.offsets.partyData + 6 * PARTY_POKEMON_SIZE + 6 * 11 + i * 11;
      pokemon.nickname = decodeGen1String(data, nicknameOffset, 11);
      if (!pokemon.nickname || pokemon.nickname === pokemon.speciesName.toUpperCase()) {
        pokemon.nickname = pokemon.speciesName;
      }
      // Parse OT name
      const otOffset = layout.offsets.partyData + 6 * PARTY_POKEMON_SIZE + i * 11;
      pokemon.originalTrainer = decodeGen1String(data, otOffset, 11);
      party.push(pokemon);
    }
  }

  return party;
}

function parseInventory(data: Uint8Array, game: GameVersion): InventorySection[] {
  const layout = game === "yellow" ? GEN1_YELLOW_INVENTORY_LAYOUT : GEN1_INVENTORY_LAYOUT;
  return layout.pockets.map((pocket) => {
    const items: InventoryItem[] = [];
    const itemCount = data[pocket.offset];

    for (let i = 0; i < Math.min(itemCount, pocket.count); i++) {
      const itemId = data[pocket.offset + 1 + i * 2];
      const quantity = data[pocket.offset + 2 + i * 2];
      if (itemId !== 0xff && itemId !== 0) {
        items.push({
          id: itemId,
          name: getGen1ItemName(itemId),
          quantity,
          pocket: pocket.name,
        });
      }
    }

    return { name: pocket.name, items };
  });
}

function parseLocation(data: Uint8Array, layout: Gen1SaveLayout): LocationInfo {
  const mapId = data[layout.offsets.currentMap];
  const landmark = getGen1MapLandmark(mapId);
  return {
    mapId,
    name: landmark?.name ?? getGen1Location(mapId),
    areaType: mapId <= 10 ? "town" : mapId <= 36 ? "route" : "building",
  };
}

function getCurrentBoxIndex(data: Uint8Array, layout: Gen1SaveLayout): number {
  const raw = data[layout.offsets.currentBoxNumber] ?? 0;
  const normalized = raw & 0x7f;
  return normalized >= 0 && normalized < 12 ? normalized : 0;
}

function parsePCBoxRecord(data: Uint8Array, offset: number): Pokemon[] {
  if (offset + BOX_RECORD_SIZE > data.length) return [];

  const count = data[offset];
  if (count > BOX_CAPACITY) return [];

  const pokemon: Pokemon[] = [];
  const pokemonDataOffset = offset + 0x16;
  const otNamesOffset = offset + 0x2aa;
  const nicknamesOffset = offset + 0x386;

  for (let slot = 0; slot < count; slot++) {
    const listedSpecies = data[offset + 1 + slot];
    if (listedSpecies === 0xff || listedSpecies === 0) break;

    const parsed = parseBoxPokemon(data, pokemonDataOffset + slot * BOX_POKEMON_SIZE);
    if (!parsed) continue;

    const nickname = decodeGen1String(data, nicknamesOffset + slot * 11, 11);
    parsed.nickname = nickname || parsed.speciesName;
    const otName = decodeGen1String(data, otNamesOffset + slot * 11, 11);
    parsed.originalTrainer = otName;
    pokemon.push(parsed);
  }

  return pokemon;
}

function parsePCBoxes(data: Uint8Array, layout: Gen1SaveLayout): PCBox[] {
  const currentBoxIndex = getCurrentBoxIndex(data, layout);
  const boxes: PCBox[] = [];

  for (let i = 0; i < 12; i++) {
    const offset = i === currentBoxIndex ? layout.offsets.currentBoxData : layout.boxOffsets[i];
    boxes.push({
      name: `Box ${i + 1}`,
      pokemon: parsePCBoxRecord(data, offset),
      capacity: BOX_CAPACITY,
      isCurrent: i === currentBoxIndex,
    });
  }

  return boxes;
}

function parsePokedexProgress(data: Uint8Array, layout: Gen1SaveLayout): SaveData["pokedex"] {
  const caughtSpecies = parseSpeciesFlagArray(data, layout.offsets.pokedexOwned, GEN1_NUM_SPECIES);
  const seenSpecies = parseSpeciesFlagArray(data, layout.offsets.pokedexSeen, GEN1_NUM_SPECIES);

  return {
    seenSpecies,
    caughtSpecies,
    seenCount: seenSpecies.length,
    caughtCount: caughtSpecies.length,
    source: "save",
  };
}

function parseGameEvents(data: Uint8Array, game: GameVersion): SaveData["events"] {
  const layout = game === "yellow" ? GEN1_EVENT_FLAGS.yellow : GEN1_EVENT_FLAGS.redBlue;
  return parseEventProgress(data, layout, "save");
}

export function parseGen1Save(data: Uint8Array, filename = ""): SaveData {
  const game = detectGameVersion(filename);
  const layout = getGen1SaveLayout(game);
  const events = parseGameEvents(data, game);

  return {
    generation: 1,
    game,
    trainer: parseTrainerInfo(data, layout),
    pokedex: parsePokedexProgress(data, layout),
    party: parseParty(data, layout),
    pcBoxes: parsePCBoxes(data, layout),
    inventory: parseInventory(data, game),
    events,
    progressFacts: buildProgressFacts({
      generation: 1,
      game,
      source: "save",
      events,
      raw: {
        playerStarter: data[layout.offsets.playerStarter],
        oaksLabScript: data[layout.offsets.oaksLabScript],
        hallOfFameCount: data[layout.offsets.hallOfFameCount],
      },
    }),
    location: parseLocation(data, layout),
    valid: true,
    rawSize: data.length,
  };
}
