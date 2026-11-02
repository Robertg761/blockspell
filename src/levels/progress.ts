/** Level progress (best stars / fewest spells) saved in localStorage. */
export interface LevelRecord {
  stars: number;
  words: number;
}

const KEY = 'blockspell.progress.v1';

function read(): Record<string, LevelRecord> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export const progress = {
  get(id: string): LevelRecord | null {
    return read()[id] ?? null;
  },
  all(): Record<string, LevelRecord> {
    return read();
  },
  /** Records a solve; keeps the best. Returns true if it's a new best. */
  record(id: string, stars: number, words: number): boolean {
    const data = read();
    const prev = data[id];
    const better = !prev || stars > prev.stars || (stars === prev.stars && words < prev.words);
    if (better) {
      data[id] = { stars: Math.max(stars, prev?.stars ?? 0), words: Math.min(words, prev?.words ?? Infinity) };
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* private mode: progress just isn't saved */
      }
    }
    return better;
  },
  reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
