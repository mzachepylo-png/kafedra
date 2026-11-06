#!/usr/bin/env python3
"""Менеджер буфера обміну з пам'яттю — аналог Win+V.

* Автоматично запам'ятовує весь скопійований текст.
* Дозволяє вручну додавати власні шматки тексту (вони закріплюються).
* Клік по запису — текст одразу копіюється в буфер обміну.
* Історія зберігається на диск і переживає перезапуск програми.

Лише стандартна бібліотека Python (tkinter). Запуск:  python clipboard_manager.py
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import sys
import threading
import time
import tkinter as tk
import uuid
from tkinter import messagebox, ttk

APP_NAME = "Буфер обміну — пам'ять"
MAX_HISTORY = 300        # скільки НЕзакріплених записів тримати
MAX_CHARS = 100_000      # довші тексти пропускаємо
POLL_MS = 400            # як часто опитувати буфер обміну
HOTKEY_LABEL = "Ctrl+Alt+V"


# --------------------------------------------------------------------------- #
#  Сховище (без GUI — легко тестується)
# --------------------------------------------------------------------------- #

def default_data_path() -> str:
    override = os.environ.get("CLIPBOARD_MEMORY_FILE")
    if override:
        return override
    if os.name == "nt":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, "ClipboardMemory", "history.json")
    base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    return os.path.join(base, "clipboard-memory", "history.json")


class Store:
    """Список записів {id, text, pinned, ts}; найновіші — на початку."""

    def __init__(self, path: str, max_history: int = MAX_HISTORY):
        self.path = path
        self.max_history = max_history
        self.items: list[dict] = []
        self.load()

    # -- збереження ---------------------------------------------------------
    def load(self) -> None:
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            raw = data["items"] if isinstance(data, dict) else data
            self.items = [
                {
                    "id": str(i.get("id") or uuid.uuid4().hex),
                    "text": i["text"],
                    "pinned": bool(i.get("pinned", False)),
                    "ts": float(i.get("ts", time.time())),
                }
                for i in raw
                if isinstance(i, dict) and isinstance(i.get("text"), str)
            ]
        except FileNotFoundError:
            self.items = []
        except (ValueError, KeyError, TypeError, OSError):
            # пошкоджений файл — не губимо його, а відкладаємо вбік
            try:
                os.replace(self.path, self.path + ".bak")
            except OSError:
                pass
            self.items = []

    def save(self) -> None:
        folder = os.path.dirname(self.path)
        if folder:
            os.makedirs(folder, exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"version": 1, "items": self.items}, f, ensure_ascii=False, indent=1)
        if os.name != "nt":
            os.chmod(tmp, 0o600)  # в історії може бути щось приватне
        os.replace(tmp, self.path)

    # -- операції -----------------------------------------------------------
    def find(self, item_id: str) -> dict | None:
        return next((i for i in self.items if i["id"] == item_id), None)

    def add(self, text: str, pinned: bool = False) -> dict | None:
        """Додає запис. Якщо такий текст уже є — піднімає його вгору."""
        if not text or not text.strip() or len(text) > MAX_CHARS:
            return None
        existing = next((i for i in self.items if i["text"] == text), None)
        if existing:
            self.items.remove(existing)
            existing["ts"] = time.time()
            existing["pinned"] = existing["pinned"] or pinned
            item = existing
        else:
            item = {"id": uuid.uuid4().hex, "text": text, "pinned": pinned, "ts": time.time()}
        self.items.insert(0, item)
        self._trim()
        self.save()
        return item

    def bump(self, item_id: str) -> None:
        item = self.find(item_id)
        if item:
            self.items.remove(item)
            item["ts"] = time.time()
            self.items.insert(0, item)
            self.save()

    def update(self, item_id: str, text: str) -> bool:
        item = self.find(item_id)
        if not item or not text.strip() or len(text) > MAX_CHARS:
            return False
        item["text"] = text
        item["ts"] = time.time()
        self.items.remove(item)
        self.items.insert(0, item)
        self.save()
        return True

    def toggle_pin(self, item_id: str) -> None:
        item = self.find(item_id)
        if item:
            item["pinned"] = not item["pinned"]
            self._trim()
            self.save()

    def remove(self, item_id: str) -> None:
        self.items = [i for i in self.items if i["id"] != item_id]
        self.save()

    def clear_unpinned(self) -> None:
        self.items = [i for i in self.items if i["pinned"]]
        self.save()

    def view(self, query: str = "") -> list[dict]:
        """Закріплені зверху, далі за давністю; з фільтром пошуку."""
        q = query.strip().lower()
        found = [i for i in self.items if not q or q in i["text"].lower()]
        return sorted(found, key=lambda i: not i["pinned"])  # стабільне сортування

    def _trim(self) -> None:
        unpinned = [i for i in self.items if not i["pinned"]]
        for extra in unpinned[self.max_history:]:
            self.items.remove(extra)


# --------------------------------------------------------------------------- #
#  Глобальна гаряча клавіша (лише Windows)
# --------------------------------------------------------------------------- #

def start_hotkey_listener(events: "queue.Queue[str]") -> bool:
    """Реєструє Ctrl+Alt+V. (Win+V зарезервована самою Windows.)"""
    if os.name != "nt":
        return False
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    registered = threading.Event()
    ok = {"value": False}

    def worker() -> None:
        MOD_ALT, MOD_CONTROL, MOD_NOREPEAT = 0x1, 0x2, 0x4000
        WM_HOTKEY, VK_V = 0x0312, 0x56
        ok["value"] = bool(user32.RegisterHotKey(None, 1, MOD_ALT | MOD_CONTROL | MOD_NOREPEAT, VK_V))
        registered.set()
        if not ok["value"]:
            return
        msg = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            if msg.message == WM_HOTKEY:
                events.put("show")

    threading.Thread(target=worker, daemon=True).start()
    registered.wait(2)
    return ok["value"]


# --------------------------------------------------------------------------- #
#  Інтерфейс
# --------------------------------------------------------------------------- #

BG = "#f3f3f3"
CARD = "#ffffff"
CARD_HOVER = "#e8f1fb"
CARD_COPIED = "#d9f2dc"
BORDER = "#d0d0d0"
MUTED = "#707070"
ACCENT = "#0067c0"


def preview(text: str, max_lines: int = 4, max_chars: int = 260) -> str:
    lines = text.strip().splitlines()
    shown = "\n".join(lines[:max_lines])
    cut = len(lines) > max_lines
    if len(shown) > max_chars:
        shown, cut = shown[:max_chars], True
    return shown + (" …" if cut else "")


class App:
    def __init__(self, root: tk.Tk, store: Store, hotkey: bool = True):
        self.root = root
        self.store = store
        self.events: "queue.Queue[str]" = queue.Queue()
        self.editing_id: str | None = None
        self._last_seen: str | None = None
        self._status_job: str | None = None
        self._wrap_labels: list[tk.Label] = []

        root.title(APP_NAME)
        root.geometry("400x620")
        root.minsize(320, 360)
        root.configure(bg=BG)

        self._build_ui()
        self.render()

        self.hotkey_ok = hotkey and start_hotkey_listener(self.events)
        if self.hotkey_ok:
            self.set_status(f"Гаряча клавіша {HOTKEY_LABEL} показує вікно")
        self._tick()

    # -- побудова вікна -----------------------------------------------------
    def _build_ui(self) -> None:
        root = self.root

        # редактор нового запису
        editor = tk.Frame(root, bg=BG)
        editor.pack(fill="x", padx=8, pady=(8, 4))
        self.editor_label = tk.Label(editor, text="Новий шматок тексту", bg=BG, fg=MUTED, anchor="w")
        self.editor_label.pack(fill="x")
        self.text_in = tk.Text(editor, height=3, wrap="word", relief="solid", bd=1, font=("Segoe UI", 10))
        self.text_in.pack(fill="x", pady=(2, 4))
        self.text_in.bind("<Control-Return>", lambda e: (self.on_save(), "break")[1])
        self.text_in.bind("<Control-a>", lambda e: (self.text_in.tag_add("sel", "1.0", "end-1c"), "break")[1])
        row = tk.Frame(editor, bg=BG)
        row.pack(fill="x")
        self.save_btn = ttk.Button(row, text="Додати (Ctrl+Enter)", command=self.on_save)
        self.save_btn.pack(side="left")
        self.cancel_btn = ttk.Button(row, text="Скасувати", command=self.cancel_edit)
        self.cancel_btn.pack(side="left", padx=6)

        # пошук і налаштування
        bar = tk.Frame(root, bg=BG)
        bar.pack(fill="x", padx=8, pady=(6, 2))
        tk.Label(bar, text="Пошук:", bg=BG).pack(side="left")
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self.render())
        ttk.Entry(bar, textvariable=self.search_var).pack(side="left", fill="x", expand=True, padx=6)
        ttk.Button(bar, text="Очистити історію", command=self.on_clear).pack(side="right")

        opts = tk.Frame(root, bg=BG)
        opts.pack(fill="x", padx=8)
        self.paused = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts, text="Пауза запису", variable=self.paused,
                        command=self._on_pause).pack(side="left")
        self.topmost = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts, text="Завжди зверху", variable=self.topmost,
                        command=lambda: root.attributes("-topmost", self.topmost.get())).pack(side="left", padx=12)

        # статус
        self.status = tk.Label(root, text="", bg=BG, fg=MUTED, anchor="w")
        self.status.pack(side="bottom", fill="x", padx=8, pady=4)

        # прокручуваний список
        wrap = tk.Frame(root, bg=BG)
        wrap.pack(fill="both", expand=True, padx=2, pady=4)
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

        self.menu = tk.Menu(root, tearoff=0)
        self._update_editor_state()

    def _on_canvas_resize(self, event: tk.Event) -> None:
        self.canvas.itemconfigure(self.inner_id, width=event.width)
        for lbl in self._wrap_labels:
            lbl.configure(wraplength=max(120, event.width - 70))

    def _on_wheel(self, event: tk.Event) -> None:
        if sys.platform == "darwin":
            step = -event.delta
        else:
            step = -3 if event.delta > 0 else 3
        self.canvas.yview_scroll(step, "units")

    # -- відображення списку -----------------------------------------------
    def render(self, scroll_top: bool = False) -> None:
        y = self.canvas.yview()[0]
        for w in self.inner.winfo_children():
            w.destroy()
        self._wrap_labels = []
        items = self.store.view(self.search_var.get())
        if not items:
            msg = "Нічого не знайдено." if self.search_var.get().strip() else (
                "Історія порожня.\nСкопіюйте будь-який текст — він з'явиться тут,\n"
                "або додайте власний шматок у полі зверху.")
            tk.Label(self.inner, text=msg, bg=BG, fg=MUTED, pady=30).pack(fill="x")
        for it in items:
            self._make_card(it)
        self.inner.update_idletasks()
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        self.canvas.yview_moveto(0 if scroll_top else y)

    def _make_card(self, it: dict) -> None:
        card = tk.Frame(self.inner, bg=CARD, highlightbackground=BORDER, highlightthickness=1,
                        padx=8, pady=5, cursor="hand2")
        card.pack(fill="x", padx=6, pady=3)
        card.columnconfigure(0, weight=1)

        body = tk.Label(card, text=preview(it["text"]), bg=CARD, anchor="w", justify="left",
                        font=("Segoe UI", 10), wraplength=max(120, self.canvas.winfo_width() - 70))
        body.grid(row=0, column=0, sticky="we")
        self._wrap_labels.append(body)
        when = time.strftime("%d.%m %H:%M", time.localtime(it["ts"]))
        meta = tk.Label(card, text=f"{when} · {len(it['text'])} симв.", bg=CARD, fg=MUTED,
                        anchor="w", font=("Segoe UI", 8))
        meta.grid(row=1, column=0, sticky="we")

        pin = tk.Label(card, text="★" if it["pinned"] else "☆", bg=CARD, cursor="hand2",
                       fg="#d89b00" if it["pinned"] else MUTED, font=("Segoe UI", 13))
        pin.grid(row=0, column=1, padx=(6, 0))
        pin.bind("<Button-1>", lambda e, i=it["id"]: self.on_pin(i))
        dele = tk.Label(card, text="✕", bg=CARD, cursor="hand2", fg=MUTED, font=("Segoe UI", 11))
        dele.grid(row=1, column=1, padx=(6, 0))
        dele.bind("<Button-1>", lambda e, i=it["id"]: self.on_delete(i))
        dele.bind("<Enter>", lambda e, w=dele: w.configure(fg="#c42b1c"))
        dele.bind("<Leave>", lambda e, w=dele: w.configure(fg=MUTED))

        widgets = [card, body, meta]
        for w in widgets:
            w.bind("<Button-1>", lambda e, i=it["id"], c=card: self.on_copy(i, c))
            w.bind("<Button-3>", lambda e, i=it["id"]: self.show_menu(e, i))
            w.bind("<Button-2>", lambda e, i=it["id"]: self.show_menu(e, i))  # macOS
        for w in widgets + [pin, dele]:
            w.bind("<Enter>", lambda e, c=card: self._tint(c, CARD_HOVER), add="+")
            w.bind("<Leave>", lambda e, c=card: self._tint(c, CARD), add="+")
        pin.bind("<Button-3>", lambda e, i=it["id"]: self.show_menu(e, i))

    def _tint(self, card: tk.Frame, color: str) -> None:
        try:
            for w in [card, *card.winfo_children()]:
                w.configure(bg=color)
        except tk.TclError:
            pass  # картку вже перебудовано

    # -- дії ----------------------------------------------------------------
    def copy_to_clipboard(self, text: str) -> None:
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        self.root.update()  # щоб Windows одразу отримала дані
        self._last_seen = text

    def on_copy(self, item_id: str, card: tk.Frame | None = None) -> None:
        item = self.store.find(item_id)
        if not item:
            return
        self.copy_to_clipboard(item["text"])
        self.store.bump(item_id)
        self.render(scroll_top=True)
        self.set_status("✓ Скопійовано в буфер обміну: " + preview(item["text"], 1, 40).replace("\n", " "))

    def on_pin(self, item_id: str) -> None:
        self.store.toggle_pin(item_id)
        self.render()

    def on_delete(self, item_id: str) -> None:
        self.store.remove(item_id)
        if self.editing_id == item_id:
            self.cancel_edit()
        self.render()

    def on_clear(self) -> None:
        if messagebox.askyesno(APP_NAME, "Видалити всю історію?\nЗакріплені записи залишаться.", parent=self.root):
            self.store.clear_unpinned()
            self.render(scroll_top=True)

    def on_save(self) -> None:
        text = self.text_in.get("1.0", "end-1c")
        if not text.strip():
            return
        if self.editing_id:
            if self.store.update(self.editing_id, text):
                self.set_status("✓ Запис оновлено")
        else:
            if self.store.add(text, pinned=True):  # власні шматки закріплюємо
                self.set_status("✓ Додано і закріплено")
        self.cancel_edit()
        self.render(scroll_top=True)

    def start_edit(self, item_id: str) -> None:
        item = self.store.find(item_id)
        if not item:
            return
        self.editing_id = item_id
        self.text_in.delete("1.0", "end")
        self.text_in.insert("1.0", item["text"])
        self.text_in.focus_set()
        self._update_editor_state()

    def cancel_edit(self) -> None:
        self.editing_id = None
        self.text_in.delete("1.0", "end")
        self._update_editor_state()

    def _update_editor_state(self) -> None:
        if self.editing_id:
            self.editor_label.configure(text="Редагування запису", fg=ACCENT)
            self.save_btn.configure(text="Зберегти (Ctrl+Enter)")
            self.cancel_btn.state(["!disabled"])
        else:
            self.editor_label.configure(text="Новий шматок тексту", fg=MUTED)
            self.save_btn.configure(text="Додати (Ctrl+Enter)")
            self.cancel_btn.state(["disabled"])

    def show_menu(self, event: tk.Event, item_id: str) -> None:
        item = self.store.find(item_id)
        if not item:
            return
        self.menu.delete(0, "end")
        self.menu.add_command(label="Копіювати", command=lambda: self.on_copy(item_id))
        self.menu.add_command(label="Відкріпити" if item["pinned"] else "Закріпити",
                              command=lambda: self.on_pin(item_id))
        self.menu.add_command(label="Редагувати", command=lambda: self.start_edit(item_id))
        self.menu.add_separator()
        self.menu.add_command(label="Видалити", command=lambda: self.on_delete(item_id))
        self.menu.tk_popup(event.x_root, event.y_root)

    def _on_pause(self) -> None:
        self.set_status("Запис буфера призупинено" if self.paused.get() else "Запис буфера відновлено")

    def set_status(self, text: str) -> None:
        self.status.configure(text=text)
        if self._status_job:
            self.root.after_cancel(self._status_job)
        self._status_job = self.root.after(4000, lambda: self.status.configure(text=""))

    def show_window(self) -> None:
        self.root.deiconify()
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(150, lambda: self.root.attributes("-topmost", self.topmost.get()))
        self.root.focus_force()

    # -- фоновий цикл ---------------------------------------------------------
    def _tick(self) -> None:
        try:
            while True:
                if self.events.get_nowait() == "show":
                    self.show_window()
        except queue.Empty:
            pass

        if not self.paused.get():
            try:
                text = self.root.clipboard_get()
            except tk.TclError:
                text = None  # порожній буфер або не текст (картинка, файли)
            if text and text != self._last_seen:
                self._last_seen = text
                if self.store.add(text):
                    self.render(scroll_top=True)
        self.root.after(POLL_MS, self._tick)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--data", default=default_data_path(), help="файл історії (JSON)")
    parser.add_argument("--no-hotkey", action="store_true", help="не реєструвати глобальну гарячу клавішу")
    args = parser.parse_args(argv)

    root = tk.Tk()
    App(root, Store(args.data), hotkey=not args.no_hotkey)
    root.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
