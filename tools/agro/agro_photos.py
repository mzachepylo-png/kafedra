#!/usr/bin/env python3
"""picks_tNN.json (вибір агентів) → tools/agro/picks.json (для завантаження в Actions) і agro_src/photos.json (для генератора).
   python3 agro_photos.py picks   — оновити tools/agro/picks.json
   python3 agro_photos.py photos  — після завантаження: зібрати photos.json з розмірами файлів
"""
import glob
import html
import json
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))


def cand(key, k):
    meta = json.load(open(f"{ROOT}/tmp/agro/{key}/meta.json", encoding="utf-8"))
    for c in meta["candidates"]:
        if c["k"] == k:
            return c
    raise KeyError(f"{key}/{k}")


def all_picks():
    out = {}
    for f in sorted(glob.glob(f"{HERE}/agro_src/picks_t*.json")):
        for pid, s in json.load(open(f, encoding="utf-8")).items():
            out[pid] = s
    return out


def artist_name(a):
    a = html.unescape(a or "").strip()
    a = re.sub(r"\s+", " ", a.split("\n")[0])
    a = re.sub(r"^real name:\s*", "", a, flags=re.I)
    return a[:80] or "автор невідомий"


def credit(c):
    if "file" in c:  # Commons
        name = artist_name(c.get("artist"))
        lic = c.get("license", "")
        h = f'<a href="{html.escape(c["url"])}" target="_blank" rel="noopener">{html.escape(name)}</a>, Wikimedia Commons · {html.escape(lic)}'
        return h, f"{name}, Wikimedia Commons · {lic}"
    au = c.get("authors") or []
    first = au[0]["last"] if au else ""
    who = f"{first} et al." if len(au) > 2 else " & ".join(a["last"] for a in au) if au else ""
    lic = (c.get("license") or "").upper().replace("CC BY", "CC BY")
    doi = c.get("doi")
    link = f'<a href="https://doi.org/{html.escape(doi)}" target="_blank" rel="noopener">doi:{html.escape(doi)}</a>' if doi else ""
    h = f'{html.escape(who)} ({c.get("year")}), {html.escape(c.get("fig_label", ""))}, <i>{html.escape(c.get("journal_iso") or c.get("journal") or "")}</i> {link} · {html.escape(lic)}'
    p = f'{who} ({c.get("year")}), {c.get("fig_label", "")}, {c.get("journal_iso") or c.get("journal") or ""}, doi:{doi} · {lic}'
    return h, p


def picks():
    P = all_picks()
    out = {}
    for pid, s in P.items():
        try:
            c = cand(s["key"], s["k"])
        except Exception as e:
            print("skip", pid, e)
            continue
        e = {"crop": s.get("crop", [0, 0, 1, 1]), "width": s.get("width", 1100)}
        if s.get("panels"):
            e["panels"] = s["panels"]
        if "file" in c:
            e["thumb"] = c["thumb"]
        else:
            e.update({"urls": [c["img_url"]] if c.get("img_url") else [], "pmcid": c["pmcid"], "href": c["href"]})
        out[pid] = e
    json.dump(out, open(f"{ROOT}/tools/agro/picks.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("picks:", len(out))


def photos():
    P = all_picks()
    out = {}
    for pid, s in P.items():
        path = f"{ROOT}/assets/img/agro/{pid}.webp"
        if not os.path.exists(path):
            print("missing file", pid)
            continue
        c = cand(s["key"], s["k"])
        w, h = Image.open(path).size
        ch, cp = credit(c)
        out[pid] = {"src": f"{pid}.webp", "w": w, "h": h, "caption": s["caption"], "alt": s.get("alt") or re.sub("<[^>]+>", "", s["caption"])[:140],
                    "cred_html": ch, "cred_plain": cp}
    json.dump(out, open(f"{HERE}/agro_src/photos.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("photos:", len(out))


if __name__ == "__main__":
    {"picks": picks, "photos": photos}[sys.argv[1]]()
