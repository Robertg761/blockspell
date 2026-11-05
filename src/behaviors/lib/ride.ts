import { Quaternion, Vec3 } from 'cannon-es';
import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { blocked, HERO } from './hero';
import { inWater, waterSurfaceAt } from './water';

export const RIDE = {
  /** Flying machines stop climbing at this height (m). */
  ceiling: 30,
  /** Throttle and brake, m/s per second. */
  accel: 7,
  brake: 13,
  /** Default turn rate at full lock (radians per second). */
  turn: 1.6,
  /** A plane needs this share of its top speed to stay up. */
  stall: 0.4,
  /** Steepest climb and dive of a plane, and its bank in a turn (radians). */
  pitchUp: 0.42,
  pitchDown: 0.5,
  bank: 0.65,
  /** How fast a rocket with no fuel left comes down (m/s). */
  sink: 3,
};

/** A ridden thing's state.ride. */
interface RideState {
  yaw: number;
  pitch: number;
  roll: number;
  /** Along the heading, in m/s. Negative in reverse. */
  speed: number;
  /** World time of the last bump, so one crash makes one noise. */
  bumpAt: number;
  /** Its friction and damping, to put back: while ridden the throttle sets the speed. */
  grip: number;
  damping: number;
}

const UP = new Vec3(0, 1, 0), RIGHT = new Vec3(1, 0, 0), FWD = new Vec3(0, 0, 1);
const qYaw = new Quaternion(), qPitch = new Quaternion(), qRoll = new Quaternion(), seatAt = new Vec3();

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const approach = (v: number, to: number, step: number) => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));
const yawOf = (q: Quaternion) => Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));

/**
 * True while this waits for a driver instead of going off by itself. Free Play has nobody to wear
 * a jetpack, so those only wait where there's a hero on foot; vehicles can always be clicked and flown.
 */
export function parked(e: Entity, world: GameWorld): boolean {
  if (e.state.lit || e.has('ridden') || e.has('animal')) return false;
  return e.has('rideable') || (e.has('wearable') && !!world.hero && !world.hero.state.pilot);
}

/** True if the hero could get on this right now. */
export function canRide(e: Entity): boolean {
  return e.has('rideable') && !!e.def.ride && !e.has('frozen') && !e.has('ghost') && !e.state.lit && !e.has('ridden');
}

/** What the hero is riding. */
export function ridingOf(hero: Entity): Entity | null {
  const v = hero.state.riding as Entity | null | undefined;
  return v?.alive ? v : null;
}

/** How it moves right now: a flying car flies. */
export function rideKind(e: Entity): 'ground' | 'water' | 'plane' | 'hover' {
  const kind = e.def.ride!.kind;
  return kind === 'ground' && e.has('flies') ? 'hover' : kind;
}

/** Puts the hero in the seat and hands them the controls. */
export function board(world: GameWorld, hero: Entity, v: Entity): void {
  hero.state.riding = v;
  hero.state.boardedAt = world.time;
  hero.state.climbing = false;
  hero.state.airTime = 0;
  hero.body.collisionFilterMask = 0;
  v.state.rider = hero;
  world.addTag(v, 'ridden');
  seat(v, hero);
  world.fx.sound(v.has('animal') ? 'pop' : 'engine', { volume: 0.8 });
  world.fx.sparkle(hero.body.position, undefined, 8);
}

/** Takes the hero off wherever they are, as when the vehicle burns or pops from under them. */
export function thrownOff(hero: Entity): void {
  hero.state.riding = null;
  hero.state.airTime = 1;
  hero.body.collisionFilterMask = -1;
  const q = hero.body.quaternion;
  q.setFromAxisAngle(UP, hero.state.yaw as number);
}

/** Beside the vehicle, on dry land if there's any. Null when every way out is deep water. */
function stepOff(world: GameWorld, hero: Entity, v: Entity): { x: number; y: number; z: number } | null {
  const yaw = (v.state.ride as RideState).yaw;
  const out = Math.max(v.size.x, v.size.z) / 2 + 0.45;
  const feet = v.y - v.size.y / 2;
  const sides = [Math.PI / 2, -Math.PI / 2, Math.PI, 0, Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
  let air: { x: number; y: number; z: number } | null = null;
  for (const a of sides) for (const d of [out, out + 1.2]) {
    const x = v.x + Math.sin(yaw + a) * d, z = v.z + Math.cos(yaw + a) * d;
    const g = world.groundAt(x, z);
    const near = Number.isFinite(g) && Math.abs(g - feet) < 1.6;
    if (!near) {
      air ??= { x, y: v.y, z };
      continue;
    }
    const surface = waterSurfaceAt(world, x, g + 0.05, z, (w) => !!w.def.levelOnly);
    if (surface !== null && surface - g > 0.5) continue;
    return { x, y: g + hero.size.y / 2 + 0.05, z };
  }
  // in the sky anything goes, and a parachute might even be on its way. Not in a lake: the hero can't swim
  return inWater(world, v) ? null : air;
}

/** Hops out beside it. Returns false if there's nowhere to go. */
export function leave(world: GameWorld, hero: Entity): boolean {
  const v = ridingOf(hero);
  if (!v) return false;
  // a Free Play pilot just vanishes, so even a lake won't hold them
  const spot = stepOff(world, hero, v) ?? (hero.state.pilot ? { x: hero.x, y: hero.y, z: hero.z } : null);
  if (!spot) {
    world.fx.sound('error', { volume: 0.5 });
    world.events.emit('say', { text: 'Too deep to hop out here. Get closer to the shore!' });
    return false;
  }
  thrownOff(hero);
  hero.body.position.set(spot.x, spot.y, spot.z);
  hero.body.velocity.set(v.body.velocity.x * 0.5, Math.max(0, v.body.velocity.y) * 0.5, v.body.velocity.z * 0.5);
  world.removeTag(v, 'ridden');
  world.fx.sound('step', { pitch: 0.8 });
  return true;
}

/** Keeps the hero in the seat. */
function seat(v: Entity, hero: Entity): void {
  const s = v.def.ride!.seat, b = v.body, p = hero.body;
  seatAt.set(s[0] * v.scale, s[1] * v.scale, s[2] * v.scale);
  b.quaternion.vmult(seatAt, seatAt);
  p.position.set(b.position.x + seatAt.x, b.position.y + seatAt.y, b.position.z + seatAt.z);
  p.velocity.copy(b.velocity);
  p.quaternion.copy(b.quaternion);
  p.angularVelocity.set(0, 0, 0);
  p.force.set(0, 9.82 * p.mass, 0);
  hero.state.yaw = (v.state.ride as RideState | undefined)?.yaw ?? hero.state.yaw;
}

/** Turns the body to the ride's heading, pitch and roll. */
function pose(v: Entity, r: RideState): void {
  qYaw.setFromAxisAngle(UP, r.yaw);
  qPitch.setFromAxisAngle(RIGHT, -r.pitch);
  qRoll.setFromAxisAngle(FWD, r.roll);
  qYaw.mult(qPitch, v.body.quaternion);
  v.body.quaternion.mult(qRoll, v.body.quaternion);
  v.body.angularVelocity.set(0, 0, 0);
}

/** The speed it really managed: far below the throttle's means it hit something. */
function bumped(v: Entity, world: GameWorld, r: RideState, fx: number, fz: number): void {
  const b = v.body;
  const along = b.velocity.x * fx + b.velocity.z * fz;
  if (Math.abs(r.speed) < 2 || Math.abs(along) > Math.abs(r.speed) * 0.45) return;
  const hit = Math.abs(r.speed - along);
  r.speed = along;
  if (world.time - r.bumpAt < 0.4) return;
  r.bumpAt = world.time;
  world.fx.sound(v.has('metal') ? 'clank' : 'thud', { volume: Math.min(1, 0.3 + hit * 0.08) });
  world.fx.addShake(Math.min(0.35, hit * 0.03));
}

/** Past the edge of the world it turns itself around. Returns true while it does. */
function headHome(world: GameWorld, r: RideState, x: number, z: number, step: number): boolean {
  if (Math.hypot(x, z) < world.flightLimit) return false;
  let d = Math.atan2(-x, -z) - r.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  r.yaw += clamp(d, -step, step);
  return true;
}

function ground(v: Entity, world: GameWorld, r: RideState, h: number, top: number): void {
  const b = v.body, inp = world.input.drive, spec = v.def.ride!;
  const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw);
  bumped(v, world, r, fx, fz);
  const want = inp.y > 0 ? top * inp.y : inp.y < 0 ? top * 0.45 * inp.y : 0;
  const same = want !== 0 && Math.sign(want) === Math.sign(r.speed || want);
  r.speed = approach(r.speed, want, (same ? RIDE.accel : RIDE.brake) * h);
  // steering needs movement: wheels don't turn a parked car, and backing up turns the other way
  const grip = clamp(Math.abs(r.speed) / 2.5, 0, 1) * Math.sign(r.speed);
  r.yaw -= inp.x * (spec.turn ?? RIDE.turn) * grip * h;
  b.velocity.x = Math.sin(r.yaw) * r.speed;
  b.velocity.z = Math.cos(r.yaw) * r.speed;
  // up over kerbs and the lips of bridges, the way the hero steps
  if (Math.abs(r.speed) > 0.5 && b.velocity.y <= HERO.stepRise) {
    const dir = Math.sign(r.speed), f = v.y - v.size.y / 2, len = v.size.z / 2 + 0.3;
    const ux = Math.sin(r.yaw) * dir, uz = Math.cos(r.yaw) * dir;
    if (blocked(v, world, f + 0.08, ux, uz, len) && !blocked(v, world, f + 0.6, ux, uz, len + 0.15)) b.velocity.y = HERO.stepRise;
  }
  pose(v, r);
}

function water(v: Entity, world: GameWorld, r: RideState, h: number, top: number): void {
  const b = v.body, inp = world.input.drive, spec = v.def.ride!;
  // aground it only scrapes along
  const afloat = inWater(world, v);
  const cap = afloat ? top : 0.6;
  const want = inp.y > 0 ? cap * inp.y : inp.y < 0 ? cap * 0.5 * inp.y : 0;
  r.speed = approach(r.speed, want, (want === 0 ? 2 : RIDE.accel * 0.5) * h);
  r.yaw -= inp.x * (spec.turn ?? RIDE.turn) * clamp(0.35 + Math.abs(r.speed) / top, 0, 1) * h;
  const k = Math.min(1, h * 4);
  b.velocity.x += (Math.sin(r.yaw) * r.speed - b.velocity.x) * k;
  b.velocity.z += (Math.cos(r.yaw) * r.speed - b.velocity.z) * k;
  pose(v, r);
  if (afloat && Math.abs(r.speed) > 1 && Math.random() < h * 14)
    world.fx.burst({ x: v.x - Math.sin(r.yaw) * v.size.z * 0.5, y: v.y - v.size.y * 0.3, z: v.z - Math.cos(r.yaw) * v.size.z * 0.5 }, { count: 2, color: ['#ffffff', '#cfeeff'], speed: 0.8, up: 0.8, gravity: 4, size: 0.08, life: 0.5 });
}

function plane(v: Entity, world: GameWorld, r: RideState, h: number, top: number): void {
  const b = v.body, inp = world.input, spec = v.def.ride!;
  const turn = spec.turn ?? RIDE.turn;
  const stall = top * RIDE.stall;
  const floor = world.groundAt(b.position.x, b.position.z);
  const wheels = b.position.y - v.size.y / 2 - floor < 0.3;
  bumped(v, world, r, Math.sin(r.yaw), Math.cos(r.yaw));
  // no input holds the speed; on the ground it rolls to a stop, and S backs it out of trouble
  const want = inp.drive.y > 0 ? top : inp.drive.y < 0 ? (wheels ? -3 : 0) : wheels ? 0 : r.speed;
  r.speed = approach(r.speed, want, (inp.drive.y < 0 ? 8 : RIDE.accel * 0.8) * h);
  const flying = r.speed >= stall;
  const home = headHome(world, r, b.position.x, b.position.z, turn * h);
  const steer = home ? 0 : inp.drive.x;
  r.yaw -= steer * turn * (wheels ? 0.8 : 1) * h; // it taxis on the spot: stuck against a tree it can still turn away
  // the nose goes up on Space, down on Shift, and only with enough speed to mean anything
  const high = b.position.y > RIDE.ceiling;
  const pitchTo = !flying ? (wheels ? 0 : -0.25) : inp.jump && !high ? RIDE.pitchUp : high ? -0.15 : inp.run && !wheels ? -RIDE.pitchDown : 0;
  r.pitch = approach(r.pitch, pitchTo, 1.4 * h);
  r.roll = approach(r.roll, wheels ? 0 : steer * RIDE.bank, 2.2 * h);
  const lift = Math.min(1, r.speed / stall);
  b.force.set(0, 9.82 * b.mass * lift, 0);
  b.torque.set(0, 0, 0);
  const c = Math.cos(r.pitch);
  b.velocity.x = Math.sin(r.yaw) * c * r.speed;
  b.velocity.z = Math.cos(r.yaw) * c * r.speed;
  if (flying && !(wheels && r.pitch <= 0)) b.velocity.y = Math.sin(r.pitch) * r.speed;
  pose(v, r);
}

function hover(v: Entity, world: GameWorld, r: RideState, h: number, top: number): void {
  const b = v.body, inp = world.input, spec = v.def.ride!;
  const turn = spec.turn ?? RIDE.turn;
  const climb = (spec.climb ?? 4) * Math.sqrt(v.scale);
  const fuelled = !v.has('thrust') || (v.state.fuel as number) > 0;
  const floor = world.groundAt(b.position.x, b.position.z);
  const landed = b.position.y - v.size.y / 2 - floor < 0.15;
  if (v.has('thrust') && landed) v.state.fuel = Math.max(v.state.fuel as number, v.prop('fuel', 4) * Math.sqrt(v.scale));
  const home = headHome(world, r, b.position.x, b.position.z, turn * h);
  r.speed = approach(r.speed, (home ? 1 : inp.drive.y) * top, RIDE.accel * h);
  r.yaw -= (home ? 0 : inp.drive.x) * turn * h;
  const vy = !fuelled ? -RIDE.sink : inp.jump && b.position.y < RIDE.ceiling ? climb : inp.run ? -climb : 0;
  const k = Math.min(1, h * 4);
  b.force.set(0, 9.82 * b.mass, 0);
  b.torque.set(0, 0, 0);
  b.velocity.x += (Math.sin(r.yaw) * r.speed - b.velocity.x) * k;
  b.velocity.z += (Math.cos(r.yaw) * r.speed - b.velocity.z) * k;
  b.velocity.y += (vy - b.velocity.y) * k;
  // leans into where it's going
  r.pitch = approach(r.pitch, landed ? 0 : -(inp.drive.y * 0.16), 1.5 * h);
  r.roll = approach(r.roll, landed ? 0 : inp.drive.x * 0.18, 1.5 * h);
  pose(v, r);
}

/** One physics step of a ridden thing: reads the hero's input, moves it, and keeps the hero in the seat. */
export function steer(v: Entity, world: GameWorld, h: number): void {
  const hero = v.state.rider as Entity | undefined;
  if (!hero?.alive || hero.state.riding !== v) {
    world.removeTag(v, 'ridden');
    return;
  }
  if (v.has('frozen')) {
    if (!leave(world, hero)) thrownOff(hero);
    world.removeTag(v, 'ridden');
    return;
  }
  const r = v.state.ride as RideState;
  const top = v.def.ride!.speed * Math.sqrt(v.scale) * ((v.state.speedMul as number) ?? 1);
  v.body.wakeUp();
  const kind = rideKind(v);
  if (kind === 'ground') ground(v, world, r, h, top);
  else if (kind === 'water') water(v, world, r, h, top);
  else if (kind === 'plane') plane(v, world, r, h, top);
  else hover(v, world, r, h, top);
  seat(v, hero);
}

/** Sets a thing up for riding, level and facing the way it faced. */
export function startRide(v: Entity): void {
  const b = v.body;
  v.state.ride = { yaw: yawOf(b.quaternion), pitch: 0, roll: 0, speed: 0, bumpAt: -Infinity, grip: b.material?.friction ?? 0, damping: b.linearDamping } satisfies RideState;
  b.allowSleep = false;
  // friction would only fight the throttle
  if (b.material) b.material.friction = 0;
  b.linearDamping = 0;
  pose(v, v.state.ride as RideState);
}

/** Gives a thing back its friction and damping when the hero gets out. */
export function endRide(v: Entity): void {
  const r = v.state.ride as RideState | undefined;
  if (r) {
    if (v.body.material) v.body.material.friction = r.grip;
    v.body.linearDamping = r.damping;
  }
  v.state.rider = undefined;
}
