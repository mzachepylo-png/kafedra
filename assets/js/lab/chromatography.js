// Хроматографія: модель колонки з анімацією зон і хроматограмою, «збільшувальне скло» на рівні молекул,
// крива Ван-Деемтера, планарна (ТШХ, паперова) та осадова хроматографія.
import { Plot, linspace, niceTicks, fmt } from './plot.js';
import { sliders, segmented, setOut, num, sig, rng } from './ui.js';
import { MODES, secKd, stokes, diffusion } from './chroma-data.js';
import { simulate, plateHeight, program } from './chroma-engine.js';

const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Canvas з урахуванням HiDPI; draw викликається після зміни розміру. */
function hiCanvas(canvas, height, draw) {
  const ctx = canvas.getContext('2d');
  const st = { ctx, w: 0, h: 0 };
  const fit = () => {
    const w = canvas.clientWidth;
    if (!w) return;
    const h = typeof height === 'function' ? height(w) : height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = w; st.h = h;
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  new ResizeObserver(fit).observe(canvas);
  st.fit = fit;
  return st;
}

/** Цикл анімації, що працює лише коли елемент видно на екрані. */
function visibleLoop(el, frame) {
  let vis = false, raf = 0, last = 0, active = true;
  const tick = (now) => {
    raf = 0;
    if (!vis || !active || document.hidden) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    frame(dt);
    raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && vis && active && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; kick(); }, { rootMargin: '80px' }).observe(el);
  document.addEventListener('visibilitychange', kick);
  return { start() { active = true; kick(); }, stop() { active = false; }, kick };
}

// =====================================================================
//  Стан моделі колонки
// =====================================================================
const S = { mode: MODES[0], preset: MODES[0].presets[0], v: 0, v2: 0, grad: { on: false, end: 0, tg: 10 }, u: 1, L: 150, dp: 5, load: 1, run: null, t: 0, playing: false, speed: 1 };
const SPEED_BASE = 11; // секунд на весь аналіз при швидкості 1×

const modeBox = $('cg-modes');
const MODE_ICONS = {
  ads: '<circle cx="6" cy="17" r="2.6"/><circle cx="12" cy="17" r="2.6"/><circle cx="18" cy="17" r="2.6"/><circle cx="9" cy="8" r="2.2" fill="currentColor"/>',
  rp: '<path d="M5 21V12c0-2 2-2 2-4s-2-2-2-4M12 21V12c0-2 2-2 2-4s-2-2-2-4M19 21V12c0-2 2-2 2-4s-2-2-2-4"/>',
  gc: '<path d="M4 18c3 0 3-3 6-3s3 3 6 3 3-3 4-3"/><circle cx="8" cy="7" r="1.6"/><circle cx="14" cy="5" r="1.6"/><circle cx="17" cy="10" r="1.6"/>',
  iex: '<circle cx="12" cy="12" r="8"/><path d="M8.5 12h7M12 8.5v7"/>',
  sec: '<circle cx="12" cy="12" r="8"/><path d="M12 4v5M12 15v5M4 12h5M15 12h5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  aff: '<path d="M4 20V14M4 14l4-4 3 3 3-3"/><path d="M14 10a4 4 0 1 1 6 3l-3 4-3-4"/>',
  chiral: '<path d="M7 5l-3 7 3 7M17 5l3 7-3 7"/><path d="M12 3v18" stroke-dasharray="2 2.5"/>',
};
const modeBtns = MODES.map((m) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'cg-mode'; b.setAttribute('role', 'tab'); b.dataset.mode = m.id;
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MODE_ICONS[m.viz]}</svg><span>${m.name}</span>`;
  b.addEventListener('click', () => selectMode(m));
  modeBox.append(b);
  return b;
});

const presetSel = $('cg-preset');
presetSel.addEventListener('change', () => selectPreset(S.mode.presets[+presetSel.value]));
const gradBox = $('cg-grad');
gradBox.addEventListener('change', () => { S.grad.on = gradBox.checked; buildGradCtrls(); recompute(); });

let condCtl = null, cond2Ctl = null, gradCtl = null, colCtl = null, secSeg = null;

function selectMode(m) {
  S.mode = m;
  modeBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m.id)));
  presetSel.innerHTML = m.presets.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
  selectPreset(m.presets[0]);
}

function selectPreset(p) {
  S.preset = p;
  const c = p.cond;
  S.v = c.value; S.v2 = p.cond2 ? p.cond2.value : undefined;
  S.grad = { on: !!c.gradOn, end: c.grad ? c.grad.end : 0, tg: c.grad ? c.grad.tg : 10 };
  S.u = p.column.u; S.L = p.column.L; S.dp = p.column.dp; S.load = 1;
  $('cg-note').innerHTML = p.note;
  // умови елюювання
  const box = $('cg-cond');
  box.innerHTML = '';
  secSeg = null;
  if (c.options) {
    const wrap = document.createElement('div');
    wrap.className = 'ctrl';
    wrap.innerHTML = `<label><span>${c.label}</span></label><div id="cg-gel"></div>`;
    box.append(wrap);
    secSeg = segmented($('cg-gel'), 'cg-gel', c.options.map((o) => ({ value: String(o.value), label: o.label })), String(c.value), (v) => { S.v = +v; recompute(); });
    cond2Ctl = null;
  } else {
    const isStep = !!p.column.step;
    const spec = [{ id: 'cgv', label: c.label, min: c.min, max: c.max, step: c.step, value: c.value, unit: c.unit, digits: c.digits }];
    if (p.cond2) spec.push({ id: 'cgv2', label: p.cond2.label, min: p.cond2.min, max: p.cond2.max, step: p.cond2.step, value: p.cond2.value, unit: p.cond2.unit, digits: p.cond2.digits });
    condCtl = sliders(box, spec, () => { S.v = condCtl.values.cgv; if (p.cond2) S.v2 = condCtl.values.cgv2; if (S.grad.on && gradCtl) clampGrad(); recompute(); });
    if (isStep) {
      const h = document.createElement('small');
      h.className = 'ctrl__hint';
      h.textContent = 'Програма: введення проби та промивання (5·t₀), потім — буфер елюції.';
      box.append(h);
    }
  }
  $('cg-gradrow').hidden = !c.grad;
  gradBox.checked = S.grad.on;
  buildGradCtrls();
  // колонка
  const col = p.column, cb = $('cg-colc');
  cb.innerHTML = '';
  const uS = col.uScale || 1, uUnit = col.uUnit || 'мм/с';
  const isGC = p.cond.uniform;
  const spec = [
    { id: 'cgu', label: 'Швидкість потоку РФ', min: col.umin * uS, max: col.umax * uS, step: col.umax * uS > 20 ? 1 : 0.05, value: col.u * uS, unit: uUnit, digits: col.umax * uS > 20 ? 0 : 2 },
    isGC
      ? { id: 'cgL', label: 'Довжина капіляра', min: 10, max: 60, step: 5, value: col.L / 1000, unit: 'м' }
      : { id: 'cgL', label: 'Довжина колонки', min: Math.round(col.L * 0.4 / 10) * 10, max: col.L * 2, step: 10, value: col.L, unit: 'мм' },
    isGC
      ? { id: 'cgdp', label: 'Внутрішній діаметр капіляра', min: 100, max: 530, step: 10, value: col.dp, unit: 'мкм' }
      : { id: 'cgdp', label: 'Розмір частинок сорбенту', min: col.sec || col.step ? 10 : 1.7, max: col.sec || col.step ? 120 : 15, step: col.sec || col.step ? 1 : 0.1, value: col.dp, unit: 'мкм' },
    { id: 'cgload', label: 'Навантаження проби', min: 1, max: 8, step: 0.5, value: 1, unit: '×', digits: 1, hint: 'Перевантаження: нелінійна ізотерма Ленгмюра дає «хвости» піків.' },
  ];
  colCtl = sliders(cb, spec, () => {
    const v = colCtl.values;
    S.u = v.cgu / uS; S.L = isGC ? v.cgL * 1000 : v.cgL; S.dp = v.cgdp; S.load = v.cgload;
    recompute();
  });
  // механізм
  const m = S.mode;
  $('cg-mech').innerHTML = `<h3>${m.name} хроматографія</h3>
    <dl><dt>Рушійна сила</dt><dd>${m.force}</dd><dt>Фази</dt><dd>${m.phases}</dd><dt>Порядок виходу</dt><dd>${m.order}</dd></dl>`;
  micro.setMode(m.viz);
  recompute();
}

function clampGrad() {
  const c = S.preset.cond;
  if (!gradCtl) return;
  S.grad.end = gradCtl.values.cgend; S.grad.tg = gradCtl.values.cgtg;
}

function buildGradCtrls() {
  const p = S.preset, c = p.cond, box = $('cg-gradc');
  box.innerHTML = '';
  gradCtl = null;
  if (!c.grad || !S.grad.on) { box.hidden = true; return; }
  box.hidden = false;
  const lab = c.uniform ? 'Кінцева температура' : 'Кінцеве значення';
  gradCtl = sliders(box, [
    { id: 'cgend', label: lab, min: c.min, max: c.max, step: c.step, value: S.grad.end, unit: c.unit, digits: c.digits },
    { id: 'cgtg', label: c.uniform ? 'Тривалість нагрівання' : 'Тривалість градієнта', min: 2, max: 60, step: 1, value: S.grad.tg, unit: 'хв' },
  ], () => { clampGrad(); updateRate(); recompute(); });
  const h = document.createElement('small');
  h.className = 'ctrl__hint'; h.id = 'cg-rate';
  box.append(h);
  updateRate();
}
function updateRate() {
  const h = $('cg-rate'), c = S.preset.cond;
  if (!h) return;
  const r = (S.grad.end - S.v) / S.grad.tg;
  h.textContent = c.uniform ? `Швидкість нагрівання: ${num(r, 1)} °C/хв` : `Нахил градієнта: ${num(r, Math.abs(r) < 0.1 ? 3 : 2)} ${c.unit}/хв`;
}

// =====================================================================
//  Перерахунок і відображення результатів
// =====================================================================
let recomputeQueued = false;
function recompute() {
  if (recomputeQueued) return;
  recomputeQueued = true;
  requestAnimationFrame(() => {
    recomputeQueued = false;
    const tPrev = S.run ? S.t / S.run.tEnd : 0;
    S.run = simulate(S.preset, S);
    S.t = S.playing ? tPrev * S.run.tEnd : (S.t > 0 ? Math.min(S.t, S.run.tEnd) : 0);
    timeline.max = 1000;
    timeline.value = Math.round(S.t / S.run.tEnd * 1000);
    column.setRun();
    chrom.setRun();
    report();
    drawAll();
    micro.refresh();
  });
}

const isSec = () => !!S.preset.column.sec;
// Об'ємна швидкість для гель-фільтрації: F = u·S·ε₀ (переріз колонки 10 мм, ε₀ = 0,35)
const secArea = () => (S.preset.id === 'desalt' ? Math.PI * 64 : Math.PI * 25);
const flowMl = () => S.u * secArea() * 0.35 / 1000 * 60; // мл/хв
const xVal = (t) => (isSec() ? t / 60 * flowMl() : t / 60);
const xUnit = () => (isSec() ? 'V, мл' : 't, хв');

function report() {
  const r = S.run, p = S.preset, sec = isSec();
  const el = r.el;
  const last = el[el.length - 1];
  const notOut = r.zones.filter((z) => !z.eluted);
  const Ncol = S.L / (plateHeight(S.u, S.dp / 1000, p.column.Dm || 1e-3, p.column.h).H);
  setOut(document, {
    t0: sec ? num(xVal(r.t0), 1) + ' мл' : num(r.t0 / 60, 2) + ' хв',
    ncol: Math.round(Ncol).toLocaleString('uk-UA'),
    rmin: isFinite(r.Rmin) ? num(r.Rmin, 2) : '—',
    tan: last ? (sec ? num(xVal(last.tR), 1) + ' мл' : num(last.tR / 60, 1) + ' хв') : '—',
  });
  const rmBox = document.querySelector('[data-out="rmin"]')?.closest('.readout');
  if (rmBox) { rmBox.classList.toggle('readout--bad', isFinite(r.Rmin) && r.Rmin < 1.5); rmBox.classList.toggle('readout--gold', !(isFinite(r.Rmin) && r.Rmin < 1.5)); }
  const head = sec
    ? ['№', 'Речовина', 'K<sub>d</sub>', 'V<sub>R</sub>, мл', 'w, мл', 'N', 'R<sub>s</sub>']
    : ['№', 'Речовина', 'k′', 't<sub>R</sub>, хв', 'w, хв', 'N', 'R<sub>s</sub>'];
  const rows = el.map((z, j) => {
    const rs = z.Rs == null ? '—' : `<span class="${z.Rs < 1.5 ? 'rs-bad' : z.Rs < 2 ? 'rs-mid' : 'rs-ok'}">${num(z.Rs, 2)}</span>`;
    const kk = sec ? num(secKd(z.c, S.v), 2) : num(z.kApp, 2);
    const w = 4 * Math.hypot(z.sig, z.tau);
    return [j + 1, `<i class="dot" style="background:${z.c.color}"></i>${z.c.name}`, kk, num(xVal(z.tR), 2), num(xVal(w), sec ? 2 : 3), Math.round(z.N).toLocaleString('uk-UA'), rs];
  });
  notOut.forEach((z) => rows.push(['—', `<i class="dot" style="background:${z.c.color}"></i>${z.c.name}`, '—', '<em>не вийшла</em>', '—', '—', '—']));
  $('cg-table').innerHTML = `<thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  // підказка
  let tip = '';
  if (notOut.length) tip = `${notOut.map((z) => z.c.name).join(', ')} — не ${notOut.length > 1 ? 'вийшли' : 'вийшла'} з колонки за ${num(r.tEnd / 60, 0)} хв: ${p.cond.grad ? 'увімкніть градієнт або посильте елюент' : 'змініть умови елюювання'}.`;
  else if (isFinite(r.Rmin) && r.Rmin < 1) tip = 'Є піки, що перекриваються (R<sub>s</sub> < 1). Змініть склад елюенту, зменште швидкість потоку або подовжте колонку.';
  else if (isFinite(r.Rmin) && r.Rmin < 1.5) tip = 'Неповне розділення критичної пари (1 ≤ R<sub>s</sub> < 1,5) — піки розділені на 98 %, але не до базової лінії.';
  else if (last && last.tR > 40 * 60 && !sec) tip = 'Усі піки розділені, але аналіз задовгий. Спробуйте сильніший елюент або градієнт.';
  else tip = 'Усі піки розділені до базової лінії (R<sub>s</sub> ≥ 1,5).';
  $('cg-tip').innerHTML = tip;
  $('cg-collabel').textContent = `${p.column.label} · ${p.det}`;
}

// =====================================================================
//  Колонка: анімація зон
// =====================================================================
const TEX = {
  ads: { bg: '#F8F5EC', g: ['#FFFFFF', '#F0EADB', '#F3EEE2'], r: [1.2, 2.4] },
  rp: { bg: '#F1F3F5', g: ['#FFFFFF', '#E3E7EB', '#EAEDF0'], r: [1.2, 2.4] },
  gc: { bg: '#FBFBFA', film: '#EBCB7E', g: [], r: [0, 0] },
  iex: { bg: '#F1DDB7', g: ['#E0B66A', '#F7E3BC', '#D7A552'], r: [2.2, 3.4], shine: true },
  sec: { bg: '#E9F1F7', g: ['#FFFFFF', '#D8E6F1'], r: [3.6, 5.6], pores: true },
  aff: { bg: '#F2F5F9', g: ['#FFFFFF', '#E3EAF2'], r: [2.6, 4.2], lig: '#4CAF50' },
  chiral: { bg: '#F5F2FA', g: ['#FFFFFF', '#EAE4F4', '#EFEAF7'], r: [1.2, 2.4] },
};

const column = (() => {
  const cv = $('cg-column');
  let tex = null, texKey = '';
  const st = hiCanvas(cv, (w) => (w < 560 ? 132 : 150), () => { tex = null; draw(); });
  const geo = () => {
    const pl = st.w < 560 ? 44 : 64, pr = st.w < 560 ? 70 : 86;
    const th = clamp(st.h * 0.32, 32, 50);
    return { x0: pl, x1: st.w - pr, yc: st.h * 0.44, th };
  };
  function buildTex(g) {
    const viz = S.mode.viz, T = TEX[viz];
    const w = Math.max(10, Math.round(g.x1 - g.x0)), h = Math.round(g.th);
    const c = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * dpr; c.height = h * dpr;
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    x.fillStyle = T.bg; x.fillRect(0, 0, w, h);
    const R = rng(1234 + viz.length);
    if (T.film) {
      x.fillStyle = hexA(T.film, 0.55);
      x.fillRect(0, 0, w, 4); x.fillRect(0, h - 4, w, 4);
      x.strokeStyle = hexA('#B58B2A', 0.35); x.beginPath(); x.moveTo(0, 4.5); x.lineTo(w, 4.5); x.moveTo(0, h - 4.5); x.lineTo(w, h - 4.5); x.stroke();
    }
    const n = T.r[1] ? Math.round(w * h / (T.r[1] * T.r[1] * 2.6)) : 0;
    for (let i = 0; i < n; i++) {
      const r = T.r[0] + R() * (T.r[1] - T.r[0]);
      const px = R() * w, py = R() * h;
      x.fillStyle = T.g[Math.floor(R() * T.g.length)];
      x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill();
      if (T.shine) { x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(px - r * 0.35, py - r * 0.35, r * 0.35, 0, 6.283); x.fill(); }
      if (T.pores && R() < 0.8) { x.fillStyle = 'rgba(80,110,140,.28)'; for (let q = 0; q < 3; q++) { x.beginPath(); x.arc(px + (R() - 0.5) * r, py + (R() - 0.5) * r, 0.7, 0, 6.283); x.fill(); } }
      if (T.lig && R() < 0.35) { x.fillStyle = T.lig; x.beginPath(); x.arc(px + r * 0.6, py, 0.9, 0, 6.283); x.fill(); }
    }
    return c;
  }
  function frameAt(t) {
    const F = S.run.frames, dt = S.run.frameDt;
    let i = clamp(Math.floor(t / dt), 0, F.length - 1);
    while (i > 0 && F[i][0] > t) i--;
    while (i < F.length - 1 && F[i + 1][0] <= t) i++;
    const a = F[i], b = F[Math.min(i + 1, F.length - 1)];
    const f = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
    return { a, b, f };
  }
  function draw() {
    const { ctx, w, h } = st;
    if (!w || !S.run) return;
    const g = geo(), r = S.run, p = S.preset;
    const key = S.mode.viz + '|' + Math.round(g.x1 - g.x0) + '|' + Math.round(g.th);
    if (!tex || texKey !== key) { tex = buildTex(g); texKey = key; }
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;
    const top = g.yc - g.th / 2, tw = g.x1 - g.x0;
    // підводка та вихід
    ctx.strokeStyle = '#9FB3A3'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(8, g.yc); ctx.lineTo(g.x0 - 6, g.yc); ctx.moveTo(g.x1 + 6, g.yc); ctx.lineTo(g.x1 + 22, g.yc); ctx.stroke();
    // рух елюенту в підводці
    ctx.strokeStyle = '#4C9BB8'; ctx.lineWidth = 2; ctx.setLineDash([4, 7]);
    ctx.lineDashOffset = -((S.t / r.t0) * 60) % 11;
    ctx.beginPath(); ctx.moveTo(8, g.yc); ctx.lineTo(g.x0 - 6, g.yc); ctx.stroke();
    ctx.setLineDash([]);
    // корпус колонки
    ctx.save();
    roundRect(ctx, g.x0 - 6, top - 6, tw + 12, g.th + 12, 9);
    ctx.fillStyle = '#E4ECE6'; ctx.fill();
    ctx.strokeStyle = '#9FB3A3'; ctx.lineWidth = 1.5; ctx.stroke();
    roundRect(ctx, g.x0, top, tw, g.th, 5); ctx.clip();
    ctx.drawImage(tex, g.x0, top, tw, g.th);
    // елюент: градієнт / термостат / буфер елюції
    const c = p.cond;
    if (!c.options) {
      const lo = c.min, hi = c.max;
      const tint = c.uniform ? '224,96,46' : p.column.step ? '122,91,208' : '46,120,200';
      const seg = 48;
      for (let s = 0; s < seg; s++) {
        const xm = (s + 0.5) / seg * S.L;
        const v = c.uniform ? r.prog.at(S.t) : r.prog.at(S.t - xm / S.u);
        const nv = p.column.step ? (v === S.v2 ? 1 : 0) : clamp((v - lo) / (hi - lo), 0, 1);
        ctx.fillStyle = `rgba(${tint},${0.04 + 0.2 * nv})`;
        ctx.fillRect(g.x0 + s / seg * tw, top, tw / seg + 1, g.th);
      }
    }
    // зони
    const { a, b, f } = frameAt(S.t);
    const s0 = 0.004 * S.L / S.L * tw;
    ctx.globalCompositeOperation = 'multiply';
    S.preset.comps.forEach((cmp, i) => {
      const xa = a[1 + 2 * i], xb = b[1 + 2 * i];
      if (xa >= S.L * 1.1) return;
      const xm = xb >= S.L * 1.1 ? xa : xa + (xb - xa) * f;
      const sg = a[2 + 2 * i] + (b[2 + 2 * i] - a[2 + 2 * i]) * f;
      const sp = Math.max(3.2, sg / S.L * tw), cx = g.x0 + Math.max(xm / S.L * tw, 2.2 * sp);
      if (cx - 3 * sp > g.x1) return;
      const amt = cmp.amt ?? 1;
      const al = clamp((0.62 + 0.3 * Math.min(amt, 1.4)) * Math.min(1, 2.6 * Math.sqrt(Math.max(s0, 3.2) / sp)), 0.16, 0.97);
      const gr = ctx.createLinearGradient(cx - 3 * sp, 0, cx + 3 * sp, 0);
      for (let q = 0; q <= 8; q++) { const z = -3 + q * 0.75; gr.addColorStop(q / 8, hexA(cmp.color, al * Math.exp(-0.5 * z * z))); }
      ctx.fillStyle = gr;
      ctx.fillRect(cx - 3 * sp, top, 6 * sp, g.th);
    });
    ctx.globalCompositeOperation = 'source-over';
    // відблиск скла
    const sh = ctx.createLinearGradient(0, top, 0, top + g.th);
    sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(0.18, 'rgba(255,255,255,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,30,10,.10)');
    ctx.fillStyle = sh; ctx.fillRect(g.x0, top, tw, g.th);
    ctx.restore();
    // фітинги
    ctx.fillStyle = '#6B7C70';
    roundRect(ctx, g.x0 - 10, top - 9, 8, g.th + 18, 3); ctx.fill();
    roundRect(ctx, g.x1 + 2, top - 9, 8, g.th + 18, 3); ctx.fill();
    // детектор
    const dx = g.x1 + 22, dw = w - dx - 6, dy = g.yc - 26;
    roundRect(ctx, dx, dy, dw, 52, 9); ctx.fillStyle = '#0E2F18'; ctx.fill();
    const sigNow = signalAt(S.t);
    const lampR = 9;
    if (sigNow.v > 0.02) {
      const gl = ctx.createRadialGradient(dx + dw / 2, g.yc - 4, 1, dx + dw / 2, g.yc - 4, 22);
      gl.addColorStop(0, hexA(sigNow.color, clamp(sigNow.v, 0.3, 1))); gl.addColorStop(1, hexA(sigNow.color, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(dx + dw / 2, g.yc - 4, 22, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = sigNow.v > 0.02 ? sigNow.color : '#2B5536';
    ctx.beginPath(); ctx.arc(dx + dw / 2, g.yc - 4, lampR * 0.6, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#46584C'; ctx.textAlign = 'center';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('детектор', dx + dw / 2, dy + 68);
    // підписи
    ctx.font = FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#46584C';
    ctx.fillText('Проба →', 8, g.yc - 12);
    const unitL = p.cond.uniform ? `${num(S.L / 1000, 0)} м` : `${num(S.L, 0)} мм`;
    ctx.textAlign = 'center'; ctx.fillStyle = '#6B7C70';
    ctx.fillText(`0`, g.x0, top + g.th + 22);
    ctx.fillText(unitL, g.x1, top + g.th + 22);
    ctx.strokeStyle = '#C3D3C4'; ctx.lineWidth = 1;
    for (let q = 0; q <= 10; q++) { const xx = g.x0 + q / 10 * tw; ctx.beginPath(); ctx.moveTo(xx, top + g.th + 8); ctx.lineTo(xx, top + g.th + (q % 5 ? 11 : 14)); ctx.stroke(); }
    // час і поточні умови
    ctx.textAlign = 'left'; ctx.fillStyle = '#13241A'; ctx.font = '700 13px system-ui, sans-serif';
    const tl = isSec() ? `V = ${num(xVal(S.t), 1)} мл` : `t = ${num(S.t / 60, 2)} хв`;
    ctx.fillText(tl, g.x0, 18);
    if (!c.options) {
      const vin = r.prog.at(S.t);
      ctx.font = FONT; ctx.fillStyle = '#46584C';
      const cl = c.uniform ? `T = ${num(vin, 0)} °C` : `${shortCond(c.label)}: ${num(vin, c.digits ?? 0)}${c.unit ? ' ' + c.unit : ''}`;
      ctx.fillText(cl, g.x0 + ctx.measureText(tl).width + 26, 18);
    }
  }
  return { draw, setRun() { /* текстура залежить лише від виду */ }, fit: () => st.fit() };
})();

function shortCond(l) { return l.split(' (')[0].replace(/ у буфері$/, ''); }

function signalAt(t) {
  const r = S.run;
  if (!r) return { v: 0, color: '#000' };
  const p = clamp(Math.round(t / r.tEnd * (r.ts.length - 1)), 0, r.ts.length - 1);
  let best = -1, bv = 0;
  r.parts.forEach((arr, j) => { if (arr[p] > bv) { bv = arr[p]; best = j; } });
  return { v: r.ys[p] / r.yMax, color: best >= 0 ? r.el[best].c.color : '#000' };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// =====================================================================
//  Хроматограма
// =====================================================================
const chrom = (() => {
  const cv = $('cg-chrom');
  let hoverX = null;
  const st = hiCanvas(cv, (w) => clamp(Math.round(w / 2.6), 220, 320), () => draw());
  cv.addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); hoverX = e.clientX - b.left; draw(); });
  cv.addEventListener('pointerleave', () => { hoverX = null; draw(); });
  function draw() {
    const { ctx, w, h } = st;
    const r = S.run;
    if (!w || !r) return;
    const p = S.preset, c = p.cond;
    const showProg = !c.options && (r.prog.kind !== 'iso');
    const m = { l: 44, r: showProg ? 58 : 16, t: 18, b: 40 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const xMax = xVal(r.tEnd);
    const X = (t) => m.l + xVal(t) / xMax * pw;
    const yTop = r.yMax * 1.12;
    const Y = (y) => m.t + ph - y / yTop * ph;
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;
    // сітка
    const xt = niceTicks(0, xMax, Math.max(3, Math.round(pw / 80)));
    ctx.strokeStyle = '#E3EBE3'; ctx.lineWidth = 1; ctx.fillStyle = '#46584C'; ctx.textAlign = 'center';
    xt.ticks.forEach((v) => { const x = m.l + v / xMax * pw; ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.fillText(fmt(v, xt.step), x, m.t + ph + 16); });
    for (let q = 1; q <= 4; q++) { const y = m.t + ph * q / 4; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke(); }
    ctx.fillStyle = '#13241A'; ctx.fillText(xUnit(), m.l + pw / 2, h - 6);
    ctx.save(); ctx.translate(14, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Сигнал детектора', 0, 0); ctx.restore();
    // t0 / V0 маркер
    ctx.strokeStyle = '#C3D3C4'; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(X(r.t0), m.t); ctx.lineTo(X(r.t0), m.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#6B7C70'; ctx.textAlign = 'left'; ctx.fillText(isSec() ? 'V₀' : 't₀', X(r.t0) + 4, m.t + ph - 6);
    const animating = S.t > 0 && S.t < r.tEnd;
    const tLim = animating || S.playing ? S.t : r.tEnd;
    const N = r.ts.length, pLim = Math.min(N - 1, Math.floor(tLim / r.tEnd * (N - 1)));
    // програма елюенту (права вісь)
    if (showProg) {
      const step = !!p.column.step;
      const lo = step ? Math.min(c.min, p.cond2.min) : c.min, hi = step ? Math.max(c.max, p.cond2.max) : c.max;
      ctx.strokeStyle = p.column.step ? '#7A5BD0' : c.uniform ? '#E0602E' : '#2E78C8';
      ctx.lineWidth = 1.4; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (let q = 0; q <= 200; q++) {
        const t = r.tEnd * q / 200, v = r.prog.at(t);
        const yy = m.t + ph - (v - lo) / (hi - lo) * ph;
        q ? ctx.lineTo(X(t), yy) : ctx.moveTo(X(t), yy);
      }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'left';
      const yt = niceTicks(lo, hi, 4);
      yt.ticks.forEach((v) => { const yy = m.t + ph - (v - lo) / (hi - lo) * ph; ctx.fillText(fmt(v, yt.step), m.l + pw + 6, yy + 4); });
      ctx.save(); ctx.translate(w - 8, m.t + ph / 2); ctx.rotate(Math.PI / 2); ctx.textAlign = 'center';
      ctx.fillText(c.uniform ? 'T, °C' : (p.progLabel || shortCond(c.label)) + (c.unit ? ', ' + c.unit : ''), 0, 0); ctx.restore();
    }
    // піки
    const step = Math.max(1, Math.floor(N / pw / 1.5));
    r.parts.forEach((arr, j) => {
      const col = r.el[j].c.color;
      ctx.beginPath(); ctx.moveTo(X(r.ts[0]), Y(0));
      for (let q = 0; q <= pLim; q += step) ctx.lineTo(X(r.ts[q]), Y(arr[q]));
      ctx.lineTo(X(r.ts[pLim]), Y(arr[pLim])); ctx.lineTo(X(r.ts[pLim]), Y(0)); ctx.closePath();
      ctx.fillStyle = hexA(col, 0.3); ctx.fill();
    });
    if (!animating && !S.playing) {
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    for (let q = 0; q <= pLim; q += step) { const x = X(r.ts[q]), y = Y(r.ys[q]); q ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.lineTo(X(r.ts[pLim]), Y(r.ys[pLim]));
    ctx.strokeStyle = '#13241A'; ctx.lineWidth = 1.6; ctx.stroke();
    // номери піків
    ctx.textAlign = 'center'; ctx.font = '700 11px system-ui, sans-serif';
    r.el.forEach((z, j) => {
      if (z.tR > tLim) return;
      const pk = Math.round(z.tR / r.tEnd * (N - 1));
      const yy = Math.max(m.t + 10, Y(r.ys[clamp(pk, 0, N - 1)]) - 12);
      ctx.fillStyle = z.c.color; ctx.beginPath(); ctx.arc(X(z.tR), yy, 8, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(String(j + 1), X(z.tR), yy + 4);
    });
    // курсор часу
    if (animating || S.playing) {
      ctx.strokeStyle = '#B08A1E'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(S.t), m.t); ctx.lineTo(X(S.t), m.t + ph); ctx.stroke();
    }
    // підказка
    if (hoverX != null && hoverX > m.l && hoverX < m.l + pw) {
      const t = (hoverX - m.l) / pw * r.tEnd;
      let near = null, dmin = Infinity;
      r.el.forEach((z) => { const d = Math.abs(z.tR - t) / Math.max(z.sig, 1e-9); if (d < dmin) { dmin = d; near = z; } });
      ctx.strokeStyle = 'rgba(19,36,26,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hoverX, m.t); ctx.lineTo(hoverX, m.t + ph); ctx.stroke();
      const lines = [`${isSec() ? 'V' : 't'} = ${num(xVal(t), 2)} ${isSec() ? 'мл' : 'хв'}`];
      if (near && dmin < 4) lines.push(`${near.c.name}: ${isSec() ? 'V' : 't'}R = ${num(xVal(near.tR), 2)}`);
      ctx.font = FONT;
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
      const bx = hoverX + tw + 12 > w ? hoverX - tw - 8 : hoverX + 8;
      ctx.fillStyle = 'rgba(8,33,15,.92)'; roundRect(ctx, bx, m.t + 4, tw, 14 + lines.length * 16, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      lines.forEach((l, i) => { ctx.fillStyle = i ? '#EBD27F' : '#fff'; ctx.fillText(l, bx + 9, m.t + 20 + i * 16); });
    }
    // легенда
  }
  return { draw, setRun() {
    const lg = $('cg-legend');
    lg.innerHTML = S.run.el.map((z, j) => `<span><i style="background:${z.c.color}"></i>${j + 1}. ${z.c.name}</span>`).join('');
  } };
})();

function drawAll() { column.draw(); chrom.draw(); }

// =====================================================================
//  Відтворення
// =====================================================================
const timeline = $('cg-time');
const playBtn = $('cg-play');
const setPlayUI = () => {
  playBtn.innerHTML = S.playing
    ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>Пауза'
    : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>' + (S.run && S.t > 0 && S.t < S.run.tEnd ? 'Продовжити' : 'Запустити аналіз');
};
const loop = visibleLoop($('cg-column'), (dt) => {
  if (!S.playing) { loop.stop(); return; }
  S.t += dt * S.run.tEnd / SPEED_BASE * S.speed;
  if (S.t >= S.run.tEnd) { S.t = S.run.tEnd; S.playing = false; setPlayUI(); }
  timeline.value = Math.round(S.t / S.run.tEnd * 1000);
  timeline.style.setProperty('--pct', timeline.value / 10 + '%');
  drawAll();
  micro.syncTime();
});
playBtn.addEventListener('click', () => {
  if (S.playing) { S.playing = false; setPlayUI(); return; }
  if (S.t >= S.run.tEnd - 1e-6) S.t = 0;
  S.playing = true; setPlayUI(); loop.start();
});
$('cg-reset').addEventListener('click', () => {
  S.playing = false; S.t = 0; timeline.value = 0; timeline.style.setProperty('--pct', '0%'); setPlayUI(); drawAll(); micro.syncTime();
});
timeline.addEventListener('input', () => {
  S.playing = false; setPlayUI();
  S.t = timeline.value / 1000 * S.run.tEnd;
  timeline.style.setProperty('--pct', timeline.value / 10 + '%');
  drawAll(); micro.syncTime();
});
segmented($('cg-speed'), 'cg-speed', [{ value: '0.5', label: '0,5×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }], '1', (v) => { S.speed = +v; });

// =====================================================================
//  «Збільшувальне скло»: молекули біля нерухомої фази
// =====================================================================
const micro = (() => {
  const cv = $('cg-micro');
  const st = hiCanvas(cv, 230, () => { layout(); paint(); });
  let viz = 'ads', sites = [], beads = [], parts = [], reps = [], phase = 0;
  const R = rng(99);
  const FLOW = 70; // пікс/с
  const TAU = 0.9; // середній час у рухомій фазі, с
  const yb = () => st.h * 0.56;

  function layout() {
    const w = st.w, h = st.h, y0 = yb();
    sites = []; beads = [];
    if (!w) return;
    if (viz === 'sec') {
      for (let x = 40; x < w + 40; x += 92) beads.push({ x: x + (R() - 0.5) * 16, y: y0 + 46 + (R() - 0.5) * 14, r: 40 });
      beads.forEach((b) => { for (let q = 0; q < 7; q++) { const a = q / 7 * 6.283 + R(); const rr = 10 + R() * 22; sites.push({ x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr * 0.8, b }); } });
    } else if (viz === 'rp' || viz === 'gc') {
      for (let x = 10; x < w; x += 22) sites.push({ x, y: y0 + 22 + R() * (h - y0 - 40) });
    } else {
      const gap = viz === 'iex' ? 30 : viz === 'aff' || viz === 'chiral' ? 64 : 28;
      for (let x = 14; x < w; x += gap) sites.push({ x: x + (R() - 0.5) * 4, y: viz === 'aff' ? y0 + 22 : viz === 'chiral' ? y0 + 26 : y0 + 12 });
    }
  }

  // представники: перший, середній і останній за виходом
  function pickReps() {
    const r = S.run;
    if (!r) return [];
    const el = r.el.length ? r.el : r.zones;
    const idx = el.length <= 3 ? el.map((_, j) => j) : [0, Math.floor((el.length - 1) / 2), el.length - 1];
    return idx.map((j) => el[j].c);
  }
  function kNow(c) {
    const p = S.preset, cond = p.cond;
    const v = cond.options ? S.v : S.run.prog.at(S.t);
    return Math.max(0, p.k(c, v, p.column.step ? undefined : S.v2));
  }
  const radius = (c) => (viz === 'sec' && c.M ? clamp(2.2 * Math.cbrt(c.M / 1000), 3, 13) : viz === 'aff' && c.M ? 6.5 : 5);

  function refresh() {
    reps = pickReps();
    const keep = parts.length && parts[0].viz === viz && parts.length === reps.length * 7;
    if (!keep) {
      parts = [];
      sites.forEach((s) => { s.busy = false; });
      reps.forEach((c, ci) => { for (let q = 0; q < 7; q++) parts.push(newPart(ci, true)); });
      // стартовий розподіл: частка k/(1+k) молекул уже в нерухомій фазі
      parts.forEach((pt) => {
        const k = Math.min(kNow(pt.c), 60);
        if (R() < k / (1 + k)) {
          const free = sites.filter((s) => !s.busy);
          if (!free.length) return;
          const s = free[Math.floor(R() * free.length)];
          s.busy = true; pt.site = s; pt.state = 'bound'; pt.x = s.x; pt.y = s.y; pt.tl = -Math.log(R()) * TAU * Math.max(k, 0.05);
        }
      });
    }
    parts.forEach((pt) => { pt.c = reps[pt.ci]; pt.r = radius(pt.c); });
    legend();
    if (REDUCED) paint();
  }
  function newPart(ci, scatter) {
    const w = st.w || 600;
    return { viz, ci, c: reps[ci], x: scatter ? R() * w : -10, y: 14 + R() * (yb() - 30), state: 'free', tl: -Math.log(R()) * TAU, site: null, r: 5, a: R() * 6.28 };
  }
  function legend() {
    $('cg-micro-legend').innerHTML = reps.map((c) => {
      const k = Math.min(kNow(c), 1e4);
      const frac = k / (1 + k) * 100;
      return `<span><i style="background:${c.color}"></i><b>${c.name}</b> — у нерухомій фазі ${num(frac, frac > 99 ? 1 : 0)} % часу, швидкість зони ${sig(1 / (1 + k), 2)}·u</span>`;
    }).join('');
  }
  function syncTime() { if (S.preset.column.step || S.run.prog.kind !== 'iso') legend(); }

  function chooseSite(pt, k) {
    const fit = sites.filter((s) => s.x > pt.x + 10 && s.x < pt.x + 120 && !s.busy);
    if (viz === 'sec') {
      // великі молекули не входять у пори
      if (k < 0.02) return null;
    }
    return fit.length ? fit[Math.floor(R() * fit.length)] : null;
  }

  function step(dt) {
    const w = st.w, y0 = yb();
    phase += dt;
    parts.forEach((pt) => {
      const k = Math.min(kNow(pt.c), 60);
      pt.tl -= dt;
      if (pt.state === 'free') {
        pt.x += FLOW * dt * (0.85 + 0.3 * Math.sin(pt.a + phase));
        pt.y += (R() - 0.5) * 60 * dt;
        pt.y = clamp(pt.y, pt.r + 4, y0 - pt.r - 4);
        if (pt.tl <= 0) {
          const s = k > 0.01 ? chooseSite(pt, k) : null;
          if (s && R() < k / (k + 0.15)) { pt.state = 'bind'; pt.site = s; s.busy = true; }
          else pt.tl = -Math.log(R()) * TAU;
        }
      } else if (pt.state === 'bind') {
        const dx = pt.site.x - pt.x, dy = pt.site.y - pt.y, d = Math.hypot(dx, dy);
        if (d < 3) { pt.state = 'bound'; pt.tl = -Math.log(R()) * TAU * Math.max(k, 0.05) * 1.15; }
        else { const sp = Math.min(d, 160 * dt); pt.x += dx / d * sp; pt.y += dy / d * sp; }
      } else if (pt.state === 'bound') {
        pt.x = pt.site.x + Math.sin(phase * 7 + pt.a) * 0.8; pt.y = pt.site.y;
        if (pt.tl <= 0) { pt.state = 'rel'; pt.site.busy = false; pt.ty = 18 + R() * (y0 - 40); }
      } else if (pt.state === 'rel') {
        const dy = pt.ty - pt.y;
        pt.y += Math.sign(dy) * Math.min(Math.abs(dy), 150 * dt);
        pt.x += FLOW * 0.3 * dt;
        if (Math.abs(dy) < 2) { pt.state = 'free'; pt.tl = -Math.log(R()) * TAU; }
      }
      if (pt.x > w + 16) { if (pt.site) pt.site.busy = false; Object.assign(pt, newPart(pt.ci, false), { c: pt.c, r: pt.r }); }
    });
  }

  function paintStationary(ctx, w, h, y0) {
    const T = TEX[viz];
    if (viz === 'sec') {
      ctx.fillStyle = '#EEF4F9'; ctx.fillRect(0, y0, w, h - y0);
      beads.forEach((b) => {
        const g = ctx.createRadialGradient(b.x - 12, b.y - 14, 4, b.x, b.y, b.r);
        g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#C9DCEB');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 0.82, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#8FB0C9'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.strokeStyle = 'rgba(70,110,150,.35)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        for (let q = 0; q < 6; q++) {
          const a = q / 6 * 6.283 + 0.4;
          ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * b.r * 0.95, b.y + Math.sin(a) * b.r * 0.78);
          ctx.quadraticCurveTo(b.x + Math.cos(a + 0.5) * 16, b.y + Math.sin(a + 0.5) * 12, b.x + Math.cos(a + 1) * 6, b.y + Math.sin(a + 1) * 5); ctx.stroke();
        }
      });
      label(ctx, 'Пориста гранула гелю', 8, h - 8);
      return;
    }
    const g = ctx.createLinearGradient(0, y0, 0, h);
    if (viz === 'ads') { g.addColorStop(0, '#EDE5CF'); g.addColorStop(1, '#D9CDAA'); }
    else if (viz === 'rp') { g.addColorStop(0, '#F3F5F7'); g.addColorStop(1, '#C7CED6'); }
    else if (viz === 'gc') { g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#FFFFFF'); }
    else if (viz === 'iex') { g.addColorStop(0, '#E9C27C'); g.addColorStop(1, '#C48B35'); }
    else if (viz === 'aff') { g.addColorStop(0, '#F1F4F8'); g.addColorStop(1, '#D9E1EA'); }
    else { g.addColorStop(0, '#EEE8F7'); g.addColorStop(1, '#D3C8E8'); }
    if (viz === 'rp') {
      ctx.fillStyle = '#C7CED6'; ctx.fillRect(0, h - 16, w, 16);
      ctx.strokeStyle = '#7E8B97'; ctx.lineWidth = 1.6;
      for (let x = 6; x < w; x += 11) {
        ctx.beginPath(); ctx.moveTo(x, h - 16);
        for (let q = 1; q <= 9; q++) ctx.lineTo(x + Math.sin(q * 1.3 + phase * 1.5 + x) * 3, h - 16 - q * (h - y0 - 22) / 9);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.0)';
      label(ctx, 'Силікагель-C₁₈: «щітка» октадецильних ланцюгів', 8, h - 4);
      return;
    }
    if (viz === 'gc') {
      ctx.fillStyle = '#D6DCE0'; ctx.fillRect(0, h - 14, w, 14);
      const fg = ctx.createLinearGradient(0, y0, 0, h - 14);
      fg.addColorStop(0, 'rgba(235,203,126,.35)'); fg.addColorStop(1, 'rgba(214,170,70,.7)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(0, h - 14);
      for (let x = 0; x <= w; x += 10) ctx.lineTo(x, y0 + 8 + Math.sin(x / 40 + phase) * 3);
      ctx.lineTo(w, h - 14); ctx.closePath(); ctx.fill();
      label(ctx, 'Плівка нерухомої рідини на стінці капіляра', 8, h - 20);
      return;
    }
    ctx.fillStyle = g; ctx.fillRect(0, y0, w, h - y0);
    if (viz === 'ads') {
      sites.forEach((s) => {
        ctx.strokeStyle = '#9C8B5E'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, y0 + 12); ctx.lineTo(s.x, y0 + 2); ctx.stroke();
        ctx.fillStyle = '#D64B3A'; ctx.beginPath(); ctx.arc(s.x, y0 + 1, 3.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(s.x + 3.5, y0 - 2, 1.8, 0, 6.283); ctx.fill();
      });
      label(ctx, 'SiO₂: поверхневі групи ≡Si–OH', 8, h - 8);
    } else if (viz === 'iex') {
      sites.forEach((s) => {
        ctx.fillStyle = '#F7D774'; ctx.beginPath(); ctx.arc(s.x, s.y + 6, 6, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#7A4A10'; ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('−', s.x, s.y + 9.5);
        if (!s.busy) { ctx.fillStyle = '#8E6FD0'; ctx.beginPath(); ctx.arc(s.x + 6, s.y - 4, 3, 0, 6.283); ctx.fill(); }
      });
      label(ctx, 'Катіоніт: групи –SO₃⁻ з протиіонами Na⁺ (фіолетові)', 8, h - 8);
    } else if (viz === 'aff') {
      sites.forEach((s) => {
        ctx.strokeStyle = '#8A9AAC'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s.x, h - 6);
        for (let q = 1; q <= 5; q++) ctx.lineTo(s.x + (q % 2 ? 4 : -4), h - 6 - q * (h - 6 - s.y - 8) / 5);
        ctx.stroke();
        const lc = S.preset.id === 'proteinA' ? '#8E6FD0' : '#3E9E5A';
        ctx.fillStyle = lc; ctx.beginPath(); ctx.arc(s.x, s.y + 2, 6.5, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 7px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(S.preset.id === 'proteinA' ? 'A' : 'Ni', s.x, s.y + 4.5);
      });
      label(ctx, S.preset.id === 'proteinA' ? 'Агароза — спейсер — білок A' : 'Агароза — спейсер — Ni²⁺-NTA', 8, h - 8);
    } else if (viz === 'chiral') {
      sites.forEach((s) => {
        ctx.fillStyle = '#B9A6E0'; roundRect(ctx, s.x - 16, s.y - 4, 32, 18, 6); ctx.fill();
        [['#3F7FD0', -9], ['#E08A2E', 0], ['#3E9E5A', 9]].forEach(([c, dx]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(s.x + dx, s.y - 4, 3.2, 0, 6.283); ctx.fill(); });
      });
      label(ctx, 'Хіральний селектор з трьома центрами взаємодії', 8, h - 8);
    }
    void T;
  }
  function label(ctx, text, x, y, light) {
    ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = light ? 'rgba(19,36,26,.6)' : 'rgba(19,36,26,.62)';
    ctx.fillText(text, x, y + (light ? 12 : 0));
  }
  function paintPart(ctx, pt) {
    const c = pt.c;
    if (!c) return;
    const r = pt.r;
    if (viz === 'chiral' && c.glyph) {
      // енантіомер: трикутник з трьома групами; дзеркальний має лише два «правильні» кути
      const s = r * 1.5, mir = c.glyph === 2 ? -1 : 1;
      ctx.fillStyle = hexA(c.color, 0.9);
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y - s); ctx.lineTo(pt.x + s, pt.y + s * 0.7); ctx.lineTo(pt.x - s, pt.y + s * 0.7); ctx.closePath(); ctx.fill();
      const cols = mir > 0 ? ['#3F7FD0', '#E08A2E', '#3E9E5A'] : ['#3F7FD0', '#3E9E5A', '#E08A2E'];
      [[-s, s * 0.7], [0, -s], [s, s * 0.7]].forEach(([dx, dy], i) => { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(pt.x + dx * 0.75, pt.y + dy * 0.75, 2.2, 0, 6.283); ctx.fill(); });
      return;
    }
    const g = ctx.createRadialGradient(pt.x - r * 0.35, pt.y - r * 0.4, r * 0.15, pt.x, pt.y, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.35, hexA(c.color, 0.95)); g.addColorStop(1, hexA(c.color, 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, 6.283); ctx.fill();
    if (pt.state === 'bound') { ctx.strokeStyle = hexA(c.color, 0.45); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pt.x, pt.y, r + 3, 0, 6.283); ctx.stroke(); }
  }
  function paint() {
    const { ctx, w, h } = st;
    if (!w) return;
    const y0 = yb();
    ctx.clearRect(0, 0, w, h);
    // рухома фаза
    const mg = ctx.createLinearGradient(0, 0, 0, y0);
    mg.addColorStop(0, viz === 'gc' ? '#F7FAFC' : '#EEF6FB'); mg.addColorStop(1, viz === 'gc' ? '#FFFFFF' : '#F6FAFD');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, w, y0);
    ctx.strokeStyle = 'rgba(76,155,184,.22)'; ctx.lineWidth = 1.2;
    for (let q = 0; q < 6; q++) {
      const y = 16 + q * (y0 - 30) / 5, off = (phase * FLOW * (0.7 + q * 0.06)) % 80;
      ctx.setLineDash([26, 54]); ctx.lineDashOffset = -off;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.font = '700 11px system-ui, sans-serif'; ctx.fillStyle = 'rgba(46,120,200,.75)'; ctx.textAlign = 'right';
    ctx.fillText(viz === 'gc' ? 'газ-носій →' : 'рухома фаза →', w - 10, 16);
    paintStationary(ctx, w, h, y0);
    parts.forEach((pt) => paintPart(ctx, pt));
  }
  const ml = visibleLoop(cv, (dt) => { step(dt); paint(); });
  return {
    setMode(v) { viz = v; parts = []; layout(); paint(); },
    refresh() { refresh(); paint(); if (REDUCED) ml.stop(); else ml.start(); },
    syncTime,
  };
})();

// =====================================================================
//  Крива Ван-Деемтера
// =====================================================================
(() => {
  const host = $('vd-plot');
  if (!host) return;
  const ANALYTES = { small: { Dm: 1e-3, label: 'Мала молекула' }, pep: { Dm: diffusion(3000), label: 'Пептид' }, prot: { Dm: diffusion(66500), label: 'Білок' } };
  let an = 'small';
  const plot = new Plot(host, { xLabel: 'u, мм/с', yLabel: 'H, мкм', xShort: 'u', x: [0.05, 5], y: [0, 40], aspect: 1.9 });
  const sl = sliders($('vd-c'), [
    { id: 'vdp', label: 'Розмір частинок d<sub>p</sub>', min: 1.7, max: 10, step: 0.1, value: 5, unit: 'мкм' },
    { id: 'vu', label: 'Швидкість потоку u', min: 0.05, max: 5, step: 0.05, value: 1, unit: 'мм/с' },
    { id: 'vL', label: 'Довжина колонки', min: 50, max: 300, step: 10, value: 150, unit: 'мм' },
  ], update);
  segmented($('vd-an'), 'vd-an', Object.entries(ANALYTES).map(([value, o]) => ({ value, label: o.label })), an, (v) => { an = v; update(); });
  function update() {
    const { vdp, vu, vL } = sl.values, dp = vdp / 1000, Dm = ANALYTES[an].Dm;
    const us = linspace(0.05, 5, 200);
    const H = (u) => plateHeight(u, dp, Dm);
    const uopt = Math.sqrt(2 * Dm * Dm / (0.1 * dp * dp)); // √(b/c)·Dm/dp
    const cur = H(vu);
    const ymax = Math.min(Math.max(4 * H(uopt).H * 1000, 12), 400);
    plot.setOptions({ y: [0, Math.ceil(ymax / 5) * 5] });
    plot.set([
      { data: us.map((u) => [u, H(u).A * 1000]), color: '#9FB3A3', dash: [5, 4], width: 1.5, label: 'A — вихрова дифузія' },
      { data: us.map((u) => [u, H(u).B * 1000]), color: '#4C7DD8', dash: [5, 4], width: 1.5, label: 'B/u — поздовжня дифузія' },
      { data: us.map((u) => [u, H(u).C * 1000]), color: '#C0573E', dash: [5, 4], width: 1.5, label: 'C·u — масообмін' },
      { data: us.map((u) => [u, H(u).H * 1000]), color: '#1B5E20', width: 2.6, label: 'H = A + B/u + C·u', marker: [vu, cur.H * 1000] },
    ], [{ x: uopt, color: '#B08A1E', dash: [2, 4], label: 'u_опт' }]);
    setOut(document, {
      vdopt: sig(uopt, 2) + ' мм/с',
      vdhmin: num(H(uopt).H * 1000, 1) + ' мкм',
      vdh: num(cur.H * 1000, 1) + ' мкм',
      vdn: Math.round(vL / cur.H).toLocaleString('uk-UA'),
    });
  }
  update();
})();

// =====================================================================
//  Планарна та осадова хроматографія
// =====================================================================
(() => {
  const cv = $('pl-canvas');
  if (!cv) return;
  const PIG = MODES[0].presets[0].comps;
  const AA = [
    { name: 'Лейцин', rf: 0.73 }, { name: 'Валін', rf: 0.6 }, { name: 'Аланін', rf: 0.38 }, { name: 'Гліцин', rf: 0.26 }, { name: 'Аспарагінова', rf: 0.24 }, { name: 'Лізин', rf: 0.14 },
  ];
  const IONS = [
    { name: 'Ni²⁺', rf: 0.13, color: '#9CCB9A' }, { name: 'Co²⁺', rf: 0.54, color: '#7FA36A' }, { name: 'Cu²⁺', rf: 0.77, color: '#8A3B22' }, { name: 'Zn²⁺', rf: 0.94, color: '#F1F1EC' }, { name: 'Fe³⁺', rf: 1.0, color: '#1F4FA0' },
  ];
  const HAL = [
    { name: 'AgI', ion: 'I⁻', color: '#F2D23C', dark: '#E2C030', ksp: '8,3·10⁻¹⁷' },
    { name: 'AgBr', ion: 'Br⁻', color: '#F3E9A8', dark: '#D9CD8A', ksp: '5,0·10⁻¹³' },
    { name: 'AgCl', ion: 'Cl⁻', color: '#FBFBF8', dark: '#8E7F9B', ksp: '1,8·10⁻¹⁰' },
  ];
  const P = { mode: 'tlc', prog: 1, phi: 10, developed: false, mix: [1, 3, 5], light: false, hal: [1, 1.5, 1] };
  const st = hiCanvas(cv, (w) => clamp(Math.round(w * 0.5), 300, 380), () => draw());
  const ctrl = $('pl-ctrl');
  let sl = null;
  segmented($('pl-mode'), 'pl-mode', [
    { value: 'tlc', label: 'ТШХ: пігменти листка' }, { value: 'paper', label: 'Папір: амінокислоти' },
    { value: 'circ', label: 'Кругова: катіони' }, { value: 'precip', label: 'Осадова колонка' },
  ], 'tlc', (v) => { P.mode = v; P.prog = 0; P.developed = false; build(); run(); });
  function build() {
    ctrl.innerHTML = '';
    sl = null;
    const note = $('pl-note');
    if (P.mode === 'tlc') {
      sl = sliders(ctrl, [{ id: 'plphi', label: 'Ацетон у петролейному етері', min: 3, max: 40, step: 1, value: P.phi, unit: '%' }], () => { P.phi = sl.values.plphi; P.prog = 1; draw(); });
      note.innerHTML = 'Пластинка з силікагелем, на лінії старту — ацетоновий екстракт листка. R<sub>f</sub> = 1/(1 + k′): ті самі k′, що й у моделі колонки. Полярніший елюент піднімає всі плями вище, але може «злити» їх біля фронту.';
    } else if (P.mode === 'paper') {
      ctrl.innerHTML = '<div class="row"><button class="btn btn--sm" type="button" id="pl-dev">Проявити нінгідрином</button><button class="btn btn--sm btn--outline" type="button" id="pl-new">Нова суміш</button></div>';
      $('pl-dev').addEventListener('click', () => { P.developed = true; draw(); });
      $('pl-new').addEventListener('click', () => {
        const R = rng(Date.now() & 0xffff);
        const idx = [0, 1, 2, 3, 4, 5].sort(() => R() - 0.5).slice(0, 3).sort();
        P.mix = idx; P.developed = false; P.prog = 0; run();
      });
      note.innerHTML = 'Хроматографічний папір (нерухома фаза — вода в целюлозі), рухома фаза н-бутанол : оцтова кислота : вода (4 : 1 : 5). Амінокислоти безбарвні — після розділення папір обробляють нінгідрином. Визначте за R<sub>f</sub>, що входить до суміші X.';
    } else if (P.mode === 'circ') {
      note.innerHTML = 'Кругова паперова хроматографія катіонів III–IV груп: ацетон : 2 М HCl (7 : 1). Катіони, що утворюють стійкі хлоридні комплекси ([FeCl₄]⁻, [ZnCl₄]²⁻), рухаються з фронтом; Ni²⁺ залишається біля центру. Проявник — K₄[Fe(CN)₆].';
    } else {
      sl = sliders(ctrl, [
        { id: 'pli', label: 'I⁻ у пробі', min: 0, max: 3, step: 0.1, value: P.hal[0], unit: 'ммоль', digits: 1 },
        { id: 'plb', label: 'Br⁻ у пробі', min: 0, max: 3, step: 0.1, value: P.hal[1], unit: 'ммоль', digits: 1 },
        { id: 'plc', label: 'Cl⁻ у пробі', min: 0, max: 3, step: 0.1, value: P.hal[2], unit: 'ммоль', digits: 1 },
      ], () => { P.hal = [sl.values.pli, sl.values.plb, sl.values.plc]; P.prog = 1; draw(); });
      const lb = document.createElement('label'); lb.className = 'cg-check';
      lb.innerHTML = '<input type="checkbox" id="pl-light"> Витримати колонку на світлі';
      ctrl.append(lb);
      $('pl-light').addEventListener('change', (e) => { P.light = e.target.checked; draw(); });
      note.innerHTML = 'Колонка з Al₂O₃, просоченим AgNO₃. Галогеніди осаджуються зверху донизу в порядку зростання добутку розчинності: менш розчинний AgI витісняє Br⁻ і Cl⁻ нижче. Висота зони пропорційна кількості іона. На світлі AgCl темніє (фотохімічне відновлення срібла).';
    }
  }
  let raf = 0, tStart = 0;
  function run() {
    cancelAnimationFrame(raf);
    if (REDUCED) { P.prog = 1; draw(); return; }
    tStart = 0;
    const tick = (now) => {
      if (!tStart) tStart = now;
      P.prog = clamp((now - tStart) / 3800, 0, 1);
      draw();
      if (P.prog < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  $('pl-run').addEventListener('click', () => { P.prog = 0; if (P.mode === 'paper') P.developed = false; run(); });
  const ease = (x) => 1 - (1 - x) ** 2;

  function paperTex(ctx, x, y, w, h, base, fiber) {
    ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
    const R = rng(7);
    ctx.strokeStyle = fiber; ctx.lineWidth = 0.6;
    for (let i = 0; i < w * h / 260; i++) {
      const px = x + R() * w, py = y + R() * h, a = R() * 3.14, l = 3 + R() * 7;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke();
    }
  }
  function spot(ctx, x, y, rx, ry, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, hexA(color, a)); g.addColorStop(0.65, hexA(color, a * 0.75)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fill();
  }
  function draw() {
    const { ctx, w, h } = st;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;
    const out = [];
    if (P.mode === 'tlc' || P.mode === 'paper') {
      const pwid = Math.min(w * (P.mode === 'tlc' ? 0.42 : 0.7), P.mode === 'tlc' ? 280 : 520), ph = h - 40;
      const px = (w - pwid) / 2 - (w > 640 ? 80 : 0), py = 18;
      // камера з елюентом
      ctx.fillStyle = 'rgba(46,120,200,.08)'; roundRect(ctx, px - 24, py - 6, pwid + 48, ph + 18, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(46,120,200,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (P.mode === 'tlc') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(px, py, pwid, ph); const R = rng(3); ctx.fillStyle = 'rgba(200,205,195,.35)'; for (let i = 0; i < pwid * ph / 40; i++) ctx.fillRect(px + R() * pwid, py + R() * ph, 1, 1); }
      else paperTex(ctx, px, py, pwid, ph, '#FBF8EF', 'rgba(170,160,130,.18)');
      const yStart = py + ph - 28, yFront0 = py + 22;
      const prog = ease(P.prog);
      const yFront = yStart - (yStart - yFront0) * prog;
      // змочена частина
      ctx.fillStyle = 'rgba(46,120,200,.06)'; ctx.fillRect(px, yFront, pwid, py + ph - yFront);
      ctx.strokeStyle = 'rgba(46,120,200,.5)'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(px, yFront); ctx.lineTo(px + pwid, yFront); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#8A9A8E'; ctx.beginPath(); ctx.moveTo(px + 6, yStart); ctx.lineTo(px + pwid - 6, yStart); ctx.stroke();
      ctx.fillStyle = 'rgba(46,120,200,.18)'; ctx.fillRect(px - 24, py + ph - 8, pwid + 48, 20);
      ctx.fillStyle = '#6B7C70'; ctx.textAlign = 'left';
      ctx.fillText('старт', px + pwid + 30, yStart + 4);
      if (P.prog > 0.02) ctx.fillText('фронт', px + pwid + 30, yFront + 4);
      const dist = yStart - yFront;
      if (P.mode === 'tlc') {
        const cx = px + pwid / 2;
        PIG.forEach((c) => {
          const k = c.kr * (P.phi / 10) ** -c.n * 0.55;
          const rf = 1 / (1 + k);
          const y = yStart - rf * dist;
          const rr = 9 + 10 * rf * prog;
          spot(ctx, cx, y, rr * 1.7, Math.max(4, rr * 0.55), c.color, 0.85);
          out.push({ name: c.name, color: c.color, rf });
        });
        if (P.prog >= 1) {
          ctx.textAlign = 'left'; ctx.font = '600 11px system-ui, sans-serif';
          let lastY = -99;
          out.slice().sort((a, b) => b.rf - a.rf).forEach((o) => {
            let y = yStart - o.rf * dist + 4; if (y - lastY < 13) y = lastY + 13; lastY = y;
            ctx.fillStyle = o.color; ctx.fillRect(px + pwid + 6, y - 7, 8, 8);
            ctx.fillStyle = '#13241A'; ctx.fillText(`${o.name} · ${num(o.rf, 2)}`, px + pwid + 18 + (w > 640 ? 50 : 0), y);
          });
        }
      } else {
        const lanes = [...AA.map((a, i) => ({ label: a.name.slice(0, 3) + '.', items: [i] })), { label: 'X', items: P.mix }];
        const lw = pwid / lanes.length;
        lanes.forEach((ln, li) => {
          const cx = px + lw * (li + 0.5);
          ctx.fillStyle = '#13241A'; ctx.textAlign = 'center'; ctx.font = (ln.label === 'X' ? '700 ' : '600 ') + '11px system-ui, sans-serif';
          ctx.fillText(ln.label, cx, py + ph + 6);
          ln.items.forEach((i) => {
            const a = AA[i], y = yStart - a.rf * dist;
            if (P.developed) spot(ctx, cx, y, 9, 6, '#7B2D8E', 0.85);
            else { ctx.strokeStyle = 'rgba(19,36,26,.12)'; ctx.beginPath(); ctx.arc(cx, yStart, 3, 0, 6.283); ctx.stroke(); }
          });
        });
        AA.forEach((a) => out.push({ name: a.name, color: '#7B2D8E', rf: a.rf }));
      }
    } else if (P.mode === 'circ') {
      const R0 = Math.min(h / 2 - 16, w * 0.3), cx = w / 2 - (w > 640 ? 90 : 0), cy = h / 2;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 6.283); ctx.clip();
      paperTex(ctx, cx - R0, cy - R0, 2 * R0, 2 * R0, '#FBF8EF', 'rgba(170,160,130,.18)');
      const prog = ease(P.prog), rf0 = (R0 - 6) * prog;
      ctx.fillStyle = 'rgba(46,120,200,.07)'; ctx.beginPath(); ctx.arc(cx, cy, rf0, 0, 6.283); ctx.fill();
      IONS.forEach((ion) => {
        const rr = ion.rf * rf0;
        ctx.strokeStyle = hexA(ion.color, ion.name === 'Zn²⁺' ? 1 : 0.85); ctx.lineWidth = ion.rf >= 1 ? 6 : 8;
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, rr - (ion.rf >= 1 ? 3 : 0)), 0, 6.283); ctx.stroke();
        if (ion.name === 'Zn²⁺') { ctx.strokeStyle = 'rgba(120,120,110,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, rr + 4, 0, 6.283); ctx.stroke(); if (rr > 5) { ctx.beginPath(); ctx.arc(cx, cy, rr - 4, 0, 6.283); ctx.stroke(); } }
        out.push({ name: ion.name, color: ion.color, rf: ion.rf });
      });
      ctx.restore();
      ctx.strokeStyle = '#C3D3C4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 6.283); ctx.stroke();
      ctx.fillStyle = '#4C9BB8'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 6.283); ctx.fill();
      if (P.prog >= 1) {
        ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left';
        IONS.forEach((ion, i) => {
          const y = cy - R0 + 20 + i * 18, x = cx + R0 + 18;
          ctx.fillStyle = ion.color; ctx.fillRect(x, y - 8, 10, 10); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.strokeRect(x, y - 8, 10, 10);
          ctx.fillStyle = '#13241A'; ctx.fillText(`${ion.name} · Rf ${num(ion.rf, 2)}`, x + 16, y);
        });
      }
    } else {
      const cw = 56, chh = h - 44, cx = w / 2 - (w > 640 ? 70 : 40), top = 22;
      // колонка
      ctx.fillStyle = '#E4ECE6'; roundRect(ctx, cx - cw / 2 - 6, top - 6, cw + 12, chh + 12, 10); ctx.fill();
      ctx.save(); roundRect(ctx, cx - cw / 2, top, cw, chh, 6); ctx.clip();
      ctx.fillStyle = '#EDEFF0'; ctx.fillRect(cx - cw / 2, top, cw, chh);
      const R = rng(5); ctx.fillStyle = '#FFFFFF'; for (let i = 0; i < 520; i++) { ctx.beginPath(); ctx.arc(cx - cw / 2 + R() * cw, top + R() * chh, 1 + R() * 1.6, 0, 6.283); ctx.fill(); }
      const prog = ease(P.prog), tot = P.hal.reduce((a, b) => a + b, 0) || 1;
      const scale = (chh * 0.72) / 6; // мм на ммоль
      let y = top + 4;
      // фронт розчину
      ctx.fillStyle = 'rgba(46,120,200,.08)'; ctx.fillRect(cx - cw / 2, top, cw, chh * prog);
      HAL.forEach((z, i) => {
        const hz = P.hal[i] * scale * prog;
        if (hz > 0.5) {
          const col = P.light && i === 2 ? z.dark : P.light ? z.dark : z.color;
          const g = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
          g.addColorStop(0, col); g.addColorStop(0.5, '#FFFFFF'); g.addColorStop(1, col);
          ctx.fillStyle = col; ctx.fillRect(cx - cw / 2, y, cw, hz);
          ctx.globalAlpha = 0.25; ctx.fillStyle = g; ctx.fillRect(cx - cw / 2, y, cw, hz); ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.moveTo(cx - cw / 2, y + hz); ctx.lineTo(cx + cw / 2, y + hz); ctx.stroke();
        }
        out.push({ name: `${z.name} (з ${z.ion})`, color: P.light && i === 2 ? z.dark : z.color, y0: y, h: hz, ksp: z.ksp });
        y += hz;
      });
      void tot;
      ctx.restore();
      ctx.strokeStyle = '#9FB3A3'; ctx.lineWidth = 1.5; roundRect(ctx, cx - cw / 2, top, cw, chh, 6); ctx.stroke();
      if (P.prog >= 1) {
        ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left';
        out.forEach((o) => {
          if (o.h < 1) return;
          const yy = o.y0 + o.h / 2 + 4;
          ctx.strokeStyle = '#9FB3A3'; ctx.beginPath(); ctx.moveTo(cx + cw / 2 + 4, yy - 4); ctx.lineTo(cx + cw / 2 + 22, yy - 4); ctx.stroke();
          ctx.fillStyle = '#13241A'; ctx.fillText(`${o.name}, ДР = ${o.ksp}`, cx + cw / 2 + 28, yy);
        });
      }
    }
    // таблиця Rf
    const box = $('pl-out');
    if (P.mode === 'precip') box.innerHTML = '';
    else if (P.mode === 'paper' && !P.developed) box.innerHTML = '<span class="pl-hint">Плями амінокислот безбарвні — натисніть «Проявити нінгідрином».</span>';
    else if (P.prog >= 1) box.innerHTML = out.map((o) => `<span><i style="background:${o.color}"></i>${o.name}: R<sub>f</sub> = ${num(o.rf, 2)}</span>`).join('');
    else box.innerHTML = '';
  }
  build();
  run();
})();

// =====================================================================
//  Старт
// =====================================================================
selectMode(MODES[0]);
setPlayUI();
window.__cg = { S, MODES, selectMode, selectPreset: (i) => selectPreset(S.mode.presets[i]) };
void program; void stokes;
