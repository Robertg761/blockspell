import { explode, lightFuse } from '../lib/blast';
import { defineBehavior } from '../types';
import { setMeshScale } from '../../voxel/hd';

/** Fuse timer (from props or when lit by heat/fire), impact detonation, and the big boom. */
export default defineBehavior({
  id: 'explosive',
  tags: ['explosive'],
  attach(e, world) {
    const fuse = e.prop('fuse', 0);
    if (fuse > 0 || e.state.burning) lightFuse(e, world, fuse || 1.5);
  },
  update(e, world, dt) {
    if (e.state.burning && e.state.fuseLeft === undefined) lightFuse(e, world, 1.2);
    let left = e.state.fuseLeft as number | undefined;
    if (left === undefined) return;
    if (e.has('wet') || e.has('frozen')) {
      // doused: fuse fizzles out
      e.state.fuseLeft = undefined;
      setMeshScale(e.mesh, 1);
      world.fx.sound('sizzle', { volume: 0.5 });
      return;
    }
    left -= dt;
    e.state.fuseLeft = left;
    const p = e.body.position;
    const top = { x: p.x, y: p.y + e.size.y * 0.55, z: p.z };
    world.fx.burst(top, { count: 1, color: ['#fff4b8', '#ffd84a', '#ff8a2a'], speed: 2, up: 1.5, gravity: 4, size: 0.05, life: 0.35, glow: true });
    world.fx.glow.request(top, '#ffb050', 2);
    const urgency = Math.max(0, 1 - left / 2);
    const pulse = 1 + Math.max(0, Math.sin(world.time * (8 + urgency * 30))) * (0.04 + urgency * 0.12);
    setMeshScale(e.mesh, pulse);
    if (Math.random() < dt * (2 + urgency * 10)) world.fx.sound('click', { pitch: 1 + urgency, volume: 2 });
    if (left <= 0) {
      const s = Math.sqrt(e.scale);
      world.remove(e, 'exploded');
      explode(world, { x: p.x, y: p.y, z: p.z }, e.prop('blastRadius', 4) * s, e.prop('blastForce', 14) * s, e);
    }
  },
  contact(e, _other, world, { speed }) {
    const limit = (e.state.impactBlast as number | undefined) ?? e.prop('impactBlast', 0);
    if (limit > 0 && speed > limit && e.age > 0.8) lightFuse(e, world, 0.05);
  },
});
