/**
 * App icons, drawn in code so they can be regenerated rather than kept as
 * binaries nobody can edit. The mark is the home screen in miniature: one sun
 * over a horizon, with a lit dot for each city.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../public/icons/', import.meta.url).pathname;

const INK = [0x24, 0x1f, 0x1b];
const APRICOT = [0xe8, 0xa8, 0x7c];
const LIT = [0xff, 0xe9, 0xa8];
const HORIZON = [0xf6, 0xe0, 0xbe];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Draw the mark into an RGBA buffer. `inset` leaves room for a maskable crop. */
function draw(size, inset) {
  const px = Buffer.alloc(size * size * 4);
  const unit = size * (1 - 2 * inset);
  const ox = size * inset;
  const oy = size * inset;

  const blend = (x, y, color, alpha) => {
    if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
    const i = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * (1 - alpha) + color[c] * alpha);
    px[i + 3] = 255;
  };

  for (let i = 0; i < size * size; i++) {
    px[i * 4] = INK[0];
    px[i * 4 + 1] = INK[1];
    px[i * 4 + 2] = INK[2];
    px[i * 4 + 3] = 255;
  }

  const disc = (cx, cy, r, color, glow = 0) => {
    const from = Math.floor(cy - r - glow);
    const to = Math.ceil(cy + r + glow);
    for (let y = from; y <= to; y++) {
      for (let x = Math.floor(cx - r - glow); x <= Math.ceil(cx + r + glow); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r - 0.5) blend(x, y, color, 1);
        else if (d <= r + 0.5) blend(x, y, color, r + 0.5 - d);
        else if (glow > 0 && d <= r + glow) blend(x, y, color, 0.45 * (1 - (d - r) / glow) ** 2);
      }
    }
  };

  const horizonY = oy + unit * 0.62;
  const thickness = Math.max(1, unit * 0.012);
  for (let y = Math.round(horizonY - thickness / 2); y < Math.round(horizonY + thickness / 2); y++) {
    for (let x = Math.round(ox + unit * 0.08); x < Math.round(ox + unit * 0.92); x++) blend(x, y, HORIZON, 0.5);
  }

  disc(ox + unit * 0.5, oy + unit * 0.42, unit * 0.17, APRICOT, unit * 0.1);
  disc(ox + unit * 0.28, horizonY, unit * 0.035, LIT, unit * 0.03);
  disc(ox + unit * 0.72, horizonY, unit * 0.035, LIT, unit * 0.03);

  return px;
}

await mkdir(OUT, { recursive: true });
for (const [name, size, inset] of [
  ['icon-192.png', 192, 0.06],
  ['icon-512.png', 512, 0.06],
  ['maskable-512.png', 512, 0.18],
]) {
  await writeFile(OUT + name, png(size, draw(size, inset)));
  console.log(name);
}
