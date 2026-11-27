#!/usr/bin/env python3
"""Генератор флаєра v1-botanica («Зелена лабораторія») → src/v1-botanica.svg.

Запуск: python3 src/gen_v1-botanica.py   (далі python3 build.py v1-botanica)
Ширини текстів міряються в Chromium (Playwright) з тими самими шрифтами kit/fonts.css,
результат кешується у тимчасовому файлі — так переноси рядків точні, а текст не виходить за блоки.
"""
import json, math, os, pathlib, random, subprocess, tempfile, re

HERE = pathlib.Path(__file__).resolve().parent
KIT = HERE.parent / "kit"
OUT = HERE / "v1-botanica.svg"
CACHE = pathlib.Path(tempfile.gettempdir()) / "v1-botanica-measure.json"

# ----------------------------------------------------------------------------- вимірювання тексту
_cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
_miss = {}

MEASURE_JS = r"""
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const css = fs.readFileSync(process.argv[2], 'utf8');
  const items = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent(`<html><head><style>${css}</style></head><body><svg id="s" width="10" height="10"></svg></body></html>`);
  const res = await p.evaluate(async (items) => {
    const s = document.getElementById('s'); const ns = 'http://www.w3.org/2000/svg';
    const els = items.map(it => { const t = document.createElementNS(ns, 'text');
      t.setAttribute('font-family', `'${it.f}'`); t.setAttribute('font-weight', it.w);
      t.setAttribute('font-style', it.s); t.setAttribute('font-size', '100'); t.textContent = it.t;
      s.appendChild(t); return t; });
    await Promise.all(items.map(it => document.fonts.load(`${it.s} ${it.w} 100px '${it.f}'`, it.t)));
    await document.fonts.ready;
    return els.map(e => e.getComputedTextLength());
  }, items);
  fs.writeFileSync(process.argv[4], JSON.stringify(res)); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
"""


def _key(t, f, w, s):
    return f"{f}|{w}|{s}|{t}"


def tw(t, f="Inter", w=400, size=25, s="normal", ls=0.0):
    if t == " ":  # одиночний пробіл SVG «з’їдає» — міряємо як різницю «n n» − «nn»
        return max(tw("n n", f, w, size, s) - tw("nn", f, w, size, s), 0)
    k = _key(t, f, w, s)
    if k in _cache:
        base = _cache[k]
    else:
        _miss[k] = dict(t=t, f=f, w=str(w), s=s)
        base = len(t) * 58
    return base * size / 100 + ls * len(t)


def run_measure():
    if not _miss:
        return False
    items = list(_miss.values())
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        (d / "m.js").write_text(MEASURE_JS)
        (d / "in.json").write_text(json.dumps(items))
        subprocess.run(["node", str(d / "m.js"), str(KIT / "fonts.css"), str(d / "in.json"), str(d / "out.json")],
                       check=True, cwd=str(KIT))
        res = json.loads((d / "out.json").read_text())
    for it, r in zip(items, res):
        _cache[_key(it["t"], it["f"], it["w"], it["s"])] = r
    CACHE.write_text(json.dumps(_cache, ensure_ascii=False))
    _miss.clear()
    return True


# ----------------------------------------------------------------------------- утиліти
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def f2(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def ff(f, w, s="normal"):
    st = f' font-style="{s}"' if s != "normal" else ""
    return f"font-family=\"'{f}'\" font-weight=\"{w}\"{st}"


def text(x, y, s, f="Inter", w=400, size=25, fill="#24382b", anchor="start", ls=0, extra=""):
    a = f' text-anchor="{anchor}"' if anchor != "start" else ""
    l = f' letter-spacing="{ls}"' if ls else ""
    return f'<text x="{f2(x)}" y="{f2(y)}" {ff(f, w)} font-size="{size}" fill="{fill}"{a}{l}{extra}>{esc(s)}</text>'


# стилі для «розмітки» в тезах: **жирний**, __акцент__
STY = {
    "r": dict(f="Inter", w=400, s="normal", fill="#2a3a2f"),
    "b": dict(f="Inter", w=600, s="normal", fill="#123d26"),
    "i": dict(f="Lora", w=500, s="italic", fill="#7a5410"),
}


def parse_runs(md, base="r"):
    runs, cur = [], base
    for part in re.split(r"(\*\*|__)", md):
        if part == "**":
            cur = "b" if cur != "b" else base
        elif part == "__":
            cur = "i" if cur != "i" else base
        elif part:
            runs.append((part, cur))
    return runs


def wrap_runs(runs, maxw, size, styles=STY):
    """Розбиває змішаний текст на рядки, що не ширші за maxw. Повертає [[(слово, стиль, ширина), ...], ...]."""
    words = []  # (text, style, glue_before)
    for txt, st in runs:
        parts = re.split(r"( )", txt)
        glue = False
        for p in parts:
            if p == " ":
                glue = True
                continue
            if p == "":
                continue
            # нерозривний пробіл зберігаємо як частину слова
            words.append([p, st, glue or (words and txt.startswith(" ") and False)])
            glue = False
        # пробіл між runs
    # визначаємо, чи перед словом був пробіл, по сирому тексту
    flat = "".join(t for t, _ in runs)
    pos, out = 0, []
    for w_ in words:
        i = flat.find(w_[0], pos)
        w_[2] = i > 0 and flat[i - 1] == " "
        pos = i + len(w_[0])
    lines, line, lw = [], [], 0.0
    for t, st, sp in words:
        S = styles[st]
        ww = tw(t.replace(" ", " "), S["f"], S["w"], size, S["s"])
        spw = tw(" ", S["f"], S["w"], size, S["s"]) if (sp and line) else 0
        if line and lw + spw + ww > maxw:
            lines.append(line)
            line, lw, spw = [], 0.0, 0
        line.append((t, st, sp and bool(line)))
        lw += spw + ww
    if line:
        lines.append(line)
    return lines


def render_lines(lines, x, y, lh, size, styles=STY, extra=""):
    out = []
    for i, line in enumerate(lines):
        spans = []
        for j, (t, st, sp) in enumerate(line):
            S = styles[st]
            prefix = " " if sp else ""
            spans.append(f'<tspan {ff(S["f"], S["w"], S["s"])} fill="{S["fill"]}">{esc(prefix + t)}</tspan>')
        out.append(f'<text x="{f2(x)}" y="{f2(y + i * lh)}" font-size="{size}" xml:space="preserve"{extra}>{"".join(spans)}</text>')
    return "\n".join(out)


def line_width(line, size, styles=STY):
    w = 0
    for t, st, sp in line:
        S = styles[st]
        w += tw(t, S["f"], S["w"], size, S["s"]) + (tw(" ", S["f"], S["w"], size, S["s"]) if sp else 0)
    return w


# ----------------------------------------------------------------------------- геометрія
def catmull(points, closed=True):
    """Гладкий контур через точки (Catmull–Rom → кубічні Безьє)."""
    n = len(points)
    d = f"M{f2(points[0][0])},{f2(points[0][1])}"
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = points[(i - 1) % n] if (closed or i > 0) else points[i]
        p1 = points[i]
        p2 = points[(i + 1) % n]
        p3 = points[(i + 2) % n] if (closed or i + 2 < n) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{f2(c1[0])},{f2(c1[1])} {f2(c2[0])},{f2(c2[1])} {f2(p2[0])},{f2(p2[1])}"
    return d + ("Z" if closed else "")


DEFS = []
_uid = [0]


def uid(p="g"):
    _uid[0] += 1
    return f"{p}{_uid[0]}"


def lingrad(stops, x1=0, y1=0, x2=1, y2=0, units="objectBoundingBox", gid=None):
    gid = gid or uid("lg")
    st = "".join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a != 1 else "") + "/>"
                 for o, c, a in [(s + (1,))[:3] for s in stops])
    u = ' gradientUnits="userSpaceOnUse"' if units != "objectBoundingBox" else ""
    DEFS.append(f'<linearGradient id="{gid}" x1="{f2(x1)}" y1="{f2(y1)}" x2="{f2(x2)}" y2="{f2(y2)}"{u}>{st}</linearGradient>')
    return f"url(#{gid})"


def radgrad(stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None, units="objectBoundingBox", gid=None, tr=""):
    gid = gid or uid("rg")
    st = "".join(f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a != 1 else "") + "/>"
                 for o, c, a in [(s + (1,))[:3] for s in stops])
    u = ' gradientUnits="userSpaceOnUse"' if units != "objectBoundingBox" else ""
    fxy = (f' fx="{f2(fx)}"' if fx is not None else "") + (f' fy="{f2(fy)}"' if fy is not None else "")
    t = f' gradientTransform="{tr}"' if tr else ""
    DEFS.append(f'<radialGradient id="{gid}" cx="{f2(cx)}" cy="{f2(cy)}" r="{f2(r)}"{fxy}{u}{t}>{st}</radialGradient>')
    return f"url(#{gid})"


def shadow_ellipse(cx, cy, rx, ry, col="#3b2a12", op=0.35):
    g = radgrad([(0, col, op), (0.55, col, op * 0.45), (1, col, 0)])
    return f'<ellipse cx="{f2(cx)}" cy="{f2(cy)}" rx="{f2(rx)}" ry="{f2(ry)}" fill="{g}"/>'


# ----------------------------------------------------------------------------- листок
LEAF_PALETTES = {
    "deep": ("#1f5a2c", "#2f7a38", "#5c9e45", "#0f3a1c", "#9cc77a"),
    "mid": ("#2c7a35", "#3f9442", "#7cbf52", "#15502a", "#c4e39a"),
    "light": ("#4f9a3a", "#6fb64a", "#a9d669", "#2a6a2c", "#e2f3b8"),
    "lime": ("#7fb84a", "#9dd05c", "#d3ec8e", "#4e8a32", "#f3fbd4"),
    "olive": ("#4d7a2a", "#6c9a3a", "#a8c766", "#2f5419", "#dcebb0"),
}


def leaf(x, y, L, W, ang, pal="mid", bend=0.12, asym=0.08, veins=7, shape=0.75, flip=False, hl=0.28, opacity=1.0):
    """Реалістичний листок: дві половинки різного тону (згин уздовж жилки), градієнт основа→верхівка,
    центральна й бічні жилки, блік. (x,y) — основа листка, ang — напрям (градуси SVG)."""
    base, mid, tip, edge, vein = LEAF_PALETTES[pal]
    sgn = -1 if flip else 1
    N = 22

    def mid_pt(t):  # квадратична крива середньої жилки
        c = (L * 0.5, -bend * L * sgn)
        return ((1 - t) ** 2 * 0 + 2 * (1 - t) * t * c[0] + t * t * L,
                (1 - t) ** 2 * 0 + 2 * (1 - t) * t * c[1] + t * t * 0)

    def normal(t):
        c = (L * 0.5, -bend * L * sgn)
        dx = 2 * (1 - t) * c[0] + 2 * t * (L - c[0])
        dy = 2 * (1 - t) * c[1] + 2 * t * (0 - c[1])
        n = math.hypot(dx, dy)
        return (dy / n, -dx / n)  # «вгору» в локальних координатах

    def hw(t):
        return W * (math.sin(math.pi * (t ** shape))) ** 0.9

    ts = [i / N for i in range(N + 1)]
    up = []
    lo = []
    for t in ts:
        m = mid_pt(t)
        n = normal(t)
        wu = hw(t) * (1 + asym)
        wl = hw(t) * (1 - asym)
        up.append((m[0] + n[0] * wu, m[1] + n[1] * wu))
        lo.append((m[0] - n[0] * wl, m[1] - n[1] * wl))
    midline = [mid_pt(t) for t in ts]
    full = catmull(up[:-1] + [up[-1]] + lo[::-1][1:-1], closed=True)
    half_up = catmull(up + midline[::-1][1:-1], closed=True)
    half_lo = catmull(lo + midline[::-1][1:-1], closed=True)
    g1 = lingrad([(0, base), (0.45, mid), (1, tip)], 0, 0, L, 0, units="user")
    g2 = lingrad([(0, edge), (0.5, base), (1, mid)], 0, 0, L, 0, units="user")
    cid = uid("lc")
    DEFS.append(f'<clipPath id="{cid}"><path d="{full}"/></clipPath>')
    hlg = radgrad([(0, "#ffffff", hl), (1, "#ffffff", 0)])
    sh = radgrad([(0, "#0b2a12", 0), (0.7, "#0b2a12", 0), (1, "#0b2a12", 0.35)])
    parts = [f'<g transform="translate({f2(x)},{f2(y)}) rotate({f2(ang)})" opacity="{opacity}">']
    parts.append(f'<path d="{half_up}" fill="{g1}"/>')
    parts.append(f'<path d="{half_lo}" fill="{g2}"/>')
    # затінення країв + блік
    parts.append(f'<g clip-path="url(#{cid})">')
    parts.append(f'<ellipse cx="{f2(L*0.5)}" cy="0" rx="{f2(L*0.62)}" ry="{f2(W*1.25)}" fill="{sh}"/>')
    hp = mid_pt(0.42)
    nn = normal(0.42)
    parts.append(f'<ellipse cx="{f2(hp[0]+nn[0]*W*0.45)}" cy="{f2(hp[1]+nn[1]*W*0.45)}" rx="{f2(L*0.3)}" ry="{f2(W*0.42)}" '
                 f'fill="{hlg}" transform="rotate({f2(-sgn*bend*40)} {f2(hp[0])} {f2(hp[1])})"/>')
    # бічні жилки
    for k in range(1, veins + 1):
        t0 = 0.06 + 0.84 * k / (veins + 1)
        for side in (1, -1):
            m0 = mid_pt(t0)
            t1 = min(t0 + 0.16, 0.985)
            m1 = mid_pt(t1)
            n1 = normal(t1)
            frac = 0.86
            wv = hw(t1) * (1 + asym * side) * frac
            e = (m1[0] + side * n1[0] * wv, m1[1] + side * n1[1] * wv)
            mc = mid_pt(t0 + 0.035)
            nc = normal(t0 + 0.035)
            c = (mc[0] + side * nc[0] * hw(t0) * 0.55, mc[1] + side * nc[1] * hw(t0) * 0.55)
            sw = 2.3 * (1 - t0 * 0.6) * (W / 70)
            op = 0.55 if side == 1 else 0.38
            parts.append(f'<path d="M{f2(m0[0])},{f2(m0[1])} Q{f2(c[0])},{f2(c[1])} {f2(e[0])},{f2(e[1])}" '
                         f'fill="none" stroke="{vein}" stroke-opacity="{op}" stroke-width="{f2(max(sw,0.9))}" stroke-linecap="round"/>')
    parts.append("</g>")
    # центральна жилка (звужується)
    rib_u, rib_l = [], []
    for t in ts:
        m = mid_pt(t)
        n = normal(t)
        r = (W / 70) * (3.2 * (1 - t) + 0.4)
        rib_u.append((m[0] + n[0] * r, m[1] + n[1] * r))
        rib_l.append((m[0] - n[0] * r, m[1] - n[1] * r))
    rib = catmull(rib_u + rib_l[::-1], closed=True)
    parts.append(f'<path d="{rib}" fill="{vein}" fill-opacity="0.78"/>')
    parts.append(f'<path d="{full}" fill="none" stroke="{edge}" stroke-opacity="0.55" stroke-width="1.6"/>')
    parts.append("</g>")
    return "\n".join(parts)


def stem(p0, c1, c2, p1, w0=9, w1=4, col1="#5c8f36", col2="#9cc865"):
    """Черешок/стебло зі звуженням і бліком."""
    def bez(t):
        return tuple((1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * c1[i] + 3 * (1 - t) * t * t * c2[i] + t ** 3 * p1[i]
                     for i in range(2))
    N = 16
    pts = [bez(i / N) for i in range(N + 1)]
    L, R, Hh = [], [], []
    for i, p in enumerate(pts):
        q = pts[min(i + 1, N)]
        o = pts[max(i - 1, 0)]
        dx, dy = q[0] - o[0], q[1] - o[1]
        n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        w = (w0 + (w1 - w0) * i / N) / 2
        L.append((p[0] + nx * w, p[1] + ny * w))
        R.append((p[0] - nx * w, p[1] - ny * w))
        Hh.append((p[0] + nx * w * 0.35, p[1] + ny * w * 0.35))
    body = catmull(L + R[::-1], closed=True)
    hl = "M" + " L".join(f"{f2(a)},{f2(b)}" for a, b in Hh)
    return (f'<path d="{body}" fill="{col1}"/>'
            f'<path d="{hl}" fill="none" stroke="{col2}" stroke-width="{f2(max(w1*0.45,1.2))}" stroke-linecap="round" opacity="0.8"/>')


# ----------------------------------------------------------------------------- іконки
def leaf_bullet(x, y, s=1.0, col="#3f9442"):
    return (f'<g transform="translate({f2(x)},{f2(y)}) scale({s}) rotate(-35)">'
            f'<path d="M-11,0 C-6,-9 6,-9 11,0 C6,9 -6,9 -11,0Z" fill="{col}"/>'
            f'<path d="M-10,0 L10,0" stroke="#e6f4c9" stroke-width="1.4" opacity="0.9"/></g>')


def icon_sprout(cx, cy, r=34):
    g = radgrad([(0, "#2f7a38"), (1, "#123d26")])
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{g}"/>'
            f'<g transform="translate({cx},{cy})" fill="none" stroke-linecap="round">'
            f'<path d="M0,18 L0,-4" stroke="#e9f6cf" stroke-width="3.2"/>'
            f'<path d="M0,-2 C-4,-16 -16,-18 -20,-14 C-17,-4 -8,-1 0,-2Z" fill="#a9d669" stroke="none"/>'
            f'<path d="M0,4 C5,-12 17,-14 21,-9 C17,1 8,4 0,4Z" fill="#d3ec8e" stroke="none"/>'
            f'<path d="M-9,18 L9,18" stroke="#f2c14e" stroke-width="3"/></g>')


def icon_cap(cx, cy, r=34):
    g = radgrad([(0, "#2f7a38"), (1, "#123d26")])
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{g}"/>'
            f'<g transform="translate({cx},{cy+2})">'
            f'<path d="M-22,-6 L0,-16 L22,-6 L0,4Z" fill="#e9f6cf"/>'
            f'<path d="M-13,-1 L-13,9 C-6,14 6,14 13,9 L13,-1 L0,5Z" fill="#a9d669"/>'
            f'<path d="M18,-4 L18,10" stroke="#f2c14e" stroke-width="2.6" stroke-linecap="round"/>'
            f'<circle cx="18" cy="12" r="3" fill="#f2c14e"/></g>')


# ----------------------------------------------------------------------------- макет
W_, H_ = 1480, 2100
M = 60
C = dict(forest="#123d26", forest2="#1e5a36", leaf="#3f9442", gold="#e0a52a", gold2="#f2c14e",
         amber="#9a6512", ink="#1c2e22", body="#2a3a2f", cream="#fbf7ee")


def build():
    DEFS.clear()
    _uid[0] = 0
    random.seed(7)
    S = []  # шари
    A = S.append

    # ---------- папір
    A(f'<rect width="{W_}" height="{H_}" fill="{lingrad([(0, "#fbf8ef"), (0.55, "#f7f1e2"), (1, "#f1e8d3")], 0, 0, 0, 1)}"/>')
    # теплий сонячний ореол праворуч угорі та зеленкуватий — ліворуч унизу
    A(f'<rect width="{W_}" height="{H_}" fill="{radgrad([(0, "#ffe6a0", 0.95), (0.35, "#ffeab8", 0.45), (1, "#fff3d6", 0)], 1, 0, 0.75)}"/>')
    A(f'<rect width="{W_}" height="{H_}" fill="{radgrad([(0, "#cfe3b4", 0.55), (1, "#e8efd4", 0)], 0, 0.62, 0.55)}"/>')
    # дрібна фактура паперу (векторний патерн)
    pid = "paper-grain"
    dots = []
    for _ in range(140):
        dots.append(f'<circle cx="{random.uniform(0,180):.1f}" cy="{random.uniform(0,180):.1f}" r="{random.uniform(0.5,1.5):.2f}" '
                    f'fill="{random.choice(["#7d6a45", "#a08a5c", "#5d6b44"])}" opacity="{random.uniform(0.05,0.16):.2f}"/>')
    for _ in range(18):
        x0, y0 = random.uniform(0, 180), random.uniform(0, 180)
        a = random.uniform(0, math.pi)
        l = random.uniform(5, 14)
        dots.append(f'<path d="M{x0:.1f},{y0:.1f} l{l*math.cos(a):.1f},{l*math.sin(a):.1f}" stroke="#8b7a55" stroke-width="0.6" opacity="0.12"/>')
    DEFS.append(f'<pattern id="{pid}" width="180" height="180" patternUnits="userSpaceOnUse">{"".join(dots)}</pattern>')
    A(f'<rect width="{W_}" height="{H_}" fill="url(#{pid})"/>')

    # ---------- сонячні промені з правого верхнього кута
    sun = (1530, -60)
    rays = []
    for i, (ang, wdt, op) in enumerate([(118, 3.5, 0.55), (126, 2.2, 0.4), (133, 4.5, 0.5), (141, 2.5, 0.35),
                                         (148, 3.8, 0.45), (156, 2.0, 0.3), (163, 3.0, 0.3), (110, 2.4, 0.4)]):
        L = 1350
        a1, a2 = math.radians(ang - wdt / 2), math.radians(ang + wdt / 2)
        p1 = (sun[0] + L * math.cos(a1), sun[1] + L * math.sin(a1))
        p2 = (sun[0] + L * math.cos(a2), sun[1] + L * math.sin(a2))
        ex = (sun[0] + L * math.cos(math.radians(ang)), sun[1] + L * math.sin(math.radians(ang)))
        g = lingrad([(0, "#ffd36b", op), (0.55, "#ffe2a0", op * 0.35), (1, "#fff0c8", 0)],
                    sun[0], sun[1], ex[0], ex[1], units="user")
        rays.append(f'<path d="M{sun[0]},{sun[1]} L{f2(p1[0])},{f2(p1[1])} L{f2(p2[0])},{f2(p2[1])}Z" fill="{g}"/>')
    A('<g opacity="0.75">' + "".join(rays) + "</g>")
    A(f'<circle cx="{sun[0]}" cy="{sun[1]}" r="330" fill="{radgrad([(0, "#fff7d6", 1), (0.35, "#ffe08a", 0.7), (1, "#ffd36b", 0)])}"/>')

    # ---------- шапка
    lg = 176
    A(f'<circle cx="{M+lg/2+3}" cy="{56+lg/2+6}" r="{lg/2+4}" fill="{radgrad([(0.8, "#2a3a1a", 0.25), (1, "#2a3a1a", 0)])}"/>')
    A(f'<use href="#dept-logo" x="{M}" y="56" width="{lg}" height="{lg}"/>')
    cw = 166
    ch = cw / 0.95
    A(f'<use href="#nubip-crest" x="{W_-M-cw}" y="52" width="{cw}" height="{f2(ch)}"/>')
    hx = M + lg + 34
    A(text(hx, 104, "Національний університет біоресурсів", "Inter", 600, 29, C["forest"]))
    A(text(hx, 142, "і природокористування України (НУБіП України)", "Inter", 600, 29, C["forest"]))
    A(f'<rect x="{hx}" y="164" width="64" height="4" rx="2" fill="{C["gold"]}"/>')
    A(text(hx, 208, "Факультет захисту рослин, біотехнологій та екології", "Lora", 500, 28, C["amber"], extra=' font-style="italic"'))

    # ---------- назва
    ty = 306
    A(text(M, ty, "КАФЕДРА", "Inter Display", 800, 40, C["leaf"], ls=7))
    tsz = 100
    lines = ["фізіології,", "біохімії рослин", "та біоенергетики"]
    for i, l in enumerate(lines):
        A(text(M - 4, ty + 98 + i * 100, l, "Inter Display", 900, tsz, C["forest"], ls=-2))
    title_w = max(tw(l, "Inter Display", 900, tsz, ls=-2) for l in lines)
    tag_y = ty + 98 + 2 * 100 + 66
    A(text(M, tag_y, "Наука про життя рослин", "Lora", 500, 40, C["amber"], extra=' font-style="italic"'))
    tag_w = tw("Наука про життя рослин", "Lora", 500, 40, "italic")
    A(f'<path d="M{f2(M+tag_w+22)},{tag_y-13} L{f2(M+tag_w+120)},{tag_y-13}" stroke="{C["gold"]}" stroke-width="3" stroke-linecap="round"/>')
    A(f'<circle cx="{f2(M+tag_w+128)}" cy="{tag_y-13}" r="5" fill="{C["gold"]}"/>')

    # ---------- героїчна ілюстрація
    ground = 1118
    # спільна м’яка тінь «поверхні»
    A(shadow_ellipse(930, 1038, 520, 40, "#6b5a2a", 0.22))

    # --- рослина в горщику
    A('<g transform="translate(1192,1030) scale(0.82) translate(-1192,-1110)">')
    px, rim_y = 1192, 890
    rim_rx, rim_ry, rim_h = 166, 28, 56
    body_top_rx, bot_rx, bot_y = 150, 114, 1104
    A(shadow_ellipse(px - 40, bot_y + 8, 230, 30, "#3a2410", 0.45))
    A(shadow_ellipse(px - 10, bot_y + 2, 140, 14, "#2a1808", 0.55))

    # горщик: обідок + тіло (циліндр-конус) з глянцем
    pot_body = (f"M{px-body_top_rx},{rim_y+rim_h} L{px-bot_rx},{bot_y-6} "
                f"A{bot_rx},{20} 0 0 0 {px+bot_rx},{bot_y-6} L{px+body_top_rx},{rim_y+rim_h} "
                f"A{body_top_rx},{rim_ry-4} 0 0 1 {px-body_top_rx},{rim_y+rim_h}Z")
    terra = lingrad([(0, "#6a2711"), (0.12, "#93391a"), (0.3, "#c9653a"), (0.42, "#e48e5d"), (0.5, "#d67546"),
                     (0.72, "#a9471f"), (0.9, "#7c2f14"), (1, "#5c210d")], px - body_top_rx, 0, px + body_top_rx, 0, units="user")
    A(f'<path d="{pot_body}" fill="{terra}"/>')
    # вертикальне затінення до низу
    A(f'<path d="{pot_body}" fill="{lingrad([(0, "#3a1406", 0.0), (0.7, "#3a1406", 0.1), (1, "#2a0e04", 0.45)], 0, 0, 0, 1)}"/>')
    # тінь від обідка на тілі
    A(f'<path d="M{px-body_top_rx},{rim_y+rim_h} A{body_top_rx},{rim_ry-4} 0 0 0 {px+body_top_rx},{rim_y+rim_h} '
      f'L{px+body_top_rx-3},{rim_y+rim_h+22} A{body_top_rx-3},{rim_ry} 0 0 1 {px-body_top_rx+3},{rim_y+rim_h+22}Z" '
      f'fill="{lingrad([(0, "#2a0e04", 0.5), (1, "#2a0e04", 0)], 0, 0, 0, 1)}"/>')
    # блік (глазур)
    A(f'<path d="M{px-78},{rim_y+rim_h+30} C{px-86},{rim_y+130} {px-80},{bot_y-60} {px-66},{bot_y-26} '
      f'L{px-52},{bot_y-28} C{px-62},{bot_y-70} {px-66},{rim_y+130} {px-60},{rim_y+rim_h+30}Z" '
      f'fill="{lingrad([(0, "#fff4e6", 0.75), (1, "#fff4e6", 0.05)], 0, 0, 0, 1)}"/>')
    A(f'<path d="M{px+96},{rim_y+rim_h+40} C{px+92},{rim_y+140} {px+82},{bot_y-60} {px+74},{bot_y-30}" fill="none" '
      f'stroke="#ffd2b0" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>')
    # обідок: передня стінка
    rim_front = (f"M{px-rim_rx},{rim_y} L{px-rim_rx+2},{rim_y+rim_h-6} A{rim_rx-2},{rim_ry} 0 0 0 {px+rim_rx-2},{rim_y+rim_h-6} "
                 f"L{px+rim_rx},{rim_y} A{rim_rx},{rim_ry} 0 0 1 {px-rim_rx},{rim_y}Z")
    terra2 = lingrad([(0, "#712a12"), (0.15, "#a2441e"), (0.33, "#d77346"), (0.43, "#f2a676"), (0.52, "#df834f"),
                      (0.75, "#b0502a"), (1, "#652511")], px - rim_rx, 0, px + rim_rx, 0, units="user")
    A(f'<path d="{rim_front}" fill="{terra2}"/>')
    A(f'<path d="M{px-rim_rx+2},{rim_y+rim_h-6} A{rim_rx-2},{rim_ry} 0 0 0 {px+rim_rx-2},{rim_y+rim_h-6}" fill="none" stroke="#4a1a08" stroke-opacity="0.45" stroke-width="2"/>')
    A(f'<path d="M{px-rim_rx+10},{rim_y+8} A{rim_rx-10},{rim_ry} 0 0 0 {px+rim_rx-10},{rim_y+8}" fill="none" stroke="#ffd9bd" stroke-opacity="0.55" stroke-width="2.5"/>')
    # верх обідка й ґрунт
    A(f'<ellipse cx="{px}" cy="{rim_y}" rx="{rim_rx}" ry="{rim_ry}" fill="{lingrad([(0, "#8e3a18"), (0.4, "#e7946a"), (1, "#a4471f")], 0, 0, 1, 0)}"/>')
    A(f'<ellipse cx="{px}" cy="{rim_y+3}" rx="{rim_rx-16}" ry="{rim_ry-8}" fill="{radgrad([(0, "#4a2e1a"), (0.7, "#2e1a0e"), (1, "#1a0e06")], 0.5, 0.35, 0.6)}"/>')
    for _ in range(40):
        a = random.uniform(0, 2 * math.pi)
        rr = math.sqrt(random.uniform(0, 1))
        cx = px + math.cos(a) * rr * (rim_rx - 24)
        cy = rim_y + 3 + math.sin(a) * rr * (rim_ry - 11)
        A(f'<circle cx="{f2(cx)}" cy="{f2(cy)}" r="{random.uniform(1,2.6):.1f}" fill="{random.choice(["#6b4a30", "#8a6644", "#1c1008"])}" opacity="0.8"/>')
    A(f'<ellipse cx="{px}" cy="{rim_y+6}" rx="34" ry="8" fill="{radgrad([(0, "#0e0703", 0.7), (1, "#0e0703", 0)])}"/>')
    # стебла і листки (задній план → передній)
    soil = (px, rim_y + 6)
    plant = [
        # (кінець черешка, кут листка, L, W, палітра, bend, flip)
        ((1052, 640), -152, 205, 74, "deep", 0.10, False),
        ((1334, 610), -28, 215, 80, "deep", 0.12, True),
        ((1196, 470), -96, 200, 76, "deep", 0.08, False),
        ((1010, 770), -172, 190, 70, "mid", 0.14, False),
        ((1378, 752), -6, 196, 72, "mid", 0.14, True),
        ((1112, 530), -122, 205, 78, "mid", 0.10, False),
        ((1292, 486), -62, 210, 80, "light", 0.10, True),
        ((1204, 560), -88, 128, 36, "lime", 0.05, False),
        ((1118, 806), 158, 168, 64, "light", -0.12, True),
        ((1282, 812), 24, 172, 64, "light", 0.12, False),
    ]
    for i, (end, ang, L, Wd, pal, bend, flip) in enumerate(plant):
        sx = soil[0] + (end[0] - soil[0]) * 0.08
        c1 = (sx, soil[1] - 120 - (soil[1] - end[1]) * 0.25)
        c2 = (end[0] - math.cos(math.radians(ang)) * 70, end[1] - math.sin(math.radians(ang)) * 70)
        A(stem((sx, soil[1]), c1, c2, end, w0=11, w1=4.5, col1="#4f7f2e" if pal == "deep" else "#62973a"))
        A(leaf(end[0], end[1], L, Wd, ang, pal, bend=bend, flip=flip, veins=8 if L > 180 else 6))

    A('</g>')
    A('<g transform="translate(760,1032) scale(0.82) translate(-760,-1130)">')

    # --- колба Ерленмеєра з хлорофілом
    fx, base = 868, 1130
    nl, nr, ntop, nbot = fx - 38, fx + 38, 716, 846
    flask = (f"M{nl},{ntop} L{nl},{nbot} C{nl},{nbot+28} {nl-12},{nbot+46} {nl-22},{nbot+64} "
             f"L{fx-142},{base-34} Q{fx-156},{base-4} {fx-122},{base} L{fx+122},{base} Q{fx+156},{base-4} {fx+142},{base-34} "
             f"L{nr+22},{nbot+64} C{nr+12},{nbot+46} {nr},{nbot+28} {nr},{nbot} L{nr},{ntop}Z")
    fid = uid("fc")
    DEFS.append(f'<clipPath id="{fid}"><path d="{flask}"/></clipPath>')
    # тінь та зелений відблиск світла, що пройшло крізь рідину
    A(shadow_ellipse(fx - 30, base + 4, 210, 24, "#2a2a14", 0.4))
    A(f'<ellipse cx="{fx-150}" cy="{base+10}" rx="150" ry="20" fill="{radgrad([(0, "#2fbf6a", 0.45), (1, "#2fbf6a", 0)])}"/>')
    # скло (тло)
    A(f'<path d="{flask}" fill="{lingrad([(0, "#dfeee6", 0.55), (0.25, "#ffffff", 0.18), (0.75, "#ffffff", 0.12), (1, "#cfe2d6", 0.55)], 0, 0, 1, 0)}"/>')
    # рідина
    liq_y = 1000
    A(f'<g clip-path="url(#{fid})">')
    A(f'<rect x="{fx-170}" y="{liq_y}" width="340" height="{base-liq_y+4}" fill="{lingrad([(0, "#06401f"), (0.18, "#0c6a33"), (0.45, "#1ea457"), (0.6, "#33bd6c"), (0.82, "#0f7a3b"), (1, "#053519")], 0, 0, 1, 0)}"/>')
    A(f'<rect x="{fx-170}" y="{liq_y}" width="340" height="{base-liq_y+4}" fill="{lingrad([(0, "#9df0b8", 0.25), (0.25, "#2ab866", 0), (1, "#02210f", 0.5)], 0, 0, 0, 1)}"/>')
    # внутрішнє світіння
    A(f'<ellipse cx="{fx+18}" cy="{liq_y+70}" rx="80" ry="50" fill="{radgrad([(0, "#b8ffcf", 0.55), (1, "#b8ffcf", 0)])}"/>')
    # бульбашки в рідині
    for (bx, by, br) in [(fx - 40, 1060, 5), (fx - 28, 1040, 3.5), (fx + 52, 1084, 4), (fx + 60, 1050, 2.8), (fx - 70, 1094, 3), (fx + 10, 1026, 2.5)]:
        A(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="none" stroke="#dfffe9" stroke-opacity="0.75" stroke-width="1.3"/>'
          f'<circle cx="{bx-br*0.35}" cy="{by-br*0.35}" r="{br*0.3}" fill="#ffffff" opacity="0.8"/>')
    A("</g>")
    # меніск: ширина колби на рівні рідини
    k = (liq_y - (nbot + 64)) / ((base - 34) - (nbot + 64))
    half = (38 + 22) + k * ((142) - (38 + 22))
    A(f'<ellipse cx="{fx}" cy="{liq_y}" rx="{f2(half-3)}" ry="11" fill="{lingrad([(0, "#2fae62"), (0.5, "#8ee8ad"), (1, "#26a058")], 0, 0, 1, 0)}" opacity="0.95"/>')
    A(f'<path d="M{f2(fx-half+3)},{liq_y-3} Q{f2(fx-half+10)},{liq_y+8} {fx-40},{liq_y+10}" fill="none" stroke="#e4fff0" stroke-width="2" opacity="0.8"/>')
    A(f'<path d="M{f2(fx+half-3)},{liq_y-3} Q{f2(fx+half-10)},{liq_y+8} {fx+40},{liq_y+10}" fill="none" stroke="#e4fff0" stroke-width="2" opacity="0.6"/>')
    A(f'<ellipse cx="{fx}" cy="{liq_y-1}" rx="{f2(half-3)}" ry="11" fill="none" stroke="#0a5a2c" stroke-opacity="0.45" stroke-width="1.4"/>')
    # товсте дно
    A(f'<path d="M{fx-128},{base-8} Q{fx},{base+4} {fx+128},{base-8}" fill="none" stroke="#e8fff1" stroke-opacity="0.55" stroke-width="3"/>')
    # контур скла (товщина): темніша зовнішня лінія + світла внутрішня
    A(f'<path d="{flask}" fill="none" stroke="#5e7d6a" stroke-opacity="0.55" stroke-width="4"/>')
    A(f'<path d="{flask}" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="1.6"/>')
    # рефлекси: ліва смуга вздовж стінки, права вузька, на горлі
    A(f'<path d="M{nl+8},{ntop+22} L{nl+8},{nbot+6} C{nl+6},{nbot+40} {nl-8},{nbot+64} {nl-16},{nbot+84} L{fx-122},{base-50}" '
      f'fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="7" stroke-linecap="round"/>')
    A(f'<path d="M{nl+20},{ntop+30} L{nl+20},{nbot-10}" stroke="#ffffff" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/>')
    A(f'<path d="M{nr-9},{ntop+40} L{nr-9},{nbot}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"/>')
    A(f'<path d="M{nr+30},{nbot+84} L{fx+126},{base-46}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="3.5" stroke-linecap="round"/>')
    A(f'<path d="M{nr+18},{nbot+90} L{fx+100},{base-60}" stroke="#d9f5e4" stroke-opacity="0.35" stroke-width="9" stroke-linecap="round"/>')
    # шкала (білі поділки)
    for i, yy in enumerate(range(930, 1100, 34)):
        kk = (yy - (nbot + 64)) / ((base - 34) - (nbot + 64))
        hx_ = fx - ((38 + 22) + kk * (142 - 60)) + 26
        A(f'<path d="M{f2(hx_)},{yy} l{30 if i % 2 == 0 else 18},0" stroke="#ffffff" stroke-opacity="0.8" stroke-width="2.4" stroke-linecap="round"/>')
    # вінця горла
    A(f'<rect x="{nl-9}" y="{ntop-12}" width="{(nr-nl)+18}" height="20" rx="10" fill="{lingrad([(0, "#c6dccf", 0.9), (0.3, "#ffffff", 0.95), (0.7, "#e9f4ee", 0.8), (1, "#a9c3b3", 0.9)], 0, 0, 1, 0)}" stroke="#6f8f7c" stroke-opacity="0.5" stroke-width="1.5"/>')
    A(f'<ellipse cx="{fx}" cy="{ntop-12}" rx="{(nr-nl)/2+6}" ry="5" fill="#f4fbf7" stroke="#7d9a88" stroke-opacity="0.6" stroke-width="1.2"/>')

    # --- штатив із пробірками (in vitro)
    rx0, rx1 = 508, 712
    plank_y = 950
    rb = 1136
    A(shadow_ellipse((rx0 + rx1) / 2 - 20, rb + 2, 140, 16, "#2a1c0c", 0.45))
    wood = lingrad([(0, "#c9945a"), (0.5, "#e2b77e"), (1, "#b9844c")], 0, 0, 1, 0)
    wood_d = lingrad([(0, "#9c6a35"), (1, "#7d5228")], 0, 0, 0, 1)
    # задні стійки
    A(f'<rect x="{rx0+8}" y="{plank_y-8}" width="12" height="{rb-plank_y}" fill="#8b5d2e"/>')
    A(f'<rect x="{rx1-20}" y="{plank_y-8}" width="12" height="{rb-plank_y}" fill="#8b5d2e"/>')
    # нижня полиця
    A(f'<path d="M{rx0},{rb-18} L{rx0+10},{rb-30} L{rx1-22},{rb-30} L{rx1-12},{rb-18}Z" fill="#e8c18c"/>')
    A(f'<rect x="{rx0}" y="{rb-18}" width="{rx1-rx0-12}" height="18" rx="2" fill="{wood_d}"/>')

    def test_tube(cx, top, bottom, w, content):
        r = w / 2
        tube = f"M{cx-r},{top} L{cx-r},{bottom-r} A{r},{r} 0 0 0 {cx+r},{bottom-r} L{cx+r},{top}Z"
        cid = uid("tc")
        DEFS.append(f'<clipPath id="{cid}"><path d="{tube}"/></clipPath>')
        o = [f'<path d="{tube}" fill="{lingrad([(0, "#dbe9e1", 0.6), (0.3, "#ffffff", 0.2), (1, "#c8dccf", 0.55)], 0, 0, 1, 0)}"/>']
        o.append(f'<g clip-path="url(#{cid})">{content}</g>')
        o.append(f'<path d="{tube}" fill="none" stroke="#5e7d6a" stroke-opacity="0.55" stroke-width="3.5"/>')
        o.append(f'<path d="{tube}" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="1.4"/>')
        o.append(f'<path d="M{cx-r+7},{top+30} L{cx-r+7},{bottom-r-4}" stroke="#ffffff" stroke-opacity="0.85" stroke-width="5" stroke-linecap="round"/>')
        o.append(f'<path d="M{cx+r-7},{top+44} L{cx+r-7},{bottom-r-14}" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2.5" stroke-linecap="round"/>')
        o.append(f'<rect x="{cx-r-5}" y="{top-6}" width="{w+10}" height="12" rx="6" fill="{lingrad([(0, "#c6dccf"), (0.35, "#ffffff"), (1, "#a9c3b3")], 0, 0, 1, 0)}" stroke="#6f8f7c" stroke-opacity="0.5" stroke-width="1.2"/>')
        return "\n".join(o)

    A(f'<path d="M{rx0},{plank_y} L{rx0+10},{plank_y-13} L{rx1-22},{plank_y-13} L{rx1-12},{plank_y}Z" fill="#edc994"/>')
    for hx_, hw_ in ((572, 36), (652, 31)):
        A(f'<ellipse cx="{hx_}" cy="{plank_y-6}" rx="{hw_}" ry="6" fill="#5a3818" opacity="0.7"/>')
    # пробірка 1: рослинка in vitro на агарі
    t1x, t1top, t1bot, t1w = 572, 772, 1106, 66
    agar_y = 1012
    plantlet = []
    plantlet.append(f'<rect x="{t1x-40}" y="{agar_y}" width="80" height="120" fill="{lingrad([(0, "#f6e7b0", 0.95), (1, "#e3c879", 0.95)], 0, 0, 0, 1)}"/>')
    plantlet.append(f'<ellipse cx="{t1x}" cy="{agar_y}" rx="33" ry="5" fill="#fff6d2" opacity="0.95"/>')
    for (dx, l, a) in [(-2, 60, 100), (3, 48, 70), (-6, 40, 125), (6, 34, 55)]:
        ex, ey = t1x + dx + l * math.cos(math.radians(a)), agar_y + 6 + l * math.sin(math.radians(a))
        plantlet.append(f'<path d="M{t1x+dx/3},{agar_y+4} Q{t1x+dx},{agar_y+l*0.5} {f2(ex)},{f2(ey)}" stroke="#fffdf0" stroke-width="1.6" fill="none" opacity="0.9"/>')
    plantlet.append(stem((t1x, agar_y + 2), (t1x - 2, agar_y - 50), (t1x + 4, agar_y - 90), (t1x + 1, agar_y - 128), w0=5, w1=3, col1="#5f9a38", col2="#b9e07c"))
    plantlet.append(leaf(t1x, agar_y - 58, 44, 15, -150, "light", bend=0.1, veins=3, flip=True))
    plantlet.append(leaf(t1x + 1, agar_y - 82, 46, 16, -32, "light", bend=0.1, veins=3))
    plantlet.append(leaf(t1x + 1, agar_y - 118, 40, 14, -128, "lime", bend=0.1, veins=3, flip=True))
    plantlet.append(leaf(t1x + 1, agar_y - 124, 36, 13, -58, "lime", bend=0.1, veins=3))
    A(test_tube(t1x, t1top, t1bot, t1w, "".join(plantlet)))
    # ватно-марлевий корок
    A(f'<path d="M{t1x-30},{t1top+20} C{t1x-36},{t1top-10} {t1x-26},{t1top-34} {t1x-6},{t1top-32} C{t1x+8},{t1top-44} {t1x+34},{t1top-30} {t1x+30},{t1top-6} L{t1x+28},{t1top+22}Z" '
      f'fill="{radgrad([(0, "#fffdf6"), (0.7, "#f1e9d6"), (1, "#d9ccb0")], 0.4, 0.35, 0.7)}" stroke="#bfae8a" stroke-opacity="0.6" stroke-width="1.2"/>')
    # пробірка 2: екстракт пігментів (жовто-зелений)
    t2x, t2top, t2bot, t2w = 652, 800, 1106, 56
    liq2 = (f'<rect x="{t2x-40}" y="944" width="80" height="200" fill="{lingrad([(0, "#7aa81f"), (0.45, "#b9d84a"), (1, "#5e8a12")], 0, 0, 1, 0)}"/>'
            f'<ellipse cx="{t2x}" cy="944" rx="27" ry="5" fill="#d9ef8c"/>'
            f'<rect x="{t2x-40}" y="944" width="80" height="200" fill="{lingrad([(0, "#ffffff", 0.0), (1, "#203a05", 0.35)], 0, 0, 0, 1)}"/>')
    A(test_tube(t2x, t2top, t2bot, t2w, liq2))
    # передня планка з отворами
    A(f'<rect x="{rx0}" y="{plank_y}" width="{rx1-rx0-12}" height="24" rx="3" fill="{wood}"/>')
    A(f'<rect x="{rx0}" y="{plank_y}" width="{rx1-rx0-12}" height="24" rx="3" fill="{lingrad([(0, "#ffffff", 0.25), (1, "#5a3510", 0.25)], 0, 0, 0, 1)}"/>')
    for gx in (rx0 + 16, rx0 + 64, rx0 + 116):
        A(f'<path d="M{gx},{plank_y+5} q25,4 50,1" stroke="#a87440" stroke-opacity="0.45" stroke-width="1.2" fill="none"/>')
    # передні стійки
    A(f'<rect x="{rx0}" y="{plank_y+24}" width="14" height="{rb-plank_y-42}" fill="{lingrad([(0, "#b07a43"), (1, "#d6a76c")], 0, 0, 1, 0)}"/>')
    A(f'<rect x="{rx1-26}" y="{plank_y+24}" width="14" height="{rb-plank_y-42}" fill="{lingrad([(0, "#b07a43"), (1, "#d6a76c")], 0, 0, 1, 0)}"/>')

    A('</g>')
    # --- бульбашки O₂ над рослиною
    bubbles = [(1010, 300, 30, True), (1440, 470, 20, False), (1100, 252, 15, False), (1404, 300, 32, True),
               (960, 392, 12, False), (1450, 670, 13, False), (1330, 262, 11, False), (1180, 276, 18, False)]
    for bx, by, br, lab in bubbles:
        g = radgrad([(0, "#ffffff", 0.05), (0.7, "#d8f3e2", 0.25), (1, "#8fd3aa", 0.55)], 0.5, 0.5, 0.5)
        A(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{g}" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1.6"/>')
        A(f'<path d="M{f2(bx-br*0.62)},{f2(by-br*0.1)} A{br*0.65},{br*0.65} 0 0 1 {f2(bx-br*0.1)},{f2(by-br*0.62)}" fill="none" stroke="#ffffff" stroke-width="{f2(max(br*0.12,1.5))}" stroke-linecap="round" opacity="0.95"/>')
        A(f'<circle cx="{f2(bx+br*0.42)}" cy="{f2(by+br*0.45)}" r="{f2(br*0.1)}" fill="#ffffff" opacity="0.7"/>')
        if lab:
            A(text(bx, by + 9, "O₂", "Inter Display", 700, 26, "#1e6a3c", "middle"))

    # ---------- картка «фотосинтез»
    ex0, ey0, ew, eh = M, 700, 418, 300
    A(f'<rect x="{ex0+6}" y="{ey0+14}" width="{ew}" height="{eh}" rx="26" fill="#5b4a1c" opacity="0.10" filter="url(#soft)"/>')
    A(f'<rect x="{ex0}" y="{ey0}" width="{ew}" height="{eh}" rx="26" fill="{lingrad([(0, "#fffdf5", 0.92), (1, "#fff6df", 0.86)], 0, 0, 0, 1)}" stroke="#e9cf8e" stroke-width="2"/>')
    # сонечко
    scx, scy = ex0 + 52, ey0 + 52
    for i in range(12):
        a = math.radians(i * 30)
        A(f'<path d="M{f2(scx+math.cos(a)*20)},{f2(scy+math.sin(a)*20)} L{f2(scx+math.cos(a)*29)},{f2(scy+math.sin(a)*29)}" stroke="{C["gold"]}" stroke-width="3.2" stroke-linecap="round"/>')
    A(f'<circle cx="{scx}" cy="{scy}" r="15" fill="{radgrad([(0, "#fff2b8"), (1, "#f0b52f")], 0.4, 0.4, 0.6)}"/>')
    A(text(ex0 + 98, ey0 + 62, "Фотосинтез", "Inter Display", 800, 34, C["leaf"]))
    eq_sz = 40
    A(text(ex0 + 32, ey0 + 136, "6CO₂ + 6H₂O", "Inter Display", 800, eq_sz, C["forest"]))
    A(text(ex0 + 32, ey0 + 186, "→ C₆H₁₂O₆ + 6O₂", "Inter Display", 800, eq_sz, C["forest"]))
    exp = "Енергія світла перетворює вуглекислий газ і воду на цукор (глюкозу) та кисень."
    ln = wrap_runs(parse_runs(exp), ew - 64, 25)
    A(render_lines(ln, ex0 + 32, ey0 + 226, 30, 25))
    eq_lines = len(ln)

    # ---------- великі листки, що обрамлюють сторінку
    A(leaf(1540, 1080, 210, 76, -164, "mid", bend=0.12, veins=8, flip=True, opacity=0.95))

    # ---------- інформаційні картки
    cy0 = 1060
    cy1 = 1628
    gap = 36
    cwid = (W_ - 2 * M - gap) / 2
    cards = [(M, "Про кафедру", "128 років школи фізіології рослин", icon_sprout),
             (M + cwid + gap, "Бакалаврат", "ОПП «Біотехнології та біоінженерія»", icon_cap)]
    for cx0, title, sub, ic in cards:
        A(f'<rect x="{f2(cx0+4)}" y="{cy0+14}" width="{f2(cwid)}" height="{cy1-cy0}" rx="28" fill="#4a3a14" opacity="0.13" filter="url(#soft)"/>')
        A(f'<rect x="{f2(cx0)}" y="{cy0}" width="{f2(cwid)}" height="{cy1-cy0}" rx="28" fill="{lingrad([(0, "#fffef9", 0.95), (1, "#fffaf0", 0.92)], 0, 0, 0, 1)}" stroke="#ead7a6" stroke-width="2"/>')
        A(ic(f2(cx0 + 66), cy0 + 64))
        A(text(cx0 + 118, cy0 + 60, title, "Inter Display", 800, 40, C["forest"]))
        A(text(cx0 + 118, cy0 + 96, sub, "Lora", 500, 27, C["amber"], extra=' font-style="italic"'))

    bsz, blh = 25, 32
    about = [
        "Одна з найстаріших науково-освітніх ланок НУБіП України (від **1898 р.**).",
        "Класика фізіології й біохімії рослин + клітинна біоінженерія, фітовірусологія (віруси рослин), нанобіотехнології, біоенергетика.",
        "**2 доктори** і **5 кандидатів наук**; лабораторія «Біохімії та фітобіотехнології», гурток «ФІТОЛАБ».",
        "Навчання українською й англійською; співпраця з Фінляндією, Німеччиною, Словаччиною, Латвією, Польщею, Швецією, Норвегією.",
    ]
    opp = [
        "__ОПП — освітньо-професійна програма.__ Спеціальність **G21 (162)** «Біотехнології та біоінженерія», **4 роки**; кафедра — випускова.",
        "**Дисципліни:** Фізіологія рослин, Біохімія, Клітинна біоенергетика, Імунітет рослин, Біологія лікарських рослин; навчальні практики з біохімії та фізіології рослин.",
    ]
    meta = {}
    for ci, (items, cx0) in enumerate([(about, M), (opp, M + cwid + gap)]):
        y = cy0 + 142
        for it in items:
            ln = wrap_runs(parse_runs(it), cwid - 66 - 30, bsz)
            A(leaf_bullet(cx0 + 42, y - 8, 0.9, "#4f9a3a" if ci == 0 else "#e0a52a"))
            A(render_lines(ln, cx0 + 66, y, blh, bsz))
            y += len(ln) * blh + 12
        meta[ci] = y
    # шлях навчання (у картці ОПП)
    px0 = M + cwid + gap + 34
    note = "Далі — магістратура «Екологічна біотехнологія та біоенергетика» і PhD (доктор філософії)."
    nst = {**STY, "r": dict(STY["r"], fill="#4d5d51")}
    note_ln = wrap_runs(parse_runs(note), cwid - 64, 25, nst)
    py = max(meta[1] + 8, cy1 - 36 - 82 - (len(note_ln) - 1) * 32)
    meta["path_gap"] = py - meta[1]
    A(f'<path d="M{px0},{py-22} L{f2(px0+cwid-68)},{py-22}" stroke="#e6d4a6" stroke-width="1.5" stroke-dasharray="2 7" stroke-linecap="round"/>')
    steps = [("Бакалавр", True), ("Магістр", False), ("PhD", False)]
    xx = px0
    for i, (st, on) in enumerate(steps):
        wdt = tw(st, "Inter", 600, 25) + 36
        A(f'<rect x="{f2(xx)}" y="{py}" width="{f2(wdt)}" height="44" rx="22" fill="{C["forest"] if on else "#eef5e2"}" stroke="{C["forest"]}" stroke-width="1.6"/>')
        A(text(xx + wdt / 2, py + 30, st, "Inter", 600, 25, "#ffffff" if on else C["forest"], "middle"))
        xx += wdt
        if i < 2:
            A(f'<path d="M{f2(xx+10)},{py+22} L{f2(xx+34)},{py+22} M{f2(xx+26)},{py+14} L{f2(xx+35)},{py+22} L{f2(xx+26)},{py+30}" stroke="{C["gold"]}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
            xx += 44
    ln = note_ln
    A(render_lines(ln, px0, py + 82, 32, 25, nst))
    meta["opp_end"] = py + 82 + (len(ln) - 1) * 32

    # ---------- нижня смуга
    fy = 1662
    band = f"M0,{fy+26} C300,{fy-14} 620,{fy+30} 900,{fy+8} C1140,{fy-10} 1320,{fy+4} {W_},{fy-12} L{W_},{H_} L0,{H_}Z"
    A(f'<path d="{band}" fill="{lingrad([(0, "#174a2d"), (0.6, "#0f3a22"), (1, "#0b2c1a")], 0, 0, 0.3, 1)}"/>')
    A(f'<path d="M0,{fy+26} C300,{fy-14} 620,{fy+30} 900,{fy+8} C1140,{fy-10} 1320,{fy+4} {W_},{fy-12}" fill="none" stroke="{C["gold2"]}" stroke-width="3" opacity="0.85"/>')
    # тонкий візерунок жилок у смузі
    A(f'<g opacity="0.07" stroke="#d3ec8e" fill="none" stroke-width="2">'
      + "".join(f'<path d="M{x},{H_} Q{x+60},{fy+200} {x+180},{fy+60}"/>' for x in range(-100, 1600, 140)) + "</g>")

    # контакти
    qs = 280
    qgap = 24
    qx0 = W_ - M - 3 * qs - 2 * qgap
    qy = 1692
    gold = C["gold2"]

    def ico(kind, x, y):
        if kind == "pin":
            return (f'<path d="M{x},{y+12} C{x-14},{y-4} {x-12},{y-18} {x},{y-18} C{x+12},{y-18} {x+14},{y-4} {x},{y+12}Z" fill="{gold}"/>'
                    f'<circle cx="{x}" cy="{y-7}" r="4.5" fill="#0f3a22"/>')
        if kind == "tel":
            return (f'<path d="M{x-10},{y-15} l7,-2 l5,10 l-5,4 c3,6 6,9 12,12 l4,-5 l10,5 l-2,7 c-14,2 -32,-14 -31,-31Z" '
                    f'transform="translate(-4,2)" fill="{gold}"/>')
        if kind == "mail":
            return (f'<rect x="{x-13}" y="{y-14}" width="26" height="19" rx="3" fill="{gold}"/>'
                    f'<path d="M{x-11},{y-12} L{x},{y-3} L{x+11},{y-12}" stroke="#0f3a22" stroke-width="2.2" fill="none"/>')
        if kind == "lab":
            return (f'<path d="M{x-5},{y-18} L{x-5},{y-9} L{x-13},{y+6} Q{x-14},{y+9} {x-10},{y+9} L{x+10},{y+9} Q{x+14},{y+9} {x+13},{y+6} L{x+5},{y-9} L{x+5},{y-18}Z" fill="{gold}"/>'
                    f'<path d="M{x-9},{y} L{x+9},{y}" stroke="#0f3a22" stroke-width="2"/>')
        return ""

    tx = M + 38
    rows = [
        ("pin", [("03041, м. Київ,", "Inter", 400, "#f4efe0"), ("вул. Героїв Оборони, 13,", "Inter", 400, "#f4efe0"),
                 ("навч. корпус № 4, кімн. 13", "Inter", 400, "#f4efe0")]),
        ("tel", [("(044) 527-89-66", "Inter", 600, "#ffffff"), ("096-977-80-58", "Inter", 600, "#ffffff")]),
        ("mail", [("physiol.biochem2021@gmail.com", "Inter", 400, "#ffffff")]),
        ("lab", [("Онлайн лабораторія кафедри:", "Lora", 500, gold), ("nubipfbr.online", "Inter", 600, "#ffffff")]),
    ]
    yy = 1726
    cmax = 0
    for kind, lines_ in rows:
        A(ico(kind, M + 13, yy))
        for s_, fam, wt, col in lines_:
            extra = ' font-style="italic"' if fam == "Lora" else ""
            A(text(tx, yy, s_, fam, wt, 25, col, extra=extra))
            cmax = max(cmax, tw(s_, fam, wt, 25, "italic" if fam == "Lora" else "normal"))
            yy += 32
        yy += 14
    meta["contacts_right"] = tx + cmax
    meta["qx0"] = qx0
    meta["contacts_end"] = yy - 46

    qrs = [("qr-instagram", "Instagram", "@plant_physio_chair", "ico-instagram"),
           ("qr-facebook", "Facebook", "Кафедра ФБРтаБ", "ico-facebook"),
           ("qr-nubip", "Сторінка кафедри", "на сайті НУБіП", "ico-web")]
    for i, (qid, l1, l2, ico_) in enumerate(qrs):
        x = qx0 + i * (qs + qgap)
        A(f'<rect x="{x}" y="{qy+8}" width="{qs}" height="{qs}" rx="6" fill="#020d06" opacity="0.35" filter="url(#soft)"/>')
        A(f'<use href="#{qid}" x="{x}" y="{qy}" width="{qs}" height="{qs}" color="#0f3a22"/>')
        cx = x + qs / 2
        w1 = tw(l1, "Inter", 600, 25) + 34
        A(f'<use href="#{ico_}" x="{f2(cx-w1/2)}" y="{qy+qs+12}" width="25" height="25"/>')
        A(text(cx - w1 / 2 + 34, qy + qs + 33, l1, "Inter", 600, 25, "#ffffff"))
        A(text(cx, qy + qs + 64, l2, "Inter", 400, 25, "#d9e8cf", "middle"))
    meta["q_cap_w"] = [tw(l2, "Inter", 400, 25) for *_, l2, _ in qrs]

    DEFS.append('<filter id="soft" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="12"/></filter>')
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="148mm" height="210mm" viewBox="0 0 1480 2100">\n'
           '<title>Кафедра фізіології, біохімії рослин та біоенергетики — флаєр «Зелена лабораторія»</title>\n'
           '<defs>\n' + "\n".join(DEFS) + '\n</defs>\n' + "\n".join(S) + "\n</svg>\n")
    meta.update(title_w=title_w, tag_w=tag_w, eq_lines=eq_lines)
    return svg, meta


if __name__ == "__main__":
    svg, meta = build()
    if run_measure():
        svg, meta = build()
    OUT.write_text(svg, encoding="utf-8")
    print("wrote", OUT, {k: (round(v) if isinstance(v, float) else v) for k, v in meta.items()})
