// Тема 6. Клітинна селекція (ЛР 23): А — висів суспензії тютюну на середовище зі стрептоміцином і відбір зелених
// (стійких) колоній; Б — сублетальна концентрація селективного агента та перевірка стабільності стійкості по пасажах.
// Математика — t06-model.js; близький план колонії використовує текстуру калюсу з t04-draw.js.
import {
  TAU, clamp, lerp, smooth, easeInOut, rng, fnum, hex, rgba, mix, shade, fit, offscreen, scene, petri, callus, shadow, tagSmall,
  roundRect, MAT, Runner, onResize, Plot, sample, sliders, segmented, setOut, $,
} from './kit.js';
import { callusTexture } from './t04-draw.js';
import { A, plating, diam, lightK, poisson, B, surv, growth, isSublethal, schedule, stepClone, expected } from './t06-model.js';

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const sci = (v, d = 1) => { if (v === 0) return '0'; const e = Math.floor(Math.log10(v)), m = v / 10 ** e; return `${fnum(m, d)}·10${[...String(e)].map((c) => SUP[c]).join('')}`; };
const DAYS = 42;

/* ---------- спрайти колоній (кеш) ---------- */
const spriteCache = new Map();
function colonySprite(kind) {
  if (spriteCache.has(kind)) return spriteCache.get(kind);
  const S = 64, c = offscreen(S, S), x = c.getContext('2d'), R = rng(kind === 'g' ? 3 : 5);
  const base = kind === 'g' ? [92, 160, 62] : [242, 234, 206];
  // кілька горбків — «вузлувата» колонія калюсу
  const bumps = [[32, 34, 22]]; for (let i = 0; i < 6; i++) { const a = R() * TAU, d = 6 + R() * 8; bumps.push([32 + Math.cos(a) * d, 34 + Math.sin(a) * d * 0.8, 8 + R() * 6]); }
  x.fillStyle = 'rgba(30,25,10,.25)'; x.beginPath(); x.ellipse(35, 38, 25, 21, 0, 0, TAU); x.fill();
  for (const [bx, by, r] of bumps) {
    const g = x.createRadialGradient(bx - r * 0.4, by - r * 0.45, r * 0.08, bx, by, r);
    g.addColorStop(0, rgba(shade(base, 0.45))); g.addColorStop(0.5, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.35)));
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, r, 0, TAU); x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(24, 24, 6, 3.5, -0.6, 0, TAU); x.fill();
  spriteCache.set(kind, c);
  return c;
}

/* ================= А. Висів і відбір ================= */
function initA() {
  const cv = $('t6a-scene'); if (!cv) return null;
  const S = { n: 5e4, f: 1e-4, C: 0.5, k: 12, day: 42, seed: 23, sel: -1 };
  let O = plating(S), plates = [], big = null, hits = [];
  const sl = sliders($('t6a-ctrl'), [
    { id: 't6a-n', label: 'Густина суспензії', min: 1e3, max: 2e5, value: S.n, log: true, unit: 'клітин/мл', format: (v) => sci(v), hint: 'Підраховують у камері Фукса — Розенталя (тема 3). Висівають 1 мл на чашку.' },
    { id: 't6a-f', label: 'Частота стійких клітин f', min: 1e-7, max: 1e-3, value: S.f, log: true, unit: '', format: (v) => sci(v), hint: 'Спонтанно ~10⁻⁶ і менше; після обробки мутагеном — до 10⁻⁴ (порядок величини — припущення моделі).' },
    { id: 't6a-c', label: 'Стрептоміцин', min: 0, max: 2, step: 0.05, value: S.C, unit: 'мг/мл', digits: 2, hint: 'За посібником 0,5 мг/мл.' },
    { id: 't6a-k', label: 'Чашок у серії', min: 1, max: 20, step: 1, value: S.k, unit: 'шт.' },
    { id: 't6a-day', label: 'Доба після висіву', min: 0, max: DAYS, step: 1, value: S.day, unit: 'доба' },
  ], (id) => {
    const v = sl.values; S.n = v['t6a-n']; S.f = v['t6a-f']; S.C = v['t6a-c']; S.k = v['t6a-k']; S.day = v['t6a-day'];
    if (id !== 't6a-day') { S.sel = -1; build(); document.querySelectorAll('#t6a-presets [data-preset]').forEach((x) => x.setAttribute('aria-pressed', 'false')); }
    update(id === 't6a-day');
  });
  const PRE = { book: { n: 5e4, f: 1e-4, C: 0.5 }, ctrl: { n: 5e4, f: 1e-4, C: 0 }, spont: { n: 5e4, f: 1e-6, C: 0.5 }, dense: { n: 2e5, f: 1e-4, C: 0.5 } };
  document.querySelectorAll('#t6a-presets [data-preset]').forEach((b) => b.addEventListener('click', () => {
    const p = PRE[b.dataset.preset];
    sl.set('t6a-n', p.n, true); sl.set('t6a-f', p.f, true); sl.set('t6a-c', p.C, true);
    S.n = sl.values['t6a-n']; S.f = sl.values['t6a-f']; S.C = sl.values['t6a-c']; S.sel = -1;
    document.querySelectorAll('#t6a-presets [data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    build(); update();
  }));
  $('t6a-new').addEventListener('click', () => { S.seed = (S.seed * 48271) % 2147483647; S.sel = -1; build(); update(); });

  const p1 = new Plot($('t6a-p1'), { xLabel: 'стрептоміцин, мг/мл', yLabel: 'відносна величина, %', x: [0, 2], y: [0, 100], xShort: 'C', aspect: 1.7 });
  const p2 = new Plot($('t6a-p2'), { xLabel: 'кількість чашок у серії', yLabel: 'P(≥ 1 стійкої колонії), %', x: [1, 40], y: [0, 100], xShort: 'чашок', aspect: 1.7 });

  /** Генерує серію чашок: кількість колоній і стійких на кожній (Пуассон), розкладку великої чашки. */
  function build() {
    O = plating(S);
    const R = rng(S.seed);
    plates = [];
    for (let j = 0; j < S.k; j++) plates.push({ N: poisson(O.N, R), r: poisson(O.lam, R) });
    if (S.sel < 0 || S.sel >= S.k) { S.sel = 0; plates.forEach((p, j) => { if (p.r > plates[S.sel].r) S.sel = j; }); }
    const P = plates[S.sel], Rb = rng(S.seed * 7 + S.sel * 131 + 1);
    const nDraw = Math.min(P.N, 2600), cols = [];
    for (let i = 0; i < nDraw; i++) { const a = Rb() * TAU, d = Math.sqrt(Rb()) * 0.94; cols.push({ u: Math.cos(a) * d, v: Math.sin(a) * d, s: Math.exp((Rb() - 0.5) * 0.7), R: 0, rot: Rb() * TAU }); }
    for (let i = 0; i < P.r; i++) { const a = Rb() * TAU, d = Math.sqrt(Rb()) * 0.85; cols.push({ u: Math.cos(a) * d, v: Math.sin(a) * d, s: 1.15 + Rb() * 0.3, R: Rb() < A.chim ? 2 : 1, rot: Rb() * TAU }); }
    cols.sort((a, b) => (a.R ? 1 : 0) - (b.R ? 1 : 0) || a.v - b.v); // стійкі — поверх сусідів
    big = { cols, scale: P.N > nDraw ? P.N / nDraw : 1 };
  }

  const runner = new Runner({
    btn: $('t6a-run'), reset: $('t6a-reset'), status: $('t6a-status'),
    step: (dt, t, reset) => {
      if (reset) { S.day = 0; sl.set('t6a-day', 0, true); update(true); return; }
      S.day = Math.min(DAYS, S.day + dt * 3.2); if (S.day >= DAYS) runner.finish();
      sl.set('t6a-day', Math.round(S.day), true);
      if (Math.floor(S.day) !== last) { last = Math.floor(S.day); reads(); }
    },
    draw: () => draw(),
  });
  let last = -1;
  const origPlay = runner.play.bind(runner);
  runner.play = () => { if (!runner.started || S.day >= DAYS - 0.5) { S.day = 0; sl.set('t6a-day', 0, true); } origPlay(); };

  function colonyColor(c, t) {
    const L = lightK(t);
    if (c.R === 0) return L * O.Gs;           // чутлива: на світлі зеленіє лише без антибіотика
    return L * O.Gr;                         // стійка
  }
  function draw() {
    const W = cv.parentElement.clientWidth; if (!W) return;
    const wide = W >= 700;
    const { ctx, w, h } = fit(cv, { aspect: wide ? 2.05 : 0.8, min: 330, max: 560 });
    const dark = S.day <= A.dark;
    const hy = scene(ctx, w, h, { kind: dark ? 'dark' : 'room', horizon: wide ? 0.3 : 0.2, light: 0.35 });
    if (dark) { // термостат: тепле тьмяне світло на полиці
      const g = ctx.createRadialGradient(w * 0.35, h * 0.55, 10, w * 0.35, h * 0.55, w * 0.6); g.addColorStop(0, 'rgba(255,190,120,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    // велика чашка
    const r = wide ? Math.min(w * 0.235, h * 0.6) : Math.min(w * 0.44, h * 0.34);
    const cx = wide ? w * 0.27 : w * 0.5, cy = wide ? h * 0.53 : h * 0.38, tilt = 0.56;
    const d = diam(S.day, O.Gg), pxmm = r / 45;      // чашка 90 мм
    let hot = null;
    petri(ctx, cx, cy, r, {
      tilt, medium: { color: '#EFE8C8' }, depth: 0.1,
      contents: (c, P) => {
        const sw = colonySprite('w'), sg = colonySprite('g');
        const sz = d * pxmm * 1.2;
        if (sz < 0.25) return;
        for (const col of big.cols) {
          const x = P.cx + col.u * P.rx, y = P.cy + col.v * P.ry, s = sz * col.s * (col.R ? 1.1 : 1);
          if (s < 0.6) { c.fillStyle = 'rgba(250,246,230,.9)'; c.fillRect(x, y, 1, 1); continue; }
          const ww = s, hh = s * tilt * 1.15;
          c.drawImage(sw, x - ww / 2, y - hh / 2, ww, hh);
          const g = colonyColor(col, S.day);
          if (g > 0.02) {
            if (col.R === 2) { // химерна (секторна) колонія: зелений лише сектор
              c.save(); c.beginPath(); c.moveTo(x, y); c.arc(x, y, ww, col.rot, col.rot + 2.2); c.closePath(); c.clip();
              c.globalAlpha = g; c.drawImage(sg, x - ww / 2, y - hh / 2, ww, hh); c.restore(); c.globalAlpha = 1;
            } else { c.globalAlpha = g; c.drawImage(sg, x - ww / 2, y - hh / 2, ww, hh); c.globalAlpha = 1; }
          }
          if (col.R && (!hot || col.R === 1)) hot = { x, y, s: ww, col };
        }
      },
    });
    tagSmall(ctx, cx, Math.min(h - 8, cy + r * tilt + r * 0.1 + 30), `Чашка ${S.sel + 1} з ${S.k}: МС + ІОК + БАП + стрептоміцин ${fnum(S.C, 2)} мг/мл`, { bg: 'rgba(255,255,255,.88)', size: wide ? 11.5 : 10.5 });
    // лупа на стійкій колонії
    const lr = wide ? Math.min(w * 0.095, h * 0.24) : Math.min(w * 0.17, h * 0.13);
    const lx = wide ? w * 0.615 : w * 0.8, ly = wide ? h * 0.32 : h * 0.1 + lr * 0.3;
    if (hot && d > 0.3) {
      ctx.save(); ctx.fillStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.16)';
      const ang = Math.atan2(ly - hot.y, lx - hot.x) + Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(hot.x, hot.y); ctx.lineTo(lx + Math.cos(ang) * lr, ly + Math.sin(ang) * lr); ctx.lineTo(lx - Math.cos(ang) * lr, ly - Math.sin(ang) * lr); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.5)' : 'rgba(30,60,40,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(hot.x, hot.y, hot.s * 0.8, hot.s * 0.55, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      colonyLens(ctx, lx, ly, lr, colonyColor(hot.col, S.day), hot.col.R === 2, hot.col.rot, dark);
    } else if (!dark || d > 0.3) {
      ctx.save(); ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      const t = S.day < 14 ? 'Колонії ще не видно' : 'На цій чашці стійких колоній немає';
      const m = ctx.measureText(t).width; ctx.fillStyle = dark ? 'rgba(10,25,16,.7)' : 'rgba(255,255,255,.85)'; roundRect(ctx, lx - m / 2 - 8, ly - 12, m + 16, 22, 10); ctx.fill();
      ctx.fillStyle = dark ? '#EAF5EC' : '#173322'; ctx.fillText(t, lx, ly + 3); ctx.restore();
    }
    // серія малих чашок
    hits = [];
    const nShow = Math.min(S.k, 12);
    const cols = wide ? 3 : 6, rows = Math.ceil(nShow / cols);
    const pr = wide ? Math.min(w * 0.04, h * 0.075) : Math.min(w * 0.065, h * 0.05);
    const gx0 = wide ? w * 0.75 : w * 0.5 - (cols - 1) * pr * 1.25, gy0 = wide ? h * 0.2 : h * 0.73;
    const dx = pr * 2.5, dy = wide ? pr * 2.15 : pr * 2.3;
    if (wide) tagSmall(ctx, gx0 + dx, gy0 - pr * 1.1, `Серія: ${S.k} чашок`, { color: dark ? '#EAF5EC' : '#1F3A2A', size: 11.5 });
    for (let j = 0; j < nShow; j++) {
      const px = gx0 + (j % cols) * dx, py = gy0 + Math.floor(j / cols) * dy, P = plates[j];
      if (j === S.sel) { ctx.save(); ctx.strokeStyle = '#E2B53E'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(px, py + pr * 0.1, pr * 1.18, pr * 0.72, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
      petri(ctx, px, py, pr, {
        tilt, medium: { color: '#EFE8C8' }, depth: 0.12, lid: false,
        contents: (c, Q) => {
          const R2 = rng(S.seed + j * 17), nd = Math.min(P.N, 220), ds = clamp(d / 3, 0, 1);
          if (ds > 0.05) { c.fillStyle = `rgba(250,246,228,${0.5 + 0.5 * ds})`; for (let i = 0; i < nd; i++) { const a = R2() * TAU, rr = Math.sqrt(R2()) * 0.92; c.fillRect(Q.cx + Math.cos(a) * rr * Q.rx, Q.cy + Math.sin(a) * rr * Q.ry, 1.2, 1); }
            if (O.Gs * lightK(S.day) > 0.05) { c.fillStyle = `rgba(80,150,60,${O.Gs * lightK(S.day) * 0.6})`; c.beginPath(); c.ellipse(Q.cx, Q.cy, Q.rx * 0.9, Q.ry * 0.9, 0, 0, TAU); c.fill(); }
            for (let i = 0; i < P.r; i++) { const a = R2() * TAU, rr = Math.sqrt(R2()) * 0.8, g = lightK(S.day) * O.Gr; c.fillStyle = g > 0.1 ? `rgba(60,150,50,${0.5 + 0.5 * g})` : '#FBF6E6'; c.beginPath(); c.arc(Q.cx + Math.cos(a) * rr * Q.rx, Q.cy + Math.sin(a) * rr * Q.ry, 1.6 + ds * 1.4, 0, TAU); c.fill(); }
          }
        },
      });
      const lab = lightK(S.day) > 0.3 && S.C > 0.05 ? `${P.r} зел.` : `№${j + 1}`;
      tagSmall(ctx, px, py + pr * 0.56 + 14, lab, { color: dark ? '#DDE8E0' : '#1F3A2A', size: 10.5, weight: P.r && lightK(S.day) > 0.3 ? 800 : 600 });
      hits.push({ x: px, y: py, r: pr * 1.2, j });
    }
    if (S.k > nShow) tagSmall(ctx, gx0 + dx, gy0 + rows * dy + 4, `+ ще ${S.k - nShow} (у розрахунку)`, { color: dark ? '#DDE8E0' : '#46584C', size: 10.5 });
    $('t6a-hud').innerHTML = `<span>Доба ${Math.round(S.day)}</span><span>${dark ? 'термостат · темрява · 25–26 °C' : 'світло · 25 °C'}</span>`;
  }
  /** Лупа: близький план колонії; g — інтенсивність зеленого. */
  function colonyLens(ctx, cx, cy, r, g, chim, rot, dark) {
    const size = Math.round(r * 2);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.save(); ctx.clip();
    ctx.drawImage(callusTexture(size, 31, '#F1E7C6', 0.7), cx - r, cy - r, 2 * r, 2 * r);
    if (g > 0.02) {
      ctx.save(); if (chim) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r * 1.5, rot, rot + 2.2); ctx.closePath(); ctx.clip(); }
      ctx.globalAlpha = g; ctx.drawImage(callusTexture(size, 31, '#79B04F', 0.7), cx - r, cy - r, 2 * r, 2 * r); ctx.restore();
    }
    const v = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = v; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.restore();
    const mg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); mg.addColorStop(0, '#F2F4F3'); mg.addColorStop(0.35, '#8F999A'); mg.addColorStop(0.6, '#DADFDF'); mg.addColorStop(1, '#5E6869');
    ctx.strokeStyle = mg; ctx.lineWidth = Math.max(4, r * 0.08); ctx.beginPath(); ctx.arc(cx, cy, r + ctx.lineWidth / 2, 0, TAU); ctx.stroke();
    ctx.restore();
    const lab = g > 0.3 ? (chim ? 'Химерна: зелений сектор' : 'Стійка колонія — зелена') : lightK(S.day) > 0 ? 'Стійка колонія' : 'Колонія (у темряві — біла)';
    ctx.save(); ctx.font = '600 11px system-ui, sans-serif'; const tw = ctx.measureText(lab).width; ctx.restore();
    const W = ctx.canvas.width / (ctx.getTransform().a || 1);
    tagSmall(ctx, clamp(cx, tw / 2 + 8, W - tw / 2 - 8), cy + r + 22, lab, { bg: dark ? 'rgba(235,245,238,.92)' : 'rgba(255,255,255,.9)', size: 11 });
  }
  cv.addEventListener('click', (e) => {
    const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    const hit = hits.find((q) => Math.hypot(x - q.x, (y - q.y) * 1.6) < q.r);
    if (hit && hit.j !== S.sel) { S.sel = hit.j; const keep = plates; build(); plates = keep; draw(); reads(); }
  });

  function reads() {
    const tot = plates.reduce((s, p) => s + p.r, 0), L = lightK(S.day);
    setOut($('t6a-reads'), {
      N: fnum(O.N, 0), PE: `${fnum(O.PE * 100, 1)} %`, lam: fnum(O.lam, O.lam < 1 ? 2 : 1),
      found: L > 0.3 && S.C > 0.05 ? `${tot}` : 'ще не видно', P: `${fnum(O.P * 100, 0)} %`, k95: O.k95 > 999 ? '> 1000' : `${O.k95}`,
    });
    const v = $('t6a-verdict'); let txt, cls = '';
    if (S.C < 0.05) { txt = `<b>Контроль без антибіотика.</b> На світлі зеленіють <i>усі</i> ${fnum(O.N, 0)} колоній — відрізнити стійкі неможливо. Саме стрептоміцин робить відбір «видимим».`; cls = 'is-warn'; }
    else if (O.Gs > 0.2) { txt = `<b>Концентрація замала.</b> При ${fnum(S.C, 2)} мг/мл чутливі колонії ще частково зеленіють (${fnum(O.Gs * 100, 0)} % хлорофілу) — фон заважає побачити мутантів. За посібником — 0,5 мг/мл.`; cls = 'is-warn'; }
    else if (S.day <= A.dark) txt = `<b>Етап калюсоутворення в темряві.</b> Клітини діляться й утворюють колонії (≈ ${fnum(diam(S.day, O.Gg), 1)} мм); стрептоміцин ріст не гальмує, але без світла хлорофіл не утворюється — всі колонії білі. Після перенесення на світло (у моделі з 28-ї доби) стійкі колонії позеленіють.`;
    else if (O.lam * S.k < 0.5) { txt = `<b>Стійких колоній, імовірно, не буде.</b> Очікувано ${fnum(O.lam, 3)} на чашку, тобто ${fnum(O.lam * S.k, 2)} на всю серію; для 95 % імовірності потрібно ≈ ${O.k95 > 999 ? 'понад 1000' : O.k95} чашок. Збільште густину висіву або частоту мутантів (мутагенез).`; cls = 'is-bad'; }
    else txt = `<b>Відбір за кольором працює.</b> На ${fnum(O.N, 0)} білих колоніях чашки виділяються зелені — клітини з мутацією в пластидах, яких стрептоміцин не знебарвлює. У серії знайдено ${tot} (очікувано ${fnum(O.lam * S.k, 1)}). Зелені ділянки відокремлюють і розмножують на тому ж середовищі; частина з них химерна (зелений лише сектор) — їх тримають на антибіотику.`;
    v.className = 'ag-verdict ' + cls; v.innerHTML = txt;
  }
  function plots() {
    p1.set([
      { data: sample((c) => 100 / (1 + Math.pow(c / A.icS, A.hS)), 0, 2, 200), color: '#B08A2E', label: 'хлорофіл чутливих', fill: 'rgba(176,138,46,.08)' },
      { data: sample((c) => 100 / (1 + Math.pow(c / A.icR, A.hR)), 0, 2, 100), color: '#3E8F3A', label: 'хлорофіл стійких' },
      { data: sample((c) => 100 / (1 + Math.pow(c / A.icG, A.hG)), 0, 2, 100), color: '#5E7A8A', label: 'ріст колоній', dash: [6, 4] },
    ], [{ x: S.C, label: `${fnum(S.C, 2)} мг/мл` }, { x: 0.5, color: '#7A8A80', dash: [2, 4] }]);
    const pts = []; for (let k = 1; k <= 40; k++) pts.push([k, 100 * (1 - Math.exp(-k * O.lam))]);
    p2.set([{ data: pts, color: '#3E8F3A', label: 'P(≥ 1) = 1 − e^(−kλ)', type: 'step', fill: 'rgba(62,143,58,.08)' }], [{ y: 95, label: '95 %', color: '#8C6A10' }, { x: Math.min(40, S.k), label: `${S.k} чашок` }]);
  }
  function update(dayOnly) { draw(); reads(); if (!dayOnly) plots(); }
  onResize(cv.parentElement, () => draw());
  build(); update();
  return { runner, redraw: () => draw() };
}

/* ================= Б. Сублетальна доза і стабільність ================= */
function initB() {
  const cv = $('t6b-scene'); if (!cv) return null;
  const S = { c: 130, scheme: 'direct', nSel: 5, nNon: 3, show: false, pos: 0, seed: 7 };
  let plan = schedule(S), states = [], exp = expected(plan);
  segmented($('t6b-scheme'), 't6b-scheme', [{ value: 'direct', label: 'Пряма' }, { value: 'step', label: 'Ступінчаста' }], S.scheme, (v) => { S.scheme = v; rebuild(); });
  const sl = sliders($('t6b-ctrl'), [
    { id: 't6b-c', label: 'NaCl у середовищі', min: 0, max: 300, step: 5, value: S.c, unit: '', digits: 0, format: (v) => `${fnum(v, 0)} мМ (${fnum(v * 58.44 / 1000, 1)} г/л)`, hint: 'мМ — мілімоль на літр; 1 мМ NaCl = 0,058 г/л.' },
    { id: 't6b-sel', label: 'Пасажів із NaCl', min: 4, max: 6, step: 1, value: S.nSel, unit: '', hint: 'За посібником 4–6.' },
    { id: 't6b-non', label: 'Пасажів без NaCl', min: 0, max: 3, step: 1, value: S.nNon, unit: '', hint: 'За посібником 2–3; 0 — без перевірки.' },
  ], () => { S.c = sl.values['t6b-c']; S.nSel = sl.values['t6b-sel']; S.nNon = sl.values['t6b-non']; rebuild(); });
  $('t6b-show').addEventListener('change', (e) => { S.show = e.target.checked; draw(); });
  const p1 = new Plot($('t6b-p1'), { xLabel: 'NaCl, мМ', yLabel: '% від контролю', x: [0, 300], y: [0, 100], xShort: 'NaCl', aspect: 1.7 });
  const p2 = new Plot($('t6b-p2'), { xLabel: 'пасаж', yLabel: 'клонів (з 48)', x: [0, 10], y: 'auto', xShort: 'пасаж', aspect: 1.7 });

  function rebuild() {
    plan = schedule(S); exp = expected(plan);
    const R = rng(S.seed);
    states = [];
    for (let i = 0; i < B.N0; i++) {
      let st = R() < B.qG ? 'G' : 'S'; const row = [st];
      for (const P of plan) { st = stepClone(st, P, R); row.push(st); }
      states.push({ row, sz: 0.8 + R() * 0.4, seed: 100 + i });
    }
    S.pos = Math.min(S.pos, plan.length);
    chips(); draw(); reads(); plots();
  }
  const runner = new Runner({
    btn: $('t6b-run'), reset: $('t6b-reset'), status: $('t6b-status'),
    step: (dt, t, reset) => {
      if (reset) { S.pos = 0; chips(); reads(); return; }
      const prev = Math.floor(S.pos);
      S.pos = Math.min(plan.length, S.pos + dt * 0.55); if (S.pos >= plan.length) runner.finish();
      if (Math.floor(S.pos) !== prev) { chips(); reads(); }
    },
    draw: () => draw(),
  });
  const origPlay = runner.play.bind(runner);
  runner.play = () => { if (!runner.started || S.pos >= plan.length - 0.01) { S.pos = 0; chips(); } origPlay(); };

  function chips() {
    const ol = $('t6b-chips'); const k = Math.floor(S.pos);
    ol.innerHTML = '<li class="is-start' + (k === 0 && S.pos < 0.5 ? ' is-cur' : ' is-done') + '"><b>0</b><span>старт</span></li>' + plan.map((P, i) => {
      const cls = P.kind === 'non' ? 'is-non' : P.kind === 'ret' ? 'is-ret' : 'is-sel';
      const st = i + 1 <= k ? ' is-done' : i === k ? ' is-cur' : '';
      const lab = P.kind === 'non' ? 'без NaCl' : `${fnum(P.c, 0)} мМ`;
      return `<li class="${cls}${st}"><b>${P.kind === 'ret' ? 'П' : i + 1}</b><span>${lab}</span></li>`;
    }).join('');
  }
  function stateAt(cl) { // інтерполяція між пасажами
    const k = Math.min(Math.floor(S.pos), plan.length), f = easeInOut(clamp(S.pos - k, 0, 1));
    const a = cl.row[k], b = cl.row[Math.min(k + 1, plan.length)];
    return { a, b: k < plan.length ? b : a, f: k < plan.length ? f : 0, k };
  }
  function draw() {
    const W = cv.parentElement.clientWidth; if (!W) return;
    const wide = W >= 700;
    const { ctx, w, h } = fit(cv, { aspect: wide ? 2.2 : 0.95, min: 300, max: 460 });
    scene(ctx, w, h, { kind: 'hood', horizon: wide ? 0.2 : 0.14, light: 0.5 });
    const k = Math.min(Math.floor(S.pos), plan.length), P = k < plan.length ? plan[Math.min(k, plan.length - 1)] : plan[plan.length - 1];
    const cur = S.pos < 1e-6 ? { kind: 'sel', c: plan[0].c } : plan[Math.min(k, plan.length - 1)];
    const r = wide ? Math.min(w * 0.115, h * 0.42) : Math.min(w * 0.225, h * 0.22);
    const centers = wide ? [0, 1, 2, 3].map((i) => [w * (0.14 + i * 0.24), h * 0.55]) : [0, 1, 2, 3].map((i) => [w * (0.27 + (i % 2) * 0.46), h * (0.3 + Math.floor(i / 2) * 0.42)]);
    const medCol = cur.kind === 'non' ? '#EFE8C8' : '#E4E6D2';
    centers.forEach(([cx, cy], d) => {
      petri(ctx, cx, cy, r, {
        tilt: 0.62, medium: { color: medCol },
        contents: (c, Q) => {
          for (let i = 0; i < 12; i++) {
            const cl = states[d * 12 + i]; if (!cl) continue;
            const gx = i % 4, gy = Math.floor(i / 4);
            const x = Q.cx + (gx - 1.5) * Q.rx * 0.45, y = Q.cy + (gy - 1) * Q.ry * 0.6;
            const { a, b, f } = stateAt(cl);
            const alive = (s) => (s === 'S' || s === 'A' || s === 'G' ? 1 : 0);
            const life = lerp(alive(a), alive(b), f);
            const grow = 0.55 + 0.45 * Math.min(1, (S.pos + 1) / 4) * (cur.kind === 'non' ? 1 : growth(cur.c / (b === 'G' ? B.kG : b === 'A' ? B.kA : 1)));
            const size = r * 0.17 * cl.sz * (0.5 + 0.5 * life) * grow;
            callus(c, x, y + size * 0.3, size, { color: '#F0E6C2', friable: 0.45, brown: 1 - life + (b === 'X' ? 0.5 : 0), seed: cl.seed, n: 9, glossy: 0.6 * life });
            if (S.show) {
              const st = f > 0.5 ? b : a, col = st === 'G' ? '#2E8B3A' : st === 'A' ? '#D98A1C' : st === 'S' ? '#8A949C' : null;
              if (col) { c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath(); c.ellipse(x, y, size * 1.25, size * 0.75, 0, 0, TAU); c.stroke(); }
            }
          }
        },
      });
      tagSmall(ctx, cx, cy + r * 0.62 + r * 0.16 + 16, `Чашка ${d + 1}`, { color: '#1F3A2A', size: 10.5 });
    });
    const head = S.pos >= plan.length ? 'Підсумок: стабільні лінії' : cur.kind === 'non' ? 'Пасаж без NaCl (перевірка)' : cur.kind === 'ret' ? `Повернення на ${fnum(cur.c, 0)} мМ NaCl` : `Селекція: ${fnum(cur.c, 0)} мМ NaCl`;
    $('t6b-hud').innerHTML = `<span>${head}</span>`;
  }
  function reads() {
    const k = Math.min(Math.floor(S.pos), plan.length);
    const cnt = (s) => states.filter((cl) => cl.row[k] === s).length;
    const end = exp[exp.length - 1], afterSel = exp[S.nSel];
    const stable = (end.G + end.A) * B.N0;
    setOut($('t6b-reads'), {
      surv: `${fnum(surv(S.c) * 100, 0)} %`, grow: `${fnum(growth(S.c) * 100, 0)} %`,
      zone: isSublethal(S.c) ? 'сублетальна' : surv(S.c) < 0.2 ? 'летальна' : surv(S.c) > 0.8 ? 'замала' : 'ріст пригнічений',
      sel: fnum((afterSel.G + afterSel.A + afterSel.S) * B.N0, 1), stab: fnum(stable, 1),
      gen: stable > 0.05 ? `${fnum(end.G / (end.G + end.A) * 100, 0)} %` : '—',
      now: `${cnt('G') + cnt('A') + cnt('S')} з ${B.N0}`,
    });
    $('t6b-zone').className = 'ag-read ' + (isSublethal(S.c) ? 't6-ok' : 't6-warn');
    const v = $('t6b-verdict'); let txt, cls = '';
    const fp = (afterSel.G + afterSel.A + afterSel.S) * B.N0 - stable;
    if (surv(S.c) > 0.8) { txt = `<b>Концентрація замала.</b> Гине лише ${fnum((1 - surv(S.c)) * 100, 0)} % колоній — тиск відбору слабкий, «стійкими» виявиться майже все. Сублетальна зона в моделі ≈ 105–145 мМ: калюс ще росте, але частина колоній гине (с. 94).`; cls = 'is-warn'; }
    else if (surv(S.c) < 0.2) { txt = `<b>Летальна концентрація.</b> Виживає ${fnum(surv(S.c) * 100, 0)} % колоній, ріст пригнічено до ${fnum(growth(S.c) * 100, 0)} % — гинуть навіть стійкі варіанти, які ще не встигли проявитися.`; cls = 'is-bad'; }
    else txt = `<b>${isSublethal(S.c) ? 'Сублетальна концентрація.' : 'Ріст сильно пригнічений.'}</b> Після ${S.nSel} пасажів селекції залишається ≈ ${fnum((afterSel.G + afterSel.A + afterSel.S) * B.N0, 1)} клонів, але багато з них лише фізіологічно адаптовані. ${S.nNon ? `${S.nNon} пасаж(і) без NaCl і повернення в селективні умови відсіюють ≈ ${fnum(fp, 1)} нестабільних; ` : 'Без пасажів на середовищі без NaCl адаптовані клони не відсіюються; '}стабільних ліній ≈ ${fnum(stable, 1)}, з них генетично стійких ${stable > 0.05 ? fnum(end.G / (end.G + end.A) * 100, 0) : '—'} %.`;
    if (S.scheme === 'step') txt += ' Ступінчаста селекція (концентрацію піднімають поступово: 50 → 75 → 100 %) зберігає більше клонів, але серед них більше тимчасово адаптованих.';
    v.className = 'ag-verdict ' + cls; v.innerHTML = txt;
  }
  function plots() {
    const band = sample((c) => (isSublethal(c) ? 100 * surv(c) : NaN), 0, 300, 301);
    p1.set([
      { data: sample((c) => 100 * surv(c), 0, 300, 200), color: '#B2452E', label: 'виживання колоній' },
      { data: sample((c) => 100 * growth(c), 0, 300, 200), color: '#3E8F3A', label: 'ріст тих, що вижили', dash: [6, 4] },
      { data: band.filter((p) => isFinite(p[1])), color: 'rgba(226,181,62,.0)', fill: 'rgba(226,181,62,.28)', label: 'сублетальна зона', noHover: true },
    ], [{ x: S.c, label: `${fnum(S.c, 0)} мМ` }]);
    const G = [], Aa = [], Ss = [], T = [];
    exp.forEach((r, i) => { G.push([i, r.G * B.N0]); Aa.push([i, r.A * B.N0]); Ss.push([i, r.S * B.N0]); T.push([i, (r.G + r.A + r.S) * B.N0]); });
    p2.setOptions({ x: [0, plan.length] });
    p2.set([
      { data: T, color: '#2B3D31', label: 'усього живих', width: 2.6 },
      { data: Ss, color: '#8A949C', label: 'чутливі' },
      { data: Aa, color: '#D98A1C', label: 'адаптовані (нестабільні)' },
      { data: G, color: '#2E8B3A', label: 'генетично стійкі' },
    ], [{ x: S.nSel, label: 'без NaCl', color: '#7A8A80', dash: [3, 4] }, { x: plan.length - 1, label: 'П', color: '#7A8A80', dash: [3, 4] }]);
  }
  onResize(cv.parentElement, () => draw());
  rebuild();
  return { runner, redraw: () => draw() };
}

/* ================= вкладки ================= */
const models = { a: initA(), b: initB() };
const tabs = [...document.querySelectorAll('#t6-tabs [role="tab"]')];
function show(tab, focus) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    const m = models[t.dataset.k]; if (!on && m && m.runner.running) m.runner.pause();
  });
  const m = models[tab.dataset.k]; if (m) requestAnimationFrame(() => m.redraw());
  if (focus) tab.focus();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => show(t));
  t.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); show(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true); });
});
function fromHash() { const k = { '#t6-tab-a': 0, '#t6-tab-b': 1 }[location.hash]; if (k !== undefined) { show(tabs[k]); document.getElementById('model').scrollIntoView({ behavior: 'smooth' }); } }
addEventListener('hashchange', fromHash);
document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#t6-tab-"]'); if (a && a.getAttribute('href') === location.hash) fromHash(); });
fromHash();
