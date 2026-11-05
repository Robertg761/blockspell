import { Quaternion, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import { GROUP } from '../../core/groups';
import type { HeroInput } from '../../core/world';
import { CARRY, carryOf, carryTarget, grab, heldBy, letGo, petSeat, putDown, toss } from '../lib/carry';
import { board, dropCargo, leave, ridingOf, seatPet, thrownOff } from '../lib/ride';
import { tickHandTool, tickUse } from '../lib/use';
import { defineBehavior } from '../types';

const UP = new Vec3(0, 1, 0);
const RIGHT = new Vec3(1, 0, 0);
const want = new Quaternion(), err = new Quaternion(), tilt = new Quaternion();
/** Axes, hammers and swords are modeled with their edge along +X: this turns it to lead the swing. */
const EDGE_FIRST = new Quaternion().setFromAxisAngle(UP, -Math.PI / 2);

/** Pull toward a point: the speed that closes `d` meters, on top of `base`, within `max`. */
function chase(e: Entity, base: { x: number; y: number; z: number }, dx: number, dy: number, dz: number, pull: number, max: number): void {
  const v = e.body.velocity;
  v.set(base.x + dx * pull, base.y + dy * pull, base.z + dz * pull);
  const sp = v.length();
  if (sp > max) v.scale(max / sp, v);
}

/** Turns the body upright, facing `yaw`, whatever it was doing. */
function level(e: Entity, yaw: number): void {
  want.setFromAxisAngle(UP, yaw);
  e.body.quaternion.conjugate(err);
  want.mult(err, err);
  if (err.w < 0) err.set(-err.x, -err.y, -err.z, -err.w);
  const s = Math.hypot(err.x, err.y, err.z);
  const k = s > 1e-4 ? (2 * Math.atan2(s, err.w) * 12) / s : 0;
  e.body.angularVelocity.set(err.x * k, err.y * k, err.z * k);
}

function overlapping(a: Entity, b: Entity): boolean {
  if (a.body.aabbNeedsUpdate) a.body.updateAABB();
  if (b.body.aabbNeedsUpdate) b.body.updateAABB();
  return a.body.aabb.overlaps(b.body.aabb);
}

/** True on the tick a hero input goes down. */
function pressed(e: Entity, inp: HeroInput, key: 'grab' | 'toss' | 'turn' | 'use'): boolean {
  const was = e.state[`${key}Held`];
  e.state[`${key}Held`] = inp[key];
  return inp[key] && !was;
}

/** Held like a tool or worn on the back: stuck to the hero, not hovering. It goes where they go, walls or no walls. */
function strapOn(e: Entity, hero: Entity): void {
  const b = e.body, yaw = hero.state.yaw as number;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const side = e.def.grip === undefined ? 0 : 0.2; // the right hand: right of forward is (-fz, fx)
  const out = e.def.grip === undefined ? -0.26 : 0.32 + Math.max(e.size.z, e.size.y) * 0.3;
  const swing = (hero.state.swing as number | undefined) ?? 0;
  b.collisionFilterMask = 0;
  b.force.set(0, 9.82 * b.mass, 0);
  b.torque.set(0, 0, 0);
  b.position.set(hero.x + fx * out - fz * side, hero.y + (e.def.grip === undefined ? 0.12 : 0.08), hero.z + fz * out + fx * side);
  b.velocity.copy(hero.body.velocity);
  b.angularVelocity.set(0, 0, 0);
  want.setFromAxisAngle(UP, yaw);
  // tools with a head come down in a swing; a saw just shakes
  const grip = e.def.grip ?? 0;
  tilt.setFromAxisAngle(RIGHT, grip > 0 ? grip + (swing - 0.5) * swing * 2.2 : swing * 0.06 * Math.sin(e.age * 90));
  want.mult(tilt, b.quaternion);
  if (grip > 0) b.quaternion.mult(EDGE_FIRST, b.quaternion);
}

/** Grabbing, setting down, throwing, turning, using and getting in. See lib/carry.ts for what each of them does. */
export default [
  defineBehavior({
    id: 'hero-hands',
    tags: ['controlled'],
    order: 6,
    fixedUpdate(e) {
      // climbing resets the mask, and what the hero holds must never shove them
      e.body.collisionFilterMask &= ~GROUP.HELD;
    },
    // per tick, not per substep: a tick can pass without a substep, and a quick tap only lasts one tick
    update(e, world, dt) {
      const inp = world.input;
      const wantsGrab = pressed(e, inp, 'grab'), wantsToss = pressed(e, inp, 'toss'), wantsTurn = pressed(e, inp, 'turn'), wantsUse = pressed(e, inp, 'use');
      if (e.has('frozen')) return;
      if (e.state.riding) {
        if (!ridingOf(e)) thrownOff(e); // burned, popped or reset out from under them
        else if (wantsGrab) leave(world, e);
        else if (wantsToss) dropCargo(e.state.riding as Entity, world);
        return;
      }
      const held = heldBy(e);
      if (!held) e.state.held = null; // eaten, burned up or reset out of the hero's hands
      const lifted = !!held && carryOf(held)?.mode === 'lift';
      if (wantsGrab) {
        const ride = held && petSeat(world, e, held);
        if (ride) {
          board(world, e, ride);
          seatPet(ride, held, e);
        } else if (held) putDown(world, e, held);
        else {
          const target = carryTarget(world, e);
          if (target) grab(world, e, target);
        }
      } else if (wantsToss && lifted) toss(world, e, held);
      else if (wantsTurn && lifted) carryOf(held)!.yaw += CARRY.turn;
      tickUse(world, e, heldBy(e), wantsUse, inp.use, dt);
    },
  }),
  defineBehavior({
    id: 'held',
    tags: ['held'],
    // after every other behavior: whatever a held thing tries to do, its hands-on movement wins
    order: 100,
    attach(e) {
      e.body.collisionFilterGroup = GROUP.HELD;
    },
    update(e, world) {
      if (carryOf(e)?.mode === 'hand') tickHandTool(world, e);
    },
    detach(e) {
      e.body.collisionFilterGroup = GROUP.ENTITY;
      e.body.collisionFilterMask = -1;
    },
    fixedUpdate(e, world, h) {
      const c = carryOf(e);
      if (c?.mode === 'aboard') return; // the seat moves it
      if (c?.mode === 'hand') {
        const b = e.body, at = c.at!;
        b.collisionFilterMask = GROUP.STATIC; // like a lifted thing, it would shove anything aside
        b.wakeUp();
        b.force.set(0, 9.82 * b.mass, 0);
        b.torque.set(0, 0, 0);
        level(e, c.yaw);
        chase(e, Vec3.ZERO, at.x - b.position.x, at.y - b.position.y, at.z - b.position.z, 10, 14);
        return;
      }
      const hero = world.hero;
      if (!c || !hero?.alive) {
        world.removeTag(e, 'held');
        return;
      }
      const b = e.body;
      // moved by hand it would shove anything aside, however light: overhead it only meets the walls
      b.collisionFilterMask = c.mode === 'lift' ? GROUP.STATIC : -1;
      if (c.mode === 'loose') {
        if (!overlapping(e, hero)) world.removeTag(e, 'held');
        return;
      }
      c.t += h;
      b.wakeUp();
      // respawned, or a new hero: nobody is holding this any more
      if (c.mode !== 'place' && hero.state.held !== e) {
        letGo(hero, e);
        return;
      }

      if (c.mode === 'drag') {
        // a tether: the hero pulls it along or pushes it ahead, and it stays on the ground
        const dx = b.position.x - hero.x, dz = b.position.z - hero.z;
        const d = Math.hypot(dx, dz) || 1;
        if (Math.abs(d - c.dist) > 0.9 || Math.abs(b.position.y - hero.y) > 2 || hero.state.climbing) {
          letGo(hero, e);
          return;
        }
        const pull = (c.dist - d) / d;
        const vy = b.velocity.y;
        chase(e, hero.body.velocity, dx * pull, 0, dz * pull, 10, 5);
        // falling behind on the level means it's caught on a step: a heave gets it over
        b.velocity.y = Math.abs(c.dist - d) > 0.2 && Math.abs(vy) < 0.5 ? 2 : vy;
        b.angularVelocity.set(0, b.angularVelocity.y * 0.8, 0);
        return;
      }

      if (c.mode === 'lift' && (e.def.grip !== undefined || e.has('wearable'))) {
        strapOn(e, hero);
        return;
      }

      // lifted or being set down: it hovers, whatever gravity, wind or its own engine say
      b.force.set(0, 9.82 * b.mass, 0);
      b.torque.set(0, 0, 0);
      const yaw = (hero.state.yaw as number) + c.yaw;
      if (e.state.yaw !== undefined) e.state.yaw = yaw; // animals carry on facing this way
      level(e, yaw);
      if (c.mode === 'place') {
        const at = c.at!;
        const dx = at.x - b.position.x, dy = at.y - b.position.y, dz = at.z - b.position.z;
        if (Math.hypot(dx, dy, dz) < 0.06 || c.t > 0.5) {
          b.velocity.set(0, 0, 0);
          b.angularVelocity.set(0, 0, 0);
          letGo(hero, e);
          return;
        }
        chase(e, Vec3.ZERO, dx, dy, dz, 12, 6);
        return;
      }
      const facing = hero.state.yaw as number;
      const dx = hero.x + Math.sin(facing) * 0.12 - b.position.x;
      const dy = hero.y + hero.size.y / 2 + e.size.y / 2 + 0.08 - b.position.y;
      const dz = hero.z + Math.cos(facing) * 0.12 - b.position.z;
      if (Math.hypot(dx, dy, dz) > CARRY.snap && c.t > 0.5) {
        letGo(hero, e);
        return;
      }
      chase(e, hero.body.velocity, dx, dy, dz, 14, 14);
    },
  }),
];
