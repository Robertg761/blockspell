/**
 * Generative background music, synthesized at runtime with WebAudio.
 * A lookahead scheduler (a short timer that queues notes on the AudioContext
 * clock a fraction of a second ahead) keeps timing sample-accurate.
 *
 * Structure: 4-bar phrases in C major. Each phrase picks a chord progression,
 * a melody "mood" (density) and whether to rest the melody/percussion, so it
 * never settles into an obvious short loop.
 */

export interface MusicSynth {
  readonly ctx: AudioContext;
  readonly noiseBuf: AudioBuffer;
  tone(o: { t: number; f0: number; f1?: number; dur: number; type: OscillatorType; vol: number; filter?: number }): void;
  noise(o: { t: number; dur: number; freq: number; q: number; vol: number; attack?: number; type?: BiquadFilterType }): void;
}

/** How the tune feels: the time of day and the weather change its tempo, key color and busyness. */
export type MusicMood = 'day' | 'dawn' | 'sunset' | 'night' | 'rain' | 'snow';

interface MoodSpec {
  bpm: number;
  /** Multiplies how many melody notes are played. */
  density: number;
  /** Minor thirds in the chords and a minor pentatonic melody. */
  minor: boolean;
  /** Share of phrases that keep the drums. */
  drums: number;
  /** Pad loudness. */
  pad: number;
  /** Melody shift in octaves. */
  octave: number;
}

const MOODS: Record<MusicMood, MoodSpec> = {
  day: { bpm: 100, density: 1, minor: false, drums: 1, pad: 1, octave: 0 },
  dawn: { bpm: 88, density: 0.8, minor: false, drums: 0.5, pad: 1.2, octave: 0 },
  sunset: { bpm: 84, density: 0.75, minor: false, drums: 0.4, pad: 1.3, octave: 0 },
  night: { bpm: 70, density: 0.5, minor: true, drums: 0, pad: 1.7, octave: 0 },
  rain: { bpm: 78, density: 0.6, minor: true, drums: 0.15, pad: 1.4, octave: 0 },
  snow: { bpm: 72, density: 0.5, minor: false, drums: 0, pad: 1.5, octave: 1 },
};
const STEPS_PER_BAR = 8;
const LOOKAHEAD = 0.25; // seconds scheduled ahead
const PUMP_MS = 60;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Chords as [bass root, triad intervals] in C major (midi numbers). */
const C = { I: 48, ii: 50, iii: 52, IV: 53, V: 55, vi: 57 };
const MINOR = new Set([C.ii, C.iii, C.vi]);
const PROGRESSIONS: number[][] = [
  [C.I, C.V, C.vi, C.IV],
  [C.I, C.vi, C.IV, C.V],
  [C.vi, C.IV, C.I, C.V],
  [C.I, C.IV, C.vi, C.V],
  [C.I, C.iii, C.IV, C.V],
  [C.IV, C.I, C.V, C.vi],
  [C.I, C.V, C.IV, C.IV],
  [C.I, C.ii, C.IV, C.V],
];
// C major pentatonic degrees, used for melody over any of the chords
const PENTA = [0, 2, 4, 7, 9];
const PENTA_MINOR = [0, 3, 5, 7, 10];

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export class Music {
  /** Overall music loudness relative to the master bus. */
  private level = 0.3;
  private on = true;
  private readonly bus: GainNode;
  private timer = 0;
  private nextTime = 0;
  private step = 0; // global eighth-note counter
  private prog = PROGRESSIONS[0];
  private lastProg = -1;
  private phrase = 0;
  private melodyOn = true;
  private percOn = true;
  private density = 0.5;
  private degree = 5; // index into the pentatonic ladder (can span octaves)
  private running = false;
  private mood: MusicMood = 'day';
  private spec: MoodSpec = MOODS.day;
  private stepDur = 60 / 100 / 2; // eighth note, changes with the mood at phrase boundaries

  constructor(private readonly s: MusicSynth, out: AudioNode) {
    this.bus = s.ctx.createGain();
    this.bus.gain.value = this.level;
    this.bus.connect(out);
  }

  get enabled(): boolean { return this.on; }
  set enabled(v: boolean) {
    this.on = v;
    this.bus.gain.setTargetAtTime(v ? this.level : 0, this.s.ctx.currentTime, 0.15);
  }

  /** Eases the tune toward a new feel; takes effect at the next phrase so it never lurches. */
  setMood(m: MusicMood): void {
    this.mood = m;
  }

  get volume(): number { return this.level; }
  set volume(v: number) {
    this.level = Math.max(0, Math.min(1, v));
    if (this.on) this.bus.gain.setTargetAtTime(this.level, this.s.ctx.currentTime, 0.1);
  }

  /** Briefly lower the music (e.g. under the win fanfare), then swell back. */
  duck(seconds = 2.5, amount = 0.25): void {
    const g = this.bus.gain, t = this.s.ctx.currentTime;
    const base = this.on ? this.level : 0;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(base * amount, t, 0.08);
    g.setTargetAtTime(base, t + seconds, 0.6);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextTime = this.s.ctx.currentTime + 0.2;
    this.pump();
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.timer);
  }

  private pump = (): void => {
    if (!this.running) return;
    const { ctx } = this.s;
    // fell behind (tab was throttled/suspended): resync instead of bursting
    if (this.nextTime < ctx.currentTime - 0.1) this.nextTime = ctx.currentTime + 0.05;
    if (ctx.state === 'running') {
      while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
        this.scheduleStep(this.step, this.nextTime);
        this.step++;
        this.nextTime += this.stepDur;
      }
    }
    this.timer = window.setTimeout(this.pump, PUMP_MS);
  };

  private newPhrase(): void {
    let i: number;
    do i = Math.floor(Math.random() * PROGRESSIONS.length); while (i === this.lastProg);
    this.lastProg = i;
    this.prog = PROGRESSIONS[i];
    this.phrase++;
    this.spec = MOODS[this.mood];
    this.stepDur = 60 / this.spec.bpm / 2;
    // every few phrases thin the texture out for a breather
    const breather = this.phrase % 4 === 3;
    this.melodyOn = !breather || Math.random() < 0.3;
    this.percOn = !(breather && Math.random() < 0.6) && Math.random() < this.spec.drums;
    this.density = (0.3 + Math.random() * 0.4) * this.spec.density;
  }

  private scheduleStep(n: number, t: number): void {
    const inBar = n % STEPS_PER_BAR;
    const bar = Math.floor(n / STEPS_PER_BAR);
    const barInPhrase = bar % 4;
    if (inBar === 0 && barInPhrase === 0) this.newPhrase();
    const root = this.prog[barInPhrase];
    const third = MINOR.has(root) || this.spec.minor ? 3 : 4;

    if (inBar === 0) this.pad(t, root, third);
    this.bass(t, inBar, root);
    if (this.percOn) this.drums(t, inBar, barInPhrase);
    if (this.melodyOn) this.melody(t, inBar, barInPhrase, root, third);
  }

  private pad(t: number, root: number, third: number): void {
    const { ctx } = this.s;
    const dur = this.stepDur * STEPS_PER_BAR;
    for (const iv of [0, third, 7]) {
      const f = midi(root + 12 + iv);
      for (const detune of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = detune;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 800;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.028 * this.spec.pad, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
        o.connect(lp).connect(g).connect(this.bus);
        o.start(t);
        o.stop(t + dur + 0.3);
      }
    }
  }

  private bass(t: number, inBar: number, root: number): void {
    if (inBar === 0 || inBar === 4 || (inBar === 6 && Math.random() < 0.25)) {
      const note = inBar === 4 ? root + 7 : root;
      this.s.tone({ t, f0: midi(note), dur: this.stepDur * 3, type: 'sine', vol: inBar === 0 ? 0.2 : 0.14 });
    }
  }

  private drums(t: number, inBar: number, barInPhrase: number): void {
    const s = this.s;
    if (inBar === 0 || inBar === 4) s.tone({ t, f0: 110, f1: 45, dur: 0.16, type: 'sine', vol: inBar === 0 ? 0.16 : 0.1 });
    // soft shaker on off-beats, ghost notes on the rest
    if (inBar % 2 === 1) s.noise({ t, dur: 0.05, freq: 7000, q: 0.8, vol: 0.035, type: 'highpass' });
    else if (Math.random() < 0.35) s.noise({ t, dur: 0.03, freq: 8000, q: 0.8, vol: 0.015, type: 'highpass' });
    // woody rim click on the "and" of 2 / 4
    if (inBar === 3 || (inBar === 7 && barInPhrase % 2 === 1)) s.tone({ t, f0: 1500, f1: 1100, dur: 0.04, type: 'triangle', vol: 0.05, filter: 3000 });
  }

  private melody(t: number, inBar: number, barInPhrase: number, root: number, third: number): void {
    // strong beats more likely than weak ones; last bar leans toward rests
    const strong = inBar % 2 === 0;
    let p = this.density * (strong ? 1.25 : 0.7);
    if (barInPhrase === 3 && inBar > 4) p *= 0.5;
    if (Math.random() > p) return;
    // random walk on the pentatonic ladder, nudged toward chord tones on downbeats
    this.degree += pick([-2, -1, -1, 0, 1, 1, 2]);
    this.degree = Math.max(0, Math.min(11, this.degree));
    if (inBar === 0 && Math.random() < 0.6) {
      // snap to nearest pentatonic degree that is a chord tone
      const chordPcs = new Set([root % 12, (root + third) % 12, (root + 7) % 12]);
      for (let d = 0; d < 4; d++) {
        const c = [this.degree + d, this.degree - d].find((x) => x >= 0 && x <= 11 && chordPcs.has((60 + (this.spec.minor ? PENTA_MINOR : PENTA)[x % 5] + 12 * Math.floor(x / 5)) % 12));
        if (c !== undefined) { this.degree = c; break; }
      }
    }
    const scale = this.spec.minor ? PENTA_MINOR : PENTA;
    const note = 60 + scale[this.degree % 5] + 12 * Math.floor(this.degree / 5) + 12 * this.spec.octave;
    this.pluck(t, midi(note), 0.1 + (strong ? 0.03 : 0));
    // occasional soft echo for sparkle
    if (Math.random() < 0.2) this.pluck(t + this.stepDur * 0.75, midi(note), 0.035);
  }

  /** Marimba-ish pluck: sine fundamental plus a quickly decaying bright partial. */
  private pluck(t: number, f: number, vol: number): void {
    this.s.tone({ t, f0: f, dur: 0.55, type: 'sine', vol });
    this.s.tone({ t, f0: f * 4, dur: 0.12, type: 'sine', vol: vol * 0.35 });
    this.s.tone({ t, f0: f * 2, dur: 0.25, type: 'triangle', vol: vol * 0.25, filter: 3000 });
  }
}
