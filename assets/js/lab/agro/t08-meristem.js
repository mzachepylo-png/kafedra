// Вкладка 1. Вичленування апікальної меристеми, термо- і хіміотерапія, оздоровлення (ЛР 26–28).
import { scene, tube, microField, Runner, onResize, Plot, sliders, segmented, fnum, rng, clamp, smooth, lerp, easeInOut, MAT, callout, TAU } from './kit.js';
import { meristem, VIRUSES, thermoTemp } from './t08-math.js';
import { rackBack, rackFront, elisaStrip, scalpel, shoot, apexField, primordiaIn, pill, text, thermoCabinet } from './t08-draw.js';
import { stageFit, reads, verdict, presets, checkbox, scheduler } from './t08-ui.js';

const DAYS = 45; // від посадки меристеми до пагона з 5–6 листками — 30–45 діб (с. 117)

export function init(root) {
  const $ = (id) => root.querySelector('#' + id);
  const cv = $('m1-cv');
  const fitStage = stageFit(cv, { desk: 16 / 9, mob: 0.72, min: 340, max: 520, mobMax: 600 });
  const st = { virus: 'pvx', L: 200, D: 0, T: 37, C: 0, show: true, seed: 1 };
  let res = meristem(st);
  let batch = [];
  const anim = { t: 0, on: false };

  // ---------- керування ----------
  const seg = segmented($('m1-virus'), 'm1v', [
    { value: 'pvx', label: 'Картопля · X-вірус' }, { value: 'pvy', label: 'Картопля · Y-вірус' },
    { value: 'carmv', label: 'Гвоздика · CarMV' }, { value: 'carvmv', label: 'Гвоздика · CarVMV' },
  ], st.virus, (v) => { st.virus = v; update(); });
  const sl = sliders($('m1-sliders'), [
    { id: 'm1L', label: 'Довжина експлантата L', min: 50, max: 1000, step: 10, value: st.L, unit: 'мкм', hint: 'від верхівки купола меристеми до лінії зрізу' },
    { id: 'm1D', label: 'Термотерапія', min: 0, max: 42, step: 1, value: st.D, unit: 'діб', hint: 'перший тиждень — підйом від +25 °C на 2 °C за добу' },
    { id: 'm1T', label: 'Температура термокамери', min: 35, max: 40, step: 0.5, value: st.T, unit: '°C', format: (v) => '+' + fnum(v, 1) },
    { id: 'm1C', label: 'Вірозол у середовищі', min: 0, max: 50, step: 5, value: st.C, unit: 'мг/л', hint: 'хіміотерапія: 20–50 мг/л (с. 112)' },
  ], (id) => { st.L = sl.values.m1L; st.D = sl.values.m1D; st.T = sl.values.m1T; st.C = sl.values.m1C; update(); });
  checkbox($('m1-opts'), 'Показати вірус (як після імунного фарбування)', st.show, (v) => { st.show = v; redraw(); });
  const nb = document.createElement('button'); nb.type = 'button'; nb.className = 'btn btn--outline btn--sm'; nb.textContent = '🎲 Нова серія з 10 меристем';
  nb.addEventListener('click', () => { st.seed++; makeBatch(); runner.reset(); });
  $('m1-opts').append(nb);
  const setAll = (o) => { Object.assign(st, o); if (o.virus) seg.select(o.virus); sl.set('m1L', st.L, true); sl.set('m1D', st.D, true); sl.set('m1T', st.T, true); sl.set('m1C', st.C, true); update(); };
  presets($('m1-presets'), [
    { label: 'ЛР 26: меристема до 1 мм', apply: () => setAll({ virus: 'carmv', L: 800, D: 0, C: 0 }) },
    { label: 'ЛР 27: 100–250 мкм', apply: () => setAll({ virus: 'pvx', L: 200, D: 0, C: 0 }) },
    { label: 'ЛР 28: термотерапія 4 тижні', apply: () => setAll({ virus: 'pvx', L: 300, D: 34, T: 37.5, C: 0 }) },
    { label: 'Хіміотерапія: вірозол 20 мг/л', apply: () => setAll({ virus: 'pvx', L: 200, D: 0, C: 20 }) },
  ]);

  // ---------- графіки ----------
  const p1 = new Plot($('m1-p1'), { xLabel: 'Довжина експлантата L, мкм', yLabel: 'Частка, %', x: [50, 1000], y: [0, 100], xShort: 'L', aspect: 1.55 });
  const p2 = new Plot($('m1-p2'), { xLabel: 'Тривалість термотерапії, діб', yLabel: 'Частка, %', x: [0, 42], y: [0, 100], xShort: 'доба', aspect: 1.55 });

  function makeBatch() {
    // 10 меристем: кількість живих і безвірусних — за очікуваними частками (заокруглення), розміщення — випадкове.
    const R = rng(st.seed * 97 + 13);
    const n = 10, nAlive = Math.round(n * res.Preg), nFree = Math.round(nAlive * res.Pvf);
    const idx = [...Array(n).keys()].sort(() => R() - 0.5);
    batch = Array.from({ length: n }, (_, i) => ({ alive: false, free: false, k: R(), seed: 30 + i * 7 + st.seed }));
    idx.slice(0, nAlive).forEach((i, j) => { batch[i].alive = true; batch[i].free = j < nFree; });
  }

  function update() {
    res = meristem(st);
    makeBatch();
    if (!runner.running) { runner.reset(); } else redraw();
    plots(); readouts();
  }
  function plots() {
    const L = [], a = [], b = [], c = [];
    for (let l = 50; l <= 1000; l += 10) { L.push(l); a.push([l, 100 * res.pvf(l)]); b.push([l, 100 * res.preg(l)]); c.push([l, 100 * res.pvf(l) * res.preg(l)]); }
    p1.set([
      { data: a, color: '#2E7D5B', label: 'безвірусні P<sub>вф</sub>'.replace(/<[^>]+>/g, ''), width: 2.5 },
      { data: b, color: '#B7791F', label: 'прижилися P_рег', width: 2.5, dash: [6, 4] },
      { data: c, color: '#8E3B2E', label: 'вихід здорових Y', width: 3, fill: 'rgba(142,59,46,.08)' },
    ], [{ x: st.L, label: `L = ${st.L} мкм`, color: '#1F6F8B' }, { x: res.Lopt, label: `L_опт ≈ ${res.Lopt}`, color: '#8C6A10' }]);
    const d0 = [], d1 = [], sv = [];
    for (let d = 0; d <= 42; d++) {
      d0.push([d, 100 * meristem({ ...st, D: d, C: 0 }).Pvf]);
      if (st.C > 0) d1.push([d, 100 * meristem({ ...st, D: d }).Pvf]);
      sv.push([d, 100 * meristem({ ...st, D: d }).survive]);
    }
    p2.set([
      { data: d0, color: '#2E7D5B', label: 'безвірусні без хіміотерапії', width: 2.5 },
      st.C > 0 ? { data: d1, color: '#5B4BA8', label: `+ вірозол ${st.C} мг/л`, width: 2.5 } : null,
      { data: sv, color: '#B7791F', label: 'виживання рослин-донорів', width: 2, dash: [6, 4] },
    ], [{ x: st.D, label: `${st.D} діб`, color: '#1F6F8B' }]);
  }
  function readouts() {
    const v = VIRUSES[st.virus];
    const prim = primordiaIn(st.L);
    reads(root, {
      lam: `${fnum(res.lam, 0)} мкм`,
      pvf: `${fnum(100 * res.Pvf, 0)} %`,
      preg: `${fnum(100 * res.Preg, 0)} %`,
      y: `${fnum(100 * res.Y, 0)} з 100`,
      lopt: `${res.Lopt} мкм`,
      prim: prim === 0 ? 'лише купол' : `купол + ${prim}`,
      surv: st.D > 0 ? `${fnum(100 * res.survive, 0)} %` : '—',
    });
    const el = $('m1-verdict');
    let lvl = 'ok', msg;
    if (st.L < 100) { lvl = 'warn'; msg = `Експлантат ${st.L} мкм майже напевно безвірусний (${fnum(100 * res.Pvf, 0)} %), але такий крихітний шматочок купола рідко регенерує пагін — прижилося лише ${fnum(100 * res.Preg, 0)} %. Вихід здорових рослин падає.`; }
    else if (res.Pvf < 0.3) { lvl = 'bad'; msg = `З такого експлантата (${st.L} мкм) лише ${fnum(100 * res.Pvf, 0)} % рослин будуть вільні від ${v.short === 'X-вірус картоплі' ? 'X-вірусу' : v.short}: у зріз потрапили тканини нижче межі безвірусної зони (λ ≈ ${fnum(res.lam, 0)} мкм). Зменште L до ${res.Lopt} мкм або додайте термо- чи хіміотерапію.`; }
    else if (res.Pvf < 0.75) { lvl = 'warn'; msg = `Безвірусних — ${fnum(100 * res.Pvf, 0)} %. Кожну рослину-регенерант треба перевірити імуноферментним аналізом (ІФА) і відібрати здорові. Оптимум для цих умов — L ≈ ${res.Lopt} мкм (вихід ${fnum(100 * res.Ymax, 0)} здорових на 100 меристем).`; }
    else { msg = `Добрий компроміс: ${fnum(100 * res.Pvf, 0)} % безвірусних і ${fnum(100 * res.Preg, 0)} % тих, що прижилися, — ≈ ${fnum(100 * res.Y, 0)} здорових рослин на 100 меристем.`; }
    if (st.D > 0 && res.survive < 0.75) { lvl = 'warn'; msg += ` Увага: за +${fnum(st.T, 1)} °C протягом ${st.D} діб гине ${fnum(100 - 100 * res.survive, 0)} % рослин-донорів — режим занадто жорсткий.`; }
    if (st.C > 0) msg += ` Вірозол ${st.C} мг/л розширює безвірусну зону в ${fnum(1 + st.C / 9, 1)} раза${st.C > 40 ? ', але трохи пригнічує регенерацію (фітотоксичність)' : ''}.`;
    verdict(el, msg, lvl);
  }

  // ---------- малювання ----------
  let geo = null, cache = null;
  function layout(w, h, narrow) {
    if (!narrow) {
      const r = Math.min(h * 0.44, w * 0.25);
      const fx = 14 + r * 1.1, fy = h * 0.5;
      const x0 = fx + r * 1.1 + Math.max(16, w * 0.035), x1 = w - 14;
      return { r, fx, fy, x0, x1, top: h * 0.2, th: h * 0.5, ey: h * 0.82, narrow };
    }
    const r = Math.min(w * 0.4, h * 0.25);
    const fx = w / 2, fy = r * 1.1 + 34;
    const top = fy + r * 1.1 + 40;
    return { r, fx, fy, x0: 14, x1: w - 14, top, th: h * 0.26, ey: h - 44, narrow };
  }
  function draw() {
    const { ctx, w, h, narrow } = fitStage();
    const day = anim.on ? anim.day : DAYS;
    const elisa = anim.on ? anim.elisa : 1;
    const g = geo = layout(w, h, narrow);
    scene(ctx, w, h, { kind: 'hood', horizon: narrow ? 0.62 : 0.6, light: 0.6 });
    // ----- бінокуляр: поле зору з апексом -----
    const span = 1150; // мкм по вертикалі від верхівки до низу кола
    const s = (g.r * 1.74) / span;
    const topY = g.fy - g.r * 0.74;
    g.s = s; g.topY = topY;
    const cut = anim.on ? anim.cut : 0, lift = anim.on ? anim.lift : 0;
    microField(ctx, g.fx, g.fy, g.r, (c) => {
      const a = apexField(c, g.fx, topY, s, { L: st.L, lam: res.lam, showVirus: st.show, cut, lift: lift * g.r * 0.25, r: g.r, cy: g.fy });
      // скальпель
      if (anim.on && anim.cut > 0 && anim.cut < 1) scalpel(c, g.fx - a.half + 2 * a.half * anim.cut, a.yCut, 0.03, Math.max(0.6, g.r / 200));
      // мітки в полі зору
      const lx = g.fx + g.r * 0.22;
      const ys = [];
      const place = (y) => { let yy = y; for (const p of ys) if (Math.abs(p - yy) < 24) yy = p + 24; ys.push(yy); return yy; };
      callout(c, g.fx + 6, topY + 4, lx, place(topY - 6 > g.fy - g.r * 0.9 ? topY - 6 : g.fy - g.r * 0.82), 'купол меристеми', { dark: true, size: 11 });
      if (st.show && a.Y(res.lam) < g.fy + g.r * 0.85) callout(c, g.fx + a.widthAt(res.lam) * s + 8, a.Y(res.lam), lx + 8, place(a.Y(res.lam) + 4), `межа без вірусу λ ≈ ${fnum(res.lam, 0)} мкм`, { dark: true, size: 11 });
      callout(c, g.fx - a.half, a.yCut, g.fx - g.r * 0.92, a.yCut - 14 < g.fy - g.r * 0.6 ? a.yCut + 20 : a.yCut - 14, `зріз: ${st.L} мкм`, { dark: true, size: 11 });
    }, { mode: 'dark', scale: { px: 200 * s, text: '200 мкм' } });
    text(ctx, 'Бінокулярна лупа: верхівка паростка', g.fx, g.fy - g.r * 1.1 - 8, { align: 'center', size: 12, color: '#24372B', weight: 700 });

    // ----- штатив із 10 пробірками -----
    const n = batch.length, span2 = g.x1 - g.x0, cell = span2 / n;
    const tw = Math.min(30, cell * 0.66), th = g.th, ty = g.top;
    const tubes = batch.map((b, i) => ({ cx: g.x0 + cell * (i + 0.5), w: tw }));
    rackBack(ctx, g.x0 - 6, ty + th * 0.12, span2 + 12, tubes);
    const vigor = 0.6 + 0.4 * smooth(100, 600, st.L);
    const crop = VIRUSES[st.virus].crop;
    batch.forEach((b, i) => {
      const x = tubes[i].cx - tw / 2;
      tube(ctx, x, ty, tw, th, {
        medium: { level: 0.3, color: MAT.agar }, plug: 'foil',
        contents: (c, inn) => {
          const sY = inn.surface;
          const g0 = smooth(3, DAYS, day) * vigor * (0.8 + 0.4 * b.k);
          if (!b.alive) { // побуріння й загибель
            const br = smooth(2, 14, day);
            const rr = Math.max(1.2, (1.5 + st.L / 300) * (1 - 0.3 * br));
            c.fillStyle = `rgb(${lerp(150, 110, br)},${lerp(200, 78, br)},${lerp(110, 40, br)})`;
            c.beginPath(); c.ellipse(inn.x + inn.w / 2, sY - rr * 0.5, rr * 1.2, rr, 0, 0, TAU); c.fill();
            return;
          }
          if (g0 < 0.06) { c.fillStyle = '#B7D98A'; c.beginPath(); c.ellipse(inn.x + inn.w / 2, sY - 1.5, 1.5 + st.L / 300, 1.6 + st.L / 400, 0, 0, TAU); c.fill(); return; }
          const H = (th * 0.62) * g0;
          shoot(c, inn.x + inn.w / 2, sY, { h: H, nodes: Math.max(1, Math.round(1 + 4.5 * g0)), leafLen: Math.min(inn.w * 0.62, 5 + 13 * g0), leafW: crop === 'carn' ? 0.2 : 0.5, opposite: crop === 'carn', color: crop === 'carn' ? '#6F9E80' : MAT.leaf, seed: b.seed, stemW: Math.max(1, 2.2 * g0) });
        },
      });
      // номер
      text(ctx, String(i + 1), tubes[i].cx, ty + th + 22, { align: 'center', size: 10.5, color: '#2C4234', weight: 700 });
    });
    rackFront(ctx, g.x0 - 8, ty + th * 0.8, span2 + 16, th * 0.2 + 6);
    // ----- ІФА -----
    const ex = g.x0 + 6, ew = span2 - 12;
    const states = batch.map((b) => ({ na: !b.alive, v: b.free ? 0.05 + 0.04 * b.k : 0.75 + 0.25 * b.k }));
    const ey = ty + th + 34;
    if (elisa > 0 || !anim.on) {
      text(ctx, 'ІФА на віруси (жовте — є вірус)', ex - 4, ey - 6, { size: 11.5, color: '#24372B', weight: 700 });
      elisaStrip(ctx, ex, ey, ew, states, { reveal: elisa });
    }
    // HUD
    let hy = 10;
    const hud = [`Доба ${Math.round(day)} з ${DAYS}`];
    if (st.D > 0) hud.push(`термотерапія ${st.D} діб, +${fnum(st.T, 1)} °C`);
    if (st.C > 0) hud.push(`вірозол ${st.C} мг/л`);
    if (!anim.on) hud[0] = 'Прогноз на 45-ту добу';
    let hx = 10;
    for (const s2 of hud) { const m = pill(ctx, s2, hx, hy); hx += m.w + 6; if (hx > w - 140) { hx = 10; hy += m.h + 6; } }
    // підпис-висновок під пробірками
    const alive = batch.filter((b) => b.alive).length, free = batch.filter((b) => b.free).length;
    if (!anim.on || elisa >= 1) text(ctx, `Прижилося ${alive} з 10 · безвірусних ${free}`, g.x0 + span2 / 2, Math.min(h - 8, ey + span2 / n * 1.05 + 22), { align: 'center', size: 12.5, weight: 800, color: '#173322' });
  }
  const redraw = scheduler(draw);

  // ---------- запуск ----------
  const runner = new Runner({
    btn: $('m1-run'), reset: $('m1-reset'), status: $('m1-status'),
    step: (dt, t, reset) => {
      if (reset) { anim.on = false; anim.t = 0; $('m1-status').textContent = ''; return; }
      anim.on = true; anim.t = t;
      anim.cut = easeInOut(clamp(t / 1.6, 0, 1));
      anim.lift = easeInOut(clamp((t - 1.6) / 0.8, 0, 1));
      anim.day = clamp((t - 2.4) * 6, 0, DAYS);
      anim.elisa = clamp((t - 2.4 - DAYS / 6) / 1.6, 0, 1);
      $('m1-status').textContent = t < 1.6 ? 'Вичленування меристеми…' : t < 2.4 ? 'Перенесення на середовище МС' : anim.elisa <= 0 ? `Культивування: доба ${Math.round(anim.day)}` : 'Перевірка регенерантів методом ІФА';
      if (anim.elisa >= 1) { $('m1-status').textContent = 'Готово: результат ІФА'; runner.finish(); }
    },
    draw,
  });
  // перетягування лінії зрізу в полі зору
  const toL = (e) => {
    if (!geo) return null;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - geo.fx, y - geo.fy) > geo.r) return null;
    return clamp(Math.round((y - geo.topY) / geo.s / 10) * 10, 50, 1000);
  };
  let drag = false;
  cv.addEventListener('pointerdown', (e) => { const L = toL(e); if (L == null) return; drag = true; cv.setPointerCapture(e.pointerId); sl.set('m1L', L); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; const L = toL(e); if (L != null) sl.set('m1L', L); });
  cv.addEventListener('pointerup', () => { drag = false; });

  onResize(cv.parentElement, draw);
  update();
  return { draw, runner };
}
