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

/** Ranked fuzzy matches of `query` against `keys` (prefix matches get a bonus). */
export function fuzzyFind<T>(query: string, entries: Iterable<[string, T]>, limit = 3): FuzzyHit<T>[] {
  const hits: FuzzyHit<T>[] = [];
  const maxDist = Math.max(1, Math.min(3, Math.floor(query.length / 3)));
  for (const [key, value] of entries) {
    let dist = editDistance(query, key);
    if (key.startsWith(query) && query.length >= 3) dist = Math.min(dist, 1);
    if (dist <= maxDist) hits.push({ key, value, distance: dist });
  }
  hits.sort((a, b) => a.distance - b.distance || a.key.length - b.key.length);
  return hits.slice(0, limit);
}
