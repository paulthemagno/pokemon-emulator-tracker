import layout from './knowledge/sources/frontier-layout.json';
import type { BattleFrontier, GameEventProgress, GameVersion } from './types';

/** Decode the same SaveBlock2 range for file uploads and live snapshots. */
export function parseBattleFrontier(bytes: unknown, game: GameVersion, source: 'save' | 'live', events?: GameEventProgress): BattleFrontier | undefined {
  if (game !== 'emerald') return undefined;
  const raw = bytes instanceof Uint8Array ? bytes : Array.isArray(bytes) && bytes.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ? Uint8Array.from(bytes) : undefined;
  if (!raw || raw.length !== layout.end - layout.start) return undefined;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const read16 = (offset: number) => view.getUint16(offset - layout.start, true);
  const active = view.getUint32(0, true);
  const symbol = (id: string, medal: string) => events?.flags.find(flag => flag.key === `FLAG_SYS_${id.toUpperCase()}_${medal}`)?.rawSet ?? null;
  return {
    source, battlePoints: read16(layout.battlePoints), sourceRefs: layout.sourceFiles.map(file => `${layout.sourceUrl.replace('/tree/', '/blob/')}/${file}`),
    facilities: layout.facilities.map(facility => ({
      id: facility.id, silver: symbol(facility.id, 'SILVER'), gold: symbol(facility.id, 'GOLD'),
      records: facility.modes.flatMap((mode, index) => mode.masks.map((mask, level) => ({
        mode: mode.id, level: level === 0 ? '50' as const : 'open' as const,
        streak: Math.min(9999, read16(facility.current + index * 4 + level * 2)),
        record: Math.min(9999, read16(facility.record + index * 4 + level * 2)),
        isCurrent: (active & mask) !== 0, unit: facility.unit,
      }))),
    })),
  };
}

/** Distance to the first symbol milestones; ended series never carry progress forward. */
export function getFrontierSymbolProgress(facility: BattleFrontier['facilities'][number], record: BattleFrontier['facilities'][number]['records'][number], tier: 'silver' | 'gold') {
  const targets = layout.facilities.find(entry => entry.id === facility.id)?.symbolTargets;
  if (!targets) return undefined;
  const target = targets[tier];
  return {
    target,
    earned: facility[tier],
    eligible: record.mode === targets.mode,
    remaining: Math.max(0, target - (record.isCurrent ? record.streak : 0)),
    requiresSilver: tier === 'gold' && facility.silver !== true,
  };
}
