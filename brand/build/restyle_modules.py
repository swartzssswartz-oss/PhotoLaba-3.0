# -*- coding: utf-8 -*-
"""
Перевод modules.css на фирменную систему: плоские поверхности, синий акцент,
без стекла и градиентов. Пиксельные замены — точечные, структура файла цела.
"""
import io
import os
import re
import sys

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    '..', '..', 'assets', 'styles', 'modules.css')

# --- градиентные «стеклянные» заливки -> плоские фирменные цвета
GRADIENTS = [
    ('linear-gradient(180deg, #ffffff 0%, #e2e2e6 100%)', 'var(--accent)'),
    ('linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.05) 100%)',
     'var(--panel-3)'),
    ('linear-gradient(165deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.12) 55%, '
     'rgba(255, 255, 255, 0.18) 100%)', 'var(--panel)'),
    ('linear-gradient(165deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.06) 55%, '
     'rgba(255, 255, 255, 0.12) 100%)', 'var(--panel)'),
    ('linear-gradient(180deg, #ffffff 0%, #eaeaee 100%)', 'var(--accent-hover)'),
    ('linear-gradient(180deg, #e2e2e6 0%, #d1d1d6 100%)', 'var(--accent-press)'),
    ('linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 50%, #1c1c1e 100%)', 'var(--bg)'),
    ('radial-gradient(circle at 35% 30%, #ffffff 0%, #f0f0f2 60%, #e2e2e6 100%)',
     'var(--text)'),
]

# --- размытие фона убираем целиком: оно осталось только от прежнего «стекла»
BLUR_LINES = [
    r'^\s*backdrop-filter:\s*blur\([^)]*\)[^;]*;\s*$',
    r'^\s*-webkit-backdrop-filter:\s*blur\([^)]*\)[^;]*;\s*$',
    r'^\s*backdrop-filter:\s*var\(--glass-blur\);\s*$',
    r'^\s*-webkit-backdrop-filter:\s*var\(--glass-blur\);\s*$',
]

# --- фирменные цвета вместо iOS-системных
COLORS = [
    ('#d9483a', 'var(--ch-r)'),
    ('#1f9e4a', 'var(--ch-g)'),
    ('#0a84ff', 'var(--ch-b)'),
    ('#34c759', 'var(--ok)'),
    ('#ff3b30', 'var(--danger)'),
    ('#f2f2f2', 'var(--text)'),
    ('#1c1c1e', 'var(--panel-3)'),
    ('#2c2c2e', 'var(--panel-3)'),
    ('#6e6e73', 'var(--text-muted)'),
]

# --- полупрозрачный белый из «стекла» -> поверхности и линии
#     порядок важен: длинные строки раньше коротких
RGBA = [
    ('rgba(255, 255, 255, 0.26)', 'var(--panel-3)'),
    ('rgba(255, 255, 255, 0.22)', 'var(--line-strong)'),
    ('rgba(255, 255, 255, 0.18)', 'var(--panel-3)'),
    ('rgba(255, 255, 255, 0.16)', 'var(--line-strong)'),
    ('rgba(255, 255, 255, 0.15)', 'var(--panel-3)'),
    ('rgba(255, 255, 255, 0.14)', 'var(--line-strong)'),
    ('rgba(255, 255, 255, 0.12)', 'var(--line)'),
    ('rgba(255, 255, 255, 0.10)', 'var(--line)'),
    ('rgba(255, 255, 255, 0.1)', 'var(--line)'),
    ('rgba(255, 255, 255, 0.08)', 'var(--panel-3)'),
    ('rgba(255, 255, 255, 0.06)', 'var(--line)'),
    ('rgba(255, 255, 255, 0.05)', 'var(--panel-2)'),
    ('rgba(255,255,255,0.22)', 'var(--line-bright)'),
    ('rgba(255,255,255,0.2)', 'var(--panel-3)'),
    ('rgba(255,255,255,.22)', 'var(--line-bright)'),
    ('rgba(255,255,255,.2)', 'var(--panel-3)'),
    ('rgba(255,255,255,.15)', 'var(--panel-3)'),
    ('rgba(255,255,255,.35)', 'var(--line-bright)'),
]

# rgba(0,0,0,α) как фон оверлеев -> плотный чёрный холст без стекла
BLACK_BG = [
    ('rgba(0, 0, 0, 0.75)', 'rgba(0, 0, 0, 0.9)'),
    ('rgba(0,0,0,0.75)', 'rgba(0, 0, 0, 0.9)'),
]


def main():
    text = io.open(PATH, encoding='utf-8').read()
    original = text

    for old, new in GRADIENTS + COLORS + BLACK_BG + RGBA:
        text = text.replace(old, new)

    # оставшиеся rgba(255, 255, 255, X) и rgba(255,255,255,X) -> поверхности/линии
    text = re.sub(r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.\d+\s*\)', 'var(--line)', text)

    # строки с blur убираем
    lines = text.split('\n')
    kept = []
    removed = 0
    for ln in lines:
        if any(re.match(p, ln) for p in BLUR_LINES):
            removed += 1
            continue
        kept.append(ln)
    text = '\n'.join(kept)

    # радиусы: только фирменные
    text = text.replace('border-radius: 999px', 'border-radius: var(--radius-sm)')
    text = text.replace('border-radius: 50px', 'border-radius: var(--radius-sm)')
    text = text.replace('border-radius: 20px', 'border-radius: var(--radius-md)')
    text = text.replace('border-radius: 16px', 'border-radius: var(--radius-md)')
    text = text.replace('border-radius: 14px', 'border-radius: var(--radius-md)')
    text = text.replace('border-radius: 12px', 'border-radius: var(--radius-sm)')
    text = text.replace('border-radius: 10px', 'border-radius: var(--radius-sm)')
    text = text.replace('border-radius: 8px', 'border-radius: var(--radius-sm)')

    # мягкие «стеклянные» тени убираем
    text = re.sub(r'box-shadow:\s*var\(--glass-rim\)[^;]*;', 'box-shadow: none;', text)
    text = re.sub(r'box-shadow:\s*var\(--btn-shadow\)[^;]*;', 'box-shadow: none;', text)
    text = re.sub(r'box-shadow:\s*var\(--btn-shadow-accent\)[^;]*;', 'box-shadow: none;', text)
    text = re.sub(r'box-shadow:\s*var\(--btn-shadow-active\)[^;]*;', 'box-shadow: none;', text)
    text = re.sub(r'box-shadow:\s*0 \d+px \d+px rgba\(\s*0,\s*0,\s*0,\s*[\d.]+\s*\)[^;]*;',
                  'box-shadow: none;', text)

    io.open(PATH, 'w', encoding='utf-8').write(text)

    print('удалено строк с blur:', removed)
    print('осталось linear-gradient:', text.count('linear-gradient'))
    print('осталось blur(:', text.count('blur('))
    print('осталось #d9483a/#1f9e4a/#0a84ff:', text.count('#d9483a') + text.count('#1f9e4a') + text.count('#0a84ff'))
    print('размер:', len(original), '->', len(text))


if __name__ == '__main__':
    main()
