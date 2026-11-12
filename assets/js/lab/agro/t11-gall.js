// ЛР 41–44. Трансформація рослинних клітин Agrobacterium tumefaciens:
// диски коренеплоду моркви, стебло томата, листкові диски з канаміциновою селекцією.

import {
  fit, scene, petri, tube, callus, plantlet, callout, shadow, roundRect, rgba, clamp, lerp,
  fnum, Plot, sliders, segmented, setOut, Runner, onResize, $, MAT, rng, TAU,
} from './kit.js';
import { carrotDisc, leafDisc, tomatoStem, agroCell, chip } from './t11-draw.js';
import { gallState, OBJECTS, virTemp, tumorTemp, virInduction } from './t11-model.js';

const MAX_DAY = 30;

export function initGall() {
  const canvas = $('t11a-canvas');
  if (!canvas) return;
  const state = { obj: 'carrot', strain: 'wild', aceto: 100, T: 26.5, kan: 50, cefo: 500, day: 0 };

  const segObj = segmented($('t11a-obj'), 'obj', [
    { value: 'carrot', label: 'Диски моркви <small>(ЛР 42)</small>' },
    { value: 'tomato', label: 'Стебло томата <small>(ЛР 43)</small>' },
    { value: 'disc', label: 'Листкові диски <small>(ЛР 44)</small>' },
  ], state.obj, (v) => { state.obj = v; syncCtrls(); runner.reset(); });

  const segStrain = segmented($('t11a-strain'), 'strain', [
    { value: 'wild', label: 'Вірулентний штам' },
    { value: 'disarmed', label: 'Роззброєний вектор' },
    { value: 'none', label: 'Контроль без бактерій' },
  ], state.strain, (v) => { state.strain = v; recompute(); });

  const ui = sliders($('t11a-sliders'), [
    { id: 'aceto', label: 'Ацетосирингон (фенольний індуктор vir-генів)', min: 0, max: 200, step: 5, value: state.aceto, unit: 'мкМ', digits: 0, hint: 'Поранені клітини рослини виділяють фенольні сполуки самі; додавання ацетосирингону підсилює індукцію.' },
    { id: 'T', label: 'Температура культивування', min: 18, max: 34, step: 0.5, value: state.T, unit: '°C', digits: 1, hint: 'За посібником — +26…27 °C (с. 174). Вище +29 °C білки Vir інактивуються й перенесення Т-ДНК припиняється.' },
    { id: 'kan', label: 'Канаміцин у середовищі R1', min: 0, max: 150, step: 5, value: state.kan, unit: 'мг/л', digits: 0, hint: 'Селективний агент: нетрансформовані клітини гинуть, носії гена nptII виживають (ЛР 44 — 50 мг/л).' },
    { id: 'cefo', label: 'Клафоран + карбеніцилін', min: 0, max: 1200, step: 50, value: state.cefo, unit: 'мг/л', digits: 0, hint: 'Антибіотики проти самої агробактерії після кокультивування (ЛР 44 — по 500 мг/л).' },
  ], (id) => { state[id] = ui.values[id]; recompute(); });

  for (const k of ['aceto', 'T', 'kan', 'cefo']) state[k] = ui.values[k];

  const plotGrowth = new Plot($('t11a-plot1'), {
    xLabel: 'Доба після інокуляції', yLabel: 'Діаметр пухлини, мм', xShort: 'доба',
    x: [0, MAX_DAY], y: 'auto', aspect: 1.6,
  });
  const plotT = new Plot($('t11a-plot2'), {
    xLabel: 'Температура, °C', yLabel: 'Частка, %', xShort: 'T',
    x: [18, 34], y: [0, 105], aspect: 1.6,
  });

  const presets = document.querySelectorAll('[data-t11a-preset]');
  presets.forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.t11aPreset;
    if (p === 'book') { segObj.select('carrot', false); state.obj = 'carrot'; segStrain.select('wild', false); state.strain = 'wild'; ui.set('aceto', 0, true); ui.set('T', 26.5, true); }
    if (p === 'hot') { segStrain.select('wild', false); state.strain = 'wild'; ui.set('T', 32, true); ui.set('aceto', 100, true); }
    if (p === 'disc') { segObj.select('disc', false); state.obj = 'disc'; segStrain.select('disarmed', false); state.strain = 'disarmed'; ui.set('kan', 50, true); ui.set('cefo', 500, true); ui.set('T', 24, true); }
    if (p === 'escape') { segObj.select('disc', false); state.obj = 'disc'; segStrain.select('disarmed', false); state.strain = 'disarmed'; ui.set('kan', 0, true); ui.set('cefo', 500, true); }
    for (const k of ['aceto', 'T', 'kan', 'cefo']) state[k] = ui.values[k];
    syncCtrls();
    runner.reset();
  }));

  function syncCtrls() {
    const isDisc = state.obj === 'disc';
    ui.inputs.kan.row.classList.toggle('is-disabled', !isDisc);
    ui.inputs.cefo.row.classList.toggle('is-disabled', !isDisc);
  }
  syncCtrls();

  /* ---------- розрахунок ---------- */
  let m = null;
  function recompute() {
    m = gallState({ ...state });
    const o = OBJECTS[state.obj];
    const isDisc = state.obj === 'disc';
    setOut($('t11a-reads'), {
      day: fnum(state.day, 1),
      vir: fnum(m.vir * 100, 0) + ' %',
      transform: fnum(m.transform * 100, 0) + ' %',
      main: isDisc
        ? fnum(m.shootsTr * 100, 0) + ' %'
        : fnum(m.gallD, 2) + ' мм',
      first: isDisc
        ? (m.shootsTr > 0.02 ? fnum(OBJECTS.disc.t50 / Math.max(0.3, m.grow) * 0.92, 0) + ' доба' : '—')
        : (isFinite(m.firstDay) ? fnum(m.firstDay, 1) + ' доба' : '—'),
      extra: isDisc ? fnum(m.purity * 100, 0) + ' %' : fnum(m.coverage * 100, 0) + ' %',
    });
    const v = $('t11a-verdict');
    let cls = '', txt = '';
    if (state.strain === 'none') {
      txt = '<b>Контроль.</b> Без <i>Agrobacterium tumefaciens</i> пухлини не утворюються: поранена тканина лише калюсує по краю зрізу. Саме так у ЛР 42 доводять, що причина пухлини — бактерія, а не поранення.';
      cls = '';
    } else if (state.strain === 'disarmed' && !isDisc) {
      txt = '<b>Роззброєний (англ. disarmed) вектор</b> — це Ті-плазміда, у якої з Т-ДНК видалено онкогени синтезу ауксинів і цитокінінів. Т-ДНК переноситься (частка клітин із вбудованою Т-ДНК — ' + fnum(m.transform * 100, 0) + ' %), але корончастих галів немає: немає гіперпродукції фітогормонів. Саме такі вектори й потрібні для одержання трансгенних рослин.';
      cls = ' is-warn';
    } else if (m.fT < 0.12) {
      txt = `<b>Перенесення Т-ДНК заблоковано температурою.</b> При ${fnum(state.T, 1)} °C білки Vir інактивуються (множник перенесення ${fnum(m.fT, 2)}), тому пухлини майже не з'являються. Поверніться до режиму посібника +26…27 °C.`;
      cls = ' is-bad';
    } else if (isDisc) {
      if (m.overgrowth > 0.5) { txt = `<b>Експлантати заростають агробактерією</b> (${fnum(m.overgrowth * 100, 0)} % площі): антибіотиків проти бактерії замало. У ЛР 44 на середовище R1 додають по 500 мг/л клафорану й карбеніциліну.`; cls = ' is-bad'; }
      else if (m.purity < 0.75) { txt = `<b>Селекція нестрога:</b> серед регенерантів ${fnum((1 - m.purity) * 100, 0)} % «втікачів» — нетрансгенних пагонів, які вижили на малій дозі канаміцину. Підніміть канаміцин до 50 мг/л (R1) і 100 мг/л (R2, укорінення).`; cls = ' is-warn'; }
      else { txt = `<b>Селекція працює:</b> на 25–30 добу з'являються темно-зелені точки, а потім пагони; частка трансгенних серед них — ${fnum(m.purity * 100, 0)} %. Укорінені рослини перевіряють біохімічно (ЛР 44, п. 9).`; cls = ''; }
    } else if (m.gallD < 0.2) {
      txt = `Пухлин ще немає: на ${fnum(state.day, 0)}-ту добу діаметр ${fnum(m.gallD, 2)} мм. За посібником перші корончасті гали помітні на 5–7 добу.`;
      cls = ' is-warn';
    } else {
      txt = `На ${fnum(state.day, 0)}-ту добу середній діаметр пухлин ${fnum(m.gallD, 2)} мм, вкрито ${fnum(m.coverage * 100, 0)} % поверхні зрізу. Корончастий гал росте на безгормональному («голодному») агарі, бо клітини з інтегрованою Т-ДНК самі синтезують ауксини й цитокініни.`;
      cls = m.coverage > 0.5 ? '' : ' is-warn';
    }
    v.className = 'ag-verdict' + cls;
    v.innerHTML = txt;

    // графіки
    const isD = state.obj === 'disc';
    const curve = [], ctrl = [];
    for (let d = 0; d <= MAX_DAY; d += 0.5) {
      const g = gallState({ ...state, day: d });
      curve.push([d, isD ? g.shootsTr * 100 : g.gallD]);
      const c = gallState({ ...state, strain: 'none', day: d });
      ctrl.push([d, isD ? 0 : c.gallD]);
    }
    const cur = isD ? m.shootsTr * 100 : m.gallD;
    plotGrowth.setOptions({ yLabel: isD ? 'Частка дисків із пагонами, %' : 'Діаметр пухлини, мм' });
    plotGrowth.set([
      { data: curve, color: '#2E7D5B', width: 2.6, fill: 'rgba(46,125,91,.12)', label: isD ? 'Трансгенні пагони' : 'Інокульовані експлантати', marker: [state.day, cur] },
      { data: ctrl, color: '#B08A1E', width: 2, dash: [6, 4], label: 'Контроль (без бактерії)' },
    ], [{ x: state.day, color: 'rgba(30,70,45,.5)', label: `${fnum(state.day, 0)} доба` }]);

    const tr = [], gw = [];
    for (let T = 18; T <= 34; T += 0.25) {
      tr.push([T, gallState({ ...state, T, day: 21 }).transform * 100]);
      gw.push([T, tumorTemp(T) * 100]);
    }
    plotT.set([
      { data: tr, color: '#2E7D5B', width: 2.6, label: 'Частка трансформованих експлантатів', marker: [state.T, gallState({ ...state, day: 21 }).transform * 100] },
      { data: gw, color: '#C2410C', width: 2, dash: [5, 4], label: 'Відносна швидкість росту пухлини' },
    ], [{ x: state.T, color: 'rgba(30,70,45,.5)', label: `${fnum(state.T, 1)} °C` }, { x: 29, color: '#B23A2A', dash: [3, 3], label: 'межа 29 °C' }]);

    draw();
  }

  /* ---------- сцена ---------- */
  function draw() {
    if (!canvas.parentElement || canvas.parentElement.clientWidth < 80) return;
    const narrow = canvas.parentElement.clientWidth < 560;
    const { ctx, w, h } = fit(canvas, { aspect: narrow ? 1.12 : 1.52, min: 300, max: 520 });
    const t = runner ? runner.t : 0;
    const hy = scene(ctx, w, h, { kind: 'room', horizon: narrow ? 0.38 : 0.42 });
    const day = state.day;
    const showBact = day < 3 && state.strain !== 'none';
    const baseY = hy + (h - hy) * 0.46;

    if (state.obj === 'carrot' || state.obj === 'disc') {
      const r = Math.min(w * (narrow ? 0.245 : 0.235), (h - hy) * 0.78, 118);
      const r2 = r * 0.78;
      const x1 = w * (narrow ? 0.3 : 0.31), x2 = w * (narrow ? 0.75 : 0.735);
      const drawDish = state.obj === 'carrot' ? drawCarrotDish : drawDiscDish;
      // підписи — над чашками, щоб не накладалися на шкалу часу
      chip(ctx, x1, baseY - r * 0.5 - 10, state.obj === 'carrot' ? 'Інокульовані диски' : `R1 + канаміцин ${fnum(state.kan, 0)} мг/л`, { size: narrow ? 10 : 11.5 });
      chip(ctx, x2, baseY - r2 * 0.5 - 10, state.obj === 'carrot' ? 'Контроль (без бактерії)' : 'Контроль (без вектора)', { size: narrow ? 10 : 11.5 });
      drawDish(ctx, x1, baseY, r, true, t);
      drawDish(ctx, x2, baseY, r2, false, t);
      if (showBact && state.obj === 'carrot') swarm(ctx, x1, baseY - r * 0.25, r, t);
      if (state.obj === 'carrot' && m && m.gallD > 0.5 && !narrow) {
        callout(ctx, x1 + r * 0.1, baseY - r * 0.12, Math.min(w - 120, x1 + r * 1.05), baseY + r * 0.62,
          `Гали ⌀ ${fnum(m.gallD, 1)} мм на камбіальному кільці`, { size: 11 });
      }
    } else {
      const th = Math.min((h - 44) * 0.82, 250);
      const tw = th * 0.2;
      const x1 = w * (narrow ? 0.28 : 0.33), x2 = w * (narrow ? 0.7 : 0.67);
      const top = Math.max(hy - th * 0.45, 26);
      drawTomatoTube(ctx, x1, top, tw, th, true, t);
      drawTomatoTube(ctx, x2, top, tw, th, false, t);
      if (m && m.gallD > 0.4) {
        callout(ctx, x1 + tw * 0.55, top + th * 0.46, Math.min(w - 110, x1 + tw * 1.6), top + th * 0.16,
          `Гал ⌀ ${fnum(m.gallD, 1)} мм`, { size: narrow ? 10.5 : 11.5 });
      }
    }

    // шкала часу внизу
    const bx = 14, bw = w - 28, by = h - 14;
    ctx.save();
    ctx.fillStyle = 'rgba(12,32,22,.16)';
    roundRect(ctx, bx, by - 6, bw, 7, 3.5); ctx.fill();
    ctx.fillStyle = '#2E7D5B';
    roundRect(ctx, bx, by - 6, Math.max(3, bw * (day / MAX_DAY)), 7, 3.5); ctx.fill();
    ctx.font = '600 9.5px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const d of [0, 7, 14, 21, 28]) {
      const px = bx + bw * (d / MAX_DAY);
      ctx.fillStyle = 'rgba(12,32,22,.5)';
      ctx.fillRect(px, by - 10, 1.2, 4);
      ctx.fillText(`${d}`, px, by - 12);
    }
    ctx.fillStyle = 'rgba(12,32,22,.5)';
    ctx.textAlign = 'right';
    ctx.fillText('доба', bx + bw, by + 12);
    ctx.restore();
    chip(ctx, w - 12, 22, `${fnum(day, 0)} доба · ${fnum(state.T, 1)} °C`, { align: 'right', size: 11.5 });
  }

  function drawCarrotDish(ctx, cx, cy, r, inoculated, t) {
    petri(ctx, cx, cy, r, {
      tilt: 0.42,
      medium: { color: '#EDE8D2' },
      lid: false,
      contents: (c, p) => {
        const pos = [[-0.42, -0.22], [0.36, -0.3], [-0.05, 0.3]];
        const dr = p.rx * 0.33;
        for (let i = 0; i < pos.length; i++) {
          const [fx, fy] = pos[i];
          const g = inoculated && m ? m : null;
          carrotDisc(c, p.cx + fx * p.rx, p.cy + fy * p.ry * 1.5, dr, {
            tilt: 0.42,
            gall: g ? clamp(g.gallD / OBJECTS.carrot.dmax, 0, 1) : 0,
            ring: g ? g.coverage : 0,
            green: 0.18,
            seed: 3 + i * 7,
            t,
          });
        }
      },
    });
  }

  function drawDiscDish(ctx, cx, cy, r, selected, t) {
    petri(ctx, cx, cy, r, {
      tilt: 0.42,
      medium: { color: selected ? '#E7E7C6' : '#EDE8D2' },
      lid: false,
      contents: (c, p) => {
        const pos = [[-0.45, -0.2], [0.3, -0.32], [-0.12, 0.3], [0.5, 0.22]];
        for (let i = 0; i < pos.length; i++) {
          const [fx, fy] = pos[i];
          const sh = selected && m ? m.shootsTr : (m ? m.survWT * 0.4 : 0);
          const br = selected && m ? clamp(1 - m.survTr, 0, 1) * 0.6 + m.overgrowth * 0.5 : clamp(1 - (m ? m.survWT : 1), 0, 1);
          leafDisc(c, p.cx + fx * p.rx, p.cy + fy * p.ry * 1.5, p.rx * 0.27, {
            tilt: 0.42, shoots: sh, browning: br, seed: 5 + i * 11, t,
          });
        }
        if (selected && m && m.overgrowth > 0.25) {
          const R = rng(9);
          c.fillStyle = `rgba(226,214,160,${0.22 + 0.35 * m.overgrowth})`;
          for (let i = 0; i < 40; i++) {
            const a = R() * TAU, rr = Math.sqrt(R());
            c.beginPath();
            c.ellipse(p.cx + Math.cos(a) * p.rx * rr, p.cy + Math.sin(a) * p.ry * rr, p.rx * 0.07, p.ry * 0.09, 0, 0, TAU);
            c.fill();
          }
        }
      },
    });
  }

  function drawTomatoTube(ctx, x, y, wd, ht, inoculated, t) {
    tube(ctx, x - wd / 2, y, wd, ht, {
      medium: { level: 0.26, color: MAT.agar },
      plug: 'foil',
      label: inoculated ? 'Інокульована рослина' : 'Контроль',
      contents: (c, inner) => {
        const sway = Math.sin(t * 0.7) * 0.05;
        plantlet(c, inner.x + inner.w / 2, inner.surface, {
          height: ht * 0.48, nodes: 4, leafLen: wd * 0.42,
          roots: { n: 4, len: ht * 0.12 }, sway, seed: inoculated ? 4 : 8,
        });
        if (inoculated && m && m.gallD > 0.3) {
          const rad = Math.max(2, (m.gallD / 20) * wd * 0.95);
          callus(c, inner.x + inner.w / 2 + wd * 0.06, inner.surface - ht * 0.2, rad * 1.6, {
            color: MAT.callusWhite, friable: 0.5, green: 0.25, seed: 13, glossy: 0.9,
          });
        }
      },
    });
  }

  function swarm(ctx, cx, cy, r, t) {
    const R = rng(21);
    for (let i = 0; i < 9; i++) {
      const a = R() * TAU;
      const ph = (t * 0.5 + R()) % 1;
      const d = r * (1.5 - ph * 1.1);
      agroCell(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.5, Math.max(6, r * 0.11), a + Math.PI, {
        t, seed: i + 1, alpha: 0.35 + 0.5 * (1 - ph), glow: true,
      });
    }
  }

  /* ---------- запуск ---------- */
  const runner = new Runner({
    btn: $('t11a-run'),
    reset: $('t11a-reset'),
    speed: 3.2,                 // діб модельного часу на секунду
    step: (dt, time, reset) => {
      state.day = reset ? 0 : clamp(time, 0, MAX_DAY);
      if (!reset && state.day >= MAX_DAY) { state.day = MAX_DAY; runner.finish(); }
      recompute();
      const st = $('t11a-status');
      if (st) st.textContent = reset ? 'Початок: інокуляція суспензією бактерій' : `Доба ${fnum(state.day, 0)} з ${MAX_DAY}`;
    },
    draw,
  });
  runner.reset();
  onResize(canvas.parentElement, draw);
  return { recompute, draw };
}
