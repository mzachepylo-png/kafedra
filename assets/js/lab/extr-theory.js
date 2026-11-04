/* Теорія екстракції: кінетика (закон Фіка), карта розчинників, ланцюг «від поля до концентрату». */
import { reg, D, C, clamp, lerp, rng, fmt, mixHex, alpha, extractColor, el, btn } from "./extr-core.js";

/* ====================== КІНЕТИКА: dM/dt = K·F·(Cs − C) ====================== */
const RET = 3;   // «утримання» рідини сировиною, мл/г
const dFac = (T) => Math.exp(2405 * (1 / 293.15 - 1 / (T + 273.15)));
function yieldCurve(P, t, nPort) {
  const k = .06 * dFac(P.T) / Math.pow(P.d, 2) * (1 + 3 * P.stir / 100), Ttot = 180, R = P.R;
  const nP = nPort, seg = Ttot / nP, ph = (R / nP) / (R / nP + RET);
  let rem = 1, Y = 0; const j = Math.min(nP - 1, Math.floor(t / seg)); let out = 0;
  for (let i = 0; i < j; i++) { const ex = rem * ph * (1 - Math.exp(-k * seg)); rem -= ex; out += ex; }
  const tt = t - j * seg, ex = rem * ph * (1 - Math.exp(-k * tt)); out += ex;
  const kd = P.lab ? .0007 * Math.exp((P.T - 60) / 9) : 0; return out * Math.exp(-kd * t);
}
reg("kin", {
  aspect: 1.65,
  params: [
    { k: "d", label: "Розмір частинок", min: .1, max: 5, step: .1, v: 2, u: "мм", d: 1 },
    { k: "T", label: "Температура", min: 20, max: 90, step: 1, v: 30, u: "°C" },
    { k: "stir", label: "Перемішування", min: 0, max: 100, step: 5, v: 30, u: "%" },
    { k: "R", label: "Екстрагент на 1 г сировини", min: 2, max: 50, step: 1, v: 10, u: "мл/г" },
    { k: "n", label: "Кількість порцій екстрагенту", min: 1, max: 6, step: 1, v: 1 },
  ],
  toggles: [{ k: "lab", label: "Цільова сполука термолабільна (деградує при нагріванні)", v: false }],
  info: "Швидкість масопередачі <b>dM/dt = K·F·(C<sub>s</sub> − C)</b>: збільшити її можна більшою площею контакту F (дрібніше подрібнення, руйнування клітин), більшим градієнтом (C<sub>s</sub> − C): свіжий екстрагент, більше розчинника), вищим K (нагрівання, перемішування). Але дуже дрібний порошок злипається й забиває фільтр (орієнтир: листя та квіти 3–5 мм, корені й кора 1–3 мм для класичних методів; 0,25–0,5 мм для UAE/MAE/SFE). Кілька порцій при тому самому сумарному об'ємі ефективніші за одну.",
  init() { const r = rng(2), dots = []; for (let i = 0; i < 30; i++) dots.push({ a: r() * 6.28, s: r(), v: .5 + r() }); return { dots, t: 0 }; },
  step(S, P, dt) { S.t += dt * 12; for (const d of S.dots) { d.s += dt * d.v * .4; if (d.s > 1) d.s -= 1; } },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const tm = Math.min(S.t % 200, 180), Y1 = yieldCurve(P, tm, 1), Yn = yieldCurve(P, tm, P.n);
    // частинка
    const cx = W * .2, cy = H * .42, R0 = 20 + P.d * 15, k = .06 * dFac(P.T) / Math.pow(P.d, 2) * (1 + 3 * P.stir / 100), left = Math.exp(-k * tm);
    const delta = 14 / (1 + 3 * P.stir / 100) + 3;
    const bl = c.createRadialGradient(cx, cy, R0, cx, cy, R0 + delta + 14); bl.addColorStop(0, "rgba(201,138,27,.35)"); bl.addColorStop(1, "rgba(201,138,27,0)"); c.fillStyle = bl; c.beginPath(); c.arc(cx, cy, R0 + delta + 14, 0, 7); c.fill();
    c.strokeStyle = "rgba(60,80,70,.4)"; c.setLineDash([4, 4]); c.beginPath(); c.arc(cx, cy, R0 + delta, 0, 7); c.stroke(); c.setLineDash([]);
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R0); g.addColorStop(0, mixHex("#D9B25A", "#CFE6B8", 1 - left)); g.addColorStop(1, mixHex("#9FB36A", "#CFE6B8", 1 - left * .6)); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R0, 0, 7); c.fill(); c.strokeStyle = "#4F8F45"; c.lineWidth = 3; c.stroke();
    for (const d of S.dots) { const r = R0 + 2 + d.s * (delta + 60), x = cx + Math.cos(d.a) * r, y = cy + Math.sin(d.a) * r; D.sphere(c, x, y, 2.6, "#C98A1B", (1 - d.s) * .9 * (.3 + left * .7)); }
    D.txt(c, "частинка сировини", cx, cy - R0 - delta - 22, { size: 11.5, align: "center", weight: 700, color: C.soft });
    D.txt(c, "дифузійний шар", cx + R0 + delta * .6 + 8, cy + R0 + delta + 12, { size: 10.5, color: C.amber, weight: 600 });
    D.txt(c, `площа поверхні F ∝ 1/d: ×${fmt(2 / P.d, 1)}`, cx, cy + R0 + delta + 34, { size: 11, align: "center", color: C.soft });
    D.txt(c, `K ∝ D(T): ×${fmt(dFac(P.T), 1)} відносно 20 °C`, cx, cy + R0 + delta + 52, { size: 11, align: "center", color: C.soft });
    if (P.d < .15) D.tag(c, "надто дрібно: злипання, забите фільтрування", cx, 24, { size: 11, bg: "#FDECEA", stroke: C.red, color: C.red });
    // графіки
    const gx = W * .42 + 26, gw = W * .54 - 26, g1y = 40, g1h = H * .38, xs = []; for (let x = 0; x <= 180; x += 3) xs.push(x);
    D.chart(c, gx, g1y, gw, g1h, { x: [0, 180], y: [0, 100], xl: "хв", yl: "вилучено, %", series: [{ pts: xs.map(x => [x, yieldCurve(P, x, 1) * 100]), col: C.steel, w: 2.2, dash: [5, 4] }, { pts: xs.map(x => [x, yieldCurve(P, x, P.n) * 100]), col: C.green, w: 2.8, fill: "rgba(47,125,79,.1)" }], marks: [{ x: tm, y: Yn * 100, col: C.red }], title: `Кінетика: ${P.n} ${P.n === 1 ? "порція" : P.n < 5 ? "порції" : "порцій"} проти однієї` });
    const g2y = g1y + g1h + 64, g2h = H - g2y - 30; const ns = [1, 2, 3, 4, 5, 6];
    D.chart(c, gx, g2y, gw, g2h, { x: [.5, 6.5], y: [0, 100], xl: "кількість порцій", yl: "вихід за 3 год, %", xt: ns, series: [{ pts: ns.map(n => [n, yieldCurve(P, 180, n) * 100]), col: C.green, w: 2.6, bars: false }], marks: ns.map(n => ({ x: n, y: yieldCurve(P, 180, n) * 100, col: n === P.n ? C.red : C.green, r: n === P.n ? 6 : 4 })), title: "Той самий сумарний об'єм, розділений на порції" });
    c.fillStyle = C.steel; c.fillRect(gx, g1y + g1h + 34, 14, 4); D.txt(c, "одна порція", gx + 20, g1y + g1h + 36, { size: 11, color: C.soft }); c.fillStyle = C.green; c.fillRect(gx + 100, g1y + g1h + 34, 14, 4); D.txt(c, "вибране число порцій", gx + 120, g1y + g1h + 36, { size: 11, color: C.soft });
  },
  reads: (S, P) => [["Вихід за 3 год (1 порція)", fmt(yieldCurve(P, 180, 1) * 100, 0), "%"], ["Вихід за 3 год (n порцій)", fmt(yieldCurve(P, 180, P.n) * 100, 0), "%"], ["k (відн.)", fmt(.06 * dFac(P.T) / Math.pow(P.d, 2) * (1 + 3 * P.stir / 100), 3), "хв⁻¹"]],
});

/* ====================== КАРТА РОЗЧИННИКІВ (DOM) ====================== */
const SOLV = [
  { id: "hex", n: "н-гексан", e: 1.9, ich: 2, row: 0, note: "клас 2, 290 ppm: жирні олії, воски, каротиноїди" },
  { id: "co2", n: "надкритичний CO₂", e: 1.3, ich: 0, row: 1, note: "без залишку; ліпофільні БАР, з етанолом — флавоноїди" },
  { id: "oil", n: "рослинні олії", e: 3, ich: 0, row: 2, note: "каротиноїди, токофероли; олійні мацерати" },
  { id: "eth", n: "діетиловий ефір", e: 4.3, ich: 3, row: 0, note: "легко відганяється; пероксиди, вибухонебезпечний" },
  { id: "chl", n: "хлороформ", e: 4.8, ich: 2, row: 1, note: "клас 2, 60 ppm; лише аналітика" },
  { id: "eoa", n: "етилацетат", e: 6.0, ich: 3, row: 2, note: "агліконів флавоноїдів, катехіни, фенольні кислоти" },
  { id: "dcm", n: "дихлорметан", e: 8.9, ich: 2, row: 0, note: "клас 2, 600 ppm; алкалоїди-основи, кофеїн" },
  { id: "ace", n: "ацетон", e: 20.7, ich: 3, row: 1, note: "поліфеноли, проантоціанідини (50–70 % водний), каротиноїди" },
  { id: "etoh", n: "етанол", e: 24.5, ich: 3, row: 2, note: "основний фармакопейний екстрагент; 96 % — смоли, ефірні олії; 40–70 % — глікозиди" },
  { id: "meoh", n: "метанол", e: 32.7, ich: 2, row: 0, note: "клас 2, 3000 ppm; аналітика" },
  { id: "gly", n: "гліцерин", e: 42.5, ich: 0, row: 1, note: "гліцеринові витяжки; в'язкий, не відганяється" },
  { id: "h2o", n: "вода", e: 80.1, ich: 0, row: 2, note: "полісахариди, дубильні речовини, глікозиди, солі алкалоїдів" },
];
const CLS = [
  { n: "Флавоноїди (глікозиди)", pol: "глікозиди — полярні", s: ["etoh", "h2o"], m: "перколяція, UAE, MAE", alt: "PLE, EAE + UAE; розчинник NADES" },
  { n: "Аглікони флавоноїдів, катехіни", pol: "середньої полярності", s: ["etoh", "eoa"], m: "UAE, мацерація", alt: "SFE + 10–15 % етанолу" },
  { n: "Фенольні кислоти", pol: "полярні", s: ["etoh", "h2o"], m: "UAE, гаряча вода", alt: "SWE 120–160 °C, PEF" },
  { n: "Дубильні речовини", pol: "полярні, високомолекулярні", s: ["h2o", "ace", "etoh"], m: "відвар, мацерація, UAE", alt: "SWE, NADES" },
  { n: "Алкалоїди", pol: "солі — полярні; основи — ліпофільні", s: ["h2o", "etoh", "dcm", "chl", "eoa"], m: "кислотно-основна екстракція", alt: "SFE (кофеїн), PLE" },
  { n: "Ефірні олії", pol: "неполярні, леткі", s: ["h2o", "co2"], m: "гідродистиляція, парова дистиляція", alt: "SFE-CO₂, SFME, MAHD" },
  { n: "Сапоніни", pol: "амфіфільні", s: ["etoh", "meoh", "h2o"], m: "мацерація, UAE", alt: "NADES, PLE" },
  { n: "Серцеві глікозиди", pol: "середньо-полярні", s: ["etoh", "chl"], m: "перколяція, реперколяція (після стабілізації сировини)", alt: "UAE" },
  { n: "Антраглікозиди", pol: "полярні (глікозиди)", s: ["etoh", "h2o"], m: "перколяція, мацерація", alt: "UAE, MAE" },
  { n: "Кумарини", pol: "середня полярність", s: ["etoh", "meoh", "chl"], m: "Сокслет, UAE", alt: "SFE з модифікатором" },
  { n: "Каротиноїди", pol: "дуже неполярні", s: ["co2", "hex", "ace", "eoa", "oil"], m: "SFE-CO₂, олійна мацерація", alt: "UAE в олії, EAE + пресування" },
  { n: "Полісахариди", pol: "дуже полярні, ВМС", s: ["h2o"], m: "гаряча вода → осадження етанолом", alt: "UAE, EAE, SWE, MAE" },
  { n: "Жирні олії", pol: "неполярні", s: ["hex", "co2"], m: "холодне пресування", alt: "SFE-CO₂, 2-метилоксолан" },
  { n: "Вітамін C", pol: "полярний", s: ["h2o"], m: "холодна водна екстракція (1–3 % метафосфорна або щавлева кислота)", alt: "—" },
  { n: "Токофероли / вітамін E", pol: "ліпофільні", s: ["co2", "hex", "oil"], m: "SFE-CO₂", alt: "олійна мацерація" },
];
const ICH_COL = { 0: ["#2F7D4F", "безпечні / поза Q3C"], 3: ["#5BA46A", "ICH клас 3: низька токсичність"], 2: ["#C98A1B", "ICH клас 2: обмежувати"] };
reg("solvents", {
  dom(body) {
    const wrap = el("div", "ex-pol"); const chips = el("div", "ex-chips"); const axis = el("div", "ex-pol__axis"); const info = el("div", "ex-pol__info");
    const pos = (e) => 7 + clamp(Math.log10(e) / Math.log10(85), 0, 1) * 86;
    const pills = {}; for (const s of SOLV) { const p = el("button", "ex-pol__pill"); p.type = "button"; p.textContent = s.n; p.style.left = pos(s.e) + "%"; p.style.top = 12 + s.row * 38 + "px"; p.style.setProperty("--c", ICH_COL[s.ich][0]); p.title = `ε ≈ ${fmt(s.e, 1)}; ${s.note}`; p.addEventListener("click", () => showSolv(s)); axis.append(p); pills[s.id] = p; }
    const ticks = [[1.5, "1,5"], [5, "5"], [10, "10"], [20, "20"], [40, "40"], [80, "80"]]; for (const [e, t] of ticks) { const tk = el("span", "ex-pol__tick"); tk.style.left = pos(e) + "%"; tk.textContent = t; axis.append(tk); }
    const lab = el("div", "ex-pol__ends"); lab.innerHTML = "<span>← неполярні (ліпофільні БАР)</span><b>діелектрична проникність ε</b><span>полярні (гідрофільні БАР) →</span>";
    const leg = el("div", "ex-pol__leg"); for (const k of [0, 3, 2]) { const i = el("span"); i.innerHTML = `<i style="background:${ICH_COL[k][0]}"></i>${ICH_COL[k][1]}`; leg.append(i); }
    let cur = 0;
    const show = (i) => {
      cur = i; [...chips.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i))); const k = CLS[i];
      for (const id in pills) pills[id].classList.toggle("on", k.s.includes(id)); for (const id in pills) pills[id].classList.toggle("dim", !k.s.includes(id));
      const names = k.s.map(id => SOLV.find(x => x.id === id).n).join(" → ");
      info.innerHTML = `<h4>${k.n}</h4><dl><dt>Полярність цілі</dt><dd>${k.pol}</dd><dt>Розчинники (за пріоритетом)</dt><dd>${names}</dd><dt>Методи першого вибору</dt><dd>${k.m}</dd><dt>Альтернативи</dt><dd>${k.alt}</dd></dl><p class="ex-pol__hint">Клікніть на назву розчинника, щоб побачити примітку.</p>`;
    };
    const showSolv = (s) => { const k = CLS[cur]; info.insertAdjacentHTML("beforeend", ""); const n = info.querySelector(".ex-pol__hint"); if (n) n.innerHTML = `<b>${s.n}</b> (ε ≈ ${fmt(s.e, 1)}): ${s.note}.`; };
    CLS.forEach((k, i) => chips.append(btn(k.n, "", () => show(i))));
    wrap.append(chips, axis, lab, leg, info); body.append(wrap); show(0);
  },
});

/* ====================== ЛАНЦЮГ «ВІД ПОЛЯ ДО КОНЦЕНТРАТУ» (DOM) ====================== */
const CHAIN = [
  { n: "GACP-збір", t: "Правильний вид, хемотип і фенофаза", body: "Точна ботанічна ідентифікація (латинська назва, хемотип). Листя — перед цвітінням або на його початку; трава й квітки — у масове цвітіння; плоди — повністю стиглі; корені й кореневища — восени чи рано навесні; кора — навесні в сокорух. Збирати в суху погоду; ефіроолійні рослини — вранці після висихання роси.", risk: "Помилка у фенофазі або хемотипі змінює вміст БАР сильніше, ніж вибір методу екстракції.", ctl: "Паспорт сировини, партія, дата й місце збору." },
  { n: "Сушіння", t: "Швидко й щадно", body: "Тіньове (20–30 °C) — для кольору й летких; конвективне 35–45 °C для ефіроолійних, 50–60 °C для глікозидних; ліофілізація — найкраще для термолабільних, але для Lamiaceae не завжди найкраща. Сонячне сушіння руйнує хлорофіл, флавоноїди й каротиноїди.", risk: "Цвіль, ферментативне окиснення, втрати летких при T > 60 °C.", ctl: "Втрата в масі при висушуванні ≤ 10–14 %." },
  { n: "Подрібнення", t: "Розмір частинок під метод", body: "Листя й квітки 3–5 мм, трава 3–7 мм, корені й кора 1–3 мм для класичних методів; 0,25–0,5 мм для UAE/MAE/SFE. Для ефіроолійної та ліпідної сировини — кріоподрібнення (рідкий N₂, сухий лід).", risk: "Надто дрібний порошок злипається, забиває перколятор і фільтр; надто грубий — довга дифузія.", ctl: "Ситовий аналіз." },
  { n: "Екстракція", t: "Метод, розчинник, T, час", body: "Метод визначають полярність і термостабільність цілі, масштаб та регуляторний статус продукту. Кілька порцій ефективніші за одну; після досягнення плато подовження часу лише збільшує домішки й деградацію.", risk: "Деградація термолабільних БАР, екстракція баласту, залишки розчинника.", ctl: "Параметри процесу (T, t, співвідношення) в протоколі." },
  { n: "Відділення шроту", t: "Відстоювання, віджим, фільтрування", body: "Відстоювання 2–10 діб при 8–10 °C; віджим шроту повертає 10–30 % витяжки; друк-, патронні, вакуум-фільтри; кізельгур і перліт як допоміжні; центрифугування (4000–5000 g, 10–15 хв у лабораторії).", risk: "Втрати витяжки зі шротом; каламутність.", ctl: "Прозорість, сухий залишок." },
  { n: "Очищення", t: "Фракціонування, смоли, мембрани", body: "Рідинно-рідинне фракціонування за полярністю, осадження, адсорбція, макропористі смоли (AB-8, D101), SPE, мембрани (мікро-, ультра-, нанофільтрація), колонкова хроматографія. Для софори тонкінської смола AB-8 підвищила вміст флавоноїдів з 12,14 до 57,82 % при виході 84,93 %.", risk: "Втрата цільових сполук; «чистота» за колориметрією ≠ чистота за ВЕРХ.", ctl: "ВЕРХ-маркери, залишкові розчинники." },
  { n: "Концентрування й сушіння", t: "Вакуум, плівкові апарати, ліофілізація", body: "Концентрувати під зниженим тиском при мінімальній температурі (ротаційний випарник 35–50 °C, 20–200 мбар); плівкові апарати — секунди контакту. Сушіння: розпилювальне (вхід 140–200 °C, вихід 60–90 °C), сублімаційне, вакуумне; інкапсуляція підвищує стабільність.", risk: "Піноутворення, налипання цукристих екстрактів, втрата летких.", ctl: "Вологість сухого екстракту ≤ 5 %, DER, стабільність (ICH Q1A)." },
];
reg("chain", {
  dom(body) {
    const wrap = el("div", "ex-chain"); const row = el("div", "ex-chain__row"); const card = el("div", "ex-chain__card");
    CHAIN.forEach((s, i) => { const b = btn("", "ex-chain__step", () => show(i)); b.innerHTML = `<span>${i + 1}</span><b>${s.n}</b>`; row.append(b); });
    const show = (i) => { [...row.children].forEach((b, j) => { b.setAttribute("aria-pressed", String(j === i)); b.classList.toggle("done", j < i); }); const s = CHAIN[i]; card.innerHTML = `<h4>${i + 1}. ${s.n}<small>${s.t}</small></h4><p>${s.body}</p><div class="ex-chain__meta"><div><b>Ризик</b><p>${s.risk}</p></div><div><b>Контроль</b><p>${s.ctl}</p></div></div>`; };
    wrap.append(row, card); body.append(wrap); show(0);
  },
});
