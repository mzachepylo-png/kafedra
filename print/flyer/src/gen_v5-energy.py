#!/usr/bin/env python3
"""Генератор флаєра v5-energy («Енергія рослин»), формат DL 99×210 мм.
Запуск: python3 src/gen_v5-energy.py  → src/v5-energy.svg
"""
import math, pathlib, random

W, H = 990, 2100
M = 60  # безпечне поле
OUT = pathlib.Path(__file__).with_name("v5-energy.svg")
rnd = random.Random(7)

DISP = "font-family=\"'Inter Display'\""
INTER = "font-family=\"'Inter'\""
MONO = "font-family=\"'JetBrains Mono'\""

LIME = "#c8f560"
LIME2 = "#9fe04a"
INK = "#062a22"

parts = []
P = parts.append


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


# ---------------------------------------------------------------- defs
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

# ---------------------------------------------------------------- фон
P(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
P(f'<ellipse cx="150" cy="1150" rx="520" ry="420" fill="url(#tealGlow)"/>')
P(f'<ellipse cx="900" cy="330" rx="520" ry="420" fill="url(#tealGlow)" opacity="0.7"/>')


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


ribbon(250, 70, 46, "ribbonA", 0.22, 0.3)
ribbon(300, 90, 16, "ribbonB", 0.5, 1.6)
ribbon(1040, 60, 60, "ribbonB", 0.25, 2.4)
ribbon(1110, 50, 10, "ribbonA", 0.55, 0.9)
ribbon(1500, 50, 70, "ribbonA", 0.16, 4.0)

# ---------------------------------------------------------------- шапка
HY = 60
LOGO = 124
P(f'<circle cx="{M + LOGO/2}" cy="{HY + LOGO/2}" r="{LOGO/2 + 3}" fill="#ffffff" opacity="0.95"/>')
P(f'<use href="#dept-logo" x="{M}" y="{HY}" width="{LOGO}" height="{LOGO}"/>')
cw = LOGO * 420 / 442
P(f'<use href="#nubip-crest" x="{M + LOGO + 20}" y="{HY}" width="{f(cw)}" height="{LOGO}"/>')
TX = M + LOGO + 20 + cw + 26
P(f'<line x1="{f(TX - 14)}" y1="{HY + 4}" x2="{f(TX - 14)}" y2="{HY + LOGO - 4}" stroke="{LIME}" stroke-opacity="0.6" stroke-width="2"/>')
P(f'<g {INTER} font-size="25">'
  f'<text x="{f(TX)}" y="{HY + 24}" font-weight="600" fill="#ffffff">Національний університет біоресурсів</text>'
  f'<text x="{f(TX)}" y="{HY + 54}" font-weight="600" fill="#ffffff">і природокористування України <tspan fill="{LIME}">(НУБіП)</tspan></text>'
  f'<text x="{f(TX)}" y="{HY + 92}" font-weight="400" fill="#cfe8e1">Факультет захисту рослин,</text>'
  f'<text x="{f(TX)}" y="{HY + 121}" font-weight="400" fill="#cfe8e1">біотехнологій та екології</text>'
  f'</g>')

# ---------------------------------------------------------------- заголовок
TY = 245
P(f'<rect x="{M}" y="{TY - 19}" width="44" height="6" rx="3" fill="{LIME}"/>')
P(f'<text x="{M + 58}" y="{TY - 6}" {INTER} font-size="27" font-weight="600" letter-spacing="9" fill="{LIME}">КАФЕДРА</text>')
TITLE = [("ФІЗІОЛОГІЇ,", 129, "#ffffff", 13),
         ("БІОХІМІЇ РОСЛИН", 95.5, "#ffffff", 3.4),
         ("ТА БІОЕНЕРГЕТИКИ", 84.5, "#cdf75e", 2.4)]
ty = TY + 18
for txt, size, fill, ls in TITLE:
    ty += size * 0.86
    P(f'<text x="{M - 4}" y="{f(ty)}" {DISP} font-weight="900" font-size="{size}" letter-spacing="{ls}" fill="{fill}">{txt}</text>')
    ty += size * 0.10
TITLE_END = ty

# ---------------------------------------------------------------- герой
HERO_Y = TITLE_END + 10       # верх зони ілюстрації
HERO_H = 330
hy0, hy1 = HERO_Y, HERO_Y + HERO_H

# сонце та промені
SUNX, SUNY = 960, hy0 + 10
P(f'<circle cx="{SUNX}" cy="{f(SUNY)}" r="300" fill="url(#sunGlow)"/>')
for ang, spread, op in [(205, 10, 0.9), (218, 7, 0.75), (230, 12, 0.8), (244, 6, 0.6), (196, 5, 0.6)]:
    L = 1100
    a1, a2 = math.radians(ang - spread / 2), math.radians(ang + spread / 2)
    x1, y1 = SUNX + L * math.cos(a1), SUNY - L * math.sin(a1)
    x2, y2 = SUNX + L * math.cos(a2), SUNY - L * math.sin(a2)
    P(f'<path d="M{SUNX},{f(SUNY)} L{f(x1)},{f(y1)} L{f(x2)},{f(y2)}Z" fill="url(#beam)" opacity="{op}"/>')

# --- листок (макро) з краплями, ліворуч унизу
def leaf():
    g = []
    # листок виходить з-за лівого краю
    d = ("M-60,{a} C40,{b} 230,{c} 470,{d0} C300,{e} 120,{g0} -60,{h}Z").format(
        a=f(hy1 - 10), b=f(hy1 - 170), c=f(hy1 - 300), d0=f(hy1 - 330),
        e=f(hy1 - 170), g0=f(hy1 + 40), h=f(hy1 + 70))
    g.append(f'<path d="{d}" fill="url(#leaf)" filter="url(#shadow)"/>')
    g.append(f'<path d="{d}" fill="url(#leafShade)"/>')
    # центральна жилка
    mid = f"M-50,{f(hy1 + 30)} C120,{f(hy1 - 80)} 300,{f(hy1 - 250)} 466,{f(hy1 - 328)}"
    g.append(f'<path d="{mid}" fill="none" stroke="#dfffa8" stroke-opacity="0.75" stroke-width="5"/>')
    g.append(f'<path d="{mid}" fill="none" stroke="#0a3d14" stroke-opacity="0.35" stroke-width="2" transform="translate(2,3)"/>')
    # бічні жилки
    for i in range(1, 9):
        t = i / 9.5
        # точка на жилці (кубічна Безьє)
        p0, p1, p2, p3 = (-50, hy1 + 30), (120, hy1 - 80), (300, hy1 - 250), (466, hy1 - 328)
        bx = (1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t*t*p2[0] + t**3*p3[0]
        by = (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t*t*p2[1] + t**3*p3[1]
        ln = 120 * (1 - t * 0.7)
        # вгору-праворуч і вниз-праворуч
        g.append(f'<path d="M{f(bx)},{f(by)} q{f(ln*0.35)},{f(-ln*0.55)} {f(ln*0.9)},{f(-ln*0.75)}" fill="none" stroke="#d6ffa0" stroke-opacity="0.38" stroke-width="2.4"/>')
        g.append(f'<path d="M{f(bx)},{f(by)} q{f(ln*0.6)},{f(ln*0.15)} {f(ln*1.0)},{f(ln*0.05)}" fill="none" stroke="#d6ffa0" stroke-opacity="0.3" stroke-width="2.2"/>')
    # краплі
    for (cx, cy, r) in [(128, hy1 - 78, 27), (58, hy1 - 22, 15), (150, hy1 - 6, 11), (30, hy1 - 120, 12), (196, hy1 - 168, 8), (98, hy1 - 140, 7)]:
        g.append(drop(cx, cy, r))
    return "".join(g)


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


P(leaf())

# --- хлоропласт
CX, CY = 470, hy0 + 190
RX, RY = 292, 138
ROT = -9


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


def chloroplast():
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


P(chloroplast())

# --- іскри: електрони й АТФ
def sparkle(x, y, r):
    return (f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r*2.2)}" fill="url(#spark)"/>'
            f'<path d="M{f(x)},{f(y - r*2)} L{f(x + r*0.3)},{f(y - r*0.3)} L{f(x + r*2)},{f(y)} L{f(x + r*0.3)},{f(y + r*0.3)} L{f(x)},{f(y + r*2)} L{f(x - r*0.3)},{f(y + r*0.3)} L{f(x - r*2)},{f(y)} L{f(x - r*0.3)},{f(y - r*0.3)}Z" fill="#ffffff"/>')


def tag(x, y, text, w, fill="#062a22", col=LIME, size=24, anchor="start"):
    h = size + 12
    x0 = x if anchor == "start" else (x - w / 2 if anchor == "middle" else x - w)
    return (f'<rect x="{f(x0)}" y="{f(y - h/2)}" width="{f(w)}" height="{h}" rx="{h/2}" fill="{fill}" fill-opacity="0.82" stroke="{col}" stroke-opacity="0.7" stroke-width="1.5"/>'
            f'<text x="{f(x0 + w/2)}" y="{f(y + size*0.36)}" text-anchor="middle" {MONO} font-size="{size}" font-weight="600" fill="{col}">{text}</text>')


for x, y, r in [(640, hy0 + 70, 7), (700, hy0 + 140, 4.5), (560, hy0 + 30, 4), (300, hy0 + 330, 5),
                (750, hy0 + 250, 5), (130, hy0 + 140, 4)]:
    P(sparkle(x, y, r))

# --- фотобіореактор (скляна колона)
def reactor():
    x0, x1 = 806, 912
    top, bot = hy0 + 20, hy1 - 8
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


P(reactor())

# мітки-формули (JetBrains Mono)
P(tag(605, hy0 + 20, "6CO₂+6H₂O → C₆H₁₂O₆+6O₂", 336, size=22, anchor="middle"))
P(tag(748, hy0 + 92, "світло", 104, anchor="middle"))
P(tag(655, hy0 + 302, "АТФ", 92, anchor="middle"))
for x, y, r in [(712, hy0 + 284, 5), (590, hy0 + 318, 3.5), (230, hy0 + 290, 4)]:
    P(sparkle(x, y, r))

# --- підписи до героя
P(f'<text x="{M}" y="{f(hy0 + 28)}" {DISP} font-weight="800" font-size="36" fill="{LIME}">Хлоропласт —</text>')
P(f'<text x="{M}" y="{f(hy0 + 60)}" {INTER} font-size="25" font-weight="500" fill="#ffffff">органела, де</text>')
P(f'<text x="{M}" y="{f(hy0 + 90)}" {INTER} font-size="25" font-weight="500" fill="#ffffff">відбувається</text>')
P(f'<text x="{M}" y="{f(hy0 + 120)}" {INTER} font-size="25" font-weight="500" fill="#ffffff">фотосинтез</text>')

CAP_Y = hy1 + 34
P(f'<text x="{M}" y="{f(CAP_Y)}" {INTER} font-size="25" fill="#e8f6f1"><tspan font-weight="600" fill="{LIME}">АТФ</tspan> (аденозинтрифосфат) — «енергетична валюта» клітини</text>')

# ---------------------------------------------------------------- про кафедру
AY = CAP_Y + 70
P(f'<text x="{M}" y="{f(AY)}" {DISP} font-weight="800" font-size="40" fill="#ffffff">Про кафедру</text>')
bul = [
    ["Одна з найстаріших науково-освітніх ланок НУБіП України —",
     f'<tspan font-weight="600" fill="{LIME}">128 років</tspan> української школи фізіології рослин (від 1898 р.).'],
    ["Від класичної фізіології та біохімії рослин — до біоінженерії",
     "клітин і біоенергетики (як клітини перетворюють енергію)."],
    ["Лабораторія «Біохімії та фітобіотехнології», гурток «ФІТОЛАБ»,",
     "онлайн лабораторія nubipfbr.online."],
]
by = AY + 46
for lines in bul:
    P(f'<circle cx="{M + 8}" cy="{f(by - 9)}" r="7" fill="{LIME}"/>')
    for i, ln in enumerate(lines):
        P(f'<text x="{M + 28}" y="{f(by)}" {INTER} font-size="25" font-weight="400" fill="#ffffff">{ln}</text>')
        by += 31
    by += 9
ABOUT_END = by - 31

# ---------------------------------------------------------------- бакалаврат
BY = ABOUT_END + 22
BH = 262
P(f'<rect x="{M - 22}" y="{f(BY)}" width="{W - 2*M + 44}" height="{BH}" rx="26" fill="#021d17" fill-opacity="0.35" stroke="{LIME}" stroke-opacity="0.6" stroke-width="2"/>')
IX = M + 8
P(f'<text x="{IX}" y="{f(BY + 42)}" {INTER} font-size="25" font-weight="600" fill="{LIME}">Бакалаврат · освітньо-професійна програма (ОПП)</text>')
P(f'<text x="{IX}" y="{f(BY + 90)}" {DISP} font-weight="800" font-size="40" fill="#ffffff">ОПП «Біотехнології та біоінженерія»</text>')
chips = [("Бакалавр", 156, True), ("G21 (162)", 150, True), ("4 роки", 122, True), ("кафедра — випускова", 312, False)]
cx = IX
cy = BY + 110
for txt, wch, solid in chips:
    if solid:
        P(f'<rect x="{f(cx)}" y="{f(cy)}" width="{wch}" height="42" rx="21" fill="{LIME}"/>')
        P(f'<text x="{f(cx + wch/2)}" y="{f(cy + 30)}" text-anchor="middle" {INTER} font-size="25" font-weight="600" fill="{INK}">{txt}</text>')
    else:
        P(f'<rect x="{f(cx)}" y="{f(cy)}" width="{wch}" height="42" rx="21" fill="none" stroke="{LIME}" stroke-width="2"/>')
        P(f'<text x="{f(cx + wch/2)}" y="{f(cy + 30)}" text-anchor="middle" {INTER} font-size="25" font-weight="500" fill="#ffffff">{txt}</text>')
    cx += wch + 12
P(f'<text x="{IX}" y="{f(BY + 192)}" {INTER} font-size="25" fill="#ffffff"><tspan font-weight="600" fill="{LIME}">Дисципліни:</tspan> Фізіологія рослин · Біохімія · Біологія клітини ·</text>')
P(f'<text x="{IX}" y="{f(BY + 223)}" {INTER} font-size="25" fill="#ffffff">Клітинна біоенергетика · Імунітет рослин · Біобезпека</text>')
BY_END = BY + BH

# ---------------------------------------------------------------- лаймова панель: QR + контакти
LY = BY_END + 18
wave = (f"M-10,{f(LY + 22)} C200,{f(LY - 18)} 420,{f(LY + 38)} 640,{f(LY + 10)} "
        f"C800,{f(LY - 10)} 900,{f(LY - 14)} 1000,{f(LY + 2)} V{H + 10} H-10Z")
P(f'<path d="{wave}" fill="url(#limePanel)"/>')
P(f'<path d="M-10,{f(LY + 22)} C200,{f(LY - 18)} 420,{f(LY + 38)} 640,{f(LY + 10)} C800,{f(LY - 10)} 900,{f(LY - 14)} 1000,{f(LY + 2)}" fill="none" stroke="#f6ffd0" stroke-width="3" opacity="0.9"/>')

QS = 280
QG = (W - 2 * M - 3 * QS) / 2
QY = LY + 46
qrs = [("qr-instagram", "@plant_physio_chair", "в Instagram"),
       ("qr-facebook", "Кафедра ФБРтаБ", "у Facebook"),
       ("qr-nubip", "Сторінка кафедри", "на сайті НУБіП")]
for i, (qid, l1, l2) in enumerate(qrs):
    qx = M + i * (QS + QG)
    P(f'<rect x="{f(qx)}" y="{f(QY + 8)}" width="{QS}" height="{QS}" rx="10" fill="#1d4a12" opacity="0.35" filter="url(#soft)"/>')
    P(f'<use href="#{qid}" x="{f(qx)}" y="{f(QY)}" width="{QS}" height="{QS}" color="{INK}"/>')
    P(f'<text x="{f(qx + QS/2)}" y="{f(QY + QS + 34)}" text-anchor="middle" {INTER} font-size="25" font-weight="600" fill="{INK}">{l1}</text>')
    P(f'<text x="{f(qx + QS/2)}" y="{f(QY + QS + 63)}" text-anchor="middle" {INTER} font-size="25" font-weight="400" fill="#1f4a2a">{l2}</text>')

CY0 = QY + QS + 92
P(f'<line x1="{M}" y1="{f(CY0)}" x2="{W - M}" y2="{f(CY0)}" stroke="{INK}" stroke-opacity="0.35" stroke-width="1.5"/>')
P(f'<g {INTER} font-size="25" fill="{INK}">'
  f'<text x="{M}" y="{f(CY0 + 38)}">03041, м. Київ, вул. Героїв Оборони, 13, навч. корпус № 4, кімн. 13</text>'
  f'<text x="{M}" y="{f(CY0 + 70)}" font-weight="600">(044) 527-89-66 · 096-977-80-58 · physiol.biochem2021@gmail.com</text>'
  f'</g>')

body = "\n".join(parts)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="99mm" height="210mm" viewBox="0 0 {W} {H}">\n'
       f'<defs>{DEFS}</defs>\n{body}\n</svg>\n')
OUT.write_text(svg, encoding="utf-8")
print("written", OUT, "hero", hy0, hy1, "about_end", ABOUT_END, "bach_end", BY_END, "contacts", CY0 + 70)
