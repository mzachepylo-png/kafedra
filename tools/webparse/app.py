#!/usr/bin/env python3
"""Вебінтерфейс парсера: http://127.0.0.1:8000

    pip install -r requirements.txt
    python3 app.py                  # лише для цього комп'ютера
    python3 app.py --host 0.0.0.0   # доступ з локальної мережі (див. README: безпека)

Вставте адреси сторінок або завантажте файл із посиланнями (.txt, .csv, .docx, .xlsx, .html, .pdf) —
парсер покаже текст у читабельному вигляді й дасть завантажити DOCX (один на всі сторінки
або окремі файли в ZIP).
"""
from __future__ import annotations

import argparse
import io
import os
import re
import sys
import threading
import time
import uuid
import zipfile
from collections import OrderedDict
from urllib.parse import quote

from flask import Flask, Response, abort, jsonify, render_template, request

from webparse import links, preview, render
from webparse.docx_out import build, filename
from webparse.model import Document
from webparse.pipeline import Options, parse_many

MAX_URLS = 200
KEEP_JOBS = 30

def _resource_dir() -> str:
    """Тека з templates/: поруч із app.py або всередині exe (PyInstaller розпаковує в sys._MEIPASS)."""
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


app = Flask(__name__, template_folder=os.path.join(_resource_dir(), "templates"))
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024


class Job:
    def __init__(self, urls: list[str], opts: Options):
        self.id = uuid.uuid4().hex[:12]
        self.urls = urls
        self.opts = opts
        self.docs: list[Document | None] = [None] * len(urls)
        self.done = 0
        self.finished = False
        self.created = time.time()
        self._docx: bytes | None = None
        self.lock = threading.Lock()

    def run(self):
        def progress(i, d):
            with self.lock:
                self.docs[i] = d
                self.done += 1
        try:
            parse_many(self.urls, self.opts, progress)
        finally:
            with self.lock:
                for i, d in enumerate(self.docs):
                    if d is None:
                        self.docs[i] = Document(url=self.urls[i], error="обробку перервано")
                self.finished = True

    def ready(self) -> list[Document]:
        return [d for d in self.docs if d is not None]


JOBS: "OrderedDict[str, Job]" = OrderedDict()
JOBS_LOCK = threading.Lock()


def get_job(jid: str) -> Job:
    with JOBS_LOCK:
        job = JOBS.get(jid)
    if job is None:
        abort(404, "Завдання не знайдено (сервер перезапускався або воно застаріло).")
    return job


def item_info(i: int, d: Document | None, url: str) -> dict:
    if d is None:
        return {"i": i, "url": url, "status": "pending"}
    return {"i": i, "url": d.url, "status": "error" if d.error else "ok", "title": d.title or d.url,
            "error": d.error, "warnings": d.warnings, "stats": d.stats(), "site": d.site,
            "author": d.author, "published": d.published}


def _content_disposition(name: str) -> str:
    ascii_name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_") or "document.docx"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"


def pages(n: int) -> str:
    """1 сторінка, 2 сторінки, 5 сторінок."""
    form = "сторінка" if n % 10 == 1 and n % 100 != 11 else \
        "сторінки" if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else "сторінок"
    return f"{n} {form}"


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


# ------------------------------------------------------------------ сторінки

@app.get("/")
def index():
    return render_template("index.html", render_ok=render.available(), max_urls=MAX_URLS)


@app.post("/api/jobs")
def create_job():
    urls: list[str] = []
    text = request.form.get("urls", "")
    if text.strip():
        urls += links.from_text(text)
    f = request.files.get("file")
    if f and f.filename:
        try:
            urls += links.from_file(f.filename, f.read())
        except ValueError as e:
            return jsonify(error=str(e)), 400
        except Exception as e:
            return jsonify(error=f"не вдалося прочитати файл: {e.__class__.__name__}"), 400
    urls = list(dict.fromkeys(urls))
    if not urls:
        return jsonify(error="Не знайдено жодної адреси http(s)://… — перевірте текст або файл."), 400
    note = ""
    if len(urls) > MAX_URLS:
        note = f"Оброблено перші {MAX_URLS} адрес із {len(urls)}."
        urls = urls[:MAX_URLS]
    opts = Options(images=request.form.get("images", "1") == "1",
                   render=request.form.get("render") == "1")
    job = Job(urls, opts)
    with JOBS_LOCK:
        JOBS[job.id] = job
        while len(JOBS) > KEEP_JOBS:
            JOBS.popitem(last=False)
    threading.Thread(target=job.run, daemon=True).start()
    return jsonify(id=job.id, total=len(urls), urls=urls, note=note)


@app.get("/api/jobs/<jid>")
def job_status(jid):
    job = get_job(jid)
    with job.lock:
        items = [item_info(i, d, job.urls[i]) for i, d in enumerate(job.docs)]
        return jsonify(id=job.id, total=len(job.urls), done=job.done, finished=job.finished, items=items)


@app.get("/api/jobs/<jid>/doc/<int:i>")
def job_doc(jid, i):
    job = get_job(jid)
    if not 0 <= i < len(job.docs) or job.docs[i] is None:
        abort(404)
    d = job.docs[i]
    html = "" if d.error else preview.render(d, img_url=lambda k: f"/img/{jid}/{i}/{k}")
    return jsonify({**item_info(i, d, d.url), "html": html})


@app.get("/img/<jid>/<int:i>/<int:k>")
def job_img(jid, i, k):
    job = get_job(jid)
    if not 0 <= i < len(job.docs) or job.docs[i] is None:
        abort(404)
    figs = preview.figures(job.docs[i])
    if not 0 <= k < len(figs) or not figs[k].data:
        abort(404)
    data = figs[k].data
    mime = "image/png" if data[:4] == b"\x89PNG" else "image/gif" if data[:3] == b"GIF" else "image/jpeg"
    return Response(data, mimetype=mime, headers={"Cache-Control": "private, max-age=3600"})


@app.get("/download/<jid>.docx")
def download_all(jid):
    job = get_job(jid)
    docs = job.ready()
    ok = [d for d in docs if not d.error]
    if not ok:
        abort(404, "Немає успішно оброблених сторінок.")
    if len(docs) == 1:
        data, name = build(docs), filename(docs[0])
    else:
        if job._docx is None or not job.finished:
            data = build(docs)
            if job.finished:
                job._docx = data
        data = job._docx or data
        name = f"Збірка, {pages(len(ok))} {time.strftime('%Y-%m-%d')}.docx"
    return Response(data, mimetype=DOCX_MIME, headers={"Content-Disposition": _content_disposition(name)})


@app.get("/download/<jid>/<int:i>.docx")
def download_one(jid, i):
    job = get_job(jid)
    if not 0 <= i < len(job.docs) or job.docs[i] is None or job.docs[i].error:
        abort(404)
    d = job.docs[i]
    return Response(build([d]), mimetype=DOCX_MIME,
                    headers={"Content-Disposition": _content_disposition(filename(d))})


@app.get("/download/<jid>.zip")
def download_zip(jid):
    job = get_job(jid)
    ok = [d for d in job.ready() if not d.error]
    if not ok:
        abort(404, "Немає успішно оброблених сторінок.")
    buf = io.BytesIO()
    used: set[str] = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n, d in enumerate(ok, 1):
            name = f"{n:02d} {filename(d)}"
            while name in used:
                name = name.replace(".docx", "_.docx")
            used.add(name)
            z.writestr(name, build([d]))
    name = f"Окремі файли, {pages(len(ok))} {time.strftime('%Y-%m-%d')}.zip"
    return Response(buf.getvalue(), mimetype="application/zip",
                    headers={"Content-Disposition": _content_disposition(name)})


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="Файл завеликий (понад 15 МБ)."), 413


def main():
    ap = argparse.ArgumentParser(description="Вебінтерфейс парсера сторінок у DOCX")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    a = ap.parse_args()
    print(f"Парсер працює: http://{'127.0.0.1' if a.host in ('0.0.0.0', '::') else a.host}:{a.port}")
    app.run(host=a.host, port=a.port, threaded=True)


if __name__ == "__main__":
    main()
