#!/usr/bin/env python3
"""Тимчасово: фото для статті й моделі «Allium cepa тест» (запускається в GitHub Actions).

search [keys] — Europe PMC (відкриті статті CC BY / CC0 / CC BY-SA) і Wikimedia Commons:
                мініатюри рисунків з підписами → tmp/allium/<key>/, аркуші-огляди tmp/allium/sheet_<key>.jpg
final         — за tools/allium/picks.json вирізає обрані панелі й зберігає WebP в assets/img/allium/
"""
import json
import os
import re
import sys
import time
import urllib.parse
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, "tools/micro")
import fetch as M  # noqa: E402  (спільні помічники: Europe PMC, рисунки статей, Crossref)

OUT = "tmp/allium"
GOOD = ["anaphase", "telophase", "metaphase", "prophase", "bridge", "fragment", "lagg", "laggard", "sticky",
        "stickiness", "c-mitosis", "c-metaphase", "micronucle", "binucle", "vagrant", "disturbed", "aberration",
        "polyploid", "multipolar", "nuclear bud", "notched", "lobulated", "mitotic", "meristem", "root tip",
        "chromosom", "onion root", "roots", "root length", "root growth", "bulb", "phytotox", "comet", "evans blue",
        "abnormal", "normal mitotic", "interphase", "cytokinesis", "anomal", "breaks", "ring chromosome", "spindle"]
BAD = ["phylogen", "qpcr", "rt-pcr", "electrophoresis", "agarose", "expression level", "heat map", "heatmap",
       "western blot", "workflow", "pathway", "venn", "alignment", "principal component", "regression",
       "correlation", "histogram", "kegg", "enrichment", "volcano", "dendrogram", "ftir", "xrd", "uv-vis",
       "uv–vis", "spectrum", "spectra", "chromatogram", "hplc", "gc-ms", "zeta", "dls", "graphical abstract",
       "molecular docking", "docking", "flowchart", "schematic", "map of", "sampling", "study area"]


def score(caption):
    c = " " + caption.lower() + " "
    s = sum(2 for k in GOOD if k in c)
    s -= sum(4 for k in BAD if k in c)
    if re.search(r"\bscale bar|µm|μm|×\s?\d{2,4}|x\s?1000|magnification|40×|100×|1000×", c):
        s += 2
    return s


def label_font(size=15):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def sheet(key, items):
    if not items:
        return
    W, H, cols = 330, 250, 4
    rows = (len(items) + cols - 1) // cols
    sh = Image.new("RGB", (cols * W, rows * (H + 22)), "white")
    dr, f = ImageDraw.Draw(sh), label_font()
    for i, (name, im) in enumerate(items):
        t = im.copy()
        t.thumbnail((W - 8, H - 4))
        x, y = (i % cols) * W, (i // cols) * (H + 22)
        dr.text((x + 4, y + 2), name, fill="black", font=f)
        sh.paste(t, (x + (W - t.width) // 2, y + 22 + (H - t.height) // 2))
    sh.save(f"{OUT}/sheet_{key}.jpg", quality=72)


def epmc(key, q, per_art=2, max_arts=10, max_imgs=10):
    outdir = f"{OUT}/{key}"
    os.makedirs(outdir, exist_ok=True)
    url = f"{M.EPMC}/search?" + urllib.parse.urlencode(
        {"query": f"({q}) AND OPEN_ACCESS:y AND IN_EPMC:y", "format": "json", "resultType": "core",
         "pageSize": 60, "synonym": "false", "sort": "CITED desc"})
    try:
        res = M.jget(url)["resultList"]["result"]
    except Exception as e:
        print("  search error", e)
        return [], []
    arts = [r for r in res if (r.get("license") or "").lower() in M.OK_LIC and r.get("pmcid")][:max_arts]
    print(f"== {key}: {len(res)} hits, {len(arts)} open")
    pool = []
    for r in arts:
        meta = M.art_meta(r)
        try:
            figs = M.figures(r["pmcid"])
        except Exception as e:
            print("  xml error", r.get("pmcid"), e)
            continue
        sc = sorted(((score(f["caption"]), f) for f in figs), key=lambda x: -x[0])
        pool += [(s, meta, f) for s, f in sc[:per_art] if s >= 4]
        time.sleep(0.25)
    pool.sort(key=lambda x: -x[0])
    cands, items, k = [], [], 0
    for s, meta, f in pool:
        if k >= max_imgs:
            break
        im, src = M.fig_image(meta["pmcid"], f["href"])
        if im is None:
            continue
        k += 1
        name = f"{key}/e{k}"
        M.save_thumb(im, f"{outdir}/e{k}.jpg", width=900)
        items.append((name, im.convert("RGB")))
        cands.append({"k": f"e{k}", "score": s, **meta, "fig_label": f["label"], "caption": f["caption"],
                      "href": f["href"], "img_url": src, "orig_size": [im.width, im.height]})
        print(f"  [e{k}] s={s} {meta['license']} {meta['pmcid']} {meta.get('journal_iso')} {meta.get('year')}"
              f" | {f['label']} | {f['caption'][:240]}")
    return cands, items


def commons(key, q, n=8):
    outdir = f"{OUT}/{key}"
    os.makedirs(outdir, exist_ok=True)
    api = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
        {"action": "query", "format": "json", "generator": "search", "gsrsearch": q + " filetype:bitmap",
         "gsrnamespace": 6, "gsrlimit": 16, "prop": "imageinfo", "iiprop": "url|extmetadata|size",
         "iiurlwidth": 1200})
    try:
        d = json.loads(M.http(api, ua="kafedra-nubip-edu/1.0 (https://github.com/mzachepylo-png/kafedra; educational)"))
    except Exception as e:
        print("  commons error", e)
        return [], []
    pages = sorted(d.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    cands, items, k = [], [], 0
    for p in pages:
        if k >= n:
            break
        ii = p["imageinfo"][0]
        em = ii.get("extmetadata", {})
        lic = em.get("LicenseShortName", {}).get("value", "")
        if not re.search(r"CC BY|CC0|Public domain|PD", lic, re.I) or re.search(r"\bNC\b|ND", lic):
            continue
        if ii["width"] < 500:
            continue
        try:
            im = M._open(M.http(ii["thumburl"], ua="kafedra-nubip-edu/1.0 (educational)")).convert("RGB")
        except Exception:
            continue
        k += 1
        M.save_thumb(im, f"{outdir}/c{k}.jpg", width=900)
        items.append((f"{key}/c{k}", im))
        desc = re.sub("<[^>]+>", "", em.get("ImageDescription", {}).get("value", ""))[:300]
        artist = re.sub("<[^>]+>", "", em.get("Artist", {}).get("value", ""))
        cands.append({"k": f"c{k}", "file": p["title"], "url": ii["descriptionurl"], "thumb": ii["thumburl"],
                      "w": ii["width"], "h": ii["height"], "artist": artist, "license": lic, "description": desc})
        print(f"  [c{k}] {lic} {p['title']} | {artist} | {desc[:160]}")
        time.sleep(0.8)
    return cands, items


def search(only):
    Q = json.load(open("tools/allium/queries.json", encoding="utf-8"))
    if os.path.exists("tools/allium/queries2.json"):
        Q.update(json.load(open("tools/allium/queries2.json", encoding="utf-8")))
    os.makedirs(OUT, exist_ok=True)
    for key, spec in Q.items():
        if only and key not in only:
            continue
        cands, items = (commons(key, spec["commons"]) if "commons" in spec else epmc(key, spec["epmc"]))
        sheet(key, items)
        with open(f"{OUT}/{key}/meta.json", "w", encoding="utf-8") as fh:
            json.dump({"key": key, "query": spec, "candidates": cands}, fh, ensure_ascii=False, indent=1)


def arts(only):
    """Усі рисунки статей зі списку tools/allium/arts.json ({key: [PMCID, ...]}), лише відкриті ліцензії."""
    spec = json.load(open("tools/allium/arts.json", encoding="utf-8"))
    for key, ids in spec.items():
        if only and key not in only:
            continue
        outdir = f"{OUT}/{key}"
        os.makedirs(outdir, exist_ok=True)
        cands, items, k = [], [], 0
        for pmcid in ids:
            try:
                r = M.jget(f"{M.EPMC}/search?" + urllib.parse.urlencode({"query": f"PMCID:{pmcid}", "format": "json", "resultType": "core"}))["resultList"]["result"][0]
            except Exception as e:
                print("  meta error", pmcid, e)
                continue
            meta = M.art_meta(r)
            if (meta.get("license") or "").lower() not in M.OK_LIC:
                print("  skip licence", pmcid, meta.get("license"))
                continue
            try:
                figs = M.figures(pmcid)
            except Exception as e:
                print("  xml error", pmcid, e)
                continue
            for f in figs[:10]:
                if score(f["caption"]) < 0:
                    continue
                im, src = M.fig_image(pmcid, f["href"])
                if im is None:
                    continue
                k += 1
                M.save_thumb(im, f"{outdir}/a{k}.jpg", width=900)
                items.append((f"{key}/a{k}", im.convert("RGB")))
                cands.append({"k": f"a{k}", "score": score(f["caption"]), **meta, "fig_label": f["label"], "caption": f["caption"],
                              "href": f["href"], "img_url": src, "orig_size": [im.width, im.height]})
                print(f"  [a{k}] {meta['license']} {pmcid} {f['label']} | {f['caption'][:200]}")
        sheet(key, items)
        with open(f"{outdir}/meta.json", "w", encoding="utf-8") as fh:
            json.dump({"key": key, "candidates": cands}, fh, ensure_ascii=False, indent=1)


def final():
    picks = json.load(open("tools/allium/picks.json", encoding="utf-8"))
    os.makedirs("assets/img/allium", exist_ok=True)
    report = {}
    for pid, s in picks.items():
        im = None
        if s.get("thumb"):
            try:
                im = M._open(M.http(s["thumb"], ua="kafedra-nubip-edu/1.0 (educational)"))
            except Exception as e:
                print("  fail", pid, e)
        elif s.get("pmcid"):
            im, _ = M.fig_image(s["pmcid"], s["href"])
        if im is None:
            print("  SKIP", pid)
            continue
        im = im.convert("RGB")
        boxes = s.get("panels") or [s.get("crop", [0, 0, 1, 1])]
        parts = [im.crop((round(a * im.width), round(b * im.height), round(c * im.width), round(d * im.height)))
                 for a, b, c, d in boxes]
        if len(parts) > 1:
            h = min(p.height for p in parts)
            parts = [p.resize((round(p.width * h / p.height), h), Image.LANCZOS) for p in parts]
            gap = max(4, h // 100)
            out = Image.new("RGB", (sum(p.width for p in parts) + gap * (len(parts) - 1), h), (14, 26, 18))
            x = 0
            for p in parts:
                out.paste(p, (x, 0))
                x += p.width + gap
            im = out
        else:
            im = parts[0]
        w = s.get("width", 1000)
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        path = f"assets/img/allium/{pid}.webp"
        im.save(path, "WEBP", quality=s.get("quality", 78), method=6)
        report[pid] = {"size": list(im.size), "bytes": os.path.getsize(path)}
        print(pid, im.size, os.path.getsize(path))
    with open(f"{OUT}/final.json", "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1)


if __name__ == "__main__":
    mode = sys.argv[1:] or (open("tools/allium/mode.txt").read().split() if os.path.exists("tools/allium/mode.txt") else ["search"])
    if mode[0] == "final":
        final()
    elif mode[0] == "arts":
        arts({x for x in (mode[1] if len(mode) > 1 else "").split(",") if x})
    else:
        search({x for x in (mode[1] if len(mode) > 1 else "").split(",") if x})
    print("done", mode)
