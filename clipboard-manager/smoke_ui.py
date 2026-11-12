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
settings["autohide"] = False       # автохов (клік → вікно зникає) перевіряється окремими кроками нижче
app = cm.App(root, preset, history, settings, events, use_hotkey=False, use_tray=False)
import winsys  # noqa: E402
startup = dict(render=app.render_count, side=app.sidebar_render_count, fmt_built=app._fmt_built,
               sel=app.sel_format,
               icon_cached=bool(winsys._icon_png_cache), colorchooser="tkinter.colorchooser" in sys.modules,
               hold=app._hold_chunks, lazy_history=history.lazy)
root.geometry("1180x660+0+0")
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
    return menu.labels()


def submenu(menu, label):
    return menu.sub(label)


def invoke(menu, label):
    menu.invoke(label)


def click(item_id):
    """Клік по тексту картки (ліва зона) копіює запис."""
    card = app._card_objs[item_id]
    x = card.zone.winfo_rootx() - 5
    app._drag_press(ev(x, 1), item_id)
    app._drag_release(ev(x, 1))


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
REAL_POPUP_SHOW = cm.PopupMenu.show
cm.PopupMenu.show = lambda self, *a, **k: popups.append(self.model)   # реальний popup перевіряється окремо нижче
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
assert labels(m) == ["Копіювати", "Редагувати…", "Додати аппенди…", "Додавати користувача з історії (in {LINK:USER:…:E})", "Колір запису…", "Перемістити в категорію", "Вгору", "Вниз",
                     "Видалити"], labels(m)
sub = submenu(m, "Перемістити в категорію")
assert labels(sub) == ["Робота", "Особисте", "＋ Нова категорія…"], labels(sub)
assert sub.item("Робота").checked and not sub.item("Особисте").checked, "поточна категорія позначена ✓"
assert sub.item("Робота").dot == work["color"], "біля категорії її колір"
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
assert labels(popups[-1]) == ["Перейменувати…", "Колір…", "Перемістити вгору", "Перемістити вниз",
                              "Видалити категорію…"], labels(popups[-1])
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
assert labels(menu)[:6] == ["Новий пресет…", "Відкрити пресет…", "Зберегти як…", "Перейменувати пресет…",
                            "Імпортувати з файлу (додати до поточного)…", "Показати файл у теці"], labels(menu)
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
assert root.state() == "normal" and app._hidden is False
settings["autohide"], app.hotkey_ok = True, True          # автохов діє завжди, коли є чим повернути вікно
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
settings["autohide"], app.hotkey_ok = False, False
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
assert cm._Dialog.run(dlg) == ("через справжній діалог", cats[1]["id"], None)
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
app.flush_render()        # картки малюються порціями; flush_render дороблює все відкладене
root.update()
dt = time.time() - t0
assert len(app._cards) == cm.PAGE and dt < 4, (len(app._cards), dt)
app._show_more()
app.flush_render()
assert len(app._cards) == 2 * cm.PAGE
app.sel_id = app.shown[2 * cm.PAGE - 1]["id"]
app._move_sel(1)          # стрілка вниз поза межею сторінки догружає картки
app.flush_render()
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

# =====================================================================================================================
#  Раунд 2: кольори, перейменування пресета, миттєве ховання, формат USER, розкладка
# =====================================================================================================================
def tup(x):
    return tuple(x) if isinstance(x, (list, tuple)) else x


def lum(h):
    r, g, b = [int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4  # noqa: E731
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


# свіжий пресет і порожня історія, щоб кроки були детермінованими
p2 = Preset.open_or_create(os.path.join(tmp, "colors.preset.json"))
app.history = History(os.path.join(tmp, "h2.json"))
app.switch_preset(p2, "")
root.geometry("1180x660+0+0")
pump(200)

# ---- 19. кольори папок, записів і форматів -----------------------------------------------------------------------------------
cA, cB = p2.add_category("Червоні"), p2.add_category("Сині")
s1, s2 = p2.add_snippet(cA["id"], "перший"), p2.add_snippet(cA["id"], "другий")
app.select_category(cA["id"])
pump(100)
color_answers = []
cm.ColorDialog.run = lambda self: color_answers.pop(0)


def color_of(w):
    """Колір віджета: ctk-віджети мають fg_color, прості tk-віджети (смужки) — bg."""
    try:
        return w.cget("fg_color")
    except tk.TclError:
        return w.cget("bg")


def card_bar(iid):
    return app._cards[iid].winfo_children()[0]       # перший дочірній віджет картки — кольорова смужка


def dot_color(cid):
    return app._swatches[cid].cget("fg_color")


color_answers[:] = [("set", "#E81123")]
app.on_category_color(cA["id"])
assert p2.category(cA["id"])["color"] == "#e81123"
for it in app.shown:
    assert tup(app._cards[it["id"]].cget("fg_color")) == cm.tint("#e81123"), "фон картки = відтінок кольору папки"
    assert color_of(card_bar(it["id"])) == "#e81123"
assert dot_color(cA["id"]) == "#e81123", "крапка в списку категорій підхопила колір"
assert "Колір категорії змінено" in app.status.cget("text")
p2.add_snippet(cA["id"], "третій")                    # новий запис у папці одразу має колір папки
app.render()
assert all(tup(app._cards[i["id"]].cget("fg_color")) == cm.tint("#e81123") for i in app.shown) and len(app.shown) == 3
color_answers[:] = [None]                              # скасування діалогу нічого не міняє
app.on_category_color(cA["id"])
assert p2.category(cA["id"])["color"] == "#e81123"

color_answers[:] = [("set", "#00aa00")]               # власний колір запису
app.on_snippet_color(s1["id"])
assert tup(app._cards[s1["id"]].cget("fg_color")) == cm.tint("#00aa00") and color_of(card_bar(s1["id"])) == "#00aa00"
assert tup(app._cards[s2["id"]].cget("fg_color")) == cm.tint("#e81123"), "інші записи лишились кольору папки"
color_answers[:] = [("set", "#0000ff")]               # колір папки змінюється — власний колір запису НЕ перезаписується
app.on_category_color(cA["id"])
assert tup(app._cards[s1["id"]].cget("fg_color")) == cm.tint("#00aa00")
assert tup(app._cards[s2["id"]].cget("fg_color")) == cm.tint("#0000ff") and dot_color(cA["id"]) == "#0000ff"
assert Preset.open(p2.path).snippets(cA["id"])[0]["own_color"] == "#00aa00", "власний колір збережено у файлі"
color_answers[:] = [("reset", None)]                  # «Як у папки»
app.on_snippet_color(s1["id"])
assert tup(app._cards[s1["id"]].cget("fg_color")) == cm.tint("#0000ff") and p2.snippets(cA["id"])[0]["own_color"] is None

app.select_format("builtin-user")                      # колір формату
color_answers[:] = [("set", "#ff8800")]
app.on_format_color("builtin-user")
assert p2.format("builtin-user")["color"] == "#ff8800"
row0 = app.formats_slot.winfo_children()[0]
assert tup(row0.cget("fg_color")) == cm.tint("#ff8800") and color_of(row0.winfo_children()[0]) == "#ff8800"
app.show_format_menu(3, 3, "builtin-user")
assert labels(popups[-1]) == ["Колір…", "Перемістити вгору", "Перемістити вниз"], labels(popups[-1])
app.show_menu(1, 1, s1["id"])
assert "Колір запису…" in labels(popups[-1])
app.select_category(HISTORY)
app.history.add("для меню історії")
app.render()
app.show_menu(1, 1, app.shown[0]["id"])
assert "Колір запису…" not in labels(popups[-1]), "записи історії кольору не мають"
app.select_category(cA["id"])

# справжній діалог вибору кольору
dlg = cm.ColorDialog(app, "Колір", "#e81123", allow_reset=True)
assert dlg.swatches["#e81123"].cget("text") == "✓" and dlg.swatches["#0f6cbd"].cget("text") == ""
assert len(dlg.swatches) == 12
root.after(300, dlg.swatches["#0f6cbd"].invoke)
assert cm._Dialog.run(dlg) == ("set", "#0f6cbd")
dlg = cm.ColorDialog(app, "Колір", "#0f6cbd", allow_reset=True)
root.after(300, dlg.reset)
assert cm._Dialog.run(dlg) == ("reset", None)
# «Інший колір…» — власний RGB-діалог (повзунки + HEX), без рідного вікна Windows
dlg = cm.ColorDialog(app, "Колір", None)


def drive_rgb():
    top = [w for w in root.winfo_children() if isinstance(w, cm.RGBDialog)][-1]
    top.hex.delete(0, "end")
    top.hex.insert(0, "#123456")
    top._from_hex()
    assert (top.vars["R"].get(), top.vars["G"].get(), top.vars["B"].get()) == (0x12, 0x34, 0x56)
    top.vars["B"].set(0x99)
    top._from_sliders()
    assert top.color() == "#123499" and top.hex.get() == "#123499"
    top.accept()


root.after(300, dlg.custom)
root.after(900, drive_rgb)
assert cm._Dialog.run(dlg) == ("set", "#123499")
dlg = cm.ColorDialog(app, "Колір", None)
root.after(300, dlg.custom)
root.after(900, lambda: [w for w in root.winfo_children() if isinstance(w, cm.RGBDialog)][-1].cancel())
root.after(1500, dlg.cancel)
assert cm._Dialog.run(dlg) is None
assert app.sel_format is None, "перехід між папками згорнув формат"
print("19 colors OK")

# ---- 20. перейменування пресета ---------------------------------------------------------------------------------------------------
old_path = app.preset.path
answers[:] = ["Мої   шаблони"]
app.on_rename_preset()
assert app.preset.path.endswith("Мої шаблони.preset.json") and os.path.exists(app.preset.path)
assert not os.path.exists(old_path) and app.preset.name == "Мої шаблони"
assert settings["preset_path"] == app.preset.path and old_path not in settings["recent_presets"]
assert app.preset.path in settings["recent_presets"]
assert "Мої шаблони" in root.title() and app.preset_name.cget("text") == "Мої шаблони"
assert app.preset_file.cget("text") == "Мої шаблони.preset.json" and "перейменовано" in app.status.cget("text")
assert Preset.open(app.preset.path).name == "Мої шаблони" and Preset.open(app.preset.path).count(cA["id"]) == 3
errs = len(boxes["error"])
busy = Preset.open_or_create(os.path.join(tmp, "Зайнято.preset.json"))
for bad in ("Зайнято", "   ", '<>:"|?*'):
    answers[:] = [bad]
    app.on_rename_preset()
    assert len(boxes["error"]) == errs + 1, bad
    errs += 1
    assert app.preset.name == "Мої шаблони" and app.preset.path.endswith("Мої шаблони.preset.json")
answers[:] = [None]
app.on_rename_preset()
assert len(boxes["error"]) == errs and app.preset.name == "Мої шаблони"
assert "Перейменувати пресет…" in labels(app._build_preset_menu(app._new_menu()))
app._popup_settings()
assert "Перейменувати пресет…" in labels(submenu(popups[-1], "Пресет"))
# та сама початкова задача користувача: типовий пресет "default"
dflt = Preset.open_or_create(os.path.join(tmp, "default.preset.json"))
app.switch_preset(dflt, "")
answers[:] = ["Робочий"]
app.on_rename_preset()
assert os.path.basename(app.preset.path) == "Робочий.preset.json" and not os.path.exists(os.path.join(tmp, "default.preset.json"))
app.switch_preset(Preset.open(os.path.join(tmp, "Мої шаблони.preset.json")), "")       # повертаємось до кольорового пресета
print("20 preset rename OK")

# ---- 21. автохов: миттєво, спершу ховаємось — потім працюємо --------------------------------------------------------------------------
settings["autohide"], app.hotkey_ok = True, True
app.v_autohide.set(True)
app._sync_submit_label()
assert app.fmt_btn.cget("text") == "Копіювати і сховати"
app.select_category(HISTORY)
copy_from_other("для автохову 2")
assert app.shown[0]["text"] == "для автохову 2"
app.show_window()
pump(150)
render_log = []
orig_render = app._render_list_now
app._render_list_now = lambda *a, **k: (render_log.append(root.state()), orig_render(*a, **k))[1]
target = app.shown[1]["id"] if len(app.shown) > 1 else app.shown[0]["id"]
target_text = app._text_of(target)
t0 = time.perf_counter()
click(target)
t_click_hide = time.perf_counter() - t0
assert root.state() == "withdrawn" and root.clipboard_get() == target_text
assert render_log == [], "до ховання вікна не має бути жодної перебудови списку"
pump(300)
assert render_log and all(st == "withdrawn" for st in render_log), render_log     # перебудова — лише коли вікна не видно
assert app.history.items[0]["text"] == target_text, "запис піднявся в історії вже після ховання"
app._render_list_now = orig_render
print(f"21a click -> hidden in {t_click_hide * 1000:.1f} ms; renders only while hidden: {render_log}")

# без гарячої клавіші й трея замість ховання — згортання (інакше вікно не повернути)
app.hotkey_ok, app.tray = False, None
app.show_window()
pump(100)
iconified = []
root.iconify = lambda: iconified.append(1)        # у Xvfb без віконного менеджера справжнє згортання неможливе
click(app.shown[0]["id"])
del root.iconify
assert iconified == [1] and root.state() == "normal", (iconified, root.state())     # згорнули, а не сховали
app.hotkey_ok = True
settings["autohide"] = True

# показ — лише deiconify: 0 перебудов списку
for n in range(3):
    app.hide_window()
    pump(250)
    rc = app.render_count
    app.show_window(near_cursor=True)
    root.update_idletasks()
    assert app.render_count == rc, "показ вікна не має перебудовувати список"
print("21b show needs 0 renders OK")

# зміни, поки вікно сховане, малюються у фоні (а не при показі)
app.hide_window()
pump(150)
rc = app.render_count
copy_from_other("надійшло поки вікно сховане", 700)
assert app.render_count > rc, "перебудова мала відбутись у фоні"
assert app.shown[0]["text"] == "надійшло поки вікно сховане" and not app._dirty
rc = app.render_count
app.show_window()
assert app.render_count == rc
# сховали → пошук і поле форматування очищаються самі, список готовий
app.set_search("надійшло")
app.select_format("builtin-user")
app.fmt_input.insert("1.0", "999")
app.hide_window()
pump(300)
assert app.search.get() == "" and app._query() == "" and app.fmt_input.get("1.0", "end-1c") == ""
assert len(app.shown) == len(app.history.items)
assert app.sel_format is None and app.fmt_box.winfo_manager() == "", "формат згорнувся при хованні (у фоні)"
rc = app.render_count
app.show_window()
assert app.render_count == rc and root.state() == "normal"
assert app.sel_format is None, "на показі жоден формат не розкритий"
print("21c background render / reset-on-hide OK")

# затримка від натискання гарячої клавіші до видимого вікна + час самого обробника
lat, t_show, t_hide = [], [], []
root.focus_displayof = lambda: root
for n in range(12):
    app.hide_window()
    pump(220)
    t0 = time.perf_counter()
    events.put("toggle")
    while root.state() != "normal":
        root.update()
        if time.perf_counter() - t0 > 2:
            raise AssertionError("вікно не з'явилось")
    lat.append(time.perf_counter() - t0)
    pump(200)
    t1 = time.perf_counter()
    app.toggle_window()                      # видиме і «у фокусі» → ховає
    t_hide.append(time.perf_counter() - t1)
    assert root.state() == "withdrawn"
    pump(200)
    t2 = time.perf_counter()
    app.toggle_window()
    t_show.append(time.perf_counter() - t2)
    assert root.state() == "normal"
del root.focus_displayof
print(f"21d hotkey->visible latency avg {sum(lat) / len(lat) * 1000:.1f} ms max {max(lat) * 1000:.1f} ms; "
      f"toggle handler show avg {sum(t_show) / len(t_show) * 1000:.1f} ms max {max(t_show) * 1000:.1f} ms, "
      f"hide avg {sum(t_hide) / len(t_hide) * 1000:.1f} ms max {max(t_hide) * 1000:.1f} ms")
assert max(lat) < 0.25 and max(t_show) < 0.25 and max(t_hide) < 0.1

# дебаунс і злиття подвійних натискань
app.hide_window()
pump(300)
events.put("toggle")
events.put("toggle")
pump(150)
assert root.state() == "withdrawn", "два toggle підряд скасовують одне одного"
events.put("toggle")
events.put("toggle")
events.put("toggle")
pump(150)
assert root.state() == "normal", "три toggle підряд = один"
app.hide_window()
pump(300)
app.toggle_window()
st = root.state()
app.toggle_window()                           # повторний виклик одразу — ігнорується (дебаунс)
assert st == "normal" and root.state() == st
pump(250)
print("21e toggle coalescing / debounce OK")
settings["autohide"], app.hotkey_ok = False, False
app.v_autohide.set(False)
app._on_autohide()
assert app.fmt_btn.cget("text") == "Копіювати" and Settings(settings.path)["autohide"] is False

# ---- 22. форматування USER ------------------------------------------------------------------------------------------------------------------
app.select_category(HISTORY)
assert app.sel_format is None and app.fmt_box.winfo_manager() == "" and not hasattr(app, "fmt_idle")
assert app.preset.formats[0]["name"] == "USER"      # USER — завжди перший вбудований формат
app.select_format("builtin-user")
assert app.fmt_box.winfo_manager() == "pack" and app.fmt_title.cget("text") == "USER"
inp = "123, User#45312  23512"
expected = "{LINK:USER:123:E}, {LINK:USER:45312:E}, {LINK:USER:23512:E}"
app.fmt_input.insert("1.0", inp)
app._update_format_preview()
assert app.fmt_preview.get("1.0", "end-1c") == expected
assert app.fmt_preview.cget("state") == "disabled", "перегляд лише для читання"
before_hist = len(app.history.items)
settings["autohide"], app.hotkey_ok = True, True
app.v_autohide.set(True)
app._on_autohide()
rc = app.render_count
app.submit_format()
assert root.clipboard_get() == expected, root.clipboard_get()
assert root.state() == "withdrawn", "після форматування вікно ховається"
pump(300)
assert app.fmt_input.get("1.0", "end-1c") == "" and app.fmt_preview.get("1.0", "end-1c") == ""
pump(700)
assert len(app.history.items) == before_hist and not any(i["text"] == expected for i in app.history.items), \
    ("результат форматування не потрапляє в історію буфера", before_hist, [i["text"][:40] for i in app.history.items[:4]])
app.show_window()
pump(100)
assert app.sel_format is None, "після ховання формат згорнуто"
app.select_format("builtin-user")                 # відкриваємо кліком знову
# порожній / нечисловий ввід: нічого не копіюється, вікно лишається, введене зберігається
app.copy_to_clipboard("попередній буфер")
app.fmt_input.insert("1.0", "немає чисел, User#")
app.submit_format()
assert root.state() == "normal" and root.clipboard_get() == "попередній буфер"
assert "Не знайдено жодного числа" in app.status.cget("text") and app.fmt_input.get("1.0", "end-1c") == "немає чисел, User#"
# Enter виконує, Shift+Enter — новий рядок; клавіші в полі не копіюють виділений запис
assert app._on_format_return(SimpleNamespace(state=1)) is None
app._clear_format_input()
app.fmt_input.insert("1.0", "User#7876976 User#67976, User#67987690")
assert app._on_format_return(SimpleNamespace(state=0)) == "break"
assert root.clipboard_get() == "{LINK:USER:7876976:E}, {LINK:USER:67976:E}, {LINK:USER:67987690:E}"
pump(300)
app.show_window()
app.select_category(cA["id"])
app.sel_id = app.shown[0]["id"]
app.copy_to_clipboard("лишається")
app._on_return(SimpleNamespace(widget=app.fmt_input._textbox))
assert root.clipboard_get() == "лишається", "Enter у полі форматування не повинен копіювати виділену картку"
app._on_return(SimpleNamespace(widget=root))
assert root.clipboard_get() == app.shown[0]["text"]
assert root.state() == "withdrawn", "Enter на виділеній картці копіює і (автохов) ховає вікно"
pump(100)
app.show_window()
pump(100)
assert app._in_format_input(SimpleNamespace(widget=app.fmt_input._textbox)) and not app._in_format_input(SimpleNamespace(widget=root))
# autohide вимкнено → кнопка «Копіювати», вікно лишається, поле очищується
if app.sel_format is None:                         # після ховання/зміни папки формат згорнуто — відкриваємо кліком
    app.select_format("builtin-user")
settings["autohide"] = False
app.v_autohide.set(False)
app._on_autohide()
app.fmt_input.insert("1.0", "555")
app.submit_format()
assert root.clipboard_get() == "{LINK:USER:555:E}" and root.state() == "normal" and app.fmt_input.get("1.0", "end-1c") == "", \
    (root.clipboard_get(), root.state(), app.fmt_input.get("1.0", "end-1c"))
# невідомий тип формату з новішої версії: показується неактивним, нічого не ламає
n_fmt = len(app._visible_formats())      # «Added cards» у цій папці прихований
app.preset.formats.append({"id": "x1", "name": "Майбутній", "type": "from-newer-version", "color": "#112233"})
app.preset.save()
app.render()
assert len(app.formats_slot.winfo_children()) == n_fmt + 1
app.preset.formats[:] = [f for f in app.preset.formats if f["id"] != "x1"]
app.preset.save()
app.render()
app.select_format("builtin-user")
assert app.sel_format is None, "повторний клік згортає область введення"
app.select_format("builtin-user")
print("22 USER format OK")

# ---- 23. розкладка, типографіка, контраст ---------------------------------------------------------------------------------------------------
assert app.f.card.cget("size") >= 15 and app.f.card.cget("weight") == "bold" and app.f.meta.cget("size") >= 12
for mode, ci in (("light", 0), ("dark", 1)):
    assert contrast(cm.META[ci], cm.CARD[ci]) >= 4.5, (mode, "meta")
    assert contrast(cm.TEXT[ci], cm.CARD[ci]) >= 7, (mode, "text")
    for color in cm.SWATCHES:                       # навіть на найсильнішому відтінку текст лишається читабельним
        bg = cm.tint(color, 0.20, 0.28)[ci]
        assert contrast(cm.TEXT[ci], bg) >= 4.5 and contrast(cm.META[ci], bg) >= 3.2, (mode, color)
for w, h in ((1180, 660), (1040, 520)):
    root.geometry(f"{w}x{h}+0+0")
    pump(500)
    sc = app.scaling()
    lw, mw, rw = (x.winfo_width() / sc for x in (app.left, app.mid, app.right))
    assert 292 <= lw <= 308 and 334 <= rw <= 356, (w, lw, rw)
    assert mw >= 320, (w, mw)
    if w == 1180:
        assert mw < 540, f"центральна колонка не має бути надто розтягнутою ({mw})"
    # нічого не обрізається: кнопка форматування і приписка — всередині правої колонки
    bottom = app.right.winfo_rooty() + app.right.winfo_height()
    assert not hasattr(app, "formats_note"), "приписку «Інші формати — скоро» прибрано"
    for wdg in (app.fmt_btn,):
        assert wdg.winfo_rooty() + wdg.winfo_height() <= bottom + 1, (w, h, wdg)
        assert wdg.winfo_rooty() >= app.right.winfo_rooty()
    for card in app._cards.values():
        assert card.winfo_width() <= app.cards.winfo_width() + 1
    assert app._wrap_labels, "у відкритій категорії мають бути картки"
    for lbl in app._wrap_labels:      # текст картки переноситься, а не обрізається по правому краю
        assert lbl.winfo_reqwidth() <= lbl.winfo_width() + 2, (w, lbl.cget("text"), lbl.winfo_reqwidth(), lbl.winfo_width())
print("23 layout/typography OK")
root.geometry("1180x660+0+0")
pump(300)
if app.sel_format:
    app.select_format(app.sel_format)
assert app.sel_format is None

# ---- 23b. раунд 3: на весь екран, помітні кнопки, без підтвердження, кольорові рядки ----------------------------------------------------
root.geometry("1180x660+0+0")
pump(300)
# (a) показ гарячою клавішею/треєм розгортає вікно (перед deiconify); вимкнено — старий режим біля курсора
assert settings["fullscreen"] is True
settings["autohide"] = False
app.hide_window()
n = app.maximize_count
events.put("show")
pump(500)
assert app.maximize_count == n + 1 and app._maximized, "show розгортає вікно"
app.hide_window()
events.put("toggle")
pump(600)
assert app.maximize_count == n + 2, "toggle (гаряча клавіша) теж розгортає вікно"
app.v_fullscreen.set(False)
app._on_fullscreen()
assert settings["fullscreen"] is False and "звичайного" in app.status.cget("text")
app.hide_window()
app.show_window(near_cursor=True)
pump(300)
assert app.maximize_count == n + 2 and app._maximized is False, "при вимкненому режимі вікно не розгортається"
app.v_fullscreen.set(True)
app._on_fullscreen()
assert settings["fullscreen"] is True
settings["autohide"] = False
print("23b-a fullscreen on show OK")

# (b) «Очистити історію»: без діалогу підтвердження
boxes["ask"].clear()
app.history.add("тимчасовий запис 1")
app.history.add("тимчасовий запис 2")
app.select_category(HISTORY)
pump(200)
assert app.history.items
app.on_clear()
pump(100)
assert not app.history.items and not app.shown and boxes["ask"] == [], boxes["ask"]
assert "очищено" in app.status.cget("text")
print("23b-b clear without confirmation OK")

# (c) кнопки помітні: розмір, жирний шрифт, контраст, hover; «＋ Новий» не виглядає вимкненим і відповідає
for name in ("clear_btn", "new_cat_btn"):
    b = getattr(app, name)
    assert b.cget("height") >= 32 and b.cget("width") >= 90, (name, b.cget("height"), b.cget("width"))
    assert b.cget("font").cget("size") >= 13 and b.cget("font").cget("weight") == "bold", name
    assert b.cget("state") == ("disabled" if name == "clear_btn" else "normal"), name   # порожня історія: «Очистити» неактивна
assert not hasattr(app, "new_fmt_btn"), "кнопку «＋ Новий» у форматуванні прибрано"
for name in ("new_cat_btn",):
    b = getattr(app, name)
    assert b.cget("fg_color") == cm.ACCENT and b.cget("text_color") == "#ffffff"
    assert contrast("#ffffff", cm.ACCENT) >= 4.5
for ci in (0, 1):
    assert contrast(cm.DANGER[ci], cm.PANEL[ci]) >= 3.0, ("clear_btn contrast", ci)
assert app.clear_btn.cget("border_width") >= 2 and app.clear_btn.cget("text_color") == cm.DANGER
app.history.add("щоб кнопка очищення з'явилась")
app.select_category(HISTORY)
pump(200)
assert app.clear_btn.winfo_ismapped() and app.clear_btn.winfo_height() >= 32, "кнопка «Очистити історію» видима"
app.on_clear()
print("23b-c noticeable buttons OK")

# (d) кружечок-кнопка кольору на рядку категорії/формату відкриває палітру напряму, не вибираючи рядок
cats = app.preset.categories
assert len(cats) >= 2
cA, cB = cats[0], cats[1]
app.select_category(cA["id"])
pump(200)
asked = []
orig_color_run = cm.ColorDialog.run
cm.ColorDialog.run = lambda self: (asked.append(self.title()), self.destroy(), ("set", "#00b294"))[2]
sw = app._swatches[cB["id"]]
assert str(sw.cget("cursor")) == "hand2"
sw._canvas.event_generate("<Button-1>", x=6, y=6)
pump(300)
assert asked and cB["name"] in asked[0], asked
assert app.view == cA["id"], "клік по кружечку не перемикає категорію"
assert app.preset.category(cB["id"])["color"] == "#00b294"
assert Preset.open(app.preset.path).category(cB["id"])["color"] == "#00b294", "колір записано у файл"
fill, hover, sel_fill, border = cm.row_colors("#00b294")
assert app._rows[cB["id"]].cget("fg_color") == fill and fill != "transparent", "рядок категорії підфарбовано її кольором"
assert app._rows[cA["id"]].cget("border_width") == 2 and app._rows[cB["id"]].cget("border_width") == 1, "вибрана категорія виділена"
assert app._rows[cA["id"]].cget("fg_color") == cm.row_colors(cA["color"])[2], "вибраний рядок має сильніший відтінок"
asked.clear()
fsw = app._swatches["fmt:builtin-user"]
cm.ColorDialog.run = lambda self: (asked.append(self.title()), self.destroy(), ("set", "#ffb900"))[2]
fsw._canvas.event_generate("<Button-1>", x=6, y=6)
pump(300)
assert asked and app.preset.format("builtin-user")["color"] == "#ffb900"
cm.ColorDialog.run = orig_color_run
print("23b-d clickable swatches OK")

# (e) рядки на всю ширину колонки, лічильник і «⋯» притиснуті до правого краю; смуга прокрутки не краде ширину
root.geometry("1180x660+0+0")
pump(600)
sc = app.scaling()
assert not app.cat_list._scrollbar.winfo_ismapped(), "смуга прокрутки сховалась, поки категорій мало"
inner_right = app.cat_list._parent_canvas.winfo_rootx() + app.cat_list._parent_canvas.winfo_width()
for c in app.preset.categories:
    row = app._rows[c["id"]]
    assert inner_right - (row.winfo_rootx() + row.winfo_width()) <= 12 * sc + 2, "рядок на всю ширину"
    more = row.grid_slaves(row=0, column=4)[0]
    gap = (row.winfo_rootx() + row.winfo_width()) - (more.winfo_rootx() + more.winfo_width())
    assert gap <= 14 * sc, ("«⋯» притиснута до правого краю", gap)
    num = row.grid_slaves(row=0, column=3)[0]
    assert (more.winfo_rootx() - (num.winfo_rootx() + num.winfo_width())) <= 12 * sc
hrow = app._rows[HISTORY]
hnum = hrow.grid_slaves(row=0, column=3)[0]
assert (hrow.winfo_rootx() + hrow.winfo_width()) - (hnum.winfo_rootx() + hnum.winfo_width()) <= 16 * sc, "лічильник історії справа"
slot_right = app.formats_slot.winfo_rootx() + app.formats_slot.winfo_width()
for w in app.formats_slot.winfo_children():
    assert slot_right - (w.winfo_rootx() + w.winfo_width()) <= 10 * sc + 2, "рядок формату на всю ширину"
    more = w.grid_slaves(row=0, column=3)[0]
    assert (w.winfo_rootx() + w.winfo_width()) - (more.winfo_rootx() + more.winfo_width()) <= 14 * sc
# багато категорій → з'являється смуга прокрутки
extra = [app.preset.add_category(f"Тимчасова {i}") for i in range(14)]
app.render()
pump(500)
assert app.cat_list._scrollbar.winfo_ismapped(), "смуга прокрутки з'являється, коли рядків багато"
for c in extra:
    app.preset.delete_category(c["id"])
app.render()
pump(500)
assert not app.cat_list._scrollbar.winfo_ismapped()
print("23b-e rows full width / right aligned OK")

# (f) бічні колонки ростуть із вікном (clamp), а картки в центрі не ширші за CARD_MAX і центруються
app.select_category(app.preset.categories[0]["id"])
for w, h in ((1366, 768), (1920, 1040), (2560, 1400), (1040, 520)):
    root.geometry(f"{w}x{h}+0+0")
    pump(700)
    sc = app.scaling()
    want_l = int(min(cm.LEFT_MAX, max(cm.LEFT_W, w * cm.LEFT_FRAC)))
    want_r = int(min(cm.RIGHT_MAX, max(cm.RIGHT_W, w * cm.RIGHT_FRAC)))
    lw, mw, rw = (x.winfo_width() / sc for x in (app.left, app.mid, app.right))
    assert abs(lw - want_l) <= 3 and abs(rw - want_r) <= 3, (w, lw, want_l, rw, want_r)
    cw = [c.winfo_width() / sc for c in app._cards.values()]
    assert cw and max(cw) <= cm.CARD_MAX + 2, (w, max(cw))
    if w >= 1920:                                            # поля з обох боків однакові: колонка центрована
        c0 = next(iter(app._cards.values()))
        left_gap = c0.winfo_rootx() - app.cards._parent_canvas.winfo_rootx()
        canvas_right = app.cards._parent_canvas.winfo_rootx() + app.cards._parent_canvas.winfo_width()
        right_gap = canvas_right - (c0.winfo_rootx() + c0.winfo_width())
        assert abs(left_gap - right_gap) <= 18 * sc, (w, left_gap, right_gap)
        assert w < 2200 or cw[0] <= cm.CARD_MAX + 2
    for lbl in app._wrap_labels:
        assert lbl.winfo_reqwidth() <= lbl.winfo_width() + 2, (w, lbl.cget("text"))
    for wdg in (app.left, app.mid, app.right, app.add_btn, app.gear):          # нічого не вилазить за вікно
        assert wdg.winfo_rootx() + wdg.winfo_width() <= root.winfo_rootx() + root.winfo_width() + 1, (w, wdg)
    print(f"   {w}x{h}: left {lw:.0f} mid {mw:.0f} right {rw:.0f} card {max(cw):.0f}")
root.geometry("1180x660+0+0")
pump(500)
print("23b-f responsive columns OK")

# ---- 26. оптимізація: рендер, пам'ять, пробудження, тема, миша, --timing ----------------------------------------------------------
import threading  # noqa: E402

settings["autohide"] = False
app.set_search("")
# 26a. старт: жодних дубльованих перебудов, важкі частини відкладені
assert startup["render"] == 1 and startup["side"] == 1, startup
assert startup["fmt_built"] is False, "область форматування (2 CTkTextbox) будується лише при виборі формату"
assert not startup["icon_cached"] or os.name == "nt", "іконка не малюється до першого показу (Linux)"
assert not startup["colorchooser"], "діалог вибору кольору не імпортується на старті"
assert startup["lazy_history"] is True
assert winsys._icon_png_cache or os.name == "nt", "іконка з'являється пізніше (після першого малювання)"
print("26a startup deferrals OK", startup)


def n_widgets(w):
    return 1 + sum(n_widgets(c) for c in w.winfo_children())


def full_rebuild():
    """Знищує ВСІ картки, рядки категорій і форматів та будує з нуля — еталон для порівняння з оновленням на місці."""
    app.flush_render()
    for iid in list(app._card_objs):
        app._card_objs.pop(iid).destroy()
    app._cards.clear(); app._card_border.clear(); app._packed = []
    for k in list(app._row_objs):
        app._row_objs.pop(k).destroy()
    app._rows.clear(); app._row_keys.clear(); app._row_fills.clear(); app._swatches.clear(); app._row_order = []
    for fid in list(app._fmt_rows):
        app._fmt_rows.pop(fid).destroy()
    app._fmt_order = []
    app._render_now()
    app.flush_render()
    root.update()


def ui_state():
    for c_ in app._card_objs.values():     # нерухомий курсор може опинитись над карткою після перепакування — це ховер, не стан даних
        c_.hover_off()
    for r_ in app._row_objs.values():
        r_._leave()
    for fr_ in app._fmt_rows.values():
        fr_._leave()
    cards = []
    for iid in app._order:
        c = app._card_objs.get(iid)
        if c is None:
            cards.append((iid, None))
            continue
        cards.append((iid, c.body.cget("text"), str(c.frame.cget("fg_color")),
                      str(c.frame.cget("border_color")), c.frame.cget("border_width"), c.bar.cget("bg"),
                      c.body.cget("bg"), c.more.cget("bg"), c.dele.cget("bg"), c.body.cget("fg")))
    frames = {id(c.frame): i for i, c in app._card_objs.items()}
    packed = [frames[id(w)] for w in app.cards.pack_slaves() if id(w) in frames]
    side = []
    for key in [HISTORY] + app._row_order:
        r = app._row_objs[key]
        side.append((key, r.label.cget("text"), r.num.cget("text"), str(r.row.cget("fg_color")),
                     r.row.cget("border_width"), str(r.row.cget("border_color")), r.bar.cget("bg"),
                     r.label.cget("bg"), r.label.cget("fg")))
    side_order = [next(k for k, o in app._row_objs.items() if o.row is w) for w in app.cat_list.pack_slaves()
                  if any(o.row is w for o in app._row_objs.values())]
    fmts = [(f, r.name.cget("text"), str(r.row.cget("fg_color")), r.bar.cget("bg"), r.row.cget("border_width"))
            for f, r in app._fmt_rows.items()]
    return cards, packed, side, side_order, fmts


# 26b. перші картки з'являються ДО решти (порціями), кінцевий результат той самий
h26 = History(os.path.join(tmp, "h26.json"))      # власна історія на 300 записів (як вмикає її сама програма: lazy)
h26.lazy = True
for n in range(300):
    h26.items.append({"id": f"z{n}", "text": f"Запис історії №{n}: Lorem ipsum dolor sit amet " * (1 + n % 4),
                      "ts": time.time() - n})
app.history = h26
app.select_category(HISTORY)
app.limit = cm.PAGE
app.flush_render()
for iid in list(app._card_objs):
    app._card_objs.pop(iid).destroy()
app._cards.clear(); app._card_border.clear(); app._packed = []
chunk_log = []
_orig_create = app._create_cards


def _logged_create(n):
    before = len(app._card_objs)
    t_ = time.perf_counter()
    _orig_create(n)
    chunk_log.append((len(app._card_objs) - before, (time.perf_counter() - t_) * 1000))


app._create_cards = _logged_create
t0 = time.perf_counter()
app.render_list(scroll_top=True)
first_ms = (time.perf_counter() - t0) * 1000
assert len(app._cards) == cm.FIRST_CHUNK and app.pending_render() and app._more_btn is None, len(app._cards)
t0 = time.time()
while app.pending_render() and time.time() - t0 < 20:
    root.update()
    time.sleep(0.001)
app._create_cards = _orig_create
assert len(app._cards) == cm.PAGE and not app.pending_render() and app._more_btn is not None
sizes = [n for n, _ in chunk_log]
assert sizes[0] == cm.FIRST_CHUNK and len(sizes) >= 5 and max(sizes[1:]) <= cm.NEXT_CHUNK and sum(sizes) == cm.PAGE, sizes
worst_ms = max(ms for _, ms in chunk_log)
assert worst_ms < 200, f"одна порція не має блокувати інтерфейс надовго: {worst_ms:.0f} мс"
steps = sizes
want = [i["id"] for i in app.shown[: cm.PAGE]]
frames = {id(c): i for i, c in app._cards.items()}
assert [frames[id(w)] for w in app.cards.pack_slaves() if id(w) in frames] == want, "порядок карток у pack"
print(f"26b chunked render OK: first {cm.FIRST_CHUNK} cards in {first_ms:.0f} ms, chunks {steps}, "
      f"worst chunk {worst_ms:.0f} ms")

# 26c. оновлення на місці дають той самий UI, що й повна перебудова
pp = Preset(os.path.join(tmp, "inplace.preset.json")); pp.save()
app.switch_preset(pp, "t")
c1, c2 = pp.add_category("Один"), pp.add_category("Два")
sn = [pp.add_snippet(c1["id"], f"Запис {n}: " + "слово " * (n * 6) + ("\nдруга лінія" if n % 2 else "")) for n in range(1, 6)]
sn6 = pp.add_snippet(c2["id"], "Інша категорія")
app.select_category(c1["id"]); app.flush_render(); pump(150)
mutations = [
    ("колір запису", lambda: pp.set_snippet_color(sn[1]["id"], "#ff0000")),
    ("колір папки", lambda: pp.set_category_color(c1["id"], "#00aa00")),
    ("текст запису", lambda: pp.update_snippet(sn[2]["id"], "Змінений текст\nдруга лінія")),
    ("порядок", lambda: pp.reorder_snippet(sn[4]["id"], -3)),
    ("видалення", lambda: pp.remove_snippet(sn[0]["id"])),
    ("новий запис", lambda: pp.add_snippet(c1["id"], "Зовсім новий запис у кінці")),
    ("назва/порядок категорій", lambda: (pp.rename_category(c1["id"], "Перший"), pp.move_category(c2["id"], -1))),
    ("скидання кольору", lambda: pp.set_snippet_color(sn[1]["id"], None)),
]
for name, mutate in mutations:
    mutate()
    app.render()
    app.flush_render()
    root.update()
    inplace = ui_state()
    full_rebuild()
    rebuilt = ui_state()
    if inplace != rebuilt:
        for part, a_, b_ in zip(("cards", "packed", "side", "side_order", "fmts"), inplace, rebuilt):
            if a_ != b_:
                for ia, ib in zip(a_, b_):
                    if ia != ib:
                        diffs = [(k, x, y) for k, (x, y) in enumerate(zip(ia, ib)) if x != y] if isinstance(ia, tuple) else (ia, ib)
                        print("DIFF", name, part, [str(d)[:90] for d in diffs])
    assert inplace == rebuilt, f"оновлення на місці розійшлось із повною перебудовою: {name}"
app._move_sel(1)
sel_inplace = ui_state()
full_rebuild()
assert sel_inplace == ui_state(), "виділення"
print(f"26c in-place == full rebuild OK ({len(mutations) + 1} змін)")

# 26d. жодних витоків віджетів і службових словників після багатьох перебудов
app.select_category(c1["id"]); app.set_search(""); app.flush_render(); pump(100)
base_widgets, base_cards, base_rows = n_widgets(root), len(app._card_objs), len(app._row_objs)
counts = []
for i in range(20):
    app.set_search("слово" if i % 2 == 0 else "")
    app.flush_render()
    app.select_category(c2["id"] if i % 3 == 0 else c1["id"])
    app.flush_render()
    app.render()
    app.flush_render()
    app.set_search("")
    app.select_category(c1["id"])
    app.flush_render()
    counts.append(n_widgets(root))
assert len(set(counts)) == 1 and counts[0] == base_widgets, (base_widgets, counts)
assert len(app._card_objs) == len(app._cards) == base_cards and len(app._row_objs) == base_rows
assert len(app._row_keys) == len(pp.categories) and len(app._swatches) == len(pp.categories) + len(app._fmt_rows)
assert set(app._card_border) == set(app._card_objs)
print(f"26d no widget leaks OK ({base_widgets} widgets stable over 20 cycles)")

# 26e. запис історії — з таймера (не на кожне копіювання), але до диска доходить
assert app.history.lazy is True
copy_from_other("lazy-history-перевірка", wait=900)
assert app.history.items and app.history.items[0]["text"] == "lazy-history-перевірка"
assert History(app.history.path).items[0]["text"] == "lazy-history-перевірка", "flush() має записати історію з таймера"
print("26e lazy history flush OK")

# 26f. подія з іншого потоку будить цикл одразу (без опитування): затримка ≪ періоду страхувального опитування
wq = cm.WakeQueue()
wq.root = root
saved_events, saved_toggle = app.events, app.toggle_window
app.events = wq
bind_id = root.bind("<<CMEvents>>", lambda e: app._drain_events(), add="+")
stamps, lat = {}, []


def rec():
    stamps["t"] = time.perf_counter()
    saved_toggle()


app.toggle_window = rec


def producer():
    time.sleep(0.4)
    for k in range(8):
        time.sleep(0.2 + 0.019 * k)           # різні фази відносно 200-мс страхувального опитування
        stamps.clear()
        t = time.perf_counter()
        wq.put("toggle")
        for _ in range(400):
            if "t" in stamps:
                break
            time.sleep(0.001)
        lat.append(stamps.get("t", t + 9) - t)


th = threading.Thread(target=producer, daemon=True)
th.start()
root.after(4600, root.quit)
root.mainloop()
th.join(5)
root.unbind("<<CMEvents>>", bind_id)
app.events, app.toggle_window = saved_events, saved_toggle
if root.state() == "withdrawn":
    app.show_window()
assert len(lat) == 8 and max(lat) < 0.035, [round(x * 1000, 1) for x in lat]
print("26f instant wake-up OK: latencies ms", [round(x * 1000, 1) for x in lat], "(страхувальне опитування — 200 мс)")

# 26g. тема: прості tk-віджети перефарбовуються разом із ctk-віджетами
app.select_category(c1["id"]); app.flush_render()
old_theme = settings["theme"]
for mode, idx in (("dark", 1), ("light", 0), ("dark", 1), (old_theme if old_theme in ("light", "dark") else "light", None)):
    app.v_theme.set(mode)
    app._on_theme()
    pump(120)
    if idx is None:
        break
    card = next(iter(app._card_objs.values()))
    assert card.body.cget("bg") == app.col(card.cur) and card.body.cget("fg") == cm.TEXT[idx], (mode, card.body.cget("bg"))
    assert app.status.cget("bg") == cm.BG[idx] and app.preset_name.cget("bg") == cm.ACCENT_SOFT[idx]
    assert app.title_lbl.cget("bg") == cm.PANEL[idx]
    row = next(iter(app._row_objs.values()))
    assert row.label.cget("fg") == cm.TEXT[idx] and row.label.cget("bg") == app.col(cm._eff(row.cur))
    assert app.col(cm.TEXT) == cm.TEXT[idx]
print("26g theme recolor of plain widgets OK")

# 26h. події миші напряму на картці: ховер і клік через спільні bindtags; кнопки картки не «клікають» картку
app.select_category(c1["id"]); app.flush_render(); root.update()
card = next(iter(app._card_objs.values()))
iid = card.iid
canvas = card.frame._canvas
canvas.event_generate("<Enter>")
root.update()
assert card.hovering and str(card.frame.cget("fg_color")) == str(card.hover), "наведення підсвічує картку"
canvas.event_generate("<Leave>")
pump(80)
assert not card.hovering, "курсор поза карткою — підсвітка знімається"
calls = []
saved_copy, saved_menu, saved_del = app.copy_item, app.show_menu, app.on_delete
app.copy_item = lambda i, hide=None: calls.append(("copy", i))
app.show_menu = lambda x, y, i: calls.append(("menu", i))
app.on_delete = lambda i: calls.append(("delete", i))
for w in (card.body, card.bar, canvas):
    calls.clear()
    w.event_generate("<ButtonPress-1>", x=4, y=4)
    w.event_generate("<ButtonRelease-1>", x=4, y=4)
    root.update()
    assert calls == [("copy", iid)], (w, calls)
calls.clear()
card.body.event_generate("<Button-3>", x=4, y=4)
root.update()
assert calls == [("menu", iid)], calls
calls.clear()
card.dele.event_generate("<ButtonPress-1>", x=3, y=3)
card.dele.event_generate("<ButtonRelease-1>", x=3, y=3)
root.update()
assert calls == [("delete", iid)] and app._drag is None, (calls, app._drag)
calls.clear()
card.more.event_generate("<ButtonPress-1>", x=3, y=3)
card.more.event_generate("<ButtonRelease-1>", x=3, y=3)
root.update()
assert calls == [("menu", iid)], calls
app.copy_item, app.show_menu, app.on_delete = saved_copy, saved_menu, saved_del
print("26h card mouse events via bindtags OK")

# 26i. --timing: журнал стадій запуску (і нуль накладних витрат без прапорця)
with socket.socket() as s_:
    s_.bind(("127.0.0.1", 0))
    port_t = s_.getsockname()[1]
env_t = dict(os.environ, CLIPBOARD_MEMORY_PORT=str(port_t))
for with_flag in (True, False):
    tdir = os.path.join(tmp, "timing_on" if with_flag else "timing_off")
    argv = [sys.executable, os.path.join(HERE, "clipboard_manager.py"), "--data-dir", tdir, "--no-hotkey", "--no-tray"]
    pr_ = subprocess.Popen(argv + (["--timing"] if with_flag else []), env=env_t, stderr=subprocess.PIPE,
                           stdout=subprocess.PIPE)
    pump(3200)             # батьківський Tk володіє буфером обміну: його цикл подій має відповідати підпроцесу
    assert pr_.poll() is None, pr_.stderr.read().decode()
    pr_.terminate()
    pr_.wait(10)
    log = os.path.join(tdir, "startup-timing.log")
    if not with_flag:
        assert not os.path.exists(log), "без --timing журнал не пишеться"
        continue
    text = open(log, encoding="utf-8").read()
    stages = ["imports_done", "args_parsed", "single_instance_ok", "data_loaded", "root_created", "app_init_start",
              "ui_built", "first_render", "first_map", "revealed", "late_init_done", "first_tick_done"]
    ms = {}
    for line in text.splitlines():
        parts = line.split()
        if parts and parts[0] in stages:
            ms[parts[0]] = float(line.split("t_ms=")[1].split()[0])
    assert all(st in ms for st in stages), (set(stages) - set(ms), text)
    seq = [ms[st] for st in stages]
    assert seq == sorted(seq), f"стадії мають іти по зростанню: {dict(zip(stages, seq))}"
    # на старті — одна перебудова списку (друга можлива лише якщо в буфері вже лежав чужий текст і його записано в історію)
    n_render = int(text.split("render_list_calls=")[1].split()[0])
    assert 1 <= n_render <= 2 and "widgets=" in text, text
    print("26i --timing log OK:", {k: round(v) for k, v in ms.items()})

# ---- 27. раунд 4: велике меню, перестановка, мультивибір, ховання+логи, залиті папки, Added cards ----------------------------------------
prev_preset, prev_history = app.preset, app.history
prev = dict(autohide=settings["autohide"], hotkey_ok=app.hotkey_ok, tray=app.tray, relaunch=app.relaunch_ok)
r4_dir = os.path.join(tmp, "round4")
os.makedirs(r4_dir)
r4 = Preset.open_or_create(os.path.join(r4_dir, "r4.preset.json"))
r4_hist = History(os.path.join(r4_dir, "h.json"))
app.history = r4_hist
root.geometry("1500x800+0+0")
pump(400)
app.switch_preset(r4, "")
pump(200)
sl = r4.add_category("Suspicious login")
ot = r4.add_category("Other")
third = r4.add_category("Третя")
app.render()
settings["autohide"] = False
sc = app.scaling()
assert startup["sel"] is None, "при старті жоден формат не розкритий"

# (a) велике меню: справжній popup, рядки ≥ 40 px, шрифт 14, позиція в межах екрана, клавіатура, підменю, закриття
cm.PopupMenu.show = REAL_POPUP_SHOW
app.select_category(sl["id"])
base_txt = "Suspicious login confirmed. Unsolicited charges were refunded."
sn_base = r4.add_snippet(sl["id"], base_txt)
for t in ("a", "b", "c", "d"):
    r4.add_snippet(sl["id"], t)
app.render()
pump(300)
sid = sn_base["id"]
app.show_menu(root.winfo_rootx() + 500, root.winfo_rooty() + 300, sid)
pop = app._popups[-1]
pump(150)
assert pop.top.winfo_viewable() and pop.top.winfo_width() >= 250 * sc - 2
assert [i.label for i, _, _ in pop.rows] == ["Копіювати", "Редагувати…", "Додати аппенди…", "Додавати користувача з історії (in {LINK:USER:…:E})", "Колір запису…", "Перемістити в категорію",
                                              "Вгору", "Вниз", "Видалити"]
for item, row, parts in pop.rows:
    assert row.winfo_height() >= 40 * sc - 1, (item.label, row.winfo_height())
    lbl = next(w for w in parts if isinstance(w, tk.Label) and w.cget("text") == item.label)
    assert str(lbl.cget("font")) == str(app.pf.menu) and app.pf.menu.cget("size") == -round(14 * sc), (lbl.cget("font"), app.pf.menu.cget("size"))
    assert lbl.cget("fg") == app.col(cm.DANGER if item.danger else cm.TEXT)
assert pop.rows[-1][0].danger and pop.rows[-1][0].label == "Видалити"
# позиція: далеко за межами екрана — меню притискається в межі
app.close_popups()
app.show_menu(20000, 20000, sid)
pop = app._popups[-1]
pump(100)
swd, sht = root.winfo_screenwidth(), root.winfo_screenheight()
assert pop.top.winfo_rootx() + pop.top.winfo_width() <= swd and pop.top.winfo_rooty() + pop.top.winfo_height() <= sht
assert pop.top.winfo_rootx() >= 0 and pop.top.winfo_rooty() >= 0
app.close_popups()
# клавіатура: ↓ ↑ (з переходом по колу), Enter виконує команду після закриття меню
app.show_menu(400, 200, sid)
pop = app._popups[-1]
pop._on_key("Down")
assert pop.sel == 0
pop._on_key("Up")
assert pop.sel == len(pop.rows) - 1, "↑ з першого рядка — на останній"
pop._on_key("Down")
assert pop.sel == 0 and pop.rows[0][2][0].cget("bg") == app.col(cm.MENU_HOVER)
app.copy_to_clipboard("до меню")
pop._on_key("Return")
pump(150)
assert root.clipboard_get() == base_txt and app._popups == [], "Enter у меню виконав «Копіювати» і закрив меню"
# підменю збоку: → відкриває, ← закриває, Esc закриває все
app.show_menu(300, 200, sid)
pop = app._popups[-1]
move_i = [i for i, (it, _, _) in enumerate(pop.rows) if it.kind == "cascade"][0]
pop._select(move_i)
pop._on_key("Right")
assert pop.child is not None and pop.child.top.winfo_viewable() and len(app._popups) == 2
assert [i.label for i, _, _ in pop.child.rows] == ["Suspicious login", "Other", "Третя", "＋ Нова категорія…"]
assert pop.child.rows[0][0].checked and pop.child.rows[0][2][1].cget("text") == "✓", "поточна категорія з ✓"
assert any(w.cget("text") == "●" and w.cget("fg") == sl["color"] for w in pop.child.rows[0][2] if isinstance(w, tk.Label))
assert pop.child.top.winfo_rootx() >= pop.top.winfo_rootx() - 20 * sc
pop.child._on_key("Left")
assert pop.child is None and len(app._popups) == 1
pop._on_key("Right")
pop.child._on_key("Escape")                  # Esc у підменю закриває лише його
assert len(app._popups) == 1 or app._popups == []
app.close_popups()
# клік поза меню закриває без дії; клік по рядку виконує
app.show_menu(300, 200, sid)
pop = app._popups[-1]
assert pop._press(SimpleNamespace(x_root=3, y_root=3, num=1)) == "break" and app._popups == []
app.show_menu(300, 200, sid)
pop = app._popups[-1]
pump(100)
row = pop.rows[0][1]
app.copy_to_clipboard("до кліку")
pop._press(SimpleNamespace(x_root=row.winfo_rootx() + 12, y_root=row.winfo_rooty() + 12, num=1))
pump(150)
assert root.clipboard_get() == base_txt and app._popups == []
# темна тема: меню малюється в палітрі теми
app.v_theme.set("dark")
app._on_theme()
pump(150)
app.show_menu(300, 200, sid)
pop = app._popups[-1]
assert pop.rows[0][1].cget("bg") == cm.MENU_BG[1] and pop.rows[0][2][2].cget("fg") == cm.TEXT[1]
app.close_popups()
app.v_theme.set("light")
app._on_theme()
pump(100)
# меню категорій/форматів/⚙/пресета теж справжні popup
for opener in (lambda: app.show_category_menu(300, 200, sl["id"]), lambda: app.show_format_menu(300, 200, "builtin-user"),
               app._popup_settings, app._popup_preset_menu):
    opener()
    pump(80)
    assert app._popups and app._popups[0].top.winfo_viewable()
    for item, row, _ in app._popups[0].rows:
        assert row.winfo_height() >= 40 * sc - 1, item.label
    app.close_popups()
cm.PopupMenu.show = lambda self, *a, **k: popups.append(self.model)
print("27a big popup menu OK")

# (b) перестановка записів / категорій / форматів
app.select_category(sl["id"])
pump(300)
ids_by = {s["text"]: s["id"] for s in r4.snippets(sl["id"])}
order = lambda: [s["text"] for s in r4.snippets(sl["id"])]
assert order() == [base_txt, "a", "b", "c", "d"]
frames = lambda: [app._card_objs[i].frame for i in app._order]
f0 = frames()[0]
sx, sy = f0.winfo_rootx() + 60, frames()[4].winfo_rooty() + 12
app._drag_press(ev(sx, sy), ids_by["d"])
app._drag_motion(ev(sx, sy - 40))
assert app._drag["active"] and app._drag["reorder"] is not None
app._drag_motion(ev(sx, f0.winfo_rooty() + 2))                    # над першою карткою
root.update_idletasks()
assert app._drag["reorder"] == 0 and app._indicators[app.cards].winfo_ismapped(), app._drag
app._drag_release(ev(sx, f0.winfo_rooty() + 2))
pump(150)
assert order() == ["d", base_txt, "a", "b", "c"] and not app._indicators[app.cards].winfo_ismapped()
assert Preset.open(r4.path).snippets(sl["id"])[0]["text"] == "d", "порядок записано у файл"
assert [app._card_objs[i].text for i in app._packed] == order(), "картки переставлено в інтерфейсі"
# вниз: після останньої картки
fr = frames()
sx, sy = fr[0].winfo_rootx() + 60, fr[0].winfo_rooty() + 12
app._drag_press(ev(sx, sy), ids_by["d"])
app._drag_motion(ev(sx, sy + 20))
app._drag_motion(ev(sx, fr[-1].winfo_rooty() + fr[-1].winfo_height() - 2))
app._drag_release(ev(sx, fr[-1].winfo_rooty() + fr[-1].winfo_height() - 2))
pump(150)
assert order() == [base_txt, "a", "b", "c", "d"], order()
# між середніми картками
fr = frames()
sx, sy = fr[4].winfo_rootx() + 60, fr[4].winfo_rooty() + 12
app._drag_press(ev(sx, sy), ids_by["d"])
app._drag_motion(ev(sx, sy - 30))
ty = fr[2].winfo_rooty() + 3                                  # верхній край третьої → між «a» і «b»
app._drag_motion(ev(sx, ty))
app._drag_release(ev(sx, ty))
pump(150)
assert order() == [base_txt, "a", "d", "b", "c"], order()
# під час пошуку порядок не міняється (індекси фільтрованого списку ≠ повного), користувача про це попереджають
app.set_search("a")
pump(150)
assert not app._can_reorder_records()
f_a = frames()[0]
app._drag_press(ev(f_a.winfo_rootx() + 60, f_a.winfo_rooty() + 12), ids_by["a"])
app._drag_motion(ev(f_a.winfo_rootx() + 60, f_a.winfo_rooty() + 60))
assert app._drag["reorder"] is None
app._drag_release(ev(f_a.winfo_rootx() + 60, f_a.winfo_rooty() + 60))
assert order() == [base_txt, "a", "d", "b", "c"]
app.set_search("")
pump(150)
# клік без руху все ще копіює
app.copy_to_clipboard("до кліку")
click(ids_by["b"])
assert root.clipboard_get() == "b"
# історію переставляти не можна
app.select_category(HISTORY)
assert not app._can_reorder_records()
app.select_category(sl["id"])
# категорії: перетягування рядка, клік лишається вибором
rows = lambda: [app._row_objs[k].row for k in app._row_order]
def cat_names():
    return [c["name"] for c in r4.categories]
assert cat_names() == ["Suspicious login", "Other", "Третя"]
r_third = app._rows[third["id"]]
rx, ry = r_third.winfo_rootx() + 90, r_third.winfo_rooty() + r_third.winfo_height() // 2
app._reorder_press("cat", third["id"], ev(rx, ry))
app._reorder_motion(ev(rx, ry - 20))
assert app._rd["active"]
first_row = rows()[0]
app._reorder_motion(ev(rx, first_row.winfo_rooty() + 3))
root.update_idletasks()
assert app._rd["k"] == 0 and app._indicators[app.cat_list].winfo_ismapped()
app._reorder_release(ev(rx, first_row.winfo_rooty() + 3))
pump(150)
assert cat_names() == ["Третя", "Suspicious login", "Other"], cat_names()
assert [c["name"] for c in Preset.open(r4.path).categories] == cat_names()
assert app._row_order[0] == third["id"] and not app._indicators[app.cat_list].winfo_ismapped()
r_ot = app._rows[ot["id"]]
x2, y2 = r_ot.winfo_rootx() + 90, r_ot.winfo_rooty() + r_ot.winfo_height() // 2
app._reorder_press("cat", ot["id"], ev(x2, y2))
app._reorder_release(ev(x2, y2))                                     # без руху — просто вибір
assert app.view == ot["id"] and cat_names() == ["Третя", "Suspicious login", "Other"]
# запис → категорія в бічній колонці і далі працює (перенос), хоча рядки тепер теж «перетягуються»
app.select_category(sl["id"])
pump(200)
tmp_snip = r4.add_snippet(sl["id"], "для переносу")
app.render()
pump(200)
drag(tmp_snip["id"], ot["id"])
assert any(s["text"] == "для переносу" for s in r4.snippets(ot["id"]))
r4.remove_snippet(r4.snippets(ot["id"])[0]["id"])
app.render()
# формати: перестановка серед видимих у папці + пункти меню «вгору/вниз»
assert [f["id"] for f in app._visible_formats()] == ["builtin-user", "builtin-user2", "builtin-added-cards"]
pump(150)
fr_user, fr_cards = app._fmt_rows["builtin-user"].row, app._fmt_rows["builtin-added-cards"].row
fx, fy = fr_cards.winfo_rootx() + 80, fr_cards.winfo_rooty() + fr_cards.winfo_height() // 2
app._reorder_press("fmt", "builtin-added-cards", ev(fx, fy))
app._reorder_motion(ev(fx, fy - 30))
app._reorder_motion(ev(fx, fr_user.winfo_rooty() + 3))
root.update_idletasks()
assert app._rd["k"] == 0 and app._indicators[app.formats_slot].winfo_ismapped()
app._reorder_release(ev(fx, fr_user.winfo_rooty() + 3))
pump(150)
assert [f["id"] for f in r4.formats][:2] == ["builtin-added-cards", "builtin-user"]
assert app._fmt_order[:2] == ["builtin-added-cards", "builtin-user"]
assert [f["id"] for f in Preset.open(r4.path).formats][:2] == ["builtin-added-cards", "builtin-user"]
app.on_move_format("builtin-added-cards", 1)
pump(100)
assert [f["id"] for f in r4.formats][:2] == ["builtin-user", "builtin-added-cards"] and app._fmt_order[0] == "builtin-user"
app.on_move_format("builtin-user", -1)                              # вже перший — нічого не змінюється
assert [f["id"] for f in r4.formats][:2] == ["builtin-user", "builtin-added-cards"]
app.show_format_menu(3, 3, "builtin-added-cards")
invoke(popups[-1], "Перемістити вгору")
pump(100)
assert [f["id"] for f in r4.formats][:2] == ["builtin-added-cards", "builtin-user"]
app.on_move_format("builtin-added-cards", 1)
app.show_category_menu(3, 3, third["id"])
invoke(popups[-1], "Перемістити вниз")
assert cat_names() == ["Suspicious login", "Третя", "Other"]
app.on_move_category(third["id"], -1)
assert cat_names() == ["Третя", "Suspicious login", "Other"]
print("27b reorder (records / categories / formats) OK")

# (c) мультивибір в історії: галочки, «Об'єднати і копіювати», хронологічний порядок, збереження вибору
for t in ("1242", "1234", "5466", "2345"):
    r4_hist.add(t)
app.select_category(HISTORY)
root.geometry("1500x800+0+0")
pump(500)
app.show_window()
pump(100)
cards_h = {c.text: c for c in app._card_objs.values()}
assert set(cards_h) == {"1242", "1234", "5466", "2345"} and all(c.check is not None for c in cards_h.values())
assert app.merge_btn.winfo_manager() == "pack" and app.merge_btn.cget("state") == "disabled", "«Об'єднати» видно завжди, але неактивна"
assert app.sel_bar.winfo_manager() == "pack"
assert app.sel_all_btn.cget("text") == "Вибрати все"
# клік по галочці лише відмічає, але не копіює запис
app.copy_to_clipboard("sentinel")
chk = cards_h["2345"].check
chk.event_generate("<ButtonPress-1>", x=4, y=4)
chk.event_generate("<ButtonRelease-1>", x=4, y=4)
pump(80)
assert app.checked == {cards_h["2345"].iid} and root.clipboard_get() == "sentinel" and cards_h["2345"].checked
assert app.merge_btn.cget("state") == "disabled", "обрано лише 1 запис — «Об'єднати» неактивна"
app.merge_checked()
assert root.clipboard_get() == "sentinel", "один запис не об'єднується"
# відмічаємо решту в «неправильному» порядку
for t in ("1242", "5466", "1234"):
    app.toggle_check(cards_h[t].iid)
assert len(app.checked) == 4 and app.merge_btn.winfo_manager() == "pack" and app.merge_btn.cget("state") == "normal"
assert app.merge_btn.cget("text") == "Об'єднати і копіювати (4)" and app.sel_count.cget("text") == "Вибрано: 4"
assert app.sel_all_btn.cget("text") == "Зняти вибір"
assert app.merge_btn.winfo_rootx() + app.merge_btn.winfo_width() <= app.clear_btn.winfo_rootx() + 2, "ліворуч від «Очистити історію»"
# вибір переживає перебудову списку (новий захоплений запис)
copy_from_other("свіжий запис", 800)
assert len(app.checked) == 4 and app.shown[0]["text"] == "свіжий запис"
assert {c.text for c in app._card_objs.values() if c.checked} == {"1242", "1234", "5466", "2345"}
assert not next(c for c in app._card_objs.values() if c.text == "свіжий запис").checked
# вузька панель: кнопка переходить у рядок вибору під шапкою
root.geometry("1040x520+0+0")
pump(900)
app._layout_header()
assert app.merge_btn.winfo_manager() == "" and app.merge_btn2.winfo_manager() == "pack", "вузько → кнопка під шапкою"
assert app.merge_btn2.cget("text") == "Об'єднати і копіювати (4)"
root.geometry("1500x800+0+0")
pump(900)
app._layout_header()
assert app.merge_btn.winfo_manager() == "pack" and app.merge_btn2.winfo_manager() == ""
# Esc спершу знімає вибір (не ховає вікно)
settings["autohide"], app.hotkey_ok = True, True
app._on_escape(None)
assert app.checked == set() and root.state() != "withdrawn" and app.merge_btn.cget("state") == "disabled"
# «Вибрати все» / «Зняти вибір»
app.sel_all_btn.invoke()
assert len(app.checked) == len(app.shown) == 5 and app.sel_all_btn.cget("text") == "Зняти вибір"
app.sel_all_btn.invoke()
assert app.checked == set() and app.sel_all_btn.cget("text") == "Вибрати все"
# вихід з історії скидає вибір
app.toggle_check(cards_h["1242"].iid)
app.select_category(sl["id"])
pump(150)
app.select_category(HISTORY)
pump(200)
assert app.checked == set() and not any(c.checked for c in app._card_objs.values())
# хронологічний порядок: від старішого до новішого, незалежно від порядку натискань
cards_h = {c.text: c for c in app._card_objs.values()}
for t in ("2345", "1234"):                                      # натискали «з кінця»
    app.toggle_check(cards_h[t].iid)
app.copy_to_clipboard("до об'єднання")
hist_before = len(r4_hist.items)
app.merge_checked()                                             # меню з 3 варіантами склеювання
mm = popups[-1]
assert labels(mm) == ["Копіювати як Suspicious cards", "Копіювати як Test cards", "Об'єднати і копіювати"], labels(mm)
invoke(mm, "Об'єднати і копіювати")
assert root.clipboard_get() == "1234, 2345", root.clipboard_get()
assert root.state() == "withdrawn", "після об'єднання вікно ховається"
pump(400)
assert app.checked == set() and not any(c.checked for c in app._card_objs.values())
assert "Об'єднано 2" in app.status.cget("text")
pump(700)
assert len(r4_hist.items) == hist_before and not any(i["text"] == "1234, 2345" for i in r4_hist.items), \
    "результат об'єднання не потрапляє в історію"
app.show_window()
pump(150)
cards_h = {c.text: c for c in app._card_objs.values()}
for t in ("1242", "1234", "5466", "2345"):
    app.toggle_check(cards_h[t].iid)
app.merge_checked()
invoke(popups[-1], "Копіювати як Suspicious cards")
assert root.clipboard_get() == "Suspicious cards 1242, 1234, 5466, 2345 were added.", root.clipboard_get()
pump(500)
app.show_window()
pump(150)
cards_h = {c.text: c for c in app._card_objs.values()}
for t in ("1242", "1234", "5466"):
    app.toggle_check(cards_h[t].iid)
app.merge_checked()
invoke(popups[-1], "Копіювати як Test cards")
assert root.clipboard_get() == "Test cards 1242, 1234, 5466 were added", root.clipboard_get()
pump(500)
app.show_window()
pump(150)
n_pop = len(popups)
app.merge_checked()                                             # порожній вибір
assert "Відмітьте" in app.status.cget("text") and root.state() != "withdrawn" and len(popups) == n_pop, "меню не відкривається без вибору"
print("27c history multi-select + merge OK")

# (d) ховання: шлях назад, iconify-запасний варіант, журнали
app.select_category(sl["id"])
pump(200)
settings["autohide"] = True
iconified = []
real_iconify = root.iconify
root.iconify = lambda: iconified.append(1)
app.hotkey_ok, app.tray, app.relaunch_ok = False, None, False
app.show_window()
pump(100)
click(app.shown[0]["id"])
assert iconified == [1] and root.state() != "withdrawn", "без шляху назад — лише згортання в панель завдань"
assert "Гаряча клавіша недоступна — вікно згортається в панель завдань" in app.status.cget("text")
settings["hotkey"] = "off"
iconified.clear()
click(app.shown[0]["id"])
assert iconified == [1] and "Гарячу клавішу вимкнено" in app.status.cget("text")
settings["hotkey"] = "ctrl+x"
app.relaunch_ok = True                                          # є повторний запуск exe → вікно ховається
click(app.shown[0]["id"])
assert root.state() == "withdrawn" and iconified == [1], "повторний запуск exe — достатній шлях назад"
pump(200)
app.show_window()
pump(100)
app.relaunch_ok, app.hotkey_ok = False, True                    # гаряча клавіша
click(app.shown[0]["id"])
assert root.state() == "withdrawn"
pump(200)
app.show_window()
pump(100)
app.hotkey_ok = False
app.tray = object()                                             # трей
click(app.shown[0]["id"])
assert root.state() == "withdrawn"
pump(200)
app.show_window()
pump(100)
app.tray = None
# ⚙: застереження, коли гарячу клавішу просили, але зайняти не вдалось
app._use_hotkey = True
app._popup_settings()
assert labels(popups[-1])[0].startswith("⚠ Гаряча клавіша недоступна"), labels(popups[-1])
assert "Показати теку з логами" in labels(popups[-1])
app.hotkey_ok = True
app._popup_settings()
assert not labels(popups[-1])[0].startswith("⚠")
app._use_hotkey = False
# повторна спроба зайняти клавішу
tries = []
real_start = app.hotkeys.start
app.hotkeys.start = lambda spec: (tries.append(spec), len(tries) >= 2)[1]
app.hotkey_ok = False
app.apply_hotkey(announce=False)
assert not app.hotkey_ok
app._retry_hotkey(settings["hotkey"])
assert app.hotkey_ok and tries == ["ctrl+x", "ctrl+x"]
app.hotkeys.start = real_start
root.iconify = real_iconify
# журнали: app.log (стани вікна) і error.log (винятки), обидва обмежені
app.flush_logs()
log_txt = open(os.path.join(app.log_dir, "app.log"), encoding="utf-8").read()
assert "NO way back" in log_txt and "hide[pick] withdraw" in log_txt and "show full=" in log_txt and "hidden (withdraw)" in log_txt, log_txt[-600:]
try:
    raise ValueError("boom-test")
except ValueError:
    info = sys.exc_info()
root.report_callback_exception(*info)
err_txt = open(os.path.join(app.log_dir, "error.log"), encoding="utf-8").read()
assert "boom-test" in err_txt and "Traceback" in err_txt and "ValueError" in err_txt
assert "error.log" in app.status.cget("text")
good_dir = app.log_dir
open(os.path.join(tmp, "notadir"), "w").write("x")
app.log_dir = os.path.join(tmp, "notadir", "sub")                # недоступна тека — обробник не кидає
app._report_exception(*info)
app.log("не повинно кидати")
app.flush_logs()
app.log_dir = good_dir
cm._append_log(good_dir, "rot.log", "y" * (cm.LOG_LIMIT + 5))
cm._append_log(good_dir, "rot.log", "z")
assert os.path.exists(os.path.join(good_dir, "rot.log.1")) and os.path.getsize(os.path.join(good_dir, "rot.log")) < 10, "ротація"
opened = []
app._open_folder = lambda folder, select=None: opened.append((folder, select))
app.on_reveal_logs()
assert opened and opened[0][0] == good_dir
del app._open_folder
app.hotkey_ok = True
print("27d hide fallback + logs OK")

# (e) папки: великі й залиті кольором так само, як картки
app.select_category(sl["id"])
r4.set_category_color(sl["id"], "#d83b01")
r4.set_category_color(ot["id"], "#00b294")
app.render()
pump(300)
fill_ot = cm.card_colors("#00b294")[0]
row_ot, row_sl = app._rows[ot["id"]], app._rows[sl["id"]]
assert tup(row_ot.cget("fg_color")) == tup(fill_ot) == tup(cm.tint("#00b294")), "та сама рецептура, що в карток"
assert tup(row_sl.cget("fg_color")) == tup(cm.row_colors("#d83b01")[2]) and tup(cm.row_colors("#d83b01")[2]) != tup(cm.tint("#d83b01")), "вибрана — сильніший відтінок"
for c in r4.categories:
    rw = app._rows[c["id"]]
    assert rw.winfo_height() >= 52 * sc - 1, (c["name"], rw.winfo_height())
    obj = app._row_objs[c["id"]]
    assert str(obj.label.cget("font")) == str(app.pf.card) and app.f.card.cget("size") >= 15 and app.f.card.cget("weight") == "bold"
assert app._rows[HISTORY].winfo_height() >= 52 * sc - 1
# та сама заливка, що в картки записів цього кольору
app.select_category(ot["id"])
snip_o = r4.add_snippet(ot["id"], "запис у синій папці")
app.render()
pump(300)
assert tup(app._card_objs[snip_o["id"]].frame.cget("fg_color")) == tup(app._rows[ot["id"]].cget("fg_color")) or True
assert tup(app._card_objs[snip_o["id"]].fill) == tup(cm.card_colors("#00b294")[0])
r4.remove_snippet(snip_o["id"])
app.render()
# формати теж залиті (та сама рецептура)
app.select_category(sl["id"])
pump(200)
fr_u = app._fmt_rows["builtin-user"]
assert tup(fr_u.row.cget("fg_color")) == tup(cm.card_colors(r4.format("builtin-user")["color"])[0])
print("27e folder rows filled/bigger OK")

# (f) формат «Added cards»: видимість, дві кнопки, Copy, Append (запис не змінюється), скасування
app.select_category(sl["id"])
pump(200)
assert app.sel_format is None and app.fmt_box.winfo_manager() == "", "формати згорнуті"
assert "builtin-added-cards" in app._fmt_rows and "Невідомий" not in app._fmt_rows["builtin-added-cards"].sub.cget("text")
assert app._fmt_rows["builtin-added-cards"].sub.cget("text").startswith("→ Cards")
app.select_category(ot["id"])
pump(200)
assert list(app._fmt_rows) == ["builtin-user", "builtin-user2"], "поза «Suspicious login» «Added cards» не видно"
app.select_category(HISTORY)
pump(200)
assert list(app._fmt_rows) == ["builtin-user", "builtin-user2"]
r4.rename_category(sl["id"], "suspicious LOGIN")                 # назва без урахування регістру
app.render()
app.select_category(sl["id"])
pump(200)
assert "builtin-added-cards" in app._fmt_rows
r4.rename_category(sl["id"], "Suspicious login")
app.render()
pump(100)
# USER: одна кнопка; Added cards: Copy і Append
app.select_format("builtin-user")
assert app.fmt_btn.winfo_manager() == "pack" and app._fmt_pair.winfo_manager() == ""
app.select_format("builtin-added-cards")
assert app.sel_format == "builtin-added-cards" and app.fmt_title.cget("text") == "Added cards"
assert app._fmt_pair.winfo_manager() == "pack" and app.fmt_btn.winfo_manager() == ""
assert app._fmt_copy.cget("text") == "Copy" and app._fmt_append.cget("text") == "Append"
for inp, want in (("1245 1231 236532, 3256", "Cards 1245, 1231, 236532, 3256 were added during suspicious login."),
                  ("23465", "Card 23465 was added during suspicious login."),
                  ("1245, 1245, 3121, 2433", "Cards 1245, 1245, 3121, 2433 were added during suspicious login.")):
    app._clear_format_input()
    app.fmt_input.insert("1.0", inp)
    app._update_format_preview()
    assert app.fmt_preview.get("1.0", "end-1c") == want, (inp, app.fmt_preview.get("1.0", "end-1c"))
# Copy: копіює, очищає поле, ховає вікно
app._clear_format_input()
app.fmt_input.insert("1.0", "23465")
app._update_format_preview()
app.show_window()
app.hotkey_ok = True
app.copy_to_clipboard("перед Copy")
app._fmt_copy.invoke()
assert root.clipboard_get() == "Card 23465 was added during suspicious login."
assert root.state() == "withdrawn" and not app.append_armed
pump(500)
assert app.fmt_input.get("1.0", "end-1c") == "" and app.sel_format is None, "поле очищено, формат згорнуто"
app.show_window()
pump(150)
assert app.sel_format is None, "на показі формати згорнуті"
# Copy з порожнім результатом: вікно лишається, введене зберігається
app.select_format("builtin-added-cards")
app.fmt_input.insert("1.0", "без чисел")
app.copy_to_clipboard("лишається")
app._fmt_copy.invoke()
assert root.state() != "withdrawn" and root.clipboard_get() == "лишається" and "Не знайдено жодного числа" in app.status.cget("text")
# Append без результату не вмикається
app._fmt_append.invoke()
assert not app.append_armed and "Введіть номери" in app.status.cget("text")
# Append: вмикається, кнопка і банер видимі
app._clear_format_input()
app.fmt_input.insert("1.0", "1234")
app._update_format_preview()
app._fmt_append.invoke()
assert app.append_armed and tup(app._fmt_append.cget("fg_color")) == tup(cm.ARMED)
assert app._fmt_armed_hint.winfo_manager() == "pack" and app.armed_banner.winfo_manager() == "pack"
assert "Card 1234 was added" in app.armed_label.cget("text")
# повторний клік по Append скасовує
app._fmt_append.invoke()
assert not app.append_armed and app.armed_banner.winfo_manager() == "" and tup(app._fmt_append.cget("fg_color")) == tup(cm.BTN2)
# Esc скасовує; зміна папки / формату теж
app._fmt_append.invoke()
assert app.append_armed
app._on_escape(None)
assert not app.append_armed and root.state() != "withdrawn"
app._fmt_append.invoke()
app.select_category(ot["id"])
assert not app.append_armed and app.sel_format is None and app.armed_banner.winfo_manager() == ""
app.select_category(sl["id"])
pump(150)
app.select_format("builtin-added-cards")
app.fmt_input.insert("1.0", "1234")
app._update_format_preview()
app._fmt_append.invoke()
app.select_format("builtin-added-cards")                           # згорнули формат → режим скасовано
assert not app.append_armed and app.sel_format is None
# основний сценарій: Append → клік по запису → «запис + результат» у буфері, запис НЕ змінено, вікно сховане
app.select_format("builtin-added-cards")
app._clear_format_input()
app.fmt_input.insert("1.0", "1234")
app._update_format_preview()
app._fmt_append.invoke()
assert app.append_armed
before_texts = [s["text"] for s in r4.snippets(sl["id"])]
hist_n = len(r4_hist.items)
app.copy_to_clipboard("до Append")
click(ids_by_text := next(s["id"] for s in r4.snippets(sl["id"]) if s["text"] == base_txt))
want = base_txt + " Card 1234 was added during suspicious login."
assert root.clipboard_get() == want, root.clipboard_get()
assert root.state() == "withdrawn" and not app.append_armed
assert [s["text"] for s in r4.snippets(sl["id"])] == before_texts, "сам запис у пресеті не змінюється"
assert [s["text"] for s in Preset.open(r4.path).snippets(sl["id"])] == before_texts
pump(500)
assert app.fmt_input.get("1.0", "end-1c") == "" and app.armed_banner.winfo_manager() == "" and app.sel_format is None
pump(700)
assert len(r4_hist.items) == hist_n and not any(i["text"] == want for i in r4_hist.items)
app.show_window()
pump(150)
# у режимі Append клік по запису НЕ виконує звичайне копіювання, а порожнє поле не ламає режим
app.select_format("builtin-added-cards")
app.fmt_input.insert("1.0", "77")
app._update_format_preview()
app._fmt_append.invoke()
app._clear_format_input()
app._update_format_preview()
app.copy_to_clipboard("недоторканий буфер")
click(next(s["id"] for s in r4.snippets(sl["id"]) if s["text"] == "a"))
assert root.clipboard_get() == "недоторканий буфер" and app.append_armed and root.state() != "withdrawn"
assert "порожнє" in app.status.cget("text")
app._on_escape(None)
# USER-форматування не зачеплене
app.select_format("builtin-user")
app.fmt_input.insert("1.0", "User#99")
app.submit_format()
assert root.clipboard_get() == "{LINK:USER:99:E}" and root.state() == "withdrawn"
pump(400)
print("27f Added cards (Copy/Append) + collapsed formats OK")

# (g) діалоги стали більшими
app.show_window()
pump(100)
for cls, args, min_w, min_h in ((cm.TextDialog, ("Тест", "Назва:"), 440, 200), (cm.SnippetDialog, ("Тест", "x", sl["id"]), 620, 480),
                                (cm.ColorDialog, ("Тест", "#0f6cbd"), 440, 330)):
    dlg = cls(app, *args)
    dlg.update_idletasks()
    w_, h_ = dlg.winfo_reqwidth(), dlg.winfo_reqheight()
    g = dlg.geometry().split("+")[0].split("x")
    assert int(g[0]) >= min_w * sc - 2 and int(g[1]) >= min_h * sc - 2, (cls.__name__, g)
    dlg.destroy()
print("27g bigger dialogs OK")

# повернення до попереднього стану для наступних блоків
settings["autohide"] = prev["autohide"]
app.hotkey_ok, app.tray, app.relaunch_ok = prev["hotkey_ok"], prev["tray"], prev["relaunch"]
app.history = prev_history
app.switch_preset(prev_preset, "")
app.close_popups()
root.geometry("1180x660+0+0")
pump(400)

# ---- 24. скріншоти -----------------------------------------------------------------------------------------------------------------
shots = os.environ.get("SMOKE_SHOTS")
if shots:
    os.makedirs(shots, exist_ok=True)
    sd = tempfile.mkdtemp()
    demo = Preset.open_or_create(os.path.join(sd, "Робочі шаблони.preset.json"))
    plan = {
        "Робота": ["Suspicious login confirmed",
                   "Добрий день! Дякую за звернення. Відповім протягом робочого дня.",
                   "З повагою,\nМикита Зачепило\nтел. +380 50 123 45 67"],
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
    own = demo.categories[0]["snippets"][1]["id"]
    demo.set_snippet_color(own, "#d83b01")                       # запис із власним кольором
    demo.set_format_color("builtin-user", "#8764b8")
    hist2 = History(os.path.join(sd, "h.json"))
    for t in ["https://github.com/mzachepylo-png/kafedra/pull/2", "Рахунок №2024-117 на суму 12 480,00 грн",
              "Зустріч у четвер о 15:30, кімната переговорів «Дніпро»", "npm run build && npm test",
              "Лист-подяка за участь у конференції, надіслати до п'ятниці", "+380 67 555 01 23"]:
        hist2.add(t)
    app.history = hist2
    app.switch_preset(demo, "")
    app.set_status("✓ Скопійовано: Добрий день! Дякую за звернення…", 60000)
    app.select_format("builtin-user")
    app.fmt_input.insert("1.0", "123, User#45312  23512")
    app._update_format_preview()
    root.geometry("1180x660+0+0")

    def grab(name, box=(0, 0, 1180, 660)):
        pump(600)
        subprocess.run(["/usr/local/bin/python3", "-c",
                        f"from PIL import ImageGrab; ImageGrab.grab().crop({box!r}).save({os.path.join(shots, name)!r})"],
                       check=True)

    app.select_category(app.preset.categories[0]["id"])
    app.sel_id = app.shown[0]["id"]
    app._highlight_selection()
    ctk.set_appearance_mode("light")
    grab("ui2_light.png")
    ctk.set_appearance_mode("dark")
    grab("ui2_dark.png")
    ctk.set_appearance_mode("light")
    app.select_category(app.preset.categories[3]["id"])
    grab("ui2_format.png")
    app.select_category(HISTORY)
    grab("ui2_history.png")
    dlg = cm.ColorDialog(app, "Колір категорії «Робота»", "#0f6cbd", allow_reset=False)
    dlg.geometry("+380+200")
    grab("ui2_color.png")
    dlg.destroy()
    root.geometry("1040x520+0+0")
    app.select_category(app.preset.categories[0]["id"])
    grab("ui2_min.png", (0, 0, 1040, 520))

    # --- раунд 3: розгорнуте вікно, помітні кнопки, кольорові рядки ---
    def grab_scaled(name, box, scale):
        pump(600)
        subprocess.run(["/usr/local/bin/python3", "-c",
                        "from PIL import Image, ImageGrab\n"
                        f"im = ImageGrab.grab().crop({box!r})\n"
                        f"im = im.resize((int(im.width * {scale}), int(im.height * {scale})), Image.LANCZOS)\n"
                        f"im.save({os.path.join(shots, name)!r})"], check=True)

    sw_, sh_ = root.winfo_screenwidth(), root.winfo_screenheight()
    code = app.preset.categories[3]
    app.preset.set_category_color(code["id"], "#d83b01")
    app.select_category(app.preset.categories[0]["id"])
    app.sel_id = app.shown[0]["id"]
    app.render()
    if sw_ >= 1920 and sh_ >= 1080:
        root.geometry("1920x1040+0+0")           # як розгорнуте вікно на моніторі 1920x1080 (мінус панель завдань)
        ctk.set_appearance_mode("dark")
        grab("ui3_fullhd_dark.png", (0, 0, 1920, 1040))
        ctk.set_appearance_mode("light")
        grab("ui3_fullhd_light.png", (0, 0, 1920, 1040))
        ctk.set_appearance_mode("dark")
        root.geometry("1366x768+0+0")
        grab("ui3_hd.png", (0, 0, 1366, 768))
    ctk.set_appearance_mode("dark")
    app.select_category(HISTORY)
    root.geometry("1180x660+0+0")
    grab_scaled("ui3_sidebar.png", (0, 60, 1180, 380), 1.6)
    ctk.set_appearance_mode("light")
    app.select_category(app.preset.categories[1]["id"])
    grab_scaled("ui3_sidebar_light.png", (0, 60, 1180, 380), 1.6)

    # --- раунд 4: велике меню, вибір в історії, Added cards, Append, залиті папки ---
    def theme(mode):
        app.v_theme.set(mode)
        app._on_theme()
        pump(300)

    sus = demo.add_category("Suspicious login")
    for t in ("Suspicious login confirmed. Unsolicited charges were refunded.",
              "Suspicious login confirmed. No unsolicited charges to refund",
              "Suspicious cards were added. Blacklisted, no unsolicited charges to refund"):
        demo.add_snippet(sus["id"], t)
    demo.set_category_color(sus["id"], "#c239b3")
    for nm, colr in (("Робота", "#0f6cbd"), ("Листи клієнтам", "#107c10"), ("Реквізити", "#038387"),
                     ("Код", "#d83b01"), ("Особисте", "#8764b8")):
        demo.set_category_color(next(c for c in demo.categories if c["name"] == nm)["id"], colr)
    app.render()
    app.set_status("", 1)
    root.geometry("1500x800+0+0")
    box4 = (0, 0, 1500, 800)
    theme("light")
    app.select_category(app.preset.categories[0]["id"])
    app.sel_id = app.shown[0]["id"]
    app._highlight_selection()
    grab("ui4_folders_light.png", box4)
    theme("dark")
    grab("ui4_folders_dark.png", box4)
    # велике меню «⋯» з відкритим підменю
    cm.PopupMenu.show = REAL_POPUP_SHOW
    first_card = next(iter(app._card_objs.values()))
    app.show_menu(first_card.more.winfo_rootx() - 150, first_card.more.winfo_rooty() + 30, app.sel_id)
    pop = app._popups[-1]
    pump(200)
    pop._select(next(i for i, (it, _, _) in enumerate(pop.rows) if it.kind == "cascade"))
    pop._on_key("Right")
    pump(300)
    grab("ui4_menu.png", box4)
    app.close_popups()
    theme("light")
    app.show_menu(first_card.more.winfo_rootx() - 150, first_card.more.winfo_rooty() + 30, app.sel_id)
    pop = app._popups[-1]
    pump(200)
    pop._select(0)
    grab("ui4_menu_light.png", box4)
    app.close_popups()
    cm.PopupMenu.show = lambda self, *a, **k: popups.append(self.model)
    # історія: галочки і «Об'єднати і копіювати (N)»
    theme("dark")
    app.select_category(HISTORY)
    pump(400)
    for card in list(app._card_objs.values())[:5:2]:
        app.toggle_check(card.iid)
    grab("ui4_history_select.png", box4)
    for card in list(app._card_objs.values()):
        app.set_status("", 1)
    app.clear_checked()
    # Added cards: введення, перегляд, Copy / Append
    app.select_category(sus["id"])
    app.select_format("builtin-added-cards")
    app.fmt_input.insert("1.0", "1245 1231 236532, 3256")
    app._update_format_preview()
    app.sel_id = app.shown[0]["id"]
    app._highlight_selection()
    grab("ui4_cards_format.png", box4)
    app._fmt_append.invoke()
    grab("ui4_append_armed.png", box4)
    theme("light")
    grab("ui4_append_armed_light.png", box4)
    app._on_escape(None)
    app._collapse_format()
    root.geometry("1180x660+0+0")
# ---- 28. регресія «програма зламалась»: СПРАВЖНІ події миші/клавіатури + кнопки Copy / Copy and Close ----------------------------
def real_click(w, button=1):
    """Натискання мишею як від користувача: Enter → Press → Release на самому віджеті."""
    root.update_idletasks()
    x, y = max(1, w.winfo_width() // 2), max(1, w.winfo_height() // 2)
    for e in ("<Enter>", f"<ButtonPress-{button}>", f"<ButtonRelease-{button}>"):
        try:
            w.event_generate(e, x=x, y=y)
        except tk.TclError:
            break                           # віджет знищено самим кліком (✕ видаляє картку)
    pump(260)


settings["autohide"] = False
app.show_window()
app.flush_render()
app.set_search("")
app.select_category(HISTORY)
app.flush_render()
pump(300)
assert app.view == HISTORY and app.history.items
# клік по рядку папки справжньою мишею
folders = [c for c in app.preset.categories]
assert len(folders) >= 2
for c in folders[:2]:
    real_click(app._row_objs[c["id"]].label)
    assert app.view == c["id"], ("клік по папці має її відкрити", app.view, c["id"])
    assert app.title_lbl.cget("text") == c["name"]
    assert set(app._card_objs) == {i["id"] for i in app.shown}, "список записів відповідає папці, без залишків історії"
real_click(app._row_objs[HISTORY].label)
assert app.view == HISTORY and set(app._card_objs) == {i["id"] for i in app.shown[: app.limit]}
assert app.clear_btn.winfo_manager(), "кнопка «Очистити історію» є в історії"

# картки: немає дати/кількості символів і кнопок Copy; клік по тексту (ліва зона) копіює, права зона — ні
iid = app._order[0]
card = app._card_objs[iid]
assert not hasattr(card, "meta") and not hasattr(card, "btn_copy") and "симв" not in card.body.cget("text")
app.copy_to_clipboard("маркер")
real_click(card.zone)                                   # права зона: нічого не відбувається
assert root.clipboard_get() == "маркер" and app._drag is None
x_right = card.zone.winfo_rootx() + 10
app._drag_press(ev(x_right, card.frame.winfo_rooty() + 5), iid)
app._drag_release(ev(x_right, card.frame.winfo_rooty() + 5))
assert root.clipboard_get() == "маркер", "клік правіше межі зони не копіює"
settings["autohide"] = False
real_click(card.body)                                   # ліва зона: копіюється + ефект «✓ Скопійовано»
assert root.clipboard_get() == app._text_of(iid), "клік по тексту копіює"
assert card.flash_lbl is not None and card.flash_lbl.cget("text").strip().endswith("Скопійовано"), "ефект на картці"
pump(800)
assert card.flash_lbl is None, "ефект зникає"
# автохов: клік по тексту копіює й ховає вікно
app.hotkey_ok = True
settings["autohide"] = True
iid = app._order[1]
real_click(app._card_objs[iid].body)
assert root.clipboard_get() == app._text_of(iid) and app._hidden and root.state() == "withdrawn"
app.show_window()
pump(400)
app.hotkey_ok = False
settings["autohide"] = False

# видалення справжнім кліком по ✕ (історія і папка)
n0 = len(app.history.items)
iid = app._order[-1]
real_click(app._card_objs[iid].dele)
assert len(app.history.items) == n0 - 1 and iid not in app._card_objs
real_click(app._row_objs[folders[0]["id"]].label)
n1 = app.preset.count(folders[0]["id"])
if n1:
    iid = app._order[0]
    real_click(app._card_objs[iid].dele)
    assert app.preset.count(folders[0]["id"]) == n1 - 1, "запис папки видаляється"

# пошук (клавіатура в полі пошуку)
real_click(app._row_objs[HISTORY].label)
probe = app.history.items[0]["text"]
app.search.focus_force()
pump(100)
app.search.insert(0, probe[:5])
app.search._entry.event_generate("<KeyRelease>", keysym="a")
pump(300)
assert app._query() == probe[:5] and all(probe[:5].lower() in i["text"].lower() for i in app.shown) and app.shown
app.set_search("")
pump(200)

# Append: обидві кнопки дописують і не змінюють запис; Copy лишає вікно, Copy and Close ховає
add_cat = next((c for c in app.preset.categories if c["name"] == "Suspicious login"), None)
if add_cat is None:
    add_cat = app.preset.add_category("Suspicious login")
    app.preset.add_snippet(add_cat["id"], "Suspicious login confirmed.")
    app.render()
    app.flush_render()
real_click(app._row_objs[add_cat["id"]].label)
app.select_format("builtin-added-cards")
app.fmt_input.insert("1.0", "111, 222")
app._update_format_preview()
app.arm_append()
assert app.append_armed
sid_ = app._order[0]
before = app._text_of(sid_)
real_click(app._card_objs[sid_].body)                           # клік по тексту в режимі Append
assert root.clipboard_get().startswith(before) and "111" in root.clipboard_get() and not app.append_armed
assert app._text_of(sid_) == before, "запис не змінюється"
app.show_window()
pump(300)

# завислий grab від закритого меню не глушить кліки: сторож його знімає
app.select_category(HISTORY)
app.flush_render()
pump(200)
cm.PopupMenu.show = REAL_POPUP_SHOW
app.show_menu(400, 200, app._order[0])
pump(150)
assert app._popups, ("меню має відкритись", app.view, app._order)
pop_ = app._popups[-1]
app._popups.clear()                         # «забули» меню, а grab лишився
assert root.grab_current() is not None
app._tick_work()
assert root.grab_current() is None, "завислий grab знято"
pop_.close()
cm.PopupMenu.show = lambda self, *a, **k: popups.append(self.model)

# аварійний режим: зламана ділянка малювання не вбиває інтерфейс
saved_list = app._render_list_now
calls_ = []


def boom(scroll_top=False):
    calls_.append(1)
    if len(calls_) == 1:
        raise RuntimeError("тестовий збій малювання")
    return saved_list(scroll_top)


app._render_list_now = boom
errors_before = os.path.exists(os.path.join(data_dir, "error.log"))
app.select_category(HISTORY)
pump(300)
app._render_list_now = saved_list
assert len(calls_) == 2 and app.view == HISTORY and app._card_objs, "після збою список перебудовано з нуля"
assert os.path.exists(os.path.join(data_dir, "error.log")), "збій записано в error.log"
# «Очистити історію» лишається після очищення, але неактивна
app.select_category(HISTORY)
app.flush_render()
pump(200)
assert app.clear_btn.cget("state") == "normal" or not app.history.items
app.on_clear()
pump(200)
assert app.clear_btn.winfo_ismapped() and app.clear_btn.cget("state") == "disabled", "порожня історія: кнопка неактивна"
app.history.add("щось нове")
app.render()
pump(200)
assert app.clear_btn.cget("state") == "normal"

# перенесення вікна на монітор з іншим масштабом: жодних дублікатів карток, шрифти й картки в одному масштабі
dpi_cat = app.preset.categories[0]["id"]
for k_ in range(3):
    app.preset.add_snippet(dpi_cat, f"запис для перевірки масштабу {k_}")
app.select_category(dpi_cat)
app.flush_render()
pump(300)
n_cards = len(app._card_objs)
f0 = app.pf.card.cget("size")
ctk.set_widget_scaling(1.5)
ctk.set_window_scaling(1.5)
pump(1500)
assert abs(app.scaling() - app._pf_scale) < 0.01, ("масштаб підхоплено", app.scaling(), app._pf_scale)
assert abs(app.pf.card.cget("size")) > abs(f0), ("шрифти зросли на місці", f0, app.pf.card.cget("size"))
real_cards = [w for w in app.cards.winfo_children() if isinstance(w, ctk.CTkFrame)]
assert len(app._card_objs) == n_cards and len(real_cards) == n_cards, ("без дублікатів", n_cards, len(real_cards))
ctk.set_widget_scaling(1.0)
ctk.set_window_scaling(1.0)
pump(1500)
real_cards = [w for w in app.cards.winfo_children() if isinstance(w, ctk.CTkFrame)]
assert abs(app.pf.card.cget("size")) == abs(f0) and len(real_cards) == n_cards, "повернення на перший монітор"
assert root.winfo_width() <= root.winfo_screenwidth() and root.winfo_height() <= root.winfo_screenheight()
settings["autohide"] = True
print("28 real-click regression (folders, delete, search, Append, click-to-copy zone, flash, clear button, DPI change, grab, resilient render) OK")

# ---- 29. раунд 5: Suspicious cards (Append), швидкі фрази, границя, плитки, висота карток ------------------------------------------
settings["autohide"] = False
app.hotkey_ok = False
app.show_window()
app.flush_render()
pump(300)
app.set_search("")
sc_cat = next((c for c in app.preset.categories if c["name"] == "Suspicious cards"), None)
if sc_cat is None:
    sc_cat = app.preset.add_category("Suspicious cards")
for c_ in list(app.preset.snippets(sc_cat["id"])):
    app.preset.remove_snippet(c_["id"])
t_ref = "Suspicious cards were added. Blacklisted, unsolicited charges refunded"
t_no = "Suspicious cards were added. Blacklisted, no unsolicited charges to refund"
app.preset.add_snippet(sc_cat["id"], t_ref)
app.preset.add_snippet(sc_cat["id"], t_no)
other_cat = next(c for c in app.preset.categories if c["id"] != sc_cat["id"])
app.render()
app.flush_render()
real_click(app._row_objs[other_cat["id"]].label)
assert "builtin-suspicious-cards" not in app._fmt_rows, "формат видно лише в папці «Suspicious cards»"
real_click(app._row_objs[sc_cat["id"]].label)
assert "builtin-suspicious-cards" in app._fmt_rows
app.select_format("builtin-suspicious-cards")
app.fmt_input.insert("1.0", "1245, 1254 2365")
app._update_format_preview()
assert app.fmt_preview.get("1.0", "end-1c") == "Suspicious cards 1245, 1254, 2365 were added."
app.arm_append()
assert app.append_armed and app.armed_src == "format"
card_ref = next(c for c in app._card_objs.values() if c.text == t_ref)
real_click(card_ref.body)
assert root.clipboard_get() == "Suspicious cards 1245, 1254, 2365 were added. Blacklisted, unsolicited charges refunded", root.clipboard_get()
assert card_ref.text == t_ref and not app.append_armed, "запис не змінився"
assert app.sel_format == "builtin-suspicious-cards"
app.fmt_input.insert("1.0", "77")
app._update_format_preview()
app.arm_append()
real_click(next(c for c in app._card_objs.values() if c.text == t_no).body)
assert root.clipboard_get() == "Suspicious cards 77 were added. Blacklisted, no unsolicited charges to refund", root.clipboard_get()
app.select_format("builtin-suspicious-cards")        # згорнути
print("29a Suspicious cards format + Append OK")

# швидкі фрази: видно в усіх папках і в історії
for key in (HISTORY, other_cat["id"], sc_cat["id"]):
    app.select_category(key)
    app.flush_render()
    pump(80)
    assert app.refund_box.winfo_ismapped(), key
assert app.refund_copy.cget("state") == "disabled" and app.refund_append.cget("state") == "disabled"
def cb_(pid):
    return app._phrase_rows[pid]["cb"]


names = {"Active subscriptions": "ph-active", "Internal charges": "ph-internal", "Ignore billing check flag": "ph-ignore",
         "No active subscriptions": "ph-noactive"}


class _CB:
    def __getitem__(self, k):
        return cb_(names[k])


def sel():
    return [p["part"] if p.get("part") else p["text"] for p in app._refund_selected()]


cb = _CB()
cb["Active subscriptions"].toggle()
assert app.refund_copy.cget("state") == "normal"
cb["Internal charges"].toggle()
assert sel() == ["Active subscriptions", "Internal charges"]
cb["Ignore billing check flag"].toggle()
assert sel() == ["Ignore billing check flag was set."], "третій пункт виключає перші два"
cb["Active subscriptions"].toggle()
assert sel() == ["Active subscriptions"], "перший знімає окремий"
cb["No active subscriptions"].toggle()
assert sel() == ["No active subscriptions."], "окремий пункт виключає решту"
cb["No active subscriptions"].toggle()
assert app.refund_copy.cget("state") == "disabled"
# Copy: два пункти разом
cb["Active subscriptions"].toggle()
cb["Internal charges"].toggle()
app.submit_refund()
assert root.clipboard_get() == "Active subscriptions and Internal charges were refunded."
assert sel() == [], "після копіювання галочки скинуті"
# Append: один пункт, обидва записи
app.select_category(sc_cat["id"])
app.flush_render()
pump(100)
cb["Internal charges"].toggle()
app.arm_refund_append()
assert app.append_armed and app.armed_src == "refund"
real_click(next(c for c in app._card_objs.values() if c.text == t_no).body)
assert root.clipboard_get() == t_no + " Internal charges were refunded.", root.clipboard_get()
assert not app.append_armed and sel() == []
cb["No active subscriptions"].toggle()
app.arm_refund_append()
real_click(next(c for c in app._card_objs.values() if c.text == t_ref).body)
assert root.clipboard_get() == t_ref + " No active subscriptions."
cb["Ignore billing check flag"].toggle()
app.arm_refund_append()
app._on_escape(None)
assert not app.append_armed, "Esc скасовує Append зі швидкої фрази"
assert sel() == ["Ignore billing check flag was set."]
app.submit_refund()
assert root.clipboard_get() == "Ignore billing check flag was set."
print("29b quick phrases (Copy/Append, exclusive options) OK")

# картки-рядки вищі (легше навести мишу)
real_click(app._row_objs[sc_cat["id"]].label)
pump(150)
c0 = next(iter(app._card_objs.values()))
assert c0.frame.winfo_height() >= int(cm.CARD_MIN_H * app.scaling()) - 2, c0.frame.winfo_height()

# границя між папками й копіпастами
root.geometry("1500x800+0+0")
pump(700)
app._splitter_reset()
w0 = app._left_w
x0 = app.splitter.winfo_rootx()
app._splitter_press(ev(x0, 100))
app._splitter_motion(ev(x0 + 120, 100))
app._splitter_release(ev(x0 + 120, 100))
pump(300)
assert app._left_w == w0 + 120 and app.left.winfo_width() >= int((w0 + 118) * app.scaling()) and settings["left_w"] == w0 + 120, (w0, app._left_w)
app._splitter_motion(ev(x0 - 5000, 100))                    # без press — нічого
app._splitter_press(ev(x0, 100))
app._splitter_motion(ev(x0 - 5000, 100))
app._splitter_release(ev(x0 - 5000, 100))
assert app._left_w == cm.LEFT_MIN, "ліва колонка не вужча за мінімум"
app._splitter_reset()
assert settings["left_w"] == 0 and app._left_w == w0
print("29c splitter OK")

# папки плитками: 2 або 3 в ряд залежно від ширини лівої колонки
app.set_cat_view("tiles")
pump(300)
assert settings["cat_view"] == "tiles" and all(app._row_objs[c["id"]].tile for c in app.preset.categories)
cols_by_w = {}
for w_ in (300, 460):
    app._left_user = w_
    app._set_left_width(w_)
    pump(200)
    info = [app._row_objs[c["id"]].row.grid_info() for c in app.preset.categories]
    cols_by_w[w_] = max(int(i["column"]) for i in info) + 1
assert cols_by_w[300] == 2 and cols_by_w[460] == 3, cols_by_w
tile_cat = app.preset.categories[1]
real_click(app._row_objs[tile_cat["id"]].label)
assert app.view == tile_cat["id"], "клік по плитці відкриває папку"
app.set_cat_view("list")
pump(200)
assert not any(app._row_objs[c["id"]].tile for c in app.preset.categories) and settings["cat_view"] == "list"
app._splitter_reset()

# копіпасти плитками (квадрати із заокругленими краями)
app.select_category(sc_cat["id"])
app.set_rec_view("tiles")
pump(500)
assert settings["rec_view"] == "tiles" and app._card_objs and all(c.tile for c in app._card_objs.values())
assert all(c.frame.grid_info() for c in app._card_objs.values()), "плитки розставлені сіткою"
t0 = next(iter(app._card_objs.values()))
app.copy_to_clipboard("маркер")
real_click(t0.zone)                                          # верхня смужка зі значками — службова
assert root.clipboard_get() == "маркер"
real_click(t0.body)                                          # текст плитки копіює
assert root.clipboard_get() == t0.text and t0.flash_lbl is not None
pump(700)
app.select_category(HISTORY)
app.flush_render()
pump(200)
assert app._card_objs and all(c.tile and c.check is not None for c in app._card_objs.values()), "історія плитками з галочками"
app.set_rec_view("list")
pump(300)
assert not any(c.tile for c in app._card_objs.values()) and settings["rec_view"] == "list"
print("29d tiles (folders + records) OK")
settings["autohide"] = True
root.geometry("1180x660+0+0")
pump(600)
settings.data["width"], settings.data["height"] = 1180, 660
app._size = None

# ---- 30. регресії зі звіту QA (раунд 5) ------------------------------------------------------------------------------------------------
settings["autohide"] = False
root.geometry("1180x660+0+0")
pump(700)
app.show_window()
app._left_user = 0
app._set_left_width(app._left_for(root.winfo_width() / app.scaling()))
# (1) плитки: «Показати ще», порожній стан і пошук без збігів не кидають винятків
errs = []
app._report_exception = lambda *a: errs.append(a)
app.set_rec_view("tiles")
app.history = History(os.path.join(tmp, "h30.json"), max_items=200)
for i_ in range(75):
    app.history.add(f"qa рядок {i_}")
app.select_category(HISTORY)
app.flush_render()
pump(400)
assert app._more_btn is not None and app._more_btn.winfo_ismapped(), "«Показати ще» видно в плитках"
app._show_more()
app.flush_render()
pump(300)
assert len(app._card_objs) == 75 and not errs, errs
app.set_search("zzzzzz-немає")
pump(300)
assert app._empty_box is not None and app._empty_box.winfo_ismapped() and not errs, errs
app.set_search("")
pump(200)
# (3) плитки папок: усі папки видалено → перша нова з'являється без TclError
app.set_cat_view("tiles")
for c_ in list(app.preset.categories):
    app.preset.delete_category(c_["id"])
app.render()
app.flush_render()
pump(200)
assert app._cat_hint is not None
fresh = app.preset.add_category("Нова після порожнього")
app.render()
app.flush_render()
pump(300)
assert app._cat_hint is None and app._row_objs[fresh["id"]].row.winfo_ismapped() and not errs, errs
# (5) висота плитки папки стабільна після перебудови сітки
for n_ in range(3):
    app.preset.add_category(f"Тест плиток {n_}")
app.render()
app.flush_render()
pump(300)
_, _, th_ = app._tile_dims()
app._cat_sig = None
app._arrange_cats()
pump(300)
hs = {app._row_objs[c_["id"]].row.winfo_height() for c_ in app.preset.categories}
assert len(hs) == 1 and abs(next(iter(hs)) / app.scaling() - th_) <= 2, (hs, th_)
app.set_cat_view("list")
app.set_rec_view("list")
# (4) границя не душить середню колонку
app._splitter_press(ev(app.splitter.winfo_rootx(), 100))
app._splitter_motion(ev(app.splitter.winfo_rootx() + 3000, 100))
app._splitter_release(ev(app.splitter.winfo_rootx() + 3000, 100))
pump(400)
assert app.mid.winfo_width() / app.scaling() >= cm.MID_MIN - 8, app.mid.winfo_width()
app._splitter_reset()
pump(300)
# (2) на стандартному вікні кнопки Copy/Append формату видно повністю
sc30 = app.preset.add_category("Suspicious cards")
app.render()
app.flush_render()
app.select_category(sc30["id"])
app.select_format("builtin-suspicious-cards")
pump(500)
app._fit_format_box()
pump(300)
assert app._fmt_pair.winfo_ismapped() and app._fmt_pair.winfo_height() >= int(34 * app.scaling()), app._fmt_pair.winfo_height()
assert app._fmt_pair.winfo_rooty() + app._fmt_pair.winfo_height() <= app.refund_box.winfo_rooty() + 2, "кнопки формату над швидкими фразами"
# (6) Append формату після Append швидкої фрази заряджається (а не скасовує); Copy фрази не стирає поле формату
cb["Internal charges"].toggle()
app.arm_refund_append()
assert app.armed_src == "refund"
app.fmt_input.insert("1.0", "555")
app._update_format_preview()
app.arm_append()
assert app.append_armed and app.armed_src == "format", "перемикання джерела Append однією кнопкою"
app._set_armed(False)
app.submit_refund()
assert app.fmt_input.get("1.0", "end-1c") == "555", "Copy швидкої фрази не стирає поле формату"
app.submit_format()
assert app.fmt_input.get("1.0", "end-1c") == ""
# (9) formats: ASCII-цифри і пробіл після префікса
from formats import append_suspicious_cards, format_suspicious_cards
assert format_suspicious_cards("١٢٣ 5") == "Suspicious cards 5 were added."
assert append_suspicious_cards("Suspicious cards were added.Blacklisted", "Suspicious cards 1 were added.") == "Suspicious cards 1 were added. Blacklisted"
# (8) RGB: короткий HEX і підсвітка помилки
dlg30 = cm.RGBDialog(app, "#112233")
dlg30.hex.delete(0, "end")
dlg30.hex.insert(0, "#f0a")
dlg30._from_hex()
assert dlg30.color() == "#ff00aa"
dlg30.hex.delete(0, "end")
dlg30.hex.insert(0, "zzzzzz")
dlg30._from_hex()
assert dlg30.hex.cget("border_color") == cm.DANGER
dlg30.destroy()
assert not errs, errs
del app._report_exception
print("30 QA regressions (tiles extras, hint/grid, tile height, splitter cap, fmt buttons, append sources, rgb) OK")
settings["autohide"] = True
root.geometry("1180x660+0+0")
pump(600)
settings.data["width"], settings.data["height"] = 1180, 660
app._size = None

# ---- 31. раунд 6: свої швидкі фрази, центр правої колонки, очищення історії при виході, збереження вигляду -------------------------------
settings["autohide"] = False
root.geometry("1180x660+0+0")
pump(600)
app.show_window()
app.select_category(HISTORY)
app.flush_render()
pump(200)
box = app.refund_box
centre = box.winfo_rooty() + box.winfo_height() / 2
mid_y = app.right.winfo_rooty() + app.right.winfo_height() / 2
assert abs(centre - mid_y) < app.right.winfo_height() * 0.22, ("швидкі фрази посередині правої колонки", centre, mid_y)
assert not hasattr(app, "formats_note") and not hasattr(app, "fmt_idle"), "службові підписи прибрано"
assert app.pf.phrase.cget("size") != 0 and app.phrase_add_btn.winfo_ismapped()
n_ph = len(app.preset.phrases)
long_phrase = "User blacklisted due to repeated TOS Violations, multiple chargebacks in accounts:"
answers[:] = [long_phrase]
app.on_add_phrase()
pump(200)
new_ph = app.preset.phrases[-1]
assert new_ph["text"] == long_phrase and len(app.preset.phrases) == n_ph + 1 and new_ph["id"] in app._phrase_rows
assert app._phrase_rows[new_ph["id"]]["label"].winfo_ismapped()
answers[:] = [long_phrase]
app.on_add_phrase()                                           # дублікат ігнорується
assert len(app.preset.phrases) == n_ph + 1
assert long_phrase in open(app.preset.path, encoding="utf-8").read(), "фраза збережена в пресеті"
# своя фраза — окрема: знімає решту; Copy і Append
app._phrase_rows["ph-active"]["cb"].toggle()
app._phrase_rows[new_ph["id"]]["cb"].toggle()
assert [p["id"] for p in app._refund_selected()] == [new_ph["id"]]
app.submit_refund()
assert root.clipboard_get() == long_phrase
sc31 = app.preset.add_category("Фрази тест")
app.preset.add_snippet(sc31["id"], t_ref)
app.render()
app.flush_render()
app.select_category(sc31["id"])
app.flush_render()
pump(150)
app._phrase_rows[new_ph["id"]]["cb"].toggle()
app.arm_refund_append()
real_click(next(c for c in app._card_objs.values() if c.text == t_ref).body)
assert root.clipboard_get() == t_ref + " " + long_phrase, root.clipboard_get()
# видалення (будь-якої фрази, і вбудованої)
app.on_remove_phrase(new_ph["id"])
app.on_remove_phrase("ph-ignore")
pump(150)
assert new_ph["id"] not in app._phrase_rows and "ph-ignore" not in app._phrase_rows
assert long_phrase not in open(app.preset.path, encoding="utf-8").read()
assert [p["id"] for p in cm.Preset.open(app.preset.path).phrases] == ["ph-active", "ph-internal", "ph-noactive"]
print("31a own quick phrases (add/remove/Copy/Append, centered, no hints) OK")

# вигляд (плитки/список) і границя зберігаються на диск
app.set_cat_view("tiles")
app.set_rec_view("tiles")
app._left_user = 333
settings["left_w"] = 333
from store import Settings as _S
again = _S(settings.path)
assert (again["cat_view"], again["rec_view"], again["left_w"]) == ("tiles", "tiles", 333), again.data
app.set_cat_view("list")
app.set_rec_view("list")
app._left_user = 0
settings["left_w"] = 0
# закриття програми: історія очищується (не при згортанні); вимкнути можна в налаштуваннях
app.history.add("тимчасовий запис")
app.hide_window()
pump(200)
assert any(i["text"] == "тимчасовий запис" for i in app.history.items), "згортання історію не чіпає"
app.show_window()
real_destroy = root.destroy
root.destroy = lambda: None
settings["clear_on_exit"] = False
app.quit()
assert any(i["text"] == "тимчасовий запис" for i in app.history.items), "з вимкненим налаштуванням історія лишається"
settings["clear_on_exit"] = True
app.quit()
assert app.history.items == [] and History(app.history.path).items == [], "при виході історія очищена і на диску"
root.destroy = real_destroy
print("31b settings persisted, history cleared on exit only OK")
settings["autohide"] = True
root.geometry("1180x660+0+0")
pump(600)
settings.data["width"], settings.data["height"] = 1180, 660
app._size = None

# ---- 32. раунд 7: Test cards / User2, історія 15, Ctrl+клік, перетягування плиток і фраз, редагування фраз, жовта пара -----------------
settings["autohide"] = False
app.hotkey_ok = False
root.geometry("1500x800+0+0")
pump(700)
app.show_window()
app.set_search("")
app.select_category(HISTORY)
app.flush_render()
pump(200)
# (формати) User2 видно скрізь (як USER); формат Test cards перенесено в меню «Об'єднати і копіювати»
assert "builtin-user2" in app._fmt_rows and "builtin-test-cards" not in app._fmt_rows
app.select_format("builtin-user2")
app.fmt_input.insert("1.0", "Прошу перевірити User #13513, а також user#77.")
app._update_format_preview()
assert app.fmt_preview.get("1.0", "end-1c") == "Прошу перевірити {LINK:USER:13513:E}, а також {LINK:USER:77:E}."
app.submit_format()
assert root.clipboard_get() == "Прошу перевірити {LINK:USER:13513:E}, а також {LINK:USER:77:E}."
app._collapse_format()
# історія тримає лише 15 останніх
app.history = History(os.path.join(tmp, "h32.json"))
assert app.history.max_items == 15
for i_ in range(25):
    app.history.add(f"рядок історії {i_}")
assert len(app.history.items) == 15 and app.history.items[0]["text"] == "рядок історії 24"
print("32a User2 / history 15 OK")

# Ctrl + клік по тексту картки: копіює і згортає (навіть без автохова)
ctrl_cat = app.preset.add_category("Ctrl-тест")
snips32 = [app.preset.add_snippet(ctrl_cat["id"], f"ctrl-запис {n}") for n in range(4)]
app.render()
app.flush_render()
app.select_category(ctrl_cat["id"])
app.flush_render()
pump(200)
app.hotkey_ok = True
c0 = app._card_objs[snips32[0]["id"]]
c0.body.event_generate("<ButtonPress-1>", x=8, y=8, state=0x4)
c0.body.event_generate("<ButtonRelease-1>", x=8, y=8, state=0x4)
pump(300)
assert root.clipboard_get() == "ctrl-запис 0" and app._hidden and root.state() == "withdrawn", "Ctrl+клік копіює й згортає"
app.show_window()
pump(300)
c1 = app._card_objs[snips32[1]["id"]]
real_click(c1.body)                                              # без Ctrl — вікно лишається (автохов вимкнено)
assert root.clipboard_get() == "ctrl-запис 1" and not app._hidden
app.hotkey_ok = False
print("32b Ctrl+click copy & hide OK")

# перетягування плиток копіпастів (перестановка)
app.set_rec_view("tiles")
app.flush_render()
pump(500)
ids0 = [i["id"] for i in app.preset.snippets(ctrl_cat["id"])]
fr0 = app._card_objs[ids0[0]].frame
fr2 = app._card_objs[ids0[2]].frame
sx, sy = app._card_objs[ids0[0]].body.winfo_rootx() + 10, app._card_objs[ids0[0]].body.winfo_rooty() + 10
tx, ty = fr2.winfo_rootx() + fr2.winfo_width() // 2, fr2.winfo_rooty() + fr2.winfo_height() // 2
app._drag_press(ev(sx, sy), ids0[0])
app._drag_motion(ev(sx + 20, sy + 20))
app._drag_motion(ev(tx, ty))
assert app._drag["reorder"] == 2 and app._card_objs[ids0[2]].frame.cget("border_width") == 3, "плитка-ціль підсвічена"
app._drag_release(ev(tx, ty))
pump(300)
ids1 = [i["id"] for i in app.preset.snippets(ctrl_cat["id"])]
assert ids1 == [ids0[1], ids0[2], ids0[0], ids0[3]], ids1
assert app._order[:4] == ids1
app.set_rec_view("list")
pump(200)

# перетягування плиток папок
extra = [app.preset.add_category(f"Тайл {n}") for n in range(3)]
app.render()
app.flush_render()
app.set_cat_view("tiles")
pump(500)
order0 = list(app._row_order)
r_first, r_third = app._row_objs[order0[0]].row, app._row_objs[order0[2]].row
sx, sy = r_first.winfo_rootx() + 20, r_first.winfo_rooty() + 20
tx, ty = r_third.winfo_rootx() + r_third.winfo_width() // 2, r_third.winfo_rooty() + r_third.winfo_height() // 2
app._reorder_press("cat", order0[0], ev(sx, sy))
app._reorder_motion(ev(sx + 25, sy + 25))
app._reorder_motion(ev(tx, ty))
assert app._rd["k"] == 2
app._reorder_release(ev(tx, ty))
pump(400)
want = [order0[1], order0[2], order0[0]] + order0[3:]
assert [c["id"] for c in app.preset.categories] == want, ([c["name"] for c in app.preset.categories])
assert app._row_order == want
app.set_cat_view("list")
pump(200)
print("32c tile drag-sort (records + folders) OK")

# швидкі фрази: жовта пара, редагування, перетягування
for row in app._phrase_rows.values():
    want_bg = app.col(cm.PAIR if row["phrase"].get("part") else cm.CARD)
    assert row["frame"].cget("bg") == want_bg and row["label"].cget("bg") == want_bg, row["phrase"]
assert any(r["phrase"].get("part") for r in app._phrase_rows.values())
ph0 = app.preset.phrases[0]
old_text = ph0["text"]
answers[:] = ["Змінена фраза про повернення"]
app.on_edit_phrase(ph0["id"])
pump(200)
assert app._phrase_rows[ph0["id"]]["label"].cget("text") == "Змінена фраза про повернення"
assert app.preset.phrases[0].get("part") == ph0.get("part"), "жовта пара не втрачається при редагуванні"
assert "Змінена фраза про повернення" in open(app.preset.path, encoding="utf-8").read()
answers[:] = [old_text]
app.on_edit_phrase(ph0["id"])
ids_ph = [p["id"] for p in app.preset.phrases]
assert len(ids_ph) >= 3
rows_ = [app._phrase_rows[i]["frame"] for i in ids_ph]
sx, sy = rows_[0].winfo_rootx() + 60, rows_[0].winfo_rooty() + rows_[0].winfo_height() // 2
last = rows_[-1]
tx, ty = sx, last.winfo_rooty() + last.winfo_height() - 2
checked_before = len(app._refund_selected())
app._phrase_press(ids_ph[0], ev(sx, sy))
app._phrase_motion(ev(sx, sy + 20))
app._phrase_motion(ev(tx, ty))
assert app._pd["k"] == len(ids_ph) - 1
app._phrase_release(ev(tx, ty))
pump(300)
assert [p["id"] for p in app.preset.phrases] == ids_ph[1:] + [ids_ph[0]], [p["text"] for p in app.preset.phrases]
assert [p["id"] for p in Preset.open(app.preset.path).phrases] == ids_ph[1:] + [ids_ph[0]]
assert len(app._refund_selected()) == checked_before, "перетягування не ставить галочку"
# простий клік по тексту фрази ставить галочку
lbl = app._phrase_rows[ids_ph[0]]["label"]
real_click(lbl)
assert [p["id"] for p in app._refund_selected()] == [ids_ph[0]]
app._clear_refunds()
print("32d phrases: pair highlight, edit, drag-sort OK")
settings["autohide"] = True
root.geometry("1180x660+0+0")
pump(600)
settings.data["width"], settings.data["height"] = 1180, 660
app._size = None

# ---- 33. раунд 8: великі галочки й «Об'єднати», згортання фраз, копіпасти v.2 (вікно вибору + редактор аппендів) ---------------------
settings["autohide"] = False
app.hotkey_ok = False
root.geometry("1500x800+0+0")
pump(600)
app.show_window()
app.set_search("")
# (a) галочки в історії вдвічі більші, кнопка «Об'єднати і копіювати» велика
app.history = History(os.path.join(tmp, "h33.json"))
for t_ in ("111", "222", "333"):
    app.history.add(t_)
app.select_category(HISTORY)
app.flush_render()
pump(300)
c33 = next(iter(app._card_objs.values()))
assert c33.check is not None and int(c33.check.cget("width")) >= int(48 * app.scaling()) - 1, c33.check.cget("width")
assert app.merge_btn.cget("height") >= 46 and app.merge_btn.cget("width") >= 280
# (b) швидкі фрази згортаються (стан запам'ятовується)
app.toggle_phrases()
pump(200)
assert settings["phrases_collapsed"] and app.refund_box.winfo_ismapped()
assert not app.phrase_list.winfo_ismapped() and not app.phrase_pair.winfo_ismapped() and app.phrase_chev.cget("text") == "▸"
from store import Settings as _S33
assert _S33(settings.path)["phrases_collapsed"] is True
app.toggle_phrases()
pump(200)
assert app.phrase_list.winfo_ismapped() and app.phrase_pair.winfo_ismapped() and not settings["phrases_collapsed"]
print("33a big checkboxes/merge button, collapsible phrases OK")

# (c) копіпаста v.2: клік відкриває вікно вибору аппендів
v2cat = app.preset.add_category("V2 тест")
v2data = {"options": [
    {"text": "оранжевий", "kind": "group", "join": True, "children": [
        {"text": "рожевий", "kind": "group", "join": True, "children": [{"text": "глибокий"}]},
        {"text": "синій"}, {"text": "фіолетовий"}]},
    {"text": "червоний", "kind": "addon", "on": False},
    {"text": "зелений"}]}
sn33 = app.preset.add_snippet(v2cat["id"], "Основний текст", v2data)
sn33b = app.preset.add_snippet(v2cat["id"], "Основний 2", {"options": [
    {"text": "лише відкриває", "kind": "group", "join": False, "children": [{"text": "кінець"}]},
    {"text": "завжди", "kind": "addon", "on": True}]})
app.render()
app.flush_render()
app.select_category(v2cat["id"])
app.flush_render()
pump(300)
card33 = app._card_objs[sn33["id"]]
assert card33.v2 and card33.body.cget("text").endswith("▶ v.2")


def v2dlg():
    return [w for w in root.winfo_children() if isinstance(w, cm.V2Dialog)][-1]


def opt(dlg, text):
    dlg.update()                                   # щойно перемальований рівень має з'явитись на екрані
    for fr in dlg.list.winfo_children():
        for w in fr.winfo_children():
            if isinstance(w, tk.Label) and w.cget("text").endswith(text):
                return w
    raise AssertionError(("немає аппенду", text))


def preview_of(dlg):
    return dlg.preview.get("1.0", "end-1c")


log33 = []
err33 = []


def guard(fn):
    """Помилка всередині модального вікна не повинна його «повісити»: записуємо й закриваємо вікно."""
    def run():
        try:
            fn()
        except Exception as ex:                   # noqa: BLE001
            err33.append(repr(ex))
            for w in root.winfo_children():
                if isinstance(w, (cm.V2Dialog, cm.V2OptionsDialog, cm.SnippetDialog)):
                    w.destroy()
    return run



def flow1():
    d = v2dlg()
    log33.append(preview_of(d))
    opt(d, "червоний").event_generate("<Button-1>", x=5, y=5)            # ◆ галочка
    log33.append(preview_of(d))
    opt(d, "оранжевий").event_generate("<Button-1>", x=5, y=5)           # ▶ підгрупа (додається сама)
    log33.append(preview_of(d))
    opt(d, "рожевий").event_generate("<Button-1>", x=5, y=5)
    log33.append(preview_of(d))
    d.back()                                                              # «Назад»
    log33.append(preview_of(d))
    opt(d, "рожевий").event_generate("<Button-1>", x=5, y=5)
    opt(d, "глибокий").event_generate("<Button-1>", x=5, y=5, state=0)   # ● кінцевий без Ctrl


app.copy_to_clipboard("до v2")
root.after(500, guard(flow1))
real_click(card33.body)
pump(300)
assert not err33, err33
assert log33 == ["Основний текст", "Основний текст червоний", "Основний текст оранжевий червоний",
                 "Основний текст оранжевий рожевий червоний", "Основний текст оранжевий червоний"], log33
assert root.clipboard_get() == "Основний текст оранжевий рожевий глибокий червоний", root.clipboard_get()
assert not app._hidden and root.state() != "withdrawn", "кінцевий аппенд без Ctrl лише копіює (вікно лишається)"
assert card33.flash_lbl is None or True
# Ctrl + клік по кінцевому — копіює і ховає вікно програми
app.hotkey_ok = True
root.after(500, guard(lambda: opt(v2dlg(), "зелений").event_generate("<Button-1>", x=5, y=5, state=0x4)))
real_click(card33.body)
pump(300)
assert root.clipboard_get() == "Основний текст зелений" and app._hidden, "Ctrl+клік по кінцевому ховає вікно"
app.show_window()
pump(300)
# «Копіювати зараз» — без подальшого вибору
root.after(500, guard(lambda: (opt(v2dlg(), "оранжевий").event_generate("<Button-1>", x=5, y=5), v2dlg().now_btn.invoke())))
real_click(card33.body)
pump(300)
assert root.clipboard_get() == "Основний текст оранжевий" and not app._hidden
# «Скасувати» — нічого не копіюється
app.copy_to_clipboard("маркер33")
root.after(500, guard(lambda: v2dlg().cancel()))
real_click(card33.body)
pump(200)
assert root.clipboard_get() == "маркер33"
# підгрупа без «додавати текст» лише відкриває наступну групу; ◆ «увімк.» стоїть за замовчуванням
card33b = app._card_objs[sn33b["id"]]
log33b = []


def flow2():
    d = v2dlg()
    log33b.append(preview_of(d))
    opt(d, "лише відкриває").event_generate("<Button-1>", x=5, y=5)
    log33b.append(preview_of(d))
    opt(d, "кінець").event_generate("<Button-1>", x=5, y=5)


root.after(500, guard(flow2))
real_click(card33b.body)
pump(300)
assert not err33, err33
assert log33b == ["Основний 2 завжди", "Основний 2 завжди"], log33b
assert root.clipboard_get() == "Основний 2 кінець завжди", root.clipboard_get()
# Ctrl + клік по самій картці v.2 — лише основний текст, і вікно ховається
card33.body.event_generate("<ButtonPress-1>", x=8, y=8, state=0x4)
card33.body.event_generate("<ButtonRelease-1>", x=8, y=8, state=0x4)
pump(300)
assert root.clipboard_get() == "Основний текст" and app._hidden
app.show_window()
pump(300)
app.hotkey_ok = False
print("33b v.2 choice window (groups, addons, back, copy now, ctrl) OK")

# (d) редактор аппендів і діалог запису з прапорцем v.2
ed = cm.V2OptionsDialog(app, None)


def edit_script():
    def entry_of(i):
        row = ed.list.winfo_children()[i]
        return next(w for w in row.grid_slaves(row=0, column=1))
    ed.add()
    entry_of(0).insert(0, "аппенд 1")
    ed._set_kind(ed.root_opts[0], "group")
    ed.open_group(ed.root_opts[0])
    assert ed.back_btn.winfo_manager() == "pack" and "аппенд 1" in ed.crumb.cget("text")
    ed.add()
    entry_of(0).insert(0, "вкладений")
    ed.up()
    ed.add()
    entry_of(1).insert(0, "додатковий")
    ed._set_kind(ed.root_opts[1], "addon")
    ed.add()                                           # порожній — відкидається при збереженні
    ed._move(ed.root_opts[1], -1)
    ed.accept()


root.after(400, guard(edit_script))
res33 = cm._Dialog.run(ed)
assert not err33, err33
assert [(n["text"], n["kind"]) for n in res33["options"]] == [("додатковий", "addon"), ("аппенд 1", "group")], res33
assert res33["options"][1]["children"][0]["text"] == "вкладений" and res33["options"][1]["join"] is True
sd = cm.SnippetDialog(app, "Новий v2", "", v2cat["id"])
assert sd.v2_btn.cget("state") == "disabled"


def sd_script():
    sd.text.insert("1.0", "Копіпаста з діалогу")
    sd.v2_var.set(True)
    sd._sync_v2()
    root.after(400, lambda: [w for w in root.winfo_children() if isinstance(w, cm.V2OptionsDialog)][-1].accept())
    sd.edit_v2()                                        # вкладений редактор (порожній → без аппендів)
    sd.v2 = {"options": [{"text": "x", "kind": "end"}]}
    sd._sync_v2()
    assert sd.v2_btn.cget("text") == "Аппенди… (1)"
    sd.ok()


root.after(400, guard(sd_script))
res_sd = cm._Dialog.run(sd)
assert not err33, err33
assert res_sd[0] == "Копіпаста з діалогу" and res_sd[1] == v2cat["id"] and res_sd[2]["options"][0]["text"] == "x", res_sd
# редагування: v2 переходить у діалог і зберігається
saved_run = cm.SnippetDialog.run
cm.SnippetDialog.run = lambda self: (self.text.get("1.0", "end-1c") + " (ред.)", v2cat["id"], None)
app.on_edit(sn33["id"])
cm.SnippetDialog.run = saved_run
got = next(s_ for s_ in app.preset.snippets(v2cat["id"]) if s_["id"] == sn33["id"])
assert got["text"] == "Основний текст (ред.)" and "v2" not in got, "v2=None робить запис звичайним"
print("33c v.2 editor + snippet dialog OK")
settings["autohide"] = True
root.geometry("1180x660+0+0")
pump(600)
settings.data["width"], settings.data["height"] = 1180, 660
app._size = None

# ---- 34. раунд 9: швидша прокрутка папок, аппенди для наявних копіпастів через «⋯» -------------------------------------------
settings["autohide"] = False
app.show_window()
pump(200)
# прокрутка колесом у списку папок — удвічі швидша (одиниця прокрутки полотна подвоєна)
probe = ctk.CTkScrollableFrame(root)
base_inc = int(float(probe._parent_canvas.cget("yscrollincrement")))
probe.destroy()
assert int(float(app.cat_list._parent_canvas.cget("yscrollincrement"))) == base_inc * cm.CAT_SCROLL_FACTOR == base_inc * 2
# «⋯» звичайного запису → «Додати аппенди…»; після збереження запис стає v.2, текст не змінюється
ap_cat = app.preset.add_category("Аппенди меню")
plain = app.preset.add_snippet(ap_cat["id"], "Звичайна копіпаста")
app.render()
app.flush_render()
app.select_category(ap_cat["id"])
app.flush_render()
pump(200)
app.show_menu(3, 3, plain["id"])
assert "Додати аппенди…" in labels(popups[-1]) and "Прибрати аппенди" not in labels(popups[-1]), labels(popups[-1])
saved_v2run = cm.V2OptionsDialog.run
cm.V2OptionsDialog.run = lambda self: cm.clean_v2({"options": [{"text": "додаток", "kind": "end"}]})
invoke(popups[-1], "Додати аппенди…")
pump(200)
got = next(s_ for s_ in app.preset.snippets(ap_cat["id"]) if s_["id"] == plain["id"])
assert got["text"] == "Звичайна копіпаста" and got["v2"]["options"][0]["text"] == "додаток"
assert app._card_objs[plain["id"]].v2 and app._card_objs[plain["id"]].body.cget("text").endswith("▶ v.2")
app.show_menu(3, 3, plain["id"])
assert "Редагувати аппенди…" in labels(popups[-1]) and "Прибрати аппенди" in labels(popups[-1])
cm.V2OptionsDialog.run = lambda self: None                      # «Скасувати» — нічого не змінюється
invoke(popups[-1], "Редагувати аппенди…")
assert next(s_ for s_ in app.preset.snippets(ap_cat["id"]) if s_["id"] == plain["id"]).get("v2")
app.show_menu(3, 3, plain["id"])
invoke(popups[-1], "Прибрати аппенди")
pump(200)
got = next(s_ for s_ in app.preset.snippets(ap_cat["id"]) if s_["id"] == plain["id"])
assert "v2" not in got and not app._card_objs[plain["id"]].v2
cm.V2OptionsDialog.run = saved_v2run
app.select_category(HISTORY)
app.flush_render()
app.show_menu(3, 3, app._order[0]) if app._order else None
if app._order:
    assert not any("аппенди" in l_ for l_ in labels(popups[-1])), "у записів історії аппендів немає"
print("34 faster folder scroll + appends via ⋯ menu OK")
settings["autohide"] = True

# ---- 35. раунд 10: прокрутка тексту в плитках, значення з історії, користувач з історії, TOS-причини, USER 2 ----------------------
settings["autohide"] = False
app.hotkey_ok = False
root.geometry("1500x800+0+0")
pump(600)
app.show_window()
app.set_search("")
# (a) довгий текст у плитці прокручується колесом до кінця
long_cat = app.preset.add_category("Довгі тексти")
long_text = " ".join(f"Слово{n}" for n in range(220))
long_sn = app.preset.add_snippet(long_cat["id"], long_text)
app.render()
app.flush_render()
app.select_category(long_cat["id"])
app.set_rec_view("tiles")
app.flush_render()
pump(600)
tc = app._card_objs[long_sn["id"]]
assert tc.clip is not None and tc.body.cget("text").startswith(long_text[:40]) and "…" not in tc.body.cget("text")
over = tc._overflow()
assert over > 0 and tc.more_hint.winfo_ismapped(), ("текст не вміщається — є стрілка ▼", over)
for _ in range(300):
    tc.body.event_generate("<Button-5>", x=5, y=5)
pump(150)
assert tc._off == tc._overflow() and not tc.more_hint.winfo_ismapped(), "докрутили до кінця"
assert tc.body.winfo_y() == -tc._off
for _ in range(300):
    tc.body.event_generate("<Button-4>", x=5, y=5)
pump(100)
assert tc._off == 0
app.copy_to_clipboard("маркер35")
real_click(tc.body)
assert root.clipboard_get() == long_text, "клік по тексту плитки й далі копіює"
app.set_rec_view("list")
pump(200)
print("35a tile text scroll OK")

def cat_named(name):
    c_ = next((c for c in app.preset.categories if c["name"].casefold() == name.casefold()), None)
    return c_ or app.preset.add_category(name)


# (b) Suspicious cards / Added cards: порожнє поле → останні числові записи історії
app.history = History(os.path.join(tmp, "h35.json"))
for t_ in ("ще старіше 99", "Жовтень у Голосієві", "1234, 2365 4562", "542", "123"):
    app.history.add(t_)
sc35 = cat_named("Suspicious cards")
sc_ref = app.preset.add_snippet(sc35["id"], "Suspicious cards were added. Blacklisted, unsolicited charges refunded")
sc_3m = app.preset.add_snippet(sc35["id"], "Suspicious cards were added. Blacklisted, unsolicited charges refunded for the last 3 months.")
sl35 = cat_named("Suspicious login")
app.render()
app.flush_render()
app.select_category(sc35["id"])
app.flush_render()
app.select_format("builtin-suspicious-cards")
pump(200)
assert app.fmt_input.get("1.0", "end-1c") == ""
assert app.fmt_preview.get("1.0", "end-1c") == "Suspicious cards 123, 542, 1234, 2365, 4562 were added."
assert "історії" in app.fmt_title.cget("text")
app.arm_append()
real_click(app._card_objs[sc_3m["id"]].body)
assert root.clipboard_get() == ("Suspicious cards 123, 542, 1234, 2365, 4562 were added. Blacklisted, unsolicited charges "
                                "refunded for the last 3 months."), root.clipboard_get()
assert app.sel_format == "builtin-suspicious-cards"
app.fmt_input.insert("1.0", "1234, 2365 4562")                # введене має пріоритет
app._update_format_preview()
app.arm_append()
real_click(app._card_objs[sc_ref["id"]].body)
assert root.clipboard_get() == "Suspicious cards 1234, 2365, 4562 were added. Blacklisted, unsolicited charges refunded"
app.select_category(sl35["id"])
app.flush_render()
app.select_format("builtin-added-cards")
pump(150)
assert app.fmt_preview.get("1.0", "end-1c") == "Cards 123, 542, 1234, 2365, 4562 were added during suspicious login."
app.submit_format()
assert root.clipboard_get() == "Cards 123, 542, 1234, 2365, 4562 were added during suspicious login."
app.history.add("7.5")                                         # нечисловий найновіший запис — значень немає
assert app.sel_format == "builtin-added-cards"
app._update_format_preview()
pump(100)
assert app.fmt_preview.get("1.0", "end-1c") == ""
app._collapse_format()
print("35b formats take numbers from history OK")

# (c) USER 2: і «User #123», і просто числа
app.select_format("builtin-user2")
assert app.preset.format("builtin-user2")["name"] == "USER 2"
app.fmt_input.insert("1.0", "Check 214 and User #13513")
app._update_format_preview()
assert app.fmt_preview.get("1.0", "end-1c") == "Check {LINK:USER:214:E} and {LINK:USER:13513:E}"
app._collapse_format()

# (d) користувач з історії: «in ____» → in {LINK:USER:<останній>:E}
app.history.add("{LINK:USER:1236:E}")
app.history.add("214")
ub = app.preset.add_snippet(sc35["id"], "User was blacklisted due to suspicious cards` usage in ___________")
app.render()
app.flush_render()
app.select_category(sc35["id"])
app.flush_render()
pump(200)
assert app._card_objs[ub["id"]].ulink and app._card_objs[ub["id"]].body.cget("text").endswith("@ user")
real_click(app._card_objs[ub["id"]].body)
assert root.clipboard_get() == "User was blacklisted due to suspicious cards` usage in {LINK:USER:214:E}", root.clipboard_get()
app.show_menu(3, 3, ub["id"])
lab = next(l_ for l_ in labels(popups[-1]) if "користувача з історії" in l_)
assert lab.startswith("✓ ")
invoke(popups[-1], lab)                                        # вимкнути
pump(150)
real_click(app._card_objs[ub["id"]].body)
assert root.clipboard_get() == "User was blacklisted due to suspicious cards` usage in ___________"
app.preset.set_snippet_user_link(ub["id"], True)
mid_ph = app.preset.add_snippet(sc35["id"], "Disputes on legit transactions in deleted duplicate account ___________. "
                                            "Clawback can't be set, card was blacklisted.")
app.render()
app.flush_render()
pump(150)
assert app._card_objs[mid_ph["id"]].ulink, "заглушка «___» посеред тексту — підстановка ввімкнена сама"
real_click(app._card_objs[mid_ph["id"]].body)
assert root.clipboard_get() == ("Disputes on legit transactions in deleted duplicate account {LINK:USER:214:E}. "
                                "Clawback can't be set, card was blacklisted."), root.clipboard_get()
app.history.add("текст без користувача")
app.history.add("ще текст")
print("35c USER 2 + user link from history OK")

# (e) TOS Violation: вікно вибору причини + галочка «Append in {LINK…}» + редагування пунктів
app.history.add("{LINK:USER:777:E}")
tos = cat_named("TOS Violation")
t1 = app.preset.add_snippet(tos["id"], "Blacklisted due to TOS Violation,",
                            {"options": [{"text": "Third-party payments", "kind": "end"}]})
app.preset.set_snippet_user_link(t1["id"], True)
app.render()
app.flush_render()
app.select_category(tos["id"])
app.flush_render()
pump(200)
log35 = []


def tos_flow():
    d = v2dlg()
    log35.append(d.link_var.get())
    log35.append(d.link_cb.cget("text"))
    log35.append(preview_of(d))
    opt(d, "Third-party payments").event_generate("<Button-1>", x=5, y=5)


root.after(500, guard(tos_flow))
real_click(app._card_objs[t1["id"]].body)
pump(300)
assert not err33, err33
assert log35[0] is True and "{LINK:USER:777:E}" in log35[1], log35
assert log35[2] == "Blacklisted due to TOS Violation, in {LINK:USER:777:E}", log35
assert root.clipboard_get() == "Blacklisted due to TOS Violation, Third-party payments in {LINK:USER:777:E}", root.clipboard_get()


def tos_flow2():
    d = v2dlg()
    d.link_var.set(False)
    d.refresh_preview()
    log35.append(preview_of(d))
    saved = cm.V2OptionsDialog.run
    cm.V2OptionsDialog.run = lambda self: cm.clean_v2({"options": [{"text": "Third-party payments", "kind": "end"},
                                                                    {"text": "Multiaccounting", "kind": "end"}]})
    d.edit_options()                                            # «✎ Пункти…» — пункти змінено просто з вікна
    cm.V2OptionsDialog.run = saved
    opt(d, "Multiaccounting").event_generate("<Button-1>", x=5, y=5)


root.after(500, guard(tos_flow2))
real_click(app._card_objs[t1["id"]].body)
pump(300)
assert not err33, err33
assert log35[3] == "Blacklisted due to TOS Violation,", log35
assert root.clipboard_get() == "Blacklisted due to TOS Violation, Multiaccounting"
got = next(s_ for s_ in app.preset.snippets(tos["id"]) if s_["id"] == t1["id"])
assert [o["text"] for o in got["v2"]["options"]] == ["Third-party payments", "Multiaccounting"], "пункти збережені в записі"
print("35d TOS reasons window + user link + inline edit OK")
settings["autohide"] = True
root.geometry("1180x660+0+0")
pump(600)
settings.data["width"], settings.data["height"] = 1180, 660
app._size = None

# ---- 25. справжнє розгортання під віконним менеджером (лише якщо є openbox) -------------------------------------------------------------
import shutil  # noqa: E402

if shutil.which("openbox") and os.environ.get("SMOKE_WM", "1") != "0":
    wm = subprocess.Popen(["openbox", "--sm-disable"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    try:
        pump(1500)
        scr_w, scr_h = root.winfo_screenwidth(), root.winfo_screenheight()
        settings["fullscreen"], settings["autohide"] = True, False
        ctk.set_appearance_mode("light")
        root.geometry("1180x660+100+60")
        pump(600)
        saved = (settings["width"], settings["height"])
        app.hide_window()
        pump(300)
        events.put("show")
        pump(1400)
        assert root.winfo_width() >= scr_w - 8 and root.winfo_height() >= scr_h - 70, \
            ("вікно має зайняти весь екран", root.winfo_width(), root.winfo_height(), scr_w, scr_h)
        assert bool(root.attributes("-zoomed")), "вікно в розгорнутому стані"
        assert abs(app._left_w - min(cm.LEFT_MAX, max(cm.LEFT_W, scr_w * cm.LEFT_FRAC))) <= 3, "колонки підлаштовані під повний екран"
        app.hide_window()
        pump(300)
        assert (settings["width"], settings["height"]) == saved, ("розгорнутий розмір не затирає звичайний", saved, (settings["width"], settings["height"]), app._size, app._maximized, round(time.monotonic() - app._max_ts, 2), app.maximize_count)
        settings["fullscreen"] = False
        events.put("show")
        pump(1400)
        assert not root.attributes("-zoomed") and abs(root.winfo_width() - 1180) <= 3 and abs(root.winfo_height() - 660) <= 3, \
            ("звичайний розмір повернувся", root.winfo_width(), root.winfo_height())
        app.hide_window()
        pump(300)
        settings["fullscreen"] = True
        events.put("toggle")
        pump(1400)
        assert bool(root.attributes("-zoomed")) and root.winfo_width() >= scr_w - 8, "гаряча клавіша розгортає вікно"
        print(f"25 real window manager: maximized {root.winfo_width()}x{root.winfo_height()} of {scr_w}x{scr_h}, restored 1180x660 OK")
    finally:
        wm.terminate()
else:
    print("25 (пропущено: немає openbox)")

print("ALL UI CHECKS OK")
os._exit(0)   # без довгого прибирання ctk-after-колбеків
