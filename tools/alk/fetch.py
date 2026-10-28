# Тимчасово: пошук і завантаження зображень (Wikimedia Commons) та перевірка літератури для статті «Алкалоїди».
import json, os, sys, time, urllib.parse, urllib.request
from io import BytesIO
from PIL import Image, ImageDraw
UA = {'User-Agent': 'kafedra-nubip-edu/1.0 (https://github.com/mzachepylo-png/kafedra; educational)'}
OUT = 'tmp/alk'
os.makedirs(OUT, exist_ok=True)

def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read()
        except Exception as e:
            print('retry', url[:90], e); time.sleep(4 * (i + 1))
    return None

mode = sys.argv[1] if len(sys.argv) > 1 else 'search'
if mode == 'search':
    Q = json.load(open('tools/alk/queries.json'))
    only = set(sys.argv[2].split(',')) if len(sys.argv) > 2 and sys.argv[2] else None
    meta = json.load(open(f'{OUT}/meta.json')) if os.path.exists(f'{OUT}/meta.json') else {}
    for key, q in Q.items():
        if only and key not in only: continue
        api = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': 8, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size', 'iiurlwidth': 1000})
        d = get(api)
        if not d: continue
        pages = sorted(json.loads(d).get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
        thumbs = []
        for k, p in enumerate(pages):
            ii = p['imageinfo'][0]; em = ii.get('extmetadata', {})
            b = get(ii['thumburl'].replace('/1000px-', '/320px-')) or get(ii['thumburl'])
            if not b: continue
            try: im = Image.open(BytesIO(b)).convert('RGB')
            except Exception: continue
            meta[f'{key}_{k}'] = dict(title=p['title'], url=ii['descriptionurl'], thumb=ii['thumburl'], w=ii['width'], h=ii['height'], artist=em.get('Artist', {}).get('value', ''), lic=em.get('LicenseShortName', {}).get('value', ''))
            thumbs.append((f'{key}_{k}', im)); time.sleep(1.0)
        if thumbs:
            sheet = Image.new('RGB', (4 * 250, 2 * 215), 'white'); dr = ImageDraw.Draw(sheet)
            for i, (n, im) in enumerate(thumbs[:8]):
                t = im.copy(); t.thumbnail((240, 190)); x, y = (i % 4) * 250 + 5, (i // 4) * 215 + 3
                sheet.paste(t, (x, y)); dr.text((x, y + 193), n, fill='black')
            sheet.save(f'{OUT}/sheet_{key}.jpg', quality=72)
        time.sleep(1.5)
    json.dump(meta, open(f'{OUT}/meta.json', 'w'), ensure_ascii=False, indent=1)
elif mode == 'final':
    picks = json.load(open('tools/alk/picks.json'))   # {ключ: "query_idx"}
    meta = json.load(open(f'{OUT}/meta.json'))
    os.makedirs('assets/img/alk', exist_ok=True)
    credits = json.load(open('assets/img/alk/credits.json')) if os.path.exists('assets/img/alk/credits.json') else {}
    for key, ref in picks.items():
        m = meta.get(ref)
        if not m: print('нема', key, ref); continue
        b = get(m['thumb'])
        if not b: continue
        im = Image.open(BytesIO(b)).convert('RGB')
        if max(im.size) > 1000: im.thumbnail((1000, 1000))
        im.save(f'assets/img/alk/{key}.webp', 'WEBP', quality=80, method=6)
        credits[key] = dict(title=m['title'], url=m['url'], artist=m['artist'], lic=m['lic'], w=im.size[0], h=im.size[1])
        time.sleep(1.2)
    json.dump(credits, open('assets/img/alk/credits.json', 'w'), ensure_ascii=False, indent=1)
elif mode == 'refs':
    R = json.load(open('tools/alk/refs.json')); out = {}
    for r in R:
        try:
            if r.get('doi'):
                d = json.loads(get('https://api.crossref.org/works/' + urllib.parse.quote(r['doi'])) or b'{}').get('message')
                items = [d] if d else []
            else:
                d = json.loads(get('https://api.crossref.org/works?rows=3&query.bibliographic=' + urllib.parse.quote(r['q'])) or b'{}')
                items = d.get('message', {}).get('items', [])
        except Exception as e:
            items = []; print('err', r['k'], e)
        out[r['k']] = [dict(doi=i.get('DOI'), title=(i.get('title') or [''])[0], authors=[(a.get('family', '') + ' ' + a.get('given', '')).strip() for a in i.get('author', [])][:8], year=(i.get('issued', {}).get('date-parts') or [[None]])[0][0], journal=(i.get('container-title') or [''])[0], vol=i.get('volume'), issue=i.get('issue'), page=i.get('page') or i.get('article-number')) for i in items[:3]]
        time.sleep(0.4)
    json.dump(out, open(f'{OUT}/refs_out.json', 'w'), ensure_ascii=False, indent=1)
print('done', mode)
