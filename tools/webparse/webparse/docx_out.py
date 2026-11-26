"""Document → DOCX (python-docx): заголовки, абзаци з посиланнями, списки, таблиці з об'єднаними
клітинками, рисунки з підписами, код, цитати, бібліографічний запис (APA 7)."""
from __future__ import annotations

import datetime as dt
import io
import re
from typing import Iterable, Optional
from urllib.parse import urlparse

from docx import Document as new_docx
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Emu, Pt, RGBColor

from .model import Code, Document, Figure, Heading, ListBlock, Paragraph, Quote, Run, Table

FONT = "Times New Roman"
MONO = "Courier New"
LINK = RGBColor(0x05, 0x63, 0xC1)
GREY = RGBColor(0x59, 0x59, 0x59)
HEADER_FILL = "D9E2F3"
MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня",
          "жовтня", "листопада", "грудня"]


# ------------------------------------------------------------------ оформлення документа

def _setup(d) -> None:
    sec = d.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.orientation = WD_ORIENT.PORTRAIT
    sec.left_margin, sec.right_margin = Cm(2.5), Cm(1.5)
    sec.top_margin, sec.bottom_margin = Cm(2), Cm(2)
    st = d.styles["Normal"]
    st.font.name, st.font.size = FONT, Pt(12)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    pf = st.paragraph_format
    pf.space_after, pf.line_spacing = Pt(6), 1.15
    for name, size in (("Title", 20), ("Heading 1", 16), ("Heading 2", 14), ("Heading 3", 13),
                       ("Heading 4", 12), ("Heading 5", 12), ("Heading 6", 12)):
        s = d.styles[name]
        s.font.name, s.font.size = FONT, Pt(size)
        rpr = s.element.get_or_add_rPr()
        rf = rpr.find(qn("w:rFonts"))
        if rf is None:
            rf = OxmlElement("w:rFonts")
            rpr.append(rf)
        for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
            rf.set(qn(a), FONT)
        for a in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"):
            if rf.get(qn(a)) is not None:
                del rf.attrib[qn(a)]
        s.font.color.rgb = RGBColor(0x1F, 0x2A, 0x44)
        s.paragraph_format.space_before = Pt(12 if name != "Title" else 0)
        s.paragraph_format.space_after = Pt(6)
        s.paragraph_format.keep_with_next = True


def _content_width(d) -> Emu:
    s = d.sections[-1]
    return Emu(s.page_width - s.left_margin - s.right_margin)


def _shade(el, fill: str) -> None:
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    el.append(shd)


# ------------------------------------------------------------------ текст

def add_hyperlink(par, url: str, text: str, bold=False, italic=False, size: Optional[Pt] = None,
                  sup=False, sub=False):
    r_id = par.part.relate_to(url, RT.HYPERLINK, is_external=True)
    h = OxmlElement("w:hyperlink")
    h.set(qn("r:id"), r_id)
    r = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0563C1")
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    rpr.append(color)
    rpr.append(u)
    for flag, tag in ((bold, "w:b"), (italic, "w:i")):
        if flag:
            rpr.append(OxmlElement(tag))
    if sup or sub:
        va = OxmlElement("w:vertAlign")
        va.set(qn("w:val"), "superscript" if sup else "subscript")
        rpr.append(va)
    if size:
        sz = OxmlElement("w:sz")
        sz.set(qn("w:val"), str(int(size.pt * 2)))
        rpr.append(sz)
    r.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    t.set(qn("xml:space"), "preserve")
    r.append(t)
    h.append(r)
    par._p.append(h)
    return h


def add_runs(par, runs: list[Run], size: Optional[Pt] = None, bold_all=False) -> None:
    for r in runs:
        lines = r.text.split("\n")
        for i, line in enumerate(lines):
            if i:
                par.add_run().add_break()
            if not line:
                continue
            if r.href and urlparse(r.href).scheme in ("http", "https"):
                add_hyperlink(par, r.href, line, bold=r.bold or bold_all, italic=r.italic, size=size,
                              sup=r.sup, sub=r.sub)
                continue
            run = par.add_run(line)
            run.bold = r.bold or bold_all or None
            run.italic = r.italic or None
            if r.sup:
                run.font.superscript = True
            if r.sub:
                run.font.subscript = True
            if r.code:
                run.font.name = MONO
                run.font.size = Pt(max(8, (size.pt if size else 12) - 1.5))
            elif size:
                run.font.size = size


# ------------------------------------------------------------------ блоки

class Writer:
    def __init__(self, d):
        self.d = d
        self.n_fig = 0
        self.n_tab = 0
        self.width = _content_width(d)

    def doc_header(self, doc: Document, accessed: dt.date, page_break: bool) -> None:
        title = doc.title or doc.url
        p = self.d.add_paragraph(style="Title")
        if page_break:
            p.paragraph_format.page_break_before = True
        p.add_run(title)
        meta = self.d.add_paragraph()
        meta.paragraph_format.space_after = Pt(12)
        size = Pt(10)

        def line(label: str, value: str = "", url: str = ""):
            if meta.runs or meta._p.findall(qn("w:hyperlink")):
                meta.add_run().add_break()
            r = meta.add_run(label)
            r.font.size, r.font.color.rgb, r.bold = size, GREY, True
            if url:
                add_hyperlink(meta, url, value or url, size=size)
            else:
                r2 = meta.add_run(value)
                r2.font.size, r2.font.color.rgb = size, GREY

        line("Джерело: ", doc.url, doc.url)
        if doc.author:
            line("Автор: ", doc.author)
        if doc.published:
            line("Дата публікації: ", _date_uk(doc.published))
        line("Дата звернення: ", accessed.strftime("%d.%m.%Y"))

    def blocks(self, doc: Document) -> None:
        levels = sorted({b.level for b in doc.blocks if isinstance(b, Heading)})
        shift = {lv: min(i + 1, 6) for i, lv in enumerate(levels)}  # h2,h3,h5 → 1,2,3
        for b in doc.blocks:
            if isinstance(b, Heading):
                p = self.d.add_heading(level=min(shift.get(b.level, 1), 4))
                add_runs(p, b.runs)
            elif isinstance(b, Paragraph):
                add_runs(self.d.add_paragraph(), b.runs)
            elif isinstance(b, Quote):
                p = self.d.add_paragraph(style="Quote")
                add_runs(p, b.runs)
            elif isinstance(b, ListBlock):
                self.list(b, 0)
            elif isinstance(b, Table):
                self.table(b)
            elif isinstance(b, Figure):
                self.figure(b)
            elif isinstance(b, Code):
                self.code(b)

    def list(self, lb: ListBlock, depth: int) -> None:
        for i, it in enumerate(lb.items):
            p = self.d.add_paragraph()
            pf = p.paragraph_format
            pf.left_indent = Cm(0.9 + 0.75 * depth)
            pf.first_line_indent = Cm(-0.6)
            pf.space_after = Pt(2)
            pf.tab_stops.add_tab_stop(Cm(0.9 + 0.75 * depth))
            mark = f"{lb.start + i}." if lb.ordered else ("•", "◦", "▪")[depth % 3]
            if it.runs:
                p.add_run(mark + "\t")
                add_runs(p, it.runs)
            for ch in it.children:
                self.list(ch, depth + 1)

    def table(self, t: Table) -> None:
        grid = t.grid()
        nrows, ncols = len(grid), (len(grid[0]) if grid else 0)
        if not nrows or not ncols:
            return
        self.n_tab += 1
        cap = self.d.add_paragraph()
        cap.paragraph_format.keep_with_next = True
        cap.paragraph_format.space_before = Pt(6)
        r = cap.add_run(f"Таблиця {self.n_tab}")
        r.bold = True
        if t.caption:
            cap.add_run(". " + t.caption)
        tbl = self.d.add_table(rows=nrows, cols=ncols)
        tbl.style = "Table Grid"
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        size = Pt(10 if ncols <= 6 else 9 if ncols <= 10 else 7.5)
        done = set()
        for ri in range(nrows):
            for ci in range(ncols):
                origin = grid[ri][ci]
                if origin is None or origin in done:
                    continue
                done.add(origin)
                # прямокутник, який займає клітинка
                r2, c2 = ri, ci
                while r2 + 1 < nrows and grid[r2 + 1][ci] == origin:
                    r2 += 1
                while c2 + 1 < ncols and grid[ri][c2 + 1] == origin:
                    c2 += 1
                cell = tbl.cell(ri, ci)
                if (r2, c2) != (ri, ci):
                    cell = cell.merge(tbl.cell(r2, c2))
                src = t.rows[origin[0]][origin[1]]
                par = cell.paragraphs[0]
                par.paragraph_format.space_after = Pt(0)
                par.paragraph_format.line_spacing = 1.0
                add_runs(par, src.runs, size=size, bold_all=src.header)
                if src.header:
                    _shade(cell._tc.get_or_add_tcPr(), HEADER_FILL)
        # рядки-заголовки повторюються на кожній сторінці
        for ri, row in enumerate(t.rows):
            if row and all(c.header for c in row):
                trpr = tbl.rows[ri]._tr.get_or_add_trPr()
                h = OxmlElement("w:tblHeader")
                h.set(qn("w:val"), "true")
                trpr.append(h)
            else:
                break
        self.d.add_paragraph().paragraph_format.space_after = Pt(4)

    def figure(self, f: Figure) -> None:
        if not f.data:
            p = self.d.add_paragraph()
            what = "Графік" if f.kind == "chart" else "Рисунок"
            r = p.add_run(f"[{what} не вставлено: {f.error or 'немає даних'}")
            r.italic, r.font.size, r.font.color.rgb = True, Pt(10), GREY
            if f.src:
                p.add_run(" — ").font.size = Pt(10)
                add_hyperlink(p, f.src, "адреса зображення", size=Pt(10), italic=True)
            p.add_run("]").font.size = Pt(10)
            return
        self.n_fig += 1
        w_in = (f.width / f.scale) / 96 if f.width else 6.0
        h_in = (f.height / f.scale) / 96 if f.height else 4.0
        max_w = self.width / 914400
        max_h = 8.5  # дюймів, щоб рисунок з підписом уміщався на сторінці
        k = min(1.0, max_w / w_in, max_h / h_in) if w_in and h_in else 1.0
        p = self.d.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.keep_with_next = True
        try:
            p.add_run().add_picture(io.BytesIO(f.data), width=Emu(int(w_in * k * 914400)))
        except Exception as e:  # пошкоджений або непідтримуваний файл
            p.add_run(f"[рисунок не вставлено: {e.__class__.__name__}]").italic = True
            return
        cap = self.d.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.space_after = Pt(10)
        r = cap.add_run(f"Рис. {self.n_fig}")
        r.bold, r.font.size = True, Pt(10)
        text = f.caption or f.alt
        if text:
            r = cap.add_run(". " + text)
            r.font.size = Pt(10)
        if f.src and not f.src.startswith("data:"):
            cap.add_run(" (").font.size = Pt(10)
            add_hyperlink(cap, f.src, "джерело", size=Pt(10))
            cap.add_run(")").font.size = Pt(10)

    def code(self, c: Code) -> None:
        p = self.d.add_paragraph()
        p.paragraph_format.line_spacing = 1.0
        _shade(p._p.get_or_add_pPr(), "F2F2F2")
        for i, line in enumerate(c.text.split("\n")):
            if i:
                p.add_run().add_break()
            r = p.add_run(line)
            r.font.name, r.font.size = MONO, Pt(9.5)

    def citation(self, doc: Document, accessed: dt.date) -> None:
        """Бібліографічний запис за APA 7 (вебсторінка)."""
        host = urlparse(doc.url).hostname or ""
        site = doc.site or host
        author = doc.author or site
        year = doc.published[:4] if re.match(r"\d{4}", doc.published or "") else "б. д."
        p = self.d.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        r = p.add_run("Як цитувати (APA 7): ")
        r.bold, r.font.size = True, Pt(10)
        p.add_run(f"{author}. ({year}). ").font.size = Pt(10)
        r = p.add_run(doc.title or doc.url)
        r.italic, r.font.size = True, Pt(10)
        tail = "." if author == site else f". {site}."
        p.add_run(tail + " ").font.size = Pt(10)
        add_hyperlink(p, doc.url, doc.url, size=Pt(10))


def _date_uk(s: str) -> str:
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if not m:
        return s
    y, mo, d = map(int, m.groups())
    if 1 <= mo <= 12:
        return f"{d} {MONTHS[mo - 1]} {y} р."
    return s


# ------------------------------------------------------------------ точки входу

def build(docs: Iterable[Document], title: Optional[str] = None,
          accessed: Optional[dt.date] = None) -> bytes:
    """Один DOCX. Якщо документів кілька — титульна сторінка зі змістом, кожне джерело з нової сторінки."""
    docs = list(docs)
    accessed = accessed or dt.date.today()
    d = new_docx()
    _setup(d)
    ok = [x for x in docs if not x.error]
    bad = [x for x in docs if x.error]
    w = Writer(d)
    first = True
    if len(docs) > 1:
        d.add_paragraph(title or "Збірка матеріалів з вебсторінок", style="Title")
        p = d.add_paragraph()
        r = p.add_run(f"Джерел: {len(ok)}"
                      + (f" (не вдалося обробити: {len(bad)})" if bad else "")
                      + f". Дата звернення: {accessed.strftime('%d.%m.%Y')}.")
        r.font.size, r.font.color.rgb = Pt(10), GREY
        d.add_heading("Зміст", level=1)
        for i, x in enumerate(ok, 1):
            p = d.add_paragraph()
            p.paragraph_format.left_indent, p.paragraph_format.first_line_indent = Cm(0.9), Cm(-0.9)
            p.paragraph_format.tab_stops.add_tab_stop(Cm(0.9))
            p.add_run(f"{i}.\t{x.title or x.url}")
            p.add_run().add_break()
            add_hyperlink(p, x.url, x.url, size=Pt(9))
        if bad:
            d.add_heading("Не вдалося обробити", level=1)
            for x in bad:
                p = d.add_paragraph()
                add_hyperlink(p, x.url, x.url, size=Pt(10))
                r = p.add_run(f" — {x.error}")
                r.font.size, r.font.color.rgb = Pt(10), GREY
        first = False
    for x in ok:
        w.doc_header(x, accessed, page_break=not first)
        w.blocks(x)
        w.citation(x, accessed)
        first = False
    if not ok:
        d.add_paragraph("Жодну сторінку не вдалося обробити.")
    cp = d.core_properties
    cp.title = (title or (ok[0].title if len(ok) == 1 else "Збірка матеріалів з вебсторінок"))[:250]
    cp.author = ok[0].author[:250] if len(ok) == 1 and ok[0].author else "webparse"
    cp.comments = "Створено парсером webparse"
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def filename(doc: Document) -> str:
    """Безпечна назва файлу з назви сторінки (кирилиця зберігається)."""
    base = doc.title or urlparse(doc.url).hostname or "page"
    base = re.sub(r"[\\/:*?\"<>|\x00-\x1f]+", " ", base)
    base = re.sub(r"\s+", " ", base).strip(" .")[:90] or "page"
    return base + ".docx"
