import { shatter } from '../lib/debris';
import { defineBehavior } from '../types';

/** Seconds after first touching down that a thing can still bounce and topple unharmed. */
const ARRIVAL = 1.5;

/**
 * Shatters on a hard impact, or when something heavy (or much heavier) lands on it.
 * The first landing after spawning is forgiven, tumble included, so things don't break on arrival.
 */
export default defineBehavior({
  id: 'fragile',
  tags: ['fragile'],
  contact(e, other, world, { speed }) {
    const limit = e.prop('breakSpeed', 6);
    const crushing = !!other && other.body.mass > 0 && (other.has('heavy') || other.body.mass > e.body.mass * 6);
    const landedAt = (e.state.landedAt ??= world.time) as number;
    if (world.time - landedAt < ARRIVAL && (!crushing || speed < 1.5)) return;
    if (speed > limit || (crushing && speed > (other!.has('heavy') ? 1.2 : 2.5))) shatter(e, world);
  },
});
