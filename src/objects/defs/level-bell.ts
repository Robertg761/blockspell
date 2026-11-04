import type { Entity } from '../../core/entity';
import { definePalette } from '../../voxel/palette';
import { defineObject } from '../types';

const hooked = new WeakSet<object>();

definePalette({ bellGold: '#e7b43a', bellGoldLight: '#ffe08a', bellGoldDark: '#b5832a' });

/** Gap between two entities' bounding boxes (0 when they overlap). */
function boxGap(a: Entity, b: Entity): number {
  const pa = a.body.position, pb = b.body.position;
  const gx = Math.max(0, Math.abs(pa.x - pb.x) - (a.size.x + b.size.x) / 2);
  const gy = Math.max(0, Math.abs(pa.y - pb.y) - (a.size.y + b.size.y) / 2);
  const gz = Math.max(0, Math.abs(pa.z - pb.z) - (a.size.z + b.size.z) / 2);
  return Math.hypot(gx, gy, gz);
}

/**
 * A brass bell hung from a frame (a level object). It rings when something moving bumps it, or a blast goes
 * off close by, and then swings and rings for a while. `state.rung` stays true once it has rung.
 */
export default defineObject({
  id: 'bell',
  name: 'bell',
  levelOnly: true,
  category: 'items',
  tags: ['metal'],
  burstColor: '#ffe08a',
  voxelSize: 0.1,
  physics: { anchored: true, mass: 0, shape: 'box', friction: 0.5 },
  parts: [
    {
      name: 'dome',
      solid: true,
      pivot: [4, 10, 4],
      build(b) {
        // a bell: wide lip, narrowing to a crown, with a clapper
        b.ellipsoid(4, 4, 4, 4.2, 4.6, 4.2, 'bellGold');
        b.box(0, 0, 0, 8, 1, 8, 'bellGoldDark');
        b.paint((x, y, z, c) => (c === 'bellGold' && x < 4 && z > 4 && y > 2 ? 'bellGoldLight' : undefined));
        b.set(4, 0, 4, 'woodDark');
      },
    },
  ],
  build(b) {
    // the little ring it hangs from
    b.box(3, 10, 3, 5, 10, 5, 'bellGoldDark');
    b.box(4, 9, 4, 4, 9, 4, 'bellGoldDark');
  },
  onSpawn(_e, world) {
    // one persistent listener per world, so zone resets don't pile up subscriptions
    if (hooked.has(world)) return;
    hooked.add(world);
    world.events.on('exploded', ({ at }) => {
      for (const m of world.entities) {
        if (m.alive && m.def.id === 'bell' && Math.hypot(at.x - m.x, at.y - m.y, at.z - m.z) < 6) ring(m, world, 1.4);
      }
    });
  },
  update(e, world, dt) {
    const dome = e.parts.get('dome');
    let swing = (e.state.swing as number) ?? 0;
    if (swing > 0.005) {
      e.state.swingT = ((e.state.swingT as number) ?? 0) + dt;
      swing *= Math.exp(-dt * 0.9);
      e.state.swing = swing;
      if (dome) dome.rotation.z = Math.sin((e.state.swingT as number) * 11) * swing * 0.45;
      if (swing > 0.5 && Math.random() < dt * 3.5) world.fx.burst({ x: e.x, y: e.y - e.size.y / 2, z: e.z }, { count: 3, color: ['#ffe08a', '#fff6c8'], speed: 1.1, up: 1.4, gravity: -0.5, size: 0.07, life: 0.7, glow: true });
    } else if (dome) dome.rotation.z = 0;
    // something moving, bumping the bell
    if (swing > 0.6) return;
    for (const o of world.nearby(e.body.position, e.radius + 2) as Entity[]) {
      if (o === e || o === world.hero || o.body.mass === 0 || o.has('ghost') || o.has('liquid')) continue;
      const v = o.body.velocity.length();
      if (v > 1.1 && boxGap(e, o) <= 0.12) {
        ring(e, world, Math.min(2, 0.6 + v * 0.25));
        return;
      }
    }
  },
});

function ring(e: Entity, world: import('../../core/world').GameWorld, strength: number): void {
  e.state.swing = Math.max((e.state.swing as number) ?? 0, strength);
  e.state.swingT = 0;
  if (!e.state.rung) world.fx.sparkle({ x: e.x, y: e.y, z: e.z }, ['#ffe08a', '#ffffff'], 20);
  e.state.rung = true;
  world.fx.sound('clank', { pitch: 0.7, volume: 0.9 });
  world.fx.sound('chime', { pitch: 0.55, volume: 0.9 });
}
