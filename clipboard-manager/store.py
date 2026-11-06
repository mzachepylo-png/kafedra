"""Дані програми (без GUI — легко тестуються).

* ``Preset``  — файл-пресет: категорії + записи (копіпасти) в них + резерв під форматування.
  Програма працює з цим файлом НАПРЯМУ: кожна зміна одразу пишеться в нього,
  а якщо файл змінили ззовні (редактор, синхронізація) — програма це підхоплює.
* ``History`` — автоматична історія буфера обміну (окремий файл, не входить у пресет).
* ``Settings`` — налаштування програми (гаряча клавіша, тема, шлях до пресета тощо).
"""

from __future__ import annotations

import json
import os
import re
import shutil
import time
import uuid

MAX_CHARS = 100_000          # довші тексти пропускаємо
MAX_HISTORY = 200            # скільки записів автоісторії тримати
MAX_CATEGORY_NAME = 30
PRESET_FORMAT = "clipboard-memory-preset"
PRESET_VERSION = 1
PRESET_SUFFIX = ".preset.json"
HISTORY = "__history__"      # «Історія буфера» — віртуальна вкладка (не категорія пресета)
MAX_PRESET_NAME = 60
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
BUILTIN_FORMATS = [{"id": "builtin-user", "name": "USER", "type": "link_user", "color": "#0f6cbd"}]
PALETTE = ["#0f6cbd", "#107c10", "#c239b3", "#d83b01", "#8764b8", "#038387", "#986f0b", "#e3008c"]


class PresetError(Exception):
    """Файл пресета не вдалося відкрити (повідомлення призначене для користувача)."""


# --------------------------------------------------------------------------- #
#  Шляхи
# --------------------------------------------------------------------------- #

def default_data_dir() -> str:
    override = os.environ.get("CLIPBOARD_MEMORY_DIR")
    if override:
        return override
    if os.name == "nt":
        return os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "ClipboardMemory")
    return os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"), "clipboard-memory")


def default_preset_path(data_dir: str) -> str:
    return os.path.join(data_dir, "default" + PRESET_SUFFIX)


def history_path(data_dir: str) -> str:
    return os.path.join(data_dir, "clipboard_history.json")


def _write_json(path: str, payload) -> None:
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    if os.name != "nt":
        os.chmod(tmp, 0o600)  # усередині може бути щось приватне
    os.replace(tmp, path)


def _clean_text(text: str) -> str | None:
    return text if text and text.strip() and len(text) <= MAX_CHARS else None


# --------------------------------------------------------------------------- #
#  Пресет
# --------------------------------------------------------------------------- #

class Preset:
    """Категорії {id, name, color, snippets:[{id, text, ts}]}; ``formats`` — резерв під форматування."""

    def __init__(self, path: str, name: str | None = None):
        self.path = path
        self.name = name or _stem(path)
        self.categories: list[dict] = []
        self.formats: list[dict] = []
        self._mtime: int | None = None
        self._ensure_builtin_formats()

    def _ensure_builtin_formats(self) -> None:
        """Вбудовані формати (зараз USER) є в кожному пресеті; свій колір формату зберігається."""
        have = {f["id"] for f in self.formats}
        for f in BUILTIN_FORMATS:
            if f["id"] not in have:
                self.formats.append(dict(f))

    # -- відкриття / створення ----------------------------------------------
    @classmethod
    def open(cls, path: str) -> "Preset":
        """Відкриває існуючий файл. Кидає PresetError, якщо файл не схожий на пресет."""
        p = cls(path)
        p.load()
        return p

    @classmethod
    def open_or_create(cls, path: str, name: str | None = None) -> "Preset":
        if os.path.exists(path):
            return cls.open(path)
        p = cls(path, name)
        p.save()
        return p

    def load(self) -> None:
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            raise PresetError(f"Файл не знайдено: {self.path}") from None
        except (OSError, ValueError) as e:
            raise PresetError(f"Не вдалося прочитати файл пресета ({e.__class__.__name__}).") from None
        if not isinstance(data, dict) or not isinstance(data.get("categories"), list):
            raise PresetError("Це не файл пресета (немає списку категорій).")
        if data.get("format", PRESET_FORMAT) != PRESET_FORMAT:
            raise PresetError("Файл має чужий формат.")
        cats, seen = [], set()
        for n, c in enumerate(data["categories"]):
            if not isinstance(c, dict) or not c.get("name"):
                continue
            cid = str(c.get("id") or uuid.uuid4().hex)
            if cid in seen:
                continue
            seen.add(cid)
            snippets = []
            for s in c.get("snippets", []):
                if isinstance(s, dict) and isinstance(s.get("text"), str):
                    snip = {"id": str(s.get("id") or uuid.uuid4().hex), "text": s["text"],
                            "ts": float(s.get("ts", time.time()))}
                    if _color_ok(s.get("color")):
                        snip["color"] = s["color"]       # власний колір запису (має пріоритет над кольором папки)
                    snippets.append(snip)
            cats.append({"id": cid, "name": str(c["name"])[:MAX_CATEGORY_NAME],
                         "color": c["color"] if _color_ok(c.get("color")) else PALETTE[n % len(PALETTE)],
                         "snippets": snippets})
        self.categories = cats
        self.formats = [dict(f, color=f["color"] if _color_ok(f.get("color")) else PALETTE[0])
                        for f in data.get("formats", [])
                        if isinstance(f, dict) and f.get("id") and f.get("name")]   # невідомі типи не губимо
        self._ensure_builtin_formats()
        self.name = str(data.get("name") or _stem(self.path))[:MAX_PRESET_NAME]
        self._mtime = self._disk_mtime()

    def save(self) -> None:
        _write_json(self.path, {"format": PRESET_FORMAT, "version": PRESET_VERSION, "name": self.name,
                                "categories": self.categories, "formats": self.formats})
        self._mtime = self._disk_mtime()

    def save_as(self, path: str, name: str | None = None) -> None:
        """«Зберегти як…»: пише копію у новий файл і далі працює вже з ним."""
        self.path = path
        if name:
            self.name = name
        self.save()

    # -- зміни ззовні ---------------------------------------------------------
    def _disk_mtime(self) -> int | None:
        try:
            return os.stat(self.path).st_mtime_ns
        except OSError:
            return None

    def changed_on_disk(self) -> bool:
        m = self._disk_mtime()
        return m is not None and m != self._mtime

    def reload(self) -> bool:
        """Перечитує файл, якщо його змінили ззовні. False — якщо нічого не змінилось або файл пошкоджений."""
        if not self.changed_on_disk():
            return False
        try:
            self.load()
        except PresetError:
            return False
        return True

    # -- категорії ------------------------------------------------------------
    def category(self, cat_id: str | None) -> dict | None:
        return next((c for c in self.categories if c["id"] == cat_id), None)

    def _name_ok(self, name: str, ignore_id: str | None = None) -> str | None:
        name = " ".join(name.split())[:MAX_CATEGORY_NAME]
        if not name or name == HISTORY:
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
        cat = {"id": uuid.uuid4().hex, "name": name,
               "color": min(PALETTE, key=lambda col: used.count(col)), "snippets": []}
        self.categories.append(cat)
        self.save()
        return cat

    def rename_category(self, cat_id: str, name: str) -> bool:
        cat, name = self.category(cat_id), self._name_ok(name, ignore_id=cat_id)
        if not cat or not name:
            return False
        cat["name"] = name
        self.save()
        return True

    def delete_category(self, cat_id: str) -> int:
        """Видаляє категорію разом із записами. Повертає, скільки записів видалено."""
        cat = self.category(cat_id)
        if not cat:
            return 0
        self.categories.remove(cat)
        self.save()
        return len(cat["snippets"])

    def move_category(self, cat_id: str, delta: int) -> None:
        cat = self.category(cat_id)
        if not cat:
            return
        i = self.categories.index(cat)
        j = max(0, min(len(self.categories) - 1, i + delta))
        self.categories.insert(j, self.categories.pop(i))
        self.save()

    # -- записи (копіпасти) ---------------------------------------------------
    def find_snippet(self, snippet_id: str | None) -> tuple[dict, dict] | None:
        for c in self.categories:
            for s in c["snippets"]:
                if s["id"] == snippet_id:
                    return c, s
        return None

    def add_snippet(self, cat_id: str, text: str) -> dict | None:
        """Додає запис у категорію. Однаковий текст у тій самій категорії не дублюється."""
        cat = self.category(cat_id)
        if not cat or not _clean_text(text):
            return None
        existing = next((s for s in cat["snippets"] if s["text"] == text), None)
        if existing:
            return existing
        snip = {"id": uuid.uuid4().hex, "text": text, "ts": time.time()}
        cat["snippets"].append(snip)
        self.save()
        return snip

    def update_snippet(self, snippet_id: str, text: str, cat_id: str | None = None) -> bool:
        found = self.find_snippet(snippet_id)
        if not found or not _clean_text(text):
            return False
        cat, snip = found
        snip["text"] = text
        if cat_id and cat_id != cat["id"] and self.category(cat_id):
            cat["snippets"].remove(snip)
            self.category(cat_id)["snippets"].append(snip)
        self.save()
        return True

    def move_snippet(self, snippet_id: str, cat_id: str) -> bool:
        found, dest = self.find_snippet(snippet_id), self.category(cat_id)
        if not found or not dest:
            return False
        cat, snip = found
        if cat is not dest:
            cat["snippets"].remove(snip)
            dest["snippets"].append(snip)
            self.save()
        return True

    def reorder_snippet(self, snippet_id: str, delta: int) -> None:
        found = self.find_snippet(snippet_id)
        if not found:
            return
        lst = found[0]["snippets"]
        i = lst.index(found[1])
        j = max(0, min(len(lst) - 1, i + delta))
        lst.insert(j, lst.pop(i))
        self.save()

    def remove_snippet(self, snippet_id: str) -> None:
        found = self.find_snippet(snippet_id)
        if found:
            found[0]["snippets"].remove(found[1])
            self.save()

    def snippets(self, cat_id: str | None = None, query: str = "") -> list[dict]:
        """Записи категорії (або всіх, якщо cat_id=None) з фільтром пошуку; у кожному є поле 'category'."""
        q = query.strip().lower()
        out = []
        for c in self.categories:
            if cat_id is None or c["id"] == cat_id:
                out += [dict(s, category=c["id"], own_color=s.get("color"), color=s.get("color") or c["color"])
                        for s in c["snippets"] if not q or q in s["text"].lower()]
        return out

    def count(self, cat_id: str) -> int:
        cat = self.category(cat_id)
        return len(cat["snippets"]) if cat else 0

    # -- кольори --------------------------------------------------------------
    def set_category_color(self, cat_id: str, color: str) -> bool:
        """Колір папки одразу діє на всі її записи, які не мають власного кольору."""
        cat = self.category(cat_id)
        if not cat or not _color_ok(color):
            return False
        cat["color"] = color.lower()
        self.save()
        return True

    def set_snippet_color(self, snippet_id: str, color: str | None) -> bool:
        """Власний колір запису (зберігається у файлі й не змінюється з кольором папки). None — скинути."""
        found = self.find_snippet(snippet_id)
        if not found or (color is not None and not _color_ok(color)):
            return False
        if color is None:
            found[1].pop("color", None)
        else:
            found[1]["color"] = color.lower()
        self.save()
        return True

    def format(self, format_id: str | None) -> dict | None:
        return next((f for f in self.formats if f["id"] == format_id), None)

    def set_format_color(self, format_id: str, color: str) -> bool:
        fmt = self.format(format_id)
        if not fmt or not _color_ok(color):
            return False
        fmt["color"] = color.lower()
        self.save()
        return True

    # -- назва пресета --------------------------------------------------------
    def rename(self, new_name: str, rename_file: bool = True) -> str:
        """Змінює назву пресета (і за потреби — ім'я файлу). Повертає нову назву.
        Кидає PresetError, якщо назва порожня, зайнята або файл не вдалося перейменувати."""
        name = " ".join(new_name.split())[:MAX_PRESET_NAME]
        safe = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "", name).strip(" .")
        if not name or not safe:
            raise PresetError("Назва не може бути порожньою або складатись лише зі службових символів.")
        old_path, old_name = self.path, self.name
        new_path = os.path.join(os.path.dirname(old_path), safe + PRESET_SUFFIX)
        same_file = os.path.normcase(os.path.abspath(new_path)) == os.path.normcase(os.path.abspath(old_path))
        if rename_file and not same_file and os.path.exists(new_path):
            raise PresetError(f"Файл «{os.path.basename(new_path)}» уже існує в цій теці.")
        self.name = name
        self.save()
        if rename_file and not same_file:
            try:
                os.replace(old_path, new_path)
            except OSError as e:
                self.name = old_name
                self.save()
                raise PresetError(f"Не вдалося перейменувати файл ({e.__class__.__name__}).") from None
            self.path = new_path
            self._mtime = self._disk_mtime()
        return name

    # -- імпорт ---------------------------------------------------------------
    def import_from(self, path: str) -> tuple[int, int]:
        """Додає вміст іншого пресета до поточного (категорії зливаються за назвою).
        Повертає (нових категорій, нових записів)."""
        other = Preset.open(path)
        new_cats = new_snips = 0
        for oc in other.categories:
            mine = next((c for c in self.categories if c["name"].casefold() == oc["name"].casefold()), None)
            if not mine:
                mine = {"id": uuid.uuid4().hex, "name": oc["name"], "color": oc["color"], "snippets": []}
                self.categories.append(mine)
                new_cats += 1
            have = {s["text"] for s in mine["snippets"]}
            for s in oc["snippets"]:
                if s["text"] not in have:
                    mine["snippets"].append(dict(s, id=uuid.uuid4().hex))
                    have.add(s["text"])
                    new_snips += 1
        if new_cats or new_snips:
            self.save()
        return new_cats, new_snips


def _color_ok(color) -> bool:
    return isinstance(color, str) and bool(COLOR_RE.match(color))


def _stem(path: str) -> str:
    base = os.path.basename(path)
    return base[: -len(PRESET_SUFFIX)] if base.endswith(PRESET_SUFFIX) else os.path.splitext(base)[0]


# --------------------------------------------------------------------------- #
#  Історія буфера
# --------------------------------------------------------------------------- #

class History:
    """Автоматично захоплені копіювання; найновіші — на початку. Не входить у пресет."""

    def __init__(self, path: str, max_items: int = MAX_HISTORY):
        self.path, self.max_items = path, max_items
        self.items: list[dict] = []
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            self.items = [{"id": str(i.get("id") or uuid.uuid4().hex), "text": i["text"],
                           "ts": float(i.get("ts", time.time()))}
                          for i in data["items"] if isinstance(i, dict) and isinstance(i.get("text"), str)]
        except FileNotFoundError:
            pass
        except (ValueError, KeyError, TypeError, AttributeError, OSError):
            try:
                os.replace(path, path + ".bak")
            except OSError:
                pass

    def save(self) -> None:
        _write_json(self.path, {"version": 1, "items": self.items})

    def find(self, item_id: str | None) -> dict | None:
        return next((i for i in self.items if i["id"] == item_id), None)

    def add(self, text: str) -> dict | None:
        if not _clean_text(text):
            return None
        item = next((i for i in self.items if i["text"] == text), None)
        if item:
            self.items.remove(item)
            item["ts"] = time.time()
        else:
            item = {"id": uuid.uuid4().hex, "text": text, "ts": time.time()}
        self.items.insert(0, item)
        del self.items[self.max_items:]
        self.save()
        return item

    def bump(self, item_id: str) -> None:
        item = self.find(item_id)
        if item:
            self.items.remove(item)
            item["ts"] = time.time()
            self.items.insert(0, item)
            self.save()

    def remove(self, item_id: str) -> None:
        self.items = [i for i in self.items if i["id"] != item_id]
        self.save()

    def clear(self) -> None:
        self.items = []
        self.save()

    def view(self, query: str = "") -> list[dict]:
        q = query.strip().lower()
        return [i for i in self.items if not q or q in i["text"].lower()]


# --------------------------------------------------------------------------- #
#  Налаштування
# --------------------------------------------------------------------------- #

DEFAULT_SETTINGS = {
    "hotkey": "ctrl+x",     # ctrl+x | ctrl+shift+x | ctrl+alt+v | off
    "autohide": True,       # ховати вікно після копіювання, якщо його відкрито гарячою клавішею
    "topmost": False,
    "paused": False,
    "theme": "system",      # system | light | dark
    "preset_path": "",      # поточний файл-пресет ("" — типовий)
    "recent_presets": [],   # останні відкриті пресети
    "width": 1180,
    "height": 660,
}


class Settings:
    def __init__(self, path: str):
        self.path = path
        self.data = {k: (list(v) if isinstance(v, list) else v) for k, v in DEFAULT_SETTINGS.items()}
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

    def remember_preset(self, path: str) -> None:
        recent = [p for p in self.data["recent_presets"] if p != path]
        self.data["recent_presets"] = ([path] + recent)[:8]
        self.data["preset_path"] = path
        self.save()

    def replace_preset_path(self, old: str, new: str) -> None:
        """Після перейменування файлу пресета: оновлює поточний шлях і список останніх."""
        recent = [new if p == old else p for p in self.data["recent_presets"]]
        self.data["recent_presets"] = list(dict.fromkeys(recent))[:8]
        self.data["preset_path"] = new if self.data["preset_path"] == old else self.data["preset_path"]
        self.save()

    def save(self) -> None:
        try:
            _write_json(self.path, self.data)
        except OSError:
            pass


# --------------------------------------------------------------------------- #
#  Старт: вибір пресета і міграція зі старої версії
# --------------------------------------------------------------------------- #

def migrate_legacy(legacy_file: str, preset: Preset, history: History) -> bool:
    """Старий формат (v2: один файл, записи мали поле category) → пресет + історія.
    Записи з категоріями йдуть у пресет, закріплені без категорії — у категорію «Закріплені»,
    решта — в історію. Старий файл не видаляється, а перейменовується в .migrated."""
    try:
        with open(legacy_file, encoding="utf-8") as f:
            data = json.load(f)
        items = [i for i in data["items"] if isinstance(i, dict) and isinstance(i.get("text"), str)]
        old_cats = [c for c in data.get("categories", []) if isinstance(c, dict) and c.get("name")]
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return False
    id_map = {}
    for c in old_cats:
        new = preset.add_category(str(c["name"]))
        if new:
            if c.get("color"):
                new["color"] = str(c["color"])
            id_map[c.get("id")] = new["id"]
    pinned_cat = None
    for i in reversed(items):  # у старому файлі найновіші були першими
        cid = id_map.get(i.get("category"))
        if cid:
            preset.add_snippet(cid, i["text"])
        elif i.get("pinned"):
            if pinned_cat is None:
                pinned_cat = next((c for c in preset.categories if c["name"] == "Закріплені"), None) \
                    or preset.add_category("Закріплені")
            if pinned_cat:
                preset.add_snippet(pinned_cat["id"], i["text"])
        else:
            history.add(i["text"])
    preset.save()
    try:
        os.replace(legacy_file, legacy_file + ".migrated")
    except OSError:
        pass
    return True


def open_startup_preset(settings: Settings, data_dir: str, preset_arg: str | None = None) -> tuple[Preset, str | None]:
    """Обирає й відкриває пресет при старті: аргумент командного рядка → останній з налаштувань → типовий.
    Повертає (пресет, попередження для користувача або None)."""
    default = default_preset_path(data_dir)
    wanted = preset_arg or settings["preset_path"] or default
    warning = None
    try:
        preset = Preset.open_or_create(wanted)
    except PresetError as e:
        warning = f"Пресет «{os.path.basename(wanted)}» не відкрито: {e} Використано типовий пресет."
        wanted = default
        try:
            preset = Preset.open_or_create(default)
        except PresetError:
            shutil.copy2(default, default + ".bak")
            os.remove(default)
            preset = Preset.open_or_create(default)
    if os.path.normcase(os.path.abspath(wanted)) == os.path.normcase(os.path.abspath(default)) \
            and not preset.categories:
        legacy = os.path.join(data_dir, "history.json")
        if os.path.exists(legacy):
            migrate_legacy(legacy, preset, History(history_path(data_dir)))
    settings.remember_preset(preset.path)
    return preset, warning
