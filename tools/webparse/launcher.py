"""Точка входу exe-версії (webparse.exe).

Подвійний клік — запускає вебінтерфейс на цьому комп'ютері й відкриває його в браузері.
З параметрами — працює як командний рядок:  webparse.exe https://… -o файл.docx
"""
from __future__ import annotations

import logging
import socket
import sys
import threading
import time
import webbrowser


def _utf8_console() -> None:
    # у Windows консоль або перенаправлений вивід може бути в cp1252/cp866 — кирилиця зламається
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def _free_port(preferred: int = 8000) -> int:
    for port in list(range(preferred, preferred + 20)) + [0]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return s.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("немає вільного порту")


def _open_when_ready(url: str, port: int) -> None:
    for _ in range(100):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                break
        except OSError:
            time.sleep(0.1)
    webbrowser.open(url)


def gui() -> None:
    import app as webapp  # noqa: PLC0415 — Flask вантажимо лише для інтерфейсу

    port = _free_port()
    url = f"http://127.0.0.1:{port}"
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    print("=" * 64)
    print("  Парсер вебсторінок → DOCX")
    print(f"  Відкрийте в браузері: {url}")
    print("  (сторінка відкриється сама за кілька секунд)")
    print()
    print("  Щоб завершити роботу, закрийте це вікно.")
    print("=" * 64)
    threading.Thread(target=_open_when_ready, args=(url, port), daemon=True).start()
    webapp.app.run(host="127.0.0.1", port=port, threaded=True)


def main() -> int:
    _utf8_console()
    args = sys.argv[1:]
    if args in (["--version"], ["-V"]):
        from webparse import __version__
        print(f"webparse {__version__}")
        return 0
    if args:
        from webparse.__main__ import main as cli
        return cli(args)
    try:
        gui()
    except Exception as e:  # у вікні, що закривається, помилку інакше не побачити
        print(f"\nПомилка: {e}")
        input("Натисніть Enter, щоб закрити…")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
