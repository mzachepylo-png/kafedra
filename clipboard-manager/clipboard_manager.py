#!/usr/bin/env python3
"""Менеджер буфера обміну з пам'яттю і категоріями — аналог Win+V.

* Автоматично запам'ятовує весь скопійований текст.
* Власні шматки тексту можна складати в категорії (кнопка «Додати» або перетягування мишею).
* Клік по запису — текст одразу копіюється в буфер обміну.
* Ctrl+X (налаштовується) відкриває/ховає вікно; програма живе в треї.

Запуск:  python clipboard_manager.py
"""

from __future__ import annotations

import argparse
import base64
import io
import os
import queue
import sys
import time
import tkinter as tk
from tkinter import messagebox, ttk

from store import ALL, UNCAT, Settings, Store, default_data_path
from winsys import (HOTKEY_PRESETS, HotkeyListener, acquire_single_instance,
                    enable_dpi_awareness, hotkey_label, make_icon_image, start_tray)

APP_NAME = "Буфер обміну"
POLL_MS = 400
FONT = "Segoe UI"

BG = "#f6f6f6"
SIDEBAR = "#ececec"
SIDE_HOVER = "#e0e0e0"
SIDE_SEL = "#cfe3f6"
CARD = "#ffffff"
CARD_HOVER = "#f2f8fd"
BORDER = "#dcdcdc"
TEXT = "#1b1b1b"
MUTED = "#707070"
ACCENT = "#0f6cbd"
ACCENT_HOVER = "#115ea3"
DANGER = "#c42b1c"
GOLD = "#d89b00"


def preview(text: str, max_lines: int = 4, max_chars: int = 260) -> str:
    lines = text.strip().splitlines()
    shown = "\n".join(lines[:max_lines])
    cut = len(lines) > max_lines
    if len(shown) > max_chars:
        shown, cut = shown[:max_chars], True
    return shown + (" …" if cut else "")


def flat_button(parent, text: str, command, primary: bool = False, **kw) -> tk.Label:
    """Плоска кнопка у стилі Windows 11 (tk.Label з ховером)."""
    base, hover, fg = (ACCENT, ACCENT_HOVER, "#ffffff") if primary else ("#e6e6e6", "#d6d6d6", TEXT)
    lbl = tk.Label(parent, text=text, bg=base, fg=fg, padx=12, pady=5, cursor="hand2", font=(FONT, 10), **kw)
    lbl.bind("<Enter>", lambda e: lbl.configure(bg=hover))
    lbl.bind("<Leave>", lambda e: lbl.configure(bg=base))
    lbl.bind("<Button-1>", lambda e: command())
    return lbl


# --------------------------------------------------------------------------- #
#  Діалоги
# --------------------------------------------------------------------------- #

class _Dialog(tk.Toplevel):
    """Модальне вікно по центру батьківського."""

    def __init__(self, app: "App", title: str, width: int, height: int):
        super().__init__(app.root)
        self.app = app
        self.result = None
        self.title(title)
        self.configure(bg=BG)
        self.transient(app.root)
        self.resizable(False, False)
        app.root.update_idletasks()
        x = app.root.winfo_rootx() + max(0, (app.root.winfo_width() - width) // 2)
        y = app.root.winfo_rooty() + max(0, (app.root.winfo_height() - height) // 3)
        self.geometry(f"{width}x{height}+{x}+{y}")
        self.bind("<Escape>", lambda e: self.cancel())
        self.protocol("WM_DELETE_WINDOW", self.cancel)

    def run(self):
        self.app._modal += 1
        try:
            self.grab_set()
            self.wait_window()
        finally:
            self.app._modal -= 1
        return self.result

    def cancel(self) -> None:
        self.result = None
        self.destroy()


class TextDialog(_Dialog):
    def __init__(self, app: "App", title: str, prompt: str, initial: str = ""):
        super().__init__(app, title, 340, 140)
        tk.Label(self, text=prompt, bg=BG, anchor="w", font=(FONT, 10)).pack(fill="x", padx=16, pady=(14, 4))
        self.var = tk.StringVar(value=initial)
        self.entry = tk.Entry(self, textvariable=self.var, font=(FONT, 11), relief="solid", bd=1)
        self.entry.pack(fill="x", padx=16)
        self.entry.focus_set()
        self.entry.select_range(0, "end")
        self.entry.bind("<Return>", lambda e: self.ok())
        row = tk.Frame(self, bg=BG)
        row.pack(fill="x", padx=16, pady=14)
        flat_button(row, "Гаразд", self.ok, primary=True).pack(side="right")
        flat_button(row, "Скасувати", self.cancel).pack(side="right", padx=8)

    def ok(self) -> None:
        self.result = self.var.get()
        self.destroy()


class SnippetDialog(_Dialog):
    NO_CAT = "Без категорії"

    def __init__(self, app: "App", title: str, text: str = "", category: str | None = None):
        super().__init__(app, title, 460, 330)
        self.names = {c["name"]: c["id"] for c in app.store.categories}
        tk.Label(self, text="Текст", bg=BG, anchor="w", font=(FONT, 10)).pack(fill="x", padx=16, pady=(14, 2))
        self.text = tk.Text(self, height=9, wrap="word", font=(FONT, 10), relief="solid", bd=1, undo=True)
        self.text.pack(fill="both", expand=True, padx=16)
        self.text.insert("1.0", text)
        self.text.focus_set()
        self.text.bind("<Control-Return>", lambda e: (self.ok(), "break")[1])
        self.text.bind("<Control-a>", lambda e: (self.text.tag_add("sel", "1.0", "end-1c"), "break")[1])
        row = tk.Frame(self, bg=BG)
        row.pack(fill="x", padx=16, pady=12)
        tk.Label(row, text="Категорія:", bg=BG, font=(FONT, 10)).pack(side="left")
        current = app.store.category(category)
        self.cat_var = tk.StringVar(value=current["name"] if current else self.NO_CAT)
        ttk.Combobox(row, textvariable=self.cat_var, state="readonly", width=18,
                     values=[self.NO_CAT, *self.names]).pack(side="left", padx=8)
        flat_button(row, "Зберегти", self.ok, primary=True).pack(side="right")
        flat_button(row, "Скасувати", self.cancel).pack(side="right", padx=8)

    def ok(self) -> None:
        text = self.text.get("1.0", "end-1c")
        if not text.strip():
            return
        self.result = (text, self.names.get(self.cat_var.get()))
        self.destroy()


# --------------------------------------------------------------------------- #
#  Головне вікно
# --------------------------------------------------------------------------- #

class App:
    def __init__(self, root: tk.Tk, store: Store, settings: Settings, events: "queue.Queue[str]",
                 use_hotkey: bool = True, use_tray: bool = True, start_hidden: bool = False):
        self.root = root
        self.store = store
        self.settings = settings
        self.events = events
        self.view_cat: str = ALL
        self.sel_id: str | None = None
        self.shown: list[dict] = []
        self._modal = 0
        self._popup = False          # вікно відкрито гарячою клавішею/треєм
        self._last_seen: str | None = None
        self._status_job: str | None = None
        self._wrap_labels: list[tk.Label] = []
        self._cards: dict[str, tk.Frame] = {}
        self._tints: dict[str, list[tk.Widget]] = {}
        self._side_targets: dict[tk.Widget, str] = {}
        self._side_rows: dict[str, tk.Frame] = {}
        self._drag: dict | None = None

        root.title(APP_NAME)
        root.geometry(f"{settings['width']}x{settings['height']}")
        root.minsize(520, 360)
        root.configure(bg=BG)
        root.attributes("-topmost", settings["topmost"])
        self._set_window_icon()

        self._build_ui()
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
        else:
            self._announce_hotkey()
        self._tick()

    # -- побудова вікна -----------------------------------------------------
    def _set_window_icon(self) -> None:
        img = make_icon_image(64)
        if img is None:
            return
        try:
            buf = io.BytesIO()
            img.save(buf, "PNG")
            self._icon = tk.PhotoImage(data=base64.b64encode(buf.getvalue()))
            self.root.iconphoto(True, self._icon)
        except Exception:
            pass

    def _build_ui(self) -> None:
        root = self.root

        # ліва панель: категорії
        side = tk.Frame(root, bg=SIDEBAR, width=185)
        side.pack(side="left", fill="y")
        side.pack_propagate(False)
        tk.Label(side, text="КАТЕГОРІЇ", bg=SIDEBAR, fg=MUTED, anchor="w",
                 font=(FONT, 8, "bold")).pack(fill="x", padx=14, pady=(14, 4))
        self.side_rows = tk.Frame(side, bg=SIDEBAR)
        self.side_rows.pack(fill="both", expand=True)
        add_cat = tk.Label(side, text="＋  Нова категорія", bg=SIDEBAR, fg=ACCENT, anchor="w",
                           cursor="hand2", padx=14, pady=10, font=(FONT, 10))
        add_cat.pack(side="bottom", fill="x")
        add_cat.bind("<Button-1>", lambda e: self.on_new_category())
        add_cat.bind("<Enter>", lambda e: add_cat.configure(bg=SIDE_HOVER))
        add_cat.bind("<Leave>", lambda e: add_cat.configure(bg=SIDEBAR))

        # права частина
        main = tk.Frame(root, bg=BG)
        main.pack(side="left", fill="both", expand=True)

        top = tk.Frame(main, bg=BG)
        top.pack(fill="x", padx=10, pady=(10, 4))
        box = tk.Frame(top, bg=CARD, highlightbackground=BORDER, highlightcolor=ACCENT, highlightthickness=1)
        box.pack(side="left", fill="x", expand=True)
        self.search_var = tk.StringVar()
        self.search = tk.Entry(box, textvariable=self.search_var, relief="flat", bg=CARD, font=(FONT, 11),
                               highlightthickness=0, insertbackground=TEXT)
        self.search.pack(fill="x", padx=8, pady=6)
        self.hint = tk.Label(box, text="Пошук…", bg=CARD, fg=MUTED, font=(FONT, 11))
        self.hint.place(x=10, y=6)
        self.hint.bind("<Button-1>", lambda e: self.search.focus_set())
        self.search_var.trace_add("write", lambda *_: self._on_search())
        self.add_btn = flat_button(top, "＋ Додати", self.on_add, primary=True)
        self.add_btn.pack(side="left", padx=(8, 0))
        self.gear = flat_button(top, "⚙", lambda: None)
        self.gear.configure(padx=9, font=(FONT, 12))
        self.gear.pack(side="left", padx=(6, 0))
        self.gear.bind("<Button-1>", self._popup_settings)

        self.title_lbl = tk.Label(main, text="", bg=BG, fg=MUTED, anchor="w", font=(FONT, 9))
        self.title_lbl.pack(fill="x", padx=14)

        self.status = tk.Label(main, text="", bg=BG, fg=MUTED, anchor="w", font=(FONT, 9))
        self.status.pack(side="bottom", fill="x", padx=12, pady=5)

        wrap = tk.Frame(main, bg=BG)
        wrap.pack(fill="both", expand=True, padx=(4, 0), pady=(2, 0))
        self.canvas = tk.Canvas(wrap, bg=BG, highlightthickness=0)
        scroll = ttk.Scrollbar(wrap, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)
        self.inner = tk.Frame(self.canvas, bg=BG)
        self.inner_id = self.canvas.create_window((0, 0), window=self.inner, anchor="nw")
        self.inner.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", self._on_canvas_resize)
        root.bind_all("<MouseWheel>", self._on_wheel)
        root.bind_all("<Button-4>", lambda e: self.canvas.yview_scroll(-3, "units"))
        root.bind_all("<Button-5>", lambda e: self.canvas.yview_scroll(3, "units"))

        # клавіатура
        root.bind("<Down>", lambda e: self._move_sel(1))
        root.bind("<Up>", lambda e: self._move_sel(-1))
        root.bind("<Return>", lambda e: self.copy_item(self.sel_id) if self.sel_id else None)
        root.bind("<Escape>", self._on_escape)
        root.bind("<Delete>", self._on_delete_key)
        root.bind("<Control-n>", lambda e: self.on_add())
        root.bind("<Control-f>", lambda e: (self.search.focus_set(), self.search.select_range(0, "end")))

        # меню налаштувань
        self.v_paused = tk.BooleanVar(value=self.settings["paused"])
        self.v_topmost = tk.BooleanVar(value=self.settings["topmost"])
        self.v_autohide = tk.BooleanVar(value=self.settings["autohide"])
        self.v_hotkey = tk.StringVar(value=self.settings["hotkey"])
        self.settings_menu = tk.Menu(root, tearoff=0)
        m = self.settings_menu
        m.add_checkbutton(label="Пауза запису буфера", variable=self.v_paused, command=self._on_pause)
        m.add_checkbutton(label="Завжди зверху", variable=self.v_topmost, command=self._on_topmost)
        m.add_checkbutton(label="Ховати вікно після копіювання (при виклику гарячою клавішею)",
                          variable=self.v_autohide,
                          command=lambda: self.settings.__setitem__("autohide", self.v_autohide.get()))
        hot = tk.Menu(m, tearoff=0)
        for spec, label in HOTKEY_PRESETS:
            hot.add_radiobutton(label=label, value=spec, variable=self.v_hotkey, command=self._on_hotkey_choice)
        m.add_cascade(label="Гаряча клавіша", menu=hot)
        m.add_separator()
        m.add_command(label="Очистити історію (крім закріплених і категорій)", command=self.on_clear)
        m.add_command(label="Вийти з програми", command=self.quit)

        self.menu = tk.Menu(root, tearoff=0)

    def _on_canvas_resize(self, event: tk.Event) -> None:
        self.canvas.itemconfigure(self.inner_id, width=event.width)
        for lbl in self._wrap_labels:
            lbl.configure(wraplength=max(120, event.width - 150))

    def _on_root_configure(self, event: tk.Event) -> None:
        if event.widget is self.root and self.root.state() == "normal":
            self._size = (event.width, event.height)

    def _on_wheel(self, event: tk.Event) -> None:
        step = -event.delta if sys.platform == "darwin" else (-3 if event.delta > 0 else 3)
        self.canvas.yview_scroll(step, "units")

    # -- відображення -----------------------------------------------------
    def render(self, scroll_top: bool = False) -> None:
        self.render_sidebar()
        self.render_list(scroll_top)

    def render_sidebar(self) -> None:
        for w in self.side_rows.winfo_children():
            w.destroy()
        self._side_targets.clear()
        self._side_rows.clear()
        self._side_row(ALL, "Усі", "#8a8a8a", self.store.count(ALL), droppable=False)
        self._side_row(UNCAT, "Без категорії", "#b5b5b5", self.store.count(UNCAT))
        for c in self.store.categories:
            self._side_row(c["id"], c["name"], c["color"], self.store.count(c["id"]), real=True)

    def _side_row(self, key: str, name: str, color: str, count: int, droppable: bool = True, real: bool = False) -> None:
        selected = key == self.view_cat
        bg = SIDE_SEL if selected else SIDEBAR
        row = tk.Frame(self.side_rows, bg=bg, cursor="hand2")
        row.pack(fill="x", padx=6, pady=1)
        dot = tk.Label(row, text="●", fg=color, bg=bg, font=(FONT, 9))
        dot.pack(side="left", padx=(8, 4), pady=6)
        label = tk.Label(row, text=name, bg=bg, fg=TEXT, anchor="w", font=(FONT, 10, "bold" if selected else "normal"))
        label.pack(side="left", fill="x", expand=True)
        num = tk.Label(row, text=str(count), bg=bg, fg=MUTED, font=(FONT, 9))
        num.pack(side="right", padx=8)
        parts = [row, dot, label, num]
        self._side_rows[key] = row
        for w in parts:
            w.bind("<Button-1>", lambda e, k=key: self.select_category(k))
            if droppable:
                self._side_targets[w] = key
            if real:
                w.bind("<Button-3>", lambda e, k=key: self.show_category_menu(e, k))
            if not selected:
                w.bind("<Enter>", lambda e, p=parts: [x.configure(bg=SIDE_HOVER) for x in p])
                w.bind("<Leave>", lambda e, p=parts: [x.configure(bg=SIDEBAR) for x in p])

    def render_list(self, scroll_top: bool = False) -> None:
        y = self.canvas.yview()[0]
        for w in self.inner.winfo_children():
            w.destroy()
        self._wrap_labels, self._cards, self._tints = [], {}, {}
        query = self.search_var.get()
        self.shown = self.store.view(query, self.view_cat)
        if self.sel_id not in {i["id"] for i in self.shown}:
            self.sel_id = self.shown[0]["id"] if self.shown else None

        name = {ALL: "Усі записи", UNCAT: "Без категорії"}.get(self.view_cat) or \
            (self.store.category(self.view_cat) or {"name": ""})["name"]
        self.title_lbl.configure(text=f"{name} · {len(self.shown)}")

        if not self.shown:
            if query.strip():
                msg = "Нічого не знайдено."
            elif self.view_cat in (ALL, UNCAT):
                msg = ("Тут порожньо.\nСкопіюйте будь-який текст — він з'явиться тут,\n"
                       "або додайте власний шматок кнопкою «Додати».")
            else:
                msg = ("У цій категорії ще нічого немає.\nПеретягніть сюди запис мишею\n"
                       "або натисніть «Додати».")
            tk.Label(self.inner, text=msg, bg=BG, fg=MUTED, pady=40, font=(FONT, 10)).pack(fill="x")
        for it in self.shown:
            self._make_card(it)
        self.inner.update_idletasks()
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        self.canvas.yview_moveto(0 if scroll_top else y)
        self._highlight_selection()

    def _make_card(self, it: dict) -> None:
        iid = it["id"]
        cat = self.store.category(it["category"])
        card = tk.Frame(self.inner, bg=CARD, highlightbackground=BORDER, highlightthickness=1, cursor="hand2")
        card.pack(fill="x", padx=8, pady=3)
        card.columnconfigure(1, weight=1)
        strip = tk.Frame(card, bg=cat["color"] if cat else CARD, width=4)
        strip.grid(row=0, column=0, rowspan=2, sticky="ns")

        body = tk.Label(card, text=preview(it["text"]), bg=CARD, fg=TEXT, anchor="w", justify="left",
                        font=(FONT, 10), wraplength=max(120, self.canvas.winfo_width() - 150))
        body.grid(row=0, column=1, sticky="we", padx=(8, 4), pady=(6, 0))
        self._wrap_labels.append(body)

        meta = tk.Frame(card, bg=CARD)
        meta.grid(row=1, column=1, sticky="we", padx=(8, 4), pady=(0, 6))
        when = time.strftime("%d.%m %H:%M", time.localtime(it["ts"]))
        m1 = tk.Label(meta, text=f"{when} · {len(it['text'])} симв.", bg=CARD, fg=MUTED, font=(FONT, 8))
        m1.pack(side="left")
        clickable = [card, body, meta, m1]
        if cat and self.view_cat == ALL:
            chip = tk.Label(meta, text=f"  ●  {cat['name']}", bg=CARD, fg=cat["color"], font=(FONT, 8))
            chip.pack(side="left")
            clickable.append(chip)

        btns = tk.Frame(card, bg=CARD)
        btns.grid(row=0, column=2, rowspan=2, padx=(0, 6))
        pin = tk.Label(btns, text="★" if it["pinned"] else "☆", bg=CARD, cursor="hand2",
                       fg=GOLD if it["pinned"] else MUTED, font=(FONT, 13))
        more = tk.Label(btns, text="⋯", bg=CARD, cursor="hand2", fg=MUTED, font=(FONT, 13, "bold"))
        dele = tk.Label(btns, text="✕", bg=CARD, cursor="hand2", fg=MUTED, font=(FONT, 11))
        for w in (pin, more, dele):
            w.pack(side="left", padx=3)
        pin.bind("<Button-1>", lambda e: self.on_pin(iid))
        more.bind("<Button-1>", lambda e: self.show_menu(e, iid))
        dele.bind("<Button-1>", lambda e: self.on_delete(iid))
        dele.bind("<Enter>", lambda e: dele.configure(fg=DANGER), add="+")
        dele.bind("<Leave>", lambda e: dele.configure(fg=MUTED), add="+")
        tints = clickable + [btns, pin, more, dele]

        for w in clickable:
            w.bind("<ButtonPress-1>", lambda e, i=iid: self._drag_press(e, i))
            w.bind("<B1-Motion>", self._drag_motion)
            w.bind("<ButtonRelease-1>", self._drag_release)
            w.bind("<Button-3>", lambda e, i=iid: self.show_menu(e, i))
        for w in tints:
            w.bind("<Enter>", lambda e, i=iid: self._tint(i, CARD_HOVER), add="+")
            w.bind("<Leave>", lambda e, i=iid: self._tint(i, CARD), add="+")
        self._cards[iid] = card
        self._tints[iid] = tints

    def _tint(self, iid: str, color: str) -> None:
        for w in self._tints.get(iid, []):
            try:
                w.configure(bg=color)
            except tk.TclError:
                pass

    # -- вибір і клавіатура -------------------------------------------------
    def _highlight_selection(self) -> None:
        for iid, card in self._cards.items():
            card.configure(highlightbackground=ACCENT if iid == self.sel_id else BORDER)

    def _move_sel(self, delta: int) -> str:
        if not self.shown:
            return "break"
        ids = [i["id"] for i in self.shown]
        idx = ids.index(self.sel_id) if self.sel_id in ids else -1
        self.sel_id = ids[max(0, min(len(ids) - 1, idx + delta))]
        self._highlight_selection()
        self._ensure_visible(self._cards[self.sel_id])
        return "break"

    def _ensure_visible(self, card: tk.Frame) -> None:
        self.inner.update_idletasks()
        top, bottom = card.winfo_y(), card.winfo_y() + card.winfo_height()
        total, view = max(1, self.inner.winfo_height()), self.canvas.winfo_height()
        y0 = self.canvas.canvasy(0)
        if top < y0:
            self.canvas.yview_moveto(max(0, (top - 4) / total))
        elif bottom > y0 + view:
            self.canvas.yview_moveto(min(1, (bottom + 4 - view) / total))

    def _on_escape(self, event: tk.Event) -> None:
        if self.search_var.get():
            self.search_var.set("")
        elif self._can_hide():
            self.hide_window()
        else:
            self.root.iconify()

    def _on_delete_key(self, event: tk.Event):
        if isinstance(event.widget, (tk.Entry, tk.Text)) or not self.sel_id:
            return None
        self.on_delete(self.sel_id)

    def _on_search(self) -> None:
        self.hint.place_forget() if self.search_var.get() else self.hint.place(x=10, y=6)
        self.sel_id = None
        self.render_list(scroll_top=True)

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
            item = self.store.find(d["id"])
            ghost = tk.Toplevel(self.root)
            ghost.overrideredirect(True)
            ghost.attributes("-topmost", True)
            tk.Label(ghost, text=preview(item["text"] if item else "", 2, 60), bg=ACCENT, fg="#fff",
                     justify="left", padx=10, pady=5, font=(FONT, 9)).pack()
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
            self.assign_category(d["id"], None if target == UNCAT else target)

    def _target_at(self, x: int, y: int) -> str | None:
        w = self.root.winfo_containing(x, y)
        return self._side_targets.get(w) if w else None

    def _mark_target(self, key: str | None, on: bool) -> None:
        row = self._side_rows.get(key) if key else None
        if not row:
            return
        color = "#b9d7f2" if on else (SIDE_SEL if key == self.view_cat else SIDEBAR)
        for w in [row, *row.winfo_children()]:
            w.configure(bg=color)

    # -- дії над записами -----------------------------------------------------
    def copy_to_clipboard(self, text: str) -> None:
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        self.root.update()  # щоб Windows одразу отримала дані
        self._last_seen = text

    def copy_item(self, item_id: str | None) -> None:
        item = self.store.find(item_id) if item_id else None
        if not item:
            return
        self.copy_to_clipboard(item["text"])
        self.store.bump(item_id)
        self.render(scroll_top=self.view_cat in (ALL, UNCAT))
        self.set_status("✓ Скопійовано: " + preview(item["text"], 1, 50).replace("\n", " "))
        if self._popup and self.settings["autohide"]:
            self.hide_window()

    def assign_category(self, item_id: str, cat_id: str | None) -> None:
        if self.store.set_category(item_id, cat_id):
            cat = self.store.category(cat_id)
            self.render()
            self.set_status(f"✓ Переміщено в «{cat['name']}»" if cat else "✓ Прибрано з категорії")

    def on_pin(self, item_id: str) -> None:
        self.store.toggle_pin(item_id)
        self.render()

    def on_delete(self, item_id: str) -> None:
        self.store.remove(item_id)
        self.render()

    def on_add(self) -> None:
        cat = self.view_cat if self.store.category(self.view_cat) else None
        result = SnippetDialog(self, "Новий запис", "", cat).run()
        if result:
            text, cat_id = result
            item = self.store.add(text, pinned=cat_id is None, category=cat_id)  # без категорії → закріплюємо
            if item:
                self.sel_id = item["id"]
                self.render(scroll_top=True)
                self.set_status("✓ Додано")

    def on_edit(self, item_id: str) -> None:
        item = self.store.find(item_id)
        if not item:
            return
        result = SnippetDialog(self, "Редагування", item["text"], item["category"]).run()
        if result and self.store.update(item_id, result[0], result[1]):
            self.render()
            self.set_status("✓ Запис оновлено")

    def on_clear(self) -> None:
        if messagebox.askyesno(APP_NAME, "Видалити історію?\nЗакріплені записи та записи в категоріях залишаться.",
                               parent=self.root):
            self.store.clear_history()
            self.render(scroll_top=True)

    # -- категорії ----------------------------------------------------------
    def select_category(self, key: str) -> None:
        self.view_cat = key
        self.sel_id = None
        self.render(scroll_top=True)

    def on_new_category(self, then_assign: str | None = None) -> None:
        name = TextDialog(self, "Нова категорія", "Назва категорії:").run()
        if name is None:
            return
        cat = self.store.add_category(name)
        if not cat:
            messagebox.showinfo(APP_NAME, "Порожня назва або така категорія вже існує.", parent=self.root)
            return
        if then_assign:
            self.store.set_category(then_assign, cat["id"])
        self.view_cat = cat["id"]
        self.render(scroll_top=True)

    def on_rename_category(self, cat_id: str) -> None:
        cat = self.store.category(cat_id)
        if not cat:
            return
        name = TextDialog(self, "Перейменування", "Нова назва:", cat["name"]).run()
        if name is not None and not self.store.rename_category(cat_id, name):
            messagebox.showinfo(APP_NAME, "Порожня назва або така категорія вже існує.", parent=self.root)
        self.render()

    def on_delete_category(self, cat_id: str) -> None:
        cat = self.store.category(cat_id)
        if cat and messagebox.askyesno(
                APP_NAME, f"Видалити категорію «{cat['name']}»?\nЗаписи не видаляться — вони стануть «Без категорії».",
                parent=self.root):
            self.store.delete_category(cat_id)
            if self.view_cat == cat_id:
                self.view_cat = ALL
            self.render(scroll_top=True)

    def show_category_menu(self, event: tk.Event, cat_id: str) -> None:
        m = self.menu
        m.delete(0, "end")
        m.add_command(label="Перейменувати", command=lambda: self.on_rename_category(cat_id))
        m.add_command(label="Видалити категорію", command=lambda: self.on_delete_category(cat_id))
        m.tk_popup(event.x_root, event.y_root)

    def show_menu(self, event: tk.Event, item_id: str) -> None:
        item = self.store.find(item_id)
        if not item:
            return
        self.sel_id = item_id
        self._highlight_selection()
        m = self.menu
        m.delete(0, "end")
        m.add_command(label="Копіювати", command=lambda: self.copy_item(item_id))
        m.add_command(label="Відкріпити" if item["pinned"] else "Закріпити", command=lambda: self.on_pin(item_id))
        move = tk.Menu(m, tearoff=0)
        cur = item["category"]
        move.add_command(label=("✓ " if not cur else "    ") + "Без категорії",
                         command=lambda: self.assign_category(item_id, None))
        for c in self.store.categories:
            move.add_command(label=("✓ " if cur == c["id"] else "    ") + c["name"],
                             command=lambda cid=c["id"]: self.assign_category(item_id, cid))
        move.add_separator()
        move.add_command(label="＋ Нова категорія…", command=lambda: self.on_new_category(then_assign=item_id))
        m.add_cascade(label="Перемістити в категорію", menu=move)
        m.add_command(label="Редагувати…", command=lambda: self.on_edit(item_id))
        m.add_separator()
        m.add_command(label="Видалити", command=lambda: self.on_delete(item_id))
        m.tk_popup(event.x_root, event.y_root)

    # -- налаштування ---------------------------------------------------------
    def _popup_settings(self, event: tk.Event) -> None:
        self.settings_menu.tk_popup(self.gear.winfo_rootx(), self.gear.winfo_rooty() + self.gear.winfo_height())

    def _on_pause(self) -> None:
        self.settings["paused"] = self.v_paused.get()
        self.set_status("Запис буфера призупинено" if self.v_paused.get() else "Запис буфера відновлено")

    def _on_topmost(self) -> None:
        self.settings["topmost"] = self.v_topmost.get()
        self.root.attributes("-topmost", self.v_topmost.get())

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

    def show_window(self, near_cursor: bool = False, popup: bool = False) -> None:
        if near_cursor:
            self._place_near_cursor()
        self.root.deiconify()
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(200, lambda: self.root.attributes("-topmost", self.settings["topmost"]))
        self.root.focus_force()
        self._popup = popup
        self.search_var.set("")
        self.sel_id = None
        self.render_list(scroll_top=True)
        self.search.focus_set()

    def hide_window(self) -> None:
        self._save_size()
        self.root.withdraw()
        self._popup = False

    def toggle_window(self) -> None:
        if self._modal:
            return
        if self.root.state() == "normal" and self.root.focus_displayof() is not None:
            self.hide_window()
        else:
            self.show_window(near_cursor=True, popup=True)

    def _place_near_cursor(self) -> None:
        w, h = getattr(self, "_size", (self.settings["width"], self.settings["height"]))
        px, py = self.root.winfo_pointerxy()
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        x = max(0, min(px - w // 2, sw - w))
        y = max(0, min(py - 40, sh - h - 50))
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _save_size(self) -> None:
        size = getattr(self, "_size", None)
        if size and size[0] > 100 and size[1] > 100:
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
    def _tick(self) -> None:
        try:
            while True:
                ev = self.events.get_nowait()
                if ev == "toggle":
                    self.toggle_window()
                elif ev == "show":
                    self.show_window(popup=True)
                elif ev == "quit":
                    self.quit()
                    return
        except queue.Empty:
            pass

        if not self.settings["paused"]:
            try:
                text = self.root.clipboard_get()
            except tk.TclError:
                text = None  # порожній буфер або не текст (картинка, файли)
            if text and text != self._last_seen:
                self._last_seen = text
                if self.store.add(text):
                    self.sel_id = None
                    self.render(scroll_top=self.view_cat in (ALL, UNCAT))
        self.root.after(POLL_MS, self._tick)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--data", default=default_data_path(), help="файл історії (JSON)")
    parser.add_argument("--no-hotkey", action="store_true", help="не реєструвати глобальну гарячу клавішу")
    parser.add_argument("--no-tray", action="store_true", help="не показувати іконку в треї")
    parser.add_argument("--minimized", action="store_true", help="запуститись одразу у фоні (без вікна)")
    args = parser.parse_args(argv)

    enable_dpi_awareness()
    events: "queue.Queue[str]" = queue.Queue()
    lock = acquire_single_instance(lambda: events.put("show"))
    if lock is None:
        return 0  # вже працює інша копія — вона щойно показала своє вікно

    settings = Settings(os.path.join(os.path.dirname(os.path.abspath(args.data)), "settings.json"))
    root = tk.Tk()
    App(root, Store(args.data), settings, events,
        use_hotkey=not args.no_hotkey, use_tray=not args.no_tray, start_hidden=args.minimized)
    root.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
