"""BioBib — окрема програма: бібліотека джерел у браузері + значок у треї.

Запуск (BioBib.exe або ``python biobib_app.py``):
  * стартує локальний сервер (лише 127.0.0.1) і відкриває бібліотеку в браузері;
  * значок у треї: «Відкрити бібліотеку» (і подвійний клік), «Тека з даними», «Вийти»;
  * друга копія не запускає ще один сервер — лише відкриває бібліотеку вже запущеної;
  * дані — у ``%APPDATA%\\BioBib`` (Windows) або ``~/.local/share/biobib``. Під час першого запуску бібліотека,
    що лежала в Clipboard Memory (``%APPDATA%\\ClipboardMemory\\biobib``), копіюється сюди.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import threading
import traceback
import urllib.request
import webbrowser
from pathlib import Path

from . import __version__, config

APP_TITLE = "BioBib"


def default_data_dir() -> Path:
    override = os.environ.get("BIOBIB_DIR")
    if override:
        return Path(override)
    if os.name == "nt":
        return Path(os.environ.get("APPDATA") or Path.home()) / "BioBib"
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "biobib"


def legacy_data_dir() -> Path:
    """Де бібліотека лежала, коли BioBib був вкладкою «Посилання» в Clipboard Memory."""
    cm = os.environ.get("CLIPBOARD_MEMORY_DIR")
    if not cm:
        if os.name == "nt":
            cm = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "ClipboardMemory")
        else:
            cm = os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"),
                              "clipboard-memory")
    return Path(cm) / "biobib"


def migrate(data_dir: Path, legacy: Path) -> bool:
    """Перший запуск: копіює стару бібліотеку (БД + прикріплені файли) з Clipboard Memory. Стару не видаляє."""
    if (data_dir / "biobib.db").exists() or not (legacy / "biobib.db").exists():
        return False
    data_dir.mkdir(parents=True, exist_ok=True)
    for name in ("biobib.db", "biobib.db-wal", "biobib.db-shm"):
        if (legacy / name).exists():
            shutil.copy2(legacy / name, data_dir / name)
    if (legacy / "storage").is_dir():
        shutil.copytree(legacy / "storage", data_dir / "storage", dirs_exist_ok=True)
    (data_dir / "moved-from.txt").write_text(str(legacy), encoding="utf-8")
    return True


def find_running(data_dir: Path, ports=None) -> str | None:
    """Адреса вже запущеної BioBib з цією ж текою даних (щоб не запускати другий сервер на ту саму БД)."""
    want = str(Path(data_dir).resolve())
    for port in ports or range(config.PORT, config.PORT + 12):
        url = f"http://{config.HOST}:{port}/"
        try:
            with urllib.request.urlopen(url + "api/health", timeout=0.4) as r:
                info = json.loads(r.read())
        except (OSError, ValueError):
            continue
        if info.get("app") == "biobib" and info.get("data_dir") == want:
            return url
    return None


def _message(text: str) -> None:
    """Повідомлення користувачу (у вікні Windows; деінде — у stderr)."""
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, text, APP_TITLE, 0x40)
            return
        except Exception:                               # noqa: BLE001
            pass
    print(text, file=sys.stderr)


def tray_image(size: int = 64):
    """Значок BioBib: зелене коло з розгорнутою книжкою."""
    from PIL import Image, ImageDraw
    k = 4
    s = size * k
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 0, s - 1, s - 1), fill=(31, 111, 84, 255))
    m, top, bot = s * 0.2, s * 0.3, s * 0.72
    d.polygon([(m, top), (s / 2, top + s * 0.06), (s / 2, bot), (m, bot - s * 0.06)], fill=(255, 255, 255, 255))
    d.polygon([(s - m, top), (s / 2, top + s * 0.06), (s / 2, bot), (s - m, bot - s * 0.06)],
              fill=(226, 240, 233, 255))
    return img.resize((size, size), Image.LANCZOS)


def open_folder(path: Path) -> None:
    if os.name == "nt":
        os.startfile(str(path))                         # type: ignore[attr-defined]
    else:
        import subprocess
        subprocess.Popen(["xdg-open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def run_tray(url: str, data_dir: Path, stop) -> bool:
    """Значок у треї (блокує до «Вийти»). Немає pystray — повертає False."""
    try:
        import pystray
    except Exception:                                   # noqa: BLE001
        return False
    icon = pystray.Icon("BioBib", tray_image(), f"BioBib — {url}", menu=pystray.Menu(
        pystray.MenuItem("Відкрити бібліотеку", lambda *_: webbrowser.open(url), default=True),
        pystray.MenuItem("Тека з даними", lambda *_: open_folder(data_dir)),
        pystray.MenuItem("Вийти", lambda ic, *_: (stop(), ic.stop())),
    ))
    icon.run()
    return True


def check(data_dir: Path) -> int:
    """--check (для CI): сервер, набір джерел, сторінки бібліотеки й читалки; результат — у biobib-check.txt."""
    from contextlib import closing

    from . import database, library, server
    out = data_dir / "biobib-check.txt"
    data_dir.mkdir(parents=True, exist_ok=True)
    try:
        config.configure(data_dir)
        url = server.ensure_running()
        with closing(database.get_connection()) as c:
            library.import_all_seeds(c)
            n = c.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
            sid = c.execute("SELECT MIN(id) FROM sources").fetchone()[0]
        import pypdf  # noqa: F401 — текст PDF для читалки й пошуку
        get = lambda p: urllib.request.urlopen(url + p, timeout=10).read()   # noqa: E731
        secs = [s["path"] for s in json.loads(get("api/sections"))]
        health = json.loads(get("api/health"))
        ok = ("BioBib" in get("").decode("utf-8") and len(get("static/app.js")) > 1000 and n >= 27 and
              "Читалка" in get(f"reader/{sid}").decode("utf-8") and
              bool(json.loads(get(f"api/read/{sid}"))["source"]["description"]) and
              "Метааналіз ендофітів" in secs and health.get("app") == "biobib" and
              find_running(data_dir) == url)
        text = ("OK " if ok else "FAIL ") + f"v{__version__} sources={n} " + json.dumps(secs, ensure_ascii=False)
        server.stop()
    except Exception:                                   # noqa: BLE001
        text, ok = "FAIL " + traceback.format_exc(), False
    out.write_text(text, encoding="utf-8")
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="BioBib", description="BioBib — бібліотека джерел для дисертації")
    p.add_argument("--data-dir", help="тека з бібліотекою (БД і файли)")
    p.add_argument("--no-browser", action="store_true", help="не відкривати браузер")
    p.add_argument("--no-tray", action="store_true", help="без значка в треї (працює до Ctrl+C)")
    p.add_argument("--exit-after", type=float, default=0, help="(тести) завершитись через N секунд")
    p.add_argument("--check", action="store_true", help="(CI) перевірити збірку й завершитись")
    args = p.parse_args(argv)
    data_dir = Path(args.data_dir).resolve() if args.data_dir else default_data_dir()
    if args.check:
        return check(data_dir)
    from . import server
    try:
        running = find_running(data_dir)
        if running:                                     # друга копія — лише відкрити бібліотеку
            if not args.no_browser:
                webbrowser.open(running)
            print(running, flush=True)
            return 0
        if not args.data_dir:
            migrate(data_dir, legacy_data_dir())
        config.configure(data_dir)
        url = server.ensure_running()
    except Exception as ex:                             # noqa: BLE001
        _message(f"Не вдалося запустити BioBib:\n{ex}")
        return 1
    print(url, flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    done = threading.Event()
    if args.exit_after:
        threading.Timer(args.exit_after, done.set).start()
    if args.no_tray or args.exit_after or not run_tray(url, data_dir, done.set):
        try:
            while not done.wait(0.5):
                pass
        except KeyboardInterrupt:
            pass
    server.stop()
    return 0
