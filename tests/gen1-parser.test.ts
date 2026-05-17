import test from "node:test";
import assert from "node:assert/strict";
import { parseSaveFile } from "../lib/pokemon/parsers";
import { parseGen1Save } from "../lib/pokemon/parsers/gen1";
import { getGen1ItemName } from "../lib/pokemon/data/items";

const SAVE_SIZE = 32768;
const BOX_CAPACITY = 20;
const BOX_POKEMON_SIZE = 33;

function encodeGen1Text(value: string, length: number): number[] {
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
  data.set(encodeGen1Text(value, length), offset);
}

function setSpeciesFlag(data: Uint8Array, offset: number, species: number): void {
  const bitIndex = species - 1;
  data[offset + Math.floor(bitIndex / 8)] |= 1 << (bitIndex % 8);
}

function writeBoxRecord(data: Uint8Array, offset: number, speciesIndex: number, nickname: string): void {
  data[offset] = 1;
  data[offset + 1] = speciesIndex;
  data[offset + 2] = 0xff;

  const pokemonDataOffset = offset + 0x16;
  const otNamesOffset = offset + 0x2aa;
  const nicknamesOffset = offset + 0x386;

  data[pokemonDataOffset] = speciesIndex;
  data[pokemonDataOffset + 1] = 0;
  data[pokemonDataOffset + 2] = 42;
  data[pokemonDataOffset + 3] = 18;
  data[pokemonDataOffset + 8] = 84;
  data[pokemonDataOffset + 29] = 15;
  writeText(data, otNamesOffset, "ASH", 11);
  writeText(data, nicknamesOffset, nickname, 11);
}

test("parseSaveFile passes the Gen 1 filename through for Red Blue Yellow game detection", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x2598, "ASH", 11);

  assert.equal(parseSaveFile(data.buffer, "pokemon-red.sav").success, true);

  const red = parseSaveFile(data.buffer, "pokemon-red.sav");
  const blue = parseSaveFile(data.buffer, "pokemon-blue.sav");
  const yellow = parseSaveFile(data.buffer, "pokemon-yellow.sav");

  assert.equal(red.success && red.data.game, "red");
  assert.equal(blue.success && blue.data.game, "blue");
  assert.equal(yellow.success && yellow.data.game, "yellow");
});

test("parseGen1Save parses Gen 1 seen and caught Pokedex flags", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x2598, "ASH", 11);

  const caughtOffset = 0x25a3;
  const seenOffset = 0x25b6;
  setSpeciesFlag(data, caughtOffset, 1);
  setSpeciesFlag(data, caughtOffset, 25);
  setSpeciesFlag(data, seenOffset, 1);
  setSpeciesFlag(data, seenOffset, 25);
  setSpeciesFlag(data, seenOffset, 150);

  const parsed = parseGen1Save(data, "pokemon-yellow.sav");

  assert.equal(parsed.game, "yellow");
  assert.deepEqual(parsed.pokedex?.caughtSpecies, [1, 25]);
  assert.deepEqual(parsed.pokedex?.seenSpecies, [1, 25, 150]);
  assert.equal(parsed.pokedex?.caughtCount, 2);
  assert.equal(parsed.pokedex?.seenCount, 3);
  assert.equal(parsed.pokedex?.source, "save");
});

test("parseGen1Save parses stored Gen 1 PC boxes and marks the current box", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x2598, "ASH", 11);

  data[0x284c] = 1;
  writeBoxRecord(data, 0x30c0, 0x54, "SPARKY");
  writeBoxRecord(data, 0x4000, 0x99, "BULBA");
  writeBoxRecord(data, 0x4462, 0xb1, "SQUIRT");

  const parsed = parseGen1Save(data, "pokemon-blue.sav");

  assert.equal(BOX_CAPACITY > 0 && BOX_POKEMON_SIZE > 0, true);
  assert.equal(parsed.pcBoxes.length, 12);
  assert.equal(parsed.pcBoxes[0].isCurrent, false);
  assert.equal(parsed.pcBoxes[1].isCurrent, true);
  assert.equal(parsed.pcBoxes[0].pokemon[0]?.speciesName, "Bulbasaur");
  assert.equal(parsed.pcBoxes[1].pokemon[0]?.speciesName, "Pikachu");
  assert.equal(parsed.pcBoxes[1].pokemon[0]?.nickname, "SPARKY");
  assert.equal(parsed.pcBoxes[1].pokemon[0]?.level, 18);
  assert.equal(parsed.pcBoxes[1].pokemon[0]?.currentHP, 42);
  assert.equal(parsed.pcBoxes[1].pokemon[0]?.moves[0]?.name, "Thunder Shock");
});

test("parseGen1Save maps Gen 1 indoor map ids to town map landmarks", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x2598, "ASH", 11);
  data[0x260a] = 0x29;

  const parsed = parseGen1Save(data, "pokemon-red.sav");

  assert.equal(parsed.location.mapId, 0x29);
  assert.equal(parsed.location.name, "Viridian City");
  assert.equal(parsed.location.areaType, "building");
});

test("parseGen1Save uses the shared Red Blue Yellow PC item storage offset", () => {
  const data = new Uint8Array(SAVE_SIZE);
  writeText(data, 0x2598, "ASH", 11);

  data[0x27e6] = 1;
  data[0x27e7] = 0x01;
  data[0x27e8] = 3;
  data[0x27f7] = 1;
  data[0x27f8] = 0x02;
  data[0x27f9] = 4;

  const red = parseGen1Save(data, "pokemon-red.sav");
  const yellow = parseGen1Save(data, "pokemon-yellow.sav");
  const redPcStorage = red.inventory.find((section) => section.name === "PC Storage")?.items ?? [];
  const yellowPcStorage = yellow.inventory.find((section) => section.name === "PC Storage")?.items ?? [];

  assert.deepEqual(redPcStorage.map((item) => [item.id, item.quantity]), [[1, 3]]);
  assert.deepEqual(yellowPcStorage.map((item) => [item.id, item.quantity]), [[1, 3]]);
});

test("getGen1ItemName maps Gen 1 TM and HM item IDs", () => {
  assert.equal(getGen1ItemName(216), "TM16 Pay Day");
  assert.equal(getGen1ItemName(222), "TM22 Solar Beam");
  assert.equal(getGen1ItemName(196), "HM01 Cut");
  assert.equal(getGen1ItemName(250), "TM50 Substitute");
});
