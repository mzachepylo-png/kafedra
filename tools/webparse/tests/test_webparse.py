"""Тести на локальній тестовій сторінці (мережа не потрібна): python3 -m pytest tests -q"""
import io
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
os.environ["NO_PROXY"] = os.environ["no_proxy"] = "127.0.0.1,localhost"

import serve  # noqa: E402
from docx import Document as Docx  # noqa: E402

from webparse import links  # noqa: E402
from webparse.docx_out import build  # noqa: E402
from webparse.model import Figure, Heading, ListBlock, Table  # noqa: E402
from webparse.pipeline import Options, parse_many, parse_url  # noqa: E402


@pytest.fixture(scope="module")
def base():
    srv, url = serve.start()
    yield url
    srv.shutdown()


@pytest.fixture(scope="module")
def doc(base):
    return parse_url(base + "/article", Options())


def test_meta(doc):
    assert doc.title == "Фотосинтез у C₄-рослин"
    assert doc.author == "Іваненко О. П."
    assert doc.published == "2025-03-14"
    assert doc.site == "Тестовий журнал"


def test_boilerplate_removed(doc):
    text = doc.plain_text()
    for junk in ("Головна", "cookie", "Популярне", "Поділитися", "Коментарі", "Усі права захищено"):
        assert junk not in text
    assert "ФЕП-карбоксилаза" in text
    assert "у огляді, а також у [1]. Фермент" in text  # переноси рядків HTML — пробіли


def test_headings_and_lists(doc):
    hs = [b for b in doc.blocks if isinstance(b, Heading)]
    assert [h.runs[0].text for h in hs] == ["Кранц-анатомія", "Підтипи", "Залежність від температури"]
    lb = next(b for b in doc.blocks if isinstance(b, ListBlock))
    assert lb.ordered and len(lb.items) == 3
    assert lb.items[0].children and lb.items[0].children[0].items[0].runs[0].text.startswith("декарбоксилювання")


def test_table_spans(doc):
    t = next(b for b in doc.blocks if isinstance(b, Table))
    assert t.caption == "Порівняння C₃ і C₄"
    g = t.grid()
    assert len(g) == 4 and len(g[0]) == 3
    assert g[0][0] == g[1][0]          # rowspan «Ознака»
    assert g[0][1] == g[0][2]          # colspan «Тип»
    assert g[3][1] == g[3][2]


def test_figures(doc):
    figs = [b for b in doc.blocks if isinstance(b, Figure)]
    srcs = [f.src.rsplit("/", 1)[-1] for f in figs]
    assert "leaf.png" in srcs and "lazy.webp" in srcs     # data-src замість заглушки
    assert not any("logo" in s or "pixel" in s for s in srcs)
    leaf = figs[srcs.index("leaf.png")]
    assert leaf.data and leaf.caption == "Поперечний зріз листка кукурудзи"
    lazy = figs[srcs.index("lazy.webp")]
    assert lazy.data[:4] == b"\x89PNG"  # WebP → PNG для Word
    assert lazy.kind == "chart"         # «Діаграма» в alt
    svg = [f for f in figs if not f.src and f.caption.startswith("Залежність")]
    assert svg and svg[0].caption == "Залежність швидкості фотосинтезу від температури"  # без «Рис. 2.»
    assert any("JavaScript" in w for w in doc.warnings)  # <canvas> без рендерингу


def test_docx(doc):
    data = build([doc])
    d = Docx(io.BytesIO(data))
    text = "\n".join(p.text for p in d.paragraphs)
    assert "Фотосинтез у C₄-рослин" in text
    assert "Таблиця 1. Порівняння C₃ і C₄" in text
    assert "Як цитувати (APA 7)" in text
    assert len(d.tables) == 1 and len(d.tables[0].rows) == 4
    assert len(d.inline_shapes) >= 2


def test_many_and_errors(base):
    docs = parse_many([base + "/article", base + "/missing", base + "/cp1251"], Options(images=False))
    assert [bool(d.error) for d in docs] == [False, True, False]
    assert "404" in docs[1].error
    assert "Пшениця озима" in docs[2].plain_text()   # windows-1251
    data = build(docs)
    text = "\n".join(p.text for p in Docx(io.BytesIO(data)).paragraphs)
    assert "Зміст" in text and "Не вдалося обробити" in text


def test_russian_warning(base):
    d = parse_url(base + "/ru", Options(images=False))
    assert any("російськ" in w for w in d.warnings)


def test_links_from_text_and_files():
    txt = "Див. https://uk.wikipedia.org/wiki/Фотосинтез_(біологія), а також www.example.org/a."
    assert links.from_file("a.txt", txt.encode()) == [
        "https://uk.wikipedia.org/wiki/Фотосинтез_(біологія)", "https://www.example.org/a"]
    from docx import Document as D
    d = D()
    d.add_paragraph("Перша: https://a.example.com/x")
    b = io.BytesIO()
    d.save(b)
    assert links.from_file("list.docx", b.getvalue()) == ["https://a.example.com/x"]
    from openpyxl import Workbook
    wb = Workbook()
    wb.active["A1"] = "https://b.example.com/y"
    wb.active["A2"] = "посилання"
    wb.active["A2"].hyperlink = "https://c.example.com/z"
    b = io.BytesIO()
    wb.save(b)
    assert links.from_file("list.xlsx", b.getvalue()) == ["https://b.example.com/y", "https://c.example.com/z"]
    csv = "назва;адреса\nА;https://d.example.com/1\nБ;https://d.example.com/1\n"
    assert links.from_file("x.csv", csv.encode("cp1251")) == ["https://d.example.com/1"]
