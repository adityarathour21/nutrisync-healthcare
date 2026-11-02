import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Minimal pure-Node PNG encoder for solid/geometric NutriSync PWA icons (180, 192, 512, maskable 512)
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, combined, crcBuf]);
}

function generateIconPng(size, maskable = false) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size / 2;
  const safeScale = maskable ? 0.72 : 0.86;
  const heartRadius = (size * 0.32) * safeScale;
  const crossArm = (size * 0.14) * safeScale;
  const crossThickness = Math.max(4, (size * 0.045) * safeScale);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;
      // Background emerald #059669 (5, 150, 105)
      let r = 5, g = 150, b = 105, a = 255;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Clean white circle emblem inside safe zone
      if (dist <= heartRadius) {
        r = 236; g = 253; b = 245; // #ECFDF5
        // Clinical nutrition emerald cross inside circle
        if (
          (Math.abs(dx) <= crossThickness && Math.abs(dy) <= crossArm) ||
          (Math.abs(dy) <= crossThickness && Math.abs(dx) <= crossArm)
        ) {
          r = 5; g = 150; b = 105;
        }
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const pubDir = path.resolve('public');
fs.mkdirSync(pubDir, { recursive: true });
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), generateIconPng(180, false));
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), generateIconPng(192, false));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), generateIconPng(512, false));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), generateIconPng(512, true));
console.log('Generated NutriSync PWA PNG icons successfully.');
