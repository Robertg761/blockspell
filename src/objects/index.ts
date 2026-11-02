import { Registry } from '../core/registry';
import type { ObjectDef } from './types';

export const objects = new Registry<ObjectDef>('object');

// Every file in ./defs default-exports an ObjectDef or ObjectDef[]; no manual wiring needed.
objects.registerModules(import.meta.glob<{ default: ObjectDef | ObjectDef[] }>('./defs/*.ts', { eager: true }));

export type { ObjectDef } from './types';
