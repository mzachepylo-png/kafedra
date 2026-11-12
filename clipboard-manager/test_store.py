import json
import os
import socket
import tempfile
import threading
import time
import unittest

from store import (History, Preset, PresetError, Settings, default_preset_path, history_path,
                   migrate_legacy, open_startup_preset)
from formats import (append_result, apply_format, format_actions, format_cards_added, format_link_user,
                     join_values)
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
        self.pr.formats.append({"id": "f2", "name": "future", "type": "from-newer-version", "color": "#112233"})
        self.pr.save()
        again = Preset.open(self.path)
        self.assertEqual(again.categories[0]["name"], "Шаблони 🌍")
        self.assertEqual(again.categories[0]["snippets"][0]["text"], "Привіт, світе 🌍")
        self.assertEqual([f["name"] for f in again.formats], ["USER", "USER 2", "Added cards", "Suspicious cards", "future"])   # невідомий формат не губиться
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


class ColorAndRenameTests(TmpCase):
    def setUp(self):
        super().setUp()
        self.pr = Preset.open_or_create(self.p("work.preset.json"))
        self.cat = self.pr.add_category("A")
        self.s1 = self.pr.add_snippet(self.cat["id"], "one")
        self.s2 = self.pr.add_snippet(self.cat["id"], "two")

    def test_category_color_applies_to_all_its_snippets(self):
        self.assertTrue(self.pr.set_category_color(self.cat["id"], "#AA0000"))
        colors = {s["text"]: s["color"] for s in self.pr.snippets(self.cat["id"])}
        self.assertEqual(colors, {"one": "#aa0000", "two": "#aa0000"})
        new = self.pr.add_snippet(self.cat["id"], "three")           # нові записи підхоплюють колір папки
        self.assertEqual(self.pr.snippets(self.cat["id"])[-1]["color"], "#aa0000")
        self.assertIsNone(self.pr.snippets(self.cat["id"])[-1]["own_color"])

    def test_snippet_color_overrides_and_survives_folder_color_change(self):
        self.pr.set_snippet_color(self.s1["id"], "#00AA00")
        self.pr.set_category_color(self.cat["id"], "#0000ff")
        by = {s["text"]: s for s in self.pr.snippets(self.cat["id"])}
        self.assertEqual((by["one"]["color"], by["one"]["own_color"]), ("#00aa00", "#00aa00"))
        self.assertEqual((by["two"]["color"], by["two"]["own_color"]), ("#0000ff", None))
        again = Preset.open(self.pr.path)                              # збереглось у файлі
        self.assertEqual(again.snippets(self.cat["id"])[0]["own_color"], "#00aa00")
        self.pr.set_snippet_color(self.s1["id"], None)                 # скидання → знову колір папки
        self.assertEqual(self.pr.snippets(self.cat["id"])[0]["color"], "#0000ff")

    def test_invalid_colors_rejected(self):
        for bad in ("red", "#12345", "#gggggg", "", None, 5):
            self.assertFalse(self.pr.set_category_color(self.cat["id"], bad), bad)
            self.assertFalse(self.pr.set_format_color("builtin-user", bad), bad)
        self.assertFalse(self.pr.set_snippet_color(self.s1["id"], "nope"))
        self.assertFalse(self.pr.set_snippet_color("missing", "#112233"))

    def test_builtin_user_format_exists_and_color_persists(self):
        self.assertEqual([(f["name"], f["type"]) for f in self.pr.formats],
                         [("USER", "link_user"), ("USER 2", "link_user_text"),
                          ("Added cards", "cards_added"), ("Suspicious cards", "suspicious_cards")])
        self.assertTrue(self.pr.set_format_color("builtin-user", "#ff8800"))
        self.assertEqual(Preset.open(self.pr.path).format("builtin-user")["color"], "#ff8800")

    def test_old_preset_without_formats_gets_user_format(self):
        with open(self.p("old.preset.json"), "w", encoding="utf-8") as f:
            f.write('{"format": "clipboard-memory-preset", "version": 1, "categories": []}')
        self.assertEqual(Preset.open(self.p("old.preset.json")).format("builtin-user")["name"], "USER")

    def test_import_keeps_snippet_colors(self):
        other = Preset.open_or_create(self.p("o.preset.json"))
        oc = other.add_category("Нова")
        sn = other.add_snippet(oc["id"], "x")
        other.set_snippet_color(sn["id"], "#123456")
        self.pr.import_from(other.path)
        mine = next(c for c in self.pr.categories if c["name"] == "Нова")
        self.assertEqual(mine["snippets"][0]["color"], "#123456")

    def test_rename_preset_renames_file_too(self):
        old = self.pr.path
        self.assertEqual(self.pr.rename("  Робочі   копіпасти "), "Робочі копіпасти")
        self.assertEqual(self.pr.name, "Робочі копіпасти")
        self.assertEqual(os.path.basename(self.pr.path), "Робочі копіпасти.preset.json")
        self.assertFalse(os.path.exists(old))
        again = Preset.open(self.pr.path)
        self.assertEqual((again.name, len(again.snippets())), ("Робочі копіпасти", 2))
        self.assertFalse(self.pr.changed_on_disk())                    # власне перейменування не «зовнішня зміна»

    def test_rename_name_only_keeps_file(self):
        old = self.pr.path
        self.pr.rename("Інша назва", rename_file=False)
        self.assertEqual(self.pr.path, old)
        self.assertEqual(Preset.open(old).name, "Інша назва")

    def test_rename_rejects_bad_names_and_collisions(self):
        for bad in ("", "   ", '<>:"/\\|?*'):
            with self.assertRaises(PresetError):
                self.pr.rename(bad)
        Preset.open_or_create(self.p("busy.preset.json"))
        with self.assertRaises(PresetError):
            self.pr.rename("busy")
        self.assertEqual(self.pr.name, "work")                          # не змінилось
        self.assertEqual(os.path.basename(self.pr.path), "work.preset.json")

    def test_rename_strips_forbidden_filename_characters(self):
        self.pr.rename('A/B:C*D?')
        self.assertEqual(os.path.basename(self.pr.path), "ABCD.preset.json")
        self.assertEqual(self.pr.name, "A/B:C*D?")      # назва для показу лишається як ввів користувач


class OrderAndScopeTests(TmpCase):
    def setUp(self):
        super().setUp()
        self.pr = Preset.open_or_create(self.p("o.preset.json"))
        self.a, self.b, self.c = (self.pr.add_category(n) for n in ("A", "B", "C"))

    def names(self):
        return [c["name"] for c in self.pr.categories]

    def test_move_category_to_index(self):
        self.assertTrue(self.pr.move_category_to(self.c["id"], 0))
        self.assertEqual(self.names(), ["C", "A", "B"])
        self.assertTrue(self.pr.move_category_to(self.c["id"], 99))        # поза межами → в кінець
        self.assertEqual(self.names(), ["A", "B", "C"])
        self.assertFalse(self.pr.move_category_to(self.c["id"], 2))        # вже там
        self.assertFalse(self.pr.move_category_to("nope", 0))
        self.assertEqual([c["name"] for c in Preset.open(self.pr.path).categories], ["A", "B", "C"])

    def test_move_snippet_to_index_within_category(self):
        s = [self.pr.add_snippet(self.a["id"], t) for t in ("one", "two", "three")]
        self.assertTrue(self.pr.move_snippet_to(s[2]["id"], 0))
        self.assertEqual([x["text"] for x in self.pr.snippets(self.a["id"])], ["three", "one", "two"])
        self.assertTrue(self.pr.move_snippet_to(s[2]["id"], 1))
        self.assertEqual([x["text"] for x in self.pr.snippets(self.a["id"])], ["one", "three", "two"])
        self.assertFalse(self.pr.move_snippet_to("nope", 0))

    def test_move_formats(self):
        ids = [f["id"] for f in self.pr.formats]
        base = ["builtin-user", "builtin-user2", "builtin-added-cards", "builtin-suspicious-cards"]
        self.assertEqual(ids, base)
        self.assertTrue(self.pr.move_format("builtin-user2", -1))
        self.assertEqual([f["id"] for f in self.pr.formats],
                         ["builtin-user2", "builtin-user", "builtin-added-cards", "builtin-suspicious-cards"])
        self.assertTrue(self.pr.move_format_to("builtin-user2", 1))
        self.assertEqual([f["id"] for f in self.pr.formats], base)
        self.assertFalse(self.pr.move_format("builtin-user", -1))          # вже перший
        self.assertEqual([f["id"] for f in Preset.open(self.pr.path).formats], base)

    def test_formats_visibility_per_folder(self):
        sl = self.pr.add_category("  suspicious LOGIN ")                    # назва без урахування регістру
        in_login = [f["name"] for f in self.pr.formats_for(sl["id"])]
        self.assertEqual(in_login, ["USER", "USER 2", "Added cards"])
        everywhere = ["USER", "USER 2"]
        self.assertEqual([f["name"] for f in self.pr.formats_for(self.a["id"])], everywhere)
        self.assertEqual([f["name"] for f in self.pr.formats_for(None)], everywhere)   # історія буфера
        sc = self.pr.add_category("Suspicious cards")
        self.assertEqual([f["name"] for f in self.pr.formats_for(sc["id"])], everywhere + ["Suspicious cards"])
        self.pr.rename_category(sl["id"], "Інша")
        self.assertEqual([f["name"] for f in self.pr.formats_for(sl["id"])], ["USER", "USER 2"])

    def test_old_preset_gets_added_cards_format(self):
        with open(self.p("old.preset.json"), "w", encoding="utf-8") as f:
            f.write('{"format": "clipboard-memory-preset", "version": 1, "categories": [], '
                    '"formats": [{"id": "builtin-user", "name": "USER", "type": "link_user", "color": "#ff0000"}]}')
        pr = Preset.open(self.p("old.preset.json"))
        self.assertEqual([f["name"] for f in pr.formats], ["USER", "USER 2", "Added cards", "Suspicious cards"])
        self.assertEqual(pr.format("builtin-user")["color"], "#ff0000")    # власний колір не затирається


class FormatTests(unittest.TestCase):
    def test_cards_added_examples_from_the_spec(self):
        f = format_cards_added
        self.assertEqual(f("1245, 1245, 3121, 2433"),
                         "Cards 1245, 1245, 3121, 2433 were added during suspicious login.")
        self.assertEqual(f("1245 1231 236532, 3256"),
                         "Cards 1245, 1231, 236532, 3256 were added during suspicious login.")
        self.assertEqual(f("23465"), "Card 23465 was added during suspicious login.")
        self.assertEqual(f("1234"), "Card 1234 was added during suspicious login.")
        self.assertEqual(f("  7 \n"), "Card 7 was added during suspicious login.")
        self.assertEqual(f(""), "")
        self.assertEqual(f("без чисел"), "")

    def test_append_result_does_not_mutate_and_joins_with_space(self):
        base = "Suspicious login confirmed. Unsolicited charges were refunded."
        res = format_cards_added("1234")
        self.assertEqual(append_result(base, res), base + " Card 1234 was added during suspicious login.")
        self.assertEqual(append_result(base + "  \n", res), base + " " + res)    # хвостові пробіли не дублюються
        self.assertEqual(append_result("", res), res)

    def test_join_values_and_actions(self):
        self.assertEqual(join_values(["1242", "1234", "5466", "2345"]), "1242, 1234, 5466, 2345")
        self.assertEqual(join_values([" a ", "", "  ", "b"]), "a, b")
        self.assertEqual(join_values([]), "")
        self.assertEqual(format_actions("cards_added"), ("copy", "append"))
        self.assertEqual(format_actions("link_user"), ("copy",))
        self.assertEqual(format_actions("unknown"), ("copy",))
        self.assertEqual(apply_format("cards_added", "9"), "Card 9 was added during suspicious login.")


    def test_user_format_examples_from_the_spec(self):
        f = format_link_user
        self.assertEqual(f("12334512"), "{LINK:USER:12334512:E}")
        self.assertEqual(f("123123 325413 1232154"),
                         "{LINK:USER:123123:E}, {LINK:USER:325413:E}, {LINK:USER:1232154:E}")
        self.assertEqual(f("1242145, 125412412 51325"),
                         "{LINK:USER:1242145:E}, {LINK:USER:125412412:E}, {LINK:USER:51325:E}")
        self.assertEqual(f("53125, 1254125, 12634634, 26243423"),
                         "{LINK:USER:53125:E}, {LINK:USER:1254125:E}, {LINK:USER:12634634:E}, {LINK:USER:26243423:E}")
        self.assertEqual(f("User#12312421"), "{LINK:USER:12312421:E}")
        self.assertEqual(f("User#12312421, User#23414132, User#1254124365"),
                         "{LINK:USER:12312421:E}, {LINK:USER:23414132:E}, {LINK:USER:1254124365:E}")
        self.assertEqual(f("User#7876976 User#67976, User#67987690"),
                         "{LINK:USER:7876976:E}, {LINK:USER:67976:E}, {LINK:USER:67987690:E}")
        self.assertEqual(f("123, User#45312  23512"),
                         "{LINK:USER:123:E}, {LINK:USER:45312:E}, {LINK:USER:23512:E}")

    def test_user_format_robustness(self):
        f = format_link_user
        self.assertEqual(f("  1\n2\r\n\t3 ,, 4;5  "), ", ".join("{LINK:USER:%d:E}" % n for n in range(1, 6)))
        self.assertEqual(f("user#007"), "{LINK:USER:007:E}")            # ведучі нулі зберігаються
        self.assertEqual(f(""), "")
        self.assertEqual(f("немає чисел, User#"), "")
        self.assertEqual(f(None), "")

    def test_apply_format_dispatch(self):
        self.assertEqual(apply_format("link_user", "5"), "{LINK:USER:5:E}")
        self.assertEqual(apply_format("unknown", "5"), "")


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


class SettingsPathTests(TmpCase):
    def test_replace_preset_path_updates_current_and_recent(self):
        s = Settings(self.p("s.json"))
        s.remember_preset("/a/old.preset.json")
        s.remember_preset("/b/other.preset.json")
        s.remember_preset("/a/old.preset.json")
        s.replace_preset_path("/a/old.preset.json", "/a/new.preset.json")
        self.assertEqual(s["preset_path"], "/a/new.preset.json")
        self.assertEqual(s["recent_presets"], ["/a/new.preset.json", "/b/other.preset.json"])
        s.replace_preset_path("/b/other.preset.json", "/b/renamed.preset.json")   # поточний не чіпається
        self.assertEqual(s["preset_path"], "/a/new.preset.json")


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


class Round7Tests(unittest.TestCase):
    def test_user2(self):
        from formats import apply_format, format_actions
        self.assertEqual(apply_format("link_user_text", "Привіт User #13513!"), "Привіт {LINK:USER:13513:E}!")
        self.assertEqual(apply_format("link_user_text", "User#1, user # 2 і User #3"),
                         "{LINK:USER:1:E}, {LINK:USER:2:E} і {LINK:USER:3:E}")
        self.assertEqual(apply_format("link_user_text", "Users 5 без решітки"), "Users {LINK:USER:5:E} без решітки")
        self.assertEqual(apply_format("link_user_text", "214, 215"), "{LINK:USER:214:E}, {LINK:USER:215:E}")
        self.assertEqual(apply_format("link_user_text", "вже {LINK:USER:9:E} і abc123"), "вже {LINK:USER:9:E} і abc123")
        self.assertEqual(apply_format("link_user_text", "   "), "")
        self.assertEqual(format_actions("link_user_text"), ("copy",))

    def test_history_keeps_last_15(self):
        import tempfile, os
        from store import MAX_HISTORY
        self.assertEqual(MAX_HISTORY, 15)
        path = os.path.join(tempfile.mkdtemp(), "h.json")
        h = History(path)
        for i in range(40):
            h.add(f"запис {i}")
        self.assertEqual(len(h.items), 15)
        self.assertEqual(h.items[0]["text"], "запис 39")
        self.assertEqual(h.items[-1]["text"], "запис 25")
        h2 = History(path, max_items=100)
        for i in range(40):
            h2.add(f"інший {i}")
        self.assertEqual(len(History(path, max_items=100).items), 55)
        self.assertEqual(len(History(path).items), 15, "стара довга історія обрізається при завантаженні")

    def test_edit_phrase(self):
        import tempfile, os
        pr = Preset(os.path.join(tempfile.mkdtemp(), "p.preset.json"))
        self.assertTrue(pr.edit_phrase("ph-noactive", "No active subscriptions found."))
        self.assertFalse(pr.edit_phrase("ph-noactive", "   "))
        self.assertFalse(pr.edit_phrase("ph-noactive", "Ignore billing check flag was set."))   # збіг з іншою
        self.assertFalse(pr.edit_phrase("nope", "x"))
        self.assertEqual(Preset.open(pr.path).phrases[-1]["text"], "No active subscriptions found.")


class MergeAndV2Tests(unittest.TestCase):
    def test_merge_actions(self):
        from formats import MERGE_ACTIONS, apply_merge
        vals = ["1242", "1234", "5466"]
        self.assertEqual([a[0] for a in MERGE_ACTIONS], ["suspicious", "test", "plain"])
        self.assertEqual(apply_merge("suspicious", vals), "Suspicious cards 1242, 1234, 5466 were added.")
        self.assertEqual(apply_merge("test", vals), "Test cards 1242, 1234, 5466 were added")
        self.assertEqual(apply_merge("plain", vals), "1242, 1234, 5466")
        self.assertEqual(apply_merge("suspicious", ["a, b ", " c"]), "Suspicious cards a, b, c were added.")
        self.assertEqual(apply_merge("test", []), "")
        self.assertEqual(apply_merge("невідомий", ["1", "2"]), "1, 2")

    def test_old_test_cards_format_is_dropped_on_load(self):
        import json, tempfile, os
        path = os.path.join(tempfile.mkdtemp(), "old.preset.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"format": "clipboard-memory-preset", "version": 1, "categories": [],
                       "formats": [{"id": "builtin-test-cards", "name": "Test cards", "type": "test_cards", "color": "#d83b01"}]}, f)
        self.assertNotIn("builtin-test-cards", [f["id"] for f in Preset.open(path).formats])

    def test_clean_v2(self):
        from formats import clean_v2
        self.assertIsNone(clean_v2(None))
        self.assertIsNone(clean_v2({"options": []}))
        self.assertIsNone(clean_v2({"options": [{"text": "  "}]}))
        v2 = clean_v2({"options": [
            {"text": "оранж", "kind": "group", "join": False, "children": [{"text": "рожевий", "kind": "group"},
                                                                          {"text": "синій"}, {"text": ""}]},
            {"text": "червоний", "kind": "addon", "on": True},
            {"text": "зелений", "kind": "що-завгодно"}]})
        o, r, g = v2["options"]
        self.assertEqual((o["kind"], o["join"], len(o["children"])), ("group", False, 2))
        self.assertEqual(o["children"][0]["join"], True)               # за замовчуванням підгрупа додається
        self.assertEqual(o["children"][0]["children"], [])
        self.assertEqual((r["kind"], r["on"]), ("addon", True))
        self.assertEqual(g["kind"], "end")

    def test_v2_compose(self):
        from formats import v2_compose
        self.assertEqual(v2_compose("Основний", ["оранж", "рожевий"], ["червоний"]), "Основний оранж рожевий червоний")
        self.assertEqual(v2_compose("Основний", [], []), "Основний")
        self.assertEqual(v2_compose(" Основний ", ["", "x"], [" "]), "Основний x")

    def test_v2_snippet_persist_and_edit(self):
        import tempfile, os
        pr = Preset(os.path.join(tempfile.mkdtemp(), "p.preset.json"))
        cat = pr.add_category("К")
        v2 = {"options": [{"text": "аппенд 1", "kind": "group", "children": [{"text": "вкладений"}]},
                          {"text": "додатковий", "kind": "addon", "on": True}]}
        sn = pr.add_snippet(cat["id"], "Основний текст", v2)
        self.assertEqual(sn["v2"]["options"][0]["children"][0]["text"], "вкладений")
        again = Preset.open(pr.path)
        got = again.snippets(cat["id"])[0]
        self.assertEqual(got["v2"], sn["v2"])
        self.assertTrue(again.update_snippet(sn["id"], "Основний 2"))          # без v2="keep" аппенди лишаються
        self.assertIn("v2", again.snippets(cat["id"])[0])
        self.assertTrue(again.update_snippet(sn["id"], "Основний 2", v2=None))  # зробити звичайною
        self.assertNotIn("v2", Preset.open(pr.path).snippets(cat["id"])[0])
        self.assertTrue(again.update_snippet(sn["id"], "Основний 2", v2={"options": [{"text": "x"}]}))
        self.assertEqual(Preset.open(pr.path).snippets(cat["id"])[0]["v2"]["options"][0]["kind"], "end")


class HistoryAutofillAndUserLinkTests(unittest.TestCase):
    def test_numbers_from_history(self):
        from formats import numbers_from_history
        self.assertEqual(numbers_from_history(["123", "542", "1234, 2365 4562", "Жовтень у Голосієві", "777"]),
                         "123, 542, 1234, 2365, 4562")
        self.assertEqual(numbers_from_history(["12.5", "7"]), "", "крапка — не число, стоп одразу")
        self.assertEqual(numbers_from_history(["1-2", "7"]), "")
        self.assertEqual(numbers_from_history(["  88 ,  99 "]), "88, 99")
        self.assertEqual(numbers_from_history([]), "")

    def test_formats_with_history_values(self):
        from formats import apply_format, numbers_from_history
        vals = numbers_from_history(["123", "542", "1234, 2365 4562", "текст"])
        self.assertEqual(apply_format("cards_added", vals),
                         "Cards 123, 542, 1234, 2365, 4562 were added during suspicious login.")
        self.assertEqual(apply_format("suspicious_cards", vals), "Suspicious cards 123, 542, 1234, 2365, 4562 were added.")

    def test_suspicious_append_robust_prefix(self):
        from formats import append_suspicious_cards
        res = "Suspicious cards 1234, 2365, 4562 were added."
        self.assertEqual(append_suspicious_cards("Suspicious cards were added. Blacklisted, unsolicited charges refunded", res),
                         "Suspicious cards 1234, 2365, 4562 were added. Blacklisted, unsolicited charges refunded")
        self.assertEqual(append_suspicious_cards("suspicious  cards were added. Blacklisted, unsolicited charges refunded "
                                                 "for the last 3 months.", res),
                         "Suspicious cards 1234, 2365, 4562 were added. Blacklisted, unsolicited charges refunded "
                         "for the last 3 months.")

    def test_last_user_and_apply_link(self):
        from formats import apply_user_link, has_user_placeholder, last_user_id
        self.assertEqual(last_user_id(["текст", "{LINK:USER:1236:E}", "214"]), "1236")
        self.assertEqual(last_user_id(["214", "{LINK:USER:1236:E}"]), "214")
        self.assertEqual(last_user_id(["User #77"]), "77")
        self.assertIsNone(last_user_id(["12, 13", "текст"]))
        t1 = "User was blacklisted due to suspicious cards` usage in ___________"
        self.assertTrue(has_user_placeholder(t1))
        self.assertEqual(apply_user_link(t1, "214"), "User was blacklisted due to suspicious cards` usage in {LINK:USER:214:E}")
        self.assertEqual(apply_user_link("User was blacklisted and can't have account due to background check in _____", "5"),
                         "User was blacklisted and can't have account due to background check in {LINK:USER:5:E}")
        self.assertEqual(apply_user_link("Blacklisted due to TOS Violation, Third-party payments", "214"),
                         "Blacklisted due to TOS Violation, Third-party payments in {LINK:USER:214:E}")
        self.assertEqual(apply_user_link("x in ____", None), "x in ____")
        t2 = "Disputes on legit transactions in deleted duplicate account ___________. Clawback can't be set, card was blacklisted."
        self.assertTrue(has_user_placeholder(t2))
        self.assertEqual(apply_user_link(t2, "214"), "Disputes on legit transactions in deleted duplicate account "
                                                     "{LINK:USER:214:E}. Clawback can't be set, card was blacklisted.")
        self.assertEqual(apply_user_link("a ___ b ____", "1"), "a {LINK:USER:1:E} b ____", "1 користувач — 1 заглушка")

    def test_several_placeholders_take_users_in_turn(self):
        from formats import apply_user_link, fill_placeholders, user_ids_from_history
        hist = ["{LINK:USER:3:E}", "текст", "214", "3", "User #9", "12, 13", "{LINK:USER:5:E}"]
        self.assertEqual(user_ids_from_history(hist), ["3", "214", "9", "5"], "найновіший першим, без повторів")
        self.assertEqual(apply_user_link("A ___ and B ___.", user_ids_from_history(hist)),
                         "A {LINK:USER:3:E} and B {LINK:USER:214:E}.")
        ids = [str(n) for n in range(1, 11)]
        txt = " ".join(["___"] * 10)
        out = apply_user_link(txt, ids)
        self.assertEqual(out.split(" ")[:8], ["{LINK:USER:%d:E}" % n for n in range(1, 9)])
        self.assertEqual(out.split(" ")[8:], ["___", "___"], "не більше 8 користувачів")
        self.assertEqual(fill_placeholders("Users ___ and ___", ["7"]), "Users {LINK:USER:7:E} and ___")

    def test_email_from_history(self):
        from formats import fill_placeholders, has_user_placeholder, last_email
        hist = ["123", "Contact: John.Doe+x@mail.example.com please", "old@x.org"]
        self.assertEqual(last_email(hist), "John.Doe+x@mail.example.com")
        self.assertIsNone(last_email(["no mail", "a@b"]))
        self.assertEqual(fill_placeholders("Email _____ was connected during suspicious login", hist),
                         "Email John.Doe+x@mail.example.com was connected during suspicious login")
        self.assertEqual(fill_placeholders("Email _____ was connected during suspicious login", ["no"]),
                         "Email _____ was connected during suspicious login", "без email — заглушка лишається")
        self.assertFalse(has_user_placeholder("snake__case"))

    def test_tos_migration_and_user_link_flag(self):
        import json, tempfile, os
        path = os.path.join(tempfile.mkdtemp(), "t.preset.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"format": "clipboard-memory-preset", "version": 1, "categories": [
                {"id": "c1", "name": "TOS Violation", "color": "#d83b01", "snippets": [
                    {"id": "a", "text": "Blacklisted due to TOS Violation, ", "ts": 1},
                    {"id": "b", "text": "Delayed deactivation process was started with blacklisted mark due to TOS Violation,", "ts": 1},
                    {"id": "c", "text": "Інше", "ts": 1}]}],
                "formats": [{"id": "builtin-user2", "name": "User2", "type": "link_user_text", "color": "#038387"}]}, f)
        pr = Preset.open(path)
        a, b, c = pr.snippets("c1")
        self.assertEqual(a["v2"]["options"][0]["text"], "Third-party payments")
        self.assertTrue(a["user_link"] and b["user_link"] and "v2" in b)
        self.assertNotIn("v2", c)
        self.assertEqual(pr.format("builtin-user2")["name"], "USER 2")
        pr.update_snippet("a", a["text"], "c1", None)                      # прибрали аппенди — міграція не повертає їх
        self.assertNotIn("v2", Preset.open(path).snippets("c1")[0])
        self.assertTrue(pr.set_snippet_user_link("c", True))
        self.assertTrue(Preset.open(path).snippets("c1")[2]["user_link"])


class SuspiciousAndRefundTests(unittest.TestCase):
    def test_suspicious_cards_format(self):
        from formats import apply_format, format_actions
        self.assertEqual(apply_format("suspicious_cards", "1245, 1254 2365"), "Suspicious cards 1245, 1254, 2365 were added.")
        self.assertEqual(apply_format("suspicious_cards", "1246, 13254, 123, 124 13531 12423"),
                         "Suspicious cards 1246, 13254, 123, 124, 13531, 12423 were added.")
        self.assertEqual(apply_format("suspicious_cards", "нічого"), "")
        self.assertEqual(format_actions("suspicious_cards"), ("copy", "append"))

    def test_suspicious_cards_append_replaces_prefix(self):
        from formats import append_suspicious_cards
        res = "Suspicious cards 1245, 1254, 2365 were added."
        self.assertEqual(append_suspicious_cards("Suspicious cards were added. Blacklisted, unsolicited charges refunded", res),
                         "Suspicious cards 1245, 1254, 2365 were added. Blacklisted, unsolicited charges refunded")
        self.assertEqual(append_suspicious_cards("Suspicious cards were added. Blacklisted, no unsolicited charges to refund", res),
                         "Suspicious cards 1245, 1254, 2365 were added. Blacklisted, no unsolicited charges to refund")
        self.assertEqual(append_suspicious_cards("Інший текст", res), "Інший текст " + res)

    def test_phrases_compose(self):
        from formats import compose_phrases
        from store import DEFAULT_PHRASES
        act, internal, ignore, noact = DEFAULT_PHRASES
        self.assertEqual(compose_phrases([]), "")
        self.assertEqual(compose_phrases([act]), "Active subscriptions were refunded.")
        self.assertEqual(compose_phrases([internal]), "Internal charges were refunded.")
        self.assertEqual(compose_phrases([act, internal]), "Active subscriptions and Internal charges were refunded.")
        self.assertEqual(compose_phrases([ignore]), "Ignore billing check flag was set.")
        self.assertEqual(compose_phrases([noact]), "No active subscriptions.")
        self.assertEqual(compose_phrases([internal, noact]), "No active subscriptions.")
        self.assertEqual(compose_phrases([{"id": "x", "text": "  своя фраза:  "}]), "своя фраза:")

    def test_phrases_add_remove_persist(self):
        import tempfile, os
        pr = Preset(os.path.join(tempfile.mkdtemp(), "p.preset.json"))
        self.assertEqual([p["id"] for p in pr.phrases], ["ph-active", "ph-internal", "ph-ignore", "ph-noactive"])
        ph = pr.add_phrase("  User blacklisted due to repeated TOS Violations, multiple chargebacks in accounts:  ")
        self.assertEqual(ph["text"], "User blacklisted due to repeated TOS Violations, multiple chargebacks in accounts:")
        self.assertIsNone(pr.add_phrase(ph["text"]))        # дублікат
        self.assertIsNone(pr.add_phrase("   "))
        self.assertTrue(pr.remove_phrase("ph-ignore"))
        self.assertFalse(pr.remove_phrase("nope"))
        again = Preset.open(pr.path)
        self.assertEqual([p["id"] for p in again.phrases], ["ph-active", "ph-internal", "ph-noactive", ph["id"]])
        for p in list(again.phrases):                        # можна видалити всі; порожній список не відновлюється
            again.remove_phrase(p["id"])
        self.assertEqual(Preset.open(pr.path).phrases, [])

    def test_new_settings_defaults(self):
        import tempfile, os
        st = Settings(os.path.join(tempfile.mkdtemp(), "s.json"))
        self.assertEqual((st["cat_view"], st["rec_view"], st["left_w"], st["clear_on_exit"], st["phrases_collapsed"]),
                         ("list", "list", 0, True, False))


if __name__ == "__main__":
    unittest.main()
