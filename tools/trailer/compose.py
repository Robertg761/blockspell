#!/usr/bin/env python3
"""Cuts the rendered shots together, adds titles/logo/flashes/fades, grades, and muxes the score.
   python3 tools/trailer/compose.py FRAMES_DIR LOGO_DIR AUDIO.wav OUT.mp4 [--seconds N] [--scale 1]
"""
import math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from edit import CLIPS, BLACK, ENDBG, FPS, MARK, TOTAL as _T, CLIMAX_END as _CE

args = [a for a in sys.argv[1:] if not a.startswith('--')]
FRAMES, LOGO, AUDIO, OUT = args[:4]
opts = dict(zip([a for a in sys.argv[1:] if a.startswith('--')], [None] * 9))
def opt(name, default):
    if name in sys.argv: return type(default)(sys.argv[sys.argv.index(name) + 1])
    return default
LIMIT = opt('--seconds', 0.0); SCALE = opt('--scale', 1.0)
W, H = int(1920 * SCALE), int(1080 * SCALE)

FD = '/usr/share/fonts/opentype/inter/'
def font(name, size): return ImageFont.truetype(FD + name, int(size * SCALE))
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'

# ---- timeline -------------------------------------------------------------------------------
timeline = [(MARK[shot], dur, shot, off) for shot, off, dur in CLIPS]
CLIMAX_END = _CE
END_START = MARK['end']
timeline.append((END_START, ENDBG[2], ENDBG[0], ENDBG[1]))
TOTAL = _T

def source_frame(f):
    ts = f / FPS
    for start, dur, shot, off in reversed(timeline):
        if ts >= start:
            idx = int(round((ts - start + off) * FPS))
            d = os.path.join(FRAMES, shot)
            n = len([x for x in os.listdir(d) if x.endswith('.jpg')])
            idx = min(idx, n - 1)
            return os.path.join(d, f'{idx:05d}.jpg') if ts < start + dur + 1e-6 else None
    return None
_counts = {}

# ---- text helpers ------------------------------------------------------------------------------
def tracked(draw, xy, text, fnt, fill, tracking=0, anchor_center=True, shadow=True):
    widths = [draw.textlength(c, font=fnt) for c in text]
    total = sum(widths) + tracking * SCALE * (len(text) - 1)
    x, y = xy
    if anchor_center: x -= total / 2
    if shadow:
        for dx, dy, a in ((0, 4, 120), (0, 8, 70)):
            cx = x
            for c, w in zip(text, widths):
                draw.text((cx + dx * SCALE, y + dy * SCALE), c, font=fnt, fill=(0, 0, 0, a)); cx += w + tracking * SCALE
    for c, w in zip(text, widths):
        draw.text((x, y), c, font=fnt, fill=fill); x += w + tracking * SCALE
    return total

def ease_out(u): return 1 - (1 - min(1, max(0, u))) ** 3
def win(t, a, b, fin=0.25, fout=0.3):  # 0..1 visibility
    if t < a or t > b: return 0.0
    return min(1.0, (t - a) / fin, (b - t) / fout)

M = MARK
def clip(shot, text, style='chip', pad=0.0):  # a caption that lives exactly as long as its clip
    d = {c[0]: c[2] for c in CLIPS}[shot]
    return (text, M[shot] + pad, M[shot] + d - 0.04, style)
CAPTIONS = [  # (text, a, b, style)
    ('WRITE A WORD.', 0.5, 2.6, 'big-top'),
    ('MAKE IT REAL.', 3.55, 5.0, 'big-top-slam'),
    clip('n-balloons', '3 rainbow balloons'), clip('n-dog', 'big dog'), clip('n-hotair', 'giant hot air balloon'),
    clip('n-snow', 'giant snowman'), clip('m-tnt', 'flaming giant tnt'),
    ('AN OPEN WORLD  ·  FULLY OFFLINE', M['world'] + 0.25, M['world'] + 2.9, 'mid'),
    ('ONE PUZZLE. YOUR ANSWER.', M['p-bridge'] + 0.2, M['p-plank'] + 2.4, 'mid'),
    clip('p-bridge', 'big bridge', pad=0.9), clip('p-tramp', 'trampoline', pad=0.7), clip('p-plank', 'big plank', pad=0.6),
    ('REAL PHYSICS. REAL CHAOS.', M['c-demo'] + 0.2, M['c-bounce'] + 1.9, 'mid'),
    ('WHAT WILL YOU WRITE?', M['climax'] + 2.9, M['climax'] + 4.7, 'mid'),
]
FLASHES = [(2.8, 0.35, 0.25), (M['m-tnt'] + 0.25, 0.5, 0.3), (M['title'], 0.8, 0.45), (M['c-demo'] + 0.6, 0.45, 0.3), (M['climax'] + 0.65, 0.95, 0.6), (M['climax'] + 2.4, 0.4, 0.3)]
SHAKES = [(2.8, 14), (M['title'], 22), (M['climax'] + 0.65, 28), (M['m-tnt'] + 0.25, 8), (M['c-demo'] + 0.6, 10), (M['climax'] + 2.4, 14)]
TI0, TI1 = M['title'], M['world']

def logo_frame(k):
    k = max(0, min(k, len([x for x in os.listdir(LOGO) if x.endswith('.png')]) - 1))
    return Image.open(os.path.join(LOGO, f'{k:05d}.png')).convert('RGBA')

def draw_logo(img, k, cx, cy, width, alpha=1.0):
    lg = logo_frame(k).crop((340, 280, 1580, 800))  # tight box around the letters
    s = width / lg.width
    lg = lg.resize((int(lg.width * s), int(lg.height * s)), Image.LANCZOS)
    a = lg.getchannel('A')
    glow = Image.new('RGBA', lg.size, (0, 0, 0, 0)); glow.putalpha(a.point(lambda v: int(v * 0.55 * alpha)))
    pad = int(60 * SCALE)
    big = Image.new('RGBA', (lg.width + 2 * pad, lg.height + 2 * pad), (0, 0, 0, 0)); big.paste(glow, (pad, pad))
    big = big.filter(ImageFilter.GaussianBlur(24 * SCALE))
    x, y = int(cx - big.width / 2), int(cy - big.height / 2)
    img.alpha_composite(big, (x, y))
    if alpha < 1: lg.putalpha(a.point(lambda v: int(v * alpha)))
    img.alpha_composite(lg, (int(cx - lg.width / 2), int(cy - lg.height / 2)))

def vignette_mask():
    yy, xx = np.mgrid[0:H, 0:W]; d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    return np.clip(1 - 0.22 * d ** 2, 0.5, 1).astype(np.float32)[..., None]
VIG = vignette_mask()

def render(f):
    ts = f / FPS
    path = source_frame(f)
    if path is None: base = Image.new('RGB', (W, H), (0, 0, 0))
    else:
        base = Image.open(path).convert('RGB')
        if base.size != (W, H): base = base.resize((W, H), Image.LANCZOS)
    # impact shake: zoom a touch and wobble
    amp = sum(a * math.exp(-(ts - h) / 0.22) for h, a in SHAKES if ts >= h) * SCALE
    if amp > 0.5:
        ox, oy = amp * math.sin(ts * 83), amp * math.cos(ts * 97)
        z = 1 + amp / 900
        base = base.transform((W, H), Image.AFFINE, (1 / z, 0, W / 2 * (1 - 1 / z) - ox, 0, 1 / z, H / 2 * (1 - 1 / z) - oy), Image.BICUBIC)
    arr = np.asarray(base, dtype=np.float32) / 255.0
    # darken under the title / end card so text and logo read
    dim = 0.0
    if TI0 <= ts < TI1: dim = 0.38 * min(1, (ts - TI0) / 0.4) * min(1, (TI1 - ts) / 0.5)
    if ts >= END_START: dim = 0.55 * min(1, (ts - END_START) / 1.2)
    if dim: arr = arr * (1 - dim)
    sv = max([win(ts, a, b) for _, a, b, st in CAPTIONS if st != 'chip'] + [0])
    if sv > 0:  # soft dark band behind headline captions so they read over bright skies
        yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
        arr = arr * (1 - 0.5 * sv * np.clip(1 - yy / 0.34, 0, 1) ** 1.5)
    for h, strength, dec in FLASHES:
        if ts >= h: arr = arr + (1 - arr) * strength * math.exp(-(ts - h) / dec)
    # fades to / from black
    k = 1.0
    if ts < 0.8: k = min(k, ts / 0.8)
    if CLIMAX_END - 0.7 <= ts < CLIMAX_END: k = min(k, (CLIMAX_END - ts) / 0.7)
    if CLIMAX_END <= ts < END_START: k = 0.0
    if ts >= END_START: k = min(k, (ts - END_START) / 1.0)
    if ts > TOTAL - 1.8: k = min(k, (TOTAL - ts) / 1.8)
    arr = np.clip(arr, 0, 1) * k
    img = Image.fromarray((arr * 255).astype(np.uint8)).convert('RGBA')
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for text, a, b, style in CAPTIONS:
        v = win(ts, a, b)
        if v <= 0: continue
        if style.startswith('big'):
            fnt = font('Inter-ExtraBold.otf', 104)
            scale = 1.0 + (0.18 * (1 - ease_out((ts - a) / 0.18)) if 'slam' in style else 0)
            if scale != 1.0: fnt = font('Inter-ExtraBold.otf', 104 * scale)
            tracked(d, (W / 2, H * 0.14), text, fnt, (255, 255, 255, int(255 * v)), 14)
        elif style == 'mid':
            fnt = font('Inter-ExtraBold.otf', 58)
            w = tracked(d, (W / 2, H * 0.115), text, fnt, (255, 255, 255, int(255 * v)), 9)
            d.rectangle((W / 2 - 60 * SCALE, H * 0.115 + 82 * SCALE, W / 2 + 60 * SCALE, H * 0.115 + 88 * SCALE), fill=(255, 176, 46, int(255 * v)))
        elif style == 'chip':
            fnt = ImageFont.truetype(MONO, int(44 * SCALE))
            label = '✦ ' + text
            tw = d.textlength(label, font=fnt); px, py = 34 * SCALE, 22 * SCALE
            x0, y0 = 90 * SCALE, H - 190 * SCALE
            slide = (1 - ease_out((ts - a) / 0.2)) * 30 * SCALE
            d.rounded_rectangle((x0 - slide, y0, x0 + tw + 2 * px - slide, y0 + 44 * SCALE + 2 * py + 8 * SCALE), 18 * SCALE, fill=(14, 18, 34, int(200 * v)), outline=(255, 176, 46, int(255 * v)), width=int(3 * SCALE))
            d.text((x0 + px - slide, y0 + py), label, font=fnt, fill=(255, 244, 214, int(255 * v)))
    # title card: logo + tagline
    if TI0 <= ts < TI1:
        v = min(1, (TI1 - ts) / 0.4)
        draw_logo(ov, int((ts - TI0) * FPS), W / 2, H * 0.43, 1180 * SCALE, v)
        tv = win(ts, TI0 + 1.7, TI1, 0.4, 0.4)
        if tv > 0: tracked(d, (W / 2, H * 0.67), 'A VOXEL SANDBOX RUN ON WORDS', font('Inter-ExtraBold.otf', 46), (255, 214, 120, int(255 * tv)), 10)
    # end card
    if ts >= END_START + 0.4:
        u = ts - END_START
        lv = min(1, (u - 0.4) / 0.6)
        draw_logo(ov, int((u - 0.4) * FPS), W / 2, H * 0.34, 980 * SCALE, lv)
        for text, a, fnt, y, col, tr in [
            ('WRITE A WORD. MAKE IT REAL.', 1.5, font('Inter-ExtraBold.otf', 56), 0.54, (255, 255, 255), 10),
            ('BUILT FOR HACKYARD #6  ·  THEME: OFFLINE', 2.2, font('Inter-Bold.otf', 36), 0.63, (255, 176, 46), 7),
            ('Open it once. Then play anywhere, no internet needed.', 2.9, font('Inter-Medium.otf', 34), 0.71, (225, 230, 245), 1),
            ('Install it on your phone or computer. No tracking.', 3.4, font('Inter-Medium.otf', 34), 0.77, (225, 230, 245), 1),
            ('github.com/Robertg761/blockspell', 3.9, ImageFont.truetype(MONO, int(32 * SCALE)), 0.85, (160, 190, 255), 1),
        ]:
            v = min(1, max(0, (u - a) / 0.6)) * min(1, (TOTAL - ts) / 1.5)
            if v > 0: tracked(d, (W / 2, H * y + (1 - v) * 14 * SCALE), text, fnt, col + (int(255 * v),), tr)
    img.alpha_composite(ov)
    out = np.asarray(img.convert('RGB'), dtype=np.float32) * VIG
    return np.clip(out, 0, 255).astype(np.uint8)

nframes = int((LIMIT or TOTAL) * FPS)
vf = 'eq=contrast=1.07:saturation=1.15:gamma=0.97,noise=alls=5:allf=t,unsharp=5:5:0.5'
cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
       '-i', AUDIO, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
       '-c:a', 'aac', '-b:a', '256k', '-frames:v', str(nframes), '-shortest', OUT]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for f in range(nframes):
    p.stdin.write(render(f).tobytes())
    if f % 48 == 0: print(f, '/', nframes, flush=True)
p.stdin.close(); p.wait()
print('wrote', OUT)
