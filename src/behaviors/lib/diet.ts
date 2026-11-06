import type { Entity } from '../../core/entity';

/** What an eater eats: a level can widen one animal's tastes (`state.diet`), else ObjectDef.diet. */
export const dietOf = (eater: Entity): string[] | undefined => (eater.state.diet as string[] | undefined) ?? eater.def.diet;

/** Would `eater` eat `food`? Uses its diet (ids or tags), defaulting to anything edible. */
export function canEat(eater: Entity, food: Entity): boolean {
  if (eater === food || !food.alive || food.state.burning || food.has('ghost')) return false;
  const diet = dietOf(eater);
  if (!diet) return food.has('edible');
  return diet.some((d) => food.def.id === d || food.has(d));
}
