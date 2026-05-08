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
import { getGen1ItemName } from "../data/items";
import { getGen1Location } from "../data/locations";

// Gen 1 Memory Offsets
const OFFSETS = {
  PLAYER_NAME: 0x2598,
  RIVAL_NAME: 0x25f6,
  MONEY: 0x25f3,
  BADGES: 0x2602,
  CURRENT_MAP: 0x2613,
  PLAY_TIME_HOURS: 0x2ced,
  PLAY_TIME_MINUTES: 0x2cef,
  PLAY_TIME_SECONDS: 0x2cf0,
  PARTY_COUNT: 0x2f2c,
  PARTY_SPECIES: 0x2f2d,
  PARTY_DATA: 0x2f34,
  BAG_ITEMS: 0x25c9,
  PC_ITEMS: 0x27e6,
  TRAINER_ID: 0x2605,
  // PC Box data in different banks
  CURRENT_BOX: 0x284c,
  BOX_NAMES_START: 0x284d,
};

// Pokemon data structure sizes
const PARTY_POKEMON_SIZE = 44;
const BOX_POKEMON_SIZE = 33;

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
  if (move1) moves.push({ id: move1, name: getMoveName(move1), pp: pp1 & 0x3f, maxPP: 35 });
  if (move2) moves.push({ id: move2, name: getMoveName(move2), pp: pp2 & 0x3f, maxPP: 35 });
  if (move3) moves.push({ id: move3, name: getMoveName(move3), pp: pp3 & 0x3f, maxPP: 35 });
  if (move4) moves.push({ id: move4, name: getMoveName(move4), pp: pp4 & 0x3f, maxPP: 35 });

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

function parseTrainerInfo(data: Uint8Array): TrainerInfo {
  const name = decodeGen1String(data, OFFSETS.PLAYER_NAME, 11);
  const id = readUint16BE(data, OFFSETS.TRAINER_ID);
  const money = readBCD(data, OFFSETS.MONEY, 3);
  const badgeByte = data[OFFSETS.BADGES];
  
  const badges: boolean[] = [];
  for (let i = 0; i < 8; i++) {
    badges.push((badgeByte & (1 << i)) !== 0);
  }

  const hours = data[OFFSETS.PLAY_TIME_HOURS] | (data[OFFSETS.PLAY_TIME_HOURS + 1] << 8);
  const minutes = data[OFFSETS.PLAY_TIME_MINUTES];
  const seconds = data[OFFSETS.PLAY_TIME_SECONDS];

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

function parseParty(data: Uint8Array): Pokemon[] {
  const partyCount = data[OFFSETS.PARTY_COUNT];
  const party: Pokemon[] = [];

  for (let i = 0; i < Math.min(partyCount, 6); i++) {
    const pokemon = parsePartyPokemon(data, OFFSETS.PARTY_DATA + i * PARTY_POKEMON_SIZE);
    if (pokemon) {
      // Parse nickname (located after all party data)
      const nicknameOffset = OFFSETS.PARTY_DATA + 6 * PARTY_POKEMON_SIZE + 6 * 11 + i * 11;
      pokemon.nickname = decodeGen1String(data, nicknameOffset, 11);
      if (!pokemon.nickname || pokemon.nickname === pokemon.speciesName.toUpperCase()) {
        pokemon.nickname = pokemon.speciesName;
      }
      // Parse OT name
      const otOffset = OFFSETS.PARTY_DATA + 6 * PARTY_POKEMON_SIZE + i * 11;
      pokemon.originalTrainer = decodeGen1String(data, otOffset, 11);
      party.push(pokemon);
    }
  }

  return party;
}

function parseInventory(data: Uint8Array): InventorySection[] {
  const bagItems: InventoryItem[] = [];
  const bagCount = data[OFFSETS.BAG_ITEMS];
  
  for (let i = 0; i < Math.min(bagCount, 20); i++) {
    const itemId = data[OFFSETS.BAG_ITEMS + 1 + i * 2];
    const quantity = data[OFFSETS.BAG_ITEMS + 2 + i * 2];
    if (itemId !== 0xff && itemId !== 0) {
      bagItems.push({
        id: itemId,
        name: getGen1ItemName(itemId),
        quantity,
      });
    }
  }

  const pcItems: InventoryItem[] = [];
  const pcCount = data[OFFSETS.PC_ITEMS];
  
  for (let i = 0; i < Math.min(pcCount, 50); i++) {
    const itemId = data[OFFSETS.PC_ITEMS + 1 + i * 2];
    const quantity = data[OFFSETS.PC_ITEMS + 2 + i * 2];
    if (itemId !== 0xff && itemId !== 0) {
      pcItems.push({
        id: itemId,
        name: getGen1ItemName(itemId),
        quantity,
      });
    }
  }

  return [
    { name: "Bag", items: bagItems },
    { name: "PC Storage", items: pcItems },
  ];
}

function parseLocation(data: Uint8Array): LocationInfo {
  const mapId = data[OFFSETS.CURRENT_MAP];
  return {
    mapId,
    name: getGen1Location(mapId),
    areaType: mapId <= 10 ? "town" : mapId <= 36 ? "route" : "building",
  };
}

function parsePCBoxes(data: Uint8Array): PCBox[] {
  // Gen 1 PC boxes are stored in banks and are complex to parse fully
  // For now, return empty boxes as placeholder
  const boxes: PCBox[] = [];
  for (let i = 0; i < 12; i++) {
    boxes.push({
      name: `Box ${i + 1}`,
      pokemon: [],
      capacity: 20,
    });
  }
  return boxes;
}

export function parseGen1Save(data: Uint8Array): SaveData {
  // Detect if it's Yellow by checking certain memory locations
  const isYellow = false; // Detection logic can be added

  const game: GameVersion = isYellow ? "yellow" : "red";

  return {
    generation: 1,
    game,
    trainer: parseTrainerInfo(data),
    party: parseParty(data),
    pcBoxes: parsePCBoxes(data),
    inventory: parseInventory(data),
    location: parseLocation(data),
    valid: true,
    rawSize: data.length,
  };
}
