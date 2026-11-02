import type { GameVersion } from "./types";

// Filename hints only resolve titles within a content-validated family.
const TITLE_PATTERNS: Array<[GameVersion, RegExp]> = [
  ["leafgreen", /\b(?:leaf\s*green|verde\s*foglia|blattgr[uü]n|vert\s*feuille|verde\s*hoja)\b/],
  ["firered", /\b(?:fire\s*red|rosso\s*fuoco|feuerrot|rouge\s*feu|rojo\s*fuego)\b/],
  ["emerald", /\b(?:emerald|smeraldo|smaragd|[eé]meraude|esmeralda|pokeemerald)\b/],
  ["sapphire", /\b(?:sapphire|zaffiro|saphir|zafiro|pokesapphire)\b/],
  ["ruby", /\b(?:ruby|rubino|rubin|rubis|rub[ií]|pokeruby)\b/],
  ["crystal", /\b(?:crystal|cristallo|kristall|cristal)\b/],
  ["silver", /\b(?:silver|argento|silber|argent|plata)\b/],
  ["gold", /\b(?:gold|oro|or)\b/],
  ["yellow", /\b(?:yellow|giallo|gelb|jaune|amarillo)\b/],
  ["blue", /\b(?:blue|blu|blau|bleu|azul)\b/],
  ["red", /\b(?:red|rosso|rot|rouge|rojo)\b/],
];

export function getFilenameGame(filename: string): GameVersion | undefined {
  const normalized = filename.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ");
  return TITLE_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0];
}

export class GameSelectionRequired extends Error {
  constructor(public candidates: GameVersion[]) {
    super("The save format was recognized. Choose the game to identify the exact title.");
  }
}

export function selectSaveGame(candidates: GameVersion[], filename: string, override?: GameVersion): GameVersion {
  if (override) {
    if (!candidates.includes(override)) throw new Error("The selected game does not match this save's format.");
    return override;
  }
  if (candidates.length === 1) return candidates[0];
  const hint = getFilenameGame(filename);
  if (hint && candidates.includes(hint)) return hint;
  throw new GameSelectionRequired(candidates);
}

function listValid(data: Uint8Array, offset: number, capacity: number, maxSpecies: number): boolean {
  const count = data[offset];
  if (count > capacity || data[offset + count + 1] !== 0xff) return false;
  for (let i = 1; i <= count; i++) {
    if (data[offset + i] < 1 || data[offset + i] > maxSpecies) return false;
  }
  return true;
}

function sum(data: Uint8Array, start: number, end: number): number {
  let value = 0;
  for (let i = start; i <= end; i++) value += data[i];
  return value;
}

export function detectGbSave(data: Uint8Array): { generation: 1 | 2; candidates: GameVersion[] } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const matches: Array<{ generation: 1 | 2; candidates: GameVersion[] }> = [];
  // International Gen 1/2 layouts; Japanese/Korean layouts must not be read as these.
  // Reference: PKHeX SAV1Offsets, SAV2Offsets and SaveUtil (see detection docs).
  if (listValid(data, 0x2f2c, 6, 190) &&
      ((~sum(data, 0x2598, 0x3522)) & 0xff) === data[0x3523]) {
    const starter = data[0x29c3];
    matches.push({ generation: 1, candidates: starter === 0x54
      ? ["yellow"] : starter > 0 ? ["red", "blue"] : ["red", "blue", "yellow"] });
  }
  for (const [party, end, checksum, candidates] of [
    [0x288a, 0x2d68, 0x2d69, ["gold", "silver"]],
    [0x2865, 0x2b82, 0x2d0d, ["crystal"]],
  ] as const) {
    if (listValid(data, party, 6, 253) &&
        (sum(data, 0x2009, end) & 0xffff) === view.getUint16(checksum, true)) {
      matches.push({ generation: 2, candidates: [...candidates] });
    }
  }
  if (matches.length !== 1) {
    throw new Error("Save format could not be identified reliably. Use an intact in-game EN/IT/DE/FR/ES battery save; Japanese/Korean layouts are not supported yet.");
  }
  return matches[0];
}
