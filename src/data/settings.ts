import { kvGet, kvSet } from './db';
import type { CityId } from '../content/cities';
import { otherCity } from '../content/cities';
import type { PairMember } from './pair';
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

export interface Settings {
  /** Who lives where. Keyed by city, not by "you" and "them". */
  names: Record<CityId, PersonName>;
  /** Day 1 of the counter above the question. Null hides the counter. */
  startDate: string | null;
  reunion: { date: string | null; city: CityId };
  /**
   * When these were last edited, anywhere.
   *
   * Settings are shared: names and a reunion date belong to the two of you, not
   * to the device they were typed on. This is what lets the newer edit win when
   * two devices disagree.
   */
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  names: {
    hamburg: { latin: 'Tarik', cyrillic: 'Тарик' },
    kaliningrad: { latin: 'Mila', cyrillic: 'Мила' },
  },
  startDate: null,
  reunion: { date: null, city: 'hamburg' },
  updatedAt: 0,
};

/**
 * Which side of the sky this device is on.
 *
 * Deliberately *not* a setting. It follows from the side chosen at unlock, so it
 * cannot drift out of step with it — which is exactly what happened when it was
 * stored: unlocking a second time as the other city left the old side behind,
 * and the app showed you your own name as your partner's.
 */
export const cityOf = (member: PairMember): CityId => (member === 'a' ? 'hamburg' : 'kaliningrad');

export interface Sides {
  yours: CityId;
  theirs: CityId;
  yourName: PersonName;
  partnerName: PersonName;
}

export function sidesFor(member: PairMember, settings: Settings): Sides {
  const yours = cityOf(member);
  const theirs = otherCity(yours);
  return { yours, theirs, yourName: settings.names[yours], partnerName: settings.names[theirs] };
}

const KEY = 'settings';

/** The shape settings had before the side stopped being stored. */
interface LegacySettings {
  you?: { name?: Partial<PersonName>; city?: CityId };
  partner?: { name?: Partial<PersonName>; city?: CityId };
}

function migrate(stored: Partial<Settings> & LegacySettings): Settings {
  const names = { ...DEFAULT_SETTINGS.names };

  if (stored.names) {
    for (const id of ['hamburg', 'kaliningrad'] as CityId[]) {
      names[id] = { ...names[id], ...stored.names[id] };
    }
  } else if (stored.you?.city || stored.partner?.city) {
    // Old shape: two people with a city each. Names move to the city they had.
    for (const person of [stored.you, stored.partner]) {
      if (person?.city && person.name) names[person.city] = { ...names[person.city], ...person.name };
    }
  }

  return {
    names,
    startDate: stored.startDate ?? DEFAULT_SETTINGS.startDate,
    reunion: { ...DEFAULT_SETTINGS.reunion, ...stored.reunion },
    updatedAt: stored.updatedAt ?? 0,
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await kvGet<Partial<Settings> & LegacySettings>(KEY);
  return stored ? migrate(stored) : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await kvSet(KEY, settings);
}

/** Fold a copy from the server in, but never over a newer local edit. */
export async function mergeRemoteSettings(remote: unknown, updatedAt: number): Promise<Settings | null> {
  if (!remote || typeof remote !== 'object') return null;
  const local = await loadSettings();
  if (local.updatedAt >= updatedAt) return null;
  const merged = migrate({ ...(remote as Partial<Settings>), updatedAt });
  await saveSettings(merged);
  return merged;
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
