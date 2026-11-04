import {
  ACESFilmicToneMapping, PMREMGenerator, Color, DirectionalLight, Fog, HemisphereLight, PCFShadowMap,
  HalfFloatType, PerspectiveCamera, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { setEnvMap } from './env';
import { createBackdrop } from './backdrop';
import { createSky } from './sky';
import { Clouds } from './clouds';
import { createGradePass, type ScreenFx } from './grade';
import type { CameraShake } from './shake';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface ViewRange {
  fog: [number, number];
  far: number;
  maxDistance: number;
}

const DEFAULT_RANGE: ViewRange = { fog: [45, 150], far: 1200, maxDistance: 60 };
const _right = new Vector3(), _up = new Vector3(), _center = new Vector3();

const SKY = { top: '#4a8fe0', horizon: '#cfe6f7', bottom: '#9cc4dd' };

export class Renderer {
  readonly gl: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly sun: DirectionalLight;
  readonly clouds: Clouds;
  private sky;
  private sunDir = new Vector3(0.55, 0.85, 0.35).normalize();
  /** Null when bloom is disabled (?nobloom) or unsupported; then we render straight to screen. */
  private composer: EffectComposer | null = null;
  private grade: ShaderPass | null = null;
  private baseFov = 50;
  private clock = 0;

  constructor(readonly container: HTMLElement) {
    this.gl = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFShadowMap;
    container.appendChild(this.gl.domElement);
    const pmrem = new PMREMGenerator(this.gl);
    setEnvMap(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();

    this.camera = new PerspectiveCamera(50, 1, 0.1, DEFAULT_RANGE.far);
    this.camera.position.set(9, 8, 14);

    const sunDir = this.sunDir;
    this.sky = createSky(SKY, sunDir);
    this.scene.add(this.sky);
    this.scene.fog = new Fog(new Color(SKY.horizon), DEFAULT_RANGE.fog[0], DEFAULT_RANGE.fog[1]);

    const hemi = new HemisphereLight('#cfe8ff', '#7a6243', 1.1);
    this.scene.add(hemi);

    this.sun = new DirectionalLight('#fff0d8', 2.6);
    this.sun.position.copy(sunDir).multiplyScalar(40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 10; sc.far = 75;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    this.clouds = new Clouds();
    this.scene.add(this.clouds.group, createBackdrop());

    this.controls = new OrbitControls(this.camera, this.gl.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 3;
    this.controls.maxDistance = DEFAULT_RANGE.maxDistance;
    this.controls.target.set(0, 1, 0);

    this.initBloom();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private initBloom(): void {
    if (new URLSearchParams(location.search).has('nobloom')) return;
    try {
      const gl = this.gl;
      const floatOk = gl.capabilities.isWebGL2 && (gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float'));
      if (!floatOk) return;
      const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
      const composer = new EffectComposer(gl, target);
      composer.addPass(new RenderPass(this.scene, this.camera));
      // High threshold: only HDR-bright things (fire, glowing particles, stars, specular glints) bloom.
      const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.32, 0.55, 0.92);
      composer.addPass(bloom);
      composer.addPass(new OutputPass()); // applies renderer tone mapping + sRGB
      this.grade = createGradePass(); // film grade, vignette and impact effects, on display colors
      composer.addPass(this.grade);
      this.composer = composer;
    } catch (e) {
      console.warn('Bloom unavailable, falling back to direct rendering', e);
      this.composer = null;
    }
  }

  /** Fog, far plane and zoom-out limit for a level (null restores the defaults). */
  setRange(view: ViewRange | null): void {
    const v = view ?? DEFAULT_RANGE;
    const fog = this.scene.fog as Fog;
    [fog.near, fog.far] = v.fog;
    this.camera.far = v.far;
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = v.maxDistance;
  }

  /**
   * Keeps the sun's shadow box centered on the camera target, so shadows work
   * anywhere in the open world. The center snaps to whole shadow-map texels
   * (in the light's own frame) so shadow edges don't shimmer while moving.
   */
  private followSun(): void {
    const t = this.controls.target;
    const sc = this.sun.shadow.camera;
    // the shadow box hugs the area around the player: about the camera distance plus a margin, in 2 m steps
    // (a tighter box means sharper shadows for the same map size)
    const ext = Math.min(26, Math.max(12, Math.ceil((this.camera.position.distanceTo(t) * 0.9 + 6) / 2) * 2));
    if (sc.right !== ext) {
      sc.left = sc.bottom = -ext;
      sc.right = sc.top = ext;
      sc.updateProjectionMatrix();
    }
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.x;
    const d = this.sunDir;
    const right = _right.set(d.z, 0, -d.x).normalize(); // up × d
    const up = _up.crossVectors(d, right).normalize();
    const r = Math.round(t.dot(right) / texel) * texel;
    const u = Math.round(t.dot(up) / texel) * texel;
    const f = t.dot(d);
    const c = _center.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(d, f);
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(d, 40);
    this.sun.target.updateMatrixWorld();
  }

  setView(position: [number, number, number], target: [number, number, number]): void {
    this.camera.position.set(...position);
    this.controls.target.set(...target);
    this.controls.update();
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.gl.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(this.gl.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt: number, shake: CameraShake, screen?: ScreenFx): void {
    this.controls.update();
    this.clock += dt;
    const fov = this.baseFov + (screen?.fov ?? 0);
    if (Math.abs(this.camera.fov - fov) > 0.005) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.grade) {
      const u = this.grade.uniforms;
      u.uAberr.value = screen?.aberration ?? 0;
      u.uFlashAmt.value = screen?.flashAmt ?? 0;
      if (screen) (u.uFlash.value as Vector3).copy(screen.flashColor);
      u.uTime.value = this.clock % 10;
    }
    this.clouds.update(dt);
    this.followSun();
    shake.apply(this.camera);
    this.sky.position.copy(this.camera.position);
    if (this.composer) this.composer.render(dt);
    else this.gl.render(this.scene, this.camera);
    shake.restore(this.camera);
  }
}
