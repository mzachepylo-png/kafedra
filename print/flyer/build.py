"""Збирає флаєри: src/<name>.svg → out/<name>.svg (самодостатній вектор), out/<name>.pdf, out/<name>.png
і перевіряє, що всі QR-коди на макеті зчитуються.

Запуск з папки print/flyer:
  python3 build.py            — усі макети
  python3 build.py v1-green   — лише src/v1-green*.svg

У src/*.svg кореневий <svg> має атрибути width/height у мм (напр. width="148mm" height="210mm")
і viewBox (1 мм = 10 одиниць). Символи набору підключаються через <use href="#..."/>:
  #dept-logo  #nubip-crest  #nubip-shield  #qr-instagram  #qr-facebook  #qr-nubip
  #ico-instagram  #ico-facebook  #ico-web
Шрифти (font-family): 'Inter Display' 700/800/900, 'Inter' 400–600, 'Lora' 500–700 + italic 500,
'Alegreya' 500–700 + italic 500, 'IBM Plex Sans' 400–600 + italic 400, 'JetBrains Mono' 400–600.
"""
import pathlib, re, sys
import cv2, numpy as np
import json, subprocess, tempfile

HERE = pathlib.Path(__file__).parent
KIT, SRC, OUT = HERE / "kit", HERE / "src", HERE / "out"
OUT.mkdir(exist_ok=True)
SYMBOLS = (KIT / "symbols.svg").read_text(encoding="utf-8")
FONTS = (KIT / "fonts.css").read_text(encoding="utf-8").splitlines()
URLS = {
    "qr-instagram": "https://www.instagram.com/plant_physio_chair/",
    "qr-facebook": "https://www.facebook.com/profile.php?id=61596238078680",
    "qr-nubip": "https://nubip.edu.ua/department/fbr-ta-b",
}

def assemble(src: str) -> str:
    used = set(re.findall(r"font-family\s*[:=]\s*[\"']?\s*'?([A-Za-z ]+?)'?\s*[,;\"'>]", src))
    css = "\n".join(l for l in FONTS if any(f"font-family:'{u.strip()}'" in l for u in used))
    m = re.search(r"<svg\b[^>]*>", src)
    if 'xmlns:xlink' not in m.group(0):
        head = m.group(0)[:-1] + ' xmlns:xlink="http://www.w3.org/1999/xlink">'
    else:
        head = m.group(0)
    defs = f"<defs><style>{css}</style>{SYMBOLS}</defs>"
    return src[:m.start()] + head + defs + src[m.end():]

def decode_all(png: pathlib.Path, svg: str):
    img = cv2.imread(str(png))
    found = set()
    det = cv2.QRCodeDetector()
    # знаходимо кожен QR за його <use> і декодуємо вирізаний фрагмент
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    sx = img.shape[1] / vb[2]
    for m in re.finditer(r'<use\b[^>]*href="#(qr-\w+)"[^>]*>', svg):
        tag = m.group(0)
        g = lambda a: float(re.search(rf'\b{a}="([-\d.]+)"', tag).group(1)) if re.search(rf'\b{a}="([-\d.]+)"', tag) else None
        x, y, w, h = g("x"), g("y"), g("width"), g("height")
        if None in (x, y, w):
            continue
        h = h or w
        pad = 0.15 * w
        x0, y0 = int((x - pad - vb[0]) * sx), int((y - pad - vb[1]) * sx)
        x1, y1 = int((x + w + pad - vb[0]) * sx), int((y + h + pad - vb[1]) * sx)
        crop = img[max(0, y0):y1, max(0, x0):x1]
        if crop.size == 0:
            continue
        crop = cv2.copyMakeBorder(crop, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255, 255, 255))
        for scale in (1, 0.6, 1.6):
            c = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            txt, *_ = det.detectAndDecode(c)
            if txt:
                found.add(txt); break
    ok, texts, *_ = det.detectAndDecodeMulti(img)
    if ok:
        found |= {t for t in texts if t}
    return found

def build(paths):
    jobs, meta = [], []
    for path in paths:
        src = path.read_text(encoding="utf-8")
        svg = assemble(src)
        out_svg = OUT / path.name
        out_svg.write_text(svg, encoding="utf-8")
        root = re.search(r"<svg\b[^>]*>", src).group(0)
        wmm = float(re.search(r'width="([\d.]+)mm"', root).group(1))
        hmm = float(re.search(r'height="([\d.]+)mm"', root).group(1))
        vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', root).group(1).split()]
        png, pdf = OUT / (path.stem + ".png"), OUT / (path.stem + ".pdf")
        jobs.append(dict(svg=str(out_svg), png=str(png), pdf=str(pdf), pw=int(round(vb[2])),
                         ph=int(round(vb[3])), wmm=wmm, hmm=hmm))
        meta.append((path, src, svg, out_svg, png, wmm, hmm))
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(jobs, f)
    subprocess.run(["node", str(KIT / "render.js"), f.name], check=True)
    for path, src, svg, out_svg, png, wmm, hmm in meta:
        used = set(re.findall(r'href="#(qr-\w+)"', src))
        found = decode_all(png, svg)
        bad = {URLS[u] for u in used} - found
        kb = out_svg.stat().st_size // 1024
        status = "QR OK" if not bad else "QR FAIL: " + ", ".join(sorted(bad))
        print(f"{path.name}: {wmm:g}x{hmm:g} mm, svg {kb} KB, {len(used)} QR — {status}")

if __name__ == "__main__":
    pat = sys.argv[1] if len(sys.argv) > 1 else ""
    paths = sorted(SRC.glob(f"{pat}*.svg"))
    if not paths:
        sys.exit("немає src/*.svg")
    build(paths)
