"""Адреси з файлу: .txt, .md, .csv/.tsv, .html, .docx, .xlsx, .pdf (якщо встановлено pypdf), .json."""
from __future__ import annotations

import io
import re
import zipfile

URL_RX = re.compile(r"(?:https?://|www\.)[^\s<>\"'«»“”]+", re.I)
TRAIL = ".,;:!?)]}>»”'\""


def _clean(u: str) -> str:
    u = u.strip()
    # закривні дужки лишаємо, якщо вони парні в самій адресі (Вікіпедія: …_(біологія))
    while u and u[-1] in TRAIL:
        if u[-1] == ")" and u.count("(") >= u.count(")"):
            break
        u = u[:-1]
    if u.lower().startswith("www."):
        u = "https://" + u
    return u


def from_text(text: str) -> list[str]:
    return [_clean(m.group(0)) for m in URL_RX.finditer(text)]


def _decode(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp1251", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def _docx(raw: bytes) -> list[str]:
    from docx import Document
    d = Document(io.BytesIO(raw))
    urls = [rel.target_ref for rel in d.part.rels.values()
            if rel.reltype.endswith("/hyperlink") and rel.is_external]
    texts = [p.text for p in d.paragraphs]
    for t in d.tables:
        for row in t.rows:
            for c in row.cells:
                texts.append(c.text)
    return urls + from_text("\n".join(texts))


def _xlsx(raw: bytes) -> list[str]:
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(raw), read_only=False, data_only=True)
    out: list[str] = []
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if c.hyperlink is not None and c.hyperlink.target:
                    out.append(c.hyperlink.target)
                if isinstance(c.value, str):
                    out += from_text(c.value)
    return out


def _html(raw: bytes) -> list[str]:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(_decode(raw), "lxml")
    hrefs = [a["href"] for a in soup.find_all("a", href=True) if a["href"].startswith(("http://", "https://"))]
    return hrefs + from_text(soup.get_text(" "))


def _pdf(raw: bytes) -> list[str]:
    try:
        from pypdf import PdfReader
    except ImportError as e:
        raise ValueError("для PDF потрібен пакет pypdf (pip install pypdf)") from e
    r = PdfReader(io.BytesIO(raw))
    out: list[str] = []
    for page in r.pages:
        for a in page.get("/Annots") or []:
            obj = a.get_object()
            uri = (obj.get("/A") or {}).get("/URI")
            if uri:
                out.append(str(uri))
        out += from_text(page.extract_text() or "")
    return out


def from_file(name: str, raw: bytes) -> list[str]:
    """Усі http(s)-адреси з файлу без повторів, у порядку появи."""
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    if ext == "docx" or (raw[:2] == b"PK" and "word/document.xml" in _zip_names(raw)):
        urls = _docx(raw)
    elif ext in ("xlsx", "xlsm") or (raw[:2] == b"PK" and "xl/workbook.xml" in _zip_names(raw)):
        urls = _xlsx(raw)
    elif ext == "pdf" or raw[:4] == b"%PDF":
        urls = _pdf(raw)
    elif ext in ("html", "htm", "xhtml") or b"<html" in raw[:2000].lower():
        urls = _html(raw)
    elif ext in ("doc", "xls", "ppt"):
        raise ValueError("старі формати Office (.doc, .xls) не підтримуються — збережіть файл як .docx/.xlsx")
    else:
        urls = from_text(_decode(raw))
    seen: dict[str, None] = {}
    for u in urls:
        u = _clean(u)
        if re.match(r"https?://[^/\s]+\.[^/\s]+", u, re.I):
            seen.setdefault(u, None)
    return list(seen)


def _zip_names(raw: bytes) -> set[str]:
    try:
        return set(zipfile.ZipFile(io.BytesIO(raw)).namelist())
    except zipfile.BadZipFile:
        return set()
