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
  /** Overrides the level's cast range while the hero is in this zone. */
  castRange?: number;
  /** Builds the zone's props. `origin` is `center`; pass local coordinates through it. */
  setup(world: GameWorld, origin: V3): void;
}

/** A task in a zone, checked by the task tracker (milestone M2). */
export interface TaskDef {
  id: string;
  zone: string;
  title: string;
  hint: string;
  check: (world: GameWorld) => boolean;
  fail?: (world: GameWorld) => string | null;
  /** Hero start for scripted solves (world space). */
  start: V3;
  solutions: LevelSolution[];
}

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
