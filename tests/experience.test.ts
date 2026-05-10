import test from "node:test";
import assert from "node:assert/strict";
import { getExpWindow } from "../lib/pokemon/experience";
import { getSpeciesById, OFFICIAL_GROWTH_RATES } from "../lib/pokemon/data/species";

test("Gen 1-3 species all have an official growth rate", () => {
  const missing = [];

  for (let id = 1; id <= 386; id++) {
    const species = getSpeciesById(id);
    if (!species.growthRate) {
      missing.push(`${id}:${species.name}`);
    }
  }

  assert.deepEqual(missing, []);
  assert.equal(Object.keys(OFFICIAL_GROWTH_RATES).length, 386);
});

test("Chikorita level 5 EXP matches the in-game next-level value", () => {
  const chikorita = getSpeciesById(152);
  const expWindow = getExpWindow(5, 135, chikorita.growthRate);

  assert.equal(chikorita.growthRate, "medium-slow");
  assert.equal(expWindow.current, 135);
  assert.equal(expWindow.next, 179);
  assert.equal(expWindow.next - 135, 44);
});

test("EXP windows prefer the official species curve when multiple curves fit", () => {
  const caterpie = getSpeciesById(10);
  const crobat = getSpeciesById(169);
  const larvitar = getSpeciesById(246);

  assert.equal(caterpie.growthRate, "medium-fast");
  assert.equal(crobat.growthRate, "medium-fast");
  assert.equal(larvitar.growthRate, "slow");
});
