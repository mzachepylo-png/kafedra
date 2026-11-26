"""Завантаження сторінок і зображень, перетворення зображень у формати, які розуміє Word."""
from __future__ import annotations

import io
import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import requests
from PIL import Image

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36 webparse/1.0")
MAX_PAGE = 20 * 1024 * 1024     # 20 МБ HTML — більше вже не сторінка
MAX_IMAGE = 25 * 1024 * 1024
MIN_SIDE = 40                    # менші зображення — піктограми, лічильники, «пікселі»
MAX_PX = 2400                    # довша сторона після стиснення (для DOCX більше не треба)

_session: Optional[requests.Session] = None


def session() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        s.headers.update({
            "User-Agent": UA,
            "Accept-Language": "uk,en;q=0.8",
        })
        _session = s
    return _session


class FetchError(Exception):
    pass


@dataclass
class Page:
    url: str        # остаточна адреса (після переадресацій)
    html: str
    content_type: str


def _decode(resp: requests.Response, raw: bytes) -> str:
    """Визначає кодування: заголовок → <meta charset> → вгадування (UTF-8, cp1251)."""
    enc = None
    ct = resp.headers.get("Content-Type", "")
    m = re.search(r"charset=([\w-]+)", ct, re.I)
    if m:
        enc = m.group(1)
    if not enc:
        m = re.search(rb"<meta[^>]+charset=[\"']?([\w-]+)", raw[:4096], re.I)
        if m:
            enc = m.group(1).decode("ascii", "ignore")
    for e in filter(None, [enc, "utf-8", "cp1251"]):
        try:
            return raw.decode(e)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", "replace")


def fetch_page(url: str, timeout: float = 25) -> Page:
    try:
        r = session().get(url, timeout=timeout, stream=True,
                          headers={"Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"})
    except requests.RequestException as e:
        raise FetchError(f"не вдалося з'єднатися: {e.__class__.__name__}") from e
    if r.status_code >= 400:
        raise FetchError(f"сервер відповів {r.status_code} {r.reason}")
    ct = r.headers.get("Content-Type", "").split(";")[0].strip().lower()
    if ct and not any(k in ct for k in ("html", "xml", "text/plain")):
        raise FetchError(f"це не вебсторінка, а файл типу {ct}")
    raw = bytearray()
    for chunk in r.iter_content(65536):
        raw += chunk
        if len(raw) > MAX_PAGE:
            raise FetchError("сторінка завелика (понад 20 МБ)")
    return Page(url=r.url, html=_decode(r, bytes(raw)), content_type=ct)


# ---------------------------------------------------------------- зображення

def _to_docx_image(data: bytes) -> tuple[bytes, int, int]:
    """Будь-яке растрове зображення → PNG/JPEG розумного розміру. Повертає (байти, ширина, висота)."""
    im = Image.open(io.BytesIO(data))
    im.seek(0)  # анімований GIF/WebP — перший кадр
    fmt = (im.format or "").upper()
    w, h = im.size
    if min(w, h) < MIN_SIDE:
        raise ValueError(f"замале зображення ({w}×{h})")
    keep = fmt in ("PNG", "JPEG") and max(w, h) <= MAX_PX and len(data) < 4 * 1024 * 1024
    if keep:
        return data, w, h
    if max(w, h) > MAX_PX:
        im.thumbnail((MAX_PX, MAX_PX))
    out = io.BytesIO()
    if im.mode in ("RGBA", "LA", "P") or fmt in ("PNG", "GIF", "WEBP", "BMP", "TIFF"):
        im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
        im.save(out, "PNG", optimize=True)
    else:
        im.convert("RGB").save(out, "JPEG", quality=88)
    return out.getvalue(), im.size[0], im.size[1]


def svg_to_png(svg: bytes, renderer=None) -> Optional[bytes]:
    """SVG → PNG: cairosvg (якщо встановлено) або браузер Playwright (якщо доступний)."""
    try:
        import cairosvg  # type: ignore
        return cairosvg.svg2png(bytestring=svg, output_width=None, dpi=144, scale=2)
    except Exception:
        pass
    if renderer is not None:
        try:
            return renderer.svg_to_png(svg)
        except Exception:
            return None
    return None


def image_from_bytes(data: bytes, renderer=None) -> tuple[bytes, int, int]:
    head = data[:512].lstrip().lower()
    if head.startswith(b"<?xml") or head.startswith(b"<svg") or b"<svg" in head:
        png = svg_to_png(data, renderer)
        if not png:
            raise ValueError("SVG не вдалося перетворити (встановіть cairosvg або увімкніть рендеринг JavaScript)")
        data = png
    return _to_docx_image(data)


def fetch_image(url: str, referer: str = "", renderer=None, timeout: float = 25) -> tuple[bytes, int, int]:
    if url.startswith("data:"):
        import base64
        m = re.match(r"data:([^;,]*)(;base64)?,(.*)", url, re.S)
        if not m:
            raise ValueError("пошкоджене вбудоване зображення")
        from urllib.parse import unquote_to_bytes
        payload = base64.b64decode(m.group(3)) if m.group(2) else unquote_to_bytes(m.group(3))
        return image_from_bytes(payload, renderer)
    if urlparse(url).scheme not in ("http", "https"):
        raise ValueError("непідтримувана адреса зображення")
    try:
        r = session().get(url, timeout=timeout, stream=True,
                          headers={"Referer": referer, "Accept": "image/webp,image/png,image/jpeg,image/*;q=0.8"})
    except requests.RequestException as e:
        raise ValueError(f"не завантажилось ({e.__class__.__name__})") from e
    if r.status_code >= 400:
        raise ValueError(f"не завантажилось ({r.status_code})")
    raw = bytearray()
    for chunk in r.iter_content(65536):
        raw += chunk
        if len(raw) > MAX_IMAGE:
            raise ValueError("зображення завелике")
    try:
        return image_from_bytes(bytes(raw), renderer)
    except ValueError:
        raise
    except Exception as e:  # PIL.UnidentifiedImageError тощо
        raise ValueError(f"невідомий формат зображення ({e.__class__.__name__})") from e
