import json
import os
import tempfile
import unittest

from clipboard_manager import Store, preview


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, "sub", "history.json")
        self.store = Store(self.path)

    def tearDown(self):
        self.dir.cleanup()

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

    def test_trim_keeps_pinned(self):
        s = Store(self.path, max_history=3)
        s.add("keep", pinned=True)
        for n in range(10):
            s.add(f"t{n}")
        texts = [i["text"] for i in s.items]
        self.assertIn("keep", texts)
        self.assertEqual(len([i for i in s.items if not i["pinned"]]), 3)

    def test_view_pinned_first_and_search(self):
        self.store.add("apple")
        self.store.add("Banana", pinned=True)
        self.store.add("cherry")
        self.assertEqual([i["text"] for i in self.store.view()], ["Banana", "cherry", "apple"])
        self.assertEqual([i["text"] for i in self.store.view("BAN")], ["Banana"])

    def test_update_pin_remove_clear(self):
        item = self.store.add("old")
        self.assertTrue(self.store.update(item["id"], "new"))
        self.assertFalse(self.store.update(item["id"], "  "))
        self.store.toggle_pin(item["id"])
        other = self.store.add("tmp")
        self.store.clear_unpinned()
        self.assertEqual([i["text"] for i in self.store.items], ["new"])
        self.store.remove(item["id"])
        self.assertEqual(self.store.items, [])
        self.assertIsNone(self.store.find(other["id"]))

    def test_corrupt_file_is_backed_up(self):
        os.makedirs(os.path.dirname(self.path))
        with open(self.path, "w") as f:
            f.write("{not json")
        s = Store(self.path)
        self.assertEqual(s.items, [])
        self.assertTrue(os.path.exists(self.path + ".bak"))

    def test_unicode_roundtrip(self):
        self.store.add("Привіт, світе 🌍")
        with open(self.path, encoding="utf-8") as f:
            self.assertIn("Привіт", f.read())
        self.assertEqual(Store(self.path).items[0]["text"], "Привіт, світе 🌍")


class PreviewTests(unittest.TestCase):
    def test_truncates(self):
        self.assertEqual(preview("a\nb"), "a\nb")
        self.assertTrue(preview("\n".join("x" * 5 for _ in range(10))).endswith("…"))
        self.assertTrue(preview("y" * 1000).endswith("…"))


if __name__ == "__main__":
    unittest.main()
