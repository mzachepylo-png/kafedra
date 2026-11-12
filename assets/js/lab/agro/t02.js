// Тема 2. Культура калюсної тканини (ЛР 8–12, с. 61–72 посібника Мельничука, Кляченко, 2014).
// Вкладка А — індукція калюсу на експлантатах сої, тютюну, пшениці й квасолі залежно від фітогормонів;
// вкладка Б — пасаж (перенесення калюсу на свіже середовище, ЛР 9).
import * as K from './kit.js';
import {
  drawCallus, vial, tag, thermostat, simulate, at, phases, phaseAt, BandPlot, tabs, reads, select, checkbox, fmtMg, agarFill, glassShine,
} from './t02-lib.js';

const { fnum, clamp, lerp, smooth, rng, TAU, hex, rgba, mix, shade, easeInOut } = K;
const $ = (id) => document.getElementById(id);
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

/* ======================================================================
   Параметри моделі індукції калюсу
   ======================================================================
   Посібник (с. 62): обов'язкова умова дедиференціації — ауксини (викликають дедиференціацію) і цитокініни
   (проліферацію), оптимум ауксин : цитокінін ≈ 10 : 1; на безгормональному середовищі калюс не утворюється.
   Виняток (с. 65): незрілі зародки пшениці утворюють калюс на 2,4-Д без цитокінінів (високий ендогенний вміст).
   Для злаків потрібні високі концентрації ауксинів — 2,4-Д, НОК до 10 мг/л (с. 70); у дводольних
   дедиференціація відбувається легше (с. 64). Кількісні константи нижче — правдоподібне наближення
   (рівняння Хілла), посібник їх не наводить.
     a = A·pA + a_end,  c = C·pC + c_end   (pA, pC — відносна активність гормону)
     D = a²/(Ka² + a²) — дедиференціація;  P = c²/(Kc² + c²) — проліферація;  I = 1/(1 + (a/Ki)³) — токсичність
     F = Fmax·D·P·I — частота калюсоутворення;  μ = μmax·D·P·I — питома швидкість росту калюсу.            */
const AUX = { d24: { name: '2,4-Д', pot: 1 }, naa: { name: 'НОК', pot: 0.55 }, iaa: { name: 'ІОК', pot: 0.3 }, none: { name: '—', pot: 0 } };
const CYT = { bap: { name: '6-БАП', pot: 1 }, kin: { name: 'кінетин', pot: 0.6 }, none: { name: '—', pot: 0 } };

const EXPL = {
  soy: { name: 'Сім’ядолі сої', lr: 'ЛР 8', vessel: 'vial', n: 3, mono: false, Ka: 0.35, Kc: 0.1, endoA: 0.02, endoC: 0.03, Ki: 6, mu: 0.27, lag: 8, W0: 45, Fmax: 0.95, color: '#EFE2BB', yellow: 0.2, greenAb: 0.8, organo: 0.4, fr: 0.05, tissue: 'cot' },
  tobacco: { name: 'Стебло й листок тютюну', lr: 'ЛР 10', vessel: 'vial', n: 3, mono: false, Ka: 0.15, Kc: 0.05, endoA: 0.03, endoC: 0.03, Ki: 6, mu: 0.34, lag: 6, W0: 70, Fmax: 0.98, color: '#F2EBD3', yellow: 0.05, greenAb: 0.7, organo: 1, fr: 0.1, tissue: 'leaf' },
  embryo: { name: 'Незрілий зародок пшениці', lr: 'ЛР 11', vessel: 'tube', n: 4, mono: true, Ka: 0.9, Kc: 0.06, endoA: 0, endoC: 0.2, Ki: 16, mu: 0.28, lag: 5, W0: 2, Fmax: 0.92, color: '#F3E9C6', yellow: 0.4, greenAb: 0.25, organo: 0.25, fr: -0.2, tissue: 'embryo' },
  node: { name: 'Вузол кущення пшениці', lr: 'ЛР 11', vessel: 'tube', n: 4, mono: true, Ka: 1.8, Kc: 0.06, endoA: 0, endoC: 0.05, Ki: 16, mu: 0.24, lag: 6, W0: 25, Fmax: 0.8, color: '#EFE6C6', yellow: 0.3, greenAb: 0.3, organo: 0.15, fr: -0.1, tissue: 'node' },
  bean: { name: 'Корінці квасолі', lr: 'ЛР 12', vessel: 'petri', n: 15, mono: false, Ka: 0.4, Kc: 0.07, endoA: 0.02, endoC: 0.04, Ki: 6, mu: 0.28, lag: 7, W0: 3, Fmax: 0.92, color: '#F4EDD7', yellow: 0.1, greenAb: 0.2, organo: 0.1, fr: 0.05, tissue: 'root' },
};

const PRESETS = {
  lr8: { label: 'ЛР 8 · соя', e: 'soy', aux: 'iaa', A: 2, cyt: 'kin', C: 0.5, light: false, days: 28, medium: 'Міллер + ІОК 2 мг/л + кінетин 0,5 мг/л' },
  lr10a: { label: 'ЛР 10а · тютюн, 2,4-Д', e: 'tobacco', aux: 'd24', A: 1, cyt: 'bap', C: 0.2, light: false, days: 28, medium: 'МС + 2,4-Д 1 мг/л + 6-БАП 0,2 мг/л' },
  lr10b: { label: 'ЛР 10б · тютюн, ІОК', e: 'tobacco', aux: 'iaa', A: 1, cyt: 'bap', C: 0.2, light: false, days: 28, medium: 'МС + ІОК 1 мг/л + 6-БАП 0,2 мг/л' },
  lr11a: { label: 'ЛР 11 · зародки', e: 'embryo', aux: 'none', A: 0, cyt: 'none', C: 0, light: true, days: 21, medium: 'МС без гормонів (отримання пробіркових рослин)' },
  lr11b: { label: 'ЛР 11 · вузли кущення', e: 'node', aux: 'd24', A: 4, cyt: 'none', C: 0, light: true, days: 14, medium: 'МС + 2,4-Д 4 мг/л' },
  lr12: { label: 'ЛР 12 · квасоля', e: 'bean', aux: 'd24', A: 2, cyt: 'kin', C: 0.2, light: false, days: 28, medium: 'МС + 2,4-Д 2 мг/л + кінетин 0,2 мг/л' },
};

function induction(E, s) {
  const a = (s.aux === 'none' ? 0 : s.A * AUX[s.aux].pot * (s.aux === 'iaa' && s.light ? 0.6 : 1)) + E.endoA;
  const c = (s.cyt === 'none' ? 0 : s.C * CYT[s.cyt].pot) + E.endoC;
  const D = (a * a) / (E.Ka * E.Ka + a * a), P = (c * c) / (E.Kc * E.Kc + c * c), I = 1 / (1 + Math.pow(a / E.Ki, 3));
  const Araw = s.aux === 'none' ? 0 : s.A, Craw = s.cyt === 'none' ? 0 : s.C;
  const rEff = (Craw * (CYT[s.cyt]?.pot || 0)) / (Araw * (AUX[s.aux]?.pot || 0) + 0.02);
  // органогенез (тема 4): бруньки на світлі, коли цитокінін переважає; корені — лише ІОК/НОК без цитокініну
  const buds = E.organo * (s.light ? 1 : 0.15) * smooth(0.35, 1.3, rEff) * D * 0.9;
  const roots = !E.mono && (s.aux === 'iaa' || s.aux === 'naa') && Craw < 0.05 ? smooth(0.2, 1.5, Araw) * (1 - smooth(4, 8, Araw)) * 0.9 : 0;
  const germ = E.tissue === 'embryo' ? clamp(1 - D * 1.25, 0, 1) : 0;
  // надлишок цитокініну відносно ауксину відводить клітини від калюсогенезу (баланс ≈ 10 : 1 оптимальний)
  const bal = 0.55 + 0.45 / (1 + Math.pow(rEff / 0.45, 2));
  let F = E.Fmax * D * P * I * bal * (1 - 0.35 * buds) * (1 - germ);
  const mu = E.mu * D * P * I * (0.4 + 0.6 * bal) * (1 - 0.3 * buds) * (s.light ? 0.92 : 1);
  const d24share = s.aux === 'd24' ? 1 : s.aux === 'naa' ? 0.45 : 0;
  const fr = clamp(0.35 + 0.45 * d24share * smooth(0.2, 2.5, Araw) + E.fr - 0.35 * (c / (c + 0.35)) + (s.aux === 'iaa' ? -0.12 : 0), 0.05, 0.95);
  const green = s.light ? E.greenAb * clamp(0.25 + 0.6 * (c / (c + 0.25)) - 0.2 * d24share, 0, 1) : 0;
  return { a, c, D, P, I, F: clamp(F, 0, 1), mu, buds, roots, germ, fr, green, Araw, Craw };
}
const densityName = (fr) => (fr > 0.62 ? 'пухкий' : fr > 0.36 ? 'середньої щільності' : 'щільний');

/* ======================================================================
   Експлантати (2.5D)
   ====================================================================== */
function slab(ctx, cx, cy, L, W, th, top, side, rot = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = rgba(side); ctx.beginPath(); ctx.ellipse(0, th * 0.5, L / 2, W / 2, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-L * 0.18, -W * 0.25, 1, 0, 0, L * 0.6);
  g.addColorStop(0, rgba(shade(top, 0.25))); g.addColorStop(0.6, rgba(top)); g.addColorStop(1, rgba(shade(top, -0.18)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, L / 2, W / 2, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
/** Циліндричний сегмент, що лежить на агарі (стебло, вузол, корінь). */
function cylinder(ctx, cx, cy, L, d, col, { cut = '#F2ECCF', rot = 0, notches = 0, rings = 0, tip = false } = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  const g = ctx.createLinearGradient(0, -d / 2, 0, d / 2);
  g.addColorStop(0, rgba(shade(col, 0.35))); g.addColorStop(0.35, rgba(col)); g.addColorStop(1, rgba(shade(col, -0.35)));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-L / 2, -d / 2); ctx.lineTo(L / 2, -d / 2);
  if (tip) ctx.quadraticCurveTo(L / 2 + d * 0.9, 0, L / 2, d / 2); else ctx.lineTo(L / 2, d / 2);
  ctx.lineTo(-L / 2, d / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-L / 2, -d * 0.32, L, d * 0.12);
  for (let i = 0; i < notches; i++) { const x = -L / 2 + L * (i + 0.6) / (notches + 0.2); ctx.strokeStyle = 'rgba(40,70,25,.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x, -d / 2); ctx.lineTo(x - d * 0.2, d * 0.2); ctx.stroke(); }
  for (let i = 0; i < rings; i++) { const x = -L / 2 + L * (i + 1) / (rings + 1); ctx.strokeStyle = 'rgba(60,90,40,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, 0, d * 0.12, d / 2, 0, 0, TAU); ctx.stroke(); }
  // зрізи (світлі торці)
  const cg = ctx.createRadialGradient(-L / 2 - d * 0.05, -d * 0.1, 0.5, -L / 2, 0, d * 0.55);
  cg.addColorStop(0, rgba(shade(cut, 0.2))); cg.addColorStop(1, rgba(shade(cut, -0.12)));
  ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(-L / 2, 0, d * 0.2, d / 2, 0, 0, TAU); ctx.fill();
  if (!tip) { ctx.beginPath(); ctx.ellipse(L / 2, 0, d * 0.2, d / 2, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawExplant(ctx, E, x, y, pxmm, { light = false, brown = 0, seed = 1 } = {}) {
  const br = (c) => mix(c, [130, 96, 52], brown * 0.8);
  if (E.tissue === 'cot') {
    const top = br(light ? [150, 186, 88] : [214, 206, 140]);
    slab(ctx, x, y, 7 * pxmm, 4.6 * pxmm, Math.max(1.5, 1.1 * pxmm), top, shade(top, -0.35), (seed % 3 - 1) * 0.15);
  } else if (E.tissue === 'leaf') {
    cylinder(ctx, x, y - 1.2 * pxmm, 13 * pxmm, 3.2 * pxmm, br([104, 150, 70]), { notches: 5, cut: '#E6E9C2', rot: (seed % 3 - 1) * 0.06 });
  } else if (E.tissue === 'embryo') {
    const s = Math.max(5, 2.2 * pxmm);
    slab(ctx, x, y, s * 1.5, s, s * 0.35, br([238, 228, 186]), [190, 176, 120]);
    ctx.fillStyle = rgba(br([226, 214, 160]), 0.9); ctx.beginPath(); ctx.ellipse(x + s * 0.25, y - s * 0.05, s * 0.32, s * 0.2, 0.4, 0, TAU); ctx.fill();
  } else if (E.tissue === 'node') {
    cylinder(ctx, x, y - 0.9 * pxmm, 7 * pxmm, 2.4 * pxmm, br(light ? [150, 190, 100] : [200, 205, 150]), { rings: 2, cut: '#EEEACB' });
  } else if (E.tissue === 'root') {
    cylinder(ctx, x, y, Math.max(9, 3 * pxmm), Math.max(2.4, 0.8 * pxmm), br([246, 240, 220]), { tip: true, cut: '#FFFBEA', rot: seed * 1.7 });
  }
}

/* ======================================================================
   Поле зору мікроскопа: клітини експлантата під час дедиференціації
   ====================================================================== */
function cellField(ctx, f, st) {
  const { cx, cy, r } = f, R = rng(7);
  const elong = st.tissue === 'root' || st.tissue === 'node' || st.tissue === 'leaf' ? 1.6 : 1.05;
  const cs = r * (st.tissue === 'embryo' ? 0.27 : 0.42);
  const cw = cs * elong, ch = cs;
  const nx = Math.ceil((2 * r) / cw) + 2, ny = Math.ceil((2 * r) / ch) + 2;
  const P = [];
  for (let j = 0; j <= ny; j++) { P[j] = []; for (let i = 0; i <= nx; i++) { const off = j % 2 ? cw * 0.5 : 0; P[j][i] = [cx - r - cw + i * cw + off * 0 + (R() - 0.5) * cw * 0.28, cy - r - ch + j * ch + (R() - 0.5) * ch * 0.28]; } }
  const wallC = rgba(mix([120, 108, 70], [110, 70, 35], st.dying), 0.8);
  const div = st.div; // 0..3
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = [P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]];
    const subs = splitQuad(q, Math.floor(div + (R() < div % 1 ? 1 : 0)), cw > ch);
    for (const s of subs) cellInQuad(ctx, s, st, R, wallC, s !== q);
  }
}
function splitQuad(q, n, horiz) {
  if (n <= 0) return [q];
  const m = (a, b, t = 0.5) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const t = 0.42;
  let A, B;
  if (horiz) { const p = m(q[0], q[1], t + 0.08), s = m(q[3], q[2], t + 0.04); A = [q[0], p, s, q[3]]; B = [p, q[1], q[2], s]; }
  else { const p = m(q[1], q[2], t + 0.06), s = m(q[0], q[3], t + 0.1); A = [q[0], q[1], p, s]; B = [s, p, q[2], q[3]]; }
  return [...splitQuad(A, n - 1, !horiz), ...splitQuad(B, n - 1, !horiz)];
}
function cellInQuad(ctx, q, st, R, wallC, young) {
  const c = [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
  const rad = Math.min(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1])) / 2;
  const inset = (k) => q.map((p) => [lerp(c[0], p[0], k), lerp(c[1], p[1], k)]);
  const path = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
  const prog = st.prog, dying = st.dying;
  // клітинна стінка й протопласт
  path(inset(0.97)); ctx.fillStyle = 'rgba(250,247,232,.5)'; ctx.fill();
  const cyto = mix(mix([226, 228, 196], [214, 206, 168], prog), [168, 128, 76], dying);
  path(inset(0.9 - dying * 0.25));
  const g = ctx.createRadialGradient(c[0] - rad * 0.3, c[1] - rad * 0.3, 1, c[0], c[1], rad * 1.3);
  g.addColorStop(0, rgba(shade(cyto, 0.15), 0.25 + prog * 0.5)); g.addColorStop(1, rgba(shade(cyto, -0.1), 0.45 + prog * 0.45));
  ctx.fillStyle = g; ctx.fill();
  // велика вакуоля диференційованої клітини зменшується при дедиференціації
  const vk = 0.78 * (1 - prog * 0.75);
  if (vk > 0.15 && dying < 0.6) { path(inset(vk)); ctx.fillStyle = 'rgba(253,252,244,.55)'; ctx.fill(); }
  // хлоропласти зникають (с. 68)
  const nch = Math.round(st.chloro * (1 - smooth(0.1, 0.7, prog)));
  for (let k = 0; k < nch; k++) {
    const e = R() * 4 | 0, t = R(), p = [lerp(q[e][0], q[(e + 1) % 4][0], t), lerp(q[e][1], q[(e + 1) % 4][1], t)];
    const pp = [lerp(c[0], p[0], 0.8), lerp(c[1], p[1], 0.8)];
    const cg = ctx.createRadialGradient(pp[0] - 0.5, pp[1] - 0.5, 0.2, pp[0], pp[1], rad * 0.13);
    cg.addColorStop(0, '#A8D873'); cg.addColorStop(1, dying > 0.4 ? '#6A6A3A' : '#2F7A2A');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(pp[0], pp[1], rad * 0.13, rad * 0.08, R() * 3, 0, TAU); ctx.fill();
  }
  for (let k = 0; k < st.starch; k++) { const a = R() * TAU, d = R() * rad * 0.5; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.strokeStyle = 'rgba(120,110,80,.4)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d, rad * 0.07, 0, TAU); ctx.fill(); ctx.stroke(); }
  // ядро: збільшується й переходить у центр
  const nr = rad * lerp(0.17, 0.33, prog) * (1 - dying * 0.35);
  const off = (1 - prog) * rad * 0.45, na = R() * TAU;
  const nx = c[0] + Math.cos(na) * off, ny = c[1] + Math.sin(na) * off;
  const ncol = mix([150, 138, 104], [96, 66, 40], dying);
  const ng = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.3, 0.3, nx, ny, nr);
  ng.addColorStop(0, rgba(shade(ncol, 0.32), 0.95)); ng.addColorStop(1, rgba(shade(ncol, -0.2), 0.95));
  ctx.fillStyle = ng; ctx.beginPath(); ctx.ellipse(nx, ny, nr, nr * (0.8 + prog * 0.2), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba(shade(ncol, -0.45), 0.85); ctx.beginPath(); ctx.arc(nx + nr * 0.2, ny - nr * 0.15, nr * (0.22 + prog * 0.1), 0, TAU); ctx.fill();
  // стінки (молоді — тонші й світліші)
  path(q); ctx.strokeStyle = young ? 'rgba(140,128,90,.55)' : wallC; ctx.lineWidth = young ? 0.8 : 1.6; ctx.stroke();
}
function microInset(ctx, cx, cy, r, st, label, stage, side = false) {
  K.microField(ctx, cx, cy, r, (c, f) => cellField(c, f, st), { mode: 'bright' });
  if (side) {
    const x = cx - r * 1.12 - 8;
    tag(ctx, x, cy - 4, label, { size: 10.5, dark: true, align: 'right' });
    tag(ctx, x, cy + 20, stage, { size: 11.5, dark: true, align: 'right' });
  } else {
    tag(ctx, cx, cy + r * 1.1 + 15, label, { size: 10.5, dark: true });
    tag(ctx, cx, cy + r * 1.1 + 36, stage, { size: 11.5, dark: true });
  }
}
function cellState(E, ind, t, Tmax) {
  const lag = E.lag;
  const active = ind.D * ind.P * ind.I;
  const chloro = E.tissue === 'leaf' || (E.tissue === 'cot') || E.tissue === 'node' ? 7 : 0;
  const starch = E.tissue === 'cot' || E.tissue === 'embryo' ? 4 : E.tissue === 'root' ? 1 : 0;
  const prog = clamp(smooth(0.15 * lag, lag, t) * clamp(active * 1.4, 0, 1), 0, 1);
  const div = clamp((t - lag) / 6, 0, 2.6) * clamp(active * 1.5, 0, 1);
  const dying = ind.germ > 0.5 ? 0 : (1 - clamp(active * 2.5, 0, 1)) * smooth(Tmax * 0.3, Tmax * 1.4, t) * 0.8;
  let stage = 'диференційовані клітини';
  if (dying > 0.25) stage = 'старіння, побуріння клітин';
  else if (ind.germ > 0.5) stage = 'клітини зародка: проростання';
  else if (div > 0.4) stage = 'поділи: утворюється калюс';
  else if (prog > 0.2) stage = 'дедиференціація';
  return { tissue: E.tissue, chloro, starch, prog, div, dying, stage };
}

/* ======================================================================
   Вкладка А: індукція калюсу
   ====================================================================== */
function modelA() {
  const cv = $('t2a-cv'); if (!cv) return;
  const st = { preset: 'lr10a', ...PRESETS.lr10a, t: 0 };
  const setR = reads($('t2a-reads'), [
    ['F', 'Частота калюсоутворення (% експлантатів)'], ['m', 'Маса калюсу на кінець досліду'], ['dw', 'Індекс приросту (W<sub>t</sub> − W<sub>0</sub>)/W<sub>0</sub>'],
    ['ratio', 'Ауксин : цитокінін (мг/л)'], ['type', 'Тип калюсу (за Р. Г. Бутенко)'], ['day', 'Доба культивування'],
  ]);
  // ---- керування
  const presBox = $('t2a-preset');
  const presSeg = K.segmented(presBox, 't2a-pre', Object.entries(PRESETS).map(([k, v]) => ({ value: k, label: v.label })), st.preset, (v) => applyPreset(v));
  const expSel = select($('t2a-exp'), 'Експлантат', Object.entries(EXPL).map(([k, v]) => [k, `${v.name} (${v.lr})`]), st.e, (v) => { st.e = v; changed(); }, 't2a-e');
  const auxSeg = K.segmented($('t2a-auxt'), 't2a-aux', [{ value: 'd24', label: '2,4-Д' }, { value: 'naa', label: 'НОК' }, { value: 'iaa', label: 'ІОК' }, { value: 'none', label: 'без' }], st.aux, (v) => { st.aux = v; changed(); });
  const cytSeg = K.segmented($('t2a-cytt'), 't2a-cyt', [{ value: 'bap', label: '6-БАП' }, { value: 'kin', label: 'кінетин' }, { value: 'none', label: 'без' }], st.cyt, (v) => { st.cyt = v; changed(); });
  const sl = K.sliders($('t2a-sl'), [
    { id: 'A', label: 'Ауксин', min: 0, max: 10, step: 0.1, value: st.A, unit: 'мг/л', digits: 1, hint: '2,4-Д діє найсильніше; ІОК руйнується ферментами й світлом' },
    { id: 'C', label: 'Цитокінін', min: 0, max: 2, step: 0.05, value: st.C, unit: 'мг/л', digits: 2, hint: 'Запускає поділ дедиференційованих клітин' },
  ], () => { st.A = sl.values.A; st.C = sl.values.C; changed(); });
  const lightSeg = K.segmented($('t2a-light'), 't2a-l', [{ value: 'dark', label: 'Темрява (термостат)' }, { value: 'light', label: 'Світло 16 год' }], st.light ? 'light' : 'dark', (v) => { st.light = v === 'light'; changed(); });
  const dsl = K.sliders($('t2a-days'), [{ id: 'days', label: 'Тривалість досліду', min: 7, max: 42, step: 1, value: st.days, unit: 'діб', digits: 0 }], () => { st.days = dsl.values.days; changed(); });

  function applyPreset(k) {
    const p = PRESETS[k]; Object.assign(st, p, { preset: k });
    expSel.value = p.e; auxSeg.select(p.aux); cytSeg.select(p.cyt); lightSeg.select(p.light ? 'light' : 'dark');
    sl.set('A', p.A, true); sl.set('C', p.C, true); dsl.set('days', p.days, true);
    changed();
  }

  // ---- розрахунок
  let M = null;
  function compute() {
    const E = EXPL[st.e], ind = induction(E, st);
    const S0 = E.vessel === 'petri' ? 30 : E.vessel === 'tube' ? 140 : 160;
    const R = rng(E.tissue.length * 31 + 5);
    const reps = [];
    for (let i = 0; i < E.n; i++) {
      const u = R(), gf = Math.exp((R() - 0.5) * 0.5), sd = 11 + i * 7;
      reps.push({ ok: u < ind.F, gf, seed: sd, sim: null });
    }
    const p = { mu: Math.max(0.0001, ind.mu), lag: E.lag / Math.max(0.35, Math.sqrt(ind.D * ind.P + 1e-6)), W0: E.W0, S0, Wc: E.vessel === 'vial' ? 220 : 120 };
    const sim = simulate(p, 42);
    const ctrl = simulate({ ...p, mu: 0.0001 }, 42);
    for (const r of reps) if (r.ok) r.sim = simulate({ ...p, mu: p.mu * r.gf }, 42);
    const ph = phases(sim);
    M = { E, ind, reps, sim, ctrl, ph, p };
  }

  // ---- плоти
  const p1 = new BandPlot($('t2a-p1'), { xLabel: 'Доба культивування', yLabel: 'Сира маса, мг', x: [0, 42], xShort: 'доба', ariaLabel: 'Крива росту калюсу на експлантаті' });
  const heat = heatmap($('t2a-heat'), (A, C) => induction(EXPL[st.e], { ...st, A, C }).F, (A, C) => {
    st.A = Math.round(A * 10) / 10; st.C = Math.round(C * 20) / 20;
    if (st.aux === 'none') { st.aux = 'd24'; auxSeg.select('d24'); }
    if (st.cyt === 'none' && st.C > 0) { st.cyt = 'bap'; cytSeg.select('bap'); }
    sl.set('A', st.A, true); sl.set('C', st.C, true); changed();
  });

  function updatePlots() {
    const { sim, ctrl, ph } = M, D = st.days;
    const cut = (s) => s.t.map((t, i) => [t, s.W[i]]).filter((p) => p[0] <= D + 1e-6);
    const anyOk = M.ind.F > 0.02;
    p1.setOptions({ x: [0, D] });
    p1.bands = anyOk ? ph.bands.filter((b) => b.a < D).map((b) => ({ ...b, b: Math.min(b.b, D) })) : [];
    p1.set([
      { data: cut(ctrl), color: '#9AA39C', dash: [6, 5], width: 2, label: 'без гормонів' },
      { data: anyOk ? cut(sim) : [], color: '#2E7D5B', width: 3, label: 'з калюсом (середнє)', marker: anyOk ? [st.t, at(sim, 'W', st.t)] : null },
    ]);
    heat.draw(st.A, st.C, `${AUX[st.aux === 'none' ? 'd24' : st.aux].name}`, `${CYT[st.cyt === 'none' ? 'bap' : st.cyt].name}`);
  }

  function updateReads() {
    const { E, ind, sim } = M, D = st.days;
    const ok = M.reps.filter((r) => r.ok).length;
    setR('F', `${fnum(ind.F * 100, 0)} %`, ind.F > 0.6 ? 'is-ok' : ind.F < 0.2 ? 'is-bad' : '');
    const W = at(sim, 'W', D);
    setR('m', ind.F > 0.02 ? fmtMg(W) : '—');
    setR('dw', ind.F > 0.02 ? fnum((W - E.W0) / E.W0, 1) : '0');
    const Araw = st.aux === 'none' ? 0 : st.A, Craw = st.cyt === 'none' ? 0 : st.C;
    setR('ratio', Craw > 0 && Araw > 0 ? `${fnum(Araw / Craw, Araw / Craw >= 10 ? 0 : 1)} : 1` : Araw > 0 ? 'лише ауксин' : Craw > 0 ? 'лише цитокінін' : 'без гормонів');
    setR('type', ind.F > 0.02 ? densityName(ind.fr) : '—');
    setR('day', `${fnum(st.t, 0)} з ${D}`);
    $('t2a-hud').innerHTML = `<span>${E.lr}</span><span>доба ${fnum(st.t, 0)}</span><span>+25 °C · ${st.light ? 'світло' : 'темрява'}</span><span>калюс: ${ok} з ${E.n}</span>`;
    // вердикт
    const v = $('t2a-verdict'); let cls = '', txt = '';
    const pr = PRESETS[st.preset];
    if (Araw === 0 && Craw === 0) {
      if (E.tissue === 'embryo') { txt = '<b>Безгормональне середовище:</b> незрілий зародок не утворює калюсу, а проростає в пробіркову рослину. Так у ЛР 11 отримують стерильні рослини-донори, з яких потім вирізають вузли кущення.'; cls = 'is-warn'; }
      else { txt = '<b>Без фітогормонів калюс не утворюється:</b> диференційовані клітини не здатні до поділу, експлантат поступово старіє й буріє (с. 62).'; cls = 'is-bad'; }
    } else if (ind.I < 0.6) { txt = `<b>Надлишок ауксину:</b> ${fnum(Araw, 1)} мг/л ${AUX[st.aux].name} для ${E.mono ? 'злаків' : 'дводольних'} уже токсичні — частина клітин гине, калюс буріє. Для дводольних зазвичай досить 1–2 мг/л 2,4-Д, для злаків — до 10 мг/л.`; cls = 'is-bad'; }
    else if (Craw === 0 && E.tissue === 'embryo') { txt = '<b>Виняток із правила (с. 65):</b> незрілі зародки пшениці утворюють калюс на середовищі лише з 2,4-Д, без цитокінінів, — їм вистачає власних (ендогенних) цитокінінів.'; cls = ''; }
    else if (Craw === 0 && ind.P < 0.5) { txt = `<b>Лише ауксин:</b> клітини дедиференціюються, але поділів мало — потрібен цитокінін. ${ind.roots > 0.2 ? 'ІОК/НОК без цитокініну спрямовують розвиток до коренеутворення: на експлантаті з’являються корінці.' : ''}`; cls = 'is-warn'; }
    else if (Araw === 0) { txt = '<b>Лише цитокінін:</b> без ауксину дедиференціація майже не йде, калюсу немає (виняток — сім’ядолі соняшнику, с. 65).'; cls = 'is-bad'; }
    else if (ind.buds > 0.25) { txt = '<b>Цитокінін переважає, і культура на світлі:</b> частина клітин переходить до органогенезу — на калюсі закладаються зелені бруньки (докладно — у темі 4).'; cls = 'is-warn'; }
    else {
      const r = Araw / Math.max(Craw, 1e-6);
      txt = `<b>${fnum(ind.F * 100, 0)} % експлантатів утворили калюс.</b> ${Craw > 0 ? `Співвідношення ауксин : цитокінін ≈ ${fnum(r, r >= 10 ? 0 : 1)} : 1 ${r >= 5 && r <= 20 ? '— близьке до оптимального 10 : 1 (с. 62).' : '— далеке від оптимального 10 : 1, тому калюсоутворення слабше.'}` : ''} Калюс ${densityName(ind.fr)}${st.aux === 'd24' ? ' — 2,4-Д робить тканину пухкою й оводненою' : st.aux === 'iaa' ? ' — на ІОК ріст повільніший, бо її руйнує ферменти ІОК-оксидаза' : ''}.`;
      cls = ind.F > 0.5 ? '' : 'is-warn';
    }
    if (pr && pr.e === st.e && pr.A === st.A && pr.C === st.C && pr.aux === st.aux && pr.cyt === st.cyt) txt += ` <span class="agx-medium">Середовище з посібника: ${pr.medium}.</span>`;
    v.className = 'ag-verdict ' + cls; v.innerHTML = txt;
  }

  // ---- сцена
  function draw() {
    if (cv.parentElement.clientWidth < 60) return;
    const cw0 = cv.parentElement.clientWidth, narrow = cw0 < 760, tiny = cw0 < 480;
    const { ctx, w, h } = K.fit(cv, { aspect: tiny ? 0.86 : narrow ? 1.22 : 1.8, min: 340, max: 600 });
    const dpr = DPR(), { E, ind } = M, t = st.t;
    const hy = st.light ? K.scene(ctx, w, h, { kind: 'room', horizon: narrow ? 0.5 : 0.56 }) : thermostat(ctx, w, h, { horizon: narrow ? 0.5 : 0.56 });
    // поле мікроскопа
    // для вузької сцени поле мікроскопа — у вільній зоні стіни над посудинами, підписи ліворуч від нього
    const topFree = E.vessel === 'vial' ? h - 40 - Math.min((w - 24) / (E.n + 0.45), 150) * 1.55 : E.vessel === 'tube' ? h - 40 - Math.min((w - 24) / (E.n * 2.2), 44) * 4.9 : h * 0.45;
    const mr = narrow ? clamp((topFree - 52) / 2.3, 44, Math.min(w * 0.2, 96)) : Math.min(h * 0.24, w * 0.115);
    const mx = narrow ? w - mr * 1.12 - 12 : w - mr - w * 0.05, my = narrow ? 44 + mr * 1.1 : h * 0.4;
    const area = narrow ? [12, w - 12] : [w * 0.03, w * 0.72];
    const base = narrow ? h - 34 : h - 30;
    const firstCallus = { x: 0, y: 0, s: 0 };
    const cState = (r) => {
      const W = r.ok && r.sim ? at(r.sim, 'W', t) : E.W0, dead = r.ok && r.sim ? at(r.sim, 'dead', t) : 0;
      return { mass: Math.max(0, W - E.W0), brown: clamp((dead / Math.max(1, W)) * 3 + (ind.I < 0.6 ? (1 - ind.I) * smooth(5, 25, t) : 0), 0, 1) };
    };
    const expBrown = (r) => (r.ok ? 0 : (ind.germ > 0.5 ? 0 : smooth(8, 40, t) * 0.75));
    const callusOpts = (r, cs) => ({ seed: r.seed, friable: ind.fr, color: E.color, yellow: E.yellow, green: ind.green * smooth(7, 20, t), brown: cs.brown, dpr, buds: ind.buds * smooth(E.lag + 4, E.lag + 16, t), roots: ind.roots * smooth(E.lag, E.lag + 14, t) });
    const sizeOf = (mass, pxmm) => Math.cbrt((3 * mass) / (2 * Math.PI)) * pxmm * 1.08;

    if (E.vessel === 'vial') {
      const n = E.n, vw = Math.min((area[1] - area[0]) / (n + 0.45), narrow ? 150 : 165), vh = vw * 1.55, gap = ((area[1] - area[0]) - n * vw) / (n + 1);
      const by = narrow ? h - 40 : base;
      for (let i = 0; i < n; i++) {
        const r = M.reps[i], x = area[0] + gap + i * (vw + gap), cs = cState(r);
        vial(ctx, x, by - vh, vw, vh, { label: `№ ${i + 1}`, agarBrown: cs.brown * 0.25, contents: (c, v) => {
          const pxmm = vw / 24;
          drawExplant(c, E, v.cx, v.surf + 1, pxmm, { light: st.light, brown: expBrown(r), seed: i });
          if (r.ok && cs.mass > 0.5) {
            const s = Math.min(sizeOf(cs.mass, pxmm), vw * 0.42);
            if (E.tissue === 'leaf') { drawCallus(c, v.cx - 5.5 * pxmm, v.surf + 3, s * 0.78, callusOpts(r, cs)); drawCallus(c, v.cx + 5.5 * pxmm, v.surf + 4, s * 0.72, { ...callusOpts(r, cs), seed: r.seed + 50 }); }
            else drawCallus(c, v.cx, v.surf + 3, s, callusOpts(r, cs));
            if (!firstCallus.s) Object.assign(firstCallus, { x: v.cx, y: v.surf - s * 0.6, s });
          } else if (!firstCallus.s && i === 0) Object.assign(firstCallus, { x: v.cx, y: v.surf - 2, s: 0 });
        } });
      }
    } else if (E.vessel === 'tube') {
      const n = E.n, tw = Math.min((area[1] - area[0]) / (n * 2.2), narrow ? 44 : 50), th = tw * 4.9, gap = ((area[1] - area[0]) - n * tw) / (n + 1);
      const by = narrow ? h - 40 : base, ty = by - th;
      // штатив
      const rx0 = area[0] + gap * 0.5, rx1 = area[1] - gap * 0.5;
      const rg = ctx.createLinearGradient(0, ty + th * 0.18, 0, ty + th * 0.18 + 14); rg.addColorStop(0, '#FBFBF7'); rg.addColorStop(1, '#D9DAD2');
      K.shadow(ctx, (rx0 + rx1) / 2, by + 2, (rx1 - rx0) * 0.55, 8, 0.25);
      for (let i = 0; i < n; i++) {
        const r = M.reps[i], x = area[0] + gap + i * (tw + gap), cs = cState(r);
        K.tube(ctx, x, ty, tw, th, { medium: { level: 0.3, color: K.MAT.agar }, plug: 'foil', label: `№ ${i + 1}`, contents: (c, inn) => {
          const pxmm = inn.w / 15, ex = inn.x + inn.w / 2;
          if (ind.germ > 0.3 && E.tissue === 'embryo') {
            const g = ind.germ * smooth(2, 18, t);
            drawExplant(c, E, ex, inn.surface + 1, pxmm, { light: st.light, seed: i });
            if (g > 0.03) K.plantlet(c, ex, inn.surface - 1, { height: th * 0.4 * g, nodes: 3, leafLen: tw * 0.55 * Math.max(0.3, g), roots: { n: 4, len: th * 0.18 * g }, seed: i + 3, color: '#5DA347' });
          } else {
            drawExplant(c, E, ex, inn.surface + 1, pxmm, { light: st.light, brown: expBrown(r), seed: i });
            if (r.ok && cs.mass > 0.3) { const s = Math.min(sizeOf(cs.mass, pxmm * 2), inn.w * 0.46); drawCallus(c, ex, inn.surface + 3, s, callusOpts(r, cs)); if (!firstCallus.s) Object.assign(firstCallus, { x: ex, y: inn.surface - s * 0.6, s }); }
            else if (!firstCallus.s && i === 0) Object.assign(firstCallus, { x: ex, y: inn.surface - 2, s: 0 });
          }
        } });
      }
      ctx.fillStyle = rg; K.roundRect(ctx, rx0, ty + th * 0.18, rx1 - rx0, 13, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(rx0, ty + th * 0.18 + 13, rx1 - rx0, 2);
    } else {
      // чашка Петрі з 15 корінцями
      const r0 = narrow ? Math.min(w * 0.44, 170) : Math.min((area[1] - area[0]) * 0.42, h * 0.62, 270);
      const pcx = (area[0] + area[1]) / 2, pcy = h - r0 * 0.6 - 22;
      K.petri(ctx, pcx, pcy, r0, { tilt: 0.42, contents: (c, p) => {
        const pxmm = (2 * p.rx) / 90, R = rng(5), pts = [];
        for (let i = 0; i < E.n; i++) { const a = (i / E.n) * TAU + R() * 0.3, d = i % 3 === 0 ? 0.25 : 0.62; pts.push([p.cx + Math.cos(a) * p.rx * d * (0.9 + R() * 0.15), p.cy + Math.sin(a) * p.ry * d * (0.9 + R() * 0.15)]); }
        pts.sort((a, b) => a[1] - b[1]);
        pts.forEach(([x, y], i) => {
          const r = M.reps[i] || M.reps[0], cs = cState(r);
          drawExplant(c, E, x, y, pxmm * 1.6, { brown: expBrown(r), seed: i });
          if (r.ok && cs.mass > 0.3) { const s = Math.min(sizeOf(cs.mass, pxmm * 1.6), p.rx * 0.13); drawCallus(c, x, y + 2, s, callusOpts(r, cs)); if (!firstCallus.s) Object.assign(firstCallus, { x, y: y - s * 0.6, s }); }
          else if (!firstCallus.s && i === 0) Object.assign(firstCallus, { x, y, s: 0 });
        });
      } });
    }
    // мікроскоп
    const cst = cellState(E, ind, t, st.days);
    microInset(ctx, mx, my, mr, cst, 'Клітини експлантата · ×400', cst.stage, narrow);
    // виноска
    if (!narrow && firstCallus.x) {
      const txt = firstCallus.s > 4 ? `Калюс (${densityName(ind.fr)})` : ind.germ > 0.5 ? 'Зародок проростає' : 'Експлантат';
      K.callout(ctx, firstCallus.x, firstCallus.y, Math.max(firstCallus.x + 40, Math.min(firstCallus.x + 90, w * 0.7)), Math.max(28, firstCallus.y - 70), txt);
    }
    cv.setAttribute('aria-label', `${E.name}, доба ${Math.round(t)}: ${M.reps.filter((r) => r.ok).length} з ${E.n} експлантатів утворюють калюс`);
  }

  function changed() {
    const keepT = runner.done ? st.days : runner.started ? Math.min(st.t, st.days) : 0;
    compute(); st.t = keepT; updateReads(); updatePlots(); draw();
    $('t2a-status').textContent = runner.started ? '' : 'Натисніть «Запустити», щоб пройти дослід у прискореному часі.';
  }
  const runner = new K.Runner({
    btn: $('t2a-run'), reset: $('t2a-reset'), status: $('t2a-status'),
    step: (dt, T, reset) => {
      if (reset) { st.t = 0; updateReads(); updatePlots(); return; }
      st.t = Math.min(st.days, st.t + dt * st.days / 10);
      if (st.t >= st.days) runner.finish();
      updateReads(); updatePlots();
      $('t2a-status').textContent = st.t >= st.days ? 'Дослід завершено. Змінюйте параметри — результат перерахується.' : '';
    },
    draw,
  });
  compute(); updateReads(); updatePlots(); draw();
  $('t2a-status').textContent = 'Натисніть «Запустити», щоб пройти дослід у прискореному часі.';
  K.onResize(cv.parentElement, draw);
}

/* ---------- Теплова карта «ауксин × цитокінін» ---------- */
function heatmap(cv, f, onPick) {
  const host = cv.parentElement;
  const AMAX = 10, CMAX = 2;
  let cur = [1, 0.2], labs = ['2,4-Д', '6-БАП'];
  const m = { l: 46, r: 14, t: 12, b: 64 };
  const pal = [[247, 244, 232], [214, 232, 190], [140, 196, 120], [62, 140, 92], [18, 82, 56]];
  const col = (v) => { const x = clamp(v, 0, 1) * (pal.length - 1), i = Math.min(pal.length - 2, Math.floor(x)); return mix(pal[i], pal[i + 1], x - i); };
  let geo = null;
  function draw(A = cur[0], C = cur[1], la = labs[0], lc = labs[1]) {
    cur = [A, C]; labs = [la, lc];
    const w = host.clientWidth; if (!w) return;
    const h = Math.round(clamp(w / 1.45, 240, 420)), dpr = DPR();
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const X = (a) => m.l + (a / AMAX) * pw, Y = (c) => m.t + ph - (c / CMAX) * ph;
    geo = { X, Y, pw, ph };
    const nx = 70, ny = 44, cw = pw / nx, ch = ph / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = ((i + 0.5) / nx) * AMAX, c = ((ny - j - 0.5) / ny) * CMAX;
      ctx.fillStyle = rgba(col(f(a, c))); ctx.fillRect(m.l + i * cw, m.t + j * ch, cw + 0.6, ch + 0.6);
    }
    // лінії співвідношень
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
    for (const [k, lab] of [[1, '1 : 1'], [10, '10 : 1'], [100, '100 : 1']]) {
      ctx.strokeStyle = k === 10 ? 'rgba(120,80,0,.85)' : 'rgba(40,50,45,.45)'; ctx.setLineDash(k === 10 ? [] : [4, 4]); ctx.lineWidth = k === 10 ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(AMAX), Y(AMAX / k)); ctx.stroke(); ctx.setLineDash([]);
      const ax = Math.min(AMAX * 0.92, CMAX * k * 0.92), lx = X(ax), ly = Y(ax / k);
      tag(ctx, lx - 4, ly - 6, lab, { size: 10.5, align: 'right', color: k === 10 ? '#6B4A00' : '#33423A' });
    }
    ctx.restore();
    // осі
    ctx.strokeStyle = '#46584C'; ctx.lineWidth = 1; ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);
    ctx.fillStyle = '#46584C'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let a = 0; a <= AMAX; a += 2) ctx.fillText(String(a), X(a), m.t + ph + 5);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let c = 0; c <= CMAX + 1e-9; c += 0.5) ctx.fillText(fnum(c, 1), m.l - 6, Y(c));
    ctx.fillStyle = '#13241A'; ctx.font = '600 12.5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Ауксин (${la}), мг/л`, m.l + pw / 2, m.t + ph + 34);
    ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(`Цитокінін (${lc}), мг/л`, 0, 0); ctx.restore();
    // легенда
    const lgw = Math.min(160, pw * 0.45), lgx = m.l + 34, lgy = h - 17;
    ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#46584C';
    ctx.textAlign = 'right'; ctx.fillText('0 %', lgx - 5, lgy + 4);
    for (let i = 0; i < lgw; i++) { ctx.fillStyle = rgba(col(i / lgw)); ctx.fillRect(lgx + i, lgy, 1.2, 8); }
    ctx.fillStyle = '#46584C'; ctx.textAlign = 'left'; ctx.fillText('100 % експлантатів', lgx + lgw + 5, lgy + 4);
    // поточна точка
    const px = X(clamp(A, 0, AMAX)), py = Y(clamp(C, 0, CMAX));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#B07D12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#B07D12'; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill();
  }
  const pick = (e) => {
    if (!geo) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < m.l || x > m.l + geo.pw || y < m.t || y > m.t + geo.ph) return;
    onPick(((x - m.l) / geo.pw) * AMAX, ((m.t + geo.ph - y) / geo.ph) * CMAX);
  };
  let down = false;
  cv.addEventListener('pointerdown', (e) => { down = true; pick(e); });
  cv.addEventListener('pointermove', (e) => { if (down && e.pointerType === 'mouse') pick(e); });
  window.addEventListener('pointerup', () => { down = false; });
  new ResizeObserver(() => draw()).observe(host);
  return { draw };
}

/* ======================================================================
   Вкладка Б: пасаж (ЛР 9)
   ======================================================================
   Посібник (с. 63, 68): первинний калюс пасирують через 4–6 тижнів, далі — кожні 3–4 тижні; при пасажі
   видаляють некротичні ділянки й залишки агару, калюс ділять на рівні шматочки. Модель: послідовність
   S-кривих (див. t02-lib.js); у кожному пасажі інокулюм = маса шматочка. Якщо пасаж запізнився в
   стаціонарну фазу/деградацію, клітини «старіють»: довша лаг-фаза, нижча μ (наближення). Якщо некроз
   не видалено, мертві клітини й хінони (окиснені феноли) переносяться в новий флакон і пригнічують ріст. */
const CULT = {
  sunflower: { name: 'Соняшник', mu: 0.3, lag: 4, color: '#EEDCAA', yellow: 0.3, fr: 0.55, green: 0 },
  rape: { name: 'Ріпак', mu: 0.33, lag: 3.5, color: '#ECEBCB', yellow: 0.05, fr: 0.65, green: 0.12 },
  wheat: { name: 'Пшениця', mu: 0.25, lag: 5, color: '#F2E6BE', yellow: 0.45, fr: 0.3, green: 0 },
  beet: { name: 'Цукрові буряки', mu: 0.27, lag: 4.5, color: '#EDD3C8', yellow: 0, fr: 0.5, green: 0 },
};
function passLine(s) {
  const C = CULT[s.cult], out = [];
  let inoc = s.inoc, deadIn = 0, lag = C.lag, mu = C.mu, tox = 0, vials = 1, t0 = 0;
  for (let k = 0; k < s.n; k++) {
    const sim = simulate({ mu, lag, W0: inoc, Wd0: deadIn, tox }, s.interval);
    const ph = phases(simulate({ mu, lag, W0: inoc, Wd0: deadIn, tox }, 60));
    const L = at(sim, 'live', s.interval), Dd = at(sim, 'dead', s.interval);
    const over = Math.max(0, s.interval - (ph.bands.find((b) => b.id === 'sta')?.a ?? 99));
    const phase = phaseAt(ph, s.interval);
    const pieces = Math.max(1, Math.floor((s.clean ? L : L + Dd) / s.inoc));
    out.push({ k, t0, sim, ph, L, D: Dd, over, phase, pieces, inoc, deadIn, lag, mu, idx: (L + Dd - inoc - deadIn) / (inoc + deadIn) });
    vials *= pieces;
    // наступний пасаж
    const share = Dd / Math.max(1e-6, L + Dd);
    if (s.clean) { deadIn = 0; tox = 0; inoc = s.inoc; }
    else { deadIn = s.inoc * share; inoc = s.inoc * (1 - share); tox = 0.02 * share * 3; }
    lag = C.lag * (1 + 0.07 * over) * (s.clean ? 1 : 1.2);
    mu = Math.max(0.35 * C.mu, mu * (1 - 0.013 * over) * (s.clean ? 1 : 0.94) + (over === 0 ? (C.mu - mu) * 0.5 : 0));
    t0 += s.interval;
  }
  return { list: out, vials, C };
}

function modelB() {
  const cv = $('t2b-cv'); if (!cv) return;
  const st = { cult: 'sunflower', interval: 28, inoc: 100, n: 4, clean: true, T: 0, mode: 'grow', opT: 0, k: 0 };
  const setR = reads($('t2b-reads'), [
    ['k', 'Пасаж'], ['day', 'Доба в пасажі'], ['m', 'Маса калюсу у флаконі'], ['ph', 'Фаза росту'], ['br', 'Відмерла (бура) тканина'], ['pcs', 'Шматочків при пасажі'], ['tot', 'Флаконів потенційно'],
  ]);
  select($('t2b-cult'), 'Культура калюсу (ЛР 9)', Object.entries(CULT).map(([k, v]) => [k, v.name]), st.cult, (v) => { st.cult = v; changed(); }, 't2b-c');
  const sl = K.sliders($('t2b-sl'), [
    { id: 'interval', label: 'Інтервал між пасажами', min: 14, max: 56, step: 1, value: st.interval, unit: 'діб', digits: 0, hint: 'За посібником — кожні 3–4 тижні (21–28 діб)' },
    { id: 'inoc', label: 'Маса шматочка (інокулюму)', min: 50, max: 300, step: 10, value: st.inoc, unit: 'мг', digits: 0 },
    { id: 'n', label: 'Кількість пасажів', min: 1, max: 6, step: 1, value: st.n, unit: '', digits: 0 },
  ], () => { Object.assign(st, sl.values); changed(); });
  checkbox($('t2b-opt'), 'Видаляти некротичні ділянки й шматочки старого агару (крок 2 ходу роботи)', st.clean, (v) => { st.clean = v; changed(); }, 't2b-clean');

  let L = null;
  const total = () => st.interval * st.n;
  const p1 = new BandPlot($('t2b-p1'), { xLabel: 'Доба від першого пасажу', yLabel: 'Сира маса у флаконі, мг', xShort: 'доба', ariaLabel: 'Маса калюсу в лінії пасажів' });
  const p2 = new K.Plot($('t2b-p2'), { xLabel: 'Номер пасажу', yLabel: 'ΔW; шматочків', xShort: 'пасаж', x: [0.5, 6.5], ariaLabel: 'Приріст і кількість шматочків за пасажами' });

  function lineSeries() {
    const live = [], tot = [];
    for (const P of L.list) { P.sim.t.forEach((t, i) => { tot.push([P.t0 + t, P.sim.W[i]]); live.push([P.t0 + t, P.sim.live[i]]); }); }
    return { live, tot };
  }
  function cur() {
    const k = Math.min(st.k, L.list.length - 1), P = L.list[k], td = clamp(st.T - P.t0, 0, st.interval);
    return { P, k, td, W: at(P.sim, 'W', td), live: at(P.sim, 'live', td), dead: at(P.sim, 'dead', td) };
  }
  function updatePlots() {
    const s = lineSeries(), c = cur();
    p1.setOptions({ x: [0, total()] });
    p1.bands = [];
    p1.set([
      { data: s.tot, color: '#2E7D5B', width: 2.6, label: 'загальна сира маса', marker: [st.T, c.W] },
      { data: s.live, color: '#B07D12', width: 1.8, dash: [5, 4], label: 'жива тканина' },
    ], L.list.slice(1).map((P) => ({ x: P.t0, label: `пасаж ${P.k + 1}`, color: '#8A6A16' })));
    p2.setOptions({ x: [0.5, st.n + 0.5] });
    p2.set([
      { data: L.list.map((P) => [P.k + 1, P.idx]), color: '#2E7D5B', label: 'індекс приросту ΔW за пасаж' },
      { data: L.list.map((P) => [P.k + 1, P.idx]), color: '#2E7D5B', type: 'points', noHover: true },
      { data: L.list.map((P) => [P.k + 1, P.pieces]), color: '#B07D12', dash: [5, 4], label: 'шматочків (інокулюмів) з калюсу' },
      { data: L.list.map((P) => [P.k + 1, P.pieces]), color: '#B07D12', type: 'points', noHover: true },
    ]);
  }
  function updateReads() {
    const c = cur();
    setR('k', `${c.k + 1} з ${st.n}`); setR('day', fnum(c.td, 0));
    setR('m', fmtMg(c.W));
    const ph = phaseAt(c.P.ph, c.td); setR('ph', ph.name, ph.id === 'deg' ? 'is-bad' : ph.id === 'sta' || ph.id === 'dec' ? 'is-ok' : '');
    const br = c.dead / Math.max(1, c.W); setR('br', `${fnum(br * 100, 0)} %`, br > 0.2 ? 'is-bad' : '');
    setR('pcs', String(c.P.pieces)); setR('tot', L.vials > 1e5 ? fnum(L.vials, 2) : String(L.vials));
    $('t2b-hud').innerHTML = `<span>${L.C.name}</span><span>пасаж ${c.k + 1}</span><span>доба ${fnum(c.td, 0)} / ${st.interval}</span>`;
    // вердикт за першим пасажем
    const P0 = L.list[0], idP = P0.phase.id; let cls = '', txt = '';
    const sta = P0.ph.bands.find((b) => b.id === 'sta'), lin = P0.ph.bands.find((b) => b.id === 'lin');
    const win = `${fnum(lin ? lin.b : 0, 0)}–${fnum(sta ? sta.b : 0, 0)}`;
    if (idP === 'deg') { cls = 'is-bad'; txt = `<b>Запізно:</b> на ${st.interval}-ту добу калюс уже в фазі деградації — бура некротична тканина, менше живих клітин, довша лаг-фаза в наступному пасажі. Оптимальне вікно для цієї культури ≈ ${win} діб.`; }
    else if (idP === 'lag' || idP === 'exp' || idP === 'lin') { cls = 'is-warn'; txt = `<b>Зарано:</b> калюс ще у фазі «${P0.phase.name.toLowerCase()}» — він здоровий, але приріст за пасаж малий (${fnum(P0.idx, 1)}), тож доводиться пасирувати частіше. Оптимальне вікно ≈ ${win} діб.`; }
    else { txt = `<b>Вчасно:</b> пасаж наприкінці активного росту (фаза «${P0.phase.name.toLowerCase()}»), коли маса майже максимальна, а некрозу ще мало. За ${st.n} пасаж(і) з одного калюсу можна отримати ${L.vials > 1e5 ? fnum(L.vials, 2) : L.vials} флаконів.`; }
    if (!st.clean) { txt += ' Некротичні ділянки не видалено: мертві клітини й окиснені феноли (хінони) потрапляють у свіже середовище й гальмують ріст.'; cls = cls || 'is-warn'; }
    const last = L.list[L.list.length - 1];
    if (st.n > 1 && last.idx < P0.idx * 0.7) txt += ` Приріст за пасаж знизився з ${fnum(P0.idx, 1)} до ${fnum(last.idx, 1)} — культура виснажується.`;
    const v = $('t2b-verdict'); v.className = 'ag-verdict ' + cls; v.innerHTML = txt;
  }

  function draw() {
    if (cv.parentElement.clientWidth < 60) return;
    const narrow = cv.parentElement.clientWidth < 600;
    const tiny = cv.parentElement.clientWidth < 480;
    const { ctx, w, h } = K.fit(cv, { aspect: tiny ? 0.85 : narrow ? 1.2 : 2, min: 330, max: 540 });
    const dpr = DPR(), C = L.C, c = cur();
    const hy = K.scene(ctx, w, h, { kind: 'hood', horizon: tiny ? 0.36 : narrow ? 0.34 : 0.5 });
    const vw = narrow ? Math.min(w * 0.3, 120) : Math.min(w * 0.15, 150), vh = vw * 1.42;
    const vx = narrow ? 14 : w * 0.05, vby = narrow ? hy + (h - hy) * 0.42 : h - 34;
    const pr = narrow ? Math.min(w * 0.3, 120) : Math.min(w * 0.17, h * 0.33, 170);
    const pcx = narrow ? w - pr - 16 : w * 0.47, pcy = narrow ? hy + (h - hy) * 0.3 : h - pr * 0.42 - 40;
    const rackX = narrow ? 14 : w * 0.68, rackY = narrow ? h - 30 : h - 34, rackW = narrow ? w - 28 : w * 0.29;
    const callusO = (seed, brown) => ({ seed, friable: C.fr, color: C.color, yellow: C.yellow, green: C.green, brown, dpr });
    const pxV = vw / 24, pxP = (2 * pr) / 90;
    const sizeOf = (m, px) => Math.cbrt((3 * m) / (2 * Math.PI)) * px * 1.08;
    // анімація пасажу
    const op = st.mode === 'op' ? st.opT / 2.4 : -1;
    const brown = clamp((c.dead / Math.max(1, c.W)) * 2.6, 0, 1);
    // флакон
    const inVial = op < 0 || op > 0.92;
    vial(ctx, vx, vby - vh, vw, vh, { label: `Пасаж ${c.k + (op > 0.92 ? 2 : 1)}`, agarBrown: brown * 0.3 * (inVial ? 1 : 0), contents: (cx, v) => {
      if (op < 0) drawCallus(cx, v.cx, v.surf + 3, Math.min(sizeOf(c.W, pxV), vw * 0.45), callusO(11 + c.k, brown));
      else if (op > 0.92) drawCallus(cx, v.cx, v.surf + 3, sizeOf(st.inoc, pxV), callusO(31 + c.k, 0));
    } });
    // чашка Петрі (робоча)
    K.petri(ctx, pcx, pcy, pr, { tilt: 0.42, medium: { color: '#F4F2EA' }, lid: op < 0, label: narrow ? '' : 'Стерильна чашка Петрі', contents: (cx, p) => {
      if (op < 0) return;
      const ph1 = smooth(0, 0.25, op), ph2 = smooth(0.3, 0.55, op), ph3 = smooth(0.6, 0.85, op);
      const W = c.P.L + c.P.D, s = sizeOf(W, pxP);
      if (ph2 < 1 || op < 0.6) {
        // калюс у чашці, некроз відрізається
        const bb = st.clean ? brown * (1 - ph2) : brown;
        if (ph3 <= 0) drawCallus(cx, p.cx, p.cy + 4, s * (0.4 + 0.6 * ph1), callusO(11 + c.k, bb));
        if (st.clean && ph2 > 0 && brown > 0.05) drawCallus(cx, p.cx + p.rx * 0.55 * ph2, p.cy + p.ry * 0.4, s * 0.3, callusO(77, 0.95));
      }
      if (ph3 > 0) {
        const n = Math.min(c.P.pieces, 9), R = rng(3);
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.4, d = 0.5 * ph3; drawCallus(cx, p.cx + Math.cos(a) * p.rx * d, p.cy + Math.sin(a) * p.ry * d + 2, sizeOf(st.inoc, pxP), callusO(40 + i, 0)); }
      }
    } });
    // ланцет і пінцет
    ctx.save(); ctx.translate(pcx + pr * 0.95, pcy + pr * 0.25); ctx.rotate(-0.35);
    const mg = ctx.createLinearGradient(0, -3, 0, 3); mg.addColorStop(0, '#F5F7F8'); mg.addColorStop(0.5, '#9CA6AB'); mg.addColorStop(1, '#5F686C');
    ctx.fillStyle = mg; K.roundRect(ctx, 0, -2.5, pr * 0.7, 5, 2.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(pr * 0.7, -2.5); ctx.lineTo(pr * 0.86, 0); ctx.lineTo(pr * 0.7, 2.5); ctx.fill(); ctx.restore();
    // нові флакони (штатив)
    const done = L.list.slice(0, c.k + (op > 0.92 ? 1 : 0)).reduce((s, P) => s + P.pieces - 1, 0);
    const shown = Math.min(done, narrow ? 6 : 8), sw = Math.min(rackW / Math.max(4, shown + 0.5), vw * 0.55), sh = sw * 1.42;
    for (let i = 0; i < shown; i++) {
      vial(ctx, rackX + i * sw * 1.02, rackY - sh, sw * 0.92, sh, { cap: 'foil', contents: (cx, v) => drawCallus(cx, v.cx, v.surf + 2, sizeOf(st.inoc, sw / 24), callusO(60 + i, 0)) });
    }
    tag(ctx, rackX + rackW / 2, rackY + 18, done ? `Нові флакони: ${done}${done > shown ? ` (показано ${shown})` : ''}` : 'Нові флакони з’являться після пасажу', { size: 11 });
    if (op >= 0) {
      const steps = ['1. калюс у чашку', '2. видалити некроз', '3. поділити на шматочки', '4. у свіжі флакони'];
      const si = Math.min(3, Math.floor(op * 4));
      tag(ctx, pcx, Math.max(56, pcy - pr * 0.42 - 26), `Пасаж: ${steps[si]}`, { size: 12.5, dark: true });
    }
  }

  function changed() {
    L = passLine(st);
    if (!runner.started) { st.T = 0; st.k = 0; }
    else { st.T = Math.min(st.T, total()); st.k = Math.min(Math.floor(st.T / st.interval), st.n - 1); }
    if (runner.done) { st.T = total(); st.k = st.n - 1; }
    st.mode = 'grow';
    updateReads(); updatePlots(); draw();
  }
  const runner = new K.Runner({
    btn: $('t2b-run'), reset: $('t2b-reset'), status: $('t2b-status'),
    step: (dt, T, reset) => {
      if (reset) { st.T = 0; st.k = 0; st.mode = 'grow'; updateReads(); updatePlots(); return; }
      $('t2b-status').textContent = st.mode === 'op' ? 'Пасаж у ламінар-боксі…' : '';
      if (st.mode === 'op') {
        st.opT += dt; if (st.opT >= 2.4) { st.mode = 'grow'; st.k++; st.T = st.k * st.interval; }
      } else {
        st.T += dt * Math.max(4, total() / 16);
        const end = (st.k + 1) * st.interval;
        if (st.T >= end) {
          st.T = end;
          if (st.k < st.n - 1) { st.mode = 'op'; st.opT = 0; } else { runner.finish(); $('t2b-status').textContent = 'Лінію пасажів завершено. Змініть інтервал або вимкніть видалення некрозу й порівняйте.'; }
        }
      }
      updateReads(); updatePlots();
    },
    draw,
  });
  // кінцева точка поточного пасажу — для відображення до запуску
  L = passLine(st); updateReads(); updatePlots(); draw();
  $('t2b-status').textContent = 'Натисніть «Запустити»: калюс ростиме, а в кінці кожного інтервалу відбудеться пасаж.';
  K.onResize(cv.parentElement, draw);
}

function init() {
  const tb = document.getElementById('t2-tabs'); if (tb) tabs(tb);
  modelA(); modelB();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
