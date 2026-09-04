import { useEffect, useState } from 'react';
import { useI18n, type LocalePreference } from '../i18n';
import { useSettings } from '../data/settings-context';
import { clearPair, getPair } from '../data/pair';
import { cityOf } from '../data/settings';
import { syncConfigured } from '../data/api';
import { syncNow } from '../data/sync';
import { useSyncStatus } from '../lib/hooks';
import { CITIES, type CityId } from '../content/cities';
import { PAIR_TIMEZONE, isValidDateKey } from '../lib/day';
import { timeOfDay } from '../lib/format';
import type { Settings } from '../data/settings';

/**
 * The settings screen, and the reason the language requirement is met in full:
 * the system language decides by default, and this is where that can be
 * overridden — per device, permanently.
 */
export function Us() {
  const { t, locale, preference, setPreference } = useI18n();
  const { settings, update } = useSettings();
  const sync = useSyncStatus();
  const pair = getPair();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const patch = (next: Partial<Settings>) => {
    setDraft((current) => ({ ...current, ...next }));
    setSaved(false);
  };

  const commit = () => {
    void update({
      ...draft,
      startDate: draft.startDate && isValidDateKey(draft.startDate) ? draft.startDate : null,
      reunion: {
        ...draft.reunion,
        date: draft.reunion.date && isValidDateKey(draft.reunion.date) ? draft.reunion.date : null,
      },
    }).then(() => setSaved(true));
  };

  const languages: { id: LocalePreference; label: string }[] = [
    { id: 'system', label: t('settings.system') },
    { id: 'en', label: t('settings.english') },
    { id: 'ru', label: t('settings.russian') },
  ];

  const cityChoice = (value: CityId, onPick: (city: CityId) => void) => (
    <div className="segment">
      {(Object.keys(CITIES) as CityId[]).map((id) => (
        <button
          key={id}
          className={id === value ? 'segment__item segment__item--active' : 'segment__item'}
          onClick={() => onPick(id)}
        >
          {CITIES[id].label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="screen">
      <h1 className="screen__title">{t('settings.title')}</h1>

      <div className="section">
        <span className="section__title">{t('settings.language')}</span>
        <div className="segment">
          {languages.map((option) => (
            <button
              key={option.id}
              className={option.id === preference ? 'segment__item segment__item--active' : 'segment__item'}
              onClick={() => setPreference(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <span className="section__title">{t('settings.names')}</span>
        {/* Keyed by city, not by "you" and "them": the same settings are read on
            both phones, and each of you is "you" on your own. */}
        {(Object.keys(CITIES) as CityId[]).map((id) => (
          <div className="field" key={id}>
            <span className="field__label">
              {CITIES[id].label}
              {pair && id === cityOf(pair.member) ? ` · ${t('answer.you')}` : ''}
            </span>
            <div className="field__row">
              <input
                className="field__input"
                value={draft.names[id].latin}
                onChange={(e) =>
                  patch({ names: { ...draft.names, [id]: { ...draft.names[id], latin: e.target.value } } })
                }
                placeholder={id === 'hamburg' ? 'Tarik' : 'Mila'}
                lang="en"
              />
              <input
                className="field__input"
                value={draft.names[id].cyrillic}
                onChange={(e) =>
                  patch({ names: { ...draft.names, [id]: { ...draft.names[id], cyrillic: e.target.value } } })
                }
                placeholder={id === 'hamburg' ? 'Тарик' : 'Мила'}
                lang="ru"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <span className="section__title">{t('settings.dates')}</span>
        <div className="field">
          <span className="field__label">{t('settings.since')}</span>
          <input
            className="field__input"
            type="date"
            value={draft.startDate ?? ''}
            onChange={(e) => patch({ startDate: e.target.value || null })}
          />
        </div>
        <div className="field">
          <span className="field__label">{t('settings.reunion')}</span>
          <input
            className="field__input"
            type="date"
            value={draft.reunion.date ?? ''}
            onChange={(e) => patch({ reunion: { ...draft.reunion, date: e.target.value || null } })}
          />
        </div>
        <div className="field">
          <span className="field__label">{t('settings.reunionCity')}</span>
          {cityChoice(draft.reunion.city, (city) => patch({ reunion: { ...draft.reunion, city } }))}
        </div>
        <p className="hint">{t('settings.dayBoundary', { tz: PAIR_TIMEZONE })}</p>
      </div>

      <div className="section">
        <span className="section__title">{t('settings.storage')}</span>
        <p className="hint">
          {!syncConfigured
            ? t('net.localOnly')
            : sync.lastSyncAt
              ? t('net.lastSync', { time: timeOfDay(sync.lastSyncAt, locale) })
              : t('net.lastSync', { time: t('net.never') })}
        </p>
        {sync.pending > 0 && <p className="hint">{t('settings.pendingItems', { count: sync.pending })}</p>}
        {syncConfigured && (
          <button className="button button--ghost" style={{ alignSelf: 'flex-start' }} onClick={() => void syncNow()}>
            {t('settings.syncNow')}
          </button>
        )}
      </div>

      {pair && (
        <div className="section">
          <span className="section__title">{t('settings.device')}</span>
          <p className="hint">{CITIES[pair.member === 'a' ? 'hamburg' : 'kaliningrad'].label}</p>
          <p className="hint">{t('settings.forgetHint')}</p>
          <button className="button button--ghost" style={{ alignSelf: 'flex-start' }} onClick={clearPair}>
            {t('settings.forget')}
          </button>
        </div>
      )}

      <div className="answer__actions">
        <button className="button" onClick={commit}>
          {t('settings.save')}
        </button>
        {saved && <span className="answer__foot">{t('settings.saved')}</span>}
      </div>
    </div>
  );
}
