import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLiveSnapshot } from "../lib/pokemon/live-normalizer";

test("normalizeLiveSnapshot preserves live PC box names and current-box marker", () => {
  const data = normalizeLiveSnapshot({
    generation: 2,
    game: "crystal",
    player: {
      name: "PAUL",
      id: 64575,
      badges: [],
      playTime: { hours: 1, minutes: 2, seconds: 3 },
    },
    party: [],
    pcBoxes: [
      {
        name: "WATER",
        isCurrent: true,
        capacity: 20,
        pokemon: [{ speciesID: 160, nickname: "Feraligatr", level: 62 }],
      },
      {
        name: "EMPTY",
        capacity: 20,
        pokemon: [],
      },
      {
        name: "FLYING",
        capacity: 20,
        pokemon: [{ speciesID: 169, nickname: "Crobat", level: 62 }],
      },
    ],
  });

  assert.equal(data.pcBoxes.length, 3);
  assert.equal(data.pcBoxes[0].name, "WATER");
  assert.equal(data.pcBoxes[0].isCurrent, true);
  assert.equal(data.pcBoxes[0].pokemon[0]?.species, 160);
  assert.equal(data.pcBoxes[1].name, "EMPTY");
  assert.equal(data.pcBoxes[1].pokemon.length, 0);
  assert.equal(data.pcBoxes[2].name, "FLYING");
  assert.equal(data.pcBoxes[2].isCurrent, false);
});

test("normalizeLiveSnapshot treats Current Box fallback as current", () => {
  const data = normalizeLiveSnapshot({
    player: {},
    party: [],
    pcBoxes: [
      {
        name: "Current Box (Live)",
        capacity: 20,
        pokemon: [{ speciesID: 25, nickname: "Pikachu", level: 10 }],
      },
    ],
  });

  assert.equal(data.pcBoxes.length, 1);
  assert.equal(data.pcBoxes[0].isCurrent, true);
  assert.equal(data.pcBoxes[0].name, "Box 1");
});

test("normalizeLiveSnapshot preserves empty live PC box payloads as empty", () => {
  const data = normalizeLiveSnapshot({
    generation: 3,
    game: "ruby",
    player: {},
    party: [],
    pcBoxes: [],
  });

  assert.equal(data.pcBoxes.length, 0);
});

test("normalizeLiveSnapshot infers Gen 3 boxed Pokemon levels from experience", () => {
  const data = normalizeLiveSnapshot({
    generation: 3,
    game: "ruby",
    player: {},
    party: [],
    pcBoxes: [
      {
        name: "Box 1",
        capacity: 30,
        pokemon: [{ species: 1, nickname: "BULBASAUR", experience: 135 }],
      },
    ],
  });

  assert.equal(data.pcBoxes[0].pokemon[0]?.level, 5);
});

test("normalizeLiveSnapshot preserves Gen 3 live egg state with underlying species", () => {
  const data = normalizeLiveSnapshot({
    generation: 3,
    game: "firered",
    player: {},
    party: [],
    pcBoxes: [
      {
        name: "Box 1",
        capacity: 30,
        pokemon: [{ species: 7, speciesName: "Squirtle", nickname: "EGG", isEgg: true }],
      },
    ],
  });

  const egg = data.pcBoxes[0].pokemon[0];
  assert.equal(egg?.isEgg, true);
  assert.equal(egg?.species, 7);
  assert.equal(egg?.speciesName, "Squirtle");
});

test("normalizeLiveSnapshot accepts badge objects and normalizes trainer metadata", () => {
  const data = normalizeLiveSnapshot({
    generation: 2,
    game: "crystal",
    player: {
      name: "PAUL",
      gender: "female",
      id: 64575,
      money: 5183,
      badges: [{ earned: true }, { earned: false }, true],
      playTime: { hours: 133, minutes: 41, seconds: 45 },
    },
    party: [],
    pcBoxes: [],
  });

  assert.equal(data.trainer.name, "PAUL");
  assert.equal(data.trainer.gender, "female");
  assert.equal(data.trainer.money, 5183);
  assert.deepEqual(data.trainer.badges, [true, false, true]);
  assert.equal(data.trainer.badgeCount, 2);
  assert.equal(data.trainer.playTime.hours, 133);
});

test("normalizeLiveSnapshot maps live Pokemon fields, moves, status, and held item", () => {
  const data = normalizeLiveSnapshot({
    player: {},
    party: [
      {
        speciesID: 169,
        nickname: "CROBAT",
        level: 62,
        currentHP: 205,
        maxHP: 205,
        attack: 153,
        defense: 138,
        speed: 192,
        specialAttack: 115,
        specialDefense: 127,
        status: 0x10,
        heldItem: 73,
        moves: [{ id: 19, pp: 15 }],
      },
    ],
    pcBoxes: [],
  });

  const crobat = data.party[0];
  assert.equal(crobat.species, 169);
  assert.equal(crobat.speciesName, "Crobat");
  assert.equal(crobat.nickname, "CROBAT");
  assert.equal(crobat.stats.speed, 192);
  assert.equal(crobat.status, "burn");
  assert.equal(crobat.heldItem, 73);
  assert.equal(crobat.moves[0].id, 19);
  assert.equal(crobat.moves[0].name, "Fly");
});

test("normalizeLiveSnapshot normalizes live inventory pockets", () => {
  const data = normalizeLiveSnapshot({
    player: {},
    party: [],
    pcBoxes: [],
    bag: {
      items: [{ id: 1, quantity: 3 }],
      keyItems: [{ id: 7 }],
      pokeballs: [{ id: 4, count: 12 }],
      tmhms: {
        tms: [{ id: 0xbf, quantity: 2 }],
        hms: [{ id: 0xf3, quantity: 1 }],
      },
      pcStorage: [{ id: 0x49, quantity: 1 }],
    },
  });

  assert.deepEqual(
    data.inventory.map((section) => [section.name, section.items.length]),
    [["Items", 1], ["Key Items", 1], ["Poke Balls", 1], ["TMs/HMs", 2], ["PC Storage", 1]]
  );
  assert.equal(data.inventory[2].items[0].quantity, 12);
  assert.equal(data.inventory[3].items[0].id, 0xbf);
  assert.equal(data.inventory[3].items[1].id, 0xf3);
  assert.equal(data.inventory[4].items[0].name, "Quick Claw");
});

test("normalizeLiveSnapshot uses Gen 1 item names and locations for Gen 1 live snapshots", () => {
  const data = normalizeLiveSnapshot({
    generation: 1,
    game: "yellow",
    player: {},
    party: [],
    pcBoxes: [],
    location: { mapId: 0 },
    bag: {
      items: [{ id: 0x04, quantity: 2 }],
      pcStorage: [{ id: 0xc9, quantity: 1 }],
    },
  });

  assert.equal(data.inventory[0].items[0].name, "Poke Ball");
  assert.equal(data.inventory[1].items[0].name, "TM01 Mega Punch");
  assert.equal(data.location.name, "Pallet Town");
});

test("normalizeLiveSnapshot maps Gen 1 indoor maps to town map landmarks", () => {
  const data = normalizeLiveSnapshot({
    generation: 1,
    game: "red",
    player: {},
    party: [],
    pcBoxes: [],
    location: { mapId: 0x29, name: "Pokemon Center" },
  });

  assert.equal(data.location.name, "Viridian City");
});

test("normalizeLiveSnapshot preserves Gen 3 outdoor map group zero for Hoenn markers", () => {
  const data = normalizeLiveSnapshot({
    generation: 3,
    game: "ruby",
    player: {},
    party: [],
    pcBoxes: [],
    location: { mapGroup: 0, mapId: 9, name: "Live" },
  });

  assert.equal(data.location.mapGroup, 0);
  assert.equal(data.location.mapId, 9);
  assert.equal(data.location.name, "LITTLEROOT TOWN");
});

test("normalizeLiveSnapshot normalizes live Pokedex progress", () => {
  const data = normalizeLiveSnapshot({
    player: {},
    party: [],
    pcBoxes: [],
    pokedex: {
      seenSpecies: [25, "160", 0, null, 169],
      caughtSpecies: [25, "160"],
      seenCount: 3,
      caughtCount: 2,
    },
  });

  assert.deepEqual(data.pokedex?.seenSpecies, [25, 160, 169]);
  assert.deepEqual(data.pokedex?.caughtSpecies, [25, 160]);
  assert.equal(data.pokedex?.seenCount, 3);
  assert.equal(data.pokedex?.caughtCount, 2);
  assert.equal(data.pokedex?.source, "live");
});

test("normalizeLiveSnapshot keeps Gen 3 FireRed/LeafGreen live Pokedex regional mode as Kanto", () => {
  const data = normalizeLiveSnapshot({
    generation: 3,
    game: "firered",
    player: {},
    party: [],
    pcBoxes: [],
    pokedex: {
      seenSpecies: [1, 25, 252],
      caughtSpecies: [1, 252],
      seenCount: 3,
      caughtCount: 2,
      mode: "regional",
    },
  });

  assert.equal(data.pokedex?.mode, "regional");
  assert.equal(data.pokedex?.regionalDex, "kanto");
  assert.equal(data.pokedex?.dexMax, 151);
});
