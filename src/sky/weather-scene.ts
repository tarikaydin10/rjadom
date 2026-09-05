/**
 * What a given weather code looks like over one city.
 *
 * The band already carries a lot — two skies, two tracks, two clocks and the
 * text. So this is deliberately quiet: drifting cloud, falling precipitation,
 * haze low down. Enough to know at a glance that it is raining over her, not
 * enough to compete with the sun for attention.
 *
 * Scattered once from a fixed seed, like the stars — see `lib/random.ts`.
 */
import { seeded } from '../lib/random';

export interface Cloud {
  /**
   * Percent of the sky's height, not pixels down the band.
   *
   * The sky grows by whatever the phone hides at the top, and a cloud placed in
   * band pixels ignored that strip — which is the same mistake that had the
   * overcast wash begin on a line under the clock. A fraction fills whatever
   * the sky turns out to be, exactly as the star field does.
   */
  y: number;
  width: number;
  height: number;
  opacity: number;
  /** Seconds for one crossing, and where in that crossing it starts. */
  drift: number;
  delay: number;
}

export interface Drop {
  x: number;
  length: number;
  opacity: number;
  fall: number;
  delay: number;
}

export interface Haze {
  /** Percent of the sky's height, as for a cloud. */
  y: number;
  opacity: number;
  drift: number;
  delay: number;
}

export interface WeatherScene {
  clouds: Cloud[];
  drops: Drop[];
  flakes: Drop[];
  haze: Haze[];
  /** Cloud cover dims the sun and moon behind it. */
  dimming: number;
}

/**
 * Cloud, rain and snow counts per condition.
 *
 * Deliberately quiet is not the same as barely there, and the first pass landed
 * on the wrong side of that line: on an overcast afternoon you had to look for
 * the weather to notice it at all. There is more of everything here, and what
 * there is carries further — see the cloud and drop shapes below.
 */
const RECIPES: Record<string, { clouds: number; cover: number; rain: number; snow: number; haze: number }> = {
  clear: { clouds: 0, cover: 0, rain: 0, snow: 0, haze: 0 },
  mostlyClear: { clouds: 2, cover: 0.18, rain: 0, snow: 0, haze: 0 },
  cloudy: { clouds: 5, cover: 0.44, rain: 0, snow: 0, haze: 0 },
  overcast: { clouds: 8, cover: 0.72, rain: 0, snow: 0, haze: 1 },
  fog: { clouds: 3, cover: 0.32, rain: 0, snow: 0, haze: 3 },
  drizzle: { clouds: 5, cover: 0.54, rain: 18, snow: 0, haze: 1 },
  rain: { clouds: 7, cover: 0.66, rain: 32, snow: 0, haze: 0 },
  freezingRain: { clouds: 7, cover: 0.66, rain: 26, snow: 0, haze: 1 },
  showers: { clouds: 7, cover: 0.62, rain: 40, snow: 0, haze: 0 },
  snow: { clouds: 7, cover: 0.64, rain: 0, snow: 24, haze: 1 },
  snowShowers: { clouds: 8, cover: 0.7, rain: 0, snow: 32, haze: 1 },
  thunderstorm: { clouds: 8, cover: 0.78, rain: 40, snow: 0, haze: 0 },
};

const cache = new Map<string, WeatherScene>();

export function weatherScene(condition: string, seedKey: string): WeatherScene {
  const key = `${condition}:${seedKey}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const recipe = RECIPES[condition] ?? RECIPES.cloudy!;
  // Two cities get different weather from the same recipe, which is what stops
  // Hamburg and Kaliningrad looking like a mirror of each other.
  const random = seeded(seedKey === 'hamburg' ? 0x4c10ad : 0x5f10ce);

  const clouds: Cloud[] = Array.from({ length: recipe.clouds }, () => {
    const scale = 0.7 + random() * 1.05;
    return {
      // Spread over most of the sky rather than one band across the middle: a
      // row of clouds all at the same height reads as a decoration, several at
      // different heights read as weather.
      y: Number((26 + random() * 44).toFixed(1)),
      width: Number((116 * scale).toFixed(0)),
      height: Number((34 * scale).toFixed(0)),
      opacity: Number(Math.min(0.92, recipe.cover * (1.15 + random() * 0.45)).toFixed(2)),
      // Slow. A cloud that visibly races is a cartoon.
      drift: Number((70 + random() * 110).toFixed(0)),
      delay: Number((-random() * 180).toFixed(0)),
    };
  });

  const fallers = (count: number, fast: boolean): Drop[] =>
    Array.from({ length: count }, () => {
      const period = fast ? 0.7 + random() * 0.5 : 3.4 + random() * 2.6;
      return {
        x: Number((random() * 100).toFixed(2)),
        length: fast ? Number((11 + random() * 9).toFixed(1)) : Number((2.4 + random() * 1.8).toFixed(1)),
        opacity: Number((0.45 + random() * 0.4).toFixed(2)),
        fall: Number(period.toFixed(2)),
        delay: Number((-random() * period).toFixed(2)),
      };
    });

  // Low down, where a real haze lies: the last stretch above the horizon.
  const haze: Haze[] = Array.from({ length: recipe.haze }, (_, i) => ({
    y: Number((86 + i * 5.4).toFixed(1)),
    opacity: Number((0.1 + random() * 0.13).toFixed(2)),
    drift: Number((120 + random() * 90).toFixed(0)),
    delay: Number((-random() * 200).toFixed(0)),
  }));

  const scene: WeatherScene = {
    clouds,
    drops: fallers(recipe.rain, true),
    flakes: fallers(recipe.snow, false),
    haze,
    dimming: recipe.cover,
  };
  cache.set(key, scene);
  return scene;
}
