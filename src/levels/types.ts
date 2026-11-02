import type { GameWorld } from '../core/world';
import type { TerrainOptions } from '../engine/terrain';

export type V3 = [number, number, number];

export interface LevelGoal {
  /** One-line goal shown in the HUD, e.g. "Feed the pup". */
  text: string;
  /** Polled every frame; return true when solved. Helpers live in src/levels/goals.ts. */
  check: (world: GameWorld) => boolean;
}

/**
 * One step of a scripted solution (see src/levels/solve.ts). Solutions are
 * replayed headlessly by tools/levels.html to prove each level is solvable.
 */
export type SolutionStep =
  /** Aim at x,z (y = ground/top surface there, or explicit) and cast a spell, exactly like the player. */
  | { cast: string; at: [number, number] | V3 }
  /** Let the simulation run. */
  | { wait: number }
  /** Hold hero input for `for` seconds. dir is a world-space direction [x, z]. */
  | { hold: { dir?: [number, number]; up?: boolean; down?: boolean; jump?: boolean }; for: number }
  /** Steer the hero toward x,z until within 0.35 m (or timeout). `jump` hops while walking, `up` climbs. */
  | { walkTo: [number, number]; timeout?: number; jump?: boolean; up?: boolean }
  /** Click (poke) the nearest entity matching an object id near a point. */
  | { poke: string; near?: [number, number] };

export interface LevelSolution {
  /** Short human description, e.g. "giant balloon lifts the star". */
  name: string;
  steps: SolutionStep[];
  /** Max seconds to wait for the goal after the last step. Default 15. */
  timeout?: number;
}

/**
 * A level. Add a file in src/levels/defs/ default-exporting a LevelDef.
 * Levels are sorted by `order`. Use `world.on(...)` inside setup for event
 * subscriptions — they are cleaned up automatically on level change.
 */
export interface LevelDef {
  id: string;
  name: string;
  order: number;
  description: string;
  hint?: string;
  /** Island terrain overrides, or null for no island (build everything from static boxes over the void). */
  terrain?: Partial<TerrainOptions> | null;
  camera?: { position: V3; target: V3 };
  /** Default spawn point for typed objects (before the player clicks the ground). */
  spawnPoint?: V3;
  /** Optional whitelist of object ids the player may spawn. */
  allowedWords?: string[];
  /** Where the keyboard-controlled hero starts (feet position). Omit for no hero. */
  hero?: V3;
  /** Hero (and pinned things) falling below this height respawn / reset. Default -6. */
  killY?: number;
  /** Words for 3 stars (2 stars up to 2×par). Each word in a spell counts: "giant balloon" = 2. Default 2. */
  par?: number;
  setup: (world: GameWorld) => void;
  goal?: LevelGoal;
  /** Known working solutions, verified by `tools/levels.html`. */
  solutions?: LevelSolution[];
}

export const defineLevel = (def: LevelDef) => def;

/** Stars for a solve using `words` words. */
export const starsFor = (level: LevelDef, words: number): number => {
  const par = level.par ?? 2;
  return words <= par ? 3 : words <= par * 2 ? 2 : 1;
};
