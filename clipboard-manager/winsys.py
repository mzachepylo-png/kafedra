"""Системні можливості: глобальна гаряча клавіша (Windows), іконка в треї,
запуск лише однієї копії, DPI. Не імпортує tkinter."""

from __future__ import annotations

import os
import queue
import socket
import threading

APP_ID = "ClipboardMemory"
SINGLE_PORT = int(os.environ.get("CLIPBOARD_MEMORY_PORT", "47653"))

HOTKEY_PRESETS = [
    ("ctrl+x", "Ctrl+X  (перехоплює «Вирізати» в усіх програмах)"),
    ("ctrl+shift+x", "Ctrl+Shift+X"),
    ("ctrl+alt+v", "Ctrl+Alt+V"),
    ("off", "Вимкнено"),
]

_MODS = {"ctrl": 0x2, "alt": 0x1, "shift": 0x4, "win": 0x8}


def parse_hotkey(spec: str) -> tuple[int, int] | None:
    """'ctrl+shift+x' -> (модифікатори, віртуальний код клавіші). Для 'off' чи сміття — None."""
    parts = [p.strip().lower() for p in (spec or "").split("+") if p.strip()]
    if len(parts) < 2:
        return None
    key, mods = parts[-1], 0
    for m in parts[:-1]:
        if m not in _MODS:
            return None
        mods |= _MODS[m]
    if len(key) == 1 and key.isalnum() and key.isascii():
        return mods, ord(key.upper())  # VK_A..VK_Z і VK_0..VK_9 збігаються з ASCII
    return None


def hotkey_label(spec: str) -> str:
    return "+".join(p.capitalize() for p in spec.split("+")) if parse_hotkey(spec) else ""


def enable_dpi_awareness() -> None:
    """Щоб текст у вікні на Windows не був розмитий на екранах з масштабом."""
    if os.name != "nt":
        return
    import ctypes
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


class HotkeyListener:
    """Глобальна гаряча клавіша через RegisterHotKey. Події кладе в чергу як "toggle"."""

    def __init__(self, events: "queue.Queue[str]"):
        self.events = events
        self._thread: threading.Thread | None = None
        self._tid = 0

    def start(self, spec: str) -> bool:
        """(Пере)реєструє клавішу. False — якщо вимкнено, не Windows або клавішу вже зайнято."""
        self.stop()
        parsed = parse_hotkey(spec)
        if os.name != "nt" or not parsed:
            return False
        import ctypes
        from ctypes import wintypes

        user32, kernel32 = ctypes.windll.user32, ctypes.windll.kernel32
        mods, vk = parsed
        ready = threading.Event()
        state = {"ok": False, "tid": 0}

        def worker() -> None:
            MOD_NOREPEAT, WM_HOTKEY = 0x4000, 0x0312
            msg = wintypes.MSG()
            user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 0)  # створюємо чергу повідомлень потоку
            state["tid"] = kernel32.GetCurrentThreadId()
            state["ok"] = bool(user32.RegisterHotKey(None, 1, mods | MOD_NOREPEAT, vk))
            ready.set()
            if not state["ok"]:
                return
            while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
                if msg.message == WM_HOTKEY:
                    self.events.put("toggle")
            user32.UnregisterHotKey(None, 1)

        self._thread = threading.Thread(target=worker, daemon=True)
        self._thread.start()
        ready.wait(2)
        self._tid = state["tid"]
        return state["ok"]

    def stop(self) -> None:
        if self._thread and self._tid and os.name == "nt":
            import ctypes
            WM_QUIT = 0x0012
            ctypes.windll.user32.PostThreadMessageW(self._tid, WM_QUIT, 0, 0)
            self._thread.join(1)
        self._thread, self._tid = None, 0


def acquire_single_instance(on_show, port: int = SINGLE_PORT):
    """Повертає сокет-«замок», якщо ми перша копія. Якщо вже працює інша наша копія —
    просить її показати вікно й повертає None (поточну треба закрити)."""
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if os.name == "nt":
            srv.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        else:
            srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("127.0.0.1", port))
        srv.listen(5)
    except OSError:
        srv.close()
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.7) as c:
                c.sendall(b"show")
                if c.recv(2) == b"ok":
                    return None  # справді наша копія
        except OSError:
            pass
        return _NoLock()  # порт зайнятий чимось стороннім — працюємо без замка

    def serve() -> None:
        while True:
            try:
                conn, _ = srv.accept()
            except OSError:
                return
            try:
                with conn:
                    conn.settimeout(0.5)
                    if conn.recv(8) == b"show":
                        conn.sendall(b"ok")
                        on_show()
            except OSError:
                pass

    threading.Thread(target=serve, daemon=True).start()
    return srv


class _NoLock:
    """Заглушка: замок не вдалося взяти, але чужа копія також не відповіла."""

    def close(self) -> None:
        pass


def make_icon_image(size: int = 64):
    """Іконка програми (дошка з аркушем). Потрібен Pillow; без нього — None."""
    try:
        from PIL import Image, ImageDraw
    except Exception:
        return None
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((8, 8, s - 8, s - 8), radius=52, fill="#0f6cbd")
    d.rounded_rectangle((52, 44, 204, 220), radius=18, fill="#ffffff")           # дошка
    d.rounded_rectangle((88, 28, 168, 68), radius=12, fill="#cfe4f7", outline="#0f6cbd", width=6)  # затискач
    for n, w in enumerate((120, 96, 112, 70)):                                    # рядки тексту
        y = 94 + n * 28
        d.rounded_rectangle((68, y, 68 + w, y + 12), radius=6, fill="#0f6cbd" if n != 3 else "#8fb8e0")
    return img.resize((size, size), Image.LANCZOS) if size != s else img


def start_tray(events: "queue.Queue[str]", title: str):
    """Іконка в треї (Windows, потрібні pystray і Pillow). Повертає іконку або None."""
    if os.name != "nt":
        return None
    try:
        import pystray
        image = make_icon_image(64)
        if image is None:
            return None
        icon = pystray.Icon(APP_ID, image, title, menu=pystray.Menu(
            pystray.MenuItem("Відкрити історію", lambda *_: events.put("show"), default=True),
            pystray.MenuItem("Вийти", lambda *_: events.put("quit")),
        ))
        icon.run_detached()
        return icon
    except Exception:
        return None
