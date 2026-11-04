import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Vector3 } from 'three';

/**
 * The last post-processing pass (after tone mapping, so it works on display colors): a gentle
 * film grade (contrast, saturation, cool shadows and warm highlights), a soft vignette, a
 * whisper of dither against sky banding, and two impact effects driven by `ScreenFx`:
 * chromatic aberration and a color flash.
 */
export function createGradePass(): ShaderPass {
  return new ShaderPass({
    name: 'BlockspellGrade',
    uniforms: {
      tDiffuse: { value: null },
      uAberr: { value: 0 },
      uVig: { value: 0.32 },
      uFlash: { value: new Vector3(1, 1, 1) },
      uFlashAmt: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uAberr, uVig, uFlashAmt, uTime;
      uniform vec3 uFlash;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
      void main() {
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        vec2 off = c * uAberr * (0.35 + r2 * 3.0);
        vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, 1.1);
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.2);
        col *= mix(vec3(0.965, 0.985, 1.04), vec3(1.035, 1.0, 0.95), smoothstep(0.15, 0.85, l));
        col *= 1.0 - smoothstep(0.18, 0.75, r2 * 1.7) * uVig;
        col = mix(col, uFlash, uFlashAmt);
        col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Short-lived screen effects: chromatic kick, color flash, field-of-view punch and hit-stop. */
export class ScreenFx {
  aberration = 0;
  flashAmt = 0;
  flashColor = new Vector3(1, 1, 1);
  /** Extra degrees of field of view. */
  fov = 0;
  private stopLeft = 0;
  private stopScale = 1;
  /** Turned off by `prefers-reduced-motion`: no aberration, FOV punch or hit-stop (the flash gets softer). */
  calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** A burst of color fringing and a quick zoom, `amount` 0..1. */
  punch(amount: number): void {
    if (this.calm) return;
    this.aberration = Math.min(0.005, this.aberration + amount * 0.0035);
    this.fov = Math.min(4, this.fov + amount * 2.4);
  }

  /** A brief wash of `hex` over the screen. */
  flash(hex: string, amount: number): void {
    const n = parseInt(hex.slice(1), 16);
    this.flashColor.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    this.flashAmt = Math.min(0.3, Math.max(this.flashAmt, amount * (this.calm ? 0.3 : 1)));
  }

  /** Slows the game to `scale` for `seconds` of real time (a heavy hit, a big boom). */
  hitStop(seconds: number, scale = 0.12): void {
    if (this.calm) return;
    this.stopScale = this.stopLeft > 0 ? Math.min(this.stopScale, scale) : scale;
    this.stopLeft = Math.max(this.stopLeft, seconds);
  }

  /** Real-time step: decays the effects and returns the factor to scale the simulation step by. */
  pace(dt: number): number {
    this.aberration *= Math.exp(-dt * 7);
    this.flashAmt *= Math.exp(-dt * 6);
    this.fov *= Math.exp(-dt * 5);
    if (this.aberration < 1e-5) this.aberration = 0;
    if (this.flashAmt < 1e-3) this.flashAmt = 0;
    if (this.fov < 0.01) this.fov = 0;
    if (this.stopLeft <= 0) return 1;
    this.stopLeft -= dt;
    // ease back to full speed over the last 60 ms, so it doesn't snap
    const back = Math.min(1, Math.max(0, this.stopLeft) / 0.06);
    return this.stopScale + (1 - this.stopScale) * (1 - back);
  }
}
