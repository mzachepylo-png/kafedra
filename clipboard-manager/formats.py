"""Форматування: перетворення введеного тексту на готовий до вставки результат (без GUI)."""

from __future__ import annotations

import re

_NUMBERS = re.compile(r"\d+")


def format_link_user(text: str) -> str:
    """Приймає ID користувачів — поодинокі чи кілька, розділені комою та/або пробілами/переносами,
    у будь-якому вигляді, зокрема «User#123». З кожного значення береться лише число, і для кожного
    видається конструкція ``{LINK:USER:<число>:E}``; кілька конструкцій розділяються «, ».

    ``123, User#45312  23512`` → ``{LINK:USER:123:E}, {LINK:USER:45312:E}, {LINK:USER:23512:E}``
    Порожній результат — якщо в тексті немає жодного числа."""
    return ", ".join("{LINK:USER:%s:E}" % n for n in _NUMBERS.findall(text or ""))


FORMATTERS = {
    "link_user": format_link_user,
}


def apply_format(fmt_type: str, text: str) -> str:
    fn = FORMATTERS.get(fmt_type)
    return fn(text) if fn else ""
