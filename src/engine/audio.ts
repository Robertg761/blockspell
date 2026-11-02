/**
 * All sound is synthesized with WebAudio at runtime — no audio files.
 * Add a new sound by adding a case to `SOUNDS`.
 */
export type SoundName =
  | 'pop' | 'boing' | 'whoosh' | 'thud' | 'chomp' | 'sizzle' | 'bark'
  | 'error' | 'win' | 'click' | 'balloonPop' | 'ignite' | 'magic' | 'poof' | 'squeak'
  | 'boom' | 'splash' | 'shatter' | 'clank' | 'meow' | 'tweet' | 'moo' | 'beep' | 'chime'
  | 'rumble' | 'quack' | 'ribbit' | 'buzz' | 'freeze' | 'oink' | 'engine';

interface PlayOpts {
  pitch?: number;
  volume?: number;
}

type Voice = (a: Synth, t: number, p: number, v: number) => void;

const SOUNDS: Record<SoundName, Voice> = {
  pop: (a, t, p, v) => {
    a.tone({ t, f0: 260 * p, f1: 720 * p, dur: 0.12, type: 'sine', vol: 0.5 * v });
    a.tone({ t: t + 0.03, f0: 900 * p, f1: 1400 * p, dur: 0.07, type: 'triangle', vol: 0.15 * v });
    a.noise({ t, dur: 0.04, freq: 3000, q: 1, vol: 0.12 * v });
  },
  magic: (a, t, p, v) => {
    [0, 4, 7, 12].forEach((semi, i) =>
      a.tone({ t: t + i * 0.035, f0: 660 * p * 2 ** (semi / 12), dur: 0.18, type: 'triangle', vol: 0.09 * v }),
    );
  },
  boing: (a, t, p, v) => {
    a.tone({ t, f0: 180 * p, f1: 520 * p, dur: 0.28, type: 'sine', vol: 0.4 * v, vibrato: 18 });
  },
  whoosh: (a, t, p, v) => {
    a.noise({ t, dur: 0.45, freq: 400 * p, freqEnd: 2400 * p, q: 2, vol: 0.35 * v, attack: 0.12 });
  },
  ignite: (a, t, p, v) => {
    a.noise({ t, dur: 0.6, freq: 600 * p, freqEnd: 1800 * p, q: 0.8, vol: 0.35 * v, attack: 0.05 });
    a.tone({ t, f0: 90 * p, f1: 60 * p, dur: 0.4, type: 'sine', vol: 0.3 * v });
  },
  thud: (a, t, p, v) => {
    a.tone({ t, f0: 120 * p, f1: 40 * p, dur: 0.3, type: 'sine', vol: 0.7 * v });
    a.noise({ t, dur: 0.12, freq: 300, q: 0.7, vol: 0.3 * v });
  },
  chomp: (a, t, p, v) => {
    for (let i = 0; i < 3; i++) {
      a.noise({ t: t + i * 0.11, dur: 0.06, freq: 1200 * p, q: 3, vol: 0.4 * v });
      a.tone({ t: t + i * 0.11, f0: 220 * p, f1: 120 * p, dur: 0.06, type: 'square', vol: 0.06 * v });
    }
  },
  sizzle: (a, t, p, v) => {
    a.noise({ t, dur: 0.7, freq: 5000 * p, q: 0.6, vol: 0.25 * v, type: 'highpass' });
  },
  bark: (a, t, p, v) => {
    for (let i = 0; i < 2; i++) {
      a.tone({ t: t + i * 0.18, f0: 520 * p, f1: 260 * p, dur: 0.11, type: 'sawtooth', vol: 0.18 * v, filter: 1400 });
      a.noise({ t: t + i * 0.18, dur: 0.08, freq: 900, q: 1.5, vol: 0.15 * v });
    }
  },
  error: (a, t, p, v) => {
    a.tone({ t, f0: 330 * p, f1: 300 * p, dur: 0.12, type: 'triangle', vol: 0.25 * v });
    a.tone({ t: t + 0.13, f0: 247 * p, f1: 220 * p, dur: 0.2, type: 'triangle', vol: 0.25 * v });
  },
  win: (a, t, p, v) => {
    [0, 4, 7, 12, 16, 19, 24].forEach((semi, i) =>
      a.tone({ t: t + i * 0.08, f0: 523 * p * 2 ** (semi / 12), dur: i === 6 ? 0.6 : 0.16, type: 'triangle', vol: 0.18 * v }),
    );
  },
  click: (a, t, p, v) => {
    a.tone({ t, f0: 1200 * p, f1: 900 * p, dur: 0.03, type: 'square', vol: 0.06 * v, filter: 3000 });
  },
  balloonPop: (a, t, p, v) => {
    a.noise({ t, dur: 0.15, freq: 2500 * p, q: 0.5, vol: 0.7 * v, type: 'highpass' });
    a.tone({ t, f0: 200 * p, f1: 60 * p, dur: 0.08, type: 'sine', vol: 0.4 * v });
  },
  poof: (a, t, p, v) => {
    a.noise({ t, dur: 0.35, freq: 900 * p, freqEnd: 300 * p, q: 0.7, vol: 0.3 * v, attack: 0.02 });
  },
  squeak: (a, t, p, v) => {
    a.tone({ t, f0: 900 * p, f1: 1500 * p, dur: 0.1, type: 'sine', vol: 0.2 * v, vibrato: 30 });
  },
  boom: (a, t, p, v) => {
    a.tone({ t, f0: 110 * p, f1: 28 * p, dur: 0.9, type: 'sine', vol: 0.9 * v });
    a.noise({ t, dur: 1.1, freq: 900 * p, freqEnd: 120 * p, q: 0.5, vol: 0.8 * v, type: 'lowpass' });
    a.noise({ t, dur: 0.15, freq: 3000, q: 0.6, vol: 0.35 * v });
  },
  splash: (a, t, p, v) => {
    a.noise({ t, dur: 0.5, freq: 1800 * p, freqEnd: 500 * p, q: 0.9, vol: 0.4 * v, attack: 0.01 });
    for (let i = 0; i < 3; i++) a.tone({ t: t + 0.05 + i * 0.06, f0: (700 + i * 230) * p, f1: (1100 + i * 200) * p, dur: 0.07, type: 'sine', vol: 0.08 * v });
  },
  shatter: (a, t, p, v) => {
    a.noise({ t, dur: 0.35, freq: 5200 * p, q: 1.2, vol: 0.45 * v, type: 'highpass' });
    for (let i = 0; i < 5; i++) a.tone({ t: t + i * 0.035, f0: (2400 + i * 520) * p, dur: 0.12, type: 'triangle', vol: 0.06 * v });
  },
  clank: (a, t, p, v) => {
    a.tone({ t, f0: 620 * p, dur: 0.35, type: 'square', vol: 0.08 * v, filter: 2600 });
    a.tone({ t, f0: 931 * p, dur: 0.3, type: 'triangle', vol: 0.12 * v });
    a.noise({ t, dur: 0.05, freq: 2000, q: 2, vol: 0.2 * v });
  },
  meow: (a, t, p, v) => {
    a.tone({ t, f0: 520 * p, f1: 760 * p, dur: 0.14, type: 'sawtooth', vol: 0.1 * v, filter: 1800 });
    a.tone({ t: t + 0.13, f0: 760 * p, f1: 430 * p, dur: 0.28, type: 'sawtooth', vol: 0.1 * v, filter: 1600 });
  },
  tweet: (a, t, p, v) => {
    for (let i = 0; i < 3; i++) a.tone({ t: t + i * 0.09, f0: 2600 * p, f1: 3600 * p, dur: 0.06, type: 'sine', vol: 0.12 * v });
  },
  moo: (a, t, p, v) => {
    a.tone({ t, f0: 150 * p, f1: 115 * p, dur: 0.9, type: 'sawtooth', vol: 0.16 * v, filter: 700, vibrato: 5 });
  },
  beep: (a, t, p, v) => {
    a.tone({ t, f0: 880 * p, dur: 0.08, type: 'square', vol: 0.07 * v, filter: 3000 });
    a.tone({ t: t + 0.1, f0: 1320 * p, dur: 0.08, type: 'square', vol: 0.07 * v, filter: 3000 });
  },
  chime: (a, t, p, v) => {
    [0, 7, 12, 19].forEach((semi, i) => a.tone({ t: t + i * 0.06, f0: 1046 * p * 2 ** (semi / 12), dur: 0.5, type: 'sine', vol: 0.1 * v }));
  },
  rumble: (a, t, p, v) => {
    a.noise({ t, dur: 0.8, freq: 220 * p, q: 0.7, vol: 0.45 * v, type: 'lowpass', attack: 0.08 });
    a.tone({ t, f0: 55 * p, f1: 70 * p, dur: 0.8, type: 'sawtooth', vol: 0.1 * v, filter: 300 });
  },
  quack: (a, t, p, v) => {
    a.tone({ t, f0: 700 * p, f1: 420 * p, dur: 0.16, type: 'sawtooth', vol: 0.12 * v, filter: 1500 });
  },
  ribbit: (a, t, p, v) => {
    for (let i = 0; i < 2; i++) a.tone({ t: t + i * 0.12, f0: 300 * p, f1: 180 * p, dur: 0.09, type: 'square', vol: 0.08 * v, filter: 1100, vibrato: 60 });
  },
  buzz: (a, t, p, v) => {
    a.tone({ t, f0: 210 * p, f1: 230 * p, dur: 0.5, type: 'sawtooth', vol: 0.05 * v, filter: 1200, vibrato: 40 });
  },
  freeze: (a, t, p, v) => {
    a.noise({ t, dur: 0.5, freq: 7000 * p, q: 3, vol: 0.2 * v, type: 'highpass' });
    [0, 3, 7].forEach((semi, i) => a.tone({ t: t + i * 0.05, f0: 1760 * p * 2 ** (semi / 12), dur: 0.35, type: 'sine', vol: 0.07 * v }));
  },
  oink: (a, t, p, v) => {
    for (let i = 0; i < 2; i++) a.tone({ t: t + i * 0.15, f0: 280 * p, f1: 220 * p, dur: 0.1, type: 'sawtooth', vol: 0.12 * v, filter: 900 });
  },
  engine: (a, t, p, v) => {
    a.tone({ t, f0: 70 * p, f1: 110 * p, dur: 0.5, type: 'sawtooth', vol: 0.12 * v, filter: 500 });
    a.noise({ t, dur: 0.5, freq: 300 * p, q: 1, vol: 0.15 * v });
  },
};

interface ToneOpts {
  t: number;
  f0: number;
  f1?: number;
  dur: number;
  type: OscillatorType;
  vol: number;
  vibrato?: number;
  filter?: number;
}

interface NoiseOpts {
  t: number;
  dur: number;
  freq: number;
  freqEnd?: number;
  q: number;
  vol: number;
  attack?: number;
  type?: BiquadFilterType;
}

class Synth {
  constructor(readonly ctx: AudioContext, readonly out: AudioNode, readonly noiseBuf: AudioBuffer) {}

  tone(o: ToneOpts) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, o.t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), o.t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), o.t + Math.min(0.01, o.dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      osc.connect(f);
      node = f;
    }
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibrato;
      lg.gain.value = o.f0 * 0.15;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(o.t);
      lfo.stop(o.t + o.dur + 0.05);
    }
    node.connect(g).connect(this.out);
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.05);
  }

  noise(o: NoiseOpts) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq, o.t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
    f.Q.value = o.q;
    const g = ctx.createGain();
    const attack = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), o.t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(o.t, Math.random());
    src.stop(o.t + o.dur + 0.05);
  }
}

export class Audio {
  private synth: Synth | null = null;
  private master: GainNode | null = null;
  private lastPlayed = new Map<SoundName, number>();
  muted = false;

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock(): void {
    if (this.synth) {
      void this.synth.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx: AudioContext = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(comp);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.synth = new Synth(ctx, this.master, buf);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }

  play(name: SoundName, opts: PlayOpts = {}): void {
    const s = this.synth;
    if (!s || this.muted || s.ctx.state !== 'running') return;
    const now = s.ctx.currentTime;
    // throttle identical sounds so chain reactions don't clip
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.04) return;
    this.lastPlayed.set(name, now);
    const pitch = (opts.pitch ?? 1) * (0.95 + Math.random() * 0.1);
    SOUNDS[name](s, now + 0.005, pitch, opts.volume ?? 1);
  }
}
