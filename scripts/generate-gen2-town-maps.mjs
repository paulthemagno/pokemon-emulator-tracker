#!/usr/bin/env node
import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";

const MAP_WIDTH_TILES = 20;
const MAP_HEIGHT_TILES = 18;
const TILE_SIZE = 8;
const MAP_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
const MAP_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;

const PALETTE_NAMES = ["BORDER", "EARTH", "MOUNTAIN", "CITY", "POI", "POI_MTN"];
const PALETTE_NAME_TO_INDEX = Object.fromEntries(PALETTE_NAMES.map((name, index) => [name, index]));

const pokecrystalRoot = path.resolve(process.argv[2] ?? process.env.POKECRYSTAL_ROOT ?? "/private/tmp/pokecrystal");
const outputDir = path.resolve(process.cwd(), "public/maps");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const scanlineLength = width * 4 + 1;
  const raw = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * scanlineLength;
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND"),
  ]);
}

function parseGrayscalePng(buffer) {
  const signature = buffer.subarray(0, 8);
  if (signature.toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Unsupported PNG signature");
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];
  let offset = 8;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 2 || colorType !== 0 || interlace !== 0) {
        throw new Error(`Unsupported source PNG format: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
      }
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const bytesPerRow = Math.ceil((width * bitDepth) / 8);
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const rows = Buffer.alloc(bytesPerRow * height);
  let previous = Buffer.alloc(bytesPerRow);

  for (let y = 0; y < height; y += 1) {
    const inputStart = y * (bytesPerRow + 1);
    const filter = inflated[inputStart];
    const row = Buffer.from(inflated.subarray(inputStart + 1, inputStart + 1 + bytesPerRow));

    for (let x = 0; x < bytesPerRow; x += 1) {
      const left = x > 0 ? row[x - 1] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x > 0 ? previous[x - 1] : 0;

      if (filter === 1) row[x] = (row[x] + left) & 0xff;
      else if (filter === 2) row[x] = (row[x] + up) & 0xff;
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        row[x] = (row[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}`);
      }
    }

    row.copy(rows, y * bytesPerRow);
    previous = row;
  }

  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const packed = rows[y * bytesPerRow + Math.floor(x / 4)];
      const shift = 6 - (x % 4) * 2;
      pixels[y * width + x] = (packed >> shift) & 0x03;
    }
  }

  return { width, height, pixels };
}

function parseTownMapPalettes(text) {
  const paletteEntries = [];
  for (const line of text.split("\n")) {
    const match = line.match(/townmappals\s+(.+)/);
    if (!match) continue;

    const names = match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    for (const name of names) {
      const palette = PALETTE_NAME_TO_INDEX[name];
      if (palette === undefined) throw new Error(`Unknown palette ${name}`);
      paletteEntries.push(palette);
    }
  }
  return paletteEntries;
}

function parseRgbPalettes(text) {
  const colors = [...text.matchAll(/RGB\s+(\d+),\s*(\d+),\s*(\d+)/g)].map((match) =>
    match.slice(1).map((value) => Math.round((Number(value) * 255) / 31)),
  );

  const palettes = [];
  for (let i = 0; i < colors.length; i += 4) palettes.push(colors.slice(i, i + 4));
  if (palettes.length < PALETTE_NAMES.length) throw new Error("Not enough palettes in pokegear.pal");
  return palettes.slice(0, PALETTE_NAMES.length);
}

function drawTile(output, source, tileId, paletteId, palettes, destinationTileX, destinationTileY) {
  const sourceTilesPerRow = source.width / TILE_SIZE;
  const sourceTileX = tileId % sourceTilesPerRow;
  const sourceTileY = Math.floor(tileId / sourceTilesPerRow);
  const palette = palettes[paletteId] ?? palettes[0];

  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const sourceX = sourceTileX * TILE_SIZE + x;
      const sourceY = sourceTileY * TILE_SIZE + y;
      const sourceShade = source.pixels[sourceY * source.width + sourceX];
      const color = palette[3 - sourceShade];
      const destinationX = destinationTileX * TILE_SIZE + x;
      const destinationY = destinationTileY * TILE_SIZE + y;
      const outIndex = (destinationY * MAP_WIDTH + destinationX) * 4;
      output[outIndex] = color[0];
      output[outIndex + 1] = color[1];
      output[outIndex + 2] = color[2];
      output[outIndex + 3] = 255;
    }
  }
}

async function renderMap(region, sourceTiles, paletteMap, palettes) {
  const tilemapPath = path.join(pokecrystalRoot, "gfx/pokegear", `${region}.bin`);
  const tilemap = await fs.readFile(tilemapPath);
  if (tilemap.length !== MAP_WIDTH_TILES * MAP_HEIGHT_TILES + 1 || tilemap.at(-1) !== 0xff) {
    throw new Error(`${tilemapPath} is not the expected 20x18 town-map tilemap`);
  }

  const output = Buffer.alloc(MAP_WIDTH * MAP_HEIGHT * 4);
  for (let index = 0; index < MAP_WIDTH_TILES * MAP_HEIGHT_TILES; index += 1) {
    const tileId = tilemap[index];
    const paletteId = tileId < 0x60 ? paletteMap[tileId] ?? 0 : 0;
    drawTile(output, sourceTiles, tileId, paletteId, palettes, index % MAP_WIDTH_TILES, Math.floor(index / MAP_WIDTH_TILES));
  }

  const png = encodePng(MAP_WIDTH, MAP_HEIGHT, output);
  const outputPath = path.join(outputDir, `${region}-town-map-gsc.png`);
  await fs.writeFile(outputPath, png);
  console.log(`${outputPath} ${createHash("sha256").update(png).digest("hex").slice(0, 12)}`);
}

await fs.mkdir(outputDir, { recursive: true });

const sourceTiles = parseGrayscalePng(await fs.readFile(path.join(pokecrystalRoot, "gfx/pokegear/town_map.png")));
const paletteMap = parseTownMapPalettes(await fs.readFile(path.join(pokecrystalRoot, "gfx/pokegear/town_map_palette_map.asm"), "utf8"));
const palettes = parseRgbPalettes(await fs.readFile(path.join(pokecrystalRoot, "gfx/pokegear/pokegear.pal"), "utf8"));

if (sourceTiles.width !== 128 || sourceTiles.height !== 24) {
  throw new Error(`Unexpected town_map.png dimensions: ${sourceTiles.width}x${sourceTiles.height}`);
}

await renderMap("johto", sourceTiles, paletteMap, palettes);
await renderMap("kanto", sourceTiles, paletteMap, palettes);
