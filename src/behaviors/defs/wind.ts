import { Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { defineBehavior } from '../types';

const FWD = new Vec3(0, 0, 1);
const fwd = new Vec3();
const f = new Vec3();

/** Blows things in a cone in front of it (local +Z). Light things fly, heavy things barely budge. */
export default defineBehavior({
  id: 'wind',
  tags: ['wind'],
  attach(e) {
    e.state.windTargets = [];
  },
  update(e, world, dt) {
    if (e.has('frozen')) {
      e.state.windTargets = [];
      return;
    }
    const range = e.prop('windRange', 6) * Math.sqrt(e.scale);
    e.body.quaternion.vmult(FWD, fwd);
    const hits: [Entity, number][] = [];
    for (const o of world.nearby(e.body.position, range + 1)) {
      if (o === e || o.body.mass === 0) continue;
      const dx = o.x - e.x, dy = o.y - e.y, dz = o.z - e.z;
      const along = dx * fwd.x + dy * fwd.y + dz * fwd.z;
      if (along <= 0 || along > range) continue;
      const lat = Math.hypot(dx - fwd.x * along, dy - fwd.y * along, dz - fwd.z * along);
      if (lat > e.radius * 0.8 + along * 0.3 + o.radius * 0.5) continue;
      hits.push([o, 1 - along / range]);
    }
    e.state.windTargets = hits;
    if (Math.random() < dt * 14) {
      const p = e.body.position;
      const r = e.radius * 0.5;
      world.fx.burst(
        { x: p.x + fwd.x * e.radius + (Math.random() - 0.5) * r, y: p.y + (Math.random() - 0.3) * r, z: p.z + fwd.z * e.radius + (Math.random() - 0.5) * r },
        { count: 1, color: ['#ffffff', '#e6f3ff'], speed: 0.2, up: 0, gravity: 0, drag: 0.3, size: 0.04, life: range / 7, spread: 0 },
      );
      // particles inherit no velocity option, so nudge the newest one along the wind
    }
  },
  fixedUpdate(e) {
    const hits = e.state.windTargets as [Entity, number][];
    if (!hits?.length) return;
    const strength = e.prop('windForce', 14) * Math.sqrt(e.scale);
    for (const [o, fall] of hits) {
      if (!o.alive) continue;
      const m = Math.min(Math.max(o.body.mass, 0.05), 4);
      const mag = strength * fall * m;
      f.set(fwd.x * mag, fwd.y * mag + mag * 0.15, fwd.z * mag);
      o.body.wakeUp();
      o.body.applyForce(f);
    }
  },
});
