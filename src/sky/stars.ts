/**
 * The star field.
 *
 * The design had five stars, which is enough to say "night" and not enough to
 * feel like one. These are scattered once at module load from a fixed seed, so
 * they are the same on every render and every device — a sky that reshuffles
 * itself on each repaint would be worse than five dots.
 *
 * This is the faint background — the stars nobody names. The ones that can be
 * named are real, computed from a catalogue, and live in `catalogue.ts`. Here
 * the aim is only texture: denser high up where the sky is deepest, thinning
 * towards the horizon glow, and a little colour, because a sky of identical
 * white dots reads as pixels.
 *
 * Positions are a percentage of the sky's height rather than pixels, so the
 * field fills whatever the band turns out to be — including the strip that runs
 * up under a phone's island, which pixel coordinates left empty.
 */
import { seeded } from '../lib/random';

export interface Star {
  /** Both percentages: of the band's width, and of the sky above the horizon. */
  x: number;
  y: number;
  size: number;
  opacity: number;
  /** Seconds for one twinkle, and where in that cycle this star starts. */
  period: number;
  delay: number;
  /** Faint colour, from cool white to warm. */
  tint: string;
  /** Halo in pixels; only the brightest get one. */
  glow: number;
}

/** Real starlight is not white: hot stars run blue, old ones amber. */
const TINTS = ['255, 252, 245', '236, 242, 255', '255, 246, 230', '248, 250, 255', '255, 238, 214'];

function scatter(count: number): Star[] {
  const random = seeded(0x5eed1a);
  const stars: Star[] = [];

  for (let i = 0; i < count; i++) {
    // Squaring the roll pulls the field upward: thin near the horizon, where a
    // real sky is washed out anyway, dense towards the top.
    const depth = random() ** 1.7;
    const bright = random();
    // Scintillation is atmosphere, so it is strongest low down where you are
    // looking through the most of it — the same reason those stars are fainter.
    const period = Number((2.6 + random() * 4.8).toFixed(2));
    const brightest = bright > 0.95;
    stars.push({
      period,
      delay: Number((-random() * period).toFixed(2)),
      x: Number((random() * 100).toFixed(2)),
      y: Number((depth * 96).toFixed(2)),
      // A few large and bright, many small and faint — roughly how a sky reads.
      size: Number((brightest ? 2.3 : bright > 0.78 ? 1.7 : 1.1).toFixed(1)),
      // Fainter close to the horizon, as atmosphere does.
      opacity: Number(((brightest ? 1 : 0.32 + bright * 0.5) * (1 - depth * 0.4)).toFixed(2)),
      tint: TINTS[Math.floor(random() * TINTS.length)] ?? TINTS[0]!,
      // Only the brightest bloom, and barely. The first attempt gave a third of
      // the field a halo and the result read as bokeh rather than as a sky.
      glow: brightest ? 1.6 : 0,
    });
  }
  return stars;
}

export const STARS: Star[] = scatter(140);
