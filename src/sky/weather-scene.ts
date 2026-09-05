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
import { HORIZON } from './engine';

export interface Cloud {
  /** Percent of the band's width, and pixels down from its top. */
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

/** Cloud, rain and snow counts per condition. */
const RECIPES: Record<string, { clouds: number; cover: number; rain: number; snow: number; haze: number }> = {
  clear: { clouds: 0, cover: 0, rain: 0, snow: 0, haze: 0 },
  mostlyClear: { clouds: 1, cover: 0.16, rain: 0, snow: 0, haze: 0 },
  cloudy: { clouds: 3, cover: 0.4, rain: 0, snow: 0, haze: 0 },
  overcast: { clouds: 5, cover: 0.68, rain: 0, snow: 0, haze: 1 },
  fog: { clouds: 2, cover: 0.3, rain: 0, snow: 0, haze: 3 },
  drizzle: { clouds: 3, cover: 0.5, rain: 10, snow: 0, haze: 1 },
  rain: { clouds: 4, cover: 0.62, rain: 20, snow: 0, haze: 0 },
  freezingRain: { clouds: 4, cover: 0.62, rain: 16, snow: 0, haze: 1 },
  showers: { clouds: 4, cover: 0.58, rain: 26, snow: 0, haze: 0 },
  snow: { clouds: 4, cover: 0.6, rain: 0, snow: 16, haze: 1 },
  snowShowers: { clouds: 5, cover: 0.66, rain: 0, snow: 22, haze: 1 },
  thunderstorm: { clouds: 5, cover: 0.75, rain: 26, snow: 0, haze: 0 },
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
    const scale = 0.6 + random() * 0.9;
    return {
      // The middle of the sky, expressed as a fraction of it: high enough to
      // clear the ground, low enough to leave the top of the band to the stars.
      y: Number((HORIZON * (0.4 + random() * 0.28)).toFixed(1)),
      width: Number((90 * scale).toFixed(0)),
      height: Number((26 * scale).toFixed(0)),
      opacity: Number(Math.min(0.9, recipe.cover * (0.95 + random() * 0.5)).toFixed(2)),
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
        length: fast ? Number((7 + random() * 7).toFixed(1)) : Number((1.6 + random() * 1.4).toFixed(1)),
        opacity: Number((0.3 + random() * 0.4).toFixed(2)),
        fall: Number(period.toFixed(2)),
        delay: Number((-random() * period).toFixed(2)),
      };
    });

  const haze: Haze[] = Array.from({ length: recipe.haze }, (_, i) => ({
    y: Number((HORIZON - 34 + i * 13).toFixed(1)),
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
