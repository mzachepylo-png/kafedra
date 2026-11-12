// Тема 3. Облік ростових характеристик калюсної культури (ЛР 13–14, с. 73–76 посібника Мельничука, Кляченко, 2014).
// Вкладка А — ЛР 14: калюси на середовищах №1–4 (табл. 5: БАП, ГК3, ІОК, НОК по 0,2 мг/л), S-крива, фази,
//              індекс приросту, таблиця 6 (сира маса на 1, 7, 14, 21, 28-му добу, 6 повторностей).
// Вкладка Б — ЛР 13: мацерація, камера Фукса — Розенталя, ручний підрахунок клітин, формула Брауна.
import * as K from './kit.js';
import { drawCallus, vial, tag, simulate, at, phases, phaseAt, BandPlot, tabs, reads, select, checkbox, fmtMg, glassShine } from './t02-lib.js';

const { fnum, clamp, lerp, smooth, rng, TAU, hex, rgba, mix, shade } = K;
const $ = (id) => document.getElementById(id);
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

/* ======================================================================
   Культури й середовища ЛР 14
   ======================================================================
   Табл. 5 (с. 76): середовище МС (макро- і мікросолі, вітаміни, гідролізат казеїну 500 мг, інозит 100 мг,
   Fe-хелат 5 мл, сахароза 20 г, агар 8 г на 1 л) + один регулятор росту 0,2 мг/л:
   №1 — БАП, №2 — ГК3, №3 — ІОК, №4 — НОК. Умови: +23…26 °C, темрява, вологість 70–80 %; сиру масу
   визначають кожні 7 діб (табл. 6). Посібник не наводить очікуваних мас, тому відносні швидкості нижче —
   правдоподібне наближення: НОК стабільніший за ІОК; ГК3 стимулює переважно розтягнення клітин
   (частка приросту за рахунок поділу delta мала), БАП — поділ (delta велика).                          */
const CULT = {
  tomato: { name: 'Томати', lat: 'Solanum lycopersicum L.', mu: 0.3, lag: 4, m0: 0.25, color: '#EFE6C2', yellow: 0.15, fr: 0.6 },
  topinambur: { name: 'Топінамбур', lat: 'Helianthus tuberosus L.', mu: 0.28, lag: 5, m0: 0.35, color: '#F1E3B8', yellow: 0.3, fr: 0.45 },
  potato: { name: 'Картопля', lat: 'Solanum tuberosum L.', mu: 0.26, lag: 5, m0: 0.3, color: '#F2EAD0', yellow: 0.05, fr: 0.5 },
  carnation: { name: 'Гвоздика', lat: 'Dianthus caryophyllus L.', mu: 0.22, lag: 6, m0: 0.2, color: '#ECEBCD', yellow: 0.05, fr: 0.35 },
};
const MED = [
  { id: 1, short: '№1 · БАП', hormone: '6-БАП 0,2 мг/л', mu: 0.86, delta: 0.78, lag: 1.1, fr: -0.2, dry: 7.4, color: '#2E7D5B' },
  { id: 2, short: '№2 · ГК₃', hormone: 'ГК₃ 0,2 мг/л', mu: 0.9, delta: 0.25, lag: 1.0, fr: 0.15, dry: 4.6, color: '#3D6FB6' },
  { id: 3, short: '№3 · ІОК', hormone: 'ІОК 0,2 мг/л', mu: 0.74, delta: 0.55, lag: 1.18, fr: 0, dry: 6.1, color: '#B07D12' },
  { id: 4, short: '№4 · НОК', hormone: 'НОК 0,2 мг/л', mu: 1.0, delta: 0.6, lag: 1.0, fr: 0.12, dry: 5.8, color: '#A4473B' },
];
/** Температурний множник: Q10 = 2 до +27 °C, вище — пригнічення (наближення). */
const fT = (T) => Math.pow(2, (Math.min(T, 27) - 25) / 10) * (T > 27 ? Math.exp(-Math.pow((T - 27) / 4, 2)) : 1);

function params(c, m, W0, T) {
  return { mu: c.mu * m.mu * fT(T), lag: c.lag * m.lag / Math.max(0.6, fT(T)), W0, delta: m.delta, m0: c.m0 };
}
const DAYS_W = [1, 7, 14, 21, 28, 35, 42, 49, 56];

/* ======================================================================
   Аналітичні ваги
   ====================================================================== */
function balance(ctx, x, y, w, mass, { content = null, label = '' } = {}) {
  // x, y — лівий верхній кут корпусу; w — ширина
  const h = w * 0.36, top = y;
  K.shadow(ctx, x + w * 0.52, top + h + 2, w * 0.6, w * 0.06, 0.32);
  // корпус
  const g = ctx.createLinearGradient(0, top, 0, top + h); g.addColorStop(0, '#F5F6F2'); g.addColorStop(1, '#C9CEC8');
  ctx.fillStyle = g; K.roundRect(ctx, x, top, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(60,70,64,.35)'; ctx.lineWidth = 1; ctx.stroke();
  // передня панель з дисплеєм
  const dx = x + w * 0.1, dy = top + h * 0.42, dw = w * 0.5, dh = h * 0.38;
  ctx.fillStyle = '#2A332E'; K.roundRect(ctx, dx - 4, dy - 4, dw + 8, dh + 8, 6); ctx.fill();
  const lg = ctx.createLinearGradient(0, dy, 0, dy + dh); lg.addColorStop(0, '#C9E7B6'); lg.addColorStop(1, '#9CC98A');
  ctx.fillStyle = lg; K.roundRect(ctx, dx, dy, dw, dh, 3); ctx.fill();
  ctx.fillStyle = '#17301C'; ctx.font = `700 ${Math.round(dh * 0.62)}px ui-monospace, "Cascadia Mono", monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`${fnum(mass / 1000, 4)} г`, dx + dw - 6, dy + dh / 2 + 1);
  // кнопки
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 0 ? '#2E7D5B' : '#7C8680'; K.roundRect(ctx, x + w * (0.66 + i * 0.1), dy + dh * 0.15, w * 0.07, dh * 0.7, 4); ctx.fill(); }
  // шибка-вітрозахист і чашка
  const sx = x + w * 0.12, sw = w * 0.76, sy = top - w * 0.42, sh = w * 0.42;
  ctx.fillStyle = 'rgba(220,236,232,.22)'; ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = 'rgba(80,110,100,.5)'; ctx.lineWidth = 1.2; ctx.strokeRect(sx, sy, sw, sh);
  glassShine(ctx, sx, sy, sw, sh, 0.5);
  // шальки
  const pcx = x + w * 0.5, pcy = top - 6;
  ctx.fillStyle = '#8F9894'; ctx.fillRect(pcx - 3, pcy, 6, 6);
  const pg = ctx.createLinearGradient(pcx - w * 0.22, 0, pcx + w * 0.22, 0); pg.addColorStop(0, '#9AA3A0'); pg.addColorStop(0.35, '#F4F6F5'); pg.addColorStop(1, '#808985');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(pcx, pcy, w * 0.22, w * 0.045, 0, 0, TAU); ctx.fill();
  if (content) content(pcx, pcy - 2);
  if (label) tag(ctx, x + w / 2, top + h + 18, label, { size: 11 });
}

/* ======================================================================
   Вкладка А: S-крива (ЛР 14)
   ====================================================================== */
function modelA() {
  const cv = $('t3a-cv'); if (!cv) return;
  const st = { cult: 'topinambur', W0: 100, T: 25, days: 49, sel: 1, t: 0 };
  const setR = reads($('t3a-reads'), [
    ['W', 'Сира маса W<sub>t</sub>'], ['dW', 'Приріст W<sub>t</sub> − W<sub>0</sub>'], ['pct', 'Приріст, % ((W<sub>t</sub> − W<sub>0</sub>)/W<sub>0</sub>·100)'], ['idx', 'Індекс приросту ΔW'],
    ['ph', 'Фаза росту'], ['dry', 'Суха маса (наближено)'], ['N', 'Клітин у калюсі'], ['mc', 'Середня маса клітини'],
  ]);
  select($('t3a-cult'), 'Культура (ЛР 14)', Object.entries(CULT).map(([k, v]) => [k, v.name]), st.cult, (v) => { st.cult = v; changed(); }, 't3a-c');
  const sl = K.sliders($('t3a-sl'), [
    { id: 'W0', label: 'Початкова маса W₀', min: 50, max: 300, step: 10, value: st.W0, unit: 'мг', digits: 0 },
    { id: 'T', label: 'Температура термостата', min: 18, max: 32, step: 0.5, value: st.T, unit: '°C', digits: 1, hint: 'За посібником +23…26 °C' },
    { id: 'days', label: 'Тривалість досліду', min: 28, max: 56, step: 7, value: st.days, unit: 'діб', digits: 0, hint: 'Табл. 6 посібника — до 28-ї доби; подовжте, щоб побачити плато й деградацію' },
  ], () => { Object.assign(st, sl.values); changed(); });
  const selSeg = K.segmented($('t3a-sel'), 't3a-s', MED.map((m) => ({ value: m.id, label: m.short })), st.sel, (v) => { st.sel = +v; refresh(); });

  let M = null;
  function compute() {
    const c = CULT[st.cult], R = rng(st.cult.length * 97 + st.W0);
    M = { c, med: MED.map((m) => {
      const p = params(c, m, st.W0, st.T);
      const sim = simulate(p, 56);
      const reps = [];
      for (let i = 0; i < 6; i++) { const f = Math.exp((R() - 0.5) * 0.3), w0 = st.W0 * (0.9 + R() * 0.2); reps.push(simulate({ ...p, mu: p.mu * f, W0: w0 }, 56)); }
      return { m, p, sim, reps, ph: phases(sim) };
    }) };
  }
  const repStat = (V, d) => { const xs = V.reps.map((s) => at(s, 'W', d)), n = xs.length, mu = xs.reduce((a, b) => a + b, 0) / n; return { mu, sd: Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)) }; };

  const p1 = new BandPlot($('t3a-p1'), { xLabel: 'Доба культивування', yLabel: 'Сира маса калюсу, мг', xShort: 'доба', ariaLabel: 'S-подібні криві росту калюсу на чотирьох середовищах' });
  const p2 = new K.Plot($('t3a-p2'), { xLabel: 'Доба культивування', yLabel: 'Швидкість росту, мг/доба', xShort: 'доба', yZero: true, ariaLabel: 'Абсолютна швидкість росту калюсу' });

  function updatePlots() {
    const D = st.days, V = M.med[st.sel - 1];
    const cut = (s, key) => s.t.map((t, i) => [t, s[key][i]]).filter((p) => p[0] <= D + 1e-6);
    p1.setOptions({ x: [0, D] }); p2.setOptions({ x: [0, D] });
    p1.bands = V.ph.bands.filter((b) => b.a < D).map((b) => ({ ...b, b: Math.min(b.b, D) }));
    const pts = DAYS_W.filter((d) => d <= D && d <= st.t + 1e-6).map((d) => { const s = repStat(V, d); return [d, s.mu, s.sd]; });
    p1.set([
      ...M.med.map((X) => ({ data: cut(X.sim, 'W'), color: X.m.color, width: X.m.id === st.sel ? 3.2 : 1.6, dash: X.m.id === st.sel ? null : [6, 4], label: X.m.short, marker: X.m.id === st.sel ? [st.t, at(X.sim, 'W', st.t)] : null })),
      { data: pts, color: V.m.color, type: 'points', errors: true, r: 4.5, label: 'зважування (x̄ ± SD, n = 6)' },
    ]);
    p2.set(M.med.map((X) => ({ data: cut(X.sim, 'rate'), color: X.m.color, width: X.m.id === st.sel ? 3 : 1.6, dash: X.m.id === st.sel ? null : [6, 4], label: X.m.short })), [{ x: st.t, color: '#8A6A16', dash: [3, 4] }]);
  }
  function updateTable() {
    const D = st.days, ds = DAYS_W.filter((d) => d <= D);
    let hd = '<thead><tr><th>Середовище</th>' + ds.map((d) => `<th class="num">${d}-а доба</th>`).join('') + '</tr></thead><tbody>';
    for (const X of M.med) {
      hd += `<tr${X.m.id === st.sel ? ' class="agx-sel-row"' : ''}><td><b>${X.m.short}</b><br><small>${X.m.hormone}</small></td>` + ds.map((d) => {
        if (d > st.t + 1e-6) return '<td class="num">—</td>';
        const s = repStat(X, d); return `<td class="num">${fnum(s.mu / 1000, 3)}<small> ± ${fnum(s.sd / 1000, 3)}</small></td>`;
      }).join('') + '</tr>';
    }
    $('t3a-table').innerHTML = `<table class="ag-table agx-t6"><caption>Таблиця 6. ${M.c.name} (<i>${M.c.lat}</i>): сира маса калюсу, г (x̄ ± SD, 6 повторностей)</caption>${hd}</tbody></table>`;
  }
  function updateReads() {
    const V = M.med[st.sel - 1], t = st.t, W = at(V.sim, 'W', t), W0 = st.W0, live = at(V.sim, 'live', t);
    setR('W', fmtMg(W)); setR('dW', (W - W0 >= 0 ? '' : '−') + fmtMg(Math.abs(W - W0)));
    setR('pct', `${fnum(((W - W0) / W0) * 100, 0)} %`); setR('idx', fnum((W - W0) / W0, 2));
    const ph = phaseAt(V.ph, t); setR('ph', ph.name, ph.id === 'deg' ? 'is-bad' : '');
    setR('dry', `${fmtMg(W * V.m.dry / 100)} (${fnum(V.m.dry, 1)} %)`);
    const N = at(V.sim, 'N', t), mc = at(V.sim, 'mc', t);
    setR('N', `${fnum(N / 1e6, 2)} млн`); setR('mc', `${fnum(mc, 2)} мкг`);
    $('t3a-hud').innerHTML = `<span>${M.c.name}</span><span>доба ${fnum(t, 0)}</span><span>+${fnum(st.T, 1)} °C · темрява</span>`;
    // вердикт: порівняння середовищ на 28-му добу (як у ЛР 14) і пояснення фаз
    const d28 = Math.min(28, st.days), idx = M.med.map((X) => ({ X, i: (at(X.sim, 'W', d28) - W0) / W0, mc: at(X.sim, 'mc', d28) }));
    const best = idx.slice().sort((a, b) => b.i - a.i)[0], worst = idx.slice().sort((a, b) => a.i - b.i)[0];
    const ga = idx[1], bap = idx[0];
    let txt = `<b>${M.c.name}, ${d28}-а доба:</b> найбільший індекс приросту на середовищі ${best.X.m.short} (ΔW = ${fnum(best.i, 1)}), найменший — на ${worst.X.m.short} (${fnum(worst.i, 1)}). `;
    txt += `На ГК₃ маса росте переважно за рахунок <b>розтягнення</b> клітин (середня маса клітини ${fnum(ga.mc, 2)} мкг), на БАП — за рахунок <b>поділу</b> (${fnum(bap.mc, 2)} мкг) — це перевіряють підрахунком клітин у ЛР 13 (вкладка Б). `;
    const s = V.ph.bands.find((b) => b.id === 'sta'), lin = V.ph.bands.find((b) => b.id === 'lin');
    if (lin && s) txt += `Для ${V.m.short}: лінійна фаза ${fnum(lin.a, 0)}–${fnum(lin.b, 0)} доба, плато — з ${fnum(s.a, 0)}-ї; пасирувати варто до початку стаціонарної фази.`;
    let cls = '';
    if (st.T > 29 || st.T < 21) { txt += ` Температура +${fnum(st.T, 1)} °C поза рекомендованими +23…26 °C — ріст сповільнений.`; cls = 'is-warn'; }
    const v = $('t3a-verdict'); v.className = 'ag-verdict ' + cls; v.innerHTML = txt;
  }

  function draw() {
    if (cv.parentElement.clientWidth < 60) return;
    const cw0 = cv.parentElement.clientWidth, narrow = cw0 < 760, tiny = cw0 < 480;
    const { ctx, w, h } = K.fit(cv, { aspect: tiny ? 0.95 : narrow ? 1.15 : 1.9, min: 330, max: 560 });
    const dpr = DPR(), t = st.t, c = M.c;
    const hy = K.scene(ctx, w, h, { kind: 'bench', horizon: narrow ? 0.46 : 0.52 });
    // ваги: на вузькій сцені — угорі праворуч, на широкій — праворуч від флаконів
    const bw = tiny ? Math.min(w * 0.44, 170) : narrow ? Math.min(w * 0.34, 200) : Math.min(w * 0.24, 230);
    const bx = w - bw - (narrow ? 14 : w * 0.03), by = narrow ? hy - bw * 0.2 : hy + (h - hy) * 0.25;
    const V = M.med[st.sel - 1], Wsel = at(V.sim, 'W', t);
    const sizeOf = (m, px) => Math.cbrt((3 * m) / (2 * Math.PI)) * px * 1.08;
    const brownOf = (X) => clamp((at(X.sim, 'dead', t) / Math.max(1, at(X.sim, 'W', t))) * 1.5, 0, 1);
    balance(ctx, bx, by, bw, Wsel, { label: `Ваги: ${V.m.short}`, content: (px, py) => {
      ctx.save(); ctx.fillStyle = 'rgba(230,240,236,.55)'; ctx.strokeStyle = 'rgba(80,110,100,.55)'; ctx.beginPath(); ctx.ellipse(px, py - 2, bw * 0.19, bw * 0.045, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      drawCallus(ctx, px, py - 1, Math.min(sizeOf(Wsel, bw / 70), bw * 0.13), { seed: 40 + st.sel, friable: clamp(c.fr + V.m.fr, 0.1, 0.9), color: c.color, yellow: c.yellow, brown: brownOf(V), dpr });
    } });
    // флакони
    const area = narrow ? [10, w - 10] : [w * 0.03, bx - w * 0.04];
    const n = 4, vw = Math.min((area[1] - area[0]) / (n + 0.6), narrow ? 120 : 128), vh = vw * 1.55, gap = ((area[1] - area[0]) - n * vw) / (n + 1);
    const vby = h - 34;
    M.med.forEach((X, i) => {
      const x = area[0] + gap + i * (vw + gap), W = at(X.sim, 'W', t);
      vial(ctx, x, vby - vh, vw, vh, { label: X.m.short, highlight: X.m.id === st.sel, agarBrown: brownOf(X) * 0.25, contents: (cx, v) => {
        drawCallus(cx, v.cx, v.surf + 3, Math.min(sizeOf(W, vw / 24), vw * 0.44), { seed: 40 + X.m.id, friable: clamp(c.fr + X.m.fr, 0.1, 0.9), color: c.color, yellow: c.yellow, brown: brownOf(X), dpr });
      } });
    });
    // кліки по флаконах — вибір середовища
    geo = { area, gap, vw, vh, vby };
    cv.setAttribute('aria-label', `Калюс ${c.name} на чотирьох середовищах, доба ${Math.round(t)}; на вагах — ${V.m.short}, ${fnum(Wsel, 0)} мг`);
  }
  let geo = null;
  cv.addEventListener('click', (e) => {
    if (!geo) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = 0; i < 4; i++) { const vx = geo.area[0] + geo.gap + i * (geo.vw + geo.gap); if (x >= vx && x <= vx + geo.vw && y >= geo.vby - geo.vh && y <= geo.vby + 20) { st.sel = i + 1; selSeg.select(st.sel); refresh(); } }
  });

  function refresh() { updateReads(); updatePlots(); updateTable(); draw(); }
  function changed() { compute(); st.t = runner.done ? st.days : Math.min(st.t, st.days); refresh(); }
  const runner = new K.Runner({
    btn: $('t3a-run'), reset: $('t3a-reset'), status: $('t3a-status'),
    step: (dt, T, reset) => {
      if (reset) { st.t = 0; updateReads(); updatePlots(); updateTable(); return; }
      const prevW = Math.floor(st.t / 7);
      st.t = Math.min(st.days, st.t + dt * st.days / 12);
      if (st.t >= st.days) { runner.finish(); $('t3a-status').textContent = 'Дослід завершено: таблицю 6 заповнено.'; }
      else $('t3a-status').textContent = `Культивування… зважування кожні 7 діб`;
      updateReads(); updatePlots(); if (Math.floor(st.t / 7) !== prevW || st.t <= 1.2 || st.t >= st.days) updateTable();
    },
    draw,
  });
  compute(); refresh();
  $('t3a-status').textContent = 'Натисніть «Запустити»: калюси ростимуть, а щотижневі зважування заповнять таблицю 6.';
  $('t3a-csv')?.addEventListener('click', () => {
    const ds = DAYS_W.filter((d) => d <= st.days);
    const rows = [['Середовище', ...ds.map((d) => `доба ${d}, г (середнє)`), ...ds.map((d) => `доба ${d}, SD`)]];
    for (const X of M.med) rows.push([X.m.short + ' ' + X.m.hormone, ...ds.map((d) => repStat(X, d).mu / 1000), ...ds.map((d) => repStat(X, d).sd / 1000)].map((v) => (typeof v === 'number' ? v.toFixed(4).replace('.', ',') : v)));
    const csv = '﻿' + rows.map((r) => r.join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `tablytsia6_${st.cult}.csv`; a.click();
  });
  K.onResize(cv.parentElement, draw);
  return { getSample: (cult, med, day) => { const c = CULT[cult], m = MED[med - 1]; const sim = simulate(params(c, m, st.W0, 25), 56); return { mc: at(sim, 'mc', day), W: at(sim, 'W', day) }; } };
}

/* ======================================================================
   Вкладка Б: метод Брауна, камера Фукса — Розенталя (ЛР 13)
   ======================================================================
   Формула (с. 74):  N = n·V·10³ / (d·0,2)
     N — клітин в 1 г тканини; n — середня кількість клітин в одному великому квадраті; V — об'єм суспензії
     (розчину для мацерації), мл; d — наважка, г; 0,2 — об'єм над одним великим квадратом, мм³
     (1 мм × 1 мм × глибина 0,2 мм); 10³ — перерахунок мм³ у мл (1 мл = 1000 мм³).
   Посібник називає 0,2 «об'ємом камери» — точніше, це об'єм одного великого квадрата; уся сітка
   (16 квадратів) має об'єм 3,2 мм³. Якщо суспензію розвели (крок 3), результат множать на ступінь
   розведення k. Середня маса клітини m = 1/N г = 10⁶/N мкг.                                              */
const SQ_DIAG = [[0, 0], [1, 1], [2, 2], [3, 3]]; // 4 великі квадрати по діагоналі сітки 4×4
function modelB(sampleFn) {
  const cv = $('t3b-cv'); if (!cv) return;
  const st = { cult: 'topinambur', med: 1, day: 28, d: 0.5, V: 5, mix: 'cr', hours: 9, dil: 1, newton: true, fill: 1, sq: 1, prep: 0, prepared: false, show: false };
  const marks = new Map();
  const setR = reads($('t3b-reads'), [
    ['sq', 'Позначено в цьому квадраті'], ['n', 'n — середнє на великий квадрат'], ['N', 'N — клітин в 1 г тканини'], ['m', 'Середня маса однієї клітини'], ['err', 'Статистична похибка ≈ 1/√Σn'], ['dev', 'Відхилення від істинного N'],
  ]);
  select($('t3b-cult'), 'Калюс', Object.entries(CULT).map(([k, v]) => [k, v.name]), st.cult, (v) => { st.cult = v; invalidate(); }, 't3b-c');
  select($('t3b-med'), 'Середовище (ЛР 14)', MED.map((m) => [m.id, `${m.short} (${m.hormone})`]), st.med, (v) => { st.med = +v; invalidate(); }, 't3b-m');
  const dSeg = K.segmented($('t3b-d'), 't3b-dd', [{ value: '0.25', label: 'd = 0,25 г' }, { value: '0.5', label: 'd = 0,5 г' }], '0.5', (v) => { st.d = +v; invalidate(); });
  const mixSeg = K.segmented($('t3b-mix'), 't3b-mx', [{ value: 'cr', label: '5 % CrO₃ + 5 % HCl' }, { value: 'hcl', label: '5–10 % HCl' }], st.mix, (v) => { st.mix = v; invalidate(); });
  const sl = K.sliders($('t3b-sl'), [
    { id: 'day', label: 'Вік калюсу', min: 7, max: 49, step: 7, value: st.day, unit: 'діб', digits: 0 },
    { id: 'V', label: 'Об’єм розчину для мацерації V', min: 2, max: 10, step: 0.5, value: st.V, unit: 'мл', digits: 1, hint: 'За посібником — 5 мл' },
    { id: 'hours', label: 'Час мацерації', min: 2, max: 16, step: 0.5, value: st.hours, unit: 'год', digits: 1, hint: 'Оптимум 8–10 год, підбирають дослідно' },
  ], () => { Object.assign(st, sl.values); invalidate(); });
  const dilSeg = K.segmented($('t3b-dil'), 't3b-k', [{ value: '1', label: 'без розведення' }, { value: '2', label: 'розвести в 2 рази' }], '1', (v) => { st.dil = +v; invalidate(); });
  checkbox($('t3b-nw'), 'Притерти покривне скельце до появи кілець Ньютона', st.newton, (v) => { st.newton = v; invalidate(); }, 't3b-newton');
  const fillSeg = K.segmented($('t3b-fill'), 't3b-f', [1, 2, 3].map((i) => ({ value: i, label: `заповнення ${i}` })), 1, (v) => { st.fill = +v; st.show = false; refresh(); });
  const sqSeg = K.segmented($('t3b-sqs'), 't3b-q', [1, 2, 3, 4].map((i) => ({ value: i, label: `квадрат ${i}` })), 1, (v) => { st.sq = +v; st.show = false; refresh(); });
  $('t3b-auto').addEventListener('click', () => { if (!st.prepared) return; const S = square(); marks.set(key(), new Set(S.cells.filter((c) => c.counted).map((c) => c.id))); refresh(); });
  $('t3b-clear').addEventListener('click', () => { marks.delete(key()); st.show = false; refresh(); });
  $('t3b-check').addEventListener('click', () => { st.show = !st.show; refresh(); });

  const key = () => `${st.fill}-${st.sq}`;
  // ---- «істина» про зразок
  function truth() {
    const s = sampleFn(st.cult, st.med, st.day);
    const Ntrue = 1e6 / s.mc;                      // клітин в 1 г (m у мкг)
    const kMac = st.mix === 'cr' ? 0.32 : 0.2;     // швидкість мацерації, 1/год (наближення)
    const M = 1 - Math.exp(-kMac * st.hours);       // частка клітин, роз'єднаних до поодиноких
    const lys = st.mix === 'cr' ? 1 - Math.exp(-0.16 * Math.max(0, st.hours - 11)) : 1 - Math.exp(-0.1 * Math.max(0, st.hours - 13));
    const hEff = st.newton ? 0.2 : 0.25;            // глибина, мм: без кілець Ньютона скельце «плаває»
    const lam = Ntrue * st.d * (hEff * 1e-3) / (st.V * st.dil); // очікувано клітин над 1 мм² (V — мл, 1 мм³ = 10⁻³ мл)
    const diam = Math.cbrt((6 * s.mc * 1e6) / Math.PI) / 1000; // діаметр клітини, мм (густина ≈ 1 г/см³)
    return { Ntrue, M, lys, hEff, lam, diam, mc: s.mc };
  }
  // ---- клітини в полі (координати в мм відносно лівого верхнього кута великого квадрата)
  const cache = new Map();
  function square(fill = st.fill, sq = st.sq) {
    const T = truth(), k = `${fill}-${sq}-${st.cult}-${st.med}-${st.day}-${st.d}-${st.V}-${st.mix}-${st.hours}-${st.dil}-${st.newton}`;
    if (cache.has(k)) return cache.get(k);
    const R = rng(fill * 1013 + sq * 131 + Math.round(T.lam * 7) + st.cult.length * 17 + st.med * 3);
    const area = 2.2 * 2.2, lamA = T.lam * (1 - 0.6 * T.lys) * area;  // область −0,6…1,6 мм
    const nTot = poisson(R, lamA), cells = [];
    let id = 0;
    const tryPlace = (x, y, rx, ry, rot, ghost, agg) => {
      for (const c of cells) if (Math.hypot(c.x - x, c.y - y) < (Math.max(c.rx, c.ry) + Math.max(rx, ry)) * (agg ? 0.55 : 0.85)) return false;
      cells.push({ id: id++, x, y, rx, ry, rot, ghost, agg, seed: (R() * 1e6) | 0 }); return true;
    };
    let placed = 0, guard = 0;
    while (placed < nTot && guard++ < nTot * 30) {
      const x = -0.6 + R() * 2.2, y = -0.6 + R() * 2.2;
      const s = T.diam * (0.7 + R() * 0.6) / 2, el = 1 + R() * 0.9;
      // агрегати: при недостатній мацерації клітини лишаються групами по 3–7
      if (R() > T.M && placed + 3 < nTot) {
        const m = 3 + ((R() * 5) | 0), rot = R() * TAU;
        for (let j = 0; j < m && placed < nTot; j++) {
          const a = rot + (j % 2 ? 0.5 : -0.5) * j * 0.6, d = j * s * 1.35;
          if (tryPlace(x + Math.cos(a) * d, y + Math.sin(a) * d, s * el * 0.9, s * 0.9, a + Math.PI / 2, false, true)) placed++;
        }
      } else if (tryPlace(x, y, s * el, s, R() * TAU, false, false)) placed++;
    }
    // зруйновані клітини («тіні») при надмірній мацерації — їх не рахують
    const nG = poisson(R, T.lam * T.lys * area * 0.8);
    for (let i = 0; i < nG; i++) { const s = T.diam * (0.7 + R() * 0.6) / 2; tryPlace(-0.6 + R() * 2.2, -0.6 + R() * 2.2, s * (1 + R() * 0.6), s, R() * TAU, true, false); }
    // правило підрахунку: клітини всередині квадрата + ті, що торкаються верхньої й лівої меж; ті, що торкаються нижньої чи правої, — не рахують
    for (const c of cells) {
      const r = Math.max(c.rx, c.ry) * 0.85;
      const touch = c.x + r > 0 && c.x - r < 1 && c.y + r > 0 && c.y - r < 1;
      c.counted = !c.ghost && touch && !(c.x + r > 1 || c.y + r > 1);
      c.edge = touch && !c.ghost && (c.x - r < 0 || c.y - r < 0 || c.x + r > 1 || c.y + r > 1);
    }
    const res = { cells, n: cells.filter((c) => c.counted).length, T };
    cache.set(k, res); if (cache.size > 60) cache.delete(cache.keys().next().value);
    return res;
  }
  function poisson(R, l) { if (l > 60) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss(R))); let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
  function gauss(R) { return Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(TAU * R()); }

  // ---- розрахунок за даними студента
  function student() {
    const cnts = [];
    for (let f = 1; f <= 3; f++) for (let q = 1; q <= 4; q++) { const m = marks.get(`${f}-${q}`); if (m && m.size) cnts.push({ f, q, n: m.size }); }
    const sum = cnts.reduce((a, c) => a + c.n, 0), nBar = cnts.length ? sum / cnts.length : NaN;
    const N = (nBar * st.V * st.dil * 1e3) / (0.2 * st.d);
    return { cnts, sum, nBar, N };
  }
  function updateReads() {
    const T = truth(), S = student(), cur = marks.get(key());
    setR('sq', st.prepared ? `${cur ? cur.size : 0}` : '—');
    setR('n', isFinite(S.nBar) ? `${fnum(S.nBar, 1)} (кв.: ${S.cnts.length})` : '—');
    setR('N', isFinite(S.N) ? `${fnum(S.N, 2)}` : '—');
    setR('m', isFinite(S.N) ? `${fnum(1e6 / S.N, 2)} мкг` : '—');
    setR('err', S.sum ? `± ${fnum(100 / Math.sqrt(S.sum), 0)} %` : '—');
    const dev = isFinite(S.N) ? (S.N / T.Ntrue - 1) * 100 : NaN;
    setR('dev', isFinite(dev) ? `${dev > 0 ? '+' : '−'}${fnum(Math.abs(dev), 0)} %` : '—', isFinite(dev) ? (Math.abs(dev) > 25 ? 'is-bad' : Math.abs(dev) < 12 ? 'is-ok' : '') : '');
    // формула з підстановкою
    const nB = isFinite(S.nBar) ? fnum(S.nBar, 1) : 'n';
    const kPart = st.dil > 1 ? `<mo>·</mo><mn>${st.dil}</mn>` : '';
    $('t3b-formula').innerHTML = `<math display="block"><mi>N</mi><mo>=</mo><mfrac><mrow><mi>n</mi><mo>·</mo><mi>V</mi>${st.dil > 1 ? '<mo>·</mo><mi>k</mi>' : ''}<mo>·</mo><msup><mn>10</mn><mn>3</mn></msup></mrow><mrow><mi>d</mi><mo>·</mo><mn>0,2</mn></mrow></mfrac><mo>=</mo><mfrac><mrow><mn>${nB}</mn><mo>·</mo><mn>${fnum(st.V, 1)}</mn>${kPart}<mo>·</mo><msup><mn>10</mn><mn>3</mn></msup></mrow><mrow><mn>${fnum(st.d, 2)}</mn><mo>·</mo><mn>0,2</mn></mrow></mfrac><mo>=</mo><mn>${isFinite(S.N) ? fnum(S.N, 2) : '?'}</mn><mspace width="0.4em"/><mtext>клітин/г</mtext></math>`;
    $('t3b-hud').innerHTML = `<span>${CULT[st.cult].name} · ${MED[st.med - 1].short} · ${st.day} діб</span><span>заповнення ${st.fill} · квадрат ${st.sq}</span>`;
    // вердикт
    let txt = '', cls = '';
    const notes = [];
    if (T.M < 0.88) notes.push(`мацерація неповна (${fnum(st.hours, 1)} год): багато клітин злиплися в агрегати — їх важко рахувати, оцінка неточна; подовжте мацерацію до 8–10 год`);
    if (T.lys > 0.12) notes.push('мацерація надто довга: частина клітин зруйнувалася (бліді «тіні» не рахують), N занижено');
    if (!st.newton) notes.push('скельце не притерто до кілець Ньютона: шар суспензії глибший за 0,2 мм, тож у квадраті більше клітин і N завищено');
    if (T.lam * (1 - 0.6 * T.lys) > 110 && st.dil === 1) notes.push('клітин дуже багато — за посібником суспензію з дрібними клітинами розводять у 2 рази (не забудьте помножити N на 2)');
    if (!st.prepared) { txt = '<b>Камера ще не заповнена.</b> Натисніть «Запустити»: тканина мацеруватиметься, суспензію струснуть і внесуть у камеру.'; cls = 'is-warn'; }
    else if (!S.cnts.length) { txt = '<b>Рахуйте клітини:</b> торкайтеся кожної клітини в межах великого квадрата. Рахують клітини всередині й ті, що лежать на <span class="agx-g">верхній і лівій</span> межах; клітини на <span class="agx-r">нижній і правій</span> межах не рахують. Потім перейдіть до наступного квадрата по діагоналі.'; }
    else {
      const sqTrue = square().n, curN = cur ? cur.size : 0;
      txt = `<b>Квадрат ${st.sq}: позначено ${curN}, за правилом слід зарахувати ${st.show ? sqTrue : '?'}.</b> Підраховано ${S.cnts.length} з 12 квадратів (4 квадрати × 3 заповнення). Істинне значення моделі: ${st.show || S.cnts.length >= 4 ? `N = ${fnum(T.Ntrue, 2)} клітин/г, m = ${fnum(T.mc, 2)} мкг` : 'з’явиться після 4 квадратів'}.`;
      cls = isFinite(dev) && Math.abs(dev) > 25 ? 'is-warn' : '';
    }
    if (notes.length) { txt += ' <br>⚠ ' + notes.join('; ') + '.'; cls = cls || 'is-warn'; }
    const v = $('t3b-verdict'); v.className = 'ag-verdict ' + cls; v.innerHTML = txt;
  }

  // ---- графік підрахунків
  const p1 = new K.Plot($('t3b-p1'), { xLabel: 'Квадрат (заповнення·квадрат)', yLabel: 'Клітин у великому квадраті', xShort: '№', x: [0.5, 12.5], yZero: true, xFmt: (v) => (Number.isInteger(v) ? `${Math.ceil(v / 4)}·${((v - 1) % 4) + 1}` : ''), ariaLabel: 'Кількість клітин у підрахованих квадратах' });
  function updatePlot() {
    const T = truth(), lam = T.lam * (1 - 0.6 * T.lys), sd = Math.sqrt(lam);
    const mine = [], tr = [];
    for (let f = 1; f <= 3; f++) for (let q = 1; q <= 4; q++) {
      const i = (f - 1) * 4 + q, m = marks.get(`${f}-${q}`);
      if (m && m.size) mine.push([i, m.size]);
      if (st.prepared && (st.show || (m && m.size))) tr.push([i, square(f, q).n]);
    }
    const ymax = Math.max(10, lam + 3 * sd, ...mine.map((p) => p[1]), ...tr.map((p) => p[1])) * 1.12;
    p1.setOptions({ y: [0, ymax] });
    p1.set([
      { data: tr, color: '#9AA39C', type: 'points', r: 5, label: 'за правилом (модель)' },
      { data: mine, color: '#2E7D5B', type: 'points', r: 5.5, label: 'ваш підрахунок' },
    ], [{ y: lam, label: `очікуване λ = ${fnum(lam, 0)}`, color: '#B07D12' }, { y: lam + sd, color: 'rgba(176,125,18,.55)', dash: [3, 4] }, { y: Math.max(0, lam - sd), color: 'rgba(176,125,18,.55)', dash: [3, 4], label: '± √λ' }]);
  }

  // ---- сцена
  let G = null;
  function draw() {
    if (cv.parentElement.clientWidth < 60) return;
    const cw0 = cv.parentElement.clientWidth, narrow = cw0 < 700;
    const { ctx, w, h } = K.fit(cv, { aspect: narrow ? 0.62 : 1.65, min: 360, max: 640 });
    const dpr = DPR(), T = truth();
    K.scene(ctx, w, h, { kind: 'dark', horizon: 0.99 });
    // ліва/верхня частина: пробірки з мацератом і лічильна камера
    const ow = narrow ? w : w * 0.4, oh = narrow ? h * 0.36 : h;
    drawPrep(ctx, 0, 0, ow, oh, T, dpr);
    // поле зору
    const fr = narrow ? Math.min(w * 0.46, (h - oh) * 0.43) : Math.min((w - ow) * 0.45, h * 0.43);
    const fcx = narrow ? w / 2 : ow + (w - ow) / 2, fcy = narrow ? oh + (h - oh) / 2 - 8 : h / 2 - 12;
    const S = st.prepared || st.prep > 0.75 ? square() : null;
    const scale = fr * 1.02; // px на 1 мм (великий квадрат займає ~ половину діаметра поля)
    const ox = fcx - scale / 2, oy = fcy - scale / 2;
    G = { fcx, fcy, fr, scale, ox, oy };
    K.microField(ctx, fcx, fcy, fr, (c) => {
      drawGrid(c, ox, oy, scale, fcx, fcy, fr);
      if (S) {
        const a = st.prepared ? 1 : smooth(0.75, 1, st.prep);
        c.save(); c.globalAlpha = a;
        const mk = marks.get(key()) || new Set();
        for (const cell of S.cells) drawCell(c, ox + cell.x * scale, oy + cell.y * scale, cell, scale);
        c.restore();
        // позначки студента й перевірка
        for (const cell of S.cells) {
          const x = ox + cell.x * scale, y = oy + cell.y * scale, on = mk.has(cell.id);
          if (on) { c.fillStyle = st.show && !cell.counted ? '#C0392B' : '#1E8E4E'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, Math.max(4.5, scale * 0.012), 0, TAU); c.fill(); c.stroke(); }
          if (st.show && cell.counted && !on) { c.strokeStyle = '#E67E22'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, Math.max(cell.rx, cell.ry) * scale + 3, 0, TAU); c.stroke(); }
          if (st.show && on && !cell.counted) { c.strokeStyle = '#C0392B'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 6, y + 6); c.moveTo(x + 6, y - 6); c.lineTo(x - 6, y + 6); c.stroke(); }
        }
      } else {
        tag(c, fcx, fcy + 4, 'Камера порожня', { size: 13, dark: true });
      }
    }, { mode: 'bright' });
    const nm = (marks.get(key()) || new Set()).size;
    tag(ctx, fcx, Math.min(h - 8, fcy + fr * 1.08 + 20), `Квадрат ${st.sq} (1 × 1 мм), ×100 · позначено: ${S ? nm : '—'}${S && st.show ? ` · за правилом: ${S.n}` : ''}`, { size: 12, dark: true });
    cv.setAttribute('aria-label', `Поле зору: великий квадрат ${st.sq} камери Фукса — Розенталя з клітинами калюсу; торкайтеся клітин, щоб рахувати`);
  }
  function drawGrid(c, ox, oy, s, fcx, fcy, fr) {
    // фон камери (злегка блакитний), лінії сітки: малі квадрати 0,25 мм, потрійні межі великих квадратів
    c.save();
    c.strokeStyle = 'rgba(40,50,60,.42)'; c.lineWidth = 1;
    for (let i = -4; i <= 8; i++) { const x = ox + i * 0.25 * s, y = oy + i * 0.25 * s; c.beginPath(); c.moveTo(x, fcy - fr); c.lineTo(x, fcy + fr); c.stroke(); c.beginPath(); c.moveTo(fcx - fr, y); c.lineTo(fcx + fr, y); c.stroke(); }
    c.strokeStyle = 'rgba(30,40,50,.6)'; c.lineWidth = 1.1;
    for (const k of [-1, 0, 1, 2]) for (const d of [-0.012, 0, 0.012]) {
      const x = ox + (k + d) * s, y = oy + (k + d) * s;
      c.beginPath(); c.moveTo(x, fcy - fr); c.lineTo(x, fcy + fr); c.stroke(); c.beginPath(); c.moveTo(fcx - fr, y); c.lineTo(fcx + fr, y); c.stroke();
    }
    // підсвітка меж поточного квадрата: зелені — рахують, червоні — ні
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(30,142,78,.75)'; c.beginPath(); c.moveTo(ox, oy + s); c.lineTo(ox, oy); c.lineTo(ox + s, oy); c.stroke();
    c.strokeStyle = 'rgba(192,57,43,.7)'; c.beginPath(); c.moveTo(ox + s, oy); c.lineTo(ox + s, oy + s); c.lineTo(ox, oy + s); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(ox, oy, s, s);
    c.restore();
  }
  function drawCell(c, x, y, cell, s) {
    const rx = cell.rx * s, ry = cell.ry * s, R = rng(cell.seed);
    c.save(); c.translate(x, y); c.rotate(cell.rot);
    if (cell.ghost) {
      c.strokeStyle = 'rgba(120,120,100,.28)'; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.stroke(); c.setLineDash([]);
      c.restore(); return;
    }
    // клітинна стінка (світлозаломлення: темний контур + світлий внутрішній ореол)
    const g = c.createRadialGradient(-rx * 0.3, -ry * 0.35, 1, 0, 0, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(248,246,232,.55)'); g.addColorStop(0.75, 'rgba(226,222,196,.55)'); g.addColorStop(1, 'rgba(170,160,120,.7)');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(70,64,40,.75)'; c.lineWidth = 1.3; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(-0.6, -0.6, rx - 1.6, ry - 1.6, 0, Math.PI * 1.05, Math.PI * 1.65); c.stroke();
    // зібраний протопласт (кислота фіксує цитоплазму) і ядро
    c.fillStyle = 'rgba(176,160,110,.35)'; c.beginPath(); c.ellipse(rx * 0.05, 0, rx * 0.72, ry * 0.68, 0, 0, TAU); c.fill();
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(120,108,70,.35)'; c.beginPath(); c.arc((R() - 0.5) * rx, (R() - 0.5) * ry, 0.8 + R() * 1.2, 0, TAU); c.fill(); }
    const nr = Math.min(rx, ry) * 0.28;
    const ng = c.createRadialGradient(-nr * 0.3, -nr * 0.3, 0.3, 0, 0, nr);
    ng.addColorStop(0, 'rgba(150,130,90,.9)'); ng.addColorStop(1, 'rgba(90,74,44,.9)');
    c.fillStyle = ng; c.beginPath(); c.arc((R() - 0.5) * rx * 0.5, (R() - 0.5) * ry * 0.4, nr, 0, TAU); c.fill();
    c.restore();
  }
  function drawPrep(ctx, x0, y0, w, h, T, dpr) {
    const p = st.prepared ? 1 : st.prep;
    // стіл
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#E9EEE9'); g.addColorStop(1, '#C7CFC8');
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    K.applyGrain(ctx, x0, y0, w, h, 0.04);
    // пробірки з мацератом (3 наважки)
    const tw = Math.min(w * 0.085, 34), th = Math.min(h * 0.42, tw * 4.4), ty = y0 + 46;
    const macT = smooth(0, 0.35, p), shake = p > 0.35 && p < 0.5 ? Math.sin(p * 220) * 0.12 : 0;
    for (let i = 0; i < 3; i++) {
      const tx = x0 + w * 0.08 + i * tw * 1.6;
      ctx.save(); ctx.translate(tx + tw / 2, ty + th); ctx.rotate(shake * (i % 2 ? 1 : -1)); ctx.translate(-tx - tw / 2, -ty - th);
      K.tube(ctx, tx, ty, tw, th, { medium: { level: 0.42, color: st.mix === 'cr' ? '#E9B46A' : '#F2EEDC', gel: false, cloudy: 0.2 + 0.7 * macT * T.M }, plug: null, contents: (c, inn) => {
        // шматочки тканини розпадаються
        const R = rng(i + 3), n = 5;
        for (let k = 0; k < n; k++) { const s = (1 - macT * T.M) * inn.w * 0.28; if (s < 1) continue; c.fillStyle = 'rgba(232,222,180,.95)'; c.beginPath(); c.ellipse(inn.x + inn.w * (0.25 + R() * 0.5), inn.y + inn.h - 6 - R() * inn.h * 0.25, s, s * 0.7, R(), 0, TAU); c.fill(); }
      } });
      ctx.restore();
    }
    tag(ctx, x0 + w * 0.08 + tw * 2.1, ty + th + 18, `мацерація: ${fnum(macT * st.hours, 1)} год`, { size: 11 });
    // лічильна камера (2.5D): товсте скло з двома сітками й покривним скельцем
    const cx = x0 + w * 0.52, cy = y0 + h * (h > 300 ? 0.72 : 0.62), cw = Math.min(w * 0.86, 330), ch = cw * 0.34;
    const sx = cx - cw / 2, sy = cy - ch / 2;
    K.shadow(ctx, cx + 6, cy + ch * 0.55, cw * 0.55, ch * 0.18, 0.3);
    const sg = ctx.createLinearGradient(sx, sy, sx, sy + ch); sg.addColorStop(0, 'rgba(235,245,242,.9)'); sg.addColorStop(1, 'rgba(190,210,205,.9)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(sx + ch * 0.25, sy); ctx.lineTo(sx + cw + ch * 0.25, sy); ctx.lineTo(sx + cw, sy + ch); ctx.lineTo(sx, sy + ch); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,110,100,.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(120,150,140,.55)'; ctx.fillRect(sx, sy + ch, cw, 5); // торець
    ctx.fillStyle = 'rgba(40,60,80,.25)'; ctx.font = `600 ${Math.max(8, ch * 0.13)}px system-ui`; ctx.textAlign = 'left';
    ctx.fillText('FUCHS-ROSENTHAL  0,200 mm', sx + ch * 0.25 + 6, sy + ch * 0.2);
    // канавки й лічильна площадка з сіткою
    const gx = cx - cw * 0.12, gy = cy - ch * 0.08, gw = cw * 0.3, gh = ch * 0.5;
    ctx.fillStyle = 'rgba(160,190,200,.55)'; ctx.beginPath(); ctx.moveTo(gx + gh * 0.25, gy); ctx.lineTo(gx + gw + gh * 0.25, gy); ctx.lineTo(gx + gw, gy + gh); ctx.lineTo(gx, gy + gh); ctx.closePath(); ctx.fill();
    // сітка 4×4 із підсвіткою діагоналі
    const P = (u, v) => [gx + u * gw + (1 - v) * gh * 0.25, gy + v * gh];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const a = P(i / 4, j / 4), b = P((i + 1) / 4, j / 4), c = P((i + 1) / 4, (j + 1) / 4), d = P(i / 4, (j + 1) / 4);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
      const diag = i === j, cur = diag && i === st.sq - 1;
      ctx.fillStyle = cur ? 'rgba(230,180,40,.85)' : diag ? 'rgba(46,125,91,.45)' : 'rgba(255,255,255,.12)'; ctx.fill();
      ctx.strokeStyle = 'rgba(30,50,60,.55)'; ctx.lineWidth = 0.7; ctx.stroke();
    }
    // покривне скельце: насувається й притирається; кільця Ньютона
    const cs = smooth(0.55, 0.8, p), cxs = lerp(cx + cw * 0.7, cx - cw * 0.02, cs);
    if (cs > 0) {
      const kw = cw * 0.44, kh = ch * 0.78, kx = cxs - kw / 2, ky = cy - kh / 2 - ch * 0.04;
      ctx.fillStyle = 'rgba(225,242,250,.45)'; ctx.beginPath(); ctx.moveTo(kx + kh * 0.25, ky); ctx.lineTo(kx + kw + kh * 0.25, ky); ctx.lineTo(kx + kw, ky + kh); ctx.lineTo(kx, ky + kh); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.strokeStyle = 'rgba(60,90,100,.35)'; ctx.lineWidth = 0.8; ctx.stroke();
      if (st.newton && p > 0.8) {
        // інтерференційні кільця на опорах (райдужні смуги)
        const ra = smooth(0.8, 0.9, p);
        for (const ex of [kx + kh * 0.12 + 7, kx + kw + kh * 0.12 - 7]) for (let k = 0; k < 4; k++) {
          ctx.strokeStyle = `hsla(${(k * 70 + 10) % 360},75%,58%,${0.42 * ra})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(ex, ky + kh * 0.5, 1.5 + k * 1.4, kh * (0.12 + k * 0.07), -0.25, 0, TAU); ctx.stroke();
        }
      }
    }
    // крапля з піпетки
    if (p > 0.45 && p < 0.62) {
      const dp = smooth(0.45, 0.58, p), px = cx + cw * 0.18, py = lerp(y0 + 10, cy - ch * 0.1, dp);
      ctx.strokeStyle = 'rgba(80,110,100,.7)'; ctx.fillStyle = 'rgba(230,240,240,.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px - 3, y0); ctx.lineTo(px - 3, py - 14); ctx.lineTo(px, py - 4); ctx.lineTo(px + 3, py - 14); ctx.lineTo(px + 3, y0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(233,180,106,.85)'; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
    }
    tag(ctx, cx, cy + ch * 0.5 + 24, st.newton ? 'Камера Фукса — Розенталя · глибина 0,2 мм' : 'Скельце не притерто: глибина > 0,2 мм', { size: 11, color: st.newton ? '#173322' : '#9A2A1A' });
    const steps = ['1. мацерація', '2. струшування', '3. крапля в камеру', '4. покривне скельце', '5. підрахунок'];
    const si = st.prepared ? 4 : p < 0.35 ? 0 : p < 0.45 ? 1 : p < 0.6 ? 2 : p < 0.85 ? 3 : 4;
    if (st.prep > 0 || st.prepared) tag(ctx, x0 + w - 10, ty + 16, `Крок ${steps[si]}`, { size: 11.5, dark: true, align: 'right' });
    ctx.restore();
  }

  // ---- взаємодія: торкання клітин
  cv.addEventListener('pointerdown', (e) => {
    if (!G || !st.prepared) return;
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (Math.hypot(px - G.fcx, py - G.fcy) > G.fr) return;
    const S = square(); let best = null, bd = 1e9;
    for (const c of S.cells) { if (c.ghost) continue; const d = Math.hypot(G.ox + c.x * G.scale - px, G.oy + c.y * G.scale - py) - Math.max(c.rx, c.ry) * G.scale; if (d < bd) { bd = d; best = c; } }
    if (!best || bd > 8) return;
    const k = key(); const set = marks.get(k) || new Set(); set.has(best.id) ? set.delete(best.id) : set.add(best.id); marks.set(k, set);
    refresh();
  });

  function refresh() { updateReads(); updatePlot(); draw(); }
  function invalidate() {
    // нова наважка / режим мацерації = нова суспензія: камеру треба заповнити знову
    marks.clear(); st.show = false;
    if (st.prepared) { st.prepared = false; st.prep = 0; runner.reset(); $('t3b-status').textContent = 'Умови змінено — приготуйте нову суспензію: натисніть «Запустити».'; }
    refresh();
  }
  const runner = new K.Runner({
    btn: $('t3b-run'), reset: $('t3b-reset'), status: $('t3b-status'),
    step: (dt, T, reset) => {
      if (reset) { st.prep = 0; st.prepared = false; marks.clear(); st.show = false; updateReads(); updatePlot(); return; }
      st.prep = Math.min(1, st.prep + dt / 9);
      if (st.prep >= 1) { st.prepared = true; runner.finish(); $('t3b-status').textContent = 'Камеру заповнено — рахуйте клітини, торкаючись їх у полі зору.'; updateReads(); updatePlot(); }
      else $('t3b-status').textContent = 'Підготовка препарату…';
    },
    draw,
    labels: { again: '↻ Нова суспензія' },
  });
  refresh();
  $('t3b-status').textContent = 'Натисніть «Запустити», щоб мацерувати тканину й заповнити камеру.';
  K.onResize(cv.parentElement, draw);
}

function init() {
  const tb = document.getElementById('t3-tabs'); if (tb) tabs(tb);
  const A = modelA();
  modelB(A ? A.getSample : (cult, med, day) => { const sim = simulate(params(CULT[cult], MED[med - 1], 100, 25), 56); return { mc: at(sim, 'mc', day), W: at(sim, 'W', day) }; });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
