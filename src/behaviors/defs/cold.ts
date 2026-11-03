import { emptyModifiers } from '../../adjectives/types';
import { objects } from '../../objects';
import { extinguish, steam } from '../lib/fire';
import { splash } from '../lib/water';
import { defineBehavior } from '../types';
import { setMeshScale } from '../../voxel/hd';

/**
 * Cold things melt near heat (the `hot` behavior raises state.melt), shrinking
 * and dripping until they collapse into a puddle. Touching water makes them
 * slippery; touching flames puts them out.
 */
export default defineBehavior({
  id: 'cold',
  tags: ['cold'],
  update(e, world, dt) {
    const melt = (e.state.melt as number) ?? 0;
    if (melt > 0) {
      const k = 1 - melt * 0.65;
      setMeshScale(e.mesh, k, k * (1 - melt * 0.15), k);
      e.mesh.position.y = -e.size.y * (1 - k) * 0.5;
      if (Math.random() < dt * 14) {
        const p = e.body.position;
        world.fx.burst(
          { x: p.x + (Math.random() - 0.5) * e.size.x * k, y: p.y - e.size.y * 0.4, z: p.z + (Math.random() - 0.5) * e.size.z * k },
          { count: 1, color: ['#9fd8ff', '#c9ecff'], speed: 0.3, up: 0, gravity: 9, size: 0.06, life: 0.5 },
        );
      }
      if (Math.random() < dt * 1.5) world.fx.sound('sizzle', { volume: 0.25, pitch: 1.4 });
      if (melt >= 1) {
        const p = e.body.position;
        splash(world, p, Math.max(0.6, e.radius));
        steam(world, p, Math.max(0.5, e.radius * 0.8));
        const water = objects.get('water');
        if (water && e.radius > 0.25) {
          const mods = emptyModifiers();
          mods.scale = Math.min(0.9, Math.max(0.25, e.radius * 0.6));
          world.spawn(water, { position: { x: p.x, y: p.y, z: p.z }, mods, silent: true, label: 'puddle' });
        }
        world.remove(e, 'melted');
        return;
      }
    }
    // frost sparkles
    if (Math.random() < dt * 1.2) {
      const p = e.body.position;
      world.fx.burst({ x: p.x + (Math.random() - 0.5) * e.size.x, y: p.y + e.size.y * 0.4, z: p.z + (Math.random() - 0.5) * e.size.z }, { count: 1, color: ['#ffffff', '#dff4ff'], speed: 0.2, up: 0.3, gravity: 0, size: 0.04, life: 0.6, glow: true });
    }
    for (const o of world.nearby(e.body.position, e.radius + 3)) {
      if (o === e || !world.touching(e, o, 0.1)) continue;
      if (o.state.burning) extinguish(o, world);
      if ((o.has('wet') || o.has('liquid')) && !e.has('slippery')) {
        world.addTag(e, 'slippery');
        world.fx.sparkle(e.body.position, ['#ffffff', '#bfe8ff'], 12);
      }
    }
  },
});
