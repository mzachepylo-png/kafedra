"""Повний цикл: адреса → завантаження (або рендеринг) → вилучення вмісту → зображення."""
from __future__ import annotations

import io
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Callable, Iterable, Optional

from PIL import Image

from . import fetch, render
from .extract import extract
from .model import Document, Figure


@dataclass
class Options:
    images: bool = True        # завантажувати зображення й графіки
    render: bool = False       # виконувати JavaScript у браузері (Playwright)
    max_images: int = 80       # не більше стількох рисунків на сторінку
    timeout: float = 25


class _LazyRenderer:
    """Браузер запускається лише тоді, коли він справді потрібен (рендеринг або SVG без cairosvg)."""

    def __init__(self):
        self._r = None
        self.failed = ""

    def get(self):
        if self._r is None and not self.failed:
            if not render.available():
                self.failed = "Playwright не встановлено"
                return None
            try:
                self._r = render.Renderer()
            except Exception as e:  # браузер не запустився
                self.failed = f"браузер не запустився: {e.__class__.__name__}"
        return self._r

    def close(self):
        if self._r is not None:
            self._r.close()
            self._r = None


def _size(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as im:
        return im.size


def _figures(doc: Document) -> list[Figure]:
    return [b for b in doc.blocks if isinstance(b, Figure)]


def resolve_images(doc: Document, opts: Options, renderer: _LazyRenderer, referer: str) -> None:
    figs = _figures(doc)
    if not opts.images:
        doc.blocks = [b for b in doc.blocks if not isinstance(b, Figure)]
        return
    if len(figs) > opts.max_images:
        drop = set(map(id, figs[opts.max_images:]))
        doc.blocks = [b for b in doc.blocks if id(b) not in drop]
        doc.warnings.append(f"Вставлено перші {opts.max_images} рисунків із {len(figs)}.")
        figs = figs[:opts.max_images]

    # вбудовані SVG — у цьому потоці (браузер не можна ділити між потоками)
    for f in figs:
        if f.raw_svg and not f.data:
            png = fetch.svg_to_png(f.raw_svg, None)
            if not png and renderer.get() is not None:
                png = fetch.svg_to_png(f.raw_svg, renderer.get())
            if png:
                f.data, f.scale = png, 2.0  # обидва способи малюють удвічі щільніше
                f.width = f.height = 0     # справжній розмір — з PNG нижче
            else:
                f.error = "SVG-графік не перетворено: встановіть cairosvg або Playwright"
    # зображення за адресами — паралельно
    todo = [f for f in figs if not f.data and f.candidates]

    def load(f: Figure):
        last = ""
        for u in f.candidates[:4]:
            try:
                f.data, f.width, f.height = fetch.fetch_image(u, referer=referer, timeout=opts.timeout)
                f.src, f.error = u, ""
                return
            except ValueError as e:
                last = str(e)
        f.error = last or "не завантажилось"

    with ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(load, todo))
    for f in figs:
        if f.data and not f.width:
            try:
                f.width, f.height = _size(f.data)
            except Exception:
                f.data, f.error = None, "пошкоджене зображення"
    # замалі (піктограми, що пройшли фільтр за назвою) і невдалі «звичайні» картинки прибираємо;
    # графіки, які не вдалося отримати, лишаємо з поясненням — щоб було видно, що їх пропущено
    keep = []
    for b in doc.blocks:
        if isinstance(b, Figure):
            if b.error and "замале" in b.error:
                continue
            if b.data and min(b.width, b.height) / b.scale < fetch.MIN_SIDE:
                continue
        keep.append(b)
    doc.blocks = keep


def parse_html(html: str, url: str, opts: Optional[Options] = None, shots=None,
               renderer: Optional[_LazyRenderer] = None) -> Document:
    opts = opts or Options()
    own = renderer is None
    renderer = renderer or _LazyRenderer()
    try:
        doc = extract(html, url, shots)
        resolve_images(doc, opts, renderer, referer=url)
        return doc
    finally:
        if own:
            renderer.close()


def parse_url(url: str, opts: Optional[Options] = None, renderer: Optional[_LazyRenderer] = None) -> Document:
    opts = opts or Options()
    own = renderer is None
    renderer = renderer or _LazyRenderer()
    try:
        shots = None
        if opts.render:
            r = renderer.get()
            if r is None:
                doc = _parse_plain(url, opts, renderer)
                doc.warnings.insert(0, f"Рендеринг JavaScript недоступний ({renderer.failed}); "
                                       "сторінку оброблено без нього.")
                return doc
            try:
                final, html, shots = r.render(url)
            except Exception as e:
                doc = _parse_plain(url, opts, renderer)
                doc.warnings.insert(0, f"Браузер не відкрив сторінку ({e.__class__.__name__}); "
                                       "оброблено без JavaScript.")
                return doc
            return parse_html(html, final, opts, shots, renderer)
        return _parse_plain(url, opts, renderer)
    finally:
        if own:
            renderer.close()


def _parse_plain(url: str, opts: Options, renderer: _LazyRenderer) -> Document:
    try:
        page = fetch.fetch_page(url, timeout=opts.timeout)
    except fetch.FetchError as e:
        return Document(url=url, error=str(e))
    return parse_html(page.html, page.url, opts, None, renderer)


def parse_many(urls: Iterable[str], opts: Optional[Options] = None,
               progress: Optional[Callable[[int, Document], None]] = None) -> list[Document]:
    """Кілька адрес. Без рендерингу — паралельно (4 потоки), з рендерингом — по черзі в одному браузері."""
    opts = opts or Options()
    urls = list(urls)
    docs: list[Optional[Document]] = [None] * len(urls)

    def done(i, d):
        docs[i] = d
        if progress:
            progress(i, d)

    def safe(fn, u):
        try:
            return fn(u)
        except Exception as e:  # будь-яка несподіванка не має зупиняти всю пачку
            return Document(url=u, error=f"помилка обробки: {e.__class__.__name__}: {e}")

    if opts.render:
        lr = _LazyRenderer()
        try:
            for i, u in enumerate(urls):
                done(i, safe(lambda x: parse_url(x, opts, lr), u))
        finally:
            lr.close()
    else:
        lr = _LazyRenderer()  # лише для SVG; використовується в головному потоці нижче
        try:
            def one(i_u):
                i, u = i_u
                try:
                    page = fetch.fetch_page(u, timeout=opts.timeout)
                except fetch.FetchError as e:
                    return i, Document(url=u, error=str(e)), None
                except Exception as e:
                    return i, Document(url=u, error=f"помилка: {e.__class__.__name__}"), None
                return i, None, page

            with ThreadPoolExecutor(max_workers=4) as ex:
                for i, d, page in ex.map(one, enumerate(urls)):
                    if d is None:
                        d = safe(lambda _u: parse_html(page.html, page.url, opts, None, lr), urls[i])
                    done(i, d)
        finally:
            lr.close()
    return [d for d in docs if d is not None]
