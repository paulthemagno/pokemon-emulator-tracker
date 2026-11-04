import assert from 'node:assert/strict';
import test from 'node:test';
import { packGameContext, snapshotContextForStorage } from '../lib/chatbot/context-packer';
import { executeChatTool } from '../lib/chatbot/tools/registry';
import { activeContextUpdateSchema } from '../lib/chatbot/active-context';
import type { Pokemon, SaveData } from '../lib/pokemon/types';
import { normalizeLiveEventBytes } from '../lib/pokemon/events';
import { GEN3_EVENT_FLAGS } from '../lib/pokemon/knowledge/event-flags';

const pokemon: Pokemon = { species: 25, speciesName: 'Pikachu', nickname: 'TEST', level: 20,
  currentHP: 50, maxHP: 50, experience: 8000, originalTrainer: 'TEST', originalTrainerID: 1,
  stats: { hp: 50, attack: 35, defense: 30, speed: 60, specialAttack: 40, specialDefense: 40 },
  ivs: { hp: 20, attack: 21, defense: 22, speed: 23, specialAttack: 24, specialDefense: 25 },
  heldItem: 200, heldItemName: 'Leftovers', moves: [{ id: 53, name: 'Flamethrower', pp: 12, maxPP: 15 }] };
const save: SaveData = { generation: 3, game: 'emerald', valid: true, rawSize: 131072,
  trainer: { name: 'TEST', id: 1, money: 1000, badges: [true], badgeCount: 1,
    playTime: { hours: 1, minutes: 0, seconds: 0 } },
  party: [pokemon], pcBoxes: [{ name: 'Box 1', capacity: 30, isCurrent: true, pokemon: [null, pokemon] }],
  inventory: [{ name: 'PC Storage', items: [{ id: 203, name: 'Soft Sand', quantity: 1 }] }],
  location: { name: 'Rustboro City', mapId: 1, areaType: 'unknown' },
  events: { source: 'save', completedCount: 0, totalCount: 1, importantCompletedCount: 0, importantTotalCount: 0,
    flags: [{ id: 80, key: 'FLAG_HIDE_TEST', label: 'Hidden object', category: 'Other', completed: false,
      rawSet: true, stateKind: 'visibility', initiallySet: true, sourceRefs: ['https://example.com/script'] }] },
};

function result(name: string, args: Record<string, unknown> = {}) {
  const r = executeChatTool(name, args, packGameContext(save));
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.data;
}

test('full selected parser state survives the HTTP context schema without field stripping', () => {
  const context = packGameContext(save)!;
  const parsed = activeContextUpdateSchema.parse({ sessionId: '10000000-0000-4000-8000-000000000001',
    sequence: 1, claim: true, snapshot: { source: 'file', game: 'emerald', filename: 'test.sav',
      updatedAt: 1, stale: false, context } });
  assert.deepEqual(parsed.snapshot?.context.fullState, save);
  assert.deepEqual(parsed.snapshot?.context.partyPokemonDetailed?.[0].types, ['electric']);
  const move = parsed.snapshot?.context.partyPokemonDetailed?.[0].moves[0];
  assert.equal(move?.type, 'fire');
  assert.equal(move?.category, 'Special');
  assert.ok(move?.power);
  assert.equal(snapshotContextForStorage(context).fullState, undefined);
});

test('party and PC details reuse the existing tool and preserve stats, IVs, PP, and empty slots', () => {
  const party = result('get_pokemon_details', { partyIndex: 1 });
  const pc = result('get_pokemon_details', { boxIndex: 1, slotIndex: 2 });
  assert.deepEqual(party.stats, pokemon.stats);
  assert.deepEqual(pc.ivs, pokemon.ivs);
  assert.deepEqual(pc.pokemon, pokemon);
  const boxes = result('get_game_state', { section: 'pcBoxes', boxIndex: 1 });
  assert.equal((boxes.entries as Array<{ slotIndex: number }>)[0].slotIndex, 2);
});

test('held item lookup includes PC Pokemon even with no bag match', () => {
  const inventory = result('get_inventory_overview', { query: 'Leftovers' });
  assert.equal((inventory.items as unknown[]).length, 0);
  assert.equal((inventory.heldItems as unknown[]).length, 2);
  const pockets = result('get_game_state', { section: 'inventory' });
  assert.equal((pockets.entries as Array<{ pocket: string }>)[0].pocket, 'PC Storage');
});

test('event queries preserve raw state, visibility semantics and provenance', () => {
  const flags = result('get_game_state', { section: 'events', query: 'FLAG_HIDE_TEST', limit: 1 });
  assert.deepEqual((flags.entries as unknown[])[0], save.events!.flags[0]);
  assert.equal(result('get_game_state', { section: 'events', query: 'absent' }).totalMatches, 0);
});

test('MCP event queries expose Wally post-League bits with provenance and coverage limitations', () => {
  const bytes = Array(Math.ceil(GEN3_EVENT_FLAGS.emerald.flagCount / 8)).fill(0);
  bytes[Math.floor((0x500 + 657) / 8)] |= 1 << ((0x500 + 657) % 8);
  const events = normalizeLiveEventBytes({ bytes }, 3, 'emerald')!;
  const fixture: SaveData = {
    generation: 3, game: 'emerald', valid: true, rawSize: 0,
    trainer: { name: 'TEST', id: 1, money: 0, badges: [], badgeCount: 0,
      playTime: { hours: 0, minutes: 0, seconds: 0 } },
    party: [], pcBoxes: [], inventory: [], events,
    location: { name: 'Unknown', mapId: 0, areaType: 'unknown' },
  };
  const context = packGameContext(fixture);
  const r = executeChatTool('get_game_state', { section: 'events', query: 'TRAINER_WALLY_VR_2' }, context);
  assert.ok(r.ok);
  const data = r.data as { entries: Array<{ trainerId: number; completed: boolean; description: string; sourceRefs: string[] }>;
    coverage: { trainerRecordCount: number; scope: string }; interpretation: string; totalMatches: number };
  assert.equal(data.totalMatches, 1);
  assert.equal(data.entries[0].trainerId, 657);
  assert.equal(data.entries[0].completed, true);
  assert.match(data.entries[0].description, /post-League/);
  assert.ok(data.entries[0].sourceRefs.some(url => url.endsWith('/src/battle_setup.c')));
  assert.equal(data.coverage.trainerRecordCount, 854);
  assert.match(data.coverage.scope, /not an exhaustive/);
  assert.match(data.interpretation, /absent catalog entry is unknown/);
});

test('Gen 1 species enrichment uses historical typing', () => {
  const data = { ...save, generation: 1 as const, game: 'red' as const,
    party: [{ ...pokemon, species: 81, speciesName: 'Magnemite' }] };
  assert.deepEqual(packGameContext(data)?.partyPokemonDetailed?.[0].types, ['electric']);
});
