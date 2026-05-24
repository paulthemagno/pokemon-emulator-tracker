#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const sourceRoot = args.get("--source-root");
const outPath = args.get("--out") ?? "lib/pokemon/data/gen3-frlg-map-landmarks.ts";

if (!sourceRoot) {
  console.error(
    "Usage: node scripts/generate-gen3-frlg-map-landmarks.mjs --source-root /path/to/pokefirered [--out lib/pokemon/data/gen3-frlg-map-landmarks.ts]",
  );
  process.exit(1);
}

const viewSources = [
  { view: "kanto", label: "Kanto", file: "src/data/region_map/region_map_layout_kanto.h" },
  { view: "sevii123", label: "Sevii Islands 1-3", file: "src/data/region_map/region_map_layout_sevii_123.h" },
  { view: "sevii45", label: "Sevii Islands 4-5", file: "src/data/region_map/region_map_layout_sevii_45.h" },
  { view: "sevii67", label: "Sevii Islands 6-7", file: "src/data/region_map/region_map_layout_sevii_67.h" },
];

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(sourceRoot, relPath), "utf8"));
}

function parseRegionLayout(relPath) {
  const text = fs.readFileSync(path.join(sourceRoot, relPath), "utf8");
  const rows = [...text.matchAll(/\{([^{}\n]*(?:MAPSEC_[A-Z0-9_]+|MAPSEC_NONE)[^{}\n]*)\}/g)]
    .map((match) => [...match[1].matchAll(/MAPSEC_[A-Z0-9_]+|MAPSEC_NONE/g)].map((token) => token[0]))
    .filter((row) => row.length > 0);
  const sectionBoxes = new Map();

  rows.forEach((row, rowIndex) => {
    const y = rowIndex % 15;
    row.forEach((sectionId, x) => {
      if (sectionId === "MAPSEC_NONE") return;
      const box = sectionBoxes.get(sectionId) ?? { x, y, maxX: x, maxY: y };
      box.x = Math.min(box.x, x);
      box.y = Math.min(box.y, y);
      box.maxX = Math.max(box.maxX, x);
      box.maxY = Math.max(box.maxY, y);
      sectionBoxes.set(sectionId, box);
    });
  });

  return sectionBoxes;
}

const sectionNames = new Map();
for (const section of readJson("src/data/region_map/region_map_sections.json").map_sections) {
  sectionNames.set(section.id, section.name);
}

const sectionViews = new Map();
for (const source of viewSources) {
  const boxes = parseRegionLayout(source.file);
  for (const [sectionId, box] of boxes.entries()) {
    sectionViews.set(sectionId, {
      mapView: source.view,
      mapViewLabel: source.label,
      x: box.x,
      y: box.y,
      width: box.maxX - box.x + 1,
      height: box.maxY - box.y + 1,
    });
  }
}

const mapGroups = readJson("data/maps/map_groups.json");
const entries = [];
for (let groupIndex = 0; groupIndex < mapGroups.group_order.length; groupIndex += 1) {
  const groupName = mapGroups.group_order[groupIndex];
  const maps = mapGroups[groupName] ?? [];
  for (let mapIndex = 0; mapIndex < maps.length; mapIndex += 1) {
    const mapName = maps[mapIndex];
    const mapJsonPath = path.join(sourceRoot, "data/maps", mapName, "map.json");
    if (!fs.existsSync(mapJsonPath)) continue;
    const mapJson = JSON.parse(fs.readFileSync(mapJsonPath, "utf8"));
    const sectionId = mapJson.region_map_section;
    const view = sectionViews.get(sectionId);
    if (!sectionId || sectionId === "MAPSEC_NONE" || !view) continue;
    entries.push({
      key: `${groupIndex}-${mapIndex}`,
      mapName,
      sectionId,
      name: sectionNames.get(sectionId) ?? sectionId.replace(/^MAPSEC_/, "").replaceAll("_", " "),
      ...view,
    });
  }
}

entries.sort((a, b) => {
  const [ag, ai] = a.key.split("-").map(Number);
  const [bg, bi] = b.key.split("-").map(Number);
  return ag - bg || ai - bi;
});

function quote(value) {
  return JSON.stringify(value);
}

const lines = [
  "// Generated from pret/pokefirered src/data/region_map/region_map_sections.json,",
  "// src/data/region_map/region_map_layout_*.h, data/maps/map_groups.json, and data/maps/*/map.json.",
  "// Keep this source-backed; do not hand-adjust individual coordinates.",
  "",
  'import type { Gen3MapLandmark, Gen3MapPosition } from "./gen3-map-landmarks";',
  "",
  "export const GEN3_FRLG_REGION_MAP_WIDTH = 240;",
  "export const GEN3_FRLG_REGION_MAP_HEIGHT = 160;",
  "",
  'export type Gen3FRLGMapView = "kanto" | "sevii123" | "sevii45" | "sevii67";',
  "",
  "export type Gen3FRLGMapLandmark = Gen3MapLandmark & {",
  "  mapView: Gen3FRLGMapView;",
  "  mapViewLabel: string;",
  "};",
  "",
  "export const GEN3_FRLG_MAP_ASSETS: Record<Gen3FRLGMapView, { src: string; label: string; alt: string }> = {",
  '  kanto: { src: "/maps/kanto-map-frlg.svg", label: "Kanto", alt: "Kanto region map from Pokemon FireRed and LeafGreen" },',
  '  sevii123: { src: "/maps/frlg-islands-1-3-map.svg", label: "Sevii Islands 1-3", alt: "Sevii Islands 1-3 region map from Pokemon FireRed and LeafGreen" },',
  '  sevii45: { src: "/maps/frlg-islands-4-5-map.svg", label: "Sevii Islands 4-5", alt: "Sevii Islands 4-5 region map from Pokemon FireRed and LeafGreen" },',
  '  sevii67: { src: "/maps/frlg-islands-6-7-map.svg", label: "Sevii Islands 6-7", alt: "Sevii Islands 6-7 region map from Pokemon FireRed and LeafGreen" },',
  "};",
  "",
  "export const GEN3_FRLG_MAP_LANDMARKS: Record<string, Gen3FRLGMapLandmark> = {",
];

for (const entry of entries) {
  lines.push(
    `  ${quote(entry.key)}: {mapName:${quote(entry.mapName)},sectionId:${quote(entry.sectionId)},name:${quote(entry.name)},x:${entry.x},y:${entry.y},width:${entry.width},height:${entry.height},mapView:${quote(entry.mapView)},mapViewLabel:${quote(entry.mapViewLabel)}},`,
  );
}

lines.push(
  "};",
  "",
  "export const GEN3_FRLG_KANTO_MAP_LANDMARKS: Record<string, Gen3FRLGMapLandmark> = Object.fromEntries(",
  '  Object.entries(GEN3_FRLG_MAP_LANDMARKS).filter(([, landmark]) => landmark.mapView === "kanto"),',
  ") as Record<string, Gen3FRLGMapLandmark>;",
  "",
  "export function getGen3FRLGMapLandmark(mapGroup?: number, mapId?: number): Gen3FRLGMapLandmark | null {",
  "  if (mapGroup === undefined || mapId === undefined) return null;",
  "  return GEN3_FRLG_MAP_LANDMARKS[`${mapGroup}-${mapId}`] ?? null;",
  "}",
  "",
  "export function getGen3FRLGRegionMapPixel(landmark: Gen3FRLGMapLandmark, _position?: Gen3MapPosition): { x: number; y: number } {",
  "  return {",
  "    x: 36 + (landmark.x + landmark.width / 2 - 0.5) * 8,",
  "    y: 36 + (landmark.y + landmark.height / 2 - 0.5) * 8,",
  "  };",
  "}",
  "",
);

fs.writeFileSync(outPath, lines.join("\n"));
