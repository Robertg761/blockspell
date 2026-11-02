import type { Entity } from '../core/entity';
import type { Rng } from '../core/rng';
import type { Tag } from '../core/tags';
import type { GameWorld } from '../core/world';
import type { SoundName } from '../engine/audio';
import type { VoxelBuilder } from '../voxel/builder';

export interface ObjectPhysics {
  /** Mass in kg at scale 1 (scaled by scale³). 0 = static. Default 1. */
  mass?: number;
  /** Collision shape: auto = greedy box decomposition of the voxels. Default 'auto'. */
  shape?: 'auto' | 'box' | 'sphere';
  /** Max boxes for 'auto'. Default 8. */
  maxBoxes?: number;
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  /** Only allow rotation around Y (animals, fire). */
  uprightOnly?: boolean;
}

/**
 * A spawnable thing. Add a new file in src/objects/defs/ that default-exports
 * one ObjectDef (or an array) and it is picked up automatically.
 */
export interface ObjectDef {
  /** Unique id, also the canonical word. */
  id: string;
  /** Display name. */
  name: string;
  /** Extra words/phrases that summon this object (lowercase, singular). */
  synonyms?: string[];
  tags: Tag[];
  /** Voxel model builder. Use `rng` for per-spawn variation. Y is up, front faces +Z. */
  build: (b: VoxelBuilder, rng: Rng) => void;
  /** World size of one voxel at scale 1. Default 0.1. */
  voxelSize?: number;
  physics?: ObjectPhysics;
  /** Palette keys considered the "main color"; color adjectives retint these. */
  tintKeys?: string[];
  /** Free-form numeric tuning used by behaviors (e.g. burnTime, lift, speed). */
  props?: Record<string, number>;
  /** Sound played on spawn (default 'pop'). */
  spawnSound?: SoundName;
  /** Particle color for the spawn burst (default: first tint key / white). */
  burstColor?: string;
  /** Short flavor text shown on spawn. */
  blurb?: string;
  /** Category for the spellbook UI. */
  category?: string;
  onSpawn?: (e: Entity, world: GameWorld) => void;
  /** Object-specific per-frame logic (cosmetic animation etc.). */
  update?: (e: Entity, world: GameWorld, dt: number) => void;
}

export const defineObject = (def: ObjectDef) => def;
