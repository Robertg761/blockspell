import { Color } from 'three';

/**
 * Shared named palette. Object models reference colors by key (e.g. `'wood'`)
 * so adjectives can recolor them, but a raw `'#rrggbb'` string works anywhere
 * a key does.
 */
export interface PaletteEntry {
  color: string;
  /** Emissive voxels are rendered unlit (they glow, e.g. flames). */
  emissive?: boolean;
}

export const PALETTE: Record<string, PaletteEntry> = {
  // woods
  wood: { color: '#b07a43' },
  woodDark: { color: '#7d532f' },
  woodLight: { color: '#d1a066' },
  cardboard: { color: '#c9a26b' },
  cardboardDark: { color: '#a5814e' },
  tape: { color: '#e8d6a2' },
  // basics
  red: { color: '#e04848' },
  redDark: { color: '#b13232' },
  white: { color: '#f4f1ea' },
  black: { color: '#1f1e24' },
  grey: { color: '#9a9aa3' },
  metal: { color: '#a3adb8' },
  // animal
  fur: { color: '#c98a4f' },
  furDark: { color: '#9a6236' },
  furLight: { color: '#ecc79b' },
  nose: { color: '#2a1f1f' },
  tongue: { color: '#ea6c7d' },
  eye: { color: '#141318' },
  eyeShine: { color: '#ffffff', emissive: true },
  collar: { color: '#3a6fd8' },
  // bone
  bone: { color: '#f0e8d4' },
  boneShade: { color: '#d6c9ab' },
  // fire
  flameCore: { color: '#fff4b8', emissive: true },
  flameMid: { color: '#ffb43c', emissive: true },
  flameOuter: { color: '#ff6c1e', emissive: true },
  flameTip: { color: '#e5401b', emissive: true },
  ember: { color: '#ff7a2a', emissive: true },
  charcoal: { color: '#2d2723' },
  ash: { color: '#6f6a64' },
  // balloon
  balloon: { color: '#ff4f7b' },
  balloonShine: { color: '#ffc2d2' },
  string: { color: '#eeeeee' },
  // terrain
  grass: { color: '#72c04a' },
  grassDark: { color: '#5ba83d' },
  grassLight: { color: '#8fd65e' },
  dirt: { color: '#8c5f3d' },
  dirtDark: { color: '#6d4a2f' },
  stone: { color: '#8f9098' },
  stoneDark: { color: '#74757d' },
  sand: { color: '#e7d49b' },
  leaf: { color: '#4fa341' },
  leafDark: { color: '#3d8a35' },
  bark: { color: '#6e4a2e' },
  cloud: { color: '#ffffff' },
  flowerRed: { color: '#ff5d6c' },
  flowerYellow: { color: '#ffd84a' },
  goal: { color: '#ffd84a', emissive: true },
};

/**
 * Adds palette entries from object modules (call at module top level).
 * Prefix keys with your category to avoid clobbering, e.g. 'catFur'.
 */
export function definePalette(entries: Record<string, PaletteEntry | string>): void {
  for (const [k, v] of Object.entries(entries)) {
    if (PALETTE[k]) console.warn(`[blockspell] palette key "${k}" redefined`);
    PALETTE[k] = typeof v === 'string' ? { color: v } : v;
    cache.delete(k);
  }
}

export interface ResolvedColor {
  color: Color;
  emissive: boolean;
}

const cache = new Map<string, ResolvedColor>();

/** Resolve a palette key or hex string into a (linear) three.js Color. */
export function resolveColor(key: string): ResolvedColor {
  let hit = cache.get(key);
  if (!hit) {
    const entry = PALETTE[key];
    hit = entry
      ? { color: new Color(entry.color), emissive: !!entry.emissive }
      : { color: new Color(key), emissive: false };
    cache.set(key, hit);
  }
  return hit;
}

/**
 * Builds a color remapper that tints `keys` toward `tint`, preserving each
 * key's lightness offset relative to the first key so shading survives
 * (a red ball with dark-red stripes becomes a blue ball with dark-blue stripes).
 */
export function makeTintMap(keys: string[], tint: string): Map<string, string> {
  const map = new Map<string, string>();
  if (keys.length === 0) return map;
  const hsl = { h: 0, s: 0, l: 0 };
  const base = resolveColor(keys[0]).color.clone().convertLinearToSRGB().getHSL({ h: 0, s: 0, l: 0 });
  const t = new Color(tint).convertLinearToSRGB().getHSL({ h: 0, s: 0, l: 0 });
  for (const k of keys) {
    resolveColor(k).color.clone().convertLinearToSRGB().getHSL(hsl);
    const l = Math.min(0.95, Math.max(0.04, t.l + (hsl.l - base.l)));
    const c = new Color().setHSL(t.h, t.s, l).convertSRGBToLinear();
    map.set(k, '#' + c.getHexString());
  }
  return map;
}
