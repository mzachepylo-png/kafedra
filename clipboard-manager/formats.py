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


def format_cards_added(text: str) -> str:
    """Числа (ID карток) → речення для звіту про підозрілий вхід.

    ``1245 1231, 236532`` → ``Cards 1245, 1231, 236532 were added during suspicious login.``
    ``23465``             → ``Card 23465 was added during suspicious login.``
    Дублікати зберігаються як введено. Порожній результат — якщо чисел немає."""
    nums = _NUMBERS.findall(text or "")
    if not nums:
        return ""
    if len(nums) == 1:
        return f"Card {nums[0]} was added during suspicious login."
    return f"Cards {', '.join(nums)} were added during suspicious login."


FORMATTERS = {
    "link_user": format_link_user,
    "cards_added": format_cards_added,
}

# Які кнопки має панель формату: copy — просто скопіювати результат;
# append — дописати результат до вибраного запису (і скопіювати вже склеєний текст)
FORMAT_ACTIONS = {
    "link_user": ("copy",),
    "cards_added": ("copy", "append"),
}


def format_actions(fmt_type: str) -> tuple[str, ...]:
    return FORMAT_ACTIONS.get(fmt_type, ("copy",))


def append_result(base: str, result: str) -> str:
    """Дописує результат форматування до тексту запису через пробіл (сам запис не змінюється)."""
    base = (base or "").rstrip()
    return f"{base} {result}" if base else result


def join_values(values, sep: str = ", ") -> str:
    """Об'єднує кілька значень в одне через кому: ``["1242", "1234"]`` → ``1242, 1234``."""
    return sep.join(v.strip() for v in values if v and v.strip())


def apply_format(fmt_type: str, text: str) -> str:
    fn = FORMATTERS.get(fmt_type)
    return fn(text) if fn else ""
