"""Тимчасово: забирає сторінку аспірантів кафедри з nubip.edu.ua (з GitHub Actions)."""
import os, re, sys, time, urllib.request, urllib.parse
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept-Language": "uk,en;q=0.8"}
OUT = "tmp/phd"; os.makedirs(OUT, exist_ok=True)
def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read(), r.geturl()
        except Exception as e:
            print("retry", url, e); time.sleep(3 * (i + 1))
    return None, url
pages = sys.argv[1:] or ["https://nubip.edu.ua/aspiranty-kafedry-17"]
for n, url in enumerate(pages):
    body, final = get(url)
    if not body: print("FAIL", url); continue
    open(f"{OUT}/page{n}.html", "wb").write(body)
    html = body.decode("utf-8", "replace")
    m = re.search(r'<article.*?</article>|<div[^>]+class="[^"]*(field--name-body|node__content|region-content)[^"]*".*', html, re.S)
    scope = m.group(0) if m else html
    imgs = []
    for src in re.findall(r'<img[^>]+src="([^"]+)"', scope):
        u = urllib.parse.urljoin(final, src)
        if u not in imgs: imgs.append(u)
    with open(f"{OUT}/imgs{n}.txt", "w") as f:
        for i, u in enumerate(imgs):
            data, _ = get(u)
            ext = os.path.splitext(urllib.parse.urlparse(u).path)[1][:5] or ".bin"
            if data:
                fn = f"p{n}_{i:02d}{ext}"; open(f"{OUT}/{fn}", "wb").write(data)
                f.write(f"{fn}\t{u}\n")
    print("ok", url, len(body), len(imgs))
