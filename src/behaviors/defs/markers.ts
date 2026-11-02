import { defineBehavior } from '../types';

/**
 * Marker tags with no per-frame logic. They are queried by other behaviors
 * (`eats` looks for `edible`, magnets pull `metal`, `animal` climbs `climbable`).
 */
export default [
  defineBehavior({ id: 'edible', tags: ['edible'] }),
  defineBehavior({ id: 'climbable', tags: ['climbable'] }),
  defineBehavior({ id: 'metal', tags: ['metal'] }),
  defineBehavior({ id: 'poppable', tags: ['poppable'] }),
];
