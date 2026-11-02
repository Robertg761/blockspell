import { defineBehavior } from '../types';

/** The hero walks to wherever the player last clicked (the `animal` behavior does the walking and climbing). */
export default defineBehavior({
  id: 'player',
  tags: ['player'],
  order: 5,
  update(e, world, dt) {
    const aim = world.aim;
    if (!aim) return;
    const d = Math.hypot(aim.x - e.x, aim.z - e.z);
    const arrived = d < 0.45 + e.size.z * 0.3 && Math.abs(aim.y - (e.y - e.size.y / 2)) < 0.6;
    e.state.seek = arrived ? null : { x: aim.x, y: aim.y, z: aim.z };
    if (!arrived) e.state.wanderTimer = 3; // don't wander off while on a mission
    if (arrived && !e.state.cheered) {
      e.state.cheered = true;
      world.fx.sparkle(e.body.position, undefined, 8);
    }
    if (!arrived) e.state.cheered = false;
    void dt;
  },
});
