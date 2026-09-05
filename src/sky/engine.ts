import * as SunCalc from 'suncalc';
import { CITIES, MIDPOINT, type CityId } from '../content/cities';

/**
 * The sky band, precomputed.
 *
 * Astronomy comes from SunCalc (BSD-2-Clause) rather than the hand-rolled
 * formulas in the design prototype. Two things improve as a result: sunrise and
 * sunset are exact instants instead of the prototype's ±5 minutes of slot
 * scanning, and the moon follows a properly perturbed orbit.
 *
 * SunCalc computes locally from the timestamp — there is no network call here
 * and never will be. That answers the "pull it forward for a few days" question
 * directly: for sun and moon there is nothing to pull, because the data is
 * arithmetic, not a download. What prefetching buys is scheduling, not
 * connectivity — see `prefetchDays` below. Weather is the part that genuinely
 * needs fetching ahead; that lives in `src/weather`.
 */

export const SLOT_MS = 5 * 60 * 1000;
export const SLOTS = 288; // one day in five-minute steps

// Band geometry, taken from the design prototype.
export const BAND_HEIGHT = 232;
const HORIZON = 186;
const APEX = 112;
/**
 * The altitude that reaches the top of the band.
 *
 * At 54°N the sun peaks near 59° at midsummer and the moon can reach about 64°,
 * so anything lower clips them — which was invisible while only a dot was drawn
 * and became a flat lid across the top the moment the track was.
 */
const MAX_ALT = 66;
const DEPTH = 12;

const SKY_STOPS: { a: number; c: [string, string, string] }[] = [
  { a: 60, c: ['#6FA9DA', '#A8CFEA', '#DCEAF2'] },
  { a: 25, c: ['#7FB4DE', '#BBD7EA', '#E9E5DA'] },
  { a: 8, c: ['#8AB4D4', '#DFCDAE', '#F4E4CB'] },
  { a: 1, c: ['#6A6E9C', '#DE9A6C', '#F6C79A'] },
  { a: -4, c: ['#3E3A63', '#9A5C67', '#DE8A63'] },
  { a: -10, c: ['#2B2A4C', '#4A3C55', '#8A5A55'] },
  { a: -18, c: ['#1A1930', '#26233E', '#3A3350'] },
  { a: -60, c: ['#0F0E1C', '#15142A', '#1C1A32'] },
];

function mix(a: string, b: string, t: number): string {
  const parse = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const step = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${step(ar, br)},${step(ag, bg)},${step(ab, bb)})`;
}

/** Vertical three-stop gradient for a sun altitude in degrees. */
export function gradientFor(altDeg: number): string {
  let i = 0;
  while (i < SKY_STOPS.length - 1 && altDeg < SKY_STOPS[i + 1]!.a) i++;
  const hi = SKY_STOPS[i]!;
  const lo = SKY_STOPS[Math.min(SKY_STOPS.length - 1, i + 1)]!;
  const span = hi.a - lo.a;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, (hi.a - altDeg) / span));
  const c = hi.c.map((h, k) => mix(h, lo.c[k]!, t));
  return `linear-gradient(180deg, ${c[0]} 0%, ${c[1]} 52%, ${c[2]} 100%)`;
}

/**
 * Where a body sits in the band.
 *
 * The band reads like a landscape: the ground below is geography, west on the
 * left, so Hamburg sits left and Kaliningrad — 10.5° further east — sits right.
 * The sky above therefore has to agree that east is on the right, which means
 * the sun enters on the RIGHT at dawn and leaves on the LEFT at dusk. That is
 * the reverse of a sky-dome drawing, and it is the direction that makes the
 * picture true: the sun comes up over Kaliningrad, which really does get light
 * about forty minutes earlier, and goes down over Hamburg, which really does
 * keep it longest. The light travels from her side to yours.
 *
 * The two scales cannot both be honest, and this one does not pretend they are.
 * The cities are 10.5° apart — 42 minutes of sun — while a day is 360° and 24
 * hours, so any single axis showing both is off by a factor of about thirty.
 * Placing the cities truly to scale would leave them eleven pixels apart; giving
 * the sun a true scale would park it off-screen for twenty-three hours a day.
 * So the ground is deliberately exaggerated and the sky is a sky, exactly as in
 * a landscape painting, and the one thing that must not be wrong — which way
 * east is — is the same in both.
 *
 * SunCalc reports azimuth in degrees clockwise from north (0 N, 90 E, 180 S,
 * 270 W); `southOffset` turns that into a signed angle either side of south.
 * Vertical position is the design's compressed scale, not a projection.
 */
export function southOffset(azimuthFromNorth: number): number {
  return ((((azimuthFromNorth - 180) % 360) + 540) % 360) - 180;
}

export function place(altDeg: number, azimuthFromNorth: number): { x: number; y: number } {
  // Negated: east (a negative offset) belongs on the right.
  const x = Math.min(96, Math.max(4, 50 - (southOffset(azimuthFromNorth) / 180) * 62));
  const y =
    altDeg >= 0
      ? HORIZON - Math.min(1, altDeg / MAX_ALT) * (HORIZON - APEX)
      : HORIZON + Math.min(1, -altDeg / 18) * DEPTH;
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(1)) };
}

const sunTone = (alt: number) => (alt > 8 ? '#FFE9A8' : alt > 0 ? '#FFC978' : '#E8926A');
const sunHalo = (alt: number) =>
  alt > 8 ? 'rgba(255,233,168,0.45)' : alt > 0 ? 'rgba(255,201,120,0.4)' : 'rgba(232,146,106,0.3)';

export type StatusKey =
  | 'bothNight'
  | 'bothDay'
  | 'bothTwilight'
  | 'partnerFirst'
  | 'youFirst'
  | 'partnerLast'
  | 'youLast';

export interface SkyRow {
  ms: number;
  /** Sun altitude in degrees, per city. */
  alt: Record<CityId, number>;
  /** The brighter of the two — drives stars, text colour and status. */
  bright: number;
  sky: Record<CityId, string>;
  sun: { x: number; y: number; color: string; glow: string; opacity: number };
  moon: {
    x: number;
    y: number;
    opacity: number;
    /** Lit fraction, 0 new to 1 full. */
    illuminated: number;
    /** True while the moon is filling up, which decides the side the light is on. */
    waxing: boolean;
    /** Degrees to turn the lit limb so it faces the sun. */
    tilt: number;
  };
  starOpacity: number;
  /** True when the brighter city is in daylight — flips the text to dark ink. */
  isDay: boolean;
  /** Sun climbing rather than falling. Morning and evening need different words
   *  for the same gap: light "not yet" versus light "no longer". */
  rising: boolean;
  text: { primary: string; secondary: string; shadow: string; arc: string; horizon: string };
}

export interface SunEvent {
  /** Exact instant, or null on a polar day/night when the event does not occur. */
  sunrise: number | null;
  sunset: number | null;
  /** True when the sun never sets / never rises on this date at this latitude. */
  alwaysUp: boolean;
  alwaysDown: boolean;
}

/**
 * One stroke of a body's track across the band.
 *
 * Split rather than one long line, for two reasons: the part below the horizon
 * is drawn differently from the part above it, and the horizontal position wraps
 * when a body passes due north, which would otherwise draw a line straight back
 * across the sky.
 */
export interface SkyPathSegment {
  d: string;
  above: boolean;
}

export interface SkyDay {
  dayStart: number;
  rows: SkyRow[];
  events: Record<CityId, SunEvent>;
  /**
   * Where the sun and moon actually go today, in band coordinates.
   *
   * The design's arc was a fixed decorative curve that the sun never touched.
   * This is the real track, computed from the same positions the bodies are
   * drawn at — so the sun sits on its own path by construction, the arc is high
   * in summer and shallow in winter, and the moon's differs from the sun's
   * because it genuinely does.
   */
  paths: { sun: SkyPathSegment[]; moon: SkyPathSegment[] };
}

interface TrackPoint {
  x: number;
  y: number;
  alt: number;
}

/** Below this the track is not drawn at all: it is deep night, the body is far
 *  under the ground, and its position has been clamped to the band edge. */
const TRACK_FLOOR = -12;

function trackSegments(points: TrackPoint[]): SkyPathSegment[] {
  const segments: SkyPathSegment[] = [];
  let current: TrackPoint[] = [];
  let above: boolean | null = null;

  const flush = () => {
    // A run stuck against a band edge is the clamp, not a path: the body is
    // somewhere off past due north and its position has nowhere left to go.
    const pinned =
      current.length > 1 && current.every((p) => p.x <= 4.01 || p.x >= 95.99);
    if (current.length > 1 && above !== null && !pinned) {
      const d = current.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(1)}`).join(' ');
      segments.push({ d, above });
    }
    current = [];
  };

  for (const point of points) {
    const visible = point.alt >= TRACK_FLOOR;
    const isAbove = point.alt >= 0;
    const previous = current[current.length - 1];
    // A jump means the body crossed due north and the position wrapped.
    const wrapped = previous !== undefined && Math.abs(point.x - previous.x) > 40;

    if (!visible || wrapped || (above !== null && isAbove !== above)) {
      const boundary = current[current.length - 1];
      flush();
      // Carry the last point over so the solid and faint parts meet at the horizon.
      if (visible && !wrapped && boundary) current.push(boundary);
    }

    if (visible) {
      above = isAbove;
      current.push(point);
    } else {
      above = null;
    }
  }
  flush();

  return segments;
}

/** SunCalc reports "no such event today" as null, and flags the polar cases. */
const instant = (d: Date | null | undefined): number | null =>
  d && !Number.isNaN(d.getTime()) ? d.getTime() : null;

function eventsFor(dayStart: number, cityId: CityId): SunEvent {
  const city = CITIES[cityId];
  // Ask at local noon so SunCalc returns the events of this calendar day rather
  // than those of the night that straddles midnight.
  const noon = new Date(dayStart + 12 * 60 * 60 * 1000);
  const times = SunCalc.getTimes(noon, city.lat, city.lon);
  return {
    sunrise: instant(times.sunrise),
    sunset: instant(times.sunset),
    alwaysUp: times.alwaysUp === true,
    alwaysDown: times.alwaysDown === true,
  };
}

/**
 * Which way the moon's lit edge points: at the sun.
 *
 * Taken from the angle between the two bodies in the sky, not from where they
 * ended up being drawn. Drawn positions are clamped at the band edges and jump
 * from one side to the other when a body passes due north, and reading the
 * direction off them made the moon flip over in an instant around solar
 * midnight. An angular difference, normalised once, moves smoothly through that.
 *
 * The band compresses the two axes differently — 62% of the width per 180° of
 * azimuth against 74px per 66° of altitude — so the difference is converted to
 * the band's own proportions before the angle is taken, or the crescent would
 * lean wrongly. Widths vary by phone; only the ratio matters here.
 */
const PX_PER_AZIMUTH_DEGREE = (0.62 * 393) / 180;
const PX_PER_ALTITUDE_DEGREE = (HORIZON - APEX) / MAX_ALT;

function limbTilt(sunAlt: number, sunAz: number, moonAlt: number, moonAz: number): number {
  // Normalised to ±180 so passing north is a small step, not a full turn.
  const deltaAzimuth = ((((southOffset(sunAz) - southOffset(moonAz)) % 360) + 540) % 360) - 180;
  // East is on the right in the band, and screen y grows downward: both flip.
  const dx = -deltaAzimuth * PX_PER_AZIMUTH_DEGREE;
  const dy = -(sunAlt - moonAlt) * PX_PER_ALTITUDE_DEGREE;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Highest of the two cities' sun altitudes at an instant. */
function brightestAt(ms: number): number {
  const at = new Date(ms);
  return Math.max(
    SunCalc.getPosition(at, CITIES.hamburg.lat, CITIES.hamburg.lon).altitude,
    SunCalc.getPosition(at, CITIES.kaliningrad.lat, CITIES.kaliningrad.lon).altitude,
  );
}

/** Build one full day of rows. Called once per date, never inside a render. */
export function buildDay(dayStart: number): SkyDay {
  const rows: SkyRow[] = [];
  const sunTrack: TrackPoint[] = [];
  const moonTrack: TrackPoint[] = [];
  // Seeded from just before midnight so the first slot of the day is not
  // arbitrarily called "rising".
  let previousBright = brightestAt(dayStart - SLOT_MS);

  for (let i = 0; i < SLOTS; i++) {
    const ms = dayStart + i * SLOT_MS;
    const at = new Date(ms);

    const hh = SunCalc.getPosition(at, CITIES.hamburg.lat, CITIES.hamburg.lon);
    const kd = SunCalc.getPosition(at, CITIES.kaliningrad.lat, CITIES.kaliningrad.lon);
    const mid = SunCalc.getPosition(at, MIDPOINT.lat, MIDPOINT.lon);
    const moon = SunCalc.getMoonPosition(at, MIDPOINT.lat, MIDPOINT.lon);
    const illumination = SunCalc.getMoonIllumination(at);

    // SunCalc 2.x reports altitude in degrees already — no conversion.
    const hhAlt = hh.altitude;
    const kdAlt = kd.altitude;
    const midAlt = mid.altitude;
    const moonAlt = moon.altitude;
    const bright = Math.max(hhAlt, kdAlt);
    const isDay = bright > 6;

    const sunPos = place(midAlt, mid.azimuth);
    const moonPos = place(moonAlt, moon.azimuth);
    sunTrack.push({ ...sunPos, alt: midAlt });
    moonTrack.push({ ...moonPos, alt: moonAlt });

    // Compare before advancing, or every slot compares against itself.
    const rising = bright >= previousBright;
    previousBright = bright;

    rows.push({
      ms,
      alt: { hamburg: hhAlt, kaliningrad: kdAlt },
      bright,
      sky: { hamburg: gradientFor(hhAlt), kaliningrad: gradientFor(kdAlt) },
      sun: {
        x: sunPos.x,
        y: sunPos.y,
        color: sunTone(midAlt),
        glow: sunHalo(midAlt),
        opacity: midAlt < -8 ? 0 : 1,
      },
      moon: {
        x: moonPos.x,
        y: moonPos.y,
        opacity: moonAlt > 0 && bright < 8 ? Math.min(0.9, Math.max(0, (8 - bright) / 14)) : 0,
        illuminated: illumination.fraction,
        waxing: illumination.phase < 0.5,
        tilt: limbTilt(midAlt, mid.azimuth, moonAlt, moon.azimuth),
      },
      starOpacity: Math.min(1, Math.max(0, (-4 - bright) / 10)),
      isDay,
      rising,
      text: isDay
        ? {
            primary: '#1E2029',
            secondary: '#33323C',
            shadow: '0 1px 2px rgba(255,252,244,0.65)',
            arc: 'rgba(36,31,27,0.30)',
            horizon: 'rgba(36,31,27,0.42)',
          }
        : {
            primary: '#FFF9EF',
            secondary: '#F2E3D0',
            shadow: '0 1px 3px rgba(20,16,28,0.6)',
            arc: 'rgba(246,224,190,0.34)',
            horizon: 'rgba(246,224,190,0.5)',
          },
    });
  }

  return {
    dayStart,
    rows,
    events: { hamburg: eventsFor(dayStart, 'hamburg'), kaliningrad: eventsFor(dayStart, 'kaliningrad') },
    paths: { sun: trackSegments(sunTrack), moon: trackSegments(moonTrack) },
  };
}

/**
 * How the two skies relate, from the reader's side.
 *
 * The gap between the cities reads differently at the two ends of the day: in
 * the morning one of you does not have light *yet*, in the evening one of you
 * does not have it *any more*. Same altitudes, opposite words.
 */
export function statusFor(row: SkyRow, yourCity: CityId): StatusKey {
  const partnerCity: CityId = yourCity === 'hamburg' ? 'kaliningrad' : 'hamburg';
  const yours = row.alt[yourCity];
  const theirs = row.alt[partnerCity];
  if (row.bright < -6) return 'bothNight';
  if (Math.min(yours, theirs) > 6) return 'bothDay';
  if (row.bright < 0) return 'bothTwilight';
  if (row.rising) return yours < theirs ? 'partnerFirst' : 'youFirst';
  return yours < theirs ? 'partnerLast' : 'youLast';
}

/** Local midnight of the calendar day a timestamp falls in. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function slotOf(ms: number): number {
  const offset = ms - startOfLocalDay(ms);
  return Math.min(SLOTS - 1, Math.max(0, Math.floor(offset / SLOT_MS)));
}

/**
 * Day tables, cached by date.
 *
 * Building one day costs 288 × 4 position calls — a few milliseconds, but not
 * something to do while the user is mid-gesture. `prefetchDays` walks the next
 * few days during idle time so that midnight, a scrub into tomorrow, or a cold
 * start on a plane all find the table already built.
 */
const dayCache = new Map<number, SkyDay>();
// A fortnight either way, which is as far as the band can be wound.
const MAX_CACHED_DAYS = 32;

export function skyDay(ms: number): SkyDay {
  const key = startOfLocalDay(ms);
  const hit = dayCache.get(key);
  if (hit) return hit;
  const built = buildDay(key);
  dayCache.set(key, built);
  if (dayCache.size > MAX_CACHED_DAYS) {
    const oldest = [...dayCache.keys()].sort((a, b) => a - b)[0];
    if (oldest !== undefined && oldest !== key) dayCache.delete(oldest);
  }
  return built;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Build today plus `days` further tables without blocking the first paint. */
export function prefetchDays(fromMs: number, days = 6): void {
  const schedule =
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 200);
  let offset = 0;
  const step = () => {
    if (offset > days) return;
    skyDay(startOfLocalDay(fromMs) + offset * DAY_MS);
    offset++;
    schedule(step as never);
  };
  schedule(step as never);
}
