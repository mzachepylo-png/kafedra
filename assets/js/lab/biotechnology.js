// Біотехнологія в агросфері (за навч. посібником М. Д. Мельничука, О. Л. Кляченко, НУБіП України, 2014):
// ядро інтерактивних математичних моделей та візуалізацій (13 тем, 55 лабораторних робіт).
"use strict";

const LABS = [
  {
    n: 1,
    labs: "ЛР 1–4",
    pages: "50–57",
    short: "Живильні середовища",
    tag: "автоклав · МС / B₅ / Уайт · pH",
    title: "Приготування та стерилізація живильних середовищ і маточних розчинів",
    model: "N(t) = N₀·10^(−∫dt/D(T)) · D(T) = D₁₂₁·10^(−(T−121)/z) · Ψₛ = −ΣiₖCₖRT · I = ½Σcᵢzᵢ²"
  },
  {
    n: 2,
    labs: "ЛР 5–12",
    pages: "57–63",
    short: "Стерилізація та полярність",
    tag: "експлантати · PIN-ауксин · морква",
    title: "Стерилізація рослинного матеріалу, ізоляція експлантатів та фізіологічна полярність",
    model: "η(t) = (1 − e^(−kₘCⁿt))^N₀ · (1 + (t/τₜₒₓ)ᵐ)⁻¹ · ∂A/∂t = D·∂²A/∂x² − v_PIN·∂A/∂x − k_d·A"
  },
  {
    n: 3,
    labs: "ЛР 13–14",
    pages: "63–78",
    short: "Ріст калюсних культур",
    tag: "S-крива (5 фаз) · Браун · Фукс–Розенталь",
    title: "Динаміка росту калюсних культур, дія фітогормонів та підрахунок клітин у камері Фукса–Розенталя",
    model: "ΔW = (Wₜ − W₀)/W₀ · dW/dt = μ(S,Г)·W·(1 − W/Wₘₐₓ) · N = n·V·10³ / (d·0,2)"
  },
  {
    n: 4,
    labs: "ЛР 15–17",
    pages: "79–85",
    short: "Органогенез і ембріогенез",
    tag: "Скуг–Міллер · 2,4-Д · глобула→торпедо",
    title: "Індукція морфогенезу, стеблового й кореневого органогенезу та соматичного ембріогенезу in vitro",
    model: "R = [Ауксин]/[Цитокінін] · dEᵢ/dt = kᵢ₋₁Eᵢ₋₁ − kᵢEᵢ (ПЕМ → глобула → сердечко → торпедо)"
  },
  {
    n: 5,
    labs: "ЛР 18–22",
    pages: "85–92",
    short: "Суспензійні культури",
    tag: "шейкер k_La · агрегація · синій Еванса",
    title: "Суспензійні культури клітин: агрегованість, підрахунок щільності, життєздатність і кінетика росту",
    model: "X = M·N·1000 / 3,2 · V = N_жив/N_заг·100% · dX/dt = μₘₐₓ·S/(Kₛ+S)·X · dO₂/dt = k_La(O₂* − O₂) − q_O₂X"
  },
  {
    n: 6,
    labs: "ЛР 23",
    pages: "93–97",
    short: "Клітинна селекція",
    tag: "стрептоміцин · мутанти · IC₅₀",
    title: "Клітинна селекція in vitro: відбір резистентних до стрептоміцину ліній Nicotiana tabacum L.",
    model: "dN_S/dt = (μ₀/(1+(C/IC₅₀)ʰ) − k_bl)N_S · dN_R/dt = μ_R·N_R + m·μ₀·N_S"
  },
  {
    n: 7,
    labs: "ЛР 24–25",
    pages: "98–105",
    short: "Ізольовані протопласти",
    tag: "плазмоліз 0,3–0,7 М · W-5/K-3 · ПЕГ-злиття",
    title: "Механічне та ферментативне виділення протопластів, флотаційне очищення й соматична гібридизація",
    model: "Ψ_w = −iCRT + P · v_флот = 2r²(ρ_f − ρ_p)g / 9η · P(k) = λᵏe^(−λ)/k!"
  },
  {
    n: 8,
    labs: "ЛР 26–30",
    pages: "106–117",
    short: "Мікроклональне розмноження",
    tag: "апікальна меристема · термотерапія · мікробульби",
    title: "Мікроклональне розмноження, оздоровлення апікальних меристем від вірусів, мікробульби та акліматизація",
    model: "Nₘ = N₀·Kᵐ · I = Lₜ/L₀ · P_VF(L,T,C) = e^(−λ_v(T,C)·L²) · P_reg(L) = 1 − e^(−(L/L₀)³)"
  },
  {
    n: 9,
    labs: "ЛР 31–37",
    pages: "117–132",
    short: "Культура органів і біотести",
    tag: "калюс сої · топінамбур · стевія / гвоздика",
    title: "Культура ізольованих органів та біотест-системи на цитокініни, ауксини й гіберелову кислоту",
    model: "W(C) = W₀ + Wₘₐₓ·Cⁿ / (EC₅₀ⁿ + Cⁿ + (C/Kᵢ)²) · I_росту = Lₜ / L₀"
  },
  {
    n: 10,
    labs: "ЛР 38–40",
    pages: "132–140",
    short: "Гаплоїди та ембріокультура",
    tag: "андрогенез ріпаку · гіногенез · embryo rescue",
    title: "Гаплоїдна біотехнологія (культура пиляків і незапилених зав’язей) та ембріокультура незрілих зародків",
    model: "мікроспора (n) → +4 °C шок → ембріоїд (n) → колхіцин → DH (2n) · H_k = 1 − (½)ᵏ"
  },
  {
    n: 11,
    labs: "ЛР 41–50",
    pages: "142–183",
    short: "Генетична інженерія і ДНК/РНК",
    tag: "Agrobacterium · pBR322 · D₂₆₀/D₂₈₀ · електрофорез",
    title: "Агробактеріальна трансформація, виділення й ампліфікація плазмідної ДНК, спектрофотометрія та електрофорез",
    model: "C_ДНК = D₂₆₀·50·K · C_РНК = D₂₆₀·40·K · R = D₂₆₀/D₂₈₀ · lg(bp) = a − b·Rf"
  },
  {
    n: 12,
    labs: "ЛР 51–53",
    pages: "184–190",
    short: "Пероксидаза та ПФО",
    tag: "гваякол 470 нм · ПААГ Девіса Rf · ПФО 420 нм",
    title: "Окисно-відновні ферменти як біохімічні маркери стресу: активність та ізоферментний спектр у ПААГ",
    model: "A = (D₂ − D₁)·V·V₂·60 / ((t₂ − t₁)·V₁·H) · Rf = l_смуги / l_бромфенолового синього"
  },
  {
    n: 13,
    labs: "ЛР 54–55",
    pages: "191–201",
    short: "Кріобанки та кріопротектори",
    tag: "сахароза + гліцерин · буряк −20 °C · коагуляція білків",
    title: "Кріозбереження рослинного матеріалу: захисна дія кріопротекторів на клітини буряку та білки клітинного соку",
    model: "dV/dt = −L_p·A·(RT/v_w)·ln(p_i/p_e) · Вихід бетаціаніну D₅₃₈ · % плазмолізу у 8% NaCl"
  }
];

/* ============ CORE ============ */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RG = 8.314; // Дж/(моль·К)
function fmt(x, d = 2) {
  if (!isFinite(x)) return "—";
  return x.toFixed(d).replace("-", "−").replace(".", ",");
}
function fmtSig(x, s = 3) {
  if (!isFinite(x)) return "—";
  if (x === 0) return "0";
  const d = Math.max(0, s - 1 - Math.floor(Math.log10(Math.abs(x))));
  return fmt(x, Math.min(d, 6));
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }
function hash01(i, s = 0) { let x = Math.imul(i + 1, 374761393) ^ Math.imul(s + 1, 668265263); x = Math.imul(x ^ (x >>> 13), 1274126177); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- theme tokens readable from canvas ---- */
const Theme = {
  c: {}, v: 0,
  read() {
    const cs = getComputedStyle(document.documentElement);
    const defaults = {
      paper: "#ECF0EA", sheet: "#F8FAF6", stage: "#F3F5EF", ink: "#16221A",
      muted: "#58695E", rule: "#C9D4CB", chl: "#2C7A4D", "chl-soft": "#DCEBE0",
      antho: "#9A2E66", carot: "#C77A12", data: "#2A6A93", warn: "#B4541A",
      good: "#2C7A4D", bad: "#B3363A"
    };
    for (const k of Object.keys(defaults)) {
      this.c[k] = cs.getPropertyValue("--" + k).trim() || defaults[k];
    }
    this.c.accent = this.c.chl;
    this.c.gold = this.c.carot;
    this.c.blue = this.c.data;
    this.c.green = this.c.good;
    this.c.red = this.c.bad;
    this.c.amber = this.c.warn;
    this.c.Leave = this.c.bad;
    this.dark = this.lum(this.c.paper) < 0.4;
    this.v++;
  },
  lum(hex) { const n = parseInt((hex || "#ECF0EA").slice(1), 16); return (((n >> 16) & 255) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) / 255; },
};
function rgba(hex, a) {
  if (!hex || hex[0] !== "#") return `rgba(22,34,26,${a})`;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(lerp((A >> s) & 255, (B >> s) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
Theme.read();
matchMedia("(prefers-reduced-motion: reduce)");
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { Theme.read(); App.dirtyAll(); });
new MutationObserver(() => { Theme.read(); App.dirtyAll(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

/* ---- canvas stage with DPR + resize ---- */
class Stage {
  constructor(parent, { aspect = 16 / 9, minH = 200, maxH = 520, tag = null, chart = false, minW = 0 } = {}) {
    this.wrap = h("div", { class: "stage" });
    this.el = this.wrap;
    this.cv = h("canvas");
    this.wrap.append(this.cv);
    if (tag) this.wrap.append(h("span", { class: "tag" }, tag));
    parent.append(this.wrap);
    this.wrap._st = this;
    this.ctx = this.cv.getContext("2d");
    this.aspect = aspect; this.minH = minH; this.maxH = maxH; this.minW = minW;
    this.W = 300; this.H = 200; this.w = 300; this.h = 200; this.dirty = true;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.wrap);
    this.mouse = null;
    this.cv.addEventListener("pointermove", (e) => { const r = this.cv.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; this.dirty = true; });
    this.cv.addEventListener("pointerleave", () => { this.mouse = null; this.dirty = true; });
  }
  resize() {
    const avail = this.wrap.clientWidth || 300, w = Math.max(innerWidth <= 700 ? this.minW : 0, avail), wide = w > avail + 1;
    const hh = Math.round(clamp(w / this.aspect, this.minH, this.maxH));
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.cv.style.width = wide ? w + "px" : ""; this.wrap.classList.toggle("xscroll", wide);
    if (wide && !this.hint) { this.hint = h("div", { class: "xhint" }, "↔ Проведіть схему вбік"); this.wrap.after(this.hint); }
    if (this.hint) this.hint.hidden = !wide;
    if (wide && !this.centered && this.wrap.clientWidth) { this.centered = true; this.wrap.scrollLeft = (w - avail) / 2; }
    if (!wide) this.centered = false;
    this.cv.style.height = hh + "px";
    this.cv.width = Math.round(w * d); this.cv.height = Math.round(hh * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.W = w; this.H = hh; this.w = w; this.h = hh; this.d = d; this.dirty = true;
  }
  clear(bg) { const c = this.ctx; c.fillStyle = bg || Theme.c.stage; c.fillRect(0, 0, this.W, this.H); }
}

/* ---- chart drawing (to scale, theme-aware) ---- */
function niceTicks(a, b, n = 5) {
  const span = b - a; if (span <= 0) return [a];
  const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
  const out = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
  return out;
}
function tickFmt(v) {
  const a = Math.abs(v);
  if (Number.isInteger(v) && a < 1000) return fmt(v, 0);
  if (a >= 1000) return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (a >= 10 || v === 0) return fmt(v, Number.isInteger(v) ? 0 : 1);
  return fmt(v, a >= 1 ? (Number.isInteger(v * 2) ? 1 : 2) : (Number.isInteger(v * 10) ? 1 : 2));
}
function drawChart(st, a2, a3, a4) {
  const isSt = st && st.ctx;
  const c = isSt ? st.ctx : st, W = isSt ? st.W : a2, H = isSt ? st.H : a3, o = isSt ? a2 : a4, T = Theme.c;
  c.fillStyle = T.sheet; c.fillRect(0, 0, W, H);
  const L = o.padL ?? 46, R = o.padR ?? 12, Tp = o.padT ?? 12, B = o.spectrum ? 40 : 34;
  const pw = W - L - R, ph = H - Tp - B;
  const lx = (v) => o.xlog ? Math.log10(Math.max(1e-9, v)) : v, ly = (v) => o.ylog ? Math.log10(Math.max(1e-9, v)) : v;
  const [x0, x1] = o.x.map(lx), [y0, y1] = o.y.map(ly);
  const X = (v) => L + (lx(v) - x0) / ((x1 - x0) || 1) * pw;
  const Y = (v) => Tp + ph - (ly(v) - y0) / ((y1 - y0) || 1) * ph;
  const xt = o.xt || (o.xlog ? logTicks(o.x) : niceTicks(o.x[0], o.x[1], Math.max(3, Math.floor(pw / 70))));
  const yt = o.yt || (o.ylog ? logTicks(o.y) : niceTicks(o.y[0], o.y[1], Math.max(3, Math.floor(ph / 38))));
  c.font = "11px " + getComputedStyle(document.body).getPropertyValue("--f-mono");
  c.lineWidth = 1;
  if (o.band) for (const b of o.band) { c.fillStyle = b.color; c.fillRect(X(b.x0), Tp, X(b.x1) - X(b.x0), ph); }
  for (const v of yt) { const y = Math.round(Y(v)) + .5; c.strokeStyle = rgba(T.ink, .08); c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); c.fillStyle = T.muted; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText((o.yfmt || tickFmt)(v), L - 6, y); }
  for (const v of xt) { const x = Math.round(X(v)) + .5; c.strokeStyle = rgba(T.ink, .05); c.beginPath(); c.moveTo(x, Tp); c.lineTo(x, Tp + ph); c.stroke(); c.fillStyle = T.muted; c.textAlign = "center"; c.textBaseline = "top"; c.fillText((o.xfmt || tickFmt)(v), x, Tp + ph + (o.spectrum ? 12 : 6)); }
  if (o.spectrum) { for (let x = 0; x < pw; x++) { const lam = lerp(o.x[0], o.x[1], x / pw); c.fillStyle = Spectral.lambdaToRGB(lam); c.fillRect(L + x, Tp + ph + 2, 1.2, 7); } }
  c.strokeStyle = T.rule; c.strokeRect(L + .5, Tp + .5, pw, ph);
  c.save(); c.beginPath(); c.rect(L, Tp, pw, ph); c.clip();
  for (const hl of o.hl || []) { c.strokeStyle = hl.color || T.muted; c.setLineDash(hl.dash || [4, 4]); c.beginPath(); c.moveTo(L, Y(hl.y)); c.lineTo(L + pw, Y(hl.y)); c.stroke(); c.setLineDash([]); if (hl.label) { c.fillStyle = hl.color || T.muted; c.textAlign = "right"; c.textBaseline = "bottom"; c.fillText(hl.label, L + pw - 4, Y(hl.y) - 3); } }
  for (const vl of o.vl || []) { c.strokeStyle = vl.color || T.muted; c.setLineDash(vl.dash || [4, 4]); c.beginPath(); c.moveTo(X(vl.x), Tp); c.lineTo(X(vl.x), Tp + ph); c.stroke(); c.setLineDash([]); if (vl.label) { c.fillStyle = vl.color || T.muted; c.textAlign = vl.align || "left"; c.textBaseline = "top"; c.fillText(vl.label, X(vl.x) + (vl.align === "right" ? -4 : 4), Tp + 4); } }
  for (const s of o.series || []) {
    if (!s.pts || !s.pts.length) continue;
    if (s.bars) {
      const bw = s.bw ?? (pw / Math.max(1, s.pts.length) * 0.58);
      for (const [x, y] of s.pts) { c.fillStyle = s.color; c.fillRect(X(x) - bw / 2, Y(y), bw, Y(o.y[0]) - Y(y)); }
      continue;
    }
    if (s.fill) {
      c.beginPath(); c.moveTo(X(s.pts[0][0]), Y(o.y[0]));
      for (const [x, y] of s.pts) c.lineTo(X(x), Y(y));
      c.lineTo(X(s.pts[s.pts.length - 1][0]), Y(o.y[0])); c.closePath(); c.fillStyle = s.fill; c.fill();
    }
    c.beginPath(); c.strokeStyle = s.color; c.lineWidth = s.w || 2.2; c.lineJoin = "round"; c.setLineDash(s.dash || []);
    s.pts.forEach(([x, y], i) => { const px = X(x), py = Y(y); i ? c.lineTo(px, py) : c.moveTo(px, py); });
    c.stroke(); c.setLineDash([]); c.lineWidth = 1;
    if (s.dots) for (const [x, y] of s.pts) { c.beginPath(); c.arc(X(x), Y(y), s.dots, 0, 7); c.fillStyle = s.color; c.fill(); }
  }
  for (const m of o.marks || []) {
    c.beginPath(); c.arc(X(m.x), Y(m.y), m.r || 4.5, 0, 7); c.fillStyle = m.color || T.ink; c.fill();
    c.strokeStyle = T.sheet; c.lineWidth = 1.5; c.stroke(); c.lineWidth = 1;
    if (m.label) { c.fillStyle = m.color || T.ink; c.textAlign = m.align || "left"; c.textBaseline = "bottom"; c.fillText(m.label, X(m.x) + (m.align === "right" ? -7 : 7), Y(m.y) - 5); }
  }
  c.restore();
  c.fillStyle = T.muted; c.font = "11px " + getComputedStyle(document.body).getPropertyValue("--f-body");
  if (o.xl) { c.textAlign = "right"; c.textBaseline = "bottom"; c.fillText(o.xl, L + pw, H - 1); }
  if (o.yl) { c.save(); c.translate(11, Tp + ph / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(o.yl, 0, 0); c.restore(); }
  if (o.legend) {
    let x = L + 8, y = Tp + 8; c.textAlign = "left"; c.textBaseline = "middle";
    for (const g of o.legend) { c.fillStyle = g.color; c.fillRect(x, y - 1.5, 12, 3); c.fillStyle = T.ink; c.fillText(g.label, x + 16, y); x += c.measureText(g.label).width + 34; if (x > L + pw - 80) { x = L + 8; y += 15; } }
  }
  return { X, Y, L, Tp, pw, ph, inv: (px) => { const t = (px - L) / pw; const v = lerp(x0, x1, t); return o.xlog ? Math.pow(10, v) : v; } };
}
function logTicks([a, b]) { const out = []; for (let e = Math.floor(Math.log10(Math.max(1e-9, a))); e <= Math.ceil(Math.log10(Math.max(1e-9, b))); e++) { const v = Math.pow(10, e); if (v >= a * .999 && v <= b * 1.001) out.push(v); } return out; }

/* ---- controls ---- */
const UI = {
  slider(parent, { id, label, min, max, step, value, unit = "", fmt: f, on }) {
    const out = h("b");
    const inp = h("input", { type: "range", id, min, max, step, value });
    const show = () => {
      out.textContent = (f ? f(+inp.value) : inp.value) + (unit ? " " + unit : "");
      inp.style.setProperty("--pct", (clamp((+inp.value - +min) / ((+max - +min) || 1), 0, 1) * 100).toFixed(2) + "%");
    };
    inp.addEventListener("input", () => { show(); on && on(+inp.value); });
    show();
    parent.append(h("div", { class: "ctl" }, h("label", { for: id }, h("span", null, label), out), inp));
    return { el: inp, get v() { return +inp.value; }, set(v) { inp.value = v; show(); } };
  },
  select(parent, { id, label, options, value, on }) {
    const s = h("select", { id }, options.map(([v, t]) => h("option", { value: v, selected: String(v) === String(value) }, t)));
    s.addEventListener("change", () => on && on(s.value));
    parent.append(h("div", { class: "ctl" }, h("label", { for: id }, h("span", null, label)), s));
    return s;
  },
  check(parent, { id, label, value, on }) {
    const i = h("input", { type: "checkbox", id, checked: value });
    i.addEventListener("change", () => on && on(i.checked));
    parent.append(h("label", { class: "chk", for: id }, i, label));
    return i;
  },
  buttons(parent, list) {
    const row = h("div", { class: "btns" });
    const els = list.map(b => { const e = h("button", { class: "btn" + (b.pri ? " pri" : ""), type: "button", onclick: b.on, "aria-pressed": b.pressed == null ? null : String(!!b.pressed) }, b.label); row.append(e); return e; });
    parent.append(row); return els;
  },
  seg(parent, { label, options, value, on }) {
    const wrap = h("div", { class: "ctl" }); if (label) wrap.append(h("div", { class: "lbl" }, h("span", null, label)));
    const row = h("div", { class: "btns" }); wrap.append(row);
    const els = options.map(([v, t]) => { const e = h("button", { class: "btn", type: "button", "aria-pressed": String(v === value), onclick: () => { els.forEach(x => x.setAttribute("aria-pressed", "false")); e.setAttribute("aria-pressed", "true"); on(v); } }, t); row.append(e); return e; });
    parent.append(wrap); return els;
  },
  reads(parent, keys) {
    const g = h("div", { class: "reads" }); const m = {};
    for (const [k, label] of keys) { const v = h("div", { class: "v" }, "—"); g.append(h("div", { class: "rd" }, h("div", { class: "k" }, label), v)); m[k] = v; }
    parent.append(g);
    return { set(k, val, unit) { if (m[k]) UI.html(m[k], val + (unit ? `<small>${unit}</small>` : "")); } };
  },
  chart(parent, title, opts) { const w = h("div", { class: "chart" }, h("h4", null, title)); parent.append(w); const st = new Stage(w, Object.assign({ aspect: 1.9, minH: 190, maxH: 300 }, opts)); st.el = w; return st; },
};

/* ---- spectral color engine (CIE 1931 analytic fit) ---- */
const Spectral = (() => {
  const g = (x, m, s1, s2) => { const t = (x - m) / (x < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const xb = l => 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
  const yb = l => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
  const zb = l => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
  const LAM = []; for (let l = 380; l <= 730; l += 5) LAM.push(l);
  const CMF = LAM.map(l => [xb(l), yb(l), zb(l)]);
  const toLin = ([X, Y, Z]) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
  const gam = (u) => { u = clamp(u, 0, 1); return u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055; };
  let white = null;
  function xyzOf(T) { let X = 0, Y = 0, Z = 0; for (let i = 0; i < LAM.length; i++) { X += T[i] * CMF[i][0]; Y += T[i] * CMF[i][1]; Z += T[i] * CMF[i][2]; } return [X, Y, Z]; }
  white = toLin(xyzOf(LAM.map(() => 1)));
  const P = {
    chlA: [[430, 12, 1.30], [412, 14, 0.55], [470, 14, 0.10], [535, 25, 0.05], [585, 22, 0.13], [620, 15, 0.22], [664, 10.5, 1.00]],
    chlB: [[457, 13, 1.55], [430, 14, 0.40], [480, 12, 0.25], [595, 20, 0.12], [645, 10.5, 0.58]],
    car: [[425, 9, 1.55], [451, 11, 2.45], [479, 10, 2.15]],
    betanin: [[538, 33, 1.00], [480, 40, 0.35], [415, 25, 0.22]],
    guaiacol: [[470, 38, 1.00], [420, 35, 0.45]],
    quinone: [[420, 36, 1.00], [480, 40, 0.25]],
    evansBlue: [[610, 42, 1.00], [570, 35, 0.45]],
  };
  function absorb(comp, l) { let A = 0; for (const k in comp) { const c = comp[k]; if (!c || !P[k]) continue; for (const [m, s, a] of P[k]) { const t = (l - m) / s; A += c * a * Math.exp(-0.5 * t * t); } } return A; }
  function colorOf(comp, path = 1, asArr = false) {
    const T = LAM.map(l => Math.pow(10, -absorb(comp, l) * path));
    let lin = toLin(xyzOf(T)).map((v, i) => Math.max(0, v / white[i]));
    const mx = Math.max(...lin); if (mx > 1) lin = lin.map(v => v / mx);
    lin = lin.map(v => v * 0.86);
    const rgb = lin.map(gam).map(v => Math.round(v * 255));
    return asArr ? rgb : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  }
  function lambdaToRGB(l) {
    if (l < 380) return "#7E57C2";
    let [X, Y, Z] = [xb(l), yb(l), zb(l)];
    let [r, g2, b] = toLin([X, Y, Z]); const m = Math.min(r, g2, b); if (m < 0) { r -= m; g2 -= m; b -= m; }
    const mx = Math.max(r, g2, b) || 1; const f = 0.25 + 0.75 * smooth(380, 420, l) * (1 - smooth(680, 730, l));
    return `rgb(${Math.round(gam(r / mx * f) * 255)},${Math.round(gam(g2 / mx * f) * 255)},${Math.round(gam(b / mx * f) * 255)})`;
  }
  return { P, absorb, colorOf, lambdaToRGB, LAM };
})();

/* ---- drawing helpers ---- */
const Draw = {
  tube(c, x, y, w, hgt, layers, opt = {}) {
    const r = w / 2, T = Theme.c;
    c.save();
    // Підставка / тінь під пробіркою
    c.fillStyle = "rgba(0,0,0,0.14)";
    c.beginPath(); c.ellipse(x + r + 2, y + hgt + 2, r * 0.92, 3.5, 0, 0, Math.PI * 2); c.fill();

    const tubePath = () => {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + hgt - r);
      c.arc(x + r, y + hgt - r, r, Math.PI, 0, true);
      c.lineTo(x + w, y);
      c.closePath();
    };
    tubePath();
    c.save();
    c.clip();

    // Боросилікатне скло (задня стінка)
    const bgGlass = c.createLinearGradient(x, 0, x + w, 0);
    bgGlass.addColorStop(0, Theme.dark ? "rgba(210,235,245,0.10)" : "rgba(235,245,250,0.78)");
    bgGlass.addColorStop(0.5, Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.45)");
    bgGlass.addColorStop(1, Theme.dark ? "rgba(180,210,225,0.12)" : "rgba(210,228,238,0.75)");
    c.fillStyle = bgGlass;
    c.fillRect(x, y, w, hgt);

    // Шари рідини з об'ємним градієнтом Бера—Ламберта та 3D-меніском
    const fillH = (opt.fill ?? 0.62) * hgt;
    let yy = y + hgt;
    const menH = Math.min(4.2, r * 0.26);
    for (let idx = 0; idx < layers.length; idx++) {
      const L = layers[idx];
      const lh = fillH * L.frac;
      const topY = yy - lh;
      const lGrad = c.createLinearGradient(x, topY, x + w, yy);
      lGrad.addColorStop(0, shade(L.color, 0.14));
      lGrad.addColorStop(0.5, L.color);
      lGrad.addColorStop(1, shade(L.color, -0.22));
      c.fillStyle = lGrad;
      c.beginPath();
      c.moveTo(x, yy + 1);
      c.lineTo(x, topY - menH * 0.6);
      c.quadraticCurveTo(x + r, topY + menH, x + w, topY - menH * 0.6);
      c.lineTo(x + w, yy + 1);
      c.closePath();
      c.fill();

      // Еліптичний поверхневий меніск на межі фаз
      c.save();
      c.beginPath();
      c.ellipse(x + r, topY, r - 1, menH, 0, 0, Math.PI * 2);
      c.fillStyle = shade(L.color, 0.28);
      c.globalAlpha = 0.55;
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = 1;
      c.stroke();
      c.restore();
      yy = topY;
    }

    // Донний каустичний рефлекс
    const caust = c.createRadialGradient(x + r * 0.85, y + hgt - r * 0.45, 1, x + r, y + hgt - r * 0.5, r);
    caust.addColorStop(0, "rgba(255,255,255,0.32)");
    caust.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = caust;
    c.beginPath(); c.arc(x + r, y + hgt - r, r * 0.9, 0, Math.PI * 2); c.fill();

    if (opt.after) opt.after(c, yy);

    // Циліндричне заломлення і відблиски скла
    const gr = c.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, "rgba(255,255,255,0.48)");
    gr.addColorStop(0.14, "rgba(255,255,255,0.62)");
    gr.addColorStop(0.24, "rgba(255,255,255,0.06)");
    gr.addColorStop(0.68, "rgba(0,0,0,0)");
    gr.addColorStop(0.88, "rgba(0,0,0,0.16)");
    gr.addColorStop(1, "rgba(255,255,255,0.28)");
    c.fillStyle = gr;
    c.fillRect(x, y, w, hgt);

    // Градуювальні штрихи на склі
    c.strokeStyle = Theme.dark ? "rgba(255,255,255,0.22)" : "rgba(20,40,30,0.18)";
    c.lineWidth = 0.8;
    for (let gy = y + hgt * 0.22; gy < y + hgt - r - 4; gy += hgt * 0.12) {
      c.beginPath(); c.moveTo(x + w * 0.68, gy); c.lineTo(x + w * 0.86, gy); c.stroke();
    }
    c.restore();

    // Контур скляної стінки та верхній бортик
    tubePath();
    c.lineWidth = 1.5;
    c.strokeStyle = opt.stroke || rgba(T.ink, 0.58);
    c.stroke();
    c.fillStyle = Theme.dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)";
    c.beginPath(); c.ellipse(x + r, y, r + 1.8, 2.8, 0, 0, Math.PI * 2); c.fill(); c.stroke();

    if (opt.label) {
      c.fillStyle = opt.labelColor || T.muted;
      c.font = "600 11px " + getComputedStyle(document.body).getPropertyValue("--f-mono");
      c.textAlign = "center"; c.textBaseline = "top";
      c.fillText(opt.label, x + r, y + hgt + 6);
    }
    c.restore();
  },
  text(c, s, x, y, { size = 11, color = Theme.c.muted, align = "left", base = "alphabetic", font = "mono", weight = "" } = {}) {
    c.font = `${weight} ${size}px ${getComputedStyle(document.body).getPropertyValue(font === "mono" ? "--f-mono" : font === "display" ? "--f-display" : "--f-body")}`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = base;
    const tr = c.getTransform();
    if (!tr.b && !tr.c && tr.a > 0) {
      const wd = c.measureText(s).width * tr.a, cwd = c.canvas.width, pad = 2 * tr.a;
      const l = tr.e + (align === "center" ? x - wd / tr.a / 2 : (align === "right" || align === "end") ? x - wd / tr.a : x) * tr.a;
      let dx = 0; if (l + wd > cwd - pad) dx = cwd - pad - (l + wd); if (l + dx < pad) dx = pad - l;
      x += dx / tr.a;
    }
    c.fillText(s, x, y);
  },
};

const BASE = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, "") : "assets/js/lab/";
const VQ = (document.currentScript && document.currentScript.src && document.currentScript.src.match(/\?.*$/)) ? document.currentScript.src.match(/\?.*$/)[0] : "";
const NA = (x, d = 2) => fmt(x, d);

function hex2rgb(c) {
  if (!c) return [128, 128, 128];
  c = String(c).trim();
  if (c[0] === "#") { const n = parseInt(c.length === 4 ? c.replace(/./g, (m, i) => i ? m + m : "").slice(1) : c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
function shade(c, k) {
  const [r, g, b] = hex2rgb(c); const t = k > 0 ? 255 : 0, a = Math.abs(k);
  return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`;
}
function alpha(c, a) { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})`; }
function mixc(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
const ease = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const FB = () => getComputedStyle(document.body).getPropertyValue("--f-body");
const FM = () => getComputedStyle(document.body).getPropertyValue("--f-mono");
const FD = () => getComputedStyle(document.body).getPropertyValue("--f-display");

const Gfx = {
  rr(c, x, y, w, hh, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, hh, r); else c.rect(x, y, w, hh); },
  sphere(c, x, y, r, col, o = {}) {
    if (r <= 0.1) return;
    c.save();
    c.globalAlpha = o.a ?? 1;
    // Тінь-ореол для об'ємності
    if (o.shadow) {
      c.fillStyle = "rgba(0,0,0,0.16)";
      c.beginPath(); c.arc(x + r * 0.14, y + r * 0.18, r * 1.02, 0, Math.PI * 2); c.fill();
    }
    // Тривимірне підповерхневе розсіювання (Subsurface Scattering + Fresnel rim)
    const g = c.createRadialGradient(x - r * 0.36, y - r * 0.38, r * 0.06, x, y, r);
    g.addColorStop(0, shade(col, 0.72));
    g.addColorStop(0.28, shade(col, 0.24));
    g.addColorStop(0.68, col);
    g.addColorStop(0.92, shade(col, -0.35));
    g.addColorStop(1, shade(col, -0.48));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    // Блік вологої біологічної поверхні
    if (r > 3.5 && o.spec !== false) {
      c.fillStyle = "rgba(255,255,255,0.42)";
      c.beginPath();
      c.ellipse(x - r * 0.32, y - r * 0.34, r * 0.26, r * 0.14, -0.6, 0, Math.PI * 2);
      c.fill();
    }
    if (o.ring) { c.strokeStyle = o.ring; c.lineWidth = o.rw || 1.1; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  },
  glow(c, x, y, r, col, a = .5) {
    if (r <= 0.5) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, alpha(col, a)); g.addColorStop(0.5, alpha(col, a * 0.4)); g.addColorStop(1, alpha(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  },
  arrow(c, x1, y1, x2, y2, o = {}) {
    const col = o.col || Theme.c.ink, w = o.w || 2, hd = o.head || 7, a = Math.atan2(y2 - y1, x2 - x1);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = "round"; c.setLineDash(o.dash || []);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * hd * .6, y2 - Math.sin(a) * hd * .6); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - hd * Math.cos(a - .42), y2 - hd * Math.sin(a - .42)); c.lineTo(x2 - hd * Math.cos(a + .42), y2 - hd * Math.sin(a + .42)); c.closePath(); c.fill();
  },
  text(c, s, x, y, o = {}) { Draw.text(c, s, x, y, Object.assign({ font: "body", color: Theme.c.ink, size: 12 }, o)); },
  chip(c, s, x, y, o = {}) {
    const size = o.size || 11; c.font = `${o.weight || 600} ${size}px ${FB()}`;
    const w = c.measureText(s).width + 14, hh = size + 9; let X = x;
    if (o.align === "center" || !o.align) X = x - w / 2; else if (o.align === "right") X = x - w;
    { const tr = c.getTransform(); if (!tr.b && !tr.c && tr.a > 0) { const pad = 2 * tr.a, l = tr.e + X * tr.a, wd = w * tr.a; let dx = 0; if (l + wd > c.canvas.width - pad) dx = c.canvas.width - pad - (l + wd); if (l + dx < pad) dx = pad - l; X += dx / tr.a; } }
    Gfx.rr(c, X, y - hh / 2, w, hh, hh / 2); c.fillStyle = o.bg || alpha(Theme.c.sheet.length === 7 ? Theme.c.sheet : "#ffffff", .92); c.fill();
    c.strokeStyle = o.stroke || o.color || Theme.c.rule; c.lineWidth = 1; c.stroke();
    c.fillStyle = o.fg || o.color || Theme.c.ink; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(s, X + 7, y + .5);
    return w;
  },
  lipid(c, x, y, dir, o = {}) {
    const s = o.s || 1, head = o.head || "#E0B341", tail = o.tail || "#C9A24A", t = o.t || 0, ph = o.ph || 0;
    const L = (o.len || 15) * s;
    c.lineCap = "round"; c.strokeStyle = alpha(tail, .85); c.lineWidth = 1.5 * s;
    for (const dx of [-2.2 * s, 2.2 * s]) {
      c.beginPath(); c.moveTo(x + dx, y + dir * 4 * s);
      const sw = Math.sin(t * 2 + ph + dx) * 1.2 * s;
      c.bezierCurveTo(x + dx + sw, y + dir * L * .35, x + dx - sw, y + dir * L * .7, x + dx + sw * .5, y + dir * L); c.stroke();
    }
    Gfx.sphere(c, x, y, 3.6 * s, head);
  },
  bilayer(c, x0, x1, yMid, gap, t, o = {}) {
    const s = o.s || 1, step = (o.step || 8.5) * s; let i = 0;
    c.fillStyle = alpha(o.core || "#D9B65A", .13); c.fillRect(x0, yMid - gap / 2, x1 - x0, gap);
    for (let x = x0 + step / 2; x < x1; x += step, i++) {
      if (o.skip && o.skip(x)) continue;
      const jy = Math.sin(t * 1.3 + i * 1.7) * .9 * s;
      Gfx.lipid(c, x, yMid - gap / 2 + jy, 1, Object.assign({ t, ph: i }, o));
      Gfx.lipid(c, x + step * .2, yMid + gap / 2 - jy, -1, Object.assign({ t, ph: i + 3 }, o));
    }
  },
  vial(c, x, y, w, hh, fillFrac, col, o = {}) {
    if (fillFrac && typeof fillFrac === "object") { o = fillFrac; fillFrac = o.fill ?? 0.65; col = o.col || "rgba(200,220,200,.6)"; if (o.cap && o.plug == null) o.plug = true; }
    const r = w / 2, menH = Math.min(4.0, r * 0.25), wave = o.wave || 0;
    c.save();
    // Тінь під пробіркою
    c.fillStyle = "rgba(0,0,0,0.13)";
    c.beginPath(); c.ellipse(x + r + 1.5, y + hh + 2, r * 0.9, 3.2, 0, 0, Math.PI * 2); c.fill();

    const tubeOutline = () => {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + hh - r);
      c.arc(x + r, y + hh - r, r, Math.PI, 0, true);
      c.lineTo(x + w, y);
      c.closePath();
    };
    tubeOutline();
    c.save();
    c.clip();

    // Скляний фон
    c.fillStyle = Theme.dark ? "rgba(220,240,250,0.06)" : "rgba(240,248,252,0.72)";
    c.fillRect(x, y, w, hh);

    const lh = clamp(fillFrac, 0, 0.92) * hh, ly = y + hh - lh;
    if (o.layers) {
      let yy = y + hh;
      for (const L of o.layers) {
        const h2 = lh * L.frac, topY = yy - h2;
        const lg = c.createLinearGradient(x, topY, x + w, yy);
        lg.addColorStop(0, shade(L.color, 0.12));
        lg.addColorStop(0.5, L.color);
        lg.addColorStop(1, shade(L.color, -0.20));
        c.fillStyle = lg;
        c.beginPath();
        c.moveTo(x, yy + 1);
        c.lineTo(x, topY - menH * 0.5);
        c.quadraticCurveTo(x + r, topY + menH * 0.9, x + w, topY - menH * 0.5);
        c.lineTo(x + w, yy + 1);
        c.closePath();
        c.fill();
        yy = topY;
      }
    } else if (lh > 0.5) {
      const lg = c.createLinearGradient(x, ly, x + w, y + hh);
      lg.addColorStop(0, shade(col, 0.16));
      lg.addColorStop(0.55, col);
      lg.addColorStop(1, shade(col, -0.24));
      c.fillStyle = lg;
      const slosh = Math.sin(wave) * 1.8;
      c.beginPath();
      c.moveTo(x, y + hh + 2);
      c.lineTo(x, ly - menH * 0.55 + slosh);
      c.quadraticCurveTo(x + r, ly + menH - slosh * 0.3, x + w, ly - menH * 0.55 - slosh);
      c.lineTo(x + w, y + hh + 2);
      c.closePath();
      c.fill();

      // Верхній 3D-меніск рідини
      c.save();
      c.beginPath();
      c.ellipse(x + r, ly, r - 1, menH, 0, 0, Math.PI * 2);
      c.fillStyle = shade(col, 0.26);
      c.globalAlpha = 0.52;
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.58)";
      c.lineWidth = 0.9;
      c.stroke();
      c.restore();
    }

    if (o.inside) o.inside(c, ly);

    // Заломлення світла на циліндричному склі
    const gr = c.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, "rgba(255,255,255,0.46)");
    gr.addColorStop(0.15, "rgba(255,255,255,0.62)");
    gr.addColorStop(0.26, "rgba(255,255,255,0.06)");
    gr.addColorStop(0.65, "rgba(0,0,0,0)");
    gr.addColorStop(0.88, "rgba(0,0,0,0.18)");
    gr.addColorStop(1, "rgba(255,255,255,0.25)");
    c.fillStyle = gr;
    c.fillRect(x, y, w, hh);
    c.restore();

    // Зовнішній контур скла
    c.lineWidth = 1.45;
    c.strokeStyle = rgba(Theme.c.ink, 0.52);
    tubeOutline();
    c.stroke();
    c.fillStyle = Theme.dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)";
    c.beginPath(); c.ellipse(x + r, y, r + 1.6, 2.6, 0, 0, Math.PI * 2); c.fill(); c.stroke();

    // Ватно-марлевий корок із волокнистою текстурою
    if (o.plug) {
      const px = x + w * 0.10, py = y - 13, pw = w * 0.80, ph = 16;
      const pg = c.createLinearGradient(px, py, px + pw, py);
      pg.addColorStop(0, "#D5CFC2");
      pg.addColorStop(0.35, o.plugCol || "#F4F1EA");
      pg.addColorStop(1, "#B8B0A0");
      Gfx.rr(c, px, py, pw, ph, 6);
      c.fillStyle = pg; c.fill();
      c.strokeStyle = rgba(Theme.c.ink, 0.38); c.lineWidth = 1; c.stroke();
      // Штрихи марлевих волокон
      c.strokeStyle = "rgba(120,110,95,0.22)"; c.lineWidth = 0.7;
      for (let fx = px + 3; fx < px + pw - 3; fx += 3.5) {
        c.beginPath(); c.moveTo(fx, py + 2); c.lineTo(fx + 1, py + ph - 2); c.stroke();
      }
    }
    if (o.label) {
      c.fillStyle = Theme.c.ink;
      c.font = `600 11px ${FM()}`;
      c.textAlign = "center"; c.textBaseline = "top";
      c.fillText(o.label, x + r, y + hh + 6);
    }
    c.restore();
  },
  petri(c, cx, cy, r, agarCol = "rgba(225,236,214,.85)", o = {}) {
    if (agarCol && typeof agarCol === "object") { o = agarCol; agarCol = o.agar || o.col || "rgba(225,236,214,.85)"; }
    c.save();
    // Реалістична м'яка тінь чашки Петрі на лабораторному столі
    const shGrad = c.createRadialGradient(cx + 4, cy + 5, r * 0.5, cx + 4, cy + 5, r + 9);
    shGrad.addColorStop(0, "rgba(0,0,0,0.20)");
    shGrad.addColorStop(0.75, "rgba(0,0,0,0.09)");
    shGrad.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = shGrad;
    c.beginPath(); c.arc(cx + 4, cy + 5, r + 9, 0, Math.PI * 2); c.fill();

    // Зовнішній скляний бортик кришки чашки Петрі
    c.fillStyle = Theme.dark ? "rgba(220,240,248,0.07)" : "rgba(245,250,252,0.88)";
    c.beginPath(); c.arc(cx, cy, r + 3.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rgba(Theme.c.ink, 0.35); c.lineWidth = 1.2; c.stroke();

    // Напівпрозорий агаровий гель із підповерхневим градієнтом і меніском біля стінки
    const ag = c.createRadialGradient(cx - r * 0.24, cy - r * 0.24, r * 0.04, cx, cy, r);
    ag.addColorStop(0, shade(agarCol, 0.32));
    ag.addColorStop(0.65, agarCol);
    ag.addColorStop(0.92, shade(agarCol, -0.14));
    ag.addColorStop(1, shade(agarCol, -0.28));
    c.fillStyle = ag;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();

    // Внутрішній вміст чашки (калюси, експлантати, мікроспори, листки)
    if (o.inside) {
      c.save();
      c.beginPath(); c.arc(cx, cy, r - 3, 0, Math.PI * 2); c.clip();
      o.inside(c);
      c.restore();
    }

    // Мікрокраплі конденсату на внутрішній поверхні кришки та відблиск скла
    c.save();
    c.beginPath(); c.arc(cx, cy, r - 1, 0, Math.PI * 2); c.clip();
    const gl = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gl.addColorStop(0, "rgba(255,255,255,0.28)");
    gl.addColorStop(0.32, "rgba(255,255,255,0.04)");
    gl.addColorStop(0.68, "rgba(0,0,0,0)");
    gl.addColorStop(1, "rgba(255,255,255,0.14)");
    c.fillStyle = gl;
    c.fillRect(cx - r, cy - r, r * 2, r * 2);
    c.restore();

    // Подвійне кільце скляної стінки чашки та дуговий спекулярний блік
    c.strokeStyle = rgba(Theme.c.ink, 0.48);
    c.lineWidth = 2.0;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.68)";
    c.lineWidth = 1.8;
    c.beginPath(); c.arc(cx, cy, r - 2.4, -2.55, -0.65); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(cx, cy, r - 2.4, 0.55, 2.35); c.stroke();

    if (o.label) Gfx.text(c, o.label, cx, cy + r + 16, { align: "center", size: 11, weight: 600, color: Theme.c.ink });
    c.restore();
  },
  flask(c, cx, botY, w, hh, fillFrac, col, o = {}) {
    if (botY < hh * 0.85) botY = botY + hh;
    const neckW = w * 0.33, neckH = hh * 0.29, topY = botY - hh, neckY = topY + neckH;
    const cornerR = Math.min(18, w * 0.14);
    c.save();

    // Контактна еліптична тінь під дном колби Ерленмейєра
    const baseSh = c.createRadialGradient(cx, botY + 2, w * 0.1, cx, botY + 3, w * 0.54);
    baseSh.addColorStop(0, "rgba(0,0,0,0.22)");
    baseSh.addColorStop(0.7, "rgba(0,0,0,0.08)");
    baseSh.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = baseSh;
    c.beginPath(); c.ellipse(cx, botY + 3, w * 0.52, 6, 0, 0, Math.PI * 2); c.fill();

    // Точний контур конічної колби Ерленмейєра з плавним переходом шийки
    const path = () => {
      c.beginPath();
      c.moveTo(cx - neckW / 2, topY);
      c.lineTo(cx - neckW / 2, neckY - 4);
      c.quadraticCurveTo(cx - neckW / 2, neckY + 4, cx - neckW / 2 - 4, neckY + 10);
      c.lineTo(cx - w / 2 + 2, botY - cornerR);
      c.quadraticCurveTo(cx - w / 2 - 2, botY, cx - w / 2 + cornerR, botY);
      c.lineTo(cx + w / 2 - cornerR, botY);
      c.quadraticCurveTo(cx + w / 2 + 2, botY, cx + w / 2 - 2, botY - cornerR);
      c.lineTo(cx + neckW / 2 + 4, neckY + 10);
      c.quadraticCurveTo(cx + neckW / 2, neckY + 4, cx + neckW / 2, neckY - 4);
      c.lineTo(cx + neckW / 2, topY);
      c.closePath();
    };

    path();
    c.save();
    c.clip();

    // Задня стінка боросилікатного скла
    const gBg = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    gBg.addColorStop(0, Theme.dark ? "rgba(200,230,245,0.10)" : "rgba(232,244,250,0.75)");
    gBg.addColorStop(0.5, Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.52)");
    gBg.addColorStop(1, Theme.dark ? "rgba(180,215,235,0.12)" : "rgba(215,232,242,0.78)");
    c.fillStyle = gBg;
    c.fillRect(cx - w / 2 - 6, topY, w + 12, hh + 6);

    // Гідродинаміка рідини в колбі: багатогармонічна хвиля + вихрова лійка + 3D-меніск
    const ff = clamp(fillFrac, 0, 0.84);
    const lh = hh * ff, ly = botY - lh;
    const wave = o.wave || 0;
    const amp = wave === 0 ? 0 : (o.amp ?? 3.8);
    // Ширина дзеркала рідини на висоті ly у конічній частині колби
    const coneFrac = clamp((botY - ly) / (botY - neckY), 0, 1);
    const surfHalfW = lerp(w * 0.49, neckW * 0.5, coneFrac);
    const menRy = Math.max(3.2, surfHalfW * 0.12);

    // Задній контур еліптичного меніска (видно крізь рідину)
    c.save();
    c.beginPath();
    const tilt = amp * Math.sin(wave);
    for (let i = 0; i <= 32; i++) {
      const u = (i / 32) * 2 - 1; // -1 .. +1
      const px = cx + u * (surfHalfW + 8);
      const backArc = -Math.sqrt(Math.max(0, 1 - u * u)) * menRy;
      const wv = amp * (0.65 * Math.sin(u * 2.2 + wave) + 0.35 * Math.cos(u * 4.5 - wave * 1.6));
      const py = ly + backArc + wv - 2.5 * Math.pow(u, 4); // капілярний підйом біля стінок
      i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
    }
    c.lineTo(cx + w, botY + 12);
    c.lineTo(cx - w, botY + 12);
    c.closePath();

    // Об'ємний градієнт рідини за законом Бера—Ламберта
    const liqGrad = c.createLinearGradient(cx, ly - 8, cx, botY);
    liqGrad.addColorStop(0, shade(col, 0.22));
    liqGrad.addColorStop(0.35, col);
    liqGrad.addColorStop(0.85, shade(col, -0.18));
    liqGrad.addColorStop(1, shade(col, -0.32));
    c.fillStyle = liqGrad;
    c.fill();
    c.restore();

    // Верхнє дзеркало рідини (3D-меніск між задньою і передньою дугами)
    c.save();
    c.beginPath();
    for (let i = 0; i <= 28; i++) {
      const u = (i / 28) * 2 - 1;
      const px = cx + u * (surfHalfW + 6);
      const backArc = -Math.sqrt(Math.max(0, 1 - u * u)) * menRy;
      const wv = amp * (0.65 * Math.sin(u * 2.2 + wave) + 0.35 * Math.cos(u * 4.5 - wave * 1.6));
      const py = ly + backArc + wv - 2.2 * Math.pow(u, 4);
      i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
    }
    for (let i = 28; i >= 0; i--) {
      const u = (i / 28) * 2 - 1;
      const px = cx + u * (surfHalfW + 6);
      const frontArc = Math.sqrt(Math.max(0, 1 - u * u)) * menRy;
      const wv = amp * (0.65 * Math.sin(u * 2.2 + wave + 0.5) + 0.35 * Math.cos(u * 4.5 - wave * 1.6));
      const py = ly + frontArc + wv - 2.2 * Math.pow(u, 4);
      c.lineTo(px, py);
    }
    c.closePath();
    const menGrad = c.createLinearGradient(cx - surfHalfW, ly, cx + surfHalfW, ly);
    menGrad.addColorStop(0, shade(col, 0.38));
    menGrad.addColorStop(0.5, shade(col, 0.18));
    menGrad.addColorStop(1, shade(col, 0.05));
    c.fillStyle = menGrad;
    c.globalAlpha = 0.72;
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.65)";
    c.lineWidth = 1.1;
    c.stroke();
    c.restore();

    // Донний каустичний блік на дні колби
    const botCaust = c.createRadialGradient(cx - w * 0.12, botY - 7, 2, cx, botY - 6, w * 0.42);
    botCaust.addColorStop(0, "rgba(255,255,255,0.34)");
    botCaust.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = botCaust;
    c.beginPath(); c.ellipse(cx, botY - 6, w * 0.40, 6, 0, 0, Math.PI * 2); c.fill();

    // Внутрішні об'єкти у колбі (калюс, суспензія, мікроживці, бульбашки)
    if (o.inside) o.inside(c, ly + tilt * 0.25);

    // Бокові бліки заломлення світла на конічному склі та градуювання об'єму
    const gr = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    gr.addColorStop(0, "rgba(255,255,255,0.45)");
    gr.addColorStop(0.14, "rgba(255,255,255,0.52)");
    gr.addColorStop(0.26, "rgba(255,255,255,0.04)");
    gr.addColorStop(0.70, "rgba(0,0,0,0)");
    gr.addColorStop(0.90, "rgba(0,0,0,0.18)");
    gr.addColorStop(1, "rgba(255,255,255,0.28)");
    c.fillStyle = gr;
    c.fillRect(cx - w / 2, topY, w, hh);

    // Білий спекулярний блік уздовж лівої образуючої конуса колби
    c.strokeStyle = "rgba(255,255,255,0.62)";
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(cx - neckW * 0.36, topY + 10);
    c.lineTo(cx - neckW * 0.36, neckY + 2);
    c.lineTo(cx - w * 0.39, botY - 16);
    c.stroke();

    // Шкала мілілітрів на стінці колби
    if (w >= 64 && hh >= 80) {
      c.strokeStyle = Theme.dark ? "rgba(255,255,255,0.26)" : "rgba(20,45,30,0.22)";
      c.fillStyle = Theme.dark ? "rgba(255,255,255,0.38)" : "rgba(20,45,30,0.35)";
      c.lineWidth = 0.9;
      c.font = `600 8.5px ${FM()}`;
      c.textAlign = "left";
      [0.25, 0.45, 0.65].forEach((f, idx) => {
        const gy = botY - hh * f;
        if (gy > neckY + 6) {
          c.beginPath(); c.moveTo(cx + w * 0.10, gy); c.lineTo(cx + w * 0.22, gy); c.stroke();
          c.fillText(`${(idx + 1) * 50}`, cx + w * 0.24, gy + 3);
        }
      });
    }
    c.restore();

    // Зовнішній контур колби та потовщений вінчик горловини
    path();
    c.lineWidth = 1.65;
    c.strokeStyle = rgba(Theme.c.ink, 0.58);
    c.stroke();
    Gfx.rr(c, cx - neckW * 0.55, topY - 2.5, neckW * 1.10, 5, 2.5);
    c.fillStyle = Theme.dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.82)";
    c.fill(); c.stroke();

    // Реалістичний ватно-марлевий корок із фольговим ковпачком
    if (o.plug !== false) {
      const pw = neckW * 1.16, ph = 15, px = cx - pw / 2, py = topY - 12;
      const pg = c.createLinearGradient(px, py, px + pw, py);
      pg.addColorStop(0, "#CFC8B8");
      pg.addColorStop(0.35, "#F5F2EB");
      pg.addColorStop(0.75, "#DED8CA");
      pg.addColorStop(1, "#B2AA9A");
      Gfx.rr(c, px, py, pw, ph, 5);
      c.fillStyle = pg; c.fill();
      c.strokeStyle = rgba(Theme.c.ink, 0.42); c.lineWidth = 1; c.stroke();
      c.strokeStyle = "rgba(110,100,85,0.22)"; c.lineWidth = 0.7;
      for (let fx = px + 3; fx < px + pw - 3; fx += 3.5) {
        c.beginPath(); c.moveTo(fx, py + 2); c.lineTo(fx + 1, py + ph - 2); c.stroke();
      }
    }
    if (o.label) Gfx.text(c, o.label, cx, botY + 16, { align: "center", size: 11, weight: 600, color: Theme.c.ink });
    c.restore();
  },

  /* ---- високодеталізована рослинна клітина з плазмолізом, нитками Гехта, вакуолею, хлоропластами та циклозом ---- */
  plantCell(c, cx, cy, w, hh, o = {}) {
    const plas = clamp(o.plasmolysis ?? 0, 0, 1); // 0 = тургор, 0.25 = кутовий/увігнутий, 0.7+ = опуклий/ковпачковий
    const wallCol = o.wallCol || "#7CB342";
    const vacCol = o.vacCol || "rgba(195, 230, 198, 0.52)";
    const cytCol = o.cytCol || "rgba(225, 242, 195, 0.72)";
    const time = o.time || 0;
    const nChl = o.chloroplasts ?? 12;
    const lysed = !!o.lysed;
    c.save();

    const x0 = cx - w / 2, y0 = cy - hh / 2, rCorner = Math.min(18, Math.min(w, hh) * 0.22);
    // 1. Серединна пектинова пластинка та двошарова целюлозна клітинна стінка
    Gfx.rr(c, x0 - 4, y0 - 4, w + 8, hh + 8, rCorner + 3);
    const wGrad = c.createLinearGradient(x0, y0, x0 + w, y0 + hh);
    wGrad.addColorStop(0, shade(wallCol, 0.28));
    wGrad.addColorStop(0.5, wallCol);
    wGrad.addColorStop(1, shade(wallCol, -0.25));
    c.fillStyle = wGrad; c.fill();
    c.strokeStyle = shade(wallCol, -0.45); c.lineWidth = 1.6; c.stroke();

    // Внутрішня порожнина клітинної стінки (заповнена зовнішнім гіпертонічним розчином під час плазмолізу)
    Gfx.rr(c, x0 + 3, y0 + 3, w - 6, hh - 6, rCorner - 1);
    c.fillStyle = Theme.dark ? "#15231B" : "#EEF5EE";
    c.fill();
    c.strokeStyle = shade(wallCol, -0.22); c.lineWidth = 1.1; c.stroke();

    // Плазмодесми у клітинній стінці
    c.strokeStyle = rgba(Theme.c.ink, 0.28); c.lineWidth = 1.2;
    for (const s of [-0.25, 0, 0.25]) {
      c.beginPath();
      c.moveTo(x0 - 4, cy + s * hh); c.lineTo(x0 + 3, cy + s * hh);
      c.moveTo(x0 + w - 3, cy + s * hh); c.lineTo(x0 + w + 4, cy + s * hh);
      c.moveTo(cx + s * w, y0 - 4); c.lineTo(cx + s * w, y0 + 3);
      c.moveTo(cx + s * w, y0 + hh - 3); c.lineTo(cx + s * w, y0 + hh + 4);
      c.stroke();
    }

    if (lysed) {
      // Лізована клітина (після льодоутворення без кріопротектора)
      c.fillStyle = alpha(vacCol, 0.25);
      Gfx.rr(c, x0 + 4, y0 + 4, w - 8, hh - 8, rCorner - 2); c.fill();
      c.strokeStyle = "#C62828"; c.lineWidth = 1.4; c.setLineDash([4, 3]);
      c.beginPath(); c.arc(cx, cy, Math.min(w, hh) * 0.28, 0, 5.2); c.stroke(); c.setLineDash([]);
      c.restore();
      return;
    }

    // 2. Нитки Гехта (тонкі цитоплазматичні тяжі від кутів і плазмодесм до відшарованої плазмалеми)
    const rxP = (w * 0.45) * (1 - plas * 0.46);
    const ryP = (hh * 0.45) * (1 - plas * 0.46);
    if (plas > 0.08) {
      c.strokeStyle = "rgba(145, 195, 115, 0.65)";
      c.lineWidth = 0.9;
      const anchors = [
        [x0 + 6, y0 + 6], [x0 + w - 6, y0 + 6], [x0 + w - 6, y0 + hh - 6], [x0 + 6, y0 + hh - 6],
        [cx, y0 + 4], [cx, y0 + hh - 4], [x0 + 4, cy], [x0 + w - 4, cy]
      ];
      anchors.forEach(([ax, ay]) => {
        const ang = Math.atan2(ay - cy, ax - cx);
        const px = cx + Math.cos(ang) * rxP * 0.94;
        const py = cy + Math.sin(ang) * ryP * 0.94;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(px, py); c.stroke();
      });
    }

    // 3. Протопласт (плазмалема + цитоплазма): плавний перехід тургор → увігнутий → опуклий плазмоліз
    const protoPath = (scale = 1) => {
      const rx = rxP * scale, ry = ryP * scale;
      const concave = Math.sin(clamp(plas / 0.48, 0, 1) * Math.PI) * 0.22; // максимальна увігнутість при плазмолізі ~0.24
      c.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        // Супереліпс у тургорі (n ~ 3.4) переходить у сферу/еліпс при опуклому плазмолізі (n = 2)
        const expN = lerp(3.4, 2.0, smooth(0.0, 0.55, plas));
        const ca = Math.cos(a), sa = Math.sin(a);
        const rBaseX = rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / expN);
        const rBaseY = ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / expN);
        const indent = 1 - concave * Math.pow(Math.sin(2 * a), 2);
        const px = cx + rBaseX * indent;
        const py = cy + rBaseY * indent;
        i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
      }
      c.closePath();
    };

    protoPath(1.0);
    c.fillStyle = cytCol;
    c.fill();
    c.strokeStyle = "#D49B2A"; // ліпідний бішар плазмалеми
    c.lineWidth = 1.6;
    c.stroke();

    // 4. Центральна вакуоля з тонопластом та об'ємним градієнтом клітинного соку
    protoPath(0.76);
    const vGrad = c.createRadialGradient(cx - rxP * 0.22, cy - ryP * 0.22, 2, cx, cy, Math.max(rxP, ryP) * 0.8);
    vGrad.addColorStop(0, shade(vacCol, 0.35));
    vGrad.addColorStop(0.65, vacCol);
    vGrad.addColorStop(1, shade(vacCol, -0.22));
    c.fillStyle = vGrad;
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.45)";
    c.lineWidth = 1.0;
    c.stroke();

    // 5. Клітинне ядро з ядерцем та хроматином у постенному шарі цитоплазми
    const nucX = cx - rxP * 0.54, nucY = cy - ryP * 0.42, nucR = Math.max(5.5, Math.min(w, hh) * 0.095);
    Gfx.sphere(c, nucX, nucY, nucR, o.nucCol || "#5C6BC0", { ring: "rgba(40,53,147,0.65)" });
    Gfx.sphere(c, nucX - nucR * 0.2, nucY - nucR * 0.15, nucR * 0.36, "#283593");

    // 6. Хлоропласти з тилакоїдними гранами, що рухаються вздовж плазмалеми (циклоз)
    const chlCol = o.chlCol || "#2E7D32";
    for (let i = 0; i < nChl; i++) {
      const a = (i / nChl) * Math.PI * 2 + time * 0.38;
      const chX = cx + Math.cos(a) * rxP * 0.86;
      const chY = cy + Math.sin(a) * ryP * 0.86;
      c.save();
      c.translate(chX, chY);
      c.rotate(a + Math.PI / 2);
      const cw = Math.max(4.2, Math.min(w, hh) * 0.065), ch = cw * 0.58;
      const cg = c.createRadialGradient(-cw * 0.25, -ch * 0.25, 0.5, 0, 0, cw);
      cg.addColorStop(0, shade(chlCol, 0.38));
      cg.addColorStop(0.7, chlCol);
      cg.addColorStop(1, shade(chlCol, -0.35));
      c.fillStyle = cg;
      c.beginPath(); c.ellipse(0, 0, cw, ch, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = shade(chlCol, -0.45); c.lineWidth = 0.7; c.stroke();
      // Стопки тилакоїдних гран всередині хлоропласта
      if (cw > 5) {
        c.fillStyle = shade(chlCol, -0.35);
        for (const gx of [-cw * 0.42, 0, cw * 0.42]) {
          c.beginPath(); c.arc(gx, 0, ch * 0.38, 0, Math.PI * 2); c.fill();
        }
      }
      c.restore();
    }
    c.restore();
  },

  /* ---- сферичний ізольований протопласт із ліпідним бішаром, вакуолею, ядром та гранами хлоропластів ---- */
  protoplast(c, cx, cy, r, o = {}) {
    if (r <= 1) return;
    const time = o.time || 0;
    const col = o.col || "#66BB6A";
    const isMesophyll = o.type !== "callus";
    c.save();

    // М'яке свічення / тінь
    if (o.glow) Gfx.glow(c, cx, cy, r * 1.38, o.glow, 0.42);
    c.fillStyle = "rgba(0,0,0,0.16)";
    c.beginPath(); c.arc(cx + r * 0.1, cy + r * 0.14, r * 1.01, 0, Math.PI * 2); c.fill();

    // Сферична цитоплазма та центральна вакуоля
    const g = c.createRadialGradient(cx - r * 0.32, cy - r * 0.34, r * 0.08, cx, cy, r);
    g.addColorStop(0, isMesophyll ? "rgba(220,248,210,0.92)" : "rgba(255,248,215,0.92)");
    g.addColorStop(0.55, alpha(col, 0.65));
    g.addColorStop(0.88, shade(col, -0.22));
    g.addColorStop(1, shade(col, -0.42));
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();

    // Центральна вакуоля
    const vr = r * 0.68;
    const vg = c.createRadialGradient(cx - vr * 0.25, cy - vr * 0.25, 1, cx, cy, vr);
    vg.addColorStop(0, "rgba(255,255,255,0.45)");
    vg.addColorStop(1, isMesophyll ? "rgba(165,220,165,0.28)" : "rgba(240,220,160,0.28)");
    c.fillStyle = vg;
    c.beginPath(); c.arc(cx + r * 0.06, cy + r * 0.05, vr, 0, Math.PI * 2); c.fill();

    // Ядро з ядерцем
    if (r > 8) {
      const nx = cx - r * 0.34, ny = cy - r * 0.26, nr = Math.max(3, r * 0.22);
      Gfx.sphere(c, nx, ny, nr, o.nucCol || "#7986CB", { ring: "rgba(48,63,159,0.5)" });
      Gfx.sphere(c, nx - nr * 0.2, ny - nr * 0.2, nr * 0.35, "#303F9F", { spec: false });
    }

    // Периферичні хлоропласти (для мезофільного протопласта) або лейкопласти (для калюсного)
    const nPlast = o.nPlast ?? (isMesophyll ? 11 : 6);
    const plastCol = isMesophyll ? "#2E7D32" : "#FBC02D";
    for (let i = 0; i < nPlast; i++) {
      const a = (i / nPlast) * Math.PI * 2 + time * 0.32;
      const px = cx + Math.cos(a) * (r * 0.78);
      const py = cy + Math.sin(a) * (r * 0.78);
      c.save();
      c.translate(px, py);
      c.rotate(a + Math.PI / 2);
      const pw = Math.max(2.5, r * 0.19), ph = pw * 0.6;
      c.fillStyle = plastCol;
      c.beginPath(); c.ellipse(0, 0, pw, ph, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = shade(plastCol, -0.38); c.lineWidth = 0.6; c.stroke();
      c.restore();
    }

    // Світіння мікрофібрил регенеруючої целюлозної стінки (Calcofluor White)
    if (o.wallRegen && o.wallRegen > 0.05) {
      c.save();
      c.strokeStyle = `rgba(100, 200, 255, ${clamp(o.wallRegen, 0, 0.85)})`;
      c.lineWidth = 1.1;
      for (let k = 0; k < 10; k++) {
        const a0 = k * 0.62 + time * 0.2;
        c.beginPath();
        c.arc(cx, cy, r + 1.5, a0, a0 + o.wallRegen * 0.55);
        c.stroke();
      }
      c.restore();
    }

    // Ліпідний бішар плазмалеми та спекулярний блік сфери
    c.strokeStyle = o.ring || "#E0B341";
    c.lineWidth = o.rw || 1.5;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.44)";
    c.beginPath(); c.ellipse(cx - r * 0.34, cy - r * 0.36, r * 0.26, r * 0.13, -0.65, 0, Math.PI * 2); c.fill();
    c.restore();
  },

  /* ---- реалістичний тривимірний нодулярний калюс із клітинною мікротекстурою ---- */
  callusMound(c, cx, baseY, rx, ry, o = {}) {
    if (rx <= 2 || ry <= 2) return;
    const col = o.col || "#C5E1A5";
    const friable = o.friable ?? 0.6;
    const seed = o.seed || 17;
    const browning = clamp(o.browning ?? 0, 0, 1);
    const baseCol = mixc(col, "#6D4C41", browning);
    const rGen = rng(seed);
    c.save();

    // Тінь калюсу на поверхні агару
    const sh = c.createRadialGradient(cx, baseY + 2, rx * 0.2, cx, baseY + 3, rx * 1.12);
    sh.addColorStop(0, "rgba(0,0,0,0.26)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = sh;
    c.beginPath(); c.ellipse(cx, baseY + 3, rx * 1.08, Math.max(4, ry * 0.24), 0, 0, Math.PI * 2); c.fill();

    // Генеруємо багатошарові нодулярні частки калюсу, відсортовані за глибиною Y
    const nNodules = Math.round(clamp((rx + ry) * 0.55, 16, 44));
    const nodules = [];
    for (let i = 0; i < nNodules; i++) {
      const u = (i / nNodules) * Math.PI; // кут купола 0 .. PI
      const spread = (rGen() - 0.5) * 2;
      const radFrac = Math.pow(rGen(), 0.58);
      const nx = cx + spread * rx * 0.85 * Math.sin(u + 0.3);
      const ny = baseY - Math.abs(Math.sin(u)) * ry * (0.25 + 0.72 * radFrac);
      const nr = (4.5 + rGen() * (friable > 0.5 ? 6.5 : 8.5)) * clamp(rx / 38, 0.65, 1.55);
      const cShift = (rGen() - 0.45) * 0.22;
      nodules.push({ nx, ny, nr, col: shade(baseCol, cShift) });
    }
    nodules.sort((a, b) => a.ny - b.ny);

    for (const nd of nodules) {
      Gfx.sphere(c, nd.nx, nd.ny, nd.nr, nd.col, {
        ring: alpha(shade(nd.col, -0.45), 0.38),
        rw: 0.8,
        shadow: true
      });
    }

    // Якщо є зелені точки меристемоїдів або трахеїдні вузлики
    if (o.meristemoids) {
      for (let m = 0; m < o.meristemoids; m++) {
        const ma = (m + 0.5) / o.meristemoids * Math.PI;
        const mx = cx + Math.cos(ma) * rx * 0.55;
        const my = baseY - Math.sin(ma) * ry * 0.68;
        Gfx.sphere(c, mx, my, 4.5, "#1B5E20", { ring: "#81C784", rw: 1.2 });
      }
    }
    c.restore();
  },

  /* ---- реалістична листкова пластинка дводольної рослини з жилкуванням ---- */
  leafBlade(c, x, y, len, wid, angle = 0, o = {}) {
    if (len <= 2) return;
    const col = o.col || "#388E3C";
    const veinCol = o.veinCol || shade(col, 0.38);
    c.save();
    c.translate(x, y);
    c.rotate(angle);

    // Черешок листка
    c.strokeStyle = shade(col, -0.18);
    c.lineWidth = Math.max(1.4, wid * 0.14);
    c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 0); c.lineTo(len * 0.14, 0); c.stroke();

    // Двобічна листкова пластинка з градієнтом освітлення
    const lx0 = len * 0.12;
    const bLen = len * 0.88;
    const lg = c.createLinearGradient(lx0, -wid / 2, lx0 + bLen, wid / 2);
    lg.addColorStop(0, shade(col, 0.22));
    lg.addColorStop(0.5, col);
    lg.addColorStop(1, shade(col, -0.24));
    c.fillStyle = lg;
    c.strokeStyle = shade(col, -0.42);
    c.lineWidth = 1.0;

    c.beginPath();
    c.moveTo(lx0, 0);
    c.bezierCurveTo(lx0 + bLen * 0.25, -wid * 0.62, lx0 + bLen * 0.72, -wid * 0.48, lx0 + bLen, 0);
    c.bezierCurveTo(lx0 + bLen * 0.72, wid * 0.48, lx0 + bLen * 0.25, wid * 0.62, lx0, 0);
    c.closePath();
    c.fill();
    c.stroke();

    // Головна центральна жилка та бічні вторинні жилки
    c.strokeStyle = veinCol;
    c.lineWidth = Math.max(0.9, wid * 0.08);
    c.beginPath(); c.moveTo(lx0, 0); c.lineTo(lx0 + bLen * 0.94, 0); c.stroke();

    c.lineWidth = Math.max(0.6, wid * 0.045);
    for (let v = 1; v <= 4; v++) {
      const vx = lx0 + bLen * (v * 0.18);
      const vw = wid * 0.40 * Math.sin((v / 5) * Math.PI);
      c.beginPath();
      c.moveTo(vx, 0); c.quadraticCurveTo(vx + bLen * 0.08, -vw * 0.55, vx + bLen * 0.15, -vw);
      c.moveTo(vx, 0); c.quadraticCurveTo(vx + bLen * 0.08, vw * 0.55, vx + bLen * 0.15, vw);
      c.stroke();
    }
    c.restore();
  },

  /* ---- реалістичний мікропагін / рослина-регенерант in vitro з вузлами, листками, коренями та мікробульбами ---- */
  shootPlantlet(c, cx, baseY, height, o = {}) {
    if (height <= 2) return;
    const stemCol = o.stemCol || "#43A047";
    const leafCol = o.leafCol || "#2E7D32";
    const nLeaves = o.leaves ?? Math.max(2, Math.min(8, Math.round(height / 14)));
    const roots = o.roots ?? 0;
    const rootLen = o.rootLen ?? 24;
    const vitrified = clamp(o.vitrified ?? 0, 0, 1); // гіпергідричність (склоподібність)
    const time = o.time || 0;
    const sway = Math.sin(time * 1.4) * 1.8;
    c.save();

    // 1. Адвентивні корені з бічними розгалуженнями та кореневими волосками (у товщі агару нижче baseY)
    if (roots > 0 && rootLen > 1) {
      c.save();
      for (let r = 0; r < roots; r++) {
        const u = roots === 1 ? 0 : (r / (roots - 1)) * 2 - 1;
        const rxEnd = cx + u * (10 + rootLen * 0.55) + Math.sin(r * 2.1) * 4;
        const ryEnd = baseY + rootLen * (0.68 + 0.32 * Math.cos(u * 1.1));
        const cpX = cx + u * rootLen * 0.28;
        const cpY = baseY + rootLen * 0.45;
        c.strokeStyle = "#E6DEC8";
        c.lineWidth = Math.max(1.1, 2.1 - Math.abs(u) * 0.6);
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(cx + u * 2, baseY);
        c.quadraticCurveTo(cpX, cpY, rxEnd, ryEnd);
        c.stroke();

        // Тонкі кореневі волоски у всмоктувальній зоні кореня
        if (rootLen > 10) {
          c.strokeStyle = "rgba(235, 228, 208, 0.55)";
          c.lineWidth = 0.65;
          for (let h = 0.35; h <= 0.85; h += 0.16) {
            const hx = (1 - h) * (1 - h) * (cx + u * 2) + 2 * (1 - h) * h * cpX + h * h * rxEnd;
            const hy = (1 - h) * (1 - h) * baseY + 2 * (1 - h) * h * cpY + h * h * ryEnd;
            c.beginPath();
            c.moveTo(hx - 3.5, hy + 1);
            c.lineTo(hx + 3.5, hy - 1);
            c.stroke();
          }
        }
      }
      c.restore();
    }

    // 2. Столони та мікробульби картоплі (якщо задано o.tubers)
    if (o.tubers && o.tubers > 0) {
      const tR = o.tuberR || 6;
      for (let k = 0; k < o.tubers; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const nodeY = baseY - Math.min(height * 0.35, 8 + k * 7);
        const tx = cx + side * (12 + (k >> 1) * 9);
        const ty = baseY - 2 + (k % 3) * 3;
        c.strokeStyle = "#C5E1A5";
        c.lineWidth = 1.3;
        c.beginPath();
        c.moveTo(cx, nodeY);
        c.quadraticCurveTo((cx + tx) / 2, nodeY + 5, tx, ty);
        c.stroke();
        Gfx.sphere(c, tx, ty, tR, o.tuberCol || "#D7B377", { ring: "#8D6E63", rw: 1.0, shadow: true });
      }
    }

    // 3. Стебло з градієнтом циліндричного освітлення та вузлами
    const topX = cx + sway;
    const topY = baseY - height;
    const stemW = Math.max(2.2, Math.min(5.2, height * 0.048)) * (1 + vitrified * 0.45);
    const sg = c.createLinearGradient(cx - stemW, baseY, cx + stemW, topY);
    sg.addColorStop(0, shade(stemCol, -0.18));
    sg.addColorStop(0.5, vitrified > 0.2 ? mixc(stemCol, "#A5D6A7", vitrified * 0.6) : stemCol);
    sg.addColorStop(1, shade(stemCol, 0.25));
    c.strokeStyle = sg;
    c.lineWidth = stemW;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(cx, baseY);
    c.quadraticCurveTo(cx + sway * 0.4, baseY - height * 0.5, topX, topY);
    c.stroke();

    // 4. Чергові або супротивні листки з жилкуванням уздовж вузлів стебла
    for (let i = 0; i < nLeaves; i++) {
      const frac = (i + 1) / (nLeaves + 0.6);
      const ny = baseY - height * frac;
      const nx = cx + sway * frac * frac;
      const side = i % 2 === 0 ? -1 : 1;
      const lScale = (0.55 + 0.45 * Math.sin(frac * Math.PI * 0.85)) * clamp(height / 55, 0.55, 1.35);
      const lLen = 18 * lScale * (1 + vitrified * 0.22);
      const lWid = 9.5 * lScale * (1 - vitrified * 0.25);
      const lAng = side < 0 ? Math.PI + 0.42 - frac * 0.18 : -0.42 + frac * 0.18;
      const lCol = vitrified > 0.15 ? mixc(leafCol, "#80CBC4", vitrified * 0.55) : leafCol;

      // Пазушна брунька у вузлі
      c.fillStyle = shade(stemCol, -0.25);
      c.beginPath(); c.arc(nx + side * 1.5, ny - 1, 1.4, 0, Math.PI * 2); c.fill();

      Gfx.leafBlade(c, nx, ny, lLen, lWid, lAng, { col: lCol });
    }

    // 5. Апікальна брунька з двома молодими верхівковими листочками
    const apLen = clamp(height * 0.18, 6, 13);
    Gfx.leafBlade(c, topX, topY + 2, apLen, apLen * 0.5, -Math.PI * 0.36, { col: shade(leafCol, 0.18) });
    Gfx.leafBlade(c, topX, topY + 2, apLen, apLen * 0.5, -Math.PI * 0.64, { col: shade(leafCol, 0.12) });
    Gfx.sphere(c, topX, topY + 1, 2.2, "#81C784");
    c.restore();
  },

  /* ---- реалістичне оптичне вікно мікроскопа (DIC / фазовий контраст / світле поле) ---- */
  microscope(c, cx, cy, r, o = {}) {
    c.save();
    // Зовнішня металева оправа окуляра
    const rimG = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rimG.addColorStop(0, "#455A64");
    rimG.addColorStop(0.5, "#263238");
    rimG.addColorStop(1, "#11171A");
    c.fillStyle = rimG;
    c.beginPath(); c.arc(cx, cy, r + 5, 0, Math.PI * 2); c.fill();

    // Освітлення конденсора мікроскопа
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    const bgG = c.createRadialGradient(cx - r * 0.12, cy - r * 0.12, r * 0.08, cx, cy, r);
    if (o.darkfield) {
      bgG.addColorStop(0, "#182822");
      bgG.addColorStop(0.8, "#0D1713");
      bgG.addColorStop(1, "#060B09");
    } else {
      bgG.addColorStop(0, Theme.dark ? "#1E3026" : "#FAFCF8");
      bgG.addColorStop(0.78, Theme.dark ? "#15231B" : "#EAF1E6");
      bgG.addColorStop(1, Theme.dark ? "#0D1712" : "#CFDCD0");
    }
    c.fillStyle = bgG;
    c.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (o.inside) o.inside(c);

    // Оптична віньєтка та мікрометрична шкала
    const vig = c.createRadialGradient(cx, cy, r * 0.72, cx, cy, r);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.35)");
    c.fillStyle = vig;
    c.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (o.scale) {
      const sx = cx - r * 0.36, sy = cy + r * 0.78, sw = r * 0.38;
      c.strokeStyle = o.darkfield ? "#FFF" : Theme.c.ink;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sx, sy - 3); c.lineTo(sx, sy + 3);
      c.moveTo(sx, sy); c.lineTo(sx + sw, sy);
      c.moveTo(sx + sw, sy - 3); c.lineTo(sx + sw, sy + 3);
      c.stroke();
      Gfx.text(c, o.scale, sx + sw / 2, sy - 5, { align: "center", size: 9.5, font: "mono", weight: 700, color: o.darkfield ? "#FFF" : Theme.c.ink });
    }
    c.restore();

    c.strokeStyle = "rgba(255,255,255,0.28)";
    c.lineWidth = 1.4;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    if (o.label) Gfx.text(c, o.label, cx, cy + r + 17, { align: "center", size: 11, weight: 600, color: Theme.c.ink });
    c.restore();
  },
  spectro(c, x, y, w, hh, o) {
    const T = Theme.c;
    Gfx.rr(c, x, y, w, hh, 14); const bg = c.createLinearGradient(0, y, 0, y + hh); bg.addColorStop(0, Theme.dark ? "#2d3d33" : "#EDF1EA"); bg.addColorStop(1, Theme.dark ? "#223028" : "#D3DBD0"); c.fillStyle = bg; c.fill(); c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
    const dx = x + 14, dy = y + 14, dw = w - 28, dh = Math.max(46, hh * .34);
    Gfx.rr(c, dx, dy, dw, dh, 8); c.fillStyle = "#0E1F14"; c.fill();
    c.font = `600 10.5px ${FM()}`; c.fillStyle = "#7CD67F"; c.textAlign = "left"; c.textBaseline = "top"; c.fillText(`λ = ${NA(o.lam, 0)} нм`, dx + 10, dy + 8);
    const txt = o.text; let fs = Math.min(34, dh * .62); c.font = `700 ${fs}px ${FM()}`; while (c.measureText(txt).width > dw - 24 && fs > 12) { fs -= 1; c.font = `700 ${fs}px ${FM()}`; }
    c.fillStyle = "#9FEFA2"; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText(txt, dx + dw - 12, dy + dh * .6);
    const cy0 = dy + dh + 16, ch = y + hh - cy0 - 26, mid = cy0 + ch / 2, cw = Math.min(34, w * .14), cx0 = x + w / 2 - cw / 2;
    Gfx.rr(c, x + 14, cy0 - 4, w - 28, ch + 8, 8); c.fillStyle = Theme.dark ? "rgba(0,0,0,.28)" : "rgba(0,0,0,.07)"; c.fill();
    const beam = Spectral.lambdaToRGB(o.lam), T10 = Math.pow(10, -(o.A || 0));
    Gfx.glow(c, x + 30, mid, 22, "#FFE9A8", .55); Gfx.sphere(c, x + 30, mid, 7, "#FFE08A");
    c.lineCap = "butt"; c.strokeStyle = beam; c.lineWidth = 4; c.globalAlpha = .9; c.beginPath(); c.moveTo(x + 40, mid); c.lineTo(cx0, mid); c.stroke();
    c.globalAlpha = clamp(T10, .06, 1); c.beginPath(); c.moveTo(cx0 + cw, mid); c.lineTo(x + w - 40, mid); c.stroke(); c.globalAlpha = 1;
    Gfx.rr(c, x + w - 40, mid - 11, 14, 22, 3); c.fillStyle = "#394148"; c.fill();
    Gfx.rr(c, cx0, cy0 + 2, cw, ch - 4, 4); c.fillStyle = o.col || "#DDE"; c.fill();
    const gl = c.createLinearGradient(cx0, 0, cx0 + cw, 0); gl.addColorStop(0, "rgba(255,255,255,.45)"); gl.addColorStop(.3, "rgba(255,255,255,.05)"); gl.addColorStop(1, "rgba(0,0,0,.15)"); c.fillStyle = gl; c.fillRect(cx0, cy0 + 2, cw, ch - 4);
    Gfx.rr(c, cx0, cy0 + 2, cw, ch - 4, 4); c.strokeStyle = rgba(T.ink, .45); c.lineWidth = 1.2; c.stroke();
    c.font = `10px ${FB()}`; c.fillStyle = T.muted; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(o.sub || "кювета 10 мм", x + w / 2, y + hh - 9);
  },
  grain(c, x, y, w, hh, col, seed = 1, n = 120, a = .1) {
    const r = rng(seed); c.fillStyle = col; c.fillRect(x, y, w, hh);
    for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${r() < .5 ? "255,255,255" : "0,0,0"},${a * r()})`; c.beginPath(); c.arc(x + r() * w, y + r() * hh, .6 + r() * 1.8, 0, 7); c.fill(); }
  },
};

UI.modes = function (tabsBox, stageBox, ctrls, below, defs, onChange) {
  const boxes = {}; let cur = defs[0][0];
  const row = h("div", { class: "mtabs", role: "tablist" });
  tabsBox.append(row);
  const btns = {};
  for (const [id, label] of defs) {
    const st = h("div", { class: "mbox", style: "min-width:0;display:flex;flex-direction:column;gap:10px" });
    const ct = h("div", { class: "mbox", style: "display:flex;flex-direction:column;gap:12px;min-width:0" });
    const bl = h("div", { class: "mbox", style: "display:flex;flex-direction:column;gap:14px;min-width:0" });
    stageBox.append(st); ctrls.append(ct); below.append(bl);
    boxes[id] = { st, ct, bl };
    const b = h("button", { class: "mtab", type: "button", role: "tab", onclick: () => set(id) }, label);
    btns[id] = b; row.append(b);
  }
  function set(id) {
    cur = id;
    for (const [k] of defs) { const on = k === id; btns[k].setAttribute("aria-selected", String(on)); for (const p of ["st", "ct", "bl"]) boxes[k][p].hidden = !on; }
    onChange && onChange(id);
    for (const k in boxes) boxes[k].st.querySelectorAll("canvas").forEach(cv => cv.parentElement && cv.parentElement._st && cv.parentElement._st.resize());
  }
  return { box: (id) => boxes[id], get cur() { return cur; }, set, init() { set(cur); } };
};
UI.out = function (parent, html, cls = "") { const d = h("div", { class: "bout " + cls, html }); parent.append(d); return { set(x) { UI.html(d, x); }, el: d }; };
UI.html = function (el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
UI.tip = function (parent, html) { parent.append(h("p", { class: "note", html })); };

function alignTables(root) {
  root.querySelectorAll("table.t").forEach(t => {
    const rows = [...t.tBodies].flatMap(b => [...b.rows]); if (!rows.length) return;
    const hs = t.tHead && t.tHead.rows[0] ? [...t.tHead.rows[0].cells] : [];
    hs.forEach((th, i) => { th.classList.toggle("n", rows.every(r => r.cells[i] && (r.cells[i].classList.contains("n") || r.cells[i].colSpan > 1 || !r.cells[i].textContent.trim()))); });
  });
}
function sci(x, d = 1) {
  if (!isFinite(x) || x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e), sup = String(e).replace("-", "⁻").replace(/\d/g, ch => "⁰¹²³⁴⁵⁶⁷⁸⁹"[ch]);
  return fmt(m, d) + "·10" + sup;
}

const App = {
  labs: LABS, active: null,
  def(n, d) { const L = this.labs.find(x => x.n === n); Object.assign(L, d); L.loaded = true; (L.waiters || []).forEach(f => f()); L.waiters = []; },
  load(L) {
    return new Promise((res) => {
      if (L.loaded) return res();
      (L.waiters = L.waiters || []).push(res);
      if (L.loading) return; L.loading = true;
      const s = document.createElement("script"); s.src = BASE + "biotech/lab-" + String(L.n).padStart(2, "0") + ".js" + VQ;
      s.onerror = () => { L.loading = false; L.sec.replaceChildren(h("p", { class: "note" }, "Не вдалося завантажити тему. Оновіть сторінку.")); };
      document.head.append(s);
    });
  },
  dirtyAll() { for (const l of this.labs) if (l.inst) l.inst.stages?.forEach(s => s.dirty = true); },
  boot() {
    const nav = $("#index"), main = $("#labs");
    for (const L of this.labs) {
      L.a = h("a", { href: "#lab" + L.n, "data-n": L.n }, h("span", { class: "no" }, String(L.n).padStart(2, "0")), h("span", { class: "t" }, L.short), h("span", { class: "m" }, L.labs + " · " + L.tag));
      nav.append(L.a);
      L.sec = h("section", { class: "lab", id: "lab" + L.n, "aria-labelledby": "lab" + L.n + "-h" });
      main.append(L.sec);
    }
    nav.prepend(h("a", { href: "#", class: "back" }, "← Усі теми (ЛР 1–55)"));
    const list = $("#pp-list"), ff = $("#ff");
    const route = (overrideHash) => {
      const hs = typeof overrideHash === "string" ? overrideHash : location.hash.replace("#", "");
      const n = parseInt(hs.replace("lab", ""), 10);
      const L = /^lab\d+$/.test(hs) && this.labs.find(l => l.n === n);
      if (!L) {
        this.active = null; ff.hidden = true; list.hidden = false;
        document.title = this.t0 || document.title; return;
      }
      if (!this.t0) this.t0 = document.title;
      list.hidden = true; ff.hidden = false;
      this.show(L);
      ff.scrollIntoView({ block: "start" });
    };
    addEventListener("hashchange", () => route());
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href^='#']");
      if (!a) return;
      const href = a.getAttribute("href");
      if (href === "#" || /^#lab\d+$/.test(href)) {
        e.preventDefault();
        try { location.hash = href; } catch (_) {}
        route(href.slice(1));
      }
    });
    route();
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000)); last = t;
      const L = this.active;
      if (L && L.inst && !document.hidden) {
        let run = L.running, d = dt;
        if (!run && L.stepReq) { run = true; d = 1 / 30; L.stepReq = false; }
        if (run) L.simT += d;
        try { L.inst.frame(run ? d : 0, L.simT); } catch (e) { console.error(e); }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
  show(L) {
    for (const x of this.labs) { x.sec.classList.toggle("on", x === L); x.a.setAttribute("aria-current", String(x === L)); }
    this.active = L;
    document.title = `Тема ${L.n} (${L.labs}). ${L.short} — Біотехнологія в агросфері`;
    if (!L.sec.firstChild) L.sec.append(h("p", { class: "note loading" }, "Завантаження моделі…"));
    this.load(L).then(() => {
      if (!L.inst && !L.built) this.build(L);
      L.inst?.stages?.forEach(s => s.resize());
    });
  },
  build(L) {
    L.built = true;
    const sec = L.sec; sec.replaceChildren();
    L.running = true; L.simT = 0; // Запускаємо плавну анімацію одразу для миттєвого візуального відгуку
    sec.append(h("div", { class: "lab-head" },
      h("div", null, h("div", { class: "eyebrow" }, `Тема № ${L.n} · ${L.labs} (с. ${L.pages})`), h("h2", { id: "lab" + L.n + "-h" }, L.title)),
      h("div", { class: "model" }, L.model)));
    const secHead = (n, t) => h("h3", { class: "ff-sec__h" }, h("span", { class: "n" }, n), t);
    // 01 теорія
    const th = h("div", { class: "panel bth" });
    const main = h("div", { class: "bth-main" });
    main.insertAdjacentHTML("beforeend", L.cheat);
    const toc = h("nav", { class: "bth-toc", "aria-label": "Зміст теорії" }, h("div", { class: "cap" }, "У цьому розділі"));
    const heads = [...main.querySelectorAll("h3")], links = [];
    heads.forEach((x, i) => {
      x.id = `l${L.n}-s${i}`;
      const a = h("a", { href: "#" + x.id, onclick: (e) => { e.preventDefault(); x.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); } }, x.textContent);
      toc.append(a); links.push(a);
    });
    th.append(toc, main);
    let tick = false;
    const mark = () => {
      tick = false;
      if (!th.isConnected) { removeEventListener("scroll", onScroll); return; }
      const lim = 120; let cur = -1;
      heads.forEach((x, i) => { if (x.getBoundingClientRect().top < lim) cur = i; });
      const r = th.getBoundingClientRect(); if (r.bottom < lim || r.top > innerHeight) cur = -1;
      links.forEach((a, i) => a.classList.toggle("on", i === cur));
    };
    const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(mark); } };
    addEventListener("scroll", onScroll, { passive: true });
    sec.append(h("section", { class: "ff-sec" }, secHead("01", "Теоретичні відомості та протоколи робіт"), th));
    // 02 модель
    const status = h("span", { class: "runbar__st" });
    const setRun = (on) => {
      L.running = on; const fresh = !on && L.simT === 0;
      pauseB.textContent = on ? "⏸ Пауза" : fresh ? "▶ Запустити" : "▶ Продовжити";
      status.textContent = on ? "Модель працює в реальному часі" : fresh ? "Модель зупинена — натисніть «Запустити»" : "Пауза: параметри можна змінювати наживо";
      status.classList.toggle("on", on); stepB.disabled = on;
    };
    const pauseB = h("button", { class: "btn pri", type: "button", onclick: () => setRun(!L.running) }, "⏸ Пауза");
    const stepB = h("button", { class: "btn", type: "button", title: "Зробити один крок (≈ 0,03 с) на паузі", onclick: () => { L.stepReq = true; } }, "⏭ Крок");
    const resetB = h("button", { class: "btn", type: "button", onclick: () => this.reset(L) }, "↺ Скинути");
    const sim = h("div", { class: "panel sim" });
    sec.append(h("section", { class: "ff-sec" }, secHead("02", "Інтерактивна математична модель"), h("div", { class: "runbar" }, pauseB, stepB, resetB, status), sim));
    sim.addEventListener("click", (e) => { const b = e.target.closest(".btn"); if (b && !L.running && !b.hasAttribute("aria-pressed") && !b.closest(".tabsbox") && !/скин|скид/i.test(b.textContent)) setRun(true); });
    const tabsBox = h("div", { class: "tabsbox" }); sim.append(tabsBox);
    const top = h("div", { class: "sim-top" }), stageBox = h("div", { style: "min-width:0;display:flex;flex-direction:column;gap:10px" }), ctrls = h("div", { class: "ctrls" });
    top.append(stageBox, ctrls); sim.append(top);
    const below = h("div", { style: "display:flex;flex-direction:column;gap:14px;min-width:0" }); sim.append(below);
    L.inst = L.build({ stageBox, ctrls, below, tabsBox, sim });
    { let q = 0; const run = () => { q = 0; alignTables(sim); }; alignTables(sim);
      new MutationObserver(() => { if (!q) q = requestAnimationFrame(run); }).observe(sim, { childList: true, subtree: true }); }
    if (!L.inst.stages) L.inst.stages = [];
    setRun(true);
    // 03 питання
    const qs = h("div", { class: "panel qa-list" });
    const allB = h("button", { class: "btn", type: "button", onclick: () => { const open = !qs.querySelector("details:not([open])"); qs.querySelectorAll("details").forEach(d => d.open = !open); allB.textContent = open ? "Розгорнути всі відповіді" : "Згорнути всі"; } }, "Розгорнути всі відповіді");
    for (const [q, a] of L.qa) qs.insertAdjacentHTML("beforeend", `<details class="qa"><summary>${q}</summary><div class="qa-a">${a}</div></details>`);
    sec.append(h("section", { class: "ff-sec" }, secHead("03", "Контрольні питання для самоперевірки"), h("div", { class: "qa-bar" }, h("span", { class: "note" }, `Питань: ${L.qa.length}. Спершу спробуйте відповісти самостійно, потім перевірте себе.`), allB), qs));
    // навігація між темами
    const pv = this.labs.find(x => x.n === L.n - 1), nx = this.labs.find(x => x.n === L.n + 1);
    sec.append(h("nav", { class: "lab-pn" },
      pv ? h("a", { href: "#lab" + pv.n }, h("small", null, `← Тема ${pv.n} (${pv.labs})`), `${pv.short}`) : h("span"),
      nx ? h("a", { href: "#lab" + nx.n, class: "nx" }, h("small", null, `Тема ${nx.n} (${nx.labs}) →`), `${nx.short}`) : h("span")));
    sec.append(h("p", { class: "lab-src" }, h("b", null, "Джерело: "), `Мельничук М. Д., Кляченко О. Л. Біотехнологія в агросфері: навчальний посібник для студентів вищих навчальних закладів. Київ: НУБіП України, 2014. 269 с. — Тема № ${L.n} (${L.labs}), с. ${L.pages}.`));
  },
  reset(L) {
    L.inst?.stages?.forEach(st => st.ro?.disconnect());
    L.inst = null; L.built = false; L.sec.replaceChildren();
    this.build(L);
    L.inst?.stages?.forEach(st => st.resize());
  },
};

window.BIO = { hash01, sci, alignTables, App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => App.boot()); else App.boot();
