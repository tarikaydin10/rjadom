/**
 * App icons, drawn in code so they can be regenerated rather than kept as
 * binaries nobody can edit.
 *
 *   node scripts/make-icons.mjs
 *
 * The mark is the app's one idea, at the size of a fingernail: two lit places
 * on one horizon, and the track the sun takes between them. Nothing here is
 * invented — the sky is the dusk column out of `SKY_STOPS` in `sky/engine.ts`,
 * the arc is the sun's own path across the band, and the two points are where
 * Hamburg and Kaliningrad stand on the ground. Open the app and you are looking
 * at the icon, larger.
 *
 * It reads at every size by design. At 512 there is a whole evening in it —
 * gradient, stars, the glow under the horizon. At 40 on a home screen the
 * detail falls away and what is left is a dark warm square with one bright
 * point in it, which is enough to find with a thumb.
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// `URL.pathname` keeps a leading slash before the drive letter, which is not a
// path on Windows — `/C:/…` becomes `C:\C:\…` the moment it is joined.
const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url));

/** Dusk, top of the sky down to the horizon. Straight out of the engine's table. */
const SKY = [
  [0.0, [0x0d, 0x0c, 0x1a]],
  [0.28, [0x1f, 0x1d, 0x36]],
  [0.5, [0x39, 0x33, 0x50]],
  [0.68, [0x6a, 0x50, 0x60]],
  [0.83, [0xb9, 0x74, 0x5f]],
  [0.94, [0xe8, 0xa2, 0x6e]],
  [1.0, [0xf6, 0xc7, 0x9a]],
];

/** Ground: the app's earth, going to its ink at the bottom edge. */
const GROUND = [
  [0.0, [0x60, 0x45, 0x33]],
  [0.45, [0x35, 0x28, 0x20]],
  [1.0, [0x1c, 0x18, 0x15]],
];

const LIT = [0xff, 0xe9, 0xa8];
const APRICOT = [0xff, 0xc9, 0x78];
const HORIZON = [0xf6, 0xe0, 0xbe];
const STAR = [0xff, 0xf6, 0xe6];

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

/** A colour off a ramp of `[position, rgb]` stops. */
function ramp(stops, t) {
  const x = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1][0]) i++;
  const [p0, c0] = stops[i];
  const [p1, c1] = stops[i + 1];
  const span = p1 - p0;
  const k = span === 0 ? 0 : (x - p0) / span;
  return [0, 1, 2].map((c) => Math.round(c0[c] + (c1[c] - c0[c]) * k));
}

/**
 * Where the sun stands on its track, as a fraction along the arc.
 *
 * Past the apex and heading down the left, because that is the direction the
 * band draws: the sun comes up over Kaliningrad on the right and sets over
 * Hamburg on the left. An icon showing the light travelling the other way would
 * be a picture of a different pair of cities.
 */
const SUN_AT = 0.66;

/** Scattered once, by hand, so the same stars land in every size. */
const STARS = [
  [0.16, 0.13, 0.9],
  [0.31, 0.08, 0.55],
  [0.78, 0.11, 0.85],
  [0.88, 0.22, 0.5],
  [0.09, 0.3, 0.45],
  [0.63, 0.05, 0.4],
  [0.45, 0.16, 0.35],
];

/** Draw the mark into an RGBA buffer. `inset` leaves room for a maskable crop. */
function draw(size, inset) {
  const px = Buffer.alloc(size * size * 4);
  const unit = size * (1 - 2 * inset);
  const ox = size * inset;
  const oy = size * inset;
  const horizonY = oy + unit * 0.68;

  const blend = (x, y, color, alpha) => {
    if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
    const i = (y * size + x) * 4;
    const a = Math.min(1, alpha);
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * (1 - a) + color[c] * a);
    px[i + 3] = 255;
  };

  // The sky and the ground fill the whole square, not just the inset box: a
  // maskable icon is cropped by the platform to a shape nobody can predict, and
  // a mark that stops short of the corners becomes a sticker on a background.
  // Only the drawn things — horizon, arc, sun, cities — respect the inset.
  for (let y = 0; y < size; y++) {
    const above = y < horizonY;
    const t = above ? y / Math.max(1, horizonY) : (y - horizonY) / Math.max(1, size - horizonY);
    const color = ramp(above ? SKY : GROUND, t);
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = 255;
    }
  }

  const disc = (cx, cy, r, color, glow = 0, glowStrength = 0.5) => {
    for (let y = Math.floor(cy - r - glow); y <= Math.ceil(cy + r + glow); y++) {
      for (let x = Math.floor(cx - r - glow); x <= Math.ceil(cx + r + glow); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r - 0.5) blend(x, y, color, 1);
        else if (d <= r + 0.5) blend(x, y, color, r + 0.5 - d);
        else if (glow > 0 && d <= r + glow) blend(x, y, color, glowStrength * (1 - (d - r) / glow) ** 2.2);
      }
    }
  };

  for (const [sx, sy, weight] of STARS) {
    disc(ox + unit * sx, oy + unit * sy, unit * 0.006 * weight, STAR, unit * 0.012, 0.35 * weight);
  }

  // The two cities, and the track between them. The arc is a half ellipse from
  // one to the other — the same shape the band draws, which is why the sun can
  // sit on it rather than beside it.
  const footX = unit * 0.3;
  const cx = ox + unit * 0.5;
  const rx = footX;
  const ry = unit * 0.33;

  const point = (t) => {
    const angle = Math.PI * (1 - t);
    return [cx + rx * Math.cos(angle), horizonY - ry * Math.sin(angle)];
  };

  // Sampled and measured by distance rather than stamped dot by dot: overlapping
  // stamps pile their alpha up at every sample and the line comes out beaded.
  const samples = Array.from({ length: 240 }, (_, i) => point(i / 239));
  const half = Math.max(0.6, unit * 0.0055);
  const feather = Math.max(0.75, unit * 0.004);
  for (let y = Math.floor(horizonY - ry - 2); y <= Math.ceil(horizonY + 1); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      let best = Infinity;
      for (const [px2, py2] of samples) {
        const d = Math.hypot(x + 0.5 - px2, y + 0.5 - py2);
        if (d < best) best = d;
      }
      const alpha = best <= half ? 1 : best >= half + feather ? 0 : 1 - (best - half) / feather;
      if (alpha > 0) blend(x, y, HORIZON, alpha * 0.34);
    }
  }

  // The horizon: brightest where the sky is warmest and dissolving at both ends,
  // so it reads as a line of light rather than as a rule drawn across a picture.
  const thickness = Math.max(1, unit * 0.011);
  for (let y = Math.round(horizonY - thickness / 2); y < Math.round(horizonY + thickness / 2); y++) {
    for (let x = Math.round(ox); x < Math.round(ox + unit); x++) {
      const t = (x - ox) / unit;
      const fade = Math.min(1, Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 1.5);
      blend(x, y, HORIZON, fade * 0.55);
    }
  }

  // One warm disc with a halo, exactly as the band draws it. A rim around it
  // read as a button rather than as a sun.
  const [sunX, sunY] = point(SUN_AT);
  disc(sunX, sunY, unit * 0.072, APRICOT, unit * 0.15, 0.6);
  disc(sunX, sunY, unit * 0.072, LIT, 0);

  disc(cx - footX, horizonY, unit * 0.028, LIT, unit * 0.05, 0.5);
  disc(cx + footX, horizonY, unit * 0.028, LIT, unit * 0.05, 0.5);

  return px;
}

await mkdir(OUT, { recursive: true });
for (const [name, size, inset] of [
  ['icon-192.png', 192, 0.05],
  ['icon-512.png', 512, 0.05],
  ['maskable-512.png', 512, 0.17],
]) {
  await writeFile(OUT + name, png(size, draw(size, inset)));
  console.log(name);
}
