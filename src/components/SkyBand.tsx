import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CITIES, type CityId } from '../content/cities';
import type { SkyDay, SkyRow } from '../sky/engine';
import { STARS } from '../sky/stars';
import { ASTERISMS, CATALOGUE, VISIBLE_FROM_SOUTH, starPosition } from '../sky/catalogue';
import { BAND_HEIGHT, HORIZON, place, southOffset } from '../sky/engine';
import { MoonDisc } from './MoonDisc';
import { nextEvent } from '../sky/notes';
import { conditionKey, observationAt, type WeatherCache } from '../weather/openmeteo';
import { WeatherLayer } from './WeatherLayer';
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

  const observed = {
    [leftCity]: observationAt(weather, leftCity, ms),
    [rightCity]: observationAt(weather, rightCity, ms),
  } as Record<CityId, ReturnType<typeof observationAt>>;

  const note = (city: CityId): string => {
    const event = nextEvent(ms, city);
    const when = event.at === null ? t(`sky.${event.key}`) : `${t(`sky.${event.key}`)} ${clock(event.at, CITIES[city].tz, locale)}`;
    const observation = observed[city];
    if (!observation) return when;
    return `${roundTemp(observation.temperature)} ${t(`weather.conditions.${conditionKey(observation.code)}`)} · ${when}`;
  };

  /**
   * The named stars, placed for this moment. Only those actually inside the
   * band's view: it looks south, so anything much past due east or west has run
   * off the edge of the projection and is left undrawn rather than stacked
   * against the frame.
   */
  const named = CATALOGUE.map((star) => {
    const position = starPosition(star, ms);
    const spot = place(position.altitude, position.azimuth);
    const size = Math.min(3.4, Math.max(1.4, 2.9 - star.mag * 0.45));
    return {
      name: star.name,
      ...spot,
      size,
      altitude: position.altitude,
      visible: position.altitude > 1.5 && Math.abs(southOffset(position.azimuth)) < VISIBLE_FROM_SOUTH,
      opacity: Math.min(1, Math.max(0.35, 1.05 - star.mag * 0.16)),
      // Bright stars are steadier; the low ones shimmer.
      period: 3.4 + (star.mag + 2) * 0.7,
      delay: -star.ra,
    };
  }).filter((star) => star.visible);

  const byName = new Map(named.map((star) => [star.name, star]));
  const asterismPaths = ASTERISMS.map((indices) => {
    const points = indices.map((i) => byName.get(CATALOGUE[i]!.name));
    // Drawn only when the whole shape is up; half a constellation is a scribble.
    if (points.some((point) => point === undefined)) return null;
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p!.x.toFixed(2)} ${p!.y.toFixed(1)}`).join(' ');
  }).filter((d): d is string => d !== null);

  const conditionOf = (city: CityId): string | null => {
    const observation = observed[city];
    return observation ? conditionKey(observation.code) : null;
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

      {/* Everything below is positioned in the band's own coordinates — horizon
          at 186, the cities on the ground beneath it — so it sits in a frame
          pushed clear of whatever the phone hides at the top. Only the colour
          layers fill the whole band and run up under the island. */}
      {/* Outside the frame on purpose: the field is measured in percentages of
          the sky rather than in band pixels, so it fills right up under a
          phone's island instead of stopping at a line across the top. */}
      <div className="sky__field" style={{ opacity: row.starOpacity }}>
        {STARS.map((star, index) => (
          <span
            key={index}
            className="sky__star"
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                background: `rgb(${star.tint})`,
                boxShadow: star.glow ? `0 0 ${star.glow}px rgba(${star.tint}, 0.5)` : undefined,
                '--star-opacity': star.opacity,
                animationDuration: `${star.period}s`,
                animationDelay: `${star.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="sky__frame">

        {/* The tracks the sun and moon actually take today, computed from the same
            positions they are drawn at — so a body sits on its own line by
            construction. High and wide in summer, low and short in winter, and the
            moon's track sits apart from the sun's because it genuinely does.

            The band stretches horizontally, which would thicken strokes unevenly;
            `vector-effect` keeps them honest. Bodies stay HTML circles — an SVG
            circle here would come out an ellipse. */}
        <svg
          className="sky__arc"
          viewBox={`0 0 100 ${BAND_HEIGHT}`}
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          {/* A track is only drawn while its body is actually visible. A line
              with nothing on it explains nothing — it just looks like a chart. */}
          {day.paths.moon.map((segment, index) => (
            <path
              key={`m${index}`}
              d={segment.d}
              stroke={row.text.arc}
              strokeOpacity={segment.above ? 0.25 : 0.05}
              strokeWidth="1"
              strokeDasharray={segment.above ? undefined : '2 4'}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {day.paths.sun.map((segment, index) => (
            <path
              key={`s${index}`}
              d={segment.d}
              stroke={row.text.arc}
              strokeOpacity={segment.above ? 0.4 : 0.1}
              strokeWidth="1"
              strokeDasharray={segment.above ? undefined : '2 4'}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {row.starOpacity > 0.05 &&
          asterismPaths.map((d, index) => (
            <path
              key={`a${index}`}
              d={d}
              stroke="rgba(255, 255, 255, 0.7)"
              strokeOpacity={row.starOpacity * 0.6}
              strokeWidth="1"
              strokeDasharray="1 4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        <line x1="0" y1={HORIZON} x2="100" y2={HORIZON} stroke={row.text.horizon} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>

        {row.starOpacity > 0.05 && (
        <div className="sky__layer" style={{ opacity: row.starOpacity }}>
          {named.map((star) => (
            <span
              key={star.name}
              className="sky__star sky__star--named"
              style={
                {
                  left: `${star.x}%`,
                  top: star.y,
                  width: star.size,
                  height: star.size,
                  boxShadow: `0 0 ${(star.size * 1.6).toFixed(1)}px rgba(255, 250, 240, 0.55)`,
                  '--star-opacity': star.opacity,
                  animationDuration: `${star.period}s`,
                  animationDelay: `${star.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      <MoonDisc
          size={16}
          illuminated={row.moon.illuminated}
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

        <WeatherLayer condition={conditionOf(leftCity)} city={leftCity} side="left" isDay={row.isDay} />
      <WeatherLayer condition={conditionOf(rightCity)} city={rightCity} side="right" isDay={row.isDay} />

      {/* Land: a wash that settles the ground below the horizon, and the hem
          that dissolves it into the page. Both sit above the sun, so a sun just
          under the horizon glows through the ground instead of over it. */}
      <div className="sky__ground" />
        <div className="sky__cities">
          {column(leftCity, 'left')}
          {column(rightCity, 'right')}
        </div>
        <div className="sky__hem" />
      </div>
    </div>
  );
}
