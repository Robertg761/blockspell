import type { Entity } from '../core/entity';
import type { Tag } from '../core/tags';
import type { GameWorld } from '../core/world';

export interface ContactInfo {
  /** Impact speed along the contact normal (m/s). */
  speed: number;
}

/**
 * A behavior runs for every entity that has at least one of its `tags`.
 * Add a file in src/behaviors/defs/ default-exporting a BehaviorDef (or array).
 * Behaviors communicate through tags, entity.state and world.events.
 */
export interface BehaviorDef {
  id: string;
  tags: Tag[];
  /** Lower runs first. Default 0. */
  order?: number;
  /** Called when an entity spawns with, or later gains, a matching tag. */
  attach?: (e: Entity, world: GameWorld) => void;
  /** Called when the entity loses all matching tags (not on removal). */
  detach?: (e: Entity, world: GameWorld) => void;
  /** Per-frame logic update (dt in seconds), before physics. */
  update?: (e: Entity, world: GameWorld, dt: number) => void;
  /** Runs before every fixed physics substep (1/60 s). Apply forces/velocities here. */
  fixedUpdate?: (e: Entity, world: GameWorld, h: number) => void;
  /** First-contact callback. `other` is null for terrain/static geometry. */
  contact?: (e: Entity, other: Entity | null, world: GameWorld, info: ContactInfo) => void;
}

export const defineBehavior = (def: BehaviorDef) => def;
