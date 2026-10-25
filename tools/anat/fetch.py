# Тимчасово: мікрофотографії тканин з Wikimedia Commons для сторінки «Анатомія рослин».
import io, json, os, re, time, urllib.parse, urllib.request
from PIL import Image
OUT = 'tmp/anat'; os.makedirs(OUT + '/img', exist_ok=True); os.makedirs(OUT + '/cand', exist_ok=True)
L = json.load(open('tools/anat/list.json'))
H = {'User-Agent': 'kafedra-fbrtab-site/1.0 (educational; github.com/mzachepylo-png/kafedra)'}
API = 'https://commons.wikimedia.org/w/api.php?'
def get(u, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=60) as r: return r.read()
        except Exception as e:
            print('  retry', i, u[:100], e); time.sleep(3 + 4 * i)
    raise RuntimeError(u)
def api(**p):
    p.update(format='json', formatversion=2)
    return json.loads(get(API + urllib.parse.urlencode(p)))
def strip(h): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h or '')).strip()
def info(titles, w):
    j = api(action='query', titles='|'.join(titles), prop='imageinfo', iiprop='url|extmetadata|size', iiurlwidth=w)
    out = {}
    for pg in j['query']['pages']:
        if 'imageinfo' not in pg: print('  missing', pg.get('title')); continue
        ii = pg['imageinfo'][0]; m = ii.get('extmetadata', {})
        out[pg['title']] = {'thumb': ii.get('thumburl'), 'page': ii.get('descriptionurl'), 'w': ii['width'], 'h': ii['height'],
            'artist': strip(m.get('Artist', {}).get('value')), 'lic': strip(m.get('LicenseShortName', {}).get('value')),
            'desc': strip(m.get('ImageDescription', {}).get('value'))[:300]}
    return out
def save(url, path, maxw):
    im = Image.open(io.BytesIO(get(url))).convert('RGB')
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(path, 'WEBP', quality=82, method=6); return im.size
data = {}
fl = L['files']
for k in range(0, len(fl), 20):
    chunk = fl[k:k + 20]
    inf = info([f['title'] for f in chunk], 1400)
    # нормалізовані назви
    for f in chunk:
        t = f['title'].replace('_', ' ')
        m = inf.get(t) or next((v for kk, v in inf.items() if kk.lower() == t.lower()), None)
        if not m: print('NO', t); continue
        try:
            m['size'] = save(m['thumb'], f'{OUT}/img/{f["id"]}.webp', 1400); data[f['id']] = dict(m, title=t); print('ok', f['id'])
        except Exception as e: print('ERR', f['id'], e)
        time.sleep(0.5)
cands = {}
for key, qs in L['searches'].items():
    seen = []
    for q in qs:
        j = api(action='query', list='search', srsearch=q + ' filetype:bitmap', srnamespace=6, srlimit=6)
        for r in j['query']['search']:
            if r['title'] not in seen: seen.append(r['title'])
        time.sleep(0.5)
    seen = seen[:10]
    inf = info(seen, 1400) if seen else {}
    cands[key] = []
    for n, t in enumerate(seen):
        m = inf.get(t)
        if not m or not m.get('thumb'): continue
        cid = f'{key}{n:02d}'
        try:
            m['size'] = save(m['thumb'], f'{OUT}/cand/{cid}.webp', 1400); cands[key].append(dict(m, title=t, id=cid))
        except Exception as e: print('ERR', cid, e)
        time.sleep(0.5)
json.dump({'files': data, 'cands': cands}, open(f'{OUT}/data.json', 'w'), ensure_ascii=False, indent=1)
print('done', len(data), sum(len(v) for v in cands.values()))
