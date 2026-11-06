import os
import socket
import tempfile
import unittest

from store import ALL, UNCAT, Settings, Store
from winsys import acquire_single_instance, hotkey_label, parse_hotkey


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, "sub", "history.json")
        self.store = Store(self.path)

    def tearDown(self):
        self.dir.cleanup()

    def texts(self, **kw):
        return [i["text"] for i in self.store.view(**kw)]

    def test_add_and_persist(self):
        self.store.add("one")
        self.store.add("two", pinned=True)
        again = Store(self.path)
        self.assertEqual([i["text"] for i in again.items], ["two", "one"])
        self.assertTrue(again.items[0]["pinned"])

    def test_duplicates_move_to_top(self):
        self.store.add("a")
        self.store.add("b")
        self.store.add("a")
        self.assertEqual([i["text"] for i in self.store.items], ["a", "b"])

    def test_ignores_blank_and_huge(self):
        self.assertIsNone(self.store.add("   \n"))
        self.assertIsNone(self.store.add("x" * 200_000))
        self.assertEqual(self.store.items, [])

    def test_trim_keeps_pinned_and_categorized(self):
        s = Store(self.path, max_history=3)
        cat = s.add_category("Робота")
        s.add("keep-pin", pinned=True)
        s.add("keep-cat", category=cat["id"])
        for n in range(10):
            s.add(f"t{n}")
        texts = [i["text"] for i in s.items]
        self.assertIn("keep-pin", texts)
        self.assertIn("keep-cat", texts)
        self.assertEqual(len([i for i in s.items if not i["pinned"] and not i["category"]]), 3)

    def test_view_pinned_first_and_search(self):
        self.store.add("apple")
        self.store.add("Banana", pinned=True)
        self.store.add("cherry")
        self.assertEqual(self.texts(), ["Banana", "cherry", "apple"])
        self.assertEqual(self.texts(query="BAN"), ["Banana"])

    def test_update_pin_remove_clear(self):
        item = self.store.add("old")
        self.assertTrue(self.store.update(item["id"], "new"))
        self.assertFalse(self.store.update(item["id"], "  "))
        self.store.toggle_pin(item["id"])
        self.store.add("tmp")
        self.store.clear_history()
        self.assertEqual([i["text"] for i in self.store.items], ["new"])
        self.store.remove(item["id"])
        self.assertEqual(self.store.items, [])

    def test_corrupt_file_is_backed_up(self):
        os.makedirs(os.path.dirname(self.path))
        with open(self.path, "w") as f:
            f.write("{not json")
        s = Store(self.path)
        self.assertEqual(s.items, [])
        self.assertTrue(os.path.exists(self.path + ".bak"))

    def test_unicode_roundtrip(self):
        self.store.add("Привіт, світе 🌍")
        self.assertEqual(Store(self.path).items[0]["text"], "Привіт, світе 🌍")

    # -- категорії ----------------------------------------------------------
    def test_category_crud_and_validation(self):
        work = self.store.add_category("  Робота  ")
        self.assertEqual(work["name"], "Робота")
        self.assertIsNone(self.store.add_category("робота"))      # дубль без урахування регістру
        self.assertIsNone(self.store.add_category("   "))
        self.assertTrue(self.store.rename_category(work["id"], "Робота 2"))
        self.assertTrue(self.store.rename_category(work["id"], "робота 2"))  # можна змінити регістр самій собі
        other = self.store.add_category("Дім")
        self.assertFalse(self.store.rename_category(other["id"], "РОБОТА 2"))
        self.assertNotEqual(work["color"], other["color"])

    def test_new_category_gets_unused_color(self):
        a, b, c = (self.store.add_category(n) for n in "ABC")
        self.store.delete_category(a["id"])
        d = self.store.add_category("D")
        self.assertNotIn(d["color"], (b["color"], c["color"]))

    def test_assign_and_filter_by_category(self):
        a = self.store.add_category("A")
        i1 = self.store.add("one")
        self.store.add("two")
        self.assertTrue(self.store.set_category(i1["id"], a["id"]))
        self.assertFalse(self.store.set_category(i1["id"], "nope"))
        self.assertEqual(self.texts(category=a["id"]), ["one"])
        self.assertEqual(self.texts(category=UNCAT), ["two"])
        self.assertEqual(sorted(self.texts(category=ALL)), ["one", "two"])
        self.assertEqual(self.store.count(a["id"]), 1)
        self.assertEqual(self.store.count(ALL), 2)

    def test_add_directly_into_category_and_bump_keeps_order(self):
        a = self.store.add_category("A")
        first = self.store.add("first", category=a["id"])
        self.store.add("second", category=a["id"])
        self.assertEqual(self.texts(category=a["id"]), ["second", "first"])
        self.store.bump(first["id"])  # клік по шаблону не міняє порядок у категорії
        self.assertEqual(self.texts(category=a["id"]), ["second", "first"])

    def test_delete_category_keeps_items(self):
        a = self.store.add_category("A")
        self.store.add("x", category=a["id"])
        self.store.delete_category(a["id"])
        self.assertEqual(self.store.categories, [])
        self.assertEqual(self.texts(category=UNCAT), ["x"])

    def test_clear_history_keeps_categorized(self):
        a = self.store.add_category("A")
        self.store.add("keep", category=a["id"])
        self.store.add("drop")
        self.store.clear_history()
        self.assertEqual(self.texts(), ["keep"])

    def test_update_changes_category(self):
        a = self.store.add_category("A")
        item = self.store.add("t")
        self.store.update(item["id"], "t2", a["id"])
        self.assertEqual(self.store.find(item["id"])["category"], a["id"])
        self.store.update(item["id"], "t3")  # без аргументу категорія не змінюється
        self.assertEqual(self.store.find(item["id"])["category"], a["id"])
        self.store.update(item["id"], "t3", None)
        self.assertIsNone(self.store.find(item["id"])["category"])

    def test_categories_persist_and_old_file_migrates(self):
        a = self.store.add_category("A")
        self.store.add("x", category=a["id"])
        again = Store(self.path)
        self.assertEqual(again.categories[0]["name"], "A")
        self.assertEqual(again.items[0]["category"], a["id"])
        # старий формат (v1): без категорій
        with open(self.path, "w", encoding="utf-8") as f:
            f.write('{"version":1,"items":[{"id":"1","text":"old","pinned":true,"ts":1}]}')
        old = Store(self.path)
        self.assertEqual(old.categories, [])
        self.assertIsNone(old.items[0]["category"])
        self.assertTrue(old.items[0]["pinned"])

    def test_unknown_category_reference_is_dropped(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            f.write('{"version":2,"categories":[],"items":[{"id":"1","text":"x","category":"ghost"}]}')
        self.assertIsNone(Store(self.path).items[0]["category"])


class SettingsTests(unittest.TestCase):
    def test_defaults_roundtrip_and_bad_types(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "settings.json")
            s = Settings(path)
            self.assertEqual(s["hotkey"], "ctrl+x")
            s["hotkey"] = "ctrl+alt+v"
            self.assertEqual(Settings(path)["hotkey"], "ctrl+alt+v")
            with open(path, "w") as f:
                f.write('{"hotkey": 5, "autohide": false}')
            t = Settings(path)
            self.assertEqual(t["hotkey"], "ctrl+x")   # неправильний тип ігнорується
            self.assertFalse(t["autohide"])


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


class SingleInstanceTests(unittest.TestCase):
    def test_second_instance_signals_first(self):
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        shown = []
        first = acquire_single_instance(lambda: shown.append(1), port=port)
        self.assertIsNotNone(first)
        self.assertIsNone(acquire_single_instance(lambda: None, port=port))  # друга копія має закритись
        for _ in range(50):
            if shown:
                break
            import time; time.sleep(0.02)
        self.assertEqual(shown, [1])
        first.close()


if __name__ == "__main__":
    unittest.main()
