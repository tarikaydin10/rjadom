import {
  ApiError,
  fetchDay,
  fetchSettings,
  putAnswer as putRemoteAnswer,
  putSettings,
  syncConfigured,
  syncEnabled,
  type DayResponse,
} from './api';
import { loadSettings, mergeRemoteSettings } from './settings';
import {
  answerId,
  dequeue,
  getAnswer,
  outbox,
  outboxCount,
  putAnswer as putLocalAnswer,
  putPartnerState,
  updateOutboxItem,
  kvGet,
  kvSet,
} from './db';
import { dateKey } from '../lib/day';

/**
 * The courier.
 *
 * Local writes never wait for it. It drains the outbox when a connection
 * appears, pulls back whatever the other side has written, and gives up quietly
 * when it cannot — the UI shows what is pending, and nothing is ever lost by
 * being offline.
 */

export type SyncState = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncAt: number | null;
  error: string | null;
}

let status: SyncStatus = {
  state: syncConfigured ? 'idle' : 'disabled',
  pending: 0,
  lastSyncAt: null,
  error: null,
};

const listeners = new Set<(s: SyncStatus) => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSync(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

function emit(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

const LAST_SYNC_KEY = 'lastSyncAt';

async function refreshPending(): Promise<number> {
  const pending = await outboxCount();
  emit({ pending });
  return pending;
}

/** Fold a server response into the local store. */
async function applyDay(response: DayResponse): Promise<void> {
  const now = Date.now();

  if (response.you) {
    const mine = await getAnswer(response.date, 'me');
    if (mine && mine.updatedAt <= response.you.updatedAt) {
      await putLocalAnswer({ ...mine, syncedAt: now });
    }
  }

  await putPartnerState({
    date: response.date,
    answered: response.partner.answered,
    answeredAt: response.partner.answeredAt,
    fetchedAt: now,
  });

  if (typeof response.partner.text === 'string') {
    await putLocalAnswer({
      id: answerId(response.date, 'them'),
      date: response.date,
      questionId: '',
      author: 'them',
      text: response.partner.text,
      createdAt: response.partner.answeredAt ?? now,
      updatedAt: response.partner.updatedAt ?? response.partner.answeredAt ?? now,
      syncedAt: now,
    });
  }
}

const MAX_ATTEMPTS = 8;

async function flushOutbox(): Promise<void> {
  for (const item of await outbox()) {
    try {
      const response = await putRemoteAnswer(item.date, item.payload);
      await applyDay(response);
      if (item.id !== undefined) await dequeue(item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A rejected payload will never be accepted; a lost connection will.
      const permanent = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429;
      const attempts = item.attempts + 1;
      if ((permanent || attempts >= MAX_ATTEMPTS) && item.id !== undefined) {
        await dequeue(item.id);
        emit({ error: `dropped after ${attempts}: ${message}` });
      } else {
        await updateOutboxItem({ ...item, attempts, lastError: message });
      }
      throw error;
    }
  }
}

/** Dates worth pulling: today, and yesterday in case an answer landed late. */
function activeDates(): string[] {
  const now = Date.now();
  return [dateKey(now), dateKey(now - 24 * 60 * 60 * 1000)];
}

/**
 * Names, dates and the reunion belong to the pair, not to one phone.
 *
 * They used to live only in the device that typed them, so a reunion set on a
 * phone was invisible in a browser — correct storage, wrong scope. Newer edit
 * wins, by the same clock rule the answers use.
 */
async function syncSharedSettings(): Promise<void> {
  const remote = await fetchSettings();
  const merged = await mergeRemoteSettings(remote.settings, remote.updatedAt);
  if (merged) return;

  const local = await loadSettings();
  if (local.updatedAt > remote.updatedAt) await putSettings(local, local.updatedAt);
}

let running: Promise<void> | null = null;

export function syncNow(dates: string[] = activeDates()): Promise<void> {
  if (!syncEnabled()) return Promise.resolve();
  if (running) return running;

  running = (async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await refreshPending();
      emit({ state: 'offline' });
      return;
    }
    emit({ state: 'syncing', error: null });
    try {
      await flushOutbox();
      for (const date of dates) {
        await applyDay(await fetchDay(date));
      }
      await syncSharedSettings();
      const now = Date.now();
      await kvSet(LAST_SYNC_KEY, now);
      await refreshPending();
      emit({ state: 'idle', lastSyncAt: now, error: null });
    } catch (error) {
      await refreshPending();
      const message = error instanceof Error ? error.message : String(error);
      emit({ state: navigator.onLine === false ? 'offline' : 'error', error: message });
    } finally {
      running = null;
    }
  })();

  return running;
}

const PERIODIC_MS = 5 * 60 * 1000;
let started = false;

/**
 * Sync on every occasion that suggests a connection might exist: startup,
 * coming back online, and returning to the app. Plus a slow heartbeat for the
 * case where the phone stays open on the screen all evening.
 */
export function startSync(): () => void {
  if (!syncEnabled()) {
    void refreshPending();
    return () => undefined;
  }
  if (started) return () => undefined;
  started = true;

  void kvGet<number>(LAST_SYNC_KEY).then((last) => {
    if (last) emit({ lastSyncAt: last });
  });

  const attempt = () => void syncNow().catch(() => undefined);
  const onVisible = () => {
    if (document.visibilityState === 'visible') attempt();
  };

  attempt();
  window.addEventListener('online', attempt);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(attempt, PERIODIC_MS);

  return () => {
    started = false;
    window.removeEventListener('online', attempt);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}
