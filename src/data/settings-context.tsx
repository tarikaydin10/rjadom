import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';

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

  const update = useCallback(async (next: Settings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  const value = useMemo(() => ({ settings, loading, update }), [settings, loading, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
