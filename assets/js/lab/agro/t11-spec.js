// ЛР 50. Кількісне визначення ДНК і РНК спектрофотометрично:
// сканування спектра 220–320 нм, D260/D280, розрахунок концентрації.

import {
  fit, scene, roundRect, clamp, lerp, fnum, Plot, sliders, segmented, setOut, Runner, onResize, $, TAU,
} from './kit.js';
import { spectro, chip } from './t11-draw.js';
import { spectroState, NA_FACTOR, PURE_RATIO } from './t11-model.js';

const L0 = 220, L1 = 320;

export function initSpec(bus) {
  const canvas = $('t11d-canvas');
  if (!canvas) return;
  const state = { type: 'dna', C0: 500, prot: 15, phenol: 0, K: 50, lam: 260, scanning: false };

  const segType = segmented($('t11d-type'), 'type', [
    { value: 'dna', label: 'ДНК <small>(1 од. = 50 мкг/мл)</small>' },
    { value: 'rna', label: 'РНК <small>(1 од. = 40 мкг/мл)</small>' },
  ], state.type, (v) => { state.type = v; recompute(); });

  const ui = sliders($('t11d-sliders'), [
    { id: 'C0', label: 'Концентрація нуклеїнової кислоти у препараті', min: 10, max: 3000, step: 10, value: state.C0, unit: 'мкг/мл', digits: 0 },
    { id: 'prot', label: 'Залишковий білок у препараті', min: 0, max: 1500, step: 5, value: state.prot, unit: 'мкг/мл', digits: 0, hint: 'Ароматичні амінокислоти (триптофан, тирозин) поглинають при 280 нм і занижують відношення D₂₆₀/D₂₈₀.' },
    { id: 'phenol', label: 'Залишковий фенол', min: 0, max: 40, step: 1, value: state.phenol, unit: 'мкг/мл', digits: 0, hint: 'Фенол має максимум поглинання при 270 нм — завищує D₂₆₀ і псує відношення D₂₆₀/D₂₃₀.' },
    { id: 'K', label: 'Кратність розведення проби в кюветі', min: 1, max: 200, step: 1, value: state.K, unit: '×', digits: 0, hint: 'Робочий діапазон приладу: D₂₆₀ від 0,1 до 1,0 — у ньому закон Бугера — Ламберта — Бера лінійний.' },
  ], (id) => { state[id] = ui.values[id]; recompute(); });
  for (const k of ['C0', 'prot', 'phenol', 'K']) state[k] = ui.values[k];

  const plotSpec = new Plot($('t11d-plot1'), {
    xLabel: 'Довжина хвилі λ, нм', yLabel: 'Оптична густина D', xShort: 'λ',
    x: [L0, L1], y: 'auto', aspect: 1.6,
  });
  const plotK = new Plot($('t11d-plot2'), {
    xLabel: 'Кратність розведення K', yLabel: 'D₂₆₀ у кюветі', xShort: 'K',
    x: [1, 200], y: 'auto', aspect: 1.6,
  });

  document.querySelectorAll('[data-t11d-preset]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.t11dPreset;
    if (p === 'puredna') { segType.select('dna', false); state.type = 'dna'; ui.set('C0', 500, true); ui.set('prot', 0, true); ui.set('phenol', 0, true); ui.set('K', 50, true); }
    if (p === 'purerna') { segType.select('rna', false); state.type = 'rna'; ui.set('C0', 400, true); ui.set('prot', 0, true); ui.set('phenol', 0, true); ui.set('K', 40, true); }
    if (p === 'protein') { segType.select('dna', false); state.type = 'dna'; ui.set('C0', 500, true); ui.set('prot', 900, true); ui.set('phenol', 0, true); ui.set('K', 50, true); }
    if (p === 'phenol') { ui.set('phenol', 20, true); }
    if (p === 'overrange') { ui.set('K', 2, true); }
    for (const k of ['C0', 'prot', 'phenol', 'K']) state[k] = ui.values[k];
    recompute();
  }));

  /** Завантажити пробу з моделі виділення (вкладка Б). */
  function load(prep) {
    if (!prep) return;
    state.type = prep.type;
    segType.select(prep.type, false);
    ui.set('C0', clamp(Math.round(prep.C0), 10, 3000), true);
    ui.set('prot', clamp(Math.round(prep.C0 * prep.protRatio), 0, 1500), true);
    ui.set('phenol', clamp(Math.round(prep.phenolUgMl), 0, 40), true);
    const K = clamp(Math.round(prep.C0 / (0.5 * NA_FACTOR[prep.type])), 1, 200);
    ui.set('K', K, true);
    for (const k of ['C0', 'prot', 'phenol', 'K']) state[k] = ui.values[k];
    recompute();
  }

  let s = null;
  function recompute() {
    s = spectroState({
      type: state.type, C0: state.C0,
      protRatio: state.C0 > 0 ? state.prot / state.C0 : 0,
      phenolUgMl: state.phenol, K: state.K,
    });
    const k = NA_FACTOR[state.type];
    setOut($('t11d-reads'), {
      d260: fnum(s.D260, 3),
      d280: fnum(s.D280, 3),
      d230: fnum(s.D230, 3),
      ratio: fnum(s.R, 2),
      ratio230: fnum(s.R230, 2),
      conc: fnum(s.Ccalc, s.Ccalc < 100 ? 1 : 0) + ' мкг/мл',
    });
    const formula = $('t11d-formula');
    if (formula) {
      formula.innerHTML = `C = D<sub>260</sub> · ${k} · K = ${fnum(s.D260, 3)} · ${k} · ${fnum(state.K, 0)} = <b>${fnum(s.Ccalc, s.Ccalc < 100 ? 1 : 0)} мкг/мл</b> (${fnum(s.Ccalc / 1000, 3)} мг/мл)`;
    }

    const v = $('t11d-verdict');
    let cls = '', txt = '';
    const pure = PURE_RATIO[state.type];
    if (!s.inRange) {
      txt = s.D260 > 1
        ? `<b>Поза робочим діапазоном приладу:</b> D₂₆₀ = ${fnum(s.D260, 2)} > 1,0. При такому поглинанні закон Бугера — Ламберта — Бера вже нелінійний, і розрахована концентрація занижена. Розведіть пробу сильніше (збільште K приблизно до ${fnum(Math.ceil(state.K * s.D260 / 0.5), 0)}).`
        : `<b>Надто розведена проба:</b> D₂₆₀ = ${fnum(s.D260, 3)} < 0,1 — похибка вимірювання стає більшою за сам сигнал. Зменште кратність розведення.`;
      cls = ' is-bad';
    } else if (s.R < pure - 0.1) {
      txt = `<b>Препарат забруднений.</b> D₂₆₀/D₂₈₀ = ${fnum(s.R, 2)} замість ${fnum(pure, 1)}: у пробі є білок або фенол (посібник, с. 183). Розрахована концентрація ${fnum(s.Ccalc, 0)} мкг/мл завищена на ${fnum(s.error * 100, 0)} % — поглинають і домішки. Потрібна додаткова депротеїнізація й переосадження спиртом.`;
      cls = ' is-bad';
    } else if (s.R230 < 1.8) {
      txt = `Відношення D₂₆₀/D₂₃₀ = ${fnum(s.R230, 2)} (норма ≥ 2,0) — ознака залишкового фенолу або солей, хоча D₂₆₀/D₂₈₀ ще в нормі. Переосадіть препарат спиртом.`;
      cls = ' is-warn';
    } else if (s.R > pure + 0.12 && state.type === 'dna') {
      txt = `D₂₆₀/D₂₈₀ = ${fnum(s.R, 2)} вище за 1,8 — у препараті ДНК домішка РНК (у неї відношення 2,0). Обробіть пробу РНКазою, як у ЛР 47, п. 9.`;
      cls = ' is-warn';
    } else {
      txt = `<b>Препарат чистий:</b> D₂₆₀/D₂₈₀ = ${fnum(s.R, 2)} ≈ ${fnum(pure, 1)}, D₂₆₀ у робочому діапазоні. Концентрація у вихідному розчині C = D₂₆₀ · ${k} · K = ${fnum(s.Ccalc, 0)} мкг/мл; у ${fnum(state.K, 0)} разів розведена проба в кюветі містить ${fnum(s.naCuv, 1)} мкг/мл.`;
      cls = '';
    }
    v.className = 'ag-verdict' + cls;
    v.innerHTML = txt;

    // спектр
    const cur = [], ref = [];
    const pureS = spectroState({ type: state.type, C0: state.C0, protRatio: 0, phenolUgMl: 0, K: state.K });
    for (let l = L0; l <= L1; l += 1) {
      cur.push([l, s.at(l)]);
      ref.push([l, pureS.at(l)]);
    }
    const shown = state.scanning ? cur.filter((p) => p[0] <= state.lam) : cur;
    plotSpec.set([
      { data: ref, color: '#B08A1E', width: 1.8, dash: [6, 4], label: 'Чистий препарат (без домішок)' },
      { data: shown, color: '#2E7D5B', width: 2.6, fill: 'rgba(46,125,91,.12)', label: 'Досліджувана проба', marker: [clamp(state.lam, L0, L1), s.at(clamp(state.lam, L0, L1))] },
    ], [
      { x: 260, color: '#2E7D5B', dash: [3, 3], label: '260 нм' },
      { x: 280, color: '#C2410C', dash: [3, 3], label: '280 нм' },
      { x: 230, color: '#6B7280', dash: [2, 4], label: '230 нм' },
    ]);

    // вибір розведення
    const kk = [];
    for (let K = 1; K <= 200; K += 1) {
      kk.push([K, spectroState({ type: state.type, C0: state.C0, protRatio: state.C0 > 0 ? state.prot / state.C0 : 0, phenolUgMl: state.phenol, K }).D260]);
    }
    plotK.set([
      { data: kk, color: '#2E7D5B', width: 2.4, label: 'D₂₆₀ залежно від розведення', marker: [state.K, s.D260] },
    ], [
      { y: 1.0, color: '#B23A2A', label: 'верхня межа 1,0' },
      { y: 0.1, color: '#B08A1E', label: 'нижня межа 0,1' },
      { x: state.K, color: 'rgba(30,70,45,.4)', dash: [4, 4], label: `K = ${fnum(state.K, 0)}` },
    ]);
    draw();
  }

  /* ---------- сцена ---------- */
  function draw() {
    if (!canvas.parentElement || canvas.parentElement.clientWidth < 80) return;
    const narrow = canvas.parentElement.clientWidth < 620;
    const { ctx, w, h } = fit(canvas, { aspect: narrow ? 1.08 : 1.74, min: 300, max: 500 });
    if (!s) return;
    scene(ctx, w, h, { kind: 'bench', horizon: narrow ? 0.46 : 0.68 });
    const lam = clamp(state.lam, L0, L1);
    const D = s.at(lam);
    const sampleCol = state.phenol > 12 ? '#EDE6D2' : '#DFECEF';
    const sw = narrow ? w * 0.92 : w * 0.56;
    const sx = narrow ? w * 0.04 : 12;
    const sh = narrow ? h * 0.5 : h * 0.86;
    const sy = narrow ? 6 : h * 0.07;
    spectro(ctx, sx, sy, sw, sh, { lam, D, beam: 1, sampleColor: sampleCol, scanning: state.scanning, t: runner ? runner.t : 0 });

    // права панель: стовпчики D230/D260/D280 і кювета 10 мм
    const px = narrow ? w * 0.06 : w * 0.6;
    const py = narrow ? h * 0.58 : h * 0.12;
    const pw = narrow ? w * 0.88 : w * 0.36;
    const ph = narrow ? h * 0.36 : h * 0.76;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    roundRect(ctx, px, py, pw, ph, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(40,70,55,.18)'; ctx.lineWidth = 1; ctx.stroke();
    const bars = [
      { l: 230, v: s.D230, c: '#6B7280', n: 'D₂₃₀ фенол, солі' },
      { l: 260, v: s.D260, c: '#2E7D5B', n: 'D₂₆₀ нуклеїнові кислоти' },
      { l: 280, v: s.D280, c: '#C2410C', n: 'D₂₈₀ білок' },
    ];
    const maxV = Math.max(1, s.D230, s.D260, s.D280) * 1.12;
    const bw = pw * 0.17;
    const baseY = py + ph * 0.72;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const bx = px + pw * (0.14 + i * 0.28);
      const bh = (b.v / maxV) * (ph * 0.5);
      ctx.fillStyle = 'rgba(20,45,30,.07)';
      roundRect(ctx, bx, py + ph * 0.2, bw, ph * 0.52, 4); ctx.fill();
      ctx.fillStyle = b.c;
      roundRect(ctx, bx, baseY - bh, bw, Math.max(2, bh), 4); ctx.fill();
      ctx.font = `700 ${narrow ? 10 : 11.5}px ui-monospace, monospace`;
      ctx.fillStyle = '#17321F'; ctx.textAlign = 'center';
      ctx.fillText(fnum(b.v, 2), bx + bw / 2, baseY - bh - 5);
      ctx.font = `600 ${narrow ? 9 : 10}px system-ui, sans-serif`;
      ctx.fillStyle = '#4A5B50';
      ctx.fillText(`${b.l} нм`, bx + bw / 2, baseY + 13);
    }
    ctx.font = `700 ${narrow ? 11 : 12.5}px system-ui, sans-serif`;
    ctx.fillStyle = '#17321F'; ctx.textAlign = 'center';
    ctx.fillText(`D₂₆₀/D₂₈₀ = ${fnum(s.R, 2)}`, px + pw / 2, py + ph * 0.92);
    ctx.font = `600 ${narrow ? 9.5 : 11}px system-ui, sans-serif`;
    ctx.fillStyle = s.inRange ? '#2E7D5B' : '#B23A2A';
    ctx.fillText(s.inRange ? 'у робочому діапазоні 0,1–1,0' : 'поза робочим діапазоном', px + pw / 2, py + ph * 0.99);
    ctx.font = `700 ${narrow ? 10 : 11.5}px system-ui, sans-serif`;
    ctx.fillStyle = '#4A5B50'; ctx.textAlign = 'left';
    ctx.fillText('Кювета 10 мм, УФ-промінь показано умовно', px + pw * 0.06, py + ph * 0.1);
    ctx.restore();
    chip(ctx, 12, 18, `λ = ${fnum(lam, 0)} нм · D = ${fnum(D, 3)}`, { align: 'left', size: narrow ? 10.5 : 12 });
  }

  const runner = new Runner({
    btn: $('t11d-run'),
    reset: $('t11d-reset'),
    speed: 1,
    labels: { start: '▶ Зняти спектр', cont: '▶ Продовжити', again: '↻ Ще раз' },
    step: (dt, time, reset) => {
      if (reset) { state.lam = 260; state.scanning = false; }
      else {
        state.scanning = true;
        state.lam = L0 + (L1 - L0) * clamp(time / 5, 0, 1);
        if (time >= 5) { state.lam = L1; runner.finish(); }
      }
      recompute();
      const st = $('t11d-status');
      if (st) st.textContent = reset ? 'Прилад обнулено за буфером ТЕ (D = 0)' : `Сканування: λ = ${fnum(state.lam, 0)} нм`;
    },
    draw,
  });
  const fin = runner.finish.bind(runner);
  runner.finish = () => { state.scanning = false; state.lam = 260; recompute(); fin(); };
  runner.reset();
  onResize(canvas.parentElement, draw);
  if (bus) bus.loadSpec = load;
  return { recompute, draw, load };
}
