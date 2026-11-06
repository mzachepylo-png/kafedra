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

import os
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
import tkinter as tk
import tkinter.font as tkfont
from functools import lru_cache
from types import SimpleNamespace

import customtkinter as ctk

from formats import FORMATTERS, apply_format
from store import (HISTORY, PALETTE, PRESET_SUFFIX, History, Preset, PresetError, Settings,
                   default_data_dir, history_path, open_startup_preset)
from winsys import (HOTKEY_PRESETS, HotkeyListener, acquire_single_instance, clipboard_sequence, hotkey_label,
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
CARD_EST_H = 84                # орієнтовна висота картки (для передбачення смуги прокрутки до розкладки)
SEARCH_DEBOUNCE_MS = 60        # пошук реагує на набір після короткої паузи, а не на кожну літеру
TOGGLE_DEBOUNCE = 0.15         # с: подвійне натискання гарячої клавіші не «дзеленчить» вікном
FONT = "Segoe UI"
MONO = "Consolas"
PAGE = 60                      # скільки карток малювати за раз (віджети ctk важкі)
LEFT_W, RIGHT_W = 280, 344     # мінімальна ширина бічних колонок (у «логічних» пікселях ctk)
LEFT_MAX, RIGHT_MAX = 380, 480  # верхня межа: на великому екрані колонки ростуть, але не безмежно
LEFT_FRAC, RIGHT_FRAC = 0.17, 0.22   # частка ширини вікна
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

THEMES = [("system", "Як у системі"), ("light", "Світла"), ("dark", "Темна")]

# Кольори для вибору: палітра пресета + кілька додаткових (4 × 3 = 12 плашок)
SWATCHES = PALETTE + ["#e81123", "#ffb900", "#00b294", "#69797e"]

FORMAT_INFO = {   # опис відомих типів форматів
    "link_user": ("ID користувачів → {LINK:USER:ID:E}",
                  "Вставте ID: 123, User#456 789 …"),
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
    """(фон, фон при наведенні, фон вибраного, рамка) для рядка категорії/формату в бічній колонці."""
    if not color:
        return ("transparent", ROW_HOVER, ROW_SEL, PANEL_BORDER)
    t = lambda a, b: (blend(color, PANEL[0], a), blend(color, PANEL[1], b))  # noqa: E731
    return t(0.08, 0.13), t(0.16, 0.24), t(0.24, 0.36), (blend(color, PANEL_BORDER[0], 0.35),
                                                         blend(color, PANEL_BORDER[1], 0.50))


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


class TextDialog(_Dialog):
    def __init__(self, app: "App", title: str, prompt: str, initial: str = ""):
        super().__init__(app, title, 380, 170)
        ctk.CTkLabel(self, text=prompt, anchor="w", text_color=TEXT, font=app.f.body).pack(
            fill="x", padx=20, pady=(18, 6))
        self.var = tk.StringVar(value=initial)
        self.entry = ctk.CTkEntry(self, textvariable=self.var, height=38, corner_radius=10,
                                  fg_color=INPUT, border_color=PANEL_BORDER, font=app.f.body)
        self.entry.pack(fill="x", padx=20)
        self.entry.bind("<Return>", lambda e: self.ok())
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x", padx=20, pady=16)
        ctk.CTkButton(row, text="Гаразд", width=96, height=34, corner_radius=10, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, command=self.ok, font=app.f.body).pack(side="right")
        ctk.CTkButton(row, text="Скасувати", width=96, height=34, corner_radius=10, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, command=self.cancel,
                      font=app.f.body).pack(side="right", padx=8)
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
    def __init__(self, app: "App", title: str, text: str = "", category: str | None = None):
        super().__init__(app, title, 520, 400)
        self.names = {c["name"]: c["id"] for c in app.preset.categories}
        ctk.CTkLabel(self, text="Текст", anchor="w", text_color=MUTED, font=app.f.small).pack(
            fill="x", padx=20, pady=(16, 4))
        self.text = ctk.CTkTextbox(self, height=220, wrap="word", corner_radius=10, border_width=1,
                                   border_color=PANEL_BORDER, fg_color=INPUT, text_color=TEXT,
                                   font=app.f.body, undo=True)
        self.text.pack(fill="both", expand=True, padx=20)
        self.text.insert("1.0", text)
        self.text.bind("<Control-Return>", lambda e: (self.ok(), "break")[1])
        self.text.bind("<Control-a>", lambda e: (self.text.tag_add("sel", "1.0", "end-1c"), "break")[1])
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x", padx=20, pady=16)
        ctk.CTkLabel(row, text="Категорія:", text_color=TEXT, font=app.f.body).pack(side="left")
        cat = app.preset.category(category)
        self.cat_var = tk.StringVar(value=cat["name"] if cat else (next(iter(self.names), "")))
        ctk.CTkOptionMenu(row, variable=self.cat_var, values=list(self.names) or [""], width=170, height=34,
                          corner_radius=10, fg_color=BTN2, button_color=BTN2_HOVER, button_hover_color=BTN2_HOVER,
                          text_color=TEXT, dropdown_font=app.f.body, font=app.f.body).pack(side="left", padx=10)
        ctk.CTkButton(row, text="Зберегти", width=100, height=34, corner_radius=10, fg_color=ACCENT,
                      hover_color=ACCENT_HOVER, command=self.ok, font=app.f.body).pack(side="right")
        ctk.CTkButton(row, text="Скасувати", width=100, height=34, corner_radius=10, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, command=self.cancel,
                      font=app.f.body).pack(side="right", padx=8)
        self.after(120, self._focus)

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
        self.result = (text, cat_id)
        self.destroy()


class ColorDialog(_Dialog):
    """Вибір кольору: сітка плашок + «Інший колір…» (+ «Як у папки» для запису).
    Результат: None (скасовано) | ("set", "#rrggbb") | ("reset", None)."""

    COLUMNS = 6

    def __init__(self, app: "App", title: str, current: str | None, allow_reset: bool = False,
                 reset_label: str = "Як у папки"):
        rows = (len(SWATCHES) + self.COLUMNS - 1) // self.COLUMNS
        super().__init__(app, title, 372, 150 + rows * 48)
        self.current = (current or "").lower()
        ctk.CTkLabel(self, text="Оберіть колір", anchor="w", text_color=MUTED, font=app.f.small).pack(
            fill="x", padx=22, pady=(16, 6))
        grid = ctk.CTkFrame(self, fg_color="transparent")
        grid.pack(padx=20)
        self.swatches: dict[str, ctk.CTkButton] = {}
        for n, color in enumerate(SWATCHES):
            mark = "✓" if color.lower() == self.current else ""
            b = ctk.CTkButton(grid, text=mark, width=40, height=40, corner_radius=20, fg_color=color,
                              hover_color=blend(color, "#000000", 0.18), text_color="#ffffff", font=app.f.icon,
                              command=lambda c=color: self.choose(c))
            b.grid(row=n // self.COLUMNS, column=n % self.COLUMNS, padx=4, pady=4)
            self.swatches[color] = b
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x", padx=22, pady=(10, 14))
        ctk.CTkButton(row, text="Інший колір…", width=108, height=34, corner_radius=10, fg_color=BTN2,
                      hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.body,
                      command=self.custom).pack(side="left")
        if allow_reset:
            ctk.CTkButton(row, text=reset_label, width=96, height=34, corner_radius=10, fg_color=BTN2,
                          hover_color=BTN2_HOVER, text_color=TEXT, font=app.f.body,
                          command=self.reset).pack(side="left", padx=(8, 0))
        ctk.CTkButton(row, text="Скасувати", width=88, height=34, corner_radius=10, fg_color="transparent",
                      hover_color=BTN2, text_color=MUTED, font=app.f.body,
                      command=self.cancel).pack(side="right")

    def choose(self, color: str) -> None:
        self.result = ("set", color.lower())
        self.destroy()

    def reset(self) -> None:
        self.result = ("reset", None)
        self.destroy()

    def custom(self) -> None:
        try:
            _, hex_color = colorchooser.askcolor(color=self.current or None, parent=self, title="Свій колір")
        except tk.TclError:
            return
        if hex_color:
            self.choose(hex_color)


# --------------------------------------------------------------------------- #
#  Швидкі «рядки»: ОДИН ctk-фрейм (заокруглення, рамка) + прості tk-віджети всередині
# --------------------------------------------------------------------------- #
# Композит із ctk-міток/фреймів коштував ~14 мс на картку (кожен CTk-віджет — окреме полотно, яке
# перемальовується при створенні й при кожній зміні розміру). Простий tk.Label створюється за ~0,1 мс.
# Вигляд той самий: заокруглену підкладку малює один CTkFrame, решту — звичайні tk-віджети.

def _eff(fill) -> object:
    """Фон, який реально видно під прозорим рядком."""
    return PANEL if fill == "transparent" else fill


class Card:
    """Картка запису. Живе між перебудовами списку: змінений текст/колір оновлюється на місці."""

    def __init__(self, app: "App", parent, it: dict, pad: int, wrap_px: int, selected: bool = False):
        self.app, self.iid = app, it["id"]
        self.text, self.ts, self.color = it["text"], it["ts"], it.get("color")
        self.fill, self.hover, self.border = card_colors(self.color)
        self.cur = self.fill
        self.hovering = False
        self.selected = selected
        pf, col = app.pf, app.col
        bg = col(self.fill)
        # усі кольори й тексти — одразу в конструкторах: кожен зайвий configure() ctk-фрейма = ще одне перемальовування
        self.frame = f = ctk.CTkFrame(parent, corner_radius=12, fg_color=self.fill, cursor="hand2",
                                      border_width=2 if selected else 1,
                                      border_color=ACCENT if selected else self.border)
        f.grid_columnconfigure(1, weight=1)
        self.bar = tk.Frame(f, width=6, height=8, cursor="hand2", bg=col(self.color or NEUTRAL))
        self.bar.grid(row=0, column=0, rowspan=2, sticky="ns", padx=(9, 0), pady=10)
        self.body = tk.Label(f, anchor="w", justify="left", font=pf.card, wraplength=wrap_px, cursor="hand2",
                             text=preview(self.text), bg=bg, fg=col(TEXT))
        self.body.grid(row=0, column=1, sticky="we", padx=(12, 4), pady=(11, 0))
        self.meta = tk.Label(f, anchor="w", font=pf.meta, cursor="hand2", bg=bg, fg=col(META),
                             text=f"{time.strftime('%d.%m %H:%M', time.localtime(self.ts))}  ·  {len(self.text)} симв.")
        self.meta.grid(row=1, column=1, sticky="we", padx=(12, 4), pady=(2, 10))
        self.more = app._icon_button(f, "⋯", lambda e: app.show_menu(e.x_root, e.y_root, self.iid), bg_fn=self.bg_now)
        self.dele = app._icon_button(f, "✕", lambda e: app.on_delete(self.iid), hover_text=DANGER, bg_fn=self.bg_now)
        self.more.grid(row=0, column=2, padx=(0, 2), pady=(8, 0))
        self.dele.grid(row=0, column=3, padx=(0, 8), pady=(8, 0))
        self.plain = (self.body, self.meta, self.more, self.dele)
        # одна пара «bindtag» на всі картки замість ~25 прив'язок на кожну (див. App._init_tags)
        for w in (f._canvas, self.bar, self.body, self.meta):
            w._cm_iid = self.iid
            w.bindtags(("CMCardClick", "CMCardHover") + w.bindtags())
        for w in (self.more, self.dele):
            w._cm_iid = self.iid
            w.bindtags(("CMCardHover",) + w.bindtags())
            w.bind("<Button-3>", lambda e: app.show_menu(e.x_root, e.y_root, self.iid), add="+")

    def bg_now(self) -> str:
        return self.app.col(self.cur)

    def sync(self, it: dict) -> None:
        """Оновлює картку на місці, якщо змінились текст, час або колір (інакше нічого не робить)."""
        text, ts, color = it["text"], it["ts"], it.get("color")
        if text != self.text or ts != self.ts:
            self.text, self.ts = text, ts
            self.body.configure(text=preview(text))
            self.meta.configure(text=f"{time.strftime('%d.%m %H:%M', time.localtime(ts))}  ·  {len(text)} симв.")
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
        self.meta.configure(bg=bg, fg=a.col(META))
        for w in (self.more, self.dele):
            w.configure(bg=bg, fg=a.col(MUTED))

    def paint(self, fill) -> None:
        self.cur = fill
        self.frame.configure(fg_color=fill)
        bg = self.app.col(fill)
        for w in self.plain:
            w.configure(bg=bg)

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
        self.frame.destroy()


class SideRow:
    """Рядок категорії (або «Історія буфера») в лівій колонці: смужка, кружечок-кнопка кольору, назва,
    лічильник, «⋯». Створюється один раз, далі оновлюється на місці."""

    def __init__(self, app: "App", parent, key: str, real: bool):
        self.app, self.key, self.real = app, key, real
        self.sig = None
        self.selected = False
        self.hovering = False
        self.fill = self.hover = self.sel_fill = self.border = None
        self.color = None
        self.cur = "transparent"
        pf = app.pf
        self.row = ctk.CTkFrame(parent, corner_radius=10, fg_color="transparent", border_width=0,
                                border_color=PANEL_BORDER, cursor="hand2")
        self.row.grid_columnconfigure(2, weight=1)
        self.bar = tk.Frame(self.row, width=5, height=8, cursor="hand2")
        self.bar.grid(row=0, column=0, sticky="ns", padx=(7, 0), pady=8)
        if real:
            self.dot = app._swatch(self.row, "#888888", lambda k=key: app.on_category_color(k))
        else:
            self.dot = tk.Label(self.row, text="●", font=pf.body, width=2, cursor="hand2")
        self.dot.grid(row=0, column=1, padx=(9, 8), pady=9)
        self.label = tk.Label(self.row, anchor="w", cursor="hand2")
        self.label.grid(row=0, column=2, sticky="we", pady=7)
        self.num = tk.Label(self.row, font=pf.small, cursor="hand2")
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
        app._bind_all(parts, "<Button-1>", lambda e: app.select_category(key))
        if not real:
            app._bind_all([self.dot], "<Button-1>", lambda e: app.select_category(key))
        else:
            app._bind_all(parts + [self.dot, self.more], "<Button-3>",
                          lambda e: app.show_category_menu(e.x_root, e.y_root, key))
        app._hoverable(self.row, parts + [self.dot] + ([self.more] if self.more else []), self._enter, self._leave)

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
        pf = a.pf
        if old is None or old[1] != color:
            self.color = color
            self.fill, self.hover, self.sel_fill, self.border = row_colors(color if self.real else None)
            a._row_fills[self.key] = (self.fill, self.sel_fill)
            if self.real:
                self.dot.configure(fg_color=color)
        if old is None or old[0] != name or old[4] != a._name_chars or old[3] != selected:
            self.label.configure(text=clip(name, a._name_chars), font=pf.bold if selected else pf.body)
        if old is None or old[2] != count or old[3] != selected:
            self.num.configure(text=str(count))
        self.selected = selected
        self.hovering = False if selected else self.hovering
        if self.real:
            self.row.configure(border_width=2 if selected else 1, border_color=color if selected else self.border)
        self.paint(self.sel_fill if selected else (self.hover if self.hovering else self.fill))
        self.colorize()

    def colorize(self) -> None:
        a = self.app
        bg = a.col(_eff(self.cur))
        self.bar.configure(bg=a.col(self.color if self.real else NEUTRAL))
        self.label.configure(fg=a.col(TEXT))
        self.num.configure(fg=a.col(META if self.selected else MUTED))
        if not self.real:
            self.dot.configure(fg=a.col(self.color))
        for w in self.plain:
            w.configure(bg=bg)
        if self.more is not None:
            self.more.configure(fg=a.col(MUTED))

    def destroy(self) -> None:
        self.row.destroy()


class FormatRow:
    """Рядок формату в правій колонці (смужка, кружечок кольору, назва, опис, «⋯»)."""

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
            app._bind_all(parts, "<Button-1>", lambda e: app.select_format(fid))
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
        self.sub.configure(text=clip(info[0], 40))
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
        self.card = mk(15, "bold")        # текст самого копіпасту
        self.meta = mk(12)                # дата і довжина під записом
        self.mono = ctk.CTkFont(family=MONO, size=12)


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
                 start_hidden: bool = False):
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
        self.menu: tk.Menu | None = None
        self.tray = None
        self.hotkey_ok = False
        self._use_hotkey, self._use_tray = use_hotkey, use_tray
        self._dark = ctk.get_appearance_mode() == "Dark"
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

                threading.Thread(target=make_tray, daemon=True).start()
        if os.name != "nt":
            self.apply_icon_to(self.root)
        if not self._hidden:
            self._announce_hotkey()
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
        mk = lambda size, weight="normal": tkfont.Font(  # noqa: E731
            root=self.root, family=FONT, size=-max(1, round(size * s)), weight=weight)
        self.pf = SimpleNamespace(body=mk(13), small=mk(11), tiny=mk(10), bold=mk(13, "bold"), caps=mk(10, "bold"),
                                  icon=mk(15, "bold"), card=mk(15, "bold"), meta=mk(12), title=mk(17, "bold"))

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

    def _new_menu(self, parent=None) -> tk.Menu:
        dark = ctk.get_appearance_mode() == "Dark"
        return tk.Menu(parent or self.root, tearoff=0, bd=0, relief="flat", font=(FONT, 10),
                       bg="#2b2d33" if dark else "#ffffff", fg="#ececee" if dark else "#1c1e22",
                       activebackground=ACCENT, activeforeground="#ffffff")

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
        cols.grid_columnconfigure(1, weight=1)
        cols.grid_columnconfigure(2, weight=0)
        self._build_left(cols)
        self._build_middle(cols)
        self._build_right(cols)

        # статус
        self.status = self._label(root, "", BG, MUTED, self.pf.small, anchor="w")
        self.status.grid(row=2, column=0, sticky="ew", padx=20, pady=(6, 8))

        # клавіатура
        root.bind("<Down>", lambda e: None if self._in_format_input(e) else self._move_sel(1))
        root.bind("<Up>", lambda e: None if self._in_format_input(e) else self._move_sel(-1))
        root.bind("<Return>", self._on_return)
        root.bind("<Escape>", self._on_escape)
        root.bind("<Delete>", self._on_delete_key)
        root.bind("<Control-n>", lambda e: self.on_add())
        root.bind("<Control-f>", lambda e: self._focus_search())

        self.v_paused = tk.BooleanVar(value=self.settings["paused"])
        self.v_topmost = tk.BooleanVar(value=self.settings["topmost"])
        self.v_autohide = tk.BooleanVar(value=self.settings["autohide"])
        self.v_fullscreen = tk.BooleanVar(value=self.settings["fullscreen"])
        self.v_hotkey = tk.StringVar(value=self.settings["hotkey"])
        self.v_theme = tk.StringVar(value=self.settings["theme"])

    def _build_left(self, cols) -> None:
        left = self._panel(cols, width=self._left_w)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 7))
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
        self.preset_cap.pack(fill="x")
        self.preset_name = self._label(chip_text, "", ACCENT_SOFT, TEXT, pf.bold, anchor="w")
        self.preset_name.pack(fill="x")
        self.preset_file = self._label(chip_text, "", ACCENT_SOFT, MUTED, pf.tiny, anchor="w")
        self.preset_file.pack(fill="x")
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

        self.history_slot = ctk.CTkFrame(left, fg_color="transparent")
        self.history_slot.pack(fill="x", padx=2)
        ctk.CTkFrame(left, height=1, fg_color=PANEL_BORDER).pack(fill="x", padx=14, pady=(4, 4))
        self.cat_list = ctk.CTkScrollableFrame(left, fg_color="transparent", corner_radius=0,
                                               scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.cat_list.pack(fill="both", expand=True, padx=(2, 2), pady=(0, 8))

    def _build_middle(self, cols) -> None:
        mid = self._panel(cols)
        mid.grid(row=0, column=1, sticky="nsew", padx=7)
        self.mid = mid
        head = ctk.CTkFrame(mid, fg_color="transparent")
        head.pack(fill="x", padx=18, pady=(14, 4))
        self.title_lbl = self._label(head, "", PANEL, TEXT, self.pf.title, anchor="w")
        self.title_lbl.pack(side="left")
        self.count_lbl = self._label(head, "", PANEL, MUTED, self.pf.body, anchor="w")
        self.count_lbl.pack(side="left", padx=(8, 0), pady=(3, 0))
        self.clear_btn = ctk.CTkButton(head, text="Очистити історію", width=150, height=32, corner_radius=10,
                                       fg_color="transparent", hover_color=DANGER_SOFT, text_color=DANGER,
                                       border_width=2, border_color=DANGER, font=self.f.bold,
                                       command=self.on_clear)
        self.cards = ctk.CTkScrollableFrame(mid, fg_color="transparent", corner_radius=0,
                                            scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.cards.pack(fill="both", expand=True, padx=(8, 4), pady=(0, 10))
        mid.bind("<Configure>", self._on_mid_resize, add="+")

    def _build_right(self, cols) -> None:
        right = self._panel(cols, width=self._right_w)
        right.grid(row=0, column=2, sticky="nsew", padx=(7, 0))
        right.pack_propagate(False)
        self.right = right
        head = ctk.CTkFrame(right, fg_color="transparent")
        head.pack(fill="x", padx=14, pady=(16, 4))
        self._label(head, "ФОРМАТУВАННЯ", PANEL, MUTED, self.pf.caps, anchor="w").pack(side="left")
        self.new_fmt_btn = ctk.CTkButton(head, text="＋ Новий", width=96, height=32, corner_radius=10,
                                         fg_color=ACCENT, hover_color=ACCENT_HOVER, text_color="#ffffff",
                                         font=self.f.bold,
                                         command=lambda: self.set_status("Власні формати з'являться пізніше"))
        self.new_fmt_btn.pack(side="right")

        # внизу — приписка (пакується першою зі side=bottom, щоб ніколи не виштовхувалась)
        self.formats_note = self._label(right, "Інші формати — скоро", PANEL, FAINT, self.pf.small, anchor="w")
        self.formats_note.pack(side="bottom", fill="x", padx=16, pady=(0, 12))

        self.formats_slot = ctk.CTkFrame(right, fg_color="transparent")
        self.formats_slot.pack(fill="x", padx=2)
        self.fmt_idle = self._label(right, "Оберіть формат, щоб ввести значення.", PANEL, MUTED, self.pf.small,
                                    anchor="w")
        # область введення вибраного формату (два CTkTextbox — найважчі віджети вікна) будується ЛІНИВО,
        # при першому виборі формату: див. _ensure_fmt і властивості fmt_box, fmt_input, …

    def _ensure_fmt(self) -> None:
        """Будує область введення форматування (заголовок, підказка, поле, перегляд, кнопка)."""
        if self._fmt_built:
            return
        self._fmt_built = True
        right, pf = self.right, self.pf
        self._fmt_box = box = ctk.CTkFrame(right, fg_color=PANEL, corner_radius=0)
        self._fmt_title = self._label(box, "", PANEL, TEXT, pf.bold, anchor="w")
        self._fmt_title.pack(fill="x", padx=16, pady=(10, 0))
        self._fmt_hint = self._label(box, "", PANEL, MUTED, pf.small, anchor="w", justify="left",
                                     wraplength=int((self._right_w - 40) * self.scaling()))
        self._fmt_hint.pack(fill="x", padx=16, pady=(2, 6))
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
        self._fmt_btn = ctk.CTkButton(box, text="Копіювати і сховати", height=38, corner_radius=12,
                                      fg_color=ACCENT, hover_color=ACCENT_HOVER, font=self.f.bold,
                                      command=self.submit_format)
        self._fmt_btn.pack(fill="x", padx=14, pady=(10, 4))
        # Enter — виконати, Shift+Enter — новий рядок, Ctrl+A — виділити все
        inner = self._fmt_input._textbox
        inner.bind("<Return>", self._on_format_return)
        inner.bind("<KP_Enter>", self._on_format_return)
        inner.bind("<KeyRelease>", lambda e: self._update_format_preview(), add="+")
        inner.bind("<<Paste>>", lambda e: self.root.after_idle(self._update_format_preview), add="+")
        inner.bind("<Control-a>", lambda e: (inner.tag_add("sel", "1.0", "end-1c"), "break")[1])
        self._sync_submit_label()

    fmt_box = _lazy_fmt("fmt_box")
    fmt_title = _lazy_fmt("fmt_title")
    fmt_hint = _lazy_fmt("fmt_hint")
    fmt_input = _lazy_fmt("fmt_input")
    fmt_preview = _lazy_fmt("fmt_preview")
    fmt_btn = _lazy_fmt("fmt_btn")

    def _plan_layout(self, width_px: int) -> None:
        """Остаточні ширини колонок, назв і переносу тексту ОБЧИСЛЮЄМО за шириною вікна ще до побудови
        віджетів — тоді вони одразу створюються правильного розміру й нічого не «стрибає» після показу."""
        w = width_px / self.scaling()
        self._left_w = int(min(LEFT_MAX, max(LEFT_W, w * LEFT_FRAC)))
        self._right_w = int(min(RIGHT_MAX, max(RIGHT_W, w * RIGHT_FRAC)))
        self._name_chars = max(14, int((self._left_w - 130) / 7.6))
        self._mid_w = int(w - 28 - self._left_w - self._right_w - 28)    # відступи рамки, колонок і панелей
        self._usable0 = self._mid_w - 16                                 # мінус поля й рамка прокручуваної області
        self._sb_cur = 0                                                 # скільки з цього забирає смуга прокрутки
        self._card_pad, self._wrap = self._wrap_for(self._usable0)

    @staticmethod
    def _wrap_for(usable: int) -> tuple[int, int]:
        """(бокові поля карток, ширина переносу тексту) для доступної ширини списку."""
        usable = max(240, usable)
        pad = max(6, (usable - CARD_MAX) // 2)
        return pad, max(160, usable - 2 * pad - 150)

    def _set_scroll_space(self, need: bool, sb_w: int) -> None:
        """Смуга прокрутки забирає частину ширини списку: враховуємо це ДО створення карток (а не після)."""
        sb = sb_w if need else 0
        if sb != self._sb_cur:
            self._sb_cur = sb
            self._apply_wrap_values(*self._wrap_for(self._usable0 - sb))

    def _apply_wrap_values(self, pad: int, wrap: int) -> None:
        if pad != self._card_pad:
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
        self._render_sidebar_now()
        self._render_list_now(scroll_top)
        self._render_formats()

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
                obj = self._row_objs[c["id"]] = SideRow(self, self.cat_list, c["id"], real=True)
                self._rows[c["id"]] = obj.row
                self._swatches[c["id"]] = obj.dot
                self._row_keys[obj.row] = c["id"]
                created = True
            obj.update(c["name"], c["color"], self.preset.count(c["id"]), c["id"] == self.view)
        if created or self._row_order != wanted:
            for key in self._row_order:
                if key in self._row_objs:
                    self._row_objs[key].row.pack_forget()
            for key in wanted:
                self._row_objs[key].row.pack(fill="x", padx=6, pady=2)
            self._row_order = wanted
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
        self._predict_scrollbar(self.cat_list, len(wanted) * 44 + 12)

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
    def _render_formats(self) -> None:
        if self.sel_format and not self.preset.format(self.sel_format):
            self.sel_format = None
        wanted = [f["id"] for f in self.preset.formats]
        for fid in [k for k in self._fmt_rows if k not in wanted]:
            self._fmt_rows.pop(fid).destroy()
            self._swatches.pop("fmt:" + fid, None)
        created = False
        for fmt in self.preset.formats:
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
            info = FORMAT_INFO.get(fmt["type"], ("", ""))
            self.fmt_title.configure(text=fmt["name"])
            self.fmt_hint.configure(text=info[1])
            self.fmt_idle.pack_forget()
            if not self.fmt_box.winfo_manager():
                self.fmt_box.pack(fill="x", after=self.formats_slot)
        else:
            if self._fmt_built:
                self._fmt_box.pack_forget()
            if not self.fmt_idle.winfo_manager():
                self.fmt_idle.pack(fill="x", padx=16, pady=(10, 0), after=self.formats_slot)

    def _fit_format_box(self) -> None:
        """На низькому вікні поле введення й перегляд результату стискаються (мін. 34 px), щоб кнопка
        «Копіювати» не виходила за край правої колонки; на високому — повертаються до звичайного розміру."""
        try:
            if not self._fmt_built or not self._fmt_box.winfo_manager():
                return
            s = self.scaling()
            right_h = self.right.winfo_height() / s
            if right_h < 200:                       # колонку ще не розкладено
                return
            used = 52 + self.formats_slot.winfo_reqheight() / s + 28      # шапка + рядки форматів + приписка
            room = right_h - used - 130                                  # 130 — решта вмісту блоку (заголовок, підписи, кнопка)
            h_in = int(max(34, min(72, room / 2)))
            h_out = int(max(34, min(74, room - h_in)))
            if (h_in, h_out) != self._fmt_heights:
                self._fmt_heights = (h_in, h_out)
                self.fmt_input.configure(height=h_in)
                self.fmt_preview.configure(height=h_out)
        except tk.TclError:
            pass

    def select_format(self, fid: str) -> None:
        self.sel_format = None if fid == self.sel_format else fid     # повторний клік згортає
        self._render_formats()
        self.right.update_idletasks()
        self._fit_format_box()
        if self.sel_format:
            self.fmt_input.focus_set()

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

    def _update_format_preview(self) -> None:
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        out = apply_format(fmt["type"], self.fmt_input.get("1.0", "end-1c")) if fmt else ""
        self._set_preview(out)

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
        """Результат форматування → буфер обміну; поле вводу очищується; вікно ховається."""
        fmt = self.preset.format(self.sel_format) if self.sel_format else None
        if not fmt:
            return
        out = apply_format(fmt["type"], self.fmt_input.get("1.0", "end-1c"))
        if not out:
            self.set_status("Не знайдено жодного числа — нічого копіювати")
            return
        self.copy_to_clipboard(out)
        self._finish_pick("✓ Скопійовано: " + clip(out, 60), self._clear_format_input)

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

        self.title_lbl.configure(text=self._view_name())
        self.count_lbl.configure(text=str(len(self.shown)))
        if self._is_history() and self.history.items:
            if not self.clear_btn.winfo_manager():
                self.clear_btn.pack(side="right")
        elif self.clear_btn.winfo_manager():
            self.clear_btn.pack_forget()

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
                self._card_border[it["id"]] = card.border
        have = [i for i in ids if i in self._card_objs]
        if [i for i in self._packed if i in self._card_objs] != have or len(self._packed) != len(have):
            for iid in self._packed:
                if iid in self._card_objs:
                    self._card_objs[iid].frame.pack_forget()
            for iid in have:
                self._card_objs[iid].frame.pack(fill="x", padx=self._card_pad, pady=4)
        self._packed = have
        if not self.shown:
            self._empty_state()
        need_bar = self._predict_scrollbar(self.cards, len(visible) * CARD_EST_H + 40)
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

    def _create_cards(self, n: int) -> None:
        if not self._todo or n <= 0:
            return
        wrap_px = int(self._wrap * self.scaling())
        for _ in range(min(n, len(self._todo))):
            it = self._todo.pop(0)
            iid = it["id"]
            card = Card(self, self.cards, it, self._card_pad, wrap_px, selected=iid == self.sel_id)
            self._card_objs[iid] = card
            self._cards[iid] = card.frame
            self._card_border[iid] = card.border
            idx = self._order.index(iid)           # ставимо ПЕРЕД найближчою наступною вже створеною карткою
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
            self._more_btn.pack(pady=8)
        self._highlight_selection()
        self.root.after_idle(self._sync_scrollbars)

    def _show_more(self) -> None:
        self.limit += PAGE
        self.render_list()

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
        box.pack(fill="x", pady=70)
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
        self._sync_scrollbars()                    # від цього залежить ширина полотна
        try:
            self.cards.update_idletasks()
            usable = int(self.cards._parent_canvas.winfo_width() / self.scaling())
        except (tk.TclError, AttributeError):
            usable = 0
        if usable < 200:                           # вікно ще не розкладено — груба оцінка
            usable = self._mid_w - 28
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

    def _apply_layout(self, width_px: int) -> None:
        """Бічні колонки ростуть разом із вікном: ліва clamp(280, 17%, 380), права clamp(344, 22%, 480)."""
        w = width_px / self.scaling()
        lw = int(min(LEFT_MAX, max(LEFT_W, w * LEFT_FRAC)))
        rw = int(min(RIGHT_MAX, max(RIGHT_W, w * RIGHT_FRAC)))
        if abs(lw - self._left_w) >= 3:
            self._left_w = lw
            self.left.configure(width=lw)
            chars = max(14, int((lw - 130) / 7.6))
            if chars != self._name_chars:
                self._name_chars = chars
                self.render_sidebar()
        if abs(rw - self._right_w) >= 3:
            self._right_w = rw
            self.right.configure(width=rw)
            if self._fmt_built:
                self._fmt_hint.configure(wraplength=int((rw - 40) * self.scaling()))

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
        self.sel_id = None
        self.limit = PAGE
        self.render_list(scroll_top=True)

    def _on_escape(self, event: tk.Event) -> None:
        if self._query():
            self.set_search("")
        elif self._can_hide():
            self.hide_window()
        else:
            self.root.iconify()

    def _on_delete_key(self, event: tk.Event):
        if isinstance(event.widget, (tk.Entry, tk.Text)) or not self.sel_id:
            return None
        self.on_delete(self.sel_id)

    # -- перетягування записів у категорії -----------------------------------
    def _drag_press(self, e: tk.Event, iid: str) -> None:
        self._drag = {"id": iid, "x": e.x_root, "y": e.y_root, "active": False, "ghost": None, "hover": None}
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
            ghost = tk.Toplevel(self.root)
            ghost.overrideredirect(True)
            ghost.attributes("-topmost", True)
            tk.Label(ghost, text=preview(item["text"] if item else "", 2, 60), bg=ACCENT, fg="#ffffff",
                     justify="left", padx=12, pady=6, font=(FONT, 10)).pack()
            d["ghost"] = ghost
        d["ghost"].geometry(f"+{e.x_root + 14}+{e.y_root + 14}")
        target = self._target_at(e.x_root, e.y_root)
        if target != d["hover"]:
            self._mark_target(d["hover"], False)
            self._mark_target(target, True)
            d["hover"] = target

    def _drag_release(self, e: tk.Event) -> None:
        d, self._drag = self._drag, None
        if not d:
            return
        if not d["active"]:
            self.copy_item(d["id"])
            return
        d["ghost"].destroy()
        self._mark_target(d["hover"], False)
        target = self._target_at(e.x_root, e.y_root)
        if target is not None:
            self.put_in_category(d["id"], target)

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

    def copy_item(self, item_id: str | None) -> None:
        text = self._text_of(item_id)
        if text is None:
            return
        self.copy_to_clipboard(text)

        def after() -> None:      # піднімаємо запис в історії вже ПІСЛЯ ховання вікна
            if self._is_history():
                self.history.bump(item_id)
                self.render(scroll_top=True)

        self._finish_pick("✓ Скопійовано: " + clip(preview(text, 1, 60).replace("\n", " "), 50), after)

    def _finish_pick(self, status: str, work=None) -> None:
        """Завершення вибору: якщо ввімкнено автохов — вікно зникає ОДРАЗУ, а вся решта роботи
        (запис на диск, перебудова карток) робиться вже у фоні, коли вікна не видно."""
        hide = bool(self.settings["autohide"])
        if hide:
            self._hide_or_iconify()
        self.set_status(status)
        if work:
            if hide:
                self.root.after(15, work)
            else:
                work()

    def _hide_or_iconify(self) -> None:
        if self._can_hide():
            self.hide_window()
        else:                     # без гарячої клавіші й трея сховане вікно було б не повернути — згортаємо
            self.root.iconify()

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
        text, cat_id = result
        snip = self.preset.add_snippet(cat_id, text)
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
        result = SnippetDialog(self, "Редагування", found[1]["text"], found[0]["id"]).run()
        if result and self.preset.update_snippet(item_id, result[0], result[1]):
            self.render()
            self.set_status("✓ Запис оновлено")

    def on_clear(self) -> None:
        """Без підтвердження: історія — тимчасова, а записи пресета ця дія не зачіпає."""
        self.history.clear()
        self.render(scroll_top=True)
        self.set_status("✓ Історію очищено")

    # -- категорії ----------------------------------------------------------
    def select_category(self, key: str) -> None:
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

    def _popup(self, menu: tk.Menu, x: int, y: int) -> None:
        self.menu = menu
        menu.tk_popup(x, y)

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

    def show_format_menu(self, x: int, y: int, fid: str) -> None:
        m = self._new_menu()
        m.add_command(label="Колір…", command=lambda: self.on_format_color(fid))
        self._popup(m, x, y)

    def show_category_menu(self, x: int, y: int, cat_id: str) -> None:
        m = self._new_menu()
        m.add_command(label="Перейменувати…", command=lambda: self.on_rename_category(cat_id))
        m.add_command(label="Колір…", command=lambda: self.on_category_color(cat_id))
        m.add_command(label="Перемістити вгору", command=lambda: self.on_move_category(cat_id, -1))
        m.add_command(label="Перемістити вниз", command=lambda: self.on_move_category(cat_id, 1))
        m.add_separator()
        m.add_command(label="Видалити категорію…", command=lambda: self.on_delete_category(cat_id))
        self._popup(m, x, y)

    def show_menu(self, x: int, y: int, item_id: str) -> None:
        text = self._text_of(item_id)
        if text is None:
            return
        self.sel_id = item_id
        self._highlight_selection()
        hist = self._is_history()
        m = self._new_menu()
        m.add_command(label="Копіювати", command=lambda: self.copy_item(item_id))
        if not hist:
            m.add_command(label="Редагувати…", command=lambda: self.on_edit(item_id))
            m.add_command(label="Колір запису…", command=lambda: self.on_snippet_color(item_id))
        sub = self._new_menu(m)
        cur = None if hist else (self.preset.find_snippet(item_id) or ({"id": None},))[0]["id"]
        for c in self.preset.categories:
            sub.add_command(label=("✓ " if cur == c["id"] else "    ") + c["name"],
                            command=lambda cid=c["id"]: self.put_in_category(item_id, cid))
        if self.preset.categories:
            sub.add_separator()
        sub.add_command(label="＋ Нова категорія…", command=lambda: self.on_new_category(for_item=item_id))
        m.add_cascade(label="Зберегти в категорію" if hist else "Перемістити в категорію", menu=sub)
        if not hist:
            m.add_command(label="Вгору", command=lambda: (self.preset.reorder_snippet(item_id, -1), self.render()))
            m.add_command(label="Вниз", command=lambda: (self.preset.reorder_snippet(item_id, 1), self.render()))
        m.add_separator()
        m.add_command(label="Видалити", command=lambda: self.on_delete(item_id))
        self._popup(m, x, y)

    # -- пресети --------------------------------------------------------------
    def _popup_preset_menu(self, x: int | None = None, y: int | None = None) -> None:
        if x is None:
            x, y = self.preset_chip.winfo_rootx(), self.preset_chip.winfo_rooty() + self.preset_chip.winfo_height()
        self._popup(self._build_preset_menu(self._new_menu()), x, y)

    def _build_preset_menu(self, m: tk.Menu) -> tk.Menu:
        m.add_command(label="Новий пресет…", command=self.on_new_preset)
        m.add_command(label="Відкрити пресет…", command=self.on_open_preset)
        m.add_command(label="Зберегти як…", command=self.on_save_preset_as)
        m.add_command(label="Перейменувати пресет…", command=self.on_rename_preset)
        m.add_command(label="Імпортувати з файлу (додати до поточного)…", command=self.on_import_preset)
        m.add_separator()
        m.add_command(label="Показати файл у теці", command=self.on_reveal_preset)
        recent = [p for p in self.settings["recent_presets"]
                  if os.path.exists(p) and os.path.abspath(p) != os.path.abspath(self.preset.path)]
        if recent:
            sub = self._new_menu(m)
            for p in recent:
                sub.add_command(label=clip(os.path.basename(p), 50), command=lambda path=p: self.open_preset_path(path))
            m.add_cascade(label="Останні", menu=sub)
        return m

    _FILETYPES = [("Пресет", "*" + PRESET_SUFFIX), ("JSON", "*.json"), ("Усі файли", "*.*")]

    def switch_preset(self, preset: Preset, message: str) -> None:
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
        m.add_cascade(label="Пресет", menu=self._build_preset_menu(self._new_menu(m)))
        m.add_separator()
        m.add_checkbutton(label="Пауза запису буфера", variable=self.v_paused, command=self._on_pause)
        m.add_checkbutton(label="Завжди зверху", variable=self.v_topmost, command=self._on_topmost)
        m.add_checkbutton(label="Ховати вікно після вибору запису", variable=self.v_autohide,
                          command=self._on_autohide)
        m.add_checkbutton(label="Відкривати на весь екран", variable=self.v_fullscreen,
                          command=self._on_fullscreen)
        hot = self._new_menu(m)
        for spec, label in HOTKEY_PRESETS:
            hot.add_radiobutton(label=label, value=spec, variable=self.v_hotkey, command=self._on_hotkey_choice)
        m.add_cascade(label="Гаряча клавіша", menu=hot)
        theme = self._new_menu(m)
        for value, label in THEMES:
            theme.add_radiobutton(label=label, value=value, variable=self.v_theme, command=self._on_theme)
        m.add_cascade(label="Тема", menu=theme)
        m.add_separator()
        m.add_command(label="Очистити історію буфера", command=self.on_clear)
        m.add_command(label="Вийти з програми", command=self.quit)
        self._popup(m, self.gear.winfo_rootx(), self.gear.winfo_rooty() + self.gear.winfo_height())

    def _on_pause(self) -> None:
        self.settings["paused"] = self.v_paused.get()
        self.set_status("Запис буфера призупинено" if self.v_paused.get() else "Запис буфера відновлено")

    def _on_autohide(self) -> None:
        self.settings["autohide"] = self.v_autohide.get()
        self._sync_submit_label()

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
        if announce:
            if self.hotkey_ok:
                self._announce_hotkey()
            elif spec != "off" and os.name == "nt":
                self.set_status(f"Не вдалося зайняти {hotkey_label(spec)} — її вже використовує інша програма")
            else:
                self.set_status("Гарячу клавішу вимкнено")

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
        return bool(self.hotkey_ok or self.tray)

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
        self.flush_render()                    # запас: фонова перебудова ще не встигла — завершуємо її тут
        if abs(self.scaling() - self._pf_scale) > 0.01:          # екран змінив масштаб, поки вікно було сховане
            self._make_pfonts()
            self._card_objs.clear()
            self._order = []
            self._render_now(True)
            self.flush_render()
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

    def _restore_topmost(self) -> None:
        try:
            self.root.attributes("-topmost", self.settings["topmost"])
        except tk.TclError:
            pass

    def hide_window(self) -> None:
        self._save_size()
        self.root.withdraw()
        self._hidden = True
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
        self._clear_format_input()
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
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        x = max(0, min(px - w // 2, sw - w))
        y = max(0, min(py - 40, sh - h - 50))
        self.root.geometry(f"{int(w / s)}x{int(h / s)}+{x}+{y}")

    def _on_root_configure(self, event: tk.Event) -> None:
        if event.widget is not self.root:
            return
        # розмір «звичайного» вікна: розгорнутий не запам'ятовуємо (на X11 Configure приходить ще до зміни стану)
        if self.root.state() == "normal" and not (self._maximized and time.monotonic() - self._max_ts < 0.8):
            self._size = (event.width, event.height)
        self._apply_layout(event.width)
        if self._fit_job is not None:
            self.root.after_cancel(self._fit_job)
        self._fit_job = self.root.after(80, self._fit_after_resize)

    def _fit_after_resize(self) -> None:
        self._fit_job = None
        self._fit_format_box()

    def _save_size(self) -> None:
        if self._size and self._size[0] > 200 and self._size[1] > 200:
            s = self.scaling()
            size = (int(self._size[0] / s), int(self._size[1] / s))
            if size != (self.settings["width"], self.settings["height"]):     # без зайвого запису на диск
                self.settings.data["width"], self.settings.data["height"] = size
                self.settings.save()

    def on_close(self) -> None:
        self.hide_window() if self._can_hide() else self.quit()

    def quit(self) -> None:
        self._save_size()
        try:
            self.history.flush()
        except OSError:
            pass
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
                        if self._is_history():
                            self.render(scroll_top=True)
                        else:
                            self.render_sidebar()
        self.history.flush()                         # запис історії на диск — тут, а не на кожне копіювання
        if not self._tick_marked:
            self._tick_marked = True
            _mark("first_tick_done")
        self.root.after(POLL_MS, self._tick)


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
              use_hotkey=not args.no_hotkey, use_tray=not args.no_tray, start_hidden=args.minimized)
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
