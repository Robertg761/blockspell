/** The demo's personal bests (fastest clear, fewest spells), saved in localStorage. */
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
