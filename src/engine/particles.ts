import {
  BoxGeometry, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, Quaternion, Scene, Vector3, Euler,
} from 'three';

export interface BurstOptions {
  count?: number;
  color?: string | string[];
  speed?: number;
  /** Upward bias added to velocity. */
  up?: number;
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  /** Spawn jitter radius. */
  spread?: number;
  /** Glowing (unlit) particles — sparks, embers, magic. */
  glow?: boolean;
  /** Particles grow instead of shrink (smoke). */
  grow?: boolean;
}

interface Particle {
  p: Vector3;
  v: Vector3;
  rot: Euler;
  spin: Vector3;
  life: number;
  max: number;
  size: number;
  gravity: number;
  drag: number;
  grow: boolean;
  color: Color;
}

class Pool {
  readonly mesh: InstancedMesh;
  readonly items: Particle[] = [];
  private m = new Matrix4();
  private q = new Quaternion();
  private s = new Vector3();

  constructor(scene: Scene, readonly capacity: number, glow: boolean) {
    const geo = new BoxGeometry(1, 1, 1);
    const mat = glow
      ? new MeshBasicMaterial({ color: 0xffffff })
      : new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    this.mesh = new InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = !glow;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  add(pt: Particle) {
    if (this.items.length >= this.capacity) this.items.shift();
    this.items.push(pt);
  }

  update(dt: number) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const pt = items[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        items[i] = items[items.length - 1];
        items.pop();
        continue;
      }
      pt.v.y -= pt.gravity * dt;
      pt.v.multiplyScalar(Math.max(0, 1 - pt.drag * dt));
      pt.p.addScaledVector(pt.v, dt);
      pt.rot.x += pt.spin.x * dt;
      pt.rot.y += pt.spin.y * dt;
      pt.rot.z += pt.spin.z * dt;
    }
    for (let i = 0; i < items.length; i++) {
      const pt = items[i];
      const k = pt.life / pt.max;
      const sz = pt.size * (pt.grow ? 0.4 + (1 - k) * 1.2 : Math.min(1, k * 2.2));
      this.s.set(sz, sz, sz);
      this.q.setFromEuler(pt.rot);
      this.m.compose(pt.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, pt.color);
    }
    this.mesh.count = items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.items.length = 0;
    this.mesh.count = 0;
  }
}

/** Pooled voxel-cube particles, rendered as two InstancedMeshes (lit + glowing). */
export class Particles {
  private lit: Pool;
  private glow: Pool;

  constructor(scene: Scene) {
    this.lit = new Pool(scene, 1500, false);
    this.glow = new Pool(scene, 1500, true);
  }

  burst(at: { x: number; y: number; z: number }, o: BurstOptions = {}): void {
    const count = o.count ?? 24;
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    const speed = o.speed ?? 4;
    const pool = o.glow ? this.glow : this.lit;
    for (let i = 0; i < count; i++) {
      const dir = new Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      const sp = speed * (0.4 + Math.random() * 0.8);
      const spread = o.spread ?? 0.15;
      const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.7);
      pool.add({
        p: new Vector3(at.x + dir.x * spread, at.y + dir.y * spread, at.z + dir.z * spread),
        v: dir.multiplyScalar(sp).add(new Vector3(0, o.up ?? 2, 0)),
        rot: new Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5),
        life,
        max: life,
        size: (o.size ?? 0.12) * (0.6 + Math.random() * 0.8),
        gravity: o.gravity ?? 9,
        drag: o.drag ?? 1,
        grow: !!o.grow,
        color: new Color(colors[Math.floor(Math.random() * colors.length)]),
      });
    }
  }

  update(dt: number): void {
    this.lit.update(dt);
    this.glow.update(dt);
  }

  clear(): void {
    this.lit.clear();
    this.glow.clear();
  }
}
