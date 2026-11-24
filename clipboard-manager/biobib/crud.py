"""CRUD-операції з БД, файлами, нотатками та простим/FTS5 пошуком."""

from __future__ import annotations

import json
import mimetypes
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from . import config
from .citations.dstu8302 import format_dstu8302, format_in_text_citation
from .database import rebuild_search_entry
from .sections import section_ids_of, set_source_sections
from .schemas import NoteIn, SourceCreate, SourceUpdate


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def get_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    result = dict(config.DEFAULT_SETTINGS)
    for row in rows:
        try:
            result[row["key"]] = json.loads(row["value"])
        except json.JSONDecodeError:
            result[row["key"]] = row["value"]
    return result


def update_settings(conn: sqlite3.Connection, updates: dict[str, Any]) -> dict[str, Any]:
    for key, value in updates.items():
        if value is not None:
            conn.execute(
                """
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, json.dumps(value, ensure_ascii=False)),
            )
    conn.commit()
    return get_settings(conn)


def _fetch_authors(conn: sqlite3.Connection, source_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, role, family, given_initials, orcid, position
        FROM authors WHERE source_id = ? ORDER BY position, id
        """,
        (source_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def _fetch_tags(conn: sqlite3.Connection, source_id: int) -> list[str]:
    rows = conn.execute(
        """
        SELECT t.name FROM tags t
        JOIN source_tags st ON st.tag_id = t.id
        WHERE st.source_id = ?
        ORDER BY t.name COLLATE NOCASE
        """,
        (source_id,),
    ).fetchall()
    return [r["name"] for r in rows]


def _fetch_files(conn: sqlite3.Connection, source_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, source_id, path, original_name, label, mime, size,
               (length(extracted_text) > 0) AS has_text, created_at
        FROM files WHERE source_id = ? ORDER BY id
        """,
        (source_id,),
    ).fetchall()
    result = []
    for r in rows:
        item = dict(r)
        item["has_text"] = bool(item["has_text"])
        result.append(item)
    return result


def _fetch_notes(conn: sqlite3.Connection, source_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, source_id, kind, text, page, comment, created_at, updated_at
        FROM notes WHERE source_id = ?
        ORDER BY CASE kind WHEN 'description' THEN 0 ELSE 1 END, id DESC
        """,
        (source_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def _save_authors(conn: sqlite3.Connection, source_id: int, authors: list[Any]) -> None:
    conn.execute("DELETE FROM authors WHERE source_id = ?", (source_id,))
    for idx, author in enumerate(authors):
        family = author.family.strip()
        if not family:
            continue
        conn.execute(
            """
            INSERT INTO authors (source_id, role, family, given_initials, orcid, position)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                source_id,
                author.role or "author",
                family,
                author.given_initials.strip(),
                author.orcid.strip(),
                idx,
            ),
        )


def _save_tags(conn: sqlite3.Connection, source_id: int, tags: list[str]) -> None:
    conn.execute("DELETE FROM source_tags WHERE source_id = ?", (source_id,))
    seen: set[str] = set()
    for raw_tag in tags:
        name = raw_tag.strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (name,))
        tag_row = conn.execute(
            "SELECT id FROM tags WHERE name = ? COLLATE NOCASE", (name,)
        ).fetchone()
        if tag_row:
            conn.execute(
                "INSERT OR IGNORE INTO source_tags (source_id, tag_id) VALUES (?, ?)",
                (source_id, tag_row["id"]),
            )


def _build_source_dict(
    conn: sqlite3.Connection,
    row: sqlite3.Row,
    settings: dict[str, Any],
    include_details: bool = False,
    match_snippet: Optional[str] = None,
    match_field: Optional[str] = None,
) -> dict[str, Any]:
    data = dict(row)
    source_id = data["id"]
    authors = _fetch_authors(conn, source_id)
    tags = _fetch_tags(conn, source_id)

    data["authors"] = authors
    data["tags"] = tags

    four_plus = settings.get("dstu_four_plus_authors", "first_3_et_al")
    style = settings.get("citation_style", "dstu8302")
    data["citation_dstu"] = format_dstu8302(data, four_plus_mode=four_plus)
    data["in_text_citation"] = format_in_text_citation(data, number=source_id, style=style)

    if include_details:
        files = _fetch_files(conn, source_id)
        notes = _fetch_notes(conn, source_id)
        data["files"] = files
        data["notes"] = notes
        data["file_count"] = len(files)
        data["note_count"] = len(notes)
    else:
        data["file_count"] = conn.execute(
            "SELECT COUNT(*) FROM files WHERE source_id = ?", (source_id,)
        ).fetchone()[0]
        data["note_count"] = conn.execute(
            "SELECT COUNT(*) FROM notes WHERE source_id = ?", (source_id,)
        ).fetchone()[0]

    desc = conn.execute("SELECT text FROM notes WHERE source_id = ? AND kind = 'description' AND trim(text) != '' "
                        "ORDER BY id LIMIT 1", (source_id,)).fetchone()
    data["description"] = desc[0] if desc else ""
    data["match_snippet"] = match_snippet
    data["match_field"] = match_field
    data["section_ids"] = section_ids_of(conn, source_id)
    return data


def create_source(conn: sqlite3.Connection, payload: SourceCreate) -> dict[str, Any]:
    now = _now_iso()
    cur = conn.execute(
        """
        INSERT INTO sources (
            type, title, subtitle, container_title, publisher, place, year,
            volume, issue, pages, page_count, doi, pmid, isbn, issn, url,
            accessed_date, language, keywords, status, rating,
            study_object, methods, main_results, for_dissertation,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            payload.type,
            payload.title.strip(),
            payload.subtitle.strip(),
            payload.container_title.strip(),
            payload.publisher.strip(),
            payload.place.strip(),
            payload.year,
            payload.volume.strip(),
            payload.issue.strip(),
            payload.pages.strip(),
            payload.page_count,
            payload.doi.strip(),
            payload.pmid.strip(),
            payload.isbn.strip(),
            payload.issn.strip(),
            payload.url.strip(),
            payload.accessed_date.strip(),
            payload.language,
            payload.keywords.strip(),
            payload.status,
            payload.rating,
            payload.study_object.strip(),
            payload.methods.strip(),
            payload.main_results.strip(),
            payload.for_dissertation.strip(),
            now,
            now,
        ),
    )
    source_id = cur.lastrowid
    assert source_id is not None

    _save_authors(conn, source_id, payload.authors)
    _save_tags(conn, source_id, payload.tags)
    if payload.section_ids:
        set_source_sections(conn, source_id, payload.section_ids)

    if payload.description is not None and payload.description.strip():
        conn.execute(
            """
            INSERT INTO notes (source_id, kind, text, page, comment, created_at, updated_at)
            VALUES (?, 'description', ?, '', '', ?, ?)
            """,
            (source_id, payload.description.strip(), now, now),
        )

    rebuild_search_entry(conn, source_id)
    conn.commit()
    return get_source(conn, source_id)  # type: ignore[return-value]


def get_source(conn: sqlite3.Connection, source_id: int) -> Optional[dict[str, Any]]:
    row = conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
    if not row:
        return None
    settings = get_settings(conn)
    return _build_source_dict(conn, row, settings, include_details=True)


def update_source(
    conn: sqlite3.Connection, source_id: int, payload: SourceUpdate
) -> Optional[dict[str, Any]]:
    existing = conn.execute("SELECT id FROM sources WHERE id = ?", (source_id,)).fetchone()
    if not existing:
        return None

    now = _now_iso()
    conn.execute(
        """
        UPDATE sources SET
            type = ?, title = ?, subtitle = ?, container_title = ?,
            publisher = ?, place = ?, year = ?, volume = ?, issue = ?,
            pages = ?, page_count = ?, doi = ?, pmid = ?, isbn = ?, issn = ?,
            url = ?, accessed_date = ?, language = ?, keywords = ?,
            status = ?, rating = ?, study_object = ?, methods = ?,
            main_results = ?, for_dissertation = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            payload.type,
            payload.title.strip(),
            payload.subtitle.strip(),
            payload.container_title.strip(),
            payload.publisher.strip(),
            payload.place.strip(),
            payload.year,
            payload.volume.strip(),
            payload.issue.strip(),
            payload.pages.strip(),
            payload.page_count,
            payload.doi.strip(),
            payload.pmid.strip(),
            payload.isbn.strip(),
            payload.issn.strip(),
            payload.url.strip(),
            payload.accessed_date.strip(),
            payload.language,
            payload.keywords.strip(),
            payload.status,
            payload.rating,
            payload.study_object.strip(),
            payload.methods.strip(),
            payload.main_results.strip(),
            payload.for_dissertation.strip(),
            now,
            source_id,
        ),
    )

    _save_authors(conn, source_id, payload.authors)
    _save_tags(conn, source_id, payload.tags)
    if payload.section_ids is not None:
        set_source_sections(conn, source_id, payload.section_ids)

    if payload.description is not None:
        desc_row = conn.execute(
            "SELECT id FROM notes WHERE source_id = ? AND kind = 'description' LIMIT 1",
            (source_id,),
        ).fetchone()
        if desc_row:
            conn.execute(
                "UPDATE notes SET text = ?, updated_at = ? WHERE id = ?",
                (payload.description.strip(), now, desc_row["id"]),
            )
        elif payload.description.strip():
            conn.execute(
                """
                INSERT INTO notes (source_id, kind, text, page, comment, created_at, updated_at)
                VALUES (?, 'description', ?, '', '', ?, ?)
                """,
                (source_id, payload.description.strip(), now, now),
            )

    rebuild_search_entry(conn, source_id)
    conn.commit()
    return get_source(conn, source_id)


def delete_source(
    conn: sqlite3.Connection,
    source_id: int,
    delete_files: bool = False,
    storage_dir: Optional[Path] = None,
) -> bool:
    existing = conn.execute("SELECT id FROM sources WHERE id = ?", (source_id,)).fetchone()
    if not existing:
        return False

    if delete_files:
        base_storage = storage_dir or config.STORAGE_DIR
        file_rows = conn.execute(
            "SELECT path FROM files WHERE source_id = ?", (source_id,)
        ).fetchall()
        for frow in file_rows:
            fpath = base_storage / frow["path"]
            for p in (fpath, fpath.with_name(fpath.name + ".reader.json")):
                if p.exists() and p.is_file():
                    try:
                        p.unlink()
                    except OSError:
                        pass

    conn.execute("DELETE FROM search_index WHERE source_id = ?", (source_id,))
    conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))
    conn.commit()
    return True


def _build_fts_query(raw_query: str) -> str:
    """Перетворює рядок користувача на безпечний префіксний запит FTS5."""
    tokens = re.findall(r"[\w\u0400-\u04FF]+", raw_query, flags=re.UNICODE)
    if not tokens:
        return ""
    return " AND ".join(f'"{t}"*' for t in tokens)


def list_sources(
    conn: sqlite3.Connection,
    q: str = "",
    sort: str = "updated_desc",
    section_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Джерела з пошуком і сортуванням; section_id — лише з цього розділу (папка — разом із підпапками)."""
    out = _list_sources(conn, q, sort)
    if section_id is None:
        return out
    ids = {section_id} | {r[0] for r in conn.execute("SELECT id FROM sections WHERE parent_id = ?", (section_id,))}
    return [s for s in out if ids & set(s["section_ids"])]


def _list_sources(
    conn: sqlite3.Connection,
    q: str = "",
    sort: str = "updated_desc",
) -> list[dict[str, Any]]:
    settings = get_settings(conn)
    query_clean = (q or "").strip()

    order_map = {
        "updated_desc": "s.updated_at DESC, s.id DESC",
        "created_desc": "s.created_at DESC, s.id DESC",
        "year_desc": "COALESCE(s.year, 0) DESC, s.id DESC",
        "year_asc": "COALESCE(s.year, 9999) ASC, s.id ASC",
        "rating_desc": "s.rating DESC, s.id DESC",
        "title_asc": "s.title COLLATE NOCASE ASC",
    }
    order_sql = order_map.get(sort, order_map["updated_desc"])

    if query_clean:
        fts_query = _build_fts_query(query_clean)
        if fts_query:
            rows = conn.execute(
                """
                SELECT s.*,
                       snippet(search_index, 1, '<mark>', '</mark>', '…', 16) AS snip_title,
                       snippet(search_index, 3, '<mark>', '</mark>', '…', 16) AS snip_authors,
                       snippet(search_index, 6, '<mark>', '</mark>', '…', 20) AS snip_notes,
                       snippet(search_index, 7, '<mark>', '</mark>', '…', 20) AS snip_file,
                       bm25(search_index) AS rank
                FROM search_index
                JOIN sources s ON s.id = search_index.source_id
                WHERE search_index MATCH ?
                ORDER BY rank
                """,
                (fts_query,),
            ).fetchall()

            results = []
            for r in rows:
                match_field = None
                match_snippet = None
                for field_name, col in [
                    ("title", "snip_title"),
                    ("authors", "snip_authors"),
                    ("notes", "snip_notes"),
                    ("pdf", "snip_file"),
                ]:
                    val = r[col] or ""
                    if "<mark>" in val:
                        match_field = field_name
                        match_snippet = val
                        break
                results.append(
                    _build_source_dict(
                        conn,
                        r,
                        settings,
                        include_details=False,
                        match_snippet=match_snippet,
                        match_field=match_field,
                    )
                )
            return results

    rows = conn.execute(f"SELECT s.* FROM sources s ORDER BY {order_sql}").fetchall()
    return [_build_source_dict(conn, r, settings, include_details=False) for r in rows]


def extract_pdf_text(file_path: Path) -> str:
    """Витягує текст з PDF для повнотекстового пошуку."""
    try:
        from pypdf import PdfReader          # лише коли справді є PDF

        reader = PdfReader(str(file_path))
        chunks: list[str] = []
        for page in reader.pages:
            txt = page.extract_text() or ""
            if txt.strip():
                chunks.append(txt)
        return "\n".join(chunks)
    except Exception:
        return ""


def attach_file(
    conn: sqlite3.Connection,
    source_id: int,
    original_name: str,
    content: bytes,
    label: str = "",
    content_type: Optional[str] = None,
    storage_dir: Optional[Path] = None,
) -> Optional[dict[str, Any]]:
    existing = conn.execute("SELECT id FROM sources WHERE id = ?", (source_id,)).fetchone()
    if not existing:
        return None

    base_storage = storage_dir or config.STORAGE_DIR
    source_folder = base_storage / str(source_id)
    source_folder.mkdir(parents=True, exist_ok=True)

    safe_orig = Path(original_name).name or "file"
    suffix = Path(safe_orig).suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    rel_path = f"{source_id}/{stored_name}"
    full_path = base_storage / rel_path
    full_path.write_bytes(content)

    mime = content_type or mimetypes.guess_type(safe_orig)[0] or "application/octet-stream"
    extracted = extract_pdf_text(full_path) if (suffix == ".pdf" or mime == "application/pdf") else ""

    now = _now_iso()
    cur = conn.execute(
        """
        INSERT INTO files (source_id, path, original_name, label, mime, size, extracted_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (source_id, rel_path, safe_orig, label.strip(), mime, len(content), extracted, now),
    )
    file_id = cur.lastrowid
    conn.execute("UPDATE sources SET updated_at = ? WHERE id = ?", (now, source_id))
    rebuild_search_entry(conn, source_id)
    conn.commit()

    row = conn.execute(
        """
        SELECT id, source_id, path, original_name, label, mime, size,
               (length(extracted_text) > 0) AS has_text, created_at
        FROM files WHERE id = ?
        """,
        (file_id,),
    ).fetchone()
    item = dict(row)
    item["has_text"] = bool(item["has_text"])
    return item


def get_file_record(conn: sqlite3.Connection, file_id: int) -> Optional[dict[str, Any]]:
    row = conn.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    return dict(row) if row else None


def delete_file_record(
    conn: sqlite3.Connection, file_id: int, storage_dir: Optional[Path] = None
) -> bool:
    row = conn.execute("SELECT id, source_id, path FROM files WHERE id = ?", (file_id,)).fetchone()
    if not row:
        return False

    base_storage = storage_dir or config.STORAGE_DIR
    fpath = base_storage / row["path"]
    for p in (fpath, fpath.with_name(fpath.name + ".reader.json")):      # + кеш тексту читалки
        if p.exists() and p.is_file():
            try:
                p.unlink()
            except OSError:
                pass

    source_id = row["source_id"]
    conn.execute("DELETE FROM files WHERE id = ?", (file_id,))
    conn.execute("UPDATE sources SET updated_at = ? WHERE id = ?", (_now_iso(), source_id))
    rebuild_search_entry(conn, source_id)
    conn.commit()
    return True


def add_note(conn: sqlite3.Connection, source_id: int, payload: NoteIn) -> Optional[dict[str, Any]]:
    existing = conn.execute("SELECT id FROM sources WHERE id = ?", (source_id,)).fetchone()
    if not existing:
        return None
    now = _now_iso()
    cur = conn.execute(
        """
        INSERT INTO notes (source_id, kind, text, page, comment, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            source_id,
            payload.kind or "note",
            payload.text.strip(),
            payload.page.strip(),
            payload.comment.strip(),
            now,
            now,
        ),
    )
    note_id = cur.lastrowid
    conn.execute("UPDATE sources SET updated_at = ? WHERE id = ?", (now, source_id))
    rebuild_search_entry(conn, source_id)
    conn.commit()
    row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    return dict(row)


def update_note(conn: sqlite3.Connection, note_id: int, payload: NoteIn) -> Optional[dict[str, Any]]:
    row = conn.execute("SELECT id, source_id FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not row:
        return None
    now = _now_iso()
    conn.execute(
        """
        UPDATE notes SET kind = ?, text = ?, page = ?, comment = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            payload.kind or "note",
            payload.text.strip(),
            payload.page.strip(),
            payload.comment.strip(),
            now,
            note_id,
        ),
    )
    conn.execute("UPDATE sources SET updated_at = ? WHERE id = ?", (now, row["source_id"]))
    rebuild_search_entry(conn, row["source_id"])
    conn.commit()
    updated = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    return dict(updated)


def delete_note(conn: sqlite3.Connection, note_id: int) -> bool:
    row = conn.execute("SELECT id, source_id FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not row:
        return False
    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.execute("UPDATE sources SET updated_at = ? WHERE id = ?", (_now_iso(), row["source_id"]))
    rebuild_search_entry(conn, row["source_id"])
    conn.commit()
    return True


def list_all_tags(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT t.id, t.name, COUNT(st.source_id) AS count
        FROM tags t
        LEFT JOIN source_tags st ON st.tag_id = t.id
        GROUP BY t.id
        ORDER BY count DESC, t.name COLLATE NOCASE ASC
        """
    ).fetchall()
    return [dict(r) for r in rows]
