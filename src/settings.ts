/**
 * Player settings, saved in localStorage. The game applies them whenever they change (see Game.applySettings).
 * Reduced effects defaults to the system's "reduce motion" preference.
 */
export interface Settings {
  /** Music loudness 0..1. */
  music: number;
  /** Sound effects loudness 0..1. */
  sfx: number;
  /** Turns off hit-stop, zoom punch, color fringing and the camera swoop-ins (and softens flashes). */
  reduceEffects: boolean;
  /** Camera shake on explosions and hard landings. */
  shake: boolean;
  /** Contextual control tips. */
  tips: boolean;
  /** Camera orbit speed multiplier. */
  orbit: number;
  /** Explore: the sky slowly turns through day, sunset, night and dawn. */
  cycle: boolean;
}

const KEY = 'blockspell.settings.v1';

const defaults = (): Settings => ({
  music: 1,
  sfx: 1,
  reduceEffects: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  shake: true,
  tips: true,
  orbit: 1,
  cycle: true,
});

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback);

function load(): Settings {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
    return {
      music: clamp(raw.music, 0, 1, d.music),
      sfx: clamp(raw.sfx, 0, 1, d.sfx),
      reduceEffects: typeof raw.reduceEffects === 'boolean' ? raw.reduceEffects : d.reduceEffects,
      shake: typeof raw.shake === 'boolean' ? raw.shake : d.shake,
      tips: typeof raw.tips === 'boolean' ? raw.tips : d.tips,
      orbit: clamp(raw.orbit, 0.4, 2.5, d.orbit),
      cycle: typeof raw.cycle === 'boolean' ? raw.cycle : d.cycle,
    };
  } catch {
    return d;
  }
}

let current = load();
const listeners = new Set<(s: Settings) => void>();

export const settings = {
  get(): Settings {
    return current;
  },
  set(patch: Partial<Settings>): void {
    current = { ...current, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* private mode: settings last until the page closes */
    }
    for (const fn of [...listeners]) fn(current);
  },
  /** Calls `fn` now and after every change. */
  onChange(fn: (s: Settings) => void): () => void {
    listeners.add(fn);
    fn(current);
    return () => listeners.delete(fn);
  },
  reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    current = defaults();
    for (const fn of [...listeners]) fn(current);
  },
};
