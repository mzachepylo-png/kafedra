// ЛР 7. Дихальний коефіцієнт: стехіометрія субстратів, бродіння, респірометр з КОН і без нього.
import { Plot, linspace } from './plot.js';
import { sliders, segmented, setOut, num, downloadCSV, rng, hashSeed, renderTable, check } from './ui.js';
import { linreg } from './fit.js';

const COL = { main: '#1B5E20', ref: '#B08A1E', teal: '#00695C', berry: '#8E3B5B' };
const $ = (id) => document.getElementById(id);

// ДК окремих субстратів (рівняння 2); «жири → цукри» — перетворення через гліоксилатний цикл
const SUB = [
  { id: 'carb', label: 'Вуглеводи', rq: 1.0 },
  { id: 'fat', label: 'Жири (окиснення)', rq: 0.7 },
  { id: 'conv', label: 'Жири → цукри', rq: 0.4 },
  { id: 'prot', label: 'Білки', rq: 0.8 },
  { id: 'acid', label: 'Органічні кислоти', rq: 1.33 },
];
const PRESETS = {
  wheat: { carb: 88, fat: 2, conv: 0, prot: 10, acid: 0, anaer: 0 },
  sunfl: { carb: 10, fat: 45, conv: 35, prot: 10, acid: 0, anaer: 0 },
  pea: { carb: 50, fat: 5, conv: 0, prot: 45, acid: 0, anaer: 0 },
  swell: { carb: 90, fat: 0, conv: 0, prot: 10, acid: 0, anaer: 35 },
  fruit: { carb: 30, fat: 0, conv: 0, prot: 0, acid: 70, anaer: 0 },
};

function rqOf(v) {
  const tot = SUB.reduce((s, x) => s + v[x.id], 0);
  if (tot <= 0) return NaN;
  const aer = SUB.reduce((s, x) => s + v[x.id] * x.rq, 0) / tot;
  return aer * (1 + v.anaer / 100);
}
function verdict(rq) {
  if (!isFinite(rq)) return '—';
  if (rq < 0.6) return 'перетворення жирів на цукри';
  if (rq < 0.76) return 'переважно жири';
  if (rq < 0.92) return 'білки й вуглеводи';
  if (rq <= 1.08) return 'переважно вуглеводи';
  return 'органічні кислоти або бродіння';
}

// ---------- Модель ----------
const sl = sliders($('rq-c'), [
  ...SUB.map((x) => ({ id: x.id, label: `${x.label} (ДК ${num(x.rq, 2)})`, min: 0, max: 100, step: 1, value: PRESETS.wheat[x.id], unit: '%' })),
  { id: 'anaer', label: 'Додатковий CO<sub>2</sub> бродіння', min: 0, max: 80, step: 1, value: 0, unit: '%', hint: 'Відсоток від CO₂ аеробного дихання' },
  { id: 'o2', label: 'Поглинання O<sub>2</sub>', min: 100, max: 1500, step: 10, value: 600, unit: 'мкл/год' },
], update);
segmented($('rq-preset'), 'rqpreset', [
  { value: 'wheat', label: 'Пшениця' }, { value: 'sunfl', label: 'Соняшник' }, { value: 'pea', label: 'Горох' },
  { value: 'swell', label: 'Набухання' }, { value: 'fruit', label: 'Соковитий плід' },
], 'wheat', (k) => { for (const [id, v] of Object.entries(PRESETS[k])) sl.set(id, v, true); update(); });

const plot = new Plot($('rq-plot'), { xLabel: 't, хв', yLabel: 'Зменшення об\'єму, мкл', xShort: 't', x: [0, 60], y: 'auto', yZero: true, aspect: 2 });

function update() {
  const v = sl.values;
  const rq = rqOf(v);
  const o2 = v.o2, co2 = o2 * rq;
  const ts = linspace(0, 60, 61);
  plot.set([
    { data: ts.map((t) => [t, o2 * t / 60]), color: COL.main, label: 'посудина з КОН: x₁ = O₂' },
    { data: ts.map((t) => [t, (o2 - co2) * t / 60]), color: COL.berry, label: 'посудина без КОН: x₂ = O₂ − CO₂' },
  ], [{ y: 0, color: '#C9D3CC' }]);
  setOut(document, {
    rq: num(rq, 2),
    o2: num(o2, 0) + ' мкл/год',
    co2: num(co2, 0) + ' мкл/год',
    what: verdict(rq),
  });
}
update();

// ---------- Віртуальний експеримент ----------
const T = [0, 10, 20, 30, 40, 50, 60];
const KINDS = [
  { key: 'fat', seed: 'соняшник, 3-тя доба проростання', rq: [0.55, 0.72] },
  { key: 'fat', seed: 'ріпак, 3-тя доба проростання', rq: [0.55, 0.72] },
  { key: 'prot', seed: 'горох, 3-тя доба проростання', rq: [0.8, 0.86] },
  { key: 'carb', seed: 'пшениця, 3-тя доба проростання', rq: [0.96, 1.03] },
  { key: 'carb', seed: 'кукурудза, 3-тя доба проростання', rq: [0.96, 1.03] },
  { key: 'anaer', seed: 'пшениця, 6 год набухання', rq: [1.2, 1.45] },
];
let exp = null;
const pExp = new Plot($('rq-exp-plot'), { xLabel: 't, хв', yLabel: 'мкл', xShort: 't', x: [0, 62], aspect: 1.3 });

function makeVariant(str) {
  const r = rng(hashSeed(str) ^ 0x2d4f9b);
  const noise = rng(hashSeed(str) ^ 0x0f1e2d);
  const kind = r.pick(KINDS);
  const rq = r.range(...kind.rq);
  const m = Math.round(r.range(0.5, 1.5) * 100) / 100;
  const id = kind.key === 'anaer' ? r.range(120, 350) : r.range(450, 1200); // мкл O2/(г·год)
  const s1 = id * m / 60, s2 = s1 * (1 - rq);
  const data = T.map((t) => ({ t, x1: Math.round(s1 * t + (t ? 2.5 * noise.normal() : 0)), x2: Math.round(s2 * t + (t ? 2.5 * noise.normal() : 0)) }));
  const f1 = linreg(T, data.map((d) => d.x1)), f2 = linreg(T, data.map((d) => d.x2));
  return { kind, m, data, s1: f1.b, s2: f2.b, idCalc: f1.b * 60 / m, rqCalc: (f1.b - f2.b) / f1.b };
}

$('rq-run').addEventListener('click', () => {
  const str = $('rq-variant').value.trim();
  if (!str) { $('rq-variant').focus(); $('rq-variant').placeholder = 'Спершу введіть варіант'; return; }
  exp = makeVariant(str);
  $('rq-exp').hidden = false;
  $('rq-cond').innerHTML = `
    <div class="readout"><div class="readout__label">Варіант</div><div class="readout__value">${str.replace(/[<>&]/g, '')}</div></div>
    <div class="readout readout--gold"><div class="readout__label">Насіння</div><div class="readout__value" style="font-size:1rem">${exp.kind.seed}</div></div>
    <div class="readout"><div class="readout__label">Маса наважки</div><div class="readout__value">${num(exp.m, 2)} г</div></div>
    <div class="readout"><div class="readout__label">Температура</div><div class="readout__value">25 °C</div></div>`;
  pExp.set([
    { data: exp.data.map((d) => [d.t, d.x1]), type: 'points', color: COL.main, label: 'з КОН (x₁)' },
    { data: exp.data.map((d) => [d.t, d.x2]), type: 'points', color: COL.berry, label: 'без КОН (x₂)' },
  ], [{ y: 0, color: '#C9D3CC' }]);
  renderTable($('rq-table'), ['t, хв', 'x₁ (з КОН), мкл', 'x₂ (без КОН), мкл'], exp.data.map((d) => [d.t, d.x1, d.x2]));
  $('rq-verdict').textContent = ''; $('rq-verdict').className = 'verdict';
  ['rq-id', 'rq-rq', 'rq-sub'].forEach((id) => $(id).classList.remove('ok', 'bad'));
});

$('rq-csv').addEventListener('click', () => {
  if (!exp) return;
  downloadCSV(`dykhannia-LR7-${$('rq-variant').value.trim() || 'variant'}.csv`, ['t, хв', 'x1 з КОН, мкл', 'x2 без КОН, мкл'], exp.data.map((d) => [d.t, d.x1, d.x2]));
});

$('rq-check').addEventListener('click', () => {
  if (!exp) return;
  const sub = $('rq-sub').value;
  const res = [
    ['rq-id', 'Інтенсивність дихання', check($('rq-id').value, exp.idCalc, 0.06)],
    ['rq-rq', 'ДК', check($('rq-rq').value, exp.rqCalc, 0.06)],
    ['rq-sub', 'Субстрат', { ok: sub === exp.kind.key, empty: !sub, custom: true }],
  ];
  const lines = res.map(([id, name, r]) => {
    $(id).classList.toggle('ok', r.ok);
    $(id).classList.toggle('bad', !r.ok && !r.empty);
    const bad = r.custom ? 'неправильно' : `відхилення ${num(r.err * 100, 0)} %`;
    return `${name}: ${r.empty ? 'не введено' : r.ok ? 'в межах допуску' : bad}`;
  });
  const all = res.every((r) => r[2].ok);
  const names = { fat: 'жири', prot: 'білки разом із вуглеводами', carb: 'вуглеводи', anaer: 'вуглеводи + бродіння' };
  const v = $('rq-verdict');
  v.className = 'verdict ' + (all ? 'verdict--ok' : 'verdict--bad');
  v.innerHTML = `<b>${all ? 'Чудово! Усі результати в межах допуску.' : 'Є неточності — перевірте розрахунки.'}</b><br>${lines.join('<br>')}` +
    `<details style="margin-top:8px"><summary>Показати еталонні значення</summary>нахили: x₁ — ${num(exp.s1, 2)} мкл/хв, x₂ — ${num(exp.s2, 2)} мкл/хв; ` +
    `ІД = ${num(exp.idCalc, 0)} мкл O₂/(г·год); ДК = ${num(exp.rqCalc, 2)}; субстрат — ${names[exp.kind.key]}.</details>`;
});
