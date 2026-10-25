# Тимчасово: фото (iNaturalist) і карти поширення (GBIF) для сторінки «Бур'яни України».
# Результат: tmp/weeds/{photo,ua,world}/NN.webp і tmp/weeds/data.json
import io, json, math, os, sys, time, urllib.parse, urllib.request
from PIL import Image

OUT = 'tmp/weeds'
for d in ('photo', 'ua', 'world'):
    os.makedirs(f'{OUT}/{d}', exist_ok=True)
SP = json.load(open('tools/weeds/species.json'))
UA_AGENT = {'User-Agent': 'kafedra-fbrtab-site/1.0 (educational; github.com/mzachepylo-png/kafedra)'}


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA_AGENT), timeout=60) as r:
                return r.read()
        except Exception as e:
            print('  retry', i, url[:120], e)
            time.sleep(2 + 3 * i)
    raise RuntimeError('failed ' + url)


def js(url):
    return json.loads(get(url))


TS = 256
def mx(lon, z): return (lon + 180) / 360 * TS * 2 ** z
def my(lat, z):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * TS * 2 ** z

Z_UA = 5
x0, x1, y0, y1 = mx(21.7, Z_UA), mx(40.7, Z_UA), my(52.7, Z_UA), my(44.1, Z_UA)
w = x1 - x0; h = w * 3 / 4; cy = (y0 + y1) / 2
UAV = (x0, cy - h / 2, w, h)
Z_W = 1
WV = (0, my(80, Z_W), TS * 2, my(-58, Z_W) - my(80, Z_W))


def dens(z, x, y, key, hexn):
    return (f'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@2x.png?srs=EPSG:3857&taxonKey={key}'
            f'&bin=hex&hexPerTile={hexn}&style=purpleYellow-noborder.poly')


def base(z, x, y): return f'https://tile.gbif.org/3857/omt/{z}/{x}/{y}@2x.png?style=gbif-light'


def compose(view, z, urlf, mode='RGBA', bg=None):
    vx, vy, vw, vh = view
    n = 2 ** z
    tx0, tx1 = max(0, int(vx // TS)), min(n - 1, int((vx + vw) // TS))
    ty0, ty1 = max(0, int(vy // TS)), min(n - 1, int((vy + vh) // TS))
    S = 2  # @2x
    can = Image.new('RGBA', ((tx1 - tx0 + 1) * TS * S, (ty1 - ty0 + 1) * TS * S), bg or (0, 0, 0, 0))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            for u in urlf(tx, ty):
                raw = get(u)
                try: im = Image.open(io.BytesIO(raw)).convert('RGBA')
                except Exception: continue  # порожня плитка (немає знахідок) — пропускаємо
                if im.size != (TS * S, TS * S): im = im.resize((TS * S, TS * S))
                can.alpha_composite(im, ((tx - tx0) * TS * S, (ty - ty0) * TS * S))
    box = tuple(round(v) for v in ((vx - tx0 * TS) * S, (vy - ty0 * TS) * S, (vx + vw - tx0 * TS) * S, (vy + vh - ty0 * TS) * S))
    return can.crop(box).convert(mode)


OK = {'cc0': 3, 'cc-by': 3, 'cc-by-sa': 3, 'cc-by-nc': 2, 'cc-by-nc-sa': 2, 'cc-by-nd': 1, 'cc-by-nc-nd': 1}


def photo(names):
    j = js('https://api.inaturalist.org/v1/taxa?q=' + urllib.parse.quote(names[0]) + '&rank=species&per_page=10')
    res = [r for r in j.get('results', []) if r.get('rank') == 'species']
    t = next((r for r in res if r.get('name') in names or r.get('matched_term') in names), res[0] if res else None)
    if not t: return None
    time.sleep(1)
    d = js(f'https://api.inaturalist.org/v1/taxa/{t["id"]}')
    phs = [tp['photo'] for tp in d['results'][0].get('taxon_photos', []) if tp['photo'].get('license_code') in OK]
    dp = t.get('default_photo')
    if dp and dp.get('license_code') in OK:
        phs = [dp] + [p for p in phs if p.get('id') != dp.get('id')]
    else:
        phs.sort(key=lambda p: -OK[p['license_code']])
    if not phs: return None
    p = phs[0]
    url = (p.get('medium_url') or p.get('url')).replace('/medium.', '/large.').replace('/square.', '/large.')
    im = Image.open(io.BytesIO(get(url))).convert('RGB')
    if im.width > 960: im = im.resize((960, round(im.height * 960 / im.width)), Image.LANCZOS)
    return im, {'attr': p.get('attribution'), 'lic': p.get('license_code'), 'link': f'https://www.inaturalist.org/taxa/{t["id"]}',
                'photo': f'https://www.inaturalist.org/photos/{p["id"]}', 'w': im.width, 'h': im.height}


def gbif(names):
    for n in names:
        m = js('https://api.gbif.org/v1/species/match?kingdom=Plantae&name=' + urllib.parse.quote(n))
        if m.get('usageKey') and m.get('matchType') not in ('NONE', 'HIGHERRANK'):
            key = m.get('acceptedUsageKey') or m['usageKey']
            ua = js(f'https://api.gbif.org/v1/occurrence/search?limit=0&country=UA&taxonKey={key}')['count']
            al = js(f'https://api.gbif.org/v1/occurrence/search?limit=0&taxonKey={key}')['count']
            return {'key': key, 'ua': ua, 'all': al}
    return None


data = json.load(open(f'{OUT}/data.json')) if os.path.exists(f'{OUT}/data.json') else {}
only = sys.argv[1].split() if len(sys.argv) > 1 and sys.argv[1].strip() else None
for sp in SP:
    n = sp['n']
    if only and n not in only: continue
    print(n, sp['names'][0])
    rec = data.get(n, {})
    try:
        r = photo(sp['names'])
        if r:
            r[0].save(f'{OUT}/photo/{n}.webp', 'WEBP', quality=80, method=6)
            rec['photo'] = r[1]
    except Exception as e: print('  photo error', e)
    try:
        g = gbif(sp['names'])
        if g:
            rec['gbif'] = g
            ua = compose(UAV, Z_UA, lambda x, y: [dens(Z_UA, x, y, g['key'], 48)])
            ua.save(f'{OUT}/ua/{n}.webp', 'WEBP', quality=82, method=6)
            wd = compose(WV, Z_W, lambda x, y: [base(Z_W, x, y), dens(Z_W, x, y, g['key'], 70)], 'RGB', (233, 238, 240, 255))
            wd = wd.resize((800, round(wd.height * 800 / wd.width)), Image.LANCZOS)
            wd.save(f'{OUT}/world/{n}.webp', 'WEBP', quality=78, method=6)
    except Exception as e: print('  gbif error', e)
    data[n] = rec
    json.dump(data, open(f'{OUT}/data.json', 'w'), ensure_ascii=False, indent=1)
    time.sleep(1.2)
print('done', len(data))
