#!/usr/bin/env python3
"""Менеджер буфера обміну з пресетами — аналог Win+V.

Три колонки: категорії · записи вибраної категорії · форматування (заглушка).

* Автоматично запам'ятовує скопійований текст в «Історію буфера» (окремий файл).
* Свої копіпасти складаються в категорії; усе це лежить у файлі-ПРЕСЕТІ, з яким
  програма працює напряму (відкрити / зберегти як / імпортувати інший пресет).
* Клік по запису — текст одразу копіюється в буфер обміну; запис можна перетягнути в категорію.
* Ctrl+X (налаштовується) відкриває/ховає вікно; програма живе в треї.

Запуск:  python clipboard_manager.py
"""

from __future__ import annotations

import copy
import os
import re
import time

_T0 = time.perf_counter()          # початок імпорту модуля — точка відліку для --timing
_TIMING = os.environ.get("CLIPBOARD_MEMORY_TIMING") == "1"   # або прапорець --timing
_MARKS: list[tuple[str, float, float]] = []


def _mark(name: str) -> None:
    """Мітка стадії запуску (для --timing). Коли вимір вимкнено — це одна перевірка прапора."""
    if _TIMING:
        _MARKS.append((name, (time.perf_counter() - _T0) * 1000, time.time()))


import argparse
import queue
import sys
import threading
import traceback
import uuid
import tkinter as tk
import tkinter.font as tkfont
from functools import lru_cache
from types import SimpleNamespace

import customtkinter as ctk

from formats import (APPENDERS, AUTO_HISTORY_FORMATS, FORMATTERS, MERGE_ACTIONS, append_result, apply_format,
                     SHAPES, USER_TAG, apply_merge, clean_count, shape_for_color, take, apply_user_link, clean_ctor, clean_v2, compose_phrases, ctor_count, ctor_label,
                     fill_email, infer_tag, render_tag, resolve_tags, tag_ref, fill_placeholders, format_actions,
                     has_user_placeholder, join_values, last_email, last_user_id, numbers_from_history, recent_numbers,
                     SINGLE_RESULT_FORMATS, recent_four_digit_entries,
                     MAX_RECENT_NUMBERS,
                     user_ids_from_history,
                     user_link, user_links, v2_compose)
from store import (HISTORY, PALETTE, PRESET_SUFFIX, History, Preset, PresetError, Settings,
                   default_data_dir, history_path, open_startup_preset)
from winsys import (work_area_at, HOTKEY_PRESETS, HotkeyListener, LocalKeys, acquire_single_instance, clipboard_sequence, hotkey_label,
                    icon_ico_path, icon_png_base64, notify, start_tray)

class _LazyModule:
    """Модуль, який імпортується при першому зверненні (діалоги потрібні рідко, а не для першого малювання).
    Атрибути можна підміняти (у тестах) — вони перекривають справжні."""

    def __init__(self, name: str):
        self._name, self._mod = name, None

    def __getattr__(self, attr: str):
        if self._mod is None:
            import importlib
            self._mod = importlib.import_module(self._name)
        return getattr(self._mod, attr)


SCROLL_FACTOR = 2               # прокрутка колесом миші в усіх списках — у 2 рази швидша, ніж типова в ctk


class ScrollFrame(ctk.CTkScrollableFrame):
    """CTkScrollableFrame з удвічі швидшою прокруткою колесом: ctk гортає на N «одиниць», одиниця — yscrollincrement
    полотна (Windows 1 px, macOS 8, Linux 30), тож більша одиниця = швидше (зокрема в діалогах і «Посиланнях»)."""

    def _set_scroll_increments(self):
        super()._set_scroll_increments()
        try:
            c = self._parent_canvas
            c.configure(xscrollincrement=int(float(c.cget("xscrollincrement")) or 1) * SCROLL_FACTOR,
                        yscrollincrement=int(float(c.cget("yscrollincrement")) or 1) * SCROLL_FACTOR)
        except (tk.TclError, ValueError):
            pass


colorchooser = _LazyModule("tkinter.colorchooser")
filedialog = _LazyModule("tkinter.filedialog")
messagebox = _LazyModule("tkinter.messagebox")

_IMPORTS_DONE_MS = (time.perf_counter() - _T0) * 1000      # плейн-змінні: --timing розбирається пізніше,
_IMPORTS_DONE_EPOCH = time.time()                          # але імпорти теж треба показати в журналі

APP_NAME = "Буфер обміну"
POLL_MS = 400                  # опитування буфера обміну
EVENT_POLL_MS = 20             # опитування звичайної черги подій (без WakeQueue): затримка показу ≤ 20 мс
EVENT_FALLBACK_MS = 200        # з WakeQueue опитування лише підстраховує (основне — миттєве пробудження)
FIRST_CHUNK = 8                # скільки НОВИХ карток малюємо синхронно (вистачає на перший екран) …
NEXT_CHUNK = 8                 # … решту — порціями між подіями, щоб вікно з'являлось одразу
SCROLLBAR_W = 13               # скільки логічних пікселів ширини забирає смуга прокрутки списку
REC_TILE_MIN = 230             # мінімальна ширина плитки копіпаста (px)
CAT_TILE_MIN_LEFT = 380        # від такої ширини лівої колонки папки-плитки йдуть по 3 в ряд, вужче — по 2
LEFT_MIN = 230                 # межі, в яких користувач може пересувати границю між папками і копіпастами
LEFT_MAX_USER = 760
MID_MIN = 440                  # мінімальна ширина середньої колонки (копіпасти) при пересуванні границі
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
CARD_MIN_H = 68                # мінімальна висота картки-рядка: велика ціль для миші
CARD_EST_H = 96                # орієнтовна висота картки (для передбачення смуги прокрутки до розкладки)
SEARCH_DEBOUNCE_MS = 60        # пошук реагує на набір після короткої паузи, а не на кожну літеру
TOGGLE_DEBOUNCE = 0.15         # с: подвійне натискання гарячої клавіші не «дзеленчить» вікном
FONT = "Segoe UI"
MONO = "Consolas"
PAGE = 60                      # скільки карток малювати за раз (віджети ctk важкі)
LEFT_W, RIGHT_W = 300, 344     # мінімальна ширина бічних колонок (у «логічних» пікселях ctk)
LEFT_MAX, RIGHT_MAX = 400, 480  # верхня межа: на великому екрані колонки ростуть, але не безмежно
LEFT_FRAC, RIGHT_FRAC = 0.18, 0.22   # частка ширини вікна
ROW_H = 54                     # висота рядка категорії (великі, повністю залиті кольором, як картки)
LOG_LIMIT = 200_000            # app.log / error.log: при перевищенні старий файл відкладається в *.1
CHECK_SIZE = 48                # галочка вибору запису в історії (у 2 рази більша за звичайну)
# біт Alt у event.state: на Windows — 0x20000 (0x8 там означає увімкнений NumLock!), на Linux/X11 — 0x8
ALT_MASK = 0x20000 if os.name == "nt" else 0x8
TILE_GROW = 1.15             # плитка папки під «курсором» (остання відкрита) — на 15 % більша, поверх сусідів
PICK_TILE_MIN = 230          # мінімальна ширина плитки папки на сторінці вибору папки (режим «спочатку папка»)
CELL_LINE = ("#e1e5eb", "#2c3038")   # ледь помітні рамки порожніх клітинок сітки записів (режим «спочатку папка»)
CELL_EXTRA_ROWS = 2          # порожніх рядів клітинок під останньою плиткою — щоб було куди перетягнути
PICK_TILE_MAX = 300
PICK_FONT_SIZES = (13, 14, 15, 16.5, 18, 20, 22, 24)          # … і максимальна: блок плиток стоїть по центру, а не розтягується на весь екран
PICK_RESIZE_MS = 40           # сторінка вибору папки: розкладка плиток під час зміни розміру вікна — не частіше
CAT_SCROLL_FACTOR = 2          # у скільки разів швидша прокрутка колесом у списку папок
ZONE_W = 150                   # права «службова» зона картки (галочка, «⋯», «✕»): клік там нічого не копіює
CARD_RESERVE_FOLDER = 195       # те саме для записів папок (службова зона без галочки)
CARD_RESERVE = 260             # справа від тексту картки: кнопки Copy / Copy and Close, галочка, «⋯», «✕»
WIDE_HEADER = 700              # від такої ширини центральної панелі кнопка «Об'єднати» стоїть у шапці, а не під нею
CARD_MAX = 980                 # картки в центрі не розтягуються ширше за це (на весь екран лишаються поля)

# Палітра: (світла тема, темна тема)
BG = ("#eceff4", "#16171a")
PANEL = ("#f8f9fb", "#1f2125")
PANEL_BORDER = ("#dde1e8", "#2c2f35")
CARD = ("#ffffff", "#2a2d33")
CARD_HOVER = ("#f0f6fd", "#32363e")
CARD_BORDER = ("#e1e4ea", "#3a3e46")
ROW_HOVER = ("#e8ecf2", "#2a2d34")
ROW_SEL = ("#d9e9fb", "#243b57")
DROP = ("#b9d9f8", "#2f5d8f")
NAV_MARK = ("#0a7cff", "#47b0ff")         # рамка папки під клавіатурним «курсором» / цілі перетягування (замість заливки)
NAV_MARK_W = 5
TEXT = ("#15171b", "#f3f4f6")
MUTED = ("#6a717c", "#9aa1ab")
META = ("#4d5561", "#bcc3cd")            # дата/довжина під записом: помітно темніша/світліша за MUTED
NEUTRAL = ("#c5cbd5", "#4c515b")         # смужка запису без кольору (історія)
FAINT = ("#a4abb6", "#5d636d")
ACCENT = "#0f6cbd"
ACCENT_HOVER = "#115ea3"
ACCENT_SOFT = ("#e3effc", "#1d3552")
DANGER = ("#c42b1c", "#ff7a6e")
DANGER_SOFT = ("#fde7e4", "#4a2623")
BTN2 = ("#e3e6ec", "#33363d")
BTN2_HOVER = ("#d4d9e1", "#3e424a")
INPUT = ("#ffffff", "#2a2d33")
SCROLL = ("#e4e8ee", "#2f3238")
SCROLL_HOVER = ("#c5ccd6", "#4a4f58")
MENU_BG = ("#ffffff", "#25272c")
MENU_BORDER = ("#cfd5de", "#454a53")
MENU_HOVER = ("#e6f0fc", "#2f4560")
MENU_SEP = ("#e3e6eb", "#3a3e45")
COPIED = ("#2e9e57", "#2f9e5a")
BADGE = ("#7a3fd1", "#8e5ae0")            # плашка «⧉ КОНСТРУКТОР» на картці
CTOR_DEFAULT = "#8764b8"                   # колір конструкту без власного кольору
CTOR_LEAF = "#22a559"                      # у вікні вибору: кінцевий конструкт без кольору          # плашка «✓ Скопійовано» на картці
PAIR = ("#fff3c4", "#4b4220")             # жовтуватий фон пари об'єднуваних швидких фраз (Active subscriptions + Internal charges)
ARMED = ("#d97706", "#f59e0b")           # режим Append: «заряджена» кнопка й банер
ARMED_SOFT = ("#fdf0dc", "#473412")

THEMES = [("system", "Як у системі"), ("light", "Світла"), ("dark", "Темна")]

# Кольори для вибору: палітра пресета + кілька додаткових (4 × 3 = 12 плашок)
SWATCHES = PALETTE + ["#e81123", "#ffb900", "#00b294", "#69797e"]

FORMAT_INFO = {   # опис відомих типів форматів: (підпис у списку, підказка над полем)
    "link_user": ("ID користувачів → {LINK:USER:ID:E}",
                  "Вставте ID: 123, User#456 789 …"),
    "cards_added": ("→ Cards …/Card … were added during suspicious login.",
                    "Вставте номери карток: 1245, 1231 236532 …"),
    "suspicious_cards": ("→ Suspicious cards … were added.",
                         "Вставте номери карток: 1245, 1254 2365 …"),
    "link_user_text": ("User #123 / 123 у тексті → {LINK:USER:123:E}", ""),
}


def _rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def blend(fg: str, bg: str, t: float) -> str:
    """Змішує колір fg у bg з вагою t (0…1) → '#rrggbb'."""
    a, b = _rgb(fg), _rgb(bg)
    return "#%02x%02x%02x" % tuple(round(b[i] + (a[i] - b[i]) * t) for i in range(3))


@lru_cache(maxsize=256)
def tint(color: str, t_light: float = 0.11, t_dark: float = 0.19) -> tuple[str, str]:
    """Колір картки (світла, темна тема) = базовий фон картки з домішкою кольору запису/папки."""
    return blend(color, CARD[0], t_light), blend(color, CARD[1], t_dark)


# Насиченість кольорів карток і папок: s = 0…1 (окремо для записів і для папок, ⚙ → «Кольори й рамки…»).
# sat_params(s) → частка кольору у фоні (світла, темна тема) для фону, фону при наведенні, вибраної папки і вага
# кольору в блідій рамці. Іменовані рівні — точки на цій шкалі.
def sat_params(s: float) -> tuple:
    s = max(0.0, min(1.0, float(s)))
    fl, fd = 0.11 + 0.81 * s, 0.19 + 0.69 * s
    return ((round(fl, 3), round(fd, 3)), (round(min(1.0, fl + 0.09), 3), round(min(1.0, fd + 0.08), 3)),
            (round(min(1.0, fl + 0.17), 3), round(min(1.0, fd + 0.15), 3)), round(min(1.0, 0.40 + 0.6 * s), 3))


LEVEL_SAT = [0.0, 0.18, 0.40, 0.68, 1.0]
COLOR_LEVELS = [sat_params(v) for v in LEVEL_SAT]
COLOR_LEVEL_NAMES = ["Слабка", "Середня", "Сильна", "Дуже сильна", "Максимальна"]
COLOR_LEVEL_SHORT = ["Слабка", "Середня", "Сильна", "Дуже", "Макс."]
_SAT = [0.40, 0.40]               # насиченість: [записи (і фрази, формати), папки]
_COLOR_LEVEL = [2]                # найближчий іменований рівень (позначка в меню; -1 — власне значення)
# Рамки карток і папок: товщина 1…6 px і яскравість 0…1 (0 — блідий відтінок кольору, 1 — соковитий колір)
BORDER_WIDTHS = [1, 2, 3, 4]
BORDER_GLOWS = [0.0, 1.0, 1.0, 1.0]
BORDER_LEVEL_NAMES = ["Тонка", "Помітна", "Жирна", "Дуже жирна"]
_BORDER = [2, 1.0]                # [товщина, яскравість]
_BORDER_LEVEL = [1]


def _sync_named_levels() -> None:
    _COLOR_LEVEL[0] = next((n for n, v in enumerate(LEVEL_SAT)
                            if abs(v - _SAT[0]) < 0.005 and abs(v - _SAT[1]) < 0.005), -1)
    _BORDER_LEVEL[0] = next((n for n, (w, g) in enumerate(zip(BORDER_WIDTHS, BORDER_GLOWS))
                             if w == _BORDER[0] and abs(g - _BORDER[1]) < 0.005), -1)


def set_color_level(level: int) -> None:
    """Іменований рівень насиченості — для записів і папок разом."""
    n = max(0, min(len(LEVEL_SAT) - 1, int(level)))
    _SAT[0] = _SAT[1] = LEVEL_SAT[n]
    _sync_named_levels()


def set_saturation(cards: float | None = None, folders: float | None = None) -> None:
    """Точна насиченість (0…1): окремо для записів і для папок."""
    if cards is not None:
        _SAT[0] = max(0.0, min(1.0, float(cards)))
    if folders is not None:
        _SAT[1] = max(0.0, min(1.0, float(folders)))
    _sync_named_levels()


def set_border_level(level: int) -> None:
    n = max(0, min(len(BORDER_WIDTHS) - 1, int(level)))
    _BORDER[0], _BORDER[1] = BORDER_WIDTHS[n], BORDER_GLOWS[n]
    _sync_named_levels()


def set_border(width: int | None = None, glow: float | None = None) -> None:
    """Точні рамки: товщина 1…6 px, яскравість 0…1."""
    if width is not None:
        _BORDER[0] = max(1, min(6, int(width)))
    if glow is not None:
        _BORDER[1] = max(0.0, min(1.0, float(glow)))
    _sync_named_levels()


def border_width(selected: bool = False) -> int:
    """Товщина рамки картки/папки (вибрана — на 1 товща, щонайменше 2)."""
    w = _BORDER[0]
    return max(2, w + 1) if selected else w


def _level(which: int = 0):
    """Параметри насиченості: which=0 — записи, 1 — папки."""
    return sat_params(_SAT[which])


def _luminance(h: str) -> float:
    def ch(v: int) -> float:
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = _rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a: str, b: str) -> float:
    la, lb = sorted((_luminance(a), _luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


@lru_cache(maxsize=1024)
def ink(fill, kind: str = "text") -> tuple[str, str]:
    """Колір тексту на фоні fill: звичайний (TEXT / META / MUTED), а на насиченому фоні, де він погано видно, —
    білий або майже чорний (що контрастніше). kind: text | meta | muted."""
    base = {"text": TEXT, "meta": META, "muted": MUTED}[kind]
    if not isinstance(fill, tuple):
        return base
    need = 4.5 if kind == "text" else 3.0
    out = []
    for i in (0, 1):
        f, b = fill[i], base[i]
        if contrast(b, f) >= need:
            out.append(b)
            continue
        alt = max(("#ffffff", "#000000"), key=lambda c: contrast(c, f))   # одне з двох завжди ≥ 4.58
        out.append(alt if kind == "text" else blend(alt, f, 0.82))
    return tuple(out)


def border_color(color: str | None, custom: str | None = None, which: int = 0) -> tuple[str, str]:
    """Рамка картки/папки: власний колір рамки, або від кольору запису/папки. Яскравість рамки (0…1) змішує
    блідий відтінок кольору (як було) з соковитим кольором; на дуже насиченому фоні соковитий — темніший."""
    glow = _BORDER[1]
    src = custom or color
    if not src:
        strong = ("#7d8695", "#8a93a1")
        return blend(strong[0], CARD_BORDER[0], glow), blend(strong[1], CARD_BORDER[1], glow)
    if custom:
        full = (custom.lower(), custom.lower())
    elif _SAT[which] >= 0.6:
        full = (blend("#000000", src, 0.30), blend("#ffffff", src, 0.35))
    else:
        full = (src.lower(), src.lower())
    w = _level(which)[3]
    pale = (blend(src, CARD_BORDER[0], w), blend(src, CARD_BORDER[1], min(1.0, w + 0.15)))
    if glow >= 0.999:
        return full
    if glow <= 0.001:
        return pale
    return blend(full[0], pale[0], glow), blend(full[1], pale[1], glow)


def row_colors(color: str | None, border: str | None = None) -> tuple[tuple, tuple, tuple, tuple]:
    """(фон, фон при наведенні, фон вибраного, рамка) для рядка категорії в бічній колонці.
    З кольором — та сама рецептура, що й у карток записів, але зі своєю насиченістю папок (⚙ → «Кольори й
    рамки…»); вибраний рядок — із сильнішим відтінком. Без кольору (історія) — нейтральний."""
    if not color:
        return ("transparent", ROW_HOVER, ROW_SEL, PANEL_BORDER)
    lv = _level(1)
    return tint(color, *lv[0]), tint(color, *lv[1]), tint(color, *lv[2]), border_color(color, border, 1)


def card_colors(color: str | None, border: str | None = None) -> tuple[tuple, tuple, tuple]:
    """(фон, фон при наведенні, рамка) для картки з кольором; без кольору — нейтральні."""
    if not color:
        return CARD, CARD_HOVER, border_color(None, border)
    lv = _level(0)
    return tint(color, *lv[0]), tint(color, *lv[1]), border_color(color, border)


def preview(text: str, max_lines: int = 4, max_chars: int = 260) -> str:
    lines = text.strip().splitlines()
    shown = "\n".join(lines[:max_lines])
    cut = len(lines) > max_lines
    if len(shown) > max_chars:
        shown, cut = shown[:max_chars], True
    return shown + (" …" if cut else "")


def clip(text: str, n: int) -> str:
    return text if len(text) <= n else text[: n - 1] + "…"


def preset_stem(path: str) -> str:
    base = os.path.basename(path)
    return base[: -len(PRESET_SUFFIX)] if base.endswith(PRESET_SUFFIX) else os.path.splitext(base)[0]


def normalize_preset_path(path: str) -> str:
    """Гарантує розширення .preset.json (звичайне .json замінюється, без розширення — доповнюється)."""
    if path.endswith(PRESET_SUFFIX):
        return path
    if path.lower().endswith(".json"):
        path = path[:-5]
    return path + PRESET_SUFFIX


# --------------------------------------------------------------------------- #
#  Меню «⋯» / права кнопка / ⚙: модель (без віджетів) + власний popup у дизайні застосунку
# --------------------------------------------------------------------------- #

class MenuItem:
    __slots__ = ("kind", "label", "command", "sub", "var", "value", "danger", "dot", "icon", "checked")

    def __init__(self, kind: str, label: str = "", command=None, sub=None, var=None, value=None,
                 danger: bool = False, dot: str | None = None, icon: str = "", checked: bool = False):
        self.kind, self.label, self.command, self.sub = kind, label, command, sub
        self.var, self.value, self.danger, self.dot, self.icon, self.checked = var, value, danger, dot, icon, checked

    def is_checked(self) -> bool:
        if self.kind == "check" and self.var is not None:
            return bool(self.var.get())
        if self.kind == "radio" and self.var is not None:
            return self.var.get() == self.value
        return bool(self.checked)


class MenuModel:
    """Опис меню: пункти, підменю, позначки. Малює його PopupMenu; тести читають і запускають пункти напряму."""

    def __init__(self):
        self.items: list[MenuItem] = []

    def add_command(self, label, command=None, danger=False, dot=None, icon="", checked=False) -> "MenuModel":
        self.items.append(MenuItem("command", label, command, danger=danger, dot=dot, icon=icon, checked=checked))
        return self

    def add_cascade(self, label, menu: "MenuModel", icon="") -> "MenuModel":
        self.items.append(MenuItem("cascade", label, sub=menu, icon=icon))
        return self

    def add_check(self, label, variable, command=None) -> "MenuModel":
        self.items.append(MenuItem("check", label, command, var=variable))
        return self

    def add_radio(self, label, variable, value, command=None) -> "MenuModel":
        self.items.append(MenuItem("radio", label, command, var=variable, value=value))
        return self

    def add_separator(self) -> "MenuModel":
        self.items.append(MenuItem("sep"))
        return self

    def entries(self) -> list[MenuItem]:
        return [i for i in self.items if i.kind != "sep"]

    def labels(self) -> list[str]:
        return [i.label.strip() for i in self.entries()]

    def item(self, label: str) -> MenuItem:
        for i in self.entries():
            if i.label.strip() == label:
                return i
        raise KeyError(f"немає пункту {label!r} у {self.labels()}")

    def sub(self, label: str) -> "MenuModel":
        return self.item(label).sub

    def invoke(self, label: str) -> None:
        self.run(self.item(label))

    @staticmethod
    def run(item: MenuItem) -> None:
        if item.kind == "check" and item.var is not None:
            item.var.set(not item.var.get())
        elif item.kind == "radio" and item.var is not None:
            item.var.set(item.value)
        if item.command:
            item.command()


class PopupMenu:
    """Велике закруглене меню у стилі застосунку замість крихітного системного tk.Menu:
    рядки ≥ 40 px, шрифт 14, світла/темна тема, підменю збоку, клавіатура (↑ ↓ Enter → ← Esc),
    закриття при кліку поза ним. Позиціонується в межах екрана."""

    ROW_H = 42
    MIN_W = 260
    MAGIC = "#010203"           # на Windows цей колір вікна робиться прозорим — тоді кути справді закруглені

    def __init__(self, app: "App", model: MenuModel, parent: "PopupMenu | None" = None):
        self.app, self.model, self.parent = app, model, parent
        self.top: tk.Toplevel | None = None
        self.rows: list[tuple[MenuItem, tk.Frame, list]] = []      # (пункт, рядок, віджети рядка)
        self.sel = -1
        self.child: PopupMenu | None = None
        self.closed = False
        self._sub_job: str | None = None
        self._poll_row = -1

    # -- побудова й показ -------------------------------------------------------
    def show(self, x: int, y: int, side_left: int | None = None) -> None:
        app = self.app
        if self.parent is None:
            app.close_popups()
            app._popup_track_start()
        app._popups.append(self)
        s, col = app.scaling(), app.col
        nt = os.name == "nt"
        top = self.top = tk.Toplevel(app.root)
        top.withdraw()
        top.overrideredirect(True)
        try:
            top.attributes("-topmost", True)
            if nt:
                top.attributes("-transparentcolor", self.MAGIC)
        except tk.TclError:
            pass
        top.configure(bg=self.MAGIC if nt else col(MENU_BORDER))
        frame = ctk.CTkFrame(top, corner_radius=14, fg_color=MENU_BG, border_width=1, border_color=MENU_BORDER,
                             bg_color=self.MAGIC if nt else MENU_BORDER)
        frame.pack(fill="both", expand=True)
        inner = tk.Frame(frame, bg=col(MENU_BG))
        inner.pack(fill="both", expand=True, padx=8, pady=9)
        tk.Frame(inner, width=int(self.MIN_W * s), height=0, bg=col(MENU_BG)).pack()      # мінімальна ширина
        f = app.pf.menu
        ipad = max(2, int((self.ROW_H * s - f.metrics("linespace")) / 2))                 # висота рядка ≥ ROW_H
        for item in self.model.items:
            if item.kind == "sep":
                tk.Frame(inner, height=1, bg=col(MENU_SEP)).pack(fill="x", padx=10, pady=5)
                continue
            idx = len(self.rows)
            danger = item.danger
            row = tk.Frame(inner, bg=col(MENU_BG), cursor="hand2")
            row.pack(fill="x", pady=1)
            parts = [row]
            checked = item.is_checked()
            lead = tk.Label(row, text="✓" if checked else item.icon, font=f, width=2, anchor="center",
                            bg=col(MENU_BG), fg=col(ACCENT if checked else (DANGER if danger else MUTED)),
                            cursor="hand2")
            lead.pack(side="left", padx=(6, 2), ipady=ipad)
            parts.append(lead)
            if item.dot:
                dot = tk.Label(row, text="●", font=f, bg=col(MENU_BG), fg=item.dot, cursor="hand2")
                dot.pack(side="left", padx=(0, 6))
                parts.append(dot)
            lbl = tk.Label(row, text=item.label, font=f, anchor="w", bg=col(MENU_BG),
                           fg=col(DANGER if danger else TEXT), cursor="hand2")
            lbl.pack(side="left", fill="x", expand=True, padx=(2, 10), ipady=ipad)
            parts.append(lbl)
            if item.kind == "cascade":
                chev = tk.Label(row, text="›", font=app.pf.icon, bg=col(MENU_BG), fg=col(MUTED), cursor="hand2")
                chev.pack(side="right", padx=(0, 10))
                parts.append(chev)
            for w in parts:
                w.bind("<Enter>", lambda e, i=idx: self._hover(i))
            self.rows.append((item, row, parts))
        top.bind("<ButtonPress-1>", self._press)
        top.bind("<ButtonPress-3>", self._press)
        top.bind("<KeyPress>", lambda e: self._on_key(e.keysym))
        top.bind("<FocusOut>", lambda e: app.root.after(120, app._check_popup_focus))
        top.update_idletasks()
        w, h = top.winfo_reqwidth(), top.winfo_reqheight()
        area = work_area_at(x, y)               # монітор, на якому клікнули (а не завжди перший екран)
        if area:
            ax0, ay0, ax1, ay1 = area
            taskbar = 0
        else:
            ax0, ay0, ax1, ay1 = 0, 0, app.root.winfo_screenwidth(), app.root.winfo_screenheight()
            taskbar = int(48 * s)
        margin = int(8 * s)
        if side_left is not None and x + w > ax1 - margin:       # підменю не вміщається праворуч — відкриваємо ліворуч
            x = side_left - w + int(10 * s)
        x = max(ax0 + margin, min(x, ax1 - w - margin))
        y = max(ay0 + margin, min(y, ay1 - h - taskbar - margin))
        top.geometry(f"{w}x{h}+{x}+{y}")
        top.deiconify()
        top.lift()
        self._regrab()
        try:
            top.focus_force()
        except tk.TclError:
            pass

    def _regrab(self) -> None:
        try:
            self.top.grab_set()          # клік поза меню не «проходить» крізь нього, а закриває його
        except tk.TclError:
            pass

    # -- геометрія й виділення ------------------------------------------------------
    def contains(self, x: int, y: int) -> bool:
        t = self.top
        return bool(t) and t.winfo_rootx() <= x < t.winfo_rootx() + t.winfo_width() \
            and t.winfo_rooty() <= y < t.winfo_rooty() + t.winfo_height()

    def row_at(self, x: int, y: int) -> int:
        for i, (_, row, _) in enumerate(self.rows):
            if row.winfo_rootx() <= x < row.winfo_rootx() + row.winfo_width() \
                    and row.winfo_rooty() <= y < row.winfo_rooty() + row.winfo_height():
                return i
        return -1

    def _paint(self, i: int, on: bool) -> None:
        item, row, parts = self.rows[i]
        bg = self.app.col((DANGER_SOFT if item.danger else MENU_HOVER) if on else MENU_BG)
        for w in parts:
            w.configure(bg=bg)

    def _select(self, i: int) -> None:
        if i == self.sel:
            return
        if 0 <= self.sel < len(self.rows):
            self._paint(self.sel, False)
        self.sel = i
        if 0 <= i < len(self.rows):
            self._paint(i, True)

    def _hover(self, i: int) -> None:
        self._poll_row = i
        self._select(i)
        self._cancel_sub_job()
        item = self.rows[i][0]
        if item.kind == "cascade":
            self._sub_job = self.app.root.after(220, lambda: self._open_sub(i))
        elif self.child is not None:
            self._sub_job = self.app.root.after(220, self._close_child)

    def _cancel_sub_job(self) -> None:
        if self._sub_job is not None:
            try:
                self.app.root.after_cancel(self._sub_job)
            except tk.TclError:
                pass
            self._sub_job = None

    # -- підменю ----------------------------------------------------------------------
    def _open_sub(self, i: int, select_first: bool = False) -> None:
        self._cancel_sub_job()
        if self.closed or not (0 <= i < len(self.rows)):
            return
        item, row, _ = self.rows[i]
        if item.kind != "cascade" or item.sub is None:
            return
        if self.child is not None:
            if self.child.model is item.sub:
                return
            self._close_child()
        s = self.app.scaling()
        child = self.child = PopupMenu(self.app, item.sub, parent=self)
        child.show(self.top.winfo_rootx() + self.top.winfo_width() - int(12 * s), row.winfo_rooty() - int(10 * s),
                   side_left=self.top.winfo_rootx() + int(12 * s))
        if select_first and child.rows:
            child._select(0)

    def _close_child(self) -> None:
        self._sub_job = None
        if self.child is not None:
            self.child.close()

    # -- дії -------------------------------------------------------------------------------
    def _activate(self, i: int) -> None:
        if not (0 <= i < len(self.rows)):
            return
        item = self.rows[i][0]
        if item.kind == "cascade":
            self._open_sub(i, select_first=True)
            return
        app = self.app
        app.close_popups()
        app.root.after(1, lambda: MenuModel.run(item))     # спершу меню зникає, потім виконується команда

    def _press(self, e) -> str:
        app = self.app
        for p in reversed(app._popups):
            if p.contains(e.x_root, e.y_root):
                if getattr(e, "num", 1) == 1:
                    p._activate(p.row_at(e.x_root, e.y_root))
                return "break"
        app.close_popups()
        return "break"

    def _on_key(self, key: str) -> None:
        n = len(self.rows)
        if not n:
            return
        if key in ("Down", "Up"):
            step = 1 if key == "Down" else -1
            i = (self.sel + step) % n if self.sel >= 0 else (0 if step == 1 else n - 1)
            self._select(i)
        elif key == "Home":
            self._select(0)
        elif key == "End":
            self._select(n - 1)
        elif key in ("Return", "KP_Enter", "space"):
            self._activate(self.sel)
        elif key == "Right":
            if 0 <= self.sel < n and self.rows[self.sel][0].kind == "cascade":
                self._open_sub(self.sel, select_first=True)
        elif key == "Left":
            if self.parent is not None:
                self.close()
        elif key == "Escape":
            if self.parent is not None:
                self.close()
            else:
                self.app.close_popups()

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self._cancel_sub_job()
        if self.child is not None:
            self.child.close()
            self.child = None
        top, self.top = self.top, None
        if top is not None:
            try:
                top.grab_release()
            except tk.TclError:
                pass
            try:
                top.destroy()
            except tk.TclError:
                pass
        if self in self.app._popups:
            self.app._popups.remove(self)
        if self.parent is not None:
            self.parent.child = None
            if not self.parent.closed:
                self.parent._regrab()
                try:
                    self.parent.top.focus_force()
                except tk.TclError:
                    pass


# --------------------------------------------------------------------------- #
#  Діалоги
# --------------------------------------------------------------------------- #

class _Dialog(ctk.CTkToplevel):
    """Модальне вікно по центру батьківського."""

    def __init__(self, app: "App", title: str, width: int, height: int):
        super().__init__(app.root, fg_color=BG)
        self.app = app
        self.result = None
        self.title(title)
        self.resizable(False, False)
        self.transient(app.root)
        app.root.update_idletasks()
        s = app.scaling()
        x = app.root.winfo_rootx() + max(0, int((app.root.winfo_width() / s - width) / 2 * s))
        y = app.root.winfo_rooty() + max(0, int((app.root.winfo_height() / s - height) / 3 * s))
        self.geometry(f"{width}x{height}+{x}+{y}")
        self.bind("<Escape>", lambda e: self.cancel())
        self.protocol("WM_DELETE_WINDOW", self.cancel)
        self.after(300, self.app.apply_icon_to, self)   # CTk перезаписує іконку ~200 мс після створення

    def run(self):
        self.app._modal += 1
        prev = getattr(self.app, "_picker", None)
        if hasattr(self, "alt_space"):
            self.app._picker = self            # вікно вибору: йому Alt+Space (Windows — через LocalKeys)
        try:
            try:
                self.wait_visibility()
                self.grab_set()
            except tk.TclError:
                pass
            self.wait_window()
        finally:
            self.app._modal -= 1
            self.app._picker = prev
        return self.result

    def cancel(self) -> None:
        self.result = None
        self.destroy()

    def destroy(self) -> None:
        try:                  # фокус — назад головному вікну ДО знищення: Tk падав (segfault) на focus_force після
            f = self.focus_get()          # закриття діалогу, що тримав фокус (вікна вибору тепер беруть фокус для клавіш)
            if f is not None and str(f).startswith(str(self)):
                self.app.root.focus_set()
        except (tk.TclError, KeyError):
            pass
        try:                  # ctk тримає посилання на знищені вікна в ScalingTracker — інакше кожен діалог «тече»
            from customtkinter.windows.widgets.scaling import ScalingTracker
            ScalingTracker.window_dpi_scaling_dict.pop(self, None)
        except Exception:
            pass
        super().destroy()


class TextDialog(_Dialog):
    def __init__(self, app: "App", title: str, prompt: str, initial: str = ""):
        super().__init__(app, title, 460, 220)
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        ctk.CTkLabel(card, text=prompt, anchor="w", text_color=TEXT, font=app.f.dlg).pack(
            fill="x", padx=20, pady=(18, 8))
        self.var = tk.StringVar(value=initial)
        self.entry = ctk.CTkEntry(card, textvariable=self.var, height=44, corner_radius=12,
                                  fg_color=INPUT, border_color=PANEL_BORDER, font=app.f.dlg)
        self.entry.pack(fill="x", padx=20)
        self.entry.bind("<Return>", lambda e: self.ok())
        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=20, pady=18)
        ctk.CTkButton(row, text="Гаразд", width=112, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, command=self.ok, font=app.f.dlg_bold).pack(side="right")
        ctk.CTkButton(row, text="Скасувати", width=112, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, command=self.cancel,
                      font=app.f.dlg).pack(side="right", padx=10)
        self.after(120, self._focus)

    def _focus(self) -> None:
        try:
            self.entry.focus_set()
            self.entry.select_range(0, "end")
        except tk.TclError:
            pass

    def ok(self) -> None:
        self.result = self.var.get()
        self.destroy()


class SnippetDialog(_Dialog):
    def __init__(self, app: "App", title: str, text: str = "", category: str | None = None, v2: dict | None = None,
                 ctor: dict | None = None):
        super().__init__(app, title, 640, 610)
        self.v2 = copy.deepcopy(v2) if v2 else None
        self.ctor = copy.deepcopy(ctor) if ctor else None
        self.names = {c["name"]: c["id"] for c in app.preset.categories}
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        ctk.CTkLabel(card, text="Текст", anchor="w", text_color=MUTED, font=app.f.body).pack(
            fill="x", padx=20, pady=(16, 6))
        self.text = ctk.CTkTextbox(card, height=240, wrap="word", corner_radius=12, border_width=1,
                                   border_color=PANEL_BORDER, fg_color=INPUT, text_color=TEXT,
                                   font=app.f.dlg, undo=True)
        self.text.pack(fill="both", expand=True, padx=20)
        self.text.insert("1.0", text)
        v2row = ctk.CTkFrame(card, fg_color="transparent")
        v2row.pack(fill="x", padx=20, pady=(12, 0))
        self.v2_var = tk.BooleanVar(value=bool(self.v2))
        ctk.CTkCheckBox(v2row, text="Копіпаста з варіантами аппенду (v.2)", variable=self.v2_var, font=app.f.dlg,
                        text_color=TEXT, checkbox_width=24, checkbox_height=24, corner_radius=7, border_width=2,
                        fg_color=ACCENT, hover_color=ACCENT_HOVER, command=self._sync_v2).pack(side="left")
        self.v2_btn = ctk.CTkButton(v2row, text="Аппенди…", width=130, height=36, corner_radius=10, fg_color=BTN2,
                                    hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.edit_v2)
        self.v2_btn.pack(side="right")
        crow = ctk.CTkFrame(card, fg_color="transparent")
        crow.pack(fill="x", padx=20, pady=(10, 0))
        self.ctor_var = tk.BooleanVar(value=bool(self.ctor) and not self.v2)
        ctk.CTkCheckBox(crow, text="Конструктор (дерево продовжень)", variable=self.ctor_var, font=app.f.dlg,
                        text_color=TEXT, checkbox_width=24, checkbox_height=24, corner_radius=7, border_width=2,
                        fg_color=ACCENT, hover_color=ACCENT_HOVER, command=lambda: self._sync_v2("ctor")).pack(side="left")
        self.ctor_btn = ctk.CTkButton(crow, text="Конструкти…", width=130, height=36, corner_radius=10, fg_color=BTN2,
                                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.edit_ctor)
        self.ctor_btn.pack(side="right")
        self._sync_v2()
        self.text.bind("<Control-Return>", lambda e: (self.ok(), "break")[1])
        self.text.bind("<Control-a>", lambda e: (self.text.tag_add("sel", "1.0", "end-1c"), "break")[1])
        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=20, pady=18)
        ctk.CTkLabel(row, text="Категорія:", text_color=TEXT, font=app.f.dlg).pack(side="left")
        cat = app.preset.category(category)
        self.cat_var = tk.StringVar(value=cat["name"] if cat else (next(iter(self.names), "")))
        ctk.CTkOptionMenu(row, variable=self.cat_var, values=list(self.names) or [""], width=190, height=40,
                          corner_radius=12, fg_color=BTN2, button_color=BTN2_HOVER, button_hover_color=BTN2_HOVER,
                          text_color=TEXT, dropdown_font=app.f.dlg, font=app.f.dlg).pack(side="left", padx=12)
        ctk.CTkButton(row, text="Зберегти", width=112, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, command=self.ok, font=app.f.dlg_bold).pack(side="right")
        ctk.CTkButton(row, text="Скасувати", width=112, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, command=self.cancel,
                      font=app.f.dlg).pack(side="right", padx=10)
        self.after(120, self._focus)

    def _sync_v2(self, changed: str = "v2") -> None:
        """Аппенди v.2 і конструктор — взаємовиключні: увімкнення одного вимикає інше."""
        if changed == "v2" and self.v2_var.get():
            self.ctor_var.set(False)
        elif changed == "ctor" and self.ctor_var.get():
            self.v2_var.set(False)
        on = self.v2_var.get()
        n = len((self.v2 or {}).get("options", []))
        self.v2_btn.configure(state="normal" if on else "disabled",
                              text=f"Аппенди… ({n})" if on and n else "Аппенди…")
        on = self.ctor_var.get()
        n = ctor_count(self.ctor)
        self.ctor_btn.configure(state="normal" if on else "disabled",
                                text=f"Конструкти… ({n})" if on and n else "Конструкти…")

    def edit_ctor(self) -> None:
        res = CtorEditDialog(self.app, self.text.get("1.0", "end-1c"), self.ctor).run()
        try:
            self.grab_set()
        except tk.TclError:
            pass
        if res is not None:
            self.ctor = res or None
        self._sync_v2("none")

    def edit_v2(self) -> None:
        res = V2OptionsDialog(self.app, self.v2).run()
        try:
            self.grab_set()                         # після вкладеного діалогу повертаємо захоплення собі
        except tk.TclError:
            pass
        if res is not None:
            self.v2 = res or None
        self._sync_v2()

    def _focus(self) -> None:
        try:
            self.text.focus_set()
        except tk.TclError:
            pass

    def ok(self) -> None:
        text = self.text.get("1.0", "end-1c")
        cat_id = self.names.get(self.cat_var.get())
        if not text.strip() or not cat_id:
            return
        self.result = (text, cat_id, clean_v2(self.v2) if self.v2_var.get() else None,
                       clean_ctor(self.ctor) if self.ctor_var.get() else None)
        self.destroy()


V2_KIND_LABELS = {"end": "●  Кінцевий", "group": "▶  Підгрупа", "addon": "◆  Додатковий"}
V2_KIND_BY_LABEL = {v: k for k, v in V2_KIND_LABELS.items()}
V2_COLORS = {"end": "#22a559", "group": "#ff8a1f", "addon": "#e81123"}     # зелений · помаранчевий · червоний (як на малюнку)


class V2OptionsDialog(_Dialog):
    """Редактор аппендів копіпасти v.2: список варіантів одного рівня; «▶ Підгрупа» має власний вкладений список.
    Типи: ● кінцевий (клік додає текст і завершує вибір) · ▶ підгрупа (клік відкриває наступну групу; галочка
    «додавати текст» — чи додається текст самої підгрупи) · ◆ додатковий (у вікні вибору — галочка; «увімк.» — чи
    стоїть вона за замовчуванням). Результат: нормалізований {"options": [...]} (порожній {} — без аппендів) або None."""

    def __init__(self, app: "App", v2: dict | None):
        super().__init__(app, "Аппенди копіпасти (v.2)", 800, 640)
        self.root_opts: list[dict] = copy.deepcopy((v2 or {}).get("options", []))
        self.path: list[dict] = []                         # вузли-підгрупи, в які ми зайшли
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        top = ctk.CTkFrame(card, fg_color="transparent")
        top.pack(fill="x", padx=18, pady=(14, 4))
        self.back_btn = ctk.CTkButton(top, text="◀ Назад", width=96, height=34, corner_radius=10, fg_color=BTN2,
                                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.up)
        self.crumb = ctk.CTkLabel(top, text="", anchor="w", text_color=TEXT, font=app.f.dlg_bold)
        self.crumb.pack(side="left", fill="x", expand=True)
        self.list = ScrollFrame(card, fg_color="transparent", corner_radius=0,
                                           scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.list.pack(fill="both", expand=True, padx=10, pady=4)
        bottom = ctk.CTkFrame(card, fg_color="transparent")
        bottom.pack(fill="x", padx=18, pady=(6, 16))
        ctk.CTkButton(bottom, text="＋ Додати аппенд", width=170, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg_bold, command=self.add).pack(side="left")
        ctk.CTkButton(bottom, text="Готово", width=112, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, font=app.f.dlg_bold, command=self.accept).pack(side="right")
        ctk.CTkButton(bottom, text="Скасувати", width=112, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.cancel).pack(side="right", padx=10)
        self.rebuild()

    # -- поточний рівень ---------------------------------------------------------------
    def current(self) -> list[dict]:
        return self.path[-1].setdefault("children", []) if self.path else self.root_opts

    def add(self) -> None:
        self.current().append({"id": uuid.uuid4().hex, "text": "", "kind": "end"})
        self.rebuild(focus_last=True)

    def up(self) -> None:
        if self.path:
            self.path.pop()
            self.rebuild()

    def open_group(self, node: dict) -> None:
        node.setdefault("children", [])
        self.path.append(node)
        self.rebuild()

    def rebuild(self, focus_last: bool = False) -> None:
        for w in self.list.winfo_children():
            w.destroy()
        if self.path:
            self.back_btn.pack(side="left", padx=(0, 10), before=self.crumb)
        else:
            self.back_btn.pack_forget()
        names = ["Основний текст"] + [clip(n.get("text") or "…", 24) for n in self.path]
        self.crumb.configure(text="  ›  ".join(names) + ("   — вкладена група" if self.path else "   — перший рівень"))
        items = self.current()
        last = None
        for i, node in enumerate(items):
            last = self._row(items, i, node)
        if not items:
            ctk.CTkLabel(self.list, text="Поки порожньо. Натисніть «＋ Додати аппенд».", text_color=MUTED,
                         font=self.app.f.body).pack(pady=40)
        if focus_last and last is not None:
            self.after(60, last.focus_set)

    def _row(self, items: list[dict], i: int, node: dict):
        app = self.app
        kind = node.get("kind", "end")
        color = V2_COLORS[kind]
        row = ctk.CTkFrame(self.list, corner_radius=12, fg_color=tint(color, 0.16, 0.26), border_width=1,
                           border_color=(blend(color, CARD_BORDER[0], 0.5), blend(color, CARD_BORDER[1], 0.55)))
        row.pack(fill="x", padx=4, pady=4)
        menu = ctk.CTkOptionMenu(row, values=list(V2_KIND_BY_LABEL), width=150, height=36, corner_radius=10,
                                 fg_color=BTN2, button_color=BTN2_HOVER, button_hover_color=BTN2_HOVER,
                                 text_color=TEXT, font=app.f.dlg, dropdown_font=app.f.dlg,
                                 command=lambda label, n=node: self._set_kind(n, V2_KIND_BY_LABEL[label]))
        menu.set(V2_KIND_LABELS[kind])
        menu.grid(row=0, column=0, padx=(10, 8), pady=10)
        var = tk.StringVar(value=node.get("text", ""))
        var.trace_add("write", lambda *a, n=node, v=var: n.__setitem__("text", v.get()))
        entry = ctk.CTkEntry(row, textvariable=var, height=36, corner_radius=10, fg_color=INPUT,
                             border_color=PANEL_BORDER, text_color=TEXT, font=app.f.dlg, placeholder_text="Текст аппенду")
        entry.grid(row=0, column=1, sticky="ew", padx=4)
        row.grid_columnconfigure(1, weight=1)
        col = 2
        if kind in ("group", "addon"):
            key, label = ("join", "додавати текст") if kind == "group" else ("on", "увімк.")
            flag = tk.BooleanVar(value=bool(node.get(key, kind == "group")))
            ctk.CTkCheckBox(row, text=label, variable=flag, font=app.f.body, text_color=TEXT, checkbox_width=22,
                            checkbox_height=22, corner_radius=6, border_width=2, fg_color=ACCENT, hover_color=ACCENT_HOVER,
                            width=110, command=lambda n=node, k=key, f=flag: n.__setitem__(k, f.get())
                            ).grid(row=0, column=col, padx=6)
            node[key] = flag.get()
            col += 1
        if kind == "group":
            n_ch = len(node.get("children", []))
            ctk.CTkButton(row, text=f"Підгрупа ▸ ({n_ch})", width=130, height=36, corner_radius=10, fg_color=ACCENT,
                          hover_color=ACCENT_HOVER, font=app.f.dlg, command=lambda n=node: self.open_group(n)
                          ).grid(row=0, column=col, padx=6)
            col += 1
        for text, delta in (("▲", -1), ("▼", 1)):
            ctk.CTkButton(row, text=text, width=34, height=34, corner_radius=9, fg_color=BTN2, hover_color=BTN2_HOVER,
                          text_color=TEXT, font=app.f.body, command=lambda d=delta, n=node: self._move(n, d)
                          ).grid(row=0, column=col, padx=2)
            col += 1
        ctk.CTkButton(row, text="✕", width=34, height=34, corner_radius=9, fg_color="transparent", hover_color=DANGER_SOFT,
                      text_color=DANGER, font=app.f.body, command=lambda n=node: self._delete(n)
                      ).grid(row=0, column=col, padx=(2, 10))
        return entry

    def _set_kind(self, node: dict, kind: str) -> None:
        node["kind"] = kind
        if kind == "group":
            node.setdefault("join", True)
            node.setdefault("children", [])
        self.rebuild()

    def _move(self, node: dict, delta: int) -> None:
        items = self.current()
        i = items.index(node)
        j = i + delta
        if 0 <= j < len(items):
            items[i], items[j] = items[j], items[i]
            self.rebuild()

    def _delete(self, node: dict) -> None:
        self.current().remove(node)
        self.rebuild()

    def accept(self) -> None:
        self.result = clean_v2({"options": self.root_opts}) or {}
        self.destroy()


class V2Dialog(_Dialog):
    """Вікно вибору аппендів копіпасти v.2. Зверху — живий перегляд результату, нижче — аппенди поточної групи.
    ▶ підгрупа: клік додає її текст (якщо ввімкнено) і відкриває наступну групу; ● кінцевий: додає текст і копіює;
    ◆ додатковий — галочка (додається в кінець). «Копіювати зараз» копіює поточний результат без подальшого вибору,
    «Назад» повертає на рівень вище. Alt + клік по кінцевому / «Копіювати зараз» — ще й ховає вікно програми.
    Результат: {"text": ..., "hide": bool} або None."""

    def __init__(self, app: "App", main: str, v2: dict, uid: str | None = None, link_on: bool = False,
                 on_edit=None, filler=None):
        super().__init__(app, "Копіпаста з варіантами", 640, 700)
        self.main = main
        self.uid = uid
        self.on_edit = on_edit
        self.filler = filler                   # заповнення заглушок з історії (email, користувачі по черзі)
        self.stack: list[tuple[list[dict], bool]] = [(v2["options"], False)]   # (аппенди рівня, чи додано крок при вході)
        self.steps: list[str] = []
        self.ticked: dict[str, bool] = {}                                    # id додаткового → стан галочки
        self.addons: list[dict] = []                                         # додаткові з усіх відвіданих рівнів
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        ctk.CTkLabel(card, text="РЕЗУЛЬТАТ", anchor="w", text_color=MUTED, font=app.f.caps).pack(
            fill="x", padx=20, pady=(14, 2))
        self.preview = ctk.CTkTextbox(card, height=110, wrap="word", corner_radius=12, border_width=1,
                                      border_color=PANEL_BORDER, fg_color=INPUT, text_color=TEXT, font=app.f.dlg_bold)
        self.preview.pack(fill="x", padx=18)
        self.level = ctk.CTkLabel(card, text="", anchor="w", text_color=MUTED, font=app.f.body)
        self.level.pack(fill="x", padx=20, pady=(10, 2))
        self.list = ScrollFrame(card, fg_color="transparent", corner_radius=0,
                                           scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.list.pack(fill="both", expand=True, padx=10, pady=2)
        # нижче — галочка «in {LINK:USER:…:E}» (останній користувач з історії буфера) і редагування пунктів
        extra = ctk.CTkFrame(card, fg_color="transparent")
        extra.pack(fill="x", padx=18, pady=(6, 0))
        self.link_var = tk.BooleanVar(value=bool(link_on and uid))
        self.link_cb = ctk.CTkCheckBox(
            extra, text=f"Append  in {clip(user_links(uid) if isinstance(uid, list) else user_link(uid), 70)}" if uid else "Append  in {LINK:USER:…:E} — у історії немає користувача",
            variable=self.link_var, font=app.f.dlg, text_color=TEXT, checkbox_width=24, checkbox_height=24,
            corner_radius=7, border_width=2, fg_color=ACCENT, hover_color=ACCENT_HOVER,
            state="normal" if uid else "disabled", command=self.refresh_preview)
        self.link_cb.pack(side="left")
        if on_edit is not None:
            ctk.CTkButton(extra, text="✎ Пункти…", width=120, height=36, corner_radius=10, fg_color=BTN2,
                          hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.edit_options
                          ).pack(side="right")
        bottom = ctk.CTkFrame(card, fg_color="transparent")
        bottom.pack(fill="x", padx=18, pady=(10, 16))
        self.back_btn = ctk.CTkButton(bottom, text="◀ Назад", width=104, height=42, corner_radius=12, fg_color=BTN2,
                                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.back)
        self.back_btn.pack(side="left")
        self.now_btn = ctk.CTkButton(bottom, text="Копіювати зараз", width=170, height=42, corner_radius=12,
                                     fg_color=ACCENT, hover_color=ACCENT_HOVER, font=app.f.dlg_bold)
        self.now_btn.pack(side="left", padx=10)
        for w in (self.now_btn._canvas, getattr(self.now_btn, "_text_label", None)):   # Alt+клік → ще й сховати вікно
            if w is not None:
                w.bind("<ButtonPress-1>", lambda e: setattr(self, "_ctrl", bool(e.state & ALT_MASK)), add="+")
        self.now_btn.configure(command=lambda: self.finish(self.compose(), getattr(self, "_ctrl", False)))
        ctk.CTkButton(bottom, text="Скасувати", width=104, height=42, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.cancel).pack(side="right")
        self._ctrl = False
        self.bind("<Escape>", lambda e: self.step_back())
        self.bind("<Alt-KeyPress>", self._alt_key)
        self.render_level()
        self.after(120, self._focus_self)

    def _focus_self(self) -> None:
        try:
            if self.winfo_exists():
                self.focus_set()
        except tk.TclError:
            pass

    def _alt_key(self, e):
        k = self.app._nav_key(e)
        if k == "a":
            self.step_back()
        elif k == "space":
            self.alt_space()
        else:
            return None
        return "break"

    def alt_space(self) -> None:
        """Alt+Space — «Копіювати зараз» і сховати програму."""
        self.finish(self.compose(), True)

    def step_back(self) -> None:
        if len(self.stack) > 1:
            self.back()
        else:
            self.cancel()

    def compose(self) -> str:
        extras = [a["text"] for a in self.addons if self.ticked.get(a["id"])]
        out = v2_compose(self.main, self.steps, extras)
        if self.filler is not None:
            return self.filler(out, self.link_var.get())
        return apply_user_link(out, self.uid) if self.link_var.get() else out

    def edit_options(self) -> None:
        """«✎ Пункти…»: додати / прибрати / змінити пункти просто з вікна вибору (зберігаються в записі)."""
        new = self.on_edit()
        try:
            self.grab_set()
        except tk.TclError:
            pass
        if not new or not new.get("options"):
            if new is not None:                       # усі пункти прибрано — вибору більше немає
                self.cancel()
            return
        self.stack = [(new["options"], False)]
        self.steps, self.ticked, self.addons = [], {}, []
        self.render_level()

    def refresh_preview(self) -> None:
        self.preview.configure(state="normal")
        self.preview.delete("1.0", "end")
        self.preview.insert("1.0", self.compose())
        self.preview.configure(state="disabled")

    def render_level(self) -> None:
        for w in self.list.winfo_children():
            w.destroy()
        opts = self.stack[-1][0]
        depth = len(self.stack) - 1
        self.level.configure(text="Оберіть аппенд:" if not depth else f"Група {depth + 1} — оберіть аппенд:")
        if depth:
            self.back_btn.configure(state="normal")
        else:
            self.back_btn.configure(state="disabled")
        for node in opts:
            if node["kind"] == "addon":
                if node["id"] not in self.ticked:
                    self.ticked[node["id"]] = bool(node.get("on"))
                    self.addons.append(node)
            self._option(node)
        self.refresh_preview()

    def _option(self, node: dict) -> None:
        kind = node["kind"]
        color = V2_COLORS[kind]
        base, hover = tint(color, 0.22, 0.34), tint(color, 0.38, 0.5)
        fr = tk.Frame(self.list, bg=self.app.col(base), cursor="hand2")
        fr.pack(fill="x", padx=6, pady=5)
        if kind == "addon":
            var = tk.BooleanVar(value=self.ticked.get(node["id"], False))
            cb = ctk.CTkCheckBox(fr, text="", variable=var, width=30, checkbox_width=28, checkbox_height=28,
                                 corner_radius=8, border_width=2, fg_color=ACCENT, hover_color=ACCENT_HOVER, bg_color=base,
                                 command=lambda n=node, v=var: self._tick(n, v))
            cb.pack(side="left", padx=(12, 4), pady=12)
            lbl = tk.Label(fr, text=f"◆  {node['text']}", font=self.app.pf.phrase, anchor="w", justify="left",
                           bg=self.app.col(base), fg=self.app.col(TEXT), wraplength=int(480 * self.app.scaling()), pady=12)
            lbl.pack(side="left", fill="x", expand=True, padx=(4, 12))
            lbl.bind("<Button-1>", lambda e, c=cb: c.toggle())
        else:
            mark = "▶" if kind == "group" else "●"
            lbl = tk.Label(fr, text=f"{mark}  {node['text']}", font=self.app.pf.phrase, anchor="w", justify="left",
                           bg=self.app.col(base), fg=self.app.col(TEXT), wraplength=int(540 * self.app.scaling()),
                           padx=14, pady=14, cursor="hand2")
            lbl.pack(fill="x")
            lbl.bind("<Button-1>", lambda e, n=node: self.pick(n, bool(e.state & ALT_MASK)))
        for w in (fr, lbl):
            w.bind("<Enter>", lambda e, f=fr, l=lbl, h=hover: (f.configure(bg=self.app.col(h)), l.configure(bg=self.app.col(h))))
            w.bind("<Leave>", lambda e, f=fr, l=lbl, b=base: (f.configure(bg=self.app.col(b)), l.configure(bg=self.app.col(b))))

    def _tick(self, node: dict, var: tk.BooleanVar) -> None:
        self.ticked[node["id"]] = var.get()
        self.refresh_preview()

    def pick(self, node: dict, ctrl: bool) -> None:
        if node["kind"] == "group" and node.get("children"):
            joined = bool(node.get("join", True))
            if joined:
                self.steps.append(node["text"])
            self.stack.append((node["children"], joined))
            self.render_level()
            return
        self.steps.append(node["text"])          # кінцевий (або підгрупа без вкладених): додає текст і копіює
        self.finish(self.compose(), ctrl)

    def back(self) -> None:
        if len(self.stack) > 1:
            _opts, joined = self.stack.pop()
            if joined and self.steps:
                self.steps.pop()
            self.render_level()

    def finish(self, text: str, hide: bool) -> None:
        self.result = {"text": text, "hide": bool(hide)}
        self.destroy()


def _tag_menu(dlg, app: "App", insert, on_new) -> tk.Menu:
    """Меню вставки тегу: {{user}} (користувачі з буфера), власні теги пресета, «Новий тег…»."""
    m = tk.Menu(dlg, tearoff=0, font=app.f.dlg)

    def counts(name: str, default: int) -> tk.Menu:
        """Підменю: скільки номерів підтягувати саме тут ({{назва:N}}); «як у тезі» — {{назва}}."""
        sub = tk.Menu(m, tearoff=0, font=app.f.dlg)
        sub.add_command(label=("Як у тезі (" + (str(default) if default else "усі") + ")") if name != USER_TAG
                        else "Усі з останніх записів", command=lambda: insert(tag_ref(name)))
        for n in (1, 2, 3, 4, 5, 6, 8, 10):
            sub.add_command(label=f"{n}   →  {tag_ref(name, n)}", command=lambda n=n: insert(tag_ref(name, n)))
        return sub
    m.add_cascade(label=f"{tag_ref(USER_TAG)}   — користувачі з буфера ({{LINK:USER:…:E}}, …)",
                  menu=counts(USER_TAG, 0))
    for t in app.preset.tags:
        tpl = infer_tag(t["ex_in"], t["ex_out"])
        m.add_cascade(label=f"{tag_ref(t['name'])}   — напр. {clip(render_tag(tpl, ['111', '222']), 40)}",
                      menu=counts(t["name"], t.get("count", 0)))
    m.add_separator()
    m.add_command(label="＋ Новий тег…", command=on_new)
    return m


class TagDialog(_Dialog):
    """Власний тег {{назва}}: приклад входу (номери з буфера) і приклад виходу. З прикладу виводиться шаблон:
    номери у виході замінюються на номери з буфера, решта тексту лишається. Результат: збережений тег або None."""

    def __init__(self, app: "App", tag: dict | None = None):
        super().__init__(app, "Тег" if tag else "Новий тег", 620, 580)
        self.tag = tag
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        self.fields = {}
        for key, label, val, ph in (
                ("name", "Назва тегу (у тексті буде {{назва}})", (tag or {}).get("name", ""), "card"),
                ("ex_in", "Приклад входу — як номери лежать у буфері", (tag or {}).get("ex_in", ""), "1234"),
                ("ex_out", "Приклад виходу — що з них має вийти", (tag or {}).get("ex_out", ""), "{LINK:CARD:1234:E}")):
            ctk.CTkLabel(card, text=label, anchor="w", text_color=MUTED, font=app.f.body).pack(
                fill="x", padx=20, pady=(14, 4))
            e = ctk.CTkEntry(card, height=38, corner_radius=10, fg_color=INPUT, border_color=PANEL_BORDER,
                             text_color=TEXT, font=app.f.dlg, placeholder_text=ph)
            e.pack(fill="x", padx=20)
            if val:
                e.insert(0, val)
            e.bind("<KeyRelease>", lambda ev: self.refresh(), add="+")
            self.fields[key] = e
        crow = ctk.CTkFrame(card, fg_color="transparent")
        crow.pack(fill="x", padx=20, pady=(14, 0))
        ctk.CTkLabel(crow, text="Скільки номерів брати з буфера:", text_color=MUTED, font=app.f.body).pack(side="left")
        self.count_values = ["Усі з останніх записів"] + [str(n) for n in (1, 2, 3, 4, 5, 6, 8, 10)]
        cur = (tag or {}).get("count", 0)
        self.count_var = tk.StringVar(value=str(cur) if str(cur) in self.count_values else self.count_values[0])
        ctk.CTkOptionMenu(crow, variable=self.count_var, values=self.count_values, width=210, height=34,
                          corner_radius=10, fg_color=BTN2, button_color=BTN2_HOVER, button_hover_color=BTN2_HOVER,
                          text_color=TEXT, dropdown_font=app.f.dlg, font=app.f.dlg,
                          command=lambda v: self.refresh()).pack(side="left", padx=10)
        self.preview = ctk.CTkLabel(card, text="", anchor="w", justify="left", text_color=TEXT, font=app.f.dlg,
                                    wraplength=540)
        self.preview.pack(fill="x", padx=20, pady=(14, 0))
        self.err = ctk.CTkLabel(card, text="", anchor="w", text_color=DANGER, font=app.f.body)
        self.err.pack(fill="x", padx=20, pady=(4, 0))
        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=20, pady=16, side="bottom")
        ctk.CTkButton(row, text="Зберегти", width=112, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, command=self.ok, font=app.f.dlg_bold).pack(side="right")
        ctk.CTkButton(row, text="Скасувати", width=112, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, command=self.cancel, font=app.f.dlg).pack(side="right", padx=10)
        if tag:
            ctk.CTkButton(row, text="Видалити тег", width=130, height=40, corner_radius=12, fg_color="transparent",
                          hover_color=DANGER_SOFT, text_color=DANGER, command=self.delete, font=app.f.dlg).pack(side="left")
        self.bind("<Return>", lambda e: self.ok())
        self.refresh()
        self.after(120, lambda: self.fields["name"].focus_set())

    def values(self) -> tuple[str, str, str]:
        return tuple(self.fields[k].get() for k in ("name", "ex_in", "ex_out"))

    def count(self) -> int:
        return clean_count(self.count_var.get()) if self.count_var.get().isdigit() else 0

    def refresh(self) -> None:
        name, ex_in, ex_out = self.values()
        tpl = infer_tag(ex_in, ex_out)
        if tpl:
            nums = take(["111", "222", "333"], self.count())
            self.preview.configure(text=f"Номери в буфері «111, 222, 333» → {render_tag(tpl, nums)}\n"
                                        f"Номер «111» → {render_tag(tpl, ['111'])}")
        else:
            self.preview.configure(text="Перегляд з'явиться, коли номери з входу знайдуться у виході.")
        self.err.configure(text="")

    def ok(self) -> None:
        name, ex_in, ex_out = self.values()
        problem = self.app.preset.tag_problem(name, ex_in, ex_out, (self.tag or {}).get("id"))
        if problem:
            self.err.configure(text=problem)
            return
        self.result = self.app.preset.save_tag(name, ex_in, ex_out, (self.tag or {}).get("id"), self.count())
        self.destroy()

    def delete(self) -> None:
        self.app.preset.remove_tag(self.tag["id"])
        self.result = {"deleted": True}
        self.destroy()


class CtorEditDialog(_Dialog):
    """Редактор конструктора: дерево продовжень. Кожен конструкт — ПОВНИЙ текст (новий одразу містить текст батька),
    у вікні вибору показується лише нова частина. «Продовження ▸» — конструкти наступного кроку для цього конструкту.
    «{ } Тег» вставляє тег ({{user}} — користувачі з буфера, або власний). Результат: {"options": [...]} ({} — без
    конструкторів) або None (скасовано)."""

    def __init__(self, app: "App", root_text: str, ctor: dict | None):
        super().__init__(app, "Конструктор копіпасти", 1040, 760)
        self.root_text = (root_text or "").strip()
        self.root_opts: list[dict] = copy.deepcopy((ctor or {}).get("options", []))
        self.path: list[dict] = []
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        top = ctk.CTkFrame(card, fg_color="transparent")
        top.pack(fill="x", padx=18, pady=(14, 2))
        self.back_btn = ctk.CTkButton(top, text="◀ Назад", width=96, height=34, corner_radius=10, fg_color=BTN2,
                                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.up)
        self.crumb = ctk.CTkLabel(top, text="", anchor="w", text_color=TEXT, font=app.f.dlg_bold)
        self.crumb.pack(side="left", fill="x", expand=True)
        self.parent_lbl = ctk.CTkLabel(card, text="", anchor="w", justify="left", text_color=MUTED, font=app.f.body,
                                       wraplength=960)
        self.parent_lbl.pack(fill="x", padx=20, pady=(2, 4))
        self.list = ScrollFrame(card, fg_color="transparent", corner_radius=0,
                                           scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.list.pack(fill="both", expand=True, padx=10, pady=4)
        bottom = ctk.CTkFrame(card, fg_color="transparent")
        bottom.pack(fill="x", padx=18, pady=(6, 16))
        ctk.CTkButton(bottom, text="＋ Додати конструкт", width=190, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg_bold, command=self.add).pack(side="left")
        ctk.CTkButton(bottom, text="Теги…", width=96, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.manage_tags
                      ).pack(side="left", padx=10)
        ctk.CTkButton(bottom, text="Готово", width=112, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, font=app.f.dlg_bold, command=self.accept).pack(side="right")
        ctk.CTkButton(bottom, text="Скасувати", width=112, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.cancel).pack(side="right", padx=10)
        self.rebuild()

    def parent_text(self) -> str:
        return (self.path[-1]["text"] if self.path else self.root_text).strip()

    def current(self) -> list[dict]:
        return self.path[-1].setdefault("children", []) if self.path else self.root_opts

    def add(self) -> None:
        base = self.parent_text()
        self.current().append({"id": uuid.uuid4().hex, "text": base + " " if base else ""})
        self.rebuild(focus_last=True)

    def up(self) -> None:
        if self.path:
            self.path.pop()
            self.rebuild()

    def open_node(self, node: dict) -> None:
        if not node.get("text", "").strip():
            return
        self.path.append(node)
        self.rebuild()

    def _regrab(self) -> None:
        try:
            self.grab_set()
        except tk.TclError:
            pass

    def new_tag(self, insert=None) -> None:
        tag = TagDialog(self.app, None).run()
        self._regrab()
        if tag and insert is not None and tag.get("name"):
            insert(tag_ref(tag["name"]))

    def manage_tags(self) -> None:
        m = tk.Menu(self, tearoff=0, font=self.app.f.dlg)
        for t in self.app.preset.tags:
            m.add_command(label=f"✎  {tag_ref(t['name'])}", command=lambda t=t: (TagDialog(self.app, t).run(), self._regrab()))
        if self.app.preset.tags:
            m.add_separator()
        m.add_command(label="＋ Новий тег…", command=self.new_tag)
        m.tk_popup(self.winfo_pointerx(), self.winfo_pointery())

    def rebuild(self, focus_last: bool = False) -> None:
        for w in self.list.winfo_children():
            w.destroy()
        if self.path:
            self.back_btn.pack(side="left", padx=(0, 10), before=self.crumb)
        else:
            self.back_btn.pack_forget()
        parents = [self.root_text] + [n["text"] for n in self.path]
        names = ["Стовбур"] + [clip(ctor_label(parents[i], n["text"]), 22) for i, n in enumerate(self.path)]
        self.crumb.configure(text="  ›  ".join(names) + (f"   — крок {len(self.path) + 1}"))
        base = self.parent_text()
        self.parent_lbl.configure(text=("Попередній текст: «" + clip(base, 300) + "»\n" if base else "") +
                                  "Кожен конструкт пишіть ПОВНІСТЮ (новий уже починається з попереднього тексту); "
                                  "у виборі буде видно лише нову частину. «None» додається автоматично.")
        items = self.current()
        last = None
        for c in range(self.COLS):
            self.list.grid_columnconfigure(c, weight=1, uniform="tile")
        for i, node in enumerate(items):
            last = self._row(items, node, base, i)
        if not items:
            ctk.CTkLabel(self.list, text="Поки порожньо. Натисніть «＋ Додати конструкт».", text_color=MUTED,
                         font=self.app.f.body).grid(row=0, column=0, columnspan=self.COLS, pady=40)
        if focus_last and last is not None:
            self.after(60, lambda: (last.focus_set(), last.mark_set("insert", "end-1c")))

    COLS = 3              # конструкти — квадратні плитки (як копіпасти), по 3 в ряд
    TILE = 310

    def _row(self, items: list[dict], node: dict, base: str, index: int = 0):
        app = self.app
        own = node.get("color")
        fill, _hover, border = card_colors(own or CTOR_DEFAULT)
        row = ctk.CTkFrame(self.list, corner_radius=14, fg_color=fill, border_width=border_width(bool(own)),
                           border_color=border, width=self.TILE, height=self.TILE)
        muted = ink(fill, "muted")
        row.grid(row=index // self.COLS, column=index % self.COLS, padx=6, pady=6, sticky="nsew")
        row.grid_propagate(False)
        row.grid_rowconfigure(0, weight=1)
        for c in range(4):
            row.grid_columnconfigure(c, weight=1)
        box = ctk.CTkTextbox(row, wrap="word", corner_radius=10, border_width=1, border_color=PANEL_BORDER,
                             fg_color=INPUT, text_color=TEXT, font=app.f.dlg, undo=True)
        box.grid(row=0, column=0, columnspan=4, sticky="nsew", padx=10, pady=(10, 4))
        box.insert("1.0", node.get("text", ""))
        hint = ctk.CTkLabel(row, text="", anchor="w", justify="left", text_color=muted, font=app.f.body,
                            wraplength=self.TILE - 30, height=40)
        hint.grid(row=1, column=0, columnspan=4, sticky="ew", padx=12, pady=(0, 4))

        def sync(_e=None, n=node, b=box, h=hint):
            n["text"] = b.get("1.0", "end-1c")
            t = n["text"].strip()
            if not t:
                h.configure(text="Порожній конструкт не збережеться", text_color=muted)
            elif base and not t.casefold().startswith(base.casefold()):
                h.configure(text="⚠ Не починається з попереднього тексту — у виборі буде видно весь текст",
                            text_color=DANGER)
            else:
                h.configure(text="У виборі: «" + clip(ctor_label(base, t), 90) + "»", text_color=muted)
        box.bind("<KeyRelease>", sync, add="+")
        box.sync_node = sync                      # для тестів / вставки тегів
        for ev in ("<<Paste>>", "<<Cut>>", "<<Undo>>", "<<Redo>>"):
            box.bind(ev, lambda e, f=sync: self.after(20, f), add="+")
        sync()

        def insert(ref, b=box, f=sync):
            b.insert("insert", ref)
            f()
            b.focus_set()
        n_ch = len(node.get("children", []))
        sh = shape_for_color(own) if own else "●"
        ctk.CTkButton(row, text=sh, width=40, height=34, corner_radius=9, text_color="#ffffff" if own else TEXT,
                      fg_color=own or BTN2, hover_color=blend(own, "#000000", 0.2) if own else BTN2_HOVER,
                      font=app.f.icon, command=lambda n=node: self.pick_color(n)
                      ).grid(row=2, column=0, sticky="w", padx=(10, 4), pady=(0, 6))
        ctk.CTkButton(row, text=f"Продовження ▸ ({n_ch})", height=34, corner_radius=9, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, font=app.f.body, command=lambda n=node: self.open_node(n)
                      ).grid(row=2, column=1, columnspan=3, sticky="ew", padx=(0, 10), pady=(0, 6))
        tag_btn = ctk.CTkButton(row, text="{ } Тег", width=80, height=34, corner_radius=9, fg_color=BTN2,
                                hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.body)
        tag_btn.configure(command=lambda i=insert, w=tag_btn: _tag_menu(self, app, i, lambda: self.new_tag(i)).tk_popup(
            w.winfo_rootx(), w.winfo_rooty() + w.winfo_height()))
        tag_btn.grid(row=3, column=0, sticky="w", padx=(10, 2), pady=(0, 10))
        for col, (text, delta) in enumerate((("◀", -1), ("▶", 1)), start=1):     # порядок плиток: лівіше / правіше
            ctk.CTkButton(row, text=text, width=34, height=34, corner_radius=9, fg_color=BTN2, hover_color=BTN2_HOVER,
                          text_color=TEXT, font=app.f.body, command=lambda d=delta, n=node: self._move(n, d)
                          ).grid(row=3, column=col, padx=2, pady=(0, 10))
        ctk.CTkButton(row, text="✕", width=34, height=34, corner_radius=9, fg_color="transparent", hover_color=DANGER_SOFT,
                      text_color=DANGER, font=app.f.body, command=lambda n=node: self._delete(n)
                      ).grid(row=3, column=3, sticky="e", padx=(2, 10), pady=(0, 10))
        return box

    def _move(self, node: dict, delta: int) -> None:
        items = self.current()
        i = items.index(node)
        j = i + delta
        if 0 <= j < len(items):
            items[i], items[j] = items[j], items[i]
            self.rebuild()

    def pick_color(self, node: dict) -> None:
        """Колір конструкту (кнопка з фігурою в плитці): від кольору залежить і фігура."""
        res = ColorDialog(self.app, "Колір конструкту", node.get("color"), allow_reset=True,
                          reset_label="Без кольору").run()
        self._regrab()
        if not res:
            return
        if res[0] == "set":
            node["color"] = res[1]
        else:
            node.pop("color", None)
        self.rebuild()

    def _delete(self, node: dict) -> None:
        self.current().remove(node)
        self.rebuild()

    def accept(self) -> None:
        self.result = clean_ctor({"options": self.root_opts}) or {}
        self.destroy()


class CtorDialog(_Dialog):
    """Вибір конструкта: зверху — уже побудований текст, нижче — продовження поточного кроку (лише нова частина)
    і завжди останнім «None» — скопіювати побудоване й сховати програму. Конструкт без продовжень одразу копіюється;
    з продовженнями — відкриває наступний крок. Продовження — квадратні плитки свого кольору (з фігурою кольору).
    Клавіші: стрілки або Alt+W/S/D — по плитках, Enter / Space — обрати, Alt+Space / Alt+Enter — обрати й сховати,
    цифри 1–9, 0 — None, Alt+A / Backspace / Esc — крок назад (з першого кроку — закрити).
    Результат: {"text": готовий текст} або None."""

    def __init__(self, app: "App", root_text: str, ctor: dict, finalize, on_edit=None):
        super().__init__(app, "Конструктор", 800, 760)
        self.finalize = finalize               # текст → (готовий текст з тегами/користувачами, попередження або "")
        self.on_edit = on_edit
        self.root_text = root_text
        self.stack: list[tuple[str, list[dict]]] = [(root_text, ctor["options"])]
        self.hl = 0
        self.rows: list[tuple[tk.Frame, tk.Label, tuple, tuple]] = []
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        ctk.CTkLabel(card, text="ПОБУДОВАНО", anchor="w", text_color=MUTED, font=app.f.caps).pack(
            fill="x", padx=20, pady=(14, 2))
        self.preview = ctk.CTkTextbox(card, height=120, wrap="word", corner_radius=12, border_width=1,
                                      border_color=PANEL_BORDER, fg_color=INPUT, text_color=TEXT, font=app.f.dlg_bold)
        self.preview.pack(fill="x", padx=18)
        self.warn = ctk.CTkLabel(card, text="", anchor="w", text_color=DANGER, font=app.f.body)
        self.warn.pack(fill="x", padx=20)
        self.level = ctk.CTkLabel(card, text="", anchor="w", text_color=MUTED, font=app.f.body)
        self.level.pack(fill="x", padx=20, pady=(4, 2))
        self.list = ScrollFrame(card, fg_color="transparent", corner_radius=0,
                                           scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.list.pack(fill="both", expand=True, padx=10, pady=2)
        bottom = ctk.CTkFrame(card, fg_color="transparent")
        bottom.pack(fill="x", padx=18, pady=(10, 16))
        self.back_btn = ctk.CTkButton(bottom, text="◀ Назад", width=104, height=42, corner_radius=12, fg_color=BTN2,
                                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.back)
        self.back_btn.pack(side="left")
        if on_edit is not None:
            ctk.CTkButton(bottom, text="✎ Конструкти…", width=150, height=42, corner_radius=12, fg_color=BTN2,
                          hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.edit
                          ).pack(side="left", padx=10)
        ctk.CTkButton(bottom, text="Скасувати", width=104, height=42, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.cancel).pack(side="right")
        self.bind("<Escape>", lambda e: self.step_back())
        self.bind("<BackSpace>", lambda e: self.back())
        self.bind("<Left>", lambda e: self._hl(-1))                 # плитки: стрілки ходять по сітці
        self.bind("<Right>", lambda e: self._hl(1))
        self.bind("<Up>", lambda e: self._hl(-self.COLS))
        self.bind("<Down>", lambda e: self._hl(self.COLS))
        self.bind("<Return>", lambda e: self._activate(self.hl, hide=bool(e.state & ALT_MASK)))
        self.bind("<KP_Enter>", lambda e: self._activate(self.hl, hide=bool(e.state & ALT_MASK)))
        self.bind("<Key>", self._digit)
        # як у головному вікні: Alt+W/S/D — по плитках, Alt+A — крок назад (з першого кроку — закрити вікно),
        # Space — обрати, Alt+Space — обрати й сховати програму (незалежно від розкладки)
        self.bind("<Alt-KeyPress>", self._alt_key)
        self.bind("<KeyPress-space>", self._space)
        self.render_level()
        self.after(120, self.focus_set)

    def _alt_key(self, e):
        k = self.app._nav_key(e)
        if k == "a":
            self.step_back()
        elif k == "w":
            self._hl(-self.COLS)
        elif k == "s":
            self._hl(self.COLS)
        elif k == "d":
            self._hl(1)
        elif k == "space":
            self.alt_space()
        else:
            return None
        return "break"

    def _space(self, e):
        if e.state & ALT_MASK:
            self.alt_space()
        else:
            self._activate(self.hl)
        return "break"

    def alt_space(self) -> None:
        self._activate(self.hl, hide=True)

    def step_back(self) -> None:
        """Крок назад: попередній крок конструктора; з першого — закрити вибір (назад до папки)."""
        if len(self.stack) > 1:
            self.back()
        else:
            self.cancel()

    def current_text(self) -> str:
        return self.stack[-1][0]

    def options(self) -> list[dict]:
        return self.stack[-1][1]

    def render_level(self) -> None:
        for w in self.list.winfo_children():
            w.destroy()
        self.rows = []
        depth = len(self.stack) - 1
        self.back_btn.configure(state="normal" if depth else "disabled")
        self.level.configure(text="Оберіть продовження:" if not depth else f"Крок {depth + 1} — оберіть продовження:")
        base = self.current_text()
        for c in range(self.COLS):
            self.list.grid_columnconfigure(c, weight=1, uniform="tile")
        for i, node in enumerate(self.options()):              # лише текст продовження — без номерів і значків
            more = bool(node.get("children"))
            color = node.get("color")
            self._option(i, ctor_label(base, node["text"]), color or (CTOR_DEFAULT if more else CTOR_LEAF))
        self._option(len(self.options()), "None — залишити як є і скопіювати", None)
        self.hl = 0
        self._paint()
        text, warn = self.finalize(base)
        self.preview.configure(state="normal")
        self.preview.delete("1.0", "end")
        self.preview.insert("1.0", text)
        self.preview.configure(state="disabled")
        self.warn.configure(text=warn or "")

    COLS = 3              # продовження — квадратні плитки (як копіпасти в режимі плиток)
    TILE = 228

    RADIUS = 24           # заокруглені плитки

    def _option(self, i: int, label: str, color: str | None) -> None:
        lv = sat_params(max(_SAT[0], LEVEL_SAT[1]))     # плитки вибору — щонайменше «середньо» насичені
        base = tint(color, *lv[0]) if color else BTN2
        hover = tint(color, *lv[2]) if color else BTN2_HOVER
        sc = self.app.scaling()
        fr = ctk.CTkFrame(self.list, width=self.TILE, height=self.TILE, corner_radius=self.RADIUS, fg_color=base,
                          border_width=3, border_color=base, cursor="hand2")
        fr.grid(row=i // self.COLS, column=i % self.COLS, padx=6, pady=6)
        fr.pack_propagate(False)
        lbl = tk.Label(fr, text=label, font=self.app.pf.card, anchor="w", justify="left", bg=self.app.col(base),
                       fg=self.app.col(ink(base) if color else MUTED),
                       wraplength=int((self.TILE - 44) * sc), padx=4, pady=4, cursor="hand2")
        lbl.pack(fill="both", expand=True, padx=int(14 * sc), pady=int(14 * sc))   # жирний; по центру по висоті
        for w in (fr, lbl):
            w.bind("<Button-1>", lambda e, n=i: self._activate(n, hide=bool(e.state & ALT_MASK)))
            w.bind("<Enter>", lambda e, n=i: self._hover(n, True))
            w.bind("<Leave>", lambda e, n=i: self._hover(n, False))
        self.rows.append((fr, lbl, base, hover))

    def _hover(self, i: int, on: bool) -> None:
        if 0 <= i < len(self.rows):
            fr, lbl, base, hover = self.rows[i]
            fill = hover if on else base
            if getattr(fr, "_cm_fill", None) == fill:
                return
            fr._cm_fill = fill
            fr._cm_edge = ACCENT if i == self.hl else fill
            fr.configure(fg_color=fill, border_color=fr._cm_edge)
            lbl.configure(bg=self.app.col(fill), fg=self.app.col(ink(fill) if fill not in (BTN2, BTN2_HOVER) else MUTED))

    def _paint(self) -> None:
        for n, (fr, lbl, base, hover) in enumerate(self.rows):
            edge = ACCENT if n == self.hl else getattr(fr, "_cm_fill", base)
            if getattr(fr, "_cm_edge", None) != edge:
                fr._cm_edge = edge
                fr.configure(border_color=edge)

    def _hl(self, d: int) -> str:
        if self.rows:
            n = self.hl + d
            if abs(d) == 1:
                n %= len(self.rows)                  # ←/→ — по колу
            elif not 0 <= n < len(self.rows):
                n = self.hl if d < 0 else len(self.rows) - 1    # ↑/↓ — рядом вище/нижче (униз — до останньої)
            self.hl = n
            self._paint()
        return "break"

    def _digit(self, e) -> None:
        if e.char and e.char.isdigit():
            n = int(e.char)
            self._activate(len(self.options()) if n == 0 else n - 1)

    def _activate(self, i: int, enter_only: bool = False, hide: bool = False) -> None:
        """hide=True (Alt + клік / Alt+Enter) — після копіювання ще й згорнути програму."""
        opts = self.options()
        if i == len(opts):                         # None — копіюємо вже побудоване
            if not enter_only:
                self.finish(self.current_text(), hide)
            return
        if not 0 <= i < len(opts):
            return
        node = opts[i]
        if node.get("children"):
            self.stack.append((node["text"], node["children"]))
            self.render_level()
        elif not enter_only:
            self.finish(node["text"], hide)

    def back(self) -> None:
        if len(self.stack) > 1:
            self.stack.pop()
            self.render_level()

    def edit(self) -> None:
        new = self.on_edit()
        try:
            self.grab_set()
        except tk.TclError:
            pass
        if not new or not new.get("options"):
            if new is not None:
                self.cancel()
            return
        self.stack = [(self.root_text, new["options"])]
        self.render_level()

    def finish(self, text: str, hide: bool = False) -> None:
        self.result = {"text": self.finalize(text)[0], "hide": bool(hide)}
        self.destroy()


class ColorsDialog(_Dialog):
    """⚙ → «Кольори й рамки — точно…»: повзунки насиченості записів і папок окремо, товщини та яскравості рамок.
    Зміни видно одразу у вікні програми; «Скасувати» повертає як було."""

    def __init__(self, app: "App"):
        super().__init__(app, "Кольори й рамки", 560, 560)
        self.before = (tuple(_SAT), tuple(_BORDER))
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        ctk.CTkLabel(card, text="ШВИДКО: НАСИЧЕНІСТЬ УСЬОГО", anchor="w", text_color=MUTED, font=app.f.caps).pack(
            fill="x", padx=22, pady=(16, 4))
        quick = ctk.CTkFrame(card, fg_color="transparent")
        quick.pack(fill="x", padx=18)
        for n, name in enumerate(COLOR_LEVEL_SHORT):
            ctk.CTkButton(quick, text=name, height=34, width=80, corner_radius=10, fg_color=BTN2,
                          hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.body,
                          command=lambda n=n: self.quick(n)).pack(side="left", padx=3, expand=True, fill="x")
        self.sliders = {}
        self.values = {}
        self._job = None
        for key, label, lo, hi, steps, cur in (
                ("cards", "Насиченість записів (і фраз)", 0, 100, 100, _SAT[0] * 100),
                ("folders", "Насиченість папок", 0, 100, 100, _SAT[1] * 100),
                ("width", "Товщина рамки, px", 1, 6, 5, _BORDER[0]),
                ("glow", "Яскравість рамки", 0, 100, 100, _BORDER[1] * 100)):
            row = ctk.CTkFrame(card, fg_color="transparent")
            row.pack(fill="x", padx=22, pady=(14, 0))
            ctk.CTkLabel(row, text=label, anchor="w", text_color=TEXT, font=app.f.dlg).pack(side="left")
            val = ctk.CTkLabel(row, text="", anchor="e", text_color=MUTED, font=app.f.dlg, width=60)
            val.pack(side="right")
            sl = ctk.CTkSlider(card, from_=lo, to=hi, number_of_steps=steps, height=20, button_color=ACCENT,
                               button_hover_color=ACCENT_HOVER, progress_color=ACCENT,
                               command=lambda v, k=key: self.moved(k, v))
            sl.pack(fill="x", padx=22, pady=(6, 0))
            sl.set(cur)
            self.sliders[key], self.values[key] = sl, val
            self._show(key, cur)
        bottom = ctk.CTkFrame(card, fg_color="transparent")
        bottom.pack(fill="x", side="bottom", padx=18, pady=(10, 16))
        ctk.CTkButton(bottom, text="Готово", width=112, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, font=app.f.dlg_bold, command=self.ok).pack(side="right")
        ctk.CTkButton(bottom, text="Скасувати", width=112, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.revert
                      ).pack(side="right", padx=10)
        self.protocol("WM_DELETE_WINDOW", self.revert)
        self.bind("<Escape>", lambda e: self.revert())

    def _show(self, key: str, v: float) -> None:
        self.values[key].configure(text=f"{int(round(v))} px" if key == "width" else f"{int(round(v))} %")

    def moved(self, key: str, v: float) -> None:
        self._show(key, v)
        if self._job is not None:
            self.after_cancel(self._job)
        self._job = self.after(120, self.apply)               # під час руху повзунка — не частіше ніж раз на 120 мс

    def apply(self) -> None:
        self._job = None
        g = {k: s.get() for k, s in self.sliders.items()}
        set_saturation(g["cards"] / 100, g["folders"] / 100)
        set_border(round(g["width"]), g["glow"] / 100)
        self.app._save_colors()
        self.app._recolor()

    def quick(self, n: int) -> None:
        self.sliders["cards"].set(LEVEL_SAT[n] * 100)
        self.sliders["folders"].set(LEVEL_SAT[n] * 100)
        for k in ("cards", "folders"):
            self._show(k, LEVEL_SAT[n] * 100)
        self.apply()

    def ok(self) -> None:
        if self._job is not None:
            self.after_cancel(self._job)
        self.apply()
        self.result = True
        self.destroy()

    def revert(self) -> None:
        if self._job is not None:
            self.after_cancel(self._job)
            self._job = None
        (c, f), (w, gl) = self.before
        set_saturation(c, f)
        set_border(w, gl)
        self.app._save_colors()
        self.app._recolor()
        self.cancel()


class ShapeDialog(_Dialog):
    """Вибір фігури (чорного значка) для папки. Результат: фігура або None."""

    COLUMNS = 5

    def __init__(self, app: "App", title: str, current: str | None):
        rows = (len(SHAPES) + self.COLUMNS - 1) // self.COLUMNS
        super().__init__(app, title, 420, 150 + rows * 66)
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        ctk.CTkLabel(card, text="Оберіть фігуру", anchor="w", text_color=MUTED, font=app.f.body).pack(
            fill="x", padx=22, pady=(16, 8))
        grid = ctk.CTkFrame(card, fg_color="transparent")
        grid.pack(padx=18)
        self.buttons = {}
        for n, sh in enumerate(SHAPES):
            b = ctk.CTkButton(grid, text=sh, width=56, height=56, corner_radius=12, text_color=TEXT,
                              fg_color=ACCENT_SOFT if sh == current else BTN2, hover_color=BTN2_HOVER,
                              border_width=2 if sh == current else 0, border_color=ACCENT,
                              font=ctk.CTkFont(family=FONT, size=24), command=lambda v=sh: self.choose(v))
            b.grid(row=n // self.COLUMNS, column=n % self.COLUMNS, padx=4, pady=4)
            self.buttons[sh] = b
        ctk.CTkButton(card, text="Скасувати", width=100, height=38, corner_radius=12, fg_color="transparent",
                      hover_color=BTN2, text_color=MUTED, font=app.f.dlg, command=self.cancel).pack(
            side="bottom", anchor="e", padx=22, pady=(8, 14))

    def choose(self, shape: str) -> None:
        self.result = shape
        self.destroy()


class FolderShapesDialog(_Dialog):
    """⚙ → «Фігури папок…»: усі папки з їхніми фігурами; клік по фігурі — замінити."""

    def __init__(self, app: "App"):
        super().__init__(app, "Фігури папок", 520, 560)
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        ctk.CTkLabel(card, text="Клік по фігурі — обрати іншу", anchor="w", text_color=MUTED, font=app.f.body).pack(
            fill="x", padx=22, pady=(16, 6))
        self.list = ScrollFrame(card, fg_color="transparent", corner_radius=0,
                                           scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.list.pack(fill="both", expand=True, padx=10, pady=4)
        ctk.CTkButton(card, text="Готово", width=112, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, font=app.f.dlg_bold, command=self.cancel).pack(
            side="bottom", anchor="e", padx=18, pady=(6, 14))
        self.rebuild()

    def rebuild(self) -> None:
        for w in self.list.winfo_children():
            w.destroy()
        self.buttons = {}
        for c in self.app.preset.categories:
            fill = row_colors(c["color"])[0]
            row = ctk.CTkFrame(self.list, corner_radius=12, fg_color=fill, border_width=1,
                               border_color=row_colors(c["color"])[3])
            row.pack(fill="x", padx=4, pady=4)
            b = ctk.CTkButton(row, text=c.get("shape") or "●", width=48, height=44, corner_radius=10, fg_color=BTN2,
                              hover_color=BTN2_HOVER, text_color=TEXT, font=ctk.CTkFont(family=FONT, size=22),
                              command=lambda cid=c["id"]: self.change(cid))
            b.pack(side="left", padx=10, pady=8)
            ctk.CTkLabel(row, text=c["name"], anchor="w", text_color=TEXT, font=self.app.f.dlg_bold).pack(
                side="left", fill="x", expand=True)
            self.buttons[c["id"]] = b

    def change(self, cat_id: str) -> None:
        cat = self.app.preset.category(cat_id)
        shape = ShapeDialog(self.app, f"Фігура папки «{clip(cat['name'], 20)}»", cat.get("shape")).run()
        try:
            self.grab_set()
        except tk.TclError:
            pass
        if shape and self.app.preset.set_category_shape(cat_id, shape):
            self.rebuild()


class ColorDialog(_Dialog):
    """Вибір кольору: сітка плашок, «МОЇ КОЛЬОРИ» (збережені власні; правий клік — прибрати), «ОСТАННІ» (історія
    обраних кольорів) + «Інший колір…» / «＋ Зберегти свій…» (+ «Як у папки» для запису).
    Результат: None (скасовано) | ("set", "#rrggbb") | ("reset", None). Кожен обраний колір потрапляє в історію."""

    COLUMNS = 6

    def __init__(self, app: "App", title: str, current: str | None, allow_reset: bool = False,
                 reset_label: str = "Як у папки"):
        self.saved = app.settings.colors("colors_saved")
        self.recent = [c for c in app.settings.colors("colors_recent") if c not in {x.lower() for x in SWATCHES}]
        super().__init__(app, title, 470, self._height())
        self.current = (current or "").lower()
        self.allow_reset, self.reset_label = allow_reset, reset_label
        self.card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        self.card.pack(fill="both", expand=True, padx=14, pady=14)
        self.build()

    def _rows(self, n: int) -> int:
        return (n + self.COLUMNS - 1) // self.COLUMNS

    def _height(self) -> int:
        h = 236 + self._rows(len(SWATCHES)) * 58                         # + рядок «Насиченість»
        h += 34 + max(1, self._rows(len(self.saved) + 1)) * 58          # «Мої кольори» + плашка «＋»
        if self.recent:
            h += 34 + self._rows(len(self.recent)) * 58
        return h

    def build(self) -> None:
        app = self.app
        for w in self.card.winfo_children():
            w.destroy()
        ctk.CTkLabel(self.card, text="Оберіть колір", anchor="w", text_color=MUTED, font=app.f.body).pack(
            fill="x", padx=22, pady=(18, 8))
        self.swatches: dict[str, ctk.CTkButton] = {}
        self._grid(SWATCHES)
        ctk.CTkLabel(self.card, text="МОЇ КОЛЬОРИ   (правий клік — прибрати)", anchor="w", text_color=MUTED,
                     font=app.f.caps).pack(fill="x", padx=22, pady=(10, 2))
        self._grid(self.saved, add_btn=True, removable=True)
        if self.recent:
            ctk.CTkLabel(self.card, text="ОСТАННІ", anchor="w", text_color=MUTED, font=app.f.caps).pack(
                fill="x", padx=22, pady=(10, 2))
            self._grid(self.recent)
        row = ctk.CTkFrame(self.card, fg_color="transparent")
        row.pack(fill="x", padx=22, pady=(12, 18), side="bottom")
        ctk.CTkLabel(self.card, text="НАСИЧЕНІСТЬ УСІХ КОЛЬОРІВ (записи й папки)", anchor="w", text_color=MUTED,
                     font=app.f.caps).pack(fill="x", padx=22, pady=(12, 2))
        self.level = ctk.CTkSegmentedButton(self.card, values=COLOR_LEVEL_SHORT,
                                            command=self._set_level, font=app.f.body, height=34)
        self.level.pack(fill="x", padx=20)
        if _COLOR_LEVEL[0] >= 0:
            self.level.set(self.level._value_list[_COLOR_LEVEL[0]])
        ctk.CTkButton(row, text="Інший колір…", width=124, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg,
                      command=self.custom).pack(side="left")
        if self.allow_reset:
            ctk.CTkButton(row, text=self.reset_label, width=110, height=40, corner_radius=12, fg_color=BTN2,
                          hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg,
                          command=self.reset).pack(side="left", padx=(8, 0))
        ctk.CTkButton(row, text="Скасувати", width=100, height=40, corner_radius=12, fg_color="transparent",
                      hover_color=BTN2, text_color=MUTED, font=app.f.dlg,
                      command=self.cancel).pack(side="right")

    def _set_level(self, value: str) -> None:
        """Насиченість кольорів — прямо у вікні вибору кольору (діє одразу на всі записи й папки)."""
        vals = self.level._value_list
        if value in vals:
            self.app.set_color_level(vals.index(value))

    def _grid(self, colors, add_btn: bool = False, removable: bool = False) -> None:
        app = self.app
        grid = ctk.CTkFrame(self.card, fg_color="transparent")
        grid.pack(padx=18, anchor="center" if colors is SWATCHES else "w")
        n = -1
        for n, color in enumerate(colors):
            mark = "✓" if color.lower() == self.current else ""
            r_, g_, b_ = _rgb(color)
            light = (0.299 * r_ + 0.587 * g_ + 0.114 * b_) > 170          # на світлих кольорах — темна галочка
            b = ctk.CTkButton(grid, text=mark, width=48, height=48, corner_radius=24, fg_color=color,
                              hover_color=blend(color, "#000000", 0.18), text_color="#1b1b1b" if light else "#ffffff",
                              font=app.f.icon, command=lambda c=color: self.choose(c))
            b.grid(row=n // self.COLUMNS, column=n % self.COLUMNS, padx=5, pady=5)
            if removable:
                for w in (b, getattr(b, "_canvas", None), getattr(b, "_text_label", None)):
                    if w is not None:
                        w.bind("<Button-3>", lambda e, c=color: self.forget(c))
            self.swatches.setdefault(color, b)
        if add_btn:
            n += 1
            ctk.CTkButton(grid, text="＋", width=48, height=48, corner_radius=24, fg_color=BTN2, hover_color=BTN2_HOVER,
                          text_color=TEXT, font=app.f.icon, command=self.save_new
                          ).grid(row=n // self.COLUMNS, column=n % self.COLUMNS, padx=5, pady=5)

    def _relayout(self) -> None:
        self.saved = self.app.settings.colors("colors_saved")
        self.build()
        self.geometry(f"470x{self._height()}")             # ctk сам масштабує розміри вікна

    def choose(self, color: str) -> None:
        self.app.settings.note_color(color)
        self.result = ("set", color.lower())
        self.destroy()

    def reset(self) -> None:
        self.result = ("reset", None)
        self.destroy()

    def _regrab(self) -> None:
        try:
            self.grab_set()                       # після вкладеного діалогу повертаємо захоплення собі
        except tk.TclError:
            pass

    def custom(self) -> None:
        hex_color = RGBDialog(self.app, self.current or None).run()
        self._regrab()
        if hex_color:
            self.choose(hex_color)

    def save_new(self) -> None:
        """«＋» у «Мої кольори»: свій колір зберігається (і його одразу видно серед збережених)."""
        hex_color = RGBDialog(self.app, self.current or None).run()
        self._regrab()
        if hex_color:
            self.app.settings.save_color(hex_color)
            self._relayout()

    def forget(self, color: str) -> None:
        self.app.settings.forget_color(color)
        self._relayout()


class RGBDialog(_Dialog):
    """Власний вибір довільного кольору (замість рідного вікна Windows, яке відкривалось на першому моніторі
    й ламалось поверх модальних вікон): три повзунки R/G/B, поле HEX і попередній перегляд.
    Результат: "#rrggbb" або None."""

    def __init__(self, app: "App", current: str | None):
        super().__init__(app, "Свій колір (RGB)", 470, 390)
        start = (current or "#0f6cbd").lower()
        if not COLOR_RE.match(start):
            start = "#0f6cbd"
        r, g, b = _rgb(start)
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        self.preview = ctk.CTkFrame(card, height=64, corner_radius=14, fg_color=start, border_width=1,
                                    border_color=PANEL_BORDER)
        self.preview.pack(fill="x", padx=22, pady=(20, 10))
        self.vars, self.labels = {}, {}
        for name, val in (("R", r), ("G", g), ("B", b)):
            row = ctk.CTkFrame(card, fg_color="transparent")
            row.pack(fill="x", padx=22, pady=3)
            ctk.CTkLabel(row, text=name, width=22, text_color=MUTED, font=app.f.dlg_bold).pack(side="left")
            var = tk.IntVar(value=val)
            sl = ctk.CTkSlider(row, from_=0, to=255, number_of_steps=255, variable=var,
                               command=lambda v: self._from_sliders())
            sl.pack(side="left", fill="x", expand=True, padx=8)
            lab = ctk.CTkLabel(row, text=str(val), width=36, text_color=TEXT, font=app.f.dlg)
            lab.pack(side="left")
            self.vars[name], self.labels[name] = var, lab
        hexrow = ctk.CTkFrame(card, fg_color="transparent")
        hexrow.pack(fill="x", padx=22, pady=(10, 4))
        ctk.CTkLabel(hexrow, text="HEX", width=40, text_color=MUTED, font=app.f.dlg_bold).pack(side="left")
        self.hex = ctk.CTkEntry(hexrow, width=130, height=36, corner_radius=10, fg_color=INPUT,
                                border_color=PANEL_BORDER, font=app.f.dlg, text_color=TEXT)
        self.hex.pack(side="left", padx=(6, 0))
        self.hex.insert(0, start)
        self.hex.bind("<KeyRelease>", lambda e: self._from_hex())
        for ev_ in ("<<Paste>>", "<<Cut>>"):
            self.hex.bind(ev_, lambda e: self.after(30, self._from_hex), add="+")
        self.bind("<Return>", lambda e: self.accept())
        btns = ctk.CTkFrame(card, fg_color="transparent")
        btns.pack(fill="x", padx=22, pady=(14, 18), side="bottom")
        ctk.CTkButton(btns, text="Обрати", width=110, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, text_color="#ffffff", font=app.f.dlg_bold,
                      command=self.accept).pack(side="left")
        ctk.CTkButton(btns, text="Скасувати", width=100, height=40, corner_radius=12, fg_color="transparent",
                      hover_color=BTN2, text_color=MUTED, font=app.f.dlg, command=self.cancel).pack(side="right")

    def color(self) -> str:
        return "#%02x%02x%02x" % tuple(int(self.vars[n].get()) for n in "RGB")

    def _show(self, color: str) -> None:
        self.preview.configure(fg_color=color)
        for n in "RGB":
            self.labels[n].configure(text=str(int(self.vars[n].get())))

    def _from_sliders(self) -> None:
        c = self.color()
        self._show(c)
        if self.hex.get().lower() != c:
            self.hex.delete(0, "end")
            self.hex.insert(0, c)

    def _from_hex(self) -> None:
        text = self.hex.get().strip().lower()
        if not text.startswith("#"):
            text = "#" + text
        if len(text) == 4 and re.fullmatch(r"#[0-9a-f]{3}", text):          # короткий запис #f0a → #ff00aa
            text = "#" + "".join(ch * 2 for ch in text[1:])
        ok = bool(COLOR_RE.match(text))
        self.hex.configure(border_color=PANEL_BORDER if ok or len(text) <= 1 else DANGER)
        if ok:
            for n, v in zip("RGB", _rgb(text)):
                self.vars[n].set(v)
            self._show(text)

    def accept(self) -> None:
        self.result = self.color()
        self.destroy()


# --------------------------------------------------------------------------- #
#  Швидкі «рядки»: ОДИН ctk-фрейм (заокруглення, рамка) + прості tk-віджети всередині
# --------------------------------------------------------------------------- #
# Композит із ctk-міток/фреймів коштував ~14 мс на картку (кожен CTk-віджет — окреме полотно, яке
# перемальовується при створенні й при кожній зміні розміру). Простий tk.Label створюється за ~0,1 мс.
# Вигляд той самий: заокруглену підкладку малює один CTkFrame, решту — звичайні tk-віджети.

def _eff(fill) -> object:
    """Фон, який реально видно під прозорим рядком."""
    return PANEL if fill == "transparent" else fill


def _ctk_resize(frame, width: int | None = None, height: int | None = None) -> None:
    """Новий бажаний розмір CTkFrame БЕЗ негайного перемальовування. Штатний configure(width=…, height=…) малює
    фрейм двічі (окремо на ширину й висоту) ще за СТАРИМ розміром — справжній розмір приходить пізніше подією
    <Configure>, і тоді ctk однаково перемальовує його вдруге. Тут: лише розмір (як у ctk), малює подія <Configure>
    (а якщо фактичний розмір не змінився — малювати й нічого)."""
    try:
        ctk.CTkBaseClass._set_dimensions(frame, width, height)     # бажаний розмір + розмір самого tk.Frame
        frame._canvas.configure(width=frame._apply_widget_scaling(frame._desired_width),
                                height=frame._apply_widget_scaling(frame._desired_height))
    except AttributeError:
        kw = {k: v for k, v in (("width", width), ("height", height)) if v is not None}
        frame.configure(**kw)


def card_user_link(it: dict) -> bool:
    """Чи підставляє запис користувача з історії: явний прапорець запису або (за замовчуванням) заглушка «in ____»."""
    if "category" not in it and "user_link" not in it:
        return False                                    # історія буфера — без підстановки
    flag = it.get("user_link")
    return bool(flag) if isinstance(flag, bool) else has_user_placeholder(it.get("text", ""))


class Card:
    """Картка запису. Живе між перебудовами списку: змінений текст/колір оновлюється на місці.
    В історії (checkable) праворуч, перед «⋯», є галочка для вибору кількох значень."""

    def __init__(self, app: "App", parent, it: dict, pad: int, wrap_px: int, selected: bool = False,
                 checkable: bool = False, checked: bool = False, tile: bool = False):
        self.app, self.iid, self.tile = app, it["id"], tile
        self.text, self.ts, self.color, self.bcolor = it["text"], it["ts"], it.get("color"), it.get("border")
        self.v2 = "ctor" if it.get("ctor") else bool(it.get("v2"))
        self.ulink = card_user_link(it)
        self.fill, self.hover, self.border = card_colors(self.color, self.bcolor)
        self.bw = border_width()
        self.cur = self.fill
        self.clip = None                               # плитка: рамка, в якій довгий текст прокручується колесом
        self._off = 0
        self.hovering = False
        self.selected = selected
        self.checked = bool(checked)
        pf, col = app.pf, app.col
        bg = col(self.fill)
        # усі кольори й тексти — одразу в конструкторах: кожен зайвий configure() ctk-фрейма = ще одне перемальовування
        self.frame = f = ctk.CTkFrame(parent, corner_radius=14 if tile else 12, fg_color=self.fill, cursor="hand2",
                                      border_width=border_width(selected),
                                      border_color=ACCENT if selected else self.border,
                                      **({"width": getattr(app, "_rec_tile_w", 10), "height": app._rec_tile_h}
                                         if tile else {}))
        f.grid_columnconfigure(1 if tile else 2, weight=1)
        if tile:                                       # плитка — «квадрат»: зверху службова смужка зі значками, нижче текст
            f.grid_propagate(False)
            f.grid_rowconfigure(1, weight=1)
        self.bar = tk.Frame(f, width=6, height=8, cursor="hand2", bg=col(self.color or NEUTRAL))
        self.bar.grid(row=0, column=0, rowspan=2, sticky="ns", padx=(9, 0), pady=10)
        c0 = 1 if tile else 0                           # у плитці перед значками є розпірка (колонка 0)
        # ліва частина (смужка + текст) — зона копіювання: клік копіює запис; права — «службова», там клік нічого не робить,
        # лише значки: галочка (історія), «⋯» (редагування, колір, переміщення…) і «✕» (видалити)
        fg = col(ink(self.fill))
        self.body = tk.Label(f, anchor="w", justify="left", font=pf.card, wraplength=wrap_px, cursor="hand2",
                             text=self.shown_text(), bg=bg, fg=fg, pady=8)
        if tile:
            # плитка має фіксовану висоту: увесь текст лежить у «вікні» clip і прокручується колесом миші
            self.clip = tk.Frame(f, bg=bg, cursor="hand2")
            self.clip.grid(row=1, column=1, sticky="nsew", padx=(12, 10), pady=(0, 8))
            self.body.destroy()
            self.body = tk.Label(self.clip, anchor="nw", justify="left", font=pf.card, wraplength=wrap_px,
                                 cursor="hand2", text=self.shown_text(), bg=bg, fg=fg, pady=2)
            self.body.place(x=0, y=0, relwidth=1)
            self.more_hint = tk.Label(self.clip, text="▼", font=pf.small, bg=bg, fg=col(MUTED), cursor="hand2")
            for w in (self.clip, self.body, self.more_hint):
                w.bind("<MouseWheel>", self._wheel)
                w.bind("<Button-4>", self._wheel)
                w.bind("<Button-5>", self._wheel)
            self.clip.bind("<Configure>", lambda e: self._sync_hint(), add="+")
            self.body.bind("<Configure>", lambda e: self._sync_hint(), add="+")
            self.zone = tk.Frame(f, bg=bg, height=int((60 if checkable else 34) * app.scaling()), cursor="arrow")
            self.zone.grid(row=0, column=1, sticky="ew", padx=(0, 4), pady=(4, 0))
            self.zone.grid_columnconfigure(0, weight=1)
            self.lead = tk.Frame(self.zone, bg=bg)               # зліва у верхній смужці: фігура кольору + плашка
            self.lead.grid(row=0, column=0, sticky="w", padx=(6, 0))
            self.icon = tk.Label(self.lead, font=pf.card_shape, bg=bg, fg=fg, padx=0, pady=0)
        else:
            self.icon = tk.Label(f, font=pf.card_shape, bg=bg, fg=fg, padx=0, pady=0, cursor="hand2")
            self.icon.grid(row=0, column=1, sticky="w", padx=(10, 0))
            self.body.grid(row=0, column=2, sticky="nsew", padx=(8, 4), pady=4)   # відступ 4: видно заокруглену рамку
            f.grid_rowconfigure(0, weight=1, minsize=int(CARD_MIN_H * app.scaling()))
            self.zone = tk.Frame(f, bg=bg, width=int((ZONE_W + (70 if checkable else 0)) * app.scaling()), cursor="arrow")
            self.zone.grid(row=0, column=3, sticky="ns", padx=(0, 4), pady=4)
            self.zone.grid_propagate(False)
            self.zone.grid_rowconfigure(0, weight=1)
        self.check = None
        if checkable:
            self.size = max(32, int(CHECK_SIZE * app.scaling()))
            self.check = tk.Canvas(self.zone, width=self.size, height=self.size, highlightthickness=0,
                                   cursor="hand2", bg=bg)
            self.check.grid(row=0, column=c0, padx=(6, 6))
            self._draw_check()
        self.more = app._icon_button(self.zone, "⋯", lambda e: app.show_menu(e.x_root, e.y_root, self.iid),
                                     bg_fn=self.bg_now, fg_fn=self.muted_now)
        self.dele = app._icon_button(self.zone, "✕", lambda e: app.on_delete(self.iid), hover_text=DANGER,
                                     bg_fn=self.bg_now, fg_fn=self.muted_now)
        self.more.grid(row=0, column=c0 + 1, padx=(0, 2), pady=(0 if tile else 8, 0), sticky="n")
        self.dele.grid(row=0, column=c0 + 2, padx=(0, 4 if tile else 8), pady=(0 if tile else 8, 0), sticky="n")
        self.plain = (self.body, self.more, self.dele, self.icon) + ((self.check,) if self.check else ()) + \
            ((self.clip, self.more_hint, self.lead) if self.clip is not None else ())
        self._sync_icon()
        self.flash_job = None
        self.flash_lbl = None
        self.badge = None
        self._sync_badge()
        # одна пара «bindtag» на всі картки замість ~25 прив'язок на кожну (див. App._init_tags);
        # клік у правій зоні ігнорується в App._drag_press (порівняння з лівим краєм self.zone)
        for w in (f._canvas, self.bar, self.body) + ((self.clip, self.more_hint) if self.clip is not None else (self.icon,)):
            w._cm_iid = self.iid
            w.bindtags(("CMCardClick", "CMCardHover") + w.bindtags())
        for w in (self.more, self.dele, self.zone) + ((self.check,) if self.check else ()):
            w._cm_iid = self.iid
            w.bindtags(("CMCardHover",) + w.bindtags())
            if w is not self.zone:
                w.bind("<Button-3>", lambda e: app.show_menu(e.x_root, e.y_root, self.iid), add="+")
        if self.check is not None:      # клік по галочці НЕ копіює запис (власні bindtags без CMCardClick)
            self.check.bind("<Button-1>", lambda e: (app.toggle_check(self.iid), "break")[1])

    def flash(self) -> None:
        """Ефект «скопійовано»: зелена плашка «✓ Скопійовано» поверх тексту на ~0,5 с."""
        self.unflash()
        try:
            self.flash_lbl = lbl = tk.Label(self.frame, text="✓  Скопійовано", font=self.app.pf.bold, fg="#ffffff",
                                            bg=self.app.col(COPIED), cursor="hand2")
            lbl.place(in_=self.clip or self.body, x=0, y=0, relwidth=1, relheight=1)
            self.flash_job = self.frame.after(550, self.unflash)
        except tk.TclError:
            self.flash_lbl = self.flash_job = None

    def unflash(self) -> None:
        if self.flash_job is not None:
            try:
                self.frame.after_cancel(self.flash_job)
            except tk.TclError:
                pass
            self.flash_job = None
        if self.flash_lbl is not None:
            try:
                self.flash_lbl.destroy()
            except tk.TclError:
                pass
            self.flash_lbl = None

    def shown_text(self) -> str:
        """Текст картки (у плитці — повністю, з прокруткою); позначки: «▶ v.2» — клік відкриває вибір аппендів,
        «@ user» — підставляється користувач з історії (in {LINK:USER:…:E})."""
        body = self.text.strip() if self.tile else preview(self.text)
        mark = "" if self.v2 == "ctor" else ("   ▶ v.2" if self.v2 else "")     # конструктор — окрема плашка
        return body + mark + ("   @ user" if self.ulink else "")

    def shape(self) -> str:
        return shape_for_color(self.color)

    def _sync_icon(self) -> None:
        """Фігура кольору запису — окремим великим значком (у списку — перед текстом, у плитці — зверху зліва)."""
        sh = self.shape()
        self.icon.configure(text=sh)
        if sh:
            if self.tile:
                self.icon.pack(side="left", padx=(0, 6))
            else:
                self.icon.grid()
        elif self.tile:
            self.icon.pack_forget()
        else:
            self.icon.grid_remove()

    def _sync_badge(self) -> None:
        """Яскрава плашка «⧉ КОНСТРУКТОР» у службовій зоні картки (клік — відкрити вибір)."""
        want = self.v2 == "ctor"
        badge = getattr(self, "badge", None)
        if want and badge is None:
            a = self.app
            self.badge = tk.Label(self.lead if self.tile else self.zone, text="⧉ КОНСТРУКТОР", font=a.pf.badge,
                                  fg="#ffffff", bg=a.col(BADGE), padx=7, pady=3, cursor="hand2")
            if self.tile:
                self.badge.pack(side="left", pady=(2, 0))
            else:
                self.badge.grid(row=1, column=0, columnspan=3, sticky="sw", padx=(0, 0), pady=(0, 8))
            self.badge.bind("<Button-1>", lambda e: (a.copy_item(self.iid), "break")[1])
            self.badge.bind("<Button-3>", lambda e: a.show_menu(e.x_root, e.y_root, self.iid))
        elif not want and badge is not None:
            badge.destroy()
            self.badge = None

    # -- прокрутка довгого тексту в плитці --------------------------------------------------------
    def _overflow(self) -> int:
        try:
            return max(0, self.body.winfo_reqheight() - self.clip.winfo_height())
        except tk.TclError:
            return 0

    def _wheel(self, e):
        """Колесо над текстом плитки прокручує сам текст; коли він уже в кінці (або вміщується) — прокручується список."""
        over = self._overflow()
        if over <= 0:
            return None
        up = getattr(e, "num", 0) == 4 or getattr(e, "delta", 0) > 0
        step = max(1, int(36 * SCROLL_FACTOR * self.app.scaling()))
        new = max(0, min(over, self._off + (-step if up else step)))
        if new == self._off:
            return None                                 # край тексту — колесо далі гортає список
        self._off = new
        self.body.place_configure(y=-new)
        self._sync_hint()
        return "break"

    def _sync_hint(self) -> None:
        """Стрілка «▼» у кутку — є ще текст нижче."""
        if self.clip is None:
            return
        over = self._overflow()
        try:
            if over <= 0:                       # текст вміщається — по центру плитки по висоті
                self._off = 0
                y = max(0, (self.clip.winfo_height() - self.body.winfo_reqheight()) // 2)
            else:
                self._off = min(self._off, over)
                y = -self._off
            if int(float(self.body.place_info().get("y", 0) or 0)) != y:
                self.body.place_configure(y=y)
        except (tk.TclError, ValueError):
            pass
        try:
            if over > 0 and self._off < over:
                self.more_hint.place(relx=1.0, rely=1.0, anchor="se")
                self.more_hint.lift()
            else:
                self.more_hint.place_forget()
        except tk.TclError:
            pass

    def bg_now(self) -> str:
        return self.app.col(self.cur)

    def muted_now(self) -> str:
        return self.app.col(ink(self.cur, "muted"))

    def inert(self, x_root: int, y_root: int) -> bool:
        """Точка в службовій зоні картки (там клік нічого не копіює): праворуч у списку, у верхній смужці — у плитці."""
        if self.tile:
            return y_root < (self.clip or self.body).winfo_rooty()
        return x_root >= self.zone.winfo_rootx()

    def set_drop(self, on: bool) -> None:
        """Підсвітка плитки-цілі під час перетягування (перестановка)."""
        self.frame.configure(border_color=ACCENT if (on or self.selected) else self.border,
                             border_width=border_width(True) + 1 if on else border_width(self.selected))

    def set_tile_h(self, h: int) -> None:
        if self.tile and h != getattr(self, "_tile_h", None):      # configure ctk-фрейма = повне перемалювання
            self._tile_h = h
            _ctk_resize(self.frame, height=h)                        # малює вже подія <Configure> — один раз

    def _draw_check(self) -> None:
        """Галочка: заокруглений квадрат — порожній (рамка) або заповнений акцентом із білою «пташкою»."""
        c, a, z = self.check, self.app, self.size
        c.delete("all")
        m, r = max(2, z // 12), max(3, z // 4)
        pts = [m + r, m, z - m - r, m, z - m, m, z - m, m + r, z - m, z - m - r, z - m, z - m, z - m - r, z - m,
               m + r, z - m, m, z - m, m, z - m - r, m, m + r, m, m]
        if self.checked:
            c.create_polygon(pts, smooth=True, fill=ACCENT, outline=ACCENT)
            c.create_line(z * 0.27, z * 0.53, z * 0.43, z * 0.69, z * 0.74, z * 0.32, fill="#ffffff",
                          width=max(2, int(z / 9)), capstyle="round", joinstyle="round")
        else:
            c.create_polygon(pts, smooth=True, fill="", outline=a.col(META), width=max(2, z // 11))

    def set_checked(self, on: bool) -> None:
        if self.check is not None and on != self.checked:
            self.checked = on
            self._draw_check()

    def sync(self, it: dict) -> None:
        """Оновлює картку на місці, якщо змінились текст, час або колір (інакше нічого не робить)."""
        text, ts, color, bcolor = it["text"], it["ts"], it.get("color"), it.get("border")
        v2, ulink = "ctor" if it.get("ctor") else bool(it.get("v2")), card_user_link(it)
        if text != self.text or ts != self.ts or v2 != self.v2 or ulink != self.ulink or color != self.color:
            self.text, self.ts, self.v2, self.ulink, self.color = text, ts, v2, ulink, color
            self.body.configure(text=self.shown_text())
            self._sync_badge()
            self._sync_icon()                                  # фігура залежить від кольору
        self.bcolor = bcolor
        colors = card_colors(color, bcolor)
        if colors != (self.fill, self.hover, self.border) or self.bw != border_width():   # колір, насиченість, рамка
            self.fill, self.hover, self.border = colors
            self.bw = border_width()
            self.frame.configure(border_color=ACCENT if self.selected else self.border,
                                 border_width=border_width(self.selected))
            self.colorize()

    def colorize(self, frame: bool = True) -> None:
        """Розставляє кольори за поточними станом і темою. frame=False (зміна теми): ctk-фрейм перемальовується сам."""
        a = self.app
        fill = self.hover if self.hovering else self.fill
        self.cur = fill
        if frame:
            self.frame.configure(fg_color=fill)
        bg = a.col(fill)
        self.bar.configure(bg=a.col(self.color or NEUTRAL))
        self.body.configure(bg=bg)
        self.icon.configure(bg=bg)
        self.zone.configure(bg=bg)
        if self.clip is not None:
            self.clip.configure(bg=bg)
            self.lead.configure(bg=bg)
            self.more_hint.configure(bg=bg)
        for w in (self.more, self.dele):
            w.configure(bg=bg)
        self._ink(fill)
        if self.check is not None:
            self.check.configure(bg=bg)
            self._draw_check()
        if getattr(self, "badge", None) is not None:
            self.badge.configure(bg=a.col(BADGE))

    def paint(self, fill) -> None:
        self.cur = fill
        self.frame.configure(fg_color=fill)
        bg = self.app.col(fill)
        for w in self.plain:
            w.configure(bg=bg)
        self.zone.configure(bg=bg)
        self._ink(fill)

    def _ink(self, fill) -> None:
        """Текст і значки — під фон (на насиченому кольорі — білі або чорні, щоб читалось)."""
        a = self.app
        t, m = a.col(ink(fill)), a.col(ink(fill, "muted"))
        self.body.configure(fg=t)
        self.icon.configure(fg=t)
        for w in (self.more, self.dele):
            w.configure(fg=m)
        if self.clip is not None:
            self.more_hint.configure(fg=m)

    def hover_on(self) -> None:
        if not self.hovering:
            self.hovering = True
            self.paint(self.hover)

    def hover_off(self) -> None:
        if self.hovering:
            self.hovering = False
            self.paint(self.fill)

    def set_selected(self, sel: bool) -> None:
        if sel != self.selected:
            self.selected = sel
            self.frame.configure(border_color=ACCENT if sel else self.border, border_width=border_width(sel))

    def destroy(self) -> None:
        lens = getattr(self.app, "_clens", None)
        if lens is not None and lens is not self and lens.iid == self.iid:
            self.app._drop_card_lens()                 # збільшена копія цього запису зникає разом із ним
        try:
            self.unflash()
            self.frame.destroy()
        except Exception:                # збій знищення одного віджета не повинен зупиняти перебудову всього списку
            self.app._report_exception(*sys.exc_info())
            try:
                self.frame.pack_forget()
            except Exception:
                pass


class SideRow:
    """Рядок категорії (або «Історія буфера») в лівій колонці: смужка, кружечок-кнопка кольору, назва,
    лічильник, «⋯». ВЕЛИКИЙ (≥ 52 px) і залитий кольором папки повністю — як картки записів. Створюється один
    раз, далі оновлюється на місці. Рядки категорій можна перетягувати (міняти порядок)."""

    SHAPE_BOX = (44, 36)          # плитка папки: місце під велику фігуру (ширина, висота), px до масштабу

    def __init__(self, app: "App", parent, key: str, real: bool, tile: bool = False):
        self.app, self.key, self.real, self.tile = app, key, real, tile
        self.bcolor = None
        self.sig = None
        self.selected = False
        self.hovering = False
        self.fill = self.hover = self.sel_fill = self.border = None
        self.color = None
        self.cur = "transparent"
        pf = app.pf
        if tile:                                       # плитка: «⋯» зверху, велика фігура + назва (по центру), лічильник
            self.row = ctk.CTkFrame(parent, corner_radius=14, fg_color="transparent", border_width=0,
                                    border_color=PANEL_BORDER, cursor="hand2", width=10, height=96)
            self.row.grid_propagate(False)
            self.row.grid_columnconfigure(1, weight=1)
            self.row.grid_rowconfigure(1, weight=1)
            self.bar = tk.Frame(self.row, width=0, height=0)            # не показується; потрібна лише для colorize()
            # велика фігура — ліворуч від назви, у рамці фіксованого розміру (рядок не вищає, назві лишається місце)
            sc = app.scaling()
            self.dot_box = tk.Frame(self.row, width=int(self.SHAPE_BOX[0] * sc), height=int(self.SHAPE_BOX[1] * sc),
                                    bd=0, highlightthickness=0, cursor="hand2")
            self.dot_box.grid(row=1, column=0, sticky="w", padx=(8, 0))
            self.dot = app._shape_button(self.dot_box, key, big=True)
            self.dot.place(relx=0.5, rely=0.5, anchor="center", y=int(1 * sc))
            self.more = app._icon_button(self.row, "⋯", lambda e: app.show_category_menu(e.x_root, e.y_root, key),
                                         bg_fn=lambda: app.col(_eff(self.cur)),
                                         fg_fn=lambda: app.col(ink(self.cur, "muted")))
            self.more.grid(row=0, column=2, sticky="ne", padx=(0, 4), pady=(4, 0))
            self.label = tk.Label(self.row, anchor="w", justify="left", cursor="hand2", font=pf.bold,
                                  wraplength=int(90 * app.scaling()))
            self.label.grid(row=1, column=1, columnspan=2, sticky="nsew", padx=(6, 6))
            self.num = tk.Label(self.row, font=pf.meta, cursor="hand2", anchor="w")
            self.num.grid(row=2, column=0, columnspan=3, sticky="w", padx=(12, 6), pady=(0, 8))
            self.plain = [self.label, self.num, self.more, self.dot, self.dot_box]
            parts = [self.row, self.label, self.num]
            app._bind_all(parts, "<ButtonPress-1>", lambda e: app._reorder_press("cat", key, e))   # клік — вибір,
            app._bind_all(parts, "<B1-Motion>", lambda e: app._reorder_motion(e))               # перетягування —
            app._bind_all(parts, "<ButtonRelease-1>", lambda e: app._reorder_release(e))        # перестановка
            app._bind_all(parts + [self.dot, self.dot_box, self.more], "<Button-3>",
                          lambda e: app.show_category_menu(e.x_root, e.y_root, key))
            self.dot_box.bind("<Button-1>", lambda e: (app.on_category_color(key), "break")[1])
            app._hoverable(self.row, parts + [self.dot, self.dot_box, self.more], self._enter, self._leave)
            self.apply_inset()
            return
        self.row = ctk.CTkFrame(parent, corner_radius=12, fg_color="transparent", border_width=0,
                                border_color=PANEL_BORDER, cursor="hand2", height=ROW_H)
        self.row.grid_propagate(False)                 # висота рядка фіксована: ROW_H
        self.row.grid_columnconfigure(2, weight=1)
        self.row.grid_rowconfigure(0, weight=1)
        self.bar = tk.Frame(self.row, width=6, height=8, cursor="hand2")
        self.bar.grid(row=0, column=0, sticky="ns", padx=(9, 0), pady=10)
        if real:
            self.dot = app._shape_button(self.row, key)
        else:
            self.dot = tk.Label(self.row, text="●", font=pf.body, width=2, cursor="hand2")
        self.dot.grid(row=0, column=1, padx=(7, 6), pady=6)
        self.label = tk.Label(self.row, anchor="w", cursor="hand2", font=pf.card)
        self.label.grid(row=0, column=2, sticky="we", pady=7)
        self.num = tk.Label(self.row, font=pf.meta, cursor="hand2")
        self.num.grid(row=0, column=3, padx=(4, 4 if real else 12))
        self.more = None
        if real:
            self.more = app._icon_button(self.row, "⋯", lambda e: app.show_category_menu(e.x_root, e.y_root, key),
                                         bg_fn=lambda: app.col(_eff(self.cur)),
                                         fg_fn=lambda: app.col(ink(self.cur, "muted")))
            self.more.grid(row=0, column=4, padx=(0, 6))
        self.plain = [w for w in (self.label, self.num, self.more) if w is not None]
        self.plain.append(self.dot)
        parts = [self.row, self.bar, self.label, self.num]
        if real:                                       # клік — вибір, перетягування — перестановка
            app._bind_all(parts, "<ButtonPress-1>", lambda e: app._reorder_press("cat", key, e))
            app._bind_all(parts, "<B1-Motion>", lambda e: app._reorder_motion(e))
            app._bind_all(parts, "<ButtonRelease-1>", lambda e: app._reorder_release(e))
            app._bind_all(parts + [self.dot, self.more], "<Button-3>",
                          lambda e: app.show_category_menu(e.x_root, e.y_root, key))
        else:
            app._bind_all(parts + [self.dot], "<Button-1>", lambda e: app.select_category(key))
        app._hoverable(self.row, parts + [self.dot] + ([self.more] if self.more else []), self._enter, self._leave)
        self.apply_inset()

    def apply_inset(self) -> None:
        """Вміст — УСЕРЕДИНІ заокругленої рамки. Мітки й «⋯» — прості прямокутні tk-віджети: з малими відступами
        вони налазили на рамку та її кути («два квадрати й рамка»). Відступ — під найтовщу можливу рамку
        (курсор / вибрана папка), тож при підсвітці нічого не зсувається."""
        sc = self.app.scaling()
        bw = max(NAV_MARK_W, border_width(True))
        i = int((bw + 4) * sc)
        if i == getattr(self, "_inset", None):
            return
        self._inset = i
        if self.tile:
            # кути: заокруглення 14 px — «⋯» і лічильник відсунуті від бічного краю далі за радіус, тоді зверху/знизу
            # досить відступу на товщину рамки (висота плитки лишається для назви)
            v = self._inset_v = int((bw + 1) * sc)
            corner = int(max(bw + 4, 16) * sc)
            self.dot_box.grid_configure(padx=(v + int(3 * sc), 0))
            self.more.grid_configure(padx=(0, corner), pady=(v, 0))
            self.label.grid_configure(padx=(int(6 * sc), v + int(2 * sc)))
            self.num.grid_configure(padx=(corner, int(6 * sc)), pady=(0, v))
        else:
            self.bar.grid_configure(padx=(i, 0), pady=max(10, i))
            self.dot.grid_configure(pady=max(6, i))
            self.label.grid_configure(pady=max(7, i))
            if self.more is not None:
                self.more.grid_configure(padx=(0, i))
            else:
                self.num.grid_configure(padx=(4, i))

    def set_size(self, height: int, wrap_px: int, font=None, width: int | None = None) -> None:
        """Лише для плиток: висота «квадрата», ширина переносу назви й шрифт (на сторінці вибору папки — більший).
        width — бажана ширина плитки (сторінка вибору папки); None — не змінювати."""
        font = font or self.app.pf.bold
        if font is not getattr(self, "_font", None):
            self._font = font
            self._size = None
            self.label.configure(font=font)
        # ширина й висота — ОДНИМ викликом і без перемальовування за старим розміром (див. _ctk_resize)
        w = width if width is not None and width != getattr(self, "_width", None) else None
        h = height if height != getattr(self, "_height", None) else None
        if w is not None or h is not None:
            _ctk_resize(self.row, w, h)
            if w is not None:
                self._width = w
            self._height = height
        wrap_px = max(40, wrap_px - int((self.SHAPE_BOX[0] + 8) * self.app.scaling()))   # ліворуч — фігура
        if (height, wrap_px) != getattr(self, "_size", None):
            self._size = (height, wrap_px)
            self.label.configure(wraplength=wrap_px, text=self._tile_text())

    def _tile_text(self) -> str:
        """Назва в плитці — не більше двох рядків (далі «…»), щоб не налазила на лічильник."""
        name = getattr(self, "_name", "") or ""
        size = getattr(self, "_size", None)
        if not size:
            return name
        font = getattr(self, "_font", None) or self.app.pf.bold
        per_line = max(6, int(size[1] / max(1, font.measure("n"))))
        # скільки рядків справді вміщається між «⋯» і лічильником: на низькому вікні з великим шрифтом (⚙ → «Розмір
        # назв папок») другий рядок обрізався навпіл — тоді лише один рядок і «…»
        try:
            sc = self.app.scaling()
            inset = getattr(self, "_inset_v", int(4 * sc))                # відступ від рамки (apply_inset)
            top = self.more.winfo_reqheight() + inset                     # зверху лише «⋯» (фігура — біля назви)
            room = size[0] * sc - top - inset - 2 * sc - self.num.winfo_reqheight()
            lines = max(1, min(2, int((room + 2) // max(1, font.metrics("linespace")))))
        except tk.TclError:
            lines = 2
        if lines == 1:                               # один рядок — міряємо точно (назви короткі, ≤ 30 символів)
            if font.measure(name) <= size[1]:
                return name
            n = len(name)
            while n > 1 and font.measure(name[:n - 1].rstrip() + "…") > size[1]:
                n -= 1
            return name[:n - 1].rstrip() + "…"
        return clip(name, per_line * lines - 2)

    def _enter(self) -> None:
        if not self.selected:
            self.hovering = True
            self.paint(self.hover)

    def _leave(self) -> None:
        if self.hovering:
            self.hovering = False
            if not self.selected:
                self.paint(self.fill)

    def paint(self, fill) -> None:
        self.cur = fill
        self.row.configure(fg_color=fill)
        bg = self.app.col(_eff(fill))
        for w in self.plain:
            w.configure(bg=bg)
        self._ink(fill)

    def mark(self, on: bool) -> None:
        """Клавіатурний «курсор» / ціль перетягування: жирна яскрава рамка, колір папки лишається свій
        (раніше вся папка заливалась синім — плутало)."""
        self.marked = bool(on)
        if on:
            self.row.configure(border_width=NAV_MARK_W, border_color=NAV_MARK)
        elif self.real:
            self.row.configure(border_width=border_width(self.selected),
                               border_color=ACCENT if self.selected else self.border)
        else:
            self.row.configure(border_width=0)

    def update(self, name: str, color: str, count: int, selected: bool, shape: str = "", border: str | None = None) -> None:
        a = self.app
        self.apply_inset()                     # товщину рамок могли змінити (⚙ → «Рамки»)
        sig = (name, color, count, selected, a._name_chars, shape, border)
        if sig == self.sig:
            return
        old = self.sig
        self.sig = sig
        if old is None or old[1] != color or old[6] != border:
            self.color, self.bcolor = color, border
            self.fill, self.hover, self.sel_fill, self.border = row_colors(color if self.real else None, border)
            a._row_fills[self.key] = (self.fill, self.sel_fill)
        if self.real and (old is None or old[5] != shape):
            self.dot.configure(text=shape or "●")
        if old is None or old[0] != name or old[4] != a._name_chars:
            self._name = name
            self.label.configure(text=self._tile_text() if self.tile else clip(name, a._name_chars))
        if old is None or old[2] != count:
            self.num.configure(text=str(count))
        self.selected = selected
        self.hovering = False if selected else self.hovering
        fill = self.sel_fill if selected else (self.hover if self.hovering else self.fill)
        self.cur = fill
        if old is None or old[1] != color or old[3] != selected or old[6] != border:   # configure ctk = перемалювання
            if self.real:
                self.row.configure(fg_color=fill, border_width=border_width(selected),
                                   border_color=ACCENT if selected else self.border)
            else:
                self.row.configure(fg_color=fill)
            if getattr(self, "marked", False):
                self.mark(True)                # перемальований рядок не губить рамку «курсора»
        self.colorize()

    def colorize(self) -> None:
        a = self.app
        bg = a.col(_eff(self.cur))
        self.bar.configure(bg=a.col(self.color if self.real else NEUTRAL))
        self._ink(self.cur)
        for w in self.plain:
            w.configure(bg=bg)

    def _ink(self, fill) -> None:
        """Колір тексту під фон: на дуже насиченому фоні назва, лічильник і фігура стають білими (або чорними)."""
        a = self.app
        fill = _eff(fill)
        self.label.configure(fg=a.col(ink(fill)))
        self.num.configure(fg=a.col(ink(fill, "meta")))
        self.dot.configure(fg=a.col(ink(fill) if self.real else self.color))   # фігура папки — чорна (або біла)
        if self.more is not None:
            self.more.configure(fg=a.col(ink(fill, "muted")))
        if self.more is not None:
            self.more.configure(fg=a.col(MUTED))

    def destroy(self) -> None:
        self.row.destroy()


class FormatRow:
    """Рядок формату в правій колонці (смужка, кружечок кольору, назва, опис, «⋯»). Залитий кольором формату
    (та сама рецептура, що в карток і папок); рядки можна перетягувати (міняти порядок)."""

    def __init__(self, app: "App", parent, fmt: dict):
        self.app, self.fid = app, fmt["id"]
        self.sig = None
        self.known = fmt.get("type") in FORMATTERS
        self.selected = False
        self.hovering = False
        self.fill = self.hover = self.border = None
        self.color = None
        self.cur = CARD
        pf, fid = app.pf, self.fid
        self.row = ctk.CTkFrame(parent, corner_radius=12, fg_color=CARD, border_width=1, border_color=CARD_BORDER,
                                cursor="hand2" if self.known else "arrow")
        self.row.grid_columnconfigure(2, weight=1)
        self.bar = tk.Frame(self.row, width=6, height=8)
        self.bar.grid(row=0, column=0, rowspan=2, sticky="ns", padx=(9, 0), pady=9)
        if self.known:
            self.swatch = app._swatch(self.row, fmt["color"], lambda: app.on_format_color(fid))
            app._swatches["fmt:" + fid] = self.swatch
        else:
            self.swatch = tk.Label(self.row, text="●", font=pf.body, width=2)
        self.swatch.grid(row=0, column=1, rowspan=2, padx=(9, 2))
        self.name = tk.Label(self.row, anchor="w", font=pf.card)
        self.name.grid(row=0, column=2, sticky="we", padx=(8, 4), pady=(8, 0))
        self.sub = tk.Label(self.row, anchor="w", font=pf.small)
        self.sub.grid(row=1, column=2, sticky="we", padx=(8, 4), pady=(0, 8))
        self.more = None
        if self.known:
            self.more = app._icon_button(self.row, "⋯", lambda e: app.show_format_menu(e.x_root, e.y_root, fid),
                                         bg_fn=lambda: app.col(self.cur))
            self.more.grid(row=0, column=3, rowspan=2, padx=(0, 6))
        self.plain = [w for w in (self.name, self.sub, self.more) if w is not None]
        if not self.known:
            self.plain.append(self.swatch)
        if self.known:
            parts = [self.row, self.bar, self.name, self.sub]
            app._bind_all(parts, "<ButtonPress-1>", lambda e: app._reorder_press("fmt", fid, e))
            app._bind_all(parts, "<B1-Motion>", lambda e: app._reorder_motion(e))
            app._bind_all(parts, "<ButtonRelease-1>", lambda e: app._reorder_release(e))
            app._bind_all(parts + [self.swatch, self.more], "<Button-3>",
                          lambda e: app.show_format_menu(e.x_root, e.y_root, fid))
            app._hoverable(self.row, parts + [self.swatch, self.more], self._enter, self._leave)

    def _enter(self) -> None:
        if not self.selected:
            self.hovering = True
            self.paint(self.hover)

    def _leave(self) -> None:
        if self.hovering:
            self.hovering = False
            if not self.selected:
                self.paint(self.fill)

    def paint(self, fill) -> None:
        self.cur = fill
        self.row.configure(fg_color=fill)
        self.colorize()

    def update(self, fmt: dict, selected: bool) -> None:
        sig = (fmt["name"], fmt["color"], fmt.get("type"), selected)
        if sig == self.sig:
            return
        self.sig = sig
        self.known = fmt.get("type") in FORMATTERS
        color = fmt["color"]
        self.color = color if self.known else None
        self.fill, self.hover, self.border = card_colors(color) if self.known else (CARD, CARD, CARD_BORDER)
        info = FORMAT_INFO.get(fmt.get("type"), ("Невідомий тип (з новішої версії програми)", ""))
        self.name.configure(text=clip(fmt["name"], 22))
        self.sub.configure(text=clip(info[0], 38))
        if self.known:
            self.swatch.configure(fg_color=color)
        self.selected = selected
        if selected:
            self.hovering = False
        self.row.configure(border_width=2 if selected else 1, border_color=ACCENT if selected else self.border)
        self.paint(self.hover if self.hovering else self.fill)
        self.colorize()

    def colorize(self) -> None:
        a = self.app
        self.bar.configure(bg=a.col(self.color or NEUTRAL))
        self.name.configure(fg=a.col(ink(self.cur) if self.known else FAINT))
        self.sub.configure(fg=a.col(ink(self.cur, "meta") if self.known else FAINT))
        if not self.known:
            self.swatch.configure(fg=a.col(NEUTRAL))
        bg = a.col(self.cur)
        for w in self.plain:
            w.configure(bg=bg)
        if self.more is not None:
            self.more.configure(fg=a.col(ink(self.cur, "muted")))

    def destroy(self) -> None:
        self.row.destroy()


class LibraryDialog(_Dialog):
    """«Додати з бібліотеки…»: усі джерела BioBib з пошуком; позначені додаються в підпапку.
    Результат: список id джерел або None."""

    def __init__(self, app: "App", sources: list[dict], already: set[int], title: str):
        super().__init__(app, title, 860, 640)
        self.sources, self.already = sources, already
        self.vars: dict[int, tk.BooleanVar] = {}
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        self.query = tk.StringVar()
        e = ctk.CTkEntry(card, textvariable=self.query, height=40, corner_radius=12, fg_color=INPUT,
                         border_color=PANEL_BORDER, font=app.f.dlg,
                         placeholder_text="Пошук: автор, назва, журнал, рік, DOI…")
        e.pack(fill="x", padx=18, pady=(16, 8))
        self.query.trace_add("write", lambda *a: self.fill())
        self.list = ScrollFrame(card, fg_color="transparent", corner_radius=0,
                                           scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.list.pack(fill="both", expand=True, padx=10)
        bottom = ctk.CTkFrame(card, fg_color="transparent")
        bottom.pack(fill="x", padx=18, pady=(8, 16))
        self.count = ctk.CTkLabel(bottom, text="", text_color=MUTED, font=app.f.body)
        self.count.pack(side="left")
        ctk.CTkButton(bottom, text="Додати позначені", width=170, height=40, corner_radius=12, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, font=app.f.dlg_bold, command=self.ok).pack(side="right")
        ctk.CTkButton(bottom, text="Скасувати", width=112, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.cancel
                      ).pack(side="right", padx=10)
        self.fill()
        self.after(120, e.focus_set)

    def fill(self) -> None:
        for w in self.list.winfo_children():
            w.destroy()
        q = self.query.get().strip().casefold()
        shown = [s_ for s_ in self.sources if not q or q in (s_["citation_dstu"] + " " + (s_.get("doi") or "")).casefold()]
        for s_ in shown:
            var = self.vars.setdefault(s_["id"], tk.BooleanVar(value=False))
            have = s_["id"] in self.already
            ctk.CTkCheckBox(self.list, text=("✓ уже в підпапці · " if have else "") + s_["citation_dstu"],
                            variable=var, font=self.app.f.body, text_color=MUTED if have else TEXT,
                            state="disabled" if have else "normal", checkbox_width=22, checkbox_height=22,
                            fg_color=ACCENT, hover_color=ACCENT_HOVER).pack(fill="x", anchor="w", padx=8, pady=4)
        self.count.configure(text=f"Джерел у бібліотеці: {len(self.sources)}" + (f" · знайдено {len(shown)}" if q else ""))

    def ok(self) -> None:
        self.result = [sid for sid, v in self.vars.items() if v.get() and sid not in self.already]
        self.destroy()


class LinksPage:
    """Вкладка «Посилання»: бібліотека джерел для дисертації (BioBib) — папки → підпапки (поки що два рівні)
    і джерела з готовими посиланнями за ДСТУ 8302:2015. Клік по джерелу копіює посилання (Alt + клік — ще й
    ховає програму). Повна бібліотека (форма джерела, PDF, нотатки, пошук) — у браузері: «Бібліотека в браузері»."""

    TILE_W, TILE_H = 250, 128

    def __init__(self, app: "App", parent):
        self.app = app
        self.path: list[int] = []                 # [] — корінь, [папка], [папка, підпапка]
        from biobib import config as bb_config, database as bb_db, sections as bb_sec
        self.sec, self.db = bb_sec, bb_db
        bb_config.configure(os.path.join(app.log_dir, "biobib"))
        self.error = ""
        try:
            bb_db.init_db()                      # «Дисертація» → «Актуальність» на першому запуску
        except Exception as ex:                  # noqa: BLE001 — показуємо на сторінці
            self.error = f"Не вдалося відкрити бібліотеку: {ex}"
        f = app.f
        self.frame = ctk.CTkFrame(parent, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        bar = ctk.CTkFrame(self.frame, fg_color="transparent")
        bar.pack(fill="x", padx=16, pady=(14, 4))
        self.crumbs = ctk.CTkFrame(bar, fg_color="transparent")
        self.crumbs.pack(side="left", fill="x", expand=True)
        self.btn_browser = ctk.CTkButton(bar, text="Бібліотека в браузері ↗", height=38, corner_radius=12,
                                         fg_color=BTN2, hover_color=BTN2_HOVER, text_color=TEXT, font=f.body,
                                         command=self.open_browser)
        self.btn_browser.pack(side="right")
        self.btn_bib = ctk.CTkButton(bar, text="Копіювати список літератури", height=38, corner_radius=12,
                                     fg_color=BTN2, hover_color=BTN2_HOVER, text_color=TEXT, font=f.body,
                                     command=self.copy_bibliography)
        self.btn_lib = ctk.CTkButton(bar, text="Додати з бібліотеки…", height=38, corner_radius=12, fg_color=BTN2,
                                     hover_color=BTN2_HOVER, text_color=TEXT, font=f.body,
                                     command=self.attach_from_library)
        self.btn_new = ctk.CTkButton(bar, text="＋ Папка", height=38, corner_radius=12, fg_color=ACCENT,
                                     hover_color=ACCENT_HOVER, font=f.bold, command=self.add)
        self.hint = ctk.CTkLabel(self.frame, text="", anchor="w", justify="left", text_color=MUTED, font=f.body)
        self.hint.pack(fill="x", padx=20, pady=(2, 4))
        self.body = ScrollFrame(self.frame, fg_color="transparent", corner_radius=0,
                                           scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.body.pack(fill="both", expand=True, padx=8, pady=(0, 10))
        self.items: list = []                     # (тип, id, фрейм) показаних плиток/карток — для тестів і меню
        self.root_frame_focus = app.root.bind("<FocusIn>", lambda e: self._maybe_refresh(e), add="+")

    # -- дані --------------------------------------------------------------------------------------------
    def conn(self):
        """Підключення до БД бібліотеки, що закривається після with-блоку (зміни комітять самі функції)."""
        from contextlib import closing
        return closing(self.db.get_connection())

    def _maybe_refresh(self, e) -> None:
        """Повернулись у вікно (наприклад, після браузера) — перечитуємо поточний розділ."""
        if self.app.tab == "links" and e.widget is self.app.root and \
                time.monotonic() - getattr(self, "_last_refresh", 0.0) > 1.5:
            self.refresh()

    def level(self) -> int:
        return len(self.path)

    def current(self) -> dict | None:
        if not self.path:
            return None
        with self.conn() as c:
            return self.sec.get_section(c, self.path[-1])

    def title(self) -> str:
        cur = self.current()
        return cur["title"] if cur else "Посилання"

    def count_text(self) -> str:
        return str(len(self.items))

    def go(self, path: list[int]) -> None:
        self.path = list(path)
        self.refresh()

    def escape(self):
        if self.path:
            self.go(self.path[:-1])
        else:
            self.app.set_tab("clip")
        return "break"

    # -- побудова сторінки ------------------------------------------------------------------------------
    def refresh(self) -> None:
        a = self.app
        self._last_refresh = time.monotonic()
        try:
            with self.conn() as c:
                path_secs = [self.sec.get_section(c, sid) for sid in self.path]
                if any(p is None for p in path_secs):              # розділ видалили (наприклад, у браузері)
                    self.path, path_secs = [], []
                subs = self.sec.list_sections(c, self.path[-1] if self.path else None) if self.level() < 2 else []
                srcs = self.sec.sources_in(c, self.path[-1]) if self.path else []
        except Exception as ex:                                       # noqa: BLE001
            subs, srcs, path_secs = [], [], []
            self.error = self.error or f"Помилка бібліотеки: {ex}"
        for w in self.crumbs.winfo_children():
            w.destroy()
        trail = [("Посилання", [])] + [(p["title"], self.path[:n + 1]) for n, p in enumerate(path_secs)]
        for n, (name, path) in enumerate(trail):
            if n:
                tk.Label(self.crumbs, text="›", font=a.pf.title, bg=a.col(PANEL), fg=a.col(MUTED)).pack(side="left",
                                                                                                    padx=4)
            last = n == len(trail) - 1
            ctk.CTkButton(self.crumbs, text=name, height=36, corner_radius=10, font=a.f.bold,
                          fg_color=ACCENT_SOFT if last else "transparent", hover_color=BTN2,
                          text_color=TEXT, width=40, command=lambda p=path: self.go(p)).pack(side="left")
        lvl = self.level()
        for b in (self.btn_new, self.btn_lib, self.btn_bib):
            b.pack_forget()
        if lvl < 2:
            self.btn_new.configure(text="＋ Папка" if lvl == 0 else "＋ Підпапка")
            self.btn_new.pack(side="right", padx=(0, 8))
        if lvl >= 1:
            if srcs:
                self.btn_bib.pack(side="right", padx=(0, 8))
            self.btn_lib.pack(side="right", padx=(0, 8))
        if lvl == 2:
            self.btn_new.configure(text="＋ Джерело")
            self.btn_new.pack(side="right", padx=(0, 8))
        for w in self.body.winfo_children():
            w.destroy()
        self.items = []
        cols = 4
        for c_ in range(cols):
            self.body.grid_columnconfigure(c_, weight=1, uniform="lt")
        row = 0
        for n, sec in enumerate(subs):
            self._tile(sec, n, row + n // cols, n % cols)
        row += (len(subs) + cols - 1) // cols
        for n, src in enumerate(srcs, 1):
            self._source_card(src, n, row)
            row += 1
        if self.error:
            hint = self.error
        elif lvl == 0:
            hint = "Папки бібліотеки. Клік — відкрити папку · правий клік — перейменувати, порядок, видалити."
        elif lvl == 1:
            hint = ("Підпапки (поки що можна створювати лише їх). Клік — відкрити підпапку." +
                    (" Нижче — джерела, додані прямо в папку." if srcs else ""))
        else:
            hint = ("Клік по джерелу — копіювати посилання за ДСТУ 8302:2015 · Alt + клік — копіювати й сховати · "
                    "правий клік — ще дії." if srcs else
                    "Джерел ще немає: «＋ Джерело» відкриває форму в браузері (з цією підпапкою), «Додати з "
                    "бібліотеки…» — вибрати з уже доданих.")
        self.hint.configure(text=hint)
        a._sync_title()

    def _tile(self, sec: dict, n: int, r: int, c_: int) -> None:
        a = self.app
        color = PALETTE[n % len(PALETTE)] if self.level() == 0 else PALETTE[(n + 3) % len(PALETTE)]
        fill, hover, _sel, border = row_colors(color)
        fr = ctk.CTkFrame(self.body, width=self.TILE_W, height=self.TILE_H, corner_radius=18, fg_color=fill,
                          border_width=border_width(), border_color=border, cursor="hand2")
        fr.grid(row=r, column=c_, padx=6, pady=6, sticky="ew")
        fr.pack_propagate(False)
        bg = a.col(fill)
        inner = tk.Frame(fr, bg=bg)
        inner.place(relx=0, rely=0.5, anchor="w", x=int(16 * a.scaling()), relwidth=0.86)
        shape = tk.Label(inner, text=SHAPES[(sec["id"] * 7) % len(SHAPES)], font=a.pf.shape_big, bg=bg,
                         fg=a.col(ink(fill)))
        shape.pack(side="left", padx=(0, 10))
        txt = tk.Frame(inner, bg=bg)
        txt.pack(side="left", fill="x", expand=True)
        name = tk.Label(txt, text=sec["title"], font=a.pf.card, bg=bg, fg=a.col(ink(fill)), anchor="w", justify="left",
                        wraplength=int((self.TILE_W - 90) * a.scaling()))
        name.pack(fill="x")
        with self.conn() as c:
            n_sub = len(self.sec.list_sections(c, sec["id"])) if self.level() == 0 else 0
        meta = (f"підпапок: {n_sub} · " if self.level() == 0 else "") + f"джерел: {sec['count']}"
        info = tk.Label(txt, text=meta, font=a.pf.meta, bg=bg, fg=a.col(ink(fill, "meta")), anchor="w")
        info.pack(fill="x")
        parts = [fr, inner, shape, txt, name, info]
        for w in parts:
            w.bind("<Button-1>", lambda e, sid=sec["id"]: self.go(self.path + [sid]))
            w.bind("<Button-3>", lambda e, s_=sec: self._section_menu(e, s_))
        self.items.append(("section", sec["id"], fr))

    def _source_card(self, src: dict, n: int, r: int) -> None:
        a = self.app
        fill, hover, border = card_colors(None)
        fr = ctk.CTkFrame(self.body, corner_radius=14, fg_color=fill, border_width=border_width(),
                          border_color=border, cursor="hand2")
        fr.grid(row=r, column=0, columnspan=4, padx=6, pady=4, sticky="ew")
        bg = a.col(fill)
        num = tk.Label(fr, text=f"{n}.", font=a.pf.card, bg=bg, fg=a.col(MUTED), width=3, anchor="e")
        num.pack(side="left", padx=(12, 6), pady=12)
        lbl = tk.Label(fr, text=src["citation_dstu"], font=a.pf.phrase, bg=bg, fg=a.col(TEXT), anchor="w",
                       justify="left", wraplength=int(900 * a.scaling()), cursor="hand2")
        lbl.pack(side="left", fill="x", expand=True, padx=(0, 14), pady=12)
        for w in (fr, num, lbl):
            w.bind("<Button-1>", lambda e, s_=src, f_=fr: self.copy_source(s_, bool(e.state & ALT_MASK), f_))
            w.bind("<Button-3>", lambda e, s_=src, i=n: self._source_menu(e, s_, i))
        self.items.append(("source", src["id"], fr))

    # -- дії -----------------------------------------------------------------------------------------------
    def copy_source(self, src: dict, hide: bool = False, frame=None) -> None:
        text = src["citation_dstu"]
        self.app.copy_to_clipboard(text)
        if frame is not None:
            try:
                fl = tk.Label(frame, text="✓  Скопійовано", font=self.app.pf.bold, fg="#ffffff",
                              bg=self.app.col(COPIED))
                fl.place(relx=0, rely=0, relwidth=1, relheight=1)
                fl.after(550, fl.destroy)
            except tk.TclError:
                pass
        self.app._finish_pick("✓ Скопійовано посилання: " + clip(text, 70), hide=hide)

    def add(self) -> None:
        """Кнопка «＋» / «＋ Додати»: на корені — папка, у папці — підпапка, у підпапці — джерело (браузер)."""
        lvl = self.level()
        if lvl == 2:
            self.open_browser(new=True)
            return
        name = TextDialog(self.app, "Нова папка" if lvl == 0 else "Нова підпапка",
                          "Назва папки:" if lvl == 0 else "Назва підпапки:").run()
        if not name or not name.strip():
            return
        with self.conn() as c:
            made = self.sec.create_section(c, name, self.path[-1] if self.path else None)
        if made:
            self.app.set_status(f"✓ Створено: {made['path']}", 3000)
        self.refresh()

    def _section_menu(self, e, sec: dict) -> None:
        a = self.app
        m = a._new_menu()
        m.add_command("Відкрити", lambda: self.go(self.path + [sec["id"]]), icon="▸")
        m.add_command("Перейменувати…", lambda: self.rename(sec), icon="✎")
        m.add_command("Перемістити вгору", lambda: self.move(sec, -1), icon="↑")
        m.add_command("Перемістити вниз", lambda: self.move(sec, 1), icon="↓")
        m.add_command("Відкрити в браузері", lambda: self.open_browser(section=sec["id"]), icon="↗")
        m.add_separator()
        m.add_command("Видалити…", lambda: self.delete(sec), danger=True, icon="✕")
        a._popup(m, e.x_root, e.y_root)

    def rename(self, sec: dict) -> None:
        name = TextDialog(self.app, "Перейменувати", "Нова назва:", sec["title"]).run()
        if name and name.strip():
            with self.conn() as c:
                self.sec.rename_section(c, sec["id"], name)
            self.refresh()

    def move(self, sec: dict, delta: int) -> None:
        with self.conn() as c:
            self.sec.move_section(c, sec["id"], delta)
        self.refresh()

    def delete(self, sec: dict) -> None:
        if messagebox.askyesno(APP_NAME, f"Видалити «{sec['title']}» разом із підпапками?\n"
                                         "Самі джерела лишаться в бібліотеці.", parent=self.app.root):
            with self.conn() as c:
                self.sec.delete_section(c, sec["id"])
            self.refresh()

    def _source_menu(self, e, src: dict, n: int) -> None:
        a = self.app
        m = a._new_menu()
        m.add_command("Копіювати посилання (ДСТУ 8302)", lambda: self.copy_source(src), icon="⧉")
        m.add_command(f"Копіювати посилання в тексті [{n}]", lambda: self._copy_plain(f"[{n}]"), icon="#")
        m.add_command("Відкрити в бібліотеці (браузер)", lambda: self.open_browser(section=self.path[-1]), icon="↗")
        m.add_command("Вгору", lambda: self.move_source(src, -1), icon="↑")
        m.add_command("Вниз", lambda: self.move_source(src, 1), icon="↓")
        m.add_separator()
        m.add_command("Прибрати з підпапки", lambda: self.detach(src), danger=True, icon="✕")
        a._popup(m, e.x_root, e.y_root)

    def _copy_plain(self, text: str) -> None:
        self.app.copy_to_clipboard(text)
        self.app.set_status(f"✓ Скопійовано: {text}", 3000)

    def move_source(self, src: dict, delta: int) -> None:
        with self.conn() as c:
            self.sec.move_source(c, src["id"], self.path[-1], delta)
        self.refresh()

    def detach(self, src: dict) -> None:
        with self.conn() as c:
            self.sec.detach(c, src["id"], self.path[-1])
        self.refresh()
        self.app.set_status("Джерело прибрано з підпапки (у бібліотеці воно лишилось)", 4000)

    def attach_from_library(self) -> None:
        if not self.path:
            return
        with self.conn() as c:
            allsrc = self.sec.all_sources(c)
            have = {s_["id"] for s_ in self.sec.sources_in(c, self.path[-1])}
        if not allsrc:
            self.app.set_status("Бібліотека порожня — додайте джерело («＋ Джерело» або «Бібліотека в браузері»)", 6000)
            return
        ids = LibraryDialog(self.app, allsrc, have, f"Додати в «{self.title()}»").run()
        if ids:
            with self.conn() as c:
                for sid in ids:
                    self.sec.attach(c, sid, self.path[-1])
            self.app.set_status(f"✓ Додано джерел: {len(ids)}", 3000)
        self.refresh()

    def copy_bibliography(self) -> None:
        if not self.path:
            return
        with self.conn() as c:
            text = self.sec.bibliography(c, self.path[-1])
        if text:
            self.app.copy_to_clipboard(text)
            self.app.show_toast(f"✓ Скопійовано список літератури ({len(text.splitlines())})")

    def open_browser(self, new: bool = False, section: int | None = None) -> None:
        """Повна бібліотека BioBib у браузері (сервер стартує тут, у фоні, лише на вимогу)."""
        import webbrowser
        a = self.app
        a.set_status("Запускаю бібліотеку…", 3000)
        a.root.update_idletasks()
        try:
            from biobib import server as bb_server
            url = bb_server.ensure_running()
        except Exception as ex:                                       # noqa: BLE001
            a._report_exception(*sys.exc_info())
            messagebox.showerror(APP_NAME, f"Не вдалося запустити бібліотеку в браузері:\n{ex}", parent=a.root)
            return
        sid = section if section is not None else (self.path[-1] if self.path else None)
        q = []
        if sid is not None:
            q.append(f"section={sid}")
        if new:
            q.append("new=1")
        full = url + ("?" + "&".join(q) if q else "")
        self.last_url = full
        if not getattr(a, "_no_browser", False):
            webbrowser.open(full)
        a.set_status("Бібліотека відкрита в браузері: " + url + "  ·  після змін поверніться сюди — сторінка оновиться",
                     8000)


class WakeQueue(queue.Queue):
    """Черга подій, що будить цикл Tk відразу після put() з іншого потоку (гаряча клавіша, трей,
    друга копія програми). Жодного постійного опитування: у фоні немає зайвих пробуджень, а реакція
    миттєва. Якщо розбудити не вдалося (цикл ще не запущено), повільне опитування підстрахує."""

    root = None

    def put(self, item, block: bool = True, timeout=None) -> None:
        super().put(item, block, timeout)
        r = self.root
        if r is not None:
            try:
                r.event_generate("<<CMEvents>>", when="tail")
            except Exception:       # RuntimeError (цикл не запущено), TclError (вікно знищено)
                pass


# --------------------------------------------------------------------------- #
#  Головне вікно
# --------------------------------------------------------------------------- #

class _Fonts:
    def __init__(self):
        mk = lambda size, weight="normal": ctk.CTkFont(family=FONT, size=size, weight=weight)  # noqa: E731
        self.body = mk(13)
        self.small = mk(11)
        self.tiny = mk(10)
        self.bold = mk(13, "bold")
        self.title = mk(17, "bold")
        self.caps = mk(10, "bold")
        self.icon = mk(15, "bold")
        self.dlg = mk(14)                 # діалоги: крупніше й зручніше
        self.dlg_bold = mk(14, "bold")
        self.card = mk(15, "bold")        # текст самого копіпасту
        self.meta = mk(12)                # дата і довжина під записом
        self.phrase = mk(15)              # текст швидких фраз
        self.big = mk(16, "bold")         # великі кнопки (Об'єднати і копіювати)
        self.mono = ctk.CTkFont(family=MONO, size=12)


def _append_log(directory: str, name: str, text: str) -> None:
    """Дописує в <directory>/<name>; при > LOG_LIMIT старий файл відкладається в *.1 (розмір обмежений).
    Ніколи не кидає винятків: журнал не повинен ламати програму."""
    try:
        os.makedirs(directory, exist_ok=True)
        path = os.path.join(directory, name)
        try:
            if os.path.getsize(path) > LOG_LIMIT:
                os.replace(path, path + ".1")
        except OSError:
            pass
        with open(path, "a", encoding="utf-8") as f:
            f.write(text if text.endswith("\n") else text + "\n")
    except Exception:
        pass


def _lazy_fmt(name: str) -> property:
    """Властивість, що будує область введення форматування при першому зверненні."""
    def getter(self):
        if not self._fmt_built:
            self._ensure_fmt()
        return getattr(self, "_" + name)
    return property(getter)


class App:
    def __init__(self, root: ctk.CTk, preset: Preset, history: History, settings: Settings,
                 events: "queue.Queue[str]", use_hotkey: bool = True, use_tray: bool = True,
                 start_hidden: bool = False, relaunch_ok: bool = False):
        _mark("app_init_start")
        self._grown = None                  # (папка, лінза) — збільшена копія плитки під «курсором» (поверх сітки)
        self._lens = None                   # SideRow-копія плитки; сама плитка в сітці не змінюється
        self._lens_geo = None
        self._grow_job = None
        self._clens = None                  # Card-копія вибраного запису (на 15 % більша, поверх списку)
        self._clens_geo = None
        self._clens_job = None
        self.root = root
        self.preset = preset
        self.history = history
        self.settings = settings
        set_saturation(settings["sat_cards"] / 100, settings["sat_folders"] / 100)
        set_border(settings["border_w"], settings["border_glow"] / 100)
        self.events = events
        self.view: str = HISTORY            # HISTORY або id категорії
        self.sel_id: str | None = None
        self.shown: list[dict] = []
        self.limit = PAGE
        self._modal = 0
        self._hidden = False                # вікно сховане (withdraw): малюємо у фоні, показ лишається миттєвим
        self._dirty = False                 # дані змінились, поки вікно було сховане
        self._dirty_top = False
        self._flush_job: str | None = None
        self.render_count = 0               # скільки разів перебудовувався список карток (для тестів/виміру)
        self.sidebar_render_count = 0
        self._last_toggle = 0.0
        self.sel_format: str | None = None  # вибраний формат у правій колонці
        self._card_border: dict[str, tuple] = {}
        self._last_seen: str | None = None
        self._clip_seq: int | None = None   # номер вмісту буфера (Windows): без змін — буфер не відкриваємо
        self._last_query = ""
        self._search_text = ""                 # внутрішній фільтр (поля пошуку в інтерфейсі немає)
        self.nav_zone = "cards"                # клавіатурна навігація: "folders" (ліва колонка) або "cards" (записи)
        self.nav_cat: str | None = None        # папка під «курсором» у зоні папок
        self._cell_of: dict[str, tuple[int, int]] = {}     # плитка → клітинка (рядок, колонка) у сітці папки
        self._cell_taken: dict[tuple[int, int], str] = {}
        self._cell_ph: dict[tuple[int, int], tk.Frame] = {}  # рамки порожніх клітинок
        self.nav_right: tuple | None = None    # пункт правої колонки під «курсором»: ("fmt", id) | ("phr", id) | ("head", None)
        self._nav_prev: tuple = ("cards", None)   # звідки прийшли в праву колонку (зона, папка під курсором)
        self._last_cat: str | None = None
        self._status_job: str | None = None
        self._search_job: str | None = None
        self._wrap_labels: list[tk.Label] = []
        self._cards: dict[str, ctk.CTkFrame] = {}      # id → фрейм картки (для тестів/сумісності)
        self._card_objs: dict[str, Card] = {}
        self._packed: list[str] = []                   # порядок карток у pack
        self._todo: list[dict] = []                    # картки, які ще не створено (малюються порціями)
        self._order: list[str] = []                    # бажаний порядок id у поточному списку
        self._chunk_job: str | None = None
        self._more_btn: ctk.CTkButton | None = None
        self._empty_box: ctk.CTkFrame | None = None
        self._row_keys: dict[tk.Widget, str] = {}
        self._rows: dict[str, ctk.CTkFrame] = {}
        self._row_objs: dict[str, SideRow] = {}
        self._row_order: list[str] = []
        self._row_fills: dict[str, tuple] = {}
        self._fmt_rows: dict[str, FormatRow] = {}
        self._fmt_order: list[str] = []
        self._fmt_heights = (72, 74)
        self._fit_job: str | None = None
        self._finish_pending = False
        self._cat_hint: tk.Label | None = None
        self._swatches: dict[str, ctk.CTkFrame] = {}     # кружечки-кнопки кольору: id категорії / формату
        self._drag: dict | None = None
        self._left_w, self._right_w = LEFT_W, RIGHT_W
        self._name_chars = 18               # скільки символів назви категорії вміщується в рядок
        self._mid_w = 600
        self._wrap = 330
        self._wrap_job: str | None = None
        self._card_pad = 6                  # бокові поля карток (на широкому екрані центрують обмежену колонку)
        self._maximized = False             # ми розгорнули вікно (на show) і маємо його повернути до звичайного
        self.maximize_count = 0             # скільки разів просили розгорнути (для тестів)
        self._max_ts = 0.0
        self._size: tuple[int, int] | None = None
        self._icon = None
        self._first_map_done = False
        self._tick_marked = False
        self._themed: list[tuple] = []     # (проста мітка, фон, колір тексту) — для зміни теми
        self._fmt_built = False            # область введення форматування будується при першому виборі формату
        self._hold_chunks = True            # на старті порції карток чекають, поки вікно буде показано
        self.menu: MenuModel | None = None  # останнє показане меню (для тестів)
        self._popups: list[PopupMenu] = []
        self.checked: set[str] = set()      # відмічені галочками записи історії (для «Об'єднати і копіювати»)
        self.armed_src: str | None = None   # що «заряджено» для Append: "format" | "refund"
        self.append_armed = False           # режим Append: наступний клік по запису допише результат формату
        self._rd: dict | None = None        # перетягування рядка категорії/формату (перестановка)
        self._indicators: dict = {}         # індикатори місця вставки (по контейнерах)
        self._hotkey_tries = 0
        self.relaunch_ok = relaunch_ok      # є ще один шлях назад: повторний запуск exe показує вікно
        self.log_dir = os.path.dirname(os.path.abspath(settings.path))
        self._log_buf: list[str] = []
        self._log_job: str | None = None
        self.tray = None
        self.hotkey_ok = False
        self._use_hotkey, self._use_tray = use_hotkey, use_tray
        self._dark = ctk.get_appearance_mode() == "Dark"
        root.report_callback_exception = self._report_exception     # винятки в обробниках Tk → error.log
        self.f = _Fonts()
        self._make_pfonts()
        startup_hidden = root.state() == "withdrawn"       # main() будує вікно схованим і показує вже готовим
        self._hidden = bool(start_hidden)

        root.title(APP_NAME)
        root.geometry(f"{settings['width']}x{settings['height']}")
        root.minsize(1040, 520)
        root.configure(fg_color=BG)
        root.attributes("-topmost", settings["topmost"])
        if os.name == "nt":
            self.apply_icon_to(root)        # .ico з кешу — майже безкоштовно; ставимо ДО першого показу
        # режим «спочатку папка»: сторінка "folders" (лише плитки папок) → "records" (записи папки, «Назад» / Esc)
        self.folder_first = bool(settings["folder_first"])
        self.page = "folders"
        self.cat_tiles = settings["cat_view"] == "tiles" or self.folder_first   # папки плитками (у режимі папок — завжди)
        self.rec_tiles = settings["rec_view"] == "tiles"       # копіпасти плитками
        self._left_user = int(settings["left_w"] or 0)          # ширина лівої колонки від користувача (0 — авто)
        self._cat_cols = 2
        self._cat_sig = None
        self._rec_cols, self._rec_tile_h, self._rec_sig = 1, 140, None
        self._plan_layout(int(settings["width"] * self.scaling()))   # ширини колонок/переносів — одразу остаточні

        self._build_ui()
        self._apply_page()
        DPI_HOOKS[root] = (self._reset_cards, self._check_scaling)   # див. _debounced_dpi_check
        if self.folder_first:                  # старт — на сторінці вибору папки, «курсор» на поточній папці
            self.nav_zone, self.nav_cat = "folders", self.view
        self._update_title()
        self._init_tags()
        # Прив'язка root.bind("<Configure>") успадковується КОЖНИМ дочірнім віджетом (≈500 викликів на кожен
        # прохід розкладки). Власний bindtag є лише в кореня — обробник викликається лише для самого вікна.
        root.bindtags(("CMRoot",) + root.bindtags())
        root.bind_class("CMRoot", "<Configure>", self._on_root_configure)
        root.bind_class("CMRoot", "<Map>", self._on_first_map)
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        _mark("ui_built")
        root.update_idletasks()             # розкладка під ХОВАНИМ вікном: висоти полотен відомі до першого малювання
        self._render_now()
        _mark("first_render")

        self.hotkeys = HotkeyListener(events)
        self.local_keys = LocalKeys(events)  # Alt+Space, поки вікно програми активне (інакше Windows відкриває меню вікна)
        self._picker = None                 # відкрите вікно вибору (конструктор / аппенди) — йому Alt+Space та Alt+A
        history.lazy = True                 # запис історії — з таймера, а не на кожне копіювання
        if isinstance(events, WakeQueue):
            events.root = root
            root.bind("<<CMEvents>>", lambda e: self._drain_events(), add="+")
        if start_hidden:                    # вікна не буде: гарячу клавішу й трей можна підняти одразу
            self._late_init(sync_tray=True)
            if self._can_hide():
                root.withdraw()
                self._hidden = True
            else:
                self._hidden = False
                self._reveal_startup(startup_hidden)
        else:
            self._reveal_startup(startup_hidden)
            root.after(30, self._late_init)
        self._hold_chunks = False           # вікно вже показано — дороблюємо решту карток порціями
        if self._todo and self._chunk_job is None:
            self._chunk_job = root.after(1, self._chunk_step)
        self._poll_events()
        root.after(250, self._tick)
        self._start_watchdog()

    # -- сторож зависання: якщо цикл подій Tk мовчить > 4 с, у error.log потрапляє, ЩО саме робив головний потік --
    def _start_watchdog(self) -> None:
        self._beat = time.monotonic()
        main_id = threading.get_ident()

        def watch() -> None:
            reported = False
            while True:
                time.sleep(2.0)
                lag = time.monotonic() - self._beat
                if lag > 4.0 and not reported:
                    reported = True
                    frame = sys._current_frames().get(main_id)
                    stack = "".join(traceback.format_stack(frame)) if frame else "(немає стеку)"
                    _append_log(self.log_dir, "error.log",
                                f"=== {time.strftime('%Y-%m-%d %H:%M:%S')} ІНТЕРФЕЙС НЕ ВІДПОВІДАЄ {lag:.1f} с. "
                                f"Головний потік зараз:\n{stack}")
                elif lag <= 4.0:
                    reported = False

        threading.Thread(target=watch, name="cm-watchdog", daemon=True).start()

    # -- запуск: показ готового вікна і відкладені ініціалізації -------------------------
    def _reveal_startup(self, was_hidden: bool) -> None:
        """Вікно було сховане на час побудови: показуємо його, коли розкладку вже обчислено — без
        «збирання» на очах, без стрибка розміру. Для звичайного (видимого) root — нічого не робимо."""
        if not was_hidden:
            return
        fade = os.name == "nt"
        try:
            self.root.update()              # CTk.update: позначає, що вікно «існує» (інакше ctk сховає його ще раз)
            if fade:
                self.root.attributes("-alpha", 0.0)
            self.root.deiconify()
            if fade:
                self.root.update_idletasks()
                self.root.attributes("-alpha", 1.0)
        except tk.TclError:
            pass
        _mark("revealed")

    def _on_first_map(self, event) -> None:
        if event.widget is self.root and not self._first_map_done:
            self._first_map_done = True
            _mark("first_map")
            self.root.after_idle(self._sync_scrollbars)     # тепер висоти відомі — точне виправлення смуг

    def _late_init(self, sync_tray: bool = False) -> None:
        """Усе, що не потрібне для першого малювання: гаряча клавіша, трей (у фоновому потоці), іконка."""
        if self._use_hotkey:
            self.apply_hotkey(announce=False)
        try:
            self.local_keys.start()
        except Exception as ex:             # без цього Alt+Space просто лишиться за Tk (як раніше)
            self.log(f"local keys failed: {ex!r}")
        if self._use_tray:
            if sync_tray:
                self.tray = start_tray(self.events, APP_NAME)
            else:
                import threading

                def make_tray() -> None:
                    self.tray = start_tray(self.events, APP_NAME)
                    _append_log(self.log_dir, "app.log", f"{time.strftime('%H:%M:%S')} tray started: {bool(self.tray)}")

                threading.Thread(target=make_tray, daemon=True).start()
        if os.name != "nt":
            self.apply_icon_to(self.root)
        if not self._hidden:
            self._announce_hotkey()
        self.log(f"late_init hotkey_ok={self.hotkey_ok} tray_requested={self._use_tray} relaunch_ok={self.relaunch_ok} "
                 f"autohide={self.settings['autohide']} can_hide={self._can_hide()}")
        _mark("late_init_done")

    # -- допоміжне ---------------------------------------------------------
    def scaling(self) -> float:
        try:
            return float(self.root._get_window_scaling())
        except Exception:
            return 1.0

    def col(self, c) -> str:
        """Колір для ПРОСТИХ tk-віджетів: ctk-кортеж (світла, темна) → рядок для поточної теми."""
        if isinstance(c, str):
            return c
        return c[1] if self._dark else c[0]

    def _make_pfonts(self) -> None:
        """Шрифти для простих tk-міток (розмір у фізичних пікселях з урахуванням масштабу екрана)."""
        s = self._pf_scale = self.scaling()
        spec = dict(body=(13, "normal"), small=(11, "normal"), tiny=(10, "normal"), bold=(13, "bold"),
                    caps=(10, "bold"), icon=(15, "bold"), card=(15, "bold"), meta=(12, "normal"), phrase=(14, "normal"),
                    title=(17, "bold"), menu=(14, "normal"), pick=(self._pick_font_size(), "bold"),
                    shape=(25, "normal"), shape_big=(30, "normal"), card_shape=(21, "normal"), badge=(11, "bold"))
        old = getattr(self, "pf", None)
        if old is not None:             # зміна масштабу: розмір шрифтів міняється НА МІСЦІ — усі віджети оновлюються самі
            for name, (size, _) in spec.items():
                getattr(old, name).configure(size=-max(1, round(size * s)))
            return
        self.pf = SimpleNamespace(**{n: tkfont.Font(root=self.root, family=FONT, size=-max(1, round(sz * s)),
                                                    weight=w) for n, (sz, w) in spec.items()})

    def set_color_level(self, level: int) -> None:
        """⚙ → «Насиченість кольорів»: наскільки сильно картки, папки й фрази залиті своїм кольором."""
        set_color_level(level)
        self._save_colors()
        self._recolor()
        self.set_status(f"Насиченість кольорів: {COLOR_LEVEL_NAMES[_COLOR_LEVEL[0]].lower()}", 3000)

    def set_border_level(self, level: int) -> None:
        """⚙ → «Рамки»: товщина й соковитість рамок карток і папок."""
        set_border_level(level)
        self._save_colors()
        self._recolor()
        self.set_status(f"Рамки: {BORDER_LEVEL_NAMES[_BORDER_LEVEL[0]].lower()}", 3000)

    def set_saturation(self, cards: float | None = None, folders: float | None = None) -> None:
        """Точна насиченість (0…1) записів і/або папок (⚙ → «Кольори й рамки…»)."""
        set_saturation(cards, folders)
        self._save_colors()
        self._recolor()

    def set_border(self, width: int | None = None, glow: float | None = None) -> None:
        """Точні рамки: товщина 1…6 px і яскравість 0…1 (⚙ → «Кольори й рамки…»)."""
        set_border(width, glow)
        self._save_colors()
        self._recolor()

    def _save_colors(self) -> None:
        self.settings["sat_cards"] = round(_SAT[0] * 100)
        self.settings["sat_folders"] = round(_SAT[1] * 100)
        self.settings["border_w"] = int(_BORDER[0])
        self.settings["border_glow"] = round(_BORDER[1] * 100)

    def on_colors_dialog(self) -> None:
        ColorsDialog(self).run()

    def _recolor(self) -> None:
        for obj in self._row_objs.values():
            obj.sig = None                                  # рядки папок перерахують кольори
        self.render()
        self.flush_render()
        self._render_phrases()

    def on_folder_shapes(self) -> None:
        FolderShapesDialog(self).run()
        for obj in self._row_objs.values():
            obj.sig = None
        self.render()

    def on_category_shape(self, cat_id: str) -> None:
        cat = self.preset.category(cat_id)
        if not cat:
            return
        shape = ShapeDialog(self, f"Фігура папки «{clip(cat['name'], 20)}»", cat.get("shape")).run()
        if shape and self.preset.set_category_shape(cat_id, shape):
            self.render()
            self.set_status(f"✓ Фігура папки: {shape}", 3000)

    def _pick_font_size(self) -> float:
        try:
            return max(10.0, min(30.0, float(self.settings["pick_font"])))
        except (TypeError, ValueError, KeyError):
            return 16.5

    def set_pick_font(self, size: float) -> None:
        """Розмір назв папок на сторінці вибору папки (⚙ → «Розмір назв папок»)."""
        size = max(10.0, min(30.0, float(size)))
        self.settings["pick_font"] = size
        self.v_pick_font.set(f"{size:g}")
        self.pf.pick.configure(size=-max(1, round(size * self.scaling())))
        for obj in self._row_objs.values():
            if getattr(obj, "tile", False):
                obj._size = None                     # назва переноситься/обрізається під новий розмір
        self._cat_sig = None
        self._arrange_cats()
        self.set_status(f"Розмір назв папок: {size:g}", 3000)

    def _label(self, parent, text: str, bg, fg, font, **kw) -> tk.Label:
        """Проста tk-мітка (≈0,4 мс замість ≈1,9 мс у ctk) з реєстрацією для перефарбування при зміні теми."""
        lbl = tk.Label(parent, text=text, bg=self.col(bg), fg=self.col(fg), font=font, **kw)
        self._themed.append((lbl, bg, fg))
        return lbl

    def _set_dark(self, dark: bool) -> None:
        """Змінилась тема: ctk перемальовує свої віджети сам, прості tk-віджети перефарбовуємо тут."""
        if dark == self._dark:
            return
        self._dark = dark
        self.root.after_idle(self._sync_banner)
        alive = []
        for item in self._themed:
            w, bg, fg = item
            try:
                if not w.winfo_exists():               # віджет уже знищено (видалена фраза тощо) — прибираємо зі списку
                    continue
                if fg is None:                          # звичайний tk.Frame (без кольору тексту)
                    w.configure(bg=self.col(bg))
                else:
                    w.configure(bg=self.col(bg), fg=self.col(fg))
                alive.append(item)
            except tk.TclError:
                continue
        self._themed = alive
        for obj in self._card_objs.values():
            obj.colorize(frame=False)
        if self._clens is not None:
            try:
                self._clens.colorize(frame=False)
            except tk.TclError:
                pass
        for obj in (*self._row_objs.values(), *self._fmt_rows.values()):
            obj.colorize()
        if self._cat_hint is not None:
            self._cat_hint.configure(bg=self.col(PANEL), fg=self.col(MUTED))
        for ph in self._cell_ph.values():
            ph.configure(bg=self.col(PANEL), highlightbackground=self.col(CELL_LINE))

    def apply_icon_to(self, win) -> None:
        """Іконка вікна: .ico (кешований) на Windows, PNG-iconphoto на Linux/macOS — усе в try, це лише оздоба."""
        try:
            if not win.winfo_exists():
                return
            if os.name == "nt":
                path = icon_ico_path()
                if path:
                    win.iconbitmap(path)    # CTk.iconbitmap ще й забороняє ctk підмінити іконку своєю
            else:
                if self._icon is None:
                    data = icon_png_base64(64)
                    if data is None:
                        return
                    self._icon = tk.PhotoImage(data=data)
                win.iconphoto(True, self._icon)
        except Exception:
            pass

    @staticmethod
    def _bind_all(parts, seq: str, fn) -> None:
        for w in parts:
            w.bind(seq, fn, add="+")

    def _hoverable(self, box, parts, on_enter, on_leave) -> None:
        """Ховер для контейнера з дітьми: Leave з дитини не знімає ховер, поки курсор усередині контейнера."""
        def check() -> None:
            try:
                x, y = box.winfo_pointerxy()
                inside = (box.winfo_rootx() <= x < box.winfo_rootx() + box.winfo_width()
                          and box.winfo_rooty() <= y < box.winfo_rooty() + box.winfo_height())
                if not inside:
                    on_leave()
            except tk.TclError:
                pass

        self._bind_all(parts, "<Enter>", lambda e: on_enter())
        self._bind_all(parts, "<Leave>", lambda e: self.root.after(15, check))

    def _icon_button(self, parent, text: str, command, hover_text=TEXT, hover_bg=BTN2, bg_fn=None, fg_fn=None) -> tk.Label:
        """Маленька кнопка-піктограма («⋯», «✕»): проста tk-мітка (створення ≈ 0,1 мс замість ≈ 2 мс у ctk).
        bg_fn повертає колір фону контейнера, який відновлюється, коли курсор іде."""
        lbl = tk.Label(parent, text=text, font=self.pf.icon, padx=7, pady=2, cursor="hand2",
                       fg=self.col(MUTED), bg=bg_fn() if bg_fn else self.col(PANEL))

        def enter(e=None):
            if bg_fn is not None:                     # на кольоровій картці/рядку — лише колір значка, без сірого квадрата
                lbl.configure(fg=self.col(hover_text if hover_text != TEXT else ACCENT))
            else:
                lbl.configure(bg=self.col(hover_bg), fg=self.col(hover_text))

        def leave(e=None):
            lbl.configure(bg=bg_fn() if bg_fn else self.col(PANEL), fg=fg_fn() if fg_fn else self.col(MUTED))

        lbl.bind("<Enter>", enter, add="+")
        lbl.bind("<Leave>", leave, add="+")
        lbl.bind("<Button-1>", lambda e: command(e), add="+")
        return lbl

    def _new_menu(self, parent=None) -> MenuModel:
        """Порожнє меню (модель). Малює його PopupMenu — велике, у стилі застосунку (див. _popup)."""
        return MenuModel()

    def _is_history(self) -> bool:
        return self.view == HISTORY

    # -- побудова вікна -----------------------------------------------------
    def _panel(self, parent, **kw) -> ctk.CTkFrame:
        return ctk.CTkFrame(parent, corner_radius=16, fg_color=PANEL, border_width=1,
                            border_color=PANEL_BORDER, **kw)

    def _build_ui(self) -> None:
        root = self.root
        root.grid_columnconfigure(0, weight=1)
        root.grid_rowconfigure(1, weight=1)

        # верхня панель: пошук · додати · налаштування
        top = ctk.CTkFrame(root, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=14, pady=(14, 8))
        top.grid_columnconfigure(1, weight=1)
        # вкладки зліва: «Копіпасти» (папки й записи) і «Посилання» (бібліотека джерел для дисертації)
        self.tabs = ctk.CTkFrame(top, fg_color="transparent")
        self.tabs.grid(row=0, column=0, padx=(0, 10))
        self.tab = "clip"
        self.links = None
        self.tab_btns = {}
        for key, label in (("clip", "Копіпасти"), ("links", "Посилання")):
            b = ctk.CTkButton(self.tabs, text=label, height=42, width=118, corner_radius=14, font=self.f.bold,
                              command=lambda k=key: self.set_tab(k))
            b.pack(side="left", padx=(0, 6))
            self.tab_btns[key] = b
        self._style_tabs()
        # банер відкритої папки (замість пошуку): назва, кількість записів, фон — колір папки
        self.banner = ctk.CTkFrame(top, height=42, corner_radius=14, fg_color=ROW_SEL, border_width=1,
                                   border_color=PANEL_BORDER)
        self.banner.grid(row=0, column=1, sticky="ew")
        self.banner.grid_propagate(False)
        self.banner.grid_rowconfigure(0, weight=1)
        self.banner.grid_columnconfigure(1, weight=1)
        self.banner_bar = tk.Frame(self.banner, width=6, height=8)
        self.banner_bar.grid(row=0, column=0, sticky="ns", padx=(10, 0), pady=8)
        # назва папки + кількість — точно посередині банера (place поверх сітки)
        self.banner_mid = tk.Frame(self.banner, bd=0, highlightthickness=0)
        self.banner_mid.place(relx=0.5, rely=0.5, anchor="center")
        self.title_lbl = tk.Label(self.banner_mid, text="", font=self.pf.title)
        self.title_lbl.pack(side="left")
        self.count_lbl = tk.Label(self.banner_mid, text="", font=self.pf.body)
        self.count_lbl.pack(side="left", padx=(10, 0), pady=(3, 0))
        self.keys_lbl = tk.Label(self.banner, text="Alt+W/A/S/D — навігація · Space — відкрити / копіювати · "
                                                   "Alt+Space — копіювати й сховати", font=self.pf.small, anchor="e")
        self.keys_lbl.grid(row=0, column=2, sticky="e", padx=(10, 14))
        self.banner.bind("<Configure>", lambda e: self._fit_banner(), add="+")
        self.add_btn = ctk.CTkButton(top, text="＋  Додати", height=42, width=120, corner_radius=14,
                                     fg_color=ACCENT, hover_color=ACCENT_HOVER, font=self.f.bold,
                                     command=self.on_add)
        self.add_btn.grid(row=0, column=2, padx=(10, 0))
        self.gear = ctk.CTkButton(top, text="⚙", height=42, width=42, corner_radius=14, fg_color=BTN2,
                                  hover_color=BTN2_HOVER, text_color=TEXT, font=self.f.icon,
                                  command=self._popup_settings)
        self.gear.grid(row=0, column=3, padx=(8, 0))

        # три колонки
        cols = ctk.CTkFrame(root, fg_color="transparent")
        cols.grid(row=1, column=0, sticky="nsew", padx=14)
        self.cols = cols
        cols.grid_rowconfigure(0, weight=1)
        cols.grid_columnconfigure(0, weight=0)
        cols.grid_columnconfigure(1, weight=0)
        cols.grid_columnconfigure(2, weight=1)
        cols.grid_columnconfigure(3, weight=0)
        self._build_left(cols)
        self._build_splitter(cols)
        self._build_middle(cols)
        self._build_right(cols)

        # статус
        self.status = self._label(root, "", BG, MUTED, self.pf.small, anchor="w")
        self.status.grid(row=2, column=0, sticky="ew", padx=20, pady=(6, 8))

        # клавіатура
        tab = self._clip_only                       # на вкладці «Посилання» клавіші сторінки копіпастів не діють
        root.bind("<Down>", tab(lambda e: None if self._in_format_input(e) else self._arrow_v(1)))
        root.bind("<Up>", tab(lambda e: None if self._in_format_input(e) else self._arrow_v(-1)))
        root.bind("<Right>", tab(lambda e: self._arrow_h(e, 1)))
        root.bind("<Left>", tab(lambda e: self._arrow_h(e, -1)))
        root.bind("<Return>", tab(self._on_return))
        root.bind("<Alt-Return>", tab(lambda e: (self.submit_with_phrases(), "break")[1]))
        root.bind("<Alt-KP_Enter>", tab(lambda e: (self.submit_with_phrases(), "break")[1]))
        # навігація: Alt+W/S — вище/нижче, Alt+A/D — ліворуч/праворуч (між папками й записами), Space — відкрити папку
        # або скопіювати запис, Alt+Space — скопіювати й сховати вікно. Працює і з українською/російською розкладкою.
        root.bind("<Alt-KeyPress>", tab(self._on_alt_key))
        root.bind("<KeyPress-space>", tab(self._on_space))
        root.bind_all("<ButtonPress-1>", self._nav_focus, add="+")
        root.bind("<Escape>", lambda e: self.links.escape() if self.tab == "links" else self._on_escape(e))
        root.bind("<Delete>", tab(self._on_delete_key))
        root.bind("<Control-n>", lambda e: self.on_add())

        self.v_paused = tk.BooleanVar(value=self.settings["paused"])
        self.v_topmost = tk.BooleanVar(value=self.settings["topmost"])
        self.v_autohide = tk.BooleanVar(value=self.settings["autohide"])
        self.v_fullscreen = tk.BooleanVar(value=self.settings["fullscreen"])
        self.v_clear_exit = tk.BooleanVar(value=self.settings["clear_on_exit"])
        self.v_folder_first = tk.BooleanVar(value=self.settings["folder_first"])
        self.v_split_numbers = tk.BooleanVar(value=self.settings["split_numbers"])
        self.v_pick_font = tk.StringVar(value=f"{self._pick_font_size():g}")
        self.v_hotkey = tk.StringVar(value=self.settings["hotkey"])
        self.v_theme = tk.StringVar(value=self.settings["theme"])

    def _clip_only(self, fn):
        """Обгортка для клавіш сторінки копіпастів: на вкладці «Посилання» вони нічого не роблять."""
        def run(e, *a):
            if self.tab == "links":
                return None
            return fn(e, *a)
        return run

    # -- вкладки: «Копіпасти» / «Посилання» ------------------------------------------------------------
    def _style_tabs(self) -> None:
        for key, b in self.tab_btns.items():
            on = key == self.tab
            b.configure(fg_color=ACCENT if on else BTN2, hover_color=ACCENT_HOVER if on else BTN2_HOVER,
                        text_color="#ffffff" if on else TEXT)

    def set_tab(self, tab: str) -> None:
        """«Копіпасти» ↔ «Посилання» (сторінка бібліотеки джерел BioBib: папки → підпапки → посилання)."""
        if tab == self.tab:
            if tab == "links" and self.links is not None:
                self.links.go([])                     # повторний клік — до кореня «Посилань»
            return
        self.tab = tab
        self._style_tabs()
        if tab == "links":
            if self.links is None:
                self.links = LinksPage(self, self.root)
            self.cols.grid_remove()
            self.links.frame.grid(row=1, column=0, sticky="nsew", padx=14)
            self.links.refresh()
        else:
            if self.links is not None:
                self.links.frame.grid_remove()
            self.cols.grid()
        self._banner_sig = None
        self._sync_title()
        self._sync_banner()

    def _build_left(self, cols) -> None:
        left = self._panel(cols, width=self._left_w)
        left.grid(row=0, column=0, sticky="nsew")
        left.pack_propagate(False)          # ширина колонки фіксована, довгі назви не розпирають її
        self.left = left
        # картка поточного пресета
        self.preset_chip = ctk.CTkFrame(left, corner_radius=12, fg_color=ACCENT_SOFT, cursor="hand2")
        self.preset_chip.pack(fill="x", padx=10, pady=(10, 6))
        pf = self.pf
        chip_text = tk.Frame(self.preset_chip, bg=self.col(ACCENT_SOFT))
        self._themed.append((chip_text, ACCENT_SOFT, None))
        chip_text.pack(side="left", fill="x", expand=True, padx=(12, 0), pady=7)
        self.preset_cap = self._label(chip_text, "ПРЕСЕТ", ACCENT_SOFT, ACCENT, pf.caps, anchor="w")
        self.preset_cap.pack(fill="x", ipady=5)
        self.preset_name = self._label(chip_text, "", ACCENT_SOFT, TEXT, pf.bold, anchor="w")
        self.preset_name.pack(fill="x", ipady=5)
        self.preset_file = self._label(chip_text, "", ACCENT_SOFT, MUTED, pf.tiny, anchor="w")
        self.preset_file.pack(fill="x", ipady=5)
        chev = self._label(self.preset_chip, "▾", ACCENT_SOFT, ACCENT, pf.icon, width=2)
        chev.pack(side="right", padx=(0, 8))
        parts = [self.preset_chip, chip_text, self.preset_cap, self.preset_name, self.preset_file, chev]
        self._bind_all(parts, "<Button-1>", lambda e: self._popup_preset_menu(e.x_root, e.y_root))
        for w in parts[1:]:
            w.configure(cursor="hand2")

        # заголовок «Категорії» + кнопка створення
        head = ctk.CTkFrame(left, fg_color="transparent")
        head.pack(fill="x", padx=14, pady=(8, 2))
        self._label(head, "КАТЕГОРІЇ", PANEL, MUTED, pf.caps, anchor="w").pack(side="left")
        self.new_cat_btn = ctk.CTkButton(head, text="＋ Нова", width=92, height=32, corner_radius=10,
                                         fg_color=ACCENT, hover_color=ACCENT_HOVER, text_color="#ffffff",
                                         font=self.f.bold, command=self.on_new_category)
        self.new_cat_btn.pack(side="right")
        self.cat_view_btn = ctk.CTkButton(head, text="☰" if self.cat_tiles else "▦", width=38, height=32,
                                          corner_radius=10, fg_color=BTN2, hover_color=BTN2_HOVER, text_color=TEXT,
                                          font=self.f.icon,
                                          command=lambda: self.set_cat_view("list" if self.cat_tiles else "tiles"))
        self.cat_view_btn.pack(side="right", padx=(0, 6))

        self.history_slot = ctk.CTkFrame(left, fg_color="transparent")
        self.history_slot.pack(fill="x", padx=2)
        ctk.CTkFrame(left, height=1, fg_color=PANEL_BORDER).pack(fill="x", padx=14, pady=(4, 4))
        self.cat_list = ScrollFrame(left, fg_color="transparent", corner_radius=0,
                                               scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.cat_list.pack(fill="both", expand=True, padx=(2, 2), pady=(0, 8))
        self._speed_up_scroll(self.cat_list, CAT_SCROLL_FACTOR)
        left.bind("<Configure>", self._on_left_resize, add="+")
        # висота списку папок змінюється й без зміни вікна (відступ «Історії» над блоком плиток) — смугу
        # прокрутки й місце «Історії» звіряємо тоді заново (інакше лишалась непотрібна смуга й зсунута «Історія»)
        self.cat_list._parent_canvas.bind("<Configure>", self._on_cat_canvas_resize, add="+")

    @staticmethod
    def _speed_up_scroll(sf, factor: int) -> None:
        """Прискорює прокрутку колесом миші в CTkScrollableFrame у ``factor`` разів: ctk прокручує на N «одиниць»,
        а одиниця — це yscrollincrement полотна (Windows 1 px, macOS 8, Linux 30). Більша одиниця = швидше."""
        try:
            canvas = sf._parent_canvas
            base = int(float(canvas.cget("yscrollincrement")) or 1)
            canvas.configure(yscrollincrement=base * factor)
        except (tk.TclError, AttributeError, ValueError):
            pass

    def _build_splitter(self, cols) -> None:
        """Границя між папками й копіпастами: тягнеться мишею (подвійний клік — скинути)."""
        h = self.splitter = tk.Frame(cols, width=16, bg=self.col(BG), cursor="sb_h_double_arrow")
        self._themed.append((h, BG, None))
        h.grid(row=0, column=1, sticky="ns")
        grip = tk.Frame(h, width=4, bg=self.col(PANEL_BORDER), cursor="sb_h_double_arrow")
        self._themed.append((grip, PANEL_BORDER, None))
        grip.place(relx=0.5, rely=0.5, anchor="center", relheight=0.08)
        for w in (h, grip):
            w.bind("<ButtonPress-1>", self._splitter_press)
            w.bind("<B1-Motion>", self._splitter_motion)
            w.bind("<ButtonRelease-1>", self._splitter_release)
            w.bind("<Double-Button-1>", self._splitter_reset)
        for w in (h, grip):
            w.bind("<Enter>", lambda e: grip.configure(bg=self.col(ACCENT)))
            w.bind("<Leave>", lambda e: self.root.after(20, self._grip_leave, h, grip))

    def _grip_leave(self, h, grip) -> None:
        try:
            x, y = h.winfo_pointerxy()
            if not (h.winfo_rootx() <= x < h.winfo_rootx() + h.winfo_width()
                    and h.winfo_rooty() <= y < h.winfo_rooty() + h.winfo_height()):
                grip.configure(bg=self.col(PANEL_BORDER))
        except tk.TclError:
            pass

    def _build_middle(self, cols) -> None:
        mid = self._panel(cols)
        mid.grid(row=0, column=2, sticky="nsew", padx=(0, 7))
        self.mid = mid
        head = ctk.CTkFrame(mid, fg_color="transparent")
        head.pack(fill="x", padx=18, pady=(14, 4))
        self.mid_head = head
        self.rec_view_btn = ctk.CTkButton(head, text="☰ Список" if self.rec_tiles else "▦ Плитки", width=112,
                                          height=32, corner_radius=10, fg_color=BTN2, hover_color=BTN2_HOVER,
                                          text_color=TEXT, font=self.f.bold,
                                          command=lambda: self.set_rec_view("list" if self.rec_tiles else "tiles"))
        self.rec_view_btn.pack(side="right")
        # режим «спочатку папка»: повернення до вибору папки (те саме — Esc)
        self.back_btn = ctk.CTkButton(head, text="←  Назад", width=112, height=36, corner_radius=10, fg_color=BTN2,
                                      hover_color=BTN2_HOVER, text_color=TEXT, font=self.f.bold,
                                      command=self.back_to_folders)
        self.clear_btn = ctk.CTkButton(head, text="Очистити історію", width=150, height=32, corner_radius=10,
                                       fg_color="transparent", hover_color=DANGER_SOFT, text_color=DANGER,
                                       border_width=2, border_color=DANGER, font=self.f.bold,
                                       command=self.on_clear)
        # «Об'єднати і копіювати (N)»: з'являється, коли в історії відмічено ≥ 1 запис (в шапці, ліворуч від
        # «Очистити історію»; у вузькій панелі — у рядку вибору під шапкою)
        self.merge_btn = ctk.CTkButton(head, text="Об'єднати і копіювати", width=300, height=48, corner_radius=12,
                                       fg_color=ACCENT, hover_color=ACCENT_HOVER, text_color="#ffffff",
                                       font=self.f.big, command=lambda: self.merge_checked(self.merge_btn))
        self.sel_bar = ctk.CTkFrame(mid, fg_color="transparent")
        self.sel_all_btn = ctk.CTkButton(self.sel_bar, text="Вибрати все", width=118, height=30, corner_radius=9,
                                         fg_color=BTN2, hover_color=BTN2_HOVER, text_color=TEXT, font=self.f.body,
                                         command=self.toggle_check_all)
        self.sel_all_btn.pack(side="left")
        self.sel_count = self._label(self.sel_bar, "", PANEL, MUTED, self.pf.body, anchor="w")
        self.sel_count.pack(side="left", padx=(10, 0))
        self.merge_btn2 = ctk.CTkButton(self.sel_bar, text="Об'єднати і копіювати", width=280, height=46,
                                        corner_radius=12, fg_color=ACCENT, hover_color=ACCENT_HOVER,
                                        text_color="#ffffff", font=self.f.big,
                                        command=lambda: self.merge_checked(self.merge_btn2))
        # режим Append: помітний банер над списком записів
        self.armed_banner = ctk.CTkFrame(mid, corner_radius=10, fg_color=ARMED_SOFT, border_width=1,
                                         border_color=ARMED)
        self.armed_label = self._label(self.armed_banner, "", ARMED_SOFT, TEXT, self.pf.body, anchor="w",
                                       justify="left")
        self.armed_label.pack(fill="x", padx=14, pady=8)
        self.cards = ScrollFrame(mid, fg_color="transparent", corner_radius=0,
                                            scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.cards.pack(fill="both", expand=True, padx=(8, 4), pady=(0, 10))
        mid.bind("<Configure>", self._on_mid_resize, add="+")

    def _build_right(self, cols) -> None:
        right = self._panel(cols, width=self._right_w)
        right.grid(row=0, column=3, sticky="nsew")
        right.pack_propagate(False)
        self.right = right
        head = ctk.CTkFrame(right, fg_color="transparent")
        head.pack(fill="x", padx=14, pady=(16, 4))
        self._label(head, "ФОРМАТУВАННЯ", PANEL, MUTED, self.pf.caps, anchor="w").pack(side="left")

        self.formats_slot = ctk.CTkFrame(right, fg_color="transparent")
        self.formats_slot.pack(fill="x", padx=2)
        # швидкі фрази — посередині правої колонки (expand центрує блок у вільному місці під форматами)
        self._build_refund_box(right)
        # область введення вибраного формату (два CTkTextbox — найважчі віджети вікна) будується ЛІНИВО,
        # при першому виборі формату: див. _ensure_fmt і властивості fmt_box, fmt_input, …

    def _build_refund_box(self, right) -> None:
        """Постійний блок «Швидкі фрази» (видно в усіх папках): фрази з галочками, кнопки Copy / Append, «＋» додає власну
        фразу, «✕» біля фрази видаляє її. Фрази лежать у пресеті (preset.phrases)."""
        box = self.refund_box = ctk.CTkFrame(right, corner_radius=12, fg_color=CARD, border_width=1,
                                             border_color=CARD_BORDER)
        box.pack(side="top", fill="x", expand=True, padx=8, pady=8)
        self._phrases_collapsed = bool(self.settings["phrases_collapsed"])
        head = self.phrase_head = tk.Frame(box, bg=self.col(CARD), cursor="hand2")
        self._themed.append((head, CARD, None))
        head.pack(fill="x", padx=(18, 8), pady=(8, 2))
        self.phrase_chev = self._label(head, "▾", CARD, MUTED, self.pf.icon, cursor="hand2")
        self.phrase_chev.pack(side="left", padx=(0, 6))
        caption = self._label(head, "ШВИДКІ ФРАЗИ", CARD, MUTED, self.pf.caps, anchor="w", cursor="hand2")
        caption.pack(side="left")
        for w in (head, self.phrase_chev, caption):          # клік по заголовку згортає / розгортає блок
            w.bind("<Button-1>", lambda e: self.toggle_phrases())
        self.phrase_add_btn = ctk.CTkButton(head, text="＋", width=34, height=28, corner_radius=9, fg_color=BTN2,
                                            hover_color=BTN2_HOVER, text_color=TEXT, font=self.f.icon,
                                            command=self.on_add_phrase)
        self.phrase_add_btn.pack(side="right")
        self.phrase_list = tk.Frame(box, bg=self.col(CARD))
        self._themed.append((self.phrase_list, CARD, None))
        self.phrase_list.pack(fill="x", padx=2)              # не зафарбовує бічні рамки картки
        self._phrase_rows: dict[str, dict] = {}
        self._phrase_sig = None
        pair = self.phrase_pair = tk.Frame(box, bg=self.col(CARD))
        self._themed.append((pair, CARD, None))
        pair.pack(fill="x", padx=(16, 12), pady=(6, 12))
        pair.grid_columnconfigure((0, 1), weight=1, uniform="refpair")
        self.refund_copy = ctk.CTkButton(pair, text="Copy", height=36, corner_radius=12, fg_color=BTN2,
                                         hover_color=BTN2_HOVER, text_color=FAINT, font=self.f.bold,
                                         state="disabled", command=self.submit_refund)
        self.refund_copy.grid(row=0, column=0, sticky="ew", padx=(0, 5))
        self.refund_append = ctk.CTkButton(pair, text="Append", height=36, corner_radius=12, fg_color=BTN2,
                                           hover_color=BTN2_HOVER, text_color=FAINT, border_width=2,
                                           border_color=BTN2, font=self.f.bold, state="disabled",
                                           command=self.arm_refund_append)
        self.refund_append.grid(row=0, column=1, sticky="ew", padx=(5, 0))
        if self._phrases_collapsed:
            self._apply_phrases_collapse()

    def toggle_phrases(self) -> None:
        """Згорнути / розгорнути блок «Швидкі фрази» (стан запам'ятовується)."""
        if getattr(self, "_phr_auto", False):              # тимчасово згорнуті — клік розгортає їх
            self._phr_auto = False
            self._phr_no_auto = True                       # і більше не згортаємо самі, доки формат відкритий
            self._apply_phrases_collapse()
            return
        self._phrases_collapsed = not self._phrases_collapsed
        self.settings["phrases_collapsed"] = self._phrases_collapsed
        self._apply_phrases_collapse()

    def _apply_phrases_collapse(self) -> None:
        if self._phrases_collapsed or getattr(self, "_phr_auto", False):
            for w in (self.phrase_list, self.phrase_pair, self.phrase_add_btn):
                w.pack_forget()
            self.phrase_chev.configure(text="▸")
        else:
            self.phrase_list.pack(fill="x", padx=2, after=self.phrase_head)
            self.phrase_pair.pack(fill="x", padx=(16, 12), pady=(6, 12), after=self.phrase_list)
            self.phrase_add_btn.pack(side="right")
            self.phrase_chev.configure(text="▾")
        self.root.after_idle(self._fit_format_box)

    def _render_phrases(self) -> None:
        """Малює рядки фраз за preset.phrases (лише коли список змінився); стан галочок збережених фраз лишається."""
        phrases = self.preset.phrases
        sig = tuple((p["id"], p["text"], p.get("color"), bool(p.get("user_link"))) for p in phrases) + (_SAT[0],)
        if sig == self._phrase_sig:
            return
        self._phrase_sig = sig
        style = {p["id"]: (p.get("color"), bool(p.get("part")), bool(p.get("user_link")), _SAT[0])
                 for p in phrases}
        for pid in [k for k in self._phrase_rows if style.get(k) != self._phrase_rows[k]["style"]]:
            gone = self._phrase_rows.pop(pid)          # видалена фраза або змінився колір / «@ користувач» — рядок наново
            if pid in style:
                self._phrase_checked_keep = getattr(self, "_phrase_checked_keep", {})
                self._phrase_checked_keep[pid] = gone["var"].get()
            dead = {gone["frame"], gone["label"], gone["more"], gone["user"]}
            self._themed = [t for t in self._themed if t[0] not in dead]
            gone["frame"].destroy()
        wrap = int(max(120, self._right_w - 158) * self.scaling())
        for row in self._phrase_rows.values():
            row["frame"].pack_forget()
            row["label"].configure(wraplength=wrap)
        for p in phrases:
            row = self._phrase_rows.get(p["id"])
            if row is None:
                row = self._phrase_rows[p["id"]] = self._make_phrase_row(p, wrap)
                keep = getattr(self, "_phrase_checked_keep", {}).pop(p["id"], False)
                if keep:
                    row["var"].set(True)
            row["phrase"] = p
            row["label"].configure(text=p["text"])
            row["frame"].pack(fill="x", padx=10, pady=2)
        self._sync_refund_buttons()
        if not phrases:
            self.set_status("Фраз немає — додайте свою кнопкою «＋»", 4000)
        self.root.after_idle(self._fit_format_box)

    def _make_phrase_row(self, p: dict, wrap: int) -> dict:
        # власний колір фрази — як у карток; без нього пара «Active subscriptions / Internal charges» жовтувата
        bgc = card_colors(p["color"])[0] if p.get("color") else (PAIR if p.get("part") else CARD)
        frame = tk.Frame(self.phrase_list, bg=self.col(bgc), cursor="fleur")
        self._themed.append((frame, bgc, None))
        var = tk.BooleanVar(value=False)
        cb = ctk.CTkCheckBox(frame, text="", variable=var, width=26, checkbox_width=24, checkbox_height=24,
                             corner_radius=7, border_width=2, fg_color=ACCENT, hover_color=ACCENT_HOVER,
                             bg_color=bgc, command=lambda pid=p["id"]: self._refund_toggle(pid))
        cb.pack(side="left", padx=(6, 8), pady=3)
        # «⋯» — опції фрази (редагувати, колір, користувач з історії, видалити); те саме — права кнопка миші
        more = self._icon_button(frame, "⋯", lambda e, pid=p["id"]: self.show_phrase_menu(e.x_root, e.y_root, pid),
                                 bg_fn=lambda c=bgc: self.col(c))
        more.pack(side="right", padx=(2, 4))
        more.configure(fg=self.col(ink(bgc, "muted")))
        self._themed.append((more, bgc, ink(bgc, "muted")))      # фон значка перефарбовується зі зміною теми
        user = None
        if p.get("user_link"):                       # фраза дописує користувача з історії
            user = tk.Label(frame, text="@", font=self.pf.small, bg=self.col(bgc), fg=self.col(ACCENT))
            user.pack(side="right", padx=(2, 0))
            self._themed.append((user, bgc, ACCENT))
        label = tk.Label(frame, text=p["text"], font=self.pf.phrase, anchor="w", justify="left", cursor="hand2",
                         bg=self.col(bgc), fg=self.col(ink(bgc)), wraplength=wrap, pady=4)
        self._themed.append((label, bgc, ink(bgc)))
        label.pack(side="left", fill="x", expand=True)
        # клік по тексту — поставити/зняти галочку; перетягування за текст чи фон рядка — сортування
        for w in (label, frame):
            w.bind("<ButtonPress-1>", lambda e, pid=p["id"]: self._phrase_press(pid, e))
            w.bind("<B1-Motion>", self._phrase_motion)
            w.bind("<ButtonRelease-1>", self._phrase_release)
        for w in [label, frame, more] + ([user] if user else []):
            w.bind("<Button-3>", lambda e, pid=p["id"]: self.show_phrase_menu(e.x_root, e.y_root, pid))
        return {"frame": frame, "var": var, "cb": cb, "label": label, "more": more, "user": user, "phrase": p,
                "style": (p.get("color"), bool(p.get("part")), bool(p.get("user_link")), _SAT[0])}

    def show_phrase_menu(self, x: int, y: int, pid: str) -> None:
        self._popup(self._build_phrase_menu(pid), x, y)

    def _build_phrase_menu(self, pid: str) -> MenuModel:
        ph = next((p for p in self.preset.phrases if p["id"] == pid), None)
        m = self._new_menu()
        if ph is None:
            return m
        m.add_command("Редагувати…", lambda: self.on_edit_phrase(pid), icon="✎")
        m.add_command("Колір фрази…", lambda: self.on_phrase_color(pid), icon="●")
        on = bool(ph.get("user_link"))
        m.add_command(("✓ " if on else "") + "Додавати користувача з історії (in {LINK:USER:…:E})",
                      lambda: self.on_phrase_user_link(pid, not on), icon="@")
        if on:
            m.add_cascade("Скільки користувачів брати", self._count_menu(
                ph.get("user_count", 0), lambda n: self._set_phrase_count(pid, n)), icon="#")
        m.add_separator()
        m.add_command("Видалити фразу", lambda: self.on_remove_phrase(pid), danger=True, icon="✕")
        return m

    def _count_menu(self, current: int, apply) -> "MenuModel":
        """Підменю «скільки значень підтягувати»: усі з останньої серії номерних записів буфера або 1…10."""
        sub = self._new_menu()
        sub.add_command("Усі з останніх записів", lambda: apply(0), checked=not current)
        for n in (1, 2, 3, 4, 5, 6, 8, 10):
            sub.add_command(str(n), lambda n=n: apply(n), checked=current == n)
        return sub

    def _set_phrase_count(self, pid: str, n: int) -> None:
        if self.preset.set_phrase_user_count(pid, n):
            self.set_status(f"Фраза братиме користувачів: {n or 'усіх з останніх записів'}", 3000)

    def _set_snippet_count(self, item_id: str, n: int) -> None:
        if self.preset.set_snippet_user_count(item_id, n):
            self.render()
            self.set_status(f"Запис братиме користувачів: {n or 'усіх з останніх записів'}", 3000)

    def on_phrase_color(self, pid: str) -> None:
        ph = next((p for p in self.preset.phrases if p["id"] == pid), None)
        if ph is None:
            return
        res = ColorDialog(self, f"Колір фрази «{clip(ph['text'], 20)}»", ph.get("color"), allow_reset=True,
                          reset_label="Без кольору").run()
        if not res:
            return
        if self.preset.set_phrase_color(pid, res[1] if res[0] == "set" else None):
            self._render_phrases()
            self.set_status("✓ Колір фрази змінено", 3000)

    def on_phrase_user_link(self, pid: str, on: bool) -> None:
        if self.preset.set_phrase_user_link(pid, on):
            self._render_phrases()
            self._sync_refund_buttons()
            self.set_status("Фраза дописуватиме користувача з історії ({LINK:USER:…:E})" if on
                            else "Фраза — без користувача з історії", 4000)

    # -- перетягування фраз (сортування) ---------------------------------------------------------
    def _phrase_press(self, pid: str, e) -> None:
        self._pd = {"id": pid, "x": e.x_root, "y": e.y_root, "active": False, "ghost": None, "k": None}

    def _phrase_motion(self, e) -> None:
        d = getattr(self, "_pd", None)
        if not d:
            return
        if not d["active"]:
            if abs(e.x_root - d["x"]) + abs(e.y_root - d["y"]) < 8:
                return
            d["active"] = True
            ph = next((p for p in self.preset.phrases if p["id"] == d["id"]), {"text": ""})
            d["ghost"] = self._make_ghost(clip(ph["text"], 48))
        d["ghost"].geometry(f"+{e.x_root + 14}+{e.y_root + 14}")
        if self._inside(self.phrase_list, e.x_root, e.y_root, slack=24):
            frames = [self._phrase_rows[p["id"]]["frame"] for p in self.preset.phrases
                      if p["id"] != d["id"] and p["id"] in self._phrase_rows]
            d["k"], iy = self._insert_point(frames, e.y_root)
            self._show_indicator(self.phrase_list, iy, 6)
        else:
            d["k"] = None
            self._hide_indicators()

    def _phrase_release(self, e) -> None:
        d, self._pd = getattr(self, "_pd", None), None
        if not d:
            return
        if not d["active"]:                                   # просто клік по фразі = галочка
            row = self._phrase_rows.get(d["id"])
            if row is not None:
                row["cb"].toggle()
            return
        d["ghost"].destroy()
        self._hide_indicators()
        if d["k"] is not None and self.preset.move_phrase_to(d["id"], d["k"]):
            self._phrase_sig = None
            self._render_phrases()
            self.set_status("✓ Порядок фраз змінено", 3000)

    def _refund_selected(self) -> list[dict]:
        """Позначені фрази — у порядку, в якому вони лежать у пресеті."""
        return [r["phrase"] for r in (self._phrase_rows.get(p["id"]) for p in self.preset.phrases)
                if r is not None and r["var"].get()]

    def _refund_toggle(self, pid: str) -> None:
        """Окрема фраза (без "part") виключає всі інші; об'єднувані між собою поєднуються, але знімають окремі."""
        row = self._phrase_rows[pid]
        if row["var"].get():
            alone = not row["phrase"].get("part")
            for other_id, other in self._phrase_rows.items():
                if other_id != pid and (alone or not other["phrase"].get("part")):
                    other["var"].set(False)
        self._sync_refund_buttons()

    def _sync_refund_buttons(self) -> None:
        ready = bool(compose_phrases(self._refund_selected()))
        st = "normal" if ready else "disabled"
        self.refund_copy.configure(state=st, fg_color=ACCENT if ready else BTN2,
                                   hover_color=ACCENT_HOVER if ready else BTN2_HOVER,
                                   text_color="#ffffff" if ready else FAINT)
        armed = self.append_armed and self.armed_src == "refund"
        if armed and not ready:
            self._set_armed(False)
            armed = False
        self.refund_append.configure(state=st, text_color=TEXT if ready else FAINT)
        if not armed:
            self.refund_append.configure(fg_color=BTN2, hover_color=BTN2_HOVER, border_color=BTN2)
        else:
            self._refresh_banner(self._phrase_text())

    def _clear_refunds(self) -> None:
        if any(r["var"].get() for r in self._phrase_rows.values()):
            for r in self._phrase_rows.values():
                r["var"].set(False)
            self._sync_refund_buttons()

    def on_add_phrase(self) -> None:
        text = TextDialog(self, "Нова швидка фраза", "Текст фрази:").run()
        if text is None:
            return
        if not self.preset.add_phrase(text):
            self.set_status("Порожня фраза або така вже є", 4000)
            return
        self._render_phrases()
        self.set_status("✓ Фразу додано", 3000)

    def on_edit_phrase(self, pid: str) -> None:
        ph = next((p for p in self.preset.phrases if p["id"] == pid), None)
        if ph is None:
            return
        text = TextDialog(self, "Редагувати фразу", "Текст фрази:", ph["text"]).run()
        if text is None:
            return
        if not self.preset.edit_phrase(pid, text):
            self.set_status("Порожня фраза або така вже є", 4000)
            return
        self._render_phrases()
        self._sync_refund_buttons()
        self.set_status("✓ Фразу змінено", 3000)

    def on_remove_phrase(self, pid: str) -> None:
        if self.preset.remove_phrase(pid):
            self._render_phrases()
            self.set_status("Фразу видалено", 3000)

    def _phrase_text(self) -> str:
        """Обрані швидкі фрази → текст; «Email ___» отримує останній email з історії, «___» — користувачів."""
        chosen = self._refund_selected()
        out = compose_phrases(chosen)
        if not out:
            return out
        if any(p.get("user_link") for p in chosen):
            # «… subscriptions.» → «… subscriptions in {LINK:USER:…:E}.» (крапка лишається в кінці)
            dot = out.endswith(".") and not has_user_placeholder(out)
            cnt = next((p.get("user_count", 0) for p in chosen if p.get("user_link")), 0)
            out = self._fill_snippet(out[:-1] if dot else out, True, count=cnt)
            return out + "." if dot else out
        return fill_placeholders(out, self._history_texts(), split=self.settings["split_numbers"])

    def submit_refund(self) -> None:
        out = self._phrase_text()
        if not out:
            self.set_status("Позначте галочкою, що саме скопіювати")
            return
        self.copy_to_clipboard(out)
        self.append_armed = False
        self._finish_pick("✓ Скопійовано: " + clip(out, 60), lambda: self._after_format_pick("refund"))

    def arm_refund_append(self) -> None:
        if self.append_armed and self.armed_src == "refund":
            self._set_armed(False)
            self.set_status("Режим Append скасовано")
            return
        out = self._phrase_text()
        if not out:
            return
        self._set_armed(True, "refund")
        self._refresh_banner(out)
        self.set_status("Append: клікніть запис — фраза буде дописана в його кінець (Esc — скасувати)", 9000)

    def _armed_result(self) -> str:
        """Що дописується в режимі Append: результат вибраного формату або обрана швидка фраза."""
        if self.armed_src == "refund":
            return self._phrase_text()
        return self._format_result(2 if self.armed_src == "format_all" else 1)

    def _ensure_fmt(self) -> None:
        """Будує область введення форматування (заголовок, підказка, поле, перегляд, кнопки)."""
        if self._fmt_built:
            return
        self._fmt_built = True
        right, pf = self.right, self.pf
        self._fmt_box = box = ctk.CTkFrame(right, fg_color=PANEL, corner_radius=0)
        self._fmt_title = self._label(box, "", PANEL, TEXT, pf.bold, anchor="w")
        self._fmt_title.pack(fill="x", padx=16, pady=(10, 0))
        self._fmt_title.pack_configure(pady=(10, 6))
        self._fmt_input = ctk.CTkTextbox(box, height=self._fmt_heights[0], wrap="word", corner_radius=10,
                                         border_width=1, border_color=PANEL_BORDER, fg_color=INPUT, text_color=TEXT,
                                         font=self.f.body, undo=True)
        self._fmt_input.pack(fill="x", padx=14)
        self._label(box, "Результат", PANEL, MUTED, pf.caps, anchor="w").pack(fill="x", padx=16, pady=(8, 2))
        self._fmt_preview = ctk.CTkTextbox(box, height=self._fmt_heights[1], wrap="word", corner_radius=10,
                                           border_width=1, border_color=PANEL_BORDER, fg_color=INPUT,
                                           text_color=TEXT, font=self.f.mono)
        self._fmt_preview.pack(fill="x", padx=14)
        self._fmt_preview.configure(state="disabled")
        # кнопки дій: для формату з однією дією — «Копіювати і сховати»; з двома — «Copy» і «Append»
        self._fmt_actions = ctk.CTkFrame(box, fg_color="transparent")
        self._fmt_actions.pack(fill="x", padx=14, pady=(10, 4))
        self._fmt_btn = ctk.CTkButton(self._fmt_actions, text="Копіювати і сховати", height=38, corner_radius=12,
                                      fg_color=ACCENT, hover_color=ACCENT_HOVER, font=self.f.bold,
                                      command=self.submit_format)
        self._fmt_btn.pack(fill="x")
        self._fmt_pair = ctk.CTkFrame(self._fmt_actions, fg_color="transparent")
        self._fmt_pair.grid_columnconfigure((0, 1), weight=1, uniform="fmtpair")
        self._fmt_copy = ctk.CTkButton(self._fmt_pair, text="Copy", height=38, corner_radius=12, fg_color=ACCENT,
                                       hover_color=ACCENT_HOVER, font=self.f.bold, command=self.submit_format)
        self._fmt_copy.grid(row=0, column=0, sticky="ew", padx=(0, 5))
        self._fmt_append = ctk.CTkButton(self._fmt_pair, text="Append", height=38, corner_radius=12, fg_color=BTN2,
                                         hover_color=BTN2_HOVER, text_color=TEXT, border_width=2,
                                         border_color=BTN2, font=self.f.bold, command=self.arm_append)
        self._fmt_append.grid(row=0, column=1, sticky="ew", padx=(5, 0))
        # друге вікно результату: УСІ останні числові значення з буфера (через «,», «.», «;», «:» чи пробіл);
        # неактивне, коли в поле введення щось вставлено (тоді результат — лише в першому вікні)
        self._fmt_lbl2 = self._label(box, "Результат 2 — усі останні значення з буфера", PANEL, MUTED, pf.caps,
                                     anchor="w")
        self._fmt_lbl2.pack(fill="x", padx=16, pady=(6, 2))
        self._fmt_preview2 = ctk.CTkTextbox(box, height=self._fmt_heights[1], wrap="word", corner_radius=10,
                                            border_width=1, border_color=PANEL_BORDER, fg_color=INPUT,
                                            text_color=TEXT, font=self.f.mono)
        self._fmt_preview2.pack(fill="x", padx=14)
        self._fmt_preview2.configure(state="disabled")
        self._fmt_actions2 = ctk.CTkFrame(box, fg_color="transparent")
        self._fmt_actions2.pack(fill="x", padx=14, pady=(10, 4))
        self._fmt_actions2.grid_columnconfigure((0, 1), weight=1, uniform="fmtpair2")
        self._fmt_copy2 = ctk.CTkButton(self._fmt_actions2, text="Copy усі", height=38, corner_radius=12,
                                        fg_color=ACCENT, hover_color=ACCENT_HOVER, font=self.f.bold,
                                        command=lambda: self.submit_format(2))
        self._fmt_copy2.grid(row=0, column=0, sticky="ew", padx=(0, 5))
        self._fmt_append2 = ctk.CTkButton(self._fmt_actions2, text="Append усі", height=38, corner_radius=12,
                                          fg_color=BTN2, hover_color=BTN2_HOVER, text_color=TEXT, border_width=2,
                                          border_color=BTN2, font=self.f.bold, command=lambda: self.arm_append(2))
        self._fmt_append2.grid(row=0, column=1, sticky="ew", padx=(5, 0))
        self._fmt_armed_hint = self._label(box, "Оберіть запис у папці — результат буде дописано в кінець",
                                           PANEL, ARMED, pf.small, anchor="w", justify="left",
                                           wraplength=int((self._right_w - 40) * self.scaling()))
        # Enter — виконати (Copy), Shift+Enter — новий рядок, Ctrl+A — виділити все
        inner = self._fmt_input._textbox
        inner.bind("<Return>", self._on_format_return)
        inner.bind("<KP_Enter>", self._on_format_return)
        inner.bind("<KeyRelease>", lambda e: self._update_format_preview(), add="+")
        inner.bind("<<Paste>>", lambda e: self.root.after_idle(self._update_format_preview), add="+")
        inner.bind("<Control-a>", lambda e: (inner.tag_add("sel", "1.0", "end-1c"), "break")[1])
        self._sync_submit_label()

    fmt_box = _lazy_fmt("fmt_box")
    fmt_title = _lazy_fmt("fmt_title")
    fmt_input = _lazy_fmt("fmt_input")
    fmt_preview = _lazy_fmt("fmt_preview")
    fmt_preview2 = _lazy_fmt("fmt_preview2")
    fmt_btn = _lazy_fmt("fmt_btn")

    def _plan_layout(self, width_px: int) -> None:
        """Остаточні ширини колонок, назв і переносу тексту ОБЧИСЛЮЄМО за шириною вікна ще до побудови
        віджетів — тоді вони одразу створюються правильного розміру й нічого не «стрибає» після показу."""
        w = width_px / self.scaling()
        self._left_w = self._left_for(w)
        self._cat_cols = 3 if self._left_w >= CAT_TILE_MIN_LEFT else 2
        self._right_w = int(min(RIGHT_MAX, max(RIGHT_W, w * RIGHT_FRAC)))
        self._name_chars = max(12, int((self._left_w - 150) / 9.0))
        self._mid_w = int(w - 28 - self._left_w - self._right_w - 28)    # відступи рамки, колонок і панелей
        self._pick_w = int(w - 28 - self._right_w - 7)                   # ліва панель на всю ширину (режим папок)
        if self.folder_first:
            self._mid_w = self._pick_w                                   # записи займають усе місце зліва
        self._usable0 = self._mid_w - 16                                 # мінус поля й рамка прокручуваної області
        self._sb_cur = 0                                                 # скільки з цього забирає смуга прокрутки
        self._card_pad, self._wrap = self._wrap_for(self._usable0)

    @staticmethod
    def _left_cap(window_w: float, want: float) -> float:
        """Ліва колонка не повинна «задушити» середню: лишаємо їй щонайменше MID_MIN (з правою колонкою й відступами)."""
        right = min(RIGHT_MAX, max(RIGHT_W, window_w * RIGHT_FRAC))
        return max(LEFT_MIN, min(want, LEFT_MAX_USER, window_w * 0.6, window_w - right - 56 - MID_MIN))

    def _left_for(self, window_w: float) -> int:
        """Ширина лівої колонки: від користувача (границя, яку можна пересунути) або за шириною вікна."""
        if self._left_user:
            return int(self._left_cap(window_w, self._left_user))
        return int(min(LEFT_MAX, max(LEFT_W, window_w * LEFT_FRAC)))

    def _wrap_for(self, usable: int) -> tuple[int, int]:
        """(бокові поля карток, ширина переносу тексту) для доступної ширини списку. У режимі плиток заодно
        рахує кількість колонок і висоту плитки (self._rec_cols / self._rec_tile_h)."""
        usable = max(240, usable)
        if self.rec_tiles:
            usable -= 14
            gap = 12
            cols = max(1, min(5, int((usable + gap) // (REC_TILE_MIN + gap))))
            tile_w = (usable - 12 - (cols - 1) * gap) / cols
            self._rec_cols = cols
            self._rec_tile_h = int(max(104, min(190, tile_w * 0.66)))
            # ширина, яку плитці фактично дасть сітка (рівні колонки на всю ширину полотна, padx=6 з кожного боку):
            # плитка одразу створюється такою — ctk малює її один раз, а не спершу вузькою, а потім ще раз
            self._rec_tile_w = max(10, int((usable + 14) / cols) - 12)
            return 6, int(max(90, tile_w - 48))
        pad = max(6, (usable - CARD_MAX) // 2)
        reserve = CARD_RESERVE if self._is_history() else CARD_RESERVE_FOLDER     # у папках немає великої галочки
        return pad, max(140, usable - 2 * pad - reserve)

    def _set_scroll_space(self, need: bool, sb_w: int) -> None:
        """Смуга прокрутки забирає частину ширини списку: враховуємо це ДО створення карток (а не після)."""
        sb = sb_w if need else 0
        if sb != self._sb_cur:
            self._sb_cur = sb
            self._apply_wrap_values(*self._wrap_for(self._usable0 - sb))

    def _apply_wrap_values(self, pad: int, wrap: int) -> None:
        if self.rec_tiles:
            sig = (self._rec_cols, self._rec_tile_h)
            if sig != self._rec_sig:                  # змінилась кількість колонок або висота плиток
                self._rec_sig = sig
                self._regrid_cards()
        elif pad != self._card_pad:
            self._card_pad = pad
            for card in self._card_objs.values():
                try:
                    card.frame.pack_configure(padx=pad)
                except tk.TclError:
                    pass
        if wrap != self._wrap:
            self._wrap = wrap
            wrap_px = int(wrap * self.scaling())
            for lbl in self._wrap_labels:
                try:
                    lbl.configure(wraplength=wrap_px)
                except tk.TclError:
                    pass
        self._sync_card_lens()                         # ширина списку змінилась — копія вибраного запису за карткою

    def _init_tags(self) -> None:
        """Один набір прив'язок на ВСІ картки (через bindtags), а не ~25 прив'язок на кожну картку."""
        r = self.root
        r.bind_class("CMCardClick", "<ButtonPress-1>", lambda e: self._drag_press(e, e.widget._cm_iid))
        r.bind_class("CMCardClick", "<B1-Motion>", lambda e: self._drag_motion(e))
        r.bind_class("CMCardClick", "<ButtonRelease-1>", lambda e: self._drag_release(e))
        r.bind_class("CMCardClick", "<Button-3>", lambda e: self.show_menu(e.x_root, e.y_root, e.widget._cm_iid))
        r.bind_class("CMCardHover", "<Enter>", self._card_enter)
        r.bind_class("CMCardHover", "<Leave>", self._card_leave)

    def _card_enter(self, e) -> None:
        card = self._card_for(e.widget, getattr(e.widget, "_cm_iid", None))
        if card:
            card.hover_on()

    def _card_leave(self, e) -> None:
        iid = getattr(e.widget, "_cm_iid", None)
        if iid:
            self.root.after(15, self._hover_check, iid)     # Leave з дитини ≠ курсор вийшов із картки

    def _hover_check(self, iid: str) -> None:
        lens = self._clens if self._clens is not None and self._clens.iid == iid else None
        for card in (self._card_objs.get(iid), lens):     # картка і її збільшена копія — кожна за своїм місцем
            if not card:
                continue
            try:
                x, y = card.frame.winfo_pointerxy()
                f = card.frame
                if not (f.winfo_rootx() <= x < f.winfo_rootx() + f.winfo_width()
                        and f.winfo_rooty() <= y < f.winfo_rooty() + f.winfo_height()):
                    card.hover_off()
            except tk.TclError:
                pass

    # -- відображення -----------------------------------------------------
    def _update_title(self) -> None:
        self.root.title(f"{APP_NAME} — {self.preset.name}")
        self.preset_name.configure(text=clip(self.preset.name, 26))
        self.preset_file.configure(text=clip(os.path.basename(self.preset.path), 36))

    # Перебудова віджетів. Поки вікно сховане, вона НЕ виконується одразу, а відкладається у фон
    # (після ховання), тож показ вікна — це лише deiconify, без жодної роботи.
    def _defer(self, scroll_top: bool = False) -> bool:
        if not self._hidden:
            return False
        self._dirty = True
        self._dirty_top = self._dirty_top or scroll_top
        if self._flush_job is None:
            self._flush_job = self.root.after(30, self._flush)
        return True

    def _flush(self) -> None:
        self._flush_job = None
        if self._dirty:
            top, self._dirty, self._dirty_top = self._dirty_top, False, False
            self._render_now(top)

    def render(self, scroll_top: bool = False) -> None:
        if self._defer(scroll_top):
            return
        self._render_now(scroll_top)

    def _render_now(self, scroll_top: bool = False) -> None:
        if self.view != HISTORY and not self.preset.category(self.view):
            self.view = HISTORY
        for stage, is_list in ((self._render_sidebar_now, False), (lambda: self._render_list_now(scroll_top), True),
                               (self._render_formats, False), (self._render_phrases, False)):
            try:
                stage()
            except Exception:
                # одна зламана ділянка не повинна «вбивати» весь інтерфейс: пишемо в error.log й
                # для списку записів пробуємо перебудувати картки з нуля
                self._report_exception(*sys.exc_info())
                if is_list:
                    self._reset_cards()
                    try:
                        self._render_list_now(True)
                    except Exception:
                        self._report_exception(*sys.exc_info())

    def _reset_cards(self) -> None:
        """Аварійне очищення списку записів: усі картки знищуються й будуть створені заново."""
        if self._chunk_job is not None:
            self.root.after_cancel(self._chunk_job)
            self._chunk_job = None
        self._todo = []
        for card in list(self._card_objs.values()):
            try:
                card.destroy()
            except Exception:
                pass
        self._card_objs.clear()
        self._cards.clear()
        self._card_border.clear()
        for ph in self._cell_ph.values():
            try:
                ph.destroy()
            except Exception:
                pass
        self._cell_ph.clear()
        self._packed = []
        self._order = []
        for attr in ("_empty_box", "_more_btn"):
            w = getattr(self, attr, None)
            if w is not None:
                try:
                    w.destroy()
                except Exception:
                    pass
                setattr(self, attr, None)

    def pending_render(self) -> bool:
        """Є відкладена робота з малювання (картки порціями, фонова перебудова) — для тестів і виміру."""
        return bool(self._todo or self._chunk_job or self._flush_job or self._dirty)

    def flush_render(self) -> None:
        """Синхронно дороблює все відкладене (на показі вікна й у тестах)."""
        if self._flush_job is not None:
            self.root.after_cancel(self._flush_job)
            self._flush_job = None
        if self._dirty:
            self._dirty, top, self._dirty_top = False, self._dirty_top, False
            was, self._hidden = self._hidden, False
            try:
                self._render_now(top)
            finally:
                self._hidden = was
        if self._chunk_job is not None:
            self.root.after_cancel(self._chunk_job)
            self._chunk_job = None
        if self._todo:
            self._create_cards(len(self._todo))
        if self._finish_pending:
            self._finish_render()

    def render_sidebar(self) -> None:
        if self._defer():
            return
        self._render_sidebar_now()

    # -- ліва колонка: рядки категорій оновлюються на місці ---------------------------------
    def _render_sidebar_now(self) -> None:
        self.sidebar_render_count += 1
        hist = self._row_objs.get(HISTORY)
        if hist is None:
            hist = self._row_objs[HISTORY] = SideRow(self, self.history_slot, HISTORY, real=False)
            hist.row.pack(fill="x", padx=6, pady=2)
            self._rows[HISTORY] = hist.row
        hist.update("Історія буфера", "#8a93a0", len(self.history.items), self.view == HISTORY)

        wanted = [c["id"] for c in self.preset.categories]
        for key in [k for k in self._row_objs if k != HISTORY and k not in wanted]:
            obj = self._row_objs.pop(key)
            self._rows.pop(key, None)
            self._row_fills.pop(key, None)
            self._swatches.pop(key, None)
            self._row_keys.pop(obj.row, None)
            obj.destroy()
        created = False
        for c in self.preset.categories:
            obj = self._row_objs.get(c["id"])
            if obj is None:
                obj = self._row_objs[c["id"]] = SideRow(self, self.cat_list, c["id"], real=True, tile=self.cat_tiles)
                self._rows[c["id"]] = obj.row
                self._swatches[c["id"]] = obj.dot
                self._row_keys[obj.row] = c["id"]
                created = True
            obj.update(c["name"], c["color"], self.preset.count(c["id"]), c["id"] == self.view, c.get("shape") or "",
                       c.get("border"))
        if created or self._row_order != wanted:
            self._row_order = wanted
            self._cat_sig = None
        if self.nav_zone == "folders" and self.nav_cat in self._row_objs:
            self._mark_target(self.nav_cat, True)         # перемальований рядок не губить клавіатурний «курсор»
        if wanted and self._cat_hint is not None:        # підказку (pack) прибираємо ДО розкладки плиток (grid)
            self._cat_hint.destroy()
            self._cat_hint = None
        self._arrange_cats()
        if self._lens is not None:
            self._sync_grow()                            # назва / колір / лічильник збільшеної копії — як у плитки
        if not wanted:
            if self._cat_hint is None:
                self._cat_hint = tk.Label(
                    self.cat_list, anchor="w", justify="left", font=self.pf.small, fg=self.col(MUTED),
                    bg=self.col(PANEL), wraplength=int(max(190, self._left_w - 70) * self.scaling()),
                    text="Категорій ще немає.\nНатисніть «＋ Нова», щоб створити першу — "
                         "а потім перетягніть у неї записи.")
                self._cat_hint.pack(fill="x", padx=12, pady=10)
        elif self._cat_hint is not None:
            self._cat_hint.destroy()
            self._cat_hint = None
        if self.cat_tiles:
            cols, _, th = self._tile_dims()
            self._predict_scrollbar(self.cat_list, -(-len(wanted) // cols) * (th + 8) + 12)
        else:
            self._predict_scrollbar(self.cat_list, len(wanted) * (ROW_H + 6) + 12)

    def _tile_dims(self) -> tuple[int, float, int]:
        """(колонок, ширина плитки, висота плитки) для папок-плиток за поточною шириною лівої колонки.
        У режимі «спочатку папка» на сторінці вибору папки плитки займають усю ширину: 2–6 у ряд, більші."""
        if self._picking():
            w = max(300, self._pick_w)
            cols = max(2, min(6, int((w - 44) // PICK_TILE_MIN)))
            n = len(self.preset.categories)
            rows = 1
            if n:                                      # рівні ряди: 6 папок → 3×2, а не 4 + 2; блок — по центру
                rows = -(-n // cols)
                cols = max(1, -(-n // rows))
            # ширина — за ФАКТИЧНОЮ кількістю колонок (7 папок на широкому екрані — 4 + 3 ширші плитки, а не вузькі,
            # пораховані на 6 у ряд); 1 колонка — не ширша, ніж була б при двох
            tile_w = min(PICK_TILE_MAX, (w - 30 - 8 * (max(2, cols) - 1) - 14) / max(2, cols))
            th = max(110, min(170, tile_w * 0.6))
            ph = getattr(self, "_pick_h", 0)
            if ph > 200:                               # на низькому вікні плитки нижчі, щоб ряди вміщались
                try:
                    head = self.history_slot.winfo_y() / self.scaling()
                except tk.TclError:
                    head = 175
                fit = (ph - head - (ROW_H + 25)) / rows - 6
                th = max(92, min(th, fit))
            return cols, tile_w, int(th)
        cols = 3 if self._left_w >= CAT_TILE_MIN_LEFT else 2
        tile_w = (self._left_w - 30 - 8 * (cols - 1) - 14) / cols
        return cols, tile_w, int(max(84, min(132, tile_w * 0.86)))

    def _arrange_cats(self) -> None:
        """Розкладає рядки/плитки папок у лівій колонці (список — pack, плитки — grid по 2 або 3 в ряд)."""
        wanted = self._row_order
        picking = self._picking()
        if self.folder_first and not picking:
            # сторінка записів: ліва колонка схована — розкладати плитки нема для кого (раніше тут їх щоразу
            # перекладало в «класичні» 2–3 в ряд, а при поверненні — назад: ~25 перемальовувань ctk-фреймів туди й
            # назад). Розкладка сторінки вибору лишається як є і при поверненні не потребує жодної роботи.
            return
        top = 0
        if self.cat_tiles:
            cols, tile_w, th = self._tile_dims()
            if picking:                                  # стартова сторінка: блок плиток — по центру і по вертикалі
                rows = -(-len(wanted) // cols) if wanted else 0
                try:                                     # місце під шапкою (пресет, «Категорії») — не залежить від відступу
                    avail = (self.left.winfo_height() - self.history_slot.winfo_y()) / self.scaling() - 12
                except (tk.TclError, AttributeError):
                    avail = 0
                content = ROW_H + 4 + 9 + rows * (th + 6)   # «Історія» + лінія + плитки
                # без жодної папки — не центруємо: під «Історією» лише підказка «Категорій ще немає» (зверху списку)
                top = int(max(0, (avail - content) / 2)) if avail > 80 and wanted else 0
            sig = (True, picking, cols, th, tuple(wanted), int(tile_w // 10), top // 8)     # ширина плитки — кроками по 10 px (менше перемальовувань при тягненні границі)
        else:
            sig = (False, 1, 0, tuple(wanted), 0)
        if sig == self._cat_sig:
            if picking and self.cat_tiles:
                self._sync_grow()                        # блок плиток міг зсунутись (центрування) — лінза за ним
            return
        self._cat_sig = sig
        self._lens_geo = None                          # розкладка — заново; лінза — на нове місце після неї
        for key in wanted:
            obj = self._row_objs.get(key)
            if obj is not None and not obj.tile:
                obj.row.pack_forget()
        sc = self.scaling()
        if self.cat_tiles:
            off = 1 if picking else 0                    # у режимі вибору — порожні колонки-розпірки з боків
            for c in range(8):
                if picking:
                    side = c == 0 or c == cols + 1
                    self.cat_list.grid_columnconfigure(c, weight=1 if side else 0,
                                                       minsize=int(tile_w * sc) if 1 <= c <= cols else 0,
                                                       uniform="cattile" if 1 <= c <= cols else "")
                else:
                    self.cat_list.grid_columnconfigure(c, weight=1 if c < cols else 0, minsize=0,
                                                       uniform="cattile" if c < cols else "")
            wrap = int(max(40, tile_w - 24) * sc)
            font = self.pf.pick if picking else self.pf.bold
            for i, key in enumerate(wanted):
                obj = self._row_objs[key]
                obj.set_size(th, wrap, font, int(tile_w) if picking else None)
                obj.row.grid(row=i // cols, column=off + i % cols, padx=3, pady=3, sticky="nsew")
                obj.row.grid_propagate(False)               # висота плитки фіксована
            self._sync_grow()                            # не сторінка вибору — лінза ховається
        else:
            for key in wanted:
                self._row_objs[key].row.pack(fill="x", padx=6, pady=2)
        hist = self._row_objs.get(HISTORY)
        if hist is not None:
            # pack_configure — це tkinter напряму (ctk масштабує лише pack()): відступи — уже в пікселях
            self._hist_pad = None                        # розкладка змінилась (або масштаб) — місце «Історії» заново
            if picking and self.cat_tiles:
                hist.row.pack_configure(pady=(int((2 + top) * sc), int(2 * sc)))
                if not wanted:                           # папок не лишилось — «Історія» знову на всю ширину
                    hist.row.pack_configure(padx=int(6 * sc))
                elif getattr(self, "_hist_job", None) is None:
                    self._hist_job = self.root.after(30, self._center_history)
            else:
                hist.row.pack_configure(padx=int(6 * sc), pady=int(2 * sc))

    def _center_history(self) -> None:
        """Сторінка вибору папки: рядок «Історія буфера» — рівно над блоком плиток (за їхнім фактичним місцем)."""
        self._hist_job = None
        hist = self._row_objs.get(HISTORY)
        tiles = [self._row_objs[k].row for k in self._row_order if k in self._row_objs]
        if hist is None or not tiles or not self._picking() or not self.cat_tiles:
            return
        try:
            self.root.update_idletasks()
            cols = self._tile_dims()[0]
            first, last = tiles[0], tiles[min(cols, len(tiles)) - 1]
            sx, sw = self.history_slot.winfo_rootx(), self.history_slot.winfo_width()
            left = first.winfo_rootx() - sx
            right = sx + sw - (last.winfo_rootx() + last.winfo_width())
            if left < 0 or right < 0 or first.winfo_width() < 20:
                return
            pad = (left, right)                          # пікселі: pack_configure ctk не масштабує
            if pad != getattr(self, "_hist_pad", None):
                self._hist_pad = pad
                hist.row.pack_configure(padx=pad)
        except tk.TclError:
            pass

    def set_cat_view(self, mode: str) -> None:
        """Папки: список або плитки (по 2 чи 3 в ряд — залежно від ширини лівої колонки)."""
        tiles = mode == "tiles"
        if tiles == self.cat_tiles:
            return
        self.settings["cat_view"] = mode
        self._rebuild_cat_rows(tiles)

    def _rebuild_cat_rows(self, tiles: bool) -> None:
        self._drop_lens()
        self.cat_tiles = tiles
        for key in [k for k in self._row_objs if k != HISTORY]:     # рядки іншого вигляду — знищуємо, створяться заново
            obj = self._row_objs.pop(key)
            self._rows.pop(key, None)
            self._row_fills.pop(key, None)
            self._swatches.pop(key, None)
            self._row_keys.pop(obj.row, None)
            obj.destroy()
        self._row_order = []
        self._cat_sig = None
        self._sync_view_buttons()
        self._render_sidebar_now()

    def set_rec_view(self, mode: str) -> None:
        """Копіпасти: список або плитки («квадрати» із заокругленими краями)."""
        tiles = mode == "tiles"
        if tiles == self.rec_tiles:
            return
        self.rec_tiles = tiles
        self.settings["rec_view"] = mode
        self._reset_cards()
        for w in (self._empty_box, self._more_btn):
            if w is not None:
                w.destroy()
        self._empty_box = self._more_btn = None
        self._rec_sig = None
        self._card_pad, self._wrap = self._wrap_for(self._usable0 - self._sb_cur)
        self._sync_view_buttons()
        self.render_list(scroll_top=True)
        self.root.after(50, self._apply_wrap)

    def _sync_view_buttons(self) -> None:
        self.cat_view_btn.configure(text="☰" if self.cat_tiles else "▦")
        self.rec_view_btn.configure(text="☰ Список" if self.rec_tiles else "▦ Плитки")

    def _shape_button(self, parent, cat_id: str, big: bool = False) -> tk.Label:
        """Чорна фігура папки (замість кружечка): клік — колір папки, правий клік — меню (там і «Фігура…»)."""
        lbl = tk.Label(parent, text="●", font=self.pf.shape_big if big else self.pf.shape, cursor="hand2",
                       fg=self.col(TEXT), bg=self.col(PANEL), padx=2, pady=0)

        def click(e):
            self.on_category_color(cat_id)
            return "break"
        lbl.bind("<Button-1>", click)
        lbl.bind("<Enter>", lambda e: self.set_status("Клік по фігурі — колір папки · правий клік → «Фігура…»", 2500),
                 add="+")
        return lbl

    def _swatch(self, parent, color: str, on_click=None) -> ctk.CTkFrame:
        """Кружечок кольору. З on_click — це видима кнопка «змінити колір» (рамка при наведенні, рука)."""
        sw = ctk.CTkFrame(parent, width=18, height=18, corner_radius=9, fg_color=color, border_width=2,
                          border_color=PANEL, cursor="hand2" if on_click else "arrow")
        if on_click:
            def click(e):
                on_click()
                return "break"

            sw.bind("<Button-1>", click)
            sw.bind("<Enter>", lambda e: (sw.configure(border_color=TEXT),
                                          self.set_status("Клік по кружечку — змінити колір", 2500)))
            sw.bind("<Leave>", lambda e: sw.configure(border_color=PANEL))
        return sw

    # -- форматування (права колонка) -------------------------------------------
    def _visible_formats(self) -> list[dict]:
        """Формати, видимі у відкритому розділі: «Added cards» лише в папці «Suspicious login», USER — скрізь."""
        return self.preset.formats_for(None if self._is_history() else self.view)

    def _render_formats(self) -> None:
        visible = self._visible_formats()
        wanted = [f["id"] for f in visible]
        if self.sel_format and self.sel_format not in wanted:
            self.sel_format = None
            self._set_armed(False)
        for fid in [k for k in self._fmt_rows if k not in wanted]:
            self._fmt_rows.pop(fid).destroy()
            self._swatches.pop("fmt:" + fid, None)
        created = False
        for fmt in visible:
            row = self._fmt_rows.get(fmt["id"])
            if row is None:
                row = self._fmt_rows[fmt["id"]] = FormatRow(self, self.formats_slot, fmt)
                created = True
            row.update(fmt, fmt["id"] == self.sel_format)
        if created or self._fmt_order != wanted:
            for fid in self._fmt_order:
                if fid in self._fmt_rows:
                    self._fmt_rows[fid].row.pack_forget()
            for fid in wanted:
                self._fmt_rows[fid].row.pack(fill="x", padx=6, pady=3)
            self._fmt_order = wanted
        self._sync_format_panel()

    def _sync_format_panel(self) -> None:
        """Показує область введення для вибраного формату (або підказку, якщо нічого не вибрано)."""
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if fmt and fmt.get("type") in FORMATTERS:
            self.fmt_title.configure(text=fmt["name"])
            self._show_actions("append" in format_actions(fmt["type"]))
            self._show_result2(fmt["type"] not in SINGLE_RESULT_FORMATS)
            if not self.fmt_box.winfo_manager():
                self.fmt_box.pack(fill="x", padx=2, after=self.formats_slot)
        elif self._fmt_built:
            self._fmt_box.pack_forget()

    def _show_result2(self, on: bool) -> None:
        """Друге вікно результату («усі останні значення»): у «Added cards» його немає — там одне вікно."""
        parts = (self._fmt_lbl2, self._fmt_preview2, self._fmt_actions2)
        if on == bool(self._fmt_lbl2.winfo_manager()):
            return
        if not on:
            for w in parts:
                w.pack_forget()
            return
        self._fmt_lbl2.pack(fill="x", padx=16, pady=(6, 2), after=self._fmt_actions)
        self._fmt_preview2.pack(fill="x", padx=14, after=self._fmt_lbl2)
        self._fmt_actions2.pack(fill="x", padx=14, pady=(10, 4), after=self._fmt_preview2)

    def _show_actions(self, two: bool) -> None:
        """Одна кнопка (USER) або пара «Copy» / «Append» залежно від дій формату (і так само під другим вікном)."""
        self._fmt_copy2.configure(text="Copy усі" if two else
                                  ("Копіювати всі і сховати" if self.settings["autohide"] else "Копіювати всі"))
        if two:
            self._fmt_copy2.grid_configure(columnspan=1, padx=(0, 5))
            if not self._fmt_append2.winfo_manager():
                self._fmt_append2.grid(row=0, column=1, sticky="ew", padx=(5, 0))
        else:
            if self._fmt_append2.winfo_manager():
                self._fmt_append2.grid_remove()
            self._fmt_copy2.grid_configure(columnspan=2, padx=0)
        if two:
            if self._fmt_btn.winfo_manager():
                self._fmt_btn.pack_forget()
            if not self._fmt_pair.winfo_manager():
                self._fmt_pair.pack(fill="x")
        else:
            if self._fmt_pair.winfo_manager():
                self._fmt_pair.pack_forget()
            if not self._fmt_btn.winfo_manager():
                self._fmt_btn.pack(fill="x")

    def _fit_format_box(self) -> None:
        """На низькому вікні поле введення й перегляд результату стискаються (мін. 30 px), щоб кнопки не
        виходили за край правої колонки; якщо й цього мало — швидкі фрази тимчасово згортаються (до закриття формату
        або збільшення вікна; збережене налаштування не змінюється)."""
        try:
            fmt_open = self._fmt_built and bool(self._fmt_box.winfo_manager())
            if not fmt_open:
                self._phr_no_auto = False
            if getattr(self, "_phr_auto", False) and not fmt_open:
                self._phr_auto = False                      # формат закрито — фрази знову розгорнуті
                self._apply_phrases_collapse()
            if not fmt_open:
                return
            s = self.scaling()
            right_h = self.right.winfo_height() / s
            if right_h < 200:                       # колонку ще не розкладено
                return
            n_out = 2 if self._fmt_preview2.winfo_manager() else 1
            overhead = (self._fmt_box.winfo_reqheight() / s - self._fmt_heights[0]
                        - n_out * self._fmt_heights[1])       # усе в блоці, крім полів (введення + 1–2 результати)
            room = (right_h - 52 - self.formats_slot.winfo_reqheight() / s - self.refund_box.winfo_reqheight() / s
                    - overhead - 22 - (28 if self.append_armed else 0))
            auto = getattr(self, "_phr_auto", False)
            if not auto and not self._phrases_collapsed and room < 60 and not getattr(self, "_phr_no_auto", False):
                self._phr_full_h = self.refund_box.winfo_reqheight() / s
                self._phr_auto = True
                self._apply_phrases_collapse()             # місця замало — фрази згортаються, кнопки формату видно
                return
            if auto and room - (getattr(self, "_phr_full_h", 0) - self.refund_box.winfo_reqheight() / s) >= 60:
                self._phr_auto = False
                self._apply_phrases_collapse()
                return
            h_in = int(max(30, min(72, room / (1 + n_out))))
            h_out = int(max(30, min(74, (room - h_in) / n_out)))
            if (h_in, h_out) != self._fmt_heights:
                self._fmt_heights = (h_in, h_out)
                self.fmt_input.configure(height=h_in)
                self.fmt_preview.configure(height=h_out)
                self.fmt_preview2.configure(height=h_out)
        except tk.TclError:
            pass

    def select_format(self, fid: str) -> None:
        """Формат відкривається лише кліком по ньому; повторний клік згортає. Зміна формату скасовує Append."""
        new = None if fid == self.sel_format else fid
        if new != self.sel_format:
            self._set_armed(False)
            self._clear_format_input()
        self.sel_format = new
        self._render_formats()
        if self.sel_format:
            self._update_format_preview()          # з порожнім полем — одразу значення з історії буфера
        self.right.update_idletasks()
        self._fit_format_box()
        if self.sel_format:
            self.fmt_input.focus_set()

    def _collapse_format(self) -> None:
        """Згортає формат: без вибраного формату, без Append, з порожнім полем (при старті/ховання/зміна папки)."""
        self._clear_refunds()
        if self.sel_format is None and not self.append_armed and not self._fmt_built:
            return
        had = self.sel_format is not None
        self.sel_format = None
        self._set_armed(False)
        self._clear_format_input()
        if had:
            self._render_formats()

    def _sync_submit_label(self) -> None:
        if not self._fmt_built:
            return
        self._fmt_btn.configure(text="Копіювати і сховати" if self.settings["autohide"] else "Копіювати")

    def _in_format_input(self, event) -> bool:
        return self._fmt_built and getattr(event, "widget", None) is self._fmt_input._textbox

    def _on_format_return(self, event) -> str | None:
        if event.state & ALT_MASK:      # Alt+Enter — результат форматування + обрані швидкі фрази
            self.submit_with_phrases()
            return "break"
        if event.state & 0x1:           # Shift+Enter — звичайний новий рядок
            return None
        self.submit_format()
        return "break"

    def _on_return(self, event) -> None:
        if self._in_format_input(event) or self._picking():     # на сторінці вибору папки записів не видно
            return
        if self.sel_id:
            self.copy_item(self.sel_id)

    def _typed(self) -> str:
        return self.fmt_input.get("1.0", "end-1c") if self._fmt_built else ""

    def _format_input(self, fmt: dict, which: int = 1) -> str:
        """Що форматувати. Є текст у полі — він (і лише для першого вікна результату; друге тоді неактивне).
        Поле порожнє: перше вікно — ОДНЕ останнє числове значення з буфера, друге — УСІ останні числові значення
        (кілька записів поспіль і кілька чисел в одному записі через «,», «.», «;», «:» чи пробіл)."""
        raw = self._typed()
        if raw.strip():
            return raw if which == 1 else ""
        if fmt.get("type") in SINGLE_RESULT_FORMATS:     # «Added cards»: усі останні записи з 4 цифр, вікно одне
            return ", ".join(recent_four_digit_entries(self._history_texts())) if which == 1 else ""
        nums = recent_numbers(self._history_texts(), 1 if which == 1 else MAX_RECENT_NUMBERS)
        return ", ".join(nums)

    def _format_result(self, which: int = 1) -> str:
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if not fmt or not self._fmt_built:
            return ""
        return apply_format(fmt["type"], self._format_input(fmt, which))

    def _update_format_preview(self) -> None:
        out = self._format_result()
        self._set_preview(out)
        typed = bool(self._typed().strip())
        self._set_preview2("" if typed else self._format_result(2), active=not typed)
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if fmt and self._fmt_built:
            self.fmt_title.configure(text=fmt["name"] + ("   ·  значення з історії буфера" if not typed and out else ""))
        if self.append_armed and self.armed_src != "refund":
            if typed and self.armed_src == "format_all":
                self._set_armed(False)                  # друге вікно стало неактивним — його Append знімається
            else:
                self._refresh_banner(self._armed_result())

    def _set_preview(self, text: str) -> None:
        self.fmt_preview.configure(state="normal")
        self.fmt_preview.delete("1.0", "end")
        if text:
            self.fmt_preview.insert("1.0", text)
        self.fmt_preview.configure(state="disabled")

    def _set_preview2(self, text: str, active: bool = True) -> None:
        """Друге вікно результату: неактивне (сіре, кнопки вимкнено), коли в поле введення щось вставлено."""
        if not self._fmt_built:
            return
        box = self._fmt_preview2
        box.configure(state="normal")
        box.delete("1.0", "end")
        if text:
            box.insert("1.0", text)
        elif not active:
            box.insert("1.0", "Неактивне — використовується текст із поля введення (результат — у першому вікні)")
        box.configure(state="disabled", text_color=TEXT if active else FAINT,
                      fg_color=INPUT if active else PANEL)
        self._fmt_lbl2.configure(fg=self.col(MUTED if active else FAINT))
        ready = active and bool(text)
        for b in (self._fmt_copy2, self._fmt_append2):
            b.configure(state="normal" if ready else "disabled")
        self._fmt_copy2.configure(fg_color=ACCENT if ready else BTN2, text_color="#ffffff" if ready else FAINT)
        if not (self.append_armed and self.armed_src == "format_all"):
            self._fmt_append2.configure(text_color=TEXT if ready else FAINT)

    def _clear_format_input(self) -> None:
        if not self._fmt_built:
            return
        if self.fmt_input.get("1.0", "end-1c"):
            self.fmt_input.delete("1.0", "end")
        self._set_preview("")
        self._set_preview2("")

    def submit_format(self, which: int = 1) -> None:
        """Copy: результат форматування (перше вікно; which=2 — друге, «усі останні значення») → буфер обміну;
        поле вводу очищується; вікно ховається."""
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if not fmt:
            return
        out = self._format_result(which)
        if not out:
            self.set_status("Не знайдено жодного числа — нічого копіювати")
            return
        self.copy_to_clipboard(out)
        self.append_armed = False
        self._finish_pick("✓ Скопійовано: " + clip(out, 60), self._after_format_pick)

    def _after_format_pick(self, src: str = "format") -> None:
        """Після копіювання чистимо лише те джерело, з якого копіювали (поле формату або швидкі фрази)."""
        self._set_armed(False)
        if src == "refund":
            self._clear_refunds()
        else:
            self._clear_format_input()

    # -- режим Append: допис результату форматування до вибраного запису -----------------------------
    def arm_append(self, which: int = 1) -> None:
        """Кнопка «Append» (which=2 — «Append усі» під другим вікном): вмикає режим «заряджено» (повторне натискання
        — скасовує). Далі клік по запису копіює «текст запису + результат» (сам запис не змінюється) і ховає вікно."""
        src = "format_all" if which == 2 else "format"
        if self.append_armed and self.armed_src == src:
            self._set_armed(False)
            self.set_status("Режим Append скасовано")
            return
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if not fmt or "append" not in format_actions(fmt["type"]):
            return
        out = self._format_result(which)
        if not out:
            self.set_status("Введіть номери карток — поки немає що дописувати")
            return
        self._set_armed(True, src)
        self._refresh_banner(out)
        self.set_status("Append: клікніть запис — результат буде дописано в його кінець (Esc — скасувати)", 9000)

    def _set_armed(self, on: bool, src: str | None = None) -> None:
        self.append_armed = on
        self.armed_src = src if on else None
        if on and src == "refund" and self._fmt_built:
            on_fmt = False
        else:
            on_fmt = on
        if hasattr(self, "refund_append"):
            if on and src == "refund":
                self.refund_append.configure(fg_color=ARMED, hover_color=ARMED, border_color=ARMED,
                                             text_color=("#ffffff", "#1b1b1b"))
            elif self.refund_append.cget("state") == "normal":
                self.refund_append.configure(fg_color=BTN2, hover_color=BTN2_HOVER, border_color=BTN2, text_color=TEXT)
            else:
                self.refund_append.configure(fg_color=BTN2, border_color=BTN2)
        if self._fmt_built:
            for btn, bsrc in ((self._fmt_append, "format"), (self._fmt_append2, "format_all")):
                if on_fmt and src == bsrc:
                    btn.configure(fg_color=ARMED, hover_color=ARMED, border_color=ARMED,
                                  text_color=("#ffffff", "#1b1b1b"))
                else:
                    btn.configure(fg_color=BTN2, hover_color=BTN2_HOVER, border_color=BTN2,
                                  text_color=TEXT if (btn is self._fmt_append or btn.cget("state") == "normal")
                                  else FAINT)
            if on_fmt:
                if not self._fmt_armed_hint.winfo_manager():
                    self._fmt_armed_hint.pack(fill="x", padx=16, pady=(0, 8))
            elif self._fmt_armed_hint.winfo_manager():
                self._fmt_armed_hint.pack_forget()
        if on:
            if not self.armed_banner.winfo_manager():
                self.armed_banner.pack(fill="x", padx=18, pady=(0, 6), before=self.cards._parent_frame)
        elif self.armed_banner.winfo_manager():
            self.armed_banner.pack_forget()

    def _refresh_banner(self, result: str) -> None:
        self.armed_label.configure(
            text="Режим Append — клікніть запис: до нього допишеться\n«" + clip(result, 90) + "»  (Esc — скасувати)"
            if result else "Режим Append — клікніть запис (поле введення порожнє)  ·  Esc — скасувати")

    def _sync_banner(self) -> None:
        """Банер угорі: колір відкритої папки (як у її рядку ліворуч), для історії — нейтральний."""
        cat = None if (self._is_history() or self._picking() or self.tab == "links") else \
            self.preset.category(self.view)
        color = cat["color"] if cat else None
        _fill, _hover, sel, border = row_colors(color)
        sig = (color, self._dark)
        if getattr(self, "_banner_sig", None) == sig:          # configure ctk-фрейму = перемалювання — лише при зміні
            return
        self._banner_sig = sig
        bg = self.col(sel)
        self.banner.configure(fg_color=sel, border_color=border)
        self.banner_bar.configure(bg=self.col(color or NEUTRAL))
        self.banner_mid.configure(bg=bg)
        for w, fg in ((self.title_lbl, TEXT), (self.count_lbl, MUTED), (self.keys_lbl, MUTED)):
            w.configure(bg=bg, fg=self.col(fg))

    def _fit_banner(self) -> None:
        """Підказка клавіш праворуч ховається, якщо не влазить поруч із назвою по центру."""
        try:
            w = self.banner.winfo_width()
            if w <= 1:
                return
            mid_right = w / 2 + self.banner_mid.winfo_reqwidth() / 2
            keys_left = w - 14 - self.keys_lbl.winfo_reqwidth()
            fits = mid_right + 16 <= keys_left
            shown = bool(self.keys_lbl.winfo_manager())
            if fits and not shown:
                self.keys_lbl.grid()
            elif not fits and shown:
                self.keys_lbl.grid_remove()
            self.banner_mid.lift()
        except tk.TclError:
            pass

    def _view_name(self) -> str:
        if self._is_history():
            return "Історія буфера"
        return (self.preset.category(self.view) or {"name": ""})["name"]

    def _query(self) -> str:
        return self._search_text

    def _collect(self) -> list[dict]:
        q = self._query()
        if self._is_history():
            return self.history.view(q)
        return self.preset.snippets(self.view, q)

    def render_list(self, scroll_top: bool = False) -> None:
        if self._defer(scroll_top):
            return
        self._render_list_now(scroll_top)

    # -- список записів: інкрементально і порціями --------------------------------------
    # Картки, що вже існують, лишаються (оновлюються лише змінені); нові з'являються так: перші
    # FIRST_CHUNK — одразу (вистачає на перший екран), решта — порціями між подіями. Тому вікно
    # з'являється миттєво, а пошук/зміна кольору/видалення не перебудовують усе з нуля.
    def _render_list_now(self, scroll_top: bool = False) -> None:
        self.render_count += 1
        if hasattr(self, "_usable0"):                        # історія й папки резервують різну ширину справа
            self._apply_wrap_values(*self._wrap_for(self._usable0 - self._sb_cur))
        if self._chunk_job is not None:
            self.root.after_cancel(self._chunk_job)
            self._chunk_job = None
        self._todo = []
        canvas = self.cards._parent_canvas
        y = canvas.yview()[0]
        keep_pos = not scroll_top and y > 0.001
        self.shown = self._collect()
        if self.sel_id not in {i["id"] for i in self.shown}:
            self.sel_id = self.shown[0]["id"] if self.shown else None
        if self.checked:                       # галочки є лише в історії і лише для наявних записів
            self.checked = (self.checked & {i["id"] for i in self.history.items}) if self._is_history() else set()

        self._sync_title()
        self._sync_banner()
        self._layout_header()

        cells = self._cells_on()
        visible = self.shown if cells else self.shown[: self.limit]    # у сітці клітинок — усі плитки одразу
        self._order = ids = [i["id"] for i in visible]
        if cells:
            self._compute_cells(visible)
        keep = set(ids)
        for iid in [k for k in self._card_objs if k not in keep]:
            self._card_objs.pop(iid).destroy()
            self._cards.pop(iid, None)
            self._card_border.pop(iid, None)
        if self._empty_box is not None:
            self._empty_box.destroy()
            self._empty_box = None
        if self._more_btn is not None:
            self._more_btn.destroy()
            self._more_btn = None
        for it in visible:
            card = self._card_objs.get(it["id"])
            if card:
                card.sync(it)
                card.set_checked(it["id"] in self.checked)
                self._card_border[it["id"]] = card.border
        have = [i for i in ids if i in self._card_objs]
        if self.rec_tiles:
            self._packed = have
            self._regrid_cards(cells_ready=cells)
        else:
            if self._cell_ph:
                self._sync_cells()                 # рамки клітинок (grid) — геть до pack карток
            if [i for i in self._packed if i in self._card_objs] != have or len(self._packed) != len(have):
                for iid in self._packed:
                    if iid in self._card_objs:
                        self._card_objs[iid].frame.pack_forget()
                for iid in have:
                    self._card_objs[iid].frame.pack(fill="x", padx=self._card_pad, pady=4)
            self._packed = have
        if not self.shown:
            self._empty_state()
        if cells:
            est = self._cell_rows() * (self._rec_tile_h + 12) + 40
        elif self.rec_tiles:
            est = -(-len(visible) // self._rec_cols) * (self._rec_tile_h + 12) + 40
        else:
            est = len(visible) * CARD_EST_H + 40
        need_bar = self._predict_scrollbar(self.cards, est)
        self._set_scroll_space(need_bar, SCROLLBAR_W)

        self._todo = [it for it in visible if it["id"] not in self._card_objs]
        # при збереженій позиції прокрутки висоту потрібно знати одразу — тоді малюємо все (це рідкісний випадок)
        self._create_cards(len(self._todo) if keep_pos else FIRST_CHUNK)
        if scroll_top or not keep_pos:
            canvas.yview_moveto(0)
        else:
            self.cards.update_idletasks()
            canvas.yview_moveto(y)
        self._finish_pending = True
        if self._todo:
            if not self._hold_chunks:
                self._chunk_job = self.root.after(1, self._chunk_step)
        else:
            self._finish_render()

    def _regrid_cards(self, cells_ready: bool = False) -> None:
        """Плитки: розставляє вже створені картки за номером у списку, виставляє висоту й рівні колонки.
        cells_ready — клітинки щойно пораховано (_render_list_now), вдруге не рахуємо."""
        cols = self._rec_cols
        for c in range(5):
            self.cards.grid_columnconfigure(c, weight=1 if c < cols else 0, uniform="rectile" if c < cols else "")
        cells = self._cells_on()
        if cells and not cells_ready:
            order = set(self._order)                   # множина — один раз, а не на кожен запис (було O(n²))
            self._compute_cells([i for i in self.shown if i["id"] in order])
        for i, iid in enumerate(self._order):
            card = self._card_objs.get(iid)
            if card is None:
                continue
            card.set_tile_h(self._rec_tile_h)
            r, c = self._cell_of[iid] if cells and iid in self._cell_of else (i // cols, i % cols)
            card.frame.grid(row=r, column=c, padx=6, pady=6, sticky="nsew")
        self._sync_cells()
        self._sync_card_lens()

    # -- сітка клітинок: плитки записів стоять на своїх місцях (режим «спочатку папка») --------------------
    def _cells_on(self) -> bool:
        """Вільна сітка клітинок: режим «спочатку папка», записи плитками, папка (не історія), без фільтра."""
        return self.folder_first and self.rec_tiles and not self._is_history() and not self._query().strip()

    def _compute_cells(self, items: list[dict]) -> None:
        """Клітинка кожної плитки: збережена (якщо вміщається в поточну кількість колонок і не зайнята),
        решта — у перші вільні клітинки по порядку."""
        cols = max(1, self._rec_cols)
        out: dict[str, tuple[int, int]] = {}
        taken: dict[tuple[int, int], str] = {}
        for it in items:
            cell = it.get("cell")
            if cell and cell[1] < cols and tuple(cell) not in taken:
                rc = (int(cell[0]), int(cell[1]))
                out[it["id"]], taken[rc] = rc, it["id"]
        pos = 0
        for it in items:
            if it["id"] in out:
                continue
            while (pos // cols, pos % cols) in taken:
                pos += 1
            rc = (pos // cols, pos % cols)
            out[it["id"]], taken[rc] = rc, it["id"]
            pos += 1
        self._cell_of, self._cell_taken = out, taken

    def _cell_rows(self) -> int:
        last = max((r for r, _ in self._cell_of.values()), default=-1)
        try:
            vis = int(self.cards._parent_canvas.winfo_height() / ((self._rec_tile_h + 12) * self.scaling()))
        except (tk.TclError, AttributeError):
            vis = 0
        return max(last + 1 + CELL_EXTRA_ROWS, vis)

    def _sync_cells(self) -> None:
        """Рамки порожніх клітинок (ледь помітні): видно, куди можна поставити плитку."""
        want: set[tuple[int, int]] = set()
        if self._cells_on() and self.shown:
            cols = self._rec_cols
            for r in range(self._cell_rows()):
                for c in range(cols):
                    if (r, c) not in self._cell_taken:
                        want.add((r, c))
        for rc in [k for k in self._cell_ph if k not in want]:
            self._cell_ph.pop(rc).destroy()
        s = self.scaling()
        h, pad = int(self._rec_tile_h * s), int(6 * s)
        same_h = h == getattr(self, "_cell_ph_h", None)     # висота наявних рамок уже та — не питаємо кожну (cget)
        self._cell_ph_h = h
        for rc in sorted(want - self._cell_ph.keys()) if same_h else sorted(want):
            ph = self._cell_ph.get(rc)
            if ph is None:
                ph = self._cell_ph[rc] = tk.Frame(self.cards, bg=self.col(PANEL), height=h, highlightthickness=1,
                                                  highlightbackground=self.col(CELL_LINE))
                ph.grid(row=rc[0], column=rc[1], padx=pad, pady=pad, sticky="nsew")
            elif int(ph.cget("height")) != h:
                ph.configure(height=h)

    def _cell_at(self, x: int, y: int) -> tuple[int, int] | None:
        """Клітинка сітки під курсором (зокрема порожня й нижче останнього ряду)."""
        canvas = self.cards._parent_canvas
        if not self._inside(canvas, x, y):
            return None
        try:
            c, r = self.cards.grid_location(x - self.cards.winfo_rootx(), y - self.cards.winfo_rooty())
        except tk.TclError:
            return None
        if r < 0 or c < 0 or c >= self._rec_cols:
            return None
        return (min(r, self._cell_rows() + CELL_EXTRA_ROWS), c)

    def _mark_cell(self, rc: tuple[int, int] | None, on: bool) -> None:
        ph = self._cell_ph.get(rc) if rc else None
        if ph is not None:
            try:
                ph.configure(highlightthickness=2 if on else 1,
                             highlightbackground=self.col(ACCENT if on else CELL_LINE))
            except tk.TclError:
                pass

    def _move_to_cell(self, iid: str, rc: tuple[int, int]) -> bool:
        """Ставить плитку в клітинку; зайнята клітинка — плитки міняються місцями. Зберігає всю розкладку папки."""
        old = self._cell_of.get(iid)
        if old is None or old == rc:
            return False
        other = self._cell_taken.get(rc)
        # плитки, чия збережена клітинка — правіше, ніж є колонок у вузькому вікні, стоять тимчасово в першій вільній:
        # їхнє справжнє місце не перезаписуємо (у ширшому вікні вони повернуться туди)
        wide = {i["id"] for i in self.shown if i.get("cell") and i["cell"][1] >= self._rec_cols}
        cells = {k: v for k, v in self._cell_of.items() if k not in wide or k in (iid, other)}
        cells[iid] = rc
        if other is not None and other != iid:
            cells[other] = old
        self.preset.set_snippet_cells(cells)
        return True

    def _nav_cells(self, k: str, edges: bool = True) -> None:
        """Alt+W/A/S/D у сітці клітинок: W/S — до найближчої заповненої клітинки в тому ж стовпчику (немає — стоїмо);
        A/D — у тому ж ряду, а якщо там порожньо — до найближчої плитки лівіше/правіше в інших рядах.
        edges=False (стрілки) — з краю нікуди не переходимо (ні до папок, ні в праву колонку)."""
        cur = self._cell_of.get(self.sel_id)
        if cur is None and edges and k in ("a", "d"):
            # нічого ще не вибрано — як у списку й звичайних плитках: Alt+A — до папок, Alt+D — у праву колонку
            self.back_to_folders() if k == "a" else self._nav_enter_right()
            return
        if cur is None:
            first = min(self._cell_of.items(), key=lambda kv: kv[1], default=None)
            if first:
                self._select_card(first[0])
            return
        cr, cc = cur
        if k in ("w", "s"):
            # строго в тому ж стовпчику: найближча заповнена клітинка вище/нижче (порожні пропускаються);
            # немає — лишаємось на місці (у сусідній стовпчик — лише Alt+A / Alt+D)
            cand = [(abs(r - cr), 0, iid) for iid, (r, c) in self._cell_of.items()
                    if c == cc and (r < cr if k == "w" else r > cr)]
        else:
            # A/D: спершу той самий ряд; якщо там порожньо — найближча плитка лівіше/правіше в БУДЬ-ЯКОМУ ряду
            # (найменша різниця стовпчиків, потім рядків); лише якщо в цьому напрямку плиток немає зовсім —
            # до папок (A) чи у швидкі фрази (D)
            side = [(r, c, iid) for iid, (r, c) in self._cell_of.items() if (c < cc if k == "a" else c > cc)]
            cand = [(abs(c - cc), 0, iid) for r, c, iid in side if r == cr] or \
                   [(abs(c - cc), abs(r - cr), iid) for r, c, iid in side]
        if cand:
            self._select_card(min(cand)[2])
        elif k == "a" and edges:
            self.back_to_folders()
        elif k == "d" and edges:
            self._nav_enter_right()

    def _select_card(self, iid: str) -> None:
        self.sel_id = iid
        self._highlight_selection()
        card = self._card_objs.get(iid)
        if card is not None:
            self._ensure_visible_in(self.cards, card.frame)

    def _place_extra(self, widget, **kw) -> None:
        """«Показати ще…» і порожній стан: у плитках — окремий рядок сітки, у списку — pack."""
        if self.rec_tiles:
            widget.grid(row=5000, column=0, columnspan=5, sticky="ew", pady=kw.get("pady", 6))
        else:
            widget.pack(**kw)

    def _create_cards(self, n: int) -> None:
        if not self._todo or n <= 0:
            return
        wrap_px = int(self._wrap * self.scaling())
        for _ in range(min(n, len(self._todo))):
            it = self._todo.pop(0)
            iid = it["id"]
            card = Card(self, self.cards, it, self._card_pad, wrap_px, selected=iid == self.sel_id,
                        checkable=self._is_history(), checked=iid in self.checked, tile=self.rec_tiles)
            self._card_objs[iid] = card
            self._cards[iid] = card.frame
            self._card_border[iid] = card.border
            idx = self._order.index(iid)
            if self.rec_tiles:                     # плитки: клітинка сітки за номером у списку (або вільна клітинка)
                cell = self._cell_of.get(iid) if self._cells_on() else None
                r, c = cell if cell else (idx // self._rec_cols, idx % self._rec_cols)
                card.frame.grid(row=r, column=c, padx=6, pady=6, sticky="nsew")
                continue
            # список: ставимо ПЕРЕД найближчою наступною вже створеною карткою
            nxt = next((self._card_objs[j].frame for j in self._order[idx + 1:] if j in self._card_objs), None)
            card.frame.pack(fill="x", padx=self._card_pad, pady=4, **({"before": nxt} if nxt is not None else {}))
        self._packed = [i for i in self._order if i in self._card_objs]
        self._wrap_labels = [self._card_objs[i].body for i in self._packed]

    def _chunk_step(self) -> None:
        self._chunk_job = None
        self._create_cards(NEXT_CHUNK)
        if self._todo:
            self._chunk_job = self.root.after(1, self._chunk_step)
        else:
            self._finish_render()

    def _finish_render(self) -> None:
        self._finish_pending = False
        self._wrap_labels = [self._card_objs[i].body for i in self._order if i in self._card_objs]
        if len(self.shown) > self.limit and self._more_btn is None and not self._cells_on():
            more = len(self.shown) - self.limit
            self._more_btn = ctk.CTkButton(self.cards, text=f"Показати ще ({more})", height=34, corner_radius=10,
                                           fg_color=BTN2, hover_color=BTN2_HOVER, text_color=TEXT,
                                           font=self.f.body, command=self._show_more)
            self._place_extra(self._more_btn, pady=8)
        self._highlight_selection()
        self.root.after_idle(self._sync_scrollbars)

    def _show_more(self) -> None:
        self.limit += PAGE
        self.render_list()

    # -- шапка історії: «Очистити», «Об'єднати і копіювати (N)», рядок вибору -----------------------
    def _layout_header(self) -> None:
        """Розкладає кнопки шапки (порядок справа наліво: перемикач вигляду, «Очистити історію», «Об'єднати і
        копіювати») і рядок вибору «Вибрати все / Вибрано: N» під нею. В історії «Об'єднати» видно ЗАВЖДИ, але вона
        неактивна, поки не відмічено хоча б 2 записи. У вузькій панелі ця кнопка йде в рядок вибору."""
        in_hist = self._is_history()
        n = len(self.checked)
        wide = self._mid_w >= WIDE_HEADER
        can = n >= 2
        # викликається на кожен render і зміну ширини: configure ctk-кнопки = повне перемалювання, а pack_forget/pack —
        # перерозкладка шапки, тож усе це — лише коли щось справді змінилось
        packed = (bool(self.clear_btn.winfo_manager()), bool(self.merge_btn.winfo_manager()))
        if packed != (in_hist, in_hist and wide):
            for w in (self.clear_btn, self.merge_btn):
                if w.winfo_manager():
                    w.pack_forget()
            if in_hist:
                self.clear_btn.pack(side="right", padx=(0, 8))
                if wide:
                    self.merge_btn.pack(side="right", padx=(0, 8))
        label = f"Об'єднати і копіювати ({n})" if n else "Об'єднати і копіювати"
        if getattr(self, "_merge_sig", None) != (label, can):
            self._merge_sig = (label, can)
            for btn in (self.merge_btn, self.merge_btn2):
                btn.configure(text=label, state="normal" if can else "disabled",
                              fg_color=ACCENT if can else BTN2, text_color="#ffffff" if can else FAINT)
        if in_hist:
            empty = not self.history.items
            if getattr(self, "_clear_sig", None) != empty:
                self._clear_sig = empty
                self.clear_btn.configure(state="disabled" if empty else "normal",
                                         border_color=FAINT if empty else DANGER)
        # рядок вибору під шапкою
        if in_hist:
            all_on = bool(self.shown) and all(i["id"] in self.checked for i in self.shown)
            sel_text = "Зняти вибір" if all_on else "Вибрати все"
            if getattr(self, "_sel_all_text", None) != sel_text:
                self._sel_all_text = sel_text
                self.sel_all_btn.configure(text=sel_text)
            count_text = f"Вибрано: {n}" if n else ""
            if self.sel_count.cget("text") != count_text:
                self.sel_count.configure(text=count_text)
            if bool(self.merge_btn2.winfo_manager()) != (not wide):
                if self.merge_btn2.winfo_manager():
                    self.merge_btn2.pack_forget()
                if not wide:
                    self.merge_btn2.pack(side="right")
            if not self.sel_bar.winfo_manager():
                self.sel_bar.pack(fill="x", padx=18, pady=(0, 6), before=self.cards._parent_frame)
        elif self.sel_bar.winfo_manager():
            self.sel_bar.pack_forget()

    def toggle_check(self, iid: str) -> None:
        """Галочка біля запису історії: вибір кількох значень (клік по картці при цьому не копіює)."""
        if iid in self.checked:
            self.checked.discard(iid)
        else:
            self.checked.add(iid)
        card = self._card_objs.get(iid)
        if card:
            card.set_checked(iid in self.checked)
        if self._clens is not None and self._clens.iid == iid:
            self._clens.set_checked(iid in self.checked)
        self._layout_header()

    def toggle_check_all(self) -> None:
        ids = [i["id"] for i in self.shown]
        if ids and all(i in self.checked for i in ids):
            self.checked.difference_update(ids)
        else:
            self.checked.update(ids)
        for iid, card in self._card_objs.items():
            card.set_checked(iid in self.checked)
        self._layout_header()

    def clear_checked(self) -> None:
        if self.checked:
            self.checked.clear()
            for card in self._card_objs.values():
                card.set_checked(False)
            self._layout_header()

    def merge_checked(self, anchor=None) -> None:
        """«Об'єднати і копіювати»: при ≥ 2 відмічених записах історії відкриває меню варіантів склеювання
        (реєстр MERGE_ACTIONS у formats.py): Suspicious cards / Test cards / просто об'єднати."""
        if len(self._checked_texts()) < 2:
            self.set_status("Відмітьте галочками щонайменше 2 записи в історії")
            return
        m = self._new_menu()
        for aid, label, _tpl in MERGE_ACTIONS:
            m.add_command(label, lambda a=aid: self.merge_with(a), icon="⊕" if aid == "plain" else "❯")
        btn = anchor or (self.merge_btn if self.merge_btn.winfo_manager() else self.merge_btn2)
        self._popup(m, btn.winfo_rootx(), btn.winfo_rooty() + btn.winfo_height() + 4)

    def _checked_texts(self) -> list[str]:
        """Тексти відмічених записів історії у хронологічному порядку (від старішого до новішого)."""
        return [it["text"] for it in reversed(self.history.items) if it["id"] in self.checked]   # історія: найновіші — першими

    def merge_with(self, action_id: str) -> None:
        texts = self._checked_texts()
        out = apply_merge(action_id, texts)
        if len(texts) < 2 or not out:
            self.set_status("Відмітьте галочками щонайменше 2 записи в історії")
            return
        self.copy_to_clipboard(out)
        self.checked = set()
        self._finish_pick(f"✓ Об'єднано {len(texts)} і скопійовано: " + clip(out.replace("\n", " "), 60),
                          self._after_merge)

    def _after_merge(self) -> None:
        for card in self._card_objs.values():
            card.set_checked(False)
        self._layout_header()

    def _empty_state(self) -> None:
        if self._query().strip():
            title, text = "Нічого не знайдено", "Спробуйте інший запит або очистіть пошук (Esc)."
        elif self._is_history():
            title = "Історія порожня"
            text = ("Скопіюйте будь-який текст — він з'явиться тут.\n"
                    "Потрібні записи перетягніть мишею в категорію, щоб зберегти їх у пресеті.")
        elif not self.preset.categories:
            title, text = "Створіть першу категорію", "Натисніть «＋ Нова» ліворуч."
        else:
            title = "У цій категорії ще порожньо"
            # у режимі «спочатку папка» історія й папка не видно разом — перетягнути нема звідки
            text = ("Натисніть «＋ Додати» або збережіть запис з історії буфера: «⋯» → «Зберегти в категорію»."
                    if self.folder_first else
                    "Натисніть «＋ Додати» або перетягніть сюди запис з історії буфера.")
        box = self._empty_box = ctk.CTkFrame(self.cards, fg_color="transparent")
        self._place_extra(box, fill="x", pady=70)
        ctk.CTkLabel(box, text=title, text_color=TEXT, font=self.f.bold).pack()
        ctk.CTkLabel(box, text=text, text_color=MUTED, font=self.f.body, justify="center",
                     wraplength=max(200, self._wrap)).pack(pady=(6, 0))

    def _on_mid_resize(self, event: tk.Event) -> None:
        # bind() у CTkFrame вішається на його внутрішнє полотно, тож event.widget — це _canvas, а не сам фрейм
        if event.widget not in (self.mid, getattr(self.mid, "_canvas", None)):
            return
        mid_w = int(event.width / self.scaling())
        if abs(mid_w - self._mid_w) < 2 and self._wrap_job is None and self._first_map_done:
            return                              # розмір не змінився відносно плану — переносити нічого
        self._mid_w = mid_w
        if self._wrap_job:
            self.root.after_cancel(self._wrap_job)
        self._wrap_job = self.root.after(60, self._apply_wrap)

    def _apply_wrap(self) -> None:
        """Ширина й поля карток від ширини центральної панелі: картки не ширші за CARD_MAX
        (на великому екрані вони центруються), довгий текст переноситься по ширині картки."""
        self._wrap_job = None
        self._layout_header()                      # кнопка «Об'єднати» — у шапці чи під нею залежно від ширини
        if self._cell_ph or self._cells_on():
            self._sync_cells()                     # вища панель — більше рядів порожніх клітинок
        self._sync_scrollbars()                    # від цього залежить ширина полотна
        try:
            self.cards.update_idletasks()
            usable = int(self.cards._parent_canvas.winfo_width() / self.scaling())
        except (tk.TclError, AttributeError):
            usable = 0
        if usable < 200:                           # вікно ще не розкладено — груба оцінка
            usable = self._mid_w - 28
        else:
            self._usable0 = usable + self._sb_cur  # актуальна ширина списку (границю між колонками можна рухати)
        pad, wrap = self._wrap_for(usable)
        self._apply_wrap_values(pad, wrap)
        self._sync_scrollbars()

    def _relayout_now(self) -> None:
        """Синхронна розкладка за поточним розміром вікна (на показі — до того, як вікно стане видимим)."""
        if self._wrap_job:
            self.root.after_cancel(self._wrap_job)
        try:
            self._apply_layout(self.root.winfo_width())
            self.root.update_idletasks()
            self._mid_w = int(self.mid.winfo_width() / self.scaling())
            self._apply_wrap()
            self.root.update_idletasks()
        except tk.TclError:
            pass

    def _set_left_width(self, lw: int) -> None:
        """Нова ширина лівої колонки (вікно змінило розмір або користувач пересунув границю)."""
        self._left_w = lw
        self.left.configure(width=lw)
        cols = 3 if lw >= CAT_TILE_MIN_LEFT else 2
        chars = max(12, int((lw - 150) / 9.0))
        if chars != self._name_chars:
            self._name_chars = chars
            self.render_sidebar()
        if cols != self._cat_cols:
            self._cat_cols = cols
        if self.cat_tiles:
            self._arrange_cats()

    def _splitter_press(self, e) -> None:
        self._split = (e.x_root, self._left_w)

    def _splitter_motion(self, e) -> None:
        if not getattr(self, "_split", None):
            return
        x0, w0 = self._split
        s = self.scaling()
        lw = int(self._left_cap(self.root.winfo_width() / s, w0 + (e.x_root - x0) / s))
        self._split_pending = lw                       # застосовуємо не частіше ніж раз на 50 мс (без ривків)
        if getattr(self, "_split_job", None) is None:
            self._split_job = self.root.after(50, self._splitter_apply)

    def _splitter_apply(self) -> None:
        self._split_job = None
        lw = getattr(self, "_split_pending", None)
        if lw is not None and lw != self._left_w:
            self._left_user = lw
            self._set_left_width(lw)

    def _splitter_release(self, e) -> None:
        if getattr(self, "_split_job", None) is not None:
            self.root.after_cancel(self._split_job)
            self._split_job = None
        if getattr(self, "_split", None):
            self._splitter_apply()
            self._split = None
            self.settings["left_w"] = int(self._left_user)

    def _splitter_reset(self, e=None) -> None:
        """Подвійний клік по границі — повернути автоматичну ширину."""
        self._left_user = 0
        self.settings["left_w"] = 0
        self._set_left_width(self._left_for(self.root.winfo_width() / self.scaling()))

    def _apply_layout(self, width_px: int) -> None:
        """Бічні колонки ростуть разом із вікном: ліва clamp(280, 17%, 380), права clamp(344, 22%, 480)."""
        w = width_px / self.scaling()
        lw = self._left_for(w)
        rw = int(min(RIGHT_MAX, max(RIGHT_W, w * RIGHT_FRAC)))
        if abs(lw - self._left_w) >= 3:
            self._set_left_width(lw)
        if abs(rw - self._right_w) >= 3:
            self._right_w = rw
            self.right.configure(width=rw)
            if self._fmt_built:
                self._fmt_armed_hint.configure(wraplength=int((rw - 40) * self.scaling()))
            self._phrase_sig = None                  # фрази переносяться за новою шириною колонки
            self.root.after_idle(self._render_phrases)

    def _predict_scrollbar(self, sf, est_h: int) -> bool:
        """Смугу прокрутки вирішуємо за кількістю рядків ДО розкладки, а не після: інакше вона «вистрибує»
        посеред малювання й відбирає ~13 px ширини в уже намальованих карток. Повертає, чи вона потрібна."""
        try:
            canvas, bar = sf._parent_canvas, sf._scrollbar
            h = canvas.winfo_height()
            if h < 80:                              # розкладки ще не було — беремо висоту з розміру вікна
                h = int(self.settings["height"] * self.scaling()) - 190
            need = est_h * self.scaling() > h
            if need and not bar.winfo_manager():
                bar.grid()
            elif not need and bar.winfo_manager():
                bar.grid_remove()
                bar._last_geometry_manager_call = None   # інакше ctk покаже її знову при зміні DPI
            return need
        except (tk.TclError, AttributeError):
            return False

    def _sync_scrollbars(self) -> None:
        """Точне виправлення смуги прокрутки за фактичною висотою вмісту (виконується в паузі, без примусової розкладки)."""
        for sf in (self.cat_list, self.cards):
            try:
                canvas, bar = sf._parent_canvas, sf._scrollbar
                if canvas.winfo_height() < 80:       # ще не розкладено (вікно сховане) — лишаємо передбачення
                    continue
                box = canvas.bbox("all")
                need = bool(box) and (box[3] - box[1]) > canvas.winfo_height() + 1
                if need == bool(bar.winfo_manager()):
                    continue
                if need:
                    bar.grid()
                else:
                    bar.grid_remove()
                bar._last_geometry_manager_call = None   # інакше ctk покаже її знову при зміні DPI
                if sf is self.cat_list and self._picking() and getattr(self, "_hist_job", None) is None:
                    # смуга з'явилась / зникла — блок плиток зсунувся: «Історія» знову рівно над ним
                    self._hist_job = self.root.after(30, self._center_history)
            except (tk.TclError, AttributeError):
                pass

    # -- вибір і клавіатура -------------------------------------------------
    def _highlight_selection(self) -> None:
        for iid, card in self._card_objs.items():
            card.set_selected(iid == self.sel_id)      # змінюється рамка лише в тих, у кого змінився стан
        self._sync_card_lens()

    # -- вибраний запис — збільшена копія поверх списку (як папка під «курсором»); самі картки не змінюються ----------
    def _sync_card_lens(self) -> None:
        if getattr(self, "_clens_job", None) is None:
            try:
                self._clens_job = self.root.after_idle(self._card_lens_now)
            except tk.TclError:
                self._clens_job = None

    def _card_lens_target(self) -> str | None:
        iid = self.sel_id
        if not iid or iid not in self._card_objs or self._picking() or self.page != "records" and self.folder_first:
            return None
        return iid

    def _card_lens_now(self) -> None:
        """Вибраний запис (клавіатурний «курсор» або клік) — його копія на 15 % більша, з яскравою рамкою, поверх
        сусідніх карток. Картка в списку/сітці лишається на своєму місці й свого розміру."""
        self._clens_job = None
        iid = self._card_lens_target()
        card = self._card_objs.get(iid) if iid else None
        item = next((i for i in self.shown if i["id"] == iid), None) if card is not None else None
        if card is None or item is None:
            if self._clens is not None and self._clens.iid not in self._card_objs:
                self._drop_card_lens()             # запису в списку вже немає — копію знищуємо (не лише ховаємо)
            else:
                self._hide_card_lens()
            return
        f = card.frame
        try:
            self.root.update_idletasks()
            if not f.winfo_manager() or not f.winfo_ismapped():
                self._hide_card_lens()
                return
            w, h, x, y = f.winfo_width(), f.winfo_height(), f.winfo_x(), f.winfo_y()
            if w < 20 or h < 20:
                self._hide_card_lens()
                return
            sc = self.scaling()
            lens = self._clens
            if (lens is None or lens.iid != iid or lens.tile != card.tile or not lens.frame.winfo_exists()
                    or lens.frame.master is not f.master or bool(lens.check) != bool(card.check)):
                self._drop_card_lens()
                lens = self._clens = Card(self, f.master, item, self._card_pad, int(card.body.cget("wraplength")),
                                          selected=True, checkable=card.check is not None,
                                          checked=iid in self.checked, tile=card.tile)
                lens.lens = True
                lens.frame.configure(bg_color=NAV_MARK, corner_radius=8)
                # службова смужка (⋯, ✕) і текст — усередині товстої рамки (інакше налазять на неї в кутку)
                v = int((NAV_MARK_W + 1) * sc)
                if card.tile:
                    lens.zone.grid_configure(padx=(0, int((NAV_MARK_W + 3) * sc)), pady=(v, 0))
                    lens.clip.grid_configure(pady=(0, max(8, v + 2)))
                else:
                    lens.zone.grid_configure(padx=(0, int((NAV_MARK_W + 3) * sc)), pady=v)
                    lens.body.grid_configure(pady=v)
                self._clens_geo = None
            else:
                lens.sync(item)
                lens.set_checked(iid in self.checked)
            if lens.frame.cget("border_width") != NAV_MARK_W or lens.frame.cget("border_color") != NAV_MARK:
                lens.frame.configure(border_width=NAV_MARK_W, border_color=NAV_MARK)
            if card.tile:
                gw, gh = round(w * TILE_GROW), round(h * TILE_GROW)
            else:                              # список — на всю ширину: убік лише в поля, решта — у висоту
                gw = min(round(w * TILE_GROW), w + 2 * int(self._card_pad * sc))
                gh = round(h * TILE_GROW)
            mw, mh = f.master.winfo_width(), f.master.winfo_height()
            gx = min(max(0.0, x - (gw - w) / 2), max(0.0, mw - gw))      # не вилазить за краї списку
            gy = min(max(0.0, y - (gh - h) / 2), max(0.0, mh - gh))
            geo = (x, y, w, h, gw, gh, gx, gy)
            if geo != self._clens_geo:
                lens.body.configure(wraplength=max(40, int(card.body.cget("wraplength")) + gw - w))
                _ctk_resize(lens.frame, int(gw / sc), int(gh / sc))
                lens.frame.place(x=gx / sc, y=gy / sc)
                lens.frame.grid_propagate(False)           # розмір — заданий, а не «за вмістом»
                lens.frame.pack_propagate(False)
                self._clens_geo = geo
            lens.frame.lift()
        except (tk.TclError, ValueError, AttributeError):
            self._hide_card_lens()

    def _hide_card_lens(self) -> None:
        self._clens_geo = None
        lens = self._clens
        if lens is not None:
            try:
                if lens.frame.winfo_manager():
                    lens.frame.place_forget()
            except tk.TclError:
                self._clens = None

    def _drop_card_lens(self) -> None:
        lens, self._clens = self._clens, None
        self._clens_geo = None
        if lens is not None:
            lens.destroy()

    def _card_for(self, widget, iid: str | None):
        """Картка, якій належить віджет: збільшена копія вибраного запису або сама картка."""
        lens = self._clens
        if lens is not None and lens.iid == iid and str(widget).startswith(str(lens.frame)):
            return lens
        return self._card_objs.get(iid) if iid else None

    def _flash_card(self, iid: str) -> None:
        for c in (self._card_objs.get(iid), self._clens if self._clens is not None and self._clens.iid == iid else None):
            if c is not None:
                c.flash()

    def _arrow_h(self, e, delta: int):
        """← / → у режимі плиток рухають виділення по ряду (у полях введення — звичайний рух курсора)."""
        if not self.rec_tiles or isinstance(e.widget, (tk.Entry, tk.Text)) or self._picking():
            return None
        if self._cells_on() and self._cell_of:          # сітка клітинок: сусідня плитка на екрані, а не в списку
            self._nav_cells("d" if delta > 0 else "a", edges=False)
            return "break"
        return self._move_sel(delta)

    def _arrow_v(self, delta: int):
        """↑ / ↓: на ряд вище/нижче (плитки) або на запис (список)."""
        if self._picking():                              # записів на сторінці вибору папки не видно
            return None
        if self._cells_on() and self._cell_of:
            self._nav_cells("s" if delta > 0 else "w", edges=False)
            return "break"
        return self._move_sel(delta * (self._rec_cols if self.rec_tiles else 1))

    # -- клавіатурна навігація Alt+W/A/S/D, Space, Alt+Space ---------------------------------------------
    _NAV_KEYSYMS = {
        "w": "w", "cyrillic_tse": "w",
        "s": "s", "ukrainian_i": "s", "cyrillic_yeru": "s",
        "a": "a", "cyrillic_ef": "a",
        "d": "d", "cyrillic_ve": "d",
        "space": "space",
    }
    _NAV_VK = {87: "w", 83: "s", 65: "a", 68: "d", 32: "space"}          # Windows: віртуальні коди не залежать від розкладки
    _NAV_X11 = {25: "w", 39: "s", 38: "a", 40: "d", 65: "space"}

    def _nav_key(self, e) -> str | None:
        k = self._NAV_KEYSYMS.get(str(getattr(e, "keysym", "")).lower())
        if k:
            return k
        table = self._NAV_VK if os.name == "nt" else self._NAV_X11
        return table.get(getattr(e, "keycode", None))

    def _nav_focus(self, e=None) -> None:
        """Клік не в поле введення забирає фокус із поля (формат, фрази) — інакше Space і Alt+W/A/S/D
        «застрягали» в полі введення формату після його вибору."""
        w = getattr(e, "widget", None)
        if isinstance(w, (tk.Entry, tk.Text)):
            return
        try:
            if w is not None and w.winfo_toplevel() is not self.root:
                return
            if isinstance(self.root.focus_get(), (tk.Entry, tk.Text)):
                self.root.focus_set()
        except (tk.TclError, KeyError, AttributeError):
            pass

    def _typing(self, e) -> bool:
        return isinstance(getattr(e, "widget", None), (tk.Entry, tk.Text))

    def _on_alt_key(self, e):
        k = self._nav_key(e)
        if k is None:
            return None
        if k == "space":
            self.on_alt_space()
        else:
            self.nav_move(k)
        return "break"                         # не віддаємо Alt+… системі (меню вікна) і полям введення

    def _on_space(self, e):
        if self._typing(e) or self._modal:
            return None
        if getattr(e, "state", 0) & ALT_MASK:           # Alt+Space обробляє _on_alt_key
            return None
        self.log(f"space zone={self.nav_zone} sel={str(self.sel_id)[:8]}")
        self.nav_activate(hide=None)
        return "break"

    # -- режим «спочатку папка»: сторінка вибору папки → сторінка записів ---------------------------------
    def _picking(self) -> bool:
        """Зараз видно сторінку вибору папки (режим «спочатку папка»)."""
        return self.folder_first and self.page == "folders"

    def _apply_page(self) -> None:
        """Розкладка колонок за режимом: класичний (папки | границя | записи) або одна з двох сторінок."""
        if not self.folder_first:
            self.left.grid(row=0, column=0, columnspan=1, sticky="nsew", padx=0)
            self.splitter.grid()
            self.mid.grid(row=0, column=2, columnspan=1, sticky="nsew", padx=(0, 7))
        elif self.page == "folders":
            self.mid.grid_forget()          # не grid_remove: ctk при зміні масштабу (DPI) повертає «сховані» так віджети
            self.splitter.grid_remove()
            self.left.grid(row=0, column=0, columnspan=3, sticky="nsew", padx=(0, 7))
        else:
            self.left.grid_forget()
            self.splitter.grid_remove()
            self.mid.grid(row=0, column=0, columnspan=3, sticky="nsew", padx=(0, 7))
        show_back = self.folder_first and self.page == "records"
        if show_back and not self.back_btn.winfo_manager():
            self.back_btn.pack(side="left")
        elif not show_back and self.back_btn.winfo_manager():
            self.back_btn.pack_forget()
        if self.folder_first and self.cat_view_btn.winfo_manager():
            self.cat_view_btn.pack_forget()            # у режимі папок вони завжди плитками
        elif not self.folder_first and not self.cat_view_btn.winfo_manager():
            self.cat_view_btn.pack(side="right", padx=(0, 6))
        # підпис розкладки (_cat_sig) уже враховує сторінку, режим і розміри: та сама сторінка вибору папки
        # після повернення із записів — нічого не перекладаємо й не перемальовуємо
        self._arrange_cats()
        if self._picking() and getattr(self, "_pick_job", None) is None:
            # поки була відкрита папка, смуга прокрутки списку папок могла з'явитись / зникнути — звіряємо її
            # й місце «Історії» над плитками
            self._pick_job = self.root.after(30, self._after_pick_resize)
        self._sync_banner()
        self._sync_title()

    def _set_page(self, page: str) -> None:
        if self.nav_zone == "right":
            self._right_mark(None)             # підсвітка формату / фрази не лишається на новій сторінці
        self.page = page
        self._apply_page()
        self._sync_card_lens()                 # збільшена копія вибраного запису — лише на сторінці записів
        if not self.folder_first:
            return
        if page == "folders":
            self.nav_zone = "folders"
            self._nav_mark(self.view if (self.view == HISTORY or self.view in self._row_objs) else HISTORY)
            if self._safe_focus() and isinstance(self.root.focus_get(), (tk.Entry, tk.Text)):
                self.root.focus_set()          # фокус лишався в полі формату — Space друкувався туди, а не відкривав папку
        else:
            self._nav_mark(None)
            self.nav_zone = "cards"
        self.log(f"page {page}")

    def back_to_folders(self) -> None:
        """Кнопка «Назад» / Esc / Alt+A з лівого краю записів: повернення до вибору папки."""
        if self.folder_first and self.page != "folders":
            if self.nav_zone == "right":
                self._nav_leave_right()
            self._set_page("folders")

    def set_folder_first(self, on: bool) -> None:
        """Перемикач режиму (меню ⚙): «спочатку папка» ↔ класичні три колонки."""
        on = bool(on)
        self.v_folder_first.set(on)
        if on == self.folder_first:
            return
        if self.nav_zone == "right":
            self._nav_leave_right()
        self.settings["folder_first"] = on
        self.folder_first = on
        want_tiles = on or self.settings["cat_view"] == "tiles"
        if want_tiles != self.cat_tiles:
            self._rebuild_cat_rows(want_tiles)
            self._sync_view_buttons()
        if on:
            self._set_page("folders")
        else:
            self._nav_mark(None)
            self.nav_zone = "cards"
            self._apply_page()
        self.root.after_idle(self._relayout_now)
        self.set_status("Режим «спочатку папка»: оберіть папку, потім запис (Esc — назад)" if on
                        else "Класичний вигляд: папки й записи поруч", 5000)

    def _on_left_resize(self, e) -> None:
        if e.widget not in (self.left, getattr(self.left, "_canvas", None)) or not self._picking():
            return
        w, h = int(e.width / self.scaling()), int(e.height / self.scaling())
        if w > 50 and (abs(w - self._pick_w) >= 4 or abs(h - getattr(self, "_pick_h", 0)) >= 8):
            self._pick_w, self._pick_h = w, h
            # тягнуть край вікна — <Configure> приходить десятками за секунду, а кожна розкладка перемальовує всі
            # плитки. Перша подія — одразу (без «стрибка» при розгортанні), далі — не частіше ніж раз на PICK_RESIZE_MS
            # (остання — обов'язково, за найсвіжішим розміром)
            if getattr(self, "_pick_arr_job", None) is None:
                if (time.monotonic() - getattr(self, "_pick_arr_t", 0.0)) * 1000 >= PICK_RESIZE_MS:
                    self._pick_arr_t = time.monotonic()
                    self._arrange_cats()
                else:
                    self._pick_arr_job = self.root.after(PICK_RESIZE_MS, self._pick_arrange)
        if getattr(self, "_pick_job", None) is None:      # після розкладки: смуга прокрутки й «Історія» над плитками
            self._pick_job = self.root.after(60, self._after_pick_resize)

    def _on_cat_canvas_resize(self, e) -> None:
        if self._picking() and getattr(self, "_pick_job", None) is None:
            self._pick_job = self.root.after(60, self._after_pick_resize)

    def _pick_arrange(self) -> None:
        self._pick_arr_job = None
        self._pick_arr_t = time.monotonic()
        if self._picking():
            self._arrange_cats()
            if getattr(self, "_pick_job", None) is None:
                self._pick_job = self.root.after(60, self._after_pick_resize)

    def _after_pick_resize(self) -> None:
        self._pick_job = None
        if getattr(self, "_pick_arr_job", None) is not None:
            return                                     # розкладка ще попереду — вона й запланує цей крок після себе
        try:
            self.root.update_idletasks()               # нова висота «Історії» (відступ) уже змінила висоту списку папок
        except tk.TclError:
            return
        self._sync_scrollbars()
        self._center_history()

    def _sync_title(self) -> None:
        """Назва в банері: на сторінці вибору папки — «Оберіть папку» й кількість папок."""
        if self.tab == "links" and self.links is not None:
            title, count = self.links.title(), self.links.count_text()
            keys = "Клік — копіювати посилання (ДСТУ 8302) · Alt + клік — копіювати й сховати · Esc — вище"
        elif self._picking():
            title, count = "", ""                    # сторінка вибору папки — без напису «Оберіть папку»
            keys = "Alt+W/A/S/D — навігація · Space — відкрити папку · Esc — сховати"
        else:
            title, count = self._view_name(), str(len(self.shown))
            keys = ("Alt+W/S/D — навігація · Alt+A / Esc — назад · Space — копіювати · Alt+Space — копіювати й сховати"
                    if self.folder_first else
                    "Alt+W/A/S/D — навігація · Space — копіювати · Alt+Space — копіювати й сховати · "
                    "Alt+Enter — формат + фрази")
        # викликається на кожен render і перехід між сторінками: той самий текст — без configure (і без
        # перерахунку розміру міток та перемальовування банера)
        for lbl, text in ((self.title_lbl, title), (self.count_lbl, count), (self.keys_lbl, keys)):
            if lbl.cget("text") != text:
                lbl.configure(text=text)
        self._fit_banner()

    # -- клавіатурна навігація по правій колонці: формати й швидкі фрази --------------------------------
    def _nav_folders_right(self) -> None:
        if self._picking():
            self._nav_enter_right()
        else:
            self._nav_set_zone("cards")

    def _right_items(self) -> list[tuple]:
        items = [("fmt", fid) for fid in self._fmt_order if fid in self._fmt_rows]
        if self._phrases_collapsed or getattr(self, "_phr_auto", False):
            items.append(("head", None))
        else:
            items += [("phr", p["id"]) for p in self.preset.phrases if p["id"] in self._phrase_rows]
        return items

    def _nav_enter_right(self) -> None:
        items = self._right_items()
        if not items:
            return
        self._nav_prev = (self.nav_zone, self.nav_cat)
        if self.nav_zone == "folders":
            self._nav_mark(None)
        self.nav_zone = "right"
        self._right_mark(items[0])
        self.set_status("Форматування й фрази: Alt+W/S — вище/нижче, Space — вибрати, "
                        "Alt+Enter — формат + фрази, Alt+A — назад", 6000)

    def _nav_leave_right(self) -> None:
        self._right_mark(None)
        zone, cat = self._nav_prev
        self.nav_zone = zone if zone in ("folders", "cards") else "cards"
        if self.nav_zone == "folders":
            self._nav_mark(cat or self.view)
        if isinstance(self.root.focus_get() if self._safe_focus() else None, (tk.Entry, tk.Text)):
            self.root.focus_set()

    def _safe_focus(self) -> bool:
        try:
            self.root.focus_get()
            return True
        except (tk.TclError, KeyError):
            return False

    def _right_mark(self, item: tuple | None) -> None:
        """Підсвічує пункт правої колонки під клавіатурним «курсором» (попередній — гасить)."""
        old, self.nav_right = self.nav_right, item
        if old is not None:
            self._paint_right(old, False)
        if item is not None:
            self._paint_right(item, True)
            kind, key = item
            if kind == "fmt" and key == self.sel_format and self._fmt_built:
                self.fmt_input.focus_set()             # на відкритому форматі — одразу можна вводити
            elif self._safe_focus() and isinstance(self.root.focus_get(), (tk.Entry, tk.Text)):
                # на фразах пробіл ставить галочку, на іншому (закритому) форматі — відкриває його, а не друкується
                # в поле відкритого формату
                self.root.focus_set()
            self._ensure_right_visible(item)

    def _paint_right(self, item: tuple, on: bool) -> None:
        kind, key = item
        try:
            if kind == "fmt":
                row, fmt = self._fmt_rows.get(key), self.preset.format(key)
                if row is None or fmt is None:
                    return
                if on:
                    row.row.configure(border_width=3, border_color=ACCENT)
                elif row.sig == (fmt["name"], fmt["color"], fmt.get("type"), key == self.sel_format):
                    # «курсор» змінив лише рамку — повертаємо лише рамку (одне перемальовування замість трьох)
                    row.row.configure(border_width=2 if row.selected else 1,
                                      border_color=ACCENT if row.selected else row.border)
                else:
                    row.sig = None
                    row.update(fmt, key == self.sel_format)
            elif kind == "phr":
                r = self._phrase_rows.get(key)
                if r is not None:
                    r["frame"].configure(highlightthickness=2 if on else 0, highlightbackground=self.col(ACCENT),
                                         highlightcolor=self.col(ACCENT))
            else:
                self.phrase_head.configure(highlightthickness=2 if on else 0, highlightbackground=self.col(ACCENT),
                                           highlightcolor=self.col(ACCENT))
        except tk.TclError:
            pass

    def _ensure_right_visible(self, item: tuple) -> None:
        pass                                           # права колонка не прокручується — усе й так видно

    def _nav_move_right(self, k: str) -> None:
        items = self._right_items()
        if not items:
            self._nav_leave_right()
            return
        i = items.index(self.nav_right) if self.nav_right in items else 0
        if k == "a":
            self._nav_leave_right()
        elif k == "w":
            self._right_mark(items[max(0, i - 1)])
        elif k == "s":
            self._right_mark(items[min(len(items) - 1, i + 1)])

    def _nav_activate_right(self) -> None:
        """Space на пункті правої колонки: формат — відкрити/закрити, фраза — галочка, заголовок — розгорнути."""
        item = self.nav_right
        if item is None:
            return
        kind, key = item
        if kind == "fmt":
            self.select_format(key)
            self._right_mark(item)                     # перемальований рядок не губить «курсор»
        elif kind == "phr":
            r = self._phrase_rows.get(key)
            if r is not None:
                r["cb"].toggle()
        else:
            self.toggle_phrases()
            items = self._right_items()
            nxt = next((it for it in items if it[0] == "phr"), items[-1] if items else None)
            self.nav_right = None
            self._right_mark(nxt)

    def submit_with_phrases(self) -> None:
        """Alt+Enter: результат вибраного формату + обрані швидкі фрази (через пробіл) → буфер обміну."""
        fmt_out = self._format_result().strip() if self.sel_format else ""
        ph = (self._phrase_text() or "").strip()
        out = " ".join(x for x in (fmt_out, ph) if x)
        if not out:
            self.set_status("Немає що копіювати: відкрийте формат і/або позначте швидкі фрази", 5000)
            return
        self.copy_to_clipboard(out)
        self.append_armed = False

        def after() -> None:
            self._after_format_pick("format")
            self._clear_refunds()
        self._finish_pick("✓ Скопійовано: " + clip(out, 60), after)

    def _nav_folders(self) -> list[str]:
        return [HISTORY] + [k for k in self._row_order if k in self._row_objs]

    def _nav_set_zone(self, zone: str) -> None:
        if zone == self.nav_zone and (zone == "cards" or self.nav_cat):
            return
        self.nav_zone = zone
        if zone == "folders":
            self._nav_mark(self.nav_cat or self.view)
            self.set_status("Папки: Alt+W/S — вище/нижче, Space — відкрити, Alt+D — до записів", 4000)
        else:
            self._nav_mark(None)

    def _nav_mark(self, key: str | None) -> None:
        """Підсвітка папки під клавіатурним «курсором» (у зоні папок)."""
        if self.nav_cat and self.nav_cat in self._row_objs:
            self._mark_target(self.nav_cat, False)
        self.nav_cat = key
        if key and key in self._row_objs:
            self._mark_target(key, True)
            self._ensure_visible_in(self.cat_list, self._row_objs[key].row)
        self._sync_grow()

    # -- плитка під «курсором» — на 15 % більша (накладається на сусідні; сітка не змінюється) ------------------
    def _sync_grow(self) -> None:
        """Сторінка вибору папки, плитки: папка під клавіатурним «курсором» (після повернення — щойно відкрита)
        збільшується, щоб одразу було видно, яка вона. Робиться після розкладки (потрібні справжні розміри)."""
        if getattr(self, "_grow_job", None) is None:
            try:
                self._grow_job = self.root.after_idle(self._grow_now)
            except tk.TclError:
                self._grow_job = None

    def _grow_target(self) -> str | None:
        key = self.nav_cat if self.nav_zone == "folders" else None
        if key and key != HISTORY and self.cat_tiles and self._picking() and key in self._row_objs:
            return key
        return None

    def _grow_now(self) -> None:
        """Збільшена плитка — це ОКРЕМА копія плитки («лінза»), покладена поверх сітки. Самі плитки в сітці не
        чіпаються взагалі (раніше збільшувалась і переставлялась сама плитка, і після кількох переходів курсора
        плитки «їхали» — різні розміри й зсуви). Тепер сітка завжди та сама, рухається лише лінза."""
        self._grow_job = None
        key = self._grow_target()
        obj = self._row_objs.get(key) if key else None
        if obj is None or not obj.tile or obj.sig is None:
            self._hide_lens()
            return
        r = obj.row
        try:
            self.root.update_idletasks()
            if r.winfo_manager() != "grid":
                self._hide_lens()
                return
            w, h, x, y = r.winfo_width(), r.winfo_height(), r.winfo_x(), r.winfo_y()
            if w < 20 or h < 20:
                self._hide_lens()
                return
            lens = self._lens
            if lens is None or lens.key != key or not lens.row.winfo_exists() or lens.row.master is not r.master:
                self._drop_lens()
                lens = self._lens = SideRow(self, r.master, key, real=True, tile=True)
                self._row_keys[lens.row] = key            # перетягнутий запис, кинутий на лінзу, — у цю папку
                # кути поза заокругленням ctk малює кольором bg_color — колір рамки «курсора»: охайна рамка
                lens.row.configure(bg_color=NAV_MARK, corner_radius=8)
                self._lens_geo = None
            s = obj.sig
            lens.update(s[0], s[1], s[2], s[3], s[5], s[6])
            if not getattr(lens, "marked", False):
                lens.mark(True)
            sc = self.scaling()
            gw, gh = round(w * TILE_GROW), round(h * TILE_GROW)
            font = getattr(obj, "_font", None)
            geo = (x, y, w, h, gw, gh, id(font))
            if geo != self._lens_geo:
                lens.set_size(int(gh / sc), int(max(40, gw / sc - 24) * sc), font, int(gw / sc))
                lens.row.place(x=max(0.0, x - (gw - w) / 2) / sc, y=max(0.0, y - (gh - h) / 2) / sc)
                lens.row.grid_propagate(False)        # розмір — заданий, а не «за вмістом»
                self._lens_geo = geo
            lens.row.lift()
            self._grown = (key, lens)
        except (tk.TclError, ValueError, AttributeError):
            self._hide_lens()

    def _hide_lens(self) -> None:
        self._grown = None
        self._lens_geo = None
        lens = self._lens
        if lens is not None:
            try:
                if lens.row.winfo_manager():
                    lens.row.place_forget()
            except tk.TclError:
                self._lens = None

    def _drop_lens(self) -> None:
        lens, self._lens = self._lens, None
        self._grown = None
        self._lens_geo = None
        if lens is not None:
            self._row_keys.pop(lens.row, None)
            try:
                lens.destroy()
            except tk.TclError:
                pass

    def _ensure_visible_in(self, sf, widget) -> None:
        try:
            sf.update_idletasks()
            canvas = sf._parent_canvas
            top, bottom = widget.winfo_y(), widget.winfo_y() + widget.winfo_height()
            total, view = max(1, sf.winfo_height()), canvas.winfo_height()
            y0 = canvas.canvasy(0)
            if top < y0:
                canvas.yview_moveto(max(0, (top - 6) / total))
            elif bottom > y0 + view:
                canvas.yview_moveto(min(1, (bottom + 6 - view) / total))
        except (tk.TclError, AttributeError):
            pass

    def nav_move(self, k: str) -> None:
        if self.nav_zone == "right":
            self._nav_move_right(k)
        elif self.nav_zone == "folders":
            self._nav_move_folders(k)
        else:
            self._nav_move_cards(k)

    def _nav_move_folders(self, k: str) -> None:
        order = self._nav_folders()
        cur = self.nav_cat if self.nav_cat in order else (self.view if self.view in order else HISTORY)
        i = order.index(cur)
        cats = order[1:]
        if not self.cat_tiles:
            if k == "w":
                i = max(0, i - 1)
            elif k == "s":
                i = min(len(order) - 1, i + 1)
            elif k == "d":
                self._nav_folders_right()
                return
            else:
                return
            self._nav_mark(order[i])
            return
        cols = self._tile_dims()[0]
        if cur == HISTORY:                       # «Історія» — окремий рядок над плитками
            if k == "s" and cats:
                self._nav_mark(cats[0])
            elif k == "d":
                self._nav_folders_right()
            return
        j = cats.index(cur)
        if k == "w":
            self._nav_mark(cats[j - cols] if j - cols >= 0 else HISTORY)
        elif k == "s":
            if j + cols < len(cats):
                self._nav_mark(cats[j + cols])
        elif k == "a":
            if j % cols:
                self._nav_mark(cats[j - 1])
        elif k == "d":
            if j % cols < cols - 1 and j + 1 < len(cats):
                self._nav_mark(cats[j + 1])
            else:
                self._nav_folders_right()

    def _nav_move_cards(self, k: str) -> None:
        if k == "a" and self.folder_first:
            self.back_to_folders()                 # Alt+A у відкритій папці — крок назад (до вибору папки);
            return                                 # ліворуч по плитках — стрілка ←
        if self._cells_on() and self._cell_of:
            self._nav_cells(k)
            return
        ids = [i["id"] for i in self.shown]
        cols = self._rec_cols if self.rec_tiles else 1
        idx = ids.index(self.sel_id) if self.sel_id in ids else -1
        if k == "a" and (cols == 1 or idx <= 0 or idx % cols == 0):
            if self.folder_first:
                self.back_to_folders()             # лівий край записів → до вибору папки
            else:
                self._nav_set_zone("folders")      # лівий край записів → до папок
            return
        if k == "d" and (cols == 1 or idx < 0 or idx % cols == cols - 1 or idx + 1 >= len(ids)):
            self._nav_enter_right()                # правий край записів → форматування й швидкі фрази
            return
        if not ids:
            return
        if idx < 0:
            self._move_sel(1)
            return
        if k == "w":
            if idx - cols >= 0:
                self._move_sel(-cols)
        elif k == "s":
            if idx + cols < len(ids):
                self._move_sel(cols)
        elif k == "a":
            self._move_sel(-1)
        elif k == "d":
            self._move_sel(1)

    def nav_activate(self, hide: bool | None) -> None:
        """Space: у папках — відкрити папку (і перейти до її записів); у записах — скопіювати.
        Alt+Space — те саме, але після копіювання вікно ховається (як Alt + клік)."""
        if self.nav_zone == "right":
            self._nav_activate_right()
            return
        if self.nav_zone == "folders":
            key = self.nav_cat or self.view
            self._nav_mark(None)
            self.nav_zone = "cards"
            self.select_category(key)
            self.flush_render()
            return
        if not self.sel_id or self._text_of(self.sel_id) is None:
            return
        card = self._card_objs.get(self.sel_id)
        if card is not None:
            item = next((i for i in self.shown if i["id"] == self.sel_id), {})
            if not ((item.get("v2") or item.get("ctor")) and not hide and not self.append_armed):
                self._flash_card(self.sel_id)
        self.copy_item(self.sel_id, hide=True if hide else None)

    def _move_sel(self, delta: int) -> str:
        if not self.shown:
            return "break"
        ids = [i["id"] for i in self.shown]
        idx = ids.index(self.sel_id) if self.sel_id in ids else -1
        idx = max(0, min(len(ids) - 1, idx + delta))
        self.sel_id = ids[idx]
        if idx >= self.limit:
            self.limit = idx + 1 + PAGE // 2
            self.render_list()
        if self.sel_id not in self._card_objs:        # картка ще не домальована порціями — доробляємо
            self.flush_render()
        self._highlight_selection()
        self._ensure_visible(self._cards.get(self.sel_id))
        return "break"

    def _ensure_visible(self, card) -> None:
        if card is None:
            return
        self.cards.update_idletasks()
        canvas = self.cards._parent_canvas
        top, bottom = card.winfo_y(), card.winfo_y() + card.winfo_height()
        total, view = max(1, self.cards.winfo_height()), canvas.winfo_height()
        y0 = canvas.canvasy(0)
        if top < y0:
            canvas.yview_moveto(max(0, (top - 6) / total))
        elif bottom > y0 + view:
            canvas.yview_moveto(min(1, (bottom + 6 - view) / total))

    def set_search(self, text: str) -> None:
        """Внутрішній фільтр записів (поля пошуку в інтерфейсі більше немає; лишився для тестів і скидання)."""
        self._search_text = text or ""
        self._on_search()

    def _on_search(self) -> None:
        if self._search_job is not None:
            self.root.after_cancel(self._search_job)
            self._search_job = None
        q = self._query()
        if q == self._last_query:
            return
        self._last_query = q
        self.log(f"search len={len(q)}")
        self.sel_id = None
        self.limit = PAGE
        self.render_list(scroll_top=True)

    def _on_escape(self, event: tk.Event) -> None:
        if self._query():
            self.set_search("")
        elif self.append_armed:
            self._set_armed(False)
            self.set_status("Режим Append скасовано")
        elif self.checked and not self._picking():     # на сторінці вибору папки галочок історії не видно
            self.clear_checked()
        else:
            if self.nav_zone == "right":
                self._nav_leave_right()
            if self.folder_first and self.page == "records":
                self.back_to_folders()             # Esc: із записів — до вибору папки; ще раз — сховати
            else:
                self._hide_or_iconify("escape")

    def _on_delete_key(self, event: tk.Event):
        # на сторінці вибору папки sel_id — запис щойно закритої (невидимої) папки: Delete видаляв його без сліду
        if isinstance(event.widget, (tk.Entry, tk.Text)) or not self.sel_id or self._picking():
            return None
        self.on_delete(self.sel_id)

    # -- перетягування: запис → категорія (перенос/копія) або у списку (перестановка) -----------------
    def _make_ghost(self, text: str) -> tk.Toplevel:
        ghost = tk.Toplevel(self.root)
        ghost.overrideredirect(True)
        try:
            ghost.attributes("-topmost", True)
        except tk.TclError:
            pass
        tk.Label(ghost, text=text, bg=ACCENT, fg="#ffffff", justify="left", padx=12, pady=6,
                 font=(FONT, 10)).pack()
        return ghost

    def _show_indicator(self, container, y: int, x: int = 6) -> None:
        """Індикатор місця вставки — тонка акцентна лінія між рядками списку."""
        ind = self._indicators.get(container)
        if ind is None or not ind.winfo_exists():
            ind = self._indicators[container] = tk.Frame(container, bg=ACCENT)
        h = max(3, int(3 * self.scaling()))
        ind.place(x=x, y=max(0, y), width=max(20, container.winfo_width() - 2 * x), height=h)
        ind.lift()

    def _hide_indicators(self) -> None:
        for ind in self._indicators.values():
            try:
                ind.place_forget()
            except tk.TclError:
                pass

    @staticmethod
    def _insert_point(frames: list, y_root: int) -> tuple[int, int]:
        """(k, y у контейнері): скільки рядків (без перетягуваного) лежить вище за курсор і де малювати лінію."""
        k = 0
        for f in frames:
            if f.winfo_rooty() + f.winfo_height() / 2 < y_root:
                k += 1
            else:
                break
        if not frames:
            return 0, 0
        if k < len(frames):
            return k, frames[k].winfo_y() - 3
        last = frames[-1]
        return k, last.winfo_y() + last.winfo_height() + 1

    @staticmethod
    def _inside(widget, x: int, y: int, slack: int = 0) -> bool:
        try:
            return (widget.winfo_rootx() - slack <= x < widget.winfo_rootx() + widget.winfo_width() + slack
                    and widget.winfo_rooty() - slack <= y < widget.winfo_rooty() + widget.winfo_height() + slack)
        except tk.TclError:
            return False

    def _can_reorder_records(self) -> bool:
        return not self._is_history() and not self._query().strip()

    def _cards_insert(self, dragged: str, x: int, y: int) -> int | None:
        """Куди вставити перетягуваний запис у відкритій папці: індекс у списку (або None поза списком)."""
        canvas = self.cards._parent_canvas
        if not self._inside(canvas, x, y):
            return None
        if y < canvas.winfo_rooty() + 28:                      # біля краю списку — прокручуємо
            canvas.yview_scroll(-1, "units")
        elif y > canvas.winfo_rooty() + canvas.winfo_height() - 28:
            canvas.yview_scroll(1, "units")
        frames = [self._card_objs[i].frame for i in self._order if i != dragged and i in self._card_objs]
        k, iy = self._insert_point(frames, y)
        self._show_indicator(self.cards, iy, self._card_pad)
        return k

    def _drag_press(self, e: tk.Event, iid: str) -> None:
        self._nav_focus(e)
        card = self._card_for(e.widget, iid)          # збільшена копія — своя геометрія службової зони
        try:
            if card is not None and card.inert(e.x_root, e.y_root):
                self._drag = None               # права зона картки: клік нічого не робить
                return
        except tk.TclError:
            pass
        self._drag = {"id": iid, "x": e.x_root, "y": e.y_root, "active": False, "ghost": None, "hover": None,
                      "reorder": None, "alt": bool(getattr(e, "state", 0) & ALT_MASK), "tile": None}
        self.sel_id = iid
        self._highlight_selection()

    def _drag_motion(self, e: tk.Event) -> None:
        d = self._drag
        if not d:
            return
        if not d["active"]:
            if abs(e.x_root - d["x"]) + abs(e.y_root - d["y"]) < 8:
                return
            d["active"] = True
            item = next((i for i in self.shown if i["id"] == d["id"]), None)
            d["ghost"] = self._make_ghost(preview(item["text"] if item else "", 2, 60))
        d["ghost"].geometry(f"+{e.x_root + 14}+{e.y_root + 14}")
        target = self._target_at(e.x_root, e.y_root)
        if target != d["hover"]:
            self._mark_target(d["hover"], False)
            self._mark_target(target, True)
            d["hover"] = target
        d["reorder"] = None
        tile_hover = None
        if target is None and self._cells_on():
            rc = self._cell_at(e.x_root, e.y_root)
            canvas = self.cards._parent_canvas
            if rc is not None:                     # біля краю — прокручуємо (можна тягнути вниз за межі видимого)
                if e.y_root < canvas.winfo_rooty() + 40:
                    canvas.yview_scroll(-1, "units")
                elif e.y_root > canvas.winfo_rooty() + canvas.winfo_height() - 40:
                    canvas.yview_scroll(1, "units")
            if rc != d.get("cell"):
                self._mark_cell(d.get("cell"), False)
                self._mark_cell(rc, True)
                d["cell"] = rc
            other = self._cell_taken.get(rc) if rc else None
            tile_hover = self._order.index(other) if other and other != d["id"] and other in self._order else None
        elif target is None and not self._is_history():
            if self._can_reorder_records():
                if self.rec_tiles:                 # плитки: запис стає на місце плитки, над якою відпустили
                    tile_hover = self._tile_index_at(self._order, lambda i: self._card_objs[i].frame, e.x_root, e.y_root,
                                                     self.cards._parent_canvas)
                    d["reorder"] = tile_hover
                else:
                    d["reorder"] = self._cards_insert(d["id"], e.x_root, e.y_root)
            elif self._inside(self.cards._parent_canvas, e.x_root, e.y_root):
                self.set_status("Щоб міняти порядок, скасуйте пошук (Esc)", 2500)
        hover_id = self._order[tile_hover] if tile_hover is not None and tile_hover < len(self._order) else None
        if hover_id != d.get("tile"):
            for iid, on in ((d.get("tile"), False), (hover_id, True)):
                card = self._card_objs.get(iid) if iid else None
                if card is not None:
                    card.set_drop(on)
            d["tile"] = hover_id
        if d["reorder"] is None:
            self._hide_indicators()

    def _drag_release(self, e: tk.Event) -> None:
        d, self._drag = self._drag, None
        if not d:
            return
        if not d["active"]:
            card = self._card_objs.get(d["id"])
            alt = d.get("alt") or bool(getattr(e, "state", 0) & ALT_MASK)
            if card is not None and not (card.v2 and not alt and not self.append_armed):
                self._flash_card(d["id"])       # видно, що скопійовано (для v.2 без Alt відкривається вікно аппендів)
            self.copy_item(d["id"], hide=True if alt else None)      # Alt + клік: скопіювати й згорнути вікно
            return
        d["ghost"].destroy()
        self._hide_indicators()
        self._mark_target(d["hover"], False)
        card = self._card_objs.get(d.get("tile")) if d.get("tile") else None
        if card is not None:
            card.set_drop(False)
        self._mark_cell(d.get("cell"), False)
        target = self._target_at(e.x_root, e.y_root)
        if target is not None:
            self.put_in_category(d["id"], target)
        elif d.get("cell") is not None and self._cells_on():
            if self._move_to_cell(d["id"], d["cell"]):
                self.render()
                self.set_status("✓ Плитку переміщено", 2500)
        elif d.get("reorder") is not None and self.preset.move_snippet_to(d["id"], d["reorder"]):
            self.render()
            self.set_status("✓ Порядок змінено")

    # перестановка рядків категорій (ліва колонка) і форматів (права): клік — вибір, перетягування — порядок
    _REORDER = {
        "cat": {"region": lambda a: a.cat_list._parent_canvas, "container": lambda a: a.cat_list,
                "order": lambda a: a._row_order, "widget": lambda a, k: a._row_objs[k].row, "x": 6},
        "fmt": {"region": lambda a: a.right, "container": lambda a: a.formats_slot,
                "order": lambda a: a._fmt_order, "widget": lambda a, k: a._fmt_rows[k].row, "x": 6},
    }

    def _reorder_press(self, kind: str, key: str, e: tk.Event) -> None:
        self._nav_focus(e)
        self._rd = {"kind": kind, "key": key, "x": e.x_root, "y": e.y_root, "active": False, "ghost": None,
                    "k": None}

    def _reorder_motion(self, e: tk.Event) -> None:
        d = self._rd
        if not d:
            return
        cfg = self._REORDER[d["kind"]]
        if not d["active"]:
            if abs(e.x_root - d["x"]) + abs(e.y_root - d["y"]) < 8:
                return
            d["active"] = True
            name = (self.preset.category(d["key"]) or self.preset.format(d["key"]) or {"name": ""})["name"]
            d["ghost"] = self._make_ghost(clip(name, 40))
        d["ghost"].geometry(f"+{e.x_root + 14}+{e.y_root + 14}")
        if d["kind"] == "cat" and self.cat_tiles:       # плитки папок: перетягнута папка стає на місце плитки під курсором
            order = self._row_order
            idx = self._tile_index_at(order, lambda k: self._row_objs[k].row, e.x_root, e.y_root, self.cat_list._parent_canvas)
            hover = order[idx] if idx is not None else None
            if hover != d.get("hover"):
                self._mark_target(d.get("hover"), False)
                if hover is not None and hover != d["key"]:
                    self._mark_target(hover, True)
                d["hover"] = hover
            d["k"] = idx
            return
        if self._inside(cfg["region"](self), e.x_root, e.y_root):
            frames = [cfg["widget"](self, k) for k in cfg["order"](self) if k != d["key"]]
            d["k"], iy = self._insert_point(frames, e.y_root)
            self._show_indicator(cfg["container"](self), iy, cfg["x"])
        else:
            d["k"] = None
            self._hide_indicators()

    def _reorder_release(self, e: tk.Event) -> None:
        d, self._rd = self._rd, None
        if not d:
            return
        if not d["active"]:                                   # просто клік
            if d["kind"] == "cat":
                self.select_category(d["key"])
            else:
                self.select_format(d["key"])
            return
        d["ghost"].destroy()
        self._hide_indicators()
        if d.get("hover"):
            self._mark_target(d["hover"], False)
        if d["k"] is None:
            return
        if d["kind"] == "cat":
            if self.preset.move_category_to(d["key"], d["k"]):
                self.render()
                self.set_status("✓ Порядок категорій змінено")
        else:
            self._move_format_among_visible(d["key"], d["k"])

    def _move_format_among_visible(self, fid: str, k: int) -> None:
        """Переставляє формат на місце k серед ВИДИМИХ у цій папці (приховані формати лишаються на своїх місцях)."""
        others = [i for i in self._fmt_order if i != fid]
        full = [f["id"] for f in self.preset.formats if f["id"] != fid]
        if not others:
            return
        if k < len(others):
            at = full.index(others[k])
        else:
            at = full.index(others[-1]) + 1
        if self.preset.move_format_to(fid, at):
            self.render()
            self.set_status("✓ Порядок форматів змінено")

    @staticmethod
    def _tile_index_at(order: list, frame_of, x: int, y: int, region=None) -> int | None:
        """Номер плитки (за порядком ``order``), над якою зараз курсор; None — поза плитками/областю."""
        try:
            if region is not None and not (region.winfo_rootx() <= x < region.winfo_rootx() + region.winfo_width()
                                           and region.winfo_rooty() <= y < region.winfo_rooty() + region.winfo_height()):
                return None
            for i, key in enumerate(order):
                f = frame_of(key)
                if (f.winfo_rootx() <= x < f.winfo_rootx() + f.winfo_width()
                        and f.winfo_rooty() <= y < f.winfo_rooty() + f.winfo_height()):
                    return i
        except (tk.TclError, KeyError):
            pass
        return None

    def _target_at(self, x: int, y: int) -> str | None:
        w = self.root.winfo_containing(x, y)
        while w is not None:
            if w in self._row_keys:
                return self._row_keys[w]
            w = getattr(w, "master", None)
        return None

    def _mark_target(self, key: str | None, on: bool) -> None:
        obj = self._row_objs.get(key) if key else None
        if obj:
            obj.mark(on)

    # -- дії над записами -----------------------------------------------------
    def copy_to_clipboard(self, text: str) -> None:
        self._last_seen = text      # ДО update(): інакше опитування буфера, що спрацює всередині update(), запише це в історію
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        self.root.update()  # щоб Windows одразу отримала дані

    def _text_of(self, item_id: str | None) -> str | None:
        it = next((i for i in self.shown if i["id"] == item_id), None)
        return it["text"] if it else None

    def copy_item(self, item_id: str | None, hide: bool | None = None) -> None:
        """hide=True — після копіювання одразу сховати вікно (Alt + клік); None — за налаштуванням «автохов»."""
        text = self._text_of(item_id)
        if text is None:
            return
        if self.append_armed:                  # режим Append: клік по запису = «текст запису + результат форматування»
            self._append_to(text, True if hide else None)
            return
        item = next((i for i in self.shown if i["id"] == item_id), None)
        if item and item.get("ctor") and not self._is_history() and not hide:
            self._open_ctor(item)              # конструктор: клік відкриває вибір продовжень (Alt+клік — лише стовбур і згорнути)
            return
        if item and item.get("v2") and not self._is_history() and not hide:
            self._open_v2(item)                # копіпаста v.2: клік відкриває вікно вибору аппендів (Alt+клік — лише основний текст і згорнути)
            return
        if item and not self._is_history():
            text = self._fill_snippet(text, card_user_link(item), count=item.get("user_count", 0))
        self.copy_to_clipboard(text)

        def after() -> None:      # піднімаємо запис в історії вже ПІСЛЯ ховання вікна
            if self._is_history():
                self.history.bump(item_id)
                self.render(scroll_top=True)

        self._finish_pick("✓ Скопійовано: " + clip(preview(text, 1, 60).replace("\n", " "), 50), after, hide=hide)

    def _open_v2(self, item: dict) -> None:
        """Вікно вибору аппендів для копіпасти v.2. Результат копіюється; вікно програми ховається лише при Alt + клік."""
        cnt = clean_count(item.get("user_count", 0))
        res = V2Dialog(self, item["text"], item["v2"], uid=take(recent_numbers(self._history_texts()), cnt) or None,
                       link_on=card_user_link(item),
                       on_edit=lambda: self._edit_appends_inline(item["id"]),
                       filler=lambda txt, on: self._fill_snippet(txt, on, warn=False, count=cnt)).run()
        if not res or not res["text"].strip():
            return
        self.copy_to_clipboard(res["text"])
        self._finish_pick("✓ Скопійовано: " + clip(res["text"].replace("\n", " "), 60), hide=bool(res["hide"]))

    def _open_ctor(self, item: dict) -> None:
        """Вікно вибору конструкта; обраний текст (з тегами й користувачами з буфера) копіюється, програма ховається."""
        link_on = card_user_link(item)

        def finalize(text: str) -> tuple[str, str]:
            out, missing = self._resolve_tags(text)
            out = self._fill_snippet(out, link_on, warn=False, tags=False, count=item.get("user_count", 0))
            warn = ("У буфері немає номерів для: " + ", ".join(tag_ref(m) for m in missing)) if missing else ""
            return out, warn
        res = CtorDialog(self, item["text"], item["ctor"], finalize,
                         on_edit=lambda: self._edit_ctor_inline(item["id"])).run()
        if not res or not res["text"].strip():
            return
        self.copy_to_clipboard(res["text"])
        msg = "✓ Скопійовано: " + clip(res["text"].replace("\n", " "), 60)
        if res.get("hide"):                         # Alt + клік — скопіювати й згорнути програму
            self._finish_pick(msg, hide=True)
            return
        self.back_to_folders()                      # інакше — повідомлення і назад до вибору папки (програма лишається)
        self._finish_pick(msg, hide=False)
        self.show_toast(msg)

    def _edit_ctor_inline(self, item_id: str) -> dict | None:
        found = self.preset.find_snippet(item_id)
        if not found:
            return None
        res = CtorEditDialog(self, found[1]["text"], found[1].get("ctor")).run()
        if res is None:
            return None
        self.preset.update_snippet(item_id, found[1]["text"], found[0]["id"], ctor=res or None)
        self.render()
        return res

    def on_edit_ctor(self, item_id: str) -> None:
        """«⋯» → «Конструктор…»: існуючий запис стає копіпастою-конструктором (аппенди v.2, якщо були, прибираються)."""
        found = self.preset.find_snippet(item_id)
        if not found:
            return
        cat, snip = found
        res = CtorEditDialog(self, snip["text"], snip.get("ctor")).run()
        if res is None:
            return
        v2 = None if res else "keep"
        if self.preset.update_snippet(item_id, snip["text"], cat["id"], v2=v2, ctor=res or None):
            self.render()
            self.set_status("✓ Конструктор збережено — клік по запису відкриє вибір продовжень" if res
                            else "Конструктів немає — запис знову звичайний")

    def on_remove_ctor(self, item_id: str) -> None:
        found = self.preset.find_snippet(item_id)
        if found and self.preset.update_snippet(item_id, found[1]["text"], found[0]["id"], ctor=None):
            self.render()
            self.set_status("Конструктор прибрано — запис знову звичайний")

    def _resolve_tags(self, text: str) -> tuple[str, list[str]]:
        """Теги {{user}} і власні {{назва}} → значення з останніх номерів у буфері."""
        return resolve_tags(text, self.preset.tags, self._history_texts())

    def _history_texts(self) -> list[str]:
        return [i["text"] for i in self.history.items]

    def _fill_snippet(self, text: str, link_on: bool, warn: bool = True, tags: bool = True, count: int = 0) -> str:
        """Заповнення тексту з історії буфера: теги {{user}} / {{назва}} → номери з останніх записів; «Email ___» →
        останній email; «___» → користувачі ПО ЧЕРЗІ; без заглушки й з увімкненою підстановкою — « in {LINK:USER:…:E},
        …» (усі користувачі з останніх записів буфера) у кінці."""
        texts = self._history_texts()
        if tags:
            text, missing = self._resolve_tags(text)
            if warn and missing:
                self.set_status("У буфері немає номерів для: " + ", ".join(tag_ref(m) for m in missing), 6000)
        out = fill_email(text, last_email(texts))
        if link_on:
            users = user_ids_from_history(texts, split=self.settings["split_numbers"])   # «___» — по черзі з історії
            tail = take(recent_numbers(texts), clean_count(count))   # « in …» — з останньої серії (count — скільки)
            needed = users if has_user_placeholder(out) else tail
            out = apply_user_link(out, users, tail)
            if warn and not needed:
                self.set_status("У історії буфера немає користувача — скопійовано без {LINK:USER:…:E}", 6000)
        if warn and has_user_placeholder(out) and link_on:
            self.set_status("Користувачів в історії менше, ніж заглушок «___» — решта лишилась порожньою", 6000)
        return out

    def _last_user(self) -> str | None:
        """Останній користувач з історії буфера: {LINK:USER:1236:E}, «User #1236» або просто число."""
        return last_user_id(i["text"] for i in self.history.items)

    def _edit_appends_inline(self, item_id: str) -> dict | None:
        """Редактор пунктів з вікна вибору; зберігає в запис. Повертає нові аппенди ({} — прибрано) або None (скасовано)."""
        found = self.preset.find_snippet(item_id)
        if not found:
            return None
        res = V2OptionsDialog(self, found[1].get("v2")).run()
        if res is None:
            return None
        self.preset.update_snippet(item_id, found[1]["text"], found[0]["id"], res or None)
        self.render()
        return res

    def _append_to(self, base: str, close: bool | None = None) -> None:
        """Append: у буфер потрапляє «запис + результат форматування»; сам запис у пресеті НЕ змінюється.
        close: True — сховати вікно, False — лишити, None — за налаштуванням «автохов»."""
        src = self.armed_src or "format"
        result = self._armed_result()
        if not result:
            self.set_status("Поле введення порожнє — нічого дописувати (Esc — вийти з режиму Append)"
                            if self.armed_src != "refund" else "Позначте фразу — нічого дописувати (Esc — вийти з режиму Append)")
            return
        fmt = self.preset.format(self.sel_format) if (self.sel_format and self.armed_src != "refund") else None
        join = APPENDERS.get(fmt["type"], append_result) if fmt else append_result
        out = join(base, result)
        self.copy_to_clipboard(out)
        self.append_armed = False
        self._finish_pick("✓ Дописано і скопійовано: " + clip(out.replace("\n", " "), 70),
                          lambda: self._after_format_pick(src),
                          hide=close)

    def show_toast(self, text: str, ms: int = 2200) -> None:
        """Помітне повідомлення поверх вікна (зелена плашка внизу посередині), зникає саме."""
        old = getattr(self, "_toast", None)
        if old is not None:
            try:
                old.destroy()
            except tk.TclError:
                pass
        try:
            self._toast = lbl = tk.Label(self.root, text=clip(text, 90), font=self.pf.bold, fg="#ffffff",
                                         bg=self.col(COPIED), padx=18, pady=10)
            lbl.place(relx=0.5, rely=1.0, y=-int(48 * self.scaling()), anchor="s")
            lbl.lift()
            lbl.bind("<Button-1>", lambda e: lbl.destroy())
            lbl.after(ms, lambda: lbl.winfo_exists() and lbl.destroy())
        except tk.TclError:
            self._toast = None

    def _finish_pick(self, status: str, work=None, hide: bool | None = None) -> None:
        """Завершення вибору: якщо ввімкнено автохов (або hide=True) — вікно зникає ОДРАЗУ, а вся решта роботи
        (запис на диск, перебудова карток) робиться вже у фоні, коли вікна не видно."""
        hide = bool(self.settings["autohide"]) if hide is None else hide
        if hide and not self._hide_or_iconify("pick"):
            status += "  ·  " + self._no_way_back_text()       # вікно лише згорнуте — пояснюємо чому
        self.set_status(status, 9000 if "·" in status else 4000)
        if work:
            if hide:
                self.root.after(15, work)
            else:
                work()

    def _hide_or_iconify(self, why: str = "pick") -> bool:
        """Ховає вікно (withdraw), якщо є шлях назад (гаряча клавіша, трей або повторний запуск exe) → True;
        інакше — згортає в панель завдань, пояснює чому, → False."""
        if self._can_hide():
            self.log(f"hide[{why}] withdraw hotkey_ok={self.hotkey_ok} tray={bool(self.tray)} "
                     f"relaunch={self.relaunch_ok}")
            self.hide_window()
            return True
        self.log(f"hide[{why}] NO way back (hotkey_ok={self.hotkey_ok}, tray={bool(self.tray)}) -> iconify")
        self.root.iconify()
        self.set_status(self._no_way_back_text(), 9000)
        return False

    def put_in_category(self, item_id: str, cat_id: str) -> None:
        """З історії — копіює запис у категорію; запис пресета — переміщує між категоріями."""
        cat = self.preset.category(cat_id)
        if not cat:
            return
        if self._is_history():
            text = self._text_of(item_id) or (self.history.find(item_id) or {}).get("text")
            if not text:
                return
            before = self.preset.count(cat_id)
            self.preset.add_snippet(cat_id, text)
            added = self.preset.count(cat_id) > before
            self.render()
            self.set_status(f"✓ Збережено в «{cat['name']}»" if added else f"Такий запис уже є в «{cat['name']}»")
        else:
            found = self.preset.find_snippet(item_id)
            if found and found[0]["id"] != cat_id and self.preset.move_snippet(item_id, cat_id):
                self.render()
                self.set_status(f"✓ Переміщено в «{cat['name']}»")

    def on_delete(self, item_id: str) -> None:
        self.log(f"delete {str(item_id)[:8]} view={self.view[:8]}")
        ids = [i["id"] for i in self.shown]
        if item_id in ids and item_id == self.sel_id:   # після видалення виділення переходить на сусіда
            nxt = ids[ids.index(item_id) + 1:] or ids[: ids.index(item_id)][::-1]
            self.sel_id = nxt[0] if nxt else None
        if self._is_history():
            self.history.remove(item_id)
        else:
            self.preset.remove_snippet(item_id)
        self.render()

    def on_add(self) -> None:
        if self.tab == "links" and self.links is not None:
            self.links.add()
            return
        if not self.preset.categories and not self.on_new_category(select=False):
            return
        cat = self.view if self.preset.category(self.view) else (
            self._last_cat if self.preset.category(self._last_cat) else self.preset.categories[0]["id"])
        result = SnippetDialog(self, "Новий запис", "", cat).run()
        if not result:
            return
        text, cat_id, *rest = result
        snip = self.preset.add_snippet(cat_id, text, rest[0] if rest else None, rest[1] if len(rest) > 1 else None)
        if snip:
            self.view, self._last_cat, self.sel_id = cat_id, cat_id, snip["id"]
            if self._query():
                self.set_search("")
            self.limit = PAGE
            self.render(scroll_top=True)
            if self.folder_first:
                self._set_page("records")
            self.set_status("✓ Додано")

    def on_edit(self, item_id: str) -> None:
        found = self.preset.find_snippet(item_id)
        if not found:
            return
        result = SnippetDialog(self, "Редагування", found[1]["text"], found[0]["id"], found[1].get("v2"),
                               found[1].get("ctor")).run()
        if result and self.preset.update_snippet(item_id, result[0], result[1], result[2] if len(result) > 2 else "keep",
                                                 result[3] if len(result) > 3 else "keep"):
            self.render()
            self.set_status("✓ Запис оновлено")

    def on_edit_appends(self, item_id: str) -> None:
        """«⋯» → «Додати / Редагувати аппенди…»: існуючий запис стає копіпастою v.2 (текст і папка не змінюються)."""
        found = self.preset.find_snippet(item_id)
        if not found:
            return
        cat, snip = found
        res = V2OptionsDialog(self, snip.get("v2")).run()
        if res is None:                                  # «Скасувати»
            return
        if self.preset.update_snippet(item_id, snip["text"], cat["id"], res or None):
            self.render()
            self.set_status("✓ Аппенди збережено — клік по запису відкриє вибір" if res
                            else "Аппендів немає — запис знову звичайний")

    def on_toggle_user_link(self, item_id: str, on: bool) -> None:
        if self.preset.set_snippet_user_link(item_id, on):
            self.render()
            self.set_status("Користувач з історії підставлятиметься: … in {LINK:USER:…:E}" if on
                            else "Користувача з історії більше не підставляємо")

    def on_remove_appends(self, item_id: str) -> None:
        found = self.preset.find_snippet(item_id)
        if found and self.preset.update_snippet(item_id, found[1]["text"], found[0]["id"], None):
            self.render()
            self.set_status("Аппенди прибрано — запис знову звичайний")

    def on_clear(self) -> None:
        """Без підтвердження: історія — тимчасова, а записи пресета ця дія не зачіпає."""
        self.history.clear()
        self.render(scroll_top=True)
        self.set_status("✓ Історію очищено")

    # -- категорії ----------------------------------------------------------
    def select_category(self, key: str) -> None:
        self.log(f"select_category {key[:8]}")
        if self.nav_zone == "right":                   # клік мишею по папці з правої колонки — «курсор» там гасне
            self._right_mark(None)
            self.nav_zone = "cards"
        if self.nav_zone == "folders":                 # клік мишею по папці — «курсор» повертається до записів
            self._nav_mark(None)
            self.nav_zone = "cards"
        if key != self.view:
            self._collapse_format()            # формати при переході між папками згорнуті, Append скасовано
            self.clear_checked()
        self.view = key
        if key != HISTORY:
            self._last_cat = key
        self.sel_id = None
        self.limit = PAGE
        self.render(scroll_top=True)
        if self.folder_first and self.page != "records":
            self._set_page("records")

    def on_new_category(self, for_item: str | None = None, select: bool = True) -> dict | None:
        name = TextDialog(self, "Нова категорія", "Назва категорії:").run()
        if name is None:
            return None
        cat = self.preset.add_category(name)
        if not cat:
            messagebox.showinfo(APP_NAME, "Порожня назва або така категорія вже існує.", parent=self.root)
            return None
        if for_item:
            self.put_in_category(for_item, cat["id"])
        elif select:
            self.view, self.sel_id, self._last_cat = cat["id"], None, cat["id"]
        self.render(scroll_top=True)
        return cat

    def on_rename_category(self, cat_id: str) -> None:
        cat = self.preset.category(cat_id)
        if not cat:
            return
        name = TextDialog(self, "Перейменування", "Нова назва:", cat["name"]).run()
        if name is not None and not self.preset.rename_category(cat_id, name):
            messagebox.showinfo(APP_NAME, "Порожня назва або така категорія вже існує.", parent=self.root)
        self.render()

    def on_delete_category(self, cat_id: str) -> None:
        cat = self.preset.category(cat_id)
        if not cat:
            return
        n = len(cat["snippets"])
        extra = f" і {n} {'запис' if n == 1 else 'записів'}" if n else ""
        if messagebox.askyesno(APP_NAME, f"Видалити категорію «{cat['name']}»{extra}?\nЦю дію не можна скасувати.",
                               parent=self.root):
            self.preset.delete_category(cat_id)
            if self.view == cat_id:
                self.view = HISTORY
            self.render(scroll_top=True)

    def on_move_category(self, cat_id: str, delta: int) -> None:
        self.preset.move_category(cat_id, delta)
        self.render()

    def _popup(self, model: MenuModel, x: int, y: int) -> None:
        self.menu = model
        PopupMenu(self, model).show(x, y)

    # -- кольори --------------------------------------------------------------
    def on_category_color(self, cat_id: str) -> None:
        cat = self.preset.category(cat_id)
        if not cat:
            return
        res = ColorDialog(self, f"Колір категорії «{clip(cat['name'], 20)}»", cat["color"]).run()
        if res and res[0] == "set" and self.preset.set_category_color(cat_id, res[1]):
            self.render()           # колір одразу підхоплюють крапка в списку й усі записи категорії
            self.set_status("✓ Колір категорії змінено — записи без власного кольору підхопили його")

    def on_snippet_color(self, item_id: str) -> None:
        found = self.preset.find_snippet(item_id)
        if not found:
            return
        cat, snip = found
        res = ColorDialog(self, "Колір запису", snip.get("color") or cat["color"], allow_reset=True,
                          reset_label="Як у папки").run()
        if not res:
            return
        ok = self.preset.set_snippet_color(item_id, None if res[0] == "reset" else res[1])
        if ok:
            self.render()
            self.set_status("✓ Запис знову має колір папки" if res[0] == "reset" else "✓ Власний колір запису збережено")

    def on_snippet_border(self, item_id: str) -> None:
        """Власний колір рамки запису (товщина — ⚙ → «Рамки»)."""
        found = self.preset.find_snippet(item_id)
        if not found:
            return
        cat, snip = found
        res = ColorDialog(self, "Колір рамки запису", snip.get("border") or cat.get("border"), allow_reset=True,
                          reset_label="Як у папки").run()
        if res and self.preset.set_snippet_border(item_id, None if res[0] == "reset" else res[1]):
            self.render()
            self.set_status("✓ Рамка запису — як у папки" if res[0] == "reset" else
                            "✓ Колір рамки запису збережено (товщина — ⚙ → «Рамки»)")

    def on_category_border(self, cat_id: str) -> None:
        """Колір рамки папки — і всіх її записів, що не мають власної рамки."""
        cat = self.preset.category(cat_id)
        if not cat:
            return
        res = ColorDialog(self, f"Колір рамки папки «{clip(cat['name'], 20)}»", cat.get("border"), allow_reset=True,
                          reset_label="Від кольору").run()
        if res and self.preset.set_category_border(cat_id, None if res[0] == "reset" else res[1]):
            self.render()
            self.set_status("✓ Рамка папки — від її кольору" if res[0] == "reset" else
                            "✓ Колір рамки папки збережено (товщина — ⚙ → «Рамки»)")

    def on_format_color(self, fid: str) -> None:
        fmt = self.preset.format(fid)
        if not fmt:
            return
        res = ColorDialog(self, f"Колір формату «{clip(fmt['name'], 20)}»", fmt["color"]).run()
        if res and res[0] == "set" and self.preset.set_format_color(fid, res[1]):
            self.render()
            self.set_status("✓ Колір формату змінено")

    def on_move_format(self, fid: str, delta: int) -> None:
        """Вгору/вниз серед формату, видимих у цій папці."""
        order = list(self._fmt_order)
        if fid not in order:
            return
        k = max(0, min(len(order) - 1, order.index(fid) + delta))
        if k != order.index(fid):
            self._move_format_among_visible(fid, k)

    def show_format_menu(self, x: int, y: int, fid: str) -> None:
        m = self._new_menu()
        m.add_command("Колір…", lambda: self.on_format_color(fid), icon="●")
        m.add_command("Перемістити вгору", lambda: self.on_move_format(fid, -1), icon="↑")
        m.add_command("Перемістити вниз", lambda: self.on_move_format(fid, 1), icon="↓")
        self._popup(m, x, y)

    def show_category_menu(self, x: int, y: int, cat_id: str) -> None:
        m = self._new_menu()
        m.add_command("Перейменувати…", lambda: self.on_rename_category(cat_id), icon="✎")
        m.add_command("Колір…", lambda: self.on_category_color(cat_id), icon="●")
        m.add_command("Фігура…", lambda: self.on_category_shape(cat_id),
                      icon=(self.preset.category(cat_id) or {}).get("shape") or "★")
        m.add_command("Колір рамки…", lambda: self.on_category_border(cat_id), icon="▢")
        m.add_command("Перемістити вгору", lambda: self.on_move_category(cat_id, -1), icon="↑")
        m.add_command("Перемістити вниз", lambda: self.on_move_category(cat_id, 1), icon="↓")
        m.add_separator()
        m.add_command("Видалити категорію…", lambda: self.on_delete_category(cat_id), danger=True, icon="✕")
        self._popup(m, x, y)

    def show_menu(self, x: int, y: int, item_id: str) -> None:
        text = self._text_of(item_id)
        if text is None:
            return
        self.sel_id = item_id
        self._highlight_selection()
        hist = self._is_history()
        m = self._new_menu()
        m.add_command("Копіювати", lambda: self.copy_item(item_id), icon="❐")
        if not hist:
            m.add_command("Редагувати…", lambda: self.on_edit(item_id), icon="✎")
            has_v2 = bool((self.preset.find_snippet(item_id) or (None, {}))[1].get("v2"))
            m.add_command("Редагувати аппенди…" if has_v2 else "Додати аппенди…", lambda: self.on_edit_appends(item_id),
                          icon="▶")
            if has_v2:
                m.add_command("Прибрати аппенди", lambda: self.on_remove_appends(item_id), icon="○")
            has_ctor = bool((self.preset.find_snippet(item_id) or (None, {}))[1].get("ctor"))
            m.add_command("Редагувати конструктор…" if has_ctor else "Конструктор…", lambda: self.on_edit_ctor(item_id),
                          icon="⧉")
            if has_ctor:
                m.add_command("Прибрати конструктор", lambda: self.on_remove_ctor(item_id), icon="○")
            item = next((i for i in self.shown if i["id"] == item_id), {})
            on = card_user_link(item)
            m.add_command(("✓ " if on else "") + "Додавати користувача з історії (in {LINK:USER:…:E})",
                          lambda: self.on_toggle_user_link(item_id, not on), icon="@")
            if on:
                cnt = (self.preset.find_snippet(item_id) or (None, {}))[1].get("user_count", 0)
                m.add_cascade("Скільки користувачів брати", self._count_menu(
                    cnt, lambda n: self._set_snippet_count(item_id, n)), icon="#")
            m.add_command("Колір запису…", lambda: self.on_snippet_color(item_id), icon="●")
            m.add_command("Колір рамки…", lambda: self.on_snippet_border(item_id), icon="▢")
        sub = self._new_menu()
        cur = None if hist else (self.preset.find_snippet(item_id) or ({"id": None},))[0]["id"]
        for c in self.preset.categories:
            sub.add_command(c["name"], lambda cid=c["id"]: self.put_in_category(item_id, cid),
                            dot=c["color"], checked=cur == c["id"])
        if self.preset.categories:
            sub.add_separator()
        sub.add_command("＋ Нова категорія…", lambda: self.on_new_category(for_item=item_id))
        m.add_cascade("Зберегти в категорію" if hist else "Перемістити в категорію", sub, icon="➜")
        if not hist and not self._cells_on():          # у сітці клітинок місце задає перетягування
            m.add_command("Вгору", lambda: (self.preset.reorder_snippet(item_id, -1), self.render()), icon="↑")
            m.add_command("Вниз", lambda: (self.preset.reorder_snippet(item_id, 1), self.render()), icon="↓")
        m.add_separator()
        m.add_command("Видалити", lambda: self.on_delete(item_id), danger=True, icon="✕")
        self._popup(m, x, y)

    # -- пресети --------------------------------------------------------------
    def _popup_preset_menu(self, x: int | None = None, y: int | None = None) -> None:
        if x is None:
            x, y = self.preset_chip.winfo_rootx(), self.preset_chip.winfo_rooty() + self.preset_chip.winfo_height()
        self._popup(self._build_preset_menu(self._new_menu()), x, y)

    def _build_preset_menu(self, m: MenuModel) -> MenuModel:
        m.add_command("Новий пресет…", self.on_new_preset, icon="＋")
        m.add_command("Відкрити пресет…", self.on_open_preset, icon="▤")
        m.add_command("Зберегти як…", self.on_save_preset_as, icon="⇩")
        m.add_command("Перейменувати пресет…", self.on_rename_preset, icon="✎")
        m.add_command("Імпортувати з файлу (додати до поточного)…", self.on_import_preset, icon="⇧")
        m.add_separator()
        m.add_command("Показати файл у теці", self.on_reveal_preset, icon="▤")
        recent = [p for p in self.settings["recent_presets"]
                  if os.path.exists(p) and os.path.abspath(p) != os.path.abspath(self.preset.path)]
        if recent:
            sub = self._new_menu()
            for p in recent:
                sub.add_command(clip(os.path.basename(p), 50), lambda path=p: self.open_preset_path(path))
            m.add_cascade("Останні", sub, icon="◷")
        return m

    _FILETYPES = [("Пресет", "*" + PRESET_SUFFIX), ("JSON", "*.json"), ("Усі файли", "*.*")]

    def switch_preset(self, preset: Preset, message: str) -> None:
        self._collapse_format()
        self.clear_checked()
        self.preset = preset
        self.settings.remember_preset(preset.path)
        self.view = preset.categories[0]["id"] if preset.categories else HISTORY
        self._last_cat = self.view if preset.categories else None
        self.sel_id = None
        self.limit = PAGE
        self._update_title()
        self.render(scroll_top=True)
        self.set_status(message)

    def on_new_preset(self) -> None:
        path = filedialog.asksaveasfilename(
            parent=self.root, title="Новий пресет — назва і місце збереження", initialfile="Мій пресет" + PRESET_SUFFIX,
            defaultextension=PRESET_SUFFIX, filetypes=self._FILETYPES)
        if not path:
            return
        path = normalize_preset_path(path)
        try:
            fresh = Preset(path)
            fresh.save()
        except OSError as e:
            messagebox.showerror(APP_NAME, f"Не вдалося створити файл:\n{e}", parent=self.root)
            return
        self.switch_preset(fresh, f"✓ Створено пресет «{fresh.name}»")

    def on_open_preset(self) -> None:
        path = filedialog.askopenfilename(parent=self.root, title="Відкрити пресет", filetypes=self._FILETYPES)
        if path:
            self.open_preset_path(path)

    def open_preset_path(self, path: str) -> None:
        try:
            opened = Preset.open(path)
        except PresetError as e:
            messagebox.showerror(APP_NAME, f"Пресет не відкрито.\n{e}", parent=self.root)
            return
        self.switch_preset(opened, f"✓ Відкрито пресет «{opened.name}»")

    def on_save_preset_as(self) -> None:
        path = filedialog.asksaveasfilename(
            parent=self.root, title="Зберегти пресет як…", initialfile=os.path.basename(self.preset.path),
            defaultextension=PRESET_SUFFIX, filetypes=self._FILETYPES)
        if not path:
            return
        path = normalize_preset_path(path)
        try:
            self.preset.save_as(path, preset_stem(path))
        except OSError as e:
            messagebox.showerror(APP_NAME, f"Не вдалося зберегти:\n{e}", parent=self.root)
            return
        self.settings.remember_preset(path)
        self._update_title()
        self.render()
        self.set_status(f"✓ Збережено як «{self.preset.name}» — тепер працюємо з цим файлом")

    def on_rename_preset(self) -> None:
        old_path = self.preset.path
        name = TextDialog(self, "Перейменувати пресет", "Нова назва (файл теж буде перейменовано):",
                          self.preset.name).run()
        if name is None:
            return
        try:
            self.preset.rename(name)
        except PresetError as e:
            messagebox.showerror(APP_NAME, f"Не вдалося перейменувати пресет.\n{e}", parent=self.root)
            return
        if self.preset.path != old_path:
            self.settings.replace_preset_path(old_path, self.preset.path)
        self._update_title()
        self.set_status("✓ Пресет перейменовано")

    def on_import_preset(self) -> None:
        path = filedialog.askopenfilename(parent=self.root, title="Імпортувати пресет", filetypes=self._FILETYPES)
        if not path:
            return
        try:
            cats, snips = self.preset.import_from(path)
        except PresetError as e:
            messagebox.showerror(APP_NAME, f"Імпорт не вдався.\n{e}", parent=self.root)
            return
        self.render()
        self.set_status(f"✓ Імпортовано: нових категорій — {cats}, нових записів — {snips}")

    def on_reveal_preset(self) -> None:
        import subprocess
        path = self.preset.path
        try:
            if os.name == "nt":
                subprocess.Popen(["explorer", "/select,", os.path.normpath(path)])
            elif sys.platform == "darwin":
                subprocess.Popen(["open", "-R", path])
            else:
                subprocess.Popen(["xdg-open", os.path.dirname(os.path.abspath(path))])
        except (OSError, ValueError):
            self.set_status(f"Файл пресета: {path}", 9000)

    # -- налаштування ---------------------------------------------------------
    def _popup_settings(self) -> None:
        m = self._new_menu()
        problem = self._hotkey_problem()
        if problem:
            m.add_command(problem, lambda: self.set_status(problem, 9000))
            m.add_separator()
        m.add_cascade("Пресет", self._build_preset_menu(self._new_menu()), icon="▤")
        m.add_separator()
        m.add_check("Пауза запису буфера", self.v_paused, self._on_pause)
        m.add_check("Завжди зверху", self.v_topmost, self._on_topmost)
        m.add_check("Ховати вікно після вибору запису", self.v_autohide, self._on_autohide)
        m.add_check("Відкривати на весь екран", self.v_fullscreen, self._on_fullscreen)
        m.add_check("Очищати історію при закритті (✕) і виході", self.v_clear_exit, self._on_clear_exit)
        m.add_check("Кілька чисел в одному записі буфера — окремі користувачі", self.v_split_numbers,
                    lambda: self.set_split_numbers(self.v_split_numbers.get()))
        m.add_check("Режим «спочатку папка» (вибір папки → записи)", self.v_folder_first,
                    lambda: self.set_folder_first(self.v_folder_first.get()))
        sizes = self._new_menu()
        for v in PICK_FONT_SIZES:
            sizes.add_radio(f"{v:g}" + ("  (типовий)" if v == 16.5 else ""), self.v_pick_font, f"{v:g}",
                            lambda v=v: self.set_pick_font(v))
        m.add_cascade("Розмір назв папок (режим папок)", sizes, icon="A")
        lv = self._new_menu()
        for n, name in enumerate(COLOR_LEVEL_NAMES):
            lv.add_command(name + ("  (типова)" if n == 2 else ""), lambda n=n: self.set_color_level(n),
                           checked=n == _COLOR_LEVEL[0])
        m.add_cascade("Насиченість кольорів (записи й папки)", lv, icon="◐")
        bl = self._new_menu()
        for n, name in enumerate(BORDER_LEVEL_NAMES):
            bl.add_command(name + ("  (типова)" if n == 1 else ""), lambda n=n: self.set_border_level(n),
                           checked=n == _BORDER_LEVEL[0])
        m.add_cascade("Рамки (записи й папки)", bl, icon="▢")
        m.add_command("Кольори й рамки — точно…", self.on_colors_dialog, icon="◑")
        m.add_command("Фігури папок…", self.on_folder_shapes, icon="★")
        hot = self._new_menu()
        for spec, label in HOTKEY_PRESETS:
            hot.add_radio(label, self.v_hotkey, spec, self._on_hotkey_choice)
        m.add_cascade("Гаряча клавіша", hot, icon="⌨")
        theme = self._new_menu()
        for value, label in THEMES:
            theme.add_radio(label, self.v_theme, value, self._on_theme)
        m.add_cascade("Тема", theme, icon="◐")
        m.add_separator()
        m.add_command("Показати теку з логами", self.on_reveal_logs, icon="▤")
        m.add_command("Очистити історію буфера", self.on_clear, icon="✕")
        m.add_command("Вийти з програми", self.quit, danger=True, icon="⏻")
        self._popup(m, self.gear.winfo_rootx() - int(180 * self.scaling()),
                    self.gear.winfo_rooty() + self.gear.winfo_height() + 4)

    def _on_pause(self) -> None:
        self.settings["paused"] = self.v_paused.get()
        self.set_status("Запис буфера призупинено" if self.v_paused.get() else "Запис буфера відновлено")

    def _on_autohide(self) -> None:
        self.settings["autohide"] = self.v_autohide.get()
        self._sync_submit_label()

    def set_split_numbers(self, on: bool) -> None:
        """⚙ → «Кілька чисел в одному записі буфера — окремі користувачі»: «1245, 235636 135» → 1245, 235636, 135
        і для заглушок «___» (по черзі), а не лише для « in …» і {{user}}."""
        on = bool(on)
        self.v_split_numbers.set(on)
        self.settings["split_numbers"] = on
        self.set_status("Кілька чисел в одному записі — окремі користувачі: «1245, 235636 135» → три" if on else
                        "Для заглушок «___» береться лише запис з одним користувачем", 5000)

    def _on_clear_exit(self) -> None:
        self.settings["clear_on_exit"] = self.v_clear_exit.get()
        self.set_status("Історія буде очищатись при виході з програми" if self.v_clear_exit.get()
                        else "Історія зберігатиметься між запусками")

    def _on_fullscreen(self) -> None:
        self.settings["fullscreen"] = self.v_fullscreen.get()
        self.set_status("Вікно відкриватиметься на весь екран" if self.v_fullscreen.get()
                        else "Вікно відкриватиметься звичайного розміру біля курсора")

    def _on_topmost(self) -> None:
        self.settings["topmost"] = self.v_topmost.get()
        self.root.attributes("-topmost", self.v_topmost.get())

    def _on_theme(self) -> None:
        self.settings["theme"] = self.v_theme.get()
        ctk.set_appearance_mode(self.v_theme.get())
        self._set_dark(ctk.get_appearance_mode() == "Dark")     # прості tk-віджети перефарбовуємо самі

    def _on_hotkey_choice(self) -> None:
        self.settings["hotkey"] = self.v_hotkey.get()
        self.apply_hotkey()

    def apply_hotkey(self, announce: bool = True) -> None:
        spec = self.settings["hotkey"]
        self.hotkey_ok = self.hotkeys.start(spec)
        self.log(f"hotkey {spec!r}: ok={self.hotkey_ok} (try {self._hotkey_tries}) tray={bool(self.tray)} "
                 f"relaunch={self.relaunch_ok}")
        if self.hotkey_ok:
            self._hotkey_tries = 0
        elif spec != "off" and os.name == "nt" and self._hotkey_tries < 6:
            # типова причина: стара копія програми ще не встигла звільнити Ctrl+X (заміна версії) — пробуємо знову
            self._hotkey_tries += 1
            self.root.after(500 * self._hotkey_tries, lambda sp=spec: self._retry_hotkey(sp))
        elif spec != "off" and os.name == "nt":
            self.set_status(self._no_way_back_text(), 12000)
        if announce:
            if self.hotkey_ok:
                self._announce_hotkey()
            elif spec != "off" and os.name == "nt":
                self.set_status(f"Не вдалося зайняти {hotkey_label(spec)} — її вже використовує інша програма")
            else:
                self.set_status("Гарячу клавішу вимкнено")

    def _retry_hotkey(self, spec: str) -> None:
        if not self.hotkey_ok and self.settings["hotkey"] == spec:
            self.apply_hotkey(announce=False)

    def _announce_hotkey(self) -> None:
        if self.hotkey_ok:
            self.set_status(f"{hotkey_label(self.settings['hotkey'])} відкриває і ховає це вікно", 6000)

    def set_status(self, text: str, ms: int = 4000) -> None:
        self.status.configure(text=text)
        if self._status_job:
            self.root.after_cancel(self._status_job)
        self._status_job = self.root.after(ms, lambda: self.status.configure(text=""))

    # -- вікно: показ / ховання / вихід --------------------------------------
    def _can_hide(self) -> bool:
        """Вікно можна сховати (withdraw), лише якщо є шлях назад: гаряча клавіша, трей або повторний запуск exe
        (той показує вікно вже запущеної копії). Інакше сховане вікно було б не повернути — тоді згортаємо."""
        return bool(self.hotkey_ok or self.tray or self.relaunch_ok)

    def _has_ui_way_back(self) -> bool:
        return bool(self.hotkey_ok or self.tray)

    def _no_way_back_text(self) -> str:
        if self.settings["hotkey"] == "off":
            return "Гарячу клавішу вимкнено — вікно згортається в панель завдань"
        return "Гаряча клавіша недоступна — вікно згортається в панель завдань"

    def _hotkey_problem(self) -> str | None:
        """Текст застереження для ⚙, якщо гарячу клавішу просили, але її не вдалося зайняти."""
        if self._use_hotkey and self.settings["hotkey"] != "off" and not self.hotkey_ok:
            return "⚠ " + self._no_way_back_text()
        return None

    # -- журнали: app.log (стани вікна) і error.log (винятки) — обидва обмежені за розміром --------------
    def log(self, msg: str) -> None:
        """Коротка діагностика (show/hide/iconify, hotkey, tray). Пишеться з відкладенням, щоб не гальмувати вікно."""
        t = time.time()
        self._log_buf.append(f"{time.strftime('%H:%M:%S', time.localtime(t))}.{int(t % 1 * 1000):03d} {msg}")
        if self._log_job is None:
            try:
                self._log_job = self.root.after(60, self.flush_logs)
            except tk.TclError:
                self.flush_logs()

    def flush_logs(self) -> None:
        self._log_job = None
        if self._log_buf:
            lines, self._log_buf = self._log_buf, []
            _append_log(self.log_dir, "app.log", "\n".join(lines))

    def _report_exception(self, exc, val, tb) -> None:
        """root.report_callback_exception: усі винятки в обробниках Tk потрапляють у error.log (а не губляться
        в exe без консолі). Сам обробник нічого не кидає."""
        try:
            text = "".join(traceback.format_exception(exc, val, tb))
            _append_log(self.log_dir, "error.log", f"=== {time.strftime('%Y-%m-%d %H:%M:%S')}\n{text}")
            self.log("EXCEPTION " + clip(repr(val), 200))
            try:
                self.set_status("Сталася помилка — подробиці в error.log (⚙ → Показати теку з логами)", 9000)
            except Exception:
                pass
        except Exception:
            pass

    def on_reveal_logs(self) -> None:
        self.flush_logs()
        self._open_folder(self.log_dir, os.path.join(self.log_dir, "app.log"))

    def _open_folder(self, folder: str, select: str | None = None) -> None:
        import subprocess
        try:
            os.makedirs(folder, exist_ok=True)
            if os.name == "nt":
                if select and os.path.exists(select):
                    subprocess.Popen(["explorer", "/select,", os.path.normpath(select)])
                else:
                    os.startfile(folder)             # noqa: S606 — відкриваємо теку користувача
            elif sys.platform == "darwin":
                subprocess.Popen(["open", folder])
            else:
                subprocess.Popen(["xdg-open", folder])
        except (OSError, ValueError, AttributeError):
            self.set_status(f"Тека з логами: {folder}", 9000)

    def _maximize(self) -> None:
        """Розгортає вікно ДО показу (Windows: state("zoomed")), тож воно з'являється одразу на весь екран."""
        self.maximize_count += 1
        self._maximized = True
        self._max_ts = time.monotonic()
        try:
            if os.name == "nt" or sys.platform == "darwin":
                self.root.state("zoomed")
            else:
                self.root.attributes("-zoomed", True)
        except tk.TclError:
            pass

    def _restore_normal(self) -> None:
        if not self._maximized:
            return
        self._maximized = False
        try:
            if os.name == "nt" or sys.platform == "darwin":
                self.root.state("normal")
            else:
                self.root.attributes("-zoomed", False)
        except tk.TclError:
            pass

    def show_window(self, near_cursor: bool = False) -> None:
        """Показ — це розгортання (якщо ввімкнено) + deiconify: усе вже підготовлено при хованні
        (див. _reset_when_hidden), тож жодної перебудови карток тут немає."""
        self._hidden = False
        self.close_popups()
        if self.nav_zone == "right":
            self._nav_leave_right()
        if self.folder_first and self.page != "folders":
            # вікно могло лишитись відкритим позаду (без автоховання) — гаряча клавіша однаково веде до вибору папки
            self._set_page("folders")
        self.flush_render()                    # запас: фонова перебудова ще не встигла — завершуємо її тут
        self._check_scaling()                  # екран міг змінити масштаб, поки вікно було сховане
        full = bool(self.settings["fullscreen"])
        fade = os.name == "nt"       # на Windows: невидимо → розгорнули → домалювали → видимо (без «білого» блимання)
        try:
            if fade:
                self.root.attributes("-alpha", 0.0)
            if full:
                self._maximize()
            else:
                self._restore_normal()
                if near_cursor:
                    self._place_near_cursor()
            self.root.deiconify()
            self.root.lift()
            self.root.attributes("-topmost", True)
            if fade:
                self.root.update_idletasks()
                self._relayout_now()
                self.root.attributes("-alpha", 1.0)
        except tk.TclError:
            pass
        self.root.after(150, self._restore_topmost)
        self.root.focus_force()
        self.root.focus_set()                  # фокус на вікні — працюють Alt+W/A/S/D, Space, Alt+Space
        self.log(f"show full={full} maximized={self._maximized} state={self.root.state()}")

    def _restore_topmost(self) -> None:
        try:
            self.root.attributes("-topmost", self.settings["topmost"])
        except tk.TclError:
            pass

    def close_popups(self) -> None:
        for p in list(self._popups):
            p.close()
        self._popups.clear()

    # Меню стежить за курсором: grab у відкритому підменю не пускає події <Enter> до батьківського меню, тож без
    # цього підменю не закривалось, коли курсор переходив на інший пункт. Тепер: курсор на іншому пункті — підменю
    # закривається (на пункті-підменю — відкривається); курсор пішов за межі всіх меню (після того, як побував у
    # них) — меню закриваються. Реагуємо лише на РУХ миші.
    POPUP_LEAVE_S = 0.35

    def _popup_track_start(self) -> None:
        self._popup_entered = False
        self._popup_out_since = None
        self._popup_last_xy = None
        if getattr(self, "_popup_poll_job", None) is None:
            self._popup_poll_job = self.root.after(60, self._popup_poll)

    def _popup_poll(self) -> None:
        self._popup_poll_job = None
        pops = [p for p in self._popups if not p.closed and p.top is not None]
        if not pops:
            return
        try:
            xy = self.root.winfo_pointerxy()
        except (tk.TclError, KeyError):
            xy = None
        moved = xy is not None and xy != self._popup_last_xy
        if moved:
            self._popup_last_xy = xy
            x, y = xy
            inside = next((p for p in reversed(pops) if p.contains(x, y)), None)
            if inside is not None:
                self._popup_out_since = None
                anc = inside.parent
                while anc is not None:
                    # курсор дійшов до підменю навскіс, зачепивши сусідній пункт батьківського меню, — заплановане
                    # закриття підменю скасовуємо (інакше підменю зникало просто з-під курсора)
                    if anc._sub_job is not None and anc.child is not None:
                        anc._cancel_sub_job()
                        anc._poll_row = -1
                        own = next((k for k, (it, _, _) in enumerate(anc.rows) if it.sub is anc.child.model), -1)
                        if own >= 0:
                            anc._select(own)           # підсвітка — знову на пункті, чиє це підменю
                    anc = anc.parent
                i = inside.row_at(x, y)
                if i >= 0:
                    # «побував у меню» — лише над пунктом: «⋯» і правий клік відкривають меню кутом просто під
                    # курсором, і без цього тремтіння руки на 1–2 px уліво/вгору закривало щойно відкрите меню
                    self._popup_entered = True
                if i >= 0 and i != inside._poll_row:
                    inside._hover(i)
            elif self._popup_entered and self._popup_out_since is None:
                self._popup_out_since = time.monotonic()
        if (self._popup_entered and self._popup_out_since is not None
                and time.monotonic() - self._popup_out_since >= self.POPUP_LEAVE_S):
            self.close_popups()
            return
        self._popup_poll_job = self.root.after(60, self._popup_poll)

    def _check_popup_focus(self) -> None:
        """Фокус пішов з меню в іншу програму — закриваємо меню."""
        if self._popups:
            try:
                if self.root.focus_displayof() is None:
                    self.close_popups()
            except (tk.TclError, KeyError):
                self.close_popups()

    def hide_window(self) -> None:
        self.close_popups()
        self._save_size()
        self.root.withdraw()
        self._hidden = True
        self.log("hidden (withdraw)")
        self.root.after_idle(self._reset_when_hidden)

    def _reset_when_hidden(self) -> None:
        """Робота «за кулісами» після ховання: чистимо пошук і поле форматування і, якщо щось змінилось,
        готуємо список до наступного показу — тоді показ не потребує жодної перебудови."""
        if not self._hidden:
            return
        if self.nav_zone == "right":
            self._nav_leave_right()
        if self.folder_first and self.page != "folders":
            self._set_page("folders")               # гаряча клавіша відкриває вибір папки
        needs = bool(self._query()) or self.limit != PAGE
        if self._query():
            self._search_text = ""
            self._last_query = ""
        self._collapse_format()                  # наступного разу формати згорнуті, Append скасовано, поле порожнє
        if self.checked:
            self.clear_checked()
        first = self.shown[0]["id"] if self.shown else None
        if self.sel_id != first:
            needs = True
        if self.cards._parent_canvas.yview()[0] > 0.001:
            needs = True
        if needs:
            self.sel_id, self.limit = None, PAGE
            self._defer(True)

    def toggle_window(self) -> None:
        if self._modal:
            return
        now = time.monotonic()
        if now - self._last_toggle < TOGGLE_DEBOUNCE:     # подвійне натискання / дребезг — ігноруємо
            return
        self._last_toggle = now
        if self.root.state() in ("normal", "zoomed") and self.root.focus_displayof() is not None:
            self.hide_window()
        else:
            self.show_window(near_cursor=True)

    def _place_near_cursor(self) -> None:
        s = self.scaling()
        w, h = self._size or (int(self.settings["width"] * s), int(self.settings["height"] * s))
        px, py = self.root.winfo_pointerxy()
        area = work_area_at(px, py)             # вікно відкривається на тому моніторі, де зараз курсор
        ax0, ay0, ax1, ay1 = area if area else (0, 0, self.root.winfo_screenwidth(), self.root.winfo_screenheight() - 50)
        x = max(ax0, min(px - w // 2, ax1 - w))
        y = max(ay0, min(py - 40, ay1 - h))
        self.root.geometry(f"{int(w / s)}x{int(h / s)}+{x}+{y}")

    def _on_root_configure(self, event: tk.Event) -> None:
        if event.widget is not self.root:
            return
        # розмір «звичайного» вікна: розгорнутий не запам'ятовуємо (на X11 Configure приходить ще до зміни стану)
        if (self.root.state() == "normal" and not self._is_zoomed()
                and not (self._maximized and time.monotonic() - self._max_ts < 0.8)):
            self._size = (event.width, event.height)
        self._apply_layout(event.width)
        if self._fit_job is not None:
            self.root.after_cancel(self._fit_job)
        self._fit_job = self.root.after(80, self._fit_after_resize)

    def _is_zoomed(self) -> bool:
        """Вікно справді розгорнуте (на X11 state() лишається "normal", тому питаємо атрибут -zoomed)."""
        try:
            if os.name == "nt" or sys.platform == "darwin":
                return self.root.state() == "zoomed"
            return bool(self.root.attributes("-zoomed"))
        except tk.TclError:
            return False

    def _fit_after_resize(self) -> None:
        self._fit_job = None
        self._fit_format_box()

    def _save_size(self) -> None:
        if self._size and self._size[0] > 200 and self._size[1] > 200:
            s = self.scaling()
            size = (int(self._size[0] / s), int(self._size[1] / s))
            size = (min(size[0], int(self.root.winfo_screenwidth() / s)),     # не більше за екран
                    min(size[1], int(self.root.winfo_screenheight() / s)))
            if size != (self.settings["width"], self.settings["height"]):     # без зайвого запису на диск
                self.settings.data["width"], self.settings.data["height"] = size
                self.settings.save()

    def on_close(self) -> None:
        """✕ вікна: закриття (не згортання) — з увімкненим налаштуванням історія буфера очищується."""
        if self._has_ui_way_back():
            if self.settings["clear_on_exit"] and self.history.items:
                self.history.clear()
                self.history.flush()
                self.render()
            self.hide_window()
        else:
            self.quit()

    def quit(self) -> None:
        self.close_popups()
        self.log("quit")
        self.flush_logs()
        self._save_size()
        try:
            if self.settings["clear_on_exit"]:        # справжній вихід (не згортання): історія буфера очищується
                self.history.clear()
            self.history.flush()
        except OSError:
            pass
        self.settings.save()                           # вигляд (список/плитки), ширина колонки й решта — на диск
        self.hotkeys.stop()
        self.local_keys.stop()
        if self.tray:
            try:
                self.tray.stop()
            except Exception:
                pass
        self.root.destroy()

    # -- фоновий цикл -----------------------------------------------------------
    def _poll_events(self) -> None:
        """З WakeQueue події приходять миттєво (пробудження циклу Tk), а цей таймер лише підстраховує (≈5 разів
        на секунду). Зі звичайною чергою (тести) опитуємо кожні ~20 мс, як і раніше."""
        self._beat = time.monotonic()
        self._drain_events()
        wake = isinstance(self.events, WakeQueue)
        self.root.after(EVENT_FALLBACK_MS if wake else EVENT_POLL_MS, self._poll_events)

    def _drain_events(self) -> None:
        """Опрацьовує все, що накопичилось у черзі: гаряча клавіша, трей, друга копія програми.
        Кілька «toggle» зводяться до одного (парні скасовують одне одного)."""
        batch: list[str] = []
        try:
            while True:
                batch.append(self.events.get_nowait())
        except queue.Empty:
            pass
        if not batch:
            return
        if "quit" in batch:
            self.quit()
            return
        if "show" in batch:
            self.show_window()
        elif batch.count("toggle") % 2:
            self.toggle_window()
        if "alt_space" in batch:
            self.on_alt_space()

    def on_alt_space(self) -> None:
        """Alt+Space (на Windows — через LocalKeys, бо інакше відкривається системне меню вікна): у вікні вибору
        конструкта / аппендів — обрати підсвічений пункт, скопіювати й сховати; у головному вікні — скопіювати
        вибраний запис і сховати вікно (на сторінці папок — відкрити папку)."""
        self.log(f"alt+space picker={self._picker is not None} zone={self.nav_zone}")
        picker = self._picker
        if picker is not None:
            try:
                if picker.winfo_exists():
                    picker.alt_space()
                    return
            except tk.TclError:
                pass
            self._picker = None
        if self._modal or self.tab != "clip":
            return
        self.nav_activate(hide=True)

    def _tick(self) -> None:
        try:
            self._tick_work()
        except Exception:
            self._report_exception(*sys.exc_info())     # помилка в одному такті не зупиняє опитування буфера
        finally:
            self.root.after(POLL_MS, self._tick)

    def _check_scaling(self) -> None:
        """Вікно перетягли на монітор з іншим масштабом (DPI): ctk масштабує свої віджети сам, а прості tk-віджети,
        шрифти, переноси тексту й розмір вікна — лише тут. Раніше картки при цьому дублювались і розходились у розмірі."""
        s = self.scaling()
        if abs(s - self._pf_scale) <= 0.01:
            return
        self.log(f"scaling {self._pf_scale:.2f} -> {s:.2f}")
        self._make_pfonts()
        self._reset_cards()                                  # картки створюються заново вже з новим масштабом
        if self._cat_hint is not None:
            self._cat_hint.destroy()
            self._cat_hint = None
        self._cat_sig = None
        self._left_w = self._right_w = -999                  # примусово перерахувати ширини колонок і переноси
        try:
            self.root.update_idletasks()
            self._apply_layout(self.root.winfo_width())
            if self._fmt_built:
                self._fmt_armed_hint.configure(wraplength=int((self._right_w - 40) * s))
        except tk.TclError:
            pass
        self._render_now(True)
        self.flush_render()
        self._refit_window()
        self.root.after(300, self._relayout_now)

    def _refit_window(self) -> None:
        """Після зміни масштабу вікно не повинне виходити за межі екрана: розгорнуте — розгортаємо наново на
        поточному моніторі, звичайне — повертаємо збережений розмір, обмежений розміром екрана."""
        try:
            s = self.scaling()
            if self._is_zoomed():
                if os.name == "nt":
                    self.root.state("normal")
                    self.root.update_idletasks()
                    self.root.state("zoomed")
                return
            sw, sh = self.root.winfo_screenwidth() / s, self.root.winfo_screenheight() / s
            w = int(min(self.settings["width"], max(1040, sw - 40)))
            h = int(min(self.settings["height"], max(520, sh - 100)))
            self.root.geometry(f"{w}x{h}")
        except tk.TclError:
            pass

    def _release_stale_grab(self) -> None:
        """Захоплення миші (grab), що лишилось від закритого меню/діалогу, «глушить» усі кліки в програмі.
        Якщо жодного меню/діалогу немає, а захоплення є — знімаємо його."""
        if self._popups or self._modal:
            return
        try:
            g = self.root.grab_current()
            if g is not None:
                self.log(f"stale grab released: {g}")
                g.grab_release()
        except (tk.TclError, KeyError):
            pass

    def _tick_work(self) -> None:
        self._release_stale_grab()
        self._check_scaling()
        if self.preset.reload():                     # файл пресета змінили ззовні (редактор, синхронізація)
            self._update_title()
            self.render()
            self.set_status("Пресет оновлено з файлу")

        if not self.settings["paused"]:
            seq = clipboard_sequence()               # Windows: номер змінюється лише коли щось скопіювали
            if seq is None or seq != self._clip_seq:
                self._clip_seq = seq
                try:
                    text = self.root.clipboard_get()
                except tk.TclError:
                    text = None  # порожній буфер або не текст (картинка, файли)
                if text and text != self._last_seen:
                    self._last_seen = text
                    if self.history.add(text):
                        self.sel_id = None
                        if self.sel_format and self._fmt_built:
                            self._update_format_preview()          # автозначення з історії оновлюються
                        if self._is_history():
                            self.render(scroll_top=True)
                        else:
                            self.render_sidebar()
        self.history.flush()                         # запис історії на диск — тут, а не на кожне копіювання
        if not self._tick_marked:
            self._tick_marked = True
            _mark("first_tick_done")


def _tune_ctk() -> None:
    """customtkinter сам будить цикл подій постійно: перевірка теми ОС кожні 30 мс і масштабу екрана кожні
    100 мс. Для програми, що більшу частину часу сховано в треї, це зайва робота — рідшаємо перевірки
    (системна тема й масштаб підхоплюються не за 30 мс, а за ~1 с / ~0,5 с)."""
    try:
        from customtkinter.windows.widgets.appearance_mode import AppearanceModeTracker
        AppearanceModeTracker.update_loop_interval = 1000
    except Exception:
        pass
    try:
        from customtkinter.windows.widgets.scaling import ScalingTracker
        ScalingTracker.update_loop_interval = 500
        ScalingTracker.check_dpi_scaling = classmethod(_debounced_dpi_check)
    except Exception:
        pass


# Зміна масштабу (DPI), коли вікно перетягують на інший монітор. Штатно ctk перемасштабовує ВСІ віджети одразу —
# ще посеред перетягування, а на межі двох моніторів з різним масштабом — знову й знову (вікно «замерзало»).
# Тут: новий масштаб застосовується, лише коли він тримається ≥ 0,6 с і кнопку миші відпущено (перетягування
# завершено); перед цим програма прибирає картки (їх однаково буде створено заново), щоб не масштабувати їх даремно.
_DPI_PENDING: dict = {}
DPI_HOOKS: dict = {}          # вікно → (до_масштабування, після_масштабування)


def _mouse_down() -> bool:
    if os.name != "nt":
        return False
    try:
        import ctypes
        return bool(ctypes.windll.user32.GetAsyncKeyState(0x01) & 0x8000)
    except Exception:
        return False


def _debounced_dpi_check(cls) -> None:
    now = time.monotonic()
    for window in list(cls.window_widgets_dict):
        try:
            if not window.winfo_exists() or window.state() == "iconic":
                continue
            val = cls.get_window_dpi_scaling(window)
        except Exception:
            continue
        if val == cls.window_dpi_scaling_dict.get(window):
            _DPI_PENDING.pop(window, None)
            continue
        pend = _DPI_PENDING.get(window)
        if pend is None or pend[0] != val:
            _DPI_PENDING[window] = (val, now)
            continue
        if now - pend[1] < 0.6 or _mouse_down():
            continue
        _DPI_PENDING.pop(window, None)
        hooks = DPI_HOOKS.get(window)
        try:
            if hooks:
                hooks[0]()
            cls.window_dpi_scaling_dict[window] = val
            window.block_update_dimensions_event()
            cls.update_scaling_callbacks_for_window(window)
            window.unblock_update_dimensions_event()
            if hooks:
                hooks[1]()
        except Exception:
            pass
    delay = 150 if _DPI_PENDING else cls.update_loop_interval
    for app in list(cls.window_widgets_dict):
        try:
            app.after(delay, cls.check_dpi_scaling)
            return
        except Exception:
            continue
    cls.update_loop_running = False


def _widget_count(w) -> int:
    return 1 + sum(_widget_count(c) for c in w.winfo_children())


def _write_timing(path: str, app: "App | None", root) -> None:
    """Дописує стадії запуску в startup-timing.log (лише при --timing)."""
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        lines = [f"=== запуск pid={os.getpid()} t0_epoch={_T0_EPOCH:.3f} {time.strftime('%Y-%m-%d %H:%M:%S')}"]
        marks = [("imports_done", _IMPORTS_DONE_MS, _IMPORTS_DONE_EPOCH)] + _MARKS
        for name, ms, epoch in marks:
            lines.append(f"{name:<18} t_ms={ms:8.1f} epoch={epoch:.3f}")
        if app is not None:
            try:
                lines.append(f"render_list_calls={app.render_count} sidebar_renders={app.sidebar_render_count} "
                             f"cards={len(app._card_objs)} widgets={_widget_count(root)}")
            except Exception:
                pass
        with open(path, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    except OSError:
        pass


_T0_EPOCH = time.time()


def _biobib_check(data_dir: str) -> int:
    """--biobib-check: запускає вбудований сервер бібліотеки, читає розділи й головну сторінку, пише
    результат у <data-dir>/biobib-check.txt (CI перевіряє, що FastAPI/uvicorn і статика потрапили в .exe)."""
    import json
    import urllib.request
    out = os.path.join(data_dir, "biobib-check.txt")
    os.makedirs(data_dir, exist_ok=True)
    try:
        from biobib import config as bb_config, server as bb_server
        bb_config.configure(os.path.join(data_dir, "biobib"))
        url = bb_server.ensure_running()
        secs = json.loads(urllib.request.urlopen(url + "api/sections", timeout=10).read())
        page = urllib.request.urlopen(url, timeout=10).read().decode("utf-8")
        js = urllib.request.urlopen(url + "static/app.js", timeout=10).read()
        ok = "BioBib" in page and len(js) > 1000 and [s_["path"] for s_ in secs][:2] == \
            ["Дисертація", "Дисертація › Актуальність"]
        text = ("OK " if ok else "FAIL ") + json.dumps([s_["path"] for s_ in secs], ensure_ascii=False)
        bb_server.stop()
    except Exception:
        text = "FAIL " + traceback.format_exc()
        ok = False
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    global _TIMING
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--data-dir", default=default_data_dir(), help="тека з історією й налаштуваннями")
    parser.add_argument("--preset", help="файл пресета (.preset.json), з яким працювати")
    parser.add_argument("--no-hotkey", action="store_true", help="не реєструвати глобальну гарячу клавішу")
    parser.add_argument("--no-tray", action="store_true", help="не показувати іконку в треї")
    parser.add_argument("--minimized", action="store_true", help="запуститись одразу у фоні (без вікна)")
    parser.add_argument("--timing", action="store_true",
                        help="записати стадії запуску в <data-dir>/startup-timing.log (для діагностики швидкості)")
    parser.add_argument("--biobib-check", action="store_true",
                        help="перевірити вбудовану бібліотеку «Посилання» (сервер + API) і вийти (для CI)")
    args = parser.parse_args(argv)
    if args.timing:
        _TIMING = True
    _mark("args_parsed")
    if args.biobib_check:
        return _biobib_check(os.path.abspath(args.data_dir))

    events = WakeQueue()
    lock, status = acquire_single_instance(lambda: events.put("show"), lambda: events.put("quit"))
    if lock is None:
        if status == "outdated":
            notify(APP_NAME, "Уже працює стара версія програми, яка не вміє оновлюватись автоматично.\n\n"
                             "Закрийте її (у її вікні: ⚙ → «Вийти з програми», або іконка в треї → «Вийти») "
                             "і запустіть програму ще раз.")
        elif status == "stuck":
            notify(APP_NAME, "Не вдалося закрити попередню копію програми. Закрийте її вручну "
                             "(іконка в треї → «Вийти» або Диспетчер завдань) і запустіть знову.")
        return 0  # інша копія вже працює (і, якщо можна, показала своє вікно)
    _mark("single_instance_ok")

    data_dir = os.path.abspath(args.data_dir)

    def _crash_hook(exc, val, tb) -> None:            # помилки поза обробниками Tk (старт, потоки) — теж у error.log
        _append_log(data_dir, "error.log", f"=== {time.strftime('%Y-%m-%d %H:%M:%S')} (main)\n"
                    + "".join(traceback.format_exception(exc, val, tb)))

    sys.excepthook = _crash_hook
    threading.excepthook = lambda a: _crash_hook(a.exc_type, a.exc_value, a.exc_traceback)
    settings = Settings(os.path.join(data_dir, "settings.json"))
    preset, warning = open_startup_preset(settings, data_dir, args.preset)
    history = History(history_path(data_dir))
    if settings["clear_on_exit"] and history.items:
        # попередній запуск міг завершитись без quit() (вимкнення ПК, диспетчер завдань, збій) — історія однаково порожня
        history.clear()
    _mark("data_loaded")

    _tune_ctk()
    ctk.set_appearance_mode(settings["theme"])
    root = ctk.CTk()
    root.withdraw()                         # будуємо вікно схованим; App покаже його, коли воно готове
    _mark("root_created")
    app = App(root, preset, history, settings, events,
              use_hotkey=not args.no_hotkey, use_tray=not args.no_tray, start_hidden=args.minimized,
              relaunch_ok=hasattr(lock, "accept"))      # справжній замок-сокет: повторний запуск exe показує вікно
    try:                                    # системна тема змінилась на льоту — перефарбовуємо прості tk-віджети
        from customtkinter.windows.widgets.appearance_mode import AppearanceModeTracker
        AppearanceModeTracker.add(lambda mode: root.after_idle(app._set_dark, mode == "Dark"))
    except Exception:
        pass
    if warning:
        app.set_status(warning, 12000)
        if not args.minimized:
            root.after(400, lambda: messagebox.showwarning(APP_NAME, warning, parent=root))
    if _TIMING:
        log = os.path.join(data_dir, "startup-timing.log")
        root.after(1500, lambda: _write_timing(log, app, root))    # після повного малювання й першого тіку
    root.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
