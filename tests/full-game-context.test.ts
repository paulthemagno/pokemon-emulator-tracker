import assert from 'node:assert/strict';
import test from 'node:test';
import { packGameContext, snapshotContextForStorage } from '../lib/chatbot/context-packer';
import { executeChatTool } from '../lib/chatbot/tools/registry';
import { activeContextUpdateSchema } from '../lib/chatbot/active-context';
import type { Pokemon, SaveData } from '../lib/pokemon/types';

const pokemon: Pokemon = { species: 373, speciesName: 'Salamence', nickname: 'MENCE', level: 58,
  currentHP: 193, maxHP: 193, experience: 240000, originalTrainer: 'PAUL', originalTrainerID: 1,
  stats: { hp: 193, attack: 190, defense: 120, speed: 140, specialAttack: 160, specialDefense: 120 },
  ivs: { hp: 20, attack: 21, defense: 22, speed: 23, specialAttack: 24, specialDefense: 25 },
  heldItem: 200, heldItemName: 'Leftovers', moves: [{ id: 53, name: 'Flamethrower', pp: 12, maxPP: 15 }] };
const save: SaveData = { generation: 3, game: 'emerald', valid: true, rawSize: 131072,
  trainer: { name: 'PAUL', id: 1, money: 28000, badges: [true], badgeCount: 1,
    playTime: { hours: 76, minutes: 44, seconds: 49 } },
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
  assert.deepEqual(parsed.snapshot?.context.partyPokemonDetailed?.[0].types, ['dragon', 'flying']);
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

test('Gen 1 species enrichment uses historical typing', () => {
  const data = { ...save, generation: 1 as const, game: 'red' as const,
    party: [{ ...pokemon, species: 81, speciesName: 'Magnemite' }] };
  assert.deepEqual(packGameContext(data)?.partyPokemonDetailed?.[0].types, ['electric']);
});
