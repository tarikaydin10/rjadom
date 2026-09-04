import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSyncStatus, subscribeSync, type SyncStatus } from '../data/sync';
import { cachedForecast, refreshForecast, type WeatherCache } from '../weather/openmeteo';

/**
 * A clock that ticks on the minute, not every minute from mount. Without the
 * alignment the displayed time can lag the real one by up to 59 seconds, which
 * is very visible next to a 31px numeral.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const delay = 60000 - (Date.now() % 60000) + 50;
      timer = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return now;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

const WEATHER_POLL_MS = 15 * 60 * 1000;

/**
 * Cached forecast first, network second. The screen never waits for the network
 * to render a number it already has.
 */
export function useWeather(): WeatherCache | undefined {
  const [cache, setCache] = useState<WeatherCache | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const apply = (next: WeatherCache | undefined) => {
      if (!cancelled && next) setCache(next);
    };

    void cachedForecast().then(apply);
    const refresh = () => void refreshForecast().then(apply);
    refresh();

    const timer = window.setInterval(refresh, WEATHER_POLL_MS);
    window.addEventListener('online', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('online', refresh);
    };
  }, []);

  return cache;
}
