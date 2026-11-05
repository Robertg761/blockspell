import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

definePalette({
  ringGold: { color: '#ffd84a', emissive: true },
  ringLight: { color: '#fff6a8', emissive: true },
});

/** How many hoops the course has, and how long the hero gets from the first to the last (s). */
export const RINGS = { count: 3, seconds: 15 };
/** Task flags: the next ring to fly through, and when the first was passed. */
export const RING_NEXT = 'task:rings:next', RING_START = 'task:rings:start';
/** How close the hero has to pass to the middle of a hoop (m). */
const REACH = 1.8;

const passed = (world: GameWorld) => (world.flags[RING_NEXT] as number | undefined) ?? 0;

/** The whole course starts over: every hoop comes back. */
function restart(world: GameWorld): void {
  world.flags[RING_NEXT] = 0;
  for (const r of world.living((e) => e.def.id === 'ring')) r.root.visible = true;
  world.fx.sound('error', { volume: 0.6 });
  world.events.emit('say', { text: 'Too slow! The rings are back. Try again.' });
}

function check(e: Entity, world: GameWorld): void {
  const next = passed(world);
  const index = e.prop('index', 0);
  // the first hoop keeps the clock, and it stays around (unseen) to do so
  if (index === 0 && next > 0 && next < RINGS.count && world.time - (world.flags[RING_START] as number) > RINGS.seconds) restart(world);
  const h = world.hero;
  if (index !== next || !h?.alive || e.distanceTo(h) > REACH) return;
  if (next === 0) world.flags[RING_START] = world.time;
  world.flags[RING_NEXT] = next + 1;
  e.root.visible = false;
  world.fx.sparkle(e.body.position, ['#fff6a8', '#ffd84a', '#ffffff'], 26);
  world.fx.sound('chime', { pitch: 1 + next * 0.25 });
}

/** A hoop in the air, for the ring course. The hero flies through them in order (see tasks/defs/24-rings.ts). */
export default defineObject({
  id: 'ring',
  name: 'ring',
  tags: ['glows'],
  levelOnly: true,
  burstColor: '#ffd84a',
  voxelSize: 0.1,
  physics: { anchored: true, shape: 'box' },
  props: { index: 0, glow: 3 },
  build(b) {
    for (let a = 0; a < 200; a++) {
      const t = (a / 200) * Math.PI * 2;
      const x = Math.round(Math.cos(t) * 14), y = Math.round(Math.sin(t) * 14);
      b.box(x, y, 0, x + 1, y + 1, 1, a % 25 < 12 ? 'ringGold' : 'ringLight');
    }
  },
  onSpawn(e) {
    e.body.collisionResponse = false;
  },
  update: (e, world) => check(e, world),
});
