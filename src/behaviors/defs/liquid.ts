import type { Material } from 'three';
import type { Entity } from '../../core/entity';
import { extinguish } from '../lib/fire';
import { soak, splash } from '../lib/water';
import { defineBehavior } from '../types';

/**
 * A pool of water: translucent, intangible (things sink into it), drags and
 * soaks whatever is inside, splashes on entry. Buoyancy for `floats` things
 * lives in the floats behavior.
 */
export default defineBehavior({
  id: 'liquid',
  tags: ['liquid'],
  attach(e) {
    e.body.collisionResponse = false;
    for (const m of e.materials as Material[]) {
      m.transparent = true;
      m.opacity = 0.72;
      m.depthWrite = false;
      m.needsUpdate = true;
    }
    e.mesh.castShadow = false;
    e.state.inside = new Set<Entity>();
  },
  update(e, world, dt) {
    const p = e.body.position;
    const top = p.y + e.size.y / 2;
    const prev = e.state.inside as Set<Entity>;
    const now = new Set<Entity>();
    for (const o of world.nearby(p, e.radius + 2)) {
      if (o === e || o.has('liquid') || o.has('ghost')) continue;
      if (Math.abs(o.x - p.x) > e.size.x / 2 || Math.abs(o.z - p.z) > e.size.z / 2) continue;
      if (o.y - o.size.y / 2 > top || o.y < p.y - e.size.y / 2 - 0.5) continue;
      now.add(o);
      if (!prev.has(o)) {
        const v = Math.abs(o.body.velocity.y);
        if (v > 1 || o.age > 0.5) splash(world, { x: o.x, y: top, z: o.z }, Math.min(2, 0.5 + o.radius * Math.min(1.5, v / 4)));
      }
      if (o.state.burning || (o.has('hot') && o.prop('extinguishable', 0) > 0)) extinguish(o, world);
      if (o.has('flammable') || o.has('animal') || o.has('explosive')) soak(world, o, 6);
    }
    e.state.inside = now;
    // gentle ripples
    if (Math.random() < dt * 2 * Math.min(4, e.size.x * e.size.z)) {
      world.fx.burst({ x: p.x + (Math.random() - 0.5) * e.size.x * 0.9, y: top + 0.02, z: p.z + (Math.random() - 0.5) * e.size.z * 0.9 }, { count: 1, color: ['#e8f6ff', '#bfe3ff'], speed: 0, up: 0.1, gravity: 0, size: 0.06, life: 0.6, glow: true });
    }
  },
  fixedUpdate(e) {
    for (const o of e.state.inside as Set<Entity>) {
      if (!o.alive || o.has('floats') || o.body.mass === 0) continue;
      // water drag: sink slowly, wobble
      o.body.velocity.scale(0.94, o.body.velocity);
      o.body.angularVelocity.scale(0.94, o.body.angularVelocity);
    }
  },
});
