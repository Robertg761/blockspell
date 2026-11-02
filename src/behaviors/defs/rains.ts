import { extinguish } from '../lib/fire';
import { soak } from '../lib/water';
import { defineBehavior } from '../types';

/** Rain clouds: drizzle on everything beneath, soaking it and dousing fires. */
export default defineBehavior({
  id: 'rains',
  tags: ['rains'],
  update(e, world, dt) {
    const p = e.body.position;
    const rx = e.size.x * 0.4, rz = e.size.z * 0.4;
    const n = Math.floor(dt * 40 * Math.max(1, e.size.x * e.size.z) + Math.random());
    for (let i = 0; i < n; i++)
      world.fx.burst({ x: p.x + (Math.random() * 2 - 1) * rx, y: p.y - e.size.y * 0.35, z: p.z + (Math.random() * 2 - 1) * rz }, { count: 1, color: ['#7cc4ff', '#a8dcff', '#5aaef0'], speed: 0, up: -4, gravity: 12, drag: 0, size: 0.045, life: 1.1, spread: 0 });
    let t = ((e.state.rainTick as number) ?? 0) - dt;
    if (t <= 0) {
      t = 0.25;
      for (const o of world.nearby({ x: p.x, y: p.y - 4, z: p.z }, 6)) {
        if (o === e || o.y > p.y || Math.abs(o.x - p.x) > rx + o.radius * 0.5 || Math.abs(o.z - p.z) > rz + o.radius * 0.5) continue;
        if (o.state.burning || (o.has('hot') && o.prop('extinguishable', 0) > 0)) extinguish(o, world);
        else if (!o.has('hot') && !o.has('rains')) soak(world, o, 5);
      }
    }
    e.state.rainTick = t;
  },
});
