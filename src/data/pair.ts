/**
 * The one-time unlock.
 *
 * The shared secret is *not* compiled into the bundle. It is typed in once, on
 * the first launch of each device, and kept there. That difference matters: a
 * baked-in secret is handed to everyone who opens the URL, whereas this way a
 * stranger who finds the address gets a lock screen, and the server turns them
 * away because they cannot present the secret.
 *
 * What this is: a lock on the front door, so the page is not simply readable by
 * anyone who stumbles onto it. What it is not: encryption. Answers sit
 * unencrypted in this device's database, so whoever holds the unlocked phone
 * reads them. The protection is against strangers, not against someone with your
 * phone in their hand.
 */

const STORAGE_KEY = 'rjadom.pair';

export type PairMember = 'a' | 'b';

export interface PairCredentials {
  member: PairMember;
  secret: string;
}

let cached: PairCredentials | null | undefined;
const listeners = new Set<() => void>();

function read(): PairCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PairCredentials>;
    if ((parsed.member === 'a' || parsed.member === 'b') && typeof parsed.secret === 'string' && parsed.secret) {
      return { member: parsed.member, secret: parsed.secret };
    }
  } catch {
    // Unreadable storage means "not unlocked yet", which is the safe answer.
  }
  return null;
}

export function getPair(): PairCredentials | null {
  cached ??= read();
  return cached;
}

export function setPair(credentials: PairCredentials): void {
  cached = credentials;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Kept in memory for this session at least; the user will be asked again next launch.
  }
  for (const listener of listeners) listener();
}

export function clearPair(): void {
  cached = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the in-memory value is already gone.
  }
  for (const listener of listeners) listener();
}

export function subscribePair(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isUnlocked(): boolean {
  return getPair() !== null;
}

/** A passphrase worth using: 20 random characters, not an anniversary. */
export function suggestSecret(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
