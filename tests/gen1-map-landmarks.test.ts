import test from "node:test";
import assert from "node:assert/strict";
import {
  getGen1MapLandmark,
  getGen1TownMapPixel,
} from "../lib/pokemon/data/gen1-map-landmarks";

test("Gen 1 town map landmarks include indoor map groups", () => {
  assert.deepEqual(getGen1MapLandmark(0x29), {
    name: "Viridian City",
    x: 2,
    y: 8,
  });
});

test("Gen 1 town map pixel conversion accounts for Game Boy OAM offsets", () => {
  const landmark = getGen1MapLandmark(0x01);
  assert.ok(landmark);

  assert.deepEqual(getGen1TownMapPixel(landmark), {
    x: 36,
    y: 77,
  });
});
