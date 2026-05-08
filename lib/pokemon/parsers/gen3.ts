// Gen 3 Parser - Ruby, Sapphire, Emerald, FireRed, LeafGreen
// Gen 3 saves are 128KB with a complex section-based structure

import {
  Pokemon,
  SaveData,
  TrainerInfo,
  GameGeneration,
  InventoryItem,
  PCBox,
} from "../types";
import {
  getGen3CharacterMap,
  decodeString,
  getSpeciesName,
  getMoveName,
  getItemName,
  getGen3LocationName,
} from "../utils";

// Gen 3 save structure constants
const SECTION_SIZE = 0x1000; // 4KB per section
const SECTION_DATA_SIZE = 0xff4; // Actual data size per section
const SECTION_COUNT = 14;
const SAVE_SLOT_SIZE = SECTION_SIZE * SECTION_COUNT; // 57344 bytes per slot

// Section IDs and their purposes
const SECTION_TRAINER_INFO = 0;
const SECTION_TEAM_ITEMS = 1;
const SECTION_GAME_STATE = 2;
const SECTION_MISC_DATA = 3;
const SECTION_RIVAL_INFO = 4;
const SECTION_PC_BUFFER_A = 5;
const SECTION_PC_BUFFER_B = 6;
const SECTION_PC_BUFFER_C = 7;
const SECTION_PC_BUFFER_D = 8;
const SECTION_PC_BUFFER_E = 9;
const SECTION_PC_BUFFER_F = 10;
const SECTION_PC_BUFFER_G = 11;
const SECTION_PC_BUFFER_H = 12;
const SECTION_PC_BUFFER_I = 13;

// Game detection signatures
const GAME_CODES = {
  RS: [0x00, 0x01], // Ruby/Sapphire
  FRLG: [0x00, 0x01], // FireRed/LeafGreen (detected by security key)
  E: [0x00, 0x01], // Emerald
};

interface Section {
  data: Uint8Array;
  id: number;
  checksum: number;
  saveIndex: number;
}

function getActiveSaveSlot(data: Uint8Array): number {
  // Compare save indices to find the most recent save
  const slot1Index = getSaveIndex(data, 0);
  const slot2Index = getSaveIndex(data, 1);
  return slot2Index > slot1Index ? 1 : 0;
}

function getSaveIndex(data: Uint8Array, slot: number): number {
  const offset = slot * SAVE_SLOT_SIZE;
  // Save index is at offset 0x0FFC in the first section
  return new DataView(data.buffer, offset + 0x0ffc, 4).getUint32(0, true);
}

function readSections(data: Uint8Array, slot: number): Map<number, Section> {
  const sections = new Map<number, Section>();
  const baseOffset = slot * SAVE_SLOT_SIZE;

  for (let i = 0; i < SECTION_COUNT; i++) {
    const sectionOffset = baseOffset + i * SECTION_SIZE;
    const sectionData = data.slice(sectionOffset, sectionOffset + SECTION_SIZE);

    const view = new DataView(sectionData.buffer, sectionData.byteOffset);
    const sectionId = view.getUint16(0x0ff4, true);
    const checksum = view.getUint16(0x0ff6, true);
    const saveIndex = view.getUint32(0x0ffc, true);

    sections.set(sectionId, {
      data: sectionData.slice(0, SECTION_DATA_SIZE),
      id: sectionId,
      checksum,
      saveIndex,
    });
  }

  return sections;
}

function detectGame(
  sections: Map<number, Section>
): "ruby" | "sapphire" | "emerald" | "firered" | "leafgreen" {
  const trainerSection = sections.get(SECTION_TRAINER_INFO);
  if (!trainerSection) return "emerald";

  const view = new DataView(
    trainerSection.data.buffer,
    trainerSection.data.byteOffset
  );

  // Check security key at offset 0xAC (Emerald) or 0xAF8 (FRLG)
  const securityKey = view.getUint32(0x00ac, true);
  const gameCode = view.getUint32(0x00, true);

  // FireRed/LeafGreen have a specific security key pattern
  if (securityKey !== 0 && (securityKey & 0xffff) !== 0) {
    // Check for FRLG specific patterns
    const frlgKey = view.getUint32(0x0af8, true);
    if (frlgKey !== 0) {
      // Distinguish between FireRed and LeafGreen by game code
      return gameCode % 2 === 0 ? "firered" : "leafgreen";
    }
  }

  // Check for Emerald's specific trainer info structure
  // Emerald has different offsets for some data
  const testValue = view.getUint16(0x0014, true);
  if (testValue > 0 && testValue < 1000) {
    return "emerald";
  }

  // Default to Ruby/Sapphire
  return "ruby";
}

function parseTrainerInfo(
  sections: Map<number, Section>,
  game: string
): TrainerInfo {
  const section = sections.get(SECTION_TRAINER_INFO);
  if (!section) {
    return {
      name: "Unknown",
      id: 0,
      secretId: 0,
      money: 0,
      playTime: { hours: 0, minutes: 0, seconds: 0 },
      badges: 0,
      gender: "male",
    };
  }

  const view = new DataView(section.data.buffer, section.data.byteOffset);
  const charMap = getGen3CharacterMap();

  // Trainer name (0x00-0x07, 7 chars + terminator)
  const nameBytes = section.data.slice(0, 7);
  const name = decodeString(nameBytes, charMap);

  // Gender (0x08)
  const genderByte = view.getUint8(0x08);
  const gender = genderByte === 0 ? "male" : "female";

  // Trainer ID (0x0A-0x0B)
  const trainerId = view.getUint16(0x0a, true);

  // Secret ID (0x0C-0x0D)
  const secretId = view.getUint16(0x0c, true);

  // Play time (0x0E-0x13)
  const hours = view.getUint16(0x0e, true);
  const minutes = view.getUint8(0x10);
  const seconds = view.getUint8(0x11);

  // Money and badges are in Section 1
  const teamSection = sections.get(SECTION_TEAM_ITEMS);
  let money = 0;
  let badges = 0;

  if (teamSection) {
    const teamView = new DataView(
      teamSection.data.buffer,
      teamSection.data.byteOffset
    );

    // Money offset varies by game
    const moneyOffset = game === "emerald" ? 0x0490 : 0x0490;
    money = teamView.getUint32(moneyOffset, true) ^ getSecurityKey(sections);

    // Badges are stored as a bitmask
    const badgeOffset = game === "emerald" ? 0x0ee8 : 0x0ee8;
    if (badgeOffset < teamSection.data.length) {
      badges = countBadges(teamView.getUint16(badgeOffset, true));
    }
  }

  return {
    name,
    id: trainerId,
    secretId,
    money,
    playTime: { hours, minutes, seconds },
    badges,
    gender,
  };
}

function getSecurityKey(sections: Map<number, Section>): number {
  const section = sections.get(SECTION_TRAINER_INFO);
  if (!section) return 0;

  const view = new DataView(section.data.buffer, section.data.byteOffset);
  return view.getUint32(0x00ac, true);
}

function countBadges(badgeMask: number): number {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    if (badgeMask & (1 << i)) count++;
  }
  return count;
}

// Gen 3 Pokemon data structure (encrypted)
const POKEMON_DATA_SIZE = 100; // Party Pokemon
const POKEMON_BOX_SIZE = 80; // Box Pokemon

function decryptPokemon(data: Uint8Array): Uint8Array {
  if (data.length < 80) return data;

  const view = new DataView(data.buffer, data.byteOffset);
  const pid = view.getUint32(0x00, true);
  const otid = view.getUint32(0x04, true);
  const key = pid ^ otid;

  // Decrypt the 48 bytes of substructure data (offset 0x20-0x4F)
  const decrypted = new Uint8Array(data);
  const decryptedView = new DataView(decrypted.buffer, decrypted.byteOffset);

  for (let i = 0x20; i < 0x50; i += 4) {
    const encrypted = view.getUint32(i, true);
    decryptedView.setUint32(i, encrypted ^ key, true);
  }

  return decrypted;
}

// Substructure order based on PID % 24
const SUBSTRUCTURE_ORDERS = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
  [0, 2, 3, 1],
  [0, 3, 2, 1],
  [1, 0, 2, 3],
  [1, 0, 3, 2],
  [2, 0, 1, 3],
  [3, 0, 1, 2],
  [2, 0, 3, 1],
  [3, 0, 2, 1],
  [1, 2, 0, 3],
  [1, 3, 0, 2],
  [2, 1, 0, 3],
  [3, 1, 0, 2],
  [2, 3, 0, 1],
  [3, 2, 0, 1],
  [1, 2, 3, 0],
  [1, 3, 2, 0],
  [2, 1, 3, 0],
  [3, 1, 2, 0],
  [2, 3, 1, 0],
  [3, 2, 1, 0],
];

function getSubstructureOffset(pid: number, substruct: number): number {
  const order = SUBSTRUCTURE_ORDERS[pid % 24];
  const index = order.indexOf(substruct);
  return 0x20 + index * 12;
}

function parsePokemon(
  data: Uint8Array,
  isParty: boolean,
  generation: GameGeneration
): Pokemon | null {
  if (data.length < 80) return null;

  const decrypted = decryptPokemon(data);
  const view = new DataView(decrypted.buffer, decrypted.byteOffset);

  const pid = view.getUint32(0x00, true);
  const otid = view.getUint32(0x04, true);
  const charMap = getGen3CharacterMap();

  // Nickname (0x08-0x11)
  const nicknameBytes = decrypted.slice(0x08, 0x12);
  const nickname = decodeString(nicknameBytes, charMap);

  // OT Name (0x14-0x1A)
  const otNameBytes = decrypted.slice(0x14, 0x1b);
  const otName = decodeString(otNameBytes, charMap);

  // Get substructure offsets
  const growthOffset = getSubstructureOffset(pid, 0);
  const attacksOffset = getSubstructureOffset(pid, 1);
  const evCondOffset = getSubstructureOffset(pid, 2);
  const miscOffset = getSubstructureOffset(pid, 3);

  // Growth substructure
  const species = view.getUint16(growthOffset, true);
  if (species === 0 || species > 440) return null;

  const heldItem = view.getUint16(growthOffset + 2, true);
  const experience = view.getUint32(growthOffset + 4, true);
  const friendship = view.getUint8(growthOffset + 9);

  // Attacks substructure
  const moves: number[] = [];
  const pp: number[] = [];
  for (let i = 0; i < 4; i++) {
    moves.push(view.getUint16(attacksOffset + i * 2, true));
    pp.push(view.getUint8(attacksOffset + 8 + i));
  }

  // EVs/Condition substructure
  const evs = {
    hp: view.getUint8(evCondOffset),
    attack: view.getUint8(evCondOffset + 1),
    defense: view.getUint8(evCondOffset + 2),
    speed: view.getUint8(evCondOffset + 3),
    spAttack: view.getUint8(evCondOffset + 4),
    spDefense: view.getUint8(evCondOffset + 5),
  };

  // Misc substructure
  const ivData = view.getUint32(miscOffset + 4, true);
  const ivs = {
    hp: ivData & 0x1f,
    attack: (ivData >> 5) & 0x1f,
    defense: (ivData >> 10) & 0x1f,
    speed: (ivData >> 15) & 0x1f,
    spAttack: (ivData >> 20) & 0x1f,
    spDefense: (ivData >> 25) & 0x1f,
  };

  const isEgg = (ivData >> 30) & 1;
  const abilityBit = (ivData >> 31) & 1;

  // Calculate level from experience
  const level = calculateLevel(species, experience);

  // Party-specific data (only if isParty and data is long enough)
  let currentHp = 0;
  let maxHp = 0;
  let status = 0;
  let stats = { hp: 0, attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0 };

  if (isParty && data.length >= 100) {
    status = view.getUint32(0x50, true);
    level; // Already calculated
    currentHp = view.getUint16(0x56, true);
    maxHp = view.getUint16(0x58, true);
    stats = {
      hp: maxHp,
      attack: view.getUint16(0x5a, true),
      defense: view.getUint16(0x5c, true),
      speed: view.getUint16(0x5e, true),
      spAttack: view.getUint16(0x60, true),
      spDefense: view.getUint16(0x62, true),
    };
  }

  // Determine shiny status
  const isShiny =
    ((otid >> 16) ^ (otid & 0xffff) ^ (pid >> 16) ^ (pid & 0xffff)) < 8;

  return {
    species,
    speciesName: getSpeciesName(species, generation),
    nickname: nickname || getSpeciesName(species, generation),
    level,
    currentHp,
    maxHp,
    experience,
    moves: moves.map((m, i) => ({
      id: m,
      name: getMoveName(m, generation),
      pp: pp[i],
      maxPp: 0, // Would need move data to calculate
    })),
    ability: abilityBit,
    nature: pid % 25,
    ivs,
    evs,
    stats,
    heldItem: heldItem > 0 ? { id: heldItem, name: getItemName(heldItem, generation) } : undefined,
    otName,
    otId: otid & 0xffff,
    friendship,
    status,
    isShiny,
    isEgg: isEgg === 1,
    gender: determineGender(species, pid),
  };
}

function calculateLevel(species: number, experience: number): number {
  // Simplified level calculation - would need full exp tables
  // Using medium-fast growth rate as approximation
  if (experience < 8) return 1;
  const level = Math.floor(Math.cbrt(experience));
  return Math.min(100, Math.max(1, level));
}

function determineGender(species: number, pid: number): "male" | "female" | "unknown" {
  // Simplified - would need species gender ratios
  const genderThreshold = pid & 0xff;
  if (genderThreshold < 127) return "male";
  if (genderThreshold < 254) return "female";
  return "unknown";
}

function parseParty(sections: Map<number, Section>, generation: GameGeneration): Pokemon[] {
  const section = sections.get(SECTION_TEAM_ITEMS);
  if (!section) return [];

  const view = new DataView(section.data.buffer, section.data.byteOffset);
  const partyCount = view.getUint32(0x0234, true);

  const party: Pokemon[] = [];
  const partyOffset = 0x0238;

  for (let i = 0; i < Math.min(partyCount, 6); i++) {
    const pokemonData = section.data.slice(
      partyOffset + i * POKEMON_DATA_SIZE,
      partyOffset + (i + 1) * POKEMON_DATA_SIZE
    );
    const pokemon = parsePokemon(pokemonData, true, generation);
    if (pokemon) {
      party.push(pokemon);
    }
  }

  return party;
}

function parseInventory(sections: Map<number, Section>, generation: GameGeneration): InventoryItem[] {
  const section = sections.get(SECTION_TEAM_ITEMS);
  if (!section) return [];

  const view = new DataView(section.data.buffer, section.data.byteOffset);
  const items: InventoryItem[] = [];

  // Items pocket starts at different offsets by game
  // Using Emerald offsets as base
  const pockets = [
    { name: "Items", offset: 0x0560, count: 30 },
    { name: "Key Items", offset: 0x05d8, count: 30 },
    { name: "Poke Balls", offset: 0x0650, count: 16 },
    { name: "TMs/HMs", offset: 0x0690, count: 64 },
    { name: "Berries", offset: 0x0790, count: 46 },
  ];

  for (const pocket of pockets) {
    for (let i = 0; i < pocket.count; i++) {
      const itemOffset = pocket.offset + i * 4;
      if (itemOffset + 4 > section.data.length) break;

      const itemId = view.getUint16(itemOffset, true);
      const quantity = view.getUint16(itemOffset + 2, true);

      if (itemId > 0 && quantity > 0) {
        items.push({
          id: itemId,
          name: getItemName(itemId, generation),
          quantity,
          pocket: pocket.name,
        });
      }
    }
  }

  return items;
}

function parsePCBoxes(sections: Map<number, Section>, generation: GameGeneration): PCBox[] {
  const boxes: PCBox[] = [];
  const boxSections = [
    SECTION_PC_BUFFER_A,
    SECTION_PC_BUFFER_B,
    SECTION_PC_BUFFER_C,
    SECTION_PC_BUFFER_D,
    SECTION_PC_BUFFER_E,
    SECTION_PC_BUFFER_F,
    SECTION_PC_BUFFER_G,
    SECTION_PC_BUFFER_H,
    SECTION_PC_BUFFER_I,
  ];

  // Combine all PC buffer sections into one buffer
  const pcBuffer = new Uint8Array(boxSections.length * SECTION_DATA_SIZE);
  let offset = 0;

  for (const sectionId of boxSections) {
    const section = sections.get(sectionId);
    if (section) {
      pcBuffer.set(section.data, offset);
    }
    offset += SECTION_DATA_SIZE;
  }

  // Parse 14 boxes, 30 Pokemon each
  const BOX_COUNT = 14;
  const POKEMON_PER_BOX = 30;

  for (let boxIndex = 0; boxIndex < BOX_COUNT; boxIndex++) {
    const pokemon: Pokemon[] = [];
    const boxOffset = 4 + boxIndex * POKEMON_PER_BOX * POKEMON_BOX_SIZE;

    for (let slot = 0; slot < POKEMON_PER_BOX; slot++) {
      const pokemonOffset = boxOffset + slot * POKEMON_BOX_SIZE;
      if (pokemonOffset + POKEMON_BOX_SIZE > pcBuffer.length) break;

      const pokemonData = pcBuffer.slice(pokemonOffset, pokemonOffset + POKEMON_BOX_SIZE);
      const poke = parsePokemon(pokemonData, false, generation);
      if (poke) {
        pokemon.push(poke);
      }
    }

    boxes.push({
      name: `Box ${boxIndex + 1}`,
      pokemon,
      capacity: POKEMON_PER_BOX,
    });
  }

  return boxes;
}

function parseLocation(sections: Map<number, Section>, game: string): string {
  const section = sections.get(SECTION_GAME_STATE);
  if (!section) return "Unknown";

  const view = new DataView(section.data.buffer, section.data.byteOffset);

  // Location ID offset varies by game
  const locationOffset = game === "emerald" ? 0x0004 : 0x0004;
  const locationId = view.getUint8(locationOffset);

  const isFRLG = game === "firered" || game === "leafgreen";
  return getGen3LocationName(locationId, isFRLG);
}

export function parseGen3Save(buffer: ArrayBuffer): SaveData {
  const data = new Uint8Array(buffer);

  // Validate save size (should be 128KB)
  if (data.length < SAVE_SLOT_SIZE) {
    throw new Error("Invalid Gen 3 save file size");
  }

  // Find active save slot
  const activeSlot = getActiveSaveSlot(data);

  // Read sections from active slot
  const sections = readSections(data, activeSlot);

  // Detect game version
  const game = detectGame(sections);

  const generation: GameGeneration = {
    gen: 3,
    game,
  };

  // Parse all data
  const trainer = parseTrainerInfo(sections, game);
  const party = parseParty(sections, generation);
  const inventory = parseInventory(sections, generation);
  const pcBoxes = parsePCBoxes(sections, generation);
  const location = parseLocation(sections, game);

  return {
    generation,
    trainer,
    party,
    pcBoxes,
    inventory,
    location,
    lastUpdated: Date.now(),
  };
}
