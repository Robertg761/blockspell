import type { Entity } from '../../core/entity';
import type { GameWorld } from '../../core/world';
import { canEat } from '../lib/diet';
import { defineBehavior } from '../types';

function eat(e: Entity, food: Entity, world: GameWorld): void {
  if (!food.alive || (e.state.eatCooldown as number) > 0 || e.has('frozen')) return;
  e.state.eatCooldown = 1.2;
  e.state.seek = null;
  const p = food.body.position;
  world.fx.burst(p, { count: 22, color: [food.def.burstColor ?? '#ffffff', '#ffffff'], speed: 3, up: 2.5, size: 0.07, life: 0.6 });
  world.fx.burst({ x: e.x, y: e.y + e.size.y * 0.6, z: e.z }, { count: 6, color: ['#ff6b9a', '#ff9ec0'], speed: 1, up: 2.5, gravity: -1, drag: 1, size: 0.12, life: 1.2, glow: true });
  world.fx.sound('chomp', { pitch: 1 / Math.sqrt(e.scale) });
  e.body.velocity.y += 3; // happy hop
  e.state.fed = ((e.state.fed as number) ?? 0) + 1;
  world.events.emit('ate', { eater: e, food });
  world.remove(food, 'eaten');
}

/** Finds the nearest thing it likes to eat (ObjectDef.diet), chases it via `state.seek`, eats on touch. */
export default defineBehavior({
  id: 'eats',
  tags: ['eats'],
  update(e, world, dt) {
    e.state.eatCooldown = Math.max(0, ((e.state.eatCooldown as number) ?? 0) - dt);
    if (e.has('frozen')) return;
    const sight = e.prop('sight', 10) * Math.sqrt(e.scale);
    const food = world.nearest(e.body.position, sight, (o) => canEat(e, o) && o.body.mass < e.body.mass * 3 + 1);
    e.state.seek = food ? { x: food.x, y: food.y, z: food.z } : null;
    e.state.food = food;
    if (food && world.touching(e, food, 0.35)) eat(e, food, world);
  },
  contact(e, other, world) {
    if (other && canEat(e, other)) eat(e, other, world);
  },
});
