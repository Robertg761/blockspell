import type { Material } from 'three';
import { GROUP } from '../../core/groups';
import { defineBehavior } from '../types';

/** Translucent and intangible: collides only with the terrain, drifts and shimmers. */
export default defineBehavior({
  id: 'ghost',
  tags: ['ghost'],
  attach(e) {
    for (const m of e.materials as Material[]) {
      m.transparent = true;
      m.opacity = 0.38;
      m.depthWrite = false;
      m.needsUpdate = true;
    }
    e.visual.traverse((o) => { o.castShadow = false; });
    e.body.collisionFilterGroup = GROUP.GHOST;
    e.body.collisionFilterMask = GROUP.STATIC;
  },
  detach(e) {
    for (const m of e.materials as Material[]) {
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
      m.needsUpdate = true;
    }
    e.visual.traverse((o) => { o.castShadow = true; });
    e.body.collisionFilterGroup = GROUP.ENTITY;
    e.body.collisionFilterMask = -1;
  },
  update(e, world, dt) {
    for (const m of e.materials as Material[]) m.opacity = 0.3 + Math.sin(world.time * 3 + e.id) * 0.1;
    if (Math.random() < dt * 3) {
      const p = e.body.position;
      world.fx.burst({ x: p.x + (Math.random() - 0.5) * e.size.x, y: p.y, z: p.z + (Math.random() - 0.5) * e.size.z }, { count: 1, color: ['#e8f0ff', '#cfdcff'], speed: 0.2, up: 0.6, gravity: -0.4, drag: 1, size: 0.1, life: 1.2, grow: true });
    }
  },
});
