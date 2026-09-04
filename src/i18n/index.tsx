import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DICTIONARIES, type Locale, type Plural, type Strings } from './strings';

export type { Locale };
export type LocalePreference = Locale | 'system';

const STORAGE_KEY = 'rjadom.locale';

/**
 * System language decides: Russian if the device asks for Russian, English
 * otherwise. Read from localStorage synchronously so the first paint is already
 * in the right language — a flash of the wrong alphabet is worse than a slow one.
 */
export function detectSystemLocale(): Locale {
  const candidates = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of candidates) {
    if (!tag) continue;
    const base = tag.toLowerCase().split('-')[0];
    // Belarusian, Kazakh and Ukrainian devices are far more likely to read the
    // Russian text than the English one.
    if (base === 'ru' || base === 'be' || base === 'kk' || base === 'uk') return 'ru';
    if (base === 'en') return 'en';
  }
  return 'en';
}

function readPreference(): LocalePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'en' || raw === 'ru' || raw === 'system') return raw;
  } catch {
    // Private mode or a locked-down browser. The system language still works.
  }
  return 'system';
}

type Path = string;
type Vars = Record<string, string | number>;

function lookup(dict: unknown, path: Path): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in node) return (node as Record<string, unknown>)[key];
    return undefined;
  }, dict);
}

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

export interface I18n {
  locale: Locale;
  preference: LocalePreference;
  setPreference(next: LocalePreference): void;
  /** Translate a dotted key, e.g. `t('sky.status.bothNight')`. */
  t(key: Path, vars?: Vars): string;
  /** Translate with a count, applying the target language's plural rules. */
  tp(key: Path, count: number, vars?: Vars): string;
  /** The other language — used for the second line of the daily question. */
  other: Locale;
  strings: Strings;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>(readPreference);
  const [systemLocale, setSystemLocale] = useState<Locale>(detectSystemLocale);

  // A device language change while the app sits in the background should take
  // effect, not wait for a reload.
  useEffect(() => {
    const onLanguageChange = () => setSystemLocale(detectSystemLocale());
    window.addEventListener('languagechange', onLanguageChange);
    return () => window.removeEventListener('languagechange', onLanguageChange);
  }, []);

  const locale: Locale = preference === 'system' ? systemLocale : preference;

  const setPreference = useCallback((next: LocalePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisting a preference is survivable; ignoring the click is not.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18n>(() => {
    const dict = DICTIONARIES[locale];
    const pluralRules = new Intl.PluralRules(locale === 'ru' ? 'ru-RU' : 'en-GB');

    const t = (key: Path, vars?: Vars): string => {
      const hit = lookup(dict, key) ?? lookup(DICTIONARIES.en, key);
      if (typeof hit !== 'string') {
        if (import.meta.env.DEV) console.warn(`[i18n] missing string: ${key}`);
        return key;
      }
      return fill(hit, vars);
    };

    const tp = (key: Path, count: number, vars?: Vars): string => {
      const hit = (lookup(dict, key) ?? lookup(DICTIONARIES.en, key)) as Plural | undefined;
      if (!hit || typeof hit === 'string') return t(key, { ...vars, count });
      const category = pluralRules.select(count) as keyof Plural;
      const template = hit[category] ?? hit.other;
      return fill(template, { ...vars, count });
    };

    return {
      locale,
      preference,
      setPreference,
      t,
      tp,
      other: locale === 'ru' ? 'en' : 'ru',
      strings: dict as Strings,
    };
  }, [locale, preference, setPreference]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** BCP-47 tag for Intl. English falls to en-GB so clocks stay 24-hour, which is
 *  what both cities actually use. */
export const intlTag = (locale: Locale): string => (locale === 'ru' ? 'ru-RU' : 'en-GB');
