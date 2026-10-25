// ЛР 3. Кислотно-основні властивості амінокислот: крива титрування, заряд, ізоелектрична точка.
import { Plot, linspace } from './plot.js';
import { sliders, segmented, setOut, num, downloadCSV, rng, hashSeed, renderTable } from './ui.js';

const COL = { main: '#1B5E20', ref: '#B08A1E', teal: '#00695C', berry: '#8E3B5B' };
const $ = (id) => document.getElementById(id);

// pK1 — α-COOH, pK2 — α-NH3+, pKR — радикал (r: 'none' | 'acid' | 'base')
const AA = {
  gly: { name: 'гліцин', pk1: 2.34, pk2: 9.60, r: 'none' },
  ala: { name: 'аланін', pk1: 2.34, pk2: 9.69, r: 'none' },
  asp: { name: 'аспарагінова кислота', pk1: 1.88, pk2: 9.60, pkr: 3.65, r: 'acid' },
  glu: { name: 'глутамінова кислота', pk1: 2.19, pk2: 9.67, pkr: 4.25, r: 'acid' },
  his: { name: 'гістидин', pk1: 1.82, pk2: 9.17, pkr: 6.00, r: 'base' },
  lys: { name: 'лізин', pk1: 2.18, pk2: 8.95, pkr: 10.53, r: 'base' },
  cys: { name: 'цистеїн', pk1: 1.96, pk2: 10.28, pkr: 8.18, r: 'acid' },
};

const pks = (a) => (a.r === 'none' ? [a.pk1, a.pk2] : [a.pk1, a.pk2, a.pkr]);
// середня кількість відщеплених протонів (рівняння 3)
const nDiss = (pH, list) => list.reduce((s, pk) => s + 1 / (1 + Math.pow(10, pk - pH)), 0);
// заряд повністю протонованої форми: +1 (α-NH3+) і ще +1, якщо радикал основний
const q0 = (a) => 1 + (a.r === 'base' ? 1 : 0);
const charge = (pH, a) => q0(a) - nDiss(pH, pks(a));
function isoPoint(a) {
  let lo = 0, hi = 14;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (charge(m, a) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ---------- Модель ----------
const cur = { ...AA.gly };
const sl = sliders($('aa-pk'), [
  { id: 'pk1', label: 'pK<sub>1</sub> (α-COOH)', min: 1, max: 4, step: 0.01, value: cur.pk1 },
  { id: 'pk2', label: 'pK<sub>2</sub> (α-NH<sub>3</sub><sup>+</sup>)', min: 8, max: 11, step: 0.01, value: cur.pk2 },
  { id: 'pkr', label: 'pK<sub>R</sub> (радикал)', min: 3, max: 13, step: 0.01, value: 6 },
], (id) => { cur[id] = sl.values[id]; update(); });

segmented($('aa-preset'), 'aapreset', [
  { value: 'gly', label: 'Gly' }, { value: 'ala', label: 'Ala' }, { value: 'asp', label: 'Asp' },
  { value: 'glu', label: 'Glu' }, { value: 'his', label: 'His' }, { value: 'lys', label: 'Lys' }, { value: 'cys', label: 'Cys' },
], 'gly', (v) => {
  Object.assign(cur, AA[v]);
  sl.set('pk1', cur.pk1, true); sl.set('pk2', cur.pk2, true);
  if (cur.r !== 'none') sl.set('pkr', cur.pkr, true);
  update();
});

const plotT = new Plot($('aa-plot-t'), { xLabel: 'NaOH, еквівалентів', yLabel: 'pH', xShort: 'екв.', x: [0, 3.2], y: [0, 14], aspect: 1.3 });
const plotQ = new Plot($('aa-plot-q'), { xLabel: 'pH', yLabel: 'Сумарний заряд', xShort: 'pH', x: [0, 14], y: [-2.2, 2.2], yZero: false, aspect: 1.3 });

function titrCurve(a, c) {
  const list = pks(a);
  const out = [];
  for (const pH of linspace(0.3, 13.7, 671)) {
    const h = Math.pow(10, -pH), oh = 1e-14 / h;
    const b = nDiss(pH, list) + (oh - h) / c;
    if (b >= -0.02 && b <= list.length + 0.25) out.push([Math.max(0, b), pH]);
  }
  return out;
}

function update() {
  sl.inputs.pkr.row.hidden = cur.r === 'none';
  const list = pks(cur);
  const ng = list.length;
  plotT.setOptions({ x: [0, ng + 0.25] });
  const sorted = [...list].sort((x, y) => x - y);
  plotT.set([
    { data: titrCurve(cur, 0.05), color: COL.main, label: 'pH від кількості NaOH' },
  ], sorted.map((pk, i) => ({ y: pk, color: '#9FB3A3', dash: [2, 4], label: `pK = ${num(pk, 2)} (${num(i + 0.5, 1)} екв.)` })));
  const pI = isoPoint(cur);
  plotQ.setOptions({ y: [-(ng - q0(cur)) - 0.3, q0(cur) + 0.3] });
  const pHs = linspace(0, 14, 561);
  plotQ.set([
    { data: pHs.map((x) => [x, charge(x, cur)]), color: COL.berry, label: 'заряд', marker: [pI, 0] },
  ], [{ x: pI, label: `pI = ${num(pI, 2)}`, color: COL.ref }, { y: 0, color: '#C9D3CC' }]);
  setOut(document, {
    pi: num(pI, 2),
    q74: (charge(7.4, cur) >= 0 ? '+' : '') + num(charge(7.4, cur), 2),
    ng: String(ng),
    buf: sorted.map((pk) => `${num(pk - 1, 1)}–${num(pk + 1, 1)}`).join('; '),
  });
}
update();

// ---------- Віртуальний експеримент ----------
const V0 = 20, C_AA = 0.05, C_NAOH = 0.1; // мл, М, М → 1 ммоль амінокислоти, 10 мл NaOH на еквівалент
const nAA = V0 * C_AA;
let exp = null;
const pExp = new Plot($('aa-exp-plot'), { xLabel: 'V(NaOH), мл', yLabel: 'pH', xShort: 'V', y: [0, 14], aspect: 1.2 });

function phAt(V, list) {
  const nb = C_NAOH * V, vt = V0 + V;
  let lo = 0, hi = 14;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2, h = Math.pow(10, -m);
    const f = nDiss(m, list) * nAA - nb + (1e-14 / h - h) * vt;
    if (f > 0) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}

function makeVariant(str) {
  const r = rng(hashSeed(str) ^ 0x3a7f11);
  const key = r.pick(Object.keys(AA));
  const base = AA[key];
  const jit = () => Math.round(r.range(-0.06, 0.06) * 100) / 100;
  const a = { ...base, pk1: +(base.pk1 + jit()).toFixed(2), pk2: +(base.pk2 + jit()).toFixed(2) };
  if (base.r !== 'none') a.pkr = +(base.pkr + jit()).toFixed(2);
  const list = pks(a);
  const noise = rng(hashSeed(str) ^ 0x7c15a9);
  const vMax = list.length * 10 + 4;
  const data = [];
  for (let V = 0; V <= vMax + 1e-9; V += 1) data.push({ V, pH: +(phAt(V, list) + 0.015 * noise.normal()).toFixed(2) });
  return { key, a, list, data, pI: isoPoint(a) };
}

$('aa-run').addEventListener('click', () => {
  const str = $('aa-variant').value.trim();
  if (!str) { $('aa-variant').focus(); $('aa-variant').placeholder = 'Спершу введіть варіант'; return; }
  exp = makeVariant(str);
  $('aa-exp').hidden = false;
  $('aa-cond').innerHTML = `
    <div class="readout"><div class="readout__label">Варіант</div><div class="readout__value">${str.replace(/[<>&]/g, '')}</div></div>
    <div class="readout readout--gold"><div class="readout__label">Амінокислота</div><div class="readout__value">1 ммоль (20 мл 0,05 М)</div></div>
    <div class="readout"><div class="readout__label">Титрант</div><div class="readout__value">0,1 М NaOH</div></div>
    <div class="readout"><div class="readout__label">1 еквівалент</div><div class="readout__value">10 мл NaOH</div></div>`;
  pExp.setOptions({ x: [0, exp.data[exp.data.length - 1].V] });
  pExp.set([{ data: exp.data.map((d) => [d.V, d.pH]), type: 'points', color: COL.main, label: 'pH' }]);
  renderTable($('aa-table'), ['V(NaOH), мл', 'екв.', 'pH', 'ΔpH/ΔV'], exp.data.map((d, i) => [
    num(d.V, 1), num(d.V / 10, 2), num(d.pH, 2), i ? num(d.pH - exp.data[i - 1].pH, 2) : '—']));
  $('aa-verdict').textContent = ''; $('aa-verdict').className = 'verdict';
  ['aa-a1', 'aa-a2', 'aa-a3', 'aa-api', 'aa-aid'].forEach((id) => $(id).classList.remove('ok', 'bad'));
});

$('aa-csv').addEventListener('click', () => {
  if (!exp) return;
  downloadCSV(`tytruvannia-LR3-${$('aa-variant').value.trim() || 'variant'}.csv`, ['V(NaOH), мл', 'еквівалентів', 'pH'],
    exp.data.map((d) => [d.V, d.V / 10, d.pH]));
});

const val = (id) => parseFloat(String($(id).value).replace(',', '.').replace('−', '-'));
$('aa-check').addEventListener('click', () => {
  if (!exp) return;
  const truth = [...exp.list].sort((x, y) => x - y);
  const given = ['aa-a1', 'aa-a2', 'aa-a3'].map((id) => ({ id, v: val(id) })).filter((g) => isFinite(g.v));
  const sortedGiven = [...given].sort((x, y) => x.v - y.v);
  const lines = [];
  ['aa-a1', 'aa-a2', 'aa-a3'].forEach((id) => $(id).classList.remove('ok', 'bad'));
  let pkOk = sortedGiven.length === truth.length;
  if (!pkOk) lines.push(`pK<sub>a</sub>: потрібно ${truth.length} значення, введено ${sortedGiven.length}`);
  sortedGiven.forEach((g, i) => {
    // для pK < 3 точка напівнейтралізації зсунута вільними H+ (до ~0,3), тож допуск ширший
    const ok = i < truth.length && Math.abs(g.v - truth[i]) <= (truth[i] < 3 ? 0.4 : 0.25);
    $(g.id).classList.add(ok ? 'ok' : 'bad');
    if (!ok) pkOk = false;
  });
  if (sortedGiven.length === truth.length) lines.push(`pK<sub>a</sub>: ${pkOk ? 'в межах допуску' : 'є значення поза допуском (±0,25; для pK < 3 — ±0,4)'}`);
  const pi = val('aa-api');
  const piOk = isFinite(pi) && Math.abs(pi - exp.pI) <= 0.25;
  $('aa-api').classList.toggle('ok', piOk); $('aa-api').classList.toggle('bad', isFinite(pi) && !piOk);
  lines.push(`pI: ${!isFinite(pi) ? 'не введено' : piOk ? 'в межах допуску' : `різниця ${num(Math.abs(pi - exp.pI), 2)}`}`);
  const id = $('aa-aid').value;
  const idOk = id === exp.key;
  $('aa-aid').classList.toggle('ok', idOk); $('aa-aid').classList.toggle('bad', !!id && !idOk);
  lines.push(`Амінокислота: ${!id ? 'не обрано' : idOk ? 'визначено правильно' : 'неправильно'}`);
  const all = pkOk && piOk && idOk;
  const v = $('aa-verdict');
  v.className = 'verdict ' + (all ? 'verdict--ok' : 'verdict--bad');
  v.innerHTML = `<b>${all ? 'Чудово! Амінокислоту визначено правильно.' : 'Є неточності — перевірте розрахунки.'}</b><br>${lines.join('<br>')}` +
    `<details style="margin-top:8px"><summary>Показати еталонні значення</summary>${AA[exp.key].name}: pK = ${truth.map((x) => num(x, 2)).join('; ')}, pI = ${num(exp.pI, 2)}.</details>`;
});
