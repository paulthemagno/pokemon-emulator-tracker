import test from "node:test";
import assert from "node:assert/strict";

import { parseEventProgress, normalizeLiveEventBytes } from "../lib/pokemon/events";
import { GEN1_EVENT_FLAGS, GEN2_EVENT_FLAGS, GEN3_EVENT_FLAGS } from "../lib/pokemon/knowledge/event-flags";
import { getGeneratedEventGuide } from "../lib/pokemon/knowledge/event-guides";

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

test("event layouts use Crystal's source-backed event flag offsets", () => {
  assert.equal(GEN2_EVENT_FLAGS.goldSilver.flagStartOffset, 0x261f);
  assert.equal(GEN2_EVENT_FLAGS.crystal.flagStartOffset, 0x2600);
  assert.equal(GEN2_EVENT_FLAGS.crystal.liveFlagStartOffset, 0xda72);
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
      assert.ok(guide.sourceRefs?.some((source) => source.includes("github.com/pret/")), `${layout.gameProfile} ${entry.key}`);
      assert.ok(guide.sourceRefs?.some((source) => !source.includes("github.com/pret/")), `${layout.gameProfile} ${entry.key}`);
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
  assert.ok(flag?.flowSteps?.some((step) => step.includes("hidden Stardust")));
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
