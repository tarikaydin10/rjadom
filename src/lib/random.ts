/**
 * Mulberry32: tiny, fast, and identical everywhere.
 *
 * Everything scattered across the sky — the star field, the clouds, the rain —
 * is drawn once from a fixed seed rather than from `Math.random`, so it is the
 * same on every render, every reload and both phones. A sky that reshuffled
 * itself on each repaint would be worse than no sky at all.
 */
export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
