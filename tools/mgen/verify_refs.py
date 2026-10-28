# Тимчасово: звірка списку літератури з Crossref (запускається в GitHub Actions).
import json, re, sys, time, urllib.parse, urllib.request
UA = {'User-Agent': 'kafedra-nubip-edu/1.0 (https://github.com/mzachepylo-png/kafedra; mailto:mykytazachepylo@gmail.com)'}
R = json.load(open('tools/mgen/refs.json', encoding='utf-8'))
strip = lambda s: re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s).replace('&amp;', '&')).strip()
tok = lambda s: set(re.findall(r'[a-zа-яіїє0-9]{3,}', s.lower()))

def get(url):
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(3 * (i + 1))
    return None

out = {}
for k, raw in R.items():
    s = strip(raw)
    m = re.match(r'^(.*?) \((\d{4})\) (.*)$', s)
    year = int(m.group(2)) if m else None
    rest = m.group(3) if m else s
    title = rest.split('. ')[0]
    vp = re.search(r'(\d+)(?: \([^)]*\))?: ?([A-Za-z]?\d+)', rest)
    vol, pg = (vp.group(1), vp.group(2)) if vp else (None, None)
    q = urllib.parse.quote(s)
    d = get(f'https://api.crossref.org/works?query.bibliographic={q}&rows=3&select=DOI,title,issued,container-title,volume,page,article-number,author,type')
    best = None
    for it in (d or {}).get('message', {}).get('items', []):
        t = (it.get('title') or [''])[0]
        sim = len(tok(title) & tok(t)) / max(1, len(tok(title) | tok(t)))
        if best is None or sim > best[0]:
            best = (sim, it)
    if not best:
        out[k] = {'status': 'none', 'ref': s}; continue
    sim, it = best
    cy = (it.get('issued', {}).get('date-parts') or [[None]])[0][0]
    cpage = str(it.get('page') or it.get('article-number') or '')
    cvol = str(it.get('volume') or '')
    ok_t = sim >= 0.6
    ok_y = year is not None and cy is not None and abs(year - cy) <= 1
    ok_v = vol is not None and vol == cvol
    ok_p = pg is not None and re.sub(r'^[A-Za-z]', '', cpage).startswith(re.sub(r'^[A-Za-z]', '', pg))
    status = 'ok' if ok_t and ok_y and (ok_v or ok_p) else 'check'
    out[k] = {'status': status, 'sim': round(sim, 2), 'ref': s, 'doi': it.get('DOI'),
              'cr': {'title': (it.get('title') or [''])[0], 'year': cy, 'journal': (it.get('container-title') or [''])[0],
                     'vol': cvol, 'page': cpage, 'authors': [a.get('family', '') for a in (it.get('author') or [])[:3]]},
              'flags': {'t': ok_t, 'y': ok_y, 'v': ok_v, 'p': ok_p}}
    time.sleep(0.15)
import os
os.makedirs('tmp/mgen', exist_ok=True)
json.dump(out, open('tmp/mgen/verify.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(v['status'] for v in out.values()))
