import { Quaternion, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { canEat } from '../lib/diet';
import { inWater } from '../lib/water';
import { defineBehavior } from '../types';

type P = { x: number; y?: number; z: number };
const UP = new Vec3(0, 1, 0);
const tmpQ = new Quaternion();

/** Top of an entity's world-space bounding box. */
function topOf(o: Entity): number {
  if (o.body.aabbNeedsUpdate) o.body.updateAABB();
  return o.body.aabb.upperBound.y;
}

/** Feet height. */
const feet = (e: Entity) => e.body.position.y - e.size.y / 2;

/**
 * Picks a climbable to get up to `target`: the one we're touching, or the
 * nearest one tall enough to walk over to.
 */
function planClimb(e: Entity, world: GameWorld, target: P): void {
  e.state.climbing = null;
  e.state.climbVia = null;
  if (target.y === undefined || target.y < feet(e) + 0.6) return;
  const ladder = world.nearest(e.body.position, 7, (o) => o !== e && o.has('climbable') && !o.has('ghost') && topOf(o) > feet(e) + 0.5);
  if (!ladder) return;
  if (world.touching(e, ladder, 0.35) || Math.hypot(ladder.x - e.x, ladder.z - e.z) < (ladder.radius * 0.5 + e.radius * 0.6)) e.state.climbing = ladder;
  else e.state.climbVia = { x: ladder.x, z: ladder.z };
}

/**
 * Self-propelled critter: wanders, walks toward `state.seek` (set by eats,
 * player, angry…), runs from heat and predators, climbs climbable things to
 * reach higher targets, swims, and stays upright via the angular factor.
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
    const q2 = new Quaternion();
    q2.setFromAxisAngle(UP, e.state.yaw as number);
    q.copy(q2);
  },
  detach(e) {
    e.body.angularFactor.set(1, 1, 1);
  },
  update(e, world, dt) {
    if (e.has('frozen')) {
      e.state.flee = e.state.climbing = e.state.climbVia = null;
      return;
    }
    // flee from heat (unless we're the angry one) and from predators
    let danger: Entity | null = null;
    if (!e.has('angry')) {
      danger = world.nearest(e.body.position, 3 + e.radius, (o) => o !== e && o.has('hot') && !o.has('glows'));
      if (!danger) danger = world.nearest(e.body.position, 3.5 + e.radius, (o) => o.has('eats') && o.has('animal') && !o.has('frozen') && canEat(o, e));
    }
    e.state.flee = danger ? { x: danger.x, z: danger.z } : null;
    if (danger && Math.random() < dt * 1.5) world.fx.sound(e.def.voice ?? 'bark', { pitch: 1.3 / Math.sqrt(e.scale), volume: 0.6 });

    let t = (e.state.wanderTimer as number) - dt;
    if (t <= 0) {
      t = 2 + Math.random() * 3;
      e.state.wander = Math.random() < 0.35 ? null : { x: e.x + (Math.random() * 2 - 1) * 4, z: e.z + (Math.random() * 2 - 1) * 4 };
      if (Math.random() < 0.15 && e.def.voice) world.fx.sound(e.def.voice, { pitch: 1 / Math.sqrt(e.scale), volume: 0.45 });
    }
    e.state.wanderTimer = t;

    const seek = e.state.seek as P | null;
    if (seek && !danger) planClimb(e, world, seek);
    else e.state.climbing = e.state.climbVia = null;

    // cosmetic trot bob (characters with legs animate themselves)
    if (!e.parts.has('legL')) {
      const v = e.body.velocity;
      const sp = Math.hypot(v.x, v.z);
      const bob = sp > 0.3 ? Math.abs(Math.sin(world.time * 14 + e.id)) * 0.05 * e.scale : 0;
      e.visual.position.y += (bob - e.visual.position.y) * Math.min(1, dt * 20);
    }
  },
  fixedUpdate(e, world, h) {
    const b = e.body;
    if (e.has('frozen')) {
      b.angularVelocity.set(0, 0, 0);
      return;
    }
    const mul = (e.state.speedMul as number) ?? 1;
    const swimmer = e.prop('swims', 0) > 0;
    const wet = (swimmer || e.has('floats')) && inWater(world, e);

    // fish out of water: flop around
    if (swimmer && !wet) {
      if (Math.abs(b.velocity.y) < 0.3 && Math.random() < h * 1.5) {
        b.velocity.set((Math.random() - 0.5) * 2, 2.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2);
        e.state.yaw = (e.state.yaw as number) + (Math.random() - 0.5) * 2;
        tmpQ.setFromAxisAngle(UP, e.state.yaw as number);
        b.quaternion.copy(tmpQ);
      }
      return;
    }

    // climbing
    const ladder = e.state.climbing as Entity | null;
    const seek = e.state.seek as P | null;
    if (ladder?.alive && seek) {
      const top = topOf(ladder);
      if (feet(e) < top + 0.05) {
        b.velocity.y = 1.8 * Math.sqrt(e.scale) * mul;
        b.velocity.x += ((ladder.x - b.position.x) * 1.5 - b.velocity.x) * Math.min(1, h * 6);
        b.velocity.z += ((ladder.z - b.position.z) * 1.5 - b.velocity.z) * Math.min(1, h * 6);
        if (Math.random() < h * 4) world.fx.sound('click', { pitch: 0.7, volume: 0.5 });
        return;
      }
      // over the top: hop toward the goal
      const dx = seek.x - b.position.x, dz = seek.z - b.position.z;
      const d = Math.hypot(dx, dz) || 1;
      b.velocity.set((dx / d) * 2.2, 2.5, (dz / d) * 2.2);
      e.state.climbing = null;
      return;
    }

    const flee = e.state.flee as P | null;
    const wander = e.state.wander as P | null;
    const via = e.state.climbVia as P | null;
    let dx = 0, dz = 0, speed = e.prop('speed', 2) * Math.sqrt(e.scale) * mul;
    if (flee) {
      dx = b.position.x - flee.x;
      dz = b.position.z - flee.z;
      speed *= 1.25;
    } else if (via || seek) {
      const g = via ?? seek!;
      dx = g.x - b.position.x;
      dz = g.z - b.position.z;
      speed *= 1.3;
      if (!via && Math.hypot(dx, dz) < 0.15) dx = dz = 0;
    } else if (wander) {
      dx = wander.x - b.position.x;
      dz = wander.z - b.position.z;
      if (Math.hypot(dx, dz) < 0.4) e.state.wander = null;
      speed *= 0.5;
    }
    const flying = e.has('flies');
    // don't walk off the edge of the world (the hero will hop down small ledges)
    const len = Math.hypot(dx, dz);
    if (len > 0.05) {
      dx /= len;
      dz /= len;
      if (!flying && !wet) {
        const ahead = world.groundAt(b.position.x + dx * 1.2, b.position.z + dz * 1.2);
        const maxDrop = e.has('player') ? 3.2 : 1.5;
        if (ahead === -Infinity || ahead < feet(e) - maxDrop) {
          dx = dz = 0;
          e.state.wander = null;
        }
      }
    } else dx = dz = 0;

    const grounded = Math.abs(b.velocity.y) < 1.2 || flying || wet;
    if (grounded) {
      const k = Math.min(1, h * 8);
      b.velocity.x += (dx * speed - b.velocity.x) * k;
      b.velocity.z += (dz * speed - b.velocity.z) * k;
      // birds: dip toward low targets
      if (flying && seek && seek.y !== undefined && seek.y < b.position.y - 0.3 && len < 2.5) b.velocity.y -= h * 12;
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
