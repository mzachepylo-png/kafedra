"""Повна бібліотека BioBib у браузері: вбудований сервер FastAPI (uvicorn) у фоновому потоці програми.

Сервер запускається лише на вимогу (кнопка «Бібліотека в браузері» на сторінці «Посилання»), тож старт програми
не сповільнюється, а FastAPI/uvicorn імпортуються тільки тоді. Слухає лише 127.0.0.1."""

from __future__ import annotations

import logging
import socket
import threading
import time

from . import config

_lock = threading.Lock()
_state: dict = {"server": None, "thread": None, "url": None, "error": None}


def _free_port(start: int) -> int:
    for port in range(start, start + 40):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((config.HOST, port))
                return port
            except OSError:
                continue
    raise OSError("немає вільного порту для бібліотеки")


def running_url() -> str | None:
    srv = _state["server"]
    return _state["url"] if srv is not None and getattr(srv, "started", False) and not srv.should_exit else None


def ensure_running(timeout: float = 10.0) -> str:
    """Запускає сервер (якщо ще ні) і повертає його адресу. Помилка — виняток з поясненням."""
    with _lock:
        url = running_url()
        if url:
            return url
        import uvicorn                                   # важкі імпорти — лише тут

        from .database import init_db
        from .main import app

        init_db()
        try:                                            # набір джерел (з описами) — і для браузерної бібліотеки
            from contextlib import closing

            from .database import get_connection
            from .library import import_all_seeds
            with closing(get_connection()) as c:
                import_all_seeds(c)
        except Exception:                               # noqa: BLE001 — бібліотека працює й без набору
            pass
        for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):   # у програмі без консолі — без логів
            lg = logging.getLogger(name)
            lg.handlers = [logging.NullHandler()]
            lg.propagate = False
        port = _free_port(config.PORT)
        cfg = uvicorn.Config(app, host=config.HOST, port=port, log_config=None, access_log=False,
                             lifespan="on", log_level="warning")
        server = uvicorn.Server(cfg)
        _state.update(server=server, url=f"http://{config.HOST}:{port}/", error=None)

        def run() -> None:
            try:
                server.run()
            except BaseException as ex:                 # noqa: BLE001 — показуємо користувачеві
                _state["error"] = repr(ex)

        th = threading.Thread(target=run, name="biobib-server", daemon=True)
        _state["thread"] = th
        th.start()
        end = time.monotonic() + timeout
        while time.monotonic() < end and not server.started and th.is_alive():
            time.sleep(0.05)
        if not server.started:
            server.should_exit = True
            raise RuntimeError(_state["error"] or "сервер бібліотеки не запустився")
        return _state["url"]


def stop() -> None:
    srv = _state["server"]
    if srv is not None:
        srv.should_exit = True
    th = _state["thread"]
    if th is not None:
        th.join(timeout=3)
    _state.update(server=None, thread=None, url=None)
