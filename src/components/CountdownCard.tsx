import { useI18n } from '../i18n';
import { CITIES, type CityId } from '../content/cities';
import { dayAndMonth } from '../lib/format';
import { dateKeyToMs } from '../lib/day';
import { daysUntil } from '../data/settings';

interface Props {
  date: string | null;
  city: CityId;
}

export function CountdownCard({ date, city }: Props) {
  const { t, tp, locale } = useI18n();

  if (!date) {
    return (
      <div className="countdown">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="countdown__kicker">{t('countdown.kicker')}</span>
          <span className="countdown__where">{t('settings.notSet')}</span>
        </div>
      </div>
    );
  }

  const days = daysUntil(date);

  return (
    <div className="countdown">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="countdown__kicker">{t('countdown.kicker')}</span>
        {/* The city keeps its own name here too. */}
        <span className="countdown__where">{`${dayAndMonth(dateKeyToMs(date), locale)} · ${CITIES[city].label}`}</span>
      </div>
      {days <= 0 ? (
        <span className="countdown__number">{t('countdown.today')}</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="countdown__number">{days}</span>
          {/* Russian needs день / дня / дней — Intl.PluralRules picks the form. */}
          <span className="countdown__unit">{tp('countdown.days', days)}</span>
        </div>
      )}
    </div>
  );
}
