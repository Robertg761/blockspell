import { Vec3 } from 'cannon-es';
import { ignite } from '../lib/fire';
import { defineBehavior } from '../types';

const UP = new Vec3(0, 1, 0);
const dir = new Vec3();
const force = new Vec3();
const EXHAUST = ['#fff4b8', '#ffd84a', '#ffb43c', '#ff6c1e'];

/** Rocket engine: pushes along the body's local +Y while fuel lasts, with flame, smoke and rumble. */
export default defineBehavior({
  id: 'thrust',
  tags: ['thrust'],
  attach(e) {
    e.state.fuel = e.prop('fuel', 4) * Math.sqrt(e.scale);
    e.state.ignitionDelay = 0.6;
    e.body.allowSleep = false;
    e.body.angularDamping = Math.max(e.body.angularDamping, 0.6);
  },
  update(e, world, dt) {
    const delay = (e.state.ignitionDelay as number) - dt;
    e.state.ignitionDelay = delay;
    if (delay > 0 || (e.state.fuel as number) <= 0 || e.has('frozen')) return;
    e.state.fuel = (e.state.fuel as number) - dt;
    if ((e.state.fuel as number) <= 0) {
      world.fx.poof(e.body.position, ['#777', '#999', '#bbb'], 0.6);
      return;
    }
    e.body.quaternion.vmult(UP, dir);
    const p = e.body.position;
    const nozzle = { x: p.x - dir.x * e.size.y * 0.55, y: p.y - dir.y * e.size.y * 0.55, z: p.z - dir.z * e.size.y * 0.55 };
    const s = Math.sqrt(e.scale);
    for (let i = 0; i < 3; i++)
      world.fx.burst(nozzle, { count: 1, color: EXHAUST, speed: 1.2, up: -dir.y * 5, gravity: 0, drag: 2.5, size: 0.14 * s, life: 0.35, glow: true, spread: 0.06 * s });
    if (Math.random() < 0.5)
      world.fx.burst(nozzle, { count: 1, color: ['#cfcfcf', '#a9a9a9', '#e8e8e8'], speed: 1, up: -dir.y * 2, gravity: -0.6, drag: 1.2, size: 0.25 * s, life: 1.6, grow: true });
    world.fx.glow.request(nozzle, '#ffa040', 6 * s);
    if (Math.random() < dt * 3) world.fx.sound('rumble', { pitch: 1 / s, volume: 0.6 });
    // exhaust is hot
    if (Math.random() < dt * 5)
      for (const o of world.nearby(nozzle, 0.8 * s)) if (o !== e && o.has('flammable')) ignite(o, world);
  },
  fixedUpdate(e, world) {
    if ((e.state.ignitionDelay as number) > 0 || (e.state.fuel as number) <= 0 || e.has('frozen')) return;
    e.body.quaternion.vmult(UP, dir);
    let payload = 0;
    for (const l of world.linksOf(e)) payload += (l.a === e ? l.b : l.a).body.mass;
    const mag = e.prop('thrust', 2.2) * 9.82 * (e.body.mass + payload * 0.8);
    force.set(dir.x * mag, dir.y * mag, dir.z * mag);
    e.body.applyForce(force);
  },
});
