import { Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { defineBehavior } from '../types';

const f = new Vec3();

/** Pulls nearby metal things toward itself (and gets tugged back a little). */
export default defineBehavior({
  id: 'magnet',
  tags: ['magnet'],
  attach(e) {
    e.state.magnetTargets = [];
  },
  update(e, world, dt) {
    const range = e.prop('magnetRange', 6) * Math.sqrt(e.scale);
    const targets = world.nearby(e.body.position, range, (o) => o !== e && o.has('metal') && !o.has('ghost'));
    e.state.magnetTargets = targets;
    if (targets.length && Math.random() < dt * 8) {
      const o = targets[Math.floor(Math.random() * targets.length)];
      const t = Math.random();
      world.fx.burst(
        { x: o.x + (e.x - o.x) * t, y: o.y + (e.y - o.y) * t, z: o.z + (e.z - o.z) * t },
        { count: 1, color: ['#7fb2ff', '#c6dcff', '#ff7a7a'], speed: 0.3, up: 0, gravity: 0, drag: 2, size: 0.05, life: 0.4, glow: true },
      );
    }
  },
  fixedUpdate(e) {
    const targets = e.state.magnetTargets as Entity[];
    if (!targets?.length) return;
    const range = e.prop('magnetRange', 6) * Math.sqrt(e.scale);
    const strength = e.prop('magnetForce', 30) * e.scale;
    for (const o of targets) {
      if (!o.alive) continue;
      const dx = e.x - o.x, dy = e.y - o.y, dz = e.z - o.z;
      const d = Math.hypot(dx, dy, dz);
      const gap = d - (e.radius + o.radius) * 0.6;
      if (gap < 0.05) {
        // clamped on: kill relative motion so it sticks
        o.body.velocity.scale(0.8, o.body.velocity);
        continue;
      }
      const fall = Math.max(0, 1 - d / range);
      const mag = strength * (0.08 + fall * fall * 1.6) * Math.min(o.body.mass, 8);
      f.set((dx / d) * mag, (dy / d) * mag, (dz / d) * mag);
      if (o.body.mass > 0) {
        o.body.wakeUp();
        o.body.applyForce(f);
      }
      if (e.body.mass > 0) {
        f.scale(-0.4, f);
        e.body.applyForce(f);
      }
    }
  },
});
