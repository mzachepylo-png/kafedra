#!/usr/bin/env python3
"""Генератор сторінки конспекту «Молекулярна генетика рослин».

Вхід:   tools/mgen/source.md      — конспект лекцій 1–5 (Markdown)
        tools/mgen/figs/*.html    — рисунки й інтерактивні блоки (підставляються за {{fig:назва}})
        tools/mgen/meta.json      — «Головне» для розділів, контрольні питання, джерела
        tools/mgen/credits.json   — авторство й ліцензії фото (формується під час завантаження з Commons)
        tools/mgen/captions.json  — підписи до фото
Вихід:  konspekt/plant-molecular-genetics/index.html

Запуск:  python3 tools/mgen/build.py
Щоб додати лекції 6–13, допишіть їх у source.md в тому ж форматі (## Лекція N. …, ### N.M. …) і перезберіть.
"""
import html
import json
import re
from pathlib import Path

from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parents[2]
T = ROOT / 'tools' / 'mgen'
OUT = ROOT / 'konspekt' / 'plant-molecular-genetics' / 'index.html'
SLUG = 'plant-molecular-genetics'

md = MarkdownIt('commonmark').enable('table')
esc = html.escape


def load(name, default):
    p = T / name
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else default


META = load('meta.json', {})
CREDITS = load('credits.json', {})
CAPTIONS = load('captions.json', {})

# ------------------------------------------------------------------ розбір джерела
SRC = (T / 'source.md').read_text(encoding='utf-8')
RE_LEC = re.compile(r'^## Лекція (\d+)\. (.+)$')
RE_SEC = re.compile(r'^### (\d+)\.(\d+)\. (.+?)(?: \(\[([~\d:]+)\]\((.+?)\)\))?$')

lectures = []
cur_lec = cur_sec = None
for line in SRC.split('\n'):
    m = RE_LEC.match(line)
    if m:
        cur_lec = dict(n=int(m.group(1)), title=m.group(2).strip(), intro=[], secs=[], video='', terms='')
        lectures.append(cur_lec)
        cur_sec = None
        continue
    if cur_lec is None:
        continue
    m = RE_SEC.match(line)
    if m:
        cur_sec = dict(lec=int(m.group(1)), n=int(m.group(2)), title=m.group(3).strip(), tc=m.group(4), url=m.group(5), body=[])
        cur_lec['secs'].append(cur_sec)
        continue
    if line.strip() == '---':
        cur_sec = None if cur_sec is None else cur_sec
        continue
    (cur_sec['body'] if cur_sec else cur_lec['intro']).append(line)

# ключові терміни, відео
for L in lectures:
    for bucket in ([L['intro']] + [s['body'] for s in L['secs']]):
        for i, ln in enumerate(bucket):
            if ln.startswith('**Ключові терміни'):
                L['terms'] = re.sub(r'^\*\*Ключові терміни[^*]*\*\*\s*', '', ln).rstrip('.')
                bucket[i] = ''
    vid = next((x for x in L['intro'] if x.startswith('**Відео:**')), '')
    mm = re.findall(r'\[(YouTube|Teach-in)\]\((.+?)\)', vid)
    L['links'] = dict(mm)
    d = re.search(r'· (\d\d\.\d\d\.\d{4}) · ([\d:]+)', vid)
    L['date'], L['dur'] = (d.group(1), d.group(2)) if d else ('', '')
    L['intro'] = [x for x in L['intro'] if not x.startswith('**Відео:**')]


def split_terms(s):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '(': depth += 1
        if ch in ')': depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur.strip()); cur = ''
        else:
            cur += ch
    if cur.strip(): out.append(cur.strip())
    return out


# ------------------------------------------------------------------ рендер
def fig(name, optional=False):
    p = T / 'figs' / f'{name}.html'
    if not p.exists():
        if not optional: print('  ! немає рисунка', name)
        return ''
    return p.read_text(encoding='utf-8')


def photo_fig(keys, cls=''):
    """Галерея фото за ключами credits.json; пропускає відсутні."""
    items = []
    for k in keys:
        c = CREDITS.get(k)
        cap = CAPTIONS.get(k)
        if not c or not cap or not (ROOT / 'assets' / 'img' / 'mgen' / f'{k}.webp').exists():
            if not c: print('  ! немає фото', k)
            continue
        artist = c['artist'] or 'невідомий автор'
        lic = c['lic'] or ''
        credit = f'<a href="{esc(c["url"])}" target="_blank" rel="noopener">{esc(artist[:60])}</a> · {esc(lic)}'
        full = f'{cap["t"]}. Фото: {artist[:60]}, Wikimedia Commons · {lic}'
        items.append(
            f'<figure class="mg-ph"><a href="../../assets/img/mgen/{k}.webp" data-lightbox data-caption="{esc(full)}" aria-label="Відкрити фото в повному розмірі">'
            f'<img src="../../assets/img/mgen/{k}.webp" alt="{esc(cap.get("alt", cap["t"]))}" width="{c["w"]}" height="{c["h"]}" loading="lazy" decoding="async"></a>'
            f'<figcaption>{cap["t"]}.<span class="mg-cred">{credit}</span></figcaption></figure>')
    if not items:
        return ''
    return f'<div class="mg-gal {cls}">' + ''.join(items) + '</div>'


def render_md(text):
    out = md.render(text)
    out = out.replace('<table>', '<div class="data-wrap"><table class="data-table mg-table">').replace('</table>', '</table></div>')
    out = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', out)

    def sub_fig(m):
        return fig(m.group(1).strip())

    def sub_ph(m):
        parts = [x.strip() for x in m.group(1).split('|')]
        cls = ''
        if parts and parts[0].startswith('cls='):
            cls = parts.pop(0)[4:]
        return photo_fig(parts, cls)

    out = re.sub(r'<p>\{\{fig:(.+?)\}\}</p>', sub_fig, out)
    out = re.sub(r'<p>\{\{photos:(.+?)\}\}</p>', sub_ph, out)
    # заголовки 4-го рівня → h4
    return out


def sec_html(L, S):
    sid = f'l{S["lec"]}-{S["n"]}'
    body = '\n'.join(S['body']).strip()
    # блоки «🖼 Візуалізація» → рисунки за ключем розділу (або явні {{fig:...}})
    k = [0]

    def vis(m):
        k[0] += 1
        name = f'{sid}' if k[0] == 1 else f'{sid}-{k[0]}'
        return '{{fig:%s}}' % name if (T / 'figs' / f'{name}.html').exists() else ''

    body = re.sub(r'^> 🖼 .*$', vis, body, flags=re.M)
    tc = ''
    if S['tc']:
        tc = (f'<a class="mg-tc" href="{esc(S["url"])}" target="_blank" rel="noopener" '
              f'title="Відкрити цей фрагмент відеолекції на YouTube">▶ {esc(S["tc"])}</a>')
    key = META.get('key', {}).get(sid, '')
    keyhtml = f'<p class="mg-key"><b>Головне.</b> {key}</p>' if key else ''
    return (f'<section class="mg-sec" id="{sid}" data-title="{esc(S["title"])}" data-n="{S["lec"]}.{S["n"]}">'
            f'<h3 class="mg-h"><a class="mg-anchor" href="#{sid}" aria-label="Посилання на розділ"><span class="n">{S["lec"]}.{S["n"]}</span></a>'
            f'<span class="mg-h__t">{inline(S["title"])}</span>{tc}</h3>{keyhtml}'
            f'<div class="prose mg-prose">{render_md(body)}</div></section>')


def inline(s):
    return md.renderInline(s)


def lec_html(L, i):
    lid = f'l{L["n"]}'
    links = L['links']
    meta = (f'<div class="mg-meta"><span>🎬 Відеолекція {L["date"]} · {L["dur"]}</span>'
            + (f'<a href="{esc(links["YouTube"])}" target="_blank" rel="noopener">YouTube</a>' if 'YouTube' in links else '')
            + (f'<a href="{esc(links["Teach-in"])}" target="_blank" rel="noopener">Teach-in</a>' if 'Teach-in' in links else '')
            + '</div>')
    intro = render_md('\n'.join(L['intro']).strip()) if ''.join(L['intro']).strip() else ''
    nav_sections = ''.join(f'<li><a href="#l{L["n"]}-{s["n"]}"><span>{L["n"]}.{s["n"]}</span>{inline(s["title"])}</a></li>' for s in L['secs'])
    secs = '\n'.join(sec_html(L, s) for s in L['secs'])
    terms = ''.join(f'<li>{inline(t)}</li>' for t in split_terms(L['terms']))
    qa = ''.join(f'<details><summary><span>{q}</span></summary><div>{a}</div></details>' for q, a in META.get('qa', {}).get(lid, []))
    prev = lectures[i - 1] if i > 0 else None
    nxt = lectures[i + 1] if i + 1 < len(lectures) else None
    pn = '<nav class="mg-pn" aria-label="Перехід між лекціями">'
    pn += (f'<a class="mg-pn__a" href="#l{prev["n"]}"><small>← Попередня лекція</small><b>{prev["n"]}. {inline(prev["title"])}</b></a>' if prev else '<span></span>')
    pn += (f'<a class="mg-pn__a mg-pn__a--next" href="#l{nxt["n"]}"><small>Наступна лекція →</small><b>{nxt["n"]}. {inline(nxt["title"])}</b></a>' if nxt else '<a class="mg-pn__a mg-pn__a--next" href="#glossary"><small>Далі →</small><b>Глосарій і джерела</b></a>')
    pn += '</nav>'
    lead = META.get('lead', {}).get(lid, '')
    return (f'<section class="mg-lec" id="{lid}" data-lec="{L["n"]}" style="--lc:var(--l{L["n"]})">'
            f'<header class="mg-lec__head"><span class="mg-lec__num">{L["n"]}</span><div>'
            f'<span class="kicker">Лекція {L["n"]} із 5</span><h2>{inline(L["title"])}</h2>{meta}</div></header>'
            + (f'<p class="mg-lead">{lead}</p>' if lead else '')
            + (f'<div class="prose mg-prose mg-intro">{intro}</div>' if intro else '')
            + f'<nav class="mg-mini" aria-label="Розділи лекції {L["n"]}"><b>У цій лекції</b><ol>{nav_sections}</ol></nav>'
            + fig(f'{lid}-open', True)
            + secs
            + f'<aside class="mg-terms" id="{lid}-terms"><h3>Ключові терміни лекції {L["n"]}</h3><ul class="mg-chips" data-lec="{L["n"]}">{terms}</ul></aside>'
            + (f'<section class="mg-qa" id="{lid}-qa"><h3>Перевірте себе</h3><div class="qa">{qa}</div></section>' if qa else '')
            + pn + '</section>')


# ------------------------------------------------------------------ зміст
def toc_html():
    out = ['<nav class="toc mg-toc" id="mg-toc" aria-label="Зміст конспекту"><h2>Зміст</h2><ol class="mg-toc__list">',
           '<li class="mg-toc__top"><a href="#intro">Про конспект</a></li>']
    for L in lectures:
        out.append(f'<li class="mg-toc__lec" data-lec="{L["n"]}" style="--lc:var(--l{L["n"]})"><a class="mg-toc__l" href="#l{L["n"]}">'
                   f'<i>{L["n"]}</i><span>{inline(L["title"])}</span></a><span class="mg-toc__bar" aria-hidden="true"><i></i></span><ol>')
        for s in L['secs']:
            out.append(f'<li><a href="#l{L["n"]}-{s["n"]}"><span>{L["n"]}.{s["n"]}</span>{inline(s["title"])}</a></li>')
        out.append('</ol></li>')
    out.append('<li class="mg-toc__top"><a href="#glossary">Глосарій</a></li><li class="mg-toc__top"><a href="#refs">Джерела</a></li></ol></nav>')
    return ''.join(out)


def glossary_html():
    items = []
    for L in lectures:
        for t in split_terms(L['terms']):
            items.append(f'<li data-lec="{L["n"]}">{inline(t)}</li>')
    return ''.join(items)


# ------------------------------------------------------------------ шаблон (шапка/підвал беремо з сусідньої статті)
tpl = (ROOT / 'konspekt' / 'plant-cell' / 'index.html').read_text(encoding='utf-8')
HEAD_HTML = tpl[tpl.index('<body>'):tpl.index('</header>') + len('</header>')]
FOOT_HTML = tpl[tpl.index('<footer'):tpl.index('</footer>') + len('</footer>')]
if SLUG not in FOOT_HTML:
    raise SystemExit('У підвалі сусідньої сторінки немає посилання на статтю — спочатку виконайте tools/mgen/patch_footers.py')

TITLE = 'Молекулярна генетика рослин'
DESC = ('Конспект «Молекулярна генетика рослин» (курс В. В. Чуба, МДУ): модельні об\'єкти й геноми, регуляція експресії, '
        'агробактеріальна трансформація, трансгенні рослини, CRISPR, позиційний контроль розвитку. Фото та інтерактивні схеми.')

tiles = ''.join(
    f'<a class="mg-tile" href="#l{L["n"]}" style="--lc:var(--l{L["n"]})"><i>{L["n"]}</i><b>{inline(L["title"])}</b>'
    f'<small>{len(L["secs"])} розділів · {L["dur"]}</small></a>' for L in lectures)

pageparts = []
pageparts.append(fig('intro'))
LECS = '\n'.join(lec_html(L, i) for i, L in enumerate(lectures))
nsec = sum(len(L['secs']) for L in lectures)

page = f'''<!doctype html>
<html lang="uk" class="no-js">
<head>
  <meta charset="utf-8">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-JWWGPMG71W"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());

    gtag('config', 'G-JWWGPMG71W');
  </script>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>try{{if(localStorage.getItem('kf-view')==='desktop'){{document.documentElement.classList.add('force-desktop');document.querySelector('meta[name=viewport]').setAttribute('content','width=1280')}}}}catch(e){{}}</script>
  <title>{TITLE} — Конспект, кафедра ФБРтаБ НУБіП</title>
  <meta name="description" content="{esc(DESC)}">
  <meta name="theme-color" content="#08210F">
  <link rel="icon" href="../../assets/img/nubip-shield.png" type="image/png">
  <link rel="stylesheet" href="../../assets/css/style.css">
  <link rel="stylesheet" href="../../assets/css/lab.css">
  <script>document.documentElement.classList.replace('no-js', 'js')</script>
  <link rel="stylesheet" href="../../assets/css/mgen.css">
</head>
{HEAD_HTML}
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
{fig('defs')}
  </defs></svg>

  <main id="main">
    <section class="page-hero page-hero--konspekt page-hero--mgen">
      <div class="bg-molecules" aria-hidden="true" style="position:absolute;inset:0"></div>
      <div class="container">
        <nav class="breadcrumbs" aria-label="Навігаційний ланцюжок"><a href="../../">Головна</a><span aria-hidden="true">/</span><a href="../">Конспект</a><span aria-hidden="true">/</span><span>{TITLE}</span></nav>
        <span class="kicker">Конспект · генетика й біотехнологія рослин</span>
        <h1>{TITLE}</h1>
        <p>Від арабідопсису й «стрибаючих генів» до агробактерії, CRISPR та позиційної інформації: як гени будують рослину і як ми навчилися ними керувати. Структурований конспект 5 лекцій — з фото, схемами та інтерактивними моделями.</p>
        <div class="lab-head"><span class="badge">Геноми</span><span class="badge">Транспозони</span><span class="badge">Фактори транскрипції</span><span class="badge">Agrobacterium</span><span class="badge">CRISPR/Cas</span><span class="badge">Морфогенез</span></div>
        <div class="mg-tiles">{tiles}</div>
      </div>
    </section>

    <div class="mg-bar" id="mg-bar" aria-label="Навігація по конспекту">
      <div class="container mg-bar__in">
        <button class="mg-bar__btn mg-bar__toc" type="button" id="mg-toc-open" aria-controls="mg-drawer" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h16"/></svg><span>Зміст</span></button>
        <div class="mg-pills" id="mg-pills" role="group" aria-label="Лекції">{''.join(f'<a href="#l{L["n"]}" data-lec="{L["n"]}" style="--lc:var(--l{L["n"]})" title="{esc(L["title"])}">{L["n"]}</a>' for L in lectures)}</div>
        <div class="mg-here" id="mg-here" aria-live="polite"><small id="mg-here-l">Вступ</small><b id="mg-here-s">Про конспект</b></div>
        <div class="mg-bar__tools">
          <button class="mg-bar__btn" type="button" id="mg-prev" aria-label="Попередній розділ" title="Попередній розділ ( [ )"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg></button>
          <button class="mg-bar__btn" type="button" id="mg-next" aria-label="Наступний розділ" title="Наступний розділ ( ] )"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          <button class="mg-bar__btn" type="button" id="mg-search-open" aria-label="Пошук по конспекту" aria-controls="mg-search" aria-expanded="false" title="Пошук по конспекту ( / )"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
          <button class="mg-bar__btn mg-focus" type="button" id="mg-focus" aria-pressed="false" title="Показувати лише поточну лекцію"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg><span>Одна лекція</span></button>
        </div>
      </div>
      <div class="mg-progress" aria-hidden="true"><i id="mg-progress"></i></div>
      <div class="mg-search" id="mg-search" hidden>
        <div class="container">
          <label class="mg-search__f"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="mg-q" placeholder="Знайти в конспекті: MYB, транспозон, T-ДНК, GFP, філотаксис…" autocomplete="off" aria-label="Пошук по конспекту"><button type="button" id="mg-search-close" aria-label="Закрити пошук">✕</button></label>
          <ol class="mg-hits" id="mg-hits" aria-live="polite"></ol>
        </div>
      </div>
    </div>

    <div class="section mg-wrap">
      <div class="container lab-doc mg-doc">
        {toc_html()}

        <article id="mg-article">
{pageparts[0]}
{LECS}

          <section class="mg-sec mg-glossary" id="glossary" data-title="Глосарій">
            <h2><span class="n">А–Я</span>Глосарій: ключові терміни лекцій 1–5</h2>
            <p class="mg-gloss__lead">Усі терміни з кінця лекцій в одному місці. Фільтруйте за лекцією або текстом; натисніть на термін — і він знайдеться по всьому конспекту.</p>
            <div class="mg-gloss__bar"><input type="search" id="mg-gq" placeholder="Фільтр термінів…" aria-label="Фільтр термінів"><div class="mg-seg" id="mg-gl" role="group" aria-label="Лекція"><button type="button" data-l="0" aria-pressed="true">Усі</button>{''.join(f'<button type="button" data-l="{L["n"]}" aria-pressed="false" style="--lc:var(--l{L["n"]})">{L["n"]}</button>' for L in lectures)}</div></div>
            <ul class="mg-chips mg-chips--all" id="mg-gterms">{glossary_html()}</ul>
          </section>

          <section class="mg-sec" id="refs" data-title="Джерела">
            <h2><span class="n">★</span>Джерела та подяки</h2>
{fig('refs')}
          </section>
        </article>
      </div>
    </div>
  </main>

  <div class="mg-drawer" id="mg-drawer" hidden>
    <div class="mg-drawer__bg" data-close></div>
    <div class="mg-drawer__panel" role="dialog" aria-label="Зміст конспекту" aria-modal="true"><button class="mg-drawer__x" type="button" data-close aria-label="Закрити">✕</button><div id="mg-drawer-body"></div></div>
  </div>
  <button class="mg-top" id="mg-top" type="button" aria-label="Нагору" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>

  {FOOT_HTML}

  <script defer src="../../assets/js/main.js"></script>
  <script defer src="../../assets/js/lightbox.js"></script>
  <script type="module" src="../../assets/js/lab/mgen-konspekt.js"></script>
</body>
</html>
'''
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(page, encoding='utf-8')
print(f'OK: {OUT.relative_to(ROOT)}  {len(page)//1024} КБ, лекцій {len(lectures)}, розділів {nsec}')

# індекс для пошуку по всьому конспекту (k-index) — друкуємо в JSON для patch_index.py
idx = [dict(t=TITLE, u=f'{SLUG}/', a=TITLE, k='молекулярна генетика рослин арабідопсис геном транспозон Ac/Ds ретротранспозон MYB bHLH WD40 агробактерія Ti-плазміда T-ДНК трансгенні рослини GFP GUS RNAi CRISPR Cas9 позиційна інформація морфоген філотаксис', top=1)]
for L in lectures:
    idx.append(dict(t=f'Лекція {L["n"]}. {re.sub(r"[*]", "", L["title"])}', u=f'{SLUG}/#l{L["n"]}', a=TITLE, k=' '.join(split_terms(L['terms'])).replace('*', '')))
    for S in L['secs']:
        txt = re.sub(r'[*`>#|\[\]]|\(https?://[^)]*\)', ' ', ' '.join(S['body']))
        txt = re.sub(r'\s+', ' ', txt).strip()
        idx.append(dict(t=f'{L["n"]}.{S["n"]}. ' + re.sub(r'[*]', '', S['title']), u=f'{SLUG}/#l{L["n"]}-{S["n"]}', a=TITLE, k=txt[:420], s=f'Лекція {L["n"]}'))
(T / 'index_entries.json').write_text(json.dumps(idx, ensure_ascii=False), encoding='utf-8')
