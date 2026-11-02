import type { Rng } from '../core/rng';

/** Seeded 2D value noise with smooth interpolation, plus fbm. */
export function makeNoise2D(rng: Rng) {
  const N = 256;
  const vals = new Float32Array(N * N);
  for (let i = 0; i < vals.length; i++) vals[i] = rng();
  const at = (x: number, y: number) => vals[(x & (N - 1)) + (y & (N - 1)) * N];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = smooth(x - xi), ty = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  const fbm = (x: number, y: number, oct = 3) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += noise(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
  return { noise, fbm };
}
