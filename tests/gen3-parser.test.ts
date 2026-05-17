import test from "node:test";
import assert from "node:assert/strict";
import { parseSaveFile } from "../lib/pokemon/parsers";
import {
  GEN3_INVENTORY_LAYOUTS,
  GEN3_SAVE_LAYOUTS,
  getGen3NationalSpeciesId,
  type Gen3SaveLayout,
} from "../lib/pokemon/knowledge";

const SECTION_SIZE = 0x1000;
const SECTION_DATA_SIZE = 0xf80;
const SECTION_COUNT = 14;
const SAVE_SLOT_SIZE = SECTION_SIZE * SECTION_COUNT;
const TEST_SUBSTRUCTURE_ORDERS = [
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

function checksumGen3Pokemon(pokemon: Uint8Array): number {
  const view = new DataView(pokemon.buffer, pokemon.byteOffset);
  let checksum = 0;
  for (let offset = 0x20; offset < 0x50; offset += 2) {
    checksum = (checksum + view.getUint16(offset, true)) & 0xffff;
  }
  return checksum;
}

function writeEncryptedGen3PartyMon(save: Uint8Array, offset: number, internalSpecies: number): void {
  const pokemon = new Uint8Array(100);
  const view = new DataView(pokemon.buffer);
  const pid = 0x80000013;
  const otid = 0;
  const key = (pid ^ otid) >>> 0;
  const order = TEST_SUBSTRUCTURE_ORDERS[pid % 24];
  const subOffset = (substructure: number) => 0x20 + order.indexOf(substructure) * 12;
  const growthOffset = subOffset(0);
  const attacksOffset = subOffset(1);

  view.setUint32(0x00, pid, true);
  view.setUint32(0x04, otid, true);
  view.setUint8(0x13, 0x02);
  view.setUint16(growthOffset, internalSpecies, true);
  view.setUint16(growthOffset + 2, 13, true);
  view.setUint32(growthOffset + 4, 15625, true);
  view.setUint8(growthOffset + 9, 70);
  view.setUint16(attacksOffset, 33, true);
  view.setUint16(attacksOffset + 2, 86, true);
  view.setUint8(attacksOffset + 8, 35);
  view.setUint8(attacksOffset + 9, 20);
  view.setUint16(0x1c, checksumGen3Pokemon(pokemon), true);

  for (let byteOffset = 0x20; byteOffset < 0x50; byteOffset += 4) {
    view.setUint32(byteOffset, view.getUint32(byteOffset, true) ^ key, true);
  }

  view.setUint8(0x54, 25);
  view.setUint16(0x56, 60, true);
  view.setUint16(0x58, 60, true);
  view.setUint16(0x5a, 31, true);
  view.setUint16(0x5c, 29, true);
  view.setUint16(0x5e, 42, true);
  view.setUint16(0x60, 51, true);
  view.setUint16(0x62, 33, true);

  save.set(pokemon, offset);
}

function writeEncryptedGen3BoxMon(save: Uint8Array, offset: number, internalSpecies: number): void {
  const pokemon = new Uint8Array(100);
  writeEncryptedGen3PartyMon(pokemon, 0, internalSpecies);
  save.set(pokemon.slice(0, 80), offset);
}

function createEncryptedGen3BoxMon(internalSpecies: number): Uint8Array {
  const pokemon = new Uint8Array(100);
  writeEncryptedGen3PartyMon(pokemon, 0, internalSpecies);
  return pokemon.slice(0, 80);
}

function setSpeciesFlag(data: Uint8Array, offset: number, nationalDex: number): void {
  const bitIndex = nationalDex - 1;
  data[offset + Math.floor(bitIndex / 8)] |= 1 << (bitIndex % 8);
}

function buildGen3Save(layout: Gen3SaveLayout, options: {
  money: number;
  securityKey?: number;
  itemId: number;
  itemQuantity: number;
  badgeCount: number;
  mapGroup?: number;
  mapNum?: number;
  partyInternalSpecies?: number;
  pcInternalSpecies?: number;
  pcEntries?: Array<{
    box: number;
    slot: number;
    internalSpecies: number;
  }>;
  seenSpecies?: number[];
  caughtSpecies?: number[];
  mirrorPokedex?: boolean;
  saveIndex?: number;
  slot?: 0 | 1;
}): ArrayBuffer {
  const save = new Uint8Array(128 * 1024);
  const securityKey = options.securityKey ?? 0;
  const view = new DataView(save.buffer);
  const saveBlock1BaseSection = layout.sectionIds.teamItems;
  const slotBase = (options.slot ?? 0) * SAVE_SLOT_SIZE;

  const saveBlock1Offset = (offset: number) => {
    const sectionId = saveBlock1BaseSection + Math.floor(offset / SECTION_DATA_SIZE);
    return slotBase + sectionId * SECTION_SIZE + (offset % SECTION_DATA_SIZE);
  };

  for (let sectionId = 0; sectionId < SECTION_COUNT; sectionId++) {
    const sectionOffset = slotBase + sectionId * SECTION_SIZE;
    view.setUint16(sectionOffset + 0x0ff4, sectionId, true);
    view.setUint32(sectionOffset + 0x0ffc, options.saveIndex ?? 1, true);
  }

  const trainerBase = slotBase + layout.sectionIds.trainerInfo * SECTION_SIZE;
  view.setUint8(trainerBase + layout.offsets.trainerGender, 0);
  view.setUint16(trainerBase + layout.offsets.trainerId, 12345, true);
  view.setUint16(trainerBase + layout.offsets.trainerId + 2, 54321, true);
  view.setUint16(trainerBase + layout.offsets.playTimeHours, 12, true);
  view.setUint8(trainerBase + layout.offsets.playTimeMinutes, 34);
  view.setUint8(trainerBase + layout.offsets.playTimeSeconds, 56);
  if (layout.offsets.encryptionKey !== undefined) {
    view.setUint32(trainerBase + layout.offsets.encryptionKey, securityKey, true);
  }

  const storedMoney = layout.quantityMask === "security-key-low16" ? options.money ^ securityKey : options.money;
  view.setUint32(saveBlock1Offset(layout.offsets.money), storedMoney, true);
  view.setUint8(saveBlock1Offset(layout.offsets.partyCount), options.partyInternalSpecies ? 1 : 0);
  if (options.partyInternalSpecies) {
    const partyOffset = saveBlock1Offset(layout.offsets.party);
    writeEncryptedGen3PartyMon(save, partyOffset, options.partyInternalSpecies);
  }

  for (const species of options.seenSpecies ?? []) {
    setSpeciesFlag(save, trainerBase + layout.offsets.pokedexSeen, species);
    if (options.mirrorPokedex !== false) {
      setSpeciesFlag(save, saveBlock1Offset(layout.offsets.pokedexSeen1), species);
      setSpeciesFlag(save, saveBlock1Offset(layout.offsets.pokedexSeen2), species);
    }
  }

  for (const species of options.caughtSpecies ?? []) {
    setSpeciesFlag(save, trainerBase + layout.offsets.pokedexOwned, species);
    setSpeciesFlag(save, trainerBase + layout.offsets.pokedexSeen, species);
    if (options.mirrorPokedex !== false) {
      setSpeciesFlag(save, saveBlock1Offset(layout.offsets.pokedexSeen1), species);
      setSpeciesFlag(save, saveBlock1Offset(layout.offsets.pokedexSeen2), species);
    }
  }

  for (let badge = 0; badge < options.badgeCount; badge++) {
    const flag = layout.offsets.badgeFlagStart + badge;
    const byteOffset = saveBlock1Offset(layout.offsets.flags + Math.floor(flag / 8));
    save[byteOffset] |= 1 << (flag % 8);
  }

  const inventoryLayout = layout === GEN3_SAVE_LAYOUTS.fireRedLeafGreen
    ? GEN3_INVENTORY_LAYOUTS.fireRedLeafGreen
    : layout === GEN3_SAVE_LAYOUTS.emerald
      ? GEN3_INVENTORY_LAYOUTS.emerald
      : GEN3_INVENTORY_LAYOUTS.rubySapphire;
  const itemPocket = inventoryLayout.pockets.find((pocket) => pocket.name === "Items");
  assert.ok(itemPocket);
  view.setUint16(saveBlock1Offset(itemPocket.offset), options.itemId, true);
  const storedQuantity = itemPocket.quantityMask === "security-key-low16"
    ? options.itemQuantity ^ (securityKey & 0xffff)
    : options.itemQuantity;
  view.setUint16(saveBlock1Offset(itemPocket.offset + 2), storedQuantity, true);

  view.setUint8(saveBlock1Offset(layout.offsets.locationMapGroup), options.mapGroup ?? 0);
  view.setUint8(saveBlock1Offset(layout.offsets.locationMapNum), options.mapNum ?? 1);

  const pcBase = slotBase + layout.sectionIds.pcBufferStart * SECTION_SIZE;
  view.setUint8(pcBase + layout.offsets.boxCurrent, 2);
  const writePcBytes = (pcBufferOffset: number, bytes: Uint8Array) => {
    let sourceOffset = 0;
    while (sourceOffset < bytes.length) {
      const absolutePcOffset = pcBufferOffset + sourceOffset;
      const sectionId =
        layout.sectionIds.pcBufferStart +
        Math.floor(absolutePcOffset / SECTION_DATA_SIZE);
      const sectionOffset = absolutePcOffset % SECTION_DATA_SIZE;
      const copySize = Math.min(bytes.length - sourceOffset, SECTION_DATA_SIZE - sectionOffset);
      save.set(
        bytes.slice(sourceOffset, sourceOffset + copySize),
        slotBase + sectionId * SECTION_SIZE + sectionOffset
      );
      sourceOffset += copySize;
    }
  };
  if (options.pcInternalSpecies) {
    const entries = options.pcEntries ?? [{
      box: 2,
      slot: 0,
      internalSpecies: options.pcInternalSpecies,
    }];
    for (const entry of entries) {
      const pcBufferOffset =
        layout.offsets.boxData +
        (entry.box * layout.pcBoxCapacity + entry.slot) * layout.pcPokemonSize;
      writePcBytes(pcBufferOffset, createEncryptedGen3BoxMon(entry.internalSpecies));
    }
  } else if (options.pcEntries) {
    for (const entry of options.pcEntries) {
      const pcBufferOffset =
        layout.offsets.boxData +
        (entry.box * layout.pcBoxCapacity + entry.slot) * layout.pcPokemonSize;
      writePcBytes(pcBufferOffset, createEncryptedGen3BoxMon(entry.internalSpecies));
    }
  }

  return save.buffer;
}

function mergeSaves(...buffers: ArrayBuffer[]): ArrayBuffer {
  const merged = new Uint8Array(128 * 1024);
  for (const buffer of buffers) {
    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i++) {
      if (view[i] !== 0) merged[i] = view[i];
    }
  }
  return merged.buffer;
}

test("parseSaveFile preserves Gen 3 PC slots across section boundaries for Ruby and Emerald", () => {
  for (const [layout, filename] of [
    [GEN3_SAVE_LAYOUTS.rubySapphire, "pokemon-ruby-v1.1.sav"],
    [GEN3_SAVE_LAYOUTS.emerald, "pokemon-emerald.sav"],
  ] as const) {
    const save = buildGen3Save(layout, {
      money: 1000,
      securityKey: 0x11223344,
      itemId: 13,
      itemQuantity: 1,
      badgeCount: 0,
      pcEntries: [
        { box: 0, slot: 0, internalSpecies: 277 },
        { box: 1, slot: 0, internalSpecies: 280 },
        { box: 1, slot: 25, internalSpecies: 283 },
        { box: 2, slot: 0, internalSpecies: 285 },
      ],
    });

    const result = parseSaveFile(save, filename);
    assert.equal(result.success, true);
    if (!result.success) continue;

    assert.equal(result.data.pcBoxes?.[0].pokemon[0]?.species, 252);
    assert.equal(result.data.pcBoxes?.[1].pokemon[0]?.species, 255);
    assert.equal(result.data.pcBoxes?.[1].pokemon[25]?.species, 258);
    assert.equal(result.data.pcBoxes?.[2].pokemon[0]?.species, 260);
    assert.equal(result.data.pcBoxes?.[1].diagnostics?.validSlots, 2);
    assert.deepEqual(result.data.pcBoxes?.[1].diagnostics?.sectionIds, [5, 6]);
  }
});

test("parseSaveFile chooses one coherent Gen 3 save slot instead of mixing sections", () => {
  const olderSlot = buildGen3Save(GEN3_SAVE_LAYOUTS.rubySapphire, {
    money: 1000,
    itemId: 13,
    itemQuantity: 1,
    badgeCount: 0,
    saveIndex: 1,
    slot: 0,
    pcEntries: [
      { box: 0, slot: 0, internalSpecies: 277 },
      { box: 1, slot: 0, internalSpecies: 280 },
      { box: 2, slot: 0, internalSpecies: 283 },
    ],
  });
  const newerSlot = buildGen3Save(GEN3_SAVE_LAYOUTS.rubySapphire, {
    money: 2000,
    itemId: 13,
    itemQuantity: 1,
    badgeCount: 0,
    saveIndex: 2,
    slot: 1,
    pcEntries: [
      { box: 0, slot: 0, internalSpecies: 285 },
      { box: 1, slot: 0, internalSpecies: 287 },
      { box: 2, slot: 0, internalSpecies: 289 },
    ],
  });

  const result = parseSaveFile(
    mergeSaves(olderSlot, newerSlot),
    "pokemon-ruby-v1.1.sav"
  );
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.trainer.money, 2000);
  assert.equal(result.data.pcBoxes?.[0].pokemon[0]?.species, 260);
  assert.equal(result.data.pcBoxes?.[1].pokemon[0]?.species, 262);
  assert.equal(result.data.pcBoxes?.[2].pokemon[0]?.species, 264);
});

test("parseSaveFile uses Gen 3 filename profiles and generated Emerald offsets", () => {
  const save = buildGen3Save(GEN3_SAVE_LAYOUTS.emerald, {
    money: 123456,
    securityKey: 0x11223344,
    itemId: 13,
    itemQuantity: 7,
    badgeCount: 3,
    mapGroup: 0,
    mapNum: 4,
    partyInternalSpecies: 277,
    pcInternalSpecies: 280,
    seenSpecies: [25, 252, 255],
    caughtSpecies: [252, 255],
  });

  const result = parseSaveFile(save, "pokemon-emerald.sav");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.game, "emerald");
  assert.equal(result.data.trainer.money, 123456);
  assert.equal(result.data.trainer.badgeCount, 3);
  assert.deepEqual(result.data.trainer.badges.slice(0, 4), [true, true, true, false]);
  const items = result.data.inventory.find((section) => section.name === "Items");
  assert.equal(items?.items[0].id, 13);
  assert.equal(items?.items[0].quantity, 7);
  assert.equal(result.data.party[0].species, 252);
  assert.equal(result.data.party[0].speciesName, "Treecko");
  assert.equal(result.data.party[0].isShiny, false);
  assert.equal(result.data.party[0].heldItemName, "Potion");
  assert.deepEqual(result.data.party[0].moves.slice(0, 2).map((move) => move.id), [33, 86]);
  assert.equal(result.data.pokedex?.mode, "regional");
  assert.equal(result.data.pokedex?.regionalDex, "hoenn");
  assert.equal(result.data.pokedex?.dexMax, 202);
  assert.equal(result.data.pokedex?.seenCount, 3);
  assert.equal(result.data.pokedex?.caughtCount, 2);
  assert.deepEqual(result.data.pokedex?.caughtSpecies, [252, 255]);
  assert.equal(result.data.pcBoxes?.length, 14);
  assert.equal(result.data.pcBoxes?.[2].isCurrent, true);
  const boxedPokemon = result.data.pcBoxes?.[2].pokemon[0];
  assert.ok(boxedPokemon);
  assert.equal(boxedPokemon.species, 255);
  assert.equal(boxedPokemon.speciesName, "Torchic");
});

test("parseSaveFile uses Gen 3 FireRed/LeafGreen offsets and quantity masking", () => {
  const save = buildGen3Save(GEN3_SAVE_LAYOUTS.fireRedLeafGreen, {
    money: 98765,
    securityKey: 0xabcdef01,
    itemId: 4,
    itemQuantity: 12,
    badgeCount: 8,
  });

  const result = parseSaveFile(save, "Pokemon FireRed.sav");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.game, "firered");
  assert.equal(result.data.trainer.money, 98765);
  assert.equal(result.data.trainer.badgeCount, 8);
  const items = result.data.inventory.find((section) => section.name === "Items");
  assert.equal(items?.items[0].id, 4);
  assert.equal(items?.items[0].quantity, 12);
});

test("parseSaveFile falls back to Gen 3 SaveBlock2 Pokedex flags when seen mirrors are empty", () => {
  const save = buildGen3Save(GEN3_SAVE_LAYOUTS.emerald, {
    money: 123456,
    securityKey: 0x11223344,
    itemId: 13,
    itemQuantity: 7,
    badgeCount: 3,
    seenSpecies: [252],
    caughtSpecies: [255],
    mirrorPokedex: false,
  });

  const result = parseSaveFile(save, "pokemon-emerald.sav");
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.pokedex?.seenCount, 2);
  assert.equal(result.data.pokedex?.caughtCount, 1);
  assert.deepEqual(result.data.pokedex?.seenSpecies, [252, 255]);
  assert.deepEqual(result.data.pokedex?.caughtSpecies, [255]);
});

test("Gen 3 internal species IDs map to National Dex IDs", () => {
  assert.equal(getGen3NationalSpeciesId(277), 252);
  assert.equal(getGen3NationalSpeciesId(280), 255);
  assert.equal(getGen3NationalSpeciesId(283), 258);
  assert.equal(getGen3NationalSpeciesId(410), 386);
  assert.equal(getGen3NationalSpeciesId(252), 201);
});
