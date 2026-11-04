/**
 * Backing up and restoring everything the game keeps in localStorage (progress, trophies, spellbook,
 * settings, pinned spells...). A save is a small JSON file, so it works offline and moves between devices.
 */
const PREFIX = 'blockspell.';
const FORMAT = 'blockspell-save';
const KEY_OK = /^blockspell\.[A-Za-z0-9_.-]{1,60}$/;
const MAX_VALUE = 200_000;
const MAX_TOTAL = 1_000_000;

export interface SaveFile {
  format: typeof FORMAT;
  version: 1;
  saved: string;
  data: Record<string, string>;
}

/** Every key the game owns, with its raw value. */
export function collect(): Record<string, string> {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) data[k] = localStorage.getItem(k) ?? '';
    }
  } catch {
    /* storage blocked: nothing to save */
  }
  return data;
}

export function exportSave(now = new Date()): string {
  const file: SaveFile = { format: FORMAT, version: 1, saved: now.toISOString(), data: collect() };
  return JSON.stringify(file, null, 1);
}

export type ImportResult = { ok: true; keys: number } | { ok: false; error: string };

/** Checks a save file and returns the values it would restore, or why it is not usable. */
export function parseSave(text: string): { ok: true; data: Record<string, string> } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not a Blockspell save (it is not valid JSON).' };
  }
  const f = raw as Partial<SaveFile> | null;
  if (!f || f.format !== FORMAT || f.version !== 1 || !f.data || typeof f.data !== 'object') return { ok: false, error: 'That file is not a Blockspell save.' };
  const data: Record<string, string> = {};
  let total = 0;
  for (const [k, v] of Object.entries(f.data)) {
    if (!KEY_OK.test(k) || typeof v !== 'string' || v.length > MAX_VALUE) return { ok: false, error: `The save has an entry I don't trust (${k.slice(0, 30)}).` };
    total += v.length;
    data[k] = v;
  }
  if (total > MAX_TOTAL) return { ok: false, error: 'That save is far too big to be real.' };
  if (!Object.keys(data).length) return { ok: false, error: 'That save is empty.' };
  return { ok: true, data };
}

/** Replaces the game's saved data with the save's. The caller reloads the page afterwards. */
export function importSave(text: string): ImportResult {
  const parsed = parseSave(text);
  if (!parsed.ok) return parsed;
  try {
    for (const k of Object.keys(collect())) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(parsed.data)) localStorage.setItem(k, v);
  } catch {
    return { ok: false, error: "The browser wouldn't let me write the save." };
  }
  return { ok: true, keys: Object.keys(parsed.data).length };
}

export function saveFileName(now = new Date()): string {
  return `blockspell-save-${now.toISOString().slice(0, 10)}.json`;
}
