import { useState } from 'react';
import { useI18n } from '../i18n';
import { CITIES } from '../content/cities';
import { setPair, suggestSecret, type PairMember } from '../data/pair';
import { verifyPair } from '../data/api';

/**
 * Asked once per device, then never again.
 *
 * The passphrase is checked against the server before it is stored, so a typo
 * surfaces here instead of turning into a sync that silently never works.
 */
export function Lock({ onUnlocked }: { onUnlocked(): void }) {
  const { t } = useI18n();
  const [member, setMember] = useState<PairMember>('a');
  const [secret, setSecret] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'wrong' | 'offline'>('idle');

  const submit = async () => {
    const value = secret.trim();
    if (!value) return;
    setState('checking');
    try {
      if (await verifyPair(member, value)) {
        // The side chosen here *is* which city is yours — nothing else to store.
        setPair({ member, secret: value });
        onUnlocked();
      } else {
        setState('wrong');
      }
    } catch {
      // Could not reach the server at all — a wrong passphrase and a dead
      // connection must not look the same.
      setState('offline');
    }
  };

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <h1 className="screen__title">Rjadom · Рядом</h1>
      <p className="screen__note">{t('lock.intro')}</p>

      <div className="field">
        <span className="field__label">{t('lock.side')}</span>
        <div className="segment">
          {(['a', 'b'] as PairMember[]).map((id) => (
            <button
              key={id}
              className={id === member ? 'segment__item segment__item--active' : 'segment__item'}
              onClick={() => setMember(id)}
            >
              {CITIES[id === 'a' ? 'hamburg' : 'kaliningrad'].label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">{t('lock.passphrase')}</span>
        <input
          className="field__input"
          type="password"
          autoComplete="current-password"
          value={secret}
          onChange={(event) => {
            setSecret(event.target.value);
            setState('idle');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
        />
        <button className="button button--ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setSecret(suggestSecret())}>
          {t('lock.suggest')}
        </button>
      </div>

      {state === 'wrong' && <p className="screen__note">{t('lock.wrong')}</p>}
      {state === 'offline' && <p className="screen__note">{t('lock.offline')}</p>}

      <button className="button" onClick={() => void submit()} disabled={state === 'checking' || secret.trim() === ''}>
        {state === 'checking' ? t('lock.checking') : t('lock.unlock')}
      </button>

      <p className="hint">{t('lock.caveat')}</p>
    </div>
  );
}
