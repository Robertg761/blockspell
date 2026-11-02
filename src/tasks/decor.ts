import type { GameWorld } from '../core/world';
import type { V3 } from '../levels/types';

/** A pole with a colored flag, standing on the ground at `at` (placeholder zone marker). */
export function banner(world: GameWorld, at: V3, color: string): void {
  const [x, y, z] = at;
  world.addStaticBox({ position: [x, y + 1.25, z], size: [0.25, 2.5, 0.25], color: 'woodDark' });
  world.addStaticBox({ position: [x + 0.45, y + 2.1, z], size: [0.75, 0.5, 0.08], color });
}
