/**
 * Generates a minimal 32x32 icon.ico for Tauri build.
 * Run from repo root: node scripts/generate-icon.js
 */
const fs = require("fs");
const path = require("path");

const iconsDir = path.join(__dirname, "..", "src-tauri", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

// Minimal valid 32x32 32bpp ICO: header + directory + BMP (40-byte DIB header + 32*32*4 pixels)
const w = 32;
const h = 32;
const dibHeaderSize = 40;
const pixelDataSize = w * h * 4;
const imageSize = dibHeaderSize + pixelDataSize;
const offset = 6 + 16;

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

const dir = Buffer.alloc(16);
dir[0] = w;
dir[1] = h;
dir[2] = 0;
dir[3] = 0;
dir.writeUInt16LE(1, 4);
dir.writeUInt16LE(32, 6);
dir.writeUInt32LE(imageSize, 8);
dir.writeUInt32LE(offset, 12);

const dib = Buffer.alloc(dibHeaderSize);
dib.writeUInt32LE(40, 0);
dib.writeInt32LE(w, 4);
dib.writeInt32LE(h * 2, 8); // ICO uses 2*height for image+mask
dib.writeUInt16LE(1, 12);
dib.writeUInt16LE(32, 14);

const pixels = Buffer.alloc(pixelDataSize);
// Fill with a simple purple/blue (Meeps brand-ish): BGRA
const b = 0x6b,
  g = 0x5b,
  r = 0xfb,
  a = 255;
for (let i = 0; i < w * h; i++) {
  pixels[i * 4] = b;
  pixels[i * 4 + 1] = g;
  pixels[i * 4 + 2] = r;
  pixels[i * 4 + 3] = a;
}
// BMP in ICO is stored bottom-up; our pixels are top-down, so reverse rows
const rowSize = w * 4;
for (let row = 0; row < h / 2; row++) {
  const top = pixels.subarray(row * rowSize, (row + 1) * rowSize);
  const bottom = pixels.subarray((h - 1 - row) * rowSize, (h - row) * rowSize);
  top.copy(pixels, (h - 1 - row) * rowSize);
  bottom.copy(pixels, row * rowSize);
}

// AND mask (1 bit per pixel, 32 rows): 32 * 4 = 128 bytes per row, total 32*128
const andMask = Buffer.alloc((w * h) / 8);
andMask.fill(0);

const ico = Buffer.concat([header, dir, dib, pixels, andMask]);
fs.writeFileSync(path.join(iconsDir, "icon.ico"), ico);

// Minimal 32x32 PNG for icon.png (PNG signature + IHDR + IDAT + IEND)
// Use a tiny valid PNG (1x1 would work but 32x32 is better for scaling)
const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data ? data.length : 0, 0);
  const chunk = Buffer.concat([
    len,
    Buffer.from(type),
    data || Buffer.alloc(0),
  ]);
  let crc = 0xffffffff;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  for (let i = 0; i < chunk.length - 4; i++) {
    crc = crcTable[(crc ^ chunk[i + 4]) & 0xff] ^ (crc >>> 8);
  }
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([chunk, crcBuf]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const rowLen = 1 + w * 3; // filter byte + RGB per row
const raw = Buffer.alloc(rowLen * h);
for (let y = 0; y < h; y++) {
  raw[y * rowLen] = 0; // filter type None
  for (let x = 0; x < w; x++) {
    const i = y * rowLen + 1 + x * 3;
    raw[i] = r;
    raw[i + 1] = g;
    raw[i + 2] = b;
  }
}
const zlib = require("zlib");
const idatData = makeChunk("IDAT", zlib.deflateSync(raw, { level: 9 }));
const png = Buffer.concat([
  pngSignature,
  makeChunk("IHDR", ihdr),
  idatData,
  makeChunk("IEND", null),
]);
fs.writeFileSync(path.join(iconsDir, "icon.png"), png);

console.log("Created src-tauri/icons/icon.ico and icon.png");
console.log("For macOS .icns run: npx tauri icon src-tauri/icons/icon.png");
