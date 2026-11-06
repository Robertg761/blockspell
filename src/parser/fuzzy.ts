/** Optimal string alignment (Damerau–Levenshtein) distance. */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[m][n];
}

export interface FuzzyHit<T> {
  key: string;
  value: T;
  distance: number;
}

/**
 * Ranked fuzzy matches of `query` against `keys` (prefix matches get a bonus).
 * `maxDist` defaults to a strict, typo-sized threshold.
 */
export function fuzzyFind<T>(query: string, entries: Iterable<[string, T]>, limit = 3, maxDist = Math.max(1, Math.min(3, Math.floor(query.length / 3)))): FuzzyHit<T>[] {
  const hits: FuzzyHit<T>[] = [];
  for (const [key, value] of entries) {
    let dist = editDistance(query, key);
    if (key.startsWith(query) && query.length >= 3) dist = Math.min(dist, 1);
    if (dist <= maxDist) hits.push({ key, value, distance: dist });
  }
  hits.sort((a, b) => a.distance - b.distance || a.key.length - b.key.length);
  return hits.slice(0, limit);
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const keyPos = new Map<string, [number, number]>();
KEY_ROWS.forEach((row, r) => [...row].forEach((c, i) => keyPos.set(c, [r, i + r * 0.5])));
const adjacentKeys = (a: string, b: string) => {
  const p = keyPos.get(a), q = keyPos.get(b);
  return !!p && !!q && Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1.01;
};
const isVowel = (c: string) => 'aeiou'.includes(c);

/**
 * How far `a` (what was typed) is from `b` (a known word), counting only the slips fingers make: a
 * neighbouring key (0.5), a swapped pair (0.6), a doubled or missed letter (0.5 to 0.8), a vowel for a
 * vowel (0.7). Any other substitution costs 1, so "food" is nowhere near "wood". Weighted
 * Damerau-Levenshtein.
 */
export function typoCost(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) d[i][0] = d[i - 1][0] + (i > 1 && a[i - 1] === a[i - 2] ? 0.5 : 0.8);
  for (let j = 1; j <= n; j++) d[0][j] = d[0][j - 1] + (j > 1 && b[j - 1] === b[j - 2] ? 0.5 : 0.8);
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const x = a[i - 1], y = b[j - 1];
      const short = m < 5 || n < 5; // on a short word a neighbouring key is far more likely a different word (gold/good)
      const sub = x === y ? 0 : adjacentKeys(x, y) && !short ? 0.5 : isVowel(x) && isVowel(y) ? 0.7 : 1;
      const del = i > 1 && a[i - 1] === a[i - 2] ? 0.5 : 0.8; // a doubled letter typed once too many
      const ins = j > 1 && b[j - 1] === b[j - 2] ? 0.5 : 0.8; // a double letter typed once
      d[i][j] = Math.min(d[i - 1][j] + del, d[i][j - 1] + ins, d[i - 1][j - 1] + sub);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 0.6);
    }
  return d[m][n];
}

/** How loose a typo may be for a word of this length (short words get almost none). */
export function typoLimit(len: number): number {
  return len <= 4 ? 0.65 : len <= 5 ? 0.85 : len <= 8 ? 1.05 : 1.6;
}

/** A rough sound-alike key: "elefant" and "elephant", "kitchin" and "kitchen". */
export function soundKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  w = w
    .replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^ps/, 's')
    .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/gh/g, '').replace(/tch/g, 'ch').replace(/dg/g, 'j')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's').replace(/y/g, 'i');
  const first = w[0] ?? '';
  return first + w.slice(1).replace(/[aeiou]/g, '').replace(/(.)\1+/g, '$1');
}

export interface TypoHit<T> {
  key: string;
  value: T;
  cost: number;
}

/**
 * Safe typo correction: the one known word `query` is clearly a slip of, or null. The first letter must
 * match (a swapped first pair counts), and the best match has to be clearly better
 * than the best one that means something else, so an ambiguous word is left alone rather than guessed.
 */
export function correctTypo<T>(query: string, entries: Iterable<[string, T]>, same: (a: T, b: T) => boolean = (a, b) => a === b): TypoHit<T> | null {
  const q = query.replace(/\s+/g, '');
  if (q.length < 3 || /\d/.test(q)) return null;
  const limit = typoLimit(q.length);
  const qSound = q.length >= 6 && soundKey(q).length >= 4 ? soundKey(q) : null; // a skeleton like "bn" matches too many words
  const scored: TypoHit<T>[] = [];
  for (const [key, value] of entries) {
    const k = key.replace(/\s+/g, '');
    if (Math.abs(k.length - q.length) > 2) continue;
    const firstOk = k[0] === q[0] || (q[1] === k[0] && q[0] === k[1]);
    if (!firstOk) continue;
    let cost = typoCost(q, k);
    if (cost > limit && qSound && qSound === soundKey(k) && k[0] === q[0] && k.length >= 6) cost = Math.min(cost, limit);
    if (cost <= limit) scored.push({ key, value, cost });
  }
  scored.sort((a, b) => a.cost - b.cost || a.key.length - b.key.length);
  const best = scored[0];
  if (!best) return null;
  const rival = scored.find((s) => !same(s.value, best.value) && s.cost < best.cost + 0.4);
  return rival ? null : best;
}
