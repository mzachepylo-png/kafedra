// Вкладка 4. Індукція коренеутворення (ЛР 31): ауксин, розведення МС, затемнення основи, освітленість.
import { scene, tube, microField, callus, Runner, onResize, Plot, sliders, segmented, fnum, rng, clamp, smooth, MAT, TAU, roundRect } from './kit.js';
import { rooting } from './t08-math.js';
import { rackBack, rackFront, roots, rosette, pill, text } from './t08-draw.js';
import { stageFit, reads, verdict, presets, checkbox } from './t08-ui.js';

const DAYS = 28; // укорінення за 3–4 тижні

function foil(ctx, x, y, w, h) {
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#7E878B'); g.addColorStop(0.18, '#F1F4F5'); g.addColorStop(0.4, '#AEB6BA'); g.addColorStop(0.62, '#E6EAEC'); g.addColorStop(1, '#6F787C');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 2, y);
  for (let i = 0; i <= 6; i++) ctx.lineTo(x - 2 + (w + 4) * i / 6, y + (i % 2 ? 3 : -1));
  ctx.lineTo(x + w + 2, y + h); ctx.quadraticCurveTo(x + w / 2, y + h + w * 0.5, x - 2, y + h); ctx.closePath(); ctx.fill();
  const R = rng(5); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 7; i++) { const yy = y + R() * h; ctx.beginPath(); ctx.moveTo(x + R() * w * 0.3, yy); ctx.lineTo(x + w * (0.5 + R() * 0.5), yy + (R() - 0.5) * 6); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(60,70,75,.25)'; for (let i = 0; i < 5; i++) { const yy = y + R() * h; ctx.beginPath(); ctx.moveTo(x + w * R(), yy); ctx.lineTo(x + w * R(), yy + 4); ctx.stroke(); }
  ctx.restore();
}

export function init(root) {
  const $ = (id) => root.querySelector('#' + id);
  const cv = $('m4-cv');
  const fitStage = stageFit(cv, { desk: 16 / 8.6, mob: 0.8, min: 330, max: 500, mobMax: 540 });
  const st = { C: 0.3, half: true, base: 'none', I: 1000 };
  let r = rooting(st);
  const anim = { on: false, day: DAYS };

  const segB = segmented($('m4-base'), 'm4b', [{ value: 'none', label: 'Без затемнення' }, { value: 'foil', label: 'Фольга на основі' }, { value: 'charcoal', label: 'Активоване вугілля' }], st.base, (v) => { st.base = v; update(); });
  const segM = segmented($('m4-min'), 'm4m', [{ value: 'half', label: '½ МС' }, { value: 'full', label: 'Повне МС' }], 'half', (v) => { st.half = v === 'half'; update(); });
  const sl = sliders($('m4-sliders'), [
    { id: 'C', label: 'ІОК (індоліл-3-оцтова кислота)', min: 0, max: 3, step: 0.05, value: st.C, unit: 'мг/л', hint: 'у рецепті ЛР 31 — 0,3 мг/л; робочий діапазон 0,3–1' },
    { id: 'I', label: 'Освітленість', min: 500, max: 6000, step: 100, value: st.I, unit: 'лк', hint: 'для укорінення — 1000 лк (с. 123)' },
  ], () => { Object.assign(st, sl.values); update(); });
  const setAll = (o) => { Object.assign(st, o); segB.select(st.base); segM.select(st.half ? 'half' : 'full'); sl.set('C', st.C, true); sl.set('I', st.I, true); update(); };
  presets($('m4-presets'), [
    { label: 'Рецепт ЛР 31', apply: () => setAll({ C: 0.3, half: true, base: 'none', I: 1000 }) },
    { label: 'Без гормонів, повне МС', apply: () => setAll({ C: 0, half: false, base: 'none', I: 1000 }) },
    { label: 'Надлишок ІОК 2 мг/л', apply: () => setAll({ C: 2, half: true, base: 'none', I: 1000 }) },
    { label: 'Яскраве світло 5000 лк', apply: () => setAll({ C: 0.3, half: true, base: 'none', I: 5000 }) },
  ]);
  const p1 = new Plot($('m4-p1'), { xLabel: 'ІОК, мг/л', yLabel: 'Укорінилося, %', x: [0, 3], y: [0, 100], xShort: 'ІОК', aspect: 1.55 });
  const p2 = new Plot($('m4-p2'), { xLabel: 'Доба', yLabel: 'Довжина коренів, мм', x: [0, DAYS], y: [0, 45], xShort: 'доба', aspect: 1.55 });

  function update() {
    r = rooting(st);
    if (!runner.running) runner.reset(); else draw();
    const curve = (o) => { const a = []; for (let C = 0; C <= 3.001; C += 0.05) a.push([C, 100 * rooting({ ...st, ...o, C }).share]); return a; };
    p1.set([
      { data: curve({ base: 'none', half: false }), color: '#9AA8A0', label: 'повне МС, без затемнення', width: 2, dash: [5, 4] },
      { data: curve({ base: 'charcoal' }), color: '#3A3A36', label: 'з вугіллям', width: 2, dash: [2, 3] },
      { data: curve({}), color: '#2E7D5B', label: 'поточні умови', width: 3 },
    ], [{ x: st.C, color: '#8E3B2E', label: `${fnum(st.C, 2)} мг/л` }]);
    const lc = (o) => { const t = rooting({ ...st, ...o }), a = []; for (let d = 0; d <= DAYS; d += 0.5) a.push([d, t.len(d)]); return a; };
    p2.set([
      { data: lc({ C: 0, half: false, base: 'none' }), color: '#9AA8A0', label: 'без ауксину', width: 2, dash: [5, 4] },
      { data: lc({}), color: '#2E7D5B', label: 'поточні умови', width: 3, fill: 'rgba(46,125,91,.1)' },
    ]);
    reads(root, {
      share: `${fnum(100 * r.share, 0)} %`, n: fnum(r.nRoots, 1), len: `${fnum(r.len(DAYS), 0)} мм`, lag: `${Math.round(r.lag)}-та доба`,
      callus: r.callus > 0.35 ? 'виразний' : r.callus > 0.12 ? 'помірний' : 'немає', ce: `${fnum(r.Ce, 2)} мг/л`,
    });
    let lvl = 'ok', msg = `Укорінюється ≈ ${fnum(100 * r.share, 0)} % пагонів, по ${fnum(r.nRoots, 0)} коренів завдовжки до ${fnum(r.len(DAYS), 0)} мм за 4 тижні.`;
    if (r.callus > 0.35) { lvl = 'warn'; msg += ' Надлишок ауксину: на основі пагона розростається калюс (неорганізована тканина), корені короткі й товсті, погано зʼєднані з провідною системою пагона.'; }
    if (st.base === 'none' && st.I > 3000) { lvl = 'warn'; msg += ' Яскраве світло на основі пагона гальмує закладання коренів (ауксин частково руйнується на світлі) — обгорніть низ пробірки фольгою або додайте активоване вугілля.'; }
    if (st.C < 0.05 && !st.half) { lvl = 'warn'; msg += ' Без ауксину на повному МС корені утворюються повільно — допомагає хоча б розведення мінеральної основи вдвічі.'; }
    if (st.base === 'charcoal') msg += ` Вугілля поглинає частину ауксину: ефективна концентрація ≈ ${fnum(r.Ce, 2)} мг/л — тому з вугіллям можна брати більше ІОК.`;
    verdict($('m4-verdict'), msg, lvl);
  }

  function draw() {
    const F = fitStage(); if (!F) return;
    const { ctx, w, h, narrow } = F;
    const day = anim.on ? anim.day : DAYS;
    scene(ctx, w, h, { kind: 'room', horizon: narrow ? 0.55 : 0.86, light: 0.35 });
    // лампи: інтенсивність світла
    const glow = clamp(st.I / 6000, 0.1, 1);
    const lg = ctx.createLinearGradient(0, 0, 0, h * 0.5); lg.addColorStop(0, `rgba(255,252,225,${0.35 + 0.45 * glow})`); lg.addColorStop(1, 'rgba(255,252,225,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h * 0.5);
    const n = 5;
    const RX = narrow ? { x: 16, w: w - 32, top: h * 0.1 } : { x: w * 0.04, w: w * 0.58, top: h * 0.13 };
    const tw = Math.min(56, RX.w / n * 0.64), th = narrow ? h * 0.47 : h * 0.72;
    const tubes = []; for (let i = 0; i < n; i++) tubes.push({ cx: RX.x + RX.w / n * (i + 0.5), w: tw });
    rackBack(ctx, RX.x - 4, RX.top + th * 0.12, RX.w + 8, tubes);
    const medC = st.base === 'charcoal' ? '#262724' : st.half ? '#EFEAD2' : MAT.agar;
    const plants = [];
    tubes.forEach((t, i) => {
      const R = rng(i * 31 + 7), k = R(), rooted = k < r.share;
      const nr = rooted ? Math.max(1, Math.round(r.nRoots * (0.7 + 0.6 * R()))) : 0, lf = 0.7 + 0.5 * R();
      plants.push({ rooted, nr, lf });
      tube(ctx, t.cx - tw / 2, RX.top, tw, th, {
        medium: { level: 0.3, color: medC, gel: true }, plug: 'foil',
        contents: (c, inn) => {
          const cx = inn.x + inn.w / 2, sY = inn.surface + 3;
          if (r.callus > 0.05) callus(c, cx, sY + 2, inn.w * 0.18 * smooth(3, 18, day) * (0.4 + r.callus), { color: '#E9E2B8', green: 0.15, seed: i + 3 });
          if (rooted) roots(c, cx, sY, { n: nr, len: r.len(day) * lf * (th * 0.3) / 40, seed: i + 11, w: 1 + r.callus, spread: 1.7, maxY: RX.top + th - 5, color: st.base === 'charcoal' ? '#F6F2E6' : MAT.root });
          const g = 0.75 + 0.25 * smooth(0, DAYS, day);
          rosette(c, cx, sY - 2, { n: 6, leafLen: inn.w * 0.95 * g, seed: i + 2, color: '#5E9C47', width: 0.32, spread: 1.4, pale: st.I > 4500 ? 0.25 : 0 });
        },
      });
      if (st.base === 'foil') foil(ctx, t.cx - tw / 2, RX.top + th * 0.68, tw, th * 0.32);
    });
    rackFront(ctx, RX.x - 6, RX.top + th * 0.93, RX.w + 12, th * 0.07 + 8);
    // лупа на основі пагона №1
    const P = plants.find((p) => p.rooted) || plants[0];
    const Lr0 = narrow ? Math.min(w * 0.28, (h - RX.top - th - 70) / 2) : 0;
    const L = narrow ? { cx: w * 0.5, cy: RX.top + th + 40 + Lr0, r: Lr0 } : { cx: w * 0.81, cy: h * 0.45, r: Math.min(w * 0.15, h * 0.33) };
    microField(ctx, L.cx, L.cy, L.r, (c) => {
      const g = c.createLinearGradient(0, L.cy - L.r, 0, L.cy + L.r); const mc = st.base === 'charcoal' ? ['#3A3B37', '#1A1B19'] : ['#F2ECD2', '#DCD3AE'];
      g.addColorStop(0, '#EAF0E6'); g.addColorStop(0.3, '#EAF0E6'); g.addColorStop(0.3, mc[0]); g.addColorStop(1, mc[1]);
      c.fillStyle = g; c.fillRect(L.cx - L.r, L.cy - L.r, 2 * L.r, 2 * L.r);
      const by = L.cy - L.r * 0.4;
      if (r.callus > 0.05) callus(c, L.cx, by + L.r * 0.08, L.r * 0.5 * smooth(3, 18, day) * (0.4 + r.callus), { color: '#E9E2B8', green: 0.15, seed: 4 });
      if (P.rooted) roots(c, L.cx, by, { n: P.nr, len: r.len(day) * P.lf * L.r * 1.4 / 40, seed: 11, w: 2 + 2 * r.callus, spread: 1.9, color: st.base === 'charcoal' ? '#F6F2E6' : '#C9B78C' });
      c.fillStyle = '#6FA243'; roundRect(c, L.cx - L.r * 0.1, L.cy - L.r * 1.1, L.r * 0.2, L.r * 0.72, 4); c.fill();
    }, { mode: 'bright', scale: { px: L.r * 0.5, text: '5 мм' } });
    if (!narrow) text(ctx, 'основа пагона (лупа)', L.cx, L.cy + L.r * 1.1 + 18, { align: 'center', size: 12, weight: 700, color: '#23382B' });
    const rooted = plants.filter((p) => p.rooted).length;
    pill(ctx, anim.on ? `Доба ${Math.round(day)} з ${DAYS}` : `Прогноз на ${DAYS}-му добу`, 10, 10);
    pill(ctx, `${fnum(st.I, 0)} лк · +23–24 °C · 14 год`, 10, 36, { dark: false });
    if (day >= DAYS * 0.98) text(ctx, `Укоренилося ${rooted} з ${n}`, RX.x + RX.w / 2, narrow ? RX.top + th + 22 : Math.min(h - 8, RX.top + th + 30), { align: 'center', size: 12.5, weight: 800, color: '#173322' });
  }
  const runner = new Runner({
    btn: $('m4-run'), reset: $('m4-reset'), status: $('m4-status'),
    step: (dt, t, reset) => {
      if (reset) { anim.on = false; $('m4-status').textContent = ''; return; }
      anim.on = true; anim.day = Math.min(DAYS, t * 3.2);
      $('m4-status').textContent = anim.day < r.lag ? `Доба ${Math.round(anim.day)}: закладаються зачатки коренів` : `Доба ${Math.round(anim.day)}: ріст коренів`;
      if (anim.day >= DAYS) runner.finish();
    },
    draw,
  });
  onResize(cv.parentElement, draw);
  update();
  return { draw, runner };
}
