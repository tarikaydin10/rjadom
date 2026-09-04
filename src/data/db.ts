import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Local store. This is the app's source of truth — not a cache of the server.
 *
 * Every write lands here first and is immediately visible; the network is a
 * background courier that catches up whenever it can. On a phone that has not
 * seen a connection in a week, the app still opens, still shows the sky, still
 * takes today's answer.
 */

export type Author = 'me' | 'them';

export interface AnswerRecord {
  /** `${date}:${author}` */
  id: string;
  date: string;
  questionId: string;
  author: Author;
  text: string;
  createdAt: number;
  updatedAt: number;
  /** Set once the answer has been acknowledged by the server. */
  syncedAt: number | null;
}

export interface PartnerState {
  date: string;
  /** The server tells us *that* they answered and when, without the text. */
  answered: boolean;
  answeredAt: number | null;
  fetchedAt: number;
}

export interface OutboxItem {
  id?: number;
  kind: 'answer';
  date: string;
  payload: { text: string; questionId: string; updatedAt: number };
  queuedAt: number;
  attempts: number;
  lastError: string | null;
}

interface RjadomDB extends DBSchema {
  answers: { key: string; value: AnswerRecord; indexes: { 'by-date': string } };
  partner: { key: string; value: PartnerState };
  outbox: { key: number; value: OutboxItem };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<RjadomDB>> | null = null;

export function db(): Promise<IDBPDatabase<RjadomDB>> {
  dbPromise ??= openDB<RjadomDB>('rjadom', 1, {
    upgrade(database) {
      const answers = database.createObjectStore('answers', { keyPath: 'id' });
      answers.createIndex('by-date', 'date');
      database.createObjectStore('partner', { keyPath: 'date' });
      database.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('kv');
    },
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('kv', key)) as T | undefined;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await (await db()).put('kv', value, key);
}

export const answerId = (date: string, author: Author) => `${date}:${author}`;

export async function getAnswer(date: string, author: Author): Promise<AnswerRecord | undefined> {
  return (await db()).get('answers', answerId(date, author));
}

export async function putAnswer(record: AnswerRecord): Promise<void> {
  const store = await db();
  const existing = await store.get('answers', record.id);
  // Last write wins, by the author's own clock. Only one device per author ever
  // writes a given record, so this only ever arbitrates between that author's
  // own phone and tablet.
  if (existing && existing.updatedAt > record.updatedAt) return;
  await store.put('answers', record);
}

export async function getPartnerState(date: string): Promise<PartnerState | undefined> {
  return (await db()).get('partner', date);
}

export async function putPartnerState(state: PartnerState): Promise<void> {
  await (await db()).put('partner', state);
}

export async function enqueue(item: Omit<OutboxItem, 'id'>): Promise<void> {
  const store = await db();
  const tx = store.transaction('outbox', 'readwrite');
  // One pending write per day: a re-edit before the first one leaves replaces it.
  for (const existing of await tx.store.getAll()) {
    if (existing.kind === item.kind && existing.date === item.date && existing.id !== undefined) {
      await tx.store.delete(existing.id);
    }
  }
  await tx.store.add(item as OutboxItem);
  await tx.done;
}

export async function outbox(): Promise<OutboxItem[]> {
  return (await db()).getAll('outbox');
}

export async function dequeue(id: number): Promise<void> {
  await (await db()).delete('outbox', id);
}

export async function updateOutboxItem(item: OutboxItem): Promise<void> {
  if (item.id === undefined) return;
  await (await db()).put('outbox', item);
}

export async function outboxCount(): Promise<number> {
  return (await db()).count('outbox');
}
