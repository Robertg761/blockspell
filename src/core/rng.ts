export type Rng = () => number;

/** Small, fast seeded PRNG (mulberry32). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
export const randInt = (rng: Rng, lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * rng());
export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
