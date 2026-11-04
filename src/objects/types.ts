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
  /**
   * Explicit collider boxes for 'auto' in voxel coords, [x0, y0, z0, x1, y1, z1]
   * with max exclusive. Skips the decomposition (for detailed models whose
   * voxels don't decompose well, e.g. the braided rope).
   */
  boxes?: [number, number, number, number, number, number][];
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  /** Only allow rotation around Y (animals, fire). */
  uprightOnly?: boolean;
  /** Static: snaps onto the ground where it's cast and never moves (trees, walls, pools). */
  anchored?: boolean;
}

/** Spellbook sections. */
export type ObjectCategory = 'animals' | 'vehicles' | 'structures' | 'nature' | 'food' | 'items';

/**
 * A separately meshed sub-part (rotor, fan blade, wheel…) that can be animated
 * in `update` via `e.parts.get(name)`. It is built in the same voxel
 * coordinate space as the main model, so it lines up automatically. The part's
 * Group origin sits at `pivot` (voxel coords, default: the part's own center),
 * so rotating it spins it around that point. Parts are cosmetic: they have no
 * collision shape, but they are tinted and scaled like the main model.
 */
export interface PartDef {
  name: string;
  build: (b: VoxelBuilder, rng: Rng) => void;
  pivot?: [number, number, number];
  /**
   * Counts as part of the body: its voxels still shape the object's size and
   * collider, as if built in the main model. For limbs split off a character,
   * so animating them never changes how it stands or collides.
   */
  solid?: boolean;
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
  /**
   * Voxel model builder. Use `rng` for per-spawn variation. Y is up, front faces +Z.
   * `props` is `props` merged with the spawn's own overrides (a level pool sized by props).
   */
  build: (b: VoxelBuilder, rng: Rng, props: Record<string, number>) => void;
  /** World size of one voxel at scale 1. Default 0.1. */
  voxelSize?: number;
  physics?: ObjectPhysics;
  /** Palette keys considered the "main color"; color adjectives retint these. */
  tintKeys?: string[];
  /** Free-form numeric tuning used by behaviors (e.g. burnTime, lift, speed). A spawn may override them (SpawnOptions.props). */
  props?: Record<string, number>;
  /** Only placed by levels: no spell word summons it and it stays out of the spellbook (the lake's pool). */
  levelOnly?: boolean;
  /** Sound played on spawn (default 'pop'). */
  spawnSound?: SoundName;
  /** Particle color for the spawn burst (default: first tint key / white). */
  burstColor?: string;
  /** Short flavor text shown on spawn. */
  blurb?: string;
  /** Category for the spellbook UI. */
  category?: ObjectCategory;
  /**
   * What this eater eats (needs the `eats` tag): object ids or tags,
   * e.g. ['mouse', 'fish'] or ['edible']. Default: anything `edible`.
   */
  diet?: string[];
  /** Call sound for animals (barks when poked / scared). */
  voice?: SoundName;
  /** Animated cosmetic sub-meshes; see PartDef. */
  parts?: PartDef[];
  /** Object ids spawned when this breaks (fragile) or burns up (e.g. crate -> ['plank']). */
  debris?: string[];
  /**
   * How a cast lines it up (default: random yaw). Directions are from the caster
   * (the hero, or the camera) toward where it's cast:
   * 'span' points local +X that way (bridges, planks, ramps rising away);
   * 'face' turns local +Z back toward the caster (stairs rise away, ladders face you);
   * 'away' points local +Z away from the caster (fans blow and boats sail away from you).
   */
  orient?: 'span' | 'face' | 'away';
  onSpawn?: (e: Entity, world: GameWorld) => void;
  /** Object-specific per-frame logic (cosmetic animation etc.). */
  update?: (e: Entity, world: GameWorld, dt: number) => void;
}

export const defineObject = (def: ObjectDef) => def;
