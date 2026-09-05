import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { CITIES, type CityId } from '../content/cities';
import { dayAndMonth } from '../lib/format';
import { dateKeyToMs, isValidDateKey } from '../lib/day';
import { daysUntil } from '../data/settings';
import { useSettings } from '../data/settings-context';

/**
 * The reunion, edited where it is read.
 *
 * It used to live in the settings screen, which was the wrong home twice over:
 * it is not a preference but a fact that changes whenever a flight moves, and a
 * card reading "not set" that does nothing when tapped is a dead end. Content
 * belongs to be edited where you look at it.
 */
export function CountdownCard() {
  const { t, tp, locale } = useI18n();
  const { settings, update } = useSettings();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(settings.reunion.date ?? '');
  const [city, setCity] = useState<CityId>(settings.reunion.city);

  useEffect(() => {
    setDate(settings.reunion.date ?? '');
    setCity(settings.reunion.city);
  }, [settings.reunion.date, settings.reunion.city]);

  const commit = () => {
    void update({
      ...settings,
      reunion: { date: date && isValidDateKey(date) ? date : null, city },
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="countdown countdown--editing">
        <span className="countdown__kicker">{t('settings.reunion')}</span>
        <input
          className="field__input countdown__input"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          autoFocus
        />
        <div className="segment">
          {(Object.keys(CITIES) as CityId[]).map((id) => (
            <button
              key={id}
              className={id === city ? 'segment__item segment__item--active' : 'segment__item'}
              onClick={() => setCity(id)}
            >
              {CITIES[id].label}
            </button>
          ))}
        </div>
        <div className="answer__actions">
          <button className="button" onClick={commit}>
            {t('settings.save')}
          </button>
          <button className="button button--ghost" onClick={() => setEditing(false)}>
            {t('answer.cancel')}
          </button>
        </div>
      </div>
    );
  }

  const { date: reunionDate, city: reunionCity } = settings.reunion;
  const days = reunionDate ? daysUntil(reunionDate) : null;

  return (
    <button className="countdown" onClick={() => setEditing(true)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
        <span className="countdown__kicker">{t('countdown.kicker')}</span>
        <span className="countdown__where">
          {reunionDate
            ? /* The city keeps its own name here too. */
              `${dayAndMonth(dateKeyToMs(reunionDate), locale)} · ${CITIES[reunionCity].label}`
            : t('countdown.unset')}
        </span>
      </div>
      {days !== null &&
        (days <= 0 ? (
          <span className="countdown__number">{t('countdown.today')}</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="countdown__number">{days}</span>
            {/* Russian needs день / дня / дней — Intl.PluralRules picks the form. */}
            <span className="countdown__unit">{tp('countdown.days', days)}</span>
          </div>
        ))}
    </button>
  );
}
