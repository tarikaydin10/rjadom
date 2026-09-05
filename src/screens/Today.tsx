import { useCallback, useEffect, useState } from 'react';
import { SkyBand } from '../components/SkyBand';
import { QuestionBlock } from '../components/QuestionBlock';
import { AnswerPair } from '../components/AnswerPair';
import { CountdownCard } from '../components/CountdownCard';
import { useI18n } from '../i18n';
import { useNow, useOnline, useSyncStatus, useWeather } from '../lib/hooks';
import { useSettings } from '../data/settings-context';
import { BAND_ORDER } from '../content/cities';
import { skyDay, slotOf, statusFor } from '../sky/engine';
import { dateKey, dayNumber } from '../lib/day';
import { questionFor } from '../content/questions';
import { displayName, sidesFor } from '../data/settings';
import { getPair } from '../data/pair';
import { loadDay, saveMyAnswer, type DayAnswers } from '../data/answers';
import { dayAndMonth, timeOfDay } from '../lib/format';
import { subscribeSync } from '../data/sync';

const EMPTY_DAY: DayAnswers = { mine: null, theirs: null, partner: null };

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
  const row = table.rows[slotOf(shownMs)] ?? table.rows[0]!;
  const scrubbedToAnotherDay = scrubMs !== null && dateKey(shownMs) !== today;

  /**
   * How far the sky can be wound. Sun and moon are arithmetic and would happily
   * go anywhere; the weather reaches seven days, and past a fortnight this stops
   * being a gesture and starts being a date picker.
   */
  const scrubTo = (ms: number) => {
    const limit = 14 * 24 * 60 * 60 * 1000;
    setScrubMs(Math.min(now + limit, Math.max(now - limit, ms)));
  };

  // Layout is geographic and identical on both devices; only the wording below
  // depends on which side of the sky the reader is standing on — and that comes
  // from the side chosen at unlock, so it cannot drift.
  const member = getPair()?.member ?? 'a';
  const sides = sidesFor(member, settings);
  const yourCity = sides.yours;
  const partnerName = displayName(sides.partnerName, locale);

  const onSave = (text: string) => {
    setSaving(true);
    void saveMyAnswer(today, question.id, text)
      .then(refresh)
      .finally(() => setSaving(false));
  };

  const netline = (): string | null => {
    if (!online) return t('net.offline');
    if (sync.state === 'disabled') return null;
    if (sync.state === 'error') return t('net.syncFailed');
    if (sync.pending > 0) return t('settings.pendingItems', { count: sync.pending });
    return null;
  };

  const line = netline();

  return (
    <>
      <SkyBand
        row={row}
        day={table}
        ms={shownMs}
        leftCity={BAND_ORDER.left}
        rightCity={BAND_ORDER.right}
        weather={weather}
        onScrubTo={scrubTo}
        onScrubEnd={() => undefined}
      />

      <div className="status">
        <span className="status__text">{t(`sky.status.${statusFor(row, yourCity)}`)}</span>
        {scrubMs === null ? (
          <span className="status__now" aria-hidden="true">
            {t('sky.now')}
          </span>
        ) : (
          <button className="status__now" onClick={() => setScrubMs(null)}>
            {`${scrubbedToAnotherDay ? `${dayAndMonth(shownMs, locale)} ` : ''}${timeOfDay(shownMs, locale)} · ${t('sky.backToNow')}`}
          </button>
        )}
      </div>

      {line && <div className="netline">{line}</div>}

      <div className="content">
        <QuestionBlock
          question={question}
          day={settings.startDate ? dayNumber(settings.startDate, today) : null}
        />
        <AnswerPair day={day} partnerName={partnerName} saving={saving} onSave={onSave} />
        <CountdownCard date={settings.reunion.date} city={settings.reunion.city} />
      </div>
    </>
  );
}
