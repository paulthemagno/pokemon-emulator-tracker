import test from "node:test";
import assert from "node:assert/strict";
import { getFilenameGame } from "../lib/pokemon/game-detection";
import { parseSaveFile } from "../lib/pokemon/parsers";

function gbSave(kind: "rb" | "yellow" | "gs" | "crystal") {
  const bytes = new Uint8Array(32768);
  const view = new DataView(bytes.buffer);
  const gen1 = kind === "rb" || kind === "yellow";
  const party = gen1 ? 0x2f2c : kind === "gs" ? 0x288a : 0x2865;
  bytes[party + 1] = 0xff;
  bytes[gen1 ? 0x2598 : 0x200b] = 0x80;
  bytes[(gen1 ? 0x2598 : 0x200b) + 1] = 0x50;
  if (gen1) bytes[0x29c3] = kind === "yellow" ? 0x54 : 0x99;
  const start = gen1 ? 0x2598 : 0x2009;
  const end = gen1 ? 0x3522 : kind === "gs" ? 0x2d68 : 0x2b82;
  let sum = 0;
  for (let i = start; i <= end; i++) sum += bytes[i];
  if (gen1) bytes[0x3523] = (~sum) & 0xff;
  else view.setUint16(kind === "gs" ? 0x2d69 : 0x2d0d, sum & 0xffff, true);
  return bytes.buffer;
}

test("localized title hints resolve all eleven games without substring collisions", () => {
  for (const [name, game] of [
    ["Verde Foglia", "leafgreen"], ["Blattgrün", "leafgreen"],
    ["Rosso_Fuoco", "firered"], ["Feuerrot", "firered"],
    ["Smeraldo", "emerald"], ["Smaragd", "emerald"], ["Émeraude", "emerald"],
    ["Zaffiro", "sapphire"], ["Rubino", "ruby"], ["Rubí", "ruby"],
    ["Cristallo", "crystal"], ["Kristall", "crystal"],
    ["Argento", "silver"], ["Silber", "silver"], ["Oro", "gold"],
    ["Giallo", "yellow"], ["Gelb", "yellow"], ["Blu", "blue"], ["Blau", "blue"],
    ["Rosso", "red"], ["Rot", "red"],
  ]) assert.equal(getFilenameGame(`Pokemon - ${name}.sav`), game);
  assert.equal(getFilenameGame("unlabeled.sav"), undefined);
  assert.equal(getFilenameGame("my-lg-random.sav"), undefined);
});

test("anonymous GB saves identify unique games or request only compatible paired titles", () => {
  for (const [kind, game] of [["yellow", "yellow"], ["crystal", "crystal"]] as const) {
    const result = parseSaveFile(gbSave(kind), "unlabeled.sav");
    assert.ok(result.success);
    if (result.success) assert.equal(result.data.game, game);
  }
  for (const [kind, candidates] of [["rb", ["red", "blue"]], ["gs", ["gold", "silver"]]] as const) {
    const result = parseSaveFile(gbSave(kind), "unlabeled.sav");
    assert.equal(result.success, false);
    if (!result.success) assert.deepEqual(result.candidates, candidates);
    const selected = parseSaveFile(gbSave(kind), "unlabeled.sav", candidates[1]);
    assert.ok(selected.success);
    if (selected.success) assert.equal(selected.data.game, candidates[1]);
  }
});

test("GB content overrides misleading filenames and validates checksums before title hints", () => {
  const yellow = parseSaveFile(gbSave("yellow"), "Pokemon Gold.sav");
  assert.ok(yellow.success);
  if (yellow.success) assert.equal(yellow.data.game, "yellow");
  const crystal = parseSaveFile(gbSave("crystal"), "Pokemon Rosso.sav");
  assert.ok(crystal.success);
  if (crystal.success) assert.equal(crystal.data.game, "crystal");
  assert.equal(parseSaveFile(gbSave("gs"), "unlabeled.sav", "ruby").success, false);
  const corrupt = new Uint8Array(gbSave("gs"));
  corrupt[0x2100] ^= 1;
  assert.equal(parseSaveFile(corrupt.buffer, "Pokemon Gold.sav").success, false);
  for (const fill of [0, 0xff, 0x80]) {
    assert.equal(parseSaveFile(new Uint8Array(32768).fill(fill).buffer, "Pokemon Red.sav").success, false);
  }
});
