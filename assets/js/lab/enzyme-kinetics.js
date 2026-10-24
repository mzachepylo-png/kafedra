// ЛР 1. Кінетика ферментативних реакцій: Міхаеліс–Ментен, лінеаризації, інгібування, кінетична крива.
import { Plot, sample, linspace } from './plot.js';
import { sliders, segmented, setOut, num, sig, downloadCSV, rng, hashSeed, renderTable, check } from './ui.js';
import { linreg, lm, rk4 } from './fit.js';

const COL = { main: '#1B5E20', ref: '#B08A1E', teal: '#00695C', berry: '#8E3B5B' };
const $ = (id) => document.getElementById(id);

const TYPES = [
  { value: 'none', label: 'Немає' },
  { value: 'competitive', label: 'Конкурентне' },
  { value: 'noncompetitive', label: 'Неконкурентне' },
  { value: 'uncompetitive', label: 'Безконкурентне' },
  { value: 'mixed', label: 'Змішане' },
];
const TYPE_NAME = Object.fromEntries(TYPES.map((t) => [t.value, t.label.toLowerCase()]));

// ---------- Модель ----------
const enz = sliders($('ek-enzyme'), [
  { id: 'vmax', label: 'V<sub>max</sub>', min: 1, max: 100, step: 1, value: 40, unit: 'мкмоль/(хв·мг)' },
  { id: 'km', label: 'K<sub>m</sub>', min: 0.05, max: 20, log: true, value: 2, unit: 'мМ', format: (v) => sig(v, 3) },
], update);

const type = segmented($('ek-type'), 'type', TYPES, 'competitive', update);

const inh = sliders($('ek-inhib'), [
  { id: 'i', label: '[I]', min: 0, max: 10, step: 0.1, value: 2, unit: 'мМ' },
  { id: 'ki', label: 'K<sub>i</sub> (зв\'язування з E)', min: 0.05, max: 20, log: true, value: 1.5, unit: 'мМ', format: (v) => sig(v, 3) },
  { id: 'ki2', label: 'K<sub>i</sub>′ (зв\'язування з ES)', min: 0.05, max: 20, log: true, value: 4, unit: 'мМ', format: (v) => sig(v, 3) },
], update);

const view = segmented($('ek-view'), 'view', [
  { value: 'mm', label: 'Міхаеліс–Ментен' },
  { value: 'lb', label: 'Лайнуівер–Берк' },
  { value: 'eh', label: 'Іді–Хофсті' },
  { value: 'time', label: 'Кінетична крива' },
], 'mm', update);

const prog = sliders($('ek-progress-ctrl'), [
  { id: 's0', label: 'Початкова концентрація субстрату [S]<sub>0</sub>', min: 0.1, max: 50, log: true, value: 10, unit: 'мМ', format: (v) => sig(v, 3),
    hint: 'Концентрація ферменту 1 мг/мл, тож швидкість у мМ/хв чисельно дорівнює v у мкмоль/(хв·мг).' },
], update);

const plot = new Plot($('ek-plot'), { aspect: 1.7 });

function params() {
  const { vmax, km } = enz.values;
  const { i, ki, ki2 } = inh.values;
  const t = type.value;
  let a = 1, a2 = 1;
  if (t === 'competitive') a = 1 + i / ki;
  if (t === 'noncompetitive') { a = 1 + i / ki; a2 = a; }
  if (t === 'uncompetitive') a2 = 1 + i / ki2;
  if (t === 'mixed') { a = 1 + i / ki; a2 = 1 + i / ki2; }
  return { vmax, km, a, a2, kmApp: a * km / a2, vmApp: vmax / a2, t };
}

const rate = (S, p, a = p.a, a2 = p.a2) => p.vmax * S / (a * p.km + a2 * S);

function update() {
  const p = params();
  const t = p.t, hasI = t !== 'none';
  // доступність повзунків
  inh.inputs.i.row.classList.toggle('is-disabled', !hasI);
  inh.inputs.ki.row.classList.toggle('is-disabled', !(t === 'competitive' || t === 'noncompetitive' || t === 'mixed'));
  inh.inputs.ki2.row.classList.toggle('is-disabled', !(t === 'uncompetitive' || t === 'mixed'));
  $('ek-progress-ctrl').hidden = view.value !== 'time';

  const ref = (data) => (hasI ? { data, color: COL.ref, dash: [7, 6], width: 2, label: 'без інгібітора' } : null);
  const mainLabel = hasI ? 'з інгібітором' : 'v';

  if (view.value === 'mm') {
    const sMax = 10 * p.km;
    plot.setOptions({ xLabel: '[S], мМ', yLabel: 'v, мкмоль/(хв·мг)', xShort: '[S]', x: [0, sMax], y: 'auto' });
    plot.set([
      ref(sample((S) => rate(S, p, 1, 1), 0, sMax)),
      { data: sample((S) => rate(S, p), 0, sMax), color: COL.main, label: mainLabel, marker: [p.kmApp, p.vmApp / 2] },
    ], [
      { y: p.vmApp, label: hasI ? 'Vmax уявна' : 'Vmax', color: COL.main },
      { y: p.vmApp / 2, color: '#9FB3A3', dash: [2, 4] },
      { x: p.kmApp, label: hasI ? 'Km уявна' : 'Km', color: COL.ref },
    ]);
  } else if (view.value === 'lb') {
    const kmin = Math.min(p.km, p.kmApp);
    const x0 = -1.3 / kmin, x1 = 4 / p.km;
    const line = (a, a2) => (x) => (a * p.km / p.vmax) * x + a2 / p.vmax;
    plot.setOptions({ xLabel: '1/[S], мМ⁻¹', yLabel: '1/v, (хв·мг)/мкмоль', xShort: '1/[S]', x: [x0, x1], y: 'auto' });
    plot.set([
      ref(sample(line(1, 1), x0, x1, 2)),
      { data: sample(line(p.a, p.a2), x0, x1, 2), color: COL.main, label: mainLabel },
      { data: [[-1 / p.kmApp, 0], [0, 1 / p.vmApp]], type: 'points', color: COL.berry, r: 5, label: 'перетини з осями' },
    ]);
  } else if (view.value === 'eh') {
    const xMax = Math.max(p.vmax / p.km, p.vmApp / p.kmApp) * 1.08;
    const line = (vm, km) => (x) => vm - km * x;
    plot.setOptions({ xLabel: 'v/[S], мкмоль/(хв·мг·мМ)', yLabel: 'v, мкмоль/(хв·мг)', xShort: 'v/[S]', x: [0, xMax], y: 'auto' });
    plot.set([
      ref(sample(line(p.vmax, p.km), 0, p.vmax / p.km, 2)),
      { data: sample(line(p.vmApp, p.kmApp), 0, p.vmApp / p.kmApp, 2), color: COL.main, label: mainLabel },
    ]);
  } else {
    const s0 = prog.values.s0;
    const t95 = (0.95 * s0 + p.kmApp * Math.log(20)) / p.vmApp;
    const tMax = t95 * 1.15;
    const f = (a, a2) => (tt, y) => [-rate(y[0], p, a, a2)];
    const sol = rk4(f(p.a, p.a2), [s0], 0, tMax, 400);
    const sol0 = hasI ? rk4(f(1, 1), [s0], 0, tMax, 400) : null;
    const v0 = rate(s0, p);
    plot.setOptions({ xLabel: 't, хв', yLabel: 'Концентрація, мМ', xShort: 't', x: [0, tMax], y: [0, s0 * 1.05] });
    plot.set([
      { data: sol.map((r) => [r[0], r[1]]), color: COL.teal, label: '[S]' },
      { data: sol.map((r) => [r[0], s0 - r[1]]), color: COL.main, label: '[P]' },
      sol0 ? { data: sol0.map((r) => [r[0], s0 - r[1]]), color: COL.ref, dash: [7, 6], width: 2, label: '[P] без інгібітора' } : null,
      { data: [[0, 0], [Math.min(tMax, s0 / v0), Math.min(tMax * v0, s0)]], color: COL.berry, dash: [3, 4], width: 1.6, label: 'початкова швидкість', noHover: true },
    ], [{ y: s0 / 2, color: '#9FB3A3', dash: [2, 4], label: '50 % перетворення' }]);
  }

  const v0km = rate(p.km, p, 1, 1), vikm = rate(p.km, p);
  setOut(document, {
    kmapp: sig(p.kmApp, 3) + ' мМ',
    vmapp: sig(p.vmApp, 3),
    vkm: sig(vikm, 3),
    inh: hasI ? num((1 - vikm / v0km) * 100, 1) + ' %' : '0 %',
  });
}

$('ek-csv').addEventListener('click', () => {
  const p = params();
  if (view.value === 'time') {
    const s0 = prog.values.s0;
    const tMax = (0.95 * s0 + p.kmApp * Math.log(20)) / p.vmApp * 1.15;
    const sol = rk4((t, y) => [-rate(y[0], p)], [s0], 0, tMax, 100);
    downloadCSV('kinetychna-kryva.csv', ['t, хв', '[S], мМ', '[P], мМ'], sol.map((r) => [r[0], r[1], s0 - r[1]]));
    return;
  }
  const rows = linspace(p.km / 10, p.km * 10, 40).map((S) => {
    const v0 = rate(S, p, 1, 1), vi = rate(S, p);
    return [S, v0, vi, 1 / S, 1 / v0, 1 / vi];
  });
  downloadCSV('mikhaelis-menten.csv', ['[S], мМ', 'v0', 'vI', '1/[S]', '1/v0', '1/vI'], rows);
});

update();

// ---------- Віртуальний експеримент ----------
const S_SERIES = [0.25, 0.5, 1, 2, 4, 8, 16];
let exp = null;
const plotMM = new Plot($('ek-exp-mm'), { xLabel: '[S], мМ', yLabel: 'v, мкмоль/(хв·мг)', xShort: '[S]', aspect: 1.35 });
const plotLB = new Plot($('ek-exp-lb'), { xLabel: '1/[S], мМ⁻¹', yLabel: '1/v', xShort: '1/[S]', aspect: 1.35 });

function makeVariant(str) {
  const r = rng(hashSeed(str));
  const km = +r.range(0.3, 6).toPrecision(2);
  const vmax = +r.range(15, 90).toFixed(1);
  const t = r.pick(['competitive', 'noncompetitive', 'uncompetitive']);
  const ki = +r.range(0.4, 4).toPrecision(2);
  const I = Math.round(ki * r.range(1, 2.5) * 10) / 10;
  const noise = rng(hashSeed(str) ^ 0x9e3779b9);
  const a = t === 'uncompetitive' ? 1 : 1 + I / ki;
  const a2 = t === 'competitive' ? 1 : 1 + I / ki;
  const meas = (v) => +(v * (1 + 0.04 * noise.normal())).toFixed(2);
  const data = S_SERIES.map((S) => {
    const v0 = vmax * S / (km + S), vi = vmax * S / (a * km + a2 * S);
    return { S, v0: meas(v0), vi: meas(vi) };
  });
  return { km, vmax, t, ki, I, data };
}

function drawExp() {
  const d = exp.data;
  const showReg = $('ek-reg').checked;
  plotMM.set([
    { data: d.map((p) => [p.S, p.v0]), type: 'points', color: COL.ref, label: 'без інгібітора' },
    { data: d.map((p) => [p.S, p.vi]), type: 'points', color: COL.main, label: `з інгібітором (${num(exp.I, 1)} мМ)` },
  ]);
  const inv = (key) => d.map((p) => [1 / p.S, 1 / p[key]]);
  const r0 = linreg(d.map((p) => 1 / p.S), d.map((p) => 1 / p.v0));
  const ri = linreg(d.map((p) => 1 / p.S), d.map((p) => 1 / p.vi));
  const xMin = Math.min(-r0.a / r0.b, -ri.a / ri.b, 0) * 1.15;
  const series = [
    { data: inv('v0'), type: 'points', color: COL.ref, label: 'без інгібітора' },
    { data: inv('vi'), type: 'points', color: COL.main, label: 'з інгібітором' },
  ];
  if (showReg) {
    series.push({ data: sample((x) => r0.a + r0.b * x, xMin, 4.2, 2), color: COL.ref, width: 1.8, noHover: true });
    series.push({ data: sample((x) => ri.a + ri.b * x, xMin, 4.2, 2), color: COL.main, width: 1.8, noHover: true });
  }
  plotLB.setOptions({ x: showReg ? [xMin, 4.2] : [0, 4.2] });
  plotLB.set(series);
  const out = $('ek-regout');
  out.hidden = !showReg;
  if (showReg) {
    const eq = (r) => `1/v = ${sig(r.a, 4)} + ${sig(r.b, 4)} · (1/[S]), R² = ${num(r.r2, 4)}`;
    out.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-6 4 4 5-8"/></svg><div><p><b>Без інгібітора:</b> ${eq(r0)}</p><p><b>З інгібітором:</b> ${eq(ri)}</p><p>Перерахуйте коефіцієнти прямих у K<sub>m</sub> і V<sub>max</sub> за рівнянням (2).</p></div>`;
  }
}

$('ek-run').addEventListener('click', () => {
  const str = $('ek-variant').value.trim();
  if (!str) { $('ek-variant').focus(); $('ek-variant').placeholder = 'Спершу введіть варіант'; return; }
  exp = makeVariant(str);
  $('ek-exp').hidden = false;
  $('ek-cond').innerHTML = `
    <div class="readout"><div class="readout__label">Варіант</div><div class="readout__value">${str.replace(/[<>&]/g, '')}</div></div>
    <div class="readout readout--gold"><div class="readout__label">[I] у пробі</div><div class="readout__value">${num(exp.I, 1)} мМ</div></div>
    <div class="readout"><div class="readout__label">Білок у пробі</div><div class="readout__value">1 мг</div></div>
    <div class="readout"><div class="readout__label">Похибка вимірювань</div><div class="readout__value">≈ 4 %</div></div>`;
  renderTable($('ek-table'), ['[S], мМ', 'v<sub>0</sub>, мкмоль/(хв·мг)', 'v<sub>I</sub>, мкмоль/(хв·мг)', '1/[S]', '1/v<sub>0</sub>', '1/v<sub>I</sub>'],
    exp.data.map((p) => [num(p.S, 2), num(p.v0, 2), num(p.vi, 2), num(1 / p.S, 3), num(1 / p.v0, 4), num(1 / p.vi, 4)]));
  $('ek-verdict').textContent = '';
  $('ek-verdict').className = 'verdict';
  ['a-km', 'a-vm', 'a-ki'].forEach((id) => $(id).classList.remove('ok', 'bad'));
  drawExp();
});

$('ek-reg').addEventListener('change', () => exp && drawExp());

$('ek-exp-csv').addEventListener('click', () => {
  if (!exp) return;
  downloadCSV(`eksperyment-LR1-${$('ek-variant').value.trim() || 'variant'}.csv`,
    ['[S], мМ', 'v0', 'vI', '1/[S]', '1/v0', '1/vI', `[I] = ${exp.I} мМ`],
    exp.data.map((p) => [p.S, p.v0, p.vi, 1 / p.S, 1 / p.v0, 1 / p.vi, '']));
});

$('ek-check').addEventListener('click', () => {
  if (!exp) return;
  // для порівняння: нелінійна регресія за даними студента-варіанта
  const fit = lm((S, q) => q[0] * S / (q[1] + S), exp.data.map((p) => p.S), exp.data.map((p) => p.v0), [exp.vmax * 0.8, exp.km * 1.3]);
  const res = [
    ['a-km', 'K<sub>m</sub>', check($('a-km').value, exp.km, 0.2)],
    ['a-vm', 'V<sub>max</sub>', check($('a-vm').value, exp.vmax, 0.12)],
    ['a-ki', 'K<sub>i</sub>', check($('a-ki').value, exp.ki, 0.3)],
  ];
  const lines = [];
  for (const [id, name, r] of res) {
    $(id).classList.toggle('ok', r.ok);
    $(id).classList.toggle('bad', !r.ok && !r.empty);
    lines.push(r.empty ? `${name}: не введено` : `${name}: ${r.ok ? 'в межах допуску' : 'відхилення ' + num(r.err * 100, 0) + ' %'}`);
  }
  const tOk = $('a-type').value === exp.t;
  lines.push(`Тип інгібування: ${$('a-type').value ? (tOk ? 'правильно' : 'неправильно') : 'не обрано'}`);
  const all = res.every((r) => r[2].ok) && tOk;
  const v = $('ek-verdict');
  v.className = 'verdict ' + (all ? 'verdict--ok' : 'verdict--bad');
  v.innerHTML = `<b>${all ? 'Чудово! Усі параметри визначено правильно.' : 'Є неточності — перевірте розрахунки.'}</b><br>${lines.join('<br>')}` +
    `<details style="margin-top:8px"><summary>Показати еталонні значення</summary>K<sub>m</sub> = ${sig(exp.km, 3)} мМ, V<sub>max</sub> = ${num(exp.vmax, 1)} мкмоль/(хв·мг), ` +
    `інгібування ${TYPE_NAME[exp.t]}, K<sub>i</sub> = ${sig(exp.ki, 3)} мМ. Нелінійна регресія за вашими даними без інгібітора: ` +
    `K<sub>m</sub> = ${sig(fit.p[1], 3)} ± ${sig(fit.se[1], 2)} мМ, V<sub>max</sub> = ${sig(fit.p[0], 3)} ± ${sig(fit.se[0], 2)}.</details>`;
});
