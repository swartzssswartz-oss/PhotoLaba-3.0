# -*- coding: utf-8 -*-
"""Сборка брендбука СВЕМА ЛАБ в PDF. 16 страниц A4."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdfwriter import PDF
from engine import (Engine, A4_W, A4_H, PT, MARGIN,
                    BLUE, BLUE_BRIGHT, BLUE_LIGHT, BLUE_20, BLUE_10, BLUE_05,
                    BLUE_DARK, INK, INK_SOFT, GREY, GREY_LINE, PAPER, PAPER_DOC, WHITE)

TOP = MARGIN
FOOT = A4_H - MARGIN - 2 * PT
CW = A4_W - 2 * MARGIN


# ---------------------------------------------------------------- утилиты

def dashed(e, x, y, w, h, color=BLUE, dash=3.0, thick=0.5):
    """Рамка пунктиром: рисуем отрезками, чтобы не зависеть от dash-паттерна."""
    def hline(x1, x2, yy):
        cx = x1
        while cx < x2:
            e.line(cx, yy, min(cx + dash, x2), yy, color, thick)
            cx += dash * 2

    def vline(y1, y2, xx):
        cy = y1
        while cy < y2:
            e.line(xx, cy, xx, min(cy + dash, y2), color, thick)
            cy += dash * 2
    hline(x, x + w, y)
    hline(x, x + w, y + h)
    vline(y, y + h, x)
    vline(y, y + h, x + w)


def grid_bg(e, x, y, w, h, step, color=BLUE_10, thick=0.4):
    cx = x
    while cx <= x + w + 0.1:
        e.line(cx, y, cx, y + h, color, thick)
        cx += step
    cy = y
    while cy <= y + h + 0.1:
        e.line(x, cy, x + w, cy, color, thick)
        cy += step


def card(e, x, y, w, h, bg=WHITE, border=GREY_LINE):
    e.fill_rect(x, y, w, h, bg)
    if border is not None:
        solid_border(e, x, y, w, h, border, 0.5)


def solid_border(e, x, y, w, h, color=GREY_LINE, thick=0.5):
    e.line(x, y, x + w, y, color, thick)
    e.line(x, y + h, x + w, y + h, color, thick)
    e.line(x, y, x, y + h, color, thick)
    e.line(x + w, y, x + w, y + h, color, thick)


def head(e, kicker, title, color=INK):
    y = TOP + 6
    e.label(MARGIN, y, kicker, c=GREY, size=6.8)
    y += 30
    y = e.display(MARGIN, y, title, color, 26, leading=27)
    return y + 14


def body(e, x, y, text, w, size=9, leading=13, color=INK_SOFT, font=None):
    return e.par(x, y, text, size, color, w, leading, f=font)


def two_cols(gap=24):
    col = (CW - gap) / 2
    return col, MARGIN + col + gap


def three_cols(gap=18):
    col = (CW - 2 * gap) / 3
    return col, [MARGIN + i * (col + gap) for i in range(3)]


def four_cols(gap=16):
    col = (CW - 3 * gap) / 4
    return col, [MARGIN + i * (col + gap) for i in range(4)]


# ---------------------------------------------------------------- страницы

def p01_cover(e):
    e.begin_page(INK)
    e.label(MARGIN, TOP + 6, 'Брендбук · версия 1.0', c=(0.62, 0.62, 0.60), size=7)
    lh = 130
    lw = 18.0 / 30.0 * lh
    e.lockup(MARGIN, 240, lh, ink=WHITE, blue=BLUE_BRIGHT)
    y = FOOT - 40
    e.line(MARGIN, y, A4_W - MARGIN, y, (0.28, 0.28, 0.28), 0.6)
    e.label(MARGIN, y - 16, 'Конструкция · Свет · Материал', c=(0.66, 0.66, 0.64), size=7)
    e.label(A4_W - MARGIN, y - 16, 'Фото · Видео · Эксперименты',
            c=(0.66, 0.66, 0.64), size=7, align='right')


def p02_logo(e):
    e.begin_page()
    y = head(e, '01 — Логотип', 'Основной\nлоготип')
    bh = 236
    card(e, MARGIN, y, CW, bh, bg=WHITE)
    lh = 166
    e.lockup(MARGIN + (CW - 18.0 / 30.0 * lh) / 2, y + 30, lh, ink=INK, blue=BLUE)
    y += bh + 30
    col, x2 = two_cols()
    e.display(MARGIN, y, 'Что это', INK, 11.5, leading=13)
    body(e, MARGIN, y + 18, 'Логотип собран из четырёх элементов: вертикаль, '
         'горизонталь, круг и визир. Три из них прямые и жёсткие, один — кривой и '
         'живой. Круг вынесен в единственный цветной элемент: это свет, попавший '
         'в кадр.', col, size=8.4, leading=12)
    e.display(x2, y, 'Как читается', INK, 11.5, leading=13)
    body(e, x2, y + 18, 'Знак работает как оптическая схема: опора слева, '
         'луч-горизонталь, диафрагма-круг и перекрестие видоискателя. Лаборатория, '
         'снятая в разрезе. Круг касается горизонтали ровно в одной точке, '
         'без зазора и нахлёста — это и держит всю конструкцию.', col,
         size=8.4, leading=12)
    yy = y + 18 + 12 * 6 + 22
    for k, v in [('Пропорции', '18 : 15 модулей'),
                 ('Модуль', '1 ед. = 1/18 ширины знака'),
                 ('Минимум', '14 мм по ширине, 48 px в цифре')]:
        e.T(x2, yy, k, e.f_bold, INK, 7.6)
        e.T(x2 + 66, yy, v, e.f_mono, GREY, 7.6)
        yy += 14
    e.footer()


def p03_variations(e):
    e.begin_page()
    y = head(e, '02 — Логотип', 'Знак и вариации')
    col, xs = three_cols(20)
    bh = 168
    items = [
        ('Знак', WHITE, INK, BLUE, GREY_LINE,
         'Основная версия. Для аватаров, иконок, печатей и всего, где мало места.'),
        ('Инверсия', BLUE, WHITE, BLUE_LIGHT, None,
         'На синем фоне круг обесцвечивается до светло-синего, остальное — белое.'),
        ('На чёрном', INK, WHITE, BLUE_BRIGHT, None,
         'Круг — светло-синий, чтобы не проваливаться в фон. Для тёмной темы.'),
    ]
    for i, (name, bg, ink, blue, border, note) in enumerate(items):
        x = xs[i]
        card(e, x, y, col, bh, bg=bg, border=border)
        mw = col * 0.5
        e.mark(x + (col - mw) / 2, y + (bh - mw * 15.0 / 18.0) / 2, mw, ink=ink, blue=blue)
        e.T(x, y + bh + 18, name, e.f_bold, INK, 8.4)
        body(e, x, y + bh + 32, note, col, size=7.4, leading=10.6)
    y += bh + 32 + 10.6 * 4 + 26
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 24
    col2, x2 = two_cols()
    bh2 = 122
    e.display(MARGIN, y, 'Монохром', INK, 11.5, leading=13)
    body(e, MARGIN, y + 18, 'Для тиснения, гравировки и однокрасочной печати круг '
         'обводится контуром в 0,05 ширины знака.', col2, size=7.8, leading=11.4)
    card(e, MARGIN, y + 64, col2, bh2, bg=PAPER)
    e.mark(MARGIN + (col2 - 96) / 2, y + 64 + (bh2 - 80) / 2, 96, ink=INK, blue=None)
    e.display(x2, y, 'Вертикальная сцепка', INK, 11.5, leading=13)
    body(e, x2, y + 18, 'Когда формат вытянут по вертикали — сторис, шеврон, борт — '
         'знак ставится над текстовым блоком по центру.', col2, size=7.8, leading=11.4)
    card(e, x2, y + 64, col2, bh2, bg=WHITE)
    lh = 96
    e.lockup(x2 + (col2 - 18.0 / 30.0 * lh) / 2, y + 64 + (bh2 - lh) / 2, lh,
             ink=INK, blue=BLUE)
    e.footer()


def p04_construction(e):
    e.begin_page()
    y = head(e, '03 — Логотип', 'Построение')
    body(e, MARGIN, y, 'Знак строится на сетке с шагом 1 модуль. Вертикаль занимает '
         'ровно 2 модуля из 18, горизонталь — 14,6 × 1,96, круг — радиус 3,24 с '
         'центром в точке (9,5; 8,92). Круг касается горизонтали ровно в одной '
         'точке: без зазора и без нахлёста.', CW, size=9, leading=13)
    y += 13 * 3 + 22
    bw = 363.0
    bx = (A4_W - bw) / 2
    bh = 250
    step = bw / 22.0
    grid_bg(e, bx, y, bw, bh, step=step, color=BLUE_10, thick=0.4)
    solid_border(e, bx, y, bw, bh, GREY_LINE, 0.5)
    u = step
    mw = 18 * u
    mx = bx + (bw - mw) / 2
    my = y + (bh - 15 * u) / 2 + 6
    e.mark(mx, my, mw, ink=INK, blue=BLUE)
    # ширина колонны
    e.line(mx, my - 16, mx + 2 * u, my - 16, BLUE, 0.6)
    e.line(mx, my - 22, mx, my - 10, BLUE, 0.6)
    e.line(mx + 2 * u, my - 22, mx + 2 * u, my - 10, BLUE, 0.6)
    e.T(mx + u, my - 20, '2', e.f_mono, BLUE, 6.4, align='center')
    # длина горизонтали
    base = my + 16 * u
    e.line(mx + 2 * u, base + 22, mx + 14.6 * u, base + 22, BLUE, 0.6)
    e.line(mx + 2 * u, base + 16, mx + 2 * u, base + 28, BLUE, 0.6)
    e.line(mx + 14.6 * u, base + 16, mx + 14.6 * u, base + 28, BLUE, 0.6)
    e.T(mx + 8.3 * u, base + 18, '14,6', e.f_mono, BLUE, 6.4, align='center')
    # центр круга
    ccx = mx + 9.5 * u
    ccy = my + 8.92 * u
    e.circle(ccx, ccy, 1.5, BLUE)
    e.T(ccx + 6, ccy + 3, 'R 3,24', e.f_mono, BLUE, 6.4)
    y += bh + 26
    col, xs = four_cols(16)
    specs = [('Вертикаль', '2 × 16 ед.', 'Тень и опора знака'),
             ('Горизонталь', '14,6 × 1,96 ед.', 'Луч и линия горизонта'),
             ('Круг', 'R 3,24 ед.', 'Диафрагма и свет'),
             ('Визир', '0,13 ед.', 'Перекрестие кадра')]
    for i, (t, v, n) in enumerate(specs):
        x = xs[i]
        e.T(x, y, t, e.f_display, INK, 8.4)
        e.T(x, y + 14, v, e.f_mono, GREY, 7.4)
        body(e, x, y + 28, n, col, size=7.2, leading=10)
    e.footer()


def _dont_mark(e, kind, cx, cy, w):
    """Знак для карточки «нельзя» с нужным искажением."""
    import math
    h = w * 15.0 / 18.0
    x = cx - w / 2
    y = cy - h / 2
    if kind == 0:      # растянут
        e.mark(cx - w * 0.62, cy - h * 0.42, w * 1.24, ink=INK, blue=BLUE)
    elif kind == 1:    # наклонён
        ang = math.radians(10)
        u = w / 18.0

        def P(px, py):
            dx, dy = (px - 9) * u, (py - 7.5) * u
            return (cx + dx * math.cos(ang) - dy * math.sin(ang),
                    cy + dx * math.sin(ang) + dy * math.cos(ang))
        e.poly([P(0, 0), P(2, 0), P(2, 16), P(0, 16)], INK)
        e.poly([P(1.75, 12.16), P(16.35, 12.16), P(16.35, 14.12), P(1.75, 14.12)], INK)
        e.poly([P(14.4, 14.62), P(16.1, 14.62), P(16.1, 19.72), P(14.4, 19.72)], INK)
        e.circle(*P(9.5, 8.92), r=3.24 * u, color=BLUE)
    elif kind == 2:    # снижена плотность
        e.mark(x, y, w, ink=(0.44, 0.44, 0.44), blue=(0.64, 0.72, 0.85))
    elif kind == 3:    # убран синий
        e.mark(x, y, w, ink=INK, blue=INK)
    elif kind == 4:    # перечёркнут
        e.mark(x, y, w, ink=INK, blue=BLUE)
        e.line(cx - w * 0.62, cy, cx + w * 0.62, cy, WHITE, 3)
        e.line(cx - w * 0.62, cy, cx + w * 0.62, cy, (0.55, 0.55, 0.55), 0.7)
    else:              # один тон
        e.mark(x, y, w, ink=BLUE, blue=BLUE)


def p05_clearspace(e):
    e.begin_page()
    y = head(e, '04 — Логотип', 'Поле и запреты')
    col, x2 = two_cols(28)
    col_l = col * 1.02
    e.display(MARGIN, y, 'Охранное поле', INK, 11.5, leading=13)
    body(e, MARGIN, y + 18, 'Свободная зона вокруг логотипа равна 0,3 высоты знака. '
         'Внутри поля не бывает текста, линий, фотографий и края макета.', col_l,
         size=8, leading=11.6)
    by = y + 62
    bh = 240
    card(e, MARGIN, by, col_l, bh, bg=WHITE)
    u = 0.045 * col_l / 0.1
    u = (col_l - 110) / 18.0
    mw = 18 * u
    mx = MARGIN + (col_l - mw) / 2
    my = by + (bh - 15 * u) / 2 + 4
    dashed(e, mx - 0.3 * 15 * u, my - 0.3 * 15 * u, mw + 0.6 * 15 * u,
           15 * u + 0.6 * 15 * u, color=BLUE, dash=3, thick=0.5)
    e.mark(mx, my, mw, ink=INK, blue=BLUE)
    e.T(MARGIN + 14, by + bh - 26, 'Поле = 0,3 H, где H — высота знака',
        e.f_mono, GREY, 6.6)
    e.T(MARGIN + 14, by + bh - 14, 'Минимум: 14 мм / 48 px', e.f_mono, GREY, 6.6)
    e.display(x2, y, 'Нельзя', INK, 11.5, leading=13)
    dw = (CW - (x2 - MARGIN) - 14) / 2
    dh = 96
    bad = ['растягивать', 'наклонять', 'снижать плотность',
           'убирать синий', 'перечёркивать', 'красить в один тон']
    for i in range(6):
        bx = x2 + (i % 2) * (dw + 14)
        byy = y + 26 + (i // 2) * (dh + 14)
        card(e, bx, byy, dw, dh, bg=WHITE)
        cx = bx + dw / 2
        cy = byy + 36
        _dont_mark(e, i, cx, cy, 60)
        e.T(bx + dw - 12, byy + 16, '×', e.f_display, (0.70, 0.15, 0.12), 9,
            align='right')
        e.T(cx, byy + dh - 12, bad[i], e.f_text, INK_SOFT, 6.6, align='center')
    e.footer()


def p06_palette(e):
    e.begin_page()
    y = head(e, '05 — Цвет', 'Палитра')
    body(e, MARGIN, y, 'Три цвета, взятые прямо из логотипа. Чёрное — конструкция, '
         'синее — свет, бумажное — воздух. Оттенки синего нужны только для '
         'интерфейсных состояний.', CW, size=9, leading=13)
    y += 13 * 2 + 24
    col, xs = three_cols(18)
    sw = [
        ('Синий СВЕМА', '#0A4AA8 · RGB 10 74 168 · CMYK 94 56 0 34', BLUE,
         'Главный акцент. Круг в знаке, активные элементы, ссылки, заливки.'),
        ('Чёрный', '#141414 · RGB 20 20 20 · CMYK 0 0 0 92', INK,
         'Конструкция и текст. Знак без круга, заголовки, основной набор.'),
        ('Бумага', '#E5E3DD · RGB 229 227 221 · CMYK 8 6 12 0', PAPER,
         'Фон печатных носителей. Тёплая, не белая — держит синий.'),
        ('Белый', '#FFFFFF · RGB 255 255 255', WHITE,
         'Интерфейс, документы, презентации. Чистое поле для знака.'),
        ('Синий цифровой', '#1557C8 · RGB 21 87 200', BLUE_BRIGHT,
         'Экранный вариант главного: чуть ярче, чтобы держать насыщенность.'),
        ('Серый служебный', '#7A7873 · RGB 122 120 115', GREY,
         'Подписи, сноски, второй уровень текста. Никогда — для логотипа.'),
    ]
    sh_total = 158
    for i, (nm, hexv, color, use) in enumerate(sw):
        x = xs[i % 3]
        yy = y + (i // 3) * (sh_total + 14)
        chip = 62
        e.fill_rect(x, yy, col, chip, color)
        solid_border(e, x, yy, col, chip, GREY_LINE, 0.5)
        e.T(x + 10, yy + chip + 18, nm, e.f_display, INK, 8.2)
        e.T(x + 10, yy + chip + 30, hexv, e.f_mono, GREY, 6.2)
        body(e, x + 10, yy + chip + 46, use, col - 20, size=7, leading=9.8)
    y += 2 * (sh_total + 14) + 4
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 22
    e.label(MARGIN, y, 'Шкала синего — состояния, графики, тёмная тема', c=GREY, size=6.8)
    y += 12
    ramp = ['#F1F5FB', '#E3EAF6', '#C7D6EC', '#7FA3D8', '#1557C8', '#0A4AA8', '#072F6C']
    cols = [BLUE_05, BLUE_10, BLUE_20, BLUE_LIGHT, BLUE_BRIGHT, BLUE, BLUE_DARK]
    rw = (CW - 6 * 12) / 7
    for i, (c, r) in enumerate(zip(cols, ramp)):
        x = MARGIN + i * (rw + 12)
        e.fill_rect(x, y, rw, 40, c)
        solid_border(e, x, y, rw, 40, GREY_LINE, 0.4)
        e.T(x + rw / 2, y + 52, r, e.f_mono, GREY, 6.2, align='center')
    y += 76
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 22
    col2, x2 = two_cols()
    e.display(MARGIN, y, 'Доступность', INK, 11.5, leading=13)
    body(e, MARGIN, y + 18, 'Контраст основного текста к фону — не ниже 7:1, синего '
         'к белому — 7,4:1. Синий годен для текста от 11 pt и для крупных элементов.',
         col2, size=7.8, leading=11.2)
    e.display(x2, y, 'Технические заметки', INK, 11.5, leading=13)
    body(e, x2, y + 18, 'Синий из логотипа — плашечный. Для экрана берём более яркий '
         '#1557C8: на подсветке тёмный синий теряет насыщенность.', col2,
         size=7.8, leading=11.2)
    e.footer()


def p07_proportions(e):
    e.begin_page()
    y = head(e, '06 — Цвет', 'Пропорции')
    body(e, MARGIN, y, 'Бренд узнаётся не цветом, а его количеством. Держим правило '
         '60 / 30 / 10: поле, конструкция, свет. Синий — всегда редкий гость.',
         CW, size=9, leading=13)
    y += 13 * 2 + 26
    h = 78
    p1 = CW * 0.6
    p2 = CW * 0.3
    e.fill_rect(MARGIN, y, p1, h, PAPER)
    e.fill_rect(MARGIN + p1, y, p2, h, INK)
    e.fill_rect(MARGIN + p1 + p2, y, CW - p1 - p2, h, BLUE)
    solid_border(e, MARGIN, y, CW, h, GREY_LINE, 0.5)
    e.label(MARGIN + 12, y + h / 2 + 2, '60% · бумага и белый', c=INK_SOFT, size=7)
    e.label(MARGIN + p1 + 12, y + h / 2 + 2, '30% · чёрный', c=(0.85, 0.85, 0.84), size=7)
    e.T(MARGIN + CW - 6, y + h / 2 + 2, '10%', e.f_bold, WHITE, 7, align='right')
    y += h + 32
    e.label(MARGIN, y, 'Проверенные пары', c=GREY, size=6.8)
    y += 14
    col, xs = three_cols(16)
    ch = 96
    pairs = [
        (WHITE, INK, 'Чёрный\nна белом', '#141414 / #FFFFFF · база документов'),
        (PAPER, INK, 'Чёрный\nна бумаге', '#141414 / #E5E3DD · постеры, печать'),
        (BLUE, WHITE, 'Белый\nна синем', '#FFFFFF / #0A4AA8 · акцентные блоки'),
        (INK, WHITE, 'Белый\nна чёрном', '#FFFFFF / #141414 · тёмная тема'),
        (BLUE_10, BLUE, 'Синий\nна светлом', '#0A4AA8 / #E3EAF6 · плашки, бейджи'),
        (GREY, WHITE, 'Белый\nна сером', '#FFFFFF / #7A7873 · вспомогательные'),
    ]
    for i, (bg, fg, t, hexv) in enumerate(pairs):
        x = xs[i % 3]
        yy = y + (i // 3) * (ch + 14)
        e.fill_rect(x, yy, col, ch, bg)
        solid_border(e, x, yy, col, ch, GREY_LINE, 0.5)
        e.display(x + 12, yy + 34, t, fg, 12.5, leading=13.5)
        e.T(x + 12, yy + ch - 12, hexv, e.f_mono, fg, 6.2)
    y += 2 * ch + 14 + 28
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 22
    col2, x2 = two_cols()
    e.display(MARGIN, y, 'Чего не делаем', INK, 11.5, leading=13)
    body(e, MARGIN, y + 18, 'Синий на чёрном проваливается. Синий на синем без '
         'светлотного разрыва сливается. Жёлтый, зелёный и красный в системе не '
         'участвуют: цвет здесь один.', col2, size=7.8, leading=11.2)
    e.display(x2, y, 'Свет и контраст', INK, 11.5, leading=13)
    body(e, x2, y + 18, 'Тёмный фон — только с белым текстом. Синяя плашка — с белым, '
         'никогда с чёрным. Серый служебный не опускается ниже 7 pt.', col2,
         size=7.8, leading=11.2)
    e.footer()


def p08_type(e):
    e.begin_page()
    y = head(e, '07 — Типографика', 'Шрифт')
    samples = [
        (lambda x, yy: e.T(x, yy, 'СВЕМА', e.f_display, INK, 34, track=0.02),
         'Arial Black · 34 pt · трекинг +0,02 em · только прописные',
         'Заголовки и логотип. Не сжимать по горизонтали, не набирать строчными.'),
        (lambda x, yy: e.T(x, yy, 'Заголовок раздела', e.f_bold, INK, 19),
         'Segoe UI Bold · 18–24 pt',
         'Заголовки внутри страниц, названия плёнок, подписи к кадрам.'),
        (lambda x, yy: e.T(x, yy, 'Основной текст набирается Segoe UI Regular 10 pt',
                           e.f_text, INK_SOFT, 10),
         'Segoe UI Regular · 9–11 pt · интерлиньяж 1,55–1,65',
         'Абзац не длиннее 90 знаков: дальше глаз теряет строку.'),
        (lambda x, yy: e.T(x, yy, 'ФОТО · ВИДЕО · ЭКСПЕРИМЕНТЫ', e.f_bold, GREY, 8,
                           track=0.30),
         'Segoe UI Bold · 7–8 pt · трекинг +0,30 em · прописные',
         'Дескриптор бренда и служебные подписи. Широкий трекинг делает мелкий '
         'текст «тихим, но заметным».'),
    ]
    for draw, dim, note in samples:
        e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
        y += 24
        draw(MARGIN, y)
        y += 14
        e.T(MARGIN, y, dim, e.f_mono, BLUE, 6.6)
        y += 13
        body(e, MARGIN, y, note, 150 * PT, size=7.4, leading=10.4)
        y += 34
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 24
    col, x2 = two_cols()
    bh = 206
    card(e, MARGIN, y, col, bh, bg=PAPER)
    e.display(MARGIN + 20, y + 36, 'Кино\nначинается\nс материала', INK, 19, leading=20)
    e.fill_rect(MARGIN + 20, y + 102, 40, 5, BLUE)
    body(e, MARGIN + 20, y + 122, 'Мы собираем симуляцию плёнки по физике процесса: '
         'зерно, галация, кривые сенситометрии. Не фильтр поверх картинки, а модель '
         'эмульсии.', col - 40, size=8, leading=11.4)
    e.label(MARGIN + 20, y + bh - 18, 'СВЕМА ЛАБ · ФОТО · ВИДЕО', c=GREY, size=6.4,
            track=0.28)
    e.display(x2, y, 'Правила', INK, 11.5, leading=13)
    rules = [('Прописные', 'только в логотипе, заголовках и дескрипторе'),
             ('Трекинг', '+0,02 em в крупном кегле, +0,30 em в мелком'),
             ('Курсив', 'не используем'),
             ('Подчёркивание', 'только для ссылок в интерфейсе'),
             ('Выключка', 'влево; по центру — короткие строки'),
             ('Переносы', 'в основном тексте можно, в заголовках нельзя')]
    yy = y + 26
    for k, v in rules:
        e.T(x2, yy, k, e.f_bold, INK, 7.8)
        e.T(x2 + 84, yy, v, e.f_text, GREY, 7.8)
        yy += 15
    yy += 16
    e.T(x2, yy, '0123456789', e.f_display, INK, 20)
    e.T(x2, yy + 22, 'Табличные цифры, выравнивание по правому краю',
        e.f_mono, GREY, 6.6)
    e.footer()


def p09_grid(e):
    e.begin_page()
    y = head(e, '08 — Сетка', 'Модуль')
    body(e, MARGIN, y, 'Знак построен на модуле 1. Тот же модуль задаёт вёрстку: '
         '12 колонок, шаг 6 мм, все отступы кратны трём. Ничего не ставится «на глаз».',
         CW, size=9, leading=13)
    y += 13 * 2 + 24
    h = 300
    card(e, MARGIN, y, CW, h, bg=WHITE)
    pad = 12 * PT
    gap = 3 * PT
    colw = (CW - 2 * pad - gap * 11) / 12
    for i in range(12):
        x = MARGIN + pad + i * (colw + gap)
        e.fill_rect(x, y + 24, colw, h - 48, BLUE_05)
    x5 = MARGIN + pad + 6.6 * (colw + gap)
    e.display(MARGIN + pad, y + 118, 'Эмульсия\nкак модель', INK, 17, leading=18)
    body(e, MARGIN + pad, y + 166, 'Текст занимает пять колонок из двенадцати. '
         'Остальное — воздух.', 5 * colw + 4 * gap, size=7.6, leading=10.6)
    mw = 5.2 * colw + 4.2 * gap
    e.mark(x5, y + (h - mw * 15.0 / 18.0) / 2, mw, ink=INK, blue=BLUE)
    y += h + 24
    col, xs = four_cols(16)
    specs = [('Формат', 'A4 · 210 × 297 мм'), ('Поля', '24 мм со всех сторон'),
             ('Колонки', '12 · межколонник 3 мм'), ('Шаг', '6 мм · всё кратно трём')]
    for i, (k, v) in enumerate(specs):
        x = xs[i]
        e.T(x, y, k, e.f_display, INK, 8.2)
        e.T(x, y + 14, v, e.f_mono, GREY, 7.2)
    e.footer()


def p10_cards(e):
    e.begin_page()
    y = head(e, '09 — Носители', 'Визитки и бланк')
    cw, chh = 240, 148
    card(e, MARGIN, y, cw, chh, bg=WHITE)
    e.mark(MARGIN + 20, y + 24, 60, ink=INK, blue=BLUE)
    e.T(MARGIN + 20, y + chh - 36, 'СВЕМА ЛАБ', e.f_display, INK, 9)
    e.label(MARGIN + 20, y + chh - 24, 'Фото · Видео · Эксперименты', c=GREY,
            size=5.8, track=0.2)
    e.T(MARGIN, y + chh + 14, 'Лицевая · 90 × 55 мм', e.f_mono, GREY, 6.4)
    x2 = MARGIN + cw + 26
    card(e, x2, y, cw, chh, bg=BLUE, border=None)
    e.mark(x2 + cw - 76, y + 20, 56, ink=WHITE, blue=BLUE_LIGHT)
    e.T(x2 + 20, y + chh - 48, 'Анна Ковалёва', e.f_bold, WHITE, 9.4)
    e.T(x2 + 20, y + chh - 36, 'Лаборатория плёнки', e.f_text, (0.82, 0.87, 0.95), 7.6)
    e.T(x2 + 20, y + chh - 18, 'svema.lab · +7 000 000-00-00', e.f_text,
        (0.82, 0.87, 0.95), 7.6)
    e.T(x2, y + chh + 14, 'Оборотная · 90 × 55 мм', e.f_mono, GREY, 6.4)
    y += chh + 44
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 24
    col = (CW - 28) * 0.56
    col2 = (CW - 28) * 0.44
    x3 = MARGIN + col + 28
    e.display(MARGIN, y, 'Бланк A4', INK, 11.5, leading=13)
    by = y + 16
    bh = 250
    card(e, MARGIN, by, col, bh, bg=WHITE)
    e.mark(MARGIN + 20, by + 20, 44, ink=INK, blue=BLUE)
    e.label(MARGIN + col - 20, by + 32, 'СВЕМА ЛАБ', c=GREY, size=6, track=0.22,
            align='right')
    e.line(MARGIN + 20, by + 76, MARGIN + col - 20, by + 76, GREY_LINE, 0.5)
    e.display(MARGIN + 20, by + 104, 'Отчёт по эмульсии', INK, 12, leading=14)
    e.T(MARGIN + 20, by + 120, 'Партия 04 · контроль зерна и галации', e.f_text, GREY, 7.4)
    for i in range(6):
        e.fill_rect(MARGIN + 20 + (i % 3) * 62, by + 142 + (i // 3) * 14, 54, 6,
                    BLUE_10 if i % 2 == 0 else PAPER)
    e.line(MARGIN + 20, by + bh - 26, MARGIN + col - 20, by + bh - 26, GREY_LINE, 0.5)
    e.label(MARGIN + 20, by + bh - 14, 'svema.lab', c=GREY, size=5.8, track=0.2)
    e.label(MARGIN + col - 20, by + bh - 14, 'стр. 1 / 4', c=GREY, size=5.8,
            track=0.2, align='right')
    e.display(x3, y, 'Печать', INK, 11.5, leading=13)
    spec = [('Синий', 'Pantone 286 C · CMYK 94/56/0/34'),
            ('Чёрный', 'Pantone Black 6 C · CMYK 0/0/0/92'),
            ('Бумага', 'без покрытия, 300 г/м², тёплый оттенок'),
            ('Отделка', 'тиснение или шелкография для знака')]
    yy = y + 30
    for k, v in spec:
        e.T(x3, yy, k, e.f_bold, INK, 7.8)
        yy += 11
        e.T(x3, yy, v, e.f_mono, GREY, 6.8)
        yy += 22
    yy += 4
    card(e, x3, yy, col2, 78, bg=PAPER)
    e.label(x3 + 12, yy + 20, 'Проверка перед печатью', c=GREY, size=5.8, track=0.2)
    body(e, x3 + 12, yy + 36, 'Знак не меньше 14 мм · поле 0,3 H свободно · синий '
         'один, без градиентов · оверпринт чёрного выключен.', col2 - 24,
         size=6.6, leading=9.4)
    e.footer()


def p11_social(e):
    e.begin_page()
    y = head(e, '10 — Носители', 'Соцсети')
    col = (CW - 28) * 0.55
    col2 = (CW - 28) * 0.45
    x2 = MARGIN + col + 28
    sh = 320
    sw_ = col * 0.46
    e.fill_rect(MARGIN, y, sw_, sh, INK)
    lh = 78
    e.lockup(MARGIN + (sw_ - 18.0 / 30.0 * lh) / 2, y + 72, lh, ink=WHITE,
             blue=BLUE_BRIGHT)
    e.label(MARGIN + sw_ / 2, y + sh - 24, 'Новая партия · Зерно 400',
            c=(0.62, 0.62, 0.60), size=5.6, track=0.2, align='center')
    e.T(MARGIN, y + sh + 14, 'Сторис · 1080 × 1920', e.f_mono, GREY, 6.4)
    x1b = MARGIN + sw_ + 16
    e.fill_rect(x1b, y, sw_, sh, PAPER)
    e.display(x1b + sw_ / 2, y + 96, 'Свет\nкак\nматериал', INK, 15, leading=16,
              align='center')
    e.fill_rect(x1b + sw_ / 2 - 18, y + 158, 36, 4, BLUE)
    e.label(x1b + sw_ / 2, y + sh - 24, 'СВЕМА ЛАБ', c=GREY, size=5.6, track=0.24,
            align='center')
    e.T(x1b, y + sh + 14, 'Сторис · текстовый вариант', e.f_mono, GREY, 6.4)
    e.display(x2, y, 'Аватары', INK, 11.5, leading=13)
    av = 86
    e.circle(x2 + av / 2, y + 60, av / 2, WHITE)
    solid_border(e, x2, y + 17, av, av, GREY_LINE, 0.5)
    mw = av * 0.58
    e.mark(x2 + (av - mw) / 2, y + 17 + (av - mw * 15.0 / 18.0) / 2, mw, ink=INK, blue=BLUE)
    e.fill_rect(x2 + av + 18, y + 17, av, av, BLUE)
    e.mark(x2 + av + 18 + (av - mw) / 2, y + 17 + (av - mw * 15.0 / 18.0) / 2, mw,
           ink=WHITE, blue=BLUE_LIGHT)
    e.T(x2, y + 118, 'Круг · знак', e.f_mono, GREY, 6.2)
    e.T(x2 + av + 18, y + 118, 'Квадрат · инверсия', e.f_mono, GREY, 6.2)
    py = y + 142
    ph = col2 + 30
    e.fill_rect(x2, py, col2, ph, INK)
    e.mark(x2 + 20, py + 20, 38, ink=WHITE, blue=BLUE_BRIGHT)
    e.display(x2 + 20, py + ph - 92, 'Галация:\nпочему свет\nрастекается', WHITE, 15,
              leading=16)
    e.label(x2 + 20, py + ph - 22, 'Разбор · 6 мин', c=(0.62, 0.62, 0.60),
            size=5.6, track=0.2)
    y = py + ph + 24
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 22
    col3, xs = three_cols(18)
    notes = [('Сетка текста', 'Знак всегда в верхнем левом углу, отступ 8% от края. '
              'Заголовок — от 72 pt, чтобы читался в превью.'),
             ('Фото под логотипом', 'Допустимы кадры в холодном ключе. Синий знак '
              'ставится только на нейтральные или тёмные участки.'),
             ('Подписи', 'Хештег и дескриптор — капсом с трекингом. Эмодзи не '
              'используем: тон лаборатории спокойный.')]
    for i, (t, v) in enumerate(notes):
        x = xs[i]
        e.display(x, y, t, INK, 9.5, leading=11)
        body(e, x, y + 16, v, col3, size=7, leading=10)
    e.footer()


def p12_icons(e):
    e.begin_page()
    y = head(e, '11 — Носители', 'Иконки и приложение')
    body(e, MARGIN, y, 'В иконке остаётся только знак: круг, горизонталь и визир. '
         'Тонкие линии визира на малых размерах утолщаются до 1,5 px, иначе исчезают.',
         CW, size=9, leading=13)
    y += 13 * 2 + 24
    col, xs = four_cols(18)
    tiles = [(WHITE, INK, BLUE, GREY_LINE, '512 px · белая подложка'),
             (INK, WHITE, BLUE_BRIGHT, None, '512 px · тёмная тема'),
             (BLUE, WHITE, BLUE_LIGHT, None, '512 px · брендовая плитка'),
             (PAPER, INK, BLUE, GREY_LINE, '512 px · круглая маска')]
    for i, (bg, ink, blue, border, cap) in enumerate(tiles):
        x = xs[i]
        e.fill_rect(x, y, col, 118, bg)
        if border:
            solid_border(e, x, y, col, 118, border, 0.5)
        mw = col * 0.52
        e.mark(x + (col - mw) / 2, y + (118 - mw * 15.0 / 18.0) / 2, mw, ink=ink, blue=blue)
        e.T(x, y + 136, cap, e.f_mono, GREY, 6.4)
    y += 158
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 24
    col, x2 = two_cols(28)
    col_l = col * 0.9
    e.display(MARGIN, y, 'Малые размеры', INK, 11.5, leading=13)
    body(e, MARGIN, y + 18, 'От 24 px визир убирается: остаются три массы и круг. '
         'Ниже 24 px знак не используется — вместо него буква «С» в квадрате.',
         col_l, size=8, leading=11.6)
    for i, side in enumerate([64, 46, 32]):
        bx = MARGIN + i * 76
        byy = y + 86
        e.fill_rect(bx, byy, side, side, INK)
        mw = side * 0.62
        e.mark(bx + (side - mw) / 2, byy + (side - mw * 15.0 / 18.0) / 2, mw,
               ink=WHITE, blue=BLUE_BRIGHT)
        e.T(bx, byy + side + 12, '%d px' % side, e.f_mono, GREY, 6.2)
    e.display(x2, y, 'Экран приложения', INK, 11.5, leading=13)
    sy = y + 22
    sh = 300
    e.fill_rect(x2, sy, col, sh, INK)
    e.mark(x2 + 20, sy + 20, 34, ink=WHITE, blue=BLUE_BRIGHT)
    e.label(x2 + col - 20, sy + 30, 'Симуляция', c=(0.55, 0.55, 0.53), size=5.8,
            track=0.2, align='right')
    e.display(x2 + 20, sy + 92, 'СВЕМА 400', WHITE, 15, leading=16)
    e.T(x2 + 20, sy + 108, 'Зерно · Гало · Контраст', e.f_text, (0.68, 0.68, 0.66), 7)
    e.fill_rect(x2 + 20, sy + 130, col - 40, 5, (0.20, 0.20, 0.20))
    e.fill_rect(x2 + 20, sy + 130, (col - 40) * 0.62, 5, BLUE_BRIGHT)
    e.T(x2 + 20, sy + 148, 'ISO 400', e.f_mono, (0.55, 0.55, 0.53), 6)
    e.T(x2 + col - 20, sy + 148, '±0 EV', e.f_mono, (0.55, 0.55, 0.53), 6, align='right')
    rows = [('Пуш-процесс', '+1 EV'), ('Галация', 'средняя'), ('Зерно', 'крупное')]
    ry = sy + 184
    e.line(x2 + 20, ry - 14, x2 + col - 20, ry - 14, (0.28, 0.28, 0.28), 0.5)
    for k, v in rows:
        e.T(x2 + 20, ry, k, e.f_text, (0.80, 0.80, 0.78), 7.4)
        e.T(x2 + col - 20, ry, v, e.f_bold, BLUE_LIGHT, 7.4, align='right')
        ry += 18
    e.footer()


def p13_poster(e):
    e.begin_page()
    y = head(e, '12 — Носители', 'Афиша и постер')
    col = (CW - 28) * 0.52
    col2 = (CW - 28) * 0.48
    x2 = MARGIN + col + 28
    ph = 400
    e.fill_rect(MARGIN, y, col, ph, PAPER)
    solid_border(e, MARGIN, y, col, ph, GREY_LINE, 0.5)
    e.label(MARGIN + 18, y + 24, 'СВЕМА ЛАБ · Лаборатория', c=GREY, size=6, track=0.2)
    e.label(MARGIN + col - 18, y + 24, '14 / 06', c=GREY, size=6, track=0.2, align='right')
    mw = col * 0.32
    e.mark(MARGIN + (col - mw) / 2, y + 50, mw, ink=INK, blue=BLUE)
    e.display(MARGIN + col / 2, y + 182, 'Свет\nи зерно', INK, 30, leading=30,
              align='center')
    e.fill_rect(MARGIN + col / 2 - 28, y + 256, 56, 6, BLUE)
    body(e, MARGIN + 40, y + 282, 'Открытая лаборатория: разбираем эмульсию, '
         'проявляем, печатаем. Вход свободный, регистрация на месте.', col - 80,
         size=7.6, leading=11)
    e.label(MARGIN + 18, y + ph - 20, 'Фото · Видео · Эксперименты', c=GREY,
            size=5.8, track=0.2)
    e.label(MARGIN + col - 18, y + ph - 20, 'svema.lab', c=GREY, size=5.8,
            track=0.2, align='right')
    e.T(MARGIN, y + ph + 14, 'Афиша A2 · 420 × 594 мм', e.f_mono, GREY, 6.4)
    e.display(x2, y, 'Логика постера', INK, 11.5, leading=13)
    body(e, x2, y + 18, 'Постер держится на трёх опорах: знак сверху, крупная фраза '
         'в центре, две служебные строки по углам. Всё остальное — поле.', col2,
         size=8, leading=11.6)
    sy = y + 70
    e.fill_rect(x2, sy, col2, 150, INK)
    e.label(x2 + 16, sy + 22, 'Тон', c=(0.55, 0.55, 0.53), size=5.8, track=0.2)
    e.display(x2 + 16, sy + 50, 'Говорим коротко\nи по делу', WHITE, 13, leading=14)
    body(e, x2 + 16, sy + 90, 'Мы не продаём «магию плёнки». Мы объясняем, как она '
         'устроена: сенситометрия, кривые, зерно. Тон — инженерный, спокойный.',
         col2 - 32, size=7, leading=10, color=(0.78, 0.78, 0.76))
    e.fill_rect(x2 + 16, sy + 130, 44, 4, BLUE_BRIGHT)
    sy += 176
    e.display(x2, sy, 'Слоганы', INK, 11.5, leading=13)
    sl = ['СВЕМА ЛАБ — фото, видео, эксперименты', 'Свет как материал',
          'Кино начинается с эмульсии', 'Мы не фильтруем — мы проявляем']
    yy = sy + 24
    for s in sl:
        e.T(x2, yy, s, e.f_bold, INK_SOFT, 7.8)
        yy += 14
    body(e, x2, yy + 12, 'Слоган набирается Segoe UI Bold, строчными, без точки в '
         'конце. Не рифмуем и не используем восклицательные знаки.', col2,
         size=7, leading=10)
    e.footer()


def p14_merch(e):
    e.begin_page()
    y = head(e, '13 — Носители', 'Мерч')
    body(e, MARGIN, y, 'На одежде знак работает в одну краску. Синий круг — '
         'единственное исключение, и только на светлом фоне.', CW, size=9, leading=13)
    y += 13 * 2 + 22
    col, xs = three_cols(20)
    bh = 238
    for x in xs:
        card(e, x, y, col, bh, bg=WHITE)
    lh = 96
    e.lockup(xs[0] + (col - 18.0 / 30.0 * lh) / 2, y + 70, lh, ink=INK, blue=BLUE)
    e.T(xs[0], y + bh + 16, 'Футболка', e.f_bold, INK, 8)
    body(e, xs[0], y + bh + 28, 'Шелкография в две краски, центр груди, высота '
         'блока 90 мм.', col, size=7, leading=10)
    e.circle(xs[1] + col / 2, y + 119, 74, BLUE)
    mw = 68
    e.mark(xs[1] + col / 2 - mw / 2, y + 119 - mw * 15.0 / 36.0, mw, ink=WHITE,
           blue=BLUE_LIGHT)
    e.T(xs[1], y + bh + 16, 'Значок', e.f_bold, INK, 8)
    body(e, xs[1], y + bh + 28, '44 мм, металл под эмаль. Круг — единственная масса, '
         'текст не ставится.', col, size=7, leading=10)
    pk_w, pk_h = col * 0.62, 170
    pkx = xs[2] + (col - pk_w) / 2
    e.fill_rect(pkx, y + 34, pk_w, pk_h, INK)
    e.mark(pkx + 14, y + 52, 32, ink=WHITE, blue=BLUE_BRIGHT)
    e.display(pkx + 14, y + 130, 'СВЕМА\n400', WHITE, 14, leading=15)
    e.label(pkx + 14, y + 182, '35 мм · 36 кадров', c=(0.62, 0.62, 0.60),
            size=5.4, track=0.18)
    e.T(xs[2], y + bh + 16, 'Упаковка плёнки', e.f_bold, INK, 8)
    body(e, xs[2], y + bh + 28, 'Матовая ламинация. На малом формате знак идёт без '
         'визира.', col, size=7, leading=10)
    y += bh + 28 + 10 * 3 + 24
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 22
    col3, xs3 = three_cols(18)
    notes = [('Одна краска', 'Гравировка, тиснение, вышивка — по монохромной версии. '
              'Толщина линий не ниже 0,4 мм.'),
             ('Материал', 'Только матовые поверхности: хлопок, неблёсткий металл, '
              'крафт. Глянец спорит с идеей лаборатории.'),
             ('Размер знака', 'На груди — 90 мм, на рукаве — 45 мм, на плёнке — '
              '24 мм. Пропорции не меняются.')]
    for i, (t, v) in enumerate(notes):
        x = xs3[i]
        e.display(x, y, t, INK, 9.5, leading=11)
        body(e, x, y + 16, v, col3, size=7, leading=10)
    e.footer()


def p15_photo(e):
    e.begin_page()
    y = head(e, '14 — Изображение', 'Фотография')
    body(e, MARGIN, y, 'Логотип — про свет и геометрию. Съёмка — та же логика: '
         'прямой свет, твёрдая тень, ясная геометрия кадра.', CW, size=9, leading=13)
    y += 13 * 2 + 24
    col, xs = three_cols(18)
    ch = 150
    x = xs[0]
    e.fill_rect(x, y, col, ch, INK)
    e.fill_rect(x, y, col * 0.38, ch, BLUE_DARK)
    e.fill_rect(x + col * 0.38, y + ch * 0.22, col * 0.34, ch * 0.56, PAPER)
    e.T(x, y + ch + 16, 'Да · жёсткий боковой свет', e.f_bold, INK, 7.6)
    body(e, x, y + ch + 28, 'Глубокая тень, чистые плоскости, один цветовой акцент.',
         col, size=7, leading=10)
    x2 = xs[1]
    e.fill_rect(x2, y, col, ch, PAPER)
    e.fill_rect(x2 + col * 0.3, y + ch * 0.18, col * 0.4, ch * 0.64, BLUE)
    e.fill_rect(x2 + col * 0.3, y + ch * 0.18, col * 0.4, ch * 0.16, BLUE_DARK)
    e.line(x2 + col * 0.12, y + ch * 0.7, x2 + col * 0.88, y + ch * 0.44, INK, 3)
    e.T(x2, y + ch + 16, 'Да · контровой свет', e.f_bold, INK, 7.6)
    body(e, x2, y + ch + 28, 'Силуэт, прямая линия, холодный ключ, ничего лишнего.',
         col, size=7, leading=10)
    x3 = xs[2]
    e.fill_rect(x3, y, col, ch, (0.94, 0.86, 0.68))
    e.fill_rect(x3 + col * 0.2, y + ch * 0.2, col * 0.6, ch * 0.6, (0.96, 0.78, 0.45))
    e.fill_rect(x3, y, col, ch * 0.34, (0.90, 0.80, 0.58))
    e.circle(x3 + col * 0.72, y + ch * 0.3, col * 0.1, (0.99, 0.90, 0.66))
    e.T(x3, y + ch + 16, 'Нет · тёплые заливки', e.f_bold, (0.70, 0.15, 0.12), 7.6)
    body(e, x3, y + ch + 28, 'Размытые пятна и «красивости» без конструкции.',
         col, size=7, leading=10)
    y += ch + 28 + 10 * 3 + 26
    e.line(MARGIN, y, A4_W - MARGIN, y, GREY_LINE, 0.5)
    y += 24
    col2, xr = two_cols()
    e.display(MARGIN, y, 'Свет', INK, 11.5, leading=13)
    rules = [('Источник', 'один, направленный, с видимой границей тени'),
             ('Тень', 'плотная, нейтральная, без цветного рефлекса'),
             ('Фон', 'бумага, бетон, металл, чёрное поле'),
             ('Композиция', 'прямые линии параллельны краю кадра')]
    yy = y + 26
    for k, v in rules:
        e.T(MARGIN, yy, k, e.f_bold, INK, 7.8)
        e.T(MARGIN + 76, yy, v, e.f_text, GREY, 7.8)
        yy += 15
    e.display(xr, y, 'Обработка', INK, 11.5, leading=13)
    rules2 = [('Насыщенность', 'минус 10…20, кроме синего акцента'),
              ('Контраст', 'поднят в средних тонах, свет не выбит'),
              ('Зерно', 'только физическое или по модели эмульсии'),
              ('Запрещено', 'HDR, виньетки, кросс-процесс, тёплые фильтры')]
    yy = y + 26
    for k, v in rules2:
        e.T(xr, yy, k, e.f_bold, INK, 7.8)
        e.T(xr + 82, yy, v, e.f_text, GREY, 7.8)
        yy += 15
    y = yy + 26
    e.fill_rect(MARGIN, y, 5, 64, BLUE)
    e.fill_rect(MARGIN + 5, y, CW - 5, 64, PAPER)
    e.label(MARGIN + 20, y + 20, 'Правило отбора', c=GREY, size=6, track=0.22)
    body(e, MARGIN + 20, y + 40, 'Если кадр можно перепутать с рекламой кофейни — '
         'он не наш. Если он похож на схему, снятую светом, — наш.',
         CW - 40, size=8, leading=11.4)
    e.footer()


def p16_apply(e):
    e.begin_page(INK)
    e.label(MARGIN, TOP + 6, '15 — Применение', c=(0.55, 0.55, 0.53), size=6.8)
    y = e.display(MARGIN, TOP + 36, 'Цифра и печать', WHITE, 26, leading=27) + 24
    col, x2 = two_cols(28)
    digital = [('Сайт и приложение', 'чёрный фон, белый текст, синий акцент'),
               ('Кнопка', 'синяя заливка, белый текст, радиус 10 px'),
               ('Карточка', 'фон #1C1C1C, рамка rgba(255,255,255,.12)'),
               ('Фокус', 'обводка 2 px #7FA3D8'),
               ('Иконка', 'знак без визира, 24–512 px'),
               ('Анимация', '180–240 мс, ease-out, без пружин')]
    for i, (k, v) in enumerate(digital):
        yy = y + i * 24
        e.T(MARGIN, yy, k, e.f_bold, WHITE, 8)
        e.T(MARGIN, yy + 11, v, e.f_text, (0.68, 0.68, 0.66), 7.4)
    print_rules = [('Формат', 'A4, A3, A2, 90 × 55 мм'),
                   ('Поля', 'не меньше 12 мм на малых форматах'),
                   ('Цвет', 'Pantone 286 C и Black 6 C'),
                   ('Бумага', 'без покрытия, 120–300 г/м²'),
                   ('Минимум знака', '14 мм по ширине'),
                   ('Отделка', 'тиснение, шелкография, лёгкий рельеф')]
    for i, (k, v) in enumerate(print_rules):
        yy = y + i * 24
        e.T(x2, yy, k, e.f_bold, WHITE, 8)
        e.T(x2, yy + 11, v, e.f_text, (0.68, 0.68, 0.66), 7.4)
    y += 6 * 24 + 18
    e.line(MARGIN, y, A4_W - MARGIN, y, (0.26, 0.26, 0.26), 0.6)
    y += 30
    e.display(MARGIN, y, 'Файлы', WHITE, 11.5, leading=13)
    files = ['logo-svema-lab.svg — основной логотип',
             'logo-white.svg — логотип для тёмного фона',
             'mark-svema.svg — знак, цвет', 'mark-white.svg — знак, инверсия',
             'mark-mono.svg — знак, монохром',
             'СВЕМА-ЛАБ-брендбук.pdf — этот документ']
    for i, f in enumerate(files):
        e.T(MARGIN, y + 24 + i * 15, f, e.f_mono, (0.68, 0.68, 0.66), 7.2)
    e.display(x2, y, 'Чек-лист', WHITE, 11.5, leading=13)
    checks = ['Знак на сетке, пропорции целы', 'Синий ровно один',
              'Поле 0,3 H свободно', 'Шрифты только системные',
              'Текст не на цветном фото', 'Контраст не ниже 7:1',
              'Минимум 14 мм / 48 px', 'Круг не потерян в одну краску']
    for i, c in enumerate(checks):
        cx = x2 + (i % 2) * (col / 2 + 6)
        cy = y + 26 + (i // 2) * 16
        e.fill_rect(cx, cy - 5, 5, 5, BLUE_BRIGHT)
        e.T(cx + 11, cy, c, e.f_text, (0.78, 0.78, 0.76), 7.4)
    fy = FOOT - 86
    e.lockup(MARGIN, fy, 62, ink=WHITE, blue=BLUE_BRIGHT)
    e.label(A4_W - MARGIN, fy + 26, 'Конец документа', c=(0.55, 0.55, 0.53),
            size=6.4, align='right')
    e.T(A4_W - MARGIN, fy + 46, 'СВЕМА ЛАБ · 2025', e.f_display, WHITE, 12, align='right')
    e.footer(dark=True)


pages = [p01_cover, p02_logo, p03_variations, p04_construction, p05_clearspace,
         p06_palette, p07_proportions, p08_type, p09_grid, p10_cards,
         p11_social, p12_icons, p13_poster, p14_merch, p15_photo, p16_apply]

# страницы-макеты интерфейса приложения: горизонтальный формат, свой колонтитул
try:
    from interface_pages import APP_PAGES, PAGE_W as UI_PAGE_W, PAGE_H as UI_PAGE_H
    from lc_reference import page_app_lc
    from site_page import page_site
    extra = list(APP_PAGES) + [page_app_lc, page_site]
    pages = pages + extra
    SIZES = {id(fn): (UI_PAGE_W, UI_PAGE_H) for fn in extra}
except ImportError:
    SIZES = {}


def build(path):
    pdf = PDF()
    e = Engine(pdf)
    for fn in pages:
        size = SIZES.get(id(fn))
        if size:
            e.begin_page(INK, w=size[0], h=size[1])
        else:
            e.begin_page()
        fn(e)
        e.end_page()
    return pdf.save(path, 'СВЕМА ЛАБ — брендбук')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'brandbook.pdf'
    n = build(out)
    print('PDF:', out, n, 'байт,', len(pages), 'страниц')
