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
        return result + base[len(SUSPICIOUS_PREFIX):]
    return append_result(base, result)


# Блок «Refunds» (завжди видимий у правій колонці): пункти з галочками → одне речення.
# Перші два можна обирати разом; «Ignore billing check flag» і «No active subscriptions» — лише окремо
# (з іншими пунктами не поєднуються: вибір одного знімає решту).
REFUND_OPTIONS = ("Active subscriptions", "Internal charges")
IGNORE_OPTION = "Ignore billing check flag"
NO_ACTIVE_OPTION = "No active subscriptions"
STANDALONE_OPTIONS = (IGNORE_OPTION, NO_ACTIVE_OPTION)
REFUND_LABELS = {
    "Active subscriptions": "Active subscriptions were refunded",
    "Internal charges": "Internal charges were refunded",
    IGNORE_OPTION: "Ignore billing check flag was set",
    NO_ACTIVE_OPTION: "No active subscriptions",
}
STANDALONE_TEXT = {
    IGNORE_OPTION: "Ignore billing check flag was set.",
    NO_ACTIVE_OPTION: "No active subscriptions.",
}


def format_refunds(selected) -> str:
    """Active subscriptions were refunded. / Internal charges were refunded. /
    Active subscriptions and Internal charges were refunded. / Ignore billing check flag was set. /
    No active subscriptions.  Окремі пункти мають пріоритет і беруться лише самі."""
    chosen = set(selected or ())
    for opt in STANDALONE_OPTIONS:
        if opt in chosen:
            return STANDALONE_TEXT[opt]
    items = [o for o in REFUND_OPTIONS if o in chosen]
    if not items:
        return ""
    return f"{' and '.join(items)} were refunded."


FORMATTERS = {
    "link_user": format_link_user,
    "cards_added": format_cards_added,
    "suspicious_cards": format_suspicious_cards,
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
