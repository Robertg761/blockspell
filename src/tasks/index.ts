import { Registry } from '../core/registry';
import type { V3 } from '../levels/types';
import type { Box, ZoneDef } from './types';

export const zones = new Registry<ZoneDef>('zone');

zones.registerModules(import.meta.glob<{ default: ZoneDef | ZoneDef[] }>('./zones/*.ts', { eager: true }));

export const orderedZones = () => zones.all().sort((a, b) => a.order - b.order);

const inside = (b: Box, x: number, y: number, z: number) =>
  x >= b[0][0] && x <= b[1][0] && y >= b[0][1] && y <= b[1][1] && z >= b[0][2] && z <= b[1][2];

/** The zone whose bounds contain a point (the nearest center wins on overlap), or null (bridges, the void). */
export function zoneAt(x: number, y: number, z: number, list: ZoneDef[] = orderedZones()): ZoneDef | null {
  let best: ZoneDef | null = null, bestD = Infinity;
  for (const zone of list) {
    if (!inside(zone.bounds, x, y, z)) continue;
    const d = Math.hypot(x - zone.center[0], z - zone.center[2]);
    if (d < bestD) {
      best = zone;
      bestD = d;
    }
  }
  return best;
}

/** World-space feet position where the hero enters (and respawns in) a zone. */
export const zoneEntry = (zone: ZoneDef): V3 => [zone.center[0] + zone.entry[0], zone.center[1] + zone.entry[1], zone.center[2] + zone.entry[2]];

export type { Box, TaskDef, ZoneDef } from './types';
