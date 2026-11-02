import { emitFlames } from '../../behaviors/lib/fire';
import { defineObject } from '../types';

export default defineObject({
  id: 'fire',
  name: 'fire',
  synonyms: ['flame', 'flames', 'campfire', 'bonfire', 'blaze', 'inferno'],
  category: 'nature',
  blurb: 'Hot! Lights flammable things. Water puts it out.',
  tags: ['hot'],
  burstColor: '#ff8a2a',
  spawnSound: 'ignite',
  voxelSize: 0.08,
  physics: { mass: 3, shape: 'box', uprightOnly: true, friction: 0.9 },
  props: { extinguishable: 1, heatRadius: 1.2 },
  build(b, rng) {
    // two crossed charred logs
    b.box(0, 0, 4, 11, 1, 5, 'charcoal');
    b.box(5, 1, 0, 6, 2, 10, 'woodDark');
    b.box(4, 0, 4, 7, 1, 6, 'ember');
    // flame silhouette, then paint a hot-core-to-red-tips gradient with noise
    b.ellipsoid(5.5, 5, 5, 4, 4.5, 4, 'flameOuter');
    b.ellipsoid(5.5, 8, 5, 2.8, 4, 2.8, 'flameOuter');
    b.box(5, 11, 5, 6, 13, 5, 'flameTip');
    if (rng() > 0.5) b.box(3, 9, 4, 3, 10, 4, 'flameTip');
    else b.box(8, 9, 6, 8, 10, 6, 'flameTip');
    b.paint((x, y, z, c) => {
      if (!c.startsWith('flame')) return undefined;
      const r = Math.hypot(x + 0.5 - 5.5, z + 0.5 - 5) / 4;
      const h = (y - 1) / 12 + r * 0.45 + (rng() - 0.5) * 0.22;
      return h < 0.3 ? 'flameCore' : h < 0.55 ? 'flameMid' : h < 0.85 ? 'flameOuter' : 'flameTip';
    });
  },
  update(e, world, dt) {
    const t = world.time * 9 + e.id;
    e.mesh.scale.set(1 + Math.sin(t * 1.3) * 0.04, 1 + Math.sin(t) * 0.08 + Math.sin(t * 2.7) * 0.04, 1 + Math.cos(t * 1.1) * 0.04);
    emitFlames(world, e, dt, 1);
  },
});
