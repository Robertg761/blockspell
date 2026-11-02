import { Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { defineBehavior } from '../types';

const imp = new Vec3();

/**
 * Picks a fight with the nearest thing. Animals charge it (see `animal`, which
 * reads state.seek); everything else hops at it. Collisions send the victim flying.
 */
export default defineBehavior({
  id: 'angry',
  tags: ['angry'],
  order: 5, // after eats, so the grudge wins over hunger
  update(e, world, dt) {
    if (e.has('frozen')) return;
    let target = e.state.angryAt as Entity | null;
    if (!target?.alive || e.distanceTo(target) > 14 || Math.random() < dt * 0.15) {
      target = world.nearest(e.body.position, 12, (o) => o !== e && o.body.mass > 0 && !o.has('ghost'));
      e.state.angryAt = target;
    }
    if (target) e.state.seek = { x: target.x, y: target.y, z: target.z };
    const p = e.body.position;
    if (Math.random() < dt * 3)
      world.fx.burst({ x: p.x, y: p.y + e.size.y * 0.55, z: p.z }, { count: 1, color: ['#ff4a3a', '#ff8a6a', '#ffffff'], speed: 0.8, up: 1.5, gravity: -0.5, size: 0.08, life: 0.6, grow: true });
    if (!e.has('animal') && target && e.body.mass > 0) {
      let t = ((e.state.hopTimer as number) ?? 1) - dt;
      if (t <= 0) {
        t = 1.2 + Math.random();
        const dx = target.x - p.x, dz = target.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        const m = e.body.mass;
        imp.set((dx / d) * 3 * m, 4 * m, (dz / d) * 3 * m);
        e.body.wakeUp();
        e.body.applyImpulse(imp);
      }
      e.state.hopTimer = t;
    }
    if (Math.random() < dt * 0.3) world.fx.sound(e.def.voice ?? 'thud', { pitch: 0.7 / Math.sqrt(e.scale), volume: 0.6 });
  },
  contact(e, other, world, { speed }) {
    if (!other || other.body.mass === 0 || speed < 0.5) return;
    if (world.time - ((e.state.rammedAt as number) ?? -9) < 0.6) return;
    e.state.rammedAt = world.time;
    const dx = other.x - e.x, dz = other.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const m = Math.min(other.body.mass, e.body.mass * 2 + 1);
    imp.set((dx / d) * 5 * m, 3.5 * m, (dz / d) * 5 * m);
    other.body.wakeUp();
    other.body.applyImpulse(imp);
    world.fx.addShake(0.2);
    world.fx.sound('thud', { volume: 0.8 });
    world.fx.burst(other.body.position, { count: 12, color: ['#ffffff', '#ffd84a'], speed: 4, up: 2, size: 0.07, life: 0.4, glow: true });
  },
});
