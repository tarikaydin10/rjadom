import { useCallback, useEffect, useState } from 'react';
import { SkyBand } from '../components/SkyBand';
import { QuestionBlock } from '../components/QuestionBlock';
import { AnswerPair } from '../components/AnswerPair';
import { CountdownCard } from '../components/CountdownCard';
import { useI18n } from '../i18n';
import { useNow, useOnline, useSyncStatus, useWeather } from '../lib/hooks';
import { useSettings } from '../data/settings-context';
import { BAND_ORDER } from '../content/cities';
import { SLOTS, SLOT_MS, skyDay, slotOf, startOfLocalDay, statusFor } from '../sky/engine';
import { dateKey, dayNumber } from '../lib/day';
import { questionFor } from '../content/questions';
import { displayName } from '../data/settings';
import { loadDay, saveMyAnswer, type DayAnswers } from '../data/answers';
import { timeOfDay } from '../lib/format';
import { subscribeSync } from '../data/sync';

const EMPTY_DAY: DayAnswers = { mine: null, theirs: null, partner: null };

export function Today() {
  const { t, locale } = useI18n();
  const { settings } = useSettings();
  const now = useNow();
  const online = useOnline();
  const weather = useWeather();
  const sync = useSyncStatus();

  /** Null while the sky follows real time; a slot index while a drag holds it. */
  const [scrubSlot, setScrubSlot] = useState<number | null>(null);
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

  const table = skyDay(now);
  const slot = scrubSlot ?? slotOf(now);
  const row = table.rows[Math.min(SLOTS - 1, Math.max(0, slot))] ?? table.rows[0]!;
  const shownMs = scrubSlot === null ? now : startOfLocalDay(now) + scrubSlot * SLOT_MS;

  // Layout is geographic and identical on both devices; only the wording below
  // depends on which side of the sky the reader is standing on.
  const yourCity = settings.you.city;
  const partnerName = displayName(settings.partner.name, locale);

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
        ms={shownMs}
        leftCity={BAND_ORDER.left}
        rightCity={BAND_ORDER.right}
        weather={weather}
        onScrubTo={setScrubSlot}
        onScrubEnd={() => undefined}
      />

      <div className="status">
        <span className="status__text">{t(`sky.status.${statusFor(row, yourCity)}`)}</span>
        {scrubSlot === null ? (
          <span className="status__now" aria-hidden="true">
            {t('sky.now')}
          </span>
        ) : (
          <button className="status__now" onClick={() => setScrubSlot(null)}>
            {`${timeOfDay(shownMs, locale)} · ${t('sky.backToNow')}`}
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
