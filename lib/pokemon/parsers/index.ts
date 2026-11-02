// Pokemon Save File Parser - Unified Entry Point
// Supports Gen 1 (Red/Blue/Yellow), Gen 2 (Gold/Silver/Crystal), Gen 3 (RSE/FRLG)

import type { SaveData, GameVersion } from "../types";
import { parseGen1Save } from "./gen1";
import { parseGen2Save } from "./gen2";
import { parseGen3Save } from "./gen3";
import { detectGbSave, selectSaveGame, GameSelectionRequired } from "../game-detection";

// File size constants for detection
const GEN1_SAVE_SIZE = 32768; // 32KB
const GEN2_SAVE_SIZE = 32768; // 32KB
const GEN3_SAVE_SIZE = 131072; // 128KB
const SIZE_TOLERANCE = 1024; // Some emulators append small RTC/footer metadata.

export type ParseResult =
  | { success: true; data: SaveData }
  | { success: false; error: string; candidates?: GameVersion[] };

function normalizeSaveBuffer(buffer: ArrayBuffer): ArrayBuffer {
  const size = buffer.byteLength;
  const targets = [
    GEN1_SAVE_SIZE,
    GEN3_SAVE_SIZE,
    GEN3_SAVE_SIZE * 2, // Some emulators create double-size saves
  ];
  const target = targets.find(
    (validSize) => size >= validSize && size <= validSize + SIZE_TOLERANCE
  );

  return target && size !== target ? buffer.slice(0, target) : buffer;
}

/**
 * Detects the generation of a Pokemon save file based on size and signatures
 */
export function detectGeneration(
  buffer: ArrayBuffer,
  _filename = ""
): 1 | 2 | 3 | "unknown" {
  const normalizedBuffer = normalizeSaveBuffer(buffer);
  const size = normalizedBuffer.byteLength;
  const data = new Uint8Array(normalizedBuffer);

  // Gen 3 is easy to detect by size
  if (size === GEN3_SAVE_SIZE || size === GEN3_SAVE_SIZE * 2) {
    return 3;
  }

  // Gen 1 and Gen 2 are both 32KB, need to use signatures
  if (size === GEN1_SAVE_SIZE) {
    try { return detectGbSave(data).generation; } catch { return "unknown"; }
  }

  return "unknown";
}

/**
 * Parses a Pokemon save file and returns the extracted data
 */
export function parseSaveFile(buffer: ArrayBuffer, filename = "", game?: GameVersion): ParseResult {
  try {
    const normalizedBuffer = normalizeSaveBuffer(buffer);
    const generation = detectGeneration(normalizedBuffer, filename);

    switch (generation) {
      case 1:
      case 2: {
        const bytes = new Uint8Array(normalizedBuffer);
        const detected = detectGbSave(bytes);
        const selected = selectSaveGame(detected.candidates, filename, game);
        return { success: true, data: generation === 1
          ? parseGen1Save(bytes, `${selected}.sav`)
          : parseGen2Save(bytes, `${selected}.sav`) };
      }
      case 3:
        return { success: true, data: parseGen3Save(normalizedBuffer, filename, game) };
      case "unknown":
        return {
          success: false,
          error: `Unable to identify a supported intact Pokemon save. Language-specific Japanese/Korean layouts are not supported yet. File size: ${buffer.byteLength} bytes. Expected: 32KB (Gen 1/2) or 128KB (Gen 3), with small emulator metadata tolerated.`,
        };
    }
  } catch (error) {
    if (error instanceof GameSelectionRequired) return { success: false, error: error.message, candidates: error.candidates };
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown parsing error",
    };
  }
}

/**
 * Gets supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return [".sav", ".srm", ".sa1", ".sa2", ".sn1", ".sn2"];
}

/**
 * Validates if a file is a supported save file format
 */
export function isValidSaveFile(filename: string, size: number): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  const validExtensions = ["sav", "srm", "sa1", "sa2", "sn1", "sn2"];

  if (!ext || !validExtensions.includes(ext)) {
    return false;
  }

  // Check valid sizes, allowing small appended emulator metadata.
  const validSizes = [
    GEN1_SAVE_SIZE,
    GEN2_SAVE_SIZE,
    GEN3_SAVE_SIZE,
    GEN3_SAVE_SIZE * 2, // Some emulators create double-size saves
  ];

  return validSizes.some(
    (validSize) => size >= validSize && size <= validSize + SIZE_TOLERANCE
  );
}

export { parseGen1Save } from "./gen1";
export { parseGen2Save } from "./gen2";
export { parseGen3Save } from "./gen3";
