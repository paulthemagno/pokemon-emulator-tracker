import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProgressVariables, readProgressVariables } from "../lib/pokemon/progress-variables";
import { REVIEWED_PROGRESS_VARIABLES } from "../lib/pokemon/knowledge/progress-variables";
import { normalizeLiveSnapshot } from "../lib/pokemon/live-normalizer";
import { executeChatTool } from "../lib/chatbot/tools/registry";
import { packGameContext } from "../lib/chatbot/context-packer";

test("reviewed raw variables preserve zero without inventing missing/default values", () => {
  assert.equal(normalizeProgressVariables(undefined, "emerald"), undefined);
  assert.equal(normalizeProgressVariables({}, "emerald"), undefined);
  assert.equal(normalizeProgressVariables({ roamerPokemon: null }, "emerald"), undefined);
  assert.equal(normalizeProgressVariables({ roamerPokemon: "0" }, "emerald"), undefined);
  assert.equal(normalizeProgressVariables({ roamerPokemon: 1 }, "ruby"), undefined);
  const values = normalizeProgressVariables({ roamerPokemon: 0, fossilResurrectionState: 2, arbitrary: 99 }, "emerald")!;
  assert.equal(values.length, 2);
  const roamer = values.find(entry => entry.key === "roamerPokemon")!;
  assert.equal(roamer.value, 0);
  assert.equal(roamer.id, 0x40d5);
  assert.match(roamer.description, /not proof of a choice/);
  assert.ok(roamer.sourceRefs.some(ref => ref.includes("0d3100185e0b13faabfc589fc402dd46f83c1d6a/data/scripts/players_house.inc")));
});

test("save readers use extracted variable IDs, the vars base, and the input view offset", () => {
  const backing = new Uint8Array(32 + 1024);
  const data = backing.subarray(32);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const varsBase = 64;
  view.setUint16(varsBase + (0x40c4 - 0x4000) * 2, 2, true);
  view.setUint16(varsBase + (0x40c5 - 0x4000) * 2, 1, true);
  view.setUint16(varsBase + (0x40ba - 0x4000) * 2, 2, true);
  const values = readProgressVariables(data, varsBase, "emerald")!;
  assert.equal(values.length, 18);
  assert.equal(values.find(entry => entry.key === "fossilResurrectionState")?.value, 2);
  assert.equal(values.find(entry => entry.key === "whichFossilRevived")?.value, 1);
  assert.equal(values.find(entry => entry.key === "newMauvilleState")?.value, 2);
  assert.equal(readProgressVariables(new Uint8Array(1), varsBase, "emerald"), undefined);
  assert.equal(new Set(REVIEWED_PROGRESS_VARIABLES.emerald.map(entry => entry.id)).size, 18);
});

test("live normalization and MCP preserve documented variables separately from interpreted facts", () => {
  const data = normalizeLiveSnapshot({ generation: 3, game: "emerald",
    player: { name: "TEST", badges: [], playTime: { hours: 0, minutes: 0, seconds: 0 } },
    party: [], bag: [], progressVariablesRaw: { newMauvilleState: 2, trickHouseLevel: 0, trickHousePrizePickup: 1 } });
  assert.equal(data.progressVariables?.length, 3);
  const context = packGameContext(data);
  const result = executeChatTool("get_game_state", { section: "progressVariables", query: "trickHouse", limit: 1 }, context);
  assert.ok(result.ok);
  const value = result.data as { totalMatches: number; returned: number; hasMore: boolean;
    entries: Array<{ symbol: string; value: number; description: string }>; interpretation: string };
  assert.equal(value.totalMatches, 2);
  assert.equal(value.returned, 1);
  assert.equal(value.hasMore, true);
  assert.equal(value.entries[0].symbol, "VAR_TRICK_HOUSE_LEVEL");
  assert.equal(value.entries[0].value, 0);
  assert.match(value.interpretation, /not automatic completion/);
  const oldAdapter = normalizeLiveSnapshot({ generation: 3, game: "emerald", player: { name: "TEST" }, party: [] });
  assert.equal(oldAdapter.progressVariables, undefined);
  assert.equal(executeChatTool("get_game_state", { section: "progressVariables" }, packGameContext(oldAdapter)).ok, false);
});
