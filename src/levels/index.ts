import { Registry } from '../core/registry';
import type { LevelDef } from './types';

export const levels = new Registry<LevelDef>('level');

levels.registerModules(import.meta.glob<{ default: LevelDef | LevelDef[] }>('./defs/*.ts', { eager: true }));

export const orderedLevels = () => levels.all().sort((a, b) => a.order - b.order);

/** Levels shown in the level menu (everything but hidden ones like the open world). */
export const menuLevels = () => orderedLevels().filter((l) => !l.hidden);

export type { LevelDef } from './types';
