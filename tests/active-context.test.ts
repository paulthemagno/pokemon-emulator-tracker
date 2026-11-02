import assert from 'node:assert/strict';
import test from 'node:test';
import { ActiveContextStore, activeContextUpdateSchema, type ActiveContextUpdate } from '../lib/chatbot/active-context';

const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const update = (sessionId = first, sequence = 1): ActiveContextUpdate => ({
  sessionId, sequence, claim: true, release: false,
  snapshot: { source: 'file', game: 'emerald', filename: 'emerald.sav', updatedAt: 1, stale: false,
    context: { trainerName: 'PAUL', location: 'Littleroot', money: 100, badges: 0,
      playtime: { hours: 1, minutes: 0, seconds: 0 }, partyPokemon: [], inventory: [],
      pokedexSeen: 0, pokedexOwned: 0, pokedexSeenList: [], pokedexCaughtList: [], timestamp: 1 } },
});

test('selected source changes from file to live and back without age-expiring the file', () => {
  const store = new ActiveContextStore();
  store.update(update(), 100_000);
  const file = store.read(100_001);
  assert.ok(file.success);
  assert.equal(file.source, 'file');
  const live = update(first, 2);
  live.snapshot!.source = 'live';
  store.update(live, 100_002);
  const selectedLive = store.read(100_003);
  assert.ok(selectedLive.success);
  assert.equal(selectedLive.source, 'live');
  store.update(update(first, 3), 100_004);
  const selectedFile = store.read(100_005);
  assert.ok(selectedFile.success);
  assert.equal(selectedFile.filename, 'emerald.sav');
});

test('background updates and releases cannot replace the focused tracker tab', () => {
  const store = new ActiveContextStore();
  store.update(update(), 10);
  store.update(update(second), 11);
  store.update({ ...update(first, 2), claim: false }, 12);
  store.update({ ...update(first, 3), claim: false, release: true }, 13);
  const active = store.read(14);
  assert.ok(active.success);
  assert.equal(active.sessionId, second);
});

test('out-of-order publications cannot resurrect cleared state', () => {
  const store = new ActiveContextStore();
  store.update(update(), 1);
  store.update({ ...update(first, 3), snapshot: null }, 2);
  store.update(update(first, 2), 3);
  assert.equal(store.read(4).success, false);
});

test('background tabs retain their selected context while explicit closing clears it', () => {
  const store = new ActiveContextStore();
  store.update(update(second), 1);
  store.update(update(), 2);
  const background = store.read(46_000);
  assert.equal(background.success, true);
  if (background.success) assert.equal(background.browserConnected, false);
  store.update({ ...update(first, 2), release: true }, 46_001);
  assert.equal(store.read(46_002).success, false);
});

test('server refresh cannot overwrite a newly selected file or a different tab', () => {
  const store = new ActiveContextStore();
  const live = update(); live.snapshot!.source = 'live';
  store.update(live, 1);
  const refreshed = { ...live.snapshot!, updatedAt: 100 };
  store.refreshLive(first, refreshed);
  const current = store.read(2);
  assert.ok(current.success);
  assert.equal(current.updatedAt, 100);
  store.update({ ...live, sequence: 2, claim: false }, 2);
  const retained = store.read(2);
  assert.ok(retained.success);
  assert.equal(retained.updatedAt, 100);
  store.update(update(first, 3), 3);
  store.refreshLive(first, refreshed);
  const file = store.read(4);
  assert.ok(file.success);
  assert.equal(file.source, 'file');
  store.update(update(second), 5);
  store.refreshLive(first, refreshed);
  const other = store.read(6);
  assert.ok(other.success);
  assert.equal(other.sessionId, second);
});

test('published context validates required fields before entering shared state', () => {
  assert.equal(activeContextUpdateSchema.safeParse(update()).success, true);
  const broken = update();
  (broken.snapshot!.context as unknown as { inventory: unknown }).inventory = 'invalid';
  assert.equal(activeContextUpdateSchema.safeParse(broken).success, false);
});
