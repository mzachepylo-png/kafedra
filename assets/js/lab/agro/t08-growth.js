// Вкладка 6. Облік ростових характеристик регенерантів (ЛР 34) і сортування на три групи перед висаджуванням (ЛР 33).
import { scene, Runner, onResize, Plot, sliders, segmented, fnum, rng, clamp, smooth, MAT, TAU, roundRect, renderTable, downloadCSV, callout } from './kit.js';
import { CROPS6, growthLaw, lightFactors } from './t08-math.js';
import { graphPaper, ruler, shoot, roots, pill, text } from './t08-draw.js';
import { stageFit, reads, verdict, presets } from './t08-ui.js';

const DAYS = 42, NPL = 30;

export function init(root) {
  const $ = (id) => root.querySelector('#' + id);
  const cv = $('m6-cv');
  const fitStage = stageFit(cv, { desk: 16 / 8.2, mob: 0.75, min: 330, max: 500, mobMax: 580 });
  const st = { crop: 'potato', L0: 4, I: 2000, day: 28 };
  let pop = [];
  const anim = { on: false };

  const seg = segmented($('m6-crop'), 'm6c', [{ value: 'potato', label: 'Картопля' }, { value: 'carn', label: 'Гвоздика' }], st.crop, (v) => { st.crop = v; update(); });
  const sl = sliders($('m6-sliders'), [
    { id: 'day', label: 'Доба обліку', min: 0, max: DAYS, step: 1, value: st.day, unit: '', format: (v) => `${v}-та` },
    { id: 'L0', label: 'Довжина мікроживця L₀', min: 3, max: 5, step: 0.5, value: st.L0, unit: 'мм', hint: 'мікроживці 3–5 мм (ЛР 30)' },
    { id: 'I', label: 'Освітленість', min: 1000, max: 5000, step: 250, value: st.I, unit: 'лк', hint: 'ЛР 30 — 2000 лк, 14 год' },
  ], () => { Object.assign(st, sl.values); update(); });
  presets($('m6-presets'), [
    { label: 'ЛР 30: 2000 лк', apply: () => { sl.set('I', 2000); } },
    { label: 'Слабке світло (етіоляція)', apply: () => { sl.set('I', 1000); } },
    { label: 'Яскраве світло 5000 лк', apply: () => { sl.set('I', 5000); } },
  ]);
  $('m6-csv').addEventListener('click', () => { const t = journal(); downloadCSV('regenerants_growth.csv', t.head, t.rows); });
  const p1 = new Plot($('m6-p1'), { xLabel: 'Доба', yLabel: 'Довжина рослини, мм', x: [0, DAYS], y: 'auto', xShort: 'доба', aspect: 1.55 });
  const p2 = new Plot($('m6-p2'), { xLabel: 'Доба', yLabel: 'Маса, мг', x: [0, DAYS], y: 'auto', xShort: 'доба', aspect: 1.55 });

  function build() {
    const c = CROPS6[st.crop], lf = lightFactors(st.I), R = rng(st.crop === 'potato' ? 11 : 17);
    pop = [];
    for (let i = 0; i < NPL; i++) {
      const z1 = (R() + R() + R() - 1.5) * 1.4, z2 = (R() + R() - 1) * 1.4;
      const Lmax = c.Lmax * lf.rate * Math.exp(0.2 * z1);
      const law = growthLaw(st.L0, Lmax, c.r * Math.exp(0.08 * z2), c.tm);
      pop.push({ law, inter: c.inter * lf.inter * (1 + 0.08 * z2), seed: 100 + i });
    }
  }
  const meas = (p, t) => {
    const c = CROPS6[st.crop], L = p.law(t);
    const nodes = Math.max(0, Math.floor((L - 1) / p.inter));
    const fw = 0.9 * Math.pow(L, 1.45);
    const leaves = (c.opposite ? 2 : 1) * nodes + 2;
    const ll = Math.min(14, 0.18 * L + 2);
    return { L, nodes, inter: nodes ? (L - 1) / nodes : 0, fw, dw: 0.075 * fw, I: L / st.L0, K: Math.floor(nodes / c.buds), area: leaves * 0.6 * ll * ll / 100 };
  };
  const stats = (t) => {
    const m = pop.map((p) => meas(p, t)), avg = (k) => m.reduce((s, x) => s + x[k], 0) / m.length;
    const sd = Math.sqrt(m.reduce((s, x) => s + (x.L - avg('L')) ** 2, 0) / (m.length - 1));
    return { m, L: avg('L'), sd, nodes: avg('nodes'), inter: avg('inter'), fw: avg('fw'), dw: avg('dw'), I: avg('I'), K: avg('K'), area: avg('area') };
  };
  function journal() {
    const head = ['Доба', 'Довжина, мм (M ± SD)', 'Вузлів', 'Міжвузля, мм', 'Сира маса, мг', 'Суха маса, мг', 'Індекс росту', 'Площа листків, см²', 'Коеф. розмноження'];
    const rows = [];
    for (let d = 0; d <= DAYS; d += 7) { const s = stats(d); rows.push([d, `${fnum(s.L, 1)} ± ${fnum(s.sd, 1)}`, fnum(s.nodes, 1), fnum(s.inter, 1), fnum(s.fw, 0), fnum(s.dw, 1), fnum(s.I, 1), fnum(s.area, 2), fnum(s.K, 1)]); }
    return { head, rows };
  }
  function update() {
    build();
    if (!runner.running) runner.reset(); else draw();
    const mean = [], hi = [], lo = [], pts = [], fw = [], dw = [];
    for (let d = 0; d <= DAYS; d += 1) { const s = stats(d); mean.push([d, s.L]); hi.push([d, s.L + s.sd]); lo.push([d, Math.max(0, s.L - s.sd)]); fw.push([d, s.fw]); dw.push([d, s.dw * 10]); }
    for (let d = 0; d <= DAYS; d += 7) { const s = stats(d); pts.push([d, s.L, s.sd]); }
    p1.set([
      { data: hi, color: 'rgba(46,125,91,.35)', width: 1, dash: [3, 3] }, { data: lo, color: 'rgba(46,125,91,.35)', width: 1, dash: [3, 3] },
      { data: mean, color: '#2E7D5B', label: 'середня довжина', width: 3 },
      { data: pts, color: '#B7791F', label: 'облік кожні 7 діб (M ± SD)', type: 'points', errors: true },
    ], [{ x: st.day, color: '#1F6F8B', label: `${st.day}-та доба` }]);
    p2.set([{ data: fw, color: '#2E7D5B', label: 'сира маса', width: 3 }, { data: dw, color: '#8E3B2E', label: 'суха маса × 10', width: 2, dash: [6, 4] }], [{ x: st.day, color: '#1F6F8B' }]);
    const t = journal(); renderTable($('m6-table'), t.head, t.rows);
    readIt();
  }
  function readIt() {
    const s = stats(st.day);
    reads(root, { L: `${fnum(s.L, 1)} ± ${fnum(s.sd, 1)} мм`, nodes: fnum(s.nodes, 1), inter: `${fnum(s.inter, 1)} мм`, fw: `${fnum(s.fw, 0)} мг`, dw: `${fnum(s.dw, 1)} мг`, I: fnum(s.I, 1), area: `${fnum(s.area, 2)} см²`, K: fnum(s.K, 1) });
    const lf = lightFactors(st.I);
    let lvl = 'ok', msg = `На ${st.day}-ту добу рослини в середньому ${fnum(s.L, 1)} мм завдовжки (індекс росту ${fnum(s.I, 1)}), мають ${fnum(s.nodes, 1)} вузлів — з кожної можна нарізати ≈ ${fnum(s.K, 1)} мікроживців по ${CROPS6[st.crop].buds === 2 ? 'дві бруньки' : 'одній бруньці'}.`;
    if (st.I < 1500) { lvl = 'warn'; msg += ' За слабкого світла міжвузля видовжуються (етіоляція): рослини довгі, але тонкі й бліді, вузлів на одиницю довжини менше.'; }
    if (st.I > 4000) { lvl = 'warn'; msg += ' Яскраве світло робить рослини компактнішими, але може спричинити хлороз і затримку росту in vitro; зате в ґрунті такі рослини приживаються краще (с. 113).'; }
    if (st.day >= 21) msg += ' Перед висаджуванням рослини сортують на три групи — великі, середні й дрібні — і висаджують окремо (ЛР 33).';
    verdict($('m6-verdict'), msg, lvl);
  }
  function draw() {
    const F = fitStage(); if (!F) return;
    const { ctx, w, h, narrow } = F;
    const day = st.day;
    scene(ctx, w, h, { kind: 'bench', horizon: 0.25, light: 0.4 });
    const s = stats(day);
    const order = s.m.map((x, i) => ({ ...x, i })).sort((a, b) => a.L - b.L);
    const t1 = order[Math.floor(NPL / 3)].L, t2 = order[Math.floor(2 * NPL / 3)].L;
    // міліметровий папір
    const P = narrow ? { x: 12, y: 46, w: w - 24, h: h * 0.52 } : { x: 18, y: 46, w: w * 0.58, h: h - 70 };
    const maxL = Math.max(30, CROPS6[st.crop].Lmax * 1.25);
    const pxmm = Math.min((P.w - 50) / maxL, (P.h - 40) / 3 / 10 * 1.7);
    graphPaper(ctx, P.x, P.y, P.w, P.h, pxmm);
    // три типові рослини: дрібна, середня, велика
    const reps = [order[Math.floor(NPL * 0.15)], order[Math.floor(NPL * 0.5)], order[Math.floor(NPL * 0.85)]];
    const names = ['дрібна', 'середня', 'велика'], cols = ['#B7791F', '#2E7D5B', '#1F6F8B'];
    const crop = CROPS6[st.crop];
    reps.forEach((rp, j) => {
      const yy = P.y + P.h * (0.15 + 0.26 * j), x0 = P.x + 34;
      ctx.save(); ctx.translate(x0, yy); ctx.rotate(Math.PI / 2);
      roots(ctx, 0, 0, { n: 4, len: Math.min(28, 5 + day * 0.6) * pxmm * 0.5, seed: rp.i + 3, w: 1, spread: 1.2 });
      const nodes = Math.max(1, rp.nodes);
      shoot(ctx, 0, 0, { h: rp.L * pxmm, nodes, leafLen: Math.min(11, 0.14 * rp.L + 2) * pxmm * 0.62, leafW: st.crop === 'carn' ? 0.2 : 0.5, opposite: crop.opposite, color: st.crop === 'carn' ? '#6F9E80' : MAT.leaf, pale: lightFactors(st.I).pale, seed: rp.i * 3 + 1, sway: 0, stemW: 1.6 });
      ctx.restore();
      // розмірна лінія
      const xe = x0 + rp.L * pxmm;
      ctx.save(); ctx.strokeStyle = cols[j]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0, yy + P.h * 0.11); ctx.lineTo(xe, yy + P.h * 0.11); ctx.moveTo(x0, yy + P.h * 0.11 - 4); ctx.lineTo(x0, yy + P.h * 0.11 + 4); ctx.moveTo(xe, yy + P.h * 0.11 - 4); ctx.lineTo(xe, yy + P.h * 0.11 + 4); ctx.stroke(); ctx.restore();
      text(ctx, `${names[j]}: ${fnum(rp.L, 0)} мм, ${rp.nodes} вузл.`, narrow ? x0 : Math.min(xe + 8, P.x + P.w - 150), narrow ? yy + P.h * 0.11 + 15 : yy + P.h * 0.11 + 4, { size: 11.5, weight: 700, color: cols[j], shadowC: 'rgba(255,255,255,.9)' });
    });
    ruler(ctx, P.x + 34, P.y + P.h - 30, Math.floor((P.w - 60) / pxmm / 10) * 10, pxmm);
    // гістограма довжин
    const Hh = narrow ? { x: 16, y: P.y + P.h + 22, w: w - 32, h: h - P.y - P.h - 64 } : { x: P.x + P.w + 26, y: 70, w: w - P.x - P.w - 44, h: h - 120 };
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.88)'; roundRect(ctx, Hh.x - 10, Hh.y - 30, Hh.w + 20, Hh.h + 58, 12); ctx.fill(); ctx.strokeStyle = 'rgba(30,70,45,.15)'; ctx.stroke(); ctx.restore();
    text(ctx, `30 регенерантів, ${day}-та доба`, Hh.x, Hh.y - 10, { size: 12, weight: 800, color: '#173322' });
    // ранжований ряд: кожен стовпчик — одна рослина, впорядковано за довжиною; колір — група для висаджування
    const am = 26, lmax = Math.max(10, order[NPL - 1].L * 1.08), bx = (Hh.w - am) / NPL, base = Hh.y + Hh.h - 20;
    for (let g = 1; g <= 4; g++) { const yy = base - (Hh.h - 24) * (g / 4); ctx.strokeStyle = 'rgba(70,88,76,.15)'; ctx.beginPath(); ctx.moveTo(Hh.x, yy); ctx.lineTo(Hh.x + Hh.w, yy); ctx.stroke(); text(ctx, fnum(lmax * g / 4, 0), Hh.x + am - 4, yy + 3, { size: 9.5, color: '#6B7C70', align: 'right' }); }
    order.forEach((x, k) => {
      const g = k < NPL / 3 ? 0 : k < 2 * NPL / 3 ? 1 : 2;
      const bh = (Hh.h - 24) * x.L / lmax;
      const gr = ctx.createLinearGradient(0, base - bh, 0, base); gr.addColorStop(0, cols[g]); gr.addColorStop(1, cols[g] + '99');
      ctx.fillStyle = gr; roundRect(ctx, Hh.x + am + k * bx + 1, base - bh, Math.max(1, bx - 2), Math.max(0.5, bh), 2); ctx.fill();
    });
    ctx.strokeStyle = '#46584C'; ctx.beginPath(); ctx.moveTo(Hh.x, base + 0.5); ctx.lineTo(Hh.x + Hh.w, base + 0.5); ctx.stroke();
    text(ctx, 'рослини, впорядковані за довжиною (мм)', Hh.x + Hh.w / 2, base + 14, { align: 'center', size: 10.5, color: '#46584C' });
    // легенда груп
    let lx = Hh.x;
    ['дрібні', 'середні', 'великі'].forEach((nm, j) => { ctx.fillStyle = cols[j]; ctx.fillRect(lx, Hh.y + Hh.h + 18, 9, 9); text(ctx, nm, lx + 12, Hh.y + Hh.h + 26, { size: 10.5, color: '#24372B' }); lx += Hh.w / 3; });
    pill(ctx, anim.on ? `Доба ${day} з ${DAYS}` : `Облік на ${day}-ту добу`, 10, 10);
  }
  const runner = new Runner({
    btn: $('m6-run'), reset: $('m6-reset'), status: $('m6-status'),
    step: (dt, t, reset) => {
      if (reset) { anim.on = false; $('m6-status').textContent = ''; return; }
      anim.on = true; const d = Math.min(DAYS, Math.round(t * 4.2));
      if (d !== st.day) { sl.set('day', d, true); st.day = d; readIt(); p1.set(p1.series, [{ x: d, color: '#1F6F8B', label: `${d}-та доба` }]); }
      $('m6-status').textContent = `Облік: ${d}-та доба`;
      if (d >= DAYS) runner.finish();
    },
    draw,
  });
  // скидання повертає повзунок доби на 0 лише під час запуску
  $('m6-run').addEventListener('click', () => { if (!runner.started || runner.t < 0.05) { sl.set('day', 0, true); st.day = 0; } }, true);
  onResize(cv.parentElement, draw);
  update();
  return { draw, runner };
}
