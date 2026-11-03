import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedBufferGeometry, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3, Vector4, type Material, type Object3D, type Scene, type WebGLProgramParametersWithUniforms,
} from 'three';
import type { Entity } from '../core/entity';
import type { VoxelModel } from '../voxel/model';
import { resolveColor } from '../voxel/palette';
import { gpuTier } from '../voxel/hd';
import type { Effects } from './fx';

/**
 * Voxel spawn / change / despawn animations. Purely visual: the physics body, tags and state are
 * applied at once as always, so gameplay (and the debug solvers) can't tell them apart.
 *
 * Everything runs on the GPU off one clock uniform:
 * - Every entity material is patched once at creation (same program for all, no compile hitch when
 *   an animation starts). The patch works per coarse voxel cell, computed in the fragment shader from
 *   the entity-space position, so it looks the same on HD (4x finer) and coarse meshes: cells appear
 *   (spawn), vanish (despawn) or change color as a wave passes (morph), each with a bright edge flash.
 * - Flying voxels are one instanced cube mesh per animation whose motion is all in the vertex shader
 *   (per-instance cell, color and seed attributes): no per-voxel JS work after the start.
 *
 * Quality: 'full' (flying voxels, bulges), 'lite' (shader reveal only, shorter; software rendering,
 * weak GPUs, prefers-reduced-motion, or a slow frame rate) or 'off' (the old pop). ?anim=full|lite|off forces it.
 */
export type AnimLevel = 'full' | 'lite' | 'off';
export const animSettings = { level: 'full' as AnimLevel, source: 'auto' as 'url' | 'auto' | 'debug', reason: '', reducedMotion: false };

function readSetting(): void {
  let q: string | null = null;
  try {
    q = new URLSearchParams(location.search).get('anim');
  } catch {
    /* no location */
  }
  try {
    animSettings.reducedMotion = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* no matchMedia */
  }
  if (q === 'full' || q === 'lite' || q === 'off') {
    animSettings.level = q;
    animSettings.source = 'url';
    animSettings.reason = `?anim=${q}`;
  } else {
    animSettings.level = animSettings.reducedMotion || gpuTier.software || gpuTier.weak ? 'lite' : 'full';
    animSettings.source = 'auto';
    animSettings.reason = animSettings.reducedMotion ? 'prefers-reduced-motion' : gpuTier.software ? 'software rendering' : gpuTier.weak ? 'weak GPU' : 'GPU looks capable';
  }
}
readSetting();
try {
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    if (animSettings.source === 'auto') readSetting();
  });
} catch {
  /* old browsers */
}

export function setAnimLevel(level: AnimLevel | null): void {
  if (level === null) readSetting();
  else {
    animSettings.level = level;
    animSettings.source = 'debug';
    animSettings.reason = 'set from the debug hook';
  }
}

/** Shared clock (seconds of simulation) read by every patched shader. */
const clock = { value: 0 };

/** Per-entity uniforms, shared by the entity's materials (main mesh and parts use the same ones). */
export interface EntityAnim {
  /** mode (0 none, 1 spawn, 2 dissolve, 3 morph), start time, duration, unused */
  uBsA: { value: Vector4 };
  /** half size xyz (m), coarse voxel size */
  uBsB: { value: Vector4 };
  /** morph wave direction xyz (entity space), bulge amplitude */
  uBsC: { value: Vector4 };
  /** rim glow, edge flash gain, "keep the old colors ahead of the wave", lite timing */
  uBsD: { value: Vector4 };
  uBsColor: { value: Color };
  uBsFrom: { value: Color };
  uBsFromE: { value: Color };
  /** World -> entity (visual group) space. */
  uBsInv: { value: Matrix4 };
  uBsTime: { value: number };
}

export function makeEntityAnim(): EntityAnim {
  return {
    uBsA: { value: new Vector4() },
    uBsB: { value: new Vector4(0.5, 0.5, 0.5, 0.1) },
    uBsC: { value: new Vector4(0, 1, 0, 0) },
    uBsD: { value: new Vector4() },
    uBsColor: { value: new Color(1, 1, 1) },
    uBsFrom: { value: new Color(1, 1, 1) },
    uBsFromE: { value: new Color(0, 0, 0) },
    uBsInv: { value: new Matrix4() },
    uBsTime: clock,
  };
}

// ------------------------------------------------------------------ shaders

/** A float hash of an integer cell (Dave Hoskins' hash13): stable on every GPU, same in both shader stages. */
const COMMON = /* glsl */ `
float bsHash(vec3 c) {
  vec3 p = fract(c * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
// normalized time at which a cell appears (spawn) or leaves (dissolve)
float bsCellT(vec3 cell, vec3 n, float mode, float lite) {
  float yn = (cell.y + 0.5) / max(n.y, 1.0);
  float h = bsHash(cell);
  if (mode < 1.5) return lite > 0.5 ? 0.05 + 0.6 * (0.7 * yn + 0.3 * h) : 0.3 + 0.5 * (0.62 * yn + 0.38 * h);
  return 0.05 + 0.6 * (0.35 * (1.0 - yn) + 0.65 * h);
}
`;

const ENTITY_UNIFORMS = /* glsl */ `
uniform float uBsTime;
uniform vec4 uBsA;
uniform vec4 uBsB;
uniform vec4 uBsC;
uniform vec4 uBsD;
uniform vec3 uBsColor;
uniform vec3 uBsFrom;
uniform vec3 uBsFromE;
uniform mat4 uBsInv;
varying vec3 vBsP;
varying vec3 vBsN;
`;

const ENTITY_VERTEX = /* glsl */ `
#include <begin_vertex>
vBsP = vec3(0.0);
vBsN = vec3(0.0, 1.0, 0.0);
if (uBsA.x > 0.5) {
  vBsP = (uBsInv * (modelMatrix * vec4(transformed, 1.0))).xyz;
  vBsN = mat3(uBsInv) * (mat3(modelMatrix) * normal);
  if (uBsA.x > 2.5 && uBsC.w > 0.0) {
    // morph: a bulge travels with the wave (a scale about the mesh origin, so no cracks open)
    float bsT = (uBsTime - uBsA.y) / uBsA.z;
    float bsExt = max(dot(uBsB.xyz, abs(uBsC.xyz)), 1e-3);
    float bsW = dot(vBsP, uBsC.xyz) / bsExt * 0.5 + 0.5;
    transformed *= 1.0 + uBsC.w * (1.0 - smoothstep(0.0, 0.2, abs(bsW - (bsT * 1.3 - 0.15))));
  }
}
`;

const ENTITY_FRAGMENT = /* glsl */ `
bool bsAhead = false;
vec3 bsGlow = vec3(0.0);
if (uBsA.x > 0.5) {
  float bsT = (uBsTime - uBsA.y) / uBsA.z;
  float bsVs = uBsB.w;
  vec3 bsHs = uBsB.xyz;
  vec3 bsN = max(floor(2.0 * bsHs / bsVs + 0.5), vec3(1.0));
  // the coarse cell this fragment belongs to: step a little inside along the normal
  vec3 bsCell = clamp(floor((vBsP - normalize(vBsN) * 0.3 * bsVs + bsHs) / bsVs), vec3(0.0), bsN - 1.0);
  if (uBsA.x < 2.5) {
    float bsCt = bsCellT(bsCell, bsN, uBsA.x, uBsD.w);
    if (uBsA.x < 1.5) {
      if (bsT < bsCt) discard;
      bsGlow = uBsColor * (1.0 - smoothstep(0.0, 0.12, bsT - bsCt)) * uBsD.y;
    } else {
      if (bsT > bsCt) discard;
      float bsK = smoothstep(bsCt - 0.1, bsCt, bsT);
      bsGlow = uBsColor * bsK * bsK * uBsD.y;
    }
  } else {
    float bsExt = max(dot(bsHs, abs(uBsC.xyz)), 1e-3);
    vec3 bsCc = (bsCell + 0.5) * bsVs - bsHs;
    float bsU = (dot(bsCc, uBsC.xyz) / bsExt * 0.5 + 0.5) * 0.85 + 0.15 * bsHash(bsCell);
    float bsF = bsT * 1.3 - 0.15;
    bsAhead = uBsD.z > 0.5 && bsU > bsF;
    float bsBand = 1.0 - smoothstep(0.0, 0.12, abs(bsU - bsF));
    float bsTw = 0.65 + 0.35 * sin(uBsTime * 38.0 + bsHash(bsCell + 7.0) * 40.0);
    bsGlow = uBsColor * bsBand * bsTw * uBsD.y;
  }
}
#ifdef STANDARD
vec4 diffuseColor = vec4( bsAhead ? uBsFrom : diffuse, opacity );
#else
vec4 diffuseColor = vec4( diffuse, opacity );
#endif
`;

const ENTITY_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
if (bsAhead) totalEmissiveRadiance = uBsFromE;
`;

const ENTITY_OUT = /* glsl */ `
#ifdef STANDARD
if (uBsD.x > 0.0) {
  float bsR = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
  bsGlow += uBsColor * bsR * bsR * uBsD.x;
}
#endif
outgoingLight += bsGlow;
#include <opaque_fragment>
`;

function patchEntityShader(shader: WebGLProgramParametersWithUniforms, u: EntityAnim): void {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = ENTITY_UNIFORMS + COMMON + shader.vertexShader.replace('#include <begin_vertex>', ENTITY_VERTEX);
  shader.fragmentShader = ENTITY_UNIFORMS + COMMON + shader.fragmentShader
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', ENTITY_FRAGMENT)
    .replace('#include <emissivemap_fragment>', ENTITY_EMISSIVE)
    .replace('#include <opaque_fragment>', ENTITY_OUT);
}

/** Gives an entity's materials the animation patch (do this before they are first drawn). */
export function patchEntityMaterials(materials: Material[], u: EntityAnim): void {
  for (const m of materials) {
    m.onBeforeCompile = (shader) => patchEntityShader(shader, u);
    m.customProgramCacheKey = () => 'bsanim1';
  }
}

// flying voxel cubes: every motion is computed from the instance attributes and the clock
const CUBE_VERTEX_HEAD = /* glsl */ `
uniform float uBsTime;
attribute vec3 aCell;
attribute vec4 aRand;
attribute vec4 aP0;
attribute vec4 aP1;
attribute vec3 aUp;
varying float vCubeGlow;
mat3 bsRot(vec3 a, float t) {
  float s = sin(t), c = cos(t), oc = 1.0 - c;
  return mat3(oc * a.x * a.x + c, oc * a.x * a.y + a.z * s, oc * a.z * a.x - a.y * s,
              oc * a.x * a.y - a.z * s, oc * a.y * a.y + c, oc * a.y * a.z + a.x * s,
              oc * a.z * a.x + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c);
}
`;

const CUBE_NORMAL = /* glsl */ `
float cT = (uBsTime - aP0.y) / aP0.z;
float cVs = aP0.w;
vec3 cHs = aP1.xyz;
vec3 cUp = aUp;
vec3 cN = max(floor(2.0 * cHs / cVs + 0.5), vec3(1.0));
vec3 cTarget = (aCell + 0.5) * cVs - cHs;
float cScale = 0.0;
vec3 cPos = cTarget;
float cAng = 0.0;
vCubeGlow = 0.0;
float cCt = bsCellT(aCell, cN, aP0.x, 0.0);
float cR = max(length(cHs), 0.4);
if (aP0.x < 1.5) {
  // spawn: fly in from around and above, snap into the cell with a little overshoot
  float k = clamp((cT - (cCt - 0.3)) / 0.3, 0.0, 1.0);
  vec3 dir = normalize(aRand.xyz * 2.0 - 1.0 + cUp * 0.9);
  vec3 from = cTarget + dir * cR * (1.1 + 1.4 * aRand.w) + cUp * cR * 0.7;
  float km = k - 1.0;
  cPos = mix(from, cTarget, 1.0 + 2.7 * km * km * km + 1.7 * km * km);
  if (cT >= cCt - 0.3 && cT < cCt + 0.04) cScale = cVs * mix(0.3, 1.04, smoothstep(0.0, 0.7, k));
  cAng = (1.0 - k) * (1.0 - k) * 10.0 * (aRand.x - 0.5);
  vCubeGlow = 0.2 + 1.1 * (1.0 - k) * (1.0 - k) + (k >= 1.0 ? 1.4 : 0.0);
} else {
  // dissolve: break off when the cell goes, scatter outward, fall, shrink away
  float age = (cT - cCt) * aP0.z;
  float life = 0.45 + 0.35 * aRand.y;
  if (age >= 0.0 && age < life) {
    vec3 cOut = normalize(cTarget + (aRand.xyz - 0.5) * cR * 0.9 + vec3(0.0, 0.001, 0.0));
    vec3 v0 = cOut * (0.8 + 1.9 * aRand.w) + cUp * (1.0 + 1.4 * aRand.z);
    cPos = cTarget + v0 * age - cUp * 5.5 * age * age;
    float f = age / life;
    cScale = cVs * (1.0 - f * f) * 0.95;
    cAng = age * 12.0 * (aRand.x - 0.5);
    vCubeGlow = 0.55 * (1.0 - f) * (1.0 - f);
  }
}
mat3 cRot = bsRot(normalize(aRand.zxy - 0.5 + 0.001), cAng);
vec3 objectNormal = cRot * vec3( normal );
`;

const CUBE_BEGIN = /* glsl */ `
vec3 transformed = cRot * (position * cScale) + cPos;
`;

const CUBE_OUT = /* glsl */ `
outgoingLight += diffuseColor.rgb * vCubeGlow + vec3(0.12 * vCubeGlow);
#include <opaque_fragment>
`;

let cubeMaterial: MeshStandardMaterial | null = null;
function getCubeMaterial(): MeshStandardMaterial {
  if (cubeMaterial) return cubeMaterial;
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBsTime = clock;
    shader.vertexShader = CUBE_VERTEX_HEAD + COMMON + shader.vertexShader
      .replace('#include <beginnormal_vertex>', CUBE_NORMAL)
      .replace('#include <begin_vertex>', CUBE_BEGIN);
    shader.fragmentShader = 'varying float vCubeGlow;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', CUBE_OUT);
  };
  m.customProgramCacheKey = () => 'bscube1';
  cubeMaterial = m;
  return m;
}

const box = new BoxGeometry(1, 1, 1);

/** Instanced cube geometry with the per-voxel attributes (own copies of the tiny cube: disposing it frees nothing shared). */
function cubeGeometry(n: number, cell: Float32Array, color: Float32Array, rnd: Float32Array, p0: Float32Array, p1: Float32Array, up: Float32Array): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  g.setIndex(box.index!.clone());
  g.setAttribute('position', (box.getAttribute('position') as BufferAttribute).clone());
  g.setAttribute('normal', (box.getAttribute('normal') as BufferAttribute).clone());
  g.setAttribute('aCell', new InstancedBufferAttribute(cell, 3));
  g.setAttribute('color', new InstancedBufferAttribute(color, 3));
  g.setAttribute('aRand', new InstancedBufferAttribute(rnd, 4));
  g.setAttribute('aP0', new InstancedBufferAttribute(p0, 4));
  g.setAttribute('aP1', new InstancedBufferAttribute(p1, 4));
  g.setAttribute('aUp', new InstancedBufferAttribute(up, 3));
  g.instanceCount = n;
  return g;
}

/** One long-finished (invisible) cube, always in the scene, so the cube shader compiles with the level, not on the first cast. */
function warmupCubes(): Mesh {
  const g = cubeGeometry(1, new Float32Array(3), new Float32Array(3), new Float32Array(4), new Float32Array([1, -1e6, 1, 0.1]), new Float32Array([0.5, 0.5, 0.5, 0]), new Float32Array([0, 1, 0]));
  const m = new Mesh(g, getCubeMaterial());
  m.frustumCulled = false;
  m.name = 'voxel-cubes-warmup';
  return m;
}

/**
 * An invisible triangle drawn with patched entity materials (lit and emissive), always in the scene:
 * entity programs no longer match the static ones, so without it a level with no objects would let
 * three.js drop them and the next cast would recompile.
 */
function keepEntityPrograms(): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(9), 3));
  g.addGroup(0, 3, 0);
  g.addGroup(0, 3, 1);
  const mats = [new MeshStandardMaterial({ vertexColors: true }), new MeshBasicMaterial({ vertexColors: true })];
  patchEntityMaterials(mats, makeEntityAnim());
  const m = new Mesh(g, mats);
  m.frustumCulled = false;
  m.receiveShadow = true; // part of the program key: match entity meshes
  m.name = 'voxel-anims-programs';
  return m;
}

/** Surface cells of a model (filled, with an empty neighbour) and their colors: cached per model. */
const surfaceCache = new WeakMap<VoxelModel, { cells: Uint8Array; colors: Float32Array; n: number }>();
function surfaceOf(m: VoxelModel) {
  let s = surfaceCache.get(m);
  if (s) return s;
  const { sx, sy, sz, grid } = m;
  const at = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && grid[x + sx * (y + sy * z)] !== 0;
  const cells: number[] = [], colors: number[] = [];
  const keyColors = m.keys.map((k) => resolveColor(k).color);
  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        const g = grid[x + sx * (y + sy * z)];
        if (!g) continue;
        if (at(x - 1, y, z) && at(x + 1, y, z) && at(x, y - 1, z) && at(x, y + 1, z) && at(x, y, z - 1) && at(x, y, z + 1)) continue;
        cells.push(Math.min(255, x), Math.min(255, y), Math.min(255, z));
        const c = keyColors[g - 1];
        colors.push(c.r, c.g, c.b);
      }
  s = { cells: Uint8Array.from(cells), colors: Float32Array.from(colors), n: cells.length / 3 };
  surfaceCache.set(m, s);
  return s;
}

// ------------------------------------------------------------------ the animator

type Kind = 'spawn' | 'dissolve' | 'morph';

interface Anim {
  e: Entity;
  kind: Kind;
  start: number;
  dur: number;
  /** Seconds after start when it ends (dissolve: the scattered voxels outlive the reveal). */
  end: number;
  lite: boolean;
  cubes: Mesh | null;
  shadows: [Mesh, boolean][];
  /** Dissolve: disposes the entity's visuals when done. */
  finalize: (() => void) | null;
  color: Color;
  popped: boolean;
  fromScale: number;
  dir: Vector3;
}

const MAX_ANIMS = 24;
const MAX_CUBE_ANIMS = 6;
const MAX_CUBES = 2600;
const CUBES_PER_ANIM = 520;
const _v = new Vector3();
const _q = new Quaternion();
const _c = new Color();
const WHITE = new Color(1, 1, 1);

export interface MorphOptions {
  /** Glow color of the wave. */
  color?: string;
  /** Material color / emissive radiance before the change: shown ahead of the wave. */
  from?: { color: Color; emissive: Color } | null;
  /** Visual scale ratio to ease from (a size change), with a bounce. */
  fromScale?: number;
}

export class VoxelAnims {
  private active: Anim[] = [];
  /** Dissolving entities' visuals live here (one fixed scene child, so scene counts don't move). */
  readonly ghosts = new Group();
  private frameMs = 16;
  private lastFrame = 0;
  private slowFor = 0;

  constructor(scene: Scene, private fx: Effects) {
    this.ghosts.name = 'voxel-anims';
    scene.add(this.ghosts);
    this.ghosts.add(warmupCubes(), keepEntityPrograms());
  }

  get time(): number {
    return clock.value;
  }

  stats() {
    let cubes = 0;
    for (const a of this.active) cubes += a.cubes ? (a.cubes.geometry as InstancedBufferGeometry).instanceCount : 0;
    return { ...animSettings, active: this.active.length, kinds: this.active.map((a) => a.kind), cubes, frameMs: +this.frameMs.toFixed(1) };
  }

  private enabled(e: Entity): boolean {
    return animSettings.level !== 'off' && !!e.anim && !!e.voxel;
  }

  private find(e: Entity): Anim | undefined {
    return this.active.find((a) => a.e === e);
  }

  /** Stops an entity's running animation and puts its look back to normal. */
  private stop(a: Anim): void {
    const i = this.active.indexOf(a);
    if (i >= 0) this.active.splice(i, 1);
    const u = a.e.anim!;
    u.uBsA.value.x = 0;
    u.uBsD.value.set(0, 0, 0, 0);
    u.uBsC.value.w = 0;
    if (a.cubes) {
      a.cubes.removeFromParent();
      a.cubes.geometry.dispose();
    }
    for (const [m, cast] of a.shadows) m.castShadow = cast;
    if (a.kind !== 'dissolve') a.e.visual.scale.setScalar(1);
    a.finalize?.();
  }

  private begin(e: Entity, kind: Kind, dur: number, end: number, color: Color, mode: number, lite: boolean): Anim {
    const old = this.find(e);
    if (old) this.stop(old);
    const u = e.anim!;
    const { model, vs } = e.voxel!;
    u.uBsA.value.set(mode, clock.value, dur, 0);
    u.uBsB.value.set((model.sx * vs) / 2, (model.sy * vs) / 2, (model.sz * vs) / 2, vs);
    u.uBsD.value.set(0, kind === 'morph' ? 1.25 : kind === 'dissolve' ? 1.0 : 1.1, 0, lite ? 1 : 0);
    u.uBsColor.value.copy(color);
    const a: Anim = { e, kind, start: clock.value, dur, end, lite, cubes: null, shadows: [], finalize: null, color, popped: false, fromScale: 1, dir: new Vector3(0, 1, 0) };
    this.active.push(a);
    this.syncMatrix(a);
    return a;
  }

  private hideShadows(a: Anim): void {
    a.e.visual.traverse((o: Object3D) => {
      if (o instanceof Mesh && o !== a.cubes) {
        a.shadows.push([o, o.castShadow]);
        o.castShadow = false;
      }
    });
  }

  /** Builds the flying voxel cubes for a spawn (mode 1) or dissolve (mode 2), if the budget allows. */
  private addCubes(a: Anim, mode: number): void {
    if (a.lite) return;
    let used = 0, withCubes = 0;
    for (const o of this.active)
      if (o.cubes) {
        withCubes++;
        used += (o.cubes.geometry as InstancedBufferGeometry).instanceCount;
      }
    if (withCubes >= MAX_CUBE_ANIMS) return;
    const s = surfaceOf(a.e.voxel!.model);
    const n = Math.min(s.n, CUBES_PER_ANIM, MAX_CUBES - used);
    if (n < 4) return;
    const u = a.e.anim!;
    const tint = (a.e.materials[0] as MeshStandardMaterial).color ?? WHITE;
    // the rainbow behavior repaints the mesh itself, so the model's colors would be wrong
    const rainbow = a.e.has('rainbow');
    const cell = new Float32Array(n * 3), col = new Float32Array(n * 3), rnd = new Float32Array(n * 4), p0 = new Float32Array(n * 4), p1 = new Float32Array(n * 4), up = new Float32Array(n * 3);
    // world up in the entity's space (it may be lying on its side)
    a.e.visual.updateWorldMatrix(true, false);
    const wUp = _v.set(0, 1, 0).applyQuaternion(a.e.visual.getWorldQuaternion(_q).invert());
    // a random subset when there are more surface voxels than cubes
    const pick = Array.from({ length: s.n }, (_, i) => i);
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (s.n - i));
      const k = pick[j];
      pick[j] = pick[i];
      cell.set([s.cells[k * 3], s.cells[k * 3 + 1], s.cells[k * 3 + 2]], i * 3);
      if (rainbow) _c.setHSL(Math.random(), 0.85, 0.55);
      else _c.setRGB(s.colors[k * 3] * tint.r, s.colors[k * 3 + 1] * tint.g, s.colors[k * 3 + 2] * tint.b);
      col.set([_c.r, _c.g, _c.b], i * 3);
      rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
      p0.set([mode, a.start, a.dur, u.uBsB.value.w], i * 4);
      p1.set([u.uBsB.value.x, u.uBsB.value.y, u.uBsB.value.z, 0], i * 4);
      up.set([wUp.x, wUp.y, wUp.z], i * 3);
    }
    const g = cubeGeometry(n, cell, col, rnd, p0, p1, up);
    const mesh = new Mesh(g, getCubeMaterial());
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = 'voxel-cubes';
    a.e.visual.add(mesh);
    a.cubes = mesh;
  }

  private syncMatrix(a: Anim): void {
    a.e.visual.updateWorldMatrix(true, false);
    a.e.anim!.uBsInv.value.copy(a.e.visual.matrixWorld).invert();
  }

  /** Voxel-assembly spawn. Returns false when it isn't played (then the caller does the plain pop). */
  spawn(e: Entity): boolean {
    if (!this.enabled(e) || this.active.length >= MAX_ANIMS) return false;
    const lite = animSettings.level === 'lite';
    const big = Math.min(1.35, Math.max(1, 0.85 + e.radius * 0.25));
    const dur = (lite ? 0.6 : 1.0) * big;
    const tint = e.def.burstColor ? new Color(e.def.burstColor).lerp(WHITE, 0.55) : new Color('#fff3c4');
    const a = this.begin(e, 'spawn', dur, dur, tint, 1, lite);
    this.hideShadows(a);
    this.addCubes(a, 1);
    e.visual.scale.setScalar(0.92);
    this.fx.sound('assemble', { pitch: 1 / Math.sqrt(e.scale) });
    return true;
  }

  /**
   * Dissolve: the entity is already gone from the world; its visuals scatter and fade, then
   * `finalize` disposes them. Returns false when not played (the caller disposes right away).
   */
  dissolve(e: Entity, finalize: () => void): boolean {
    if (!this.enabled(e) || !e.root.parent) return false;
    const old = this.find(e);
    if (old) this.stop(old);
    if (this.active.length >= MAX_ANIMS) return false;
    const lite = animSettings.level === 'lite';
    const dur = lite ? 0.45 : 0.7;
    const a = this.begin(e, 'dissolve', dur, dur + (lite ? 0.05 : 0.85), new Color('#ffe9a8'), 2, lite);
    a.finalize = finalize;
    // keep its last pose, parked under a fixed group (the world disposes nothing of it)
    e.root.updateWorldMatrix(true, false);
    this.ghosts.attach(e.root);
    this.hideShadows(a);
    this.addCubes(a, 2);
    this.fx.sound('dissolve', { pitch: 1 / Math.sqrt(e.scale) });
    return true;
  }

  /** A change sweeping across an entity voxel by voxel (material, color, state, size). */
  morph(e: Entity, o: MorphOptions = {}): boolean {
    if (!this.enabled(e) || !e.alive) return false;
    const cur = this.find(e);
    if (cur && cur.kind === 'spawn') {
      // still assembling: it already shows the new look, just tint the finishing flash
      cur.color.set(o.color ?? '#ffffff').lerp(WHITE, 0.3);
      e.anim!.uBsColor.value.copy(cur.color);
      return true;
    }
    if (!cur && this.active.length >= MAX_ANIMS) return false;
    const lite = animSettings.level === 'lite';
    const dur = (lite ? 0.5 : 0.85) * Math.min(1.4, Math.max(1, 0.85 + e.radius * 0.2));
    const a = this.begin(e, 'morph', dur, dur, new Color(o.color ?? '#ffffff'), 3, lite);
    const u = e.anim!;
    // sweep upward, leaning toward a random side so repeated changes don't all look the same
    e.root.updateWorldMatrix(true, false);
    const q = e.root.getWorldQuaternion(_q).invert();
    const ang = Math.random() * Math.PI * 2;
    a.dir.set(Math.cos(ang) * 0.45, 1, Math.sin(ang) * 0.45).normalize().applyQuaternion(q);
    u.uBsC.value.set(a.dir.x, a.dir.y, a.dir.z, lite || animSettings.reducedMotion ? 0 : 0.07);
    if (o.from) {
      u.uBsFrom.value.copy(o.from.color);
      u.uBsFromE.value.copy(o.from.emissive);
      u.uBsD.value.z = 1;
    }
    a.fromScale = o.fromScale ?? 1;
    this.fx.sound('shimmer', { pitch: 1 / Math.sqrt(e.scale) });
    return true;
  }

  /** Material color and emissive radiance now (pass to morph as `from` after a change). */
  snapshot(e: Entity): { color: Color; emissive: Color } | null {
    const m = e.materials[0] as MeshStandardMaterial;
    if (!m?.color || !m.emissive) return null;
    return { color: m.color.clone(), emissive: m.emissive.clone().multiplyScalar(m.emissiveIntensity) };
  }

  update(dt: number): void {
    clock.value += dt;
    this.watchFrameRate();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (!a) continue;
      const e = a.e;
      if ((a.kind !== 'dissolve' && !e.alive) || !e.root.parent) {
        this.stop(a);
        continue;
      }
      const el = clock.value - a.start;
      if (el >= a.end) {
        if (a.kind === 'spawn' && !a.popped) this.popDone(a);
        this.stop(a);
        continue;
      }
      const T = el / a.dur;
      const u = e.anim!;
      if (a.kind === 'spawn') this.updateSpawn(a, T, u);
      else if (a.kind === 'dissolve') this.updateDissolve(a, T);
      else this.updateMorph(a, T);
      this.syncMatrix(a);
    }
  }

  private updateSpawn(a: Anim, T: number, u: EntityAnim): void {
    const e = a.e;
    const revealEnd = a.lite ? 0.66 : 0.8;
    const amp = animSettings.reducedMotion ? 0.05 : a.lite ? 0.1 : 0.16;
    if (T < revealEnd) {
      e.visual.scale.setScalar(0.92 + 0.08 * (T / revealEnd));
    } else {
      if (!a.popped) this.popDone(a);
      // the pop: a damped squash-and-stretch with overshoot
      const k = (T - revealEnd) / (1 - revealEnd);
      const b = Math.sin(k * Math.PI * 2) * (1 - k) * amp + Math.sin(k * Math.PI) * amp * 0.5;
      e.visual.scale.set(1 - b * 0.45, 1 + b, 1 - b * 0.45);
      this.fx.glow.request(e.body.position, '#' + a.color.getHexString(), 16 * (1 - k) * Math.min(2, Math.max(0.7, e.radius)));
    }
    u.uBsD.value.x = Math.max(0, 1 - Math.abs(T - revealEnd) / 0.22) * 1.4;
  }

  /** The moment a spawn finishes assembling: sparkle ring, snap sound, a little shake. */
  private popDone(a: Anim): void {
    a.popped = true;
    const e = a.e;
    const p = e.body.position;
    const s = Math.sqrt(e.scale);
    const col = '#' + a.color.getHexString();
    this.fx.burst(p, { count: a.lite ? 10 : 22, color: ['#ffffff', '#fff6a8', col], speed: 4.5 * s, up: 1, gravity: 2, drag: 3, life: 0.55, size: 0.07 * s, glow: true, spread: e.radius * 0.6 });
    this.fx.sound('snap', { pitch: 1 / s });
    if (!animSettings.reducedMotion) this.fx.addShake(0.05 + Math.min(0.15, e.body.mass * 0.005));
  }

  private updateDissolve(a: Anim, T: number): void {
    const e = a.e;
    if (T < 1) {
      e.root.getWorldPosition(_v);
      this.fx.glow.request(_v, '#ffd98a', 6 * (1 - T) * Math.min(2, Math.max(0.7, e.radius)));
      // a fine glitter rising off the dissolving edge
      if (!a.lite && Math.random() < 0.6) this.fx.burst({ x: _v.x + (Math.random() - 0.5) * e.size.x, y: _v.y + (Math.random() - 0.3) * e.size.y, z: _v.z + (Math.random() - 0.5) * e.size.z }, { count: 1, color: ['#fff6a8', '#ffffff'], speed: 0.4, up: 1.2, gravity: -0.5, life: 0.6, size: 0.05, glow: true });
    }
    // the shell sinks a touch as it goes
    e.visual.scale.setScalar(1 - 0.12 * Math.min(1, T));
  }

  private updateMorph(a: Anim, T: number): void {
    const e = a.e;
    // size: ease from the old ratio with a bounce, plus a little boing as the wave passes
    const k = Math.min(1, T);
    const grow = a.fromScale !== 1 ? a.fromScale + (1 - a.fromScale) * outElastic(k) : 1;
    const wob = animSettings.reducedMotion ? 0 : Math.sin(k * Math.PI * 3) * (1 - k) * (a.lite ? 0.03 : 0.06);
    e.visual.scale.set(grow * (1 - wob * 0.5), grow * (1 + wob), grow * (1 - wob * 0.5));
    if (T < 1.05) {
      e.root.getWorldPosition(_v);
      this.fx.glow.request(_v, '#' + a.color.getHexString(), 3.5 * Math.sin(Math.min(1, T) * Math.PI) * Math.min(2, Math.max(0.7, e.radius)));
    }
    // sparkles riding the wave front
    if (!a.lite && T < 1 && Math.random() < 0.7) {
      const u = e.anim!.uBsB.value;
      const ext = Math.abs(a.dir.x) * u.x + Math.abs(a.dir.y) * u.y + Math.abs(a.dir.z) * u.z;
      const F = T * 1.3 - 0.15;
      _v.set((Math.random() * 2 - 1) * u.x, (Math.random() * 2 - 1) * u.y, (Math.random() * 2 - 1) * u.z);
      _v.addScaledVector(a.dir, ((F / 0.85) * 2 - 1) * ext - _v.dot(a.dir));
      e.visual.localToWorld(_v);
      _c.copy(a.color).lerp(WHITE, 0.4);
      this.fx.burst(_v, { count: 2, color: ['#' + _c.getHexString(), '#ffffff'], speed: 1.2, up: 0.8, gravity: 1, life: 0.5, size: 0.05, glow: true, spread: 0.05 });
    }
  }

  /** Drops to lite on its own when the frame rate stays low (unless the level was forced). */
  private watchFrameRate(): void {
    const now = performance.now();
    const ms = now - this.lastFrame;
    this.lastFrame = now;
    if (ms <= 0 || ms > 250) return;
    this.frameMs += (ms - this.frameMs) * 0.05;
    if (animSettings.source !== 'auto' || animSettings.level !== 'full') return;
    this.slowFor = this.frameMs > 45 && this.active.length ? this.slowFor + ms : 0;
    if (this.slowFor > 2500) {
      animSettings.level = 'lite';
      animSettings.reason = 'slow frame rate';
    }
  }

  /** Ends every animation now (level change): ghosts are disposed. */
  clear(): void {
    for (const a of [...this.active]) this.stop(a);
    this.active.length = 0;
  }
}

function outElastic(t: number): number {
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}
