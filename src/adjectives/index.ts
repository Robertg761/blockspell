import { Registry } from '../core/registry';
import type { ObjectDef } from '../objects/types';
import type { AdjectiveDef, SpawnModifiers } from './types';
import { emptyModifiers } from './types';

export const adjectives = new Registry<AdjectiveDef>('adjective');

adjectives.registerModules(import.meta.glob<{ default: AdjectiveDef | AdjectiveDef[] }>('./defs/*.ts', { eager: true }));

/** Applies adjectives in order; exclusive categories keep only the last one. */
export function buildModifiers(list: AdjectiveDef[], def: ObjectDef): SpawnModifiers {
  const mods = emptyModifiers();
  const lastOfCategory = new Map<string, number>();
  list.forEach((a, i) => {
    if (a.category && a.exclusive) lastOfCategory.set(a.category, i);
  });
  list.forEach((a, i) => {
    if (a.category && a.exclusive && lastOfCategory.get(a.category) !== i) return;
    a.apply(mods, def);
  });
  mods.scale = Math.min(4, Math.max(0.2, mods.scale));
  return mods;
}

export type { AdjectiveDef, SpawnModifiers } from './types';
