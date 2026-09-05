import { skyDay } from './engine';
import type { CityId } from '../content/cities';
import { DAY_MS } from '../lib/day';

export type EventKey = 'sunrise' | 'sunset' | 'polarDay' | 'polarNight';

export interface NextEvent {
  key: EventKey;
  /** Null for the polar cases, where there is no crossing to name. */
  at: number | null;
}

/**
 * The next horizon crossing for a city, seen from a given moment. Exact, because
 * SunCalc gives the instant rather than the five-minute slot it falls in.
 */
export function nextEvent(ms: number, city: CityId): NextEvent {
  const today = skyDay(ms).events[city];
  if (today.alwaysUp) return { key: 'polarDay', at: null };
  if (today.alwaysDown) return { key: 'polarNight', at: null };
  if (today.sunrise !== null && ms < today.sunrise) return { key: 'sunrise', at: today.sunrise };
  if (today.sunset !== null && ms < today.sunset) return { key: 'sunset', at: today.sunset };

  const tomorrow = skyDay(ms + DAY_MS).events[city];
  if (tomorrow.sunrise !== null) return { key: 'sunrise', at: tomorrow.sunrise };
  if (tomorrow.sunset !== null) return { key: 'sunset', at: tomorrow.sunset };
  return { key: 'polarDay', at: null };
}
