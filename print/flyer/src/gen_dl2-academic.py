#!/usr/bin/env python3
"""Генератор єврофлаєра DL dl2-academic (99×210 мм, дві сторони), стиль «Академічний».

Створює:
  src/dl2-academic-1-front.svg — лицьова сторона
  src/dl2-academic-2-back.svg  — зворотна сторона

Запуск: python3 src/gen_dl2-academic.py  (потім python3 build.py dl2-academic)
Ширину тексту міряємо локальними шрифтами Inter (PIL), щоб переноси рядків були точними.
"""
import math, random, pathlib
from functools import lru_cache
from PIL import ImageFont

HERE = pathlib.Path(__file__).parent

# ---------------------------------------------------------------- кольори
BLUE, BLUE_D, BLUE_M = '#0B3D6B', '#072A4B', '#1B5C96'
YEL, YEL_D = '#FFD200', '#E0A800'
GREEN, GREEN_D, GREEN_L = '#2E8B3E', '#1E6A2E', '#7CC242'
INK, GRAY, LINE = '#1B2A3A', '#556677', '#D5DEE7'
PAPER = '#FBFCFD'

# ---------------------------------------------------------------- вимір тексту
FD = '/usr/share/fonts/opentype/inter/'
FMAP = {('Inter', 400): 'Inter-Regular.otf', ('Inter', 500): 'Inter-Medium.otf',
        ('Inter', 600): 'Inter-SemiBold.otf', ('Inter', 700): 'Inter-Bold.otf',
        ('Inter Display', 700): 'InterDisplay-Bold.otf', ('Inter Display', 800): 'InterDisplay-ExtraBold.otf',
        ('Inter Display', 900): 'InterDisplay-Black.otf'}


@lru_cache(None)
def _font(path):
    return ImageFont.truetype(path, 200)


def tw(s, size, w=400, fam='Inter'):
    if fam == 'Lora':
        return _font(FD + 'Inter-MediumItalic.otf').getlength(s) * size / 200 * 1.04
    if fam == 'JetBrains Mono':
        return _font('/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf').getlength(s) * size / 200
    return _font(FD + FMAP[(fam, w)]).getlength(s) * size / 200


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def T(x, y, s, size=28, w=400, fill=INK, fam='Inter', anchor='start', ls=None, italic=False, op=None):
    if fam == 'Inter':
        w = min(w, 600)  # у наборі Inter лише 400–600
    a = f'<text x="{f(x)}" y="{f(y)}" font-family="\'{fam}\'" font-size="{f(size)}" font-weight="{w}" fill="{fill}"'
    if anchor != 'start':
        a += f' text-anchor="{anchor}"'
    if ls:
        a += f' letter-spacing="{ls}"'
    if italic:
        a += ' font-style="italic"'
    if op is not None:
        a += f' opacity="{op}"'
    return a + f'>{esc(s)}</text>'


def para(x, y, s, maxw, size=28, lh=1.42, w=400, bw=600, fill=INK, bfill=None, fam='Inter', anchor='start'):
    """Абзац з переносами; **…** — напівжирний, //…// — курсив. Повертає (svg, y наступного рядка)."""
    if fam == 'Inter':
        w, bw = min(w, 600), min(bw, 600)
    bfill = bfill or fill
    import re as _re
    toks, b_, i_ = [], False, False
    prev_sp = True
    for part in _re.split(r'(\*\*|//)', s):
        if part == '**':
            b_ = not b_; continue
        if part == '//':
            i_ = not i_; continue
        if not part:
            continue
        for k, word in enumerate(part.split(' ')):
            if word:
                st = 'bi' if b_ and i_ else ('b' if b_ else ('i' if i_ else ''))
                glue = k == 0 and bool(toks) and not prev_sp
                toks.append((word, st, glue))
        prev_sp = part.endswith(' ')
    # склеювання: слово, що йде впритул до попереднього (без пробілу між стилями)
    words = []
    for word, st, glue in toks:
        if glue and words:
            words[-1].append((word, st))
        else:
            words.append([(word, st)])
    lines, cur, curw = [], [], 0
    sp = tw(' ', size, w, fam)
    for wd in words:
        ww = sum(tw(t, size, bw if 'b' in st else w, fam) for t, st in wd)
        if cur and curw + sp + ww > maxw:
            lines.append(cur); cur, curw = [], 0
        curw += (sp if cur else 0) + ww
        cur.append(wd)
    if cur:
        lines.append(cur)
    out = []
    for ln in lines:
        segs = []
        for j, wd in enumerate(ln):
            for k, (t, st) in enumerate(wd):
                pre = ' ' if (j > 0 and k == 0) else ''
                if segs and segs[-1][1] == st:
                    segs[-1][0] += pre + t
                else:
                    if pre and segs:
                        segs[-1][0] += ' '
                    segs.append([t, st])
        def sp_(t, st):
            if not st:
                return esc(t)
            a = ''
            if 'b' in st:
                a += f' font-weight="{bw}" fill="{bfill}"'
            if 'i' in st:
                a += ' font-style="italic" font-family="\'Lora\'"'
            return f'<tspan{a}>{esc(t)}</tspan>'
        inner = ''.join(sp_(t, st) for t, st in segs)
        a = f'<text x="{f(x)}" y="{f(y)}" font-family="\'{fam}\'" font-size="{f(size)}" font-weight="{w}" fill="{fill}"'
        if anchor != 'start':
            a += f' text-anchor="{anchor}"'
        out.append(a + f'>{inner}</text>')
        y += size * lh
    return '\n'.join(out), y


# ---------------------------------------------------------------- спільні defs
class Defs:
    def __init__(self):
        self.items, self.ids = [], set()

    def add(self, id_, s):
        if id_ not in self.ids:
            self.ids.add(id_); self.items.append(s)
        return f'url(#{id_})'

    def lin(self, id_, stops, x1=0, y1=0, x2=0, y2=1, units=None, extra=''):
        st = ''.join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>'
                     for o, c, a in [(s + (None,))[:3] for s in stops])
        u = f' gradientUnits="{units}"' if units else ''
        return self.add(id_, f'<linearGradient id="{id_}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"{u}{extra}>{st}</linearGradient>')

    def rad(self, id_, stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None, units=None, extra=''):
        st = ''.join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>'
                     for o, c, a in [(s + (None,))[:3] for s in stops])
        fxy = (f' fx="{fx}"' if fx is not None else '') + (f' fy="{fy}"' if fy is not None else '')
        u = f' gradientUnits="{units}"' if units else ''
        return self.add(id_, f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="{r}"{fxy}{u}{extra}>{st}</radialGradient>')

    def svg(self):
        return '<defs>\n' + '\n'.join(self.items) + '\n</defs>'


D = Defs()


def ball_shade():
    """Накладка для куль: блік угорі ліворуч, затінення по краю."""
    return D.rad('ballShade', [(0, '#ffffff', 0.85), (0.22, '#ffffff', 0.25), (0.55, '#ffffff', 0), (0.85, '#000000', 0.18),
                               (1, '#000000', 0.45)], cx=0.5, cy=0.5, r=0.5, fx=0.33, fy=0.3)


def ball(x, y, r, color, op=1):
    sh = ball_shade()
    o = f' opacity="{op}"' if op != 1 else ''
    return f'<g{o}><circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{color}"/><circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{sh}"/></g>'


def soft_shadow(cx, cy, rx, ry, op=0.35, id_='shadowE'):
    g = D.rad(id_, [(0, '#0a1a2a', 1), (0.55, '#0a1a2a', 0.45), (1, '#0a1a2a', 0)])
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{g}" opacity="{op}"/>'


def mix(c1, c2, t):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(a[i] + (b[i] - a[i]) * t):02x}' for i in range(3))


# ================================================================ ІЛЮСТРАЦІЇ
def leaf(bx, by, L, W, ang, seed=3, idp='lf'):
    """Реалістичний листок на просвіт: локально основа (0,0) → верхівка (L,0), потім поворот на ang° і зсув."""
    rnd = random.Random(seed)
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))

    def P(x, y):
        return bx + x * ca - y * sa, by + x * sa + y * ca

    def width(t):
        if t <= 0 or t >= 1:
            return 0
        return W * math.sin(math.pi * t ** 0.74) ** 0.95 * (1 - 0.08 * t)

    def mid(t):
        return 16 * math.sin(math.pi * t)

    N = 260
    up, lo = [], []
    for i in range(N + 1):
        t = i / N
        saw = 1 - ((t * 34) % 1)
        teeth = 1 + (0.022 * saw ** 2.2 if 0.06 < t < 0.97 else 0)
        wv = width(t) * teeth
        up.append(P(t * L, mid(t) - wv))
        lo.append(P(t * L, mid(t) + wv * 0.94))
    pts = up + lo[::-1]
    dleaf = 'M' + ' L'.join(f'{f(x)},{f(y)}' for x, y in pts) + 'Z'
    sx, sy = P(L * 0.55, -W * 0.5)
    fill = D.rad(idp + 'Fill', [(0, '#F1F98A'), (0.22, '#C6E54E'), (0.5, '#86C23A'), (0.78, '#4C9A2A'), (1, '#2C6A1C')],
                 cx=f(sx), cy=f(sy), r=f(L * 0.72), units='userSpaceOnUse')
    out = [f'<clipPath id="{idp}Clip"><path d="{dleaf}"/></clipPath>']
    # черешок
    p0, p1 = P(-260, 34), P(0, 0)
    q0, q1 = P(-260, 58), P(0, 22)
    pet = D.lin(idp + 'Pet', [(0, '#3F7F22'), (0.5, '#8CC63F'), (1, '#4E8F2A')], 0, 0, 0, 1)
    out.append(f'<path d="M{f(p0[0])},{f(p0[1])} Q{f(P(-120, 10)[0])},{f(P(-120, 10)[1])} {f(p1[0])},{f(p1[1])} '
               f'L{f(q1[0])},{f(q1[1])} Q{f(P(-120, 36)[0])},{f(P(-120, 36)[1])} {f(q0[0])},{f(q0[1])}Z" fill="{pet}"/>')
    out.append(f'<path d="{dleaf}" fill="{fill}"/>')
    g = [f'<g clip-path="url(#{idp}Clip)">']
    # дрібна сітка (ареоли)
    ptsn = []
    for _ in range(900):
        t = rnd.uniform(0.02, 0.99)
        v = rnd.uniform(-1, 1)
        ptsn.append((t * L, mid(t) + v * width(t)))
    segs = set()
    for i, (x, y) in enumerate(ptsn):
        ds = sorted(((x - a) ** 2 + (y - b) ** 2, j) for j, (a, b) in enumerate(ptsn) if j != i)[:3]
        for d2, j in ds:
            if d2 < 70 ** 2:
                segs.add((min(i, j), max(i, j)))
    dd = ''.join(f'M{f(P(*ptsn[i])[0])},{f(P(*ptsn[i])[1])}L{f(P(*ptsn[j])[0])},{f(P(*ptsn[j])[1])}' for i, j in segs)
    g.append(f'<path d="{dd}" stroke="#E9F7A6" stroke-width="1.3" opacity="0.42" fill="none"/>')
    # бічні жилки + третинні перемички
    veins = []
    for side in (-1, 1):
        prev = None
        for k in range(10):
            t0 = 0.06 + k * 0.088
            t1 = min(t0 + 0.17, 0.985)
            a = (t0 * L, mid(t0))
            c = ((t0 + 0.07) * L, mid(t0 + 0.07) + side * width(t0 + 0.07) * 0.5)
            b = (t1 * L, mid(t1) + side * width(t1) * 0.86)
            bez = [((1 - s) ** 2 * a[0] + 2 * (1 - s) * s * c[0] + s * s * b[0],
                    (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * c[1] + s * s * b[1]) for s in [i / 20 for i in range(21)]]
            veins.append((bez, 7.5 - k * 0.45))
            if prev:
                for m in range(2, 19, 2):
                    s = m / 20
                    pa = prev[int(s * 20)]
                    pb = bez[max(0, int(s * 20) - 3)]
                    mx_, my_ = (pa[0] + pb[0]) / 2 + rnd.uniform(-8, 8), (pa[1] + pb[1]) / 2 + rnd.uniform(-8, 8)
                    A, B, C = P(*pa), P(mx_, my_), P(*pb)
                    g.append(f'<path d="M{f(A[0])},{f(A[1])} Q{f(B[0])},{f(B[1])} {f(C[0])},{f(C[1])}" '
                             f'stroke="#EAF8A8" stroke-width="2" opacity="0.55" fill="none"/>')
            prev = bez
    for bez, wv in veins:
        pp = [P(*q) for q in bez]
        d = 'M' + ' L'.join(f'{f(x)},{f(y)}' for x, y in pp)
        g.append(f'<path d="{d}" stroke="#3E7F22" stroke-width="{f(wv + 3)}" opacity="0.25" fill="none" stroke-linecap="round"/>')
        g.append(f'<path d="{d}" stroke="#F3FCC0" stroke-width="{f(wv)}" opacity="0.9" fill="none" stroke-linecap="round"/>')
    # затемнення країв (віньєтка) без фільтрів
    for wv, op in ((90, 0.10), (60, 0.12), (34, 0.14), (14, 0.18)):
        g.append(f'<path d="{dleaf}" fill="none" stroke="#173F10" stroke-width="{wv}" opacity="{op}"/>')
    # глянець
    sheen = D.lin(idp + 'Sheen', [(0, '#ffffff', 0.0), (0.45, '#ffffff', 0.16), (0.55, '#ffffff', 0.0)], 0, 0, 1, 1)
    g.append(f'<path d="{dleaf}" fill="{sheen}"/>')
    g.append('</g>')
    out += g
    # центральна жилка (конусна)
    mu, ml = [], []
    for i in range(41):
        t = i / 40 * 0.97
        hw = 9 * (1 - t) + 1.2
        mu.append(P(t * L, mid(t) - hw)); ml.append(P(t * L, mid(t) + hw))
    dm = 'M' + ' L'.join(f'{f(x)},{f(y)}' for x, y in mu + ml[::-1]) + 'Z'
    mr = D.lin(idp + 'Mid', [(0, '#FBFFE0'), (1, '#D9EE8C')], 0, 0, 1, 0)
    out.append(f'<path d="{dm}" fill="{mr}" opacity="0.95"/>')
    # світлий контур (контрове світло)
    out.append(f'<path d="{dleaf}" fill="none" stroke="#E4F58F" stroke-width="3" opacity="0.75"/>')
    # краплі роси
    for (t, v, r) in ((0.33, -0.45, 20), (0.62, 0.35, 14), (0.47, 0.6, 10), (0.78, -0.3, 9)):
        cx, cy = P(t * L, mid(t) + v * width(t))
        dg = D.rad('drop', [(0, '#FFFFFF', 0.2), (0.6, '#E6F7B5', 0.15), (0.85, '#2D6B1A', 0.45), (1, '#1D4A10', 0.6)],
                   cx=0.45, cy=0.4, r=0.6)
        out.append(f'<ellipse cx="{f(cx + 2)}" cy="{f(cy + r * 0.55)}" rx="{f(r * 1.05)}" ry="{f(r * 0.6)}" fill="#1D4A10" opacity="0.28"/>')
        out.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{dg}"/>')
        out.append(f'<ellipse cx="{f(cx - r * 0.32)}" cy="{f(cy - r * 0.38)}" rx="{f(r * 0.3)}" ry="{f(r * 0.2)}" fill="#fff" opacity="0.95" transform="rotate(-30 {f(cx - r * 0.32)} {f(cy - r * 0.38)})"/>')
        out.append(f'<circle cx="{f(cx + r * 0.35)}" cy="{f(cy + r * 0.4)}" r="{f(r * 0.16)}" fill="#FBFFD8" opacity="0.8"/>')
    return '\n'.join(out)


def chloroplast_lens(cx, cy, r):
    """Лупа з хлоропластом: строма, грани з тилакоїдів, крохмальне зерно."""
    o = []
    o.append(soft_shadow(cx + 8, cy + r * 0.95, r * 0.9, r * 0.16, 0.45))
    o.append(f'<clipPath id="lensClip"><circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/></clipPath>')
    cyt = D.rad('cyto', [(0, '#E9F6D8'), (0.7, '#C8E6A8'), (1, '#9CCB78')], cx=0.45, cy=0.4, r=0.7)
    o.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{cyt}"/>')
    o.append(f'<g clip-path="url(#lensClip)">')
    # сусідні клітинні стінки
    o.append(f'<path d="M{f(cx - r)},{f(cy - r * 0.78)} Q{f(cx)},{f(cy - r * 0.95)} {f(cx + r)},{f(cy - r * 0.7)}" stroke="#7FB45A" stroke-width="5" fill="none" opacity="0.6"/>')
    o.append(f'<path d="M{f(cx - r)},{f(cy + r * 0.8)} Q{f(cx)},{f(cy + r * 0.98)} {f(cx + r)},{f(cy + r * 0.76)}" stroke="#7FB45A" stroke-width="5" fill="none" opacity="0.6"/>')
    # тіло хлоропласта
    rx, ry = r * 0.8, r * 0.46
    o.append(f'<g transform="rotate(-18 {f(cx)} {f(cy)})">')
    o.append(f'<ellipse cx="{f(cx + 3)}" cy="{f(cy + 6)}" rx="{f(rx + 4)}" ry="{f(ry + 4)}" fill="#2D5E1A" opacity="0.25"/>')
    env = D.rad('chlEnv', [(0, '#9ED45A'), (0.65, '#5FA834'), (1, '#2E6E1E')], cx=0.42, cy=0.38, r=0.62)
    o.append(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{env}" stroke="#DDF2B8" stroke-width="3"/>')
    o.append(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx - 7)}" ry="{f(ry - 7)}" fill="none" stroke="#2F6A1C" stroke-width="2" opacity="0.7"/>')
    # ламели строми
    for k in (-0.42, -0.14, 0.14, 0.42):
        yy = cy + k * ry * 1.25
        o.append(f'<path d="M{f(cx - rx * 0.82)},{f(yy + 4)} Q{f(cx)},{f(yy - 6)} {f(cx + rx * 0.82)},{f(yy + 4)}" stroke="#2C6A1A" stroke-width="2.4" fill="none" opacity="0.75"/>')
    th = D.lin('thyl', [(0, '#3E8E2A'), (0.5, '#1F5A14'), (1, '#174A0F')], 0, 0, 0, 1)
    grana = [(-0.55, -0.08, 5), (-0.25, -0.3, 6), (-0.2, 0.25, 5), (0.1, -0.05, 7), (0.38, -0.3, 5), (0.42, 0.24, 6), (0.68, 0.0, 4)]
    for gx, gy, n in grana:
        x0, y0 = cx + gx * rx, cy + gy * ry * 1.3
        w, h = r * 0.17, r * 0.042
        for j in range(n):
            yy = y0 - (n * h * 1.12) / 2 + j * h * 1.12
            o.append(f'<rect x="{f(x0 - w / 2)}" y="{f(yy)}" width="{f(w)}" height="{f(h)}" rx="{f(h / 2)}" fill="{th}"/>')
            o.append(f'<rect x="{f(x0 - w / 2 + 3)}" y="{f(yy + 1)}" width="{f(w - 6)}" height="1.6" fill="#B6E07A" opacity="0.7"/>')
    # крохмальне зерно та пластоглобули
    st = D.rad('starch', [(0, '#FFFFFF'), (1, '#E6E0C8')], cx=0.4, cy=0.35, r=0.65)
    o.append(f'<ellipse cx="{f(cx - rx * 0.05)}" cy="{f(cy + ry * 0.55)}" rx="{f(r * 0.12)}" ry="{f(r * 0.07)}" fill="{st}" opacity="0.92"/>')
    for gx, gy in ((-0.62, 0.35), (0.55, -0.55), (0.2, 0.6), (0.8, 0.28)):
        o.append(f'<circle cx="{f(cx + gx * rx)}" cy="{f(cy + gy * ry)}" r="{f(r * 0.03)}" fill="#E7C64A"/>')
    o.append('</g>')
    # відблиск лінзи
    gl = D.rad('lensGlare', [(0, '#ffffff', 0.55), (1, '#ffffff', 0)], cx=0.3, cy=0.25, r=0.55)
    o.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{gl}"/>')
    o.append('</g>')
    rim = D.lin('lensRim', [(0, '#FFFFFF'), (0.5, '#E3EAF0'), (1, '#9FB0BF')], 0, 0, 1, 1)
    o.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r + 6)}" fill="none" stroke="{rim}" stroke-width="12"/>')
    o.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r + 12)}" fill="none" stroke="{YEL}" stroke-width="3"/>')
    return '\n'.join(o)


def sun_rays(cx, cy, r0, r1, n=28, seed=5, op=0.22):
    rnd = random.Random(seed)
    g = D.rad('rayG', [(0, YEL, 0.9), (1, YEL, 0)], cx=f(cx), cy=f(cy), r=f(r1), units='userSpaceOnUse')
    d = ''
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.uniform(-0.05, 0.05)
        da = rnd.uniform(0.018, 0.04)
        rr = r1 * rnd.uniform(0.6, 1)
        p = [(cx + r0 * math.cos(a - da), cy + r0 * math.sin(a - da)), (cx + rr * math.cos(a), cy + rr * math.sin(a)),
             (cx + r0 * math.cos(a + da), cy + r0 * math.sin(a + da))]
        d += 'M' + ' L'.join(f'{f(x)},{f(y)}' for x, y in p) + 'Z'
    return f'<path d="{d}" fill="{g}" opacity="{op}"/>'


def dna(x0, x1, cy, amp, turns, r=12, tilt=0):
    """Подвійна спіраль ДНК з куль, відсортованих за глибиною."""
    items = []
    n = int((x1 - x0) / 4.2)
    colA = ('#0B3D6B', '#3E8EE0')
    colB = ('#1E6A2E', '#6CC04A')
    pairs = [('#FFD200', '#2F7FD8'), ('#7CC242', '#F39C12'), ('#2F7FD8', '#FFD200'), ('#F39C12', '#7CC242')]
    off = 2.35
    for i in range(n + 1):
        t = i / n
        x = x0 + t * (x1 - x0)
        ph = 2 * math.pi * turns * t
        for (o, cols) in ((0, colA), (off, colB)):
            y = cy + amp * math.sin(ph + o) + tilt * (x - x0)
            z = math.cos(ph + o)
            col = mix(cols[0], cols[1], (z + 1) / 2)
            items.append((z, ball(x, y, r * (0.86 + 0.14 * z), col)))
    m = int(turns * 10)
    for k in range(m):
        t = (k + 0.5) / m
        x = x0 + t * (x1 - x0)
        ph = 2 * math.pi * turns * t
        ya, za = cy + amp * math.sin(ph) + tilt * (x - x0), math.cos(ph)
        yb, zb = cy + amp * math.sin(ph + off) + tilt * (x - x0), math.cos(ph + off)
        ym = (ya + yb) / 2
        z = (za + zb) / 2 - 0.05
        ca, cb = pairs[k % 4]
        sh = 0.55 + 0.45 * (z + 1) / 2
        ca2, cb2 = mix('#1a2633', ca, sh), mix('#1a2633', cb, sh)
        items.append((z, f'<g stroke-linecap="round"><line x1="{f(x)}" y1="{f(ya)}" x2="{f(x)}" y2="{f(ym)}" stroke="{ca2}" stroke-width="{f(r * 0.85)}"/>'
                         f'<line x1="{f(x)}" y1="{f(ym)}" x2="{f(x)}" y2="{f(yb)}" stroke="{cb2}" stroke-width="{f(r * 0.85)}"/>'
                         f'<line x1="{f(x - r * 0.18)}" y1="{f(min(ya, yb) + 6)}" x2="{f(x - r * 0.18)}" y2="{f(max(ya, yb) - 6)}" stroke="#fff" stroke-width="{f(r * 0.18)}" opacity="0.45"/></g>'))
    items.sort(key=lambda a: a[0])
    return '\n'.join(s for _, s in items)


def glucose(cx, cy, s=1.0, rx_=24, ry_=-32):
    """Кулько-стрижнева модель β-D-глюкози (кільце піранози)."""
    R = 78
    atoms, bonds = [], []

    def add(name, p):
        atoms.append([name, p]); return len(atoms) - 1
    ring = []
    for k in range(6):
        a = math.radians(k * 60 + 30)
        y = 14 * (1 if k % 2 else -1)  # «крісло»
        ring.append(add('O' if k == 0 else 'C', (R * math.cos(a), y, R * math.sin(a))))
    for k in range(6):
        bonds.append((ring[k], ring[(k + 1) % 6]))
    for k in range(1, 6):
        ax, _, az = atoms[ring[k]][1]
        n = math.hypot(ax, az)
        ux, uz = ax / n, az / n
        upd = 1 if k % 2 else -1
        base = atoms[ring[k]][1]
        if k == 5:
            c6 = add('C', (base[0] + ux * 60, base[1] + upd * 52, base[2] + uz * 60))
            bonds.append((ring[k], c6))
            o6 = add('O', (base[0] + ux * 120, base[1] + upd * 70, base[2] + uz * 110))
            bonds.append((c6, o6))
            h = add('H', (base[0] + ux * 160, base[1] + upd * 40, base[2] + uz * 150)); bonds.append((o6, h))
            h = add('H', (base[0] + ux * 40, base[1] + upd * 100, base[2] + uz * 80)); bonds.append((c6, h))
        else:
            o_ = add('O', (base[0] + ux * 72, base[1] + upd * 46, base[2] + uz * 72)); bonds.append((ring[k], o_))
            h = add('H', (base[0] + ux * 112, base[1] + upd * 78, base[2] + uz * 100)); bonds.append((o_, h))
        hh = add('H', (base[0] + ux * 26, base[1] - upd * 62, base[2] + uz * 26)); bonds.append((ring[k], hh))
    rx, ry = math.radians(rx_), math.radians(ry_)

    def proj(p):
        x, y, z = p
        x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
        y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
        return cx + x * s, cy - y * s, z
    P = [proj(a[1]) for a in atoms]
    col = {'C': '#3B4048', 'O': '#E2382F', 'H': '#F2F4F6'}
    rad = {'C': 22, 'O': 23, 'H': 14}
    items = []
    bg = D.lin('bondG', [(0, '#8C96A0'), (0.5, '#E8ECEF'), (1, '#7A848E')], 0, 0, 0, 1)
    for a, b in bonds:
        (x1, y1, z1), (x2, y2, z2) = P[a], P[b]
        z = (z1 + z2) / 2 - 8
        items.append((z, f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="#6E7881" stroke-width="{f(11 * s)}" stroke-linecap="round"/>'
                         f'<line x1="{f(x1)}" y1="{f(y1 - 2 * s)}" x2="{f(x2)}" y2="{f(y2 - 2 * s)}" stroke="#E9EDF0" stroke-width="{f(3.5 * s)}" stroke-linecap="round" opacity="0.8"/>'))
    for i, (nm, _) in enumerate(atoms):
        x, y, z = P[i]
        items.append((z, ball(x, y, rad[nm] * s * (1 + z / 900), col[nm])))
    items.sort(key=lambda a: a[0])
    return '\n'.join(s_ for _, s_ in items)


def petri(cx, cy, rx=260, ry=92, seed=7):
    """Скляна чашка Петрі з агаром, калусом і експлантами."""
    rnd = random.Random(seed)
    o = []
    h = 40
    o.append(soft_shadow(cx + 10, cy + h + 14, rx * 1.08, ry * 0.75, 0.55, 'shadowE'))
    # дно (скло)
    glass = D.lin('pGlass', [(0, '#ffffff', 0.55), (0.3, '#DDEAF2', 0.25), (0.7, '#C8DCEA', 0.3), (1, '#ffffff', 0.6)], 0, 0, 1, 0)
    o.append(f'<path d="M{f(cx - rx)},{f(cy)} L{f(cx - rx)},{f(cy + h)} A{f(rx)},{f(ry)} 0 0 0 {f(cx + rx)},{f(cy + h)} L{f(cx + rx)},{f(cy)} Z" fill="{glass}" stroke="#9DB6C8" stroke-width="2"/>')
    # агар
    ag = D.lin('agarSide', [(0, '#E7C96A'), (0.5, '#F6E3A0'), (1, '#D9B455')], 0, 0, 1, 0)
    ar, ary, at = rx - 8, ry - 3, cy + 12
    o.append(f'<path d="M{f(cx - ar)},{f(at)} L{f(cx - ar)},{f(cy + h - 6)} A{f(ar)},{f(ary)} 0 0 0 {f(cx + ar)},{f(cy + h - 6)} L{f(cx + ar)},{f(at)} Z" fill="{ag}" opacity="0.88"/>')
    agt = D.rad('agarTop', [(0, '#FBF0C4'), (0.7, '#F0DA8C'), (1, '#E2C26A')], cx=0.45, cy=0.4, r=0.65)
    o.append(f'<ellipse cx="{f(cx)}" cy="{f(at)}" rx="{f(ar)}" ry="{f(ary)}" fill="{agt}"/>')
    o.append(f'<ellipse cx="{f(cx)}" cy="{f(at)}" rx="{f(ar)}" ry="{f(ary)}" fill="none" stroke="#C9A64C" stroke-width="2.5" opacity="0.7"/>')
    # об'єкти на агарі
    cal = D.rad('callus', [(0, '#FFFBE6'), (0.55, '#F1E7B2'), (1, '#BFAE62')], cx=0.4, cy=0.35, r=0.65)
    calg = D.rad('callusG', [(0, '#F6FBD0'), (0.55, '#CFE38C'), (1, '#8DAE45')], cx=0.4, cy=0.35, r=0.65)
    lfg = D.lin('explLeaf', [(0, '#8BCB4A'), (0.6, '#4C9A2A'), (1, '#2F6E1E')], 0, 0, 1, 1)
    spots = [(-0.55, -0.15, 'c'), (-0.18, -0.45, 'l'), (0.22, -0.4, 'c'), (0.58, -0.05, 'l'), (0.3, 0.38, 'c'), (-0.25, 0.35, 'l'), (0.0, 0.0, 'g'), (-0.7, 0.3, 'c2')]
    spots.sort(key=lambda s: s[1])
    for gx, gy, kind in spots:
        x, y = cx + gx * ar * 0.85, at + gy * ary * 0.8
        o.append(f'<ellipse cx="{f(x + 4)}" cy="{f(y + 7)}" rx="{f(34)}" ry="{f(11)}" fill="#7A5E1C" opacity="0.28"/>')
        if kind in ('c', 'c2', 'g'):
            gr = calg if kind == 'g' else cal
            n = 9 if kind == 'g' else 7
            blobs = [(rnd.uniform(-24, 24), rnd.uniform(-14, 4), rnd.uniform(10, 17)) for _ in range(n)]
            blobs.sort(key=lambda b: b[1])
            for bx_, by_, br in blobs:
                o.append(f'<circle cx="{f(x + bx_)}" cy="{f(y + by_)}" r="{f(br)}" fill="{gr}"/>')
            if kind == 'g':
                # зелені меристематичні осередки та пагінець
                o.append(f'<path d="M{f(x)},{f(y - 14)} C{f(x - 4)},{f(y - 40)} {f(x + 6)},{f(y - 52)} {f(x + 2)},{f(y - 70)}" stroke="#4E9A2C" stroke-width="5" fill="none" stroke-linecap="round"/>')
                o.append(f'<path d="M{f(x + 2)},{f(y - 62)} q-30,-12 -36,-34 q26,4 36,34Z" fill="{lfg}"/>')
                o.append(f'<path d="M{f(x + 3)},{f(y - 50)} q30,-8 40,-30 q-28,0 -40,30Z" fill="{lfg}"/>')
        else:
            a = rnd.uniform(-25, 25)
            o.append(f'<g transform="translate({f(x)} {f(y)}) rotate({f(a)}) scale(1 0.42)">'
                     f'<rect x="-30" y="-30" width="60" height="60" rx="10" fill="{lfg}"/>'
                     f'<path d="M-24,0 L24,0 M-8,-22 L0,0 M10,22 L0,0" stroke="#B9E07E" stroke-width="2.5" opacity="0.8"/>'
                     f'<circle cx="-30" cy="-30" r="11" fill="{cal}"/><circle cx="30" cy="30" r="10" fill="{cal}"/></g>')
    # кришка
    lr, lry, lt = rx + 10, ry + 4, cy - 16
    lid = D.lin('pLid', [(0, '#ffffff', 0.5), (0.25, '#E7F1F8', 0.12), (0.75, '#E7F1F8', 0.1), (1, '#ffffff', 0.5)], 0, 0, 1, 0)
    o.append(f'<path d="M{f(cx - lr)},{f(lt)} L{f(cx - lr)},{f(lt + 30)} A{f(lr)},{f(lry)} 0 0 0 {f(cx + lr)},{f(lt + 30)} L{f(cx + lr)},{f(lt)} Z" fill="{lid}" stroke="#A9C1D2" stroke-width="2"/>')
    o.append(f'<ellipse cx="{f(cx)}" cy="{f(lt)}" rx="{f(lr)}" ry="{f(lry)}" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-width="3" stroke-opacity="0.9"/>')
    o.append(f'<ellipse cx="{f(cx)}" cy="{f(lt)}" rx="{f(lr - 6)}" ry="{f(lry - 3)}" fill="none" stroke="#9DB6C8" stroke-width="1.6" opacity="0.8"/>')
    # блики
    def arc(r_, ry2, a0, a1, yy, w, op):
        p0 = (cx + r_ * math.cos(math.radians(a0)), yy + ry2 * math.sin(math.radians(a0)))
        p1 = (cx + r_ * math.cos(math.radians(a1)), yy + ry2 * math.sin(math.radians(a1)))
        return f'<path d="M{f(p0[0])},{f(p0[1])} A{f(r_)},{f(ry2)} 0 0 1 {f(p1[0])},{f(p1[1])}" stroke="#fff" stroke-width="{w}" fill="none" stroke-linecap="round" opacity="{op}"/>'
    o.append(arc(lr - 16, lry - 8, 195, 250, lt, 7, 0.85))
    o.append(arc(lr - 30, lry - 16, 205, 230, lt, 3, 0.7))
    o.append(arc(lr - 14, lry - 6, 20, 55, lt, 5, 0.65))
    o.append(arc(lr, lry, 60, 120, lt + 30, 4, 0.7))
    o.append(f'<rect x="{f(cx - lr + 8)}" y="{f(lt + 4)}" width="6" height="26" rx="3" fill="#fff" opacity="0.75"/>')
    o.append(f'<rect x="{f(cx + lr - 20)}" y="{f(lt + 4)}" width="5" height="26" rx="2.5" fill="#fff" opacity="0.6"/>')
    return '\n'.join(o)


def tube(tx, ty, h=380, w=64, cap='cotton', seed=1, plant=True, medium='#F1DB8E'):
    """Пробірка з рослинкою in vitro на агарі; кришка: cotton | blue | yellow."""
    rnd = random.Random(seed)
    o = []
    r = w / 2
    body = f'M{f(tx - r)},{f(ty)} L{f(tx - r)},{f(ty + h - r)} A{f(r)},{f(r)} 0 0 0 {f(tx + r)},{f(ty + h - r)} L{f(tx + r)},{f(ty)} Z'
    cid = f'tubeClip{seed}'
    o.append(f'<clipPath id="{cid}"><path d="{body}"/></clipPath>')
    o.append(f'<path d="{body}" fill="#EAF3F8" fill-opacity="0.35"/>')
    lvl = ty + h - 140
    mg = D.lin('tubeMed', [(0, '#E2C46C'), (0.45, '#F8E8AE'), (1, '#D6B458')], 0, 0, 1, 0)
    o.append(f'<g clip-path="url(#{cid})">')
    o.append(f'<path d="M{f(tx - r)},{f(lvl - 8)} Q{f(tx)},{f(lvl + 6)} {f(tx + r)},{f(lvl - 8)} L{f(tx + r)},{f(ty + h)} L{f(tx - r)},{f(ty + h)}Z" fill="{mg}" opacity="0.92"/>')
    o.append(f'<path d="M{f(tx - r)},{f(lvl - 8)} Q{f(tx)},{f(lvl + 6)} {f(tx + r)},{f(lvl - 8)}" stroke="#C49A3A" stroke-width="2" fill="none"/>')
    if plant:
        # корені в агарі
        for k in range(4):
            a = rnd.uniform(-16, 16)
            o.append(f'<path d="M{f(tx)},{f(lvl)} q{f(a)},{f(30 + k * 8)} {f(a * 1.4)},{f(60 + k * 14)}" stroke="#F7F2E2" stroke-width="2.2" fill="none" opacity="0.95"/>')
        lg = D.lin('plantLeaf', [(0, '#9AD45A'), (0.55, '#4E9E2E'), (1, '#2C6B1C')], 0, 0, 1, 1)
        top = lvl - 150 - rnd.uniform(0, 30)
        o.append(f'<path d="M{f(tx)},{f(lvl)} C{f(tx - 6)},{f(lvl - 60)} {f(tx + 8)},{f(top + 50)} {f(tx + 2)},{f(top)}" stroke="#5DA437" stroke-width="5" fill="none" stroke-linecap="round"/>')
        for k, (yy, side, sz) in enumerate(((lvl - 36, -1, 0.75), (lvl - 74, 1, 0.9), (lvl - 112, -1, 1.0), (top + 8, 1, 0.8), (top + 4, -1, 0.65))):
            x0 = tx + 1
            L, W_ = 56 * sz, 19 * sz
            d = (f'M{f(x0)},{f(yy)} q{f(side * L * 0.5)},{f(-W_ * 1.4)} {f(side * L)},{f(-W_ * 1.1)} '
                 f'q{f(-side * L * 0.4)},{f(W_ * 1.4)} {f(-side * L)},{f(W_ * 1.1)}Z')
            o.append(f'<path d="{d}" fill="{lg}"/>')
            o.append(f'<path d="M{f(x0)},{f(yy)} q{f(side * L * 0.5)},{f(-W_ * 0.7)} {f(side * L * 0.92)},{f(-W_ * 1.05)}" stroke="#C9EC93" stroke-width="1.5" fill="none" opacity="0.8"/>')
    o.append('</g>')
    # скло
    gl = D.lin('tubeGlass', [(0, '#ffffff', 0.75), (0.14, '#ffffff', 0.15), (0.5, '#ffffff', 0.0), (0.82, '#ffffff', 0.12), (0.93, '#ffffff', 0.6), (1, '#9FB6C6', 0.5)], 0, 0, 1, 0)
    o.append(f'<path d="{body}" fill="{gl}" stroke="#8FA9BB" stroke-width="2.2"/>')
    o.append(f'<rect x="{f(tx - r + 7)}" y="{f(ty + 30)}" width="5" height="{f(h - 90)}" rx="2.5" fill="#fff" opacity="0.85"/>')
    o.append(f'<rect x="{f(tx + r - 12)}" y="{f(ty + 60)}" width="3" height="{f(h - 160)}" rx="1.5" fill="#fff" opacity="0.6"/>')
    o.append(f'<ellipse cx="{f(tx)}" cy="{f(ty)}" rx="{f(r + 3)}" ry="7" fill="#E9F2F7" fill-opacity="0.5" stroke="#8FA9BB" stroke-width="2.2"/>')
    if cap == 'cotton':
        cg = D.rad('cotton', [(0, '#FFFFFF'), (0.6, '#F1F1EC'), (1, '#C9C9C0')], cx=0.4, cy=0.35, r=0.7)
        o.append(f'<rect x="{f(tx - r + 3)}" y="{f(ty - 4)}" width="{f(w - 6)}" height="40" fill="#E8E6DD"/>')
        for bx_, by_, br in ((-20, -18, 20), (16, -20, 21), (-4, -34, 22), (-14, -4, 18), (14, -2, 19), (4, -48, 15), (-24, -38, 12), (24, -38, 13)):
            o.append(f'<circle cx="{f(tx + bx_)}" cy="{f(ty + by_)}" r="{br}" fill="{cg}"/>')
    else:
        c1, c2 = ('#2B6CB0', '#0B3D6B') if cap == 'blue' else ('#FFE04D', '#D9A400')
        cgr = D.lin('cap' + cap, [(0, c2), (0.3, c1), (0.55, mix(c1, '#ffffff', 0.35)), (0.8, c1), (1, c2)], 0, 0, 1, 0)
        o.append(f'<rect x="{f(tx - r - 6)}" y="{f(ty - 56)}" width="{f(w + 12)}" height="78" rx="8" fill="{cgr}"/>')
        for k in range(7):
            xx = tx - r + 2 + k * (w - 4) / 6
            o.append(f'<line x1="{f(xx)}" y1="{f(ty - 48)}" x2="{f(xx)}" y2="{f(ty + 14)}" stroke="#000" stroke-opacity="0.15" stroke-width="2"/>')
        o.append(f'<ellipse cx="{f(tx)}" cy="{f(ty - 56)}" rx="{f(r + 6)}" ry="8" fill="{mix(c1, "#ffffff", 0.25)}"/>')
    return '\n'.join(o)


def tube_rack(x, y, n=3, gap=110, caps=('cotton', 'blue', 'cotton')):
    """Штатив з n пробірками; x,y — лівий верхній кут верхньої планки."""
    o = []
    W = gap * n + 40
    o.append(soft_shadow(x + W / 2 + 10, y + 360, W * 0.62, 26, 0.5))
    rk = D.lin('rack', [(0, '#3C7CC0'), (1, '#0B3D6B')], 0, 0, 0, 1)
    rkt = D.lin('rackTop', [(0, '#6FA3D8'), (1, '#2B6CB0')], 0, 0, 0, 1)
    # задні стійки й нижня планка
    o.append(f'<rect x="{f(x + 6)}" y="{f(y)}" width="16" height="352" rx="4" fill="{BLUE_D}"/>')
    o.append(f'<rect x="{f(x + W - 22)}" y="{f(y)}" width="16" height="352" rx="4" fill="{BLUE_D}"/>')
    o.append(f'<path d="M{f(x)},{f(y + 300)} l20,-18 h{f(W - 40)} l20,18Z" fill="#5B8FC6"/>')
    o.append(f'<rect x="{f(x)}" y="{f(y + 300)}" width="{f(W)}" height="22" rx="4" fill="{rk}"/>')
    # верхня планка (верх)
    o.append(f'<path d="M{f(x)},{f(y + 18)} l20,-22 h{f(W - 40)} l20,22Z" fill="{rkt}"/>')
    for i in range(n):
        tx = x + 20 + gap * (i + 0.5) + 10
        o.append(f'<ellipse cx="{f(tx)}" cy="{f(y + 7)}" rx="38" ry="8" fill="#082C50"/>')
    for i in range(n):
        tx = x + 20 + gap * (i + 0.5) + 10
        o.append(tube(tx, y - 70, h=380, cap=caps[i], seed=11 + i))
    # передня грань планок
    o.append(f'<rect x="{f(x)}" y="{f(y + 18)}" width="{f(W)}" height="34" rx="5" fill="{rk}"/>')
    o.append(f'<rect x="{f(x + 4)}" y="{f(y + 21)}" width="{f(W - 8)}" height="3" rx="1.5" fill="#9CC3EA" opacity="0.8"/>')
    o.append(f'<rect x="{f(x)}" y="{f(y + 300)}" width="{f(W)}" height="22" rx="4" fill="{rk}" opacity="0.0"/>')
    o.append(f'<rect x="{f(x + 4)}" y="{f(y + 34)}" width="16" height="324" rx="4" fill="{rk}"/>')
    o.append(f'<rect x="{f(x + W - 20)}" y="{f(y + 34)}" width="16" height="324" rx="4" fill="{rk}"/>')
    return '\n'.join(o)


def metal(id_, base='#B8C2CA'):
    return D.lin(id_, [(0, '#5E6872'), (0.18, '#C9D1D8'), (0.32, '#F7F9FA'), (0.5, base), (0.75, '#7D8892'), (1, '#4B545D')], 0, 0, 1, 0)


def microscope(x, y, s=1.0):
    """Світловий мікроскоп (вигляд збоку). x,y — лівий нижній кут основи."""
    o = [f'<g transform="translate({f(x)} {f(y)}) scale({s})">']
    en = D.lin('enamel', [(0, '#FFFFFF'), (0.55, '#E9EEF2'), (1, '#B7C3CD')], 0, 0, 1, 0)
    env = D.lin('enamelV', [(0, '#FFFFFF'), (0.5, '#E6ECF1'), (1, '#AEBBC6')], 0, 0, 0, 1)
    blk = D.lin('blackM', [(0, '#151A20'), (0.3, '#4A535D'), (0.45, '#7E8994'), (0.6, '#3A424B'), (1, '#12161B')], 0, 0, 1, 0)
    blkv = D.lin('blackV', [(0, '#5A646E'), (0.25, '#2A3038'), (1, '#0F1317')], 0, 0, 0, 1)
    chrome = metal('chromeM')
    o.append(soft_shadow(200, 4, 250, 26, 0.6))
    # основа
    o.append(f'<path d="M0,0 L0,-46 Q0,-70 26,-72 L360,-80 Q400,-80 404,-50 L410,0 Z" fill="{env}" stroke="#9AA8B4" stroke-width="2"/>')
    o.append(f'<path d="M8,-58 Q10,-68 30,-68 L356,-76" stroke="#fff" stroke-width="4" fill="none" opacity="0.9"/>')
    o.append(f'<rect x="0" y="-12" width="410" height="12" fill="#8E9CA8" opacity="0.5"/>')
    # освітлювач
    glow = D.rad('lampGlow', [(0, '#FFF7C2'), (0.4, '#FFE066', 0.9), (1, '#FFD200', 0)])
    o.append(f'<ellipse cx="270" cy="-82" rx="70" ry="26" fill="{glow}"/>')
    o.append(f'<ellipse cx="270" cy="-80" rx="34" ry="9" fill="#2A3038"/>')
    o.append(f'<ellipse cx="270" cy="-82" rx="26" ry="6" fill="#FFF3B0"/>')
    # штатив (дуга)
    o.append(f'<path d="M40,-70 L40,-330 Q40,-470 120,-540 L200,-590 L232,-548 L168,-500 Q126,-466 126,-380 L130,-74 Z" fill="{en}" stroke="#9AA8B4" stroke-width="2"/>')
    o.append(f'<path d="M50,-80 L50,-330 Q50,-460 122,-526" stroke="#fff" stroke-width="5" fill="none" opacity="0.85"/>')
    o.append(f'<path d="M124,-90 L120,-380 Q120,-450 160,-492" stroke="#8C9AA6" stroke-width="3" fill="none" opacity="0.6"/>')
    # синя смуга-акцент
    o.append(f'<path d="M42,-250 L128,-250 L128,-226 L42,-226Z" fill="{BLUE}"/>')
    o.append(f'<path d="M42,-250 L128,-250 L128,-245 L42,-245Z" fill="#4C8BCF"/>')
    # конденсор
    o.append(f'<rect x="246" y="-238" width="48" height="56" rx="4" fill="{blk}"/>')
    o.append(f'<rect x="240" y="-246" width="60" height="12" rx="3" fill="{chrome}"/>')
    o.append(f'<rect x="232" y="-196" width="26" height="8" rx="3" fill="{chrome}"/>')
    # предметний столик
    o.append(f'<path d="M110,-270 L392,-270 L400,-252 L118,-252 Z" fill="#1E242B"/>')
    o.append(f'<path d="M110,-276 L390,-276 L392,-270 L110,-270 Z" fill="#59636D"/>')
    o.append(f'<rect x="118" y="-252" width="282" height="12" fill="{blkv}"/>')
    # препарат
    o.append(f'<path d="M190,-282 L350,-282 L356,-276 L196,-276 Z" fill="#DDEFFA" stroke="#9BC1D8" stroke-width="1.5"/>')
    o.append(f'<ellipse cx="272" cy="-279" rx="18" ry="3" fill="#7B3FA0" opacity="0.8"/>')
    o.append(f'<path d="M150,-284 L220,-280" stroke="{chrome}" stroke-width="5" stroke-linecap="round"/>')
    o.append(f'<path d="M330,-280 L384,-284" stroke="{chrome}" stroke-width="5" stroke-linecap="round"/>')
    # гвинти фокусування
    kn = D.rad('knob', [(0, '#F4F6F8'), (0.45, '#AEB8C1'), (0.8, '#59636D'), (1, '#2F363D')], cx=0.38, cy=0.35, r=0.7)
    o.append(f'<circle cx="84" cy="-168" r="52" fill="{kn}"/>')
    o.append(f'<circle cx="84" cy="-168" r="46" fill="none" stroke="#39414A" stroke-width="6" stroke-dasharray="3 5" opacity="0.7"/>')
    o.append(f'<circle cx="84" cy="-168" r="27" fill="{kn}" stroke="#2F363D" stroke-width="2"/>')
    o.append(f'<circle cx="76" cy="-178" r="7" fill="#fff" opacity="0.8"/>')
    # головка
    o.append(f'<path d="M150,-556 L330,-556 Q352,-556 352,-534 L352,-472 Q352,-452 330,-452 L176,-452 Z" fill="{env}" stroke="#9AA8B4" stroke-width="2"/>')
    o.append(f'<path d="M168,-548 L328,-548" stroke="#fff" stroke-width="4" opacity="0.9"/>')
    # тубус окуляра (нахилений)
    o.append(f'<g transform="rotate(-38 236 -556)">'
             f'<rect x="206" y="-720" width="60" height="170" fill="{blk}"/>'
             f'<rect x="200" y="-742" width="72" height="30" rx="5" fill="{chrome}"/>'
             f'<rect x="210" y="-790" width="52" height="52" rx="8" fill="{blk}"/>'
             f'<rect x="206" y="-800" width="60" height="18" rx="7" fill="#181C21"/>'
             f'<rect x="214" y="-712" width="6" height="150" fill="#fff" opacity="0.35"/></g>')
    # револьвер
    o.append(f'<path d="M210,-452 L330,-452 L318,-412 Q270,-398 222,-412 Z" fill="{chrome}"/>')
    o.append(f'<path d="M222,-412 Q270,-398 318,-412" stroke="#4B545D" stroke-width="2" fill="none"/>')
    # об'єктиви
    objs = [(-26, 0.85, '#E53935'), (24, 0.85, '#1E88E5'), (0, 1, '#FBC02D')]
    for ang, sc, band in objs:
        g = f'<g transform="rotate({ang} 270 -410)">'
        g += f'<rect x="{f(270 - 20 * sc)}" y="-410" width="{f(40 * sc)}" height="{f(70 * sc)}" fill="{chrome}"/>'
        g += f'<rect x="{f(270 - 20 * sc)}" y="{f(-410 + 34 * sc)}" width="{f(40 * sc)}" height="{f(8 * sc)}" fill="{band}"/>'
        g += f'<path d="M{f(270 - 16 * sc)},{f(-410 + 70 * sc)} L{f(270 + 16 * sc)},{f(-410 + 70 * sc)} L{f(270 + 9 * sc)},{f(-410 + 100 * sc)} L{f(270 - 9 * sc)},{f(-410 + 100 * sc)} Z" fill="{chrome}"/>'
        g += f'<rect x="{f(270 - 9 * sc)}" y="{f(-410 + 100 * sc)}" width="{f(18 * sc)}" height="6" rx="2" fill="#2A3038"/>'
        g += '</g>'
        o.append(g)
    o.append('</g>')
    return '\n'.join(o)


def beaker(bx, by, w=230, h=270, liquid=0.5):
    """Хімічний стакан з носиком, поділками і зеленим реактивом з меніском. bx,by — центр дна."""
    o = []
    x0, x1, top = bx - w / 2, bx + w / 2, by - h
    o.append(soft_shadow(bx + 8, by + 6, w * 0.62, 20, 0.55))
    # каустика (світло крізь рідину)
    cg = D.rad('caustic', [(0, '#7DDC8C', 0.55), (1, '#7DDC8C', 0)])
    o.append(f'<ellipse cx="{f(bx + 70)}" cy="{f(by + 10)}" rx="{f(w * 0.5)}" ry="18" fill="{cg}"/>')
    lt = by - h * liquid
    cid = 'beakClip'
    inner = f'M{f(x0 + 6)},{f(top + 8)} L{f(x0 + 6)},{f(by - 18)} Q{f(x0 + 6)},{f(by - 4)} {f(x0 + 22)},{f(by - 4)} L{f(x1 - 22)},{f(by - 4)} Q{f(x1 - 6)},{f(by - 4)} {f(x1 - 6)},{f(by - 18)} L{f(x1 - 6)},{f(top + 8)}Z'
    o.append(f'<clipPath id="{cid}"><path d="{inner}"/></clipPath>')
    lq = D.lin('liq', [(0, '#1F7A3A'), (0.35, '#3FB25A'), (0.6, '#66C978'), (1, '#1C6C33')], 0, 0, 1, 0)
    o.append(f'<g clip-path="url(#{cid})">')
    o.append(f'<rect x="{f(x0)}" y="{f(lt)}" width="{f(w)}" height="{f(h)}" fill="{lq}" opacity="0.88"/>')
    o.append(f'<ellipse cx="{f(bx)}" cy="{f(lt)}" rx="{f(w / 2 - 6)}" ry="13" fill="#8EDB9B"/>')
    o.append(f'<ellipse cx="{f(bx)}" cy="{f(lt + 2)}" rx="{f(w / 2 - 12)}" ry="9" fill="#55BF6A"/>')
    # бульбашки
    for (dx, dy, r) in ((-40, 50, 5), (-28, 90, 3.5), (30, 70, 4), (52, 30, 3), (8, 110, 3)):
        o.append(f'<circle cx="{f(bx + dx)}" cy="{f(lt + dy)}" r="{r}" fill="none" stroke="#D8F7DE" stroke-width="1.5" opacity="0.9"/>')
    o.append('</g>')
    # скло
    outer = (f'M{f(x0 - 16)},{f(top - 4)} Q{f(x0 - 4)},{f(top + 2)} {f(x0)},{f(top + 16)} L{f(x0)},{f(by - 16)} Q{f(x0)},{f(by)} {f(x0 + 18)},{f(by)} '
             f'L{f(x1 - 18)},{f(by)} Q{f(x1)},{f(by)} {f(x1)},{f(by - 16)} L{f(x1)},{f(top + 8)} Q{f(x1)},{f(top)} {f(x1 + 6)},{f(top - 2)}')
    gl = D.lin('bGlass', [(0, '#ffffff', 0.7), (0.12, '#ffffff', 0.18), (0.5, '#ffffff', 0.04), (0.85, '#ffffff', 0.15), (0.95, '#ffffff', 0.55), (1, '#9FB6C6', 0.5)], 0, 0, 1, 0)
    o.append(f'<path d="{outer} Z" fill="{gl}" stroke="#8FA9BB" stroke-width="3"/>')
    o.append(f'<ellipse cx="{f(bx - 4)}" cy="{f(top)}" rx="{f(w / 2 + 6)}" ry="10" fill="none" stroke="#8FA9BB" stroke-width="3"/>')
    o.append(f'<ellipse cx="{f(bx - 4)}" cy="{f(top)}" rx="{f(w / 2 + 4)}" ry="8" fill="none" stroke="#fff" stroke-width="2" opacity="0.8"/>')
    # поділки
    for k in range(1, 5):
        yy = by - 40 - k * 44
        ln = 40 if k % 2 == 0 else 24
        o.append(f'<line x1="{f(x0 + 20)}" y1="{f(yy)}" x2="{f(x0 + 20 + ln)}" y2="{f(yy)}" stroke="#ffffff" stroke-width="3" opacity="0.95"/>')
        if k % 2 == 0:
            o.append(T(x0 + 68, yy + 8, str(k * 50), 22, 600, '#ffffff', 'Inter', op=0.95))
    o.append(f'<rect x="{f(x0 + 8)}" y="{f(top + 26)}" width="7" height="{f(h - 60)}" rx="3.5" fill="#fff" opacity="0.85"/>')
    o.append(f'<rect x="{f(x1 - 16)}" y="{f(top + 40)}" width="4" height="{f(h - 100)}" rx="2" fill="#fff" opacity="0.6"/>')
    return '\n'.join(o)


def pipette(px, py, ang=18, s=1.0):
    """Автоматична мікропіпетка; px,py — кінчик наконечника."""
    o = [f'<g transform="translate({f(px)} {f(py)}) rotate({ang}) scale({s})">']
    o.append('<g transform="translate(0 -640)">')
    bod = D.lin('pipBody', [(0, '#B9C4CE'), (0.25, '#FFFFFF'), (0.55, '#E3E9EE'), (1, '#8E9BA7')], 0, 0, 1, 0)
    btn = D.lin('pipBtn', [(0, '#08305A'), (0.35, '#3D86D6'), (0.6, '#1B5C96'), (1, '#062440')], 0, 0, 1, 0)
    tipg = D.lin('pipTip', [(0, '#FFF2A8', 0.85), (0.4, '#FFF8D0', 0.45), (1, '#E9CF55', 0.85)], 0, 0, 1, 0)
    # кнопка-плунжер
    o.append(f'<rect x="-20" y="0" width="40" height="26" rx="10" fill="{btn}"/>')
    o.append(f'<rect x="-7" y="24" width="14" height="30" fill="#8E9BA7"/>')
    # корпус
    o.append(f'<path d="M-34,54 L34,54 Q40,54 40,64 L38,300 Q36,330 22,350 L-22,350 Q-36,330 -38,300 L-40,64 Q-40,54 -34,54Z" fill="{bod}" stroke="#7D8A96" stroke-width="2"/>')
    # гачок для пальця
    o.append(f'<path d="M38,90 Q82,92 86,124 Q86,140 70,140 Q60,120 38,124Z" fill="{bod}" stroke="#7D8A96" stroke-width="2"/>')
    # дисплей об'єму
    o.append(f'<rect x="-22" y="150" width="44" height="96" rx="6" fill="#20262D"/>')
    for k, dgt in enumerate('100'):
        o.append(T(0, 182 + k * 28, dgt, 24, 600, '#9EF0B0', 'JetBrains Mono', 'middle'))
    o.append(f'<rect x="-30" y="66" width="8" height="230" rx="4" fill="#fff" opacity="0.7"/>')
    # синя вставка
    o.append(f'<rect x="-38" y="268" width="76" height="16" fill="{btn}"/>')
    # стрижень і ежектор
    o.append(f'<path d="M-22,350 L22,350 L14,470 L-14,470Z" fill="{bod}" stroke="#7D8A96" stroke-width="2"/>')
    o.append(f'<path d="M-14,470 L14,470 L8,500 L-8,500Z" fill="#9AA6B1"/>')
    # наконечник
    o.append(f'<path d="M-10,496 L10,496 L2.5,640 L-2.5,640Z" fill="{tipg}" stroke="#C9AE3E" stroke-width="1.2"/>')
    o.append(f'<path d="M-6,590 L6,590 L2.5,640 L-2.5,640Z" fill="#3FB25A" opacity="0.85"/>')
    o.append('</g></g>')
    # крапля (вертикально вниз, без повороту)
    dg = D.rad('dropG', [(0, '#B9F0C4'), (0.6, '#3FB25A'), (1, '#1C6C33')], cx=0.38, cy=0.35, r=0.7)
    o.append(f'<path d="M{f(px)},{f(py + 8)} q-11,18 0,28 q11,-10 0,-28Z" fill="{dg}"/>')
    o.append(f'<circle cx="{f(px - 3)}" cy="{f(py + 26)}" r="2.6" fill="#fff" opacity="0.9"/>')
    return '\n'.join(o)


# ================================================================ ДРІБНІ ЕЛЕМЕНТИ ДИЗАЙНУ
def icon(kind, cx, cy, r=30, color=BLUE, fg='#fff'):
    o = [f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{color}"/>']
    k = r / 30
    g = f'<g transform="translate({f(cx)} {f(cy)}) scale({f(k)})" fill="none" stroke="{fg}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">'
    shapes = {
        'pin': '<path d="M0,15 C-10,3 -12,-3 -12,-7 a12,12 0 0 1 24,0 c0,4 -2,10 -12,22Z"/><circle cx="0" cy="-7" r="4"/>',
        'phone': '<path d="M-11,-13 l6,-2 l5,9 l-4,4 q3,7 10,10 l4,-4 l9,5 l-2,6 q-2,4 -8,3 q-14,-3 -21,-21 q-1,-6 1,-10Z"/>',
        'mail': '<rect x="-14" y="-10" width="28" height="20" rx="3"/><path d="M-13,-8 L0,3 L13,-8"/>',
        'leaf': '<path d="M-12,12 C-12,-6 0,-14 14,-14 C14,2 6,12 -12,12Z"/><path d="M-12,12 L6,-6"/>',
        'cal': '<rect x="-13" y="-11" width="26" height="24" rx="3"/><path d="M-13,-3 H13 M-6,-15 V-8 M6,-15 V-8"/>',
        'lang': '<path d="M-14,-10 H4 M-5,-14 V-10 M0,-10 Q-2,2 -13,8 M-9,-4 Q-4,4 4,6"/><path d="M2,14 L8,-2 L14,14 M4,9 H12"/>',
        'cap': '<path d="M-15,-4 L0,-11 L15,-4 L0,3Z"/><path d="M-8,0 V8 Q0,13 8,8 V0"/><path d="M15,-4 V6"/>',
        'flask': '<path d="M-5,-14 H5 M-3,-14 V-4 L-12,11 Q-13,14 -9,14 H9 Q13,14 12,11 L3,-4 V-14"/><path d="M-8,5 H8"/>',
        'screen': '<rect x="-15" y="-11" width="30" height="20" rx="2"/><path d="M-6,14 H6 M0,9 V14"/>',
        'globe': '<circle r="14"/><ellipse rx="6" ry="14"/><path d="M-14,0 H14"/>',
        'steps': '<path d="M-14,12 H-5 V3 H4 V-6 H13"/><path d="M8,-12 L13,-6 L8,0" />',
        'micro': '<path d="M-10,13 H12 M-4,13 Q-12,4 -4,-4 M2,-14 L-6,-2 L0,2 L8,-10Z M2,6 H10"/>',
        'people': '<circle cx="-6" cy="-6" r="5"/><circle cx="8" cy="-4" r="4"/><path d="M-15,12 Q-6,-2 3,12 M3,8 Q8,0 15,10"/>',
        'build': '<path d="M-14,13 H14 M-12,13 V-2 M12,13 V-2 M-15,-2 L0,-13 L15,-2Z M-5,13 V3 H5 V13"/>',
    }
    o.append(g + shapes[kind] + '</g>')
    return '\n'.join(o)


def section_head(x, y, num, title_lines, color=BLUE, size=60):
    o = []
    o.append(f'<rect x="{f(x)}" y="{f(y - 46)}" width="86" height="52" rx="6" fill="{YEL}"/>')
    o.append(T(x + 43, y - 8, num, 34, 800, BLUE, 'Inter Display', 'middle'))
    yy = y + 78
    for ln in title_lines:
        o.append(T(x, yy, ln, size, 800, color, 'Inter Display'))
        yy += size * 1.08
    return '\n'.join(o), yy - size * 1.08


def hrule(x1, x2, y, color=LINE, w=2):
    return f'<line x1="{f(x1)}" y1="{f(y)}" x2="{f(x2)}" y2="{f(y)}" stroke="{color}" stroke-width="{w}"/>'



# ================================================================ DL: спільне
W, H = 990, 2100
M = 50  # безпечне поле


def photo(cx, cy, r, sym, cid, ring='#fff'):
    """Фото в кружечку: тінь, біле кільце, тонка жовта обвідка."""
    o = [f'<circle cx="{f(cx + 5)}" cy="{f(cy + 10)}" r="{f(r + 9)}" fill="#000" opacity="0.22"/>',
         f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r + 9)}" fill="{ring}"/>',
         f'<clipPath id="{cid}"><circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/></clipPath>',
         f'<g clip-path="url(#{cid})"><use href="#{sym}" x="{f(cx - r)}" y="{f(cy - r)}" width="{f(2 * r)}" height="{f(2 * r)}"/></g>',
         f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="2"/>',
         f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r + 14)}" fill="none" stroke="{YEL}" stroke-width="3"/>']
    return '\n'.join(o)


def chip(x, y, label, size=24, fill='#fff', stroke=LINE, color=INK, w=500, pad=18, h=46):
    wd = tw(label, size, w) + pad * 2
    return (f'<rect x="{f(x)}" y="{f(y)}" width="{f(wd)}" height="{h}" rx="{h / 2}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
            + T(x + pad, y + h / 2 + size * 0.36, label, size, w, color)), wd


# ================================================================ ЛИЦЬОВА СТОРОНА
def front():
    global D
    D = Defs()
    o = []
    x0, x1 = M, W - M
    bg = D.lin('frBg', [(0, '#0E4C86'), (0.5, BLUE), (1, '#051E36')], 0, 0, 0, 1)
    o.append(f'<rect width="{W}" height="{H}" fill="{bg}"/>')
    # декор: сонце + листок на просвіт унизу
    o.append(f'<clipPath id="pageClip"><rect width="{W}" height="{H}"/></clipPath><g clip-path="url(#pageClip)">')
    sg = D.rad('sunGlow', [(0, '#FFF6B0', 1), (0.18, YEL, 0.8), (0.45, '#FFB800', 0.22), (1, '#FFB800', 0)])
    o.append(sun_rays(900, 1560, 50, 760, 30, 9, 0.14))
    o.append(f'<circle cx="900" cy="1560" r="470" fill="{sg}"/>')
    o.append(f'<g opacity="0.95">{leaf(-40, 2240, 1150, 330, -32, seed=4, idp="fl")}</g>')
    shade = D.lin('btmShade', [(0, '#051E36', 0), (1, '#051E36', 0.7)], 0, 0, 0, 1)
    o.append(f'<rect x="0" y="1880" width="{W}" height="220" fill="{shade}"/>')
    o.append('</g>')
    # шапка з гербом
    o.append(f'<rect width="{W}" height="300" fill="#fff"/>')
    o.append(f'<rect y="300" width="{W}" height="10" fill="{YEL}"/>')
    o.append(f'<use href="#nubip-crest" x="{x0 - 6}" y="32" width="224" height="236"/>')
    s, y = para(x0 + 236, 98, 'Національний університет біоресурсів і природокористування України', x1 - x0 - 236, 27, 1.3, 600, 600, BLUE)
    o.append(s)
    o.append(T(x0 + 236, y - 2, '(НУБіП України)', 24, 600, GREEN))
    s, _ = para(x0 + 236, y + 40, 'Факультет захисту рослин, біотехнологій та екології', x1 - x0 - 236, 24, 1.3, 400, 600, GRAY)
    o.append(s)
    # логотип
    lc = (W / 2, 505)
    lgl = D.rad('logoGlow', [(0, YEL, 0.5), (0.6, YEL, 0.1), (1, YEL, 0)])
    o.append(f'<circle cx="{lc[0]}" cy="{lc[1]}" r="250" fill="{lgl}"/>')
    o.append(f'<circle cx="{lc[0] + 5}" cy="{lc[1] + 10}" r="160" fill="#000" opacity="0.25"/>')
    o.append(f'<circle cx="{lc[0]}" cy="{lc[1]}" r="160" fill="#fff"/>')
    o.append(f'<use href="#dept-logo" x="{lc[0] - 151}" y="{lc[1] - 151}" width="302" height="302"/>')
    # назва
    o.append(T(W / 2, 735, 'КАФЕДРА', 28, 600, YEL, 'Inter', 'middle', ls=10))
    for i, ln in enumerate(['фізіології, біохімії', 'рослин та біоенергетики']):
        o.append(T(W / 2, 808 + i * 70, ln, 62 if i == 0 else 58, 800, '#fff', 'Inter Display', 'middle'))
    o.append(T(W / 2, 956, '«Наука про життя рослин»', 38, 500, '#FFE680', 'Lora', 'middle', italic=True))
    # коротко про кафедру
    y = 1040
    o.append(hrule(x0, x1, y - 4, '#2E6497', 2))
    y += 50
    s, y = para(x0, y, 'Одна з найстаріших і фундаментальних науково-освітніх ланок НУБіП України: **128 років** української школи фізіології рослин — **від 1898 р.**', x1 - x0, 26, 1.38, 400, 600, '#DCE8F4', YEL)
    o.append(s)
    s, y = para(x0, y + 10, 'Класична школа фізіології та біохімії рослин і сучасні напрями: клітинна біоінженерія, фітовірусологія, нанобіотехнології, біоенергетика, моніторинг біосистем.', x1 - x0, 26, 1.38, 400, 600, '#DCE8F4', '#ffffff')
    o.append(s)
    s, y = para(x0, y + 10, 'Викладаємо українською та англійською. Готуємо бакалаврів, магістрів і докторів філософії (PhD). Студентський науковий гурток **«ФІТОЛАБ»**.', x1 - x0, 26, 1.38, 400, 600, '#DCE8F4', '#ffffff')
    o.append(s)
    # фото в кружечках
    r = 128
    cy = y + 150
    caps = [('photo-fp-tubes', 'Флуоресцентні білки', None), ('photo-invitro', 'Культура ', 'in vitro'), ('photo-elodea', 'Клітини елодеї', None)]
    for i, (sym, c1, c2) in enumerate(caps):
        cx = x0 + 145 + i * 300
        o.append(photo(cx, cy, r, sym, f'ph{i}'))
        cw_ = tw(c1 + (c2 or ''), 24, 600) + 36
        o.append(f'<rect x="{f(cx - cw_ / 2)}" y="{f(cy + r + 24)}" width="{f(cw_)}" height="46" rx="23" fill="{BLUE_D}" fill-opacity="0.88"/>')
        t = (f'<text x="{f(cx)}" y="{f(cy + r + 56)}" font-family="\'Inter\'" font-size="24" font-weight="600" fill="#fff" text-anchor="middle">{esc(c1)}'
             + (f'<tspan font-family="\'Lora\'" font-style="italic" font-weight="500">{esc(c2)}</tspan>' if c2 else '') + '</text>')
        o.append(t)
    y = cy + r + 110
    # кафедра в цифрах
    stats = [('2', 'доктори біологічних наук'), ('5', 'кандидатів наук'), ('1', 'професор'), ('6', 'доцентів')]
    tw_ = (x1 - x0 - 3 * 12) / 4
    for i, (n, cap) in enumerate(stats):
        sx = x0 + i * (tw_ + 12)
        o.append(f'<rect x="{f(sx)}" y="{f(y)}" width="{f(tw_)}" height="176" rx="14" fill="#ffffff" fill-opacity="0.94"/>')
        o.append(T(sx + 18, y + 62, n, 54, 800, BLUE, 'Inter Display'))
        s, _ = para(sx + 18, y + 96, cap, tw_ - 26, 24, 1.2, 500, 600, INK)
        o.append(s)
    return o


# ================================================================ ЗВОРОТНА СТОРОНА
def back():
    global D
    D = Defs()
    o = []
    x0, x1 = M, W - M
    o.append(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')
    o.append(f'<rect width="{W}" height="14" fill="{BLUE}"/><rect y="14" width="{W}" height="5" fill="{YEL}"/>')
    o.append(T(x0, 84, 'ОСВІТНЬО-ПРОФЕСІЙНА ПРОГРАМА БАКАЛАВРА', 24, 600, GREEN, ls=2))
    o.append(T(x0, 146, 'Біотехнології та біоінженерія', 50, 800, BLUE, 'Inter Display'))
    y = 180
    row1 = [('Ступінь', 'Бакалавр'), ('Спеціальність', '162 (G21)'), ('Форма', 'Денна')]
    row2 = [('Тривалість', '3 роки 10 місяців'), ('Обсяг', '240 кредитів ЄКТС')]
    for row in (row1, row2):
        n = len(row)
        tw_ = (x1 - x0 - (n - 1) * 12) / n
        for i, (k, v) in enumerate(row):
            fx = x0 + i * (tw_ + 12)
            o.append(f'<rect x="{f(fx)}" y="{f(y)}" width="{f(tw_)}" height="108" rx="14" fill="{BLUE}"/>')
            o.append(f'<rect x="{f(fx)}" y="{f(y)}" width="{f(tw_)}" height="7" rx="3.5" fill="{YEL}"/>')
            o.append(T(fx + 20, y + 44, k.upper(), 24, 600, '#A9C6E4', ls=1))
            o.append(T(fx + 20, y + 88, v, 34, 800, '#fff', 'Inter Display'))
        y += 120
    s, y = para(x0, y + 34, 'Перший (бакалаврський) рівень · галузь знань 16 «Хімічна та біоінженерія» · кваліфікація — бакалавр з біотехнологій та біоінженерії · вступ на основі повної загальної середньої освіти.', x1 - x0, 25, 1.36, 400, 600, INK, BLUE)
    o.append(s)
    # вибіркові блоки
    y += 6
    o.append(T(x0, y + 8, 'Вибіркові блоки:', 25, 600, BLUE))
    cx_ = x0 + tw('Вибіркові блоки:', 25, 600) + 14
    for c in ('«Промислова біотехнологія»', '«Фітобіотехнологія»'):
        wd = tw(c, 24, 500) + 28
        if cx_ + wd > x1:
            cx_, y = x0, y + 56
        s, wd = chip(cx_, y - 22, c, 24, '#EEF5EA', '#BFDDB0', GREEN_D, 500, pad=14)
        o.append(s)
        cx_ += wd + 8
    y += 84
    # дисципліни у дві колонки
    cw = (x1 - x0 - 30) / 2
    cols = [('Обов’язкові дисципліни', ['Біохімія', 'Біологія клітини', 'Фізіологія рослин', 'Загальна біотехнологія', 'Молекулярна біотехнологія', 'Біоінженерія']),
            ('Блок «Фітобіотехнологія»', ['Клітинна біоенергетика', 'Біологія лікарських рослин', 'Промислове культивування грибів та водоростей', 'Біометрія'])]
    ys = []
    for j, (hd, items) in enumerate(cols):
        cx = x0 + j * (cw + 30)
        o.append(T(cx, y, hd.upper() if False else hd, 26, 600, GREEN_D))
        o.append(f'<rect x="{f(cx)}" y="{f(y + 14)}" width="{f(cw)}" height="3" fill="{GREEN_L}"/>')
        yy = y + 56
        for it in items:
            o.append(f'<circle cx="{f(cx + 8)}" cy="{f(yy - 8)}" r="6.5" fill="{YEL}" stroke="{BLUE}" stroke-width="2.5"/>')
            s, yy = para(cx + 26, yy, it, cw - 26, 25, 1.26, 400, 600, INK)
            o.append(s)
            yy += 6
        ys.append(yy)
    y = max(ys) + 16
    s, y = para(x0, y, '**Практика:** три навчальні практики й виробнича практика.', x1 - x0, 25, 1.36, 400, 600, INK, BLUE)
    o.append(s)
    s, y = para(x0, y + 4, '**Далі:** магістратура (освітньо-професійна програма «Екологічна біотехнологія та біоенергетика») і PhD.', x1 - x0, 25, 1.36, 400, 600, INK, BLUE)
    o.append(s)
    # лабораторії
    y += 30
    o.append(hrule(x0, x1, y - 30, LINE, 2))
    o.append(T(x0, y + 20, 'Лабораторії кафедри', 40, 800, BLUE, 'Inter Display'))
    o.append(T(x0, y + 56, 'навчальний корпус № 4', 24, 500, GRAY))
    y += 100
    labs = [('Навчально-наукова лабораторія біохімії та фітобіотехнології', 'з 2021 р. · ауд. 14'),
            ('Навчальна лабораторія біохімії рослин', 'з 2008 р. · ауд. 38'),
            ('Навчальна лабораторія фізіології рослин', 'з 2008 р. · ауд. 56')]
    lw = x1 - x0 - 230
    for name, meta in labs:
        s, yy = para(x0 + 24, y, name, lw - 24, 25, 1.28, 600, 600, INK)
        o.append(f'<rect x="{f(x0)}" y="{f(y - 24)}" width="7" height="{f(yy + 10 - (y - 24))}" rx="3.5" fill="{YEL}"/>')
        o.append(s)
        o.append(T(x0 + 24, yy + 2, meta, 24, 500, GREEN_D))
        y = yy + 52
    # декор: мікроскоп праворуч
    mic_y = y - 40
    o.append(microscope(x1 - 205, mic_y, 0.5))
    # QR
    y += 10
    qs, gap = 280, (x1 - x0 - 3 * 280) / 2
    qrs = [('qr-instagram', 'Instagram', '@plant_physio_chair'), ('qr-facebook', 'Facebook', 'Ми у Facebook'),
           ('qr-nubip', 'Сторінка кафедри', 'на сайті НУБіП')]
    for i, (q, a, b) in enumerate(qrs):
        qx = x0 + i * (qs + gap)
        o.append(f'<rect x="{f(qx - 4)}" y="{f(y - 4)}" width="{qs + 8}" height="{qs + 8}" rx="10" fill="#fff" stroke="{LINE}" stroke-width="2"/>')
        o.append(f'<use href="#{q}" x="{f(qx)}" y="{f(y)}" width="{qs}" height="{qs}" color="{BLUE_D}"/>')
        o.append(T(qx + qs / 2, y + qs + 38, a, 24, 600, BLUE, 'Inter', 'middle'))
        o.append(T(qx + qs / 2, y + qs + 70, b, 24, 400, INK, 'Inter', 'middle'))
    y += qs + 100
    # контакти
    o.append(f'<rect x="0" y="{f(y)}" width="{W}" height="{f(H - y)}" fill="{BLUE}"/>')
    o.append(f'<rect x="0" y="{f(y)}" width="{W}" height="6" fill="{YEL}"/>')
    yy = y + 52
    o.append(T(x0, yy, '03041, м. Київ, вул. Героїв Оборони, 13, навч. корпус № 4, кімн. 13', 24, 500, '#fff'))
    o.append(T(x0, yy + 36, '(044) 527-89-66 · 096-977-80-58 · physiol.biochem2021@gmail.com', 24, 500, '#fff'))
    o.append(T(x0, yy + 84, 'Фото: J. C. Fonseca Mata; E. Rodriguez; S. S. Islam —', 22, 400, '#A9C6E4'))
    o.append(T(x0, yy + 114, 'Wikimedia Commons, CC BY-SA 4.0', 22, 400, '#A9C6E4'))
    return o


def write(name, body):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="99mm" height="210mm" viewBox="0 0 {W} {H}">\n'
           + D.svg() + '\n' + '\n'.join(body) + '\n</svg>\n')
    (HERE / name).write_text(svg, encoding='utf-8')


if __name__ == '__main__':
    b = front(); write('dl2-academic-1-front.svg', b)
    b = back(); write('dl2-academic-2-back.svg', b)
