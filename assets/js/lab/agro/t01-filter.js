// ЛР 3. Холодна стерилізація: фільтр Зейтца з мембраною на колбі Бунзена під вакуумом (с. 53–55).
// Потік — закон Дарсі для мембрани з налипанням осаду (кекова фільтрація):
//   Q = K·ΔP / (μ·(R_м + R_п + α·V)),  R_м = (0,22/d)²  (проникність ∝ d² за Пуазейлем при сталій пористості),
//   R_п = 0,15 (диски фільтрувального паперу), α = 0,012 мл⁻¹ (×3, якщо мембрану покладено блискучою стороною до сітки —
//   осад забиває пори «зсередини»). K підібрано так, щоб 100 мл середовища МС (μ ≈ 1,07 мПа·с з 3 % сахарози) за
//   розрідження 40 кПа проходили через мембрану 0,22 мкм із початковою швидкістю ≈ 10 мл/хв (2–3 краплі/с): «краплини
//   повинні скапувати повільно» (с. 54). Інтегрування аналітичне: t(V) = μ/(K·ΔP)·(R₀·V + α·V²/2).
// Затримання частинок — логарифмічна редукція LRV = 12·(s/d − 0,45) в межах 0…9 (s — найменший розмір частинки).
//   Наближення відтворює стандарт стерилізуючого фільтра: 0,22 мкм затримує Brevundimonas diminuta (0,3 мкм) з LRV ≥ 7,
//   0,45 мкм — лише ≈ 2–3 lg. Пошкоджена мембрана: 2 % потоку йде в обхід → LRV ≈ 1,7.
import { Plot, segmented, sliders, setOut, fnum, clamp, lerp, TAU, rng, scene, shadow, Runner, onResize, fit, roundRect, microField } from './kit.js';
import { bunsenFlask, seitzFilter, steel, chip, font, arrow } from './t01-draw.js';

const K = 0.308, RP = 0.15, ALPHA = 0.012, MU = 1.07, DROP = 0.05;
export const PARTS = [
  { id: 'fung', n: 'Спори грибів', s: 2.5, c: 20, col: '#5B7A3A', ster: true },
  { id: 'bac', n: 'Бактерії-палички', s: 0.6, c: 500, col: '#C2410C', ster: true },
  { id: 'dim', n: 'Дрібні бактерії (0,3 мкм)', s: 0.3, c: 50, col: '#B45309', ster: true },
  { id: 'myc', n: 'Мікоплазми', s: 0.15, c: 0, col: '#7C3AED', ster: false },
  { id: 'vir', n: 'Віруси', s: 0.03, c: 0, col: '#0E7490', ster: false },
];
export const lrv = (s, d) => clamp(12 * (s / d - 0.45), 0, 9);
const lrvEff = (s, d, damaged) => (damaged ? -Math.log10(0.02 + 0.98 * Math.pow(10, -lrv(s, d))) : lrv(s, d));

export function filterCalc({ d, dp, damaged, wrongSide, V }) {
  const R0 = (damaged ? 0.02 : Math.pow(0.22 / d, 2)) + RP, a = ALPHA * (wrongSide ? 3 : 1);
  const tOf = (v) => MU / (K * dp) * (R0 * v + a * v * v / 2);
  const Q = (v) => K * dp / (MU * (R0 + a * v));
  let N = 0; const rows = PARTS.map((p) => { const L = lrvEff(p.s, d, damaged); const nin = p.c * V, nout = nin * Math.pow(10, -L); if (p.ster) N += nout; return { ...p, L, nin, nout }; });
  return { R0, a, tOf, Q, T: tOf(V), Q0: Q(0), Qend: Q(V), rows, N, pNS: 1 - Math.exp(-N) };
}

export function initFilter(root) {
  const $ = (s) => root.querySelector(s);
  const cv = $('canvas'), hud = $('.ag-stage__hud'), verdict = $('.ag-verdict');
  const S = { d: 0.22, dp: 40, damaged: false, wrongSide: false, fastAir: false, V: 100 };
  let C = null, tm = 0, phase = 'idle', airT = 0, drops = [], parts = [];

  segmented($('[data-ctl="pore"]'), 'fpr', [0.1, 0.22, 0.45, 0.8, 1.2].map((d) => ({ value: d, label: `${fnum(d, d < 0.2 ? 1 : 2).replace(/0$/, '')} мкм` })), S.d, (v) => { S.d = +v; recalc(); });
  const sl = sliders($('[data-ctl="sl"]'), [
    { id: 'dp', label: 'Розрідження (вакуум)', min: 10, max: 80, step: 5, value: S.dp, unit: 'кПа', hint: 'Водоструминний насос або насос Камовського дають до 80–90 кПа' },
    { id: 'V', label: 'Об\'єм рідкого середовища', min: 50, max: 250, step: 10, value: S.V, unit: 'мл' },
  ], () => { S.dp = sl.values.dp; S.V = sl.values.V; recalc(); });
  segmented($('[data-ctl="mem"]'), 'fmb', [{ value: 0, label: 'Мембрана ціла' }, { value: 1, label: 'Пошкоджена' }], 0, (v) => { S.damaged = +v === 1; recalc(); });
  segmented($('[data-ctl="side"]'), 'fsd', [{ value: 0, label: 'Матовою до сітки' }, { value: 1, label: 'Блискучою до сітки' }], 0, (v) => { S.wrongSide = +v === 1; recalc(); });
  segmented($('[data-ctl="air"]'), 'far', [{ value: 0, label: 'Повітря впускати повільно' }, { value: 1, label: 'Різко зняти вакуум' }], 0, (v) => { S.fastAir = +v === 1; recalc(); });

  const pV = new Plot($('[data-plot="V"]'), { xLabel: 't, хв', yLabel: 'Фільтрат, мл', xShort: 't', ariaLabel: 'Об\'єм фільтрату від часу' });
  const pL = new Plot($('[data-plot="L"]'), { xLabel: 'Розмір частинки, мкм (lg-шкала)', yLabel: 'LRV, lg', xShort: 'lg s', x: [-1.7, 0.6], y: [0, 9.5], xFmt: (v) => fnum(Math.pow(10, v), Math.pow(10, v) < 0.1 ? 2 : 1), ariaLabel: 'Логарифмічна редукція частинок від їхнього розміру' });

  function recalc() {
    C = filterCalc(S);
    const pAir = S.fastAir ? 0.6 : 0;
    const pTot = 1 - (1 - C.pNS) * (1 - pAir);
    // графіки
    const ref = filterCalc({ d: 0.22, dp: 40, damaged: false, wrongSide: false, V: S.V });
    const Tmax = Math.max(C.T, ref.T) * 1.05;
    const curve = (c) => { const a = []; for (let i = 0; i <= 80; i++) { const v = S.V * i / 80; a.push([c.tOf(v), v]); } return a; };
    const mk = phase !== 'idle' ? [Math.min(tm, C.T), vAt(Math.min(tm, C.T))] : undefined;
    pV.setOptions({ x: [0, Tmax], y: [0, S.V * 1.08] });
    pV.set([
      { data: curve(ref), color: '#94A3B8', dash: [5, 4], label: 'еталон: 0,22 мкм, 40 кПа', width: 2 },
      { data: curve(C), color: '#0E7490', label: 'ваш режим', width: 2.6, marker: mk },
    ]);
    const sz = []; for (let l = -1.7; l <= 0.6; l += 0.02) sz.push([l, lrvEff(Math.pow(10, l), S.d, S.damaged)]);
    pL.set([
      { data: sz, color: '#0E7490', label: `мембрана ${fnum(S.d, 2)} мкм${S.damaged ? ' (пошкоджена)' : ''}`, width: 2.6 },
      { data: C.rows.map((r) => [Math.log10(r.s), r.L]), type: 'points', color: '#C2410C', label: 'класи частинок', r: 5 },
    ], [{ y: 6, color: '#15803D', label: 'стерилізуючий фільтр: LRV ≥ 6–7' }]);
    const bac = C.rows.find((r) => r.id === 'bac'), dim = C.rows.find((r) => r.id === 'dim');
    const dps = C.Q0 / 60 / DROP;
    setOut(root, {
      q0: `${fnum(C.Q0, 1)} мл/хв`,
      dps: dps > 8 ? '<span class="is-bad">струмінь</span>' : `${fnum(dps, 1)} кр/с`,
      t: `${fnum(C.T, 1)} хв`,
      lrv: `<span class="${dim.L >= 6 ? 'is-ok' : 'is-bad'}">${fnum(dim.L, 1)}</span>`,
      pns: `<span class="${pTot < 0.01 ? 'is-ok' : 'is-bad'}">${pTot >= 0.995 ? '≈ 100 %' : pTot < 1e-4 ? '< 0,01 %' : fnum(pTot * 100, pTot < 0.1 ? 1 : 0) + ' %'}</span>`,
    });
    let cls = '', msg = '';
    if (S.damaged) { cls = 'is-bad'; msg = `<b>Порушена цілісність фільтра:</b> рідина стікає струменем (${fnum(C.Q0, 0)} мл/хв), частина потоку йде повз мембрану, LRV для бактерій лише ${fnum(bac.L, 1)}. «Швидке стікання свідчить про порушення цілісності фільтра» (с. 54) — фільтрат вважають нестерильним, фільтр перезбирають і стерилізують знову.`; }
    else if (C.pNS > 0.01) { cls = 'is-bad'; msg = `<b>Мембрана ${fnum(S.d, 2)} мкм не стерилізує:</b> дрібні бактерії (≈ 0,3 мкм) проходять (LRV = ${fnum(dim.L, 1)}), у фільтраті очікується ≈ ${fnum(C.N, C.N < 10 ? 1 : 0)} клітин на ${S.V} мл. Для холодної стерилізації потрібні мембрани 0,22 мкм (або 0,1 мкм, якщо треба затримати мікоплазми).`; }
    else if (S.fastAir) { cls = 'is-bad'; msg = `<b>Фільтрат був стерильним, але вакуум знято різко:</b> потік повітря засмоктує ватний тампон із трубки в колбу — фільтрат інфіковано (с. 54). Повітря впускають повільно, поступово відкриваючи кран.`; }
    else if (S.wrongSide) { cls = 'is-warn'; msg = `<b>Мембрана перевернута:</b> матова (пориста) сторона має лежати до сітки (с. 54). Затримання не змінюється, але осад забиває пори швидше — потік падає з ${fnum(C.Q0, 1)} до ${fnum(C.Qend, 1)} мл/хв, фільтрування триває ${fnum(C.T, 0)} хв.`; }
    else if (S.dp > 65) { cls = 'is-warn'; msg = `<b>Надто сильний вакуум (${S.dp} кПа):</b> краплі течуть майже струменем (${fnum(dps, 1)} кр/с), мембрана сильніше деформується і може прорватися, а з середовища випаровується вода. Достатньо 30–50 кПа.`; }
    else { msg = `<b>Холодна стерилізація коректна:</b> мембрана ${fnum(S.d, 2)} мкм затримує бактерії (LRV ${fnum(dim.L, 1)}–${fnum(bac.L, 1)}) і спори грибів, а сахароза, вітаміни, фітогормони, амінокислоти й антибіотики проходять у фільтрат. ${S.V} мл фільтрується ≈ ${fnum(C.T, 0)} хв, краплі — ${fnum(dps, 1)} за секунду.`; }
    verdict.className = 'ag-verdict ' + cls; verdict.innerHTML = msg;
    draw();
  }
  function vAt(t) { // обернена до t(V): квадратне рівняння
    const a = C.a / 2, b = C.R0, c = -t * K * S.dp / MU;
    return clamp(a > 1e-9 ? (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a) : -c / b, 0, S.V);
  }

  function draw() {
    if (!C) return;
    const mob = cv.parentElement.clientWidth < 480;
    const { ctx, w, h } = fit(cv, { aspect: mob ? 0.8 : 1.3, min: 380, max: 540 });
    const hy = scene(ctx, w, h, { kind: 'bench', horizon: 0.88 });
    const t = performance.now() / 1000;
    const vNow = phase === 'idle' ? 0 : vAt(Math.min(tm, C.T));
    const fs = mob ? Math.min(w * 0.42, h * 0.36) : Math.min(h * 0.42, w * 0.22);
    const fx = mob ? w * 0.33 : w * 0.3, fby = hy + 8;
    const geo = bunsenFlask(ctx, fx, fby, fs, { level: clamp(vNow / (S.V * 1.6), 0, 0.7), color: '#EDE7C4', cloudy: phase === 'done' && (S.fastAir || C.pNS > 0.5) ? 0.15 : 0 });
    // шланг до насоса
    const ax = geo.arm[0], ay = geo.arm[1];
    const px = mob ? w * 0.86 : w * 0.56, py = hy - fs * 0.15;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#3B2A22'; ctx.lineWidth = Math.max(4, fs * 0.05);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.bezierCurveTo(ax + fs * 0.3, ay - fs * 0.05, px - fs * 0.25, py - fs * 0.5, px - fs * 0.05, py - fs * 0.32); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    // скляна трубка з ватним тампоном
    const gx = ax + fs * 0.16, gy = ay - fs * 0.005;
    ctx.save(); ctx.fillStyle = 'rgba(220,240,235,.6)'; roundRect(ctx, gx - fs * 0.07, gy - fs * 0.025, fs * 0.14, fs * 0.05, 3); ctx.fill(); ctx.strokeStyle = 'rgba(70,100,90,.6)'; ctx.stroke();
    const plugShift = phase === 'air' && S.fastAir ? clamp(airT / 0.6, 0, 1) : phase === 'done' && S.fastAir ? 1 : 0;
    ctx.fillStyle = '#F7F3E8'; ctx.beginPath(); ctx.ellipse(gx - plugShift * fs * 0.2, gy, fs * 0.035, fs * 0.022, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (plugShift >= 1) { ctx.save(); ctx.fillStyle = '#F7F3E8'; ctx.beginPath(); ctx.ellipse(fx + fs * 0.12, fby - fs * 0.04, fs * 0.04, fs * 0.022, 0.3, 0, TAU); ctx.fill(); ctx.restore(); chip(ctx, fx + fs * 0.12, fby - fs * 0.12, 'тампон у колбі!', { size: 11, color: '#B91C1C' }); }
    // насос (водоструминний на крані)
    drawPump(ctx, px, py, fs, phase === 'filt');
    // вакуумметр
    const vac = phase === 'filt' ? S.dp : phase === 'air' ? S.dp * (S.fastAir ? Math.max(0, 1 - airT / 0.15) : Math.max(0, 1 - airT / 1.4)) : 0;
    drawVacGauge(ctx, px + fs * 0.02, py - fs * 0.72, fs * 0.13, vac);
    // фільтр
    const fil = seitzFilter(ctx, geo.tipX, geo.tipY, fs * 0.95, { level: clamp(1 - vNow / S.V, 0, 1) * 0.92 * (phase === 'idle' ? 1 : 1), color: '#EDE7C4', t, damaged: S.damaged });
    // краплі / струмінь
    const Qn = phase === 'filt' ? C.Q(vNow) : 0;
    const dps = Qn / 60 / DROP;
    const tipY = geo.tipY + fs * 0.05, surf = geo.surf;
    if (phase === 'filt') {
      if (dps > 8) { ctx.save(); ctx.strokeStyle = 'rgba(235,228,190,.9)'; ctx.lineWidth = Math.max(2, fs * 0.018); ctx.beginPath(); ctx.moveTo(geo.tipX, tipY); ctx.lineTo(geo.tipX + Math.sin(t * 20) * 0.6, surf); ctx.stroke(); ctx.restore(); }
      else {
        const per = 1 / Math.max(0.2, dps), ph = (t % per) / per, fallT = Math.min(per, 0.45);
        const k = clamp((t % per) / fallT, 0, 1);
        const yy = lerp(tipY, surf - 2, k * k);
        ctx.save(); ctx.fillStyle = 'rgba(240,234,200,.95)'; ctx.strokeStyle = 'rgba(120,110,70,.5)'; ctx.lineWidth = 0.6;
        const dr = Math.max(2, fs * 0.014);
        if (k < 1) { ctx.beginPath(); ctx.ellipse(geo.tipX, yy, dr, dr * 1.3, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
        else { ctx.beginPath(); ctx.ellipse(geo.tipX, surf, dr * 2 * (1 - ph), dr * 0.4, 0, 0, TAU); ctx.stroke(); }
        ctx.restore();
      }
    }
    if (phase === 'air' && !S.fastAir) { // бульбашки повітря крізь тампон
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 4; i++) { const p = (t * 1.5 + i / 4) % 1; ctx.beginPath(); ctx.arc(gx - fs * 0.1 * p, gy, 1.6, 0, TAU); ctx.fill(); } ctx.restore();
    }
    // збірка шарів фільтра (схема) — на широкому екрані
    if (!mob) drawStack(ctx, w * 0.035, h * 0.08, Math.min(w * 0.16, 170), S);
    // поле: розріз мембрани
    const mr = mob ? Math.min(w * 0.2, 70) : Math.min(h * 0.27, 120);
    const mx = mob ? w * 0.78 : w * 0.8, my = mob ? h * 0.2 + 10 : h * 0.42;
    microField(ctx, mx, my, mr, (c, f) => drawMembrane(c, f, t), { mode: 'bright' });
    chip(ctx, mx, my + mr * 1.1 + 18, `розріз мембрани ${fnum(S.d, 2)} мкм`, { size: mob ? 10.5 : 11.5, dark: true });
    // підписи
    if (!mob) {
      chip(ctx, geo.tipX - fs * 0.48, fil.topY + fs * 0.12, 'фільтр Зейтца', { size: 11, align: 'right' });
      chip(ctx, fx - fs * 0.5, fby - fs * 0.35, 'колба Бунзена', { size: 11, align: 'right' });
      chip(ctx, px, py + fs * 0.24, 'водоструминний насос', { size: 11 });
    }
    const names = { idle: 'Фільтр зібрано й простерилізовано (30 хв, 1 атм)', filt: `Фільтрування: ${fnum(vNow, 0)} / ${S.V} мл`, air: S.fastAir ? 'Вакуум знято різко' : 'Повільно впускаємо повітря', done: 'Готово: у ламінар-боксі перелити фільтрат у стерильну колбу' };
    hud.innerHTML = `<span>${names[phase]}</span>${phase !== 'idle' ? `<span>t = ${fnum(Math.min(tm, C.T), 1)} хв</span>` : ''}`;
  }

  function drawPump(ctx, x, y, s, on) {
    // кран + скляний ежектор
    ctx.save();
    ctx.fillStyle = steel(ctx, x - s * 0.04, x + s * 0.04); ctx.fillRect(x - s * 0.035, y - s * 0.5, s * 0.07, s * 0.16);
    ctx.fillStyle = steel(ctx, x - s * 0.04, x + s * 0.3); roundRect(ctx, x - s * 0.04, y - s * 0.56, s * 0.3, s * 0.07, 4); ctx.fill();
    ctx.fillStyle = '#B91C1C'; roundRect(ctx, x + s * 0.02, y - s * 0.64, s * 0.12, s * 0.04, 3); ctx.fill();
    ctx.fillStyle = 'rgba(220,240,235,.55)'; roundRect(ctx, x - s * 0.045, y - s * 0.34, s * 0.09, s * 0.42, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(70,100,90,.6)'; ctx.lineWidth = 1; ctx.stroke();
    if (on) { const t = performance.now() / 1000; ctx.strokeStyle = 'rgba(160,200,230,.8)'; ctx.lineWidth = s * 0.025; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 60; ctx.beginPath(); ctx.moveTo(x, y - s * 0.34); ctx.lineTo(x, y + s * 0.2); ctx.stroke(); ctx.setLineDash([]); }
    // мийка
    ctx.fillStyle = '#9AA4A8'; roundRect(ctx, x - s * 0.2, y + s * 0.16, s * 0.4, s * 0.06, 3); ctx.fill();
    ctx.restore();
  }
  function drawVacGauge(ctx, x, y, r, kPa) {
    ctx.save(); shadow(ctx, x, y + r * 1.05, r, r * 0.25, 0.25);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r * 1.1); g.addColorStop(0, '#F8FAF8'); g.addColorStop(1, '#8C9599');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, r * 0.94, 0, TAU); ctx.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    ctx.strokeStyle = '#1E2A24';
    for (let v = 0; v <= 100; v += 10) { const a = a0 + (a1 - a0) * v / 100; ctx.lineWidth = v % 50 ? 0.7 : 1.4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); ctx.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86); ctx.stroke(); }
    const a = a0 + (a1 - a0) * clamp(kPa, 0, 100) / 100;
    ctx.strokeStyle = '#B42318'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
    ctx.restore();
    chip(ctx, x, y - r * 1.2 - 4, `−${fnum(kPa, 0)} кПа`, { size: 11 });
  }

  function drawStack(ctx, x, y, w, S) {
    const layers = [['гумове кільце', '#2F3532', 4], ['фільтрувальний папір', '#F4EFE2', 5], [S.wrongSide ? 'мембрана: блискуча ↓ ⚠' : 'мембрана: матова ↓', S.damaged ? '#E8C9A0' : '#FFFFFF', 3], ['фільтрувальний папір', '#F4EFE2', 5], ['гумове кільце', '#2F3532', 4], ['металева сітка', '#9AA4A8', 4]];
    font(ctx, 11, 700); ctx.fillStyle = '#1F3A2A'; ctx.textAlign = 'left'; ctx.fillText('Збірка фільтра (згори вниз)', x, y);
    let yy = y + 16;
    layers.forEach(([n, c, th], i) => {
      ctx.save();
      const ew = w * 0.42, cxe = x + ew / 2;
      ctx.fillStyle = c; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(cxe, yy + 5, ew / 2, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (n.startsWith('металева')) { ctx.strokeStyle = 'rgba(40,50,55,.5)'; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(cxe + k * ew * 0.12, yy + 1); ctx.lineTo(cxe + k * ew * 0.12, yy + 9); ctx.stroke(); } }
      if (n.startsWith('гумове')) { ctx.fillStyle = 'rgba(240,244,240,1)'; ctx.beginPath(); ctx.ellipse(cxe, yy + 5, ew / 2 - 4, 3, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
      font(ctx, 10.5, i === 2 ? 800 : 600); ctx.fillStyle = i === 2 && S.wrongSide ? '#B91C1C' : '#2A4033'; ctx.textAlign = 'left'; ctx.fillText(n, x + ew + 8, yy + 9);
      yy += 18;
    });
  }

  // частинки над мембраною в полі «розрізу»
  function drawMembrane(c, f, t) {
    const { cx, cy, r } = f, d = S.d, scale = r / 1.6; // мкм → px: поле ≈ 3,2 мкм
    const my = cy + r * 0.15, mh = r * 0.42;
    // мембрана: пориста губка
    c.save();
    const g = c.createLinearGradient(0, my, 0, my + mh); g.addColorStop(0, '#E9E6DA'); g.addColorStop(1, '#CFCAB8');
    c.fillStyle = g; c.fillRect(cx - r, my, 2 * r, mh);
    const pw = Math.max(1.5, d * scale), R = rng(7);
    c.fillStyle = '#F9F7EF';
    for (let x = cx - r; x < cx + r; x += pw * 2.4) { const jit = (R() - 0.5) * pw; c.beginPath(); c.moveTo(x + jit, my); for (let k = 1; k <= 6; k++) c.lineTo(x + jit + Math.sin(k * 1.7 + x) * pw * 0.6, my + mh * k / 6); c.lineWidth = pw; c.strokeStyle = 'rgba(250,248,240,.95)'; c.stroke(); }
    if (S.damaged) { c.fillStyle = 'rgba(250,248,240,1)'; c.fillRect(cx + r * 0.2, my, r * 0.18, mh); }
    c.fillStyle = 'rgba(80,70,40,.18)'; c.fillRect(cx - r, my, 2 * r, 2);
    // рідина над мембраною
    c.fillStyle = 'rgba(235,228,190,.25)'; c.fillRect(cx - r, cy - r, 2 * r, my - (cy - r));
    // частинки: рух униз, затримання за розміром
    const run = phase === 'filt' || phase === 'air' || phase === 'done';
    const R2 = rng(3);
    const list = [{ s: 0.6, n: 7, col: '#C2410C', rod: true }, { s: 0.3, n: 6, col: '#B45309', rod: true }, { s: 2.2, n: 1, col: '#5B7A3A' }, { s: 0.15, n: 5, col: '#7C3AED' }, { s: 0.03, n: 10, col: '#0E7490' }, { s: 0.008, n: 18, col: '#334155' }];
    for (const p of list) {
      const L = lrvEff(p.s, d, S.damaged), passP = Math.pow(10, -L);
      for (let i = 0; i < p.n; i++) {
        const x0 = cx + (R2() - 0.5) * r * 1.6, sp = 0.25 + R2() * 0.3, off = R2();
        const passes = R2() < Math.max(passP, S.damaged && R2() < 0.3 ? 1 : 0);
        let y = cy - r + ((run ? t * sp : 0) + off) % 1 * (r * 1.9);
        if (!passes && y > my - p.s * scale * 0.6) y = my - Math.max(1.5, p.s * scale * 0.5) - (i % 3) * 0.5; // затримано на поверхні
        if (passes && y > my && y < my + mh) c.globalAlpha = 0.75; else c.globalAlpha = 1;
        const sz = Math.max(1.1, p.s * scale * 0.5);
        c.fillStyle = p.col;
        if (p.rod) { c.save(); c.translate(x0, y); c.rotate(off * 3); c.beginPath(); c.ellipse(0, 0, sz * 2.2, sz, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-sz * 0.6, -sz * 0.3, sz * 0.8, sz * 0.3, 0, 0, TAU); c.fill(); c.restore(); }
        else { c.beginPath(); c.arc(x0, y, sz, 0, TAU); c.fill(); }
      }
    }
    c.globalAlpha = 1;
    c.restore();
    // легенда всередині поля
    font(c, Math.max(9, r * 0.09), 700); c.textAlign = 'left';
    const lg = [['бактерії', '#C2410C'], ['мікоплазми', '#7C3AED'], ['молекули', '#334155']];
    lg.forEach(([n, col], i) => { const yy = cy - r * 0.62 + i * r * 0.13; c.fillStyle = col; c.beginPath(); c.arc(cx - r * 0.55, yy - 3, 3, 0, TAU); c.fill(); c.fillStyle = '#26352C'; c.fillText(n, cx - r * 0.48, yy); });
  }

  const runner = new Runner({
    btn: $('.ag-run'), reset: $('[data-act="reset"]'),
    step: (dt, tt, reset) => {
      if (reset) { tm = 0; phase = 'idle'; airT = 0; recalc(); return; }
      if (phase === 'idle') phase = 'filt';
      if (phase === 'filt') { tm += dt * C.T / 10; if (tm >= C.T) { tm = C.T; phase = 'air'; airT = 0; } }
      else if (phase === 'air') { airT += dt; if (airT > 1.6) { phase = 'done'; recalc(); runner.finish(); return; } }
      if (Math.random() < 0.15) recalc(); else draw();
    },
    draw: () => draw(),
  });
  onResize(cv.parentElement, () => draw());
  recalc();
}
