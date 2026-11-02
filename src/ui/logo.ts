import {
  AmbientLight, BoxGeometry, DirectionalLight, Group, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  OrthographicCamera, PointLight, Scene, SRGBColorSpace, WebGLRenderer, type BufferGeometry,
} from 'three';
import { VoxelBuilder } from '../voxel/builder';
import { meshVoxels } from '../voxel/mesher';
import './title.css';

/** 5x5 bitmap glyphs for the letters in BLOCK / SPELL. */
const GLYPHS: Record<string, string[]> = {
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  C: ['.####', '#....', '#....', '#....', '.####'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  E: ['#####', '#....', '###..', '#....', '#####'],
};
const LINES = ['BLOCK', 'SPELL'];
const COLORS = ['#ff9f2e', '#ff6b6b', '#ffd23f', '#4ecb71', '#4aa8ff', '#9b7bff', '#ff7ac8', '#2ec4b6', '#ff8a3d', '#ffc43a'];
const DEPTH = 3;
const STEP = 6; // letter pitch in voxels

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function buildLetter(ch: string, color: string) {
  const b = new VoxelBuilder();
  const rows = GLYPHS[ch];
  rows.forEach((row, r) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      const c = shade(color, 1.12 - r * 0.07); // subtle vertical gradient
      for (let z = 0; z < DEPTH; z++) b.set(x, 4 - r, z, z === DEPTH - 1 ? shade(color, 1.08 * (1.12 - r * 0.07) / 1.12) : c);
    }
  });
  return meshVoxels(b.build(), { voxelSize: 1, jitter: 0.03 }).geometry;
}

const easeOutBack = (t: number) => { const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/** Animated voxel "BLOCKSPELL" logo in its own transparent WebGL canvas. Disposes itself once detached. */
export function createVoxelLogo(): { el: HTMLElement; dispose(): void } {
  const el = document.createElement('div');
  el.className = 'voxel-logo';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Blockspell');
  const fallback = document.createElement('div');
  fallback.className = 'logo-fallback';
  fallback.textContent = '▣ BLOCKSPELL';
  el.append(fallback);

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    el.classList.add('nogl');
    return { el, dispose() {} };
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  el.prepend(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 200);
  camera.position.set(0, 3, 60);
  camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight('#ffffff', 1.1));
  const sun = new DirectionalLight('#fff3dc', 2.4);
  sun.position.set(-12, 22, 30);
  scene.add(sun);
  const shine = new PointLight('#ffffff', 0, 40, 1.2);
  shine.position.set(-20, 4, 14);
  scene.add(shine);

  const geoms: BufferGeometry[] = [];
  const mats: Material[] = [];
  const litMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const glowMat = new MeshBasicMaterial({ vertexColors: true });
  mats.push(litMat, glowMat);

  const letters: { g: Group; x: number; y: number; delay: number; phase: number }[] = [];
  let idx = 0;
  LINES.forEach((line, li) => {
    [...line].forEach((ch, ci) => {
      const geo = buildLetter(ch, COLORS[idx % COLORS.length]);
      geoms.push(geo);
      const mesh = new Mesh(geo, [litMat, glowMat]);
      const g = new Group();
      g.add(mesh);
      const x = (ci - 2) * STEP;
      const y = li === 0 ? 3.2 : -3.2;
      g.position.set(x, y, 0);
      scene.add(g);
      letters.push({ g, x, y, delay: 0.25 + idx * 0.11, phase: idx * 0.7 });
      idx++;
    });
  });

  // sparkles: two crossed slivers each, pulsing at random spots on the letters
  const sparkGeo = new BoxGeometry(1, 0.22, 0.22);
  const sparkMat = new MeshBasicMaterial({ color: '#fff6c8' });
  geoms.push(sparkGeo);
  mats.push(sparkMat);
  const sparks = Array.from({ length: 7 }, (_, i) => {
    const g = new Group();
    g.add(new Mesh(sparkGeo, sparkMat));
    const cross = new Mesh(sparkGeo, sparkMat);
    cross.rotation.z = Math.PI / 2;
    g.add(cross);
    scene.add(g);
    return { g, t0: i * 0.45, period: 2.4 + (i % 3) * 0.4, seed: i };
  });

  const resize = () => {
    const w = el.clientWidth || 400, hgt = el.clientHeight || 170;
    renderer.setSize(w, hgt, false);
    const aspect = w / hgt;
    const halfH = Math.max(7.6, 17.2 / aspect);
    camera.left = -halfH * aspect; camera.right = halfH * aspect; camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    if (reduced && !disposed) draw(10);
  };

  const pose = (t: number) => {
    for (const l of letters) {
      const p = reduced ? 1 : Math.min(1, Math.max(0, (t - l.delay) / 0.55));
      const s = p <= 0 ? 0.0001 : easeOutBack(p);
      const live = reduced ? 0 : 1;
      l.g.scale.setScalar(Math.max(0.0001, s));
      l.g.position.y = l.y + Math.sin(t * 2 + l.phase) * 0.35 * live * Math.min(1, p) + (1 - Math.min(1, p)) * 4;
      l.g.rotation.y = Math.sin(t * 1.1 + l.phase) * 0.22 * live;
      l.g.rotation.x = Math.sin(t * 0.9 + l.phase * 1.3) * 0.06 * live;
      l.g.rotation.z = (1 - Math.min(1, p)) * 0.5;
    }
    if (reduced) {
      shine.intensity = 0;
      sparks.forEach((s) => (s.g.visible = false));
      return;
    }
    // shine sweeps across periodically
    const cyc = (t - 1.8) % 5;
    const sweep = cyc > 0 && cyc < 1.4 ? cyc / 1.4 : -1;
    shine.position.x = -20 + sweep * 40;
    shine.intensity = sweep >= 0 ? 260 * Math.sin(sweep * Math.PI) : 0;
    for (const s of sparks) {
      const u = (t - s.t0 - 1.5) / s.period;
      if (u < 0) { s.g.visible = false; continue; }
      const k = u % 1, n = Math.floor(u) + s.seed * 7;
      const r1 = Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1, r2 = Math.abs(Math.sin(n * 78.233) * 12345.678) % 1;
      const life = k < 0.3 ? Math.sin((k / 0.3) * Math.PI) : 0;
      s.g.visible = life > 0.01;
      s.g.position.set((r1 - 0.5) * 28, (r2 - 0.5) * 10.5, DEPTH + 1.5);
      s.g.scale.setScalar(life * 2.2);
      s.g.rotation.z = k * 2;
    }
  };

  const draw = (t: number) => {
    pose(t);
    renderer.render(scene, camera);
  };

  let disposed = false;
  let raf = 0;
  let wasConnected = false;
  const born = performance.now();
  const loop = () => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    if (!el.isConnected) {
      if (wasConnected || performance.now() - born > 5000) dispose(); // title closed / replaced
      return;
    }
    wasConnected = true;
    if (el.offsetParent === null) return; // hidden: keep alive but don't draw
    if (!reduced) draw((performance.now() - born) / 1000);
  };

  const ro = new ResizeObserver(() => { if (!disposed) resize(); });
  ro.observe(el);
  resize();
  if (reduced) draw(10);
  raf = requestAnimationFrame(loop);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    geoms.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  return { el, dispose };
}
