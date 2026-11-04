// Біоенергетичні основи біотехнологічних процесів: ядро застосунку (код згенеровано з вихідних файлів).
"use strict";
const LABS = [{"n": 1, "pages": "6–10", "short": "Стаціонарний стан", "tag": "ентропія · μ̃ Na⁺", "title": "Вивчення стаціонарного стану термодинамічної системи та критеріїв його досягнення у біологічних системах", "model": "dS/dt = dᵢS/dt + dₑS/dt = 0 · μ̃ = μ⁰ + RT·ln c + zFφ"}, {"n": 2, "pages": "10–13", "short": "Ентальпія і рівновага", "tag": "Гесс · Ле Шательє", "title": "Ентальпія. Тепловий ефект біохімічної реакції", "model": "ΔH = Q_p · ln K = −ΔH/RT + ΔS/R · q = λ·ΔT/δ"}, {"n": 3, "pages": "13–18", "short": "Ліганди й кооперативність", "tag": "Хілл · порфірини", "title": "Вивчення принципів зв’язування лігандів з макромолекулами в біополімерах", "model": "Y = [L]ⁿ/(K₀,₅ⁿ + [L]ⁿ) · MWC · Mg²⁺ ⇄ 2H⁺ / Cu²⁺ / Zn²⁺ у порфіриновому ядрі"}, {"n": 4, "pages": "18–21", "short": "Потенціал спокою і дії", "tag": "Нернст · ГГК · Ходжкін–Хакслі", "title": "Вивчення механізмів формування потенціалу спокою і потенціалу дії на клітинній мембрані", "model": "Eᵢ = (RT/zF)·ln(cₒ/cᵢ) · V = (RT/F)·ln(ΣPcₒ/ΣPcᵢ) · C·dV/dt = −ΣI"}, {"n": 5, "pages": "21–23", "short": "Маркерні ферменти", "tag": "Фіске–Суббароу · центрифугування", "title": "Маркерні ензими плазматичної мембрани та ендомембран", "model": "A = ε·c·l · K = E₈₂₀/C_Фн · v_осідання = 2r²(ρ − ρ₀)ω²R/9η"}, {"n": 6, "pages": "23–27", "short": "Макроергічні сполуки", "tag": "ΔG′ · АТФ · енергетичний заряд", "title": "Макроергічні сполуки", "model": "ΔG = ΔG°′ + RT·ln([АДФ][Фн]/[АТФ]) · ЕЗ = ([АТФ] + ½[АДФ])/([АТФ]+[АДФ]+[АМФ])"}, {"n": 7, "pages": "27–32", "short": "Активатори й інгібітори", "tag": "Міхаеліс–Ментен · MWC · малонат", "title": "Вивчення шляхів активування та інгібування ферментів", "model": "v = Vmax[S]/(Kₘ(1 + [I]/Kᵢ) + [S]) · Y = [S]ⁿ/(K₀,₅ⁿ + [S]ⁿ)"}, {"n": 8, "pages": "32–36", "short": "Гліколіз і вуглеводи", "tag": "10 реакцій · баланс АТФ", "title": "Глюкоза як ключовий метаболіт обміну вуглеводів", "model": "C₆H₁₂O₆ + 2НАД⁺ + 2АДФ + 2Фн → 2 піруват + 2НАДН + 2АТФ · B = c·k/m"}, {"n": 9, "pages": "36–43", "short": "Цикл Кребса", "tag": "регуляція · мітка ¹⁴C", "title": "Вивчення механізмів регуляції циклу трикарбонових кислот", "model": "v = f(НАДН/НАД⁺, АТФ/АДФ, цитрат) · A = (D_к − D_д)·V/(ε·t·m)"}, {"n": 10, "pages": "43–48", "short": "Окисне фосфорилювання", "tag": "Мітчелл · дихальний контроль", "title": "Енергетичний обмін. Окисне фосфорилювання", "model": "Δp = Δψ − (2,3RT/F)·ΔpH · J(O₂) = f(АДФ, Δp) · P/O"}, {"n": 11, "pages": "48–50", "short": "Пігменти листка", "tag": "Бер–Ламберт · спектрофотометрія", "title": "Кількісне визначення пігментів листка", "model": "C_a = 13,7·E₆₆₅ − 5,76·E₆₄₉ · C_b = 25,8·E₆₄₉ − 7,60·E₆₆₅ · C_(a+b) = 25,1·E₆₅₄"}, {"n": 12, "pages": "50–53", "short": "Ферменти дихання", "tag": "пероксидаза · дегідрогенази", "title": "Дослідження ферментів дихання рослин", "model": "AH₂ + H₂O₂ → A + 2H₂O · МС (синій) ⇄ лейко-МС (безбарвний)"}, {"n": 13, "pages": "53–58", "short": "Антиоксидантна система", "tag": "СОД · аскорбат–глутатіон", "title": "Дослідження основних компонентів антиоксидантної системи рослин", "model": "O₂•⁻ → H₂O₂ → H₂O · GSH/GSSG · A = a·0,088·V/(m·n)"}, {"n": 14, "pages": "58–60", "short": "Іммобілізовані ферменти", "tag": "дифузія–реакція · Тіле", "title": "Застосування іммобілізованих ферментів та клітин у біотехнологічних процесах", "model": "φ = R·√(V/(Kₘ·D)) · η = 3(φ·cth φ − 1)/φ² · N = m·D/(a·V)"}, {"n": 15, "pages": "60–63", "short": "М’язове скорочення", "tag": "ковзання ниток · АТФ · лактат", "title": "Вивчення хімізму м’язового скорочення", "model": "F(L) · [Ca²⁺] → трономіозин → місткові цикли · КФ + АДФ → АТФ · піруват → лактат"}];
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
const RG = 8.314; // J/(mol·K)
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
// seeded RNG so textures are stable between frames
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }
/** детермінований «шум» за індексом (на відміну від rng(i+k) не дає скупчень при сусідніх i) */
function hash01(i, s = 0) { let x = Math.imul(i + 1, 374761393) ^ Math.imul(s + 1, 668265263); x = Math.imul(x ^ (x >>> 13), 1274126177); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- theme tokens readable from canvas ---- */
const Theme = {
  c: {}, v: 0,
  read() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ["paper", "sheet", "stage", "ink", "muted", "rule", "chl", "chl-soft", "antho", "carot", "data", "warn", "good", "bad"])
      this.c[k] = cs.getPropertyValue("--" + k).trim();
    this.dark = this.lum(this.c.paper) < 0.4;
    this.v++;
  },
  lum(hex) { const n = parseInt(hex.slice(1), 16); return (((n >> 16) & 255) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) / 255; },
};
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(lerp((A >> s) & 255, (B >> s) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
Theme.read();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { Theme.read(); App.dirtyAll(); });
new MutationObserver(() => { Theme.read(); App.dirtyAll(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

/* ---- canvas stage with DPR + resize ---- */
class Stage {
  constructor(parent, { aspect = 16 / 9, minH = 200, maxH = 520, tag = null, chart = false } = {}) {
    this.wrap = h("div", { class: "stage" });
    this.cv = h("canvas");
    this.wrap.append(this.cv);
    if (tag) this.wrap.append(h("span", { class: "tag" }, tag));
    parent.append(this.wrap);
    this.wrap._st = this;
    this.ctx = this.cv.getContext("2d");
    this.aspect = aspect; this.minH = minH; this.maxH = maxH;
    this.W = 300; this.H = 200; this.dirty = true;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.wrap);
    this.mouse = null;
    this.cv.addEventListener("pointermove", (e) => { const r = this.cv.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; this.dirty = true; });
    this.cv.addEventListener("pointerleave", () => { this.mouse = null; this.dirty = true; });
  }
  resize() {
    const w = this.wrap.clientWidth || 300;
    const hh = Math.round(clamp(w / this.aspect, this.minH, this.maxH));
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.cv.style.height = hh + "px";
    this.cv.width = Math.round(w * d); this.cv.height = Math.round(hh * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.W = w; this.H = hh; this.d = d; this.dirty = true;
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
/** o: {x:[min,max], y:[min,max], xl, yl, xlog, ylog, series:[{pts,color,w,fill,dash,step,bars}], marks:[{x,y,color,r,label}], hl:[{y,color,label,dash}], vl:[{x,color,label}], xt, yt, xfmt, band:[{x0,x1,color}], spectrum:true} */
function drawChart(st, o) {
  const c = st.ctx, W = st.W, H = st.H, T = Theme.c;
  c.fillStyle = T.sheet; c.fillRect(0, 0, W, H);
  const L = o.padL ?? 46, R = o.padR ?? 12, Tp = o.padT ?? 12, B = o.spectrum ? 40 : 34;
  const pw = W - L - R, ph = H - Tp - B;
  const lx = (v) => o.xlog ? Math.log10(v) : v, ly = (v) => o.ylog ? Math.log10(v) : v;
  const [x0, x1] = o.x.map(lx), [y0, y1] = o.y.map(ly);
  const X = (v) => L + (lx(v) - x0) / (x1 - x0) * pw;
  const Y = (v) => Tp + ph - (ly(v) - y0) / (y1 - y0) * ph;
  const xt = o.xt || (o.xlog ? logTicks(o.x) : niceTicks(o.x[0], o.x[1], Math.max(3, Math.floor(pw / 70))));
  const yt = o.yt || (o.ylog ? logTicks(o.y) : niceTicks(o.y[0], o.y[1], Math.max(3, Math.floor(ph / 38))));
  c.font = "11px " + getComputedStyle(document.body).getPropertyValue("--f-mono");
  c.lineWidth = 1;
  if (o.band) for (const b of o.band) { c.fillStyle = b.color; c.fillRect(X(b.x0), Tp, X(b.x1) - X(b.x0), ph); }
  for (const v of yt) { const y = Math.round(Y(v)) + .5; c.strokeStyle = rgba(T.ink.length === 7 ? T.ink : "#000000", .08); c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); c.fillStyle = T.muted; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText((o.yfmt || tickFmt)(v), L - 6, y); }
  for (const v of xt) { const x = Math.round(X(v)) + .5; c.strokeStyle = rgba(T.ink, .05); c.beginPath(); c.moveTo(x, Tp); c.lineTo(x, Tp + ph); c.stroke(); c.fillStyle = T.muted; c.textAlign = "center"; c.textBaseline = "top"; c.fillText((o.xfmt || tickFmt)(v), x, Tp + ph + (o.spectrum ? 12 : 6)); }
  if (o.spectrum) { for (let x = 0; x < pw; x++) { const lam = lerp(o.x[0], o.x[1], x / pw); c.fillStyle = Spectral.lambdaToRGB(lam); c.fillRect(L + x, Tp + ph + 2, 1.2, 7); } }
  c.strokeStyle = T.rule; c.strokeRect(L + .5, Tp + .5, pw, ph);
  c.save(); c.beginPath(); c.rect(L, Tp, pw, ph); c.clip();
  for (const hl of o.hl || []) { c.strokeStyle = hl.color || T.muted; c.setLineDash(hl.dash || [4, 4]); c.beginPath(); c.moveTo(L, Y(hl.y)); c.lineTo(L + pw, Y(hl.y)); c.stroke(); c.setLineDash([]); if (hl.label) { c.fillStyle = hl.color || T.muted; c.textAlign = "right"; c.textBaseline = "bottom"; c.fillText(hl.label, L + pw - 4, Y(hl.y) - 3); } }
  for (const vl of o.vl || []) { c.strokeStyle = vl.color || T.muted; c.setLineDash(vl.dash || [4, 4]); c.beginPath(); c.moveTo(X(vl.x), Tp); c.lineTo(X(vl.x), Tp + ph); c.stroke(); c.setLineDash([]); if (vl.label) { c.fillStyle = vl.color || T.muted; c.textAlign = vl.align || "left"; c.textBaseline = "top"; c.fillText(vl.label, X(vl.x) + (vl.align === "right" ? -4 : 4), Tp + 4); } }
  for (const s of o.series || []) {
    if (!s.pts || !s.pts.length) continue;
    if (s.bars) {
      const bw = s.bw ?? (pw / (o.x[1] - o.x[0]) * 0.7);
      for (const [x, y] of s.pts) { c.fillStyle = s.color; c.fillRect(X(x) - bw / 2, Y(y), bw, Y(o.y[0]) - Y(y)); }
      continue;
    }
    if (s.fill) {
      c.beginPath(); c.moveTo(X(s.pts[0][0]), Y(o.y[0]));
      for (const [x, y] of s.pts) c.lineTo(X(x), Y(y));
      c.lineTo(X(s.pts[s.pts.length - 1][0]), Y(o.y[0])); c.closePath(); c.fillStyle = s.fill; c.fill();
    }
    c.beginPath(); c.strokeStyle = s.color; c.lineWidth = s.w || 2; c.lineJoin = "round"; c.setLineDash(s.dash || []);
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
function logTicks([a, b]) { const out = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) { const v = Math.pow(10, e); if (v >= a * .999 && v <= b * 1.001) out.push(v); } return out; }

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
  seg(parent, { label, options, value, on }) { // segmented toggle
    const wrap = h("div", { class: "ctl" }); if (label) wrap.append(h("div", { class: "lbl" }, h("span", null, label)));
    const row = h("div", { class: "btns" }); wrap.append(row);
    const els = options.map(([v, t]) => { const e = h("button", { class: "btn", type: "button", "aria-pressed": String(v === value), onclick: () => { els.forEach(x => x.setAttribute("aria-pressed", "false")); e.setAttribute("aria-pressed", "true"); on(v); } }, t); row.append(e); return e; });
    parent.append(wrap); return els;
  },
  reads(parent, keys) {
    const g = h("div", { class: "reads" }); const m = {};
    for (const [k, label] of keys) { const v = h("div", { class: "v" }, "—"); g.append(h("div", { class: "rd" }, h("div", { class: "k" }, label), v)); m[k] = v; }
    parent.append(g);
    return { set(k, val, unit) { UI.html(m[k], val + (unit ? `<small>${unit}</small>` : "")); } };
  },
  chart(parent, title, opts) { const w = h("div", { class: "chart" }, h("h4", null, title)); parent.append(w); return new Stage(w, Object.assign({ aspect: 1.9, minH: 190, maxH: 300 }, opts)); },
};

/* ---- spectral color engine (CIE 1931 analytic fit, Wyman et al. 2013) ---- */
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
  /** pigments: absorption bands [[λ0,σ,amp],...] per unit conc. */
  const P = {
    chlA: [[430, 12, 1.30], [412, 14, 0.55], [470, 14, 0.10], [535, 25, 0.05], [585, 22, 0.13], [620, 15, 0.22], [664, 10.5, 1.00]],
    chlB: [[457, 13, 1.55], [430, 14, 0.40], [480, 12, 0.25], [595, 20, 0.12], [645, 10.5, 0.58]],
    car: [[425, 9, 1.55], [451, 11, 2.45], [479, 10, 2.15]],
    xan: [[421, 9, 1.45], [445, 11, 2.35], [473, 10, 2.05]],
    chlin: [[405, 13, 1.25], [500, 25, 0.05], [640, 12, 0.75]],
    pheoA: [[409, 12, 1.45], [470, 25, 0.15], [505, 16, 0.24], [535, 15, 0.2], [610, 14, 0.12], [667, 10.5, 0.55]],
    pheoB: [[434, 13, 1.55], [525, 12, 0.10], [600, 14, 0.06], [654, 10, 0.32]],
    cuChl: [[422, 13, 1.50], [608, 16, 0.12], [652, 11, 0.85]],
    betanin: [[538, 33, 1.00], [480, 40, 0.35], [415, 25, 0.22]],
    betaninAcid: [[546, 34, 0.95], [485, 40, 0.33], [415, 25, 0.22]],
    mred: [[515, 42, 1.00], [430, 30, 0.15]],
    prussian: [[690, 90, 1.0]],
    dpaBlue: [[600, 70, 1.0]],
    benzBlue: [[600, 65, 1.0]],
    fuchsin: [[545, 32, 1.0]],
    indigo: [[610, 40, 1.0]],
  };
  function absorb(comp, l) { let A = 0; for (const k in comp) { const c = comp[k]; if (!c) continue; for (const [m, s, a] of P[k]) { const t = (l - m) / s; A += c * a * Math.exp(-0.5 * t * t); } } return A; }
  function colorOf(comp, path = 1, asArr = false) {
    const T = LAM.map(l => Math.pow(10, -absorb(comp, l) * path));
    let lin = toLin(xyzOf(T)).map((v, i) => Math.max(0, v / white[i]));
    const mx = Math.max(...lin); if (mx > 1) lin = lin.map(v => v / mx);
    lin = lin.map(v => v * 0.86);
    const rgb = lin.map(gam).map(v => Math.round(v * 255));
    return asArr ? rgb : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  }
  function lambdaToRGB(l) { // display color of a monochromatic line
    let [X, Y, Z] = [xb(l), yb(l), zb(l)];
    let [r, g2, b] = toLin([X, Y, Z]); const m = Math.min(r, g2, b); if (m < 0) { r -= m; g2 -= m; b -= m; }
    const mx = Math.max(r, g2, b) || 1; const f = 0.25 + 0.75 * smooth(380, 420, l) * (1 - smooth(680, 730, l)) ;
    return `rgb(${Math.round(gam(r / mx * f) * 255)},${Math.round(gam(g2 / mx * f) * 255)},${Math.round(gam(b / mx * f) * 255)})`;
  }
  return { P, absorb, colorOf, lambdaToRGB, LAM };
})();

/* ---- drawing helpers shared by labs ---- */
const Draw = {
  tube(c, x, y, w, hgt, layers, opt = {}) { // layers: [{frac, color}] bottom→top ; y = top of tube
    const r = w / 2, T = Theme.c;
    c.save();
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + hgt - r); c.arc(x + r, y + hgt - r, r, Math.PI, 0, true); c.lineTo(x + w, y); c.closePath();
    c.save(); c.clip();
    c.fillStyle = Theme.dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.55)"; c.fillRect(x, y, w, hgt);
    const fillH = (opt.fill ?? 0.62) * hgt; let yy = y + hgt;
    for (const L of layers) { const lh = fillH * L.frac; c.fillStyle = L.color; c.fillRect(x, yy - lh, w, lh + .5); yy -= lh; }
    if (opt.after) opt.after(c, yy);
    const gr = c.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(.18, "rgba(255,255,255,.08)"); gr.addColorStop(.55, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.18)");
    c.fillStyle = gr; c.fillRect(x, y, w, hgt);
    c.restore();
    c.lineWidth = 1.4; c.strokeStyle = opt.stroke || rgba(T.ink, .55); c.stroke();
    c.beginPath(); c.ellipse(x + r, y, r + 1.5, 2.5, 0, 0, 7); c.stroke();
    if (opt.label) { c.fillStyle = opt.labelColor || T.muted; c.font = "600 11px " + getComputedStyle(document.body).getPropertyValue("--f-mono"); c.textAlign = "center"; c.textBaseline = "top"; c.fillText(opt.label, x + r, y + hgt + 6); }
    c.restore();
  },
  text(c, s, x, y, { size = 11, color = Theme.c.muted, align = "left", base = "alphabetic", font = "mono", weight = "" } = {}) {
    c.font = `${weight} ${size}px ${getComputedStyle(document.body).getPropertyValue(font === "mono" ? "--f-mono" : font === "display" ? "--f-display" : "--f-body")}`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y);
  },
};

/* ---- registry, router, loop ---- */

/* ============ Біоенергетичні основи біотехнологічних процесів: додаткові засоби ============ */
const BASE = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, "") : "../../assets/js/lab/";
const VQ = (document.currentScript && document.currentScript.src && document.currentScript.src.match(/\?.*$/)) ? document.currentScript.src.match(/\?.*$/)[0] : "";
const IMG = BASE.replace(/js\/lab\/$/, "img/bio/");
const NA = (x, d = 2) => fmt(x, d);

/* ---- кольори ---- */
function hex2rgb(c) {
  if (c[0] === "#") { const n = parseInt(c.length === 4 ? c.replace(/./g, (m, i) => i ? m + m : "").slice(1) : c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
function shade(c, k) { // k>0 → до білого, k<0 → до чорного
  const [r, g, b] = hex2rgb(c); const t = k > 0 ? 255 : 0, a = Math.abs(k);
  return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`;
}
function alpha(c, a) { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})`; }
function mixc(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
const ease = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const FB = () => getComputedStyle(document.body).getPropertyValue("--f-body");
const FM = () => getComputedStyle(document.body).getPropertyValue("--f-mono");
const FD = () => getComputedStyle(document.body).getPropertyValue("--f-display");

/* ---- графічні заготовки: об'ємні кулі, мембрани, білки, скло ---- */
const Gfx = {
  rr(c, x, y, w, hh, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, hh, r); else c.rect(x, y, w, hh); },
  sphere(c, x, y, r, col, o = {}) {
    const g = c.createRadialGradient(x - r * .38, y - r * .42, r * .08, x, y, r);
    g.addColorStop(0, shade(col, .62)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.38));
    c.globalAlpha = o.a ?? 1; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    if (o.ring) { c.strokeStyle = o.ring; c.lineWidth = o.rw || 1; c.stroke(); }
    c.globalAlpha = 1;
  },
  glow(c, x, y, r, col, a = .5) {
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, alpha(col, a)); g.addColorStop(1, alpha(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  },
  arrow(c, x1, y1, x2, y2, o = {}) {
    const col = o.col || Theme.c.ink, w = o.w || 2, hd = o.head || 7, a = Math.atan2(y2 - y1, x2 - x1);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = "round"; c.setLineDash(o.dash || []);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * hd * .6, y2 - Math.sin(a) * hd * .6); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - hd * Math.cos(a - .42), y2 - hd * Math.sin(a - .42)); c.lineTo(x2 - hd * Math.cos(a + .42), y2 - hd * Math.sin(a + .42)); c.closePath(); c.fill();
  },
  text(c, s, x, y, o = {}) { Draw.text(c, s, x, y, Object.assign({ font: "body", color: Theme.c.ink, size: 12 }, o)); },
  chip(c, s, x, y, o = {}) { // підпис у плашці
    const size = o.size || 11; c.font = `${o.weight || 600} ${size}px ${FB()}`;
    const w = c.measureText(s).width + 14, hh = size + 9; let X = x;
    if (o.align === "center") X = x - w / 2; else if (o.align === "right") X = x - w;
    Gfx.rr(c, X, y - hh / 2, w, hh, hh / 2); c.fillStyle = o.bg || alpha(Theme.c.sheet.length === 7 ? Theme.c.sheet : "#ffffff", .92); c.fill();
    c.strokeStyle = o.stroke || Theme.c.rule; c.lineWidth = 1; c.stroke();
    c.fillStyle = o.fg || Theme.c.ink; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(s, X + 7, y + .5);
    return w;
  },
  /** один фосфоліпід: головка + два хвости; dir = +1 вниз від y, −1 вгору */
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
  /** ліпідний бішар по горизонталі: від x0 до x1, середина yMid, товщина gap (між головками) */
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
  /** білок-канал, що пронизує мембрану; open 0..1 */
  channel(c, x, yMid, gap, w, open, col, o = {}) {
    const top = yMid - gap / 2 - 6, bot = yMid + gap / 2 + 6, hw = w / 2, g = hw * .45 * (1 - open) + 1;
    const gr = c.createLinearGradient(x - hw, 0, x + hw, 0); gr.addColorStop(0, shade(col, .35)); gr.addColorStop(.5, col); gr.addColorStop(1, shade(col, -.35));
    c.fillStyle = gr; c.strokeStyle = shade(col, -.45); c.lineWidth = 1;
    for (const sd of [-1, 1]) {
      c.beginPath(); const ox = x + sd * (g + (hw - g) / 2);
      Gfx.rr(c, sd < 0 ? x - hw : x + g, top, hw - g, bot - top, 4); c.fill(); c.stroke();
    }
    if (o.gate && open < .98) { c.fillStyle = shade(o.gateCol || "#C77A12", 0); c.beginPath(); c.arc(x, yMid - (gap * .15), hw * (1 - open) * .55 + .5, 0, 7); c.fill(); }
  },
  /** пробірка/склянка з рідиною (прозоре скло, відблиски) */
  vial(c, x, y, w, hh, fillFrac, col, o = {}) {
    const r = w / 2; c.save();
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + hh - r); c.arc(x + r, y + hh - r, r, Math.PI, 0, true); c.lineTo(x + w, y); c.closePath(); c.clip();
    c.fillStyle = Theme.dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.55)"; c.fillRect(x, y, w, hh);
    const lh = fillFrac * hh, ly = y + hh - lh;
    if (o.layers) { let yy = y + hh; for (const L of o.layers) { const h2 = lh * L.frac; c.fillStyle = L.color; c.fillRect(x, yy - h2, w, h2 + .5); yy -= h2; } }
    else { c.fillStyle = col; c.fillRect(x, ly, w, lh + 1); c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(x, ly, w, 2); }
    if (o.inside) o.inside(c, ly);
    const gr = c.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, "rgba(255,255,255,.4)"); gr.addColorStop(.2, "rgba(255,255,255,.08)"); gr.addColorStop(.6, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.2)");
    c.fillStyle = gr; c.fillRect(x, y, w, hh); c.restore();
    c.lineWidth = 1.4; c.strokeStyle = rgba(Theme.c.ink, .5);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + hh - r); c.arc(x + r, y + hh - r, r, Math.PI, 0, true); c.lineTo(x + w, y); c.stroke();
    c.beginPath(); c.ellipse(x + r, y, r + 1.5, 2.6, 0, 0, 7); c.stroke();
    if (o.label) { c.fillStyle = Theme.c.ink; c.font = `600 11px ${FM()}`; c.textAlign = "center"; c.textBaseline = "top"; c.fillText(o.label, x + r, y + hh + 6); }
  },
  /** спектрофотометр: корпус, дисплей із показом, шлях променя крізь кювету. o: {lam, A, col, text, sub} */
  spectro(c, x, y, w, hh, o) {
    const T = Theme.c;
    Gfx.rr(c, x, y, w, hh, 14); const bg = c.createLinearGradient(0, y, 0, y + hh); bg.addColorStop(0, Theme.dark ? "#2d3d33" : "#EDF1EA"); bg.addColorStop(1, Theme.dark ? "#223028" : "#D3DBD0"); c.fillStyle = bg; c.fill(); c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
    // дисплей
    const dx = x + 14, dy = y + 14, dw = w - 28, dh = Math.max(46, hh * .34);
    Gfx.rr(c, dx, dy, dw, dh, 8); c.fillStyle = "#0E1F14"; c.fill();
    c.font = `600 10.5px ${FM()}`; c.fillStyle = "#7CD67F"; c.textAlign = "left"; c.textBaseline = "top"; c.fillText(`λ = ${NA(o.lam, 0)} нм`, dx + 10, dy + 8);
    const txt = o.text; let fs = Math.min(34, dh * .62); c.font = `700 ${fs}px ${FM()}`; while (c.measureText(txt).width > dw - 24 && fs > 12) { fs -= 1; c.font = `700 ${fs}px ${FM()}`; }
    c.fillStyle = "#9FEFA2"; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText(txt, dx + dw - 12, dy + dh * .6);
    // кюветний відсік
    const cy0 = dy + dh + 16, ch = y + hh - cy0 - 26, mid = cy0 + ch / 2, cw = Math.min(34, w * .14), cx0 = x + w / 2 - cw / 2;
    Gfx.rr(c, x + 14, cy0 - 4, w - 28, ch + 8, 8); c.fillStyle = Theme.dark ? "rgba(0,0,0,.28)" : "rgba(0,0,0,.07)"; c.fill();
    const beam = Spectral.lambdaToRGB(o.lam), T10 = Math.pow(10, -(o.A || 0));
    Gfx.glow(c, x + 30, mid, 22, "#FFE9A8", .55); Gfx.sphere(c, x + 30, mid, 7, "#FFE08A");
    c.lineCap = "butt"; c.strokeStyle = beam; c.lineWidth = 4; c.globalAlpha = .9; c.beginPath(); c.moveTo(x + 40, mid); c.lineTo(cx0, mid); c.stroke();
    c.globalAlpha = clamp(T10, .06, 1); c.beginPath(); c.moveTo(cx0 + cw, mid); c.lineTo(x + w - 40, mid); c.stroke(); c.globalAlpha = 1;
    Gfx.rr(c, x + w - 40, mid - 11, 14, 22, 3); c.fillStyle = "#394148"; c.fill();
    // кювета з розчином
    Gfx.rr(c, cx0, cy0 + 2, cw, ch - 4, 4); c.fillStyle = o.col || "#DDE"; c.fill();
    const gl = c.createLinearGradient(cx0, 0, cx0 + cw, 0); gl.addColorStop(0, "rgba(255,255,255,.45)"); gl.addColorStop(.3, "rgba(255,255,255,.05)"); gl.addColorStop(1, "rgba(0,0,0,.15)"); c.fillStyle = gl; c.fillRect(cx0, cy0 + 2, cw, ch - 4);
    Gfx.rr(c, cx0, cy0 + 2, cw, ch - 4, 4); c.strokeStyle = rgba(T.ink, .45); c.lineWidth = 1.2; c.stroke();
    c.font = `10px ${FB()}`; c.fillStyle = T.muted; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(o.sub || "кювета 10 мм", x + w / 2, y + hh - 9);
  },
  /** шкала-«градієнт» для плашки фону клітинної цитоплазми з зерністістю */
  grain(c, x, y, w, hh, col, seed = 1, n = 120, a = .1) {
    const r = rng(seed); c.fillStyle = col; c.fillRect(x, y, w, hh);
    for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${r() < .5 ? "255,255,255" : "0,0,0"},${a * r()})`; c.beginPath(); c.arc(x + r() * w, y + r() * hh, .6 + r() * 1.8, 0, 7); c.fill(); }
  },
};

/* ---- вкладки (режими) всередині моделі ---- */
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
/* ---- допоміжні віджети ---- */
UI.out = function (parent, html, cls = "") { const d = h("div", { class: "bout " + cls, html }); parent.append(d); return { set(x) { UI.html(d, x); }, el: d }; };
UI.html = function (el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
UI.tip = function (parent, html) { parent.append(h("p", { class: "note", html })); };

/* ---- таблиці: заголовки числових стовпців вирівнюються праворуч, як і самі числа ---- */
function alignTables(root) {
  root.querySelectorAll("table.t").forEach(t => {
    const rows = [...t.tBodies].flatMap(b => [...b.rows]); if (!rows.length) return;
    const hs = t.tHead && t.tHead.rows[0] ? [...t.tHead.rows[0].cells] : [];
    hs.forEach((th, i) => { th.classList.toggle("n", rows.every(r => r.cells[i] && (r.cells[i].classList.contains("n") || r.cells[i].colSpan > 1 || !r.cells[i].textContent.trim()))); });
  });
}
/* формат великих чисел у науковому записі: 3,8·10⁴ */
function sci(x, d = 1) {
  if (!isFinite(x) || x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e), sup = String(e).replace("-", "⁻").replace(/\d/g, ch => "⁰¹²³⁴⁵⁶⁷⁸⁹"[ch]);
  return fmt(m, d) + "·10" + sup;
}

/* ---- Застосунок: список робіт, ліниве завантаження, маршрутизація, цикл анімації ---- */
const App = {
  labs: LABS, active: null,
  def(n, d) { const L = this.labs.find(x => x.n === n); Object.assign(L, d); L.loaded = true; (L.waiters || []).forEach(f => f()); L.waiters = []; },
  load(L) {
    return new Promise((res, rej) => {
      if (L.loaded) return res();
      (L.waiters = L.waiters || []).push(res);
      if (L.loading) return; L.loading = true;
      const s = document.createElement("script"); s.src = BASE + "bio/lab-" + String(L.n).padStart(2, "0") + ".js" + VQ;
      s.onerror = () => { L.loading = false; L.sec.replaceChildren(h("p", { class: "note" }, "Не вдалося завантажити роботу. Оновіть сторінку.")); };
      document.head.append(s);
    });
  },
  dirtyAll() { for (const l of this.labs) if (l.inst) l.inst.stages?.forEach(s => s.dirty = true); },
  boot() {
    const nav = $("#index"), main = $("#labs");
    for (const L of this.labs) {
      L.a = h("a", { href: "#lab" + L.n, "data-n": L.n }, h("span", { class: "no" }, String(L.n).padStart(2, "0")), h("span", { class: "t" }, L.short), h("span", { class: "m" }, L.tag));
      nav.append(L.a);
      L.sec = h("section", { class: "lab", id: "lab" + L.n, "aria-labelledby": "lab" + L.n + "-h" });
      main.append(L.sec);
    }
    nav.prepend(h("a", { href: "#", class: "back" }, "← Усі роботи"));
    const list = $("#pp-list"), ff = $("#ff");
    const route = () => {
      const hs = location.hash.replace("#", "");
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
    addEventListener("hashchange", route);
    route();
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const L = this.active;
      if (L && L.inst && !document.hidden) {
        let run = L.running, d = dt;
        if (!run && L.stepReq) { run = true; d = 1 / 30; L.stepReq = false; }   // «Крок» на паузі
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
    document.title = `ПЗ ${L.n}. ${L.short} — Біоенергетичні основи біотехнологічних процесів`;
    if (!L.sec.firstChild) L.sec.append(h("p", { class: "note loading" }, "Завантаження роботи…"));
    this.load(L).then(() => {
      if (!L.inst && !L.built) this.build(L);
      L.inst?.stages?.forEach(s => s.resize());
    });
  },
  build(L) {
    L.built = true;
    const sec = L.sec; sec.replaceChildren();
    L.running = true; L.simT = 0;
    sec.append(h("div", { class: "lab-head" },
      h("div", null, h("div", { class: "eyebrow" }, `Практичне заняття № ${L.n}`), h("h2", { id: "lab" + L.n + "-h" }, L.title)),
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
    // підсвічування поточного підрозділу (останній заголовок над верхнім краєм вікна)
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
    sec.append(h("section", { class: "ff-sec" }, secHead("01", "Теоретичні відомості"), th));
    // 02 модель
    const status = h("span", { class: "runbar__st" });
    const setRun = (on) => { L.running = on; pauseB.textContent = on ? "⏸ Пауза" : "▶ Продовжити"; status.textContent = on ? "Модель працює" : "Пауза: параметри можна змінювати, картинка не рухається"; status.classList.toggle("on", on); stepB.disabled = on; };
    const pauseB = h("button", { class: "btn pri", type: "button", onclick: () => setRun(!L.running) }, "⏸ Пауза");
    const stepB = h("button", { class: "btn", type: "button", title: "Зробити один крок (≈ 0,03 с) на паузі", onclick: () => { L.stepReq = true; } }, "⏭ Крок");
    const resetB = h("button", { class: "btn", type: "button", onclick: () => this.reset(L) }, "↺ Скинути");
    const sim = h("div", { class: "panel sim" });
    sec.append(h("section", { class: "ff-sec" }, secHead("02", "Інтерактивна модель"), h("div", { class: "runbar" }, pauseB, stepB, resetB, status), sim));
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
    sec.append(h("section", { class: "ff-sec" }, secHead("03", "Контрольні питання"), h("div", { class: "qa-bar" }, h("span", { class: "note" }, `Питань: ${L.qa.length}. Спершу спробуйте відповісти самостійно, потім перевірте себе.`), allB), qs));
    // навігація між роботами
    const pv = this.labs.find(x => x.n === L.n - 1), nx = this.labs.find(x => x.n === L.n + 1);
    sec.append(h("nav", { class: "lab-pn" },
      pv ? h("a", { href: "#lab" + pv.n }, h("small", null, "← Попереднє заняття"), `ПЗ ${pv.n}. ${pv.short}`) : h("span"),
      nx ? h("a", { href: "#lab" + nx.n, class: "nx" }, h("small", null, "Наступне заняття →"), `ПЗ ${nx.n}. ${nx.short}`) : h("span")));
    sec.append(h("p", { class: "lab-src" }, h("b", null, "Джерело: "), `Ткаченко Т. А., Прилуцька С. В. Біоенергетичні основи біотехнологічних процесів. К.: НУБіП України, 2025 — практичне заняття № ${L.n}, с. ${L.pages}. Розширені пояснення, математичні моделі й візуалізації додано до матеріалу методички.`));
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
