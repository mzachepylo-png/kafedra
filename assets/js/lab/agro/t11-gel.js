// ЛР 47 (п. 12) і ЛР 49. Гель-електрофорез ДНК та РНК в агарозному гелі,
// забарвлення бромистим етидієм і перегляд у світлі УФ-трансілюмінатора.

import {
  fit, scene, roundRect, clamp, fnum, Plot, sliders, segmented, setOut, Runner, onResize, $, TAU,
} from './kit.js';
import { gelTank, transilluminator, chip, arrow } from './t11-draw.js';
import { rfOf, bpOfRf, gelLimits, frontCm, bandBrightness, LADDER, PLASMID_FORMS, PBR322_BP } from './t11-model.js';

const GEL_CM = 8;      // корисна довжина гелю
const MAX_H = 6;       // максимальний час розділення, год

export function initGel(bus) {
  const canvas = $('t11c-canvas');
  if (!canvas) return;
  const state = { sample: 'plasmid', view: 'uv', agarose: 0.8, volt: 35, load: 200, intact: 95, hours: 2.5 };

  const segSample = segmented($('t11c-sample'), 'sample', [
    { value: 'plasmid', label: 'Плазмідна ДНК' },
    { value: 'nuclear', label: 'Ядерна ДНК' },
    { value: 'rna', label: 'Тотальна РНК' },
  ], state.sample, (v) => { state.sample = v; recompute(); });

  const segView = segmented($('t11c-view'), 'view', [
    { value: 'run', label: 'Камера: розділення' },
    { value: 'uv', label: 'УФ: після фарбування' },
  ], state.view, (v) => { state.view = v; draw(); });

  const ui = sliders($('t11c-sliders'), [
    { id: 'agarose', label: 'Концентрація агарози', min: 0.6, max: 2, step: 0.1, value: state.agarose, unit: '%', digits: 1, hint: 'ЛР 49 — 0,8 % гель. Щільніший гель краще розділяє короткі фрагменти, але затримує довгі.' },
    { id: 'volt', label: 'Напруга на електродах', min: 20, max: 120, step: 5, value: state.volt, unit: 'В', digits: 0, hint: 'ЛР 49 — 30–40 В. Висока напруга пришвидшує розділення, але гель нагрівається й смуги розмиваються.' },
    { id: 'load', label: 'Маса препарату на доріжку', min: 5, max: 600, step: 5, value: state.load, unit: 'нг', digits: 0, hint: 'Поріг виявлення бромистим етидієм ≈ 5 нг у смузі; перевантаження дає «хвости».' },
    { id: 'intact', label: 'Цілісність препарату', min: 0, max: 100, step: 5, value: state.intact, unit: '%', digits: 0, hint: 'Деградований препарат дає не смуги, а суцільний шлейф.' },
  ], (id) => { state[id] = ui.values[id]; recompute(); });
  for (const k of ['agarose', 'volt', 'load', 'intact']) state[k] = ui.values[k];

  const plotCal = new Plot($('t11c-plot1'), {
    xLabel: 'Відносна рухливість R_f', yLabel: 'lg(довжина, п. н.)', xShort: 'R_f',
    x: [0, 1], y: [1.8, 4.8], yZero: false, aspect: 1.6,
  });
  const plotDen = new Plot($('t11c-plot2'), {
    xLabel: 'Відстань від лунки, см', yLabel: 'Яскравість світіння, відн. од.', xShort: 'см',
    x: [0, GEL_CM], y: [0, 1.15], aspect: 1.6,
  });

  document.querySelectorAll('[data-t11c-preset]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.t11cPreset;
    if (p === 'book') { segSample.select('plasmid', false); state.sample = 'plasmid'; ui.set('agarose', 0.8, true); ui.set('volt', 35, true); ui.set('load', 200, true); ui.set('intact', 95, true); }
    if (p === 'rna') { segSample.select('rna', false); state.sample = 'rna'; ui.set('agarose', 0.8, true); ui.set('volt', 35, true); ui.set('intact', 95, true); ui.set('load', 300, true); }
    if (p === 'degraded') { segSample.select('rna', false); state.sample = 'rna'; ui.set('intact', 20, true); }
    if (p === 'dense') { ui.set('agarose', 2, true); }
    for (const k of ['agarose', 'volt', 'load', 'intact']) state[k] = ui.values[k];
    recompute();
  }));

  /* ---------- модель доріжок ---------- */
  function sampleBands(loadNg) {
    const deg = 1 - state.intact / 100;
    if (state.sample === 'plasmid') {
      return PLASMID_FORMS.map((f) => ({
        bp: PBR322_BP * f.factor, realBp: PBR322_BP, ng: loadNg * f.share * (1 - deg * 0.7),
        label: f.label, smear: deg * 0.5, h: 0.016,
      }));
    }
    if (state.sample === 'nuclear') {
      return [{ bp: 50000, realBp: 50000, ng: loadNg * (1 - deg * 0.85), label: 'Високомолекулярна ядерна ДНК', smear: deg, h: 0.022 }];
    }
    return [
      { bp: 3375, realBp: 3375, ng: loadNg * 0.55 * (1 - deg * 0.8), label: '25S рРНК', smear: deg * 0.9, h: 0.018 },
      { bp: 1800, realBp: 1800, ng: loadNg * 0.28 * (1 - deg * 0.6), label: '18S рРНК', smear: deg * 0.9, h: 0.016 },
      { bp: 120, realBp: 120, ng: loadNg * 0.17, label: '5S рРНК і тРНК', smear: 0.1, h: 0.014 },
    ];
  }

  function lanes() {
    const front = frontCm(state.volt, state.hours, state.agarose, { gelCm: GEL_CM });
    const mk = (b) => {
      const rf = rfOf(b.bp, state.agarose);
      return { ...b, rf, cm: rf * front, bright: bandBrightness(b.ng) * (state.view === 'uv' ? 1 : 0) };
    };
    const ladderTotal = LADDER.reduce((s, b) => s + b, 0);
    const marker = LADDER.map((bp) => mk({ bp, realBp: bp, ng: 500 * bp / ladderTotal, label: `${bp} п. н.`, smear: 0, h: 0.013 }));
    return {
      front,
      list: [
        { name: 'М', title: 'Маркер 100–3000 п. н.', bands: marker },
        { name: '1', title: 'Проба', bands: sampleBands(state.load).map(mk) },
        { name: '2', title: 'Проба 1 : 5', bands: sampleBands(state.load / 5).map(mk) },
        { name: 'К', title: 'Контроль (буфер ТЕ)', bands: [] },
      ],
    };
  }

  let L = null;
  function recompute() {
    L = lanes();
    const lim = gelLimits(state.agarose);
    const main = L.list[1].bands.slice().sort((a, b) => b.ng - a.ng)[0];
    setOut($('t11c-reads'), {
      front: fnum(L.front, 2) + ' см',
      rf: main ? fnum(main.rf, 3) : '—',
      dist: main ? fnum(main.cm, 2) + ' см' : '—',
      range: `${fnum(Math.pow(10, lim.lgMin), 0)}–${fnum(Math.pow(10, lim.lgMax), 0)} п. н.`,
      found: main ? fnum(bpOfRf(main.rf, state.agarose), 0) + ' п. н.' : '—',
      bright: main ? fnum(main.ng, 1) + ' нг' : '—',
    });

    const v = $('t11c-verdict');
    let cls = '', txt = '';
    const weak = L.list[1].bands.filter((b) => b.ng < 5).length;
    if (L.front < 1.2) {
      txt = `<b>Розділення щойно почалося:</b> фронт барвника пройшов лише ${fnum(L.front, 2)} см. Дайте гелю попрацювати довше або підніміть напругу (у ЛР 49 — 30–40 В при постійному перемішуванні буфера).`;
      cls = ' is-warn';
    } else if (state.volt > 90) {
      txt = `<b>Завелика напруга (${fnum(state.volt, 0)} В).</b> Гель нагрівається, смуги «пливуть» і спотворюються, ДНК може денатурувати. Протокол ЛР 49 — 30–40 В.`;
      cls = ' is-bad';
    } else if (weak > 0) {
      txt = `${weak} смуг(и) у пробі містять менше 5 нг ДНК — під УФ їх майже не видно (поріг чутливості бромистого етидію). Нанесіть більше препарату або сконцентруйте пробу.`;
      cls = ' is-warn';
    } else if (state.intact < 50) {
      txt = `<b>Препарат деградований:</b> замість чітких смуг — суцільний шлейф. Для РНК це означає роботу рибонуклеаз: усі розчини готують на обробленій воді, тканину розтирають із рідким азотом (ЛР 48).`;
      cls = ' is-bad';
    } else if (state.sample === 'plasmid') {
      txt = `Плазміда дає <b>три смуги</b> з однієї молекули: надспіралізована форма рухається найшвидше (R_f = ${fnum(L.list[1].bands[2].rf, 2)}), лінійна — відповідно до своєї довжини (${fnum(PBR322_BP, 0)} п. н.), відкрита кільцева — найповільніше. Тому за гелем визначають не лише довжину, а й стан препарату.`;
      cls = '';
    } else if (state.sample === 'rna') {
      txt = `Якісний препарат тотальної РНК дає дві яскраві смуги рибосомної РНК — 25S і 18S — у співвідношенні яскравостей приблизно 2 : 1, і смугу низькомолекулярних РНК біля фронту. Денатурація гліоксалем і диметилсульфоксидом (ДМСО) прибирає вторинну структуру, тож рухливість залежить лише від довжини (ЛР 49).`;
      cls = '';
    } else {
      txt = `Неушкоджена ядерна ДНК — це фрагменти в десятки тисяч пар нуклеотидів: гель 0,8 % їх не розділяє, вони йдуть однією смугою біля лунки (межа виключення ${fnum(Math.pow(10, lim.lgMax), 0)} п. н.). Поява шлейфа нижче означає деградацію.`;
      cls = '';
    }
    v.className = 'ag-verdict' + cls;
    v.innerHTML = txt;

    // калібрувальний графік
    const line = [];
    for (let rf = 0.05; rf <= 0.95; rf += 0.01) line.push([rf, Math.log10(bpOfRf(rf, state.agarose))]);
    plotCal.set([
      { data: line, color: '#B08A1E', width: 2, label: `Калібрування (агароза ${fnum(state.agarose, 1)} %)` },
      { data: L.list[0].bands.map((b) => [b.rf, Math.log10(b.bp)]), color: '#2E7D5B', type: 'points', r: 4.5, label: 'Маркер' },
      { data: L.list[1].bands.map((b) => [b.rf, Math.log10(b.realBp)]), color: '#C2410C', type: 'points', r: 5.5, label: 'Проба' },
    ]);

    // денситограма доріжки «Проба»
    const dens = [];
    for (let x = 0; x <= GEL_CM; x += 0.04) {
      let I = 0.04;
      for (const b of L.list[1].bands) {
        const br = bandBrightness(b.ng);
        I += br * Math.exp(-0.5 * Math.pow((x - b.cm) / 0.13, 2));
        if (b.smear > 0.02 && x > b.cm) I += br * b.smear * 0.5 * Math.exp(-(x - b.cm) / 1.6);
      }
      dens.push([x, clamp(I, 0, 1.1)]);
    }
    plotDen.set([
      { data: dens, color: '#C2410C', width: 2.4, fill: 'rgba(194,65,12,.14)', label: 'Профіль доріжки «Проба»' },
    ], [{ x: L.front, color: '#1F3A5A', dash: [4, 4], label: 'фронт барвника' }]);

    draw();
  }

  /* ---------- сцена ---------- */
  function draw() {
    if (!canvas.parentElement || canvas.parentElement.clientWidth < 80) return;
    const narrow = canvas.parentElement.clientWidth < 600;
    const { ctx, w, h } = fit(canvas, { aspect: narrow ? 0.92 : 1.42, min: 320, max: 560 });
    const t = runner ? runner.t : 0;
    if (!L) return;
    if (state.view === 'run') {
      scene(ctx, w, h, { kind: 'bench', horizon: 0.52 });
      gelTank(ctx, w * 0.05, h * 0.08, w * 0.9, h * 0.86, {
        volt: state.volt, front: L.front / GEL_CM, running: runner && runner.running, lanes: L.list, t,
      });
      chip(ctx, 10, h - 10, `Фронт барвника ${fnum(L.front, 2)} см · ${fnum(state.hours, 1)} год`, { align: 'left', size: narrow ? 10 : 11.5 });
      if (!narrow) chip(ctx, w - 10, h - 10, 'Смуг ДНК ще не видно — гель фарбують після розділення', { align: 'right', size: 11 });
    } else {
      scene(ctx, w, h, { kind: 'dark', horizon: 0.92 });
      const padL = narrow ? 24 : 34;
      const labelW = narrow ? 34 : 46;
      const g = transilluminator(ctx, padL, 10, w - padL - 10, h - 34, {
        padLeft: labelW,
        lanes: L.list.map((ln) => ({
          bands: ln.bands.map((b) => ({ rf: clamp(b.cm / GEL_CM, 0, 1), bright: b.bright, h: b.h, smear: b.smear })),
        })),
        front: 1, glow: 1, t,
      });
      // лінійка (см від лунки)
      ctx.save();
      ctx.strokeStyle = 'rgba(220,235,230,.5)'; ctx.fillStyle = '#CFE4DA';
      ctx.font = `600 ${narrow ? 8.5 : 10}px ui-monospace, monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let cm = 0; cm <= GEL_CM; cm += 2) {
        const y = g.gel.wellY + g.gel.runH * (cm / GEL_CM) + 3;
        ctx.beginPath(); ctx.moveTo(g.gel.x - 7, y); ctx.lineTo(g.gel.x - 3, y); ctx.stroke();
        ctx.fillText(`${cm}`, g.gel.x - 9, y);
      }
      ctx.save();
      ctx.translate(10, g.gel.y + g.gel.h / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.font = `600 ${narrow ? 8.5 : 10}px system-ui, sans-serif`;
      ctx.fillText('см від лунки', 0, 0);
      ctx.restore();
      ctx.restore();
      // підписи доріжок
      ctx.save();
      ctx.font = `700 ${narrow ? 9.5 : 11}px system-ui, sans-serif`;
      ctx.fillStyle = '#E7F2EC'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      for (let i = 0; i < L.list.length; i++) {
        ctx.fillText(L.list[i].name, g.gel.lanesX + g.gel.laneW * (i + 0.5), g.gel.y - 4);
      }
      ctx.restore();
      // підписи смуг маркера — у лівому полі гелю
      ctx.save();
      ctx.font = `600 ${narrow ? 8 : 9.5}px ui-monospace, monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const want = [3000, 2000, 1500, 1000, 600, 300, 100];
      let lastY = -99;
      for (const b of L.list[0].bands) {
        if (!want.includes(b.bp) || b.bright < 0.1) continue;
        const y = g.gel.wellY + g.gel.runH * clamp(b.cm / GEL_CM, 0, 1) + 3;
        if (y - lastY < (narrow ? 9 : 11)) continue;
        lastY = y;
        const tx = g.gel.lanesX - 4;
        ctx.strokeStyle = 'rgba(236,246,240,.35)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(tx + 1, y); ctx.lineTo(tx + 3.5, y); ctx.stroke();
        ctx.fillStyle = 'rgba(240,247,242,.9)';
        ctx.fillText(`${b.bp}`, tx, y);
      }
      ctx.restore();
      chip(ctx, 10, h - 10, 'УФ-трансілюмінатор 312 нм · бромистий етидій 0,5 мкг/мл', { align: 'left', dark: true, size: narrow ? 8.5 : 11 });
      if (!narrow) chip(ctx, w - 10, h - 10, 'М — маркер (п. н.) · 1, 2 — проба · К — контроль', { align: 'right', dark: true, size: 11 });
    }
  }

  const runner = new Runner({
    btn: $('t11c-run'),
    reset: $('t11c-reset'),
    speed: 0.9,                      // 1 с ≈ 0,9 год електрофорезу
    step: (dt, time, reset) => {
      if (reset) { state.hours = 0; state.view = 'run'; segView.select('run', false); }
      else {
        state.hours = clamp(time, 0, MAX_H);
        if (time >= MAX_H) { state.hours = MAX_H; runner.finish(); }
        if (state.view !== 'run' && runner && runner.running) { state.view = 'run'; segView.select('run', false); }
      }
      recompute();
      const st = $('t11c-status');
      if (st) st.textContent = reset ? 'Проби нанесено в лунки' : `${fnum(state.hours, 1)} год · фронт ${fnum(L ? L.front : 0, 2)} см`;
    },
    draw,
  });
  // після завершення розділення гель забарвлюють і переглядають у УФ
  const origFinish = runner.finish.bind(runner);
  runner.finish = () => { state.view = 'uv'; segView.select('uv', false); recompute(); origFinish(); };
  state.hours = 2.5;
  recompute();
  const st0 = $('t11c-status');
  if (st0) st0.textContent = 'Статичний кадр: 2,5 год розділення, гель забарвлено';
  onResize(canvas.parentElement, draw);
  return { recompute, draw };
}
