#!/usr/bin/env python3
"""Synthesizes the trailer's score and sound effects (numpy + scipy only) and writes a 44.1 kHz stereo WAV.
   python3 tools/trailer/music.py out.wav
Everything is generated from scratch, so there is nothing to license."""
import sys, wave
import numpy as np
from scipy import signal

SR = 44100
from edit import TOTAL
BEAT = 0.5
rng = np.random.default_rng(7)
N = int(TOTAL * SR)
L = np.zeros(N); R = np.zeros(N)           # dry bus
WL = np.zeros(N); WR = np.zeros(N)         # reverb send bus

def hz(note):  # MIDI -> Hz
    return 440.0 * 2 ** ((note - 69) / 12)

def add(buf_l, buf_r, x, t, gain=1.0, pan=0.0, send=0.0):
    i = int(t * SR)
    if i >= N or i + len(x) <= 0: return
    a = max(0, -i); i = max(0, i); x = x[a:]
    n = min(len(x), N - i); x = x[:n]
    gl = gain * np.sqrt(0.5 * (1 - pan)); gr = gain * np.sqrt(0.5 * (1 + pan))
    L[i:i+n] += x * gl; R[i:i+n] += x * gr
    if send:
        WL[i:i+n] += x * gl * send; WR[i:i+n] += x * gr * send

def put(x, t, gain=1.0, pan=0.0, send=0.0): add(L, R, x, t, gain, pan, send)

def tt(d): return np.arange(int(d * SR)) / SR
def env_ad(d, a, dec):
    t = tt(d); e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / dec); return e
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)
def bp(x, f0, f1, order=2): return signal.sosfilt(signal.butter(order, [f0, f1], 'band', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def saw(f, d, detune=0.0):
    t = tt(d); ph = np.cumsum(np.full_like(t, f * (1 + detune))) / SR; return 2 * (ph % 1) - 1
def sine(f, d): return np.sin(2 * np.pi * np.cumsum(np.full(int(d * SR), f)) / SR)
def sweep(f0, f1, d, curve=3):
    t = tt(d); u = t / d; f = f1 + (f0 - f1) * np.exp(-curve * u) if f0 > f1 else f0 + (f1 - f0) * (u ** curve)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)

# ---------- one-shots ----------
def kick(power=1.0):
    d = 0.45; x = sweep(150, 42, d, 14) * env_ad(d, 0.001, 0.16)
    click = hp(noise(0.02), 2000) * np.exp(-tt(0.02) / 0.004) * 0.25
    x[:len(click)] += click; return np.tanh(x * 1.6 * power) * 0.9
def snare(power=1.0):
    d = 0.3; n = hp(noise(d), 1200) * env_ad(d, 0.001, 0.07); b = sine(190, d) * env_ad(d, 0.001, 0.05) * 0.5
    return (n * 0.9 + b) * power
def clap(power=1.0):
    d = 0.35; n = bp(noise(d), 900, 4500); e = np.zeros_like(n)
    for k, off in enumerate([0, 0.012, 0.024, 0.038]): 
        i = int(off * SR); e[i:] += np.exp(-tt(d)[:len(e)-i] / (0.01 if k < 3 else 0.09))
    return n * e * 0.8 * power
def hat(open_=False, power=1.0):
    d = 0.25 if open_ else 0.05; return hp(noise(d), 7000, 3) * env_ad(d, 0.001, 0.09 if open_ else 0.012) * 0.35 * power
def boom(d=3.0, power=1.0):
    x = sweep(110, 28, d, 4) * env_ad(d, 0.003, 0.9)
    crack = hp(noise(0.4), 300) * env_ad(0.4, 0.001, 0.07) * 0.9
    rumble = lp(noise(d), 160, 3) * env_ad(d, 0.01, 0.8) * 1.6
    x = x * 1.1 + rumble; x[:len(crack)] += crack
    return np.tanh(x * 1.3 * power) * 0.95
def whoosh(d, peak=0.8):  # noise swell that peaks near the end
    t = tt(d); u = t / d; n = noise(d); f0 = 400 + 6000 * u ** 2
    out = np.zeros_like(n); blk = 2048
    for i in range(0, len(n), blk):
        f = min(12000, f0[min(i, len(f0) - 1)]); seg = n[i:i + blk]
        out[i:i + blk] = signal.sosfilt(signal.butter(2, [max(200, f * 0.5), min(18000, f * 1.2)], 'band', fs=SR, output='sos'), seg)
    return out * (u ** 2.2) * (1 - 0.7 * (u > peak) * ((u - peak) / (1 - peak))) * 0.6
def riser(d):
    t = tt(d); u = t / d; n = hp(noise(d), 500) * u ** 2.5 * 0.6
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1800 * u ** 2) / SR) * u ** 3 * 0.25
    return n + tone
def reverse_cymbal(d):
    x = hp(noise(d), 3000) * (tt(d) / d) ** 3; return x * 0.7
def pluck(f, d=0.35, bright=3500):
    x = (saw(f, d) + 0.6 * saw(f * 2.003, d)) * env_ad(d, 0.002, 0.12); return lp(x, bright) * 0.5
def bell(f, d=1.2):
    t = tt(d); x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (d * k)) for a, r, k in [(1, 1, .4), (.5, 2.76, .2), (.3, 5.4, .1)])
    return x * 0.35
def click(): return hp(noise(0.012), 3000) * np.exp(-tt(0.012) / 0.003) * 0.5
def pad(f, d, bright=1200, vol=1.0):
    x = sum(saw(f * r, d, det) for r, det in [(1, 0), (1, 0.004), (1, -0.004), (2, 0.002)]) * 0.25
    t = tt(d); x = x * np.minimum(1, t / 1.2) * np.minimum(1, (d - t) / 1.5)
    return lp(x, bright) * vol
def brass(f, d, vol=1.0):
    x = sum(saw(f, d, det) for det in (0, 0.003, -0.003)) * 0.33
    t = tt(d); e = np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.3)
    return lp(x, 2200 * 0.4 + 2500 * np.minimum(1, t[0] + 1)) * e * vol if False else lp(x, 2400) * e * vol

# ---------- arrangement ----------
# Section marks come from edit.py so the score always follows the cut.
from edit import MARK, TOTAL as EDIT_TOTAL
O = MARK['enter']; M0 = MARK['montage']; TNT = MARK['n-tnt']; TI = MARK['title']; G0 = MARK['world']
CH = MARK['c-demo']; K = MARK['climax2']; E = MARK['end']; PZ = MARK['p-bridge']

CHORDS = {  # name: (root midi bass, triad midi)
    'Am': (33, [57, 60, 64]), 'F': (29, [53, 57, 60]), 'C': (36, [60, 64, 67]), 'G': (31, [55, 59, 62]),
}
def chord_at(t):
    if t < TI: return 'Am'
    if t < E: return ['Am', 'F', 'C', 'G'][int((t - TI) // 4) % 4]
    return ['F', 'C', 'G', 'Am'][min(3, int((t - E) // 2))]

HITS = []  # impact times, for ducking the pad and the sub
def impact(t, p=1.0):
    HITS.append(t); put(boom(3.2, p), t, 1.0, 0, 0.35); put(kick(1.2), t, 0.9)
    put(hp(noise(1.6), 2500) * env_ad(1.6, 0.002, 0.5) * 0.35, t, 1.0, 0, 0.5)

# -- cold open: a drone, a heartbeat, typing, the cast
put(pad(hz(33), TI - 0.5, 500, 1.2), 0, 0.5, 0, 0.5)
put(pad(hz(45), TI - 2, 700, 0.8), 0, 0.35, 0.2, 0.6)
for k in range(8):
    t0 = 0.5 + k * 1.0
    if t0 < O - 0.1: put(kick(0.7), t0, 0.55); put(kick(0.5), t0 + 0.28, 0.35)
for t0 in np.linspace(0.45, 2.25, 19): put(click(), t0, 0.8, rng.uniform(-0.2, 0.2))
put(click(), O, 1.0); put(reverse_cymbal(1.4), O - 1.4, 0.6, 0, 0.3); put(riser(1.7), O - 1.7, 0.7, 0, 0.3)
impact(O, 1.0)
for k, n in enumerate([81, 84, 88, 93, 96]): put(bell(hz(n), 2.0), O + 0.05 + k * 0.1, 0.45, (k - 2) * 0.3, 0.6)
put(pad(hz(57), 5, 900, 1.0), O, 0.45, 0, 0.5)
put(whoosh(0.9), O + 0.5, 0.7)   # dragon takes off

# -- montage: drums enter on the first cut, one chime per cut
for k in range(int((TI - M0) / BEAT)):
    t0 = M0 + k * BEAT
    put(kick(1.0), t0, 0.85)
    if k % 2 == 1: put(clap(1.0), t0, 0.55, 0, 0.15); put(snare(0.8), t0, 0.35)
    put(hat(False, 0.8), t0 + 0.25, 0.6, 0.3)
    if k % 2 == 0: put(hat(True, 0.7), t0 + 0.25, 0.3, -0.3)
    put(lp(saw(hz(33), 0.45) * np.minimum(1, (0.45 - tt(0.45)) / 0.05), 220) * 0.7, t0 + 0.25, 0.5)
cuts = [M0 + 1.5 * i for i in range(4)] + [TNT]
for i, t0 in enumerate(cuts):
    put(whoosh(0.35), t0 - 0.33, 0.8)
    put(bell(hz([76, 79, 83, 88, 91][i]), 0.9), t0 + 0.02, 0.4, (i % 3 - 1) * 0.4, 0.5)
put(riser(2.0), TNT - 0.5, 0.7, 0, 0.3)
impact(TNT + 0.25, 1.1)
put(pad(hz(57), TI - M0, 1500, 1.0), M0, 0.3, 0, 0.4)

# -- title slam: brass chord, crash, logo pops
impact(TI, 1.2)
put(hp(noise(4), 4500) * env_ad(4, 0.005, 1.2) * 0.4, TI, 0.6, 0, 0.5)
for n, p in [(45, -0.3), (57, 0.0), (60, 0.2), (64, 0.3)]:
    put(brass(hz(n), 3.8), TI, 0.28, p, 0.5)
for k, t0 in enumerate(np.arange(TI + 0.25, TI + 2.0, 0.25)):   # letters popping in: sparkling arp
    put(bell(hz([81, 84, 88, 91, 93, 96, 100][k % 7]), 0.8), t0, 0.35, (k % 2 - 0.5), 0.6)
for k in range(1, 4): put(kick(1.0), TI + k * 1.0, 0.8)
for k in range(2): put(clap(1.0), TI + 1 + k * 2, 0.5, 0, 0.3)

# -- open world and the puzzle: full groove, arps, chord pads
for k in range(int((CH - G0) / BEAT)):
    t0 = G0 + k * BEAT
    put(kick(0.95), t0, 0.8)
    if k % 2 == 1: put(clap(0.9), t0, 0.45, 0, 0.2)
    put(hat(False, 0.7), t0 + 0.25, 0.5, 0.3)
    if k % 4 == 3: put(hat(True, 0.6), t0 + 0.25, 0.35, -0.3)
for ch_t in np.arange(TI, K + 3, 4):
    name = chord_at(ch_t + 0.01); root, tri = CHORDS[name]
    for n in tri: put(pad(hz(n), 4.4, 1400 if ch_t < CH else 2200, 1.0), ch_t, 0.18, rng.uniform(-0.4, 0.4), 0.5)
    put(pad(hz(root + 12), 4.4, 400, 1.2), ch_t, 0.45, 0, 0.3)
for k in range(int((K + 3.3 - TI) / (BEAT / 2))):             # 16th-note bass / arp pattern
    t0 = TI + k * BEAT / 2
    if t0 < G0: continue
    name = chord_at(t0); root, tri = CHORDS[name]
    if k % 2 == 0: put(lp(saw(hz(root), 0.22) * env_ad(0.22, 0.003, 0.2), 260) * 0.8, t0, 0.55)
    pat = [0, 2, 1, 2, 0, 2, 1, 2][k % 8]
    put(pluck(hz(tri[pat % 3] + 12 * (1 if t0 < CH else 2)), 0.3, 3200), t0, 0.22, np.sin(k) * 0.5, 0.5)
for t0 in (G0, PZ, MARK['p-tramp'], MARK['p-plank']): put(whoosh(0.5), t0 - 0.45, 0.6)

# -- chaos: snare roll, double-time hats, boom after boom
put(riser(3.5), CH - 3.5, 0.7, 0, 0.3); put(reverse_cymbal(2.0), CH - 2.0, 0.5)
for k in range(8): put(snare(0.8 + k * 0.05), CH - 2.0 + k * 0.25, 0.3 + 0.04 * k)
for k in range(int((K - CH) / (BEAT / 2))):
    put(hat(False, 0.8), CH + k * BEAT / 2, 0.45, 0.3 if k % 2 else -0.3)
for k in range(int((K - CH) / BEAT)):
    put(kick(1.1), CH + k * BEAT, 0.9)
    if k % 2: put(snare(1.0), CH + k * BEAT, 0.6); put(clap(1.0), CH + k * BEAT, 0.4)
impact(CH + 0.6, 0.9)
put(riser(2.9), K - 2.9, 0.8, 0, 0.3)
for k in range(10): put(snare(1.0 + k * 0.03), K - 1.6 + k * 0.1 * (1 - k * 0.04), 0.35 + 0.05 * k)
impact(K + 0.7, 1.3)
put(hp(noise(5), 3500) * env_ad(5, 0.005, 1.6) * 0.45, K + 0.7, 0.6, 0, 0.5)
impact(K + 2.0, 1.0)
for n, p in [(45, -0.3), (52, 0.0), (57, 0.0), (60, 0.2), (64, 0.3)]:
    put(brass(hz(n), 3.2), K + 0.7, 0.25, p, 0.5)
put(lp(noise(3.3), 400) * env_ad(3.3, 0.05, 1.5), K + 0.65, 0.8, 0, 0.3)   # rumble under the slow-mo

# -- the end card
put(boom(4.0, 0.7), E, 0.7, 0, 0.5)
for t0, name in [(E, 'F'), (E + 2, 'C'), (E + 4, 'G'), (E + 6, 'Am')]:
    root, tri = CHORDS[name]
    for n in tri: put(pad(hz(n), 3.2, 1800, 1.0), t0, 0.22, rng.uniform(-0.5, 0.5), 0.7)
    put(pad(hz(root + 12), 3.2, 500, 1.0), t0, 0.5, 0, 0.3)
mel = [(0.6, 81, 0.9), (1.1, 84, 0.9), (1.6, 88, 1.4), (3.0, 86, 0.9), (3.5, 84, 0.9), (4.0, 91, 1.4), (5.4, 88, 0.9), (5.9, 84, 0.9), (6.4, 81, 2.0)]
for t0, n, d in mel: put(bell(hz(n), d + 1.0), E + t0, 0.5, 0.1, 0.8)
for k in range(int(TOTAL - E)): put(lp(sine(hz(33), 1.0) * np.exp(-tt(1.0) / 0.5), 160), E + k * 1.0, 0.45)

# ---------- mix down ----------
# reverb: synthetic hall impulse
ir_n = int(2.6 * SR); t = np.arange(ir_n) / SR
ir = [lp(rng.standard_normal(ir_n), 6000) * np.exp(-t / 0.85) for _ in range(2)]
ir = [x / np.sqrt(np.sum(x ** 2)) for x in ir]
wl = signal.fftconvolve(WL, ir[0])[:N]; wr = signal.fftconvolve(WR, ir[1])[:N]
mixL = L + wl * 0.7; mixR = R + wr * 0.7
# sidechain-ish duck: pads breathe on every impact
duck = np.ones(N)
for h in HITS:
    i = int(h * SR); n = int(0.5 * SR)
    if i < N: duck[i:i + n] *= 1 - 0.35 * np.exp(-np.arange(min(n, N - i)) / (0.12 * SR))
mixL *= duck; mixR *= duck
fade = np.ones(N); fi = int(2.0 * SR); fade[-fi:] = np.linspace(1, 0, fi) ** 1.5
fadein = np.minimum(1, np.arange(N) / (0.5 * SR))
mixL *= fade * fadein; mixR *= fade * fadein
st = np.stack([mixL, mixR], 1)
# gentle bus compression via soft clipping, then peak-normalise to -1 dBFS
st = np.tanh(st / (np.percentile(np.abs(st), 99.5) * 1.1)) 
st *= 0.89 / np.max(np.abs(st))
pcm = (st * 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'trailer.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', sys.argv[1] if len(sys.argv) > 1 else 'trailer.wav', f'{TOTAL}s')
