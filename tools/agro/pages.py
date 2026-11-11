"""Тимчасово: перевірка даних про авторів посібника (ORCID, Вікіпедія, пошук) → tmp/agro/pages/."""
import os, time, urllib.parse, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "uk,en;q=0.8"}
OUT = "tmp/agro/pages"; os.makedirs(OUT, exist_ok=True)
q = urllib.parse.quote
URLS = {}
for oid in ["0000-0003-0821-4217", "0000-0001-7613-9197", "0000-0002-0459-5609", "0000-0002-4087-4082"]:
    URLS[f"orcid_{oid}_person"] = f"https://pub.orcid.org/v3.0/{oid}/person"
    URLS[f"orcid_{oid}_emp"] = f"https://pub.orcid.org/v3.0/{oid}/employments"
for name in ["Мельничук Микола Дмитрович", "Кляченко Оксана Леонідівна"]:
    URLS["wiki_" + name.split()[0]] = ("https://uk.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&inprop=url&explaintext=1&redirects=1&titles=" + q(name))
    URLS["wikisearch_" + name.split()[0]] = ("https://uk.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=" + q(name))
    URLS["ddg_" + name.split()[0]] = "https://html.duckduckgo.com/html/?q=" + q(name + " НУБіП")
URLS = {
    "ddg_mel2": "https://html.duckduckgo.com/html/?q=" + q("Мельничук Микола Дмитрович академік НААН біотехнологія"),
    "ddg_mel3": "https://html.duckduckgo.com/html/?q=" + q("Мельничук Микола Дмитрович esu.com.ua"),
    "irbis_mel": "https://irbis-nbuv.gov.ua/ASUA/0041928",
}
for k, u in URLS.items():
    try:
        h = dict(UA); h["Accept"] = "application/json" if ("orcid" in k or "wiki" in k) else "text/html"
        if "wiki" in k: h["User-Agent"] = "kafedra-nubip-edu/1.0 (educational; https://github.com/mzachepylo-png/kafedra)"
        with urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=60) as r:
            open(f"{OUT}/{k}.{'html' if k.startswith('ddg') else 'json'}", "wb").write(r.read())
        print("ok", k)
    except Exception as e:
        print("fail", k, e)
    time.sleep(1)
