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
const MAX_ALT = 58;
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
 * SunCalc reports azimuth in degrees clockwise from north (0 N, 90 E, 180 S,
 * 270 W). The band wants a signed offset from south — negative east, positive
 * west — so the sweep is the real one: entering on the left in the morning,
 * leaving on the right in the evening, and a wider arc in summer than in winter.
 * Vertical position is the design's compressed scale, not a projection.
 */
function southOffset(azimuthFromNorth: number): number {
  return ((((azimuthFromNorth - 180) % 360) + 540) % 360) - 180;
}

function place(altDeg: number, azimuthFromNorth: number): { x: number; y: number } {
  const x = Math.min(96, Math.max(4, 50 + (southOffset(azimuthFromNorth) / 180) * 62));
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
  moon: { x: number; y: number; opacity: number };
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

export interface SkyDay {
  dayStart: number;
  rows: SkyRow[];
  events: Record<CityId, SunEvent>;
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

    // SunCalc 2.x reports altitude in degrees already — no conversion.
    const hhAlt = hh.altitude;
    const kdAlt = kd.altitude;
    const midAlt = mid.altitude;
    const moonAlt = moon.altitude;
    const bright = Math.max(hhAlt, kdAlt);
    const isDay = bright > 6;

    const sunPos = place(midAlt, mid.azimuth);
    const moonPos = place(moonAlt, moon.azimuth);

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
const MAX_CACHED_DAYS = 10;

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
