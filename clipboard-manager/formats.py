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


_USER_REF = re.compile(r"user\s*#\s*([0-9]+)", re.IGNORECASE)


_USER2 = re.compile(r"\{LINK:USER:[0-9]+:E\}|user\s*#\s*([0-9]+)|(?<![\w#{:])([0-9]+)(?![\w}])", re.IGNORECASE)


def format_user_text(text: str) -> str:
    """USER 2: довільний текст, у якому кожне «User #13513» («User#13513», «user # 13513») і кожне окреме число
    («214», як у USER) замінюється на ``{LINK:USER:13513:E}``; готові ``{LINK:USER:…:E}`` і решта тексту — без змін."""
    text = text or ""
    if not text.strip():
        return ""

    def sub(m):
        num = m.group(1) or m.group(2)
        return "{LINK:USER:%s:E}" % num if num else m.group(0)
    return _USER2.sub(sub, text)


SUSPICIOUS_PREFIX = "Suspicious cards were added."
_SUSPICIOUS_PREFIX_RE = re.compile(r"^\s*suspicious\s+cards\s+were\s+added\s*\.?", re.IGNORECASE)


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
    m = _SUSPICIOUS_PREFIX_RE.match(base)
    if m:                                   # регістр і зайві пробіли в початку запису не заважають
        rest = base[m.end():]
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


# --------------------------------------------------------------------------- #
#  «Об'єднати і копіювати» з історії: варіанти склеювання (реєстр; нові варіанти додаються сюди)
# --------------------------------------------------------------------------- #
# (id, підпис у меню, шаблон або None). Шаблон: {values} — обрані значення через кому, від старішого до новішого.
MERGE_ACTIONS = [
    ("suspicious", "Копіювати як Suspicious cards", "Suspicious cards {values} were added."),
    ("test", "Копіювати як Test cards", "Test cards {values} were added"),
    ("plain", "Об'єднати і копіювати", None),
]


def apply_merge(action_id: str, values) -> str:
    """Значення (у хронологічному порядку) → текст для буфера за варіантом ``action_id``."""
    joined = join_values(values)
    if not joined:
        return ""
    for aid, _label, template in MERGE_ACTIONS:
        if aid == action_id:
            return template.format(values=joined) if template else joined
    return joined


# --------------------------------------------------------------------------- #
#  Копіпасти v.2: основний текст + дерево аппендів
# --------------------------------------------------------------------------- #
V2_KINDS = ("end", "group", "addon")      # кінцевий · підгрупа (відкриває наступне вікно) · додатковий (з галочкою)
V2_MAX_DEPTH = 6
V2_MAX_NODES = 60
V2_MAX_TEXT = 1000


def clean_v2(raw) -> dict | None:
    """Перевіряє/нормалізує ``{"options": [вузли]}``; None, якщо аппендів немає. Вузол: {id, text, kind, join?, on?, children?}."""
    import uuid

    def clean_list(items, depth: int) -> list[dict]:
        out = []
        if not isinstance(items, list) or depth > V2_MAX_DEPTH:
            return out
        for n in items[:V2_MAX_NODES]:
            if not isinstance(n, dict) or not isinstance(n.get("text"), str) or not n["text"].strip():
                continue
            kind = n.get("kind") if n.get("kind") in V2_KINDS else "end"
            node = {"id": str(n.get("id") or uuid.uuid4().hex), "text": n["text"].strip()[:V2_MAX_TEXT], "kind": kind}
            if kind == "group":
                node["join"] = bool(n.get("join", True))      # чи додається текст самої підгрупи в результат
                node["children"] = clean_list(n.get("children"), depth + 1)
            elif kind == "addon":
                node["on"] = bool(n.get("on", False))          # увімкнений за замовчуванням
            out.append(node)
        return out

    opts = clean_list(raw.get("options") if isinstance(raw, dict) else None, 0)
    return {"options": opts} if opts else None


def v2_compose(main: str, steps, addons) -> str:
    """Основний текст + обрані аппенди (у порядку кліків) + позначені додаткові — через пробіл."""
    parts = [main or "", *steps, *addons]
    return " ".join(p.strip() for p in parts if p and p.strip())


# --------------------------------------------------------------------------- #
#  Дані з історії буфера (найновіші — першими)
# --------------------------------------------------------------------------- #
_NUMERIC_ENTRY = re.compile(r"^[0-9][0-9,\s]*$")
# формати, що з порожнім полем беруть останні числові значення з історії
AUTO_HISTORY_FORMATS = {"suspicious_cards", "cards_added"}


def numbers_from_history(texts) -> str:
    """Останні поспіль числові записи історії (найновіший першим) → «123, 542, 1234, 2365, 4562».
    Числовий запис — лише цифри, коми й пробіли; перший запис з будь-яким іншим знаком (текст, крапка, дефіс…) — стоп."""
    nums: list[str] = []
    for t in texts:
        s = (t or "").strip()
        if not s or not _NUMERIC_ENTRY.match(s):
            break
        nums += _NUMBERS.findall(s)
    return ", ".join(nums)


_USER_ENTRY = re.compile(r"^\s*(?:\{LINK:USER:([0-9]+):E\}|(?:user\s*#\s*)?([0-9]+))\s*$", re.IGNORECASE)


def last_user_id(texts) -> str | None:
    """Найновіший запис історії, що є користувачем: ``{LINK:USER:1236:E}``, «User #1236» або просто число «214»."""
    for t in texts:
        m = _USER_ENTRY.match(t or "")
        if m:
            return m.group(1) or m.group(2)
    return None


def user_link(uid: str) -> str:
    return "{LINK:USER:%s:E}" % uid


_PLACEHOLDER = re.compile(r"_{3,}")


def has_user_placeholder(text: str) -> bool:
    """Текст із заглушкою «___» (3+ підкреслення) — такі записи за замовчуванням підставляють користувача з історії."""
    return bool(_PLACEHOLDER.search(text or ""))


def apply_user_link(text: str, uid: str | None) -> str:
    """Кожна заглушка «___________» (3+ підкреслення) будь-де в тексті → ``{LINK:USER:214:E}``:
    «… in deleted duplicate account ___________. Clawback …» → «… account {LINK:USER:214:E}. Clawback …».
    Без заглушки — дописує « in {LINK:USER:214:E}» у кінець."""
    if not uid:
        return text
    link = user_link(uid)
    if _PLACEHOLDER.search(text or ""):
        return _PLACEHOLDER.sub(lambda m: link, text)
    return f"{(text or '').rstrip()} in {link}"

