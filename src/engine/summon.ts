import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Group, Mesh, RingGeometry, ShaderMaterial, type Scene } from 'three';
import { ease, type Tweens } from './tween';

const SLOTS = 6;

/**
 * The summoning column: a beam of light drops onto the cast point while a rune ring spreads over
 * the ground, so a spell lands with weight (and the player can see where it went).
 */
export class Summons {
  private slots: { group: Group; beam: Mesh; ring: Mesh; busy: boolean }[] = [];
  private next = 0;
  private beamGeo = new CylinderGeometry(1, 1, 1, 20, 1, true);
  private ringGeo = new RingGeometry(0.82, 1, 4, 1);

  constructor(scene: Scene, private tweens: Tweens) {
    for (let i = 0; i < SLOTS; i++) {
      const beam = new Mesh(this.beamGeo, new ShaderMaterial({
        transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
        uniforms: { uColor: { value: new Color('#ffd84a') }, uAlpha: { value: 0 } },
        vertexShader: /* glsl */ `
          varying float vH; varying vec3 vN;
          void main() { vH = position.y + 0.5; vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uAlpha; varying float vH; varying vec3 vN;
          void main() {
            float edge = pow(abs(vN.z), 1.4);
            float a = pow(1.0 - vH, 1.6) * (0.35 + 0.65 * edge) * uAlpha;
            gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.3 * (1.0 - vH)) * 1.2, a);
          }`,
      }));
      const ring = new Mesh(this.ringGeo, new ShaderMaterial({
        transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
        uniforms: { uColor: { value: new Color('#ffd84a') }, uAlpha: { value: 0 } },
        vertexShader: /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uAlpha; void main() { gl_FragColor = vec4(uColor * 2.0, uAlpha); }`,
      }));
      ring.rotation.x = -Math.PI / 2;
      beam.position.y = 0;
      const group = new Group();
      group.add(beam, ring);
      group.visible = false;
      group.renderOrder = 8;
      scene.add(group);
      this.slots.push({ group, beam, ring, busy: false });
    }
  }

  /** Plays one column at the point, `size` about a meter across for an average object. */
  play(x: number, groundY: number, z: number, color: string, size: number): void {
    const s = this.slots[this.next++ % SLOTS];
    if (s.busy) return;
    s.busy = true;
    const w = Math.max(0.3, Math.min(0.75, size * 0.3));
    const height = 12;
    for (const m of [s.beam, s.ring]) {
      const u = (m.material as ShaderMaterial).uniforms;
      (u.uColor.value as Color).set(color);
    }
    s.group.position.set(x, groundY + 0.04, z);
    s.group.visible = true;
    s.beam.position.y = height / 2;
    this.tweens.add({
      duration: 0.7,
      update: (t) => {
        // the beam snaps wide, then narrows to a thread as it fades; the ring keeps spreading
        const open = ease.outBack(Math.min(1, t * 6), 2) * (1 - ease.outCubic(Math.max(0, (t - 0.12) / 0.88)) * 0.85);
        s.beam.scale.set(w * open, height, w * open);
        (s.beam.material as ShaderMaterial).uniforms.uAlpha.value = (1 - t) * (1 - t) * 0.5;
        const r = w * (0.6 + ease.outCubic(t) * 2.4);
        s.ring.scale.setScalar(r);
        s.ring.rotation.z = t * 1.8;
        (s.ring.material as ShaderMaterial).uniforms.uAlpha.value = (1 - t) * (1 - t) * 0.85;
      },
      done: () => {
        s.group.visible = false;
        s.busy = false;
      },
    });
  }

  /** Hides every column and frees its slot (a level change drops the tweens that would have). */
  clear(): void {
    for (const s of this.slots) {
      s.group.visible = false;
      s.busy = false;
    }
  }
}
