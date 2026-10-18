# -*- coding: utf-8 -*-
"""
Экспорт логотипа СВЕМА ЛАБ в SVG из той же модели, что и брендбук:
геометрия знака и метрики текста берутся из engine/pdfwriter, поэтому
SVG и PDF совпадают до знака после запятой.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdfwriter import TTF, FontResource, PDF
from engine import F_DISPLAY, F_TEXT

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

FONT_STACK = "'Arial Black', 'Arial Bold', Arial, sans-serif"


def mark_svg(ink='#141414', blue='#0A4AA8', mono=False):
    """Знак: 18 x 15 модулей."""
    seg = []
    seg.append('<rect x="0" y="0" width="2" height="16" fill="%s"/>' % ink)
    seg.append('<rect x="1.75" y="12.16" width="14.6" height="1.96" fill="%s"/>' % ink)
    seg.append('<rect x="14.4" y="14.62" width="1.7" height="5.1" fill="%s"/>' % ink)
    if mono:
        seg.append('<circle cx="9.5" cy="8.92" r="3.24" fill="none" stroke="%s" '
                   'stroke-width="0.9"/>' % ink)
    else:
        seg.append('<circle cx="9.5" cy="8.92" r="3.24" fill="%s"/>' % blue)
    seg.append('<line x1="14.4" y1="-1.5" x2="14.4" y2="12.16" stroke="%s" '
               'stroke-width="0.13"/>' % ink)
    seg.append('<line x1="9.9" y1="4.02" x2="18.6" y2="4.02" stroke="%s" '
               'stroke-width="0.13"/>' % ink)
    return '\n  '.join(seg)


def make_files(font_pdf):
    """Ширина текста считается тем же шрифтом, что и в PDF."""
    fd = FontResource('FD', F_DISPLAY, font_pdf)
    s1, s2 = 'СВЕМА', 'ЛАБ'
    w1 = fd.width(s1, 7.0) + 0.02 * 7.0 * (len(s1) - 1)
    w2 = fd.width(s2, 6.1) + 0.066 * 6.1 * (len(s2) - 1)
    # сцепка: высота 30 ед., знак 18 ед. по ширине
    files = {}

    files['mark-svema.svg'] = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 15" '
        'width="1800" height="1500" role="img" aria-label="СВЕМА ЛАБ">\n'
        '  <title>СВЕМА ЛАБ — знак</title>\n  %s\n</svg>\n' % mark_svg())

    files['mark-mono.svg'] = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 15" '
        'width="1800" height="1500" role="img" aria-label="СВЕМА ЛАБ, монохром">\n'
        '  <title>СВЕМА ЛАБ — знак, монохром</title>\n  %s\n</svg>\n'
        % mark_svg(mono=True))

    # инверсия для тёмного фона
    files['mark-white.svg'] = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 15" '
        'width="1800" height="1500" role="img" aria-label="СВЕМА ЛАБ, инверсия">\n'
        '  <title>СВЕМА ЛАБ — знак, инверсия</title>\n  %s\n</svg>\n'
        % mark_svg(ink='#FFFFFF', blue='#1557C8'))

    # основной логотип: знак + сцепка, высота 30 единиц модели
    files['logo-svema-lab.svg'] = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 30.6" '
        'width="1800" height="3060" role="img" aria-label="СВЕМА ЛАБ">\n'
        '  <title>СВЕМА ЛАБ — основной логотип</title>\n  %s\n'
        '  <g fill="#141414" font-family="%s" font-weight="900">\n'
        '    <text x="0.4" y="24.9" font-size="7" letter-spacing="0.14" '
        'textLength="%.3f" lengthAdjust="spacingAndGlyphs">СВЕМА</text>\n'
        '    <text x="0.4" y="30.7" font-size="6.1" letter-spacing="0.40" '
        'textLength="%.3f" lengthAdjust="spacingAndGlyphs">ЛАБ</text>\n'
        '  </g>\n</svg>\n'
        % (mark_svg(), FONT_STACK, w1, w2))

    files['logo-white.svg'] = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 30.6" '
        'width="1800" height="3060" role="img" aria-label="СВЕМА ЛАБ, инверсия">\n'
        '  <title>СВЕМА ЛАБ — логотип, инверсия</title>\n  %s\n'
        '  <g fill="#FFFFFF" font-family="%s" font-weight="900">\n'
        '    <text x="0.4" y="24.9" font-size="7" letter-spacing="0.14" '
        'textLength="%.3f" lengthAdjust="spacingAndGlyphs">СВЕМА</text>\n'
        '    <text x="0.4" y="30.7" font-size="6.1" letter-spacing="0.40" '
        'textLength="%.3f" lengthAdjust="spacingAndGlyphs">ЛАБ</text>\n'
        '  </g>\n</svg>\n'
        % (mark_svg(ink='#FFFFFF', blue='#1557C8'), FONT_STACK, w1, w2))
    return files


def main():
    pdf = PDF()
    files = make_files(pdf)
    written = []
    for name, content in files.items():
        path = os.path.join(OUT, name)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        written.append((name, len(content)))
    for name, n in written:
        print('%-24s %6d байт' % (name, n))
    return written


if __name__ == '__main__':
    main()
