import type { GameWorld } from '../core/world';
import type { TerrainOptions } from '../engine/terrain';
import type { LevelSolution, V3 } from '../levels/types';

/** Axis-aligned world-space box: [min, max]. */
export type Box = [V3, V3];

/**
 * One themed island of the open world. Add a file in src/tasks/zones/
 * default-exporting `defineZone({...})`; zones are sorted by `order`.
 */
export interface ZoneDef {
  id: string;
  /** Shown on the zone banner and in the Journal, e.g. "Ember Village". */
  name: string;
  order: number;
  /** World position of the island center (y is the flat ground height). */
  center: V3;
  /** Island terrain overrides. Its center (cx, cz) always comes from `center`. */
  island: Partial<TerrainOptions>;
  /** World-space area that counts as "in this zone" (the island plus a margin). */
  bounds: Box;
  /** Where the hero comes back after a fall, relative to `center`. */
  entry: V3;
  /** Builds the zone's props. `origin` is `center`; pass local coordinates through it. */
  setup(world: GameWorld, origin: V3): void;
  /** Runs once per setup, the first time the hero sets foot in the zone (e.g. light the hut fire only when someone is there to see it). */
  enter?(world: GameWorld, origin: V3): void;
}

/**
 * A task in a zone, checked by the task tracker (src/tasks/tracker.ts). Add a
 * file in src/tasks/defs/ default-exporting `defineTask({...})`. Checks are
 * outcome predicates from src/tasks/predicates.ts, never word lists.
 */
export interface TaskDef {
  id: string;
  zone: string;
  /** Sort order inside the zone (the plan's task number). */
  order: number;
  title: string;
  hint: string;
  check: Pred;
  /** Polled with the check: return a message when the attempt is lost (reset the zone to retry). */
  fail?: (world: GameWorld) => string | null;
  /**
   * Spells aimed into `box` only reach `range` m from the hero (the level default is 7 m). Keeps a
   * player from casting straight into a walled pen from outside it.
   */
  castLimit?: { box: Box; range: number };
  /** Builds the task's props after the zone setup. `origin` is the zone center. */
  setup?(world: GameWorld, origin: V3): void;
  /** Hero start for scripted solves (world space). */
  start: V3;
  /** Known working solutions in world space, verified by `__blockspell.solveTask`. */
  solutions: LevelSolution[];
}

/**
 * A task check. `arm` (set by predicates like `latch` and `hold`) is called
 * once after every world setup so event listeners can subscribe.
 */
export type Pred = ((world: GameWorld) => boolean) & { arm?: (world: GameWorld, task: string) => void };

export const defineTask = (t: TaskDef) => t;

export type ZoneInput = Omit<ZoneDef, 'bounds' | 'entry'> & { bounds?: Box; entry?: V3 };

/** Fills in defaults: bounds from the island radius (plus a 2 m margin) and an entry at the center. */
export function defineZone(z: ZoneInput): ZoneDef {
  const r = (z.island.radius ?? 12) * 1.1 + 2;
  const [x, y, zz] = z.center;
  return {
    ...z,
    island: { ...z.island, cx: x, cz: zz },
    bounds: z.bounds ?? [[x - r, y - 40, zz - r], [x + r, y + 60, zz + r]],
    entry: z.entry ?? [0, 0, 0],
  };
}

/** Local zone coordinates to world space. */
export const offset = (origin: V3, p: V3): V3 => [origin[0] + p[0], origin[1] + p[1], origin[2] + p[2]];
