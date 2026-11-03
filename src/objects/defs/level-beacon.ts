import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { defineObject } from '../types';

/** Gap between two entities' bounding boxes (0 when they overlap). */
function boxGap(a: Entity, b: Entity): number {
  const pa = a.body.position, pb = b.body.position;
  const gx = Math.max(0, Math.abs(pa.x - pb.x) - (a.size.x + b.size.x) / 2);
  const gy = Math.max(0, Math.abs(pa.y - pb.y) - (a.size.y + b.size.y) / 2);
  const gz = Math.max(0, Math.abs(pa.z - pb.z) - (a.size.z + b.size.z) / 2);
  return Math.hypot(gx, gy, gz);
}

/** Lights the beacon: a lasting flame in the bowl, a glow and an `ignite` event. */
function light(e: Entity, world: GameWorld): void {
  e.state.lit = true;
  world.addTag(e, 'glows');
  world.fx.sound('ignite');
  world.fx.burst({ x: e.x, y: e.y + e.size.y / 2, z: e.z }, { count: 30, color: ['#fff1a0', '#ffc247', '#ff8a2a'], speed: 3, up: 4, gravity: -1, glow: true, life: 0.8, size: 0.14 });
  world.events.emit('ignite', { entity: e });
}

/**
 * A stone brazier on a pedestal (a level object). Anything hot or burning
 * that reaches the bowl lights it for good: a torch, a fire, a candle, a
 * flaming box, lava poured beside it, the sun drifting past. Not flammable
 * itself, so it never burns away.
 */
export default defineObject({
  id: 'beacon',
  name: 'beacon',
  synonyms: ['brazier', 'fire bowl', 'signal fire', 'fire pit'],
  category: 'structures',
  blurb: 'A stone brazier. Bring fire to it and it burns bright.',
  tags: [],
  burstColor: '#ffb347',
  voxelSize: 0.1,
  physics: { anchored: true, mass: 0, shape: 'box', friction: 0.8 },
  props: { glow: 7 },
  build(b) {
    // base, column and a wide bowl with a rim, coals inside (x, z 0..11)
    b.box(1, 0, 1, 10, 1, 10, 'stoneDark');
    b.box(3, 2, 3, 8, 8, 8, 'stone');
    b.box(2, 9, 2, 9, 9, 9, 'stoneDark');
    b.box(0, 10, 0, 11, 12, 11, 'stone');
    b.box(1, 12, 1, 10, 12, 10, 'charcoal');
    b.box(3, 12, 3, 8, 12, 8, 'ember');
    b.paint((x, y, _z, c) => (c === 'stone' && (x + y) % 5 === 0 ? 'stoneDark' : undefined));
  },
  update(e, world, dt) {
    if (e.state.lit) {
      // flames rise out of the bowl, not up the whole pedestal
      let acc = e.state.flameAcc as { f: number; e: number } | undefined;
      if (!acc) e.state.flameAcc = acc = { f: 0, e: 0 };
      const top = e.y + e.size.y / 2 - 0.1;
      world.fx.flames.emit({ x: e.x, y: top, z: e.z }, e.size.x * 0.8, 1.1, dt, 1.2, acc);
      return;
    }
    const near = world.nearby(e.body.position, e.radius + 4, (o) => o !== e && (o.has('hot') || !!o.state.burning));
    const hot = near.some((o) => boxGap(e, o) <= 0.25 + 0.5 * o.prop('heatRadius', 1) * Math.sqrt(o.scale));
    e.state.heat = hot ? e.state.heat + dt : Math.max(0, e.state.heat - dt);
    if (e.state.heat >= 0.5) light(e, world);
  },
});
