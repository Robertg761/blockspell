import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, OctahedronGeometry, ShaderMaterial, type Scene } from 'three';

/**
 * A tall, faint beam of light over the nearest unfinished task (open world), with a small diamond that
 * bobs at its foot. It shows through the fog, so the way to the next thing to do is visible from across the islands.
 */
export class Waypoint {
  private group = new Group();
  private beamMat: ShaderMaterial;
  private gem: Mesh;
  private t = 0;
  private fade = 0;
  private want = false;

  constructor(scene: Scene) {
    this.beamMat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
      uniforms: { uColor: { value: new Color('#8fe3ff') }, uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vH; varying vec3 vN;
        void main() { vH = position.y + 0.5; vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uAlpha; varying float vH; varying vec3 vN;
        void main() {
          float edge = pow(abs(vN.z), 1.2);
          float a = pow(1.0 - vH, 1.3) * (0.25 + 0.75 * edge) * uAlpha;
          gl_FragColor = vec4(uColor * 0.9, a);
        }`,
    });
    const beam = new Mesh(new CylinderGeometry(0.28, 0.28, 18, 14, 1, true), this.beamMat);
    beam.position.y = 9;
    this.gem = new Mesh(new OctahedronGeometry(0.24), new MeshBasicMaterial({ color: '#bff3ff', transparent: true, opacity: 0.9, depthWrite: false, blending: AdditiveBlending, fog: false }));
    this.gem.scale.y = 1.5;
    this.group.add(beam, this.gem);
    this.group.visible = false;
    this.group.renderOrder = 7;
    scene.add(this.group);
  }

  /** Points the beam at a spot (feet height). Null hides it. */
  target(p: { x: number; y: number; z: number } | null): void {
    this.want = !!p;
    if (p) this.group.position.set(p.x, p.y, p.z);
  }

  /** `show` is false while the hero is already close, in photo mode, on the title screen... */
  update(dt: number, show: boolean): void {
    this.t += dt;
    const goal = this.want && show ? 1 : 0;
    this.fade += (goal - this.fade) * Math.min(1, dt * 4);
    this.group.visible = this.fade > 0.01;
    if (!this.group.visible) return;
    this.beamMat.uniforms.uAlpha.value = this.fade * (0.13 + 0.04 * Math.sin(this.t * 2.2));
    this.gem.position.y = 1.5 + Math.sin(this.t * 2) * 0.18;
    this.gem.rotation.y = this.t * 1.4;
    (this.gem.material as MeshBasicMaterial).opacity = 0.9 * this.fade;
  }
}
