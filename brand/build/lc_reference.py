# -*- coding: utf-8 -*-
"""
Страница-словарь: пять приёмов Ле Корбюзье и то, во что каждый превращается
в интерфейсе. Слева — приём, справа — маленькая схема из тех же элементов,
что и в макетах, поэтому страница читается как продолжение приложения.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import PT, MARGIN, BLUE_BRIGHT, BLUE, PAPER
from interface_pages import (BG, PANEL, PANEL2, PANEL3, LINE, LINE_S, LINE_B,
                             TXT, TXT_SOFT, TXT_MUTED, TXT_DIM, ACC, ACC_DEEP,
                             ACTIVE_BG, ACTIVE_FG, PAGE_W, PAGE_H)

PAD = 60.0


def demo_frame(e, x, y, w, h):
    e.fill_rect(x, y, w, h, BG)
    for (a, b, c, d) in [(x, y, x + w, y), (x, y + h, x + w, y + h),
                         (x, y, x, y + h), (x + w, y, x + w, y + h)]:
        e.line(a, b, c, d, LINE_S, 1.0)


def demo_pilotis(e, x, y, w, h):
    """Столбы-опоры: белые линии держат массу, между ними — воздух."""
    demo_frame(e, x, y, w, h)
    e.fill_rect(x + 8, y + 8, w - 16, h * 0.3, PANEL3)
    e.fill_rect(x + 8, y + 8, w - 16, 1.0, (0.22, 0.22, 0.22))
    for i in range(6):
        px = x + 12 + (w - 26) * i / 5.0
        e.fill_rect(px, y + h * 0.38, 1.4, h * 0.46, TXT if i in (0, 5) else LINE_B)


def demo_plan(e, x, y, w, h):
    """Свободный план: асимметрия и пустое поле вместо равномерной сетки."""
    demo_frame(e, x, y, w, h)
    e.fill_rect(x + 6, y + 6, w * 0.3, h - 12, PANEL2)
    e.fill_rect(x + w * 0.52, y + 6, w * 0.42, h * 0.42, PANEL3)
    e.line(x + w * 0.36, y + 6, x + w * 0.36, y + h - 6, LINE_B, 1.0)


def demo_brise(e, x, y, w, h):
    """Брис-солей: вертикальные ламели отделяют, а не закрашивают."""
    demo_frame(e, x, y, w, h)
    for i in range(1, 6):
        px = x + w * i / 6.0
        e.fill_rect(px, y + 6, 1.0, h - 12, TXT if i == 3 else LINE_B)
    e.fill_rect(x + 6, y + h * 0.34, w - 12, 1.0, LINE_S)


def demo_roof(e, x, y, w, h):
    """Сад на крыше: белое поле вверху — пауза в ритме, а не пустота."""
    demo_frame(e, x, y, w, h)
    e.fill_rect(x + 6, y + h * 0.42, w - 12, 1.0, LINE_S)
    e.fill_rect(x + 10, y + 8, w * 0.5, 2.0, TXT)
    e.fill_rect(x + 10, y + h * 0.62, w * 0.3, 2.0, LINE_B)
    e.fill_rect(x + 10, y + h * 0.78, w * 0.18, 2.0, LINE_B)


def demo_modulor(e, x, y, w, h):
    """Модулор: шкала с делениями под дорожкой — размер читается, не измеряясь."""
    demo_frame(e, x, y, w, h)
    mid = y + h * 0.52
    e.fill_rect(x + 8, mid, w - 16, 2.0, LINE_B)
    e.fill_rect(x + 8, mid, (w - 16) * 0.42, 2.0, ACC)
    e.fill_rect(x + 8 + (w - 16) * 0.42 - 3.5, mid - 5, 7, 12, TXT)
    for i in range(7):
        px = x + 8 + (w - 16) * i / 6.0
        edge = i in (0, 6)
        e.fill_rect(px - 0.5, mid + 8, 1.0, 6.0 if edge else 4.0,
                    TXT if edge else LINE_B)


POINTS = [
    ('Столбы-опоры', 'Pilotis',
     'Конструкция видна и работает: белые волосяные линии держат композицию — '
     'рамки кнопок, метки панелей, разделители. Декора нет, есть несущее.',
     demo_pilotis),
    ('Свободный план', 'Plan libre',
     'Раскладка асимметрична: список плёнок — 176 px, параметры — 236 px, центр '
     'отдан кадру. Ровные доли дают вялость, асимметрия — направление.',
     demo_plan),
    ('Брис-солей', 'Brise-soleil',
     'Ламели вместо глухой стены: вертикальные белые линии между вкладками и '
     'сегментами отделяют зоны, но не закрашивают их.',
     demo_brise),
    ('Сад на крыше', 'Toit-jardin',
     'Белое поле вверху каждого блока и вокруг кадра — пауза в ритме. Пустое '
     'место здесь так же важно, как залитое.',
     demo_roof),
    ('Модулор', 'Le Modulor',
     'Пропорция как инструмент: дорожка слайдера получает шкалу с делениями, '
     'крайние — белые. Значение читается на глаз, без числа.',
     demo_modulor),
]


def page_app_lc(e):
    e.begin_page(BG, w=PAGE_W, h=PAGE_H)
    e.label(MARGIN, MARGIN + 4, '18 — Словарь', c=(0.48, 0.48, 0.46), size=6.8)
    e.T(MARGIN, MARGIN + 26, 'Нотка Ле Корбюзье: пять приёмов', e.f_display, TXT, 17,
        track=-0.01)
    e.T(MARGIN, MARGIN + 42, 'Не орнамент, а конструкция: каждый приём что-то '
        'держит, разделяет или измеряет', e.f_text, TXT_MUTED, 8)

    top = MARGIN + 66
    row_h = 100.0
    lab_w = 150.0
    demo_w = 280.0
    txt_w = PAGE_W - 2 * MARGIN - lab_w - demo_w - 3 * 18

    for i, (title, sub, text, demo) in enumerate(POINTS):
        y = top + i * row_h
        e.line(MARGIN, y - 12, PAGE_W - MARGIN, y - 12, LINE, 1.0)
        e.T(MARGIN, y + 10, title, e.f_display, TXT, 12.5, track=-0.005)
        e.T(MARGIN, y + 24, sub.upper(), e.f_mono, ACC, 6.8)
        e.T(MARGIN, y + 38, 'Приём %d из 5' % (i + 1), e.f_mono, TXT_DIM, 6.4)
        demo(e, MARGIN + lab_w, y - 4, demo_w, row_h - 24)
        e.par(MARGIN + lab_w + demo_w + 18, y + 8, text, 8.2, TXT_SOFT, txt_w, 11.6)

    e.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34, (0.2, 0.2, 0.2), 0.6)
    e.label(MARGIN, PAGE_H - 22, 'СВЕМА ЛАБ — интерфейс приложения',
            c=(0.45, 0.45, 0.43), size=6.4)
    e.label(PAGE_W - MARGIN, PAGE_H - 22, '18', c=(0.45, 0.45, 0.43), size=6.4,
            align='right')
    return PAGE_H
