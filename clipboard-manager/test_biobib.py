"""Автотести BioBib (сторінка «Посилання»): форматування ДСТУ 8302:2015, розділи (папки → підпапки) і API
бібліотеки. Тести API пропускаються, якщо FastAPI не встановлено (pip install -r requirements.txt)."""

import os
import shutil
import tempfile
import unittest

from biobib import config
from biobib.citations.dstu8302 import format_dstu8302, format_in_text_citation
from biobib import sections
from biobib.database import get_connection, init_db

try:
    import fastapi  # noqa: F401
    import httpx  # noqa: F401
    HAVE_API = True
except ImportError:
    HAVE_API = False


# ---- ДСТУ 8302:2015 (тести з ТЗ BioBib) ---------------------------------------------------------------------
def test_dstu_article_ukrainian_exact_spec():
    source = {
        "type": "article",
        "language": "uk",
        "authors": [
            {"role": "author", "family": "Іваненко", "given_initials": "І. І."},
            {"role": "author", "family": "Петренко", "given_initials": "П. П."},
        ],
        "title": "Назва статті",
        "container_title": "Назва журналу",
        "year": 2020,
        "volume": "5",
        "issue": "2",
        "pages": "15-20",
        "doi": "10.xxxx/xxxxx",
    }
    expected = (
        "Іваненко І. І., Петренко П. П. Назва статті. Назва журналу. "
        "2020. Т. 5, № 2. С. 15–20. DOI: 10.xxxx/xxxxx."
    )
    assert format_dstu8302(source) == expected


def test_dstu_article_english_exact_spec():
    source = {
        "type": "article",
        "language": "en",
        "authors": [
            {"role": "author", "family": "Smith", "given_initials": "J."},
            {"role": "author", "family": "Brown", "given_initials": "A."},
        ],
        "title": "Title of the article",
        "container_title": "Journal Name",
        "year": 2019,
        "volume": "12",
        "issue": "3",
        "pages": "45-50",
        "doi": "https://doi.org/10.xxxx/xxxxx",
    }
    expected = (
        "Smith J., Brown A. Title of the article. Journal Name. "
        "2019. Vol. 12, no. 3. P. 45–50. DOI: 10.xxxx/xxxxx."
    )
    assert format_dstu8302(source) == expected


def test_dstu_book_exact_spec():
    source = {
        "type": "book",
        "language": "uk",
        "authors": [
            {"role": "author", "family": "Прізвище", "given_initials": "І. Б."},
        ],
        "title": "Назва книги",
        "subtitle": "навч. посіб.",
        "place": "Київ",
        "publisher": "Видавництво",
        "year": 2018,
        "page_count": 250,
    }
    expected = "Прізвище І. Б. Назва книги : навч. посіб. Київ : Видавництво, 2018. 250 с."
    assert format_dstu8302(source) == expected


def test_dstu_web_exact_spec():
    source = {
        "type": "web",
        "language": "uk",
        "authors": [],
        "title": "Назва сторінки",
        "container_title": "Назва сайту",
        "url": "https://…",
        "accessed_date": "2026-11-19",
    }
    expected = "Назва сторінки. Назва сайту. URL: https://… (дата звернення: 19.11.2026)."
    assert format_dstu8302(source) == expected


def test_dstu_four_plus_authors_modes():
    source = {
        "type": "article",
        "language": "en",
        "authors": [
            {"role": "author", "family": "Alpha", "given_initials": "A."},
            {"role": "author", "family": "Beta", "given_initials": "B."},
            {"role": "author", "family": "Gamma", "given_initials": "G."},
            {"role": "author", "family": "Delta", "given_initials": "D."},
        ],
        "title": "Endophytic bacteria of Solanum nigrum",
        "container_title": "Plant Soil",
        "year": 2024,
        "volume": "500",
        "pages": "10–22",
    }

    assert format_dstu8302(source, "first_3_et_al").startswith(
        "Alpha A., Beta B., Gamma G. et al. Endophytic bacteria"
    )
    assert format_dstu8302(source, "first_1_et_al").startswith(
        "Alpha A. et al. Endophytic bacteria"
    )
    assert format_dstu8302(source, "all").startswith(
        "Alpha A., Beta B., Gamma G., Delta D. Endophytic bacteria"
    )
    assert format_dstu8302(source, "title_first").startswith(
        "Endophytic bacteria of Solanum nigrum / A. Alpha et al."
    )


def test_in_text_citations():
    src = {
        "id": 12,
        "language": "en",
        "year": 2019,
        "authors": [{"role": "author", "family": "Smith", "given_initials": "J."}],
    }
    assert format_in_text_citation(src, number=12, style="dstu8302") == "[12]"
    assert format_in_text_citation(src, number=12, style="dstu8302", page="47") == "[12, p. 47]"
    assert format_in_text_citation(src, style="apa") == "(Smith, 2019)"


class DstuTests(unittest.TestCase):
    pass


for _name, _fn in list(globals().items()):
    if _name.startswith("test_") and callable(_fn):
        setattr(DstuTests, _name, lambda self, f=_fn: f())
del _name, _fn


class _TmpData(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.saved = (config.DATA_DIR, config.DB_PATH, config.STORAGE_DIR)
        config.configure(self.tmp)
        init_db()
        self.conn = get_connection()

    def tearDown(self):
        self.conn.close()
        config.DATA_DIR, config.DB_PATH, config.STORAGE_DIR = self.saved
        shutil.rmtree(self.tmp, ignore_errors=True)

    def add_source(self, title, year=2020, family="Іваненко"):
        now = "2026-01-01T00:00:00"
        cur = self.conn.execute(
            "INSERT INTO sources (type, title, container_title, year, language, created_at, updated_at) "
            "VALUES ('article', ?, 'Назва журналу', ?, 'uk', ?, ?)", (title, year, now, now))
        self.conn.execute("INSERT INTO authors (source_id, family, given_initials) VALUES (?, ?, 'І. І.')",
                          (cur.lastrowid, family))
        self.conn.commit()
        return cur.lastrowid


class SectionsTests(_TmpData):
    def test_default_sections_dissertation_relevance(self):
        tops = sections.list_sections(self.conn)
        self.assertEqual([t["title"] for t in tops], ["Дисертація"])
        subs = sections.list_sections(self.conn, tops[0]["id"])
        self.assertEqual([s["title"] for s in subs], ["Актуальність"])
        self.assertEqual(subs[0]["path"], "Дисертація › Актуальність")
        init_db()                                            # повторний запуск не дублює
        self.assertEqual(len(sections.list_sections(self.conn, all_levels=True)), 2)

    def test_only_two_levels_and_crud(self):
        top = sections.create_section(self.conn, "  Огляд   літератури ")
        self.assertEqual(top["title"], "Огляд літератури")
        sub = sections.create_section(self.conn, "Розділ 1", top["id"])
        self.assertIsNotNone(sub)
        self.assertIsNone(sections.create_section(self.conn, "Глибше", sub["id"]), "лише підпапки")
        self.assertIsNone(sections.create_section(self.conn, "   "))
        self.assertTrue(sections.rename_section(self.conn, sub["id"], "Розділ 1. Огляд"))
        self.assertEqual(sections.get_section(self.conn, sub["id"])["title"], "Розділ 1. Огляд")
        second = sections.create_section(self.conn, "Розділ 2", top["id"])
        self.assertTrue(sections.move_section(self.conn, second["id"], -1))
        self.assertEqual([s["title"] for s in sections.list_sections(self.conn, top["id"])],
                         ["Розділ 2", "Розділ 1. Огляд"])
        self.assertTrue(sections.delete_section(self.conn, top["id"]))
        self.assertIsNone(sections.get_section(self.conn, sub["id"]), "підпапки видаляються разом із папкою")

    def test_sources_in_section_citation_and_bibliography(self):
        sub = sections.list_sections(self.conn, sections.list_sections(self.conn)[0]["id"])[0]
        a = self.add_source("Перша стаття", 2021, "Петренко")
        b = self.add_source("Друга стаття", 2019, "Іваненко")
        self.assertTrue(sections.attach(self.conn, a, sub["id"]))
        self.assertTrue(sections.attach(self.conn, b, sub["id"]))
        self.assertFalse(sections.attach(self.conn, a, sub["id"]), "вдруге не додається")
        items = sections.sources_in(self.conn, sub["id"])
        self.assertEqual([s["id"] for s in items], [a, b])
        self.assertEqual(items[0]["citation_dstu"], "Петренко І. І. Перша стаття. Назва журналу. 2021.")
        self.assertEqual(sections.get_section(self.conn, sub["id"])["count"], 2)
        self.assertTrue(sections.move_source(self.conn, b, sub["id"], -1))
        bib = sections.bibliography(self.conn, sub["id"])
        self.assertEqual(bib.splitlines(), ["1. Іваненко І. І. Друга стаття. Назва журналу. 2019.",
                                            "2. Петренко І. І. Перша стаття. Назва журналу. 2021."])
        self.assertEqual([s["id"] for s in sections.all_sources(self.conn, "петренко")], [a])
        self.assertTrue(sections.detach(self.conn, a, sub["id"]))
        self.assertEqual([s["id"] for s in sections.sources_in(self.conn, sub["id"])], [b])
        sections.set_source_sections(self.conn, a, [sub["id"]])
        self.conn.commit()
        self.assertEqual(sections.section_ids_of(self.conn, a), [sub["id"]])


@unittest.skipUnless(HAVE_API, "FastAPI/httpx не встановлено")
class ApiTests(_TmpData):
    def client(self):
        from fastapi.testclient import TestClient

        from biobib.main import app
        return TestClient(app)

    def test_api_flow(self):
        with self.client() as c:
            _api_flow(c, config)

    def test_api_sections(self):
        with self.client() as c:
            secs = c.get("/api/sections").json()
            self.assertEqual([s["path"] for s in secs], ["Дисертація", "Дисертація › Актуальність"])
            sub = secs[1]["id"]
            r = c.post("/api/sources", json={"title": "Стаття для актуальності", "year": 2024,
                                             "section_ids": [sub],
                                             "authors": [{"family": "Коваль", "given_initials": "О. В."}]})
            self.assertEqual(r.status_code, 201)
            self.assertEqual(r.json()["section_ids"], [sub])
            c.post("/api/sources", json={"title": "Поза розділами"})
            self.assertEqual(len(c.get("/api/sources").json()), 2)
            self.assertEqual([s["title"] for s in c.get("/api/sources", params={"section": sub}).json()],
                             ["Стаття для актуальності"])
            self.assertEqual(len(c.get("/api/sources", params={"section": secs[0]["id"]}).json()), 1,
                             "папка показує й джерела підпапок")
            bib = c.get(f"/api/sections/{sub}/bibliography").json()["text"]
            self.assertTrue(bib.startswith("1. Коваль О. В. Стаття для актуальності."), bib)
            new = c.post("/api/sections", json={"title": "Методи", "parent_id": secs[0]["id"]})
            self.assertEqual(new.status_code, 201)
            self.assertEqual(c.post("/api/sections", json={"title": "x", "parent_id": new.json()["id"]}).status_code,
                             400)
            self.assertEqual(c.get("/").status_code, 200)


# ---- сценарій API з ТЗ BioBib: CRUD, пошук FTS5, нотатки, файли --------------------------------------------
def _api_flow(client, config):
    payload = {
        "type": "article",
        "language": "en",
        "title": "Endophytic Bacillus subtilis promotes growth of Solanum nigrum",
        "container_title": "Journal of Applied Microbiology",
        "year": 2023,
        "volume": "134",
        "issue": "4",
        "pages": "101-112",
        "doi": "10.1093/jambio/lxad001",
        "status": "processed",
        "rating": 5,
        "tags": ["Solanum nigrum", "ендофіти", "ростостимуляція"],
        "study_object": "Solanum nigrum, Bacillus subtilis strain SN-12",
        "methods": "16S rRNA sequencing, IAA assay",
        "description": "Корисна стаття про стимуляцію росту пасльону чорного.",
        "authors": [
            {"role": "author", "family": "Kovalenko", "given_initials": "O. V."}
        ],
    }

    resp = client.post("/api/sources", json=payload)
    assert resp.status_code == 201
    created = resp.json()
    source_id = created["id"]
    assert "Vol. 134, no. 4. P. 101–112." in created["citation_dstu"]
    assert len(created["notes"]) == 1

    # Пошук за латинською назвою виду (префіксний)
    search_latin = client.get("/api/sources", params={"q": "Solan"})
    assert search_latin.status_code == 200
    assert len(search_latin.json()) == 1

    # Пошук за українським словом з опису
    search_uk = client.get("/api/sources", params={"q": "пасльону"})
    assert search_uk.status_code == 200
    assert len(search_uk.json()) == 1
    assert search_uk.json()[0]["match_field"] == "notes"

    # Додавання нотатки-цитати
    note_resp = client.post(
        f"/api/sources/{source_id}/notes",
        json={
            "kind": "quote",
            "page": "105",
            "text": "Strain SN-12 produced 42 ug/mL of indole-3-acetic acid.",
            "comment": "Взяти в розділ 1",
        },
    )
    assert note_resp.status_code == 201
    assert len(client.get("/api/sources", params={"q": "indole"}).json()) == 1

    # Прикріплення файлу
    file_resp = client.post(
        f"/api/sources/{source_id}/files",
        files={"file": ("supplementary_S1.txt", b"heavy metals cadmium tolerance", "text/plain")},
        data={"label": "supplementary S1"},
    )
    assert file_resp.status_code == 201
    file_id = file_resp.json()["id"]

    # Завантаження файлу
    dl = client.get(f"/api/files/{file_id}")
    assert dl.status_code == 200
    assert dl.content == b"heavy metals cadmium tolerance"

    # Видалення джерела разом із файлами
    del_resp = client.delete(f"/api/sources/{source_id}", params={"delete_files": "true"})
    assert del_resp.status_code == 200
    assert client.get(f"/api/sources/{source_id}").status_code == 404
    assert not (config.STORAGE_DIR / file_resp.json()["path"]).exists()


if __name__ == "__main__":
    unittest.main()


# ---- раунд 28: набір джерел дисертації, дублікати, PDF «пачкою», відкриття на диску, читалка -----------------
try:
    import pypdf  # noqa: F401
    HAVE_PDF = True
except ImportError:
    HAVE_PDF = False


def make_pdf(lines):
    """Найпростіший PDF з текстом (рядки — Helvetica) — для тестів без справжніх статей."""
    ops = ["BT /F1 11 Tf 50 780 Td 14 TL"] + ["(%s) Tj T*" % ln.replace("\\", "\\\\").replace("(", "\\(")
                                                .replace(")", "\\)") for ln in lines] + ["ET"]
    stream = "\n".join(ops).encode("latin-1")
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
            b"/Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out = bytearray(b"%PDF-1.4\n")
    offs = []
    for n, o in enumerate(objs, 1):
        offs.append(len(out))
        out += b"%d 0 obj\n" % n + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offs)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return bytes(out)


class LibraryTests(_TmpData):
    def setUp(self):
        super().setUp()
        from biobib import library
        self.lib = library

    def test_seed_sources_sections_descriptions_idempotent(self):
        data = self.lib.load_seed()
        self.assertEqual(len(data["sources"]), 27)
        self.assertEqual(len({s["source"].get("doi") or s["source"]["title"] for s in data["sources"]}), 27,
                         "у наборі немає дублікатів")
        rep = self.lib.import_seed(self.conn)
        self.assertEqual(len(rep["added"]), 27)
        self.assertTrue(self.lib.import_seed(self.conn)["skipped"], "вдруге автоматично не імпортується")
        rep2 = self.lib.import_seed(self.conn, force=True)
        self.assertEqual((len(rep2["added"]), len(rep2["existing"])), (0, 27), "примусово — без дублікатів")
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0], 27)
        paths = {s["path"]: s["count"] for s in sections.list_sections(self.conn, all_levels=True)}
        self.assertEqual(paths["Дисертація › Актуальність"], 0)
        self.assertEqual(paths["Дисертація › Метааналізи ефективності PGPB"], 14)
        self.assertEqual(paths["Дисертація › Ендофіти пасльонових (Solanum)"], 7)
        self.assertEqual(len(self.lib.descriptions(self.conn)), 27, "у кожного джерела — опис")
        sid = self.lib.find_source(self.conn, "https://doi.org/10.1093/JXB/erac228")
        src = sections.source_brief(self.conn, self.conn.execute("SELECT * FROM sources WHERE id = ?",
                                                                (sid,)).fetchone())
        self.assertEqual(src["citation_dstu"], "Tran T., French E., Iyer-Pascuzzi A. S. In vitro functional "
                         "characterization predicts the impact of bacterial root endophytes on plant growth. Journal of "
                         "Experimental Botany. 2022. Vol. 73, no. 16. P. 5758–5772. DOI: 10.1093/jxb/erac228.")
        sec = [s for s in sections.list_sections(self.conn, all_levels=True) if s["title"].startswith("Метаан")][0]
        bib = sections.bibliography(self.conn, sec["id"]).splitlines()
        self.assertTrue(bib[0].startswith("1. Azarbad H., Junker R. R."), "за абеткою")
        self.assertIn("Art. 858804", "\n".join(bib), "номер статті замість сторінок")

    def test_seed_fills_existing_source_and_dedupe_merges(self):
        own = self.add_source("Carotenoids as antioxidants", 2001, "Krinsky")      # уже було, без DOI й опису
        sub = sections.list_sections(self.conn, sections.list_sections(self.conn)[0]["id"])[0]
        sections.attach(self.conn, own, sub["id"])
        self.lib.import_seed(self.conn)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0], 27)
        row = self.conn.execute("SELECT doi, container_title FROM sources WHERE id = ?", (own,)).fetchone()
        self.assertEqual(row["doi"], "10.1016/S0899-9007(01)00651-7")
        self.assertEqual(row["container_title"], "Назва журналу", "своє, заповнене, не переписується")
        # дублікат з іншим записом DOI: зливається в старіше джерело разом із розділами й нотатками
        dup = self.add_source("Інша назва того самого", 2001, "Krinsky")
        self.conn.execute("UPDATE sources SET doi = 'https://doi.org/10.1016/s0899-9007(01)00651-7' WHERE id = ?",
                          (dup,))
        self.conn.execute("INSERT INTO notes (source_id, kind, text, created_at, updated_at) "
                          "VALUES (?, 'quote', 'Цитата з дубліката', 'x', 'x')", (dup,))
        other = sections.create_section(self.conn, "Розділ 3", sections.list_sections(self.conn)[0]["id"])
        sections.attach(self.conn, dup, other["id"])
        merged = self.lib.dedupe_sources(self.conn)
        self.assertEqual([(m["kept"], m["removed"]) for m in merged], [(own, [dup])])
        self.assertIsNone(self.conn.execute("SELECT 1 FROM sources WHERE id = ?", (dup,)).fetchone())
        self.assertIn(other["id"], sections.section_ids_of(self.conn, own))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM notes WHERE source_id = ? AND kind = 'quote'",
                                           (own,)).fetchone()[0], 1)
        self.assertEqual(self.lib.dedupe_sources(self.conn), [])

    def test_attach_pdfs_files_zip_duplicates(self):
        import zipfile
        self.lib.import_seed(self.conn)
        sid = self.lib.find_source(self.conn, "10.1111/ppl.13806")
        pdf = make_pdf(["Physiologia Plantarum 2022", "DOI: 10.1111/ppl.13806", "Introduction", "Text."])
        d = os.path.join(self.tmp, "in")
        os.makedirs(d)
        with open(os.path.join(d, "a.pdf"), "wb") as fh:
            fh.write(pdf)
        with open(os.path.join(d, "mili2023.pdf"), "wb") as fh:
            fh.write(b"<html><title>404 Not Found</title></html>")
        rep = self.lib.attach_pdfs(self.conn, [os.path.join(d, "a.pdf"), os.path.join(d, "mili2023.pdf")],
                                   source_id=None if HAVE_PDF else sid)
        self.assertEqual([(n, s_) for n, s_, _t, _h in rep["attached"]], [("a.pdf", sid)])
        self.assertEqual(rep["not_pdf"], ["mili2023.pdf"])
        zpath = os.path.join(self.tmp, "pdfs.zip")
        with zipfile.ZipFile(zpath, "w") as zf:
            zf.writestr("a (1).pdf", pdf)
        rep2 = self.lib.attach_pdfs(self.conn, [zpath, d])
        self.assertEqual(rep2["attached"], [])
        self.assertEqual(len(rep2["duplicate"]), 2, "той самий файл — з ZIP і з теки")
        files = self.lib.files_of(self.conn, sid)
        self.assertEqual(len(files), 1)
        path = self.lib.file_path(self.conn, files[0]["id"])
        self.assertTrue(path.exists() and path.read_bytes() == pdf)
        if HAVE_PDF:
            self.assertIn("10.1111/ppl.13806", self.conn.execute("SELECT extracted_text FROM files").fetchone()[0])

    def test_open_on_disk(self):
        calls = []
        saved = self.lib.OPENER
        self.lib.OPENER = calls.append
        try:
            p = os.path.join(self.tmp, "x.pdf")
            with open(p, "wb") as fh:
                fh.write(make_pdf(["x"]))
            self.assertTrue(self.lib.open_on_disk(p))
            self.assertTrue(self.lib.open_on_disk(p, reveal=True))
            self.assertFalse(self.lib.open_on_disk(p + ".missing"))
        finally:
            self.lib.OPENER = saved
        self.assertEqual(len(calls), 2)
        self.assertTrue(calls[0][-1].endswith("x.pdf"))

    def test_reflow_paragraphs_headings_headers_refs(self):
        body = ("Plant growth promoting bacteria are widely studied as biofertilizers in many crops and "
                "regions of the world today")
        pages = []
        for n in range(1, 5):
            lines = [f"Journal of Things {n} (2022) 1-10", "Smith et al. Bacteria and plants"]
            if n == 1:
                lines += ["Abstract", body, "and they help plants under drought.", "1. Introduction"]
            lines += [body + f" (page {n})", "with some hyphen-", "ated words and com-", "pound P-", "uptake terms here.", "Short end.",
                      body + f" again {n}", "final sentence of the page."]
            if n == 4:
                lines += ["References", "Smith, A. (2020). First paper title. Journal 1, 1-2.",
                          "Brown, B. (2019). Second paper. Journal 2, 3-4."]
            lines.append(str(n))
            pages.append("\n".join(lines))
        blocks = self.lib.reflow(pages)
        texts = [b["text"] for b in blocks]
        self.assertFalse([t for t in texts if t.startswith(("Journal of Things", "Smith et al."))], "колонтитули")
        heads = [b["text"] for b in blocks if b["t"] == "h"]
        self.assertEqual(heads, ["Abstract", "1. Introduction", "References"])
        joined = " ".join(texts)
        self.assertIn("hyphenated words and compound P-uptake terms here.", joined)
        refs = [b["text"] for b in blocks if b["t"] == "r"]
        self.assertEqual(len(refs), 2)
        self.assertTrue(refs[1].startswith("Brown, B."))
        self.assertNotIn("4", [t.strip() for t in texts], "номери сторінок прибрано")

    @unittest.skipUnless(HAVE_API and HAVE_PDF, "FastAPI/httpx/pypdf не встановлено")
    def test_api_reader_and_open(self):
        from fastapi.testclient import TestClient

        from biobib.main import app
        self.lib.import_seed(self.conn)
        sid = self.lib.find_source(self.conn, "10.1111/ppl.13806")
        d = os.path.join(self.tmp, "p.pdf")
        with open(d, "wb") as fh:
            fh.write(make_pdf(["DOI 10.1111/ppl.13806", "Introduction", "Bacteria help plants under drought."]))
        self.lib.attach_pdfs(self.conn, [d])
        calls = []
        saved = self.lib.OPENER
        self.lib.OPENER = calls.append
        try:
            with TestClient(app) as c:
                data = c.get(f"/api/read/{sid}").json()
                self.assertIn("Tufail", data["source"]["citation_dstu"])
                self.assertTrue(data["source"]["description"])
                self.assertIn("Introduction", [t["text"] for t in data["toc"]])
                self.assertIn("Bacteria help plants", " ".join(b["text"] for b in data["blocks"]))
                self.assertEqual(c.get(f"/reader/{sid}").status_code, 200)
                fid = data["file_id"]
                self.assertEqual(c.post(f"/api/files/{fid}/open").status_code, 403, "без X-BioBib — ні")
                self.assertEqual(c.post(f"/api/files/{fid}/open?reveal=1", headers={"X-BioBib": "1"}).status_code,
                                 200)
                self.assertEqual(c.get("/api/read/99999").status_code, 404)
        finally:
            self.lib.OPENER = saved
        self.assertEqual(len(calls), 1)
