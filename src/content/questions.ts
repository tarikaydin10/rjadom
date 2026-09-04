import { dateKeyToMs } from '../lib/day';
import type { Locale } from '../i18n';

/**
 * The questions ship with the app.
 *
 * They could have come from the server, but then the most important element of
 * the home screen would be the one thing that fails without a connection. Bundled,
 * the question of the day is always there — on a plane, in a dead spot, on a
 * phone that has not synced in a week. Both devices derive the same question from
 * the same shared date key, so the two of them are never answering different
 * questions.
 */
export interface Question {
  id: string;
  en: string;
  ru: string;
}

export const QUESTIONS: Question[] = [
  { id: 'q001', en: 'What made you laugh today?', ru: 'Что тебя сегодня рассмешило?' },
  { id: 'q002', en: 'What did the sky look like where you are?', ru: 'Какое сегодня у тебя было небо?' },
  { id: 'q003', en: 'What small thing went right today?', ru: 'Что маленькое сегодня получилось?' },
  { id: 'q004', en: 'Who did you talk to today that you did not expect to?', ru: 'С кем ты сегодня неожиданно поговорил(а)?' },
  { id: 'q005', en: 'What are you putting off?', ru: 'Что ты откладываешь?' },
  { id: 'q006', en: 'What did you eat that was worth it?', ru: 'Что ты сегодня ел(а), и это стоило того?' },
  { id: 'q007', en: 'What song stayed with you today?', ru: 'Какая песня осталась с тобой сегодня?' },
  { id: 'q008', en: 'Where did you walk today?', ru: 'Где ты сегодня гулял(а)?' },
  { id: 'q009', en: 'What do you want to show me when we are in the same room?', ru: 'Что ты хочешь мне показать, когда мы будем в одной комнате?' },
  { id: 'q010', en: 'What was the first thing you thought about this morning?', ru: 'О чём ты подумал(а) утром первым делом?' },
  { id: 'q011', en: 'What are you tired of?', ru: 'От чего ты устал(а)?' },
  { id: 'q012', en: 'What did you notice today that you usually walk past?', ru: 'Что ты сегодня заметил(а), мимо чего обычно проходишь?' },
  { id: 'q013', en: 'What would you do with a free afternoon tomorrow?', ru: 'Что бы ты сделал(а) со свободным завтрашним днём?' },
  { id: 'q014', en: 'What did someone say to you today that stuck?', ru: 'Чьи слова сегодня у тебя остались в голове?' },
  { id: 'q015', en: 'What smells like home to you right now?', ru: 'Что для тебя сейчас пахнет домом?' },
  { id: 'q016', en: 'What are you looking forward to this week?', ru: 'Чего ты ждёшь на этой неделе?' },
  { id: 'q017', en: 'What was hard today?', ru: 'Что сегодня было трудно?' },
  { id: 'q018', en: 'What did you learn this week?', ru: 'Что ты узнал(а) на этой неделе?' },
  { id: 'q019', en: 'What do you miss that is not a person?', ru: 'По чему ты скучаешь, если не считать людей?' },
  { id: 'q020', en: 'What would you like me to ask you more often?', ru: 'О чём мне стоит спрашивать тебя чаще?' },
  { id: 'q021', en: 'What is the last thing you took a photo of?', ru: 'Что ты фотографировал(а) в последний раз?' },
  { id: 'q022', en: 'What were you wrong about lately?', ru: 'В чём ты недавно ошибался(ась)?' },
  { id: 'q023', en: 'What does your window show right now?', ru: 'Что сейчас видно из твоего окна?' },
  { id: 'q024', en: 'What are you proud of that nobody noticed?', ru: 'Чем ты гордишься, хотя никто не заметил?' },
  { id: 'q025', en: 'What would make tomorrow easier?', ru: 'Что сделало бы завтрашний день легче?' },
  { id: 'q026', en: 'What do you want to do first when we meet?', ru: 'Что ты хочешь сделать первым, когда мы встретимся?' },
  { id: 'q027', en: 'What did you postpone that you should just do?', ru: 'Что ты откладываешь, хотя стоило бы просто сделать?' },
  { id: 'q028', en: 'What was quiet and good today?', ru: 'Что сегодня было тихим и хорошим?' },
  { id: 'q029', en: 'Who do you owe a message?', ru: 'Кому ты должен(а) написать?' },
  { id: 'q030', en: 'What are you reading or watching?', ru: 'Что ты сейчас читаешь или смотришь?' },
  { id: 'q031', en: 'What did the weather do to your mood today?', ru: 'Как погода сегодня повлияла на твоё настроение?' },
  { id: 'q032', en: 'What is one thing you would change about today?', ru: 'Что бы ты изменил(а) в сегодняшнем дне?' },
  { id: 'q033', en: 'What did you buy or almost buy?', ru: 'Что ты купил(а) или почти купил(а)?' },
  { id: 'q034', en: 'What made you impatient today?', ru: 'Что сегодня выводило тебя из терпения?' },
  { id: 'q035', en: 'Which room in your day was the best one?', ru: 'В какой комнате сегодня было лучше всего?' },
  { id: 'q036', en: 'What do you want to remember from this month?', ru: 'Что ты хочешь запомнить из этого месяца?' },
  { id: 'q037', en: 'What did you do just for yourself today?', ru: 'Что ты сегодня сделал(а) только для себя?' },
  { id: 'q038', en: 'What is on your desk right now?', ru: 'Что сейчас лежит у тебя на столе?' },
  { id: 'q039', en: 'When did you last feel completely calm?', ru: 'Когда ты в последний раз был(а) совершенно спокоен (спокойна)?' },
  { id: 'q040', en: 'What are you avoiding thinking about?', ru: 'О чём ты стараешься не думать?' },
  { id: 'q041', en: 'What was the best five minutes of today?', ru: 'Какие пять минут сегодня были лучшими?' },
  { id: 'q042', en: 'What would you cook for me tonight?', ru: 'Что бы ты приготовил(а) для меня сегодня вечером?' },
  { id: 'q043', en: 'What did you almost say today and did not?', ru: 'Что ты сегодня почти сказал(а), но не сказал(а)?' },
  { id: 'q044', en: 'What is getting better?', ru: 'Что становится лучше?' },
  { id: 'q045', en: 'What sound do you hear most often where you live?', ru: 'Какой звук ты чаще всего слышишь там, где живёшь?' },
  { id: 'q046', en: 'What do you want more of next week?', ru: 'Чего ты хочешь больше на следующей неделе?' },
  { id: 'q047', en: 'Who did you think about today?', ru: 'О ком ты сегодня думал(а)?' },
  { id: 'q048', en: 'What is the smallest thing that would make you happy tomorrow?', ru: 'Какая самая маленькая вещь порадовала бы тебя завтра?' },
  { id: 'q049', en: 'What did you say no to recently?', ru: 'Чему ты недавно сказал(а) «нет»?' },
  { id: 'q050', en: 'What feels unfinished right now?', ru: 'Что сейчас кажется незаконченным?' },
  { id: 'q051', en: 'What was the last kind thing someone did for you?', ru: 'Что доброго для тебя недавно сделали?' },
  { id: 'q052', en: 'What are you carrying around that you could put down?', ru: 'Что ты носишь с собой, хотя мог(ла) бы отпустить?' },
  { id: 'q053', en: 'What do you wish I understood better?', ru: 'Что бы ты хотел(а), чтобы я понимал(а) лучше?' },
  { id: 'q054', en: 'What was today in three words?', ru: 'Каким был сегодняшний день в трёх словах?' },
  { id: 'q055', en: 'What place do you want us to see together?', ru: 'Какое место ты хочешь увидеть вместе?' },
  { id: 'q056', en: 'What made the distance smaller today?', ru: 'Что сегодня сделало расстояние меньше?' },
];

/**
 * Deterministic and stable: the same date gives the same question on both
 * phones, without either of them asking a server.
 */
export function questionFor(date: string): Question {
  const days = Math.floor(dateKeyToMs(date) / 86400000);
  const index = ((days % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length;
  return QUESTIONS[index] ?? QUESTIONS[0]!;
}

export function questionText(question: Question, locale: Locale): string {
  return locale === 'ru' ? question.ru : question.en;
}
