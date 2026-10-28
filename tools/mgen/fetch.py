# Тимчасово: пошук і завантаження зображень з Wikimedia Commons для конспекту «Молекулярна генетика рослин».
#   search START END — для запитів з queries.json (за порядком) зберігає контактні аркуші й метадані в tmp/mgen/
#   final            — за tools/mgen/selection.json завантажує вибрані файли як WebP у assets/img/mgen/
import json, os, re, sys, time, urllib.parse, urllib.request
from io import BytesIO
from PIL import Image, ImageDraw
UA = {'User-Agent': 'kafedra-nubip-edu/1.0 (https://github.com/mzachepylo-png/kafedra; educational)'}
OUT = 'tmp/mgen'
os.makedirs(OUT, exist_ok=True)
API = 'https://commons.wikimedia.org/w/api.php?'

def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
                return r.read()
        except Exception as e:
            print('retry', url[:100], e); time.sleep(5 * (i + 1))
    return None

def clean(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()

mode = sys.argv[1] if len(sys.argv) > 1 else 'search'
if mode == 'search':
    a, b = int(sys.argv[2]), int(sys.argv[3])
    Q = list(json.load(open('tools/mgen/queries.json')).items())[a:b]
    mp = f'{OUT}/meta_{a}.json'
    meta = json.load(open(mp)) if os.path.exists(mp) else {}
    for key, q in Q:
        d = get(API + urllib.parse.urlencode({'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': 6, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size', 'iiurlwidth': 700}))
        if not d: continue
        pages = sorted(json.loads(d).get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
        thumbs = []
        for k, p in enumerate(pages):
            ii = p['imageinfo'][0]; em = ii.get('extmetadata', {})
            bts = get(ii['thumburl'])
            if not bts: continue
            try: im = Image.open(BytesIO(bts)).convert('RGB')
            except Exception: continue
            meta[f'{key}_{k}'] = dict(title=p['title'], url=ii['descriptionurl'], w=ii['width'], h=ii['height'], artist=clean(em.get('Artist', {}).get('value', '')), lic=clean(em.get('LicenseShortName', {}).get('value', '')))
            thumbs.append((f'{key}_{k}', im)); time.sleep(1.0)
        if thumbs:
            cw, ch = 300, 235
            sheet = Image.new('RGB', (3 * cw, 2 * ch), 'white'); dr = ImageDraw.Draw(sheet)
            for i, (n, im) in enumerate(thumbs[:6]):
                t = im.copy(); t.thumbnail((cw - 8, ch - 30)); x, y = (i % 3) * cw + 4, (i // 3) * ch + 4
                sheet.paste(t, (x, y)); dr.text((x, y + ch - 24), f'{n} {meta[n]["lic"][:14]} {meta[n]["w"]}x{meta[n]["h"]}', fill='black')
            sheet.save(f'{OUT}/sheet_{key}.jpg', quality=72)
        time.sleep(1.5)
        json.dump(meta, open(mp, 'w'), ensure_ascii=False, indent=1)
elif mode == 'final':
    sel = json.load(open('tools/mgen/selection.json'))
    os.makedirs('assets/img/mgen', exist_ok=True)
    cp = 'tools/mgen/credits.json'
    credits = json.load(open(cp)) if os.path.exists(cp) else {}
    for name, s in sel.items():
        if os.path.exists(f'assets/img/mgen/{name}.webp') and name in credits: continue
        d = get(API + urllib.parse.urlencode({'action': 'query', 'format': 'json', 'titles': s['title'], 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size', 'iiurlwidth': s.get('w', 1000)}))
        if not d: print('FAIL', name); continue
        p = list(json.loads(d)['query']['pages'].values())[0]
        if 'imageinfo' not in p: print('MISSING', name, s['title']); continue
        ii = p['imageinfo'][0]; em = ii.get('extmetadata', {})
        bts = get(ii.get('thumburl') or ii['url'])
        if not bts: print('FAIL', name); continue
        im = Image.open(BytesIO(bts)).convert('RGB')
        if 'crop' in s:
            W, H = im.size; l, t, r, b = s['crop']; im = im.crop((int(l * W), int(t * H), int(r * W), int(b * H)))
        im.save(f'assets/img/mgen/{name}.webp', 'WEBP', quality=80, method=6)
        credits[name] = dict(title=p['title'], url=ii['descriptionurl'], artist=clean(em.get('Artist', {}).get('value', '')), lic=clean(em.get('LicenseShortName', {}).get('value', '')), lic_url=clean(em.get('LicenseUrl', {}).get('value', '')), w=im.size[0], h=im.size[1])
        print('OK', name, im.size); time.sleep(1.2)
    json.dump(credits, open(cp, 'w'), ensure_ascii=False, indent=1)
