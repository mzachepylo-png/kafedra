// Вкладка 3. Мікробульби картоплі in vitro (ЛР 29): сахароза, кінетин, фотоперіод і нічна температура.
import { scene, tube, microField, Runner, onResize, Plot, sliders, segmented, fnum, rng, clamp, smooth, MAT, TAU } from './kit.js';
import { tuber } from './t08-math.js';
import { rackBack, rackFront, shoot, roots, microtuber, pill, text } from './t08-draw.js';
import { stageFit, reads, verdict, presets, scheduler } from './t08-ui.js';

const DAYS = 65; // увесь цикл від мікрочеренкування до мікробульб — 60–65 діб (с. 119)
const REG = { sd: '16 → 12 год, ніч +19–20 °C', ld: '16 год, +25 °C постійно', cold: '16 год, далі +10 °C' };

export function init(root) {
  const $ = (id) => root.querySelector('#' + id);
  const cv = $('m3-cv');
  const fitStage = stageFit(cv, { desk: 16 / 8.6, mob: 0.8, min: 330, max: 500, mobMax: 540 });
  const st = { s: 50, c: 0.5, regime: 'sd' };
  let r = tuber(st);
  const anim = { on: false, day: DAYS };

  const seg = segmented($('m3-reg'), 'm3r', Object.entries(REG).map(([value, label]) => ({ value, label })), st.regime, (v) => { st.regime = v; update(); });
  const sl = sliders($('m3-sliders'), [
    { id: 's', label: 'Сахароза', min: 20, max: 120, step: 5, value: st.s, unit: 'г/л', hint: 'рецепт ЛР 29 — 50 г/л; «до 8 %» = 80 г/л (с. 119)' },
    { id: 'c', label: 'Кінетин', min: 0, max: 2, step: 0.05, value: st.c, unit: 'мг/л', hint: 'цитокінін; у рецепті 0,5 мг/л' },
  ], () => { Object.assign(st, sl.values); update(); });
  const setAll = (o) => { Object.assign(st, o); seg.select(st.regime); sl.set('s', st.s, true); sl.set('c', st.c, true); update(); };
  presets($('m3-presets'), [
    { label: 'Рецепт ЛР 29', apply: () => setAll({ s: 50, c: 0.5, regime: 'sd' }) },
    { label: '8 % сахарози', apply: () => setAll({ s: 80, c: 0.5, regime: 'sd' }) },
    { label: 'Середовище живцювання (20 г/л)', apply: () => setAll({ s: 20, c: 0.25, regime: 'ld' }) },
    { label: 'Довгий день + холод +10 °C', apply: () => setAll({ s: 50, c: 0.5, regime: 'cold' }) },
  ]);
  const p1 = new Plot($('m3-p1'), { xLabel: 'Доба культивування', yLabel: 'Маса мікробульби, мг', x: [0, DAYS], y: [0, 400], xShort: 'доба', aspect: 1.55 });
  const p2 = new Plot($('m3-p2'), { xLabel: 'Сахароза, г/л', yLabel: 'Маса на 65-ту добу, мг', x: [20, 120], y: [0, 400], xShort: 'сахароза', aspect: 1.55 });

  function update() {
    r = tuber(st);
    if (!runner.running) runner.reset(); else draw();
    const m = (o) => { const t = tuber(o), a = []; for (let d = 0; d <= DAYS; d++) a.push([d, t.mass(d)]); return a; };
    p1.set([
      { data: m({ ...st, s: 20 }), color: '#9AA8A0', label: '20 г/л', width: 2, dash: [5, 4] },
      { data: m({ ...st, s: 80 }), color: '#B7791F', label: '80 г/л', width: 2, dash: [2, 3] },
      { data: m(st), color: '#2E7D5B', label: `поточне: ${st.s} г/л`, width: 3, fill: 'rgba(46,125,91,.1)' },
    ], isFinite(r.t1) && r.t1 < DAYS ? [{ x: r.t1, label: `бульби з ${Math.round(r.t1)}-ї доби`, color: '#8C6A10' }] : []);
    const sv = (regime) => { const a = []; for (let s = 20; s <= 120; s += 2) a.push([s, tuber({ ...st, s, regime }).mass(DAYS)]); return a; };
    p2.set([
      { data: sv('ld'), color: '#B7791F', label: '16 год, +25 °C', width: 2, dash: [6, 4] },
      { data: sv('cold'), color: '#1F6F8B', label: '+10 °C', width: 2, dash: [2, 3] },
      { data: sv('sd'), color: '#2E7D5B', label: '16 → 12 год', width: 3 },
    ], [{ x: st.s, color: '#8E3B2E', label: `${st.s} г/л` }]);
    const m65 = r.mass(DAYS);
    reads(root, {
      S: fnum(r.S, 2), t1: isFinite(r.t1) && r.t1 < DAYS ? `${Math.round(r.t1)}-та доба` : 'не утворюються',
      n: m65 > 0 ? `${r.count}` : '0', m: m65 > 0 ? `${fnum(m65, 0)} мг` : '—', d: m65 > 0 ? `${fnum(r.diam(m65), 1)} мм` : '—',
      share: `${fnum(100 * r.share, 0)} %`,
    });
    let lvl = 'ok', msg;
    if (m65 <= 0) { lvl = 'bad'; msg = `За ${st.s} г/л сахарози ${st.regime === 'ld' ? 'й довгого теплого дня ' : ''}рослини лише ростуть пагонами — стимулу до бульбоутворення замало. Підвищте сахарозу до 50–80 г/л і перейдіть на 12-годинний день з прохолодними ночами.`; }
    else if (r.S < 0.4) { lvl = 'warn'; msg = `Бульбоутворення слабке й пізнє (з ${Math.round(r.t1)}-ї доби): дрібні мікробульби ≈ ${fnum(r.diam(m65), 1)} мм. Головний чинник — вуглеводи: сахароза є і джерелом енергії, і осмотичним сигналом до запасання крохмалю.`; }
    else { msg = `Мікробульби з’являються приблизно через ${Math.round(r.t1)} діб (у посібнику — «через один місяць»), до 65-ї доби — ${r.count} шт. на рослину, ≈ ${fnum(m65, 0)} мг і ${fnum(r.diam(m65), 1)} мм у діаметрі. Їх зберігають по 10 шт. у стерильних пробірках при +5 °C і вологості 95 % до 6 місяців.`; }
    if (st.s > 90) { lvl = 'warn'; msg += ' Понад 9 % сахарози осмотичний тиск середовища вже гальмує ріст.'; }
    verdict($('m3-verdict'), msg, lvl);
  }

  function plantTubers(i) {
    const R = rng(i * 13 + 5);
    const k = R(), Si = r.S * (0.8 + 0.4 * R());
    const has = k < r.share;
    const n = has ? clamp(r.count + (R() < 0.3 ? -1 : R() > 0.8 ? 1 : 0), 1, 4) : 0;
    return { has, n, Si, k, R };
  }
  function draw() {
    const { ctx, w, h, narrow } = fitStage();
    const day = anim.on ? anim.day : DAYS;
    const hy = scene(ctx, w, h, { kind: 'room', horizon: narrow ? 0.56 : 0.78, light: 0.35 });
    const n = 5;
    const RX = narrow ? { x: 18, w: w - 36, top: h * 0.08 } : { x: w * 0.04, w: w * 0.56, top: h * 0.1 };
    const tw = Math.min(54, RX.w / n * 0.62), th = narrow ? h * 0.48 : h * 0.68;
    const pxmm = (tw * 0.88) / 16; // внутрішній діаметр пробірки ≈ 16 мм
    const tubes = []; for (let i = 0; i < n; i++) tubes.push({ cx: RX.x + RX.w / n * (i + 0.5), w: tw });
    rackBack(ctx, RX.x - 4, RX.top + th * 0.12, RX.w + 8, tubes);
    const medC = st.s > 70 ? '#E8DDB2' : MAT.agar;
    let shownD = 0;
    tubes.forEach((t, i) => {
      const P = plantTubers(i);
      tube(ctx, t.cx - tw / 2, RX.top, tw, th, {
        medium: { level: 0.26, color: medC }, plug: 'foil',
        contents: (c, inn) => {
          const cx = inn.x + inn.w / 2, sY = inn.surface;
          const grow = smooth(0, 40, day);
          const slow = P.has ? 1 - 0.35 * smooth(r.t1, r.t1 + 20, day) : 1;
          roots(c, cx, sY, { n: 5, len: (th * 0.24) * (0.3 + 0.7 * smooth(4, 30, day)), seed: i + 2, w: 1.1, maxY: RX.top + th - 4 });
          const H = th * 0.62 * (0.12 + 0.88 * grow) * (0.85 + 0.25 * P.k) * slow;
          const sh = shoot(c, cx, sY, { h: H, nodes: Math.max(2, Math.round(2 + 5 * grow)), leafLen: Math.min(inn.w * 0.5, 6 + 12 * grow), leafW: 0.55, seed: 20 + i, pale: P.has ? 0.25 * smooth(r.t1, DAYS, day) : 0, stemW: 1.8 });
          if (!P.has || !(day > r.t1)) return;
          const m = r.mass(day) * P.Si / Math.max(0.01, r.S);
          const d = r.diam(m), rad = Math.max(1, d * pxmm / 2 / 1.1);
          shownD = Math.max(shownD, d);
          // столони й бульби: перша — біля основи на агарі, решта — у пазухах нижніх вузлів
          const spots = [{ x: cx + inn.w * 0.12, y: sY - rad * 0.5, a: 0.2 }];
          for (let j = 0; j < sh.nodes.length && spots.length < P.n; j++) if (j % 2 === 0) { const nd = sh.nodes[j]; spots.push({ x: nd.x + nd.side * rad * 0.9, y: nd.y + rad * 0.2, a: nd.side * 0.5 }); }
          spots.slice(0, P.n).forEach((p, j) => {
            const rr = rad * (j === 0 ? 1 : 0.75);
            c.strokeStyle = 'rgba(210,200,160,.95)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx, p.y + rr * 0.4); c.quadraticCurveTo((cx + p.x) / 2, p.y + rr, p.x, p.y); c.stroke();
            microtuber(c, p.x, p.y, rr, { ang: p.a, green: 0.25, seed: i * 7 + j });
          });
        },
      });
    });
    rackFront(ctx, RX.x - 6, RX.top + th * 0.82, RX.w + 12, th * 0.18 + 4);
    // лупа: збільшена мікробульба з міліметровою шкалою
    const m = r.mass(day), d = r.diam(m);
    const L = narrow ? { cx: w * 0.3, cy: RX.top + th + (h - RX.top - th) * 0.5 + 4, r: Math.min(w * 0.22, (h - RX.top - th) * 0.4) } : { cx: w * 0.76, cy: h * 0.4, r: Math.min(w * 0.15, h * 0.3) };
    microField(ctx, L.cx, L.cy, L.r, (c) => {
      const g = c.createLinearGradient(0, L.cy - L.r, 0, L.cy + L.r); g.addColorStop(0, '#F3EED6'); g.addColorStop(1, '#D9CFA6'); c.fillStyle = g; c.fillRect(L.cx - L.r, L.cy - L.r, 2 * L.r, 2 * L.r);
      const ppm = L.r / 6; // поле зору ≈ 12 мм
      c.strokeStyle = 'rgba(120,90,40,.25)'; c.lineWidth = 0.6; for (let x = -6; x <= 6; x++) { c.beginPath(); c.moveTo(L.cx + x * ppm, L.cy - L.r); c.lineTo(L.cx + x * ppm, L.cy + L.r); c.stroke(); c.beginPath(); c.moveTo(L.cx - L.r, L.cy + x * ppm); c.lineTo(L.cx + L.r, L.cy + x * ppm); c.stroke(); }
      if (d > 0) microtuber(c, L.cx, L.cy, d * ppm / 2 / 1.1, { ang: 0.15, green: 0.2, seed: 3 });
      else { c.strokeStyle = 'rgba(200,190,150,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(L.cx - L.r * 0.6, L.cy + 4); c.quadraticCurveTo(L.cx, L.cy - 6, L.cx + L.r * 0.5, L.cy + 2); c.stroke(); }
    }, { mode: 'bright', scale: { px: 5 * L.r / 6, text: '5 мм' } });
    text(ctx, d > 0 ? `мікробульба Ø ${fnum(d, 1)} мм` : 'лише столон, без бульби', L.cx, L.cy + L.r * 1.1 + 20, { align: 'center', size: 12, weight: 700, color: '#23382B' });
    // пробірка для зберігання (після 60-ї доби)
    if (day >= 60 && m > 0) {
      const sx = narrow ? w * 0.72 : w * 0.76, sw = narrow ? 30 : 34, sh2 = narrow ? Math.min(140, h - RX.top - th - 40) : h * 0.3, sy = narrow ? RX.top + th + 22 : h * 0.66;
      tube(ctx, sx - sw / 2, sy, sw, sh2, { medium: { level: 0 }, plug: 'cotton', contents: (c, inn) => { for (let j = 0; j < 10; j++) { const R = rng(j + 40); microtuber(c, inn.x + inn.w * (0.25 + 0.5 * R()), inn.y + inn.h - 6 - j * Math.min(9, inn.h / 11), Math.min(inn.w * 0.28, 2.5 + d * 0.5), { ang: R() * 3, seed: j, green: 0.15 }); } } });
      text(ctx, '10 шт. · +5 °C · 95 %', sx, sy + sh2 + 18, { align: 'center', size: 11, weight: 700, color: '#23382B' });
    }
    pill(ctx, anim.on ? `Доба ${Math.round(day)} з ${DAYS}` : `Прогноз на ${DAYS}-ту добу`, 10, 10);
    pill(ctx, `${REG[st.regime]}`, 10, 36, { dark: false });
  }
  const runner = new Runner({
    btn: $('m3-run'), reset: $('m3-reset'), status: $('m3-status'),
    step: (dt, t, reset) => {
      if (reset) { anim.on = false; $('m3-status').textContent = ''; return; }
      anim.on = true; anim.day = Math.min(DAYS, t * 6.5);
      const ph = anim.day < 12 ? 'довгий день 16 год' : st.regime === 'sd' ? '12-годинний день' : st.regime === 'cold' ? 'холодна камера +10 °C' : '16 год, +25 °C';
      $('m3-status').textContent = `Доба ${Math.round(anim.day)} · ${ph}`;
      if (anim.day >= DAYS) runner.finish();
    },
    draw,
  });
  onResize(cv.parentElement, draw);
  update();
  return { draw, runner };
}
