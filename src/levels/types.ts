import type { GameWorld } from '../core/world';
import type { TerrainOptions } from '../engine/terrain';
import type { TaskDef, ZoneDef } from '../tasks/types';

export type V3 = [number, number, number];

export interface LevelGoal {
  /** One-line goal shown in the HUD, e.g. "Feed the pup". */
  text: string;
  /** Polled every frame; return true when solved. Helpers live in src/levels/goals.ts. */
  check: (world: GameWorld) => boolean;
}

/** Small, visible tasks for a guided level. Completion lasts until restart. */
export interface LevelObjective {
  id: string;
  title: string;
  instruction: string;
  hint: string;
  spells: string[];
  at: V3;
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
  /**
   * Steer the hero toward x,z until within 0.35 m (or timeout). `jump` hops while walking, `up` climbs.
   * With `of` (an object id), x,z is an offset from the nearest such entity, read when the step starts
   * (walk up to a trampoline wherever it came to rest).
   */
  | { walkTo: [number, number]; of?: string; timeout?: number; jump?: boolean; up?: boolean }
  /** Tap a hero key: E grabs or puts down, F throws, Q turns what's held. */
  | { press: 'grab' | 'toss' | 'turn' }
  /** Click (poke) the nearest entity matching an object id near a point. */
  | { poke: string; near?: [number, number] }
  /** Move the hero to a feet position (open world: jump to a task's start). */
  | { teleport: V3 }
  /** Reset the hero's zone to its starting state (for now this reloads the whole world). */
  | { resetZone: true };

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
  /** Several islands at once (the open world). Used instead of `terrain` when set. */
  islands?: Partial<TerrainOptions>[];
  /** Open-world zones: the hero's zone is tracked and a fallen hero respawns at its entry. */
  zones?: ZoneDef[];
  /** Open-world tasks, checked by the task tracker instead of `goal`. */
  tasks?: TaskDef[];
  /** Kept out of the level menu (the open world has its own entry point). */
  hidden?: boolean;
  /** View distance overrides: fog start and end, camera far plane and max zoom-out distance. */
  view?: { fog: [number, number]; far: number; maxDistance: number };
  camera?: { position: V3; target: V3 };
  /** Default spawn point for typed objects (before the player clicks the ground). */
  spawnPoint?: V3;
  /** Optional whitelist of object ids the player may spawn. */
  allowedWords?: string[];
  /** Where the keyboard-controlled hero starts (feet position). Omit for no hero. */
  hero?: V3;
  /** Hero (and pinned things) falling below this height respawn / reset. Default -6. */
  killY?: number;
  /**
   * Max distance (m, horizontal) from the hero that spells may be cast. Stops
   * "just summon it next to the goal" solutions. Omit for anywhere.
   */
  castRange?: number;
  /** Polled every frame: return a message when the attempt is lost (e.g. "The hut burned down!"). */
  fail?: (world: GameWorld) => string | null;
  /** Spells for 3 stars (2 stars up to 2×par). Each successful cast counts once: "giant balloon" = 1. Default 2. */
  par?: number;
  setup: (world: GameWorld) => void;
  goal?: LevelGoal;
  objectives?: LevelObjective[];
  /** Known working solutions, verified by `tools/levels.html`. */
  solutions?: LevelSolution[];
}

export const defineLevel = (def: LevelDef) => def;

/** Stars for a solve using `words` spells (successful casts). The HUD uses this too. */
export const starsFor = (level: LevelDef, words: number): number => starsForPar(level.par ?? 2, words);

/** Star thresholds: 3 stars up to `par` spells, 2 stars up to 2×par, else 1. */
export const starsForPar = (par: number, words: number): number => (words <= par ? 3 : words <= par * 2 ? 2 : 1);

/** "1 spell", "3 spells". */
export const spellsText = (n: number): string => `${n} spell${n === 1 ? '' : 's'}`;
