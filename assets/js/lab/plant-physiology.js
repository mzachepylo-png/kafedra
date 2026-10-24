// Фізіологія рослин в моделях: 12 лабораторних робіт (код застосунку без змін).
"use strict";
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
    const show = () => out.textContent = (f ? f(+inp.value) : inp.value) + (unit ? " " + unit : "");
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
    return { set(k, val, unit) { m[k].innerHTML = val + (unit ? `<small>${unit}</small>` : ""); } };
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
const App = {
  labs: [], active: null,
  add(def) { this.labs.push(def); },
  dirtyAll() { for (const l of this.labs) if (l.inst) l.inst.stages?.forEach(s => s.dirty = true); },
  boot() {
    const nav = $("#index"), main = $("#labs");
    for (const L of this.labs) {
      L.a = h("a", { href: "#lab" + L.n, "data-n": L.n }, h("span", { class: "no" }, String(L.n).padStart(2, "0")), h("span", { class: "t" }, L.short), h("span", { class: "m" }, L.tag));
      nav.append(L.a);
      L.sec = h("section", { class: "lab", id: "lab" + L.n, "aria-labelledby": "lab" + L.n + "-h" });
      main.append(L.sec);
    }
    const route = () => {
      let hs = location.hash.replace("#", "");
      let embed = false;
      if (hs.startsWith("embed-")) { embed = true; hs = hs.slice(6); }
      document.body.classList.toggle("embed", embed);
      const n = parseInt(hs.replace("lab", ""), 10);
      this.show(this.labs.find(l => l.n === n) || this.labs[0]);
    };
    addEventListener("hashchange", route);
    route();
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const L = this.active;
      if (L && L.inst && !document.hidden) {
        // модель рухається лише після «Старт»; на паузі кадр малюється з dt = 0 (повзунки й підписи оновлюються)
        const run = !!L.running; if (run) L.simT += dt;
        try { L.inst.frame(run ? dt : 0, L.simT); } catch (e) { console.error(e); }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
  show(L) {
    for (const x of this.labs) { x.sec.classList.toggle("on", x === L); x.a.setAttribute("aria-current", String(x === L)); }
    this.active = L;
    if (!L.inst) this.build(L);
    L.inst.stages?.forEach(s => s.resize());
  },
  build(L) {
    const sec = L.sec;
    L.running = false; L.simT = 0; L.started = false;
    sec.append(h("div", { class: "lab-head" },
      h("div", null, h("div", { class: "eyebrow" }, `Лабораторна робота № ${L.n}`), h("h2", { id: "lab" + L.n + "-h" }, L.title)),
      h("div", { class: "model" }, L.model)));
    // теорія зверху, контрольні питання — окремим блоком у кінці
    const th = h("div", { class: "panel theory" });
    th.insertAdjacentHTML("beforeend", L.cheat);
    const qas = [...th.querySelectorAll("details.qa")];
    qas.forEach(q => q.remove());
    th.querySelectorAll("h3").forEach(x => { if (/контрольн/i.test(x.textContent)) x.remove(); });
    const secHead = (n, t) => h("h3", { class: "ff-sec__h" }, h("span", { class: "n" }, n), t);
    sec.append(h("section", { class: "ff-sec" }, secHead("01", "Теоретичні відомості"), th));
    // керування моделлю
    const status = h("span", { class: "runbar__st" });
    const setRun = (on) => {
      L.running = on;
      startB.disabled = on; stopB.disabled = !on;
      status.textContent = on ? "Модель працює" : (L.simT > 0 ? "Пауза" : "Модель зупинена — натисніть «Старт»");
      status.classList.toggle("on", on);
    };
    // перший «Старт» після відкриття/скидання запускає і власний дослід роботи (кнопку дії моделі)
    const START_ACTION = { 2: "Старт 20 хв", 3: "Фарбувати з нуля", 6: "Запустити", 7: "Увімкнути лампу", 9: "Нове скло", 10: "Нанести дифеніламін", 11: "Виростити пагін", 12: "Залити HCl" };
    const start = () => {
      setRun(true);
      if (L.started) return;
      L.started = true;
      const label = START_ACTION[L.n];
      const act = label && [...sim.querySelectorAll(".btn")].find(b => b.textContent.trim() === label);
      if (act) act.click();
    };
    const startB = h("button", { class: "btn pri", type: "button", onclick: start }, "▶ Старт");
    const stopB = h("button", { class: "btn", type: "button", onclick: () => setRun(false) }, "⏸ Стоп");
    const resetB = h("button", { class: "btn", type: "button", onclick: () => this.reset(L) }, "↺ Скинути");
    const runbar = h("div", { class: "runbar" }, startB, stopB, resetB, status);
    const sim = h("div", { class: "panel sim" });
    sec.append(h("section", { class: "ff-sec" }, secHead("02", "Інтерактивна модель"), runbar, sim));
    if (qas.length) sec.append(h("section", { class: "ff-sec" }, secHead("03", "Контрольні питання"), h("div", { class: "panel qa-list" }, ...qas)));
    const top = h("div", { class: "sim-top" }); const stageBox = h("div", { style: "min-width:0;display:flex;flex-direction:column;gap:10px" }); const ctrls = h("div", { class: "ctrls" });
    top.append(stageBox, ctrls); sim.append(top);
    const below = h("div", { style: "display:flex;flex-direction:column;gap:14px;min-width:0" }); sim.append(below);
    // дія користувача в самій моделі (кнопка досліду) запускає її, якщо вона на паузі
    sim.addEventListener("click", (e) => { const b = e.target.closest(".btn"); if (b && !L.running && !/скин/i.test(b.textContent)) { L.started = true; setRun(true); } });
    L.inst = L.build({ stageBox, ctrls, below, sim });
    if (!L.inst.stages) L.inst.stages = [];
    setRun(false);
  },
  reset(L) {
    L.inst?.stages?.forEach(st => st.ro?.disconnect());
    L.sec.replaceChildren(); L.inst = null;
    this.build(L);
    L.inst.stages?.forEach(st => st.resize());
  },
};
/* ============ ЛР 1. Плазмоліз, деплазмоліз, осмотичний тиск ============ */
App.add({
  n: 1, short: "Плазмоліз і осмотичний тиск", tag: "Вант-Гофф · осмос",
  title: "Плазмоліз, деплазмоліз і потенційний осмотичний тиск клітин цибулі",
  model: "dV/dt = Lp·(π_in(V) − σ·π_ext − P(V)) · формула Вант-Гоффа P = R·T·c·i",
  build({ stageBox, ctrls, below }) {
    const ALPHA = [[0.1, .83], [0.2, .79], [0.3, .76], [0.4, .74], [0.5, .71], [0.6, .65]];
    const alphaNaCl = (c) => { if (c <= .1) return .83; if (c >= .6) return clamp(.65 - (c - .6) * .3, .5, .65); for (let i = 0; i < 5; i++) { const [a, x] = ALPHA[i], [b, y] = ALPHA[i + 1]; if (c <= b) return lerp(x, y, (c - a) / (b - a)); } return .65; };
    const SOL = {
      nacl: { name: "NaCl", i: c => 1 + alphaNaCl(c), Ps: 0, sig: 1 },
      kno3: { name: "KNO₃", i: c => 1 + alphaNaCl(c) * .97, Ps: 0, sig: 1 },
      sucr: { name: "сахароза", i: () => 1, Ps: 0, sig: 1 },
      glyc: { name: "гліцерин", i: () => 1, Ps: 0.0009, sig: .85 },
      urea: { name: "сечовина", i: () => 1, Ps: 0.0018, sig: .7 },
    };
    const S = { sol: "nacl", c: 1.0, tC: 20, pic: 900, speed: 30, v: 1, ns: 0, inSol: true, t: 0, hist: [[0, 1]], phaseT: 0 };
    const b = 0.2, vip = 0.96, Lp = 2.2e-6;
    const TK = () => 273.15 + S.tC;
    const piExt = (c, sol = S.sol) => RG * TK() * c * SOL[sol].i(c); // kPa (c in mol/L)
    const piIn = (v, ns) => S.pic * (1 - b) / (v - b) + RG * TK() * ns * (1 - b) / (v - b);
    const turg = (v) => v > vip ? S.pic * (v - vip) / (1 - vip) : 0;
    function step(st, cExt, sol, dt) {
      const so = SOL[sol];
      const pe = cExt > 0 ? piExt(cExt, sol) : 0;
      const pin = piIn(st.v, st.ns);
      const dv = Lp * (pin - so.sig * pe - turg(st.v) - (cExt > 0 ? 0 : 0));
      st.v = clamp(st.v + dv * dt, b + 0.02, 1.06);
      if (so.Ps) { const cin = st.ns * (1 - b) / (st.v - b); st.ns = Math.max(0, st.ns + so.Ps * (cExt - cin) * dt); }
      else if (cExt === 0 && st.ns > 0) { const cin = st.ns * (1 - b) / (st.v - b); st.ns = Math.max(0, st.ns - 0.0012 * cin * dt); }
    }
    const stage = (v) => v >= vip - .005 ? ["немає (тургор)", 0] : v > .9 ? ["кутовий", 1] : v > .78 ? ["увігнутий", 2] : ["опуклий", 3];
    function equil(c, sol, minutes = 25) { const st = { v: 1, ns: 0 }; const n = minutes * 60 / 0.5; for (let i = 0; i < n; i++) step(st, c, sol, 0.5); return st.v; }

    // ---- stage
    const st = new Stage(stageBox, { aspect: 1.75, minH: 240, maxH: 430, tag: "Епідерміс луски синьої цибулі · ×400" });
    const rd = UI.reads(stageBox, [["t", "Час, хв"], ["v", "V протопласта / V₀"], ["pe", "π розчину"], ["pin", "π клітинного соку"], ["stg", "Стадія плазмолізу"], ["i", "Коефіцієнт i"]]);
    // ---- controls
    UI.select(ctrls, { id: "l1-sol", label: "Плазмолітик", value: S.sol, options: Object.entries(SOL).map(([k, o]) => [k, o.name]), on: v => { S.sol = v; series(); } });
    UI.slider(ctrls, { id: "l1-c", label: "Концентрація", min: 0.05, max: 1, step: 0.05, value: S.c, unit: "М", fmt: v => fmt(v, 2), on: v => S.c = v });
    UI.slider(ctrls, { id: "l1-pic", label: "π соку при повному тургорі", min: 300, max: 1300, step: 10, value: S.pic, unit: "кПа", on: v => { S.pic = v; series(); } });
    UI.slider(ctrls, { id: "l1-t", label: "Температура", min: 10, max: 35, step: 1, value: S.tC, unit: "°C", on: v => { S.tC = v; series(); } });
    UI.slider(ctrls, { id: "l1-sp", label: "Прискорення часу", min: 5, max: 120, step: 5, value: S.speed, unit: "×", on: v => S.speed = v });
    UI.buttons(ctrls, [
      { label: "Розчин під скло", pri: true, on: () => { S.inSol = true; S.phaseT = S.t; } },
      { label: "Промити водою", on: () => { S.inSol = false; S.phaseT = S.t; } },
      { label: "Скинути", on: () => { Object.assign(S, { v: 1, ns: 0, inSol: false, t: 0, hist: [[0, 1]] }); } },
    ]);
    ctrls.append(h("p", { class: "note" }, "Крок 2 методики: відтягніть воду фільтрувальним папером і внесіть плазмолітик, потім промийте водою. Для гліцерину й сечовини дочекайтеся самовільного деплазмолізу."));

    const ch1 = UI.chart(below, "Об'єм протопласта в часі", { aspect: 2.2 });
    const serWrap = h("div", { class: "charts" }); below.append(serWrap);
    const ch2 = UI.chart(serWrap, "Плазмолітичний ряд: рівновага через 25 хв");
    const tbox = h("div", { class: "chart" }, h("h4", null, "Таблиця 1.3 · розрахунок осмотичного тиску")); serWrap.append(tbox);
    const tbl = h("div", { class: "tblwrap" }); const calc = h("div", { class: "note", style: "margin-top:8px" }); tbox.append(tbl, calc);

    let ser = [];
    function series() {
      ser = [0.6, 0.5, 0.4, 0.3, 0.2, 0.1].map(c => { const v = equil(c, S.sol); return { c, v, s: stage(v) }; });
      const noPl = ser.filter(r => r.s[1] === 0).map(r => r.c), pl = ser.filter(r => r.s[1] > 0).map(r => r.c);
      let ciso = null;
      if (noPl.length && pl.length) ciso = (Math.max(...noPl) + Math.min(...pl)) / 2;
      // exact incipient-plasmolysis concentration (bisection)
      const target = S.pic * (1 - b) / (vip - b);
      let lo = 0.001, hi = 3; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; (SOL[S.sol].sig * piExt(m) < target ? lo = m : hi = m); }
      const cex = (lo + hi) / 2;
      tbl.innerHTML = `<table class="t"><thead><tr><th>c, моль/л</th><th>V/V₀</th><th>Ступінь плазмолізу</th><th>Тип розчину</th></tr></thead><tbody>${ser.map(r => `<tr><td class="n">${fmt(r.c, 1)}</td><td class="n">${fmt(r.v, 2)}</td><td>${r.s[0]}</td><td>${r.s[1] === 0 ? "гіпотонічний" : r.s[1] === 1 ? "≈ ізотонічний" : "гіпертонічний"}</td></tr>`).join("")}</tbody></table>`;
      const so = SOL[S.sol];
      if (ciso != null) {
        const i = so.i(ciso), P = RG * TK() * ciso * i;
        calc.innerHTML = `Ізотонічна концентрація (середнє між ${fmt(Math.max(...noPl), 1)} і ${fmt(Math.min(...pl), 1)} М): <b class="mono">c = ${fmt(ciso, 2)} М</b>, i = ${fmt(i, 2)}.<br>P = 8,314 × ${fmt(TK(), 1)} × ${fmt(ciso, 2)} × ${fmt(i, 2)} = <b class="mono">${fmt(P, 0)} кПа</b> (${fmt(P / 101.325, 1)} атм). Точна межа моделі: c = ${fmt(cex, 3)} М → ${fmt(target / so.sig, 0)} кПа.`;
        S.ciso = ciso;
      } else { calc.innerHTML = `У діапазоні 0,1–0,6 М межу не знайдено (точна межа моделі c = ${fmt(cex, 3)} М). Змініть π соку або плазмолітик.`; S.ciso = null; }
      if (SOL[S.sol].Ps) calc.innerHTML += `<br><span style="color:var(--warn)">${so.name} проникає крізь мембрани: за 25 хв частина плазмолізу вже зникає (самовільний деплазмоліз), тому для визначення тиску він непридатний.</span>`;
      S.cex = cex;
      S.curve = []; for (let cc = 0.02; cc <= 0.7; cc += 0.02) S.curve.push([cc, equil(cc, S.sol, 25)]);
      ch2.dirty = true;
    }
    series();

    // cell geometry
    function protoPath(c, cx, cy, a, bb, v) {
      const q = clamp((vip - v) / (vip - 0.42), 0, 1);
      const n = v >= vip ? 14 : lerp(9, 2, smooth(0, .75, q));
      const bow = 0.34 * smooth(.08, .38, q) * (1 - smooth(.5, .85, q));
      const pts = []; const N = 120;
      for (let k = 0; k < N; k++) {
        const th = k / N * Math.PI * 2, co = Math.cos(th), si = Math.sin(th);
        const f = 1 - bow * (Math.pow(Math.abs(si), 4) + 0.45 * Math.pow(Math.abs(co), 6));
        pts.push([Math.sign(co) * Math.pow(Math.abs(co), 2 / n) * f, Math.sign(si) * Math.pow(Math.abs(si), 2 / n) * f]);
      }
      let A = 0; for (let k = 0; k < N; k++) { const p = pts[k], r = pts[(k + 1) % N]; A += p[0] * r[1] - r[0] * p[1]; } A = Math.abs(A) / 2; // unit area (max 4)
      const sc = Math.min(1, Math.sqrt(clamp(v, 0, 1.0) * 4 * 0.985 / A));
      c.beginPath(); pts.forEach(([x, y], k) => { const X = cx + x * a * sc, Y = cy + y * bb * sc; k ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath();
      return { sc, bow, q };
    }
    const cells = []; { const r = rng(7); for (let row = 0; row < 3; row++) for (let col = -1; col < 4; col++) cells.push({ row, col, j: r(), nuc: r() }); }
    function draw() {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c;
      // bright-field background with vignette
      st.clear(Theme.dark ? "#121814" : "#EEF0E6");
      const rowH = H / 3, cw = W / 3.1;
      const tint = S.inSol ? (Theme.dark ? "#1b2a2f" : "#E6EEF0") : (Theme.dark ? "#16201b" : "#F2F3EA");
      for (const cl of cells) {
        const off = (cl.row % 2) * cw * 0.5;
        const x = cl.col * cw + off, y = cl.row * rowH;
        const a = cw / 2 - 4, bb = rowH / 2 - 4, cx = x + cw / 2, cy = y + rowH / 2;
        // wall
        c.fillStyle = tint; c.fillRect(x + 2, y + 2, cw - 4, rowH - 4);
        c.lineWidth = 3.5; c.strokeStyle = Theme.dark ? "#3E5246" : "#B8C3AE"; c.strokeRect(x + 2, y + 2, cw - 4, rowH - 4);
        c.lineWidth = 1; c.strokeStyle = Theme.dark ? "#56705F" : "#93A28A"; c.strokeRect(x + 3.5, y + 3.5, cw - 7, rowH - 7);
        const v = clamp(S.v + (cl.j - .5) * 0.03 * (1 - S.v), b + .02, 1.05);
        // Hechtian strands in concave stage
        const q = clamp((vip - v) / (vip - 0.42), 0, 1);
        if (q > 0.05 && q < 0.75) { c.strokeStyle = rgba(T.antho, .35); c.lineWidth = .8; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.moveTo(cx + sx * a * .55, cy + sy * bb * .4); c.lineTo(cx + sx * (a - 2), cy + sy * (bb - 2)); c.stroke(); } }
        // protoplast: cytoplasm rim then vacuole
        const conc = clamp(1 / (v + .05), 1, 3.5);
        protoPath(c, cx, cy, a - 1, bb - 1, v);
        c.fillStyle = Theme.dark ? "rgba(220,230,220,.18)" : "rgba(255,255,255,.75)"; c.fill();
        const pp = protoPath(c, cx, cy, a - 4, bb - 4, v);
        const g = c.createRadialGradient(cx - a * .2, cy - bb * .3, 2, cx, cy, Math.max(a, bb));
        const al = clamp(0.32 * conc, .3, .95);
        g.addColorStop(0, rgba(T.antho, al * .75)); g.addColorStop(1, rgba(T.antho, al));
        c.fillStyle = g; c.fill();
        c.lineWidth = 1; c.strokeStyle = rgba(T.antho, .9); c.stroke();
        // nucleus
        const nx = cx + (cl.nuc - .5) * a * pp.sc * .9, ny = cy + bb * pp.sc * .55;
        c.beginPath(); c.ellipse(nx, ny, 5.5, 4, 0, 0, 7); c.fillStyle = Theme.dark ? "rgba(210,215,200,.55)" : "rgba(120,110,120,.45)"; c.fill();
      }
      // vignette
      const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, Theme.dark ? "rgba(0,0,0,.55)" : "rgba(40,50,30,.25)");
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
      Draw.text(c, S.inSol ? `у розчині: ${SOL[S.sol].name} ${fmt(S.c, 2)} М` : "у воді", W - 10, H - 10, { align: "right", color: Theme.dark ? "#cfe" : "#334", size: 12 });
    }
    function charts() {
      const tm = Math.max(10, S.t / 60);
      drawChart(ch1, { x: [0, tm], y: [0, 1.1], xl: "час, хв", yl: "V/V₀", series: [{ pts: S.hist, color: Theme.c.antho, w: 2.2, fill: rgba(Theme.c.antho, .1) }], hl: [{ y: vip, color: Theme.c.muted, label: "межа початкового плазмолізу" }] });
      drawChart(ch2, { x: [0, 0.7], y: [0.2, 1.05], xl: "c, моль/л", yl: "V/V₀", series: [{ pts: S.curve, color: Theme.c.data, w: 2 }],
        marks: ser.map(r => ({ x: r.c, y: r.v, color: r.s[1] ? Theme.c.antho : Theme.c.chl })),
        vl: S.ciso ? [{ x: S.ciso, color: Theme.c.chl, label: "c ізот." }] : [], hl: [{ y: vip, color: Theme.c.muted }] });
    }
    let lastV = 0;
    return {
      stages: [st, ch1, ch2],
      frame(dt) {
        const simDt = dt * S.speed; const n = Math.ceil(simDt / 0.5);
        for (let k = 0; k < n; k++) step(S, S.inSol ? S.c : 0, S.sol, simDt / n);
        S.t += simDt;
        const last = S.hist[S.hist.length - 1];
        if (S.t / 60 - last[0] > 0.05) { S.hist.push([S.t / 60, S.v]); if (S.hist.length > 1500) S.hist.splice(1, 1); }
        draw();
        const pe = S.inSol ? piExt(S.c) : 0;
        rd.set("t", fmt(S.t / 60, 1)); rd.set("v", fmt(S.v, 3)); rd.set("pe", fmt(pe, 0), "кПа"); rd.set("pin", fmt(piIn(S.v, S.ns), 0), "кПа");
        rd.set("stg", stage(S.v)[0]); rd.set("i", S.inSol ? fmt(SOL[S.sol].i(S.c), 2) : "—");
        if (Math.abs(S.v - lastV) > 1e-4 || ch1.dirty || ch2.dirty) { charts(); ch1.dirty = ch2.dirty = false; lastV = S.v; }
      },
    };
  },
  cheat: `
<h3>Що відбувається</h3>
<p>Вода рухається крізь напівпроникні плазмалему й тонопласт туди, де осмотичний тиск вищий. У гіпертонічному розчині протопласт втрачає воду і відстає від стінки: кутовий → увігнутий → опуклий плазмоліз. У воді процес обертається (деплазмоліз).</p>
<h3>Формула Вант-Гоффа</h3>
<div class="eq"><var>P</var> = <var>R</var>·<var>T</var>·<var>c</var>·<var>i</var>,&nbsp;&nbsp; <var>i</var> = 1 + <var>α</var>(<var>n</var> − 1)</div>
<dl class="vars"><dt>R</dt><dd>8,314 Дж/(моль·К)</dd><dt>T</dt><dd>273 + t °C, К</dd><dt>c</dt><dd>ізотонічна концентрація, моль/л (тоді P виходить у кПа)</dd><dt>i</dt><dd>ізотонічний коефіцієнт; для сахарози 1, для NaCl (n = 2) 1,65–1,83</dd></dl>
<p>Приклад: c = 0,25 М NaCl, 20 °C, α ≈ 0,775 → P = 8,314 × 293 × 0,25 × 1,775 ≈ 1081 кПа.</p>
<h3>Модель у симуляторі</h3>
<div class="eq">d<var>V</var>/d<var>t</var> = <var>L</var><sub>p</sub>·(π<sub>in</sub>(<var>V</var>) − σ·π<sub>ext</sub> − <var>P</var><sub>тург</sub>(<var>V</var>))</div>
<p>π<sub>in</sub> зростає при стисканні за законом Бойля–Вант-Гоффа: π<sub>in</sub> = π<sub>0</sub>(1 − b)/(V − b), де b ≈ 0,2 — неосмотичний об'єм. Тургорний тиск стінки зникає при V &lt; 0,96 V₀: саме там починається кутовий плазмоліз. σ — коефіцієнт відбиття: для NaCl і сахарози ≈ 1, для гліцерину й сечовини менше, тому вони поступово проникають у вакуоль і викликають самовільний деплазмоліз.</p>
<h3>Як знайти ізотонічну концентрацію</h3>
<p>Беремо середнє між найбільшою концентрацією без плазмолізу і найменшою, що дає початковий (кутовий) плазмоліз. Точність методу обмежена кроком ряду, 0,1 М: модель показує і цю оцінку, і точну межу.</p>
<div class="fix"><b>Уточнення до посібника.</b> У таблиці перед роботою рядок підписано «коефіцієнт Вант-Гоффа», але значення 0,65–0,83 — це ступінь дисоціації α. Коефіцієнт i = 1 + α. Модель використовує саме так. Значення для KNO₃ взято близькими до NaCl (наближення).</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому плазмоліз буває лише в живих клітинах?</summary><p>Потрібна напівпроникна мембрана. У мертвій клітині мембрани проникні, осмотичного градієнта немає. У тваринних клітинах немає стінки, тому замість плазмолізу клітина зморщується (плазморексис).</p></details>
<details class="qa"><summary>Чому в посухостійких рослин в'язкість цитоплазми вища?</summary><p>В'язка цитоплазма повільніше втрачає й віддає воду, менше ушкоджується при зневодненні; у моделі це відповідає меншому L<sub>p</sub> і довшому часу плазмолізу.</p></details>
<details class="qa"><summary>Чому плоди вишні тріскаються під час дощів?</summary><p>Висока концентрація цукрів дає великий π соку; вода надходить через шкірку, тургор росте швидше, ніж розтягується шкірка.</p></details>`,
});
/* ============ ЛР 2. Проникність живого і мертвого протопласту ============ */
App.add({
  n: 2, short: "Проникність мембран буряка", tag: "кінетика виходу пігменту",
  title: "Проникність живого і мертвого протопласту для клітинного соку",
  model: "dC/dt = k·(1 − C) − k_d·C ;  A₅₃₈ = A_max·C (закон Бера) · колір розчину рахується зі спектра",
  build({ stageBox, ctrls, below }) {
    const custom = { T: 60 };
    const kHeat = (T) => 0.6 / (1 + Math.exp(-(T - 55) / 3)) + 0.002;
    const V = [
      { s: "1", name: "Контроль (вода)", k: 0.002, kd: 0, sol: 1 },
      { s: "2", name: "Вода + ↓ температура (заморожений)", k: 0.22, kd: 0, sol: 1 },
      { s: "3", name: "Вода + ↑ температура", k: null, kd: 0.002, sol: 1, heat: true },
      { s: "4", name: "30 % оцтова кислота", k: 0.12, kd: 0, sol: 1, acid: true },
      { s: "5", name: "50 % етиловий спирт", k: 0.07, kd: 0.003, sol: .85 },
      { s: "6", name: "50 % гліцерин", k: 0.004, kd: 0, sol: 1, shrink: true },
      { s: "7", name: "Ацетон", k: 0.16, kd: 0.01, sol: .35 },
      { s: "8", name: "75 % перекис водню", k: 0.3, kd: 0.22, sol: 1 },
      { s: "9", name: "50 % ТХО", k: 0.2, kd: 0.01, sol: 1, acid: true },
      { s: "10", name: "HCl (конц.)", k: 0.5, kd: 0.04, sol: 1, acid: true, violet: true },
    ];
    const S = { t: 20, play: false, speed: 1, sel: 2 };
    const Amax = 1.6, path = 1.2;
    const kOf = (v) => v.heat ? kHeat(custom.T) : v.k;
    // analytic solution of dC/dt = k(1-C) - kd C - with leak C_out limited by solubility; tissue keeps 1 - C - degraded
    function state(v, t) {
      const k = kOf(v), kd = v.kd, K = k + kd;
      const C = K > 0 ? (k / K) * (1 - Math.exp(-K * t)) : 0; // in solution (relative)
      const tissue = Math.exp(-k * t); // still inside
      return { C: C * v.sol, tissue };
    }
    const score = (A) => A < 0.06 ? "−" : A < 0.3 ? "+" : A < 0.8 ? "++" : "+++";
    const colorFor = (v, C) => Spectral.colorOf(v.violet ? { betaninAcid: C * Amax } : { betanin: C * Amax }, path);

    const st = new Stage(stageBox, { aspect: 2.1, minH: 250, maxH: 420, tag: "Штатив · 10 пробірок" });
    const rd = UI.reads(stageBox, [["t", "Час, хв"], ["sel", "Вибраний варіант"], ["k", "Константа виходу k"], ["A", "A₅₃₈ розчину"], ["sc", "Оцінка"]]);
    const playB = UI.buttons(ctrls, [{ label: "Старт 20 хв", pri: true, on: () => { if (S.t >= 20) S.t = 0; S.play = !S.play; playB[0].textContent = S.play ? "Пауза" : "Старт 20 хв"; } }, { label: "На початок", on: () => { S.t = 0; S.play = false; playB[0].textContent = "Старт 20 хв"; } }]);
    const tS = UI.slider(ctrls, { id: "l2-t", label: "Час експозиції", min: 0, max: 20, step: 0.1, value: 20, unit: "хв", fmt: v => fmt(v, 1), on: v => { S.t = v; S.play = false; playB[0].textContent = "Старт 20 хв"; } });
    UI.slider(ctrls, { id: "l2-T", label: "Температура для пробірки 3", min: 20, max: 95, step: 1, value: custom.T, unit: "°C", on: v => { custom.T = v; ch.dirty = ch2.dirty = true; } });
    UI.slider(ctrls, { id: "l2-sp", label: "Швидкість", min: 0.5, max: 6, step: 0.5, value: 1, unit: "хв/с", fmt: v => fmt(v, 1), on: v => S.speed = v });
    ctrls.append(h("p", { class: "note" }, "Натисніть на пробірку, щоб виділити її криву. Пробірка 3 нагрівається до вибраної температури: подивіться, де мембрани «плавляться»."));
    st.cv.addEventListener("click", (e) => { const r = st.cv.getBoundingClientRect(); const i = Math.floor((e.clientX - r.left) / (st.W / 10)); if (i >= 0 && i < 10) { S.sel = i; ch.dirty = true; } });

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Концентрація пігменту в розчині C(t)");
    const ch2 = UI.chart(row, "Пробірка 3: вихід за 20 хв залежно від температури");
    const tb = h("div", { class: "tblwrap" }); below.append(h("div", { class: "chart" }, h("h4", null, "Таблиця 2.1 · інтенсивність забарвлення"), tb));
    let lastTb = -1;
    function table() {
      const tt = Math.round(S.t * 2) / 2; if (tt === lastTb) return; lastTb = tt;
      tb.innerHTML = `<table class="t"><thead><tr><th>№</th><th>Варіант</th><th>Початкова</th><th>Через ${fmt(S.t, 1)} хв</th><th>A₅₃₈</th></tr></thead><tbody>${V.map((v, i) => { const A = state(v, S.t).C * Amax; const A0 = state(v, 0.5).C * Amax; return `<tr><td class="n">${i + 1}</td><td>${v.name}${v.heat ? ` (${custom.T} °C)` : ""}</td><td>${score(A0)}</td><td><b>${score(A)}</b></td><td class="n">${fmt(A, 2)}</td></tr>`; }).join("")}</tbody></table>`;
    }
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c;
      st.clear();
      // rack
      const slot = W / 10, tw = Math.min(34, slot * 0.55), th = H * 0.62, top = H * 0.17;
      c.fillStyle = Theme.dark ? "#2a2219" : "#C9B597"; c.fillRect(6, top + th * 0.42, W - 12, 10);
      c.fillStyle = Theme.dark ? "#3a2f22" : "#B39C79"; c.fillRect(6, top + th + 4, W - 12, 8);
      V.forEach((v, i) => {
        const x = i * slot + (slot - tw) / 2;
        const s = state(v, S.t);
        const col = colorFor(v, s.C);
        const tissueCol = Spectral.colorOf({ betanin: 3.5 * s.tissue + 0.15 }, 1);
        Draw.tube(c, x, top, tw, th, [{ frac: 1, color: col }], {
          label: v.s, labelColor: i === S.sel ? T.chl : T.muted, stroke: i === S.sel ? T.chl : null,
          after: (cc, surf) => { // beet cube near bottom
            const cs = tw * (v.shrink ? 0.5 - 0.06 * Math.min(1, S.t / 10) : 0.5), cx = x + tw / 2, cy = top + th - tw * 0.55 - cs / 2 - Math.sin(time + i) * 0.6;
            cc.fillStyle = tissueCol; cc.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);
            cc.strokeStyle = "rgba(0,0,0,.25)"; cc.strokeRect(cx - cs / 2 + .5, cy - cs / 2 + .5, cs - 1, cs - 1);
            // diffusing plume
            if (s.C > 0.02 && kOf(v) > 0.01) { const g = cc.createRadialGradient(cx, cy, cs * .3, cx, cy, cs * 2.4); g.addColorStop(0, rgba("#7a0f45", clamp(0.35 * Math.exp(-kOf(v) * S.t * 0.6), 0, .35))); g.addColorStop(1, "rgba(0,0,0,0)"); cc.fillStyle = g; cc.fillRect(cx - cs * 3, cy - cs * 3, cs * 6, cs * 6); }
          },
        });
        if (i === S.sel) { c.strokeStyle = T.chl; c.lineWidth = 2; c.strokeRect(i * slot + 3, top - 8, slot - 6, th + 30); c.lineWidth = 1; }
        Draw.text(c, score(s.C * Amax), x + tw / 2, top - 12, { align: "center", color: T.ink, size: 12, weight: 600 });
      });
    }
    function charts() {
      const ts = []; for (let t = 0; t <= 20; t += 0.25) ts.push(t);
      drawChart(ch, { x: [0, 20], y: [0, 1], xl: "час, хв", yl: "C / C_max",
        series: V.map((v, i) => ({ pts: ts.map(t => [t, state(v, t).C]), color: i === S.sel ? Theme.c.antho : rgba(Theme.c.muted, .35), w: i === S.sel ? 2.6 : 1.2 })),
        vl: [{ x: S.t, color: Theme.c.chl }], hl: [{ y: 0.06 / Amax, label: "межа «−/+»" }] });
      const pts = []; for (let T = 20; T <= 95; T++) { const k = kHeat(T), K = k + 0.002; pts.push([T, (k / K) * (1 - Math.exp(-K * 20))]); }
      drawChart(ch2, { x: [20, 95], y: [0, 1], xl: "температура, °C", yl: "C₂₀ / C_max", series: [{ pts, color: Theme.c.antho, w: 2.2, fill: rgba(Theme.c.antho, .1) }], vl: [{ x: 55, label: "T₅₀ ≈ 55 °C" }], marks: [{ x: custom.T, y: pts[custom.T - 20][1], color: Theme.c.chl }] });
    }
    return {
      stages: [st, ch, ch2],
      frame(dt, time) {
        if (S.play) { S.t = Math.min(20, S.t + dt * S.speed); tS.set(S.t); if (S.t >= 20) { S.play = false; playB[0].textContent = "Старт 20 хв"; } ch.dirty = true; }
        draw(time);
        const v = V[S.sel], s = state(v, S.t);
        rd.set("t", fmt(S.t, 1)); rd.set("sel", `№ ${S.sel + 1}`); rd.set("k", fmt(kOf(v), 3), "хв⁻¹"); rd.set("A", fmt(s.C * Amax, 2)); rd.set("sc", score(s.C * Amax));
        if (ch.dirty || ch2.dirty) { charts(); ch.dirty = ch2.dirty = false; }
        table();
      },
    };
  },
  cheat: `
<h3>Що відбувається</h3>
<p>Пігменти буряка (беталаїни, переважно бетанін) лежать у вакуолі. Живі плазмалема й тонопласт їх не випускають. Холод, нагрівання, кислоти, органічні розчинники та окисники руйнують ліпідно-білкову структуру мембран, і пігмент дифундує в розчин.</p>
<h3>Кінетика виходу</h3>
<div class="eq">d<var>C</var>/d<var>t</var> = <var>k</var>(1 − <var>C</var>) − <var>k</var><sub>d</sub><var>C</var> &nbsp;⇒&nbsp; <var>C</var>(<var>t</var>) = <span class="fr"><span><var>k</var></span><span><var>k</var> + <var>k</var><sub>d</sub></span></span>(1 − e<sup>−(<var>k</var>+<var>k</var><sub>d</sub>)<var>t</var></sup>)</div>
<dl class="vars"><dt>k</dt><dd>константа проникності (пропорційна P·S/V, площі мембран до об'єму), хв⁻¹</dd><dt>k<sub>d</sub></dt><dd>руйнування пігменту в розчині (окиснення H₂O₂, сильна кислота)</dd><dt>C</dt><dd>частка пігменту, що вийшла в розчин</dd></dl>
<h3>Від концентрації до кольору</h3>
<div class="eq"><var>A</var>(λ) = ε(λ)·<var>c</var>·<var>l</var>,&nbsp; <var>T</var>(λ) = 10<sup>−<var>A</var>(λ)</sup></div>
<p>Колір кожної пробірки в моделі не намальований вручну: спектр пропускання бетаніну (максимум 538 нм) перераховується через криві чутливості ока CIE 1931 у колір екрана. Тому слабкий розчин рожевий, концентрований — темно-бордовий.</p>
<h3>Нагрівання як «плавлення» мембран</h3>
<div class="eq"><var>k</var>(<var>T</var>) = <span class="fr"><span><var>k</var><sub>max</sub></span><span>1 + e<sup>−(<var>T</var> − <var>T</var><sub>50</sub>)/<var>w</var></sup></span></span></div>
<p>Перехід різкий: за кілька градусів біля 50–60 °C мембрана втрачає напівпроникність. Це та сама логіка, що й у ЛР 12 (жаростійкість).</p>
<div class="fix"><b>Уточнення до посібника.</b> У кроці 1 вимивається не «β-аланін», а беталаїни (бетаціанін бетанін). Параметри k у моделі підібрані, щоб відтворити типовий результат роботи, і не є виміряними константами. 75 % H₂O₂ знебарвлює пігмент, тож розчин може бути блідим попри повне ушкодження клітин.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Що ще впливає на проникність мембран?</summary><p>pH, іони Ca²⁺ (стабілізують), важкі метали, детерґенти, гербіциди, патогени та їхні токсини, перекисне окиснення ліпідів, вік клітини.</p></details>
<details class="qa"><summary>Чому після морозів змінюється колір жоржин?</summary><p>Лід руйнує тонопласт, антоціани виходять у цитоплазму з іншим pH і окиснюються, хлорофіл феофітинізується кислотами клітинного соку — тканина буріє.</p></details>`,
});
/* ============ ЛР 3. Життєздатність насіння (за Івановим) ============ */
App.add({
  n: 3, short: "Життєздатність насіння", tag: "біноміальна вибірка",
  title: "Визначення життєздатності насіння за фарбуванням цитоплазми (за Л. О. Івановим)",
  model: "a ~ Bin(n, p) · ЖЗН = a/n·100 % · довірчий інтервал Вілсона · фарбування dead: 1 − e^(−t/τ)",
  build({ stageBox, ctrls, below }) {
    const CROPS = { wheat: { name: "пшениця", ar: 2.0, col: "#D9B97A" }, rye: { name: "жито", ar: 2.8, col: "#B9A27A" }, maize: { name: "кукурудза", ar: 1.25, col: "#E5C24E" }, sorgh: { name: "сорго", ar: 1.15, col: "#C79B6A" } };
    const S = { crop: "wheat", p: 0.92, n: 50, dye: "fuchsin", boiled: false, t: 15, seed: 3, seeds: [], play: false };
    function sample() { const r = rng(S.seed * 7919 + S.n); S.seeds = Array.from({ length: S.n }, () => ({ alive: !S.boiled && r() < S.p, rot: (r() - .5) * .5, s: .9 + r() * .2, j: r() })); }
    sample();
    const tau = 3.2; // min, stain penetration into dead embryo
    const stainCol = (x) => Spectral.colorOf(S.dye === "fuchsin" ? { fuchsin: x * 2.2 } : { indigo: x * 2.0 }, 1);

    const st = new Stage(stageBox, { aspect: 1.6, minH: 260, maxH: 460, tag: "Чашка Петрі · розрізані зернівки" });
    const rd = UI.reads(stageBox, [["n", "Узято, шт"], ["st", "Зародок пофарбований"], ["a", "Не пофарбований (a)"], ["v", "ЖЗН"], ["ci", "95 % інтервал"], ["pk", "P(ЖЗН ≥ 90 %) при цьому p"], ["ok", "Висновок"]]);
    UI.select(ctrls, { id: "l3-crop", label: "Культура", value: S.crop, options: Object.entries(CROPS).map(([k, o]) => [k, o.name]), on: v => { S.crop = v; } });
    UI.seg(ctrls, { label: "Барвник", value: S.dye, options: [["fuchsin", "кислий фуксин 0,2 %"], ["indigo", "індигокармін 0,1 %"]], on: v => S.dye = v });
    UI.slider(ctrls, { id: "l3-p", label: "Справжня схожість партії", min: 0.5, max: 1, step: 0.01, value: S.p, unit: "%", fmt: v => Math.round(v * 100), on: v => { S.p = v; sample(); ch.dirty = true; } });
    UI.slider(ctrls, { id: "l3-n", label: "Розмір вибірки n", min: 10, max: 200, step: 10, value: S.n, unit: "шт", on: v => { S.n = v; sample(); ch.dirty = true; } });
    const tS = UI.slider(ctrls, { id: "l3-t", label: "Час у барвнику", min: 0, max: 15, step: 0.5, value: S.t, unit: "хв", fmt: v => fmt(v, 1), on: v => { S.t = v; S.play = false; } });
    UI.check(ctrls, { id: "l3-boil", label: "Контроль: прокип'ячена партія", value: false, on: v => { S.boiled = v; sample(); ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Нова вибірка", pri: true, on: () => { S.seed++; sample(); ch.dirty = true; } }, { label: "Фарбувати з нуля", on: () => { S.t = 0; S.play = true; } }]);

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Імовірність кожного можливого результату a при n і p");
    const ch2 = UI.chart(row, "Ширина 95 % інтервалу залежно від n");

    function wilson(a, n, z = 1.96) { const ph = a / n, d = 1 + z * z / n, c = (ph + z * z / (2 * n)) / d, m = z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - m), Math.min(1, c + m)]; }
    function lgam(x) { // Lanczos
      const g = 7, C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
      if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgam(1 - x);
      x -= 1; let a = C[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += C[i] / (x + i);
      return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
    }
    const pmf = (k, n, p) => p <= 0 ? (k === 0 ? 1 : 0) : p >= 1 ? (k === n ? 1 : 0) : Math.exp(lgam(n + 1) - lgam(k + 1) - lgam(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));

    function drawSeed(c, x, y, L, s, stain) {
      const cr = CROPS[S.crop], w = L / cr.ar;
      c.save(); c.translate(x, y); c.rotate(s.rot);
      // seed coat (pericarp)
      c.beginPath(); c.ellipse(0, 0, w / 2, L / 2, 0, 0, 7); c.fillStyle = cr.col; c.fill();
      c.strokeStyle = "rgba(60,40,10,.55)"; c.lineWidth = 1; c.stroke();
      // endosperm (dead tissue) takes a light stain in every seed
      c.beginPath(); c.ellipse(0, -L * .04, w / 2 - 2.2, L / 2 - 3, 0, 0, 7);
      c.fillStyle = Theme.dark ? "#E9E1CD" : "#F6F0DE"; c.fill();
      c.globalAlpha = 0.12 * Math.min(1, S.t / 6); c.fillStyle = stainCol(0.6); c.fill(); c.globalAlpha = 1;
      // crease
      c.beginPath(); c.moveTo(0, -L / 2 + 3); c.quadraticCurveTo(w * .08, 0, 0, L * .3); c.strokeStyle = "rgba(90,70,30,.35)"; c.stroke();
      // embryo + scutellum at base
      c.beginPath(); c.ellipse(0, L * .36, w * .3, L * .13, 0, 0, 7);
      c.fillStyle = mixHex("#F2EBC8", "#E9E3C0", .5); c.fill();
      c.globalAlpha = stain; c.fillStyle = stainCol(1); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = "rgba(90,70,30,.45)"; c.stroke();
      c.restore();
    }
    function draw() {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c;
      st.clear();
      // petri dish
      const R = Math.min(W, H) * .47, cx = W / 2, cy = H / 2;
      const g = c.createRadialGradient(cx - R * .3, cy - R * .3, R * .1, cx, cy, R);
      g.addColorStop(0, Theme.dark ? "#1c2620" : "#FFFFFF"); g.addColorStop(1, Theme.dark ? "#131b16" : "#E9EDE6");
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = rgba(T.ink, .2); c.stroke();
      c.beginPath(); c.arc(cx, cy, R - 6, 0, 7); c.lineWidth = 1; c.strokeStyle = rgba(T.ink, .1); c.stroke();
      // seeds in a hex packing inside circle
      const n = S.seeds.length, area = Math.PI * (R - 14) ** 2, cell = Math.sqrt(area / n / 1.1);
      const L = Math.min(cell * 1.18, 54);
      let k = 0;
      for (let yy = cy - R + cell / 2; yy < cy + R && k < n; yy += cell * .9) {
        for (let xx = cx - R + cell / 2 + ((Math.round((yy - cy) / cell) & 1) ? cell / 2 : 0); xx < cx + R && k < n; xx += cell) {
          if (Math.hypot(xx - cx, yy - cy) > R - cell * .62) continue;
          const sd = S.seeds[k++];
          const stain = sd.alive ? 0.06 * Math.min(1, S.t / 15) : 1 - Math.exp(-S.t / (tau * (0.7 + sd.j * .6)));
          drawSeed(c, xx, yy, L * sd.s, sd, stain);
        }
      }
      Draw.text(c, `${CROPS[S.crop].name} · ${fmt(S.t, 1)} хв у барвнику`, 10, H - 10, { color: T.muted });
    }
    function charts(a) {
      const n = S.n, p = S.p; const bars = []; let mx = 0;
      for (let k = 0; k <= n; k++) { const v = pmf(k, n, p); bars.push([k / n * 100, v]); mx = Math.max(mx, v); }
      let pOk = 0; for (let k = Math.ceil(0.9 * n); k <= n; k++) pOk += pmf(k, n, p);
      drawChart(ch, { x: [Math.max(0, p * 100 - 35), 100.5], y: [0, mx * 1.15], xl: "ЖЗН у вибірці, %", yl: "імовірність",
        band: [{ x0: 90, x1: 100.5, color: rgba(Theme.c.chl, .1) }],
        series: [{ pts: bars, bars: true, color: rgba(Theme.c.data, .65), bw: Math.max(1.5, (ch.W - 60) / (n * 0.37) * 0.6) }],
        vl: [{ x: a / n * 100, color: Theme.c.antho }, { x: 90, color: Theme.c.chl, label: "90 %", align: "right" }],
        yfmt: v => fmt(v, 2) });
      const pts = [], pts2 = []; for (let m = 10; m <= 400; m += 5) { const [lo, hi] = wilson(Math.round(p * m), m); pts.push([m, (hi - lo) * 50]); }
      drawChart(ch2, { x: [10, 400], y: [0, Math.max(20, pts[0][1] * 1.1)], xl: "кількість насінин n", yl: "± відсоткових пунктів", series: [{ pts, color: Theme.c.chl, w: 2.2, fill: rgba(Theme.c.chl, .1) }], marks: [{ x: n, y: (wilson(a, n)[1] - wilson(a, n)[0]) * 50, color: Theme.c.antho, label: `n = ${n}` }] });
    }
    let lastA = -1;
    return {
      stages: [st, ch, ch2],
      frame(dt) {
        if (S.play) { S.t = Math.min(15, S.t + dt * 2); tS.set(S.t); if (S.t >= 15) S.play = false; }
        draw();
        const stained = S.seeds.filter(s => !s.alive).length, a = S.n - stained;
        const counted = S.t >= 10; // read the result only after staining is complete
        const [lo, hi] = wilson(a, S.n);
        const v = a / S.n * 100;
        rd.set("n", S.n); rd.set("st", counted ? stained : "…"); rd.set("a", counted ? a : "…");
        rd.set("v", counted ? fmt(v, 0) : "…", counted ? "%" : ""); rd.set("ci", counted ? `${fmt(lo * 100, 0)}–${fmt(hi * 100, 0)}` : "…", counted ? "%" : "");
        { let pk = 0; for (let k = Math.ceil(0.9 * S.n); k <= S.n; k++) pk += pmf(k, S.n, S.boiled ? 0 : S.p); rd.set("pk", fmt(pk * 100, 0), "%"); }
        rd.set("ok", !counted ? "фарбується" : v >= 95 ? '<span class="pill good">придатне</span>' : v >= 90 ? '<span class="pill warn">на межі</span>' : '<span class="pill bad">непридатне</span>');
        if (a !== lastA || ch.dirty) { charts(a); lastA = a; ch.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Принцип методу</h3>
<p>Жива цитоплазма не пропускає барвник (кислий фуксин, індигокармін). Мертвий або сильно ушкоджений зародок фарбується швидко й яскраво. Ендосперм зернівки — мертва тканина, тому легке рожеве забарвлення ендосперму буває в усіх насінин; оцінюють лише зародок.</p>
<h3>Розрахунок</h3>
<div class="eq">ЖЗН = <span class="fr"><span><var>a</var></span><span><var>n</var></span></span> · 100 %</div>
<dl class="vars"><dt>a</dt><dd>кількість насінин з незабарвленим зародком</dd><dt>n</dt><dd>усього насінин в аналізі</dd></dl>
<div class="fix"><b>Уточнення до посібника.</b> Формула «ЖЗН = (а − 100/в)·100» містить друкарську помилку: правильно ЖЗН = а/в·100 %. Також метод Іванова призначений для однодольних (пшениця, жито, кукурудза), а не дводольних, як сказано в меті роботи.</div>
<h3>Чому 10 насінин — мало</h3>
<p>Кількість живих насінин у вибірці — біноміальна випадкова величина:</p>
<div class="eq"><var>P</var>(<var>a</var> = <var>k</var>) = C<sub><var>n</var></sub><sup><var>k</var></sup> <var>p</var><sup><var>k</var></sup>(1 − <var>p</var>)<sup><var>n</var>−<var>k</var></sup></div>
<p>95 % інтервал Вілсона для частки:</p>
<div class="eq"><span class="fr"><span><var>p̂</var> + <span class="fr"><span><var>z</var>²</span><span>2<var>n</var></span></span> ± <var>z</var>√(<span class="fr"><span><var>p̂</var>(1−<var>p̂</var>)</span><span><var>n</var></span></span> + <span class="fr"><span><var>z</var>²</span><span>4<var>n</var>²</span></span>)</span><span>1 + <var>z</var>²/<var>n</var></span></span>,&nbsp; <var>z</var> = 1,96</div>
<p>При n = 10 і 9 живих насінинах інтервал — приблизно 60–98 %. Тому стандарти аналізу насіння використовують 4 × 100 або 2 × 50 насінин.</p>
<h3>Нормативи для висновку</h3>
<p>Для зернових і бобових життєздатність має бути не нижчою за 90–95 %.</p>
<h3>До контрольних питань</h3>
<details class="qa"><summary>70 % зародків квасолі пофарбувались індигокарміном. Висновок?</summary><p>Життєздатні лише 30 % — партія непридатна до сівби; таке насіння краще не висівати, а з'ясувати причину (старіння, травмування, промерзання).</p></details>
<details class="qa"><summary>Чому набухає насіння олійних, хоча жири гідрофобні?</summary><p>Воду поглинають білки й полісахариди клітинних стінок та цитоплазми (гідрофільні колоїди), а не запасні ліпіди.</p></details>`,
});
/* ============ ЛР 4. Стан продихового апарату ============ */
App.add({
  n: 4, short: "Продиховий апарат", tag: "закон Фіка · провідність",
  title: "Вивчення стану продихового апарату рослин",
  model: "E = g·VPD/P · g продиху за Брауном–Ескомбом · ширина щілини a(t) реагує на світло, CO₂, VPD, ψ листка, АБК",
  build({ stageBox, ctrls, below }) {
    const S = { par: 900, co2: 420, T: 26, rh: 55, psiS: -0.2, aba: false, day: false, clock: 6, a: 2e-6, hist: [], tt: 0, paper: 0, paperUp: 0, paperLo: 0, speed: 1 };
    const AMAX = 7e-6, LEN = 22e-6, DEP = 12e-6, Dw = 2.42e-5; // m
    const N_LO = 160e6, N_UP = 45e6; // stomata per m²
    const es = (T) => 0.6108 * Math.exp(17.27 * T / (T + 237.3));
    const molar = (T) => 101325 / (RG * (273.15 + T)); // mol/m³
    function gPore(a, n, T) { if (a <= 0) return 0; const A = Math.PI * a * LEN / 4, r = Math.sqrt(A / Math.PI); return n * Dw * A / (DEP + Math.PI * r / 2) * molar(T); } // mol m⁻² s⁻¹
    function env() {
      let par = S.par, T = S.T, rh = S.rh;
      if (S.day) { const hr = S.clock; const sun = Math.max(0, Math.sin(Math.PI * (hr - 6) / 14)); par = 1700 * sun; T = 17 + 15 * Math.max(0, Math.sin(Math.PI * (hr - 8) / 14)); rh = clamp(85 - 50 * Math.max(0, Math.sin(Math.PI * (hr - 8) / 14)), 25, 90); }
      return { par, T, rh, vpd: es(T) * (1 - rh / 100) };
    }
    function solve(a, e) { // fluxes for aperture a
      const gU = gPore(a, N_UP, e.T) + 0.006, gL = gPore(a, N_LO, e.T) + 0.006, gb = 2.0;
      const gu = 1 / (1 / gU + 1 / gb), gl = 1 / (1 / gL + 1 / gb);
      const Eu = gu * e.vpd / 101.325, El = gl * e.vpd / 101.325; // mol m⁻² s⁻¹
      const psiL = S.psiS - (Eu + El) * 1000 * 0.08; // MPa
      return { gu, gl, Eu, El, psiL };
    }
    function target(e, psiL) {
      const fL = 0.04 + 0.96 * e.par / (e.par + 180);
      const fC = clamp(Math.exp(-(S.co2 - 400) / 900), 0.3, 1.25);
      const fV = 1 / (1 + Math.max(0, e.vpd - 1) / 2.2);
      const fW = 1 / (1 + Math.exp((-psiL - 1.2) / 0.12));
      return AMAX * clamp(fL * fC * fV * fW * (S.aba ? 0.18 : 1), 0, 1);
    }
    const thr = { xyl: 0.8e-6, ben: 2.6e-6, eth: 4.6e-6 };

    const st = new Stage(stageBox, { aspect: 1.7, minH: 250, maxH: 440, tag: "Відбиток епідермісу (Полаччі–Молотковський)" });
    const rd = UI.reads(stageBox, [["a", "Ширина щілини"], ["g", "Провідність g, нижній бік"], ["E", "Транспірація E"], ["psi", "ψ листка"], ["cl", "CoCl₂: низ / верх"], ["inf", "Інфільтрація (Моліш)"]]);
    const dayB = UI.seg(ctrls, { label: "Режим", value: "fix", options: [["fix", "Сталі умови"], ["day", "Добовий хід"]], on: v => { S.day = v === "day"; S.hist = []; S.tt = 0; S.clock = 6; ch.dirty = true; } });
    const sl = [];
    sl.push(UI.slider(ctrls, { id: "l4-par", label: "Світло (ФАР)", min: 0, max: 1800, step: 10, value: S.par, unit: "мкмоль/м²·с", on: v => S.par = v }));
    sl.push(UI.slider(ctrls, { id: "l4-T", label: "Температура повітря", min: 10, max: 40, step: 1, value: S.T, unit: "°C", on: v => S.T = v }));
    sl.push(UI.slider(ctrls, { id: "l4-rh", label: "Вологість повітря", min: 15, max: 95, step: 1, value: S.rh, unit: "%", on: v => S.rh = v }));
    UI.slider(ctrls, { id: "l4-co2", label: "CO₂", min: 150, max: 1200, step: 10, value: S.co2, unit: "ppm", on: v => S.co2 = v });
    UI.slider(ctrls, { id: "l4-psi", label: "Водний потенціал ґрунту", min: -1.6, max: 0, step: 0.05, value: S.psiS, unit: "МПа", fmt: v => fmt(v, 2), on: v => S.psiS = v });
    UI.check(ctrls, { id: "l4-aba", label: "Обробка абсцизовою кислотою", value: false, on: v => S.aba = v });
    UI.buttons(ctrls, [{ label: "Прикласти CoCl₂-папір", pri: true, on: () => { S.paperUp = S.paperLo = 0; S.paper = 1; } }]);

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Хід у часі: щілина і транспірація");
    const ch2 = UI.chart(row, "Провідність продихів залежно від ширини щілини");

    // epidermis texture (jigsaw pavement cells via perturbed Voronoi), rebuilt on theme/size change
    let tex = null, texKey = "";
    const stomata = []; { const r = rng(11); for (let i = 0; i < 9; i++) stomata.push({ x: 0.08 + (i % 3) * 0.33 + r() * .14, y: 0.12 + Math.floor(i / 3) * 0.32 + r() * .12, ang: (r() - .5) * 1.0, s: .85 + r() * .3, lag: r() }); }
    function buildTex(W, H) {
      const sc = 0.5, w = Math.ceil(W * sc), hh = Math.ceil(H * sc);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = hh; const c = cv.getContext("2d");
      const im = c.createImageData(w, hh); const r = rng(5); const pts = [];
      for (let i = 0; i < 46; i++) pts.push([r() * w, r() * hh]);
      const base = Theme.dark ? [24, 34, 28] : [236, 242, 230], line = Theme.dark ? [70, 96, 80] : [150, 170, 140];
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const wx = x + 5 * Math.sin(y * 0.11) + 3 * Math.sin(x * 0.17 + y * 0.05), wy = y + 5 * Math.sin(x * 0.12) + 3 * Math.cos(y * 0.19);
        let d1 = 1e9, d2 = 1e9; for (const [px, py] of pts) { const d = (wx - px) ** 2 + (wy - py) ** 2; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
        const edge = Math.sqrt(d2) - Math.sqrt(d1); const k = clamp(1 - edge / 2.2, 0, 1);
        const i = (y * w + x) * 4; const n = (r() - .5) * 6;
        for (let ch = 0; ch < 3; ch++) im.data[i + ch] = lerp(base[ch] + n, line[ch], k);
        im.data[i + 3] = 255;
      }
      c.putImageData(im, 0, 0); return cv;
    }
    function drawStoma(c, x, y, s, ang, a, T) {
      const Lg = 30 * s, wg = 11 * s, open = clamp(a / AMAX, 0, 1.2); // half-length, guard cell width
      c.save(); c.translate(x, y); c.rotate(ang);
      // subsidiary halo
      c.beginPath(); c.ellipse(0, 0, Lg + 8, wg * 2 + 8, 0, 0, 7); c.fillStyle = Theme.dark ? "rgba(90,120,100,.12)" : "rgba(170,190,160,.25)"; c.fill();
      const gap = 1 + open * 7 * s;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.ellipse(0, side * (gap + wg) * 0.92, Lg, wg + 1.5 * (1 - open), 0, 0, 7);
        const gg = c.createLinearGradient(0, side * gap, 0, side * (gap + 2 * wg));
        gg.addColorStop(0, Theme.dark ? "#2E6A44" : "#7DB56D"); gg.addColorStop(1, Theme.dark ? "#1F4A30" : "#5F9A55");
        c.fillStyle = gg; c.fill(); c.strokeStyle = Theme.dark ? "#5c8f6c" : "#3E6E3A"; c.lineWidth = 1.2; c.stroke();
        // chloroplasts
        c.fillStyle = Theme.dark ? "rgba(140,220,150,.55)" : "rgba(30,90,30,.45)";
        for (let k = -3; k <= 3; k++) { c.beginPath(); c.ellipse(k * Lg * 0.24, side * (gap + wg * (0.85 + 0.15 * Math.cos(k))), 2.4, 1.6, 0, 0, 7); c.fill(); }
      }
      // pore
      c.beginPath(); c.ellipse(0, 0, Lg * 0.62, Math.max(0.6, gap * 0.95), 0, 0, 7); c.fillStyle = Theme.dark ? "#050806" : "#2b2f26"; c.fill();
      c.restore();
    }
    function draw(e, f) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c;
      const key = W + "x" + H + Theme.v; if (key !== texKey) { tex = buildTex(W, H); texKey = key; }
      c.imageSmoothingEnabled = true; c.drawImage(tex, 0, 0, W, H);
      for (const s of stomata) { const a = S.a * (0.85 + s.lag * 0.3); drawStoma(c, s.x * W, s.y * H, s.s * Math.min(1, W / 700 + .3), s.ang, a, T); }
      // cobalt paper strips (right edge) + Molisch drops (bottom-left)
      const pw = Math.min(70, W * .12), px = W - pw - 10;
      const pap = (x, y, frac, lab) => { const col = mixHex("#3F6FD0", "#E28AB0", smooth(0, 1, frac)); c.fillStyle = col; c.fillRect(x, y, pw, 36); c.strokeStyle = rgba(T.ink, .3); c.strokeRect(x + .5, y + .5, pw - 1, 35); Draw.text(c, lab, x + pw / 2, y + 48, { align: "center", color: T.ink, size: 10 }); };
      c.fillStyle = rgba(T.sheet, .85); c.fillRect(px - 8, 8, pw + 16, 122);
      Draw.text(c, "CoCl₂-папір", px + pw / 2, 22, { align: "center", color: T.muted, size: 10 });
      pap(px, 30, S.paperLo, "низ листка"); pap(px, 84 - 4, S.paperUp, "верх");
      const dx = 12, dy = H - 62; c.fillStyle = rgba(T.sheet, .85); c.fillRect(dx - 6, dy - 16, 196, 70);
      Draw.text(c, "Інфільтрація (через 5 хв)", dx, dy - 4, { size: 10, color: T.muted });
      [["ксилол", thr.xyl], ["бензол", thr.ben], ["спирт", thr.eth]].forEach(([nm, th], i) => {
        const ok = S.a >= th; const x = dx + 30 + i * 62, y = dy + 22;
        c.beginPath(); c.ellipse(x, y, 20, 13, 0, 0, 7);
        c.fillStyle = ok ? (Theme.dark ? "rgba(160,220,170,.35)" : "rgba(210,240,200,.95)") : (Theme.dark ? "#1f3d29" : "#4F8A47"); c.fill();
        c.strokeStyle = ok ? T.chl : rgba(T.ink, .25); c.stroke();
        Draw.text(c, ok ? "+" : "−", x, y + 4, { align: "center", color: ok ? T.chl : "#fff", size: 13, weight: 600 });
        Draw.text(c, nm, x, y + 26, { align: "center", size: 10, color: T.ink });
      });
      if (S.day) Draw.text(c, `${String(Math.floor(S.clock)).padStart(2, "0")}:${String(Math.floor((S.clock % 1) * 60)).padStart(2, "0")}`, 12, 26, { size: 16, color: T.ink, weight: 600 });
      if (f.psiL < -1.3) Draw.text(c, "листок в'яне: тургор втрачено", W / 2, 26, { align: "center", color: T.bad, size: 12, weight: 600 });
    }
    function charts() {
      const H = S.hist; const xmax = S.day ? 24 : Math.max(30, S.tt / 60);
      const xs = S.day ? (p) => p.clock : (p) => p.t;
      drawChart(ch, { x: S.day ? [0, 24] : [0, xmax], y: [0, Math.max(8, ...H.map(p => Math.max(p.E, p.a, p.par / 250))) * 1.08], xl: S.day ? "година доби" : "час, хв", yl: "мкм  /  ммоль·м⁻²·с⁻¹",
        series: [{ pts: H.map(p => [xs(p), p.a]), color: Theme.c.chl, w: 2.2, fill: rgba(Theme.c.chl, .08) }, { pts: H.map(p => [xs(p), p.E]), color: Theme.c.data, w: 2 }, ...(S.day ? [{ pts: H.map(p => [xs(p), p.par / 250]), color: Theme.c.carot, w: 1.2, dash: [4, 3] }] : [])],
        legend: [{ label: "щілина, мкм", color: Theme.c.chl }, { label: "E, ммоль/м²·с", color: Theme.c.data }, ...(S.day ? [{ label: "ФАР/250", color: Theme.c.carot }] : [])] });
      const pts = []; for (let a = 0; a <= 8; a += 0.1) pts.push([a, gPore(a * 1e-6, N_LO, 25)]);
      drawChart(ch2, { x: [0, 8], y: [0, Math.max(...pts.map(p => p[1])) * 1.1], xl: "ширина щілини, мкм", yl: "g, моль·м⁻²·с⁻¹", series: [{ pts, color: Theme.c.chl, w: 2.2 }],
        vl: [{ x: thr.xyl * 1e6, label: "ксилол", color: Theme.c.muted }, { x: thr.ben * 1e6, label: "бензол", color: Theme.c.muted }, { x: thr.eth * 1e6, label: "спирт", color: Theme.c.muted }],
        marks: [{ x: S.a * 1e6, y: gPore(S.a, N_LO, 25), color: Theme.c.antho }] });
    }
    sl.forEach(s => s.el.addEventListener("input", () => { if (S.day) { dayB[0].click(); } }));
    let acc = 0;
    return {
      stages: [st, ch, ch2],
      frame(dt) {
        const simDt = dt * 60 * (S.day ? 20 : 4); // seconds of plant time
        if (S.day) { S.clock += simDt / 3600; if (S.clock >= 24) { S.clock = 0; S.hist = []; } }
        S.tt += simDt;
        const e = env(); let f = solve(S.a, e);
        const at = target(e, f.psiL);
        const tau = at > S.a ? 600 : 300; // s: opening slower than closing
        S.a += (at - S.a) * (1 - Math.exp(-simDt / tau)); f = solve(S.a, e);
        // cobalt paper: critical water uptake 1.2 g/m² (blue → pink); papers sealed under glass
        const mc = 1.2;
        if (S.paper) { S.paperLo = Math.min(1, S.paperLo + f.El * 18 * (dt * 6) / mc); S.paperUp = Math.min(1, S.paperUp + f.Eu * 18 * (dt * 6) / mc); }
        acc += simDt; if (acc > (S.day ? 300 : 20)) { acc = 0; S.hist.push({ t: S.tt / 60, clock: S.clock, a: S.a * 1e6, E: (f.El + f.Eu) * 1000, par: e.par }); if (S.hist.length > 600) S.hist.shift(); ch.dirty = true; }
        draw(e, f);
        const tL = mc / (f.El * 18), tU = mc / (f.Eu * 18);
        const ts = (t) => t > 5940 ? "> 99 хв" : t >= 60 ? `${Math.floor(t / 60)} хв ${String(Math.round(t % 60)).padStart(2, "0")} с` : `${Math.round(t)} с`;
        rd.set("a", fmt(S.a * 1e6, 2), "мкм"); rd.set("g", fmt(f.gl * 1000, 0), "ммоль/м²·с"); rd.set("E", fmt((f.El + f.Eu) * 1000, 2), "ммоль/м²·с");
        rd.set("psi", fmt(f.psiL, 2), "МПа"); rd.set("cl", `${ts(tL)} / ${ts(tU)}`);
        rd.set("inf", S.a >= thr.eth ? "широко відкриті" : S.a >= thr.ben ? "середньо відкриті" : S.a >= thr.xyl ? "слабко відкриті" : "закриті");
        if (ch.dirty) { charts(); ch.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Транспірація як дифузія</h3>
<p>Пара води виходить з міжклітинників назовні через продихові щілини. Потік підкоряється закону Фіка: він пропорційний провідності й різниці концентрацій пари.</p>
<div class="eq"><var>E</var> = <var>g</var> · <span class="fr"><span>VPD</span><span><var>P</var><sub>атм</sub></span></span>,&nbsp;&nbsp; VPD = <var>e</var><sub>s</sub>(<var>T</var>)·(1 − RH)</div>
<div class="eq"><var>e</var><sub>s</sub>(<var>T</var>) = 0,6108·exp(<span class="fr"><span>17,27·<var>T</var></span><span><var>T</var> + 237,3</span></span>) кПа</div>
<h3>Провідність одного продиху (Браун–Ескомб)</h3>
<div class="eq"><var>g</var> = <var>n</var>·<span class="fr"><span><var>D</var>·<var>A</var><sub>пори</sub></span><span><var>l</var> + π<var>r</var>/2</span></span>·<span class="fr"><span><var>P</var></span><span><var>RT</var></span></span></div>
<dl class="vars"><dt>n</dt><dd>кількість продихів на м² (нижній бік ≈ 160 мм⁻², верхній ≈ 45 мм⁻²)</dd><dt>D</dt><dd>коефіцієнт дифузії пари, 2,42·10⁻⁵ м²/с</dd><dt>A</dt><dd>площа щілини π·a·L/4 (еліпс шириною a і довжиною L)</dd><dt>l</dt><dd>глибина пори; π<var>r</var>/2 — «крайова» поправка</dd></dl>
<p>Через крайову поправку провідність зростає майже лінійно з шириною щілини: навіть частково відкриті продихи пропускають багато пари.</p>
<h3>Чому продих відкривається</h3>
<p>Ширина щілини прямує до цільового значення, яке задає добуток множників: світло (насичення), CO₂ (високий — закриває), сухе повітря (VPD), водний потенціал листка ψ<sub>л</sub> = ψ<sub>ґрунту</sub> − <var>E</var>·<var>R</var><sub>гідр</sub>, АБК (закриває). Відкривання повільніше за закривання.</p>
<h3>Три методи роботи в моделі</h3>
<ul><li><b>Шталь:</b> час посиніння → порожевіння CoCl₂-паперу <var>t</var> = <var>m</var><sub>кр</sub>/(<var>E</var>·<var>M</var><sub>H₂O</sub>), менший час — сильніша транспірація.</li><li><b>Моліш:</b> ксилол проникає вже у слабко відкриті продихи, бензол — у середньо, спирт — лише в широко відкриті.</li><li><b>Відбитки:</b> лак дає репліку, на якій рахують продихи в полі зору і міряють щілини.</li></ul>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому в злаків продихи є і на верхньому боці?</summary><p>Листок злаків стоїть майже вертикально, обидва боки освітлені однаково, тому продихи розподілені на обох (амфістоматичний листок).</p></details>
<details class="qa"><summary>Чому в спеку рослина в'яне навіть у вологому ґрунті?</summary><p>Увімкніть «Добовий хід»: опівдні E зростає швидше, ніж корені й ксилема встигають подавати воду; ψ листка падає нижче точки втрати тургору. Уночі E ≈ 0, ψ вирівнюється з ґрунтом — тургор відновлюється.</p></details>
<details class="qa"><summary>Чи транспірують дерева без листя?</summary><p>Так, слабко: через сочевички й кору (лентикулярна, кутикулярна транспірація). Взимку це спричиняє фізіологічну посуху пагонів.</p></details>`,
});
/* ============ ЛР 5. Фізичні та хімічні властивості пігментів ============ */
App.add({
  n: 5, short: "Властивості пігментів", tag: "Бер–Ламберт · колір зі спектра",
  title: "Фізичні та хімічні властивості пігментів",
  model: "A(λ) = l·Σ εᵢ(λ)·cᵢ · T = 10^(−A) · колір = ∫ T(λ)·x̄ȳz̄(λ) dλ → sRGB",
  build({ stageBox, ctrls, below }) {
    const EX = { chlA: 1.0, chlB: 0.33, car: 0.10, xan: 0.22 };
    const scale = (o, k) => { const r = {}; for (const x in o) r[x] = o[x] * k; return r; };
    const STATES = {
      extract: { fill: .36, layers: [{ frac: 1, comp: EX }], label: "спиртова витяжка" },
      kraus: { fill: .7, layers: [{ frac: .5, comp: { xan: EX.xan } }, { frac: .5, comp: { chlA: EX.chlA, chlB: EX.chlB, car: EX.car } }], label: "низ: спирт · верх: бензин" },
      sapon: { fill: .72, layers: [{ frac: .5, comp: { chlin: EX.chlA + EX.chlB * .8, xan: EX.xan } }, { frac: .5, comp: { car: EX.car } }], label: "низ: хлорофілін · верх: каротин" },
      pheo: { fill: .38, layers: [{ frac: 1, comp: { pheoA: EX.chlA, pheoB: EX.chlB, car: EX.car, xan: EX.xan } }], label: "феофітин" },
      cu: { fill: .38, layers: [{ frac: 1, comp: { cuChl: EX.chlA + EX.chlB * .8, car: EX.car, xan: EX.xan } }], label: "Cu/Zn-похідне" },
    };
    const S = { dil: 2.0, path: 1.6, tubes: [{ st: "extract", from: "extract", p: 1 }, { st: "extract", from: "extract", p: 1 }], fluo: false, sel: [0, 0], heat: 0 };
    function lerpComp(a, b, t) { const r = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) r[k] = lerp(a[k] || 0, b[k] || 0, t); return r; }
    function layersOf(tb) {
      const A = STATES[tb.from], B = STATES[tb.st], t = smooth(0, 1, tb.p);
      const mixed = (s) => { const r = {}; let f = 0; s.layers.forEach(L => { for (const k in L.comp) r[k] = (r[k] || 0) + L.comp[k] * L.frac; }); return r; };
      if (B.layers.length === 2 && A.layers.length === 1) { // shaking then separating
        const m = scale(mixed(B), 1);
        return { fill: lerp(A.fill, B.fill, smooth(0, .3, tb.p)), layers: B.layers.map(L => ({ frac: L.frac, comp: lerpComp(m, L.comp, smooth(.3, 1, tb.p)) })), sep: tb.p > .45 };
      }
      if (B.layers.length === 2 && A.layers.length === 2) return { fill: B.fill, layers: B.layers.map((L, i) => ({ frac: L.frac, comp: lerpComp(A.layers[i].comp, L.comp, t) })), sep: true, swap: true };
      if (A.layers.length === 2 && B.layers.length === 1) return { fill: B.fill, layers: [{ frac: 1, comp: B.layers[0].comp }], sep: false };
      return { fill: lerp(A.fill, B.fill, t), layers: [{ frac: 1, comp: lerpComp(A.layers[0].comp, B.layers[0].comp, t) }], sep: false };
    }
    function go(i, s) { const tb = S.tubes[i]; tb.from = tb.p < 1 ? tb.st : tb.st; tb.st = s; tb.p = 0; if (s === "cu") S.heat = 1; ch.dirty = true; }

    const st = new Stage(stageBox, { aspect: 1.55, minH: 270, maxH: 460, tag: "Колір обчислено зі спектрів поглинання" });
    const rd = UI.reads(stageBox, [["A664", "A₆₆₄ (червоний пік)"], ["A430", "A₄₃₀ (синій пік)"], ["blue", "Поглинуто 400–500 нм"], ["red", "Поглинуто 620–700 нм"], ["ph", "Фотонів у 1 Дж: 450 / 680 нм"]]);
    ctrls.append(h("div", { class: "lbl note" }, "Пробірка 1 — розділення за Краусом і омилення:"));
    UI.buttons(ctrls, [{ label: "Реакція Крауса", on: () => go(0, "kraus") }, { label: "+ KOH (омилення)", on: () => { if (S.tubes[0].st !== "kraus") return; go(0, "sapon"); } }]);
    ctrls.append(h("div", { class: "lbl note" }, "Пробірка 2 — магній у молекулі хлорофілу:"));
    UI.buttons(ctrls, [{ label: "+ HCl (феофітин)", on: () => go(1, "pheo") }, { label: "+ Cu/Zn ацетат, нагріти", on: () => { if (S.tubes[1].st !== "pheo") return; go(1, "cu"); } }]);
    UI.buttons(ctrls, [{ label: "Нова витяжка", pri: true, on: () => { S.tubes.forEach(t => { t.st = t.from = "extract"; t.p = 1; }); ch.dirty = true; } }]);
    const fl = UI.seg(ctrls, { label: "Освітлення", value: "tr", options: [["tr", "прохідне світло"], ["fl", "відбите, темний фон"]], on: v => { S.fluo = v === "fl"; } });
    UI.slider(ctrls, { id: "l5-dil", label: "Концентрація витяжки", min: 0.1, max: 5, step: 0.05, value: S.dil, unit: "відн.", fmt: v => fmt(v, 2), on: v => { S.dil = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l5-l", label: "Товщина шару (діаметр пробірки)", min: 0.3, max: 3, step: 0.1, value: S.path, unit: "см", fmt: v => fmt(v, 1), on: v => { S.path = v; ch.dirty = true; } });
    const which = UI.seg(ctrls, { label: "Спектр на графіку", value: "1t", options: [["1t", "П1 верх"], ["1b", "П1 низ"], ["2", "П2"]], on: v => { S.which = v; ch.dirty = true; } }); S.which = "1t";

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Спектр поглинання вибраного шару і його компоненти", { aspect: 1.7 });
    const ch2 = UI.chart(row, "Довідкові спектри пігментів (одинична концентрація)", { aspect: 1.7 });

    const NAMES = { chlA: "хлорофіл a", chlB: "хлорофіл b", car: "β-каротин", xan: "ксантофіли", chlin: "хлорофілін K", pheoA: "феофітин a", pheoB: "феофітин b", cuChl: "Cu-хлорофіл" };
    const COLS = { chlA: "#3A8F5A", chlB: "#8BAA3A", car: "#E08A1E", xan: "#D4B020", chlin: "#2F9A7A", pheoA: "#8A7A3A", pheoB: "#A08E50", cuChl: "#1E9E8A" };
    function selComp() {
      const tb = S.which === "2" ? S.tubes[1] : S.tubes[0]; const L = layersOf(tb);
      if (S.which === "2" || L.layers.length === 1) return L.layers[0].comp;
      return S.which === "1t" ? L.layers[L.layers.length - 1].comp : L.layers[0].comp;
    }
    function fluoColor(comp, k) { // red emission ~ absorbed light
      const A = Spectral.absorb(comp, 430) * S.dil * 0.4 + Spectral.absorb(comp, 664) * S.dil * 0.3;
      const em = (1 - Math.exp(-A)) * ((comp.chlA || 0) + (comp.chlB || 0) * .3 + (comp.chlin || 0) * .5) / Math.max(1e-6, Object.values(comp).reduce((a, b) => a + b, 0)) * k;
      return `rgb(${Math.round(30 + 190 * em)},${Math.round(14 + 8 * em)},${Math.round(16 + 6 * em)})`;
    }
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c;
      if (S.fluo) { st.clear("#07080a"); } else { // light box
        st.clear(Theme.dark ? "#1b211d" : "#FBFCF8");
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, Theme.dark ? "#262e29" : "#FFFFFF"); g.addColorStop(1, Theme.dark ? "#161b18" : "#EEF1EA"); c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
      const tw = Math.min(56, W * .1), th = H * .72, top = H * .1;
      const xs = [W * .26 - tw / 2, W * .62 - tw / 2];
      S.tubes.forEach((tb, i) => {
        const L = layersOf(tb);
        const shake = tb.p < .3 && STATES[tb.st].layers.length === 2 && tb.from !== tb.st ? Math.sin(time * 40) * 3 * (1 - tb.p / .3) : 0;
        const layers = L.layers.map(Lr => ({ frac: Lr.frac, color: S.fluo ? fluoColor(scale(Lr.comp, 1), 1) : Spectral.colorOf(scale(Lr.comp, S.dil), S.path) }));
        Draw.tube(c, xs[i] + shake, top, tw, th, layers, { fill: L.fill, label: i === 0 ? "П1" : "П2", stroke: S.fluo ? "rgba(255,255,255,.35)" : null,
          after: (cc, surf) => {
            if (L.sep && L.layers.length === 2) { const y = top + th - L.fill * th * .5; cc.strokeStyle = "rgba(255,255,255,.55)"; cc.lineWidth = 1.5; cc.beginPath(); cc.moveTo(xs[i] + shake, y); cc.quadraticCurveTo(xs[i] + tw / 2 + shake, y + 3, xs[i] + tw + shake, y); cc.stroke(); }
            if (i === 1 && S.heat > 0 && tb.st === "cu" && tb.p < 1) { for (let k = 0; k < 7; k++) { const by = top + th - ((time * 60 + k * 37) % (L.fill * th)); cc.beginPath(); cc.arc(xs[i] + 8 + (k * 13) % (tw - 14), by, 1.8 + k % 3, 0, 7); cc.strokeStyle = "rgba(255,255,255,.7)"; cc.stroke(); } }
          } });
        Draw.text(c, STATES[tb.st].label, xs[i] + tw / 2, top + th + 32, { align: "center", color: S.fluo ? "#bbb" : T.muted, size: 11, font: "body" });
      });
      if (S.fluo) { // lamp
        const lx = W * .9, ly = H * .2; const g = c.createRadialGradient(lx, ly, 2, lx, ly, W * .5); g.addColorStop(0, "rgba(255,250,220,.35)"); g.addColorStop(1, "rgba(255,250,220,0)"); c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.beginPath(); c.arc(lx, ly, 10, 0, 7); c.fillStyle = "#fff6d0"; c.fill();
        Draw.text(c, "лампа", lx, ly + 26, { align: "center", color: "#ccc", size: 10 });
      } else {
        // swatch legend of pure pigments at this concentration
        let y = top + 4; const x = W - 118;
        Draw.text(c, "чисті пігменти:", x, y, { color: T.muted, size: 10 }); y += 8;
        for (const k of ["chlA", "chlB", "car", "xan"]) { c.fillStyle = Spectral.colorOf({ [k]: k === "chlA" || k === "chlB" ? 2.2 : 0.8 }, S.path); c.fillRect(x, y, 16, 16); c.strokeStyle = rgba(T.ink, .2); c.strokeRect(x + .5, y + .5, 15, 15); Draw.text(c, NAMES[k], x + 22, y + 12, { color: T.ink, size: 11, font: "body" }); y += 22; }
      }
    }
    function charts() {
      const comp = scale(selComp(), S.dil), pts = [], comps = {};
      for (let l = 380; l <= 720; l += 2) { pts.push([l, Spectral.absorb(comp, l) * S.path]); for (const k in comp) if (comp[k] > 1e-3) (comps[k] = comps[k] || []).push([l, Spectral.absorb({ [k]: comp[k] }, l) * S.path]); }
      const ym = Math.max(0.3, ...pts.map(p => p[1])) * 1.1;
      drawChart(ch, { x: [380, 720], y: [0, ym], xl: "λ, нм", yl: "A", spectrum: true,
        series: [...Object.entries(comps).map(([k, p]) => ({ pts: p, color: COLS[k], w: 1.2, dash: [3, 3] })), { pts, color: Theme.c.ink, w: 2.2, fill: rgba(Theme.c.ink, .05) }],
        legend: Object.keys(comps).map(k => ({ label: NAMES[k], color: COLS[k] })) });
      const ref = {}; for (const k of ["chlA", "chlB", "car", "pheoA"]) { ref[k] = []; for (let l = 380; l <= 720; l += 2) ref[k].push([l, Spectral.absorb({ [k]: 1 }, l)]); }
      drawChart(ch2, { x: [380, 720], y: [0, 2.7], xl: "λ, нм", yl: "ε, відн.", spectrum: true, series: Object.entries(ref).map(([k, p]) => ({ pts: p, color: COLS[k], w: 1.8 })), legend: Object.keys(ref).map(k => ({ label: NAMES[k], color: COLS[k] })) });
      // readouts
      const A664 = Spectral.absorb(comp, 664) * S.path, A430 = Spectral.absorb(comp, 430) * S.path;
      const band = (a, b) => { let s = 0, n = 0; for (let l = a; l <= b; l += 2) { s += 1 - Math.pow(10, -Spectral.absorb(comp, l) * S.path); n++; } return s / n * 100; };
      rd.set("A664", fmt(A664, 2)); rd.set("A430", fmt(A430, 2)); rd.set("blue", fmt(band(400, 500), 0), "%"); rd.set("red", fmt(band(620, 700), 0), "%");
      const nph = (l) => l * 1e-9 / (6.626e-34 * 2.998e8);
      rd.set("ph", `${fmt(nph(450) / 1e18, 2)} / ${fmt(nph(680) / 1e18, 2)}`, "·10¹⁸");
    }
    ch2.dirty = true;
    return {
      stages: [st, ch, ch2],
      frame(dt, time) {
        let moving = false;
        for (const tb of S.tubes) if (tb.p < 1) { tb.p = Math.min(1, tb.p + dt / (tb.st === "cu" ? 3.5 : 2.6)); moving = true; if (tb.p >= 1) tb.from = tb.st; }
        draw(time);
        if (moving || ch.dirty || ch2.dirty) { charts(); ch.dirty = ch2.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Пігменти листка</h3>
<ul><li><b>Хлорофіл a</b> C₅₅H₇₂O₅N₄Mg — основний; максимуми ~430 і 664 нм.</li><li><b>Хлорофіл b</b> C₅₅H₇₀O₆N₄Mg — допоміжний; ~457 і 645 нм.</li><li><b>Каротини</b> C₄₀H₅₆ і <b>ксантофіли</b> C₄₀H₅₆O<sub>n</sub> — поглинають 420–490 нм.</li></ul>
<h3>Закон Бугера–Ламберта–Бера</h3>
<div class="eq"><var>A</var>(λ) = <var>l</var>·Σ ε<sub>i</sub>(λ)·<var>c</var><sub>i</sub>,&nbsp;&nbsp; <var>T</var>(λ) = 10<sup>−<var>A</var>(λ)</sup></div>
<p>Зелений колір — це те, що лишилось після поглинання синього й червоного. Модель перетворює спектр пропускання на колір через функції чутливості ока CIE 1931: <var>X</var> = ∫<var>T</var>(λ)x̄(λ)dλ (так само <var>Y</var>, <var>Z</var>), потім матриця XYZ → sRGB. Збільште концентрацію або товщину шару: густий екстракт стає темно-зеленим, майже бурим, бо червоний пік насичується.</p>
<h3>Хімічні реакції в моделі</h3>
<ul><li><b>Краус:</b> гідрофільніші ксантофіли (двоатомні спирти) лишаються в спирті (низ, жовтий), хлорофіли й каротин переходять у бензин (верх, зелений).</li><li><b>Омилення:</b> хлорофіл + 2KOH → K-сіль хлорофіліну + CH₃OH + фітол. Сіль гідрофільна і йде в нижній шар, у бензині лишається каротин: шари «міняються кольорами».</li><li><b>Феофітинізація:</b> 2H⁺ витісняють Mg²⁺ із порфіринового ядра → оливково-бурий феофітин; червоний пік слабшає, синій зсувається до 409 нм.</li><li><b>Відновлення металоорганічного зв'язку:</b> Cu²⁺ або Zn²⁺ займає місце Mg — колір знову смарагдовий, але сполука вже не фотосинтетично активна.</li></ul>
<h3>Флуоресценція</h3>
<p>Збуджена молекула хлорофілу повертається до основного стану, випромінюючи червоне світло (~680 нм) незалежно від довжини хвилі збудження. У відбитому світлі на темному фоні розчин здається темно-червоним. У живому листку флуоресценція слабша: енергія йде на фотохімію.</p>
<div class="fix"><b>Уточнення до посібника.</b> Рівняння відновлення зв'язку записане для Zn(CH₃COO)₂, хоча в тексті йдеться про мідь: годиться будь-яка з цих солей. Спектральні смуги в моделі — гаусові наближення літературних спектрів у спирті; положення максимумів точні в межах кількох нанометрів.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Синє чи червоне світло однакової інтенсивності — де більше фіксується CO₂?</summary><p>За однакової енергії червоне: фотон 680 нм несе менше енергії, тому фотонів у 1 Дж на ~50 % більше (див. показник у моделі), а фотосинтез рахує кванти. Частину синіх квантів до того ж поглинають каротиноїди з меншою ефективністю передачі.</p></details>
<details class="qa"><summary>Роль фікоеритрину та фікоціаніну?</summary><p>Це допоміжні пігменти (фікобіліни), що поглинають зелене й жовто-оранжеве світло і передають енергію хлорофілу a. У фотосинтезі беруть участь опосередковано, через перенесення енергії.</p></details>
<details class="qa"><summary>Чому трава після заморозків буро-оливкова?</summary><p>Лід руйнує мембрани, органічні кислоти вакуолі контактують з хлорофілом — відбувається феофітинізація. Тканини з феофітином уже загинули.</p></details>`,
});
/* ============ ЛР 6. Паперова хроматографія ============ */
App.add({
  n: 6, short: "Паперова хроматографія", tag: "Rf · Лукас–Вошберн",
  title: "Розподіл пігментів методом одномірної паперової хроматографії",
  model: "L(t) = √(D_w·t) (капілярний підйом) · Rf = 1/(1 + k) · пляма — гаусіан з σ² = σ₀² + 2·D·t",
  build({ stageBox, ctrls, below }) {
    const PIG = [
      { k: "chlide", name: "хлорофілід", rf0: 0.0, pol: 0.0, comp: { chlA: .25 }, amt: .25 },
      { k: "chlB", name: "хлорофіл b", rf0: 0.30, pol: 1.0, comp: { chlB: 1 }, amt: .9 },
      { k: "chlA", name: "хлорофіл a", rf0: 0.42, pol: 0.8, comp: { chlA: 1 }, amt: 1.6 },
      { k: "xan", name: "ксантофіли", rf0: 0.66, pol: 0.9, comp: { xan: 1 }, amt: .9 },
      { k: "car", name: "каротин", rf0: 0.95, pol: 0.1, comp: { car: 1 }, amt: .6 },
    ];
    const S = { t: 0, play: false, ac: 0, Dw: 0.085, len: 10, dips: 15, speed: 30 }; S.t = S.len * S.len / S.Dw;
    const rf = (p) => { if (p.rf0 <= 0) return Math.min(0.06, S.ac * 0.004); const k0 = 1 / p.rf0 - 1; const k = k0 * Math.exp(-0.11 * S.ac * p.pol); return 1 / (1 + k); };
    const front = (t) => Math.min(S.len, Math.sqrt(S.Dw * t)); // cm
    const tEnd = () => S.len * S.len / S.Dw; // s

    const st = new Stage(stageBox, { aspect: 1.25, minH: 320, maxH: 520, tag: "Хроматографічна камера" });
    const rd = UI.reads(stageBox, [["t", "Час"], ["L", "Фронт розчинника L"], ["v", "Швидкість фронту"], ["hov", "Під курсором: l / Rf"]]);
    const playB = UI.buttons(ctrls, [{ label: "Запустити", pri: true, on: () => { if (S.t >= tEnd()) S.t = 0; S.play = !S.play; playB[0].textContent = S.play ? "Пауза" : "Запустити"; } }, { label: "Нова смужка", on: () => { S.t = 0; S.play = false; playB[0].textContent = "Запустити"; } }]);
    UI.slider(ctrls, { id: "l6-ac", label: "Ацетон у бензині (полярність)", min: 0, max: 20, step: 1, value: 0, unit: "%", on: v => { S.ac = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l6-dw", label: "Капілярність паперу D_w", min: 0.03, max: 0.2, step: 0.005, value: S.Dw, unit: "см²/с", fmt: v => fmt(v, 3), on: v => { S.Dw = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l6-dip", label: "Нанесень витяжки на старт", min: 3, max: 25, step: 1, value: S.dips, unit: "раз", on: v => { S.dips = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l6-sp", label: "Прискорення", min: 5, max: 120, step: 5, value: S.speed, unit: "×", on: v => S.speed = v });
    ctrls.append(h("p", { class: "note" }, "Наведіть курсор на смужку: модель покаже відстань від старту і Rf у цій точці, як при вимірюванні лінійкою."));

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Денситограма смужки: поглинання вздовж напрямку руху");
    const ch2 = UI.chart(row, "Фронт розчинника: закон Лукаса–Вошберна");
    const tb = h("div", { class: "tblwrap" }); below.append(h("div", { class: "chart" }, h("h4", null, "Таблиця 6.1 · коефіцієнт рухомості"), tb));

    // paper fibre texture
    let tex = null, tk = "";
    function paperTex(w, hh) { const cv = document.createElement("canvas"); cv.width = w; cv.height = hh; const c = cv.getContext("2d"); c.fillStyle = Theme.dark ? "#d9dcd2" : "#FAFAF5"; c.fillRect(0, 0, w, hh); const r = rng(3); for (let i = 0; i < w * hh / 14; i++) { c.strokeStyle = `rgba(120,120,100,${0.04 + r() * .06})`; c.beginPath(); const x = r() * w, y = r() * hh, a = r() * Math.PI; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * (3 + r() * 9), y + Math.sin(a) * (3 + r() * 9)); c.stroke(); } return cv; }
    function spots(t) {
      const L = front(t), out = [];
      for (const p of PIG) { const y = rf(p) * L; const sg = Math.sqrt(0.06 ** 2 + 2 * 1.2e-4 * t + (0.025 * y) ** 2); out.push({ p, y, sg, amt: p.amt * S.dips / 15 }); }
      return out;
    }
    let geom = {};
    function draw() {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear();
      // chamber
      const cw = Math.min(W * .34, 170), cx = W * .32 - cw / 2, top = 26, bot = H - 22;
      c.fillStyle = Theme.dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.7)"; c.fillRect(cx, top, cw, bot - top);
      c.strokeStyle = rgba(T.ink, .45); c.lineWidth = 1.4; c.strokeRect(cx, top, cw, bot - top);
      c.fillStyle = Theme.dark ? "#3b3326" : "#9C8466"; c.fillRect(cx - 6, top - 12, cw + 12, 12); // stopper
      // solvent pool
      const poolH = 16; c.fillStyle = Theme.dark ? "rgba(140,170,200,.25)" : "rgba(170,200,225,.45)"; c.fillRect(cx + 1, bot - poolH, cw - 2, poolH - 1);
      // strip
      const sw = Math.min(46, cw * .35), sx = cx + (cw - sw) / 2, sTop = top + 10, sBot = bot - poolH + 6;
      const pxPerCm = (sBot - sTop) / 12; const yStart = sBot - 1.5 * pxPerCm; const Y = (cm) => yStart - cm * pxPerCm;
      geom = { sx, sw, Y, pxPerCm, yStart };
      const key = sw + "x" + (sBot - sTop) + Theme.v; if (key !== tk) { tex = paperTex(Math.ceil(sw), Math.ceil(sBot - sTop)); tk = key; }
      c.drawImage(tex, sx, sTop, sw, sBot - sTop);
      // wetted zone
      const L = front(S.t);
      c.fillStyle = Theme.dark ? "rgba(120,150,180,.18)" : "rgba(150,180,210,.18)"; c.fillRect(sx, Y(L), sw, sBot - Y(L));
      // pigment bands: render column of pixels as sum of gaussians → Beer–Lambert colour of the paper
      const sp = spots(S.t);
      for (let py = Math.floor(sTop); py < sBot; py += 2) {
        const cm = (yStart - py) / pxPerCm; const comp = {};
        let any = false;
        for (const s of sp) { const d = (cm - s.y) / s.sg; if (Math.abs(d) > 4) continue; const a = s.amt * Math.exp(-0.5 * d * d) * 0.14 / s.sg; for (const k in s.p.comp) comp[k] = (comp[k] || 0) + s.p.comp[k] * a; any = true; }
        if (!any) continue;
        c.fillStyle = Spectral.colorOf(comp, 1); c.globalAlpha = 0.92; c.fillRect(sx + 2, py, sw - 4, 2); c.globalAlpha = 1;
      }
      // marks
      c.strokeStyle = rgba(T.ink, .6); c.setLineDash([3, 2]); c.beginPath(); c.moveTo(sx - 4, yStart); c.lineTo(sx + sw + 4, yStart); c.stroke();
      c.strokeStyle = T.data; c.beginPath(); c.moveTo(sx - 4, Y(L)); c.lineTo(sx + sw + 4, Y(L)); c.stroke(); c.setLineDash([]);
      Draw.text(c, "старт", sx - 8, yStart + 4, { align: "right", size: 10 });
      if (L > 0.3) Draw.text(c, "фронт", sx - 8, Y(L) + 4, { align: "right", size: 10, color: T.data });
      // ruler on the right of chamber
      const rx = cx + cw + 14;
      for (let cm = 0; cm <= 10; cm++) { c.strokeStyle = rgba(T.ink, .5); c.beginPath(); c.moveTo(rx, Y(cm)); c.lineTo(rx + (cm % 5 ? 6 : 11), Y(cm)); c.stroke(); if (cm % 2 === 0) Draw.text(c, String(cm), rx + 14, Y(cm) + 4, { size: 10 }); }
      Draw.text(c, "см", rx + 14, Y(10.6), { size: 10 });
      // labels for bands
      const lx = rx + 44;
      for (const s of sp) { if (s.p.rf0 === 0 && S.ac === 0) continue; if (L < 0.8) break; c.strokeStyle = rgba(T.ink, .25); c.beginPath(); c.moveTo(sx + sw + 2, Y(s.y)); c.lineTo(lx - 4, Y(s.y)); c.stroke(); Draw.text(c, `${s.p.name}  Rf ${fmt(s.y / Math.max(L, 1e-6), 2)}`, lx, Y(s.y) + 4, { size: 11, color: T.ink, font: "body" }); }
      // hover line
      if (st.mouse && st.mouse.x > sx - 10 && st.mouse.x < sx + sw + 10 && st.mouse.y > Y(L) - 4 && st.mouse.y < yStart + 4) {
        c.strokeStyle = T.antho; c.beginPath(); c.moveTo(sx - 10, st.mouse.y); c.lineTo(sx + sw + 10, st.mouse.y); c.stroke();
        const l = (yStart - st.mouse.y) / pxPerCm; rd.set("hov", `${fmt(l * 10, 0)} мм / ${fmt(l / Math.max(L, 1e-6), 2)}`);
      } else rd.set("hov", "—");
    }
    let lastRow = "";
    function charts() {
      const sp = spots(S.t), L = front(S.t), pts = {};
      const xs = []; for (let x = 0; x <= 10; x += 0.05) xs.push(x);
      const series = sp.filter(s => s.p.rf0 > 0 || S.ac > 0).map(s => ({ pts: xs.map(x => [x, s.amt * Math.exp(-0.5 * ((x - s.y) / s.sg) ** 2) * 0.06 / s.sg]), color: Spectral.colorOf(Object.fromEntries(Object.keys(s.p.comp).map(k => [k, 2])), 1), w: 2, fill: rgba("#888888", .05) }));
      drawChart(ch, { x: [0, 10], y: [0, 1.4], xl: "відстань від старту, см", yl: "інтенсивність", series, vl: L > 0.1 ? [{ x: L, color: Theme.c.data, label: "фронт" }] : [] });
      const tt = tEnd(), fp = []; for (let i = 0; i <= 60; i++) { const t = tt * i / 60; fp.push([t / 60, front(t)]); }
      drawChart(ch2, { x: [0, tt / 60], y: [0, 10.5], xl: "час, хв", yl: "L, см", series: [{ pts: fp, color: Theme.c.data, w: 2.2, fill: rgba(Theme.c.data, .08) }], marks: [{ x: S.t / 60, y: L, color: Theme.c.antho }] });
      const rowsKey = sp.map(s => fmt(s.y, 2)).join("|"); if (rowsKey !== lastRow) { lastRow = rowsKey;
        tb.innerHTML = `<table class="t"><thead><tr><th>Пігмент</th><th>Колір</th><th>l, мм</th><th>L, мм</th><th>Rf = l/L</th></tr></thead><tbody>${sp.map(s => `<tr><td>${s.p.name}</td><td><span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;background:${Spectral.colorOf(Object.fromEntries(Object.keys(s.p.comp).map(k => [k, 2])), 1)}"></span></td><td class="n">${fmt(s.y * 10, 1)}</td><td class="n">${fmt(L * 10, 1)}</td><td class="n">${L > 0.1 ? fmt(s.y / L, 2) : "—"}</td></tr>`).join("")}</tbody></table>`; }
    }
    return {
      stages: [st, ch, ch2],
      frame(dt) {
        if (S.play) { S.t = Math.min(tEnd(), S.t + dt * S.speed); if (S.t >= tEnd()) { S.play = false; playB[0].textContent = "Запустити"; } ch.dirty = true; }
        draw();
        const L = front(S.t);
        rd.set("t", `${Math.floor(S.t / 60)}:${String(Math.floor(S.t % 60)).padStart(2, "0")}`); rd.set("L", fmt(L * 10, 0), "мм"); rd.set("v", S.t > 0 ? fmt(S.Dw / (2 * Math.max(L, 0.01)) * 600, 2) : "—", "мм/хв");
        if (ch.dirty) { charts(); ch.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Принцип</h3>
<p>Нерухома фаза — целюлоза паперу з адсорбованою водою, рухома — бензин. Кожен пігмент безперервно розподіляється між ними. Що краще речовина розчиняється в рухомій фазі і що слабше адсорбується, то далі вона пройде. Метод запропонував М. С. Цвєт (1906).</p>
<h3>Коефіцієнт рухомості</h3>
<div class="eq"><var>R</var><sub>f</sub> = <span class="fr"><span><var>l</var></span><span><var>L</var></span></span> = <span class="fr"><span>1</span><span>1 + <var>k</var></span></span></div>
<dl class="vars"><dt>l</dt><dd>відстань від старту до центру плями</dd><dt>L</dt><dd>відстань від старту до фронту розчинника</dd><dt>k</dt><dd>коефіцієнт ємності: скільки часу молекула «сидить» на папері відносно часу в розчиннику</dd></dl>
<p>Rf не залежить від часу: пляма і фронт рухаються пропорційно. Тому Rf — характеристика речовини в даній системі «адсорбент + розчинник».</p>
<h3>Як рухається фронт</h3>
<div class="eq"><var>L</var>(<var>t</var>) = √(<var>D</var><sub>w</sub>·<var>t</var>),&nbsp; <var>D</var><sub>w</sub> = <span class="fr"><span>γ·<var>r</var>·cos θ</span><span>2η</span></span></div>
<p>Закон Лукаса–Вошберна для капілярів: швидкість фронту спадає як 1/√t. Друга половина смужки проходиться втричі довше за першу.</p>
<h3>Розмиття плям</h3>
<div class="eq">σ² = σ₀² + 2<var>D</var><sub>m</sub><var>t</var> + (<var>a</var>·<var>l</var>)²</div>
<p>Дифузія і нерівномірність паперу розширюють смуги. Звідси вимога вузької стартової лінії (2–3 мм) і щільного рівномірного паперу.</p>
<h3>Порядок плям (знизу вгору)</h3>
<p>хлорофілід (на старті) → хлорофіл b (жовто-зелений) → хлорофіл a (синьо-зелений) → ксантофіли (жовті) → каротин (оранжевий, біля фронту). Додайте в моделі трохи ацетону: полярні пігменти рушають вище, каротин майже не змінюється.</p>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Що за зелена пляма лишається на старті?</summary><p>Хлорофілід — хлорофіл без фітольного «хвоста». Без гідрофобного ланцюга він не розчиняється в бензині і не рухається.</p></details>
<details class="qa"><summary>Чому хлорофіл a йде вище за b?</summary><p>У хлорофілу b замість −CH₃ є альдегідна група −CHO: молекула полярніша, міцніше адсорбується на целюлозі, тому її k більший, а Rf менший.</p></details>
<details class="qa"><summary>Навіщо глибоководним водоростям червоне забарвлення?</summary><p>Фікоеритрин поглинає синьо-зелене світло, яке проникає найглибше, і передає енергію хлорофілу (хроматична адаптація).</p></details>`,
});
/* ============ ЛР 7. Фотосенсибілізуюча дія хлорофілу ============ */
App.add({
  n: 7, short: "Фотосенсибілізація хлорофілом", tag: "фотокінетика Красновського",
  title: "Фотосенсибілізуюча дія хлорофілу на реакцію перенесення водню (за О. А. Гуревичем)",
  model: "d[МЧ]/dt = −φ·I_abs·[АК]/(K_А+[АК])·[МЧ]/(K_М+[МЧ]) · I_abs = I₀·(1 − 10^(−A_хл)) · колір зі спектрів",
  build({ stageBox, ctrls, below }) {
    const V = [
      { s: "1", lab: "Хл + МЧ + АК + hν", chl: 1, mr: 1, aa: 1, light: 1 },
      { s: "2", lab: "Хл + МЧ + АК, темрява", chl: 1, mr: 1, aa: 1, light: 0 },
      { s: "3", lab: "Хл + МЧ + hν", chl: 1, mr: 1, aa: 0, light: 1 },
      { s: "4", lab: "Хл + АК + hν", chl: 1, mr: 0, aa: 1, light: 1 },
      { s: "5", lab: "Спирт + МЧ + АК + hν", chl: 0, mr: 1, aa: 1, light: 1 },
    ];
    const S = { t: 0, play: false, I0: 1, chlC: 0.55, filter: true, sel: 0, speed: 1.5, hist: [] };
    const init = () => { S.st = V.map(v => ({ mr: v.mr ? 1 : 0, aa: v.aa ? 1 : 0, chl: v.chl ? 1 : 0, T: 22 })); S.hist = [V.map(() => [0, 1])]; S.series = V.map((v, i) => [[0, S.st[i].mr]]); S.t = 0; };
    init();
    const KA = 0.25, KM = 0.15, phi = 0.38; // per min at full lamp
    function rates(v, s) {
      const Achl = s.chl * S.chlC * 1.6; // absorbance of chlorophyll at excitation
      const Iabs = v.light * S.I0 * (1 - Math.pow(10, -Achl));
      const r = phi * Iabs * (s.aa / (KA + s.aa)) * (s.mr / (KM + s.mr));
      const bleach = v.light * S.I0 * s.chl * (s.aa > 0 ? 0.002 : 0.012) * (S.filter ? 1 : 2); // chl photo-oxidation, faster without donor
      return { r, Iabs, bleach };
    }
    function step(dtMin) {
      V.forEach((v, i) => {
        const s = S.st[i], R = rates(v, s);
        const k = 1 + (S.filter ? 0 : (s.T - 22) * 0.06);
        s.mr = Math.max(0, s.mr - R.r * k * dtMin); s.aa = Math.max(0, s.aa - R.r * k * dtMin * 0.5);
        s.chl = Math.max(0, s.chl - R.bleach * dtMin);
        if (!S.filter && v.light) s.T = Math.min(48, s.T + 1.2 * dtMin); // lamp heats tube without water filter
      });
    }
    const colorFor = (i) => { const s = S.st[i], c = S.chlC * s.chl * 2.4; return Spectral.colorOf({ chlA: c, chlB: c * .33, car: c * .1, xan: c * .22, mred: s.mr * 0.9 }, 1.4); };

    const st = new Stage(stageBox, { aspect: 1.9, minH: 260, maxH: 430, tag: "Лампа · водяний фільтр · штатив" });
    const rd = UI.reads(stageBox, [["t", "Експозиція, хв"], ["mr", "[МЧ] у вибраній пробірці"], ["r", "Швидкість відновлення"], ["E", "Енергія фотона 680 нм"], ["T", "Температура розчину"]]);
    const playB = UI.buttons(ctrls, [{ label: "Увімкнути лампу", pri: true, on: () => { if (S.t >= 20) init(); S.play = !S.play; playB[0].textContent = S.play ? "Пауза" : "Увімкнути лампу"; } }, { label: "Заново", on: () => { init(); S.play = false; playB[0].textContent = "Увімкнути лампу"; ch.dirty = true; } }]);
    UI.slider(ctrls, { id: "l7-I", label: "Інтенсивність світла", min: 0.1, max: 1.5, step: 0.05, value: S.I0, unit: "відн.", fmt: v => fmt(v, 2), on: v => S.I0 = v });
    UI.slider(ctrls, { id: "l7-c", label: "Концентрація хлорофілу", min: 0.1, max: 1.2, step: 0.05, value: S.chlC, unit: "відн.", fmt: v => fmt(v, 2), on: v => S.chlC = v });
    UI.check(ctrls, { id: "l7-f", label: "Посудина з водою між лампою і штативом", value: true, on: v => S.filter = v });
    UI.slider(ctrls, { id: "l7-sp", label: "Швидкість", min: 0.5, max: 5, step: 0.5, value: S.speed, unit: "хв/с", fmt: v => fmt(v, 1), on: v => S.speed = v });
    ctrls.append(h("p", { class: "note" }, "Натисніть на пробірку, щоб побачити її шлях електрона на енергетичній схемі."));
    st.cv.addEventListener("click", (e) => { const r = st.cv.getBoundingClientRect(); const x = e.clientX - r.left; const i = Math.floor((x - st.W * .34) / (st.W * .66 / 5)); if (i >= 0 && i < 5) S.sel = i; });

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Концентрація метилового червоного в часі");
    const en = UI.chart(row, "Схема перенесення електрона");
    const tb = h("div", { class: "tblwrap" }); below.append(h("div", { class: "chart" }, h("h4", null, "Таблиця 7.1"), tb));

    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear();
      const lamp = S.play ? 1 : 0;
      // lamp
      const lx = W * .07, ly = H * .45;
      if (lamp) { const g = c.createRadialGradient(lx, ly, 4, lx, ly, W * .8); g.addColorStop(0, `rgba(255,240,190,${.42 * S.I0})`); g.addColorStop(1, "rgba(255,240,190,0)"); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      c.fillStyle = lamp ? "#FFF3C4" : (Theme.dark ? "#3a3a32" : "#d8d6c8"); c.beginPath(); c.arc(lx, ly, 18, 0, 7); c.fill(); c.strokeStyle = rgba(T.ink, .5); c.stroke();
      c.fillStyle = rgba(T.ink, .7); c.fillRect(lx - 30, ly - 26, 14, 52);
      // water filter
      if (S.filter) { const fx = W * .2; c.fillStyle = Theme.dark ? "rgba(100,150,200,.22)" : "rgba(160,200,235,.45)"; c.fillRect(fx, H * .18, 22, H * .62); c.strokeStyle = rgba(T.ink, .45); c.strokeRect(fx + .5, H * .18 + .5, 21, H * .62); Draw.text(c, "H₂O", fx + 11, H * .86, { align: "center", size: 10 }); }
      // tubes
      const x0 = W * .34, slot = W * .66 / 5, tw = Math.min(40, slot * .5), th = H * .64, top = H * .12;
      V.forEach((v, i) => {
        const x = x0 + i * slot + (slot - tw) / 2;
        Draw.tube(c, x, top, tw, th, [{ frac: 1, color: colorFor(i) }], { fill: .6, label: v.s, labelColor: i === S.sel ? T.chl : T.muted, stroke: i === S.sel ? T.chl : null });
        if (!v.light) { c.fillStyle = Theme.dark ? "#000" : "#151515"; c.fillRect(x - 4, top + th * .25, tw + 8, th * .7); Draw.text(c, "чорний папір", x + tw / 2, top + th * .6, { align: "center", color: "#aaa", size: 9, font: "body" }); c.fillStyle = colorFor(i); c.fillRect(x + tw * .3, top + th * .5, tw * .4, 10); }
        if (lamp && v.light && v.chl && S.st[i].mr > 0.02 && S.st[i].aa > 0.02) { for (let k = 0; k < 4; k++) { const ph = (time * 2 + k * .25 + i * .13) % 1; c.beginPath(); c.arc(x + tw / 2 + Math.sin(ph * 9 + k) * tw * .25, top + th - ph * th * .55, 1.6, 0, 7); c.fillStyle = "rgba(255,255,255,.8)"; c.fill(); } }
      });
    }
    function energy(time) {
      const c = en.ctx, W = en.W, H = en.H, T = Theme.c; c.fillStyle = T.sheet; c.fillRect(0, 0, W, H);
      const v = V[S.sel], s = S.st[S.sel], R = rates(v, s);
      const lv = { aa: H * .58, chl: H * .74, chlx: H * .2, mr: H * .4 };
      const col = [W * .16, W * .48, W * .82];
      const lvl = (x, y, label, color, on) => { c.strokeStyle = on ? color : rgba(T.muted, .4); c.lineWidth = 3; c.beginPath(); c.moveTo(x - 46, y); c.lineTo(x + 46, y); c.stroke(); c.lineWidth = 1; Draw.text(c, label, x, y + 16, { align: "center", color: on ? T.ink : T.muted, size: 11, font: "body" }); };
      lvl(col[0], lv.aa, "АК (донор)", T.carot, v.aa);
      lvl(col[1], lv.chl, "Хл (основний)", T.chl, v.chl); lvl(col[1], lv.chlx, "Хл* (збуджений)", T.chl, v.chl && v.light);
      lvl(col[2], lv.mr, "МЧ (акцептор)", T.antho, v.mr);
      Draw.text(c, "↑ сильніший відновник", 8, 14, { size: 10 });
      // photon arrow
      if (v.chl) { c.strokeStyle = v.light ? T.carot : rgba(T.muted, .4); c.setLineDash([4, 3]); c.beginPath(); c.moveTo(col[1] - 20, lv.chl - 4); c.lineTo(col[1] - 20, lv.chlx + 6); c.stroke(); c.setLineDash([]); Draw.text(c, "hν", col[1] - 30, (lv.chl + lv.chlx) / 2, { align: "right", color: v.light ? T.carot : T.muted, size: 13, font: "display" }); }
      const path = [[col[1] + 10, lv.chlx], [col[2], lv.mr], null, [col[0], lv.aa], [col[1] + 10, lv.chl]];
      const on = R.r > 1e-4 && S.play;
      c.strokeStyle = on ? T.ink : rgba(T.muted, .4);
      const arr = (a, b) => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); const an = Math.atan2(b[1] - a[1], b[0] - a[0]); c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(b[0] - 8 * Math.cos(an - .4), b[1] - 8 * Math.sin(an - .4)); c.lineTo(b[0] - 8 * Math.cos(an + .4), b[1] - 8 * Math.sin(an + .4)); c.fill(); };
      c.fillStyle = c.strokeStyle; arr(path[0], path[1]); arr(path[3], path[4]);
      Draw.text(c, "e⁻", (path[0][0] + path[1][0]) / 2 + 6, (path[0][1] + path[1][1]) / 2 - 6, { size: 12, color: T.ink });
      Draw.text(c, "e⁻", (path[3][0] + path[4][0]) / 2, (path[3][1] + path[4][1]) / 2 - 8, { size: 12, color: T.ink });
      if (on) { // moving electrons
        for (let k = 0; k < 3; k++) { const ph = (time * 0.8 + k / 3) % 1; let p; if (ph < .4) { const u = ph / .4; p = [lerp(path[3][0], path[4][0], u), lerp(path[3][1], path[4][1], u)]; } else if (ph < .6) { const u = (ph - .4) / .2; p = [col[1] + 10, lerp(lv.chl, lv.chlx, u)]; } else { const u = (ph - .6) / .4; p = [lerp(path[0][0], path[1][0], u), lerp(path[0][1], path[1][1], u)]; } c.beginPath(); c.arc(p[0], p[1], 4, 0, 7); c.fillStyle = T.data; c.fill(); }
      }
      const why = !v.chl ? "немає фотосенсибілізатора — енергія світла не вловлюється" : !v.light ? "немає світла — Хл не збуджується" : !v.aa ? "немає донора — Хл⁺ не відновлюється, реакція зупиняється" : !v.mr ? "немає акцептора — електрону нікуди йти" : "ланцюг повний: АК → Хл* → МЧ";
      Draw.text(c, why, W / 2, H - 8, { align: "center", color: on ? T.chl : T.muted, size: 11, font: "body" });
    }
    let lastTb = -1;
    function table() {
      const k = Math.round(S.t); if (k === lastTb) return; lastTb = k;
      const desc = (i) => { const s = S.st[i]; if (!V[i].mr) return "зелений (лише хлорофіл)"; if (s.mr > .8) return V[i].chl ? "буро-коричневий" : "червоний"; if (s.mr > .3) return "оливково-бурий"; return "зелений: МЧ відновлено"; };
      tb.innerHTML = `<table class="t"><thead><tr><th>№</th><th>Компоненти + освітлення</th><th>Початковий колір</th><th>Через ${fmt(S.t, 0)} хв</th><th>[МЧ]</th></tr></thead><tbody>${V.map((v, i) => `<tr><td class="n">${v.s}</td><td>${v.lab}</td><td>${v.mr ? (v.chl ? "буро-коричневий" : "червоний") : "зелений"}</td><td>${desc(i)}</td><td class="n">${fmt(S.st[i].mr * 100, 0)} %</td></tr>`).join("")}</tbody></table>`;
    }
    // rest state: show the finished 20-minute experiment
    S.play = true; for (let k = 0; k < 400; k++) { step(0.05); S.t += 0.05; if (k % 4 === 3) S.series.forEach((p, i) => p.push([S.t, S.st[i].mr])); } S.play = false;
    return {
      stages: [st, ch, en],
      frame(dt, time) {
        if (S.play) { const dm = dt * S.speed; step(dm); S.t += dm; S.series.forEach((p, i) => p.push([S.t, S.st[i].mr])); if (S.t >= 20) { S.play = false; playB[0].textContent = "Увімкнути лампу"; } ch.dirty = true; }
        draw(time); energy(time);
        const v = V[S.sel], s = S.st[S.sel], R = rates(v, s);
        rd.set("t", fmt(S.t, 1)); rd.set("mr", fmt(s.mr * 100, 0), "%"); rd.set("r", fmt(S.play ? R.r * 100 : 0, 1), "%/хв"); rd.set("E", fmt(1239.84 / 680, 2), "еВ"); rd.set("T", fmt(s.T, 0), "°C");
        if (ch.dirty) { drawChart(ch, { x: [0, 20], y: [0, 1.05], xl: "час, хв", yl: "[МЧ] / [МЧ]₀", series: S.series.map((p, i) => ({ pts: p, color: [Theme.c.chl, Theme.c.muted, Theme.c.carot, Theme.c.data, Theme.c.antho][i], w: i === S.sel ? 2.8 : 1.6 })), legend: V.map((v, i) => ({ label: v.s, color: [Theme.c.chl, Theme.c.muted, Theme.c.carot, Theme.c.data, Theme.c.antho][i] })) }); ch.dirty = false; }
        table();
      },
    };
  },
  cheat: `
<h3>Ідея досліду</h3>
<p>О. А. Красновський (1948) показав, що збуджений світлом хлорофіл переносить електрон від донора до акцептора, тобто працює як фотосенсибілізатор: сам не витрачається, але без нього реакція не йде.</p>
<div class="eq">АК·H₂ + МЧ <span style="font-size:.8em">—(Хл, hν)→</span> ДГАК + МЧ·H₂ (лейкоформа)</div>
<h3>Енергетика</h3>
<p>Перенесення електрона від аскорбінової кислоти на метиловий червоний у темряві не відбувається. Енергію дає квант: <var>E</var> = <var>hc</var>/λ. Для 680 нм це 1,82 еВ, для 430 нм — 2,88 еВ (надлишок розсіюється як тепло до нижнього збудженого стану). Хл* — сильний відновник: віддає електрон МЧ, а утворений Хл⁺ забирає електрон в АК.</p>
<h3>Кінетична модель</h3>
<div class="eq">−<span class="fr"><span>d[МЧ]</span><span>d<var>t</var></span></span> = φ·<var>I</var><sub>abs</sub>·<span class="fr"><span>[АК]</span><span><var>K</var><sub>А</sub> + [АК]</span></span>·<span class="fr"><span>[МЧ]</span><span><var>K</var><sub>М</sub> + [МЧ]</span></span></div>
<div class="eq"><var>I</var><sub>abs</sub> = <var>I</var>₀·(1 − 10<sup>−<var>A</var><sub>Хл</sub></sup>)</div>
<p>Швидкість дорівнює нулю, якщо будь-який із чотирьох множників нульовий: немає світла, хлорофілу, донора чи акцептора. Це і є логіка п'яти варіантів досліду. Колір кожної пробірки обчислюється як суміш спектрів хлорофілу і МЧ, тому буре забарвлення поступово переходить у зелене.</p>
<h3>Навіщо посудина з водою</h3>
<p>Вода поглинає інфрачервоне випромінювання лампи. Без неї розчин нагрівається, спирт випаровується, а пришвидшення реакції можна помилково приписати світлу. Вимкніть фільтр у моделі й порівняйте температуру.</p>
<div class="fix"><b>Уточнення до посібника.</b> На схемі акцептор підписано «метиленовий червоний» — правильно метиловий червоний. Наведені в тексті потенціали (0,1 і 0,8 еВ) не узгоджуються з твердженням, що МЧ не окиснює АК спонтанно, і до того ж потенціали вимірюють у вольтах. Модель використовує лише якісну шкалу; для студентської відповіді досить: реакція йде «вгору» за енергією і потребує кванта світла.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому щавель при варінні буріє?</summary><p>Щавлева та інші кислоти при нагріванні проникають до хлорофілу — утворюється феофітин (див. ЛР 5).</p></details>
<details class="qa"><summary>Чому в загущеній сосні відмирають нижні гілки, а в ялини ні?</summary><p>Сосна світлолюбна: у затінку її фотосинтез не покриває дихання гілки. Ялина тіньовитривала, має нижчу точку компенсації і більше хлорофілу на одиницю площі.</p></details>`,
});
/* ============ ЛР 8. Пероксидаза і каталаза ============ */
App.add({
  n: 8, short: "Пероксидаза і каталаза", tag: "Міхаеліс–Ментен · Арреніус",
  title: "Виявлення активності ферментів пероксидази і каталази у рослинному матеріалі",
  model: "v = V_max·[S]/(K_m + [S])·f(T) · f(T) = Арреніус × теплова денатурація · піна = ∫v dt з дренажем",
  build({ stageBox, ctrls, below }) {
    const OBJ = [
      { k: "dry", name: "Сухе насіння", cat: 0.35, per: 0.25 },
      { k: "germ", name: "Проросле насіння", cat: 3.0, per: 2.8 },
      { k: "pot", name: "Бульба картоплі", cat: 2.6, per: 3.4 },
      { k: "app", name: "М'якоть яблука", cat: 0.7, per: 1.2 },
      { k: "car", name: "Коренеплід моркви", cat: 1.6, per: 2.4 },
      { k: "yl", name: "Молоді листки гібіскуса", cat: 3.4, per: 2.0 },
      { k: "ml", name: "Зрілі листки гібіскуса", cat: 2.1, per: 2.9 },
    ];
    const S = { obj: 2, T: 22, pct: 3, boiled: false, t: 0, play: true, foam: 0, o2: 0, blue: 0, S: 0, lb: false, bub: [] };
    const KmCat = 0.25, KmPer = 0.004, MOLAR = 0.294; // M per 1 % H2O2
    function fT(T) { const Tk = T + 273.15, Tr = 298.15; const arr = Math.exp(40000 / RG * (1 / Tr - 1 / Tk)); const den = 1 / (1 + Math.exp(350000 / RG * (1 / 323 - 1 / Tk))); const den0 = 1 / (1 + Math.exp(350000 / RG * (1 / 323 - 1 / Tr))); return arr * den / den0; }
    const o = () => OBJ[S.obj];
    const vmaxC = () => S.boiled ? 0 : o().cat * fT(S.T), vmaxP = () => S.boiled ? 0 : o().per * fT(S.T);
    function reset() { S.t = 0; S.foam = 0; S.o2 = 0; S.blue = 0; S.S = S.pct * MOLAR; S.bub = []; S.play = true; S.peakFoam = 0; }
    reset();
    const score = (x, cuts) => cuts.findIndex(c => x < c) === -1 ? 4 : cuts.findIndex(c => x < c);

    const st = new Stage(stageBox, { aspect: 1.7, minH: 260, maxH: 430, tag: "Дві пробірки з витяжкою" });
    const rd = UI.reads(stageBox, [["t", "Час, с"], ["vc", "v каталази"], ["sc", "Каталаза, бал"], ["vp", "v пероксидази"], ["sp", "Пероксидаза, бал"], ["f", "f(T)"]]);
    UI.select(ctrls, { id: "l8-o", label: "Об'єкт", value: S.obj, options: OBJ.map((x, i) => [i, x.name]), on: v => { S.obj = +v; reset(); ch.dirty = true; } });
    UI.slider(ctrls, { id: "l8-T", label: "Температура витяжки", min: 0, max: 80, step: 1, value: S.T, unit: "°C", on: v => { S.T = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l8-c", label: "H₂O₂ для каталази", min: 0.1, max: 10, step: 0.1, value: S.pct, unit: "%", fmt: v => fmt(v, 1), on: v => { S.pct = v; ch.dirty = true; } });
    UI.check(ctrls, { id: "l8-b", label: "Витяжку прокип'ятити (контроль)", value: false, on: v => { S.boiled = v; reset(); ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Додати реактиви", pri: true, on: () => reset() }]);
    UI.seg(ctrls, { label: "Графік кінетики", value: "mm", options: [["mm", "Міхаеліс–Ментен"], ["lb", "Лайнуівер–Берк"]], on: v => { S.lb = v === "lb"; ch.dirty = true; } });

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Швидкість каталазної реакції від концентрації субстрату");
    const ch2 = UI.chart(row, "Температурна крива активності ферменту");
    const tb = h("div", { class: "tblwrap" }); below.append(h("div", { class: "chart" }, h("h4", null, "Таблиця 8.1 · активність у балах (модельна)"), tb));
    function table() {
      const old = [S.obj, S.T, S.boiled];
      const rows = OBJ.map((x, i) => { const vc = S.boiled ? 0 : x.cat * fT(S.T) * (3 * MOLAR) / (KmCat + 3 * MOLAR), vp = S.boiled ? 0 : x.per * fT(S.T); return `<tr${i === S.obj ? ' style="background:var(--chl-soft)"' : ""}><td>${x.name}</td><td class="n">${score(vp, [0.15, 0.6, 1.3, 2.2])}</td><td class="n">${score(vc, [0.12, 0.5, 1.1, 1.9])}</td></tr>`; });
      tb.innerHTML = `<table class="t"><thead><tr><th>Об'єкт</th><th>Пероксидаза, бал</th><th>Каталаза, бал</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
    }
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear();
      const tw = Math.min(70, W * .13), th = H * .74, top = H * .14;
      const x1 = W * .28 - tw / 2, x2 = W * .72 - tw / 2;
      const ext = Spectral.colorOf({ chlA: S.obj >= 5 ? 0.25 : 0, car: S.obj === 4 ? 0.25 : 0, betanin: 0.0 }, .5);
      // catalase tube with foam
      Draw.tube(c, x1, top, tw, th, [{ frac: 1, color: S.obj >= 5 ? ext : (Theme.dark ? "rgba(200,210,190,.25)" : "rgba(235,232,210,.9)") }], { fill: .38, label: "каталаза",
        after: (cc, surf) => {
          const fh = clamp(S.foam, 0, 1) * th * .58;
          const g = cc.createLinearGradient(0, surf - fh, 0, surf); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(235,240,235,.75)");
          cc.fillStyle = g; cc.fillRect(x1, surf - fh, tw, fh + 1);
          const r = rng(9 + Math.floor(time * 4)); cc.strokeStyle = "rgba(150,160,150,.5)";
          for (let k = 0; k < fh * tw / 60; k++) { cc.beginPath(); cc.arc(x1 + r() * tw, surf - r() * fh, 1.5 + r() * 3.5, 0, 7); cc.stroke(); }
          for (const b of S.bub) { cc.beginPath(); cc.arc(x1 + b.x * tw, b.y, b.r, 0, 7); cc.strokeStyle = "rgba(255,255,255,.85)"; cc.stroke(); }
        } });
      // peroxidase tube: colourless → blue (benzidine blue) → brownish
      const bl = S.blue, brown = clamp((S.t - 40) / 120, 0, 1) * bl * .4;
      const pcol = Spectral.colorOf({ benzBlue: bl * 1.6 * (1 - brown), chlA: S.obj >= 5 ? 0.12 : 0, mred: brown * .6 }, 1);
      Draw.tube(c, x2, top, tw, th, [{ frac: 1, color: pcol }], { fill: .5, label: "пероксидаза" });
      // stopwatch
      Draw.text(c, `${fmt(S.t, 0)} с`, W / 2, H * .5, { align: "center", size: 18, color: T.ink, weight: 600 });
      Draw.text(c, S.t < 60 ? "пероксидазу оцінюють на 60 с" : "60 с минуло", W / 2, H * .5 + 18, { align: "center", size: 10 });
      Draw.text(c, "+ H₂O₂ 3 %", x1 + tw / 2, top - 4, { align: "center", size: 10 }); Draw.text(c, "+ H₂O₂ 0,3 % + бензидин", x2 + tw / 2, top - 4, { align: "center", size: 10 });
    }
    function charts() {
      const vm = vmaxC(); const Km = KmCat, cur = S.pct * MOLAR;
      if (!S.lb) {
        const pts = []; for (let s = 0; s <= 3; s += 0.02) pts.push([s, vm * s / (Km + s)]);
        drawChart(ch, { x: [0, 3], y: [0, Math.max(0.5, o().cat * 1.5)], xl: "[H₂O₂], моль/л", yl: "v, відн. од.", series: [{ pts, color: Theme.c.chl, w: 2.2, fill: rgba(Theme.c.chl, .08) }], hl: [{ y: vm, label: "V_max", color: Theme.c.muted }, { y: vm / 2, label: "V_max/2", color: Theme.c.muted }], vl: [{ x: Km, label: "K_m", color: Theme.c.muted }], marks: [{ x: cur, y: vm * cur / (Km + cur), color: Theme.c.antho, label: `${fmt(S.pct, 1)} %` }] });
      } else {
        const pts = []; for (let x = 0.3; x <= 12; x += 0.1) pts.push([x, (Km / Math.max(vm, 1e-3)) * x + 1 / Math.max(vm, 1e-3)]); pts.unshift([-1 / Km, 0]);
        drawChart(ch, { x: [-5, 12], y: [0, Math.max(...pts.map(p => p[1])) * 1.05], xl: "1/[S], л/моль", yl: "1/v", series: [{ pts, color: Theme.c.chl, w: 2.2 }], vl: [{ x: 0, color: Theme.c.muted }], marks: [{ x: -1 / Km, y: 0, color: Theme.c.antho, label: "−1/K_m" }, { x: 0, y: 1 / Math.max(vm, 1e-3), color: Theme.c.data, label: "1/V_max" }] });
      }
      const tp = []; for (let T = 0; T <= 80; T += 1) tp.push([T, fT(T)]);
      drawChart(ch2, { x: [0, 80], y: [0, Math.max(...tp.map(p => p[1])) * 1.1], xl: "температура, °C", yl: "f(T)", series: [{ pts: tp, color: Theme.c.carot, w: 2.2, fill: rgba(Theme.c.carot, .1) }], marks: [{ x: S.T, y: fT(S.T), color: Theme.c.antho }], vl: [{ x: 50, label: "T_m ≈ 50 °C", color: Theme.c.muted, align: "right" }] });
      table();
    }
    function simStep(sdt, top, th, dt) {
      S.t += sdt;
      const vc = vmaxC() * S.S / (KmCat + S.S); S.S = Math.max(0, S.S - vc * 0.004 * sdt); S.o2 += vc * sdt;
      S.foam += (vc * 0.01 - S.foam * 0.025) * sdt; S.peakFoam = Math.max(S.peakFoam, S.foam);
      if (top != null && Math.random() < vc * dt * 6) S.bub.push({ x: .15 + Math.random() * .7, y: top + th - 6, r: 1 + Math.random() * 2.5 });
      const vp = vmaxP(); S.blue = Math.min(1.2, S.blue + vp * 0.012 * sdt * (1 - S.blue / 1.25));
      if (S.t > 240) S.play = false;
    }
    for (let k = 0; k < 900; k++) simStep(0.1); // rest state: 90 s after adding reagents
    return {
      stages: [st, ch, ch2],
      frame(dt, time) {
        const H = st.H, th = H * .74, top = H * .14;
        if (S.play) { simStep(dt * 2, top, th, dt);
        }
        const surf = top + th - th * .38; S.bub.forEach(b => b.y -= 60 * dt); S.bub = S.bub.filter(b => b.y > surf - 4);
        draw(time);
        const vc = vmaxC() * S.S / (KmCat + S.S);
        rd.set("t", fmt(S.t, 0)); rd.set("vc", fmt(vc, 2)); rd.set("sc", score(S.peakFoam, [0.06, 0.22, 0.45, 0.75])); rd.set("vp", fmt(vmaxP(), 2)); rd.set("sp", S.t >= 60 ? score(vmaxP(), [0.15, 0.6, 1.3, 2.2]) : "…"); rd.set("f", fmt(fT(S.T), 2));
        if (ch.dirty) { charts(); ch.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Що виявляємо</h3>
<ul><li><b>Каталаза</b> (залізопорфіриновий фермент пероксисом): 2H₂O₂ → 2H₂O + O₂↑. Активність видно за об'ємом піни з бульбашок кисню.</li><li><b>Пероксидаза:</b> окиснює феноли й ароматичні аміни киснем пероксиду: AH₂ + H₂O₂ → A + 2H₂O. Бензидин окиснюється до синього продукту.</li></ul>
<h3>Рівняння Міхаеліса–Ментен</h3>
<div class="eq"><var>v</var> = <span class="fr"><span><var>V</var><sub>max</sub>·[<var>S</var>]</span><span><var>K</var><sub>m</sub> + [<var>S</var>]</span></span></div>
<dl class="vars"><dt>V<sub>max</sub></dt><dd>гранична швидкість; пропорційна кількості ферменту в наважці</dd><dt>K<sub>m</sub></dt><dd>концентрація субстрату, за якої v = V<sub>max</sub>/2; для каталази дуже висока (десятки–сотні ммоль/л), для пероксидази — одиниці ммоль/л</dd></dl>
<p>Лінеаризація Лайнуівера–Берка: 1/<var>v</var> = (<var>K</var><sub>m</sub>/<var>V</var><sub>max</sub>)·(1/[<var>S</var>]) + 1/<var>V</var><sub>max</sub>. Перетин з віссю абсцис дає −1/<var>K</var><sub>m</sub>.</p>
<p>3 % H₂O₂ ≈ 0,88 моль/л: каталаза працює далеко не на насиченні, тому піна сильно залежить від концентрації пероксиду.</p>
<h3>Температура</h3>
<div class="eq"><var>f</var>(<var>T</var>) = e<sup>−<var>E</var><sub>a</sub>/<var>RT</var></sup> · <span class="fr"><span>1</span><span>1 + e<sup>Δ<var>H</var><sub>d</sub>/<var>R</var>·(1/<var>T</var><sub>m</sub> − 1/<var>T</var>)</sup></span></span></div>
<p>До ~40 °C активність росте (Арреніус, E<sub>a</sub> ≈ 40 кДж/моль), вище — фермент денатурує. Прокип'ячена витяжка — негативний контроль: піни й посиніння немає.</p>
<h3>Як читати бали</h3>
<p>Модель переводить висоту піни та швидкість посиніння в 4-бальну шкалу методики. Відносні активності об'єктів у моделі ілюстративні: вони показують типову закономірність (проросле насіння ≫ сухе, бульби й молоді листки — високі), а не виміряні значення.</p>
<div class="fix"><b>Безпека.</b> Бензидин — канцероген. У сучасних практикумах його замінюють гваяколом (дає оранжево-коричневий тетрагваякол) або ТМБ. Також у посібнику дегідрогенази помилково описано як ферменти, що «активують і переносять кисень»: вони відщеплюють і переносять водень.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Де дихання найінтенсивніше?</summary><p>У тканинах, що активно ростуть і діляться: бруньки, квітки, верхівки коренів, молоді листки. Найслабше — у запасаючій паренхімі та сухому насінні.</p></details>
<details class="qa"><summary>Навіщо низька температура в овочесховищі?</summary><p>За правилом Вант-Гоффа (Q₁₀ ≈ 2–3) кожні −10 °C уповільнюють дихання у 2–3 рази — менше витрачаються цукри.</p></details>
<details class="qa"><summary>Чому горобина солодшає після морозів?</summary><p>На холоді крохмаль гідролізується до цукрів (захисна реакція), а дихання, що їх витрачає, сповільнене; руйнуються й гіркі глікозиди.</p></details>`,
});
/* ============ ЛР 9. Мікрохімічний аналіз золи ============ */
App.add({
  n: 9, short: "Мікрохімічний аналіз золи", tag: "дифузія · нуклеація · Ksp",
  title: "Мікрохімічний аналіз золи рослин",
  model: "∂c/∂t = D·∂²c/∂x² − R_осад · S = ІДР/K_sp · J = J₀·exp(−B/ln²S) (класична теорія нуклеації)",
  build({ stageBox, ctrls, below }) {
    const EL = {
      K: { name: "Калій K⁺", ext: "water", reag: "NaHC₄H₄O₆ 1 %", B0: 0.058, Ksp: 3.8e-4, Bn: 2.2, shape: "prism", prod: "KHC₄H₄O₆ — призми й пластинки", eq: "NaHC₄H₄O₆ + K⁺ → KHC₄H₄O₆↓ + Na⁺", c0: 0.06 },
      Ca: { name: "Кальцій Ca²⁺", ext: "hcl", reag: "H₂SO₄ 1 %", B0: 0.10, Ksp: 3.1e-5, Bn: 14, shape: "needle", prod: "CaSO₄·2H₂O (гіпс) — голки, пучки", eq: "CaCl₂ + H₂SO₄ → CaSO₄↓ + 2HCl", c0: 0.02 },
      Mg: { name: "Магній Mg²⁺", ext: "hcl", reag: "NH₄OH + Na₂HPO₄ 1 %", B0: 0.07, Ksp: 2.5e-13, NH4: 0.4, Bn: 1100, shape: "coffin", prod: "NH₄MgPO₄·6H₂O — «труни», зірочки, крила", eq: "MgCl₂ + NH₄OH + Na₂HPO₄ → NH₄MgPO₄↓ + 2NaCl + H₂O", c0: 0.012 },
      P: { name: "Фосфор (PO₄³⁻)", ext: "hcl", reag: "(NH₄)₂MoO₄ 1 % у HNO₃", B0: 0.051, Ksp: 1e-9, Bn: 40, shape: "granule", prod: "(NH₄)₃PO₄·12MoO₃ — жовті грудочки", eq: "H₃PO₄ + 12(NH₄)₂MoO₄ + 21HNO₃ → (NH₄)₃PO₄·12MoO₃↓ + 21NH₄NO₃ + 12H₂O", c0: 0.01 },
      S: { name: "Сірка (SO₄²⁻)", ext: "hcl", reag: "Sr(NO₃)₂ 1 %", B0: 0.047, Ksp: 3.4e-7, Bn: 55, shape: "rhomb", prod: "SrSO₄ — дрібні кристали", eq: "Na₂SO₄ + Sr(NO₃)₂ → SrSO₄↓ + 2NaNO₃", c0: 0.006 },
      Cl: { name: "Хлор Cl⁻", ext: "water", reag: "AgNO₃ 1 %", B0: 0.059, Ksp: 1.8e-10, Bn: 8, shape: "curd", prod: "AgCl — сирнистий осад", eq: "NaCl + AgNO₃ → AgCl↓ + NaNO₃", c0: 0.008 },
      Fe: { name: "Залізо Fe³⁺", ext: "any", reag: "K₄[Fe(CN)₆] 1 %", B0: 0.027, Ksp: 1e-12, Bn: 4, shape: "blue", prod: "Fe₄[Fe(CN)₆]₃ — берлінська лазур", eq: "4FeCl₃ + 3K₄[Fe(CN)₆] → Fe₄[Fe(CN)₆]₃↓ + 12KCl", c0: 0.002 },
    };
    const N = 120, D = 0.0009, J0 = 2.2, kp = 0.9;
    const S = { el: "K", ext: "water", c0: 1, mode: "bridge", td: 165, t: 0, A: [], B: [], P: [], X: [], play: true, speed: 1 };
    const e = () => EL[S.el];
    function effKsp() { let k = e().Ksp; if (S.el === "K" && S.ext === "hcl") k *= 400; return k; } // tartrate dissolves in acid
    function srcA() { let c = e().c0 * S.c0; if (S.el === "Ca" && S.ext === "water") c *= 0.05; if (S.el === "Mg" && S.ext === "water") c *= 0.1; if (S.el === "P" && S.ext === "water") c *= 0.3; return c; }
    function falseB() { return S.el === "Cl" && S.ext === "hcl" ? 1.2 : 0; } // HCl brings its own Cl⁻
    function reset() {
      const a = srcA(), b = e().B0, fa = falseB();
      S.A = []; S.B = []; S.P = new Float32Array(N); S.X = []; S.t = 0;
      for (let i = 0; i < N; i++) {
        const x = i / (N - 1);
        if (S.mode === "merge") { S.A.push(x < .82 ? (a + fa) / 2 : 0); S.B.push(x > .18 ? b / 2 : 0); }
        else { S.A.push(x < .3 ? a + fa : 0); S.B.push(x > .7 ? b : 0); }
      }
      S.play = true; ch.dirty = true;
    }
    function runAll() { while (S.t < S.td * 0.91) { const tot = 0.5, sub = Math.ceil(tot * D * (N - 1) ** 2 / 0.4); for (let k = 0; k < sub; k++) step(tot / sub); } S.play = false; ch.dirty = true; }
    const evap = () => 1 / Math.max(0.1, 1 - S.t / S.td); // the drop dries on the flame → ions concentrate
    const iap = (A, B) => { const f = evap(); return (S.el === "Mg" ? A * B * e().NH4 : A * B) * f * f; };
    function step(dt) {
      const A = S.A, B = S.B, dx = 1 / (N - 1), k = D * dt / (dx * dx); // explicit, k must be < .5
      const nA = A.slice(), nB = B.slice();
      for (let i = 0; i < N; i++) { const l = i ? i - 1 : 1, r = i < N - 1 ? i + 1 : N - 2; nA[i] += k * (A[l] - 2 * A[i] + A[r]); nB[i] += k * (B[l] - 2 * B[i] + B[r]); }
      const Ksp = effKsp(), Bn = e().Bn, r = Math.random;
      const buckets = Array.from({ length: N }, () => []); for (const c of S.X) buckets[c.i].push(c);
      for (let i = 0; i < N; i++) {
        const Sx = iap(nA[i], nB[i]) / Ksp; if (Sx <= 1) continue;
        const ls = Math.log(Sx);
        // nucleation (Poisson)
        const J = J0 * Math.exp(-Bn / (ls * ls)) * dt;
        if (r() < J && S.X.length < 900) S.X.push(buckets[i][buckets[i].length] = { i, x: i / (N - 1), y: (r() * 2 - 1) * (i / (N - 1) < .3 || i / (N - 1) > .7 ? .9 : .55), ang: r() * Math.PI, m: 1e-6, born: S.t, j: r() });
        // growth onto existing crystals in this cell (or slow homogeneous loss)
        const here = buckets[i]; if (!here.length) continue;
        const rate = kp * (Math.sqrt(iap(nA[i], nB[i])) - Math.sqrt(Ksp)) * Math.min(1, here.length * .35);
        const dm = Math.min(rate * dt / evap(), nA[i] * .5, nB[i] * .5); if (dm <= 0) continue;
        nA[i] -= dm; nB[i] -= dm; S.P[i] += dm;
        const tot = here.reduce((s, c) => s + Math.cbrt(c.m) ** 2, 0) || 1;
        for (const c of here) c.m += dm * (Math.cbrt(c.m) ** 2) / tot;
      }
      S.A = nA; S.B = nB; S.t += dt;
    }

    const st = new Stage(stageBox, { aspect: 1.65, minH: 260, maxH: 440, tag: "Предметне скло · сухий препарат · ×100" });
    const rd = UI.reads(stageBox, [["S", "Макс. пересичення S"], ["n", "Кристалів"], ["sz", "Середній розмір"], ["pr", "Продукт"]]);
    const elSel = UI.select(ctrls, { id: "l9-el", label: "Елемент", value: S.el, options: Object.entries(EL).map(([k, o]) => [k, o.name]), on: v => { S.el = v; S.ext = EL[v].ext === "hcl" ? "hcl" : "water"; extSeg.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === S.ext))); reset(); info(); } });
    const extSeg = UI.seg(ctrls, { label: "Витяжка золи", value: S.ext, options: [["water", "водна"], ["hcl", "солянокисла"]], on: v => { S.ext = v; reset(); info(); } });
    extSeg[0].dataset.v = "water"; extSeg[1].dataset.v = "hcl";
    UI.slider(ctrls, { id: "l9-c", label: "Вміст елемента в золі", min: 0.2, max: 3, step: 0.1, value: 1, unit: "× типовий", fmt: v => fmt(v, 1), on: v => { S.c0 = v; reset(); } });
    UI.seg(ctrls, { label: "Як з'єднати краплі", value: "bridge", options: [["bridge", "скляним містком"], ["merge", "злити одразу"]], on: v => { S.mode = v; reset(); } });
    UI.seg(ctrls, { label: "Підсушування над полум'ям", value: "slow", options: [["slow", "високо, повільно"], ["fast", "низько, швидко"]], on: v => { S.td = v === "slow" ? 165 : 25; reset(); } });
    UI.buttons(ctrls, [{ label: "Нове скло", pri: true, on: reset }]);
    const msg = h("div", { class: "note" }); ctrls.append(msg);
    function info() {
      const o = e(); let w = "";
      if (o.ext !== "any" && S.ext !== o.ext) w = `<span class="pill warn">не та витяжка</span> `;
      if (S.el === "K" && S.ext === "hcl") w += "Кислий тартрат калію розчиняється в кислоті — кристалів не буде.";
      else if (S.el === "Cl" && S.ext === "hcl") w += "Соляна кислота сама містить Cl⁻: осад буде навіть без хлору в золі (хибний позитив).";
      else if ((S.el === "Ca" || S.el === "Mg") && S.ext === "water") w += "Карбонати й фосфати Ca, Mg у воді майже не розчиняються — у водній витяжці їх мало.";
      msg.innerHTML = `<b>${o.reag}</b><br><span class="mono" style="font-size:11.5px">${o.eq}</span><br>${w}`;
    }

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Профілі концентрацій і пересичення вздовж містка");
    const ch2 = UI.chart(row, "Розподіл кристалів за розміром");

    function crystal(c, x, y, s, cr) {
      const T = Theme.c; c.save(); c.translate(x, y); c.rotate(cr.ang);
      const edge = Theme.dark ? "rgba(220,230,220,.9)" : "rgba(40,50,45,.85)", face = Theme.dark ? "rgba(200,220,210,.12)" : "rgba(255,255,255,.55)";
      c.lineWidth = 1; c.strokeStyle = edge; c.fillStyle = face;
      switch (e().shape) {
        case "prism": { const L = s * 2.4, w = s * (0.7 + cr.j * .5); c.beginPath(); c.moveTo(-L / 2, 0); c.lineTo(-L / 2 + w * .5, -w / 2); c.lineTo(L / 2 - w * .5, -w / 2); c.lineTo(L / 2, 0); c.lineTo(L / 2 - w * .5, w / 2); c.lineTo(-L / 2 + w * .5, w / 2); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-L / 2 + w * .5, -w / 2); c.lineTo(-L / 2 + w * .7, 0); c.lineTo(L / 2 - w * .3, 0); c.stroke(); break; }
        case "needle": { const n = 4 + Math.floor(cr.j * 6); for (let k = 0; k < n; k++) { const a = (k / n - .5) * (0.5 + cr.j * .5); const L = s * (2.2 + ((k * 37) % 10) / 10); c.beginPath(); c.moveTo(-Math.cos(a) * L * .5, -Math.sin(a) * L * .5); c.lineTo(Math.cos(a) * L * .5, Math.sin(a) * L * .5); c.stroke(); } break; }
        case "coffin": { if (cr.j > .7) { for (const a of [0, Math.PI / 2.4]) { c.save(); c.rotate(a); c.beginPath(); c.moveTo(-s * 1.6, 0); c.lineTo(s * 1.6, 0); for (let k = -3; k <= 3; k++) { c.moveTo(k * s * .4, 0); c.lineTo(k * s * .4 + s * .25, -s * .3); c.moveTo(k * s * .4, 0); c.lineTo(k * s * .4 + s * .25, s * .3); } c.stroke(); c.restore(); } } else { const L = s * 2, w = s * .9; c.beginPath(); c.moveTo(-L / 2, 0); c.lineTo(-L / 2 + w * .4, -w / 2); c.lineTo(L / 2 - w * .4, -w / 2); c.lineTo(L / 2, 0); c.lineTo(L / 2 - w * .4, w / 2); c.lineTo(-L / 2 + w * .4, w / 2); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-L / 2 + w * .4, -w / 2); c.lineTo(-L / 2 + w * .4, w / 2); c.moveTo(L / 2 - w * .4, -w / 2); c.lineTo(L / 2 - w * .4, w / 2); c.stroke(); } break; }
        case "granule": { c.fillStyle = "rgba(214,190,40,.85)"; c.strokeStyle = "rgba(140,120,10,.9)"; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc((k - 1) * s * .5, ((k * 7) % 3 - 1) * s * .3, s * .45, 0, 7); c.fill(); c.stroke(); } break; }
        case "rhomb": { c.beginPath(); c.moveTo(-s, 0); c.lineTo(0, -s * .55); c.lineTo(s, 0); c.lineTo(0, s * .55); c.closePath(); c.fill(); c.stroke(); break; }
        case "curd": { const age = clamp((S.t - cr.born) / 60, 0, 1); c.fillStyle = mixHex("#F4F4F0", "#8E7AA0", age * .5); c.strokeStyle = "rgba(120,120,120,.5)"; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(Math.cos(k * 1.7) * s * .5, Math.sin(k * 2.3) * s * .5, s * .55, 0, 7); c.fill(); } break; }
        case "blue": { c.fillStyle = "rgba(25,60,160,.75)"; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(Math.cos(k * 1.9) * s * .6, Math.sin(k * 2.2) * s * .6, s * .6, 0, 7); c.fill(); } break; }
      }
      c.restore();
    }
    function draw() {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear(Theme.dark ? "#050706" : "#1b1d1a");
      const R = Math.min(W, H) * .48, cx = W / 2, cy = H / 2;
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
      c.fillStyle = Theme.dark ? "#1c2420" : "#EEF0E8"; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      // field shows x from .1 to .9 of the slide
      const X = (x) => cx - R + (x - .1) / .8 * 2 * R, band = R * .55;
      // dried drop outlines
      c.strokeStyle = rgba(T.ink, .18); c.lineWidth = 2;
      c.beginPath(); c.ellipse(X(.15), cy, (X(.3) - X(0)) , band * 1.6, 0, 0, 7); c.stroke();
      c.beginPath(); c.ellipse(X(.85), cy, (X(1) - X(.7)), band * 1.6, 0, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(X(.3), cy - band); c.lineTo(X(.7), cy - band); c.moveTo(X(.3), cy + band); c.lineTo(X(.7), cy + band); c.stroke();
      // faint concentration tint of reagent/ion
      for (let i = 0; i < N; i++) { const x = i / (N - 1); const a = S.A[i] / (srcA() + falseB() + 1e-9), b = S.B[i] / e().B0; c.fillStyle = `rgba(80,140,200,${b * .035})`; c.fillRect(X(x), cy - band * 1.4, (2 * R / .8) / N + 1, band * 2.8); c.fillStyle = `rgba(200,140,60,${a * .035})`; c.fillRect(X(x), cy - band * 1.4, (2 * R / .8) / N + 1, band * 2.8); }
      for (const cr of S.X) { const s = clamp(Math.cbrt(cr.m) * 70, 1.2, 26); crystal(c, X(cr.x + (cr.j - .5) / N), cy + cr.y * band, s, cr); }
      c.restore();
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.lineWidth = 3; c.strokeStyle = "#000"; c.stroke(); c.lineWidth = 1;
      Draw.text(c, "витяжка", X(.2), cy + band * 1.75, { align: "center", color: "#aaa", size: 10 }); Draw.text(c, "реактив", X(.8), cy + band * 1.75, { align: "center", color: "#aaa", size: 10 });
    }
    function charts() {
      const Ksp = effKsp(), a0 = srcA() + falseB() + 1e-12, b0 = e().B0;
      const xs = S.A.map((_, i) => i / (N - 1));
      const lS = S.A.map((a, i) => Math.max(0, Math.log10(Math.max(1e-30, iap(a, S.B[i]) / Ksp))));
      const mx = Math.max(1, ...lS);
      drawChart(ch, { x: [0, 1], y: [0, 1.05], xl: "положення на склі (0 — витяжка, 1 — реактив)", yl: "частка / lg S ÷ max",
        band: [{ x0: .3, x1: .7, color: rgba(Theme.c.chl, .06) }],
        series: [{ pts: xs.map((x, i) => [x, S.A[i] / a0]), color: Theme.c.carot, w: 2 }, { pts: xs.map((x, i) => [x, S.B[i] / b0]), color: Theme.c.data, w: 2 }, { pts: xs.map((x, i) => [x, lS[i] / mx]), color: Theme.c.antho, w: 2, dash: [5, 3] }],
        legend: [{ label: "іон", color: Theme.c.carot }, { label: "реактив", color: Theme.c.data }, { label: `lg S (макс ${fmt(mx, 1)})`, color: Theme.c.antho }] });
      const sizes = S.X.map(c => clamp(Math.cbrt(c.m) * 70, 1.2, 26)); const bins = new Array(13).fill(0); for (const s of sizes) bins[Math.min(12, Math.floor(s / 2))]++;
      drawChart(ch2, { x: [0, 26], y: [0, Math.max(5, ...bins) * 1.1], xl: "розмір кристала, пікс. поля зору", yl: "кількість", series: [{ pts: bins.map((v, i) => [i * 2 + 1, v]), bars: true, color: rgba(Theme.c.chl, .7), bw: (ch2.W - 60) / 13 * .8 }] });
    }
    reset(); runAll(); info();
    let acc = 0;
    return {
      stages: [st, ch, ch2],
      frame(dt) {
        if (S.play) { const tot = dt * S.td * 0.91 / 18, sub = Math.max(1, Math.ceil(tot * D * (N - 1) ** 2 / 0.4)); for (let k = 0; k < sub; k++) step(tot / sub); if (S.t > S.td * 0.91) S.play = false; acc += dt; if (acc > .2) { ch.dirty = true; acc = 0; } }
        draw();
        const Ksp = effKsp(); let mxS = 0; for (let i = 0; i < N; i++) mxS = Math.max(mxS, iap(S.A[i], S.B[i]) / Ksp);
        const sz = S.X.length ? S.X.reduce((s, c) => s + clamp(Math.cbrt(c.m) * 70, 1.2, 26), 0) / S.X.length : 0;
        rd.set("S", mxS > 1e4 ? "10^" + fmt(Math.log10(mxS), 1) : fmt(mxS, 1)); rd.set("n", S.X.length); rd.set("sz", S.X.length ? fmt(sz, 1) : "—", "пікс."); rd.set("pr", S.X.length ? e().prod.split(" — ")[0] : "немає осаду");
        if (ch.dirty) { charts(); ch.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Склад золи</h3>
<p>При спалюванні C, H, O, N відходять у вигляді газів; у золі лишаються зольні елементи (≈ 5 % сухої маси, у листках 10–15 %, у деревині ≈ 1 %). Мікрохімічний метод розпізнає елемент за формою і кольором кристалів продукту реакції.</p>
<h3>Чому кристали з'являються саме в містку</h3>
<p>Іон з витяжки і реактив дифундують назустріч (друге рівняння Фіка):</p>
<div class="eq">∂<var>c</var>/∂<var>t</var> = <var>D</var>·∂²<var>c</var>/∂<var>x</var>² − <var>R</var><sub>осад</sub></div>
<p>Осад можливий лише там, де добуток активностей іонів перевищує добуток розчинності:</p>
<div class="eq"><var>S</var> = <span class="fr"><span>[<var>A</var>]·[<var>B</var>]</span><span><var>K</var><sub>sp</sub></span></span> &gt; 1</div>
<h3>Великі кристали чи дрібний осад</h3>
<p>Швидкість утворення зародків (класична теорія нуклеації):</p>
<div class="eq"><var>J</var> = <var>J</var>₀·exp(−<span class="fr"><span><var>B</var></span><span>ln²<var>S</var></span></span>)</div>
<p>При невеликому пересиченні зародків мало, і кожен довго росте — виходять великі типові кристали. Якщо S зростає різко (краплі злили одразу, скло тримали низько над полум'ям і крапля висохла за секунди), виникає безліч зародків, і речовини на кожен не вистачає — дрібні нетипові кристали. Тому методика вимагає з'єднувати краплі скляною паличкою і підсушувати повільно, високо над полум'ям. Висихання в моделі підвищує концентрації як 1/(1 − t/t<sub>сух</sub>). Порівняйте режими й подивіться на гістограму розмірів.</p>
<h3>Яку витяжку брати</h3>
<ul><li><b>Водну:</b> K⁺ (тартрат розчиняється в кислоті) і Cl⁻ (HCl сама дає Cl⁻).</li><li><b>Солянокислу:</b> Ca, Mg, P, S — їхні сполуки в золі нерозчинні у воді.</li><li><b>Будь-яку:</b> Fe³⁺.</li></ul>
<div class="fix"><b>Уточнення до посібника.</b> Сульфат стронцію — SrSO₄ (не Sr₂SO₄). На рис. 9.2 А зображено кристали кислого тартрату <i>калію</i>, а не натрію. Жовта кров'яна сіль — K₄[Fe(CN)₆], вона виявляє Fe³⁺ (у таблиці стоїть Fe²⁺). AgCl — білий сирнистий осад, що темніє на світлі (світло-жовтий — AgBr). У переліку макроелементів зайве Fe і Na (Fe — мікроелемент). K<sub>sp</sub> для фосфорномолібдату й берлінської лазурі в моделі умовні.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому органічні добрива вносять заздалегідь і великими дозами?</summary><p>Елементи в них зв'язані в органічній формі; доступними вони стають лише після мінералізації мікроорганізмами, а концентрація елементів невелика.</p></details>
<details class="qa"><summary>Де більше золи — у деревині чи листках?</summary><p>У листках (10–15 %), особливо зрілих: там накопичуються Ca і Si, а живі клітини мезофілу багаті K, Mg, P. Деревина складається переважно з мертвих стінок (~1 %).</p></details>
<details class="qa"><summary>Як виростити рослину без ґрунту?</summary><p>Гідропоніка: збалансований поживний розчин (Кноп, Гоґленд) з макро- і мікроелементами, аерація коренів, pH 5,5–6,5, світло, опора.</p></details>`,
});
/* ============ ЛР 10. Нітрати в рослинному матеріалі ============ */
App.add({
  n: 10, short: "Нітрати в рослинах", tag: "дифузія з пластини (Кранк)",
  title: "Виявлення нітратів у рослинному матеріалі",
  model: "бал ↔ мг/кг: лог-інтерполяція шкали · вимочування/варіння: Mₜ/M₀ = Σ 8/((2n+1)²π²)·exp(−D(2n+1)²π²t/L²)",
  build({ stageBox, ctrls, below }) {
    const PR = [
      { name: "Капуста рання (качан)", mdr: 900, ex: 700, col: "#DCE8B8" },
      { name: "Капуста пізня (качан)", mdr: 500, ex: 380, col: "#E8EFCB" },
      { name: "Картопля (бульба)", mdr: 250, ex: 160, col: "#EFE3B5" },
      { name: "Морква рання (коренеплід)", mdr: 400, ex: 300, col: "#F0A040" },
      { name: "Морква пізня (коренеплід)", mdr: 250, ex: 190, col: "#EC9A35" },
      { name: "Буряк столовий (коренеплід)", mdr: 1400, ex: 1300, col: "#8E1F48" },
      { name: "Огірок, відкритий ґрунт", mdr: 150, ex: 120, col: "#D7E6B0" },
      { name: "Огірок, захищений ґрунт", mdr: 400, ex: 420, col: "#D7E6B0" },
      { name: "Томат, відкритий ґрунт", mdr: 150, ex: 90, col: "#E0503A" },
      { name: "Салат листовий", mdr: 2000, ex: 2400, col: "#8DBE5A" },
      { name: "Петрушка (зелень)", mdr: 2000, ex: 1500, col: "#4E8F3A" },
      { name: "Кріп (зелень)", mdr: 2000, ex: 1300, col: "#5A9A44" },
    ];
    const TR = { none: { name: "без обробки", D: 0, t: 0 }, s1: { name: "вимочування 1 год", D: 1.0e-10, t: 3600 }, s24: { name: "вимочування 24 год", D: 1.0e-10, t: 86400 }, b5: { name: "варіння 5 хв", D: 2.5e-9, t: 300 }, b15: { name: "варіння 15 хв", D: 2.5e-9, t: 900 } };
    const S = { p: 0, c0: PR[0].ex, tr: "none", L: 8, ratio: 3, t: 120, play: false };
    const CAL = [[0, 0], [100, 1], [250, 2], [500, 3], [1000, 4], [3000, 5], [6000, 6]];
    function toScore(c) { if (c <= 0) return 0; if (c < 100) return c / 100; for (let i = 1; i < CAL.length - 1; i++) { const [a, sa] = CAL[i], [b, sb] = CAL[i + 1]; if (c <= b) return sa + (sb - sa) * Math.log(c / a) / Math.log(b / a); } return 6; }
    function remain(tr, t) { // fraction left in a slab of thickness L (mm), both faces open, partition with water volume
      const T = TR[tr]; if (!T.D || t <= 0) return 1;
      const L = S.L * 1e-3; let s = 0; for (let n = 0; n < 40; n++) { const m = 2 * n + 1; s += 8 / (m * m * Math.PI * Math.PI) * Math.exp(-T.D * m * m * Math.PI * Math.PI * t / (L * L)); }
      const feq = 1 / (1 + S.ratio); return feq + (1 - feq) * s;
    }
    const cNow = () => S.c0 * remain(S.tr, TR[S.tr].t);
    // colour development after adding diphenylamine: rise, then fade for low scores
    function blueAt(score, t) { const tauF = score >= 5 ? 1e9 : score >= 4 ? 600 : score >= 3 ? 150 : score >= 2 ? 60 : 30; return (score / 6) * (1 - Math.exp(-t / (score >= 4 ? 8 : 20))) * Math.exp(-t / tauF); }

    const st = new Stage(stageBox, { aspect: 1.75, minH: 250, maxH: 420, tag: "Чашка Петрі · дифеніламін у H₂SO₄" });
    const rd = UI.reads(stageBox, [["c", "Вміст нітратів"], ["mdr", "МДР"], ["sc", "Бал"], ["s2", "Як виглядає"], ["loss", "Втрати при обробці"], ["v", "Висновок"]]);
    UI.select(ctrls, { id: "l10-p", label: "Об'єкт", value: S.p, options: PR.map((x, i) => [i, x.name]), on: v => { S.p = +v; cS.set(PR[S.p].ex); S.c0 = PR[S.p].ex; restart(); } });
    const cS = UI.slider(ctrls, { id: "l10-c", label: "Вміст у свіжому зразку", min: 0, max: 5000, step: 10, value: S.c0, unit: "мг/кг", on: v => { S.c0 = v; restart(); } });
    UI.select(ctrls, { id: "l10-tr", label: "Обробка", value: S.tr, options: Object.entries(TR).map(([k, o]) => [k, o.name]), on: v => { S.tr = v; restart(); } });
    UI.slider(ctrls, { id: "l10-L", label: "Товщина шматочків", min: 2, max: 40, step: 1, value: S.L, unit: "мм", on: v => { S.L = v; restart(); } });
    UI.slider(ctrls, { id: "l10-r", label: "Вода : овочі (за об'ємом)", min: 1, max: 10, step: 0.5, value: S.ratio, unit: ": 1", fmt: v => fmt(v, 1), on: v => { S.ratio = v; restart(); } });
    UI.buttons(ctrls, [{ label: "Нанести дифеніламін", pri: true, on: () => { S.t = 0; S.play = true; } }]);
    function restart() { S.t = 0; S.play = true; ch.dirty = true; }

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Частка нітратів, що лишилась, під час обробки");
    const ch2 = UI.chart(row, "Калібрувальна шкала: бал → мг/кг сирої маси");

    let tex = null, tk = "";
    function mash(w, hh, col) { const cv = document.createElement("canvas"); cv.width = w; cv.height = hh; const c = cv.getContext("2d"); const r = rng(21); c.fillStyle = col; c.fillRect(0, 0, w, hh); for (let i = 0; i < w * hh / 18; i++) { c.fillStyle = `rgba(${r() < .5 ? "255,255,255" : "0,0,0"},${r() * .12})`; c.beginPath(); c.arc(r() * w, r() * hh, 1 + r() * 4, 0, 7); c.fill(); } return cv; }
    function draw() {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear();
      const R = Math.min(W * .3, H * .44), cx = W * .33, cy = H / 2;
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = Theme.dark ? "#1b231e" : "#FFFFFF"; c.fill(); c.lineWidth = 3; c.strokeStyle = rgba(T.ink, .2); c.stroke(); c.lineWidth = 1;
      const key = PR[S.p].col + Math.round(R); if (key !== tk) { tex = mash(Math.ceil(R * 1.3), Math.ceil(R * 1.3), PR[S.p].col); tk = key; }
      c.save(); c.beginPath();
      for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 2, rr = R * .62 * (1 + .08 * Math.sin(a * 5) + .05 * Math.cos(a * 3)); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; k ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.closePath(); c.clip(); c.drawImage(tex, cx - R * .65, cy - R * .65);
      const sc = toScore(cNow()), b = S.play || S.t > 0 ? blueAt(sc, S.t) : 0;
      const spread = clamp(S.t / 6, 0, 1);
      if (S.t > 0) { // diphenylamine wets the mash; blue appears where nitrates are
        const g = c.createRadialGradient(cx, cy, 2, cx, cy, R * .7 * spread + 4);
        const blue = Spectral.colorOf({ dpaBlue: 0.3 + b * 2.4 }, 1, true);
        g.addColorStop(0, `rgba(${blue[0]},${blue[1]},${blue[2]},${clamp(b * 1.6, 0, .95)})`); g.addColorStop(.85, `rgba(${blue[0]},${blue[1]},${blue[2]},${clamp(b * 1.3, 0, .9)})`); g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
        if (sc < 0.5) { c.fillStyle = `rgba(230,120,160,${0.25 * spread})`; c.fillRect(cx - R, cy - R, 2 * R, 2 * R); }
        if (sc >= 1.5 && sc < 2.5) { c.strokeStyle = `rgba(40,60,170,${b * 2})`; c.lineWidth = 2; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(cx - R * .5, cy - R * .4 + k * R * .16); c.bezierCurveTo(cx - R * .1, cy - R * .5 + k * R * .16, cx + R * .1, cy - R * .3 + k * R * .16, cx + R * .5, cy - R * .4 + k * R * .16); c.stroke(); } c.lineWidth = 1; }
      }
      c.restore();
      // timer + scale cards
      const x0 = W * .64; Draw.text(c, `${Math.floor(S.t / 60)}:${String(Math.floor(S.t % 60)).padStart(2, "0")}`, x0, 34, { size: 22, color: T.ink, weight: 600 });
      Draw.text(c, "після нанесення реактиву", x0, 50, { size: 10 });
      const sw = Math.min(30, (W - x0 - 16) / 7 - 4);
      for (let k = 0; k <= 6; k++) { const x = x0 + k * (sw + 4), y = 70; c.fillStyle = k === 0 ? "rgba(230,150,180,.6)" : Spectral.colorOf({ dpaBlue: k * 0.38 }, 1); c.fillRect(x, y, sw, sw); c.strokeStyle = Math.round(sc) === k ? T.antho : rgba(T.ink, .2); c.lineWidth = Math.round(sc) === k ? 2.5 : 1; c.strokeRect(x, y, sw, sw); c.lineWidth = 1; Draw.text(c, String(k), x + sw / 2, y + sw + 13, { align: "center", size: 10 }); }
      Draw.text(c, "шкала інтенсивності (бал)", x0, 70 + sw + 30, { size: 10 });
      const mdr = PR[S.p].mdr, cc = cNow();
      const bw = W - x0 - 16, by = H - 60;
      c.fillStyle = rgba(T.ink, .08); c.fillRect(x0, by, bw, 12);
      const xm = (v) => x0 + clamp(v / (Math.max(mdr, cc, S.c0) * 1.25), 0, 1) * bw;
      c.fillStyle = cc > mdr ? T.bad : T.good; c.fillRect(x0, by, xm(cc) - x0, 12);
      c.strokeStyle = T.ink; c.beginPath(); c.moveTo(xm(mdr), by - 6); c.lineTo(xm(mdr), by + 18); c.stroke();
      Draw.text(c, `МДР ${mdr}`, xm(mdr), by + 30, { align: "center", size: 10, color: T.ink });
      Draw.text(c, `${fmt(cc, 0)} мг/кг`, x0, by - 8, { size: 11, color: T.ink });
    }
    function charts() {
      const T = TR[S.tr]; const tmax = T.t ? T.t * 1.5 : 3600;
      const scaleT = tmax > 7200 ? 3600 : 60, unit = tmax > 7200 ? "год" : "хв";
      const pts = []; for (let i = 0; i <= 120; i++) { const t = tmax * i / 120; pts.push([t / scaleT, remain(S.tr === "none" ? "s1" : S.tr, t)]); }
      drawChart(ch, { x: [0, tmax / scaleT], y: [0, 1.02], xl: `час обробки, ${unit}`, yl: "C / C₀", series: [{ pts, color: Theme.c.data, w: 2.2, fill: rgba(Theme.c.data, .08) }],
        hl: [{ y: PR[S.p].mdr / Math.max(1, S.c0), color: Theme.c.bad, label: "МДР" }, { y: 1 / (1 + S.ratio), color: Theme.c.muted, label: "рівновага з водою" }],
        vl: T.t ? [{ x: T.t / scaleT, color: Theme.c.antho, label: T.name }] : [] });
      const cp = []; for (let c = 10; c <= 6000; c *= 1.05) cp.push([c, toScore(c)]);
      drawChart(ch2, { x: [10, 6000], y: [0, 6.3], xlog: true, xl: "нітрати, мг/кг (лог. шкала)", yl: "бал", series: [{ pts: cp, color: Theme.c.data, w: 2 }], marks: [...CAL.slice(1, 6).map(([c, s]) => ({ x: c, y: s, color: Theme.c.muted, r: 3 })), { x: Math.max(10, cNow()), y: toScore(cNow()), color: Theme.c.antho, label: `${fmt(toScore(cNow()), 1)} бал` }], xfmt: v => tickFmt(v) });
    }
    ch.dirty = true;
    return {
      stages: [st, ch, ch2],
      frame(dt) {
        if (S.play) { S.t += dt * 20; if (S.t >= 360) S.play = false; }
        draw();
        const c = cNow(), sc = toScore(c), mdr = PR[S.p].mdr;
        const LOOK = ["немає синього, можливий рожевий", "сліди блакитного, швидко зникають", "зникає швидко, фарбуються пучки", "світло-синє, зникає за 2–3 хв", "синє, з'являється не одразу", "темно-синє, тримається", "синювато-чорне, стійке"];
        rd.set("c", fmt(c, 0), "мг/кг"); rd.set("mdr", mdr, "мг/кг"); rd.set("sc", fmt(sc, 1)); rd.set("s2", `<span style="font-size:12px;white-space:normal">${LOOK[Math.round(clamp(sc, 0, 6))]}</span>`);
        rd.set("loss", fmt((1 - c / Math.max(1, S.c0)) * 100, 0), "%");
        rd.set("v", c > mdr ? '<span class="pill bad">перевищує МДР</span>' : c > mdr * .8 ? '<span class="pill warn">близько до МДР</span>' : '<span class="pill good">у нормі</span>');
        if (ch.dirty) { charts(); ch.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Шлях нітрату в рослині</h3>
<div class="eq">NO₃⁻ → NO₂⁻ → NH₄⁺ → амінокислоти → білки</div>
<p>Перший крок каталізує нітратредуктаза (у цитоплазмі), другий — нітритредуктаза (у пластидах).</p>
<p>Відновлення потребує енергії (АТФ, НАД(Ф)Н, відновленого фередоксину). За нестачі вуглеводів і світла нітрати не встигають відновлюватися в коренях і накопичуються в листках, черешках, коренеплодах.</p>
<h3>Якісна реакція</h3>
<p>Дифеніламін у концентрованій H₂SO₄ окиснюється нітратом до синього продукту. Шкала методики логарифмічна: кожен наступний бал приблизно подвоює вміст.</p>
<div class="eq">бал(<var>c</var>) = <var>b</var><sub>i</sub> + <span class="fr"><span>ln(<var>c</var>/<var>c</var><sub>i</sub>)</span><span>ln(<var>c</var><sub>i+1</sub>/<var>c</var><sub>i</sub>)</span></span></div>
<p>Опорні точки: 1 бал — 100, 2 — 250, 3 — 500, 4 — 1000, 5 — 3000 мг/кг, 6 — понад 3000.</p>
<h3>Чому вимочування і варіння зменшують нітрати</h3>
<p>Нітрат-іон дифундує зі шматочка у воду. Для пластини товщиною <var>L</var> з двома відкритими гранями (розв'язок Кранка):</p>
<div class="eq"><span class="fr"><span><var>M</var><sub>t</sub></span><span><var>M</var>₀</span></span> = Σ<sub>n</sub> <span class="fr"><span>8</span><span>(2<var>n</var>+1)²π²</span></span> exp(−<span class="fr"><span><var>D</var>(2<var>n</var>+1)²π²<var>t</var></span><span><var>L</var>²</span></span>)</div>
<p>Час вимивання росте як <var>L</var>²: удвічі тонші шматочки втрачають нітрати вчетверо швидше. Живі мембрани гальмують дифузію (D ≈ 10⁻¹⁰ м²/с), а при варінні мембрани зруйновані і вода гаряча (D ≈ 2,5·10⁻⁹ м²/с). Межу задає рівновага з водою: <var>C</var>/<var>C</var>₀ ≥ 1/(1 + <var>V</var><sub>води</sub>/<var>V</var><sub>овочів</sub>).</p>
<div class="fix"><b>Примітки.</b> МДР у моделі — орієнтовні значення, затверджені МОЗ України для свіжої продукції; перевіряйте чинні нормативи. Коефіцієнти дифузії підібрано так, щоб результати збігалися з типовими даними (вимочування 1 год −15–30 %, варіння −40–70 %). У переліку «Об'єкти» реактив названо 1 % розчином дифеніламіну в концентрованій H₂SO₄ — з ним працюють лише в окулярах і рукавичках.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Де раніше видно голодування за N, P, K — у верхніх чи нижніх листках?</summary><p>У нижніх: N, P, K рухливі й переміщуються зі старих листків до молодих точок росту.</p></details>
<details class="qa"><summary>Солі чи хелати заліза?</summary><p>Хелати (Fe-ЕДТА, Fe-ЕДДГА): у ґрунті з нейтральним і лужним pH солі Fe осідають у вигляді нерозчинних гідроксидів, а хелат утримує залізо доступним.</p></details>
<details class="qa"><summary>Чому на яскравому світлі нітратів у листках менше?</summary><p>Фотосинтез постачає відновлений фередоксин, НАДФН і вуглеводні скелети для асиміляції аміаку, а світло індукує нітратредуктазу.</p></details>`,
});
/* ============ ЛР 11. Періодичність росту деревних рослин ============ */
App.add({
  n: 11, short: "Періодичність росту пагона", tag: "логістика · крива Сакса",
  title: "Періодичність росту деревних рослин",
  model: "dL/dt = r·m(t)·L·(1 − L/K) · міжвузля = L(tᵢ) − L(tᵢ₋₁) · підгонка логістики методом Нелдера–Міда",
  build({ stageBox, ctrls, below }) {
    const SP = { willow: { name: "верба", K: 520, N: 11, r: 11 }, birch: { name: "береза", K: 380, N: 10, r: 10 }, poplar: { name: "тополя", K: 640, N: 11, r: 9 }, alder: { name: "вільха", K: 300, N: 9, r: 12 } };
    const S = { sp: "willow", K: 520, N: 11, r: 11, drought: false, dS: 0.55, noise: 6, seed: 2, prog: 1, play: false, user: null, show: "model" };
    function simulate() {
      const n = 400, dt = 1 / n; let L = S.K * 0.012; const curve = [[0, 0]]; const L0 = L;
      for (let k = 1; k <= n; k++) { const t = k * dt; const m = S.drought && t > S.dS - .09 && t < S.dS + .09 ? 0.25 : 1; L += S.r * m * L * (1 - L / S.K) * dt; curve.push([t, L - L0]); }
      const r = rng(S.seed * 31 + S.N), nodes = [0];
      for (let i = 1; i <= S.N; i++) { const t = i / (S.N + 0.6); const idx = Math.min(n, Math.round(t * n)); nodes.push(curve[idx][1]); }
      const inter = []; for (let i = 1; i <= S.N; i++) inter.push(Math.max(2, (nodes[i] - nodes[i - 1]) * (1 + gauss(r) * S.noise / 100)));
      const cum = []; inter.reduce((a, b, i) => (cum[i] = a + b), 0);
      S.curve = curve; S.inter = inter; S.cum = cum; S.tn = Array.from({ length: S.N }, (_, i) => (i + 1) / (S.N + 0.6));
    }
    function nelder(f, x0, steps = 400) {
      const n = x0.length; let P = [x0]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] *= 1.2; x[i] += x[i] === 0 ? .5 : 0; P.push(x); }
      let F = P.map(f);
      for (let it = 0; it < steps; it++) {
        const ord = F.map((v, i) => i).sort((a, b) => F[a] - F[b]); P = ord.map(i => P[i]); F = ord.map(i => F[i]);
        const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += P[i][j] / n;
        const xr = c.map((v, j) => v + (v - P[n][j])), fr = f(xr);
        if (fr < F[0]) { const xe = c.map((v, j) => v + 2 * (v - P[n][j])), fe = f(xe); if (fe < fr) { P[n] = xe; F[n] = fe; } else { P[n] = xr; F[n] = fr; } }
        else if (fr < F[n - 1]) { P[n] = xr; F[n] = fr; }
        else { const xc = c.map((v, j) => v + .5 * (P[n][j] - v)), fc = f(xc); if (fc < F[n]) { P[n] = xc; F[n] = fc; } else { for (let i = 1; i <= n; i++) { P[i] = P[i].map((v, j) => P[0][j] + .5 * (v - P[0][j])); F[i] = f(P[i]); } } }
      }
      return P[0];
    }
    const logi = ([K, r, x0], x) => K / (1 + Math.exp(-r * (x - x0))) - K / (1 + Math.exp(r * x0));
    function fit(cum) {
      const n = cum.length, Kg = cum[n - 1] * 1.05; const f = (p) => { if (p[0] <= 0 || p[1] <= 0) return 1e12; let s = 0; cum.forEach((y, i) => { s += (logi(p, i + 1) - y) ** 2; }); return s; };
      const p = nelder(f, [Kg, 0.6, n / 2]); const mean = cum.reduce((a, b) => a + b, 0) / n; const ssT = cum.reduce((a, b) => a + (b - mean) ** 2, 0);
      return { p, r2: 1 - f(p) / ssT };
    }
    simulate();

    const st = new Stage(stageBox, { aspect: 1.5, minH: 300, maxH: 480, tag: "Однорічний пагін" });
    const rd = UI.reads(stageBox, [["L", "Довжина пагона"], ["max", "Найдовше міжвузля"], ["K", "Підгонка: K"], ["r", "Підгонка: r"], ["x0", "Точка перегину x₀"], ["r2", "R²"]]);
    UI.select(ctrls, { id: "l11-sp", label: "Порода", value: S.sp, options: Object.entries(SP).map(([k, o]) => [k, o.name]), on: v => { S.sp = v; Object.assign(S, { K: SP[v].K, N: SP[v].N, r: SP[v].r }); kS.set(S.K); nS.set(S.N); simulate(); S.prog = 1; ch.dirty = true; } });
    const kS = UI.slider(ctrls, { id: "l11-K", label: "Потенційний приріст K", min: 150, max: 900, step: 10, value: S.K, unit: "мм", on: v => { S.K = v; simulate(); ch.dirty = true; } });
    const nS = UI.slider(ctrls, { id: "l11-N", label: "Кількість міжвузлів", min: 6, max: 16, step: 1, value: S.N, unit: "", on: v => { S.N = v; simulate(); ch.dirty = true; } });
    UI.slider(ctrls, { id: "l11-ns", label: "Індивідуальна мінливість", min: 0, max: 25, step: 1, value: S.noise, unit: "%", on: v => { S.noise = v; simulate(); ch.dirty = true; } });
    UI.check(ctrls, { id: "l11-dr", label: "Посуха посеред сезону", value: false, on: v => { S.drought = v; simulate(); ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Виростити пагін", pri: true, on: () => { S.prog = 0; S.play = true; } }, { label: "Інший пагін", on: () => { S.seed++; simulate(); ch.dirty = true; } }]);
    const ta = h("textarea", { id: "l11-u", placeholder: "Ваші довжини міжвузлів, мм: 12, 25, 41, 58, 62, 55, 40, 22, 10" });
    const ub = h("button", { class: "btn", type: "button", onclick: () => { const v = ta.value.split(/[;,\s]+/).map(x => parseFloat(x.replace(",", "."))).filter(x => isFinite(x) && x > 0); S.user = v.length >= 4 ? v : null; ch.dirty = true; msg.textContent = S.user ? `Прийнято ${v.length} значень.` : "Потрібно щонайменше 4 числа."; } }, "Побудувати за моїми даними");
    const msg = h("span", { class: "note" });
    ctrls.append(h("div", { class: "ctl" }, h("label", { for: "l11-u" }, h("span", null, "Свої вимірювання (таблиця 11.1)")), ta), h("div", { class: "btns" }, ub, h("button", { class: "btn", type: "button", onclick: () => { S.user = null; ta.value = ""; msg.textContent = ""; ch.dirty = true; } }, "Скинути")), msg);

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Крива ритмічності росту (довжини міжвузлів)");
    const ch2 = UI.chart(row, "Велика крива росту (Сакса): довжина від основи");

    const MONTHS = ["квітень", "травень", "червень", "липень", "серпень", "вересень"];
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear();
      const inter = S.user || S.inter, N = inter.length; const total = inter.reduce((a, b) => a + b, 0);
      const vis = S.user ? 1 : S.prog; // season progress
      // how much of the shoot exists at progress vis
      let grown; if (S.user) grown = total; else { const idx = Math.min(S.curve.length - 1, Math.round(vis * (S.curve.length - 1))); grown = S.curve[idx][1] / S.curve[S.curve.length - 1][1] * total; }
      const base = H - 30, topPad = 24, scale = (base - topPad) / Math.max(total, 1);
      const sx = W * .3;
      // last year's wood + ring of bud scale scars
      c.fillStyle = Theme.dark ? "#5a4636" : "#7B5A41"; c.fillRect(sx - 7, base, 14, 30);
      c.strokeStyle = Theme.dark ? "#2f241b" : "#4a3424"; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(sx - 7, base - 2 + k * 2); c.lineTo(sx + 7, base - 2 + k * 2); c.stroke(); }
      // current-year shoot
      const yTop = base - grown * scale, wTop = 3.5, wBase = 6.5;
      const g = c.createLinearGradient(sx - 6, 0, sx + 6, 0); g.addColorStop(0, Theme.dark ? "#6f7a3c" : "#7E8C3E"); g.addColorStop(.5, Theme.dark ? "#a5b05a" : "#B5C065"); g.addColorStop(1, Theme.dark ? "#56602c" : "#606C2C");
      c.beginPath(); c.moveTo(sx - wBase, base); c.lineTo(sx - wTop, yTop); c.lineTo(sx + wTop, yTop); c.lineTo(sx + wBase, base); c.closePath(); c.fillStyle = g; c.fill();
      // lenticels
      const r = rng(4); c.fillStyle = "rgba(240,230,190,.6)"; for (let k = 0; k < grown * scale / 9; k++) { const y = base - r() * grown * scale; c.fillRect(sx - 4 + r() * 8, y, 1.6, .8); }
      // nodes: scars + buds (+ leaves during season)
      let acc = 0; const autumn = vis >= .97 || S.user;
      for (let i = 0; i < N; i++) {
        acc += inter[i]; if (acc > grown + 1e-6) break;
        const y = base - acc * scale, side = i % 2 ? 1 : -1, w = lerp(wBase, wTop, acc / Math.max(total, 1));
        c.fillStyle = Theme.dark ? "#3a2b20" : "#5A4130"; c.beginPath(); c.ellipse(sx + side * (w + 1), y + 2, 4, 1.6, 0, 0, 7); c.fill();
        c.fillStyle = Theme.dark ? "#a0603a" : "#9C5530"; c.beginPath(); c.moveTo(sx + side * w, y + 1); c.quadraticCurveTo(sx + side * (w + 6), y - 3, sx + side * (w + 3), y - 9); c.quadraticCurveTo(sx + side * w, y - 4, sx + side * w, y + 1); c.fill();
        if (!autumn) { const L = 34 * Math.min(1, (grown - acc) / 40 + .3), sway = Math.sin(time * 1.3 + i) * .06; c.save(); c.translate(sx + side * (w + 2), y); c.rotate(side > 0 ? -0.55 + sway : Math.PI + 0.55 + sway); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * .5, -L * .24, L, 0); c.quadraticCurveTo(L * .5, L * .24, 0, 0); c.fillStyle = Theme.dark ? "#4c9a5e" : "#5DA060"; c.fill(); c.restore(); }
        // dimension line for internode
        const yPrev = base - (acc - inter[i]) * scale; const rx = W * .52;
        c.strokeStyle = rgba(T.ink, .25); c.beginPath(); c.moveTo(sx + 12, y); c.lineTo(rx - 4, y); c.stroke();
        c.strokeStyle = T.data; c.lineWidth = 2; c.beginPath(); c.moveTo(rx, y + 1); c.lineTo(rx, yPrev - 1); c.stroke(); c.lineWidth = 1;
        if (yPrev - y > 11) Draw.text(c, `${i + 1}: ${fmt(inter[i], 0)} мм`, rx + 8, (y + yPrev) / 2 + 4, { size: 11, color: T.ink });
      }
      // terminal bud
      if (autumn) { c.fillStyle = Theme.dark ? "#a0603a" : "#8E4A28"; c.beginPath(); c.moveTo(sx - 4, yTop + 2); c.quadraticCurveTo(sx, yTop - 16, sx + 4, yTop + 2); c.fill(); }
      // ruler
      const rx2 = W * .12; for (let mm = 0; mm <= total; mm += 10) { const y = base - mm * scale; c.strokeStyle = rgba(T.ink, .45); c.beginPath(); c.moveTo(rx2, y); c.lineTo(rx2 + (mm % 50 ? 4 : 9), y); c.stroke(); if (mm % 100 === 0) Draw.text(c, String(mm), rx2 - 4, y + 4, { align: "right", size: 10 }); }
      Draw.text(c, "мм", rx2 - 4, topPad - 6, { align: "right", size: 10 });
      if (!S.user) Draw.text(c, MONTHS[Math.min(5, Math.floor(vis * 6))], W - 12, 22, { align: "right", size: 14, color: T.ink, font: "display" });
    }
    function charts() {
      const inter = S.user || S.inter, N = inter.length; const cum = []; inter.reduce((a, b, i) => (cum[i] = a + b), 0);
      const F = fit(cum); S.F = F;
      const dl = []; for (let x = 0.5; x <= N + .5; x += 0.05) dl.push([x, logi(F.p, x) - logi(F.p, x - 1)]);
      drawChart(ch, { x: [0.3, N + .7], y: [0, Math.max(...inter) * 1.2], xt: Array.from({ length: N }, (_, i) => i + 1), xl: "порядковий номер міжвузля", yl: "довжина, мм", series: [{ pts: inter.map((v, i) => [i + 1, v]), bars: true, color: rgba(Theme.c.chl, .6), bw: (ch.W - 60) / N * .55 }, { pts: dl, color: Theme.c.antho, w: 2 }] });
      const fc = []; for (let x = 0; x <= N + .3; x += 0.05) fc.push([x, logi(F.p, x)]);
      drawChart(ch2, { x: [0, N + .5], y: [0, Math.max(cum[N - 1], F.p[0]) * 1.1], xt: Array.from({ length: N + 1 }, (_, i) => i), xl: "номер листкового рубця", yl: "довжина пагона, мм", series: [{ pts: fc, color: Theme.c.antho, w: 2 }, { pts: [[0, 0], ...cum.map((v, i) => [i + 1, v])], color: Theme.c.chl, w: 0.01, dots: 4 }], vl: [{ x: F.p[2], label: "перегин", color: Theme.c.muted }] });
      const total = cum[N - 1];
      rd.set("L", fmt(total, 0), "мм"); rd.set("max", `№ ${inter.indexOf(Math.max(...inter)) + 1}`); rd.set("K", fmt(F.p[0], 0), "мм"); rd.set("r", fmt(F.p[1], 2), "1/міжвузля"); rd.set("x0", fmt(F.p[2], 1)); rd.set("r2", fmt(F.r2, 3));
    }
    return {
      stages: [st, ch, ch2],
      frame(dt, time) {
        if (S.play) { S.prog = Math.min(1, S.prog + dt / 9); if (S.prog >= 1) S.play = false; }
        draw(time);
        if (ch.dirty) { charts(); ch.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Закон великого періоду росту</h3>
<p>Ріст органа йде за S-подібною кривою: повільний старт, максимум швидкості, уповільнення і зупинка (крива Сакса). Так ростуть клітини, органи й рослина загалом.</p>
<div class="eq"><span class="fr"><span>d<var>L</var></span><span>d<var>t</var></span></span> = <var>r</var>·<var>L</var>·(1 − <span class="fr"><span><var>L</var></span><span><var>K</var></span></span>) &nbsp;⇒&nbsp; <var>L</var>(<var>t</var>) = <span class="fr"><span><var>K</var></span><span>1 + e<sup>−<var>r</var>(<var>t</var> − <var>t</var>₀)</sup></span></span></div>
<dl class="vars"><dt>K</dt><dd>максимальна (потенційна) довжина приросту</dd><dt>r</dt><dd>швидкість росту на початку</dd><dt>t₀</dt><dd>точка перегину: тут швидкість найбільша і L = K/2</dd></dl>
<h3>Звідки береться «горбик» міжвузлів</h3>
<p>Листки (вузли) закладаються приблизно через рівні проміжки часу — пластохрон. Тоді довжина міжвузля — це приріст за один пластохрон:</p>
<div class="eq"><var>l</var><sub>i</sub> = <var>L</var>(<var>t</var><sub>i</sub>) − <var>L</var>(<var>t</var><sub>i−1</sub>) ≈ <var>L</var>′(<var>t</var>)·Δ<var>t</var></div>
<p>Отже, крива ритмічності — це похідна великої кривої: дзвоноподібна, з максимумом посередині пагона. Найдовше міжвузля припадає на точку перегину.</p>
<h3>Як обробити свої дані</h3>
<ul><li>Міряйте від торішнього кільця рубців бруньки. Не пропускайте зближені рубці біля основи й верхівки.</li><li>Внесіть довжини міжвузлів у поле праворуч: модель побудує обидва графіки й підбере логістику (метод Нелдера–Міда, мінімум суми квадратів).</li><li>R² близький до 1 означає, що ріст ішов «за Саксом». Провал посередині — слід посухи або іншого стресу (увімкніть «Посуху» для порівняння).</li></ul>
<h3>До контрольного питання</h3>
<details class="qa"><summary>Ритмічність росту в тропіках і помірному кліматі?</summary><p>У континентальному кліматі — один період росту на рік, далі спокій; утворюються чіткі річні кільця й кільця рубців. У тропіках ріст ендогенно ритмічний, кілька «хвиль» на рік, кільця нечіткі або відсутні.</p></details>`,
});
/* ============ ЛР 12. Жаростійкість рослин (за Ф. П. Мацковим) ============ */
App.add({
  n: 12, short: "Жаростійкість рослин", tag: "Арреніус · кумулятивне ушкодження",
  title: "Визначення жаростійкості рослин (за Ф. П. Мацковим)",
  model: "k(T) = (ln2/τ)·exp[(E_a/R)(1/T₅₀ − 1/T)] · S = exp(−Σ k(Tⱼ)·Δt) · клітина буріє, якщо S < 0,5",
  build({ stageBox, ctrls, below }) {
    const SPP = {
      tradesc: { name: "традесканція", T50: 50.5, shape: [0.30, 1.1, 0.0], col: "#4F8F4A" },
      pelarg: { name: "пеларгонія", T50: 53.5, shape: [0.95, 0.6, 0.1], col: "#5E9447" },
      begon: { name: "бегонія", T50: 47.5, shape: [0.62, 0.9, 0.35], col: "#3E7F45" },
      aloe: { name: "алое", T50: 59.5, shape: [0.22, 1.6, 0.0], col: "#6E9A5A" },
      senp: { name: "сенполія", T50: 46.5, shape: [0.85, 0.7, 0.05], col: "#3B6E3E" },
      chloro: { name: "хлорофітум", T50: 51.5, shape: [0.12, 2.2, 0.0], col: "#6EA052" },
    };
    const S = { sel: ["tradesc", "pelarg", "aloe"], Ea: 420, dt: 7, temps: [40, 60, 80, 98], hcl: 10, play: false, het: 1.8, step: 4 };
    const kOf = (T, T50) => Math.log(2) / S.dt * Math.exp(S.Ea * 1000 / RG * (1 / (T50 + 273.15) - 1 / (T + 273.15)));
    // leaves: jittered cells inside an outline w(u)
    const leaves = {};
    function build(key) {
      const [wd, p, asym] = SPP[key].shape, r = rng(key.length * 97 + 13), cells = [];
      const w = (u) => wd * Math.pow(Math.sin(Math.PI * Math.min(.999, u)), p) * (1 + .35 * (1 - u));
      const n = 34;
      for (let i = 0; i < n * 2.2; i++) for (let j = 0; j < n; j++) {
        const u = (i + .5 + (r() - .5) * .7) / (n * 2.2), x = (j + .5 + (r() - .5) * .7) / n - .5;
        const half = w(u) / 2; if (Math.abs(x - asym * .15 * Math.sin(Math.PI * u)) > half) continue;
        const marg = Math.abs(x) / Math.max(half, 1e-3);
        cells.push({ u, x, off: gauss(r) * S.het - 1.6 * marg * marg, g: r() });
      }
      leaves[key] = { cells, w, asym };
    }
    Object.keys(SPP).forEach(build);
    function damage(key, upto) { // fraction of browned cells after steps 0..upto (cumulative protocol)
      const L = leaves[key], T50 = SPP[key].T50; let d = 0;
      for (const c of L.cells) { let s = 0; for (let j = 0; j <= upto; j++) s += kOf(S.temps[j], T50 + c.off) * S.dt; if (Math.exp(-s) < 0.5) d++; }
      return d / L.cells.length;
    }
    const sign = (d) => d < 0.05 ? "−" : d < 0.5 ? "+" : d < 0.95 ? "++" : "+++";

    const st = new Stage(stageBox, { aspect: 1.45, minH: 320, maxH: 520, tag: null });
    const rd = UI.reads(stageBox, [["hcl", "Час у HCl"], ["best", "Найстійкіший вид"], ["worst", "Найменш стійкий"], ["k", "k(60 °C) / k(50 °C)"]]);
    ["s1", "s2", "s3"].forEach((id, i) => UI.select(ctrls, { id: "l12-" + id, label: `Вид ${i + 1}`, value: S.sel[i], options: Object.entries(SPP).map(([k, o]) => [k, o.name]), on: v => { S.sel[i] = v; ch.dirty = true; tbl(); } }));
    UI.slider(ctrls, { id: "l12-t", label: "Витримка на кожному ступені", min: 3, max: 15, step: 1, value: S.dt, unit: "хв", on: v => { S.dt = v; ch.dirty = true; tbl(); } });
    UI.slider(ctrls, { id: "l12-ea", label: "Енергія активації ушкодження", min: 200, max: 700, step: 10, value: S.Ea, unit: "кДж/моль", on: v => { S.Ea = v; ch.dirty = true; tbl(); } });
    UI.seg(ctrls, { label: "Ступені прогріву", value: "man", options: [["man", "40 · 60 · 80 · >80"], ["fine", "40 · 50 · 55 · 60"]], on: v => { S.temps = v === "man" ? [40, 60, 80, 98] : [40, 50, 55, 60]; ch.dirty = true; tbl(); } });
    UI.buttons(ctrls, [{ label: "Залити HCl", pri: true, on: () => { S.hcl = 0; S.play = true; } }]);
    ctrls.append(h("p", { class: "note" }, "Протокол ступінчастий: проба 2 пройшла 40 і 60 °C, проба 4 — усі чотири ступені. Пошкодження накопичується."));

    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Частка живих клітин після 7-хв прогріву при сталій T");
    const ch2 = UI.chart(row, "Швидкість ушкодження k(T), логарифмічна шкала");
    const tb = h("div", { class: "tblwrap" }); below.append(h("div", { class: "chart" }, h("h4", null, "Таблиця 12.1 · ступінь пошкодження листків"), tb));
    let D = {};
    function tbl() {
      D = {}; for (const k of new Set(S.sel)) D[k] = S.temps.map((_, j) => damage(k, j));
      const lab = (j) => j === 3 && S.temps[3] > 80 ? "> 80 °C" : `${S.temps[j]} °C`;
      tb.innerHTML = `<table class="t"><thead><tr><th>Вид рослини</th>${S.temps.map((_, j) => `<th>${lab(j)}</th>`).join("")}</tr></thead><tbody>${[...new Set(S.sel)].map(k => `<tr><td>${SPP[k].name}</td>${D[k].map(d => `<td><b>${sign(d)}</b> <span class="mono" style="color:var(--muted)">${fmt(d * 100, 0)} %</span></td>`).join("")}</tr>`).join("")}</tbody></table>`;
      const sc = [...new Set(S.sel)].map(k => [k, D[k].reduce((a, b) => a + b, 0) - SPP[k].T50 * 1e-3]).sort((a, b) => a[1] - b[1]);
      rd.set("best", SPP[sc[0][0]].name); rd.set("worst", SPP[sc[sc.length - 1][0]].name);
      rd.set("k", fmt(kOf(60, 50) / kOf(50, 50), 0), "раз");
      if (typeof st !== "undefined") st.dirty = true;
    }
    tbl();
    function drawLeaf(c, key, cx, cy, Lh, upto, brownP, time) {
      const L = leaves[key], sp = SPP[key], T50 = sp.T50, Wd = Lh * .9;
      const base = sp.col;
      // petiole
      c.strokeStyle = Theme.dark ? "#4c7a46" : "#5C8A4E"; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy + Lh / 2); c.lineTo(cx, cy + Lh / 2 + Lh * .12); c.stroke(); c.lineWidth = 1;
      const cs = Lh / 70 * 2.4;
      for (const cl of L.cells) {
        let s = 0; for (let j = 0; j <= upto; j++) s += kOf(S.temps[j], T50 + cl.off) * S.dt;
        const dead = Math.exp(-s) < .5;
        const x = cx + cl.x * Wd, y = cy + Lh / 2 - cl.u * Lh;
        const gcol = mixHex(base, "#9BC67E", cl.g * .25);
        c.fillStyle = dead ? mixHex(gcol, cl.g > .5 ? "#6B5326" : "#7A5A2A", brownP) : gcol;
        c.fillRect(x - cs / 2, y - cs / 2, cs + .4, cs + .4);
      }
      // midrib
      c.strokeStyle = "rgba(255,255,230,.35)"; c.beginPath(); c.moveTo(cx, cy + Lh / 2); c.lineTo(cx + L.asym * .1 * Wd, cy - Lh / 2 + 4); c.stroke();
    }
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear();
      const cols = 4, rows = [...new Set(S.sel)].length, cw = (W - 86) / cols, rh = (H - 40) / rows;
      const bp = 1 - Math.exp(-S.hcl / 2.5);
      for (let j = 0; j < cols; j++) {
        const x = 86 + j * cw;
        Draw.text(c, j === 3 && S.temps[3] > 80 ? "> 80 °C" : `${S.temps[j]} °C`, x + cw / 2, 18, { align: "center", size: 12, color: T.ink, weight: 600 });
        // dish
        c.beginPath(); c.roundRect ? c.roundRect(x + 4, 26, cw - 8, H - 32, 14) : c.rect(x + 4, 26, cw - 8, H - 32);
        c.fillStyle = Theme.dark ? "rgba(140,180,160,.06)" : "rgba(230,240,235,.7)"; c.fill(); c.strokeStyle = rgba(T.ink, .15); c.stroke();
        [...new Set(S.sel)].forEach((k, i) => {
          const Lh = Math.min(rh * .78, cw * 1.05);
          drawLeaf(c, k, x + cw / 2, 30 + i * rh + rh / 2 - Lh * .06, Lh, j, bp, time);
          if (S.hcl > 0) Draw.text(c, sign(D[k][j]), x + cw - 12, 30 + i * rh + 16, { align: "right", size: 13, color: T.ink, weight: 600 });
        });
      }
      [...new Set(S.sel)].forEach((k, i) => Draw.text(c, SPP[k].name, 6, 30 + i * rh + rh / 2, { size: 11, color: T.ink, font: "body" }));
    }
    function charts() {
      const cols = [Theme.c.chl, Theme.c.carot, Theme.c.data];
      const ks = [...new Set(S.sel)];
      drawChart(ch, { x: [35, 75], y: [0, 1.05], xl: "температура, °C", yl: "частка живих клітин",
        series: ks.map((k, i) => { const pts = []; for (let T = 35; T <= 75; T += .25) pts.push([T, Math.exp(-kOf(T, SPP[k].T50) * S.dt)]); return { pts, color: cols[i], w: 2.2 }; }),
        hl: [{ y: .5, label: "50 %" }], marks: ks.map((k, i) => ({ x: SPP[k].T50, y: .5, color: cols[i] })), legend: ks.map((k, i) => ({ label: SPP[k].name, color: cols[i] })) });
      const pts = ks.map((k, i) => { const p = []; for (let T = 35; T <= 75; T += .5) p.push([T, Math.max(1e-6, kOf(T, SPP[k].T50))]); return { pts: p, color: cols[i], w: 2 }; });
      drawChart(ch2, { x: [35, 75], y: [1e-4, 1e3], ylog: true, xl: "температура, °C", yl: "k, хв⁻¹", series: pts, yfmt: v => v >= 1 ? String(v) : "10" + String(Math.round(Math.log10(v))).replace("-", "⁻").replace(/\d/g, d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]) });
    }
    return {
      stages: [st, ch, ch2],
      frame(dt, time) {
        if (S.play) { S.hcl = Math.min(10, S.hcl + dt * 1.2); if (S.hcl >= 10) S.play = false; }
        if (S.play || st.dirty) { draw(time); st.dirty = false; }
        rd.set("hcl", fmt(S.hcl, 1), "хв");
        if (ch.dirty !== false) { charts(); ch.dirty = false; }
      },
    };
  },
  cheat: `
<h3>Що відбувається з клітиною</h3>
<p>Вище оптимуму температура спочатку порушує обмін, потім руйнує білково-ліпідні комплекси мембран і коагулює білки. Мембрана втрачає напівпроникність: H⁺ із HCl (або органічні кислоти власного соку) доходять до хлорофілу і витісняють Mg²⁺ → бурий феофітин (див. ЛР 5). Живі клітини лишаються зеленими.</p>
<h3>Швидкість ушкодження — рівняння Арреніуса</h3>
<div class="eq"><var>k</var>(<var>T</var>) = <var>A</var>·e<sup>−<var>E</var><sub>a</sub>/<var>RT</var></sup> = <span class="fr"><span>ln 2</span><span>τ</span></span>·exp[<span class="fr"><span><var>E</var><sub>a</sub></span><span><var>R</var></span></span>(<span class="fr"><span>1</span><span><var>T</var><sub>50</sub></span></span> − <span class="fr"><span>1</span><span><var>T</var></span></span>)]</div>
<dl class="vars"><dt>T<sub>50</sub></dt><dd>температура, за якої за час τ = 7 хв гине половина клітин — міра жаростійкості виду</dd><dt>E<sub>a</sub></dt><dd>енергія активації денатурації мембран, сотні кДж/моль</dd></dl>
<p>Через велике E<sub>a</sub> швидкість ушкодження зростає в десятки разів на кожні 10 °C (показник «k(60)/k(50)»). Тому перехід від «−» до «+++» такий різкий.</p>
<h3>Кумулятивний протокол</h3>
<div class="eq"><var>S</var><sub>j</sub> = exp(−Σ<sub><var>m</var>≤<var>j</var></sub> <var>k</var>(<var>T</var><sub>m</sub>)·Δ<var>t</var>)</div>
<p>Листки з четвертої проби пройшли всі ступені прогріву, тож пошкодження підсумовуються. Клітини в моделі мають розкид стійкості (≈ ±2 °C), краї листка тонші і гріються сильніше, тому буріння починається з країв і плямами.</p>
<h3>Як записати результат</h3>
<p>«−» немає побуріння; «+» слабке (до 50 % площі); «++» понад 50 %; «+++» суцільне. Вищий T<sub>50</sub> — жаростійкіший вид. Значення T<sub>50</sub> для видів у моделі ілюстративні.</p>
<div class="fix"><b>Уточнення до посібника.</b> Таблицю підписано 13.1, має бути 12.1. Ступінь пошкодження в шапці таблиці вказано у %, а записують його знаками; модель показує обидва.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чи можна поливати в спеку вдень?</summary><p>Не холодною водою по листю: різкий перепад температур і краплі-лінзи шкодять, а холодна вода біля коренів знижує поглинання. Краще зранку або ввечері; у спеку — поливати під корінь водою температури ґрунту.</p></details>
<details class="qa"><summary>Чому в теплицях частіше опіки листків?</summary><p>Висока вологість повітря гальмує транспірацію, а саме вона охолоджує листок; скло затримує тепло, повітря застоюється.</p></details>`,
});
App.boot();
