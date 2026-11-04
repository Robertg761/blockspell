import { emptyModifiers } from '../../adjectives/types';
import { objects } from '../../objects';
import { defineBehavior } from '../types';

/** A seed that gets wet (water, rain, a "wet" spell) sprouts into a tree after a couple of seconds. */
export default defineBehavior({
  id: 'seed',
  tags: ['seed'],
  update(e, world, dt) {
    if (!e.has('wet')) {
      e.state.sprout = 0;
      return;
    }
    e.state.sprout = ((e.state.sprout as number) ?? 0) + dt;
    const p = e.body.position;
    if (Math.random() < dt * 6) world.fx.burst({ x: p.x, y: p.y + 0.1, z: p.z }, { count: 2, color: ['#7ed36a', '#b7f09a'], speed: 0.6, up: 1.2, gravity: -0.4, size: 0.06, life: 0.7, glow: true });
    if ((e.state.sprout as number) < e.prop('growTime', 2.4)) return;
    const tree = objects.get('tree');
    if (!tree) return;
    const ground = world.groundAt(p.x, p.z);
    world.remove(e, 'used');
    const mods = emptyModifiers();
    world.spawn(tree, { position: { x: p.x, y: Number.isFinite(ground) ? ground : p.y, z: p.z }, mods, label: 'tree' });
    world.fx.sparkle({ x: p.x, y: p.y + 0.4, z: p.z }, undefined, 18);
    world.fx.sound('chime', { pitch: 1.6, volume: 0.7 });
  },
});
