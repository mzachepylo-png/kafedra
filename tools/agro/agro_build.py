#!/usr/bin/env python3
"""Генерує сторінки предмета «Біотехнології в агросфері»: хаб lab/agrobiotech/ і 13 тем.

Джерела (у цій же теці agro_src/):
  topics.json        — перелік тем
  tNN.html           — вміст теми: секції <section class="lab-section" id="..."><h2>…</h2>…</section>
                       (перший рядок може бути <!--meta {...}--> з lead, desc, badges)
  book_photos.json   — ілюстрації з посібника (id → src, w, h, caption, cred)
  photos.json        — фото з відкритою ліцензією (id → src, w, h, caption, cred_html, cred_plain, alt)
  authors.json       — автори посібника
Плейсхолдери у вмісті:
  {{photos:id1,id2,...}}  або  {{photos:id1,id2|cp-gal--2}} — галерея фото (з лайтбоксом і підписами)
  {{photo:id}}             — одне фото на всю ширину
  id з посібника пишуться як book:<id>.
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "agro_src")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BASE = "lab/agrobiotech"
TEMPLATE = os.path.join(ROOT, "lab/test-systems/allium-cepa/index.html")   # сторінка тієї ж глибини

topics = json.load(open(os.path.join(SRC, "topics.json"), encoding="utf-8"))
book = json.load(open(os.path.join(SRC, "book_photos.json"), encoding="utf-8"))
photos = json.load(open(os.path.join(SRC, "photos.json"), encoding="utf-8")) if os.path.exists(os.path.join(SRC, "photos.json")) else {}
authors = json.load(open(os.path.join(SRC, "authors.json"), encoding="utf-8")) if os.path.exists(os.path.join(SRC, "authors.json")) else []

PUBLISHED = set(json.load(open(os.path.join(SRC, "published.json")))) if os.path.exists(os.path.join(SRC, "published.json")) else set()
tpl = open(TEMPLATE, encoding="utf-8").read()
HEAD_END = tpl.index("</head>")
HEADER = tpl[tpl.index("<body>"):tpl.index("<main")]
FOOTER = tpl[tpl.index("</main>") + len("</main>"):tpl.index("</footer>") + len("</footer>")]
GA = tpl[tpl.index("<meta charset"):tpl.index("<title>")]


def esc(s):
    return html.escape(s, quote=True)


def plain(s):
    return re.sub(r"<[^>]+>", "", s)


def depth_prefix(depth):
    return "../" * depth


def photo_rec(pid):
    if pid.startswith("book:"):
        b = book[pid[5:]]
        return dict(src=b["src"], w=b["w"], h=b["h"], caption=b["caption"], alt=plain(b["caption"])[:140],
                    cred_html=esc(b["cred"]), cred_plain=b["cred"], book=True)
    p = photos[pid]
    return dict(p, book=False)


def figure(pid, pre):
    p = photo_rec(pid)
    src = f"{pre}assets/img/agro/{p['src']}"
    cap_plain = plain(p["caption"]) + " " + ("Джерело: " if p["book"] else "Фото: ") + plain(p["cred_plain"])
    cls = "cp cp--book" if p["book"] else "cp"
    return (f'<figure class="{cls}"><a href="{src}" data-lightbox data-caption="{esc(cap_plain)}" aria-label="Відкрити фото в повному розмірі">'
            f'<img src="{src}" alt="{esc(p.get("alt") or plain(p["caption"])[:140])}" width="{p["w"]}" height="{p["h"]}" loading="lazy" decoding="async"></a>'
            f'<figcaption>{p["caption"]}<span class="cp-cred">{p["cred_html"]}</span></figcaption></figure>')


def expand(body, pre):
    def gal(m):
        ids, _, cls = m.group(1).partition("|")
        ids = [i.strip() for i in ids.split(",") if i.strip()]
        ids = [i for i in ids if i.startswith("book:") and i[5:] in book or i in photos]
        if not ids:
            return ""
        cls = cls.strip() or ("cp-gal--2" if len(ids) <= 2 else "cp-gal--3")
        return f'<div class="cp-gal {cls}">' + "".join(figure(i, pre) for i in ids) + "</div>"
    body = re.sub(r"\{\{photos:([^}]+)\}\}", gal, body)
    body = re.sub(r"\{\{photo:([^}]+)\}\}", lambda m: "{{photos:" + m.group(1).strip() + "|cp-gal--1}}", body)
    body = re.sub(r"\{\{photos:([^}]+)\}\}", gal, body)
    return body


def head(title, desc, pre, css_extra=(), noindex=False):
    css = "".join(f'\n  <link rel="stylesheet" href="{pre}assets/css/{c}">' for c in ("style.css", "lab.css", "agro.css") + tuple(css_extra))
    return (f'<!doctype html>\n<html lang="uk" class="no-js">\n<head>\n  {GA.strip()}\n  <title>{esc(title)}</title>\n'
            f'  <meta name="description" content="{esc(desc)}">\n' + ('  <meta name="robots" content="noindex">\n' if noindex else '') + '  <meta name="theme-color" content="#08210F">\n'
            f'  <link rel="icon" href="{pre}assets/img/nubip-shield.png" type="image/png">{css}\n'
            f"  <script>document.documentElement.classList.replace('no-js', 'js')</script>\n</head>\n")


def header_for(depth):
    # шаблон має глибину 3 (lab/test-systems/allium-cepa/); перераховуємо відносні шляхи
    h = HEADER
    if depth != 3:
        h = h.replace('="../../../', '="' + depth_prefix(depth))
    return h


def footer_for(depth):
    f = FOOTER
    if depth != 3:
        f = f.replace('="../../../', '="' + depth_prefix(depth))
    return f


def authors_block(pre, level="h2"):
    if not authors:
        return ""
    items = []
    for a in authors:
        links = "".join(f'<a href="{esc(u)}" target="_blank" rel="noopener">{esc(t)}</a>' for t, u in a.get("links", []))
        items.append(f'<div class="ag-author"><b>{esc(a["name"])}</b><span>{a["role"]}</span>{links}</div>')
    return (f'<aside class="ag-authors" aria-labelledby="ag-auth-h"><{level} id="ag-auth-h">Автори навчального посібника</{level}>'
            f'<p>Лабораторні роботи, протоколи й рецептури цього розділу побудовано за посібником:</p>'
            f'<div class="ag-authors__list">{"".join(items)}</div>'
            f'<div class="ag-book"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>'
            f'<span>Мельничук, М. Д., &amp; Кляченко, О. Л. (2014). <i>Біотехнологія в агросфері: навчальний посібник для студентів вищих навчальних закладів</i>. НУБіП України.</span></div></aside>')


def build_topic(i, t):
    n = t["n"]
    frag_path = os.path.join(SRC, f"t{n:02d}.html")
    if not os.path.exists(frag_path):
        return False
    raw = open(frag_path, encoding="utf-8").read()
    meta = {}
    m = re.match(r"\s*<!--meta\s+(\{.*?\})\s*-->", raw, re.S)
    if m:
        meta = json.loads(m.group(1))
        raw = raw[m.end():]
    pre = "../../../"
    raw = expand(raw, pre)
    # нумерація h2 і зміст
    toc, k = [], 0

    def numh2(mm):
        nonlocal k
        k += 1
        extra, sid, title = mm.group(1) or "", mm.group(2), mm.group(3)
        toc.append((sid, plain(title)))
        return f'<section class="lab-section{extra}" id="{sid}">\n            <h2><span class="n">{k:02d}</span>{title}</h2>'
    raw = re.sub(r'<section class="lab-section( [^"]*)?" id="([^"]+)">\s*<h2>(.*?)</h2>', numh2, raw, flags=re.S)
    pub = [x for x in topics if x["n"] in PUBLISHED] if t["n"] in PUBLISHED else topics
    j = pub.index(t) if t in pub else i
    prev_t = pub[j - 1] if j > 0 else None
    next_t = pub[j + 1] if j + 1 < len(pub) else None
    nav = '<div class="lab-nav">'
    nav += f'<a class="btn btn--outline" href="../{prev_t["slug"]}/">← Тема {prev_t["n"]}. {esc(prev_t["short"])}</a>' if prev_t else '<a class="btn btn--outline" href="../">← Усі теми</a>'
    nav += f'<a class="btn" href="../{next_t["slug"]}/">Тема {next_t["n"]}. {esc(next_t["short"])} →</a>' if next_t else '<a class="btn" href="../">До всіх тем →</a>'
    nav += "</div>"
    css_extra = (f"agro/t{n:02d}.css",) if os.path.exists(os.path.join(ROOT, f"assets/css/agro/t{n:02d}.css")) else ()
    title = f'{plain(t["short"])} — Біотехнології в агросфері, Онлайн лабораторія, НУБіП'
    desc = meta.get("desc") or plain(t["excerpt"])
    badges = "".join(f'<span class="badge">{esc(b)}</span>' for b in [t["labs"]] + meta.get("badges", []))
    lead = meta.get("lead") or t["excerpt"]
    toc_html = "".join(f'<li><a href="#{sid}">{esc(tt)}</a></li>' for sid, tt in toc) + '<li><a href="#ag-auth-h">Автори посібника</a></li>'
    js = f'\n  <script type="module" src="{pre}assets/js/lab/agro/t{n:02d}.js"></script>' if os.path.exists(os.path.join(ROOT, f"assets/js/lab/agro/t{n:02d}.js")) else ""
    page = head(title, desc, pre, css_extra, noindex=t["n"] not in PUBLISHED) + header_for(3) + f'''<main id="main" class="lab-main disc--agro">
    <section class="page-hero page-hero--lab page-hero--agro">
      <div class="lab-glow" aria-hidden="true"></div>
      <div class="bg-molecules" aria-hidden="true" style="position:absolute;inset:0"></div>
      <div class="container">
        <nav class="breadcrumbs" aria-label="Навігаційний ланцюжок"><a href="../../../">Головна</a><span aria-hidden="true">/</span><a href="../../">Онлайн лабораторія</a><span aria-hidden="true">/</span><a href="../">Біотехнології в агросфері</a><span aria-hidden="true">/</span><span>Тема {n}</span></nav>
        <span class="kicker">Біотехнології в агросфері · Тема {n} · {t["labs"]}</span>
        <h1>{t["title"]}</h1>
        <p>{lead}</p>
        <div class="lab-head">{badges}</div>
      </div>
    </section>

    <div class="section" style="padding-top:48px">
      <div class="container lab-doc">
        <nav class="toc" aria-label="Зміст теми">
          <h2>Зміст</h2>
          <ol>{toc_html}</ol>
        </nav>

        <article>
{raw.strip()}
          {authors_block(pre)}
          {nav}
        </article>
      </div>
    </div>
  </main>
''' + footer_for(3) + f'''

  <script defer src="{pre}assets/js/main.js"></script>
  <script defer src="{pre}assets/js/lightbox.js"></script>{js}
</body>
</html>
'''
    out = os.path.join(ROOT, BASE, t["slug"], "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(page)
    return True


def build_hub():
    pre = "../../"
    hub_frag = os.path.join(SRC, "hub.html")
    intro = open(hub_frag, encoding="utf-8").read() if os.path.exists(hub_frag) else ""
    intro = expand(intro, pre)
    cards = []
    for t in topics:
        cover = t.get("cover")
        img = ""
        if cover:
            p = photo_rec(cover)
            img = f'<img src="{pre}assets/img/agro/{p["src"]}" alt="" width="{p["w"]}" height="{p["h"]}" loading="lazy" decoding="async">'
        ready = t["n"] in PUBLISHED
        if not ready:
            cards.append(f'''<div class="ag-card is-soon" aria-disabled="true">
            <div class="ag-card__img">{img}<span class="ag-card__n">Тема {t["n"]:02d}</span><span class="ag-card__soon">Готується</span></div>
            <div class="ag-card__body"><h3>{t["title"]}</h3><p>{t["excerpt"]}</p><span class="ag-card__labs">{t["labs"]} · с. {t["pages"]} посібника</span></div>
          </div>''')
            continue
        href = f'{t["slug"]}/'
        cards.append(f'''<a class="ag-card" href="{href}">
            <div class="ag-card__img">{img}<span class="ag-card__n">Тема {t["n"]:02d}</span></div>
            <div class="ag-card__body"><h3>{t["title"]}</h3><p>{t["excerpt"]}</p><span class="ag-card__labs">{t["labs"]} · с. {t["pages"]} посібника</span></div>
          </a>''')
    page = head("Біотехнології в агросфері — Онлайн лабораторія, НУБіП",
                "Віртуальний практикум «Біотехнології в агросфері»: 13 тем і 55 лабораторних робіт за посібником М. Д. Мельничука та О. Л. Кляченко — живильні середовища, калюс, морфогенез, суспензії, протопласти, мікророзмноження, гаплоїди, генетична інженерія, ферменти, кріозбереження.",
                pre) + header_for(2) + f'''<main id="main" class="lab-main disc--agro">
    <section class="page-hero page-hero--lab page-hero--agro">
      <div class="lab-glow" aria-hidden="true"></div>
      <div class="bg-molecules" aria-hidden="true" style="position:absolute;inset:0"></div>
      <div class="container">
        <nav class="breadcrumbs" aria-label="Навігаційний ланцюжок"><a href="../../">Головна</a><span aria-hidden="true">/</span><a href="../">Онлайн лабораторія</a><span aria-hidden="true">/</span><span>Біотехнології в агросфері</span></nav>
        <span class="kicker">Предмет · 13 тем · 55 лабораторних робіт</span>
        <h1>Біотехнології в агросфері</h1>
        <p>Віртуальний практикум з культури клітин і тканин рослин <i>in vitro</i> (у пробірці, поза організмом), мікроклонального розмноження, генетичної інженерії та кріозбереження. До кожної теми — теорія з ілюстраціями, інтерактивна модель і хід лабораторних робіт за навчальним посібником кафедри.</p>
        <div class="lab-head"><span class="badge">Культура <i>in vitro</i></span><span class="badge">2.5D-моделі</span><span class="badge">Фото з посібника й наукових джерел</span></div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        {intro}
        <div class="ag-hub">
          {"".join(cards)}
        </div>
        {authors_block(pre)}
      </div>
    </section>
  </main>
''' + footer_for(2) + f'''

  <script defer src="{pre}assets/js/main.js"></script>
  <script defer src="{pre}assets/js/lightbox.js"></script>
</body>
</html>
'''
    out = os.path.join(ROOT, BASE, "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(page)


if __name__ == "__main__":
    only = set(int(x) for x in sys.argv[1:]) if len(sys.argv) > 1 else None
    built = []
    for i, t in enumerate(topics):
        if only and t["n"] not in only:
            continue
        if build_topic(i, t):
            built.append(t["n"])
    if not only:
        build_hub()
    print("built topics:", built, "+ hub" if not only else "")
