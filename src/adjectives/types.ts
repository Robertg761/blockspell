import type { EntityState } from '../core/entity';
import type { Tag } from '../core/tags';
import type { ObjectDef } from '../objects/types';

/** Accumulated modifications applied to an object at spawn time. */
export interface SpawnModifiers {
  scale: number;
  massMul: number;
  addTags: Set<Tag>;
  removeTags: Set<Tag>;
  /** Hex color for the object's tint keys, or null. */
  tint: string | null;
  restitution: number | null;
  friction: number | null;
  /** Initial entity state overrides (e.g. { burning: true }). */
  state: Partial<EntityState>;
  /** Free-form flags for behaviors to read (copied into entity.state). */
  flags: Record<string, unknown>;
}

export function emptyModifiers(): SpawnModifiers {
  return {
    scale: 1,
    massMul: 1,
    addTags: new Set(),
    removeTags: new Set(),
    tint: null,
    restitution: null,
    friction: null,
    state: {},
    flags: {},
  };
}

/**
 * An adjective that modifies a spawned object. Add a file in
 * src/adjectives/defs/ default-exporting one AdjectiveDef or an array.
 */
export interface AdjectiveDef {
  id: string;
  synonyms?: string[];
  /** Adjectives in the same exclusive category replace each other (last wins). */
  category?: 'size' | 'color' | 'temperature' | 'material' | 'weight' | (string & {});
  exclusive?: boolean;
  apply: (mods: SpawnModifiers, def: ObjectDef) => void;
}

export const defineAdjective = (def: AdjectiveDef) => def;
export const defineAdjectives = (defs: AdjectiveDef[]) => defs;
