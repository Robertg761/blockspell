import { Color, Vector3 } from 'three';

export type SkyName = 'day' | 'sunset' | 'night' | 'dawn';
export const SKY_NAMES: SkyName[] = ['day', 'sunset', 'night', 'dawn'];
export const SKY_LABEL: Record<SkyName, string> = { day: '☀ Day', sunset: '🌇 Sunset', night: '🌙 Night', dawn: '🌅 Dawn' };

/** Everything the time of day changes: sky gradient, light colors and strengths, stars. */
export interface SkyState {
  top: Color;
  horizon: Color;
  bottom: Color;
  sunColor: Color;
  /** Direction toward the sun (or the moon at night). */
  sunDir: Vector3;
  sunI: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiI: number;
  exposure: number;
  stars: number;
  /** How much the clouds glow on their own (day: 0.5) and what color they are. */
  cloudGlow: number;
  cloudTint: Color;
}

const c = (hex: string) => new Color(hex);
const dir = (x: number, y: number, z: number) => new Vector3(x, y, z).normalize();

const make = (s: Omit<SkyState, never>): SkyState => s;

export const SKIES: Record<SkyName, SkyState> = {
  day: make({
    top: c('#4a8fe0'), horizon: c('#cfe6f7'), bottom: c('#9cc4dd'),
    sunColor: c('#fff2d0'), sunDir: dir(0.55, 0.85, 0.35), sunI: 2.6,
    hemiSky: c('#cfe8ff'), hemiGround: c('#7a6243'), hemiI: 1.1, exposure: 1.05, stars: 0,
    cloudGlow: 0.5, cloudTint: c('#ffffff'),
  }),
  sunset: make({
    top: c('#3b4f9a'), horizon: c('#ffb27a'), bottom: c('#c98f86'),
    sunColor: c('#ffb070'), sunDir: dir(-0.85, 0.24, 0.3), sunI: 2.5,
    hemiSky: c('#ffd0ae'), hemiGround: c('#6b4a44'), hemiI: 0.95, exposure: 1.05, stars: 0.15,
    cloudGlow: 0.45, cloudTint: c('#ffc7a0'),
  }),
  night: make({
    top: c('#060a22'), horizon: c('#27386e'), bottom: c('#121836'),
    sunColor: c('#c5d6ff'), sunDir: dir(-0.45, 0.72, -0.35), sunI: 1.4,
    hemiSky: c('#6f85c6'), hemiGround: c('#2a3252'), hemiI: 1.0, exposure: 1.0, stars: 1,
    cloudGlow: 0.12, cloudTint: c('#8fa3d6'),
  }),
  dawn: make({
    top: c('#5f86cf'), horizon: c('#ffd3c4'), bottom: c('#c3b3c4'),
    sunColor: c('#ffd9b4'), sunDir: dir(0.9, 0.28, -0.2), sunI: 2.2,
    hemiSky: c('#ffe3d6'), hemiGround: c('#76605a'), hemiI: 1.0, exposure: 1.05, stars: 0.1,
    cloudGlow: 0.5, cloudTint: c('#ffe2d6'),
  }),
};

export const cloneSky = (s: SkyState): SkyState => ({
  top: s.top.clone(), horizon: s.horizon.clone(), bottom: s.bottom.clone(), sunColor: s.sunColor.clone(), sunDir: s.sunDir.clone(), sunI: s.sunI,
  hemiSky: s.hemiSky.clone(), hemiGround: s.hemiGround.clone(), hemiI: s.hemiI, exposure: s.exposure, stars: s.stars, cloudGlow: s.cloudGlow, cloudTint: s.cloudTint.clone(),
});

/** out = a blended toward b by k (0..1). */
export function lerpSky(out: SkyState, a: SkyState, b: SkyState, k: number): SkyState {
  out.top.copy(a.top).lerp(b.top, k);
  out.horizon.copy(a.horizon).lerp(b.horizon, k);
  out.bottom.copy(a.bottom).lerp(b.bottom, k);
  out.sunColor.copy(a.sunColor).lerp(b.sunColor, k);
  out.sunDir.copy(a.sunDir).lerp(b.sunDir, k).normalize();
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, k);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, k);
  out.cloudTint.copy(a.cloudTint).lerp(b.cloudTint, k);
  out.sunI = a.sunI + (b.sunI - a.sunI) * k;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * k;
  out.exposure = a.exposure + (b.exposure - a.exposure) * k;
  out.stars = a.stars + (b.stars - a.stars) * k;
  out.cloudGlow = a.cloudGlow + (b.cloudGlow - a.cloudGlow) * k;
  return out;
}
