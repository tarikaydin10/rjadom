import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { DAY_MS, PAIR_TIMEZONE, startOfPairDay } from '../lib/day';
import { toneAt } from '../sky/engine';
import { intlTag, useI18n } from '../i18n';
import { hasLearned, markLearned, SCRUB } from '../lib/learned';

interface Props {
  /** Real time, ticking. The rail's fixed point. */
  now: number;
  /** The moment being shown — equal to `now` while the sky is live. */
  ms: number;
  /** False while the sky is wound away from now. */
  live: boolean;
  /** How far the sky can be wound either way, from the caller. */
  limitMs: number;
  onScrubTo(ms: number): void;
  /**
   * Land on now and hand the sky back to the clock. Wound if there is a way to
   * travel — the light running back across both cities is the thing worth
   * watching — and instant when the rail is already sitting on the mark.
   */
  onNow(wind: boolean): void;
}

/**
 * One rail width is one day — deliberately the same scale as a drag across the
 * band above it. The rail is not a second control with a second feel; it is the
 * band's own gesture, made visible.
 */
const WINDOW_MS = DAY_MS;

/**
 * How much time is painted at once.
 *
 * The strip is one element carrying one gradient, and moving through time only
 * moves it — no repaint, no relayout, one composited transform. That is what
 * makes a scrub cost nothing. It is repainted only when time runs off the end
 * of what is drawn, which needs a comfortable margin either side of the day on
 * screen: six days gives two clear days of slack in both directions.
 */
const SPAN_DAYS = 6;
const SPAN_MS = SPAN_DAYS * DAY_MS;

/** Gradient resolution. Twenty minutes keeps a sunrise a sunrise. */
const SAMPLE_MS = 20 * 60 * 1000;

/** A hairline every three hours. */
const TICKS_PER_DAY = 8;

/** Movement below this is a tap, not a drag. */
const DRAG_THRESHOLD_PX = 4;

/**
 * How near the now mark counts as arriving at it.
 *
 * In pixels rather than minutes, because it is a target the thumb is aiming
 * for: half a minute of time is a quarter of a pixel and could never be hit,
 * while nine pixels is a comfortable detent that also lets go of the preview
 * and hands the sky back to the live clock.
 */
const DETENT_PX = 9;

/** Flick decay per frame at 60Hz, and the speed below which it has stopped. */
const FRICTION = 0.94;
const MIN_VELOCITY = 0.015;

/** Arrow keys move a half hour; with shift, or on a page key, a whole day. */
const KEY_STEP_MS = 30 * 60 * 1000;

/** How far the strip drifts when it introduces itself. */
const DEMO_PX = 34;

const anchorFor = (ms: number): number => Math.round((ms - SPAN_MS / 2) / (60 * 60 * 1000)) * (60 * 60 * 1000);

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Keep the drag on this element even when the finger leaves it.
 *
 * Guarded, because a pointer can be gone by the time we ask — a lifted finger,
 * a cancelled touch, a synthetic event in a test — and a throw here would take
 * down the gesture rather than the capture.
 */
function capture(element: Element, pointerId: number, on: boolean): void {
  try {
    if (on) element.setPointerCapture(pointerId);
    else if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // Without capture the drag still works while the pointer stays on the rail,
    // which is where it usually is.
  }
}

export function TimeRail({ now, ms, live, limitMs, onScrubTo, onNow }: Props) {
  const { t, locale } = useI18n();
  const [active, setActive] = useState(false);
  const [demoPx, setDemoPx] = useState(0);

  /**
   * The stretch of time currently painted. It follows the shown moment in long
   * jumps rather than continuously, so the gradient is rebuilt a few times a
   * session instead of a few times a second.
   */
  const [anchor, setAnchor] = useState(() => anchorFor(ms));
  useEffect(() => {
    if (ms < anchor + WINDOW_MS || ms > anchor + SPAN_MS - WINDOW_MS) setAnchor(anchorFor(ms));
  }, [ms, anchor]);

  const drag = useRef<{
    x: number;
    ms: number;
    width: number;
    engaged: boolean;
    /** The previous sample, for the flick that may follow. */
    lastX: number;
    lastAt: number;
    velocity: number;
  } | null>(null);
  /** The latest position, waiting for a frame — see `onPointerMove`. */
  const pending = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  /** A flick or a tap in flight. Cancelled the moment a finger lands. */
  const motion = useRef<number | null>(null);

  const stopMotion = () => {
    if (motion.current !== null) cancelAnimationFrame(motion.current);
    motion.current = null;
  };

  useEffect(
    () => () => {
      stopMotion();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /**
   * The strip introduces itself by moving.
   *
   * The gesture used to be named in a sentence laid over the sky, which is the
   * weakest kind of teaching: it explains a thing that is not there. A strip
   * that visibly slides and settles back says the same in less than two seconds
   * and needs no words in either language. It plays until the rail has actually
   * been used once, and never again after that.
   */
  const demo = useRef<number | null>(null);
  const stopDemo = () => {
    if (demo.current === null) return;
    cancelAnimationFrame(demo.current);
    demo.current = null;
    setDemoPx(0);
    setActive(false);
  };

  useEffect(() => {
    if (hasLearned(SCRUB)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const started = performance.now() + 700;
    const step = (frameAt: number) => {
      const progress = (frameAt - started) / 1600;
      if (progress >= 1) {
        stopDemo();
        return;
      }
      if (progress >= 0) {
        setActive(true);
        // Out and back, on a sine so both ends are still.
        setDemoPx(-Math.sin(progress * Math.PI) * DEMO_PX);
      }
      demo.current = requestAnimationFrame(step);
    };
    demo.current = requestAnimationFrame(step);
    return () => {
      if (demo.current !== null) cancelAnimationFrame(demo.current);
      demo.current = null;
    };
  }, []);

  /** The rail has been used. Whatever it was in the middle of saying, stop. */
  const learn = () => {
    stopDemo();
    if (!hasLearned(SCRUB)) markLearned(SCRUB);
  };

  /** Move there, or — if that is near enough to now — go home instead. */
  const settle = (value: number, width: number): boolean => {
    const detent = (DETENT_PX / width) * WINDOW_MS;
    if (Math.abs(value - Date.now()) < detent) {
      onNow(false);
      return true;
    }
    onScrubTo(value);
    return false;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    stopMotion();
    stopDemo();
    // A hand on the rail stops whatever it was doing, the way a hand on a
    // scrolling list does. The wind back to now is the caller's animation and
    // ends when it is told where to be; without this it would keep moving under
    // a finger that has already taken hold, and the drag would start from a
    // moment that had since gone.
    if (!live) onScrubTo(ms);
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      x: event.clientX,
      ms,
      width: rect.width,
      engaged: false,
      lastX: event.clientX,
      lastAt: event.timeStamp,
      velocity: 0,
    };
    setActive(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (!state.engaged) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      state.engaged = true;
      capture(event.currentTarget, event.pointerId, true);
      learn();
    }

    // Speed in pixels per millisecond, smoothed. A phone reports pointers
    // faster than it paints, so a single pair of samples is mostly noise and
    // the flick that follows would inherit all of it; a running average keeps
    // the direction the thumb actually had.
    const elapsed = Math.max(1, event.timeStamp - state.lastAt);
    const sample = (event.clientX - state.lastX) / elapsed;
    state.velocity = state.velocity * 0.6 + sample * 0.4;
    state.lastX = event.clientX;
    state.lastAt = event.timeStamp;

    // Right is later, the same convention as the band above: the strip slides
    // left under a fixed reading head, which is also the direction the sun
    // travels across the band as the day goes on. Everything moves one way.
    pending.current = state.ms + (dx / state.width) * WINDOW_MS;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pending.current !== null) onScrubTo(pending.current);
    });
  };

  /** Carry on after the finger, and slow down. */
  const fling = (from: number, velocity: number, width: number) => {
    let value = from;
    let speed = velocity;
    let last = performance.now();
    const step = (frameAt: number) => {
      const dt = Math.min(64, frameAt - last);
      last = frameAt;
      value += (speed / width) * WINDOW_MS * dt;
      speed *= FRICTION ** (dt / 16.67);
      const bounded = clamp(value, now - limitMs, now + limitMs);
      if (bounded !== value) {
        value = bounded;
        speed = 0;
      }
      if (settle(value, width)) return;
      if (Math.abs(speed) < MIN_VELOCITY) {
        motion.current = null;
        return;
      }
      motion.current = requestAnimationFrame(step);
    };
    motion.current = requestAnimationFrame(step);
  };

  /** Go there over a few frames. A jump loses the light crossing both cities. */
  const glide = (to: number, width: number) => {
    const from = ms;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      settle(to, width);
      return;
    }
    const started = performance.now();
    const duration = 420;
    const ease = (x: number) => 1 - (1 - x) ** 3;
    const step = (frameAt: number) => {
      const progress = Math.min(1, (frameAt - started) / duration);
      const value = from + (to - from) * ease(progress);
      if (progress >= 1) {
        motion.current = null;
        settle(to, width);
        return;
      }
      onScrubTo(value);
      motion.current = requestAnimationFrame(step);
    };
    motion.current = requestAnimationFrame(step);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    // The newest position, which may be a frame ahead of the rendered one.
    const landed = pending.current ?? ms;
    drag.current = null;
    pending.current = null;
    setActive(false);
    if (!state) return;
    capture(event.currentTarget, event.pointerId, false);

    if (!state.engaged) {
      // A tap is an aim: the strip goes to the spot that was touched.
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = event.clientX - (rect.left + rect.width / 2);
      if (Math.abs(offset) < 2) return;
      learn();
      glide(clamp(ms + (offset / rect.width) * WINDOW_MS, now - limitMs, now + limitMs), rect.width);
      return;
    }

    if (event.type === 'pointercancel') return;
    // A thumb that came to rest before lifting is not a flick, whatever the
    // last few samples said. Holding still is how you place something exactly.
    const stale = event.timeStamp - state.lastAt > 80;
    if (!stale && Math.abs(state.velocity) > MIN_VELOCITY) fling(landed, state.velocity, state.width);
    else settle(landed, state.width);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const wholeDay = event.shiftKey || event.key === 'PageUp' || event.key === 'PageDown';
    const step = wholeDay ? DAY_MS : KEY_STEP_MS;
    let direction = 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'PageUp') direction = 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'PageDown') direction = -1;

    if (direction === 0) {
      if (event.key !== 'Home' && event.key !== 'Escape') return;
      event.preventDefault();
      learn();
      stopMotion();
      onNow(true);
      return;
    }
    event.preventDefault();
    learn();
    stopMotion();
    const next = clamp(ms + direction * step, now - limitMs, now + limitMs);
    // No detent on the keys. The one on the rail is a thumb's aim — nine pixels
    // of slack, which is half an hour of time and would swallow every step an
    // arrow key can take. A key that asks for half an hour gets half an hour;
    // it lands on now only by stepping onto it or across it.
    if (!live && (next - now) * (ms - now) <= 0) onNow(false);
    else onScrubTo(next);
  };

  /**
   * The day, painted. Rebuilt only when the strip is re-anchored, which is a
   * few times a session — never while a finger is down.
   */
  const paint = useMemo(() => {
    const count = Math.round(SPAN_MS / SAMPLE_MS);
    const stops: string[] = [];
    for (let i = 0; i <= count; i++) {
      stops.push(`${toneAt(anchor + i * SAMPLE_MS)} ${((i / count) * 100).toFixed(3)}%`);
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, [anchor]);

  /** Where one day becomes the next, in the calendar the two of them share. */
  const boundaries = useMemo(() => {
    const format = new Intl.DateTimeFormat(intlTag(locale), {
      weekday: 'short',
      day: 'numeric',
      timeZone: PAIR_TIMEZONE,
    });
    const out: { at: number; label: string }[] = [];
    let at = startOfPairDay(anchor);
    while (at < anchor + SPAN_MS) {
      if (at > anchor) out.push({ at, label: format.format(new Date(at + DAY_MS / 2)) });
      // Half a day past the next midnight, so a clock change cannot overshoot it.
      at = startOfPairDay(at + DAY_MS * 1.5);
    }
    return out;
  }, [anchor, locale]);

  const at = (moment: number) => `${(((moment - anchor) / SPAN_MS) * 100).toFixed(4)}%`;

  /**
   * How far you have gone, in words.
   *
   * The one thing the band above cannot say. Two clocks reading 22:51 are the
   * same two clocks whether that is tonight or a week on Thursday, and the
   * whole point of winding the sky is to ask about a day that is not this one.
   *
   * The unit follows the distance: minutes while you are still in this hour,
   * hours while you are still in this day, days after that — "tomorrow" rather
   * than "in 19 hours", because by then the day is the thing you are asking
   * about. `Intl` owns the wording, so «завтра» and «через 3 дня» come out
   * right without a plural table to keep in step.
   */
  const relative = useMemo(() => new Intl.RelativeTimeFormat(intlTag(locale), { numeric: 'auto' }), [locale]);
  const days = Math.round((startOfPairDay(ms) - startOfPairDay(now)) / DAY_MS);
  const away = ms - now;
  const readout = live
    ? t('sky.now')
    : days !== 0
      ? relative.format(days, 'day')
      : Math.abs(away) < 45 * 60 * 1000
        ? relative.format(Math.round(away / 60000), 'minute')
        : relative.format(Math.round(away / (60 * 60 * 1000)), 'hour');

  const minutes = Math.round((ms - now) / 60000);
  const limitMinutes = Math.round(limitMs / 60000);

  return (
    <div className={`rail ${live ? '' : 'rail--away'}`} data-active={active || undefined}>
      <div className="rail__readout">
        <span className="rail__when">{readout}</span>
        {!live && (
          <button className="rail__back" onClick={() => onNow(true)}>
            {t('sky.backToNow')}
          </button>
        )}
      </div>

      <div
        className="rail__track"
        role="slider"
        tabIndex={0}
        aria-label={t('sky.railLabel')}
        aria-valuemin={-limitMinutes}
        aria-valuemax={limitMinutes}
        aria-valuenow={minutes}
        aria-valuetext={readout}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
      >
        <div
          className="rail__strip"
          style={
            {
              width: `${(SPAN_MS / WINDOW_MS) * 100}%`,
              backgroundImage: paint,
              transform: `translate(calc(${at(ms)} * -1 + ${demoPx.toFixed(1)}px), -50%)`,
              '--tick-period': `${100 / (SPAN_DAYS * TICKS_PER_DAY)}%`,
            } as CSSProperties
          }
        >
          <div className="rail__ticks" />
          {boundaries.map((day) => (
            <div key={day.at} className="rail__day" style={{ left: at(day.at) }}>
              <span className="rail__date">{day.label}</span>
            </div>
          ))}
          {/* Home, always in view: the ring the reading head is docked in at
              rest, and the place to aim for once the sky has been wound away. */}
          <span className="rail__anchor" style={{ left: at(now) }} />
        </div>

        <span className="rail__head" aria-hidden="true" />
      </div>
    </div>
  );
}
