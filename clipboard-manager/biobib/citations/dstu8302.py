"""Форматування бібліографічних посилань за ДСТУ 8302:2015.

Підтримує мовну адаптацію (українська / англійська / інша) та налаштовуване
правило для 4 і більше авторів.
"""

from __future__ import annotations

import re
from typing import Any, Mapping, Sequence


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _ensure_period(text: str) -> str:
    text = text.strip()
    if not text:
        return ""
    if text[-1] in ".!?":
        return text
    return f"{text}."


def _normalize_pages(pages: str) -> str:
    """Замінює звичайний дефіс у діапазонах сторінок на коротке тире (en-dash)."""
    pages = pages.strip()
    if not pages:
        return ""
    return re.sub(r"(\d+)\s*-\s*(\d+)", r"\1–\2", pages)


def _normalize_doi(doi: str) -> str:
    doi = doi.strip()
    if not doi:
        return ""
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.IGNORECASE)
    doi = re.sub(r"^doi:\s*", "", doi, flags=re.IGNORECASE)
    return doi.strip()


def _format_accessed_date(date_str: str) -> str:
    """Перетворює YYYY-MM-DD у DD.MM.YYYY; якщо формат уже інший — лишає як є."""
    date_str = date_str.strip()
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if m:
        return f"{m.group(3)}.{m.group(2)}.{m.group(1)}"
    return date_str


def _is_english(language: str) -> bool:
    return (language or "").strip().lower() in {"en", "eng", "english"}


def _format_single_author(author: Mapping[str, Any]) -> str:
    family = _clean(author.get("family"))
    initials = _clean(author.get("given_initials"))
    if family and initials:
        return f"{family} {initials}"
    return family or initials


def _format_author_inverted_for_slash(author: Mapping[str, Any]) -> str:
    """Формат 'І. І. Прізвище' для запису після косої риски (за назвою)."""
    family = _clean(author.get("family"))
    initials = _clean(author.get("given_initials"))
    if initials and family:
        return f"{initials} {family}"
    return family or initials


def _split_authors_and_editors(
    authors: Sequence[Mapping[str, Any]],
) -> tuple[list[Mapping[str, Any]], list[Mapping[str, Any]]]:
    primary: list[Mapping[str, Any]] = []
    editors: list[Mapping[str, Any]] = []
    for a in authors:
        role = _clean(a.get("role") or "author").lower()
        if role == "editor":
            editors.append(a)
        else:
            primary.append(a)
    return primary, editors


def _format_authors_block(
    authors: Sequence[Mapping[str, Any]],
    language: str,
    four_plus_mode: str = "first_3_et_al",
) -> tuple[str, str]:
    """Повертає (блок_авторів_на_початку, блок_після_косої_риски).

    Режими four_plus_mode для >= 4 авторів:
      - 'first_3_et_al': перші 3 автори + 'та ін.' / 'et al.'
      - 'first_1_et_al': перший автор + 'та ін.' / 'et al.'
      - 'all': усі автори на початку
      - 'title_first': опис під назвою, а після '/' — перший автор + 'та ін.' / 'et al.'
    """
    if not authors:
        return "", ""

    et_al = "et al." if _is_english(language) else "та ін."
    formatted = [_format_single_author(a) for a in authors if _format_single_author(a)]
    if not formatted:
        return "", ""

    if len(formatted) < 4 or four_plus_mode == "all":
        return _ensure_period(", ".join(formatted)), ""

    if four_plus_mode == "first_1_et_al":
        return f"{formatted[0]} {et_al}", ""

    if four_plus_mode == "title_first":
        first_slash = _format_author_inverted_for_slash(authors[0])
        return "", f"/ {first_slash} {et_al}"

    # default: first_3_et_al
    return f"{', '.join(formatted[:3])} {et_al}", ""


def format_dstu8302(
    source: Mapping[str, Any],
    four_plus_mode: str = "first_3_et_al",
) -> str:
    """Форматує повне бібліографічне посилання за ДСТУ 8302:2015."""
    src_type = _clean(source.get("type") or "article").lower()
    language = _clean(source.get("language") or "uk").lower()
    is_en = _is_english(language)

    title = _clean(source.get("title"))
    subtitle = _clean(source.get("subtitle"))
    container = _clean(source.get("container_title"))
    publisher = _clean(source.get("publisher"))
    place = _clean(source.get("place"))
    year = _clean(source.get("year"))
    volume = _clean(source.get("volume"))
    issue = _clean(source.get("issue"))
    pages = _normalize_pages(_clean(source.get("pages")))
    page_count = _clean(source.get("page_count"))
    doi = _normalize_doi(_clean(source.get("doi")))
    isbn = _clean(source.get("isbn"))
    url = _clean(source.get("url"))
    accessed = _format_accessed_date(_clean(source.get("accessed_date")))

    raw_authors = source.get("authors") or []
    authors, editors = _split_authors_and_editors(raw_authors)
    authors_prefix, slash_block = _format_authors_block(
        authors, language=language, four_plus_mode=four_plus_mode
    )

    title_with_sub = f"{title} : {subtitle}" if (title and subtitle) else title
    if slash_block and title_with_sub:
        title_block = _ensure_period(f"{title_with_sub} {slash_block}")
    else:
        title_block = _ensure_period(title_with_sub)

    parts: list[str] = []

    if src_type == "web":
        if authors_prefix:
            parts.append(authors_prefix)
        if title_block:
            parts.append(title_block)
        if container:
            parts.append(_ensure_period(container))
        if url:
            if accessed:
                access_label = "date of access" if is_en else "дата звернення"
                parts.append(f"URL: {url} ({access_label}: {accessed}).")
            else:
                parts.append(f"URL: {url}.")
        if doi:
            parts.append(f"DOI: {doi}.")
        return " ".join(p for p in parts if p)

    if src_type == "book":
        if authors_prefix:
            parts.append(authors_prefix)
        if title_block:
            parts.append(title_block[:-1] if editors and title_block.endswith(".") else title_block)
        if editors:
            ed_label = "ed. by" if is_en else "за ред."
            ed_names = ", ".join(_format_author_inverted_for_slash(e) for e in editors)
            parts.append(_ensure_period(f"/ {ed_label} {ed_names}"))

        imprint = _format_imprint(place, publisher, year)
        if imprint:
            parts.append(_ensure_period(imprint))

        if page_count:
            p_unit = "p." if is_en else "с."
            parts.append(f"{page_count} {p_unit}")
        if doi:
            parts.append(f"DOI: {doi}.")
        elif url:
            parts.append(_format_url_tail(url, accessed, is_en))
        return " ".join(p for p in parts if p)

    if src_type == "book_chapter":
        if authors_prefix:
            parts.append(authors_prefix)
        if title_block:
            parts.append(title_block)
        if container:
            parts.append(_ensure_period(container))
        imprint = _format_imprint(place, publisher, year)
        if imprint:
            parts.append(_ensure_period(imprint))
        if pages:
            p_prefix = "P." if is_en else "С."
            parts.append(f"{p_prefix} {pages}.")
        if doi:
            parts.append(f"DOI: {doi}.")
        elif url:
            parts.append(_format_url_tail(url, accessed, is_en))
        return " ".join(p for p in parts if p)

    if src_type in {"conference", "thesis", "abstract"}:
        if authors_prefix:
            parts.append(authors_prefix)
        if title_block:
            parts.append(title_block)
        if container:
            parts.append(_ensure_period(container))
        imprint = _format_imprint(place, publisher, year)
        if imprint:
            parts.append(_ensure_period(imprint))
        if pages:
            p_prefix = "P." if is_en else "С."
            parts.append(f"{p_prefix} {pages}.")
        elif page_count:
            p_unit = "p." if is_en else "с."
            parts.append(f"{page_count} {p_unit}")
        if doi:
            parts.append(f"DOI: {doi}.")
        elif url:
            parts.append(_format_url_tail(url, accessed, is_en))
        return " ".join(p for p in parts if p)

    if src_type in {"standard", "normative", "patent", "database"}:
        if authors_prefix:
            parts.append(authors_prefix)
        if title_block:
            parts.append(title_block)
        if container:
            parts.append(_ensure_period(container))
        imprint = _format_imprint(place, publisher, year)
        if imprint:
            parts.append(_ensure_period(imprint))
        if pages:
            p_prefix = "P." if is_en else "С."
            parts.append(f"{p_prefix} {pages}.")
        elif page_count:
            p_unit = "p." if is_en else "с."
            parts.append(f"{page_count} {p_unit}")
        if doi:
            parts.append(f"DOI: {doi}.")
        if url:
            parts.append(_format_url_tail(url, accessed, is_en))
        return " ".join(p for p in parts if p)

    # Default: journal article ('article') and 'other'
    if authors_prefix:
        parts.append(authors_prefix)
    if title_block:
        parts.append(title_block)
    if container:
        parts.append(_ensure_period(container))
    if year:
        parts.append(f"{year}.")

    vol_issue = _format_vol_issue(volume, issue, is_en)
    if vol_issue:
        parts.append(f"{vol_issue}.")

    if pages:
        if re.match(r"(?i)^(art\.|article\b|ст\.|стаття\b)", pages):     # номер статті: «Art. 1861»
            parts.append(_ensure_period(pages))
        else:
            p_prefix = "P." if is_en else "С."
            parts.append(f"{p_prefix} {pages}.")

    if doi:
        parts.append(f"DOI: {doi}.")
    elif url:
        parts.append(_format_url_tail(url, accessed, is_en))

    return " ".join(p for p in parts if p)


def _format_imprint(place: str, publisher: str, year: str) -> str:
    if place and publisher and year:
        return f"{place} : {publisher}, {year}"
    if place and publisher:
        return f"{place} : {publisher}"
    if place and year:
        return f"{place}, {year}"
    if publisher and year:
        return f"{publisher}, {year}"
    return place or publisher or year


def _format_vol_issue(volume: str, issue: str, is_en: bool) -> str:
    vol_label = "Vol." if is_en else "Т."
    iss_label = "no." if is_en else "№"
    if volume and issue:
        return f"{vol_label} {volume}, {iss_label} {issue}"
    if volume:
        return f"{vol_label} {volume}"
    if issue:
        return f"{iss_label} {issue}"
    return ""


def _format_url_tail(url: str, accessed: str, is_en: bool) -> str:
    if accessed:
        access_label = "date of access" if is_en else "дата звернення"
        return f"URL: {url} ({access_label}: {accessed})."
    return f"URL: {url}."


def format_in_text_citation(
    source: Mapping[str, Any],
    number: int | None = None,
    style: str = "dstu8302",
    page: str | None = None,
) -> str:
    """Повертає внутрішньотекстове посилання: [12] або [12, с. 5] / (Smith, 2019)."""
    page_clean = _clean(page)
    is_en = _is_english(_clean(source.get("language") or "uk"))

    if style in {"dstu8302", "vancouver"}:
        num_str = str(number) if number is not None else str(source.get("id", "?"))
        if page_clean:
            p_lbl = "p." if is_en else "с."
            return f"[{num_str}, {p_lbl} {page_clean}]"
        return f"[{num_str}]"

    # Author-year style (APA / Harvard)
    raw_authors = [
        a for a in (source.get("authors") or [])
        if _clean(a.get("role") or "author").lower() != "editor"
    ]
    year = _clean(source.get("year")) or ("n.d." if is_en else "б. р.")
    if not raw_authors:
        short_title = _clean(source.get("title"))[:30]
        base = f"{short_title}, {year}"
    elif len(raw_authors) == 1:
        base = f"{_clean(raw_authors[0].get('family'))}, {year}"
    elif len(raw_authors) == 2:
        f1 = _clean(raw_authors[0].get("family"))
        f2 = _clean(raw_authors[1].get("family"))
        sep = " & " if style == "apa" else (" and " if is_en else " та ")
        base = f"{f1}{sep}{f2}, {year}"
    else:
        et_al = "et al." if is_en else "та ін."
        base = f"{_clean(raw_authors[0].get('family'))} {et_al}, {year}"

    if page_clean:
        p_lbl = "p." if is_en else "с."
        return f"({base}, {p_lbl} {page_clean})"
    return f"({base})"
