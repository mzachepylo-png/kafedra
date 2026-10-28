# Тимчасово: пошук і завантаження зображень з Wikimedia Commons для статті «Транспорт іонів».
import json, os, sys, time, urllib.parse, urllib.request
from io import BytesIO
from PIL import Image, ImageDraw
UA = {'User-Agent': 'kafedra-nubip-edu/1.0 (https://github.com/mzachepylo-png/kafedra; educational)'}
OUT = 'tmp/ion'
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
    Q = json.load(open('tools/ion/queries.json'))
    meta = json.load(open(f'{OUT}/meta.json')) if os.path.exists(f'{OUT}/meta.json') else {}
    for key, q in Q.items():
        api = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': 8, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size', 'iiurlwidth': 900})
        d = get(api)
        if not d: continue
        pages = sorted(json.loads(d).get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
        thumbs = []
        for k, p in enumerate(pages):
            ii = p['imageinfo'][0]; em = ii.get('extmetadata', {})
            b = get(ii['thumburl'])
            if not b: continue
            try: im = Image.open(BytesIO(b)).convert('RGB')
            except Exception: continue
            fn = f'{OUT}/{key}_{k}.jpg'; im.save(fn, quality=86)
            meta[f'{key}_{k}'] = dict(title=p['title'], url=ii['descriptionurl'], w=ii['width'], h=ii['height'], artist=em.get('Artist', {}).get('value', ''), lic=em.get('LicenseShortName', {}).get('value', ''))
            thumbs.append((f'{key}_{k}', im)); time.sleep(1.2)
        if thumbs:
            sheet = Image.new('RGB', (4 * 260, 2 * 230), 'white'); dr = ImageDraw.Draw(sheet)
            for i, (n, im) in enumerate(thumbs[:8]):
                t = im.copy(); t.thumbnail((250, 200)); x, y = (i % 4) * 260 + 5, (i // 4) * 230 + 5
                sheet.paste(t, (x, y)); dr.text((x, y + 205), n, fill='black')
            sheet.save(f'{OUT}/sheet_{key}.jpg', quality=80)
        time.sleep(2)
    json.dump(meta, open(f'{OUT}/meta.json', 'w'), ensure_ascii=False, indent=1)
