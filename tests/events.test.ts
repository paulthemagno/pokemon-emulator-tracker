import test from "node:test";
import assert from "node:assert/strict";

import { parseEventProgress, normalizeLiveEventBytes, normalizeEventProgress } from "../lib/pokemon/events";
import { GEN1_EVENT_FLAGS, GEN2_EVENT_FLAGS, GEN3_EVENT_FLAGS } from "../lib/pokemon/knowledge/event-flags";
import { getGeneratedEventGuide } from "../lib/pokemon/knowledge/event-guides";
import { buildProgressFacts } from "../lib/pokemon/progress-facts";
import { isEventStatusActive } from "../lib/pokemon/event-status";

test("Emerald League completion and resolved weather crisis do not create false missing milestones", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  for (const key of ["FLAG_SYS_GAME_CLEAR", "FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN"]) {
    const entry = layout.entries.find(flag => flag.key === key)!;
    bytes[Math.floor(entry.id / 8)] |= 1 << (entry.id % 8);
  }
  const progress = normalizeLiveEventBytes({ bytes: Array.from(bytes) }, 3, "emerald")!;
  const league = progress.flags.find(flag => flag.key === "FLAG_SYS_GAME_CLEAR")!;
  assert.match(league.description!, /League has been completed/);
  assert.match(league.completionMeaning!, /Hall of Fame/);
  const crisis = progress.flags.find(flag => flag.key === "FLAG_LEGENDARIES_IN_SOOTOPOLIS")!;
  assert.equal(crisis.rawSet, false);
  assert.equal(crisis.completed, false);
  assert.equal(crisis.important, false);
  assert.equal(crisis.stateKind, "system");
  assert.match(crisis.description!, /script clears this bit/);
  const escaped = progress.flags.find(flag => flag.key === "FLAG_KYOGRE_ESCAPED_SEAFLOOR_CAVERN")!;
  assert.equal(escaped.completed, true);
  assert.deepEqual(escaped.missingPrerequisites, []);
  assert.ok(crisis.sourceRefs?.some(ref => ref.endsWith("data/maps/SootopolisCity/scripts.inc")));
});

test("Emerald legendary outcome guidance separates capture, defeat, and stationary/roaming records", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  for (const key of ["FLAG_DEFEATED_RAYQUAZA", "FLAG_CAUGHT_LATIAS_OR_LATIOS", "FLAG_EXCHANGED_SCANNER"]) {
    const definition = layout.entries.find(entry => entry.key === key)!;
    bytes[Math.floor(definition.id / 8)] |= 1 << (definition.id % 8);
  }
  const flags = normalizeLiveEventBytes({ bytes: Array.from(bytes) }, 3, "emerald")!.flags;
  const rayquaza = flags.find(entry => entry.key === "FLAG_DEFEATED_RAYQUAZA")!;
  assert.equal(rayquaza.completed, true);
  assert.match(rayquaza.description!, /both the defeat and capture/);
  assert.match(rayquaza.completionMeaning!, /does not distinguish capture/);
  const lati = flags.find(entry => entry.key === "FLAG_CAUGHT_LATIAS_OR_LATIOS")!;
  assert.match(lati.description!, /Southern Island/);
  assert.match(lati.description!, /not the roaming/);
  const scanner = flags.find(entry => entry.key === "FLAG_EXCHANGED_SCANNER")!;
  assert.match(scanner.description!, /does not retain which reward/);
  assert.equal(scanner.descriptionKind, "script-guided");
  assert.ok(scanner.sourceRefs?.some(ref => ref.endsWith("data/maps/SlateportCity_Harbor/scripts.inc")));
});

test("source-extracted registration and daily flags remain technical/resettable context", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const registrations = layout.entries.filter(entry => entry.key.startsWith("FLAG_REGISTERED_"));
  for (const profile of Object.values(GEN3_EVENT_FLAGS)) {
    const technical = profile.entries.filter(entry => ["Daily state", "Trainer registration", "Mystery Gift state", "Unreviewed flag state"].includes(entry.category));
    assert.ok(technical.every(entry => entry.important === false));
    assert.ok(technical.filter(entry => entry.category === "Unreviewed flag state")
      .every(entry => !/unused|never written/i.test(entry.note ?? "")));
  }
  // Steven's separate PokéNav flag predates the indexed Match Call range.
  assert.equal(registrations.filter(entry => entry.id >= 0x15c && entry.id < 0x15c + 78).length, 78);
  assert.equal(registrations.find(entry => entry.key === "FLAG_REGISTERED_ROSE")?.id, 0x15c);
  assert.equal(layout.entries.filter(entry => entry.key.startsWith("FLAG_DAILY_")).length, 12);
  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  bytes[Math.floor(0x92a / 8)] |= 1 << (0x92a % 8);
  const flags = normalizeLiveEventBytes({ bytes: Array.from(bytes) }, 3, "emerald")!.flags;
  const lottery = flags.find(entry => entry.key === "FLAG_DAILY_PICKED_LOTO_TICKET")!;
  assert.equal(lottery.rawSet, true);
  assert.equal(lottery.completed, false);
  assert.match(lottery.description!, /daily reset/);
  assert.ok(lottery.sourceRefs?.some(ref => ref.endsWith("src/event_data.c")));
  const registration = flags.find(entry => entry.key === "FLAG_REGISTERED_ROSE")!;
  assert.match(registration.description!, /distinct from defeating/);
  assert.equal(registration.stateKind, "system");
  const legacy = normalizeLiveEventBytes({ bytes: Array(Math.ceil(0x8e5 / 8)).fill(0) }, 3, "emerald")!;
  assert.equal(legacy.flags.some(entry => entry.key === lottery.key), false);
});

test("Emerald catalog covers every defined nonzero trainer ID at its source-backed bit index", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const trainers = layout.entries.filter(entry => entry.trainerId !== undefined);
  assert.equal(trainers.length, 854);
  assert.deepEqual(trainers.map(entry => entry.trainerId), Array.from({ length: 854 }, (_, i) => i + 1));
  assert.equal(layout.trainerFlags?.start, 0x500);
  assert.equal(layout.trainerFlags?.count, 864);
  assert.equal(new Set(trainers.map(entry => entry.id)).size, trainers.length);
  const ordinaryIds = new Set(layout.entries.filter(entry => entry.trainerId === undefined).map(entry => entry.id));
  for (const entry of trainers) {
    assert.equal(entry.id, 0x500 + entry.trainerId!);
    assert.ok(entry.id < layout.flagCount);
    assert.equal(ordinaryIds.has(entry.id), false);
    assert.equal(entry.importance, "routine");
    assert.equal(entry.important, false);
  }
  assert.equal(trainers.some(entry => entry.key === "TRAINER_NONE"), false);
  assert.equal(GEN3_EVENT_FLAGS.rubySapphire.entries.some(entry => entry.trainerId !== undefined), false);
  assert.equal(GEN3_EVENT_FLAGS.fireRedLeafGreen.entries.some(entry => entry.trainerId !== undefined), false);
});

test("Emerald pre-League Wally victory is independent of post-League teams in save and live parsing", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  const setBit = (id: number) => { bytes[Math.floor(id / 8)] |= 1 << (id % 8); };
  const byKey = (progress: ReturnType<typeof parseEventProgress>, key: string) => progress.flags.find(f => f.key === key)!;
  setBit(0x500 + 519); // TRAINER_WALLY_VR_1 from pinned opponents.h
  let progress = normalizeLiveEventBytes({ bytes: Array.from(bytes) }, 3, "emerald")!;
  assert.equal(byKey(progress, "TRAINER_WALLY_VR_1").completed, true);
  assert.equal(byKey(progress, "TRAINER_WALLY_VR_2").completed, false);
  assert.match(byKey(progress, "TRAINER_WALLY_VR_1").description!, /does not prove a post-League/);
  const milestonesBefore = progress.importantCompletedCount;

  setBit(0x500 + 657); // first post-League Wally team
  const saveBytes = new Uint8Array(32 + bytes.length);
  saveBytes.set(bytes, 32);
  progress = parseEventProgress(saveBytes, layout, "save", 32);
  const postLeague = byKey(progress, "TRAINER_WALLY_VR_2");
  assert.equal(postLeague.completed, true);
  assert.equal(postLeague.trainerId, 657);
  assert.equal(postLeague.descriptionKind, "script-guided");
  assert.match(postLeague.completionMeaning!, /confirms a post-League victory/);
  assert.ok(postLeague.sourceRefs?.some(url => url.includes("0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/maps/VictoryRoad_1F/scripts.inc")));
  assert.equal(byKey(progress, "TRAINER_WALLY_VR_3").rawSet, false);
  assert.match(byKey(progress, "TRAINER_WALLY_VR_3").normalMissingReason!, /not proof.*challenged now/);
  assert.equal(progress.importantCompletedCount, milestonesBefore);
  assert.equal(normalizeEventProgress(progress)?.flags.find(f => f.key === postLeague.key)?.trainerId, 657);

  bytes.fill(0);
  setBit(0x500 + 660); // another post-League team must also be queryable independently
  progress = normalizeLiveEventBytes({ bytes: Array.from(bytes) }, 3, "emerald")!;
  assert.equal(byKey(progress, "TRAINER_WALLY_VR_2").completed, false);
  assert.equal(byKey(progress, "TRAINER_WALLY_VR_5").completed, true);
  assert.match(byKey(progress, "TRAINER_WALLY_VR_2").notCompletedMeaning!, /Check the other post-League/);
});

test("unreviewed trainer records do not invent quest steps or team availability", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const progress = normalizeLiveEventBytes({ bytes: Array(Math.ceil(layout.flagCount / 8)).fill(0) }, 3, "emerald")!;
  const placeholder = progress.flags.find(f => f.key === "TRAINER_MAY_PLACEHOLDER")!;
  assert.equal(placeholder.rawSet, false);
  assert.equal(placeholder.important, false);
  assert.ok(placeholder.flowSteps?.every(step => !/^(Go to|Win|Start|Speak)/.test(step)));
  assert.match(placeholder.normalMissingReason!, /unused/);
  assert.match(placeholder.notCompletedMeaning!, /does not establish an available unfinished quest/);
  assert.ok(placeholder.sourceRefs?.some(url => url.endsWith("/include/constants/opponents.h")));
});

for (const game of ["emerald", "ruby", "sapphire"] as const) {
  test(`${game} Elite Four flags describe an attempt without counting as permanent milestones`, () => {
    const layout = game === "emerald" ? GEN3_EVENT_FLAGS.emerald : GEN3_EVENT_FLAGS.rubySapphire;
    const members = layout.entries.filter((entry) => /^FLAG_DEFEATED_ELITE_4_/.test(entry.key));
    assert.equal(members.length, 4);
    const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
    for (const member of members.slice(0, 2)) {
      bytes[Math.floor(member.id / 8)] |= 1 << (member.id % 8);
    }
    const progress = normalizeLiveEventBytes({ bytes: Array.from(bytes) }, 3, game)!;
    for (const [index, member] of members.entries()) {
      const flag = progress.flags.find((entry) => entry.key === member.key)!;
      assert.equal(flag.category, "League challenge state");
      assert.equal(flag.important, false);
      assert.equal(flag.rawSet, index < 2);
      assert.equal(isEventStatusActive(flag), index < 2);
      assert.equal(flag.completed, false);
      assert.equal(flag.flowStatus, "state");
      assert.match(flag.description ?? "", /Hall of Fame resets/);
      assert.match(flag.notCompletedMeaning ?? "", /reset/);
      assert.ok(flag.sourceRefs?.some((url) => url.endsWith("/data/scripts/hall_of_fame.inc")));
    }
    assert.equal(progress.completedCount, 0);
    assert.equal(progress.importantCompletedCount, 0);
    const facts = buildProgressFacts({ generation: 3, game, source: "live", events: progress, raw: { eliteFourState: 2 } });
    assert.equal(facts?.facts.find((fact) => fact.key === "hoenn-league-run")?.value, "Challenge Glacia");

    // Hall of Fame clears the attempt bits while permanent game-clear stays set.
    bytes.fill(0);
    const gameClear = layout.entries.find((entry) => entry.key === "FLAG_SYS_GAME_CLEAR")!;
    bytes[Math.floor(gameClear.id / 8)] |= 1 << (gameClear.id % 8);
    const afterHallOfFame = parseEventProgress(bytes, layout, "save", 0);
    for (const member of members) {
      const flag = afterHallOfFame.flags.find((entry) => entry.key === member.key)!;
      assert.equal(flag.rawSet, false);
      assert.equal(isEventStatusActive(flag), false);
      assert.equal(flag.flowStatus, "state");
      assert.equal(flag.important, false);
    }
    const afterFacts = buildProgressFacts({ generation: 3, game, source: "save", events: afterHallOfFame, raw: { eliteFourState: 0 } });
    assert.equal(afterFacts?.facts.some((fact) => fact.key === "hoenn-league-run"), false);
    assert.equal(afterFacts?.facts.find((fact) => fact.key === "main-story-progress")?.value, "Main story completed");
  });
}

test("parseEventProgress reads source-backed event flags from save bytes", () => {
  const layout = GEN1_EVENT_FLAGS.redBlue;
  const firstImportant = layout.entries.find((entry) => entry.important);
  assert.ok(firstImportant);

  const data = new Uint8Array((layout.flagStartOffset ?? 0) + Math.ceil(layout.flagCount / 8));
  data[(layout.flagStartOffset ?? 0) + Math.floor(firstImportant.id / 8)] = 1 << (firstImportant.id % 8);

  const progress = parseEventProgress(data, layout, "save");
  const flag = progress.flags.find((entry) => entry.key === firstImportant.key);
  assert.equal(flag?.completed, true);
  assert.equal(progress.source, "save");
});

test("normalizeLiveEventBytes maps raw live bytes through the matching game layout", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const firstImportant = layout.entries.find((entry) => entry.important);
  assert.ok(firstImportant);

  const bytes = new Array(Math.ceil(layout.flagCount / 8)).fill(0);
  bytes[Math.floor(firstImportant.id / 8)] = 1 << (firstImportant.id % 8);

  const progress = normalizeLiveEventBytes({ bytes }, 3, "emerald");
  const flag = progress?.flags.find((entry) => entry.key === firstImportant.key);
  assert.equal(flag?.completed, true);
  assert.equal(progress?.source, "live");
});

test("event metadata keeps optional flags out of milestone counts", () => {
  const layout = GEN1_EVENT_FLAGS.redBlue;
  const domeFossil = layout.entries.find((entry) => entry.key === "EVENT_GOT_DOME_FOSSIL");
  assert.ok(domeFossil);
  assert.equal(domeFossil.important, false);
  assert.equal(domeFossil.importance, "optional");
});

test("event metadata classifies HM event flags as unlock milestones", () => {
  const cut = GEN2_EVENT_FLAGS.crystal.entries.find((entry) => entry.key === "EVENT_GOT_HM01_CUT");
  assert.ok(cut);
  assert.equal(cut.category, "Key items and unlocks");
  assert.equal(cut.importance, "unlock");
  assert.equal(cut.important, true);
});

test("event metadata keeps optional legendary encounters out of key events", () => {
  const mewtwo = GEN1_EVENT_FLAGS.redBlue.entries.find((entry) => entry.key === "EVENT_BEAT_MEWTWO");
  const hoOh = GEN3_EVENT_FLAGS.emerald.entries.find((entry) => entry.key === "FLAG_CAUGHT_HO_OH");
  assert.ok(mewtwo);
  assert.ok(hoOh);
  assert.equal(mewtwo.importance, "optional");
  assert.equal(mewtwo.important, false);
  assert.equal(hoOh.importance, "optional");
  assert.equal(hoOh.important, false);
});

test("event metadata keeps central opening and Crystal story events in key events", () => {
  const birch = GEN3_EVENT_FLAGS.emerald.entries.find((entry) => entry.key === "FLAG_RESCUED_BIRCH");
  const suicune = GEN2_EVENT_FLAGS.crystal.entries.find((entry) => entry.key === "EVENT_FOUGHT_SUICUNE");
  const starterDoll = GEN3_EVENT_FLAGS.emerald.entries.find((entry) => entry.key === "FLAG_RECEIVED_STARTER_DOLL");
  assert.ok(birch);
  assert.ok(suicune);
  assert.ok(starterDoll);
  assert.equal(birch.importance, "story");
  assert.equal(birch.important, true);
  assert.equal(suicune.importance, "story");
  assert.equal(suicune.important, true);
  assert.equal(starterDoll.importance, "optional");
  assert.equal(starterDoll.important, false);
});

test("event layouts use Crystal's source-backed event flag offsets", () => {
  assert.equal(GEN2_EVENT_FLAGS.goldSilver.flagStartOffset, 0x261f);
  assert.equal(GEN2_EVENT_FLAGS.crystal.flagStartOffset, 0x2600);
  assert.equal(GEN2_EVENT_FLAGS.crystal.liveFlagStartOffset, 0xda72);
});

test("Crystal new-game initialization flags are not reported as completed progress", () => {
  const layout = GEN2_EVENT_FLAGS.crystal;
  const initialized = layout.entries.find((entry) => entry.key === "EVENT_INITIALIZED_EVENTS");
  const cardKey = layout.entries.find((entry) => entry.key === "EVENT_USED_THE_CARD_KEY_IN_THE_RADIO_TOWER");
  const suicune = layout.entries.find((entry) => entry.key === "EVENT_SAW_SUICUNE_AT_CIANWOOD_CITY");
  assert.ok(initialized);
  assert.ok(cardKey);
  assert.ok(suicune);
  assert.equal(initialized.initiallySet, true);
  assert.equal(cardKey.important, false);
  assert.equal(suicune.important, false);

  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  for (const entry of [initialized, cardKey, suicune]) {
    bytes[Math.floor(entry.id / 8)] |= 1 << (entry.id % 8);
  }
  const progress = parseEventProgress(bytes, layout, "live", 0);
  for (const entry of [initialized, cardKey, suicune]) {
    const flag = progress.flags.find((candidate) => candidate.key === entry.key);
    assert.equal(flag?.rawSet, true);
    assert.equal(flag?.completed, false);
    assert.equal(flag?.flowStatus, "initial");
  }
});

test("Emerald new-game visibility flags are technical initial state, not completed unlocks", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const keys = [
    "FLAG_HIDE_LILYCOVE_HARBOR_EVENT_TICKET_TAKER",
    "FLAG_HIDE_ROUTE_110_RIVAL_ON_BIKE",
    "FLAG_HIDE_ROUTE_119_RIVAL_ON_BIKE",
    "FLAG_HIDE_LAVARIDGE_TOWN_RIVAL_ON_BIKE",
  ];
  const entries = keys.map((key) => {
    const entry = layout.entries.find((candidate) => candidate.key === key);
    assert.ok(entry);
    return entry;
  });
  entries.forEach((entry) => {
    assert.equal(entry.initiallySet, true);
    assert.equal(entry.category, "Initial game state");
    assert.equal(entry.importance, "routine");
    assert.equal(entry.important, false);
  });

  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  for (const entry of entries) {
    bytes[Math.floor(entry.id / 8)] |= 1 << (entry.id % 8);
  }
  const progress = parseEventProgress(bytes, layout, "live", 0);
  for (const entry of entries) {
    const flag = progress.flags.find((candidate) => candidate.key === entry.key);
    assert.equal(flag?.rawSet, true);
    assert.equal(flag?.completed, false);
    assert.equal(flag?.flowStatus, "initial");
    assert.match(flag?.description ?? "", /currently hidden/);
    assert.match(flag?.description ?? "", /not a completed event/);
  }
});

test("Ruby and Sapphire new-game map reset flags are not completed progress", () => {
  const layout = GEN3_EVENT_FLAGS.rubySapphire;
  const keys = [
    "FLAG_ITEM_MOSSDEEP_STEVENS_HOUSE_HM08",
    "FLAG_LINK_CONTEST_ROOM_POKEBALL",
  ];
  const entries = keys.map((key) => {
    const entry = layout.entries.find((candidate) => candidate.key === key);
    assert.ok(entry);
    return entry;
  });
  entries.forEach((entry) => {
    assert.equal(entry.initiallySet, true);
    assert.equal(entry.category, "Initial game state");
    assert.equal(entry.importance, "routine");
    assert.equal(entry.important, false);
  });

  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  for (const entry of entries) {
    bytes[Math.floor(entry.id / 8)] |= 1 << (entry.id % 8);
  }
  const progress = parseEventProgress(bytes, layout, "live", 0);
  for (const entry of entries) {
    const flag = progress.flags.find((candidate) => candidate.key === entry.key);
    assert.equal(flag?.rawSet, true);
    assert.equal(flag?.completed, false);
    assert.equal(flag?.flowStatus, "initial");
  }
});

test("Emerald visibility and system bits are described as state instead of progress", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const keys = ["FLAG_DECORATION_1", "FLAG_SYS_CLOCK_SET", "FLAG_SYS_SHOAL_ITEM"];
  const entries = keys.map((key) => {
    const entry = layout.entries.find((candidate) => candidate.key === key);
    assert.ok(entry);
    return entry;
  });

  assert.equal(entries[0].stateKind, "visibility");
  assert.equal(entries[1].stateKind, "system");
  assert.equal(entries[2].stateKind, "system");

  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  for (const entry of entries) {
    bytes[Math.floor(entry.id / 8)] |= 1 << (entry.id % 8);
  }
  const progress = parseEventProgress(bytes, layout, "live", 0);
  const decoration = progress.flags.find((flag) => flag.key === "FLAG_DECORATION_1");
  const clock = progress.flags.find((flag) => flag.key === "FLAG_SYS_CLOCK_SET");
  const shoal = progress.flags.find((flag) => flag.key === "FLAG_SYS_SHOAL_ITEM");

  for (const flag of [decoration, clock, shoal]) {
    assert.equal(flag?.rawSet, true);
    assert.equal(flag?.completed, false);
    assert.equal(flag?.flowStatus, "state");
  }
  assert.match(decoration?.description ?? "", /slot 1 is hidden or unused/i);
  assert.match(clock?.description ?? "", /real-time clock has been initialized/i);
  assert.match(shoal?.description ?? "", /does not mean Shoal Cave was visited/i);
});

test("Emerald early-story flags remain real completed progress", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const keys = ["FLAG_SET_WALL_CLOCK", "FLAG_MET_RIVAL_MOM", "FLAG_VISITED_LITTLEROOT_TOWN"];
  const entries = keys.map((key) => {
    const entry = layout.entries.find((candidate) => candidate.key === key);
    assert.ok(entry);
    return entry;
  });
  const bytes = new Uint8Array(Math.ceil(layout.flagCount / 8));
  for (const entry of entries) {
    bytes[Math.floor(entry.id / 8)] |= 1 << (entry.id % 8);
  }

  const progress = parseEventProgress(bytes, layout, "live", 0);
  for (const entry of entries) {
    const flag = progress.flags.find((candidate) => candidate.key === entry.key);
    assert.equal(flag?.completed, true);
    assert.equal(flag?.flowStatus, "done");
  }
});

test("event layouts use Gen 1 symbol-map event flag offsets", () => {
  assert.equal(GEN1_EVENT_FLAGS.redBlue.flagStartOffset, 0x29f3);
  assert.equal(GEN1_EVENT_FLAGS.redBlue.liveFlagStartOffset, 0xd747);
  assert.equal(GEN1_EVENT_FLAGS.yellow.flagStartOffset, 0x29f3);
  assert.equal(GEN1_EVENT_FLAGS.yellow.liveFlagStartOffset, 0xd746);
});

test("event progress includes source-backed action guidance when available", () => {
  const layout = GEN1_EVENT_FLAGS.redBlue;
  const pokedex = layout.entries.find((entry) => entry.key === "EVENT_GOT_POKEDEX");
  assert.ok(pokedex);

  const data = new Uint8Array(Math.ceil(layout.flagCount / 8));
  const progress = parseEventProgress(data, layout, "save");
  const flag = progress.flags.find((entry) => entry.key === pokedex.key);

  assert.match(flag?.actionHint ?? "", /Oak's Parcel/);
  assert.match(flag?.description ?? "", /Pokedex/);
  assert.equal(flag?.descriptionKind, "script-guided");
  assert.ok(flag?.flowSteps?.some((step) => step.includes("Viridian")));
  assert.deepEqual(flag?.prerequisites, ["EVENT_BATTLED_RIVAL_IN_OAKS_LAB", "EVENT_GOT_OAKS_PARCEL"]);
  assert.deepEqual(flag?.missingPrerequisites, ["EVENT_BATTLED_RIVAL_IN_OAKS_LAB", "EVENT_GOT_OAKS_PARCEL"]);
  assert.equal(flag?.flowStatus, "blocked");
  assert.ok(flag?.sourceRefs?.some((source) => source.includes("pret/pokered")));
});

test("event progress gives every flag a readable caption without forcing filler steps", () => {
  const layout = GEN2_EVENT_FLAGS.crystal;
  const data = new Uint8Array((layout.flagStartOffset ?? 0) + Math.ceil(layout.flagCount / 8));
  const progress = parseEventProgress(data, layout, "save");

  assert.ok(progress.flags.length > 0);
  assert.equal(progress.flags.every((flag) => Boolean(flag.description)), true);

  const rawFlag = progress.flags.find((flag) => flag.descriptionKind === "source-context");
  assert.ok(rawFlag);
  assert.match(rawFlag.description ?? "", /\S/);
});

test("generated event guides attach code and online source refs to every flag", () => {
  const layouts = [
    ...Object.values(GEN1_EVENT_FLAGS),
    ...Object.values(GEN2_EVENT_FLAGS),
    ...Object.values(GEN3_EVENT_FLAGS),
  ];

  for (const layout of layouts) {
    for (const entry of layout.entries) {
      const guide = getGeneratedEventGuide(layout.gameProfile, entry.key);
      assert.ok(guide, `${layout.gameProfile} ${entry.key}`);
      assert.match(guide.description ?? "", /\S/, `${layout.gameProfile} ${entry.key}`);
      assert.match(guide.completionMeaning ?? "", /^Set:/, `${layout.gameProfile} ${entry.key}`);
      assert.match(guide.notCompletedMeaning ?? "", /^Not set:/, `${layout.gameProfile} ${entry.key}`);
      assert.ok(guide.sourceRefs?.some((source) => source.includes("github.com/pret/")), `${layout.gameProfile} ${entry.key}`);
      assert.ok(
        (guide.sourceRefs?.filter((source) => !source.includes("github.com/pret/")).length ?? 0) >= 2,
        `${layout.gameProfile} ${entry.key}`
      );
    }
  }
});

test("event progress auto-describes hidden item pickup flags", () => {
  const layout = GEN3_EVENT_FLAGS.emerald;
  const hiddenItem = layout.entries.find((entry) => entry.key === "FLAG_HIDDEN_ITEM_ROUTE_111_STARDUST");
  assert.ok(hiddenItem);

  const data = new Uint8Array(Math.ceil(layout.flagCount / 8));
  const progress = parseEventProgress(data, layout, "save");
  const flag = progress.flags.find((entry) => entry.key === hiddenItem.key);

  assert.match(flag?.description ?? "", /Hidden item in Route 111: Stardust/);
  assert.ok(flag?.flowSteps?.some((step) => step.includes("collect Stardust")));
});

test("event progress does not mark next actions as ready without audited availability rules", () => {
  const layout = GEN1_EVENT_FLAGS.redBlue;
  const starter = layout.entries.find((entry) => entry.key === "EVENT_GOT_STARTER");
  const asked = layout.entries.find((entry) => entry.key === "EVENT_OAK_ASKED_TO_CHOOSE_MON");
  assert.ok(starter);
  assert.ok(asked);

  const data = new Uint8Array((layout.flagStartOffset ?? 0) + Math.ceil(layout.flagCount / 8));
  data[(layout.flagStartOffset ?? 0) + Math.floor(asked.id / 8)] = 1 << (asked.id % 8);

  const progress = parseEventProgress(data, layout, "save");
  const flag = progress.flags.find((entry) => entry.key === starter.key);

  assert.equal(flag?.flowStatus, "not-set");
  assert.deepEqual(flag?.missingPrerequisites, []);
});

test("event progress marks source-backed alternatives as optional after another branch is complete", () => {
  const layout = GEN1_EVENT_FLAGS.redBlue;
  const dome = layout.entries.find((entry) => entry.key === "EVENT_GOT_DOME_FOSSIL");
  const helix = layout.entries.find((entry) => entry.key === "EVENT_GOT_HELIX_FOSSIL");
  assert.ok(dome);
  assert.ok(helix);

  const data = new Uint8Array((layout.flagStartOffset ?? 0) + Math.ceil(layout.flagCount / 8));
  data[(layout.flagStartOffset ?? 0) + Math.floor(helix.id / 8)] = 1 << (helix.id % 8);

  const progress = parseEventProgress(data, layout, "save");
  const flag = progress.flags.find((entry) => entry.key === dome.key);

  assert.equal(flag?.flowStatus, "optional");
  assert.deepEqual(flag?.alternativeCompleted, ["EVENT_GOT_HELIX_FOSSIL"]);
  assert.equal(flag?.normalMissingReason?.includes("either/or"), true);
});

test("event progress marks Elm starter alternatives as covered by the chosen starter", () => {
  const layout = GEN2_EVENT_FLAGS.crystal;
  const totodile = layout.entries.find((entry) => entry.key === "EVENT_GOT_TOTODILE_FROM_ELM");
  const chikorita = layout.entries.find((entry) => entry.key === "EVENT_GOT_CHIKORITA_FROM_ELM");
  assert.ok(totodile);
  assert.ok(chikorita);

  const data = new Uint8Array((layout.flagStartOffset ?? 0) + Math.ceil(layout.flagCount / 8));
  data[(layout.flagStartOffset ?? 0) + Math.floor(totodile.id / 8)] = 1 << (totodile.id % 8);

  const progress = parseEventProgress(data, layout, "save");
  const flag = progress.flags.find((entry) => entry.key === chikorita.key);

  assert.equal(flag?.flowStatus, "optional");
  assert.deepEqual(flag?.alternativeCompleted, ["EVENT_GOT_TOTODILE_FROM_ELM"]);
  assert.ok(flag?.flowSteps?.some((step) => step.includes("Already covered")));
});
