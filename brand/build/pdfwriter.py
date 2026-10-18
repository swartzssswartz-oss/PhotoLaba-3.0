# -*- coding: utf-8 -*-
"""
Минимальный PDF-генератор с встраиванием TrueType-шрифтов (Type3, 8-битная
кодировка через Differences + ToUnicode). Без внешних зависимостей.

Зачем свой: в песочнице недоступны ни браузер (headless-рендер), ни установка
reportlab, поэтому PDF собирается напрямую.
"""

import os
import struct
import zlib


def _fmt(v):
    s = '%.8f' % float(v)
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    return s if s not in ('', '-0') else '0'


def _pdfstr(s):
    out = []
    for ch in s:
        if ch in '\\()':
            out.append('\\' + ch)
        elif 32 <= ord(ch) < 127:
            out.append(ch)
        else:
            out.append('_')
    return ''.join(out)


# ---------------------------------------------------------------- TTF

class TTF:
    """Контуры глифов, метрики и карта символов TrueType."""

    def __init__(self, path):
        with open(path, 'rb') as f:
            self.data = f.read()
        d = self.data
        numTables = struct.unpack('>H', d[4:6])[0]
        tables = {}
        off = 12
        for _ in range(numTables):
            t, cks, o, l = struct.unpack('>4sIII', d[off:off + 16])
            tables[t.decode('latin-1')] = (o, l)
            off += 16
        self.tables = tables
        head = tables['head'][0]
        self.upem = struct.unpack('>H', d[head + 18:head + 20])[0]
        self.head_bbox = struct.unpack('>hhhh', d[head + 36:head + 44])
        self.indexToLocFormat = struct.unpack('>h', d[head + 50:head + 52])[0]
        maxp = tables['maxp'][0]
        self.numGlyphs = struct.unpack('>H', d[maxp + 4:maxp + 6])[0]
        self.numHMetrics = struct.unpack('>H', d[maxp + 34:maxp + 36])[0]
        self.loca = self._loca()
        self.cmap = self._cmap()
        self.advances = self._hmtx()
        self._cache = {}

    def _loca(self):
        o = self.tables['loca'][0]
        n = self.numGlyphs + 1
        if self.indexToLocFormat == 0:
            return [x * 2 for x in struct.unpack('>%dH' % n, self.data[o:o + 2 * n])]
        return list(struct.unpack('>%dI' % n, self.data[o:o + 4 * n]))

    def _cmap(self):
        d = self.data
        o = self.tables['cmap'][0]
        n = struct.unpack('>H', d[o + 2:o + 4])[0]
        best = None
        for i in range(n):
            pid, eid, sub = struct.unpack('>HHI', d[o + 4 + i * 8:o + 12 + i * 8])
            score = {(3, 10): 5, (0, 4): 4, (3, 1): 4, (0, 3): 3, (0, 6): 3}.get((pid, eid), 1)
            if best is None or score > best[0]:
                best = (score, o + sub)
        start = best[1]
        fmt = struct.unpack('>H', d[start:start + 2])[0]
        m = {}
        if fmt == 4:
            segX2 = struct.unpack('>H', d[start + 6:start + 8])[0]
            seg = segX2 // 2
            ends = struct.unpack('>%dH' % seg, d[start + 14:start + 14 + segX2])
            p = start + 16 + segX2
            starts = struct.unpack('>%dH' % seg, d[p:p + segX2]); p += segX2
            deltas = struct.unpack('>%dh' % seg, d[p:p + segX2]); p += segX2
            rangeOff = p
            offs = struct.unpack('>%dH' % seg, d[p:p + segX2])
            for i in range(seg):
                lo, hi = starts[i], min(ends[i], 0xFFFE)
                if lo > hi:
                    continue
                for c in range(lo, hi + 1):
                    if offs[i] == 0:
                        g = (c + deltas[i]) & 0xFFFF
                    else:
                        gp = rangeOff + i * 2 + offs[i] + (c - starts[i]) * 2
                        if gp + 2 > len(d):
                            continue
                        g = struct.unpack('>H', d[gp:gp + 2])[0]
                        if g:
                            g = (g + deltas[i]) & 0xFFFF
                    if g:
                        m[c] = g
        elif fmt == 12:
            ngroups = struct.unpack('>I', d[start + 12:start + 16])[0]
            p = start + 16
            for _ in range(ngroups):
                s, e, g = struct.unpack('>III', d[p:p + 12]); p += 12
                for c in range(s, e + 1):
                    m[c] = g + (c - s)
        return m

    def _hmtx(self):
        o = self.tables['hmtx'][0]
        n = self.numGlyphs
        nhm = self.numHMetrics
        aw = []
        for i in range(nhm):
            a = struct.unpack('>H', self.data[o + i * 4:o + i * 4 + 2])[0]
            aw.append(a)
        last = aw[-1] if aw else 0
        while len(aw) < n:
            aw.append(last)
        return aw

    def gid(self, ch):
        return self.cmap.get(ord(ch))

    def advance(self, gid):
        if gid is None or gid >= len(self.advances):
            return 0
        return self.advances[gid]

    def design_advance(self, ch, size):
        g = self.gid(ch)
        if g is None:
            return size * 0.5
        return self.advance(g) / float(self.upem) * size

    def glyph(self, gid, depth=0):
        """(xmin,ymin,xmax,ymax, contours) либо None для пустого/неподдержанного."""
        if gid in self._cache:
            return self._cache[gid]
        if depth > 4 or gid is None or gid >= self.numGlyphs:
            return None
        d = self.data
        o, _l = self.tables['glyf']
        st = o + self.loca[gid]
        en = o + self.loca[gid + 1]
        if st >= en:
            self._cache[gid] = None
            return None
        nc = struct.unpack('>h', d[st:st + 2])[0]
        xmin, ymin, xmax, ymax = struct.unpack('>hhhh', d[st + 2:st + 10])
        if nc < 0:
            out = self._composite(d, st + 10, depth)
            self._cache[gid] = out
            return out
        p = st + 10
        ends = list(struct.unpack('>%dH' % nc, d[p:p + nc * 2])); p += nc * 2
        il = struct.unpack('>H', d[p:p + 2])[0]; p += 2 + il
        npts = (ends[-1] + 1) if ends else 0
        flags = []
        while len(flags) < npts:
            f = d[p]; p += 1
            flags.append(f)
            if f & 8:
                r = d[p]; p += 1
                flags.extend([f] * r)
        flags = flags[:npts]
        xs = []
        v = 0
        for f in flags:
            if f & 2:
                dx = d[p]; p += 1
                v += dx if f & 16 else -dx
            elif not (f & 16):
                v += struct.unpack('>h', d[p:p + 2])[0]; p += 2
            xs.append(v)
        ys = []
        v = 0
        for f in flags:
            if f & 4:
                dy = d[p]; p += 1
                v += dy if f & 32 else -dy
            elif not (f & 32):
                v += struct.unpack('>h', d[p:p + 2])[0]; p += 2
            ys.append(v)
        pts = list(zip(xs, ys, flags))
        contours = []
        s = 0
        for e in ends:
            contours.append(pts[s:e + 1])
            s = e + 1
        out = (xmin, ymin, xmax, ymax, contours)
        self._cache[gid] = out
        return out

    def _composite(self, d, p, depth):
        """Составной глиф: собираем контуры компонентов с их преобразованиями."""
        out = []
        while True:
            flags, gi = struct.unpack('>HH', d[p:p + 4]); p += 4
            a = dd = 1.0          # без флага масштаба преобразование единичное
            b = c = 0.0
            if flags & 1:                      # ARG_1_AND_2_ARE_WORDS
                if flags & 2:                  # ARGS_ARE_XY_VALUES
                    dx, dy = struct.unpack('>hh', d[p:p + 4])
                else:
                    dx, dy = struct.unpack('>HH', d[p:p + 4])
                p += 4
            else:
                if flags & 2:
                    dx, dy = struct.unpack('>bb', d[p:p + 2])
                else:
                    dx, dy = struct.unpack('>BB', d[p:p + 2])
                p += 2
            if flags & 8:                      # WE_HAVE_A_SCALE
                a = dd = struct.unpack('>h', d[p:p + 2])[0] / 16384.0
                p += 2
            elif flags & 0x40:                 # X_AND_Y_SCALE
                a, dd = struct.unpack('>hh', d[p:p + 4])
                a /= 16384.0; dd /= 16384.0
                p += 4
            elif flags & 0x80:                 # 2x2
                a, b, c, dd = struct.unpack('>hhhh', d[p:p + 8])
                a /= 16384.0; b /= 16384.0; c /= 16384.0; dd /= 16384.0
                p += 8
            comp = self.glyph(gi, depth + 1)
            if comp:
                for cont in comp[4]:
                    out.append([(x * a + y * c + dx, x * b + y * dd + dy, f)
                                for (x, y, f) in cont])
            if not (flags & 0x20):             # MORE_COMPONENTS
                break
        if not out:
            return None
        xs = [q[0] for cont in out for q in cont]
        ys = [q[1] for cont in out for q in cont]
        return (min(xs), min(ys), max(xs), max(ys), out)


def glyph_program(ttf, gid, scale):
    """Type3-программа глифа: d1 (метрика + bbox) и заливка контуров."""
    gl = ttf.glyph(gid)
    if gl is None:
        return ''
    xmin, ymin, xmax, ymax, contours = gl
    adv = ttf.advance(gid)
    parts = ['%s 0 %s %s %s %s d1' % (_fmt(adv * scale), _fmt(xmin * scale),
                                      _fmt(ymin * scale), _fmt(xmax * scale),
                                      _fmt(ymax * scale))]
    body = []
    for c in contours:
        m = len(c)
        if m == 0:
            continue
        pts = []
        for i in range(m):
            x0, y0, f0 = c[i]
            x1, y1, f1 = c[(i + 1) % m]
            if f0 & 1:
                pts.append(('p', x0, y0))
            else:
                mx = (x0 + x1) / 2.0
                my = (y0 + y1) / 2.0
                pts.append(('q', x0, y0, mx, my))
        if len(pts) < 2:
            continue
        n = len(pts)
        if pts[0][0] == 'p':
            start = (pts[0][1], pts[0][2])
        else:
            start = (pts[0][3], pts[0][4])
        seg = ['%s %s m' % (_fmt(start[0] * scale), _fmt(start[1] * scale))]
        i = 0
        while i < n:
            cur = pts[i]
            if cur[0] == 'p':
                nxt = pts[(i + 1) % n]
                if nxt[0] == 'p':
                    seg.append('%s %s l' % (_fmt(nxt[1] * scale), _fmt(nxt[2] * scale)))
                    i += 1
                else:
                    seg.append('%s %s %s %s %s %s c' % (
                        _fmt(cur[1] * scale), _fmt(cur[2] * scale),
                        _fmt(cur[1] * scale), _fmt(cur[2] * scale),
                        _fmt(nxt[3] * scale), _fmt(nxt[4] * scale)))
                    i += 2
            else:
                cx, cy, ex, ey = cur[1], cur[2], cur[3], cur[4]
                nxt = pts[(i + 1) % n]
                if nxt[0] == 'p':
                    seg.append('%s %s %s %s %s %s c' % (
                        _fmt(cx * scale), _fmt(cy * scale),
                        _fmt(ex * scale), _fmt(ey * scale),
                        _fmt(nxt[1] * scale), _fmt(nxt[2] * scale)))
                    i += 2
                else:
                    mx = (ex + nxt[3]) / 2.0
                    my = (ey + nxt[4]) / 2.0
                    seg.append('%s %s %s %s %s %s c' % (
                        _fmt(cx * scale), _fmt(cy * scale),
                        _fmt(ex * scale), _fmt(ey * scale),
                        _fmt(mx * scale), _fmt(my * scale)))
                    i += 1
        seg.append('h')
        body.append(' '.join(seg))
    if body:
        parts.append(' '.join(body) + ' f')
    return '\n'.join(parts)


class FontResource:
    """PDF-шрифт, собранный из TTF (Type3)."""

    def __init__(self, name, ttf_path, pdf, scale=10.0):
        self.name = name
        self.pdf = pdf
        self.scale = float(scale)
        self.ttf = TTF(ttf_path)
        self.chars = {}
        self.widths = {}

    def code(self, ch, fallback=None):
        c = self.chars.get(ch)
        if c is not None:
            return c
        if self.ttf.gid(ch) is None:
            if fallback is not None:
                c = fallback.code(ch)
                self.chars[ch] = c
                self.widths[c] = fallback.widths[c]
                return c
            ch = ' '
        c = self.chars.get(ch)
        if c is not None:
            if ch != ' ':
                self.chars[ch] = c
            return c
        c = 33 + len(self.chars)
        if c > 255:
            raise RuntimeError('много глифов в %s' % self.name)
        gid = self.ttf.gid(ch)
        self.chars[ch] = c
        self.widths[c] = self.ttf.advance(gid) / float(self.ttf.upem) * 1000.0
        return c

    def string_codes(self, s, fallback=None):
        return ''.join(chr(self.code(ch, fallback)) for ch in s)

    def hex_string(self, s, fallback=None):
        return '<%s>' % ''.join('%02X' % self.code(ch, fallback) for ch in s)

    def width(self, s, size, fallback=None):
        total = 0.0
        for ch in s:
            total += self.widths[self.code(ch, fallback)]
        return total / 1000.0 * size

    def emit(self):
        pdf = self.pdf
        scale = self.scale
        xs, ys = [], []
        for ch, code in self.chars.items():
            gid = self.ttf.gid(ch)
            gl = self.ttf.glyph(gid) if gid is not None else None
            if gl:
                xs += [gl[0] * scale, gl[2] * scale]
                ys += [gl[1] * scale, gl[3] * scale]
        if not xs:
            xs, ys = [0, 0], [0, 0]
        fbbox = [_fmt(-50), _fmt(min(ys) - 20), _fmt(max(xs) + 50), _fmt(max(ys) + 20)]

        glyph_refs = {}
        for ch, code in self.chars.items():
            gid = self.ttf.gid(ch)
            prog = glyph_program(self.ttf, gid, scale) if gid is not None else ''
            data = ('%s 0 d0\n%s' % (self.name, prog)).encode('latin-1')
            glyph_refs[code] = pdf.stream(data)

        cp = b'<<' + b''.join(b' /g%d %d 0 R' % (c, glyph_refs[c]) for c in sorted(glyph_refs)) + b' >>'
        cp_ref = pdf.dict_obj(cp)

        diffs = b'[ 32' + b''.join(b' /%s' % self._glyph_name(ch).encode('ascii')
                                   for ch in sorted(self.chars, key=lambda c: self.chars[c])) + b' ]'
        widths = [0] * 256
        for code, w in self.widths.items():
            if code < 256:
                widths[code - 32] = int(round(w))   # Widths индексируется от FirstChar
        w_arr = b'[ ' + b' '.join(b'%d' % widths[i] for i in range(256)) + b' ]'
        fm = [1.0 / (scale * self.ttf.upem), 0, 0, 1.0 / (scale * self.ttf.upem), 0, 0]
        fmv = b'[ ' + b' '.join(_fmt(x).encode('ascii') for x in fm) + b' ]'
        tounicode = pdf.stream(self._tounicode())
        # приватная карта код -> номер глифа (парами), чтобы растеризатор не зависел
        # от разбора имён глифов
        pairs = []
        for ch in sorted(self.chars, key=lambda c: self.chars[c]):
            g = self.ttf.gid(ch)
            if g is not None:
                pairs.append(b'/g%d %d' % (self.chars[ch], g))
        gidmap_ref = pdf.dict_obj(b'<<' + b''.join(b' ' + p for p in pairs) + b' >>')
        d = (b'<< /Type /Font /Subtype /Type3 /Name /%s /FontBBox [%s] /FontMatrix %s '
             b'/CharProcs %d 0 R /Encoding << /Type /Encoding /Differences %s >> '
             b'/FirstChar 32 /LastChar 255 /Widths %s /Resources << >> '
             b'/SLGidMap %d 0 R /ToUnicode %d 0 R >>'
             % (self.name.encode('ascii'), b' '.join(x.encode('ascii') for x in fbbox),
                fmv, cp_ref, diffs, w_arr, gidmap_ref, tounicode))
        return pdf.dict_obj(d)

    def _glyph_name(self, ch):
        o = ord(ch)
        std = {32: 'space', 33: 'exclam', 34: 'quotedbl', 35: 'numbersign', 36: 'dollar',
               37: 'percent', 38: 'ampersand', 39: 'quotesingle', 40: 'parenleft',
               41: 'parenright', 42: 'asterisk', 43: 'plus', 44: 'comma', 45: 'hyphen',
               46: 'period', 47: 'slash', 48: 'zero', 49: 'one', 50: 'two', 51: 'three',
               52: 'four', 53: 'five', 54: 'six', 55: 'seven', 56: 'eight', 57: 'nine',
               58: 'colon', 59: 'semicolon', 60: 'less', 61: 'equal', 62: 'greater',
               63: 'question', 64: 'at', 91: 'bracketleft', 92: 'backslash',
               93: 'bracketright', 94: 'asciicircum', 95: 'underscore', 96: 'grave',
               123: 'braceleft', 124: 'bar', 125: 'braceright', 126: 'asciitilde'}
        if o in std:
            return std[o]
        if 65 <= o <= 90 or 97 <= o <= 122:
            return ch
        return 'uni%04X' % o

    def _tounicode(self):
        lines = ['/CIDInit /ProcSet findresource begin', '12 dict begin', 'begincmap',
                 '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
                 '/CMapName /Adobe-Identity-UCS def', '/CMapType 2 def',
                 '1 begincodespacerange', '<00> <FF>', 'endcodespacerange']
        items = sorted(self.chars.items(), key=lambda kv: kv[1])
        for i in range(0, len(items), 100):
            chunk = items[i:i + 100]
            lines.append('%d beginbfchar' % len(chunk))
            for ch, code in chunk:
                lines.append('<%02X> <%04X>' % (code, ord(ch)))
            lines.append('endbfchar')
        lines += ['endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end']
        return '\n'.join(lines).encode('latin-1')


# ---------------------------------------------------------------- PDF

class PDF:
    def __init__(self):
        self.objs = [None]
        self.pages = []

    def reserve(self):
        self.objs.append(None)
        return len(self.objs) - 1

    def put(self, ref, data):
        self.objs[ref] = data

    def raw_obj(self, data):
        self.objs.append(data)
        return len(self.objs) - 1

    def dict_obj(self, data):
        return self.raw_obj(data)

    def stream(self, data, extra=b''):
        comp = zlib.compress(data, 9)
        head = b'<< /Length %d /Filter /FlateDecode %s>>\nstream\n' % (len(comp), extra)
        return self.raw_obj(head + comp + b'\nendstream')

    def add_page(self, content, resources, w=595.276, h=841.89):
        cref = self.stream(content)
        self.pages.append((cref, resources, w, h))
        return cref

    def save(self, path, title=''):
        pages_ref = self.reserve()
        kids = []
        for cref, resources, w, h in self.pages:
            d = (b'<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %s %s] '
                 b'/Resources %s /Contents %d 0 R >>'
                 % (pages_ref, _fmt(w).encode(), _fmt(h).encode(), resources, cref))
            kids.append(self.raw_obj(d))
        self.put(pages_ref, b'<< /Type /Pages /Count %d /Kids [%s] >>'
                 % (len(kids), b' '.join(b'%d 0 R' % k for k in kids)))
        cat = self.reserve()
        info = self.raw_obj(('<< /Title (%s) /Producer (SVEMA LAB brandbook builder) >>'
                             % _pdfstr(title)).encode('latin-1'))
        self.put(cat, b'<< /Type /Catalog /Pages %d 0 R >>' % pages_ref)

        out = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
        offsets = [0] * len(self.objs)
        for i in range(1, len(self.objs)):
            data = self.objs[i]
            if data is None:
                data = b'null'
            offsets[i] = len(out)
            out += b'%d 0 obj\n' % i + data + b'\nendobj\n'
        xref = len(out)
        n = len(self.objs)
        out += b'xref\n0 %d\n' % n
        out += b'0000000000 65535 f \n'
        for i in range(1, n):
            out += b'%010d 00000 n \n' % offsets[i]
        out += (b'trailer\n<< /Size %d /Root %d 0 R /Info %d 0 R >>\nstartxref\n%d\n%%%%EOF\n'
                % (n, cat, info, xref))
        with open(path, 'wb') as f:
            f.write(out)
        return len(out)
