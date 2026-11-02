export interface Tween {
  duration: number;
  delay?: number;
  update: (t: number) => void;
  done?: () => void;
}

interface Active extends Tween {
  elapsed: number;
}

export class Tweens {
  private active: Active[] = [];

  add(t: Tween): void {
    this.active.push({ ...t, elapsed: -(t.delay ?? 0) });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.elapsed += dt;
      if (a.elapsed < 0) continue;
      const k = Math.min(1, a.elapsed / a.duration);
      a.update(k);
      if (k >= 1) {
        this.active.splice(i, 1);
        a.done?.();
      }
    }
  }

  clear(): void {
    this.active.length = 0;
  }
}

export const ease = {
  outBack: (t: number, s = 2.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};
