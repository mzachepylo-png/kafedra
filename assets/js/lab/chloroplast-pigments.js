// ЛР 5. Пігменти пластид: спектр суміші (закон Бера), рівняння Ліхтенталера, вміст у листку.
import { Plot, linspace } from './plot.js';
import { sliders, segmented, setOut, num, downloadCSV, rng, hashSeed, renderTable, check } from './ui.js';

const COL = { main: '#1B5E20', ref: '#B08A1E', teal: '#00695C', berry: '#8E3B5B', chla: '#2E7D32', chlb: '#7CB342', car: '#E09A1A' };
const $ = (id) => document.getElementById(id);

// Пряма задача, узгоджена з рівняннями Ліхтенталера (80 % ацетон), поглинання на 1 мкг/мл, 1 см
const COEF = {
  a663: 20.13 / 231.6, b663: 2.81 / 231.6,
  a646: 5.03 / 231.6, b646: 12.21 / 231.6,
  a470: 3.27 / 1000, b470: 104 / 1000, c470: 198 / 1000,
};
const forward = (ca, cb, cc) => ({
  a663: COEF.a663 * ca + COEF.b663 * cb,
  a646: COEF.a646 * ca + COEF.b646 * cb,
  a470: COEF.a470 * ca + COEF.b470 * cb + COEF.c470 * cc,
});
const lichtenthaler = (a470, a646, a663) => {
  const ca = 12.21 * a663 - 2.81 * a646;
  const cb = 20.13 * a646 - 5.03 * a663;
  return { ca, cb, cc: (1000 * a470 - 3.27 * ca - 104 * cb) / 198 };
};

// Форми спектрів (гаусові смуги), нормовані так, щоб у робочих точках збігатися з COEF
const g = (l, c, s) => Math.exp(-((l - c) ** 2) / (2 * s * s));
const rawA = (l) => g(l, 663, 10) + 0.14 * g(l, 618, 12) + 1.29 * g(l, 432, 12) + 0.7 * g(l, 410, 15) + 0.035 * g(l, 455, 25) + 0.05 * g(l, 580, 20);
const rawB = (l) => g(l, 646, 10) + 0.15 * g(l, 600, 14) + 3.3 * g(l, 457, 13) + 0.95 * g(l, 430, 12);
const rawC = (l) => g(l, 450, 12) + 0.85 * g(l, 478, 11) + 0.65 * g(l, 425, 12);
const kA = COEF.a663 / rawA(663), kB = COEF.b646 / rawB(646), kC = COEF.c470 / rawC(470);
const specA = (l) => kA * rawA(l), specB = (l) => kB * rawB(l), specC = (l) => kC * rawC(l);
const LAMBDA = linspace(400, 750, 351);

function swatch(spec) {
  const avg = (lo, hi) => {
    const xs = LAMBDA.filter((l) => l >= lo && l < hi);
    return xs.reduce((s, l) => s + Math.pow(10, -spec(l)), 0) / xs.length;
  };
  const toC = (t) => Math.round(255 * Math.pow(Math.min(1, t), 1 / 2.2));
  return `rgb(${toC(avg(590, 700))},${toC(avg(495, 580))},${toC(avg(420, 495))})`;
}

// ---------- Модель ----------
const PRESETS = { sun: { ca: 9, cb: 2.8, cc: 2.2 }, shade: { ca: 7, cb: 2.9, cc: 1.4 }, old: { ca: 3, cb: 1.1, cc: 1.6 } };
const sl = sliders($('cp-c'), [
  { id: 'ca', label: 'Хлорофіл a', min: 0, max: 15, step: 0.1, value: 9, unit: 'мкг/мл' },
  { id: 'cb', label: 'Хлорофіл b', min: 0, max: 8, step: 0.1, value: 2.8, unit: 'мкг/мл' },
  { id: 'cc', label: 'Каротиноїди', min: 0, max: 6, step: 0.1, value: 2.2, unit: 'мкг/мл' },
], update);
segmented($('cp-preset'), 'cppreset', [
  { value: 'sun', label: 'Світловий листок' }, { value: 'shade', label: 'Тіньовий листок' }, { value: 'old', label: 'Старіючий листок' },
], 'sun', (v) => { const p = PRESETS[v]; sl.set('ca', p.ca, true); sl.set('cb', p.cb, true); sl.set('cc', p.cc, true); update(); });

const plot = new Plot($('cp-plot'), { xLabel: 'Довжина хвилі, нм', yLabel: 'Оптична густина A', xShort: 'λ', x: [400, 750], aspect: 2 });

function update() {
  const { ca, cb, cc } = sl.values;
  const tot = (l) => ca * specA(l) + cb * specB(l) + cc * specC(l);
  plot.set([
    { data: LAMBDA.map((l) => [l, ca * specA(l)]), color: COL.chla, width: 1.5, dash: [5, 4], label: 'хлорофіл a' },
    { data: LAMBDA.map((l) => [l, cb * specB(l)]), color: COL.chlb, width: 1.5, dash: [5, 4], label: 'хлорофіл b' },
    { data: LAMBDA.map((l) => [l, cc * specC(l)]), color: COL.car, width: 1.5, dash: [5, 4], label: 'каротиноїди' },
    { data: LAMBDA.map((l) => [l, tot(l)]), color: '#183A22', label: 'витяжка', fill: 'rgba(46,125,50,.07)' },
  ], [[470, '470'], [646, ''], [663, '646 / 663']].map(([x, label]) => ({ x, color: '#9FB3A3', dash: [2, 4], label })));
  $('cp-swatch').style.background = swatch(tot);
  const A = forward(ca, cb, cc);
  setOut(document, {
    a470: num(A.a470, 3), a646: num(A.a646, 3), a663: num(A.a663, 3),
    ab: cb > 0 ? num(ca / cb, 2) : '—',
  });
}
update();

// ---------- Віртуальний експеримент ----------
let exp = null;
const pExp = new Plot($('cp-exp-plot'), { xLabel: 'λ, нм', yLabel: 'A', xShort: 'λ', x: [400, 750], aspect: 1.35 });

function makeVariant(str) {
  const r = rng(hashSeed(str) ^ 0x4c0a91);
  const noise = rng(hashSeed(str) ^ 0x0be7f3);
  const shade = r() < 0.45;
  const wa = shade ? r.range(1.0, 1.8) : r.range(1.4, 2.4);          // мг/г
  const ab = shade ? r.range(2.2, 2.8) : r.range(3.0, 3.6);
  const wb = wa / ab;
  const wc = (wa + wb) / r.range(4.5, 6.5);
  const m = Math.round(r.range(0.1, 0.3) * 100) / 100;
  const V = 25;
  let d = 1;
  const conc = (w) => w * 1000 * m / (V * d);
  if (forward(conc(wa), conc(wb), conc(wc)).a663 > 0.85) d = 2;
  const ca = conc(wa), cb = conc(wb), cc = conc(wc);
  const turb = r.range(0.004, 0.02);
  const A = forward(ca, cb, cc);
  const meas = (x) => +(x + turb + 0.002 * noise.normal()).toFixed(3);
  const read = { a470: meas(A.a470), a646: meas(A.a646), a663: meas(A.a663), a720: +(turb + 0.001 * noise.normal()).toFixed(3) };
  // еталон — розрахунок студента за виміряними значеннями
  const L = lichtenthaler(read.a470 - read.a720, read.a646 - read.a720, read.a663 - read.a720);
  const W = (c) => c * V * d / (1000 * m);
  return { shade, m, V, d, read, ca, cb, cc, turb, L, wa: W(L.ca), wb: W(L.cb), wc: W(L.cc), ab: L.ca / L.cb };
}

$('cp-run').addEventListener('click', () => {
  const str = $('cp-variant').value.trim();
  if (!str) { $('cp-variant').focus(); $('cp-variant').placeholder = 'Спершу введіть варіант'; return; }
  exp = makeVariant(str);
  $('cp-exp').hidden = false;
  $('cp-cond').innerHTML = `
    <div class="readout"><div class="readout__label">Варіант</div><div class="readout__value">${str.replace(/[<>&]/g, '')}</div></div>
    <div class="readout readout--gold"><div class="readout__label">Наважка листків</div><div class="readout__value">${num(exp.m, 2)} г</div></div>
    <div class="readout"><div class="readout__label">Об'єм витяжки</div><div class="readout__value">${exp.V} мл</div></div>
    <div class="readout"><div class="readout__label">Розведення</div><div class="readout__value">${exp.d === 1 ? 'без розведення' : `у ${exp.d} рази`}</div></div>`;
  const tot = (l) => exp.ca * specA(l) + exp.cb * specB(l) + exp.cc * specC(l) + exp.turb;
  pExp.set([{ data: LAMBDA.map((l) => [l, tot(l)]), color: '#183A22', label: 'A витяжки' }],
    [[470, '470'], [646, ''], [663, '646 / 663'], [720, '720']].map(([x, label]) => ({ x, color: '#9FB3A3', dash: [2, 4], label })));
  renderTable($('cp-table'), ['λ, нм', 'A'], [['470', num(exp.read.a470, 3)], ['646', num(exp.read.a646, 3)], ['663', num(exp.read.a663, 3)], ['720', num(exp.read.a720, 3)]]);
  $('cp-verdict').textContent = ''; $('cp-verdict').className = 'verdict';
  ['cp-wa', 'cp-wb', 'cp-wc', 'cp-ab'].forEach((id) => $(id).classList.remove('ok', 'bad'));
});

$('cp-csv').addEventListener('click', () => {
  if (!exp) return;
  downloadCSV(`pihmenty-LR5-${$('cp-variant').value.trim() || 'variant'}.csv`, ['λ, нм', 'A'],
    [[470, exp.read.a470], [646, exp.read.a646], [663, exp.read.a663], [720, exp.read.a720]]);
});

$('cp-check').addEventListener('click', () => {
  if (!exp) return;
  const res = [
    ['cp-wa', 'Хлорофіл a', check($('cp-wa').value, exp.wa, 0.06)],
    ['cp-wb', 'Хлорофіл b', check($('cp-wb').value, exp.wb, 0.08)],
    ['cp-wc', 'Каротиноїди', check($('cp-wc').value, exp.wc, 0.1)],
    ['cp-ab', 'Хл a / Хл b', check($('cp-ab').value, exp.ab, 0.06)],
  ];
  const lines = res.map(([id, name, r]) => {
    $(id).classList.toggle('ok', r.ok);
    $(id).classList.toggle('bad', !r.ok && !r.empty);
    return `${name}: ${r.empty ? 'не введено' : r.ok ? 'в межах допуску' : `відхилення ${num(r.err * 100, 0)} %`}`;
  });
  const all = res.every((r) => r[2].ok);
  const v = $('cp-verdict');
  v.className = 'verdict ' + (all ? 'verdict--ok' : 'verdict--bad');
  v.innerHTML = `<b>${all ? 'Чудово! Усі результати в межах допуску.' : 'Є неточності — перевірте розрахунки.'}</b><br>${lines.join('<br>')}` +
    `<details style="margin-top:8px"><summary>Показати еталонні значення</summary>C<sub>a</sub> = ${num(exp.L.ca, 2)}, C<sub>b</sub> = ${num(exp.L.cb, 2)}, C<sub>x+c</sub> = ${num(exp.L.cc, 2)} мкг/мл; ` +
    `вміст: хлорофіл a ${num(exp.wa, 2)}, хлорофіл b ${num(exp.wb, 2)}, каротиноїди ${num(exp.wc, 2)} мг/г; a/b = ${num(exp.ab, 2)} — ${exp.shade ? 'тіньовий' : 'світловий'} листок.</details>`;
});
