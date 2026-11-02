import { Quaternion, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { defineBehavior } from '../types';

type P = { x: number; z: number };
const UP = new Vec3(0, 1, 0);
const tmpQ = new Quaternion();

/**
 * Self-propelled critter: wanders, walks toward `state.seek` (set by e.g. `eats`),
 * and runs from anything hot. Stays upright via the body's angular factor.
 */
export default defineBehavior({
  id: 'animal',
  tags: ['animal'],
  order: 10,
  attach(e) {
    e.body.angularFactor.set(0, 1, 0);
    e.body.allowSleep = false;
    e.state.wander = null;
    e.state.wanderTimer = 0;
    const q = e.body.quaternion;
    e.state.yaw = 2 * Math.atan2(q.y, q.w);
  },
  update(e, world, dt) {
    // flee from heat
    const hot = world.nearest(e.body.position, 3 + e.radius, (o) => o !== e && o.has('hot'));
    e.state.flee = hot ? { x: hot.x, z: hot.z } : null;
    if (hot && Math.random() < dt * 1.5) world.fx.sound('bark', { pitch: 1.3 / Math.sqrt(e.scale), volume: 0.6 });

    let t = (e.state.wanderTimer as number) - dt;
    if (t <= 0) {
      t = 2 + Math.random() * 3;
      e.state.wander = Math.random() < 0.35 ? null : { x: e.x + (Math.random() * 2 - 1) * 4, z: e.z + (Math.random() * 2 - 1) * 4 };
    }
    e.state.wanderTimer = t;

    // cosmetic trot bob
    const v = e.body.velocity;
    const sp = Math.hypot(v.x, v.z);
    const bob = sp > 0.3 ? Math.abs(Math.sin(world.time * 14 + e.id)) * 0.05 * e.scale : 0;
    e.visual.position.y += (bob - e.visual.position.y) * Math.min(1, dt * 20);
  },
  fixedUpdate(e, world, h) {
    const b = e.body;
    const seek = e.state.seek as P | null;
    const flee = e.state.flee as P | null;
    const wander = e.state.wander as P | null;
    let dx = 0, dz = 0, speed = e.prop('speed', 2) * Math.sqrt(e.scale);
    if (flee) {
      dx = b.position.x - flee.x;
      dz = b.position.z - flee.z;
      speed *= 1.6;
    } else if (seek) {
      dx = seek.x - b.position.x;
      dz = seek.z - b.position.z;
      speed *= 1.3;
    } else if (wander) {
      dx = wander.x - b.position.x;
      dz = wander.z - b.position.z;
      if (Math.hypot(dx, dz) < 0.4) e.state.wander = null;
      speed *= 0.5;
    }
    // don't walk off the edge of the world
    const len = Math.hypot(dx, dz);
    if (len > 0.05) {
      dx /= len;
      dz /= len;
      const ahead = world.groundAt(b.position.x + dx * 1.2, b.position.z + dz * 1.2);
      if (ahead === -Infinity || ahead < b.position.y - e.size.y / 2 - 1.5) {
        dx = dz = 0;
        e.state.wander = null;
      }
    } else dx = dz = 0;

    const grounded = Math.abs(b.velocity.y) < 1.2;
    if (grounded) {
      const k = Math.min(1, h * 8);
      b.velocity.x += (dx * speed - b.velocity.x) * k;
      b.velocity.z += (dz * speed - b.velocity.z) * k;
    }
    if (dx || dz) turnToward(e, Math.atan2(dx, dz), h);
    b.angularVelocity.set(0, 0, 0);
  },
});

function turnToward(e: Entity, target: number, h: number): void {
  let yaw = e.state.yaw as number;
  let d = target - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  yaw += d * Math.min(1, h * 10);
  e.state.yaw = yaw;
  tmpQ.setFromAxisAngle(UP, yaw);
  e.body.quaternion.copy(tmpQ);
}
