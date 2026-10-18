# -*- coding: utf-8 -*-
"""
Учебный растеризатор для PDF, которые строит pdfwriter.py.
Поддерживает ровно тот набор операторов, который использует генератор брендбука:
контуры (m l c v y h re), заливку (f F f* B), обводку (S s), клип (W n),
текст (BT/ET, Tf, Td, TD, Tm, Tj, TJ, TL, T*, Tc, Tw, Tz), состояние (q/Q, cm, w, J, j),
цвет (rg, RG, g, G, k, K), XObject-формы (Do) — нужен для Type3-глифов.

Это диагностический инструмент для визуальной проверки вёрстки, не полноценный
просмотрщик PDF.
"""

import re
import zlib
import numpy as np

PT = 72.0 / 25.4  # мм -> пункты


# ---------------------------------------------------------------- объекты

class Obj:
    def __init__(self, raw):
        self.raw = raw
        self.dict = None
        self.stream = None
        self._parse()

    def _parse(self):
        raw = self.raw
        if not raw.lstrip().startswith(b'<<'):
            self.dict = {}
            self.stream = raw
            return
        i = raw.find(b'stream')
        if i == -1:
            self.dict = parse_dict(raw)
            self.stream = None
            return
        head = raw[:i]
        self.dict = parse_dict(head)
        j = i + len(b'stream')
        if raw[j:j + 2] == b'\r\n':
            j += 2
        elif raw[j:j + 1] in (b'\n', b'\r'):
            j += 1
        end = raw.rfind(b'endstream')
        data = raw[j:end]
        if self.dict.get('Filter') == '/FlateDecode':
            try:
                data = zlib.decompress(data)
            except Exception:
                pass
        self.stream = data

    def __getitem__(self, k):
        return self.dict.get(k)


def parse_dict(b):
    """Очень простой парсер словарей PDF (плоский, но с вложенными << >> и массивами)."""
    s = b.decode('latin-1')
    out = {}
    i = s.find('<<')
    if i == -1:
        return out
    i += 2
    n = len(s)
    while i < n:
        while i < n and s[i] in ' \r\n\t':
            i += 1
        if i >= n or s[i:i + 2] == '>>':
            break
        if s[i] != '/':
            i += 1
            continue
        j = i + 1
        while j < n and s[j] not in ' \r\n\t/<>[]()':
            j += 1
        key = s[i + 1:j]
        while j < n and s[j] in ' \r\n\t':
            j += 1
        val, j = _value(s, j)
        out[key] = val
        i = j
    return out


def _value(s, i):
    n = len(s)
    if s[i:i + 2] == '<<':
        depth = 0
        j = i
        while j < n:
            if s[j:j + 2] == '<<':
                depth += 1; j += 2; continue
            if s[j:j + 2] == '>>':
                depth -= 1; j += 2
                if depth == 0:
                    break
                continue
            j += 1
        return parse_dict(s[i:j].encode('latin-1')), j
    if s[i] == '[':
        depth = 0
        j = i
        while j < n:
            if s[j] == '[':
                depth += 1
            elif s[j] == ']':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        body = s[i + 1:j - 1]
        items = []
        k = 0
        while k < len(body):
            while k < len(body) and body[k] in ' \r\n\t':
                k += 1
            if k >= len(body):
                break
            v, k = _value(body, k)
            items.append(v)
        return items, j
    if s[i] == '/':
        j = i + 1
        while j < n and s[j] not in ' \r\n\t/<>[]()':
            j += 1
        return s[i:j], j
    if s[i] == '(':
        depth = 0
        j = i
        buf = []
        while j < n:
            c = s[j]
            if c == '\\':
                buf.append(s[j + 1]); j += 2; continue
            if c == '(':
                depth += 1
                if depth == 1:
                    j += 1; continue
            elif c == ')':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            buf.append(c); j += 1
        return ('str', ''.join(buf)), j
    m = re.match(r'[-+]?[\d.]+', s[i:])
    if m:
        t = m.group(0)
        j = i + len(t)
        if re.match(r'^\d+ \d+ R$', s[j:j + 12].strip()[:12]) or re.match(r'^\s+\d+\s+R', s[j:j + 12]):
            m2 = re.match(r'\s+(\d+)\s+R', s[j:j + 20])
            if m2:
                return ('ref', int(t), int(m2.group(1))), j + m2.end()
        return (float(t) if ('.' in t or 'e' in t.lower()) else int(t)), j
    return None, i + 1


class Doc:
    def __init__(self, path):
        with open(path, 'rb') as f:
            self.data = f.read()
        self.objs = {}
        for m in re.finditer(rb'(\d+)\s+0\s+obj\b', self.data):
            num = int(m.group(1))
            start = m.end()
            end = self.data.find(b'endobj', start)
            if end == -1:
                end = len(self.data)
            self.objs[num] = Obj(self.data[start:end])

    def get(self, num):
        return self.objs.get(num)

    def resolve(self, v):
        if isinstance(v, tuple) and len(v) == 3 and v[0] == 'ref':
            return self.get(v[1])
        return v

    def pages(self):
        root = None
        for o in self.objs.values():
            if o.dict and o.dict.get('Type') == '/Catalog':
                root = o
                break
        if root is None:
            return []
        pages_ref = root['Pages']
        node = self.resolve(pages_ref)
        out = []

        def walk(n):
            if not n or not n.dict:
                return
            if n.dict.get('Type') == '/Page':
                out.append(n)
                return
            for k in n.dict.get('Kids', []) or []:
                walk(self.resolve(k))
        walk(node)
        return out


# ---------------------------------------------------------------- матрицы

def mat_mul(a, b):
    return (a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
            a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
            a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5])


def mat_apply(m, x, y):
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


class Canvas:
    """Канва с покрытием: заливка контуров по правилу ненулевого обхода."""

    def __init__(self, w, h, dpi, bg=(1, 1, 1)):
        self.dpi = dpi
        self.w = int(round(w / 72.0 * dpi))
        self.h = int(round(h / 72.0 * dpi))
        self.img = np.empty((self.h, self.w, 3), dtype=np.float32)
        self.img[:, :] = bg
        self.scale = dpi / 72.0

    def _dev(self, x, y):
        return (x * self.scale, self.h - y * self.scale)

    def fill(self, subpaths, color, rule='nonzero', alpha=1.0):
        edges = []
        for sp in subpaths:
            pts = [self._dev(x, y) for (x, y) in sp]
            if len(pts) < 3:
                continue
            for i in range(len(pts)):
                x0, y0 = pts[i]
                x1, y1 = pts[(i + 1) % len(pts)]
                if y0 != y1:
                    edges.append((x0, y0, x1, y1))
        if not edges:
            return
        ys = [e[1] for e in edges] + [e[3] for e in edges]
        y0 = max(0, int(np.floor(min(ys))))
        y1 = min(self.h - 1, int(np.ceil(max(ys))))
        if y1 < y0:
            return
        r, g, b = color
        for py in range(y0, y1 + 1):
            sy = py + 0.5
            xs = []
            for (ax, ay, bx, by) in edges:
                if (ay <= sy < by) or (by <= sy < ay):
                    t = (sy - ay) / (by - ay)
                    xs.append((ax + t * (bx - ax), 1 if by > ay else -1))
            if not xs:
                continue
            xs.sort()
            spans = []
            wind = 0
            start = None
            for x, d in xs:
                prev = wind
                wind += d
                if rule == 'nonzero':
                    if prev == 0 and wind != 0:
                        start = x
                    elif prev != 0 and wind == 0 and start is not None:
                        spans.append((start, x)); start = None
                else:
                    if (prev % 2 == 0) and (wind % 2 != 0):
                        start = x
                    elif (prev % 2 != 0) and (wind % 2 == 0) and start is not None:
                        spans.append((start, x)); start = None
            for (sx, ex) in spans:
                px0 = max(0, int(np.floor(sx - 0.5)))
                px1 = min(self.w - 1, int(np.ceil(ex + 0.5)))
                if px1 < px0:
                    continue
                cov = np.clip(np.minimum(ex, np.arange(px0, px1 + 1) + 1.0)
                              - np.maximum(sx, np.arange(px0, px1 + 1)), 0, 1)
                if alpha < 1.0:
                    cov = cov * alpha
                row = self.img[py, px0:px1 + 1]
                src = np.array(color, dtype=np.float32)
                self.img[py, px0:px1 + 1] = row * (1 - cov[:, None]) + src[None, :] * cov[:, None]


# ---------------------------------------------------------------- интерпретатор

NUM = r'[-+]?(?:\d+\.?\d*|\.\d+)'
TOKEN_RE = re.compile(rb'''
    (?P<num>[-+]?(?:\d+\.?\d*|\.\d+))
  | (?P<str>\((?:\\.|[^\\()])*\))
  | (?P<hex><[0-9A-Fa-f\s]*>)
  | (?P<name>/[^\s/<>\[\]()]+)
  | (?P<op>[A-Za-z'"*]+)
  | (?P<arr>[\[\]])
''', re.VERBOSE)


class Interp:
    def __init__(self, doc, page, canvas, resources=None):
        self.doc = doc
        self.page = page
        self.cv = canvas
        self.res = resources or page['Resources']
        self.stack = []
        self.gs = {'ctm': (1, 0, 0, 1, 0, 0), 'fill': (0, 0, 0), 'stroke': (0, 0, 0),
                   'lw': 1.0, 'cap': 0, 'join': 0, 'dash': None, 'font': None,
                   'size': 1.0, 'tc': 0.0, 'tw': 0.0, 'tz': 100.0, 'tl': 0.0}
        self.path = []
        self.sub = []
        self.tm = (1, 0, 0, 1, 0, 0)
        self.tlm = self.tm
        self.leading = 0.0

    # --- ресурсы
    def _font(self, name):
        fonts = self.res.get('Font', {}) if isinstance(self.res, dict) else {}
        ref = fonts.get(name[1:]) if isinstance(fonts, dict) else None
        return self.doc.resolve(ref)

    def _xobject(self, name):
        xo = self.res.get('XObject', {}) if isinstance(self.res, dict) else {}
        ref = xo.get(name[1:]) if isinstance(xo, dict) else None
        return self.doc.resolve(ref)

    # --- цвета
    def _set_fill(self, ops):
        if ops[-1] in (b'rg',):
            self.gs['fill'] = tuple(self.stack[-3:])
        elif ops[-1] in (b'g',):
            v = self.stack[-1]
            self.gs['fill'] = (v, v, v)
        elif ops[-1] in (b'k',):
            c, m, y, k = self.stack[-4:]
            self.gs['fill'] = ((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k))
        elif ops[-1] in (b'sc', b'scn'):
            v = self.stack[-1]
            if isinstance(v, (int, float)):
                self.gs['fill'] = (v, v, v)
            else:
                self.gs['fill'] = tuple(self.stack[-3:])
        elif ops[-1] == b'RG':
            self.gs['stroke'] = tuple(self.stack[-3:])
        elif ops[-1] == b'G':
            v = self.stack[-1]
            self.gs['stroke'] = (v, v, v)
        elif ops[-1] == b'K':
            c, m, y, k = self.stack[-4:]
            self.gs['stroke'] = ((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k))

    # --- путь
    def _re(self):
        x, y, w, h = self.stack[-4:]
        self._m(x, y); self._l(x + w, y); self._l(x + w, y + h); self._l(x, y + h); self._h()

    def _m(self, x=None, y=None):
        if x is None:
            x, y = self.stack[-2:]
        self._flush_sub()
        self.cur = (x, y)

    def _l(self, x=None, y=None):
        if x is None:
            x, y = self.stack[-2:]
        if getattr(self, 'cur', None) is None:
            self.cur = (x, y)
            return
        self.sub.append(self.cur)
        self.cur = (x, y)

    def _c(self):
        x1, y1, x2, y2, x3, y3 = self.stack[-6:]
        x0, y0 = self.cur
        for i in range(1, 17):
            t = i / 16.0
            mt = 1 - t
            bx = (mt ** 3 * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t ** 3 * x3)
            by = (mt ** 3 * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t ** 3 * y3)
            self._l(bx, by)
        self.cur = (x3, y3)

    def _v(self):
        x2, y2, x3, y3 = self.stack[-4:]
        x0, y0 = self.cur
        self.stack += []
        x1, y1 = x0, y0
        for i in range(1, 17):
            t = i / 16.0
            mt = 1 - t
            bx = (mt ** 3 * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t ** 3 * x3)
            by = (mt ** 3 * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t ** 3 * y3)
            self._l(bx, by)
        self.cur = (x3, y3)

    def _y(self):
        x1, y1, x3, y3 = self.stack[-4:]
        x0, y0 = self.cur
        x2, y2 = x3, y3
        for i in range(1, 17):
            t = i / 16.0
            mt = 1 - t
            bx = (mt ** 3 * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t ** 3 * x3)
            by = (mt ** 3 * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t ** 3 * y3)
            self._l(bx, by)
        self.cur = (x3, y3)

    def _h(self):
        if getattr(self, 'cur', None) is not None and self.sub:
            self.sub.append(self.cur)
            self.cur = self.sub[0]
            self.sub.append(self.cur)
        self._flush_sub()

    def _flush_sub(self):
        # PDF: close/end контура неявно соединяет текущую точку с началом,
        # поэтому текущую точку нужно включить в подпуть явно
        if getattr(self, 'sub', None) and getattr(self, 'cur', None) is not None \
                and self.cur != self.sub[-1]:
            self.sub.append(self.cur)
        if getattr(self, 'sub', None):
            if len(self.sub) >= 2:
                self.path.append([mat_apply(self.gs['ctm'], x, y) for (x, y) in self.sub])
            self.sub = []
        self.cur = None

    def _fill(self, rule='nonzero'):
        self._flush_sub()
        if self.path:
            self.cv.fill(self.path, self.gs['fill'], rule)
        self.path = []

    def _stroke(self):
        self._flush_sub()
        # тонкая обводка: рисуем как заливку «утолщённого» пути по нормалям
        lw = self.gs['lw'] * self.cv.scale * 0.5
        for sp in self.path:
            self._stroke_path(sp, lw)
        self.path = []

    def _stroke_path(self, sp, half):
        left, right = [], []
        n = len(sp)
        # направление сегмента i: (p[i+1]-p[i]); для вырожденного сегмента берём
        # направление следующего, иначе вертикальные/горизонтальные линии терялись
        dirs = []
        for i in range(n):
            x0, y0 = sp[i]
            x1, y1 = sp[(i + 1) % n]
            dx, dy = x1 - x0, y1 - y0
            if dx == 0 and dy == 0:
                dx, dy = 0.0, 0.0
                for j in range(1, n):
                    k = (i + j) % n
                    m = (i + j + 1) % n
                    dx = sp[m][0] - sp[k][0]
                    dy = sp[m][1] - sp[k][1]
                    if dx or dy:
                        break
            L = (dx * dx + dy * dy) ** 0.5 or 1.0
            dirs.append((-dy / L, dx / L))
        for i in range(n):
            x0, y0 = sp[i]
            nx, ny = dirs[i][0] * half, dirs[i][1] * half
            if nx == 0 and ny == 0:
                nx, ny = half, half
            left.append((x0 + nx, y0 + ny))
            right.append((x0 - nx, y0 - ny))
        poly = left + right[::-1]
        self.cv.fill([poly], self.gs['stroke'])

    # --- текст
    def _next_token(self, data, pos):
        m = TOKEN_RE.match(data, pos)
        if not m:
            return None, pos + 1
        return m, m.end()

    def run(self, data):
        stack = self.stack
        pos = 0
        n = len(data)
        while pos < n:
            m = TOKEN_RE.match(data, pos)
            if not m:
                pos += 1
                continue
            pos = m.end()
            if m.lastgroup == 'num':
                stack.append(float(m.group('num')))
                continue
            if m.lastgroup == 'str':
                s = m.group('str')[1:-1]
                stack.append(('bytes', decode_pdf_string_bytes(s)))
                continue
            if m.lastgroup == 'hex':
                h = re.sub(rb'\s+', b'', m.group('hex')[1:-1])
                if len(h) % 2:
                    h += b'0'
                stack.append(('bytes', bytes.fromhex(h.decode('ascii'))))
                continue
            if m.lastgroup == 'name':
                stack.append(m.group('name').decode('latin-1'))
                continue
            if m.lastgroup == 'arr':
                stack.append(m.group('arr').decode('latin-1'))
                continue
            op = m.group('op')
            try:
                self.exec_op(op, data, pos)
            except Exception:
                pass
            if op in (b'BT', b'ET'):
                stack = self.stack
        return

    ARITY = dict([(k.encode('ascii'), v) for k, v in {
        'rg': 3, 'g': 1, 'k': 4, 'RG': 3, 'G': 1, 'K': 4,
        'sc': 1, 'scn': 1, 'SC': 1, 'SCN': 1, 'cs': 1, 'CS': 1,
        're': 4, 'm': 2, 'l': 2, 'c': 6, 'v': 4, 'y': 4, 'h': 0,
        'f': 0, 'F': 0, 'f*': 0, 'S': 0, 's': 0, 'B': 0, 'B*': 0,
        'b': 0, 'b*': 0, 'n': 0, 'W': 0, 'W*': 0, 'q': 0, 'Q': 0,
        'cm': 6, 'w': 1, 'J': 1, 'j': 1, 'd': 2, 'ri': 1, 'i': 1,
        'gs': 1, 'BT': 0, 'ET': 0, 'Tf': 2, 'Td': 2, 'TD': 2,
        'Tm': 6, 'T*': 0, 'TL': 1, 'Tc': 1, 'Tw': 1, 'Tz': 1, 'Tr': 1,
        'Tj': 1, "'": 1, '"': 3, 'TJ': 1, 'Do': 1, 'sh': 1, 'BI': 1,
    }.items()])

    def exec_op(self, op, data, pos):
        st = self.stack
        if op in (b'rg', b'g', b'k', b'RG', b'G', b'K', b'sc', b'scn', b'SC', b'SCN'):
            self._set_fill([op])
        elif op == b're':
            self._re()
        elif op == b'm':
            self._m()
        elif op == b'l':
            self._l()
        elif op in (b'c',):
            self._c()
        elif op in (b'v',):
            self._v()
        elif op in (b'y',):
            self._y()
        elif op == b'h':
            self._h()
        elif op in (b'f', b'F', b'f*'):
            self._fill('evenodd' if op == b'f*' else 'nonzero')
        elif op in (b'S', b's'):
            if op == b's':
                self._h()
            self._stroke()
        elif op in (b'B', b'B*', b'b', b'b*'):
            if op in (b'b', b'b*'):
                self._h()
            rule = 'evenodd' if op in (b'B*', b'b*') else 'nonzero'
            saved = list(self.path)
            self._fill(rule)
            for sp in saved:
                self._stroke_path(sp, self.gs['lw'] * self.cv.scale * 0.5)
        elif op == b'n':
            self._flush_sub(); self.path = []
        elif op == b'W':
            self._flush_sub()
            self.clip = list(self.path)
        elif op == b'W*':
            self._flush_sub()
            self.clip = list(self.path)
        elif op == b'q':
            self.stack_q = getattr(self, 'stack_q', [])
            self.stack_q.append(dict(self.gs))
        elif op == b'Q':
            self.stack_q = getattr(self, 'stack_q', [])
            if self.stack_q:
                self.gs = self.stack_q.pop()
        elif op == b'cm':
            self.gs['ctm'] = mat_mul(tuple(st[-6:]), self.gs['ctm'])
        elif op == b'w':
            self.gs['lw'] = st[-1]
        elif op == b'J':
            self.gs['cap'] = st[-1]
        elif op == b'j':
            self.gs['join'] = st[-1]
        elif op == b'd':
            pass
        elif op == b'BT':
            self.tm = (1, 0, 0, 1, 0, 0)
            self.tlm = self.tm
        elif op == b'ET':
            pass
        elif op == b'Tf':
            self.gs['font'] = st[-2]
            self.gs['size'] = st[-1]
        elif op == b'Td':
            self._td(st[-2], st[-1])
        elif op == b'TD':
            self.leading = -st[-1]
            self._td(st[-2], st[-1])
        elif op == b'Tm':
            self.tm = tuple(st[-6:])
            self.tlm = self.tm
        elif op == b'T*':
            self._td(0, -self.leading)
        elif op == b'TL':
            self.leading = st[-1]
        elif op == b'Tc':
            self.gs['tc'] = st[-1]
        elif op == b'Tw':
            self.gs['tw'] = st[-1]
        elif op == b'Tz':
            self.gs['tz'] = st[-1]
        elif op == b'Tr':
            self.gs['render'] = st[-1]
        elif op == b'Tj':
            s = st[-1]
            if isinstance(s, tuple):
                self._show(s[1])
        elif op == b"'":
            self._td(0, -self.leading)
            s = st[-1]
            if isinstance(s, tuple):
                self._show(s[1])
        elif op == b'"':
            self.gs['tw'] = st[-3]
            self.gs['tc'] = st[-2]
            self._td(0, -self.leading)
            s = st[-1]
            if isinstance(s, tuple):
                self._show(s[1])
        elif op == b'TJ':
            arr = st[-1]
            if isinstance(arr, list):
                for it in arr:
                    if isinstance(it, tuple) and it[0] in ('bytes', 'str'):
                        self._show(it[1])
                    elif isinstance(it, (int, float)):
                        self.tm = mat_mul((1, 0, 0, 1, -it / 1000.0 * self.gs['size'], 0), self.tm)
        elif op == b'Do':
            name = st[-1]
            if isinstance(name, str) and name.startswith('/'):
                self._do_xobject(name)
        k = self.ARITY.get(op, len(st))
        if k <= 0:
            st.clear()
        else:
            del st[len(st) - k:]

    def _td(self, tx, ty):
        self.tlm = mat_mul((1, 0, 0, 1, tx, ty), self.tlm)
        self.tm = self.tlm

    def _show(self, s):
        font = self._font(self.gs['font']) if self.gs.get('font') else None
        if font is None or not font.dict:
            return
        upem_scale = (font['FontMatrix'] or [0.001])[0]
        widths = font['Widths'] or []
        first = int(font['FirstChar'] or 0)
        charprocs = self.doc.resolve(font['CharProcs'])
        charprocs = charprocs.dict if (charprocs is not None and charprocs.dict is not None) else {}
        gidmap = font['SLGidMap'] if isinstance(font['SLGidMap'], dict) else None
        name_by_code = {}
        enc = font['Encoding'] or {}
        diffs = enc.get('Differences') if isinstance(enc, dict) else None
        if isinstance(diffs, list):
            idx = first
            for item in diffs:
                if isinstance(item, (int, float)):
                    idx = int(item)
                elif isinstance(item, str):
                    name_by_code[idx] = item[1:]
                    idx += 1
        size = self.gs['size']
        if isinstance(s, str):
            s = s.encode('latin-1', 'replace')
        for code in s:
            w = 0.0
            if 0 <= code - first < len(widths):
                try:
                    w = float(widths[code - first])
                except Exception:
                    w = 0.0
            gl = self.doc.resolve(charprocs.get('g%d' % code))
            if gl is not None and gl.stream:
                self._draw_glyph(gl, font, size)
            adv = (w / 1000.0 + self.gs['tc'] + self.gs['tw']) * size
            if self.gs['tz'] != 100.0:
                adv *= self.gs['tz'] / 100.0
            self.tm = mat_mul((1, 0, 0, 1, adv, 0), self.tm)

    def _draw_glyph(self, gl, font, size):
        if gl is None or not gl.stream:
            return
        # Type3: содержимое глифа в собственной системе (FontMatrix уже включает d1)
        fm = font['FontMatrix'] or [0.001, 0, 0, 0.001, 0, 0]
        m = (fm[0], fm[1], fm[2], fm[3], fm[4], fm[5])
        base = mat_mul((size, 0, 0, size, 0, 0), self.tm)
        full = mat_mul(m, base)
        full = mat_mul(full, self.gs['ctm'])
        sub = Interp(self.doc, self.page, self.cv, resources={})
        sub.gs['ctm'] = full
        sub.gs['fill'] = self.gs['fill']
        sub.gs['lw'] = 0.0
        try:
            sub.run(gl.stream)
        except Exception:
            pass

    def _do_xobject(self, name):
        xo = self._xobject(name)
        if xo is None:
            return
        if xo['Subtype'] == '/Form':
            sub = Interp(self.doc, self.page, self.cv, resources=xo['Resources'] or {})
            mm = xo['Matrix'] or [1, 0, 0, 1, 0, 0]
            sub.gs['ctm'] = mat_mul(tuple(mm), self.gs['ctm'])
            sub.run(xo.stream or b'')


def decode_pdf_string_bytes(b):
    out = []
    i = 0
    while i < len(b):
        c = b[i]
        if c == 0x5C and i + 1 < len(b):
            nxt = b[i + 1:i + 2]
            mapping = {b'n': b'\n', b'r': b'\r', b't': b'\t', b'b': b'\b',
                       b'f': b'\f', b'(': b'(', b')': b')', b'\\': b'\\'}
            if nxt in mapping:
                out.append(mapping[nxt]); i += 2; continue
            if nxt.isdigit():
                j = i + 1
                oct_digits = b''
                while j < len(b) and len(oct_digits) < 3 and b[j:j + 1].isdigit():
                    oct_digits += b[j:j + 1]; j += 1
                out.append(bytes([int(oct_digits, 8) & 0xFF])); i = j; continue
            i += 2; continue
        out.append(bytes([c])); i += 1
    return b''.join(out)


def render_page(doc, page, dpi=110, bg=(1, 1, 1)):
    box = page['MediaBox'] or [0, 0, 595.276, 841.89]
    w = float(box[2]) - float(box[0])
    h = float(box[3]) - float(box[1])
    cv = Canvas(w, h, dpi, bg=bg)
    content = doc.resolve(page['Contents'])
    data = content.stream if content is not None else b''
    it = Interp(doc, page, cv, resources=page['Resources'] or {})
    it.run(data)
    return cv.img


def save_png(img, path):
    from PIL import Image
    arr = np.clip(img * 255.0 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(arr).save(path)
