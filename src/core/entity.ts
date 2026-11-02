import type { Body } from 'cannon-es';
import type { Group, Material, Mesh, Vector3 } from 'three';
import type { ObjectDef } from '../objects/types';
import type { BehaviorDef } from '../behaviors/types';
import type { Tag } from './tags';

/**
 * Mutable per-entity state shared between behaviors. Add fields freely —
 * prefer namespaced keys (e.g. `dog.target`) for behavior-private data.
 */
export interface EntityState {
  burning: boolean;
  /** Seconds of burning left. */
  burnLeft: number;
  /** Accumulated heat (0..1+), ignites flammables at 1. */
  heat: number;
  charred: boolean;
  [key: string]: unknown;
}

let nextId = 1;

export class Entity {
  readonly id = nextId++;
  /** Root node, synced to the physics body each frame. */
  readonly root: Group;
  /** Child of root used for cosmetic animation (pop-in, squash, bob). */
  readonly visual: Group;
  readonly mesh: Mesh;
  readonly materials: Material[];
  /** Animated sub-parts from ObjectDef.parts, keyed by name (origin = pivot). */
  readonly parts = new Map<string, Group>();
  readonly tags = new Set<Tag>();
  /** Behaviors currently attached (derived from tags). */
  behaviors: BehaviorDef[] = [];
  state: EntityState = { burning: false, burnLeft: 0, heat: 0, charred: false };
  age = 0;
  alive = true;
  /** Rough bounding radius (world units). */
  readonly radius: number;

  constructor(
    readonly def: ObjectDef,
    readonly body: Body,
    parts: { root: Group; visual: Group; mesh: Mesh; materials: Material[] },
    /** World-space bounding box size. */
    readonly size: Vector3,
    readonly scale: number,
    /** Display label, e.g. "big red ball". */
    readonly label: string,
  ) {
    this.root = parts.root;
    this.visual = parts.visual;
    this.mesh = parts.mesh;
    this.materials = parts.materials;
    this.radius = size.length() * 0.5;
  }

  has(tag: Tag): boolean {
    return this.tags.has(tag);
  }

  /** Numeric object property with fallback (from ObjectDef.props). */
  prop(name: string, fallback: number): number {
    return this.def.props?.[name] ?? fallback;
  }

  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }
  get z() { return this.body.position.z; }

  distanceTo(o: Entity): number {
    return this.body.position.distanceTo(o.body.position);
  }
}
