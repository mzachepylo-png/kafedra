"""Збирає спільний набір для флаєрів: kit/symbols.svg (символи) і kit/fonts.css (вбудовані шрифти).

Запуск: python3 kit/make_kit.py  (з папки print/flyer)
"""
import base64, io, pathlib, segno
from fontTools import subset
from fontTools.ttLib import TTFont

KIT = pathlib.Path(__file__).parent
ROOT = KIT.parent.parent.parent  # корінь репозиторію

def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode(pathlib.Path(path).read_bytes()).decode()

# ---------- іконки соцмереж (спрощені фірмові гліфи) ----------
ICO_IG = """<symbol id="ico-instagram" viewBox="0 0 100 100">
  <defs><radialGradient id="ig-grad" cx="0.3" cy="1.07" r="1.3">
    <stop offset="0" stop-color="#fdf497"/><stop offset="0.05" stop-color="#fdf497"/>
    <stop offset="0.45" stop-color="#fd5949"/><stop offset="0.6" stop-color="#d6249f"/>
    <stop offset="0.9" stop-color="#285AEB"/></radialGradient></defs>
  <rect width="100" height="100" rx="24" fill="url(#ig-grad)"/>
  <rect x="22" y="22" width="56" height="56" rx="16" fill="none" stroke="#fff" stroke-width="7"/>
  <circle cx="50" cy="50" r="13.5" fill="none" stroke="#fff" stroke-width="7"/>
  <circle cx="67.5" cy="32.5" r="4.2" fill="#fff"/>
</symbol>"""
ICO_FB = """<symbol id="ico-facebook" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="50" fill="#0866FF"/>
  <path fill="#fff" d="M57.5 100V63.5h12.3l2.3-15.2H57.5v-9.9c0-4.2 2-8.2 8.6-8.2h6.6V17.3s-6-1-11.8-1c-12 0-19.9 7.3-19.9 20.5v11.5H27.7v15.2H41V100z"/>
</symbol>"""
ICO_WEB = """<symbol id="ico-web" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="50" fill="#0B5FA5"/>
  <g fill="none" stroke="#fff" stroke-width="5">
    <circle cx="50" cy="50" r="30"/><ellipse cx="50" cy="50" rx="13" ry="30"/>
    <path d="M20 50h60M24 35h52M24 65h52"/></g>
</symbol>"""

# ---------- QR-коди з логотипом у центрі ----------
LINKS = {
    "instagram": ("https://www.instagram.com/plant_physio_chair/", "#ico-instagram", "rect"),
    "facebook": ("https://www.facebook.com/profile.php?id=61596238078680", "#ico-facebook", "circle"),
    "nubip": ("https://nubip.edu.ua/department/fbr-ta-b", "#nubip-shield", "shield"),
}
QUIET = 3  # тиха зона в модулях (білий фон входить у символ)

def qr_symbol(name, url, logo, shape):
    q = segno.make_qr(url, error="h")
    m = [list(r) for r in q.matrix]
    n = len(m)
    hole = 9 if n >= 37 else 7  # вирізка під логотип, модулі
    a = (n - hole) // 2
    b = a + hole
    d = []
    for y, row in enumerate(m):
        for x, v in enumerate(row):
            if v and not (a <= x < b and a <= y < b):
                d.append(f"M{x + QUIET} {y + QUIET}h1v1h-1z")
    size = n + 2 * QUIET
    c = size / 2
    lw = hole - 1.6  # розмір логотипа
    if shape == "shield":
        lh = lw * 884 / 644 * 0.92
        lw2 = lh * 644 / 884
        logo_el = f'<use href="{logo}" x="{c - lw2 / 2:.3f}" y="{c - lh / 2:.3f}" width="{lw2:.3f}" height="{lh:.3f}"/>'
    else:
        logo_el = f'<use href="{logo}" x="{c - lw / 2:.3f}" y="{c - lw / 2:.3f}" width="{lw:.3f}" height="{lw:.3f}"/>'
    return (f'<symbol id="qr-{name}" viewBox="0 0 {size} {size}">'
            f'<rect width="{size}" height="{size}" rx="{QUIET * 0.6}" fill="#fff"/>'
            f'<path fill="currentColor" shape-rendering="crispEdges" d="{"".join(d)}"/>'
            f'{logo_el}</symbol>')

symbols = [
    f'<symbol id="dept-logo" viewBox="0 0 1024 1024"><image href="{b64(KIT / "dept-logo.png", "image/png")}" width="1024" height="1024"/></symbol>',
    f'<symbol id="nubip-crest" viewBox="0 0 420 442"><image href="{b64(KIT / "nubip-crest.png", "image/png")}" width="420" height="442"/></symbol>',
    f'<symbol id="nubip-shield" viewBox="0 0 644 884"><image href="{b64(KIT / "nubip-shield.png", "image/png")}" width="644" height="884"/></symbol>',
    ICO_IG, ICO_FB, ICO_WEB,
] + [qr_symbol(k, *v) for k, v in LINKS.items()]

# ---------- фото (квадратні кадри для круглих рамок; джерела — kit/photos/CREDITS.md) ----------
for name in ("elodea", "fp-tubes", "invitro", "callus", "fusarium", "lab-students", "invitro-jars"):
    symbols.append(f'<symbol id="photo-{name}" viewBox="0 0 1000 1000">'
                   f'<image href="{b64(KIT / "photos" / (name + ".jpg"), "image/jpeg")}" width="1000" height="1000" '
                   f'preserveAspectRatio="xMidYMid slice"/></symbol>')

# вирізане фото рослини (PNG з прозорістю): Waithamai, CC BY 4.0
symbols.append(f'<symbol id="photo-plant" viewBox="0 0 500 588">'
               f'<image href="{b64(KIT / "photos" / "plant-monstera.png", "image/png")}" width="500" height="588"/></symbol>')
(KIT / "symbols.svg").write_text("\n".join(symbols), encoding="utf-8")

# ---------- шрифти ----------
CYR = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116"
LAT = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
SITE = [  # (family, style, weight, file stem) — шрифти сайту (OFL)
    ("Inter", "normal", "400 600", "inter-normal"),
    ("Lora", "normal", "500 700", "lora-normal"), ("Lora", "italic", "500", "lora-italic"),
    ("Alegreya", "normal", "500 700", "alegreya-normal"), ("Alegreya", "italic", "500", "alegreya-italic"),
    ("IBM Plex Sans", "normal", "400 600", "ibm-plex-sans-normal"), ("IBM Plex Sans", "italic", "400", "ibm-plex-sans-italic"),
    ("JetBrains Mono", "normal", "400 600", "jetbrains-mono-normal"),
]
css = []
for fam, style, w, stem in SITE:
    for part, rng in (("cyrillic", CYR), ("latin", LAT)):
        f = ROOT / "assets/fonts" / f"{stem}-{part}.woff2"
        css.append(f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{w};"
                   f"src:url({b64(f, 'font/woff2')}) format('woff2');unicode-range:{rng}}}")

# Inter Display — жирні накреслення для заголовків (системні OTF → woff2-підмножина)
for w, fname in ((700, "Bold"), (800, "ExtraBold"), (900, "Black")):
    src = f"/usr/share/fonts/opentype/inter/InterDisplay-{fname}.otf"
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]
    font = TTFont(src)
    s = subset.Subsetter(opts)
    s.populate(unicodes=list(range(0x20, 0x250)) + list(range(0x400, 0x460)) + [0x490, 0x491, 0x2013, 0x2014, 0x2019, 0x201C, 0x201D, 0x201E, 0x00AB, 0x00BB, 0x2116, 0x2022, 0x2026, 0x2192, 0x2082, 0x2083, 0x2084, 0x2086])
    s.subset(font)
    buf = io.BytesIO(); font.flavor = "woff2"; font.save(buf)
    css.append(f"@font-face{{font-family:'Inter Display';font-style:normal;font-weight:{w};"
               f"src:url(data:font/woff2;base64,{base64.b64encode(buf.getvalue()).decode()}) format('woff2')}}")
(KIT / "fonts.css").write_text("\n".join(css), encoding="utf-8")
print("kit ok:", len(symbols), "symbols;", len(css), "font faces")
