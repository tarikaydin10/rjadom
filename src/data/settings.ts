import { kvGet, kvSet } from './db';
import type { PairMember } from './pair';
import type { CityId } from '../content/cities';
import type { Locale } from '../i18n';
import { dateKey } from '../lib/day';

/**
 * A name, optionally written twice.
 *
 * Names are never translated — but a name can legitimately have two spellings,
 * the way the app itself is both Rjadom and Рядом. Whichever spelling matches
 * the interface language is shown; if only one exists, that one is shown in both
 * languages. Both bundled fonts carry Latin and Cyrillic, so neither spelling
 * ever drops to a system fallback.
 */
export interface PersonName {
  latin: string;
  cyrillic: string;
}

export interface Person {
  name: PersonName;
  city: CityId;
}

export interface Settings {
  you: Person;
  partner: Person;
  /** Day 1 of the counter above the question. Null hides the counter. */
  startDate: string | null;
  reunion: { date: string | null; city: CityId };
}

export const DEFAULT_SETTINGS: Settings = {
  you: { name: { latin: 'Tarik', cyrillic: 'Тарик' }, city: 'hamburg' },
  partner: { name: { latin: 'Mila', cyrillic: 'Мила' }, city: 'kaliningrad' },
  startDate: null,
  reunion: { date: null, city: 'hamburg' },
};

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await kvGet<Partial<Settings>>(KEY);
  if (!stored) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    you: { ...DEFAULT_SETTINGS.you, ...stored.you },
    partner: { ...DEFAULT_SETTINGS.partner, ...stored.partner },
    reunion: { ...DEFAULT_SETTINGS.reunion, ...stored.reunion },
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await kvSet(KEY, settings);
}

const HAMBURG_SIDE: Person = { name: { latin: 'Tarik', cyrillic: 'Тарик' }, city: 'hamburg' };
const KALININGRAD_SIDE: Person = { name: { latin: 'Mila', cyrillic: 'Мила' }, city: 'kaliningrad' };

/**
 * Which side of the sky this device is on.
 *
 * The same build runs on both phones, so "you" and "they" cannot be baked in:
 * on Mila's phone Kaliningrad is the left column and Tarik is the partner. The
 * side chosen at unlock decides that. Returns null when settings already exist,
 * so re-unlocking a device never overwrites names the two of them have edited.
 */
export async function sideDefaults(member: PairMember): Promise<Settings | null> {
  const stored = await kvGet<Partial<Settings>>(KEY);
  if (stored) return null;
  return {
    ...DEFAULT_SETTINGS,
    you: member === 'a' ? HAMBURG_SIDE : KALININGRAD_SIDE,
    partner: member === 'a' ? KALININGRAD_SIDE : HAMBURG_SIDE,
  };
}

export function displayName(name: PersonName, locale: Locale): string {
  const preferred = locale === 'ru' ? name.cyrillic : name.latin;
  return preferred.trim() || name.latin.trim() || name.cyrillic.trim();
}

/** Days until the reunion, counted in the pair's shared calendar. */
export function daysUntil(target: string, now: number = Date.now()): number {
  const today = dateKey(now);
  const [ty, tm, td] = target.split('-').map(Number);
  const [ny, nm, nd] = today.split('-').map(Number);
  const a = Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1);
  const b = Date.UTC(ny ?? 0, (nm ?? 1) - 1, nd ?? 1);
  return Math.round((a - b) / 86400000);
}
