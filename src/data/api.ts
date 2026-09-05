/**
 * The one call the app makes to its own backend.
 *
 * Kept deliberately small — two endpoints, one shared secret, no third-party SDK
 * — because every byte of it has to travel to Kaliningrad. Nothing here depends
 * on a particular provider: point `VITE_SYNC_BASE_URL` at whatever host you can
 * keep reachable, ideally the same origin that serves the app itself, so there is
 * exactly one name to keep alive. A reference implementation of this contract
 * lives in `server/`.
 */

import { getPair, type PairMember } from './pair';

/**
 * Empty means "same origin", which is the recommended deployment: the app and
 * the API behind one hostname, so there is exactly one name that has to stay
 * reachable from both countries and no CORS in the way. Set it to an absolute
 * origin to split them, or to `off` to run the app with no server at all.
 */
const CONFIGURED = ((import.meta.env.VITE_SYNC_BASE_URL as string | undefined) ?? '').trim();
const DISABLED = CONFIGURED.toLowerCase() === 'off';
const BASE = DISABLED ? '' : CONFIGURED.replace(/\/$/, '');

/**
 * With no server configured the app is fully usable — it just never leaves the
 * device. The credentials are not compiled in: they are entered once on the
 * unlock screen and read from `pair.ts` per request.
 */
export const syncConfigured = !DISABLED;
export const syncEnabled = (): boolean => !DISABLED && getPair() !== null;

const REQUEST_TIMEOUT_MS = 10000;

export interface RemoteAnswer {
  text: string;
  updatedAt: number;
}

export interface DayResponse {
  date: string;
  you: RemoteAnswer | null;
  partner: {
    /** Always known: that they wrote, and when. */
    answered: boolean;
    answeredAt: number | null;
    /**
     * Present only once your own answer has reached the server. The plaintext is
     * withheld server-side, not hidden client-side — a locked answer never
     * travels to the device at all.
     */
    text?: string;
    updatedAt?: number;
  };
}

/**
 * The passphrase travels base64-encoded, and not for secrecy — TLS handles that.
 *
 * HTTP header values are limited to ISO-8859-1. A Russian passphrase, which is
 * the natural choice for half of this pair, makes the browser refuse the request
 * outright with "String contains non ISO-8859-1 code point", and a raw UTF-8
 * value sent by other clients arrives mangled. Encoding the bytes first means
 * any passphrase works: Cyrillic, emoji, whatever the two of you pick.
 *
 * The `b64:` prefix keeps it unambiguous, so a device unlocked before this
 * change keeps working until it is re-unlocked.
 */
function encodeSecret(secret: string): string {
  const bytes = new TextEncoder().encode(secret);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `b64:${btoa(binary)}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const pair = getPair();
  if (DISABLED || !pair) throw new ApiError('sync not configured', 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-pair-member': pair.member,
        'x-pair-secret': encodeSecret(pair.secret),
        ...init?.headers,
      },
    });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchDay(date: string): Promise<DayResponse> {
  return request<DayResponse>(`/api/days/${date}`);
}

export function putAnswer(
  date: string,
  body: { text: string; questionId: string; updatedAt: number },
): Promise<DayResponse> {
  return request<DayResponse>(`/api/days/${date}/answer`, { method: 'PUT', body: JSON.stringify(body) });
}

/**
 * Check a passphrase and find out which side it belongs to.
 *
 * The side is the server's answer, not the client's claim: each city has its own
 * passphrase, so which one you typed is what decides whether you are Hamburg or
 * Kaliningrad. That is also why this cannot be changed in settings later — it is
 * not a preference, it is which key opened the door.
 *
 * Returns null for a passphrase the server does not recognise.
 */
export async function verifyPair(secret: string): Promise<PairMember | null> {
  // Nothing to ask in local-only mode; there is only this device.
  if (DISABLED) return 'a';

  const res = await fetch(`${BASE}/api/session`, {
    headers: { accept: 'application/json', 'x-pair-secret': encodeSecret(secret) },
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  // A dev server or a captive portal will happily answer 200 with HTML. Only a
  // real acknowledgement from our own API counts as a verified passphrase.
  const body = (await res.json().catch(() => null)) as { ok?: boolean; member?: string } | null;
  if (body?.ok !== true) throw new ApiError('unexpected response', res.status);
  return body.member === 'b' ? 'b' : 'a';
}

export interface RemoteSettings {
  settings: unknown | null;
  updatedAt: number;
}

export function fetchSettings(): Promise<RemoteSettings> {
  return request<RemoteSettings>('/api/settings');
}

export function putSettings(settings: unknown, updatedAt: number): Promise<RemoteSettings> {
  return request<RemoteSettings>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings, updatedAt }),
  });
}
