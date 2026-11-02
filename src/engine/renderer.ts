import {
  ACESFilmicToneMapping, PMREMGenerator, Color, DirectionalLight, Fog, HemisphereLight, PCFShadowMap,
  PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { setEnvMap } from './env';
import { createSky } from './sky';
import { Clouds } from './clouds';
import type { CameraShake } from './shake';

const SKY = { top: '#4a8fe0', horizon: '#cfe6f7', bottom: '#9cc4dd' };

export class Renderer {
  readonly gl: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly sun: DirectionalLight;
  readonly clouds: Clouds;
  private sky;

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

    this.camera = new PerspectiveCamera(50, 1, 0.1, 1200);
    this.camera.position.set(9, 8, 14);

    const sunDir = new Vector3(0.55, 0.85, 0.35).normalize();
    this.sky = createSky(SKY, sunDir);
    this.scene.add(this.sky);
    this.scene.fog = new Fog(new Color(SKY.horizon), 45, 150);

    const hemi = new HemisphereLight('#cfe8ff', '#7a6243', 1.1);
    this.scene.add(hemi);

    this.sun = new DirectionalLight('#fff0d8', 2.6);
    this.sun.position.copy(sunDir).multiplyScalar(40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 100;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    this.clouds = new Clouds();
    this.scene.add(this.clouds.group);

    this.controls = new OrbitControls(this.camera, this.gl.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 60;
    this.controls.target.set(0, 1, 0);

    window.addEventListener('resize', () => this.resize());
    this.resize();
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
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt: number, shake: CameraShake): void {
    this.controls.update();
    this.clouds.update(dt);
    shake.apply(this.camera);
    this.sky.position.copy(this.camera.position);
    this.gl.render(this.scene, this.camera);
    shake.restore(this.camera);
  }
}
