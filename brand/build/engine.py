# -*- coding: utf-8 -*-
"""
Движок вёрстки брендбука: системы координат, палитра, типографика, логотип.
Координаты страницы — в пунктах (1 pt = 1/72"), начало в левом верхнем углу.
"""

import os

PT = 72.0 / 25.4                     # мм -> пункты
A4_W, A4_H = 210 * PT, 297 * PT      # 595.276 x 841.89

# ---------------------------------------------------------------- палитра
BLUE = (0.0392, 0.2902, 0.6588)        # #0A4AA8  — снят с исходного логотипа
BLUE_BRIGHT = (0.0824, 0.3412, 0.7843)  # #1557C8  — экранный вариант
BLUE_LIGHT = (0.4980, 0.6392, 0.8471)   # #7FA3D8
BLUE_20 = (0.7804, 0.8392, 0.9255)      # #C7D6EC
BLUE_10 = (0.8902, 0.9176, 0.9647)      # #E3EAF6
BLUE_05 = (0.9451, 0.9608, 0.9843)      # #F1F5FB
BLUE_DARK = (0.0275, 0.1843, 0.4235)    # #072F6C
INK = (0.0784, 0.0784, 0.0784)          # #141414
INK_SOFT = (0.2314, 0.2314, 0.2314)     # #3B3B3B
GREY = (0.4784, 0.4706, 0.4510)         # #7A7873
GREY_LINE = (0.8510, 0.8392, 0.8078)    # #D9D6CE
PAPER = (0.8980, 0.8902, 0.8667)        # #E5E3DD  — снят с исходного логотипа
PAPER_DOC = (0.9686, 0.9647, 0.9529)    # #F7F6F3
WHITE = (1.0, 1.0, 1.0)

# ---------------------------------------------------------------- метрики
MARGIN = 24 * PT
FOOT_H = 40 * PT
CONTENT_H = A4_H - 2 * MARGIN - FOOT_H

FONTS_DIR = r'C:\Windows\Fonts'
F_DISPLAY = os.path.join(FONTS_DIR, 'ariblk.ttf')     # Arial Black
F_TEXT = os.path.join(FONTS_DIR, 'segoeui.ttf')       # Segoe UI
F_TEXT_B = os.path.join(FONTS_DIR, 'segoeuib.ttf')    # Segoe UI Bold
F_MONO = os.path.join(FONTS_DIR, 'consola.ttf')       # Consolas


class Engine:
    def __init__(self, pdf, save_png=None, dpi=110):
        from pdfwriter import FontResource
        self.pdf = pdf
        self.dpi = dpi
        self.save_png = save_png
        self.f_display = FontResource('FD', F_DISPLAY, pdf)
        self.f_text = FontResource('FT', F_TEXT, pdf)
        self.f_bold = FontResource('FB', F_TEXT_B, pdf)
        self.f_mono = FontResource('FM', F_MONO, pdf)
        self.page_no = 0
        self.ops = []
        self.cell = None
        self.pages = []
        self.pw = A4_W
        self.ph = A4_H

    # -------------------------------------------------- координаты
    # Примитивы принимают координаты «сверху вниз» (как читается макет);
    # внутри переводятся в систему PDF с началом в левом нижнем углу.
    # Высота страницы зависит от формата, поэтому пересчёт — метод, а не функция.

    def ty(self, y):
        return self.ph - float(y)

    # -------------------------------------------------- базовые операции
    def contrast(self, color, bg=None):
        """Если цвет текста не читается на фоне — меняем его на нормативный."""
        bg = self.cell if bg is None else bg
        if bg is None:
            return color
        lb = sum(bg) / 3.0
        if lb < 0.45:
            return WHITE if sum(color) / 3.0 < 0.55 else color
        return INK if sum(color) / 3.0 > 0.72 or color == WHITE else color

    def fill_rect(self, x, y, w, h, color):
        self.ops.append('q %s %s %s rg %s %s %s %s re f Q'
                        % (_n(color[0]), _n(color[1]), _n(color[2]),
                           _n(x), _n(self.ty(y + h)), _n(w), _n(h)))

    def line(self, x1, y1, x2, y2, color, width=0.4 * PT):
        self.ops.append('q %s %s %s RG %s w %s %s m %s %s l S Q'
                        % (_n(color[0]), _n(color[1]), _n(color[2]),
                           _n(width), _n(x1), _n(self.ty(y1)), _n(x2),
                           _n(self.ty(y2))))

    def circle(self, cx, cy, r, color, fill=True, width=1.0):
        cy = self.ty(cy)
        k = 0.5523 * r
        d = ('%s %s m %s %s %s %s %s %s c %s %s %s %s %s %s c '
             '%s %s %s %s %s %s c %s %s %s %s %s %s c'
             % (_n(cx - r), _n(cy),
                _n(cx - r), _n(cy + k), _n(cx - k), _n(cy + r), _n(cx), _n(cy + r),
                _n(cx + k), _n(cy + r), _n(cx + r), _n(cy + k), _n(cx + r), _n(cy),
                _n(cx + r), _n(cy - k), _n(cx + k), _n(cy - r), _n(cx), _n(cy - r),
                _n(cx - k), _n(cy - r), _n(cx - r), _n(cy - k), _n(cx - r), _n(cy)))
        if fill:
            self.ops.append('q %s %s %s rg %s f Q'
                            % (_n(color[0]), _n(color[1]), _n(color[2]), d))
        else:
            self.ops.append('q %s %s %s RG %s w %s S Q'
                            % (_n(color[0]), _n(color[1]), _n(color[2]), _n(width), d))

    def poly(self, path, color):
        seg = ['%s %s m' % (_n(path[0][0]), _n(self.ty(path[0][1])))]
        for (x, y) in path[1:]:
            seg.append('%s %s l' % (_n(x), _n(self.ty(y))))
        seg.append('h')
        self.ops.append('q %s %s %s rg %s f Q'
                        % (_n(color[0]), _n(color[1]), _n(color[2]), ' '.join(seg)))

    # -------------------------------------------------- текст
    def T(self, x, y, s, f, c, size, track=0.0, align='left', bg=None):
        """Текст по базовой линии y. track в em, align: left|center|right."""
        if not s:
            return 0.0
        w = f.width(s, size) + track * size * max(0, len(s) - 1)
        if align == 'center':
            x -= w / 2.0
        elif align == 'right':
            x -= w
        col = self.contrast(c, bg)
        colops = '%s %s %s rg' % (_n(col[0]), _n(col[1]), _n(col[2]))
        if track:
            for ch in s:
                self.ops.append('q %s BT /%s %s Tf %s %s Td %s Tj ET Q'
                                % (colops, f.name, _n(size), _n(x),
                                   _n(self.ty(y)), f.hex_string(ch)))
                x += f.width(ch, size) + track * size
        else:
            self.ops.append('q %s BT /%s %s Tf %s %s Td %s Tj ET Q'
                            % (colops, f.name, _n(size), _n(x),
                               _n(self.ty(y)), f.hex_string(s)))
        return w

    def wrap(self, x, y, text, f, c, size, width, leading, track=0.0,
             align='left', bg=None, first_indent=0.0):
        lines = wrap_text(text, f, size, width, track=track)
        cy = y
        for i, ln in enumerate(lines):
            self.T(x + (first_indent if i == 0 else 0), cy, ln, f, c, size,
                   track=track, align=align, bg=bg)
            cy += leading
        return cy

    def par(self, x, y, text, size, c, width, leading, f=None, track=0.0, bg=None):
        f = f or self.f_text
        return self.wrap(x, y, text, f, c, size, width, leading, track=track, bg=bg)

    def label(self, x, y, s, c=GREY, size=7.0, track=0.22, bg=None, align='left'):
        return self.T(x, y, s.upper(), self.f_bold, c, size, track=track, bg=bg,
                      align=align)

    def display(self, x, y, s, c, size, leading=None, track=-0.01, bg=None, align='left'):
        leading = leading or size * 1.0
        cy = y
        for ln in s.split('\n'):
            self.T(x, cy, ln.upper(), self.f_display, c, size, track=track,
                   align=align, bg=bg)
            cy += leading
        return cy

    def measure_display(self, s, size, track=-0.01):
        return max(self.f_display.width(ln.upper(), size) + track * size * max(0, len(ln) - 1)
                   for ln in s.split('\n'))

    def label_c(self, x, y, s, c=GREY, size=7.0, track=0.22, bg=None):
        return self.T(x, y, s.upper(), self.f_bold, c, size, track=track, bg=bg,
                      align='center')

    # -------------------------------------------------- логотип
    def mark(self, x, y, w, ink=INK, blue=BLUE):
        """Знак СВЕМА, ширина w. Колонна — ровно 2 модуля из 18."""
        u = w / 18.0

        def Y(v):
            return y + v * u
        self.fill_rect(x, Y(0), 2 * u, 16 * u, ink)
        self.fill_rect(x + 1.75 * u, Y(12.16), 14.6 * u, 1.96 * u, ink)
        self.fill_rect(x + 14.4 * u, Y(14.62), 1.7 * u, 5.1 * u, ink)
        if blue is not None:
            self.circle(x + 9.5 * u, Y(8.92), 3.24 * u, blue)
        else:
            self.circle(x + 9.5 * u, Y(8.92), 3.24 * u, ink, fill=False, width=0.05 * w)
        # визир
        self.line(x + 14.4 * u, Y(-1.5), x + 14.4 * u, Y(12.16), ink, max(0.6, 0.007 * w))
        self.line(x + 9.9 * u, Y(4.02), x + 18.6 * u, Y(4.02), ink, max(0.6, 0.007 * w))

    def lockup(self, x, y, h, ink=INK, blue=BLUE, sub=None, sub_color=None):
        """Знак + текстовая сцепка. (x, y) — левый верхний угол, h — общая высота."""
        u = h / 30.0
        self.T(x + 0.4 * u, y + 24.9 * u, 'СВЕМА', self.f_display, ink, 7.0 * u, track=0.02)
        self.T(x + 0.4 * u, y + 30.7 * u, 'ЛАБ', self.f_display, ink, 6.1 * u, track=0.066)
        self.mark(x, y, 18 * u, ink=ink, blue=blue)
        if sub:
            self.label(x + 0.4 * u, y + 34.6 * u, sub,
                       c=sub_color or (0.55, 0.55, 0.54), size=4.4 * u)

    # -------------------------------------------------- страница
    def begin_page(self, bg=PAPER_DOC, w=None, h=None):
        """Новая страница. w/h в пунктах — для страниц-макетов другого формата."""
        self.page_no += 1
        self.ops = []
        self.cell = bg
        self.pw = A4_W if w is None else float(w)
        self.ph = A4_H if h is None else float(h)
        self.fill_rect(0, 0, self.pw, self.ph, bg)
        return self

    def ty(self, y):
        return self.ph - float(y)

    def footer(self, left='СВЕМА ЛАБ — брендбук', num=None, dark=False):
        col = (0.62, 0.62, 0.60)
        y = self.ph - MARGIN + 14 * PT
        self.line(MARGIN, y - 9 * PT, self.pw - MARGIN, y - 9 * PT, col, 0.4)
        self.label(MARGIN, y, left, c=col, size=6.4, track=0.18)
        self.T(self.pw - MARGIN, y, '%02d' % (num if num is not None else self.page_no),
               self.f_display, (1, 1, 1) if dark else INK, 9.0, align='right')

    def end_page(self):
        content = ('\n'.join(self.ops)).encode('latin-1')
        res = (b'<< /Font << /%s %d 0 R /%s %d 0 R /%s %d 0 R /%s %d 0 R >> >>'
               % (self.f_display.name.encode(), self.f_display.emit(),
                  self.f_text.name.encode(), self.f_text.emit(),
                  self.f_bold.name.encode(), self.f_bold.emit(),
                  self.f_mono.name.encode(), self.f_mono.emit()))
        self.pdf.add_page(content, res, self.pw, self.ph)

    # -------------------------------------------------- сетка 12 колонок
    def grid(self, x0=None, w=None, cols=12, gap=3 * PT):
        x0 = MARGIN if x0 is None else x0
        w = (A4_W - 2 * MARGIN) if w is None else w
        col = (w - gap * (cols - 1)) / cols

        def span(a, b):
            left = x0 + (a - 1) * (col + gap)
            width = (b - a + 1) * col + (b - a) * gap
            return left, width
        return span, col, gap


def _n(v):
    s = '%.2f' % float(v)
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    return s if s not in ('', '-0') else '0'
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    return s if s not in ('', '-0') else '0'


def wrap_text(text, font, size, width, track=0.0):
    words = text.split(' ')
    lines = []
    cur = ''
    for w in words:
        cand = (cur + ' ' + w) if cur else w
        if font.width(cand, size) + track * size * max(0, len(cand) - 1) <= width or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines
