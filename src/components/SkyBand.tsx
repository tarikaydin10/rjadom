import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CITIES, type CityId } from '../content/cities';
import { SLOTS, type SkyRow } from '../sky/engine';
import { nextEvent } from '../sky/notes';
import { conditionKey, observationAt, type WeatherCache } from '../weather/openmeteo';
import { clock, roundTemp } from '../lib/format';
import { useI18n } from '../i18n';

const STARS = [
  { left: '47%', top: 64, size: 3, opacity: 1 },
  { left: '53%', top: 86, size: 2, opacity: 0.7 },
  { left: '50%', top: 106, size: 2, opacity: 0.5 },
  { left: '12%', top: 122, size: 2, opacity: 0.55 },
  { left: '88%', top: 116, size: 2, opacity: 0.5 },
];

interface Props {
  row: SkyRow;
  /** Both cities keep fixed sides — see BAND_ORDER in `content/cities.ts`. */
  /** The moment being shown — real time, or wherever the drag has landed. */
  ms: number;
  leftCity: CityId;
  rightCity: CityId;
  weather: WeatherCache | undefined;
  onScrubTo(slot: number): void;
  onScrubEnd(): void;
}

/** Movement below this is a tap, not a scrub. */
const DRAG_THRESHOLD_PX = 6;

export function SkyBand({ row, ms, leftCity, rightCity, weather, onScrubTo, onScrubEnd }: Props) {
  const { t, locale } = useI18n();
  const drag = useRef<{ x: number; slot: number; width: number; engaged: boolean } | null>(null);

  /**
   * The design's time slider was a demo tool and the handoff says so — in the
   * real app it becomes a gesture. Dragging the width of the band moves through
   * a whole day; letting go returns nothing, and the "back to now" control in
   * the status line resets.
   */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const startSlot = Math.floor(((ms - startOfDay(ms)) / 86400000) * SLOTS);
    drag.current = { x: event.clientX, slot: startSlot, width: rect.width, engaged: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (!state.engaged) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      state.engaged = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    // The sky follows the finger. Since the sun travels east to west — right to
    // left — dragging right pulls the day backwards, which is what "moving the
    // sky itself" has to mean once the direction of travel is fixed.
    const slot = Math.round(state.slot - (dx / state.width) * SLOTS);
    onScrubTo(Math.min(SLOTS - 1, Math.max(0, slot)));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state?.engaged) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onScrubEnd();
  };

  const note = (city: CityId): string => {
    const event = nextEvent(ms, city);
    const when = event.at === null ? t(`sky.${event.key}`) : `${t(`sky.${event.key}`)} ${clock(event.at, CITIES[city].tz, locale)}`;
    const observation = observationAt(weather, city, ms);
    if (!observation) return when;
    return `${roundTemp(observation.temperature)} ${t(`weather.conditions.${conditionKey(observation.code)}`)} · ${when}`;
  };

  const column = (city: CityId, side: 'left' | 'right') => (
    <div className={side === 'right' ? 'sky__city sky__city--right' : 'sky__city'}>
      {/* City names are never translated — each city keeps its own spelling. */}
      <span className="sky__name" style={{ color: row.text.secondary, textShadow: row.text.shadow }}>
        {CITIES[city].label}
      </span>
      <span className="sky__time" style={{ color: row.text.primary, textShadow: row.text.shadow }}>
        {clock(ms, CITIES[city].tz, locale)}
      </span>
      <span className="sky__note" style={{ color: row.text.secondary, textShadow: row.text.shadow }}>
        {note(city)}
      </span>
    </div>
  );

  return (
    <div
      className="sky"
      role="img"
      aria-label={t('sky.label')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="sky__layer" style={{ background: row.sky[leftCity] }} />
      <div className="sky__layer sky__layer--east" style={{ background: row.sky[rightCity] }} />

      <div className="sky__layer" style={{ opacity: row.starOpacity }}>
        {STARS.map((star) => (
          <span
            key={star.left + star.top}
            className="sky__star"
            style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity }}
          />
        ))}
      </div>

      {/* Only the arc and the horizon are stretched; every body is an HTML circle,
          because preserveAspectRatio="none" would squash an SVG circle into an ellipse.

          There are deliberately no city markers on this line. They would encode
          one bit — sun up or down — that the two sky gradients, the status line
          and the note lines already carry, and the two cities share that bit for
          all but about 85 minutes a day. Worse, the horizontal axis here means
          solar azimuth (east enters on the left), while a city marker would read
          as a map (west on the left) — the same axis pointing two ways is what
          made the markers look arbitrary. */}
      <svg className="sky__arc" width="100%" height="232" viewBox="0 0 356 232" fill="none" preserveAspectRatio="none">
        <path d="M-4 186C46 86 310 86 360 186" stroke={row.text.arc} strokeWidth="1" strokeDasharray="3 5" />
        <line x1="0" y1="186" x2="356" y2="186" stroke={row.text.horizon} strokeWidth="1" />
      </svg>

      <span className="sky__moon" style={{ left: `${row.moon.x}%`, top: row.moon.y, opacity: row.moon.opacity }} />
      <span
        className="sky__sun"
        style={{
          left: `${row.sun.x}%`,
          top: row.sun.y,
          background: row.sun.color,
          opacity: row.sun.opacity,
          boxShadow: `0 0 26px 8px ${row.sun.glow}`,
        }}
      />

      <div className="sky__scrim" />

      <div className="sky__cities">
        {column(leftCity, 'left')}
        {column(rightCity, 'right')}
      </div>
    </div>
  );
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
