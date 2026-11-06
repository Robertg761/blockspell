/** The demo's personal bests (fastest clear, fewest spells) and the ways found for each job, saved in localStorage. */
export interface DemoBest { time: number; words: number; runs: number }

const KEY = 'blockspell.demo-best.v1';

function read(): DemoBest | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v.time === 'number' ? v : null;
  } catch {
    return null;
  }
}

export const demoBest = {
  get: read,
  /** Records a clear and says which records it beat (both false on the first clear, which sets them). */
  record(time: number, words: number): { prev: DemoBest | null; fasterBest: boolean; fewerBest: boolean } {
    const prev = read();
    const next: DemoBest = {
      time: Math.min(time, prev?.time ?? Infinity),
      words: Math.min(words, prev?.words ?? Infinity),
      runs: (prev?.runs ?? 0) + 1,
    };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: no records */ }
    return { prev, fasterBest: !!prev && time < prev.time, fewerBest: !!prev && words < prev.words };
  },
  reset(): void {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};

/** 83.4 → "1:23" */
export const clockText = (s: number): string => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const WAYS = 'blockspell.demo-ways.v1';

/** The spells that have finished each demo job, across every run: the demo's collection to fill in. */
export const demoWays = {
  all(): Record<string, string[]> {
    try {
      const v = JSON.parse(localStorage.getItem(WAYS) ?? '{}');
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  },
  /** Adds a way for a job; true if it's new. */
  add(job: string, spell: string): boolean {
    const all = demoWays.all();
    const list = all[job] ?? [];
    if (list.includes(spell)) return false;
    all[job] = [...list, spell];
    try { localStorage.setItem(WAYS, JSON.stringify(all)); } catch { /* private mode: not kept */ }
    return true;
  },
  count(): number {
    return Object.values(demoWays.all()).reduce((n, l) => n + l.length, 0);
  },
  reset(): void {
    try { localStorage.removeItem(WAYS); } catch { /* ignore */ }
  },
};
