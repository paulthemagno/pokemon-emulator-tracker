// Gen 3 Parser - Ruby, Sapphire, Emerald, FireRed, LeafGreen
// Gen 3 saves are 128KB with a complex section-based structure

import {
  Pokemon,
  SaveData,
  TrainerInfo,
  GameVersion,
  InventorySection,
  PCBox,
} from "../types";
import {
  getExpForLevel,
  type GrowthRate,
} from "../experience";
import {
  getSpeciesById,
} from "../data/species";
import { GEN3_INVENTORY_LAYOUTS, type InventoryLayout } from "../knowledge/inventory-layouts";
import { GEN3_SAVE_LAYOUTS, type Gen3SaveLayout } from "../knowledge/save-layouts";
import { getGen3NationalSpeciesId } from "../knowledge/species-id-maps";
import {
  getGen3CharacterMap,
  decodeString,
  getSpeciesName,
  getMoveName,
  getItemName,
  getGen3LocationName,
  getStatusCondition,
} from "../utils";
import { GEN3_HOENN_DEX_NATIONAL_ORDER } from "../data/gen3-hoenn-dex";

// Gen 3 save structure constants
const SECTION_SIZE = 0x1000; // 4KB per section
const SECTION_FOOTER_OFFSET = 0xff4;
const SECTION_DATA_SIZE = 0xf80; // SaveBlockChunk payload size written by the game.
const SECTION_COUNT = 14;
const SAVE_SLOT_SIZE = SECTION_SIZE * SECTION_COUNT; // 57344 bytes per slot
const SECTION_SIGNATURE = 0x08012025;
const SECTION_CHECKSUM_SIZES = [
  3884,
  3968,
  3968,
  3968,
  3848,
  3968,
  3968,
  3968,
  3968,
  3968,
  3968,
  3968,
  3968,
  2000,
] as const;
const GEN3_NUM_SPECIES = 386;
const GEN3_HOENN_DEX_COUNT = 202;
const GEN3_DEX_MODE_NATIONAL = 1;
const GEN3_NATIONAL_MAGIC = {
  rubySapphireEmerald: 0xda,
  fireRedLeafGreen: 0xb9,
} as const;

// Section IDs and their purposes
const SECTION_TRAINER_INFO = 0;
const SECTION_TEAM_ITEMS = 1;

interface Section {
  data: Uint8Array;
  id: number;
  checksum: number;
  saveIndex: number;
  valid: boolean;
  slot: number;
}

type Gen3GameVersion = Extract<GameVersion, "ruby" | "sapphire" | "emerald" | "firered" | "leafgreen">;

interface Gen3Generation {
  gen: 3;
  game: Gen3GameVersion;
}

interface Gen3SaveProfile {
  layout: Gen3SaveLayout;
  inventoryLayout: InventoryLayout;
}

function getGen3SaveProfile(game: Gen3GameVersion | string): Gen3SaveProfile {
  if (game === "firered" || game === "leafgreen") {
    return {
      layout: GEN3_SAVE_LAYOUTS.fireRedLeafGreen,
      inventoryLayout: GEN3_INVENTORY_LAYOUTS.fireRedLeafGreen,
    };
  }
  if (game === "emerald") {
    return {
      layout: GEN3_SAVE_LAYOUTS.emerald,
      inventoryLayout: GEN3_INVENTORY_LAYOUTS.emerald,
    };
  }
  return {
    layout: GEN3_SAVE_LAYOUTS.rubySapphire,
    inventoryLayout: GEN3_INVENTORY_LAYOUTS.rubySapphire,
  };
}

function readSections(data: Uint8Array, slot: number): Map<number, Section> {
  const sections = new Map<number, Section>();
  const baseOffset = slot * SAVE_SLOT_SIZE;

  for (let i = 0; i < SECTION_COUNT; i++) {
    const sectionOffset = baseOffset + i * SECTION_SIZE;
    const sectionData = data.slice(sectionOffset, sectionOffset + SECTION_SIZE);

    const view = new DataView(sectionData.buffer, sectionData.byteOffset);
    const sectionId = view.getUint16(SECTION_FOOTER_OFFSET, true);
    const checksum = view.getUint16(SECTION_FOOTER_OFFSET + 2, true);
    const signature = view.getUint32(SECTION_FOOTER_OFFSET + 4, true);
    const saveIndex = view.getUint32(SECTION_FOOTER_OFFSET + 8, true);

    sections.set(sectionId, {
      data: sectionData.slice(0, SECTION_DATA_SIZE),
      id: sectionId,
      checksum,
      saveIndex,
      valid: isValidSection(sectionData, sectionId, checksum, signature),
      slot,
    });
  }

  return sections;
}

function isNewerSaveIndex(candidate: number, current: number): boolean {
  return ((candidate - current) >>> 0) < 0x80000000 && candidate !== current;
}

function calculateSectionChecksum(sectionData: Uint8Array, sectionId: number): number {
  const size = SECTION_CHECKSUM_SIZES[sectionId] ?? SECTION_DATA_SIZE;
  const view = new DataView(sectionData.buffer, sectionData.byteOffset);
  let sum = 0;
  for (let offset = 0; offset < size; offset += 4) {
    sum = (sum + view.getUint32(offset, true)) >>> 0;
  }
  return (((sum >>> 16) + (sum & 0xffff)) & 0xffff) >>> 0;
}

function isValidSection(
  sectionData: Uint8Array,
  sectionId: number,
  checksum: number,
  signature: number
): boolean {
  if (sectionId >= SECTION_COUNT) return false;
  if (signature !== SECTION_SIGNATURE) return false;
  return calculateSectionChecksum(sectionData, sectionId) === checksum;
}

function getSlotSections(data: Uint8Array): Map<number, Section>[] {
  const slots: Map<number, Section>[] = [];
  for (let slot = 0; slot < 2; slot++) {
    slots.push(readSections(data, slot));
  }
  return slots;
}

function getSlotStats(sections: Map<number, Section>): {
  validCount: number;
  latestSaveIndex: number;
} {
  let validCount = 0;
  let latestSaveIndex = 0;
  for (const section of sections.values()) {
    if (section.valid) {
      validCount++;
    }
    if ((validCount > 0 || latestSaveIndex === 0) && (latestSaveIndex === 0 || isNewerSaveIndex(section.saveIndex, latestSaveIndex))) {
      latestSaveIndex = section.saveIndex;
    }
  }
  return { validCount, latestSaveIndex };
}

function chooseBestSections(data: Uint8Array): Map<number, Section> {
  const slotSections = getSlotSections(data);
  const [slot0Stats, slot1Stats] = slotSections.map(getSlotStats);

  if (slot0Stats.validCount !== slot1Stats.validCount) {
    return slot0Stats.validCount > slot1Stats.validCount ? slotSections[0] : slotSections[1];
  }

  if (slot0Stats.latestSaveIndex === slot1Stats.latestSaveIndex) {
    return slotSections[0];
  }

  return isNewerSaveIndex(slot1Stats.latestSaveIndex, slot0Stats.latestSaveIndex)
    ? slotSections[1]
    : slotSections[0];
}

function assembleSectionRange(
  sections: Map<number, Section>,
  startSectionId: number,
  endSectionId: number
): Uint8Array {
  const output = new Uint8Array((endSectionId - startSectionId + 1) * SECTION_DATA_SIZE);
  let offset = 0;
  for (let sectionId = startSectionId; sectionId <= endSectionId; sectionId++) {
    const section = sections.get(sectionId);
    if (section) {
      output.set(section.data, offset);
    }
    offset += SECTION_DATA_SIZE;
  }
  return output;
}

function getSaveBlock1(sections: Map<number, Section>, layout: Gen3SaveLayout): Uint8Array {
  return assembleSectionRange(
    sections,
    layout.sectionIds.teamItems,
    layout.sectionIds.pcBufferStart - 1
  );
}

function detectGame(filename = ""): Gen3GameVersion {
  const lowerFilename = filename.toLowerCase();
  if (/\bleaf\s*green\b|leafgreen|lg\b/.test(lowerFilename)) return "leafgreen";
  if (/\bfire\s*red\b|firered|fr\b/.test(lowerFilename)) return "firered";
  if (/\bemerald\b|pokemon-em\b|pokeemerald/.test(lowerFilename)) return "emerald";
  if (/\bsapphire\b|pokemon-sa\b|pokesapphire/.test(lowerFilename)) return "sapphire";
  if (/\bruby\b|pokemon-ru\b|pokeruby/.test(lowerFilename)) return "ruby";

  // A raw Gen 3 save does not carry a reliable title string in the section data.
  // Use the Ruby/Sapphire layout as the conservative unlabelled default because
  // it is unencrypted for money/item quantities.
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
      badges: Array.from({ length: 8 }, () => false),
      badgeCount: 0,
      gender: "male",
    };
  }

  const view = new DataView(section.data.buffer, section.data.byteOffset);
  const charMap = getGen3CharacterMap();
  const profile = getGen3SaveProfile(game);
  const layout = profile.layout;

  const nameBytes = section.data.slice(layout.offsets.trainerName, layout.offsets.trainerName + 7);
  const name = decodeString(nameBytes, charMap);

  const genderByte = view.getUint8(layout.offsets.trainerGender);
  const gender = genderByte === 0 ? "male" : "female";

  const trainerId = view.getUint16(layout.offsets.trainerId, true);

  const secretId = view.getUint16(layout.offsets.trainerId + 2, true);

  const hours = view.getUint16(layout.offsets.playTimeHours, true);
  const minutes = view.getUint8(layout.offsets.playTimeMinutes);
  const seconds = view.getUint8(layout.offsets.playTimeSeconds);

  // Money, inventory, flags, and location are in SaveBlock1, split across sections 1-4.
  const saveBlock1 = getSaveBlock1(sections, layout);
  let money = 0;
  let badges = Array.from({ length: 8 }, () => false);

  if (saveBlock1.length > 0) {
    const teamView = new DataView(
      saveBlock1.buffer,
      saveBlock1.byteOffset
    );

    const rawMoney = teamView.getUint32(layout.offsets.money, true);
    money = layout.quantityMask === "security-key-low16" ? rawMoney ^ getSecurityKey(sections, game) : rawMoney;

    badges = parseBadgesFromFlags(saveBlock1, layout);
  }

  return {
    name,
    id: trainerId,
    secretId,
    money,
    playTime: { hours, minutes, seconds },
    badges,
    badgeCount: badges.filter(Boolean).length,
    gender,
  };
}

function getSecurityKey(sections: Map<number, Section>, game: string): number {
  const section = sections.get(SECTION_TRAINER_INFO);
  if (!section) return 0;
  const offset = getGen3SaveProfile(game).layout.offsets.encryptionKey;
  if (offset === undefined || offset + 4 > section.data.length) return 0;

  const view = new DataView(section.data.buffer, section.data.byteOffset);
  return view.getUint32(offset, true);
}

function parseBadgesFromFlags(teamData: Uint8Array, layout: Gen3SaveLayout): boolean[] {
  return Array.from({ length: 8 }, (_, index) => {
    const flag = layout.offsets.badgeFlagStart + index;
    const byteOffset = layout.offsets.flags + Math.floor(flag / 8);
    if (byteOffset >= teamData.length) return false;
    return (teamData[byteOffset] & (1 << (flag % 8))) !== 0;
  });
}

function hasSpeciesFlag(data: Uint8Array, offset: number, nationalDex: number): boolean {
  const bitIndex = nationalDex - 1;
  const byteOffset = offset + Math.floor(bitIndex / 8);
  if (byteOffset >= data.length) return false;
  return (data[byteOffset] & (1 << (bitIndex % 8))) !== 0;
}

function parseSpeciesFlags(data: Uint8Array, offset: number, maxNationalDex: number): number[] {
  const species: number[] = [];
  for (let nationalDex = 1; nationalDex <= maxNationalDex; nationalDex++) {
    if (hasSpeciesFlag(data, offset, nationalDex)) {
      species.push(nationalDex);
    }
  }
  return species;
}

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

function checksumGen3BoxPokemon(decrypted: Uint8Array): number {
  const view = new DataView(decrypted.buffer, decrypted.byteOffset);
  let checksum = 0;
  for (let offset = 0x20; offset < 0x50; offset += 2) {
    checksum = (checksum + view.getUint16(offset, true)) & 0xffff;
  }
  return checksum;
}

// Substructure order based on PID % 24
const SUBSTRUCTURE_ORDERS = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [0, 2, 1, 3],
  [0, 2, 3, 1],
  [0, 3, 1, 2],
  [0, 3, 2, 1],
  [1, 0, 2, 3],
  [1, 0, 3, 2],
  [1, 2, 0, 3],
  [1, 2, 3, 0],
  [1, 3, 0, 2],
  [1, 3, 2, 0],
  [2, 0, 1, 3],
  [2, 0, 3, 1],
  [2, 1, 0, 3],
  [2, 1, 3, 0],
  [2, 3, 0, 1],
  [2, 3, 1, 0],
  [3, 0, 1, 2],
  [3, 0, 2, 1],
  [3, 1, 0, 2],
  [3, 1, 2, 0],
  [3, 2, 0, 1],
  [3, 2, 1, 0],
];

function getSubstructureOffset(pid: number, substruct: number): number {
  const order = SUBSTRUCTURE_ORDERS[pid % 24];
  const index = order.indexOf(substruct);
  return 0x20 + index * 12;
}

function isGen3Shiny(pid: number, otid: number): boolean {
  const trainerId = otid & 0xffff;
  const secretId = (otid >>> 16) & 0xffff;
  const personalityLow = pid & 0xffff;
  const personalityHigh = (pid >>> 16) & 0xffff;
  return (trainerId ^ secretId ^ personalityLow ^ personalityHigh) < 8;
}

type Gen3PokemonParseFailure =
  | "short"
  | "no-species"
  | "checksum"
  | "invalid-species";

interface Gen3PokemonParseDetails {
  internalSpecies?: number;
  nationalSpecies?: number;
  personality?: number;
  storedChecksum?: number;
  computedChecksum?: number;
}

function parsePokemonRecord(
  data: Uint8Array,
  isParty: boolean,
  generation: Gen3Generation
): { pokemon: Pokemon | null; failure?: Gen3PokemonParseFailure; details?: Gen3PokemonParseDetails } {
  if (data.length < 80) return { pokemon: null, failure: "short" };

  const decrypted = decryptPokemon(data);
  const view = new DataView(decrypted.buffer, decrypted.byteOffset);

  const pid = view.getUint32(0x00, true);
  const otid = view.getUint32(0x04, true);
  const flags = view.getUint8(0x13);
  const hasSpecies = (flags & 0x02) !== 0;
  if (!hasSpecies) {
    return {
      pokemon: null,
      failure: "no-species",
      details: {
        personality: pid,
      },
    };
  }

  const storedChecksum = view.getUint16(0x1c, true);
  const computedChecksum = checksumGen3BoxPokemon(decrypted);
  if (computedChecksum !== storedChecksum) {
    const growthOffset = getSubstructureOffset(pid, 0);
    const internalSpecies = view.getUint16(growthOffset, true);
    return {
      pokemon: null,
      failure: "checksum",
      details: {
        internalSpecies,
        nationalSpecies:
          internalSpecies > 0 && internalSpecies <= 440
            ? getGen3NationalSpeciesId(internalSpecies)
            : undefined,
        personality: pid,
        storedChecksum,
        computedChecksum,
      },
    };
  }

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
  const internalSpecies = view.getUint16(growthOffset, true);
  if (internalSpecies === 0 || internalSpecies > 440) {
    return {
      pokemon: null,
      failure: "invalid-species",
      details: {
        internalSpecies,
        personality: pid,
        storedChecksum,
        computedChecksum,
      },
    };
  }
  const species = getGen3NationalSpeciesId(internalSpecies);

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
    specialAttack: view.getUint8(evCondOffset + 4),
    specialDefense: view.getUint8(evCondOffset + 5),
  };

  // Misc substructure
  const ivData = view.getUint32(miscOffset + 4, true);
  const ivs = {
    hp: ivData & 0x1f,
    attack: (ivData >> 5) & 0x1f,
    defense: (ivData >> 10) & 0x1f,
    speed: (ivData >> 15) & 0x1f,
    specialAttack: (ivData >> 20) & 0x1f,
    specialDefense: (ivData >> 25) & 0x1f,
  };

  const abilityBit = (ivData >> 31) & 1;

  // Calculate level from experience
  let level = calculateLevel(species, experience);

  // Party-specific data (only if isParty and data is long enough)
  let currentHp = 0;
  let maxHp = 0;
  let status = 0;
  let stats = { hp: 0, attack: 0, defense: 0, speed: 0, specialAttack: 0, specialDefense: 0 };

  if (isParty && data.length >= 100) {
    status = view.getUint32(0x50, true);
    level = view.getUint8(0x54) || level;
    currentHp = view.getUint16(0x56, true);
    maxHp = view.getUint16(0x58, true);
    stats = {
      hp: maxHp,
      attack: view.getUint16(0x5a, true),
      defense: view.getUint16(0x5c, true),
      speed: view.getUint16(0x5e, true),
      specialAttack: view.getUint16(0x60, true),
      specialDefense: view.getUint16(0x62, true),
    };
  }

  // Determine shiny status
  const isShiny = isGen3Shiny(pid, otid);

  return {
    pokemon: {
    species,
    speciesName: getSpeciesName(species, generation.gen),
    nickname: nickname || getSpeciesName(species, generation.gen),
    level,
    currentHP: currentHp,
    maxHP: maxHp,
    experience,
    moves: moves.map((m, i) => ({
      id: m,
      name: getMoveName(m, generation.gen),
      pp: pp[i],
      maxPP: 0, // Would need move data to calculate
    })),
    ability: abilityBit,
    nature: pid % 25,
    ivs,
    evs,
    stats,
    heldItem: heldItem > 0 ? heldItem : undefined,
    heldItemName: heldItem > 0 ? getItemName(heldItem, generation.gen) : undefined,
    originalTrainer: otName,
    originalTrainerID: otid & 0xffff,
    happiness: friendship,
    status: getStatusCondition(status),
    isShiny,
    gender: determineGender(species, pid),
    },
    details: {
      internalSpecies,
      nationalSpecies: species,
      personality: pid,
      storedChecksum,
      computedChecksum,
    },
  };
}

function parsePokemon(
  data: Uint8Array,
  isParty: boolean,
  generation: Gen3Generation
): Pokemon | null {
  return parsePokemonRecord(data, isParty, generation).pokemon;
}

function calculateLevel(species: number, experience: number): number {
  const growthRate: GrowthRate = getSpeciesById(species).growthRate ?? "medium-fast";

  for (let level = 100; level >= 1; level--) {
    if (experience >= getExpForLevel(level, growthRate)) {
      return level;
    }
  }

  return 1;
}

function determineGender(species: number, pid: number): "male" | "female" | "unknown" {
  // Simplified - would need species gender ratios
  const genderThreshold = pid & 0xff;
  if (genderThreshold < 127) return "male";
  if (genderThreshold < 254) return "female";
  return "unknown";
}

function parseParty(sections: Map<number, Section>, generation: Gen3Generation): Pokemon[] {
  const layout = getGen3SaveProfile(generation.game).layout;
  const saveBlock1 = getSaveBlock1(sections, layout);
  if (!saveBlock1.length) return [];

  const view = new DataView(saveBlock1.buffer, saveBlock1.byteOffset);
  const partyCount = layout.partyCountSize === 1
    ? view.getUint8(layout.offsets.partyCount)
    : view.getUint32(layout.offsets.partyCount, true);

  const party: Pokemon[] = [];

  for (let i = 0; i < Math.min(partyCount, 6); i++) {
    const pokemonData = saveBlock1.slice(
      layout.offsets.party + i * layout.partyPokemonSize,
      layout.offsets.party + (i + 1) * layout.partyPokemonSize
    );
    const pokemon = parsePokemon(pokemonData, true, generation);
    if (pokemon) {
      party.push(pokemon);
    }
  }

  return party;
}

function parseInventory(sections: Map<number, Section>, generation: Gen3Generation): InventorySection[] {
  const inventory: InventorySection[] = [];
  const profile = getGen3SaveProfile(generation.game);
  const saveBlock1 = getSaveBlock1(sections, profile.layout);
  if (!saveBlock1.length) return [];

  const view = new DataView(saveBlock1.buffer, saveBlock1.byteOffset);
  const quantityMask = getSecurityKey(sections, generation.game) & 0xffff;

  for (const pocket of profile.inventoryLayout.pockets) {
    const items = [];
    for (let i = 0; i < pocket.count; i++) {
      const itemOffset = pocket.offset + i * 4;
      if (itemOffset + 4 > saveBlock1.length) break;

      const itemId = view.getUint16(itemOffset, true);
      const rawQuantity = view.getUint16(itemOffset + 2, true);
      const quantity = pocket.quantityMask === "security-key-low16" ? rawQuantity ^ quantityMask : rawQuantity;

      if (itemId > 0 && quantity > 0) {
        items.push({
          id: itemId,
          name: getItemName(itemId, generation.gen),
          quantity,
          pocket: pocket.name,
        });
      }
    }
    inventory.push({ name: pocket.name, items });
  }

  return inventory;
}

function parsePokedexProgress(
  sections: Map<number, Section>,
  generation: Gen3Generation
): SaveData["pokedex"] {
  const layout = getGen3SaveProfile(generation.game).layout;
  const trainerInfo = sections.get(layout.sectionIds.trainerInfo)?.data;
  const saveBlock1 = getSaveBlock1(sections, layout);
  if (!trainerInfo || !saveBlock1.length) {
    return {
      seenSpecies: [],
      caughtSpecies: [],
      seenCount: 0,
      caughtCount: 0,
      source: "save",
    };
  }

  const strictSeenSpecies: number[] = [];
  const strictCaughtSpecies: number[] = [];
  const nationalMagic = trainerInfo[layout.offsets.pokedexNationalMagic];
  const nationalMagicValue =
    generation.game === "firered" || generation.game === "leafgreen"
      ? GEN3_NATIONAL_MAGIC.fireRedLeafGreen
      : GEN3_NATIONAL_MAGIC.rubySapphireEmerald;
  const nationalEnabled = nationalMagic === nationalMagicValue;
  const modeByte = trainerInfo[layout.offsets.pokedexMode];
  const mode = nationalEnabled && modeByte === GEN3_DEX_MODE_NATIONAL ? "national" : "regional";
  const isHoennRegionalDex =
    mode === "regional" &&
    generation.game !== "firered" &&
    generation.game !== "leafgreen";

  for (let nationalDex = 1; nationalDex <= GEN3_NUM_SPECIES; nationalDex++) {
    const seenInPokedex = hasSpeciesFlag(trainerInfo, layout.offsets.pokedexSeen, nationalDex);
    const seenInSaveBlock1 =
      hasSpeciesFlag(saveBlock1, layout.offsets.pokedexSeen1, nationalDex) &&
      hasSpeciesFlag(saveBlock1, layout.offsets.pokedexSeen2, nationalDex);
    const caughtInPokedex = hasSpeciesFlag(trainerInfo, layout.offsets.pokedexOwned, nationalDex);
    const seen = seenInPokedex && seenInSaveBlock1;
    const caught = caughtInPokedex && seen;

    if (seen) strictSeenSpecies.push(nationalDex);
    if (caught) strictCaughtSpecies.push(nationalDex);
  }

  const rawSeenSpecies = parseSpeciesFlags(trainerInfo, layout.offsets.pokedexSeen, GEN3_NUM_SPECIES);
  const rawCaughtSpecies = parseSpeciesFlags(trainerInfo, layout.offsets.pokedexOwned, GEN3_NUM_SPECIES);
  const hasStrictFlags = strictSeenSpecies.length > 0 || strictCaughtSpecies.length > 0;
  const caughtSpecies = hasStrictFlags ? strictCaughtSpecies : rawCaughtSpecies;
  const seenSpecies = hasStrictFlags
    ? strictSeenSpecies
    : Array.from(new Set([...rawSeenSpecies, ...rawCaughtSpecies])).sort((a, b) => a - b);

  const countableSpecies = isHoennRegionalDex
    ? GEN3_HOENN_DEX_NATIONAL_ORDER
    : Array.from({ length: GEN3_NUM_SPECIES }, (_, index) => index + 1);
  const countableSet = new Set<number>(countableSpecies);
  const countableSeenSpecies = seenSpecies.filter((species) => countableSet.has(species));
  const countableCaughtSpecies = caughtSpecies.filter((species) => countableSet.has(species));

  return {
    seenSpecies,
    caughtSpecies,
    seenCount: countableSeenSpecies.length,
    caughtCount: countableCaughtSpecies.length,
    source: "save",
    mode,
    regionalDex: isHoennRegionalDex ? "hoenn" : undefined,
    dexMax: isHoennRegionalDex ? GEN3_HOENN_DEX_COUNT : GEN3_NUM_SPECIES,
  };
}

function parsePCBoxes(sections: Map<number, Section>, generation: Gen3Generation): PCBox[] {
  const boxes: PCBox[] = [];
  const layout = getGen3SaveProfile(generation.game).layout;
  const boxSections = Array.from(
    { length: layout.sectionIds.pcBufferEnd - layout.sectionIds.pcBufferStart + 1 },
    (_, index) => layout.sectionIds.pcBufferStart + index
  );

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

  const currentBox = pcBuffer[layout.offsets.boxCurrent];

  for (let boxIndex = 0; boxIndex < layout.pcBoxCount; boxIndex++) {
    const pokemon: (Pokemon | null)[] = [];
    const diagnostics: NonNullable<PCBox["diagnostics"]> = {
      validSlots: 0,
      emptySlots: 0,
      noSpeciesSlots: 0,
      checksumFailedSlots: 0,
      invalidSpeciesSlots: 0,
      shortSlots: 0,
      sectionIds: [],
      sampleSlots: [],
    };
    const boxOffset = layout.offsets.boxData + boxIndex * layout.pcBoxCapacity * layout.pcPokemonSize;

    for (let slot = 0; slot < layout.pcBoxCapacity; slot++) {
      const pokemonOffset = boxOffset + slot * layout.pcPokemonSize;
      if (pokemonOffset + layout.pcPokemonSize > pcBuffer.length) break;

      const pokemonData = pcBuffer.slice(pokemonOffset, pokemonOffset + layout.pcPokemonSize);
      const sectionId = layout.sectionIds.pcBufferStart + Math.floor(pokemonOffset / SECTION_DATA_SIZE);
      if (!diagnostics.sectionIds?.includes(sectionId)) {
        diagnostics.sectionIds?.push(sectionId);
      }
      const result = parsePokemonRecord(pokemonData, false, generation);
      pokemon.push(result.pokemon);
      if (result.pokemon) {
        diagnostics.validSlots++;
      } else if (result.failure === "short") {
        diagnostics.shortSlots++;
      } else if (result.failure === "checksum") {
        diagnostics.checksumFailedSlots++;
      } else if (result.failure === "invalid-species") {
        diagnostics.invalidSpeciesSlots++;
      } else {
        diagnostics.noSpeciesSlots++;
      }
      const shouldRecordSample =
        diagnostics.sampleSlots !== undefined &&
        diagnostics.sampleSlots.length < 8 &&
        (
          !!result.failure ||
          diagnostics.sampleSlots.filter((sample) => sample.status === "valid").length < 3
        );
      if (shouldRecordSample) {
        diagnostics.sampleSlots?.push({
          slot: slot + 1,
          status: result.pokemon ? "valid" : (result.failure ?? "short"),
          internalSpecies: result.details?.internalSpecies,
          nationalSpecies: result.details?.nationalSpecies,
          personality: result.details?.personality,
          storedChecksum: result.details?.storedChecksum,
          computedChecksum: result.details?.computedChecksum,
        });
      }
    }
    diagnostics.emptySlots = Math.max(0, layout.pcBoxCapacity - diagnostics.validSlots);

    const nameOffset = layout.offsets.boxNames + boxIndex * layout.boxNameLength;
    const rawName = pcBuffer.slice(nameOffset, nameOffset + layout.boxNameLength);
    const name = decodeString(rawName, getGen3CharacterMap()) || `Box ${boxIndex + 1}`;

    boxes.push({
      name,
      pokemon,
      capacity: layout.pcBoxCapacity,
      isCurrent: boxIndex === currentBox,
      diagnostics,
    });
  }

  return boxes;
}

function parseLocation(sections: Map<number, Section>, game: string): SaveData["location"] {
  const layout = getGen3SaveProfile(game).layout;
  const saveBlock1 = getSaveBlock1(sections, layout);
  if (!saveBlock1.length) {
    return {
      mapId: 0,
      name: "Unknown",
      areaType: "unknown",
    };
  }

  const view = new DataView(saveBlock1.buffer, saveBlock1.byteOffset);

  const mapGroup = view.getUint8(layout.offsets.locationMapGroup);
  const mapNum = view.getUint8(layout.offsets.locationMapNum);
  const isFRLG = game === "firered" || game === "leafgreen";
  return {
    mapId: mapNum,
    mapGroup,
    name: getGen3LocationName(mapNum, isFRLG),
    areaType: "unknown",
  };
}

export function parseGen3Save(buffer: ArrayBuffer, filename = ""): SaveData {
  const data = new Uint8Array(buffer);

  // Validate save size (should be 128KB)
  if (data.length < SAVE_SLOT_SIZE) {
    throw new Error("Invalid Gen 3 save file size");
  }

  const sections = chooseBestSections(data);

  // Detect game version
  const game = detectGame(filename);

  const generation: Gen3Generation = {
    gen: 3,
    game,
  };

  // Parse all data
  const trainer = parseTrainerInfo(sections, game);
  const party = parseParty(sections, generation);
  const inventory = parseInventory(sections, generation);
  const pokedex = parsePokedexProgress(sections, generation);
  const pcBoxes = parsePCBoxes(sections, generation);
  const location = parseLocation(sections, game);

  return {
    generation: 3,
    game,
    trainer,
    pokedex,
    party,
    pcBoxes,
    inventory,
    location,
    valid: true,
    rawSize: data.length,
  };
}
