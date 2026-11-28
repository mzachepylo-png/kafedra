"""Робота з SQLite та повнотекстовим індексом FTS5."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Optional

from . import config

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'article',
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    container_title TEXT DEFAULT '',
    publisher TEXT DEFAULT '',
    place TEXT DEFAULT '',
    year INTEGER,
    volume TEXT DEFAULT '',
    issue TEXT DEFAULT '',
    pages TEXT DEFAULT '',
    page_count INTEGER,
    doi TEXT DEFAULT '',
    pmid TEXT DEFAULT '',
    isbn TEXT DEFAULT '',
    issn TEXT DEFAULT '',
    url TEXT DEFAULT '',
    accessed_date TEXT DEFAULT '',
    language TEXT NOT NULL DEFAULT 'uk',
    keywords TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unread',
    rating INTEGER NOT NULL DEFAULT 0,
    study_object TEXT DEFAULT '',
    methods TEXT DEFAULT '',
    main_results TEXT DEFAULT '',
    for_dissertation TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'author',
    family TEXT NOT NULL,
    given_initials TEXT NOT NULL DEFAULT '',
    orcid TEXT DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    size INTEGER NOT NULL DEFAULT 0,
    extracted_text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'description',
    text TEXT NOT NULL DEFAULT '',
    page TEXT DEFAULT '',
    comment TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS source_tags (
    source_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (source_id, tag_id),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source_sections (
    source_id INTEGER NOT NULL,
    section_id INTEGER NOT NULL,
    order_in_section INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (source_id, section_id),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_year ON sources(year);
CREATE INDEX IF NOT EXISTS idx_sources_doi ON sources(doi);
CREATE INDEX IF NOT EXISTS idx_authors_source ON authors(source_id, position);
CREATE INDEX IF NOT EXISTS idx_files_source ON files(source_id);
CREATE INDEX IF NOT EXISTS idx_notes_source ON notes(source_id);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    source_id UNINDEXED,
    title,
    container_title,
    authors,
    keywords,
    tags,
    notes,
    file_text,
    tokenize = "unicode61 remove_diacritics 2",
    prefix = '2 3'
);
"""


def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Повертає підключення до SQLite з увімкненими зовнішніми ключами."""
    target = db_path or config.DB_PATH
    conn = sqlite3.connect(str(target), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Optional[Path] = None, seed: bool = True) -> None:
    """Ініціалізує таблиці БД, індекс FTS5 та налаштування за замовчуванням."""
    config.ensure_directories()
    conn = get_connection(db_path)
    try:
        conn.executescript(SCHEMA_SQL)
        for key, value in config.DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, json.dumps(value, ensure_ascii=False)),
            )
        conn.commit()
        if seed:
            from .sections import seed_defaults

            seed_defaults(conn)          # «Дисертація» → «Актуальність» на першому запуску
    finally:
        conn.close()


def rebuild_search_entry(conn: sqlite3.Connection, source_id: int) -> None:
    """Оновлює запис одного джерела в повнотекстовому індексі FTS5."""
    conn.execute("DELETE FROM search_index WHERE source_id = ?", (source_id,))

    row = conn.execute(
        """
        SELECT id, title, subtitle, container_title, keywords,
               study_object, methods, main_results, for_dissertation
        FROM sources WHERE id = ?
        """,
        (source_id,),
    ).fetchone()
    if not row:
        return

    authors_rows = conn.execute(
        "SELECT family, given_initials FROM authors WHERE source_id = ? ORDER BY position",
        (source_id,),
    ).fetchall()
    authors_text = " ".join(
        f"{a['family']} {a['given_initials']}".strip() for a in authors_rows
    )

    tags_rows = conn.execute(
        """
        SELECT t.name FROM tags t
        JOIN source_tags st ON st.tag_id = t.id
        WHERE st.source_id = ?
        """,
        (source_id,),
    ).fetchall()
    tags_text = " ".join(t["name"] for t in tags_rows)

    notes_rows = conn.execute(
        "SELECT text, comment FROM notes WHERE source_id = ?",
        (source_id,),
    ).fetchall()
    structured_parts = [
        row["study_object"] or "",
        row["methods"] or "",
        row["main_results"] or "",
        row["for_dissertation"] or "",
    ]
    notes_parts = [
        f"{n['text'] or ''} {n['comment'] or ''}".strip() for n in notes_rows
    ]
    notes_text = "\n".join(p for p in structured_parts + notes_parts if p)

    files_rows = conn.execute(
        "SELECT original_name, label, extracted_text FROM files WHERE source_id = ?",
        (source_id,),
    ).fetchall()
    file_text = "\n".join(
        f"{f['label'] or ''} {f['original_name'] or ''} {f['extracted_text'] or ''}".strip()
        for f in files_rows
    )

    title_full = f"{row['title'] or ''} {row['subtitle'] or ''}".strip()

    conn.execute(
        """
        INSERT INTO search_index
            (source_id, title, container_title, authors, keywords, tags, notes, file_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            source_id,
            title_full,
            row["container_title"] or "",
            authors_text,
            row["keywords"] or "",
            tags_text,
            notes_text,
            file_text,
        ),
    )
