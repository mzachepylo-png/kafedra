#!/usr/bin/env python3
"""Генератор флаєра v4-herbarium («Гербарій науковця»): python3 src/gen_v4-herbarium.py → src/v4-herbarium.svg"""
import math, random, pathlib

R = random.Random(1898)
W, H = 1480, 2100

# ---------- палітра ----------
INK = '#3a2817'      # сепія темна
INK2 = '#5b4229'
INK3 = '#8a6a45'
GREEN = '#4f6c37'
GREEN_D = '#2e4620'
GREEN_L = '#8ea865'
GOLD = '#a9843d'
STRAW = '#d6b46a'
STRAW_L = '#efdba3'
BLUE = '#1f4e8c'
CARD = '#fbf6e8'

defs, body = [], []
_gid = [0]


def gid(p='g'):
    _gid[0] += 1
    return f'{p}{_gid[0]}'


def add(s):
    body.append(s)


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def pts(P):
    return ' '.join(f'{f(x)},{f(y)}' for x, y in P)


def poly_path(P, close=True):
    s = 'M' + ' L'.join(f'{f(x)},{f(y)}' for x, y in P)
    return s + ('Z' if close else '')


def smooth_path(P, close=False):
    """Catmull-Rom → cubic Bezier."""
    n = len(P)
    if n < 3:
        return poly_path(P, close)
    s = f'M{f(P[0][0])},{f(P[0][1])}'
    rng = range(n if close else n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (close or i > 0) else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (close or i + 2 < n) else P[(i + 1) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        s += f' C{f(c1[0])},{f(c1[1])} {f(c2[0])},{f(c2[1])} {f(p2[0])},{f(p2[1])}'
    return s + ('Z' if close else '')


def bez(p0, p1, p2, p3, t):
    a = (1 - t) ** 3
    b = 3 * (1 - t) ** 2 * t
    c = 3 * (1 - t) * t * t
    d = t ** 3
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


def lingrad(stops, x1=0, y1=0, x2=1, y2=0, user=False, gid_=None):
    i = gid_ or gid('lg')
    u = ' gradientUnits="userSpaceOnUse"' if user else ''
    st = ''.join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>'
                 for o, c, a in [(s + (None,))[:3] for s in stops])
    defs.append(f'<linearGradient id="{i}" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"{u}>{st}</linearGradient>')
    return i


def radgrad(stops, cx=.5, cy=.5, r=.5, fx=None, fy=None, user=False, gid_=None):
    i = gid_ or gid('rg')
    u = ' gradientUnits="userSpaceOnUse"' if user else ''
    fxy = f' fx="{f(fx)}" fy="{f(fy)}"' if fx is not None else ''
    st = ''.join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>'
                 for o, c, a in [(s + (None,))[:3] for s in stops])
    defs.append(f'<radialGradient id="{i}" cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"{fxy}{u}>{st}</radialGradient>')
    return i


def esc(s):
    return s.replace('&', '&amp;')


def chem(s, dy=7, size='68%'):
    """Цифри після літери/дужки → нижній індекс (tspan)."""
    out, i = '', 0
    while i < len(s):
        ch = s[i]
        if ch.isdigit() and i > 0 and (s[i - 1].isalpha() or s[i - 1] == ')'):
            j = i
            while j < len(s) and s[j].isdigit():
                j += 1
            out += f'<tspan dy="{dy}" font-size="{size}">{s[i:j]}</tspan><tspan dy="-{dy}">​</tspan>'
            i = j
        else:
            out += esc(ch)
            i += 1
    return out


def text(x, y, s, size, fam='Lora', w=500, fill=INK, anchor='start', italic=False, ls=0, maxx=None, extra=''):
    a = f' text-anchor="{anchor}"' if anchor != 'start' else ''
    it = ' font-style="italic"' if italic else ''
    l = f' letter-spacing="{ls}"' if ls else ''
    m = f' data-maxx="{maxx}"' if maxx is not None else ''
    add(f'<text x="{f(x)}" y="{f(y)}" font-family="\'{fam}\'" font-size="{size}" font-weight="{w}" fill="{fill}"{a}{it}{l}{m}{extra}>{s}</text>')


# =====================================================================
# ФОН: пергамент, волокна, плями-«фоксинг»
# =====================================================================
paper = lingrad([(0, '#f6eed9'), (.45, '#f1e5c9'), (1, '#e9d8b3')], 0, 0, 0, 1)
vign = radgrad([(0, '#fff8e6', .0), (.62, '#d8bd8a', 0), (1, '#9c7440', .30)], .5, .46, .74)
add(f'<rect width="{W}" height="{H}" fill="url(#{paper})"/>')
add(f'<rect width="{W}" height="{H}" fill="url(#{vign})"/>')
# волокна
fib = []
for _ in range(520):
    x, y = R.uniform(0, W), R.uniform(0, H)
    a = R.uniform(0, math.pi)
    L = R.uniform(10, 46)
    bx = x + math.cos(a) * L
    by = y + math.sin(a) * L
    mx = (x + bx) / 2 + R.uniform(-6, 6)
    my = (y + by) / 2 + R.uniform(-6, 6)
    c = R.choice(['#8a6a45', '#a5834f', '#6e5232', '#c2a46e'])
    fib.append(f'<path d="M{f(x)},{f(y)} Q{f(mx)},{f(my)} {f(bx)},{f(by)}" stroke="{c}" stroke-width="{f(R.uniform(.5, 1.1))}" opacity="{f(R.uniform(.05, .14))}"/>')
add('<g fill="none" stroke-linecap="round">' + ''.join(fib) + '</g>')
# плями (foxing)
fox = radgrad([(0, '#8d5f2a', .38), (.55, '#a2733a', .16), (1, '#a2733a', 0)], gid_='fox')
spots = []
for _ in range(46):
    edge = R.random() < .75
    if edge:
        side = R.choice('tblr')
        x = R.uniform(0, W) if side in 'tb' else (R.uniform(0, 140) if side == 'l' else R.uniform(W - 140, W))
        y = R.uniform(0, H) if side in 'lr' else (R.uniform(0, 140) if side == 't' else R.uniform(H - 140, H))
    else:
        x, y = R.uniform(0, W), R.uniform(0, H)
    r = R.choice([R.uniform(2, 6), R.uniform(5, 14), R.uniform(12, 30)])
    spots.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r)}" ry="{f(r * R.uniform(.7, 1))}" fill="url(#fox)" opacity="{f(R.uniform(.35, .9))}"/>')
add('<g>' + ''.join(spots) + '</g>')

# рамка
add(f'<rect x="26" y="26" width="{W - 52}" height="{H - 52}" fill="none" stroke="{INK2}" stroke-width="2.4"/>')
add(f'<rect x="36" y="36" width="{W - 72}" height="{H - 72}" fill="none" stroke="{INK2}" stroke-width=".9" opacity=".8"/>')
for cx, cy, sx, sy in [(36, 36, 1, 1), (W - 36, 36, -1, 1), (36, H - 36, 1, -1), (W - 36, H - 36, -1, -1)]:
    add(f'<g transform="translate({cx},{cy}) scale({sx},{sy})" fill="none" stroke="{INK2}" stroke-width="1.1">'
        f'<path d="M0,16 Q12,12 16,0"/><circle cx="9" cy="9" r="2.6" fill="{GOLD}" stroke="none"/></g>')

# =====================================================================
# ШАПКА
# =====================================================================
add('<use href="#nubip-crest" x="68" y="62" width="171" height="180"/>')
# логотип кафедри у тонкому кільці
add(f'<circle cx="1328" cy="152" r="94" fill="none" stroke="{INK2}" stroke-width="1.2" opacity=".7"/>')
add('<use href="#dept-logo" x="1240" y="64" width="176" height="176"/>')

text(740, 104, 'НАЦІОНАЛЬНИЙ УНІВЕРСИТЕТ БІОРЕСУРСІВ', 28, 'Alegreya', 700, BLUE, 'middle', ls=2.6)
text(740, 140, 'І ПРИРОДОКОРИСТУВАННЯ УКРАЇНИ <tspan letter-spacing="0.5">(НУБіП України)</tspan>', 28, 'Alegreya', 700, BLUE, 'middle', ls=2.6)
# орнаментальна лінія
add(f'<g stroke="{GOLD}" stroke-width="1.3"><line x1="470" y1="170" x2="718" y2="170"/><line x1="762" y1="170" x2="1010" y2="170"/></g>')
add(f'<path d="M740,161 L749,170 L740,179 L731,170Z" fill="{GOLD}"/>')
text(740, 214, 'Факультет захисту рослин, біотехнологій та екології', 27, 'Lora', 500, INK2, 'middle', italic=True)

# заголовок
add(f'<g stroke="{GOLD}" stroke-width="1.2"><line x1="470" y1="268" x2="620" y2="268"/><line x1="860" y1="268" x2="1010" y2="268"/></g>')
text(740, 278, 'КАФЕДРА', 28, 'Alegreya', 700, GOLD, 'middle', ls=9)
text(740, 350, 'Фізіології, біохімії рослин', 68, 'Alegreya', 700, INK, 'middle')
text(740, 420, 'та біоенергетики', 68, 'Alegreya', 700, INK, 'middle')

# =====================================================================
# ТАБЛИЦЯ (ботанічна плита)
# =====================================================================
PX0, PY0, PX1, PY1 = 60, 452, 1420, 1132
add(f'<rect x="{PX0}" y="{PY0}" width="{PX1 - PX0}" height="{PY1 - PY0}" fill="#fffaf0" fill-opacity=".28" stroke="{INK2}" stroke-width="1.3"/>')
add(f'<rect x="{PX0 + 7}" y="{PY0 + 7}" width="{PX1 - PX0 - 14}" height="{PY1 - PY0 - 14}" fill="none" stroke="{INK3}" stroke-width=".6"/>')


def num(x, y, n):
    add(f'<circle cx="{f(x)}" cy="{f(y)}" r="17" fill="{CARD}" stroke="{INK2}" stroke-width="1.3"/>')
    text(x, y + 8.5, str(n), 25, 'Alegreya', 700, INK, 'middle')


# ---------- ПШЕНИЦЯ ----------
def culm_poly(p0, p1, p2, p3, w0, w1, t0=0, t1=1, n=40):
    L, Rr = [], []
    for k in range(n + 1):
        t = t0 + (t1 - t0) * k / n
        x, y = bez(p0, p1, p2, p3, t)
        x2, y2 = bez(p0, p1, p2, p3, min(1, t + 1e-3))
        x1_, y1_ = bez(p0, p1, p2, p3, max(0, t - 1e-3))
        dx, dy = x2 - x1_, y2 - y1_
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        w = (w0 + (w1 - w0) * t) / 2
        L.append((x + nx * w, y + ny * w))
        Rr.append((x - nx * w, y - ny * w))
    return L, Rr


def blade(p0, a0, L, Wd, bend, senesce=0.0, seed=0, flip=False):
    """Лінійна листова пластинка злаку вздовж кривої; дві половини (злам по середній жилці)."""
    rr = random.Random(seed)
    n = 48
    P, A = [], []
    x, y = p0
    th = math.radians(a0)
    ds = L / n
    for k in range(n + 1):
        t = k / n
        P.append((x, y))
        A.append(th)
        th = math.radians(a0 + bend * (t ** 1.5))
        x += math.cos(th) * ds
        y += math.sin(th) * ds
    left, right = [], []
    for k, ((x, y), th) in enumerate(zip(P, A)):
        t = k / n
        w = Wd * (0.5 + 0.5 * math.sin(min(t / .22, 1) * math.pi / 2)) * (1 - t) ** 0.62 / 2
        nx, ny = -math.sin(th), math.cos(th)
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    tip = P[-1]
    # градієнт уздовж листка (зелений → солом'яний на кінчику, якщо старіє)
    stops = [(0, '#6f8f45'), (.55, '#5f7f3c')]
    if senesce > 0:
        stops += [(max(.6, 1 - senesce), '#7f8a45'), (1, '#c4a35c')]
    else:
        stops += [(1, '#7f9a50')]
    g1 = lingrad(stops, p0[0], p0[1], tip[0], tip[1], user=True)
    stops2 = [(o, c) for o, c in stops]
    g2 = lingrad([(0, '#4d6a2f'), (.6, '#425f29')] + ([(max(.6, 1 - senesce), '#6a7036'), (1, '#a88645')] if senesce else [(1, '#5a7535')]),
                 p0[0], p0[1], tip[0], tip[1], user=True)
    la, lb = (g1, g2) if not flip else (g2, g1)
    s = '<g>'
    s += f'<path d="{poly_path(left + P[::-1])}" fill="url(#{la})"/>'
    s += f'<path d="{poly_path(P + right[::-1])}" fill="url(#{lb})"/>'
    # паралельні жилки
    for side, edge in ((1, left), (-1, right)):
        for fr in (.35, .7):
            V = [(P[k][0] + (edge[k][0] - P[k][0]) * fr, P[k][1] + (edge[k][1] - P[k][1]) * fr) for k in range(n + 1)]
            s += f'<path d="{smooth_path(V)}" fill="none" stroke="#2f4a1f" stroke-width=".55" opacity=".45"/>'
    s += f'<path d="{smooth_path(P)}" fill="none" stroke="#dfe7b8" stroke-width="1.1" opacity=".75"/>'
    s += f'<path d="{smooth_path(left)} L{f(tip[0])},{f(tip[1])}" fill="none" stroke="{GREEN_D}" stroke-width=".8"/>'
    s += f'<path d="{smooth_path(right)} L{f(tip[0])},{f(tip[1])}" fill="none" stroke="{GREEN_D}" stroke-width=".8"/>'
    s += '</g>'
    return s


def ear(bx, by, tilt, L, Wd, seed, awn=0.62):
    """Колос: дворядно-черепитчасті колоски зигзагом уздовж стрижня, у кожному 3 квіткові луски + остюки."""
    rr = random.Random(seed)
    s = f'<g transform="translate({f(bx)},{f(by)}) rotate({f(tilt)})">'
    awns, spk = [], []
    nps = 9
    total = 2 * nps
    gA = lingrad([(0, '#f6e7b5'), (.4, '#e0c178'), (.75, '#bd9445'), (1, '#8c6a2c')], 0, 0, 1, .2)
    gB = lingrad([(0, '#ead398'), (.5, '#c99f52'), (1, '#7f5e25')], 0, 0, 1, .2)
    gC = lingrad([(0, '#8c6a2c'), (.3, '#c49a4c'), (.7, '#e7cd8a'), (1, '#f4e4b0')], 0, 0, 1, .2)
    for i in range(total):
        side = 1 if i % 2 == 0 else -1
        tt = i / (total - 1)
        u = L * (0.04 + 0.84 * tt)
        ls = L * 0.24 * (1 - 0.32 * tt)
        ws = Wd * 0.36 * (1 - 0.3 * tt)
        off = side * Wd * 0.17 * (1 - 0.35 * tt)
        ang = side * (30 - 12 * tt)
        sub = f'<g transform="translate({f(off)},{f(-u)}) rotate({f(ang)})">'
        florets = [(-16 * side, .82, gB if side > 0 else gC), (8 * side, .9, gA), (0, 1, gA if side > 0 else gC)]
        for rot, sc, g in florets:
            l, w = ls * sc, ws * sc
            pth = (f'M{f(-w * .12)},0 C{f(w * .55)},{f(-l * .05)} {f(w * .58)},{f(-l * .55)} {f(w * .05)},{f(-l)} '
                   f'C{f(-w * .4)},{f(-l * .62)} {f(-w * .62)},{f(-l * .22)} {f(-w * .12)},0Z')
            sub += (f'<g transform="rotate({rot})"><path d="{pth}" fill="url(#{g})" stroke="#5e4219" stroke-width=".9"/>'
                    f'<path d="M{f(w * .1)},{f(-l * .08)} Q{f(w * .2)},{f(-l * .5)} {f(w * .05)},{f(-l * .95)}" fill="none" stroke="#6b4c1e" stroke-width=".75" opacity=".75"/>'
                    f'<path d="M{f(-w * .3)},{f(-l * .18)} Q{f(-w * .34)},{f(-l * .45)} {f(-w * .12)},{f(-l * .74)}" fill="none" stroke="#fff6d8" stroke-width="1.1" opacity=".6"/></g>')
            if sc < 1 or rr.random() < .5:
                a = math.radians(ang + rot)
                tx = off + math.sin(a) * l
                ty = -u - math.cos(a) * l
                al = L * (awn + rr.uniform(-.1, .1)) * (1 - 0.3 * tt)
                spread = math.radians(ang * 0.42 + rot * 0.35 + rr.uniform(-3, 3))
                ex, ey = tx + math.sin(spread) * al, ty - math.cos(spread) * al
                mx, my = (tx + ex) / 2 + rr.uniform(-3, 3), (ty + ey) / 2
                awns.append(f'M{f(tx)},{f(ty)} Q{f(mx)},{f(my)} {f(ex)},{f(ey)}')
        sub += '</g>'
        spk.append(sub)
    l, w = L * 0.17, Wd * 0.26
    spk.append(f'<path transform="translate(0,{f(-L * .86)})" d="M{f(-w * .1)},0 C{f(w * .6)},{f(-l * .1)} {f(w * .5)},{f(-l * .6)} 0,{f(-l)} C{f(-w * .5)},{f(-l * .6)} {f(-w * .6)},{f(-l * .1)} {f(-w * .1)},0Z" fill="url(#{gA})" stroke="#5e4219" stroke-width=".9"/>')
    awns.append(f'M0,{f(-L * 1.02)} Q2,{f(-L * 1.3)} 1,{f(-L * (1.02 + awn * .8))}')
    d = ' '.join(awns)
    s += f'<path d="{d}" fill="none" stroke="#7d5f2a" stroke-width="1.25" stroke-linecap="round"/>'
    s += f'<path d="{d}" fill="none" stroke="#e8d08e" stroke-width=".45" stroke-linecap="round" opacity=".8"/>'
    s += f'<path d="M0,6 L0,{f(-L * .9)}" stroke="#6b4c1e" stroke-width="3"/>'
    s += ''.join(spk)
    s += '</g>'
    return s


def roots(cx, cy, seed, spread=1.0):
    rr = random.Random(seed)
    s = f'<g fill="none" stroke-linecap="round" stroke="#6b4e2e">'
    for i in range(28):
        a = math.radians(rr.uniform(35, 145))
        L = rr.uniform(50, 92)
        x, y = cx + rr.uniform(-7, 7), cy
        P = [(x, y)]
        th = a
        steps = 9
        for k in range(steps):
            th += rr.uniform(-.25, .25)
            th = min(max(th, math.radians(25)), math.radians(155))
            x += math.cos(th) * L / steps * spread
            y += math.sin(th) * L / steps * .9
            P.append((x, y))
        s += f'<path d="{smooth_path(P)}" stroke-width="{f(rr.uniform(1.0, 1.8))}" opacity=".85"/>'
        for k in range(2, len(P) - 1):
            if rr.random() < .6:
                px, py = P[k]
                b = th + rr.choice([-1, 1]) * rr.uniform(.6, 1.2)
                bl = rr.uniform(5, 13)
                qx, qy = px + math.cos(b) * bl, py + math.sin(b) * bl * .8
                s += f'<path d="M{f(px)},{f(py)} Q{f((px + qx) / 2 + rr.uniform(-2, 2))},{f((py + qy) / 2)} {f(qx)},{f(qy)}" stroke-width=".55" opacity=".7"/>'
    s += '</g>'
    return s


def tape(x, y, w, h, ang):
    g = lingrad([(0, '#fffdf4', .9), (1, '#efe4c6', .9)], 0, 0, 0, 1)
    return (f'<g transform="translate({f(x)},{f(y)}) rotate({f(ang)})">'
            f'<rect x="{f(-w / 2 + 1.5)}" y="{f(-h / 2 + 2.5)}" width="{f(w)}" height="{f(h)}" fill="#5b4229" opacity=".12"/>'
            f'<rect x="{f(-w / 2)}" y="{f(-h / 2)}" width="{f(w)}" height="{f(h)}" fill="url(#{g})" stroke="#c9b68a" stroke-width=".6"/></g>')


def bez_dir(c, t):
    a = bez(*c, max(0, t - .01))
    b = bez(*c, min(1, t + .01))
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))  # напрям від кореня вгору


def wheat(crown, culms, leaves, basal):
    s = '<g>'
    s += roots(crown[0], crown[1] + 4, 5)
    # прикореневі листки (старіють)
    for a0, L, Wd, bend, sen, sd in basal:
        s += blade((crown[0] + (4 if a0 > -90 else -4), crown[1] - 6), a0, L, Wd, bend, sen, sd, flip=sd % 2 == 0)
    gst = lingrad([(0, '#d9c07c'), (.3, '#b7aa62'), (.65, '#7b9248'), (1, '#5d7a3a')], 0, 600, 0, crown[1], user=True)
    C = []
    for c in culms:
        C.append((crown, c['c1'], c['c2'], c['top']))
    # стеблові листки, що відходять від вузлів (позаду колосся)
    blades_front = []
    for ci, t, side, L, Wd, bend, sen, sd in leaves:
        c = C[ci]
        p = bez(*c, t)
        d = bez_dir(c, t)
        a0 = d + side * 38
        bnd = bend if side > 0 else -bend
        blades_front.append(blade(p, a0, L, Wd, bnd, sen, sd, flip=sd % 2 == 0))
    for c in C:
        L_, R_ = culm_poly(*c, 8.5, 5.0)
        s += f'<path d="{poly_path(L_ + R_[::-1])}" fill="url(#{gst})" stroke="#4a5a2a" stroke-width=".7"/>'
        HL = [((a[0] * .72 + b[0] * .28), (a[1] * .72 + b[1] * .28)) for a, b in zip(L_, R_)]
        s += f'<path d="{smooth_path(HL)}" fill="none" stroke="#fff8dc" stroke-width="1.3" opacity=".5"/>'
    s += ''.join(blades_front)
    # піхви листків і вузли (поверх)
    gsh = lingrad([(0, '#4f6b30'), (.35, '#9fb76c'), (.6, '#6f8c44'), (1, '#3f5a26')])
    for ci, t, side, *_ in leaves:
        c = C[ci]
        Ls, Rs = culm_poly(*c, 11.5, 10.5, t0=max(0, t - .17), t1=t, n=12)
        s += f'<path d="{poly_path(Ls + Rs[::-1])}" fill="url(#{gsh})" stroke="#34491f" stroke-width=".7"/>'
        x, y = bez(*c, t)
        s += f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="6.5" ry="3" transform="rotate({f(bez_dir(c, t) + 90)} {f(x)} {f(y)})" fill="#4d5b26"/>'
    for c, cc in zip(culms, C):
        s += ear(cc[3][0], cc[3][1], c['tilt'], c['L'], c['Wd'], c['seed'])
    # гербарні смужки на стеблах
    for ci, t, ang in ((0, .42, -14), (1, .55, 20), (2, .5, -8)):
        x, y = bez(*C[ci], t)
        s += tape(x, y, 50, 13, ang)
    s += '</g>'
    return s


CROWN = (262, 1040)
CULMS = [
    dict(top=(258, 742), tilt=-2, L=134, Wd=50, c1=(264, 930), c2=(252, 830), seed=11),
    dict(top=(382, 790), tilt=18, L=120, Wd=46, c1=(280, 950), c2=(352, 870), seed=12),
    dict(top=(148, 810), tilt=-17, L=112, Wd=44, c1=(248, 965), c2=(168, 885), seed=13),
]
# (стебло, t вузла, бік, довжина, ширина, вигин, старіння, seed)
LEAVES = [
    (0, .36, -1, 190, 16, 70, 0, 21),
    (0, .62, 1, 175, 15, 75, 0, 22),
    (0, .84, -1, 140, 12, 55, 0, 23),
    (1, .45, 1, 150, 14, 70, .1, 24),
    (1, .78, 1, 115, 12, 50, 0, 25),
    (2, .48, -1, 140, 14, 65, .15, 26),
    (2, .8, -1, 105, 11, 45, 0, 27),
]
BASAL = [
    (-150, 150, 15, -60, .55, 31),
    (-35, 145, 15, 65, .6, 32),
    (-165, 115, 13, -45, .7, 33),
    (-15, 110, 13, 45, .7, 34),
]
add(wheat(CROWN, CULMS, LEAVES, BASAL))

# ---------- ЛИСТОК із жилкуванням ----------
def leaf(ox, oy, L, Wmax, rot):
    """Листок дводольної рослини: сітчасте жилкування. Локально — від черешка (0,0) до верхівки (L,0)."""
    rr = random.Random(77)
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))

    def M(x, y):
        y2 = y - 0.10 * L * (x / L) ** 2
        return (ox + x * cr - y2 * sr, oy + x * sr + y2 * cr)

    def half(t):
        if t <= 0 or t >= 1:
            return 0.0
        return Wmax * (math.sin(math.pi * t ** 0.78) ** 0.95) * (1 - .18 * t)

    def margin(t, side):
        h = half(t)
        if 0.04 < t < 0.97:
            ph = (t * 46) % 1
            h *= 1 + 0.03 * (ph if ph < .8 else (1 - ph) * 4) - .015
        return h * side

    n = 220
    top = [M(L * k / n, -margin(k / n, 1)) for k in range(n + 1)]
    bot = [M(L * k / n, margin(k / n, 1) * 1) for k in range(n + 1)]
    outline = top + bot[::-1]
    cid = gid('leafclip')
    defs.append(f'<clipPath id="{cid}"><path d="{poly_path(outline)}"/></clipPath>')
    hid = gid('halfclip')
    mid = [M(L * k / n, 0) for k in range(n + 1)]
    defs.append(f'<clipPath id="{hid}"><path d="{poly_path(mid + bot[::-1])}"/></clipPath>')
    s = '<g>'
    # тінь
    sh = [(x + 7, y + 9) for x, y in outline]
    s += f'<path d="{poly_path(sh)}" fill="#5b4229" opacity=".13"/>'
    # черешок
    pa, pb = M(0, 0), M(-L * .16, L * .02)
    s += f'<path d="M{f(pa[0])},{f(pa[1])} Q{f((pa[0] + pb[0]) / 2)},{f((pa[1] + pb[1]) / 2 + 4)} {f(pb[0])},{f(pb[1])}" stroke="#5e7a35" stroke-width="7" stroke-linecap="round" fill="none"/>'
    s += f'<path d="M{f(pa[0])},{f(pa[1])} Q{f((pa[0] + pb[0]) / 2)},{f((pa[1] + pb[1]) / 2 + 4)} {f(pb[0])},{f(pb[1])}" stroke="#b8c98a" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7"/>'
    # заливка: верхня половина світліша
    g_top = lingrad([(0, '#a9c46e'), (.5, '#7fa24a'), (1, '#5e8436')], 0, 0, 1, 1)
    s += f'<path d="{poly_path(outline)}" fill="url(#{g_top})"/>'
    g_bot = lingrad([(0, '#3f6228', .0), (1, '#2f4d1d', .55)], 0, 0, 0, 1)
    s += f'<path d="{poly_path(mid + bot[::-1])}" fill="url(#{g_bot})"/>'
    # відблиск
    hl = radgrad([(0, '#fbffe6', .45), (1, '#fbffe6', 0)], .5, .5, .5)
    c1 = M(L * .4, -Wmax * .45)
    s += f'<ellipse cx="{f(c1[0])}" cy="{f(c1[1])}" rx="{f(L * .26)}" ry="{f(Wmax * .28)}" transform="rotate({f(rot - 4)} {f(c1[0])} {f(c1[1])})" fill="url(#{hl})" clip-path="url(#{cid})"/>'
    # жилкування
    v = f'<g clip-path="url(#{cid})" fill="none" stroke-linecap="round">'
    sec = {1: [], -1: []}
    for side in (1, -1):
        for i in range(9):
            ts = 0.07 + i * 0.094 + (0.035 if side < 0 else 0)
            if ts > .86:
                continue
            te = min(ts + 0.17 + 0.03 * (1 - ts), .985)
            P = []
            for k in range(13):
                u = k / 12
                x = L * (ts + (te - ts) * (u ** 0.85))
                yv = side * half(x / L) * 0.86 * (math.sin(u * math.pi / 2) ** 1.25)
                P.append((x, yv))
            sec[side].append(P)
            v += f'<path d="{smooth_path([M(*p) for p in P])}" stroke="#d6e3a6" stroke-width="{f(2.2 - ts * 1.4)}" opacity=".9"/>'
        # дуги біля краю (петлі)
        for a, b in zip(sec[side], sec[side][1:]):
            p, q = a[-1], b[-1]
            P = [p]
            for k in range(1, 6):
                u = k / 6
                x = p[0] + (q[0] - p[0]) * u
                P.append((x, side * half(x / L) * (0.86 - 0.08 * math.sin(u * math.pi))))
            P.append(q)
            v += f'<path d="{smooth_path([M(*pp) for pp in P])}" stroke="#cfdc9c" stroke-width=".9" opacity=".8"/>'
        # третинні — між сусідніми вторинними
        for a, b in zip(sec[side], sec[side][1:]):
            for k in range(2, 11, 2):
                p = a[k]
                q = b[max(1, k - 3)]
                mx = (p[0] + q[0]) / 2 + rr.uniform(-3, 3)
                my = (p[1] + q[1]) / 2 + rr.uniform(-3, 3)
                pp, mm, qq = M(*p), M(mx, my), M(*q)
                v += f'<path d="M{f(pp[0])},{f(pp[1])} Q{f(mm[0])},{f(mm[1])} {f(qq[0])},{f(qq[1])}" stroke="#c3d38e" stroke-width=".55" opacity=".7"/>'
    # дрібна сітка (ареоли)
    for _ in range(260):
        t = rr.uniform(.05, .95)
        side = rr.choice([1, -1])
        yv = side * half(t) * rr.uniform(.05, .85)
        a = rr.uniform(0, math.pi)
        l = rr.uniform(5, 11)
        p = M(L * t, yv)
        v += f'<path d="M{f(p[0])},{f(p[1])} l{f(math.cos(a) * l)},{f(math.sin(a) * l)}" stroke="#b9cc85" stroke-width=".4" opacity=".55"/>'
    # центральна жилка
    MP = [M(L * k / 40, 0) for k in range(41)]
    v += f'<path d="{smooth_path(MP)}" stroke="#e3ecb8" stroke-width="3.4"/>'
    v += f'<path d="{smooth_path([(x + 1.2, y + 1.6) for x, y in MP])}" stroke="#3e5f26" stroke-width="1" opacity=".5"/>'
    v += '</g>'
    s += v
    # штрихування затіненої половини
    hatch = f'<g clip-path="url(#{hid})" stroke="#1f3514" stroke-width=".6" opacity=".22">'
    for k in range(-40, 70):
        x0 = k * 7
        a = M(x0, 0)
        b = M(x0 + 50, Wmax)
        hatch += f'<line x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}"/>'
    hatch += '</g>'
    s += hatch
    s += f'<path d="{poly_path(outline)}" fill="none" stroke="#2c4519" stroke-width="1.3"/>'
    s += '</g>'
    return s, M, half


LEAF_O = (536, 792)
LEAF_L, LEAF_W, LEAF_ROT = 352, 88, -36
leaf_svg, LM, LH = leaf(LEAF_O[0], LEAF_O[1], LEAF_L, LEAF_W, LEAF_ROT)
add(leaf_svg)

# лінія зрізу а–а на листку
t_cut = .5
ca = LM(LEAF_L * t_cut, -LH(t_cut) * 1.18)
cb = LM(LEAF_L * t_cut, LH(t_cut) * 1.18)
add(f'<line x1="{f(ca[0])}" y1="{f(ca[1])}" x2="{f(cb[0])}" y2="{f(cb[1])}" stroke="{INK}" stroke-width="1.6" stroke-dasharray="7 5"/>')

# ---------- ПОПЕРЕЧНИЙ ЗРІЗ (вставка) ----------
IC = (1198, 624)
IR = 142


def cross_section(cx, cy, r):
    rr = random.Random(3)
    cid = gid('insclip')
    defs.append(f'<clipPath id="{cid}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>')
    s = ''
    # лінії збільшення від зрізу до кола
    s += (f'<g stroke="{INK2}" stroke-width=".9" stroke-dasharray="2 4" fill="none" opacity=".8">'
          f'<line x1="{f(ca[0])}" y1="{f(ca[1])}" x2="{f(cx - r * .55)}" y2="{f(cy - r * .83)}"/>'
          f'<line x1="{f(cb[0])}" y1="{f(cb[1])}" x2="{f(cx - r * .62)}" y2="{f(cy + r * .78)}"/></g>')
    bg = radgrad([(0, '#fdfaf0'), (.8, '#f3ecd6'), (1, '#e2d4b0')], .45, .4, .6)
    s += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{bg})"/>'
    g = f'<g clip-path="url(#{cid})">'
    top = cy - r * .62
    hE, hP, hS, hE2 = r * .12, r * .46, r * .50, r * .11
    y_ep, y_pal, y_sp, y_le = top, top + hE, top + hE + hP, top + hE + hP + hS
    bottom = y_le + hE2
    x0, x1 = cx - r - 4, cx + r + 4
    chl = radgrad([(0, '#9bd067'), (.6, '#3f8a2c'), (1, '#24561a')], .4, .35, .6, gid_='chl')
    # фон тканини (міжклітинники)
    g += f'<rect x="{f(x0)}" y="{f(y_ep)}" width="{f(x1 - x0)}" height="{f(bottom - y_ep)}" fill="#eef1d6"/>'
    # кутикула
    g += f'<rect x="{f(x0)}" y="{f(y_ep - 3)}" width="{f(x1 - x0)}" height="3.4" fill="#d9c27a"/>'
    g += f'<rect x="{f(x0)}" y="{f(bottom)}" width="{f(x1 - x0)}" height="3" fill="#d9c27a"/>'
    # верхня епідерма
    x = x0
    while x < x1:
        w = rr.uniform(r * .13, r * .19)
        g += f'<rect x="{f(x + .8)}" y="{f(y_ep + .8)}" width="{f(w - 1.6)}" height="{f(hE - 1.6)}" rx="3" fill="#f8f6e6" stroke="{INK2}" stroke-width=".9"/>'
        x += w
    # палісадний мезофіл
    x = x0
    pw = r * .085
    while x < x1:
        hh = hP - rr.uniform(2, 7)
        g += f'<rect x="{f(x + 1.2)}" y="{f(y_pal + 1.5)}" width="{f(pw - 2.4)}" height="{f(hh)}" rx="{f(pw * .45)}" fill="#d4e6a6" stroke="{INK2}" stroke-width=".85"/>'
        for k in range(7):
            yy = y_pal + 7 + k * (hh - 12) / 6
            for sx in (x + 4.2, x + pw - 4.2):
                g += f'<ellipse cx="{f(sx)}" cy="{f(yy + rr.uniform(-1.5, 1.5))}" rx="2.4" ry="3.6" fill="url(#chl)"/>'
        x += pw
    # губчастий мезофіл
    cells = []
    tries = 0
    while len(cells) < 34 and tries < 4000:
        tries += 1
        cr_ = rr.uniform(r * .07, r * .11)
        px = rr.uniform(x0, x1)
        py = rr.uniform(y_sp + cr_ * .8, y_le - cr_ * .6)
        bx_, by_ = cx + r * .36, y_sp + hS * .42
        if math.hypot(px - bx_, py - by_) < r * .22 + cr_:
            continue
        if math.hypot(px - (cx - r * .28), py - (y_le - 4)) < r * .14 + cr_ * .5:
            continue
        if all(math.hypot(px - qx, py - qy) > (cr_ + qr) * .9 for qx, qy, qr in cells):
            cells.append((px, py, cr_))
    for px, py, cr_ in cells:
        P = []
        for k in range(10):
            a = k / 10 * 2 * math.pi
            rad = cr_ * rr.uniform(.82, 1.08)
            P.append((px + math.cos(a) * rad * 1.15, py + math.sin(a) * rad * .9))
        g += f'<path d="{smooth_path(P, True)}" fill="#dfeab9" stroke="{INK2}" stroke-width=".85"/>'
        for k in range(rr.randint(3, 5)):
            a = rr.uniform(0, 2 * math.pi)
            g += f'<ellipse cx="{f(px + math.cos(a) * cr_ * .62)}" cy="{f(py + math.sin(a) * cr_ * .5)}" rx="3.2" ry="2.3" transform="rotate({f(math.degrees(a) + 90)} {f(px + math.cos(a) * cr_ * .62)} {f(py + math.sin(a) * cr_ * .5)})" fill="url(#chl)"/>'
    # провідний пучок
    bx_, by_ = cx + r * .36, y_sp + hS * .42
    for k in range(12):
        a = k / 12 * 2 * math.pi
        px, py = bx_ + math.cos(a) * r * .19, by_ + math.sin(a) * r * .16
        g += f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(r * .055)}" ry="{f(r * .048)}" fill="#ecefc8" stroke="{INK2}" stroke-width=".8"/>'
    for k, (dx, dy, rad) in enumerate([(-11, -8, 7.5), (2, -12, 8.5), (14, -6, 6.5), (-3, 1, 5.5)]):
        g += f'<circle cx="{f(bx_ + dx)}" cy="{f(by_ + dy)}" r="{rad}" fill="#f4e7d4" stroke="#8a4a2a" stroke-width="2.2"/>'
    for k in range(9):
        g += f'<circle cx="{f(bx_ - 14 + (k % 5) * 7)}" cy="{f(by_ + 12 + (k // 5) * 6)}" r="3" fill="#e6d9b5" stroke="{INK2}" stroke-width=".6"/>'
    # нижня епідерма з продихом
    sx_ = cx - r * .28
    x = x0
    while x < x1:
        w = rr.uniform(r * .12, r * .17)
        if x < sx_ + 14 and x + w > sx_ - 14:
            x = sx_ + 14
            continue
        g += f'<rect x="{f(x + .8)}" y="{f(y_le + .8)}" width="{f(w - 1.6)}" height="{f(hE2 - 1.6)}" rx="3" fill="#f8f6e6" stroke="{INK2}" stroke-width=".9"/>'
        x += w
    for sgn in (-1, 1):
        gx = sx_ + sgn * 7.5
        g += f'<ellipse cx="{f(gx)}" cy="{f(y_le + hE2 / 2)}" rx="6.5" ry="{f(hE2 / 2 + 1)}" fill="#bcd98a" stroke="{INK2}" stroke-width=".9"/>'
        g += f'<circle cx="{f(gx + sgn * 1.5)}" cy="{f(y_le + hE2 / 2 - 2)}" r="1.8" fill="url(#chl)"/><circle cx="{f(gx + sgn * 1.2)}" cy="{f(y_le + hE2 / 2 + 3)}" r="1.8" fill="url(#chl)"/>'
    g += '</g>'
    s += g
    # оправа (латунне кільце лінзи)
    ring = lingrad([(0, '#f1d58f'), (.35, '#b8893a'), (.6, '#6a4a17'), (1, '#d9b56a')], 0, 0, 1, 1)
    s += f'<circle cx="{cx}" cy="{cy}" r="{r + 5}" fill="none" stroke="url(#{ring})" stroke-width="10"/>'
    s += f'<circle cx="{cx}" cy="{cy}" r="{r + 10.5}" fill="none" stroke="{INK}" stroke-width="1"/>'
    s += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{INK}" stroke-width="1"/>'
    gl = radgrad([(0, '#ffffff', .0), (.82, '#ffffff', 0), (1, '#ffffff', .35)], .3, .25, .8)
    s += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{gl})"/>'
    s += f'<path d="M{f(cx - r * .72)},{f(cy - r * .52)} A{r * .9},{r * .9} 0 0 1 {f(cx - r * .1)},{f(cy - r * .88)}" fill="none" stroke="#fff" stroke-width="3" opacity=".55" stroke-linecap="round"/>'
    return s


add(cross_section(IC[0], IC[1], IR))

# ---------- НАТЮРМОРТ: мікроскоп, колба, ступка ----------
BRASS = lingrad([(0, '#4a3210'), (.18, '#9a7330'), (.4, '#f3da98'), (.55, '#d1a75a'), (.8, '#7a5520'), (1, '#3d290c')], gid_='brass')
BRASS_V = lingrad([(0, '#f0d38c'), (.5, '#b98d3f'), (1, '#5d4114')], 0, 0, 0, 1, gid_='brassv')
STEEL = lingrad([(0, '#2a2a2a'), (.35, '#8b8b85'), (.5, '#e0ded4'), (.7, '#6d6b63'), (1, '#1e1e1e')], gid_='steel')


def microscope(x, y, s_):
    g = f'<g transform="translate({f(x)},{f(y)}) scale({s_})">'
    # тінь
    sh = radgrad([(0, '#3a2817', .4), (1, '#3a2817', 0)], gid_=gid('sh'))
    g += f'<ellipse cx="6" cy="2" rx="96" ry="12" fill="url(#{sh})"/>'
    # основа (підкова)
    g += '<path d="M-78,0 L-70,-20 Q0,-30 70,-20 L78,0 Q0,8 -78,0Z" fill="url(#brass)" stroke="#2e1f08" stroke-width="1.2"/>'
    g += '<path d="M-70,-20 Q0,-30 70,-20 Q0,-12 -70,-20Z" fill="url(#brassv)" stroke="#2e1f08" stroke-width=".8"/>'
    # колона
    g += '<rect x="-12" y="-96" width="24" height="76" fill="url(#brass)" stroke="#2e1f08" stroke-width="1"/>'
    # гравірувальне штрихування тіньового боку колони й основи
    g += ''.join(f'<line x1="{5 + k * 1.3}" y1="-94" x2="{5 + k * 1.3}" y2="-22" stroke="#2e1f08" stroke-width=".45" opacity=".45"/>' for k in range(6))
    g += ''.join(f'<line x1="{30 + k * 6}" y1="{-17 + k * .6}" x2="{36 + k * 6}" y2="{-2 + k * .2}" stroke="#2e1f08" stroke-width=".5" opacity=".35"/>' for k in range(7))
    # шарнір
    g += '<circle cx="0" cy="-102" r="15" fill="url(#brass)" stroke="#2e1f08" stroke-width="1.1"/><circle cx="0" cy="-102" r="5" fill="#3d290c"/>'
    # дзеркало
    g += '<path d="M14,-58 L36,-58" stroke="#5d4114" stroke-width="4"/>'
    g += '<ellipse cx="46" cy="-58" rx="7" ry="17" fill="url(#steel)" stroke="#2e1f08" stroke-width="1"/>'
    # предметний столик
    g += '<path d="M-6,-128 L88,-128 L92,-120 L-2,-120Z" fill="url(#brassv)" stroke="#2e1f08" stroke-width="1"/>'
    g += '<rect x="-2" y="-120" width="94" height="6" fill="#6a4a17" stroke="#2e1f08" stroke-width=".8"/>'
    g += '<rect x="34" y="-133" width="34" height="5" fill="#e9f2f0" stroke="#7a8a88" stroke-width=".7" opacity=".9"/>'
    g += '<rect x="44" y="-133" width="10" height="5" fill="#7fae4d" opacity=".9"/>'
    # тубус-тримач (дуга)
    g += '<path d="M-6,-110 C-46,-140 -50,-210 -8,-248 L8,-236 C-26,-204 -22,-150 10,-122Z" fill="url(#brass)" stroke="#2e1f08" stroke-width="1.1"/>'
    # гвинт фокусування
    g += '<ellipse cx="-30" cy="-200" rx="8" ry="16" fill="url(#brass)" stroke="#2e1f08" stroke-width="1"/>'
    for k in range(-12, 13, 4):
        g += f'<line x1="-36" y1="{-200 + k}" x2="-24" y2="{-200 + k}" stroke="#3d290c" stroke-width=".7"/>'
    # тубус (нахилений)
    g += '<g transform="translate(56,-150) rotate(-18)">'
    g += '<rect x="-8" y="0" width="16" height="16" fill="url(#steel)" stroke="#1e1e1e" stroke-width=".8"/>'
    g += '<rect x="-13" y="-10" width="26" height="12" fill="url(#brass)" stroke="#2e1f08" stroke-width=".9"/>'
    g += '<rect x="-15" y="-118" width="30" height="110" fill="url(#brass)" stroke="#2e1f08" stroke-width="1.1"/>'
    g += '<rect x="-16.5" y="-80" width="33" height="7" fill="#7a5520" stroke="#2e1f08" stroke-width=".7"/>'
    g += '<rect x="-11" y="-146" width="22" height="30" fill="url(#brass)" stroke="#2e1f08" stroke-width="1"/>'
    g += '<ellipse cx="0" cy="-146" rx="11" ry="3.4" fill="#1d150a"/>'
    # штрихування тіні
    for k in range(9):
        g += f'<line x1="{7 + k * .9}" y1="-114" x2="{7 + k * .9}" y2="-12" stroke="#2e1f08" stroke-width=".45" opacity=".5"/>'
    g += '</g>'
    # кронштейн від дуги до тубуса
    g += '<path d="M-14,-232 L44,-238 L48,-222 L-8,-216Z" fill="url(#brassv)" stroke="#2e1f08" stroke-width="1"/>'
    g += '</g>'
    return g


def flask(x, y, s_):
    g = f'<g transform="translate({f(x)},{f(y)}) scale({s_})">'
    sh = radgrad([(0, '#2d4a22', .35), (1, '#2d4a22', 0)], gid_=gid('sh'))
    g += f'<ellipse cx="4" cy="1" rx="74" ry="10" fill="url(#{sh})"/>'
    bodyp = 'M-15,-150 L-15,-104 L-62,-14 Q-66,0 -50,0 L50,0 Q66,0 62,-14 L15,-104 L15,-150Z'
    cid = gid('fl')
    defs.append(f'<clipPath id="{cid}"><path d="{bodyp}"/></clipPath>')
    glass = lingrad([(0, '#ffffff', .75), (.12, '#e9f4f4', .35), (.5, '#ffffff', .08), (.86, '#d6e8e8', .3), (1, '#ffffff', .7)], gid_=gid('gl'))
    liq = lingrad([(0, '#1f5a1d'), (.3, '#3f8f34'), (.55, '#6ab44f'), (.8, '#2f7a2a'), (1, '#174515')], gid_=gid('lq'))
    g += f'<path d="{bodyp}" fill="#dfeeee" opacity=".45"/>'
    level = -46
    g += f'<g clip-path="url(#{cid})"><rect x="-70" y="{level}" width="140" height="60" fill="url(#{liq})" opacity=".92"/>'
    wl = (62 - 15) * (level + 104) / (104 - 14) + 15  # півширина на рівні рідини
    g += f'<ellipse cx="0" cy="{level}" rx="{f(wl)}" ry="5" fill="#9fd27c" opacity=".9"/>'
    g += f'<ellipse cx="0" cy="{level + 1.5}" rx="{f(wl - 3)}" ry="3.2" fill="#4c9a3a" opacity=".6"/>'
    g += '</g>'
    g += f'<path d="{bodyp}" fill="url(#{glass})" stroke="#4d5f5c" stroke-width="1.5"/>'
    # горловина й вінця
    g += '<ellipse cx="0" cy="-150" rx="18" ry="4.5" fill="#f4fbfb" stroke="#4d5f5c" stroke-width="1.3"/>'
    g += '<ellipse cx="0" cy="-150" rx="12" ry="2.6" fill="#b6c9c7"/>'
    # відблиски
    g += '<path d="M-9,-142 L-9,-108 L-50,-24" fill="none" stroke="#fff" stroke-width="4" opacity=".75" stroke-linecap="round"/>'
    g += '<path d="M8,-140 L8,-112" stroke="#fff" stroke-width="2" opacity=".5" stroke-linecap="round"/>'
    g += '<path d="M44,-30 L53,-12" stroke="#fff" stroke-width="2.4" opacity=".6" stroke-linecap="round"/>'
    # поділки
    for k, yy in enumerate((-30, -62, -88)):
        hw = (62 - 15) * (yy + 104) / 90 + 15
        g += f'<line x1="{f(-hw * .35)}" y1="{yy}" x2="{f(-hw * .1)}" y2="{yy}" stroke="#4d5f5c" stroke-width="1" opacity=".7"/>'
    g += '</g>'
    return g


def mortar(x, y, s_):
    g = f'<g transform="translate({f(x)},{f(y)}) scale({s_})">'
    sh = radgrad([(0, '#3a2817', .35), (1, '#3a2817', 0)], gid_=gid('sh'))
    g += f'<ellipse cx="6" cy="2" rx="80" ry="10" fill="url(#{sh})"/>'
    por = lingrad([(0, '#a39c8c'), (.2, '#e4dfd2'), (.42, '#fbf9f3'), (.7, '#d6d0c1'), (1, '#8e877a')], gid_=gid('por'))
    inner = lingrad([(0, '#8c8576'), (.6, '#cfc8b7'), (1, '#efeadf')], 0, 0, 0, 1, gid_=gid('in'))
    # внутрішня поверхня
    g += f'<ellipse cx="0" cy="-74" rx="66" ry="15" fill="url(#{inner})" stroke="#6f6858" stroke-width="1.1"/>'
    # подрібнене листя
    rr = random.Random(9)
    for k in range(9):
        lx, ly = rr.uniform(-40, 40), -72 + rr.uniform(-4, 6)
        g += f'<ellipse cx="{f(lx)}" cy="{f(ly)}" rx="{f(rr.uniform(4, 8))}" ry="{f(rr.uniform(2, 3.4))}" transform="rotate({rr.randint(-40, 40)} {f(lx)} {f(ly)})" fill="{rr.choice(["#4f7a2e", "#6e9a3f", "#3d6324"])}"/>'
    # товкачик
    g += '<g transform="translate(14,-74) rotate(32)">'
    g += f'<path d="M-8,4 L-6,-118 Q0,-128 6,-118 L8,4 Q0,12 -8,4Z" fill="url(#{por})" stroke="#6f6858" stroke-width="1.1"/>'
    g += '<path d="M-3,-6 L-2,-110" stroke="#fff" stroke-width="2" opacity=".7" stroke-linecap="round"/>'
    g += '</g>'
    # корпус ступки
    g += f'<path d="M-66,-74 Q-66,-30 -40,-16 L-36,-6 L36,-6 L40,-16 Q66,-30 66,-74 Q0,-55 -66,-74Z" fill="url(#{por})" stroke="#6f6858" stroke-width="1.2"/>'
    g += f'<path d="M-44,-6 L44,-6 L46,0 L-46,0Z" fill="url(#{por})" stroke="#6f6858" stroke-width="1"/>'
    g += '<path d="M-60,-66 Q-58,-36 -36,-22" fill="none" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>'
    for k in range(7):
        g += f'<path d="M{44 + k * 2.4},{-62 + k * 2} Q{48 + k * 2},{-36} {34 + k * 1.2},{-18}" fill="none" stroke="#5f5848" stroke-width=".5" opacity=".45"/>'
    g += '</g>'
    return g


GROUND = 1086
add(f'<g stroke="{INK3}" stroke-width=".8" opacity=".7">' +
    ''.join(f'<line x1="{530 + k * 3}" y1="{GROUND + 6 + (k % 3) * 4}" x2="{560 + k * 3}" y2="{GROUND + 6 + (k % 3) * 4}"/>' for k in range(0, 1)) + '</g>')
add(f'<line x1="520" y1="{GROUND + 1}" x2="1000" y2="{GROUND + 1}" stroke="{INK2}" stroke-width="1.1"/>')
add(''.join(f'<line x1="{x}" y1="{GROUND + 6}" x2="{x - 10}" y2="{GROUND + 16}" stroke="{INK3}" stroke-width=".7" opacity=".7"/>' for x in range(530, 1000, 9)))
add(microscope(662, GROUND, .86))
add(flask(822, GROUND, .9))
add(mortar(940, GROUND, .84))

# ---------- ГЛЮКОЗА (проекція Хеуорса) ----------
def glucose(cx, cy, k=1.0):
    s = f'<g transform="translate({cx},{cy}) scale({k})" stroke="{INK}" fill="{INK}">'
    O = (62, -46); C1 = (100, 0); C2 = (54, 40); C3 = (-54, 40); C4 = (-100, 0); C5 = (-62, -46)

    def wedge(a, b, w0, w1):
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy)
        nx, ny = -dy / d, dx / d
        P = [(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2), (b[0] + nx * w1 / 2, b[1] + ny * w1 / 2),
             (b[0] - nx * w1 / 2, b[1] - ny * w1 / 2), (a[0] - nx * w0 / 2, a[1] - ny * w0 / 2)]
        return f'<path d="{poly_path(P)}" stroke="none"/>'

    s += f'<line x1="{C5[0]}" y1="{C5[1]}" x2="{O[0] - 14}" y2="{O[1]}" stroke-width="2"/>'
    s += f'<line x1="{O[0] + 10}" y1="{O[1] + 7}" x2="{C1[0]}" y2="{C1[1]}" stroke-width="2"/>'
    s += wedge(C1, C2, 2, 8) + wedge(C2, C3, 8, 8) + wedge(C3, C4, 8, 2) + wedge(C4, C5, 2, 2)
    s += f'<text x="{O[0]}" y="{O[1] + 9}" font-family="\'Lora\'" font-size="27" font-weight="600" text-anchor="middle" stroke="none">O</text>'
    # (атом, верх, низ, довжина вгору, довжина вниз, зсув/якір нижньої мітки)
    sub = [(C1, 'H', 'OH', 36, 36), (C2, 'H', 'OH', 26, 36), (C3, 'OH', 'H', 26, 36), (C4, 'H', 'HO', 36, 36), (C5, 'CH2OH', 'H', 32, 18)]
    FT = 'font-family="\'Lora\'" font-size="25" font-weight="500" stroke="none"'
    for (x, y), up, dn, lu, ld in sub:
        s += f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y - lu}" stroke-width="1.8"/><line x1="{x}" y1="{y}" x2="{x}" y2="{y + ld}" stroke-width="1.8"/>'
        s += f'<text x="{x}" y="{y - lu - 5}" {FT} text-anchor="middle">{chem(up, 6)}</text>'
        if (x, y) == C5:
            s += f'<text x="{x + 5}" y="{y + ld + 8}" {FT}>{dn}</text>'
        else:
            s += f'<text x="{x}" y="{y + ld + 22}" {FT} text-anchor="middle">{chem(dn, 6)}</text>'
    s += '</g>'
    return s


add(glucose(1236, 1040, .78))

# ---------- підписи таблиці ----------
num(96, 488, 1)
text(126, 497, 'Triticum aestivum <tspan font-style="normal">L.</tspan>', 28, 'Lora', 500, INK, italic=True)
text(126, 527, 'пшениця м’яка', 25, 'Lora', 500, INK2)
num(560, 488, 2)
text(588, 497, 'Листок: сітчасте жилкування', 25, 'Lora', 600, INK, maxx=1010)
text(588, 526, '(розгалужена сітка жилок)', 25, 'Lora', 500, INK2, italic=True, maxx=1010)
num(1040, 488, 3)
cy3 = IC[1] + IR + 38
text(1186, cy3, 'Поперечний зріз листка:', 25, 'Lora', 600, INK, 'middle')
text(1186, cy3 + 28, 'хлоропласти (органели фотосинтезу)', 25, 'Lora', 500, INK2, 'middle', italic=True)
text(1186, cy3 + 56, 'у мезофілі — м’якоті листка', 25, 'Lora', 500, INK2, 'middle', italic=True)
num(1052, 902, 4)
text(1080, 911, f'Глюкоза {chem("C6H12O6", 6)} —', 25, 'Lora', 600, INK, maxx=1410)
text(1080, 939, 'продукт фотосинтезу', 25, 'Lora', 500, INK2, italic=True, maxx=1410)


# =====================================================================
# ЕТИКЕТКИ «Про кафедру» і «Бакалаврат»
# =====================================================================
def card(x, y, w, h, title, no, tapes=True):
    g = lingrad([(0, '#fdf9ee'), (1, '#f5ecd5')], 0, 0, 0, 1)
    add(f'<rect x="{x + 5}" y="{y + 7}" width="{w}" height="{h}" fill="#4a3218" opacity=".12"/>')
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{g})" stroke="{INK2}" stroke-width="1.4"/>')
    add(f'<rect x="{x + 7}" y="{y + 7}" width="{w - 14}" height="{h - 14}" fill="none" stroke="{INK3}" stroke-width=".7"/>')
    if tapes:
        add(tape(x + 26, y + 6, 74, 22, -32))
        add(tape(x + w - 26, y + 6, 74, 22, 32))
    if title:
        text(x + 34, y + 58, title, 40, 'Alegreya', 700, INK)
        text(x + w - 34, y + 56, no, 26, 'Alegreya', 500, INK3, 'end', italic=True)
        add(f'<line x1="{x + 34}" y1="{y + 76}" x2="{x + w - 34}" y2="{y + 76}" stroke="{INK2}" stroke-width="1.2"/>')
        add(f'<line x1="{x + 34}" y1="{y + 81}" x2="{x + w - 34}" y2="{y + 81}" stroke="{INK3}" stroke-width=".6"/>')


def paras(x, y, maxx, P=None, lh=31, gap=13):
    for para in P:
        for k, line in enumerate(para):
            if k == 0 and '|' in line:
                head, rest = line.split('|', 1)
                line = f'<tspan font-family="\'Alegreya\'" font-weight="700" fill="{GREEN_D}">{head}</tspan>{rest}'
            text(x, y, line, 25, 'Lora', 500, INK, maxx=maxx)
            y += lh
        y += gap
    return y


CY0, CH = 1154, 490
card(60, CY0, 668, CH, 'Про кафедру', '№ 5')
paras(94, CY0 + 124, 694, [
    ['Історія.| З 1898 р. — 128 років української школи', 'фізіології рослин; одна з найстаріших', 'науково-освітніх ланок НУБіП України.'],
    ['Напрями.| Фізіологія та біохімія рослин, клітинна', 'біоінженерія, фітовірусологія (вивчає віруси', 'рослин), нанобіотехнології, біоенергетика.'],
    ['База.| Лабораторія «Біохімії та фітобіотехнології»,', 'гурток «ФІТОЛАБ», онлайн лабораторія', f'з інтерактивними моделями: <tspan font-weight="600" fill="{BLUE}">nubipfbr.online</tspan>'],
    ['Колектив.| 2 доктори й 5 кандидатів наук;', 'навчання українською та англійською.'],
])

card(752, CY0, 668, CH, 'Бакалаврат', '№ 6')
text(786, CY0 + 122, 'ОПП «Біотехнології та біоінженерія»', 30, 'Alegreya', 700, GREEN, maxx=1386)
text(786, CY0 + 152, 'ОПП — освітньо-професійна програма', 25, 'Lora', 500, INK3, italic=True, maxx=1386)
paras(786, CY0 + 192, 1386, lh=30, gap=11, P=[
    ['Спеціальність.| G21 (162) «Біотехнології', 'та біоінженерія»; 4 роки. Кафедра — випускова', '(готує випускників цієї спеціальності).'],
    ['Дисципліни.| Фізіологія рослин · Біохімія ·', 'Клітинна біоенергетика · Біологія клітини ·', 'Імунітет рослин · Біобезпека.'],
    ['Практики| з біохімії та фізіології рослин.'],
    ['Далі —| магістратура «Екологічна біотехнологія', 'та біоенергетика» і доктор філософії (PhD).'],
])


# =====================================================================
# QR-етикетки на шпильках + контакти
# =====================================================================
def pin(x, y):
    head = radgrad([(0, '#cfe0f7'), (.35, '#4f7fc0'), (.8, BLUE), (1, '#0f2b52')], .38, .32, .7)
    add(f'<ellipse cx="{x + 6}" cy="{y + 9}" rx="11" ry="6" fill="#3a2817" opacity=".22"/>')
    add(f'<circle cx="{x}" cy="{y}" r="12" fill="url(#{head})" stroke="#0f2b52" stroke-width=".8"/>')
    add(f'<ellipse cx="{x - 4}" cy="{y - 5}" rx="4" ry="2.6" fill="#fff" opacity=".75"/>')


QY = 1668
QW, QH = 296, 372
for i, (sym, ico, l1, l2) in enumerate([
        ('qr-instagram', 'ico-instagram', 'Instagram', '@plant_physio_chair'),
        ('qr-facebook', 'ico-facebook', 'Facebook', 'Ми у Facebook'),
        ('qr-nubip', 'ico-web', 'Сторінка кафедри', 'на сайті НУБіП')]):
    x = 60 + i * (QW + 12)
    card(x, QY, QW, QH, None, None, tapes=False)
    add(f'<use href="#{sym}" x="{x + 8}" y="{QY + 8}" width="280" height="280" color="#1d1408"/>')
    est = {'Instagram': 121, 'Facebook': 120, 'Сторінка кафедри': 227}[l1]
    ix = x + QW / 2 - (est + 38) / 2
    add(f'<use href="#{ico}" x="{f(ix)}" y="{QY + 301}" width="28" height="28"/>')
    text(ix + 38, QY + 324, l1, 25, 'Inter', 600, INK)
    text(x + QW / 2, QY + 354, l2, 25, 'Lora', 500, INK2, 'middle', italic=True)
    pin(x + QW / 2, QY - 4)

CX = 60 + 3 * (QW + 12)
CW = 1420 - CX
card(CX, QY, CW, QH, None, None, tapes=False)
pin(CX + CW / 2, QY - 4)
text(CX + 26, QY + 50, 'Контакти', 34, 'Alegreya', 700, INK)
add(f'<line x1="{CX + 28}" y1="{QY + 66}" x2="{CX + CW - 28}" y2="{QY + 66}" stroke="{INK2}" stroke-width="1"/>')
yy = QY + 100
for ln in ['03041, м. Київ,', 'вул. Героїв Оборони, 13,', 'навч. корпус № 4, кімн. 13']:
    text(CX + 26, yy, ln, 25, 'Lora', 500, INK, maxx=CX + CW - 18)
    yy += 30
yy += 8
for ln in ['(044) 527-89-66', '096-977-80-58', 'physiol.biochem2021@gmail.com']:
    text(CX + 26, yy, ln, 25, 'Lora', 600 if ln[0] in '(0' else 500, INK if ln[0] in '(0' else BLUE, maxx=CX + CW - 18)
    yy += 30
text(CX + CW / 2, QY + 322, 'Вступай на «Біотехнології', 27, 'Alegreya', 500, GREEN_D, 'middle', italic=True, maxx=CX + CW - 20)
text(CX + CW / 2, QY + 352, 'та біоінженерію»!', 27, 'Alegreya', 500, GREEN_D, 'middle', italic=True)

# =====================================================================
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="148mm" height="210mm" viewBox="0 0 {W} {H}">'
       f'<defs>{"".join(defs)}</defs>' + '\n'.join(body) + '</svg>')
out = pathlib.Path(__file__).with_name('v4-herbarium.svg')
out.write_text(svg, encoding='utf-8')
print('written', out, len(svg) // 1024, 'KB')
