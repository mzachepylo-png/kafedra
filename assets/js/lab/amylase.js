// ЛР 6. Амілолітична активність: інтегроване рівняння Міхаеліса–Ментен, йодкрохмальна реакція, індукція амілази.
import { Plot, linspace } from './plot.js';
import { sliders, setOut, num, sig, downloadCSV, rng, hashSeed, renderTable, check } from './ui.js';
import { linreg } from './fit.js';

const COL = { main: '#1B5E20', ref: '#B08A1E', teal: '#00695C', berry: '#8E3B5B', blue: '#3949AB' };
const $ = (id) => document.getElementById(id);
const EPS = 0.1; // A йодкрохмального комплексу на 1 мг/мл крохмалю

// S(t) з рівняння (1): S = Km·W((S0/Km)·e^((S0 − V·t)/Km)); W шукаємо з w + ln w = L (метод Ньютона)
function substrate(t, S0, Vmax, Km) {
  const L = Math.log(S0 / Km) + (S0 - Vmax * t) / Km;
  let w = L > 1 ? L - Math.log(L) : Math.exp(L);
  for (let i = 0; i < 40; i++) {
    const f = w + Math.log(w) - L, d = 1 + 1 / w;
    const nw = Math.max(w - f / d, w / 10);
    if (Math.abs(nw - w) < 1e-12 * Math.max(1, w)) { w = nw; break; }
    w = nw;
  }
  return Km * w;
}

// ---------- Модель ----------
const sl = sliders($('am-c'), [
  { id: 'e', label: 'Кількість ферменту', min: 0.1, max: 5, step: 0.1, value: 1, unit: 'од.', hint: 'Vmax = 0,4 мг/(мл·хв) на 1 од. ферменту' },
  { id: 's0', label: 'Крохмаль S<sub>0</sub>', min: 1, max: 20, step: 0.5, value: 10, unit: 'мг/мл' },
  { id: 'km', label: 'K<sub>m</sub>', min: 1, max: 20, step: 0.5, value: 6, unit: 'мг/мл' },
], update);

const plot = new Plot($('am-plot'), { xLabel: 't, хв', yLabel: 'A₆₂₀', xShort: 't', x: [0, 30], y: 'auto', aspect: 1.3 });
const plotLn = new Plot($('am-plot-ln'), { xLabel: 't, хв', yLabel: 'ln A', xShort: 't', x: [0, 30], y: 'auto', yZero: false, aspect: 1.3 });

function update() {
  const { e, s0, km } = sl.values;
  const V = 0.4 * e, k = V / km;
  const ts = linspace(0, 30, 301);
  const exact = ts.map((t) => EPS * substrate(t, s0, V, km));
  const first = ts.map((t) => EPS * s0 * Math.exp(-k * t));
  plot.set([
    { data: ts.map((t, i) => [t, first[i]]), color: COL.ref, dash: [7, 6], width: 2, label: 'перший порядок' },
    { data: ts.map((t, i) => [t, exact[i]]), color: COL.blue, label: 'точний розв\'язок', fill: 'rgba(57,73,171,.07)' },
  ], [{ y: 0.05, color: '#9FB3A3', dash: [2, 4], label: 'ахроматична точка' }]);
  plotLn.set([
    { data: ts.map((t, i) => [t, Math.log(first[i])]), color: COL.ref, dash: [7, 6], width: 2, label: 'нахил = −k' },
    { data: ts.map((t, i) => [t, Math.log(exact[i])]).filter((p) => isFinite(p[1]) && p[1] > -6), color: COL.blue, label: 'ln A' },
  ]);
  const half = (s0 / 2 + km * Math.LN2) / V;
  const achro = s0 > 0.5 ? (s0 - 0.5 + km * Math.log(s0 / 0.5)) / V : 0;
  setOut(document, {
    v0: num(V * s0 / (km + s0), 3) + ' мг/(мл·хв)',
    k: sig(k, 3) + ' хв⁻¹',
    half: num(half, 1) + ' хв',
    achro: num(achro, 1) + ' хв',
  });
}
update();

// ---------- Віртуальний експеримент ----------
const S0 = 10, VR = 5, KM = 6;
const T_KIN = [0, 2, 4, 6, 8, 10, 12, 15, 20];
const DAYS = [0, 1, 2, 3, 4, 5];
let exp = null;
const pExp = new Plot($('am-exp-plot'), { xLabel: 't, хв', yLabel: 'A₆₂₀', xShort: 't', x: [0, 21], aspect: 1.3 });

function makeVariant(str) {
  const r = rng(hashSeed(str) ^ 0x5f3e21);
  const noise = rng(hashSeed(str) ^ 0x6a9bd1);
  const mr = r.pick([0.01, 0.0125, 0.02]);
  const vPeak = r.range(0.75, 1.0);
  const c50 = r.range(1.6, 2.6), dp = r.pick([3, 4]);
  const mult = (d) => (0.03 + 0.97 / (1 + Math.exp(-(d - c50) / 0.55))) * (d > dp ? Math.exp(-0.28 * (d - dp)) : 1);
  const top = Math.max(...DAYS.map(mult));
  const vmax = (d) => vPeak * mult(d) / top;
  const meas = (s) => +(EPS * s * (1 + 0.012 * noise.normal()) + 0.003 * noise.normal()).toFixed(3);
  const kin = T_KIN.map((t) => ({ t, A: meas(substrate(t, S0, vmax(3), KM)) }));
  kin[0].A = +(EPS * S0 + 0.004 * noise.normal()).toFixed(3);
  const days = DAYS.map((d) => ({ d, A0: +(EPS * S0 + 0.004 * noise.normal()).toFixed(3), A10: meas(substrate(10, S0, vmax(d), KM)) }));
  // еталон — як рахує студент
  const fit = linreg(kin.map((p) => p.t), kin.map((p) => Math.log(p.A)));
  const aa = days.map((x) => S0 * VR * (1 - x.A10 / x.A0) / (10 * mr));
  let iMax = 0; aa.forEach((v, i) => { if (v > aa[iMax]) iMax = i; });
  return { mr, kin, days, k: -fit.b, r2: fit.r2, aa, dayMax: DAYS[iMax], aaMax: aa[iMax] };
}

$('am-run').addEventListener('click', () => {
  const str = $('am-variant').value.trim();
  if (!str) { $('am-variant').focus(); $('am-variant').placeholder = 'Спершу введіть варіант'; return; }
  exp = makeVariant(str);
  $('am-exp').hidden = false;
  $('am-cond').innerHTML = `
    <div class="readout"><div class="readout__label">Варіант</div><div class="readout__value">${str.replace(/[<>&]/g, '')}</div></div>
    <div class="readout readout--gold"><div class="readout__label">Зерно на пробу (m<sub>р</sub>)</div><div class="readout__value">${num(exp.mr, 4).replace(/0+$/, '')} г</div></div>
    <div class="readout"><div class="readout__label">Крохмаль S<sub>0</sub></div><div class="readout__value">10 мг/мл</div></div>
    <div class="readout"><div class="readout__label">Об'єм суміші V<sub>р</sub></div><div class="readout__value">5 мл</div></div>`;
  pExp.set([{ data: exp.kin.map((p) => [p.t, p.A]), type: 'points', color: COL.blue, label: 'A₆₂₀' }]);
  renderTable($('am-table-k'), ['t, хв', 'A₆₂₀', 'ln A'], exp.kin.map((p) => [num(p.t, 0), num(p.A, 3), num(Math.log(p.A), 3)]));
  renderTable($('am-table-d'), ['Доба проростання', 'A₆₂₀ (0 хв)', 'A₆₂₀ (10 хв)'], exp.days.map((x) => [x.d, num(x.A0, 3), num(x.A10, 3)]));
  $('am-verdict').textContent = ''; $('am-verdict').className = 'verdict';
  ['am-k', 'am-aa', 'am-day'].forEach((id) => $(id).classList.remove('ok', 'bad'));
});

$('am-csv').addEventListener('click', () => {
  if (!exp) return;
  const n = Math.max(exp.kin.length, exp.days.length);
  const rows = Array.from({ length: n }, (_, i) => [exp.kin[i]?.t ?? '', exp.kin[i]?.A ?? '', exp.days[i]?.d ?? '', exp.days[i]?.A0 ?? '', exp.days[i]?.A10 ?? '']);
  downloadCSV(`amilaza-LR6-${$('am-variant').value.trim() || 'variant'}.csv`, ['t, хв (3-тя доба)', 'A620', 'Доба', 'A620 0 хв', 'A620 10 хв'], rows);
});

$('am-check').addEventListener('click', () => {
  if (!exp) return;
  const dayVal = parseInt($('am-day').value, 10);
  const dayOk = dayVal === exp.dayMax;
  const res = [
    ['am-k', 'k', check($('am-k').value, exp.k, 0.08)],
    ['am-aa', 'Максимальна АА', check($('am-aa').value, exp.aaMax, 0.06)],
    ['am-day', 'Доба максимуму', { ok: dayOk, empty: $('am-day').value.trim() === '', custom: true }],
  ];
  const lines = res.map(([id, name, r]) => {
    $(id).classList.toggle('ok', r.ok);
    $(id).classList.toggle('bad', !r.ok && !r.empty);
    const bad = r.custom ? 'неправильно' : `відхилення ${num(r.err * 100, 0)} %`;
    return `${name}: ${r.empty ? 'не введено' : r.ok ? 'в межах допуску' : bad}`;
  });
  const all = res.every((r) => r[2].ok);
  const v = $('am-verdict');
  v.className = 'verdict ' + (all ? 'verdict--ok' : 'verdict--bad');
  v.innerHTML = `<b>${all ? 'Чудово! Усі результати в межах допуску.' : 'Є неточності — перевірте розрахунки.'}</b><br>${lines.join('<br>')}` +
    `<details style="margin-top:8px"><summary>Показати еталонні значення</summary>k = ${sig(exp.k, 3)} хв⁻¹ (R² = ${num(exp.r2, 3)}), t<sub>1/2</sub> = ${num(Math.LN2 / exp.k, 1)} хв; ` +
    `АА за добами: ${exp.aa.map((x, i) => `${i} — ${num(x, 0)}`).join('; ')} мг/(хв·г); максимум на ${exp.dayMax}-ту добу.</details>`;
});
