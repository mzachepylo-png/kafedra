// ЛР 2, 4. Конструктор маточних розчинів середовища Мурасіге — Скуга (МС) і розрахунок пропису середовища.
// Робочі концентрації — табл. 3 посібника (с. 57, стовпчик МС; у таблиці помилково вказано «г/л», насправді мг/л).
// Кратність маточників за посібником: макросолі 10× (с. 56), мікросолі 100× (с. 56), Fe-хелат: 557 мг FeSO₄·7H₂O +
// 745 мг Na₂ЕДТА·2H₂O на 100 мл (с. 53) = 200×, вітаміни — 1 мг/мл кожного (с. 53, 56). Пописи ЛР 5 (с. 58) і ЛР 6
// (с. 60) беруть 1 мл мікросолей і 1 мл вітамінів на 1 л — тобто розраховані на маточники 1000×.
// Наважка: m = c · k · V (мг/л × кратність × л). Об'єм маточника на V_с середовища: V_м = s · V_с / k (s — частка МС).
// Ризик осаду CaSO₄ у суміші макросолей: індекс насичення SI = lg(γ²·[Ca²⁺][SO₄²⁻]/K_sp), K_sp(гіпс) = 3,14·10⁻⁵,
// γ — рівняння Девіса (обмежене I ≤ 0,5 М); іонні пари не враховано, тож оцінка консервативна.
import { Plot, segmented, sliders, fnum, clamp, lerp, TAU, rng, scene, shadow, beaker, rgba, Runner, onResize, fit, roundRect } from './kit.js';
import { balance, stirrer, volumetric, darkBottle, chip, crystals, font } from './t01-draw.js';

export const STOCKS = {
  macro: { name: 'Макросолі МС', short: 'Макро', folds: [5, 10, 20, 50], k: 10, kBook: 10, vols: [250, 500, 1000], V: 1000, color: '#FFFFFF',
    items: [['NH₄NO₃', 1650, 80.04], ['KNO₃', 1900, 101.10], ['CaCl₂·2H₂O', 440, 147.01], ['MgSO₄·7H₂O', 370, 246.47], ['KH₂PO₄', 170, 136.09]] },
  micro: { name: 'Мікросолі МС', short: 'Мікро', folds: [100, 1000], k: 100, kBook: 1000, vols: [50, 100, 250], V: 100, color: '#F3EFF8',
    items: [['H₃BO₃', 6.2, 61.83], ['MnSO₄·4H₂O', 22.3, 223.06], ['ZnSO₄·7H₂O', 8.6, 287.56], ['KI', 0.83, 166.00], ['Na₂MoO₄·2H₂O', 0.25, 241.95], ['CuSO₄·5H₂O', 0.025, 249.69], ['CoCl₂·6H₂O', 0.025, 237.93]] },
  fe: { name: 'Fe-хелат (Fe-ЕДТА)', short: 'Fe-хелат', folds: [100, 200], k: 200, kBook: 200, vols: [50, 100, 250], V: 100, color: '#D9E8C4',
    items: [['FeSO₄·7H₂O', 27.85, 278.01], ['Na₂ЕДТА·2H₂O', 37.25, 372.24]] },
  vit: { name: 'Вітаміни МС', short: 'Вітаміни', folds: [100, 1000], k: 1000, kBook: 1000, vols: [25, 50, 100], V: 50, color: '#FFFDF0',
    items: [['Тіамін·HCl (B₁)', 0.1, 337.27], ['Піридоксин·HCl (B₆)', 0.5, 205.64], ['Нікотинова к-та (PP)', 0.5, 123.11]] },
};
export const HORMONES = [
  { id: 'd24', n: '2,4-Д', full: '2,4-дихлорфеноксиоцтова кислота (ауксин)', M: 221.04, solv: 'розчинити в 0,5–2 мл етанолу, підігріти, довести водою' },
  { id: 'kin', n: 'Кінетин', full: '6-фурфуриламінопурин (цитокінін)', M: 215.21, solv: 'розчинити у 2 мл 0,5 н HCl, підігріти, довести водою' },
  { id: 'iaa', n: 'ІОК', full: 'індоліл-3-оцтова кислота (ауксин)', M: 175.18, solv: 'розчинити в 0,5–2 мл етанолу, підігріти, довести водою' },
  { id: 'bap', n: '6-БАП', full: '6-бензиламінопурин (цитокінін)', M: 225.25, solv: 'розчинити у 2 мл 0,5 н HCl, підігріти, довести водою' },
];
// Прописи середовищ (на 1 л): об'єми маточників за посібником + інші компоненти
export const RECIPES = {
  ms: { name: 'МС повне (табл. 3)', ref: 'с. 57', book: { macro: 100, micro: 10, fe: 5, vit: 1 }, s: { macro: 1, micro: 1, fe: 1, vit: 1 },
    other: [['Сахароза', '30 г'], ['Агар', '8 г (0,8 %)'], ['pH', '5,6–5,8 (1 н KOH)']] },
  soy: { name: 'ЛР 5: проростки сої', ref: 'с. 58', book: { macro: 50, micro: 0.5, fe: 2.5, vit: 0.5 }, s: { macro: 0.5, micro: 0.5, fe: 0.5, vit: 0.5 },
    other: [['Сахароза', '20 г'], ['Вода', '930 мл'], ['pH', '5,6–5,8 до автоклавування']] },
  callus: { name: 'ЛР 6: калюсогенне', ref: 'с. 60', book: { macro: 100, micro: 1, fe: 5, vit: 1 }, s: { macro: 1, micro: 1, fe: 1, vit: 1 },
    other: [['Гідролізат казеїну', '500 мг'], ['Мезоінозит', '100 мг'], ['Кінетин', '2 мг = 2 мл маточника 1 мг/мл'], ['ІОК', '2 мг = 2 мл маточника 1 мг/мл'], ['Сахароза', '20 г'], ['Агар', '8 г'], ['Вода', '880 мл'], ['pH', '5,6–5,8 (≈ 5 крапель 1 н KOH)']] },
};

const BAL_D = 0.1; // мг — дискретність аналітичних ваг
/** Індекс насичення CaSO₄ у маточнику макросолей кратності k. */
export function caso4SI(k) {
  const m = STOCKS.macro.items.map(([, c, M]) => c / 1000 / M * k); // моль/л
  const [nh4no3, kno3, cacl2, mgso4, kh2po4] = m;
  const I = 0.5 * (nh4no3 * 2 + kno3 * 2 + cacl2 * 6 + mgso4 * 8 + kh2po4 * 2);
  const Ie = Math.min(I, 0.5);
  const g2 = Math.pow(10, -0.51 * 4 * (Math.sqrt(Ie) / (1 + Math.sqrt(Ie)) - 0.3 * Ie));
  return { SI: Math.log10(g2 * cacl2 * g2 * mgso4 / 3.14e-5), I };
}
export function stockMasses(key, k, V) { return STOCKS[key].items.map(([n, c, M]) => ({ n, c, M, mM: c / M, gL: c * k / 1000, mg: c * k * V / 1000 })); }

const fmtMass = (mg) => (mg >= 1000 ? `${fnum(mg / 1000, mg >= 10000 ? 2 : 3)} г` : mg >= 1 ? `${fnum(mg, mg >= 100 ? 1 : 2)} мг` : `${fnum(mg, 3)} мг`);
const fmtC = (c) => (c >= 100 ? fnum(c, 0) : c >= 1 ? fnum(c, 2) : fnum(c, 3));

export function initStock(root) {
  const $ = (s) => root.querySelector(s);
  const cv = $('canvas'), hud = $('.ag-stage__hud'), verdict = $('.ag-verdict');
  const S = { key: 'macro', horm: 'd24', hc: 1, recipe: 'callus', Vm: 1000 };
  for (const k in STOCKS) { STOCKS[k].curK = STOCKS[k].k; STOCKS[k].curV = STOCKS[k].V; }
  let anim = { step: -1, f: 0, phase: 'idle' };

  const segK = segmented($('[data-ctl="stock"]'), 'stk', [
    { value: 'macro', label: 'Макро' }, { value: 'micro', label: 'Мікро' }, { value: 'fe', label: 'Fe-хелат' }, { value: 'vit', label: 'Вітаміни' }, { value: 'horm', label: 'Фітогормон' },
  ], S.key, (v) => { S.key = v; buildFold(); recalc(); runner.reset(); });
  const foldBox = $('[data-ctl="fold"]'), volBox = $('[data-ctl="svol"]'), hormBox = $('[data-ctl="horm"]');
  let segF, segVv, segH;
  function buildFold() {
    foldBox.replaceChildren(); volBox.replaceChildren(); hormBox.replaceChildren();
    hormBox.closest('.ctrlgrp').hidden = S.key !== 'horm';
    if (S.key === 'horm') {
      segH = segmented(hormBox, 'hrm', HORMONES.map((h) => ({ value: h.id, label: h.n })), S.horm, (v) => { S.horm = v; recalc(); });
      segF = segmented(foldBox, 'fld', [0.1, 0.5, 1].map((c) => ({ value: c, label: `${fnum(c, c < 1 ? 1 : 0)} мг/мл` })), S.hc, (v) => { S.hc = +v; recalc(); });
      segVv = segmented(volBox, 'svl', [25, 50, 100].map((v) => ({ value: v, label: `${v} мл` })), S.hV || 100, (v) => { S.hV = +v; recalc(); });
      S.hV = S.hV || 100;
      return;
    }
    const st = STOCKS[S.key];
    segF = segmented(foldBox, 'fld', st.folds.map((f) => ({ value: f, label: `${f}×` })), st.curK, (v) => { st.curK = +v; recalc(); });
    segVv = segmented(volBox, 'svl', st.vols.map((v) => ({ value: v, label: v >= 1000 ? `${v / 1000} л` : `${v} мл` })), st.curV, (v) => { st.curV = +v; recalc(); });
  }
  segmented($('[data-ctl="recipe"]'), 'rcp', Object.entries(RECIPES).map(([k, r]) => ({ value: k, label: r.name })), S.recipe, (v) => { S.recipe = v; recalc(); });
  const slV = sliders($('[data-ctl="vm"]'), [{ id: 'Vm', label: 'Об\'єм середовища', min: 100, max: 2000, step: 50, value: S.Vm, unit: 'мл' }], () => { S.Vm = slV.values.Vm; recalc(); });

  const pSI = new Plot($('[data-plot="si"]'), { xLabel: 'Кратність маточника макросолей, ×', yLabel: 'Індекс насичення CaSO₄', xShort: 'k', x: [1, 50], y: [-2, 2.5], ariaLabel: 'Індекс насичення гіпсу в маточнику макросолей від кратності' });
  const pErr = new Plot($('[data-plot="err"]'), { xLabel: 'Кратність маточника, ×', yLabel: 'Похибка зважування, %', xShort: 'k', ariaLabel: 'Відносна похибка найменшої наважки від кратності маточника' });

  function current() {
    if (S.key === 'horm') {
      const h = HORMONES.find((x) => x.id === S.horm);
      const mg = S.hc * S.hV;
      return { items: [{ n: h.n, c: null, M: h.M, mM: null, gL: S.hc, mg }], k: null, V: S.hV, h };
    }
    const st = STOCKS[S.key];
    return { items: stockMasses(S.key, st.curK, st.curV), k: st.curK, V: st.curV, st };
  }

  function recalc() {
    const cur = current();
    // таблиця наважок
    const tb = $('[data-table="stock"]');
    if (S.key === 'horm') {
      const h = cur.h;
      tb.innerHTML = `<thead><tr><th>Речовина</th><th class="num">Маточник, мг/мл</th><th class="num">ммоль/л маточника</th><th class="num">Наважка на ${cur.V} мл</th></tr></thead>
        <tbody><tr class="${anim.step === 0 ? 'is-on' : ''}"><td><b>${h.n}</b> — ${h.full}</td><td class="num">${fnum(S.hc, S.hc < 1 ? 1 : 0)}</td><td class="num">${fnum(S.hc / h.M * 1000, 2)}</td><td class="num"><b>${fmtMass(cur.items[0].mg)}</b></td></tr></tbody>`;
    } else {
      tb.innerHTML = `<thead><tr><th>Сіль</th><th class="num">У середовищі, мг/л</th><th class="num">ммоль/л</th><th class="num">Маточник ${cur.k}×, г/л</th><th class="num">Наважка на ${cur.V >= 1000 ? cur.V / 1000 + ' л' : cur.V + ' мл'}</th></tr></thead><tbody>` +
        cur.items.map((r, i) => `<tr class="${anim.step === i ? 'is-on' : ''}${r.mg < 10 ? ' is-low' : ''}"><td>${r.n}</td><td class="num">${fmtC(r.c)}</td><td class="num">${r.mM >= 0.01 ? fnum(r.mM, 3) : fnum(r.mM * 1000, 2) + ' мкМ'}</td><td class="num">${fnum(r.gL, r.gL >= 1 ? 2 : 4)}</td><td class="num"><b>${fmtMass(r.mg)}</b>${r.mg < 10 ? ' ⚠' : ''}</td></tr>`).join('') + '</tbody>';
    }
    // перевірка з таблицею рецептури
    const minMg = Math.min(...cur.items.map((r) => r.mg));
    const err = BAL_D / minMg * 100;
    const si = caso4SI(STOCKS.macro.curK);
    const perL = cur.k ? 1000 / cur.k : null;
    const reads = {
      perL: S.key === 'horm' ? `${fnum(1 / S.hc, S.hc < 1 ? 0 : 0)} мл на 1 мг` : `${fnum(perL, perL < 1 ? 2 : perL < 10 ? 1 : 0)} мл/л`,
      tot: fmtMass(cur.items.reduce((a, r) => a + r.mg, 0)),
      min: `${fmtMass(minMg)}`,
      err: `<span class="${err > 1 ? 'is-bad' : 'is-ok'}">±${fnum(err, err < 0.1 ? 3 : 2)} %</span>`,
      si: `<span class="${si.SI > 0 ? 'is-bad' : 'is-ok'}">${fnum(si.SI, 2)}</span>`,
    };
    for (const [k, v] of Object.entries(reads)) root.querySelectorAll(`[data-out="${k}"]`).forEach((el) => { el.innerHTML = v; });
    // пропис середовища
    const rc = RECIPES[S.recipe];
    const rows = ['macro', 'micro', 'fe', 'vit'].map((key) => {
      const st = STOCKS[key], k = st.curK, need = rc.s[key] * S.Vm / k, bookV = rc.book[key], kImplied = rc.s[key] * 1000 / bookV;
      const ok = Math.abs(kImplied - k) / k < 0.01;
      return `<tr><td>${st.name} <small>(${k}×)</small></td><td class="num">${fnum(bookV, bookV < 1 ? 1 : bookV < 10 ? 1 : 0)} мл</td><td class="num"><b>${fnum(need, need < 1 ? 2 : need < 10 ? 1 : 0)} мл</b></td><td>${ok ? '<span class="t1-ok">✓ відповідає</span>' : `<span class="t1-bad">⚠ пропис розраховано на ${fnum(kImplied, 0)}× — з вашим ${k}× ${fnum(bookV, bookV < 1 ? 1 : 0)} мл дасть ${fnum(bookV * k / 1000, 2)}× замість ${fnum(rc.s[key], 1)}×</span>`}</td></tr>`;
    });
    const stockSum = ['macro', 'micro', 'fe', 'vit'].reduce((a, key) => a + RECIPES[S.recipe].s[key] * S.Vm / STOCKS[key].curK, 0);
    $('[data-table="recipe"]').innerHTML = `<thead><tr><th>Маточник</th><th class="num">Пропис (на 1 л), ${rc.ref}</th><th class="num">На ${S.Vm} мл</th><th>Перевірка</th></tr></thead><tbody>${rows.join('')}` +
      rc.other.map(([n, v]) => `<tr><td>${n}</td><td class="num">${v}</td><td class="num">${scaleOther(n, v)}</td><td></td></tr>`).join('') +
      `<tr><td><b>Вода (бідистилят)</b></td><td class="num">до 1 л</td><td class="num">до ${S.Vm} мл</td><td><small>маточників разом ${fnum(stockSum, 1)} мл</small></td></tr></tbody>`;
    // графіки
    const ks = []; for (let k = 1; k <= 50; k += 0.5) ks.push(k);
    pSI.set([{ data: ks.map((k) => [k, caso4SI(k).SI]), color: '#7C3AED', label: 'CaSO₄ у суміші макросолей', width: 2.4 }, { data: [[STOCKS.macro.curK, si.SI]], type: 'points', color: '#DC2626', label: 'ваш маточник', r: 6 }],
      [{ y: 0, color: '#B91C1C', label: 'насичення: вище — осад гіпсу' }]);
    const key = S.key === 'horm' ? 'micro' : S.key, st2 = STOCKS[key];
    const minC = Math.min(...st2.items.map((r) => r[1]));
    const kk = []; for (let lk = 0; lk <= 3.0001; lk += 0.05) kk.push(Math.pow(10, lk));
    pErr.setOptions({ y: [0, 10], x: [1, 1000] });
    pErr.set([
      { data: kk.map((k) => [k, Math.min(12, BAL_D / (minC * k * st2.curV / 1000) * 100)]), color: '#0E7490', label: `найменша наважка: ${st2.items.find((r) => r[1] === minC)[0]}, ${st2.curV} мл`, width: 2.4 },
      { data: [[st2.curK, Math.min(10, BAL_D / (minC * st2.curK * st2.curV / 1000) * 100)]], type: 'points', color: '#DC2626', label: 'ваш маточник', r: 6 },
    ], [{ y: 1, color: '#B91C1C', label: 'допуск 1 %' }]);
    // вердикт
    let cls = '', msg = '';
    if (S.key === 'macro' && si.SI > 0.3) { cls = 'is-bad'; msg = `<b>Ризик осаду.</b> У маточнику ${cur.k}× іони Ca²⁺ і SO₄²⁻ перевищують добуток розчинності гіпсу (SI = ${fnum(si.SI, 2)}). CaCl₂·2H₂O готують окремим маточником або розчиняють кожну сіль окремо в новій порції води (с. 56) і зливають у розведеному стані.`; }
    else if (err > 1) { cls = 'is-warn'; const r = cur.items.find((x) => x.mg === minMg); msg = `<b>Наважка ${r.n} — лише ${fmtMass(minMg)}:</b> аналітичні ваги з дискретністю 0,1 мг дають похибку ±${fnum(err, 1)} %. Збільште кратність чи об'єм маточника або приготуйте проміжний розчин (наприклад, 25 мг у 100 мл і відберіть аліквоту). Саме тому пописи ЛР 5–6 розраховано на мікросолі 1000× (1 мл на 1 л).`; }
    else if (S.key === 'macro' && si.SI > -0.2) { cls = 'is-warn'; msg = `<b>На межі розчинності:</b> SI = ${fnum(si.SI, 2)}. Маточник ${cur.k}× стабільний лише за ретельного перемішування; CaCl₂ вносьте останнім і зберігайте при +4 °C до 6 місяців (с. 56).`; }
    else { msg = S.key === 'horm' ? `<b>${cur.h.n}</b>: ${fmtMass(cur.items[0].mg)} на ${cur.V} мл (${fnum(S.hc, S.hc < 1 ? 1 : 0)} мг/мл): ${cur.h.solv}. Зберігати при +4 °C. 1 мл маточника на 1 л середовища дає ${fnum(S.hc, S.hc < 1 ? 1 : 0)} мг/л.` : `<b>Маточник ${STOCKS[S.key].name} ${cur.k}× готовий до розрахунку:</b> на 1 л середовища МС відбирають ${fnum(perL, perL < 1 ? 2 : 0)} мл. Найменша наважка ${fmtMass(minMg)} (похибка ±${fnum(err, 2)} %).`; }
    verdict.className = 'ag-verdict ' + cls; verdict.innerHTML = msg;
    draw();
  }

  function scaleOther(n, v) {
    const m = /^([\d,]+)\s*(г|мг|мл)/.exec(v);
    if (!m || n === 'pH') return '—';
    const x = parseFloat(m[1].replace(',', '.')) * S.Vm / 1000;
    return `${fnum(x, x < 10 ? 2 : 1)} ${m[2]}`;
  }

  /* ---------- сцена ---------- */
  const N_PER = 1.0; // с на компонент
  function draw() {
    const mob = cv.parentElement.clientWidth < 620;
    const { ctx, w, h } = fit(cv, { aspect: mob ? 1.0 : 2.1, min: 330, max: 470 });
    const hy = scene(ctx, w, h, { kind: 'bench', horizon: 0.86 });
    const t = performance.now() / 1000;
    const cur = current();
    const n = cur.items.length;
    const step = anim.step, f = anim.f;
    // ваги
    const bwid = mob ? w * 0.36 : Math.min(w * 0.2, 220);
    const bx = mob ? w * 0.04 : w * 0.04;
    let reading = 0, heap = 0;
    if (anim.phase === 'weigh' && step >= 0) { const r = cur.items[step]; const e = clamp(f / 0.6, 0, 1); reading = r.mg * (1 - Math.pow(1 - e, 3)); heap = clamp(e, 0, 1); }
    balance(ctx, bx, hy + 6, bwid, { reading: `${fnum(reading / 1000, reading >= 10000 ? 3 : 4)} g`, heap: heap * clamp(Math.log10(1 + (cur.items[Math.max(0, step)]?.mg || 1)) / 4.5, 0.15, 1), heapColor: S.key === 'fe' ? (step === 0 ? '#BFD8B0' : '#FFFFFF') : '#FFFFFF' });
    // мішалка + стакан
    const sx = mob ? w * 0.5 : w * 0.3, sw = mob ? w * 0.32 : Math.min(w * 0.17, 180);
    const on = anim.phase !== 'idle' && anim.phase !== 'done';
    const plate = stirrer(ctx, sx, hy + 6, sw, { on, t, hot: S.key === 'fe' && anim.phase === 'boil' ? 1 : S.key === 'horm' && on ? 0.4 : 0 });
    const done = anim.phase === 'done' || anim.phase === 'fill';
    const added = anim.phase === 'idle' ? 0 : clamp((step + (anim.phase === 'weigh' ? clamp((f - 0.6) / 0.4, 0, 1) : 1)) / n, 0, 1);
    const bkW = sw * 0.55, bkH = sw * 0.62;
    beaker(ctx, sx + (sw - bkW) / 2, plate - bkH, bkW, bkH, { liquid: { level: done ? 0.08 : 0.35 + 0.35 * added, color: S.key === 'fe' ? (added > 0.6 ? '#E2D58A' : '#DDE9EC') : '#DDE9EC', bubbles: on ? 6 : 0, t }, label: mob ? '' : 'стакан' });
    if (on && !done) { // вир і мішальник
      ctx.save(); const mx = sx + sw / 2, my = plate - 5; ctx.translate(mx, my); ctx.rotate(t * 9); ctx.fillStyle = '#F5F5F0'; roundRect(ctx, -bkW * 0.18, -2, bkW * 0.36, 4, 2); ctx.fill(); ctx.restore();
    }
    // мірна колба
    const vx = mob ? w * 0.86 : w * 0.53, vs = mob ? w * 0.18 : Math.min(w * 0.1, 96);
    const lvl = anim.phase === 'fill' ? 1 + clamp(f, 0, 1) : anim.phase === 'done' ? 2 : 0;
    volumetric(ctx, vx, hy + 4, vs, { level: lvl, color: S.key === 'fe' ? '#E2D58A' : '#E3EEF0', label: `${cur.V >= 1000 ? cur.V / 1000 + ' л' : cur.V}`, t, swirl: anim.phase === 'fill' ? 0.8 : 0 });
    // пляшки з темного скла
    if (!mob) {
      const keys = ['macro', 'micro', 'fe', 'vit', 'horm'];
      const bw2 = Math.min(w * 0.065, 62), gap = bw2 * 0.25, x0 = w - (bw2 + gap) * keys.length - w * 0.02;
      keys.forEach((k, i) => {
        const sel = k === S.key, hh = bw2 * (k === 'macro' ? 2.3 : 1.9);
        const lab = k === 'horm' ? HORMONES.find((x) => x.id === S.horm).n : STOCKS[k].short;
        const sub = k === 'horm' ? `${fnum(S.hc, S.hc < 1 ? 1 : 0)} мг/мл` : `${STOCKS[k].curK}×`;
        darkBottle(ctx, x0 + i * (bw2 + gap), hy + 6, bw2, hh, { label: lab, sub, fill: sel && anim.phase !== 'done' ? 0 : 0.75 });
        if (sel) { ctx.save(); ctx.strokeStyle = 'rgba(212,160,23,.95)'; ctx.lineWidth = 2; roundRect(ctx, x0 + i * (bw2 + gap) - 4, hy + 6 - hh - 6, bw2 + 8, hh + 12, 8); ctx.stroke(); ctx.restore(); }
      });
    }
    // HUD
    let msg = 'Натисніть ▶ Запустити — приготуємо маточник';
    if (anim.phase === 'weigh') msg = `Зважування: ${cur.items[step].n} — ${fmtMass(cur.items[step].mg)}`;
    else if (anim.phase === 'boil') msg = 'Злити розчини FeSO₄ і Na₂ЕДТА, довести до кипіння';
    else if (anim.phase === 'fill') msg = `Перенести в мірну колбу, довести до мітки (${cur.V} мл)`;
    else if (anim.phase === 'done') msg = 'Готово: у темну пляшку, +4 °C, до 6 міс.';
    hud.innerHTML = `<span>${msg}</span>`;
    if (mob) chip(ctx, w / 2, 24, cur.st ? `${cur.st.name} ${cur.k}×` : `${cur.h.n} ${fnum(S.hc, 1)} мг/мл`, { size: 12, dark: true });
  }

  const runner = new Runner({
    btn: $('.ag-run'), reset: $('[data-act="reset"]'),
    step: (dt, tt, reset) => {
      if (reset) { anim = { step: -1, f: 0, phase: 'idle' }; recalc(); return; }
      const n = current().items.length;
      if (anim.phase === 'idle') anim = { step: 0, f: 0, phase: 'weigh' };
      anim.f += dt / N_PER;
      if (anim.phase === 'weigh' && anim.f >= 1) { anim.f = 0; anim.step++; if (anim.step >= n) { anim.step = n - 1; anim.phase = S.key === 'fe' ? 'boil' : 'fill'; } recalc(); return; }
      if (anim.phase === 'boil' && anim.f >= 1.4) { anim.f = 0; anim.phase = 'fill'; }
      if (anim.phase === 'fill' && anim.f >= 1.2) { anim.phase = 'done'; anim.step = -1; recalc(); runner.finish(); return; }
      draw();
    },
    draw: () => draw(),
  });
  buildFold();
  onResize(cv.parentElement, () => draw());
  recalc();
  return { redraw: () => draw() };
}
