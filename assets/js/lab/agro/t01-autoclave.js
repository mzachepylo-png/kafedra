// ЛР 1, 4. Автоклав у розрізі: прогрів камери й об'єму середовища, загибель спор, режими табл. 2 посібника (с. 51).
//
// Фізика й калібрування (див. коментарі біля функцій):
//  • Температура насиченої пари — рівняння Антуана для води (99–374 °C): lg P[мм рт. ст.] = 8,14019 − 1810,94/(244,485 + T).
//    Тиск у посібнику — надлишковий, «атм»; абсолютний P = 1 + p. При p = 1 атм → 120,7 ≈ 121 °C (с. 51, табл. 2).
//  • Неповне видалення повітря: залишок ≈ 0,5 атм повітря (закон Дальтона) → пара має лише P − 0,5 атм → ≈ 112 °C при p = 1.
//  • Прогрів середовища — закон Ньютона: dT/dt = (T_камери − T)/τ(V). τ(V) = 2,4·V^0,195 хв (V у мл) — найповільніший
//    прогрів, за якого КОЖЕН режим табл. 2 (20–50 мл — 15 хв … 2000 мл — 40 хв при 1 атм, с. 51) ще дає lg N ≤ −3
//    (підбір за повним циклом: 9 хв нагріву + 6 хв набору тиску + витримка + повільне скидання).
//  • Загибель спор — кінетика першого порядку: lg N = lg N₀ − F/D₁₂₁, F = ∫10^((T−121,1)/z) dt (летальність, хв),
//    еталонний тест-мікроорганізм Geobacillus stearothermophilus: D₁₂₁ = 1,5 хв, z = 10 °C; N₀ = 10 спор/мл середовища.
//    Ціль — імовірність нестерильності посудини ≤ 10⁻³.
//  • «Термічне навантаження» середовища (карамелізація сахарози, гідроліз агару, руйнування вітамінів) — C-значення
//    з z = 25 °C (типове для хімічних реакцій), нормоване на режим табл. 2 для того ж об'єму. Це якісне наближення.
import { Plot, sliders, segmented, setOut, fnum, clamp, lerp, TAU, rng, scene, shadow, flask, tube, rgba, mix, hex, shade, roundRect, microField, Runner, onResize, fit, MAT, smooth } from './kit.js';
import { gauge, steel, steamPuffs, tempColor, chip, font, brushed, flame } from './t01-draw.js';

export const VOLS = [
  { v: 35, label: '20–50 мл', short: '20–50', tBook: 15, kind: 'tubes' },
  { v: 75, label: '75 мл', short: '75', tBook: 20, kind: 'small' },
  { v: 300, label: '150–500 мл', short: '150–500', tBook: 25, kind: 'mid' },
  { v: 1000, label: '1000 мл', short: '1000', tBook: 30, kind: 'big' },
  { v: 2000, label: '2000 мл', short: '2000', tBook: 40, kind: 'huge' },
];
const D121 = 1.5, Z = 10, ZQ = 25, C0 = 10, SAL = -3;

/** Температура насиченої водяної пари (°C) за абсолютним тиском (атм). */
export function tsat(pAbs) { const P = 760 * Math.max(0.05, pAbs); return 1810.94 / (8.14019 - Math.log10(P)) - 244.485; }
export const tau = (V) => 2.4 * Math.pow(V, 0.195);

/** Повний цикл автоклавування. Повертає ряди й підсумки. */
export function simulate({ V, p, hold, purge = true, slow = true }, dt = 0.05) {
  const air = purge ? 0 : 0.5;
  const Th = (P) => tsat(1 + P - air);              // температура в камері за надлишкового тиску P
  const t1 = 9;                                      // нагрів води до кипіння (+ продування)
  const t2 = 3 + 3 * p;                              // набір тиску
  const tauEx = slow ? 4 : 0.35;                     // скидання тиску
  const tEx = slow ? 16 : 3;
  const T0 = 20, tc = tau(V), tot = t1 + t2 + hold + tEx;
  const out = { t: [], Tch: [], Tc: [], P: [], lg: [], phases: { t1, t2: t1 + t2, t3: t1 + t2 + hold, end: tot } };
  let T = T0, F = 0, C = 0, superMax = 0, lg0 = Math.log10(C0 * V), t = 0, k = 0;
  const every = Math.max(1, Math.round(0.25 / dt));
  while (t <= tot + 1e-9) {
    let P, Tch;
    if (t < t1) { P = 0; Tch = T0 + (100 - T0) * Math.pow(t / t1, 0.85); }
    else if (t < t1 + t2) { P = p * (t - t1) / t2; Tch = Math.max(100, Th(P)); }
    else if (t < t1 + t2 + hold) { P = p; Tch = Th(p); }
    else { const te = t - t1 - t2 - hold; P = p * Math.exp(-te / tauEx); Tch = Math.max(99.5, Th(P)); if (P < 0.01) { P = 0; Tch = Math.max(85, 100 - (te - tauEx * Math.log(p / 0.01)) * 2.5); } }
    T += (Tch - T) / tc * dt;
    if (T > 100) { F += Math.pow(10, (T - 121.1) / Z) * dt; C += Math.pow(10, (T - 121.1) / ZQ) * dt; }
    if (t >= t1 + t2 + hold) superMax = Math.max(superMax, T - tsat(1 + P));
    if (k % every === 0) { out.t.push(t); out.Tch.push(Tch); out.Tc.push(T); out.P.push(P); out.lg.push(lg0 - F / D121); }
    t += dt; k++;
  }
  out.F = F; out.C = C; out.lg0 = lg0; out.lgEnd = lg0 - F / D121; out.superMax = superMax; out.tau = tc; out.Tmax = Th(p);
  out.pNS = 1 - Math.exp(-Math.pow(10, out.lgEnd));
  return out;
}

/** Мінімальна витримка (хв), що дає lg N ≤ −3, для об'єму V за заданого режиму. */
export function holdNeeded(V, opts) {
  let lo = 0, hi = 240;
  if (simulate(Object.assign({}, opts, { V, hold: hi }), 0.1).lgEnd > SAL) return Infinity;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (simulate(Object.assign({}, opts, { V, hold: mid }), 0.1).lgEnd > SAL) lo = mid; else hi = mid; }
  return hi;
}

/* ===================================================================== */
export function initAutoclave(root) {
  const $ = (s) => root.querySelector(s);
  const cv = $('canvas'), hud = $('.ag-stage__hud'), verdict = $('.ag-verdict');
  const S = { vi: 2, p: 1, hold: 25, purge: true, slow: true, heat: true };
  let sim = null, ref = null, tm = 0, anim = 0;

  const segV = segmented($('[data-ctl="vol"]'), 'acv', VOLS.map((o, i) => ({ value: i, label: o.short + ' мл' })), S.vi, (v) => { S.vi = +v; sl.set('hold', VOLS[S.vi].tBook, true); recalc(); });
  const sl = sliders($('[data-ctl="sl"]'), [
    { id: 'p', label: 'Тиск пари (надлишковий)', min: 0.3, max: 2.2, step: 0.1, value: S.p, unit: 'атм', digits: 1, hint: '1 атм ≈ 121 °C; 2 атм ≈ 134 °C' },
    { id: 'hold', label: 'Витримка за робочого тиску', min: 5, max: 70, step: 1, value: S.hold, unit: 'хв', hint: 'Відлік — від моменту, коли манометр показав задане значення' },
  ], () => { S.p = sl.values.p; S.hold = sl.values.hold; recalc(); });
  const segA = segmented($('[data-ctl="air"]'), 'aca', [{ value: 1, label: 'Повітря видалено' }, { value: 0, label: 'Залишилось повітря' }], 1, (v) => { S.purge = v === '1' || v === 1; recalc(); });
  const segE = segmented($('[data-ctl="ex"]'), 'ace', [{ value: 1, label: 'Повільно скинути тиск' }, { value: 0, label: 'Різко' }], 1, (v) => { S.slow = v === '1' || v === 1; recalc(); });

  const presets = {
    book: () => { S.p = 1; S.hold = VOLS[S.vi].tBook; S.purge = true; S.slow = true; },
    short: () => { S.vi = 3; S.p = 1; S.hold = 15; S.purge = true; S.slow = true; },
    air: () => { S.p = 1; S.hold = VOLS[S.vi].tBook; S.purge = false; S.slow = true; },
    fast: () => { S.vi = 3; S.p = 1; S.hold = 30; S.purge = true; S.slow = false; },
    over: () => { S.vi = 1; S.p = 1.2; S.hold = 60; S.purge = true; S.slow = true; },
    waste: () => { S.vi = 2; S.p = 2; S.hold = 55; S.purge = true; S.slow = true; },
  };
  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    presets[b.dataset.preset](); segV.select(S.vi); sl.set('p', S.p, true); sl.set('hold', S.hold, true); segA.select(S.purge ? 1 : 0); segE.select(S.slow ? 1 : 0); recalc();
  }));

  // графіки
  const pT = new Plot($('[data-plot="T"]'), { xLabel: 't, хв', yLabel: 'T, °C', xShort: 't', y: [15, 140], ariaLabel: 'Температура в камері й у центрі посудини від часу' });
  const pN = new Plot($('[data-plot="N"]'), { xLabel: 't, хв', yLabel: 'lg N (спор у посудині)', xShort: 't', ariaLabel: 'Логарифм кількості живих спор від часу' });
  const pV = new Plot($('[data-plot="V"]'), { xLabel: 'Об\'єм середовища, мл', yLabel: 'Витримка, хв', xShort: 'V', ariaLabel: 'Час стерилізації від об\'єму: табл. 2 посібника і модель' });
  let needCache = '';

  function recalc() {
    const V = VOLS[S.vi].v;
    sim = simulate({ V, p: S.p, hold: S.hold, purge: S.purge, slow: S.slow });
    ref = simulate({ V, p: 1, hold: VOLS[S.vi].tBook, purge: true, slow: true });
    const ph = sim.phases, narrow = root.clientWidth < 600;
    const markIdx = runner.started ? clamp(Math.round(tm / 0.25), 0, sim.t.length - 1) : null;
    const mk = (arr) => (markIdx != null ? [sim.t[markIdx], arr[markIdx]] : undefined);
    pT.set([
      { data: sim.t.map((t, i) => [t, sim.Tch[i]]), color: '#C2410C', label: 'камера (пара)', width: 2.2, marker: mk(sim.Tch) },
      { data: sim.t.map((t, i) => [t, sim.Tc[i]]), color: '#2563EB', label: `центр посудини (${VOLS[S.vi].label})`, width: 2.6, marker: mk(sim.Tc) },
    ], [{ y: 121, color: '#8C6A10', label: '121 °C' }, { x: ph.t2, color: '#64748B', dash: [3, 4], label: narrow ? '' : 'старт витримки' }, { x: ph.t3, color: '#64748B', dash: [3, 4], label: narrow ? '' : 'скидання тиску' }]);
    const y0 = Math.min(-8, Math.floor(SAL - 2)), y1 = Math.ceil(sim.lg0 + 1);
    pN.setOptions({ y: [y0, y1] });
    pN.set([
      { data: sim.t.map((t, i) => [t, Math.max(y0 - 1, sim.lg[i])]), color: '#7C3AED', label: 'lg N живих спор', width: 2.6, marker: mk(sim.lg.map((v) => Math.max(y0 - 1, v))) },
    ], [{ y: 0, color: '#64748B', label: narrow ? '1 спора' : '1 спора на посудину' }, { y: SAL, color: '#15803D', label: 'ціль: 10⁻³' }, { x: ph.t2, color: '#64748B', dash: [3, 4] }]);
    // табл. 2 проти моделі — перераховуємо лише при зміні режиму
    const key = `${S.p}|${S.purge}|${S.slow}`;
    if (key !== needCache) {
      needCache = key;
      const curve = [];
      for (let lv = Math.log10(15); lv <= Math.log10(2400) + 1e-9; lv += 0.1) { const V2 = Math.pow(10, lv), h = holdNeeded(V2, { p: S.p, purge: S.purge, slow: S.slow }); curve.push([V2, Math.min(h, 90)]); }
      pV._curve = curve;
    }
    pV.setOptions({ y: [0, 80], x: [0, 2200] });
    pV.set([
      { data: pV._curve, color: '#2563EB', label: `модель: мінімум для ${fnum(S.p, 1)} атм`, width: 2.4 },
      { data: VOLS.map((o) => [o.v, o.tBook]), color: '#B45309', type: 'points', label: 'табл. 2 посібника (1 атм)', r: 5 },
      { data: [[V, S.hold]], color: '#DC2626', type: 'points', label: 'ваш режим', r: 6 },
    ]);
    // показники
    const need = holdNeeded(V, { p: S.p, purge: S.purge, slow: S.slow });
    const deg = sim.C / ref.C;
    const boil = !S.slow && sim.superMax > 2;
    setOut(root, {
      tch: `${fnum(sim.Tmax, 1)} °C`,
      tau: `${fnum(sim.tau, 1)} хв`,
      f0: `${fnum(sim.F, 1)} хв`,
      lg: `<span class="${sim.lgEnd <= SAL ? 'is-ok' : 'is-bad'}">${fnum(sim.lgEnd, 1)}</span>`,
      pns: pnsText(sim.pNS),
      need: isFinite(need) ? `${fnum(need, 0)} хв` : '> 4 год',
      deg: `${fnum(deg, 2)}×`,
    });
    // вердикт
    let cls = '', msg = '';
    const lack = sim.lgEnd > SAL;
    if (lack && !S.purge) { cls = 'is-bad'; msg = `<b>Повітря не видалене:</b> за манометром ${fnum(S.p, 1)} атм, але пара в суміші з повітрям нагріває камеру лише до ${fnum(sim.Tmax, 1)} °C (замість ${fnum(tsat(1 + S.p), 1)} °C). Летальність F = ${fnum(sim.F, 1)} хв — спори виживають (lg N = ${fnum(sim.lgEnd, 1)}). Перед набором тиску продувайте автоклав парою через відкритий клапан 3–5 хв.`; }
    else if (lack) { cls = 'is-bad'; msg = `<b>Недостатня стерилізація.</b> Центр посудини (${VOLS[S.vi].label}) прогрівається з запізненням τ ≈ ${fnum(sim.tau, 1)} хв, тож за ${S.hold} хв витримки накопичено лише F = ${fnum(sim.F, 1)} хв. Імовірність, що в посудині залишилась жива спора, — ${pnsText(sim.pNS)}. Потрібно щонайменше ${isFinite(need) ? fnum(need, 0) + ' хв' : 'значно довше'} (табл. 2: ${VOLS[S.vi].tBook} хв при 1 атм).`; }
    else if (boil) { cls = 'is-bad'; msg = `<b>Середовище стерильне (lg N = ${fnum(sim.lgEnd, 1)}), але різке скидання тиску:</b> рідина в колбі перегріта на ${fnum(sim.superMax, 0)} °C відносно точки кипіння за новим тиском і скипає — змочує й виштовхує пробки (с. 58 посібника). Відкривайте кришку лише коли стрілка манометра на «0».`; }
    else if (deg > 1.7) { cls = 'is-warn'; msg = `<b>Стерильно, але з перегрівом.</b> Термічне навантаження в ${fnum(deg, 1)} раза більше, ніж за режимом табл. 2: сахароза частково карамелізується (середовище темнішає), агар у кислому середовищі гідролізується й гірше застигає, руйнуються термолабільні вітаміни. ${S.p >= 1.8 ? 'Режим 2 атм, 50–60 хв призначений для знешкодження інфікованих культур перед миттям посуду, а не для середовищ.' : ''}`; }
    else { cls = ''; msg = `<b>Режим надійний.</b> Камера ${fnum(sim.Tmax, 1)} °C, центр посудини наздоганяє її з τ ≈ ${fnum(sim.tau, 1)} хв; летальність F = ${fnum(sim.F, 1)} хв знижує кількість спор з 10<sup>${fnum(sim.lg0, 1)}</sup> до 10<sup>${fnum(sim.lgEnd, 1)}</sup> на посудину. Табл. 2 рекомендує для ${VOLS[S.vi].label} — ${VOLS[S.vi].tBook} хв при 1 атм.`; }
    verdict.className = 'ag-verdict ' + cls; verdict.innerHTML = msg;
    draw();
  }

  function pnsText(p) { if (p >= 0.995) return '≈ 100 %'; if (p >= 0.01) return `${fnum(p * 100, 0)} %`; if (p < 1e-9) return '< 10⁻⁹'; return fnum(p, 1); }

  /* ---------- Сцена ---------- */
  function state() {
    if (!runner.started) return { t: 0, Tch: 20, Tc: 20, P: 0, lg: sim.lg0, phase: 0 };
    const i = clamp(tm / 0.25, 0, sim.t.length - 1), a = Math.floor(i), b = Math.min(sim.t.length - 1, a + 1), f = i - a;
    const g = (arr) => lerp(arr[a], arr[b], f), ph = sim.phases;
    const t = tm;
    return { t, Tch: g(sim.Tch), Tc: g(sim.Tc), P: g(sim.P), lg: g(sim.lg), phase: t < ph.t1 ? 1 : t < ph.t2 ? 2 : t < ph.t3 ? 3 : t < ph.end ? 4 : 5 };
  }

  function draw() {
    if (!sim) return;
    const mob = cv.parentElement.clientWidth < 620;
    const { ctx, w, h } = fit(cv, { aspect: mob ? 0.82 : 1.75, min: 360, max: 560 });
    const st = state();
    const hy = scene(ctx, w, h, { kind: 'bench', horizon: mob ? 0.8 : 0.84 });
    // --- автоклав ---
    const bw = mob ? Math.min(w * 0.56, h * 0.5) : Math.min(w * 0.36, h * 0.6);
    const cx = mob ? w * 0.34 : w * 0.33, by = hy + (h - hy) * 0.35;
    const top = by - bw * 1.18;
    drawAutoclave(ctx, cx, by, bw, top, st);
    // --- права колонка: манометр, показники, поле зору зі спорами ---
    const rx = mob ? w * 0.81 : w * 0.76;
    const gr = mob ? Math.min(w * 0.14, 46) : Math.min(h * 0.14, 66);
    const gy = mob ? h * 0.15 : h * 0.2;
    gauge(ctx, rx, gy, gr, st.P, { max: 3, red: 2.5, label: mob ? '' : 'МАНОМЕТР', unit: 'кгс/см²' });
    const fs = mob ? 10.5 : 12;
    let yy = gy + gr * 1.1 + (mob ? 22 : 30);
    chip(ctx, rx, yy, `Камера ${fnum(st.Tch, 1)} °C`, { size: fs, color: '#9A3412' }); yy += fs + 14;
    chip(ctx, rx, yy, `Центр ${fnum(st.Tc, 1)} °C`, { size: fs, color: '#1D4ED8' }); yy += fs + 14;
    const holdT = st.phase === 3 ? st.t - sim.phases.t2 : st.phase > 3 ? S.hold : 0;
    chip(ctx, rx, yy, mob ? `${mmss(holdT)} з ${mmss(S.hold)}` : `Витримка ${mmss(holdT)} / ${mmss(S.hold)}`, { size: fs }); yy += fs + 12;
    // поле зору: спори Geobacillus у середовищі
    const fr = mob ? Math.min(w * 0.15, 52) : Math.min(h * 0.17, 74);
    const fy = Math.min(hy - fr - 6, yy + fr + 12);
    const lgN = st.lg;
    microField(ctx, rx, fy, fr, (c, f) => drawSpores(c, f, lgN), { mode: 'phase' });
    chip(ctx, rx, fy + fr + (mob ? 22 : 26), lgN > 0 ? `живих спор: ${fnum(Math.pow(10, lgN), 0)}` : `lg N = ${fnum(lgN, 1)}`, { size: fs - 0.5, dark: true });
    // HUD
    const names = ['Готово до запуску', 'Нагрів і продування парою', 'Набір тиску', `Витримка ${fnum(sim.Tmax, 0)} °C`, S.slow ? 'Повільне скидання тиску' : 'Різке скидання тиску!', 'Цикл завершено'];
    hud.innerHTML = `<span>${names[st.phase]}</span><span>t = ${mmss(st.t)}</span>`;
  }

  function mmss(m) { const s = Math.max(0, Math.round(m * 60)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

  function drawSpores(c, f, lgN) {
    // 60 спор у полі зору при lg N ≥ lg N₀; живі — яскраві (фазовий контраст), загиблі — темні «тіні»
    const R = rng(5), n = 46;
    const alive = clamp(Math.pow(10, lgN - sim.lg0), 0, 1); // частка живих
    const nAlive = lgN > 0 ? Math.max(alive * n, lgN > 0.5 ? 1 : 0) : 0;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * f.r * 0.85, x = f.cx + Math.cos(a) * d, y = f.cy + Math.sin(a) * d, rot = R() * 3;
      const live = i < nAlive;
      c.save(); c.translate(x, y); c.rotate(rot);
      const L = f.r * 0.07, W = f.r * 0.042;
      if (live) {
        const g = c.createRadialGradient(-L * 0.3, -W * 0.3, 0.3, 0, 0, L);
        g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.6, '#F1F5E8'); g.addColorStop(1, '#5E6B58');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, L, W, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(20,30,20,.6)'; c.lineWidth = 0.8; c.stroke();
      } else {
        c.fillStyle = 'rgba(60,64,58,.55)'; c.beginPath(); c.ellipse(0, 0, L, W, 0, 0, TAU); c.fill();
      }
      c.restore();
    }
  }

  function drawAutoclave(ctx, cx, by, bw, top, st) {
    const x0 = cx - bw / 2, x1 = cx + bw / 2, lidH = bw * 0.14, wall = Math.max(4, bw * 0.03);
    const t = performance.now() / 1000;
    shadow(ctx, cx + bw * 0.08, by + 4, bw * 0.62, bw * 0.08, 0.4);
    // корпус
    const bodyTop = top + lidH;
    ctx.save();
    ctx.fillStyle = steel(ctx, x0, x1); roundRect(ctx, x0, bodyTop, bw, by - bodyTop, 10); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.drawImage(brushed(128, 128), x0, bodyTop, bw, by - bodyTop); ctx.globalAlpha = 1;
    // нагрівальний блок збоку
    ctx.fillStyle = steel(ctx, x0 - bw * 0.12, x0); roundRect(ctx, x0 - bw * 0.11, by - bw * 0.3, bw * 0.13, bw * 0.18, 3); ctx.fill();
    ctx.fillStyle = st.phase && st.phase < 4 ? '#F97316' : '#4B5563'; ctx.beginPath(); ctx.arc(x0 - bw * 0.045, by - bw * 0.21, 2.6, 0, TAU); ctx.fill();
    // розріз (передня стінка «вирізана»)
    const ix0 = x0 + wall * 2.2, ix1 = x1 - wall * 2.2, iy0 = bodyTop + bw * 0.06, iy1 = by - bw * 0.07;
    ctx.fillStyle = '#C9CFD1'; roundRect(ctx, ix0 - wall, iy0 - wall, ix1 - ix0 + 2 * wall, iy1 - iy0 + 2 * wall, 8); ctx.fill(); // торець стінки
    ctx.strokeStyle = 'rgba(70,80,84,.5)'; ctx.lineWidth = 1; ctx.stroke();
    const ig = ctx.createLinearGradient(ix0, 0, ix1, 0);
    ig.addColorStop(0, '#5D676B'); ig.addColorStop(0.35, '#9AA4A8'); ig.addColorStop(0.55, '#7D878B'); ig.addColorStop(1, '#3F474A');
    ctx.fillStyle = ig; roundRect(ctx, ix0, iy0, ix1 - ix0, iy1 - iy0, 6); ctx.fill();
    ctx.save(); roundRect(ctx, ix0, iy0, ix1 - ix0, iy1 - iy0, 6); ctx.clip();
    // тепле підсвічування стінок
    const heat = clamp((st.Tch - 20) / 110, 0, 1);
    ctx.fillStyle = `rgba(255,150,80,${0.12 * heat})`; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
    // вода й ТЕН
    const wy = iy1 - (iy1 - iy0) * 0.13;
    const wg = ctx.createLinearGradient(0, wy, 0, iy1); wg.addColorStop(0, 'rgba(170,205,220,.85)'); wg.addColorStop(1, 'rgba(90,130,150,.9)');
    ctx.fillStyle = wg; ctx.fillRect(ix0, wy, ix1 - ix0, iy1 - wy);
    const glow = st.phase >= 1 && st.phase <= 3 ? 1 : st.phase === 4 ? 0.3 : 0;
    ctx.strokeStyle = glow ? `rgb(${lerp(90, 255, glow)},${lerp(90, 110, glow)},${lerp(90, 40, glow)})` : '#5B6266'; ctx.lineWidth = Math.max(2, bw * 0.018); ctx.lineCap = 'round';
    ctx.beginPath(); for (let i = 0; i <= 6; i++) { const xx = lerp(ix0 + 10, ix1 - 10, i / 6); const yy = iy1 - (iy1 - wy) * (i % 2 ? 0.25 : 0.65); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
    if (glow) { ctx.shadowColor = 'rgba(255,120,40,.8)'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0; }
    if (st.Tch > 96 && runner.running) { // кипіння
      const R = rng(Math.floor(t * 6));
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(lerp(ix0, ix1, R()), lerp(wy, iy1, R()), 1 + R() * 2, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(ix0, wy, ix1 - ix0, 1.2);
    // кошик (перфорований)
    const ky = wy - bw * 0.04;
    ctx.fillStyle = '#AEB6B9'; ctx.fillRect(ix0 + 6, ky, ix1 - ix0 - 12, Math.max(3, bw * 0.02));
    ctx.fillStyle = 'rgba(40,50,55,.5)'; for (let xx = ix0 + 12; xx < ix1 - 12; xx += 7) { ctx.beginPath(); ctx.arc(xx, ky + Math.max(1.5, bw * 0.01), 1.1, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#8E979B'; ctx.fillRect(ix0 + 14, ky, 3, wy - ky + 6); ctx.fillRect(ix1 - 17, ky, 3, wy - ky + 6);
    // посуд із середовищем
    drawLoad(ctx, (ix0 + ix1) / 2, ky, ix1 - ix0 - 16, ky - iy0 - 8, st, t);
    // пара
    if (st.Tch > 99) {
      const a = clamp((st.Tch - 99) / 20, 0, 1);
      ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.12 * a})`; ctx.fillRect(ix0, iy0, ix1 - ix0, wy - iy0);
      steamPuffs(ctx, (ix0 + ix1) / 2, wy, { t, n: 10, spread: ix1 - ix0, rise: (wy - iy0) * 0.9, a: 0.22 * a, seed: 4, scale: bw / 260 });
    }
    // внутрішня тінь
    const sh = ctx.createLinearGradient(ix0, 0, ix0 + 24, 0); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.fillRect(ix0, iy0, 24, iy1 - iy0);
    ctx.restore();
    // зливний кран
    ctx.fillStyle = '#C62828'; roundRect(ctx, cx - bw * 0.05, by - bw * 0.05, bw * 0.1, bw * 0.03, 2); ctx.fill();
    ctx.fillStyle = steel(ctx, cx - 3, cx + 3); ctx.fillRect(cx - 2.5, by - bw * 0.03, 5, bw * 0.05);
    // ручки
    for (const s of [-1, 1]) { ctx.fillStyle = '#1F2326'; roundRect(ctx, (s < 0 ? x0 - bw * 0.1 : x1 - bw * 0.01), bodyTop + bw * 0.01, bw * 0.11, bw * 0.06, 4); ctx.fill(); }
    // кришка з фланцем
    ctx.fillStyle = steel(ctx, x0 - 6, x1 + 6); roundRect(ctx, x0 - 6, bodyTop - 4, bw + 12, lidH * 0.42, 4); ctx.fill();
    ctx.fillStyle = steel(ctx, x0, x1, { dark: 0.05 });
    ctx.beginPath(); ctx.moveTo(x0, bodyTop - 3); ctx.quadraticCurveTo(cx, top - lidH * 0.4, x1, bodyTop - 3); ctx.closePath(); ctx.fill();
    // баранці
    for (let i = 0; i < 5; i++) { const xx = lerp(x0 + 8, x1 - 8, i / 4); ctx.fillStyle = '#3A4246'; ctx.fillRect(xx - 1.5, bodyTop - 8, 3, 12); ctx.fillStyle = steel(ctx, xx - 7, xx + 7); ctx.beginPath(); ctx.ellipse(xx, bodyTop - 9, 7, 2.6, 0, 0, TAU); ctx.fill(); }
    // клапани і манометр на кришці
    const ly = top + lidH * 0.15;
    // клапан випуску повітря (чорна ручка)
    const vx = cx - bw * 0.27; ctx.fillStyle = steel(ctx, vx - 4, vx + 4); ctx.fillRect(vx - 3, ly - bw * 0.06, 6, bw * 0.09);
    ctx.fillStyle = '#111'; roundRect(ctx, vx - 8, ly - bw * 0.09, 16, bw * 0.04, 4); ctx.fill();
    // запобіжний клапан
    const sx = cx + bw * 0.27; ctx.fillStyle = steel(ctx, sx - 5, sx + 5); roundRect(ctx, sx - 5, ly - bw * 0.1, 10, bw * 0.13, 3); ctx.fill();
    // стійка манометра + малий манометр
    ctx.fillStyle = '#C8A24A'; ctx.fillRect(cx - 2, ly - bw * 0.1, 4, bw * 0.12);
    gauge(ctx, cx, ly - bw * 0.16, bw * 0.08, st.P, { max: 3, label: '', unit: '' });
    // струмінь пари з клапана: продування й скидання тиску
    const purging = st.phase === 1 && st.Tch > 92 && S.purge;
    const venting = st.phase === 4 && st.P > 0.02;
    if (purging || venting) steamPuffs(ctx, vx, ly - bw * 0.1, { t, n: venting && !S.slow ? 16 : 9, spread: 10, rise: bw * (venting && !S.slow ? 0.6 : 0.35), a: venting && !S.slow ? 0.75 : 0.5, seed: 9, scale: bw / 300 });
    ctx.restore();
    // підписи (лише статичний кадр/широкий екран)
    if (cv.parentElement.clientWidth > 520) {
      chip(ctx, vx + 12, ly - bw * 0.11, 'клапан повітря', { size: 11, align: 'right' });
      chip(ctx, ix0 + 8, iy1 - 6, 'вода й ТЕН (нагрівач)', { size: 10.5, align: 'left', dark: true });
    }
  }

  function drawLoad(ctx, cx, by, W, H, st, t) {
    const kind = VOLS[S.vi].kind;
    const Tc = st.Tc, Tch = st.Tch;
    const deg = runner.started && st.phase >= 3 ? clamp((sim.C / ref.C - 1) * 0.5, 0, 0.8) * clamp((st.t - sim.phases.t2) / Math.max(1, S.hold), 0, 1) : 0;
    const medC = rgba(mix(hex('#F1EBCB'), hex('#B98A3E'), deg));
    const boiling = !S.slow && st.phase >= 4 && sim.superMax > 2 && st.P > 0.01 ? clamp(sim.superMax / 10, 0.3, 1) : 0;
    const thermal = (c, i) => { // термокарта: від стінки (температура камери) до центру
      const ccx = i.cx, ccy = (i.surf + i.by) / 2 + 2, rr = Math.max(8, (i.by - i.surf) * 0.9);
      const g = c.createRadialGradient(ccx, ccy, 0, ccx, ccy, Math.max(i.bw * 0.5, rr));
      g.addColorStop(0, rgba(tempColor(Tc), 0.55)); g.addColorStop(0.55, rgba(tempColor(lerp(Tc, Tch, 0.5)), 0.42)); g.addColorStop(1, rgba(tempColor(Tch), 0.5));
      c.save(); c.beginPath(); c.rect(ccx - i.bw, i.surf, i.bw * 2, i.by - i.surf + 4); c.clip(); c.fillStyle = g; c.fillRect(ccx - i.bw, i.surf - 4, i.bw * 2, i.by - i.surf + 10); c.restore();
      if (boiling) { const R = rng(Math.floor(t * 8)); c.fillStyle = 'rgba(255,255,255,.85)'; for (let k = 0; k < 30 * boiling; k++) { c.beginPath(); c.arc(ccx + (R() - 0.5) * i.bw * 0.8, lerp(i.surf, i.by, R()), 0.8 + R() * 2.2, 0, TAU); c.fill(); } }
    };
    const fl = (x, s, lev) => {
      const r = flask(ctx, x, by, s, { liquid: { level: lev, color: medC, bubbles: boiling ? 0 : 0 }, plug: 'foil', t, contents: S.heat ? thermal : null });
      if (boiling) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(x + (k - 3.5) * s * 0.035, r.top - s * 0.02 - Math.abs(Math.sin(t * 9 + k)) * s * 0.08 * boiling, s * 0.03, 0, TAU); ctx.fill(); } ctx.restore(); }
    };
    if (kind === 'tubes') {
      const n = 6, tw = Math.min(W / (n + 2), H * 0.13), th = Math.min(H * 0.92, tw * 5.6);
      // штатив
      ctx.fillStyle = '#B9C2C4'; ctx.fillRect(cx - (n * tw * 1.5) / 2 - 6, by - th * 0.55, n * tw * 1.5 + 12, 4);
      for (let i = 0; i < n; i++) {
        const x = cx - (n * tw * 1.5) / 2 + i * tw * 1.5 + tw * 0.25;
        tube(ctx, x, by - th, tw, th, { medium: { level: 0.4, color: medC }, plug: 'foil', contents: S.heat ? (c, inn) => { const g = c.createLinearGradient(inn.x, 0, inn.x + inn.w, 0); g.addColorStop(0, rgba(tempColor(Tch), 0.5)); g.addColorStop(0.5, rgba(tempColor(Tc), 0.55)); g.addColorStop(1, rgba(tempColor(Tch), 0.5)); c.fillStyle = g; c.fillRect(inn.x - 3, inn.surface, inn.w + 6, by - inn.surface); } : null });
      }
      ctx.fillStyle = '#9EA8AA'; ctx.fillRect(cx - (n * tw * 1.5) / 2 - 6, by - 4, n * tw * 1.5 + 12, 4);
    } else if (kind === 'small') {
      const s = Math.min(H * 0.55, W / 3.4); for (let i = -1; i <= 1; i++) fl(cx + i * s * 1.02, s, 0.42);
    } else if (kind === 'mid') {
      const s = Math.min(H * 0.75, W / 2.3); fl(cx - s * 0.52, s, 0.45); fl(cx + s * 0.52, s, 0.45);
    } else if (kind === 'big') {
      const s = Math.min(H * 0.92, W * 0.62); fl(cx, s, 0.5);
    } else {
      const s = Math.min(H * 0.98, W * 0.78); fl(cx, s, 0.6);
    }
  }

  const runner = new Runner({
    btn: $('.ag-run'), reset: $('[data-act="reset"]'), status: $('.ag-status'),
    step: (dt, t, reset) => {
      if (reset) { tm = 0; recalc(); return; }
      tm += dt * sim.phases.end / 14; // весь цикл — ≈ 14 с
      if (tm >= sim.phases.end) { tm = sim.phases.end; runner.finish(); }
      if ((anim = (anim + 1) % 6) === 0) recalc(); else draw();
    },
    draw: () => draw(),
  });
  onResize(cv.parentElement, () => recalc());
  recalc();
  return { redraw: () => recalc() };
}
