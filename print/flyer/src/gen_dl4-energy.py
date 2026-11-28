#!/usr/bin/env python3
"""Генератор двостороннього єврофлаєра DL (99×210 мм) «Енергія рослин» (за BRIEF2.md).
Запуск: python3 src/gen_dl4-energy.py → src/dl4-energy-1-front.svg, src/dl4-energy-2-back.svg
Ілюстрації (хлоропласт, фотобіореактор, листок) — лише декор, без підписів.
"""
import math, pathlib, random

W, H = 990, 2100
M = 50  # безпечне поле (BRIEF2)
HERE = pathlib.Path(__file__).parent
rnd = random.Random(7)

DISP = "font-family=\"'Inter Display'\""
INTER = "font-family=\"'Inter'\""
PLEX = "font-family=\"'IBM Plex Sans'\""

LIME = "#c8f560"
INK = "#062a22"
SOFT = "#cfe8e1"

cur = []


def P(x):
    cur.append(x)


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


DEFS = f"""
<linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
  <stop offset="0" stop-color="#03201a"/>
  <stop offset="0.28" stop-color="#05362f"/>
  <stop offset="0.52" stop-color="#075049"/>
  <stop offset="0.70" stop-color="#0a5f4f"/>
  <stop offset="1" stop-color="#2f8a3c"/>
</linearGradient>
<radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#fffbe0" stop-opacity="0.95"/>
  <stop offset="0.18" stop-color="#f4ffb0" stop-opacity="0.55"/>
  <stop offset="0.5" stop-color="#d6ff7a" stop-opacity="0.16"/>
  <stop offset="1" stop-color="#c8f560" stop-opacity="0"/>
</radialGradient>
<radialGradient id="tealGlow" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#1fb39a" stop-opacity="0.45"/>
  <stop offset="1" stop-color="#1fb39a" stop-opacity="0"/>
</radialGradient>
<linearGradient id="beam" x1="1" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fffbe0" stop-opacity="0.55"/>
  <stop offset="0.55" stop-color="#e9ff9e" stop-opacity="0.16"/>
  <stop offset="1" stop-color="#e9ff9e" stop-opacity="0"/>
</linearGradient>
<linearGradient id="ribbonA" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#c8f560" stop-opacity="0"/>
  <stop offset="0.45" stop-color="#c8f560" stop-opacity="0.55"/>
  <stop offset="1" stop-color="#5ff2c9" stop-opacity="0"/>
</linearGradient>
<linearGradient id="ribbonB" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#5ff2c9" stop-opacity="0"/>
  <stop offset="0.5" stop-color="#5ff2c9" stop-opacity="0.35"/>
  <stop offset="1" stop-color="#c8f560" stop-opacity="0"/>
</linearGradient>
<linearGradient id="titleLime" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#d9ff6e"/>
  <stop offset="0.6" stop-color="#b8f04a"/>
  <stop offset="1" stop-color="#7fe0b0"/>
</linearGradient>
<linearGradient id="limePanel" x1="0" y1="0" x2="0.3" y2="1">
  <stop offset="0" stop-color="#e2ff8a"/>
  <stop offset="0.5" stop-color="#cdf466"/>
  <stop offset="1" stop-color="#a9e24c"/>
</linearGradient>
<!-- хлоропласт -->
<radialGradient id="cpOuter" cx="0.42" cy="0.32" r="0.75">
  <stop offset="0" stop-color="#d8ff9c"/>
  <stop offset="0.55" stop-color="#8fd451"/>
  <stop offset="1" stop-color="#2f8a2c"/>
</radialGradient>
<radialGradient id="cpStroma" cx="0.45" cy="0.38" r="0.7">
  <stop offset="0" stop-color="#b9ec7a"/>
  <stop offset="0.6" stop-color="#86cc4f"/>
  <stop offset="1" stop-color="#4f9e34"/>
</radialGradient>
<linearGradient id="discSide" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#0d4a1c"/>
  <stop offset="0.35" stop-color="#2a8a35"/>
  <stop offset="0.6" stop-color="#3ea845"/>
  <stop offset="1" stop-color="#0f5220"/>
</linearGradient>
<radialGradient id="discTop" cx="0.4" cy="0.35" r="0.7">
  <stop offset="0" stop-color="#9be86a"/>
  <stop offset="0.7" stop-color="#3fa848"/>
  <stop offset="1" stop-color="#22792e"/>
</radialGradient>
<radialGradient id="starch" cx="0.38" cy="0.32" r="0.7">
  <stop offset="0" stop-color="#fffdf2"/>
  <stop offset="0.7" stop-color="#f1e6bd"/>
  <stop offset="1" stop-color="#cdb980"/>
</radialGradient>
<radialGradient id="globule" cx="0.35" cy="0.3" r="0.7">
  <stop offset="0" stop-color="#fff7c2"/>
  <stop offset="0.6" stop-color="#f0cf4a"/>
  <stop offset="1" stop-color="#b48a14"/>
</radialGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
  <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</linearGradient>
<radialGradient id="spark" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#ffffff"/>
  <stop offset="0.25" stop-color="#f7ffb8" stop-opacity="0.9"/>
  <stop offset="1" stop-color="#c8f560" stop-opacity="0"/>
</radialGradient>
<!-- фотобіореактор -->
<linearGradient id="glassBack" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#bff3ee" stop-opacity="0.35"/>
  <stop offset="0.5" stop-color="#e8fffb" stop-opacity="0.08"/>
  <stop offset="1" stop-color="#bff3ee" stop-opacity="0.4"/>
</linearGradient>
<linearGradient id="algae" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#0f4d17"/>
  <stop offset="0.3" stop-color="#2f9a2c"/>
  <stop offset="0.55" stop-color="#5cc23a"/>
  <stop offset="0.8" stop-color="#2a8a27"/>
  <stop offset="1" stop-color="#0c4314"/>
</linearGradient>
<linearGradient id="algaeV" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#d8ff7a" stop-opacity="0.35"/>
  <stop offset="0.25" stop-color="#d8ff7a" stop-opacity="0"/>
  <stop offset="1" stop-color="#03200c" stop-opacity="0.45"/>
</linearGradient>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#5d6b70"/>
  <stop offset="0.25" stop-color="#e9f0f2"/>
  <stop offset="0.45" stop-color="#9aa8ad"/>
  <stop offset="0.7" stop-color="#d4dde0"/>
  <stop offset="1" stop-color="#4a575c"/>
</linearGradient>
<radialGradient id="bubble" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
  <stop offset="0.75" stop-color="#eaffd8" stop-opacity="0.25"/>
  <stop offset="1" stop-color="#ffffff" stop-opacity="0.85"/>
</radialGradient>
<!-- листок -->
<linearGradient id="leaf" x1="0" y1="1" x2="1" y2="0">
  <stop offset="0" stop-color="#0f5a1e"/>
  <stop offset="0.45" stop-color="#2f9b33"/>
  <stop offset="0.8" stop-color="#7fd44a"/>
  <stop offset="1" stop-color="#c2f06a"/>
</linearGradient>
<linearGradient id="leafShade" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#000" stop-opacity="0"/>
  <stop offset="1" stop-color="#021a08" stop-opacity="0.45"/>
</linearGradient>
<radialGradient id="drop" cx="0.45" cy="0.55" r="0.6">
  <stop offset="0" stop-color="#e6ffb8" stop-opacity="0.55"/>
  <stop offset="0.55" stop-color="#8ee05a" stop-opacity="0.25"/>
  <stop offset="0.85" stop-color="#0b4416" stop-opacity="0.45"/>
  <stop offset="1" stop-color="#062c0c" stop-opacity="0.7"/>
</radialGradient>
<radialGradient id="dropShadow" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#021a06" stop-opacity="0.55"/>
  <stop offset="1" stop-color="#021a06" stop-opacity="0"/>
</radialGradient>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="10"/><feOffset dy="12"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
  <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
"""


def ribbon(y0, amp, width, grad, op, phase=0.0):
    """Плавна світлова стрічка через увесь аркуш."""
    pts_top, pts_bot = [], []
    n = 24
    for i in range(n + 1):
        x = -40 + (W + 80) * i / n
        t = i / n * math.pi * 2 + phase
        y = y0 + amp * math.sin(t) + amp * 0.35 * math.sin(2.3 * t + 1)
        wdt = width * (0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * 0.8 + phase)))
        pts_top.append((x, y - wdt / 2))
        pts_bot.append((x, y + wdt / 2))
    d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts_top)
    d += " L" + " L".join(f"{f(x)},{f(y)}" for x, y in reversed(pts_bot)) + "Z"
    P(f'<path d="{d}" fill="url(#{grad})" opacity="{op}"/>')



def drop(cx, cy, r):
    ry = r * 0.88
    s = []
    s.append(f'<ellipse cx="{f(cx + r*0.25)}" cy="{f(cy + r*0.45)}" rx="{f(r*1.15)}" ry="{f(ry*0.9)}" fill="url(#dropShadow)"/>')
    s.append(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(r)}" ry="{f(ry)}" fill="url(#drop)" stroke="#0a3a12" stroke-opacity="0.35" stroke-width="0.8"/>')
    # каустика (заломлене світло) — серп уздовж нижнього краю
    a0, a1 = math.radians(150), math.radians(35)
    ox = lambda a, k: cx + r * k * math.cos(a)
    oy = lambda a, k, d=0: cy + ry * k * math.sin(a) + d
    s.append(f'<path d="M{f(ox(a0, .86))},{f(oy(a0, .86))} A{f(r*.86)},{f(ry*.86)} 0 0 0 {f(ox(a1, .86))},{f(oy(a1, .86))} '
             f'A{f(r*.9)},{f(ry*.62)} 0 0 1 {f(ox(a0, .86))},{f(oy(a0, .86))}Z" fill="#f3ffc8" opacity="0.5"/>')
    # дзеркальний блік
    s.append(f'<ellipse cx="{f(cx - r*0.38)}" cy="{f(cy - ry*0.42)}" rx="{f(r*0.28)}" ry="{f(ry*0.18)}" fill="#ffffff" opacity="0.95" transform="rotate(-30 {f(cx - r*0.38)} {f(cy - ry*0.42)})"/>')
    s.append(f'<circle cx="{f(cx + r*0.15)}" cy="{f(cy - ry*0.55)}" r="{f(r*0.07)}" fill="#ffffff" opacity="0.85"/>')
    return "".join(s)



# --- реалістичні рослини (декор): листок з асиметрією, зубчиками, жилкуванням, об'ємним стеблом
_uid = [0]


def _nid(p):
    _uid[0] += 1
    return f"{p}{_uid[0]}"


def _poly(pts):
    return "M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts) + "Z"


def _qbez(p0, p1, p2, n=18):
    return [((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0], (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1])
            for t in (i / n for i in range(n + 1))]


def _cbez(p0, p1, p2, p3, n=24):
    return [((1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t*t*p2[0] + t**3*p3[0],
             (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t*t*p2[1] + t**3*p3[1]) for t in (i / n for i in range(n + 1))]


def tapered(pts, w0, w1, fill, op=1.0):
    """Смуга змінної товщини вздовж ламаної (жилка, стебло)."""
    left, right = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        w = (w0 + (w1 - w0) * i / (n - 1)) / 2
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return f'<path d="{_poly(left + right[::-1])}" fill="{fill}" opacity="{op}"/>'


def leaf_blade(L, Wd, bend=0.12, asym=0.88, teeth=26, tooth=0.05, young=0.0, seed=1, drops=()):
    """Листок у локальних координатах: основа (0,0), верхівка (L, ·). Повертає SVG-рядок."""
    r = random.Random(seed)
    N = 140
    mid = lambda t: -bend * L * t * t * (1.2 - 0.2 * t)          # вигин середньої жилки
    wph = r.random() * 6

    def width(t):
        base = math.sin(math.pi * min(1, t ** 0.78)) ** 0.85 * (1 - 0.12 * t)
        wave = 1 + 0.035 * math.sin(t * 9.5 + wph) + 0.02 * math.sin(t * 23 + wph * 2)
        return Wd / 2 * base * wave

    def toothf(t):
        if t < 0.1 or t > 0.97:
            return 0
        ph = (t * teeth) % 1
        s = ph / 0.78 if ph < 0.78 else (1 - ph) / 0.22
        return tooth * s * (0.6 + 0.4 * math.sin(math.pi * t))

    up, lo, midp = [], [], []
    for i in range(N + 1):
        t = i / N
        x, y, w = L * t, mid(t), width(t)
        up.append((x, y - w * (1 + toothf(t))))
        lo.append((x, y + w * asym * (1 + toothf(t + 0.5 / teeth))))
        midp.append((x, y))
    outline = _poly(up + lo[::-1])
    lid = _nid("lf")
    g_across, g_along, g_hi = lid + "a", lid + "l", lid + "h"
    dark = "#0f4a1d" if young < 0.5 else "#2f6e1c"
    midc = "#2f8f35" if young < 0.5 else "#7fbe3a"
    light = "#6cc24a" if young < 0.5 else "#c6e86a"
    s = [f'<defs>'
         f'<linearGradient id="{g_across}" gradientUnits="userSpaceOnUse" x1="0" y1="{f(-Wd/2)}" x2="0" y2="{f(Wd/2)}">'
         f'<stop offset="0" stop-color="{dark}"/><stop offset="0.28" stop-color="{midc}"/>'
         f'<stop offset="0.47" stop-color="{light}"/><stop offset="0.53" stop-color="{midc}"/>'
         f'<stop offset="0.8" stop-color="{dark}"/><stop offset="1" stop-color="#08351a"/></linearGradient>'
         f'<linearGradient id="{g_along}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{f(L)}" y2="0">'
         f'<stop offset="0" stop-color="#03200c" stop-opacity="0.35"/><stop offset="0.35" stop-color="#03200c" stop-opacity="0"/>'
         f'<stop offset="0.8" stop-color="#e4f77a" stop-opacity="{f(0.1 + young*0.25)}"/>'
         f'<stop offset="1" stop-color="#f0ff9a" stop-opacity="{f(0.25 + young*0.3)}"/></linearGradient>'
         f'<radialGradient id="{g_hi}" cx="0.5" cy="0.5" r="0.5">'
         f'<stop offset="0" stop-color="#ffffff" stop-opacity="0.38"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
         f'<clipPath id="{lid}c"><path d="{outline}"/></clipPath>'
         f'</defs>']
    # контактна тінь
    s.append(f'<path d="{outline}" fill="#01140a" opacity="0.38" transform="translate(9,14)" filter="url(#soft)"/>')
    s.append(f'<path d="{outline}" fill="url(#{g_across})"/>')
    s.append(f'<g clip-path="url(#{lid}c)">')
    s.append(f'<rect x="0" y="{f(-Wd)}" width="{f(L)}" height="{f(2*Wd)}" fill="url(#{g_along})"/>')
    # нижня половина темніша — листок трохи складений уздовж жилки
    s.append(f'<path d="{_poly(midp + lo[::-1])}" fill="#03240e" opacity="0.2"/>')
    # світла смуга вздовж середньої жилки
    band = [(x, y - width(i / N) * 0.22) for i, (x, y) in enumerate(midp)] + \
           [(x, y + width(i / N) * 0.16) for i, (x, y) in reversed(list(enumerate(midp)))]
    s.append(f'<path d="{_poly(band)}" fill="#c9f27a" opacity="0.22" filter="url(#soft)"/>')
    # жилкування: вторинні (дугові, з петлями біля краю) і третинні
    nv = 8
    ends = {1: [], -1: []}
    for k in range(nv):
        for side in (-1, 1):
            t0 = 0.07 + k * 0.105 + (0.04 if side > 0 else 0)
            if t0 > 0.86:
                continue
            t1 = min(0.97, t0 + 0.16 + 0.04 * r.random())
            x0, y0 = L * t0, mid(t0)
            fac = 1 if side < 0 else asym
            ex, ey = L * t1, mid(t1) + side * width(t1) * fac * 0.8
            cx, cy = L * (t0 + 0.035), mid(t0) + side * width(t0) * fac * 0.75
            pts = _qbez((x0, y0), (cx, cy), (ex, ey))
            wv = 2.6 * (1 - t0 * 0.6) * (L / 300) ** 0.5
            s.append(tapered([(x + 0.8, y + 1.2) for x, y in pts], wv + 0.6, 0.4, "#04260f", 0.35))
            s.append(tapered(pts, wv, 0.35, "#d8f59c", 0.62))
            ends[side].append((ex, ey))
            # третинні жилки
            for j in (5, 9, 13):
                if j < len(pts) - 2:
                    bx, by = pts[j]
                    q = _qbez((bx, by), (bx + 10 + r.random() * 8, by + side * (8 + r.random() * 6)),
                              (bx + 22 + r.random() * 10, by + side * (2 + r.random() * 6)), 6)
                    s.append(f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in q)}" fill="none" stroke="#d8f59c" stroke-opacity="0.28" stroke-width="0.9"/>')
    # петлі біля краю (брохідодромне жилкування)
    for side in (-1, 1):
        e = ends[side]
        for a, b in zip(e, e[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + side * 6
            s.append(f'<path d="M{f(a[0])},{f(a[1])} Q{f(mx)},{f(my)} {f(b[0])},{f(b[1])}" fill="none" stroke="#d8f59c" stroke-opacity="0.3" stroke-width="1"/>')
    # глянцевий відблиск
    hx, hy = L * 0.42, mid(0.42) - width(0.42) * 0.42
    s.append(f'<ellipse cx="{f(hx)}" cy="{f(hy)}" rx="{f(L*0.26)}" ry="{f(Wd*0.12)}" fill="url(#{g_hi})" transform="rotate({f(-math.degrees(bend*0.9))} {f(hx)} {f(hy)})"/>')
    s.append('</g>')
    # середня жилка: тінь + світла жилка, що звужується
    s.append(tapered([(x + 1, y + 1.6) for x, y in midp[::4]], 7 * (L / 300) ** 0.6, 1, "#03200c", 0.4))
    s.append(tapered(midp[::4], 6 * (L / 300) ** 0.6, 0.8, "#e6fbb0", 0.85))
    # край: темний контур + світловий обідок з боку сонця (просвічування)
    s.append(f'<path d="{outline}" fill="none" stroke="#06300f" stroke-opacity="0.55" stroke-width="1.1"/>')
    s.append(f'<path d="M{" L".join(f"{f(x)},{f(y)}" for x, y in up[8:-4])}" fill="none" stroke="#e9ff9a" stroke-opacity="0.55" stroke-width="1.6"/>')
    # краплі
    for (t, side, rr) in drops:
        x, y = L * t, mid(t) + side * width(t) * 0.45
        s.append(drop(x, y, rr))
    return "".join(s)


def stem(pts, w0, w1):
    """Стебло з об'ємом: темна основа, середній тон, світлий блік."""
    return (tapered([(x + 2, y + 3) for x, y in pts], w0 + 2, w1 + 1, "#01180a", 0.45) +
            tapered(pts, w0, w1, "#2f7a25") +
            tapered([(x - w0 * 0.12, y - w0 * 0.12) for x, y in pts], w0 * 0.55, w1 * 0.5, "#6fbf45", 0.9) +
            tapered([(x - w0 * 0.22, y - w0 * 0.22) for x, y in pts], w0 * 0.18, w1 * 0.15, "#d9f7a0", 0.75))


def sprig(x, y, scale=1.0, rot=0.0, seed=3):
    """Гілочка: вигнуте стебло, три листки різного віку, верхівкова брунька. (x, y) — точка виходу стебла."""
    s = [f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)}) scale({f(scale)})">']
    st = _cbez((0, 0), (30, -120), (130, -215), (250, -285), 30)
    # листок 1 (великий, нижній) — праворуч від стебла
    def node(i):
        return st[i]
    leaves = [  # (вузол, кут, довжина, ширина, вигин, вік, краплі)
        (8, 6, 330, 150, 0.10, 0.0, ((0.38, -1, 17), (0.58, 1, 10), (0.74, -1, 7))),
        (16, -158, 250, 112, -0.12, 0.2, ((0.5, 1, 11),)),
        (24, 8, 180, 82, 0.14, 0.7, ()),
    ]
    blades = []
    for i, ang, Ll, Ww, b, yg, dr in leaves:
        nx, ny = node(i)
        pet = _qbez((0, 0), (18, -4), (34, 2), 6)
        bl = (f'<g transform="translate({f(nx)},{f(ny)}) rotate({ang})">'
              f'{tapered(pet, 7, 5, "#3d8a2c")}'
              f'<g transform="translate(32,2)">{leaf_blade(Ll, Ww, bend=b, young=yg, seed=seed + i, drops=dr)}</g></g>')
        blades.append(bl)
    s.append(blades[1])
    s.append(stem(st, 13, 5))
    s.append(blades[0])
    s.append(blades[2])
    # верхівкова брунька
    tx, ty = st[-1]
    s.append(f'<g transform="translate({f(tx - 4)},{f(ty + 2)}) rotate(-58)">{leaf_blade(92, 38, bend=-0.18, young=1.0, seed=seed + 99, teeth=12, tooth=0.03)}</g>')
    s.append('</g>')
    return "".join(s)


def cylinder_disc(x, y, rx, ry, h):
    return (f'<path d="M{f(x - rx)},{f(y)} v{f(h)} A{f(rx)},{f(ry)} 0 0 0 {f(x + rx)},{f(y + h)} v{f(-h)}Z" fill="url(#discSide)"/>'
            f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}" fill="url(#discTop)" stroke="#0c4a1a" stroke-width="0.8"/>')


def granum(x, y, n, rx=31, ry=8.5, step=9.2):
    s = []
    # тінь під стопкою
    s.append(f'<ellipse cx="{f(x + 4)}" cy="{f(y + n*step + 10)}" rx="{f(rx + 6)}" ry="{f(ry + 3)}" fill="#0b3a12" opacity="0.35" filter="url(#soft)"/>')
    for i in range(n):
        yy = y + (n - 1 - i) * step
        jit = (i * 37 % 7 - 3) * 0.6
        s.append(cylinder_disc(x + jit, yy, rx - (i % 3 == 1) * 1.5, ry, step * 0.66))
        s.append(f'<path d="M{f(x + jit - rx + 3)},{f(yy + 2)} A{f(rx)},{f(ry)} 0 0 0 {f(x + jit + rx - 3)},{f(yy + 2)}" fill="none" stroke="#c9f7a0" stroke-opacity="0.45" stroke-width="1"/>')
    # блік зверху
    s.append(f'<ellipse cx="{f(x - rx*0.3)}" cy="{f(y - ry*0.25)}" rx="{f(rx*0.45)}" ry="{f(ry*0.3)}" fill="#ffffff" opacity="0.35"/>')
    return "".join(s)


def chloroplast(CX, CY, RX, RY, ROT):
    s = [f'<g transform="translate({CX},{f(CY)}) rotate({ROT})">']
    # м'яке сяйво
    s.append(f'<ellipse cx="0" cy="12" rx="{RX + 30}" ry="{RY + 30}" fill="#c8f560" opacity="0.22" filter="url(#soft2)"/>')
    # зовнішня мембрана (оболонка)
    s.append(f'<ellipse cx="0" cy="0" rx="{RX}" ry="{RY}" fill="url(#cpOuter)" stroke="#e8ffb8" stroke-width="3"/>')
    # міжмембранний простір
    s.append(f'<ellipse cx="0" cy="2" rx="{RX - 11}" ry="{RY - 11}" fill="#3f8f2c" opacity="0.55"/>')
    # внутрішня мембрана + строма
    s.append(f'<ellipse cx="0" cy="3" rx="{RX - 16}" ry="{RY - 16}" fill="url(#cpStroma)" stroke="#f0ffc4" stroke-width="2.4"/>')
    s.append(f'<clipPath id="cpClip"><ellipse cx="0" cy="3" rx="{RX - 18}" ry="{RY - 18}"/></clipPath>')
    s.append('<g clip-path="url(#cpClip)">')
    # рибосоми й дрібна зернистість строми
    for _ in range(170):
        a = rnd.random() * math.tau
        rr = math.sqrt(rnd.random())
        x = (RX - 30) * rr * math.cos(a)
        y = (RY - 30) * rr * math.sin(a)
        s.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(1.6 + rnd.random()*1.6)}" fill="#1d5a1e" opacity="{f(0.45 + rnd.random()*0.4)}"/>')
    # ламели строми (міжгранні тилакоїди)
    grana = [(-200, -32, 6), (-118, -70, 7), (-128, 34, 7), (-36, -18, 8), (52, -72, 7),
             (66, 30, 8), (152, -28, 7), (212, 24, 5), (-214, 38, 4), (140, 70, 4), (-48, 74, 5)]
    lam = []
    for i in range(len(grana) - 1):
        (x1, y1, n1), (x2, y2, n2) = grana[i], grana[i + 1]
        lam.append((x1, y1 + n1 * 5, x2, y2 + n2 * 5))
    extra = [(-215, -5, -40, 25), (-125, 0, 70, 65), (-40, 40, 165, 10), (55, -45, 230, 40), (-140, 70, 150, 90)]
    for x1, y1, x2, y2 in lam + extra:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2 + 18
        s.append(f'<path d="M{f(x1)},{f(y1)} Q{f(mx)},{f(my)} {f(x2)},{f(y2)}" fill="none" stroke="#1f6e26" stroke-width="7" stroke-linecap="round" opacity="0.85"/>')
        s.append(f'<path d="M{f(x1)},{f(y1)} Q{f(mx)},{f(my)} {f(x2)},{f(y2)}" fill="none" stroke="#8fe06a" stroke-width="2" stroke-linecap="round" opacity="0.8"/>')
    # крохмальне зерно
    s.append(f'<ellipse cx="-6" cy="95" rx="44" ry="25" fill="url(#starch)" stroke="#a89058" stroke-width="1"/>')
    for k in (34, 24, 14):
        s.append(f'<ellipse cx="-8" cy="96" rx="{k}" ry="{f(k*0.55)}" fill="none" stroke="#c9b27a" stroke-width="1" opacity="0.7"/>')
    s.append('<ellipse cx="-22" cy="86" rx="12" ry="5" fill="#fff" opacity="0.7"/>')
    # пластоглобули
    for x, y, r in [(110, 95, 8), (-190, 85, 7), (240, -60, 6), (-95, -115, 6), (12, -112, 5)]:
        s.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#globule)"/>')
    # грани
    for x, y, n in grana:
        s.append(granum(x, y - n * 4.6, n))
    s.append('</g>')
    # глянець оболонки
    s.append(f'<path d="M{-RX + 40},-30 C{-RX + 60},{-RY + 10} {-80},{-RY - 2} 80,{-RY + 4} C-40,{-RY + 26} {-RX + 90},{-RY + 60} {-RX + 40},-30Z" fill="url(#gloss)" opacity="0.8"/>')
    # розріз оболонки: подвійний контур спереду
    s.append(f'<path d="M{-RX + 6},20 A{RX - 6},{RY - 6} 0 0 0 {RX - 6},20" fill="none" stroke="#14501a" stroke-opacity="0.35" stroke-width="5"/>')
    s.append('</g>')
    return "".join(s)



def sparkle(x, y, r):
    return (f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r*2.2)}" fill="url(#spark)"/>'
            f'<path d="M{f(x)},{f(y - r*2)} L{f(x + r*0.3)},{f(y - r*0.3)} L{f(x + r*2)},{f(y)} L{f(x + r*0.3)},{f(y + r*0.3)} L{f(x)},{f(y + r*2)} L{f(x - r*0.3)},{f(y + r*0.3)} L{f(x - r*2)},{f(y)} L{f(x - r*0.3)},{f(y - r*0.3)}Z" fill="#ffffff"/>')



# --- фотобіореактор (скляна колона)
def reactor(x0, x1, top, bot):
    w = x1 - x0
    cx = (x0 + x1) / 2
    lt = top + 70  # рівень рідини
    s = []
    # тінь
    s.append(f'<ellipse cx="{f(cx)}" cy="{f(bot + 4)}" rx="{f(w*0.75)}" ry="12" fill="#011410" opacity="0.5" filter="url(#soft)"/>')
    # задня стінка скла
    s.append(f'<rect x="{x0}" y="{top + 24}" width="{w}" height="{f(bot - top - 50)}" rx="10" fill="url(#glassBack)"/>')
    # суспензія мікроводоростей
    s.append(f'<path d="M{x0 + 5},{f(lt)} V{f(bot - 40)} Q{x0 + 5},{f(bot - 26)} {x0 + 16},{f(bot - 26)} H{x1 - 16} Q{x1 - 5},{f(bot - 26)} {x1 - 5},{f(bot - 40)} V{f(lt)}Z" fill="url(#algae)"/>')
    s.append(f'<rect x="{x0 + 5}" y="{f(lt)}" width="{w - 10}" height="{f(bot - 26 - lt)}" fill="url(#algaeV)"/>')
    # клітини водоростей
    for _ in range(140):
        x = x0 + 9 + rnd.random() * (w - 18)
        y = lt + 10 + rnd.random() * (bot - 50 - lt)
        rr = 1.4 + rnd.random() * 2.0
        s.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rr)}" fill="{rnd.choice(["#7fdc4a", "#a5ee5e", "#2f8f26", "#c8f560"])}" opacity="{f(0.5 + rnd.random()*0.45)}"/>')
    # меніск
    s.append(f'<ellipse cx="{f(cx)}" cy="{f(lt)}" rx="{f(w/2 - 5)}" ry="7" fill="#9fe86a" opacity="0.9"/>')
    s.append(f'<path d="M{x0 + 5},{f(lt)} Q{x0 + 9},{f(lt + 9)} {x0 + 22},{f(lt + 7)}" fill="none" stroke="#e8ffc0" stroke-width="2" opacity="0.8"/>')
    s.append(f'<path d="M{x1 - 5},{f(lt)} Q{x1 - 9},{f(lt + 9)} {x1 - 22},{f(lt + 7)}" fill="none" stroke="#e8ffc0" stroke-width="2" opacity="0.8"/>')
    # бульбашки (аерація), що піднімаються
    bx = [cx - 22, cx + 4, cx + 26, cx - 6, cx + 16]
    for i in range(34):
        x = bx[i % 5] + rnd.uniform(-8, 8) + math.sin(i) * 4
        y = bot - 50 - (i / 34) * (bot - 60 - lt) + rnd.uniform(-6, 6)
        r = 2.5 + (1 - (y - lt) / (bot - lt)) * 6 + rnd.random() * 2
        s.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="url(#bubble)" stroke="#ffffff" stroke-opacity="0.55" stroke-width="0.8"/>')
        s.append(f'<circle cx="{f(x - r*0.35)}" cy="{f(y - r*0.35)}" r="{f(r*0.28)}" fill="#fff" opacity="0.9"/>')
    # аератор на дні
    s.append(f'<rect x="{f(cx - 34)}" y="{f(bot - 44)}" width="68" height="8" rx="4" fill="#2c3a3c" opacity="0.8"/>')
    # передня стінка скла: рефлекси
    s.append(f'<rect x="{x0}" y="{top + 24}" width="{w}" height="{f(bot - top - 50)}" rx="10" fill="none" stroke="#e8fffb" stroke-opacity="0.75" stroke-width="2.5"/>')
    s.append(f'<rect x="{x0 + 12}" y="{top + 34}" width="9" height="{f(bot - top - 90)}" rx="4.5" fill="#ffffff" opacity="0.55"/>')
    s.append(f'<rect x="{x0 + 26}" y="{top + 40}" width="3" height="{f(bot - top - 110)}" rx="1.5" fill="#ffffff" opacity="0.35"/>')
    s.append(f'<rect x="{x1 - 16}" y="{top + 40}" width="5" height="{f(bot - top - 100)}" rx="2.5" fill="#ffffff" opacity="0.3"/>')
    # шкала
    for k in range(6):
        yy = lt + 40 + k * 50
        if yy < bot - 60:
            s.append(f'<line x1="{x1 - 30}" y1="{f(yy)}" x2="{x1 - 14}" y2="{f(yy)}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.5"/>')
    # металеві фланці
    s.append(f'<rect x="{x0 - 8}" y="{top}" width="{w + 16}" height="30" rx="5" fill="url(#metal)"/>')
    s.append(f'<rect x="{x0 - 8}" y="{top + 26}" width="{w + 16}" height="4" fill="#3b474b" opacity="0.6"/>')
    s.append(f'<rect x="{cx - 6}" y="{top - 18}" width="12" height="20" rx="3" fill="url(#metal)"/>')
    s.append(f'<rect x="{x0 - 10}" y="{f(bot - 28)}" width="{w + 20}" height="30" rx="5" fill="url(#metal)"/>')
    s.append(f'<rect x="{x0 - 10}" y="{f(bot - 28)}" width="{w + 20}" height="4" fill="#ffffff" opacity="0.5"/>')
    return "".join(s)



# ================================================================ спільні елементи
def background(glows=((150, 1150), (900, 330))):
    P(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    for gx, gy in glows:
        P(f'<ellipse cx="{gx}" cy="{gy}" rx="520" ry="420" fill="url(#tealGlow)" opacity="0.8"/>')


def sun(sx, sy, r=300, angles=((205, 10, 0.9), (218, 7, 0.75), (230, 12, 0.8), (244, 6, 0.6), (196, 5, 0.6))):
    P(f'<circle cx="{sx}" cy="{f(sy)}" r="{r}" fill="url(#sunGlow)"/>')
    for ang, spread, op in angles:
        L = 1200
        a1, a2 = math.radians(ang - spread / 2), math.radians(ang + spread / 2)
        x1, y1 = sx + L * math.cos(a1), sy - L * math.sin(a1)
        x2, y2 = sx + L * math.cos(a2), sy - L * math.sin(a2)
        P(f'<path d="M{sx},{f(sy)} L{f(x1)},{f(y1)} L{f(x2)},{f(y2)}Z" fill="url(#beam)" opacity="{op}"/>')


def photo(pid, cx, cy, d, ring=LIME):
    """Фото в кружечку: кліп, тонке кільце, легка тінь."""
    r = d / 2
    cid = f"clip-{pid}"
    P(f'<ellipse cx="{f(cx + 4)}" cy="{f(cy + 14)}" rx="{f(r * 0.98)}" ry="{f(r * 0.98)}" fill="#011a12" opacity="0.45" filter="url(#soft)"/>')
    P(f'<clipPath id="{cid}"><circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/></clipPath>')
    # кліп на обгортці <g>: на самому <use> x/y зсувають і систему координат кліпу
    P(f'<g clip-path="url(#{cid})"><use href="#{pid}" x="{f(cx - r)}" y="{f(cy - r)}" width="{f(d)}" height="{f(d)}"/></g>')
    P(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r - 1.5)}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="3"/>')
    P(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r + 6)}" fill="none" stroke="{ring}" stroke-width="3.5"/>')


def text(x, y, s, size=25, weight=400, fill="#ffffff", fam=INTER, anchor="start", extra=""):
    a = f' text-anchor="{anchor}"' if anchor != "start" else ""
    P(f'<text x="{f(x)}" y="{f(y)}"{a} {fam} font-size="{size}" font-weight="{weight}" fill="{fill}"{extra}>{s}</text>')


def save(name):
    body = "\n".join(cur)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="99mm" height="210mm" viewBox="0 0 {W} {H}">\n'
           f'<defs>{DEFS}</defs>\n{body}\n</svg>\n')
    (HERE / name).write_text(svg, encoding="utf-8")


# ================================================================ ЛИЦЬОВА СТОРОНА
cur = []
background()
ribbon(250, 70, 46, "ribbonA", 0.22, 0.3)
ribbon(300, 90, 16, "ribbonB", 0.5, 1.6)
ribbon(1180, 60, 60, "ribbonB", 0.25, 2.4)
ribbon(1250, 50, 10, "ribbonA", 0.5, 0.9)
ribbon(1700, 50, 70, "ribbonA", 0.16, 4.0)

# --- шапка
HY, LOGO = 50, 124
P(f'<circle cx="{M + LOGO/2}" cy="{HY + LOGO/2}" r="{LOGO/2 + 3}" fill="#ffffff" opacity="0.95"/>')
P(f'<use href="#dept-logo" x="{M}" y="{HY}" width="{LOGO}" height="{LOGO}"/>')
cw = LOGO * 420 / 442
P(f'<use href="#nubip-crest" x="{M + LOGO + 18}" y="{HY}" width="{f(cw)}" height="{LOGO}"/>')
TX = M + LOGO + 18 + cw + 26
P(f'<line x1="{f(TX - 14)}" y1="{HY + 4}" x2="{f(TX - 14)}" y2="{HY + LOGO - 4}" stroke="{LIME}" stroke-opacity="0.6" stroke-width="2"/>')
text(TX, HY + 24, "Національний університет біоресурсів", weight=600)
text(TX, HY + 54, f'і природокористування України <tspan fill="{LIME}">(НУБіП)</tspan>', weight=600)
text(TX, HY + 92, "Факультет захисту рослин,", fill=SOFT)
text(TX, HY + 121, "біотехнологій та екології", fill=SOFT)

# --- назва кафедри
TY = 236
P(f'<rect x="{M}" y="{TY - 19}" width="44" height="6" rx="3" fill="{LIME}"/>')
text(M + 58, TY - 6, "КАФЕДРА", size=27, weight=600, fill=LIME, extra=' letter-spacing="9"')
TITLE = [("ФІЗІОЛОГІЇ,", 133, "#ffffff", 13.2),
         ("БІОХІМІЇ РОСЛИН", 97.6, "#ffffff", 3.6),
         ("ТА БІОЕНЕРГЕТИКИ", 86.6, "#cdf75e", 2.6)]
ty = TY + 18
for txt, size, fill, ls in TITLE:
    ty += size * 0.86
    P(f'<text x="{M - 4}" y="{f(ty)}" {DISP} font-weight="900" font-size="{size}" letter-spacing="{ls}" fill="{fill}">{txt}</text>')
    ty += size * 0.10
TITLE_END = ty

# --- гасло
SY = TITLE_END + 44
P(f'<rect x="{M}" y="{f(SY - 26)}" width="6" height="34" rx="3" fill="{LIME}"/>')
text(M + 22, SY, "Енергія рослин — енергія майбутнього", size=34, weight=600)

# --- декоративний герой (без підписів)
hy0 = SY + 30
hy1 = hy0 + 330
sun(960, hy0 + 10)
P(chloroplast(470, hy0 + 160, 280, 132, -9))
for x, y, r in [(640, hy0 + 40, 7), (700, hy0 + 130, 4.5), (540, hy0 + 18, 4), (300, hy0 + 300, 5),
                (745, hy0 + 250, 5), (150, hy0 + 110, 4), (620, hy0 + 300, 4)]:
    P(sparkle(x, y, r))
P(reactor(800, 904, hy0 + 18, hy1 - 6))
P(sprig(-30, hy0 + 365, 1.0, 4, seed=3))

# --- фото в кружечках (абстрактні підписи)
def caption(x, y, word, anchor="middle"):
    text(x, y, word, size=32, weight=800, fill=LIME, fam=DISP, anchor=anchor)


PZ = hy1 + 30
photo("photo-invitro-jars", M + 160, PZ + 168, 320)
caption(M + 160, PZ + 168 + 160 + 52, "Відкриття")
photo("photo-elodea", W - M - 150, PZ + 130, 300)
caption(W - M - 150, PZ + 130 + 150 + 52, "Енергія")
photo("photo-fusarium", 505, PZ + 372, 280)
caption(505 + 140 + 34, PZ + 372 + 110, "Життя рослин", anchor="start")
PHOTO_END = PZ + 372 + 140

# --- про кафедру
AY = PHOTO_END + 74
text(M, AY, "Про кафедру", size=42, weight=800, fam=DISP)
bul = [
    ["Одна з найстаріших і фундаментальних науково-освітніх", "ланок НУБіП України."],
    ["Класична школа фізіології та біохімії рослин і сучасні напрями:",
     "клітинна біоінженерія, фітовірусологія, нанобіотехнології,",
     "біоенергетика, моніторинг біосистем."],
    ["Викладання українською та англійською мовами."],
    ["Готуємо бакалаврів, магістрів і докторів філософії (PhD)."],
    ["Студентський науковий гурток «ФІТОЛАБ»."],
]
by = AY + 46
for lines in bul:
    P(f'<circle cx="{M + 8}" cy="{f(by - 9)}" r="7" fill="{LIME}"/>')
    for ln in lines:
        text(M + 28, by, ln)
        by += 31
    by += 8
ABOUT_END = by - 31

# --- цифри
ST = ABOUT_END + 30
TW = W - 2 * M
P(f'<rect x="{M}" y="{f(ST)}" width="{TW}" height="112" rx="22" fill="#021d17" fill-opacity="0.4" stroke="{LIME}" stroke-opacity="0.55" stroke-width="2"/>')
text(M + 26, ST + 88, "128", size=92, weight=900, fill=LIME, fam=DISP)
text(M + 236, ST + 48, "років української школи", size=27, weight=600)
text(M + 236, ST + 82, "фізіології рослин — від 1898 р.", size=27, weight=400, fill=SOFT)
FRONT_END = ST + 112
save("dl4-energy-1-front.svg")
print("front: title_end", round(TITLE_END), "hero", round(hy0), round(hy1), "photo_end", round(PHOTO_END),
      "about_end", round(ABOUT_END), "end", round(FRONT_END))


# ================================================================ ЗВОРОТНА СТОРОНА
cur = []
background(glows=((850, 700), (120, 1300)))
ribbon(330, 70, 46, "ribbonA", 0.18, 1.1)
ribbon(390, 80, 14, "ribbonB", 0.45, 2.2)
ribbon(1120, 60, 60, "ribbonB", 0.22, 0.4)
ribbon(1190, 50, 10, "ribbonA", 0.45, 3.1)
sun(1000, 40, r=340, angles=((215, 9, 0.55), (230, 6, 0.45), (243, 11, 0.5)))

# --- верхня плашка: емблема + назва кафедри
BL = 92
P(f'<circle cx="{M + BL/2}" cy="{50 + BL/2}" r="{BL/2 + 2}" fill="#ffffff" opacity="0.95"/>')
P(f'<use href="#dept-logo" x="{M}" y="50" width="{BL}" height="{BL}"/>')
text(M + BL + 24, 86, "Кафедра фізіології, біохімії рослин", size=27, weight=600)
text(M + BL + 24, 120, "та біоенергетики · НУБіП України", size=27, weight=400, fill=SOFT)
P(f'<line x1="{M}" y1="172" x2="{W - M}" y2="172" stroke="{LIME}" stroke-opacity="0.45" stroke-width="2"/>')

# --- освітньо-професійна програма бакалавра
Y = 226
P(f'<rect x="{M}" y="{Y - 19}" width="44" height="6" rx="3" fill="{LIME}"/>')
text(M + 58, Y - 6, "БАКАЛАВРАТ", size=27, weight=600, fill=LIME, extra=' letter-spacing="9"')
text(M, Y + 38, "Освітньо-професійна програма", size=30, weight=600)
BT = [("«БІОТЕХНОЛОГІЇ", 90, "#ffffff", 2.0), ("ТА БІОІНЖЕНЕРІЯ»", 80, "#cdf75e", 1.6)]
ty = Y + 50
for txt, size, fill, ls in BT:
    ty += size * 0.86
    P(f'<text x="{M - 4}" y="{f(ty)}" {DISP} font-weight="900" font-size="{size}" letter-spacing="{ls}" fill="{fill}">{txt}</text>')
    ty += size * 0.12
y = ty + 40
for ln, col, wt in [("Перший (бакалаврський) рівень · ступінь «Бакалавр»", "#ffffff", 500),
                    ("Галузь знань 16 «Хімічна та біоінженерія»", SOFT, 400),
                    ("Спеціальність 162 «Біотехнології та біоінженерія» (G21)", SOFT, 400)]:
    text(M, y, ln, weight=wt, fill=col)
    y += 32

# плитки
y += 12
TW = W - 2 * M
tw3 = (TW - 14) / 2
for k, (big, lab) in enumerate([("3 роки", "10 місяців"), ("Денна", "форма навчання")]):
    tx = M + k * (tw3 + 14)
    P(f'<rect x="{f(tx)}" y="{f(y)}" width="{f(tw3)}" height="92" rx="22" fill="{LIME}"/>')
    text(tx + tw3 / 2, y + 49, big, size=46, weight=900, fill=INK, fam=DISP, anchor="middle")
    text(tx + tw3 / 2, y + 80, lab, size=25, weight=500, fill=INK, anchor="middle")
y += 92 + 46

# вибіркові блоки
text(M, y, "Вибіркові блоки", weight=600, fill=LIME)
y += 48
px = M
for lab, wch in [("«Промислова біотехнологія»", 400), ("«Фітобіотехнологія»", 292)]:
    P(f'<rect x="{f(px)}" y="{f(y - 31)}" width="{wch}" height="44" rx="22" fill="#021d17" fill-opacity="0.35" stroke="{LIME}" stroke-width="2"/>')
    text(px + wch / 2, y, lab, weight=500, anchor="middle")
    px += wch + 14

# дисципліни
y += 48
text(M, y, "Обов’язкові дисципліни", weight=600, fill=LIME)
for ln in ["Біохімія · Біологія клітини · Фізіологія рослин · Біоінженерія ·",
           "Загальна біотехнологія · Молекулярна біотехнологія · Біобезпека"]:
    y += 31
    text(M, y, ln)
y += 40
text(M, y, "Блок «Фітобіотехнологія»", weight=600, fill=LIME)
for ln in ["Клітинна біоенергетика · Біологія лікарських рослин ·",
           "Промислове культивування грибів та водоростей · Біометрія"]:
    y += 31
    text(M, y, ln)
y += 40
text(M, y, f'<tspan font-weight="600" fill="{LIME}">Практика:</tspan> три навчальні практики й виробнича практика')
y += 40
P(f'<path d="M{M},{f(y - 9)} h26 m-10,-9 l10,9 l-10,9" fill="none" stroke="{LIME}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
text(M + 40, y, "Далі — магістратура (освітньо-професійна програма", weight=500)
text(M + 40, y + 31, "«Екологічна біотехнологія та біоенергетика») і PhD", weight=500)
PROG_END = y + 31

# --- лабораторії
LYb = PROG_END + 52
text(M, LYb, "Лабораторії кафедри", size=42, weight=800, fam=DISP)
text(M, LYb + 36, "Навчальний корпус № 4", fill=SOFT)
labs = [("ауд. 14", ["Навчально-наукова лабораторія", "біохімії та фітобіотехнології"]),
        ("ауд. 38", ["Навчальна лабораторія", "біохімії рослин"]),
        ("ауд. 56", ["Навчальна лабораторія", "фізіології рослин"])]
ly = LYb + 92
for room, name in labs:
    P(f'<rect x="{M}" y="{f(ly - 26)}" width="5" height="60" rx="2.5" fill="{LIME}"/>')
    text(M + 22, ly, name[0], weight=600)
    text(M + 22, ly + 31, f'{name[1]} <tspan fill="{LIME}" font-weight="600">· {room}</tspan>', weight=400)
    ly += 88
LAB_END = ly - 88 + 31
LPD = 280
photo("photo-lab-students", W - M - LPD / 2 - 6, LYb - 14 + LPD / 2, LPD)
text(W - M - LPD / 2 - 6, LYb - 14 + LPD + 52, "Майбутнє", size=32, weight=800, fill=LIME, fam=DISP, anchor="middle")
lab_note_y = LAB_END + 46
text(M, lab_note_y, "Навчальні лабораторії — робочі місця", fill=SOFT)
lab_note_y += 31
text(M, lab_note_y, "із сучасним обладнанням.", fill=SOFT)
LABS_END = lab_note_y

# --- лаймова панель: QR + контакти
LY = LABS_END + 30
wave = (f"M-10,{f(LY + 22)} C200,{f(LY - 18)} 420,{f(LY + 38)} 640,{f(LY + 10)} "
        f"C800,{f(LY - 10)} 900,{f(LY - 14)} 1000,{f(LY + 2)} V{H + 10} H-10Z")
P(f'<path d="{wave}" fill="url(#limePanel)"/>')
P(f'<path d="M-10,{f(LY + 22)} C200,{f(LY - 18)} 420,{f(LY + 38)} 640,{f(LY + 10)} C800,{f(LY - 10)} 900,{f(LY - 14)} 1000,{f(LY + 2)}" fill="none" stroke="#f6ffd0" stroke-width="3" opacity="0.9"/>')
QS = 272
QG = (W - 2 * M - 3 * QS) / 2
QY = LY + 46
qrs = [("qr-instagram", "@plant_physio_chair", "в Instagram"),
       ("qr-facebook", "Кафедра ФБРтаБ", "у Facebook"),
       ("qr-nubip", "Сторінка кафедри", "на сайті НУБіП")]
for i, (qid, l1, l2) in enumerate(qrs):
    qx = M + i * (QS + QG)
    P(f'<rect x="{f(qx)}" y="{f(QY + 8)}" width="{QS}" height="{QS}" rx="10" fill="#1d4a12" opacity="0.35" filter="url(#soft)"/>')
    P(f'<use href="#{qid}" x="{f(qx)}" y="{f(QY)}" width="{QS}" height="{QS}" color="{INK}"/>')
    text(qx + QS / 2, QY + QS + 34, l1, weight=600, fill=INK, anchor="middle")
    text(qx + QS / 2, QY + QS + 63, l2, fill="#1f4a2a", anchor="middle")
CY0 = QY + QS + 50
P(f'<line x1="{M}" y1="{f(CY0 + 36)}" x2="{W - M}" y2="{f(CY0 + 36)}" stroke="{INK}" stroke-opacity="0.35" stroke-width="1.5"/>')
text(M, CY0 + 72, "03041, м. Київ, вул. Героїв Оборони, 13, навч. корпус № 4, кімн. 13", fill=INK)
text(M, CY0 + 106, "(099) 532-31-86 · physiol.biochem2021@gmail.com", size=27, weight=600, fill=INK)
BACK_END = CY0 + 106
save("dl4-energy-2-back.svg")
print("back: prog_end", round(PROG_END), "labs_end", round(LABS_END), "LY", round(LY), "end", round(BACK_END))
