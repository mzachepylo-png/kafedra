// Тема 5. Суспензійна культура клітин (ЛР 18–22, с. 85–92 посібника) — чотири інтерактивні моделі.
import * as K from './kit.js';
import * as M from './t05-model.js';
import * as D from './t05-draw.js';

const $ = (id) => document.getElementById(id);
const { TAU, clamp, lerp, smooth, rng, fnum } = K;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).replace('-', '⁻').replace(/\d/g, (d) => SUP[d]);
const pow10 = (v) => (Math.abs(v - Math.round(v)) < 1e-6 ? `10${sup(Math.round(v))}` : fnum(Math.pow(10, v), 2));
const sci = (v, d = 2) => (v >= 1e4 ? fnum(v, d) : fnum(v, v >= 100 ? 0 : 1));
const pct = (v, d = 0) => `${fnum(v, d)} %`;
const visible = (el) => el && el.offsetParent !== null;
const shared = { sim: null, day: 12, st: null };

/* ---------- вкладки ---------- */
function initTabs(root, onShow) {
  const btns = [...root.querySelectorAll('[role="tab"]')];
  const select = (b, focus) => {
    btns.forEach((x) => {
      const on = x === b;
      x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
      $(x.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) b.focus();
    onShow(b.id);
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); select(btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length], true);
    });
  });
  return { select: (id) => select($(id)) };
}

/** Підігнати полотно: широка сцена на десктопі, вища — на телефоні. */
function fitStage(cv, wideAspect = 1.9, tallAspect = 0.64) {
  const W = cv.parentElement.clientWidth, wide = W >= 600;
  const r = K.fit(cv, { aspect: wide ? wideAspect : tallAspect, min: 300, max: wide ? 540 : 600 });
  return Object.assign(r, { wide });
}

/** Невелика горизонтальна стовпчикова діаграма (власне полотно, адаптивне). */
class Bars {
  constructor(host, aria) {
    this.cv = document.createElement('canvas'); this.cv.setAttribute('role', 'img'); this.cv.setAttribute('aria-label', aria);
    host.append(this.cv); this.rows = []; this.opts = {};
    new ResizeObserver(() => this.draw()).observe(host);
  }
  set(rows, opts = {}) { this.rows = rows; this.opts = opts; this.draw(); }
  draw() {
    const host = this.cv.parentElement, w = host.clientWidth; if (!w) return;
    const rh = 30, top = 8, h = top + this.rows.length * rh + 34;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = w * dpr; this.cv.height = h * dpr; this.cv.style.height = h + 'px';
    const ctx = this.cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const lw = Math.min(150, Math.max(92, w * 0.32)), x0 = lw + 6, x1 = w - 10, pw = x1 - x0;
    ctx.font = '600 12px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    // сітка
    ctx.strokeStyle = '#E3EBE3'; ctx.fillStyle = '#46584C'; ctx.textAlign = 'center';
    for (let v = 0; v <= 100; v += 25) { const x = x0 + pw * v / 100; ctx.beginPath(); ctx.moveTo(x + 0.5, top - 2); ctx.lineTo(x + 0.5, top + this.rows.length * rh); ctx.stroke(); ctx.fillText(v + '%', x, top + this.rows.length * rh + 12); }
    this.rows.forEach((r, i) => {
      const y = top + i * rh;
      ctx.textAlign = 'right'; ctx.fillStyle = r.bold ? '#13241A' : '#46584C'; ctx.font = `${r.bold ? 700 : 600} 12px system-ui, sans-serif`;
      ctx.fillText(r.label, lw, y + rh / 2);
      let acc = 0;
      r.parts.forEach((p) => {
        const x = x0 + pw * acc / 100, ww = pw * p.v / 100;
        if (ww > 0.5) { ctx.fillStyle = p.c; K.roundRect(ctx, x, y + 5, Math.max(1, ww - 1), rh - 10, 4); ctx.fill(); }
        if (ww > 30) { ctx.fillStyle = p.ink || '#fff'; ctx.textAlign = 'center'; ctx.font = '700 11px system-ui, sans-serif'; ctx.fillText(Math.round(p.v) + '', x + ww / 2, y + rh / 2 + 0.5); }
        acc += p.v;
      });
      if (r.mark != null) { const x = x0 + pw * r.mark / 100; ctx.strokeStyle = '#B23A2A'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + rh - 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
    });
    if (this.opts.legend) {
      let x = x0, y = h - 8; ctx.font = '600 11.5px system-ui, sans-serif'; ctx.textAlign = 'left';
      for (const [c, t] of this.opts.legend) { const m = ctx.measureText(t).width; if (x + m + 22 > w) break; ctx.fillStyle = c; K.roundRect(ctx, x, y - 6, 12, 10, 3); ctx.fill(); ctx.fillStyle = '#46584C'; ctx.fillText(t, x + 16, y - 0.5); x += m + 30; }
    }
  }
}

/* ========================================================================
   A. ЛР 18 + 20 — суспензія на шейкері, крива росту (с. 85–88, 90–91)
   ======================================================================== */
function modelA() {
  const cv = $('t5a-cv'); if (!cv) return null;
  const st = { sp: 'carrot', rpm: 120, inoc: 2.5, friable: 1, day: 12 };
  let sim, parts = [], phase = 0.9, fieldCache = { key: '', c: null };
  const recompute = () => {
    sim = M.simulate({ sp: st.sp, rpm: st.rpm, inoc: st.inoc, friable: st.friable });
    shared.sim = sim; shared.st = st;
    parts = genParts();
    fieldCache.key = '';
    plots(); update(); draw();
  };
  K.segmented($('t5a-sp'), 't5a-sp', Object.entries(M.SPECIES).map(([k, v]) => ({ value: k, label: v.name })), st.sp, (v) => { st.sp = v; recompute(); });
  K.segmented($('t5a-cal'), 't5a-cal', [{ value: '1', label: 'пухкий' }, { value: '0', label: 'щільний' }], '1', (v) => { st.friable = +v; recompute(); });
  const sl = K.sliders($('t5a-sl'), [
    { id: 't5a-rpm', label: 'Швидкість шейкера', min: 40, max: 200, step: 5, value: st.rpm, unit: 'об/хв', hint: 'Посібник: 100–120 (с. 85) або 130–150 об/хв (с. 88)' },
    { id: 't5a-inoc', label: 'Калюсу на 100 мл середовища', min: 0.5, max: 5, step: 0.25, value: st.inoc, unit: 'г', digits: 2, hint: 'Посібник: 2–3 г на 100 мл (с. 85)' },
    { id: 't5a-day', label: 'Доба культивування', min: 0, max: 30, step: 0.5, value: st.day, unit: 'доба', digits: 1 },
  ], (id) => {
    const v = sl.values;
    if (id === 't5a-day') { st.day = v['t5a-day']; shared.day = st.day; update(); draw(); return; }
    st.rpm = v['t5a-rpm']; st.inoc = v['t5a-inoc']; recompute();
  });

  function genParts() {
    const R = rng(77), o = M.at(sim, st.day);
    const fr = M.aggFractions(M.aggIndex({ sp: st.sp, rpm: st.rpm, friable: st.friable, t: st.day }));
    const tot = fr[0] + fr[1] + fr[2];
    return Array.from({ length: 70 }, (_, i) => {
      const r = R() * tot, kind = r < fr[0] ? 0 : r < fr[0] + fr[1] ? 1 : 2;
      return { u: Math.sqrt(R()), v: Math.pow(R(), 0.8), th: R() * TAU, n: kind === 0 ? 1 : kind === 1 ? 3 + ((R() * 6) | 0) : 12 + ((R() * 10) | 0), px: kind === 0 ? 1.5 : 1.25, seed: i + 1, kind };
    }).map((p) => (void o, p));
  }

  // графіки
  const p1 = new K.Plot($('t5a-p1'), { xLabel: 'Доба культивування', yLabel: 'Щільність, кл/мл', x: [0, 30], y: [4, 7], yFmt: (v) => pow10(v), xShort: 'доба', ariaLabel: 'Крива росту суспензії в логарифмічному масштабі' });
  const p2 = new K.Plot($('t5a-p2'), { xLabel: 'Доба культивування', yLabel: 'г/л', x: [0, 30], y: [0, 22], xShort: 'доба', ariaLabel: 'Сахароза в середовищі та суха маса клітин' });
  function plots() {
    const segs = [], used = new Set();
    let cur = null;
    sim.out.forEach((o, i) => {
      if (i % 5 && i !== sim.out.length - 1) return;
      const pt = [o.t, Math.log10(o.X)];
      if (!cur || cur.ph !== o.phase) { if (cur) cur.data.push(pt); cur = { ph: o.phase, data: [pt] }; segs.push(cur); } else cur.data.push(pt);
    });
    const series = segs.map((s) => { const P = M.PHASES[s.ph]; const lab = used.has(s.ph) ? '' : P.name; used.add(s.ph); return { data: s.data, color: P.color, width: 3.2, label: lab }; });
    series.push({ data: sim.out.filter((_, i) => i % 10 === 0).map((o) => [o.t, Math.log10(Math.max(1e4, o.V))]), color: '#173322', width: 1.4, dash: [5, 4], label: 'живі клітини' });
    const o = M.at(sim, st.day);
    series.push({ data: [], color: '#13241A', marker: [st.day, Math.log10(o.X)] });
    const guides = [];
    if (sim.tSub) guides.push({ x: sim.tSub, label: 'пересів', color: '#8C6A10' });
    p1.set(series, guides);
    p2.set([
      { data: sim.out.filter((_, i) => i % 10 === 0).map((o) => [o.t, o.S]), color: '#C59A1B', width: 2.6, label: 'сахароза в середовищі' },
      { data: sim.out.filter((_, i) => i % 10 === 0).map((o) => [o.t, o.dw]), color: '#2E7D5B', width: 2.6, label: 'суха маса клітин' },
      { data: [], color: '#2E7D5B', marker: [st.day, o.dw] },
    ], sim.tSub ? [{ x: sim.tSub, color: '#8C6A10' }] : []);
  }
  let lastPlotDay = -1;
  function update() {
    const o = M.at(sim, st.day);
    const a = M.aggIndex({ sp: st.sp, rpm: st.rpm, friable: st.friable, t: st.day });
    const fr = M.aggFractions(a), cls = M.aggClass(fr);
    const tdObs = o.mu > 0.02 ? Math.LN2 / o.mu : Infinity;
    K.setOut($('t5a-reads'), {
      x: `${sci(o.X)} кл/мл`, fold: `×${fnum(o.X / sim.X0, o.X / sim.X0 < 10 ? 1 : 0)}`,
      ph: M.PHASES[o.phase].name, td: isFinite(tdObs) && tdObs < 30 ? `${fnum(tdObs, 1)} доби` : '—',
      pcv: pct(o.pcv, 1), fw: `${fnum(o.fw, 0)} / ${fnum(o.dw, 1)} г/л`, s: `${fnum(o.S, 1)} г/л`,
      v: pct(o.viab * 100), agg: `${cls.name}`,
    });
    const msgs = [];
    let cls2 = '';
    const sp = M.SPECIES[st.sp];
    msgs.push(`<b>Доба ${fnum(st.day, 1)}, ${M.PHASES[o.phase].name} фаза.</b> ${{
      lag: 'Клітини пристосовуються до рідкого середовища: синтезують ферменти й РНК, але майже не діляться.',
      exp: `Клітини діляться з постійною швидкістю — щільність подвоюється приблизно кожні ${fnum(sim.td, 1)} доби.`,
      lin: 'Приріст став сталим за добу: поділ обмежує надходження кисню (аерація колби), а не самі клітини.',
      stat: 'Сахарозу вичерпано — поділ зупинився, накопичено максимум сухої біомаси.',
      death: 'Середовище виснажене, накопичуються продукти обміну — клітини гинуть і руйнуються (лізують).',
    }[o.phase]}`);
    if (sim.tSub) msgs.push(`Пересів (субкультивування) — близько <b>${fnum(sim.tSub, 0)} доби</b>, наприкінці активного росту, при щільності ≈ ${sci(M.at(sim, sim.tSub).X)} кл/мл.`);
    else { msgs.push('За 30 діб культура так і не вийшла на плато — ріст надто повільний.'); cls2 = 'is-warn'; }
    if (st.rpm < 90) { msgs.push(`При ${st.rpm} об/хв перемішування слабке: клітини осідають, злипаються в калюсоподібні агрегати, бракує кисню (с. 86).`); cls2 = 'is-warn'; }
    if (st.rpm > 160) { msgs.push(`${st.rpm} об/хв — забагато: зсувні сили й піна пошкоджують клітини, життєздатність падає.`); cls2 = 'is-bad'; }
    if (st.inoc < 1.5) { msgs.push(`Мала посівна доза (${fnum(st.inoc, 2)} г/100 мл): лаг-фаза довша (${fnum(sim.L, 1)} доби).`); cls2 = cls2 || 'is-warn'; }
    if (o.phase === 'death') cls2 = 'is-bad';
    const v = $('t5a-verdict'); v.className = 'ag-verdict ' + cls2; v.innerHTML = msgs.join(' ');
    $('t5a-hud').innerHTML = `<span>${sp.name}</span><span>доба ${fnum(st.day, 1)}</span><span>${st.rpm} об/хв · +24 °C · темрява</span>`;
    if (Math.abs(st.day - lastPlotDay) > 0.24) { lastPlotDay = st.day; plots(); }
  }

  function fieldImg(r, o, fr) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const nU = Math.round(7 + 20 * smooth(4.6, 6.7, Math.log10(o.X)));
    const key = `${st.sp}|${fr.map(Math.round)}|${Math.round((1 - o.viab) * 25)}|${Math.round(r)}|${nU}`;
    if (fieldCache.key === key) return fieldCache.c;
    const c = K.offscreen(2 * r * dpr, 2 * r * dpr), x = c.getContext('2d'); x.scale(dpr, dpr);
    x.save(); x.beginPath(); x.arc(r, r, r, 0, TAU); x.clip();
    D.fieldBackground(x, r, r, r, { seed: 9 });
    const scale = r * 0.085 / 23;
    const units = D.layoutUnits(D.genField(31, { fr, dead: 1 - o.viab, aggDead: 0.1, n: nU, scale }), r, 5);
    D.drawUnits(x, r, r, units, { tint: M.SPECIES[st.sp].tint });
    x.restore();
    fieldCache = { key, c };
    return c;
  }

  function draw() {
    if (!visible(cv)) return;
    const { ctx, w, h, wide } = fitStage(cv, 1.9, 0.62);
    const hy = K.scene(ctx, w, h, { kind: 'bench', horizon: wide ? 0.62 : 0.5, light: 0.3 });
    // термостатна кімната: приглушене світло
    const dk = ctx.createRadialGradient(w * 0.32, h * 0.35, h * 0.1, w * 0.4, h * 0.5, w * 0.9);
    dk.addColorStop(0, 'rgba(8,20,15,.18)'); dk.addColorStop(1, 'rgba(6,14,11,.62)');
    ctx.fillStyle = dk; ctx.fillRect(0, 0, w, h);
    const o = M.at(sim, st.day);
    const a = M.aggIndex({ sp: st.sp, rpm: st.rpm, friable: st.friable, t: st.day });
    const fr = M.aggFractions(a);
    const spd = M.SPECIES[st.sp];
    // шейкер
    const SW = wide ? w * 0.6 : w * 0.94, sx = wide ? w * 0.03 : w * 0.03;
    const yb = wide ? h * 0.93 : h * 0.58, bodyH = wide ? h * 0.15 : h * 0.085;
    const g = D.shakerBody(ctx, sx, yb, SW, bodyH, { rpm: st.rpm, day: st.day, on: true });
    const orbR = 2 + st.rpm / 45;
    const ox = Math.cos(phase) * orbR, oy = Math.sin(phase) * orbR * 0.45;
    const pl = D.shakerPlatform(ctx, g, ox, oy);
    const nF = wide ? 3 : 2;
    const s = Math.min((SW - 2 * g.inset) / nF * 0.88, wide ? h * 0.62 : h * 0.36);
    const amp = clamp((st.rpm - 40) / 140, 0.08, 1);
    const settle = 1 - smooth(55, 95, st.rpm);
    const nPart = Math.round(12 + 46 * smooth(4.6, 6.8, Math.log10(o.X)));
    const dens = clamp((Math.log10(o.X) - 4.4) / 2.4, 0, 1);
    const brown = clamp(1 - o.viab, 0, 1) * 0.9;
    for (let i = 0; i < nF; i++) {
      const fx = g.x0 + g.inset + (SW - 2 * g.inset) * (i + 0.5) / nF + ox;
      const fby = pl.yMid + 4;
      D.clamp3(ctx, fx, fby, s);
      D.suspFlask(ctx, fx, fby, s, { phase: phase + i * 0.4, amp, level: 0.4, dens, parts: parts.slice(0, nPart), tint: spd.tint, settle, brown });
    }
    // поле зору — крапля суспензії
    const fr2 = wide ? Math.min(w * 0.15, h * 0.36) : Math.min(w * 0.4, h * 0.19);
    const fcx = wide ? w * 0.82 : w * 0.5, fcy = wide ? h * 0.45 : h * 0.795;
    const img = fieldImg(fr2, o, fr);
    ctx.save(); ctx.beginPath(); ctx.arc(fcx, fcy, fr2, 0, TAU); ctx.clip();
    ctx.drawImage(img, fcx - fr2, fcy - fr2, fr2 * 2, fr2 * 2);
    ctx.restore();
    D.eyepiece(ctx, fcx, fcy, fr2);
    const umPx = fr2 * 0.085 / 23;   // px на 1 мкм
    D.scaleBar(ctx, fcx + fr2 * 0.05, fcy + fr2 * 0.74, 100 * umPx, '100 мкм');
    K.tagSmall(ctx, fcx, fcy - fr2 * 1.1 - 8, 'Крапля суспензії під мікроскопом', { color: '#EAF4EC', size: wide ? 12 : 11 });
    // підпис-виноска до колби
    if (wide) K.callout(ctx, g.x0 + g.inset + (SW - 2 * g.inset) / 6 + ox, pl.yMid - s * 0.2, sx + 8, h * 0.1, `Колби 250 мл, по 100 мл середовища`, { dark: true, size: 11 });
  }

  // запуск: прискорений час (1 доба ≈ 0,6 с) + орбітальний рух платформи
  const runBtn = $('t5a-run');
  let runner;
  runBtn.addEventListener('click', () => { if (runner && (!runner.started || runner.done)) { st.day = 0; sl.set('t5a-day', 0, true); lastPlotDay = -1; } });
  runner = new K.Runner({
    btn: runBtn, reset: $('t5a-reset'), status: $('t5a-status'),
    step: (dt, t, reset) => {
      if (reset) { phase = 0.9; st.day = 12; sl.set('t5a-day', 12, true); lastPlotDay = -1; update(); return; }
      phase += dt * TAU * (st.rpm / 60) * 0.55;
      const prev = Math.floor(st.day * 2);
      st.day = Math.min(30, st.day + dt * 1.6);
      shared.day = st.day;
      if (Math.floor(st.day * 2) !== prev) { sl.set('t5a-day', Math.round(st.day * 2) / 2, true); st.day = Math.max(st.day, 0); }
      update();
      if (st.day >= 30) runner.finish();
    },
    draw,
  });
  recompute();
  K.onResize(cv.parentElement, () => { fieldCache.key = ''; draw(); });
  return { draw: () => { fieldCache.key = ''; draw(); } };
}

/* ========================================================================
   B. ЛР 19–20 — підрахунок у камері Фукса — Розенталя (с. 89–91)
   ======================================================================== */
function modelB() {
  const cv = $('t5b-cv'); if (!cv) return null;
  const st = { X: 1.2e6, N: 3, fills: 3, scheme: '5', seed: 1 };
  const SCHEMES = { 5: [0, 5, 10, 15, 3], 4: [0, 5, 10, 15] };
  let data = null, anim = { f: 0, k: 0, p: 1, done: true }, gridCache = { key: '', c: null };
  const seg = K.segmented($('t5b-n'), 't5b-n', [1, 3, 5, 10].map((n) => ({ value: String(n), label: n === 3 ? '3 (1 + 2 мл)' : String(n) })), '3', (v) => { st.N = +v; regen(); });
  K.segmented($('t5b-sch'), 't5b-sch', [{ value: '5', label: '5 квадратів (ЛР 20)' }, { value: '4', label: '4 по діагоналі (ЛР 13)' }], '5', (v) => { st.scheme = v; regen(); });
  const sl = K.sliders($('t5b-sl'), [
    { id: 't5b-x', label: 'Справжня щільність у колбі', min: 1e4, max: 1e7, value: st.X, log: true, unit: 'кл/мл', format: (v) => sci(v) },
    { id: 't5b-f', label: 'Заповнень камери', min: 1, max: 6, step: 1, value: st.fills, unit: '' },
  ], () => { st.X = sl.values['t5b-x']; st.fills = sl.values['t5b-f']; regen(); });
  $('t5b-take').addEventListener('click', () => {
    if (!shared.sim) return;
    const o = M.at(shared.sim, shared.day);
    st.X = o.X; sl.set('t5b-x', o.X, true); st.N = 3; seg.select('3'); regen();
    $('t5b-status').textContent = `Проба з колби ЛР 18: доба ${fnum(shared.day, 1)}, ${M.SPECIES[shared.st.sp].name.toLowerCase()}.`;
  });
  $('t5b-new').addEventListener('click', () => { st.seed++; regen(); });

  /** Генерує клітини в межах сітки (у мм, 0…4) для кожного заповнення і рахує за правилом країв. */
  function regen() {
    const lam = M.lambdaPerSquare(st.X, st.N);
    const fills = [];
    const rc = 0.022;   // радіус клітини, мм (Ø ≈ 45 мкм)
    for (let f = 0; f < st.fills; f++) {
      const R = rng(st.seed * 101 + f * 7 + 3);
      const nTot = poisson(R, lam * 16 * 1.06);    // з полями за межами сітки
      const cells = [];
      const cap = Math.min(nTot, 9000);
      for (let i = 0; i < cap; i++) cells.push([-0.06 + R() * 4.12, -0.06 + R() * 4.12, R()]);
      // правило: клітини на верхній і лівій межах — враховують, на нижній і правій — ні
      const counts = Array(16).fill(0), marks = Array.from({ length: 16 }, () => []);
      cells.forEach((c, idx) => {
        const i = Math.floor((c[0] + rc) / 1), j = Math.floor((c[1] + rc) / 1);
        if (i < 0 || j < 0 || i > 3 || j > 3) return;
        counts[j * 4 + i]++; marks[j * 4 + i].push(idx);
      });
      fills.push({ cells, counts, marks });
    }
    const sq = SCHEMES[st.scheme];
    const per = []; fills.forEach((F, f) => sq.forEach((k, n) => per.push({ f, k, n: F.counts[k], idx: per.length + 1 })));
    data = { lam, fills, sq, per, rc };
    gridCache.key = '';
    anim = { f: st.fills - 1, k: sq.length, p: 1, done: true };
    update(); draw();
  }
  function poisson(R, l) {
    if (l < 30) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
    const u = Math.max(1e-12, R()), v = R(); return Math.max(0, Math.round(l + Math.sqrt(l) * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)));
  }
  const counted = () => data.per.filter((p) => p.f < anim.f || (p.f === anim.f && data.sq.indexOf(p.k) < anim.k) || anim.done);
  function stats() {
    const c = counted();
    const sum = c.reduce((s, p) => s + p.n, 0), nSq = c.length || 1;
    const mean = sum / nSq;
    const { M: Mm, X } = M.densityFromCount(mean, st.N);
    return { sum, nSq, mean, Mm, X, err: sum ? 196 / Math.sqrt(sum) : NaN };
  }

  const p1 = new K.Plot($('t5b-p1'), { xLabel: 'Номер підрахованого квадрата', yLabel: 'Клітин у квадраті', xShort: '№', yZero: true, ariaLabel: 'Кількість клітин у кожному підрахованому великому квадраті' });
  const p2 = new K.Plot($('t5b-p2'), { xLabel: 'Підраховано клітин, усього', yLabel: 'Оцінка X, кл/мл', xShort: 'n', yFmt: (v) => fnum(v, 1) + '·10⁶', ariaLabel: 'Збіжність оцінки щільності зі збільшенням кількості підрахованих клітин' });
  function update() {
    const s = stats();
    const need = Math.ceil(1000 / Math.max(1, data.lam * data.sq.length));
    K.setOut($('t5b-reads'), {
      lam: fnum(data.lam, 1), sum: String(s.sum), mean: fnum(s.mean, 1), M: fnum(s.Mm, 0),
      X: `${sci(s.X)} кл/мл`, err: isFinite(s.err) ? `±${fnum(s.err, 1)} %` : '—', fills: String(need),
    });
    const all = data.per;
    const c = counted();
    p1.set([
      { data: all.map((p) => [p.idx, p.n]), color: '#B9C6BD', type: 'points', r: 3.5, label: 'ще не підраховано' },
      { data: c.map((p) => [p.idx, p.n]), color: '#2E7D5B', type: 'points', r: 4.5, label: 'підраховано' },
    ], [{ y: data.lam, label: `очікуване λ = ${fnum(data.lam, 1)}`, color: '#8C6A10' }]);
    let cum = 0; const conv = [], lo = [], hi = [];
    c.forEach((p, i) => { cum += p.n; const m = cum / (i + 1), X = M.densityFromCount(m, st.N).X / 1e6, e = cum ? 1.96 / Math.sqrt(cum) : 0; conv.push([cum, X]); lo.push([cum, X * (1 - e)]); hi.push([cum, X * (1 + e)]); });
    p2.set([
      { data: hi, color: '#9DBBA8', width: 1.2, dash: [4, 4], label: 'межі 95 %' }, { data: lo, color: '#9DBBA8', width: 1.2, dash: [4, 4] },
      { data: conv, color: '#2E7D5B', width: 2.6, label: 'оцінка X' },
    ], [{ y: st.X / 1e6, label: 'справжня', color: '#8C6A10' }]);
    const v = $('t5b-verdict');
    const dev = (s.X - st.X) / st.X * 100;
    let cls = '', msg = `<b>X = M · N · 1000 / 3,2 = ${fnum(s.Mm, 0)} · ${st.N} · 1000 / 3,2 = ${sci(s.X)} кл/мл.</b> Тут M = n̄ · 16 = ${fnum(s.mean, 1)} · 16 — середнє число клітин у всій камері (16 великих квадратів, 3,2 мм³). `;
    if (s.sum < 1000) { msg += `Підраховано лише ${s.sum} клітин — посібник вимагає не менше 1000 (с. 90): потрібно ≈ ${need} заповнень камери. Похибка ±${fnum(s.err, 0)} %.`; cls = 'is-warn'; }
    else msg += `Вибірка ${s.sum} клітин достатня (≥ 1000), статистична похибка ±${fnum(s.err, 1)} %; відхилення від справжньої щільності ${dev >= 0 ? '+' : '−'}${fnum(Math.abs(dev), 1)} %.`;
    if (data.lam > 120) { msg += ' Клітин у квадраті забагато — рахувати важко, розведіть пробу сильніше.'; cls = 'is-warn'; }
    if (data.lam < 5) { msg += ' Клітин замало — оцінка ненадійна; зменште розведення.'; cls = 'is-warn'; }
    v.className = 'ag-verdict ' + cls; v.innerHTML = msg;
    $('t5b-hud').innerHTML = `<span>заповнення ${Math.min(anim.f + 1, st.fills)}/${st.fills}</span><span>N = ${st.N}</span>`;
  }

  function gridImg(S, F, dpr) {
    const key = `${S}|${st.seed}|${st.X}|${st.N}|${anim.f}|${st.fills}`;
    if (gridCache.key === key) return gridCache.c;
    const pad = 8, c = K.offscreen((S + 2 * pad) * dpr, (S + 2 * pad) * dpr), x = c.getContext('2d'); x.scale(dpr, dpr);
    const q = S / 4, rc = Math.max(1.1, data.rc * q);
    const R = rng(5);
    for (const [cx, cy, k] of F.cells) {
      const X = pad + cx * q, Y = pad + cy * q, rr = rc * (0.8 + k * 0.5);
      x.fillStyle = `rgba(${150 + k * 30 | 0},${120 + k * 25 | 0},70,.75)`; x.beginPath(); x.ellipse(X, Y, rr, rr * 0.85, k * 3, 0, TAU); x.fill();
      if (rr > 1.6) { x.strokeStyle = 'rgba(70,55,30,.6)'; x.lineWidth = 0.6; x.stroke(); x.fillStyle = 'rgba(255,250,230,.6)'; x.beginPath(); x.arc(X - rr * 0.3, Y - rr * 0.3, rr * 0.3, 0, TAU); x.fill(); }
    }
    void R;
    gridCache = { key, c };
    return c;
  }

  function draw() {
    if (!visible(cv) || !data) return;
    const { ctx, w, h, wide } = fitStage(cv, 1.9, 0.6);
    K.scene(ctx, w, h, { kind: 'dark' });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const R0 = wide ? Math.min(w * 0.25, h * 0.45) : Math.min(w * 0.47, h * 0.29);
    const cx = wide ? w * 0.27 : w / 2, cy = wide ? h * 0.5 : R0 + 22;
    const S = Math.round(R0 * 1.3), gx = cx - S / 2, gy = cy - S / 2;
    const F = data.fills[Math.min(anim.f, data.fills.length - 1)];
    const act = anim.done ? -1 : data.sq[anim.k];
    const done = data.sq.filter((k, i) => anim.done || i < anim.k);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.clip();
    D.fieldBackground(ctx, cx, cy, R0, { seed: 4 });
    // тонований фон камери (рідина з хромовою кислотою)
    ctx.fillStyle = 'rgba(214,190,120,.16)'; ctx.fillRect(cx - R0, cy - R0, 2 * R0, 2 * R0);
    const img = gridImg(S, F, dpr);
    D.frGrid(ctx, gx, gy, S, { hl: data.sq, active: act, done });
    ctx.drawImage(img, gx - 8, gy - 8, S + 16, S + 16);
    // номери підрахованих квадратів
    ctx.font = `700 ${Math.max(10, S / 22)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    data.sq.forEach((k, i) => {
      if (!(anim.done || i < anim.k)) return;
      const q = S / 4, X = gx + (k % 4 + 0.5) * q, Y = gy + ((k / 4 | 0) + 0.5) * q;
      ctx.fillStyle = 'rgba(255,255,255,.82)'; K.roundRect(ctx, X - 15, Y - 10, 30, 20, 6); ctx.fill();
      ctx.fillStyle = '#1F5A3B'; ctx.fillText(String(F.counts[k]), X, Y + 0.5);
    });
    ctx.restore();
    D.eyepiece(ctx, cx, cy, R0);
    K.tagSmall(ctx, cx, Math.min(h - 6, cy + R0 + 22), 'Сітка 4 × 4 мм, глибина 0,2 мм · ×30', { color: '#DCEBE0', size: 11 });
    // лупа: активний (або останній) квадрат
    const k = act >= 0 ? act : data.sq[data.sq.length - 1];
    const LR = wide ? Math.min(h * 0.3, w * 0.15) : Math.min(w * 0.3, h * 0.17);
    const lcx = wide ? w * 0.63 : w * 0.33, lcy = wide ? h * 0.42 : h * 0.79;
    const q = S / 4, sxq = gx + (k % 4) * q, syq = gy + ((k / 4) | 0) * q;
    ctx.save(); ctx.strokeStyle = 'rgba(255,214,110,.55)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(sxq + q, syq); ctx.lineTo(lcx - LR * 0.7, lcy - LR * 0.7); ctx.moveTo(sxq + q, syq + q); ctx.lineTo(lcx - LR * 0.7, lcy + LR * 0.7); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(lcx, lcy, LR, 0, TAU); ctx.clip();
    D.fieldBackground(ctx, lcx, lcy, LR, { seed: 7 });
    ctx.fillStyle = 'rgba(214,190,120,.16)'; ctx.fillRect(lcx - LR, lcy - LR, 2 * LR, 2 * LR);
    const Z = LR * 1.25;            // сторона великого квадрата в лупі
    const zx = lcx - Z / 2, zy = lcy - Z / 2, i0 = k % 4, j0 = (k / 4) | 0;
    // лінії: малі поділки й потрійні межі
    ctx.strokeStyle = 'rgba(70,60,40,.35)'; ctx.lineWidth = 0.8;
    for (let t = -1; t <= 5; t++) { const p = zx + t * Z / 4, pp = zy + t * Z / 4; ctx.beginPath(); ctx.moveTo(p, zy - Z); ctx.lineTo(p, zy + 2 * Z); ctx.moveTo(zx - Z, pp); ctx.lineTo(zx + 2 * Z, pp); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(55,45,28,.7)'; ctx.lineWidth = 1;
    for (const e of [0, Z]) for (const d of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(zx + e + d, zy - Z); ctx.lineTo(zx + e + d, zy + 2 * Z); ctx.moveTo(zx - Z, zy + e + d); ctx.lineTo(zx + 2 * Z, zy + e + d); ctx.stroke(); }
    // клітини поблизу квадрата
    const zr = Math.max(3.5, data.rc * Z);
    const show = anim.done || act < 0 ? 1 : anim.p;
    const inSq = new Set(F.marks[k]);
    let shown = 0;
    const ord = F.marks[k];
    const nShow = Math.round(ord.length * show);
    const shownSet = new Set(ord.slice(0, nShow));
    F.cells.forEach(([x0, y0, kk], idx) => {
      const X = zx + (x0 - i0) * Z, Y = zy + (y0 - j0) * Z;
      if (X < lcx - LR - 10 || X > lcx + LR + 10 || Y < lcy - LR - 10 || Y > lcy + LR + 10) return;
      D.suspCell(ctx, X, Y, { rx: zr * (0.85 + kk * 0.4), ry: zr * (0.7 + kk * 0.3), rot: kk * 6, seed: idx + 1, dead: false, shrink: 1 }, { tint: '#E3CF9A' });
      if (inSq.has(idx) && shownSet.has(idx)) { ctx.strokeStyle = '#1F8A4C'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(X - 3, Y); ctx.lineTo(X - 0.5, Y + 3); ctx.lineTo(X + 4, Y - 3.5); ctx.stroke(); shown++; }
      else if (!inSq.has(idx) && (Math.abs(X - zx - Z) < zr * 1.3 || Math.abs(Y - zy - Z) < zr * 1.3) && X > zx - zr && Y > zy - zr && X < zx + Z + zr * 1.3 && Y < zy + Z + zr * 1.3) {
        ctx.strokeStyle = '#B23A2A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X - 3, Y - 3); ctx.lineTo(X + 3, Y + 3); ctx.moveTo(X + 3, Y - 3); ctx.lineTo(X - 3, Y + 3); ctx.stroke();
      }
    });
    ctx.restore();
    D.eyepiece(ctx, lcx, lcy, LR);
    D.scaleBar(ctx, lcx - LR * 0.42, lcy + LR * 0.78, Z / 4, '250 мкм');
    // табло підрахунку
    const tx = wide ? w * 0.8 : w * 0.7, ty = wide ? h * 0.1 : h * 0.66, tw = wide ? w * 0.18 : w * 0.28;
    ctx.save();
    ctx.fillStyle = 'rgba(247,250,246,.94)'; K.roundRect(ctx, tx - 4, ty, tw + 8, wide ? h * 0.8 : h * 0.31, 10); ctx.fill();
    ctx.fillStyle = '#13241A'; ctx.font = `700 ${wide ? 12 : 11}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(wide ? 'Журнал підрахунку' : 'Підрахунок', tx + 6, ty + 18);
    ctx.font = `600 ${wide ? 11.5 : 10.5}px system-ui, sans-serif`;
    const lines = [];
    const fShow = Math.min(anim.f, data.fills.length - 1);
    data.sq.forEach((kk, i) => { const ok = anim.done || i < anim.k || (i === anim.k && !anim.done); const n = data.fills[fShow].counts[kk]; lines.push([`кв. ${kk + 1}`, ok ? (i === anim.k && !anim.done ? Math.round(n * anim.p) : n) : '…', i === anim.k && !anim.done]); });
    const lh = wide ? Math.min(19, (h * 0.8 - 70) / (lines.length + 2)) : 14;
    lines.forEach(([a, b, on], i) => { const y = ty + 38 + i * lh; ctx.fillStyle = on ? '#C27C0E' : '#46584C'; ctx.fillText(a, tx + 6, y); ctx.textAlign = 'right'; ctx.fillStyle = on ? '#C27C0E' : '#13241A'; ctx.fillText(String(b), tx + tw, y); ctx.textAlign = 'left'; });
    const s = stats();
    const yb = ty + 38 + lines.length * lh + 6;
    ctx.strokeStyle = '#C9D6CC'; ctx.beginPath(); ctx.moveTo(tx + 6, yb - lh * 0.6); ctx.lineTo(tx + tw, yb - lh * 0.6); ctx.stroke();
    ctx.fillStyle = '#13241A'; ctx.fillText(`Σ = ${s.sum}`, tx + 6, yb + 4);
    if (wide) { ctx.fillText(`n̄ = ${fnum(s.mean, 1)}`, tx + 6, yb + 4 + lh); ctx.fillStyle = '#1F5A3B'; ctx.font = '700 12px system-ui, sans-serif'; ctx.fillText(`X = ${sci(s.X)}`, tx + 6, yb + 4 + 2 * lh); }
    ctx.restore();
    if (wide) D.frSlide(ctx, w * 0.63, h * 0.86, Math.min(w * 0.2, 180), { t: anim.f });
  }

  let runner;
  const runBtn = $('t5b-run');
  runBtn.addEventListener('click', () => { if (runner && (!runner.started || runner.done)) { anim = { f: 0, k: 0, p: 0, done: false }; gridCache.key = ''; } });
  runner = new K.Runner({
    btn: runBtn, reset: $('t5b-reset'), status: $('t5b-status'),
    step: (dt, t, reset) => {
      if (reset) { anim = { f: st.fills - 1, k: data.sq.length, p: 1, done: true }; gridCache.key = ''; update(); return; }
      if (anim.done) { runner.finish(); return; }
      const nHere = data.fills[anim.f].counts[data.sq[anim.k]];
      anim.p += dt / clamp(0.25 + nHere * 0.012, 0.5, 1.6);
      if (anim.p >= 1) {
        anim.p = 0; anim.k++;
        if (anim.k >= data.sq.length) { anim.k = 0; anim.f++; gridCache.key = ''; if (anim.f >= st.fills) { anim = { f: st.fills - 1, k: data.sq.length, p: 1, done: true }; } }
        update();
      }
      if (anim.done) { update(); runner.finish(); }
    },
    draw,
  });
  regen();
  K.onResize(cv.parentElement, () => { gridCache.key = ''; draw(); });
  return { draw: () => { gridCache.key = ''; draw(); } };
}

/* ========================================================================
   C. ЛР 19, 21 — життєздатність (синій Еванса / метиленовий синій) і агрегація (с. 90–92)
   ======================================================================== */
function modelC() {
  const cv = $('t5c-cv'); if (!cv) return null;
  const st = { dye: 'evans', a: 0.35, viab: 0.88, seed: 1, stain: 1, count: 1 };
  let cache = { key: '', u: null, s: null, units: null };
  const segD = K.segmented($('t5c-dye'), 't5c-dye', [{ value: 'evans', label: 'синій Еванса' }, { value: 'mb', label: 'метиленовий синій 0,1 %' }], st.dye, (v) => { st.dye = v; cache.key = ''; update(); draw(); });
  const sl = K.sliders($('t5c-sl'), [
    { id: 't5c-a', label: 'Ступінь агрегації', min: 0, max: 1, step: 0.05, value: st.a, unit: '', format: (v) => M.aggClass(M.aggFractions(v)).name.replace('агрегована', 'агр.') },
    { id: 't5c-v', label: 'Частка живих клітин', min: 20, max: 99, step: 1, value: st.viab * 100, unit: '%' },
  ], () => { st.a = sl.values['t5c-a']; st.viab = sl.values['t5c-v'] / 100; cache.key = ''; update(); draw(); });
  $('t5c-take').addEventListener('click', () => {
    if (!shared.sim) return;
    const s = shared.st, o = M.at(shared.sim, shared.day);
    st.a = M.aggIndex({ sp: s.sp, rpm: s.rpm, friable: s.friable, t: shared.day }); st.viab = o.viab;
    sl.set('t5c-a', Math.round(st.a * 20) / 20, true); sl.set('t5c-v', Math.round(st.viab * 100), true);
    cache.key = ''; update(); draw();
    $('t5c-status').textContent = `Проба з колби ЛР 18: доба ${fnum(shared.day, 1)} (${M.PHASES[o.phase].name} фаза).`;
  });
  $('t5c-new').addEventListener('click', () => { st.seed++; cache.key = ''; update(); draw(); });
  const bars = new Bars($('t5c-p1'), 'Склад суспензії порівняно з класами агрегованості посібника');
  const bars2 = new Bars($('t5c-p2'), 'Частка незабарвлених одиночних клітин і забарвлених клітин в агрегатах порівняно з критеріями');

  const SC = 0.0;   // (масштаб визначається в draw)
  void SC;
  /** Статистика з 9 полів зору (3 препарати × 3 поля, ЛР 21) — не менше 1000 клітин. */
  function census() {
    const fr = M.aggFractions(st.a);
    const dead = 1 - st.viab;
    let units = { s: 0, sm: 0, lg: 0 }, cells = { s: 0, sm: 0, lg: 0 }, deadC = { s: 0, sm: 0, lg: 0 };
    for (let f = 0; f < 9; f++) {
      const U = D.genField(st.seed * 31 + f, { fr, dead, aggDead: 0.18, n: 34, scale: 1 });
      for (const u of U) { const k = ['s', 'sm', 'lg'][u.kind]; units[k]++; cells[k] += u.cells.length; deadC[k] += u.cells.filter((c) => c.dead).length; }
    }
    const nU = units.s + units.sm + units.lg, nC = cells.s + cells.sm + cells.lg;
    const frObs = [units.s / nU * 100, units.sm / nU * 100, units.lg / nU * 100];
    const liveSingles = cells.s ? (1 - deadC.s / cells.s) * 100 : NaN;
    const aggC = cells.sm + cells.lg, stainedAgg = aggC ? (deadC.sm + deadC.lg) / aggC * 100 : NaN;
    return { units, cells, deadC, nU, nC, frObs, liveSingles, stainedAgg, cls: M.aggClass(frObs) };
  }
  let C;
  function update() {
    C = census();
    K.setOut($('t5c-reads'), {
      n: `${C.nC} кл. / ${C.nU} об'єктів`, s: pct(C.frObs[0]), sm: pct(C.frObs[1]), lg: pct(C.frObs[2]),
      ls: isFinite(C.liveSingles) ? pct(C.liveSingles) : '—', sa: isFinite(C.stainedAgg) ? pct(C.stainedAgg) : '—', cls: C.cls.name,
    });
    const col = ['#E3B23C', '#3F8F67', '#7A5230'];
    const row = (label, f, bold) => ({ label, bold, parts: f.map((v, i) => ({ v, c: col[i], ink: i === 0 ? '#3A2A06' : '#fff' })) });
    bars.set([row('Ваш препарат', C.frObs, true), ...M.AGG_CLASSES.map((c) => row(c.name.replace('агрегована', 'агр.'), c.f))],
      { legend: [[col[0], 'одиночні'], [col[1], 'дрібні агр. (≤ 12)'], [col[2], 'великі агр. (> 12)']] });
    bars2.set([
      { label: 'Одиночні: живі', bold: true, parts: [{ v: C.liveSingles || 0, c: C.liveSingles >= 70 ? '#2E8B57' : '#C0553A' }], mark: 70 },
      { label: 'Агрегати: сині', bold: true, parts: [{ v: C.stainedAgg || 0, c: C.stainedAgg < 50 ? '#3E6DB5' : '#C0553A' }], mark: 50 },
    ], { legend: [['#B23A2A', 'межа за посібником']] });
    const okS = C.liveSingles >= 70, okA = !(C.stainedAgg >= 50);
    const v = $('t5c-verdict');
    v.className = 'ag-verdict ' + (okS && okA ? '' : okS || okA ? 'is-warn' : 'is-bad');
    const dyeTxt = st.dye === 'evans' ? 'Синій Еванса не проходить крізь непошкоджену плазмалему — сині лише мертві клітини.' : 'Метиленовий синій у живих клітинах не накопичується (мембрана вибіркова, барвник відновлюється до безбарвної форми) — сині лише мертві клітини.';
    v.innerHTML = `<b>Суспензія ${C.cls.name}</b> (переважають ${['одиночні клітини', 'дрібні агрегати', 'великі агрегати'][C.frObs.indexOf(Math.max(...C.frObs))]}). ${dyeTxt} ` +
      `Незабарвлених одиночних клітин ${fnum(C.liveSingles, 0)} % ${okS ? '≥' : '<'} 70 %, забарвлених клітин в агрегатах ${fnum(C.stainedAgg, 0)} % ${okA ? '<' : '≥'} 50 % — ` +
      (okS && okA ? '<b>культура життєздатна</b> (с. 91).' : '<b>культура втрачає життєздатність</b> — пересадіть раніше або перевірте умови.');
    $('t5c-hud').innerHTML = `<span>${st.dye === 'evans' ? 'синій Еванса' : 'метиленовий синій'}</span><span>поле ${((st.seed - 1) % 9) + 1}/9</span>`;
  }

  function layers(R0, dpr) {
    const key = `${R0}|${st.seed}|${st.a}|${st.viab}|${st.dye}`;
    if (cache.key === key) return cache;
    const fr = M.aggFractions(st.a);
    const scale = R0 * 0.07 / 23;
    const units = D.layoutUnits(D.genField(st.seed * 31, { fr, dead: 1 - st.viab, aggDead: 0.18, n: 30, scale }), R0, st.seed);
    const mk = (stain) => {
      const c = K.offscreen(2 * R0 * dpr, 2 * R0 * dpr), x = c.getContext('2d'); x.scale(dpr, dpr);
      x.save(); x.beginPath(); x.arc(R0, R0, R0, 0, TAU); x.clip();
      D.fieldBackground(x, R0, R0, R0, { seed: st.seed });
      if (stain) { x.fillStyle = st.dye === 'evans' ? 'rgba(70,95,190,.10)' : 'rgba(60,120,190,.10)'; x.fillRect(0, 0, 2 * R0, 2 * R0); }
      D.drawUnits(x, R0, R0, units, { dye: st.dye, tint: '#E6DDB8', stainOf: () => (stain ? 1 : 0) });
      x.restore(); return c;
    };
    cache = { key, u: mk(false), s: mk(true), units };
    return cache;
  }

  function draw() {
    if (!visible(cv)) return;
    const { ctx, w, h, wide } = fitStage(cv, 1.9, 0.78);
    K.scene(ctx, w, h, { kind: 'bench', horizon: 0.78, light: 0.25 });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (wide) D.microscope(ctx, w * 0.12, h * 0.92, Math.min(h * 0.8, w * 0.2), { slideColor: st.dye === 'evans' ? 'rgba(50,70,170,.6)' : 'rgba(40,110,180,.6)' });
    const R0 = Math.round(wide ? Math.min(h * 0.45, w * 0.24) : Math.min(w * 0.48, h * 0.47));
    const cx = wide ? w * 0.5 : w / 2, cy = h / 2;
    const L = layers(R0, dpr);
    ctx.save(); ctx.translate(cx - R0, cy - R0);
    ctx.drawImage(L.u, 0, 0, 2 * R0, 2 * R0);
    // фронт барвника рухається з краю покривного скла
    if (st.stain > 0) {
      ctx.save(); ctx.beginPath();
      const fx = -R0 * 0.2 + st.stain * 2.6 * R0;
      ctx.moveTo(-5, -5);
      for (let y = -5; y <= 2 * R0 + 5; y += 6) ctx.lineTo(fx + Math.sin(y * 0.05) * R0 * 0.06 + K.noise(y * 0.03, 1, 3) * R0 * 0.1, y);
      ctx.lineTo(-5, 2 * R0 + 5); ctx.closePath(); ctx.clip();
      ctx.drawImage(L.s, 0, 0, 2 * R0, 2 * R0);
      ctx.restore();
    }
    // позначки підрахунку
    if (st.count > 0) {
      ctx.save(); ctx.beginPath(); ctx.arc(R0, R0, R0, 0, TAU); ctx.clip();
      const n = Math.round(L.units.length * st.count);
      ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      L.units.slice(0, n).forEach((u) => {
        const x = R0 + u.x, y = R0 + u.y;
        if (u.kind === 0) {
          const c = u.cells[0];
          ctx.strokeStyle = c.dead ? '#2449A8' : '#1E8A4C'; ctx.lineWidth = 1.6; ctx.setLineDash(c.dead ? [3, 2] : []);
          ctx.beginPath(); ctx.arc(x, y, c.rx + 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        } else {
          const r = u.ext + 3, dn = u.cells.filter((c) => c.dead).length;
          ctx.strokeStyle = u.kind === 2 ? 'rgba(160,82,30,.9)' : 'rgba(196,140,20,.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          const tx = x + r * 0.72, ty = y - r * 0.72, lab = dn ? `${u.cells.length}·${dn}` : String(u.cells.length);
          const m = ctx.measureText(lab).width;
          ctx.fillStyle = u.kind === 2 ? '#7A3D12' : '#8A6200'; K.roundRect(ctx, tx - m / 2 - 5, ty - 8, m + 10, 16, 8); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(lab, tx, ty + 0.5);
        }
      });
      ctx.restore();
    }
    ctx.restore();
    D.eyepiece(ctx, cx, cy, R0);
    D.scaleBar(ctx, cx + R0 * 0.18, cy + R0 * 0.8, 100 * R0 * 0.07 / 23, '100 мкм');
    // легенда праворуч / під полем
    if (wide) {
      const lx = w * 0.79, items = [['#1E8A4C', 'жива одиночна', 0], ['#2449A8', 'мертва (синя)', 1], ['#C48C14', 'дрібний агрегат', 2], ['#A0521E', 'великий агрегат', 2]];
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.9)'; K.roundRect(ctx, lx - 10, h * 0.2, w * 0.2, 128, 10); ctx.fill();
      ctx.font = '600 11.5px system-ui, sans-serif'; ctx.textBaseline = 'middle';
      items.forEach(([c, t, k], i) => { const y = h * 0.2 + 20 + i * 24; ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.setLineDash(k === 1 ? [3, 2] : k === 2 ? [5, 4] : []); ctx.beginPath(); ctx.arc(lx + 6, y, 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#13241A'; ctx.fillText(t, lx + 20, y); });
      ctx.fillStyle = '#46584C'; ctx.font = '600 10.5px system-ui, sans-serif'; ctx.fillText('«7·2» — 7 клітин, 2 сині', lx - 2, h * 0.2 + 116);
      ctx.restore();
    }
  }

  let runner;
  const runBtn = $('t5c-run');
  runBtn.addEventListener('click', () => { if (runner && (!runner.started || runner.done)) { st.stain = 0; st.count = 0; } });
  runner = new K.Runner({
    btn: runBtn, reset: $('t5c-reset'), status: $('t5c-status'),
    step: (dt, t, reset) => {
      if (reset) { st.stain = 1; st.count = 1; return; }
      if (st.stain < 1) st.stain = Math.min(1, st.stain + dt / 3.2);
      else if (st.count < 1) st.count = Math.min(1, st.count + dt / 2.5);
      else runner.finish();
    },
    draw,
  });
  update();
  K.onResize(cv.parentElement, () => { cache.key = ''; draw(); });
  return { draw: () => { cache.key = ''; draw(); } };
}

/* ========================================================================
   D. ЛР 22 — висів суспензії на агаризоване середовище, одноклітинні клони (с. 92)
   ======================================================================== */
function modelD() {
  const cv = $('t5d-cv'); if (!cv) return null;
  const st = { X: 2e6, dil: 100, phase: 'exp', single: 40, day: 21, spread: 1 };
  let res, cols = [], lawn = { key: '', c: null };
  const segDil = K.segmented($('t5d-dil'), 't5d-dil', [1, 10, 100, 1000].map((d) => ({ value: String(d), label: d === 1 ? 'без розведення' : `1 : ${d}` })), '100', (v) => { st.dil = +v; regen(); });
  K.segmented($('t5d-ph'), 't5d-ph', [{ value: 'exp', label: 'експоненційна фаза' }, { value: 'stat', label: 'стаціонарна фаза' }], 'exp', (v) => { st.phase = v; regen(); });
  const sl = K.sliders($('t5d-sl'), [
    { id: 't5d-x', label: 'Щільність суспензії', min: 1e5, max: 6e6, value: st.X, log: true, unit: 'кл/мл', format: (v) => sci(v) },
    { id: 't5d-s', label: 'Одиночних клітин серед об\'єктів', min: 0, max: 80, step: 5, value: st.single, unit: '%' },
    { id: 't5d-day', label: 'Доба після висіву', min: 0, max: 28, step: 0.5, value: st.day, unit: 'доба', digits: 1 },
  ], (id) => {
    st.X = sl.values['t5d-x']; st.single = sl.values['t5d-s']; st.day = sl.values['t5d-day'];
    if (id === 't5d-day') { update(); draw(); } else regen();
  });
  $('t5d-take').addEventListener('click', () => {
    if (!shared.sim) return;
    const s = shared.st, o = M.at(shared.sim, shared.day);
    st.X = clamp(o.X, 1e5, 6e6); sl.set('t5d-x', st.X, true);
    st.single = Math.round(M.aggFractions(M.aggIndex({ sp: s.sp, rpm: s.rpm, friable: s.friable, t: shared.day }))[0] / 5) * 5; sl.set('t5d-s', st.single, true);
    regen();
    $('t5d-status').textContent = `Проба з колби ЛР 18: доба ${fnum(shared.day, 1)}.`;
  });

  const diam = (c, t) => { // діаметр колонії, мм
    if (t <= c.t0) return 0;
    const g = (x) => 1 / (1 + Math.exp(-(x - 11) / 3.2));
    return 2.4 * c.k * Math.max(0, (g(t - c.t0) - g(0)) / (1 - g(0)));
  };
  function regen() {
    res = M.plating({ X: st.X, dil: st.dil, phase: st.phase, single: st.single, viab: shared.sim ? Math.max(0.6, M.at(shared.sim, Math.min(shared.day, 16)).viab) : 0.95 });
    const R = rng(1234 + st.dil);
    const n = Math.min(1600, Math.round(res.colonies));
    cols = Array.from({ length: n }, () => {
      const a = R() * TAU, d = Math.sqrt(R()) * 0.94, agg = R() > res.clonal;
      return { a, d, t0: (agg ? 2 : 3.5) + R() * 4 * (st.phase === 'exp' ? 1 : 1.5), k: (agg ? 1.15 : 0.8) + R() * 0.5, seed: (R() * 1e6) | 0, agg };
    });
    lawn.key = '';
    plots(); update(); draw();
  }
  const p1 = new K.Plot($('t5d-p1'), { xLabel: 'Щільність висіву, кл/см² (лог.)', yLabel: 'Ефективність висіву, %', x: [0, 4], y: [0, 35], xFmt: (v) => pow10(v), xShort: 'щільність', ariaLabel: 'Ефективність висіву залежно від щільності клітин на поверхні агару' });
  const p2 = new K.Plot($('t5d-p2'), { xLabel: 'Доба після висіву', yLabel: 'мм', x: [0, 28], y: [0, 3], xShort: 'доба', ariaLabel: 'Ріст діаметра колоній і середня відстань між ними' });
  function plots() {
    const pe = (dens) => M.plating({ X: dens * M.PLATE.area / M.PLATE.vol, dil: 1, phase: st.phase, single: st.single, viab: 0.95 }).pe * 100;
    p1.set([
      { data: K.sample((lx) => pe(Math.pow(10, lx)), 0, 4, 120), color: '#2E7D5B', width: 2.6, label: st.phase === 'exp' ? 'експоненційна фаза' : 'стаціонарна фаза' },
      { data: [], color: '#13241A', marker: [clamp(Math.log10(res.dens), 0, 4), res.pe * 100] },
    ], [{ x: Math.log10(M.PLATE.Xc), label: 'критична', color: '#8C6A10' }]);
    const avg = { t0: st.phase === 'exp' ? 5.5 : 6.5, k: 1.05 };
    p2.set([
      { data: K.sample((t) => diam(avg, t), 0, 28, 140), color: '#2E7D5B', width: 2.6, label: 'середній діаметр колонії' },
      { data: [[0, Math.min(3, res.spacing)], [28, Math.min(3, res.spacing)]], color: '#B5523B', width: 1.8, dash: [6, 4], label: 'відстань між колоніями' },
      { data: [], color: '#13241A', marker: [st.day, diam(avg, st.day)] },
    ]);
  }
  function update() {
    const avg = { t0: st.phase === 'exp' ? 5.5 : 6.5, k: 1.05 }, d = diam(avg, st.day);
    const merge = res.spacing < Math.max(0.6, d * 1.3);
    K.setOut($('t5d-reads'), {
      cells: sci(res.cells), dens: `${fnum(res.dens, res.dens < 10 ? 1 : 0)} кл/см²`, col: st.day < 9 ? `(${sci(res.colonies)})` : sci(res.colonies),
      pe: pct(res.pe * 100, 1), cl: pct(res.clonal * 100), sp: `${fnum(res.spacing, 1)} мм`, d: `${fnum(d, 2)} мм`,
    });
    const msgs = [`У 0,5 мл ${st.dil > 1 ? `розведеної 1 : ${st.dil} ` : ''}суспензії ${sci(res.cells)} клітин → ${fnum(res.dens, 0)} кл/см² агару; ефективність висіву ${fnum(res.pe * 100, 1)} % → ≈ ${sci(res.colonies)} колоній на чашку.`];
    let cls = '';
    if (res.dens < M.PLATE.Xc) { msgs.push('Щільність нижча за критичну: поодинокі клітини не «кондиціюють» середовище своїми виділеннями й здебільшого не діляться.'); cls = 'is-warn'; }
    if (merge && st.day > 8) { msgs.push('Колонії зростаються в суцільний «газон» — окремі клони не виділити; розведіть суспензію сильніше.'); cls = 'is-warn'; }
    if (res.clonal < 0.5) { msgs.push(`Лише ${fnum(res.clonal * 100, 0)} % колоній походять з однієї клітини — решта з агрегатів; відфільтруйте суспензію через нейлон.`); cls = cls || 'is-warn'; }
    if (!cls) msgs.push('<b>Добрі умови для одноклітинних клонів:</b> колонії відокремлені, більшість — з одиночних клітин.');
    if (st.phase === 'stat') msgs.push('Клітини стаціонарної фази придатні, але діляться пізніше й рідше, ніж з експоненційної (с. 92).');
    const v = $('t5d-verdict'); v.className = 'ag-verdict ' + cls; v.innerHTML = msgs.join(' ');
    $('t5d-hud').innerHTML = `<span>доба ${fnum(st.day, 1)}</span><span>+24–26 °C</span>`;
    plots();
  }

  function draw() {
    if (!visible(cv)) return;
    const { ctx, w, h, wide } = fitStage(cv, 1.9, 0.75);
    const hy = K.scene(ctx, w, h, { kind: 'hood', horizon: wide ? 0.42 : 0.3, light: 0.6 });
    const r = wide ? Math.min(w * 0.3, h * 0.78) : Math.min(w * 0.46, h * 0.48);
    const pcx = wide ? w * 0.6 : w * 0.5, pcy = wide ? h * 0.6 : h * 0.6;
    const mm = (2 * r) / 90;   // px на мм
    const tilt = 0.45;
    const bigLawn = cols.length >= 1600 && st.day > 12;
    K.petri(ctx, pcx, pcy, r, { tilt, medium: { color: '#E9DFB6' }, contents: (c, p) => {
      if (st.spread < 1) { // рідина після висіву розтікається
        c.fillStyle = `rgba(250,246,226,${0.45 * (1 - st.spread)})`; c.beginPath(); c.ellipse(p.cx - p.rx * 0.1, p.cy, p.rx * (0.15 + st.spread * 0.8), p.ry * (0.15 + st.spread * 0.8), 0, 0, TAU); c.fill();
      }
      // колонії (сортуємо за глибиною)
      const vis = cols.map((cl) => ({ cl, x: p.cx + Math.cos(cl.a) * cl.d * p.rx, y: p.cy + Math.sin(cl.a) * cl.d * p.ry, d: diam(cl, st.day) })).filter((o) => o.d > 0.05).sort((a, b) => a.y - b.y);
      if (bigLawn) {
        c.save(); const g = c.createRadialGradient(p.cx, p.cy, 0, p.cx, p.cy, p.rx); g.addColorStop(0, 'rgba(236,222,170,.55)'); g.addColorStop(1, 'rgba(224,206,150,.35)'); c.fillStyle = g; c.beginPath(); c.ellipse(p.cx, p.cy, p.rx * 0.95, p.ry * 0.95, 0, 0, TAU); c.fill(); c.restore();
      }
      for (const o of vis) D.colony(c, o.x, o.y, (o.d * mm) / 2, { seed: o.cl.seed, tint: '#EDE2BE', brown: st.day > 24 ? 0.15 : 0 });
    } });
    // піпетка під час висіву
    if (st.spread < 1) D.pipette(ctx, pcx - r * 0.15 + (1 - st.spread) * 8, pcy - r * tilt * 0.6, Math.min(h * 0.5, 170), { ang: 0.25, fill: 0.6 * (1 - st.spread) });
    // лупа: колонія з однієї клітини
    if (wide) {
      const LR = Math.min(h * 0.3, w * 0.13), lcx = w * 0.16, lcy = h * 0.38;
      ctx.save(); ctx.beginPath(); ctx.arc(lcx, lcy, LR, 0, TAU); ctx.clip();
      const bg = ctx.createRadialGradient(lcx - LR * 0.3, lcy - LR * 0.3, 2, lcx, lcy, LR); bg.addColorStop(0, '#F4ECCB'); bg.addColorStop(1, '#D8C996'); ctx.fillStyle = bg; ctx.fillRect(lcx - LR, lcy - LR, 2 * LR, 2 * LR);
      // колонія: число клітин 2^(t−t0)/td
      const t0 = st.phase === 'exp' ? 3 : 4.5, td = 2;
      const nC = st.day < t0 ? 1 : Math.min(400, Math.pow(2, (st.day - t0) / td));
      const sc = LR * 0.05 / 23;
      if (nC < 40) {
        const U = D.genField(7, { fr: [nC < 1.5 ? 100 : 0, nC < 1.5 ? 0 : 100, 0], dead: 0, n: 1, scale: sc * 3.2 });
        const u = U[0]; u.cells = u.cells.slice(0, Math.max(1, Math.round(nC)));
        if (nC >= 1.5) { const R = rng(9); const cells = [{ x: 0, y: 0, rx: 17 * sc * 3.2, ry: 14 * sc * 3.2, rot: 0, dead: false, seed: 3, shrink: 1 }]; for (let i = 1; i < Math.round(nC); i++) { const b = cells[(R() * cells.length) | 0], a = R() * TAU; cells.push({ x: b.x + Math.cos(a) * b.rx * 1.6, y: b.y + Math.sin(a) * b.rx * 1.45, rx: 16 * sc * 3.2, ry: 13 * sc * 3.2, rot: R() * 3, dead: false, seed: i + 5, shrink: 1 }); } u.cells = cells; }
        D.drawUnits(ctx, lcx, lcy, [Object.assign(u, { x: 0, y: 0 })], { tint: '#E9DDB0' });
      } else D.colony(ctx, lcx, lcy, Math.min(LR * 0.8, 6 + Math.sqrt(nC) * 2.2), { seed: 4, tint: '#EDE2BE' });
      ctx.restore();
      D.eyepiece(ctx, lcx, lcy, LR);
      K.tagSmall(ctx, lcx, lcy + LR + 22, st.day < 3 ? 'одиночна клітина' : `клон: ≈ ${Math.round(nC)} кл.`, { color: '#173322', bg: 'rgba(255,255,255,.85)' });
      K.tagSmall(ctx, lcx, lcy - LR - 10, 'Лупа: розвиток клону', { color: '#173322', bg: 'rgba(255,255,255,.85)' });
    }
    K.tagSmall(ctx, pcx, Math.min(h - 8, pcy + r * tilt + r * 0.16 + 24), 'Чашка Петрі Ø 90 мм, агар із солями Гамборга', { color: '#173322', bg: 'rgba(255,255,255,.85)' });
    void hy;
  }

  let runner;
  const runBtn = $('t5d-run');
  runBtn.addEventListener('click', () => { if (runner && (!runner.started || runner.done)) { st.day = 0; st.spread = 0; sl.set('t5d-day', 0, true); } });
  runner = new K.Runner({
    btn: runBtn, reset: $('t5d-reset'), status: $('t5d-status'),
    step: (dt, t, reset) => {
      if (reset) { st.day = 21; st.spread = 1; sl.set('t5d-day', 21, true); update(); return; }
      if (st.spread < 1) { st.spread = Math.min(1, st.spread + dt / 1.6); return; }
      const prev = Math.floor(st.day);
      st.day = Math.min(28, st.day + dt * 1.4);
      if (Math.floor(st.day) !== prev) { sl.set('t5d-day', Math.floor(st.day), true); update(); }
      if (st.day >= 28) { update(); runner.finish(); }
    },
    draw,
  });
  regen();
  K.onResize(cv.parentElement, draw);
  return { draw };
}

/* ---------- старт ---------- */
function boot() {
  const models = { 't5-tab-a': modelA(), 't5-tab-b': modelB(), 't5-tab-c': modelC(), 't5-tab-d': modelD() };
  const tabs = $('t5-tabs');
  if (tabs) initTabs(tabs, (id) => { const m = models[id]; if (m) requestAnimationFrame(() => m.draw()); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
