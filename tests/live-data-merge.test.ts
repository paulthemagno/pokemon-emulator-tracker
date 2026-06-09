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

function gen3Live(pcBoxes: PCBox[]): SaveData {
  return {
    ...live(pcBoxes),
    generation: 3,
    game: "ruby",
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

test("live polling accepts Hoenn Petalburg City at map group zero and map id zero", () => {
  const previous = live([]);
  const next: SaveData = {
    ...live([]),
    generation: 3,
    game: "ruby",
    location: { mapGroup: 0, mapId: 0, name: "PETALBURG CITY", x: 12, y: 8 },
  };

  const merged = mergeLiveData(previous, next);

  assert.equal(merged.location.mapGroup, 0);
  assert.equal(merged.location.mapId, 0);
  assert.equal(merged.location.name, "PETALBURG CITY");
});

test("live polling drops stale Gen 3 PC boxes when the adapter cannot resolve storage", () => {
  const previous = gen3Live([
    box(1, [pokemon(1)], false),
    box(2, [pokemon(4)], false),
  ]);
  const next = gen3Live([]);

  const merged = mergeLiveData(previous, next);

  assert.equal(merged.pcBoxes.length, 0);
});

test("live polling accepts forward play-time jumps from a refreshed live source", () => {
  const previous = gen3Live([]);
  const next = {
    ...gen3Live([]),
    trainer: {
      ...previous.trainer,
      playTime: { hours: 2, minutes: 15, seconds: 30 },
    },
  };

  const merged = mergeLiveData(previous, next);

  assert.deepEqual(merged.trainer.playTime, { hours: 2, minutes: 15, seconds: 30 });
});

test("live polling replaces a corrupted trainer snapshot with valid Gen 3 data", () => {
  const previous = {
    ...gen3Live([]),
    game: "firered" as const,
    trainer: {
      ...gen3Live([]).trainer,
      name: "CORRUPT",
      id: 65535,
      money: 0,
      badges: [false, false, false, false, false, false, false, false],
      badgeCount: 0,
      playTime: { hours: 65535, minutes: 2, seconds: 192 },
    },
  };
  const next = {
    ...gen3Live([]),
    game: "firered" as const,
    trainer: {
      ...gen3Live([]).trainer,
      name: "PLAYER",
      id: 12345,
      money: 4321,
      badges: [true, true, true, true, true, true, true, true],
      badgeCount: 8,
      playTime: { hours: 42, minutes: 28, seconds: 2 },
    },
  };

  const merged = mergeLiveData(previous, next);

  assert.deepEqual(merged.trainer, next.trainer);
});

test("live polling resets stale state when switching Gen 3 games", () => {
  const previous = {
    ...gen3Live([box(1, [pokemon(1)], true)]),
    game: "ruby" as const,
    trainer: {
      ...gen3Live([]).trainer,
      name: "RUBY",
      money: 1234,
    },
    party: [pokemon(25)],
  };
  const next = {
    ...gen3Live([]),
    game: "emerald" as const,
    trainer: {
      ...gen3Live([]).trainer,
      name: "EMER",
      money: 99,
    },
    inventory: [],
  };

  const merged = mergeLiveData(previous, next);

  assert.equal(merged.game, "emerald");
  assert.equal(merged.trainer.name, "EMER");
  assert.equal(merged.trainer.money, 99);
  assert.deepEqual(merged.party, []);
  assert.deepEqual(merged.pcBoxes, []);
});

test("live polling resets stale state when switching incompatible games", () => {
  const previous = {
    ...live([box(1, [pokemon(25)], true)]),
    generation: 2 as const,
    game: "crystal" as const,
    trainer: {
      ...live([]).trainer,
      name: "KRIS",
    },
    party: [pokemon(152)],
  };
  const next = {
    ...live([]),
    generation: 3 as const,
    game: "emerald" as const,
    trainer: {
      ...live([]).trainer,
      name: "EMER",
    },
  };

  const merged = mergeLiveData(previous, next);

  assert.equal(merged.generation, 3);
  assert.equal(merged.game, "emerald");
  assert.equal(merged.trainer.name, "EMER");
  assert.deepEqual(merged.party, []);
  assert.deepEqual(merged.pcBoxes, []);
});
