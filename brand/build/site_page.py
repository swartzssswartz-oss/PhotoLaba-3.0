# -*- coding: utf-8 -*-
"""
Страница-макет лендинга сайта: тот же движок, что и брендбук, поэтому макет
и живая вёрстка совпадают по композиции и токенам.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import PT, MARGIN
from interface_pages import (BG, PANEL, PANEL2, PANEL3, FIELD, LINE, LINE_S, LINE_B,
                             TXT, TXT_SOFT, TXT_MUTED, TXT_DIM, ACC, ACTIVE_BG,
                             ACTIVE_FG, PAGE_W, PAGE_H, ui_button)

# колонка сайта: 900 px при окне 1080, поля как у панелей
SITE_W = 640.0
SITE_X = (PAGE_W - SITE_W) / 2


def site_header(e, x, y, w):
    """Знак-опора и название, снизу — подпись дескриптора."""
    mark_w, mark_h = 52.0, 44.0
    tw = e.f_display.width('СВЕМА ЛАБ', 22) + 0.12 * 22 * 8
    total = mark_w + 16 + tw
    mx = x + (w - total) / 2
    # знак по модели логотипа: плашка 6 модулей, перекладина — почти во всю ширину
    e.fill_rect(mx, y, 18, mark_h, ACC)
    e.fill_rect(mx + 14, y + mark_h - 8, mark_w - 14, 8, TXT)
    e.line(mx + 29, y, mx + 29, y + mark_h - 8, LINE_B, 1.0)
    e.T(mx + mark_w + 16, y + mark_h - 8, 'СВЕМА ЛАБ', e.f_display, TXT, 22,
        track=0.12)
    e.T(x + w / 2, y + mark_h + 22, 'ФОТО · ВИДЕО · ЭКСПЕРИМЕНТЫ', e.f_mono,
        TXT_MUTED, 8.2, track=0.22, align='center')
    yy = y + mark_h + 34
    e.line(x, yy, x + w, yy, LINE, 1.0)
    return yy


def site_dropzone(e, x, y, w, h):
    """Кадр-масса: рамка с угловыми метками, акцентная черта, подпись."""
    mid = y + h / 2 - 18
    e.fill_rect(x, y, w, h, PANEL)
    e.fill_rect(x, y, w, 1.0, (0.22, 0.22, 0.22))
    for (a, b, c, d) in [(x, y, x + w, y), (x, y + h, x + w, y + h),
                         (x, y, x, y + h), (x + w, y, x + w, y + h)]:
        e.line(a, b, c, d, LINE_S, 1.0)
    # угловые засечки — только два противоположных угла
    for (cx, cy, sx, sy) in [(x, y, 1, 1), (x + w, y + h, -1, -1)]:
        e.fill_rect(cx if sx > 0 else cx - 13, cy if sy > 0 else cy - 13, 13, 2, TXT)
        e.fill_rect(cx if sx > 0 else cx - 2, cy if sy > 0 else cy - 13, 2, 13, TXT)
    e.fill_rect(x + w / 2 - 14, mid - 22, 28, 2, ACC)
    e.T(x + w / 2, mid, 'Открыть кадр', e.f_display, TXT, 15, align='center')
    e.T(x + w / 2, mid + 18, 'Перетащите файл или нажмите, чтобы выбрать',
        e.f_mono, TXT_MUTED, 8, align='center')
    return h


def site_engine(e, x, y, w):
    """Три модуля в одной рамке: ламели вместо зазоров."""
    cards = [('Film Response', 'Кривые сенситометрии по трём слоям эмульсии'),
             ('Grain Engine', 'Зерно по плотности и проявке, не поверх картинки'),
             ('Halation · Bloom', 'Растекание света в эмульсии и противоореольном слое')]
    ch = 76.0
    cw = w / 3.0
    e.fill_rect(x, y, w, ch, BG)
    for (a, b, c, d) in [(x, y, x + w, y), (x, y + ch, x + w, y + ch),
                         (x, y, x, y + ch), (x + w, y, x + w, y + ch)]:
        e.line(a, b, c, d, LINE_S, 1.0)
    for i, (name, desc) in enumerate(cards):
        cx = x + i * cw
        if i:
            e.line(cx, y, cx, y + ch, LINE_S, 1.0)
        e.fill_rect(cx, y, cw, 1.0, (0.22, 0.22, 0.22))
        e.T(cx + 14, y + 24, name, e.f_bold, TXT, 9, track=0.02)
        e.par(cx + 14, y + 40, desc, 7.4, TXT_MUTED, cw - 28, 10.2)
    return ch


def site_footer(e, x, y, w):
    e.line(x, y, x + w, y, LINE, 1.0)
    yy = y + 22
    e.T(x, yy, 'TELEGRAM', e.f_mono, TXT, 7.6, track=0.14)
    e.T(x + 74, yy, 'GITHUB', e.f_mono, TXT, 7.6, track=0.14)
    # линейка-модулор: 12 делений
    lx, lw = x + 150, w - 150 - 130
    for i in range(13):
        px = lx + lw * i / 12.0
        e.fill_rect(px - 0.5, yy - 5, 1.0, 7.0 if i in (0, 12) else 4.0,
                    TXT if i in (0, 12) else LINE_B)
    e.T(x + w, yy, 'СВЕМА ЛАБ · 2025', e.f_mono, TXT_DIM, 7.6, align='right')


def page_site(e):
    e.begin_page(BG, w=PAGE_W, h=PAGE_H)
    e.label(MARGIN, MARGIN + 4, '19 — Сайт', c=(0.48, 0.48, 0.46), size=6.8)
    e.T(MARGIN, MARGIN + 26, 'Главный экран сайта', e.f_display, TXT, 17, track=-0.01)
    e.T(MARGIN, MARGIN + 42, 'Тот же язык, что в приложении: знак-опора, кадр-масса, '
        'линейка-модулор, воздух сверху', e.f_text, TXT_MUTED, 8)

    y = MARGIN + 60
    y = site_header(e, SITE_X, y, SITE_W) + 26
    y += site_dropzone(e, SITE_X, y, SITE_W, 148) + 14
    ui_button(e, SITE_X, y, SITE_W, 26, 'Загрузить RAW-файл (.RAF/.CR2/.NEF/…)',
              size=8)
    y += 44
    e.T(SITE_X, y, 'ЧТО ВНУТРИ ДВИЖКА', e.f_mono, TXT_MUTED, 7.4, track=0.2)
    y += 12
    y += site_engine(e, SITE_X, y, SITE_W) + 30
    site_footer(e, SITE_X, y, SITE_W)

    e.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34, (0.2, 0.2, 0.2), 0.6)
    e.label(MARGIN, PAGE_H - 22, 'СВЕМА ЛАБ — сайт', c=(0.45, 0.45, 0.43), size=6.4)
    e.label(PAGE_W - MARGIN, PAGE_H - 22, '19', c=(0.45, 0.45, 0.43), size=6.4,
            align='right')
    return PAGE_H
