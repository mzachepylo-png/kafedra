// Тема 4, вкладки А і Б: фазова карта «ауксин × цитокінін» (Скуг — Міллер) з живою колбою й лупою;
// укорінення мікропагонів і вихід рослин-регенерантів (ЛР 15–16). Математика — t04-model.js.
import {
  TAU, clamp, lerp, smooth, rng, fnum, hex, rgba, mix, shade, fit, offscreen, scene, flask, tube, callus, plantlet,
  shadow, tagSmall, roundRect, MAT, Runner, onResize, Plot, sample, sliders, segmented, setOut, $,
} from './kit.js';
import { root, bud, meristemZone, lens } from './t04-draw.js';
import { AUX, CYT, ENDO, TH, organo, dynamics, appear, ROOTING, rooted, regenerants, logistic } from './t04-model.js';

const DAY_MAX = 60;
const Z = (v) => (v <= 0.0051 ? 0 : v); // мінімум повзунка = «без гормону»
const mg = (v) => (v <= 0.0051 ? '0' : fnum(v, v < 0.1 ? 3 : v < 1 ? 2 : 1));

export const SA = { aux: 1, auxType: 'naa', cyt: 2, cytType: 'bap', light: true, passage: 1, day: 45 };

const PRESETS = {
  ms0: { label: 'ЛР 15 а: МС без гормонів', aux: 0, auxType: 'naa', cyt: 0, cytType: 'bap', light: true, vessel: 'Картопля · МС без гормонів' },
  lr15: { label: 'ЛР 15 б: 2 БАП + 1 НОК', aux: 1, auxType: 'naa', cyt: 2, cytType: 'bap', light: true, vessel: 'Картопля · МС + 2 БАП + 1 НОК' },
  lr16: { label: 'ЛР 16: 2 ІОК + 0,25 кінетину', aux: 2, auxType: 'iaa', cyt: 0.25, cytType: 'kin', light: true, vessel: 'Томати · Уайт + 2 ІОК + 0,25 кін.' },
  smR: { label: 'Скуг — Міллер: корені', aux: 2, auxType: 'iaa', cyt: 0.02, cytType: 'kin', light: true, vessel: 'Тютюн · 2 ІОК + 0,02 кін.' },
  smC: { label: 'Скуг — Міллер: калюс', aux: 2, auxType: 'iaa', cyt: 0.2, cytType: 'kin', light: true, vessel: 'Тютюн · 2 ІОК + 0,2 кін.' },
  smS: { label: 'Скуг — Міллер: пагони', aux: 2, auxType: 'iaa', cyt: 1, cytType: 'kin', light: true, vessel: 'Тютюн · 2 ІОК + 1 кін.' },
};
let vesselLabel = PRESETS.lr15.vessel;

const PATH_TXT = {
  shoots: 'стебловий органогенез (пагони)', roots: 'ризогенез (корені без пагонів)', mixed: 'пагони й корені',
  callus: 'неорганізований калюс', 'callus+': 'калюс із поодинокими органами', weak: 'слабкий ріст, органів майже немає',
};

/* ================= Вкладка А ================= */
export function initA() {
  const cv = $('t4a-scene'), mapCv = $('t4a-map');
  if (!cv) return null;
  let o = organo(cur()), dyn = dynamics(o, SA.day);
  function cur() { return { aux: Z(SA.aux), auxType: SA.auxType, cyt: Z(SA.cyt), cytType: SA.cytType, light: SA.light, passage: SA.passage }; }

  // ---- керування
  const auxSeg = segmented($('t4a-auxtype'), 't4a-aux', Object.entries(AUX).map(([v, a]) => ({ value: v, label: a.name })), SA.auxType, (v) => { SA.auxType = v; vesselLabel = ''; update(); });
  const cytSeg = segmented($('t4a-cyttype'), 't4a-cyt', Object.entries(CYT).map(([v, a]) => ({ value: v, label: a.name })), SA.cytType, (v) => { SA.cytType = v; vesselLabel = ''; update(); });
  const lightSeg = segmented($('t4a-light'), 't4a-light', [{ value: '1', label: 'Світло 3 клк, 16 год' }, { value: '0', label: 'Темрява' }], '1', (v) => { SA.light = v === '1'; update(); });
  const sl = sliders($('t4a-ctrl'), [
    { id: 't4a-aux', label: 'Ауксин', min: 0.005, max: 10, value: SA.aux, log: true, unit: 'мг/л', format: mg, hint: 'Крайнє ліве положення — без ауксину.' },
    { id: 't4a-cyt', label: 'Цитокінін', min: 0.005, max: 10, value: SA.cyt, log: true, unit: 'мг/л', format: mg },
    { id: 't4a-pas', label: 'Пасаж калюсу', min: 1, max: 12, step: 1, value: SA.passage, unit: '', hint: 'Номер пересадки (субкультивування): з пасажами здатність до органогенезу згасає.' },
    { id: 't4a-day', label: 'Доба культивування', min: 0, max: DAY_MAX, step: 1, value: SA.day, unit: 'доба' },
  ], (id) => {
    const v = sl.values;
    if (id === 't4a-aux' || id === 't4a-cyt') vesselLabel = '';
    SA.aux = v['t4a-aux']; SA.cyt = v['t4a-cyt']; SA.passage = v['t4a-pas'];
    if (id === 't4a-day') { SA.day = v['t4a-day']; if (!runner.running) { dyn = dynamics(o, SA.day); drawScene(); reads(); } return; }
    update();
  });
  document.querySelectorAll('#t4a-presets [data-preset]').forEach((b) => b.addEventListener('click', () => {
    const p = PRESETS[b.dataset.preset];
    SA.auxType = p.auxType; SA.cytType = p.cytType; SA.light = p.light;
    auxSeg.select(p.auxType); cytSeg.select(p.cytType); lightSeg.select(p.light ? '1' : '0');
    sl.set('t4a-aux', p.aux || 0.005, true); sl.set('t4a-cyt', p.cyt || 0.005, true);
    SA.aux = sl.values['t4a-aux']; SA.cyt = sl.values['t4a-cyt'];
    vesselLabel = p.vessel;
    document.querySelectorAll('#t4a-presets [data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    update();
  }));

  // ---- графіки
  const p1 = new Plot($('t4a-p1'), { xLabel: 'lg(А/Ц) — баланс ауксину й цитокініну', yLabel: 'частка відгуку, %', x: [-2, 3], y: [0, 100], xShort: 'lg(А/Ц)', aspect: 1.7 });
  const p2 = new Plot($('t4a-p2'), { xLabel: 'доба культивування', yLabel: 'кількість на експлантат', x: [0, DAY_MAX], y: 'auto', xShort: 'доба', aspect: 1.7 });

  // ---- запуск
  const runner = new Runner({
    btn: $('t4a-run'), reset: $('t4a-reset'), status: $('t4a-status'), speed: 1,
    step: (dt, t, reset) => {
      if (reset) { SA.day = 0; sl.set('t4a-day', 0, true); dyn = dynamics(o, 0); reads(); plots(); return; }
      SA.day = Math.min(DAY_MAX, SA.day + dt * 4.2);
      if (SA.day >= DAY_MAX) runner.finish();
      sl.set('t4a-day', Math.round(SA.day), true); dyn = dynamics(o, SA.day);
      if (Math.floor(SA.day) !== lastDay) { lastDay = Math.floor(SA.day); reads(); plots(); }
    },
    draw: () => drawScene(),
  });
  let lastDay = -1;
  // «Запустити» з кінця шкали — починаємо з посадки
  const origPlay = runner.play.bind(runner);
  runner.play = () => { if (!runner.started || SA.day >= DAY_MAX - 0.5) { SA.day = 0; sl.set('t4a-day', 0, true); } origPlay(); };

  function update() { o = organo(cur()); dyn = dynamics(o, SA.day); mapDirty = true; drawMap(); drawScene(); reads(); plots(); }

  // ---- фазова карта
  let mapDirty = true, mapImg = null, mapGeo = null, centroids = {};
  function mapGeom(w) { const m = { l: 40, r: 10, t: 10, b: 36 }; return { w, h: w, m, pw: w - m.l - m.r, ph: w - m.t - m.b }; }
  const LMIN = Math.log10(0.005), LMAX = 1;
  const COL = { shoots: [96, 168, 82], roots: [214, 152, 84], callus: [238, 222, 160], weak: [200, 203, 194] };
  function cellColor(oo) {
    const wS = oo.shoot, wR = oo.rootS, wC = oo.callus * 0.85, wW = Math.max(0, 0.55 - oo.g) * 1.2;
    const t = wS + wR + wC + wW + 1e-9;
    const c = [0, 1, 2].map((i) => (COL.shoots[i] * wS + COL.roots[i] * wR + COL.callus[i] * wC + COL.weak[i] * wW) / t);
    return { c, dom: wS >= Math.max(wR, wC, wW) ? 'shoots' : wR >= Math.max(wC, wW) ? 'roots' : wC >= wW ? 'callus' : 'weak' };
  }
  function buildMap(G, dpr) {
    const c = offscreen(G.w * dpr, G.h * dpr), x = c.getContext('2d');
    const step = 2, nx = Math.ceil(G.pw / step), ny = Math.ceil(G.ph / step);
    const acc = { shoots: [0, 0, 0], roots: [0, 0, 0], callus: [0, 0, 0], weak: [0, 0, 0] };
    x.scale(dpr, dpr);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const lc = LMIN + (i + 0.5) / nx * (LMAX - LMIN), la = LMAX - (j + 0.5) / ny * (LMAX - LMIN);
      const oo = organo({ aux: la <= LMIN + 0.02 ? 0 : 10 ** la, auxType: SA.auxType, cyt: lc <= LMIN + 0.02 ? 0 : 10 ** lc, cytType: SA.cytType, light: SA.light, passage: SA.passage });
      const { c: col, dom } = cellColor(oo);
      const px = G.m.l + i * step, py = G.m.t + j * step;
      acc[dom][0] += px; acc[dom][1] += py; acc[dom][2]++;
      x.fillStyle = rgba(col); x.fillRect(px, py, step + 0.6, step + 0.6);
    }
    centroids = {};
    for (const k in acc) if (acc[k][2] > 120) centroids[k] = [acc[k][0] / acc[k][2], acc[k][1] / acc[k][2]];
    // м'яке освітлення «рельєфу» карти
    const g = x.createLinearGradient(G.m.l, G.m.t, G.m.l + G.pw, G.m.t + G.ph);
    g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
    x.fillStyle = g; x.fillRect(G.m.l, G.m.t, G.pw, G.ph);
    return c;
  }
  const X = (G, lc) => G.m.l + (lc - LMIN) / (LMAX - LMIN) * G.pw;
  const Y = (G, la) => G.m.t + (LMAX - la) / (LMAX - LMIN) * G.ph;
  function drawMap() {
    const w = mapCv.parentElement.clientWidth; if (!w) return;
    const ww = Math.min(w, 420);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (mapCv.width !== Math.round(ww * dpr)) { mapCv.width = Math.round(ww * dpr); mapCv.height = Math.round(ww * dpr); mapCv.style.width = ww + 'px'; mapCv.style.height = ww + 'px'; mapDirty = true; }
    const G = mapGeom(ww); mapGeo = G;
    if (mapDirty || !mapImg) { mapImg = buildMap(G, dpr); mapDirty = false; }
    const ctx = mapCv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ww, ww);
    ctx.drawImage(mapImg, 0, 0, ww, ww);
    ctx.save(); ctx.beginPath(); ctx.rect(G.m.l, G.m.t, G.pw, G.ph); ctx.clip();
    // ізолінії відношення А/Ц (в еквівалентах): lgA = lgC + lg(ratio·kC/kA)
    ctx.font = '600 10px system-ui, sans-serif';
    for (const R of [100, 10, 1, 0.1]) {
      const off = Math.log10(R * CYT[SA.cytType].k / AUX[SA.auxType].k);
      ctx.strokeStyle = 'rgba(30,50,35,.35)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(G, LMIN), Y(G, LMIN + off)); ctx.lineTo(X(G, LMAX), Y(G, LMAX + off)); ctx.stroke(); ctx.setLineDash([]);
      // підпис біля правого/верхнього краю
      let lc = LMAX - 0.12, la = lc + off;
      if (la > LMAX - 0.12) { la = LMAX - 0.12; lc = la - off; }
      if (lc > LMIN + 0.3 && la > LMIN + 0.2) {
        const t = `А/Ц=${String(R).replace('.', ',')}`, px = X(G, lc), py = Y(G, la);
        ctx.fillStyle = 'rgba(255,255,255,.75)'; const m = ctx.measureText(t).width; roundRect(ctx, px - m - 6, py - 6, m + 6, 13, 4); ctx.fill();
        ctx.fillStyle = '#2B3D31'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(t, px - 3, py + 0.5);
      }
    }
    // назви областей
    const NAME = { shoots: 'пагони', roots: 'корені', callus: 'калюс', weak: 'слабкий ріст' };
    ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const k in centroids) {
      const [cx, cy] = centroids[k];
      const m = ctx.measureText(NAME[k]).width;
      ctx.fillStyle = 'rgba(255,255,255,.82)'; roundRect(ctx, cx - m / 2 - 6, cy - 9, m + 12, 18, 9); ctx.fill();
      ctx.fillStyle = k === 'shoots' ? '#1F5A24' : k === 'roots' ? '#7A4A16' : '#4A4320'; ctx.fillText(NAME[k], cx, cy + 0.5);
    }
    ctx.restore();
    // осі
    ctx.strokeStyle = '#46584C'; ctx.lineWidth = 1; ctx.strokeRect(G.m.l + 0.5, G.m.t + 0.5, G.pw, G.ph);
    ctx.fillStyle = '#46584C'; ctx.font = '11px system-ui, sans-serif';
    const ticks = [[0.01, '0,01'], [0.1, '0,1'], [1, '1'], [10, '10']];
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const [v, t] of ticks) { const px = X(G, Math.log10(v)); ctx.fillText(t, px, G.m.t + G.ph + 4); ctx.fillRect(px, G.m.t + G.ph, 1, 3); }
    ctx.fillText('0', G.m.l + 3, G.m.t + G.ph + 4);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const [v, t] of ticks) { const py = Y(G, Math.log10(v)); ctx.fillText(t, G.m.l - 4, py); ctx.fillRect(G.m.l - 3, py, 3, 1); }
    ctx.fillText('0', G.m.l - 4, G.m.t + G.ph - 4);
    ctx.font = '600 11.5px system-ui, sans-serif'; ctx.fillStyle = '#13241A'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${CYT[SA.cytType].name}, мг/л`, G.m.l + G.pw / 2, G.h - 2);
    ctx.save(); ctx.translate(11, G.m.t + G.ph / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(`${AUX[SA.auxType].name}, мг/л`, 0, 0); ctx.restore();
    // поточна точка
    const px = X(G, Math.log10(SA.cyt)), py = Y(G, Math.log10(SA.aux));
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(px + 1.5, py + 2, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#B07A0E'; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.stroke();
  }
  // перетягування точки на карті
  let drag = false;
  const fromPointer = (e) => {
    const G = mapGeo; if (!G) return;
    const r = mapCv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const lc = clamp(LMIN + (x - G.m.l) / G.pw * (LMAX - LMIN), LMIN, LMAX), la = clamp(LMAX - (y - G.m.t) / G.ph * (LMAX - LMIN), LMIN, LMAX);
    sl.set('t4a-cyt', 10 ** lc, true); sl.set('t4a-aux', 10 ** la, true);
    SA.cyt = sl.values['t4a-cyt']; SA.aux = sl.values['t4a-aux']; vesselLabel = '';
    o = organo(cur()); dyn = dynamics(o, SA.day); drawMap(); drawScene(); reads(); plots();
  };
  mapCv.addEventListener('pointerdown', (e) => { drag = true; mapCv.setPointerCapture(e.pointerId); fromPointer(e); });
  mapCv.addEventListener('pointermove', (e) => { if (drag) fromPointer(e); });
  mapCv.addEventListener('pointerup', () => { drag = false; });
  mapCv.addEventListener('pointercancel', () => { drag = false; });

  // ---- сцена: колба з калюсом + лупа
  function drawScene() {
    const W = cv.parentElement.clientWidth; if (!W) return;
    const phone = W < 620;
    const { ctx, w, h } = fit(cv, { aspect: phone ? 0.86 : 1.72, min: 320, max: 540 });
    const hy = scene(ctx, w, h, { kind: 'room', horizon: phone ? 0.74 : 0.72, light: 0.3 });
    const s = phone ? Math.min(h * 0.56, w * 0.6) : Math.min(h * 0.74, w * 0.36);
    const fcx = phone ? w * 0.3 : w * 0.27, by = phone ? h * 0.95 : hy + (h - hy) * 0.6;
    const k = s / 70;                         // px на мм (колба 50 мл ≈ 70 мм заввишки)
    const lr = phone ? Math.min(w * 0.24, h * 0.22) : Math.min(h * 0.36, w * 0.2);
    const lcx = phone ? w * 0.72 : w * 0.7, lcy = phone ? h * 0.3 : h * 0.43;
    const d = clamp(2 * Math.cbrt(3 * dyn.mass / (2 * Math.PI)) * 10, 4, 22); // діаметр калюсу, мм (маса ≈ об'єм, см³)
    let calTop = by;
    const geo = {};
    flask(ctx, fcx, by, s, {
      liquid: { level: 0.3, color: MAT.agarMS, gel: true, alpha: 0.82 }, plug: 'foil',
      contents: (c, F) => { calTop = drawCallus(c, fcx, F.surf, d * k, k); geo.surf = F.surf; },
    });
    tagSmall(ctx, fcx, Math.min(h - 6, by + 18), vesselLabel || medLabel(), { bg: 'rgba(255,255,255,.85)', size: phone ? 10.5 : 11.5 });
    // промінь «лупи» від калюсу
    const ax = fcx, ay = calTop + d * k * 0.15;
    ctx.save();
    const ang = Math.atan2(lcy - ay, lcx - ax), pa = ang + Math.PI / 2;
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lcx + Math.cos(pa) * lr, lcy + Math.sin(pa) * lr); ctx.lineTo(lcx - Math.cos(pa) * lr, lcy - Math.sin(pa) * lr); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,70,50,.25)'; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#1F3A2A'; ctx.beginPath(); ctx.arc(ax, ay, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
    lens(ctx, lcx, lcy, lr, lensState(), { label: 'Лупа ×10: поверхня калюсу', seed: 5 + SA.passage });
  }
  function medLabel() { return `${AUX[SA.auxType].name} ${mg(SA.aux)} + ${CYT[SA.cytType].name} ${mg(SA.cyt)} мг/л`; }

  /** Калюс у колбі з коренями (в агарі), меристематичними зонами й пагонами. Повертає y верхівки калюсу. */
  function drawCallus(c, cx, surf, dpx, k) {
    const half = dpx / 2, domeH = dpx * 0.5;
    const top = (dx) => surf - domeH * Math.sqrt(Math.max(0, 1 - (dx / (half * 1.05)) ** 2)) + 1;
    // корені — у товщі агару і по поверхні
    const R = rng(91);
    dyn.roots.forEach((q, i) => {
      if (q.len <= 0) return;
      const side = i % 2 ? 1 : -1, f = 0.35 + 0.6 * R();
      const x0 = cx + side * half * f, y0 = surf - 1 + R() * 2;
      const angle = Math.PI / 2 + side * (0.25 + R() * 0.9);
      root(c, x0, y0, q.len * k * 0.8, angle, { seed: 30 + i, width: Math.max(1.4, k * 0.55), alpha: 0.92 });
    });
    const tint = SA.light ? smooth(0.1, 1, dyn.zones) * 0.35 : 0;
    const brown = o.path === 'weak' ? smooth(20, 60, SA.day) * 0.35 : clamp((SA.passage - 6) / 12, 0, 0.3);
    callus(c, cx, surf + 2, half * 1.05, { color: MAT.callusWhite, friable: o.path === 'callus' ? 0.6 : 0.35, green: tint, brown, seed: 7 });
    // меристематичні осередки на поверхні
    if (dyn.zones > 0.02) {
      const Rz = rng(17);
      for (let i = 0; i < 6; i++) { const dx = (Rz() - 0.5) * dpx * 0.85; meristemZone(c, cx + dx, top(dx) + 2, dpx * (0.08 + Rz() * 0.06), dyn.zones, { light: SA.light }); }
    }
    // апекси й мікропагони
    const shown = dyn.apices.slice(0, 18);
    shown.forEach((a, i) => {
      if (SA.day < a.ti) return;
      const q = (i + 0.5) / shown.length, dx = (q - 0.5) * dpx * 0.82 * (i % 2 ? 1 : 0.86);
      const bx = cx + dx, byy = top(dx) + 1;
      const hpx = a.h * k;
      if (a.h < 1.2) { bud(c, bx, byy, k * (0.5 + a.h * 0.4), { green: SA.light ? 1 : 0.15, open: a.h / 2, seed: i }); return; }
      plantlet(c, bx, byy, { height: hpx, nodes: clamp(Math.round(a.h / 4) + 2, 2, 6), leafLen: k * clamp(2 + a.h * 0.28, 2, 6.5), roots: { n: 0, len: 0 }, sway: (q - 0.5) * 0.5, pale: SA.light ? 0 : 0.85, seed: 40 + i });
    });
    return top(0);
  }
  function lensState() {
    const R = rng(23), zones = [], buds = [], roots = [];
    const zc = [[-0.35, -0.2], [0.3, -0.35], [0.05, 0.25], [-0.45, 0.4], [0.45, 0.3], [0.0, -0.55]];
    const nZ = Math.min(6, Math.max(dyn.zones > 0.02 ? 2 : 0, Math.round(o.shoot * 7)));
    for (let i = 0; i < nZ; i++) zones.push({ x: zc[i][0], y: zc[i][1], r: 0.2 + R() * 0.1, k: dyn.zones });
    // осередки на ранній стадії (через 1 тиждень): світлі вузлики
    if (dyn.foci > 0.05 && dyn.zones < 0.3) for (let i = 0; i < 5; i++) zones.push({ x: (R() - 0.5) * 1.3, y: (R() - 0.5) * 1.3, r: 0.07, k: dyn.foci * 0.5 });
    const nB = Math.min(nZ, dyn.nAp);
    for (let i = 0; i < nB; i++) { const a = dyn.apices[i]; buds.push({ x: zc[i][0], y: zc[i][1] + 0.05, s: 0.07 + Math.min(a.h, 8) / 8 * 0.11, green: SA.light ? 1 : 0.15, open: clamp(a.h / 6, 0, 1), seed: i }); }
    const nR = Math.min(4, dyn.nR);
    for (let i = 0; i < nR; i++) { const q = dyn.roots[i]; roots.push({ x: -0.5 + i * 0.33, y: 0.15 + (i % 2) * 0.2, len: Math.min(1.1, q.len / 10), ang: Math.PI / 2 + (i - 1.5) * 0.25, seed: 50 + i }); }
    return { zones, buds, roots, light: SA.light, tint: SA.light && dyn.zones > 0.5 ? '#E3E2B4' : '#EDE1BC', brown: o.path === 'weak' ? smooth(20, 60, SA.day) * 0.4 : 0 };
  }

  // ---- числа, вердикт, графіки
  function reads() {
    const root = $('t4a-reads');
    setOut(root, {
      ratio: `${fnum(o.ratio, o.ratio < 1 ? 2 : o.ratio < 10 ? 1 : 0)}`,
      path: PATH_TXT[o.path],
      shoots: `${dyn.nAp} / ${dyn.n10}`,
      roots: `${dyn.nR}`,
      mass: `${fnum(dyn.mass, 2)} г`,
      day: `${Math.round(SA.day)}`,
    });
    $('t4a-hud').innerHTML = `<span>Доба ${Math.round(SA.day)}</span><span>${SA.light ? '3 клк · 16 год' : 'темрява'} · 25 °C</span>`;
    // етапи ЛР 15
    const steps = [[0, 0], [7, dyn.foci], [21, dyn.zones], [35, dyn.nAp > 0 ? 1 : 0], [49, dyn.n10 > 0 ? 1 : 0]];
    document.querySelectorAll('#t4a-steps li').forEach((li, i) => { li.classList.toggle('is-done', SA.day >= steps[i][0] && (i === 0 || steps[i][1] > 0.5)); li.classList.toggle('is-off', SA.day >= steps[i][0] && i > 0 && steps[i][1] <= 0.5 && SA.day > steps[i][0] + 7); });
    const v = $('t4a-verdict');
    let txt = '', cls = '';
    const R = `А/Ц ≈ ${fnum(o.ratio, o.ratio < 10 ? 1 : 0)}`;
    if (o.path === 'shoots') txt = `<b>Стебловий органогенез.</b> ${R}: цитокінін переважає, тож у калюсі закладаються меристематичні осередки, далі апекси й мікропагони — до ${o.nShoots} на експлантат. Пагони завдовжки 10 мм відокремлюють і переносять на середовище для укорінення (вкладка <a href="#t4-tab-b">Б</a>).`;
    else if (o.path === 'roots') { txt = `<b>Ризогенез.</b> ${R}: переважання ауксину дає лише корені (${o.nRoots}) без регенерації цілої рослини (с. 79 посібника). Щоб отримати пагони, зменшіть ауксин або додайте цитокінін.`; cls = 'is-warn'; }
    else if (o.path === 'mixed') txt = `<b>Пагони й корені одночасно.</b> ${R} — перехідна зона балансу.`;
    else if (o.path === 'callus') { txt = `<b>Неорганізований калюс.</b> ${R}: клітини діляться, але органи не закладаються${SA.auxType === 'd24' ? ' — 2,4-Д тримає клітини дедиференційованими' : ''}.`; cls = 'is-warn'; }
    else if (o.path === 'callus+') { txt = `<b>Калюс із поодинокими органами.</b> ${R} — межа між калюсом і пагоноутворенням: ${o.nShoots} пагонів, ${o.nRoots} коренів. Рецептура ЛР 16 (2 мг/л ІОК + 0,25 мг/л кінетину) лежить саме тут: за схемою Скуга — Міллера для тютюну вона дала б переважно калюс, а реальний вихід пагонів у томатів залежить від сорту й експлантату.`; cls = 'is-warn'; }
    else { txt = `<b>Слабкий ріст.</b> Без екзогенних гормонів калюс живиться лише власними (ендогенними) і майже не росте; органи поодинокі. Це контроль ЛР 15 а.`; cls = 'is-bad'; }
    if (!SA.light && o.shoot > 0.1) txt += ' У темряві бруньок менше, а пагони бліді (етиольовані) — для зеленіння потрібне світло.';
    if (SA.passage > 4 && o.s > 0.5) txt += ` Пасаж ${SA.passage}: здатність до стеблового органогенезу знижена до ${fnum(o.capS * 100, 0)} % від першого пасажу.`;
    v.className = 'ag-verdict ' + cls; v.innerHTML = txt;
  }
  function plots() {
    const sh = sample((r) => 100 * logistic(-(r - TH.shoot) / TH.w), -2, 3, 160);
    const rt = sample((r) => 100 * logistic((r - TH.root) / TH.w), -2, 3, 160);
    const ca = sample((r) => 100 * (1 - logistic(-(r - TH.shoot) / TH.w) - logistic((r - TH.root) / TH.w)), -2, 3, 160);
    p1.set([
      { data: sh, color: '#3E8F3A', label: 'пагони', fill: 'rgba(62,143,58,.10)' },
      { data: ca, color: '#B59A3A', label: 'калюс' },
      { data: rt, color: '#C27A2C', label: 'корені', fill: 'rgba(194,122,44,.10)' },
    ], [{ x: o.r, label: 'поточне', color: '#8C6A10' }]);
    const ap = [], s10 = [], rr = [];
    for (let t = 0; t <= DAY_MAX; t += 1) { const d = dynamics(o, t); ap.push([t, d.nAp]); s10.push([t, d.n10]); rr.push([t, d.nR]); }
    p2.set([
      { data: ap, color: '#3E8F3A', label: 'апекси (пагони)', type: 'step' },
      { data: s10, color: '#1F5A24', label: 'пагони ≥ 10 мм', dash: [6, 4], type: 'step' },
      { data: rr, color: '#C27A2C', label: 'корені', type: 'step' },
    ], [{ x: SA.day, label: `доба ${Math.round(SA.day)}`, color: '#8C6A10' }]);
  }

  onResize(cv.parentElement, () => drawScene());
  onResize(mapCv.parentElement, () => { mapDirty = true; drawMap(); });
  update();
  return { runner, get o() { return o; }, redraw: () => { drawScene(); drawMap(); } };
}

/* ================= Вкладка Б: укорінення ================= */
export function initB(getA) {
  const cv = $('t4b-scene'); if (!cv) return null;
  const SB = { dark: true, shoots: 29, day: 14 };
  segmented($('t4b-cond'), 't4b-cond', [{ value: '1', label: 'Темрява (за посібником)' }, { value: '0', label: 'Світло 3 клк' }], '1', (v) => { SB.dark = v === '1'; update(); });
  const sl = sliders($('t4b-ctrl'), [
    { id: 't4b-sh', label: 'Пагонів на експлантат', min: 0, max: 40, step: 1, value: SB.shoots, unit: 'шт.', hint: 'Скільки мікропагонів дав калюс (див. вкладку А).' },
    { id: 't4b-day', label: 'Доба укорінення', min: 0, max: 20, step: 1, value: SB.day, unit: 'доба' },
  ], (id) => { SB.shoots = sl.values['t4b-sh']; SB.day = sl.values['t4b-day']; update(); });
  $('t4b-take').addEventListener('click', () => { const a = getA(); if (a) { sl.set('t4b-sh', a.o.nShoots, true); SB.shoots = a.o.nShoots; update(); } });
  const p1 = new Plot($('t4b-p1'), { xLabel: 'доба на середовищі для укорінення', yLabel: 'вкорінені пагони, %', x: [0, 20], y: [0, 100], xShort: 'доба', aspect: 1.7 });
  const p2 = new Plot($('t4b-p2'), { xLabel: 'пасаж калюсу', yLabel: 'регенерантів на експлантат', x: [1, 12], y: 'auto', xShort: 'пасаж', aspect: 1.7 });
  const runner = new Runner({
    btn: $('t4b-run'), reset: $('t4b-reset'), status: $('t4b-status'),
    step: (dt, t, reset) => {
      if (reset) { SB.day = 0; sl.set('t4b-day', 0, true); update(); return; }
      SB.day = Math.min(20, SB.day + dt * 1.6); if (SB.day >= 20) runner.finish();
      sl.set('t4b-day', Math.round(SB.day), true);
      if (Math.floor(SB.day) !== last) { last = Math.floor(SB.day); reads(); plots(); }
    },
    draw: () => draw(),
  });
  let last = -1;
  const origPlay = runner.play.bind(runner);
  runner.play = () => { if (!runner.started || SB.day >= 19.5) { SB.day = 0; sl.set('t4b-day', 0, true); } origPlay(); };

  function tubeState(med, i, n) {
    const m = ROOTING[med], q = (i + 0.5) / n, Rmax = m.Rmax * (SB.dark ? 1 : 0.8), t50 = m.t50 + (SB.dark ? 0 : 3);
    const ti = q < Rmax ? t50 + m.s * Math.log(q / (Rmax - q)) : Infinity;  // обернена логістична функція
    const len = SB.day > ti ? (SB.day - ti) * m.rate : 0;
    return { ti, len, n: SB.day > ti ? Math.max(1, Math.round(m.nRoots * (0.7 + 0.6 * ((i * 0.618) % 1)) * smooth(0, 4, SB.day - ti))) : 0 };
  }
  function draw() {
    const W = cv.parentElement.clientWidth; if (!W) return;
    const phone = W < 620;
    const { ctx, w, h } = fit(cv, { aspect: phone ? 0.95 : 2.1, min: 300, max: 470 });
    const hy = scene(ctx, w, h, { kind: SB.dark ? 'dark' : 'room', horizon: 0.86, light: 0.5 });
    const n = 4, gap = phone ? w * 0.07 : w * 0.08;
    const tw = Math.min(phone ? w * 0.085 : w * 0.05, 40), th = Math.min(h * 0.72, tw * 6.2);
    const groupW = n * tw + (n - 1) * tw * 0.75;
    const x0 = (w - 2 * groupW - gap) / 2, top = hy - th - 4;
    const k = th / 150;                       // пробірка 150 мм
    // штатив
    const rack = (x, ww) => {
      ctx.fillStyle = SB.dark ? '#2B3A33' : '#C7D0CC'; roundRect(ctx, x - 8, top + th * 0.18, ww + 16, 7, 3); ctx.fill();
      ctx.fillStyle = SB.dark ? '#1E2924' : '#AEB9B4'; roundRect(ctx, x - 8, hy - 9, ww + 16, 9, 3); ctx.fill();
    };
    ['ms', 'iba'].forEach((med, g) => {
      const gx = x0 + g * (groupW + gap);
      rack(gx, groupW);
      for (let i = 0; i < n; i++) {
        const st = tubeState(med, i, n), x = gx + i * tw * 1.75;
        const hmm = 10 + SB.day * (med === 'iba' ? 0.45 : 0.3) * (SB.dark ? 1.2 : 1);   // ГК стимулює видовження
        tube(ctx, x, top, tw, th, {
          medium: { level: 0.3, color: MAT.agarMS, alpha: 0.85 }, plug: 'foil',
          contents: (c, I) => {
            const bx = I.x + I.w / 2;
            for (let r = 0; r < st.n; r++) root(c, bx + (r - st.n / 2) * 1.4, I.surface + 1, st.len * k * (0.7 + 0.5 * ((r * 0.37 + i * 0.21) % 1)), Math.PI / 2 + (r - (st.n - 1) / 2) * 0.32, { seed: 9 + r + i * 7, width: Math.max(1.1, tw * 0.07) });
            // базальний калюс на зрізі
            callus(c, bx, I.surface + 1.5, tw * 0.16, { seed: 3 + i, n: 9, glossy: 0.5 });
            plantlet(c, bx, I.surface, { height: hmm * k * 2.2, nodes: 3, leafLen: tw * 0.32, roots: { n: 0, len: 0 }, pale: SB.dark ? smooth(0, 14, SB.day) * 0.7 : 0, seed: 60 + i + g * 9, sway: (i - 1.5) * 0.06 });
          },
        });
      }
      const lab = med === 'ms' ? 'а) МС без гормонів' : 'б) МС + 2 ІМК + 1 ГК';
      tagSmall(ctx, gx + groupW / 2 - tw * 0.2, h - 8, lab, { bg: SB.dark ? 'rgba(235,245,238,.9)' : 'rgba(255,255,255,.88)', size: phone ? 10.5 : 11.5 });
    });
    $('t4b-hud').innerHTML = `<span>Доба ${Math.round(SB.day)} з 20</span><span>${SB.dark ? 'темрява' : '3 клк'} · 25 °C</span>`;
  }
  function reads() {
    const a = getA(), ra = rooted('ms', SB.day, SB.dark), rb = rooted('iba', SB.day, SB.dark);
    setOut($('t4b-reads'), {
      ra: `${fnum(ra * 100, 0)} %`, rb: `${fnum(rb * 100, 0)} %`,
      nr: `${fnum(ROOTING.iba.nRoots, 0)} / ${fnum(ROOTING.ms.nRoots, 0)}`,
      reg: `${fnum(regenerants(SB.shoots, 'ms', SB.dark), 1)} / ${fnum(regenerants(SB.shoots, 'iba', SB.dark), 1)}`,
    });
    const v = $('t4b-verdict');
    const first = (med) => { const m = ROOTING[med]; return m.t50 + (SB.dark ? 0 : 3) - 2 * m.s; };
    v.className = 'ag-verdict' + (SB.dark ? '' : ' is-warn');
    v.innerHTML = `Корені на середовищі з ІМК (індоліл-3-масляною кислотою) з'являються приблизно з ${fnum(first('iba'), 0)}-ї доби, на МС без гормонів — з ${fnum(first('ms'), 0)}-ї (посібник: через 7–14 діб). ` +
      `На 20-ту добу вкорінено ${fnum(rooted('iba', 20, SB.dark) * 100, 0)} % проти ${fnum(rooted('ms', 20, SB.dark) * 100, 0)} %. ` +
      (SB.dark ? 'Темрява (ЛР 15, п. 5) зберігає ауксин від фоторозкладу й сприяє закладанню коренів.' : 'На світлі ауксин частково руйнується, тож корені з\'являються пізніше й рідше — у посібнику колби ставлять у темряву.') +
      (a ? ` Із ${SB.shoots} пагонів на експлантат вийде ≈ ${fnum(regenerants(SB.shoots, 'iba', SB.dark), 0)} рослин-регенерантів.` : '');
  }
  function plots() {
    p1.set([
      { data: sample((t) => 100 * rooted('iba', t, SB.dark), 0, 20, 120), color: '#3E8F3A', label: 'б) МС + ІМК + ГК', fill: 'rgba(62,143,58,.08)' },
      { data: sample((t) => 100 * rooted('ms', t, SB.dark), 0, 20, 120), color: '#B08A2E', label: 'а) МС без гормонів' },
    ], [{ x: SB.day, label: `доба ${Math.round(SB.day)}` }, { x: 7, color: '#7A8A80', dash: [2, 4] }, { x: 14, color: '#7A8A80', dash: [2, 4], label: '7–14 діб (посібник)' }]);
    const a = getA(), base = a ? a.o : null;
    const ser = (med) => { const out = []; for (let p = 1; p <= 12; p++) { const oo = organo({ aux: Z(SA.aux), auxType: SA.auxType, cyt: Z(SA.cyt), cytType: SA.cytType, light: SA.light, passage: p }); out.push([p, regenerants(oo.nShoots, med, SB.dark)]); } return out; };
    p2.set([
      { data: ser('iba'), color: '#3E8F3A', label: 'б) МС + ІМК + ГК' },
      { data: ser('ms'), color: '#B08A2E', label: 'а) МС без гормонів' },
      { data: ser('iba'), color: '#3E8F3A', type: 'points', r: 3.5 },
    ], base ? [{ x: SA.passage, label: `пасаж ${SA.passage} (вкладка А)` }] : []);
  }
  function update() { draw(); reads(); plots(); }
  onResize(cv.parentElement, () => draw());
  update();
  return { runner, redraw: () => { draw(); reads(); plots(); } };
}
