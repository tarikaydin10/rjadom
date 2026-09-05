/**
 * "Which day is it?" — answered once, for both people.
 *
 * Hamburg and Kaliningrad are one or two hours apart depending on the season, so
 * a naive local date would put the two phones on different questions for a couple
 * of hours every evening, and the two answers would never meet. The pair therefore
 * shares one canonical timezone for day boundaries. Everything the two of them
 * hold in common — the question of the day, the answer keys, the day counter — is
 * keyed by this. Clocks and sunsets stay strictly local; only the calendar is shared.
 */
export const PAIR_TIMEZONE = 'Europe/Berlin';

const keyFormatters = new Map<string, Intl.DateTimeFormat>();

function keyFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = keyFormatters.get(tz);
  if (!fmt) {
    // en-CA renders as YYYY-MM-DD, which is the key format we want anyway.
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    keyFormatters.set(tz, fmt);
  }
  return fmt;
}

/** `YYYY-MM-DD` in the pair's shared timezone. */
export function dateKey(ms: number = Date.now(), tz: string = PAIR_TIMEZONE): string {
  return keyFormatter(tz).format(new Date(ms));
}

/** Midday UTC of a date key — a safe instant for date arithmetic. */
export function dateKeyToMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dateKeyToMs(toKey) - dateKeyToMs(fromKey)) / DAY_MS);
}

/** 1 on the start date itself, as a human would count it. */
export function dayNumber(startKey: string, todayKey: string): number {
  return daysBetween(startKey, todayKey) + 1;
}

export function isValidDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(dateKeyToMs(key));
}
