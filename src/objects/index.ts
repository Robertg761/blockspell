import { Registry } from '../core/registry';
import type { ObjectDef } from './types';

export const objects = new Registry<ObjectDef>('object');

// Every file in ./defs default-exports an ObjectDef or ObjectDef[]; no manual wiring needed.
objects.registerModules(import.meta.glob<{ default: ObjectDef | ObjectDef[] }>('./defs/*.ts', { eager: true }));

/**
 * Words the spellbook tracks: every object except the player character (the
 * hero is you, not something to discover). Totals are derived from this, so
 * adding a noun keeps every counter right.
 */
export const spellbookObjects = (): ObjectDef[] => objects.all().filter((d) => !d.tags.includes('player'));

export type { ObjectDef } from './types';
