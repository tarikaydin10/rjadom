import type { CSSProperties } from 'react';
import { weatherScene } from '../sky/weather-scene';

/**
 * One city's weather, drawn over its half of the sky.
 *
 * Masked with the same soft edge the two skies use, so Hamburg's rain fades into
 * Kaliningrad's clear sky rather than stopping at a line down the middle. Clouds
 * sit in front of the sun and moon — that is where clouds are — which is why
 * this stays inside `.sky__frame` even though `.sky__weather` reaches back up
 * past it, to the top of the band.
 */
interface Props {
  condition: string | null;
  city: 'hamburg' | 'kaliningrad';
  side: 'left' | 'right';
  isDay: boolean;
}

const LEFT_MASK = 'linear-gradient(90deg, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 80%)';
const RIGHT_MASK = 'linear-gradient(90deg, rgba(0,0,0,0) 20%, rgba(0,0,0,1) 80%)';

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
    <div className="sky__weather" style={layer} aria-hidden="true">
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
              background: `radial-gradient(62% 100% at 50% 42%, rgba(${core}, ${cloud.opacity}) 0%, rgba(${rim}, ${cloud.opacity * 0.8}) 54%, rgba(${rim}, 0) 76%)`,
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
