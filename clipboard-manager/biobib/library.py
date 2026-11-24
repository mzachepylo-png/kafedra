"""Бібліотека BioBib: готові набори джерел (з описами), пошук і злиття дублікатів, прикріплення PDF «пачкою»
(з файлів, ZIP або теки — джерело знаходиться за вмістом файлу, DOI або назвою), відкриття файлу на диску й
читалка повного тексту дослідження (текст PDF, зібраний в абзаци, із заголовками та змістом).

Лише стандартна бібліотека (+ pypdf для тексту PDF — імпортується на вимогу): цим модулем користуються і вікно
програми (сторінка «Посилання»), і браузерна бібліотека (FastAPI)."""

from __future__ import annotations

import hashlib
import io
import json
import mimetypes
import os
import re
import sqlite3
import statistics
import subprocess
import sys
import unicodedata
import uuid
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Optional

from . import config
from .database import rebuild_search_entry

SEED_DIR = Path(__file__).resolve().parent / "seed"
SEED_FILE = "dissertation_sources.json"
READER_VERSION = 6                       # змінили алгоритм читалки → кеш тексту перебудовується

TEXT_FIELDS = ("subtitle", "container_title", "publisher", "place", "volume", "issue", "pages", "doi", "pmid",
               "isbn", "issn", "url", "accessed_date", "keywords", "study_object", "methods", "main_results",
               "for_dissertation")


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# -- нормалізація -------------------------------------------------------------------------------------------
_DOI_RE = re.compile(r"\b(10\.\d{4,9}/[^\s\"'<>]+)", re.I)


def norm_doi(doi: str) -> str:
    """«https://doi.org/10.1/ABC.» → «10.1/abc» (порівняння DOI без префіксів і регістру)."""
    s = (doi or "").strip().lower()
    s = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", s)
    return s.rstrip(".,;)]")


def norm_title(title: str) -> str:
    """Назва для порівняння: без регістру, діакритики, розділових знаків і зайвих пропусків."""
    s = unicodedata.normalize("NFKD", title or "")
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).casefold()
    s = re.sub(r"[^\w]+", " ", s)
    return " ".join(s.split())


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


# -- джерела: пошук, вставка ---------------------------------------------------------------------------------
def find_source(conn: sqlite3.Connection, doi: str = "", title: str = "", year: Any = None) -> Optional[int]:
    """Наявне джерело з тим самим DOI або (якщо DOI немає) тією самою назвою й роком."""
    d = norm_doi(doi)
    rows = conn.execute("SELECT id, doi, title, year FROM sources ORDER BY id").fetchall()
    if d:
        for r in rows:
            if norm_doi(r["doi"]) == d:
                return r["id"]
    t = norm_title(title)
    if t:
        for r in rows:
            if norm_title(r["title"]) == t and (not year or not r["year"] or int(r["year"]) == int(year)):
                return r["id"]
    return None


def _set_tags(conn: sqlite3.Connection, source_id: int, tags: Iterable[str]) -> None:
    for name in tags or []:
        name = (name or "").strip()
        if not name:
            continue
        conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (name,))
        tid = conn.execute("SELECT id FROM tags WHERE name = ? COLLATE NOCASE", (name,)).fetchone()[0]
        conn.execute("INSERT OR IGNORE INTO source_tags (source_id, tag_id) VALUES (?, ?)", (source_id, tid))


def _has_description(conn: sqlite3.Connection, source_id: int) -> bool:
    return conn.execute("SELECT 1 FROM notes WHERE source_id = ? AND kind = 'description' AND trim(text) != ''",
                        (source_id,)).fetchone() is not None


def insert_source(conn: sqlite3.Connection, src: dict[str, Any]) -> int:
    """Нове джерело з набору (поля як у формі BioBib + authors, tags, description). Без commit."""
    now = _now()
    vals = {k: (src.get(k) or "").strip() if isinstance(src.get(k, ""), str) else src.get(k) for k in TEXT_FIELDS}
    cur = conn.execute(
        "INSERT INTO sources (type, title, year, language, status, rating, page_count, created_at, updated_at, "
        + ", ".join(TEXT_FIELDS) + ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, " + ", ".join("?" * len(TEXT_FIELDS)) + ")",
        (src.get("type") or "article", (src.get("title") or "").strip(), src.get("year"), src.get("language") or "uk",
         src.get("status") or "unread", int(src.get("rating") or 0), src.get("page_count"), now, now,
         *[vals[k] or "" for k in TEXT_FIELDS]))
    sid = cur.lastrowid
    for pos, a in enumerate(src.get("authors") or []):
        if (a.get("family") or "").strip():
            conn.execute("INSERT INTO authors (source_id, role, family, given_initials, orcid, position) "
                         "VALUES (?, ?, ?, ?, ?, ?)", (sid, a.get("role") or "author", a["family"].strip(),
                                                       (a.get("given_initials") or "").strip(), a.get("orcid") or "",
                                                       pos))
    _set_tags(conn, sid, src.get("tags") or [])
    if (src.get("description") or "").strip():
        conn.execute("INSERT INTO notes (source_id, kind, text, page, comment, created_at, updated_at) "
                     "VALUES (?, 'description', ?, '', '', ?, ?)", (sid, src["description"].strip(), now, now))
    rebuild_search_entry(conn, sid)
    return sid


def fill_missing(conn: sqlite3.Connection, source_id: int, src: dict[str, Any]) -> bool:
    """Доповнює наявне джерело порожніми полями з набору (своє, вже заповнене, не чіпаємо). Без commit."""
    row = dict(conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone())
    upd = {k: src[k] for k in TEXT_FIELDS if isinstance(src.get(k), str) and src[k].strip() and not (row.get(k) or "")}
    if not row.get("year") and src.get("year"):
        upd["year"] = src["year"]
    changed = bool(upd)
    if upd:
        conn.execute("UPDATE sources SET " + ", ".join(f"{k} = ?" for k in upd) + ", updated_at = ? WHERE id = ?",
                     (*upd.values(), _now(), source_id))
    if not conn.execute("SELECT 1 FROM authors WHERE source_id = ?", (source_id,)).fetchone() and src.get("authors"):
        for pos, a in enumerate(src["authors"]):
            conn.execute("INSERT INTO authors (source_id, role, family, given_initials, orcid, position) "
                         "VALUES (?, 'author', ?, ?, '', ?)", (source_id, a["family"], a.get("given_initials", ""),
                                                               pos))
        changed = True
    if (src.get("description") or "").strip() and not _has_description(conn, source_id):
        now = _now()
        conn.execute("INSERT INTO notes (source_id, kind, text, page, comment, created_at, updated_at) "
                     "VALUES (?, 'description', ?, '', '', ?, ?)", (source_id, src["description"].strip(), now, now))
        changed = True
    _set_tags(conn, source_id, src.get("tags") or [])
    rebuild_search_entry(conn, source_id)
    return changed


def _section(conn: sqlite3.Connection, title: str, parent_id: Optional[int]) -> int:
    r = conn.execute("SELECT id FROM sections WHERE parent_id IS ? AND title = ? ORDER BY id",
                     (parent_id, title)).fetchone()
    if r:
        return r[0]
    pos = conn.execute("SELECT COALESCE(MAX(position) + 1, 0) FROM sections WHERE parent_id IS ?",
                       (parent_id,)).fetchone()[0]
    return conn.execute("INSERT INTO sections (parent_id, title, position) VALUES (?, ?, ?)",
                        (parent_id, title, pos)).lastrowid


def _attach(conn: sqlite3.Connection, source_id: int, section_id: int) -> None:
    if conn.execute("SELECT 1 FROM source_sections WHERE source_id = ? AND section_id = ?",
                    (source_id, section_id)).fetchone():
        return
    pos = conn.execute("SELECT COALESCE(MAX(order_in_section) + 1, 0) FROM source_sections WHERE section_id = ?",
                       (section_id,)).fetchone()[0]
    conn.execute("INSERT INTO source_sections (source_id, section_id, order_in_section) VALUES (?, ?, ?)",
                 (source_id, section_id, pos))


# -- готові набори джерел (seed) -----------------------------------------------------------------------------
def load_seed(name: str = SEED_FILE) -> dict[str, Any]:
    with open(SEED_DIR / name, encoding="utf-8") as fh:
        return json.load(fh)


def _sort_key(item: dict) -> tuple:
    s = item["source"]
    first = (s.get("authors") or [{}])[0].get("family", "") or s.get("title", "")
    return (norm_title(first), s.get("year") or 0, norm_title(s.get("title", "")))


def import_seed(conn: sqlite3.Connection, data: Optional[dict] = None, force: bool = False) -> dict[str, Any]:
    """Додає набір джерел (метадані + описи) у бібліотеку й розкладає їх по підпапках розділу (напр.
    «Дисертація»). Ідемпотентно: уже наявні джерела (той самий DOI/назва) не дублюються, лише доповнюються, а
    повторний автоматичний імпорт того самого набору не відбувається (позначка в налаштуваннях)."""
    data = data or load_seed()
    marker = "seed_imported:" + data.get("id", "seed")
    rep: dict[str, Any] = {"added": [], "updated": [], "existing": [], "merged": [], "skipped": False}
    if not force and conn.execute("SELECT 1 FROM settings WHERE key = ?", (marker,)).fetchone():
        rep["skipped"] = True
        return rep
    parent = _section(conn, data.get("parent_section") or "Дисертація", None)
    sec_ids = {t: _section(conn, t, parent) for t in data.get("sections", [])}
    for item in sorted(data.get("sources", []), key=_sort_key):
        src = item["source"]
        sid = find_source(conn, src.get("doi", ""), src.get("title", ""), src.get("year"))
        if sid is None:
            sid = insert_source(conn, src)
            rep["added"].append(sid)
        elif fill_missing(conn, sid, src):
            rep["updated"].append(sid)
        else:
            rep["existing"].append(sid)
        for t in item.get("sections", []):
            _attach(conn, sid, sec_ids.get(t) or _section(conn, t, parent))
    rep["merged"] = dedupe_sources(conn, commit=False)
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                 (marker, json.dumps({"at": _now(), "added": len(rep["added"])})))
    conn.commit()
    return rep


def seed_file_map(data: Optional[dict] = None) -> dict[str, dict[str, Any]]:
    """sha256 файлу → що це: основний PDF джерела набору, інша версія (дублікат) або відкинутий файл."""
    data = data or load_seed()
    out: dict[str, dict[str, Any]] = {}
    for item in data.get("sources", []):
        src = item["source"]
        for n, f in enumerate(item.get("files", [])):
            if f["sha256"] in out:                       # побайтова копія того самого файлу
                continue
            out[f["sha256"]] = {"kind": "main" if n == 0 else "alias", "doi": src.get("doi", ""),
                                "title": src.get("title", ""), "year": src.get("year"),
                                "name": item.get("file_name") or Path(f["name"]).name}
    for d in data.get("dropped", []):
        if d.get("sha256") in out and out[d["sha256"]]["kind"] == "alias":
            out[d["sha256"]]["reason"] = d.get("reason", "")
        elif d.get("sha256") and d["sha256"] not in out:        # побайтова копія основного файлу — не «відкинута»
            out[d["sha256"]] = {"kind": "dropped", "reason": d.get("reason", "")}
    return out


# -- дублікати ------------------------------------------------------------------------------------------------
def _dup_key_groups(conn: sqlite3.Connection) -> list[list[int]]:
    rows = conn.execute("SELECT id, doi, title, year FROM sources ORDER BY id").fetchall()
    parent: dict[int, int] = {r["id"]: r["id"] for r in rows}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    seen: dict[tuple, int] = {}
    for r in rows:
        keys = []
        if norm_doi(r["doi"]):
            keys.append(("doi", norm_doi(r["doi"])))
        t = norm_title(r["title"])
        if len(t) >= 12:
            keys.append(("title", t, r["year"] or 0))
        for k in keys:
            if k in seen:
                a, b = find(seen[k]), find(r["id"])
                if a != b:
                    parent[max(a, b)] = min(a, b)
            else:
                seen[k] = r["id"]
    groups: dict[int, list[int]] = {}
    for r in rows:
        groups.setdefault(find(r["id"]), []).append(r["id"])
    return [sorted(g) for g in groups.values() if len(g) > 1]


def _file_sha(conn: sqlite3.Connection, file_row, storage: Path) -> str:
    try:
        return sha256((storage / file_row["path"]).read_bytes())
    except OSError:
        return ""


def merge_sources(conn: sqlite3.Connection, keep: int, dup: int, storage_dir: Optional[Path] = None) -> None:
    """Зливає джерело dup у keep: порожні поля, автори, мітки, нотатки, файли (без однакових) і розділи
    переходять до keep, а dup видаляється. Без commit."""
    storage = Path(storage_dir or config.STORAGE_DIR)
    d = dict(conn.execute("SELECT * FROM sources WHERE id = ?", (dup,)).fetchone())
    d["authors"] = [dict(a) for a in conn.execute("SELECT family, given_initials FROM authors WHERE source_id = ? "
                                                  "ORDER BY position", (dup,))]
    fill_missing(conn, keep, d)
    conn.execute("INSERT OR IGNORE INTO source_tags (source_id, tag_id) SELECT ?, tag_id FROM source_tags "
                 "WHERE source_id = ?", (keep, dup))
    have_notes = {(r["kind"], " ".join((r["text"] or "").split())) for r in
                  conn.execute("SELECT kind, text FROM notes WHERE source_id = ?", (keep,))}
    for n in conn.execute("SELECT id, kind, text FROM notes WHERE source_id = ?", (dup,)).fetchall():
        key = (n["kind"], " ".join((n["text"] or "").split()))
        if key in have_notes or (n["kind"] == "description" and _has_description(conn, keep)):
            conn.execute("DELETE FROM notes WHERE id = ?", (n["id"],))
        else:
            conn.execute("UPDATE notes SET source_id = ? WHERE id = ?", (keep, n["id"]))
            have_notes.add(key)
    keep_sha = {_file_sha(conn, f, storage) for f in conn.execute("SELECT path FROM files WHERE source_id = ?",
                                                                  (keep,))}
    for f in conn.execute("SELECT id, path FROM files WHERE source_id = ?", (dup,)).fetchall():
        h = _file_sha(conn, f, storage)
        if h and h in keep_sha:
            _remove_file(conn, f["id"], storage)
        else:
            conn.execute("UPDATE files SET source_id = ? WHERE id = ?", (keep, f["id"]))
            keep_sha.add(h)
    for ss in conn.execute("SELECT section_id, order_in_section FROM source_sections WHERE source_id = ?",
                           (dup,)).fetchall():
        conn.execute("INSERT OR IGNORE INTO source_sections (source_id, section_id, order_in_section) "
                     "VALUES (?, ?, ?)", (keep, ss["section_id"], ss["order_in_section"]))
    conn.execute("DELETE FROM search_index WHERE source_id = ?", (dup,))
    for tbl in ("source_sections", "source_tags", "authors", "notes", "files"):
        conn.execute(f"DELETE FROM {tbl} WHERE source_id = ?", (dup,))
    conn.execute("DELETE FROM sources WHERE id = ?", (dup,))
    rebuild_search_entry(conn, keep)


def _remove_file(conn: sqlite3.Connection, file_id: int, storage: Path) -> None:
    r = conn.execute("SELECT path FROM files WHERE id = ?", (file_id,)).fetchone()
    if r:
        for p in (storage / r["path"], _cache_path(storage / r["path"])):
            try:
                p.unlink()
            except OSError:
                pass
    conn.execute("DELETE FROM files WHERE id = ?", (file_id,))


def dedupe_sources(conn: sqlite3.Connection, storage_dir: Optional[Path] = None, commit: bool = True
                   ) -> list[dict[str, Any]]:
    """Знаходить дублікати (той самий DOI або та сама назва й рік) і зливає кожну групу в найстаріше джерело;
    у кожному джерелі прибирає однакові файли. Повертає [{kept, removed, title}]."""
    storage = Path(storage_dir or config.STORAGE_DIR)
    out = []
    for group in _dup_key_groups(conn):
        keep, *dups = group
        title = conn.execute("SELECT title FROM sources WHERE id = ?", (keep,)).fetchone()[0]
        for dup in dups:
            merge_sources(conn, keep, dup, storage)
        out.append({"kept": keep, "removed": dups, "title": title})
    for s in conn.execute("SELECT DISTINCT source_id FROM files").fetchall():
        seen: set[str] = set()
        for f in conn.execute("SELECT id, path FROM files WHERE source_id = ? ORDER BY id", (s[0],)).fetchall():
            h = _file_sha(conn, f, storage)
            if h and h in seen:
                _remove_file(conn, f["id"], storage)
                out.append({"kept": s[0], "removed": [], "title": "", "file_removed": f["id"]})
            seen.add(h)
    if commit:
        conn.commit()
    return out


# -- PDF: прикріплення пачкою --------------------------------------------------------------------------------
def is_pdf(content: bytes) -> bool:
    return b"%PDF-" in content[:1024]


def iter_inputs(paths: Iterable[str]) -> Iterable[tuple[str, bytes]]:
    """(ім'я, вміст) усіх файлів зі шляхів: окремі файли, ZIP-архіви (усі файли всередині), теки (рекурсивно)."""
    for p in paths:
        p = Path(p)
        if p.is_dir():
            for root, _dirs, files in os.walk(p):
                for name in sorted(files):
                    yield from iter_inputs([os.path.join(root, name)])
            continue
        try:
            content = p.read_bytes()
        except OSError:
            continue
        if p.suffix.lower() == ".zip" or (content[:4] == b"PK\x03\x04" and not is_pdf(content)):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    for info in zf.infolist():
                        if not info.is_dir() and info.file_size < 300 * 1024 * 1024:
                            yield Path(info.filename).name, zf.read(info)
            except (zipfile.BadZipFile, OSError, RuntimeError):
                yield p.name, content
            continue
        yield p.name, content


def pdf_pages(source: Any, limit: Optional[int] = None) -> list[str]:
    """Текст сторінок PDF (шлях або байти). Немає pypdf / не вдалося прочитати — []."""
    try:
        import logging
        from pypdf import PdfReader
        logging.getLogger("pypdf").setLevel(logging.ERROR)     # попередження про шрифти — не для користувача
        reader = PdfReader(io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else str(source))
        pages = reader.pages if limit is None else reader.pages[:limit]
        return [(pg.extract_text() or "") for pg in pages]
    except Exception:                                   # noqa: BLE001 — пошкоджений або зашифрований PDF
        return []


def _source_titles(conn: sqlite3.Connection) -> list[tuple[int, str]]:
    return [(r["id"], norm_title(r["title"])) for r in conn.execute("SELECT id, title FROM sources")
            if len(norm_title(r["title"])) >= 20]


def match_source(conn: sqlite3.Connection, content: bytes, seed_map: Optional[dict] = None,
                 text: Optional[str] = None) -> tuple[Optional[int], str]:
    """Яке джерело бібліотеки описує цей PDF: (id, як знайдено) — за набором (sha256), DOI в тексті або назвою."""
    info = (seed_map or {}).get(sha256(content))
    if info and info["kind"] in ("main", "alias"):
        sid = find_source(conn, info["doi"], info["title"], info["year"])
        if sid:
            return sid, "набір"
    if text is None:
        text = "\n".join(pdf_pages(content, 3))
    flat = text.replace("­", "").replace("-\n", "").replace("\n", " ")
    for m in _DOI_RE.finditer(flat):
        sid = find_source(conn, m.group(1))
        if sid:
            return sid, "DOI"
    nt = norm_title(flat)
    best = None
    for sid, t in _source_titles(conn):
        if t in nt and (best is None or len(t) > best[1]):
            best = (sid, len(t))
    return (best[0], "назва") if best else (None, "")


def store_file(conn: sqlite3.Connection, source_id: int, name: str, content: bytes,
               storage_dir: Optional[Path] = None, label: str = "") -> int:
    """Копіює файл у storage/<id джерела>/ і додає запис (із текстом PDF для пошуку). Без commit."""
    storage = Path(storage_dir or config.STORAGE_DIR)
    safe = Path(name).name or "file.pdf"
    suffix = Path(safe).suffix.lower() or (".pdf" if is_pdf(content) else "")
    rel = f"{source_id}/{uuid.uuid4().hex}{suffix}"
    full = storage / rel
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(content)
    mime = "application/pdf" if is_pdf(content) else (mimetypes.guess_type(safe)[0] or "application/octet-stream")
    text = "\n".join(pdf_pages(full)) if mime == "application/pdf" else ""
    now = _now()
    fid = conn.execute("INSERT INTO files (source_id, path, original_name, label, mime, size, extracted_text, "
                       "created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                       (source_id, rel, safe, label, mime, len(content), text, now)).lastrowid
    conn.execute("UPDATE sources SET updated_at = ? WHERE id = ?", (now, source_id))
    rebuild_search_entry(conn, source_id)
    return fid


def attach_pdfs(conn: sqlite3.Connection, paths: Iterable[str], storage_dir: Optional[Path] = None,
                source_id: Optional[int] = None, seed: Optional[dict] = None) -> dict[str, list]:
    """Прикріплює PDF зі шляхів (файли / ZIP / теки) до джерел бібліотеки. source_id — усе до цього джерела;
    інакше джерело шукається для кожного файлу. Пропускає: не-PDF, файли, що вже є в бібліотеці (той самий
    вміст), інші версії вже прикріпленого PDF і відомі дублікати. Звіт: {attached, duplicate, not_pdf, unmatched}."""
    storage = Path(storage_dir or config.STORAGE_DIR)
    try:
        seed_map = seed_file_map(seed)
    except (OSError, ValueError):
        seed_map = {}
    have = {}
    for f in conn.execute("SELECT id, source_id, path FROM files").fetchall():
        h = _file_sha(conn, f, storage)
        if h:
            have[h] = f["source_id"]
    rep: dict[str, list] = {"attached": [], "duplicate": [], "not_pdf": [], "unmatched": []}
    for name, content in iter_inputs(paths):
        if not is_pdf(content):
            if not name.startswith(".") and not name.lower().endswith((".txt", ".ini", ".db")):
                rep["not_pdf"].append(name)
            continue
        h = sha256(content)
        info = seed_map.get(h, {})
        if h in have:
            rep["duplicate"].append((name, "цей файл уже є в бібліотеці"))
            continue
        if info.get("kind") == "dropped":
            rep["duplicate"].append((name, info.get("reason", "дублікат")))
            continue
        if source_id is not None:
            sid, how = source_id, "вибране джерело"
        else:
            sid, how = match_source(conn, content, seed_map)
        if sid is None:
            rep["unmatched"].append(name)
            continue
        if info.get("kind") == "alias" or (source_id is None and conn.execute(
                "SELECT 1 FROM files WHERE source_id = ? AND mime = 'application/pdf'", (sid,)).fetchone()):
            rep["duplicate"].append((name, info.get("reason") or "інша версія PDF уже прикріпленого джерела"))
            continue
        nice = info.get("name") if info.get("kind") == "main" else name
        store_file(conn, sid, nice or name, content, storage)
        have[h] = sid
        title = conn.execute("SELECT title FROM sources WHERE id = ?", (sid,)).fetchone()[0]
        rep["attached"].append((name, sid, title, how))
    conn.commit()
    return rep


# -- файли на диску ------------------------------------------------------------------------------------------
def files_of(conn: sqlite3.Connection, source_id: int) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        "SELECT id, source_id, path, original_name, label, mime, size FROM files WHERE source_id = ? ORDER BY id",
        (source_id,))]


def file_counts(conn: sqlite3.Connection) -> dict[int, int]:
    return {r[0]: r[1] for r in conn.execute("SELECT source_id, COUNT(*) FROM files GROUP BY source_id")}


def descriptions(conn: sqlite3.Connection) -> dict[int, str]:
    """Перший опис (нотатка «опис») кожного джерела."""
    out: dict[int, str] = {}
    for r in conn.execute("SELECT source_id, text FROM notes WHERE kind = 'description' AND trim(text) != '' "
                          "ORDER BY id"):
        out.setdefault(r[0], r[1])
    return out


def file_path(conn: sqlite3.Connection, file_id: int, storage_dir: Optional[Path] = None) -> Optional[Path]:
    r = conn.execute("SELECT path FROM files WHERE id = ?", (file_id,)).fetchone()
    if not r:
        return None
    return Path(storage_dir or config.STORAGE_DIR) / r["path"]


OPENER: Optional[Callable[[list], Any]] = None          # тести підміняють, щоб нічого не відкривати насправді


def open_on_disk(path: Path, reveal: bool = False) -> bool:
    """Відкриває файл у програмі за замовчуванням (PDF — у переглядачі PDF) або показує його в Провіднику."""
    path = Path(path)
    if not path.exists():
        return False
    target = str(path.resolve())
    if sys.platform == "win32":
        cmd = ["explorer", "/select,", target] if reveal else ["startfile", target]
    elif sys.platform == "darwin":
        cmd = ["open", "-R", target] if reveal else ["open", target]
    else:
        cmd = ["xdg-open", str(path.parent.resolve()) if reveal else target]
    if OPENER is not None:
        OPENER(cmd)
        return True
    try:
        if cmd[0] == "startfile":
            os.startfile(target)                        # type: ignore[attr-defined]  # лише Windows
        else:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except OSError:
        return False


# -- читалка: текст PDF → абзаци, заголовки, зміст -----------------------------------------------------------
_LIGATURES = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ft", "ﬆ": "st", " ": " ",
              "‐": "-", "‑": "-", " ": " ", " ": " "}
_SECTION_WORDS = {
    "abstract", "summary", "introduction", "background", "materials and methods", "material and methods",
    "methods", "methodology", "experimental", "results", "results and discussion", "discussion", "conclusion",
    "conclusions", "conclusion and future perspectives", "acknowledgements", "acknowledgments", "acknowledgement",
    "references", "literature cited", "bibliography", "funding", "author contributions", "conflict of interest",
    "conflicts of interest", "data availability", "data availability statement", "supplementary material",
    "supplementary materials", "keywords", "abbreviations", "highlights", "anotation", "анотація", "вступ",
    "висновки", "література", "список літератури", "результати", "обговорення", "матеріали і методи",
    "матеріали та методи", "declaration of competing interest", "ethics statement", "publisher s note",
    "credit authorship contribution statement", "graphical abstract", "limitations", "future perspectives",
}
_REF_HEAD = {"references", "literature cited", "bibliography", "література", "список літератури",
             "список використаних джерел"}
_NUM_HEAD = re.compile(r"^(\d{1,2}(\.\d{1,2}){0,3})\.?\s+(\S.{1,90})$")
_END_PUNCT = ".!?:;”\")»"


def _clean_line(s: str) -> str:
    for a, b in _LIGATURES.items():
        s = s.replace(a, b)
    return " ".join(s.split())


def _shape(line: str) -> str:
    """Рядок без цифр — щоб упізнати колонтитули на різних сторінках («Page 3», «Plant Soil (2017) 416:311»)."""
    return re.sub(r"\d+", "#", line.casefold()).strip()


def _strip_furniture(pages: list[list[str]]) -> list[list[str]]:
    """Прибирає колонтитули (рядки, що повторюються вгорі/внизу багатьох сторінок) і номери сторінок."""
    n = len(pages)
    edge = Counter()
    for lines in pages:
        for ln in set(_shape(x) for x in lines[:3] + lines[-3:]):
            edge[ln] += 1
    thr = max(2, int(n * 0.3 + 0.5)) if n >= 3 else n + 1
    rep = {k for k, v in edge.items() if v >= thr and len(k) < 160}
    out = []
    for lines in pages:
        keep = []
        for i, ln in enumerate(lines):
            at_edge = i < 3 or i >= len(lines) - 3
            if at_edge and (_shape(ln) in rep or re.fullmatch(r"(page\s*)?#(\s*(of|/)\s*#)?|[-–—]\s*#\s*[-–—]",
                                                               _shape(ln))):
                continue
            keep.append(ln)
        out.append(keep)
    return out


def _is_heading(line: str, nxt: str, prev_ended: bool, typical: float, front: bool = False) -> Optional[str]:
    """Заголовок? Повертає текст заголовка або None. front — ще «шапка» статті (до першого відомого розділу:
    Abstract, Introduction…): там заголовками вважаються лише назви розділів, а не афіліації й дати."""
    t = line.strip()
    if not t or len(t) > 110 or t.endswith((",", ";")):
        return None
    key = norm_title(re.sub(r"^\d+(\.\d+)*\.?\s*", "", t))
    if key in _SECTION_WORDS and (prev_ended or not nxt or nxt[:1].isupper()):
        return t
    if front or t.endswith(":"):
        return None
    toks = t.split()
    if sum(not re.search(r"[^\W\d_]{2}", w) for w in toks) > 0.25 * len(toks):
        return None                                    # рядок таблиці: «Urease - - + -», «B1S 12 14»
    m = _NUM_HEAD.match(t)
    if m and prev_ended and not t.endswith(".") and len(t) < 0.9 * max(typical, 40) and m.group(3)[:1].isupper() \
            and not re.search(r"\d\s*[%±×]|[=<>]", t) and int(m.group(1).split(".")[0]) < 20:
        return t
    letters = [ch for ch in t if ch.isalpha()]
    if prev_ended and len(letters) >= 4 and sum(ch.isupper() for ch in letters) / len(letters) > 0.85 \
            and len(t) < 70 and not t.endswith("."):
        return t
    words = [w for w in re.findall(r"[^\W\d_]+", t) if len(w) > 3]
    if prev_ended and 1 <= len(words) <= 12 and len(t) < 0.7 * max(typical, 40) and not t.endswith(".") \
            and t[:1].isupper() and sum(w[0].isupper() for w in words) / len(words) >= 0.6 and \
            (nxt[:1].isupper() or not nxt):
        return t
    return None


def reflow(pages_text: list[str], strict_front: bool = True) -> list[dict[str, Any]]:
    """Текст сторінок PDF → блоки для читання: {"t": "h"|"p"|"r", "text", "page"} (h — заголовок, p — абзац,
    r — пункт списку літератури). Склеює рядки в абзаци, прибирає перенесення слів і колонтитули."""
    pages = [[_clean_line(x) for x in (p or "").splitlines()] for p in pages_text]
    pages = [[x for x in p if x] for p in pages]
    pages = _strip_furniture(pages)
    blocks: list[dict[str, Any]] = []
    cur: list[str] = []
    cur_page = 1
    in_refs = False
    front = strict_front

    def flush() -> None:
        nonlocal cur
        if cur:
            text = cur[0]
            for ln in cur[1:]:
                if re.search(r"[^\W\d_]{2}-$", text) and ln[:1].islower() and \
                        not re.search(r"(^|[\s(/-])([A-ZА-ЯІЇЄҐ0-9]{1,6}|\S)-$", text):
                    text = text[:-1] + ln                       # пере-\nнесення слова (але P-\nuptake, DNA-\nbinding)
                elif text.endswith("-") and ln[:1].isalnum():
                    text = text + ln                            # складне слово: P-\nuptake
                else:
                    text = text + " " + ln
            blocks.append({"t": "r" if in_refs else "p", "text": text, "page": cur_page})
        cur = []

    for pno, lines in enumerate(pages, 1):
        lens = [len(x) for x in lines if len(x) >= 25]
        typical = statistics.median(lens) if lens else 60
        for i, ln in enumerate(lines):
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            prev = cur[-1] if cur else (blocks[-1]["text"] if blocks else "")
            prev_ended = not cur or prev.endswith(tuple(_END_PUNCT)) or len(prev) < 0.6 * typical
            head = None if (in_refs and not norm_title(ln) in _SECTION_WORDS) else \
                _is_heading(ln, nxt, prev_ended, typical, front)
            if head:
                flush()
                front = False
                if blocks and blocks[-1]["t"] == "h" and blocks[-1]["page"] == pno and \
                        not blocks[-1]["text"].endswith(".") and len(blocks[-1]["text"]) + len(head) < 110 and \
                        not _NUM_HEAD.match(head) and norm_title(head) not in _SECTION_WORDS and \
                        norm_title(blocks[-1]["text"]) not in _SECTION_WORDS:
                    blocks[-1]["text"] += " " + head            # заголовок у два рядки
                else:
                    blocks.append({"t": "h", "text": head, "page": pno})
                in_refs = norm_title(re.sub(r"^\d+(\.\d+)*\.?\s*", "", head)) in _REF_HEAD
                cur_page = pno
                continue
            if cur:
                last = cur[-1]
                new_par = last.endswith(tuple(_END_PUNCT)) and len(last) < 0.75 * typical
                if in_refs:
                    new_par = new_par or (last.endswith((".", ")")) and bool(re.match(
                        r"^(\[\d+\]|\d{1,3}\.\s|[A-ZА-ЯІЇЄҐ][^\s,]{1,30},?\s+([A-ZА-ЯІЇЄҐ]\.|[A-ZА-ЯІЇЄҐ][a-zа-яії]+,))", ln)))
                if new_par:
                    flush()
            if not cur:
                cur_page = pno
            cur.append(ln)
    flush()
    if strict_front and not any(b["t"] == "h" for b in blocks):
        return reflow(pages_text, strict_front=False)     # немає відомих розділів — заголовки за виглядом
    return [b for b in blocks if b["text"].strip()]


def _cache_path(pdf: Path) -> Path:
    return pdf.with_name(pdf.name + ".reader.json")


def reader_blocks(pdf: Path) -> dict[str, Any]:
    """Блоки читалки для файлу (кеш поруч із файлом: <файл>.reader.json)."""
    cache = _cache_path(pdf)
    try:
        st = pdf.stat()
        data = json.loads(cache.read_text(encoding="utf-8"))
        if data.get("v") == READER_VERSION and data.get("size") == st.st_size:
            return data
    except (OSError, ValueError):
        pass
    pages = pdf_pages(pdf)
    blocks = reflow(pages)
    data = {"v": READER_VERSION, "size": pdf.stat().st_size if pdf.exists() else 0, "pages": len(pages),
            "blocks": blocks}
    try:
        cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass
    return data


def reader_data(conn: sqlite3.Connection, source_id: int, file_id: Optional[int] = None,
                storage_dir: Optional[Path] = None) -> Optional[dict[str, Any]]:
    """Усе для сторінки читалки: опис джерела (посилання ДСТУ, опис, об'єкт, методи, результати), файли й повний
    текст вибраного файлу (за замовчуванням — першого PDF), розбитий на абзаци й заголовки, зі змістом."""
    from .sections import source_brief
    row = conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
    if not row:
        return None
    src = source_brief(conn, row)
    desc = conn.execute("SELECT text FROM notes WHERE source_id = ? AND kind = 'description' ORDER BY id LIMIT 1",
                        (source_id,)).fetchone()
    src["description"] = desc[0] if desc else ""
    src["tags"] = [r[0] for r in conn.execute("SELECT t.name FROM tags t JOIN source_tags st ON st.tag_id = t.id "
                                              "WHERE st.source_id = ? ORDER BY t.name", (source_id,))]
    files = files_of(conn, source_id)
    pdfs = [f for f in files if f["mime"] == "application/pdf" or f["original_name"].lower().endswith(".pdf")]
    chosen = next((f for f in files if f["id"] == file_id), None) if file_id else (pdfs[0] if pdfs else None)
    out = {"source": src, "files": files, "file_id": chosen["id"] if chosen else None, "blocks": [], "toc": [],
           "pages": 0, "words": 0}
    if chosen:
        data = reader_blocks(Path(storage_dir or config.STORAGE_DIR) / chosen["path"])
        out["blocks"], out["pages"] = data["blocks"], data["pages"]
        out["toc"] = [{"i": i, "text": b["text"]} for i, b in enumerate(data["blocks"]) if b["t"] == "h"]
        out["words"] = sum(len(b["text"].split()) for b in data["blocks"])
    return out
