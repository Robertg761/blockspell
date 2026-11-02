import type { MeshStandardMaterial } from 'three';
import { defineBehavior } from '../types';

/**
 * Frozen solid: icy blue tint, no moving/flying/thrusting (other behaviors
 * check the tag), slippery. Heat thaws it (see `hot`), which removes the tag.
 */
export default defineBehavior({
  id: 'frozen',
  tags: ['frozen'],
  order: -5,
  attach(e, world) {
    const m = e.materials[0] as MeshStandardMaterial;
    m.color.setRGB(0.62, 0.82, 1.15);
    m.emissive.set('#3a6f9a');
    m.emissiveIntensity = 0.25;
    m.roughness = 0.25;
    e.state.burning = false;
    if (!e.has('slippery')) {
      e.state.frozenSlippery = true;
      world.addTag(e, 'slippery');
    }
    if (e.age > 0.1) {
      world.fx.sound('freeze');
      world.fx.sparkle(e.body.position, ['#ffffff', '#bfe8ff', '#7fc8ff'], 24);
    }
  },
  detach(e, world) {
    const m = e.materials[0] as MeshStandardMaterial;
    m.color.setRGB(1, 1, 1);
    m.emissiveIntensity = 0;
    m.roughness = 0.78;
    if (e.state.frozenSlippery) world.removeTag(e, 'slippery');
    world.fx.sound('sizzle', { volume: 0.4 });
  },
  fixedUpdate(e) {
    if (!e.has('animal')) return;
    e.body.velocity.x *= 0.98;
    e.body.velocity.z *= 0.98;
  },
});
