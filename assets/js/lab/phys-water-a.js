/* Конспект «Водний режим рослин»: моделі 1–3 (клітина-осмометр, форми води в ґрунті, радіальний транспорт у корені).
   Якісні моделі: числа підібрано так, щоб показати закономірності з посібника, а не відтворити окремі експерименти. */
import { reg, D, C, fmt, clamp, lerp, smooth, rng, mixHex, alpha, hash01 } from "./extr-core.js";

/* ====================== 1. КЛІТИНА — ОСМОТИЧНА СИСТЕМА ====================== */
const V0 = 0.82, VMIN = 0.6, P1 = 1.0, TM = 1.0, EPS = 2.44; // V0 — об'єм, при якому стінка розслаблена; EPS — МПа на 1 моль/л
const cellP = (v) => P1 / v;
const cellT = (v, wilt) => (v >= V0 ? TM * (v - V0) / (1 - V0) : wilt ? -0.8 * (V0 - v) / (V0 - VMIN) : 0);
const cellPsi = (v, wilt) => -cellP(v) + cellT(v, wilt);
function equilibrium(pi, wilt) { let lo = VMIN, hi = 1; const f = (v) => cellPsi(v, wilt) + pi; if (f(hi) >= 0) return hi; if (f(lo) <= 0) return lo; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; f(m) > 0 ? (hi = m) : (lo = m); } return (lo + hi) / 2; }

reg("w-cell", {
  aspect: (w) => (w < 560 ? 0.98 : 1.5),
  params: [
    { k: "c", label: "Концентрація зовнішнього розчину (сахарози)", min: 0, max: 0.8, step: 0.01, v: 0.5, u: "моль/л", d: 2 },
  ],
  toggles: [{ k: "wilt", label: "Тканина в'яне (стінка тягне протопласт — циторіз)", v: false }],
  presets: [
    { label: "Чиста вода", set: { c: 0 } }, { label: "Ізотонічний розчин", set: { c: 0.5 } }, { label: "Гіпертонічний розчин", set: { c: 0.8 } },
  ], presetsLabel: "Швидкий вибір середовища",
  info: "Клітина — осмотична система: протопласт працює як напівпроникна оболонка, а клітинний сік вакуолі — як розчин. За посібником <b>P</b> — осмотичний тиск соку, <b>T</b> — тургорний тиск (тиск протопласта на стінку), <b>S</b> — сисна сила: <b>S = P − T</b>. Водний потенціал клітини <b>Ψ = −P + T = −S</b>; вода рухається туди, де Ψ нижчий.",
  init(P) { const r = rng(5); return { v: 0.97, dots: Array.from({ length: 34 }, () => ({ x: r(), y: r(), s: .3 + r() })), w: Array.from({ length: 16 }, () => ({ u: r(), l: r() })), t: 0 }; },
  step(S, P, dt) {
    const pi = EPS * P.c, psiOut = -pi, psi = cellPsi(S.v, P.wilt), flux = 0.5 * (psiOut - psi);
    S.v = clamp(S.v + flux * dt * 0.25, VMIN, 1); S.flux = flux;
    for (const d of S.dots) { d.x += (Math.sin(S.t * d.s + d.y * 9) * .02 + .004) * dt * 5; d.y += Math.cos(S.t * d.s + d.x * 7) * .012 * dt * 5; if (d.x > 1) d.x = 0; if (d.x < 0) d.x = 1; d.y = clamp(d.y, 0, 1); }
    S.t += dt;
    for (const w of S.w) { w.u += dt * (.25 + w.l * .2) * Math.sign(flux) * clamp(Math.abs(flux) * 5, 0, 1); if (w.u > 1) w.u -= 1; if (w.u < 0) w.u += 1; }
  },
  draw(c, S, P, W, H) {
    D.bg(c, W, H, "#F7FAF6", "#EAF3EC");
    const nar = W < 560; const ph = nar ? H * 0.46 : H - 70; const pw = nar ? W - 12 : W * 0.46; const cx = nar ? W / 2 : pw / 2 + 4, cy = nar ? 40 + ph / 2 : H * 0.5, ww = nar ? Math.min(pw * 0.5, 190) : Math.min(pw - 36, 200), wh = nar ? Math.min(ph - 36, 150) : Math.min(H - 110, 190);
    const t = cellT(S.v, P.wilt), pp = cellP(S.v), s = pp - t, pi = EPS * P.c;
    const sol = mixHex("#EAF4FB", "#F0D589", clamp(P.c / 0.8, 0, 1));
    // зовнішній розчин
    c.fillStyle = sol; D.rr(c, 6, 40, pw - 4, ph, 14); c.fill();
    c.fillStyle = "rgba(201,138,27,.65)";
    for (const d of S.dots) if (P.c > 0.02 && d.y > 0 && (d.x < .08 || d.x > .92 || d.y < .12 || d.y > .88)) { c.beginPath(); c.arc(6 + d.x * (pw - 4), 40 + d.y * ph, 2.2, 0, 7); c.fill(); }
    // стінка
    const x0 = cx - ww / 2, y0 = cy - wh / 2;
    c.save(); D.rr(c, x0 - 7, y0 - 7, ww + 14, wh + 14, 18); c.fillStyle = "#C9A874"; c.fill(); c.restore();
    // протопласт: масштаб за об'ємом (при плазмолізі — відходить від стінки)
    const k = v => Math.sqrt(clamp(v / V0, 0, 1)); const sc = S.v >= V0 ? 1 : k(S.v); const w2 = (ww) * sc, h2 = (wh) * sc;
    D.rr(c, x0, y0, ww, wh, 14); c.fillStyle = P.wilt && S.v < V0 ? "#F2E6CC" : sol; c.fill();
    if (S.v < V0 && P.wilt) { // стінка хвилями
      c.strokeStyle = "#A8864F"; c.lineWidth = 5; c.beginPath(); const amp = (V0 - S.v) / (V0 - VMIN) * 12; for (let i = 0; i <= 60; i++) { const u = i / 60, a = u * Math.PI * 2 * 3.5; const px = x0 + ww * (u < .25 ? u * 4 : u < .5 ? 1 : u < .75 ? 1 - (u - .5) * 4 : 0), py = y0 + wh * (u < .25 ? 0 : u < .5 ? (u - .25) * 4 : u < .75 ? 1 : 1 - (u - .75) * 4); const nx = u < .25 ? 0 : u < .5 ? -1 : u < .75 ? 0 : 1, ny = u < .25 ? 1 : u < .5 ? 0 : u < .75 ? -1 : 0; const q = Math.sin(a) * amp + amp; i ? c.lineTo(px + nx * q, py + ny * q) : c.moveTo(px + nx * q, py + ny * q); } c.closePath(); c.stroke();
    }
    const px0 = cx - w2 / 2, py0 = cy - h2 / 2;
    const gp = c.createLinearGradient(0, py0, 0, py0 + h2); gp.addColorStop(0, "#9CCB7C"); gp.addColorStop(1, "#6DAA62");
    D.rr(c, px0, py0, w2, h2, 12); c.fillStyle = gp; c.fill(); c.strokeStyle = "#3F7D45"; c.lineWidth = 2; c.stroke();
    // вакуоль
    const vw = w2 * 0.74, vh = h2 * 0.7, vg = c.createRadialGradient(cx - vw * .2, cy - vh * .2, 4, cx, cy, vw * .6); const dens = clamp(pp / 1.7, 0, 1);
    vg.addColorStop(0, mixHex("#D8ECFA", "#9DB7E6", dens)); vg.addColorStop(1, mixHex("#9FCBEA", "#6C8CD0", dens));
    D.rr(c, cx - vw / 2, cy - vh / 2, vw, vh, 10); c.fillStyle = vg; c.fill(); c.strokeStyle = "rgba(40,90,150,.5)"; c.stroke();
    // органели
    D.sphere(c, px0 + w2 * .18, py0 + h2 * .22, 7 * sc, "#4F9A57"); D.sphere(c, px0 + w2 * .84, py0 + h2 * .78, 7 * sc, "#4F9A57"); D.sphere(c, px0 + w2 * .84, py0 + h2 * .2, 6 * sc, "#8A6A3A");
    D.txt(c, "клітинний сік", cx, cy, { size: 11, align: "center", color: "#1E4A7A" }); D.txt(c, "стінка", x0 - 10, y0 - 15, { size: 10.5, color: "#7A5C2E", align: "left" });
    D.txt(c, "протопласт", px0 + 6, py0 + h2 - 8, { size: 10, color: "#25522B", align: "left" });
    // молекули води через мембрану
    const fl = S.flux || 0, mv = clamp(Math.abs(fl) * 5, 0, 1);
    if (mv > .03) for (const w of S.w) { const side = w.l * 4 | 0, u = w.u; const dir = Math.sign(fl); // у клітину: від периметра до центру
      const a = side * Math.PI / 2 + w.l * 1.2, rx = w2 / 2 + 14, ry = h2 / 2 + 14; const e = dir > 0 ? 1 - u : u; const x = cx + Math.cos(a) * (rx * (.35 + .65 * e)), y = cy + Math.sin(a) * (ry * (.35 + .65 * e)); D.sphere(c, x, y, 2.6, "#4C9BD6", .85 * mv); }
    // стан
    const state = S.v >= .995 ? "насичена водою: P = T, S = 0" : S.v >= V0 ? "тургесцентна" : P.wilt ? "в'яне: T < 0 (циторіз)" : (V0 - S.v) / (V0 - VMIN) > .75 ? "глибокий плазмоліз" : "плазмоліз: протопласт відстає від стінки";
    D.tag(c, state, cx, 22, { size: 11.5, bg: S.v >= V0 ? "#E6F4EA" : "#FDF1E0", stroke: S.v >= V0 ? C.green : C.amber, color: S.v >= V0 ? C.greenD : "#8A5A10" });
    D.txt(c, `розчин: π = ${fmt(pi, 2)} МПа`, 14, nar ? 40 + ph - 10 : H - 12, { size: 11, color: C.soft });
    // праворуч: стовпчики P,T,S і діаграма Гефлера
    const gx = nar ? 10 : pw + 34, gw = W - gx - 12;
    const bx = gx, by = nar ? 40 + ph + 30 : 40, bw = nar ? W * 0.28 : Math.min(gw * 0.34, 110), bh = nar ? H * 0.2 : H * 0.38; const mx = 1.8;
    D.txt(c, "Показники клітини, МПа", bx, nar ? 40 + ph + 14 : 22, { size: 11.5, weight: 700 });
    const bars = [["P", pp, C.blue], ["T", t, C.green], ["S", s, C.red]]; const bwid = bw / 3 - 6;
    c.strokeStyle = C.rule; c.beginPath(); c.moveTo(bx, by + bh * .5); c.lineTo(bx + bw, by + bh * .5); c.stroke();
    bars.forEach(([n, v, col], i) => { const x = bx + i * (bwid + 8), h = (v / mx) * (bh * .5); c.fillStyle = col; c.globalAlpha = .88; c.fillRect(x, v >= 0 ? by + bh * .5 - h : by + bh * .5, bwid, Math.abs(h)); c.globalAlpha = 1; D.txt(c, n, x + bwid / 2, by + bh + 12, { size: 12, weight: 800, align: "center", color: col }); D.txt(c, fmt(v, 2), x + bwid / 2, v >= 0 ? by + bh * .5 - h - 8 : by + bh * .5 + Math.abs(h) + 9, { size: 10.5, align: "center", color: C.soft }); });
    const hx = nar ? bx + bw + 44 : bx + bw + 40, hw = W - hx - 12, hh = nar ? H - by + 14 - 46 : H - by - 56;
    const vs = []; for (let v = VMIN; v <= 1.0001; v += 0.01) vs.push(v);
    const { X, Y } = D.chart(c, hx, by + 6, hw, hh, { x: [VMIN, 1], y: [-1, 2], xl: "відносний об'єм клітини", yl: "МПа", xt: [.6, .7, .8, .9, 1], yt: [-1, 0, 1, 2], title: "Діаграма Гефлера", series: [
      { pts: vs.map(v => [v, cellP(v)]), col: C.blue, w: 2.4 }, { pts: vs.map(v => [v, cellT(v, P.wilt)]), col: C.green, w: 2.4 }, { pts: vs.map(v => [v, cellP(v) - cellT(v, P.wilt)]), col: C.red, w: 2.4 }],
      hl: [{ y: pi, col: C.amber, label: `π розчину ${fmt(pi, 1)}` }], vl: [{ x: V0, col: C.muted, label: "початок плазмолізу" }], marks: [{ x: S.v, y: pp, col: C.blue, r: 4 }, { x: S.v, y: t, col: C.green, r: 4 }, { x: S.v, y: s, col: C.red, r: 4 }] });
    D.txt(c, "P", X(.62), Y(cellP(.62)) - 10, { size: 11, color: C.blue, weight: 800 }); D.txt(c, "T", X(.97), Y(cellT(.97, P.wilt)) + 11, { size: 11, color: C.green, weight: 800 }); D.txt(c, "S", X(.9), Y(cellP(.9) - cellT(.9, P.wilt)) - 8, { size: 11, color: C.red, weight: 800 });
  },
  reads: (S, P) => { const t = cellT(S.v, P.wilt), pp = cellP(S.v), pi = EPS * P.c; return [["P (осмотичний тиск)", fmt(pp, 2), "МПа"], ["T (тургорний тиск)", fmt(t, 2), "МПа"], ["S = P − T (сисна сила)", fmt(pp - t, 2), "МПа"], ["Ψ клітини / Ψ розчину", `${fmt(-(pp - t), 2)} / ${fmt(-pi, 2)}`, "МПа"], ["Напрямок руху води", Math.abs(S.flux || 0) < .02 ? "рівновага" : S.flux > 0 ? "у клітину" : "з клітини", ""]]; },
});

/* ====================== 2. ФОРМИ ВОДИ В ҐРУНТІ ====================== */
const SOILS = { sand: { n: "Пісок", mg: 1.5, vsv: 4, nv: 14, pv: 40 }, loam: { n: "Суглинок (чорнозем)", mg: 6, vsv: 14, nv: 30, pv: 50 }, clay: { n: "Глина", mg: 11, vsv: 22, nv: 38, pv: 54 } };
reg("w-soil", {
  aspect: (w) => (w < 560 ? 1.05 : 1.55),
  modes: [["sand", "Пісок"], ["loam", "Суглинок"], ["clay", "Глина"]],
  params: [{ k: "m", label: "Вологість ґрунту (% від маси)", min: 0, max: 56, step: 1, v: 30, u: "%" }],
  buttons: [{ label: "💧 Полити (додати воду)", pri: true, run: (S, P, sim) => { sim.P.m = Math.min(sim.def.maxM(sim.P), sim.P.m + 12); sim.sl.m.inp.value = sim.P.m; sim.sl.m.show(); } }],
  maxM: (P) => SOILS[P.mode].pv,
  info: "Класифікація за О. А. Роде: <b>максимальна гігроскопічність</b> (МГ) і вода, адсорбована на частинках, — недоступні; <b>вологість стійкого в'янення</b> (ВСВ) — нижня межа доступності; <b>найменша (польова) вологоємність</b> (НВ) — верхня межа доступної води після стікання гравітаційної; <b>повна вологоємність</b> (ПВ) — усі пори заповнені. Числа — типові орієнтири для типу ґрунту; зріз реальних ґрунтів залежить від їх складу.",
  init(P) { const r = rng(9); return { t: 0, drops: Array.from({ length: 60 }, () => ({ x: r(), y: r(), v: .4 + r() })), sag: 0 }; },
  step(S, P, dt, sim) {
    const k = SOILS[P.mode]; S.t += dt;
    // самі зберігаємо вологість у P.m: гравітаційна вода стікає до НВ, рослина витрачає воду
    if (P.m > k.nv) { P.m = Math.max(k.nv, P.m - dt * 3.2); } else if (P.m > k.mg + .5) { P.m = Math.max(k.mg, P.m - dt * 0.12); }
    sim.sl.m.inp.value = P.m; sim.sl.m.show();
    S.sag = lerp(S.sag, P.m < k.vsv ? 1 : P.m < k.vsv + 3 ? .35 : 0, clamp(dt * 1.5, 0, 1));
    for (const d of S.drops) { if (P.m > k.nv) { d.y += dt * d.v * .35; if (d.y > 1) d.y -= 1; } }
  },
  draw(c, S, P, W, H) {
    const k = SOILS[P.mode]; D.bg(c, W, H, "#EEF5F3", "#E6EFE9");
    const gx = 14, gy = H * .32, gw = W * .38, gh = H * .58;
    // небо і рослина
    const plantX = gx + gw * .42, sag = S.sag;
    c.strokeStyle = "#3F7D45"; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(plantX, gy); c.quadraticCurveTo(plantX + sag * 22, gy - 34, plantX + sag * 46, gy - 50 + sag * 18); c.stroke();
    const leaf = (x, y, a, s) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = mixHex("#59A857", "#B2A64A", sag); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * .5, -s * .32, s, 0); c.quadraticCurveTo(s * .5, s * .32, 0, 0); c.fill(); c.restore(); };
    leaf(plantX + sag * 14, gy - 22, -.5 + sag * 1.3, 38); leaf(plantX + sag * 14, gy - 26, Math.PI + .5 - sag * 1.3, 38); leaf(plantX + sag * 40, gy - 48 + sag * 14, -.9 + sag * 1.8, 28);
    // ґрунт
    const sg = c.createLinearGradient(0, gy, 0, gy + gh); sg.addColorStop(0, "#8B6A47"); sg.addColorStop(1, "#5D4630"); c.fillStyle = sg; D.rr(c, gx, gy, gw, gh, 6); c.fill();
    c.save(); D.rr(c, gx, gy, gw, gh, 6); c.clip();
    const r = rng(3); for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${40 + r() * 60 | 0},${30 + r() * 40 | 0},${20 + r() * 30 | 0},.55)`; c.beginPath(); c.arc(gx + r() * gw, gy + r() * gh, 3 + r() * 4, 0, 7); c.fill(); }
    // вода: рівень заповнення з низу за вологістю
    const lvl = clamp(P.m / k.pv, 0, 1); const wy = gy + gh * (1 - lvl);
    const zones = [[0, k.mg, "#5F8DB8", .55], [k.mg, k.vsv, "#6FA4D4", .5], [k.vsv, k.nv, "#7FBCEB", .5], [k.nv, k.pv, "#A4D5F5", .45]];
    for (const [a, b, col, al] of zones) { const ya = gy + gh * (1 - clamp(b / k.pv, 0, 1)), yb = gy + gh * (1 - clamp(a / k.pv, 0, 1)); const top = Math.max(ya, wy); if (yb > top) { c.fillStyle = alpha(col, al); c.fillRect(gx, top, gw, yb - top); } }
    for (const d of S.drops) if (P.m > k.nv && d.y > (wy - gy) / gh - 0.2) { c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.arc(gx + d.x * gw, gy + d.y * gh, 2.2, 0, 7); c.fill(); }
    c.restore();
    c.strokeStyle = "rgba(60,40,20,.8)"; c.lineWidth = 2; D.rr(c, gx, gy, gw, gh, 6); c.stroke();
    // корені
    c.strokeStyle = "rgba(240,230,205,.85)"; c.lineWidth = 2.4; c.beginPath(); c.moveTo(plantX, gy); c.lineTo(plantX, gy + gh * .55); for (const [dx, dy] of [[-30, .3], [34, .38], [-18, .5], [20, .6]]) { c.moveTo(plantX, gy + gh * dy * .75); c.quadraticCurveTo(plantX + dx * .5, gy + gh * dy, plantX + dx, gy + gh * (dy + .12)); } c.stroke();
    // шкала констант
    const sx = gx + gw + 66, sw = 26, sy = gy, sh = gh; const Y = (m) => sy + sh * (1 - m / k.pv);
    const bands = [[0, k.mg, "#5F8DB8", "МГ: недоступна"], [k.mg, k.vsv, "#7FB0DA", "важкодоступна (плівкова)"], [k.vsv, k.nv, "#53B26B", "ДОСТУПНА рослині"], [k.nv, k.pv, "#E3B253", "гравітаційна: надлишок, мало O₂"]];
    for (const [a, b, col] of bands) { c.fillStyle = col; c.fillRect(sx, Y(b), sw, Y(a) - Y(b)); }
    c.strokeStyle = C.ink; c.lineWidth = 1.2; c.strokeRect(sx, sy, sw, sh);
    const cons = [["ПВ", k.pv], ["НВ", k.nv], ["ВСВ", k.vsv], ["МГ", k.mg]];
    for (const [n, m] of cons) { c.strokeStyle = C.ink; c.beginPath(); c.moveTo(sx - 4, Y(m)); c.lineTo(sx + sw + 4, Y(m)); c.stroke(); D.txt(c, `${n} ${fmt(m, m % 1 ? 1 : 0)} %`, sx - 8, Y(m), { size: 11, weight: 700, color: C.ink, align: "right" }); }
    const bl = [["недоступна", (k.mg) / 2, "#3E6C99"], ["важкодоступна", (k.mg + k.vsv) / 2 + 1, "#3E6C99"], ["ДОСТУПНА", (k.vsv + k.nv) / 2, "#1C7A3A"], ["надлишок", (k.nv + k.pv) / 2, "#A56E10"]];
    const lx = sx + sw + 8; for (const [n, m, col] of bl) D.txt(c, n, lx, Y(m), { size: 11, color: col, weight: 800 });
    // поточний рівень
    const my = Y(P.m); D.arrow(c, sx + sw + 70, my, sx + sw + 3, my, C.red, 2.4, 7); D.tag(c, `${fmt(P.m, 0)} %`, Math.min(sx + sw + 92, W - 28), my, { size: 11.5, bg: "#FDECEA", stroke: C.red, color: C.red });
    const st = P.m < k.vsv ? "Рослина в'яне: вода недоступна" : P.m > k.nv ? "Надлишок: гравітаційна вода стікає" : "Вода доступна: між ВСВ і НВ";
    D.tag(c, st, W < 560 ? W / 2 : gx + gw / 2, 18, { size: 11.5, bg: P.m < k.vsv ? "#FDECEA" : P.m > k.nv ? "#FCF3DF" : "#E6F4EA", stroke: P.m < k.vsv ? C.red : P.m > k.nv ? C.amber : C.green, color: P.m < k.vsv ? C.red : P.m > k.nv ? "#8A5A10" : C.greenD });
  },
  reads: (S, P) => { const k = SOILS[P.mode]; const avail = clamp(P.m - k.vsv, 0, k.nv - k.vsv); return [["Тип ґрунту", k.n, ""], ["Доступна вода зараз", fmt(avail, 0), "% маси ґрунту"], ["Запас доступної води (НВ − ВСВ)", fmt(k.nv - k.vsv, 0), "%"], ["Стан рослини", P.m < k.vsv ? "в'янення" : P.m > k.nv ? "надлишок води" : "норма", ""]]; },
});

/* ====================== 3. РАДІАЛЬНИЙ ТРАНСПОРТ ВОДИ В КОРЕНІ ====================== */
// колонки: 0 ризодерма(+волосок), 1-3 кора, 4 ендодерма, 5 перицикл, 6 ксилема
reg("w-root", {
  aspect: (w) => (w < 560 ? 1.15 : 1.75),
  toggles: [{ k: "apo", label: "Показати апопластний шлях (по стінках)", v: true }, { k: "sym", label: "Показати симпластний шлях (через цитоплазму)", v: true }, { k: "cas", label: "Пояски Каспарі є (ендодерма)", v: true }],
  params: [{ k: "pump", label: "Робота іонних помп паренхіми (кореневий тиск)", min: 0, max: 100, step: 5, v: 60, u: "%" }],
  info: "Вода з ґрунту потрапляє через кореневі волоски, рухається по <b>апопласту</b> (клітинні стінки, швидше) чи <b>симпласту</b> (цитоплазма, з'єднана плазмодесмами), а на <b>ендодермі</b> апопластний шлях перекривають <b>пояски Каспарі</b> (лігнін і суберин): далі вода проходить лише через протопласти — тож клітини контролюють, що потрапляє в ксилему. Іонні помпи нагнітають іони в судини, ксилемний сік стає «солонішим», вода входить осмосом — виникає <b>кореневий тиск</b>.",
  init() { const r = rng(21); return { ps: Array.from({ length: 36 }, (_, k) => ({ kind: k % 2 ? "a" : "s", u: r(), row: r() * 5 | 0, g: 1 + (r() * 4 | 0), sp: .1 + r() * .05 })), t: 0, flow: 0 }; },
  step(S, P, dt) {
    S.t += dt; const pump = P.pump / 100 + .15; S.flow = pump;
    for (const p of S.ps) { p.u += dt * p.sp * (.5 + pump * 1.3) * (p.kind === "a" ? 1.5 : 1); if (p.u >= 1) { p.u = 0; p.row = Math.random() * 5 | 0; p.g = 1 + (Math.random() * 4 | 0); } }
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#F4F8F2", "#E8F0E8");
    const nar = W < 560; const L = 12, R = W - 12, T = nar ? 64 : 54, B = H - 34, cols = 7, cw = (R - L) / cols, rows = 5, rh = (B - T) / rows;
    const colX = (i) => L + i * cw; const rowY = (j) => T + j * rh;
    // фон-зони
    const zones = [[0, 1, "#E3F0D2", "ризодерма"], [1, 4, "#EEF5DC", "первинна кора"], [4, 5, "#F4E3B8", "ендодерма"], [5, 6, "#EDE1CB", "перицикл"], [6, 7, "#D3E8F4", "ксилема"]];
    for (const [a, b, col, n] of zones) { c.fillStyle = col; c.fillRect(colX(a), T, (b - a) * cw, B - T); D.txt(c, n, colX(a) + (b - a) * cw / 2, T - 14, { size: 11, weight: 700, align: "center", color: C.soft }); }
    D.txt(c, "ґрунтовий розчин →", L + 2, B + 18, { size: 11, color: C.blue, weight: 700 }); D.txt(c, "→ судини ксилеми", R - 2, B + 18, { size: 11, color: C.blue, weight: 700, align: "right" });
    // клітини (з тонкими стінками-апопластом)
    for (let i = 0; i < 6; i++) for (let j = 0; j < rows; j++) {
      const x = colX(i) + 3, y = rowY(j) + 3, w = cw - 6, h = rh - 6; const endo = i === 4;
      D.rr(c, x, y, w, h, endo ? 5 : 9); c.fillStyle = endo ? "#E7C778" : i === 0 ? "#B8D98A" : "#CDE5A9"; c.fill(); c.strokeStyle = "#B49A62"; c.lineWidth = 3; c.stroke();
      D.rr(c, x + 5, y + 5, w - 10, h - 10, 5); c.fillStyle = "rgba(255,255,255,.35)"; c.fill(); // вакуоль
    }
    // кореневий волосок
    c.fillStyle = "#B8D98A"; c.strokeStyle = "#B49A62"; c.lineWidth = 2.5; for (const j of [1, 3]) { D.rr(c, L - 12, rowY(j) + rh * .3, 22, rh * .4, 6); c.fill(); c.stroke(); }
    // пояски Каспарі: тіні радіальних стінок ендодерми
    const ex = colX(4); if (P.cas) { c.fillStyle = "rgba(122,76,28,.92)"; for (let j = 0; j < rows; j++) { if (j === 2) continue; c.fillRect(ex + 1, rowY(j) + 3, cw - 2, 6); c.fillRect(ex + 1, rowY(j) + rh - 9, cw - 2, 6); } }
    // пропускна клітина
    D.txt(c, "пропускна клітина", ex + cw / 2, rowY(2) + rh / 2 - 22, { size: 9.5, align: "center", color: "#7A5C2E" });
    if (P.cas) D.tag(c, "пояски Каспарі", ex + cw / 2, B + 18, { size: 10.5, bg: "#F4E3C6", stroke: "#7A4C1C", color: "#6A3F12" });
    // судини ксилеми
    c.fillStyle = "#BFE0F2"; c.fillRect(colX(6) + 5, T + 4, cw - 10, B - T - 8); c.strokeStyle = "#5C8FB0"; c.lineWidth = 2; c.strokeRect(colX(6) + 5, T + 4, cw - 10, B - T - 8);
    const flow = S.flow; // піднімаються бульбашки/стрілки в судині
    for (let k = 0; k < 6; k++) { const u = ((t * (.12 + flow * .3) + k / 6) % 1); const yy = B - 10 - u * (B - T - 20); c.fillStyle = "rgba(60,120,180,.55)"; c.beginPath(); c.arc(colX(6) + cw / 2, yy, 2.4, 0, 7); c.fill(); }
    D.arrow(c, colX(6) + cw / 2, T + 36, colX(6) + cw / 2, T + 8, C.blue, 2.4, 8); D.txt(c, "вгору", colX(6) + cw / 2, T + 48, { size: 10, align: "center", color: C.blue });
    // частинки: шляхи (ламані; позиція — за довжиною дуги)
    const xE = colX(4), xP = colX(5), xX = colX(6), xEnd = colX(6) + cw / 2, y2 = rowY(2) + rh * .5;
    const polyAt = (pts, u) => { let tot = 0; const ls = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); ls.push(l); tot += l; } let d = u * tot; for (let i = 0; i < ls.length; i++) { if (d <= ls[i]) { const k = d / (ls[i] || 1); return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k), i]; } d -= ls[i]; } return [pts[pts.length - 1][0], pts[pts.length - 1][1], ls.length - 1]; };
    for (const p of S.ps) {
      if (p.kind === "a" && !P.apo) continue; if (p.kind === "s" && !P.sym) continue;
      let x, y, col;
      if (p.kind === "a") {
        const yg = rowY(p.g); const pts = P.cas ? [[L - 8, yg], [xE - 2, yg], [xE - 2, y2], [xP + cw - 8, y2], [xX + 3, y2], [xEnd, y2]] : [[L - 8, yg], [xX + 3, yg], [xEnd, yg]];
        [x, y, p.seg] = polyAt(pts, p.u); col = P.cas && p.seg >= 2 && p.seg <= 3 ? "#C0392B" : "#2E6FB5";
      } else { const yy = rowY(p.row) + rh * .5; [x, y] = polyAt([[L - 8, yy], [xX + 3, yy], [xEnd, yy]], p.u); col = "#C0392B"; }
      D.glow(c, x, y, 9, col, .35); D.sphere(c, x, y, 3.4, col, .95);
    }
    // лічильник частки шляхів
    c.fillStyle = "#2E6FB5"; c.fillRect(L, 12, 12, 12); D.txt(c, "апопласт (стінки)", L + 17, 18, { size: 11, color: C.soft }); c.fillStyle = "#C0392B"; c.fillRect(L + 140, 12, 12, 12); D.txt(c, "симпласт (цитоплазма)", L + 157, 18, { size: 11, color: C.soft });
    if (!P.cas) D.tag(c, "без поясків Каспарі апопласт веде воду в ксилему безконтрольно", W / 2, 36, { size: 10.5, bg: "#FDECEA", stroke: C.red, color: C.red });
  },
  reads: (S, P) => { const press = (P.pump / 100) * 0.9; return [["Кореневий тиск (умовно)", fmt(press, 2), "МПа"], ["Контроль складу розчину ендодермою", P.cas ? "є: вода проходить через протопласти" : "немає: апопласт відкритий", ""], ["Швидший шлях", "апопласт (менший опір)", ""]]; },
});
