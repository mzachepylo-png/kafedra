// Тема 9. Регулятори росту і розвитку рослин (ЛР 35–37, с. 127–131 посібника
// Мельничук М. Д., Кляченко О. Л. «Біотехнологія в агросфері», 2014).
// Вкладка А — біотести «доза — відповідь»: калюс сої на цитокініни (ЛР 35, табл. 9, с. 128)
//            і калюс топінамбура на ауксини (ЛР 36, табл. 10, с. 130).
// Вкладка Б — мікроживці картоплі / стевії / гвоздики на середовищах з ІОК, кінетином і ГК (ЛР 37, табл. 11, с. 131).
import {
  fit, scene, tube, callus, leaf, shadow, roundRect, tagSmall, callout, Runner, onResize, Plot, sliders, segmented,
  fnum, rng, clamp, lerp, smooth, easeInOut, mix, rgba, shade, hex, MAT, TAU, offscreen, noise, applyGrain, $,
} from './kit.js';

const isPhone = () => window.innerWidth < 600;

/* ---------------- Вкладки ---------------- */
function tabs(root) {
  const btns = [...root.querySelectorAll('[role="tab"]')];
  const show = (b) => {
    btns.forEach((x) => {
      const on = x === b;
      x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
      const p = document.getElementById(x.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    window.dispatchEvent(new Event('t9tab'));
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => show(b));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const j = (i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length; btns[j].focus(); show(btns[j]);
    });
  });
}

/* =====================================================================
   А. БІОТЕСТ «ДОЗА — ВІДПОВІДЬ»
   ---------------------------------------------------------------------
   Ріст калюсу описуємо логістичним рівнянням з лаг-фазою (наближення; посібник дає лише якісну
   закономірність: без гормону ріст зупиняється, з гормоном — відновлюється, с. 128–129):
     W(t) = Wmax·W0 / (W0 + (Wmax − W0)·e^(−μ·tₑ)),  tₑ = t − τ(1 − e^(−t/τ)),  τ = 4 доби (лаг-фаза);
   питома швидкість росту μ залежить від концентрації C (мг/л) за рівнянням Гілла з супраоптимальним
   гальмуванням:
     μ(C) = μ0 + (μmax − μ0) · Cⁿ/(EC50ⁿ + Cⁿ) · 1/(1 + (C/Ki)ᵐ).
   Відповідь біотесту — приріст маси ΔW = (Wt − W0)/W0 (тема 3, с. 73 посібника).
   EC50, Ki — навчальні оцінки за порядком активності з літератури (зеатин > 6-БАП > кінетин; 2,4-Д > ІОК > Івін).
   ===================================================================== */
const SYS = {
  soy: {
    name: 'Соя → цитокініни', short: 'соя', lr: 'ЛР 35', mu0: 0.004, muMax: 0.095, Wmax: 1400, tempC: '25–26',
    callus: { color: '#E6DCA4', friable: 0.25, glossy: 0.55 }, unitAgent: 'цитокініну',
    protocol: [0, 0.1, 0.5], // табл. 9: по 0,1 і 0,5 мг/л кожного цитокініну + безгормональний контроль
    calib: [0, 0.001, 0.01, 0.1, 1, 10],
    subs: {
      kin: { name: 'Кінетин', full: 'кінетин (6-фурфуриламінопурин)', ec50: 0.04, n: 1.2, ki: 8, m: 2, col: '#C47A12' },
      bap: { name: '6-БАП', full: '6-БАП (6-бензиламінопурин)', ec50: 0.015, n: 1.2, ki: 3, m: 2, col: '#2A6A93' },
      zea: { name: 'Зеатин', full: 'зеатин (природний цитокінін)', ec50: 0.005, n: 1.2, ki: 4, m: 2, col: '#2C7A4D' },
    },
    xPool: [0.012, 0.03, 0.07, 0.15, 0.25], // «екстракт X»: кінетин-еквівалент, мг/л
  },
  top: {
    name: 'Топінамбур → ауксини', short: 'топінамбур', lr: 'ЛР 36', mu0: 0.0, muMax: 0.085, Wmax: 1600, tempC: '26–28',
    callus: { color: '#F2EDDD', friable: 0.85, glossy: 0.75 }, unitAgent: 'ауксину',
    protocol: [0, 0.5, 1.0, 1.5], // табл. 10: 0,5; 1,0; 1,5 мг/л + безгормональний контроль
    calib: [0, 0.001, 0.01, 0.1, 1, 10],
    subs: {
      iaa: { name: 'ІОК', full: 'ІОК (індоліл-3-оцтова кислота)', ec50: 0.45, n: 1.3, ki: 12, m: 2, col: '#2A6A93' },
      d24: { name: '2,4-Д', full: '2,4-Д (2,4-дихлорфеноксиоцтова кислота)', ec50: 0.08, n: 1.3, ki: 2.5, m: 2.5, col: '#B5452B' },
      ivin: { name: 'Івін', full: 'Івін (N-оксид 2,6-диметилпіридину)', ec50: 0.9, n: 1.3, ki: 10, m: 2, col: '#2C7A4D' },
    },
    xPool: [0.12, 0.3, 0.6, 0.9],
  },
};
const TAU_LAG = 4;

function muOf(sys, sub, C) {
  const S = SYS[sys], p = S.subs[sub];
  if (C <= 0) return S.mu0;
  const H = Math.pow(C, p.n) / (Math.pow(p.ec50, p.n) + Math.pow(C, p.n));
  const I = 1 / (1 + Math.pow(C / p.ki, p.m));
  return S.mu0 + (S.muMax - S.mu0) * H * I;
}
function massAt(sys, mu, W0, t) {
  const S = SYS[sys];
  if (mu <= 0) return W0 * (1 + 0.06 * (1 - Math.exp(-t / 3))); // лише набубнявіння тканини
  const te = Math.max(0, t - TAU_LAG * (1 - Math.exp(-t / TAU_LAG)));
  return S.Wmax * W0 / (W0 + (S.Wmax - W0) * Math.exp(-mu * te));
}
const dW = (W, W0) => (W - W0) / W0;

/** Оптимум C на кривій μ(C) (числово, сітка по lg C). */
function optimum(sys, sub) {
  let best = 0, bc = 0;
  for (let e = -4; e <= 1.5; e += 0.01) { const c = Math.pow(10, e), m = muOf(sys, sub, c); if (m > best) { best = m; bc = c; } }
  return bc;
}
/** Обернена задача: концентрація стандарту, що дає таку саму ΔW, як зразок X (висхідна гілка кривої). */
function invert(sys, sub, target, W0, t) {
  const cOpt = optimum(sys, sub);
  let lo = -5, hi = Math.log10(cOpt);
  const f = (e) => dW(massAt(sys, muOf(sys, sub, Math.pow(10, e)), W0, t), W0) - target;
  if (f(hi) < 0 || f(lo) > 0) return NaN;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
  return Math.pow(10, (lo + hi) / 2);
}

function concLabel(c) {
  if (c === 0) return '0';
  return fnum(c, c < 0.01 ? 3 : c < 0.1 ? 2 : c < 1 ? 1 : c < 10 ? 1 : 0).replace(/,0$/, '');
}

function initA() {
  const root = $('t9a');
  if (!root) return;
  const cv = $('t9a-cv'), hud = $('t9a-hud');
  const st = { sys: 'soy', sub: 'kin', series: 'protocol', D: 28, W0: 50, X: true, xi: 2, day: 0, sel: 1 };

  // ---- керування
  const segSys = segmented($('t9a-sys'), 't9a-sys', [{ value: 'soy', label: 'Соя · цитокініни' }, { value: 'top', label: 'Топінамбур · ауксини' }], st.sys, (v) => {
    st.sys = v; st.sub = Object.keys(SYS[v].subs)[0]; st.xi = 1; buildSub(); st.sel = 1; refresh();
  });
  let segSub;
  function buildSub() {
    const host = $('t9a-sub'); host.replaceChildren(); host.className = '';
    segSub = segmented(host, 't9a-sub', Object.entries(SYS[st.sys].subs).map(([k, p]) => ({ value: k, label: p.name })), st.sub, (v) => { st.sub = v; refresh(); });
  }
  buildSub();
  segmented($('t9a-series'), 't9a-series', [{ value: 'protocol', label: 'Як у посібнику' }, { value: 'calib', label: 'Калібрувальний ряд' }], st.series, (v) => { st.series = v; st.sel = 1; refresh(); });
  const sl = sliders($('t9a-sl'), [
    { id: 'D', label: 'Тривалість культивування', min: 7, max: 35, step: 7, value: st.D, unit: 'діб', hint: 'Облік — що 7 діб (с. 128)' },
    { id: 'W0', label: 'Маса інокулюму W₀', min: 20, max: 150, step: 5, value: st.W0, unit: 'мг', hint: 'Інокулюм — шматочок калюсу, що його висаджують на середовище' },
  ], (id) => { st[id] = sl.values[id]; if (st.day > st.D) st.day = st.D; refresh(); });
  const chkX = $('t9a-x');
  chkX.checked = st.X;
  chkX.addEventListener('change', () => { st.X = chkX.checked; refresh(); });
  $('t9a-newx').addEventListener('click', () => { st.xi = (st.xi + 1) % SYS[st.sys].xPool.length; st.X = chkX.checked = true; refresh(); });

  // ---- графіки
  const p1 = new Plot($('t9a-p1'), { xLabel: 'Концентрація C, мг/л (логарифмічна шкала)', yLabel: 'Приріст маси ΔW', x: [-3, 1], xShort: 'lg C', aspect: 1.55,
    xFmt: (v) => (Math.abs(v - Math.round(v)) < 1e-6 ? concLabel(Math.pow(10, Math.round(v))) : ''), ariaLabel: 'Криві доза — відповідь для трьох речовин' });
  const p2 = new Plot($('t9a-p2'), { xLabel: 'Час культивування, доби', yLabel: 'Маса калюсу W, мг', xShort: 'доба', aspect: 1.55, ariaLabel: 'Динаміка маси калюсу в кожній пробірці' });

  // ---- набір пробірок
  function tubesList() {
    const S = SYS[st.sys];
    const cs = st.series === 'protocol' ? S.protocol : S.calib;
    const list = cs.map((c) => ({ c, isX: false }));
    if (st.X) list.push({ c: S.xPool[st.xi % S.xPool.length], isX: true }); // X — у кінетин- / ІОК-еквіваленті
    return list;
  }
  function tubeState(tb, t) {
    const S = SYS[st.sys];
    const ref = st.sys === 'soy' ? 'kin' : 'iaa'; // X «за складом» еквівалентний стандарту
    const mu = muOf(st.sys, tb.isX ? ref : st.sub, tb.c);
    const W = massAt(st.sys, mu, st.W0, t);
    const inhib = tb.isX ? 0 : tb.c > 0 ? 1 - 1 / (1 + Math.pow(tb.c / S.subs[st.sub].ki, S.subs[st.sub].m)) : 0;
    const starve = mu < 0.01 ? clamp(t / 28, 0, 1) : 0; // без гормону тканина поступово буріє
    return { mu, W, inhib, brown: clamp(inhib * 1.4 * smooth(3, 20, t) + starve * 0.55, 0, 0.9) };
  }
  const colorFor = (i, n, x) => (x ? '#7A3FA0' : rgba(mix('#A9BBA8', '#155C3A', n > 1 ? i / (n - 1) : 1)));

  // ---- сцена
  let geo = null;
  function layout(w, h) {
    const list = tubesList(), n = list.length;
    const wide = w > 620;
    const loupeR = wide ? Math.min(h * 0.3, 118) : Math.min(w * 0.2, 64);
    const areaL = 16, areaR = wide ? w - loupeR * 2 - 40 : w - 12;
    const slot = (areaR - areaL) / n;
    const tw = clamp(slot * 0.58, 20, 48);
    const hy = Math.round(h * (wide ? 0.8 : 0.82));
    const th = Math.min(tw * 4.6, hy - (wide ? 70 : loupeR * 2 + 34));
    const ty = hy - th - 10;
    const tubes = list.map((tb, i) => ({ ...tb, x: areaL + slot * (i + 0.5) - tw / 2, y: ty, w: tw, h: th, i }));
    const loupe = wide ? { cx: w - loupeR - 22, cy: h * 0.44, r: loupeR } : { cx: w - loupeR - 14, cy: loupeR + 12, r: loupeR };
    return { w, h, hy, tubes, loupe, wide, n };
  }

  function drawChamber(ctx, w, h, hy) {
    // внутрішня камера термостата: матова нержавійка, тепле слабке світло (дверцята відчинені на мить обліку)
    const g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, '#5A5F5C'); g.addColorStop(0.45, '#7D817B'); g.addColorStop(1, '#9A9C93');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy);
    // бічні стінки в перспективі
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.05, h * 0.06); ctx.lineTo(w * 0.05, hy); ctx.lineTo(0, hy); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w * 0.95, h * 0.06); ctx.lineTo(w * 0.95, hy); ctx.lineTo(w, hy); ctx.fill();
    // вертикальна шліфовка
    ctx.globalAlpha = 0.08; ctx.strokeStyle = '#FFF';
    for (let x = 0; x < w; x += 3) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5 + (x % 7), hy); ctx.lineWidth = (x % 5) * 0.2 + 0.2; ctx.stroke(); }
    ctx.globalAlpha = 1;
    // тепла пляма світла (лампа обліку)
    const r = ctx.createRadialGradient(w * 0.42, -h * 0.15, 10, w * 0.42, -h * 0.15, h * 1.2);
    r.addColorStop(0, 'rgba(255,236,200,.55)'); r.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, w, hy);
    // полиця: ґратка з дроту
    const t = ctx.createLinearGradient(0, hy, 0, h); t.addColorStop(0, '#B9BBB2'); t.addColorStop(1, '#6E716B');
    ctx.fillStyle = t; ctx.fillRect(0, hy, w, h - hy);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { const y = hy + 4 + i * (h - hy) / 6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(40,40,35,.25)';
    for (let x = -w; x < w * 2; x += 26) { ctx.beginPath(); ctx.moveTo(w / 2 + (x - w / 2) * 0.82, hy); ctx.lineTo(w / 2 + (x - w / 2) * 1.25, h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, hy, w, 1.5);
    const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    applyGrain(ctx, 0, 0, w, h, 0.05);
  }

  function display(ctx, x, y, temp) {
    ctx.save();
    const W = 118, H = 40;
    const g = ctx.createLinearGradient(x, y, x, y + H); g.addColorStop(0, '#2B302D'); g.addColorStop(1, '#151816');
    ctx.fillStyle = g; roundRect(ctx, x, y, W, H, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
    ctx.fillStyle = '#0B1F12'; roundRect(ctx, x + 6, y + 6, 70, H - 12, 4); ctx.fill();
    ctx.font = '700 17px ui-monospace, "SFMono-Regular", Menlo, monospace'; ctx.fillStyle = '#5DF08A'; ctx.shadowColor = '#3BE070'; ctx.shadowBlur = 6;
    ctx.textBaseline = 'middle'; ctx.fillText(temp, x + 10, y + H / 2 + 1);
    ctx.shadowBlur = 0; ctx.font = '700 10px system-ui, sans-serif'; ctx.fillStyle = '#D7DDD8';
    ctx.fillText('°C', x + 80, y + 14); ctx.fillStyle = '#9AA59E'; ctx.fillText('темр.', x + 80, y + 28);
    ctx.restore();
  }

  /** Калюс у пробірці: розмір ∝ ∛W; коли ширший за пробірку — стискається з боків і росте вгору. */
  function drawCallus(ctx, cx, by, W, innerW, opts, seed, mag = 1) {
    const S = SYS[st.sys];
    let size = 0.56 * innerW * Math.cbrt(W / 300) * mag;
    const half = size * 0.92, lim = innerW * 0.5 * mag;
    ctx.save();
    if (half > lim) { const sx = lim / half; ctx.translate(cx, by); ctx.scale(sx, 1 / Math.sqrt(sx)); ctx.translate(-cx, -by); }
    callus(ctx, cx, by + 1, size, { ...S.callus, brown: opts.brown, seed });
    ctx.restore();
  }

  function draw() {
    const { ctx, w, h } = fit(cv, { aspect: isPhone() ? 0.92 : 1.9, min: 330, max: 520 });
    if (w < 80) return;
    geo = layout(w, h);
    const S = SYS[st.sys];
    drawChamber(ctx, w, h, geo.hy);
    display(ctx, 12, 44, st.sys === 'soy' ? '25,5' : '27,0');
    // пробірки
    const n = geo.tubes.length;
    geo.tubes.forEach((tb, i) => {
      const s = tubeState(tb, st.day);
      tube(ctx, tb.x, tb.y, tb.w, tb.h, {
        medium: { level: 0.3, color: st.sys === 'soy' ? '#ECE3BF' : '#EEE7C6' }, plug: 'foil',
        contents: (c, inn) => drawCallus(c, inn.x + inn.w / 2, inn.surface + 1, s.W, inn.w, s, 11 + i * 7),
      });
      // штатив: планка поперек пробірок
      const fs = clamp(tb.w * 0.36, 9.5, 12.5);
      const lbl = tb.isX ? 'X' : concLabel(tb.c);
      if (i === st.sel) { ctx.save(); ctx.strokeStyle = '#F2C94C'; ctx.lineWidth = 2.5; roundRect(ctx, tb.x - 5, tb.y - 14, tb.w + 10, tb.h + 22, 10); ctx.stroke(); ctx.restore(); }
      tagSmall(ctx, tb.x + tb.w / 2, geo.hy + 18, lbl, { color: tb.isX ? '#F1E3FF' : '#FFFFFF', size: fs + 1, weight: 800, bg: tb.isX ? 'rgba(90,40,120,.85)' : 'rgba(20,40,28,.72)' });
      tagSmall(ctx, tb.x + tb.w / 2, geo.hy + 36, Math.round(s.W) + ' мг', { color: '#F4F7F2', size: fs, weight: 700 });
    });
    // рейка штатива
    const t0 = geo.tubes[0], tl = geo.tubes[n - 1];
    const ry = t0.y + t0.h * 0.3;
    ctx.save();
    const rg = ctx.createLinearGradient(0, ry, 0, ry + 12); rg.addColorStop(0, 'rgba(235,238,232,.9)'); rg.addColorStop(1, 'rgba(150,156,148,.9)');
    ctx.fillStyle = rg; roundRect(ctx, t0.x - 12, ry, tl.x + tl.w - t0.x + 24, 11, 3); ctx.fill();
    ctx.restore();
    tagSmall(ctx, 14, geo.hy + 54 > h - 4 ? h - 6 : geo.hy + 54, `C, мг/л · ${S.subs[st.sub].name}`, { align: 'left', color: '#EEF2EC', size: 11.5, weight: 700 });
    // лупа
    drawLoupe(ctx);
    hud.innerHTML = `<span>Доба ${Math.round(st.day)} / ${st.D}</span><span>${S.tempC} °C · темрява</span><span>${S.lr}</span>`;
  }

  function drawLoupe(ctx) {
    const L = geo.loupe, tb = geo.tubes[st.sel] || geo.tubes[0];
    const s = tubeState(tb, st.day);
    // лінія-зв'язок
    ctx.save();
    ctx.strokeStyle = 'rgba(255,240,190,.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(tb.x + tb.w / 2, tb.y + tb.h * 0.62); ctx.lineTo(L.cx - L.r * 0.7, L.cy + L.r * 0.7); ctx.stroke(); ctx.setLineDash([]);
    shadow(ctx, L.cx + 6, L.cy + L.r + 6, L.r * 0.9, L.r * 0.18, 0.35);
    ctx.beginPath(); ctx.arc(L.cx, L.cy, L.r, 0, TAU); ctx.save(); ctx.clip();
    // збільшений вигляд: агар, стінка пробірки, калюс
    const g = ctx.createLinearGradient(L.cx - L.r, 0, L.cx + L.r, 0);
    g.addColorStop(0, '#6E7268'); g.addColorStop(0.5, '#A9AA9E'); g.addColorStop(1, '#6A6D64');
    ctx.fillStyle = g; ctx.fillRect(L.cx - L.r, L.cy - L.r, 2 * L.r, 2 * L.r);
    const surf = L.cy + L.r * 0.38;
    const ag = ctx.createLinearGradient(0, surf, 0, L.cy + L.r); ag.addColorStop(0, '#F1E9C6'); ag.addColorStop(1, '#BFB58E');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.moveTo(L.cx - L.r, surf - 4); ctx.quadraticCurveTo(L.cx, surf + 5, L.cx + L.r, surf - 4); ctx.lineTo(L.cx + L.r, L.cy + L.r); ctx.lineTo(L.cx - L.r, L.cy + L.r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,245,.85)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(L.cx - L.r, surf - 4); ctx.quadraticCurveTo(L.cx, surf + 5, L.cx + L.r, surf - 4); ctx.stroke();
    const mag = (L.r * 1.7) / tb.w;
    drawCallus(ctx, L.cx, surf + 1, s.W, tb.w * 0.88, s, 11 + st.sel * 7, mag);
    // відблиск лінзи
    const lg = ctx.createRadialGradient(L.cx - L.r * 0.4, L.cy - L.r * 0.5, 2, L.cx - L.r * 0.2, L.cy - L.r * 0.3, L.r * 1.1);
    lg.addColorStop(0, 'rgba(255,255,255,.42)'); lg.addColorStop(0.3, 'rgba(255,255,255,.06)'); lg.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = lg; ctx.fillRect(L.cx - L.r, L.cy - L.r, 2 * L.r, 2 * L.r);
    ctx.restore();
    // оправа
    const rim = ctx.createLinearGradient(L.cx - L.r, L.cy - L.r, L.cx + L.r, L.cy + L.r);
    rim.addColorStop(0, '#E9ECE6'); rim.addColorStop(0.5, '#7B8079'); rim.addColorStop(1, '#2F3330');
    ctx.strokeStyle = rim; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(L.cx, L.cy, L.r + 2, 0, TAU); ctx.stroke();
    ctx.restore();
    const txt = tb.isX ? 'зразок X' : `${concLabel(tb.c)} мг/л`;
    tagSmall(ctx, L.cx, L.cy - L.r - 10 < 14 ? L.cy + L.r + 22 : L.cy - L.r - 10, `Лупа ×${fnum(mag / 1, 0)} · ${txt}`, { color: '#FFF7DA', size: 11.5, weight: 700, bg: 'rgba(20,30,24,.7)' });
    if (s.brown > 0.35) tagSmall(ctx, L.cx, L.cy + L.r - 12, 'побуріння', { color: '#FFE9D6', size: 10.5, bg: 'rgba(110,50,20,.8)' });
  }

  cv.addEventListener('click', (e) => {
    if (!geo) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    let best = -1, bd = 1e9;
    geo.tubes.forEach((tb, i) => { const d = Math.abs(tb.x + tb.w / 2 - x); if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd < 60) { st.sel = best; draw(); updateReads(); }
  });

  // ---- показники, графіки, вердикт
  function updateReads() {
    const S = SYS[st.sys], p = S.subs[st.sub];
    const list = geo ? geo.tubes : tubesList();
    const tEnd = st.D;
    const fin = list.map((tb) => tubeState(tb, tEnd));
    const now = list.map((tb) => tubeState(tb, st.day));
    const ctrlEnd = fin[0];
    let bi = 0; fin.forEach((s, i) => { if (!list[i].isX && s.W > fin[bi].W) bi = i; });
    const cOpt = optimum(st.sys, st.sub);
    const sel = list[st.sel] || list[0], sNow = now[st.sel] || now[0];
    const set = (k, v) => { const el = root.querySelector(`[data-out="${k}"]`); if (el) el.innerHTML = v; };
    set('day', `${Math.round(st.day)} / ${st.D}`);
    set('sel', `${sel.isX ? 'X' : concLabel(sel.c) + ' мг/л'}: ${Math.round(sNow.W)} мг`);
    set('dw', fnum(dW(sNow.W, st.W0), 2));
    set('ec', `${fnum(p.ec50, p.ec50 < 0.01 ? 3 : 2)} мг/л`);
    set('opt', `${fnum(cOpt, cOpt < 0.1 ? 3 : 2)} мг/л`);
    let xTxt = '—';
    const xi = list.findIndex((tb) => tb.isX);
    if (xi >= 0) {
      const target = dW(fin[xi].W, st.W0);
      const cx = invert(st.sys, st.sub, target, st.W0, tEnd);
      xTxt = isFinite(cx) ? `≈ ${fnum(cx, cx < 0.01 ? 4 : cx < 0.1 ? 3 : 2)} мг/л` : 'поза діапазоном';
      set('xeq', xTxt + ` <small style="display:inline;font:600 .72rem system-ui">екв. ${p.name}</small>`);
    } else set('xeq', '—');

    // P1: доза — відповідь
    const series = Object.entries(S.subs).map(([k, q]) => {
      const data = []; for (let e = -3; e <= 1.0001; e += 0.025) { const c = Math.pow(10, e); data.push([e, dW(massAt(st.sys, muOf(st.sys, k, c), st.W0, tEnd), st.W0)]); }
      return { data, color: q.col, width: k === st.sub ? 3.2 : 1.6, dash: k === st.sub ? null : [5, 4], label: q.name };
    });
    const pts = list.filter((tb) => !tb.isX && tb.c > 0).map((tb) => [Math.log10(tb.c), dW(tubeState(tb, st.day).W, st.W0)]);
    series.push({ data: pts, type: 'points', color: '#0E3B26', label: `Пробірки, доба ${Math.round(st.day)}`, r: 5 });
    const guides = [{ y: dW(ctrlEnd.W, st.W0), color: '#7A8A7E', label: 'контроль (0 мг/л)' }, { x: Math.log10(p.ec50), color: p.col, label: 'EC₅₀' }];
    if (xi >= 0) {
      const target = dW(fin[xi].W, st.W0); const cx = invert(st.sys, st.sub, target, st.W0, tEnd);
      guides.push({ y: target, color: '#7A3FA0', dash: [2, 3], label: 'X' });
      if (isFinite(cx)) guides.push({ x: Math.log10(cx), color: '#7A3FA0', dash: [2, 3], label: 'C(X)' });
    }
    p1.set(series, guides);

    // P2: динаміка W(t), щотижневі зважування (6 повторностей, коефіцієнт варіації ≈ 12 %, тема 3, с. 73)
    const n = list.length, s2 = [];
    list.forEach((tb, i) => {
      const col = colorFor(i, n - (st.X ? 1 : 0), tb.isX);
      const line = []; for (let t = 0; t <= st.D + 0.01; t += 0.5) line.push([t, tubeState(tb, t).W]);
      const R = rng(101 + i * 13 + (st.sys === 'soy' ? 0 : 50));
      const wk = [];
      for (let t = 0; t <= Math.min(st.day, st.D) + 1e-6; t += 7) { const W = tubeState(tb, t).W; const nz = 1 + 0.06 * (R() * 2 - 1); wk.push([t, W * nz, t === 0 ? 0 : W * 0.12]); }
      s2.push({ data: line, color: col, width: i === st.sel ? 3 : 1.8, label: tb.isX ? 'X' : `${concLabel(tb.c)} мг/л` });
      s2.push({ data: wk, type: 'points', color: col, errors: true, r: 4 });
    });
    p2.set(s2, st.day > 0 && st.day < st.D ? [{ x: st.day, color: '#B08A1E', label: 'зараз' }] : []);

    // вердикт
    const v = $('t9a-verdict');
    const ctrlTxt = st.sys === 'soy'
      ? 'На безгормональному контролі калюс сої майже не росте — тест-система залежить від цитокінінів (с. 128).'
      : 'Без ауксину калюс топінамбура не росте (лише набубнявіє) — тест-система залежить від ауксинів (с. 129).';
    const best = list[bi];
    let txt = `<b>${ctrlTxt}</b> На кінець досліду (${st.D} діб) найбільший приріст — у пробірці ${concLabel(best.c)} мг/л: ΔW = ${fnum(dW(fin[bi].W, st.W0), 1)}, тобто маса зросла в ${fnum(fin[bi].W / st.W0, 1)} раза. `;
    const over = list.some((tb) => !tb.isX && tb.c > cOpt * 1.5);
    if (over) txt += `Концентрації понад оптимум (≈ ${fnum(cOpt, cOpt < 0.1 ? 3 : 2)} мг/л) гальмують ріст — калюс дрібніший і буріє (супраоптимальна дія). `;
    if (xi >= 0) txt += `Зразок X дає такий самий приріст, як ${p.name} у концентрації ${xTxt.replace('≈ ', '≈ ')} — це і є його «${p.name}-еквівалент» за калібрувальною кривою.`;
    v.innerHTML = txt;
    v.className = 'ag-verdict' + (over ? ' is-warn' : '');
  }

  function refresh() { draw(); updateReads(); }

  const runner = new Runner({
    btn: $('t9a-run'), reset: $('t9a-reset'), status: $('t9a-status'),
    step: (dt, t, reset) => {
      if (reset) { st.day = 0; updateReads(); return; }
      st.day = Math.min(st.D, st.day + dt * st.D / 9);
      if (Math.floor(st.day / 7) !== Math.floor((st.day - dt * st.D / 9) / 7) || st.day >= st.D) updateReads();
      $('t9a-status').textContent = `Культивування… доба ${Math.round(st.day)}`;
      if (st.day >= st.D) { $('t9a-status').textContent = `Дослід завершено: ${st.D} діб, облік зроблено.`; runner.finish(); updateReads(); }
    },
    draw,
  });
  const origPlay = runner.play.bind(runner);
  runner.play = () => { if (st.day >= st.D) st.day = 0; origPlay(); };
  onResize(cv.parentElement, refresh);
  window.addEventListener('t9tab', () => { if (!root.closest('[hidden]')) refresh(); });
  refresh();
}

/* =====================================================================
   Б. МІКРОЖИВЦІ НА СЕРЕДОВИЩАХ З ІОК, КІНЕТИНОМ І ГК (ЛР 37)
   ---------------------------------------------------------------------
   Табл. 11 (с. 131): варіанти № 1–4 — контроль і ІОК, № 5–7 — кінетин, № 8–10 — гіберелова кислота;
   концентрації 0,1; 0,5; 1,0 мг/л. Умови: +25–26 °C, фотоперіод 14 год, 1000 лк, облік що 7 діб, кінець — 35–40 доба.
   Показники (ЛР 34, с. 127): індекс росту I = L/L0 (L0 — довжина експлантата), кількість і довжина міжвузлів,
   коефіцієнт розмноження K (кількість мікроживців, що їх можна нарізати з одного експлантата — тут: кількість вузлів).
   Ефект гормону E(C) = C/(C + K½) — насичення (навчальне наближення). Якісні напрями — за посібником (с. 127):
   ауксини — корені, цитокініни — пазушні бруньки (кущіння), гібереліни — розтягнення міжвузлів.
   ===================================================================== */
const SPECIES = {
  potato: { name: 'Картопля', lat: 'Solanum tuberosum', nodes: 7, intl: 5.5, roots: 5, rootLen: 32, ax: 0.3, kinAx: 4, leaf: 'potato' },
  stevia: { name: 'Стевія', lat: 'Stevia rebaudiana', nodes: 5, intl: 6.5, roots: 3, rootLen: 26, ax: 0.5, kinAx: 3, leaf: 'stevia' },
  carn: { name: 'Гвоздика', lat: 'Dianthus caryophyllus', nodes: 6, intl: 4, roots: 1.5, rootLen: 18, ax: 0.4, kinAx: 5, leaf: 'carn' },
};
const HORM = {
  iaa: { name: 'ІОК', full: 'ІОК (ауксин)', k: 0.3, col: '#2A6A93', vars: '№ 1–4' },
  kin: { name: 'Кінетин', full: 'кінетин (цитокінін)', k: 0.25, col: '#C47A12', vars: '№ 5–7' },
  ga: { name: 'ГК', full: 'гіберелова кислота (ГК₃)', k: 0.2, col: '#2C7A4D', vars: '№ 8–10' },
};
const L0 = 10; // мм, довжина одновузлового мікроживця
const sig = (x) => 1 / (1 + Math.exp(-x));

function cutting(sp, h, C, t) {
  const S = SPECIES[sp];
  const E = C > 0 ? C / (C + HORM[h].k) : 0;
  const Ei = h === 'iaa' ? E : 0, Ek = h === 'kin' ? E : 0, Eg = h === 'ga' ? E : 0;
  const nodesMax = S.nodes * (1 - 0.12 * Ek + 0.1 * Eg);
  const intl = S.intl * (1 + 0.15 * Ei - 0.5 * Ek + 2.1 * Eg);
  const nodes = nodesMax * sig((t - 17) / 5.5) - nodesMax * sig(-17 / 5.5); // починається з 0 нових вузлів
  const L = L0 + nodes * intl;
  const rootsMax = Math.max(0, S.roots * (1 + 2.6 * Ei) * (1 - 0.85 * Ek) * (1 - 0.3 * Eg));
  const tr = 10 - 4.5 * Ei + 6 * Ek;
  const roots = rootsMax * sig((t - tr) / 2.5);
  const rootLen = S.rootLen * (1 + 0.25 * Ei - 0.45 * Ei * Ei) * (1 - 0.4 * Ek) * clamp((t - tr + 4) / 26, 0, 1.15);
  const axMax = S.ax + S.kinAx * Ek - 0.25 * Ei;
  const ax = Math.max(0, axMax) * sig((t - 16) / 4);
  const axNodes = ax * nodesMax * 0.45 * sig((t - 22) / 5);
  const callusB = (0.9 * Ei * Ei + 0.4 * Ek) * smooth(5, 25, t);
  const pale = 0.55 * Eg;
  const leafK = 1 - 0.35 * Eg + 0.12 * Ek;
  const K = 1 + Math.floor(nodes + 1e-9) + Math.floor(axNodes + 1e-9); // мікроживці: кожен вузол → живець
  return { age: clamp(t / 40, 0, 1), E, nodes, intl, L, I: L / L0, roots, rootLen, ax, axNodes, callusB, pale, leafK, K };
}

function initB() {
  const root = $('t9b');
  if (!root) return;
  const cv = $('t9b-cv'), hud = $('t9b-hud');
  const st = { sp: 'potato', h: 'ga', D: 40, day: 0, sel: 2, metric: 'I' };
  const concs = [0, 0.1, 0.5, 1.0];

  segmented($('t9b-sp'), 't9b-sp', Object.entries(SPECIES).map(([k, s]) => ({ value: k, label: s.name })), st.sp, (v) => { st.sp = v; refresh(); });
  segmented($('t9b-h'), 't9b-h', Object.entries(HORM).map(([k, s]) => ({ value: k, label: s.name })), st.h, (v) => { st.h = v; refresh(); });
  const sl = sliders($('t9b-sl'), [{ id: 'D', label: 'Кінець досліду', min: 35, max: 40, step: 1, value: st.D, unit: 'доба', hint: 'За посібником — 35–40 доба' }], () => { st.D = sl.values.D; if (st.day > st.D) st.day = st.D; refresh(); });
  segmented($('t9b-metric'), 't9b-metric', [{ value: 'I', label: 'Індекс I' }, { value: 'K', label: 'Коеф. K' }, { value: 'R', label: 'Корені' }], st.metric, (v) => { st.metric = v; updateReads(); });

  const p1 = new Plot($('t9b-p1'), { xLabel: 'Час, доби', yLabel: 'Довжина пагона L, мм', xShort: 'доба', aspect: 1.55 });
  const p2 = new Plot($('t9b-p2'), { xLabel: 'Концентрація регулятора, мг/л', yLabel: 'Показник', xShort: 'C', x: [0, 1], aspect: 1.55 });

  let geo = null;
  // ---- малювання мікроживця
  const LEAF = { potato: '#3F8F33', stevia: '#4E9A3A', carn: '#6F9C86' };
  function drawLeafSp(ctx, kind, x, y, len, ang, pale, seed) {
    const color = rgba(mix(hex(LEAF[kind]), hex('#C9D98A'), pale)).replace(/rgba\((\d+),(\d+),(\d+),1\)/, (m, r, g, b) => '#' + [r, g, b].map((v) => (+v).toString(16).padStart(2, '0')).join(''));
    if (kind === 'carn') { leaf(ctx, x, y, len * 1.25, ang, { color, width: 0.13, curl: 0.05, veins: false }); return; }
    if (kind === 'stevia') { leaf(ctx, x, y, len, ang, { color, width: 0.34, curl: 0.12 }); return; }
    // картопля: черешок + непарноперисте листя з 3 часточок
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = rgba(shade(hex(color), -0.25)); ctx.lineWidth = Math.max(0.8, len * 0.05);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.45, 0); ctx.stroke();
    leaf(ctx, len * 0.42, 0, len * 0.6, 0, { color, width: 0.5, curl: 0.1 });
    if (len > 9) { leaf(ctx, len * 0.3, 0, len * 0.34, -0.9, { color, width: 0.5, veins: false }); leaf(ctx, len * 0.3, 0, len * 0.34, 0.9, { color, width: 0.5, veins: false }); }
    ctx.restore();
  }
  function drawCutting(ctx, x, baseY, pxmm, m, sp, seed, inner) {
    const R = rng(seed);
    const kind = SPECIES[sp].leaf;
    // корені в агарі (напівпрозорі)
    const nR = Math.round(m.roots);
    for (let i = 0; i < nR; i++) {
      const frac = clamp(m.roots - i, 0, 1);
      let px = x + (R() - 0.5) * 4, py = baseY + 2, a = Math.PI / 2 + (R() - 0.5) * 1.5;
      const Lr = m.rootLen * pxmm * (0.6 + R() * 0.6) * frac, seg = 10;
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(246,240,222,.95)'; ctx.lineWidth = Math.max(1.3, pxmm * 0.9);
      ctx.beginPath(); ctx.moveTo(px, py);
      const pts = [];
      for (let s = 0; s < seg; s++) { a += (R() - 0.5) * 0.45; px += Math.cos(a) * Lr / seg; py += Math.sin(a) * Lr / seg; py = Math.min(py, inner.y + inner.h - 3); ctx.lineTo(px, py); pts.push([px, py, a]); }
      ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth *= 0.35; ctx.stroke();
      ctx.strokeStyle = 'rgba(250,246,232,.55)'; ctx.lineWidth = 0.6;
      for (const [qx, qy, qa] of pts.slice(2)) { if (R() < 0.45) { const b = qa + (R() > 0.5 ? 1 : -1) * (0.6 + R() * 0.6), l = Lr * 0.12 * R(); ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + Math.cos(b) * l, qy + Math.sin(b) * l); ctx.stroke(); } }
      ctx.restore();
    }
    // базальний калюс
    if (m.callusB > 0.05) callus(ctx, x, baseY + 3, 6 + m.callusB * 14, { color: '#E7E0B8', friable: 0.5, seed: seed + 3, green: 0.2 });
    // вихідний експлантат (одновузловий живець, частково в агарі)
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#7C8A47'; ctx.lineWidth = Math.max(2.2, pxmm * 1.4);
    ctx.beginPath(); ctx.moveTo(x, baseY + 5); ctx.lineTo(x, baseY - L0 * pxmm * 0.55); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth *= 0.35; ctx.stroke();
    ctx.restore();
    // листок вузла експлантата (старіє: жовтіє з часом)
    drawLeafSp(ctx, kind, x, baseY - L0 * pxmm * 0.4, 11 * pxmm * m.leafK, Math.PI + 0.5, clamp(0.25 + m.age * 0.6, 0, 0.9), seed + 7);
    ctx.fillStyle = '#56813A'; ctx.beginPath(); ctx.arc(x, baseY - L0 * pxmm * 0.4, Math.max(1.6, pxmm * 1.1), 0, TAU); ctx.fill();
    const stemTop = (startX, startY, nNodes, intl, ang0, scale, pale, s2, axis) => {
      const R2 = rng(s2);
      let px = startX, py = startY, a = ang0;
      const nodesI = Math.floor(nNodes), part = nNodes - nodesI;
      const pts = [[px, py]];
      for (let i = 0; i < nodesI + (part > 0.02 ? 1 : 0); i++) {
        const l = intl * pxmm * (i === nodesI ? part : 1) * (0.85 + R2() * 0.3);
        a += (R2() - 0.5) * 0.18 + (axis ? 0 : (a < -Math.PI / 2 ? 0.03 : -0.03));
        px += Math.cos(a) * l; py += Math.sin(a) * l;
        if (py < inner.y + 8) { py = inner.y + 8; a = a < -Math.PI / 2 ? Math.PI : 0; } // упирається в кришку — стелиться
        px = clamp(px, inner.x + 4, inner.x + inner.w - 4);
        pts.push([px, py]);
      }
      const stemC = rgba(mix(hex('#5E9A3A'), hex('#C8D48A'), pale * 0.8));
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = stemC; ctx.lineWidth = Math.max(1.6, pxmm * 1.25 * scale);
      ctx.beginPath(); pts.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth *= 0.35; ctx.stroke();
      ctx.restore();
      const opp = kind !== 'potato';
      for (let i = 1; i < pts.length; i++) {
        const [X, Y] = pts[i];
        const grow = i === pts.length - 1 && part > 0.02 ? part : 1;
        const len = (kind === 'carn' ? 15 : 16) * pxmm * scale * m.leafK * (0.55 + 0.45 * Math.min(1, i / 2.5)) * grow;
        const side = i % 2 ? 1 : -1;
        drawLeafSp(ctx, kind, X, Y, len, side > 0 ? -0.55 : Math.PI + 0.55, pale, s2 + i);
        if (opp) drawLeafSp(ctx, kind, X, Y, len * 0.95, side > 0 ? Math.PI + 0.6 : -0.6, pale, s2 + i + 50);
        if (kind === 'carn') { ctx.fillStyle = '#5E8A70'; ctx.beginPath(); ctx.ellipse(X, Y, pxmm * 0.9, pxmm * 0.6, 0, 0, TAU); ctx.fill(); }
      }
      const [tx, ty] = pts[pts.length - 1];
      drawLeafSp(ctx, kind, tx, ty, 5 * pxmm * scale, -Math.PI / 2 - 0.4, pale, s2 + 99);
      return pts;
    };
    const pts = stemTop(x, baseY - L0 * pxmm * 0.55, m.nodes, m.intl, -Math.PI / 2 + (R() - 0.5) * 0.15, 1, m.pale, seed + 11, false);
    // пазушні пагони (кущіння під дією цитокініну)
    const nAx = Math.ceil(m.ax - 0.15);
    for (let i = 0; i < nAx; i++) {
      const frac = clamp(m.ax - i, 0, 1);
      const side = i % 2 ? 1 : -1;
      const bx = x + side * 1.5, by = baseY - L0 * pxmm * (0.2 + 0.12 * (i % 3));
      const nn = Math.max(0.3, (m.axNodes / Math.max(1, m.ax)) * frac + 0.6 * frac);
      stemTop(bx, by, nn, m.intl * 0.85, -Math.PI / 2 + side * (0.55 + 0.18 * i), 0.8, m.pale, seed + 40 + i * 5, true);
    }
    return pts;
  }

  function drawRoom(ctx, w, h, hy, lightOn) {
    scene(ctx, w, h, { kind: 'room', horizon: hy / h, light: 0.45 });
    if (!lightOn) { ctx.fillStyle = 'rgba(8,16,38,.55)'; ctx.fillRect(0, 0, w, h); }
    // лампа над стелажем (смуга світла)
    const ly = Math.max(6, h * 0.03);
    ctx.save();
    const g = ctx.createLinearGradient(0, ly, 0, ly + 12);
    g.addColorStop(0, lightOn ? '#FFFFFF' : '#5B6470'); g.addColorStop(1, lightOn ? '#DDEBFF' : '#3B4350');
    ctx.fillStyle = g; roundRect(ctx, w * 0.06, ly, w * 0.88, 10, 5); ctx.fill();
    if (lightOn) { const c = ctx.createLinearGradient(0, ly, 0, hy); c.addColorStop(0, 'rgba(235,245,255,.45)'); c.addColorStop(1, 'rgba(235,245,255,0)'); ctx.fillStyle = c; ctx.fillRect(w * 0.04, ly + 10, w * 0.92, hy - ly); }
    ctx.restore();
  }

  function jarGlass(ctx, x, y, w, h) {
    // культуральна банка: товсте скло, кришка (як на рис. 23 посібника)
    shadow(ctx, x + w / 2 + w * 0.08, y + h + 1, w * 0.62, w * 0.1, 0.32);
    ctx.save(); roundRect(ctx, x, y + h * 0.07, w, h * 0.93, Math.min(14, w * 0.14)); ctx.fillStyle = 'rgba(225,240,235,.22)'; ctx.fill(); ctx.restore();
  }
  function jarFront(ctx, x, y, w, h) {
    ctx.save();
    roundRect(ctx, x, y + h * 0.07, w, h * 0.93, Math.min(14, w * 0.14)); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(40,70,60,.28)'); g.addColorStop(0.08, 'rgba(255,255,255,.05)'); g.addColorStop(0.16, 'rgba(255,255,255,.55)'); g.addColorStop(0.24, 'rgba(255,255,255,.06)');
    g.addColorStop(0.78, 'rgba(255,255,255,0)'); g.addColorStop(0.88, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(40,70,60,.32)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.save(); roundRect(ctx, x, y + h * 0.07, w, h * 0.93, Math.min(14, w * 0.14)); ctx.strokeStyle = 'rgba(70,100,90,.55)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
    // горловина й кришка
    const lg = ctx.createLinearGradient(x, 0, x + w, 0);
    lg.addColorStop(0, '#0F3A22'); lg.addColorStop(0.25, '#3E9A62'); lg.addColorStop(0.5, '#1F6E43'); lg.addColorStop(1, '#0B2A18');
    ctx.fillStyle = lg; roundRect(ctx, x - 3, y - h * 0.035, w + 6, h * 0.085, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x, y - h * 0.03, w, 2);
    // конденсат на склі під кришкою
    const R = rng(Math.round(x) + 5);
    for (let i = 0; i < 46; i++) {
      const dx = x + 4 + R() * (w - 8), dy = y + h * 0.08 + Math.pow(R(), 2.2) * h * 0.32, r = 0.6 + R() * 1.7;
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(dx, dy, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(60,90,80,.18)'; ctx.beginPath(); ctx.arc(dx + r * 0.25, dy + r * 0.3, r * 0.6, 0, TAU); ctx.fill();
    }
  }

  function draw() {
    const { ctx, w, h } = fit(cv, { aspect: isPhone() ? 0.8 : 1.45, min: 360, max: 560 });
    if (w < 80) return;
    const hourOfDay = (st.day % 1) * 24;
    const lightOn = st.day === 0 || hourOfDay < 14 || !runner.running;
    const hy = Math.round(h * 0.84);
    drawRoom(ctx, w, h, hy, lightOn);
    const n = concs.length, pad = 14;
    const slot = (w - 2 * pad) / n;
    const jw = Math.min(slot * 0.84, 160), jh = Math.min(hy - 34, jw * 2.1, h * 0.8);
    const jy = hy - jh;
    geo = { jars: [] };
    concs.forEach((c, i) => {
      const jx = pad + slot * (i + 0.5) - jw / 2;
      geo.jars.push({ x: jx, w: jw });
      jarGlass(ctx, jx, jy, jw, jh);
      const inner = { x: jx + 3, y: jy + jh * 0.09, w: jw - 6, h: jh * 0.9 };
      const surf = jy + jh * 0.78;
      ctx.save(); roundRect(ctx, jx, jy + jh * 0.07, jw, jh * 0.93, Math.min(14, jw * 0.14)); ctx.clip();
      // агар
      const ag = ctx.createLinearGradient(jx, 0, jx + jw, 0);
      ag.addColorStop(0, 'rgba(196,186,140,.9)'); ag.addColorStop(0.3, 'rgba(244,238,210,.85)'); ag.addColorStop(1, 'rgba(190,180,135,.9)');
      ctx.fillStyle = ag; ctx.fillRect(jx, surf, jw, jy + jh - surf);
      ctx.strokeStyle = 'rgba(255,255,245,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(jx + jw / 2, surf, jw / 2 - 1, Math.max(2, jw * 0.06), 0, Math.PI, TAU); ctx.stroke();
      const m = cutting(st.sp, st.h, c, st.day);
      const pxmm = (surf - inner.y - 6) / 108;
      drawCutting(ctx, jx + jw / 2, surf, pxmm, m, st.sp, 7 + i * 31, inner);
      ctx.restore();
      jarFront(ctx, jx, jy, jw, jh);
      if (i === st.sel) { ctx.save(); ctx.strokeStyle = '#E2B93B'; ctx.lineWidth = 2.5; roundRect(ctx, jx - 6, jy - jh * 0.06, jw + 12, jh + jh * 0.06 + 8, 12); ctx.stroke(); ctx.restore(); }
      const fs = w < 420 ? 11 : 12.5;
      tagSmall(ctx, jx + jw / 2, hy + 18, c === 0 ? 'Контроль' : `${concLabel(c)} мг/л`, { size: fs, weight: 800, color: '#173322', bg: 'rgba(255,255,255,.88)' });
      tagSmall(ctx, jx + jw / 2, Math.min(h - 6, hy + 36), `L = ${Math.round(m.L)} мм`, { size: fs - 1, weight: 700, color: lightOn ? '#22382A' : '#E6EEF8' });
    });
    hud.innerHTML = `<span>Доба ${Math.floor(st.day)} / ${st.D}</span><span>${lightOn ? '☀ світло' : '☾ темрява'} · 14 год</span><span>1000 лк · 25 °C</span>`;
  }

  cv.addEventListener('click', (e) => {
    if (!geo) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    geo.jars.forEach((j, i) => { if (x >= j.x - 8 && x <= j.x + j.w + 8) { st.sel = i; draw(); updateReads(); } });
  });

  function metricOf(m) { return st.metric === 'I' ? m.I : st.metric === 'K' ? m.K : m.roots; }
  function updateReads() {
    const c = concs[st.sel];
    const m = cutting(st.sp, st.h, c, st.day), mEnd = cutting(st.sp, st.h, c, st.D);
    const set = (k, v) => { const el = root.querySelector(`[data-out="${k}"]`); if (el) el.innerHTML = v; };
    set('var', c === 0 ? 'контроль' : `${HORM[st.h].name} ${concLabel(c)} мг/л`);
    set('I', fnum(m.I, 2));
    set('nodes', `${Math.floor(m.nodes + 1e-9)} · ${fnum(m.intl, 1)} мм`);
    set('K', String(m.K));
    set('roots', `${Math.round(m.roots)} · ${Math.round(Math.max(0, m.rootLen))} мм`);
    set('ax', String(Math.round(m.ax)));

    const days = []; for (let t = 0; t <= st.D + 0.01; t += 0.5) days.push(t);
    const cols = ['#8FA392', '#7FB1D6', '#2F86C2', '#14507E'].map((cc, i) => (st.h === 'iaa' ? cc : st.h === 'kin' ? ['#A9A08E', '#E6B66A', '#C47A12', '#7D4A06'][i] : ['#9AA79B', '#86C79A', '#2C9A5A', '#145C33'][i]));
    const s1 = [];
    concs.forEach((cc, i) => {
      s1.push({ data: days.map((t) => [t, cutting(st.sp, st.h, cc, t).L]), color: cols[i], width: i === st.sel ? 3.2 : 1.8, label: cc === 0 ? 'контроль' : `${concLabel(cc)} мг/л` });
      const wk = []; for (let t = 0; t <= Math.min(st.day, st.D) + 1e-6; t += 7) wk.push([t, cutting(st.sp, st.h, cc, t).L]);
      s1.push({ data: wk, type: 'points', color: cols[i], r: 4 });
    });
    p1.set(s1, st.day > 0 && st.day < st.D ? [{ x: st.day, color: '#B08A1E', label: 'зараз' }] : []);

    const ylab = { I: 'Індекс росту I = L/L₀', K: 'Коефіцієнт розмноження K', R: 'Кількість коренів, шт.' }[st.metric];
    p2.setOptions({ yLabel: ylab });
    const s2 = Object.entries(HORM).map(([k, hh]) => {
      const data = []; for (let cc = 0; cc <= 1.0001; cc += 0.02) data.push([cc, metricOf(cutting(st.sp, k, cc, st.D))]);
      return { data, color: hh.col, width: k === st.h ? 3.2 : 1.7, dash: k === st.h ? null : [5, 4], label: hh.name };
    });
    s2.push({ data: concs.map((cc) => [cc, metricOf(cutting(st.sp, st.h, cc, st.D))]), type: 'points', color: HORM[st.h].col, r: 5, label: `${HORM[st.h].vars}, ${st.D} доба` });
    p2.set(s2);

    const ctl = cutting(st.sp, st.h, 0, st.D);
    const v = $('t9b-verdict');
    const S = SPECIES[st.sp];
    let txt;
    if (c === 0) txt = `<b>Контроль (МС без гормонів):</b> мікроживець <i>${S.lat}</i> росте за рахунок власних гормонів — до ${st.D}-ї доби I ≈ ${fnum(ctl.I, 1)}, K = ${ctl.K}. Порівняйте з пробірками, де є регулятор.`;
    else if (st.h === 'iaa') txt = `<b>ІОК ${concLabel(c)} мг/л:</b> ауксин прискорює закладання коренів (≈ ${Math.round(mEnd.roots)} проти ${Math.round(ctl.roots)} у контролі) — корені з'являються раніше. ${mEnd.callusB > 0.3 ? 'При високій дозі біля основи утворюється калюс, а корені коротшають.' : ''} Цей варіант — для етапу укорінення.`;
    else if (st.h === 'kin') txt = `<b>Кінетин ${concLabel(c)} мг/л:</b> цитокінін знімає апікальне домінування (пригнічення пазушних бруньок верхівкою) — розвивається ${Math.round(mEnd.ax)} пазушних пагонів, K = ${mEnd.K} проти ${ctl.K} у контролі. Міжвузля коротші, коренів майже немає — живці потім переносять на середовище для укорінення.`;
    else txt = `<b>ГК ${concLabel(c)} мг/л:</b> гіберелін розтягує міжвузля (${fnum(mEnd.intl, 1)} мм проти ${fnum(ctl.intl, 1)} мм) — пагін витягується (I ≈ ${fnum(mEnd.I, 1)}), листки дрібніші й блідіші, як на рис. 23 посібника. Довгі міжвузля зручно нарізати на мікроживці.`;
    v.innerHTML = txt;
  }
  function refresh() { draw(); updateReads(); }
  const runner = new Runner({
    btn: $('t9b-run'), reset: $('t9b-reset'), status: $('t9b-status'),
    step: (dt, t, reset) => {
      if (reset) { st.day = 0; updateReads(); return; }
      const prev = st.day;
      st.day = Math.min(st.D, st.day + dt * st.D / 12);
      if (Math.floor(st.day) !== Math.floor(prev)) updateReads();
      $('t9b-status').textContent = `Культивування… доба ${Math.floor(st.day)}`;
      if (st.day >= st.D) { $('t9b-status').textContent = `${st.D}-та доба: підраховано коефіцієнт розмноження.`; runner.finish(); updateReads(); }
    },
    draw,
  });
  const origPlay = runner.play.bind(runner);
  runner.play = () => { if (st.day >= st.D) st.day = 0; origPlay(); };
  onResize(cv.parentElement, refresh);
  window.addEventListener('t9tab', () => { if (!root.closest('[hidden]')) refresh(); });
  refresh();
}

const tabRoot = $('t9-tabs');
if (tabRoot) tabs(tabRoot);
initA();
initB();
