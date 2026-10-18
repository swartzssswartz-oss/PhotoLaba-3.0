# -*- coding: utf-8 -*-
"""Рендер PDF в PNG для визуальной проверки вёрстки."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdfraster import Doc, render_page, save_png

def main():
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    only = [int(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 and sys.argv[4] else None
    os.makedirs(out_dir, exist_ok=True)
    doc = Doc(pdf_path)
    pages = doc.pages()
    print('страниц:', len(pages))
    for i, p in enumerate(pages, 1):
        if only and i not in only:
            continue
        img = render_page(doc, p, dpi=dpi)
        out = os.path.join(out_dir, 'page-%02d.png' % i)
        save_png(img, out)
        print('ok', os.path.basename(out), img.shape)

if __name__ == '__main__':
    main()
