import test from "node:test";
import assert from "node:assert/strict";
import { mergeLiveWithSavePcBoxes } from "../lib/pokemon/pc-box-merge";
import type { PCBox, Pokemon, SaveData } from "../lib/pokemon/types";

function pokemon(species: number): Pokemon {
  return {
    species,
    speciesName: `Species ${species}`,
    nickname: `MON${species}`,
    level: 10,
    currentHP: 20,
    maxHP: 20,
    experience: 1000,
    moves: [],
    stats: {
      hp: 20,
      attack: 10,
      defense: 10,
      speed: 10,
      special: 10,
    },
    originalTrainer: "RED",
    originalTrainerID: 1,
  };
}

function box(index: number, mons: Pokemon[] = [], isCurrent = false): PCBox {
  return {
    name: `Box ${index}`,
    pokemon: mons,
    capacity: 20,
    isCurrent,
  };
}

function saveData(pcBoxes: PCBox[], game: SaveData["game"] = "red"): SaveData {
  return {
    generation: 1,
    game,
    trainer: {
      name: "RED",
      id: 1,
      money: 0,
      badges: [],
      badgeCount: 0,
      playTime: { hours: 0, minutes: 0 },
    },
    party: [],
    pcBoxes,
    inventory: [],
    location: { mapId: 0, name: "Pallet Town" },
    valid: true,
    rawSize: 32768,
  };
}

test("live PC box merge keeps current live box and fills non-current boxes from save", () => {
  const live = saveData([
    box(1, [], false),
    box(2, [pokemon(25)], true),
    box(3, [], false),
  ]);
  const file = saveData([
    box(1, [pokemon(1)], false),
    box(2, [pokemon(4)], false),
    box(3, [pokemon(7)], false),
  ]);

  const merged = mergeLiveWithSavePcBoxes(live, file);

  assert.deepEqual(merged.pcBoxes.map((entry) => entry.pokemon[0]?.species), [1, 25, 7]);
  assert.equal(merged.pcBoxes[1].isCurrent, true);
  assert.equal(merged.pcBoxes[1].name, "Box 2");
});

test("live PC box merge falls back to save current box if live current box is empty", () => {
  const live = saveData([
    box(1, [], false),
    box(2, [], true),
  ]);
  const file = saveData([
    box(1, [pokemon(10)], false),
    box(2, [pokemon(20)], false),
  ]);

  const merged = mergeLiveWithSavePcBoxes(live, file);

  assert.equal(merged.pcBoxes[1].pokemon[0]?.species, 20);
  assert.equal(merged.pcBoxes[1].isCurrent, true);
});

test("live PC box merge allows Red and Blue because their PC box layout is shared", () => {
  const live = saveData([box(1, [], true)], "red");
  const file = saveData([box(1, [pokemon(151)], false)], "blue");

  const merged = mergeLiveWithSavePcBoxes(live, file);

  assert.equal(merged.pcBoxes[0].pokemon[0]?.species, 151);
});

test("live PC box merge does not mix Yellow with Red and Blue", () => {
  const live = saveData([box(1, [], true)], "yellow");
  const file = saveData([box(1, [pokemon(151)], false)], "blue");

  const merged = mergeLiveWithSavePcBoxes(live, file);

  assert.equal(merged.pcBoxes[0].pokemon.length, 0);
});
