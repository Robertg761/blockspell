import { ease } from '../../engine/tween';
import { defineBehavior } from '../types';

/** Trampolines and springs: anything landing on top is flung skyward. */
export default defineBehavior({
  id: 'launcher',
  tags: ['launcher'],
  contact(e, other, world) {
    if (!other || other.body.mass === 0 || e.has('frozen')) return;
    const top = e.y + e.size.y * 0.15;
    if (other.y < top) return;
    const last = (other.state.launchedAt as number) ?? -1;
    if (world.time - last < 0.35) return;
    other.state.launchedAt = world.time;
    const v = e.prop('launch', 10) * Math.sqrt(e.scale);
    other.body.wakeUp();
    other.body.velocity.y = Math.max(other.body.velocity.y, v);
    world.fx.sound('boing', { pitch: 0.8 / Math.sqrt(e.scale) });
    world.fx.burst({ x: other.x, y: top + e.size.y * 0.3, z: other.z }, { count: 14, color: ['#ffffff', '#fff6a8', '#ffd84a'], speed: 3, up: 1, size: 0.07, life: 0.5, glow: true });
    const mesh = e.mesh;
    world.fx.tweens.add({
      duration: 0.5,
      update: (t) => {
        const k = 1 - 0.3 * (1 - ease.outElastic(t));
        mesh.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      },
      done: () => mesh.scale.set(1, 1, 1),
    });
  },
});
