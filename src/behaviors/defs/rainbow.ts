import { BufferAttribute, Color, Mesh, type BufferGeometry } from 'three';
import { isSharedGeometry, refreshVoxelMesh } from '../../voxel/hd';
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

/**
 * The mesh's own copy of its geometry to repaint (voxel geometry is shared through a cache), with
 * the original colors. A new copy is made if the mesh's geometry changed (HD arriving, quality toggle).
 */
function paintable(m: Mesh): { geo: BufferGeometry; orig: Float32Array } {
  let own = m.userData.rainbow as { geo: BufferGeometry; src: BufferGeometry; orig: Float32Array } | undefined;
  if (own && m.geometry === own.geo) return own;
  if (own) own.geo.dispose();
  const src = m.geometry;
  const geo = isSharedGeometry(src) ? src.clone() : src;
  geo.userData = { ...src.userData, voxelCache: false };
  const col = geo.getAttribute('color') as BufferAttribute;
  const orig = new Float32Array(col.count * 3);
  for (let i = 0; i < col.count; i++) {
    orig[i * 3] = col.getX(i);
    orig[i * 3 + 1] = col.getY(i);
    orig[i * 3 + 2] = col.getZ(i);
  }
  own = { geo, src, orig };
  m.userData.rainbow = own;
  m.geometry = geo;
  return own;
}

/** Repaints vertex colors as shifting rainbow bands (keeping shading), and sheds colorful sparkles. */
function paint(e: Entity, t: number): void {
  for (const m of meshes(e)) {
    const { geo, orig } = paintable(m);
    const col = geo.getAttribute('color') as BufferAttribute;
    const pos = geo.getAttribute('position') as BufferAttribute;
    // positions may be in packed units: the mesh's own scale brings them back to meters
    const unit = (m.userData.unit as number | undefined) ?? 1;
    const span = Math.max(0.3, e.size.y);
    for (let i = 0; i < col.count; i++) {
      c.setRGB(orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]).getHSL(hsl);
      const h = (((pos.getY(i) * unit) / span) * 0.8 + pos.getX(i) * unit * 0.15 + t) % 1;
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
      const own = m.userData.rainbow as { geo: BufferGeometry; src: BufferGeometry; orig: Float32Array } | undefined;
      if (!own) continue;
      delete m.userData.rainbow;
      if (own.geo !== own.src) {
        // back to the shared geometry
        if (m.geometry === own.geo) m.geometry = own.src;
        own.geo.dispose();
        refreshVoxelMesh(m);
      } else {
        const col = own.geo.getAttribute('color') as BufferAttribute;
        for (let i = 0; i < col.count; i++) col.setXYZ(i, own.orig[i * 3], own.orig[i * 3 + 1], own.orig[i * 3 + 2]);
        col.needsUpdate = true;
      }
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
