import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { defineBehavior } from '../types';

function eat(e: Entity, food: Entity, world: GameWorld): void {
  if (!food.alive || (e.state.eatCooldown as number) > 0) return;
  e.state.eatCooldown = 1.2;
  e.state.seek = null;
  const p = food.body.position;
  world.fx.burst(p, { count: 22, color: [food.def.burstColor ?? '#ffffff', '#ffffff'], speed: 3, up: 2.5, size: 0.07, life: 0.6 });
  world.fx.burst({ x: e.x, y: e.y + e.size.y * 0.6, z: e.z }, { count: 6, color: ['#ff6b9a', '#ff9ec0'], speed: 1, up: 2.5, gravity: -1, drag: 1, size: 0.12, life: 1.2, glow: true });
  world.fx.sound('chomp');
  e.body.velocity.y += 3; // happy hop
  e.state.fed = ((e.state.fed as number) ?? 0) + 1;
  world.events.emit('ate', { eater: e, food });
  world.remove(food, 'eaten');
}

/** Finds the nearest edible thing, sets `state.seek` for movement, and eats on touch. */
export default defineBehavior({
  id: 'eats',
  tags: ['eats'],
  update(e, world, dt) {
    e.state.eatCooldown = Math.max(0, ((e.state.eatCooldown as number) ?? 0) - dt);
    const sight = e.prop('sight', 10);
    const food = world.nearest(e.body.position, sight, (o) => o !== e && o.has('edible') && !o.state.burning);
    e.state.seek = food ? { x: food.x, y: food.y, z: food.z } : null;
    if (food && world.touching(e, food, 0.35)) eat(e, food, world);
  },
  contact(e, other, world) {
    if (other?.has('edible')) eat(e, other, world);
  },
});
