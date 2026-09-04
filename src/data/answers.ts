import { answerId, getAnswer, getPartnerState, putAnswer, enqueue, type AnswerRecord, type PartnerState } from './db';
import { syncNow } from './sync';
import { syncEnabled } from './api';

export interface DayAnswers {
  mine: AnswerRecord | null;
  theirs: AnswerRecord | null;
  partner: PartnerState | null;
}

export async function loadDay(date: string): Promise<DayAnswers> {
  const [mine, theirs, partner] = await Promise.all([
    getAnswer(date, 'me'),
    getAnswer(date, 'them'),
    getPartnerState(date),
  ]);
  return { mine: mine ?? null, theirs: theirs ?? null, partner: partner ?? null };
}

/**
 * Write locally, then tell the courier. The UI updates from the local write and
 * never waits for the network — that is the whole point of the arrangement.
 */
export async function saveMyAnswer(date: string, questionId: string, text: string): Promise<AnswerRecord> {
  const trimmed = text.trim();
  const now = Date.now();
  const existing = await getAnswer(date, 'me');
  const record: AnswerRecord = {
    id: answerId(date, 'me'),
    date,
    questionId,
    author: 'me',
    text: trimmed,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    syncedAt: null,
  };
  await putAnswer(record);
  await enqueue({
    kind: 'answer',
    date,
    payload: { text: trimmed, questionId, updatedAt: now },
    queuedAt: now,
    attempts: 0,
    lastError: null,
  });
  if (syncEnabled()) void syncNow([date]).catch(() => undefined);
  return record;
}
