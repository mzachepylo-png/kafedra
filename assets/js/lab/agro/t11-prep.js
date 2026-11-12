// ЛР 45–48. Препаративне виділення нуклеїнових кислот: нарощування й ампліфікація
// плазміди, лізис, депротеїнізація фенол — хлороформом, осадження спиртом.

import {
  fit, scene, flask, beaker, roundRect, rgba, clamp, lerp, fnum, Plot, sliders, segmented,
  setOut, Runner, onResize, $, rng, TAU, shadow, MAT,
} from './kit.js';
import {
  shaker, centrifuge, waterBath, eppendorf, dnaThreads, arrow, chip,
} from './t11-draw.js';
import {
  prepState, copyNumber, od600, timeToOD, precipitation, spectroState, boilingLysis, PBR322_BP,
} from './t11-model.js';

const STAGES = [
  { id: 0, name: 'Нарощування', sub: { plasmid: 'Нічна культура E. coli в LB з ампіциліном, +37 °C', tissue: 'Розтирання тканини в ступці з рідким азотом' } },
  { id: 1, name: 'Лізис', sub: { plasmid: 'Лізоцим і 100 °C — руйнування клітинної стінки', tissue: 'Буфер із сечовиною, ЕДТО, тріс-HCl, фенол і ДДС-Na' } },
  { id: 2, name: 'Депротеїнізація', sub: { plasmid: 'Центрифугування 14 000 об/хв, 10 хв', tissue: 'Фенол : хлороформ : ізоаміловий спирт (75 : 24 : 1)' } },
  { id: 3, name: 'Осадження', sub: { plasmid: 'Ацетат натрію й ізопропанол, сухий лід', tissue: '2 об’єми етанолу, −20 °C' } },
];

export function initPrep(bus) {
  const canvas = $('t11b-canvas');
  if (!canvas) return;
  const state = {
    sample: 'plasmid', tissue: 'leaf', nitrogen: true, cm: true,
    mass: 7.5, ampliH: 14, lysisSec: 40, deprot: 2, precipMin: 30, stage: 0, prog: 0,
  };

  const segSample = segmented($('t11b-sample'), 'sample', [
    { value: 'plasmid', label: 'Плазмідна ДНК <small>(ЛР 46–47)</small>' },
    { value: 'nuclear', label: 'Ядерна ДНК <small>(ЛР 45)</small>' },
    { value: 'rna', label: 'Тотальна РНК <small>(ЛР 48)</small>' },
  ], state.sample, (v) => { state.sample = v; syncCtrls(); runner.reset(); });

  const segOpt = segmented($('t11b-opt'), 'opt', [
    { value: 'yes', label: 'За посібником' },
    { value: 'no', label: 'Пропустити крок' },
  ], 'yes', (v) => {
    if (state.sample === 'plasmid') state.cm = v === 'yes';
    else state.nitrogen = v === 'yes';
    recompute();
  });

  const ui = sliders($('t11b-sliders'), [
    { id: 'mass', label: 'Наважка тканини', min: 1, max: 15, step: 0.5, value: state.mass, unit: 'г', digits: 1, hint: 'ЛР 45 — 5–10 г листків або калюсу; ЛР 48 — 1 г.' },
    { id: 'ampliH', label: 'Ампліфікація з хлорамфеніколом', min: 0, max: 20, step: 0.5, value: state.ampliH, unit: 'год', digits: 1, hint: 'ЛР 46 — 12–16 год при +37 °C на качалці.' },
    { id: 'lysisSec', label: 'Кип’ятіння на водяній бані (100 °C)', min: 0, max: 120, step: 5, value: state.lysisSec, unit: 'с', digits: 0, hint: 'ЛР 47 — рівно 40 с: довше — ДНК денатурує й фрагментується.' },
    { id: 'deprot', label: 'Кількість депротеїнізацій', min: 0, max: 3, step: 1, value: state.deprot, unit: '×', digits: 0, hint: 'ЛР 45 — двократна обробка сумішшю фенол : хлороформ : ізоаміловий спирт.' },
    { id: 'precipMin', label: 'Витримка при −20 °C (осадження спиртом)', min: 0, max: 120, step: 5, value: state.precipMin, unit: 'хв', digits: 0, hint: 'ЛР 45 — 30 хв; ЛР 48 — 2 год, потім переосадження при −70 °C.' },
  ], (id) => { state[id] = ui.values[id]; recompute(); });
  for (const k of ['mass', 'ampliH', 'lysisSec', 'deprot', 'precipMin']) state[k] = ui.values[k];

  const plotK = new Plot($('t11b-plot1'), { xLabel: 'Час, год', yLabel: 'Копій на клітину', xShort: 't', x: [0, 20], y: 'auto', aspect: 1.6 });
  const plotR = new Plot($('t11b-plot2'), {
    xLabel: 'Кількість депротеїнізацій', yLabel: 'D₂₆₀ / D₂₈₀', xShort: 'n',
    x: [0, 3], y: [0.8, 2.2], yZero: false, aspect: 1.6, xFmt: (v) => fnum(v, 0),
  });

  function syncCtrls() {
    const pl = state.sample === 'plasmid';
    ui.inputs.mass.row.classList.toggle('is-disabled', pl);
    ui.inputs.ampliH.row.classList.toggle('is-disabled', !pl);
    ui.inputs.lysisSec.row.classList.toggle('is-disabled', !pl);
    const lab = $('t11b-optlabel');
    if (lab) lab.textContent = pl ? 'Хлорамфенікол (ампліфікація плазміди)' : 'Розтирання з рідким азотом';
    const cur = pl ? state.cm : state.nitrogen;
    segOpt.select(cur ? 'yes' : 'no', false);
  }
  syncCtrls();

  let m = null, spec = null;
  const VOL = { plasmid: 1.0, nuclear: 1.0, rna: 0.5 };   // мл буфера ТЕ / води для розчинення осаду

  function recompute() {
    m = prepState({ ...state, cultureMl: 500 });
    const volMl = VOL[state.sample];
    const C0 = m.yieldUg / volMl;        // мкг/мл у готовому препараті
    const type = state.sample === 'rna' ? 'rna' : 'dna';
    const K = clamp(Math.round(C0 / 25 / 5) * 5, 5, 200) || 5;
    spec = spectroState({ type, C0, protRatio: m.protRatio, phenolUgMl: m.phenolUgMl, K });
    const copies = state.sample === 'plasmid' ? copyNumber(state.ampliH, { cm: state.cm }) : NaN;

    setOut($('t11b-reads'), {
      stage: STAGES[Math.min(3, Math.floor(state.stage))].name,
      copies: state.sample === 'plasmid' ? fnum(copies, 0) : '—',
      yield: fnum(m.yieldUg, m.yieldUg < 100 ? 1 : 0) + ' мкг',
      conc: fnum(C0, C0 < 100 ? 1 : 0) + ' мкг/мл',
      ratio: fnum(spec.R, 2),
      degraded: fnum(m.degraded * 100, 0) + ' %',
    });

    const v = $('t11b-verdict');
    let cls = '', txt = '';
    const lys = boilingLysis(state.lysisSec);
    if (state.sample === 'plasmid' && !state.cm) {
      txt = `<b>Без хлорамфеніколу</b> копійність лишається базовою (${fnum(copies, 0)} копій на клітину): вихід ${fnum(m.yieldUg, 0)} мкг замість кількох сотень мікрограмів. Саме для цього в ЛР 46 культуру в логарифмічній фазі (D₆₀₀ = 0,4) обробляють хлорамфеніколом — синтез білка спиняється, поділ клітин зупиняється, а релаксована плазміда продовжує реплікуватися.`;
      cls = ' is-warn';
    } else if (state.sample === 'plasmid' && lys.damage > 0.4) {
      txt = `<b>Перегрів під час лізису.</b> ${fnum(state.lysisSec, 0)} с при 100 °C — удвічі-втричі довше за протокол: ${fnum(m.degraded * 100, 0)} % ДНК необоротно денатурує й фрагментується, вихід падає до ${fnum(m.yieldUg, 0)} мкг. У ЛР 47 пробірку тримають на киплячій бані рівно 40 секунд.`;
      cls = ' is-bad';
    } else if (state.sample === 'plasmid' && lys.release < 0.6) {
      txt = `<b>Клітини лізовані не повністю</b> (${fnum(lys.release * 100, 0)} % від можливого): плазміда лишилася всередині бактерій. Збільште час кип’ятіння до 40 с.`;
      cls = ' is-warn';
    } else if (!state.nitrogen && state.sample !== 'plasmid') {
      txt = `<b>Без розтирання з рідким азотом</b> клітинні стінки руйнуються гірше, а власні нуклеази встигають подіяти: вихід менший на 45 %, деградовано ${fnum(m.degraded * 100, 0)} % препарату. Рідкий азот (−196 °C) миттєво заморожує тканину й інактивує ферменти (ЛР 45, п. 2).`;
      cls = ' is-bad';
    } else if (spec.R < (type === 'dna' ? 1.7 : 1.85)) {
      txt = `<b>Препарат забруднений білком і фенолом:</b> D₂₆₀/D₂₈₀ = ${fnum(spec.R, 2)} замість ${type === 'dna' ? '1,8' : '2,0'}. Залишковий білок — ${fnum(m.protRatio * 100, 0)} % від маси нуклеїнової кислоти. Повторіть депротеїнізацію: у ЛР 45 вона двократна.`;
      cls = ' is-bad';
    } else if (m.recovery < 0.8) {
      txt = `Осадження неповне: за ${fnum(state.precipMin, 0)} хв при −20 °C у осад перейшло ${fnum(m.recovery * 100, 0)} % нуклеїнової кислоти. За протоколом витримують щонайменше 30 хв.`;
      cls = ' is-warn';
    } else {
      txt = `Препарат придатний до роботи: ${fnum(m.yieldUg, 0)} мкг у ${fnum(volMl * 1000, 0)} мкл (${fnum(C0, 0)} мкг/мл), D₂₆₀/D₂₈₀ = ${fnum(spec.R, 2)}. Далі — гель-електрофорез (ЛР 47 п. 12, ЛР 49) і кількісне визначення на спектрофотометрі (ЛР 50).`;
      cls = '';
    }
    v.className = 'ag-verdict' + cls;
    v.innerHTML = txt;

    // графіки
    if (state.sample === 'plasmid') {
      const a = [], b = [];
      for (let t = 0; t <= 20; t += 0.25) { a.push([t, copyNumber(t, { cm: true })]); b.push([t, copyNumber(t, { cm: false })]); }
      plotK.setOptions({ xLabel: 'Час після внесення хлорамфеніколу, год', yLabel: 'Копій плазміди на клітину', x: [0, 20] });
      plotK.set([
        { data: a, color: '#2E7D5B', width: 2.6, fill: 'rgba(46,125,91,.1)', label: 'З хлорамфеніколом', marker: [state.ampliH, copyNumber(state.ampliH, { cm: true })] },
        { data: b, color: '#B08A1E', width: 2.2, dash: [6, 4], label: 'Без хлорамфеніколу' },
      ], [{ x: state.ampliH, color: 'rgba(30,70,45,.45)', label: `${fnum(state.ampliH, 1)} год` }]);
    } else {
      const a = [];
      for (let t = 0; t <= 120; t += 2) a.push([t, precipitation(t) * 100]);
      plotK.setOptions({ xLabel: 'Витримка при −20 °C, хв', yLabel: 'Перейшло в осад, %', x: [0, 120] });
      plotK.set([
        { data: a, color: '#2E7D5B', width: 2.6, fill: 'rgba(46,125,91,.1)', label: 'Повнота осадження спиртом', marker: [state.precipMin, precipitation(state.precipMin) * 100] },
      ], [{ x: 30, color: '#B08A1E', dash: [4, 4], label: '30 хв (ЛР 45)' }]);
    }

    const pts = [];
    for (let k = 0; k <= 3; k += 0.05) {
      const p = prepState({ ...state, deprot: k });
      const s = spectroState({ type, C0: p.yieldUg / volMl, protRatio: p.protRatio, phenolUgMl: p.phenolUgMl, K });
      pts.push([k, s.R]);
    }
    plotR.set([
      { data: pts, color: '#2E7D5B', width: 2.6, label: 'Чистота препарату', marker: [state.deprot, spec.R] },
    ], [
      { y: type === 'dna' ? 1.8 : 2.0, color: '#B08A1E', label: type === 'dna' ? 'чиста ДНК 1,8' : 'чиста РНК 2,0' },
      { x: 2, color: 'rgba(30,70,45,.35)', dash: [4, 4], label: 'протокол: 2×' },
    ]);

    if (bus) bus.prep = { type, C0, protRatio: m.protRatio, phenolUgMl: m.phenolUgMl, yieldUg: m.yieldUg, volMl, degraded: m.degraded, sample: state.sample };
    draw();
  }

  /* ---------- сцена: конвеєр із чотирьох станцій ---------- */
  function draw() {
    if (!canvas.parentElement || canvas.parentElement.clientWidth < 80) return;
    const narrow = canvas.parentElement.clientWidth < 620;
    const { ctx, w, h } = fit(canvas, { aspect: narrow ? 1.0 : 1.62, min: 300, max: 540 });
    const t = runner ? runner.t : 0;
    scene(ctx, w, h, { kind: 'bench', horizon: narrow ? 0.5 : 0.56 });
    const pl = state.sample === 'plasmid';
    const act = state.stage;

    // чотири станції: у рядок (десктоп) або 2×2 (телефон)
    const cells = [];
    let unit;
    if (narrow) {
      unit = Math.min(w * 0.4, h * 0.3);
      const bx = [w * 0.27, w * 0.74], by = [h * 0.44, h * 0.9];
      for (let i = 0; i < 4; i++) cells.push([bx[i % 2], by[i >> 1]]);
    } else {
      unit = Math.min(w * 0.215, h * 0.5);
      const by = h * 0.82;
      for (let i = 0; i < 4; i++) cells.push([w * (0.13 + i * 0.247), by]);
    }

    // стрілки потоку — за об'єктами
    for (let i = 0; i < 3; i++) {
      const [x1, y1] = cells[i], [x2, y2] = cells[i + 1];
      if (narrow && i === 1) {
        // перехід з верхнього рядка в нижній — праворуч, повз об'єкти
        const mx = Math.min(w - 10, x1 + unit * 0.78);
        arrow(ctx, mx, y1 - unit * 0.3, mx, y2 - unit * 1.05, { color: 'rgba(30,70,45,.28)', dash: [5, 4] });
      } else {
        const yy = y1 - unit * 1.12;
        arrow(ctx, x1 + unit * 0.42, yy, x2 - unit * 0.42, yy, { color: 'rgba(30,70,45,.3)' });
      }
    }

    for (let i = 0; i < 4; i++) {
      const [cx, by] = cells[i];
      const activeK = clamp(1 - Math.abs(act - i), 0, 1);
      if (activeK > 0.02) {
        ctx.save();
        const g = ctx.createRadialGradient(cx, by - unit * 0.42, unit * 0.1, cx, by - unit * 0.42, unit * 0.95);
        g.addColorStop(0, `rgba(255,232,150,${0.55 * activeK})`);
        g.addColorStop(1, 'rgba(255,232,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - unit, by - unit * 1.5, unit * 2, unit * 1.9);
        ctx.restore();
      }
      drawStation(ctx, i, cx, by, unit, t, activeK);
      chip(ctx, cx, by + (narrow ? 16 : 20), `${i + 1}. ${STAGES[i].name}`, { size: narrow ? 9.5 : 11 });
    }
    // підпис поточного кроку
    const sTxt = STAGES[Math.min(3, Math.floor(act))].sub[pl ? 'plasmid' : 'tissue'];
    chip(ctx, 10, 20, sTxt, { align: 'left', size: narrow ? 9.5 : 11.5 });
  }

  function drawStation(ctx, i, cx, by, unit, t, active) {
    const pl = state.sample === 'plasmid';
    const run = runner && runner.running;
    if (i === 0) {
      if (pl) {
        const od = state.cm ? 0.4 : od600(timeToOD(0.4) + state.ampliH * active);
        const sh = shaker(ctx, cx, by, unit * 0.9, { phase: t * 5, on: run && active > 0.3, label: '' });
        flask(ctx, sh.px, sh.py + 2, unit * 0.62, {
          liquid: { level: 0.5, color: '#E8E2BC', cloudy: clamp(od / 1.2, 0.15, 1), swirl: run && active > 0.3 ? 1 : 0 },
          plug: 'foil', t,
        });
        chip(ctx, cx, by - unit * 0.98, `D₆₀₀ = ${fnum(od, 2)}`, { size: 10.5 });
      } else {
        mortar(ctx, cx, by, unit * 0.86, { t, frost: state.nitrogen, active });
      }
    } else if (i === 1) {
      if (pl) {
        const wb = waterBath(ctx, cx, by, unit * 0.92, { temp: 100, boil: active > 0.3 ? 1 : 0.2, t, label: '' });
        eppendorf(ctx, cx + unit * 0.06, wb.innerTop - unit * 0.46, unit * 0.18, unit * 0.74, {
          liquid: 0.72, color: '#DDE7D4', cloudy: 0.4, open: false,
        });
        chip(ctx, cx + unit * 0.06, wb.innerTop - unit * 0.54, `${fnum(state.lysisSec, 0)} с`, { size: 10.5 });
      } else {
        // лізис у буфері: пробірка з гомогенатом
        eppendorf(ctx, cx, by - unit * 0.78, unit * 0.26, unit * 0.78, {
          liquid: 0.78, color: '#CFD6A8', cloudy: 0.75, open: active > 0.5, label: '',
        });
        chip(ctx, cx, by - unit * 0.92, 'ДДС-Na + фенол', { size: 10.5 });
      }
    } else if (i === 2) {
      centrifuge(ctx, cx - unit * 0.26, by, unit * 0.62, { spin: t * 14, rpm: run && active > 0.3 ? (pl ? 14000 : 5000) : 0, open: !run && active > 0.5 });
      const tubeW = unit * 0.2, tubeH = unit * 0.6;
      const phase = clamp(active, 0, 1);
      eppendorf(ctx, cx + unit * 0.42, by - tubeH - unit * 0.04, tubeW, tubeH, {
        liquid: 0.84,
        color: '#E3EADD',
        pellet: phase * 0.8,
        pelletColor: pl ? '#D7E0BE' : '#C9CBA0',
        layers: state.deprot > 0 && phase > 0.4 ? [
          { f: 0.46, color: '#E9F0E6' },   // водна фаза з НК
          { f: 0.1, color: '#F2E9C8' },    // інтерфаза з білком
          { f: 0.44, color: '#E8D59A' },   // фенол — хлороформ
        ] : null,
      });
      if (state.deprot > 0 && phase > 0.4) {
        chip(ctx, cx + unit * 0.42, by - tubeH - unit * 0.12, 'водна фаза', { size: 9.5 });
      }
    } else {
      const tubeH = unit * 0.74, tubeW = unit * 0.26;
      const topY = by - tubeH;
      const rec = m ? m.recovery : 0;
      eppendorf(ctx, cx, topY, tubeW, tubeH, {
        liquid: 0.8, color: '#EAF1F4', pellet: active * rec * 0.9,
        pelletColor: state.sample === 'rna' ? '#EFEFE2' : '#F3F4E6',
      });
      if (active > 0.25) dnaThreads(ctx, cx, topY + tubeH * 0.45, tubeW * 0.72, { amount: active * rec, seed: 6, t });
      chip(ctx, cx, by - tubeH - unit * 0.1, state.sample === 'plasmid' ? 'ізопропанол' : '2 об’єми етанолу', { size: 10 });
      if (m) chip(ctx, cx + unit * 0.24, by - tubeH * 0.42, `${fnum(m.yieldUg, m.yieldUg < 100 ? 1 : 0)} мкг`, { size: 10.5, align: 'left' });
    }
  }

  /** Фарфорова ступка з товкачиком і парою рідкого азоту. */
  function mortar(ctx, cx, by, w, { t = 0, frost = true, active = 0 } = {}) {
    const h = w * 0.46;
    shadow(ctx, cx + w * 0.05, by + 2, w * 0.5, w * 0.07, 0.3);
    ctx.save();
    const g = ctx.createLinearGradient(cx - w / 2, by - h, cx + w / 2, by);
    g.addColorStop(0, '#CFD3CE'); g.addColorStop(0.3, '#F7F8F5'); g.addColorStop(0.75, '#DFE3DD'); g.addColorStop(1, '#A9B0AA');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, by - h);
    ctx.quadraticCurveTo(cx - w * 0.46, by, cx - w * 0.2, by);
    ctx.lineTo(cx + w * 0.2, by);
    ctx.quadraticCurveTo(cx + w * 0.46, by, cx + w / 2, by - h);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,80,70,.3)'; ctx.lineWidth = 1; ctx.stroke();
    // вміст
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, by - h, w * 0.5, w * 0.1, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = frost ? '#D7E4CB' : '#9FB97E';
    ctx.beginPath(); ctx.ellipse(cx, by - h + 3, w * 0.42, w * 0.085, 0, 0, TAU); ctx.fill();
    const R = rng(3);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = frost ? 'rgba(255,255,255,.75)' : 'rgba(90,120,60,.5)';
      ctx.beginPath();
      ctx.arc(cx + (R() - 0.5) * w * 0.8, by - h + 3 + (R() - 0.5) * w * 0.14, 0.7 + R() * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // вінця
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(cx, by - h, w * 0.5, w * 0.1, 0, 0, TAU); ctx.stroke();
    // товкачик
    ctx.save();
    ctx.translate(cx + Math.sin(t * 3) * w * 0.08, by - h - w * 0.02);
    ctx.rotate(0.35 + Math.sin(t * 3) * 0.08);
    const pg = ctx.createLinearGradient(-w * 0.05, 0, w * 0.05, 0);
    pg.addColorStop(0, '#B8BEB7'); pg.addColorStop(0.4, '#F6F7F4'); pg.addColorStop(1, '#A4ABA4');
    ctx.fillStyle = pg;
    roundRect(ctx, -w * 0.045, -w * 0.5, w * 0.09, w * 0.5, w * 0.04); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.075, w * 0.05, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // пара рідкого азоту
    if (frost) {
      for (let i = 0; i < 7; i++) {
        const ph = (t * 0.5 + i * 0.17) % 1;
        ctx.fillStyle = `rgba(235,246,250,${0.3 * (1 - ph) * (0.4 + active)})`;
        ctx.beginPath();
        ctx.ellipse(cx + (i - 3) * w * 0.12 + Math.sin(t + i) * 4, by - h - ph * w * 0.5,
          w * (0.07 + ph * 0.06), w * (0.05 + ph * 0.05), 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------- запуск ---------- */
  const runner = new Runner({
    btn: $('t11b-run'),
    reset: $('t11b-reset'),
    speed: 0.5,                   // 1 стадія ≈ 2 с
    step: (dt, time, reset) => {
      state.stage = reset ? 0 : clamp(time, 0, 3.999);
      if (!reset && time >= 4) { state.stage = 3.999; runner.finish(); }
      recompute();
      const st = $('t11b-status');
      const i = Math.min(3, Math.floor(state.stage));
      if (st) st.textContent = `${i + 1}/4 · ${STAGES[i].name}: ${STAGES[i].sub[state.sample === 'plasmid' ? 'plasmid' : 'tissue']}`;
    },
    draw,
  });
  runner.reset();
  onResize(canvas.parentElement, draw);

  const send = $('t11b-send');
  if (send) send.addEventListener('click', () => {
    if (bus && bus.onSend) bus.onSend();
  });
  return { recompute, draw };
}
