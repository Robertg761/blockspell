import { Registry } from '../core/registry';
import type { Entity } from '../core/entity';
import type { BehaviorDef } from './types';

export const behaviors = new Registry<BehaviorDef>('behavior');

behaviors.registerModules(import.meta.glob<{ default: BehaviorDef | BehaviorDef[] }>('./defs/*.ts', { eager: true }));

/** Behaviors that apply to the entity's current tags, sorted by order. */
export function behaviorsFor(e: Entity): BehaviorDef[] {
  return behaviors
    .all()
    .filter((b) => b.tags.some((t) => e.tags.has(t)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export type { BehaviorDef } from './types';
