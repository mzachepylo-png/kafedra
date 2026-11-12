// Тема 12, ЛР 51 (пероксидаза) і ЛР 53 (поліфенолоксидаза): кінетичне спектрофотометричне визначення активності.
// Посібник: Мельничук, Кляченко (2014), с. 184–187.
//  ЛР 51 (с. 184–185): кювета 1 см; 0,5 мл гваяколу (183 мг/25 мл) + 1,5 мл 0,15 М фосфатного буфера pH 5,4 +
//    0,5 мл витяжки + 0,5 мл 0,15 % H2O2 → V2 = 3,0 мл; λ = 470 нм; відліки через 20 с протягом 2 хв;
//    A = (D2 − D1)·V·V2·60 / ((t2 − t1)·V1·н), V = 25 мл, н = 0,5 г.
//  ЛР 53 (с. 186–187): 0,5 мл ферменту + 2,0 мл фосфатного буфера pH 7,4 + 0,5 мл 0,05 М пірокатехіну (останнім),
//    λ = 420 нм, відліки через 20 с протягом 1 хв; результат — ΔD за 1 хв на 1 г сирої маси (рахуємо тією ж формулою).
//  Робочі діапазони продуктів (с. 186): пірокатехін 366–420 нм, ДОФА 436–475 нм, хлорогенова кислота 328–400 нм.
// Модельні припущення (не з посібника, позначені в теорії): інактивація ферменту в ході реакції (перший порядок),
// розсіяне світло фотометра 0,4 % (верхня межа лінійності D ≈ 1,5–2), «істинні» активності зразків — навчальні.
import { fit, scene, shadow, roundRect, rng, clamp, lerp, mix, rgba, shade, TAU, Runner, onResize, fnum, Plot, applyGrain, easeInOut } from './kit.js';
import { frame, setRead, setVerdict, setHud, seg, slide, presets, txt, setScale, waveColor, stopwatch, el } from './t12-ui.js';

/* ---------------- Спектри продуктів (відносні, максимум = 1) ---------------- */
const sg = (l, c, hw, p = 2) => Math.exp(-0.5 * Math.pow(Math.abs(l - c) / hw, p));
export const SPECTRA = {
  // тетрагваякол: широка смуга з максимумом 470 нм
  tg: (l) => 0.97 * sg(l, 470, 52) + 0.18 * sg(l, 340, 30),
  // о-бензохінон (пірокатехін): плато 366–420 нм
  cat: (l) => sg(l, 393, 34, 4),
  // дофахром (ДОФА): 436–475 нм
  dopa: (l) => sg(l, 458, 30, 4) + 0.25 * sg(l, 330, 25),
  // хінон хлорогенової кислоти: 328–400 нм
  chl: (l) => sg(l, 364, 44, 4),
  // меланіноподібні полімери хінонів (побуріння) — широке поглинання, що спадає до червоного
  mel: (l) => Math.exp(-(l - 380) / 150),
};

/* ---------------- Конфігурації двох робіт ---------------- */
export const CFG = {
  pox: {
    key: 'pox', lab: 'ЛР 51', enz: 'пероксидази', times: [0, 20, 40, 60, 80, 100, 120], t2: 120,
    kInact: 0.10, // хв⁻¹ — інактивація пероксидази пероксидом (модельне)
    otherVol: 1.0, otherLabel: '0,5 мл гваяколу + 0,5 мл H₂O₂', V2: 3.0, bufferName: '0,15 М фосфатного буфера pH 5,4',
    lastReagent: 'H₂O₂', defaults: { m: 0.5, V: 25, V1: 0.5 },
    materials: [
      { k: 'leaf', name: 'Листок (контроль)', A: 48, note: 'базовий рівень' },
      { k: 'stress', name: 'Листок після посухи', A: 118, note: 'стрес підвищує активність' },
      { k: 'callus', name: 'Калюс', A: 165, note: 'інтенсивна лігніфікація стінок' },
      { k: 'root', name: 'Корінь хрону', A: 820, note: 'дуже активне джерело' },
    ],
    subs: [{ k: 'gua', name: 'Гваякол', lam: 470, spec: SPECTRA.tg, sens: 1, prod: 'тетрагваякол' }],
  },
  ppo: {
    key: 'ppo', lab: 'ЛР 53', enz: 'поліфенолоксидази', times: [0, 20, 40, 60], t2: 60,
    kInact: 0.45, // хв⁻¹ — «суїцидна» інактивація ПФО хінонами (модельне)
    otherVol: 0.5, otherLabel: '0,5 мл субстрату', V2: 3.0, bufferName: 'фосфатного буфера pH 7,4',
    lastReagent: 'субстрат', defaults: { m: 0.5, V: 25, V1: 0.5 },
    materials: [
      { k: 'seedl', name: 'Проростки', A: 62, note: 'базовий рівень' },
      { k: 'callus', name: 'Калюс світлий', A: 95, note: '' },
      { k: 'brown', name: 'Калюс, що буріє', A: 290, note: 'фенольне побуріння' },
      { k: 'potato', name: 'Бульба картоплі', A: 560, note: 'багата на ПФО' },
    ],
    subs: [
      { k: 'cat', name: 'Пірокатехін', lam: 420, spec: SPECTRA.cat, sens: 1, prod: 'о-бензохінон', range: '366–420' },
      { k: 'dopa', name: 'ДОФА', lam: 475, spec: SPECTRA.dopa, sens: 0.7, prod: 'дофахром', range: '436–475' },
      { k: 'chl', name: 'Хлорогенова к-та', lam: 400, spec: SPECTRA.chl, sens: 0.85, prod: 'хінон хлорогенової кислоти', range: '328–400' },
    ],
  },
};

const STRAY = 0.004; // частка розсіяного світла фотометра

/** Повна математика досліду для поточних параметрів (чиста функція — зручно перевіряти числами). */
export function compute(cfg, p) {
  const mat = cfg.materials.find((m) => m.k === p.mat) || cfg.materials[0];
  const sub = cfg.subs.find((s) => s.k === p.sub) || cfg.subs[0];
  const V2 = cfg.V2;
  const fl = sub.spec(p.lam) / sub.spec(sub.lam);           // чутливість на обраній λ відносно робочої
  const v0 = mat.A * p.V1 * p.m / (p.V * V2) * sub.sens;     // ΔD/хв на робочій λ (з формули посібника, обернено)
  const k = cfg.kInact, dead = 3 / 60;                         // 3 с від останньої краплі до першого відліку
  const Dmax = (ts) => { const tm = ts / 60 + dead; return v0 * (1 - Math.exp(-k * tm)) / k; }; // на робочій λ
  const meas = (Dt) => -Math.log10((Math.pow(10, -Dt) + STRAY) / (1 + STRAY));
  const R = rng(11 + cfg.times.length);
  const noise = cfg.times.map(() => (R() - 0.5) * 0.004);
  const reads = cfg.times.map((t, i) => [t, Math.max(0, meas(Dmax(t) * fl) + noise[i])]);
  const curve = []; for (let t = 0; t <= cfg.t2 + 1e-9; t += cfg.t2 / 120) curve.push([t, meas(Dmax(t) * fl)]);
  const D1 = reads[0][1], D2 = reads[reads.length - 1][1], t1 = cfg.times[0], t2 = cfg.t2;
  const A = (D2 - D1) * p.V * V2 * 60 / ((t2 - t1) * p.V1 * p.m);   // формула посібника, с. 184
  const lin = v0 * fl;                                             // ідеальна початкова швидкість, D/хв
  return { mat, sub, fl, v0, Dmax, meas, reads, curve, D1, D2, A, lin, V2, k, buffer: V2 - cfg.otherVol - p.V1, tissue: p.m * p.V1 / p.V };
}

/* ---------------- Колір розчину в кюветі з поглинання ---------------- */
function solColor(spec, Dm, brown = 0) {
  const ch = [610, 545, 462];
  return ch.map((l) => 248 * Math.pow(10, -(Dm * spec(l) + brown * SPECTRA.mel(l)) * 0.9));
}

/* ---------------- Спектрофотометр СФ-46 (2.5D) ---------------- */
function photometer(ctx, r, st) {
  const { x, y, w, h } = r, dx = w * 0.075, dy = -h * 0.26;
  shadow(ctx, x + w * 0.52, y + h + 4, w * 0.62, h * 0.12, 0.35);
  // права бічна грань
  ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + dx, y + dy); ctx.lineTo(x + w + dx, y + h + dy * 0.6); ctx.lineTo(x + w, y + h); ctx.closePath();
  let g = ctx.createLinearGradient(x + w, 0, x + w + dx, 0); g.addColorStop(0, '#A9A595'); g.addColorStop(1, '#8D897B'); ctx.fillStyle = g; ctx.fill();
  // верхня грань
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + dx, y + dy); ctx.lineTo(x + dx, y + dy); ctx.closePath();
  g = ctx.createLinearGradient(0, y + dy, 0, y); g.addColorStop(0, '#E9E5D8'); g.addColorStop(1, '#D6D1C2'); ctx.fillStyle = g; ctx.fill();
  // фронт
  g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#DCD7C8'); g.addColorStop(0.5, '#CFCABA'); g.addColorStop(1, '#B9B4A4');
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 4, y + 1); ctx.lineTo(x + w - 4, y + 1); ctx.stroke();
  // темна панель приладів
  const px = x + w * 0.035, py = y + h * 0.1, pw = w * 0.93, ph = h * 0.66;
  g = ctx.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#3C4743'); g.addColorStop(1, '#2A3330');
  ctx.fillStyle = g; roundRect(ctx, px, py, pw, ph, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
  // стрілковий прилад: шкала T, % і D
  const mx = px + pw * 0.04, my = py + ph * 0.1, mw = pw * 0.46, mh = ph * 0.8;
  g = ctx.createLinearGradient(0, my, 0, my + mh); g.addColorStop(0, '#FBF8EC'); g.addColorStop(1, '#E7E1CC');
  ctx.fillStyle = g; roundRect(ctx, mx, my, mw, mh, 4); ctx.fill();
  const cx = mx + mw / 2, cy = my + mh * 1.02, R = mh * 0.86;
  const ang = (T) => -Math.PI / 2 + (T / 100 - 0.5) * 1.6;
  ctx.save(); ctx.beginPath(); roundRect(ctx, mx, my, mw, mh, 4); ctx.clip();
  ctx.strokeStyle = '#2B332F'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, ang(0), ang(100)); ctx.stroke();
  for (let T = 0; T <= 100; T += 5) {
    const a = ang(T), l = T % 10 ? 0.05 : 0.1;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78); ctx.lineTo(cx + Math.cos(a) * R * (0.78 + l), cy + Math.sin(a) * R * (0.78 + l)); ctx.stroke();
    if (T % 20 === 0) txt(ctx, String(T), cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97, { px: 8.5, align: 'center', base: 'middle', color: '#2B332F' });
  }
  ctx.strokeStyle = '#A23B2A'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.66, ang(0), ang(100)); ctx.stroke();
  for (const D of [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2]) {
    const T = 100 * Math.pow(10, -D), a = ang(T);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66); ctx.lineTo(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6); ctx.stroke();
    if ((st.narrow ? [0, 0.5, 1] : [0, 0.2, 0.5, 1]).includes(D)) txt(ctx, fnum(D, D % 1 ? 1 : 0), cx + Math.cos(a) * R * 0.53, cy + Math.sin(a) * R * 0.53, { px: 8, align: 'center', base: 'middle', color: '#A23B2A' });
  }
  txt(ctx, 'T, %', mx + 6, my + 12, { px: 8.5, color: '#2B332F' });
  txt(ctx, 'D', mx + mw - 6, my + 12, { px: 8.5, color: '#A23B2A', align: 'right', weight: 800 });
  // стрілка
  const a = ang(clamp(st.T, -2, 102));
  ctx.strokeStyle = '#151A18'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92); ctx.stroke();
  ctx.restore();
  // скло приладу
  g = ctx.createLinearGradient(mx, my, mx + mw, my + mh); g.addColorStop(0, 'rgba(255,255,255,.32)'); g.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; roundRect(ctx, mx, my, mw, mh, 4); ctx.fill();
  ctx.strokeStyle = '#151A18'; ctx.lineWidth = 1.5; roundRect(ctx, mx, my, mw, mh, 4); ctx.stroke();
  // вікно довжини хвилі
  const wx = px + pw * 0.56, wy = py + ph * 0.12, ww = pw * 0.24, wh = ph * 0.3;
  ctx.fillStyle = '#0D1411'; roundRect(ctx, wx, wy, ww, wh, 3); ctx.fill();
  const lc = waveColor(st.lam);
  txt(ctx, `${Math.round(st.lam)} нм`, wx + ww / 2, wy + wh / 2 + 1, { px: 12, align: 'center', base: 'middle', font: 'mono', weight: 700, color: '#FFD9A0', max: ww * 0.92 });
  ctx.fillStyle = rgba(lc, 0.9); ctx.fillRect(wx + 4, wy + wh - 4, ww - 8, 2);
  txt(ctx, 'λ', wx - 4, wy + wh / 2 + 1, { px: 10, align: 'right', base: 'middle', color: '#E6EEE9', weight: 700 });
  // ручки
  const knob = (kx, ky, kr, rot) => {
    shadow(ctx, kx + kr * 0.2, ky + kr * 0.9, kr * 1.1, kr * 0.35, 0.4);
    const kg = ctx.createRadialGradient(kx - kr * 0.35, ky - kr * 0.4, kr * 0.1, kx, ky, kr);
    kg.addColorStop(0, '#6E7672'); kg.addColorStop(1, '#151A18'); ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#E9E2C8'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(rot) * kr * 0.8, ky + Math.sin(rot) * kr * 0.8); ctx.stroke();
  };
  const kr = Math.min(ph * 0.13, pw * 0.04);
  knob(wx + ww * 0.2, py + ph * 0.72, kr, -Math.PI / 2 + (st.lam - 470) / 60);
  knob(wx + ww * 0.75, py + ph * 0.72, kr, -2.2);
  txt(ctx, 'нуль', wx + ww * 0.75, py + ph * 0.72 + kr + 11, { px: 8, align: 'center', color: '#C9D3CE' });
  txt(ctx, 'λ', wx + ww * 0.2, py + ph * 0.72 + kr + 11, { px: 8, align: 'center', color: '#C9D3CE' });
  // перемикач і лампочка
  const sx = px + pw * 0.86, sy = py + ph * 0.25;
  ctx.fillStyle = st.on ? '#F2C14E' : '#55605B'; ctx.beginPath(); ctx.arc(sx, sy, kr * 0.42, 0, TAU); ctx.fill();
  if (st.on) { const lg = ctx.createRadialGradient(sx, sy, 0, sx, sy, kr * 1.6); lg.addColorStop(0, 'rgba(255,210,90,.55)'); lg.addColorStop(1, 'rgba(255,210,90,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(sx, sy, kr * 1.6, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#1A201E'; roundRect(ctx, sx - kr * 0.5, py + ph * 0.55, kr, kr * 1.6, 3); ctx.fill();
  ctx.fillStyle = '#C9C3AE'; roundRect(ctx, sx - kr * 0.38, py + ph * 0.58, kr * 0.76, kr * 0.7, 2); ctx.fill();
  // табличка
  const nw = txt(ctx, 'СФ-46', x + w * 0.05, y + h * 0.9, { px: 11, weight: 800, color: '#4A4F48' });
  txt(ctx, 'спектрофотометр', x + w * 0.05 + nw + 6, y + h * 0.9, { px: 9, color: '#5E635B' });
  // кюветне відділення на кришці
  const cw = w * 0.26, ch = -dy * 0.55, cxp = x + w * 0.62 + dx * 0.25, cyp = y + dy * 0.72;
  ctx.fillStyle = '#4A524E'; ctx.beginPath(); ctx.moveTo(cxp, cyp + ch * 0.4); ctx.lineTo(cxp + cw, cyp + ch * 0.4); ctx.lineTo(cxp + cw + dx * 0.3, cyp - ch * 0.15); ctx.lineTo(cxp + dx * 0.3, cyp - ch * 0.15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(cxp + 3, cyp + ch * 0.32, cw - 6, 1.2);
  txt(ctx, 'кюветне відділення', cxp + cw / 2 + dx * 0.15, cyp - ch * 0.15 - 5, { px: 8.5, align: 'center', color: '#4A4F48' });
  applyGrain(ctx, x, y, w, h, 0.05);
  return { lid: [cxp + cw / 2, cyp] };
}

/* ---------------- Кювета (крупно) з ходом променя ---------------- */
function cuvetteInset(ctx, r, st) {
  const { x, y, w, h } = r;
  ctx.save();
  // темне тло кюветного відділення
  let g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#1A2420'); g.addColorStop(1, '#0B110E');
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); roundRect(ctx, x, y, w, h, 14); ctx.clip();
  // кюветотримач
  const cw = Math.min(w * 0.22, h * 0.3), chh = h * 0.62, cx = x + w * 0.5 - cw / 2, cy = y + h * 0.2;
  const by = y + h * 0.84;
  g = ctx.createLinearGradient(0, by, 0, y + h); g.addColorStop(0, '#2E3834'); g.addColorStop(1, '#1A211E');
  ctx.fillStyle = g; ctx.fillRect(x, by, w, y + h - by);
  ctx.fillStyle = '#39443F'; ctx.fillRect(cx - cw * 0.25, cy + chh * 0.3, cw * 1.5, chh * 0.72);
  ctx.fillStyle = '#121815'; ctx.fillRect(cx - cw * 0.12, cy + chh * 0.3, cw * 1.24, chh * 0.72);
  // промінь
  const beamY = cy + chh * 0.66, bw = Math.max(5, h * 0.045), lc = waveColor(st.lam);
  const Tt = Math.pow(10, -st.D);
  const beam = (x0, x1, a) => {
    const bg = ctx.createLinearGradient(0, beamY - bw * 2, 0, beamY + bw * 2);
    bg.addColorStop(0, rgba(lc, 0)); bg.addColorStop(0.5, rgba(lc, a)); bg.addColorStop(1, rgba(lc, 0));
    ctx.fillStyle = bg; ctx.fillRect(x0, beamY - bw * 2, x1 - x0, bw * 4);
    ctx.fillStyle = rgba(shade(lc, 0.6), a); ctx.fillRect(x0, beamY - bw * 0.22, x1 - x0, bw * 0.44);
  };
  // монохроматор (щілина) і фотоелемент
  ctx.fillStyle = '#3A4440'; roundRect(ctx, x + 6, beamY - h * 0.16, w * 0.08, h * 0.32, 4); ctx.fill();
  ctx.fillStyle = '#05080A'; ctx.fillRect(x + 6 + w * 0.08 - 3, beamY - bw * 0.7, 3, bw * 1.4);
  if (st.on) beam(x + 6 + w * 0.08, cx, 0.75);
  if (st.on) beam(cx + cw, x + w * 0.88, 0.75 * Tt + 0.03);
  const fx = x + w * 0.88;
  g = ctx.createLinearGradient(fx, 0, x + w - 6, 0); g.addColorStop(0, '#59645F'); g.addColorStop(1, '#2C3431');
  ctx.fillStyle = g; roundRect(ctx, fx, beamY - h * 0.15, x + w - 6 - fx, h * 0.3, 4); ctx.fill();
  ctx.fillStyle = '#4C3A14'; ctx.fillRect(fx, beamY - bw, 3, bw * 2);
  if (st.on) { ctx.fillStyle = rgba(lc, 0.5 * Tt + 0.08); ctx.fillRect(fx, beamY - bw, 3, bw * 2); }
  // кювета
  shadow(ctx, cx + cw / 2, cy + chh + 2, cw * 0.8, 4, 0.5);
  const lev = cy + chh * 0.25;
  const col = solColor(st.spec, st.Dmax, st.brown);
  ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, chh); ctx.clip();
  ctx.fillStyle = 'rgba(210,230,226,.12)'; ctx.fillRect(cx, cy, cw, chh);
  // рідина
  g = ctx.createLinearGradient(cx, 0, cx + cw, 0);
  g.addColorStop(0, rgba(shade(col, -0.35), 0.95)); g.addColorStop(0.3, rgba(shade(col, 0.05), 0.92)); g.addColorStop(0.75, rgba(col, 0.92)); g.addColorStop(1, rgba(shade(col, -0.4), 0.95));
  ctx.fillStyle = g; ctx.fillRect(cx, lev, cw, cy + chh - lev);
  // крапля / шлейф реагенту при змішуванні
  if (st.mixing > 0) {
    const m = st.mixing;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + m * 6, rr = cw * 0.18 * (1 - m) + 3;
      ctx.fillStyle = rgba(shade(col, -0.2), 0.25 * m);
      ctx.beginPath(); ctx.ellipse(cx + cw / 2 + Math.cos(a) * rr, lev + chh * 0.25 * (1 - m) + Math.sin(a) * rr * 0.6 + 10, rr * 0.6, rr * 0.3, a, 0, TAU); ctx.fill();
    }
  }
  // промінь у рідині: слід розсіювання
  if (st.on) { ctx.fillStyle = rgba(lc, 0.14 + 0.25 * Math.sqrt(Tt)); ctx.fillRect(cx, beamY - bw * 0.5, cw, bw); }
  // меніск
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, lev - 2); ctx.quadraticCurveTo(cx + cw / 2, lev + 2, cx + cw, lev - 2); ctx.stroke();
  // скло: блиски
  g = ctx.createLinearGradient(cx, 0, cx + cw, 0);
  g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.08, 'rgba(255,255,255,.05)'); g.addColorStop(0.16, 'rgba(255,255,255,.45)'); g.addColorStop(0.22, 'rgba(255,255,255,0)'); g.addColorStop(0.86, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,.3)');
  ctx.fillStyle = g; ctx.fillRect(cx, cy, cw, chh);
  ctx.restore();
  ctx.strokeStyle = 'rgba(220,240,235,.7)'; ctx.lineWidth = 1.4; ctx.strokeRect(cx, cy, cw, chh);
  ctx.strokeStyle = 'rgba(220,240,235,.3)'; ctx.strokeRect(cx + 3, cy, cw - 6, chh - 3);
  // матові бічні грані (тримають пальцями)
  ctx.fillStyle = 'rgba(230,236,232,.18)'; ctx.fillRect(cx, cy, 3, chh); ctx.fillRect(cx + cw - 3, cy, 3, chh);
  // піпетка з краплею
  if (st.pip > 0) {
    const p = st.pip, tipY = lerp(y - 10, cy + chh * 0.05, Math.min(1, p * 1.6));
    const px = cx + cw * 0.55;
    g = ctx.createLinearGradient(px - 6, 0, px + 6, 0); g.addColorStop(0, 'rgba(220,235,240,.55)'); g.addColorStop(0.4, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(180,200,205,.55)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px - 5, y - 40); ctx.lineTo(px + 5, y - 40); ctx.lineTo(px + 2, tipY - 14); ctx.lineTo(px + 0.8, tipY); ctx.lineTo(px - 0.8, tipY); ctx.lineTo(px - 2, tipY - 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.8; ctx.stroke();
    if (p > 0.55 && p < 0.95) { const dy = (p - 0.55) / 0.4; ctx.fillStyle = 'rgba(235,245,250,.85)'; ctx.beginPath(); ctx.ellipse(px, lerp(tipY + 4, lev, dy), 2.4, 3.2, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  // підписи
  const sz = w < 260 ? 9.5 : 10.5;
  txt(ctx, 'монохроматор', x + 8, beamY - h * 0.2, { px: sz, color: '#CFE0D7' });
  txt(ctx, 'фотоелемент', x + w - 8, beamY - h * 0.2, { px: sz, color: '#CFE0D7', align: 'right' });
  txt(ctx, `I₀`, (x + 6 + w * 0.08 + cx) / 2, beamY + bw * 2.6 + 8, { px: 11, color: '#F4F7F2', align: 'center', weight: 700 });
  txt(ctx, `I = I₀·10⁻ᴰ`, (cx + cw + fx) / 2, beamY + bw * 2.6 + 8, { px: 10, color: '#F4F7F2', align: 'center', weight: 700 });
  txt(ctx, 'кювета l = 1 см, V₂ = 3,0 мл', cx + cw / 2, cy + chh + 18, { px: sz, color: '#E2ECE6', align: 'center' });
  txt(ctx, 'Кюветне відділення (збільшено)', x + 12, y + 18, { px: 11, color: '#F2C14E', weight: 700 });
  return { cx, cy, cw, chh };
}

/* ---------------- Контроль — клас моделі ---------------- */
export class SpectroModel {
  constructor(host, cfg) {
    this.cfg = cfg;
    const isPox = cfg.key === 'pox';
    this.p = { mat: cfg.materials[0].k, sub: cfg.subs[0].k, lam: cfg.subs[0].lam, ...cfg.defaults };
    if (isPox) this.p.mat = 'stress';
    const F = frame(host, {
      aria: `Спектрофотометр із кюветою: вимірювання оптичної густини продуктів реакції ${cfg.enz}`,
      reads: [
        ['d1', `D₁ (t₁ = 0 с)`], ['d2', `D₂ (t₂ = ${cfg.t2} с)`], ['rate', 'Швидкість ΔD/хв'],
        ['a', `Активність <i>A</i>, відн. од./(г·хв)`], ['sens', 'Чутливість на обраній λ'], ['tis', 'Тканини в кюветі'],
      ],
      panels: ['Зразок і субстрат', 'Наважка й розведення', 'Спектрофотометр'],
      plots: [['kin', 'Кінетика: оптична густина <i>D</i> від часу'], ['spec', 'Спектр поглинання продукту реакції']],
      table: true,
      note: isPox
        ? '<b>D</b> — оптична густина (поглинання світла розчином, D = lg I₀/I); <b>I₀</b> й <b>I</b> — інтенсивність світла до й після кювети. Нуль приладу ставлять за контрольною кюветою без H₂O₂. Формулу й пояснення — у <a href="#t12-pox">теорії</a>.'
        : '<b>ПФО</b> — поліфенолоксидаза; <b>ДОФА</b> — 3,4-дигідроксифенілаланін. Нуль ставлять за дистильованою водою (с. 187). Чому розчин буріє — у <a href="#t12-ppo">теорії</a>.',
    });
    this.F = F;
    // керування
    const [p1, p2, p3] = F.panels;
    seg(p1, 'Рослинний матеріал', cfg.materials.map((m) => ({ value: m.k, label: m.name })), this.p.mat, (v) => { this.p.mat = v; this.update(); });
    if (cfg.subs.length > 1) this.subSeg = seg(p1, 'Субстрат', cfg.subs.map((s) => ({ value: s.k, label: s.name })), this.p.sub, (v) => {
      this.p.sub = v; const s = cfg.subs.find((x) => x.k === v); this.sl.set(cfg.key + '-lam', s.lam, true); this.p.lam = s.lam; this.update();
    });
    else p1.append(el('p', { class: 'ag-note', html: 'Субстрат — <b>гваякол</b> (2-метоксифенол), 183 мг на 25 мл води; продукт — бурий <b>тетрагваякол</b>.' }));
    this.slW = slide(p2, [
      { id: cfg.key + '-m', label: 'Наважка н', min: 0.2, max: 1.0, step: 0.05, value: this.p.m, unit: 'г', digits: 2 },
      { id: cfg.key + '-V', label: 'Об’єм витяжки V', min: 10, max: 50, step: 5, value: this.p.V, unit: 'мл', digits: 0, hint: 'мірна колба, до якої доводять гомогенат' },
      { id: cfg.key + '-V1', label: 'Витяжки в кюветі V₁', min: 0.1, max: 1.0, step: 0.05, value: this.p.V1, unit: 'мл', digits: 2, hint: `буфер доливають так, щоб V₂ = ${fnum(cfg.V2, 1)} мл` },
    ], (id) => { const v = this.slW.values; this.p.m = v[cfg.key + '-m']; this.p.V = v[cfg.key + '-V']; this.p.V1 = v[cfg.key + '-V1']; this.update(); });
    this.sl = slide(p3, [{ id: cfg.key + '-lam', label: 'Довжина хвилі λ', min: 380, max: 600, step: 1, value: this.p.lam, unit: 'нм', digits: 0, hint: 'світлофільтр / монохроматор' }],
      () => { this.p.lam = this.sl.values[cfg.key + '-lam']; this.update(); });
    presets(p3, [[`За посібником (${cfg.subs[0].lam} нм)`, () => {
      const s = cfg.subs[0]; this.p.sub = s.k; this.p.lam = s.lam; this.subSeg?.select(s.k);
      this.slW.set(cfg.key + '-m', cfg.defaults.m, true); this.slW.set(cfg.key + '-V', cfg.defaults.V, true); this.slW.set(cfg.key + '-V1', cfg.defaults.V1, true);
      Object.assign(this.p, cfg.defaults); this.sl.set(cfg.key + '-lam', s.lam, true); this.update();
    }]]);
    // графіки
    this.kin = new Plot(F.plots.kin, { xLabel: 't, с', yLabel: 'D', x: [0, cfg.t2], y: 'auto', xShort: 't', aspect: 1.55 });
    this.spec = new Plot(F.plots.spec, { xLabel: 'λ, нм', yLabel: 'відносне поглинання', x: [340, 620], y: [0, 1.12], xShort: 'λ', aspect: 1.55 });
    // анімація
    this.anim = { phase: 'idle', pip: 0, tm: 0, mixing: 0, T: 100 };
    this.runner = new Runner({ btn: F.run, reset: F.reset, status: F.status, step: (dt, t, rst) => this.step(dt, t, rst), draw: () => this.draw() });
    F.status.textContent = 'Статичний кадр: показано розрахунок. «Запустити» — пройти вимірювання.';
    onResize(F.canvas.parentElement, () => this.draw());
    this.update();
  }

  update() {
    this.m = compute(this.cfg, this.p);
    if (!this.runner.started) { this.anim.T = 100 * Math.pow(10, -this.m.D2); }
    this.renderReads(); this.renderPlots(); this.renderTable(); this.draw();
  }

  /** Поточний модельний час реакції, с (до запуску — кінець досліду). */
  tNow() { return this.runner.started ? this.anim.tm : this.cfg.t2; }

  renderReads() {
    const m = this.m, R = this.F.reads, cfg = this.cfg;
    setRead(R.d1, fnum(m.D1, 3)); setRead(R.d2, fnum(m.D2, 3), m.D2 > 1.2 ? 'bad' : '');
    setRead(R.rate, fnum((m.D2 - m.D1) / (cfg.t2 / 60), 3));
    setRead(R.a, fnum(m.A, 1), m.D2 > 1.2 || m.D2 - m.D1 < 0.05 ? 'bad' : 'ok');
    setRead(R.sens, Math.round(m.fl * 100) + ' %', m.fl < 0.7 ? 'bad' : '');
    setRead(R.tis, fnum(m.tissue * 1000, 1) + ' мг');
    const trueA = m.mat.A * m.sub.sens, err = (m.A - trueA) / trueA * 100;
    const nm = `${cfg.lab}: ${m.mat.name.toLowerCase()}, ${m.sub.name.toLowerCase()}`;
    let html = `<b>${nm}.</b> За формулою посібника <i>A</i> = (${fnum(m.D2, 3)} − ${fnum(m.D1, 3)})·${fnum(this.p.V, 0)}·${fnum(m.V2, 1)}·60 / (${cfg.t2}·${fnum(this.p.V1, 2)}·${fnum(this.p.m, 2)}) = <b>${fnum(m.A, 1)}</b> відн. од. на 1 г сирої маси за 1 хв. `;
    let kind = '';
    if (m.D2 > 1.2) { kind = 'bad'; html += `Оптична густина вийшла за межі лінійності фотометра (D понад ≈ 1): частина світла — розсіяне, крива «лягає», і активність занижено на ${fnum(-err, 0)} %. Розведіть витяжку — зменште V₁ або наважку.`; }
    else if (m.fl < 0.7) { kind = 'warn'; html += `Обрана λ = ${Math.round(this.p.lam)} нм далека від смуги поглинання продукту (${m.sub.prod}): сигнал лише ${Math.round(m.fl * 100)} % від максимуму, тож <i>A</i> занижена. Працюйте на ${m.sub.lam} нм.`; }
    else if (m.D2 - m.D1 < 0.05) { kind = 'warn'; html += 'Приріст D замалий (менше 0,05): похибка відліку стрілкового приладу (± 0,005) стає порівнянною із сигналом. Збільште V₁ або наважку.'; }
    else { html += `Приріст лінійний (${Math.abs(err) < 12 ? 'відхилення від «істинної» активності ' + fnum(Math.abs(err), 0) + ' %' : 'крива вже згинається через інактивацію ферменту'}). Зміна V₁ чи наважки змінює ΔD, але не <i>A</i> — формула їх враховує.`; }
    setVerdict(this.F.verdict, html, kind);
  }

  renderPlots() {
    const m = this.m, cfg = this.cfg, tn = this.tNow();
    const curve = m.curve.filter(([t]) => t <= tn + 1e-6);
    const pts = m.reads.filter(([t]) => t <= tn + 1e-6);
    const lin = [[0, m.D1], [cfg.t2, m.D1 + m.lin * cfg.t2 / 60]];
    this.kin.set([
      { data: lin, color: '#9AA8A0', width: 1.5, dash: [5, 4], label: 'початкова швидкість', noHover: true },
      { data: curve, color: cfg.key === 'pox' ? '#A0522D' : '#B7791F', width: 2.6, label: 'D(t)' },
      { data: pts, type: 'points', color: '#1F5C3A', label: 'відліки через 20 с' },
    ], m.D2 > 1.2 ? [{ y: 1.0, color: '#B23A2A', label: 'межа лінійності' }] : []);
    const ser = [];
    const cols = ['#A0522D', '#8C6A10', '#6D28D9'];
    cfg.subs.forEach((s, i) => {
      const on = s.k === m.sub.k;
      const data = []; for (let l = 340; l <= 620; l += 3) data.push([l, s.spec(l)]);
      ser.push({ data, color: on ? cols[i] : '#C5CEC8', width: on ? 2.6 : 1.4, fill: on ? 'rgba(160,82,45,.12)' : null, label: s.prod + (s.range ? ` (${s.range} нм)` : '') });
    });
    if (cfg.key === 'ppo') { const d = []; for (let l = 340; l <= 620; l += 6) d.push([l, 0.5 * SPECTRA.mel(l)]); ser.push({ data: d, color: '#6B4A2B', dash: [4, 4], width: 1.4, label: 'меланіни (побуріння)' }); }
    this.spec.set(ser, [{ x: this.p.lam, color: rgba(waveColor(this.p.lam)), label: `λ = ${Math.round(this.p.lam)} нм`, dash: [2, 0] }]);
  }

  renderTable() {
    const m = this.m, tn = this.tNow();
    const rows = m.reads.map(([t, D], i) => {
      const shown = t <= tn + 1e-6;
      const dd = i ? D - m.reads[i - 1][1] : NaN;
      return `<tr><td class="num">${t}</td><td class="num">${shown ? fnum(D, 3) : '…'}</td><td class="num">${shown && i ? fnum(dd, 3) : '—'}</td></tr>`;
    }).join('');
    this.F.table.innerHTML = `<table class="ag-table"><thead><tr><th class="num">t, с</th><th class="num">D (λ = ${Math.round(this.p.lam)} нм)</th><th class="num">ΔD за 20 с</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  step(dt, t, reset) {
    const a = this.anim, cfg = this.cfg;
    if (reset) { Object.assign(a, { phase: 'idle', pip: 0, tm: 0, mixing: 0, T: 100 * Math.pow(10, -this.m.D2), shown: -1 }); this.F.status.textContent = 'Статичний кадр: показано розрахунок.'; this.renderPlots(); this.renderTable(); return; }
    if (a.phase === 'idle') { a.phase = 'pip'; a.pip = 0; a.tm = 0; a.T = 100; a.shown = -1; this.renderPlots(); this.renderTable(); }
    if (a.phase === 'pip') {
      a.pip += dt / 1.6;
      this.F.status.textContent = `Вносимо ${cfg.lastReagent} останнім і вмикаємо секундомір…`;
      if (a.pip >= 1) { a.phase = 'react'; a.pip = 0; a.mixing = 1; }
    } else if (a.phase === 'react') {
      a.tm = Math.min(cfg.t2, a.tm + dt * cfg.t2 / 10);
      a.mixing = Math.max(0, a.mixing - dt * 0.8);
      const idx = cfg.times.filter((x) => x <= a.tm + 1e-6).length - 1;
      if (idx !== a.shown) { a.shown = idx; this.renderPlots(); this.renderTable(); }
      this.F.status.textContent = `Реакція: t = ${Math.round(a.tm)} с із ${cfg.t2} с`;
      if (a.tm >= cfg.t2) { a.phase = 'done'; this.renderPlots(); this.renderTable(); this.F.status.textContent = 'Вимірювання завершено — розрахуйте активність за формулою.'; this.runner.finish(); }
    }
    // стрілка приладу з інерцією
    const target = 100 * Math.pow(10, -this.Dmeas());
    a.T += (target - a.T) * (1 - Math.exp(-dt * 7));
  }

  Dmeas() { const m = this.m, tn = this.tNow(); return a0(m.meas(m.Dmax(tn) * m.fl)); function a0(v) { return Math.max(0, v); } }

  draw() {
    const cv = this.F.canvas, narrow = cv.parentElement.clientWidth < 620;
    const { ctx, w, h } = fit(cv, { aspect: narrow ? 0.64 : 1.85, min: 300, max: narrow ? 760 : 560 });
    const DW = narrow ? 560 : 1000, S = w / DW, DH = h / S;
    setScale(S);
    ctx.save(); ctx.scale(S, S);
    const m = this.m, a = this.anim, tn = this.tNow(), cfg = this.cfg;
    const started = this.runner.started;
    const Dm = started ? (a.phase === 'pip' ? 0 : m.Dmax(tn)) : m.Dmax(cfg.t2);
    const Dshown = started && a.phase === 'pip' ? 0 : this.Dmeas();
    const brown = cfg.key === 'ppo' ? 0.18 * Math.pow(Dm, 1.4) : 0;
    const st = { narrow, lam: this.p.lam, T: started ? a.T : 100 * Math.pow(10, -Dshown), on: true, D: Dshown, Dmax: Dm, spec: m.sub.spec, brown, pip: a.phase === 'pip' ? a.pip : 0, mixing: a.mixing };
    const hy = scene(ctx, DW, DH, { kind: 'bench', horizon: narrow ? 0.86 : 0.74, light: 0.3 });
    let inst, inset, watch;
    if (narrow) {
      inset = { x: 14, y: 14, w: DW - 28, h: DH * 0.42 };
      inst = { x: 16, y: hy - DH * 0.25, w: DW * 0.72, h: DH * 0.25 };
      watch = { x: DW * 0.88, y: hy - DH * 0.2, r: DW * 0.065 };
    } else {
      inset = { x: DW * 0.585, y: 18, w: DW * 0.395, h: DH * 0.68 };
      inst = { x: DW * 0.04, y: hy - DH * 0.38, w: DW * 0.46, h: DH * 0.4 };
      watch = { x: DW * 0.9, y: inset.y + inset.h + (DH - inset.y - inset.h) * 0.52, r: Math.min(DH * 0.07, 36) };
    }
    const P = photometer(ctx, inst, st);
    // контрольна кювета в штативі
    const kx = narrow ? DW * 0.86 : DW * 0.66, ky = narrow ? hy + (DH - hy) * 0.6 : hy + (DH - hy) * 0.55;
    ctrlCuvette(ctx, kx, ky, narrow ? 16 : 18, narrow ? 46 : 52);
    txt(ctx, 'контроль', kx + 8, ky + 18, { px: 9.5, align: 'center', color: '#3B4A40' });
    stopwatch(ctx, watch.x, watch.y, watch.r, started ? tn : cfg.t2, { running: a.phase === 'react' });
    txt(ctx, `${Math.floor(tn / 60)}:${String(Math.round(tn % 60)).padStart(2, '0')}`, watch.x, watch.y + watch.r * 1.5 + 6, { px: 11, align: 'center', font: 'mono', weight: 700, color: '#1F3A2A' });
    const C = cuvetteInset(ctx, inset, st);
    // «промінь виноски» від кюветного відділення до вставки
    ctx.strokeStyle = 'rgba(242,193,78,.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(P.lid[0], P.lid[1]); ctx.lineTo(narrow ? inset.x + inset.w * 0.5 : inset.x, narrow ? inset.y + inset.h : inset.y + inset.h * 0.5); ctx.stroke(); ctx.setLineDash([]);
    // підпис продукту біля кювети
    if (Dm > 0.05) txt(ctx, `${m.sub.prod}`, C.cx + C.cw / 2, C.cy - 8, { px: 10, color: '#F4E3C2', weight: 700, align: 'center' });
    ctx.restore();
    setHud(this.F.hud, [`${cfg.lab}`, `λ = ${Math.round(this.p.lam)} нм`, `t = ${Math.round(tn)} с`, `D = ${fnum(Dshown, 3)}`]);
  }
}

function ctrlCuvette(ctx, x, y, w, h) {
  shadow(ctx, x + w / 2, y, w, 3, 0.3);
  ctx.fillStyle = '#5E6A63'; roundRect(ctx, x - 6, y - h * 0.35, w + 12, h * 0.35 + 3, 3); ctx.fill();
  ctx.fillStyle = 'rgba(230,240,236,.35)'; ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = 'rgba(246,243,226,.7)'; ctx.fillRect(x + 1, y - h * 0.72, w - 2, h * 0.72 - 1);
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0.1, 'rgba(255,255,255,.5)'); g.addColorStop(0.3, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y - h, w, h);
  ctx.strokeStyle = 'rgba(70,100,90,.6)'; ctx.lineWidth = 1; ctx.strokeRect(x, y - h, w, h);
  ctx.fillStyle = '#5E6A63'; roundRect(ctx, x - 6, y - h * 0.3, w + 12, h * 0.3 + 3, 3); ctx.fill();
}
