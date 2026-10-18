# -*- coding: utf-8 -*-
"""
Иконки приложения в новой фирменной системе: чёрное поле, знак СВЕМА —
синий круг, белые массы, тонкий визир. Отдельно — vector-источник icon.svg.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image, ImageDraw

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'icons'))

BLACK = (0, 0, 0, 255)
BLUE = (21, 87, 200, 255)      # #1557C8 — экранный синий
WHITE = (255, 255, 255, 255)
SS = 4                          # супер-сэмплинг


def draw_mark(d, cx, cy, unit, ink=WHITE, blue=BLUE, cross=True):
    """Знак 18 x 15 модулей, центр (cx, cy). unit — размер модуля в px."""
    x0 = cx - 9 * unit
    y0 = cy - 7.5 * unit

    def R(mx, my, mw, mh):
        d.rectangle([x0 + mx * unit, y0 + my * unit,
                     x0 + (mx + mw) * unit, y0 + (my + mh) * unit], fill=ink)

    R(0, 0, 2, 16)              # колонна
    R(1.75, 12.16, 14.6, 1.96)  # горизонталь
    if cross:
        R(14.4, 14.62, 1.7, 5.1)          # правая опора
        d.line([x0 + 14.4 * unit, y0 - 1.5 * unit,
                x0 + 14.4 * unit, y0 + 12.16 * unit],
               fill=ink, width=max(1, int(0.13 * unit)))
        d.line([x0 + 9.9 * unit, y0 + 4.02 * unit,
                x0 + 18.6 * unit, y0 + 4.02 * unit],
               fill=ink, width=max(1, int(0.13 * unit)))
    r = 3.24 * unit
    d.ellipse([x0 + 9.5 * unit - r, y0 + 8.92 * unit - r,
               x0 + 9.5 * unit + r, y0 + 8.92 * unit + r], fill=blue)


def icon(size, bg=BLACK, radius_ratio=0.22, mark_ratio=0.62, cross=True, blue=BLUE):
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(S * 0.0)
    if radius_ratio > 0:
        d.rounded_rectangle([pad, pad, S - pad - 1, S - pad - 1],
                            radius=int(S * radius_ratio), fill=bg)
    else:
        d.rectangle([pad, pad, S - pad - 1, S - pad - 1], fill=bg)
    # знак: ширина 18 модулей = mark_ratio от стороны
    unit = S * mark_ratio / 18.0
    draw_mark(d, S / 2, S / 2, unit, ink=WHITE, blue=blue, cross=cross)
    return img.resize((size, size), Image.LANCZOS)


def svg_icon():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="СВЕМА ЛАБ">
  <title>СВЕМА ЛАБ — иконка приложения</title>
  <rect width="512" height="512" rx="113" fill="#000000"/>
  <g fill="#FFFFFF">
    <rect x="90.3" y="60.2" width="37.2" height="297.5"/>
    <rect x="122.8" y="286.4" width="271.4" height="36.4"/>
    <rect x="358" y="332.1" width="31.6" height="94.8"/>
    <rect x="356.1" y="32.3" width="2.4" height="254.1"/>
    <rect x="274.4" y="134.9" width="161.8" height="2.4"/>
  </g>
  <circle cx="266.9" cy="226.1" r="60.2" fill="#1557C8"/>
</svg>
'''


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ('icon-192.png', 192, 0.22, 0.62, True, BLUE),
        ('icon-512.png', 512, 0.22, 0.62, True, BLUE),
        ('icon-maskable-512.png', 512, 0.0, 0.50, True, BLUE),
        ('apple-touch-icon.png', 180, 0.0, 0.60, False, (127, 163, 216, 255)),
    ]
    for name, size, radius, ratio, cross, blue in jobs:
        img = icon(size, radius_ratio=radius, mark_ratio=ratio, cross=cross, blue=blue)
        img.save(os.path.join(OUT, name))
        print('%-26s %d px' % (name, size))
    with open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_icon())
    print('%-26s вектор' % 'icon.svg')


if __name__ == '__main__':
    main()
