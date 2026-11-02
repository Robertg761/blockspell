import type { Entity } from '../../core/entity';

/** Would `eater` eat `food`? Uses ObjectDef.diet (ids or tags), defaulting to anything edible. */
export function canEat(eater: Entity, food: Entity): boolean {
  if (eater === food || !food.alive || food.state.burning || food.has('ghost')) return false;
  const diet = eater.def.diet;
  if (!diet) return food.has('edible');
  return diet.some((d) => food.def.id === d || food.has(d));
}
