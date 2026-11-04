import { BoxGeometry, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, type Scene, type Vector3 } from 'three';
import { random } from '../core/rng';

export type WeatherName = 'clear' | 'rain' | 'snow';
export const WEATHER_NAMES: WeatherName[] = ['clear', 'rain', 'snow'];
export const WEATHER_LABEL: Record<WeatherName, string> = { clear: 'Clear', rain: '🌧 Rain', snow: '❄ Snow' };

const COUNT = 520;
const W = 17; // half-width of the box around the camera target
const TOP = 15;
const dummy = new Object3D();

/**
 * Falling rain or snow in a box that follows the camera target. It is purely visual (it does not put out
 * fires or freeze water: spells do that), and costs one instanced draw call.
 */
export class Weather {
  private mesh: InstancedMesh;
  private mat = new MeshBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: 0.55, depthWrite: false });
  private pos = new Float32Array(COUNT * 3);
  private phase = new Float32Array(COUNT);
  private kind: WeatherName = 'clear';
  private fade = 0;
  private t = 0;

  constructor(scene: Scene) {
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), this.mat, COUNT);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    for (let i = 0; i < COUNT; i++) {
      this.pos[i * 3] = (random() * 2 - 1) * W;
      this.pos[i * 3 + 1] = random() * (TOP + 3) - 3;
      this.pos[i * 3 + 2] = (random() * 2 - 1) * W;
      this.phase[i] = random() * 6.28;
    }
  }

  get current(): WeatherName {
    return this.kind;
  }

  set(kind: WeatherName): void {
    this.kind = kind;
    if (kind === 'rain') {
      this.mat.color.set('#bcd8ff');
      this.mat.opacity = 0.5;
    } else if (kind === 'snow') {
      this.mat.color.set('#ffffff');
      this.mat.opacity = 0.9;
    }
  }

  update(dt: number, center: Vector3): void {
    this.t += dt;
    this.fade += ((this.kind === 'clear' ? 0 : 1) - this.fade) * Math.min(1, dt * 2.5);
    const on = this.fade > 0.02;
    this.mesh.visible = on;
    if (!on) return;
    const rain = this.kind === 'rain';
    const speed = rain ? 17 : 1.7;
    const shown = Math.floor(COUNT * this.fade);
    this.mesh.count = shown;
    for (let i = 0; i < shown; i++) {
      let x = this.pos[i * 3], y = this.pos[i * 3 + 1], z = this.pos[i * 3 + 2];
      y -= speed * (rain ? 1 : 0.7 + 0.5 * Math.sin(this.phase[i])) * dt;
      if (rain) x += 2.2 * dt;
      else {
        x += Math.sin(this.t * 0.9 + this.phase[i]) * 0.5 * dt;
        z += Math.cos(this.t * 0.7 + this.phase[i] * 1.3) * 0.5 * dt;
      }
      if (y < -3) y += TOP + 3;
      if (x > W) x -= 2 * W;
      if (x < -W) x += 2 * W;
      if (z > W) z -= 2 * W;
      if (z < -W) z += 2 * W;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      dummy.position.set(center.x + x, center.y + y, center.z + z);
      if (rain) dummy.scale.set(0.022, 0.55, 0.022);
      else dummy.scale.setScalar(0.07);
      dummy.rotation.z = rain ? 0.12 : 0;
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
