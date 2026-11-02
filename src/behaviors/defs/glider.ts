import { Vec3 } from 'cannon-es';
import { defineBehavior } from '../types';

const UP = new Vec3(0, 1, 0);
const up = new Vec3();
const torque = new Vec3();

/** Parachutes and umbrellas: caps fall speed and rights itself (canopy up). Carries what's welded to it. */
export default defineBehavior({
  id: 'glider',
  tags: ['glider'],
  fixedUpdate(e, world, h) {
    const b = e.body;
    if (b.mass === 0) return;
    const max = e.prop('fallSpeed', 1.5);
    if (b.velocity.y < -max) {
      b.velocity.y += (-max - b.velocity.y) * Math.min(1, h * 8);
      for (const l of world.linksOf(e)) {
        const o = l.a === e ? l.b : l.a;
        if (o.body.velocity.y < -max) o.body.velocity.y += (-max - o.body.velocity.y) * Math.min(1, h * 8);
      }
    }
    b.quaternion.vmult(UP, up);
    // torque = up × worldUp, pulls the canopy back over the top
    torque.set(-up.z, 0, up.x);
    torque.scale(b.mass * 6, torque);
    b.applyTorque(torque);
  },
});
