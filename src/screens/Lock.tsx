import { useState } from 'react';
import { useI18n, type Locale } from '../i18n';
import { DICTIONARIES } from '../i18n/strings';
import { setPair, suggestSecret } from '../data/pair';
import { verifyPair } from '../data/api';

/**
 * Asked once per device, then never again.
 *
 * There is no "which side are you" question any more. Each city has its own
 * passphrase, so the side follows from which one you type — the server answers
 * with it. That is why it cannot be changed in settings later: it is not a
 * preference, it is which key opened the door. It also closes a hole. While both
 * sides shared one passphrase the side was merely claimed in a header, so
 * anyone holding it could say "I am the other one" and read that person's answer
 * without writing their own.
 *
 * The screen opens in Russian. Both of you see it, only one of you needs the
 * English, and the toggle is right there — and what you pick here is what the
 * app speaks afterwards.
 */
export function Lock({ onUnlocked }: { onUnlocked(): void }) {
  const { locale, preference, setPreference } = useI18n();
  const [lockLocale, setLockLocale] = useState<Locale>(preference === 'system' ? 'ru' : locale);
  const [secret, setSecret] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'wrong' | 'offline'>('idle');

  const t = (key: string): string => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), DICTIONARIES[lockLocale]);
    return typeof value === 'string' ? value : key;
  };

  const pickLanguage = (next: Locale) => {
    setLockLocale(next);
    // Chosen here, kept for the whole app — nobody wants to answer this twice.
    setPreference(next);
  };

  const submit = async () => {
    const value = secret.trim();
    if (!value) return;
    setState('checking');
    try {
      const member = await verifyPair(value);
      if (member) {
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
      <div className="segment" style={{ alignSelf: 'flex-end' }}>
        {(['ru', 'en'] as Locale[]).map((id) => (
          <button
            key={id}
            className={id === lockLocale ? 'segment__item segment__item--active' : 'segment__item'}
            onClick={() => pickLanguage(id)}
            style={{ padding: '5px 12px', fontSize: 12 }}
          >
            {id === 'ru' ? 'Рус' : 'Eng'}
          </button>
        ))}
      </div>

      <h1 className="screen__title">Rjadom · Рядом</h1>
      <p className="screen__note" lang={lockLocale}>
        {t('lock.intro')}
      </p>

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
        <button
          className="button button--ghost"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setSecret(suggestSecret())}
        >
          {t('lock.suggest')}
        </button>
      </div>

      {state === 'wrong' && (
        <p className="screen__note" lang={lockLocale}>
          {t('lock.wrong')}
        </p>
      )}
      {state === 'offline' && (
        <p className="screen__note" lang={lockLocale}>
          {t('lock.offline')}
        </p>
      )}

      <button className="button" onClick={() => void submit()} disabled={state === 'checking' || secret.trim() === ''}>
        {state === 'checking' ? t('lock.checking') : t('lock.unlock')}
      </button>

      <p className="hint" lang={lockLocale}>
        {t('lock.caveat')}
      </p>
    </div>
  );
}
