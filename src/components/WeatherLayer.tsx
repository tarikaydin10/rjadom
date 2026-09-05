import type { CSSProperties } from 'react';
import { weatherScene } from '../sky/weather-scene';

/**
 * One city's weather, drawn over its own end of the sky.
 *
 * It used to be drawn over the whole band and masked back: solid to a fifth of
 * the way across, gone by four fifths. Two of those overlap across the middle
 * sixty per cent of the screen, so Hamburg's rain and Kaliningrad's clear sky
 * were superimposed over most of the band and neither could be read. Weather
 * that cannot be told apart is the one thing this layer exists to do.
 *
 * So each city now owns a region rather than the band: full strength out to
 * about a third, gone by a little past halfway, and the two fades cross in a
 * quiet seam down the middle. Rain on one side and sun on the other is now a
 * picture of two places, which is what it is.
 *
 * The mask is written in the region's own coordinates and the region is the
 * element, so the drops and clouds are scattered inside it — the density is
 * whatever the recipe says, rather than whatever survived a mask.
 *
 * Clouds sit in front of the sun and moon — that is where clouds are — which is
 * why this stays inside `.sky__frame` even though `.sky__weather` reaches back
 * up past it, to the top of the band.
 */
interface Props {
  condition: string | null;
  city: 'hamburg' | 'kaliningrad';
  side: 'left' | 'right';
  isDay: boolean;
}

/** Solid across the inner half of the region, gone at its inner edge. */
const LEFT_MASK = 'linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)';
const RIGHT_MASK = 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,1) 100%)';

export function WeatherLayer({ condition, city, side, isDay }: Props) {
  if (!condition || condition === 'clear') return null;
  const scene = weatherScene(condition, city);

  const mask = side === 'left' ? LEFT_MASK : RIGHT_MASK;
  /**
   * A daylight cloud needs an edge, not just brightness. White on a pale sky is
   * invisible — the first attempt vanished completely above the horizon glow —
   * so it is a lit core fading into grey, the way a real one reads against blue.
   * At night it is the opposite problem and a soft grey is enough.
   */
  const core = isDay ? '253, 253, 252' : '214, 210, 226';
  const rim = isDay ? '150, 163, 184' : '150, 148, 170';
  const wet = isDay ? '104, 126, 150' : '196, 206, 226';

  const layer: CSSProperties = { WebkitMaskImage: mask, maskImage: mask };

  /**
   * Cover greys the sky itself, which is what overcast actually is — the first
   * attempt drew pale clouds onto a pale sky and they simply vanished. Discrete
   * clouds on top of this give the shape; the wash gives the weight.
   */
  const wash = isDay ? '176, 188, 204' : '96, 96, 118';

  return (
    <div className={`sky__weather sky__weather--${side}`} style={layer} aria-hidden="true">
      {scene.dimming > 0.2 && (
        <span
          className="wx__wash"
          style={{
            background: `linear-gradient(180deg, rgba(${wash}, ${(scene.dimming * (isDay ? 0.62 : 0.42)).toFixed(2)}) 0%, rgba(${wash}, ${(scene.dimming * (isDay ? 0.4 : 0.25)).toFixed(2)}) 62%, rgba(${wash}, 0) 100%)`,
          }}
        />
      )}

      {scene.clouds.map((cloud, i) => (
        <span
          key={`c${i}`}
          className="wx__cloud"
          style={
            {
              top: `${cloud.y}%`,
              width: cloud.width,
              height: cloud.height,
              // A body that holds most of the way out, then a soft rim. The
              // falloff used to begin almost at the centre, so even an opaque
              // cloud arrived on screen as a faint bloom with no shape to it.
              background: `radial-gradient(64% 100% at 50% 44%, rgba(${core}, ${cloud.opacity}) 0%, rgba(${core}, ${(cloud.opacity * 0.94).toFixed(2)}) 36%, rgba(${rim}, ${(cloud.opacity * 0.82).toFixed(2)}) 64%, rgba(${rim}, 0) 84%)`,
              animationDuration: `${cloud.drift}s`,
              animationDelay: `${cloud.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      {scene.haze.map((band, i) => (
        <span
          key={`h${i}`}
          className="wx__haze"
          style={
            {
              top: `${band.y}%`,
              background: `linear-gradient(90deg, rgba(${core},0) 0%, rgba(${core},${band.opacity}) 35%, rgba(${core},${band.opacity}) 65%, rgba(${core},0) 100%)`,
              animationDuration: `${band.drift}s`,
              animationDelay: `${band.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      {scene.drops.map((drop, i) => (
        <span
          key={`d${i}`}
          className="wx__drop"
          style={
            {
              left: `${drop.x}%`,
              height: drop.length,
              background: `linear-gradient(rgba(${wet},0), rgba(${wet},${drop.opacity}))`,
              animationDuration: `${drop.fall}s`,
              animationDelay: `${drop.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      {scene.flakes.map((flake, i) => (
        <span
          key={`f${i}`}
          className="wx__flake"
          style={
            {
              left: `${flake.x}%`,
              width: flake.length,
              height: flake.length,
              background: `rgba(255, 253, 250, ${flake.opacity})`,
              animationDuration: `${flake.fall}s`,
              animationDelay: `${flake.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
