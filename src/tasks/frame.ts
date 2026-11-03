import type { StaticBoxOptions } from '../core/world';
import type { GameWorld } from '../core/world';
import type { LevelSolution, SolutionStep, V3 } from '../levels/types';
import type { Box } from './types';

/**
 * A local coordinate frame: an origin plus a yaw (radians, about +y). Ported
 * puzzles keep their old local coordinates and go through a frame, so the
 * same setup and solutions work anywhere in the open world.
 */
export class Frame {
  private c: number;
  private s: number;

  constructor(readonly origin: V3, readonly yaw = 0) {
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
  }

  /** Local direction (x, z) to world space. */
  dir(x: number, z: number): [number, number] {
    return [x * this.c + z * this.s, -x * this.s + z * this.c];
  }

  /** Local ground point (x, z) to world space. */
  xz(x: number, z: number): [number, number] {
    const [dx, dz] = this.dir(x, z);
    return [this.origin[0] + dx, this.origin[2] + dz];
  }

  /** Local point to world space. */
  p(x: number, y: number, z: number): V3 {
    const [wx, wz] = this.xz(x, z);
    return [wx, this.origin[1] + y, wz];
  }

  /** World point (x, z) to local coordinates. */
  local(x: number, z: number): [number, number] {
    const dx = x - this.origin[0], dz = z - this.origin[2];
    return [dx * this.c - dz * this.s, dx * this.s + dz * this.c];
  }

  /** A world point is inside a box given in local coordinates (y relative to the origin). */
  contains(min: V3, max: V3, x: number, y: number, z: number): boolean {
    const [lx, lz] = this.local(x, z);
    const ly = y - this.origin[1];
    return lx >= min[0] && lx <= max[0] && ly >= min[1] && ly <= max[1] && lz >= min[2] && lz <= max[2];
  }

  /** Local box to the world-space axis-aligned box around it. */
  box(min: V3, max: V3): Box {
    const pts = [this.p(min[0], min[1], min[2]), this.p(max[0], max[1], max[2]), this.p(min[0], min[1], max[2]), this.p(max[0], max[1], min[2])];
    const lo = [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i]))) as V3;
    const hi = [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i]))) as V3;
    return [lo, hi];
  }

  /** Adds a static box given in local coordinates. */
  staticBox(world: GameWorld, o: StaticBoxOptions): void {
    const [x, y, z] = o.position;
    world.addStaticBox({ ...o, position: this.p(x, y, z), yaw: (o.yaw ?? 0) + this.yaw });
  }

  step(st: SolutionStep): SolutionStep {
    if ('cast' in st) return { ...st, at: st.at.length === 3 ? this.p(st.at[0], st.at[1], st.at[2]) : this.xz(st.at[0], st.at[1]) };
    if ('walkTo' in st) return { ...st, walkTo: st.of ? this.dir(st.walkTo[0], st.walkTo[1]) : this.xz(st.walkTo[0], st.walkTo[1]) };
    if ('hold' in st) return st.hold.dir ? { ...st, hold: { ...st.hold, dir: this.dir(st.hold.dir[0], st.hold.dir[1]) } } : st;
    if ('poke' in st) return st.near ? { ...st, near: this.xz(st.near[0], st.near[1]) } : st;
    if ('teleport' in st) return { teleport: this.p(st.teleport[0], st.teleport[1], st.teleport[2]) };
    return st;
  }

  /** A solution written in local coordinates, moved to world space. */
  solution(sol: LevelSolution): LevelSolution {
    return { ...sol, steps: sol.steps.map((st) => this.step(st)) };
  }
}
