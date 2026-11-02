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

const colorCache = new Map<string, Color>();
function cachedColor(hex: string): Color {
  let c = colorCache.get(hex);
  if (!c) colorCache.set(hex, (c = new Color(hex)));
  return c;
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

  private free: Particle[] = [];
  private oldest = 0;

  /** Returns a recycled particle slot (reusing the oldest live one when full). */
  obtain(): Particle {
    if (this.items.length >= this.capacity) {
      this.oldest = (this.oldest + 1) % this.items.length;
      return this.items[this.oldest];
    }
    const pt = this.free.pop() ?? {
      p: new Vector3(), v: new Vector3(), rot: new Euler(), spin: new Vector3(),
      life: 0, max: 1, size: 0, gravity: 0, drag: 0, grow: false, color: new Color(),
    };
    this.items.push(pt);
    return pt;
  }

  update(dt: number) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const pt = items[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        items[i] = items[items.length - 1];
        items.pop();
        this.free.push(pt);
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
    for (const pt of this.items) this.free.push(pt);
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
    const spread = o.spread ?? 0.15;
    const up = o.up ?? 2;
    for (let i = 0; i < count; i++) {
      const pt = pool.obtain();
      const dir = pt.v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      pt.p.set(at.x + dir.x * spread, at.y + dir.y * spread, at.z + dir.z * spread);
      dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      dir.y += up;
      pt.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      pt.spin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
      pt.life = pt.max = (o.life ?? 0.8) * (0.6 + Math.random() * 0.7);
      pt.size = (o.size ?? 0.12) * (0.6 + Math.random() * 0.8);
      pt.gravity = o.gravity ?? 9;
      pt.drag = o.drag ?? 1;
      pt.grow = !!o.grow;
      pt.color.copy(cachedColor(colors[Math.floor(Math.random() * colors.length)]));
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
