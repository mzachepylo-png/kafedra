"""Командний рядок.

    python3 -m webparse https://example.org/a https://example.org/b -o збірка.docx
    python3 -m webparse -f посилання.txt --separate out/      # окремий DOCX на кожну сторінку
    python3 -m webparse URL --render                          # з виконанням JavaScript (Playwright)
    python3 -m webparse URL --text                            # лише вивести текст у термінал
"""
from __future__ import annotations

import argparse
import os
import sys

from . import links
from .docx_out import build, filename
from .pipeline import Options, parse_many


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="webparse", description="Парсер вебсторінок у читабельний текст і DOCX")
    ap.add_argument("urls", nargs="*", help="адреси сторінок")
    ap.add_argument("-f", "--file", action="append", default=[],
                    help="файл із посиланнями (.txt, .csv, .docx, .xlsx, .html, .pdf); можна кілька")
    ap.add_argument("-o", "--output", help="DOCX-файл (типово — назва сторінки або «webparse.docx»)")
    ap.add_argument("--separate", metavar="DIR", help="окремий DOCX на кожну сторінку в цю теку")
    ap.add_argument("--render", action="store_true", help="виконувати JavaScript у браузері (Playwright)")
    ap.add_argument("--no-images", action="store_true", help="без рисунків і графіків")
    ap.add_argument("--text", action="store_true", help="вивести текст у термінал замість DOCX")
    ap.add_argument("--title", help="назва збірки (для кількох сторінок)")
    a = ap.parse_args(argv)

    urls = []
    for u in a.urls:
        urls += links.from_text(u) or [u]
    for path in a.file:
        with open(path, "rb") as fh:
            urls += links.from_file(path, fh.read())
    urls = list(dict.fromkeys(urls))
    if not urls:
        ap.error("потрібна хоча б одна адреса або файл із посиланнями (-f)")

    opts = Options(images=not a.no_images and not a.text, render=a.render)

    def progress(i, d):
        mark = "✗" if d.error else "✓"
        info = d.error or f"{d.title[:70]} — {d.stats()['words']} сл., табл. {d.stats()['tables']}, рис. {d.stats()['figures']}"
        print(f"{mark} {d.url}\n    {info}", file=sys.stderr)
        for w in d.warnings:
            print(f"    ⚠ {w}", file=sys.stderr)

    docs = parse_many(urls, opts, progress)
    ok = [d for d in docs if not d.error]
    if a.text:
        for d in ok:
            print(d.plain_text(), "\n")
        return 0 if ok else 1
    if not ok:
        print("Жодну сторінку не вдалося обробити.", file=sys.stderr)
        return 1
    if a.separate:
        os.makedirs(a.separate, exist_ok=True)
        for n, d in enumerate(ok, 1):
            path = os.path.join(a.separate, f"{n:02d} {filename(d)}")
            with open(path, "wb") as fh:
                fh.write(build([d]))
            print(path)
    else:
        out = a.output or (filename(ok[0]) if len(docs) == 1 else "webparse.docx")
        with open(out, "wb") as fh:
            fh.write(build(docs, title=a.title))
        print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
