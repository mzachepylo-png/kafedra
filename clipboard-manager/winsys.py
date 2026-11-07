"""Системні можливості: глобальна гаряча клавіша (Windows), іконка в треї,
запуск лише однієї копії, DPI. Не імпортує tkinter."""

from __future__ import annotations

import os
import queue
import socket
import sys
import threading
import time

APP_ID = "ClipboardMemory"
SINGLE_PORT = int(os.environ.get("CLIPBOARD_MEMORY_PORT", "47653"))
# Номер версії для заміни старої копії новою (збільшувати при кожному релізі; v2 і раніше цього не вміють)
APP_VERSION = os.environ.get("CLIPBOARD_MEMORY_VERSION", "6")

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


def _ask(port: int, request: bytes, timeout: float = 0.7) -> bytes:
    """Надсилає команду вже запущеній копії й повертає відповідь (порожню, якщо не відповіла)."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout) as c:
            c.sendall(request)
            return c.recv(32)
    except OSError:
        return b""


def _bind(port: int):
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if os.name == "nt":
            srv.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        else:
            srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("127.0.0.1", port))
        srv.listen(5)
        return srv
    except OSError:
        srv.close()
        return None


def _serve(srv, version: str, on_show, on_quit) -> None:
    """Приймає команди від наступних запусків: show (як у старих версіях), ver?, quit."""
    while True:
        try:
            conn, _ = srv.accept()
        except OSError:
            return
        try:
            with conn:
                conn.settimeout(0.5)
                cmd = conn.recv(8)
                if cmd == b"show":
                    conn.sendall(b"ok")
                    on_show()
                elif cmd == b"ver?":
                    conn.sendall(b"ok " + version.encode())
                elif cmd == b"quit" and on_quit:
                    conn.sendall(b"ok")
                    srv.close()           # одразу звільняємо порт для нової копії
                    on_quit()
                    return
        except OSError:
            pass


def _is_older(mine: str, theirs: str) -> bool:
    try:
        return int(theirs) < int(mine)
    except ValueError:
        return False


def acquire_single_instance(on_show, on_quit=None, version: str = APP_VERSION, port: int = SINGLE_PORT):
    """Запускає «замок» єдиної копії. Повертає (замок, статус):

    * ``primary``  — ми перша копія (замок — сокет, його тримати до кінця роботи);
    * ``replaced`` — працювала СТАРША версія: вона закрита, ми зайняли її місце;
    * ``existing`` — вже працює така сама (або новіша) версія, їй надіслано «показати вікно»; замка нема;
    * ``outdated`` — працює старша версія без підтримки заміни; її вікно показано, але закрити
      її може лише користувач; замка нема;
    * ``stuck``    — старша версія не закрилась за кілька секунд; замка нема;
    * ``foreign``  — порт зайняла стороння програма; працюємо без замка.
    """
    srv = _bind(port)
    status = "primary"
    if srv is None:
        reply = _ask(port, b"ver?")
        if reply.startswith(b"ok "):
            theirs = reply[3:].decode(errors="replace")
            if not _is_older(version, theirs):
                _ask(port, b"show")
                return None, "existing"
            _ask(port, b"quit")                       # просимо стару копію закритись
            for _ in range(25):                       # до ~5 секунд чекаємо, поки вона звільнить порт
                time.sleep(0.2)
                srv = _bind(port)
                if srv:
                    status = "replaced"
                    break
            else:
                return None, "stuck"
        elif _ask(port, b"show") == b"ok":
            return None, "outdated"                   # стара версія без обміну версіями
        else:
            return _NoLock(), "foreign"
    threading.Thread(target=_serve, args=(srv, version, on_show, on_quit), daemon=True).start()
    return srv, status


class _NoLock:
    """Заглушка: замок не вдалося взяти, але чужа копія також не відповіла."""

    def close(self) -> None:
        pass


def notify(title: str, text: str) -> None:
    """Просте повідомлення користувачу (до створення головного вікна)."""
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, text, title, 0x40)  # MB_ICONINFORMATION
            return
        except Exception:
            pass
    print(f"{title}: {text}", file=sys.stderr)


def clipboard_sequence() -> int | None:
    """Порядковий номер вмісту буфера обміну (Windows): змінюється, коли хтось щось скопіював.
    Дозволяє опитування без відкриття буфера (OpenClipboard) щоразу. На інших системах — None."""
    if os.name != "nt":
        return None
    try:
        import ctypes
        return int(ctypes.windll.user32.GetClipboardSequenceNumber())
    except Exception:
        return None


ICON_VERSION = 1


def icon_ico_path() -> str | None:
    """Шлях до .ico іконки програми; файл створюється один раз і кешується в тимчасовій теці
    (раніше PIL малював і зберігав його при кожному запуску й при кожному діалозі)."""
    folder = os.environ.get("TEMP") or os.environ.get("TMP") or "/tmp"
    path = os.path.join(folder, f"clipboard_memory_icon_v{ICON_VERSION}.ico")
    try:
        if os.path.getsize(path) > 0:
            return path
    except OSError:
        pass
    img = make_icon_image(256)
    if img is None:
        return None
    tmp = f"{path}.{os.getpid()}.tmp"
    try:
        img.save(tmp, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
        os.replace(tmp, path)
    except OSError:
        return None
    return path


_icon_png_cache: dict[int, bytes] = {}


def icon_png_base64(size: int = 64) -> bytes | None:
    """PNG іконки у base64 для tk.PhotoImage (Linux/macOS); обчислюється один раз."""
    if size not in _icon_png_cache:
        img = make_icon_image(size)
        if img is None:
            return None
        import base64
        import io
        buf = io.BytesIO()
        img.save(buf, "PNG")
        _icon_png_cache[size] = base64.b64encode(buf.getvalue())
    return _icon_png_cache[size]


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
