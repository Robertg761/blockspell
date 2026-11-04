import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { carryOf, heldBy } from './carry';

/** How far each leg swings either way (radians) at a slow walk and at a full run. */
const WALK_SWING = 0.3, RUN_SWING = 0.75;
/** Hip height as a share of body height. */
const LEG_SHARE = 7 / 19;
/** Metres climbed per full hand-over-hand cycle. */
const CLIMB_CYCLE = 1;
/** Arm angle (radians) and stretch to reach what's held overhead, and the angle out to what's dragged. */
const LIFT_ARM = -2.95, LIFT_REACH = 1.5, DRAG_ARM = -1.35;

interface Rig {
  /** Stride position in radians, advanced by distance walked so feet don't skate. */
  stride: number;
  climbCycle: number;
  /** 0 standing .. 1 full run. */
  gait: number;
  /** Blend weights for the airborne, climbing and holding poses. */
  air: number;
  climb: number;
  hold: number;
  /** Where the arms are held, and how far they stretch. */
  holdArm: number;
  holdReach: number;
  /** Which leg leads a jump: +1 or -1. */
  lead: number;
  /** Forward and sideways body tilt, radians. */
  lean: number;
  bank: number;
  /** Springy height change: negative squashes, positive stretches. */
  squash: number;
  squashV: number;
  squashed: boolean;
  scarf: number;
  headYaw: number;
  yaw: number;
  vx: number;
  vz: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Frame-rate independent ease of `a` toward `b`. */
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function rigOf(e: Entity, yaw: number): Rig {
  const v = e.body.velocity;
  return (e.state.rig ??= {
    stride: 0, climbCycle: 0, gait: 0, air: 0, climb: 0, hold: 0, holdArm: 0, holdReach: 1, lead: 1, lean: 0, bank: 0,
    squash: 0, squashV: 0, squashed: false, scarf: 0, headYaw: 0, yaw, vx: v.x, vz: v.z,
  } satisfies Rig) as Rig;
}

/** A foot coming down: a puff of dust under that foot and a footstep. */
function footfall(e: Entity, world: GameWorld, yaw: number, side: number): void {
  const out = side * 0.1 * e.scale, ahead = 0.15 * e.scale;
  const x = e.x + Math.cos(yaw) * out + Math.sin(yaw) * ahead;
  const z = e.z - Math.sin(yaw) * out + Math.cos(yaw) * ahead;
  const y = e.y - e.size.y / 2 + 0.05;
  world.fx.burst({ x, y, z }, { count: 4, color: ['#e8dcc0', '#cdbf9f'], speed: 0.8, up: 0.6, size: 0.07, life: 0.4, gravity: 1, grow: true });
  world.fx.sound('step', { volume: 0.6 });
}

/**
 * Poses the hero's limbs from what the body is doing: a stride driven by
 * distance walked, jump and fall poses, hand-over-hand climbing and an idle.
 * Purely cosmetic; the collider never moves. `e.state.squashKick` (set by the
 * `controlled` behavior on jumps and landings) gives the body a springy jolt.
 */
export function animateHero(e: Entity, world: GameWorld, dt: number): void {
  if (e.has('frozen') || dt <= 0) return; // frozen solid: hold the pose
  const legL = e.parts.get('legL')!, legR = e.parts.get('legR')!;
  const armL = e.parts.get('armL')!, armR = e.parts.get('armR')!;
  const head = e.parts.get('head')!, scarf = e.parts.get('scarf')!;
  const q = e.body.quaternion, v = e.body.velocity;
  const yaw = 2 * Math.atan2(q.y, q.w);
  const r = rigOf(e, yaw);
  const t = world.time + e.id * 7;
  const H = e.size.y;
  const runSpeed = e.prop('speed', 2.6);

  const controlled = e.has('controlled');
  const sp = Math.hypot(v.x, v.z) / e.scale;
  const airTime = (e.state.airTime as number | undefined) ?? (Math.abs(v.y) > 1.5 ? 1 : 0);
  const climbing = !!e.state.climbing;
  const airborne = airTime > 0.1 && !climbing;
  // no legs when there's no intent to walk: riding or sliding along, the hero just stands
  const striding = !airborne && !climbing && (!controlled || Math.hypot(world.input.move.x, world.input.move.z) > 0.1);

  r.gait = damp(r.gait, striding ? Math.min(1.15, sp / runSpeed) : 0, 14, dt);
  r.air = damp(r.air, airborne ? 1 : 0, airborne ? 16 : 22, dt);
  r.climb = damp(r.climb, climbing ? 1 : 0, 14, dt);
  if (r.air < 0.05) r.lead = Math.sin(r.stride) >= 0 ? 1 : -1;
  const ground = (1 - r.air) * (1 - r.climb);

  // ---- stride: amplitude grows with speed, and goes to nothing as the hero stops
  const before = r.stride;
  const reachOut = mix(WALK_SWING, RUN_SWING, Math.min(1, r.gait));
  // a full stride covers four leg-spreads, so at this rate the planted foot doesn't skate
  const strideLength = 4 * ((H / e.scale) * LEG_SHARE) * Math.sin(reachOut);
  if (striding) r.stride += ((sp * Math.PI * 2) / strideLength) * dt;
  const swing = Math.sin(r.stride) * reachOut * Math.min(1, r.gait * 5);
  // the forward foot reaches furthest at stride = pi/2 + k*pi; that's when it lands
  const planted = Math.floor((r.stride - Math.PI / 2) / Math.PI);
  if (controlled && striding && sp > 1.2 && planted !== Math.floor((before - Math.PI / 2) / Math.PI))
    footfall(e, world, yaw, planted % 2 === 0 ? 1 : -1);

  // ---- airborne: tucked and reaching on the way up, arms out and legs loose on the way down
  const up = clamp((v.y / 5 + 1) / 2, 0, 1);
  const flail = (1 - up) * Math.sin(t * 17) * 0.14;
  const airLegF = mix(0.25, -0.65, up), airLegB = mix(-0.2, 0.4, up);
  const airArm = mix(-2.4, -1.15, up), airArmSplit = mix(0.1, 0.4, up);

  // ---- climbing: hand over hand, feet stepping up in time
  r.climbCycle += (Math.abs(v.y) * Math.PI * 2 * dt) / CLIMB_CYCLE * r.climb;
  const reach = Math.sin(r.climbCycle);

  // ---- limbs
  const breath = Math.sin(t * 2.1);
  const still = ground * (1 - Math.min(1, r.gait * 3));
  const lead = r.lead;
  const pose = (walk: number, airPose: number, climbPose: number) => ground * walk + (1 - ground) * mix(airPose, climbPose, r.climb);
  legL.rotation.x = pose(-swing, lead > 0 ? airLegF : airLegB, -0.35 - reach * 0.35);
  legR.rotation.x = pose(swing, lead > 0 ? airLegB : airLegF, -0.35 + reach * 0.35);
  armL.rotation.x = pose(swing * 0.9, airArm + airArmSplit * lead + flail, -2.75 + reach * 0.4);
  armR.rotation.x = pose(-swing * 0.9, airArm - airArmSplit * lead - flail, -2.75 - reach * 0.4);
  // squashing into a landing throws the arms out for balance
  const out = 0.05 + r.air * 0.3 + Math.max(0, -r.squash) * 2 + still * (0.02 + breath * 0.015) + r.gait * 0.08;
  armL.rotation.z = out * (1 - r.climb);
  armR.rotation.z = -out * (1 - r.climb);

  // ---- hands full: the arms stay on what's held, whatever the legs are doing
  const held = heldBy(e);
  const mode = held && carryOf(held)?.mode;
  const holding = mode === 'lift' || mode === 'drag';
  if (holding) {
    r.holdArm = mode === 'lift' ? LIFT_ARM : DRAG_ARM;
    r.holdReach = mode === 'lift' ? LIFT_REACH : 1;
  }
  r.hold = damp(r.hold, holding ? 1 : 0, 16, dt);
  for (const arm of [armL, armR]) {
    arm.rotation.x = mix(arm.rotation.x, r.holdArm, r.hold);
    arm.rotation.z *= 1 - r.hold;
    arm.scale.y = mix(1, r.holdReach, r.hold);
  }

  // ---- body: lean into acceleration, bank into turns, twist with the arms
  const ax = (v.x - r.vx) / dt, az = (v.z - r.vz) / dt;
  r.vx = v.x; r.vz = v.z;
  const fwd = ax * Math.sin(yaw) + az * Math.cos(yaw), side = ax * Math.cos(yaw) - az * Math.sin(yaw);
  r.lean = damp(r.lean, ground * clamp((sp / runSpeed) * 0.09 + fwd * 0.012, -0.2, 0.22), 10, dt);
  r.bank = damp(r.bank, ground * clamp(-side * 0.01, -0.16, 0.16), 10, dt);
  const twist = -swing * 0.14;
  const sway = Math.sin(r.stride) * 0.035 * Math.min(1, r.gait);
  e.visual.rotation.set(r.lean, twist, r.bank + sway);

  // ---- springy squash and stretch
  r.squashV += (e.state.squashKick as number | undefined) ?? 0;
  e.state.squashKick = 0;
  r.squashV += (-220 * r.squash - 18 * r.squashV) * dt;
  r.squash = clamp(r.squash + r.squashV * dt, -0.28, 0.25);
  const moved = Math.abs(r.squash) > 0.002 || Math.abs(r.squashV) > 0.02;
  if (moved) {
    const wide = 1 / Math.sqrt(1 + r.squash);
    e.visual.scale.set(wide, 1 + r.squash, wide);
  } else if (r.squashed) {
    e.visual.scale.setScalar(1);
    r.squash = r.squashV = 0;
  }
  r.squashed = moved;

  // ---- keep the feet on the ground: tilts pivot at the feet, and the hips sink as the legs spread
  const legDrop = H * LEG_SHARE * (1 - Math.cos(swing)) * 0.45 * ground;
  const climbBob = Math.sin(r.climbCycle * 2) * 0.02 * r.climb;
  e.visual.position.set(
    (-H / 2) * Math.sin(r.bank + sway),
    -legDrop + climbBob + still * breath * 0.006 + (H / 2) * r.squash,
    (H / 2) * Math.sin(r.lean),
  );

  // ---- head: holds level against the body, looks into turns, glances about when idle
  let turn = yaw - r.yaw;
  r.yaw = yaw;
  if (turn > Math.PI) turn -= Math.PI * 2;
  if (turn < -Math.PI) turn += Math.PI * 2;
  const glance = (Math.sin(t * 0.61) * 0.2 + Math.sin(t * 0.23) * 0.16) * still;
  r.headYaw = damp(r.headYaw, clamp((turn / dt) * 0.09, -0.55, 0.55) + glance, 9, dt);
  head.rotation.set(-r.lean * 0.7 + r.climb * -0.3 + (1 - up) * r.air * 0.2 + still * breath * 0.012, r.headYaw - twist, -(r.bank + sway) * 0.6);

  // ---- scarf: trails behind with speed, lifts in a fall
  const trail = Math.min(1.25, (sp / runSpeed) * 0.9 + Math.max(0, -v.y) * 0.12);
  r.scarf = damp(r.scarf, 0.08 + trail, 9, dt);
  scarf.rotation.x = r.scarf + Math.sin(t * 13) * 0.14 * Math.min(1, trail);
}
