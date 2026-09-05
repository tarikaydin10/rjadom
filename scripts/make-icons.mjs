/**
 * App icons, drawn in code so they can be regenerated rather than kept as
 * binaries nobody can edit.
 *
 *   node scripts/make-icons.mjs
 *
 * The mark is "Überschneidung": two circles, one for each of us, drawn on the
 * app's own dusk. Neither circle is brighter than the other, and the only part
 * that is fully lit is the space they share — which is the whole idea of the
 * app at the size of a fingernail.
 *
 * It reads at every size by design. At 512 the two rims and the soft fills are
 * all there. At 40 on a home screen the rims fall away and what is left is a
 * warm dark square with one bright almond in the middle of it, which is enough
 * to find with a thumb.
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// `URL.pathname` keeps a leading slash before the drive letter, which is not a
// path on Windows — `/C:/…` becomes `C:\C:\…` the moment it is joined.
const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

/** Dusk, rising out of the bottom edge: apricot, plum, then night. */
const DUSK = [
  [0.0, [0xb7, 0x6a, 0x55]],
  [0.4, [0x6b, 0x40, 0x59]],
  [1.0, [0x22, 0x1e, 0x35]],
];
const HALO = [0xff, 0xe6, 0xb0];
const SHARED = [0xff, 0xf3, 0xd4];

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

/** The wash, an ellipse of warmth centred below the bottom edge's midpoint. */
function background(nx, ny) {
  const t = Math.min(1, Math.hypot((nx - 0.5) / 1.3, (ny - 1) / 0.9));
  let i = 1;
  while (i < DUSK.length - 1 && t > DUSK[i][0]) i++;
  const [t0, a] = DUSK[i - 1];
  const [t1, b] = DUSK[i];
  const k = (t - t0) / (t1 - t0);
  return [0, 1, 2].map((c) => a[c] + (b[c] - a[c]) * k);
}

/**
 * Draw the mark into an RGBA buffer. `inset` leaves room for a maskable crop —
 * only the circles pull in; the wash always runs to the edges.
 */
function draw(size, inset) {
  const px = Buffer.alloc(size * size * 4);
  const unit = size * (1 - 2 * inset);
  const ox = size * inset;
  const oy = size * inset;

  // Two circles of r = 0.24, set 0.12 either side of centre, so each one's rim
  // passes close to the other's centre and the shared almond is a third as wide
  // as the pair.
  const r = unit * 0.24;
  const cy = oy + unit * 0.5;
  const cxA = ox + unit * 0.38;
  const cxB = ox + unit * 0.62;
  const stroke = Math.max(1, unit * 0.024);

  const over = (dst, src, alpha) => {
    for (let c = 0; c < 3; c++) dst[c] = dst[c] * (1 - alpha) + src[c] * alpha;
  };

  // Supersampled rather than coverage-stamped: the fills, the overlap and the
  // rims all have to composite in that order, and doing it per subsample keeps
  // the edges clean without tracking three alphas per pixel.
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const sxp = x + (sx + 0.5) / SS;
          const syp = y + (sy + 0.5) / SS;
          const color = background(sxp / size, syp / size);
          const dA = Math.hypot(sxp - cxA, syp - cy);
          const dB = Math.hypot(sxp - cxB, syp - cy);
          if (dA <= r) over(color, HALO, 0.28);
          if (dB <= r) over(color, HALO, 0.28);
          if (dA <= r && dB <= r) over(color, SHARED, 1);
          if (Math.abs(dA - r) <= stroke / 2 || Math.abs(dB - r) <= stroke / 2) over(color, HALO, 0.7);
          for (let c = 0; c < 3; c++) acc[c] += color[c];
        }
      }
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(acc[c] / (SS * SS));
      px[i + 3] = 255;
    }
  }

  return px;
}

/** The same mark as vector, for browser tabs that would rather scale it themselves. */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="dusk" cx="50" cy="100" r="65" gradientTransform="translate(0 30.8) scale(1 0.692)" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#b76a55"/>
      <stop offset=".4" stop-color="#6b4059"/>
      <stop offset="1" stop-color="#221e35"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" rx="23" fill="url(#dusk)"/>
  <circle cx="38" cy="50" r="24" fill="#ffe6b0" opacity=".28"/>
  <circle cx="62" cy="50" r="24" fill="#ffe6b0" opacity=".28"/>
  <path d="M50 27.2 A24 24 0 0 1 50 72.8 A24 24 0 0 1 50 27.2 Z" fill="#fff3d4"/>
  <circle cx="38" cy="50" r="24" fill="none" stroke="#ffe6b0" stroke-width="2.4" opacity=".7"/>
  <circle cx="62" cy="50" r="24" fill="none" stroke="#ffe6b0" stroke-width="2.4" opacity=".7"/>
</svg>
`;

await mkdir(OUT, { recursive: true });
for (const [name, size, inset] of [
  ['favicon-32.png', 32, 0.04],
  ['apple-touch-icon-180.png', 180, 0.05],
  ['icon-192.png', 192, 0.05],
  ['icon-512.png', 512, 0.05],
  ['maskable-512.png', 512, 0.17],
]) {
  await writeFile(OUT + name, png(size, draw(size, inset)));
  console.log(name);
}
await writeFile(PUBLIC + 'favicon.svg', favicon);
console.log('favicon.svg');
