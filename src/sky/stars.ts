/**
 * The star field.
 *
 * The design had five stars, which is enough to say "night" and not enough to
 * feel like one. These are scattered once at module load from a fixed seed, so
 * they are the same on every render and every device — a sky that reshuffles
 * itself on each repaint would be worse than five dots.
 *
 * Not real constellations: the band is a compressed, non-linear projection, so
 * true positions would be a lie told precisely. This is an honest impression —
 * denser high up where the sky is deepest, thinning towards the horizon glow,
 * with a handful of bright ones to give the eye somewhere to land.
 */
export interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  /** Seconds for one twinkle, and where in that cycle this star starts. */
  period: number;
  delay: number;
}

/** Mulberry32: tiny, fast, and identical everywhere. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HORIZON = 186;

function scatter(count: number): Star[] {
  const random = seeded(0x5eed1a);
  const stars: Star[] = [];

  for (let i = 0; i < count; i++) {
    // Squaring the roll pulls the field upward: thin near the horizon, where a
    // real sky is washed out anyway, dense towards the top.
    const depth = random() ** 1.7;
    const y = 8 + depth * (HORIZON - 26);
    const bright = random();
    // Scintillation is atmosphere, so it is strongest low down where you are
    // looking through the most of it — the same reason those stars are fainter.
    const period = Number((3.2 + random() * 4.5).toFixed(2));
    stars.push({
      period,
      delay: Number((-random() * period).toFixed(2)),
      x: Number((random() * 100).toFixed(2)),
      y: Number(y.toFixed(1)),
      // A few large and bright, many small and faint — roughly how a sky reads.
      size: Number((bright > 0.94 ? 2.4 : bright > 0.78 ? 1.8 : 1.2).toFixed(1)),
      // Fainter close to the horizon, as atmosphere does.
      opacity: Number((((bright > 0.94 ? 1 : 0.35 + bright * 0.5) * (1 - depth * 0.45))).toFixed(2)),
    });
  }
  return stars;
}

export const STARS: Star[] = scatter(90);
