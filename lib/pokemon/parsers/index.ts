// Pokemon Save File Parser - Unified Entry Point
// Supports Gen 1 (Red/Blue/Yellow), Gen 2 (Gold/Silver/Crystal), Gen 3 (RSE/FRLG)

import { SaveData } from "../types";
import { parseGen1Save } from "./gen1";
import { parseGen2Save } from "./gen2";
import { parseGen3Save } from "./gen3";

// File size constants for detection
const GEN1_SAVE_SIZE = 32768; // 32KB
const GEN2_SAVE_SIZE = 32768; // 32KB
const GEN3_SAVE_SIZE = 131072; // 128KB
const SIZE_TOLERANCE = 1024; // Some emulators append small RTC/footer metadata.

// Signature patterns for game detection
const GEN1_CHECKSUM_OFFSET = 0x3523;
const GEN2_CHECKSUM_OFFSET = 0x2d69;

export type ParseResult =
  | { success: true; data: SaveData }
  | { success: false; error: string };

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
  filename = ""
): 1 | 2 | 3 | "unknown" {
  const normalizedBuffer = normalizeSaveBuffer(buffer);
  const size = normalizedBuffer.byteLength;
  const data = new Uint8Array(normalizedBuffer);
  const lowerFilename = filename.toLowerCase();

  // Gen 3 is easy to detect by size
  if (size === GEN3_SAVE_SIZE || size === GEN3_SAVE_SIZE * 2) {
    return 3;
  }

  // Gen 1 and Gen 2 are both 32KB, need to use signatures
  if (size === GEN1_SAVE_SIZE) {
    if (/\b(gold|silver|crystal)\b/.test(lowerFilename)) return 2;
    if (/\b(red|blue|yellow)\b/.test(lowerFilename)) return 1;

    // Check for Gen 2 specific patterns
    // Gen 2 has different structure at certain offsets
    
    // Check player name offset - Gen 1 starts at 0x2598, Gen 2 at 0x200B
    const gen2NameOffset = 0x200b;
    const gen1NameOffset = 0x2598;
    
    // Gen 2 games have a specific pattern at the beginning
    // Check for valid character codes at Gen 2 name location
    let gen2ValidChars = 0;
    for (let i = 0; i < 7; i++) {
      const char = data[gen2NameOffset + i];
      if ((char >= 0x80 && char <= 0xbf) || char === 0x50) {
        gen2ValidChars++;
      }
    }
    
    // Check Gen 1 name location
    let gen1ValidChars = 0;
    for (let i = 0; i < 7; i++) {
      const char = data[gen1NameOffset + i];
      if ((char >= 0x80 && char <= 0xbf) || char === 0x50) {
        gen1ValidChars++;
      }
    }
    
    // More valid chars at Gen 2 offset suggests Gen 2
    if (gen2ValidChars > gen1ValidChars) {
      return 2;
    }
    
    // Additional check: Gen 2 has time data that Gen 1 doesn't
    const timeOffset = 0x2053;
    const hasTimeData = data[timeOffset] !== 0xff && data[timeOffset] < 24;
    
    if (hasTimeData && gen2ValidChars >= 3) {
      return 2;
    }
    
    return 1;
  }

  return "unknown";
}

/**
 * Parses a Pokemon save file and returns the extracted data
 */
export function parseSaveFile(buffer: ArrayBuffer, filename = ""): ParseResult {
  try {
    const normalizedBuffer = normalizeSaveBuffer(buffer);
    const generation = detectGeneration(normalizedBuffer, filename);

    switch (generation) {
      case 1:
        return { success: true, data: parseGen1Save(new Uint8Array(normalizedBuffer)) };
      case 2:
        return { success: true, data: parseGen2Save(new Uint8Array(normalizedBuffer), filename) };
      case 3:
        return { success: true, data: parseGen3Save(normalizedBuffer) };
      case "unknown":
        return {
          success: false,
          error: `Unable to detect Pokemon game generation. File size: ${buffer.byteLength} bytes. Expected: 32KB (Gen 1/2) or 128KB (Gen 3), with small emulator metadata tolerated.`,
        };
    }
  } catch (error) {
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
