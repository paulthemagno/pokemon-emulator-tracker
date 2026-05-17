import test from "node:test";
import assert from "node:assert/strict";
import { parseGen2Save } from "../lib/pokemon/parsers/gen2";

const SAVE_SIZE = 32768;
const CURRENT_BOX_OFFSET = 0x2d10;
const BOX_CAPACITY = 20;
const BOX_POKEMON_SIZE = 32;
const BOX_NAME_LENGTH = 9;
const BOX_RECORD_SIZE = 1 + BOX_CAPACITY + 1 + BOX_CAPACITY * BOX_POKEMON_SIZE + BOX_CAPACITY * 11 + BOX_CAPACITY * 11;
const BOX_OFFSETS = [
  0x4000, 0x4450, 0x48a0, 0x4cf0, 0x5140, 0x5590, 0x59e0,
  0x6000, 0x6450, 0x68a0, 0x6cf0, 0x7140, 0x7590, 0x79e0,
];

function encodeGen2Text(value: string, length: number): number[] {
  const bytes = Array.from({ length }, () => 0x50);
  for (let i = 0; i < Math.min(value.length, length - 1); i++) {
    const code = value.toUpperCase().charCodeAt(i);
    if (code >= 65 && code <= 90) {
      bytes[i] = 0x80 + code - 65;
    } else if (code >= 48 && code <= 57) {
      bytes[i] = 0xf6 + code - 48;
    } else if (value[i] === " ") {
      bytes[i] = 0x7f;
    }
  }
  return bytes;
}

function writeText(data: Uint8Array, offset: number, value: string, length: number): void {
  data.set(encodeGen2Text(value, length), offset);
}

function writeBoxRecord(data: Uint8Array, offset: number, species: number, nickname: string): void {
  data[offset] = 1;
  data[offset + 1] = species;
  data[offset + 2] = 0xff;

  const pokemonDataOffset = offset + 1 + BOX_CAPACITY + 1;
  const otNamesOffset = pokemonDataOffset + BOX_CAPACITY * BOX_POKEMON_SIZE;
  const nicknamesOffset = otNamesOffset + BOX_CAPACITY * 11;

  data[pokemonDataOffset] = species;
  data[pokemonDataOffset + 2] = 33;
  data[pokemonDataOffset + 23] = 15;
  data[pokemonDataOffset + 27] = 200;
  data[pokemonDataOffset + 31] = 50;
  writeText(data, otNamesOffset, "PAUL", 11);
  writeText(data, nicknamesOffset, nickname, 11);
}

function writeBoxNames(data: Uint8Array, base: number, currentBoxIndex: number, names: string[]): void {
  data[base - 3] = currentBoxIndex;
  names.forEach((name, index) => {
    writeText(data, base + index * BOX_NAME_LENGTH, name, BOX_NAME_LENGTH);
  });
}

function setSpeciesFlag(data: Uint8Array, offset: number, species: number): void {
  const bitIndex = species - 1;
  data[offset + Math.floor(bitIndex / 8)] |= 1 << (bitIndex % 8);
}

test("parseGen2Save uses the current PC box in its named slot without duplicating it", () => {
  const data = new Uint8Array(SAVE_SIZE);
  const names = [
    "GRASS", "WATER", "FIRE", "BIRD", "BUG", "ROCK", "GHOST",
    "ICE", "DRAGON", "DARK", "STEEL", "ELEC", "PSY", "MISC",
  ];

  writeText(data, 0x200b, "PAUL", 11);
  data[0x2865] = 0;
  writeBoxNames(data, 0x2100, 1, names);
  writeBoxRecord(data, CURRENT_BOX_OFFSET, 160, "LIVEBOX");
  writeBoxRecord(data, BOX_OFFSETS[0], 169, "CROBAT");
  writeBoxRecord(data, BOX_OFFSETS[1], 25, "STALE");
  writeBoxRecord(data, BOX_OFFSETS[2], 59, "ARCANINE");

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");
  const waterBoxes = parsed.pcBoxes.filter((box) => box.name === "WATER");
  const currentBoxes = parsed.pcBoxes.filter((box) => box.isCurrent);

  assert.equal(parsed.pcBoxes.length, 3);
  assert.equal(waterBoxes.length, 1);
  assert.equal(currentBoxes.length, 1);
  assert.equal(currentBoxes[0].name, "WATER");
  assert.equal(currentBoxes[0].pokemon[0]?.species, 160);
  assert.equal(parsed.pcBoxes.some((box) => box.pokemon[0]?.nickname === "STALE"), false);
  assert.equal(BOX_RECORD_SIZE > 0, true);
});

test("parseGen2Save returns generic empty boxes when no PC data is present", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");

  assert.equal(parsed.pcBoxes.length, 14);
  assert.equal(parsed.pcBoxes[0].name, "Box 1");
  assert.equal(parsed.pcBoxes[13].name, "Box 14");
  assert.equal(parsed.pcBoxes.every((box) => box.pokemon.length === 0), true);
});

test("parseGen2Save reads official Gold box names and current box index", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "OSCAR", 11);
  data[0x288a] = 0;

  const names = [
    "BOX1", "BOX2", "BOX3", "BOX4", "BOX5", "BOX6", "BOX7",
    "BOX8", "BOX9", "BOX10", "BOX11", "BOX12", "BOX13", "BOX14",
  ];

  data[0x2724] = 0;
  names.forEach((name, index) => {
    writeText(data, 0x2727 + index * 9, name, 9);
  });

  const parsed = parseGen2Save(data, "pokemon-gold.sav");

  assert.equal(parsed.pcBoxes.length, 14);
  assert.equal(parsed.pcBoxes[0].name, "BOX1");
  assert.equal(parsed.pcBoxes[1].name, "BOX2");
  assert.equal(parsed.pcBoxes[9].name, "BOX10");
  assert.equal(parsed.pcBoxes[13].name, "BOX14");
  assert.equal(parsed.pcBoxes[0].isCurrent, true);
});

test("parseGen2Save parses Crystal bag pockets from the correct offsets", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);

  data[0x2420] = 1;
  data[0x2421] = 0x01;
  data[0x2422] = 3;
  data[0x244a] = 1;
  data[0x244b] = 0x07;
  data[0x2465] = 1;
  data[0x2466] = 0x04;
  data[0x2467] = 12;
  data[0x23e7] = 2;
  data[0x23e7 + 4] = 1;
  data[0x23e7 + 28] = 1;
  data[0x23e7 + 49] = 1;
  data[0x23e7 + 50] = 1;

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");
  const items = parsed.inventory.find((section) => section.name === "Items")?.items ?? [];
  const keyItems = parsed.inventory.find((section) => section.name === "Key Items")?.items ?? [];
  const balls = parsed.inventory.find((section) => section.name === "Poke Balls")?.items ?? [];
  const tmhms = parsed.inventory.find((section) => section.name === "TMs/HMs")?.items ?? [];

  assert.deepEqual(items.map((item) => [item.id, item.quantity, item.pocket]), [[1, 3, "Items"]]);
  assert.deepEqual(keyItems.map((item) => [item.id, item.quantity, item.pocket]), [[7, 1, "Key Items"]]);
  assert.deepEqual(balls.map((item) => [item.id, item.quantity, item.pocket]), [[4, 12, "Balls"]]);
  assert.equal(tmhms.length, 5);
  assert.equal(tmhms[0].id, 0xbf);
  assert.equal(tmhms[0].quantity, 2);
  assert.equal(tmhms[1].id, 0xc4);
  assert.equal(tmhms[2].id, 0xdd);
  assert.equal(tmhms[3].id, 0xf2);
  assert.equal(tmhms[4].id, 0xf3);
  assert.equal(tmhms[4].quantity, 1);
});

test("parseGen2Save parses Crystal PC item storage separately from bag pockets", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);

  data[0x247f] = 2;
  data[0x2480] = 0x49;
  data[0x2481] = 1;
  data[0x2482] = 0x5b;
  data[0x2483] = 3;
  data[0x2484] = 0xff;

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");
  const pcStorage = parsed.inventory.find((section) => section.name === "PC Storage")?.items ?? [];

  assert.deepEqual(pcStorage.map((item) => [item.id, item.name, item.quantity, item.pocket]), [
    [0x49, "Quick Claw", 1, "PC Storage"],
    [0x5b, "Amulet Coin", 3, "PC Storage"],
  ]);
});

test("parseGen2Save reads Gold/Silver money as a 24-bit big-endian integer", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "OSCAR", 11);
  data[0x288a] = 0;

  data[0x23db] = 0x00;
  data[0x23dc] = 0x0b;
  data[0x23dd] = 0xb8;

  const parsed = parseGen2Save(data, "pokemon-gold.sav");

  assert.equal(parsed.game, "gold");
  assert.equal(parsed.trainer.name, "OSCAR");
  assert.equal(parsed.trainer.money, 3000);
});

test("parseGen2Save reads Crystal money as a 24-bit big-endian integer", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);
  data[0x2865] = 0;

  data[0x23dc] = 0x00;
  data[0x23dd] = 0x14;
  data[0x23de] = 0x3f;

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");

  assert.equal(parsed.game, "crystal");
  assert.equal(parsed.trainer.money, 5183);
});

test("parseGen2Save reads Crystal play time from 1-byte HMS layout", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);
  data[0x2865] = 0;

  data[0x2053] = 131;
  data[0x2054] = 38;
  data[0x2055] = 0;
  data[0x2056] = 44;

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");

  assert.equal(parsed.trainer.playTime.hours, 131);
  assert.equal(parsed.trainer.playTime.minutes, 38);
  assert.equal(parsed.trainer.playTime.seconds, 0);
});

test("parseGen2Save reads Gold/Silver play time from 1-byte HMS layout", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "OSCAR", 11);
  data[0x288a] = 0;

  data[0x2053] = 131;
  data[0x2054] = 38;
  data[0x2055] = 0;
  data[0x2056] = 44;

  const parsed = parseGen2Save(data, "pokemon-silver.sav");

  assert.equal(parsed.trainer.playTime.hours, 131);
  assert.equal(parsed.trainer.playTime.minutes, 38);
  assert.equal(parsed.trainer.playTime.seconds, 0);
});

test("parseGen2Save reads Crystal player location from save location block", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);
  data[0x2865] = 0;
  data[0x2843] = 24;
  data[0x2844] = 7;
  data[0x2845] = 9;
  data[0x2846] = 12;

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");
  assert.equal(parsed.location.mapGroup, 24);
  assert.equal(parsed.location.mapId, 7);
  assert.equal(parsed.location.x, 9);
  assert.equal(parsed.location.y, 12);
});

test("parseGen2Save reads Crystal File Gender from save offset 0x3E3D", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);
  data[0x2865] = 0;
  data[0x3e3d] = 0;

  const parsedMale = parseGen2Save(data, "pokemon-crystal.sav");
  assert.equal(parsedMale.trainer.gender, "male");

  data[0x3e3d] = 1;
  const parsedFemale = parseGen2Save(data, "pokemon-crystal.sav");
  assert.equal(parsedFemale.trainer.gender, "female");
});

test("parseGen2Save hides Crystal gender when File Gender byte is not 0 or 1", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);
  data[0x2865] = 0;
  data[0x3e3d] = 2;

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");
  assert.equal(parsed.trainer.gender, undefined);
});

test("parseGen2Save parses Gen 2 seen and caught Pokedex flags", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x200b, "PAUL", 11);

  const caughtOffset = 0x2865 + 0x1c2;
  const seenOffset = caughtOffset + Math.ceil(251 / 8);
  setSpeciesFlag(data, caughtOffset, 25);
  setSpeciesFlag(data, caughtOffset, 160);
  setSpeciesFlag(data, seenOffset, 25);
  setSpeciesFlag(data, seenOffset, 160);
  setSpeciesFlag(data, seenOffset, 169);

  const parsed = parseGen2Save(data, "pokemon-crystal.sav");

  assert.deepEqual(parsed.pokedex?.caughtSpecies, [25, 160]);
  assert.deepEqual(parsed.pokedex?.seenSpecies, [25, 160, 169]);
  assert.equal(parsed.pokedex?.caughtCount, 2);
  assert.equal(parsed.pokedex?.seenCount, 3);
  assert.equal(parsed.pokedex?.source, "save");
});
