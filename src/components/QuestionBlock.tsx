import { memo } from 'react';
import { useI18n } from '../i18n';
import { questionText, type Question } from '../content/questions';

interface Props {
  question: Question;
}

/**
 * Both languages, always.
 *
 * The design put two languages under each other on purpose: two people, two
 * mother tongues, one question. That survives the move from German/Russian to
 * English/Russian — the reader's language is the large line, the other one sits
 * under it. It is also what makes the screen work when the two of them are
 * looking at it together.
 *
 * Memoised, along with the rest of the page below the band: winding the sky
 * through a fortnight changes nothing here, and re-rendering it on every frame
 * of that gesture is what a scrub cannot afford.
 */
export const QuestionBlock = memo(function QuestionBlock({ question }: Props) {
  const { t, locale, other } = useI18n();

  return (
    <div className="question">
      <span className="question__kicker">{t('question.kickerPlain')}</span>
      <span className="question__primary" lang={locale}>
        {questionText(question, locale)}
      </span>
      <span className="question__secondary" lang={other}>
        {questionText(question, other)}
      </span>
    </div>
  );
});
