#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const tilesPath = args.get("--tiles");
const tilemapPath = args.get("--tilemap");
const outPath = args.get("--out") ?? "public/maps/kanto-map-frlg.svg";
const sourceLabel = args.get("--source-label") ?? path.basename(tilemapPath ?? "tilemap.bin");

if (!tilesPath || !tilemapPath) {
  console.error(
    "Usage: node scripts/generate-gen3-frlg-region-map.mjs --tiles /path/to/region_map.png --tilemap /path/to/kanto.bin [--out public/maps/kanto-map-frlg.svg] [--source-label kanto.bin]",
  );
  process.exit(1);
}

const width = 240;
const height = 160;
const tileSize = 8;
const tilesetWidth = 128;
const tilesetHeight = 160;
const tilesPerRow = tilesetWidth / tileSize;
const mapTilesWide = width / tileSize;
const mapTilesHigh = height / tileSize;
const expectedEntries = mapTilesWide * mapTilesHigh;
const transparentEntries = new Set([
  0x2000, // Empty GBA background tile outside the visible region-map panel.
  0x200e, // White side-mask tile from the original in-game region-map frame.
]);

const tilemap = fs.readFileSync(tilemapPath);
if (tilemap.length !== expectedEntries * 2) {
  throw new Error(`Expected ${expectedEntries * 2} tilemap bytes, got ${tilemap.length}`);
}

const tilesDataUri = `data:image/png;base64,${fs.readFileSync(tilesPath).toString("base64")}`;
const lines = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<!-- Generated from pret/pokefirered graphics/region_map/region_map.png and graphics/region_map/${sourceLabel}. -->`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
  `  <defs>`,
  `    <image id="tiles" href="${tilesDataUri}" width="${tilesetWidth}" height="${tilesetHeight}"/>`,
];

const tileCount = (tilesetWidth / tileSize) * (tilesetHeight / tileSize);
for (let tile = 0; tile < tileCount; tile += 1) {
  const sx = (tile % tilesPerRow) * tileSize;
  const sy = Math.floor(tile / tilesPerRow) * tileSize;
  lines.push(`    <symbol id="t${tile}" viewBox="${sx} ${sy} ${tileSize} ${tileSize}"><use href="#tiles"/></symbol>`);
}

lines.push(`  </defs>`);

for (let index = 0; index < expectedEntries; index += 1) {
  const entry = tilemap.readUInt16LE(index * 2);
  if (transparentEntries.has(entry)) continue;

  const tile = entry & 0x03ff;
  const hflip = (entry & 0x0400) !== 0;
  const vflip = (entry & 0x0800) !== 0;
  const x = (index % mapTilesWide) * tileSize;
  const y = Math.floor(index / mapTilesWide) * tileSize;

  if (tile >= tileCount) {
    throw new Error(`Tile index ${tile} at map entry ${index} exceeds tileset tile count ${tileCount}`);
  }

  if (hflip || vflip) {
    const tx = x + (hflip ? tileSize : 0);
    const ty = y + (vflip ? tileSize : 0);
    const sx = hflip ? -1 : 1;
    const sy = vflip ? -1 : 1;
    lines.push(
      `  <use href="#t${tile}" width="${tileSize}" height="${tileSize}" transform="translate(${tx} ${ty}) scale(${sx} ${sy})"/>`,
    );
  } else {
    lines.push(`  <use href="#t${tile}" x="${x}" y="${y}" width="${tileSize}" height="${tileSize}"/>`);
  }
}

lines.push(`</svg>`, "");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n"));
