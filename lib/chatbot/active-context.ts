import { z } from 'zod';
import type { GameContextSnapshot } from './types';
import type { SaveData } from '../pokemon/types';

// Keep the original object intact, including optional parser diagnostics and event
// provenance. Validate the containers that tools traverse before retaining it.
const fullStateShape = z.object({ generation: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  game: z.enum(['red','blue','yellow','gold','silver','crystal','ruby','sapphire','emerald','firered','leafgreen']),
  trainer: z.object({ name: z.string(), money: z.number(), badges: z.array(z.boolean()), playTime: z.object({ hours: z.number(), minutes: z.number(), seconds: z.number() }) }),
  party: z.array(z.object({ species: z.number(), moves: z.array(z.object({ id: z.number() })) })),
  pcBoxes: z.array(z.object({ name: z.string(), pokemon: z.array(z.object({ species: z.number(), moves: z.array(z.object({ id: z.number() })) }).nullable()) })),
  inventory: z.array(z.object({ name: z.string(), items: z.array(z.object({ id: z.number(), name: z.string(), quantity: z.number() })) })),
  events: z.object({ flags: z.array(z.object({ key: z.string(), rawSet: z.boolean().optional() })) }).optional(),
  location: z.object({ name: z.string() }),
});

const summary = z.object({ name: z.string(), level: z.number(), hp: z.number(), maxHp: z.number() });
const contextSchema: z.ZodType<GameContextSnapshot> = z.object({
  fullState: z.custom<SaveData>(value => fullStateShape.safeParse(value).success).optional(),
  trainerName: z.string(), location: z.string(), money: z.number(), badges: z.number(),
  playtime: z.object({ hours: z.number(), minutes: z.number(), seconds: z.number() }),
  partyPokemon: z.array(summary).max(6),
  partyPokemonDetailed: z.array(summary.extend({
    species: z.string(), types: z.array(z.string()), status: z.string(),
    ability: z.string().optional(), nature: z.string().optional(), heldItem: z.string().optional(),
    moves: z.array(z.object({ name: z.string(), type: z.string(), category: z.string().optional(),
      power: z.number().optional(), accuracy: z.number().optional(), pp: z.number(), maxPp: z.number() }).passthrough()).max(4),
  }).passthrough()).max(6).optional(),
  pokedexSeen: z.number(), pokedexOwned: z.number(),
  pokedexSeenList: z.array(z.number()), pokedexCaughtList: z.array(z.number()),
  inventory: z.array(z.object({ name: z.string(), quantity: z.number() })),
  progressFacts: z.array(z.object({ label: z.string(), value: z.string(), description: z.string(), nextStep: z.string().optional() })).optional(),
  timestamp: z.number(), gameTitle: z.string().optional(), battleActive: z.boolean().optional(),
});

export const activeContextUpdateSchema = z.object({
  sessionId: z.string().uuid(), sequence: z.number().int().nonnegative(),
  claim: z.boolean().default(false), release: z.boolean().default(false),
  snapshot: z.object({
    source: z.enum(['file', 'live']), game: z.string(), filename: z.string().nullable(),
    updatedAt: z.number().finite(), stale: z.boolean(), error: z.string().optional(), context: contextSchema,
  }).nullable(),
});

export type ActiveContextUpdate = z.infer<typeof activeContextUpdateSchema>;
export type ActiveGameSnapshot = NonNullable<ActiveContextUpdate['snapshot']>;
type Session = { sequence: number; receivedAt: number; snapshot: ActiveGameSnapshot | null };

// In-memory only, including across Next dev module reloads. No save files are written.
export class ActiveContextStore {
  private sessions = new Map<string, Session>();
  private activeSessionId: string | null = null;

  update(update: ActiveContextUpdate, now = Date.now()) {
    const previous = this.sessions.get(update.sessionId);
    if (previous && update.sequence <= previous.sequence) return;
    for (const [id, session] of this.sessions) {
      if (now - session.receivedAt > 120_000 && id !== this.activeSessionId) this.sessions.delete(id);
    }
    if (!previous && this.sessions.size >= 16) throw new Error('Too many tracker sessions');
    let snapshot = update.release ? null : update.snapshot;
    if (snapshot?.source === 'live' && previous?.snapshot?.source === 'live'
      && snapshot.game === previous.snapshot.game && snapshot.updatedAt < previous.snapshot.updatedAt) {
      snapshot = previous.snapshot;
    }
    this.sessions.set(update.sessionId, { sequence: update.sequence, receivedAt: now, snapshot });
    if (update.claim) this.activeSessionId = update.sessionId;
    // A late close from another tab must not clear the selected tab.
    if (update.release && this.activeSessionId === update.sessionId) this.activeSessionId = null;
  }

  read(now = Date.now()) {
    const session = this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined;
    if (!session || !session.snapshot) {
      return { success: false as const, error: 'No active tracker context. Open or focus the tracker and load a save or start live mode.' };
    }
    return { success: true as const, ...session.snapshot, sessionId: this.activeSessionId,
      receivedAt: session.receivedAt, browserConnected: now - session.receivedAt <= 45_000 };
  }

  refreshLive(sessionId: string, snapshot: ActiveGameSnapshot) {
    const session = this.sessions.get(sessionId);
    // Never overwrite a tab/source switch or a newer browser snapshot.
    if (this.activeSessionId !== sessionId || session?.snapshot?.source !== 'live'
      || snapshot.source !== 'live' || snapshot.updatedAt < session.snapshot.updatedAt) return;
    session.snapshot = snapshot;
  }
}

const globalStore = globalThis as typeof globalThis & { pokemonActiveContextStore?: ActiveContextStore };
export const activeContextStore = globalStore.pokemonActiveContextStore ??= new ActiveContextStore();
// Next dev reloads retain global data but replace class definitions. Preserve
// sessions while upgrading their methods instead of keeping an obsolete instance.
Object.setPrototypeOf(activeContextStore, ActiveContextStore.prototype);
