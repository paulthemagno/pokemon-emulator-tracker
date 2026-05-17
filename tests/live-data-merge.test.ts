import test from "node:test";
import assert from "node:assert/strict";
import { mergeLiveData } from "../lib/pokemon/live-data-merge";
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

function live(pcBoxes: PCBox[]): SaveData {
  return {
    generation: 1,
    game: "red",
    trainer: {
      name: "RED",
      id: 1,
      money: 0,
      badges: [],
      badgeCount: 0,
      playTime: { hours: 1, minutes: 0, seconds: 0 },
    },
    party: [],
    pcBoxes,
    inventory: [],
    location: { mapId: 1, name: "Pallet Town" },
    valid: true,
    rawSize: 0,
  };
}

test("live polling keeps previously seen Gen 1 boxes when only current WRAM box is readable", () => {
  const previous = live([
    box(1, [pokemon(25)], true),
    box(2, [], false),
    box(3, [], false),
  ]);
  const next = live([
    box(1, [], false),
    box(2, [pokemon(150)], true),
    box(3, [], false),
  ]);

  const merged = mergeLiveData(previous, next);

  assert.equal(merged.pcBoxes[0].pokemon[0]?.species, 25);
  assert.equal(merged.pcBoxes[0].isCurrent, false);
  assert.equal(merged.pcBoxes[1].pokemon[0]?.species, 150);
  assert.equal(merged.pcBoxes[1].isCurrent, true);
  assert.equal(merged.pcBoxes[1].name, "Box 2");
});
