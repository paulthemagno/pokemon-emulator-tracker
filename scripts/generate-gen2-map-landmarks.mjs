#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const pokecrystalRoot = path.resolve(process.argv[2] ?? process.env.POKECRYSTAL_ROOT ?? "/private/tmp/pokecrystal");
const outputPath = path.resolve(process.cwd(), "lib/pokemon/data/gen2-map-landmarks.ts");

const NAME_OVERRIDES = {
  BattleTowerName: "Battle Tower",
  BlackthornCityName: "Blackthorn City",
  BurnedTowerName: "Burned Tower",
  CeladonCityName: "Celadon City",
  CeruleanCityName: "Cerulean City",
  CherrygroveCityName: "Cherrygrove City",
  CianwoodCityName: "Cianwood City",
  CinnabarIslandName: "Cinnabar Island",
  DarkCaveName: "Dark Cave",
  DiglettsCaveName: "Diglett's Cave",
  DragonsDenName: "Dragon's Den",
  EcruteakCityName: "Ecruteak City",
  FastShipName: "Fast Ship",
  FuchsiaCityName: "Fuchsia City",
  GoldenrodCityName: "Goldenrod City",
  IcePathName: "Ice Path",
  IlexForestName: "Ilex Forest",
  IndigoPlateauName: "Indigo Plateau",
  LakeOfRageName: "Lake of Rage",
  LavRadioTowerName: "Lav Radio Tower",
  LavenderTownName: "Lavender Town",
  MahoganyTownName: "Mahogany Town",
  MtMoonName: "Mt Moon",
  MtMortarName: "Mt Mortar",
  NationalParkName: "National Park",
  NewBarkTownName: "New Bark Town",
  OlivineCityName: "Olivine City",
  PalletTownName: "Pallet Town",
  PewterCityName: "Pewter City",
  PowerPlantName: "Power Plant",
  RadioTowerName: "Radio Tower",
  RockTunnelName: "Rock Tunnel",
  RuinsOfAlphName: "Ruins of Alph",
  SaffronCityName: "Saffron City",
  SeafoamIslandsName: "Seafoam Islands",
  SilverCaveName: "Mt Silver",
  SlowpokeWellName: "Slowpoke Well",
  SproutTowerName: "Sprout Tower",
  TinTowerName: "Tin Tower",
  TohjoFallsName: "Tohjo Falls",
  UndergroundName: "Underground Path",
  UnionCaveName: "Union Cave",
  VermilionCityName: "Vermilion City",
  VictoryRoadName: "Victory Road",
  VioletCityName: "Violet City",
  ViridianCityName: "Viridian City",
  WhirlIslandsName: "Whirl Islands",
};

function prettifyNameSymbol(symbol) {
  const base = symbol.replace(/Name$/, "");
  return base
    .replace(/^Route(\d+)$/, "Route $1")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^Mt /, "Mt ")
    .replace(/^Route (\d+)$/, "Route $1")
    .trim();
}

function landmarkConstantToName(constant) {
  return constant
    .replace(/^LANDMARK_/, "")
    .toLowerCase()
    .split("_")
    .map((part) => (part === "mt" ? "Mt" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function parseLandmarkConstants(text) {
  const constants = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*const\s+(LANDMARK_[A-Z0-9_]+)/);
    if (match) constants.push(match[1]);
  }
  return constants;
}

function parseLandmarkPoints(text, constants) {
  const points = new Map();
  let index = 0;
  let region = "johto";

  for (const line of text.split("\n")) {
    if (line.includes("assert_table_length KANTO_LANDMARK")) region = "kanto";
    if (line.includes("assert_table_length NUM_LANDMARKS")) region = "other";

    const match = line.match(/landmark\s+(-?\d+),\s*(-?\d+),\s*(\w+)/);
    if (!match) continue;

    const constant = constants[index];
    index += 1;
    if (!constant || constant === "LANDMARK_SPECIAL") continue;

    const [, x, y, nameSymbol] = match;
    const name = NAME_OVERRIDES[nameSymbol] ?? prettifyNameSymbol(nameSymbol);
    points.set(constant, {
      name,
      x: Number(x),
      y: Number(y),
      region: region === "kanto" ? "kanto" : region === "other" ? "tohjo" : "johto",
    });
  }

  return points;
}

function parseMapToLandmark(text, points) {
  const entries = [];
  let group = 0;
  let mapId = 0;

  for (const line of text.split("\n")) {
    if (/^MapGroup_/.test(line)) {
      group += 1;
      mapId = 0;
      continue;
    }

    const match = line.match(/^\s*map\s+\w+,\s+[^,]+,\s+[^,]+,\s+(LANDMARK_[A-Z0-9_]+)/);
    if (!match || group === 0) continue;

    mapId += 1;
    const landmark = points.get(match[1]);
    if (!landmark) continue;

    entries.push([`${group}-${mapId}`, landmark.name]);
  }

  return entries;
}

function serializePoints(points) {
  return [...points.values()]
    .map((point) => `  ${JSON.stringify(point.name)}: { name: ${JSON.stringify(point.name)}, x: ${point.x}, y: ${point.y}, region: ${JSON.stringify(point.region)} },`)
    .join("\n");
}

function serializeMapEntries(entries) {
  return entries
    .map(([key, name]) => `  ${JSON.stringify(key)}: ${JSON.stringify(name)},`)
    .join("\n");
}

const landmarkConstants = parseLandmarkConstants(
  await fs.readFile(path.join(pokecrystalRoot, "constants/landmark_constants.asm"), "utf8"),
);
const landmarkPoints = parseLandmarkPoints(
  await fs.readFile(path.join(pokecrystalRoot, "data/maps/landmarks.asm"), "utf8"),
  landmarkConstants,
);
const mapEntries = parseMapToLandmark(
  await fs.readFile(path.join(pokecrystalRoot, "data/maps/maps.asm"), "utf8"),
  landmarkPoints,
);

const output = `export interface Gen2MapLandmark {
  name: string;
  x: number;
  y: number;
  region: "johto" | "kanto" | "tohjo";
}

export const GEN2_TOWN_MAP_WIDTH = 160;
export const GEN2_TOWN_MAP_HEIGHT = 144;

const LANDMARK_POINTS: Record<string, Gen2MapLandmark> = {
${serializePoints(landmarkPoints)}
};

const MAP_TO_LANDMARK: Record<string, string> = {
${serializeMapEntries(mapEntries)}
};

export function getGen2MapLandmark(mapGroup?: number, mapId?: number, fallbackName?: string): Gen2MapLandmark | null {
  const exact = MAP_TO_LANDMARK[\`\${mapGroup ?? 0}-\${mapId ?? 0}\`];
  if (exact) return LANDMARK_POINTS[exact] ?? null;

  if (fallbackName) {
    const normalized = fallbackName.replace(/\\s+/g, " ").trim();
    return LANDMARK_POINTS[normalized] ?? null;
  }

  return null;
}
`;

await fs.writeFile(outputPath, output);
console.log(`${outputPath} (${landmarkPoints.size} landmarks, ${mapEntries.length} map mappings)`);
