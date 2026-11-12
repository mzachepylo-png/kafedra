// Тема 7. Культура ізольованих протопластів (ЛР 24–25, с. 97–105 посібника) — чотири інтерактивні моделі.
import * as K from './kit.js';
import * as M from './t07-model.js';
import * as D from './t07-draw.js';

const $ = (id) => document.getElementById(id);
const { TAU, clamp, lerp, smooth, rng, fnum } = K;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).replace('-', '⁻').replace(/\d/g, (d) => SUP[d]);
const pow10 = (v) => (Math.abs(v - Math.round(v)) < 1e-6 ? `10${sup(Math.round(v))}` : '');
const sci = (v, d = 2) => (v >= 1e5 ? fnum(v, d) : v >= 100 ? Math.round(v).toLocaleString('uk-UA') : fnum(v, 1));
const pct = (v, d = 0) => `${fnum(v * 100, d)} %`;
const visible = (el) => el && el.offsetParent !== null;
const shared = { yieldPerG: 8e6, mass: 1 };

function initTabs(root, onShow) {
  const btns = [...root.querySelectorAll('[role="tab"]')];
  const select = (b, focus) => {
    btns.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $(x.getAttribute('aria-controls')).hidden = !on; });
    if (focus) b.focus();
    onShow(b.id);
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); select(btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length], true); });
  });
}
function fitStage(cv, wideAspect = 1.9, tallAspect = 0.64) {
  const W = cv.parentElement.clientWidth, wide = W >= 600;
  return Object.assign(K.fit(cv, { aspect: wide ? wideAspect : tallAspect, min: 300, max: wide ? 540 : 620 }), { wide });
}
const verdict = (id, cls, html) => { const v = $(id); v.className = 'ag-verdict ' + (cls || ''); v.innerHTML = html; };

/** Протопласт з антоціановою вакуолею (епідерміс цибулі, традесканції, бегонії). */
function anthoProto(ctx, x, y, r, hue, { burst = 0, seed = 1 } = {}) {
  const R = rng(seed);
  if (burst > 0.5) {
    ctx.save(); ctx.strokeStyle = K.rgba(hue, 0.35); ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) { const a = R() * TAU; ctx.beginPath(); ctx.arc(x + (R() - 0.5) * r * 0.4, y + (R() - 0.5) * r * 0.4, r * (0.8 + R() * 0.4), a, a + 0.8 + R()); ctx.stroke(); }
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8); g.addColorStop(0, K.rgba(hue, 0.18)); g.addColorStop(1, K.rgba(hue, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, TAU); ctx.fill();
    ctx.restore(); return;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,248,.4)'; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, K.rgba(K.shade(hue, 0.45), 0.8)); g.addColorStop(0.7, K.rgba(hue, 0.85)); g.addColorStop(1, K.rgba(K.shade(hue, -0.35), 0.95));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(245,240,240,.55)'; ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.2, r * 0.22, 0, TAU); ctx.fill();
  ctx.strokeStyle = K.rgba(K.shade(hue, -0.5), 0.6); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(x, y, r - 1.3, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
}

/* ========================================================================
   A. ЛР 24 — механічне виділення: плазмоліз у ряду сахарози (с. 100–101)
   ======================================================================== */
function modelA() {
  const cv = $('t7a-cv'); if (!cv) return null;
  const st = { obj: 'onion', sel: 3, tMin: 15, cut: 1 };
  let hits = [], cellCache = { key: '', cells: null };
  const seg = K.segmented($('t7a-obj'), 't7a-obj', Object.entries(M.OBJ).map(([k, v]) => ({ value: k, label: v.name.split(',')[0] })), st.obj, (v) => { st.obj = v; cellCache.key = ''; all(); });
  const segC = K.segmented($('t7a-c'), 't7a-c', M.SERIES.map((c, i) => ({ value: String(i), label: fnum(c, 2) })), String(st.sel), (v) => { st.sel = +v; all(); });
  const sl = K.sliders($('t7a-sl'), [{ id: 't7a-t', label: 'Час у розчині сахарози', min: 0, max: 20, step: 0.5, value: st.tMin, unit: 'хв', digits: 1, hint: 'Посібник: 10–15 хв (с. 101)' }], () => { st.tMin = sl.values['t7a-t']; all(); });
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const h = hits.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (h) { st.sel = h.i; segC.select(String(h.i)); all(); }
  });
  const p1 = new K.Plot($('t7a-p1'), { xLabel: 'Концентрація сахарози, М', yLabel: 'V / V₀ протопласта', x: [0.25, 0.75], y: [0.4, 1.05], xShort: 'C', yZero: false, ariaLabel: 'Відносний об\'єм протопласта залежно від концентрації сахарози' });
  const p2 = new K.Plot($('t7a-p2'), { xLabel: 'Концентрація сахарози, М', yLabel: 'Цілих протопластів', x: [0.25, 0.75], y: [0, 40], xShort: 'C', ariaLabel: 'Кількість цілих протопластів у краплі для кожного розчину' });
  function all() { update(); draw(); }
  function update() {
    const o = M.OBJ[st.obj], C = M.SERIES[st.sel], r = M.mech(C, st.obj, st.tMin);
    K.setOut($('t7a-reads'), {
      c: `${fnum(C, 2)} М`, psi: `${fnum(r.psi, 2)} МПа`, cell: `${fnum(r.psiCell, 2)} МПа`, v: fnum(r.V, 2), form: M.FORMS[r.form],
      n: st.cut ? String(Math.round(r.n * st.cut)) : '—', d: `${fnum(r.d * 100, 0)} %`,
    });
    p1.set([
      { data: K.sample((c) => M.volRel(c, o.Cip), 0.25, 0.75, 120), color: '#7A2E6E', width: 2.6, label: 'рівновага (Бойль — Вант-Гофф)' },
      { data: M.SERIES.map((c) => [c, M.mech(c, st.obj, st.tMin).V]), color: '#B98AB0', type: 'points', r: 4, label: `через ${fnum(st.tMin, 1)} хв` },
      { data: [], color: '#13241A', marker: [C, r.V] },
    ], [{ x: o.Cip, label: 'граничний плазмоліз', color: '#8C6A10' }]);
    p2.set([
      { data: M.SERIES.map((c) => [c, M.mech(c, st.obj, 15).n]), color: '#2E7D5B', width: 2.2, label: 'цілих протопластів у краплі' },
      { data: M.SERIES.map((c) => [c, M.mech(c, st.obj, 15).n]), color: '#2E7D5B', type: 'points', r: 4 },
      { data: [], color: '#13241A', marker: [C, M.mech(C, st.obj, 15).n] },
    ]);
    const best = M.SERIES.reduce((b, c) => (M.mech(c, st.obj).n > M.mech(b, st.obj).n ? c : b), M.SERIES[0]);
    let cls = '', msg = `<b>${fnum(C, 2)} М сахарози: Ψ<sub>s</sub> = −C·R·T = ${fnum(r.psi, 2)} МПа.</b> `;
    if (r.form === 'none') { msg += `Розчин гіпотонічний або ізотонічний для тканини (граничний плазмоліз ≈ ${fnum(o.Cip, 2)} М, Ψ ≈ ${fnum(r.psiCell, 2)} МПа): протопласт притиснутий до стінки, і при надрізанні мембрана рветься разом зі стінкою.`; cls = 'is-bad'; }
    else if (r.deg > 0.4) { msg += `Сильний плазмоліз: протопласт зморщився до ${fnum(r.V * 100, 0)} % об'єму — більшість протопластів пошкоджується зневодненням.`; cls = 'is-warn'; }
    else msg += `${M.FORMS[r.form][0].toUpperCase() + M.FORMS[r.form].slice(1)}: протопласт відстав від стінки (${fnum(r.V * 100, 0)} % об'єму), тому після надрізання виходить цілим і округлюється.`;
    msg += ` Найбільше цілих протопластів — у розчині ${fnum(best, 2)} М, водний потенціал якого найближчий до потенціалу тканини (с. 101).`;
    if (st.tMin < 5) { msg += ' Плазмоліз ще не встановився — витримайте 10–15 хв.'; cls = cls || 'is-warn'; }
    verdict('t7a-verdict', cls, msg);
    $('t7a-hud').innerHTML = `<span>${o.name}</span><span>${fnum(st.tMin, 1)} хв</span>`;
  }
  function draw() {
    if (!visible(cv)) return;
    const { ctx, w, h, wide } = fitStage(cv, 1.9, 0.66);
    K.scene(ctx, w, h, { kind: 'bench', horizon: wide ? 0.72 : 0.36, light: 0.3 });
    const o = M.OBJ[st.obj];
    const degs = M.SERIES.map((c) => M.mech(c, st.obj, st.tMin).deg);
    const rx = wide ? w * 0.03 : w * 0.05, rw = wide ? w * 0.4 : w * 0.9, ry = wide ? h * 0.3 : h * 0.06, rh = wide ? h * 0.5 : h * 0.26;
    hits = D.tubeRack(ctx, rx, ry, rw, rh, { conc: M.SERIES, sel: st.sel, hue: o.hue, deg: degs });
    if (wide) K.tagSmall(ctx, rx + rw / 2, ry - 14, 'Торкніться пробірки, щоб розглянути препарат', { color: '#173322', bg: 'rgba(255,255,255,.85)', size: 11 });
    // поле зору
    const R0 = wide ? Math.min(h * 0.45, w * 0.25) : Math.min(w * 0.46, h * 0.28);
    const cx = wide ? w * 0.7 : w / 2, cy = wide ? h * 0.5 : h * 0.7;
    const r = M.mech(M.SERIES[st.sel], st.obj, st.tMin);
    const cw = R0 * 0.19;
    const key = `${st.obj}|${R0}`;
    if (cellCache.key !== key) cellCache = { key, cells: D.epiCells(2 * R0, 2 * R0, cw, o.aspect, 5) };
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.clip();
    D.bfBackground(ctx, cx, cy, R0, 4);
    const cutX = cx - R0 + 2 * R0 * (0.55 - 0.1 * st.cut);   // праворуч від лінії — крапля з вивільненими протопластами
    ctx.save(); ctx.beginPath(); ctx.rect(cx - R0, cy - R0, st.cut > 0 ? cutX - (cx - R0) : 2 * R0, 2 * R0); ctx.clip();
    for (const c of cellCache.cells) {
      const cc = { ...c, x: cx - R0 + c.x, y: cy - R0 + c.y };
      const isCut = st.cut > 0 && cc.x + cc.w > cutX - 2 && cc.x < cutX;
      D.epiCell(ctx, cc, { V: r.V, form: r.form, hue: o.hue, cut: isCut });
    }
    ctx.restore();
    if (st.cut > 0) {
      // край зруйнованої тканини та крапля розчину з протопластами
      ctx.strokeStyle = 'rgba(120,100,80,.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cutX, cy - R0); ctx.lineTo(cutX, cy + R0); ctx.stroke(); ctx.setLineDash([]);
      const Rr = rng(31 + st.sel), nI = Math.round(r.n * st.cut * 0.25), nB = Math.round((7 - r.n * 0.15) * st.cut);
      const d0 = cw * Math.cbrt(o.aspect * 0.5), rr = d0 * r.d * 0.62;
      const placed = [];
      const tryPlace = (rad) => { for (let k = 0; k < 40; k++) { const x = cutX + rad + 4 + Rr() * Math.max(4, cx + R0 * 0.92 - cutX - 2 * rad - 4), y = cy - R0 * 0.85 + rad + Rr() * (R0 * 1.7 - 2 * rad); if (Math.hypot(x - cx, y - cy) > R0 - rad * 0.6) continue; if (placed.every((q) => Math.hypot(q[0] - x, q[1] - y) > q[2] + rad + 3)) { placed.push([x, y, rad]); return [x, y]; } } return null; };
      for (let i = 0; i < nI; i++) { const rad = rr * (0.85 + Rr() * 0.3), q = tryPlace(rad); if (q) anthoProto(ctx, q[0], q[1], rad, o.hue, { seed: i + 1 }); }
      for (let i = 0; i < nB; i++) { const q = tryPlace(rr * 0.8); if (q) anthoProto(ctx, q[0], q[1], rr * 0.8, o.hue, { burst: 1, seed: i + 7 }); }
    }
    // голка
    if (st.cut > 0 && st.cut < 1) {
      ctx.save(); ctx.translate(cutX + 6, cy - R0 * 0.2 + st.cut * R0 * 0.5); ctx.rotate(-0.9);
      const ng = ctx.createLinearGradient(0, -3, 0, 3); ng.addColorStop(0, '#E8ECEE'); ng.addColorStop(1, '#7C878B');
      ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R0 * 1.2, -3); ctx.lineTo(R0 * 1.2, 3); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    D.ocular(ctx, cx, cy, R0);
    D.scaleBar(ctx, cx - R0 * 0.62, cy + R0 * 0.8, cw * 0.95 / 0.06 * 0.1, '100 мкм');
    if (wide) K.tagSmall(ctx, cx, cy - R0 * 1.1 - 6, `${fnum(M.SERIES[st.sel], 2)} М · ${M.FORMS[r.form]}`, { color: '#173322', bg: 'rgba(255,255,255,.88)', size: 11 });
  }
  let runner;
  $('t7a-run').addEventListener('click', () => { if (runner && (!runner.started || runner.done)) { st.tMin = 0; st.cut = 0; } });
  runner = new K.Runner({
    btn: $('t7a-run'), reset: $('t7a-reset'), status: $('t7a-status'), draw,
    step: (dt, t, reset) => {
      if (reset) { st.tMin = 15; st.cut = 1; sl.set('t7a-t', 15, true); update(); return; }
      if (st.tMin < 15) { st.tMin = Math.min(15, st.tMin + dt * 2.6); sl.set('t7a-t', Math.round(st.tMin * 2) / 2, true); update(); return; }
      st.cut = Math.min(1, st.cut + dt / 2.2); update();
      if (st.cut >= 1) runner.finish();
    },
  });
  update(); draw();
  K.onResize(cv.parentElement, () => { cellCache.key = ''; draw(); });
  return { draw: () => { cellCache.key = ''; draw(); } };
}

/* ========================================================================
   B. ЛР 25 — ферментативне виділення (с. 101–102)
   ======================================================================== */
function modelB() {
  const cv = $('t7b-cv'); if (!cv) return null;
  const st = { mat: 'leaf', ...M.RECIPES.leaf, osm: 0.5, t: 16 };
  let cells = null, cellsR = 0, res;
  const sl = K.sliders($('t7b-sl'), [
    { id: 't7b-cel', label: 'Cellulase (целюлаза)', min: 0, max: 3, step: 0.1, value: st.cel, unit: '%', digits: 1 },
    { id: 't7b-mac', label: 'Macerozyme (пектиназа)', min: 0, max: 2, step: 0.1, value: st.mac, unit: '%', digits: 1 },
    { id: 't7b-dri', label: 'Driselase (суміш ферментів)', min: 0, max: 1, step: 0.05, value: st.dri, unit: '%', digits: 2 },
  ], () => read());
  const sl2 = K.sliders($('t7b-sl2'), [
    { id: 't7b-T', label: 'Температура інкубації', min: 18, max: 38, step: 1, value: st.T, unit: '°C' },
    { id: 't7b-r', label: 'Розчину на 1 г тканини', min: 2, max: 15, step: 0.25, value: st.mlPerG, unit: 'мл', digits: 2, hint: 'Листок: 1 г на 7–10 мл; калюс: 2 г на 7–10 мл' },
    { id: 't7b-o', label: 'Маніт (осмотичний стабілізатор)', min: 0.2, max: 0.8, step: 0.05, value: st.osm, unit: 'М', digits: 2 },
    { id: 't7b-t', label: 'Час інкубації', min: 0, max: 24, step: 0.5, value: st.t, unit: 'год', digits: 1 },
  ], () => read());
  const read = () => {
    Object.assign(st, { cel: sl.values['t7b-cel'], mac: sl.values['t7b-mac'], dri: sl.values['t7b-dri'], T: sl2.values['t7b-T'], mlPerG: sl2.values['t7b-r'], osm: sl2.values['t7b-o'], t: sl2.values['t7b-t'] });
    all();
  };
  const applyRecipe = (m) => {
    st.mat = m; const R = M.RECIPES[m];
    sl.set('t7b-cel', R.cel, true); sl.set('t7b-mac', R.mac, true); sl.set('t7b-dri', R.dri, true);
    sl2.set('t7b-T', R.T, true); sl2.set('t7b-r', R.mlPerG, true); sl2.set('t7b-t', R.h, true); read();
  };
  K.segmented($('t7b-mat'), 't7b-mat', [{ value: 'leaf', label: 'мезофіл листка тютюну' }, { value: 'callus', label: 'калюс тютюну' }], 'leaf', applyRecipe);
  const p1 = new K.Plot($('t7b-p1'), { xLabel: 'Час інкубації, год', yLabel: 'млн протопластів / г', x: [0, 24], y: [0, 10], xShort: 'год', ariaLabel: 'Вихід життєздатних протопластів у часі' });
  const p2 = new K.Plot($('t7b-p2'), { xLabel: 'Час інкубації, год', yLabel: '%', x: [0, 24], y: [0, 100], xShort: 'год', ariaLabel: 'Залишок клітинної стінки, мацерація і життєздатність у часі' });
  function all() { update(); draw(); }
  function update() {
    res = M.enzyme(st);
    shared.yieldPerG = res.Y; shared.mass = st.mat === 'leaf' ? 1 : 2;
    const mass = shared.mass, vol = st.mlPerG * mass;
    K.setOut($('t7b-reads'), {
      W: pct(res.W), M: pct(res.M), Y: `${fnum(res.Y / 1e6, 2)} млн/г`, v: pct(res.v), tot: sci(res.Y * mass),
      c: `${sci(res.Y * mass / vol)} /мл`, best: `${fnum(res.best.t, 1)} год`,
    });
    const tt = K.linspace(0, 24, 121).map((x) => res.at(x));
    p1.set([
      { data: tt.map((r) => [r.t, r.Y / 1e6]), color: '#2E7D5B', width: 2.8, label: 'життєздатні протопласти' },
      { data: tt.map((r) => [r.t, r.Ytot / 1e6]), color: '#9DBBA8', width: 1.6, dash: [5, 4], label: 'вивільнено всього' },
      { data: [], color: '#13241A', marker: [st.t, res.Y / 1e6] },
    ], [{ x: res.best.t, label: 'оптимум', color: '#8C6A10' }]);
    p2.set([
      { data: tt.map((r) => [r.t, r.W * 100]), color: '#8A6A2E', width: 2.4, label: 'залишок стінки' },
      { data: tt.map((r) => [r.t, r.M * 100]), color: '#5B7FA8', width: 2.4, label: 'мацерація' },
      { data: tt.map((r) => [r.t, r.v * 100]), color: '#B5523B', width: 2.4, label: 'життєздатність' },
    ], [{ x: st.t, color: '#13241A' }]);
    const R = M.RECIPES[st.mat];
    let cls = '', msg = `<b>${fnum(st.t, 1)} год при +${st.T} °C:</b> стінку перетравлено на ${fnum((1 - res.W) * 100, 0)} %, вихід ${fnum(res.Y / 1e6, 2)} млн життєздатних протопластів з 1 г (максимум ${fnum(res.best.Y / 1e6, 2)} млн/г — через ${fnum(res.best.t, 1)} год). `;
    if (st.t < res.best.t - 3) { msg += 'Інкубацію можна продовжити — частина клітин ще у стінках.'; cls = 'is-warn'; }
    else if (st.t > res.best.t + 4) { msg += 'Перетримка: ферменти й тривала обробка пошкоджують уже вивільнені протопласти.'; cls = 'is-warn'; }
    else msg += `Час близький до оптимального (посібник: ${st.mat === 'leaf' ? '15–18 год при +28–30 °C' : '20–22 год за кімнатної температури'}).`;
    if (st.osm < 0.38) { msg += ' Маніту замало: середовище гіпотонічне, протопласти без стінки набухають і лопаються.'; cls = 'is-bad'; }
    if (st.osm > 0.68) { msg += ' Надто концентрований маніт зневоднює протопласти.'; cls = cls || 'is-warn'; }
    if (st.T > 32) { msg += ' Температура вища за +30 °C прискорює загибель протопластів.'; cls = 'is-warn'; }
    if (st.mat === 'callus' && st.cel < 1.5) { msg += ' Для калюсу посібник радить удвічі-вчетверо вищі концентрації ферментів (2 % / 1 % / 0,5 %).'; cls = cls || 'is-warn'; }
    if (st.mlPerG < (st.mat === 'leaf' ? 7 : 3.5)) { msg += ' Забагато тканини на об\'єм розчину — ферменти діють повільніше.'; }
    void R;
    verdict('t7b-verdict', cls, msg);
    $('t7b-hud').innerHTML = `<span>${fnum(st.t, 1)} год</span><span>+${st.T} °C · темрява</span>`;
  }
  function draw() {
    if (!visible(cv)) return;
    const { ctx, w, h, wide } = fitStage(cv, 1.9, 0.7);
    K.scene(ctx, w, h, { kind: 'bench', horizon: wide ? 0.42 : 0.3, light: 0.35 });
    const r = res;
    // чашка Петрі зі смужками листка у ферментному розчині
    const pr = wide ? Math.min(w * 0.22, h * 0.6) : Math.min(w * 0.42, h * 0.22);
    const pcx = wide ? w * 0.26 : w * 0.5, pcy = wide ? h * 0.62 : h * 0.2;
    const leafCol = st.mat === 'leaf' ? [70, 140, 55] : [226, 214, 160];
    K.petri(ctx, pcx, pcy, pr, { tilt: 0.42, medium: { color: '#E6D9A4' }, contents: (c, p) => {
      const R = rng(4), n = 7;
      for (let i = 0; i < n; i++) {
        const y = p.cy - p.ry * 0.7 + (i + 0.5) * p.ry * 1.4 / n, hw = p.rx * Math.sqrt(Math.max(0, 1 - Math.pow((y - p.cy) / p.ry, 2))) * 0.8;
        const fade = (1 - r.W) * r.M;
        c.save(); c.globalAlpha = 0.95 - fade * 0.75;
        const col = K.mix(leafCol, [230, 226, 190], fade * 0.6);
        c.fillStyle = K.rgba(col); K.roundRect(c, p.cx - hw + R() * 6, y - p.ry * 0.05, hw * 2 - R() * 10, p.ry * 0.085, 3); c.fill();
        c.restore();
      }
      // хмара вивільнених протопластів (осідають на дно)
      const nP = Math.round(260 * (1 - r.W) * r.M);
      const R2 = rng(9);
      for (let i = 0; i < nP; i++) { const a = R2() * TAU, d = Math.sqrt(R2()) * 0.9; c.fillStyle = st.mat === 'leaf' ? `rgba(60,130,50,${0.3 + R2() * 0.4})` : `rgba(200,190,140,${0.4 + R2() * 0.4})`; c.beginPath(); c.arc(p.cx + Math.cos(a) * d * p.rx, p.cy + Math.sin(a) * d * p.ry, 0.8 + R2() * 1.1, 0, TAU); c.fill(); }
    } });
    if (wide) K.tagSmall(ctx, pcx, pcy + pr * 0.42 + pr * 0.16 + 22, `${fnum(st.cel, 1)} % Cellulase · ${fnum(st.mac, 1)} % Macerozyme · ${fnum(st.dri, 2)} % Driselase`, { color: '#173322', bg: 'rgba(255,255,255,.88)', size: wide ? 11 : 10 });
    // поле зору
    const R0 = Math.round(wide ? Math.min(h * 0.45, w * 0.24) : Math.min(w * 0.46, h * 0.3));
    const cx = wide ? w * 0.7 : w / 2, cy = wide ? h * 0.5 : h * 0.66;
    if (!cells || cellsR !== R0) { cells = D.mesoCells(R0, 3); cellsR = R0; }
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.clip();
    D.bfBackground(ctx, cx, cy, R0, 5);
    if (st.mat === 'callus') { ctx.save(); ctx.filter = 'saturate(0.05) brightness(1.08)'; }
    D.mesoField(ctx, cx, cy, R0, cells, { W: r.W, M: r.M, v: r.v });
    if (st.mat === 'callus') ctx.restore();
    ctx.restore();
    D.ocular(ctx, cx, cy, R0);
    D.scaleBar(ctx, cx + R0 * 0.2, cy + R0 * 0.8, R0 * 0.105 * 2 * 50 / 45, '50 мкм');
    if (wide) K.tagSmall(ctx, cx, cy - R0 * 1.1 - 6, r.W > 0.6 ? 'клітини ще у стінках' : r.W > 0.15 ? 'стінки тоншають, клітини округлюються' : 'вільні сферичні протопласти', { color: '#173322', bg: 'rgba(255,255,255,.88)', size: 11 });
  }
  let runner;
  $('t7b-run').addEventListener('click', () => { if (runner && (!runner.started || runner.done)) { st.t = 0; sl2.set('t7b-t', 0, true); } });
  runner = new K.Runner({
    btn: $('t7b-run'), reset: $('t7b-reset'), status: $('t7b-status'), draw,
    step: (dt, t, reset) => {
      if (reset) { st.t = M.RECIPES[st.mat].h; sl2.set('t7b-t', st.t, true); update(); return; }
      st.t = Math.min(24, st.t + dt * 2); sl2.set('t7b-t', Math.round(st.t * 2) / 2, true); update();
      if (st.t >= 24) runner.finish();
    },
  });
  update(); draw();
  K.onResize(cv.parentElement, draw);
  return { draw };
}

/* ========================================================================
   C. ЛР 25 — очищення: фільтрування, флотація, відмивання W-5 (с. 102)
   ======================================================================== */
function modelC() {
  const cv = $('t7c-cv'); if (!cv) return null;
  const st = { step: 'float', kind: 'sucrose', C: 0.6, rpm: 1000, tMin: 3, washes: 2, p: 1, angle: 0, spin: 0 };
  let res;
  const segS = K.segmented($('t7c-step'), 't7c-step', [{ value: 'float', label: '1. Флотація' }, { value: 'w5', label: '2. Відмивання W-5' }], st.step, (v) => {
    st.step = v; sl.set('t7c-rpm', v === 'float' ? 1000 : 700, true); sl.set('t7c-t', v === 'float' ? 3 : 1.5, true); read();
  });
  K.segmented($('t7c-kind'), 't7c-kind', [{ value: 'sucrose', label: 'сахароза' }, { value: 'mannitol', label: 'маніт' }], st.kind, (v) => { st.kind = v; all(); });
  const sl = K.sliders($('t7c-sl'), [
    { id: 't7c-C', label: 'Концентрація осмотика', min: 0.3, max: 0.8, step: 0.05, value: st.C, unit: 'М', digits: 2 },
    { id: 't7c-rpm', label: 'Швидкість центрифуги', min: 300, max: 2500, step: 50, value: st.rpm, unit: 'об/хв', hint: 'Посібник: 1000 об/хв 3 хв; 700 об/хв 1–2 хв' },
    { id: 't7c-t', label: 'Тривалість', min: 0.5, max: 10, step: 0.5, value: st.tMin, unit: 'хв', digits: 1 },
    { id: 't7c-w', label: 'Відмивань у W-5', min: 0, max: 3, step: 1, value: st.washes, unit: '', hint: 'Посібник: двічі' },
  ], () => read());
  const read = () => { st.C = sl.values['t7c-C']; st.rpm = sl.values['t7c-rpm']; st.tMin = sl.values['t7c-t']; st.washes = sl.values['t7c-w']; all(); };
  const p1 = new K.Plot($('t7c-p1'), { xLabel: 'Концентрація осмотика, М', yLabel: 'v протопласта, мм/с', x: [0.3, 0.8], y: [-2, 1], xShort: 'C', yZero: true, ariaLabel: 'Швидкість руху протопласта за законом Стокса залежно від концентрації сахарози чи маніту' });
  const p2 = new K.Plot($('t7c-p2'), { xLabel: 'Час центрифугування, хв', yLabel: 'Частка, %', x: [0, 10], y: [0, 100], xShort: 'хв', ariaLabel: 'Частки протопластів і уламків у робочій зоні з часом' });
  function all() { update(); draw(); }
  function update() {
    res = M.separation({ kind: st.kind, C: st.C, rpm: st.rpm, tMin: st.tMin, step: st.step });
    const fl = M.separation({ kind: st.kind, C: st.C, rpm: st.step === 'float' ? st.rpm : 1000, tMin: st.step === 'float' ? st.tMin : 3, step: 'float' });
    const w5 = M.separation({ step: 'w5', rpm: st.step === 'w5' ? st.rpm : 700, tMin: st.step === 'w5' ? st.tMin : 1.5 });
    const N0 = shared.yieldPerG * shared.mass;
    const Nfin = N0 * fl.yield * Math.pow(w5.yield, Math.max(1, st.washes));
    $('c-t7c-C').closest('.ctrl').classList.toggle('is-disabled', st.step !== 'float');
    K.setOut($('t7c-reads'), {
      g: `${fnum(res.g, 0)} × g`, rho: `${fnum(res.med.rho, 3)} г/см³`, vp: `${res.proto.v < 0 ? '↑' : '↓'} ${fnum(Math.abs(res.proto.v), 2)} мм/с`, vd: `↓ ${fnum(res.debris.v, 2)} мм/с`,
      y: pct(res.yield), pur: res.purity == null ? '—' : pct(res.purity), enz: `${fnum(M.enzymeLeft(st.washes) * 100, st.washes > 1 ? 4 : 2)} %`, fin: `${sci(Nfin / 0.5)} /мл`,
    });
    const Cs = K.linspace(0.3, 0.8, 60);
    p1.set([
      { data: Cs.map((c) => [c, M.stokes(M.PARTS.proto, M.medium('sucrose', c), res.g)]), color: '#2E7D5B', width: 2.6, label: 'у сахарозі' },
      { data: Cs.map((c) => [c, M.stokes(M.PARTS.proto, M.medium('mannitol', c), res.g)]), color: '#C59A1B', width: 2.6, label: 'у маніті' },
      { data: [], color: '#13241A', marker: st.step === 'float' ? [st.C, res.proto.v] : [0.3, 0] },
    ], [{ y: 0, label: 'вище — тоне, нижче — спливає', color: '#8C6A10' }]);
    const tt = K.linspace(0.05, 10, 100).map((t) => [t, M.separation({ kind: st.kind, C: st.C, rpm: st.rpm, tMin: t, step: st.step })]);
    p2.set(st.step === 'float' ? [
      { data: tt.map(([t, r]) => [t, r.proto.top * 100]), color: '#2E7D5B', width: 2.6, label: 'протопласти в зеленому шарі' },
      { data: tt.map(([t, r]) => [t, r.debris.top * 100]), color: '#8A6A2E', width: 2, label: 'уламки там само' },
      { data: tt.map(([t, r]) => [t, r.chl.top * 100]), color: '#5E8F3A', width: 1.6, dash: [4, 4], label: 'вільні хлоропласти' },
    ] : [
      { data: tt.map(([t, r]) => [t, r.proto.pellet * 100]), color: '#2E7D5B', width: 2.6, label: 'протопласти в осаді' },
      { data: tt.map(([t, r]) => [t, r.damage * 100]), color: '#B5523B', width: 2, label: 'пошкоджено' },
    ], [{ x: st.tMin, color: '#13241A' }]);
    let cls = '', msg;
    if (st.step === 'float') {
      if (res.proto.v >= 0) { msg = `<b>Протопласти не спливають:</b> густина розчину ${res.med.gen} ${fnum(res.med.rho, 3)} г/см³ ≤ густини протопласта (≈ ${fnum(M.PARTS.proto.rho, 3)} г/см³), і вони осідають разом з уламками. Візьміть сахарозу або підвищте концентрацію.`; cls = 'is-bad'; }
      else { msg = `<b>Флотація:</b> у розчині ${res.med.gen} (${fnum(res.med.rho, 3)} г/см³) цілі протопласти легші за середовище і спливають зі швидкістю ${fnum(-res.proto.v, 2)} мм/с, а уламки стінок (≈ ${fnum(M.PARTS.debris.rho, 2)} г/см³) осідають. У верхньому зеленому шарі — ${pct(res.yield)} протопластів, чистота ${pct(res.purity)}. Шар збирають пастерівською піпеткою.`; if (res.yield < 0.7) cls = 'is-warn'; }
      if (res.damage > 0.15) { msg += ' Забагато обертів — протопласти деформуються.'; cls = 'is-warn'; }
    } else {
      msg = `<b>Відмивання в W-5:</b> W-5 (${fnum(res.med.rho, 3)} г/см³) легший за протопласти, тож при ${fnum(res.g, 0)} × g вони осідають: за ${fnum(st.tMin, 1)} хв в осаді ${pct(res.proto.pellet)}, пошкоджено ${pct(res.damage)}. Після ${st.washes} відмивань ферменту лишається ${fnum(M.enzymeLeft(st.washes) * 100, 4)} % від початкового.`;
      if (res.proto.pellet < 0.8) { msg += ' Осадження неповне — частину протопластів буде злито із супернатантом.'; cls = 'is-warn'; }
      if (res.damage > 0.2) { msg += ' Надто жорстке центрифугування: протопласти в щільному осаді деформуються й лопаються.'; cls = 'is-bad'; }
      if (st.washes < 2) { msg += ' Залишки ферментів гальмуватимуть регенерацію стінки — посібник радить відмивати двічі.'; cls = cls || 'is-warn'; }
    }
    verdict('t7c-verdict', cls, msg);
    $('t7c-hud').innerHTML = `<span>${fnum(res.g, 0)} × g</span><span>${fnum(st.tMin * st.p, 1)} / ${fnum(st.tMin, 1)} хв</span>`;
  }
  function draw() {
    if (!visible(cv)) return;
    const { ctx, w, h, wide } = fitStage(cv, 1.9, 0.78);
    K.scene(ctx, w, h, { kind: 'bench', horizon: 0.74, light: 0.4 });
    const s = st.p * st.tMin * 60;
    if (wide) D.miniCentrifuge(ctx, w * 0.04, h * 0.5, Math.min(w * 0.24, 220), { angle: st.angle, spin: st.spin, rpm: st.rpm, timeTxt: `${Math.floor(st.tMin * st.p)}:${String(Math.round((st.tMin * st.p * 60) % 60)).padStart(2, '0')}` });
    // велика пробірка
    const tw = wide ? Math.min(w * 0.12, 110) : w * 0.26, th = wide ? h * 0.78 : h * 0.8;
    const tcx = wide ? w * 0.45 : w * 0.3, ttop = wide ? h * 0.12 : h * 0.1;
    const med = res.med;
    const tint = st.step === 'float' ? (st.kind === 'sucrose' ? [236, 228, 196] : [232, 234, 220]) : [228, 238, 240];
    const H = M.COLUMN;
    D.cTube(ctx, tcx, ttop, tw, th, {
      level: 0.78,
      layers: (c, g) => { const lg = c.createLinearGradient(0, g.ly, 0, g.bottom); lg.addColorStop(0, K.rgba(tint, 0.55)); lg.addColorStop(1, K.rgba(K.shade(tint, -0.08), 0.75)); c.fillStyle = lg; c.fillRect(g.cx - g.w, g.ly, 2 * g.w, g.bottom - g.ly); },
      parts: (c, g) => {
        const R = rng(17);
        const draws = [];
        const spec = st.step === 'float' ? [['proto', 70], ['debris', 50], ['chl', 140]] : [['proto', 80], ['debris', 6], ['chl', 10]];
        for (const [id, n] of spec) {
          const P = M.PARTS[id], v = M.stokes(P, med, res.g);
          for (let i = 0; i < n; i++) {
            const z0 = R() * H, xr = (R() - 0.5) * 2;
            let z = clamp(z0 - v * s, 0, H);
            if (z <= 0) z = R() * 1.2; if (z >= H) z = H - R() * 1.8;
            const y = g.yAt(z, H), hw = g.half(y) - 4;
            draws.push({ id, x: g.cx + xr * hw * (z < 1.5 ? 0.4 : 1), y, seed: i, z });
          }
        }
        for (const d of draws) {
          if (d.id === 'proto') { if (tw > 60) D.proto(c, d.x, d.y, Math.max(2.4, tw * 0.035), { type: 'meso', seed: d.seed, light: 1 }); else { c.fillStyle = 'rgba(60,130,50,.85)'; c.beginPath(); c.arc(d.x, d.y, 2.2, 0, TAU); c.fill(); } }
          else if (d.id === 'debris') { c.fillStyle = 'rgba(120,96,50,.7)'; c.save(); c.translate(d.x, d.y); c.rotate(d.seed); c.fillRect(-3, -1.2, 6, 2.4); c.restore(); }
          else { c.fillStyle = 'rgba(50,110,40,.55)'; c.beginPath(); c.arc(d.x, d.y, 0.9, 0, TAU); c.fill(); }
        }
      },
      label: st.step === 'float' ? `${fnum(st.C, 2)} М ${st.kind === 'sucrose' ? 'сахарози' : 'маніту'}` : 'середовище W-5',
    });
    // підписи зон
    const ly = ttop + th * 0.22;
    if (wide && st.step === 'float' && res.proto.v < 0 && st.p > 0.5) K.callout(ctx, tcx - tw * 0.3, ly + 6, wide ? tcx - tw * 0.8 - 10 : tcx + tw * 0.2, wide ? ly - 30 : ly - 34, wide ? 'зелений шар цілих протопластів' : 'шар протопластів', { size: wide ? 11.5 : 10.5 });
    if (st.p > 0.5 && wide) K.callout(ctx, tcx - 2, ttop + th - 8, tcx - tw * 0.9 - 10, ttop + th - 2, st.step === 'float' ? 'осад: уламки, мертві клітини' : 'осад протопластів', { size: 11.5 });
    // легенда/фізика
    if (wide) {
      const lx = w * 0.64, ly2 = h * 0.14;
      ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,255,255,.92)'; K.roundRect(ctx, lx, ly2, w * 0.33, h * 0.72, 12); ctx.fill();
      ctx.fillStyle = '#13241A'; ctx.font = '700 13px system-ui, sans-serif'; ctx.fillText('Закон Стокса', lx + 14, ly2 + 24);
      ctx.font = 'italic 600 13px Georgia, serif'; ctx.fillText('v = 2/9 · Δρ · g · RCF · r² / μ', lx + 14, ly2 + 48);
      ctx.font = '600 12px system-ui, sans-serif';
      const rows = [['#2E7D5B', `протопласт: ρ ${fnum(M.PARTS.proto.rho, 3)}, r 15 мкм`, res.proto.v], ['#8A6A2E', `уламки: ρ ${fnum(M.PARTS.debris.rho, 2)}, r 9 мкм`, res.debris.v], ['#5E8F3A', `хлоропласт: ρ ${fnum(M.PARTS.chl.rho, 2)}, r 2,5 мкм`, res.chl.v]];
      rows.forEach(([c, t, v], i) => { const y = ly2 + 80 + i * 40; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx + 20, y - 4, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#13241A'; ctx.fillText(t, lx + 34, y); ctx.fillStyle = v < 0 ? '#1F7A45' : '#8A4A20'; ctx.fillText(`${v < 0 ? '↑ спливає' : '↓ тоне'} ${fnum(Math.abs(v), v < 0.1 && v > -0.1 ? 3 : 2)} мм/с`, lx + 34, y + 16); });
      ctx.fillStyle = '#46584C'; ctx.fillText(`середовище: ρ ${fnum(med.rho, 3)} г/см³, μ ${fnum(med.mu, 2)} мПа·с`, lx + 14, ly2 + 214);
      ctx.fillText(`RCF = 1,118·10⁻⁵ · r · n² = ${fnum(res.g, 0)} × g`, lx + 14, ly2 + 236);
      ctx.restore();
    } else {
      const lx = w * 0.56, ly2 = h * 0.12;
      ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,255,255,.92)'; K.roundRect(ctx, lx, ly2, w * 0.41, 126, 10); ctx.fill();
      ctx.font = '600 11px system-ui, sans-serif';
      [['#2E7D5B', 'протопласти', res.proto.v], ['#8A6A2E', 'уламки', res.debris.v], ['#5E8F3A', 'хлоропласти', res.chl.v]].forEach(([c, t, v], i) => { const y = ly2 + 22 + i * 34; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx + 12, y - 4, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#13241A'; ctx.fillText(t, lx + 22, y); ctx.fillStyle = v < 0 ? '#1F7A45' : '#8A4A20'; ctx.fillText(`${v < 0 ? '↑' : '↓'} ${fnum(Math.abs(v), 2)} мм/с`, lx + 22, y + 14); });
      ctx.restore();
    }
  }
  let runner;
  $('t7c-run').addEventListener('click', () => { if (runner && (!runner.started || runner.done)) { st.p = 0; } });
  runner = new K.Runner({
    btn: $('t7c-run'), reset: $('t7c-reset'), status: $('t7c-status'), draw,
    step: (dt, t, reset) => {
      if (reset) { st.p = 1; st.spin = 0; update(); return; }
      st.p = Math.min(1, st.p + dt / 6); st.spin = st.p < 1 ? Math.min(1, st.spin + dt * 2) : 0; st.angle += dt * 25 * st.spin;
      $('t7c-hud').lastElementChild.textContent = `${fnum(st.tMin * st.p, 1)} / ${fnum(st.tMin, 1)} хв`;
      if (st.p >= 1) { st.spin = 0; update(); runner.finish(); }
    },
  });
  update(); draw();
  K.onResize(cv.parentElement, draw);
  return { draw, update };
}

/* ========================================================================
   D. Культивування протопластів і злиття ПЕГ (с. 99–100, 102)
   ======================================================================== */
function modelD() {
  const cv = $('t7d-cv'); if (!cv) return null;
  const st = { mode: 'culture', dens: 1e3, T: 27, light: 'diffuse', day: 14, peg: 30, ca: true, p: 0.5, tf: 15 };
  K.segmented($('t7d-mode'), 't7d-mode', [{ value: 'culture', label: 'Культивування в К-3' }, { value: 'fusion', label: 'Злиття (ПЕГ)' }], st.mode, (v) => { st.mode = v; syncPanels(); all(); });
  K.segmented($('t7d-light'), 't7d-light', [{ value: 'dark', label: 'темрява' }, { value: 'diffuse', label: 'розсіяне ≤ 2000 лк' }, { value: 'bright', label: 'яскраве 5000 лк' }], st.light, (v) => { st.light = v; all(); });
  K.segmented($('t7d-ca'), 't7d-ca', [{ value: '1', label: 'так: Ca²⁺ + високий pH' }, { value: '0', label: 'ні' }], '1', (v) => { st.ca = v === '1'; all(); });
  const slC = K.sliders($('t7d-slc'), [
    { id: 't7d-d', label: 'Густота посіву', min: 1e2, max: 1e6, value: st.dens, log: true, unit: 'кл/мл', format: (v) => sci(v), hint: 'Посібник: оптимум 10³ кл/мл (с. 102)' },
    { id: 't7d-T', label: 'Температура', min: 20, max: 34, step: 1, value: st.T, unit: '°C', hint: 'Посібник: +26–28 °C' },
    { id: 't7d-day', label: 'Доба культивування', min: 0, max: 20, step: 0.5, value: st.day, unit: 'доба', digits: 1 },
  ], () => { st.dens = slC.values['t7d-d']; st.T = slC.values['t7d-T']; st.day = slC.values['t7d-day']; all(); });
  const slF = K.sliders($('t7d-slf'), [
    { id: 't7d-peg', label: 'ПЕГ (поліетиленгліколь)', min: 0, max: 50, step: 1, value: st.peg, unit: '%' },
    { id: 't7d-p', label: 'Частка зелених протопластів А', min: 10, max: 90, step: 5, value: st.p * 100, unit: '%' },
    { id: 't7d-tf', label: 'Час дії', min: 0, max: 20, step: 0.5, value: st.tf, unit: 'хв', digits: 1 },
  ], () => { st.peg = slF.values['t7d-peg']; st.p = slF.values['t7d-p'] / 100; st.tf = slF.values['t7d-tf']; all(); });
  function syncPanels() { $('t7d-pc').hidden = st.mode !== 'culture'; $('t7d-pf').hidden = st.mode !== 'fusion'; }
  syncPanels();
  const p1 = new K.Plot($('t7d-p1'), { xLabel: 'Доба', yLabel: '%', x: [0, 20], y: [0, 100], xShort: 'доба', ariaLabel: 'Перебіг культивування або злиття' });
  const p2 = new K.Plot($('t7d-p2'), { xLabel: 'Густота посіву (лог.)', yLabel: '%', x: [2, 6], y: [0, 35], xFmt: pow10, xShort: 'густота', ariaLabel: 'Ефективність або частки продуктів злиття' });
  // поле: фіксовані «слоти» протопластів
  const R = rng(5);
  const slots = Array.from({ length: 40 }, (_, i) => ({ u: R(), v: R(), a: R(), b: R(), c: R(), seed: i + 1, x: 0, y: 0 }));
  function all() { update(); draw(); }
  function update() {
    if (st.mode === 'culture') {
      const r = M.culture({ dens: st.dens, T: st.T, light: st.light, t: st.day });
      K.setOut($('t7d-reads'), { a: pct(r.wall), b: pct(r.div), c: pct(r.PE, 1), d: st.day > 3 ? `≈ ${Math.round(r.cells)}` : '1', e: sci(st.dens * r.colonies), f: '—' });
      $('t7d-reads').lastElementChild.hidden = true;
      $('t7d-reads').querySelectorAll('small').forEach((s, i) => { s.textContent = ['Протопластів зі стінкою', 'Поділилися', 'Ефективність утворення колоній', 'Клітин у мікроколонії', 'Колоній в 1 мл', '—'][i]; });
      p1.setOptions({ xLabel: 'Доба культивування', x: [0, 20], y: [0, 100], yLabel: '%' });
      const dd = K.linspace(0, 20, 81).map((t) => [t, M.culture({ dens: st.dens, T: st.T, light: st.light, t })]);
      p1.set([
        { data: dd.map(([t, q]) => [t, q.wall * 100]), color: '#8A6A2E', width: 2.4, label: 'регенерована стінка' },
        { data: dd.map(([t, q]) => [t, q.div * 100]), color: '#2E7D5B', width: 2.4, label: 'поділились' },
        { data: dd.map(([t, q]) => [t, q.colonies * 100]), color: '#5B7FA8', width: 2.4, label: 'мікроколонії' },
      ], [{ x: st.day, color: '#13241A' }]);
      p2.setOptions({ xLabel: 'Густота посіву, кл/мл (лог.)', x: [2, 6], y: [0, 35], xFmt: pow10, yLabel: 'Ефективність, %' });
      p2.set([
        { data: K.sample((l) => M.culture({ dens: Math.pow(10, l), T: st.T, light: st.light }).PE * 100, 2, 6, 120), color: '#2E7D5B', width: 2.6, label: 'ефективність утворення колоній' },
        { data: [], color: '#13241A', marker: [Math.log10(st.dens), r.PE * 100] },
      ], [{ x: 3, label: '10³ (посібник)', color: '#8C6A10' }]);
      let cls = '', msg = `<b>Доба ${fnum(st.day, 1)}.</b> Одразу після видалення ферментів протопласти починають будувати нову стінку (за ${fnum(st.day, 0)} діб — ${pct(r.wall)} клітин); такі клітини діляться і за 10–20 діб утворюють колонії-агрегати (с. 99, 102). Ефективність — ${pct(r.PE, 1)}.`;
      if (r.fD < 0.4) { msg += st.dens < 1e3 ? ' Густота замала: клітини не кондиціюють середовище.' : ' Густота завелика: клітини конкурують і буріють.'; cls = 'is-warn'; }
      if (r.fT < 0.6) { msg += ' Температура далека від +26–28 °C.'; cls = 'is-warn'; }
      if (st.light === 'bright') { msg += ' Яскраве світло (понад 2000 лк) пригнічує протопласти.'; cls = 'is-warn'; }
      verdict('t7d-verdict', cls, msg);
      $('t7d-hud').innerHTML = `<span>доба ${fnum(st.day, 1)}</span><span>К-3 · +${st.T} °C</span>`;
    } else {
      const f = M.fusion({ peg: st.peg, ca: st.ca, p: st.p, t: st.tf });
      K.setOut($('t7d-reads'), { a: fnum(f.lam, 2), b: pct(f.un), c: pct(f.het, 1), d: pct(f.homo, 1), e: pct(f.multi, 1), f: pct(f.viab) });
      $('t7d-reads').lastElementChild.hidden = false;
      $('t7d-reads').querySelectorAll('small').forEach((s, i) => { s.textContent = ['λ — партнерів на протопласт', 'Не злилися', 'Гетерокаріони A + B', 'Гомокаріони A + A, B + B', 'Багатоядерні (≥ 3)', 'Життєздатність'][i]; });
      p1.setOptions({ xLabel: 'Концентрація ПЕГ, %', x: [0, 50], y: [0, 100], yLabel: '% протопластів' });
      const pp = K.linspace(0, 50, 101).map((g) => [g, M.fusion({ peg: g, ca: st.ca, p: st.p, t: st.tf })]);
      p1.set([
        { data: pp.map(([g, q]) => [g, q.het * 100]), color: '#2E7D5B', width: 2.6, label: 'гетерокаріони' },
        { data: pp.map(([g, q]) => [g, q.multi * 100]), color: '#B5523B', width: 2, label: 'багатоядерні' },
        { data: pp.map(([g, q]) => [g, q.viab * 100]), color: '#5B7FA8', width: 2, dash: [5, 4], label: 'життєздатність' },
        { data: [], color: '#13241A', marker: [st.peg, f.het * 100] },
      ]);
      p2.setOptions({ xLabel: 'Частка протопластів А, %', x: [0, 100], y: [0, 20], xFmt: undefined, yLabel: 'Гетерокаріони, %' });
      p2.set([
        { data: K.sample((q) => M.fusion({ peg: st.peg, ca: st.ca, p: q / 100, t: st.tf }).het * 100, 0, 100, 101), color: '#2E7D5B', width: 2.6, label: 'гетерокаріони = λe^(−λ)·2p(1 − p)' },
        { data: [], color: '#13241A', marker: [st.p * 100, f.het * 100] },
      ]);
      let cls = '', msg = `<b>ПЕГ ${st.peg} %${st.ca ? ' + Ca²⁺ / високий pH' : ''}:</b> протопласти злипаються й зливаються; у середньому λ = ${fnum(f.lam, 2)} партнера на протопласт. Гетерокаріонів (зелений мезофільний + безбарвний калюсний, два різні ядра) — ${pct(f.het, 1)}, вони найцінніші для соматичної гібридизації.`;
      if (st.peg < 15) { msg += ' ПЕГ замало — злиття майже не відбувається.'; cls = 'is-warn'; }
      if (f.viab < 0.7) { msg += ' Надто концентрований ПЕГ токсичний: життєздатність падає, зростає частка багатоядерних продуктів, які зазвичай гинуть (с. 100).'; cls = 'is-bad'; }
      verdict('t7d-verdict', cls, msg);
      $('t7d-hud').innerHTML = `<span>${fnum(st.tf, 1)} хв</span><span>ПЕГ ${st.peg} %</span>`;
    }
  }
  function draw() {
    if (!visible(cv)) return;
    const { ctx, w, h, wide } = fitStage(cv, 1.9, 0.82);
    K.scene(ctx, w, h, { kind: 'dark' });
    const R0 = Math.round(wide ? Math.min(h * 0.46, w * 0.25) : Math.min(w * 0.47, h * 0.47));
    const cx = wide ? w * 0.38 : w / 2, cy = h / 2;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.clip();
    D.bfBackground(ctx, cx, cy, R0, 9);
    const pr = R0 * 0.085;
    if (st.mode === 'culture') {
      const r = M.culture({ dens: st.dens, T: st.T, light: st.light, t: st.day });
      const n = Math.round(clamp(5 + 5 * (Math.log10(st.dens) - 2), 4, 26));
      const placed = [];
      slots.slice(0, 40).forEach((s) => { if (placed.length >= n) return; const x = cx + (s.u - 0.5) * 1.6 * R0, y = cy + (s.v - 0.5) * 1.6 * R0; if (Math.hypot(x - cx, y - cy) > R0 * 0.82) return; if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < pr * 4.2)) return; placed.push({ ...s, x, y }); });
      for (const s of placed) {
        const divides = s.a < r.PE * 2.2, dies = !divides && s.b < 0.5 && st.day > 6;
        if (dies) { D.proto(ctx, s.x, s.y, pr, { type: 'meso', seed: s.seed, burst: smooth(6, 10, st.day) > 0.6 ? 1 : 0, alpha: 1 - smooth(8, 16, st.day) * 0.5 }); continue; }
        const wall = smooth(0, 2.5, st.day);
        const nC = divides ? r.cells : 1;
        if (nC < 1.5) { D.proto(ctx, s.x, s.y, pr, { type: 'meso', seed: s.seed, wall, oval: wall * 0.6, rot: s.c * 3, light: 1 - smooth(4, 14, st.day) * 0.5 }); continue; }
        // мікроколонія: щільне скупчення клітин зі стінками
        const N = Math.min(28, Math.round(nC)), Rr = rng(s.seed), pts = [[0, 0]], cr = pr * Math.max(0.5, 0.95 / Math.pow(N, 0.2));
        for (let i = 1; i < N; i++) { let best = null; for (let k = 0; k < 18; k++) { const b = pts[(Rr() * pts.length) | 0], a = Rr() * TAU, c2 = [b[0] + Math.cos(a) * cr * 1.75, b[1] + Math.sin(a) * cr * 1.6]; const ov = pts.reduce((m, q) => Math.max(m, cr * 1.6 - Math.hypot(q[0] - c2[0], q[1] - c2[1])), -99); const sc = (ov > 0.5 ? 100 : 0) + Math.hypot(...c2); if (!best || sc < best.sc) best = { c2, sc }; } pts.push(best.c2); }
        const mx = pts.reduce((a, q) => a + q[0], 0) / N, my = pts.reduce((a, q) => a + q[1], 0) / N;
        pts.forEach((q, i) => D.proto(ctx, s.x + q[0] - mx, s.y + q[1] - my, cr, { type: 'meso', seed: s.seed * 7 + i, wall: 1, oval: 0.5, rot: i, light: 0.4 }));
      }
      ctx.restore();
      D.ocular(ctx, cx, cy, R0);
      D.scaleBar(ctx, cx + R0 * 0.2, cy + R0 * 0.8, pr * 2 * 50 / 35, '50 мкм');
    } else {
      const f = M.fusion({ peg: st.peg, ca: st.ca, p: st.p, t: st.tf });
      // слоти: частина утворює пари/трійки відповідно до λ
      const nS = 16, cand = slots.slice(0, nS).map((s, i) => ({ ...s, i }));
      const order = cand.slice().sort((a, b) => a.c - b.c);
      const fusedObjFrac = 1 - f.un, nMulti = Math.round(nS * f.multi / Math.max(0.01, fusedObjFrac + f.un) * 0.5), nBin = Math.round(nS * f.bin * 0.6);
      order.forEach((s, k) => { s.kind = k < nMulti ? 3 : k < nMulti + nBin ? 2 : 1; });
      const prog = smooth(1, 8, st.tf), merge = smooth(6, 16, st.tf) * (st.peg > 10 ? 1 : 0);
      // розкладка по сітці
      const cols = 4, cellW = 1.7 * R0 / cols;
      cand.forEach((s, i) => {
        const gx = cx - 0.85 * R0 + (i % cols + 0.5) * cellW + (s.u - 0.5) * cellW * 0.45, gy = cy - 0.85 * R0 + ((i / cols) | 0) * cellW + cellW * 0.5 + (s.v - 0.5) * cellW * 0.45;
        if (Math.hypot(gx - cx, gy - cy) > R0 * 0.9) return;
        const types = [s.a < st.p ? 'meso' : 'callus', s.b < st.p ? 'meso' : 'callus', s.c * 3 % 1 < st.p ? 'meso' : 'callus'];
        if (s.kind === 1) { D.proto(ctx, gx, gy, pr * 1.05, { type: types[0], seed: s.seed }); return; }
        const n = s.kind;
        if (merge > 0.6) {
          const het = types.slice(0, n).includes('meso') && types.slice(0, n).includes('callus');
          const tp = het ? 'hetero' : types[0];
          D.proto(ctx, gx, gy, pr * Math.cbrt(n) * 1.05, { type: tp, seed: s.seed });
          if (het || n > 2) { ctx.strokeStyle = n > 2 ? 'rgba(181,82,59,.9)' : 'rgba(255,196,60,.95)'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(gx, gy, pr * Math.cbrt(n) * 1.05 + 5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        } else {
          const d = lerp(pr * 2.8, pr * 1.75, prog);
          for (let k = 0; k < n; k++) { const a = k * TAU / n + s.u; D.proto(ctx, gx + Math.cos(a) * d * 0.55, gy + Math.sin(a) * d * 0.55, pr, { type: types[k], seed: s.seed * 3 + k }); }
        }
      });
      ctx.restore();
      D.ocular(ctx, cx, cy, R0);
      D.scaleBar(ctx, cx + R0 * 0.2, cy + R0 * 0.8, pr * 2 * 50 / 35, '50 мкм');
    }
    if (wide) {
      const lx = w * 0.7, ly = h * 0.16;
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.93)'; K.roundRect(ctx, lx, ly, w * 0.28, st.mode === 'culture' ? 158 : 186, 12); ctx.fill();
      const items = st.mode === 'culture'
        ? [['meso', 0, 'протопласт (без стінки)'], ['meso', 1, 'відновлена стінка'], ['col', 0, 'мікроколонія після поділів'], ['burst', 0, 'загиблий протопласт']]
        : [['meso', 0, 'А — мезофіл (хлоропласти)'], ['callus', 0, 'Б — калюс (вакуоля)'], ['hetero', 0, 'гетерокаріон А + Б'], ['multi', 0, 'багатоядерний продукт']];
      items.forEach(([tp, wl, t], i) => {
        const y = ly + 30 + i * (st.mode === 'culture' ? 36 : 42), x = lx + 24;
        if (tp === 'burst') D.proto(ctx, x, y, 10, { type: 'meso', burst: 1, seed: 3 });
        else if (tp === 'col') { for (let k = 0; k < 4; k++) D.proto(ctx, x + (k % 2) * 9 - 4.5, y + ((k / 2) | 0) * 9 - 4.5, 5, { type: 'meso', wall: 1, seed: k + 1, light: 0.4 }); }
        else if (tp === 'multi') { D.proto(ctx, x, y, 14, { type: 'hetero', seed: 4 }); ctx.strokeStyle = 'rgba(181,82,59,.9)'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        else { D.proto(ctx, x, y, tp === 'hetero' ? 14 : 11, { type: tp, wall: wl, oval: wl * 0.6, seed: 2 }); if (tp === 'hetero') { ctx.strokeStyle = 'rgba(255,196,60,.95)'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } }
        ctx.fillStyle = '#13241A'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 26, y);
      });
      ctx.restore();
    }
  }
  let runner;
  $('t7d-run').addEventListener('click', () => { if (runner && (!runner.started || runner.done)) { if (st.mode === 'culture') { st.day = 0; slC.set('t7d-day', 0, true); } else { st.tf = 0; slF.set('t7d-tf', 0, true); } } });
  runner = new K.Runner({
    btn: $('t7d-run'), reset: $('t7d-reset'), status: $('t7d-status'), draw,
    step: (dt, t, reset) => {
      if (reset) { st.day = 14; st.tf = 15; slC.set('t7d-day', 14, true); slF.set('t7d-tf', 15, true); update(); return; }
      if (st.mode === 'culture') { const pv = Math.floor(st.day * 2); st.day = Math.min(20, st.day + dt * 1.3); if (Math.floor(st.day * 2) !== pv) { slC.set('t7d-day', Math.floor(st.day * 2) / 2, true); update(); } if (st.day >= 20) { update(); runner.finish(); } }
      else { const pv = Math.floor(st.tf * 2); st.tf = Math.min(20, st.tf + dt * 1.6); if (Math.floor(st.tf * 2) !== pv) { slF.set('t7d-tf', Math.floor(st.tf * 2) / 2, true); update(); } if (st.tf >= 20) { update(); runner.finish(); } }
    },
  });
  update(); draw();
  K.onResize(cv.parentElement, draw);
  return { draw };
}

function boot() {
  const mA = modelA(), mB = modelB(), mC = modelC(), mD = modelD();
  const models = { 't7-tab-a': mA, 't7-tab-b': mB, 't7-tab-c': mC, 't7-tab-d': mD };
  const tabs = $('t7-tabs');
  if (tabs) initTabs(tabs, (id) => { const m = models[id]; if (m) requestAnimationFrame(() => { if (m.update) m.update(); m.draw(); }); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
