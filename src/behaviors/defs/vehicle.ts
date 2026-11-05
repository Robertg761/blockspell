import { Vec3 } from 'cannon-es';
import { parked } from '../lib/ride';
import { inWater } from '../lib/water';
import { defineBehavior } from '../types';

const FWD = new Vec3(0, 0, 1);
const UP = new Vec3(0, 1, 0);
const fwd = new Vec3();
const up = new Vec3();

/** Drives along local +Z when on the ground (or water / in the air for boats / planes), turning back at cliffs. */
export default defineBehavior({
  id: 'vehicle',
  tags: ['vehicle'],
  order: 5,
  attach(e) {
    e.body.allowSleep = false;
  },
  update(e, world, dt) {
    if (Math.random() < dt * 0.4 && !e.has('frozen') && !parked(e)) world.fx.sound(e.has('flies') ? 'buzz' : 'engine', { pitch: 1 / Math.sqrt(e.scale), volume: 0.35 });
  },
  fixedUpdate(e, world, h) {
    if (e.has('frozen')) return;
    const b = e.body;
    b.quaternion.vmult(UP, up);
    const swimming = e.has('floats') && inWater(world, e);
    if (swimming) {
      // a keel: on water it rights itself instead of capsizing when it bumps into things
      const k = Math.min(1, h * 6);
      b.angularVelocity.x += (-up.z * 5 - b.angularVelocity.x) * k;
      b.angularVelocity.z += (up.x * 5 - b.angularVelocity.z) * k;
    }
    if (up.y < 0.6 || parked(e) || e.has('ridden')) return; // flipped over, or waiting for a driver
    const ground = world.groundAt(b.position.x, b.position.z);
    const onGround = Number.isFinite(ground) && b.position.y - e.size.y / 2 - ground < 0.25 && Math.abs(b.velocity.y) < 1.5;
    if (!onGround && !swimming && !e.has('flies')) return;
    if (e.has('floats') && !swimming && !e.has('flies') && e.def.id === 'boat') return; // boats don't drive on land
    b.quaternion.vmult(FWD, fwd);
    fwd.y = 0;
    const len = Math.hypot(fwd.x, fwd.z) || 1;
    fwd.x /= len;
    fwd.z /= len;
    const speed = e.prop('speed', 4) * Math.sqrt(e.scale) * ((e.state.speedMul as number) ?? 1);
    // steer away from the island's edge
    const look = 1.5 + e.size.z;
    const ahead = world.groundAt(b.position.x + fwd.x * look, b.position.z + fwd.z * look);
    const cliff = !swimming && !e.has('flies') && (!Number.isFinite(ahead) || ahead < b.position.y - e.size.y / 2 - 1.2);
    if (cliff) {
      b.angularVelocity.y = 2.4;
      b.velocity.x *= 0.9;
      b.velocity.z *= 0.9;
      return;
    }
    const k = Math.min(1, h * 3);
    b.velocity.x += (fwd.x * speed - b.velocity.x) * k;
    b.velocity.z += (fwd.z * speed - b.velocity.z) * k;
    b.angularVelocity.x *= 0.9;
    b.angularVelocity.z *= 0.9;
    if (e.has('flies')) b.angularVelocity.y = Math.sin(world.time * 0.3 + e.id) * 0.25;
  },
});
