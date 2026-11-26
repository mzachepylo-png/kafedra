"""Document → HTML для перегляду в браузері (читабельний вигляд)."""
from __future__ import annotations

import base64
from html import escape
from typing import Callable, Optional
from urllib.parse import urlparse

from .model import Code, Document, Figure, Heading, ListBlock, Paragraph, Quote, Run, Table


def _runs(runs: list[Run]) -> str:
    out = []
    for r in runs:
        t = escape(r.text).replace("\n", "<br>")
        if r.code:
            t = f"<code>{t}</code>"
        if r.bold:
            t = f"<strong>{t}</strong>"
        if r.italic:
            t = f"<em>{t}</em>"
        if r.sup:
            t = f"<sup>{t}</sup>"
        if r.sub:
            t = f"<sub>{t}</sub>"
        if r.href and urlparse(r.href).scheme in ("http", "https"):
            t = f'<a href="{escape(r.href)}" target="_blank" rel="noopener noreferrer">{t}</a>'
        out.append(t)
    return "".join(out)


def _list(lb: ListBlock) -> str:
    tag = "ol" if lb.ordered else "ul"
    start = f' start="{lb.start}"' if lb.ordered and lb.start != 1 else ""
    items = "".join(f"<li>{_runs(it.runs)}{''.join(_list(c) for c in it.children)}</li>" for it in lb.items)
    return f"<{tag}{start}>{items}</{tag}>"


def _table(t: Table, n: int) -> str:
    rows = []
    for row in t.rows:
        cells = []
        for c in row:
            tag = "th" if c.header else "td"
            span = (f' colspan="{c.colspan}"' if c.colspan > 1 else "") + \
                   (f' rowspan="{c.rowspan}"' if c.rowspan > 1 else "")
            cells.append(f"<{tag}{span}>{_runs(c.runs)}</{tag}>")
        rows.append("<tr>" + "".join(cells) + "</tr>")
    cap = f"<caption><b>Таблиця {n}</b>{'. ' + escape(t.caption) if t.caption else ''}</caption>"
    return f'<div class="wp-table"><table>{cap}{"".join(rows)}</table></div>'


def render(doc: Document, img_url: Optional[Callable[[int], str]] = None) -> str:
    """img_url(i) — адреса i-го рисунка на сервері; без неї рисунки вбудовуються як data: URI."""
    parts = []
    n_fig = n_tab = 0
    fig_i = -1
    levels = sorted({b.level for b in doc.blocks if isinstance(b, Heading)})
    shift = {lv: min(i + 2, 6) for i, lv in enumerate(levels)}  # h1 — назва документа
    for b in doc.blocks:
        if isinstance(b, Heading):
            lv = shift.get(b.level, 2)
            parts.append(f"<h{lv}>{_runs(b.runs)}</h{lv}>")
        elif isinstance(b, Paragraph):
            parts.append(f"<p>{_runs(b.runs)}</p>")
        elif isinstance(b, Quote):
            parts.append(f"<blockquote>{_runs(b.runs)}</blockquote>")
        elif isinstance(b, ListBlock):
            parts.append(_list(b))
        elif isinstance(b, Table):
            n_tab += 1
            parts.append(_table(b, n_tab))
        elif isinstance(b, Code):
            parts.append(f"<pre>{escape(b.text)}</pre>")
        elif isinstance(b, Figure):
            fig_i += 1
            label = "Графік" if b.kind == "chart" else "Рисунок"
            if not b.data:
                src = f' — <a href="{escape(b.src)}" target="_blank" rel="noopener">адреса</a>' if b.src else ""
                parts.append(f'<p class="wp-miss">[{label} не вставлено: {escape(b.error or "немає даних")}{src}]</p>')
                continue
            n_fig += 1
            if img_url:
                src = img_url(fig_i)
            else:
                mime = "image/png" if b.data[:4] == b"\x89PNG" else "image/gif" if b.data[:3] == b"GIF" else "image/jpeg"
                src = f"data:{mime};base64,{base64.b64encode(b.data).decode()}"
            cap = b.caption or b.alt
            w = int(b.width / b.scale) if b.width else ""
            parts.append(
                f'<figure class="wp-fig{" wp-chart" if b.kind == "chart" else ""}">'
                f'<img src="{escape(src)}" alt="{escape(b.alt)}" loading="lazy"'
                f'{f" width={w}" if w else ""}>'
                f"<figcaption><b>Рис. {n_fig}</b>{'. ' + escape(cap) if cap else ''}"
                f"{f' <span class=wp-kind>{label.lower()}</span>' if b.kind == 'chart' else ''}"
                f"</figcaption></figure>")
    return "\n".join(parts)


def figures(doc: Document) -> list[Figure]:
    return [b for b in doc.blocks if isinstance(b, Figure)]
