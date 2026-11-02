import assert from 'node:assert/strict';
import test from 'node:test';
import { callMcpTool, getMcpTools } from '../lib/chatbot/mcp';
import { getChatToolDefinitions } from '../lib/chatbot/tools/registry';
import type { SaveData } from '../lib/pokemon/types';
import { packGameContext } from '../lib/chatbot/context-packer';

const data = {
  game: 'emerald', generation: 3,
  trainer: { name: 'PAUL', money: 38754, badges: [], playTime: { hours: 1, minutes: 2, seconds: 3 } },
  party: [], inventory: [], pokedex: { seenCount: 0, caughtCount: 0, seenSpecies: [], caughtSpecies: [] },
} as unknown as SaveData;
const context = packGameContext(data)!;

test('MCP exposes the existing registry as read-only tools', () => {
  assert.deepEqual(getMcpTools().map(t => t.name), getChatToolDefinitions().map(t => t.function.name));
  assert.ok(getMcpTools().every(t => t.annotations.readOnlyHint));
});

test('live tools reject stale data unless explicitly requested', async () => {
  const fetchLive = async () => ({ success: true, source: 'live' as const, stale: true, updatedAt: 1000, context });
  const rejected = await callMcpTool('get_trainer_status', {}, fetchLive, 2000);
  assert.equal(rejected.isError, true);
  assert.equal('data' in rejected.structuredContent, false);
  const allowed = await callMcpTool('get_trainer_status', { allowStale: true }, fetchLive, 2000);
  assert.equal(allowed.isError, false);
  assert.equal((allowed.structuredContent.state as { stale: boolean }).stale, true);
  assert.equal((allowed.structuredContent.data as { money: number }).money, 38754);
});

test('old timestamps are stale even when upstream omits the flag', async () => {
  const result = await callMcpTool('get_trainer_status', {}, async () => ({ success: true, source: 'live', updatedAt: 1000, context }), 20000);
  assert.equal(result.isError, true);
});

test('uploaded saves remain usable by age and expose file identity', async () => {
  const result = await callMcpTool('get_trainer_status', {}, async () => ({ success: true,
    source: 'file', filename: 'emerald.sav', updatedAt: 1000, context }), 86_400_000);
  assert.equal(result.isError, false);
  const state = result.structuredContent.state as { source: string; stale: boolean; filename: string };
  assert.equal(state.source, 'file');
  assert.equal(state.filename, 'emerald.sav');
  assert.equal(state.stale, false);
});

test('explicit-game reference tools work offline; live tools fail clearly', async () => {
  const offline = async (): Promise<never> => { throw new Error('offline'); };
  const reference = await callMcpTool('get_evolution', { species: 'Metang', game: 'emerald' }, offline);
  assert.equal(reference.isError, false);
  const live = await callMcpTool('get_trainer_status', {}, offline);
  assert.equal(live.isError, true);
});
