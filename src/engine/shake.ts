import type { Camera } from 'three';
import { Vector3 } from 'three';

/** Trauma-based camera shake: offsets the camera only while rendering. */
export class CameraShake {
  private trauma = 0;
  private t = 0;
  private saved = new Vector3();
  /** Off in the settings: add() does nothing. */
  enabled = true;

  add(amount: number): void {
    if (!this.enabled) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  /** Apply offset before render; call `restore` after. */
  apply(camera: Camera): void {
    this.saved.copy(camera.position);
    if (this.trauma <= 0) return;
    const s = this.trauma * this.trauma * 0.35;
    const t = this.t * 40;
    camera.position.x += s * (Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5);
    camera.position.y += s * (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.1) * 0.5);
    camera.position.z += s * (Math.sin(t * 1.3 + 2) + Math.sin(t * 2.9) * 0.5);
  }

  restore(camera: Camera): void {
    camera.position.copy(this.saved);
  }
}
