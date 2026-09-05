import { useCallback, useEffect, useRef, useState } from 'react';
import { SkyBand } from '../components/SkyBand';
import { TimeRail } from '../components/TimeRail';
import { QuestionBlock } from '../components/QuestionBlock';
import { AnswerPair } from '../components/AnswerPair';
import { CountdownCard } from '../components/CountdownCard';
import { useI18n } from '../i18n';
import { useNow, useOnline, useSyncStatus, useWeather } from '../lib/hooks';
import { useSettings } from '../data/settings-context';
import { BAND_ORDER } from '../content/cities';
import { rowAt, skyDay, statusFor } from '../sky/engine';
import { dateKey, DAY_MS } from '../lib/day';
import { questionFor } from '../content/questions';
import { displayName, sidesFor } from '../data/settings';
import { getPair } from '../data/pair';
import { loadDay, saveMyAnswer, type DayAnswers } from '../data/answers';

import { subscribeSync } from '../data/sync';

const EMPTY_DAY: DayAnswers = { mine: null, theirs: null, partner: null };

/**
 * How far the sky can be wound. Sun and moon are arithmetic and would happily go
 * anywhere; the weather reaches seven days, and past a fortnight this stops
 * being a gesture and starts being a date picker.
 */
const SCRUB_LIMIT_MS = 14 * DAY_MS;

export function Today() {
  const { t, locale } = useI18n();
  const { settings } = useSettings();
  const now = useNow();
  const online = useOnline();
  const weather = useWeather();
  const sync = useSyncStatus();

  /** Null while the sky follows real time; a moment while a drag holds it. */
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [day, setDay] = useState<DayAnswers>(EMPTY_DAY);
  const [saving, setSaving] = useState(false);

  const today = dateKey(now);
  const question = questionFor(today);

  const refresh = useCallback(() => {
    void loadDay(today).then(setDay);
  }, [today]);

  useEffect(refresh, [refresh]);
  // Whatever the courier brings in — their answer, an acknowledgement — shows up
  // without the user doing anything.
  useEffect(() => subscribeSync(() => refresh()), [refresh]);

  const shownMs = scrubMs ?? now;
  const table = skyDay(shownMs);
  const row = rowAt(shownMs);

  const member = getPair()?.member ?? 'a';
  const sides = sidesFor(member, settings);
  const yourCity = sides.yours;
  const partnerName = displayName(sides.partnerName, locale);

  const scrubTo = (ms: number) => {
    cancelRewind();
    const limit = SCRUB_LIMIT_MS;
    setScrubMs(Math.min(now + limit, Math.max(now - limit, ms)));
  };

  /**
   * Coming back to now is a journey, not a jump.
   *
   * Snapping cuts from one sky to another and loses the one thing worth seeing:
   * the light running back across both cities. So it winds — longer for a longer
   * way, but never long enough to become a wait. A reader who has asked not to be
   * moved gets the jump instead.
   */
  const rewind = useRef<number | null>(null);
  const cancelRewind = () => {
    if (rewind.current !== null) cancelAnimationFrame(rewind.current);
    rewind.current = null;
  };

  const backToNow = (wind: boolean) => {
    cancelRewind();
    const from = scrubMs;
    if (from === null) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // The rail catches at now on its own, within about half an hour of it.
    // Winding back from there would be a journey of nine pixels, which is not a
    // journey — it is a stutter.
    if (!wind || reduced) {
      setScrubMs(null);
      return;
    }

    const started = performance.now();
    const distance = Math.abs(Date.now() - from);
    // A few hours winds back briskly; a fortnight takes a breath longer.
    const duration = Math.min(3500, 1000 + (distance / DAY_MS) * 500);
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

    const step = (frame: number) => {
      const progress = Math.min(1, (frame - started) / duration);
      // Aimed at the live clock, not a frozen one, so it lands on now rather
      // than on where now was when the finger lifted.
      setScrubMs(from + (Date.now() - from) * ease(progress));
      if (progress < 1) {
        rewind.current = requestAnimationFrame(step);
        return;
      }
      rewind.current = null;
      setScrubMs(null);
    };
    rewind.current = requestAnimationFrame(step);
  };

  useEffect(() => cancelRewind, []);


  // Stable across renders, so winding the sky does not re-render the answers.
  const onSave = useCallback(
    (text: string) => {
      setSaving(true);
      void saveMyAnswer(today, question.id, text)
        .then(refresh)
        .finally(() => setSaving(false));
    },
    [today, question.id, refresh],
  );

  const netline = (): string | null => {
    if (!online) return t('net.offline');
    if (sync.state === 'disabled') return null;
    if (sync.state === 'error') return t('net.syncFailed');
    if (sync.pending > 0) return t('settings.pendingItems', { count: sync.pending });
    return null;
  };

  const line = netline();

  return (
    <div className="screen-scroll">
      <SkyBand
        row={row}
        day={table}
        ms={shownMs}
        leftCity={BAND_ORDER.left}
        rightCity={BAND_ORDER.right}
        weather={weather}
        onScrubTo={scrubTo}
      />

      <TimeRail
        now={now}
        ms={shownMs}
        live={scrubMs === null}
        limitMs={SCRUB_LIMIT_MS}
        onScrubTo={scrubTo}
        onNow={backToNow}
      />

      <div className={`status ${scrubMs !== null ? 'status--preview' : ''}`}>
        <span className="status__text">{t(`sky.status.${statusFor(row, yourCity)}`)}</span>
      </div>

      {line && <div className="netline">{line}</div>}

      <div className="content">
        {/* The question and the two answers are one thing and are kept in one
            region — the kicker titles it, the band holds it. The reunion is a
            different subject and stays outside, on bare paper. */}
        <section className="daily" aria-label={t('question.kickerPlain')}>
          <QuestionBlock question={question} />
          <AnswerPair day={day} partnerName={partnerName} saving={saving} onSave={onSave} />
        </section>

        <CountdownCard />
      </div>
    </div>
  );
}
