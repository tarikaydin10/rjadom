import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';
import { subscribeSync, syncNow } from './sync';

interface SettingsContextValue {
  settings: Settings;
  /** True until the stored settings have been read; the defaults render meanwhile. */
  loading: boolean;
  update(next: Settings): Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((stored) => {
      if (cancelled) return;
      setSettings(stored);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Whatever the courier brings back — a reunion date set on the other phone —
  // appears without anyone reaching for a refresh.
  useEffect(() => subscribeSync(() => void loadSettings().then(setSettings)), []);

  const update = useCallback(async (next: Settings) => {
    // Stamped on write, so the newer edit wins wherever the two disagree.
    const stamped = { ...next, updatedAt: Date.now() };
    setSettings(stamped);
    await saveSettings(stamped);
    void syncNow().catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ settings, loading, update }), [settings, loading, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
