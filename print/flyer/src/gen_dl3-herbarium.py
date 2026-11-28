#!/usr/bin/env python3
"""Генератор двостороннього єврофлаєра DL (99×210 мм) «Гербарій науковця»:
python3 src/gen_dl3-herbarium.py → src/dl3-herbarium-1-front.svg, src/dl3-herbarium-2-back.svg
Ботанічні малюнки (пшениця, мікроскоп, колба, ступка) — лише декор."""
import math, random, pathlib

W, H = 990, 2100

INK = '#3a2817'
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


def text(x, y, s, size, fam='Lora', w=500, fill=INK, anchor='start', italic=False, ls=0, maxx=None, extra=''):
    a = f' text-anchor="{anchor}"' if anchor != 'start' else ''
    it = ' font-style="italic"' if italic else ''
    l = f' letter-spacing="{ls}"' if ls else ''
    m = f' data-maxx="{maxx}"' if maxx is not None else ''
    add(f'<text x="{f(x)}" y="{f(y)}" font-family="\'{fam}\'" font-size="{size}" font-weight="{w}" fill="{fill}"{a}{it}{l}{m}{extra}>{s}</text>')


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


def hx(c):
    c = c.lstrip('#')
    return [int(c[i:i + 2], 16) for i in (0, 2, 4)]


def mix(a, b, t):
    A, B = hx(a), hx(b)
    t = max(0.0, min(1.0, t))
    return '#' + ''.join(f'{round(x + (y - x) * t):02x}' for x, y in zip(A, B))


def shade(c, k):
    """k<0 — темніше до чорного, k>0 — світліше до білого."""
    return mix(c, '#000000', -k) if k < 0 else mix(c, '#fffbe8', k)


def blade(p0, a0, L, Wd, bend, senesce=0.0, seed=0, flip=False, young=0.0, twist=None):
    """Лінійна пластинка злаку: складена вздовж середньої жилки, природно скручена (розворот показує світлий
    спід), паралельне жилкування, хвиляста крайка, контактна тінь, старіння кінчика."""
    rr = random.Random(seed)
    n = 60
    if twist is None:
        twist = rr.uniform(.18, .6)
    ph0 = rr.uniform(-.25, .25)
    P, A = [], []
    x, y = p0
    th = math.radians(a0)
    ds = L / n
    for k in range(n + 1):
        t = k / n
        P.append((x, y))
        A.append(th)
        th = math.radians(a0 + bend * (t ** 1.45) + 6 * math.sin(t * 5 + seed))
        x += math.cos(th) * ds
        y += math.sin(th) * ds
    top = '#6e9443'
    top = mix(top, '#a9b84e', young)
    under = mix('#a3b886', '#c2c98a', young)
    E1, E2, C, F = [], [], [], []
    for k, ((x, y), th) in enumerate(zip(P, A)):
        t = k / n
        w = 1.3 * Wd * (0.5 + 0.5 * math.sin(min(t / .18, 1) * math.pi / 2)) * (1 - t) ** 0.62 / 2
        w *= 1 + 0.035 * math.sin(t * 37 + seed)
        ph = ph0 + twist * math.pi * t ** 1.25
        c = math.cos(ph)
        F.append(c)
        nx, ny = -math.sin(th), math.cos(th)
        sgn = -1 if flip else 1
        E1.append((x + nx * w * c * sgn, y + ny * w * c * sgn))
        E2.append((x - nx * w * c * sgn, y - ny * w * c * sgn))
        C.append((x, y))
    s = '<g>'
    # контактна тінь
    sh = [(px + 3.5, py + 5) for px, py in E1] + [(px + 3.5, py + 5) for px, py in E2[::-1]]
    s += f'<path d="{poly_path(sh)}" fill="#24300f" opacity=".16"/>'
    segs = ''
    for k in range(n):
        t = (k + .5) / n
        c = (F[k] + F[k + 1]) / 2
        face = top if c >= 0 else under
        fore = abs(c)
        for half, E in ((1, E1), (-1, E2)):
            lit = (half if c >= 0 else -half) * (1 if not flip else -1)
            k_ = .2 * lit - .32 * (1 - fore) + (.06 if c < 0 else 0)
            col = shade(face, k_)
            if senesce > 0:
                st = max(0.0, (t - (1 - senesce)) / senesce) if senesce else 0
                st = min(1, st ** .7 * 1.15) * (0.85 + 0.15 * math.sin(k * 1.7 + seed))
                col = mix(col, '#c9a75c' if st < .7 else '#a8823f', st)
            quad = [C[k], C[k + 1], E[k + 1], E[k]]
            segs += f'<path d="{poly_path(quad)}" fill="{col}" stroke="{col}" stroke-width=".6" stroke-linejoin="round"/>'
    s += segs
    # паралельні жилки (різної товщини)
    for E in (E1, E2):
        for fr, wv in ((.22, .5), (.45, .7), (.68, .45), (.86, .35)):
            V = [(C[k][0] + (E[k][0] - C[k][0]) * fr, C[k][1] + (E[k][1] - C[k][1]) * fr) for k in range(n + 1)]
            s += f'<path d="{smooth_path(V)}" fill="none" stroke="#2d4519" stroke-width="{wv}" opacity=".38"/>'
            V2 = [(px + .9, py + .9) for px, py in V]
            s += f'<path d="{smooth_path(V2)}" fill="none" stroke="#f4f7d8" stroke-width="{wv * .7}" opacity=".18"/>'
    s += f'<path d="{smooth_path(C)}" fill="none" stroke="#e6edc0" stroke-width="1.5" opacity=".7"/>'
    s += f'<path d="{smooth_path(C)}" fill="none" stroke="#3a5a22" stroke-width=".5" opacity=".45" transform="translate(.8,.9)"/>'
    for E in (E1, E2):
        s += f'<path d="{smooth_path(E)}" fill="none" stroke="#2a4016" stroke-width=".75" opacity=".9"/>'
    s += '</g>'
    return s


def scale_path(l, w, asym=0.0):
    wl, wr = w * (.5 + asym), w * (.5 - asym)
    return (f'M0,0 C{f(-wl * 1.05)},{f(-l * .08)} {f(-wl * 1.1)},{f(-l * .6)} {f(-wl * .12)},{f(-l * .95)} '
            f'Q0,{f(-l * 1.03)} {f(wr * .12)},{f(-l * .95)} C{f(wr * 1.1)},{f(-l * .6)} {f(wr * 1.05)},{f(-l * .08)} 0,0Z')


def ear(bx, by, tilt, L, Wd, seed, awn=0.62):
    """Колос: колоски з окремих лусок (дві колоскові луски + квіткові луски) з тінями; остюки різної довжини й товщини."""
    rr = random.Random(seed)
    s = f'<g transform="translate({f(bx)},{f(by)}) rotate({f(tilt)})">'
    gl = lingrad([(0, '#f7e8b8'), (.35, '#e5c67f'), (.75, '#b88f45'), (1, '#86622a')], 0, 0, 1, .15)
    gm = lingrad([(0, '#efdca2'), (.45, '#d2ad62'), (1, '#93702f')], 0, 0, 1, .15)
    gd = lingrad([(0, '#c9a35a'), (.5, '#a98238'), (1, '#6f5020')], 0, 0, 1, .15)
    grain = radgrad([(0, '#fff3cc', .55), (1, '#fff3cc', 0)], .45, .55, .5)
    nps = 8
    total = 2 * nps
    items = []
    for i in range(total):
        side = 1 if i % 2 == 0 else -1
        tt = i / (total - 1)
        u = L * (0.03 + 0.84 * tt)
        sl = L * 0.27 * (1 - 0.3 * tt)
        sw = Wd * 0.62 * (1 - 0.3 * tt)
        off = side * Wd * 0.13 * (1 - 0.3 * tt)
        ang = side * (24 - 9 * tt) + rr.uniform(-3, 3)
        items.append((i, side, tt, u, sl, sw, off, ang))
    # остюки (тонкі конусні смуги різної довжини й товщини)
    aw = ''
    for i, side, tt, u, sl, sw, off, ang in items:
        for k, (dr, fl, base_w) in enumerate(((-9, .82, 1.5), (0, 1.0, 2.1), (9, .86, 1.6))):
            if k != 1 and rr.random() < .25:
                continue
            a = math.radians(ang + dr)
            tx, ty = off + math.sin(a) * sl * fl, -u - math.cos(a) * sl * fl
            al = L * awn * (0.7 + 0.5 * tt) * (1.05 if k == 1 else rr.uniform(.6, .85)) * rr.uniform(.82, 1.12)
            sp = math.radians(ang * .38 + dr * .4 + rr.uniform(-4, 4))
            bendc = rr.uniform(-.08, .08)
            pts_ = []
            for j in range(9):
                v = j / 8
                q = sp + bendc * v
                pts_.append((tx + math.sin(q) * al * v, ty - math.cos(q) * al * v))
            Lft, Rgt = [], []
            for j, (px, py) in enumerate(pts_):
                v = j / 8
                wv = base_w * rr.uniform(.85, 1.1) * (1 - v * .85) / 2
                Lft.append((px - math.cos(sp) * wv, py - math.sin(sp) * wv))
                Rgt.append((px + math.cos(sp) * wv, py + math.sin(sp) * wv))
            col = rr.choice(['#b08b45', '#a07a37', '#c29d55', '#8d6a2e', '#b99650'])
            aw += f'<path d="{poly_path(Lft + Rgt[::-1])}" fill="{col}"/>'
            if k == 1:
                aw += f'<path d="{smooth_path(Lft)}" fill="none" stroke="#f3e2ae" stroke-width=".35" opacity=".8"/>'
    s += aw
    # стрижень колосу
    s += f'<path d="M0,6 L0,{f(-L * .92)}" stroke="#6b4c1e" stroke-width="3.2"/>'
    # колоски — від верхівки донизу (нижні лежать поверх основ верхніх)
    for i, side, tt, u, sl, sw, off, ang in sorted(items, key=lambda it: -it[3]):
        g = f'<g transform="translate({f(off)},{f(-u)}) rotate({f(ang)})">'
        # тінь колоска
        g += f'<path d="{scale_path(sl * 1.02, sw * .95)}" transform="translate({f(2.5 * side + 1.5)},3)" fill="#3a2a10" opacity=".28"/>'
        # квіткові луски (задній план): бічні + центральна
        for rot, lf, wf, gg in ((-12, .9, .42, gd), (12, .9, .42, gd), (0, 1.0, .46, gm)):
            pth = scale_path(sl * lf, sw * wf, .06 if rot < 0 else -.06)
            g += f'<g transform="rotate({rot})"><path d="{pth}" fill="url(#{gg})" stroke="#6a4c1e" stroke-width=".6" stroke-opacity=".85"/>'
            g += f'<ellipse cx="0" cy="{f(-sl * lf * .45)}" rx="{f(sw * wf * .28)}" ry="{f(sl * lf * .26)}" fill="url(#{grain})"/>'
            g += f'<path d="M0,{f(-sl * lf * .12)} Q{f(sw * .03)},{f(-sl * lf * .55)} 0,{f(-sl * lf * .92)}" fill="none" stroke="#6b4c1e" stroke-width=".6" opacity=".7"/></g>'
        # колоскові луски (передній план) з кілем
        for sgn in (-1, 1):
            rot = sgn * 20
            lf, wf = .74, .4
            pth = scale_path(sl * lf, sw * wf, .1 * sgn)
            g += f'<g transform="translate({f(sgn * sw * .1)},0) rotate({rot})"><path d="{pth}" fill="url(#{gl})" stroke="#6a4c1e" stroke-width=".65" stroke-opacity=".85"/>'
            kx = sgn * sw * wf * .12
            g += f'<path d="M{f(kx)},{f(-sl * lf * .05)} Q{f(kx * 1.6)},{f(-sl * lf * .5)} 0,{f(-sl * lf * .97)}" fill="none" stroke="#6b4c1e" stroke-width=".7"/>'
            g += f'<path d="M{f(kx - 1.4)},{f(-sl * lf * .1)} Q{f(kx * 1.6 - 1.4)},{f(-sl * lf * .5)} -1,{f(-sl * lf * .9)}" fill="none" stroke="#fff6d6" stroke-width=".9" opacity=".7"/>'
            for j in (-1, 1):
                g += f'<path d="M{f(j * sw * wf * .28)},{f(-sl * lf * .12)} Q{f(j * sw * wf * .32)},{f(-sl * lf * .5)} {f(j * sw * wf * .12)},{f(-sl * lf * .82)}" fill="none" stroke="#7d5c27" stroke-width=".35" opacity=".55"/>'
            g += '</g>'
        g += '</g>'
        s += g
    # верхівковий колосок
    l, w = L * 0.17, Wd * 0.3
    s += f'<path transform="translate(0,{f(-L * .86)})" d="{scale_path(l, w)}" fill="url(#{gm})" stroke="#6a4c1e" stroke-width=".65" stroke-opacity=".85"/>'
    s += '</g>'
    return s


def stem(c, w0, w1):
    """Стебло-соломина з об'ємом: темна основа, світла смуга, тінь, тонкий блік."""
    L_, R_ = culm_poly(*c, w0, w1, n=50)
    lerp = lambda fr: [((a[0] * (1 - fr) + b[0] * fr), (a[1] * (1 - fr) + b[1] * fr)) for a, b in zip(L_, R_)]
    gst = lingrad([(0, '#d6c27c'), (.28, '#b8ad66'), (.6, '#7c9549'), (1, '#55733a')], 0, 600, 0, 1040, user=True)
    s = f'<path d="{poly_path(L_ + R_[::-1])}" fill="url(#{gst})" stroke="#3f4f22" stroke-width=".8"/>'
    s += f'<path d="{poly_path(lerp(.62) + R_[::-1])}" fill="#22300f" opacity=".28"/>'
    s += f'<path d="{poly_path(lerp(.12) + lerp(.42)[::-1])}" fill="#fffbe0" opacity=".28"/>'
    s += f'<path d="{smooth_path(lerp(.24))}" fill="none" stroke="#ffffff" stroke-width=".9" opacity=".55"/>'
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
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))


def wheat(crown, culms, leaves, basal):
    s = '<g>'
    s += roots(crown[0], crown[1] + 4, 5)
    for a0, L, Wd, bend, sen, sd in basal:
        s += blade((crown[0] + (4 if a0 > -90 else -4), crown[1] - 6), a0, L, Wd, bend, sen, sd, flip=sd % 2 == 0)
    C = [(crown, c['c1'], c['c2'], c['top']) for c in culms]
    blades_front = []
    for ci, t, side, L, Wd, bend, sen, sd in leaves:
        c = C[ci]
        p = bez(*c, t)
        d = bez_dir(c, t)
        a0 = d + side * 36
        bnd = bend if side > 0 else -bend
        blades_front.append(blade(p, a0, L, Wd, bnd, sen, sd, flip=sd % 2 == 0, young=max(0, t - .55) * 1.4))
    for c in C:
        s += stem(c, 9, 5.4)
    s += ''.join(blades_front)
    # піхви листків: циліндр + край піхви + язичок, вузли
    gsh = lingrad([(0, '#3f5a26'), (.22, '#86a35a'), (.4, '#b5c98a'), (.65, '#6f8c44'), (1, '#33491d')])
    for ci, t, side, *_ in leaves:
        c = C[ci]
        Ls, Rs = culm_poly(*c, 12, 10.6, t0=max(0, t - .17), t1=t, n=14)
        s += f'<path d="{poly_path(Ls + Rs[::-1])}" fill="url(#{gsh})" stroke="#2f4419" stroke-width=".75"/>'
        mid = [((a[0] * .55 + b[0] * .45), (a[1] * .55 + b[1] * .45)) for a, b in zip(Ls, Rs)]
        s += f'<path d="{smooth_path(mid[3:])}" fill="none" stroke="#2f4419" stroke-width=".6" opacity=".6"/>'
        x, y = bez(*c, t)
        r = bez_dir(c, t) + 90
        s += f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="7.2" ry="3.2" transform="rotate({f(r)} {f(x)} {f(y)})" fill="#55602a" stroke="#2f3a14" stroke-width=".6"/>'
        s += f'<ellipse cx="{f(x - 1.5)}" cy="{f(y - .8)}" rx="3" ry="1.1" transform="rotate({f(r)} {f(x)} {f(y)})" fill="#e8e6b0" opacity=".6"/>'
    for c, cc in zip(culms, C):
        s += ear(cc[3][0], cc[3][1], c['tilt'], c['L'], c['Wd'], c['seed'])
    for ci, t, ang in ((0, .42, -14), (1, .55, 20), (2, .5, -8)):
        x, y = bez(*C[ci], t)
        s += tape(x, y, 50, 13, ang)
    s += '</g>'
    return s


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


def pin(x, y):
    head = radgrad([(0, '#cfe0f7'), (.35, '#4f7fc0'), (.8, BLUE), (1, '#0f2b52')], .38, .32, .7)
    add(f'<ellipse cx="{x + 6}" cy="{y + 9}" rx="11" ry="6" fill="#3a2817" opacity=".22"/>')
    add(f'<circle cx="{x}" cy="{y}" r="12" fill="url(#{head})" stroke="#0f2b52" stroke-width=".8"/>')
    add(f'<ellipse cx="{x - 4}" cy="{y - 5}" rx="4" ry="2.6" fill="#fff" opacity=".75"/>')


# =====================================================================
# Спільні елементи сторінки
# =====================================================================
def new_page(seed):
    defs.clear()
    body.clear()
    rr = random.Random(seed)
    # латунь і сталь для мікроскопа (ідентифікатори, на які посилаються функції малюнків)
    lingrad([(0, '#4a3210'), (.18, '#9a7330'), (.4, '#f3da98'), (.55, '#d1a75a'), (.8, '#7a5520'), (1, '#3d290c')], gid_='brass')
    lingrad([(0, '#f0d38c'), (.5, '#b98d3f'), (1, '#5d4114')], 0, 0, 0, 1, gid_='brassv')
    lingrad([(0, '#2a2a2a'), (.35, '#8b8b85'), (.5, '#e0ded4'), (.7, '#6d6b63'), (1, '#1e1e1e')], gid_='steel')
    # пергамент
    paper = lingrad([(0, '#f6eed9'), (.45, '#f1e5c9'), (1, '#e9d8b3')], 0, 0, 0, 1)
    vign = radgrad([(0, '#fff8e6', .0), (.6, '#d8bd8a', 0), (1, '#9c7440', .32)], .5, .46, .78)
    add(f'<rect width="{W}" height="{H}" fill="url(#{paper})"/>')
    add(f'<rect width="{W}" height="{H}" fill="url(#{vign})"/>')
    fib = []
    for _ in range(380):
        x, y = rr.uniform(0, W), rr.uniform(0, H)
        a = rr.uniform(0, math.pi)
        L = rr.uniform(10, 46)
        bx, by = x + math.cos(a) * L, y + math.sin(a) * L
        mx, my = (x + bx) / 2 + rr.uniform(-6, 6), (y + by) / 2 + rr.uniform(-6, 6)
        c = rr.choice(['#8a6a45', '#a5834f', '#6e5232', '#c2a46e'])
        fib.append(f'<path d="M{f(x)},{f(y)} Q{f(mx)},{f(my)} {f(bx)},{f(by)}" stroke="{c}" stroke-width="{f(rr.uniform(.5, 1.1))}" opacity="{f(rr.uniform(.05, .14))}"/>')
    add('<g fill="none" stroke-linecap="round">' + ''.join(fib) + '</g>')
    radgrad([(0, '#8d5f2a', .38), (.55, '#a2733a', .16), (1, '#a2733a', 0)], gid_='fox')
    spots = []
    for _ in range(36):
        if rr.random() < .8:
            side = rr.choice('tblr')
            x = rr.uniform(0, W) if side in 'tb' else (rr.uniform(0, 110) if side == 'l' else rr.uniform(W - 110, W))
            y = rr.uniform(0, H) if side in 'lr' else (rr.uniform(0, 110) if side == 't' else rr.uniform(H - 110, H))
        else:
            x, y = rr.uniform(0, W), rr.uniform(0, H)
        r = rr.choice([rr.uniform(2, 6), rr.uniform(5, 13), rr.uniform(10, 26)])
        spots.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r)}" ry="{f(r * rr.uniform(.7, 1))}" fill="url(#fox)" opacity="{f(rr.uniform(.35, .9))}"/>')
    add('<g>' + ''.join(spots) + '</g>')
    # рамка
    add(f'<rect x="20" y="20" width="{W - 40}" height="{H - 40}" fill="none" stroke="{INK2}" stroke-width="2.4"/>')
    add(f'<rect x="29" y="29" width="{W - 58}" height="{H - 58}" fill="none" stroke="{INK2}" stroke-width=".9" opacity=".8"/>')
    for cx, cy, sx, sy in [(29, 29, 1, 1), (W - 29, 29, -1, 1), (29, H - 29, 1, -1), (W - 29, H - 29, -1, -1)]:
        add(f'<g transform="translate({cx},{cy}) scale({sx},{sy})" fill="none" stroke="{INK2}" stroke-width="1.1">'
            f'<path d="M0,14 Q10,10 14,0"/><circle cx="8" cy="8" r="2.4" fill="{GOLD}" stroke="none"/></g>')


def save(name):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="99mm" height="210mm" viewBox="0 0 {W} {H}">'
           f'<defs>{"".join(defs)}</defs>' + '\n'.join(body) + '</svg>')
    out = pathlib.Path(__file__).with_name(name)
    out.write_text(svg, encoding='utf-8')
    print('written', out.name, len(svg) // 1024, 'KB')


def card(x, y, w, h, title=None, no=None, tapes=True, title_size=42):
    g = lingrad([(0, '#fdf9ee'), (1, '#f5ecd5')], 0, 0, 0, 1)
    add(f'<rect x="{x + 5}" y="{y + 7}" width="{w}" height="{h}" fill="#4a3218" opacity=".12"/>')
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{g})" stroke="{INK2}" stroke-width="1.4"/>')
    add(f'<rect x="{x + 7}" y="{y + 7}" width="{w - 14}" height="{h - 14}" fill="none" stroke="{INK3}" stroke-width=".7"/>')
    if tapes:
        add(tape(x + 24, y + 6, 70, 21, -32))
        add(tape(x + w - 24, y + 6, 70, 21, 32))
    if title:
        text(x + 34, y + 62, title, title_size, 'Alegreya', 700, INK)
        if no:
            text(x + w - 34, y + 58, no, 26, 'Alegreya', 500, INK3, 'end', italic=True)


def rule(x0, x1, y):
    add(f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" stroke="{INK2}" stroke-width="1.2"/>')
    add(f'<line x1="{x0}" y1="{y + 5}" x2="{x1}" y2="{y + 5}" stroke="{INK3}" stroke-width=".6"/>')


def paras(x, y, maxx, P, lh=31, gap=12, size=25):
    for para in P:
        for k, line in enumerate(para):
            if k == 0 and '|' in line:
                head, rest = line.split('|', 1)
                line = f'<tspan font-family="\'Alegreya\'" font-weight="700" fill="{GREEN_D}">{head}</tspan>{rest}'
            text(x, y, line, size, 'Lora', 500, INK, maxx=maxx)
            y += lh
        y += gap
    return y


def medallion(cx, cy, r, sym, caption=None):
    cid = gid('med')
    defs.append(f'<clipPath id="{cid}"><circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/></clipPath>')
    add(f'<circle cx="{f(cx + 6)}" cy="{f(cy + 9)}" r="{f(r + 11)}" fill="#3a2817" opacity=".2"/>')
    add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="#e9e2cf"/>')
    add(f'<g clip-path="url(#{cid})"><use href="#{sym}" x="{f(cx - r)}" y="{f(cy - r)}" width="{f(2 * r)}" height="{f(2 * r)}"/></g>')
    ring = lingrad([(0, '#f1d58f'), (.35, '#b8893a'), (.6, '#6a4a17'), (1, '#d9b56a')], 0, 0, 1, 1)
    add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r + 5)}" fill="none" stroke="url(#{ring})" stroke-width="10"/>')
    add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r + 10.5)}" fill="none" stroke="{INK}" stroke-width="1"/>')
    add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="none" stroke="{INK}" stroke-width="1"/>')
    add(f'<path d="M{f(cx - r * .74)},{f(cy - r * .5)} A{f(r * .9)},{f(r * .9)} 0 0 1 {f(cx - r * .12)},{f(cy - r * .88)}" fill="none" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>')
    if caption:
        text(cx, cy + r + 42, caption, 25, 'Lora', 500, INK2, 'middle')


def specimen_tag(x, y, w, h, lines, ang=-3):
    g = lingrad([(0, '#fffaf0'), (1, '#f3e8cf')], 0, 0, 0, 1)
    s = f'<g transform="rotate({ang} {f(x + w / 2)} {f(y + h / 2)})">'
    s += f'<rect x="{x + 4}" y="{y + 6}" width="{w}" height="{h}" fill="#4a3218" opacity=".14"/>'
    s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{g})" stroke="{INK2}" stroke-width="1.2"/>'
    s += f'<rect x="{x + 5}" y="{y + 5}" width="{w - 10}" height="{h - 10}" fill="none" stroke="{INK3}" stroke-width=".6"/>'
    add(s)
    yy = y + 38
    for ln, sz in lines:
        text(x + w / 2, yy, ln, sz, 'Lora', 500, INK, 'middle', italic=True)
        yy += 31
    add('</g>')


# =====================================================================
# ЛИЦЬОВА СТОРОНА
# =====================================================================
new_page(1898)
add('<use href="#nubip-crest" x="52" y="56" width="152" height="160"/>')
add(f'<circle cx="858" cy="136" r="85" fill="none" stroke="{INK2}" stroke-width="1.2" opacity=".7"/>')
add('<use href="#dept-logo" x="780" y="58" width="156" height="156"/>')
for i, ln in enumerate(['НАЦІОНАЛЬНИЙ', 'УНІВЕРСИТЕТ БІОРЕСУРСІВ', 'І ПРИРОДОКОРИСТУВАННЯ', 'УКРАЇНИ <tspan letter-spacing="0.4">(НУБіП України)</tspan>']):
    text(493, 96 + i * 31, ln, 24, 'Alegreya', 700, BLUE, 'middle', ls=1.8, maxx=770)
add(f'<g stroke="{GOLD}" stroke-width="1.2"><line x1="320" y1="232" x2="478" y2="232"/><line x1="508" y1="232" x2="666" y2="232"/></g>')
add(f'<path d="M493,224 L501,232 L493,240 L485,232Z" fill="{GOLD}"/>')
text(495, 280, 'Факультет захисту рослин, біотехнологій та екології', 25, 'Lora', 500, INK2, 'middle', italic=True)

add(f'<g stroke="{GOLD}" stroke-width="1.2"><line x1="250" y1="333" x2="380" y2="333"/><line x1="610" y1="333" x2="740" y2="333"/></g>')
text(495, 343, 'КАФЕДРА', 27, 'Alegreya', 700, GOLD, 'middle', ls=9)
text(495, 414, 'Фізіології, біохімії', 64, 'Alegreya', 700, INK, 'middle')
text(495, 482, 'рослин та біоенергетики', 64, 'Alegreya', 700, INK, 'middle')
text(495, 540, 'Наука про життя рослин', 34, 'Alegreya', 500, GREEN, 'middle', italic=True)
for sx in (-1, 1):
    x0 = 495 + sx * 190
    add(f'<path d="M{x0},{530} q{sx * 30},-10 {sx * 60},0" fill="none" stroke="{GOLD}" stroke-width="1.3"/>'
        f'<circle cx="{x0 + sx * 66}" cy="530" r="3" fill="{GOLD}"/>')

# героїчна ілюстрація: пшениця (декор) + медальйони з фото
CROWN = (262, 1040)
CULMS = [
    dict(top=(258, 742), tilt=-2, L=134, Wd=50, c1=(264, 930), c2=(252, 830), seed=11),
    dict(top=(382, 790), tilt=18, L=120, Wd=46, c1=(280, 950), c2=(352, 870), seed=12),
    dict(top=(148, 810), tilt=-17, L=112, Wd=44, c1=(248, 965), c2=(168, 885), seed=13),
]
LEAVES = [
    (0, .36, -1, 215, 16, 95, 0, 21), (0, .62, 1, 205, 15, 90, 0, 22), (0, .84, -1, 160, 13, 70, 0, 23),
    (1, .45, 1, 175, 15, 95, .12, 24), (1, .78, 1, 135, 12, 65, 0, 25),
    (2, .48, -1, 165, 15, 90, .18, 26), (2, .8, -1, 120, 12, 55, 0, 27),
    (1, .2, 1, 150, 14, 110, .3, 28), (2, .22, -1, 140, 14, 110, .35, 29),
]
BASAL = [(-150, 150, 15, -60, .55, 31), (-35, 145, 15, 65, .6, 32), (-165, 115, 13, -45, .7, 33), (-15, 110, 13, 45, .7, 34)]
WS = 1.42
add(f'<g transform="translate({f(58 - 60 * WS)},{f(612 - 540 * WS)}) scale({WS})">' + wheat(CROWN, CULMS, LEAVES, BASAL) + '</g>')

MR = 124
MX = 804
for cy, sym in [(734, 'photo-fusarium'), (1032, 'photo-elodea'), (1330, 'photo-invitro')]:
    medallion(MX, cy, MR, sym)

# Про кафедру
AY, AH = 1562, 478
card(50, AY, 890, AH, 'Про кафедру', '№ 1')
rule(84, 906, AY + 80)
paras(84, AY + 128, 906, [
    ['Історія.| Одна з найстаріших і фундаментальних', 'науково-освітніх ланок НУБіП України; 128 років', 'української школи фізіології рослин (від 1898 р.).'],
    ['Напрями.| Класична школа фізіології та біохімії рослин', 'і сучасні напрями: клітинна біоінженерія, фітовірусологія,', 'нанобіотехнології, біоенергетика, моніторинг біосистем.'],
    ['Навчання| українською та англійською мовами: бакалаври,', 'магістри й доктори філософії (PhD).'],
    ['Гурток.| Студентський науковий гурток «ФІТОЛАБ».'],
])
save('dl3-herbarium-1-front.svg')

# =====================================================================
# ЗВОРОТНА СТОРОНА
# =====================================================================
new_page(2023)

# Бакалаврат
BY, BH = 56, 816
card(50, BY, 890, BH, 'Бакалаврат', None, title_size=46)
text(84, BY + 102, 'Освітньо-професійна програма', 26, 'Lora', 500, INK3, italic=True)
text(84, BY + 146, '«Біотехнології та біоінженерія»', 36, 'Alegreya', 700, GREEN, maxx=640)
# декор: мікроскоп і колба праворуч від заголовка
add(microscope(780, BY + 168, .6))
add(flask(888, BY + 168, .55))
add(f'<line x1="690" y1="{BY + 169}" x2="920" y2="{BY + 169}" stroke="{INK2}" stroke-width="1"/>')
rule(84, 906, BY + 178)
rows = [
    ('Ступінь', ['«Бакалавр», перший (бакалаврський) рівень']),
    ('Кваліфікація', ['бакалавр з біотехнологій та біоінженерії']),
    ('Галузь знань', ['16 «Хімічна та біоінженерія»']),
    ('Спеціальність', ['162 «Біотехнології та біоінженерія»;', 'нове позначення — G21']),
    ('Навчання', ['денна форма; 3 роки 10 місяців']),
    ('Вступ', ['на основі повної загальної середньої освіти']),
]
yy = BY + 216
for lab, vals in rows:
    text(84, yy, lab, 25, 'Alegreya', 700, GREEN_D)
    for k, v in enumerate(vals):
        text(282, yy + k * 30, v, 25, 'Lora', 500, INK, maxx=906)
    yy += 30 * len(vals) + 6
    add(f'<line x1="84" y1="{yy - 24}" x2="906" y2="{yy - 25}" stroke="{INK3}" stroke-width=".7" stroke-dasharray="2 4"/>')
BEND = paras(84, yy + 10, 906, [
    ['Вибіркові блоки:| «Промислова біотехнологія» і «Фітобіотехнологія».'],
    ['Обов’язкові дисципліни:| Біохімія · Біологія клітини ·', 'Фізіологія рослин · Загальна біотехнологія · Молекулярна', 'біотехнологія · Біоінженерія · Біобезпека.'],
    ['Блок «Фітобіотехнологія»:| Клітинна біоенергетика ·', 'Біологія лікарських рослин · Промислове культивування', 'грибів та водоростей.'],
    ['Практика:| три навчальні практики й виробнича практика.'],
    ['Далі —| магістратура (освітньо-професійна програма', '«Екологічна біотехнологія та біоенергетика») і PhD.'],
], lh=30, gap=9)
print('bachelor last baseline', BEND - 39, 'card bottom', BY + BH)

# Лабораторії
LY, LH_ = 912, 376
card(50, LY, 890, LH_, 'Лабораторії', None)
text(84, LY + 100, 'навчальний корпус № 4', 26, 'Lora', 500, INK3, italic=True)
medallion(806, LY + 176, 112, 'photo-callus')
yy = LY + 146
labs = [
    ('Біохімії та фітобіотехнології', 'навчально-наукова, ауд. 14',
     ['Заняття бакалаврів і магістрів, наукові', 'та кваліфікаційні роботи, біотехнологічні', 'дослідження.']),
    ('Біохімії рослин', 'навчальна, ауд. 38', None),
    ('Фізіології рослин', 'навчальна, ауд. 56', None),
]
for head, tag, ls_ in labs:
    if ls_ is None:
        text(84, yy, f'{head}<tspan font-family="\'Lora\'" font-weight="500" font-size="25" font-style="italic" fill="{INK2}"> — {tag}</tspan>',
             27, 'Alegreya', 700, GREEN_D, maxx=906)
        yy += 40
        continue
    text(84, yy, head, 27, 'Alegreya', 700, GREEN_D, maxx=690)
    yy += 30
    text(84, yy, tag, 25, 'Lora', 500, INK2, italic=True, maxx=690)
    yy += 30
    for ln in ls_:
        text(84, yy, ln, 25, 'Lora', 500, INK, maxx=690)
        yy += 30
    yy += 10
LAB_END = yy

# QR-етикетки
QY = 1334
QW, QH = 288, 344
for i, (sym, ico, l1, l2) in enumerate([
        ('qr-instagram', 'ico-instagram', 'Instagram', '@plant_physio_chair'),
        ('qr-facebook', 'ico-facebook', 'Facebook', 'Ми у Facebook'),
        ('qr-nubip', 'ico-web', 'Сторінка кафедри', 'на сайті НУБіП')]):
    x = 50 + i * (QW + 13)
    card(x, QY, QW, QH, tapes=False)
    add(f'<use href="#{sym}" x="{x + 9}" y="{QY + 9}" width="270" height="270" color="#1d1408"/>')
    est = {'Instagram': 121, 'Facebook': 120, 'Сторінка кафедри': 227}[l1]
    ix = x + QW / 2 - (est + 36) / 2
    add(f'<use href="#{ico}" x="{f(ix)}" y="{QY + 287}" width="27" height="27"/>')
    text(ix + 36, QY + 309, l1, 25, 'Inter', 600, INK)
    text(x + QW / 2, QY + 336, l2, 24, 'Lora', 500, INK2, 'middle', italic=True)
    pin(x + QW / 2, QY - 4)

# Контакти
CY_ = 1720
card(50, CY_, 890, 206, tapes=False)
pin(495, CY_ - 4)
text(84, CY_ + 50, 'Контакти', 32, 'Alegreya', 700, INK)
add(f'<line x1="84" y1="{CY_ + 66}" x2="906" y2="{CY_ + 66}" stroke="{INK2}" stroke-width="1"/>')
for k, ln in enumerate(['03041, м. Київ,', 'вул. Героїв Оборони, 13,', 'навч. корпус № 4, кімн. 13']):
    text(84, CY_ + 104 + k * 31, ln, 25, 'Lora', 500, INK, maxx=500)
text(520, CY_ + 104, '(099) 532-31-86', 25, 'Lora', 600, INK, maxx=906)
text(520, CY_ + 135, 'physiol.biochem2021@gmail.com', 25, 'Lora', 500, BLUE, maxx=906)

text(495, 1992, 'Вступай на «Біотехнології та біоінженерію»!', 30, 'Alegreya', 500, GREEN_D, 'middle', italic=True, maxx=940)
save('dl3-herbarium-2-back.svg')
