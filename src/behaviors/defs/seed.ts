import { emptyModifiers } from '../../adjectives/types';
import { objects } from '../../objects';
import { soak } from '../lib/water';
import { defineBehavior } from '../types';

/** Things that water a seed they land beside (melting, in the case of ice and snow). */
const WATERY = new Set(['ice', 'snowball', 'snowman']);

/** A seed that gets wet (water, rain, a "wet" spell, a bucket or ice beside it) sprouts into a tree after a couple of seconds. */
export default defineBehavior({
  id: 'seed',
  tags: ['seed'],
  update(e, world, dt) {
    // A bucket, a wet thing, ice or snow landing right by the seed waters it too (checked a few times a second).
    e.state.wetCheck = ((e.state.wetCheck as number) ?? 0) - dt;
    if (!e.has('wet') && (e.state.wetCheck as number) <= 0) {
      e.state.wetCheck = 0.25;
      const waterer = world.nearest(e.body.position, 2.5, (o) => o !== e && !o.has('seed') && !o.has('liquid') && !o.has('animal')
        && (o.has('wet') || o.def.use === 'douse' || WATERY.has(o.def.id)) && world.touching(e, o, 0.6));
      if (waterer) {
        soak(world, e, 8);
        world.fx.burst(e.body.position, { count: 14, color: ['#7cc7ff', '#cfeaff', '#ffffff'], speed: 2, up: 2, size: 0.07, life: 0.6 });
        world.fx.sound('splash', { volume: 0.5 });
      }
    }
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
