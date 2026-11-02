import { BufferAttribute, Color, Mesh } from 'three';
import type { Entity } from '../../core/entity';
import { defineBehavior } from '../types';

const c = new Color();
const hsl = { h: 0, s: 0, l: 0 };

function meshes(e: Entity): Mesh[] {
  const out: Mesh[] = [];
  e.visual.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

/** Repaints vertex colors as shifting rainbow bands (keeping shading), and sheds colorful sparkles. */
function paint(e: Entity, t: number): void {
  for (const m of meshes(e)) {
    const col = m.geometry.getAttribute('color') as BufferAttribute;
    const pos = m.geometry.getAttribute('position') as BufferAttribute;
    let orig = m.userData.origColors as Float32Array | undefined;
    if (!orig) orig = m.userData.origColors = (col.array as Float32Array).slice();
    const span = Math.max(0.3, e.size.y);
    for (let i = 0; i < col.count; i++) {
      c.setRGB(orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]).getHSL(hsl);
      const h = ((pos.getY(i) / span) * 0.8 + pos.getX(i) * 0.15 + t) % 1;
      c.setHSL((h + 1) % 1, 0.85, Math.min(0.62, Math.max(0.3, hsl.l * 0.6 + 0.2)));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }
}

export default defineBehavior({
  id: 'rainbow',
  tags: ['rainbow'],
  attach(e) {
    paint(e, 0);
  },
  detach(e) {
    for (const m of meshes(e)) {
      const orig = m.userData.origColors as Float32Array | undefined;
      if (!orig) continue;
      (m.geometry.getAttribute('color').array as Float32Array).set(orig);
      m.geometry.getAttribute('color').needsUpdate = true;
    }
  },
  update(e, world, dt) {
    // shimmer at ~8 Hz to keep it cheap
    e.state.rainbowT = ((e.state.rainbowT as number) ?? 0) + dt;
    if ((e.state.rainbowT as number) > 0.12) {
      e.state.rainbowT = 0;
      paint(e, world.time * 0.35);
    }
    if (Math.random() < dt * 4) {
      const p = e.body.position;
      world.fx.burst({ x: p.x + (Math.random() - 0.5) * e.size.x, y: p.y + (Math.random() - 0.5) * e.size.y, z: p.z + (Math.random() - 0.5) * e.size.z }, { count: 1, color: ['#ff5d6c', '#ffd84a', '#52b848', '#3d7fe0', '#9256d6'], speed: 0.5, up: 0.8, gravity: 0.5, size: 0.06, life: 0.8, glow: true });
    }
  },
});
