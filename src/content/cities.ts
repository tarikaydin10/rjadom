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
