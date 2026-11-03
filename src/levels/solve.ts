import type { Entity } from '../core/entity';
import type { GameWorld, HeroInput } from '../core/world';
import type { LevelSolution, SolutionStep, V3 } from './types';

/** What the runner needs from the game. */
export interface SolveHost {
  readonly world: GameWorld;
  /** Aims at a point and casts a spell like the player would. Returns false if it failed to parse. */
  castAt(text: string, at: V3): boolean;
  poke(e: Entity): void;
  /** Moves the hero to a feet position. */
  teleportHero(at: V3): void;
  /** Resets the hero's zone (open world). */
  resetZone(): void;
}

/**
 * Replays a LevelSolution: casts spells, waits, and drives the hero by
 * writing `world.input` (overriding the keyboard while it runs). Call
 * `update(dt)` once per game tick, before the world updates.
 */
export class SolutionRunner {
  private i = 0;
  private t = 0;
  /** Resolved target of the current walkTo step. */
  private target: [number, number] | null = null;
  /** Seconds spent after the last step (waiting for the goal). */
  tail = 0;
  readonly log: string[] = [];
  error: string | null = null;

  constructor(private host: SolveHost, readonly solution: LevelSolution) {}

  get stepsDone(): boolean {
    return this.i >= this.solution.steps.length;
  }

  /** True once the goal-wait timeout has elapsed. */
  get timedOut(): boolean {
    return this.stepsDone && this.tail > (this.solution.timeout ?? 15);
  }

  update(dt: number): void {
    const w = this.host.world;
    const inp = w.input;
    inp.move.x = inp.move.z = 0;
    inp.up = inp.down = inp.jump = false;
    if (this.stepsDone) {
      this.tail += dt;
      return;
    }
    const step = this.solution.steps[this.i];
    this.t += dt;
    if (this.run(step, inp, dt)) {
      this.i++;
      this.t = 0;
    }
  }

  /** Where a walkTo step heads: its point, or its offset from the nearest entity with id `of`. */
  private walkTarget(step: { walkTo: [number, number]; of?: string }): [number, number] | null {
    if (!step.of) return null;
    const w = this.host.world, h = w.hero;
    const e = h ? w.nearest({ x: h.x, y: h.y, z: h.z }, 50, (o) => o.def.id === step.of) : null;
    if (!e) {
      this.log.push(`walkTo: no ${step.of}`);
      return null;
    }
    return [e.x + step.walkTo[0], e.z + step.walkTo[1]];
  }

  /** Executes one tick of `step`; returns true when it's finished. */
  private run(step: SolutionStep, inp: HeroInput, dt: number): boolean {
    const w = this.host.world;
    if ('cast' in step) {
      const at: V3 = step.at.length === 3 ? step.at : [step.at[0], w.groundAt(step.at[0], step.at[1]), step.at[1]];
      if (!Number.isFinite(at[1])) at[1] = 0;
      const ok = this.host.castAt(step.cast, at);
      this.log.push(`cast "${step.cast}" at ${at.map((v) => v.toFixed(1)).join(',')}${ok ? '' : ' FAILED'}`);
      if (!ok) this.error = `could not cast "${step.cast}"`;
      return true;
    }
    if ('wait' in step) return this.t >= step.wait;
    if ('hold' in step) {
      const d = step.hold.dir;
      if (d) {
        const l = Math.hypot(d[0], d[1]) || 1;
        inp.move.x = d[0] / l;
        inp.move.z = d[1] / l;
      }
      inp.up = !!step.hold.up;
      inp.down = !!step.hold.down;
      inp.jump = !!step.hold.jump && Math.floor(this.t * 4) % 2 === 0; // tap, so jumps re-trigger
      return this.t >= step.for;
    }
    if ('walkTo' in step) {
      const h = w.hero;
      if (!h?.alive) return true;
      if (this.t <= dt) this.target = this.walkTarget(step);
      const [tx, tz] = this.target ?? step.walkTo;
      const dx = tx - h.x, dz = tz - h.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35 || this.t > (step.timeout ?? 10)) {
        if (d >= 0.35) this.log.push(`walkTo ${step.of ? step.of + '+' : ''}${step.walkTo} timed out ${d.toFixed(2)} m short`);
        return true;
      }
      inp.move.x = dx / d * Math.min(1, d * 2);
      inp.move.z = dz / d * Math.min(1, d * 2);
      inp.up = !!step.up;
      inp.jump = !!step.jump && Math.floor(this.t * 4) % 2 === 0;
      return false;
    }
    if ('poke' in step) {
      const near = step.near ?? [w.hero?.x ?? 0, w.hero?.z ?? 0];
      const e = w.nearest({ x: near[0], y: w.hero?.y ?? 1, z: near[1] }, 50, (o) => o.def.id === step.poke);
      if (e) this.host.poke(e);
      else this.log.push(`poke: no ${step.poke}`);
      return true;
    }
    if ('teleport' in step) {
      this.host.teleportHero(step.teleport);
      this.log.push(`teleport to ${step.teleport.map((v) => v.toFixed(1)).join(',')}`);
      return true;
    }
    if ('resetZone' in step) {
      this.host.resetZone();
      this.log.push('reset zone');
      return true;
    }
    return true;
  }
}
