import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/chroma-key-png.mjs <input.png> <output.png>");
}

const source = readFileSync(inputPath);
const signature = source.subarray(0, 8);
const expectedSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

if (!signature.equals(expectedSignature)) {
  throw new Error("Input is not a PNG file");
}

let offset = 8;
let width = 0;
let height = 0;
let colorType = 0;
const idatChunks = [];

while (offset < source.length) {
  const length = source.readUInt32BE(offset);
  const type = source.subarray(offset + 4, offset + 8).toString("ascii");
  const data = source.subarray(offset + 8, offset + 8 + length);
  offset += 12 + length;

  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    const bitDepth = data[8];
    colorType = data[9];
    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
      throw new Error("Only 8-bit RGB/RGBA PNGs are supported");
    }
  } else if (type === "IDAT") {
    idatChunks.push(data);
  } else if (type === "IEND") {
    break;
  }
}

const channels = colorType === 6 ? 4 : 3;
const bytesPerPixel = channels;
const stride = width * channels;
const inflated = inflateSync(Buffer.concat(idatChunks));
const pixels = Buffer.alloc(width * height * channels);
let srcOffset = 0;
let dstOffset = 0;
let previous = Buffer.alloc(stride);

for (let y = 0; y < height; y += 1) {
  const filter = inflated[srcOffset];
  srcOffset += 1;
  const row = Buffer.from(inflated.subarray(srcOffset, srcOffset + stride));
  srcOffset += stride;

  for (let x = 0; x < stride; x += 1) {
    const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
    const up = previous[x] ?? 0;
    const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;

    if (filter === 1) {
      row[x] = (row[x] + left) & 255;
    } else if (filter === 2) {
      row[x] = (row[x] + up) & 255;
    } else if (filter === 3) {
      row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
    } else if (filter === 4) {
      const p = left + up - upLeft;
      const pa = Math.abs(p - left);
      const pb = Math.abs(p - up);
      const pc = Math.abs(p - upLeft);
      const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      row[x] = (row[x] + predictor) & 255;
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG filter: ${filter}`);
    }
  }

  row.copy(pixels, dstOffset);
  previous = row;
  dstOffset += stride;
}

const rgba = Buffer.alloc(width * height * 4);
const keySamples = [
  [0, 0],
  [width - 1, 0],
  [0, height - 1],
  [width - 1, height - 1],
];
const key = keySamples.reduce(
  (sum, [x, y]) => {
    const index = (y * width + x) * channels;
    sum[0] += pixels[index];
    sum[1] += pixels[index + 1];
    sum[2] += pixels[index + 2];
    return sum;
  },
  [0, 0, 0],
).map((value) => value / keySamples.length);

for (let i = 0, j = 0; i < pixels.length; i += channels, j += 4) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];
  const existingAlpha = channels === 4 ? pixels[i + 3] : 255;
  const keyDistance = Math.hypot(r - key[0], g - key[1], b - key[2]);
  const greenDominant = g > r * 1.25 && g > b * 1.25;
  const keyed = keyDistance < 120 && greenDominant;
  const edgeAlpha = Math.max(0, Math.min(255, Math.round((keyDistance - 46) * 3.8)));
  const alpha = keyed ? Math.min(existingAlpha, edgeAlpha) : existingAlpha;

  rgba[j] = r;
  rgba[j + 1] = keyed ? Math.round(g * 0.25) : g;
  rgba[j + 2] = b;
  rgba[j + 3] = alpha;
}

const rawRows = Buffer.alloc(height * (1 + width * 4));
for (let y = 0; y < height; y += 1) {
  rawRows[y * (1 + width * 4)] = 0;
  rgba.copy(rawRows, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return result;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

writeFileSync(
  outputPath,
  Buffer.concat([
    expectedSignature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rawRows)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
