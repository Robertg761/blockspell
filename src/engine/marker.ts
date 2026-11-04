import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';

/** Pulsing ring on the ground: where the next spell lands, or what the hero would grab. */
export class SpawnMarker {
  readonly group = new Group();
  readonly position = new Vector3();
  private ring: Mesh;
  private inner: Mesh;
  private t = 0;

  constructor(color = '#ffd84a') {
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending, fog: false });
    this.ring = new Mesh(new RingGeometry(0.42, 0.55, 4, 1), mat);
    this.ring.rotation.x = -Math.PI / 2;
    this.inner = new Mesh(new RingGeometry(0.12, 0.2, 4, 1), mat.clone());
    this.inner.rotation.x = -Math.PI / 2;
    this.group.add(this.ring, this.inner);
    this.group.renderOrder = 10;
  }

  set(p: Vector3): void {
    this.position.copy(p);
    this.group.position.set(p.x, p.y + 0.03, p.z);
    this.t = 0;
  }

  /** Moves the ring without replaying its pop. `size` scales it (1 = about a meter across). */
  follow(x: number, y: number, z: number, size = 1): void {
    this.position.set(x, y, z);
    this.group.position.set(x, y + 0.03, z);
    this.group.scale.setScalar(size);
  }

  update(dt: number): void {
    this.t += dt;
    const pop = Math.min(1, this.t * 5);
    const s = (0.6 + 0.4 * pop) * (1 + Math.sin(this.t * 4) * 0.06);
    this.ring.scale.setScalar(s);
    this.ring.rotation.z += dt * 0.8;
    this.inner.rotation.z -= dt * 1.6;
  }
}
