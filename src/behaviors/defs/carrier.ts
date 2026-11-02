import { defineBehavior } from '../types';

/**
 * Grabs light things it bumps into on a string and carries them aloft. The
 * flying behavior adds the payload's weight to its lift (state.payloadMass).
 */
export default defineBehavior({
  id: 'carrier',
  tags: ['carrier'],
  update(e, world) {
    let m = 0;
    for (const l of world.linksOf(e, 'rope')) m += (l.a === e ? l.b : l.a).body.mass;
    e.state.payloadMass = m;
  },
  contact(e, other, world) {
    if (!other || other.body.mass === 0 || other.has('carrier') || other.has('liquid') || other.has('ghost')) return;
    if (world.linksOf(e, 'rope').length >= 2 || world.linksOf(other, 'rope').length) return;
    const max = e.prop('carryMass', 3) * e.scale ** 2;
    if (other.body.mass + ((e.state.payloadMass as number) ?? 0) > max) return;
    const len = Math.max(e.distanceTo(other), e.size.y * 0.5 + other.size.y * 0.5 + 0.3);
    if (world.link(e, other, 'rope', len)) {
      world.fx.sound('squeak', { pitch: 1.4 });
      world.fx.sparkle(other.body.position, undefined, 8);
    }
  },
});
