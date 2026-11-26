"""Модель документа: сторінка → послідовність блоків (заголовок, абзац, список, таблиця, рисунок…)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Union


@dataclass
class Run:
    """Фрагмент тексту з однаковим оформленням."""
    text: str
    bold: bool = False
    italic: bool = False
    code: bool = False
    sup: bool = False
    sub: bool = False
    href: Optional[str] = None

    def same_style(self, o: "Run") -> bool:
        return (self.bold, self.italic, self.code, self.sup, self.sub, self.href) == \
               (o.bold, o.italic, o.code, o.sup, o.sub, o.href)


@dataclass
class Heading:
    level: int
    runs: list[Run]


@dataclass
class Paragraph:
    runs: list[Run]


@dataclass
class ListItem:
    runs: list[Run]
    children: list["ListBlock"] = field(default_factory=list)


@dataclass
class ListBlock:
    ordered: bool
    items: list[ListItem]
    start: int = 1


@dataclass
class Cell:
    runs: list[Run]
    colspan: int = 1
    rowspan: int = 1
    header: bool = False


@dataclass
class Table:
    rows: list[list[Cell]]
    caption: str = ""

    @property
    def n_cols(self) -> int:
        """Кількість стовпців з урахуванням colspan/rowspan."""
        return len(self.grid()[0]) if self.rows else 0

    def grid(self) -> list[list[Optional[tuple[int, int]]]]:
        """Сітка: для кожної позиції — (рядок, індекс) вихідної Cell, що її займає, або None."""
        occ: dict[tuple[int, int], tuple[int, int]] = {}
        n = len(self.rows)
        for r, row in enumerate(self.rows):
            c = 0
            for ci, cell in enumerate(row):
                while (r, c) in occ:
                    c += 1
                for dr in range(cell.rowspan):
                    for dc in range(cell.colspan):
                        if r + dr < n:
                            occ[(r + dr, c + dc)] = (r, ci)
                c += cell.colspan
        width = max((k[1] for k in occ), default=-1) + 1
        return [[occ.get((r, c)) for c in range(width)] for r in range(n)]


@dataclass
class Figure:
    """Зображення, графік чи діаграма."""
    src: str = ""                 # адреса джерела (або "" для вбудованого SVG/canvas)
    data: Optional[bytes] = None  # PNG/JPEG/GIF, готові до вставлення в DOCX
    width: int = 0                # розмір у пікселях (після завантаження)
    height: int = 0
    alt: str = ""
    caption: str = ""
    kind: str = "image"           # image | chart
    error: str = ""               # чому не вдалося отримати зображення
    candidates: list[str] = field(default_factory=list)  # адреси від найкращої (велика версія, srcset)
    raw_svg: Optional[bytes] = None  # вбудований <svg>, ще не перетворений у PNG
    scale: float = 1.0            # пікселів на CSS-піксель (знімки браузера — 2)


@dataclass
class Code:
    text: str


@dataclass
class Quote:
    runs: list[Run]


Block = Union[Heading, Paragraph, ListBlock, Table, Figure, Code, Quote]


@dataclass
class Document:
    url: str
    title: str = ""
    author: str = ""
    published: str = ""
    site: str = ""
    lang: str = ""
    description: str = ""
    blocks: list[Block] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    error: str = ""

    # --- статистика для інтерфейсу ---
    def stats(self) -> dict:
        words = 0
        n_tab = n_fig = n_chart = 0

        def count(runs):
            return sum(len(r.text.split()) for r in runs)

        def walk_list(lb: ListBlock):
            nonlocal words
            for it in lb.items:
                words += count(it.runs)
                for ch in it.children:
                    walk_list(ch)

        for b in self.blocks:
            if isinstance(b, (Heading, Paragraph, Quote)):
                words += count(b.runs)
            elif isinstance(b, ListBlock):
                walk_list(b)
            elif isinstance(b, Table):
                n_tab += 1
                for row in b.rows:
                    for c in row:
                        words += count(c.runs)
            elif isinstance(b, Figure):
                if b.data:
                    n_fig += 1
                    n_chart += b.kind == "chart"
            elif isinstance(b, Code):
                words += len(b.text.split())
        return {"words": words, "tables": n_tab, "figures": n_fig, "charts": n_chart}

    def plain_text(self) -> str:
        """Простий текст (для швидкого перегляду й тестів)."""
        out = [self.title] if self.title else []

        def t(runs):
            return "".join(r.text for r in runs)

        def walk_list(lb, depth=0):
            for i, it in enumerate(lb.items):
                mark = f"{lb.start + i}." if lb.ordered else "•"
                out.append("  " * depth + f"{mark} {t(it.runs)}")
                for ch in it.children:
                    walk_list(ch, depth + 1)

        for b in self.blocks:
            if isinstance(b, (Heading, Paragraph, Quote)):
                out.append(t(b.runs))
            elif isinstance(b, ListBlock):
                walk_list(b)
            elif isinstance(b, Table):
                for row in b.rows:
                    out.append(" | ".join(t(c.runs) for c in row))
            elif isinstance(b, Figure):
                out.append(f"[{'Графік' if b.kind == 'chart' else 'Рисунок'}: {b.caption or b.alt or b.src}]")
            elif isinstance(b, Code):
                out.append(b.text)
        return "\n".join(out)
