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

import argparse
import base64
import io
import os
import queue
import subprocess
import sys
import tempfile
import time
import tkinter as tk
from functools import lru_cache
from tkinter import colorchooser, filedialog, messagebox

import customtkinter as ctk

from formats import FORMATTERS, apply_format
from store import (HISTORY, PALETTE, PRESET_SUFFIX, History, Preset, PresetError, Settings,
                   default_data_dir, history_path, open_startup_preset)
from winsys import (HOTKEY_PRESETS, HotkeyListener, acquire_single_instance, hotkey_label, notify,
                    make_icon_image, start_tray)

APP_NAME = "Буфер обміну"
POLL_MS = 400                  # опитування буфера обміну
EVENT_POLL_MS = 20             # опитування черги подій (гаряча клавіша, трей): затримка показу ≤ 20 мс
TOGGLE_DEBOUNCE = 0.15         # с: подвійне натискання гарячої клавіші не «дзеленчить» вікном
FONT = "Segoe UI"
MONO = "Consolas"
PAGE = 60                      # скільки карток малювати за раз (віджети ctk важкі)
LEFT_W, RIGHT_W = 272, 344     # ширина бічних колонок (у «логічних» пікселях ctk)

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


class App:
    def __init__(self, root: ctk.CTk, preset: Preset, history: History, settings: Settings,
                 events: "queue.Queue[str]", use_hotkey: bool = True, use_tray: bool = True,
                 start_hidden: bool = False):
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
        self._last_toggle = 0.0
        self.sel_format: str | None = None  # вибраний формат у правій колонці
        self._card_border: dict[str, tuple] = {}
        self._last_seen: str | None = None
        self._last_query = ""
        self._last_cat: str | None = None
        self._status_job: str | None = None
        self._wrap_labels: list[ctk.CTkLabel] = []
        self._cards: dict[str, ctk.CTkFrame] = {}
        self._row_keys: dict[tk.Widget, str] = {}
        self._rows: dict[str, ctk.CTkFrame] = {}
        self._drag: dict | None = None
        self._wrap = 330
        self._wrap_job: str | None = None
        self._size: tuple[int, int] | None = None
        self._ico_path: str | None = None
        self.menu: tk.Menu | None = None
        self.f = _Fonts()

        root.title(APP_NAME)
        root.geometry(f"{settings['width']}x{settings['height']}")
        root.minsize(1040, 520)
        root.configure(fg_color=BG)
        root.attributes("-topmost", settings["topmost"])
        self.apply_icon_to(root)
        root.after(300, self.apply_icon_to, root)   # CTk на Windows скидає іконку ~через 200 мс

        self._build_ui()
        self._update_title()
        self.render()
        root.bind("<Configure>", self._on_root_configure, add="+")
        root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.hotkeys = HotkeyListener(events)
        self.hotkey_ok = False
        if use_hotkey:
            self.apply_hotkey(announce=False)
        self.tray = start_tray(events, APP_NAME) if use_tray else None

        if start_hidden and self._can_hide():
            root.withdraw()
            self._hidden = True
        else:
            self._announce_hotkey()
        self._poll_events()
        self._tick()

    # -- допоміжне ---------------------------------------------------------
    def scaling(self) -> float:
        try:
            return float(self.root._get_window_scaling())
        except Exception:
            return 1.0

    def apply_icon_to(self, win) -> None:
        """Іконка вікна: .ico на Windows, PNG-iconphoto на Linux/macOS (усе в try — це лише оздоба)."""
        try:
            if not win.winfo_exists():
                return
            if os.name == "nt":
                if not self._ico_path:
                    img = make_icon_image(256)
                    if img is None:
                        return
                    self._ico_path = os.path.join(tempfile.gettempdir(), "clipboard_memory_icon.ico")
                    img.save(self._ico_path, sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
                win.iconbitmap(self._ico_path)
            else:
                img = make_icon_image(64)
                if img is None:
                    return
                buf = io.BytesIO()
                img.save(buf, "PNG")
                self._icon = tk.PhotoImage(data=base64.b64encode(buf.getvalue()))
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

    def _icon_button(self, parent, text: str, command, hover_text=TEXT, hover_bg=BTN2) -> ctk.CTkLabel:
        lbl = ctk.CTkLabel(parent, text=text, width=28, height=28, corner_radius=7, text_color=MUTED,
                           fg_color="transparent", font=self.f.icon, cursor="hand2")

        def enter(e=None):
            lbl.configure(fg_color=hover_bg, text_color=hover_text)

        def leave(e=None):
            lbl.configure(fg_color="transparent", text_color=MUTED)

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
        self.search.bind("<KeyRelease>", lambda e: self._on_search(), add="+")
        for ev in ("<<Paste>>", "<<Cut>>", "<<Clear>>"):
            self.search.bind(ev, lambda e: self.root.after_idle(self._on_search), add="+")
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
        self.status = ctk.CTkLabel(root, text="", anchor="w", text_color=MUTED, font=self.f.small)
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
        self.v_hotkey = tk.StringVar(value=self.settings["hotkey"])
        self.v_theme = tk.StringVar(value=self.settings["theme"])

    def _build_left(self, cols) -> None:
        left = self._panel(cols, width=LEFT_W)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 7))
        left.pack_propagate(False)          # ширина колонки фіксована, довгі назви не розпирають її
        self.left = left
        # картка поточного пресета
        self.preset_chip = ctk.CTkFrame(left, corner_radius=12, fg_color=ACCENT_SOFT, cursor="hand2")
        self.preset_chip.pack(fill="x", padx=10, pady=(10, 6))
        chip_text = ctk.CTkFrame(self.preset_chip, fg_color="transparent")
        chip_text.pack(side="left", fill="x", expand=True, padx=(12, 0), pady=7)
        self.preset_cap = ctk.CTkLabel(chip_text, text="ПРЕСЕТ", anchor="w", text_color=ACCENT, font=self.f.caps)
        self.preset_cap.pack(fill="x")
        self.preset_name = ctk.CTkLabel(chip_text, text="", anchor="w", text_color=TEXT, font=self.f.bold)
        self.preset_name.pack(fill="x")
        self.preset_file = ctk.CTkLabel(chip_text, text="", anchor="w", text_color=MUTED, font=self.f.tiny)
        self.preset_file.pack(fill="x")
        chev = ctk.CTkLabel(self.preset_chip, text="▾", text_color=ACCENT, font=self.f.icon, width=28)
        chev.pack(side="right", padx=(0, 8))
        parts = [self.preset_chip, chip_text, self.preset_cap, self.preset_name, self.preset_file, chev]
        self._bind_all(parts, "<Button-1>", lambda e: self._popup_preset_menu(e.x_root, e.y_root))

        # заголовок «Категорії» + кнопка створення
        head = ctk.CTkFrame(left, fg_color="transparent")
        head.pack(fill="x", padx=14, pady=(8, 2))
        ctk.CTkLabel(head, text="КАТЕГОРІЇ", anchor="w", text_color=MUTED, font=self.f.caps).pack(side="left")
        ctk.CTkButton(head, text="＋ Нова", width=64, height=26, corner_radius=8, fg_color=ACCENT_SOFT,
                      hover_color=BTN2_HOVER, text_color=ACCENT, font=self.f.small,
                      command=self.on_new_category).pack(side="right")

        self.history_slot = ctk.CTkFrame(left, fg_color="transparent")
        self.history_slot.pack(fill="x", padx=2)
        ctk.CTkFrame(left, height=1, fg_color=PANEL_BORDER).pack(fill="x", padx=14, pady=(4, 4))
        self.cat_list = ctk.CTkScrollableFrame(left, fg_color="transparent", corner_radius=0,
                                               scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.cat_list.pack(fill="both", expand=True, padx=(2, 4), pady=(0, 8))

    def _build_middle(self, cols) -> None:
        mid = self._panel(cols)
        mid.grid(row=0, column=1, sticky="nsew", padx=7)
        self.mid = mid
        head = ctk.CTkFrame(mid, fg_color="transparent")
        head.pack(fill="x", padx=18, pady=(14, 4))
        self.title_lbl = ctk.CTkLabel(head, text="", anchor="w", text_color=TEXT, font=self.f.title)
        self.title_lbl.pack(side="left")
        self.count_lbl = ctk.CTkLabel(head, text="", anchor="w", text_color=MUTED, font=self.f.body)
        self.count_lbl.pack(side="left", padx=(8, 0), pady=(3, 0))
        self.clear_btn = ctk.CTkButton(head, text="Очистити історію", width=120, height=26, corner_radius=8,
                                       fg_color="transparent", hover_color=BTN2, text_color=MUTED,
                                       font=self.f.small, command=self.on_clear)
        self.cards = ctk.CTkScrollableFrame(mid, fg_color="transparent", corner_radius=0,
                                            scrollbar_button_color=SCROLL, scrollbar_button_hover_color=SCROLL_HOVER)
        self.cards.pack(fill="both", expand=True, padx=(8, 4), pady=(0, 10))
        mid.bind("<Configure>", self._on_mid_resize, add="+")

    def _build_right(self, cols) -> None:
        right = self._panel(cols, width=RIGHT_W)
        right.grid(row=0, column=2, sticky="nsew", padx=(7, 0))
        right.pack_propagate(False)
        self.right = right
        head = ctk.CTkFrame(right, fg_color="transparent")
        head.pack(fill="x", padx=14, pady=(16, 4))
        ctk.CTkLabel(head, text="ФОРМАТУВАННЯ", anchor="w", text_color=MUTED, font=self.f.caps).pack(side="left")
        ctk.CTkButton(head, text="＋ Новий", width=64, height=26, corner_radius=8, fg_color=BTN2,
                      text_color=FAINT, text_color_disabled=FAINT, font=self.f.small,
                      state="disabled").pack(side="right")

        # внизу — приписка (пакується першою зі side=bottom, щоб ніколи не виштовхувалась)
        self.formats_note = ctk.CTkLabel(right, text="Інші формати — скоро", anchor="w", text_color=FAINT,
                                         font=self.f.small, height=16)
        self.formats_note.pack(side="bottom", fill="x", padx=16, pady=(0, 12))

        self.formats_slot = ctk.CTkFrame(right, fg_color="transparent")
        self.formats_slot.pack(fill="x", padx=2)

        # область введення вибраного формату
        self.fmt_box = ctk.CTkFrame(right, fg_color=PANEL, corner_radius=0)
        self.fmt_title = ctk.CTkLabel(self.fmt_box, text="", anchor="w", text_color=TEXT, font=self.f.bold, height=20)
        self.fmt_title.pack(fill="x", padx=16, pady=(10, 0))
        self.fmt_hint = ctk.CTkLabel(self.fmt_box, text="", anchor="w", justify="left", text_color=MUTED,
                                     font=self.f.small, wraplength=RIGHT_W - 40, height=16)
        self.fmt_hint.pack(fill="x", padx=16, pady=(2, 6))
        self.fmt_input = ctk.CTkTextbox(self.fmt_box, height=72, wrap="word", corner_radius=10, border_width=1,
                                        border_color=PANEL_BORDER, fg_color=INPUT, text_color=TEXT,
                                        font=self.f.body, undo=True)
        self.fmt_input.pack(fill="x", padx=14)
        ctk.CTkLabel(self.fmt_box, text="Результат", anchor="w", text_color=MUTED, font=self.f.caps, height=14).pack(
            fill="x", padx=16, pady=(8, 2))
        self.fmt_preview = ctk.CTkTextbox(self.fmt_box, height=74, wrap="word", corner_radius=10, border_width=1,
                                          border_color=PANEL_BORDER, fg_color=INPUT, text_color=TEXT,
                                          font=self.f.mono)
        self.fmt_preview.pack(fill="x", padx=14)
        self.fmt_preview.configure(state="disabled")
        self.fmt_btn = ctk.CTkButton(self.fmt_box, text="Копіювати і сховати", height=38, corner_radius=12,
                                     fg_color=ACCENT, hover_color=ACCENT_HOVER, font=self.f.bold,
                                     command=self.submit_format)
        self.fmt_btn.pack(fill="x", padx=14, pady=(10, 4))
        self.fmt_idle = ctk.CTkLabel(right, text="Оберіть формат, щоб ввести значення.", anchor="w",
                                     text_color=MUTED, font=self.f.small)
        # Enter — виконати, Shift+Enter — новий рядок, Ctrl+A — виділити все
        inner = self.fmt_input._textbox
        inner.bind("<Return>", self._on_format_return)
        inner.bind("<KP_Enter>", self._on_format_return)
        inner.bind("<KeyRelease>", lambda e: self._update_format_preview(), add="+")
        inner.bind("<<Paste>>", lambda e: self.root.after_idle(self._update_format_preview), add="+")
        inner.bind("<Control-a>", lambda e: (inner.tag_add("sel", "1.0", "end-1c"), "break")[1])
        self._sync_submit_label()

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

    def render_sidebar(self) -> None:
        if self._defer():
            return
        self._render_sidebar_now()

    def _render_sidebar_now(self) -> None:
        for w in self.history_slot.winfo_children():
            w.destroy()
        for w in self.cat_list.winfo_children():
            w.destroy()
        self._row_keys.clear()
        self._rows.clear()
        self._side_row(self.history_slot, HISTORY, "Історія буфера", "#8a93a0", len(self.history.items),
                       droppable=False)
        for c in self.preset.categories:
            self._side_row(self.cat_list, c["id"], c["name"], c["color"], self.preset.count(c["id"]), real=True)
        if not self.preset.categories:
            ctk.CTkLabel(self.cat_list, anchor="w", justify="left", wraplength=190, text_color=MUTED,
                         font=self.f.small,
                         text="Категорій ще немає.\nНатисніть «＋ Нова», щоб створити першу — "
                              "а потім перетягніть у неї записи.").pack(fill="x", padx=12, pady=10)

    def _side_row(self, parent, key: str, name: str, color: str, count: int,
                  droppable: bool = True, real: bool = False) -> None:
        selected = key == self.view
        row = ctk.CTkFrame(parent, corner_radius=9, fg_color=ROW_SEL if selected else "transparent", cursor="hand2")
        row.pack(fill="x", padx=8, pady=1)
        dot = ctk.CTkLabel(row, text="●", text_color=color, font=self.f.body, width=16)
        dot.pack(side="left", padx=(10, 6), pady=8)
        more = None
        if real:    # видима кнопка меню (перейменувати, колір, порядок, видалити)
            more = self._icon_button(row, "⋯", lambda e, k=key: self.show_category_menu(e.x_root, e.y_root, k))
            more.pack(side="right", padx=(0, 6))
        num = ctk.CTkLabel(row, text=str(count), text_color=MUTED, font=self.f.small)
        num.pack(side="right", padx=(0, 4 if real else 10))
        label = ctk.CTkLabel(row, text=clip(name, 18), anchor="w", text_color=TEXT,
                             font=self.f.bold if selected else self.f.body)
        label.pack(side="left", fill="x", expand=True)
        parts = [row, dot, label, num]
        self._rows[key] = row
        if droppable:
            self._row_keys[row] = key
        self._bind_all(parts, "<Button-1>", lambda e, k=key: self.select_category(k))
        if real:
            self._bind_all(parts + [more], "<Button-3>",
                           lambda e, k=key: self.show_category_menu(e.x_root, e.y_root, k))
        if not selected:
            self._hoverable(row, parts + ([more] if more else []), lambda r=row: r.configure(fg_color=ROW_HOVER),
                            lambda r=row: r.configure(fg_color="transparent"))

    # -- форматування (права колонка) -------------------------------------------
    def _render_formats(self) -> None:
        for w in self.formats_slot.winfo_children():
            w.destroy()
        if self.sel_format and not self.preset.format(self.sel_format):
            self.sel_format = None
        for fmt in self.preset.formats:
            self._format_row(fmt)
        self._sync_format_panel()

    def _format_row(self, fmt: dict) -> None:
        fid, known = fmt["id"], fmt.get("type") in FORMATTERS
        selected = fid == self.sel_format
        fill, hover, border = card_colors(fmt["color"]) if known else (CARD, CARD, CARD_BORDER)
        row = ctk.CTkFrame(self.formats_slot, corner_radius=12, fg_color=fill, border_width=2 if selected else 1,
                           border_color=ACCENT if selected else border, cursor="hand2" if known else "arrow")
        row.pack(fill="x", padx=10, pady=3)
        row.grid_columnconfigure(1, weight=1)
        bar = ctk.CTkFrame(row, width=6, height=8, corner_radius=3, fg_color=fmt["color"] if known else NEUTRAL)
        bar.grid(row=0, column=0, rowspan=2, sticky="ns", padx=(9, 0), pady=9)
        info = FORMAT_INFO.get(fmt.get("type"), ("Невідомий тип (з новішої версії програми)", ""))
        name = ctk.CTkLabel(row, text=clip(fmt["name"], 22), anchor="w", font=self.f.card,
                            text_color=TEXT if known else FAINT, height=22)
        name.grid(row=0, column=1, sticky="we", padx=(10, 4), pady=(8, 0))
        sub = ctk.CTkLabel(row, text=clip(info[0], 40), anchor="w", font=self.f.small,
                           text_color=META if known else FAINT, height=16)
        sub.grid(row=1, column=1, sticky="we", padx=(10, 4), pady=(0, 8))
        parts = [row, name, sub]
        if known:
            more = self._icon_button(row, "⋯", lambda e, i=fid: self.show_format_menu(e.x_root, e.y_root, i))
            more.grid(row=0, column=2, rowspan=2, padx=(0, 6))
            self._bind_all(parts, "<Button-1>", lambda e, i=fid: self.select_format(i))
            self._bind_all(parts + [more], "<Button-3>", lambda e, i=fid: self.show_format_menu(e.x_root, e.y_root, i))
            if not selected:
                self._hoverable(row, parts + [more], lambda r=row, c=hover: r.configure(fg_color=c),
                                lambda r=row, c=fill: r.configure(fg_color=c))

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
            self.fmt_box.pack_forget()
            self.fmt_idle.pack(fill="x", padx=16, pady=(10, 0), after=self.formats_slot)

    def select_format(self, fid: str) -> None:
        self.sel_format = None if fid == self.sel_format else fid     # повторний клік згортає
        self._render_formats()
        if self.sel_format:
            self.fmt_input.focus_set()

    def _sync_submit_label(self) -> None:
        self.fmt_btn.configure(text="Копіювати і сховати" if self.settings["autohide"] else "Копіювати")

    def _in_format_input(self, event) -> bool:
        return getattr(event, "widget", None) is self.fmt_input._textbox

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

    def _render_list_now(self, scroll_top: bool = False) -> None:
        self.render_count += 1
        canvas = self.cards._parent_canvas
        y = canvas.yview()[0]
        for w in self.cards.winfo_children():
            w.destroy()
        self._wrap_labels, self._cards, self._card_border = [], {}, {}
        self.shown = self._collect()
        if self.sel_id not in {i["id"] for i in self.shown}:
            self.sel_id = self.shown[0]["id"] if self.shown else None

        self.title_lbl.configure(text=self._view_name())
        self.count_lbl.configure(text=str(len(self.shown)))
        if self._is_history() and self.history.items:
            self.clear_btn.pack(side="right")
        else:
            self.clear_btn.pack_forget()

        if not self.shown:
            self._empty_state()
        for it in self.shown[: self.limit]:
            self._make_card(it)
        if len(self.shown) > self.limit:
            more = len(self.shown) - self.limit
            ctk.CTkButton(self.cards, text=f"Показати ще ({more})", height=34, corner_radius=10, fg_color=BTN2,
                          hover_color=BTN2_HOVER, text_color=TEXT, font=self.f.body,
                          command=self._show_more).pack(pady=8)
        self.cards.update_idletasks()
        canvas.yview_moveto(0 if scroll_top else y)
        self._highlight_selection()

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
        box = ctk.CTkFrame(self.cards, fg_color="transparent")
        box.pack(fill="x", pady=70)
        ctk.CTkLabel(box, text=title, text_color=TEXT, font=self.f.bold).pack()
        ctk.CTkLabel(box, text=text, text_color=MUTED, font=self.f.body, justify="center",
                     wraplength=max(200, self._wrap)).pack(pady=(6, 0))

    def _make_card(self, it: dict) -> None:
        iid = it["id"]
        color = it.get("color")             # ефективний колір: власний запису або колір папки (в історії — немає)
        fill, hover, border = card_colors(color)
        card = ctk.CTkFrame(self.cards, corner_radius=12, fg_color=fill, border_width=1,
                            border_color=border, cursor="hand2")
        card.pack(fill="x", padx=6, pady=4)
        card.grid_columnconfigure(1, weight=1)
        bar = ctk.CTkFrame(card, width=6, height=8, corner_radius=3, fg_color=color or NEUTRAL)
        bar.grid(row=0, column=0, rowspan=2, sticky="ns", padx=(9, 0), pady=10)
        body = ctk.CTkLabel(card, text=preview(it["text"]), anchor="w", justify="left", text_color=TEXT,
                            font=self.f.card, wraplength=self._wrap)
        body.grid(row=0, column=1, sticky="we", padx=(12, 4), pady=(11, 0))
        self._wrap_labels.append(body)
        when = time.strftime("%d.%m %H:%M", time.localtime(it["ts"]))
        meta = ctk.CTkLabel(card, text=f"{when}  ·  {len(it['text'])} симв.", anchor="w", text_color=META,
                            font=self.f.meta)
        meta.grid(row=1, column=1, sticky="we", padx=(12, 4), pady=(2, 10))

        more = self._icon_button(card, "⋯", lambda e: self.show_menu(e.x_root, e.y_root, iid))
        dele = self._icon_button(card, "✕", lambda e: self.on_delete(iid), hover_text=DANGER)
        more.grid(row=0, column=2, padx=(0, 2), pady=(8, 0))
        dele.grid(row=0, column=3, padx=(0, 8), pady=(8, 0))

        clickable = [card, bar, body, meta]
        self._bind_all(clickable, "<ButtonPress-1>", lambda e, i=iid: self._drag_press(e, i))
        self._bind_all(clickable, "<B1-Motion>", self._drag_motion)
        self._bind_all(clickable, "<ButtonRelease-1>", self._drag_release)
        self._bind_all(clickable + [more, dele], "<Button-3>", lambda e, i=iid: self.show_menu(e.x_root, e.y_root, i))
        self._hoverable(card, clickable + [more, dele], lambda c=card, h=hover: c.configure(fg_color=h),
                        lambda c=card, f=fill: c.configure(fg_color=f))
        self._cards[iid] = card
        self._card_border[iid] = border

    def _on_mid_resize(self, event: tk.Event) -> None:
        # bind() у CTkFrame вішається на його внутрішнє полотно, тож event.widget — це _canvas, а не сам фрейм
        if event.widget not in (self.mid, getattr(self.mid, "_canvas", None)):
            return
        self._wrap = max(160, int(event.width / self.scaling()) - 150)
        if self._wrap_job:
            self.root.after_cancel(self._wrap_job)
        self._wrap_job = self.root.after(60, self._apply_wrap)

    def _apply_wrap(self) -> None:
        for lbl in self._wrap_labels:
            try:
                lbl.configure(wraplength=self._wrap)
            except tk.TclError:
                pass

    # -- вибір і клавіатура -------------------------------------------------
    def _highlight_selection(self) -> None:
        for iid, card in self._cards.items():
            sel = iid == self.sel_id
            card.configure(border_color=ACCENT if sel else self._card_border.get(iid, CARD_BORDER),
                           border_width=2 if sel else 1)

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

    def _on_search(self) -> None:
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
        row = self._rows.get(key) if key else None
        if row:
            row.configure(fg_color=DROP if on else (ROW_SEL if key == self.view else "transparent"))

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
        if messagebox.askyesno(APP_NAME, "Очистити історію буфера?\nЗаписи в категоріях пресета не зачіпаються.",
                               parent=self.root):
            self.history.clear()
            self.render(scroll_top=True)

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
        hot = self._new_menu(m)
        for spec, label in HOTKEY_PRESETS:
            hot.add_radiobutton(label=label, value=spec, variable=self.v_hotkey, command=self._on_hotkey_choice)
        m.add_cascade(label="Гаряча клавіша", menu=hot)
        theme = self._new_menu(m)
        for value, label in THEMES:
            theme.add_radiobutton(label=label, value=value, variable=self.v_theme, command=self._on_theme)
        m.add_cascade(label="Тема", menu=theme)
        m.add_separator()
        m.add_command(label="Очистити історію буфера…", command=self.on_clear)
        m.add_command(label="Вийти з програми", command=self.quit)
        self._popup(m, self.gear.winfo_rootx(), self.gear.winfo_rooty() + self.gear.winfo_height())

    def _on_pause(self) -> None:
        self.settings["paused"] = self.v_paused.get()
        self.set_status("Запис буфера призупинено" if self.v_paused.get() else "Запис буфера відновлено")

    def _on_autohide(self) -> None:
        self.settings["autohide"] = self.v_autohide.get()
        self._sync_submit_label()

    def _on_topmost(self) -> None:
        self.settings["topmost"] = self.v_topmost.get()
        self.root.attributes("-topmost", self.v_topmost.get())

    def _on_theme(self) -> None:
        self.settings["theme"] = self.v_theme.get()
        ctk.set_appearance_mode(self.v_theme.get())

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

    def show_window(self, near_cursor: bool = False) -> None:
        """Показ — це лише deiconify: усе вже підготовлено при хованні (див. _reset_when_hidden)."""
        if self._flush_job is not None:        # запас: фонова перебудова ще не встигла — завершуємо її тут
            self.root.after_cancel(self._flush_job)
            self._flush_job = None
        if self._dirty:
            self._dirty, top, self._dirty_top = False, self._dirty_top, False
            self._hidden = False
            self._render_now(top)
        self._hidden = False
        if near_cursor:
            self._place_near_cursor()
        fade = os.name == "nt"       # на Windows: невидимо → deiconify → домалювали → видимо (без «білого» блимання)
        try:
            if fade:
                self.root.attributes("-alpha", 0.0)
            self.root.deiconify()
            self.root.lift()
            self.root.attributes("-topmost", True)
            if fade:
                self.root.update_idletasks()
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
        if self.root.state() == "normal" and self.root.focus_displayof() is not None:
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
        if event.widget is self.root and self.root.state() == "normal":
            self._size = (event.width, event.height)

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
        self.hotkeys.stop()
        if self.tray:
            try:
                self.tray.stop()
            except Exception:
                pass
        self.root.destroy()

    # -- фоновий цикл -----------------------------------------------------------
    def _poll_events(self) -> None:
        """Швидке (кожні ~20 мс) опитування черги подій: гаряча клавіша, трей, друга копія програми.
        Кілька «toggle», що накопичились між опитуваннями, зводяться до одного (парні скасовують одне одного)."""
        batch: list[str] = []
        try:
            while True:
                batch.append(self.events.get_nowait())
        except queue.Empty:
            pass
        if batch:
            if "quit" in batch:
                self.quit()
                return
            toggles = batch.count("toggle")
            if "show" in batch:
                self.show_window()
            elif toggles % 2:
                self.toggle_window()
        self.root.after(EVENT_POLL_MS, self._poll_events)

    def _tick(self) -> None:
        if self.preset.reload():                     # файл пресета змінили ззовні (редактор, синхронізація)
            self._update_title()
            self.render()
            self.set_status("Пресет оновлено з файлу")

        if not self.settings["paused"]:
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
        self.root.after(POLL_MS, self._tick)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--data-dir", default=default_data_dir(), help="тека з історією й налаштуваннями")
    parser.add_argument("--preset", help="файл пресета (.preset.json), з яким працювати")
    parser.add_argument("--no-hotkey", action="store_true", help="не реєструвати глобальну гарячу клавішу")
    parser.add_argument("--no-tray", action="store_true", help="не показувати іконку в треї")
    parser.add_argument("--minimized", action="store_true", help="запуститись одразу у фоні (без вікна)")
    args = parser.parse_args(argv)

    events: "queue.Queue[str]" = queue.Queue()
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

    data_dir = os.path.abspath(args.data_dir)
    settings = Settings(os.path.join(data_dir, "settings.json"))
    preset, warning = open_startup_preset(settings, data_dir, args.preset)
    history = History(history_path(data_dir))

    ctk.set_appearance_mode(settings["theme"])
    root = ctk.CTk()
    app = App(root, preset, history, settings, events,
              use_hotkey=not args.no_hotkey, use_tray=not args.no_tray, start_hidden=args.minimized)
    if warning:
        app.set_status(warning, 12000)
        if not args.minimized:
            root.after(400, lambda: messagebox.showwarning(APP_NAME, warning, parent=root))
    root.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
