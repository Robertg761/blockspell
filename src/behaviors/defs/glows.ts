import type { MeshStandardMaterial } from 'three';
import { defineBehavior } from '../types';

/** Casts a (pooled) point light; gives non-emissive things a soft self-glow. */
export default defineBehavior({
  id: 'glows',
  tags: ['glows'],
  attach(e) {
    if (!e.state.glowAdjective) return;
    const m = e.materials[0] as MeshStandardMaterial;
    m.emissive.set(e.def.burstColor ?? '#fff3b0');
    m.emissiveIntensity = 0.35;
  },
  detach(e) {
    (e.materials[0] as MeshStandardMaterial).emissiveIntensity = 0;
  },
  update(e, world) {
    if (e.state.burning) return; // fire already lights it
    const p = e.body.position;
    world.fx.glow.request({ x: p.x, y: p.y + e.size.y * 0.3, z: p.z }, e.def.burstColor ?? '#fff0b0', e.prop('glow', 4) * Math.sqrt(e.scale));
  },
});
