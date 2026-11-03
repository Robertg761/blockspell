/** Open world progress (finished tasks and the ways found) saved in localStorage. */
export interface TaskRecord {
  /** When the task was first finished (ms since epoch). */
  doneAt: number;
  /** Every distinct way it was solved: sorted, comma-joined object ids cast in its zone. */
  ways: string[];
}

export interface WorldSave {
  tasks: Record<string, TaskRecord>;
  lastZone: string | null;
}

const KEY = 'blockspell.world.v1';
const LEGACY_KEY = 'blockspell.progress.v1';

/** Old standalone puzzles and the world task that took each one over. */
const LEGACY: Record<string, string> = {
  'star-cliff': 'star-on-cliff',
  'sky-island': 'floating-ledge',
  'fire-hut': 'save-hut',
  'feed-pup': 'feed-pup',
  chasm: 'cross-gap',
};

function write(data: WorldSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode: progress just isn't saved */
  }
}

/** One-time migration: every solved old puzzle marks its task done. */
function migrate(): WorldSave {
  const data: WorldSave = { tasks: {}, lastZone: null };
  try {
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '{}') ?? {};
    for (const [level, task] of Object.entries(LEGACY)) if (old[level]) data.tasks[task] = { doneAt: Date.now(), ways: [] };
  } catch {
    /* unreadable old save: start fresh */
  }
  write(data);
  return data;
}

function read(): WorldSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return migrate();
    const data = JSON.parse(raw) ?? {};
    return { tasks: data.tasks && typeof data.tasks === 'object' ? data.tasks : {}, lastZone: data.lastZone ?? null };
  } catch {
    return { tasks: {}, lastZone: null };
  }
}

/** The key for a set of cast object ids: sorted, distinct, comma-joined ("" when nothing was cast). */
export const wayKey = (ids: Iterable<string>): string => [...new Set(ids)].sort().join(',');

export const worldSave = {
  get(id: string): TaskRecord | null {
    return read().tasks[id] ?? null;
  },
  all(): WorldSave {
    return read();
  },
  /** Records a completion. Returns whether it was the first one and whether `way` is new. */
  complete(id: string, way: string[]): { first: boolean; newWay: boolean; ways: number } {
    const data = read();
    const prev = data.tasks[id];
    const rec: TaskRecord = prev ? { ...prev, ways: [...prev.ways] } : { doneAt: Date.now(), ways: [] };
    const key = wayKey(way);
    const newWay = !rec.ways.includes(key);
    if (newWay) rec.ways.push(key);
    data.tasks[id] = rec;
    write(data);
    return { first: !prev, newWay, ways: rec.ways.length };
  },
  setLastZone(zone: string): void {
    const data = read();
    if (data.lastZone === zone) return;
    data.lastZone = zone;
    write(data);
  },
  reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
