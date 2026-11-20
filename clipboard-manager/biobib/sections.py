"""Розділи «Посилання»: папки → підпапки (два рівні) і джерела в них. Лише стандартна бібліотека (sqlite3) —
цим модулем користується й сторінка «Посилання» у вікні програми (без FastAPI), і API браузерної бібліотеки."""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Optional

from . import config
from .citations.dstu8302 import format_dstu8302

MAX_TITLE = 80


def _clean_title(title: str) -> str:
    return " ".join((title or "").split())[:MAX_TITLE]


def seed_defaults(conn: sqlite3.Connection) -> bool:
    """Перший запуск: «Дисертація» → «Актуальність». Повертає True, якщо щось створено."""
    if conn.execute("SELECT COUNT(*) FROM sections").fetchone()[0]:
        return False
    for pos, (title, children) in enumerate(config.DEFAULT_SECTIONS):
        cur = conn.execute("INSERT INTO sections (parent_id, title, position) VALUES (NULL, ?, ?)", (title, pos))
        for cpos, child in enumerate(children):
            conn.execute("INSERT INTO sections (parent_id, title, position) VALUES (?, ?, ?)",
                         (cur.lastrowid, child, cpos))
    conn.commit()
    return True


def _row(r: sqlite3.Row, counts: dict[int, int], parent_title: str = "") -> dict[str, Any]:
    d = {"id": r["id"], "parent_id": r["parent_id"], "title": r["title"], "position": r["position"],
         "count": counts.get(r["id"], 0)}
    d["path"] = f"{parent_title} › {r['title']}" if parent_title else r["title"]
    return d


def list_sections(conn: sqlite3.Connection, parent_id: Optional[int] = None, all_levels: bool = False
                  ) -> list[dict[str, Any]]:
    """Розділи одного рівня (parent_id=None — папки верхнього рівня) або всі (all_levels=True: папка, далі
    її підпапки — плоский список у порядку дерева). count — скільки джерел у розділі."""
    counts = {r[0]: r[1] for r in conn.execute(
        "SELECT section_id, COUNT(*) FROM source_sections GROUP BY section_id")}
    tops = conn.execute("SELECT * FROM sections WHERE parent_id IS NULL ORDER BY position, id").fetchall()
    if not all_levels:
        if parent_id is None:
            return [_row(r, counts) for r in tops]
        parent = get_section(conn, parent_id)
        rows = conn.execute("SELECT * FROM sections WHERE parent_id = ? ORDER BY position, id",
                            (parent_id,)).fetchall()
        return [_row(r, counts, parent["title"] if parent else "") for r in rows]
    out = []
    for t in tops:
        out.append(_row(t, counts))
        for r in conn.execute("SELECT * FROM sections WHERE parent_id = ? ORDER BY position, id", (t["id"],)):
            out.append(_row(r, counts, t["title"]))
    return out


def get_section(conn: sqlite3.Connection, section_id: int) -> Optional[dict[str, Any]]:
    r = conn.execute("SELECT * FROM sections WHERE id = ?", (section_id,)).fetchone()
    if not r:
        return None
    parent = conn.execute("SELECT title FROM sections WHERE id = ?", (r["parent_id"],)).fetchone() \
        if r["parent_id"] is not None else None
    count = conn.execute("SELECT COUNT(*) FROM source_sections WHERE section_id = ?", (section_id,)).fetchone()[0]
    return _row(r, {section_id: count}, parent["title"] if parent else "")


def create_section(conn: sqlite3.Connection, title: str, parent_id: Optional[int] = None
                   ) -> Optional[dict[str, Any]]:
    """Нова папка (parent_id=None) або підпапка. Поки що лише два рівні: підпапка підпапки — ні."""
    title = _clean_title(title)
    if not title:
        return None
    if parent_id is not None:
        parent = conn.execute("SELECT parent_id FROM sections WHERE id = ?", (parent_id,)).fetchone()
        if parent is None or parent["parent_id"] is not None:
            return None
    pos = conn.execute("SELECT COALESCE(MAX(position) + 1, 0) FROM sections WHERE parent_id IS ?",
                       (parent_id,)).fetchone()[0]
    cur = conn.execute("INSERT INTO sections (parent_id, title, position) VALUES (?, ?, ?)", (parent_id, title, pos))
    conn.commit()
    return get_section(conn, cur.lastrowid)


def rename_section(conn: sqlite3.Connection, section_id: int, title: str) -> bool:
    title = _clean_title(title)
    if not title:
        return False
    cur = conn.execute("UPDATE sections SET title = ? WHERE id = ?", (title, section_id))
    conn.commit()
    return cur.rowcount > 0


def delete_section(conn: sqlite3.Connection, section_id: int) -> bool:
    """Видаляє розділ разом із підпапками; самі джерела лишаються в бібліотеці."""
    ids = [section_id] + [r[0] for r in conn.execute("SELECT id FROM sections WHERE parent_id = ?", (section_id,))]
    for sid in ids:
        conn.execute("DELETE FROM source_sections WHERE section_id = ?", (sid,))
    cur = conn.execute("DELETE FROM sections WHERE id IN (%s)" % ",".join("?" * len(ids)), ids)
    conn.commit()
    return cur.rowcount > 0


def move_section(conn: sqlite3.Connection, section_id: int, delta: int) -> bool:
    """Переміщує розділ на delta позицій серед сусідів."""
    r = conn.execute("SELECT parent_id FROM sections WHERE id = ?", (section_id,)).fetchone()
    if not r:
        return False
    ids = [x[0] for x in conn.execute("SELECT id FROM sections WHERE parent_id IS ? ORDER BY position, id",
                                      (r["parent_id"],))]
    i = ids.index(section_id)
    j = max(0, min(len(ids) - 1, i + delta))
    if i == j:
        return False
    ids.insert(j, ids.pop(i))
    for pos, sid in enumerate(ids):
        conn.execute("UPDATE sections SET position = ? WHERE id = ?", (pos, sid))
    conn.commit()
    return True


# -- джерела в розділах --------------------------------------------------------------------------------------
def _settings(conn: sqlite3.Connection) -> dict[str, Any]:
    out = dict(config.DEFAULT_SETTINGS)
    for r in conn.execute("SELECT key, value FROM settings"):
        try:
            out[r["key"]] = json.loads(r["value"])
        except (ValueError, TypeError):
            pass
    return out


def source_brief(conn: sqlite3.Connection, row: sqlite3.Row, settings: Optional[dict] = None) -> dict[str, Any]:
    """Джерело для списку: основні поля, автори й готове посилання за ДСТУ 8302:2015."""
    data = dict(row)
    data["authors"] = [dict(a) for a in conn.execute(
        "SELECT role, family, given_initials FROM authors WHERE source_id = ? ORDER BY position", (row["id"],))]
    settings = settings or _settings(conn)
    data["citation_dstu"] = format_dstu8302(data, four_plus_mode=settings.get("dstu_four_plus_authors",
                                                                              "first_3_et_al"))
    return data


def sources_in(conn: sqlite3.Connection, section_id: int) -> list[dict[str, Any]]:
    """Джерела розділу в порядку додавання (для підпапки «Актуальність» — у порядку згадування)."""
    st = _settings(conn)
    rows = conn.execute(
        """SELECT s.* FROM sources s JOIN source_sections ss ON ss.source_id = s.id
           WHERE ss.section_id = ? ORDER BY ss.order_in_section, s.id""", (section_id,)).fetchall()
    return [source_brief(conn, r, st) for r in rows]


def all_sources(conn: sqlite3.Connection, query: str = "") -> list[dict[str, Any]]:
    """Уся бібліотека (для «Додати з бібліотеки…»): пошук за назвою, журналом, авторами, роком, DOI."""
    st = _settings(conn)
    rows = conn.execute("SELECT * FROM sources ORDER BY updated_at DESC, id DESC").fetchall()
    out = [source_brief(conn, r, st) for r in rows]
    q = (query or "").strip().casefold()
    if q:
        out = [s for s in out if q in (s["citation_dstu"] + " " + (s.get("doi") or "")).casefold()]
    return out


def section_ids_of(conn: sqlite3.Connection, source_id: int) -> list[int]:
    return [r[0] for r in conn.execute("SELECT section_id FROM source_sections WHERE source_id = ? "
                                       "ORDER BY section_id", (source_id,))]


def attach(conn: sqlite3.Connection, source_id: int, section_id: int) -> bool:
    """Додає джерело в розділ (у кінець). Уже є — нічого не робить."""
    if not conn.execute("SELECT 1 FROM sources WHERE id = ?", (source_id,)).fetchone() or \
            not conn.execute("SELECT 1 FROM sections WHERE id = ?", (section_id,)).fetchone():
        return False
    if conn.execute("SELECT 1 FROM source_sections WHERE source_id = ? AND section_id = ?",
                    (source_id, section_id)).fetchone():
        return False
    pos = conn.execute("SELECT COALESCE(MAX(order_in_section) + 1, 0) FROM source_sections WHERE section_id = ?",
                       (section_id,)).fetchone()[0]
    conn.execute("INSERT INTO source_sections (source_id, section_id, order_in_section) VALUES (?, ?, ?)",
                 (source_id, section_id, pos))
    conn.commit()
    return True


def detach(conn: sqlite3.Connection, source_id: int, section_id: int) -> bool:
    cur = conn.execute("DELETE FROM source_sections WHERE source_id = ? AND section_id = ?", (source_id, section_id))
    conn.commit()
    return cur.rowcount > 0


def set_source_sections(conn: sqlite3.Connection, source_id: int, section_ids: list[int]) -> None:
    """Розділи джерела = section_ids (зайві прибираються, нові додаються в кінець). Без commit."""
    want = {int(s) for s in section_ids or []}
    have = set(section_ids_of(conn, source_id))
    for sid in have - want:
        conn.execute("DELETE FROM source_sections WHERE source_id = ? AND section_id = ?", (source_id, sid))
    for sid in sorted(want - have):
        if conn.execute("SELECT 1 FROM sections WHERE id = ?", (sid,)).fetchone():
            pos = conn.execute("SELECT COALESCE(MAX(order_in_section) + 1, 0) FROM source_sections "
                               "WHERE section_id = ?", (sid,)).fetchone()[0]
            conn.execute("INSERT INTO source_sections (source_id, section_id, order_in_section) VALUES (?, ?, ?)",
                         (source_id, sid, pos))


def move_source(conn: sqlite3.Connection, source_id: int, section_id: int, delta: int) -> bool:
    """Порядок джерел у розділі (нумерація списку літератури)."""
    ids = [r[0] for r in conn.execute("SELECT source_id FROM source_sections WHERE section_id = ? "
                                      "ORDER BY order_in_section, source_id", (section_id,))]
    if source_id not in ids:
        return False
    i = ids.index(source_id)
    j = max(0, min(len(ids) - 1, i + delta))
    if i == j:
        return False
    ids.insert(j, ids.pop(i))
    for pos, sid in enumerate(ids):
        conn.execute("UPDATE source_sections SET order_in_section = ? WHERE source_id = ? AND section_id = ?",
                     (pos, sid, section_id))
    conn.commit()
    return True


def bibliography(conn: sqlite3.Connection, section_id: int) -> str:
    """Нумерований список літератури розділу за ДСТУ 8302:2015 (для вставки в дисертацію)."""
    return "\n".join(f"{n}. {s['citation_dstu']}" for n, s in enumerate(sources_in(conn, section_id), 1))
