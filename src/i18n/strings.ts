/**
 * Every user-facing string lives here, in English and Russian.
 *
 * The one deliberate exception is city names: "Hamburg" and "Калининград" each
 * stay in their own language whatever the interface language is (see
 * `src/content/cities.ts`). They are the two fixed points of the app and the
 * design names each city the way its own people write it.
 *
 * `en` is the source of truth for the shape; `ru` is type-checked against it,
 * so a missing or misspelled key is a build error, not a blank label.
 */

export type Plural = { one: string; few: string; many: string; other: string };

export const en = {
  tabs: { today: 'Today', map: 'Map', chronicle: 'Chronicle', us: 'Us' },

  sky: {
    // Deliberately genderless and name-free: the same build runs on both
    // phones, so "she"/"он" would be wrong on one of them half the time.
    status: {
      bothNight: 'Night for both of you',
      bothDay: 'Daylight for both of you',
      bothTwilight: 'Twilight for both of you',
      // Morning: one side is waiting for light. Evening: one side has lost it.
      partnerFirst: 'There is light there, none with you yet',
      youFirst: 'You have light, they do not yet',
      partnerLast: 'They still have light, you do not',
      youLast: 'You still have light, they do not',
    },
    sunrise: 'sunrise',
    sunset: 'sunset',
    polarDay: 'sun stays up',
    polarNight: 'sun stays down',
    now: 'now',
    backToNow: 'back to now',
    scrubHint: 'Drag across the sky to travel through the day',
    label: 'Sky above both cities',
  },

  weather: {
    unavailable: 'weather unavailable',
    stale: 'last update {time}',
    conditions: {
      clear: 'clear',
      mostlyClear: 'mostly clear',
      cloudy: 'cloudy',
      overcast: 'overcast',
      fog: 'fog',
      drizzle: 'drizzle',
      rain: 'rain',
      freezingRain: 'freezing rain',
      snow: 'snow',
      showers: 'showers',
      snowShowers: 'snow showers',
      thunderstorm: 'thunderstorm',
    },
  },

  question: {
    kickerPlain: 'Today',
    loading: 'Loading the question …',
  },

  answer: {
    you: 'You',
    placeholder: 'Tap to write …',
    hidden: 'Visible once you have written.',
    notYet: 'Has not written yet.',
    waiting: 'Waiting for your answer.',
    send: 'Send',
    cancel: 'Cancel',
    edit: 'Edit',
    pending: 'saved on this device',
    synced: 'sent',
    writtenAt: 'wrote at {time}',
  },

  countdown: {
    kicker: 'Reunion',
    // The number is rendered separately at 40px, so these are the unit alone.
    days: { one: 'day', few: 'days', many: 'days', other: 'days' } as Plural,
    today: 'today',
    unset: 'Tap to set a date',
  },

  net: {
    offline: 'Offline · your answers are saved on this device',
    syncing: 'Syncing …',
    syncFailed: 'Not synced yet — will retry',
    lastSync: 'Last sync {time}',
    never: 'never',
    localOnly: 'Local only — no sync server configured',
  },

  settings: {
    title: 'Us',
    language: 'Language',
    system: 'System',
    english: 'English',
    russian: 'Русский',
    names: 'Names',
    yourName: 'Your name',
    partnerName: 'Their name',
    reunion: 'Next reunion',
    reunionCity: 'City',
    sides: 'Sides',
    yourCity: 'You are in',
    storage: 'Data',
    pendingItems: '{count} change(s) waiting to sync',
    syncNow: 'Sync now',
    save: 'Save',
    saved: 'Saved',
    notSet: 'not set',
    device: 'This device',
    forget: 'Forget this device',
    forgetHint: 'Removes the passphrase from this device. Your answers stay on the server.',
    dayBoundary: 'The shared day starts at midnight in {tz}, so you both get the same question at the same moment.',
  },

  lock: {
    intro: 'A private page for two. Enter the shared passphrase once — this device will not ask again.',
    side: 'Which side is this device?',
    passphrase: 'Passphrase',
    unlock: 'Unlock',
    checking: 'Checking …',
    wrong: 'That passphrase does not match.',
    offline: 'No connection, so the passphrase cannot be checked right now. Try again once you are online.',
    suggest: 'Suggest a strong one',
    caveat: 'A lock, not encryption: whoever holds this phone unlocked can read the answers.',
  },

  soon: {
    map: 'The map comes later.',
    chronicle: 'The chronicle of your answers comes later.',
  },
} as const;

type DeepStringShape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends Plural ? Plural : DeepStringShape<T[K]>;
};

export const ru: DeepStringShape<typeof en> = {
  tabs: { today: 'Сегодня', map: 'Карта', chronicle: 'Хроника', us: 'Мы' },

  sky: {
    status: {
      bothNight: 'У вас обоих ночь',
      bothDay: 'У вас обоих светло',
      bothTwilight: 'У вас обоих сумерки',
      partnerFirst: 'Там уже светло, у тебя ещё нет',
      youFirst: 'У тебя уже светло, там ещё нет',
      partnerLast: 'Там ещё светло, у тебя уже нет',
      youLast: 'У тебя ещё светло, там уже нет',
    },
    sunrise: 'восход',
    sunset: 'закат',
    polarDay: 'солнце не заходит',
    polarNight: 'солнце не восходит',
    now: 'сейчас',
    backToNow: 'вернуться к сейчас',
    scrubHint: 'Проведи по небу, чтобы пройти день',
    label: 'Небо над обоими городами',
  },

  weather: {
    unavailable: 'погода недоступна',
    stale: 'обновлено {time}',
    conditions: {
      clear: 'ясно',
      mostlyClear: 'малооблачно',
      cloudy: 'облачно',
      overcast: 'пасмурно',
      fog: 'туман',
      drizzle: 'морось',
      rain: 'дождь',
      freezingRain: 'ледяной дождь',
      snow: 'снег',
      showers: 'ливень',
      snowShowers: 'снегопад',
      thunderstorm: 'гроза',
    },
  },

  question: {
    kickerPlain: 'Сегодня',
    loading: 'Загружаем вопрос …',
  },

  answer: {
    you: 'Ты',
    placeholder: 'Нажми, чтобы написать …',
    hidden: 'Появится, когда ты напишешь.',
    notYet: 'Ещё не написал(а).',
    waiting: 'Ждём твой ответ.',
    send: 'Отправить',
    cancel: 'Отмена',
    edit: 'Изменить',
    pending: 'сохранено на этом устройстве',
    synced: 'отправлено',
    writtenAt: 'написано в {time}',
  },

  countdown: {
    kicker: 'Встреча',
    days: { one: 'день', few: 'дня', many: 'дней', other: 'дня' },
    today: 'сегодня',
    unset: 'Нажми, чтобы выбрать дату',
  },

  net: {
    offline: 'Офлайн · ответы сохраняются на устройстве',
    syncing: 'Синхронизация …',
    syncFailed: 'Пока не синхронизировано — попробуем ещё раз',
    lastSync: 'Синхронизация {time}',
    never: 'никогда',
    localOnly: 'Только локально — сервер не настроен',
  },

  settings: {
    title: 'Мы',
    language: 'Язык',
    system: 'Системный',
    english: 'English',
    russian: 'Русский',
    names: 'Имена',
    yourName: 'Твоё имя',
    partnerName: 'Её или его имя',
    reunion: 'Следующая встреча',
    reunionCity: 'Город',
    sides: 'Стороны',
    yourCity: 'Ты в городе',
    storage: 'Данные',
    pendingItems: 'Ждут отправки: {count}',
    syncNow: 'Синхронизировать',
    save: 'Сохранить',
    saved: 'Сохранено',
    notSet: 'не выбрано',
    device: 'Это устройство',
    forget: 'Забыть это устройство',
    forgetHint: 'Пароль удалится с устройства. Ответы останутся на сервере.',
    dayBoundary: 'Общий день начинается в полночь по зоне {tz} — так вопрос у вас обоих меняется одновременно.',
  },

  lock: {
    intro: 'Личная страница на двоих. Введи общий пароль один раз — больше это устройство не спросит.',
    side: 'Какая сторона это устройство?',
    passphrase: 'Пароль',
    unlock: 'Войти',
    checking: 'Проверяем …',
    wrong: 'Пароль не подходит.',
    offline: 'Нет связи, пароль сейчас не проверить. Попробуй, когда появится интернет.',
    suggest: 'Предложить надёжный',
    caveat: 'Это замок, а не шифрование: кто держит разблокированный телефон, тот читает ответы.',
  },

  soon: {
    map: 'Карта появится позже.',
    chronicle: 'Хроника ваших ответов появится позже.',
  },
};

export type Strings = typeof en;
export type Locale = 'en' | 'ru';

export const DICTIONARIES: Record<Locale, DeepStringShape<Strings>> = { en, ru };
