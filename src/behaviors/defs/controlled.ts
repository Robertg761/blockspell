import { Quaternion, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { GROUP } from '../../core/groups';
import type { GameWorld } from '../../core/world';
import { carryLoad, heldBy } from '../lib/carry';
import { blocked, HERO } from '../lib/hero';
import { defineBehavior } from '../types';

const UP = new Vec3(0, 1, 0);
const tmpQ = new Quaternion();

const feet = (e: Entity) => e.body.position.y - e.size.y / 2;

/**
 * True if the last physics step left the hero resting on something solid (terrain,
 * static or entity; not water), or wedged motionless against it with nothing underfoot,
 * as when squeezed between the top of some stairs and a cliff. The wait keeps
 * the instant at the top of a jump beside a wall from counting as standing.
 */
function onGround(e: Entity, world: GameWorld, h: number): boolean {
  let touching = false;
  for (const c of world.physics.contacts) {
    if (c.bi === e.body && c.bj.collisionResponse) {
      if (c.ni.y < -0.5) return true;
      touching = true;
    } else if (c.bj === e.body && c.bi.collisionResponse) {
      if (c.ni.y > 0.5) return true;
      touching = true;
    }
  }
  const wedged = touching && Math.abs(e.body.velocity.y) < 0.05 ? ((e.state.wedged as number) || 0) + h : 0;
  e.state.wedged = wedged;
  return wedged > 0.1;
}

/** The climbable thing the hero is overlapping (ladder, rope, tree, stairs), if any. */
function climbableAt(e: Entity, world: GameWorld, pad = 0.3): Entity | null {
  const p = e.body.position;
  const f = feet(e);
  for (const o of world.entities) {
    if (!o.alive || o === e || !o.has('climbable') || o.has('ghost') || o.has('frozen')) continue;
    if (o.body.aabbNeedsUpdate) o.body.updateAABB();
    const { lowerBound: lo, upperBound: hi } = o.body.aabb;
    if (p.x < lo.x - pad || p.x > hi.x + pad || p.z < lo.z - pad || p.z > hi.z + pad) continue;
    if (f > hi.y + 0.02 || f + e.size.y < lo.y) continue;
    return o;
  }
  return null;
}

/** What's on the hero's back or in their hands that changes how they fall and fly. */
function airGear(e: Entity, world: GameWorld, h: number, grounded: boolean): void {
  const held = heldBy(e);
  if (!held) return;
  const b = e.body, inp = world.input;
  if (held.has('thrust') && held.has('wearable')) {
    const full = held.prop('fuel', 5);
    if (grounded) held.state.gearFuel = full;
    const fuel = (held.state.gearFuel as number | undefined) ?? full;
    // Space is a plain jump from the ground, and the boosters take over from there
    if (inp.jump && !grounded && fuel > 0 && (e.state.airTime as number) > 0.1) {
      held.state.gearFuel = fuel - h;
      b.velocity.y += (HERO.jetClimb - b.velocity.y) * Math.min(1, h * 7);
      const p = held.body.position;
      if (Math.random() < h * 40) world.fx.burst({ x: p.x, y: p.y - held.size.y / 2, z: p.z }, { count: 2, color: ['#fff4b8', '#ffb43c', '#ff6c1e'], speed: 0.8, up: -4, gravity: 0, drag: 2.5, size: 0.1, life: 0.3, glow: true });
      if (Math.random() < h * 4) world.fx.sound('rumble', { pitch: 1.4, volume: 0.5 });
    }
    return;
  }
  if (held.has('wearable')) {
    if (grounded) e.state.flaps = HERO.flaps;
    const left = (e.state.flaps as number | undefined) ?? HERO.flaps;
    if (!grounded && left > 0 && (e.state.jumpBuf as number) > 0 && (e.state.airTime as number) >= HERO.coyote) {
      e.state.flaps = left - 1;
      e.state.jumpBuf = 0;
      b.velocity.y = HERO.flapSpeed;
      world.fx.sound('whoosh', { pitch: 1.5, volume: 0.6 });
      world.fx.burst(held.body.position, { count: 6, color: ['#ffffff', '#cfd6e8'], speed: 1.5, up: -1, gravity: 2, size: 0.07, life: 0.5 });
    }
  }
  const cap = held.has('glider') ? held.prop('fallSpeed', 1.5) : held.has('wearable') ? HERO.wingFall : held.has('flies') ? HERO.balloonFall : Infinity;
  if (b.velocity.y < -cap) b.velocity.y += (-cap - b.velocity.y) * 0.5;
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
    // No rotational inertia in the solver: otherwise friction at the feet tips the
    // body, the contacts kick back upward, and running turns into a stutter of hops.
    e.body.fixedRotation = true;
    e.body.updateMassProperties();
    e.body.allowSleep = false;
    e.body.linearDamping = 0;
    const q = e.body.quaternion;
    e.state.yaw = 2 * Math.atan2(q.y, q.w);
    e.state.airTime = 0;
    e.state.jumpBuf = 0;
    e.state.climbing = false;
    e.state.footGrip = e.body.material?.friction ?? 0;
  },
  detach(e) {
    if (e.body.material) e.body.material.friction = e.state.footGrip as number;
    e.body.angularFactor.set(0, 1, 0);
    e.body.fixedRotation = false;
    e.body.updateMassProperties();
    e.body.collisionFilterMask = -1;
  },
  fixedUpdate(e, world, h) {
    const b = e.body;
    if (e.has('frozen') || e.state.riding) return; // in the seat, the vehicle moves them
    const inp = world.input;
    const grounded = onGround(e, world, h);
    const wasAir = e.state.airTime as number;
    e.state.airTime = grounded ? 0 : wasAir + h;
    if (grounded && wasAir > 0.08 && (e.state.lastVy as number) < -1.5) e.state.squashKick = Math.max(-5, (e.state.lastVy as number) * 0.6);
    if (grounded && wasAir > 0.35 && (e.state.lastVy as number) < -4) {
      world.fx.burst({ x: e.x, y: feet(e) + 0.05, z: e.z }, { count: 12, color: ['#e8dcc0', '#ffffff'], speed: 2.2, up: 0.8, size: 0.1, life: 0.5, gravity: 1, grow: true });
      world.fx.sound('land', { volume: 0.8 });
    }
    e.state.lastVy = b.velocity.y;

    e.state.jumpBuf = inp.jump && !e.state.jumpHeld ? HERO.jumpBuffer : Math.max(0, (e.state.jumpBuf as number) - h);
    e.state.jumpHeld = inp.jump;

    let mx = inp.move.x, mz = inp.move.z;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    // the walking code sets the speed, so friction only gets in the way until the hero stands still
    const settled = ml <= 0.05 && (e.state.jumpBuf as number) === 0 && b.velocity.y <= 0.5 && Math.hypot(b.velocity.x, b.velocity.z) <= 0.3;
    if (b.material) b.material.friction = settled ? (e.state.footGrip as number) : 0;

    // ---- climbing
    // once on a ladder, hold on a little more generously so sideways input doesn't drop you
    const ladder = climbableAt(e, world, e.state.climbing ? 0.5 : 0.4);
    // Space jumps when standing, even on stairs; it only grabs on once properly airborne and no longer rising
    const wantsUp = inp.up || (inp.jump && (!!e.state.climbing || ((e.state.airTime as number) > HERO.coyote && b.velocity.y < 1)));
    if (ladder && (wantsUp || (e.state.climbing && inp.down))) {
      if (!e.state.climbing) world.fx.sound('climb', { volume: 0.8 });
      e.state.climbing = true;
      b.collisionFilterMask = GROUP.STATIC; // don't shove the ladder away
      b.velocity.y = inp.down ? -HERO.climb : HERO.climb;
      // gentle sideways shuffle, but stay over the ladder's footprint
      if (ladder.body.aabbNeedsUpdate) ladder.body.updateAABB();
      const { lowerBound: lo, upperBound: hi } = ladder.body.aabb;
      const cx = Math.min(Math.max(b.position.x, lo.x - 0.15), hi.x + 0.15) - b.position.x;
      const cz = Math.min(Math.max(b.position.z, lo.z - 0.15), hi.z + 0.15) - b.position.z;
      b.velocity.x += (mx * HERO.speed * 0.3 + cx * 4 - b.velocity.x) * HERO.groundAccel;
      b.velocity.z += (mz * HERO.speed * 0.3 + cz * 4 - b.velocity.z) * HERO.groundAccel;
      if (Math.random() < h * 5) world.fx.sound('climb', { pitch: 0.9 + Math.random() * 0.2, volume: 0.5 });
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
    const load = carryLoad(e);
    const fed = ((e.state.fedUntil as number | undefined) ?? 0) > world.time;
    const running = inp.run && load.jump > 0;
    const speed = (grounded ? (running ? HERO.run : HERO.speed) : HERO.airSpeed) * load.speed * (fed ? HERO.fedSpeed : 1);
    if (grounded || ml > 0.05) {
      b.velocity.x += (mx * speed - b.velocity.x) * k;
      b.velocity.z += (mz * speed - b.velocity.z) * k;
    }
    // step-up: walking into something knee-high (a stair, a log) rises onto it as if up a slope
    const stepping = e.state.stepping as boolean | undefined;
    e.state.stepping = false;
    if ((grounded || stepping) && ml > 0.15 && b.velocity.y <= HERO.stepRise) {
      const f = feet(e), len = e.size.z / 2 + 0.3, ux = mx / Math.hypot(mx, mz), uz = mz / Math.hypot(mx, mz);
      // once rising, feel for the lip right at the feet so they clear it, not just the shins
      if (blocked(e, world, f + (stepping ? 0.015 : 0.06), ux, uz, len) && !blocked(e, world, f + 0.6, ux, uz, len + 0.15)) {
        b.velocity.y = HERO.stepRise;
        e.state.stepping = true;
        e.state.airTime = 0;
      } else if (stepping) b.velocity.y = Math.min(b.velocity.y, HERO.stepSettle); // over the lip: no leftover hop
    }

    airGear(e, world, h, grounded);

    // ---- jumping
    if ((e.state.jumpBuf as number) > 0 && (e.state.airTime as number) < HERO.coyote && load.jump > 0) {
      b.velocity.y = HERO.jump * load.jump * (fed ? HERO.fedJump : 1);
      // takes off at jumping speed, however fast the run-up was
      const flat = Math.hypot(b.velocity.x, b.velocity.z), most = HERO.airSpeed * (fed ? HERO.fedSpeed : 1);
      if (flat > most) {
        b.velocity.x *= most / flat;
        b.velocity.z *= most / flat;
      }
      e.state.airTime = HERO.coyote; // no double jumps off coyote time
      e.state.jumpBuf = 0;
      e.state.squashKick = 2.6;
      world.fx.sound('jump', { volume: 0.7 });
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
