/* Конспект «Екстракція БАР»: ядро інтерактивних моделей.
   Малює на canvas, має спільні кнопки «Пауза / Крок / Спочатку», повзунки, перемикачі режимів і показники.
   Анімація працює лише поки модель видно на екрані. */
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "—").replace(".", ",").replace("-", "−");
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hash01 = (i, s = 0) => { let x = Math.imul(i + 1, 0x9E3779B1) ^ Math.imul(s + 7, 0x85EBCA77); x ^= x >>> 15; x = Math.imul(x, 0x2C1B3C6D); x ^= x >>> 12; return ((x >>> 0) % 100000) / 100000; };

export const VIZ = {};
export const reg = (name, def) => { VIZ[name] = def; };

/* ---------- кольори ---------- */
export const C = {
  ink: "#16221A", soft: "#3F5247", muted: "#6B7A70", rule: "#C9D8CE", bg: "#F7FAF6", glass: "#6F8B82", glassFill: "rgba(214,235,230,.28)",
  green: "#2F7D4F", greenD: "#1D5A38", leaf: "#5FA463", leafD: "#3F7D45", amber: "#C98A1B", amberL: "#E8B24A", red: "#C0392B", blue: "#2E6FB5", blueL: "#8EC1EA",
  steel: "#8A98A0", steelD: "#5D6B73", steelL: "#C3CDD2", brown: "#7B4A22", extract: "#6E8B2A", ext2: "#B7873A", water: "#8EC1EA", oil: "#E4B63B", co2: "#6FB7D9", violet: "#7D5BA6",
};
const rgbOf = (c) => { if (c[0] === "#") { const A = parseInt(c.length === 4 ? c.replace(/./g, (m, i) => i ? m + m : "").slice(1) : c.slice(1), 16); return [(A >> 16) & 255, (A >> 8) & 255, A & 255]; } const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [128, 128, 128]; };
export const mixHex = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; };
export const alpha = (hex, a) => { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; };
/* колір витяжки за концентрацією 0…1: від прозорої води до насиченого настою */
export const extractColor = (k, hue = "green") => {
  const t = clamp(k, 0, 1);
  const pal = { green: ["#EAF4E4", "#B9D27A", "#6E8B2A"], amber: ["#FBF1D8", "#E8C36A", "#B87A1A"], tea: ["#F6EBD4", "#D7A64B", "#8B4F1A"], blue: ["#E6F1F8", "#8EC1EA", "#2E6FB5"] }[hue];
  return t < .5 ? mixHex(pal[0], pal[1], t * 2) : mixHex(pal[1], pal[2], (t - .5) * 2);
};

/* ---------- малювання ---------- */
export const D = {
  rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); },
  txt(c, s, x, y, o = {}) { c.font = `${o.weight || 600} ${o.size || 12}px ${o.font || "Inter, system-ui, sans-serif"}`; c.fillStyle = o.color || C.ink; c.textAlign = o.align || "left"; c.textBaseline = o.base || "middle"; c.fillText(s, x, y); },
  tag(c, s, x, y, o = {}) { // плашка з текстом
    c.font = `${o.weight || 700} ${o.size || 11.5}px Inter, system-ui, sans-serif`; const w = c.measureText(s).width + 14, h = (o.size || 11.5) + 9; const align = o.align || "center";
    const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x; D.rr(c, x0, y - h / 2, w, h, h / 2); c.fillStyle = o.bg || "rgba(255,255,255,.92)"; c.fill(); c.strokeStyle = o.stroke || "rgba(0,0,0,.14)"; c.lineWidth = 1; c.stroke();
    c.fillStyle = o.color || C.ink; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, x0 + w / 2, y + .5); return w;
  },
  arrow(c, x1, y1, x2, y2, col = C.ink, w = 2, head = 7) { const a = Math.atan2(y2 - y1, x2 - x1); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * head * .6, y2 - Math.sin(a) * head * .6); c.stroke(); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - Math.cos(a - .42) * head, y2 - Math.sin(a - .42) * head); c.lineTo(x2 - Math.cos(a + .42) * head, y2 - Math.sin(a + .42) * head); c.closePath(); c.fill(); },
  bg(c, W, H, top = "#F8FBF7", bot = "#E9F2EA") { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, W, H); },
  sphere(c, x, y, r, col, a = 1) { const g = c.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); g.addColorStop(0, mixHex(col, "#FFFFFF", .55)); g.addColorStop(.55, col); g.addColorStop(1, mixHex(col, "#000000", .35)); c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = 1; },
  glow(c, x, y, r, col, a = .5) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, alpha(col, a)); g.addColorStop(1, alpha(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); },
  /* вертикальна посудина з рідиною: path(c) будує контур; fill — рівень 0…1 між top та bottom */
  vessel(c, pathFn, x, y, w, h, level, liquidCol, o = {}) {
    c.save(); pathFn(c); c.fillStyle = o.glassFill || C.glassFill; c.fill(); c.clip();
    if (level > 0) { const ly = y + h * (1 - level); const g = c.createLinearGradient(0, ly, 0, y + h); g.addColorStop(0, liquidCol); g.addColorStop(1, o.deep || liquidCol); c.fillStyle = g; c.globalAlpha = o.a ?? .86; c.fillRect(x - 4, ly, w + 8, h * level + 4); c.globalAlpha = 1; c.fillStyle = "rgba(255,255,255,.45)"; c.fillRect(x - 4, ly, w + 8, 1.6); }
    if (o.inside) o.inside(c, level);
    c.restore();
    pathFn(c); c.strokeStyle = o.stroke || C.glass; c.lineWidth = o.lw || 2; c.stroke();
    c.save(); pathFn(c); c.clip(); const sh = c.createLinearGradient(x, 0, x + w, 0); sh.addColorStop(0, "rgba(255,255,255,.35)"); sh.addColorStop(.18, "rgba(255,255,255,0)"); sh.addColorStop(.85, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(255,255,255,.18)"); c.fillStyle = sh; c.fillRect(x, y, w, h); c.restore();
  },
  beakerPath: (x, y, w, h, r = 8) => (c) => { c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x, y); c.lineTo(x, y + h - r); c.quadraticCurveTo(x, y + h, x + r, y + h); c.lineTo(x + w - r, y + h); c.quadraticCurveTo(x + w, y + h, x + w, y + h - r); c.lineTo(x + w, y); c.lineTo(x + w + 3, y); },
  flaskPath: (cx, cy, r, neckW, neckH) => (c) => { const a = Math.asin(neckW / 2 / r); c.beginPath(); c.moveTo(cx - neckW / 2, cy - r * Math.cos(a) - neckH); c.lineTo(cx - neckW / 2, cy - r * Math.cos(a)); c.arc(cx, cy, r, -Math.PI / 2 - a, -Math.PI / 2 + a + Math.PI * 2 - 2 * a - .0001, false); c.lineTo(cx + neckW / 2, cy - r * Math.cos(a) - neckH); },
  stand(c, x, y, h, col = C.steelD) { c.strokeStyle = col; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.stroke(); },
  clamp(c, x1, y, x2) { c.strokeStyle = C.steelD; c.lineWidth = 4; c.lineCap = "round"; c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke(); c.fillStyle = C.steelD; c.beginPath(); c.arc(x1, y, 4.5, 0, 7); c.fill(); },
  /* частинка рослинної сировини (подрібнений шматочок) */
  chip(c, x, y, r, rot, fill, load = 1) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (.78 + .32 * ((k * 37 % 5) / 4)); const px = Math.cos(a) * rr * 1.25, py = Math.sin(a) * rr * .8; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath();
    c.fillStyle = fill; c.fill(); c.strokeStyle = "rgba(30,70,30,.55)"; c.lineWidth = 1; c.stroke();
    c.strokeStyle = "rgba(255,255,255,.28)"; c.lineWidth = 1; c.beginPath(); c.moveTo(-r * .9, 0); c.lineTo(r * .9, 0); c.stroke();
    if (load > 0.02) { c.fillStyle = `rgba(190,120,20,${.18 + .5 * load})`; c.beginPath(); c.arc(0, 0, r * .3 * (.5 + load * .5), 0, 7); c.fill(); }
    c.restore();
  },
  /* крива/діаграма */
  chart(c, x, y, w, h, o) {
    const [x0, x1] = o.x, [y0, y1] = o.y; const X = (v) => x + (v - x0) / (x1 - x0) * w, Y = (v) => y + h - (v - y0) / (y1 - y0) * h;
    c.fillStyle = "#fff"; c.fillRect(x, y, w, h); c.strokeStyle = C.rule; c.lineWidth = 1; c.font = "10.5px Inter, system-ui, sans-serif"; c.fillStyle = C.muted;
    const xt = o.xt || ticks(x0, x1, 5), yt = o.yt || ticks(y0, y1, 4);
    for (const v of yt) { const yy = Math.round(Y(v)) + .5; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); c.textAlign = "right"; c.textBaseline = "middle"; c.fillText((o.yf || tf)(v), x - 5, yy); }
    for (const v of xt) { const xx = Math.round(X(v)) + .5; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + h); c.stroke(); c.textAlign = "center"; c.textBaseline = "top"; c.fillText((o.xf || tf)(v), xx, y + h + 5); }
    c.strokeStyle = C.muted; c.strokeRect(x + .5, y + .5, w, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    for (const b of o.bands || []) { c.fillStyle = b.col; c.fillRect(X(b.x0), y, X(b.x1) - X(b.x0), h); if (b.label) D.txt(c, b.label, (X(b.x0) + X(b.x1)) / 2, y + 11, { size: 10.5, align: "center", color: b.lc || C.soft }); }
    for (const l of o.hl || []) { c.strokeStyle = l.col || C.muted; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(x, Y(l.y)); c.lineTo(x + w, Y(l.y)); c.stroke(); c.setLineDash([]); if (l.label) D.txt(c, l.label, x + w - 4, Y(l.y) - 7, { size: 10.5, align: "right", color: l.col || C.muted }); }
    for (const s of o.series || []) {
      if (!s.pts.length) continue;
      if (s.fill) { c.beginPath(); c.moveTo(X(s.pts[0][0]), Y(y0)); for (const [px, py] of s.pts) c.lineTo(X(px), Y(py)); c.lineTo(X(s.pts[s.pts.length - 1][0]), Y(y0)); c.closePath(); c.fillStyle = s.fill; c.fill(); }
      c.beginPath(); c.strokeStyle = s.col; c.lineWidth = s.w || 2.2; c.lineJoin = "round"; c.setLineDash(s.dash || []); s.pts.forEach(([px, py], i) => i ? c.lineTo(X(px), Y(py)) : c.moveTo(X(px), Y(py))); c.stroke(); c.setLineDash([]);
    }
    for (const m of o.marks || []) { c.fillStyle = m.col || C.red; c.beginPath(); c.arc(X(m.x), Y(m.y), m.r || 5, 0, 7); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1.6; c.stroke(); if (m.label) D.txt(c, m.label, X(m.x) + (m.dx ?? 8), Y(m.y) + (m.dy ?? -9), { size: 11, color: m.col || C.red, align: m.align || "left", weight: 700 }); }
    for (const v of o.vl || []) { c.strokeStyle = v.col || C.muted; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(v.x), y); c.lineTo(X(v.x), y + h); c.stroke(); c.setLineDash([]); if (v.label) D.txt(c, v.label, X(v.x) + 4, y + 11 + (v.dy || 0), { size: 10.5, color: v.col || C.muted }); }
    c.restore();
    if (o.xl) D.txt(c, o.xl, x + w, y + h + 20, { size: 10.5, align: "right", color: C.muted });
    if (o.yl) { c.save(); c.translate(x - 38, y + h / 2); c.rotate(-Math.PI / 2); D.txt(c, o.yl, 0, 0, { size: 10.5, align: "center", color: C.muted }); c.restore(); }
    if (o.title) D.txt(c, o.title, x, y - 9, { size: 11.5, weight: 700 });
    return { X, Y };
  },
};
/* малювання у «проєктних» координатах vw×vh, вписаних у прямокутник (x,y,w,h) полотна */
D.fit = (c, x, y, w, h, vw, vh, fn) => { const s = Math.min(w / vw, h / vh), ox = x + (w - vw * s) / 2, oy = y + (h - vh * s) / 2; c.save(); c.translate(ox, oy); c.scale(s, s); fn(s); c.restore(); return { s, ox, oy }; };
function ticks(a, b, n) { const span = b - a, s0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(s0))), st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= s0) || mag * 10; const out = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(8)); return out; }
const tf = (v) => (Math.abs(v) >= 1000 ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : Number.isInteger(v) ? String(v) : String(+v.toFixed(2)).replace(".", ",")).replace("-", "−");

/* ---------- каркас моделі ---------- */
const sims = new Set();
let last = performance.now(), started = false;
function loop(now) {
  const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
  if (!document.hidden) for (const s of sims) if (s.visible) s.tick(dt);
  requestAnimationFrame(loop);
}
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach(e => { e.target._sim.visible = e.isIntersecting; if (e.isIntersecting) e.target._sim.dirty = true; }), { rootMargin: "120px" }) : null;

class Sim {
  constructor(fig, def) {
    this.fig = fig; this.def = def; this.body = fig.querySelector("[data-body]"); this.P = {}; this.running = !REDUCED; this.speed = 1; this.visible = !io; this.dirty = true; this.step1 = false;
    const body = this.body; body.replaceChildren();
    const stage = el("div", "ex-sim"); const left = el("div", "ex-sim__main"); const right = el("div", "ex-sim__side"); const top = el("div", "ex-sim__top");
    this.wrap = el("div", "ex-sim__cv"); this.cv = document.createElement("canvas"); this.cv.setAttribute("role", "img"); this.cv.setAttribute("aria-label", fig.querySelector("figcaption b")?.textContent || "Модель");
    this.wrap.append(this.cv); left.append(this.wrap);
    // кнопки
    const bar = el("div", "ex-sim__bar");
    this.bPlay = btn("⏸ Пауза", "ex-btn", () => this.setRun(!this.running)); this.bStep = btn("⏭ Крок", "ex-btn ex-btn--ghost", () => { this.step1 = true; }); this.bReset = btn("↺ Спочатку", "ex-btn ex-btn--ghost", () => this.reset());
    this.status = el("span", "ex-sim__st");
    const spd = el("label", "ex-sim__spd"); spd.append("Швидкість "); this.selSpd = document.createElement("select"); for (const [v, t] of [[.5, "0,5×"], [1, "1×"], [2, "2×"], [4, "4×"]]) { const o = document.createElement("option"); o.value = v; o.textContent = t; if (v === 1) o.selected = true; this.selSpd.append(o); } this.selSpd.addEventListener("change", () => { this.speed = +this.selSpd.value; }); spd.append(this.selSpd);
    bar.append(this.bPlay, this.bStep, this.bReset, spd, this.status); left.append(bar);
    if (def.modes) { const m = el("div", "ex-chips"); m.setAttribute("role", "group"); this.P.mode = def.modes[0][0]; this.modeBtns = def.modes.map(([k, t]) => { const b = btn(t, "", () => { this.P.mode = k; this.modeBtns.forEach((x, i) => x.setAttribute("aria-pressed", String(def.modes[i][0] === k))); def.onMode?.(this.S, this.P, k); this.reset(true); }); b.setAttribute("aria-pressed", String(k === this.P.mode)); m.append(b); return b; }); top.append(m); }
    this.sl = {};
    for (const p of def.params || []) {
      const wrap = el("label", "ex-ctl"); const out = document.createElement("output"); const inp = document.createElement("input"); inp.type = "range"; inp.min = p.min; inp.max = p.max; inp.step = p.step; inp.value = p.v; this.P[p.k] = p.v;
      const show = () => { inp.style.setProperty("--pct", ((+inp.value - +inp.min) / ((+inp.max - +inp.min) || 1) * 100) + "%"); out.textContent = (p.f ? p.f(+inp.value) : fmt(+inp.value, p.d ?? 0)) + (p.u ? " " + p.u : ""); };
      inp.addEventListener("input", () => { this.P[p.k] = +inp.value; show(); this.dirty = true; p.on?.(this.S, this.P); });
      show(); const top = el("span", "ex-ctl__top"); top.append(document.createTextNode(p.label), out); wrap.append(top, inp); right.append(wrap); this.sl[p.k] = { inp, show };
    }
    for (const t of def.toggles || []) {
      const lab = el("label", "ex-check"); const i = document.createElement("input"); i.type = "checkbox"; i.checked = !!t.v; this.P[t.k] = !!t.v; i.addEventListener("change", () => { this.P[t.k] = i.checked; this.dirty = true; t.on?.(this.S, this.P); }); lab.append(i, t.label); right.append(lab);
    }
    if (def.buttons) { const row = el("div", "ex-chips"); for (const b of def.buttons) row.append(btn(b.label, b.pri ? "ex-btn" : "ex-btn ex-btn--ghost", () => { b.run(this.S, this.P, this); this.dirty = true; })); right.append(row); }
    if (def.presets) { const row = el("div", "ex-chips ex-chips--presets"); const cap = el("div", "ex-sim__lab"); cap.textContent = def.presetsLabel || "Режими з літератури"; right.append(cap); for (const pr of def.presets) row.append(btn(pr.label, "", () => { for (const k in pr.set) { this.P[k] = pr.set[k]; const s = this.sl[k]; if (s) { s.inp.value = pr.set[k]; s.show(); } } pr.run?.(this.S, this.P); this.reset(true); })); right.append(row); }
    this.reads = el("dl", "ex-reads"); right.append(this.reads);
    if (def.info) { const n = el("div", "ex-sim__note"); n.innerHTML = def.info; right.append(n); }
    stage.append(top, left, right); body.append(stage);
    this.S = def.init(this.P); this.t = 0;
    this.ctx = this.cv.getContext("2d"); this.W = 600; this.H = 340; this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.wrap);
    this.resize(); this.setRun(this.running); if (io) { fig._sim = this; io.observe(fig); } sims.add(this); fig._sim = this;
    if (!started) { started = true; requestAnimationFrame((t) => { last = t; loop(t); }); }
    this.cv.addEventListener("pointermove", (e) => { const r = this.cv.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; this.dirty = true; });
    this.cv.addEventListener("pointerleave", () => { this.mouse = null; this.dirty = true; });
    this.cv.addEventListener("click", (e) => { if (!def.click) return; const r = this.cv.getBoundingClientRect(); def.click(this.S, this.P, e.clientX - r.left, e.clientY - r.top, this); this.dirty = true; });
  }
  setRun(on) { this.running = on; this.bPlay.textContent = on ? "⏸ Пауза" : "▶ Продовжити"; this.status.textContent = on ? "Модель працює" : "Пауза"; this.status.classList.toggle("on", on); this.bStep.disabled = on; }
  reset(keepRun) { this.S = this.def.init(this.P); this.t = 0; this.dirty = true; if (!keepRun) this.setRun(!REDUCED); }
  resize() { const w = this.wrap.clientWidth || 600; const asp = typeof this.def.aspect === "function" ? this.def.aspect(w) : (this.def.aspect || 1.75); const h = Math.round(clamp(w / asp, 240, 560)); const d = Math.min(2, devicePixelRatio || 1); this.cv.style.height = h + "px"; this.cv.width = Math.round(w * d); this.cv.height = Math.round(h * d); this.ctx.setTransform(d, 0, 0, d, 0, 0); this.W = w; this.H = h; this.dirty = true; }
  tick(dt) {
    let adv = 0;
    if (this.running) adv = dt * this.speed; else if (this.step1) { adv = 1 / 30; this.step1 = false; }
    if (adv > 0) { this.t += adv; try { this.def.step(this.S, this.P, adv, this); } catch (e) { console.error(e); } }
    if (adv > 0 || this.dirty || this.mouse) {
      this.dirty = false; const c = this.ctx;
      try { this.def.draw(c, this.S, this.P, this.W, this.H, this.t, this); } catch (e) { console.error(e); }
      if (this.def.reads) { const rows = this.def.reads(this.S, this.P); const sig = rows.map(r => r[0] + r[1]).join("|"); if (sig !== this._sig) { this._sig = sig; this.reads.innerHTML = rows.map(([k, v, u]) => `<div><dt>${k}</dt><dd>${v}${u ? `<small> ${u}</small>` : ""}</dd></div>`).join(""); } }
    }
  }
}
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const btn = (txt, cls, on) => { const b = document.createElement("button"); b.type = "button"; if (cls) b.className = cls; b.textContent = txt; b.addEventListener("click", on); return b; };
export { el, btn };

export function mountAll() {
  document.querySelectorAll("figure.ex-viz[data-w]").forEach((fig) => {
    const def = VIZ[fig.dataset.w]; if (!def) { console.warn("Немає моделі", fig.dataset.w); return; }
    try { if (def.dom) { const b = fig.querySelector("[data-body]"); b.replaceChildren(); def.dom(b, fig); } else new Sim(fig, def); } catch (e) { console.error(fig.dataset.w, e); }
  });
}
