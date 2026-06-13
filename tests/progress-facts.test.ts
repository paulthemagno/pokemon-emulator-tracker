import test from "node:test";
import assert from "node:assert/strict";

import { buildProgressFacts } from "../lib/pokemon/progress-facts";
import type { GameEventProgress } from "../lib/pokemon/types";

function events(values: Array<[string, boolean]>): GameEventProgress {
  return {
    source: "save",
    completedCount: values.filter(([, set]) => set).length,
    totalCount: values.length,
    importantCompletedCount: 0,
    importantTotalCount: 0,
    flags: values.map(([key, set], id) => ({
      id,
      key,
      label: key,
      category: "Other",
      completed: set,
      rawSet: set,
    })),
  };
}

test("Hoenn starter value zero is hidden until Birch state proves a choice occurred", () => {
  const beforeChoice = buildProgressFacts({
    generation: 3,
    game: "emerald",
    source: "save",
    raw: { starterMon: 0, birchLabState: 0 },
  });
  assert.equal(beforeChoice, undefined);

  const afterChoice = buildProgressFacts({
    generation: 3,
    game: "emerald",
    source: "save",
    raw: { starterMon: 0, birchLabState: 2 },
  });
  assert.equal(afterChoice?.facts.find((fact) => fact.key === "starter-choice")?.value, "Treecko");
});

test("FireRed and LeafGreen starter value is hidden until the Pokemon received flag is set", () => {
  const beforeChoice = buildProgressFacts({
    generation: 3,
    game: "firered",
    source: "save",
    events: events([["FLAG_SYS_POKEMON_GET", false]]),
    raw: { starterMon: 0 },
  });
  assert.equal(beforeChoice?.facts.some((fact) => fact.key === "starter-choice"), false);
  assert.match(
    beforeChoice?.facts.find((fact) => fact.key === "main-story-progress")?.description ?? "",
    /receive the Pokédex/
  );

  const afterChoice = buildProgressFacts({
    generation: 3,
    game: "firered",
    source: "save",
    events: events([["FLAG_SYS_POKEMON_GET", true]]),
    raw: { starterMon: 0 },
  });
  assert.equal(afterChoice?.facts.find((fact) => fact.key === "starter-choice")?.value, "Bulbasaur");
});

test("main story progress reports flexible required objectives without claiming they are available now", () => {
  const facts = buildProgressFacts({
    generation: 1,
    game: "yellow",
    source: "save",
    events: events([
      ["EVENT_GOT_POKEDEX", true],
      ["EVENT_BEAT_BROCK", true],
      ["EVENT_BEAT_MISTY", true],
      ["EVENT_BEAT_LT_SURGE", true],
      ["EVENT_BEAT_ERIKA", false],
      ["EVENT_BEAT_KOGA", true],
      ["EVENT_BEAT_SABRINA", false],
      ["EVENT_BEAT_BLAINE", false],
      ["EVENT_BEAT_VIRIDIAN_GYM_GIOVANNI", false],
      ["EVENT_BEAT_CHAMPION_RIVAL", false],
    ]),
  });
  const story = facts?.facts.find((fact) => fact.key === "main-story-progress");
  assert.equal(story?.value, "4/8 major battles recorded");
  assert.match(story?.description ?? "", /different orders/);
  assert.doesNotMatch(story?.description ?? "", /available now/i);
});

test("Yellow Oak Lab phase uses the Yellow-specific script table and disappears after the Pokedex", () => {
  const parcel = buildProgressFacts({
    generation: 1,
    game: "yellow",
    source: "live",
    events: events([["EVENT_GOT_POKEDEX", false]]),
    raw: { oaksLabScript: 19 },
  });
  assert.equal(parcel?.facts.find((fact) => fact.key === "oaks-lab-phase")?.value, "Deliver Oak's Parcel");

  const finished = buildProgressFacts({
    generation: 1,
    game: "yellow",
    source: "live",
    events: events([["EVENT_GOT_POKEDEX", true]]),
    raw: { oaksLabScript: 19 },
  });
  assert.equal(finished?.facts.some((fact) => fact.key === "oaks-lab-phase"), false);
});

test("main story progress distinguishes League completion from remaining optional flags", () => {
  const facts = buildProgressFacts({
    generation: 3,
    game: "emerald",
    source: "save",
    events: events([["FLAG_SYS_GAME_CLEAR", true]]),
  });
  const story = facts?.facts.find((fact) => fact.key === "main-story-progress");
  assert.equal(story?.value, "Main story completed");
  assert.match(story?.description ?? "", /optional content, postgame/);
  assert.equal(story?.nextStep, undefined);
});

test("Gen 1 main story completion uses the persistent Hall of Fame counter", () => {
  const facts = buildProgressFacts({
    generation: 1,
    game: "red",
    source: "save",
    events: events([["EVENT_BEAT_CHAMPION_RIVAL", false]]),
    raw: { hallOfFameCount: 1 },
  });
  assert.equal(
    facts?.facts.find((fact) => fact.key === "main-story-progress")?.value,
    "Main story completed"
  );
});

test("Gen 2 starter alternatives become one permanent choice fact", () => {
  const facts = buildProgressFacts({
    generation: 2,
    game: "crystal",
    source: "save",
    events: events([
      ["EVENT_GOT_CYNDAQUIL_FROM_ELM", false],
      ["EVENT_GOT_TOTODILE_FROM_ELM", true],
      ["EVENT_GOT_CHIKORITA_FROM_ELM", false],
      ["EVENT_GAVE_MYSTERY_EGG_TO_ELM", false],
    ]),
    raw: { elmsLabScene: 5, radioTower5FScene: 0 },
  });

  assert.equal(facts?.facts.find((fact) => fact.key === "starter-choice")?.value, "Totodile");
  assert.equal(facts?.facts.find((fact) => fact.key === "elms-lab-phase")?.value, "Receive the Potion");
  assert.equal(facts?.facts.some((fact) => fact.key === "radio-tower-phase"), false);
});

test("Team Rocket HQ scenes are shown only after Lance starts the operation", () => {
  const inactive = buildProgressFacts({
    generation: 2,
    game: "crystal",
    source: "save",
    events: events([
      ["EVENT_DECIDED_TO_HELP_LANCE", false],
      ["EVENT_CLEARED_ROCKET_HIDEOUT", false],
    ]),
    raw: { teamRocketBaseB2FScene: 0, teamRocketBaseB3FScene: 0 },
  });
  assert.equal(inactive?.facts.some((fact) => fact.key === "rocket-base-phase"), false);

  const active = buildProgressFacts({
    generation: 2,
    game: "crystal",
    source: "save",
    events: events([
      ["EVENT_DECIDED_TO_HELP_LANCE", true],
      ["EVENT_CLEARED_ROCKET_HIDEOUT", false],
    ]),
    raw: { teamRocketBaseB2FScene: 1, teamRocketBaseB3FScene: 3 },
  });
  const rocket = active?.facts.find((fact) => fact.key === "rocket-base-phase");
  assert.equal(rocket?.value, "Defeat the final Executives");
  assert.match(rocket?.nextStep ?? "", /Lance/);
});

test("Petalburg Gym state translates badge-gated progression into a next step", () => {
  const facts = buildProgressFacts({
    generation: 3,
    game: "emerald",
    source: "live",
    raw: { petalburgGymState: 4 },
  });
  const petalburg = facts?.facts.find((fact) => fact.key === "petalburg-gym-phase");
  assert.equal(petalburg?.value, "Norman locked (2/4 required badges)");
  assert.match(petalburg?.nextStep ?? "", /Earn 2 more badges/);
});

test("Hoenn League run uses the current attempt flags to identify the next opponent", () => {
  const facts = buildProgressFacts({
    generation: 3,
    game: "emerald",
    source: "live",
    events: events([
      ["FLAG_DEFEATED_ELITE_4_SIDNEY", true],
      ["FLAG_DEFEATED_ELITE_4_PHOEBE", true],
      ["FLAG_DEFEATED_ELITE_4_GLACIA", false],
      ["FLAG_DEFEATED_ELITE_4_DRAKE", false],
      ["FLAG_SYS_GAME_CLEAR", false],
    ]),
    raw: { eliteFourState: 2 },
  });
  const league = facts?.facts.find((fact) => fact.key === "hoenn-league-run");
  assert.equal(league?.value, "Challenge Glacia");
  assert.match(league?.description ?? "", /current Elite Four run/);
});

test("Emerald Sootopolis crisis decodes the Rayquaza route only after the crisis starts", () => {
  const facts = buildProgressFacts({
    generation: 3,
    game: "emerald",
    source: "save",
    events: events([["FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN", true]]),
    raw: { sootopolisState: 4 },
  });
  const crisis = facts?.facts.find((fact) => fact.key === "sootopolis-crisis-phase");
  assert.equal(crisis?.value, "Awaken Rayquaza");
  assert.match(crisis?.nextStep ?? "", /Sky Pillar/);
});
