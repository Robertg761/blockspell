import { ease } from '../../engine/tween';
import { defineBehavior } from '../types';
import { setMeshScale } from '../../voxel/hd';

/** High restitution, a boing, and a squash-and-stretch on impact. */
export default defineBehavior({
  id: 'bouncy',
  tags: ['bouncy'],
  attach(e) {
    const m = e.body.material;
    if (m) m.restitution = Math.max(m.restitution, 0.82);
  },
  contact(e, _other, world, { speed }) {
    if (speed < 1.5) return;
    world.fx.sound('boing', { pitch: 1.2 / Math.sqrt(e.scale), volume: Math.min(1, speed / 7) });
    const mesh = e.mesh;
    const amt = Math.min(0.35, speed * 0.04);
    world.fx.tweens.add({
      duration: 0.35,
      update: (t) => {
        const k = 1 - amt * (1 - ease.outElastic(t));
        setMeshScale(mesh, 1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      },
      done: () => setMeshScale(mesh, 1),
    });
  },
});
