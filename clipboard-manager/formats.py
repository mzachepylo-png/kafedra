"""Форматування: перетворення введеного тексту на готовий до вставки результат (без GUI)."""

from __future__ import annotations

import re

_NUMBERS = re.compile(r"[0-9]+")


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


def format_test_cards(text: str) -> str:
    """Числа → ``Test cards 214521, 1542, 12541 were added`` (без крапки наприкінці). Порожньо, якщо чисел немає."""
    nums = _NUMBERS.findall(text or "")
    return f"Test cards {', '.join(nums)} were added" if nums else ""


_USER_REF = re.compile(r"user\s*#\s*([0-9]+)", re.IGNORECASE)


def format_user_text(text: str) -> str:
    """Довільний текст, у якому кожне «User #13513» (також «User#13513», «user # 13513») замінюється на
    ``{LINK:USER:13513:E}``; решта тексту лишається без змін."""
    text = text or ""
    return _USER_REF.sub(lambda m: "{LINK:USER:%s:E}" % m.group(1), text) if text.strip() else ""


SUSPICIOUS_PREFIX = "Suspicious cards were added."


def format_suspicious_cards(text: str) -> str:
    """Числа (ID карток) → ``Suspicious cards 1245, 1254, 2365 were added.``

    ``1246, 13254, 123, 124 13531`` → ``Suspicious cards 1246, 13254, 123, 124, 13531 were added.``
    Порожній результат — якщо чисел немає."""
    nums = _NUMBERS.findall(text or "")
    return f"Suspicious cards {', '.join(nums)} were added." if nums else ""


def append_suspicious_cards(base: str, result: str) -> str:
    """Append для «Suspicious cards»: у записі «Suspicious cards were added. Blacklisted, …» початок
    «Suspicious cards were added.» замінюється на результат форматування (з номерами), решта лишається:

    ``Suspicious cards were added. Blacklisted, unsolicited charges refunded`` + ``Suspicious cards 1245, 1254 were added.``
    → ``Suspicious cards 1245, 1254 were added. Blacklisted, unsolicited charges refunded``
    Якщо запис починається інакше — результат просто дописується в кінець."""
    base = (base or "").strip()
    if base.casefold().startswith(SUSPICIOUS_PREFIX.casefold()):
        rest = base[len(SUSPICIOUS_PREFIX):]
        return result + (" " + rest if rest and not rest[0].isspace() else rest)
    return append_result(base, result)


def compose_phrases(chosen) -> str:
    """Швидкі фрази → готовий текст. ``chosen`` — список фраз {text, part?} у порядку, в якому вони лежать у пресеті.

    Фрази з "part" поєднуються: Active subscriptions + Internal charges →
    ``Active subscriptions and Internal charges were refunded.``; одна — ``Internal charges were refunded.``
    Фраза без "part" — окрема: якщо вона є серед обраних, береться лише вона (текст як є)."""
    chosen = list(chosen or ())
    for p in chosen:
        if not p.get("part"):
            return (p.get("text") or "").strip()
    parts = [p["part"] for p in chosen]
    return f"{' and '.join(parts)} were refunded." if parts else ""


FORMATTERS = {
    "link_user": format_link_user,
    "cards_added": format_cards_added,
    "suspicious_cards": format_suspicious_cards,
    "test_cards": format_test_cards,
    "link_user_text": format_user_text,
}

# Які кнопки має панель формату: copy — просто скопіювати результат;
# append — дописати результат до вибраного запису (і скопіювати вже склеєний текст)
FORMAT_ACTIONS = {
    "link_user": ("copy",),
    "cards_added": ("copy", "append"),
    "suspicious_cards": ("copy", "append"),
}

# Формати, у яких Append склеює текст не просто через пробіл
APPENDERS = {
    "suspicious_cards": lambda base, result: append_suspicious_cards(base, result),
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
