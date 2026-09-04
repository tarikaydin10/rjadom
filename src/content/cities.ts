/**
 * The two fixed points of the app.
 *
 * City labels are never translated: Hamburg stays "Hamburg" in the Russian
 * interface, Калининград stays "Калининград" in the English one. Each city is
 * named the way its own people write it — that is the point of the pairing, and
 * both self-hosted fonts carry Latin and Cyrillic so neither label ever falls
 * back to a system typeface.
 */
export const CITIES = {
  hamburg: { id: 'hamburg', label: 'Hamburg', lat: 53.551, lon: 9.994, tz: 'Europe/Berlin' },
  kaliningrad: { id: 'kaliningrad', label: 'Калининград', lat: 54.71, lon: 20.51, tz: 'Europe/Kaliningrad' },
} as const;

export type CityId = keyof typeof CITIES;
export type City = (typeof CITIES)[CityId];

/** Midpoint over the Baltic. The single sun and moon in the band are drawn from
 *  here, so neither city owns them. */
export const MIDPOINT = { lat: 54.13, lon: 15.25 } as const;

export const otherCity = (id: CityId): CityId => (id === 'hamburg' ? 'kaliningrad' : 'hamburg');

/**
 * How the sky band is laid out, left to right — the same on both phones.
 *
 * Not "your city first". The two of them talk about this screen, so "the left
 * one" has to mean the same thing to both, and a screenshot she sends has to
 * read without mental mirroring. West on the left is also the orientation
 * everyone brings from a map, and the one a map screen would have to use.
 *
 * West on the left also fixes which way the sky has to move: east is the right
 * edge, so the sun rises on the right over Kaliningrad — which really does get
 * light about forty minutes earlier — and sets on the left over Hamburg, which
 * really does keep it longest. See `place()` in `sky/engine.ts`.
 *
 * The personal axis lives elsewhere and stays personal: the answer columns are
 * yours and theirs, and the status line still reads from the city you are in.
 */
export const BAND_ORDER = { left: 'hamburg', right: 'kaliningrad' } as const satisfies Record<'left' | 'right', CityId>;
