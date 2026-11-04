import { REVIEWED_PROGRESS_VARIABLES } from "./knowledge/progress-variables";
import type { GameProgressVariable, GameVersion } from "./types";

export function normalizeProgressVariables(raw: unknown, game: GameVersion): GameProgressVariable[] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const values = raw as Record<string, unknown>;
  const entries = (REVIEWED_PROGRESS_VARIABLES[game] ?? []).flatMap(definition => {
    const value = values[definition.key];
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffff
      ? [{ ...definition, value }] : [];
  });
  return entries.length ? entries : undefined;
}

export function readProgressVariables(data: Uint8Array, varsOffset: number, game: GameVersion): GameProgressVariable[] | undefined {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const values: Record<string, number> = {};
  for (const definition of REVIEWED_PROGRESS_VARIABLES[game] ?? []) {
    const offset = varsOffset + (definition.id - 0x4000) * 2;
    if (offset >= 0 && offset + 2 <= data.length) values[definition.key] = view.getUint16(offset, true);
  }
  return normalizeProgressVariables(values, game);
}
