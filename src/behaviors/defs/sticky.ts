import { defineBehavior } from '../types';

/** Welds itself to whatever it touches (up to a few things), with a gooey splat. */
export default defineBehavior({
  id: 'sticky',
  tags: ['sticky'],
  attach(e) {
    const m = e.body.material;
    if (m) m.friction = 1;
  },
  contact(e, other, world) {
    if (!other || other.has('liquid') || other.has('ghost') || e.age < 0.3) return;
    if (world.linksOf(e, 'lock').length >= 4) return;
    if (world.link(e, other, 'lock')) {
      world.fx.sound('chomp', { pitch: 0.6, volume: 0.6 });
      const p = other.body.position;
      world.fx.burst({ x: (e.x + p.x) / 2, y: (e.y + p.y) / 2, z: (e.z + p.z) / 2 }, { count: 10, color: ['#a6e05a', '#d8f59a', '#ffd84a'], speed: 1.5, up: 1, size: 0.07, life: 0.6 });
    }
  },
  update(e, world, dt) {
    if (Math.random() < dt * 1.5) {
      const p = e.body.position;
      world.fx.burst({ x: p.x + (Math.random() - 0.5) * e.size.x * 0.7, y: p.y - e.size.y * 0.45, z: p.z + (Math.random() - 0.5) * e.size.z * 0.7 }, { count: 1, color: ['#c6e86a', '#e8d24a'], speed: 0, up: -0.2, gravity: 3, size: 0.06, life: 0.7 });
    }
  },
});
