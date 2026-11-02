import { defineBehavior } from '../types';

/** Frictionless: things slide right off (and it slides across the ground). */
export default defineBehavior({
  id: 'slippery',
  tags: ['slippery'],
  attach(e) {
    const m = e.body.material;
    if (!m) return;
    e.state.frictionBefore = m.friction;
    m.friction = 0.002;
  },
  detach(e) {
    const m = e.body.material;
    if (m && typeof e.state.frictionBefore === 'number') m.friction = e.state.frictionBefore;
  },
  update(e, world, dt) {
    if (Math.random() < dt * 0.8) {
      const p = e.body.position;
      world.fx.burst({ x: p.x + (Math.random() - 0.5) * e.size.x, y: p.y + e.size.y * 0.5, z: p.z + (Math.random() - 0.5) * e.size.z }, { count: 1, color: '#ffffff', speed: 0, up: 0, gravity: 0, size: 0.07, life: 0.4, glow: true });
    }
  },
});
