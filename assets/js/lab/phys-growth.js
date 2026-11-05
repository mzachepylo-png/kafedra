/* Конспект «Ріст і розвиток рослин»: зони росту кореня, крива росту, етіоляція, фітохром, кардинальні температури,
   фотоперіодизм та яровизація, життєві форми за Раункієром. Якісні моделі за матеріалом посібника. */
import { reg, D, C, fmt, clamp, lerp, smooth, rng, mixHex, alpha, hash01, btn } from "./extr-core.js";

const wrap = (c, text, x, y, maxW, lh, o = {}) => { c.font = `${o.weight || 600} ${o.size || 11}px Inter, system-ui, sans-serif`; const ws = text.split(" "); let line = "", yy = y; for (const w of ws) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { D.txt(c, line, x, yy, o); line = w; yy += lh; } else line = t; } if (line) D.txt(c, line, x, yy, o); return yy; };

/* ====================== 1. ЗОНИ РОСТУ КОРЕНЯ: ДОСЛІД САКСА ====================== */
// відрізки по 1 мм від кінчика (1..14): відносна швидкість росту
const ZONE = [0.02, 0.05, 0.9, 1.0, 0.7, 0.35, 0.12, 0.03, 0, 0, 0, 0, 0, 0];
reg("g-zones", {
  aspect: (w) => (w < 560 ? 0.8 : 1.7),
  params: [{ k: "h", label: "Час після нанесення міток", min: 0, max: 24, step: 1, v: 24, u: "год" }],
  buttons: [{ label: "▶ Прокрутити добу", pri: true, run: (S, P, sim) => { sim.P.h = 0; sim.sl.h.inp.value = 0; sim.sl.h.show(); S.play = true; } }],
  info: "Дослід <b>Ю. Сакса</b>: на кінчик молодого кореня тушшю наносять мітки через 1 мм і через добу вимірюють відстані. Перші 1–2 мітки від кінчика (<b>зона поділу</b>) майже не розійдуться — клітини діляться, але ще малі. Наступні 2–4 мітки віддаляються сильно — це <b>зона розтягування</b> (найбільшого росту). Далі відстані не змінюються: у <b>зоні диференціації та кореневих волосків</b> клітини вже виросли й спеціалізуються. Зона найбільшого росту кореня короткого й розташована близько до кінчика — тому корінь легко просувається в твердому ґрунті.",
  init() { return { play: false }; },
  step(S, P, dt, sim) { if (S.play) { P.h = Math.min(24, P.h + dt * 3); sim.sl.h.inp.value = P.h; sim.sl.h.show(); if (P.h >= 24) S.play = false; } },
  draw(c, S, P, W, H) {
    D.bg(c, W, H, "#F3F7EF", "#E7EFE2"); const nar = W < 560;
    // позиція міток: кумулятивний розтяг
    const N = 14, marks = [0]; for (let i = 0; i < N; i++) marks.push(marks[i] + 1 + ZONE[i] * 1.3 * (P.h / 24));
    const total = marks[N], sc = Math.min((nar ? H * .44 : H * .72) / (14 + 1.3 * 2.5), 34);
    const x0 = nar ? W * .22 : W * .18, y0 = H * (nar ? .08 : .1);
    const rootW = 38;
    // корінь: кінчик внизу
    const yTip = y0 + total * sc;
    c.fillStyle = "#F2E9CF"; D.rr(c, x0 - rootW / 2, y0 - 6, rootW, yTip - y0 + 12, 16); c.fill(); c.strokeStyle = "#C9B98A"; c.lineWidth = 2; c.stroke();
    // чохлик
    c.fillStyle = "#D8C48A"; c.beginPath(); c.ellipse(x0, yTip + 3, rootW / 2 - 2, 14, 0, 0, Math.PI); c.fill();
    // зони забарвлення
    const zy = (a, b, col, n) => { c.fillStyle = col; c.globalAlpha = .55; c.fillRect(x0 - rootW / 2 + 2, y0 + (total - b) * sc, rootW - 4, (b - a) * sc); c.globalAlpha = 1; };
    zy(0, marks[2], "#E8B7A9"); zy(marks[2], marks[6], "#A9D68F"); zy(marks[6], marks[N], "#C9D8EC");
    // мітки
    for (let i = 0; i <= N; i++) { const y = y0 + (total - marks[i]) * sc; c.strokeStyle = "#222"; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 - rootW / 2 - 4, y); c.lineTo(x0 + rootW / 2 + 4, y); c.stroke(); if (i % 2 === 0) D.txt(c, `${i}`, x0 - rootW / 2 - 12, y, { size: 10, align: "right", color: C.muted }); }
    D.txt(c, "кінчик →", x0, yTip + 34, { size: 10.5, color: C.muted, align: "center" });
    // підписи зон (праворуч від кореня)
    const zlabel = [[0, marks[2], "зона поділу", "#B5574A"], [marks[2], marks[6], "зона розтягування (найбільший ріст)", "#3F7D45"], [marks[6], marks[N], "диференціація, кореневі волоски", "#4A6EA0"]];
    for (const [a, b, n, col] of zlabel) { const ym = y0 + (total - (a + b) / 2) * sc; if (!nar) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + rootW / 2 + 8, y0 + (total - b) * sc + 2); c.lineTo(x0 + rootW / 2 + 8, y0 + (total - a) * sc - 2); c.stroke(); D.txt(c, n, x0 + rootW / 2 + 16, ym, { size: 11, weight: 700, color: col }); } }
    // графік приростів
    const gx = nar ? 14 : W * .54, gy = nar ? H * .66 : 34, gw = nar ? W - 28 : W * .42, gh = nar ? H * .27 : H * .66;
    const inc = []; for (let i = 0; i < N; i++) inc.push([i + 1, (marks[i + 1] - marks[i] - 1)]);
    const { X, Y } = D.chart(c, gx, gy, gw, gh, { x: [.5, 14.5], y: [0, 2.2], xt: [2, 4, 6, 8, 10, 12, 14], yt: [0, 1, 2], xl: "відрізок від кінчика, мм", yl: "приріст, мм", title: "Добовий приріст відрізків" });
    inc.forEach(([x, v], i) => { const col = i < 2 ? "#E8B7A9" : i < 6 ? "#7FBF63" : "#9CB7DC"; c.fillStyle = col; c.fillRect(X(x) - gw / 32, Y(v), gw / 16, Y(0) - Y(v)); });
    D.tag(c, `довжина зони росту ≈ ${fmt(marks[6], 1)} мм`, nar ? W * .6 : gx + gw / 2, nar ? gy - 36 : gy + gh + 30, { size: 11, bg: "#fff", stroke: C.rule, color: C.soft });
  },
  reads: (S, P) => [["Час", fmt(P.h, 0), "год"], ["Найбільший приріст відрізка", fmt(1.3 * (P.h / 24), 2), "мм"], ["Зона найбільшого росту", "2–6 мм від кінчика", ""]],
});

/* ====================== 2. КРИВА РОСТУ ====================== */
const sig = (t, k, t0) => 1 / (1 + Math.exp(-k * (t - t0)));
reg("g-curve", {
  aspect: (w) => (w < 560 ? 1.05 : 1.7),
  modes: [["s", "Звичайна S-крива"], ["dbl", "Двофазний ріст (кісточкові плоди)"], ["dan", "Квітконос кульбаби"]],
  params: [{ k: "k", label: "Швидкість росту", min: 0.5, max: 2, step: 0.1, v: 1, d: 1, u: "×" }, { k: "t", label: "Час (діб)", min: 0, max: 100, step: 1, v: 40, u: "%" }],
  toggles: [{ k: "inc", label: "Показати щоденний приріст (похідна)", v: true }],
  info: "<b>Великий період росту</b> (Ю. Сакс): довжина (маса) органа чи рослини змінюється <b>S-подібною (сигмоїдною) кривою</b>: повільно (латентна фаза) → швидше (логарифмічна) → уповільнення → стаціонарна → за старіння — деградація. Щоденні прирости утворюють одновершинну криву. Є й відхилення: у плодів персика й вишні після формування кісточки об'єм деякий час не збільшується, потім знову росте (двофазна крива); квітконос кульбаби росте швидко при розвитку квітки, сповільнюється після розкриття й знову прискорюється при дозріванні плодів.",
  init() { return { t: 0 }; },
  step(S, P, dt) {},
  draw(c, S, P, W, H) {
    D.bg(c, W, H, "#F4F7F0", "#E8EFE4"); const nar = W < 560; const K = P.k;
    const f = (x) => { const t = x / 100 * 12; if (P.mode === "s") return sig(t, K * 1.1, 6); if (P.mode === "dbl") return .55 * sig(t, K * 1.6, 3.2) + .45 * sig(t, K * 1.6, 8.8); return .35 * sig(t, K * 1.7, 2.6) + .15 * sig(t, K * 1.2, 6) + .5 * sig(t, K * 1.5, 9.4); };
    const xs = []; for (let x = 0; x <= 100; x += 1) xs.push(x); const cx = nar ? 14 : 44, gw = nar ? W - 30 : W * .62, gh = P.inc ? (nar ? H * .4 : H * .5) : (nar ? H * .72 : H * .78);
    const cum = xs.map(x => [x, f(x) * 100]), incs = xs.map(x => [x, Math.max(0, (f(Math.min(100, x + 1)) - f(x))) * 100 * 6]);
    const ph = [{ x0: 0, x1: 18, col: "rgba(150,170,200,.18)", label: "латентна" }, { x0: 18, x1: 42, col: "rgba(120,190,110,.2)", label: nar ? "логарифм." : "логарифмічна" }, { x0: 42, x1: 70, col: "rgba(230,190,90,.2)", label: "уповільнення" }, { x0: 70, x1: 100, col: "rgba(190,190,190,.18)", label: "стаціонарна" }];
    const gy = nar ? 30 : 36;
    const { X, Y } = D.chart(c, cx + (nar ? 20 : 0), gy, gw - (nar ? 20 : 0), gh, { x: [0, 100], y: [0, 100], xl: "час", yl: "розмір, %", xt: [0, 25, 50, 75, 100], yt: [0, 50, 100], bands: P.mode === "s" ? ph : [], series: [{ pts: cum, col: C.green, w: 3 }], marks: [{ x: P.t, y: f(P.t) * 100, col: C.red, r: 5 }], title: "Крива росту (сумарний розмір)" });
    if (P.inc) { const gy2 = gy + gh + (nar ? 34 : 38), gh2 = nar ? H * .2 : H - gy2 - 34; D.chart(c, cx + (nar ? 20 : 0), gy2, gw - (nar ? 20 : 0), Math.max(60, gh2), { x: [0, 100], y: [0, 14], xt: [0, 25, 50, 75, 100], yt: [0, 7, 14], xl: "час", yl: "приріст за добу", series: [{ pts: incs, col: C.amber, w: 2.6, fill: "rgba(232,163,59,.18)" }], marks: [{ x: P.t, y: incs[Math.round(P.t)][1], col: C.red, r: 5 }], title: "Щоденний приріст" }); }
    // права панель: швидкості органів
    if (!nar) { const rx = W * .7, ry = 40; D.txt(c, "Швидкість росту різних об'єктів", rx, ry - 6, { size: 11.5, weight: 700 }); const data = [["Плодове тіло гриба Dictyophora", 5], ["Пиляки злаків", 1.8], ["Листки бананів", 1.1], ["Стебло бамбука", .75], ["Стебло гарбуза", .1], ["Більшість рослин", .005]]; data.forEach(([n, v], i) => { const yy = ry + 14 + i * 36; D.txt(c, n, rx, yy, { size: 10.5, color: C.soft }); const w = Math.max(3, Math.log10(v * 1000 + 1) / Math.log10(5001) * (W * .17)); c.fillStyle = "#6BA667"; D.rr(c, rx, yy + 8, w, 10, 5); c.fill(); D.txt(c, `${v} мм/хв`, rx + w + 6, yy + 14, { size: 10.5, weight: 700 }); }); wrap(c, "Шкала логарифмічна. Дані за посібником.", rx, ry + 14 + 6 * 36 + 8, W * .27, 14, { size: 10, color: C.muted, weight: 500 }); }
  },
  reads: (S, P) => { const t = P.t, ph = t < 18 ? "латентна" : t < 42 ? "логарифмічна" : t < 70 ? "уповільнення" : "стаціонарна"; return [["Розмір, % від кінцевого", fmt(100 * (P.mode === "s" ? sig(t / 100 * 12, P.k * 1.1, 6) : P.mode === "dbl" ? .55 * sig(t / 100 * 12, P.k * 1.6, 3.2) + .45 * sig(t / 100 * 12, P.k * 1.6, 8.8) : .35 * sig(t / 100 * 12, P.k * 1.7, 2.6) + .15 * sig(t / 100 * 12, P.k * 1.2, 6) + .5 * sig(t / 100 * 12, P.k * 1.5, 9.4)), 0), "%"], ["Фаза (для S-кривої)", P.mode === "s" ? ph : "—", ""]]; },
});

/* ====================== 3. ЕТІОЛЯЦІЯ І ГЛИБИНА ПОСІВУ ====================== */
reg("g-etio", {
  aspect: (w) => (w < 560 ? 0.95 : 1.7),
  modes: [["dic", "Дводольна (гіпокотиль)"], ["mon", "Однодольна (злак: піхва листка)"]],
  params: [{ k: "light", label: "Освітленість", min: 0, max: 100, step: 5, v: 0, u: "%" }, { k: "depth", label: "Глибина посіву", min: 1, max: 6, step: 1, v: 3, u: "см" }],
  presets: [{ label: "Темрява (етіоляція)", set: { light: 0 } }, { label: "Півтінь", set: { light: 40 } }, { label: "Повне світло", set: { light: 100 } }], presetsLabel: "Освітлення",
  info: "У темряві <b>дводольні</b> рослини дуже витягують стебло (надмірно довгі міжвузля, гіпокотиль), а листки лишаються недорозвиненими; у більшості <b>однодольних</b>, навпаки, витягуються листки (піхви злаків). Така <b>етіоляція</b> доцільна: рослина швидше потрапляє на світло, не витрачаючи запасів на листки. Коли пагін виходить на поверхню ґрунту й зазнає впливу світла, його подовження <b>припиняється</b> — світло тут діє як подразник, а не тільки як джерело енергії. Етіольовані рослини мають слабку механічну тканину; схожий ефект дає й загущення чи надлишок азоту (вилягання хлібів).",
  init() { return { L: 0, t: 0, out: false }; },
  step(S, P, dt) {
    const mon = P.mode === "mon"; const rate = (P.light < 5 ? 1 : 1 - P.light / 100 * .85); // у світлі стебло росте повільно
    const full = P.depth + 3.5; // довжина етіольованого пагона на світлі до зупинки
    if (!S.out) { S.L += dt * 0.9 * rate; if (S.L >= P.depth + .2) { S.out = true; S.t = 0; } }
    else { S.t += dt; const lim = P.light < 5 ? P.depth + 4.5 : P.depth + 1.2 + (1 - P.light / 100) * 2.2; if (S.L < lim && P.light < 5) S.L += dt * .5; }
    S.rate = rate;
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, mixHex("#E5EEF8", "#222F42", 1 - P.light / 100 * .55 - .2), mixHex("#EAF3EE", "#2C3A33", 1 - P.light / 100 * .6)); const nar = W < 560; const mon = P.mode === "mon";
    const sx = nar ? W * .3 : W * .26, sy = H * .36, pxcm = (H * .56) / 9; // 1 см → px
    c.fillStyle = "#8A6A47"; c.fillRect(0, sy, nar ? W : W * .52, H - sy); c.fillStyle = "#6D5236"; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(8 + hash01(i, 1) * (nar ? W - 16 : W * .52 - 16), sy + 10 + hash01(i, 2) * (H - sy - 14), 2 + hash01(i, 3) * 3, 0, 7); c.fill(); }
    D.txt(c, "поверхня ґрунту", 12, sy - 8, { size: 10.5, color: P.light < 40 ? "#E8F0E8" : C.soft, weight: 700 });
    if (P.light > 5) D.glow(c, W * .04 + 20, 24, 60, "#FFD46B", .5 * P.light / 100);
    // насінина на глибині
    const seedY = sy + P.depth * pxcm; D.sphere(c, sx, seedY + 6, 9, "#C9A55B");
    // пагін
    const L = S.L, tipY = seedY - L * pxcm, above = tipY < sy; const etio = P.light < 20;
    const stemCol = etio ? "#F0E6B0" : "#6FBF63"; c.strokeStyle = stemCol; c.lineWidth = mon ? 7 : etio ? 5 : 8; c.lineCap = "round";
    c.beginPath(); c.moveTo(sx, seedY); c.lineTo(sx, Math.max(tipY, topClamp(tipY))); c.stroke();
    function topClamp(y) { return Math.max(y, 6); }
    const ty = Math.max(tipY, 6);
    if (!mon) {
      if (!S.out) { c.strokeStyle = stemCol; c.lineWidth = 5; c.beginPath(); c.arc(sx + 8, ty + 4, 9, Math.PI, Math.PI * 2.6); c.stroke(); } // гачок
      else { const lf = etio ? 8 : 22 * (.4 + P.light / 100 * .8); for (const s of [-1, 1]) { c.save(); c.translate(sx, ty); c.rotate(s * .9 - Math.PI / 2 + (s > 0 ? Math.PI : 0)); c.fillStyle = etio ? "#EAD98E" : "#59A857"; c.beginPath(); c.ellipse(lf, 0, lf * 1.1, lf * .5, 0, 0, 7); c.fill(); c.restore(); } }
    } else {
      // однодольна: колеоптиль і листок
      c.fillStyle = etio ? "#F2E9B8" : "#67B65F"; D.rr(c, sx - 6, ty - 8, 12, 18, 6); c.fill();
      if (S.out) { const lf = etio ? 46 : 26; c.strokeStyle = etio ? "#EAD98E" : "#4E9E4F"; c.lineWidth = 4; c.beginPath(); c.moveTo(sx, ty); c.quadraticCurveTo(sx + 6, ty - lf * .6, sx + 16 * (etio ? .4 : 1), ty - lf); c.stroke(); }
    }
    D.txt(c, S.out ? (etio ? "вийшов на поверхню, але етіольований: блідий, витягнутий" : "на світлі ріст припиняється: рослина зелена, компактна") : "ще під ґрунтом: росте вгору до світла", nar ? W / 2 : W * .26, H * .08 + 8, { size: 11, align: "center", weight: 700, color: P.light < 40 ? "#EAF0EA" : C.soft });
    // права панель
    const dark = P.light < 45, fg = dark ? "#EAF0EA" : C.ink, fg2 = dark ? "#C8D6CC" : C.soft; const gx = nar ? 14 : W * .58, gw = nar ? W - 28 : W * .38; let y = nar ? H * .88 : 40;
    if (!nar) { D.txt(c, "Порівняння за довжиною стебла", gx, y - 8, { size: 11.5, weight: 700, color: fg }); const items = [["темрява", P.depth + 4.5, "#E8D88E"], ["півтінь", P.depth + 1.2 + .6 * 2.2, "#A9D68F"], ["повне світло", P.depth + 1.2, "#5FAE5C"]]; items.forEach(([n, v, col], i) => { const yy = y + 20 + i * 44; D.txt(c, `${n}: ${fmt(v, 1)} см`, gx, yy, { size: 11, color: fg2 }); c.fillStyle = col; D.rr(c, gx, yy + 8, gw * v / 12, 14, 7); c.fill(); }); wrap(c, "Етіоляція — реакція «пошуку світла»: ріст стебла у темряві йде за рахунок запасів насіння.", gx, y + 168, gw, 15, { size: 10.5, color: fg2, weight: 500 }); }
  },
  reads: (S, P) => [["Освітленість", fmt(P.light, 0), "%"], ["Стан", S.out ? (P.light < 20 ? "етіольований пагін" : "зелений пагін") : "росте під ґрунтом", ""], ["Глибина посіву", fmt(P.depth, 0), "см"]],
});

/* ====================== 4. ФІТОХРОМ: ЧЕРВОНЕ Й ДАЛЕКЕ ЧЕРВОНЕ СВІТЛО ====================== */
reg("g-phyto", {
  aspect: (w) => (w < 560 ? 0.8 : 1.85),
  buttons: [
    { label: "🔴 Червоне світло (≈ 660 нм)", pri: true, run: (S) => { S.queue = { type: "R", t: 0 }; } },
    { label: "⚫ Далеке червоне (≈ 730 нм)", run: (S) => { S.queue = { type: "FR", t: 0 }; } },
    { label: "↺ Темрява", run: (S) => { S.pfr = .0; S.hist = []; S.germ = 0; } },
  ],
  info: "<b>Фітохром</b> — пігмент, що існує в двох формах: <b>Pr</b> (поглинає червоне світло близько 660 нм) і <b>Pfr</b> (поглинає далеке червоне близько 730 нм). Червоне світло перетворює Pr на активну Pfr, далеке червоне — повертає Pfr у Pr. Тому реакції на червоне й далеке червоне світло <b>оборотні</b>: результат визначає <b>останнє</b> освітлення в послідовності. У темряві фітохром — у формі Pr. Так керуються проростання насіння, ріст стебла, інші морфогенетичні реакції.",
  init() { return { pfr: 0, queue: null, hist: [], germ: 0, t: 0 }; },
  step(S, P, dt) {
    S.t += dt; if (S.queue) { S.queue.t += dt; const target = S.queue.type === "R" ? .85 : .03; S.pfr = lerp(S.pfr, target, clamp(dt * 1.8, 0, 1)); if (S.queue.t > 1.6) { S.hist.push(S.queue.type); if (S.hist.length > 6) S.hist.shift(); S.queue = null; } }
    S.germ = lerp(S.germ, S.pfr > .5 ? 1 : 0, clamp(dt * .8, 0, 1));
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#F3F4F0", "#E7EAE2"); const nar = W < 560;
    // лампа
    const active = S.queue ? S.queue.type : null; const lamp = active === "R" ? "#E5322C" : active === "FR" ? "#7B1F2A" : "#B8BFB8";
    const lx = nar ? W * .5 : W * .16, ly = H * (nar ? .12 : .18); if (active) D.glow(c, lx, ly + 20, 90, lamp, active === "R" ? .6 : .3);
    c.fillStyle = "#58645E"; D.rr(c, lx - 28, ly - 22, 56, 26, 6); c.fill(); D.sphere(c, lx, ly + 6, 12, lamp);
    D.txt(c, active === "R" ? "червоне світло" : active === "FR" ? "далеке червоне світло" : "темрява", lx, ly + 36, { size: 11, align: "center", weight: 700, color: C.soft });
    // насінина / паросток
    const sx = lx, sy = H * (nar ? .36 : .74); c.fillStyle = "#8B6A47"; D.rr(c, sx - 70, sy + 18, 140, 22, 6); c.fill();
    D.sphere(c, sx, sy + 14, 12, "#C9A55B");
    if (S.germ > .05) { c.strokeStyle = "#7DBB6B"; c.lineWidth = 4; c.lineCap = "round"; c.beginPath(); c.moveTo(sx, sy + 8); c.quadraticCurveTo(sx - 4, sy - 22 * S.germ, sx + 8, sy - 46 * S.germ); c.stroke(); }
    D.txt(c, S.germ > .6 ? "насіння проросло" : "насіння спить", sx, sy + 56, { size: 11, align: "center", weight: 700, color: S.germ > .6 ? "#2F7D4F" : C.muted });
    // бари Pr / Pfr
    const gx = nar ? 20 : W * .38, gw = nar ? W - 40 : W * .56; let y = nar ? H * .58 : 50;
    D.txt(c, "Форми фітохрому", gx, y - 16, { size: 12, weight: 700 });
    const bars = [["Pr — неактивна (поглинає ≈ 660 нм)", 1 - S.pfr, "#3F6FB0"], ["Pfr — активна (поглинає ≈ 730 нм)", S.pfr, "#C0392B"]];
    bars.forEach(([n, v, col], i) => { const yy = y + i * 46; D.txt(c, n, gx, yy, { size: 11, color: C.soft }); c.fillStyle = "#E4E8E2"; D.rr(c, gx, yy + 9, gw, 16, 8); c.fill(); c.fillStyle = col; D.rr(c, gx, yy + 9, Math.max(6, gw * v), 16, 8); c.fill(); D.txt(c, fmt(v * 100, 0) + " %", gx + gw, yy, { size: 11, align: "right", weight: 700 }); });
    // історія
    const hy = nar ? H * .86 : y + 112; D.txt(c, "Послідовність освітлень (остання — справа)", gx, hy - 10, { size: 11, weight: 700 });
    S.hist.forEach((h, i) => { const x = gx + i * 52; c.fillStyle = h === "R" ? "#E5322C" : "#7B1F2A"; D.rr(c, x, hy, 44, 22, 11); c.fill(); D.txt(c, h === "R" ? "ЧС" : "ДЧС", x + 22, hy + 11, { size: 11, color: "#fff", weight: 800, align: "center" }); });
    if (!S.hist.length) D.txt(c, "натискайте кнопки: чергуйте червоне й далеке червоне", gx, hy + 12, { size: 11, color: C.muted });
    const last = S.hist[S.hist.length - 1]; if (last) D.tag(c, last === "R" ? "остання — червоне: проростання ТАК" : "остання — далеке червоне: проростання НІ", nar ? W / 2 : gx + gw / 2, nar ? H - 8 : H - 18, { size: 11, bg: "#fff", stroke: last === "R" ? "#2F7D4F" : C.red, color: last === "R" ? "#2F7D4F" : C.red });
  },
  reads: (S, P) => [["Pfr (активна форма)", fmt(S.pfr * 100, 0), "%"], ["Реакція", S.germ > .6 ? "проростання" : "спокій", ""], ["Правило", "вирішує остання експозиція", ""]],
});

/* ====================== 5. КАРДИНАЛЬНІ ТЕМПЕРАТУРИ І ГАРМОНІЙНИЙ ОПТИМУМ ====================== */
const TYPES = { cold: { n: "Холодостійка (арктична, озима)", mn: 0, op: 16, mx: 30 }, mid: { n: "Помірна (мезофіт)", mn: 4, op: 26, mx: 40 }, hot: { n: "Теплолюбна (тропічна)", mn: 12, op: 32, mx: 45 } };
const tcurve = (T, mn, op, mx) => { if (T <= mn || T >= mx) return 0; return T < op ? Math.pow((T - mn) / (op - mn), 1.6) : Math.pow((mx - T) / (mx - op), 1.2); };
reg("g-temp", {
  aspect: (w) => (w < 560 ? 0.8 : 1.7),
  modes: [["cold", "Холодостійка"], ["mid", "Помірна"], ["hot", "Теплолюбна"]],
  params: [{ k: "T", label: "Температура середовища", min: -2, max: 48, step: 1, v: 22, u: "°C" }, { k: "age", label: "Етап розвитку (проростання → цвітіння)", min: 0, max: 100, step: 5, v: 0, u: "%" }],
  toggles: [{ k: "root", label: "Показати окремо корінь (його оптимум нижчий)", v: true }],
  info: "Залежність росту від температури має три <b>кардинальні точки</b>: <b>мінімум</b> (ріст лише починається), <b>оптимум</b> (найшвидший ріст) і <b>максимум</b> (вище якого ріст зупиняється). У межах приблизно 0…+35 °C дотримується <b>правило Вант-Гоффа</b>: на кожні +10 °C швидкість реакції зростає вдвічі. Найшвидший ріст (фізіологічний оптимум) не завжди найкращий: при ньому рослини бувають ослабленими. Тому є <b>гармонійний оптимум</b> — де виростають найміцніші рослини; він нижчий за фізіологічний, а на ранніх етапах розвитку лежить нижче, ніж на пізніх. Для кореня оптимум нижчий, ніж для стебла (ґрунт холодніший).",
  init() { return {}; },
  step() {},
  draw(c, S, P, W, H) {
    D.bg(c, W, H, "#F4F6F1", "#E9EEE4"); const ty = TYPES[P.mode]; const nar = W < 560;
    const sh = (mn, op, mx) => [mn, op, mx]; const harm = ty.op - 4 + (P.age / 100) * 4; // гармонійний: нижчий на ранніх етапах
    const rO = ty.op - 6; const xs = []; for (let x = -2; x <= 48; x += .5) xs.push(x);
    const gx = nar ? 38 : 50, gy = 34, gw = (nar ? W - 56 : W * .6), gh = nar ? H * .52 : H * .68;
    const { X, Y } = D.chart(c, gx, gy, gw, gh, { x: [-2, 48], y: [0, 1.1], xt: [0, 10, 20, 30, 40], yt: [0, .5, 1], xl: "температура, °C", yl: "швидкість росту (відн.)", title: "Крива росту стебла й кореня",
      bands: [{ x0: ty.mn, x1: ty.op, col: "rgba(120,190,110,.12)" }, { x0: ty.op, x1: ty.mx, col: "rgba(230,160,90,.12)" }],
      series: [{ pts: xs.map(x => [x, tcurve(x, ty.mn, ty.op, ty.mx)]), col: C.green, w: 3 }, ...(P.root ? [{ pts: xs.map(x => [x, tcurve(x, ty.mn - 2, rO, ty.mx - 6)]), col: C.amber, w: 2.4, dash: [6, 4] }] : [])],
      vl: [{ x: ty.mn, col: C.muted, label: "min" }, { x: ty.op, col: C.red, label: "оптимум" }, { x: ty.mx, col: C.muted, label: "max" }, { x: harm, col: "#3F6FB0", label: "гармонійний", dy: 13 }],
      marks: [{ x: P.T, y: tcurve(P.T, ty.mn, ty.op, ty.mx), col: C.red, r: 5 }] });
    const px = gx + (nar ? 0 : gw + 24), pw = nar ? gw : W - px - 14; let y = nar ? gy + gh + 44 : 40;
    D.txt(c, "Q₁₀ (правило Вант-Гоффа)", px, y - 8, { size: 11.5, weight: 700 });
    const q = (T) => Math.pow(2, (T - 20) / 10); const qv = T => P.T <= ty.op ? q(P.T) : null;
    wrap(c, P.T > 0 && P.T <= 35 && P.T <= ty.op ? `У ділянці до оптимуму швидкість приблизно вдвічі зростає на кожні +10 °C (зараз відносно 20 °C: ×${fmt(q(P.T), 2)}).` : P.T > ty.op && P.T < ty.mx ? "Вище оптимуму швидкість падає: ферменти й мембрани починають страждати." : "Поза межами кардинальних точок рослина не росте.", px, y + 12, pw, 15, { size: 11, color: C.soft, weight: 500 });
    if (!nar) { y += 76; D.txt(c, "Фізіологічний й гармонійний оптимум", px, y, { size: 11.5, weight: 700 }); wrap(c, `Фізіологічний оптимум для стебла: ${fmt(ty.op, 0)} °C; гармонійний (найміцніші рослини) зараз: ${fmt(harm, 0)} °C; для кореня: ${fmt(rO, 0)} °C.`, px, y + 18, pw, 15, { size: 11, color: C.soft, weight: 500 }); }
    const st = P.T < ty.mn ? "холодово: ріст не відбувається" : P.T > ty.mx ? "жарко: ріст зупинено" : Math.abs(P.T - harm) < 3 ? "близько до гармонійного оптимуму" : P.T > harm + 3 && P.T <= ty.op + 2 ? "швидкий, але «розпусний» ріст — слабші тканини" : "ріст сповільнений";
    D.tag(c, st, nar ? W / 2 : gx + gw / 2, nar ? H - 16 : H - 22, { size: 11, bg: "#fff", stroke: C.rule, color: C.soft });
  },
  reads: (S, P) => { const ty = TYPES[P.mode]; const v = tcurve(P.T, ty.mn, ty.op, ty.mx); return [["Тип рослини", ty.n, ""], ["Відносна швидкість росту стебла", fmt(v, 2), ""], ["Кардинальні точки", `${ty.mn} / ${ty.op} / ${ty.mx}`, "°C (min / opt / max)"]]; },
});

/* ====================== 6. ФОТОПЕРІОДИЗМ І ЯРОВИЗАЦІЯ ====================== */
const PP = { sdp: { n: "Короткого дня", crit: 10 }, ldp: { n: "Довгого дня", crit: 13 }, dnp: { n: "Нейтральна", crit: 0 } };
reg("g-photoper", {
  aspect: (w) => (w < 560 ? 0.75 : 1.8),
  modes: [["sdp", "Рослина короткого дня"], ["ldp", "Рослина довгого дня"], ["dnp", "Нейтральна до довжини дня"]],
  params: [{ k: "day", label: "Тривалість дня (світла)", min: 4, max: 20, step: 0.5, v: 16, u: "год", d: 1 }, { k: "cold", label: "Холод: тривалість яровизації (озима форма)", min: 0, max: 60, step: 5, v: 0, u: "діб" }],
  toggles: [{ k: "flash", label: "Перервати ніч короткою спалахом червоного світла", v: false }, { k: "winter", label: "Озима форма (потребує яровизації)", v: false }],
  presets: [{ label: "Літо (довгий день)", set: { day: 16 } }, { label: "Осінь (короткий день)", set: { day: 9 } }, { label: "Озима після зими", set: { day: 14, cold: 45 } }],
  presetsLabel: "Сезони",
  info: "Різниця між рослинами довгого й короткого дня — у <b>тривалості темного періоду</b>. Рослині короткого дня для цвітіння потрібна ніч <b>довша</b> за порогову (тому вони зацвітають наприкінці літа), рослині довгого дня — <b>коротша</b> (на початку літа). Короткий спалах червоного світла серед ночі «перериває» її — рослина «вважає», що ніч коротка. Озимі форми додатково потребують <b>яровизації</b> — тривалої дії низької температури, під час якої змінюється обмін речовин у меристемі верхівки. Фотоперіодичну дію сприймають листки, а не меристема. Є і <b>післядія</b>: кілька «потрібних» днів часом достатньо, щоб рослина потім зацвіла.",
  init() { return { t: 0 }; }, step(S, P, dt) { S.t += dt; },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#F2F5F0", "#E6ECE2"); const nar = W < 560;
    const pp = PP[P.mode]; const night = 24 - P.day, nightEff = P.flash ? Math.min(night, 3) : night; // спалах розбиває ніч
    // 24-годинний циліндр
    const cx = nar ? W / 2 : W * .22, cy = nar ? H * .19 : H * .45, R = nar ? Math.min(W * .24, 78) : Math.min(H * .34, 100);
    const a0 = -Math.PI / 2, dayA = P.day / 24 * Math.PI * 2;
    c.fillStyle = "#FFE9A6"; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a0 + dayA); c.fill();
    c.fillStyle = "#35476B"; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0 + dayA, a0 + Math.PI * 2); c.fill();
    if (P.flash) { c.fillStyle = "#E5322C"; const fa = a0 + dayA + (night / 24 * Math.PI) ; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, fa - .12, fa + .12); c.fill(); }
    c.fillStyle = "#fff"; c.beginPath(); c.arc(cx, cy, R * .45, 0, 7); c.fill();
    D.txt(c, `${fmt(P.day, 1)} год`, cx, cy - 6, { size: 13, weight: 800, align: "center" }); D.txt(c, "світла", cx, cy + 9, { size: 10, align: "center", color: C.muted });
    D.txt(c, `ніч ${fmt(night, 1)} год${P.flash ? " (розбита спалахом)" : ""}`, cx, cy + R + 20, { size: 11, align: "center", weight: 700, color: "#35476B" });
    // умова цвітіння
    let photoOK = true, why = "";
    if (P.mode === "sdp") { photoOK = nightEff > 24 - pp.crit; why = photoOK ? "ніч довша за поріг" : "ніч закоротка" } else if (P.mode === "ldp") { photoOK = nightEff < 24 - pp.crit; why = photoOK ? "ніч коротка — достатньо світла" : "ніч задовга" } else { why = "не залежить від фотоперіоду"; }
    const needV = P.winter; const vernOK = !needV || P.cold >= 40; const flower = photoOK && vernOK;
    // рослина
    const px = nar ? W / 2 : W * .66, py = nar ? H * .95 : H * .86, h = nar ? H * .17 : H * .56;
    c.strokeStyle = "#4F9D50"; c.lineWidth = 7; c.lineCap = "round"; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - h * (flower ? 1 : .55)); c.stroke();
    for (const [dy, s] of [[.2, -1], [.3, 1], [.42, -1]]) { c.save(); c.translate(px, py - h * dy); c.rotate(s * .9 - Math.PI / 2 + (s > 0 ? Math.PI : 0)); c.fillStyle = "#5FAE5C"; c.beginPath(); c.ellipse(24, 0, 28, 10, 0, 0, 7); c.fill(); c.restore(); }
    const topY = py - h * (flower ? 1 : .55);
    if (flower) { for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; c.fillStyle = "#F4B6C6"; c.beginPath(); c.ellipse(px + Math.cos(a) * 16, topY + Math.sin(a) * 16, 11, 7, a, 0, 7); c.fill(); } D.sphere(c, px, topY, 8, "#E8B53A"); } else { c.fillStyle = "#79BE6B"; c.beginPath(); c.ellipse(px, topY - 6, 8, 14, 0, 0, 7); c.fill(); }
    D.tag(c, flower ? "цвітіння: ТАК" : "вегетація: цвітіння немає", px, topY - 36, { size: 11.5, bg: "#fff", stroke: flower ? "#2F7D4F" : C.muted, color: flower ? "#2F7D4F" : C.soft });
    // пояснення
    const tx = nar ? 14 : W * .42, tw = nar ? W - 28 : W * .54; let ty2 = nar ? H * .46 : 40;
    D.txt(c, `Тип: ${pp.n}`, tx, ty2, { size: 12, weight: 800 }); ty2 += 24;
    wrap(c, `Фотоперіод: ${why}${pp.crit ? ` (критична ніч ≈ ${24 - pp.crit} год)` : ""}.`, tx, ty2, tw, 15, { size: 11, color: C.soft, weight: 500 }); ty2 += 38;
    wrap(c, needV ? `Яровизація: ${P.cold} діб холоду ${vernOK ? "— достатньо." : "— замало (потрібно ≈ 40 діб)."}` : "Яровизація: не потрібна (яра форма).", tx, ty2, tw, 15, { size: 11, color: needV && !vernOK ? C.red : C.soft, weight: 500 });
  },
  reads: (S, P) => { const pp = PP[P.mode]; const night = 24 - P.day, ne = P.flash ? Math.min(night, 3) : night; let ok = true; if (P.mode === "sdp") ok = ne > 24 - pp.crit; if (P.mode === "ldp") ok = ne < 24 - pp.crit; const v = !P.winter || P.cold >= 40; return [["Тривалість ночі", fmt(night, 1) + (P.flash ? " (ефективно коротша)" : ""), "год"], ["Фотоперіодична умова", ok ? "виконана" : "не виконана", ""], ["Яровизація", P.winter ? (v ? "достатня" : "недостатня") : "не потрібна", ""], ["Цвітіння", ok && v ? "відбудеться" : "не відбудеться", ""]]; },
});

/* ====================== 7. ЖИТТЄВІ ФОРМИ ЗА РАУНКІЄРОМ (DOM) ====================== */
const RK = [
  { n: "Фанерофіти", d: "Бруньки відновлення високо над землею; стебла не відмирають, листки можуть скидатися.", ex: "дерева, високі кущі", bud: .92 },
  { n: "Хамефіти", d: "Бруньки відновлення невисоко над землею; взимку — під снігом; надземні органи частково відмирають.", ex: "кущики, напівкущики", bud: .62 },
  { n: "Гемікриптофіти", d: "Бруньки на рівні поверхні ґрунту; у несприятливий період уся надземна частина відмирає.", ex: "більшість багаторічних трав", bud: .5 },
  { n: "Криптофіти", d: "Бруньки нижче рівня ґрунту; надземні й частина підземних органів відмирають до бруньок.", ex: "цибулинні, бульбові, кореневищні", bud: .32 },
  { n: "Терофіти", d: "Однорічники: у несприятливий період відмирають усі частини, крім насіння.", ex: "однорічні трави", bud: .5 },
];
function rkSvg(i, winter) {
  const W = 360, H = 220, gy = 130, g = RK[i]; let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${g.n}"><rect width="${W}" height="${H}" rx="12" fill="${winter ? "#E5EEF6" : "#E7F3E7"}"/>`;
  s += `<rect y="${gy}" width="${W}" height="${H - gy}" fill="#8A6A47"/>` + (winter ? `<rect y="${gy - 10}" width="${W}" height="14" fill="#fff" opacity=".92"/>` : "");
  const px = 180, green = winter ? "#9FA89A" : "#5FAE5C", leaf = (x, y, a, r) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .45}" transform="rotate(${a} ${x} ${y})" fill="${green}"/>`;
  let bud = `${px},${gy - 6}`;
  if (i === 0) { const keepLeaves = !winter; s += `<path d="M${px} ${gy} V${gy - 110}" stroke="#7B5A36" stroke-width="12"/><path d="M${px} ${gy - 70} l-44 -30 M${px} ${gy - 90} l46 -28 M${px} ${gy - 40} l-36 -14" stroke="#7B5A36" stroke-width="6" fill="none"/>`; if (keepLeaves) s += [-44, 46, -36].map((x, k) => leaf(px + x, gy - [100, 118, 54][k], k * 20 - 20, 30)).join("") + leaf(px, gy - 120, 0, 34); bud = `${px},${gy - 112}`; }
  if (i === 1) { s += `<path d="M${px} ${gy} V${gy - 42} M${px} ${gy - 30} l-30 -20 M${px} ${gy - 34} l32 -16" stroke="#7B5A36" stroke-width="6" fill="none"/>` + (winter ? "" : leaf(px - 32, gy - 52, -20, 22) + leaf(px + 34, gy - 50, 20, 22) + leaf(px, gy - 48, 0, 24)); bud = `${px},${gy - 44}`; }
  if (i === 2) { s += winter ? `<path d="M${px - 8} ${gy} q-4 -10 -8 -16 M${px + 8} ${gy} q4 -10 8 -14" stroke="#9A8A5B" stroke-width="3" fill="none" opacity=".6"/>` : `<path d="M${px} ${gy} V${gy - 64} M${px} ${gy - 30} l-26 -16 M${px} ${gy - 40} l28 -14" stroke="#4F9D50" stroke-width="4" fill="none"/>` + leaf(px - 28, gy - 48, -20, 20) + leaf(px + 30, gy - 56, 20, 20) + leaf(px, gy - 68, 0, 22); bud = `${px},${gy - 4}`; }
  if (i === 3) { s += `<ellipse cx="${px}" cy="${gy + 22}" rx="16" ry="22" fill="#E7D7A6" stroke="#B59B5B" stroke-width="2"/><path d="M${px - 6} ${gy + 44} v10 M${px} ${gy + 44} v14 M${px + 6} ${gy + 44} v10" stroke="#EADFC2" stroke-width="2"/>` + (winter ? "" : `<path d="M${px} ${gy} V${gy - 70}" stroke="#4F9D50" stroke-width="5"/>` + leaf(px - 26, gy - 40, -30, 24) + leaf(px + 26, gy - 52, 30, 24) + `<circle cx="${px}" cy="${gy - 76}" r="10" fill="#E9A3B8"/>`); bud = `${px},${gy + 8}`; }
  if (i === 4) { s += winter ? `<circle cx="${px - 12}" cy="${gy + 8}" r="4" fill="#C9A55B"/><circle cx="${px + 14}" cy="${gy + 10}" r="4" fill="#C9A55B"/><text x="${px}" y="${gy - 28}" font-size="11" text-anchor="middle" font-weight="700" style="fill:#3F5247">лишилося лише насіння</text>` : `<path d="M${px} ${gy} V${gy - 58}" stroke="#4F9D50" stroke-width="4"/>` + leaf(px - 22, gy - 28, -25, 18) + leaf(px + 22, gy - 38, 25, 18) + `<circle cx="${px}" cy="${gy - 62}" r="8" fill="#E9C84A"/>`; bud = ""; }
  if (bud) s += `<circle cx="${bud.split(",")[0]}" cy="${bud.split(",")[1]}" r="7" fill="none" stroke="#C0392B" stroke-width="2.4"/><text x="${+bud.split(",")[0] + 12}" y="${+bud.split(",")[1] - 12}" font-size="11" font-weight="800" style="fill:#C0392B">бруньки відновлення</text>`;
  return s + `<text x="12" y="${H - 10}" font-size="11" font-weight="700" style="fill:#fff">${winter ? "несприятливий період (зима)" : "вегетація"}</text></svg>`;
}
reg("g-raunk", {
  dom(body) {
    body.innerHTML = `<div class="ph-dom"><div class="ph-chips" id="rk"></div><div class="ph-chips" id="rs" style="margin-top:-4px"></div><div class="ph-panel" style="display:grid;gap:12px;grid-template-columns:minmax(220px,1fr) minmax(220px,1fr);align-items:center"><div id="r-svg"></div><div id="r-txt"></div></div></div>`;
    let sel = 0, winter = false; const chips = body.querySelector("#rk"), seas = body.querySelector("#rs");
    const show = () => { body.querySelector("#r-svg").innerHTML = rkSvg(sel, winter); const g = RK[sel]; body.querySelector("#r-txt").innerHTML = `<h4>${g.n}</h4><p style="margin:0 0 8px">${g.d}</p><p style="margin:0"><small>Приклади: ${g.ex}</small></p>`; [...chips.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === sel))); [...seas.children].forEach((b, i) => b.setAttribute("aria-pressed", String((i === 1) === winter))); };
    RK.forEach((g, i) => chips.append(btn(g.n, "", () => { sel = i; show(); }))); [["Вегетація (літо)", false], ["Несприятливий період (зима)", true]].forEach(([n, w]) => seas.append(btn(n, "", () => { winter = w; show(); }))); show();
    const st = document.createElement("style"); st.textContent = "@media(max-width:640px){.ph-panel{grid-template-columns:1fr!important}}"; body.append(st);
  },
});
