"""Вебінтерфейс: завдання, перегляд, завантаження DOCX/ZIP (Flask test client)."""
import io
import os
import sys
import time
import zipfile

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
os.environ["NO_PROXY"] = os.environ["no_proxy"] = "127.0.0.1,localhost"

import serve  # noqa: E402
import app as webapp  # noqa: E402


@pytest.fixture(scope="module")
def base():
    srv, url = serve.start()
    yield url
    srv.shutdown()


def wait(c, jid):
    for _ in range(100):
        j = c.get(f"/api/jobs/{jid}").get_json()
        if j["finished"]:
            return j
        time.sleep(0.1)
    raise AssertionError("завдання не завершилось")


def test_file_upload_flow(base):
    c = webapp.app.test_client()
    assert "Парсер вебсторінок" in c.get("/").get_data(as_text=True)
    links = f"{base}/article\n{base}/cp1251\n{base}/article\n".encode()
    r = c.post("/api/jobs", data={"file": (io.BytesIO(links), "links.txt"), "images": "1"},
               content_type="multipart/form-data")
    j = r.get_json()
    assert r.status_code == 200 and j["total"] == 2  # повтор прибрано
    st = wait(c, j["id"])
    assert [it["status"] for it in st["items"]] == ["ok", "ok"]
    d = c.get(f"/api/jobs/{j['id']}/doc/0").get_json()
    assert "<table>" in d["html"] and f"/img/{j['id']}/0/0" in d["html"]
    assert c.get(f"/img/{j['id']}/0/0").mimetype in ("image/png", "image/jpeg")
    r = c.get(f"/download/{j['id']}.docx")
    assert r.status_code == 200 and r.data[:2] == b"PK" and "filename*=UTF-8''" in r.headers["Content-Disposition"]
    z = zipfile.ZipFile(io.BytesIO(c.get(f"/download/{j['id']}.zip").data))
    assert len(z.namelist()) == 2
    assert c.get(f"/download/{j['id']}/1.docx").status_code == 200


def test_no_urls():
    c = webapp.app.test_client()
    r = c.post("/api/jobs", data={"urls": "тут немає посилань"})
    assert r.status_code == 400 and "Не знайдено" in r.get_json()["error"]


def test_pages_plural():
    assert [webapp.pages(n) for n in (1, 2, 5, 11, 21, 22)] == [
        "1 сторінка", "2 сторінки", "5 сторінок", "11 сторінок", "21 сторінка", "22 сторінки"]
