#!/usr/bin/env python3
"""Renders the Android launcher icons from ../public/*.png into android-res/ (committed, so CI needs no image tools).
Usage: python3 make-android-res.py"""
from pathlib import Path
from PIL import Image

here = Path(__file__).parent
pub = here.parent / 'public'
out = here / 'android-res'
legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
foreground = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
icon = Image.open(pub / 'icon-512.png').convert('RGBA')
maskable = Image.open(pub / 'icon-maskable-512.png').convert('RGBA')
for d, size in legacy.items():
    folder = out / f'mipmap-{d}'
    folder.mkdir(parents=True, exist_ok=True)
    icon.resize((size, size), Image.LANCZOS).save(folder / 'ic_launcher.png')
    icon.resize((size, size), Image.LANCZOS).save(folder / 'ic_launcher_round.png')
    maskable.resize((foreground[d], foreground[d]), Image.LANCZOS).save(folder / 'ic_launcher_foreground.png')
print('wrote', out)
