// Вкладка 2. Мікроживцювання (ЛР 30) і прискорене мікророзмноження на БАП (ЛР 32): геометрична прогресія.
import { scene, tube, petri, flask, callus, Runner, onResize, Plot, sliders, segmented, fnum, rng, clamp, smooth, easeInOut, MAT, TAU, roundRect, shadow } from './kit.js';
import { cutting, cuttingSeries, passagesFor, accelerated, accK, accV } from './t08-math.js';
import { rackBack, rackFront, scalpel, shoot, roots, pill, text } from './t08-draw.js';
import { stageFit, reads, verdict, presets, checkbox, scheduler } from './t08-ui.js';

const sup = (n) => String(n).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c] ?? c).join('');
const big = (v) => (v < 1e5 ? fnum(v, 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : fnum(v, 2));

export function init(root) {
  const $ = (id) => root.querySelector('#' + id);
  const cv = $('m2-cv');
  const fitStage = stageFit(cv, { desk: 16 / 8.6, mob: 0.78, min: 330, max: 500, mobMax: 560 });
  const st = { mode: 'cut', crop: 'potato', k: 6, tau: 21, q: 0.1, p: 0.5, T: 365, t0: 45, thermo: false, B1: 5, B2: 2, target: 1e5 };
  const anim = { on: false, day: 0 };
  let R0;

  segmented($('m2-mode'), 'm2m', [{ value: 'cut', label: 'Черенкування (ЛР 30)' }, { value: 'acc', label: 'Прискорене на БАП (ЛР 32)' }], st.mode, (v) => { st.mode = v; toggle(); update(); });
  segmented($('m2-crop'), 'm2c', [{ value: 'potato', label: 'Картопля: 2 бруньки' }, { value: 'carn', label: 'Гвоздика: 1 брунька' }], st.crop, (v) => { st.crop = v; update(); });
  const sl = sliders($('m2-sliders'), [
    { id: 'k', label: 'Живців з однієї рослини k', min: 3, max: 10, step: 1, value: st.k, unit: 'шт.', hint: 'у посібнику 5–8 (с. 121)' },
    { id: 'tau', label: 'Інтервал між черенкуваннями τ', min: 14, max: 35, step: 1, value: st.tau, unit: 'діб', hint: '14–21 доба (с. 121)' },
    { id: 'B1', label: 'БАП на етапі індукції бруньок', min: 0, max: 8, step: 0.5, value: st.B1, unit: 'мг/л', hint: '4–6 мг/л, 2–3 тижні (с. 124)' },
    { id: 'B2', label: 'БАП на етапі розмноження пагонів', min: 0, max: 6, step: 0.25, value: st.B2, unit: 'мг/л', hint: 'знижують до 2 мг/л; пасаж кожні 14 діб' },
    { id: 'q', label: 'Втрати за пасаж q', min: 0, max: 0.4, step: 0.05, value: st.q, unit: '', format: (v) => fnum(100 * v, 0) + ' %', hint: 'інфекція, загибель, неукорінення' },
    { id: 'p', label: 'Частка живців, що знову йде в розмноження p', min: 0.2, max: 1, step: 0.05, value: st.p, unit: '', format: (v) => fnum(100 * v, 0) + ' %', hint: 'решта — на укорінення й висаджування' },
    { id: 'T', label: 'Горизонт планування', min: 60, max: 730, step: 5, value: st.T, unit: 'діб' },
    { id: 'target', label: 'Потрібно рослин', min: 1000, max: 1e7, value: st.target, log: true, unit: '', format: (v) => big(v) },
  ], () => { Object.assign(st, sl.values); update(); });
  const thermoCb = checkbox($('m2-opts'), 'Маточні рослини після термотерапії (K +50 %, с. 112)', st.thermo, (v) => { st.thermo = v; update(); });
  function toggle() {
    const acc = st.mode === 'acc';
    for (const id of ['k', 'tau', 'p']) sl.inputs[id].row.hidden = acc;
    for (const id of ['B1', 'B2']) sl.inputs[id].row.hidden = !acc;
    thermoCb.parentElement.hidden = acc;
    $('m2-crop').hidden = acc;
  }
  presets($('m2-presets'), [
    { label: 'Чиста прогресія: p = 100 %', apply: () => { sl.set('p', 1); } },
    { label: 'Посібник: k = 5, τ = 21 доба', apply: () => { sl.set('k', 5, true); sl.set('tau', 21, true); sl.set('q', 0.2, true); sl.set('p', 1); } },
    { label: 'ЛР 32 без зниження БАП (5 мг/л)', apply: () => { st.mode = 'acc'; $('m2-mode').querySelector('[data-value="acc"]').click(); sl.set('B2', 5); } },
  ]);

  const p1 = new Plot($('m2-p1'), { xLabel: 'Час від введення меристеми, діб', yLabel: 'lg N (рослин)', y: 'auto', xShort: 'доба', aspect: 1.55, yZero: true });
  const p2 = new Plot($('m2-p2'), { xLabel: 'Інтервал τ, діб', yLabel: 'lg N за горизонт', xShort: 'τ', aspect: 1.55 });

  function calc() {
    if (st.mode === 'cut') {
      const o = { N0: 1, k: st.k, q: st.q, tau: st.tau, T: st.T, t0: st.t0, thermo: st.thermo, p: st.p };
      const r = cutting(o);
      return { ...r, o, series: cuttingSeries(o), nStar: passagesFor(st.target, 1, r.K), per: st.tau, start: st.t0 };
    }
    const r = accelerated({ N0: 1, B1: st.B1, B2: st.B2, q: st.q, T: st.T });
    const series = [];
    const start = 21; // індукція бруньок 2–3 тижні
    for (let i = 0; start + i * 14 + 28 <= st.T; i++) series.push({ i, day: start + i * 14, M: r.Pind * Math.pow(r.Kp, i), total: r.Pind * Math.pow(r.Kp, i) * 0.9 });
    return { ...r, K: r.Kp, M: r.N / 0.9, O: 0, series, nStar: passagesFor(st.target / 0.9 / Math.max(1e-6, r.Pind), 1, r.Kp), per: 14, start };
  }

  function update() {
    R0 = calc();
    if (!runner.running) runner.reset(); else draw();
    plotIt(); readIt();
  }
  function plotIt() {
    const s = R0.series, d = [];
    if (s.length) { d.push([0, 0]); for (const e of s) d.push([e.day, Math.log10(Math.max(1, e.total))]); d.push([st.T, d[d.length - 1][1]]); }
    let pure = null;
    if (st.mode === 'cut' && st.p < 1) { const ps = cuttingSeries({ ...R0.o, p: 1 }); pure = [[0, 0], ...ps.map((e) => [e.day, Math.log10(e.total)]), [st.T, Math.log10(ps[ps.length - 1]?.total || 1)]]; }
    p1.setOptions({ x: [0, st.T] });
    p1.set([
      pure ? { data: pure, color: '#9AA8A0', label: 'якби p = 100 % (N₀·Kⁿ)', type: 'step', width: 2, dash: [5, 4] } : null,
      { data: d, color: '#2E7D5B', label: 'усього рослин N', type: 'step', width: 3, fill: 'rgba(46,125,91,.1)' },
    ], [{ y: 5, label: '10⁵ — орієнтир посібника (за рік)', color: '#B7791F' }, { y: Math.log10(st.target), label: 'ціль', color: '#8E3B2E' }, { x: 365, color: 'rgba(31,111,139,.5)' }]);
    if (st.mode === 'cut') {
      p2.setOptions({ xLabel: 'Інтервал τ, діб', yLabel: 'lg N за горизонт', x: [14, 35], xShort: 'τ' });
      const ser = (k) => { const a = []; for (let t = 14; t <= 35; t++) a.push([t, Math.log10(Math.max(1, cutting({ ...R0.o, k, tau: t }).N))]); return a; };
      p2.set([{ data: ser(5), color: '#B7791F', label: 'k = 5', width: 2 }, { data: ser(8), color: '#5B4BA8', label: 'k = 8', width: 2 }, { data: ser(st.k), color: '#2E7D5B', label: `k = ${st.k} (поточне)`, width: 3 }], [{ x: st.tau, color: '#1F6F8B' }]);
    } else {
      p2.setOptions({ xLabel: 'БАП на етапі розмноження, мг/л', yLabel: 'Пагонів на експлантат за пасаж', x: [0, 6], xShort: 'БАП' });
      const a = [], b = [];
      for (let B = 0; B <= 6.001; B += 0.1) { a.push([B, accK(B)]); b.push([B, accK(B) * (1 - accV(B)) * (1 - st.q)]); }
      p2.set([{ data: a, color: '#9AA8A0', label: 'утворилося пагонів', width: 2, dash: [5, 4] }, { data: b, color: '#2E7D5B', label: 'придатних (без гіпергідричних і втрат)', width: 3 }], [{ x: st.B2, label: `${fnum(st.B2, 2)} мг/л`, color: '#1F6F8B' }]);
    }
  }
  function readIt() {
    const r = R0, acc = st.mode === 'acc';
    const tStar = r.start + r.nStar * r.per + (acc ? 28 : 0);
    reads(root, {
      K: fnum(r.K, 2), n: String(acc ? r.n : r.n), M: big(r.M), O: acc ? '—' : big(r.O), N: big(r.N), S: acc ? '—' : big(r.S),
      star: isFinite(r.nStar) ? `${r.nStar} пасажів ≈ ${Math.round(tStar)} діб` : 'недосяжно (K ≤ 1)',
    });
    let lvl = 'ok', msg;
    if (!acc) {
      msg = `Кожна рослина дає ${st.k} живців (по ${st.crop === 'potato' ? 'дві пазушні бруньки — картопля' : 'одній пазушній бруньці — гвоздика'}); з урахуванням втрат K = ${fnum(r.K, 2)}. За ${r.n} пасажів по ${st.tau} діб ${st.p < 1 ? `маточний фонд зростає як (pK)ⁿ = ${fnum(st.p * r.K, 2)}ⁿ, а решта живців іде на укорінення — разом ${big(r.N)} рослин.` : `чиста геометрична прогресія дає N₀·Kⁿ = ${fnum(r.K, 2)}${sup(r.n)} ≈ ${big(r.N)} рослин.`}`;
      if (r.N > 1e7) { lvl = 'warn'; msg += ' Це теоретична межа: насправді кількість обмежують руки лаборантів, площа культуральної кімнати й посуд — тому в посібнику орієнтир 10⁵–10⁶ рослин на рік з однієї меристеми.'; }
      if (r.K <= 1) { lvl = 'bad'; msg = 'Втрати з’їдають увесь приріст: K ≤ 1, і кількість рослин не зростає. Перевірте стерильність і умови укорінення.'; }
    } else {
      msg = `Індукція бруньок на БАП ${fnum(st.B1, 1)} мг/л переводить у проліферацію ${fnum(100 * r.Pind, 0)} % експлантатів. На етапі розмноження з БАП ${fnum(st.B2, 2)} мг/л утворюється ${fnum(r.Kraw, 1)} пагона на експлантат за 14 діб, з них гіпергідричних ${fnum(100 * r.v, 0)} %.`;
      if (st.B2 > 3.5) { lvl = 'warn'; msg += ' Надлишок цитокініну дає скловидні (гіпергідричні) пагони, що не укорінюються — саме тому в ЛР 32 концентрацію БАП знижують до 2 мг/л.'; }
      if (st.B1 < 3) { lvl = 'warn'; msg += ' Замало БАП на індукції: апікальне домінування не знято, більшість бруньок не проліферує.'; }
    }
    verdict($('m2-verdict'), msg, lvl);
  }

  // ---------- малювання ----------
  function stockAt(day) {
    const s = R0.series; let cur = s.length ? { ...s[0], total: 1, M: 1 } : { M: 1, total: 1, i: 0 };
    if (day < R0.start) return { M: 1, total: 1, i: -1, phase: day / Math.max(1, R0.start) };
    for (const e of s) if (e.day <= day) cur = e;
    return { ...cur, phase: clamp((day - (cur.day ?? 0)) / R0.per, 0, 1) };
  }
  function draw() {
    const { ctx, w, h, narrow } = fitStage();
    const day = anim.on ? anim.day : st.T;
    const hy = scene(ctx, w, h, { kind: narrow ? 'hood' : 'hood', horizon: narrow ? 0.5 : 0.58, light: 0.3 });
    const s = stockAt(day);
    const acc = st.mode === 'acc';
    // ліва частина
    const L = narrow ? { x: 0, w: w, cy: h * 0.27 } : { x: 0, w: w * 0.44, cy: h * 0.62 };
    if (!acc) {
      const r = Math.min(L.w * 0.42, narrow ? h * 0.2 : h * 0.34);
      const cx = L.x + L.w / 2, cy = narrow ? hy - r * 0.15 : hy + (h - hy) * 0.35;
      const ph = anim.on ? s.phase : 0.98;
      const budsPer = st.crop === 'potato' ? 2 : 1;
      const nodes = Math.max(2, Math.round(2 + ph * (st.k * budsPer - 1)));
      petri(ctx, cx, cy, r, {
        tilt: 0.5, medium: { color: '#EEF1EC' },
        contents: (c, p) => {
          // мокрий фільтрувальний папір
          c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(p.cx, p.cy, p.rx * 0.92, p.ry * 0.92, 0, 0, TAU); c.fill();
          const len = p.rx * 1.5 * (0.45 + 0.55 * ph);
          c.save(); c.translate(p.cx - len / 2, p.cy + p.ry * 0.08); c.scale(1, 0.62); c.rotate(Math.PI / 2);
          roots(c, 0, 0, { n: 4, len: r * 0.3, seed: 3, w: 1, spread: 1 });
          const sh = shoot(c, 0, 0, { h: len, nodes, leafLen: r * 0.17, leafW: st.crop === 'carn' ? 0.2 : 0.5, opposite: st.crop === 'carn', color: st.crop === 'carn' ? '#6F9E80' : MAT.leaf, seed: 5, stemW: 2.4 });
          // лінії розрізу між групами з b вузлів
          c.strokeStyle = 'rgba(30,110,160,.85)'; c.lineWidth = 1.4; c.setLineDash([3, 2]);
          const cuts = [];
          for (let i = budsPer; i < sh.nodes.length; i += budsPer) { const a = sh.nodes[i - 1], b = sh.nodes[i]; cuts.push([(a.x + b.x) / 2, (a.y + b.y) / 2]); }
          for (const [x, y] of cuts) { c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x + 9, y); c.stroke(); }
          c.setLineDash([]);
          c.restore();
        },
      });
      if (anim.on && s.phase < 0.12 && s.i >= 0) scalpel(ctx, cx - r * 0.6 + r * 1.2 * (s.phase / 0.12), cy - r * 0.05, 0.25, Math.max(0.55, r / 190));
      text(ctx, `Мікроживці по ${st.crop === 'potato' ? '2 бруньки (картопля)' : '1 бруньці (гвоздика)'}, 3–5 мм`, cx, cy + r * 0.5 + 30, { align: 'center', size: 11.5, color: '#23382B', weight: 700 });
    } else {
      const fs = narrow ? Math.min(h * 0.24, w * 0.3) : Math.min(h * 0.4, L.w * 0.36);
      const by = narrow ? hy + 6 : hy + (h - hy) * 0.45;
      const xs = narrow ? [w * 0.2, w * 0.5, w * 0.8] : [L.w * 0.2, L.w * 0.52, L.w * 0.84];
      const prog = anim.on ? clamp(s.i + 1, 0, 6) / 6 : 1;
      const stage = (cx, B, size, lbl, seed) => {
        flask(ctx, cx, by, fs, {
          liquid: { level: 0.28, color: '#EFEBCB', bubbles: 4 }, plug: 'foil', t: anim.day / 10,
          contents: (c, f) => {
            const n = Math.round(2 + size * 6);
            for (let i = 0; i < n; i++) { const R = rng(seed + i); const x = f.cx + (R() - 0.5) * f.bw * 0.5, y = f.by - 4 - R() * fs * 0.06; callus(c, x, y, fs * (0.06 + size * 0.05), { green: 0.85, seed: seed + i, glossy: 0.5 }); if (size > 0.3) shoot(c, x, y - fs * 0.04, { h: fs * 0.12 * size * (0.6 + R() * 0.6), nodes: 2, leafLen: fs * 0.06, seed: seed + i * 3, stemW: 1.2 }); }
          },
        });
        text(ctx, lbl, cx, by + 18, { align: 'center', size: 11, color: '#23382B', weight: 700 });
      };
      stage(xs[0], st.B1, 0.25 * (0.4 + 0.6 * R0.Pind), `індукція: БАП ${fnum(st.B1, 1)}`, 3);
      stage(xs[1], st.B2, Math.min(1, 0.25 + 0.75 * prog * (R0.Kp / 7)), `пагони: БАП ${fnum(st.B2, 1)}`, 9);
      // пробірка з укоріненням
      const tw = fs * 0.22, th = fs * 1.05;
      tube(ctx, xs[2] - tw / 2, by - th, tw, th, { medium: { level: 0.32 }, plug: 'foil', contents: (c, inn) => { roots(c, inn.x + inn.w / 2, inn.surface, { n: 4, len: th * 0.22, seed: 4, w: 1 }); shoot(c, inn.x + inn.w / 2, inn.surface, { h: th * 0.45, nodes: 4, leafLen: tw * 0.7, seed: 6 }); } });
      text(ctx, 'укорінення: ІОК 0,15', xs[2], by + 18, { align: 'center', size: 11, color: '#23382B', weight: 700 });
      if (R0.v > 0.25) { // скловидні пагони — позначка
        pill(ctx, `гіпергідричних ${fnum(100 * R0.v, 0)} %`, xs[1], by - fs - 26, { align: 'center', dark: false, color: '#9B2C1F' });
      }
    }
    // права частина: стелаж із пробірками (маточний фонд)
    const total = anim.on ? s.total : R0.N;
    const unitExp = Math.max(0, Math.ceil(Math.log10(Math.max(1, total) / 20)));
    const unit = Math.pow(10, unitExp);
    const shown = clamp(Math.ceil(total / unit), 1, 20);
    const RX = narrow ? { x: 16, w: w - 32, top: h * 0.6 } : { x: w * 0.47, w: w * 0.5, top: h * 0.2 };
    const per = 10, tw = Math.min(26, RX.w / per * 0.64), th = narrow ? h * 0.19 : h * 0.3;
    for (let row = 0; row < 2; row++) {
      const ty = RX.top + row * (th * 0.92 + 26) + (narrow ? 0 : 6);
      const tubes = []; for (let i = 0; i < per; i++) tubes.push({ cx: RX.x + RX.w / per * (i + 0.5), w: tw });
      rackBack(ctx, RX.x - 4, ty + th * 0.12, RX.w + 8, tubes);
      tubes.forEach((t, i) => {
        const idx = row * per + i, filled = idx < shown;
        tube(ctx, t.cx - tw / 2, ty, tw, th, {
          medium: { level: 0.28 }, plug: 'foil',
          contents: filled ? (c, inn) => { const R = rng(idx + 3); const g0 = anim.on ? clamp(0.35 + s.phase * 0.65, 0.3, 1) : 0.9; roots(c, inn.x + inn.w / 2, inn.surface, { n: 3, len: th * 0.14 * g0, seed: idx, w: 0.9 }); shoot(c, inn.x + inn.w / 2, inn.surface, { h: th * 0.5 * g0 * (0.8 + R() * 0.3), nodes: 3 + Math.round(g0 * 2), leafLen: tw * 0.62, leafW: st.crop === 'carn' && !acc ? 0.2 : 0.5, opposite: st.crop === 'carn' && !acc, color: st.crop === 'carn' && !acc ? '#6F9E80' : MAT.leaf, seed: idx * 5 + 1, stemW: 1.3 }); } : null,
        });
      });
      rackFront(ctx, RX.x - 6, ty + th * 0.8, RX.w + 12, th * 0.2 + 5);
    }
    // лічильник
    const cy2 = narrow ? RX.top - 46 : RX.top - 46;
    pill(ctx, `N = ${big(total)} рослин`, RX.x + RX.w / 2, Math.max(8, cy2), { align: 'center', size: 15 });
    text(ctx, unit > 1 ? `1 пробірка на стелажі ≈ 10${sup(unitExp)} рослин` : '1 пробірка = 1 рослина', RX.x + RX.w / 2, Math.max(8, cy2) + 40, { align: 'center', size: 11, color: '#2C4234', weight: 600 });
    // HUD
    pill(ctx, anim.on ? (day < R0.start ? `Доба ${Math.round(day)}: ${acc ? 'індукція бруньок' : 'рослина з меристеми'}` : `Доба ${Math.round(day)} · пасаж ${s.i + 1}`) : `Підсумок за ${st.T} діб`, 10, 10);
  }

  const runner = new Runner({
    btn: $('m2-run'), reset: $('m2-reset'), status: $('m2-status'),
    step: (dt, t, reset) => {
      if (reset) { anim.on = false; anim.day = 0; $('m2-status').textContent = ''; return; }
      anim.on = true; anim.day = Math.min(st.T, t * st.T / 12);
      const s = stockAt(anim.day);
      $('m2-status').textContent = `Доба ${Math.round(anim.day)}: ${big(s.total)} рослин`;
      if (anim.day >= st.T) runner.finish();
    },
    draw,
  });
  onResize(cv.parentElement, draw);
  toggle(); update();
  return { draw, runner };
}
