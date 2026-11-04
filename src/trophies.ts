import type { EventBus } from './core/events';

/**
 * Trophies: small goals that reward playing around. Everything is counted from game events and saved in
 * localStorage (counters and unlock times), so it works offline and survives reloads. Add a trophy by
 * adding a line to TROPHIES: `stat` names a counter, `goal` is how many it takes.
 */
export interface TrophyDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  stat: string;
  goal: number;
  /** Hidden until unlocked (shown as ???). */
  secret?: boolean;
}

export const TROPHIES: TrophyDef[] = [
  { id: 'first-spell', icon: '🪄', name: 'First Spell', desc: 'Write your first word.', stat: 'casts', goal: 1 },
  { id: 'spellslinger', icon: '✨', name: 'Spellslinger', desc: 'Cast 50 spells.', stat: 'casts', goal: 50 },
  { id: 'wordsmith', icon: '📖', name: 'Wordsmith', desc: 'Discover 10 words.', stat: 'words', goal: 10 },
  { id: 'lexicon', icon: '📚', name: 'Walking Lexicon', desc: 'Discover 40 words.', stat: 'words', goal: 40 },
  { id: 'archivist', icon: '🏛', name: 'Archivist', desc: 'Discover every word in the spellbook.', stat: 'wordsAll', goal: 1 },
  { id: 'overachiever', icon: '🎭', name: 'Overachiever', desc: 'Write a spell with four adjectives.', stat: 'adj4', goal: 1 },
  { id: 'think-big', icon: '🗻', name: 'Think Big', desc: 'Summon something giant.', stat: 'giant', goal: 1 },
  { id: 'tiny', icon: '🔬', name: 'Tiny but Mighty', desc: 'Summon something tiny.', stat: 'tiny', goal: 1 },
  { id: 'rainbow', icon: '🌈', name: 'Taste the Rainbow', desc: 'Summon something rainbow.', stat: 'rainbow', goal: 1 },
  { id: 'crowd', icon: '👥', name: 'Crowd', desc: 'Have 12 things in the world at once.', stat: 'crowd', goal: 1 },
  { id: 'pyro', icon: '🔥', name: 'Pyromaniac', desc: 'Set 10 things on fire.', stat: 'ignites', goal: 10 },
  { id: 'firefighter', icon: '🧯', name: 'Firefighter', desc: 'Put out 5 fires.', stat: 'extinguishes', goal: 5 },
  { id: 'kaboom', icon: '💥', name: 'Kaboom', desc: 'Set off 5 explosions.', stat: 'explosions', goal: 5 },
  { id: 'chain', icon: '⛓', name: 'Chain Reaction', desc: 'Three explosions within five seconds.', stat: 'chain', goal: 1 },
  { id: 'nom', icon: '🍖', name: 'Nom Nom Nom', desc: 'Watch 10 meals get eaten.', stat: 'ate', goal: 10 },
  { id: 'pop', icon: '🎈', name: 'Pop Star', desc: 'Pop 5 balloons.', stat: 'popped', goal: 5 },
  { id: 'butter', icon: '🔨', name: 'Butterfingers', desc: 'Break 5 fragile things.', stat: 'broken', goal: 5 },
  { id: 'photo', icon: '📷', name: 'Photographer', desc: 'Take a photo.', stat: 'photos', goal: 1 },
  { id: 'share', icon: '🔗', name: 'Show and Tell', desc: 'Copy a link to a scene.', stat: 'shares', goal: 1 },
  { id: 'bender', icon: '⏱', name: 'Time Bender', desc: 'Slow down or pause time.', stat: 'timeBent', goal: 1 },
  { id: 'sky', icon: '🌅', name: 'Sky Painter', desc: 'Try every time of day.', stat: 'skies', goal: 4 },
  { id: 'weather', icon: '☃', name: 'Weather Wizard', desc: 'Make it rain and snow.', stat: 'weathers', goal: 2 },
  { id: 'helper', icon: '🤝', name: 'Helping Hand', desc: 'Finish a task in the world.', stat: 'tasks', goal: 1 },
  { id: 'neighbor', icon: '🏡', name: 'Good Neighbor', desc: 'Finish 8 tasks.', stat: 'tasks', goal: 8 },
  { id: 'pathfinder', icon: '🧭', name: 'Pathfinder', desc: 'Solve one task three different ways.', stat: 'ways', goal: 3 },
  { id: 'explorer', icon: '🗺', name: 'Island Hopper', desc: 'Visit every island.', stat: 'zones', goal: 7 },
  { id: 'hero', icon: '🏆', name: 'Hero of the Islands', desc: 'Finish every task.', stat: 'allTasks', goal: 1 },
  { id: 'night', icon: '🌙', name: 'Night Owl', desc: 'Cast a spell at night.', stat: 'nightCasts', goal: 1, secret: true },
];

const KEY = 'blockspell.trophies.v1';

interface Save {
  stats: Record<string, number>;
  unlocked: Record<string, number>;
  /** Named sets of things seen so far (zones visited, skies tried), counted into stats. */
  sets: Record<string, string[]>;
}

function read(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
    const obj = (v: unknown) => (v && typeof v === 'object' ? (v as never) : {});
    return { stats: obj(raw.stats), unlocked: obj(raw.unlocked), sets: obj(raw.sets) };
  } catch {
    return { stats: {}, unlocked: {}, sets: {} };
  }
}

export class Trophies {
  private save = read();
  private blasts: number[] = [];

  constructor(private onUnlock: (t: TrophyDef) => void) {}

  get stats(): Readonly<Record<string, number>> {
    return this.save.stats;
  }

  has(id: string): boolean {
    return id in this.save.unlocked;
  }

  get unlockedCount(): number {
    return TROPHIES.filter((t) => this.has(t.id)).length;
  }

  stat(name: string): number {
    return this.save.stats[name] ?? 0;
  }

  /** Adds to a counter. */
  bump(stat: string, n = 1): void {
    this.setStat(stat, this.stat(stat) + n);
  }

  /** Raises a counter to at least `value` (for totals computed elsewhere, like words discovered). */
  max(stat: string, value: number): void {
    if (value > this.stat(stat)) this.setStat(stat, value);
  }

  private setStat(stat: string, value: number): void {
    this.save.stats[stat] = value;
    for (const t of TROPHIES) if (t.stat === stat && value >= t.goal && !this.has(t.id)) this.unlock(t);
    this.write();
  }

  private unlock(t: TrophyDef): void {
    this.save.unlocked[t.id] = Date.now();
    this.write();
    this.onUnlock(t);
  }

  private write(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.save));
    } catch {
      /* private mode: trophies last until the page closes */
    }
  }

  reset(): void {
    this.save = { stats: {}, unlocked: {}, sets: {} };
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  // ------------------------------------------------------------ feeds from the game

  /** Subscribes to the world's event bus (once; the bus outlives levels). */
  watch(events: EventBus, world: { time: number; living(): unknown[] }): void {
    // things that exist when a level loads (a burning hut) don't count as the player's doing
    const live = () => world.time > 1.5;
    events.on('ignite', () => live() && this.bump('ignites'));
    events.on('extinguish', () => live() && this.bump('extinguishes'));
    events.on('ate', () => this.bump('ate'));
    events.on('popped', () => this.bump('popped'));
    events.on('broken', () => this.bump('broken'));
    events.on('exploded', () => {
      if (!live()) return;
      this.bump('explosions');
      const now = performance.now() / 1000;
      this.blasts = this.blasts.filter((t) => now - t < 5);
      this.blasts.push(now);
      if (this.blasts.length >= 3) this.max('chain', 1);
    });
    events.on('spawn', () => {
      if (world.living().length >= 12) this.max('crowd', 1);
    });
    events.on('photo', () => this.bump('photos'));
    events.on('shared', () => this.bump('shares'));
    events.on('timeBent', () => this.max('timeBent', 1));
  }

  /** A successful spell. */
  noteCast(c: { adjectives: string[]; night: boolean }): void {
    this.bump('casts');
    const ids = new Set(c.adjectives);
    if (c.adjectives.length >= 4) this.max('adj4', 1);
    if (ids.has('giant')) this.max('giant', 1);
    if (ids.has('tiny')) this.max('tiny', 1);
    if (ids.has('rainbow')) this.max('rainbow', 1);
    if (c.night) this.bump('nightCasts');
  }

  noteWords(discovered: number, total: number): void {
    this.max('words', discovered);
    if (discovered >= total) this.max('wordsAll', 1);
  }

  /** Adds a value to a named set and raises the stat of that name to the set's size. */
  private addTo(stat: string, value: string): void {
    const set = (this.save.sets[stat] ??= []);
    if (!set.includes(value)) set.push(value);
    this.max(stat, set.length);
    this.write();
  }

  noteZone(id: string): void {
    this.addTo('zones', id);
  }

  noteTasks(done: number, waysOnThis: number, total: number): void {
    this.max('tasks', done);
    this.max('ways', waysOnThis);
    if (done >= total) this.max('allTasks', 1);
  }

  noteSky(sky: string): void {
    this.addTo('skies', sky);
  }

  noteWeather(w: string): void {
    this.addTo('weathers', w);
  }
}
