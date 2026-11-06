"""Headless-смоук інтерфейсу (потрібен дисплей і customtkinter).

    xvfb-run -a -s "-screen 0 1300x800x24" python smoke_ui.py

Керує справжнім App з тимчасовою текою даних, підміняючи модальні діалоги, і перевіряє
категорії, історію, перетягування, меню, клавіатуру, пресети, перезавантаження пресета
з диска, теми, гарячу клавішу (події в черзі), паузу та запуск через main().
Наприкінці (якщо задано SMOKE_SHOTS=<тека>) робить скріншоти світлої/темної теми.
Не підхоплюється unittest discovery (ім'я не починається з test).
"""
import os
import queue
import socket
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import customtkinter as ctk  # noqa: E402
import tkinter as tk  # noqa: E402

import clipboard_manager as cm  # noqa: E402
from store import HISTORY, History, Preset, Settings, open_startup_preset  # noqa: E402

tmp = tempfile.mkdtemp()
data_dir = os.path.join(tmp, "data")
os.makedirs(data_dir)
settings = Settings(os.path.join(data_dir, "settings.json"))
preset, warn = open_startup_preset(settings, data_dir)
history = History(os.path.join(data_dir, "clipboard_history.json"))
events = queue.Queue()

root = ctk.CTk()
app = cm.App(root, preset, history, settings, events, use_hotkey=False, use_tray=False)
root.geometry("1000x620+0+0")
other = tk.Toplevel(root)                       # «інша програма», з якої копіюємо
other.geometry("40x40+1250+740")


def pump(ms=500):
    end = time.time() + ms / 1000
    while time.time() < end:
        root.update()
        time.sleep(0.02)


def ev(x, y):
    return SimpleNamespace(x_root=x, y_root=y, widget=root)


def copy_from_other(text, wait=550):
    other.clipboard_clear()
    other.clipboard_append(text)
    other.update()
    pump(wait)


def labels(menu):
    out = []
    for i in range((menu.index("end") or -1) + 1):
        t = menu.type(i)
        if t in ("command", "cascade", "checkbutton", "radiobutton"):
            out.append(menu.entrycget(i, "label").strip())
    return out


def submenu(menu, label):
    for i in range((menu.index("end") or -1) + 1):
        if menu.type(i) == "cascade" and menu.entrycget(i, "label") == label:
            return menu.nametowidget(menu.entrycget(i, "menu"))
    raise AssertionError(f"no cascade {label!r} in {labels(menu)}")


def invoke(menu, label):
    for i in range((menu.index("end") or -1) + 1):
        if menu.type(i) in ("command",) and menu.entrycget(i, "label").strip() == label:
            menu.invoke(i)
            return
    raise AssertionError(f"no command {label!r} in {labels(menu)}")


def click(item_id):
    app._drag_press(ev(1, 1), item_id)
    app._drag_release(ev(1, 1))


def drag(item_id, key):
    card = app._cards[item_id]
    root.update_idletasks()
    sx, sy = card.winfo_rootx() + 40, card.winfo_rooty() + 14
    row = app._rows[key]
    tx, ty = row.winfo_rootx() + 30, row.winfo_rooty() + row.winfo_height() // 2
    app._drag_press(ev(sx, sy), item_id)
    app._drag_motion(ev(sx + 3, sy + 3))
    assert app._drag["active"] is False, "малий зсув не повинен починати перетягування"
    app._drag_motion(ev(tx, ty))
    pump(60)
    assert app._drag["active"] and app._drag["hover"] == key, (app._drag, key)
    app._drag_release(ev(tx, ty))
    pump(60)


# патчимо модальні речі
answers = []
cm.TextDialog.run = lambda self: answers.pop(0)
boxes = {"info": [], "error": [], "ask": [], "warn": []}
cm.messagebox.showinfo = lambda *a, **k: boxes["info"].append(a)
cm.messagebox.showerror = lambda *a, **k: boxes["error"].append(a)
cm.messagebox.showwarning = lambda *a, **k: boxes["warn"].append(a)
cm.messagebox.askyesno = lambda *a, **k: (boxes["ask"].append(a), True)[1]
popups = []
tk.Menu.tk_popup = lambda self, *a, **k: popups.append(self)
snip_plan = {}


def fake_snippet_run(self):
    snip_plan["default_cat"] = self.cat_var.get()
    snip_plan["initial_text"] = self.text.get("1.0", "end-1c")
    if "text" in snip_plan:
        self.text.delete("1.0", "end")
        self.text.insert("1.0", snip_plan.pop("text"))
    if "cat" in snip_plan:
        self.cat_var.set(snip_plan.pop("cat"))
    self.ok()
    return self.result


cm.SnippetDialog.run = fake_snippet_run

# ---- 1. старт: порожньо, історія — поточний розділ --------------------------------
assert app.view == HISTORY and app.shown == [] and preset.categories == []
assert "default" in root.title()
print("1 start OK")

# ---- 2. категорії -------------------------------------------------------------------
answers[:] = ["Робота", "Особисте", "робота", "   "]
app.on_new_category()
assert app.view == preset.categories[0]["id"]
app.on_new_category()
app.on_new_category()      # дубль (без урахування регістру)
app.on_new_category()      # порожня назва
assert [c["name"] for c in preset.categories] == ["Робота", "Особисте"], preset.categories
assert len(boxes["info"]) == 2
work, home = preset.categories
print("2 categories OK")

# ---- 3. додати запис через діалог: категорія за замовчуванням = відкрита -----------------
app.select_category(work["id"])
snip_plan["text"] = "Добрий день! Надсилаю звіт у вкладенні."
app.on_add()
assert snip_plan["default_cat"] == "Робота"
assert [s["text"] for s in preset.snippets(work["id"])] == ["Добрий день! Надсилаю звіт у вкладенні."]
assert app.view == work["id"] and len(app.shown) == 1 and len(app._cards) == 1
snip_plan["text"], snip_plan["cat"] = "Мій IBAN: UA00 0000 0000 0000", "Особисте"
app.on_add()
assert app.view == home["id"] and preset.count(home["id"]) == 1
print("3 add snippet OK")

# ---- 4. автозахоплення буфера в історію (власні копіювання ігноруються) -----------------
for t in ["https://example.com/some/long/link?x=1", "SELECT * FROM users WHERE id = 1;", "Пароль від Wi-Fi: hunter2"]:
    copy_from_other(t)
assert [i["text"][:6] for i in history.items] == ["Пароль", "SELECT", "https:"], history.items
app.select_category(HISTORY)
assert len(app.shown) == 3 and len(app._cards) == 3
print("4 clipboard capture OK")

# ---- 5. клік копіює; історія піднімає запис -----------------------------------------------
link = next(i for i in app.shown if i["text"].startswith("https"))
click(link["id"])
assert root.clipboard_get() == link["text"]
assert history.items[0]["text"] == link["text"]
n_hist = len(history.items)
pump(600)
assert len(history.items) == n_hist, "власне копіювання не повинно дублюватись в історії"
print("5 click-copy OK")

# ---- 6. перетягування: історія -> категорія (КОПІЮЄ) ----------------------------------------
sql = next(i for i in app.shown if i["text"].startswith("SELECT"))
drag(sql["id"], work["id"])
assert any(s["text"] == sql["text"] for s in preset.snippets(work["id"]))
assert history.find(sql["id"]), "запис в історії має лишитись"
assert "Збережено" in app.status.cget("text")
drag(sql["id"], work["id"])
assert "уже є" in app.status.cget("text") and preset.count(work["id"]) == 2
print("6 drag history->category (copy) OK")

# ---- 7. перетягування: запис пресета -> інша категорія (ПЕРЕМІЩУЄ) --------------------------------
app.select_category(work["id"])
pump(50)
mv = next(s for s in app.shown if s["text"].startswith("SELECT"))
drag(mv["id"], home["id"])
assert preset.count(work["id"]) == 1 and preset.count(home["id"]) == 2
assert preset.find_snippet(mv["id"])[0]["id"] == home["id"]
print("7 drag snippet->category (move) OK")

# ---- 8. пошук, клавіатура ---------------------------------------------------------------
app.select_category(home["id"])
app.set_search("select")
assert [i["text"][:6] for i in app.shown] == ["SELECT"]
app.set_search("немає такого")
assert app.shown == [] and "Нічого не знайдено" in str([w.cget("text") for w in app.cards.winfo_children()[0].winfo_children()])
app.set_search("")
assert len(app.shown) == 2
first = app.sel_id
assert first == app.shown[0]["id"]
app._move_sel(1)
assert app.sel_id == app.shown[1]["id"]
app._move_sel(1)
assert app.sel_id == app.shown[1]["id"], "не виходить за межі"
app._move_sel(-1)
assert app.sel_id == first
app.copy_item(app.sel_id)
assert root.clipboard_get() == app.shown[0]["text"]
app.set_search("sel")
app._on_escape(None)                 # Esc очищає пошук
assert app.search.get() == ""
sel = app.sel_id
app._on_delete_key(SimpleNamespace(widget=root))       # Delete видаляє виділений запис
assert preset.find_snippet(sel) is None and preset.count(home["id"]) == 1
app._on_delete_key(SimpleNamespace(widget=tk.Entry(root)))   # у полі вводу Delete не видаляє записи
assert preset.count(home["id"]) == 1
print("8 search & keyboard OK")

# ---- 9. контекстні меню ---------------------------------------------------------------------
app.select_category(work["id"])
snip_id = app.shown[0]["id"]
app.show_menu(10, 10, snip_id)
m = popups[-1]
assert labels(m) == ["Копіювати", "Редагувати…", "Перемістити в категорію", "Вгору", "Вниз", "Видалити"], labels(m)
sub = submenu(m, "Перемістити в категорію")
assert labels(sub) == ["✓ Робота".replace("✓ ", "✓ ").strip(), "Особисте", "＋ Нова категорія…"], labels(sub)
app.select_category(HISTORY)
app.show_menu(10, 10, app.shown[0]["id"])
m = popups[-1]
assert "Редагувати…" not in labels(m) and "Зберегти в категорію" in labels(m), labels(m)
# нова категорія з меню запису історії: створює й одразу зберігає запис туди
answers[:] = ["Код"]
hid = app.shown[0]["id"]
htxt = app.shown[0]["text"]
invoke(submenu(m, "Зберегти в категорію"), "＋ Нова категорія…")
code = preset.categories[-1]
assert code["name"] == "Код" and [s["text"] for s in code["snippets"]] == [htxt]
# вгору/вниз всередині категорії
app.select_category(work["id"])
snip_plan["text"] = "Другий запис"
app.on_add()
app.show_menu(1, 1, app.shown[1]["id"])
invoke(popups[-1], "Вгору")
assert preset.snippets(work["id"])[0]["text"] == "Другий запис"
# меню категорії
app.show_category_menu(5, 5, work["id"])
assert labels(popups[-1]) == ["Перейменувати…", "Перемістити вгору", "Перемістити вниз", "Видалити категорію…"]
answers[:] = ["Робота 2"]
invoke(popups[-1], "Перейменувати…")
assert preset.category(work["id"])["name"] == "Робота 2"
app.show_category_menu(5, 5, home["id"])
invoke(popups[-1], "Перемістити вгору")
assert [c["name"] for c in preset.categories][:2] == ["Особисте", "Робота 2"]
# редагування
snip_plan["text"], snip_plan["cat"] = "Відредагований текст", "Особисте"
app.on_edit(preset.snippets(work["id"])[0]["id"])
assert any(s["text"] == "Відредагований текст" for s in preset.snippets(home["id"]))
print("9 context menus OK")

# ---- 10. пресети: новий / відкрити / зберегти як / імпорт / останні ---------------------------------
main_path = preset.path
snap_work = [c["name"] for c in preset.categories]
fd = cm.filedialog
fd.asksaveasfilename = lambda **k: os.path.join(tmp, "Новий набір.json")
app.on_new_preset()
assert app.preset.path.endswith("Новий набір.preset.json") and os.path.exists(app.preset.path)
assert app.preset.categories == [] and app.view == HISTORY and "Новий набір" in root.title()
assert settings["preset_path"] == app.preset.path and app.preset.path in settings["recent_presets"]
fd.askopenfilename = lambda **k: main_path
app.on_open_preset()
assert app.preset.path == main_path and [c["name"] for c in app.preset.categories] == snap_work
assert app.view == app.preset.categories[0]["id"]
bad = os.path.join(tmp, "bad.json")
open(bad, "w").write("{не json")
fd.askopenfilename = lambda **k: bad
app.on_open_preset()
assert app.preset.path == main_path and len(boxes["error"]) == 1, "некоректний файл не повинен підміняти пресет"
copy_path = os.path.join(tmp, "copy.preset.json")
fd.asksaveasfilename = lambda **k: copy_path
app.on_save_preset_as()
assert app.preset.path == copy_path and os.path.exists(copy_path) and app.preset.name == "copy"
cid = app.preset.categories[0]["id"]
app.select_category(cid)
snip_plan["text"] = "Після «зберегти як» пишемо вже в копію"
app.on_add()
assert any("копію" in s["text"] for s in Preset.open(copy_path).snippets())
assert not any("копію" in s["text"] for s in Preset.open(main_path).snippets()), "оригінал не мав змінитись"
other_preset = Preset.open_or_create(os.path.join(tmp, "other.preset.json"))
oc = other_preset.add_category("Імпортована")
other_preset.add_snippet(oc["id"], "імпортований текст")
fd.askopenfilename = lambda **k: other_preset.path
app.on_import_preset()
assert "нових категорій — 1" in app.status.cget("text"), app.status.cget("text")
assert any(c["name"] == "Імпортована" for c in app.preset.categories)
fd.askopenfilename = lambda **k: bad
app.on_import_preset()
assert len(boxes["error"]) == 2
menu = app._build_preset_menu(app._new_menu())
assert labels(menu)[:5] == ["Новий пресет…", "Відкрити пресет…", "Зберегти як…",
                            "Імпортувати з файлу (додати до поточного)…", "Показати файл у теці"]
assert "Останні" in labels(menu)
assert main_path in [p for p in settings["recent_presets"]]
popped = []
real_popen = subprocess.Popen
subprocess.Popen = lambda *a, **k: popped.append(a)
app.on_reveal_preset()
subprocess.Popen = real_popen
assert popped, "reveal має викликати відкриття теки"
app.open_preset_path(main_path)       # повертаємось на головний пресет
assert app.preset.path == main_path
print("10 presets OK")

# ---- 11. зміна файлу ззовні підхоплюється -------------------------------------------------------------
ext = Preset.open(main_path)
time.sleep(0.05)
ext_cat = ext.add_category("Створено ззовні")
ext.add_snippet(ext_cat["id"], "дописано редактором")
pump(900)
assert any(c["name"] == "Створено ззовні" for c in app.preset.categories)
assert "оновлено з файлу" in app.status.cget("text")
print("11 external reload OK")

# ---- 12. теми, меню налаштувань ----------------------------------------------------------------------------
app._popup_settings()
sm = popups[-1]
assert labels(sm)[0] == "Пресет" and "Тема" in labels(sm) and "Гаряча клавіша" in labels(sm), labels(sm)
assert labels(submenu(sm, "Тема")) == ["Як у системі", "Світла", "Темна"]
hot_labels = labels(submenu(sm, "Гаряча клавіша"))
assert any("Ctrl+X" in l for l in hot_labels), hot_labels
for theme, mode in (("dark", "Dark"), ("light", "Light"), ("system", None)):
    app.v_theme.set(theme)
    app._on_theme()
    pump(150)
    assert settings["theme"] == theme
    if mode:
        assert ctk.get_appearance_mode() == mode
assert Settings(settings.path)["theme"] == "system"
app.v_theme.set("light")
app._on_theme()
print("12 themes/settings OK")

# ---- 13. гаряча клавіша: події toggle/show, autohide ------------------------------------------------------------
app.hide_window()
assert root.state() == "withdrawn"
events.put("toggle")
pump(900)
assert root.state() == "normal" and app._popup_mode is True
app.select_category(HISTORY)
copy_from_other("текст для автохову")
click(app.shown[0]["id"])
assert root.state() == "withdrawn", "після копіювання вікно має сховатись (автохов)"
events.put("show")
pump(900)
assert root.state() == "normal"
root.focus_displayof = lambda: root          # імітуємо вікно у фокусі
events.put("toggle")
pump(900)
assert root.state() == "withdrawn", "toggle у фокусі ховає вікно"
del root.focus_displayof
events.put("show")
pump(900)
app._modal = 1
app.hide_window()
events.put("toggle")
pump(900)
assert root.state() == "withdrawn", "поки відкрито діалог, гаряча клавіша ігнорується"
app._modal = 0
events.put("show")
pump(900)
assert root.state() == "normal"
print("13 hotkey events OK")

# ---- 14. видалення категорії з підтвердженням (кількість записів у тексті) ---------------------------------------------
victim = next(c for c in app.preset.categories if c["name"] == "Код")
app.select_category(victim["id"])
app.on_delete_category(victim["id"])
assert "1 запис" in boxes["ask"][-1][1] and "«Код»" in boxes["ask"][-1][1], boxes["ask"][-1]
assert app.preset.category(victim["id"]) is None and app.view == HISTORY
print("14 delete category OK")

# ---- 15. пауза ------------------------------------------------------------------------------------------------------------
app.v_paused.set(True)
app._on_pause()
copy_from_other("НЕ ЗАПИСУВАТИ", 650)
assert not any(i["text"] == "НЕ ЗАПИСУВАТИ" for i in history.items)
assert Settings(settings.path)["paused"] is True
app.v_paused.set(False)
app._on_pause()
print("15 pause OK")

# ---- 16. справжні (не підмінені) діалоги ----------------------------------------------------------------------------------
dlg = cm.TextDialog(app, "Тест", "Назва:", "початок")
root.after(400, lambda: (dlg.var.set("Привіт"), dlg.ok()))
assert cm._Dialog.run(dlg) == "Привіт" and app._modal == 0
dlg = cm.TextDialog(app, "Тест", "Назва:")
root.after(400, dlg.cancel)
assert cm._Dialog.run(dlg) is None
cats = app.preset.categories
dlg = cm.SnippetDialog(app, "Новий", "", cats[0]["id"])
root.after(400, lambda: (dlg.text.insert("1.0", "через справжній діалог"), dlg.cat_var.set(cats[1]["name"]), dlg.ok()))
assert cm._Dialog.run(dlg) == ("через справжній діалог", cats[1]["id"])
dlg = cm.SnippetDialog(app, "Порожній", "", cats[0]["id"])
root.after(400, lambda: (dlg.ok(), dlg.cancel()))             # порожній текст не приймається
assert cm._Dialog.run(dlg) is None
print("16 real dialogs OK")

# ---- 17. продуктивність і «Показати ще» ------------------------------------------------------------------------------------
for n in range(300):
    history.items.append({"id": f"h{n}", "text": f"Запис історії №{n}: Lorem ipsum dolor sit amet", "ts": time.time() - n})
app.select_category(HISTORY)
t0 = time.time()
app.render()
root.update()
dt = time.time() - t0
assert len(app._cards) == cm.PAGE and dt < 4, (len(app._cards), dt)
app._show_more()
assert len(app._cards) == 2 * cm.PAGE
app.sel_id = app.shown[2 * cm.PAGE - 1]["id"]
app._move_sel(1)          # стрілка вниз поза межею сторінки догружає картки
assert len(app._cards) > 2 * cm.PAGE
print(f"17 pagination OK (render {dt:.2f}s for 300 items)")

# ---- 18. запуск через main(): окремий процес -----------------------------------------------------------------------------------
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
env = dict(os.environ, CLIPBOARD_MEMORY_PORT=str(port))
mdir = os.path.join(tmp, "maindata")
corrupt = os.path.join(tmp, "corrupt.preset.json")
open(corrupt, "w").write("{broken")
args = [sys.executable, os.path.join(HERE, "clipboard_manager.py"), "--data-dir", mdir, "--preset", corrupt,
        "--no-hotkey", "--no-tray"]
proc = subprocess.Popen(args, env=env, stderr=subprocess.PIPE, stdout=subprocess.PIPE)
time.sleep(3.0)
assert proc.poll() is None, proc.stderr.read().decode()
assert os.path.exists(os.path.join(mdir, "default.preset.json")), os.listdir(mdir)   # повернувся на типовий
assert open(corrupt).read() == "{broken"
second = subprocess.run(args, env=env, capture_output=True, timeout=20)   # друга копія — одразу виходить
assert second.returncode == 0, second.stderr.decode()
assert proc.poll() is None
proc.terminate()
proc.wait(10)
err = proc.stderr.read().decode()
assert "Traceback" not in err, err
print("18 main()/single instance OK")

# ---- 18b. нова версія закриває стару й займає її місце ------------------------------------------------------------------------
with socket.socket() as s2:
    s2.bind(("127.0.0.1", 0))
    port2 = s2.getsockname()[1]
base_env = dict(os.environ, CLIPBOARD_MEMORY_PORT=str(port2))
cmd = [sys.executable, os.path.join(HERE, "clipboard_manager.py"), "--data-dir", os.path.join(tmp, "takeover"),
       "--no-hotkey", "--no-tray"]
old = subprocess.Popen(cmd, env=dict(base_env, CLIPBOARD_MEMORY_VERSION="2"), stderr=subprocess.PIPE, stdout=subprocess.PIPE)
time.sleep(3.0)
assert old.poll() is None, old.stderr.read().decode()
new = subprocess.Popen(cmd, env=dict(base_env, CLIPBOARD_MEMORY_VERSION="3"), stderr=subprocess.PIPE, stdout=subprocess.PIPE)
for _ in range(100):                     # стара копія має сама закритись
    if old.poll() is not None:
        break
    time.sleep(0.1)
assert old.poll() == 0, ("old instance did not exit", old.poll())
time.sleep(3.0)
assert new.poll() is None, new.stderr.read().decode()         # нова працює далі
# наступний запуск тієї самої версії лише показує вікно і виходить
again = subprocess.run(cmd, env=dict(base_env, CLIPBOARD_MEMORY_VERSION="3"), capture_output=True, timeout=20)
assert again.returncode == 0 and new.poll() is None
new.terminate()
new.wait(10)
assert "Traceback" not in old.stderr.read().decode() + new.stderr.read().decode()
print("18b new version replaces the old one OK")

# ---- 19. скріншоти -----------------------------------------------------------------------------------------------------------------
shots = os.environ.get("SMOKE_SHOTS")
if shots:
    os.makedirs(shots, exist_ok=True)
    sd = tempfile.mkdtemp()
    demo = Preset.open_or_create(os.path.join(sd, "Робочі шаблони.preset.json"))
    plan = {
        "Робота": ["Добрий день! Дякую за звернення. Відповім протягом робочого дня.",
                   "З повагою,\nМикита Зачепило\nтел. +380 50 123 45 67",
                   "Прошу надіслати рахунок-фактуру на оплату до кінця тижня."],
        "Листи клієнтам": ["Вітаю! Нагадую про зустріч завтра об 11:00 в офісі.",
                           "Дякуємо за замовлення №{номер}! Відправимо його протягом 2 днів."],
        "Реквізити": ["UA21 3223 1300 0002 6007 2335 6600 1", "ЄДРПОУ 12345678 · ІПН 123456789012"],
        "Код": ["SELECT id, name FROM users WHERE active = 1 ORDER BY created_at DESC;",
                "git checkout -b feature/clipboard && git push -u origin HEAD"],
        "Особисте": ["Адреса: м. Київ, вул. Хрещатик, 1, кв. 12"],
    }
    for name, texts in plan.items():
        c = demo.add_category(name)
        for t in texts:
            demo.add_snippet(c["id"], t)
    demo.formats = []
    hist2 = History(os.path.join(sd, "h.json"))
    for t in ["https://github.com/mzachepylo-png/kafedra/pull/2", "Рахунок №2024-117 на суму 12 480,00 грн",
              "Зустріч у четвер о 15:30, кімната переговорів «Дніпро»", "npm run build && npm test",
              "Лист-подяка за участь у конференції, надіслати до п'ятниці", "+380 67 555 01 23"]:
        hist2.add(t)
    app.history = hist2
    app.switch_preset(demo, "")
    app.set_status("✓ Скопійовано: Добрий день! Дякую за звернення…", 60000)
    root.geometry("1000x620+0+0")

    def grab(name):
        pump(500)
        subprocess.run([sys.executable if False else "/usr/local/bin/python3", "-c",
                        f"from PIL import ImageGrab; ImageGrab.grab().crop((0,0,1000,620)).save({os.path.join(shots, name)!r})"],
                       check=True)

    app.select_category(app.preset.categories[0]["id"])
    app.sel_id = app.shown[1]["id"]
    app._highlight_selection()
    ctk.set_appearance_mode("light")
    grab("ui_light.png")
    ctk.set_appearance_mode("dark")
    grab("ui_dark.png")
    ctk.set_appearance_mode("light")
    app.select_category(HISTORY)
    grab("ui_history.png")
    dlg = cm.SnippetDialog(app, "Новий запис", "", app.preset.categories[0]["id"])
    dlg.text.insert("1.0", "Добрий день! Це приклад нового запису.")
    dlg.geometry("+240+120")
    pump(600)
    subprocess.run(["/usr/local/bin/python3", "-c",
                    f"from PIL import ImageGrab; ImageGrab.grab().crop((0,0,1000,620)).save({os.path.join(shots, 'ui_dialog.png')!r})"],
                   check=True)
    dlg.destroy()
    app._popup_preset_menu = app._popup_preset_menu  # (меню tk не знімаємо у Xvfb)
print("ALL UI CHECKS OK")
os._exit(0)   # без довгого прибирання ctk-after-колбеків
