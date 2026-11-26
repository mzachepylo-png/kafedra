"""HTML → Document: пошук основного вмісту сторінки й перетворення його на блоки.

Алгоритм:
1. Метадані (назва, автор, дата, мова) — з <meta>, Open Graph, <h1>, <time>.
2. Очищення: скрипти, стилі, меню, шапки й підвали сайту, бічні панелі, банери cookie,
   кнопки «поділитися», приховані елементи.
3. Вибір кореня вмісту: <article>/<main>/відомі контейнери (WordPress, Вікіпедія…),
   інакше — оцінювання абзаців (як у Readability: довгі абзаци з комами додають бали
   батьківському і «дідівському» контейнеру; багато посилань — штраф).
4. Обхід кореня: заголовки, абзаци з жирним/курсивом/посиланнями, списки (з вкладеними),
   таблиці (colspan/rowspan), рисунки й графіки з підписами, код, цитати, формули MathML.
"""
from __future__ import annotations

import json
import re
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

from .model import (Block, Cell, Code, Document, Figure, Heading, ListBlock, ListItem, Paragraph,
                    Quote, Run, Table)

# ------------------------------------------------------------------ словники

DROP_TAGS = {"script", "style", "noscript", "template", "link", "meta", "input", "button", "select",
             "textarea", "option", "dialog", "map", "area", "track", "audio", "video",
             "embed", "head"}
BLOCK_TAGS = {"p", "div", "section", "article", "main", "header", "footer", "aside", "nav",
              "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd", "table",
              "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "figure", "figcaption",
              "blockquote", "pre", "hr", "form", "fieldset", "details", "summary", "address",
              "center", "body", "html", "legend", "menu"}
MEDIA_TAGS = {"img", "svg", "canvas", "picture", "object", "iframe"}
HEADINGS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}

# класи й id службових блоків (меню, реклама, коментарі…)
UNLIKELY = re.compile(
    r"(?:^|[\s_-])(?:nav|navbar|navigation|menu|breadcrumbs?|footer|sidebar|side-bar|widgets?|"
    r"comments?|disqus|share|sharing|social|socials|cookies?|consent|gdpr|banner|advert|"
    r"advertisement|ads?|adsbox|sponsor(?:ed)?|promo|related|recommend(?:ed|ations)?|subscribe|"
    r"subscription|newsletter|popup|modal|overlay|toolbar|pagination|pager|skip-link|masthead|"
    r"login|signup|search(?:form|-form|box)?|rating|noprint|navbox|mw-editsection|catlinks|"
    r"mw-jump-link|toc|printfooter|top-bar|topbar|header-bar|site-header|site-footer|"
    r"author-box|tags-list|post-tags|meta-share|addthis|sharethis|outbrain|taboola)(?:[\s_-]|$)",
    re.I)
LIKELY = re.compile(r"article|body|content|main|post|entry|text|story|blog|mw-parser-output", re.I)
STRONG_UNLIKELY = re.compile(r"comment|share|social|cookie|consent|footer|newsletter|advert|navbox|"
                             r"mw-editsection|breadcrumb", re.I)
CONTENT_SELECTORS = [
    "[itemprop=articleBody]", ".mw-parser-output", "article .entry-content", ".entry-content",
    ".post-content", ".article-content", ".article-body", ".article__body", ".article__content",
    ".post-body", ".story-body", ".news-text", ".content-text", "#article-body", ".c-article-body",
    ".abstract-content",
]
CHART_RX = re.compile(r"chart|graph|plot|diagram|histogram|\bfig(?:ure)?\b|fig\.|рис\.|рисун|графік|"
                      r"діаграм|гістограм|схем|залежн|динамік", re.I)
ICON_RX = re.compile(r"(?:^|[/_.\-])(?:icon|icons|logo|avatar|sprite|pixel|spinner|loader|loading|"
                     r"emoji|badge|blank|spacer|placeholder|transparent|1x1|gravatar|favicon)"
                     r"(?:[/_.\-]|$)", re.I)
TRACKERS = ("doubleclick.net", "google-analytics", "googletagmanager", "facebook.com/tr", "mc.yandex",
            "pixel.", "scorecardresearch", "quantserve", "bat.bing")
INVISIBLE = dict.fromkeys(map(ord, "­​‌‍⁠﻿"), None)


def norm_ws(s: str) -> str:
    s = s.translate(INVISIBLE)
    return re.sub(r"\s+", " ", s)


def classes(el: Tag) -> str:
    c = el.get("class") or []
    if isinstance(c, str):
        c = [c]
    return " ".join(c) + " " + (el.get("id") or "")


def text_len(el: Tag) -> int:
    return len(norm_ws(el.get_text(" ")).strip())


def link_density(el: Tag) -> float:
    total = text_len(el)
    if not total:
        return 0.0
    links = sum(text_len(a) for a in el.find_all("a"))
    return min(1.0, links / total)


# ------------------------------------------------------------------ метадані

def _meta(soup: BeautifulSoup, *names: str) -> str:
    for n in names:
        el = soup.find("meta", attrs={"property": n}) or soup.find("meta", attrs={"name": n}) \
            or soup.find("meta", attrs={"itemprop": n})
        if el and el.get("content", "").strip():
            return norm_ws(el["content"]).strip()
    return ""


def _jsonld(soup: BeautifulSoup) -> dict:
    """Автор і дата з JSON-LD (schema.org Article)."""
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "")
        except (ValueError, TypeError):
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for it in items:
            if not isinstance(it, dict):
                continue
            t = it.get("@type", "")
            t = " ".join(t) if isinstance(t, list) else str(t)
            if re.search(r"Article|BlogPosting|Report|ScholarlyArticle|WebPage", t):
                au = it.get("author")
                if isinstance(au, list):
                    au = ", ".join(a.get("name", "") if isinstance(a, dict) else str(a) for a in au)
                elif isinstance(au, dict):
                    au = au.get("name", "")
                return {"author": str(au or "").strip(), "published": str(it.get("datePublished") or "")[:10],
                        "title": str(it.get("headline") or "").strip()}
    return {}


def extract_meta(soup: BeautifulSoup, doc: Document) -> None:
    ld = _jsonld(soup)
    html_el = soup.find("html")
    doc.lang = ((html_el.get("lang") if html_el else "") or _meta(soup, "og:locale") or "").strip()
    doc.site = _meta(soup, "og:site_name", "application-name") or urlparse(doc.url).hostname or ""
    doc.description = _meta(soup, "description", "og:description")
    doc.author = _meta(soup, "citation_author", "author", "article:author", "dc.creator", "DC.creator") \
        or ld.get("author", "")
    if doc.author.startswith("http"):
        doc.author = ""
    pub = _meta(soup, "citation_publication_date", "article:published_time", "datePublished",
                "dc.date", "DC.date", "date") or ld.get("published", "")
    if not pub:
        t = soup.find("time", attrs={"datetime": True})
        pub = t["datetime"] if t else ""
    doc.published = pub[:10]
    title = _meta(soup, "citation_title", "og:title") or ld.get("title", "")
    if not title:
        h1 = soup.find("h1")
        title = norm_ws(h1.get_text(" ")).strip() if h1 else ""
    if not title and soup.title:
        title = norm_ws(soup.title.get_text()).strip()
        # «Назва статті — Назва сайту» → «Назва статті»
        parts = re.split(r"\s+[|—–·»]\s+|\s+-\s+", title)
        if len(parts) > 1 and len(parts[0]) > 15:
            title = parts[0]
    doc.title = title


# ------------------------------------------------------------------ очищення

def _hidden(el: Tag) -> bool:
    if el.has_attr("hidden"):
        return True
    st = (el.get("style") or "").replace(" ", "").lower()
    if "display:none" in st or "visibility:hidden" in st:
        return True
    if el.get("aria-hidden") == "true" and el.name != "svg" and text_len(el) < 30 and not el.find(MEDIA_TAGS):
        return True
    return False


def _inside(el: Tag, names: set[str]) -> bool:
    return any(p.name in names or (p.get("role") == "main") for p in el.parents if isinstance(p, Tag))


def clean(soup: BeautifulSoup) -> None:
    for c in soup.find_all(string=lambda s: isinstance(s, Comment)):
        c.extract()
    for el in soup.find_all(DROP_TAGS):
        el.decompose()
    for el in soup.find_all("iframe"):
        if not el.get("data-wp-shot"):
            el.decompose()
    # приховані й службові елементи
    for el in list(soup.find_all(True)):
        if el.decomposed or el.name in ("html", "body"):
            continue
        if el.get("data-wp-shot"):
            continue
        if _hidden(el):
            el.decompose()
            continue
        role = (el.get("role") or "").lower()
        in_article = _inside(el, {"article", "main"})
        if el.name == "nav" or role in ("navigation", "search", "dialog", "alert", "banner", "contentinfo"):
            el.decompose()
            continue
        if el.name in ("header",) and not in_article and not el.find("h1"):
            el.decompose()
            continue
        if el.name == "footer" or (el.name == "aside" and not in_article) or (role == "complementary" and not in_article):
            el.decompose()
            continue
        if el.name in ("a", "td", "th", "tr", "tbody", "thead", "table", "img", "figure", "li", "span"):
            continue
        cl = classes(el)
        if cl.strip() and UNLIKELY.search(cl) and (STRONG_UNLIKELY.search(cl) or not LIKELY.search(cl)):
            el.decompose()


# ------------------------------------------------------------------ вибір кореня

def pick_root(soup: BeautifulSoup) -> Tag:
    body = soup.body or soup
    total = max(1, text_len(body))
    for sel in CONTENT_SELECTORS:
        els = soup.select(sel)
        if els:
            best = max(els, key=text_len)
            if text_len(best) >= min(400, 0.25 * total):
                return best
    arts = soup.find_all("article")
    if arts:
        best = max(arts, key=text_len)
        if text_len(best) >= max(300, 0.3 * total):
            return best
    main = soup.find("main") or soup.find(attrs={"role": "main"})
    if main and text_len(main) >= 0.3 * total:
        return main

    # оцінювання абзаців (Readability-lite)
    scores: dict[int, float] = {}
    nodes: dict[int, Tag] = {}
    for p in body.find_all(["p", "pre", "td", "blockquote", "li", "div"]):
        if p.name == "div" and p.find(BLOCK_TAGS - {"br"}):
            continue  # div з вкладеними блоками — це контейнер, а не абзац
        t = norm_ws(p.get_text(" ")).strip()
        if len(t) < 25:
            continue
        sc = 1 + t.count(",") + t.count("，") + min(len(t) / 100, 3)
        for depth, anc in enumerate([p.parent, p.parent.parent if p.parent else None]):
            if not isinstance(anc, Tag):
                continue
            nodes[id(anc)] = anc
            scores[id(anc)] = scores.get(id(anc), 0) + (sc if depth == 0 else sc / 2)
    if not scores:
        return body
    ranked = sorted(((s * (1 - link_density(nodes[k])), nodes[k]) for k, s in scores.items()),
                    key=lambda x: -x[0])
    best_score, best = ranked[0]
    # зміст, розбитий на кілька сусідніх контейнерів, — беремо спільного батька
    parent = best.parent
    if isinstance(parent, Tag) and parent.name not in ("html", "[document]"):
        strong = [n for s, n in ranked[1:12] if s >= 0.3 * best_score and n.parent is parent]
        if strong and link_density(parent) < 0.35:
            best = parent
    return best


# ------------------------------------------------------------------ обхід

class Walker:
    def __init__(self, base: str, shots: Optional[dict[str, bytes]] = None):
        self.base = base
        self.shots = shots or {}
        self.out: list[Block] = []
        self.buf: list[Run] = []
        self.pending: list[Block] = []
        self.js_charts = 0

    # --- допоміжні
    def url(self, u: str) -> str:
        u = (u or "").strip()
        if not u or u.startswith(("javascript:", "mailto:", "tel:")):
            return ""
        return urljoin(self.base, u)

    def sub(self, node: Tag, skip: Optional[set] = None) -> list[Block]:
        w = Walker(self.base, self.shots)
        w.skip = skip or set()
        w.walk(node, {})
        w.flush()
        self.js_charts += w.js_charts
        return w.out

    skip: set = set()

    def flush(self) -> None:
        runs = tidy_runs(self.buf)
        self.buf = []
        if runs:
            self.out.append(Paragraph(runs))
        if self.pending:
            self.out.extend(self.pending)
            self.pending = []

    def add_figure(self, fig: Optional[Figure]) -> None:
        if fig is None:
            return
        if any(r.text.strip() for r in self.buf):
            self.pending.append(fig)
        else:
            self.flush()
            self.out.append(fig)

    # --- головний цикл
    def walk(self, node: Tag, style: dict) -> None:
        prev: Optional[Tag] = None  # попередній рядковий елемент без тексту між ним і поточним
        for ch in list(node.children):
            if isinstance(ch, NavigableString):
                if isinstance(ch, Comment):
                    continue
                t = re.sub(r"\s+", " ", str(ch))  # переноси рядків у HTML — це пробіли; <br> — окремо
                # «<span>01</span>Що таке» — номер, оформлений окремим блоком у CSS
                if prev is not None and t[:1].isupper() and self._last_char().isdigit():
                    t = " " + t
                if t:
                    self.buf.append(Run(t, **style))
                prev = None
                continue
            if not isinstance(ch, Tag) or ch.name in self.skip:
                continue
            # «<span>in vitro</span><span>2.5D-моделі</span>» — «чипи» без пробілу між ними
            if prev is not None and ch.name in CHIP_TAGS:
                first = ch.get_text()[:1]
                if first.isalnum() and self._last_char().isalnum():
                    self.buf.append(Run(" ", **style))
            self.element(ch, style)
            prev = ch if ch.name in CHIP_TAGS else None

    def _last_char(self) -> str:
        for r in reversed(self.buf):
            if r.text:
                return r.text[-1]
        return ""

    def element(self, el: Tag, style: dict) -> None:
        name = el.name
        if el.get("data-wp-shot") and el.get("data-wp-shot") in self.shots:
            self.add_figure(self.shot_figure(el))
            return
        if name in HEADINGS:
            self.flush()
            runs, extra = flatten(self.sub(el))
            runs = [Run(r.text, italic=r.italic, sup=r.sup, sub=r.sub, href=r.href) for r in runs]
            runs = tidy_runs(runs)
            if runs:
                self.out.append(Heading(HEADINGS[name], runs))
            self.out.extend(extra)
            return
        if name in ("ul", "ol", "menu"):
            self.flush()
            lb = self.parse_list(el)
            if lb.items:
                self.out.append(lb)
            self.out.extend(self.pending)
            self.pending = []
            return
        if name == "table":
            self.flush()
            self.parse_table(el)
            return
        if name == "figure":
            self.flush()
            self.parse_figure(el)
            return
        if name in ("img", "picture"):
            self.add_figure(self.image(el))
            return
        if name == "svg":
            self.add_figure(self.svg(el))
            return
        if name == "canvas":
            self.add_figure(self.canvas(el))
            return
        if name == "object" and "svg" in (el.get("type") or "") + (el.get("data") or ""):
            self.add_figure(Figure(src=self.url(el.get("data", "")), kind="chart"))
            return
        if name == "pre":
            self.flush()
            txt = el.get_text().translate(INVISIBLE).strip("\n")
            if txt.strip():
                self.out.append(Code(txt))
            return
        if name == "blockquote":
            self.flush()
            for b in self.sub(el):
                self.out.append(Quote(b.runs) if isinstance(b, Paragraph) else b)
            return
        if name == "br":
            self.buf.append(Run("\n", **style))
            return
        if name == "hr":
            self.flush()
            return
        if name == "math":
            self.buf.append(Run(math_text(el), **{**style, "italic": True}))
            return
        if name == "dl":
            self.flush()
            for d in el.find_all(["dt", "dd"], recursive=False):
                runs, extra = flatten(self.sub(d))
                if runs:
                    if d.name == "dt":
                        runs = [Run(r.text, bold=True, italic=r.italic, href=r.href) for r in runs]
                    self.out.append(Paragraph(tidy_runs(runs)))
                self.out.extend(extra)
            return
        if name in BLOCK_TAGS or (name not in INLINE_STYLE and el.find(BLOCK_TAGS | {"img", "table"})):
            # блок: абзац / контейнер
            self.flush()
            self.walk(el, style)
            self.flush()
            return
        # рядковий елемент
        st = dict(style)
        st.update(INLINE_STYLE.get(name, {}))
        if name == "a":
            href = el.get("href", "")
            if href and not href.startswith("#"):
                st["href"] = self.url(href) or None
            # мініатюра з посиланням на велике зображення
            img = el.find("img")
            if img is not None and re.search(r"\.(jpe?g|png|gif|webp|tiff?)(\?|$)", href, re.I):
                img["data-wp-big"] = self.url(href)
        if name in ("span", "font") and re.search(r"font-weight:\s*(bold|[6-9]00)", el.get("style", "")):
            st["bold"] = True
        if name in ("span", "font") and "italic" in (el.get("style") or ""):
            st["italic"] = True
        self.walk(el, st)

    # --- списки
    def parse_list(self, el: Tag) -> ListBlock:
        ordered = el.name == "ol"
        try:
            start = int(el.get("start", 1))
        except ValueError:
            start = 1
        lb = ListBlock(ordered=ordered, items=[], start=start)
        for li in el.children:
            if not isinstance(li, Tag):
                continue
            if li.name in ("ul", "ol"):
                sub = self.parse_list(li)
                if lb.items:
                    lb.items[-1].children.append(sub)
                elif sub.items:
                    lb.items.append(ListItem(runs=[], children=[sub]))
                continue
            blocks = self.sub(li)
            runs: list[Run] = []
            children: list[ListBlock] = []
            for b in blocks:
                if isinstance(b, ListBlock):
                    children.append(b)
                elif isinstance(b, (Paragraph, Heading, Quote)):
                    if runs:
                        runs.append(Run("\n"))
                    runs.extend(b.runs)
                elif isinstance(b, Code):
                    runs.append(Run(("\n" if runs else "") + b.text, code=True))
                else:
                    self.pending.append(b)  # таблиця чи рисунок у пункті — після списку
            runs = tidy_runs(runs)
            if runs or children:
                lb.items.append(ListItem(runs=runs, children=children))
        return lb

    # --- таблиці
    def parse_table(self, el: Tag) -> None:
        rows = [tr for tr in el.find_all("tr") if tr.find_parent("table") is el]
        layout = (el.get("role") == "presentation" or el.find("table") is not None
                  or not any(len(tr.find_all(["td", "th"], recursive=False)) >= 2 for tr in rows)
                  or (len(rows) <= 2 and el.find(["p", "div", "h1", "h2", "h3"]) is not None
                      and text_len(el) > 600))
        if layout:  # таблиця для розмітки сторінки — обходимо як звичайні блоки
            for cell in el.find_all(["td", "th"]):
                if cell.find_parent("table") is el:
                    self.walk(cell, {})
                    self.flush()
            return
        cap_el = el.find("caption")
        caption = norm_ws(cap_el.get_text(" ")).strip() if cap_el else ""
        t = Table(rows=[], caption=caption)
        extra: list[Block] = []
        for tr in rows:
            row = []
            in_head = tr.find_parent("thead") is not None
            for c in tr.find_all(["td", "th"], recursive=False):
                blocks = self.sub(c)
                runs, ex = flatten(blocks)
                extra.extend(ex)
                row.append(Cell(runs=tidy_runs(runs), colspan=_int(c.get("colspan"), 1, 63),
                                rowspan=_int(c.get("rowspan"), 1, len(rows)),
                                header=c.name == "th" or in_head))
            if row:
                t.rows.append(row)
        if t.rows:
            self.out.append(t)
        self.out.extend(extra)

    # --- рисунки
    def parse_figure(self, el: Tag) -> None:
        cap_el = el.find("figcaption")
        caption = tidy_text(cap_el) if cap_el else ""
        if cap_el:
            cap_el.extract()
        if el.find("table"):
            before = len(self.out)
            self.walk(el, {})
            self.flush()
            for b in self.out[before:]:
                if isinstance(b, Table) and not b.caption:
                    b.caption = caption
                    break
            else:
                if caption:
                    self.out.append(Paragraph([Run(caption, italic=True)]))
            return
        before = len(self.out)
        self.walk(el, {})
        self.flush()
        figs = [b for b in self.out[before:] if isinstance(b, Figure)]
        if figs:
            # один підпис на групу — під останнім зображенням
            figs[-1].caption = caption or figs[-1].caption
            if CHART_RX.search(caption):
                for f in figs:
                    f.kind = "chart"
        elif caption:
            self.out.append(Paragraph([Run(caption, italic=True)]))

    def image(self, el: Tag) -> Optional[Figure]:
        img = el if el.name == "img" else el.find("img")
        cands: list[str] = []
        if el.name == "picture":
            for s in el.find_all("source"):
                cands += _srcset(s.get("srcset") or s.get("data-srcset") or "")
        if img is None:
            if not cands:
                return None
            img = el
        if img.get("data-wp-big"):
            cands.insert(0, img["data-wp-big"])
        cands += _srcset(img.get("srcset") or img.get("data-srcset") or "")
        for a in ("data-src", "data-lazy-src", "data-original", "data-orig-file", "data-large-file",
                  "data-url", "data-lazy", "src"):
            v = img.get(a)
            if v and not (v.startswith("data:") and len(v) < 400):
                cands.append(v)
        cands = [self.url(c) for c in cands]
        cands = list(dict.fromkeys(c for c in cands if c))
        if not cands:
            return None
        cls = classes(img)
        w, h = _int(img.get("width"), 0, 10 ** 5), _int(img.get("height"), 0, 10 ** 5)
        if (w and w < 40) or (h and h < 40):
            return None
        main = cands[0]
        path = urlparse(main).path
        if ICON_RX.search(path) or ICON_RX.search(cls) or any(t in main for t in TRACKERS):
            return None
        alt = norm_ws(img.get("alt") or img.get("title") or "").strip()
        caption = ""
        for p in [img.parent, img.parent.parent if img.parent else None]:
            if isinstance(p, Tag):
                cap = p.find(class_=re.compile(r"caption|thumbcaption|wp-caption-text|figcaption", re.I))
                if cap is not None and cap is not img:
                    caption = tidy_text(cap)
                    cap.decompose()
                    break
        kind = "chart" if CHART_RX.search(" ".join([alt, caption, path, cls])) else "image"
        return Figure(src=main, alt=alt, caption=caption, kind=kind, candidates=cands)

    def svg(self, el: Tag) -> Optional[Figure]:
        w, h = _svg_size(el)
        if (w and w < 60) or (h and h < 60):
            return None
        shapes = el.find_all(["path", "rect", "circle", "line", "polyline", "polygon", "text", "ellipse"])
        if not w and not h and len(shapes) < 6:
            return None
        if not shapes and el.find("use"):
            return None  # піктограма зі спрайту
        if not el.get("xmlns"):
            el["xmlns"] = "http://www.w3.org/2000/svg"
        title = el.find("title")
        alt = norm_ws(title.get_text()).strip() if title else (el.get("aria-label") or "")
        # перетворення в PNG — у pipeline (cairosvg або браузер)
        return Figure(src="", raw_svg=str(el).encode("utf-8"), alt=alt, kind="chart", width=w, height=h)

    def canvas(self, el: Tag) -> Optional[Figure]:
        w, h = _int(el.get("width"), 0, 10 ** 5), _int(el.get("height"), 0, 10 ** 5)
        if (w and w < 60) or (h and h < 60):
            return None
        self.js_charts += 1
        return Figure(src="", alt=el.get("aria-label") or "", kind="chart",
                      error="графік малюється JavaScript — увімкніть «Рендеринг JavaScript»")

    def shot_figure(self, el: Tag) -> Figure:
        key = el["data-wp-shot"]
        title = el.find(["title", "figcaption"]) if el.name != "iframe" else None
        alt = el.get("aria-label") or el.get("title") or (norm_ws(title.get_text()) if title else "")
        return Figure(src="", data=self.shots[key], alt=alt.strip(), kind="chart", scale=2.0)


CHIP_TAGS = {"span", "a", "b", "strong", "em", "i", "small", "label", "time", "mark", "abbr", "font"}

INLINE_STYLE = {
    "b": {"bold": True}, "strong": {"bold": True},
    "i": {"italic": True}, "em": {"italic": True}, "cite": {"italic": True}, "var": {"italic": True},
    "dfn": {"italic": True},
    "code": {"code": True}, "kbd": {"code": True}, "samp": {"code": True}, "tt": {"code": True},
    "sup": {"sup": True}, "sub": {"sub": True},
    "a": {}, "span": {}, "font": {}, "small": {}, "mark": {}, "abbr": {}, "u": {}, "s": {}, "del": {},
    "ins": {}, "q": {}, "label": {}, "time": {}, "bdi": {}, "bdo": {}, "nobr": {}, "big": {}, "wbr": {},
}


def _int(v, default: int, hi: int) -> int:
    try:
        n = int(str(v).strip().rstrip("px").split(".")[0])
        return max(1 if default else 0, min(hi, n))
    except (ValueError, TypeError):
        return default


def _srcset(s: str) -> list[str]:
    """srcset → адреси від найбільшої до найменшої."""
    out = []
    for part in s.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        size = 1.0
        if len(bits) > 1:
            m = re.match(r"([\d.]+)([wx])", bits[1])
            if m:
                size = float(m.group(1)) * (1 if m.group(2) == "w" else 1000)
        out.append((size, bits[0]))
    return [u for _, u in sorted(out, key=lambda x: -x[0])]


def _svg_size(el: Tag) -> tuple[int, int]:
    w, h = _int(el.get("width"), 0, 10 ** 5), _int(el.get("height"), 0, 10 ** 5)
    if (not w or not h) and el.get("viewBox"):
        try:
            _, _, vw, vh = [float(x) for x in re.split(r"[\s,]+", el["viewBox"].strip())]
            w, h = w or int(vw), h or int(vh)
        except ValueError:
            pass
    return w, h


def math_text(el: Tag) -> str:
    ann = el.find("annotation", attrs={"encoding": re.compile("tex", re.I)})
    if el.get("alttext"):
        return el["alttext"]
    if ann is not None:
        return ann.get_text().strip()
    return norm_ws(el.get_text(" ")).strip()


# ------------------------------------------------------------------ тексти

def tidy_runs(runs: list[Run]) -> list[Run]:
    """Нормалізує пробіли, зливає однакові фрагменти, обрізає краї абзацу."""
    out: list[Run] = []
    for r in runs:
        parts = r.text.translate(INVISIBLE).split("\n")
        t = "\n".join(re.sub(r"\s+", " ", p) for p in parts)
        if not t:
            continue
        if out and out[-1].same_style(r):
            out[-1].text += t
        else:
            out.append(Run(t, r.bold, r.italic, r.code, r.sup, r.sub, r.href))
    # подвійні пробіли на межах фрагментів і пробіли навколо переносів рядка
    for i, r in enumerate(out):
        r.text = re.sub(r" *\n *", "\n", r.text)
        if i and (out[i - 1].text.endswith((" ", "\n"))):
            r.text = r.text.lstrip(" ")
    out = [r for r in out if r.text]
    while out and not out[0].text.strip():
        out.pop(0)
    while out and not out[-1].text.strip():
        out.pop()
    if out:
        out[0].text = out[0].text.lstrip()
        out[-1].text = out[-1].text.rstrip()
    for r in out:
        r.text = re.sub(r"\n{2,}", "\n", r.text)
    return [r for r in out if r.text]


def tidy_text(el: Tag) -> str:
    return norm_ws(el.get_text(" ")).strip()


CAPTION_NUM = re.compile(r"^\s*(?:рис(?:\.|унок)|fig(?:\.|ure)|табл(?:\.|иця)|table|графік|діаграма|chart|"
                         r"схема|scheme|plate)\s*[\dIVXLС]+[a-zа-я]?\s*[.:—–-]?\s*", re.I)


def strip_caption_number(s: str) -> str:
    """«Рис. 2. Залежність…» → «Залежність…» (нумерацію ставить DOCX)."""
    out = CAPTION_NUM.sub("", s or "", count=1).strip()
    return out[:1].upper() + out[1:] if out else ""


def flatten(blocks: list[Block]) -> tuple[list[Run], list[Block]]:
    """Блоки клітинки/заголовка → один набір фрагментів (+ таблиці й рисунки окремо)."""
    runs: list[Run] = []
    extra: list[Block] = []

    def add(rs):
        if runs:
            runs.append(Run("\n"))
        runs.extend(rs)

    def add_list(lb: ListBlock, depth=0):
        for i, it in enumerate(lb.items):
            mark = f"{lb.start + i}. " if lb.ordered else "• "
            add([Run("  " * depth + mark)] + it.runs)
            for ch in it.children:
                add_list(ch, depth + 1)

    for b in blocks:
        if isinstance(b, (Paragraph, Heading, Quote)):
            add(b.runs)
        elif isinstance(b, ListBlock):
            add_list(b)
        elif isinstance(b, Code):
            add([Run(b.text, code=True)])
        else:
            extra.append(b)
    return runs, extra


# ------------------------------------------------------------------ збирання

def _block_text(b: Block) -> str:
    if isinstance(b, (Paragraph, Heading, Quote)):
        return "".join(r.text for r in b.runs).strip()
    return ""


def postprocess(doc: Document) -> None:
    out: list[Block] = []
    title = norm_ws(doc.title).strip().lower()
    for b in doc.blocks:
        t = _block_text(b).lower()
        if isinstance(b, Heading) and title and t == title and not any(isinstance(x, Heading) for x in out):
            continue  # заголовок = назва документа
        if out and t and t == _block_text(out[-1]).lower():
            continue  # повтор
        if isinstance(b, Paragraph) and not t:
            continue
        out.append(b)
    # заголовки без тексту після них наприкінці
    while out and isinstance(out[-1], Heading):
        out.pop()
    doc.blocks = out


RU_CHARS = re.compile(r"[ыэъё]", re.I)
UK_CHARS = re.compile(r"[іїєґ]", re.I)
BE_CHARS = re.compile(r"ў", re.I)


def language_warning(doc: Document) -> Optional[str]:
    host = (urlparse(doc.url).hostname or "").lower()
    lang = doc.lang.lower()[:2]
    sample = doc.plain_text()[:20000]
    ru, uk, be = len(RU_CHARS.findall(sample)), len(UK_CHARS.findall(sample)), len(BE_CHARS.findall(sample))
    if host.endswith((".ru", ".su", ".by", ".рф")) or lang in ("ru", "be") or \
            (ru > 20 and ru > 2 * uk) or be > 10:
        return ("Схоже, це російське/білоруське або російськомовне джерело. За правилами сайту кафедри "
                "такі джерела не цитуються й не використовуються.")
    return None


def extract(html: str, url: str, shots: Optional[dict[str, bytes]] = None) -> Document:
    soup = BeautifulSoup(html, "lxml")
    doc = Document(url=url)
    base = soup.find("base", href=True)
    base_url = urljoin(url, base["href"]) if base else url
    extract_meta(soup, doc)
    clean(soup)
    root = pick_root(soup)
    w = Walker(base_url, shots)
    w.walk(root, {})
    w.flush()
    doc.blocks = w.out
    postprocess(doc)
    if not doc.title:  # сторінка без <title>/<h1> — назва з першого заголовка чи абзацу
        first = next((_block_text(b) for b in doc.blocks if _block_text(b)), "")
        doc.title = first if len(first) <= 90 else first[:80].rsplit(" ", 1)[0] + "…"
    for b in doc.blocks:
        if isinstance(b, Figure):
            b.caption = strip_caption_number(b.caption)
        elif isinstance(b, Table):
            b.caption = strip_caption_number(b.caption)
    if w.js_charts:
        doc.warnings.append(f"На сторінці {w.js_charts} графік(и), що малюються JavaScript: "
                            "щоб отримати їх як зображення, увімкніть «Рендеринг JavaScript».")
    warn = language_warning(doc)
    if warn:
        doc.warnings.append(warn)
    if not doc.blocks:
        doc.warnings.append("Основний текст не знайдено (можливо, сторінка будується JavaScript — "
                            "спробуйте «Рендеринг JavaScript»).")
    return doc
