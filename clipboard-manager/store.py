"""Сховище записів, категорій і налаштувань (без GUI — легко тестується)."""

from __future__ import annotations

import json
import os
import time
import uuid

MAX_HISTORY = 300        # скільки НЕзакріплених і некатегоризованих записів тримати
MAX_CHARS = 100_000      # довші тексти пропускаємо
MAX_CATEGORY_NAME = 30
ALL = "__all__"          # «Усі» — віртуальна категорія-перегляд
UNCAT = "__none__"       # «Без категорії»
PALETTE = ["#0f6cbd", "#107c10", "#c239b3", "#d83b01", "#8764b8", "#038387", "#986f0b", "#e3008c"]


def default_data_path() -> str:
    override = os.environ.get("CLIPBOARD_MEMORY_FILE")
    if override:
        return override
    if os.name == "nt":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, "ClipboardMemory", "history.json")
    base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    return os.path.join(base, "clipboard-memory", "history.json")


def _write_json(path: str, payload: dict) -> None:
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    if os.name != "nt":
        os.chmod(tmp, 0o600)  # в історії може бути щось приватне
    os.replace(tmp, path)


class Store:
    """Записи {id, text, pinned, ts, category} (найновіші — на початку) і категорії {id, name, color}."""

    def __init__(self, path: str, max_history: int = MAX_HISTORY):
        self.path = path
        self.max_history = max_history
        self.items: list[dict] = []
        self.categories: list[dict] = []
        self.load()

    # -- збереження ---------------------------------------------------------
    def load(self) -> None:
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            raw_items = data["items"] if isinstance(data, dict) else data
            raw_cats = data.get("categories", []) if isinstance(data, dict) else []
            self.categories = [
                {"id": str(c.get("id") or uuid.uuid4().hex), "name": str(c["name"]),
                 "color": str(c.get("color") or PALETTE[n % len(PALETTE)])}
                for n, c in enumerate(raw_cats) if isinstance(c, dict) and c.get("name")
            ]
            known = {c["id"] for c in self.categories}
            self.items = [
                {
                    "id": str(i.get("id") or uuid.uuid4().hex),
                    "text": i["text"],
                    "pinned": bool(i.get("pinned", False)),
                    "ts": float(i.get("ts", time.time())),
                    "category": i.get("category") if i.get("category") in known else None,
                }
                for i in raw_items
                if isinstance(i, dict) and isinstance(i.get("text"), str)
            ]
        except FileNotFoundError:
            self.items, self.categories = [], []
        except (ValueError, KeyError, TypeError, AttributeError, OSError):
            # пошкоджений файл — не губимо його, а відкладаємо вбік
            try:
                os.replace(self.path, self.path + ".bak")
            except OSError:
                pass
            self.items, self.categories = [], []

    def save(self) -> None:
        _write_json(self.path, {"version": 2, "categories": self.categories, "items": self.items})

    # -- записи -------------------------------------------------------------
    def find(self, item_id: str) -> dict | None:
        return next((i for i in self.items if i["id"] == item_id), None)

    def _move_to_top(self, item: dict) -> None:
        """Піднімає запис угору, але закріплені й категоризовані лишаються на місці
        (щоб бібліотека шаблонів не «пливла» після кожного кліку)."""
        item["ts"] = time.time()
        if item["pinned"] or item["category"]:
            return
        self.items.remove(item)
        self.items.insert(0, item)

    def add(self, text: str, pinned: bool = False, category: str | None = None) -> dict | None:
        """Додає запис. Якщо такий текст уже є — оновлює його (і піднімає вгору)."""
        if not text or not text.strip() or len(text) > MAX_CHARS:
            return None
        if category is not None and not self.category(category):
            category = None
        existing = next((i for i in self.items if i["text"] == text), None)
        if existing:
            existing["pinned"] = existing["pinned"] or pinned
            if category:
                existing["category"] = category
            self._move_to_top(existing)
            item = existing
        else:
            item = {"id": uuid.uuid4().hex, "text": text, "pinned": pinned,
                    "ts": time.time(), "category": category}
            self.items.insert(0, item)
        self._trim()
        self.save()
        return item

    def bump(self, item_id: str) -> None:
        item = self.find(item_id)
        if item:
            self._move_to_top(item)
            self.save()

    def update(self, item_id: str, text: str, category: str | None = ...) -> bool:  # type: ignore[assignment]
        item = self.find(item_id)
        if not item or not text.strip() or len(text) > MAX_CHARS:
            return False
        item["text"] = text
        if category is not ... and (category is None or self.category(category)):
            item["category"] = category
        self._move_to_top(item)
        self.save()
        return True

    def toggle_pin(self, item_id: str) -> None:
        item = self.find(item_id)
        if item:
            item["pinned"] = not item["pinned"]
            self._trim()
            self.save()

    def set_category(self, item_id: str, category: str | None) -> bool:
        item = self.find(item_id)
        if not item or (category is not None and not self.category(category)):
            return False
        item["category"] = category
        self._trim()
        self.save()
        return True

    def remove(self, item_id: str) -> None:
        self.items = [i for i in self.items if i["id"] != item_id]
        self.save()

    def clear_history(self) -> None:
        """Видаляє все, крім закріплених і категоризованих записів."""
        self.items = [i for i in self.items if i["pinned"] or i["category"]]
        self.save()

    # -- категорії ----------------------------------------------------------
    def category(self, cat_id: str | None) -> dict | None:
        return next((c for c in self.categories if c["id"] == cat_id), None)

    def _name_ok(self, name: str, ignore_id: str | None = None) -> str | None:
        name = " ".join(name.split())[:MAX_CATEGORY_NAME]
        if not name or name in (ALL, UNCAT):
            return None
        low = name.casefold()
        if any(c["name"].casefold() == low and c["id"] != ignore_id for c in self.categories):
            return None
        return name

    def add_category(self, name: str) -> dict | None:
        name = self._name_ok(name)
        if not name:
            return None
        used = [c["color"] for c in self.categories]
        color = min(PALETTE, key=lambda col: used.count(col))  # найменш використаний колір
        cat = {"id": uuid.uuid4().hex, "name": name, "color": color}
        self.categories.append(cat)
        self.save()
        return cat

    def rename_category(self, cat_id: str, name: str) -> bool:
        cat = self.category(cat_id)
        name = self._name_ok(name, ignore_id=cat_id)
        if not cat or not name:
            return False
        cat["name"] = name
        self.save()
        return True

    def delete_category(self, cat_id: str) -> None:
        """Видаляє категорію; її записи не губляться, а стають «Без категорії»."""
        self.categories = [c for c in self.categories if c["id"] != cat_id]
        for i in self.items:
            if i["category"] == cat_id:
                i["category"] = None
        self._trim()
        self.save()

    # -- перегляд -----------------------------------------------------------
    def view(self, query: str = "", category: str = ALL) -> list[dict]:
        """Закріплені зверху, далі за давністю; з фільтром пошуку й категорії."""
        q = query.strip().lower()
        found = [
            i for i in self.items
            if (not q or q in i["text"].lower())
            and (category == ALL
                 or (category == UNCAT and not i["category"])
                 or i["category"] == category)
        ]
        return sorted(found, key=lambda i: not i["pinned"])  # стабільне сортування

    def count(self, category: str = ALL) -> int:
        return len(self.view("", category))

    def _trim(self) -> None:
        loose = [i for i in self.items if not i["pinned"] and not i["category"]]
        for extra in loose[self.max_history:]:
            self.items.remove(extra)


DEFAULT_SETTINGS = {
    "hotkey": "ctrl+x",     # ctrl+x | ctrl+shift+x | ctrl+alt+v | off
    "autohide": True,       # ховати вікно після копіювання, якщо його відкрито гарячою клавішею
    "topmost": False,
    "paused": False,
    "width": 660,
    "height": 600,
}


class Settings:
    def __init__(self, path: str):
        self.path = path
        self.data = dict(DEFAULT_SETTINGS)
        try:
            with open(path, encoding="utf-8") as f:
                loaded = json.load(f)
            for key, default in DEFAULT_SETTINGS.items():
                if key in loaded and type(loaded[key]) is type(default):
                    self.data[key] = loaded[key]
        except (OSError, ValueError, AttributeError, TypeError):
            pass

    def __getitem__(self, key: str):
        return self.data[key]

    def __setitem__(self, key: str, value) -> None:
        self.data[key] = value
        self.save()

    def save(self) -> None:
        try:
            _write_json(self.path, self.data)
        except OSError:
            pass
