"""Конфігурація BioBib у складі Clipboard Memory: шляхи до БД і файлів, базові налаштування.

Дані лежать у теці даних програми (``<дані Clipboard Memory>/biobib``): ``biobib.db`` (SQLite + FTS5)
і ``storage/`` (прикріплені файли). Програма викликає :func:`configure` до першого звернення до БД."""

from __future__ import annotations

import os
from pathlib import Path

PKG_DIR = Path(__file__).resolve().parent
STATIC_DIR = PKG_DIR / "static"

DATA_DIR = Path(os.environ.get("BIOBIB_DIR", str(Path.home() / "BioBib")))
DB_PATH = Path(os.environ.get("BIOBIB_DB_PATH", str(DATA_DIR / "biobib.db")))
STORAGE_DIR = Path(os.environ.get("BIOBIB_STORAGE_DIR", str(DATA_DIR / "storage")))

HOST = "127.0.0.1"
PORT = 8765            # перший порт, який пробуємо; якщо зайнятий — наступні

DEFAULT_SETTINGS = {
    "dstu_four_plus_authors": "first_3_et_al",  # first_3_et_al | first_1_et_al | all | title_first
    "citation_style": "dstu8302",
    "numbering_mode": "first_mention",  # first_mention | alphabetical
}

# Розділи «Посилання» за замовчуванням: папка → підпапки
DEFAULT_SECTIONS = [("Дисертація", ["Актуальність"])]


def configure(data_dir: str | Path) -> None:
    """Перемикає BioBib на теку даних ``data_dir`` (БД і файли)."""
    global DATA_DIR, DB_PATH, STORAGE_DIR
    DATA_DIR = Path(data_dir)
    DB_PATH = DATA_DIR / "biobib.db"
    STORAGE_DIR = DATA_DIR / "storage"


def ensure_directories() -> None:
    """Створює теку storage/ і теку БД, якщо їх ще немає."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
