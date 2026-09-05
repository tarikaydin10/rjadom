/**
 * Real stars, in their real places.
 *
 * The scattered field is texture; these are not. Each one is a catalogue entry
 * with a right ascension and a declination, put through the same conversion the
 * sun and moon go through, so it stands where it actually stands over the Baltic
 * at the moment shown — turning through the night, and sitting differently in
 * March than in September.
 *
 * Why no Polaris, and no Plough. The band is a view towards the *south* — that
 * is where the sun and the moon are drawn, and the horizontal axis is the angle
 * either side of it. North therefore falls at both edges at once, and the
 * northern circumpolar stars would be pinned against them rather than placed in
 * the sky. The maths is there and correct — Polaris comes out at an altitude
 * equal to the latitude, due north, as it must — but drawing it here would be a
 * true number in a false position.
 *
 * So these look south, and are chosen so that something is always up: the Summer
 * Triangle rules the short nights, Orion the long ones, with the bright singles
 * in between. All of them are visible from both cities on the same evening.
 */
import { MIDPOINT } from '../content/cities';

export interface CatalogueStar {
  name: string;
  /** Right ascension in hours, declination in degrees, J2000. */
  ra: number;
  dec: number;
  /** Apparent magnitude: smaller is brighter. */
  mag: number;
}

export const CATALOGUE: CatalogueStar[] = [
  // Orion, which owns the winter sky and crosses due south.
  { name: 'Betelgeuse', ra: 5.919, dec: 7.407, mag: 0.42 },
  { name: 'Bellatrix', ra: 5.418, dec: 6.35, mag: 1.64 },
  { name: 'Mintaka', ra: 5.533, dec: -0.299, mag: 2.23 },
  { name: 'Alnilam', ra: 5.604, dec: -1.202, mag: 1.69 },
  { name: 'Alnitak', ra: 5.679, dec: -1.943, mag: 1.77 },
  { name: 'Saiph', ra: 5.796, dec: -9.67, mag: 2.06 },
  { name: 'Rigel', ra: 5.242, dec: -8.202, mag: 0.13 },

  // The Summer Triangle, which owns the short nights.
  { name: 'Vega', ra: 18.615, dec: 38.784, mag: 0.03 },
  { name: 'Deneb', ra: 20.69, dec: 45.28, mag: 1.25 },
  { name: 'Altair', ra: 19.846, dec: 8.868, mag: 0.76 },

  // Bright singles, for the eye to land on between seasons.
  { name: 'Sirius', ra: 6.752, dec: -16.716, mag: -1.46 },
  { name: 'Procyon', ra: 7.655, dec: 5.225, mag: 0.34 },
  { name: 'Aldebaran', ra: 4.599, dec: 16.509, mag: 0.85 },
  { name: 'Capella', ra: 5.278, dec: 45.998, mag: 0.08 },
  { name: 'Pollux', ra: 7.755, dec: 28.026, mag: 1.14 },
  { name: 'Arcturus', ra: 14.261, dec: 19.182, mag: -0.05 },
  { name: 'Antares', ra: 16.49, dec: -26.432, mag: 1.09 },
  { name: 'Spica', ra: 13.42, dec: -11.161, mag: 0.98 },
];

/** Indices into CATALOGUE, as the lines an eye draws between them. */
export const ASTERISMS: number[][] = [
  [2, 3, 4], // Orion's belt
  [0, 4, 5], // shoulder to belt to foot
  [1, 2, 6], // the other shoulder and foot
  [7, 8, 9, 7], // the Summer Triangle, closed
];

const RAD = Math.PI / 180;

/**
 * Where a fixed star is, seen from the midpoint between the two cities.
 *
 * Returns SunCalc's convention — azimuth in degrees clockwise from north,
 * altitude in degrees — so the result goes through exactly the same placement as
 * the sun and moon and lands in the same band coordinates.
 */
export function starPosition(star: CatalogueStar, ms: number): { altitude: number; azimuth: number } {
  const days = ms / 86400000 + 2440587.5 - 2451545.0;
  const gmstHours = ((18.697374558 + 24.06570982441908 * days) % 24 + 24) % 24;
  const localSidereal = gmstHours + MIDPOINT.lon / 15;
  // Hour angle: how far the star is past the meridian, in degrees.
  const hourAngle = (((localSidereal - star.ra) * 15) % 360 + 540) % 360 - 180;

  const h = hourAngle * RAD;
  const dec = star.dec * RAD;
  const lat = MIDPOINT.lat * RAD;

  const altitude = Math.asin(Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(h));
  // Measured from south, positive westward; +180 puts it on north-clockwise.
  const fromSouth = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));

  return { altitude: altitude / RAD, azimuth: (fromSouth / RAD + 180 + 360) % 360 };
}

/**
 * How far from due south, in degrees, signed. Beyond about this the band's
 * horizontal axis has run out and positions get clamped to the edge, so a star
 * out there is simply not drawn rather than stacked against the frame.
 */
export const VISIBLE_FROM_SOUTH = 112;
