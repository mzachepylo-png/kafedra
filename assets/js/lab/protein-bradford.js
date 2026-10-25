// ЛР 4. Визначення білка за Бредфорд: калібрувальна крива, межі лінійності, перерахунок на тканину.
import { Plot, linspace } from './plot.js';
import { sliders, setOut, num, downloadCSV, rng, hashSeed, renderTable, check } from './ui.js';
import { linreg } from './fit.js';

const COL = { main: '#1B5E20', ref: '#B08A1E', teal: '#00695C', berry: '#8E3B5B' };
const $ = (id) => document.getElementById(id);

// справжня відповідь барвника (рівняння 3)
const A_MAX = 3.2, K_S = 5;
const resp = (c) => A_MAX * c / (K_S + c);

// ---------- Модель ----------
const cal = sliders($('bf-cal'), [
  { id: 'cmax', label: 'Найбільший стандарт', min: 0.25, max: 2.5, step: 0.05, value: 1, unit: 'мг/мл' },
], update);
const smp = sliders($('bf-sample'), [
  { id: 'c', label: 'Справжня концентрація проби', min: 0.02, max: 2.5, step: 0.01, value: 0.4, unit: 'мг/мл' },
], update);

const plot = new Plot($('bf-plot'), { xLabel: 'Концентрація білка, мг/мл', yLabel: 'A₅₉₅', xShort: 'c', x: [0, 2.5], y: [0, 1.4], aspect: 1.9 });

function update() {
  const { cmax } = cal.values, { c } = smp.values;
  const stds = linspace(0, cmax, 6);
  const fit = linreg(stds, stds.map(resp));
  const a = resp(c);
  const cfit = (a - fit.a) / fit.b;
  const err = (cfit - c) / c * 100;
  const inRange = c <= cmax;
  plot.set([
    { data: linspace(0, 2.5, 251).map((x) => [x, resp(x)]), color: COL.main, label: 'справжня залежність' },
    { data: [[0, fit.a], [2.5, fit.a + fit.b * 2.5]], color: COL.ref, dash: [7, 6], width: 2, label: 'калібрувальна пряма' },
    { data: stds.map((x) => [x, resp(x)]), type: 'points', color: COL.teal, label: 'стандарти' },
    { data: [[c, a]], type: 'points', color: COL.berry, r: 6, label: 'проба' },
  ], [{ x: cfit, label: `c за прямою = ${num(cfit, 3)}`, color: COL.berry, dash: [2, 4] }, { x: cmax, color: '#9FB3A3', dash: [2, 4], label: inRange ? '' : 'поза калібруванням' }]);
  setOut(document, {
    a: num(a, 3),
    eq: `A = ${num(fit.a, 3)} + ${num(fit.b, 3)}·c`,
    cfit: num(cfit, 3) + ' мг/мл',
    err: (err >= 0 ? '+' : '') + num(err, 1) + ' %' + (inRange ? '' : ' (екстраполяція)'),
  });
}
update();

// ---------- Віртуальний експеримент ----------
const STD = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0];
let exp = null;
const pExp = new Plot($('bf-exp-plot'), { xLabel: 'c(БСА), мг/мл', yLabel: 'A₅₉₅', xShort: 'c', x: [0, 1.05], aspect: 1.35 });

function makeVariant(str) {
  const r = rng(hashSeed(str) ^ 0x6b1d33);
  const noise = rng(hashSeed(str) ^ 0x19e4c7);
  const m = Math.round(r.range(0.4, 1.0) * 100) / 100;
  const V = r.pick([5, 10]);
  const W = r.range(8, 24); // мг/г
  const cExt = W * m / V;
  const d = [2, 5, 10, 20, 25, 50].find((x) => cExt / x <= 0.75);
  const cAssay = cExt / d;
  const blankShift = r.range(-0.01, 0.015);
  const stds = STD.map((c) => ({ c, A: +(resp(c) + blankShift + 0.006 * noise.normal()).toFixed(3) }));
  const reps = [0, 1, 2].map(() => +(resp(cAssay) + blankShift + 0.01 * noise.normal()).toFixed(3));
  // еталон — як рахує студент: МНК за стандартами, середнє паралельних проб
  const fit = linreg(stds.map((s) => s.c), stds.map((s) => s.A));
  const aMean = reps.reduce((s, x) => s + x, 0) / reps.length;
  const cCalc = (aMean - fit.a) / fit.b;
  return { m, V, d, stds, reps, fit, aMean, cCalc, wCalc: cCalc * d * V / m };
}

$('bf-run').addEventListener('click', () => {
  const str = $('bf-variant').value.trim();
  if (!str) { $('bf-variant').focus(); $('bf-variant').placeholder = 'Спершу введіть варіант'; return; }
  exp = makeVariant(str);
  $('bf-exp').hidden = false;
  $('bf-cond').innerHTML = `
    <div class="readout"><div class="readout__label">Варіант</div><div class="readout__value">${str.replace(/[<>&]/g, '')}</div></div>
    <div class="readout readout--gold"><div class="readout__label">Наважка листків</div><div class="readout__value">${num(exp.m, 2)} г</div></div>
    <div class="readout"><div class="readout__label">Об'єм екстракту</div><div class="readout__value">${exp.V} мл</div></div>
    <div class="readout"><div class="readout__label">Розведення екстракту</div><div class="readout__value">у ${exp.d} разів</div></div>`;
  pExp.set([{ data: exp.stds.map((s) => [s.c, s.A]), type: 'points', color: COL.main, label: 'A₅₉₅ стандартів' }]);
  renderTable($('bf-table'), ['c(БСА), мг/мл', 'A₅₉₅'], exp.stds.map((s) => [num(s.c, 1), num(s.A, 3)]));
  renderTable($('bf-table-s'), ['Розведений екстракт', 'A₅₉₅'], exp.reps.map((a, i) => [`повторність ${i + 1}`, num(a, 3)]));
  $('bf-verdict').textContent = ''; $('bf-verdict').className = 'verdict';
  ['bf-b', 'bf-c', 'bf-w'].forEach((id) => $(id).classList.remove('ok', 'bad'));
});

$('bf-csv').addEventListener('click', () => {
  if (!exp) return;
  const rows = exp.stds.map((s, i) => [s.c, s.A, exp.reps[i] !== undefined ? `повторність ${i + 1}` : '', exp.reps[i] ?? '']);
  downloadCSV(`bilok-LR4-${$('bf-variant').value.trim() || 'variant'}.csv`, ['c(БСА), мг/мл', 'A595 стандарту', 'Проба', 'A595 проби'], rows);
});

$('bf-check').addEventListener('click', () => {
  if (!exp) return;
  const res = [
    ['bf-b', 'Нахил b', check($('bf-b').value, exp.fit.b, 0.05)],
    ['bf-c', 'c у пробі', check($('bf-c').value, exp.cCalc, 0.06)],
    ['bf-w', 'Вміст білка', check($('bf-w').value, exp.wCalc, 0.06)],
  ];
  const lines = res.map(([id, name, r]) => {
    $(id).classList.toggle('ok', r.ok);
    $(id).classList.toggle('bad', !r.ok && !r.empty);
    return `${name}: ${r.empty ? 'не введено' : r.ok ? 'в межах допуску' : `відхилення ${num(r.err * 100, 0)} %`}`;
  });
  const all = res.every((r) => r[2].ok);
  const v = $('bf-verdict');
  v.className = 'verdict ' + (all ? 'verdict--ok' : 'verdict--bad');
  v.innerHTML = `<b>${all ? 'Чудово! Усі результати в межах допуску.' : 'Є неточності — перевірте розрахунки.'}</b><br>${lines.join('<br>')}` +
    `<details style="margin-top:8px"><summary>Показати еталонні значення</summary>A = ${num(exp.fit.a, 4)} + ${num(exp.fit.b, 4)}·c (R² = ${num(exp.fit.r2, 4)}); ` +
    `середнє A₅₉₅ проби = ${num(exp.aMean, 3)}; c = ${num(exp.cCalc, 3)} мг/мл; вміст білка = ${num(exp.wCalc, 1)} мг/г.</details>`;
});
