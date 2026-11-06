import json
import os
import socket
import tempfile
import threading
import time
import unittest

from store import (History, Preset, PresetError, Settings, default_preset_path, history_path,
                   migrate_legacy, open_startup_preset)
from winsys import acquire_single_instance, hotkey_label, parse_hotkey


class TmpCase(unittest.TestCase):
    def setUp(self):
        self._d = tempfile.TemporaryDirectory()
        self.dir = self._d.name

    def tearDown(self):
        self._d.cleanup()

    def p(self, *parts):
        return os.path.join(self.dir, *parts)


class PresetTests(TmpCase):
    def setUp(self):
        super().setUp()
        self.path = self.p("sub", "my.preset.json")
        self.pr = Preset.open_or_create(self.path)

    def test_create_writes_file_and_name_from_filename(self):
        self.assertTrue(os.path.exists(self.path))
        self.assertEqual(self.pr.name, "my")

    def test_category_crud_and_validation(self):
        work = self.pr.add_category("  Робота  ")
        self.assertEqual(work["name"], "Робота")
        self.assertIsNone(self.pr.add_category("робота"))
        self.assertIsNone(self.pr.add_category("   "))
        self.assertTrue(self.pr.rename_category(work["id"], "Робота 2"))
        self.assertTrue(self.pr.rename_category(work["id"], "робота 2"))
        other = self.pr.add_category("Дім")
        self.assertFalse(self.pr.rename_category(other["id"], "РОБОТА 2"))
        self.assertNotEqual(work["color"], other["color"])

    def test_new_category_gets_unused_color(self):
        a, b, c = (self.pr.add_category(n) for n in "ABC")
        self.pr.delete_category(a["id"])
        d = self.pr.add_category("D")
        self.assertNotIn(d["color"], (b["color"], c["color"]))

    def test_move_category(self):
        a, b, c = (self.pr.add_category(n) for n in "ABC")
        self.pr.move_category(c["id"], -1)
        self.assertEqual([x["name"] for x in self.pr.categories], ["A", "C", "B"])
        self.pr.move_category(a["id"], -5)  # межі
        self.assertEqual(self.pr.categories[0]["name"], "A")

    def test_snippets_crud(self):
        a, b = self.pr.add_category("A"), self.pr.add_category("B")
        s1 = self.pr.add_snippet(a["id"], "one")
        self.assertEqual(self.pr.add_snippet(a["id"], "one")["id"], s1["id"])  # без дублів у категорії
        self.assertIsNotNone(self.pr.add_snippet(b["id"], "one"))               # в іншій — можна
        self.assertIsNone(self.pr.add_snippet(a["id"], "  \n"))
        self.assertIsNone(self.pr.add_snippet("nope", "x"))
        self.assertTrue(self.pr.update_snippet(s1["id"], "uno", b["id"]))
        self.assertEqual([s["text"] for s in self.pr.snippets(b["id"])], ["one", "uno"])
        self.assertFalse(self.pr.update_snippet(s1["id"], " "))
        self.assertTrue(self.pr.move_snippet(s1["id"], a["id"]))
        self.assertEqual(self.pr.count(a["id"]), 1)
        self.pr.remove_snippet(s1["id"])
        self.assertEqual(self.pr.count(a["id"]), 0)

    def test_reorder_and_search(self):
        a = self.pr.add_category("A")
        s = [self.pr.add_snippet(a["id"], t) for t in ("apple", "Banana", "cherry")]
        self.pr.reorder_snippet(s[2]["id"], -2)
        self.assertEqual([x["text"] for x in self.pr.snippets(a["id"])], ["cherry", "apple", "Banana"])
        self.assertEqual([x["text"] for x in self.pr.snippets(None, "BAN")], ["Banana"])
        self.assertEqual(self.pr.snippets(a["id"])[0]["category"], a["id"])

    def test_delete_category_removes_its_snippets(self):
        a = self.pr.add_category("A")
        self.pr.add_snippet(a["id"], "x")
        self.assertEqual(self.pr.delete_category(a["id"]), 1)
        self.assertEqual(self.pr.categories, [])

    def test_persist_roundtrip_unicode_and_reserved_formats(self):
        a = self.pr.add_category("Шаблони 🌍")
        self.pr.add_snippet(a["id"], "Привіт, світе 🌍")
        self.pr.formats = [{"name": "future"}]
        self.pr.save()
        again = Preset.open(self.path)
        self.assertEqual(again.categories[0]["name"], "Шаблони 🌍")
        self.assertEqual(again.categories[0]["snippets"][0]["text"], "Привіт, світе 🌍")
        self.assertEqual(again.formats, [{"name": "future"}])
        with open(self.path, encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data["format"], "clipboard-memory-preset")

    def test_open_rejects_garbage(self):
        for content in ("{not json", "[]", '{"foo": 1}', '{"format": "other", "categories": []}'):
            bad = self.p("bad.json")
            with open(bad, "w", encoding="utf-8") as f:
                f.write(content)
            with self.assertRaises(PresetError):
                Preset.open(bad)
        with self.assertRaises(PresetError):
            Preset.open(self.p("missing.json"))

    def test_save_as_switches_file(self):
        a = self.pr.add_category("A")
        self.pr.add_snippet(a["id"], "x")
        new = self.p("copy.preset.json")
        self.pr.save_as(new, "Копія")
        self.assertEqual(self.pr.path, new)
        self.assertEqual(Preset.open(new).name, "Копія")
        self.pr.add_snippet(a["id"], "y")           # далі пишемо вже в новий файл
        self.assertEqual(len(Preset.open(new).snippets()), 2)
        self.assertEqual(len(Preset.open(self.path).snippets()), 1)

    def test_external_change_is_picked_up_but_own_writes_are_not(self):
        a = self.pr.add_category("A")
        self.pr.add_snippet(a["id"], "mine")
        self.assertFalse(self.pr.changed_on_disk())     # власний запис не «зовнішня зміна»
        other = Preset.open(self.path)
        time.sleep(0.02)
        other.add_snippet(other.categories[0]["id"], "from outside")
        self.assertTrue(self.pr.changed_on_disk())
        self.assertTrue(self.pr.reload())
        self.assertEqual([s["text"] for s in self.pr.snippets()], ["mine", "from outside"])
        self.assertFalse(self.pr.reload())

    def test_reload_ignores_half_written_file(self):
        self.pr.add_category("A")
        time.sleep(0.02)
        with open(self.path, "w") as f:
            f.write('{"categories": [')
        self.assertFalse(self.pr.reload())
        self.assertEqual(len(self.pr.categories), 1)    # пам'ять не зіпсовано

    def test_import_merges_by_category_name(self):
        a = self.pr.add_category("Робота")
        self.pr.add_snippet(a["id"], "same")
        other = Preset.open_or_create(self.p("other.preset.json"))
        oa, ob = other.add_category("робота"), other.add_category("Нова")
        other.add_snippet(oa["id"], "same")
        other.add_snippet(oa["id"], "extra")
        other.add_snippet(ob["id"], "n1")
        self.assertEqual(self.pr.import_from(other.path), (1, 2))
        self.assertEqual([s["text"] for s in self.pr.snippets(a["id"])], ["same", "extra"])
        self.assertEqual(self.pr.import_from(other.path), (0, 0))   # повторний імпорт нічого не додає


class HistoryTests(TmpCase):
    def test_add_dedupe_trim_persist(self):
        h = History(self.p("h.json"), max_items=3)
        for t in ("a", "b", "a", "c", "d"):
            h.add(t)
        self.assertEqual([i["text"] for i in h.items], ["d", "c", "a"])
        self.assertEqual([i["text"] for i in History(self.p("h.json")).items], ["d", "c", "a"])
        self.assertIsNone(h.add("   "))
        self.assertIsNone(h.add("x" * 200_000))

    def test_view_remove_clear_and_corrupt(self):
        h = History(self.p("h.json"))
        a = h.add("Hello")
        h.add("world")
        self.assertEqual([i["text"] for i in h.view("HEL")], ["Hello"])
        h.remove(a["id"])
        self.assertEqual(len(h.items), 1)
        h.clear()
        self.assertEqual(h.items, [])
        with open(self.p("bad.json"), "w") as f:
            f.write("{oops")
        self.assertEqual(History(self.p("bad.json")).items, [])
        self.assertTrue(os.path.exists(self.p("bad.json.bak")))


class StartupTests(TmpCase):
    def test_fresh_start_creates_default_preset(self):
        s = Settings(self.p("settings.json"))
        pr, warn = open_startup_preset(s, self.dir)
        self.assertIsNone(warn)
        self.assertEqual(pr.path, default_preset_path(self.dir))
        self.assertEqual(s["preset_path"], pr.path)
        self.assertIn(pr.path, s["recent_presets"])

    def test_remembered_and_cli_preset(self):
        mine = Preset.open_or_create(self.p("mine.preset.json"))
        mine.add_category("X")
        s = Settings(self.p("settings.json"))
        pr, _ = open_startup_preset(s, self.dir, preset_arg=mine.path)
        self.assertEqual(pr.categories[0]["name"], "X")
        pr2, _ = open_startup_preset(Settings(self.p("settings.json")), self.dir)   # без аргументу — запам'ятований
        self.assertEqual(pr2.path, mine.path)

    def test_broken_custom_preset_falls_back_with_warning_and_keeps_file(self):
        bad = self.p("broken.preset.json")
        with open(bad, "w") as f:
            f.write("{nope")
        s = Settings(self.p("settings.json"))
        pr, warn = open_startup_preset(s, self.dir, preset_arg=bad)
        self.assertIn("broken.preset.json", warn)
        self.assertEqual(pr.path, default_preset_path(self.dir))
        with open(bad) as f:
            self.assertEqual(f.read(), "{nope")          # чужий файл не чіпаємо

    def test_migration_from_v2_history(self):
        legacy = {"version": 2,
                  "categories": [{"id": "c1", "name": "Робота", "color": "#d83b01"}],
                  "items": [
                      {"id": "1", "text": "newest loose", "pinned": False, "ts": 3, "category": None},
                      {"id": "2", "text": "in work 2", "pinned": False, "ts": 2, "category": "c1"},
                      {"id": "3", "text": "pinned loose", "pinned": True, "ts": 2, "category": None},
                      {"id": "4", "text": "in work 1", "pinned": False, "ts": 1, "category": "c1"},
                  ]}
        with open(self.p("history.json"), "w", encoding="utf-8") as f:
            json.dump(legacy, f)
        pr, _ = open_startup_preset(Settings(self.p("settings.json")), self.dir)
        names = [c["name"] for c in pr.categories]
        self.assertEqual(names, ["Робота", "Закріплені"])
        self.assertEqual([s["text"] for s in pr.snippets(pr.categories[0]["id"])], ["in work 1", "in work 2"])
        self.assertEqual(pr.categories[0]["color"], "#d83b01")
        self.assertEqual([s["text"] for s in pr.snippets(pr.categories[1]["id"])], ["pinned loose"])
        self.assertEqual([i["text"] for i in History(history_path(self.dir)).items], ["newest loose"])
        self.assertTrue(os.path.exists(self.p("history.json.migrated")))
        self.assertFalse(os.path.exists(self.p("history.json")))

    def test_migrate_legacy_bad_file_is_noop(self):
        with open(self.p("history.json"), "w") as f:
            f.write("{bad")
        pr = Preset.open_or_create(self.p("p.preset.json"))
        self.assertFalse(migrate_legacy(self.p("history.json"), pr, History(self.p("h.json"))))


class SettingsTests(TmpCase):
    def test_defaults_roundtrip_and_bad_types(self):
        path = self.p("settings.json")
        s = Settings(path)
        self.assertEqual(s["hotkey"], "ctrl+x")
        self.assertEqual(s["theme"], "system")
        s["hotkey"] = "ctrl+alt+v"
        self.assertEqual(Settings(path)["hotkey"], "ctrl+alt+v")
        with open(path, "w") as f:
            f.write('{"hotkey": 5, "autohide": false}')
        t = Settings(path)
        self.assertEqual(t["hotkey"], "ctrl+x")
        self.assertFalse(t["autohide"])

    def test_remember_preset_keeps_recent_unique(self):
        s = Settings(self.p("settings.json"))
        for name in ("a", "b", "a"):
            s.remember_preset(name)
        self.assertEqual(s["recent_presets"], ["a", "b"])
        self.assertEqual(Settings(self.p("settings.json"))["preset_path"], "a")
        self.assertEqual(Settings(self.p("other.json"))["recent_presets"], [])   # дефолти не спільні


class HotkeyTests(unittest.TestCase):
    def test_parse(self):
        self.assertEqual(parse_hotkey("ctrl+x"), (0x2, ord("X")))
        self.assertEqual(parse_hotkey("Ctrl+Shift+X"), (0x2 | 0x4, ord("X")))
        self.assertEqual(parse_hotkey("ctrl+alt+v"), (0x1 | 0x2, ord("V")))
        for bad in ("off", "", "x", "foo+x", "ctrl+", "ctrl+f13"):
            self.assertIsNone(parse_hotkey(bad), bad)

    def test_label(self):
        self.assertEqual(hotkey_label("ctrl+shift+x"), "Ctrl+Shift+X")
        self.assertEqual(hotkey_label("off"), "")


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait(cond, tries=100):
    for _ in range(tries):
        if cond():
            return True
        time.sleep(0.02)
    return False


def _fake_server(port, handler):
    """Імітація чужого/старого сервера: handler(conn, data) відповідає як хоче."""
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", port))
    srv.listen(5)

    def loop():
        while True:
            try:
                conn, _ = srv.accept()
            except OSError:
                return
            with conn:
                conn.settimeout(0.5)
                try:
                    handler(conn, conn.recv(8))
                except OSError:
                    pass

    threading.Thread(target=loop, daemon=True).start()
    return srv


class SingleInstanceTests(unittest.TestCase):
    def test_same_version_shows_existing_and_second_exits(self):
        port, shown = _free_port(), []
        first, st1 = acquire_single_instance(lambda: shown.append(1), lambda: None, version="3", port=port)
        self.assertEqual(st1, "primary")
        lock, st2 = acquire_single_instance(lambda: None, lambda: None, version="3", port=port)
        self.assertEqual((lock, st2), (None, "existing"))
        self.assertTrue(_wait(lambda: shown))
        first.close()

    def test_newer_version_replaces_older(self):
        port, quit_called = _free_port(), []
        first, _ = acquire_single_instance(lambda: None, lambda: quit_called.append(1), version="2", port=port)
        lock, status = acquire_single_instance(lambda: None, lambda: None, version="3", port=port)
        self.assertEqual(status, "replaced")
        self.assertIsNotNone(lock)
        self.assertTrue(_wait(lambda: quit_called))       # стара копія отримала команду закритись
        lock.close()

    def test_older_never_replaces_newer(self):
        port, quit_called = _free_port(), []
        first, _ = acquire_single_instance(lambda: None, lambda: quit_called.append(1), version="5", port=port)
        lock, status = acquire_single_instance(lambda: None, lambda: None, version="2", port=port)
        self.assertEqual((lock, status), (None, "existing"))
        time.sleep(0.1)
        self.assertEqual(quit_called, [])
        first.close()

    def test_legacy_instance_without_version_protocol_is_reported(self):
        port, shown = _free_port(), []

        def legacy(conn, data):                  # як у старих збірках: розуміє лише b"show"
            if data == b"show":
                conn.sendall(b"ok")
                shown.append(1)

        fake = _fake_server(port, legacy)
        lock, status = acquire_single_instance(lambda: None, lambda: None, version="3", port=port)
        self.assertEqual((lock, status), (None, "outdated"))
        self.assertTrue(_wait(lambda: shown))
        fake.close()

    def test_stuck_old_instance_is_reported(self):
        port = _free_port()
        fake = _fake_server(port, lambda conn, data: conn.sendall(b"ok 1") if data == b"ver?" else
                            (conn.sendall(b"ok") if data == b"quit" else None))   # відповідає, але не закривається
        t0 = time.time()
        lock, status = acquire_single_instance(lambda: None, lambda: None, version="3", port=port)
        self.assertEqual((lock, status), (None, "stuck"))
        self.assertGreater(time.time() - t0, 4)
        fake.close()

    def test_foreign_listener_does_not_block_start(self):
        port = _free_port()
        fake = _fake_server(port, lambda conn, data: None)     # приймає й мовчить
        lock, status = acquire_single_instance(lambda: None, lambda: None, version="3", port=port)
        self.assertEqual(status, "foreign")
        self.assertIsNotNone(lock)
        fake.close()


if __name__ == "__main__":
    unittest.main()
