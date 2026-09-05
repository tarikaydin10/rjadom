/**
 * The rename, carried across.
 *
 * The app was Rjadom and is Ryadom, and the old spelling was not only on the
 * lock screen — it was the prefix on every key this device had stored. Renaming
 * those without moving what they hold would be a silent, personal kind of data
 * loss: both phones back at the passphrase screen, and an answer written on a
 * train still sitting in an outbox nobody opens any more.
 *
 * So the keys move, once, with their contents. Nothing is left behind under the
 * old name afterwards, which is the point — the old spelling is gone from the
 * device as well as from the source.
 *
 * This is a one-way step and it is meant to be deleted eventually. It costs a
 * handful of synchronous storage reads on a launch that has nothing to carry,
 * which is every launch after the first.
 */

const OLD = 'rjadom';
const NEW = 'ryadom';

/**
 * Everything in `localStorage`: the passphrase, the language, the coach marks.
 *
 * Synchronous and called before the first render, because the pair credentials
 * and the language are both read while the first frame is being built — a
 * promise here would put the lock screen in front of someone who is already
 * unlocked, which is exactly the moment the migration was supposed to prevent.
 */
export function carryOverStorage(): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(`${OLD}.`)) stale.push(key);
    }

    for (const key of stale) {
      const renamed = NEW + key.slice(OLD.length);
      // Never over-write something already stored under the new name: a device
      // that has been used since the rename is ahead of whatever is left here.
      if (localStorage.getItem(renamed) === null) {
        const value = localStorage.getItem(key);
        if (value !== null) localStorage.setItem(renamed, value);
      }
      localStorage.removeItem(key);
    }
  } catch {
    // Storage refused — a private window. Nothing to carry and nothing to lose;
    // the app behaves as it does on a device it has never seen before.
  }

  // The forecast's runtime cache is named after the app too. It holds nothing
  // that cannot be fetched again, so it is dropped rather than moved.
  void caches?.delete(`${OLD}-weather`).catch(() => {});
}
