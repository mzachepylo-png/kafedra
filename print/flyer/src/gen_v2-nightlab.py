#!/usr/bin/env python3
"""Генератор флаєра v2-nightlab («Нічна лабораторія»), A5 148×210 мм.
Запуск: python3 src/gen_v2-nightlab.py  →  src/v2-nightlab.svg
"""
import base64, io, math, pathlib, re
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
OUTFILE = HERE / "v2-nightlab.svg"
W, H = 1480, 2100

# ---------------------------------------------------------------- палітра
MINT, CYAN, AMBER = "#3CF0B4", "#45D6FF", "#FFB547"
INK = "#F3FBF8"
MUTED = "#A8C9C1"
DIM = "#6F938B"

# ---------------------------------------------------------------- вимірювання тексту
_FONTS = {}

def _load_fonts():
    from fontTools.ttLib import TTFont
    css = (HERE.parent / "kit" / "fonts.css").read_text(encoding="utf-8")
    for l in css.splitlines():
        m = re.search(r"font-family:'([^']+)';font-style:(\w+);font-weight:([\d ]+);"
                      r"src:url\(data:font/woff2;base64,([^)]+)\)", l)
        if not m:
            continue
        f = TTFont(io.BytesIO(base64.b64decode(m.group(4))))
        key = (m.group(1), m.group(2), m.group(3).split()[0])
        _FONTS.setdefault(key, []).append(
            (f.getBestCmap(), f["hmtx"].metrics, f["head"].unitsPerEm))


def measure(text, family="Inter", size=25, weight=400, style="normal", ls=0.0):
    if not _FONTS:
        _load_fonts()
    wkey = {"Inter Display": str(weight)}.get(family)
    cands = [v for k, v in _FONTS.items() if k[0] == family and k[1] == style
             and (wkey is None or k[2] == wkey)]
    faces = [f for v in cands for f in v]
    tot = 0.0
    for ch in text:
        for cmap, hm, upm in faces:
            g = cmap.get(ord(ch))
            if g:
                tot += hm[g][0] / upm * size
                break
        else:
            tot += 0.55 * size
    if family not in ("Inter Display",) and weight >= 600:
        tot *= 1.035
    elif family not in ("Inter Display",) and weight >= 500:
        tot *= 1.015
    return tot + ls * len(text)


def wrap(text, width, **kw):
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if measure(t, **kw) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")


def chem(s, size):
    """Нижні індекси через tspan із dy (у вбудованих шрифтах немає ₁)."""
    dy = round(size * 0.24, 1)
    fs = round(size * 0.66, 1)
    runs = re.findall(r"[₀-₉]+|[^₀-₉]+", s)
    out, low = [], False
    for r in runs:
        if r[0] in "₀₁₂₃₄₅₆₇₈₉":
            out.append(f'<tspan dy="{dy}" font-size="{fs}">{r.translate(SUB)}</tspan>')
            low = True
        else:
            out.append(f'<tspan dy="{-dy if low else 0}">{esc(r)}</tspan>')
            low = False
    return "".join(out)


def checkfit(name, text, width, **kw):
    w = measure(text, **kw)
    if w > width:
        print(f"  ! OVERFLOW {name}: {w:.0f} > {width:.0f}  «{text}»")
    return w


# ---------------------------------------------------------------- збирання
parts = []
P = parts.append
defs = []
D = defs.append


def lin(id_, stops, x1=0, y1=0, x2=0, y2=1, units=None, extra=""):
    u = f' gradientUnits="{units}"' if units else ""
    st = "".join(
        f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else "") + "/>"
        for o, c, a in [(s + (None,))[:3] for s in stops])
    D(f'<linearGradient id="{id_}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"{u}{extra}>{st}</linearGradient>')


def rad(id_, stops, cx=.5, cy=.5, r=.5, fx=None, fy=None, units=None, extra=""):
    u = f' gradientUnits="{units}"' if units else ""
    f = (f' fx="{fx}"' if fx is not None else "") + (f' fy="{fy}"' if fy is not None else "")
    st = "".join(
        f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else "") + "/>"
        for o, c, a in [(s + (None,))[:3] for s in stops])
    D(f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="{r}"{f}{u}{extra}>{st}</radialGradient>')


def glow(cx, cy, r, color, a=0.5, ry=None, id_=None):
    """М'яке сяйво без фільтрів: еліпс із радіальним градієнтом."""
    gid = id_ or f"gl{len(defs)}"
    rad(gid, [(0, color, a), (0.35, color, a * 0.45), (0.7, color, a * 0.12), (1, color, 0)])
    ry = ry or r
    return f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{r:.1f}" ry="{ry:.1f}" fill="url(#{gid})"/>'


# ================================================================= СТИЛІ
D("""<style>
.disp{font-family:'Inter Display';font-weight:900}
.disp8{font-family:'Inter Display';font-weight:800}
.disp7{font-family:'Inter Display';font-weight:700}
.body{font-family:'Inter';font-weight:400}
.med{font-family:'Inter';font-weight:500}
.semi{font-family:'Inter';font-weight:600}
.mono{font-family:'JetBrains Mono';font-weight:500}
.monob{font-family:'JetBrains Mono';font-weight:600}
</style>""")

# ================================================================= ФОН
lin("bg", [(0, "#040A1A"), (0.30, "#05172A"), (0.55, "#06262C"), (0.78, "#05211F"), (1, "#020C0C")])
P(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
# загальні кольорові масиви світла
P(glow(700, 860, 820, "#0E6B55", 0.55, ry=560))
P(glow(1250, 330, 520, "#123E7A", 0.45, ry=420))
P(glow(150, 1500, 520, "#0B4A44", 0.35, ry=380))

# шестикутна «молекулярна» сітка
s = 34
hh = math.sqrt(3) * s
D(f'<pattern id="hex" width="{3*s}" height="{hh:.3f}" patternUnits="userSpaceOnUse">'
  f'<path d="M0 {hh/2:.2f}L{s/2} 0H{1.5*s}L{2*s} {hh/2:.2f}L{1.5*s} {hh:.2f}H{s/2}Z'
  f'M{2*s} {hh/2:.2f}H{3*s}" fill="none" stroke="{MINT}" stroke-width="1.1"/>'
  f'<circle cx="{s/2}" cy="0" r="2.2" fill="{MINT}"/><circle cx="{1.5*s}" cy="0" r="2.2" fill="{MINT}"/>'
  f'<circle cx="{2*s}" cy="{hh/2:.2f}" r="2.2" fill="{MINT}"/><circle cx="0" cy="{hh/2:.2f}" r="2.2" fill="{MINT}"/>'
  f'</pattern>')
rad("hexfade", [(0, "#fff", 1), (0.55, "#fff", 0.55), (1, "#fff", 0)], cx=0.62, cy=0.32, r=0.72)
D(f'<mask id="hexmask" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'
  f'<rect width="{W}" height="{H}" fill="url(#hexfade)"/></mask>')
P(f'<rect width="{W}" height="1260" fill="url(#hex)" opacity="0.11" mask="url(#hexmask)"/>')

# боке
bokeh = [(140, 690, 70, MINT, .22), (980, 120, 46, CYAN, .20), (1400, 760, 90, CYAN, .14),
         (430, 520, 38, AMBER, .18), (1320, 1080, 60, MINT, .16), (60, 1060, 54, CYAN, .14),
         (860, 560, 28, MINT, .25), (1180, 1240, 40, AMBER, .12), (560, 1230, 30, CYAN, .14),
         (250, 200, 30, MINT, .10), (1440, 520, 34, AMBER, .14), (720, 470, 22, CYAN, .22)]
for i, (x, y, r, c, a) in enumerate(bokeh):
    rad(f"bk{i}", [(0, c, a), (0.72, c, a * 0.8), (0.9, c, a * 0.55), (1, c, 0)])
    P(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#bk{i})"/>')

# ================================================================= ШАПКА
P(glow(120, 115, 105, MINT, 0.35))
P(f'<circle cx="120" cy="115" r="63" fill="none" stroke="{MINT}" stroke-opacity=".55" stroke-width="2"/>')
P('<use href="#dept-logo" x="60" y="55" width="120" height="120"/>')
P('<use href="#nubip-shield" x="1330" y="54" width="90" height="123.5"/>')
uni = "Національний університет біоресурсів і природокористування України"
checkfit("uni", uni, 1100, family="Inter", size=27, weight=600)
P(f'<text x="212" y="98" class="semi" font-size="27" fill="{INK}">{esc(uni)}</text>')
abbr = "(НУБіП України)"
P(f'<text x="212" y="134" class="mono" font-size="25" fill="{MINT}">{esc(abbr)}</text>')
fac = "Факультет захисту рослин, біотехнологій та екології"
xf = 212 + measure(abbr, family="JetBrains Mono", size=25, weight=500) + 18
checkfit("fac", fac, 1305 - xf, family="Inter", size=25, weight=400)
P(f'<text x="{xf:.0f}" y="134" class="body" font-size="25" fill="{MUTED}">{esc(fac)}</text>')
lin("rule", [(0, MINT, .0), (0.12, MINT, .7), (0.6, CYAN, .35), (1, CYAN, 0)], 0, 0, 1, 0)
P(f'<rect x="60" y="200" width="1360" height="2" fill="url(#rule)"/>')

# ================================================================= ЗАГОЛОВОК
P(f'<text x="60" y="258" class="monob" font-size="27" letter-spacing="7" fill="{MINT}">КАФЕДРА</text>')
lin("titleg", [(0, "#FFFFFF"), (1, "#D8FFF0")], 0, 0, 0, 1)
lin("accg", [(0, "#7DFFD2"), (0.55, MINT), (1, "#22C7E8")], 0, 0, 1, 0)
TS = 86
for i, (t, fill) in enumerate([("фізіології,", "#FFFFFF"), ("біохімії рослин", "#FFFFFF"),
                               ("та біоенергетики", MINT)]):
    y = 338 + i * 88
    checkfit("title", t, 960, family="Inter Display", size=TS, weight=900)
    P(f'<text x="56" y="{y}" class="disp" font-size="{TS}" letter-spacing="-1.5" fill="{fill}">{esc(t)}</text>')
P(f'<text x="60" y="566" class="mono" font-size="27" fill="{MINT}" fill-opacity=".9">'
  f'<tspan fill="{AMBER}">›</tspan> від клітини до біореактора<tspan fill="{MINT}" fill-opacity=".6">_</tspan></text>')

# ================================================================= МОЛЕКУЛА (β-D-глюкоза, кульково-стрижнева)
def glucose():
    R, z0 = 1.45, 0.25
    names = ["O5", "C1", "C2", "C3", "C4", "C5"]
    A = {}
    for i, n in enumerate(names):
        th = math.radians(i * 60)
        z = z0 if i % 2 == 0 else -z0
        A[n] = np.array([R * math.cos(th), R * math.sin(th), z])
    bonds = [(names[i], names[(i + 1) % 6]) for i in range(6)]

    def eq(n, i):
        th = math.radians(i * 60)
        sgn = 1 if i % 2 == 0 else -1
        v = np.array([math.cos(th), math.sin(th), -0.33 * sgn])
        return v / np.linalg.norm(v)

    def ax(i):
        return np.array([0, 0, 1.0 if i % 2 == 0 else -1.0])

    cnt = {"H": 0, "O": 0, "C": 6}
    for i, n in enumerate(names[1:], start=1):
        if n == "C5":
            c6 = A[n] + 1.52 * eq(n, i)
            A["C6"] = c6
            bonds.append((n, "C6"))
        else:
            o = A[n] + 1.43 * eq(n, i)
            on = f"O{i}"
            A[on] = o
            bonds.append((n, on))
            # H гідроксилу
            u = (A[n] - o) / np.linalg.norm(A[n] - o)
            p = np.cross(u, np.array([0, 0, 1.0]))
            p = p / np.linalg.norm(p)
            d = u * math.cos(math.radians(109)) + p * math.sin(math.radians(109))
            hn = f"HO{i}"
            A[hn] = o + 0.96 * d
            bonds.append((on, hn))
        hn = f"H{i}"
        A[hn] = A[n] + 1.09 * ax(i)
        bonds.append((n, hn))
    # C6: O6, два H
    c6, c5 = A["C6"], A["C5"]
    u1 = (c5 - c6) / np.linalg.norm(c5 - c6)
    tmp = np.array([0, 0, 1.0])
    pp = np.cross(u1, tmp); pp /= np.linalg.norm(pp)
    d6 = u1 * math.cos(math.radians(110)) + (pp * 0.3 + tmp * 0.95) / np.linalg.norm(pp * 0.3 + tmp * 0.95) * math.sin(math.radians(110))
    d6 /= np.linalg.norm(d6)
    A["O6"] = c6 + 1.43 * d6
    bonds.append(("C6", "O6"))
    u2 = d6
    b = -(u1 + u2); b /= np.linalg.norm(b)
    n_ = np.cross(u1, u2); n_ /= np.linalg.norm(n_)
    for k, sg in enumerate((1, -1)):
        dd = b * math.cos(math.radians(54.7)) + sg * n_ * math.sin(math.radians(54.7))
        A[f"H6{k}"] = c6 + 1.09 * dd
        bonds.append(("C6", f"H6{k}"))
    uo = (c6 - A["O6"]) / np.linalg.norm(c6 - A["O6"])
    po = np.cross(uo, n_); po /= np.linalg.norm(po)
    A["HO6"] = A["O6"] + 0.96 * (uo * math.cos(math.radians(109)) + po * math.sin(math.radians(109)))
    bonds.append(("O6", "HO6"))
    return A, bonds


def rot(ax_, deg):
    a = math.radians(deg)
    c, s_ = math.cos(a), math.sin(a)
    if ax_ == "x":
        return np.array([[1, 0, 0], [0, c, -s_], [0, s_, c]])
    if ax_ == "y":
        return np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]])
    return np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])


ELEM = {"C": ("#9BA6B2", "#434B55", "#121519", 23), "O": ("#FF9A8A", "#E1352B", "#4A0707", 21.5),
        "H": ("#FFFFFF", "#D8E2EA", "#6C7A88", 13)}
for e, (hi, mid, lo, _) in ELEM.items():
    rad(f"at{e}", [(0, hi), (0.28, hi if e == "H" else mid), (0.62, mid), (0.9, lo), (1, "#0B3A35")],
        cx=0.5, cy=0.5, r=0.5, fx=0.36, fy=0.3)


def draw_molecule(cx, cy, scale, rx_, ry_, rz_):
    A, bonds = glucose()
    cen = np.mean([v for v in A.values()], axis=0)
    M = rot("x", rx_) @ rot("y", ry_) @ rot("z", rz_)
    Q = {k: M @ (v - cen) for k, v in A.items()}
    zs = [q[2] for q in Q.values()]
    zmin, zmax = min(zs), max(zs)

    def pr(q):
        f = 1 + 0.07 * q[2]
        return cx + q[0] * scale * f, cy + q[1] * scale * f, f

    def el(n):
        return n[0] if n[0] in "CO" and not n.startswith("HO") else "H"

    items = []
    for a, b in bonds:
        items.append(((Q[a][2] + Q[b][2]) / 2 - 0.35, "b", a, b))
    for n in Q:
        items.append((Q[n][2], "a", n, None))
    items.sort(key=lambda t: t[0])
    pts = [pr(q) for q in Q.values()]
    print("molecule bbox x %.0f..%.0f y %.0f..%.0f" % (min(p[0] for p in pts), max(p[0] for p in pts),
          min(p[1] for p in pts), max(p[1] for p in pts)))
    out = []
    col = {"C": "#5C6670", "O": "#C8322A", "H": "#C9D3DC"}
    for z, kind, a, b in items:
        depth = (z - zmin) / (zmax - zmin + 1e-9)
        op = 0.55 + 0.45 * depth
        if kind == "b":
            x1, y1, f1 = pr(Q[a]); x2, y2, f2 = pr(Q[b])
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            w = 8.5 * (f1 + f2) / 2
            for (xa, ya, xb, yb, n) in ((x1, y1, mx, my, a), (mx, my, x2, y2, b)):
                c = col[el(n)]
                out.append(f'<line x1="{xa:.1f}" y1="{ya:.1f}" x2="{xb:.1f}" y2="{yb:.1f}" stroke="#0A1416" '
                           f'stroke-width="{w+3:.1f}" stroke-linecap="round" opacity="{op*0.8:.2f}"/>')
                out.append(f'<line x1="{xa:.1f}" y1="{ya:.1f}" x2="{xb:.1f}" y2="{yb:.1f}" stroke="{c}" '
                           f'stroke-width="{w:.1f}" stroke-linecap="round" opacity="{op:.2f}"/>')
            dx, dy = x2 - x1, y2 - y1
            L = math.hypot(dx, dy) or 1
            nx, ny = -dy / L, dx / L
            if ny > 0: nx, ny = -nx, -ny
            out.append(f'<line x1="{x1+nx*w*0.22:.1f}" y1="{y1+ny*w*0.22:.1f}" x2="{x2+nx*w*0.22:.1f}" '
                       f'y2="{y2+ny*w*0.22:.1f}" stroke="#fff" stroke-width="{w*0.25:.1f}" '
                       f'stroke-linecap="round" opacity="{0.28*op:.2f}"/>')
        else:
            x, y, f = pr(Q[a])
            e = el(a)
            r = ELEM[e][3] * f * scale / 62
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="url(#at{e})" '
                       f'opacity="{min(1, 0.7 + 0.3*depth):.2f}"/>')
            out.append(f'<ellipse cx="{x - r*0.34:.1f}" cy="{y - r*0.4:.1f}" rx="{r*0.26:.1f}" ry="{r*0.17:.1f}" '
                       f'fill="#fff" opacity="{0.55 + 0.35*depth:.2f}" transform="rotate(-35 {x - r*0.34:.1f} {y - r*0.4:.1f})"/>')
    return "".join(out)


MOLC = (1190, 372)
P(glow(MOLC[0], MOLC[1], 240, CYAN, 0.22))
P(draw_molecule(MOLC[0], MOLC[1], 50, -58, 18, 12))

# підпис молекули
lab = "C₆H₁₂O₆ · глюкоза"
P(f'<text x="1420" y="252" text-anchor="end" class="mono" font-size="28" fill="{INK}">{chem(lab, 28)}</text>')
for k, (e, name) in enumerate((("C", "вуглець"), ("O", "кисень"), ("H", "водень"))):
    yy = 470 + k * 34
    P(f'<circle cx="{1276}" cy="{yy-8}" r="10" fill="url(#at{e})"/>')
    P(f'<text x="1294" y="{yy}" class="body" font-size="25" fill="{MUTED}"><tspan class="monob" fill="{INK}">{e}</tspan> {name}</text>')
    checkfit("legend", f"{e} {name}", 1420 - 1294 + 10, family="Inter", size=25, weight=400)

# ================================================================= ДНК
def dna(x0, x1, yc, amp, period, n_rungs):
    out = []
    om = 2 * math.pi / period
    ph2 = math.pi * 0.72
    steps = 220
    def pt(x, ph):
        return yc + amp * math.sin(om * (x - x0) + ph), math.cos(om * (x - x0) + ph)
    segs = []
    for strand, ph, c in ((0, 0, MINT), (1, ph2, CYAN)):
        for k in range(steps):
            xa = x0 + (x1 - x0) * k / steps
            xb = x0 + (x1 - x0) * (k + 1) / steps
            ya, za = pt(xa, ph); yb, zb = pt(xb, ph)
            z = (za + zb) / 2
            fade = min(1, (xa - x0) / 90, (x1 - xb) / 90)
            segs.append((z, f'<line x1="{xa:.1f}" y1="{ya:.1f}" x2="{xb:.1f}" y2="{yb:.1f}" stroke="{c}" '
                            f'stroke-width="{3.2 + 2.6*(z+1)/2:.2f}" stroke-linecap="round" '
                            f'opacity="{max(0,fade)*(0.18 + 0.55*(z+1)/2):.2f}"/>'))
    pal = [AMBER, "#B26BFF", MINT, CYAN]
    for k in range(n_rungs):
        x = x0 + 40 + (x1 - x0 - 80) * k / (n_rungs - 1)
        ya, za = pt(x, 0); yb, zb = pt(x, ph2)
        z = (za + zb) / 2
        fade = min(1, (x - x0) / 90, (x1 - x) / 90)
        ym = (ya + yb) / 2
        c1, c2 = pal[k % 4], pal[(k + 2) % 4]
        segs.append((z - 0.01, f'<line x1="{x:.1f}" y1="{ya:.1f}" x2="{x:.1f}" y2="{ym:.1f}" stroke="{c1}" '
                               f'stroke-width="3" opacity="{max(0,fade)*(0.15+0.35*(z+1)/2):.2f}"/>'
                               f'<line x1="{x:.1f}" y1="{ym:.1f}" x2="{x:.1f}" y2="{yb:.1f}" stroke="{c2}" '
                               f'stroke-width="3" opacity="{max(0,fade)*(0.15+0.35*(z+1)/2):.2f}"/>'))
        for yy, zz in ((ya, za), (yb, zb)):
            segs.append((zz + 0.01, f'<circle cx="{x:.1f}" cy="{yy:.1f}" r="{3 + 2.5*(zz+1)/2:.1f}" fill="#E9FFF8" '
                                    f'opacity="{max(0,fade)*(0.2+0.6*(zz+1)/2):.2f}"/>'))
    segs.sort(key=lambda t: t[0])
    return "".join(s_ for _, s_ in segs)


P(dna(420, 960, 640, 32, 230, 22))

# ================================================================= СТІЛ
TABLE_Y = 985      # де «починається» стільниця (затухання)
EDGE_Y = 1062      # передній край стола
lin("table", [(0, "#0B2B2C", 0), (0.25, "#0A2A2A", .85), (0.7, "#061818", 1), (1, "#030C0C", 1)])
P(f'<rect x="0" y="{TABLE_Y-30}" width="{W}" height="{EDGE_Y-TABLE_Y+30}" fill="url(#table)"/>')
lin("edge", [(0, MINT, 0), (0.25, MINT, .55), (0.6, CYAN, .45), (1, CYAN, 0)], 0, 0, 1, 0)
P(f'<rect x="0" y="{EDGE_Y-2}" width="{W}" height="2.5" fill="url(#edge)"/>')
lin("edgefront", [(0, "#020909", .9), (1, "#020909", 0)])
P(f'<rect x="0" y="{EDGE_Y+0.5}" width="{W}" height="26" fill="url(#edgefront)"/>')

# сяйва-відблиски на стільниці
P(glow(255, 1040, 230, "#2BE07A", 0.42, ry=28))
P(glow(690, 1028, 230, MINT, 0.22, ry=22))
P(glow(1190, 1022, 210, "#FFE7B0", 0.12, ry=18))

# ================================================================= СКЛЯНІ ПРЕДМЕТИ
lin("glassH", [(0, "#fff", .42), (0.1, "#fff", .08), (0.3, "#fff", 0), (0.7, "#fff", 0), (0.9, "#fff", .07), (1, "#fff", .36)],
    0, 0, 1, 0)
lin("specV", [(0, "#fff", 0), (0.12, "#fff", .75), (0.75, "#fff", .45), (1, "#fff", 0)])

LIQ = {
    "chl": ("#B9FF8A", "#3BDD5A", "#0B6E2E"),
    "car": ("#FFE08A", "#FF9A1F", "#9C3C00"),
    "ant": ("#F0A8FF", "#B24FE6", "#46106E"),
    "brd": ("#A9D2FF", "#2F74FF", "#0B2486"),
}
for k, (hi, mid, lo) in LIQ.items():
    lin(f"lq{k}", [(0, lo), (0.22, mid), (0.5, hi), (0.78, mid), (1, lo)], 0, 0, 1, 0)
    lin(f"lv{k}", [(0, "#fff", .25), (0.25, "#fff", 0), (0.8, "#000", 0), (1, "#000", .35)])


def tube(cx, top, bot, r, liq, level):
    """Пробірка: сяйво, задня стінка, рідина з меніском, бульбашки, скло, бліки."""
    hi, mid, lo = LIQ[liq]
    o = []
    o.append(glow(cx, (level + bot) / 2, r * 3.2, mid, 0.42, ry=(bot - level) * 0.85))
    path = f"M{cx-r} {top} V{bot-r} A{r} {r} 0 0 0 {cx+r} {bot-r} V{top} Z"
    o.append(f'<path d="{path}" fill="#BFEFE4" fill-opacity=".06"/>')
    ri = r - 3.5
    lp = f"M{cx-ri} {level} V{bot-r} A{ri} {ri} 0 0 0 {cx+ri} {bot-r} V{level} Z"
    o.append(f'<path d="{lp}" fill="url(#lq{liq})"/>')
    o.append(f'<path d="{lp}" fill="url(#lv{liq})"/>')
    # внутрішнє світіння
    o.append(f'<ellipse cx="{cx}" cy="{(level+bot)/2+10:.0f}" rx="{ri*0.45:.1f}" ry="{(bot-level)*0.38:.1f}" '
             f'fill="{hi}" opacity=".35"/>')
    # меніск (увігнутий): світлий еліпс + підняття біля стінок
    o.append(f'<ellipse cx="{cx}" cy="{level+2}" rx="{ri}" ry="5.5" fill="{hi}" opacity=".85"/>')
    o.append(f'<path d="M{cx-ri} {level-5} Q{cx-ri+3} {level+3} {cx-ri+10} {level+4}" stroke="#fff" '
             f'stroke-width="2" fill="none" opacity=".7"/>')
    o.append(f'<path d="M{cx+ri} {level-5} Q{cx+ri-3} {level+3} {cx+ri-10} {level+4}" stroke="#fff" '
             f'stroke-width="2" fill="none" opacity=".5"/>')
    # бульбашки
    rng = np.random.default_rng(int(cx))
    for _ in range(5):
        bx = cx + rng.uniform(-ri * 0.6, ri * 0.6)
        by = rng.uniform(level + 25, bot - r * 0.6)
        br = rng.uniform(1.8, 4.2)
        o.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{br:.1f}" fill="#fff" fill-opacity=".12" '
                 f'stroke="#fff" stroke-opacity=".6" stroke-width="1"/>')
    # скло — френелівські краї
    o.append(f'<path d="{path}" fill="url(#glassH)"/>')
    o.append(f'<path d="{path}" fill="none" stroke="#E6FFF8" stroke-opacity=".55" stroke-width="2"/>')
    # бліки
    o.append(f'<rect x="{cx-r*0.62:.1f}" y="{top+16}" width="{r*0.2:.1f}" height="{bot-top-r-30}" rx="{r*0.1:.1f}" '
             f'fill="url(#specV)"/>')
    o.append(f'<rect x="{cx+r*0.5:.1f}" y="{top+40}" width="{r*0.08:.1f}" height="{bot-top-r-80}" rx="2" '
             f'fill="url(#specV)" opacity=".55"/>')
    # вінця
    o.append(f'<ellipse cx="{cx}" cy="{top}" rx="{r+2.5}" ry="5.5" fill="#0B1E22" fill-opacity=".5" '
             f'stroke="#F2FFFB" stroke-opacity=".85" stroke-width="2.4"/>')
    return "".join(o)


# --------------------------- колба круглодонна (зліва)
FX, FBASE = 285, 1130
FR = 128
FCY = FBASE - 26 - FR
NECK_W, NECK_TOP = 30, FCY - FR - 150
rad("flaskLiq", [(0, "#F3FFD8"), (0.25, "#9CFF7C"), (0.6, "#2FD45A"), (0.88, "#0B7A33"), (1, "#05401C")],
    cx=0.5, cy=0.62, r=0.55)
rad("flaskGlass", [(0, "#fff", 0), (0.78, "#fff", 0.02), (0.93, "#E8FFF6", 0.16), (1, "#fff", 0.45)])
fl = []
fl.append(glow(FX, FCY + 20, 330, "#2BE07A", 0.5))
# шийка + куля — контур
neck = (f"M{FX-NECK_W} {NECK_TOP} V{FCY - math.sqrt(FR**2 - NECK_W**2):.1f} "
        f"A{FR} {FR} 0 1 0 {FX+NECK_W} {FCY - math.sqrt(FR**2 - NECK_W**2):.1f} V{NECK_TOP} Z")
fl.append(f'<path d="{neck}" fill="#C8FFE9" fill-opacity=".07"/>')
LEVEL = FCY - 22
half = math.sqrt(FR**2 - (LEVEL - FCY) ** 2) - 4
D(f'<clipPath id="flaskClip"><circle cx="{FX}" cy="{FCY}" r="{FR-4}"/></clipPath>')
fl.append(f'<g clip-path="url(#flaskClip)"><rect x="{FX-FR}" y="{LEVEL}" width="{2*FR}" height="{FR*2}" '
          f'fill="url(#flaskLiq)"/>'
          + glow(FX + 10, FCY + 52, 95, "#F4FFD8", 0.55, ry=60) +
          f'</g>')
fl.append(f'<ellipse cx="{FX}" cy="{LEVEL+2}" rx="{half:.1f}" ry="13" fill="#C8FF9E" opacity=".9"/>')
fl.append(f'<ellipse cx="{FX}" cy="{LEVEL-1}" rx="{half:.1f}" ry="11" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>')
rng = np.random.default_rng(7)
for _ in range(14):
    a = rng.uniform(0, 2 * math.pi); rr = rng.uniform(0, FR - 30)
    bx, by = FX + rr * math.cos(a), FCY + 20 + abs(rr * math.sin(a)) * 0.8
    if by < LEVEL + 18: continue
    br = rng.uniform(2, 5.5)
    fl.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{br:.1f}" fill="#fff" fill-opacity=".15" stroke="#fff" '
              f'stroke-opacity=".6" stroke-width="1"/>')
fl.append(f'<circle cx="{FX}" cy="{FCY}" r="{FR}" fill="url(#flaskGlass)"/>')
fl.append(f'<path d="{neck}" fill="none" stroke="#EFFFFA" stroke-opacity=".6" stroke-width="2.4"/>')
# шийка: френель
fl.append(f'<rect x="{FX-NECK_W}" y="{NECK_TOP}" width="{2*NECK_W}" height="{FCY-FR-NECK_TOP+8}" fill="url(#glassH)"/>')
fl.append(f'<rect x="{FX-NECK_W+7}" y="{NECK_TOP+14}" width="7" height="{FCY-FR-NECK_TOP-10}" rx="3.5" fill="url(#specV)"/>')
# вінця
fl.append(f'<ellipse cx="{FX}" cy="{NECK_TOP}" rx="{NECK_W+5}" ry="7" fill="#0A1C1E" fill-opacity=".6" '
          f'stroke="#F5FFFC" stroke-opacity=".9" stroke-width="3"/>')
# бліки на кулі
fl.append(f'<path d="M{FX-FR+22} {FCY-18} A{FR-22} {FR-22} 0 0 1 {FX-26} {FCY-FR+24}" fill="none" stroke="#fff" '
          f'stroke-width="9" stroke-linecap="round" opacity=".55"/>')
fl.append(f'<path d="M{FX-FR+34} {FCY+50} A{FR-30} {FR-30} 0 0 0 {FX-30} {FCY+FR-16}" fill="none" stroke="#fff" '
          f'stroke-width="3" stroke-linecap="round" opacity=".35"/>')
fl.append(f'<ellipse cx="{FX-52}" cy="{FCY-66}" rx="15" ry="9" fill="#fff" opacity=".9" transform="rotate(-40 {FX-52} {FCY-66})"/>')
fl.append(f'<path d="M{FX+FR-12} {FCY-30} A{FR-12} {FR-12} 0 0 1 {FX+FR-40} {FCY+60}" fill="none" stroke="#E9FFF5" '
          f'stroke-width="3" opacity=".45"/>')
# коркове кільце
lin("cork", [(0, "#C48A55"), (0.45, "#8B5A2E"), (1, "#3A2210")])
fl.append(f'<ellipse cx="{FX}" cy="{FBASE-10}" rx="{FR*0.72:.0f}" ry="18" fill="url(#cork)"/>')
fl.append(f'<ellipse cx="{FX}" cy="{FBASE-18}" rx="{FR*0.6:.0f}" ry="10" fill="#1E120A" opacity=".75"/>')
fl.append(f'<path d="M{FX-FR*0.72:.0f} {FBASE-10} A{FR*0.72:.0f} 18 0 0 0 {FX+FR*0.72:.0f} {FBASE-10}" fill="none" '
          f'stroke="#E9B27A" stroke-opacity=".5" stroke-width="2"/>')
FLASK = "".join(fl)

# --------------------------- штатив із пробірками (дерево)
RB = 1118          # низ штатива
RX0, RX1 = 470, 900
lin("woodF", [(0, "#7A4A26"), (0.5, "#5A3318"), (1, "#2C170A")])
lin("woodT", [(0, "#B27A47"), (1, "#7E5028")])
lin("woodPost", [(0, "#3A1F0D"), (0.35, "#7A4A26"), (0.6, "#9A6234"), (1, "#3A1F0D")], 0, 0, 1, 0)
rk = []
rk.append(glow((RX0 + RX1) / 2, RB - 160, 300, MINT, 0.18, ry=220))
# задні стійки
for px in (RX0 + 10, RX1 - 32):
    rk.append(f'<rect x="{px}" y="{RB-262}" width="22" height="240" fill="url(#woodPost)"/>')
# нижня полиця
rk.append(f'<path d="M{RX0} {RB-26} L{RX0+14} {RB-38} H{RX1-14} L{RX1} {RB-26} Z" fill="url(#woodT)"/>')
rk.append(f'<rect x="{RX0}" y="{RB-26}" width="{RX1-RX0}" height="26" rx="3" fill="url(#woodF)"/>')
tubes = [(548, "chl", 820), (643, "car", 870), (738, "ant", 845), (833, "brd", 890)]
TR = 27
TTOP, TBOT = RB - 380, RB - 34
for cx, liq, lvl in tubes:
    rk.append(tube(cx, TTOP + (cx % 3) * 6, TBOT, TR, liq, lvl + 70))
# верхня полиця (перед пробірками)
yt = RB - 250
rk.append(f'<path d="M{RX0-6} {yt} L{RX0+10} {yt-14} H{RX1-10} L{RX1+6} {yt} Z" fill="url(#woodT)"/>')
for cx, *_ in tubes:
    rk.append(f'<ellipse cx="{cx}" cy="{yt-7}" rx="{TR+4}" ry="6" fill="#2A160A"/>')
    rk.append(f'<rect x="{cx-TR}" y="{yt-20}" width="{2*TR}" height="13" fill="url(#glassH)"/>')
rk.append(f'<rect x="{RX0-6}" y="{yt}" width="{RX1-RX0+12}" height="30" rx="3" fill="url(#woodF)"/>')
for k in range(5):
    yy = yt + 6 + k * 5
    rk.append(f'<path d="M{RX0} {yy} C{RX0+120} {yy-3} {RX0+260} {yy+4} {RX1} {yy-1}" stroke="#2A1608" '
              f'stroke-opacity=".45" stroke-width="1.2" fill="none"/>')
rk.append(f'<rect x="{RX0-6}" y="{yt}" width="{RX1-RX0+12}" height="2" fill="#FFD9A8" opacity=".45"/>')
# передні стійки
for px in (RX0 - 6, RX1 - 16):
    rk.append(f'<rect x="{px}" y="{yt+30}" width="22" height="{RB-26-yt-30}" fill="url(#woodPost)"/>')
RACK = "".join(rk)

# --------------------------- піпетка (лежить спереду)
def pipette(x0, y0, x1, y1):
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
    o = [f'<g transform="translate({x0} {y0}) rotate({ang:.2f})">']
    o.append(f'<ellipse cx="{L/2:.0f}" cy="12" rx="{L/2:.0f}" ry="6" fill="#000" opacity=".45"/>')
    # тіло
    body = f"M0 0 L60 -5 H{L-20:.0f} Q{L:.0f} -5 {L:.0f} 0 Q{L:.0f} 5 {L-20:.0f} 5 H60 Z"
    o.append(f'<path d="{body}" fill="#D9FFF2" fill-opacity=".1" stroke="#EFFFFA" stroke-opacity=".7" stroke-width="1.6"/>')
    # рідина всередині біля кінчика
    o.append(f'<path d="M8 -0.6 L60 -3 H190 V3 H60 L8 0.6 Z" fill="#B24FE6"/>')
    o.append(f'<rect x="60" y="-3" width="130" height="2" fill="#F0A8FF" opacity=".7"/>')
    o.append(f'<ellipse cx="190" cy="0" rx="2" ry="3" fill="#F0A8FF"/>')
    # поділки
    for k in range(30):
        xx = 90 + k * ((L - 160) / 30)
        hgt = 5 if k % 5 == 0 else 2.6
        o.append(f'<line x1="{xx:.1f}" y1="{-hgt:.1f}" x2="{xx:.1f}" y2="0" stroke="#fff" stroke-opacity=".75" stroke-width="1.1"/>')
    o.append(f'<rect x="70" y="-3.6" width="{L-100:.0f}" height="1.6" fill="#fff" opacity=".55"/>')
    o.append('</g>')
    return "".join(o)


# --------------------------- мікроскоп
lin("metal", [(0, "#2A333C"), (0.18, "#8D9AA6"), (0.32, "#E6EEF3"), (0.45, "#9AA7B2"), (0.7, "#4E5A65"), (0.88, "#7F8C97"), (1, "#252D35")],
    0, 0, 1, 0)
lin("metalV", [(0, "#E8F0F4"), (0.2, "#A9B5BF"), (0.55, "#56626D"), (1, "#1E252C")])
lin("enamel", [(0, "#1B2229"), (0.3, "#3C4853"), (0.48, "#6E7D8A"), (0.62, "#3A4650"), (1, "#141A20")], 0, 0, 1, 0)
lin("enamelV", [(0, "#56636F"), (0.12, "#36414B"), (1, "#12171C")])
lin("chrome", [(0, "#3B4650"), (0.2, "#F4F8FA"), (0.38, "#9AA6B0"), (0.55, "#2F3942"), (0.75, "#C4CED6"), (1, "#3B4650")],
    0, 0, 1, 0)
rad("knob", [(0, "#5A6068"), (0.5, "#1C1F23"), (1, "#050607")], fx=0.35, fy=0.3)
lin("beam", [(0, "#FFF4D6", 0.0), (0.25, "#FFF4D6", .55), (1, "#FFF4D6", 0.85)])
rad("lamp", [(0, "#FFFFFF"), (0.4, "#FFF1C9"), (1, "#FFB547", 0)])


def microscope():
    o = []
    # промінь світла з лампи вгору
    o.append(glow(-40, -80, 110, "#FFE7B0", 0.35, ry=30))
    o.append(f'<path d="M-58 -80 L-52 -206 H-28 L-22 -80 Z" fill="url(#beam)" opacity=".55"/>')
    # колона/дуга (C-подібна)
    arm = ("M58 -70 C34 -160 36 -262 62 -330 C74 -362 64 -392 20 -404 L20 -470 L132 -470 "
           "C156 -360 160 -200 146 -70 Z")
    o.append(f'<path d="{arm}" fill="url(#enamel)"/>')
    o.append(f'<path d="M60 -72 C38 -160 40 -262 64 -330 C76 -362 66 -390 24 -402" fill="none" '
             f'stroke="#CFE3EE" stroke-opacity=".55" stroke-width="3"/>')
    o.append(f'<path d="M140 -460 C154 -360 156 -200 144 -76" fill="none" stroke="{MINT}" stroke-opacity=".35" stroke-width="2.5"/>')
    # основа
    base = "M-205 0 L160 0 Q172 0 170 -14 L162 -58 Q158 -68 142 -68 L-180 -68 Q-200 -68 -205 -46 Z"
    o.append(f'<path d="{base}" fill="url(#enamelV)"/>')
    o.append(f'<path d="M-188 -68 L-174 -82 H132 L146 -68 Z" fill="#6C7A86"/>')
    o.append(f'<path d="M-174 -82 H132" stroke="#E3EEF4" stroke-opacity=".7" stroke-width="2"/>')
    o.append(f'<path d="M-205 -20 H168" stroke="#000" stroke-opacity=".35" stroke-width="2"/>')
    # лампа
    o.append(f'<ellipse cx="-40" cy="-80" rx="34" ry="8" fill="#2A3138"/>')
    o.append(f'<ellipse cx="-40" cy="-81" rx="26" ry="5.5" fill="url(#lamp)"/>')
    # регулятор яскравості
    o.append(f'<circle cx="112" cy="-36" r="15" fill="url(#knob)"/>')
    o.append(f'<circle cx="112" cy="-36" r="15" fill="none" stroke="#9AA7B2" stroke-opacity=".5" stroke-width="1.5"/>')
    # конденсор
    o.append(f'<rect x="-68" y="-246" width="56" height="40" rx="5" fill="url(#chrome)"/>')
    o.append(f'<rect x="-74" y="-212" width="68" height="10" rx="3" fill="url(#metal)"/>')
    o.append(f'<path d="M-12 -228 L30 -220" stroke="#11161B" stroke-width="5" stroke-linecap="round"/>')
    # предметний столик
    o.append(f'<path d="M-180 -270 L-166 -282 H96 L104 -270 Z" fill="#7D8B97"/>')
    o.append(f'<rect x="-182" y="-270" width="290" height="22" rx="3" fill="url(#enamelV)"/>')
    o.append(f'<path d="M-180 -270 H104" stroke="#DCE8EF" stroke-opacity=".75" stroke-width="2"/>')
    # предметне скло з препаратом
    o.append(glow(-40, -286, 70, MINT, 0.45, ry=16))
    o.append(f'<path d="M-128 -283 L-122 -289 H44 L38 -283 Z" fill="#DFFFF4" fill-opacity=".35" stroke="#F4FFFB" stroke-opacity=".8" stroke-width="1.2"/>')
    o.append(f'<rect x="-128" y="-283" width="166" height="4" fill="#BFF5E4" fill-opacity=".55"/>')
    o.append(f'<ellipse cx="-40" cy="-286.5" rx="16" ry="2.6" fill="{MINT}"/>')
    o.append(f'<ellipse cx="-40" cy="-286.5" rx="7" ry="1.4" fill="#fff"/>')
    # затискачі
    for x in (-150, 50):
        o.append(f'<path d="M{x} -284 L{x+ (26 if x<0 else -26)} -287" stroke="url(#metal)" stroke-width="4" stroke-linecap="round"/>')
        o.append(f'<circle cx="{x}" cy="-283" r="5" fill="url(#chrome)"/>')
    # рукоятки фокусування
    o.append(f'<rect x="96" y="-232" width="22" height="80" fill="url(#metal)"/>')
    o.append(f'<circle cx="112" cy="-188" r="46" fill="url(#knob)"/>')
    for k in range(36):
        a = 2 * math.pi * k / 36
        o.append(f'<line x1="{112+40*math.cos(a):.1f}" y1="{-188+40*math.sin(a):.1f}" x2="{112+46*math.cos(a):.1f}" '
                 f'y2="{-188+46*math.sin(a):.1f}" stroke="#3E454D" stroke-width="2"/>')
    o.append(f'<circle cx="112" cy="-188" r="46" fill="none" stroke="#8C98A3" stroke-opacity=".55" stroke-width="1.5"/>')
    o.append(f'<path d="M78 -206 A40 40 0 0 1 120 -230" stroke="#fff" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round"/>')
    o.append(f'<circle cx="112" cy="-188" r="24" fill="url(#knob)" stroke="#9AA6B0" stroke-opacity=".6" stroke-width="1.5"/>')
    o.append(f'<circle cx="112" cy="-188" r="7" fill="url(#chrome)"/>')
    # голова
    o.append(f'<rect x="-120" y="-474" width="268" height="78" rx="18" fill="url(#enamelV)"/>')
    o.append(f'<path d="M-104 -472 H134" stroke="#E5F0F6" stroke-opacity=".7" stroke-width="2.5"/>')
    o.append(f'<rect x="-120" y="-474" width="268" height="78" rx="18" fill="none" stroke="{MINT}" stroke-opacity=".18" stroke-width="2"/>')
    o.append(f'<rect x="-112" y="-414" width="252" height="14" rx="7" fill="#000" opacity=".28"/>')
    o.append(f'<rect x="-100" y="-466" width="228" height="10" rx="5" fill="#fff" opacity=".12"/>')
    o.append(f'<rect x="-6" y="-448" width="118" height="26" rx="13" fill="#0C1217" stroke="#5E6B76" stroke-opacity=".6" stroke-width="1.2"/>')
    o.append(glow(14, -435, 26, MINT, 0.6))
    o.append(f'<circle cx="14" cy="-435" r="5" fill="{MINT}"/>')
    for k in range(5):
        o.append(f'<rect x="{34+k*14}" y="-440" width="8" height="10" rx="2" fill="{MINT}" opacity="{0.85 - k*0.17:.2f}"/>')
    o.append(f'<path d="M98 -90 C80 -170 82 -260 102 -330" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="14" stroke-linecap="round"/>')
    # призмова насадка й окуляр (нахил)
    o.append(f'<path d="M-96 -474 L-80 -508 H20 L36 -474 Z" fill="url(#enamel)"/>')
    o.append('<g transform="translate(-36 -500) rotate(-40)">')
    o.append(f'<rect x="-23" y="-150" width="46" height="150" fill="url(#metal)"/>')
    o.append(f'<rect x="-27" y="-112" width="54" height="10" fill="url(#chrome)"/>')
    o.append(f'<rect x="-29" y="-196" width="58" height="50" rx="6" fill="url(#knob)"/>')
    o.append(f'<rect x="-29" y="-196" width="58" height="50" rx="6" fill="url(#chromeDark)" opacity=".0"/>')
    o.append(f'<rect x="-22" y="-192" width="6" height="42" rx="3" fill="#fff" opacity=".25"/>')
    o.append(f'<ellipse cx="0" cy="-196" rx="29" ry="6" fill="#0B0D10" stroke="#5C656E" stroke-width="1.5"/>')
    o.append('</g>')
    # револьвер
    o.append(f'<path d="M-104 -396 H24 L12 -366 Q-40 -352 -92 -366 Z" fill="url(#chrome)"/>')
    # бічні об'єктиви
    for ang, ring, ln in ((28, "#E5392F", 62), (-30, "#2F74FF", 58)):
        o.append(f'<g transform="translate(-40 -372) rotate({ang})">')
        o.append(f'<path d="M-15 0 H15 L11 {ln} H-11 Z" fill="url(#chrome)"/>')
        o.append(f'<rect x="-15" y="16" width="30" height="7" fill="{ring}"/>')
        o.append(f'<rect x="-9" y="{ln-2}" width="18" height="6" rx="2" fill="#B8C3CC"/>')
        o.append('</g>')
    # центральний
    o.append(f'<path d="M-56 -368 H-24 L-28 -300 H-52 Z" fill="url(#chrome)"/>')
    o.append(f'<rect x="-56" y="-348" width="32" height="8" fill="#FFC531"/>')
    o.append(f'<rect x="-50" y="-304" width="20" height="8" rx="2" fill="#C9D3DB"/>')
    o.append(f'<ellipse cx="-40" cy="-296" rx="8" ry="2" fill="{MINT}" opacity=".9"/>')
    return "".join(o)


MX, MY, MS = 1175, 1110, 0.95
MICRO = f'<g transform="translate({MX} {MY}) scale({MS})">{microscope()}</g>'

# ---------- розміщення об'єктів (масштаб від точки опори)
def place(x0, y0, x1, y1, k):
    return f"translate({x1} {y1}) scale({k}) translate({-x0} {-y0})"

PL = {  # id: (стара опора, нова опора, масштаб, напівширина тіні)
    "objFlask": ((FX, FBASE), (255, 1036), 0.86, 95),
    "objRack": (((RX0 + RX1) / 2, RB), (690, 1026), 0.86, 200),
    "objMicro": ((MX, MY), (1215, 1018), 0.88, 175),
}
lin("reflfade", [(0, "#fff", .30), (1, "#fff", 0)])
D(f'<mask id="reflM" maskUnits="userSpaceOnUse" x="0" y="{TABLE_Y}" width="{W}" height="{EDGE_Y-TABLE_Y+20}">'
  f'<rect x="0" y="1000" width="{W}" height="{EDGE_Y-1000}" fill="url(#reflfade)"/></mask>')
D(f'<g id="objFlask">{FLASK}</g>')
D(f'<g id="objRack">{RACK}</g>')
D(f'<g id="objMicro">{MICRO}</g>')
refl = []
for oid, ((x0, y0), (x1, y1), k, _) in PL.items():
    refl.append(f'<use href="#{oid}" transform="translate(0 {2*y1}) scale(1 -1) {place(x0, y0, x1, y1, k)}"/>')
P(f'<g mask="url(#reflM)" opacity=".8">{"".join(refl)}</g>')
for oid, ((x0, y0), (x1, y1), k, hw) in PL.items():
    P(f'<ellipse cx="{x1}" cy="{y1}" rx="{hw}" ry="8" fill="#000" opacity=".55"/>')
for oid in ("objMicro", "objRack", "objFlask"):
    (x0, y0), (x1, y1), k, _ = PL[oid]
    P(f'<use href="#{oid}" transform="{place(x0, y0, x1, y1, k)}"/>')
P(pipette(400, 1050, 930, 1036))

# мітки-легенда реактивів
leg = [("chl", "хлорофіл"), ("car", "каротиноїди"), ("ant", "антоціани"), ("brd", "білок (реактив Бредфорда)")]

# ================================================================= ЦИФРИ
SY = 1134
stats = [("128", "років української школи", "фізіології рослин", MINT, "від 1898 р."),
         ("2 + 5", "доктори біологічних наук", "і кандидати наук", CYAN, None),
         ("23", "курси для бакалаврів", "і 4 — для магістрів", AMBER, None),
         ("7", "країн міжнародної", "співпраці", MINT, None)]
cols = [60, 392, 750, 1090]
for i, (num, l1, l2, c, tag) in enumerate(stats):
    x = cols[i]
    colw = (cols[i + 1] if i < 3 else 1440) - x
    if i:
        P(f'<rect x="{x-16:.0f}" y="{SY-58}" width="1.5" height="134" fill="{MINT}" opacity=".25"/>')
    P(f'<text x="{x:.0f}" y="{SY}" class="disp" font-size="74" fill="{c}">{esc(num)}</text>')
    if tag:
        nw = measure(num, family="Inter Display", size=74, weight=900)
        P(f'<text x="{x+nw+14:.0f}" y="{SY-4}" class="mono" font-size="25" fill="{AMBER}">{esc(tag)}</text>')
    for j, t in enumerate((l1, l2)):
        checkfit("stat", t, colw - 30, family="Inter", size=25, weight=400 if j else 500)
        P(f'<text x="{x:.0f}" y="{SY+40+j*31}" class="{"med" if j==0 else "body"}" font-size="25" '
          f'fill="{INK if j==0 else MUTED}">{esc(t)}</text>')

# ================================================================= КАРТКИ
CY0, CY1 = 1236, 1626
lin("card", [(0, "#0C2A33", .78), (1, "#071A1F", .82)])
lin("cardStroke", [(0, MINT, .55), (0.5, CYAN, .18), (1, MINT, .08)], 0, 0, 1, 1)


def card(x, y, w, h):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="url(#card)"/>'
            f'<rect x="{x+.75}" y="{y+.75}" width="{w-1.5}" height="{h-1.5}" rx="21.5" fill="none" '
            f'stroke="url(#cardStroke)" stroke-width="1.5"/>')


# --- Про кафедру
cx0, cw = 60, 664
P(card(cx0, CY0, cw, CY1 - CY0))
pad = 30
P(f'<text x="{cx0+pad}" y="{CY0+50}" class="monob" font-size="25" letter-spacing="3" fill="{MINT}">01 / ПРО КАФЕДРУ</text>')
about = [
    "Одна з найстаріших і фундаментальних науково-освітніх ланок НУБіП України.",
    "Класична школа фізіології та біохімії рослин + клітинна біоінженерія, фітовірусологія (віруси рослин), нанобіотехнології, біоенергетика.",
    "Лабораторія «Біохімії та фітобіотехнології» і студентський гурток «ФІТОЛАБ».",
    "Викладаємо українською й англійською.",
]
y = CY0 + 92
for t in about:
    lines = wrap(t, cw - 2 * pad - 26, family="Inter", size=25, weight=400)
    P(f'<rect x="{cx0+pad}" y="{y-17}" width="10" height="10" rx="2" fill="{MINT}" transform="rotate(45 {cx0+pad+5} {y-12})"/>')
    for ln in lines:
        P(f'<text x="{cx0+pad+26}" y="{y}" class="body" font-size="25" fill="{INK}">{esc(ln)}</text>')
        y += 31
    y += 15
print("about card bottom text y:", y, "card bottom", CY1)

# --- Бакалаврат
bx0, bw = 744, 676
P(card(bx0, CY0, bw, CY1 - CY0))
P(f'<text x="{bx0+pad}" y="{CY0+50}" class="monob" font-size="25" letter-spacing="3" fill="{AMBER}">02 / БАКАЛАВРАТ · 4 РОКИ</text>')
P(f'<text x="{bx0+pad}" y="{CY0+96}" class="disp8" font-size="38" fill="{INK}">ОПП «Біотехнології</text>')
P(f'<text x="{bx0+pad}" y="{CY0+136}" class="disp8" font-size="38" fill="{INK}">та біоінженерія»</text>')
checkfit("opp", "ОПП «Біотехнології", bw - 2 * pad, family="Inter Display", size=38, weight=800)
y = CY0 + 172
for t in ["ОПП — освітньо-професійна програма", "спеціальність G21 (162) · кафедра — випускова"]:
    for ln in wrap(t, bw - 2 * pad, family="Inter", size=25, weight=400):
        P(f'<text x="{bx0+pad}" y="{y}" class="body" font-size="25" fill="{MUTED}">{esc(ln)}</text>')
        y += 31
# чипи дисциплін
chips = ["Фізіологія рослин", "Біохімія", "Біобезпека", "Клітинна біоенергетика", "Імунітет рослин"]
x, y = bx0 + pad, y - 6
chip_h = 40
for t in chips:
    w = measure(t, family="Inter", size=25, weight=500) + 26
    if x + w > bx0 + bw - pad:
        x = bx0 + pad
        y += chip_h + 9
    P(f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{chip_h}" rx="20" fill="{MINT}" fill-opacity=".1" '
      f'stroke="{MINT}" stroke-opacity=".45" stroke-width="1.3"/>')
    P(f'<text x="{x+13:.0f}" y="{y+28:.0f}" class="med" font-size="25" fill="{INK}">{esc(t)}</text>')
    x += w + 9
y += chip_h + 42
P(f'<text x="{bx0+pad}" y="{y:.0f}" class="med" font-size="25" fill="{INK}">Далі — магістратура й доктор філософії (PhD)</text>')
checkfit("next", "Далі — магістратура й доктор філософії (PhD)", bw - 2 * pad, family="Inter", size=25, weight=500)
print("bach card bottom text y:", y, "card bottom", CY1)

# ================================================================= QR + КОНТАКТИ
QY = 1654
QS = 280
PW, PG = 300, 14
qrs = [("qr-instagram", "ico-instagram", "Instagram", "@plant_physio_chair"),
       ("qr-facebook", "ico-facebook", "Кафедра ФБРтаБ", "у Facebook"),
       ("qr-nubip", "ico-web", "Сторінка кафедри", "на сайті НУБіП")]
for i, (qid, ico, l1, l2) in enumerate(qrs):
    x = 60 + i * (PW + PG)
    P(glow(x + PW / 2, QY + 190, 230, MINT, 0.12))
    P(f'<rect x="{x}" y="{QY}" width="{PW}" height="372" rx="20" fill="#FFFFFF"/>')
    P(f'<rect x="{x}" y="{QY}" width="{PW}" height="372" rx="20" fill="none" stroke="{MINT}" stroke-opacity=".7" stroke-width="2"/>')
    P(f'<use href="#{qid}" x="{x+10}" y="{QY+10}" width="{QS}" height="{QS}" color="#04121A"/>')
    P(f'<use href="#{ico}" x="{x+18}" y="{QY+302}" width="28" height="28"/>')
    checkfit("qr l1", l1, PW - 70, family="Inter", size=25, weight=600)
    checkfit("qr l2", l2, PW - 36, family="Inter", size=25, weight=500)
    P(f'<text x="{x+56}" y="{QY+325}" class="semi" font-size="25" fill="#06202A">{esc(l1)}</text>')
    P(f'<text x="{x+18}" y="{QY+358}" class="med" font-size="25" fill="#0B6B55">{esc(l2)}</text>')

kx = 60 + 3 * (PW + PG) + 22
kw = 1420 - kx
P(f'<text x="{kx}" y="{QY+22}" class="monob" font-size="25" letter-spacing="3" fill="{MINT}">КОНТАКТИ</text>')
contact = [("body", INK, "03041, м. Київ,"), ("body", INK, "вул. Героїв Оборони, 13,"),
           ("body", INK, "навч. корпус № 4, кімн. 13"), (None, None, None),
           ("semi", INK, "(044) 527-89-66"), ("semi", INK, "096-977-80-58"),
           ("body", MINT, "physiol.biochem2021@gmail.com")]
y = QY + 64
for cls, col, t in contact:
    if t is None:
        y += 12; continue
    wt = {"body": 400, "semi": 600, "med": 500}[cls]
    checkfit("contact", t, kw, family="Inter", size=25, weight=wt)
    P(f'<text x="{kx}" y="{y}" class="{cls}" font-size="25" fill="{col}">{esc(t)}</text>')
    y += 33
y += 6
P(f'<rect x="{kx}" y="{y-6}" width="{kw}" height="1.5" fill="{MINT}" opacity=".3"/>')
y += 30
P(f'<text x="{kx}" y="{y}" class="monob" font-size="25" fill="{AMBER}">nubipfbr.online</text>')
y += 32
for ln in wrap("Онлайн лабораторія кафедри", kw, family="Inter", size=25):
    P(f'<text x="{kx}" y="{y}" class="body" font-size="25" fill="{MUTED}">{esc(ln)}</text>')
    y += 31
print("contacts bottom y:", y)

# ================================================================= ЗАПИС
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="148mm" height="210mm" viewBox="0 0 {W} {H}">'
       f'<defs>{"".join(defs)}</defs>' + "\n".join(parts) + "</svg>\n")
OUTFILE.write_text(svg, encoding="utf-8")
print("written", OUTFILE, len(svg) // 1024, "KB")
