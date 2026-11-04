import { BufferAttribute, BufferGeometry, Box3, Sphere, Vector3, type Mesh } from 'three';
import type { VoxelModel } from './model';
import { meshVoxels } from './mesher';
import { classify, FACTOR, FIXED_COLORS, meshHD, ROOF, SUB, type Cls, type HDArrays, type HDJob, type HDStyle } from './hd-core';
import { resolveColor } from './palette';

export { ROOF, type Cls, type HDStyle };

/**
 * HD voxels: a render-only refinement of the coarse voxel models (see hd-core.ts for the look).
 * Physics never sees it: colliders and sizes still come from the coarse model, so gameplay is
 * the same in both modes.
 *
 * - On by default, except on software rendering (SwiftShader, llvmpipe...) or a weak GPU, which
 *   keep the coarse look. `?hd=1` / `?hd=0` force it; the menu toggle (setHDEnabled) is saved.
 * - Every voxel mesh (terrain, scenery, statics, objects, the hero) is bound with bindVoxelMesh.
 *   HD geometry is meshed in Web Workers, keyed by the model's content and cached: every spawn of
 *   the same model shares one geometry. Until it is ready the mesh shows the (cached) coarse one.
 * - Scenery swaps to the coarse mesh when far from the camera and hides past the fog (updateVoxelLOD).
 * - Vertices are packed (Int16 positions, Int8 normals, Uint8 colors); the mesh's scale carries the
 *   unit, so code that squashes a voxel mesh must use setMeshScale.
 */
export const hd = { enabled: false, source: 'auto' as 'url' | 'saved' | 'auto', reason: '', gpu: '' };

/** What detectGPU found (also read by the voxel animations to pick their quality). */
export const gpuTier = { software: false, weak: false };

const STORAGE_KEY = 'blockspell.hd';

/** WebGL renderer string and whether it looks like software rendering or a weak GPU. */
function detectGPU(): { gpu: string; software: boolean; weak: boolean } {
  let gpu = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* no WebGL here: the renderer will complain on its own */
  }
  const software = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i.test(gpu);
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
  const weakGpu = /Mali|Adreno|PowerVR|Videocore|GMA|Intel\(R\) HD Graphics( [2-5]\d{2,3})?\b|Intel HD Graphics/i.test(gpu);
  const weak = mobile || weakGpu || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || (nav.hardwareConcurrency ?? 4) <= 2;
  return { gpu, software, weak };
}

function readSetting(): void {
  let q: string | null = null, saved: string | null = null;
  try {
    q = new URLSearchParams(location.search).get('hd');
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* no storage */
  }
  const g = detectGPU();
  hd.gpu = g.gpu;
  gpuTier.software = g.software;
  gpuTier.weak = g.weak;
  if (q !== null) {
    hd.enabled = q !== '0' && q !== 'off';
    hd.source = 'url';
    hd.reason = `?hd=${q}`;
  } else if (saved === '1' || saved === '0') {
    hd.enabled = saved === '1';
    hd.source = 'saved';
    hd.reason = 'saved setting';
  } else {
    hd.enabled = !g.software && !g.weak;
    hd.source = 'auto';
    hd.reason = g.software ? 'software rendering detected' : g.weak ? 'weak GPU detected' : 'GPU looks capable';
  }
}
readSetting();

/** Grid variants per seeded object (trees, rocks...): spawns pick one, so HD meshes can be shared and prebuilt. */
export const MODEL_VARIANTS = 4;

// ------------------------------------------------------------------ bindings

export interface VoxelSpec {
  model: VoxelModel;
  voxelSize: number;
  /** See MeshOptions.origin (default 'center'). */
  origin?: 'center' | 'model';
  style: HDStyle;
  /** Keys used to pick materials (the model's keys before tinting); default model.keys. */
  classKeys?: string[];
  overrides?: Record<string, Cls>;
  /** Brightness jitter of the coarse mesh. */
  jitter?: number;
  /** Coarse mesh: see MeshOptions. */
  ao?: number;
  openBottom?: boolean;
  openTop?: boolean;
  /** Static scenery: coarse when far from the camera, hidden past the fog. */
  lod?: boolean;
  /** For stats: what this is (object id, 'terrain'...). */
  label?: string;
}

interface HDEntry {
  key: string;
  job: HDJob;
  geo: BufferGeometry | null;
  state: 'queued' | 'building' | 'ready' | 'failed';
  refs: number;
  /** Built ahead of time; kept (evictable) even with no user. */
  prewarm: boolean;
  /** 0 = shown right now (objects), 1 = scenery (nearest first), 2 = prewarm. */
  prio: number;
  waiting: Set<Binding>;
  bytes: number;
  lastUse: number;
  /** A mesh to measure the distance to (scenery priority). */
  anchor: Mesh | null;
  label: string;
  tris: number;
}

interface CoarseEntry {
  geo: BufferGeometry;
  refs: number;
  lastUse: number;
}

interface Binding {
  mesh: Mesh;
  spec: VoxelSpec;
  key: string;
  hd: HDEntry | null;
  coarse: CoarseEntry | null;
  coarseKey: string;
  far: boolean;
  sphere: Sphere | null;
}

const bindings = new Map<Mesh, Binding>();
const hdCache = new Map<string, HDEntry>();
const coarseCache = new Map<string, CoarseEntry>();
let useClock = 0;

/** Running totals (read by __blockspell.hd()). */
export const hdTotals = { meshes: 0, triangles: 0, bytes: 0, workerMs: 0, mainMs: 0, coarseMeshes: 0, coarseMs: 0, evicted: 0 };

/** Content key of a model (two 32-bit FNV-1a hashes over the grid, dims, origin and keys) plus its meshing options. */
function contentKey(spec: VoxelSpec): string {
  const m = spec.model;
  let a = 0x811c9dc5, b = 0x2545f491;
  const g = m.grid;
  for (let i = 0; i < g.length; i++) {
    a = Math.imul(a ^ g[i], 16777619);
    b = Math.imul(b ^ g[i], 2246822519);
  }
  const meta = [m.sx, m.sy, m.sz, ...m.min, spec.style, spec.origin ?? 'center', m.keys.join(','), (spec.classKeys ?? m.keys).join(','), spec.overrides ? JSON.stringify(spec.overrides) : ''].join('|');
  for (let i = 0; i < meta.length; i++) {
    a = Math.imul(a ^ meta.charCodeAt(i), 16777619);
    b = Math.imul(b ^ meta.charCodeAt(i), 2246822519);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36) + ':' + m.count;
}

function makeJob(spec: VoxelSpec): HDJob {
  const m = spec.model;
  // colors and materials are resolved here: palettes registered at runtime don't exist in a worker
  const colors = m.keys.map((k) => {
    const rc = resolveColor(k.startsWith(ROOF) ? k.slice(ROOF.length) : k);
    return [rc.color.r, rc.color.g, rc.color.b, rc.emissive ? 1 : 0];
  });
  const classes = (spec.classKeys ?? m.keys).map((k) => classify(k, spec.overrides));
  return { sx: m.sx, sy: m.sy, sz: m.sz, min: m.min, grid: m.grid, colors, classes, style: spec.style, origin: spec.origin ?? 'center', fixed: FIXED_COLORS() };
}

/** World units per position unit of an HD geometry. */
function unitOf(spec: VoxelSpec): number {
  return spec.voxelSize / (FACTOR * SUB);
}

function setGeometry(b: Binding, geo: BufferGeometry, unit: number): void {
  const m = b.mesh;
  if (m.userData.voxelGeo !== geo) {
    m.geometry = geo;
    m.userData.voxelGeo = geo;
  }
  if (m.userData.unit !== unit) {
    m.userData.unit = unit;
    m.scale.setScalar(unit);
  }
}

function acquireCoarse(b: Binding): CoarseEntry {
  let c = coarseCache.get(b.coarseKey);
  if (!c) {
    const t0 = performance.now();
    const s = b.spec;
    const geo = meshVoxels(s.model, { voxelSize: s.voxelSize, origin: s.origin, jitter: s.jitter, ao: s.ao, openBottom: s.openBottom, openTop: s.openTop }).geometry;
    geo.userData.voxelCache = true;
    c = { geo, refs: 0, lastUse: 0 };
    coarseCache.set(b.coarseKey, c);
    hdTotals.coarseMeshes++;
    hdTotals.coarseMs += performance.now() - t0;
  }
  c.refs++;
  c.lastUse = ++useClock;
  return c;
}

function acquireHD(b: Binding): HDEntry {
  const e = requestEntry(b.key, b.spec, b.spec.lod ? 1 : 0, false);
  if (b.spec.lod && !e.anchor) e.anchor = b.mesh;
  e.refs++;
  if (!e.geo) e.waiting.add(b);
  pump();
  return e;
}

function requestEntry(key: string, spec: VoxelSpec, prio: number, prewarm: boolean): HDEntry {
  let e = hdCache.get(key);
  if (!e) {
    e = { key, job: makeJob(spec), geo: null, state: 'queued', refs: 0, prewarm, prio, waiting: new Set(), bytes: 0, lastUse: 0, anchor: null, label: spec.label ?? spec.style, tris: 0 };
    hdCache.set(key, e);
    queue.push(e);
  } else {
    if (prio < e.prio) e.prio = prio;
    e.prewarm ||= prewarm;
  }
  e.lastUse = ++useClock;
  return e;
}

/** Shows the right geometry for a binding: HD when on, near and ready; else the coarse one. */
function apply(b: Binding): void {
  if (hd.enabled && !b.far) {
    b.hd ??= acquireHD(b);
    if (b.hd.geo) {
      setGeometry(b, b.hd.geo, unitOf(b.spec));
      return;
    }
  }
  b.coarse ??= acquireCoarse(b);
  setGeometry(b, b.coarse.geo, 1);
}

/**
 * Gives a mesh the voxel model's look (HD or coarse, see above) and keeps it up to date.
 * Release it with releaseVoxelMesh when the mesh goes away (never dispose its geometry directly:
 * it is shared).
 */
export function bindVoxelMesh(mesh: Mesh, spec: VoxelSpec): Mesh {
  releaseVoxelMesh(mesh);
  const key = contentKey(spec);
  const b: Binding = { mesh, spec, key, hd: null, coarse: null, coarseKey: `${key}|${spec.voxelSize}|${spec.jitter ?? ''}`, far: false, sphere: null };
  bindings.set(mesh, b);
  apply(b);
  return mesh;
}

/** Re-applies a bound mesh's geometry (e.g. after an effect swapped in a private copy). */
export function refreshVoxelMesh(mesh: Mesh): void {
  const b = bindings.get(mesh);
  if (b) {
    mesh.userData.voxelGeo = null;
    apply(b);
  }
}

/** Drops a mesh's binding; disposes its geometry only if it is a private one (not from the cache). */
export function releaseVoxelMesh(mesh: Mesh): void {
  const b = bindings.get(mesh);
  if (!mesh.geometry.userData.voxelCache) mesh.geometry.dispose();
  if (!b) return;
  bindings.delete(mesh);
  if (b.hd) {
    b.hd.refs--;
    b.hd.waiting.delete(b);
    if (b.hd.anchor === mesh) b.hd.anchor = null;
  }
  if (b.coarse) b.coarse.refs--;
  trim();
}

/** True if this geometry belongs to the voxel cache (shared: copy it before editing). */
export function isSharedGeometry(geo: BufferGeometry): boolean {
  return !!geo.userData.voxelCache;
}

/** Sets a voxel mesh's scale relative to its unit (squash and stretch effects). */
export function setMeshScale(mesh: Mesh, x: number, y = x, z = x): void {
  const u = (mesh.userData.unit as number | undefined) ?? 1;
  mesh.scale.set(x * u, y * u, z * u);
}

/** Unreferenced HD geometry kept around for reuse (prewarmed objects, things that were removed). */
const HD_BUDGET = 128 * 1024 * 1024;
/** Prewarming stops once the cache holds this much (the rest is built on first use). */
export const PREWARM_BUDGET = 104 * 1024 * 1024;

/** Bytes of HD geometry in the cache. */
export function hdCacheBytes(): number {
  let n = 0;
  for (const e of hdCache.values()) n += e.bytes;
  return n;
}
const COARSE_SPARE = 160;

function trim(): void {
  let total = 0;
  for (const e of hdCache.values()) total += e.bytes;
  if (total > HD_BUDGET) {
    const idle = [...hdCache.values()].filter((e) => e.refs <= 0 && e.state === 'ready').sort((a, b) => a.lastUse - b.lastUse);
    for (const e of idle) {
      if (total <= HD_BUDGET) break;
      total -= e.bytes;
      e.geo?.dispose();
      hdCache.delete(e.key);
      hdTotals.evicted++;
    }
  }
  if (coarseCache.size > COARSE_SPARE * 2) {
    const idle = [...coarseCache.entries()].filter(([, c]) => c.refs <= 0).sort((a, b) => a[1].lastUse - b[1].lastUse);
    for (const [k, c] of idle.slice(0, coarseCache.size - COARSE_SPARE)) {
      c.geo.dispose();
      coarseCache.delete(k);
    }
  }
}

// ------------------------------------------------------------------ building (workers)

const queue: HDEntry[] = [];
interface Slot { worker: Worker; job: HDEntry | null; id: number }
let slots: Slot[] | null = null;
let mainPumpQueued = false;
let nextJobId = 1;
const focus = new Vector3();
const _v = new Vector3();

function startWorkers(): Slot[] {
  const list: Slot[] = [];
  if (typeof Worker === 'undefined' || new URLSearchParams(location.search).has('hdsync')) return list;
  const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency ?? 2) - 1));
  for (let i = 0; i < n; i++) {
    try {
      const worker = new Worker(new URL('./hd-worker.ts', import.meta.url), { type: 'module' });
      const slot: Slot = { worker, job: null, id: 0 };
      worker.onmessage = (ev: MessageEvent<{ id: number; r?: HDArrays; error?: string }>) => {
        const e = slot.job;
        if (!e || ev.data.id !== slot.id) return;
        slot.job = null;
        if (ev.data.r) finish(e, ev.data.r, false);
        else fail(e, ev.data.error ?? 'unknown error');
        pumpNow();
      };
      worker.onerror = (ev) => {
        // a worker that can't start (or crashed): drop it, put its job back, carry on without it
        ev.preventDefault?.();
        const e = slot.job;
        slot.job = null;
        list.splice(list.indexOf(slot), 1);
        worker.terminate();
        if (e) {
          e.state = 'queued';
          queue.push(e);
        }
        pump();
      };
      list.push(slot);
    } catch {
      break;
    }
  }
  return list;
}

/** Next job: objects first (oldest first), then scenery nearest the camera, then prewarm. Drops unwanted ones. */
function takeJob(): HDEntry | null {
  let best = -1, bestScore = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (e.refs <= 0 && !e.prewarm) continue;
    let score = e.prio * 1e6 + i * 1e-3;
    if (e.prio === 1 && e.anchor) {
      e.anchor.getWorldPosition(_v);
      score += _v.distanceTo(focus);
    }
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  // forget jobs nobody wants anymore
  for (let i = queue.length - 1; i >= 0; i--) {
    const e = queue[i];
    if (i !== best && e.refs <= 0 && !e.prewarm) {
      hdCache.delete(e.key);
      queue.splice(i, 1);
      if (i < best) best--;
    }
  }
  if (best < 0) return null;
  return queue.splice(best, 1)[0];
}

let pumpQueued = false;

/** Starts jobs on idle workers, after the current task: a level load binds everything first, so the nearest go first. */
function pump(): void {
  if (pumpQueued) return;
  pumpQueued = true;
  setTimeout(() => {
    pumpQueued = false;
    pumpNow();
  }, 0);
}

function pumpNow(): void {
  slots ??= startWorkers();
  if (slots.length) {
    for (const s of slots) {
      if (s.job) continue;
      const e = takeJob();
      if (!e) return;
      e.state = 'building';
      s.job = e;
      s.id = nextJobId++;
      s.worker.postMessage({ id: s.id, job: e.job });
    }
    return;
  }
  // no workers (blocked or unsupported): one job per task on the main thread
  if (mainPumpQueued || !queue.length) return;
  mainPumpQueued = true;
  setTimeout(() => {
    mainPumpQueued = false;
    const e = takeJob();
    if (!e) return;
    try {
      finish(e, meshHD(e.job), true);
    } catch (err) {
      fail(e, String(err));
    }
    pump();
  }, 0);
}

function fail(e: HDEntry, error: string): void {
  e.state = 'failed';
  e.waiting.clear();
  console.warn('HD voxel meshing failed; keeping the coarse mesh', error);
}

function finish(e: HDEntry, r: HDArrays, onMain: boolean): void {
  const t0 = performance.now();
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(r.position, 3));
  g.setAttribute('normal', new BufferAttribute(r.normal, 3, true));
  g.setAttribute('color', new BufferAttribute(r.color, 3, true));
  g.setIndex(new BufferAttribute(r.index, 1));
  g.addGroup(0, r.lit, 0);
  if (r.em) g.addGroup(r.lit, r.em, 1);
  g.boundingBox = new Box3(new Vector3(r.box[0], r.box[1], r.box[2]), new Vector3(r.box[3], r.box[4], r.box[5]));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new Sphere());
  g.userData.hd = true;
  g.userData.voxelCache = true;
  e.geo = g;
  e.state = 'ready';
  e.bytes = geometryBytes(g);
  e.tris = r.index.length / 3;
  e.job = { ...e.job, grid: new Uint8Array(0) }; // the model is no longer needed
  hdTotals.meshes++;
  hdTotals.triangles += r.index.length / 3;
  hdTotals.bytes += e.bytes;
  if (onMain) hdTotals.mainMs += r.ms;
  else hdTotals.workerMs += r.ms;
  const waiting = [...e.waiting];
  e.waiting.clear();
  for (const b of waiting) if (bindings.get(b.mesh) === b && b.hd === e) apply(b);
  hdTotals.mainMs += performance.now() - t0;
  trim();
}

/** Asks for an HD mesh ahead of time (prewarm); returns false if it is already there or on its way. */
export function prewarmHD(spec: VoxelSpec): boolean {
  if (!hd.enabled) return false;
  const key = contentKey(spec);
  const fresh = !hdCache.has(key);
  requestEntry(key, spec, 2, true);
  pump();
  return fresh;
}

/** Jobs not built yet (queued or in a worker). */
export function hdPending(): number {
  let n = queue.filter((e) => e.refs > 0 || e.prewarm).length;
  for (const s of slots ?? []) if (s.job) n++;
  return n;
}

// ------------------------------------------------------------------ LOD and the setting

/** Scenery within this distance (m, from the camera to its bounding sphere) is HD. */
export const HD_NEAR = 30;
const HYSTERESIS = 4;
let lodFrame = 0;
const lastCam = new Vector3(Infinity, 0, 0);

/** Scenery LOD: coarse past HD_NEAR, hidden past the fog. Cheap; call every frame. */
export function updateVoxelLOD(camera: Vector3, fogFar: number): void {
  focus.copy(camera);
  if (++lodFrame % 20 !== 0 && camera.distanceToSquared(lastCam) < 1) return;
  lastCam.copy(camera);
  for (const b of bindings.values()) {
    if (!b.spec.lod) continue;
    if (!b.sphere) {
      b.mesh.updateWorldMatrix(true, false);
      const geo = b.mesh.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      b.sphere = geo.boundingSphere!.clone().applyMatrix4(b.mesh.matrixWorld);
    }
    const d = Math.max(0, camera.distanceTo(b.sphere.center) - b.sphere.radius);
    b.mesh.visible = d < fogFar;
    const far = b.far ? d > HD_NEAR - HYSTERESIS : d > HD_NEAR;
    if (far !== b.far) {
      b.far = far;
      apply(b);
    }
  }
}

const listeners = new Set<(on: boolean) => void>();

/** Called when HD is switched on or off. */
export function onHDChange(fn: (on: boolean) => void): void {
  listeners.add(fn);
}

/** Switches HD on or off right away (every bound mesh follows) and saves the choice. */
export function setHDEnabled(on: boolean, save = true): void {
  if (save) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      /* no storage */
    }
    hd.source = 'saved';
    hd.reason = 'saved setting';
  }
  if (hd.enabled === on) return;
  hd.enabled = on;
  for (const b of bindings.values()) {
    if (!on && b.hd) {
      b.hd.refs--;
      b.hd.waiting.delete(b);
      b.hd = null;
    }
    apply(b);
  }
  for (const fn of listeners) fn(on);
}

/** Forgets the saved choice: back to the automatic one on the next load. */
export function clearHDSetting(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no storage */
  }
}

/** Cache and build state for the debug hook. */
export function hdStats() {
  let ready = 0, bytes = 0, refs = 0, prewarmed = 0;
  for (const e of hdCache.values()) {
    if (e.state === 'ready') ready++;
    bytes += e.bytes;
    refs += Math.max(0, e.refs);
    if (e.prewarm) prewarmed++;
  }
  let shown = 0, coarseShown = 0, far = 0;
  for (const b of bindings.values()) {
    if (b.mesh.geometry.userData.hd) shown++;
    else coarseShown++;
    if (b.far) far++;
  }
  return {
    ...hd,
    workers: slots?.length ?? 0,
    pending: hdPending(),
    cache: { entries: hdCache.size, ready, bytes, refs, prewarmed, coarseEntries: coarseCache.size },
    meshes: { bound: bindings.size, hd: shown, coarse: coarseShown, far },
    built: { ...hdTotals },
  };
}

/** The biggest cached HD meshes (debug). */
export function hdTop(n = 20) {
  return [...hdCache.values()].sort((a, b) => b.bytes - a.bytes).slice(0, n).map((e) => ({ label: e.label, tris: e.tris, kb: Math.round(e.bytes / 1024), refs: e.refs, prewarm: e.prewarm }));
}

/** GPU buffer bytes of a geometry (attributes + index). */
export function geometryBytes(g: BufferGeometry): number {
  let n = g.index ? g.index.array.byteLength : 0;
  for (const k of Object.keys(g.attributes)) n += (g.attributes[k].array as ArrayLike<number> & { byteLength: number }).byteLength;
  return n;
}

/** Palette keys whose material can't be guessed from the name, per object id. */
export const HD_OVERRIDES: Record<string, Record<string, Cls>> = {
  hero: { heroHair: 'fur', heroShirt: 'cloth', heroShirtDark: 'cloth', heroPants: 'cloth', heroBelt: 'cloth' },
  hut: { red: 'roof', redDark: 'roof' },
  bush: { bushBerry: 'plain' },
  tree: { treeApple: 'plain' },
};
