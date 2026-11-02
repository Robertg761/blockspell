import { defineBehavior } from '../types';

/** Heavy things land with a thud, kick up dust and shake the camera. */
export default defineBehavior({
  id: 'heavy',
  tags: ['heavy'],
  contact(e, other, world, { speed }) {
    if (speed < 2.5) return;
    if (other && other.body.mass > e.body.mass) return;
    const p = e.body.position;
    world.fx.addShake(Math.min(0.7, 0.1 + e.body.mass * speed * 0.002));
    world.fx.sound('thud', { pitch: 1 / Math.sqrt(e.scale), volume: Math.min(1, speed / 8) });
    world.fx.burst({ x: p.x, y: p.y - e.size.y / 2, z: p.z }, { count: 20, color: ['#b59a78', '#8c7a62', '#cbb592'], speed: 3, up: 1.5, gravity: 4, drag: 2, size: 0.15, life: 0.8, grow: true, spread: e.radius * 0.6 });
  },
});
