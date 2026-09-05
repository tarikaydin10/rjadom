import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CITIES, type CityId } from '../content/cities';
import type { SkyDay, SkyRow } from '../sky/engine';
import { STARS } from '../sky/stars';
import { MoonDisc } from './MoonDisc';
import { nextEvent } from '../sky/notes';
import { conditionKey, observationAt, type WeatherCache } from '../weather/openmeteo';
import { clock, roundTemp } from '../lib/format';
import { useI18n } from '../i18n';

interface Props {
  row: SkyRow;
  /** Today's table, for the tracks the sun and moon actually follow. */
  day: SkyDay;
  /** Both cities keep fixed sides — see BAND_ORDER in `content/cities.ts`. */
  /** The moment being shown — real time, or wherever the drag has landed. */
  ms: number;
  leftCity: CityId;
  rightCity: CityId;
  weather: WeatherCache | undefined;
  /** Absolute moment to show. Clamped by the caller. */
  onScrubTo(ms: number): void;
  onScrubEnd(): void;
}

/** Movement below this is a tap, not a scrub. */
const DRAG_THRESHOLD_PX = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export function SkyBand({ row, day, ms, leftCity, rightCity, weather, onScrubTo, onScrubEnd }: Props) {
  const { t, locale } = useI18n();
  const drag = useRef<{ x: number; ms: number; width: number; engaged: boolean } | null>(null);

  /**
   * The design's time slider was a demo tool and the handoff says so — in the
   * real app it becomes a gesture. Dragging the width of the band moves through
   * a whole day; letting go returns nothing, and the "back to now" control in
   * the status line resets.
   */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { x: event.clientX, ms, width: rect.width, engaged: false };
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
    // Right is later, always. This gesture replaces the prototype's time slider,
    // so it keeps a slider's convention rather than behaving like a surface being
    // pushed — dragging forward moves time forward, whichever way the sun happens
    // to travel across the band.
    //
    // Continuous rather than clamped to the calendar day: one band width is one
    // day, and a drag that keeps going keeps going. Stopping dead at midnight
    // made "what is it like there tomorrow morning" impossible to ask.
    onScrubTo(state.ms + (dx / state.width) * DAY_MS);
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
        {STARS.map((star, index) => (
          <span
            key={index}
            className="sky__star"
            style={{
              left: `${star.x}%`,
              top: star.y,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      {/* The tracks the sun and moon actually take today, computed from the same
          positions they are drawn at — so a body sits on its own line by
          construction. High and wide in summer, low and short in winter, and the
          moon's track sits apart from the sun's because it genuinely does.

          The band stretches horizontally, which would thicken strokes unevenly;
          `vector-effect` keeps them honest. Bodies stay HTML circles — an SVG
          circle here would come out an ellipse. */}
      <svg
        className="sky__arc"
        viewBox="0 0 100 232"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        {/* A track is only drawn while its body is actually visible. A line
            with nothing on it explains nothing — it just looks like a chart. */}
        {(row.moon.opacity > 0.05 ? day.paths.moon : []).map((segment, index) => (
          <path
            key={`m${index}`}
            d={segment.d}
            stroke={row.text.arc}
            strokeOpacity={segment.above ? 0.38 : 0.18}
            strokeWidth="1"
            strokeDasharray={segment.above ? undefined : '2 4'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {(row.sun.opacity > 0 ? day.paths.sun : []).map((segment, index) => (
          <path
            key={`s${index}`}
            d={segment.d}
            stroke={row.text.arc}
            strokeOpacity={segment.above ? 0.62 : 0.3}
            strokeWidth="1"
            strokeDasharray={segment.above ? undefined : '2 4'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line x1="0" y1="186" x2="100" y2="186" stroke={row.text.horizon} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>

      <MoonDisc
        size={16}
        illuminated={row.moon.illuminated}
        waxing={row.moon.waxing}
        tilt={row.moon.tilt}
        opacity={row.moon.opacity}
        style={{ position: 'absolute', left: `${row.moon.x}%`, top: row.moon.y, margin: '-8px 0 0 -8px' }}
      />
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
