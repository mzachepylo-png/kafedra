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


def n_entries(menu):
    end = menu.index("end")
    return 0 if end is None else end + 1     # index("end") == 0 для меню з одним пунктом


def labels(menu):
    out = []
    for i in range(n_entries(menu)):
        t = menu.type(i)
        if t in ("command", "cascade", "checkbutton", "radiobutton"):
            out.append(menu.entrycget(i, "label").strip())
    return out


def submenu(menu, label):
    for i in range(n_entries(menu)):
        if menu.type(i) == "cascade" and menu.entrycget(i, "label") == label:
            return menu.nametowidget(menu.entrycget(i, "menu"))
    raise AssertionError(f"no cascade {label!r} in {labels(menu)}")


def invoke(menu, label):
    for i in range(n_entries(menu)):
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
assert labels(m) == ["Копіювати", "Редагувати…", "Колір запису…", "Перемістити в категорію", "Вгору", "Вниз",
                     "Видалити"], labels(m)
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
assert labels(popups[-1]) == ["Колір…"], labels(popups[-1])
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
dlg = cm.ColorDialog(app, "Колір", None)
cm.colorchooser.askcolor = lambda **k: ((1, 2, 3), "#123456")
root.after(300, dlg.custom)
assert cm._Dialog.run(dlg) == ("set", "#123456")
dlg = cm.ColorDialog(app, "Колір", None)
cm.colorchooser.askcolor = lambda **k: (None, None)           # «Скасувати» у системному діалозі
root.after(300, lambda: (dlg.custom(), dlg.cancel()))
assert cm._Dialog.run(dlg) is None
app.select_format("builtin-user")                              # прибираємо виділення формату
assert app.sel_format is None
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
assert len(app.shown) == len(app.history.items) and app.sel_format == "builtin-user"
rc = app.render_count
app.show_window()
assert app.render_count == rc and root.state() == "normal"
app.select_format("builtin-user")           # згортаємо формат назад
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
assert app.sel_format is None and app.fmt_box.winfo_manager() == "" and app.fmt_idle.winfo_manager() == "pack"
assert app.preset.formats[0]["name"] == "USER"      # USER — завжди перший вбудований формат
app.select_format("builtin-user")
assert app.fmt_box.winfo_manager() == "pack" and app.fmt_idle.winfo_manager() == "" and app.fmt_title.cget("text") == "USER"
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
settings["autohide"] = False
app.v_autohide.set(False)
app._on_autohide()
app.fmt_input.insert("1.0", "555")
app.submit_format()
assert root.clipboard_get() == "{LINK:USER:555:E}" and root.state() == "normal" and app.fmt_input.get("1.0", "end-1c") == "", \
    (root.clipboard_get(), root.state(), app.fmt_input.get("1.0", "end-1c"))
# невідомий тип формату з новішої версії: показується неактивним, нічого не ламає
n_fmt = len(app.preset.formats)
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
    assert 262 <= lw <= 285 and 334 <= rw <= 356, (w, lw, rw)
    assert mw >= 340, (w, mw)
    if w == 1180:
        assert mw < 540, f"центральна колонка не має бути надто розтягнутою ({mw})"
    # нічого не обрізається: кнопка форматування і приписка — всередині правої колонки
    bottom = app.right.winfo_rooty() + app.right.winfo_height()
    for wdg in (app.fmt_btn, app.formats_note):
        assert wdg.winfo_rooty() + wdg.winfo_height() <= bottom + 1, (w, h, wdg)
        assert wdg.winfo_rooty() >= app.right.winfo_rooty()
    assert app.fmt_btn.winfo_rooty() + app.fmt_btn.winfo_height() <= app.formats_note.winfo_rooty() + 1, (w, h, "кнопка налягає на приписку")
    for card in app._cards.values():
        assert card.winfo_width() <= app.cards.winfo_width() + 1
    assert app._wrap_labels, "у відкритій категорії мають бути картки"
    for lbl in app._wrap_labels:      # текст картки переноситься, а не обрізається по правому краю
        assert lbl.winfo_reqwidth() <= lbl.winfo_width() + 2, (w, lbl.cget("text"), lbl.winfo_reqwidth(), lbl.winfo_width())
print("23 layout/typography OK")
root.geometry("1180x660+0+0")
pump(300)
app.select_format("builtin-user")
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
for name in ("clear_btn", "new_cat_btn", "new_fmt_btn"):
    b = getattr(app, name)
    assert b.cget("height") >= 32 and b.cget("width") >= 90, (name, b.cget("height"), b.cget("width"))
    assert b.cget("font").cget("size") >= 13 and b.cget("font").cget("weight") == "bold", name
    assert b.cget("state") == "normal", name
for name in ("new_cat_btn", "new_fmt_btn"):
    b = getattr(app, name)
    assert b.cget("fg_color") == cm.ACCENT and b.cget("text_color") == "#ffffff"
    assert contrast("#ffffff", cm.ACCENT) >= 4.5
for ci in (0, 1):
    assert contrast(cm.DANGER[ci], cm.PANEL[ci]) >= 3.0, ("clear_btn contrast", ci)
assert app.clear_btn.cget("border_width") >= 2 and app.clear_btn.cget("text_color") == cm.DANGER
app.set_status("")
app.new_fmt_btn.invoke()
assert app.status.cget("text") == "Власні формати з'являться пізніше"
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
        assert w < 2200 or cw[0] <= cm.CARD_MAX
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
        cards.append((iid, c.body.cget("text"), c.meta.cget("text"), str(c.frame.cget("fg_color")),
                      str(c.frame.cget("border_color")), c.frame.cget("border_width"), c.bar.cget("bg"),
                      c.body.cget("bg"), c.meta.cget("bg"), c.more.cget("bg"), c.dele.cget("bg"), c.body.cget("fg")))
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
    assert app.title_lbl.cget("bg") == cm.PANEL[idx] and app.formats_note.cget("fg") == cm.FAINT[idx]
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
app.copy_item = lambda i: calls.append(("copy", i))
app.show_menu = lambda x, y, i: calls.append(("menu", i))
app.on_delete = lambda i: calls.append(("delete", i))
for w in (card.body, card.meta, card.bar, canvas):
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
