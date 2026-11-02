import { Quaternion, Ray, RaycastResult, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { GROUP } from '../../core/groups';
import type { GameWorld } from '../../core/world';
import { defineBehavior } from '../types';

const UP = new Vec3(0, 1, 0);
const tmpQ = new Quaternion();
const ray = new Ray();
const rayHit = new RaycastResult();
const rayFrom = new Vec3(), rayTo = new Vec3();

/** Horizontal probe from the hero's center at height `y`, `len` m along (dx, dz). */
function blocked(e: Entity, world: GameWorld, y: number, dx: number, dz: number, len: number): boolean {
  rayFrom.set(e.x, y, e.z);
  rayTo.set(e.x + dx * len, y, e.z + dz * len);
  rayHit.reset();
  ray.from.copy(rayFrom);
  ray.to.copy(rayTo);
  ray.intersectWorld(world.physics, { mode: Ray.CLOSEST, result: rayHit, skipBackfaces: true, collisionFilterMask: GROUP.STATIC | GROUP.ENTITY });
  return rayHit.hasHit && rayHit.body !== e.body;
}

export const HERO = {
  speed: 3.6,
  jump: 5.2,
  climb: 2.6,
  /** Per-substep velocity blend on the ground / in the air. */
  groundAccel: 0.28,
  airAccel: 0.07,
  coyote: 0.12,
  jumpBuffer: 0.14,
};

const feet = (e: Entity) => e.body.position.y - e.size.y / 2;

/** True if the last physics step left the hero resting on something (terrain, static or entity). */
function onGround(e: Entity, world: GameWorld): boolean {
  for (const c of world.physics.contacts) {
    if (c.bi === e.body && c.ni.y < -0.5) return true;
    if (c.bj === e.body && c.ni.y > 0.5) return true;
  }
  return false;
}

/** The climbable thing the hero is overlapping (ladder, rope, tree, stairs), if any. */
function climbableAt(e: Entity, world: GameWorld): Entity | null {
  const p = e.body.position;
  const f = feet(e);
  for (const o of world.entities) {
    if (!o.alive || o === e || !o.has('climbable') || o.has('ghost') || o.has('frozen')) continue;
    if (o.body.aabbNeedsUpdate) o.body.updateAABB();
    const { lowerBound: lo, upperBound: hi } = o.body.aabb;
    const pad = 0.3;
    if (p.x < lo.x - pad || p.x > hi.x + pad || p.z < lo.z - pad || p.z > hi.z + pad) continue;
    if (f > hi.y + 0.02 || f + e.size.y < lo.y) continue;
    return o;
  }
  return null;
}

/**
 * The keyboard-driven hero: reads `world.input` (camera-relative, set by the
 * game), walks, jumps, climbs climbables and stands on anything solid.
 * While climbing it ignores other entities so it doesn't knock its ladder over.
 */
export default defineBehavior({
  id: 'controlled',
  tags: ['controlled'],
  order: 5,
  attach(e) {
    e.body.angularFactor.set(0, 0, 0);
    e.body.angularVelocity.set(0, 0, 0);
    e.body.allowSleep = false;
    e.body.linearDamping = 0;
    const q = e.body.quaternion;
    e.state.yaw = 2 * Math.atan2(q.y, q.w);
    e.state.airTime = 0;
    e.state.jumpBuf = 0;
    e.state.climbing = false;
  },
  detach(e) {
    e.body.angularFactor.set(0, 1, 0);
    e.body.collisionFilterMask = -1;
  },
  update(e, world, dt) {
    // cosmetic: walk bob and climb wiggle
    const v = e.body.velocity;
    const sp = Math.hypot(v.x, v.z);
    const climbing = e.state.climbing as boolean;
    const bob = climbing ? Math.sin(world.time * 16) * 0.03 : sp > 0.4 && (e.state.airTime as number) < 0.1 ? Math.abs(Math.sin(world.time * 13)) * 0.06 : 0;
    e.visual.position.y += (bob - e.visual.position.y) * Math.min(1, dt * 20);
    // footstep dust
    if (sp > 1.5 && (e.state.airTime as number) === 0 && Math.random() < dt * 7)
      world.fx.burst({ x: e.x, y: feet(e) + 0.05, z: e.z }, { count: 3, color: ['#e8dcc0', '#cdbf9f'], speed: 0.8, up: 0.6, size: 0.07, life: 0.4, gravity: 1, grow: true });
  },
  fixedUpdate(e, world, h) {
    const b = e.body;
    if (e.has('frozen')) return;
    const inp = world.input;
    const grounded = onGround(e, world);
    const wasAir = e.state.airTime as number;
    e.state.airTime = grounded ? 0 : wasAir + h;
    if (grounded && wasAir > 0.35 && (e.state.lastVy as number) < -4) {
      world.fx.burst({ x: e.x, y: feet(e) + 0.05, z: e.z }, { count: 12, color: ['#e8dcc0', '#ffffff'], speed: 2.2, up: 0.8, size: 0.1, life: 0.5, gravity: 1, grow: true });
      world.fx.sound('thud', { volume: 0.35, pitch: 1.4 });
    }
    e.state.lastVy = b.velocity.y;

    e.state.jumpBuf = inp.jump && !e.state.jumpHeld ? HERO.jumpBuffer : Math.max(0, (e.state.jumpBuf as number) - h);
    e.state.jumpHeld = inp.jump;

    let mx = inp.move.x, mz = inp.move.z;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    // ---- climbing
    const ladder = climbableAt(e, world);
    const wantsUp = inp.up || inp.jump;
    if (ladder && (wantsUp || (e.state.climbing && inp.down))) {
      if (!e.state.climbing) world.fx.sound('click', { pitch: 0.7, volume: 0.5 });
      e.state.climbing = true;
      b.collisionFilterMask = GROUP.STATIC; // don't shove the ladder away
      b.velocity.y = inp.down ? -HERO.climb : HERO.climb;
      b.velocity.x += (mx * HERO.speed * 0.5 - b.velocity.x) * HERO.groundAccel;
      b.velocity.z += (mz * HERO.speed * 0.5 - b.velocity.z) * HERO.groundAccel;
      if (Math.random() < h * 5) world.fx.sound('click', { pitch: 0.6 + Math.random() * 0.2, volume: 0.35 });
      e.state.jumpBuf = 0;
      return;
    }
    if (e.state.climbing) {
      e.state.climbing = false;
      b.collisionFilterMask = -1;
      // reached the top: hop up and over the lip
      if (wantsUp && !ladder) {
        b.velocity.y = Math.max(b.velocity.y, 3.6);
        const yaw = e.state.yaw as number;
        const fx = ml > 0.1 ? mx : Math.sin(yaw), fz = ml > 0.1 ? mz : Math.cos(yaw);
        b.velocity.x = fx * 2.2;
        b.velocity.z = fz * 2.2;
      }
    }

    // ---- walking
    const k = grounded ? HERO.groundAccel : HERO.airAccel;
    if (grounded || ml > 0.05) {
      b.velocity.x += (mx * HERO.speed - b.velocity.x) * k;
      b.velocity.z += (mz * HERO.speed - b.velocity.z) * k;
    }
    // step-up: walking into something knee-high (a stair, a log) hops onto it
    if (grounded && ml > 0.5 && b.velocity.y < 1) {
      const f = feet(e), len = e.size.z / 2 + 0.3, ux = mx / Math.hypot(mx, mz), uz = mz / Math.hypot(mx, mz);
      if (blocked(e, world, f + 0.06, ux, uz, len) && !blocked(e, world, f + 0.6, ux, uz, len + 0.15)) b.velocity.y = 3.6;
    }

    // ---- jumping
    if ((e.state.jumpBuf as number) > 0 && (e.state.airTime as number) < HERO.coyote) {
      b.velocity.y = HERO.jump;
      e.state.airTime = HERO.coyote; // no double jumps off coyote time
      e.state.jumpBuf = 0;
      world.fx.sound('boing', { volume: 0.25, pitch: 1.5 });
      world.fx.burst({ x: e.x, y: feet(e) + 0.05, z: e.z }, { count: 8, color: ['#e8dcc0', '#ffffff'], speed: 1.6, up: 0.5, size: 0.08, life: 0.4, gravity: 1, grow: true });
    }

    if (ml > 0.1) {
      let yaw = e.state.yaw as number;
      let d = Math.atan2(mx, mz) - yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw += d * Math.min(1, h * 14);
      e.state.yaw = yaw;
    }
    tmpQ.setFromAxisAngle(UP, e.state.yaw as number);
    b.quaternion.copy(tmpQ);
    b.angularVelocity.set(0, 0, 0);
  },
});
