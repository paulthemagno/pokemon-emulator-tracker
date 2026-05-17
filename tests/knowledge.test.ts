import test from "node:test";
import assert from "node:assert/strict";
import {
  GEN1_INVENTORY_LAYOUT,
  GEN1_YELLOW_INVENTORY_LAYOUT,
  GEN2_INVENTORY_LAYOUTS,
  GEN3_INVENTORY_LAYOUTS,
  ITEM_ID_RANGES,
  getGen1MachineItemName,
  GEN1_SAVE_LAYOUTS,
  GEN2_SAVE_LAYOUTS,
  GEN3_SAVE_LAYOUTS,
} from "../lib/pokemon/knowledge";
import {
  GEN3_HOENN_DEX_COUNT,
  GEN3_HOENN_DEX_NATIONAL_ORDER,
  getGen3HoennDexNumber,
} from "../lib/pokemon/data/gen3-hoenn-dex";
import {
  getGen3MapLandmark,
  getGen3RegionMapPixel,
} from "../lib/pokemon/data/gen3-map-landmarks";

function pocketOffset(layout: { pockets: Array<{ name: string; offset: number }> }, name: string): number {
  const pocket = layout.pockets.find((entry) => entry.name === name);
  assert.ok(pocket, `Missing pocket ${name}`);
  return pocket.offset;
}

test("knowledge inventory layouts keep Gen 1 and Gen 2 PC item storage offsets", () => {
  assert.equal(pocketOffset(GEN1_INVENTORY_LAYOUT, "Bag"), 0x25c9);
  assert.equal(pocketOffset(GEN1_INVENTORY_LAYOUT, "PC Storage"), 0x27e6);
  assert.equal(pocketOffset(GEN1_YELLOW_INVENTORY_LAYOUT, "Bag"), 0x25c9);
  assert.equal(pocketOffset(GEN1_YELLOW_INVENTORY_LAYOUT, "PC Storage"), 0x27e6);
  assert.equal(pocketOffset(GEN2_INVENTORY_LAYOUTS.goldSilver, "PC Storage"), 0x247e);
  assert.equal(pocketOffset(GEN2_INVENTORY_LAYOUTS.crystal, "PC Storage"), 0x247f);
});

test("knowledge save layouts keep Gen 1 and Gen 2 parser offsets centralized", () => {
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.offsets.playerName, 0x2598);
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.offsets.currentMap, 0x260a);
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.offsets.currentBoxNumber, 0x284c);
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.offsets.currentMap, 0x260a);
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.liveWramOffsets.partyCount, 0xd163);
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.liveWramOffsets.partyCount, 0xd162);
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.liveWramOffsets.money, 0xd347);
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.liveWramOffsets.badges, 0xd356);
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.liveWramOffsets.currentMap, 0xd35e);
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.liveWramOffsets.trainerId, 0xd358);
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.liveWramOffsets.money, 0xd346);
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.liveWramOffsets.badges, 0xd355);
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.liveWramOffsets.currentMap, 0xd35d);
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.liveWramOffsets.currentBoxData, 0xda80);
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.liveWramSource?.name, "Data Crystal Pokemon Red and Blue RAM map");
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.liveWramOffsets.currentBoxData, 0xda94);
  assert.equal(GEN1_SAVE_LAYOUTS.redBlue.liveWramOffsets.pcItems, 0xd53b);
  assert.equal(GEN1_SAVE_LAYOUTS.yellow.liveWramOffsets.pcItems, 0xd53a);
  assert.equal(GEN2_SAVE_LAYOUTS.goldSilver.offsets.partyCount, 0x288a);
  assert.equal(GEN2_SAVE_LAYOUTS.crystal.offsets.partyCount, 0x2865);
  assert.equal(GEN2_SAVE_LAYOUTS.goldSilver.liveWramOffsets.tmsHms, 0xd57e);
  assert.equal(GEN2_SAVE_LAYOUTS.crystal.liveWramOffsets.tmsHms, 0xd859);
});

test("knowledge item ranges map Gen 1 TM and HM IDs", () => {
  assert.equal(ITEM_ID_RANGES.gen1Hms.start, 0xc4);
  assert.equal(ITEM_ID_RANGES.gen1Tms.end, 0xfa);
  assert.equal(getGen1MachineItemName(216), "TM16 Pay Day");
  assert.equal(getGen1MachineItemName(222), "TM22 Solar Beam");
});

test("knowledge keeps Gen 2 TM/HM fixed-quantity item IDs from pokecrystal", () => {
  const tmhms = GEN2_INVENTORY_LAYOUTS.crystal.pockets.find((entry) => entry.name === "TMs/HMs");

  assert.ok(tmhms?.itemIds);
  assert.deepEqual(tmhms.itemIds.slice(0, 5), [0xbf, 0xc0, 0xc1, 0xc2, 0xc4]);
  assert.equal(tmhms.itemIds[28], 0xdd);
  assert.equal(tmhms.itemIds[49], 0xf2);
  assert.equal(tmhms.itemIds[50], 0xf3);
  assert.equal(ITEM_ID_RANGES.gen2Tms.end, 0xf2);
});

test("knowledge inventory layouts keep Gen 3 profile-specific item offsets", () => {
  assert.equal(pocketOffset(GEN3_INVENTORY_LAYOUTS.rubySapphire, "Items"), 0x0560);
  assert.equal(pocketOffset(GEN3_INVENTORY_LAYOUTS.rubySapphire, "Key Items"), 0x05b0);
  assert.equal(pocketOffset(GEN3_INVENTORY_LAYOUTS.emerald, "Key Items"), 0x05d8);
  assert.equal(pocketOffset(GEN3_INVENTORY_LAYOUTS.fireRedLeafGreen, "Items"), 0x0310);
  assert.equal(pocketOffset(GEN3_INVENTORY_LAYOUTS.fireRedLeafGreen, "TMs/HMs"), 0x0464);
  assert.equal(GEN3_INVENTORY_LAYOUTS.emerald.source.name, "pret/pokeemerald");
});

test("knowledge save layouts keep Gen 3 offsets from pret save structs", () => {
  assert.equal(GEN3_SAVE_LAYOUTS.rubySapphire.offsets.partyCount, 0x0234);
  assert.equal(GEN3_SAVE_LAYOUTS.rubySapphire.offsets.money, 0x0490);
  assert.equal(GEN3_SAVE_LAYOUTS.rubySapphire.offsets.flags, 0x1220);
  assert.equal(GEN3_SAVE_LAYOUTS.rubySapphire.offsets.badgeFlagStart, 0x0807);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.encryptionKey, 0x00ac);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.flags, 0x1270);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.badgeFlagStart, 0x0867);
  assert.equal(GEN3_SAVE_LAYOUTS.fireRedLeafGreen.offsets.partyCount, 0x0034);
  assert.equal(GEN3_SAVE_LAYOUTS.fireRedLeafGreen.offsets.encryptionKey, 0x0f20);
  assert.equal(GEN3_SAVE_LAYOUTS.fireRedLeafGreen.offsets.flags, 0x0ee0);
  assert.equal(GEN3_SAVE_LAYOUTS.fireRedLeafGreen.offsets.badgeFlagStart, 0x0820);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.pokedexMode, 0x0019);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.pokedexNationalMagic, 0x001a);
  assert.equal(GEN3_SAVE_LAYOUTS.fireRedLeafGreen.offsets.pokedexMode, 0x0019);
  assert.equal(GEN3_SAVE_LAYOUTS.fireRedLeafGreen.offsets.pokedexNationalMagic, 0x001b);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.pokedexOwned, 0x0028);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.pokedexSeen, 0x005c);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.pokedexSeen1, 0x0988);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.pokedexSeen2, 0x3b24);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.boxData, 0x0004);
  assert.equal(GEN3_SAVE_LAYOUTS.emerald.offsets.boxNames, 0x8344);
});

test("knowledge keeps Gen 3 Hoenn Pokedex order from pokeemerald", () => {
  assert.equal(GEN3_HOENN_DEX_COUNT, 202);
  assert.equal(GEN3_HOENN_DEX_NATIONAL_ORDER.length, 202);
  assert.deepEqual(GEN3_HOENN_DEX_NATIONAL_ORDER.slice(0, 6), [252, 253, 254, 255, 256, 257]);
  assert.deepEqual(GEN3_HOENN_DEX_NATIONAL_ORDER.slice(-5), [382, 383, 384, 385, 386]);
  assert.equal(getGen3HoennDexNumber(252), 1);
  assert.equal(getGen3HoennDexNumber(25), 156);
  assert.equal(getGen3HoennDexNumber(1), undefined);
});

test("Gen 3 Hoenn map landmarks support indoor maps and source cursor conversion", () => {
  const lilycove = getGen3MapLandmark(0, 5);
  assert.ok(lilycove);
  assert.equal(lilycove.name, "LILYCOVE CITY");
  assert.deepEqual(getGen3RegionMapPixel(lilycove), { x: 156, y: 44 });

  const lilycovePokemonCenter = getGen3MapLandmark(13, 6);
  assert.ok(lilycovePokemonCenter);
  assert.equal(lilycovePokemonCenter.name, "LILYCOVE CITY");
  assert.deepEqual(getGen3RegionMapPixel(lilycovePokemonCenter), { x: 156, y: 44 });
});
