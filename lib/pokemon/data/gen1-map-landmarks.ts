export interface Gen1MapLandmark {
  name: string;
  x: number;
  y: number;
}

export const GEN1_TOWN_MAP_WIDTH = 160;
export const GEN1_TOWN_MAP_HEIGHT = 144;

const EXTERNAL_MAP_ENTRIES: Record<number, Gen1MapLandmark> = {
  0x00: { name: "Pallet Town", x: 2, y: 11 },
  0x01: { name: "Viridian City", x: 2, y: 8 },
  0x02: { name: "Pewter City", x: 2, y: 3 },
  0x03: { name: "Cerulean City", x: 10, y: 2 },
  0x04: { name: "Lavender Town", x: 14, y: 5 },
  0x05: { name: "Vermilion City", x: 10, y: 9 },
  0x06: { name: "Celadon City", x: 7, y: 5 },
  0x07: { name: "Fuchsia City", x: 8, y: 13 },
  0x08: { name: "Cinnabar Island", x: 2, y: 15 },
  0x09: { name: "Indigo Plateau", x: 0, y: 2 },
  0x0a: { name: "Saffron City", x: 10, y: 5 },
  0x0b: { name: "Pallet Town", x: 0, y: 0 },
  0x0c: { name: "Route 1", x: 2, y: 10 },
  0x0d: { name: "Route 2", x: 2, y: 6 },
  0x0e: { name: "Route 3", x: 4, y: 3 },
  0x0f: { name: "Route 4", x: 8, y: 2 },
  0x10: { name: "Route 5", x: 10, y: 3 },
  0x11: { name: "Route 6", x: 10, y: 8 },
  0x12: { name: "Route 7", x: 8, y: 5 },
  0x13: { name: "Route 8", x: 13, y: 5 },
  0x14: { name: "Route 9", x: 13, y: 2 },
  0x15: { name: "Route 10", x: 14, y: 4 },
  0x16: { name: "Route 11", x: 12, y: 9 },
  0x17: { name: "Route 12", x: 14, y: 9 },
  0x18: { name: "Route 13", x: 13, y: 11 },
  0x19: { name: "Route 14", x: 11, y: 12 },
  0x1a: { name: "Route 15", x: 10, y: 13 },
  0x1b: { name: "Route 16", x: 5, y: 5 },
  0x1c: { name: "Route 17", x: 4, y: 8 },
  0x1d: { name: "Route 18", x: 6, y: 13 },
  0x1e: { name: "Route 19", x: 6, y: 15 },
  0x1f: { name: "Route 20", x: 4, y: 15 },
  0x20: { name: "Route 21", x: 2, y: 13 },
  0x21: { name: "Route 22", x: 0, y: 8 },
  0x22: { name: "Route 23", x: 0, y: 6 },
  0x23: { name: "Route 24", x: 10, y: 1 },
  0x24: { name: "Route 25", x: 11, y: 0 },
};

type IndoorMapEntry = {
  maxExclusiveMapId: number;
  landmark: Gen1MapLandmark;
};

// Source: pret/pokered data/maps/town_map_entries.asm plus constants/map_constants.asm.
// Gen 1 LoadTownMapEntry scans these indoor group thresholds and uses the first
// entry whose threshold is greater than the current map id.
const INTERNAL_MAP_ENTRIES: IndoorMapEntry[] = [
  { maxExclusiveMapId: 0x29, landmark: { name: "Pallet Town", x: 2, y: 11 } },
  { maxExclusiveMapId: 0x2e, landmark: { name: "Viridian City", x: 2, y: 8 } },
  { maxExclusiveMapId: 0x33, landmark: { name: "Route 2", x: 2, y: 6 } },
  { maxExclusiveMapId: 0x34, landmark: { name: "Viridian Forest", x: 2, y: 4 } },
  { maxExclusiveMapId: 0x3b, landmark: { name: "Pewter City", x: 2, y: 3 } },
  { maxExclusiveMapId: 0x3e, landmark: { name: "Mt. Moon", x: 6, y: 2 } },
  { maxExclusiveMapId: 0x44, landmark: { name: "Cerulean City", x: 10, y: 2 } },
  { maxExclusiveMapId: 0x45, landmark: { name: "Route 4", x: 5, y: 2 } },
  { maxExclusiveMapId: 0x46, landmark: { name: "Cerulean City", x: 10, y: 2 } },
  { maxExclusiveMapId: 0x49, landmark: { name: "Route 5", x: 10, y: 4 } },
  { maxExclusiveMapId: 0x4c, landmark: { name: "Route 6", x: 10, y: 6 } },
  { maxExclusiveMapId: 0x4f, landmark: { name: "Route 7", x: 9, y: 5 } },
  { maxExclusiveMapId: 0x51, landmark: { name: "Route 8", x: 11, y: 5 } },
  { maxExclusiveMapId: 0x53, landmark: { name: "Rock Tunnel", x: 14, y: 3 } },
  { maxExclusiveMapId: 0x54, landmark: { name: "Power Plant", x: 15, y: 4 } },
  { maxExclusiveMapId: 0x57, landmark: { name: "Route 11", x: 13, y: 9 } },
  { maxExclusiveMapId: 0x58, landmark: { name: "Route 12", x: 14, y: 7 } },
  { maxExclusiveMapId: 0x59, landmark: { name: "Sea Cottage", x: 12, y: 0 } },
  { maxExclusiveMapId: 0x5f, landmark: { name: "Vermilion City", x: 10, y: 9 } },
  { maxExclusiveMapId: 0x69, landmark: { name: "S.S. Anne", x: 9, y: 10 } },
  { maxExclusiveMapId: 0x6d, landmark: { name: "Victory Road", x: 0, y: 4 } },
  { maxExclusiveMapId: 0x77, landmark: { name: "Pokemon League", x: 0, y: 2 } },
  { maxExclusiveMapId: 0x78, landmark: { name: "Underground Path", x: 10, y: 5 } },
  { maxExclusiveMapId: 0x79, landmark: { name: "Pokemon League", x: 0, y: 2 } },
  { maxExclusiveMapId: 0x7a, landmark: { name: "Underground Path", x: 10, y: 5 } },
  { maxExclusiveMapId: 0x8d, landmark: { name: "Celadon City", x: 7, y: 5 } },
  { maxExclusiveMapId: 0x8e, landmark: { name: "Lavender Town", x: 14, y: 5 } },
  { maxExclusiveMapId: 0x95, landmark: { name: "Pokemon Tower", x: 15, y: 5 } },
  { maxExclusiveMapId: 0x98, landmark: { name: "Lavender Town", x: 14, y: 5 } },
  { maxExclusiveMapId: 0x9c, landmark: { name: "Fuchsia City", x: 8, y: 13 } },
  { maxExclusiveMapId: 0x9d, landmark: { name: "Safari Zone", x: 8, y: 12 } },
  { maxExclusiveMapId: 0x9f, landmark: { name: "Fuchsia City", x: 8, y: 13 } },
  { maxExclusiveMapId: 0xa3, landmark: { name: "Seafoam Islands", x: 5, y: 15 } },
  { maxExclusiveMapId: 0xa4, landmark: { name: "Vermilion City", x: 10, y: 9 } },
  { maxExclusiveMapId: 0xa5, landmark: { name: "Fuchsia City", x: 8, y: 13 } },
  { maxExclusiveMapId: 0xa6, landmark: { name: "Pokemon Mansion", x: 2, y: 15 } },
  { maxExclusiveMapId: 0xae, landmark: { name: "Cinnabar Island", x: 2, y: 15 } },
  { maxExclusiveMapId: 0xaf, landmark: { name: "Indigo Plateau", x: 0, y: 2 } },
  { maxExclusiveMapId: 0xb8, landmark: { name: "Saffron City", x: 10, y: 5 } },
  { maxExclusiveMapId: 0xba, landmark: { name: "Route 15", x: 9, y: 13 } },
  { maxExclusiveMapId: 0xbd, landmark: { name: "Route 16", x: 4, y: 5 } },
  { maxExclusiveMapId: 0xbe, landmark: { name: "Route 12", x: 14, y: 10 } },
  { maxExclusiveMapId: 0xc0, landmark: { name: "Route 18", x: 7, y: 13 } },
  { maxExclusiveMapId: 0xc1, landmark: { name: "Seafoam Islands", x: 5, y: 15 } },
  { maxExclusiveMapId: 0xc2, landmark: { name: "Route 22", x: 0, y: 7 } },
  { maxExclusiveMapId: 0xc3, landmark: { name: "Victory Road", x: 0, y: 4 } },
  { maxExclusiveMapId: 0xc4, landmark: { name: "Route 12", x: 14, y: 7 } },
  { maxExclusiveMapId: 0xc5, landmark: { name: "Vermilion City", x: 10, y: 9 } },
  { maxExclusiveMapId: 0xc6, landmark: { name: "Diglett's Cave", x: 3, y: 4 } },
  { maxExclusiveMapId: 0xc7, landmark: { name: "Victory Road", x: 0, y: 4 } },
  { maxExclusiveMapId: 0xcf, landmark: { name: "Rocket HQ", x: 7, y: 5 } },
  { maxExclusiveMapId: 0xd6, landmark: { name: "Silph Co.", x: 10, y: 5 } },
  { maxExclusiveMapId: 0xd9, landmark: { name: "Pokemon Mansion", x: 2, y: 15 } },
  { maxExclusiveMapId: 0xe2, landmark: { name: "Safari Zone", x: 8, y: 12 } },
  { maxExclusiveMapId: 0xe5, landmark: { name: "Cerulean Cave", x: 9, y: 1 } },
  { maxExclusiveMapId: 0xe6, landmark: { name: "Lavender Town", x: 14, y: 5 } },
  { maxExclusiveMapId: 0xe7, landmark: { name: "Cerulean City", x: 10, y: 2 } },
  { maxExclusiveMapId: 0xe9, landmark: { name: "Rock Tunnel", x: 14, y: 3 } },
  { maxExclusiveMapId: 0xed, landmark: { name: "Silph Co.", x: 10, y: 5 } },
  { maxExclusiveMapId: 0xf8, landmark: { name: "Pokemon League", x: 0, y: 2 } },
];

export function getGen1TownMapPixel(landmark: Gen1MapLandmark) {
  return {
    // Matches the visible center of the 16x16 player sprite after:
    // TownMapCoordsToOAMCoords -> WritePlayerOrBirdSpriteOAM -> GB OAM X/Y offsets.
    x: landmark.x * 8 + 20,
    y: landmark.y * 8 + 13,
  };
}

export function getGen1MapLandmark(mapId?: number): Gen1MapLandmark | null {
  if (typeof mapId !== "number" || !Number.isFinite(mapId)) return null;
  const normalized = mapId & 0xff;
  if (EXTERNAL_MAP_ENTRIES[normalized]) return EXTERNAL_MAP_ENTRIES[normalized];

  for (const entry of INTERNAL_MAP_ENTRIES) {
    if (normalized < entry.maxExclusiveMapId) return entry.landmark;
  }

  return null;
}
