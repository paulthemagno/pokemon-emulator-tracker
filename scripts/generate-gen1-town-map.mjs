import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();

// Source: pret/pokered
// - gfx/town_map/town_map.png
// - gfx/town_map/town_map.rle
// The game expands the RLE stream to a 20x18 tilemap in engine/items/town_map.asm.
const TILESET_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgAAAAAcoT2JAAAAx0lEQVR42kXOMQrCMBgF4H/xMi7uCnZ3EuRVcNC9gwdwVDyCB3AQNLHN5BJKCr2AU48gSOrmIqXwm8aq+ZcP3nsQYp5sgXGHPhjtPYh6Lw/mFkK0+EW/sp9XighgpswEtUfJ/bOHsIOHh/yjjYxuy8l3vlJVDPdoYbLLDghpymVxAxYEK3ACIkJ0ggQsYXaALKYO4Q7mMtfUTJN4qdzHKtWcQ2Yykw6pDkou+R7Q83rsrnNhPTa5tC6SVtpj15WNNjrtOySquTfnvp0AINc0twAAAABJRU5ErkJggg==";
const TILEMAP_RLE_BASE64 =
  "f3Vsc4FEbHFkgUJiUWRxwXNRdGJBYnFhUXNkcWPBYbFBYsFhwWdxY3GxQmJxYXFhc1FyUXNRQ2JxYXFhcWVxY3FDYnFhcWFxsaFjcWNxQ2JyUWFxQ6FhcWNxQ2GxoWFxYXFhQ2FRdJFCsUJhcWFxsUOhZHGxQkNhUbHxRWF0Q0OhcUHxQpFjcWJERPFB0eFyUXNhsURDkXGBQqFhcbFIQ2FRceHB4tFJT0UA";

function readUInt32(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function parsePng(buffer) {
  const signature = buffer.subarray(0, 8);
  if (signature.toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Invalid PNG signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = [];
  const idat = [];

  while (offset < buffer.length) {
    const length = readUInt32(buffer, offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = readUInt32(data, 0);
      height = readUInt32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "PLTE") {
      palette = [];
      for (let i = 0; i < data.length; i += 3) {
        palette.push([data[i], data[i + 1], data[i + 2], 255]);
      }
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!((colorType === 3 || colorType === 0) && bitDepth === 2)) {
    throw new Error(`Unsupported source PNG format: colorType=${colorType} bitDepth=${bitDepth}`);
  }

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * 4);
  let input = 0;
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const previous = new Uint8Array(rowBytes);

  for (let y = 0; y < height; y++) {
    const filter = inflated[input++];
    if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
    const row = inflated.subarray(input, input + rowBytes);
    input += rowBytes;
    previous.set(row);

    for (let x = 0; x < width; x++) {
      const byte = row[Math.floor(x / 4)];
      const shift = 6 - ((x % 4) * 2);
      const index = (byte >> shift) & 0x03;
      const shade = Math.round((index / 3) * 255);
      const color = colorType === 3 ? (palette[index] ?? [0, 0, 0, 255]) : [shade, shade, shade, 255];
      const out = (y * width + x) * 4;
      pixels[out] = color[0];
      pixels[out + 1] = color[1];
      pixels[out + 2] = color[2];
      pixels[out + 3] = color[3];
    }
  }

  return { width, height, pixels };
}

function expandRle(buffer) {
  const tiles = [];
  for (const byte of buffer) {
    if (byte === 0) break;
    const tile = byte >> 4;
    const count = byte & 0x0f;
    for (let i = 0; i < count; i++) tiles.push(tile);
  }
  if (tiles.length !== 20 * 18) {
    throw new Error(`Unexpected Gen 1 town map tile count ${tiles.length}`);
  }
  return tiles;
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  chunk.writeUInt32BE(crc, 8 + data.length);
  return chunk;
}

function writeRgbaPng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const tileset = parsePng(Buffer.from(TILESET_PNG_BASE64, "base64"));
const tilemap = expandRle(Buffer.from(TILEMAP_RLE_BASE64, "base64"));
const outputWidth = 160;
const outputHeight = 144;
const output = new Uint8Array(outputWidth * outputHeight * 4);

for (let tileY = 0; tileY < 18; tileY++) {
  for (let tileX = 0; tileX < 20; tileX++) {
    const tile = tilemap[tileY * 20 + tileX];
    const sourceX = (tile % 4) * 8;
    const sourceY = Math.floor(tile / 4) * 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const source = ((sourceY + y) * tileset.width + sourceX + x) * 4;
        const target = ((tileY * 8 + y) * outputWidth + tileX * 8 + x) * 4;
        output[target] = tileset.pixels[source];
        output[target + 1] = tileset.pixels[source + 1];
        output[target + 2] = tileset.pixels[source + 2];
        output[target + 3] = tileset.pixels[source + 3];
      }
    }
  }
}

const destination = path.join(root, "public/maps/kanto-town-map-rby.png");
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, writeRgbaPng(outputWidth, outputHeight, output));
console.log(`Generated ${destination}`);
