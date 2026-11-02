import { defineBehavior } from '../types';

/**
 * Marker tags with no per-frame logic yet. They are queried by other
 * behaviors (e.g. `eats` looks for `edible`) and are hook points for later
 * passes (e.g. a climbing character checks `climbable`).
 */
export default [
  defineBehavior({ id: 'edible', tags: ['edible'] }),
  defineBehavior({ id: 'climbable', tags: ['climbable'] }),
];
