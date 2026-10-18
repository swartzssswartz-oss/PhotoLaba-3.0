# -*- coding: utf-8 -*-
"""
Страницы-макеты интерфейса приложения: тот же движок, что и брендбук,
поэтому макет и PDF совпадают. Показывает новый вид приложения:
чёрный холст, плоские панели, один синий акцент.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import (Engine, PT, MARGIN,
                    BLUE, BLUE_BRIGHT, BLUE_LIGHT, BLUE_20, BLUE_10, BLUE_DARK,
                    INK, INK_SOFT, GREY, GREY_LINE, PAPER, PAPER_DOC, WHITE)

# --- токены интерфейса (совпадают с :root в assets/styles/base.css)
BG = (0.0, 0.0, 0.0)
PANEL = (0.043, 0.043, 0.043)
PANEL2 = (0.078, 0.078, 0.078)
PANEL3 = (0.110, 0.110, 0.110)
FIELD = (0.086, 0.086, 0.086)
LINE = (0.180, 0.180, 0.180)
LINE_S = (0.306, 0.306, 0.306)
LINE_B = (0.471, 0.471, 0.471)
TXT = (1.0, 1.0, 1.0)
TXT_SOFT = (0.910, 0.910, 0.902)
TXT_MUTED = (0.612, 0.631, 0.659)
TXT_DIM = (0.431, 0.451, 0.470)
ACC = BLUE_BRIGHT          # синий — только метка и график
ACC_DEEP = BLUE
ACTIVE_BG = (1.0, 1.0, 1.0)  # активная кнопка: белая плашка
ACTIVE_FG = (0.039, 0.039, 0.039)

# --- геометрия интерфейса
UI_W, UI_H = 960.0, 546.0
HEAD_H = 40.0
STATUS_H = 24.0
LEFT_W = 176.0
RIGHT_W = 236.0

PAGE_W = 1080.0
PAGE_H = 720.0
PAGE_PAD = 60.0


def hairline(e, x1, y1, x2, y2, color=LINE, w=1.0):
    e.line(x1, y1, x2, y2, color, w)


def ui_button(e, x, y, w, h, label, primary=False, size=8.0):
    border = ACTIVE_BG if primary else TXT_MUTED
    e.fill_rect(x, y, w, h, ACTIVE_BG if primary else BG)
    e.line(x, y, x + w, y, border, 1.0)
    e.line(x, y + h, x + w, y + h, border, 1.0)
    e.line(x, y, x, y + h, border, 1.0)
    e.line(x + w, y, x + w, y + h, border, 1.0)
    e.T(x + w / 2, y + h / 2 + size * 0.36, label.upper(), e.f_bold,
        ACTIVE_FG if primary else TXT, size, track=0.08, align='center',
        bg=ACTIVE_BG if primary else BG)


def ui_slider(e, x, y, w, value, vmin, vmax, height=2.0, thumb=7.0):
    t = (value - vmin) / float(vmax - vmin)
    t = min(1.0, max(0.0, t))
    e.fill_rect(x, y, w, height, LINE_B)
    e.fill_rect(x, y, w * t, height, ACC)
    e.fill_rect(x + w * t - thumb / 2, y + height / 2 - thumb / 2, thumb, thumb, TXT)


def ui_control(e, x, y, w, name, value, t, vmin=-50, vmax=50):
    e.T(x, y, name, e.f_bold, TXT_SOFT, 7.6, track=0.10, bg=PANEL2)
    e.T(x + w, y, value, e.f_mono, TXT, 7.6, align='right')
    ui_slider(e, x, y + 11, w, t, vmin, vmax)
    # шкала: деления через равные интервалы, крайние — белые
    ty2 = y + 19
    for i in range(7):
        tick_x = x + w * i / 6.0
        edge = (i == 0 or i == 6)
        e.fill_rect(tick_x - 0.5, ty2, 1.0, 4.0 if not edge else 6.0,
                    TXT if edge else LINE_B)
    return 30.0


def ui_panel(e, x, y, w, title, rows=None, graphic=None, graphic_h=0.0, note=None):
    """Блок панели: заголовок с линией, строки управления, необязательный график.
    rows — кортежи (имя, значение, t, min, max); graphic(e, x, y, w, h)."""
    rows = rows or []
    body_h = 12 + sum(26.0 for _ in rows)
    if graphic:
        body_h += graphic_h + 10
    if note:
        body_h += 12
    total = 26.0 + body_h
    e.fill_rect(x, y, w, total, PANEL2)
    for (a, b, c, d) in [(x, y, x + w, y), (x, y + total, x + w, y + total),
                         (x, y, x, y + total), (x + w, y, x + w, y + total)]:
        e.line(a, b, c, d, LINE, 1.0)
    # проём: свет на верхней кромке, тень на нижней
    e.fill_rect(x, y, w, 1.0, (0.22, 0.22, 0.22))
    e.fill_rect(x, y + total - 1.0, w, 1.0, (0.0, 0.0, 0.0))
    e.line(x, y + 26, x + w, y + 26, LINE_S, 1.0)
    e.fill_rect(x, y, 3.0, total, (1.0, 1.0, 1.0))
    e.T(x + 13, y + 17, title, e.f_bold, TXT, 7.8, track=0.12)
    e.T(x + w - 12, y + 17, '▾', e.f_text, TXT_MUTED, 7.0, align='right')
    cy = y + 38
    for row in rows:
        cy += ui_control(e, x + 11, cy, w - 22, *row)
    if graphic:
        graphic(e, x + 11, cy, w - 22, graphic_h)
        cy += graphic_h + 10
    if note:
        e.T(x + 11, cy + 6, note, e.f_mono, TXT_DIM, 6.4)
    return total


def ui_tabs(e, x, y, w, labels, active=0, h=22.0):
    cw = w / len(labels)
    for i, lb in enumerate(labels):
        bx = x + i * cw
        on = (i == active)
        e.fill_rect(bx, y, cw, h, ACTIVE_BG if on else BG)
        for (a, b, c, d) in [(bx, y, bx + cw, y), (bx, y + h, bx + cw, y + h),
                             (bx, y, bx, y + h), (bx + i * 0 + cw, y, bx + cw, y + h)]:
            e.line(a, b, c, d, (1.0, 1.0, 1.0) if on else LINE_B, 1.0)
        if on:
            e.fill_rect(bx, y, cw, 3.0, ACC)
        e.T(bx + cw / 2, y + h / 2 + 2.6, lb, e.f_bold,
            ACTIVE_FG if on else TXT, 7.0, track=0.08, align='center',
            bg=ACTIVE_BG if on else BG)


def ui_preset_row(e, x, y, w, title, tag, gost, active=False):
    h = 34.0
    e.fill_rect(x, y, w, h, PANEL3 if active else PANEL2)
    for (a, b, c, d) in [(x, y, x + w, y), (x, y + h, x + w, y + h),
                         (x + w, y, x + w, y + h)]:
        e.line(a, b, c, d, (1.0, 1.0, 1.0) if active else LINE, 1.0)
    e.fill_rect(x, y, 2.0, h, ACTIVE_BG if active else LINE_B)
    e.T(x + 10, y + 14, title, e.f_bold, ACTIVE_FG if active else TXT, 8.2,
        track=0.02, bg=ACTIVE_BG if active else PANEL3)
    tw = e.f_mono.width(tag.upper(), 6.2) + 10
    e.fill_rect(x + w - tw - 8, y + 7, tw, 11, PANEL3)
    e.line(x + w - tw - 8, y + 7, x + w - 8, y + 7, LINE_B, 1.0)
    e.line(x + w - tw - 8, y + 18, x + w - 8, y + 18, LINE_B, 1.0)
    e.T(x + w - tw / 2 - 8, y + 15, tag.upper(), e.f_mono, TXT_MUTED, 6.2, align='center')
    e.T(x + 10, y + 27, gost, e.f_mono, TXT_DIM, 6.4)
    return h + 4


def ui_curve(e, x, y, w, h):
    e.fill_rect(x, y, w, h, PANEL3)
    for (a, b, c, d) in [(x, y, x + w, y), (x, y + h, x + w, y + h),
                         (x, y, x, y + h), (x + w, y, x + w, y + h)]:
        e.line(a, b, c, d, LINE, 1.0)
    # сетка 4×4
    for i in range(1, 4):
        hairline(e, x + w * i / 4, y, x + w * i / 4, y + h, LINE, 0.6)
        hairline(e, x, y + h * i / 4, x + w, y + h * i / 4, LINE, 0.6)
    # кривая плотности
    pts = [(0.0, 1.0), (0.25, 0.72), (0.5, 0.44), (0.75, 0.22), (1.0, 0.0)]
    for i in range(len(pts) - 1):
        e.line(x + w * pts[i][0], y + h * pts[i][1],
               x + w * pts[i + 1][0], y + h * pts[i + 1][1], ACC, 1.6)
    shade = [(x, y + h)] + [(x + w * px, y + h * py) for (px, py) in pts] + [(x + w, y + h)]
    e.poly(shade, (0.05, 0.13, 0.28))
    for i in range(len(pts) - 1):
        e.line(x + w * pts[i][0], y + h * pts[i][1],
               x + w * pts[i + 1][0], y + h * pts[i + 1][1], ACC, 1.6)
    for (px, py) in pts[1:-1]:
        e.fill_rect(x + w * px - 2.5, y + h * py - 2.5, 5, 5, TXT)


def ui_photo(e, x, y, w, h):
    """Условный кадр: тональная шкала-мишень — нейтральные поля и один синий."""
    e.fill_rect(x, y, w, h, (0.086, 0.086, 0.086))
    cols = 8
    cw = w / cols
    tones = [0.06, 0.16, 0.28, 0.42, 0.58, 0.72, 0.86, 0.96]
    for i, t in enumerate(tones):
        e.fill_rect(x + i * cw, y, cw, h * 0.52, (t, t, t))
    # нижняя половина: цветовые поля и синий акцент
    e.fill_rect(x, y + h * 0.52, w * 0.30, h * 0.48, (0.72, 0.62, 0.50))
    e.fill_rect(x + w * 0.30, y + h * 0.52, w * 0.26, h * 0.48, (0.34, 0.30, 0.26))
    e.fill_rect(x + w * 0.56, y + h * 0.52, w * 0.20, h * 0.48, ACC_DEEP)
    e.fill_rect(x + w * 0.76, y + h * 0.52, w * 0.24, h * 0.48, (0.88, 0.87, 0.85))
    # метки центра кадра
    hairline(e, x + w / 2, y + h * 0.44, x + w / 2, y + h * 0.60, (1, 1, 1), 0.6)
    hairline(e, x + w * 0.44, y + h / 2, x + w * 0.56, y + h / 2, (1, 1, 1), 0.6)


def ui_desktop(e, x, y, w=UI_W, h=UI_H):
    """Экран редактора: шапка, список плёнок, кадр, панели параметров."""
    e.fill_rect(x, y, w, h, BG)

    # ---- шапка
    header_y = y
    e.fill_rect(x, header_y, w, HEAD_H, BG)
    hairline(e, x, header_y + HEAD_H, x + w, header_y + HEAD_H, LINE)
    # знак в шапке: круг + перекладина
    e.circle(x + 20, header_y + HEAD_H / 2 - 1, 5.0, ACC)
    e.fill_rect(x + 15, header_y + HEAD_H / 2 + 5.5, 10, 1.6, TXT)
    e.T(x + 34, header_y + HEAD_H / 2 + 2.8, 'СВЕМА ЛАБ', e.f_bold, TXT, 8.4, track=0.14)
    bx = x + w - 12
    bw, bh = 58.0, 26.0
    bx -= bw
    ui_button(e, bx, header_y + 7, bw, bh, 'Экспорт', primary=True)
    for lb in ('↺', '↻', 'Обрезка', 'Открыть RAW'):
        bw2 = 32.0 if lb in ('↺', '↻') else (52.0 if lb == 'Обрезка' else 68.0)
        bx -= (bw2 + 5)
        ui_button(e, bx, header_y + 7, bw2, bh, lb)

    # ---- левый сайдбар
    ly = header_y + HEAD_H
    lh = h - HEAD_H - STATUS_H
    e.fill_rect(x, ly, LEFT_W, lh, PANEL)
    hairline(e, x + LEFT_W, ly, x + LEFT_W, ly + lh, LINE)
    ui_tabs(e, x + 6, ly + 8, LEFT_W - 12, ['Плёнки', 'Рецепты', 'Мои'], active=0)
    ry = ly + 38
    films = [
        ('СВЕМА 400', 'цвет', 'ГОСТ 10691 · зерно крупное', True),
        ('СВЕМА 65', 'слайд', 'обращаемая · контраст высокий', False),
        ('СВЕМА 130', 'ч/б', 'ортохром · плотная тень', False),
        ('СВЕМА 250', 'цвет', 'портретная · галация низкая', False),
        ('СВЕМА 1000', 'пуш', 'пуш +2 EV · зерно предельное', False),
        ('Обращаемая 100', 'слайд', 'жёсткий контраст · синий в тенях', False),
    ]
    for (t, tag, g, act) in films:
        ry += ui_preset_row(e, x + 6, ry, LEFT_W - 12, t, tag, g, active=act)

    # ---- центр: кадр
    cx = x + LEFT_W
    cw = w - LEFT_W - RIGHT_W
    ch = h - HEAD_H - STATUS_H
    e.fill_rect(cx, ly, cw, ch, BG)
    pad = 16.0
    ph_w = min(cw - 2 * pad, (ch - 2 * pad) * 1.5)
    ph_h = ph_w / 1.5
    ui_photo(e, cx + (cw - ph_w) / 2, ly + (ch - ph_h) / 2, ph_w, ph_h)
    # ---- статус-строка
    sy = y + h - STATUS_H
    e.fill_rect(x, sy, w, STATUS_H, BG)
    hairline(e, x, sy, x + w, sy, LINE)
    e.T(x + 12, sy + 15, 'Кадр 6016 × 4016 · 24 Мп', e.f_mono, TXT_MUTED, 6.6)
    e.T(x + LEFT_W + 12, sy + 15, 'СВЕМА 400', e.f_bold, TXT, 6.6, track=0.10)
    e.T(x + LEFT_W + cw / 2, sy + 15, 'Зерно +12 · Гало +8 · Контраст +6',
        e.f_mono, TXT_MUTED, 6.6, align='center')
    e.T(x + w - 12, sy + 15, '100%', e.f_mono, TXT_MUTED, 6.6, align='right')

    # ---- правый сайдбар: панели
    rx = x + w - RIGHT_W
    e.fill_rect(rx, ly, RIGHT_W, lh, PANEL)
    hairline(e, rx, ly, rx, ly + lh, LINE)
    py = ly + 6
    py += ui_panel(e, rx + 6, py, RIGHT_W - 12, 'Экспозиция',
                   [('ЭКСПОЗИЦИЯ', '+0,35', 0.35, -2, 2),
                    ('КОНТРАСТ', '+6', 6, -50, 50),
                    ('СВЕТА', '−12', -12, -50, 50)]) + 6
    py += ui_panel(e, rx + 6, py, RIGHT_W - 12, 'Кривая плотности',
                   graphic=ui_curve, graphic_h=60.0) + 6
    py += ui_panel(e, rx + 6, py, RIGHT_W - 12, 'Зерно и галация',
                   [('ЗЕРНО', '+12', 12, 0, 50),
                    ('РАЗМЕР ЗЕРНА', '1,4', 1.4, 0.5, 3),
                    ('ГАЛАЦИЯ', '+8', 8, 0, 50)]) + 6
    # каналы: три подписи с цветом
    ch_h = 62.0
    e.fill_rect(rx + 6, py, RIGHT_W - 12, ch_h, PANEL2)
    for (a, b, c, d) in [(rx + 6, py, rx + RIGHT_W - 6, py),
                         (rx + 6, py + ch_h, rx + RIGHT_W - 6, py + ch_h),
                         (rx + 6, py, rx + 6, py + ch_h),
                         (rx + RIGHT_W - 6, py, rx + RIGHT_W - 6, py + ch_h)]:
        e.line(a, b, c, d, LINE, 1.0)
    e.T(rx + 17, py + 17, 'КАНАЛЫ', e.f_bold, TXT, 7.8, track=0.12)
    cw3 = (RIGHT_W - 34) / 3
    for i, (lb, col, val, v) in enumerate([('R', (0.75, 0.28, 0.24), '4', 4),
                                           ('G', (0.31, 0.64, 0.42), '−2', -2),
                                           ('B', (0.18, 0.44, 0.84), '9', 9)]):
        bx2 = rx + 17 + i * cw3
        e.T(bx2, py + 34, lb, e.f_bold, col, 7.4)
        ui_slider(e, bx2 + 12, py + 32, cw3 - 24, v, -30, 30, height=2.0, thumb=6.0)
    return header_y, ly, sy


def page_app_desktop(e):
    e.begin_page(BG, w=PAGE_W, h=PAGE_H)
    e.label(MARGIN, MARGIN + 4, '16 — Интерфейс', c=(0.48, 0.48, 0.46), size=6.8)
    e.T(MARGIN, MARGIN + 26, 'Экран редактора', e.f_display, TXT, 17, track=-0.01)
    e.T(MARGIN, MARGIN + 42, 'Чёрное поле для кадра, белые линии и действия, синий — '
        'только метка выбора', e.f_text, TXT_MUTED, 8)

    ux = (PAGE_W - UI_W) / 2
    uy = MARGIN + 50
    e.fill_rect(ux - 1, uy - 1, UI_W + 2, UI_H + 2, LINE_B)
    ui_desktop(e, ux, uy)

    ty_ = uy + UI_H + 18
    notes = [('Холст', 'чистый #000000 без рамки и тени — подложка не влияет на оценку тонов'),
             ('Белое', 'действия и активные состояния — белые плашки с чёрным текстом'),
             ('Линии', 'границы и разделители заметно светлее: белый работает как графика'),
             ('Акцент', '#1557C8 остался меткой выбора: активная плёнка и график кривой'),
             ('Шрифт', 'Segoe UI для текста, Consolas для значений и служебных подписей')]
    cw = (PAGE_W - 2 * MARGIN - 4 * 14) / 5
    for i, (k, v) in enumerate(notes):
        cx = MARGIN + i * (cw + 14)
        e.T(cx, ty_, k, e.f_display, TXT, 8.2)
        e.par(cx, ty_ + 13, v, 7.2, TXT_MUTED, cw, 9.6)
    e.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34, (0.2, 0.2, 0.2), 0.6)
    e.label(MARGIN, PAGE_H - 22, 'СВЕМА ЛАБ — интерфейс приложения', c=(0.45, 0.45, 0.43), size=6.4)
    e.label(PAGE_W - MARGIN, PAGE_H - 22, '16', c=(0.45, 0.45, 0.43), size=6.4, align='right')
    return PAGE_H


def page_app_states(e):
    """Мобильный экран, обрезка, экспорт — три состояния."""
    e.begin_page(BG, w=PAGE_W, h=PAGE_H)
    e.label(MARGIN, MARGIN + 4, '17 — Интерфейс', c=(0.48, 0.48, 0.46), size=6.8)
    e.T(MARGIN, MARGIN + 26, 'Мобильный экран и состояния', e.f_display, TXT, 17)
    e.T(MARGIN, MARGIN + 42, 'Та же система на телефоне: кадр сверху, шторка снизу, '
        'вкладки у большого пальца', e.f_text, TXT_MUTED, 8)

    top = MARGIN + 62
    body_h = PAGE_H - top - MARGIN - 10

    # ---------- 1. мобильный редактор
    mw, mh = 236.0, body_h
    mx = MARGIN
    e.fill_rect(mx, top, mw, mh, BG)
    e.line(mx, top, mx + mw, top, LINE_B, 1.0)
    e.line(mx, top + mh, mx + mw, top + mh, LINE_B, 1.0)
    e.line(mx, top, mx, top + mh, LINE_B, 1.0)
    e.line(mx + mw, top, mx + mw, top + mh, LINE_B, 1.0)
    # шапка
    e.circle(mx + 18, top + 20, 4.4, ACC)
    e.fill_rect(mx + 14, top + 25, 9, 1.4, TXT)
    e.T(mx + 30, top + 22.6, 'СВЕМА ЛАБ', e.f_bold, TXT, 7.4, track=0.12)
    ui_button(e, mx + mw - 62, top + 10, 52, 20, 'Экспорт', primary=True)
    hairline(e, mx, top + 40, mx + mw, top + 40, LINE)
    # кадр
    ui_photo(e, mx + 12, top + 54, mw - 24, 128)
    # ползунок «до/после» на кадре
    e.fill_rect(mx + 12 + (mw - 24) * 0.42, top + 54, 1.6, 128, TXT)
    e.circle(mx + 12 + (mw - 24) * 0.42, top + 118, 7.0, PANEL2)
    e.circle(mx + 12 + (mw - 24) * 0.42, top + 118, 6.4, BG)
    e.T(mx + 12 + (mw - 24) * 0.42, top + 120.6, '↔', e.f_text, TXT, 6.4, align='center')
    # мини-строка статуса
    e.T(mx + 12, top + 194, 'СВЕМА 400 · 24 Мп', e.f_mono, TXT_MUTED, 6.2)
    # шторка параметров
    sheet_y = top + 208
    e.fill_rect(mx, sheet_y, mw, top + mh - 26 - sheet_y, PANEL)
    hairline(e, mx, sheet_y, mx + mw, sheet_y, LINE_S)
    e.fill_rect(mx + mw / 2 - 18, sheet_y + 6, 36, 2.4, LINE_B)
    py = sheet_y + 16
    py += ui_panel(e, mx + 6, py, mw - 12, 'Экспозиция',
                   [('ЭКСПОЗИЦИЯ', '+0,35', 0.35, -2, 2),
                    ('ЗЕРНО', '+12', 12, 0, 50)]) + 6
    py += ui_panel(e, mx + 6, py, mw - 12, 'Кривая плотности',
                   graphic=ui_curve, graphic_h=58.0) + 6
    ui_button(e, mx + 6, py, (mw - 12) / 2 - 3, 22, 'Сброс')
    ui_button(e, mx + 6 + (mw - 12) / 2 + 3, py, (mw - 12) / 2 - 3, 22, 'Сохранить', primary=True)
    # нижние вкладки
    tabs_y = top + mh - 24
    hairline(e, mx, tabs_y, mx + mw, tabs_y, LINE_S)
    tabw = mw / 5
    for i, lb in enumerate(['Кадр', 'Плёнки', 'Правка', 'Экспорт', 'Инфо']):
        col = TXT if i == 0 else TXT_MUTED
        e.T(mx + tabw * (i + 0.5), tabs_y + 15, lb.upper(), e.f_bold, col, 6.0,
            track=0.06, align='center')
        if i == 0:
            e.fill_rect(mx + tabw * i + 8, tabs_y + 22, tabw - 16, 2.0, ACC)

    # ---------- 2. обрезка
    cx2 = mx + mw + 24
    cw2 = 300.0
    e.T(cx2, top + 6, 'Обрезка: сетка третей и пропорции', e.f_bold, TXT, 8.4, track=0.08)
    crop_h = 150.0
    e.fill_rect(cx2, top + 16, cw2, crop_h, BG)
    ui_photo(e, cx2, top + 16, cw2, crop_h)
    # затемнение вне кропа
    for (dx, dy, dw, dh) in [(cx2, top + 16, cw2, 18), (cx2, top + 16 + crop_h - 18, cw2, 18),
                             (cx2, top + 34, 40, crop_h - 36), (cx2 + cw2 - 40, top + 34, 40, crop_h - 36)]:
        e.fill_rect(dx, dy, dw, dh, (0, 0, 0))
    # рамка кропа и ручки
    bx0, by0 = cx2 + 40, top + 34
    bx1, by1 = cx2 + cw2 - 40, top + 16 + crop_h - 18
    for (a, b, c, d) in [(bx0, by0, bx1, by0), (bx0, by1, bx1, by1),
                         (bx0, by0, bx0, by1), (bx1, by0, bx1, by1)]:
        e.line(a, b, c, d, TXT, 1.0)
    # сетка третей внутри рамки
    for k in (1, 2):
        hairline(e, bx0 + (bx1 - bx0) * k / 3, by0, bx0 + (bx1 - bx0) * k / 3, by1, LINE_B, 0.8)
        hairline(e, bx0, by0 + (by1 - by0) * k / 3, bx1, by0 + (by1 - by0) * k / 3, LINE_B, 0.8)
    for (hx, hy) in [(bx0, by0), (bx1, by0), (bx0, by1), (bx1, by1)]:
        e.fill_rect(hx - 3, hy - 3, 6, 6, TXT)
    # панель пропорций
    ry = top + 16 + crop_h + 12
    e.T(cx2, ry, 'ПРОПОРЦИИ', e.f_bold, TXT_MUTED, 6.6, track=0.14)
    ratios = ['Свободно', '1:1', '3:2', '4:5', '16:9', 'Оригинал']
    bw2 = 44.0
    for i, r in enumerate(ratios):
        on = (r == '3:2')
        ui_button(e, cx2 + i * (bw2 + 5), ry + 8, bw2, 20, r, primary=on, size=6.6)
    e.T(cx2, ry + 44, 'ПОВОРОТ И ВЫРАВНИВАНИЕ', e.f_bold, TXT_MUTED, 6.6, track=0.14)
    ui_button(e, cx2, ry + 52, 56, 20, '↺ 90°')
    ui_button(e, cx2 + 61, ry + 52, 56, 20, '↻ 90°')
    ui_button(e, cx2 + 122, ry + 52, 74, 20, 'Отразить')
    e.T(cx2 + 206, ry + 62, '−2,4°', e.f_mono, TXT, 7.0)
    ui_slider(e, cx2, ry + 84, cw2, 0.4, 0, 1, height=2.0, thumb=7.0)
    # действия
    ay = top + body_h - 24
    ui_button(e, cx2, ay, 120, 24, 'Отмена')
    ui_button(e, cx2 + cw2 - 120, ay, 120, 24, 'Применить', primary=True)

    # ---------- 3. экспорт
    cx3 = cx2 + cw2 + 24
    cw3 = PAGE_W - MARGIN - cx3
    e.T(cx3, top + 6, 'Экспорт и установка приложения', e.f_bold, TXT, 8.4, track=0.08)
    # карточка экспорта
    ch3 = 150.0
    e.fill_rect(cx3, top + 16, cw3, ch3, PANEL)
    for (a, b, c, d) in [(cx3, top + 16, cx3 + cw3, top + 16),
                         (cx3, top + 16 + ch3, cx3 + cw3, top + 16 + ch3),
                         (cx3, top + 16, cx3, top + 16 + ch3),
                         (cx3 + cw3, top + 16, cx3 + cw3, top + 16 + ch3)]:
        e.line(a, b, c, d, LINE, 1.0)
    e.T(cx3 + 16, top + 44, 'Экспорт кадра', e.f_display, TXT, 12.5)
    e.T(cx3 + 16, top + 60, 'TIFF 16 бит · Adobe RGB · 6016 × 4016', e.f_mono, TXT_MUTED, 7.0)
    # прогресс
    e.fill_rect(cx3 + 16, top + 78, cw3 - 32, 4, PANEL3)
    e.fill_rect(cx3 + 16, top + 78, (cw3 - 32) * 0.62, 4, ACC)
    e.T(cx3 + 16, top + 98, 'Проявка: зерно и галация', e.f_text, TXT_MUTED, 7.2)
    e.T(cx3 + cw3 - 16, top + 98, '62%', e.f_mono, TXT, 7.2, align='right')
    e.T(cx3 + 16, top + 116, 'Осталось ~12 с', e.f_mono, TXT_DIM, 6.8)
    ui_button(e, cx3 + 16, top + 130, 110, 22, 'Отменить')
    ui_button(e, cx3 + cw3 - 126, top + 130, 110, 22, 'Открыть папку', primary=True)
    # состояния
    sy2 = top + 16 + ch3 + 12
    states = [('Готово', (0.31, 0.64, 0.42)), ('Внимание', (0.79, 0.63, 0.15)),
              ('Ошибка', (0.75, 0.28, 0.24))]
    e.T(cx3, sy2, 'СОСТОЯНИЯ', e.f_bold, TXT_MUTED, 6.6, track=0.14)
    for i, (lb, col) in enumerate(states):
        yy = sy2 + 10 + i * 20
        e.fill_rect(cx3, yy, cw3, 16, PANEL2)
        e.line(cx3, yy, cx3 + cw3, yy, LINE, 1.0)
        e.line(cx3, yy + 16, cx3 + cw3, yy + 16, LINE, 1.0)
        e.line(cx3, yy, cx3, yy + 16, LINE, 1.0)
        e.line(cx3 + cw3, yy, cx3 + cw3, yy + 16, LINE, 1.0)
        e.fill_rect(cx3, yy, 3, 16, col)
        e.T(cx3 + 12, yy + 11, lb, e.f_bold, TXT, 7.0, track=0.08)
    # иконка приложения
    iy = sy2 + 82
    e.T(cx3, iy, 'ИКОНКА ПРИЛОЖЕНИЯ', e.f_bold, TXT_MUTED, 6.6, track=0.14)
    tile = 54.0
    e.fill_rect(cx3, iy + 10, tile, tile, BG)
    e.line(cx3, iy + 10, cx3 + tile, iy + 10, LINE_B, 1.0)
    e.line(cx3, iy + 10 + tile, cx3 + tile, iy + 10 + tile, LINE_B, 1.0)
    e.line(cx3, iy + 10, cx3, iy + 10 + tile, LINE_B, 1.0)
    e.line(cx3 + tile, iy + 10, cx3 + tile, iy + 10 + tile, LINE_B, 1.0)
    mw2 = tile * 0.62
    e.mark(cx3 + (tile - mw2) / 2, iy + 10 + (tile - mw2 * 15 / 18.0) / 2, mw2,
           ink=TXT, blue=ACC)
    e.T(cx3 + tile + 14, iy + 30, '512 · 192 · 180 px', e.f_mono, TXT_MUTED, 6.8)
    e.T(cx3 + tile + 14, iy + 42, 'icon.svg · maskable', e.f_mono, TXT_MUTED, 6.8)
    e.T(cx3 + tile + 14, iy + 56, 'чёрное поле, знак, один синий', e.f_text, TXT_DIM, 6.8)
    e.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34, (0.2, 0.2, 0.2), 0.6)
    e.label(MARGIN, PAGE_H - 22, 'СВЕМА ЛАБ — интерфейс приложения', c=(0.45, 0.45, 0.43), size=6.4)
    e.label(PAGE_W - MARGIN, PAGE_H - 22, '17', c=(0.45, 0.45, 0.43), size=6.4, align='right')
    return PAGE_H


APP_PAGES = [page_app_desktop, page_app_states]
