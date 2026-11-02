import {
  AddEquation, BufferGeometry, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, CanvasTexture, DynamicDrawUsage,
  InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, Mesh, PlaneGeometry, Scene, ShaderMaterial,
} from 'three';

type P3 = { x: number; y: number; z: number };

const CAP = 2200;
const HALO_CAP = 96;

/** Procedural 2-tile atlas: soft round blob (tile 0) and a flame tongue (tile 1). */
function makeAtlas(): CanvasTexture {
  const S = 96;
  const c = document.createElement('canvas');
  c.width = S * 2;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(S * 2, S);
  const sm = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S - 0.5;
      const v = 1 - (y + 0.5) / S; // 1 = top
      // blob
      const r = Math.hypot(u, v - 0.5) * 2;
      const blob = Math.pow(Math.max(0, 1 - r), 1.6);
      // flame tongue: wide at the bottom, curling to a tip
      const sway = Math.sin(v * 5) * 0.04 * v;
      const hw = 0.5 * Math.pow(Math.max(0, 1 - v), 0.75) * Math.sqrt(Math.min(1, (v + 0.02) / 0.22));
      const d = hw > 0 ? Math.abs(u - sway) / hw : 1;
      const tongue = Math.pow(Math.max(0, 1 - d), 1.2) * sm(0, 0.08, v);
      for (let t = 0; t < 2; t++) {
        const a = t === 0 ? blob : tongue;
        const i = (y * S * 2 + x + t * S) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(255 * Math.min(1, a));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

const VERT = /* glsl */ `
attribute vec3 offset;
attribute vec4 tint;
attribute vec2 sk;
varying vec2 vUv;
varying vec4 vTint;
varying float vK;
void main() {
  vK = sk.y;
  vUv = vec2((uv.x + sk.y) * 0.5, uv.y);
  vTint = tint;
  vec4 mv = viewMatrix * vec4(offset, 1.0);
  mv.xy += position.xy * sk.x;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vTint;
varying float vK;
void main() {
  float a = texture2D(map, vUv).a * vTint.a;
  // premultiplied: flames (vK=1) composite over the scene, blobs (vK=0) add light
  gl_FragColor = vec4(vTint.rgb * a, a * vK);
}`;

// flame colour ramp by normalised age: white-yellow -> orange -> deep red
const RAMP: [number, number, number][] = [[1, 0.8, 0.2], [1, 0.5, 0.06], [0.92, 0.24, 0.03], [0.55, 0.1, 0.03]];
function ramp(t: number, out: number[]): void {
  const f = Math.min(0.999, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = RAMP[i], b = RAMP[i + 1];
  out[0] = a[0] + (b[0] - a[0]) * k;
  out[1] = a[1] + (b[1] - a[1]) * k;
  out[2] = a[2] + (b[2] - a[2]) * k;
}

/**
 * Pooled additive billboard sprites for fire: flame tongues, rising embers and
 * per-object glow halos. One draw call, structure-of-arrays sim, no per-frame
 * allocations, no lights.
 */
export class FlameFx {
  private n = 0;
  private pos = new Float32Array(CAP * 3);
  private vel = new Float32Array(CAP * 3);
  private life = new Float32Array(CAP);
  private max = new Float32Array(CAP);
  private size = new Float32Array(CAP);
  private kind = new Float32Array(CAP); // 0 flame, 1 ember
  private seed = new Float32Array(CAP);
  private halos = new Float32Array(HALO_CAP * 4); // x y z size
  private nHalo = 0;
  private t = 0;
  private col = [0, 0, 0];

  private offA: InstancedBufferAttribute;
  private tintA: InstancedBufferAttribute;
  private skA: InstancedBufferAttribute;
  private mesh: Mesh;

  constructor(scene: Scene) {
    const base = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    const total = CAP + HALO_CAP;
    this.offA = new InstancedBufferAttribute(new Float32Array(total * 3), 3).setUsage(DynamicDrawUsage);
    this.tintA = new InstancedBufferAttribute(new Float32Array(total * 4), 4).setUsage(DynamicDrawUsage);
    this.skA = new InstancedBufferAttribute(new Float32Array(total * 2), 2).setUsage(DynamicDrawUsage);
    geo.setAttribute('offset', this.offA);
    geo.setAttribute('tint', this.tintA);
    geo.setAttribute('sk', this.skA);
    geo.instanceCount = 0;
    const mat = new ShaderMaterial({
      uniforms: { map: { value: makeAtlas() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendEquation: AddEquation,
    });
    this.mesh = new Mesh(geo as unknown as BufferGeometry, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    scene.add(this.mesh);
  }

  /** Emits flames + embers for one burning object this frame. `w` = footprint width, `h` = height. */
  emit(at: P3, w: number, h: number, dt: number, strength: number, acc: { f: number; e: number }): void {
    const fs = Math.min(2.4, 0.4 + 0.8 * w) * Math.sqrt(strength + 0.3);
    acc.f += dt * Math.min(70, 22 + 26 * w) * Math.min(1.3, 0.5 + strength);
    acc.e += dt * Math.min(16, 4 + 5 * w) * Math.min(1.3, 0.4 + strength);
    const rise = 0.9 + h * 0.6 + fs * 1.2;
    const hx = w * 0.4;
    while (acc.f >= 1 && this.n < CAP) {
      acc.f -= 1;
      const i = this.n++;
      const life = 0.45 + Math.random() * 0.4;
      this.life[i] = this.max[i] = life;
      this.pos[i * 3] = at.x + (Math.random() * 2 - 1) * hx;
      this.pos[i * 3 + 1] = at.y + h * (0.1 + Math.random() * 0.35);
      this.pos[i * 3 + 2] = at.z + (Math.random() * 2 - 1) * hx;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.3;
      this.vel[i * 3 + 1] = (rise / life) * (0.55 + Math.random() * 0.4);
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      this.size[i] = fs * (0.8 + Math.random() * 0.6);
      this.kind[i] = 0;
      this.seed[i] = Math.random() * 6.28;
    }
    acc.f = Math.min(acc.f, 1.5);
    while (acc.e >= 1 && this.n < CAP) {
      acc.e -= 1;
      const i = this.n++;
      const life = 1.1 + Math.random() * 1.2;
      this.life[i] = this.max[i] = life;
      this.pos[i * 3] = at.x + (Math.random() * 2 - 1) * hx;
      this.pos[i * 3 + 1] = at.y + h * (0.3 + Math.random() * 0.4);
      this.pos[i * 3 + 2] = at.z + (Math.random() * 2 - 1) * hx;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.8;
      this.vel[i * 3 + 1] = 1.2 + Math.random() * 1.6;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      this.size[i] = 0.07 + Math.random() * 0.05 + w * 0.02;
      this.kind[i] = 1;
      this.seed[i] = Math.random() * 6.28;
    }
    acc.e = Math.min(acc.e, 1.5);
    // glow halo (re-requested every frame while burning)
    if (this.nHalo < HALO_CAP) {
      const k = this.nHalo++ * 4;
      this.halos[k] = at.x;
      this.halos[k + 1] = at.y + h * 0.35;
      this.halos[k + 2] = at.z;
      this.halos[k + 3] = Math.min(6, 1.6 + w * 1.9 + h * 0.6);
    }
  }

  update(dt: number): void {
    this.t += dt;
    const { pos, vel, life, max, size, kind, seed, col } = this;
    for (let i = this.n - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) {
        const j = --this.n;
        if (j !== i) {
          for (let c = 0; c < 3; c++) { pos[i * 3 + c] = pos[j * 3 + c]; vel[i * 3 + c] = vel[j * 3 + c]; }
          life[i] = life[j]; max[i] = max[j]; size[i] = size[j]; kind[i] = kind[j]; seed[i] = seed[j];
        }
        continue;
      }
      const wob = kind[i] === 0 ? 0.6 : 1.4;
      pos[i * 3] += (vel[i * 3] + Math.sin(this.t * 9 + seed[i]) * wob * 0.35) * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(this.t * 8 + seed[i]) * wob * 0.35) * dt;
      if (kind[i] === 0) vel[i * 3 + 1] *= Math.max(0, 1 - 1.2 * dt);
    }
    const off = this.offA.array as Float32Array, tint = this.tintA.array as Float32Array, sk = this.skA.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      const age = 1 - life[i] / max[i];
      off[i * 3] = pos[i * 3]; off[i * 3 + 1] = pos[i * 3 + 1]; off[i * 3 + 2] = pos[i * 3 + 2];
      if (kind[i] === 0) {
        ramp(age, col);
        const a = Math.min(1, age * 8) * Math.min(1, (1 - age * age) * 1.4);
        tint[i * 4] = col[0]; tint[i * 4 + 1] = col[1]; tint[i * 4 + 2] = col[2]; tint[i * 4 + 3] = a;
        sk[i * 2] = size[i] * (1 - age * 0.75);
        sk[i * 2 + 1] = 1;
      } else {
        const tw = 0.6 + 0.4 * Math.sin(this.t * 25 + seed[i] * 9);
        tint[i * 4] = 1; tint[i * 4 + 1] = 0.55 + 0.25 * (1 - age); tint[i * 4 + 2] = 0.15;
        tint[i * 4 + 3] = Math.min(1, (1 - age) * 2.5) * tw;
        sk[i * 2] = size[i] * (1 - age * 0.5);
        sk[i * 2 + 1] = 0;
      }
    }
    let n = this.n;
    for (let h = 0; h < this.nHalo; h++, n++) {
      const k = h * 4;
      const fl = 0.78 + 0.22 * Math.sin(this.t * 17 + h * 3.1) * Math.sin(this.t * 9.3 + h);
      off[n * 3] = this.halos[k]; off[n * 3 + 1] = this.halos[k + 1]; off[n * 3 + 2] = this.halos[k + 2];
      tint[n * 4] = 1; tint[n * 4 + 1] = 0.4; tint[n * 4 + 2] = 0.08; tint[n * 4 + 3] = 0.2 * fl;
      sk[n * 2] = this.halos[k + 3] * (0.92 + 0.08 * fl);
      sk[n * 2 + 1] = 0;
    }
    this.nHalo = 0;
    (this.mesh.geometry as InstancedBufferGeometry).instanceCount = n;
    this.offA.needsUpdate = this.tintA.needsUpdate = this.skA.needsUpdate = true;
  }

  clear(): void {
    this.n = 0;
    this.nHalo = 0;
  }
}
