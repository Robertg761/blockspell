import { emitFlames, ignite, setChar } from '../lib/fire';
import { defineBehavior } from '../types';

/** Burning lifecycle: heat builds up → ignite → flames & charring → burns away. */
export default defineBehavior({
  id: 'flammable',
  tags: ['flammable'],
  attach(e, world) {
    if (e.state.burning) {
      e.state.burning = false; // spawned "flaming": run the real ignite path
      ignite(e, world);
    }
  },
  update(e, world, dt) {
    if (!e.state.burning) {
      e.state.heat = Math.max(0, e.state.heat - dt * 0.35);
      return;
    }
    emitFlames(world, e, dt, 0.8);
    e.state.burnLeft -= dt;
    const total = (e.state.burnTotal as number) || 1;
    setChar(e, 1 - e.state.burnLeft / total);
    if (e.state.burnLeft <= 0) {
      e.state.charred = true;
      world.fx.burst(e.body.position, { count: 26, color: ['#2d2723', '#6f6a64', '#444'], speed: 2.5, up: 2, size: 0.12, life: 1 });
      world.fx.poof(e.body.position, ['#555', '#777', '#999'], Math.max(0.7, e.radius * 1.3));
      world.events.emit('burnedUp', { entity: e });
      world.remove(e, 'burned');
    }
  },
});
