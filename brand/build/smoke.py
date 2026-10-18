# -*- coding: utf-8 -*-
"""Проверка: PDF собирается, кириллица встраивается, текст извлекается."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdfwriter import PDF, FontResource

FONTS = r'C:\Windows\Fonts'
HEAD = '''q 1 1 1 rg 0 0 595 842 re f Q
0 0 0 rg
q 0.80 0.05 0.10 rg
BT /F1 40 Tf 40 700 Td (СВЕМА ЛАБ) Tj ET
Q
q 0.039 0.29 0.66 rg
BT /F1 40 Tf 40 640 Td (СВЕМА ЛАБ) Tj ET
Q
q 0 0 0 rg
BT /F1 18 Tf 40 580 Td (Фото · Видео · Эксперименты) Tj ET
BT /F2 18 Tf 40 540 Td (Основной логотип — проверка, 2025) Tj ET
'''

pdf = PDF()
f1 = FontResource('F1', os.path.join(FONTS, 'ariblk.ttf'), pdf)
f2 = FontResource('F2', os.path.join(FONTS, 'segoeui.ttf'), pdf)
h1 = f1.hex_string('СВЕМА ЛАБ')
h2 = f2.hex_string('Фото · Видео · Эксперименты')
h3 = f2.hex_string('Основной логотип — проверка, 2025')
content = (HEAD.replace('(СВЕМА ЛАБ)', h1)
                .replace('(Фото · Видео · Эксперименты)', h2)
                .replace('(Основной логотип — проверка, 2025)', h3)).encode('latin-1')
r1 = f1.emit()
r2 = f2.emit()
res = b'<< /Font << /F1 %d 0 R /F2 %d 0 R >> >>' % (r1, r2)
pdf.add_page(content, res)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'smoke.pdf')
size = pdf.save(out, 'smoke test')
print('written', out, size, 'bytes')

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None
if PdfReader:
    r = PdfReader(out)
    print('pages', len(r.pages))
    print('text:', repr(r.pages[0].extract_text()[:120]))
else:
    print('pypdf недоступен')
