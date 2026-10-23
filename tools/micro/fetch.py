#!/usr/bin/env python3
"""Тимчасовий помічник для сторінки «Під мікроскопом» (запускається в GitHub Actions).

candidates [ids]  — шукає статті відкритого доступу (Europe PMC, ліцензії CC) з мікрофото
                    збудників, зберігає мініатюри рисунків і метадані в tmp/micro/.
final             — за tools/micro/selection.json завантажує обрані рисунки, обрізає
                    та зберігає WebP у assets/img/micro/.
"""
import json
import os
import re
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from io import BytesIO

from PIL import Image

Image.MAX_IMAGE_PIXELS = 200_000_000

UA = "kafedra-site/1.0 (+https://github.com/mzachepylo-png/kafedra)"
BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest"
XLINK = "{http://www.w3.org/1999/xlink}href"
OK_LIC = {"cc by", "cc0", "cc by-sa"}
FALLBACK_LIC = {"cc by-nc", "cc by-nc-sa"}

FIGQ = ('FIG:(microscop* OR micrograph* OR "scanning electron" OR "transmission electron" '
        'OR hyphae OR conidia OR spores OR sporangia OR bacteria)')

MICRO = [re.compile(p, f) for p, f in [
    (r"scanning electron", re.I), (r"transmission electron", re.I), (r"electron micrograph", re.I),
    (r"micrograph", re.I), (r"microscop", re.I), (r"confocal", re.I), (r"\bSEM\b", 0), (r"\bTEM\b", 0),
    (r"cryo-?SEM", re.I), (r"bright-?field", re.I), (r"trypan blue", re.I), (r"calcofluor", re.I),
    (r"lactophenol", re.I), (r"aniline blue", re.I), (r"\bDIC\b", 0), (r"scale bars?", re.I),
]]
STRUCT = ["hypha", "mycel", "conidi", "spore", "sporang", "haustori", "appressori", "pycnidi", "perithec",
          "ascospor", "teliospor", "uredini", "oospor", "sclerot", "infection cushion", "germ tube", "bacteri",
          "cells", "virion", "virus particle", "particles", "inclusion", "stomat", "chlamydospor", "zoospor",
          "chasmothec", "cleistothec", "pustule", "coloniz", "colonis"]
NEG = ["phylogen", " tree", "qpcr", "rt-pcr", "pcr product", "electrophoresis", "agarose", "expression level",
       "relative expression", "heat map", "heatmap", "boxplot", "box plot", "western blot", "schematic",
       "workflow", "pathway", "venn", "alignment", "genome", "chromosom", "principal component", "regression",
       "correlation", "histogram", "kegg", "enrichment", "volcano", "dendrogram", "bar chart", "growth curve",
       "distribution map", "flowchart", "model of", "transcript", "mutant", "knockout", "deletion"]


def http(url, tries=3, timeout=60, ua=UA):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (403, 404, 410):
                break
            time.sleep(1.5 * (i + 1))
        except Exception as e:  # мережеві збої — повторюємо
            last = e
            time.sleep(1.5 * (i + 1))
    raise last


def jget(url):
    return json.loads(http(url).decode("utf-8"))


def text(el):
    if el is None:
        return ""
    t = " ".join(" ".join(el.itertext()).split())
    return re.sub(r"\s+([.,;:)\]])", r"\1", re.sub(r"([(\[])\s+", r"\1", t))


def score(caption, d, title=""):
    c = " " + caption.lower() + " "
    s = 3 * min(2, sum(bool(p.search(caption)) for p in MICRO))
    s += 2 * min(3, sum(k in c for k in STRUCT))
    s += 2 * min(2, sum(k.lower() in c for k in d.get("bonus", [])))
    s -= 4 * sum(k in c for k in NEG)
    if any(t.split()[0].lower() in c for t in d["terms"]):
        s += 1
    if any(t.lower() in (title or "").lower() for t in d["terms"]):
        s += 2
    return s


def epmc_search(d):
    t = " OR ".join(f'"{x}"' for x in d["terms"])
    base = f"(TITLE:({t}) OR ABSTRACT:({t}))"
    if d.get("extra"):
        base += f' AND ({d["extra"]})'
    for q in (f"{base} AND OPEN_ACCESS:y AND IN_EPMC:y AND {FIGQ}", f"{base} AND OPEN_ACCESS:y AND IN_EPMC:y"):
        url = f"{EPMC}/search?" + urllib.parse.urlencode(
            {"query": q, "format": "json", "resultType": "core", "pageSize": 40, "synonym": "false"})
        try:
            res = jget(url)
        except Exception as e:
            print("  search error:", e)
            continue
        out = res.get("resultList", {}).get("result", [])
        print(f"  hits={res.get('hitCount')} for {q[:140]}")
        if out:
            return out
    return []


def figures(pmcid):
    root = ET.fromstring(http(f"{EPMC}/{pmcid}/fullTextXML"))
    figs = []
    for fig in root.iter("fig"):
        g = fig.find(".//graphic")
        href = g.get(XLINK) if g is not None else None
        if href:
            figs.append({"label": text(fig.find("label")), "caption": text(fig.find("caption")), "href": href})
    return figs


def art_meta(r):
    ji = r.get("journalInfo") or {}
    j = ji.get("journal") or {}
    authors = [{"last": a.get("lastName"), "initials": a.get("initials"), "first": a.get("firstName"),
                "full": a.get("fullName"), "collective": a.get("collectiveName")}
               for a in (r.get("authorList") or {}).get("author", [])]
    return {"pmcid": r.get("pmcid"), "doi": r.get("doi"), "title": r.get("title"), "authors": authors,
            "journal": j.get("title"), "journal_iso": j.get("isoabbreviation"), "volume": ji.get("volume"),
            "issue": ji.get("issue"), "year": ji.get("yearOfPublication") or r.get("pubYear"),
            "pages": r.get("pageInfo"), "license": r.get("license"), "first_pub": r.get("firstPublicationDate")}


def crossref(doi):
    try:
        m = jget("https://api.crossref.org/works/" + urllib.parse.quote(doi))["message"]
    except Exception as e:
        return {"error": str(e)}

    def dp(k):
        return (m.get(k) or {}).get("date-parts", [[None]])[0]

    return {"title": (m.get("title") or [""])[0], "container": (m.get("container-title") or [""])[0],
            "volume": m.get("volume"), "issue": m.get("issue"), "page": m.get("page"),
            "article_number": m.get("article-number"),
            "authors": [{"given": a.get("given"), "family": a.get("family"), "name": a.get("name")}
                        for a in m.get("author", [])],
            "issued": dp("issued"), "published_online": dp("published-online"), "published_print": dp("published-print")}


_PAGE, _TGZ = {}, {}
IMG_EXT = re.compile(r"\.(jpe?g|png|gif|tiff?)$", re.I)


def _open(data):
    im = Image.open(BytesIO(data))
    im.load()
    return im


def _err(tag, e):
    return f"{tag}:{type(e).__name__}:{getattr(e, 'code', '')}"


def fig_image(pmcid, href):
    """Рисунок статті: Europe PMC → сторінка PMC (CDN) → архів OA-пакета."""
    base = href.rsplit("/", 1)[-1]
    stem = IMG_EXT.sub("", base)
    names = [base] if base != stem else [stem + ".jpg", stem + ".png", stem + ".gif"]
    errors = []
    for n in names:
        url = f"https://europepmc.org/articles/{pmcid}/bin/{n}"
        try:
            return _open(http(url, tries=1, ua=BROWSER_UA)), url
        except Exception as e:
            errors.append(_err("epmc", e))
    try:
        if pmcid not in _PAGE:
            _PAGE[pmcid] = http(f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/", tries=2,
                                ua=BROWSER_UA).decode("utf-8", "replace")
        m = re.search(r"https://cdn\.ncbi\.nlm\.nih\.gov/pmc/blobs/[^\"'\s]+/" + re.escape(stem)
                      + r"\.(?:jpe?g|png|gif)", _PAGE[pmcid])
        if m:
            return _open(http(m.group(0), tries=2, ua=BROWSER_UA)), m.group(0)
        errors.append("pmc:no-link")
    except Exception as e:
        _PAGE.setdefault(pmcid, "")
        errors.append(_err("pmc", e))
    try:
        if pmcid not in _TGZ:
            _TGZ[pmcid] = None
            oa = http(f"https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi?id={pmcid}", tries=2).decode()
            m = re.search(r'href="([^"]+\.tar\.gz)"', oa)
            if m:
                link = m.group(1).replace("ftp://", "https://")
                _TGZ[pmcid] = tarfile.open(fileobj=BytesIO(http(link, tries=2, timeout=240)), mode="r:gz")
        tf = _TGZ[pmcid]
        if tf is not None:
            for mem in tf.getmembers():
                nm = mem.name.rsplit("/", 1)[-1]
                if mem.isfile() and IMG_EXT.sub("", nm) == stem and IMG_EXT.search(nm):
                    return _open(tf.extractfile(mem).read()), f"oa-package:{pmcid}/{nm}"
            errors.append("tgz:no-member")
        else:
            errors.append("tgz:no-link")
    except Exception as e:
        errors.append(_err("tgz", e))
    print("  image fail", pmcid, base, " ".join(errors))
    return None, None


def save_thumb(im, path, width=640):
    im = im.convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(path, "JPEG", quality=66, optimize=True, progressive=True)


def commons(d, k, outdir, n):
    q = f'"{d["terms"][0]}" filetype:bitmap'
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
        {"action": "query", "format": "json", "generator": "search", "gsrsearch": q, "gsrnamespace": 6,
         "gsrlimit": 25, "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 640})
    try:
        pages = jget(url).get("query", {}).get("pages", {})
    except Exception as e:
        print("  commons error:", e)
        return []
    items = []
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata") or {}

        def g(key):
            return re.sub(r"<[^>]+>", "", str((em.get(key) or {}).get("value", ""))).strip()

        desc = g("ImageDescription")
        items.append((score(desc + " " + p.get("title", ""), d), p, ii, {
            "artist": g("Artist"), "license": g("LicenseShortName"), "license_url": g("LicenseUrl"),
            "credit": g("Credit")[:400], "description": desc[:700], "date": g("DateTimeOriginal")}))
    items.sort(key=lambda x: -x[0])
    out = []
    for sc, p, ii, m in items:
        if len(out) >= n or sc < 4:
            break
        try:
            im = Image.open(BytesIO(http(ii.get("thumburl") or ii["url"])))
            im.load()
        except Exception as e:
            print("  commons image fail:", p.get("title"), e)
            continue
        k += 1
        save_thumb(im, f"{outdir}/{k}.jpg")
        out.append({"k": k, "source": "commons", "score": sc, "file": p.get("title"), "page": ii.get("descriptionurl"),
                    "img_url": ii.get("url"), "thumb_url": ii.get("thumburl"),
                    "orig_size": [ii.get("width"), ii.get("height")], **m})
    return out


def candidates(only):
    ds = json.load(open("tools/micro/candidates.json", encoding="utf-8"))
    os.makedirs("tmp/micro", exist_ok=True)
    for d in ds:
        if only and d["id"] not in only:
            continue
        print(f"== {d['id']}")
        outdir = f"tmp/micro/{d['id']}"
        os.makedirs(outdir, exist_ok=True)
        for f in os.listdir(outdir):
            os.remove(os.path.join(outdir, f))
        pool, checked = [], 0
        for r in epmc_search(d):
            lic = (r.get("license") or "").lower()
            if lic not in OK_LIC | FALLBACK_LIC or not r.get("pmcid"):
                continue
            if checked >= 14:
                break
            checked += 1
            try:
                figs = figures(r["pmcid"])
            except Exception as e:
                print("  xml error", r.get("pmcid"), e)
                continue
            meta = art_meta(r)
            for f in figs:
                sc = score(f["caption"], d, meta["title"]) - (2 if lic in FALLBACK_LIC else 0)
                if sc >= 5:
                    pool.append((sc, meta, f))
            time.sleep(0.3)
        pool.sort(key=lambda x: -x[0])
        order, seen = [], set()
        for item in pool:
            if item[1]["pmcid"] not in seen:
                order.append(item)
                seen.add(item[1]["pmcid"])
        order += [item for item in pool if item not in order]
        cands, k, tried = [], 0, 0
        for sc, meta, f in order:
            if k >= 4 or tried >= 10:
                break
            tried += 1
            im, url = fig_image(meta["pmcid"], f["href"])
            if im is None:
                continue
            k += 1
            save_thumb(im, f"{outdir}/{k}.jpg")
            cands.append({"k": k, "source": "epmc", "score": sc, **meta, "fig_label": f["label"],
                          "caption": f["caption"], "href": f["href"], "img_url": url,
                          "orig_size": [im.width, im.height],
                          "crossref": crossref(meta["doi"]) if meta.get("doi") else {}})
        if len(cands) < 3:
            cands += commons(d, k, outdir, 3 - len(cands))
        with open(f"{outdir}/meta.json", "w", encoding="utf-8") as fh:
            json.dump({"id": d["id"], "name": d["name"], "candidates": cands}, fh, ensure_ascii=False, indent=1)
        print(f"  saved {len(cands)} candidates")

    lines = []
    for d in ds:
        p = f"tmp/micro/{d['id']}/meta.json"
        if not os.path.exists(p):
            continue
        m = json.load(open(p, encoding="utf-8"))
        lines.append(f"## {d['id']} — {d['name']} ({len(m['candidates'])})")
        for c in m["candidates"]:
            if c["source"] == "epmc":
                lines.append(f"[{c['k']}] s={c['score']} {c['license']} {c['pmcid']} {c.get('journal')} {c.get('year')}"
                             f" | {c['fig_label']} | {c['caption'][:420]}")
            else:
                lines.append(f"[{c['k']}] s={c['score']} commons {c['license']} {c['file']} | {c['description'][:300]}")
        lines.append("")
    with open("tmp/micro/summary.md", "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def articles(only):
    """Усі рисунки з мікроскопією з конкретних статей (tools/micro/articles.json: {id: [PMCID, ...]})."""
    spec = json.load(open("tools/micro/articles.json", encoding="utf-8"))
    ds = {d["id"]: d for d in json.load(open("tools/micro/candidates.json", encoding="utf-8"))}
    for did, pmcids in spec.items():
        if only and did not in only:
            continue
        d = ds.get(did, {"id": did, "terms": [did], "bonus": []})
        outdir = f"tmp/micro/{did}"
        os.makedirs(outdir, exist_ok=True)
        for f in os.listdir(outdir):
            if f.startswith("a"):
                os.remove(os.path.join(outdir, f))
        cands, k = [], 0
        for pmcid in pmcids:
            url = f"{EPMC}/search?" + urllib.parse.urlencode(
                {"query": f"PMCID:{pmcid}", "format": "json", "resultType": "core"})
            try:
                res = jget(url)["resultList"]["result"]
                meta = art_meta(res[0]) if res else {"pmcid": pmcid}
                figs = figures(pmcid)
            except Exception as e:
                print("  error", pmcid, e)
                continue
            scored = sorted(((score(f["caption"], d, meta.get("title") or ""), f) for f in figs), key=lambda x: -x[0])
            for sc, f in scored[:4]:
                if sc < 3:
                    continue
                im, img_url = fig_image(pmcid, f["href"])
                if im is None:
                    continue
                k += 1
                save_thumb(im, f"{outdir}/a{k}.jpg")
                cands.append({"k": f"a{k}", "source": "epmc", "score": sc, **meta, "fig_label": f["label"],
                              "caption": f["caption"], "href": f["href"], "img_url": img_url,
                              "orig_size": [im.width, im.height],
                              "crossref": crossref(meta["doi"]) if meta.get("doi") else {}})
        with open(f"{outdir}/meta_articles.json", "w", encoding="utf-8") as fh:
            json.dump({"id": did, "candidates": cands}, fh, ensure_ascii=False, indent=1)
        print(f"== {did}: {len(cands)} figures")
        for c in cands:
            print(f"  [{c['k']}] s={c['score']} {c.get('license')} {c['pmcid']} | {c['fig_label']} | {c['caption'][:300]}")


def final():
    sel = json.load(open("tools/micro/selection.json", encoding="utf-8"))
    os.makedirs("assets/img/micro", exist_ok=True)
    for s in sel:
        im = None
        if s.get("pmcid"):
            im, _ = fig_image(s["pmcid"], s["href"])
        else:
            for url in [s["img_url"]] + s.get("fallback_urls", []):
                try:
                    im = _open(http(url))
                    break
                except Exception as e:
                    print("  fail", s["id"], url, e)
        if im is None:
            continue
        im = im.convert("RGB")
        if s.get("crop"):
            x0, y0, x1, y1 = s["crop"]
            im = im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))
        w = s.get("width", 960)
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        out = f"assets/img/micro/{s['id']}.webp"
        im.save(out, "WEBP", quality=s.get("quality", 74), method=6)
        print(s["id"], im.size, os.path.getsize(out))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "candidates"
    only = {x for x in (sys.argv[2] if len(sys.argv) > 2 else "").split(",") if x}
    if mode == "final":
        final()
    elif mode == "articles":
        articles(only)
    else:
        candidates(only)
