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
_SUSPICIOUS_PREFIX_RE = re.compile(r"^\s*suspicious\s+(?:cards\s+were|card\s+was)\s+added\s*\.?", re.IGNORECASE)


def format_suspicious_cards(text: str) -> str:
    """Числа (ID карток) → ``Suspicious cards 1245, 1254, 2365 were added.``

    ``1246, 13254, 123, 124 13531`` → ``Suspicious cards 1246, 13254, 123, 124, 13531 were added.``
    ``1234`` (одне значення) → ``Suspicious card 1234 was added.``
    Порожній результат — якщо чисел немає."""
    nums = _NUMBERS.findall(text or "")
    if not nums:
        return ""
    if len(nums) == 1:
        return f"Suspicious card {nums[0]} was added."
    return f"Suspicious cards {', '.join(nums)} were added."


def append_suspicious_cards(base: str, result: str) -> str:
    """Append для «Suspicious cards»: у записі «Suspicious cards were added. Blacklisted, …» початок
    «Suspicious cards were added.» замінюється на результат форматування (з номерами), решта лишається:

    ``Suspicious cards were added. Blacklisted, unsolicited charges refunded`` + ``Suspicious cards 1245, 1254 were added.``
    → ``Suspicious cards 1245, 1254 were added. Blacklisted, unsolicited charges refunded``
    ``Suspicious cards were added. Blacklisted`` + ``Suspicious card 1245 was added.`` → ``Suspicious card 1245 was added. Blacklisted``
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
    if action_id == "suspicious" and len([v for v in re.split(r"[,\s]+", joined) if v]) == 1:
        return f"Suspicious card {joined} was added."      # одне значення — однина
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


# Запис історії, що складається лише з номерів (користувачі, картки, …): «214512 66413241, #124521», «User123»,
# «#User123», «User #5», «{LINK:USER:7:E}»; номери розділяються пробілами, «,», «.», «;» або «:».
_NUM_TOKEN = re.compile(r"\{LINK:[A-Z_]+:([0-9]+):E\}|#?\s*(?:[A-Za-z]+\s*)?#?\s*([0-9]+)|[\s,.;:]+")
MAX_RECENT_NUMBERS = 30


def numbers_of_entry(text: str) -> list[str] | None:
    """Номери з одного запису історії (у порядку тексту) або None, якщо в записі є ще щось, крім номерів і розділювачів."""
    s = (text or "").strip()
    if not s:
        return None
    pos, out = 0, []
    while pos < len(s):
        m = _NUM_TOKEN.match(s, pos)
        if not m or m.end() == pos:
            return None
        num = m.group(1) or m.group(2)
        if num:
            out.append(num)
        pos = m.end()
    return out or None


def recent_numbers(texts, limit: int = MAX_RECENT_NUMBERS) -> list[str]:
    """Номери з ОСТАННІХ записів історії (найновіший запис першим): записи з текстом на початку пропускаються,
    далі береться неперервна серія «номерних» записів (до першого запису з текстом). Без повторів, до ``limit``.

    ``["214512 66413241, #124521", "2141"]`` → ``["214512", "66413241", "124521", "2141"]``"""
    out: list[str] = []
    started = False
    for t in texts:
        nums = numbers_of_entry(t)
        if nums is None:
            if started:
                break
            continue
        started = True
        for n in nums:
            if n not in out:
                out.append(n)
                if len(out) >= limit:
                    return out
    return out


_USER_ENTRY = re.compile(r"^\s*(?:\{LINK:USER:([0-9]+):E\}|(?:user\s*#\s*)?([0-9]+))\s*$", re.IGNORECASE)


def user_ids_from_history(texts, limit: int = 8, split: bool = False) -> list[str]:
    """Користувачі для заглушок «___» по черзі (попередня механіка): записи історії, що є ОДНИМ користувачем
    (``{LINK:USER:1236:E}``, «User #1236» або просто число), найновіший першим, без повторів, до ``limit``;
    решта записів пропускається.

    ``split=True`` (галочка «Кілька чисел в одному записі — окремі користувачі»): запис лише з номерів
    («1245, 235636 135») дає кількох користувачів — у порядку тексту: 1245, 235636, 135."""
    out: list[str] = []
    for t in texts:
        if split:
            uids = numbers_of_entry(t) or []
        else:
            m = _USER_ENTRY.match(t or "")
            uids = [m.group(1) or m.group(2)] if m else []
        for uid in uids:
            if uid not in out:
                out.append(uid)
                if len(out) >= limit:
                    return out
    return out


_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")


def last_email(texts) -> str | None:
    """Найновіший email в історії буфера (перший email у найновішому записі, де він є)."""
    for t in texts:
        m = _EMAIL.search(t or "")
        if m:
            return m.group(0)
    return None


def last_user_id(texts) -> str | None:
    """Найновіший користувач з історії: ``{LINK:USER:1236:E}``, «User #1236», «#User12» або просто число «214»."""
    users = recent_numbers(texts, 1)
    return users[0] if users else None


def user_links(uids) -> str:
    """``["1", "2"]`` → ``{LINK:USER:1:E}, {LINK:USER:2:E}``."""
    return ", ".join(user_link(u) for u in uids if u)


def user_link(uid: str) -> str:
    return "{LINK:USER:%s:E}" % uid


_PLACEHOLDER = re.compile(r"_{3,}")


def has_user_placeholder(text: str) -> bool:
    """Текст із заглушкою «___» (3+ підкреслення) — такі записи за замовчуванням підставляють користувача з історії."""
    return bool(_PLACEHOLDER.search(text or ""))


_EMAIL_PLACEHOLDER = re.compile(r"(\be-?mail\s+)_{3,}", re.IGNORECASE)
MAX_USER_PLACEHOLDERS = 8


def fill_email(text: str, email: str | None) -> str:
    """«Email _____ was connected …» → «Email name@mail.com was connected …» (заглушка одразу після слова Email)."""
    if not email:
        return text
    return _EMAIL_PLACEHOLDER.sub(lambda m: m.group(1) + email, text or "")


def apply_user_link(text: str, uids, tail_uids=None) -> str:
    """Заглушки «___» (3+ підкреслення) → користувачі з історії ПО ЧЕРЗІ: перша — останній користувач,
    друга — передостанній … (до 8). Якщо користувачів менше, ніж заглушок, решта лишається «___».
    Без заглушки — дописує « in {LINK:USER:…:E}, {LINK:USER:…:E}» (усі користувачі з останніх записів) у кінець.
    ``uids`` — рядок або список (найновіший першим); ``tail_uids`` — користувачі для « in …» (типово — ``uids``)."""
    if isinstance(uids, str):
        uids = [uids]
    uids = [u for u in (uids or []) if u]
    if _PLACEHOLDER.search(text or ""):
        if not uids:
            return text
        users = uids[:MAX_USER_PLACEHOLDERS]
        used = 0

        def sub(m):
            nonlocal used
            if used < len(users):
                used += 1
                return user_link(users[used - 1])
            return m.group(0)
        return _PLACEHOLDER.sub(sub, text)
    tail = [u for u in (uids if tail_uids is None else tail_uids) or [] if u]
    if not tail:
        return text
    return f"{(text or '').rstrip()} in {user_links(tail)}"


def fill_placeholders(text: str, history_texts, split: bool = False) -> str:
    """Повне заповнення тексту з історії: спершу «Email ___» — останній email, потім «___» — користувачі по черзі."""
    texts = list(history_texts)
    out = fill_email(text, last_email(texts))
    return apply_user_link(out, user_ids_from_history(texts, split=split)) if _PLACEHOLDER.search(out) else out



# --------------------------------------------------------------------------- #
#  Теги в тексті: {{user}} — користувачі з буфера; власні теги {{назва}} — за прикладом «вхід → вихід»
# --------------------------------------------------------------------------- #
USER_TAG = "user"
MAX_TAG_NAME = 30
MAX_TAG_EXAMPLE = 300
MAX_PULL = 30            # найбільша кількість значень, яку можна задати для підтягування
_TAG_REF = re.compile(r"\{\{\s*([^{}:]{1,%d}?)\s*(?::\s*([0-9]{1,2})\s*)?\}\}" % MAX_TAG_NAME)
_TAG_NAME = re.compile(r"^[^{}:\s][^{}:]{0,%d}$" % (MAX_TAG_NAME - 1))


def tag_ref(name: str, count: int = 0) -> str:
    """``{{name}}`` — усі значення (або скільки задано в самому тезі); ``{{name:2}}`` — лише 2 найновіші."""
    return "{{%s:%d}}" % (name, count) if count else "{{%s}}" % name


def clean_count(value) -> int:
    """Кількість значень для підтягування: 0 — усі, інакше 1…MAX_PULL."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return 0
    return n if 0 < n <= MAX_PULL else 0


def take(values, count: int):
    """Перші ``count`` значень (0 — усі)."""
    values = list(values)
    return values[:count] if count else values


def tag_name_ok(name: str) -> bool:
    return bool(_TAG_NAME.match((name or "").strip()))


def _num_spans(out: str, nums) -> list[tuple[int, int]]:
    """Позиції номерів ``nums`` у тексті ``out`` по черзі (номер не може бути частиною довшого числа)."""
    spans, pos = [], 0
    for n in nums:
        m = re.compile(r"(?<![0-9])%s(?![0-9])" % re.escape(n)).search(out, pos)
        if not m:
            break
        spans.append((m.start(), m.end()))
        pos = m.end()
    return spans


def infer_tag(example_in: str, example_out: str) -> dict | None:
    """Шаблон тегу з прикладу: номери з входу шукаються у виході, решта виходу стає шаблоном.

    ``"1234"`` → ``"Card #1234 was blocked."``: для «11, 22» буде ``Card #11, #22 was blocked.``
    ``"1, 2"`` → ``"{LINK:CARD:1:E}; {LINK:CARD:2:E}"``: роздільник між номерами береться з прикладу.
    None — якщо у вході немає номерів або їх немає у виході."""
    nums = _NUMBERS.findall(example_in or "")
    out = example_out or ""
    spans = _num_spans(out, nums)
    if not spans:
        return None
    if len(spans) >= 2:
        return {"prefix": out[:spans[0][0]], "item_pre": "", "item_post": "",
                "sep": out[spans[0][1]:spans[1][0]], "suffix": out[spans[-1][1]:]}
    s, e = spans[0]
    before, after = out[:s], out[e:]
    pre = re.search(r"[^\s,;(\"']*$", before).group(0)
    post = re.match(r"[^\s,;]*", after).group(0).rstrip(".!?)\"'")
    return {"prefix": before[:len(before) - len(pre)], "item_pre": pre, "item_post": post,
            "sep": ", ", "suffix": after[len(post):]}


def render_tag(tpl: dict, nums) -> str:
    nums = [n for n in nums if n]
    if not nums or not tpl:
        return ""
    items = [tpl["item_pre"] + n + tpl["item_post"] for n in nums]
    return tpl["prefix"] + tpl["sep"].join(items) + tpl["suffix"]


def clean_tags(raw) -> list[dict]:
    """Власні теги пресета: [{id, name, ex_in, ex_out}] — лише ті, для яких вдається вивести шаблон."""
    import uuid
    out, seen = [], {USER_TAG}
    for t in raw if isinstance(raw, list) else []:
        if not isinstance(t, dict):
            continue
        name = str(t.get("name") or "").strip()
        ex_in, ex_out = str(t.get("ex_in") or "")[:MAX_TAG_EXAMPLE], str(t.get("ex_out") or "")[:MAX_TAG_EXAMPLE]
        if not tag_name_ok(name) or name.casefold() in seen or not infer_tag(ex_in, ex_out):
            continue
        seen.add(name.casefold())
        tag = {"id": str(t.get("id") or uuid.uuid4().hex), "name": name, "ex_in": ex_in, "ex_out": ex_out}
        if clean_count(t.get("count")):
            tag["count"] = clean_count(t.get("count"))     # скільки номерів брати за замовчуванням (немає — усі)
        out.append(tag)
    return out


def has_tags(text: str) -> bool:
    return bool(_TAG_REF.search(text or ""))


def resolve_tags(text: str, tags, history_texts) -> tuple[str, list[str]]:
    """Підставляє теги: {{user}} → користувачі з останніх записів буфера, власні — номери з тих самих записів
    за шаблоном тегу. ``{{назва:N}}`` — лише N найновіших номерів (без числа — скільки задано в тезі, інакше всі).
    Повертає (текст, назви тегів, для яких у буфері не знайшлось номерів — вони лишаються як є)."""
    if not has_tags(text):
        return text, []
    nums = recent_numbers(list(history_texts))
    by_name = {t["name"].casefold(): t for t in tags or ()}
    missing: list[str] = []

    def sub(m):
        name = m.group(1).strip()
        key = name.casefold()
        count = clean_count(m.group(2))
        if key == USER_TAG:
            val = user_links(take(nums, count))
        elif key in by_name:
            tag = by_name[key]
            val = render_tag(infer_tag(tag["ex_in"], tag["ex_out"]), take(nums, count or clean_count(tag.get("count"))))
        else:
            return m.group(0)                  # невідомий тег — текст як є
        if not val:
            missing.append(name)
            return m.group(0)
        return val
    return _TAG_REF.sub(sub, text), missing


# --------------------------------------------------------------------------- #
#  Копіпаста-конструктор: основний текст («стовбур») + дерево конструктів. Кожен конструкт — ПОВНИЙ текст
#  (продовження тексту батька); у вікні вибору показується лише нова частина. «None» — копіювати вже побудоване.
# --------------------------------------------------------------------------- #
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
CTOR_MAX_DEPTH = 8
CTOR_MAX_NODES = 80
CTOR_MAX_TEXT = 3000


def clean_ctor(raw) -> dict | None:
    """``{"options": [{id, text, children?}]}`` або None, якщо конструктів немає."""
    import uuid

    def clean_list(items, depth: int) -> list[dict]:
        out = []
        if not isinstance(items, list) or depth > CTOR_MAX_DEPTH:
            return out
        for n in items[:CTOR_MAX_NODES]:
            if not isinstance(n, dict) or not isinstance(n.get("text"), str) or not n["text"].strip():
                continue
            node = {"id": str(n.get("id") or uuid.uuid4().hex), "text": n["text"].strip()[:CTOR_MAX_TEXT]}
            if isinstance(n.get("color"), str) and _HEX.match(n["color"]):
                node["color"] = n["color"].lower()            # власний колір конструкту
            kids = clean_list(n.get("children"), depth + 1)
            if kids:
                node["children"] = kids
            out.append(node)
        return out

    opts = clean_list(raw.get("options") if isinstance(raw, dict) else None, 0)
    return {"options": opts} if opts else None


def ctor_label(parent: str, text: str) -> str:
    """Нова частина конструкту: текст без початку, що повторює текст батька (без урахування регістру й пробілів
    на межі). Якщо конструкт не починається з тексту батька — повний текст."""
    p, t = (parent or "").strip(), (text or "").strip()
    if p and t.casefold().startswith(p.casefold()):
        rest = t[len(p):].lstrip()
        if rest:
            return rest
    return t


def ctor_count(ctor: dict | None) -> int:
    def cnt(items):
        return sum(1 + cnt(n.get("children", [])) for n in items or [])
    return cnt((ctor or {}).get("options"))


# --------------------------------------------------------------------------- #
#  Фігури-позначки (чорні значки замість кружечка кольору): у папок — своя (випадкова, змінюється вручну),
#  у записів і конструктів — залежить від кольору
# --------------------------------------------------------------------------- #
SHAPES = ["●", "■", "▲", "◆", "★", "♥", "♠", "♣", "✚", "▼", "⬟", "⬢", "☀", "☂", "✿", "❖", "♪", "⚑", "☾", "✖",
          "✈", "☘", "❄", "☁", "✂", "✉", "☎", "♞", "♜", "☯", "⚙", "♛", "☢", "⚖", "✌", "☺", "⌘", "✦", "⚓", "✎"]
_COLOR_SHAPES = {"#0f6cbd": "●", "#107c10": "■", "#c239b3": "♥", "#d83b01": "▲", "#8764b8": "◆", "#038387": "♣",
                 "#986f0b": "★", "#e3008c": "✿", "#e81123": "✚", "#ffb900": "☀", "#00b294": "♠", "#69797e": "⬢"}


def shape_for_color(color: str | None) -> str:
    """Фігура для кольору: для стандартних кольорів — фіксована, для інших — стабільно за самим кольором."""
    if not color or not _HEX.match(color):
        return ""
    c = color.lower()
    if c in _COLOR_SHAPES:
        return _COLOR_SHAPES[c]
    return SHAPES[int(c[1:], 16) % len(SHAPES)]
