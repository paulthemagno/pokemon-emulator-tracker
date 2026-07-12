import test from "node:test";
import assert from "node:assert/strict";
import { decodePackedMovePP, getBaseMovePP, getMaxMovePP } from "../lib/pokemon/data/move-pp";

test("generation-specific move PP uses the pinned Gen 1-3 move tables", () => {
  assert.equal(getBaseMovePP(14, 1), 30); // Swords Dance was 30 PP in Gen 1.
  assert.equal(getBaseMovePP(94, 1), 10); // Psychic.
  assert.equal(getBaseMovePP(127, 3), 15); // Waterfall.
});

test("packed Gen 1 and 2 PP bytes preserve current PP and decode PP Ups", () => {
  assert.deepEqual(decodePackedMovePP(12 | (1 << 6), 94, 1), {
    pp: 12,
    ppUps: 1,
    maxPP: 12,
  });
  assert.deepEqual(decodePackedMovePP(14 | (2 << 6), 94, 1), {
    pp: 14,
    ppUps: 2,
    maxPP: 14,
  });
});

test("Gen 3 PP bonuses calculate the effective maximum for each move", () => {
  assert.equal(getMaxMovePP(127, 3, 3), 24); // Waterfall 15 -> 24.
  assert.equal(getMaxMovePP(89, 3, 3), 16); // Earthquake 10 -> 16.
  assert.equal(getMaxMovePP(291, 3, 3), 16); // Dive 10 -> 16.
  assert.equal(getMaxMovePP(330, 3, 3), 16); // Muddy Water 10 -> 16.
});
