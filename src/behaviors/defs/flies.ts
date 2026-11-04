import { Vec3 } from 'cannon-es';
import { parked } from '../lib/ride';
import { defineBehavior } from '../types';

const force = new Vec3();
const point = new Vec3();

/**
 * Lift that counteracts gravity, settling around a ceiling height, with a gentle
 * sway. Carriers get extra lift for whatever hangs off their strings.
 */
export default defineBehavior({
  id: 'flies',
  tags: ['flies'],
  attach(e) {
    e.body.allowSleep = false;
    e.body.linearDamping = Math.max(e.body.linearDamping, 0.5);
    e.body.angularDamping = Math.max(e.body.angularDamping, 0.8);
  },
  detach(e) {
    e.body.allowSleep = true;
  },
  fixedUpdate(e, world, _h) {
    if (e.has('frozen') || e.body.mass === 0 || parked(e, world)) return;
    const b = e.body;
    const ground = Math.max(0, world.groundAt(b.position.x, b.position.z));
    const alt = b.position.y - ground;
    const ceiling = e.prop('ceiling', 8) * Math.sqrt(e.scale);
    const baseLift = e.prop('lift', 1.25);
    const lift = alt < ceiling ? baseLift : Math.max(0.85, baseLift - (alt - ceiling) * 0.5);
    const t = world.time * 0.6 + e.id * 1.7;
    const payload = (e.state.payloadMass as number) ?? 0;
    const g = 9.82 * b.mass;
    const carry = 9.82 * payload * (alt < ceiling ? 1.12 : Math.max(0.8, 1.12 - (alt - ceiling) * 0.3));
    force.set(Math.sin(t) * 0.08 * g, g * lift + carry, Math.cos(t * 0.8) * 0.08 * g);
    // apply lift above the center so the object hangs upright like a pendulum
    point.set(0, e.size.y * 0.3, 0);
    b.applyForce(force, point);
  },
});
