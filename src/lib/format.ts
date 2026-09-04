import { intlTag, type Locale } from '../i18n';

const clockCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Wall clock in a given city. Always 24-hour: both cities write time that way,
 * and the design's 31px numerals were drawn for "21:14", not "9:14 PM".
 */
export function clock(ms: number, tz: string, locale: Locale = 'en'): string {
  const key = `${tz}:${locale}`;
  let fmt = clockCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(intlTag(locale), {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: tz,
    });
    clockCache.set(key, fmt);
  }
  return fmt.format(new Date(ms));
}

/** "12 October" / «12 октября» — the reunion line. */
export function dayAndMonth(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'long' }).format(new Date(ms));
}

/** Short relative stamp for sync and weather freshness. */
export function timeOfDay(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTag(locale), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(ms),
  );
}

export function roundTemp(value: number): string {
  return `${Math.round(value)}°`;
}
