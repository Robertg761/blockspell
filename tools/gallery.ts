/**
 * Dev-only object gallery (not part of the build). Serve with `npx vite` and open
 *   /tools/gallery.html?file=animals            objects from defs files whose path contains "animals"
 *   /tools/gallery.html?ids=dog,cat&adj=giant,flaming
 *   &view=front|side|top|back   (default: 3/4 front view)   &cols=6
 * Headless screenshot:
 *   google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
 *     --window-size=1600,1000 --virtual-time-budget=4000 --screenshot=/tmp/g.png "http://localhost:5173/tools/gallery.html?file=animals"
 */
import { ACESFilmicToneMapping, Box3, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { adjectives, buildModifiers } from '../src/adjectives';
import { emptyModifiers } from '../src/adjectives/types';
import { createEntity } from '../src/core/spawn';
import type { ObjectDef } from '../src/objects/types';

const q = new URLSearchParams(location.search);
const modules = import.meta.glob<{ default: ObjectDef | ObjectDef[] }>('../src/objects/defs/*.ts', { eager: true });
const file = q.get('file');
const ids = q.get('ids')?.split(',');
let defs: ObjectDef[] = [];
for (const [path, m] of Object.entries(modules).sort((a, b) => a[0].localeCompare(b[0]))) {
  if (file && !path.includes(file)) continue;
  defs.push(...(Array.isArray(m.default) ? m.default : [m.default]));
}
if (ids) defs = defs.filter((d) => ids.includes(d.id));
const adjs = (q.get('adj')?.split(',') ?? []).map((a) => adjectives.get(a)).filter((a) => !!a);

const W = innerWidth, H = innerHeight;
const cols = Number(q.get('cols')) || Math.ceil(Math.sqrt(defs.length * (W / H)));
const rows = Math.max(1, Math.ceil(defs.length / cols));
const cw = W / cols, ch = H / rows;

const gl = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
gl.setSize(W, H);
gl.outputColorSpace = SRGBColorSpace;
gl.toneMapping = ACESFilmicToneMapping;
gl.setScissorTest(true);
gl.setClearColor('#cfe6f7');
document.body.appendChild(gl.domElement);

const view = q.get('view') ?? '34';
const dir = { front: new Vector3(0, 0.15, 1), back: new Vector3(0, 0.15, -1), side: new Vector3(1, 0.15, 0), top: new Vector3(0.01, 1, 0.05), '34': new Vector3(0.8, 0.55, 1) }[view] ?? new Vector3(0.8, 0.55, 1);
dir.normalize();

defs.forEach((def, i) => {
  const scene = new Scene();
  scene.add(new HemisphereLight('#cfe8ff', '#7a6243', 1.2));
  const sun = new DirectionalLight('#fff0d8', 2.4);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const e = createEntity(def, adjs.length ? buildModifiers(adjs, def) : emptyModifiers(), def.name, 1234 + i);
  for (const [, g] of e.parts) g.rotation.y += 0.3;
  scene.add(e.root);
  const box = new Box3().setFromObject(e.root);
  const c = box.getCenter(new Vector3());
  const r = box.getSize(new Vector3()).length() / 2;
  const cam = new PerspectiveCamera(35, cw / ch, 0.01, 100);
  cam.position.copy(c).addScaledVector(dir, (r / Math.sin((35 * Math.PI) / 360)) * 1.05);
  cam.lookAt(c);
  const col = i % cols, row = Math.floor(i / cols);
  const x = col * cw, y = H - (row + 1) * ch;
  gl.setViewport(x, y, cw, ch);
  gl.setScissor(x, y, cw, ch);
  gl.setClearColor(i % 2 === row % 2 ? '#cfe6f7' : '#bcd9ee');
  gl.render(scene, cam);
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `${def.id}  [${[...e.tags].join(',')}]`;
  Object.assign(label.style, { left: `${col * cw}px`, top: `${row * ch + 4}px`, width: `${cw}px` });
  document.body.appendChild(label);
});
