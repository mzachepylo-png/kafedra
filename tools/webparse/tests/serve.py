"""Локальний сервер з тестовою сторінкою і зображеннями (для тестів і ручної перевірки)."""
import http.server
import io
import os
import threading

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))


def _png(w, h, color, fmt="PNG"):
    im = Image.new("RGB", (w, h), color)
    ImageDraw.Draw(im).rectangle([w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill="white")
    b = io.BytesIO()
    im.save(b, fmt)
    return b.getvalue()


FILES = {
    "/img/leaf.png": ("image/png", lambda: _png(600, 400, "#3a7")),
    "/img/lazy.webp": ("image/webp", lambda: _png(500, 300, "#37a", "WEBP")),
    "/img/pixel.gif": ("image/gif", lambda: _png(1, 1, "#000", "GIF")),
    "/logo.png": ("image/png", lambda: _png(120, 40, "#000")),
}


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/article"):
            body, ct = open(os.path.join(HERE, "fixture.html"), "rb").read(), "text/html; charset=utf-8"
        elif path == "/ru":
            body = ("<html lang='ru'><body><article><h1>Фотосинтез</h1><p>" + "Это статья об этом процессе. " * 30
                    + "</p></article></body></html>").encode()
            ct = "text/html; charset=utf-8"
        elif path == "/cp1251":
            body = ("<html><head><meta charset='windows-1251'></head><body><article><p>"
                    + "Пшениця озима — головна зернова культура України. " * 20
                    + "</p></article></body></html>").encode("cp1251")
            ct = "text/html"
        elif path in FILES:
            ct, gen = FILES[path]
            body = gen()
        else:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def start(port=0):
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


if __name__ == "__main__":
    srv, url = start(8765)
    print("Тестова сторінка:", url + "/article")
    threading.Event().wait()
