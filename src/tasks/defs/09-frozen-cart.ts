import { adjectives } from '../../adjectives';
import { place } from '../../levels/goals';
import type { LevelSolution } from '../../levels/types';
import { Frame } from '../frame';
import { latch } from '../predicates';
import { defineTask, offset } from '../types';
import ember from '../zones/20-ember';

// A cart (a car, parked for good) frozen solid in a block of ice by the
// Ember Village well, southwest of the center. Heat that stays near it for a
// moment (or a blast) thaws it.
const f = new Frame(offset(ember.center, [-5, 0, 5.5]));

const solutions: LevelSolution[] = [
  { name: 'fire beside it', steps: [{ cast: 'fire', at: [1.7, 0] }], timeout: 8 },
  { name: 'torch beside it', steps: [{ cast: 'torch', at: [1.1, 0] }], timeout: 8 },
  { name: 'lava beside it', steps: [{ cast: 'lava', at: [2.2, 0] }], timeout: 8 },
  { name: 'flaming ball', steps: [{ cast: 'flaming ball', at: [1.1, 0] }], timeout: 8 },
  { name: 'bomb', steps: [{ cast: 'bomb', at: [2.4, 0] }], timeout: 10 },
];

export default defineTask({
  id: 'frozen-cart',
  zone: 'ember',
  order: 9,
  title: 'Thaw the frozen cart',
  hint: 'The cart is frozen solid. Warm it up with something hot, and keep the heat close for a moment.',
  setup(world) {
    // a short wooden track under the cart
    for (const x of [-0.45, 0.45]) f.staticBox(world, { position: [x, 0.05, 0], size: [0.15, 0.1, 3.5], color: 'woodDark' });
    const frozen = adjectives.get('frozen');
    const cart = place(world, 'car', f.p(0, 0.1, 0), 'cart', frozen ? { adjectives: [frozen] } : {});
    if (cart) {
      // just frozen: no melting into a puddle once thawed, and it stays parked
      world.removeTag(cart, 'cold');
      world.removeTag(cart, 'vehicle');
    }
  },
  check: latch('tagRemoved', ({ entity, tag }) => tag === 'frozen' && entity.state.role === 'cart'),
  start: f.p(3.5, 0, -2),
  solutions: solutions.map((s) => f.solution(s)),
});
