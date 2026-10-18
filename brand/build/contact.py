# -*- coding: utf-8 -*-
"""Рендер страниц PDF в PNG и сборка контрольных листов."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdfraster import Doc, render_page, save_png


def main():
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 60
    cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4
    os.makedirs(out_dir, exist_ok=True)
    from PIL import Image
    doc = Doc(pdf_path)
    pages = doc.pages()
    imgs = []
    for i, p in enumerate(pages, 1):
        img = render_page(doc, p, dpi=dpi)
        arr = (img * 255 + 0.5).clip(0, 255).astype('uint8')
        im = Image.fromarray(arr)
        im.save(os.path.join(out_dir, 'page-%02d.png' % i))
        imgs.append(im)
        print('page %02d ok' % i, flush=True)
    w, h = imgs[0].size
    gap = 12
    rows = cols
    per = cols * rows
    for s in range(0, len(imgs), per):
        chunk = imgs[s:s + per]
        sw = cols * w + (cols + 1) * gap
        sh = rows * h + (rows + 1) * gap
        sheet = Image.new('RGB', (sw, sh), (168, 168, 168))
        for k, im in enumerate(chunk):
            r, c = divmod(k, cols)
            sheet.paste(im, (gap + c * (w + gap), gap + r * (h + gap)))
        name = os.path.join(out_dir, 'sheet-%d.png' % (s // per + 1))
        sheet.save(name)
        print('sheet', name, sheet.size)


if __name__ == '__main__':
    main()
