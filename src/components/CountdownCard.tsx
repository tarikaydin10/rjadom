import { memo, useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { CITIES, type CityId } from '../content/cities';
import { dayAndMonth } from '../lib/format';
import { dateKeyToMs, isValidDateKey } from '../lib/day';
import { daysUntil, displayName, sidesFor } from '../data/settings';
import { useSettings } from '../data/settings-context';
import { getPair } from '../data/pair';

/**
 * The reunion, edited where it is read.
 *
 * It used to live in the settings screen, which was the wrong home twice over:
 * it is not a preference but a fact that changes whenever a flight moves, and a
 * card reading "not set" that does nothing when tapped is a dead end. Content
 * belongs to be edited where you look at it.
 *
 * It also used to be a black slab, permanently the loudest object on a warm
 * paper screen — and its most common state, by far, is that no date is booked
 * yet. So the biggest thing on the page was a prompt to do something. Its
 * weight now follows its meaning: a quiet line for a date that is months away
 * or not yet chosen, and a card once it is close enough to be an event. That
 * the card is there at all is then information, readable across a room.
 */

/** Where the reunion stops being a fact and starts being an event. */
const NEAR_DAYS = 30;

export const CountdownCard = memo(function CountdownCard() {
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
          className="field__input"
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
  const near = days !== null && days <= NEAR_DAYS;

  // Which of you travels is derived, not stored: the reunion city is one of the
  // two, and each device knows which side it is standing on.
  const sides = sidesFor(getPair()?.member ?? 'a', settings);

  const sentence = (): string => {
    if (!reunionDate) return t('countdown.unset');
    const imminent = days !== null && days <= 1;
    const when = dayAndMonth(dateKeyToMs(reunionDate), locale);
    return reunionCity === sides.yours
      ? t(imminent ? 'countdown.arrivesSoon' : 'countdown.arrives', {
          name: displayName(sides.partnerName, locale),
          date: when,
        })
      : /* The city keeps its own name here too, inside either language. */
        t(imminent ? 'countdown.youTravelSoon' : 'countdown.youTravel', {
          city: CITIES[reunionCity].label,
          date: when,
        });
  };

  return (
    <button className={near ? 'countdown countdown--near' : 'countdown'} onClick={() => setEditing(true)}>
      <span className="countdown__where">{sentence()}</span>

      {/* Two states, two different things to ask of the reader. With no date
          there is nothing to read and everything to do, so the right-hand slot
          holds an empty control waiting to be filled — a chip, not a field:
          this is a value you set, and it should not be mistaken for the answer
          card, which is a page you write on. With a date it is a fact to be
          read, and all it owes the reader is a quiet sign that it can still be
          changed. */}
      {days === null ? (
        <span className="countdown__action">{t('countdown.set')}</span>
      ) : (
        <span className="countdown__count">
          {days <= 0 ? (
            <span className="countdown__word">{t('countdown.today')}</span>
          ) : days === 1 ? (
            <span className="countdown__word">{t('countdown.tomorrow')}</span>
          ) : (
            <>
              <span className="countdown__number">{days}</span>
              {/* Russian needs день / дня / дней — Intl.PluralRules picks the form. */}
              <span className="countdown__unit">{tp('countdown.days', days)}</span>
            </>
          )}
          <svg className="countdown__more" width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true">
            <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </button>
  );
});
