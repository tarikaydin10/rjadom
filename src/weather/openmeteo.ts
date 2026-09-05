import { CITIES, type CityId } from '../content/cities';
import { kvGet, kvSet } from '../data/db';

/**
 * Weather, pulled forward.
 *
 * This is the part of the sky band that genuinely needs a network — sun and moon
 * are arithmetic (see `src/sky/engine.ts`), weather is an observation. So one
 * request fetches seven days of hourly values for both cities at once and stores
 * them locally. After that the app can render any moment of the coming week with
 * no connection at all, and a phone that goes dark for a week still shows the
 * last numbers it had, honestly stamped with when they were taken.
 *
 * Source: Open-Meteo (https://open-meteo.com) — open data, open source, no API
 * key, hosted in the EU, and self-hostable if the public endpoint ever stops
 * being reachable. `VITE_WEATHER_BASE_URL` points the app at a private instance
 * without touching this file.
 */

// `||`, not `??`. A build environment that defines the variable but leaves it
// empty — which is exactly what a GitHub workflow does for an unset repository
// variable — yields "", and "" is not nullish. The public endpoint then
// disappeared from the bundle and the app asked its own origin for /v1/forecast,
// got the application shell back as HTML, and quietly showed no weather at all.
const BASE = (import.meta.env.VITE_WEATHER_BASE_URL as string | undefined) || 'https://api.open-meteo.com';
const CACHE_KEY = 'weather';
const FORECAST_DAYS = 7;
const REFRESH_AFTER_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

export interface CitySeries {
  /** Unix milliseconds, hourly, ascending. */
  time: number[];
  temperature: (number | null)[];
  code: (number | null)[];
}

export interface WeatherCache {
  fetchedAt: number;
  cities: Record<CityId, CitySeries>;
}

export interface Observation {
  temperature: number;
  code: number;
  /** When the forecast was fetched, not when the value applies. */
  fetchedAt: number;
}

const ORDER: CityId[] = ['hamburg', 'kaliningrad'];

interface OpenMeteoResponse {
  hourly?: { time?: number[]; temperature_2m?: (number | null)[]; weather_code?: (number | null)[] };
}

function buildUrl(): string {
  const params = new URLSearchParams({
    latitude: ORDER.map((id) => CITIES[id].lat).join(','),
    longitude: ORDER.map((id) => CITIES[id].lon).join(','),
    hourly: 'temperature_2m,weather_code',
    // A day back as well, so scrubbing to early this morning still has numbers.
    past_days: '1',
    forecast_days: String(FORECAST_DAYS),
    timeformat: 'unixtime',
    timezone: 'UTC',
  });
  return `${BASE}/v1/forecast?${params.toString()}`;
}

function toSeries(payload: OpenMeteoResponse | undefined): CitySeries {
  const hourly = payload?.hourly;
  return {
    time: (hourly?.time ?? []).map((s) => s * 1000),
    temperature: hourly?.temperature_2m ?? [],
    code: hourly?.weather_code ?? [],
  };
}

export async function fetchForecast(signal?: AbortSignal): Promise<WeatherCache> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(buildUrl(), { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`weather: HTTP ${res.status}`);
    const body: unknown = await res.json();
    // Open-Meteo returns an array when several coordinates are requested, in the
    // order they were given.
    const list = (Array.isArray(body) ? body : [body]) as OpenMeteoResponse[];
    const cities = {} as Record<CityId, CitySeries>;
    ORDER.forEach((id, index) => {
      cities[id] = toSeries(list[index]);
    });
    const cache: WeatherCache = { fetchedAt: Date.now(), cities };
    await kvSet(CACHE_KEY, cache);
    return cache;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function cachedForecast(): Promise<WeatherCache | undefined> {
  return kvGet<WeatherCache>(CACHE_KEY);
}

export function isStale(cache: WeatherCache | undefined, now: number = Date.now()): boolean {
  return !cache || now - cache.fetchedAt > REFRESH_AFTER_MS;
}

/**
 * Refresh if the cache is old, but never let a failed request erase good data:
 * a stale number with a timestamp beats an empty line.
 */
export async function refreshForecast(force = false): Promise<WeatherCache | undefined> {
  const cache = await cachedForecast();
  if (!force && !isStale(cache)) return cache;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return cache;
  try {
    return await fetchForecast();
  } catch {
    return cache;
  }
}

/** Nearest hourly sample to `ms`, or null when the forecast does not reach it. */
export function observationAt(cache: WeatherCache | undefined, city: CityId, ms: number): Observation | null {
  const series = cache?.cities?.[city];
  if (!cache || !series || series.time.length === 0) return null;

  let lo = 0;
  let hi = series.time.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((series.time[mid] ?? 0) < ms) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [lo - 1, lo].filter((i) => i >= 0 && i < series.time.length);
  let best: number | null = null;
  let bestDelta = Infinity;
  for (const i of candidates) {
    const delta = Math.abs((series.time[i] ?? 0) - ms);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  // More than 90 minutes away means the forecast simply does not cover this
  // moment — better to show nothing than to pretend.
  if (best === null || bestDelta > 90 * 60 * 1000) return null;

  const temperature = series.temperature[best];
  const code = series.code[best];
  if (temperature === null || temperature === undefined || code === null || code === undefined) return null;
  return { temperature, code, fetchedAt: cache.fetchedAt };
}

/**
 * WMO weather interpretation codes, grouped into the handful of words the note
 * line has room for. Both languages carry all of these keys.
 */
export function conditionKey(code: number): string {
  if (code === 0) return 'clear';
  if (code === 1) return 'mostlyClear';
  if (code === 2) return 'cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 66 || code === 67) return 'freezingRain';
  if (code >= 61 && code <= 65) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code === 85 || code === 86) return 'snowShowers';
  if (code >= 95) return 'thunderstorm';
  return 'cloudy';
}
