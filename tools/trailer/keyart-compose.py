#!/usr/bin/env python3
"""Composites the logo and tagline onto a keyart.mjs render.
   python3 tools/trailer/keyart-compose.py BASE.png LOGO_FRAME.png OUT_PREFIX
Writes OUT_PREFIX-1920x1080.png, OUT_PREFIX-1280x720.jpg and OUT_PREFIX-square-1080.png"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

base_path, logo_path, out = sys.argv[1:4]
FD = '/usr/share/fonts/opentype/inter/'
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'

def tracked(d, xy, text, fnt, fill, tr=0, shadow=True):
    ws = [d.textlength(c, font=fnt) for c in text]
    total = sum(ws) + tr * (len(text) - 1); x, y = xy; x -= total / 2
    if shadow:
        for dy, a in ((4, 130), (9, 70)):
            cx = x
            for c, w in zip(text, ws): d.text((cx, y + dy), c, font=fnt, fill=(0, 0, 0, a)); cx += w + tr
    for c, w in zip(text, ws): d.text((x, y), c, font=fnt, fill=fill); x += w + tr

def logo_on(img, cx, cy, width):
    lg = Image.open(logo_path).convert('RGBA').crop((340, 280, 1580, 800))
    s = width / lg.width; lg = lg.resize((int(lg.width * s), int(lg.height * s)), Image.LANCZOS)
    a = lg.getchannel('A'); pad = 80
    glow = Image.new('RGBA', (lg.width + 2 * pad, lg.height + 2 * pad), (0, 0, 0, 0))
    g1 = Image.new('RGBA', lg.size, (20, 8, 40, 0)); g1.putalpha(a.point(lambda v: int(v * 0.7))); glow.paste(g1, (pad, pad))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    img.alpha_composite(glow, (int(cx - glow.width / 2), int(cy - glow.height / 2)))
    img.alpha_composite(lg, (int(cx - lg.width / 2), int(cy - lg.height / 2)))

def layout(base, W, H):
    img = base.copy().convert('RGBA')
    # darken the top and bottom a little so the type pops
    arr = np.asarray(img.convert('RGB'), dtype=np.float32) / 255
    yy = np.linspace(0, 1, H)[:, None, None]
    shade = 1 - 0.38 * np.clip(1 - yy / 0.55, 0, 1) ** 1.6 - 0.35 * np.clip((yy - 0.72) / 0.28, 0, 1) ** 1.4
    yy2, xx2 = np.mgrid[0:H, 0:W]
    vig = 1 - 0.28 * (((xx2 - W / 2) / (W / 2)) ** 2 + ((yy2 - H / 2) / (H / 2)) ** 2)[..., None]
    img = Image.fromarray((np.clip(arr * shade * vig, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    u = H / 1080
    logo_on(ov, W / 2, H * 0.215, min(W * 0.84, 930 * u))
    tracked(d, (W / 2, H * 0.405), 'WRITE A WORD. MAKE IT REAL.', ImageFont.truetype(FD + 'Inter-ExtraBold.otf', int(max(26, 46 * u))), (255, 255, 255, 255), 8 * u)
    badge = 'HACKYARD #6  ·  THEME: OFFLINE'
    f = ImageFont.truetype(FD + 'Inter-ExtraBold.otf', int(34 * u)); tw = d.textlength(badge, font=f) + 8 * u * len(badge) * 0.35
    bw, bh = tw + 80 * u, 78 * u; x0, y0 = (W / 2 - bw / 2) if W < H * 1.2 else 70 * u, H * 0.93 - bh / 2
    d.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), bh / 2, fill=(255, 176, 46, 255))
    tracked(d, (x0 + bw / 2, y0 + bh / 2 - 21 * u), badge, f, (36, 22, 8, 255), 5 * u, shadow=False)
    img.alpha_composite(ov)
    return img.convert('RGB')

base = Image.open(base_path).convert('RGB')
big = layout(base, 1920, 1080)
big.save(f'{out}-1920x1080.png')
big.resize((1280, 720), Image.LANCZOS).save(f'{out}-1280x720.jpg', quality=93)
sq = base.crop((640, 0, 1720, 1080))
layout(sq, 1080, 1080).save(f'{out}-square-1080.png')
print('ok')
