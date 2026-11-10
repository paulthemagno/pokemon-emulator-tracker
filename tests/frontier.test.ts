import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBattleFrontier } from '../lib/pokemon/frontier';
import { normalizeLiveSnapshot } from '../lib/pokemon/live-normalizer';
import { parseEventProgress } from '../lib/pokemon/events';
import { GEN3_EVENT_FLAGS } from '../lib/pokemon/knowledge/event-flags';

// Absolute addresses independently taken from PRET global.h, not from the generated layout.
function fixture() {
  const block = new Uint8Array(0xf2c);
  const view = new DataView(block.buffer);
  view.setUint32(0xcdc, (1 << 0) | (1 << 25), true);
  view.setUint16(0xeb8, 321, true);
  view.setUint16(0xce0, 35, true);
  view.setUint16(0xcf0, 70, true);
  view.setUint16(0xce0 + 14, 21, true); // Tower link multi/open
  view.setUint16(0xde2 + 6, 42, true); // Factory doubles/open
  view.setUint16(0xd0c, 5, true);
  view.setUint16(0xe04, 28, true);
  view.setUint16(0xe1a, 14, true);
  return block.subarray(0xcdc, 0xeba);
}
test('Emerald Frontier separates modes, units and current/previous streaks', () => {
  const result = parseBattleFrontier(fixture(), 'emerald', 'save')!;
  assert.equal(result.battlePoints, 321);
  assert.equal(result.facilities.length, 7);
  assert.equal(result.facilities[0].records.length, 8);
  assert.deepEqual(result.facilities[0].records[0], {mode:'singles', level:'50', streak:35, record:70, isCurrent:true, unit:'wins'});
  assert.equal(result.facilities[0].records[7].streak, 21);
  assert.equal(result.facilities[0].records[7].isCurrent, false);
  assert.equal(result.facilities[4].records[3].streak, 42);
  assert.equal(result.facilities[4].records[3].isCurrent, true);
  assert.equal(result.facilities[1].records[0].unit, 'tournaments');
  assert.equal(result.facilities[5].records[0].unit, 'rooms');
  assert.equal(result.facilities[6].records[0].unit, 'floors');
  assert.equal(result.facilities[0].silver, null);
});
test('live Frontier uses the same decoder and missing/invalid data stays unavailable', () => {
  const data = normalizeLiveSnapshot({generation:3, game:'emerald', player:{}, frontierRaw:Array.from(fixture())});
  assert.deepEqual(data.battleFrontier, {...parseBattleFrontier(fixture(), 'emerald', 'save'), source:'live'});
  for (const raw of [undefined, [], [-1], Array(478).fill(256)]) assert.equal(parseBattleFrontier(raw,'emerald','live'), undefined);
  for (const game of ['ruby','sapphire','firered'] as const) assert.equal(parseBattleFrontier(fixture(),game,'live'), undefined);
});
test('Frontier symbol medals come from actual system flags, independent of streak records', () => {
  const bytes = new Uint8Array(0x300);
  const id = GEN3_EVENT_FLAGS.emerald.entries.find(f => f.key === 'FLAG_SYS_TOWER_GOLD')!.id;
  bytes[Math.floor(id / 8)] |= 1 << (id % 8);
  const events = parseEventProgress(bytes, GEN3_EVENT_FLAGS.emerald, 'save', 0);
  const result = parseBattleFrontier(fixture(), 'emerald', 'save', events)!;
  assert.equal(result.facilities[0].gold, true);
  assert.equal(result.facilities[0].silver, false);
});

test('symbol milestones use active Singles progress, never a previous streak or doubles', async () => {
  const {getFrontierSymbolProgress} = await import('../lib/pokemon/frontier');
  const factory = parseBattleFrontier(fixture(),'emerald','save')!.facilities[4];
  const row = {...factory.records[0], streak:14, isCurrent:true};
  assert.equal(getFrontierSymbolProgress(factory,row,'silver')?.remaining,7);
  assert.equal(getFrontierSymbolProgress(factory,{...row,isCurrent:false},'silver')?.remaining,21);
  assert.equal(getFrontierSymbolProgress(factory,{...row,mode:'doubles'},'silver')?.eligible,false);
  const all = parseBattleFrontier(fixture(),'emerald','save')!.facilities;
  assert.deepEqual(all.map(f => [getFrontierSymbolProgress(f,f.records[0],'silver')?.target,getFrontierSymbolProgress(f,f.records[0],'gold')?.target]),[[35,70],[5,10],[21,42],[28,56],[21,42],[28,140],[21,70]]);
});
