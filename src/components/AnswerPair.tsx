import { memo, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { clock } from '../lib/format';
import { PAIR_TIMEZONE } from '../lib/day';
import type { DayAnswers } from '../data/answers';

interface Props {
  day: DayAnswers;
  partnerName: string;
  saving: boolean;
  onSave(text: string): void;
}

/**
 * The lock-in: their answer appears only once yours exists.
 *
 * The bars below are empty elements, not their words behind a filter. The
 * plaintext of a locked answer is never delivered to this device — the server
 * withholds it (see `server/index.js`), so there is nothing here to reveal with
 * a devtools inspector. What is shown before unlocking is only what is fair to
 * show: that they wrote, and when.
 */
export const AnswerPair = memo(function AnswerPair({ day, partnerName, saving, onSave }: Props) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const editor = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) editor.current?.focus();
  }, [editing]);

  const mine = day.mine;
  const theirs = day.theirs;
  const partnerAnswered = day.partner?.answered ?? theirs !== null;
  const partnerAt = theirs?.createdAt ?? day.partner?.answeredAt ?? null;

  const beginEdit = () => {
    setDraft(mine?.text ?? '');
    setEditing(true);
  };

  const commit = () => {
    const text = draft.trim();
    if (!text) {
      setEditing(false);
      return;
    }
    onSave(text);
    setEditing(false);
  };

  /**
   * An empty card is an invitation, and it used to look like a blank one.
   * Until something has been written it carries the terracotta of every other
   * control on the page — more insistent still once she has written and her
   * answer is sitting there waiting to be unlocked.
   */
  const mineClass = [
    'answer answer--mine',
    !mine && !editing ? 'answer--empty' : '',
    !mine && !editing && partnerAnswered ? 'answer--urgent' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="answers">
      <div className={mineClass}>
        <span className="answer__label">{t('answer.you')}</span>

        {editing ? (
          <>
            <textarea
              ref={editor}
              className="answer__editor"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('answer.placeholder')}
              aria-label={t('answer.you')}
            />
            <div className="answer__actions">
              <button className="button" onClick={commit} disabled={saving || draft.trim().length === 0}>
                {t('answer.send')}
              </button>
              <button className="button button--ghost" onClick={() => setEditing(false)}>
                {t('answer.cancel')}
              </button>
            </div>
          </>
        ) : mine ? (
          <>
            <p className="answer__text">{mine.text}</p>
            <div className="answer__spacer" />
            <button className="button button--ghost answer__edit" onClick={beginEdit}>
              {t('answer.edit')}
            </button>
            <span className="answer__foot">{mine.syncedAt ? t('answer.synced') : t('answer.pending')}</span>
          </>
        ) : (
          <button className="answer__placeholder answer__prompt" onClick={beginEdit}>
            {partnerAnswered ? t('answer.placeholderUrgent') : t('answer.placeholder')}
          </button>
        )}
      </div>

      <div className="answer answer--theirs">
        <span className="answer__label">
          {partnerName}
          {partnerAt !== null ? ` · ${clock(partnerAt, PAIR_TIMEZONE, locale)}` : ''}
        </span>

        {theirs ? (
          <p className="answer__text">{theirs.text}</p>
        ) : partnerAnswered ? (
          <>
            <span className="answer__bar" aria-hidden="true" />
            <span className="answer__bar answer__bar--short" aria-hidden="true" />
          </>
        ) : (
          <span className="answer__placeholder">{t('answer.notYet')}</span>
        )}

        <div className="answer__spacer" />
        {!theirs && <span className="answer__foot">{partnerAnswered ? t('answer.hidden') : t('answer.waiting')}</span>}
      </div>
    </div>
  );
});
