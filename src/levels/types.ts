import type { GameWorld } from '../core/world';
import type { TerrainOptions } from '../engine/terrain';

export interface LevelGoal {
  /** Shown in the HUD, e.g. "Feed the dog". */
  text: string;
  /** Polled every frame; return true when solved. */
  check: (world: GameWorld) => boolean;
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
  terrain?: Partial<TerrainOptions>;
  camera?: { position: [number, number, number]; target: [number, number, number] };
  /** Default spawn point for typed objects (before the player clicks the ground). */
  spawnPoint?: [number, number, number];
  /** Optional whitelist of object ids the player may spawn. */
  allowedWords?: string[];
  setup: (world: GameWorld) => void;
  goal?: LevelGoal;
}

export const defineLevel = (def: LevelDef) => def;
