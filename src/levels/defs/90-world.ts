import type { GameWorld } from '../../core/world';
import { buildZone, orderedTasks, orderedZones, zoneEntry } from '../../tasks';
import { GAP_MID } from '../../tasks/defs/02-cross-gap';
import { defineLevel, type V3 } from '../types';

const DECK = 2.5;

/** A plank bridge (deck plus side rails) from a to b on the ground at y = 0. */
function bridge(world: GameWorld, a: [number, number], b: [number, number]): void {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  // deck top sits 6 cm above the island grass so the two never z-fight
  world.addStaticBox({ position: [mx, -0.19, mz], size: [DECK, 0.5, len], color: 'woodDark', topColor: 'wood', yaw });
  const rx = Math.cos(yaw), rz = -Math.sin(yaw); // the deck's local x axis in world space
  for (const side of [-1, 1]) {
    const o = side * (DECK / 2 - 0.125);
    world.addStaticBox({ position: [mx + rx * o, 0.185, mz + rz * o], size: [0.25, 0.75, len], color: 'woodDark', yaw });
  }
}

/** Point `r` meters from the origin in direction (dx, dz). */
const along = (dx: number, dz: number, r: number): [number, number] => {
  const l = Math.hypot(dx, dz);
  return [(dx / l) * r, (dz / l) * r];
};

const zones = orderedZones();
const tasks = orderedTasks();
const hub = zones.find((z) => z.id === 'hub')!;
const start: V3 = zoneEntry(hub);

/**
 * The open world: the Meadow Commons hub at the origin with zone islands
 * around it, joined by plank bridges. The Ruins (northwest) have no bridge:
 * two piers end at rocky ledges 4 m apart, and crossing that gap is a task
 * (the ledges are built by the task, src/tasks/defs/02-cross-gap.ts).
 */
export default defineLevel({
  id: 'world',
  name: 'Blockspell World',
  order: 100,
  hidden: true,
  description: 'Roam the islands and help out wherever you can.',
  hint: 'Walk with WASD or arrow keys. Cross the bridges to visit the other islands.',
  terrain: null,
  islands: zones.map((z) => z.island),
  zones,
  tasks,
  hero: start,
  killY: -10,
  castRange: 7,
  camera: { position: [start[0], 7, start[2] + 10], target: [start[0], 0.8, start[2]] },
  spawnPoint: [start[0], 0, start[2] - 3],
  view: { fog: [28, 80], far: 120, maxDistance: 30 },
  setup(world) {
    for (const z of zones) {
      if (z.id === 'hub' || z.id === 'ruins') continue;
      const [cx, , cz] = z.center;
      const d = Math.hypot(cx, cz);
      bridge(world, along(cx, cz, 12.5), along(cx, cz, d - 9));
    }
    const ruins = zones.find((z) => z.id === 'ruins');
    if (ruins) {
      const [cx, , cz] = ruins.center;
      const d = Math.hypot(cx, cz);
      bridge(world, along(cx, cz, 13), along(cx, cz, GAP_MID - 9));
      bridge(world, along(cx, cz, GAP_MID + 7), along(cx, cz, d - 8));
    }
    for (const z of zones) buildZone(world, z, tasks);
  },
});
