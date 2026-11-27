#!/usr/bin/env python3
"""Генератор двостороннього єврофлаєра DL (99×210 мм) «Зелена лабораторія» → src/dl1-botanica-1-front.svg,
src/dl1-botanica-2-back.svg. Стиль і допоміжні функції (вимірювання тексту, переноси, листки, градієнти) —
з gen_v1-botanica.py; ілюстрації (рослина в горщику, колба, штатив із пробірками) — лише декор.

Запуск: python3 src/gen_dl1-botanica.py && python3 build.py dl1-botanica
"""
import importlib.util, math, pathlib, random, re

HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("v1botanica", HERE / "gen_v1-botanica.py")
B = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(B)
for _n in ("tw", "run_measure", "esc", "f2", "ff", "text", "STY", "parse_runs", "wrap_runs", "render_lines",
           "catmull", "DEFS", "uid", "lingrad", "radgrad", "shadow_ellipse", "leaf", "stem", "leaf_bullet",
           "icon_sprout", "icon_cap"):
    globals()[_n] = getattr(B, _n)

W_, H_ = 990, 2100
M = 50
C = dict(forest="#123d26", forest2="#1e5a36", leaf="#3f9442", gold="#e0a52a", gold2="#f2c14e",
         amber="#9a6512", ink="#1c2e22", body="#2a3a2f", cream="#fbf7ee")
SOFT = '<filter id="soft" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="10"/></filter>'


def reset():
    DEFS.clear()
    B._uid[0] = 0
    random.seed(7)


def paper(A, rays=True):
    A(f'<rect width="{W_}" height="{H_}" fill="{lingrad([(0, "#fbf8ef"), (0.55, "#f7f1e2"), (1, "#f1e8d3")], 0, 0, 0, 1)}"/>')
    A(f'<rect width="{W_}" height="{H_}" fill="{radgrad([(0, "#ffe6a0", 0.95), (0.35, "#ffeab8", 0.45), (1, "#fff3d6", 0)], 1, 0, 0.7)}"/>')
    A(f'<rect width="{W_}" height="{H_}" fill="{radgrad([(0, "#cfe3b4", 0.5), (1, "#e8efd4", 0)], 0, 0.55, 0.6)}"/>')
    dots = []
    for _ in range(140):
        dots.append(f'<circle cx="{random.uniform(0,180):.1f}" cy="{random.uniform(0,180):.1f}" r="{random.uniform(0.5,1.5):.2f}" '
                    f'fill="{random.choice(["#7d6a45", "#a08a5c", "#5d6b44"])}" opacity="{random.uniform(0.05,0.16):.2f}"/>')
    for _ in range(18):
        x0, y0 = random.uniform(0, 180), random.uniform(0, 180)
        a = random.uniform(0, math.pi)
        l = random.uniform(5, 14)
        dots.append(f'<path d="M{x0:.1f},{y0:.1f} l{l*math.cos(a):.1f},{l*math.sin(a):.1f}" stroke="#8b7a55" stroke-width="0.6" opacity="0.12"/>')
    DEFS.append(f'<pattern id="paper-grain" width="180" height="180" patternUnits="userSpaceOnUse">{"".join(dots)}</pattern>')
    A(f'<rect width="{W_}" height="{H_}" fill="url(#paper-grain)"/>')
    if rays:
        sun = (1040, -60)
        out = []
        for ang, wdt, op in [(118, 3.5, 0.55), (127, 2.2, 0.4), (135, 4.5, 0.5), (144, 2.5, 0.35), (152, 3.8, 0.45), (110, 2.4, 0.4)]:
            L = 1100
            a1, a2 = math.radians(ang - wdt / 2), math.radians(ang + wdt / 2)
            p1 = (sun[0] + L * math.cos(a1), sun[1] + L * math.sin(a1))
            p2 = (sun[0] + L * math.cos(a2), sun[1] + L * math.sin(a2))
            ex = (sun[0] + L * math.cos(math.radians(ang)), sun[1] + L * math.sin(math.radians(ang)))
            g = lingrad([(0, "#ffd36b", op), (0.55, "#ffe2a0", op * 0.35), (1, "#fff0c8", 0)], sun[0], sun[1], ex[0], ex[1], units="user")
            out.append(f'<path d="M{sun[0]},{sun[1]} L{f2(p1[0])},{f2(p1[1])} L{f2(p2[0])},{f2(p2[1])}Z" fill="{g}"/>')
        A('<g opacity="0.7">' + "".join(out) + "</g>")
        A(f'<circle cx="{sun[0]}" cy="{sun[1]}" r="300" fill="{radgrad([(0, "#fff7d6", 1), (0.35, "#ffe08a", 0.7), (1, "#ffd36b", 0)])}"/>')


def bubbles(A, pts):
    for bx, by, br in pts:
        g = radgrad([(0, "#ffffff", 0.05), (0.7, "#d8f3e2", 0.25), (1, "#8fd3aa", 0.55)])
        A(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{g}" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1.6"/>')
        A(f'<path d="M{f2(bx-br*0.62)},{f2(by-br*0.1)} A{br*0.65},{br*0.65} 0 0 1 {f2(bx-br*0.1)},{f2(by-br*0.62)}" fill="none" '
          f'stroke="#ffffff" stroke-width="{f2(max(br*0.12,1.5))}" stroke-linecap="round" opacity="0.95"/>')


def photo(A, cx, cy, r, sym, label=None):
    """Фото в кружечку: тінь, кремове паспарту із золотим кільцем, тонка біла обвідка, підпис-пігулка."""
    cid = uid("ph")
    DEFS.append(f'<clipPath id="{cid}"><circle cx="{f2(cx)}" cy="{f2(cy)}" r="{f2(r)}"/></clipPath>')
    A(f'<circle cx="{f2(cx+5)}" cy="{f2(cy+12)}" r="{f2(r+10)}" fill="#3a2a10" opacity="0.22" filter="url(#soft)"/>')
    A(f'<circle cx="{f2(cx)}" cy="{f2(cy)}" r="{f2(r+11)}" fill="#fffaf0" stroke="{C["gold"]}" stroke-width="2.5"/>')
    # кліп — на обгортці <g>: у <use> атрибути x/y зсувають і саму clip-path
    A(f'<g clip-path="url(#{cid})"><use href="#{sym}" x="{f2(cx-r)}" y="{f2(cy-r)}" width="{f2(2*r)}" height="{f2(2*r)}"/></g>')
    A(f'<circle cx="{f2(cx)}" cy="{f2(cy)}" r="{f2(r)}" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/>')
    if label:
        runs = parse_runs(label)
        st = {"r": dict(f="Inter", w=600, s="normal", fill=C["forest"]), "i": dict(f="Lora", w=500, s="italic", fill=C["amber"]),
              "b": dict(f="Inter", w=600, s="normal", fill=C["forest"])}
        ln = wrap_runs(runs, 1000, 24, st)[0]
        w = B.line_width(ln, 24, st) + 36
        y = cy + r - 4
        A(f'<rect x="{f2(cx-w/2)}" y="{f2(y-20)}" width="{f2(w)}" height="40" rx="20" fill="#fffaf0" stroke="{C["gold"]}" stroke-width="1.5"/>')
        A(render_lines([ln], cx - w / 2 + 18, y + 8, 30, 24, st))


def card(A, x, y, w, h, rx=26):
    A(f'<rect x="{f2(x+4)}" y="{f2(y+12)}" width="{f2(w)}" height="{f2(h)}" rx="{rx}" fill="#4a3a14" opacity="0.13" filter="url(#soft)"/>')
    A(f'<rect x="{f2(x)}" y="{f2(y)}" width="{f2(w)}" height="{f2(h)}" rx="{rx}" fill="{lingrad([(0, "#fffef9", 0.95), (1, "#fffaf0", 0.92)], 0, 0, 0, 1)}" stroke="#ead7a6" stroke-width="2"/>')


def bullets(A, items, x, y, maxw, size=25, lh=32, gap=10, col="#4f9a3a"):
    for it in items:
        ln = wrap_runs(parse_runs(it), maxw - 30, size)
        A(leaf_bullet(x + 10, y - 8, 0.85, col))
        A(render_lines(ln, x + 30, y, lh, size))
        y += len(ln) * lh + gap
    return y - gap


def pills(A, items, x, y, maxw, size=24, fill="#eef5e2", stroke="#9cc77a", col="#123d26", h=42, gx=10, gy=12):
    xx, yy = x, y
    for it in items:
        w = tw(it, "Inter", 500, size) + 30
        if xx + w > x + maxw:
            xx, yy = x, yy + h + gy
        A(f'<rect x="{f2(xx)}" y="{yy}" width="{f2(w)}" height="{h}" rx="{h/2}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        A(text(xx + w / 2, yy + h / 2 + 8.5, it, "Inter", 500, size, col, "middle"))
        xx += w + gx
    return yy + h


def wave_band(A, fy, amp=1.0):
    d = (f"M0,{fy+20*amp} C220,{fy-14*amp} 420,{fy+26*amp} 620,{fy+6*amp} C780,{fy-8*amp} 900,{fy+2*amp} {W_},{fy-12*amp}")
    A(f'<path d="{d} L{W_},{H_} L0,{H_}Z" fill="{lingrad([(0, "#174a2d"), (0.6, "#0f3a22"), (1, "#0b2c1a")], 0, 0, 0.3, 1)}"/>')
    A(f'<path d="{d}" fill="none" stroke="{C["gold2"]}" stroke-width="3" opacity="0.85"/>')
    A(f'<g opacity="0.07" stroke="#d3ec8e" fill="none" stroke-width="2">'
      + "".join(f'<path d="M{x},{H_} Q{x+60},{fy+200} {x+180},{fy+60}"/>' for x in range(-100, 1100, 140)) + "</g>")


def wrap_svg(S, title):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="99mm" height="210mm" viewBox="0 0 990 2100">\n'
            f'<title>{esc(title)}</title>\n<defs>\n' + "\n".join(DEFS + [SOFT]) + '\n</defs>\n' + "\n".join(S) + "\n</svg>\n")


def tr(cx, cy, sc, nx, ny):
    """Перенести точку (cx,cy) вихідних координат у (nx,ny) з масштабом sc."""
    return f'translate({f2(nx)},{f2(ny)}) scale({sc}) translate({-cx},{-cy})'


# ============================================================================= декор (з v1-botanica)
def draw_pot_plant(A):
    """Рослина в теракотовому горщику (координати v1: дно горщика ≈ (1192, 1110))."""
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



def draw_flask(A):
    """Колба Ерленмеєра із зеленим екстрактом (дно ≈ (868, 1130))."""
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



def draw_rack(A):
    """Дерев’яний штатив із пробірками (in vitro), низ ≈ (610, 1136)."""
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



# ============================================================================= ЛИЦЬОВА СТОРОНА
def front():
    reset()
    S = []
    A = S.append
    meta = {}
    paper(A)

    # ---------- шапка
    lg = 150
    A(f'<circle cx="{M+lg/2+3}" cy="{48+lg/2+6}" r="{lg/2+4}" fill="{radgrad([(0.8, "#2a3a1a", 0.25), (1, "#2a3a1a", 0)])}"/>')
    A(f'<use href="#dept-logo" x="{M}" y="48" width="{lg}" height="{lg}"/>')
    cw = 126
    A(f'<use href="#nubip-crest" x="{W_-M-cw}" y="50" width="{cw}" height="{f2(cw/0.95)}"/>')
    hc = (M + lg + W_ - M - cw) / 2
    for i, l in enumerate(["Національний університет", "біоресурсів і природокористування", "України (НУБіП України)"]):
        A(text(hc, 84 + i * 30, l, "Inter", 600, 24, C["forest"], "middle"))
        meta.setdefault("hdr_w", []).append(round(tw(l, "Inter", 600, 24)))
    A(f'<rect x="{f2(hc-28)}" y="158" width="56" height="4" rx="2" fill="{C["gold"]}"/>')
    for i, l in enumerate(["Факультет захисту рослин,", "біотехнологій та екології"]):
        A(text(hc, 196 + i * 30, l, "Lora", 500, 25, C["amber"], "middle", extra=' font-style="italic"'))
    meta["hdr_room"] = W_ - 2 * M - lg - cw - 40

    # ---------- назва
    ty = 318
    A(text(M, ty, "КАФЕДРА", "Inter Display", 800, 34, C["leaf"], ls=6))
    tsz = 84
    lines = ["фізіології,", "біохімії рослин", "та біоенергетики"]
    for i, l in enumerate(lines):
        A(text(M, ty + 86 + i * 86, l, "Inter Display", 900, tsz, C["forest"], ls=-1.5))
    meta["title_w"] = round(max(tw(l, "Inter Display", 900, tsz, ls=-1.5) for l in lines))
    tag_y = ty + 86 + 2 * 86 + 60
    tag = "Наука про життя рослин"
    A(text(M, tag_y, tag, "Lora", 500, 36, C["amber"], extra=' font-style="italic"'))
    tag_w = tw(tag, "Lora", 500, 36, "italic")
    A(f'<path d="M{f2(M+tag_w+20)},{tag_y-12} L{f2(M+tag_w+110)},{tag_y-12}" stroke="{C["gold"]}" stroke-width="3" stroke-linecap="round"/>')
    A(f'<circle cx="{f2(M+tag_w+118)}" cy="{tag_y-12}" r="5" fill="{C["gold"]}"/>')

    # ---------- декор: рослина в горщику й колба, фото в кружечках
    ground = 1236
    A(shadow_ellipse(700, ground + 4, 330, 30, "#6b5a2a", 0.22))
    A(f'<g transform="{tr(1192, 1110, 0.6, 808, ground)}">')
    draw_pot_plant(A)
    A('</g>')
    A(f'<g transform="{tr(868, 1130, 0.5, 618, ground + 6)}">')
    draw_flask(A)
    A('</g>')
    bubbles(A, [(690, 690, 16), (720, 640, 10), (930, 690, 12), (650, 760, 9), (900, 760, 20)])

    A(f'<g transform="{tr(610, 1136, 0.5, 150, ground + 2)}">')
    draw_rack(A)
    A('</g>')
    photo(A, 212, 852, 150, "photo-fp-tubes", "Флуоресцентні білки")
    photo(A, 506, 832, 112, "photo-invitro", "Культура __in vitro__")
    photo(A, 424, 1112, 106, "photo-elodea", "Клітини елодеї")

    # ---------- про кафедру
    cy0, cy1 = 1282, 1830
    card(A, M, cy0, W_ - 2 * M, cy1 - cy0)
    A(icon_sprout(M + 62, cy0 + 62))
    A(text(M + 114, cy0 + 58, "Про кафедру", "Inter Display", 800, 40, C["forest"]))
    A(text(M + 114, cy0 + 94, "128 років української школи фізіології рослин", "Lora", 500, 26, C["amber"], extra=' font-style="italic"'))
    about = [
        "Одна з найстаріших і фундаментальних науково-освітніх ланок НУБіП України (від **1898 р.**).",
        "Класична школа фізіології та біохімії рослин і сучасні напрями: клітинна біоінженерія, фітовірусологія, нанобіотехнології, біоенергетика, моніторинг біосистем.",
        "**2 доктори біологічних наук** і **5 кандидатів наук**; 1\u00a0професор і\u00a06\u00a0доцентів.",
        "Викладання українською та англійською мовами; готуємо бакалаврів, магістрів і докторів філософії (PhD).",
        "Студентський науковий гурток **«ФІТОЛАБ»**.",
    ]
    meta["about_end"] = bullets(A, about, M + 30, cy0 + 146, W_ - 2 * M - 60, gap=12)
    meta["about_room"] = cy1 - 28 - meta["about_end"]

    # ---------- нижня смуга із закликом
    wave_band(A, 1858)
    A(leaf(1010, 2010, 150, 54, -150, "lime", bend=0.12, veins=6, opacity=0.9))
    A(leaf(990, 2075, 130, 46, -172, "light", bend=0.1, veins=6, flip=True, opacity=0.85))
    A(text(M, 1940, "Вступай на", "Lora", 500, 34, C["gold2"], extra=' font-style="italic"'))
    A(text(M, 1994, "Біотехнології та біоінженерію", "Inter Display", 800, 46, "#ffffff"))
    A(text(M, 2036, "Бакалаврат · магістратура · PhD", "Inter", 500, 25, "#d9e8cf"))
    meta["cta_w"] = round(tw("Біотехнології та біоінженерію", "Inter Display", 800, 46))
    return wrap_svg(S, "Кафедра фізіології, біохімії рослин та біоенергетики — єврофлаєр, лицьова сторона"), meta


# ============================================================================= ЗВОРОТНА СТОРОНА
def back():
    reset()
    S = []
    A = S.append
    meta = {}
    paper(A)

    # ---------- освітньо-професійна програма
    lg = 112
    A(f'<use href="#dept-logo" x="{W_-M-lg}" y="44" width="{lg}" height="{lg}"/>')
    A(text(M, 118, "Бакалаврат", "Inter Display", 900, 66, C["forest"], ls=-1))
    A(text(M, 166, "Освітньо-професійна програма", "Lora", 500, 30, C["amber"], extra=' font-style="italic"'))
    A(text(M, 204, "«Біотехнології та біоінженерія»", "Lora", 500, 30, C["amber"], extra=' font-style="italic"'))

    ty0 = 236
    tg = 16
    tw_ = (W_ - 2 * M - 2 * tg) / 3
    tiles = [("240", ["кредитів ЄКТС"]), ("3 роки", ["10 місяців,", "денна форма"]), ("162", ["спеціальність", "(G21)"])]
    th = 122
    for i, (big, lab) in enumerate(tiles):
        x = M + i * (tw_ + tg)
        A(f'<rect x="{f2(x)}" y="{ty0}" width="{f2(tw_)}" height="{th}" rx="22" fill="{C["forest"]}"/>')
        A(f'<rect x="{f2(x)}" y="{ty0}" width="{f2(tw_)}" height="{th}" rx="22" fill="{lingrad([(0, "#ffffff", 0.08), (1, "#000000", 0.12)], 0, 0, 0, 1)}"/>')
        A(text(x + 24, ty0 + 54, big, "Inter Display", 800, 48, C["gold2"]))
        for j, l in enumerate(lab):
            A(text(x + 24, ty0 + 86 + j * 26, l, "Inter", 500, 24 if len(lab) == 1 or j == 0 else 24, "#e8f1dc"))
            meta.setdefault("tile_w", []).append(round(tw(l, "Inter", 500, 24) - (tw_ - 40)))
    y = ty0 + th + 48
    prog = [
        "Перший (бакалаврський) рівень; кваліфікація — **бакалавр з біотехнологій та біоінженерії**; вступ на основі повної загальної середньої освіти.",
        "**Три навчальні практики** й **виробнича практика**.",
    ]
    y = bullets(A, prog, M, y, W_ - 2 * M)
    y += 50
    A(text(M, y, "ОБОВ’ЯЗКОВІ ДИСЦИПЛІНИ", "Inter", 600, 24, C["leaf"], ls=2))
    y = pills(A, ["Біохімія", "Біологія клітини", "Фізіологія рослин", "Загальна біотехнологія",
                  "Молекулярна біотехнологія", "Біоінженерія"], M, y + 18, W_ - 2 * M)
    y += 50
    A(text(M, y, "ВИБІРКОВІ БЛОКИ", "Inter", 600, 24, C["leaf"], ls=2))
    meta["sel_y"] = y
    y = pills(A, ["Промислова біотехнологія", "Фітобіотехнологія"], M, y + 18, W_ - 2 * M,
              fill="#fdf1d2", stroke=C["gold"], col="#6b4508")
    y += 40
    phyto = "__Фітобіотехнологія:__ Клітинна біоенергетика, Біологія лікарських рослин, Промислове культивування грибів та водоростей, Біометрія."
    ln = wrap_runs(parse_runs(phyto), 640, 25)
    A(render_lines(ln, M, y, 32, 25))
    y += (len(ln) - 1) * 32 + 46
    y = max(y, meta["sel_y"] + 70 + 100 + 16 + 40)
    mag = "**Далі —** магістратура (освітньо-професійна програма «Екологічна біотехнологія та біоенергетика») і PhD."
    st2 = {**STY, "r": dict(STY["r"], fill="#4d5d51")}
    ln = wrap_runs(parse_runs(mag), W_ - 2 * M, 24, st2)
    A(render_lines(ln, M, y, 31, 24, st2))
    y += (len(ln) - 1) * 31
    meta["prog_end"] = y
    photo(A, W_ - M - 111, meta["sel_y"] + 70, 100, "photo-callus", "Калюс")

    # ---------- лабораторії
    ly = y + 34
    A(leaf(1030, ly + 40, 190, 68, -160, "mid", bend=0.12, veins=7, flip=True, opacity=0.95))
    card(A, M, ly, W_ - 2 * M, 1440 - ly)
    A(text(M + 30, ly + 54, "Лабораторії", "Inter Display", 800, 40, C["forest"]))
    sub = "навчальний корпус № 4"
    A(text(M + 30 + tw("Лабораторії", "Inter Display", 800, 40) + 18, ly + 54, sub, "Lora", 500, 26, C["amber"], extra=' font-style="italic"'))
    labs = [
        ("2021", "Навчально-наукова лабораторія біохімії та фітобіотехнології",
         "ауд. 14 · кваліфікаційні роботи, біотехнологічні дослідження"),
        ("2008", "Навчальна лабораторія біохімії рослин", "ауд. 38"),
        ("2008", "Навчальна лабораторія фізіології рослин", "ауд. 56"),
    ]
    ry = ly + 112
    tx = M + 30 + 84
    maxw = W_ - M - 30 - tx
    nst = {**STY, "r": dict(STY["r"], f="Inter", w=600, fill=C["forest"])}
    dst = {**STY, "r": dict(STY["r"], fill="#4d5d51")}
    for k, (yr, name, det) in enumerate(labs):
        A(f'<rect x="{M+30}" y="{ry-27}" width="66" height="36" rx="18" fill="{C["forest"]}"/>')
        A(text(M + 30 + 33, ry, yr, "Inter Display", 700, 24, C["gold2"], "middle"))
        if det.startswith("ауд.") and "·" not in det:
            ln = wrap_runs(parse_runs(name + " · __" + det + "__"), maxw, 25,
                           {**nst, "i": dict(f="Inter", w=400, s="normal", fill="#4d5d51")})
            A(render_lines(ln, tx, ry, 31, 25, {**nst, "i": dict(f="Inter", w=400, s="normal", fill="#4d5d51")}))
            ry += (len(ln) - 1) * 31
        else:
            ln = wrap_runs(parse_runs(name), maxw, 25, nst)
            A(render_lines(ln, tx, ry, 31, 25, nst))
            ry += len(ln) * 31
            ln = wrap_runs(parse_runs(det), maxw, 24, dst)
            A(render_lines(ln, tx, ry, 30, 24, dst))
            ry += (len(ln) - 1) * 30
        ry += 52
    note = "Робочі місця із сучасним обладнанням для лабораторних і практичних занять."
    ln = wrap_runs(parse_runs("__" + note + "__"), W_ - 2 * M - 60, 25)
    A(render_lines(ln, M + 30, ry - 8, 32, 25))
    meta["labs_end"] = ry - 8 + (len(ln) - 1) * 32
    meta["labs_room"] = 1440 - 26 - meta["labs_end"]

    # ---------- нижня смуга: контакти, QR, авторство фото
    wave_band(A, 1468)
    gold = C["gold2"]
    cy = 1530
    A(f'<path d="M{M+12},{cy+8} C{M},{cy-6} {M+2},{cy-20} {M+12},{cy-20} C{M+22},{cy-20} {M+24},{cy-6} {M+12},{cy+8}Z" fill="{gold}"/>'
      f'<circle cx="{M+12}" cy="{cy-10}" r="4" fill="#0f3a22"/>')
    addr = "03041, м. Київ, вул. Героїв Оборони, 13, навч. корпус № 4, кімн. 13"
    A(text(M + 34, cy, addr, "Inter", 400, 24, "#f4efe0"))
    meta["addr_r"] = round(M + 34 + tw(addr, "Inter", 400, 24))
    c2 = cy + 36
    A(f'<path d="M{M+4},{c2-17} l6,-2 l5,9 l-5,4 c3,6 6,9 11,11 l4,-5 l9,5 l-2,6 c-13,2 -29,-12 -28,-28Z" fill="{gold}"/>')
    tel = "(044) 527-89-66 · 096-977-80-58"
    A(text(M + 38, c2, tel, "Inter", 600, 24, "#ffffff"))
    mx = M + 38 + tw(tel, "Inter", 600, 24) + 30
    A(f'<rect x="{f2(mx)}" y="{c2-16}" width="24" height="17" rx="3" fill="{gold}"/>'
      f'<path d="M{f2(mx+2)},{c2-14} L{f2(mx+12)},{c2-6} L{f2(mx+22)},{c2-14}" stroke="#0f3a22" stroke-width="2" fill="none"/>')
    A(text(mx + 32, c2, "physiol.biochem2021@gmail.com", "Inter", 400, 24, "#ffffff"))
    meta["contact_r"] = round(mx + 32 + tw("physiol.biochem2021@gmail.com", "Inter", 400, 24))

    qs, qg = 270, 40
    qy = 1608
    qrs = [("qr-instagram", "Instagram", "@plant_physio_chair", "ico-instagram"),
           ("qr-facebook", "Ми у Facebook", "Кафедра ФБРтаБ", "ico-facebook"),
           ("qr-nubip", "Сторінка кафедри", "на сайті НУБіП", "ico-web")]
    for i, (qid, l1, l2, ico) in enumerate(qrs):
        x = M + i * (qs + qg)
        A(f'<rect x="{x}" y="{qy+8}" width="{qs}" height="{qs}" rx="6" fill="#020d06" opacity="0.35" filter="url(#soft)"/>')
        A(f'<use href="#{qid}" x="{x}" y="{qy}" width="{qs}" height="{qs}" color="#0f3a22"/>')
        cxq = x + qs / 2
        w1 = tw(l1, "Inter", 600, 24) + 32
        A(f'<use href="#{ico}" x="{f2(cxq-w1/2)}" y="{qy+qs+13}" width="24" height="24"/>')
        A(text(cxq - w1 / 2 + 32, qy + qs + 33, l1, "Inter", 600, 24, "#ffffff"))
        A(text(cxq, qy + qs + 63, l2, "Inter", 400, 24, "#d9e8cf", "middle"))
        meta.setdefault("cap_w", []).append(round(max(w1, tw(l2, "Inter", 400, 24))))
    cred = "Фото: J. C. Fonseca Mata; E. Rodriguez; S. S. Islam; Iripseudocorus — Wikimedia Commons, CC BY-SA 4.0"
    cst = {"r": dict(f="Inter", w=400, s="normal", fill="#b9cdb0"), "b": STY["b"], "i": STY["i"]}
    ln = wrap_runs([(cred, "r")], W_ - 2 * M, 22, cst)
    A(render_lines(ln, M, 1998, 28, 22, cst))
    meta["cred_end"] = 1998 + (len(ln) - 1) * 28
    return wrap_svg(S, "Кафедра фізіології, біохімії рослин та біоенергетики — єврофлаєр, зворотна сторона"), meta


def build_all():
    return [("dl1-botanica-1-front.svg", *front()), ("dl1-botanica-2-back.svg", *back())]


if __name__ == "__main__":
    res = build_all()
    if run_measure():
        res = build_all()
    for name, svg, meta in res:
        (HERE / name).write_text(svg, encoding="utf-8")
        print("wrote", name, {k: (round(v) if isinstance(v, float) else v) for k, v in meta.items()})
