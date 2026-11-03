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

let source: Rng = Math.random;

/**
 * The game's own randomness: anything that changes the simulation (cast
 * jitter and yaw, voxel model seeds, animal wandering, blasts). It is
 * Math.random unless a check seeds it with `seedRandom`. Cosmetic effects
 * keep plain Math.random, and Math.random itself is never replaced (Three.js
 * uses it for ids).
 */
export const random = (): number => source();

/** Seeds `random` for repeatable scripted solves; null goes back to Math.random. */
export function seedRandom(seed: number | null): void {
  source = seed === null ? Math.random : makeRng(seed);
}
