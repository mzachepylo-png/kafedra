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
                     apply_merge, apply_user_link, clean_v2, compose_phrases, format_actions, has_user_placeholder,
                     join_values, last_user_id, numbers_from_history, user_link, v2_compose)
from store import (HISTORY, PALETTE, PRESET_SUFFIX, History, Preset, PresetError, Settings,
                   default_data_dir, history_path, open_startup_preset)
from winsys import (work_area_at, HOTKEY_PRESETS, HotkeyListener, acquire_single_instance, clipboard_sequence, hotkey_label,
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
CAT_SCROLL_FACTOR = 2          # у скільки разів швидша прокрутка колесом у списку папок
ZONE_W = 150                   # права «службова» зона картки (галочка, «⋯», «✕»): клік там нічого не копіює
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
COPIED = ("#2e9e57", "#2f9e5a")          # плашка «✓ Скопійовано» на картці
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


def row_colors(color: str | None) -> tuple[tuple, tuple, tuple, tuple]:
    """(фон, фон при наведенні, фон вибраного, рамка) для рядка категорії в бічній колонці.
    З кольором — ТА САМА рецептура, що й у карток записів (card_colors/tint), тож папка залита кольором
    повністю, а не лише крапкою; вибраний рядок — із сильнішим відтінком. Без кольору (історія) — нейтральний."""
    if not color:
        return ("transparent", ROW_HOVER, ROW_SEL, PANEL_BORDER)
    fill, hover, border = card_colors(color)
    return fill, hover, tint(color, 0.27, 0.40), border


def card_colors(color: str | None) -> tuple[tuple, tuple, tuple]:
    """(фон, фон при наведенні, рамка) для картки з кольором; без кольору — нейтральні."""
    if not color:
        return CARD, CARD_HOVER, CARD_BORDER
    fill, hover = tint(color), tint(color, 0.20, 0.28)
    border = (blend(color, CARD_BORDER[0], 0.40), blend(color, CARD_BORDER[1], 0.55))
    return fill, hover, border


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

    # -- побудова й показ -------------------------------------------------------
    def show(self, x: int, y: int, side_left: int | None = None) -> None:
        app = self.app
        if self.parent is None:
            app.close_popups()
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
        try:
            try:
                self.wait_visibility()
                self.grab_set()
            except tk.TclError:
                pass
            self.wait_window()
        finally:
            self.app._modal -= 1
        return self.result

    def cancel(self) -> None:
        self.result = None
        self.destroy()

    def destroy(self) -> None:
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
    def __init__(self, app: "App", title: str, text: str = "", category: str | None = None, v2: dict | None = None):
        super().__init__(app, title, 640, 560)
        self.v2 = copy.deepcopy(v2) if v2 else None
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

    def _sync_v2(self) -> None:
        on = self.v2_var.get()
        n = len((self.v2 or {}).get("options", []))
        self.v2_btn.configure(state="normal" if on else "disabled",
                              text=f"Аппенди… ({n})" if on and n else "Аппенди…")

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
        self.result = (text, cat_id, clean_v2(self.v2) if self.v2_var.get() else None)
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
        self.list = ctk.CTkScrollableFrame(card, fg_color="transparent", corner_radius=0,
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
                           border_color=blend(color, CARD_BORDER[0], 0.5))
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
    «Назад» повертає на рівень вище. Ctrl + клік по кінцевому / «Копіювати зараз» — ще й ховає вікно програми.
    Результат: {"text": ..., "hide": bool} або None."""

    def __init__(self, app: "App", main: str, v2: dict, uid: str | None = None, link_on: bool = False,
                 on_edit=None):
        super().__init__(app, "Копіпаста з варіантами", 640, 700)
        self.main = main
        self.uid = uid
        self.on_edit = on_edit
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
        self.list = ctk.CTkScrollableFrame(card, fg_color="transparent", corner_radius=0,
                                           scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.list.pack(fill="both", expand=True, padx=10, pady=2)
        # нижче — галочка «in {LINK:USER:…:E}» (останній користувач з історії буфера) і редагування пунктів
        extra = ctk.CTkFrame(card, fg_color="transparent")
        extra.pack(fill="x", padx=18, pady=(6, 0))
        self.link_var = tk.BooleanVar(value=bool(link_on and uid))
        self.link_cb = ctk.CTkCheckBox(
            extra, text=f"Append  in {user_link(uid)}" if uid else "Append  in {LINK:USER:…:E} — у історії немає користувача",
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
        for w in (self.now_btn._canvas, getattr(self.now_btn, "_text_label", None)):   # Ctrl+клік → ще й сховати вікно
            if w is not None:
                w.bind("<ButtonPress-1>", lambda e: setattr(self, "_ctrl", bool(e.state & 0x4)), add="+")
        self.now_btn.configure(command=lambda: self.finish(self.compose(), getattr(self, "_ctrl", False)))
        ctk.CTkButton(bottom, text="Скасувати", width=104, height=42, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg, command=self.cancel).pack(side="right")
        self._ctrl = False
        self.render_level()

    def compose(self) -> str:
        extras = [a["text"] for a in self.addons if self.ticked.get(a["id"])]
        out = v2_compose(self.main, self.steps, extras)
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
            lbl.bind("<Button-1>", lambda e, n=node: self.pick(n, bool(e.state & 0x4)))
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


class ColorDialog(_Dialog):
    """Вибір кольору: сітка плашок + «Інший колір…» (+ «Як у папки» для запису).
    Результат: None (скасовано) | ("set", "#rrggbb") | ("reset", None)."""

    COLUMNS = 6

    def __init__(self, app: "App", title: str, current: str | None, allow_reset: bool = False,
                 reset_label: str = "Як у папки"):
        rows = (len(SWATCHES) + self.COLUMNS - 1) // self.COLUMNS
        super().__init__(app, title, 470, 230 + rows * 58)
        self.current = (current or "").lower()
        card = ctk.CTkFrame(self, corner_radius=16, fg_color=PANEL, border_width=1, border_color=PANEL_BORDER)
        card.pack(fill="both", expand=True, padx=14, pady=14)
        ctk.CTkLabel(card, text="Оберіть колір", anchor="w", text_color=MUTED, font=app.f.body).pack(
            fill="x", padx=22, pady=(18, 8))
        grid = ctk.CTkFrame(card, fg_color="transparent")
        grid.pack(padx=18)
        self.swatches: dict[str, ctk.CTkButton] = {}
        for n, color in enumerate(SWATCHES):
            mark = "✓" if color.lower() == self.current else ""
            b = ctk.CTkButton(grid, text=mark, width=48, height=48, corner_radius=24, fg_color=color,
                              hover_color=blend(color, "#000000", 0.18), text_color="#ffffff", font=app.f.icon,
                              command=lambda c=color: self.choose(c))
            b.grid(row=n // self.COLUMNS, column=n % self.COLUMNS, padx=5, pady=5)
            self.swatches[color] = b
        row = ctk.CTkFrame(card, fg_color="transparent")
        row.pack(fill="x", padx=22, pady=(12, 18))
        ctk.CTkButton(row, text="Інший колір…", width=124, height=40, corner_radius=12, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg,
                      command=self.custom).pack(side="left")
        if allow_reset:
            ctk.CTkButton(row, text=reset_label, width=110, height=40, corner_radius=12, fg_color=BTN2,
                          hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.dlg,
                          command=self.reset).pack(side="left", padx=(8, 0))
        ctk.CTkButton(row, text="Скасувати", width=100, height=40, corner_radius=12, fg_color="transparent",
                      hover_color=BTN2, text_color=MUTED, font=app.f.dlg,
                      command=self.cancel).pack(side="right")

    def choose(self, color: str) -> None:
        self.result = ("set", color.lower())
        self.destroy()

    def reset(self) -> None:
        self.result = ("reset", None)
        self.destroy()

    def custom(self) -> None:
        hex_color = RGBDialog(self.app, self.current or None).run()
        try:
            self.grab_set()                       # після вкладеного діалогу повертаємо захоплення собі
        except tk.TclError:
            pass
        if hex_color:
            self.choose(hex_color)


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
        self.text, self.ts, self.color = it["text"], it["ts"], it.get("color")
        self.v2 = bool(it.get("v2"))
        self.ulink = card_user_link(it)
        self.fill, self.hover, self.border = card_colors(self.color)
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
                                      border_width=2 if selected else 1,
                                      border_color=ACCENT if selected else self.border,
                                      **({"width": 10, "height": app._rec_tile_h} if tile else {}))
        f.grid_columnconfigure(1, weight=1)
        if tile:                                       # плитка — «квадрат»: зверху службова смужка зі значками, нижче текст
            f.grid_propagate(False)
            f.grid_rowconfigure(1, weight=1)
        self.bar = tk.Frame(f, width=6, height=8, cursor="hand2", bg=col(self.color or NEUTRAL))
        self.bar.grid(row=0, column=0, rowspan=2, sticky="ns", padx=(9, 0), pady=10)
        c0 = 1 if tile else 0                           # у плитці перед значками є розпірка (колонка 0)
        # ліва частина (смужка + текст) — зона копіювання: клік копіює запис; права — «службова», там клік нічого не робить,
        # лише значки: галочка (історія), «⋯» (редагування, колір, переміщення…) і «✕» (видалити)
        self.body = tk.Label(f, anchor="w", justify="left", font=pf.card, wraplength=wrap_px, cursor="hand2",
                             text=self.shown_text(), bg=bg, fg=col(TEXT), pady=8)
        if tile:
            # плитка має фіксовану висоту: увесь текст лежить у «вікні» clip і прокручується колесом миші
            self.clip = tk.Frame(f, bg=bg, cursor="hand2")
            self.clip.grid(row=1, column=1, sticky="nsew", padx=(12, 10), pady=(0, 8))
            self.body.destroy()
            self.body = tk.Label(self.clip, anchor="nw", justify="left", font=pf.card, wraplength=wrap_px,
                                 cursor="hand2", text=self.shown_text(), bg=bg, fg=col(TEXT), pady=2)
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
        else:
            self.body.grid(row=0, column=1, sticky="nsew", padx=(12, 4), pady=4)   # відступ 4: видно заокруглену рамку
            f.grid_rowconfigure(0, weight=1, minsize=int(CARD_MIN_H * app.scaling()))
            self.zone = tk.Frame(f, bg=bg, width=int((ZONE_W + (70 if checkable else 0)) * app.scaling()), cursor="arrow")
            self.zone.grid(row=0, column=2, sticky="ns", padx=(0, 4), pady=4)
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
                                     bg_fn=self.bg_now)
        self.dele = app._icon_button(self.zone, "✕", lambda e: app.on_delete(self.iid), hover_text=DANGER,
                                     bg_fn=self.bg_now)
        self.more.grid(row=0, column=c0 + 1, padx=(0, 2), pady=(0 if tile else 8, 0), sticky="n")
        self.dele.grid(row=0, column=c0 + 2, padx=(0, 4 if tile else 8), pady=(0 if tile else 8, 0), sticky="n")
        self.plain = (self.body, self.more, self.dele) + ((self.check,) if self.check else ()) + \
            ((self.clip, self.more_hint) if self.clip is not None else ())
        self.flash_job = None
        self.flash_lbl = None
        # одна пара «bindtag» на всі картки замість ~25 прив'язок на кожну (див. App._init_tags);
        # клік у правій зоні ігнорується в App._drag_press (порівняння з лівим краєм self.zone)
        for w in (f._canvas, self.bar, self.body) + ((self.clip, self.more_hint) if self.clip is not None else ()):
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
        return body + ("   ▶ v.2" if self.v2 else "") + ("   @ user" if self.ulink else "")

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
        step = max(1, int(36 * self.app.scaling()))
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
        if self._off > over:
            self._off = over
            self.body.place_configure(y=-over)
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

    def inert(self, x_root: int, y_root: int) -> bool:
        """Точка в службовій зоні картки (там клік нічого не копіює): праворуч у списку, у верхній смужці — у плитці."""
        if self.tile:
            return y_root < (self.clip or self.body).winfo_rooty()
        return x_root >= self.zone.winfo_rootx()

    def set_drop(self, on: bool) -> None:
        """Підсвітка плитки-цілі під час перетягування (перестановка)."""
        self.frame.configure(border_color=ACCENT if (on or self.selected) else self.border,
                             border_width=3 if on else (2 if self.selected else 1))

    def set_tile_h(self, h: int) -> None:
        if self.tile and h != getattr(self, "_tile_h", None):      # configure ctk-фрейма = повне перемалювання
            self._tile_h = h
            self.frame.configure(height=h)

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
        text, ts, color = it["text"], it["ts"], it.get("color")
        v2, ulink = bool(it.get("v2")), card_user_link(it)
        if text != self.text or ts != self.ts or v2 != self.v2 or ulink != self.ulink:
            self.text, self.ts, self.v2, self.ulink = text, ts, v2, ulink
            self.body.configure(text=self.shown_text())
        if color != self.color:
            self.color = color
            self.fill, self.hover, self.border = card_colors(color)
            self.frame.configure(border_color=ACCENT if self.selected else self.border)
            self.colorize()

    def colorize(self) -> None:
        """Розставляє кольори за поточними станом і темою (викликається й при зміні теми)."""
        a = self.app
        fill = self.hover if self.hovering else self.fill
        self.cur = fill
        self.frame.configure(fg_color=fill)
        bg = a.col(fill)
        self.bar.configure(bg=a.col(self.color or NEUTRAL))
        self.body.configure(bg=bg, fg=a.col(TEXT))
        self.zone.configure(bg=bg)
        if self.clip is not None:
            self.clip.configure(bg=bg)
            self.more_hint.configure(bg=bg, fg=a.col(MUTED))
        for w in (self.more, self.dele):
            w.configure(bg=bg, fg=a.col(MUTED))
        if self.check is not None:
            self.check.configure(bg=bg)
            self._draw_check()

    def paint(self, fill) -> None:
        self.cur = fill
        self.frame.configure(fg_color=fill)
        bg = self.app.col(fill)
        for w in self.plain:
            w.configure(bg=bg)
        self.zone.configure(bg=bg)

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
            self.frame.configure(border_color=ACCENT if sel else self.border, border_width=2 if sel else 1)

    def destroy(self) -> None:
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

    def __init__(self, app: "App", parent, key: str, real: bool, tile: bool = False):
        self.app, self.key, self.real, self.tile = app, key, real, tile
        self.sig = None
        self.selected = False
        self.hovering = False
        self.fill = self.hover = self.sel_fill = self.border = None
        self.color = None
        self.cur = "transparent"
        pf = app.pf
        if tile:                                       # плитка: заокруглений «квадрат» (кружечок і «⋯» зверху, назва, лічильник)
            self.row = ctk.CTkFrame(parent, corner_radius=14, fg_color="transparent", border_width=0,
                                    border_color=PANEL_BORDER, cursor="hand2", width=10, height=96)
            self.row.grid_propagate(False)
            self.row.grid_columnconfigure(0, weight=1)
            self.row.grid_rowconfigure(1, weight=1)
            self.bar = tk.Frame(self.row, width=0, height=0)            # не показується; потрібна лише для colorize()
            self.dot = app._swatch(self.row, "#888888", lambda k=key: app.on_category_color(k))
            self.dot.grid(row=0, column=0, sticky="w", padx=(10, 0), pady=(10, 0))
            self.more = app._icon_button(self.row, "⋯", lambda e: app.show_category_menu(e.x_root, e.y_root, key),
                                         bg_fn=lambda: app.col(_eff(self.cur)))
            self.more.grid(row=0, column=1, sticky="ne", padx=(0, 4), pady=(4, 0))
            self.label = tk.Label(self.row, anchor="nw", justify="left", cursor="hand2", font=pf.bold,
                                  wraplength=int(90 * app.scaling()))
            self.label.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=(10, 6), pady=(4, 0))
            self.num = tk.Label(self.row, font=pf.meta, cursor="hand2", anchor="w")
            self.num.grid(row=2, column=0, columnspan=2, sticky="w", padx=(10, 6), pady=(0, 8))
            self.plain = [self.label, self.num, self.more]
            parts = [self.row, self.label, self.num]
            app._bind_all(parts, "<ButtonPress-1>", lambda e: app._reorder_press("cat", key, e))   # клік — вибір,
            app._bind_all(parts, "<B1-Motion>", lambda e: app._reorder_motion(e))               # перетягування —
            app._bind_all(parts, "<ButtonRelease-1>", lambda e: app._reorder_release(e))        # перестановка
            app._bind_all(parts + [self.dot, self.more], "<Button-3>",
                          lambda e: app.show_category_menu(e.x_root, e.y_root, key))
            app._hoverable(self.row, parts + [self.dot, self.more], self._enter, self._leave)
            return
        self.row = ctk.CTkFrame(parent, corner_radius=12, fg_color="transparent", border_width=0,
                                border_color=PANEL_BORDER, cursor="hand2", height=ROW_H)
        self.row.grid_propagate(False)                 # висота рядка фіксована: ROW_H
        self.row.grid_columnconfigure(2, weight=1)
        self.row.grid_rowconfigure(0, weight=1)
        self.bar = tk.Frame(self.row, width=6, height=8, cursor="hand2")
        self.bar.grid(row=0, column=0, sticky="ns", padx=(9, 0), pady=10)
        if real:
            self.dot = app._swatch(self.row, "#888888", lambda k=key: app.on_category_color(k))
        else:
            self.dot = tk.Label(self.row, text="●", font=pf.body, width=2, cursor="hand2")
        self.dot.grid(row=0, column=1, padx=(9, 8), pady=9)
        self.label = tk.Label(self.row, anchor="w", cursor="hand2", font=pf.card)
        self.label.grid(row=0, column=2, sticky="we", pady=7)
        self.num = tk.Label(self.row, font=pf.meta, cursor="hand2")
        self.num.grid(row=0, column=3, padx=(4, 4 if real else 12))
        self.more = None
        if real:
            self.more = app._icon_button(self.row, "⋯", lambda e: app.show_category_menu(e.x_root, e.y_root, key),
                                         bg_fn=lambda: app.col(_eff(self.cur)))
            self.more.grid(row=0, column=4, padx=(0, 6))
        self.plain = [w for w in (self.label, self.num, self.more) if w is not None]
        if not real:
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

    def set_size(self, height: int, wrap_px: int) -> None:
        """Лише для плиток: висота «квадрата» і ширина переносу назви."""
        if (height, wrap_px) != getattr(self, "_size", None):
            self._size = (height, wrap_px)
            self.row.configure(height=height)
            self.label.configure(wraplength=wrap_px)

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

    def update(self, name: str, color: str, count: int, selected: bool) -> None:
        a = self.app
        sig = (name, color, count, selected, a._name_chars)
        if sig == self.sig:
            return
        old = self.sig
        self.sig = sig
        if old is None or old[1] != color:
            self.color = color
            self.fill, self.hover, self.sel_fill, self.border = row_colors(color if self.real else None)
            a._row_fills[self.key] = (self.fill, self.sel_fill)
            if self.real:
                self.dot.configure(fg_color=color)
        if old is None or old[0] != name or old[4] != a._name_chars:
            self.label.configure(text=name if self.tile else clip(name, a._name_chars))
        if old is None or old[2] != count:
            self.num.configure(text=str(count))
        self.selected = selected
        self.hovering = False if selected else self.hovering
        fill = self.sel_fill if selected else (self.hover if self.hovering else self.fill)
        self.cur = fill
        if self.real:      # один configure замість трьох (кожен = перемалювання ctk-фрейма)
            self.row.configure(fg_color=fill, border_width=2 if selected else 1,
                               border_color=ACCENT if selected else self.border)
        else:
            self.row.configure(fg_color=fill)
        self.colorize()

    def colorize(self) -> None:
        a = self.app
        bg = a.col(_eff(self.cur))
        self.bar.configure(bg=a.col(self.color if self.real else NEUTRAL))
        self.label.configure(fg=a.col(TEXT))
        self.num.configure(fg=a.col(META))
        if not self.real:
            self.dot.configure(fg=a.col(self.color))
        for w in self.plain:
            w.configure(bg=bg)
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
        bg = self.app.col(fill)
        for w in self.plain:
            w.configure(bg=bg)

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
        self.name.configure(fg=a.col(TEXT if self.known else FAINT))
        self.sub.configure(fg=a.col(META if self.known else FAINT))
        if not self.known:
            self.swatch.configure(fg=a.col(NEUTRAL))
        bg = a.col(self.cur)
        for w in self.plain:
            w.configure(bg=bg)
        if self.more is not None:
            self.more.configure(fg=a.col(MUTED))

    def destroy(self) -> None:
        self.row.destroy()


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
        self.root = root
        self.preset = preset
        self.history = history
        self.settings = settings
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
        self.cat_tiles = settings["cat_view"] == "tiles"       # папки плитками
        self.rec_tiles = settings["rec_view"] == "tiles"       # копіпасти плитками
        self._left_user = int(settings["left_w"] or 0)          # ширина лівої колонки від користувача (0 — авто)
        self._cat_cols = 2
        self._cat_sig = None
        self._rec_cols, self._rec_tile_h, self._rec_sig = 1, 140, None
        self._plan_layout(int(settings["width"] * self.scaling()))   # ширини колонок/переносів — одразу остаточні

        self._build_ui()
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
                    title=(17, "bold"), menu=(14, "normal"))
        old = getattr(self, "pf", None)
        if old is not None:             # зміна масштабу: розмір шрифтів міняється НА МІСЦІ — усі віджети оновлюються самі
            for name, (size, _) in spec.items():
                getattr(old, name).configure(size=-max(1, round(size * s)))
            return
        self.pf = SimpleNamespace(**{n: tkfont.Font(root=self.root, family=FONT, size=-max(1, round(sz * s)),
                                                    weight=w) for n, (sz, w) in spec.items()})

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
        for w, bg, fg in self._themed:
            if fg is None:                              # звичайний tk.Frame (без кольору тексту)
                w.configure(bg=self.col(bg))
            else:
                w.configure(bg=self.col(bg), fg=self.col(fg))
        for obj in (*self._card_objs.values(), *self._row_objs.values(), *self._fmt_rows.values()):
            obj.colorize()
        if self._cat_hint is not None:
            self._cat_hint.configure(bg=self.col(PANEL), fg=self.col(MUTED))

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

    def _icon_button(self, parent, text: str, command, hover_text=TEXT, hover_bg=BTN2, bg_fn=None) -> tk.Label:
        """Маленька кнопка-піктограма («⋯», «✕»): проста tk-мітка (створення ≈ 0,1 мс замість ≈ 2 мс у ctk).
        bg_fn повертає колір фону контейнера, який відновлюється, коли курсор іде."""
        lbl = tk.Label(parent, text=text, font=self.pf.icon, padx=7, pady=2, cursor="hand2",
                       fg=self.col(MUTED), bg=bg_fn() if bg_fn else self.col(PANEL))

        def enter(e=None):
            lbl.configure(bg=self.col(hover_bg), fg=self.col(hover_text))

        def leave(e=None):
            lbl.configure(bg=bg_fn() if bg_fn else self.col(PANEL), fg=self.col(MUTED))

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
        top.grid_columnconfigure(0, weight=1)
        self.search = ctk.CTkEntry(top, height=42, corner_radius=14, fg_color=INPUT, border_color=PANEL_BORDER,
                                   placeholder_text="Пошук у відкритому розділі…", font=self.f.body,
                                   text_color=TEXT)
        self.search.grid(row=0, column=0, sticky="ew")
        self.search.bind("<KeyRelease>", lambda e: self._schedule_search(), add="+")
        for ev in ("<<Paste>>", "<<Cut>>", "<<Clear>>"):
            self.search.bind(ev, lambda e: self.root.after_idle(self._schedule_search), add="+")
        self.add_btn = ctk.CTkButton(top, text="＋  Додати", height=42, width=120, corner_radius=14,
                                     fg_color=ACCENT, hover_color=ACCENT_HOVER, font=self.f.bold,
                                     command=self.on_add)
        self.add_btn.grid(row=0, column=1, padx=(10, 0))
        self.gear = ctk.CTkButton(top, text="⚙", height=42, width=42, corner_radius=14, fg_color=BTN2,
                                  hover_color=BTN2_HOVER, text_color=TEXT, font=self.f.icon,
                                  command=self._popup_settings)
        self.gear.grid(row=0, column=2, padx=(8, 0))

        # три колонки
        cols = ctk.CTkFrame(root, fg_color="transparent")
        cols.grid(row=1, column=0, sticky="nsew", padx=14)
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
        root.bind("<Down>", lambda e: None if self._in_format_input(e) else self._move_sel(self._rec_cols if self.rec_tiles else 1))
        root.bind("<Up>", lambda e: None if self._in_format_input(e) else self._move_sel(-self._rec_cols if self.rec_tiles else -1))
        root.bind("<Right>", lambda e: self._arrow_h(e, 1))
        root.bind("<Left>", lambda e: self._arrow_h(e, -1))
        root.bind("<Return>", self._on_return)
        root.bind("<Escape>", self._on_escape)
        root.bind("<Delete>", self._on_delete_key)
        root.bind("<Control-n>", lambda e: self.on_add())
        root.bind("<Control-f>", lambda e: self._focus_search())

        self.v_paused = tk.BooleanVar(value=self.settings["paused"])
        self.v_topmost = tk.BooleanVar(value=self.settings["topmost"])
        self.v_autohide = tk.BooleanVar(value=self.settings["autohide"])
        self.v_fullscreen = tk.BooleanVar(value=self.settings["fullscreen"])
        self.v_clear_exit = tk.BooleanVar(value=self.settings["clear_on_exit"])
        self.v_hotkey = tk.StringVar(value=self.settings["hotkey"])
        self.v_theme = tk.StringVar(value=self.settings["theme"])

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
        self.cat_list = ctk.CTkScrollableFrame(left, fg_color="transparent", corner_radius=0,
                                               scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.cat_list.pack(fill="both", expand=True, padx=(2, 2), pady=(0, 8))
        self._speed_up_scroll(self.cat_list, CAT_SCROLL_FACTOR)

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
        self.title_lbl = self._label(head, "", PANEL, TEXT, self.pf.title, anchor="w")
        self.title_lbl.pack(side="left")
        self.count_lbl = self._label(head, "", PANEL, MUTED, self.pf.body, anchor="w")
        self.count_lbl.pack(side="left", padx=(8, 0), pady=(3, 0))
        self.mid_head = head
        self.rec_view_btn = ctk.CTkButton(head, text="☰ Список" if self.rec_tiles else "▦ Плитки", width=112,
                                          height=32, corner_radius=10, fg_color=BTN2, hover_color=BTN2_HOVER,
                                          text_color=TEXT, font=self.f.bold,
                                          command=lambda: self.set_rec_view("list" if self.rec_tiles else "tiles"))
        self.rec_view_btn.pack(side="right")
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
        self.cards = ctk.CTkScrollableFrame(mid, fg_color="transparent", corner_radius=0,
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
        box.pack(side="top", fill="x", expand=True, padx=(22, 12), pady=8)
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
        self.phrase_list.pack(fill="x")
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
        self._phrases_collapsed = not self._phrases_collapsed
        self.settings["phrases_collapsed"] = self._phrases_collapsed
        self._apply_phrases_collapse()

    def _apply_phrases_collapse(self) -> None:
        if self._phrases_collapsed:
            for w in (self.phrase_list, self.phrase_pair, self.phrase_add_btn):
                w.pack_forget()
            self.phrase_chev.configure(text="▸")
        else:
            self.phrase_list.pack(fill="x", after=self.phrase_head)
            self.phrase_pair.pack(fill="x", padx=(16, 12), pady=(6, 12), after=self.phrase_list)
            self.phrase_add_btn.pack(side="right")
            self.phrase_chev.configure(text="▾")
        self.root.after_idle(self._fit_format_box)

    def _render_phrases(self) -> None:
        """Малює рядки фраз за preset.phrases (лише коли список змінився); стан галочок збережених фраз лишається."""
        phrases = self.preset.phrases
        sig = tuple((p["id"], p["text"]) for p in phrases)
        if sig == self._phrase_sig:
            return
        self._phrase_sig = sig
        wanted = {p["id"] for p in phrases}
        for pid in [k for k in self._phrase_rows if k not in wanted]:
            self._phrase_rows.pop(pid)["frame"].destroy()
        wrap = int(max(120, self._right_w - 158) * self.scaling())
        for row in self._phrase_rows.values():
            row["frame"].pack_forget()
            row["label"].configure(wraplength=wrap)
        for p in phrases:
            row = self._phrase_rows.get(p["id"])
            if row is None:
                row = self._phrase_rows[p["id"]] = self._make_phrase_row(p, wrap)
            row["phrase"] = p
            row["label"].configure(text=p["text"])
            row["frame"].pack(fill="x", padx=(14, 6), pady=2)
        self._sync_refund_buttons()
        if not phrases:
            self.set_status("Фраз немає — додайте свою кнопкою «＋»", 4000)
        self.root.after_idle(self._fit_format_box)

    def _make_phrase_row(self, p: dict, wrap: int) -> dict:
        bgc = PAIR if p.get("part") else CARD            # пара «Active subscriptions / Internal charges» — жовтувата
        frame = tk.Frame(self.phrase_list, bg=self.col(bgc), cursor="fleur")
        self._themed.append((frame, bgc, None))
        var = tk.BooleanVar(value=False)
        cb = ctk.CTkCheckBox(frame, text="", variable=var, width=26, checkbox_width=24, checkbox_height=24,
                             corner_radius=7, border_width=2, fg_color=ACCENT, hover_color=ACCENT_HOVER,
                             bg_color=bgc, command=lambda pid=p["id"]: self._refund_toggle(pid))
        cb.pack(side="left", padx=(6, 8), pady=3)
        dele = self._icon_button(frame, "✕", lambda e, pid=p["id"]: self.on_remove_phrase(pid), hover_text=DANGER,
                                 bg_fn=lambda c=bgc: self.col(c))
        dele.pack(side="right", padx=(2, 4))
        edit = self._icon_button(frame, "✎", lambda e, pid=p["id"]: self.on_edit_phrase(pid),
                                 bg_fn=lambda c=bgc: self.col(c))
        edit.pack(side="right", padx=(2, 0))
        label = tk.Label(frame, text=p["text"], font=self.pf.phrase, anchor="w", justify="left", cursor="hand2",
                         bg=self.col(bgc), fg=self.col(TEXT), wraplength=wrap, pady=4)
        self._themed.append((label, bgc, TEXT))
        label.pack(side="left", fill="x", expand=True)
        # клік по тексту — поставити/зняти галочку; перетягування за текст чи фон рядка — сортування
        for w in (label, frame):
            w.bind("<ButtonPress-1>", lambda e, pid=p["id"]: self._phrase_press(pid, e))
            w.bind("<B1-Motion>", self._phrase_motion)
            w.bind("<ButtonRelease-1>", self._phrase_release)
        return {"frame": frame, "var": var, "cb": cb, "label": label, "dele": dele, "edit": edit, "phrase": p}

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
            self._refresh_banner(compose_phrases(self._refund_selected()))

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

    def submit_refund(self) -> None:
        out = compose_phrases(self._refund_selected())
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
        out = compose_phrases(self._refund_selected())
        if not out:
            return
        self._set_armed(True, "refund")
        self._refresh_banner(out)
        self.set_status("Append: клікніть запис — фраза буде дописана в його кінець (Esc — скасувати)", 9000)

    def _armed_result(self) -> str:
        """Що дописується в режимі Append: результат вибраного формату або обрана швидка фраза."""
        if self.armed_src == "refund":
            return compose_phrases(self._refund_selected())
        return self._format_result()

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
            return 6, int(max(90, tile_w - 48))
        pad = max(6, (usable - CARD_MAX) // 2)
        return pad, max(140, usable - 2 * pad - CARD_RESERVE)

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
        card = self._card_objs.get(getattr(e.widget, "_cm_iid", None))
        if card:
            card.hover_on()

    def _card_leave(self, e) -> None:
        iid = getattr(e.widget, "_cm_iid", None)
        if iid:
            self.root.after(15, self._hover_check, iid)     # Leave з дитини ≠ курсор вийшов із картки

    def _hover_check(self, iid: str) -> None:
        card = self._card_objs.get(iid)
        if not card:
            return
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
            obj.update(c["name"], c["color"], self.preset.count(c["id"]), c["id"] == self.view)
        if created or self._row_order != wanted:
            self._row_order = wanted
            self._cat_sig = None
        if wanted and self._cat_hint is not None:        # підказку (pack) прибираємо ДО розкладки плиток (grid)
            self._cat_hint.destroy()
            self._cat_hint = None
        self._arrange_cats()
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
        """(колонок, ширина плитки, висота плитки) для папок-плиток за поточною шириною лівої колонки."""
        cols = 3 if self._left_w >= CAT_TILE_MIN_LEFT else 2
        tile_w = (self._left_w - 30 - 8 * (cols - 1) - 14) / cols
        return cols, tile_w, int(max(84, min(132, tile_w * 0.86)))

    def _arrange_cats(self) -> None:
        """Розкладає рядки/плитки папок у лівій колонці (список — pack, плитки — grid по 2 або 3 в ряд)."""
        wanted = self._row_order
        if self.cat_tiles:
            cols, tile_w, th = self._tile_dims()
            sig = (True, cols, th, tuple(wanted), int(tile_w // 10))     # ширина плитки — кроками по 10 px (менше перемальовувань при тягненні границі)
        else:
            sig = (False, 1, 0, tuple(wanted), 0)
        if sig == self._cat_sig:
            return
        self._cat_sig = sig
        for key in wanted:
            obj = self._row_objs.get(key)
            if obj is not None and not obj.tile:
                obj.row.pack_forget()
        if self.cat_tiles:
            for c in range(3):
                self.cat_list.grid_columnconfigure(c, weight=1 if c < cols else 0, uniform="cattile" if c < cols else "")
            wrap = int(max(40, tile_w - 24) * self.scaling())
            for i, key in enumerate(wanted):
                obj = self._row_objs[key]
                obj.set_size(th, wrap)
                obj.row.grid(row=i // cols, column=i % cols, padx=3, pady=3, sticky="nsew")
                obj.row.grid_propagate(False)               # висота плитки фіксована
        else:
            for key in wanted:
                self._row_objs[key].row.pack(fill="x", padx=6, pady=2)

    def set_cat_view(self, mode: str) -> None:
        """Папки: список або плитки (по 2 чи 3 в ряд — залежно від ширини лівої колонки)."""
        tiles = mode == "tiles"
        if tiles == self.cat_tiles:
            return
        self.cat_tiles = tiles
        self.settings["cat_view"] = mode
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
            if not self.fmt_box.winfo_manager():
                self.fmt_box.pack(fill="x", after=self.formats_slot)
        elif self._fmt_built:
            self._fmt_box.pack_forget()

    def _show_actions(self, two: bool) -> None:
        """Одна кнопка (USER) або пара «Copy» / «Append» залежно від дій формату."""
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
        """На низькому вікні поле введення й перегляд результату стискаються (мін. 34 px), щоб кнопки не
        виходили за край правої колонки; на високому — повертаються до звичайного розміру."""
        try:
            if not self._fmt_built or not self._fmt_box.winfo_manager():
                return
            s = self.scaling()
            right_h = self.right.winfo_height() / s
            if right_h < 200:                       # колонку ще не розкладено
                return
            overhead = self._fmt_box.winfo_reqheight() / s - sum(self._fmt_heights)    # усе в блоці, крім двох полів
            room = (right_h - 52 - self.formats_slot.winfo_reqheight() / s - self.refund_box.winfo_reqheight() / s
                    - overhead - 22 - (28 if self.append_armed else 0))
            h_in = int(max(30, min(72, room / 2)))
            h_out = int(max(30, min(74, room - h_in)))
            if (h_in, h_out) != self._fmt_heights:
                self._fmt_heights = (h_in, h_out)
                self.fmt_input.configure(height=h_in)
                self.fmt_preview.configure(height=h_out)
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
        if event.state & 0x1:           # Shift+Enter — звичайний новий рядок
            return None
        self.submit_format()
        return "break"

    def _on_return(self, event) -> None:
        if self._in_format_input(event):
            return
        if self.sel_id:
            self.copy_item(self.sel_id)

    def _format_input(self, fmt: dict) -> str:
        """Що форматувати: введене в поле, а якщо поле порожнє — для Suspicious cards / Added cards — останні
        поспіль числові записи історії буфера (лише цифри, коми й пробіли; перший інший запис — стоп)."""
        raw = self.fmt_input.get("1.0", "end-1c")
        if not raw.strip() and fmt.get("type") in AUTO_HISTORY_FORMATS:
            return numbers_from_history(i["text"] for i in self.history.items)
        return raw

    def _format_result(self) -> str:
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if not fmt or not self._fmt_built:
            return ""
        return apply_format(fmt["type"], self._format_input(fmt))

    def _update_format_preview(self) -> None:
        out = self._format_result()
        self._set_preview(out)
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if fmt and self._fmt_built:
            auto = fmt.get("type") in AUTO_HISTORY_FORMATS and not self.fmt_input.get("1.0", "end-1c").strip()
            self.fmt_title.configure(text=fmt["name"] + ("   ·  значення з історії буфера" if auto and out else ""))
        if self.append_armed and self.armed_src != "refund":
            self._refresh_banner(out)

    def _set_preview(self, text: str) -> None:
        self.fmt_preview.configure(state="normal")
        self.fmt_preview.delete("1.0", "end")
        if text:
            self.fmt_preview.insert("1.0", text)
        self.fmt_preview.configure(state="disabled")

    def _clear_format_input(self) -> None:
        if not self._fmt_built:
            return
        if self.fmt_input.get("1.0", "end-1c"):
            self.fmt_input.delete("1.0", "end")
        self._set_preview("")

    def submit_format(self) -> None:
        """Copy: результат форматування → буфер обміну; поле вводу очищується; вікно ховається."""
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if not fmt:
            return
        out = self._format_result()
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
    def arm_append(self) -> None:
        """Кнопка «Append»: вмикає режим «заряджено» (повторне натискання — скасовує). Далі клік по запису
        копіює «текст запису + результат» (сам запис не змінюється) і ховає вікно."""
        if self.append_armed and self.armed_src == "format":
            self._set_armed(False)
            self.set_status("Режим Append скасовано")
            return
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if not fmt or "append" not in format_actions(fmt["type"]):
            return
        out = self._format_result()
        if not out:
            self.set_status("Введіть номери карток — поки немає що дописувати")
            return
        self._set_armed(True, "format")
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
            if on_fmt:
                self._fmt_append.configure(fg_color=ARMED, hover_color=ARMED, border_color=ARMED,
                                           text_color=("#ffffff", "#1b1b1b"))
                if not self._fmt_armed_hint.winfo_manager():
                    self._fmt_armed_hint.pack(fill="x", padx=16, pady=(0, 8))
            else:
                self._fmt_append.configure(fg_color=BTN2, hover_color=BTN2_HOVER, border_color=BTN2, text_color=TEXT)
                if self._fmt_armed_hint.winfo_manager():
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

    def _view_name(self) -> str:
        if self._is_history():
            return "Історія буфера"
        return (self.preset.category(self.view) or {"name": ""})["name"]

    def _query(self) -> str:
        return self.search.get() if self.search.winfo_exists() else ""

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

        self.title_lbl.configure(text=self._view_name())
        self.count_lbl.configure(text=str(len(self.shown)))
        self._layout_header()

        visible = self.shown[: self.limit]
        self._order = ids = [i["id"] for i in visible]
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
            self._regrid_cards()
        else:
            if [i for i in self._packed if i in self._card_objs] != have or len(self._packed) != len(have):
                for iid in self._packed:
                    if iid in self._card_objs:
                        self._card_objs[iid].frame.pack_forget()
                for iid in have:
                    self._card_objs[iid].frame.pack(fill="x", padx=self._card_pad, pady=4)
            self._packed = have
        if not self.shown:
            self._empty_state()
        if self.rec_tiles:
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

    def _regrid_cards(self) -> None:
        """Плитки: розставляє вже створені картки за номером у списку, виставляє висоту й рівні колонки."""
        cols = self._rec_cols
        for c in range(5):
            self.cards.grid_columnconfigure(c, weight=1 if c < cols else 0, uniform="rectile" if c < cols else "")
        for i, iid in enumerate(self._order):
            card = self._card_objs.get(iid)
            if card is None:
                continue
            card.set_tile_h(self._rec_tile_h)
            card.frame.grid(row=i // cols, column=i % cols, padx=6, pady=6, sticky="nsew")

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
            if self.rec_tiles:                     # плитки: клітинка сітки за номером у списку
                card.frame.grid(row=idx // self._rec_cols, column=idx % self._rec_cols, padx=6, pady=6, sticky="nsew")
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
        if len(self.shown) > self.limit and self._more_btn is None:
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
        for w in (self.clear_btn, self.merge_btn):
            if w.winfo_manager():
                w.pack_forget()
        label = f"Об'єднати і копіювати ({n})" if n else "Об'єднати і копіювати"
        for btn in (self.merge_btn, self.merge_btn2):
            btn.configure(text=label, state="normal" if can else "disabled",
                          fg_color=ACCENT if can else BTN2, text_color="#ffffff" if can else FAINT)
        if in_hist:
            empty = not self.history.items
            self.clear_btn.configure(state="disabled" if empty else "normal",
                                     border_color=FAINT if empty else DANGER)
            self.clear_btn.pack(side="right", padx=(0, 8))
            if wide:
                self.merge_btn.pack(side="right", padx=(0, 8))
        # рядок вибору під шапкою
        if in_hist:
            all_on = bool(self.shown) and all(i["id"] in self.checked for i in self.shown)
            self.sel_all_btn.configure(text="Зняти вибір" if all_on else "Вибрати все")
            self.sel_count.configure(text=f"Вибрано: {n}" if n else "")
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
            text = "Натисніть «＋ Додати» або перетягніть сюди запис з історії буфера."
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
        if lw != self._left_w:
            self._left_user = lw
            self._set_left_width(lw)

    def _splitter_release(self, e) -> None:
        if getattr(self, "_split", None):
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
                if need and not bar.winfo_manager():
                    bar.grid()
                elif not need and bar.winfo_manager():
                    bar.grid_remove()
            except (tk.TclError, AttributeError):
                pass

    # -- вибір і клавіатура -------------------------------------------------
    def _highlight_selection(self) -> None:
        for iid, card in self._card_objs.items():
            card.set_selected(iid == self.sel_id)      # змінюється рамка лише в тих, у кого змінився стан

    def _arrow_h(self, e, delta: int):
        """← / → у режимі плиток рухають виділення по ряду (у полях введення — звичайний рух курсора)."""
        if not self.rec_tiles or isinstance(e.widget, (tk.Entry, tk.Text)):
            return None
        return self._move_sel(delta)

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

    def _focus_search(self) -> None:
        self.search.focus_set()
        try:
            self.search.select_range(0, "end")
        except tk.TclError:
            pass

    def set_search(self, text: str) -> None:
        """Програмно задає пошуковий запит (також для тестів)."""
        self.search.delete(0, "end")
        if text:
            self.search.insert(0, text)
        self._on_search()

    def _schedule_search(self) -> None:
        """Пошук реагує після короткої паузи в наборі: швидкий набір не перебудовує список на кожну літеру."""
        if self._search_job is not None:
            self.root.after_cancel(self._search_job)
        self._search_job = self.root.after(SEARCH_DEBOUNCE_MS, self._on_search)

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
        elif self.checked:
            self.clear_checked()
        else:
            self._hide_or_iconify("escape")

    def _on_delete_key(self, event: tk.Event):
        if isinstance(event.widget, (tk.Entry, tk.Text)) or not self.sel_id:
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
        card = self._card_objs.get(iid)
        try:
            if card is not None and card.inert(e.x_root, e.y_root):
                self._drag = None               # права зона картки: клік нічого не робить
                return
        except tk.TclError:
            pass
        self._drag = {"id": iid, "x": e.x_root, "y": e.y_root, "active": False, "ghost": None, "hover": None,
                      "reorder": None, "ctrl": bool(getattr(e, "state", 0) & 0x4), "tile": None}
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
        if target is None and not self._is_history():
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
            ctrl = d.get("ctrl") or bool(getattr(e, "state", 0) & 0x4)
            if card is not None and not (card.v2 and not ctrl and not self.append_armed):
                card.flash()                    # видно, що скопійовано (для v.2 без Ctrl відкривається вікно аппендів)
            self.copy_item(d["id"], hide=True if ctrl else None)      # Ctrl + клік: скопіювати й згорнути вікно
            return
        d["ghost"].destroy()
        self._hide_indicators()
        self._mark_target(d["hover"], False)
        card = self._card_objs.get(d.get("tile")) if d.get("tile") else None
        if card is not None:
            card.set_drop(False)
        target = self._target_at(e.x_root, e.y_root)
        if target is not None:
            self.put_in_category(d["id"], target)
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
            obj.paint(DROP if on else (obj.sel_fill if key == self.view else obj.fill))

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
        """hide=True — після копіювання одразу сховати вікно (Ctrl + клік); None — за налаштуванням «автохов»."""
        text = self._text_of(item_id)
        if text is None:
            return
        if self.append_armed:                  # режим Append: клік по запису = «текст запису + результат форматування»
            self._append_to(text, True if hide else None)
            return
        item = next((i for i in self.shown if i["id"] == item_id), None)
        if item and item.get("v2") and not self._is_history() and not hide:
            self._open_v2(item)                # копіпаста v.2: клік відкриває вікно вибору аппендів (Ctrl+клік — лише основний текст)
            return
        if item and card_user_link(item):      # «… in ____» → «… in {LINK:USER:<останній з історії>:E}»
            uid = self._last_user()
            if uid:
                text = apply_user_link(text, uid)
            else:
                self.set_status("У історії буфера немає користувача — скопійовано без {LINK:USER:…:E}", 6000)
        self.copy_to_clipboard(text)

        def after() -> None:      # піднімаємо запис в історії вже ПІСЛЯ ховання вікна
            if self._is_history():
                self.history.bump(item_id)
                self.render(scroll_top=True)

        self._finish_pick("✓ Скопійовано: " + clip(preview(text, 1, 60).replace("\n", " "), 50), after, hide=hide)

    def _open_v2(self, item: dict) -> None:
        """Вікно вибору аппендів для копіпасти v.2. Результат копіюється; вікно програми ховається лише при Ctrl + клік."""
        res = V2Dialog(self, item["text"], item["v2"], uid=self._last_user(), link_on=card_user_link(item),
                       on_edit=lambda: self._edit_appends_inline(item["id"])).run()
        if not res or not res["text"].strip():
            return
        self.copy_to_clipboard(res["text"])
        self._finish_pick("✓ Скопійовано: " + clip(res["text"].replace("\n", " "), 60), hide=bool(res["hide"]))

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
        if not self.preset.categories and not self.on_new_category(select=False):
            return
        cat = self.view if self.preset.category(self.view) else (
            self._last_cat if self.preset.category(self._last_cat) else self.preset.categories[0]["id"])
        result = SnippetDialog(self, "Новий запис", "", cat).run()
        if not result:
            return
        text, cat_id, *rest = result
        snip = self.preset.add_snippet(cat_id, text, rest[0] if rest else None)
        if snip:
            self.view, self._last_cat, self.sel_id = cat_id, cat_id, snip["id"]
            if self._query():
                self.set_search("")
            self.limit = PAGE
            self.render(scroll_top=True)
            self.set_status("✓ Додано")

    def on_edit(self, item_id: str) -> None:
        found = self.preset.find_snippet(item_id)
        if not found:
            return
        result = SnippetDialog(self, "Редагування", found[1]["text"], found[0]["id"], found[1].get("v2")).run()
        if result and self.preset.update_snippet(item_id, result[0], result[1], result[2] if len(result) > 2 else "keep"):
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
        if key != self.view:
            self._collapse_format()            # формати при переході між папками згорнуті, Append скасовано
            self.clear_checked()
        self.view = key
        if key != HISTORY:
            self._last_cat = key
        self.sel_id = None
        self.limit = PAGE
        self.render(scroll_top=True)

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
            item = next((i for i in self.shown if i["id"] == item_id), {})
            on = card_user_link(item)
            m.add_command(("✓ " if on else "") + "Додавати користувача з історії (in {LINK:USER:…:E})",
                          lambda: self.on_toggle_user_link(item_id, not on), icon="@")
            m.add_command("Колір запису…", lambda: self.on_snippet_color(item_id), icon="●")
        sub = self._new_menu()
        cur = None if hist else (self.preset.find_snippet(item_id) or ({"id": None},))[0]["id"]
        for c in self.preset.categories:
            sub.add_command(c["name"], lambda cid=c["id"]: self.put_in_category(item_id, cid),
                            dot=c["color"], checked=cur == c["id"])
        if self.preset.categories:
            sub.add_separator()
        sub.add_command("＋ Нова категорія…", lambda: self.on_new_category(for_item=item_id))
        m.add_cascade("Зберегти в категорію" if hist else "Перемістити в категорію", sub, icon="➜")
        if not hist:
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
        m.add_check("Очищати історію при виході з програми", self.v_clear_exit, self._on_clear_exit)
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
        self.search.focus_set()
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
        needs = bool(self._query()) or self.limit != PAGE
        if self._query():
            self.search.delete(0, "end")
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
        self.hide_window() if self._has_ui_way_back() else self.quit()

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
    except Exception:
        pass


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
    args = parser.parse_args(argv)
    if args.timing:
        _TIMING = True
    _mark("args_parsed")

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
