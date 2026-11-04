/**
 * Photo mode looks. Each filter is a handful of numbers that become both a CSS filter (the live preview on
 * the canvas) and the same maths run on the pixels (the saved picture), so the photo matches what you saw.
 */
export interface PhotoFilter {
  id: string;
  name: string;
  /** All default to "no change". */
  saturate?: number;
  contrast?: number;
  brightness?: number;
  sepia?: number;
  /** Multiplies the red, green and blue channels. */
  tint?: [number, number, number];
  /** Darkens the corners, 0..1. */
  vignette?: number;
}

export const PHOTO_FILTERS: PhotoFilter[] = [
  { id: 'natural', name: 'Natural' },
  { id: 'warm', name: 'Warm', saturate: 1.15, contrast: 1.05, tint: [1.06, 1, 0.9], vignette: 0.15 },
  { id: 'cool', name: 'Cool', saturate: 1.05, contrast: 1.05, tint: [0.9, 1, 1.1], vignette: 0.15 },
  { id: 'vivid', name: 'Vivid', saturate: 1.55, contrast: 1.12 },
  { id: 'vintage', name: 'Vintage', sepia: 0.55, saturate: 0.9, contrast: 0.95, brightness: 1.05, vignette: 0.35 },
  { id: 'noir', name: 'Noir', saturate: 0, contrast: 1.3, brightness: 0.95, vignette: 0.4 },
];

export const filterById = (id: string): PhotoFilter => PHOTO_FILTERS.find((f) => f.id === id) ?? PHOTO_FILTERS[0];

/** The CSS `filter` value for the live preview ('' for Natural). Vignette and tint are canvas-only. */
export function cssFilter(f: PhotoFilter): string {
  const parts: string[] = [];
  if (f.brightness !== undefined) parts.push(`brightness(${f.brightness})`);
  if (f.contrast !== undefined) parts.push(`contrast(${f.contrast})`);
  if (f.saturate !== undefined) parts.push(`saturate(${f.saturate})`);
  if (f.sepia !== undefined) parts.push(`sepia(${f.sepia})`);
  return parts.join(' ');
}

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Runs the filter over a canvas in place. */
export function applyFilter(canvas: HTMLCanvasElement, f: PhotoFilter): void {
  if (f.id === 'natural') return;
  const g = canvas.getContext('2d');
  if (!g) return;
  const { width: w, height: h } = canvas;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const b = f.brightness ?? 1, c = f.contrast ?? 1, s = f.saturate ?? 1, sep = f.sepia ?? 0;
  const [tr, tg, tb] = f.tint ?? [1, 1, 1];
  const vig = f.vignette ?? 0;
  const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = d[i] * b, gg = d[i + 1] * b, bl = d[i + 2] * b;
      r = (r - 127.5) * c + 127.5;
      gg = (gg - 127.5) * c + 127.5;
      bl = (bl - 127.5) * c + 127.5;
      const l = 0.2126 * r + 0.7152 * gg + 0.0722 * bl;
      r = l + (r - l) * s;
      gg = l + (gg - l) * s;
      bl = l + (bl - l) * s;
      if (sep) {
        const sr = 0.393 * r + 0.769 * gg + 0.189 * bl;
        const sg = 0.349 * r + 0.686 * gg + 0.168 * bl;
        const sb = 0.272 * r + 0.534 * gg + 0.131 * bl;
        r += (sr - r) * sep;
        gg += (sg - gg) * sep;
        bl += (sb - bl) * sep;
      }
      let k = 1;
      if (vig) {
        const t = Math.hypot(x - cx, y - cy) / maxD;
        k = 1 - vig * t * t;
      }
      d[i] = clamp(r * tr * k);
      d[i + 1] = clamp(gg * tg * k);
      d[i + 2] = clamp(bl * tb * k);
    }
  }
  g.putImageData(img, 0, 0);
}
