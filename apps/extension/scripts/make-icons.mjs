/**
 * Produces the three PNG sizes Chrome asks for, into apps/extension/icons/.
 *
 *   node scripts/make-icons.mjs [source.png]
 *
 * With a source image (square, ideally >=128px) it downscales that with `sips`,
 * which ships with macOS. With no argument it draws a plain placeholder so the
 * extension has *an* icon rather than Chrome's generic puzzle piece.
 *
 * The placeholder is deliberately unbranded: pass the real logo as soon as
 * there is one.
 */
import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIZES = [128, 48, 16];
const root = fileURLToPath(new URL('..', import.meta.url));
const iconsDir = `${root}icons`;

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Minimal RGBA PNG encoder - avoids pulling in an image dependency. */
function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function placeholder(size) {
  const r = size / 2;
  const radius = size * 0.22; // rounded-square corner radius
  return encodePng(size, (x, y) => {
    // Rounded square mask.
    const dx = Math.max(radius - x, 0, x - (size - radius));
    const dy = Math.max(radius - y, 0, y - (size - radius));
    if (Math.hypot(dx, dy) > radius) return [0, 0, 0, 0];
    // A lighter dot, offset like a gauge needle's pivot.
    const inDot = Math.hypot(x - r, y - r * 1.12) < size * 0.17;
    return inDot ? [122, 199, 148, 255] : [26, 42, 35, 255];
  });
}

mkdirSync(iconsDir, { recursive: true });
const source = process.argv[2];

if (source) {
  if (!existsSync(source)) {
    console.error(`Source image not found: ${source}`);
    process.exit(1);
  }
  for (const size of SIZES) {
    const out = `${iconsDir}/icon${size}.png`;
    execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', out], {
      stdio: 'ignore',
    });
  }
  console.log(`Wrote icon${SIZES.join('/')}.png from ${source}`);
} else {
  for (const size of SIZES) {
    writeFileSync(`${iconsDir}/icon${size}.png`, placeholder(size));
  }
  console.log(`Wrote placeholder icon${SIZES.join('/')}.png - pass a source image to replace them`);
}
