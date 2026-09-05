/**
 * One-time coach marks.
 *
 * A gesture that leaves no trace on the screen has to be named once — and only
 * once. A hint that never goes away stops being a hint and becomes furniture,
 * and the reader learns to look past exactly the spot you wanted them to read.
 *
 * Kept on the device rather than in settings, and deliberately not synced: this
 * is a fact about whether the person holding this phone has done the gesture
 * yet, not a preference the two of them share.
 */
const PREFIX = 'rjadom.learned.';

/** The scrub gesture on the sky band. */
export const SCRUB = 'scrub';

export function hasLearned(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === '1';
  } catch {
    // Storage refused — a private window, most likely. Better to show the hint
    // once a session than to hide it from someone who has never seen it; it
    // still goes away the moment the gesture is used.
    return false;
  }
}

export function markLearned(key: string): void {
  try {
    localStorage.setItem(PREFIX + key, '1');
  } catch {
    // Nothing to do. The hint reappears next launch, which is survivable.
  }
}
