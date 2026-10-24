"""Тимчасово: пошук фото уражених рослин у Wikimedia Commons (вільні ліцензії).
Запускається в GitHub Actions; результати — tmp/plants/<id>/NN.jpg + meta.json."""
import json, os, re, sys, time, urllib.parse, urllib.request
from io import BytesIO
from PIL import Image

UA = {'User-Agent': 'kafedra-fbrb-edu/1.0 (https://github.com/mzachepylo-png/kafedra; educational site)'}
API = 'https://commons.wikimedia.org/w/api.php'
OK_LIC = re.compile(r'^(cc[ -]by|cc0|public domain|pd)', re.I)
Q = json.load(open(os.path.join(os.path.dirname(__file__), 'queries.json')))
PER = 8

def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:
            print('  retry', i, e); time.sleep(2 + 3 * i)
    raise RuntimeError(url)

def search(q):
    p = {'action': 'query', 'format': 'json', 'generator': 'search', 'gsrnamespace': 6, 'gsrlimit': 30,
         'gsrsearch': q + ' filetype:bitmap', 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata|mime', 'iiurlwidth': 1200}
    d = json.loads(get(API + '?' + urllib.parse.urlencode(p)))
    pages = sorted(d.get('query', {}).get('pages', {}).values(), key=lambda x: x.get('index', 0))
    out = []
    for pg in pages:
        ii = (pg.get('imageinfo') or [{}])[0]
        md = ii.get('extmetadata', {})
        lic = md.get('LicenseShortName', {}).get('value', '')
        if not OK_LIC.match(lic) or ii.get('mime') not in ('image/jpeg', 'image/png') or ii.get('width', 0) < 700:
            continue
        strip = lambda s: re.sub('<[^>]+>', '', s or '').strip()
        out.append({'title': pg['title'], 'thumb': ii.get('thumburl') or ii['url'], 'page': ii.get('descriptionurl'),
                    'w': ii.get('width'), 'h': ii.get('height'), 'license': lic,
                    'license_url': md.get('LicenseUrl', {}).get('value', ''),
                    'artist': strip(md.get('Artist', {}).get('value', ''))[:200],
                    'desc': strip(md.get('ImageDescription', {}).get('value', ''))[:400]})
    return out

only = [x for x in (sys.argv[1] if len(sys.argv) > 1 else '').split(',') if x]
for did, queries in Q.items():
    if only and did not in only: continue
    print('==', did)
    seen, cands = set(), []
    for q in queries:
        try: res = search(q)
        except Exception as e: print('  search failed', q, e); continue
        for c in res:
            if c['title'] in seen: continue
            seen.add(c['title']); c['query'] = q; cands.append(c)
        time.sleep(1)
    d = os.path.join('tmp', 'plants', did); os.makedirs(d, exist_ok=True)
    meta = []
    for k, c in enumerate(cands[:PER]):
        try:
            im = Image.open(BytesIO(get(c['thumb']))).convert('RGB')
            im.thumbnail((1200, 1200))
            fn = f'{k + 1:02d}.jpg'; im.save(os.path.join(d, fn), quality=86)
            c['file'] = fn; meta.append(c); print('  ok', fn, c['title'], c['license'])
        except Exception as e:
            print('  fail', c['title'], e)
        time.sleep(0.5)
    json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
