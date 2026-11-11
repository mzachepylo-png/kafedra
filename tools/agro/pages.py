"""Тимчасово: сторінки про авторів посібника (НУБіП, ORCID) → tmp/agro/pages/."""
import os, time, urllib.parse, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "uk,en;q=0.8"}
OUT = "tmp/agro/pages"; os.makedirs(OUT, exist_ok=True)
URLS = {
    "nubip_kliachenko": "https://nubip.edu.ua/search/node?keys=" + urllib.parse.quote("Кляченко"),
    "nubip_melnychuk": "https://nubip.edu.ua/search/node?keys=" + urllib.parse.quote("Мельничук Микола Дмитрович"),
    "orcid_kliachenko": "https://pub.orcid.org/v3.0/expanded-search/?q=" + urllib.parse.quote("family-name:Kliachenko OR family-name:Klyachenko"),
    "orcid_melnychuk": "https://pub.orcid.org/v3.0/expanded-search/?q=" + urllib.parse.quote("family-name:Melnychuk AND given-names:Mykola"),
    "wiki_melnychuk": "https://uk.wikipedia.org/wiki/" + urllib.parse.quote("Мельничук_Микола_Дмитрович"),
}
for k, u in URLS.items():
    try:
        h = dict(UA); h["Accept"] = "application/json" if "orcid" in k else "text/html"
        with urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=60) as r:
            open(f"{OUT}/{k}.{'json' if 'orcid' in k else 'html'}", "wb").write(r.read())
        print("ok", k)
    except Exception as e:
        print("fail", k, e)
    time.sleep(1)
