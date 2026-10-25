// ЛР 8. Аскорбінова кислота: титрування за Тільмансом, руйнування першого порядку, рівняння Арреніуса.
import { Plot, linspace } from './plot.js';
import { sliders, setOut, num, sig, downloadCSV, rng, hashSeed, renderTable, check } from './ui.js';
import { linreg } from './fit.js';

const COL = { main: '#1B5E20', ref: '#B08A1E', teal: '#00695C', berry: '#8E3B5B', warm: '#C0573E' };
const $ = (id) => document.getElementById(id);
const R = 8.314e-3; // кДж/(моль·К)
const K0 = 273.15;
const kAt = (T, kRef, Ea, Tref = 90) => kRef * Math.exp(-Ea / R * (1 / (T + K0) - 1 / (Tref + K0)));

// ---------- Модель ----------
const sl = sliders($('vc-c'), [
  { id: 't', label: 'Температура обробки', min: 40, max: 120, step: 1, value: 100, unit: '°C' },
  { id: 'ea', label: 'E<sub>a</sub> руйнування', min: 30, max: 100, step: 1, value: 60, unit: 'кДж/моль' },
  { id: 'k90', label: 'k при 90 °C', min: 0.002, max: 0.06, step: 0.001, value: 0.015, unit: 'хв⁻¹', digits: 3 },
  { id: 'dur', label: 'Тривалість обробки', min: 1, max: 90, step: 1, value: 20, unit: 'хв' },
], update);

const plot = new Plot($('vc-plot'), { xLabel: 't, хв', yLabel: 'C / C₀, %', xShort: 't', x: [0, 90], y: [0, 102], aspect: 1.3 });
const plotT = new Plot($('vc-plot-t'), { xLabel: 'T, °C', yLabel: 't½, хв', xShort: 'T', x: [40, 120], y: 'auto', aspect: 1.3 });

function update() {
  const { t, ea, k90, dur } = sl.values;
  const ts = linspace(0, 90, 181);
  const curve = (T) => ts.map((x) => [x, 100 * Math.exp(-kAt(T, k90, ea) * x)]);
  const k = kAt(t, k90, ea);
  plot.set([
    { data: curve(60), color: '#9FB3A3', dash: [5, 4], width: 1.5, label: '60 °C' },
    { data: curve(80), color: COL.ref, dash: [5, 4], width: 1.5, label: '80 °C' },
    { data: curve(t), color: COL.warm, label: `${num(t, 0)} °C`, marker: [dur, 100 * Math.exp(-k * dur)] },
  ], [{ x: dur, color: '#C9D3CC', dash: [2, 4], label: `${num(dur, 0)} хв` }]);
  const Ts = linspace(40, 120, 161);
  plotT.set([
    { data: Ts.map((T) => [T, Math.min(Math.LN2 / kAt(T, k90, ea), 2000)]), color: COL.main, label: 't½ = ln2 / k', marker: [t, Math.LN2 / k] },
  ]);
  setOut(document, {
    k: sig(k, 3) + ' хв⁻¹',
    half: num(Math.LN2 / k, 1) + ' хв',
    left: num(100 * Math.exp(-k * dur), 0) + ' %',
    q10: num(kAt(90, k90, ea) / kAt(80, k90, ea), 2),
  });
}
update();

// ---------- Віртуальний експеримент ----------
const PRODUCTS = [
  { name: 'плоди шипшини', x: [500, 900] },
  { name: 'ягоди чорної смородини', x: [150, 250] },
  { name: 'солодкий перець', x: [120, 200] },
  { name: 'листки петрушки', x: [120, 180] },
  { name: 'білоголова капуста', x: [30, 60] },
  { name: 'плоди лимона', x: [40, 60] },
];
const TIMES = [0, 5, 10, 20, 30, 45, 60];
const V_EXT = 100, V_AL = 10;
let exp = null;
const pExp = new Plot($('vc-exp-plot'), { xLabel: 't, хв', yLabel: 'V(ДХФІФ), мл', xShort: 't', x: [0, 62], y: 'auto', aspect: 1.3 });

function makeVariant(str) {
  const r = rng(hashSeed(str) ^ 0x1c3b77);
  const noise = rng(hashSeed(str) ^ 0x58e0aa);
  const p = r.pick(PRODUCTS);
  const X = r.range(...p.x);
  const titre = Math.round(r.range(0.06, 0.1) * 1000) / 1000; // мг/мл
  const m = Math.max(0.5, Math.round(r.range(7, 10) * titre * V_EXT * 100 / (X * V_AL) * 10) / 10);
  const V0 = X * V_AL * m / (titre * V_EXT * 100);
  const T1 = r.pick([60, 70]), T2 = r.pick([85, 90, 95]);
  const Ea = r.range(50, 80);
  const k2 = r.range(0.012, 0.03);
  const k1 = k2 * Math.exp(-Ea / R * (1 / (T1 + K0) - 1 / (T2 + K0)));
  const vol = (k, t) => Math.max(0.05, Math.round((V0 * Math.exp(-k * t) + 0.04 * noise.normal()) * 20) / 20);
  const data = TIMES.map((t) => ({ t, v1: vol(k1, t), v2: vol(k2, t) }));
  // еталон — як рахує студент
  const v0 = (data[0].v1 + data[0].v2) / 2;
  const xCalc = v0 * titre * V_EXT * 100 / (V_AL * m);
  const f1 = linreg(TIMES, data.map((d) => Math.log(d.v1))), f2 = linreg(TIMES, data.map((d) => Math.log(d.v2)));
  const kk1 = -f1.b, kk2 = -f2.b;
  const eaCalc = R * Math.log(kk2 / kk1) / (1 / (T1 + K0) - 1 / (T2 + K0));
  return { p, titre, m, T1, T2, data, xCalc, k1: kk1, k2: kk2, eaCalc };
}

$('vc-run').addEventListener('click', () => {
  const str = $('vc-variant').value.trim();
  if (!str) { $('vc-variant').focus(); $('vc-variant').placeholder = 'Спершу введіть варіант'; return; }
  exp = makeVariant(str);
  $('vc-exp').hidden = false;
  $('vc-cond').innerHTML = `
    <div class="readout"><div class="readout__label">Варіант</div><div class="readout__value">${str.replace(/[<>&]/g, '')}</div></div>
    <div class="readout readout--gold"><div class="readout__label">Матеріал</div><div class="readout__value" style="font-size:1rem">${exp.p.name}</div></div>
    <div class="readout"><div class="readout__label">Наважка</div><div class="readout__value">${num(exp.m, 1)} г</div></div>
    <div class="readout"><div class="readout__label">Титр ДХФІФ</div><div class="readout__value">${num(exp.titre, 3)} мг/мл</div></div>
    <div class="readout"><div class="readout__label">Екстракт / аліквота</div><div class="readout__value">100 / 10 мл</div></div>`;
  pExp.set([
    { data: exp.data.map((d) => [d.t, d.v1]), type: 'points', color: COL.ref, label: `${exp.T1} °C` },
    { data: exp.data.map((d) => [d.t, d.v2]), type: 'points', color: COL.warm, label: `${exp.T2} °C` },
  ]);
  renderTable($('vc-table'), ['t, хв', `V при ${exp.T1} °C, мл`, `V при ${exp.T2} °C, мл`], exp.data.map((d) => [d.t, num(d.v1, 2), num(d.v2, 2)]));
  $('vc-verdict').textContent = ''; $('vc-verdict').className = 'verdict';
  ['vc-x', 'vc-k', 'vc-h', 'vc-ea'].forEach((id) => $(id).classList.remove('ok', 'bad'));
});

$('vc-csv').addEventListener('click', () => {
  if (!exp) return;
  downloadCSV(`vitamin-c-LR8-${$('vc-variant').value.trim() || 'variant'}.csv`, ['t, хв', `V при ${exp.T1} °C, мл`, `V при ${exp.T2} °C, мл`], exp.data.map((d) => [d.t, d.v1, d.v2]));
});

$('vc-check').addEventListener('click', () => {
  if (!exp) return;
  const res = [
    ['vc-x', 'Вміст вітаміну С', check($('vc-x').value, exp.xCalc, 0.05)],
    ['vc-k', 'k', check($('vc-k').value, exp.k2, 0.08)],
    ['vc-h', 't<sub>1/2</sub>', check($('vc-h').value, Math.LN2 / exp.k2, 0.08)],
    ['vc-ea', 'E<sub>a</sub>', check($('vc-ea').value, exp.eaCalc, 0.15)],
  ];
  const lines = res.map(([id, name, r]) => {
    $(id).classList.toggle('ok', r.ok);
    $(id).classList.toggle('bad', !r.ok && !r.empty);
    return `${name}: ${r.empty ? 'не введено' : r.ok ? 'в межах допуску' : `відхилення ${num(r.err * 100, 0)} %`}`;
  });
  const all = res.every((r) => r[2].ok);
  const v = $('vc-verdict');
  v.className = 'verdict ' + (all ? 'verdict--ok' : 'verdict--bad');
  v.innerHTML = `<b>${all ? 'Чудово! Усі результати в межах допуску.' : 'Є неточності — перевірте розрахунки.'}</b><br>${lines.join('<br>')}` +
    `<details style="margin-top:8px"><summary>Показати еталонні значення</summary>вміст = ${num(exp.xCalc, 1)} мг/100 г; ` +
    `k(${exp.T1} °C) = ${sig(exp.k1, 3)} хв⁻¹, k(${exp.T2} °C) = ${sig(exp.k2, 3)} хв⁻¹, t<sub>1/2</sub> = ${num(Math.LN2 / exp.k2, 1)} хв; E<sub>a</sub> = ${num(exp.eaCalc, 0)} кДж/моль.</details>`;
});
