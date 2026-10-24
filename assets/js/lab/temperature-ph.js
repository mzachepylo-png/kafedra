// ЛР 2. Температура (Арреніус + теплова інактивація) і pH (дипротонна модель активного центру).
import { Plot, sample, linspace } from './plot.js';
import { sliders, segmented, setOut, num, sig, downloadCSV, rng, hashSeed, renderTable, check } from './ui.js';

const COL = { main: '#1B5E20', ref: '#B08A1E', teal: '#00695C', berry: '#8E3B5B' };
const R = 8.314e-3; // кДж/(моль·К)
const K0 = 273.15;
const $ = (id) => document.getElementById(id);

// ---------- Температура ----------
const kcat = (T, Ea) => Math.exp(-Ea / R * (1 / (T + K0) - 1 / (25 + K0)));
const kd = (T, Ed, Td) => Math.LN2 / 10 * Math.exp(-Ed / R * (1 / (T + K0) - 1 / (Td + K0)));
const avgAct = (T, p) => {
  const x = kd(T, p.ed, p.td) * p.tau;
  return kcat(T, p.ea) * (x < 1e-9 ? 1 : (1 - Math.exp(-x)) / x);
};

const T_PRESETS = {
  meso: { ea: 50, ed: 300, td: 50 },
  perox: { ea: 35, ed: 280, td: 72 },
  cold: { ea: 40, ed: 220, td: 38 },
};

const tSl = sliders($('tp-t'), [
  { id: 'ea', label: 'E<sub>a</sub> каталізу', min: 10, max: 100, step: 1, value: 50, unit: 'кДж/моль' },
  { id: 'ed', label: 'E<sub>d</sub> денатурації', min: 120, max: 500, step: 5, value: 300, unit: 'кДж/моль' },
  { id: 'td', label: 'T<sub>d</sub> (t<sub>½</sub> = 10 хв)', min: 30, max: 90, step: 1, value: 50, unit: '°C' },
  { id: 'tau', label: 'Тривалість досліду τ', min: 1, max: 60, step: 1, value: 10, unit: 'хв' },
], updateT);

segmented($('tp-preset'), 'tpreset', [
  { value: 'meso', label: 'Мезофільний' },
  { value: 'perox', label: 'Пероксидаза хрону' },
  { value: 'cold', label: 'Холодостійкий' },
], 'meso', (v) => {
  const p = T_PRESETS[v];
  tSl.set('ea', p.ea, true); tSl.set('ed', p.ed, true); tSl.set('td', p.td, true);
  updateT();
});

const plotT = new Plot($('tp-plot-t'), { xLabel: 'T, °C', yLabel: 'Активність, % від макс.', xShort: 'T', x: [0, 95], y: [0, 105], aspect: 1.3 });
const plotA = new Plot($('tp-plot-arr'), { xLabel: '1000/T, К⁻¹', yLabel: 'ln(v / v₂₅)', xShort: '1000/T', y: 'auto', yZero: false, aspect: 1.3 });

function updateT() {
  const p = tSl.values;
  const Ts = linspace(0, 95, 381);
  const act = Ts.map((T) => avgAct(T, p));
  let iMax = 0;
  act.forEach((a, i) => { if (a > act[iMax]) iMax = i; });
  const aMax = act[iMax], tOpt = Ts[iMax];
  const pure = Ts.map((T) => kcat(T, p.ea));
  const alive = Ts.map((T) => 100 * Math.exp(-kd(T, p.ed, p.td) * p.tau));
  plotT.set([
    { data: Ts.map((T, i) => [T, Math.min(pure[i] / aMax * 100, 400)]), color: COL.ref, dash: [7, 6], width: 2, label: 'лише Арреніус (без інактивації)' },
    { data: alive.map((a, i) => [Ts[i], a]), color: COL.teal, width: 1.8, dash: [2, 4], label: 'активний фермент після τ, %' },
    { data: Ts.map((T, i) => [T, act[i] / aMax * 100]), color: COL.main, label: 'виміряна активність', fill: 'rgba(46,125,50,.08)', marker: [tOpt, 100] },
  ], [{ x: tOpt, label: `Tопт ≈ ${num(tOpt, 1)} °C`, color: COL.ref }]);

  const arr = Ts.filter((T) => T >= 5).map((T) => [1000 / (T + K0), Math.log(avgAct(T, p))]);
  plotA.setOptions({ x: [1000 / (95 + K0), 1000 / (5 + K0)] });
  plotA.set([
    { data: Ts.filter((T) => T >= 5).map((T) => [1000 / (T + K0), Math.log(kcat(T, p.ea))]).reverse(), color: COL.ref, dash: [7, 6], width: 2, label: 'нахил = −Ea/R' },
    { data: arr.reverse(), color: COL.main, label: 'ln v (з інактивацією)' },
  ]);

  const kdOpt = kd(tOpt, p.ed, p.td);
  const half = Math.LN2 / kdOpt;
  setOut(document, {
    topt: num(tOpt, 1) + ' °C',
    q10: num(kcat(30, p.ea) / kcat(20, p.ea), 2),
    half: half > 1e4 ? '> 10⁴ хв' : sig(half, 3) + ' хв',
    alive: num(100 * Math.exp(-kdOpt * p.tau), 0) + ' %',
  });
}
updateT();

// ---------- pH ----------
const phAct = (pH, k1, k2) => 1 / (1 + Math.pow(10, k1 - pH) + Math.pow(10, pH - k2));
const PH_PRESETS = {
  amyl: { k1: 3.6, k2: 6.6 },
  acp: { k1: 4.0, k2: 6.2 },
  perox: { k1: 4.6, k2: 8.2 },
  papain: { k1: 4.2, k2: 8.4 },
};
const phSl = sliders($('ph-c'), [
  { id: 'k1', label: 'pK<sub>1</sub> (кисла група)', min: 1, max: 10, step: 0.1, value: 4.6 },
  { id: 'k2', label: 'pK<sub>2</sub> (основна група)', min: 3, max: 13, step: 0.1, value: 8.2 },
], updatePH);
segmented($('ph-preset'), 'phpreset', [
  { value: 'amyl', label: 'β-Амілаза' },
  { value: 'acp', label: 'Кисла фосфатаза' },
  { value: 'perox', label: 'Пероксидаза' },
  { value: 'papain', label: 'Папаїн' },
], 'perox', (v) => {
  phSl.set('k1', PH_PRESETS[v].k1, true); phSl.set('k2', PH_PRESETS[v].k2, true); updatePH();
});

const plotPH = new Plot($('ph-plot'), { xLabel: 'pH', yLabel: 'Активність, % від макс.', xShort: 'pH', x: [0, 14], y: [0, 105], aspect: 1.3 });
const plotF = new Plot($('ph-plot-f'), { xLabel: 'pH', yLabel: 'Частка, %', xShort: 'pH', x: [0, 14], y: [0, 102], aspect: 1.3 });

function updatePH() {
  let { k1, k2 } = phSl.values;
  const pHs = linspace(0, 14, 561);
  const act = pHs.map((x) => phAct(x, k1, k2));
  const aMax = Math.max(...act);
  const opt = (k1 + k2) / 2;
  const above = pHs.filter((x, i) => act[i] >= aMax / 2);
  plotPH.set([
    { data: pHs.map((x, i) => [x, act[i] / aMax * 100]), color: COL.main, label: 'активність', fill: 'rgba(46,125,50,.08)', marker: [opt, 100] },
  ], [
    { x: opt, label: `pHопт = ${num(opt, 2)}`, color: COL.ref },
    { x: k1, color: '#9FB3A3', dash: [2, 4], label: 'pK₁' },
    { x: k2, color: '#9FB3A3', dash: [2, 4], label: 'pK₂' },
  ]);
  const frac = (x) => {
    const h = Math.pow(10, -x), K1 = Math.pow(10, -k1), K2 = Math.pow(10, -k2);
    const d = h * h + h * K1 + K1 * K2;
    return [h * h / d, h * K1 / d, K1 * K2 / d];
  };
  const F = pHs.map(frac);
  plotF.set([
    { data: pHs.map((x, i) => [x, F[i][0] * 100]), color: COL.berry, label: 'EH₂⁺ (неактивна)' },
    { data: pHs.map((x, i) => [x, F[i][1] * 100]), color: COL.main, label: 'EH (активна)' },
    { data: pHs.map((x, i) => [x, F[i][2] * 100]), color: COL.teal, label: 'E⁻ (неактивна)' },
  ]);
  setOut(document, {
    phopt: num(opt, 2),
    ehmax: num(aMax * 100, 1) + ' %',
    phrange: above.length ? `${num(above[0], 1)} – ${num(above[above.length - 1], 1)}` : '—',
  });
}
updatePH();

// ---------- Віртуальний експеримент ----------
const T_SERIES = linspace(5, 80, 16);
const PH_SERIES = linspace(3, 10, 15);
let exp = null;
const pExpT = new Plot($('tp-exp-t'), { xLabel: 'T, °C', yLabel: 'v, мкмоль/(хв·мг)', xShort: 'T', x: [0, 85], aspect: 1.35 });
const pExpP = new Plot($('tp-exp-ph'), { xLabel: 'pH', yLabel: 'v, мкмоль/(хв·мг)', xShort: 'pH', x: [2.5, 10.5], aspect: 1.35 });

function makeVariant(str) {
  const r = rng(hashSeed(str) ^ 0x51ed27);
  const p = { ea: Math.round(r.range(30, 75)), ed: Math.round(r.range(220, 380) / 5) * 5, td: Math.round(r.range(45, 70)), tau: 10 };
  const a25 = r.range(15, 40);
  const k1 = Math.round(r.range(3.5, 6) * 10) / 10;
  const k2 = Math.round((k1 + r.range(2.5, 4.5)) * 10) / 10;
  const noise = rng(hashSeed(str) ^ 0x2545f491);
  const meas = (v) => +(v * (1 + 0.03 * noise.normal())).toFixed(2);
  const ref25 = avgAct(25, p);
  const phRef = phAct(7, k1, k2);
  const tData = T_SERIES.map((T) => ({ T, v: meas(a25 * avgAct(T, p) / ref25 * phAct(7, k1, k2) / phRef) }));
  const pData = PH_SERIES.map((pH) => ({ pH, v: meas(a25 * phAct(pH, k1, k2) / phRef) }));
  // еталони
  const grid = linspace(0, 90, 901);
  let tOpt = 0, best = -1;
  grid.forEach((T) => { const a = avgAct(T, p); if (a > best) { best = a; tOpt = T; } });
  return { p, k1, k2, tData, pData, tOpt, q10: avgAct(20, p) / avgAct(10, p), phOpt: (k1 + k2) / 2 };
}

$('tp-run').addEventListener('click', () => {
  const str = $('tp-variant').value.trim();
  if (!str) { $('tp-variant').focus(); $('tp-variant').placeholder = 'Спершу введіть варіант'; return; }
  exp = makeVariant(str);
  $('tp-exp').hidden = false;
  $('tp-cond').innerHTML = `
    <div class="readout"><div class="readout__label">Варіант</div><div class="readout__value">${str.replace(/[<>&]/g, '')}</div></div>
    <div class="readout readout--gold"><div class="readout__label">Час інкубації</div><div class="readout__value">${exp.p.tau} хв</div></div>
    <div class="readout"><div class="readout__label">Похибка вимірювань</div><div class="readout__value">≈ 3 %</div></div>`;
  pExpT.set([{ data: exp.tData.map((d) => [d.T, d.v]), type: 'points', color: COL.main, label: 'v' }]);
  pExpP.set([{ data: exp.pData.map((d) => [d.pH, d.v]), type: 'points', color: COL.teal, label: 'v' }]);
  renderTable($('tp-table-t'), ['T, °C', '1/T, К⁻¹', 'v', 'ln v'],
    exp.tData.map((d) => [num(d.T, 0), num(1 / (d.T + K0), 6), num(d.v, 2), num(Math.log(d.v), 3)]));
  renderTable($('tp-table-ph'), ['pH', 'v, мкмоль/(хв·мг)'], exp.pData.map((d) => [num(d.pH, 1), num(d.v, 2)]));
  $('tp-verdict').textContent = ''; $('tp-verdict').className = 'verdict';
  ['b-ea', 'b-q10', 'b-topt', 'b-ph'].forEach((id) => $(id).classList.remove('ok', 'bad'));
});

$('tp-csv').addEventListener('click', () => {
  if (!exp) return;
  const rows = exp.tData.map((d, i) => [d.T, 1 / (d.T + K0), d.v, Math.log(d.v), exp.pData[i] ? exp.pData[i].pH : '', exp.pData[i] ? exp.pData[i].v : '']);
  downloadCSV(`eksperyment-LR2-${$('tp-variant').value.trim() || 'variant'}.csv`, ['T, °C', '1/T, 1/K', 'v (T)', 'ln v', 'pH', 'v (pH)'], rows);
});

function checkAbs(answer, truth, tol) {
  const a = parseFloat(String(answer).replace(',', '.'));
  if (!isFinite(a)) return { ok: false, empty: String(answer).trim() === '' };
  return { ok: Math.abs(a - truth) <= tol, diff: a - truth };
}

$('tp-check').addEventListener('click', () => {
  if (!exp) return;
  const res = [
    ['b-ea', 'E<sub>a</sub>', check($('b-ea').value, exp.p.ea, 0.2), (r) => `відхилення ${num(r.err * 100, 0)} %`],
    ['b-q10', 'Q<sub>10</sub>', check($('b-q10').value, exp.q10, 0.12), (r) => `відхилення ${num(r.err * 100, 0)} %`],
    ['b-topt', 'T<sub>опт</sub>', checkAbs($('b-topt').value, exp.tOpt, 5), (r) => `різниця ${num(Math.abs(r.diff), 1)} °C`],
    ['b-ph', 'pH<sub>опт</sub>', checkAbs($('b-ph').value, exp.phOpt, 0.5), (r) => `різниця ${num(Math.abs(r.diff), 2)}`],
  ];
  const lines = res.map(([id, name, r, msg]) => {
    $(id).classList.toggle('ok', r.ok);
    $(id).classList.toggle('bad', !r.ok && !r.empty);
    return `${name}: ${r.empty ? 'не введено' : r.ok ? 'в межах допуску' : msg(r)}`;
  });
  const all = res.every((r) => r[2].ok);
  const v = $('tp-verdict');
  v.className = 'verdict ' + (all ? 'verdict--ok' : 'verdict--bad');
  v.innerHTML = `<b>${all ? 'Чудово! Усі результати в межах допуску.' : 'Є неточності — перевірте розрахунки.'}</b><br>${lines.join('<br>')}` +
    `<details style="margin-top:8px"><summary>Показати еталонні значення</summary>E<sub>a</sub> = ${exp.p.ea} кДж/моль, Q<sub>10</sub> = ${num(exp.q10, 2)}, ` +
    `T<sub>опт</sub> ≈ ${num(exp.tOpt, 1)} °C (за τ = ${exp.p.tau} хв), pK<sub>1</sub> = ${num(exp.k1, 1)}, pK<sub>2</sub> = ${num(exp.k2, 1)}, pH<sub>опт</sub> = ${num(exp.phOpt, 2)}.</details>`;
});
