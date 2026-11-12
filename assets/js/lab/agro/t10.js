// Тема 10. Культура ізольованих клітин і тканин у селекції рослин (ЛР 38–40, с. 132–141 посібника
// Мельничук М. Д., Кляченко О. Л. «Біотехнологія в агросфері», 2014).
// А — андрогенез у культурі пиляків ріпаку (ЛР 38, с. 136–137) + подвоєння хромосом колхіцином (с. 134);
// Б — гіногенез цукрового буряка (ЛР 39, с. 137–138);
// В — ембріокультура: порятунок незрілих (гібридних) зародків (ЛР 40, с. 132–133, 139–140).
// Посібник дає протоколи (режими, середовища) і якісні закономірності; кількісні залежності нижче —
// навчальні наближення (Гаусс для «вікна» компетентності, логістичні криві), про що сказано в теорії.
import {
  fit, scene, tube, jar, callus, leaf, plantlet, shadow, roundRect, tagSmall, callout, microField, Runner, onResize, Plot,
  sliders, segmented, fnum, rng, clamp, lerp, smooth, mix, rgba, shade, hex, MAT, TAU, offscreen, noise, applyGrain, $,
} from './kit.js';

const isPhone = () => window.innerWidth < 600;
const sig = (x) => 1 / (1 + Math.exp(-x));
const gauss = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2);
/** Функція розподілу нормального закону (наближення Абрамовіца — Стіган). */
function Phi(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
const pct = (v, d = 0) => fnum(v * 100, d) + ' %';
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function tabs(root) {
  const btns = [...root.querySelectorAll('[role="tab"]')];
  const show = (b) => {
    btns.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; const p = document.getElementById(x.getAttribute('aria-controls')); if (p) p.hidden = !on; });
    window.dispatchEvent(new Event('t10tab'));
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => show(b));
    b.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const j = (i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length; btns[j].focus(); show(btns[j]); });
  });
}
const setOut = (root, k, v) => { const el = root.querySelector(`[data-out="${k}"]`); if (el) el.innerHTML = v; };

/* =====================================================================
   А. АНДРОГЕНЕЗ: КУЛЬТУРА ПИЛЯКІВ РІПАКУ (ЛР 38)
   ---------------------------------------------------------------------
   Стадія розвитку мікроспор s (0 — тетради, 1 — рання одноядерна, 2 — пізня одноядерна вакуолізована,
   3 — двоклітинний пилок, 4 — трьохклітинний) зростає з довжиною бутона L (мм): s̄ = 0,92·(L − 1,6).
   У пиляку стадії асинхронні: s ~ N(s̄, σ = 0,45).
   Компетентність до ембріогенезу c(s) = exp(−(s − 1,1)²/(2·0,45²)) — найвища для ранньої одноядерної
   мікроспори (оптимальна стадія за посібником, с. 136, п. 3). Частка ембріогенних мікроспор у пиляку —
   згортка двох гаусіан: R = σc/√(σc² + σ²) · exp(−(s̄ − 1,1)²/(2(σc² + σ²))).
   Холодова передобробка (+4 °C, оптимум 4 доби — п. 1, с. 136): f_d = 0,3 + 0,7·(d/4)·e^(1 − d/4).
   Температура культивування (+24–27 °C — п. 6, с. 137): f_T = exp(−((T − 25,5)/3,5)²).
   Частка пиляків з морфологічними структурами (ембріоїдами): P_м = 0,45·R·f_d·f_T;
   з калюсом (у т. ч. із соматичних тканин стінки пиляка): P_к = 0,10 + 0,22·f_T + 0,25·P_м/0,45.
   Колхіцин (подвоєння хромосом, с. 134; експозиція 24 год): частка подвоєних p₂ = p_сп + (1 − p_сп)(1 − e^(−c/0,03)),
   p_сп = 0,15 (спонтанна диплоїдизація); надподвоєння (≥ 4n) p₄ = p₂·0,5·(1 − e^(−(c/0,12)²));
   виживання S = 1/(1 + (c/0,15)³).
   ===================================================================== */
const STAGES = [
  { name: 'тетради', col: '#8E6BB0' },
  { name: 'рання одноядерна', col: '#2C8A57' },
  { name: 'пізня одноядерна', col: '#C9A227' },
  { name: 'двоклітинний пилок', col: '#C46A2B' },
  { name: 'трьохклітинний пилок', col: '#7A3B2A' },
];
const SIG_ASYNC = 0.45, MU_C = 1.1, SIG_C = 0.45;
const sBar = (L) => clamp(0.92 * (L - 1.6), -0.5, 4.6);
function stageFractions(L) {
  const m = sBar(L), cuts = [0.5, 1.3, 2.1, 3.1];
  const F = cuts.map((c) => Phi((c - m) / SIG_ASYNC));
  return [F[0], F[1] - F[0], F[2] - F[1], F[3] - F[2], 1 - F[3]];
}
function competence(L) { const m = sBar(L), v = SIG_C ** 2 + SIG_ASYNC ** 2; return SIG_C / Math.sqrt(v) * Math.exp(-((m - MU_C) ** 2) / (2 * v)); }
const fCold = (d) => 0.3 + 0.7 * (d / 4) * Math.exp(1 - d / 4);
const fTemp = (T) => Math.exp(-(((T - 25.5) / 3.5) ** 2));
const R_MAX = SIG_C / Math.sqrt(SIG_C ** 2 + SIG_ASYNC ** 2);
function androModel(p) {
  const R = competence(p.L), fd = fCold(p.cold), fT = fTemp(p.T);
  const Pm = 0.45 * R / R_MAX * fd * fT;
  const Pk = clamp(0.1 + 0.22 * fT + 0.25 * Pm / 0.45, 0, 0.95);
  const emb = Pm * 2.6; // ембріоїдів на пиляк (у середньому 2–3 на чуйний пиляк)
  const ps = 0.15, c = p.colch;
  const p2 = ps + (1 - ps) * (1 - Math.exp(-c / 0.03));
  const p4 = p2 * 0.5 * (1 - Math.exp(-((c / 0.12) ** 2)));
  const S = 1 / (1 + (c / 0.15) ** 3);
  return { R, fd, fT, Pm, Pk, emb, p2, p4, hap: 1 - p2, dh: p2 - p4, S, frac: stageFractions(p.L) };
}

/* ----- малювання мікроспор (ацетокармін: ядра малиново-червоні, цитоплазма рожева) ----- */
function nucleus(ctx, x, y, r, dens = 1) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, `rgba(205,60,95,${0.75 * dens})`); g.addColorStop(0.7, `rgba(150,20,55,${0.9 * dens})`); g.addColorStop(1, `rgba(110,10,40,${0.95 * dens})`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(80,0,25,${0.7 * dens})`; ctx.beginPath(); ctx.arc(x + r * 0.2, y - r * 0.1, r * 0.3, 0, TAU); ctx.fill();
}
function exine(ctx, x, y, r, R, alpha = 1) {
  // сітчаста екзина з трьома борознами (пилок капустяних — трибороздний)
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(150,110,40,.85)'; ctx.lineWidth = Math.max(1.2, r * 0.09); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(120,85,30,.55)';
  const n = Math.round(r * 1.6);
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + R() * 0.1; if (Math.abs(Math.sin(a * 1.5)) < 0.12) continue; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(0.6, r * 0.05), 0, TAU); ctx.fill(); }
  ctx.restore();
}
function cyto(ctx, x, y, r, tone = 0.5) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, `rgba(250,215,220,${0.5 + tone * 0.3})`); g.addColorStop(1, `rgba(215,140,160,${0.55 + tone * 0.35})`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function microspore(ctx, x, y, r, stage, seed) {
  const R = rng(seed);
  if (stage === 0) { // тетрада в калозній оболонці
    ctx.fillStyle = 'rgba(245,235,225,.75)'; ctx.strokeStyle = 'rgba(150,120,110,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, TAU); ctx.fill(); ctx.stroke();
    const rot = R() * TAU;
    for (let k = 0; k < 4; k++) { const a = rot + k * TAU / 4 + (k > 1 ? 0.3 : 0); const cx = x + Math.cos(a) * r * 0.48, cy = y + Math.sin(a) * r * 0.48 * (k > 1 ? 0.6 : 1); cyto(ctx, cx, cy, r * 0.5, 0.6); nucleus(ctx, cx, cy, r * 0.2); }
    return;
  }
  if (stage === 1) { cyto(ctx, x, y, r * 0.85, 0.85); exine(ctx, x, y, r * 0.87, R, 0.5); nucleus(ctx, x + (R() - 0.5) * r * 0.15, y + (R() - 0.5) * r * 0.15, r * 0.3); return; }
  if (stage === 2) { // вакуолізована: велика вакуоля, ядро біля стінки
    cyto(ctx, x, y, r, 0.45); ctx.fillStyle = 'rgba(255,250,248,.75)'; ctx.beginPath(); ctx.arc(x - r * 0.12, y + r * 0.08, r * 0.62, 0, TAU); ctx.fill();
    exine(ctx, x, y, r, R); const a = R() * TAU; nucleus(ctx, x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66, r * 0.22); return;
  }
  if (stage === 3) { // двоклітинний: велике бліде вегетативне ядро + мале щільне генеративне
    cyto(ctx, x, y, r * 1.05, 0.75); exine(ctx, x, y, r * 1.05, R);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 9; i++) { const a = R() * TAU, d = R() * r * 0.7; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.07, 0, TAU); ctx.fill(); }
    nucleus(ctx, x - r * 0.15, y, r * 0.34, 0.45);
    ctx.save(); ctx.translate(x + r * 0.42, y + r * 0.1); ctx.rotate(R() * 2); ctx.scale(1.7, 0.6); nucleus(ctx, 0, 0, r * 0.14, 1.1); ctx.restore();
    return;
  }
  // трьохклітинний зрілий пилок: щільний, крохмаль, два спермії
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, 'rgba(200,120,135,.9)'); g.addColorStop(1, 'rgba(140,60,75,.95)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, TAU); ctx.fill(); exine(ctx, x, y, r * 1.1, R);
  for (let k = 0; k < 2; k++) { ctx.save(); ctx.translate(x + (k ? 0.3 : -0.1) * r, y + (k ? -0.2 : 0.25) * r); ctx.rotate(R() * 3); ctx.scale(1.6, 0.6); nucleus(ctx, 0, 0, r * 0.13, 1.2); ctx.restore(); }
}

/** Поле зору: давлений препарат пиляка в ацетокарміні (кешується, поки не зміниться довжина бутона). */
const fieldCache = new Map();
function microFieldImage(L, size) {
  const key = `${L.toFixed(2)}|${Math.round(size)}`;
  if (fieldCache.has(key)) return fieldCache.get(key);
  const c = offscreen(size, size), x = c.getContext('2d');
  const R = rng(17), m = sBar(L);
  // тло: розчин барвника з уламками тканини стінки пиляка
  const bg = x.createRadialGradient(size * 0.4, size * 0.35, size * 0.05, size / 2, size / 2, size * 0.75);
  bg.addColorStop(0, '#FBEDEB'); bg.addColorStop(1, '#EBCFD0'); x.fillStyle = bg; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(190,120,135,${0.05 + R() * 0.1})`; x.beginPath(); x.ellipse(R() * size, R() * size, 4 + R() * 14, 2 + R() * 6, R() * 3, 0, TAU); x.fill(); }
  const r0 = size * 0.06;
  const pts = [];
  for (let tries = 0; tries < 900 && pts.length < 42; tries++) {
    const px = r0 + R() * (size - 2 * r0), py = r0 + R() * (size - 2 * r0);
    if (pts.every(([qx, qy]) => Math.hypot(qx - px, qy - py) > r0 * 2.35)) pts.push([px, py]);
  }
  const cuts = [0.5, 1.3, 2.1, 3.1];
  pts.forEach(([px, py], i) => {
    // стадія кожної мікроспори — вибірка з N(s̄, σ)
    const u = R(), v = R(), z = Math.sqrt(-2 * Math.log(u + 1e-9)) * Math.cos(TAU * v);
    const s = m + SIG_ASYNC * z;
    const st = cuts.filter((cc) => s >= cc).length;
    const rr = r0 * [1.05, 0.85, 1.0, 1.05, 1.05][st] * (0.92 + R() * 0.16);
    microspore(x, px, py, rr, st, 40 + i);
  });
  fieldCache.set(key, c);
  if (fieldCache.size > 40) fieldCache.delete(fieldCache.keys().next().value);
  return c;
}

/* ----- суцвіття ріпаку з бутонами різної довжини ----- */
const BUDS = [1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.3, 4.9, 5.6]; // мм, згори донизу
function drawRaceme(ctx, x, y, w, h, L, frost) {
  ctx.save();
  // стебло китиці
  const sx = x + w * 0.42, top = y + h * 0.06, bot = y + h * 0.98;
  ctx.strokeStyle = '#5E8F3A'; ctx.lineWidth = Math.max(3, w * 0.035); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, bot); ctx.bezierCurveTo(sx - w * 0.05, y + h * 0.6, sx + w * 0.06, y + h * 0.3, sx, top); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth *= 0.3; ctx.stroke();
  let best = 0; BUDS.forEach((b, i) => { if (Math.abs(b - L) < Math.abs(BUDS[best] - L)) best = i; });
  const scale = h / 70; // px на мм для бутонів (збільшено ×~4 відносно стебла)
  BUDS.forEach((b, i) => {
    const t = (i + 0.6) / (BUDS.length + 1.2);
    const by = lerp(top + 6, y + h * 0.78, t);
    const side = i % 2 ? 1 : -1;
    const bx = sx + side * (w * 0.1 + b * scale * 0.7);
    // квітконіжка
    ctx.strokeStyle = '#6E9E45'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx, by + 6); ctx.quadraticCurveTo((sx + bx) / 2, by + 8, bx, by + 2); ctx.stroke();
    const bl = Math.max(4, b * scale * 1.45), bw = bl * 0.55;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(-Math.PI / 2 + side * 0.35);
    const g = ctx.createLinearGradient(0, -bw / 2, 0, bw / 2);
    const yel = smooth(4.2, 5.8, b);
    const base = mix('#7DB04A', '#E9D55A', yel);
    g.addColorStop(0, rgba(shade(base, 0.35))); g.addColorStop(0.5, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.3)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(bl * 0.5, 0, bl * 0.5, bw / 2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,80,30,.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bl * 0.1, 0); ctx.quadraticCurveTo(bl * 0.55, bw * 0.15, bl * 0.95, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(bl * 0.45, -bw * 0.22, bl * 0.25, bw * 0.08, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (i === best) {
      ctx.strokeStyle = '#F2C94C'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(bx, by - bl * 0.45, bl * 0.75 + 4, 0, TAU); ctx.stroke();
      tagSmall(ctx, bx + side * (bl * 0.8 + 8), by - bl * 0.4, `${fnum(b, 1)} мм`, { align: side > 0 ? 'left' : 'right', size: 11.5, weight: 800, color: '#173322', bg: 'rgba(255,248,220,.95)' });
    }
  });
  // розкриті квітки внизу
  for (let k = 0; k < 2; k++) {
    const fx = sx + (k ? 1 : -1) * w * 0.26, fy = y + h * 0.9 - k * 8;
    for (let p = 0; p < 4; p++) { const a = p * TAU / 4 + 0.6; ctx.fillStyle = '#F2D43D'; ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * 7, fy + Math.sin(a) * 7, 7, 4.5, a, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#C7A419'; ctx.beginPath(); ctx.arc(fx, fy, 2.6, 0, TAU); ctx.fill();
  }
  if (frost > 0) { ctx.fillStyle = `rgba(200,225,255,${0.35 * frost})`; ctx.fillRect(x, y, w, h); const R = rng(3); ctx.fillStyle = `rgba(255,255,255,${0.7 * frost})`; for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.arc(x + R() * w, y + R() * h, 0.6 + R() * 1.4, 0, TAU); ctx.fill(); } }
  ctx.restore();
}

/* ----- пеніциліновий флакончик з пиляками ----- */
function vial(ctx, x, y, w, h, contents, cap = 'foil') {
  shadow(ctx, x + w / 2 + w * 0.08, y + h + 1, w * 0.62, w * 0.12, 0.32);
  const neck = w * 0.62, nh = h * 0.16, r = w * 0.16;
  const body = () => { ctx.beginPath(); ctx.moveTo(x + (w - neck) / 2, y); ctx.lineTo(x + (w - neck) / 2, y + nh); ctx.quadraticCurveTo(x, y + nh * 1.1, x, y + nh * 1.9); ctx.lineTo(x, y + h - r); ctx.quadraticCurveTo(x, y + h, x + r, y + h); ctx.lineTo(x + w - r, y + h); ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r); ctx.lineTo(x + w, y + nh * 1.9); ctx.quadraticCurveTo(x + w, y + nh * 1.1, x + (w + neck) / 2, y + nh); ctx.lineTo(x + (w + neck) / 2, y); ctx.closePath(); };
  ctx.save(); body(); ctx.fillStyle = 'rgba(225,240,235,.28)'; ctx.fill(); ctx.clip();
  const surf = y + h * 0.66;
  const ag = ctx.createLinearGradient(x, 0, x + w, 0); ag.addColorStop(0, 'rgba(198,188,140,.92)'); ag.addColorStop(0.3, 'rgba(246,240,214,.9)'); ag.addColorStop(1, 'rgba(192,182,136,.92)');
  ctx.fillStyle = ag; ctx.fillRect(x, surf, w, h);
  ctx.strokeStyle = 'rgba(255,255,245,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x + w / 2, surf, w / 2, Math.max(2, w * 0.07), 0, Math.PI, TAU); ctx.stroke();
  contents(ctx, { x, y, w, h, surf });
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(40,70,60,.3)'); g.addColorStop(0.1, 'rgba(255,255,255,.06)'); g.addColorStop(0.18, 'rgba(255,255,255,.6)'); g.addColorStop(0.27, 'rgba(255,255,255,.06)'); g.addColorStop(0.82, 'rgba(255,255,255,.04)'); g.addColorStop(0.9, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(40,70,60,.32)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save(); body(); ctx.strokeStyle = 'rgba(70,100,90,.6)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  // фольгова кришечка
  const fx = x + (w - neck) / 2 - 2, fg = ctx.createLinearGradient(fx, 0, fx + neck + 4, 0);
  fg.addColorStop(0, '#8E979B'); fg.addColorStop(0.25, '#F4F6F7'); fg.addColorStop(0.5, '#B7BEC2'); fg.addColorStop(0.75, '#E8ECEE'); fg.addColorStop(1, '#7C8589');
  ctx.fillStyle = fg; roundRect(ctx, fx, y - nh * 0.55, neck + 4, nh * 1.15, 3); ctx.fill();
  return surf;
}
function anther(ctx, x, y, len, ang, { emb = 0, cal = 0, age = 0, seed = 1 } = {}) {
  const R = rng(seed);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const wd = len * 0.36;
  const col = mix('#D9D46A', '#9C8B4A', age * 0.6);
  const g = ctx.createLinearGradient(0, -wd, 0, wd); g.addColorStop(0, rgba(shade(col, 0.35))); g.addColorStop(0.5, rgba(col)); g.addColorStop(1, rgba(shade(col, -0.35)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, len / 2, wd / 2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(shade(col, -0.45), 0.7); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-len * 0.45, 0); ctx.lineTo(len * 0.45, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-len * 0.05, -wd * 0.22, len * 0.3, wd * 0.08, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (cal > 0.02) callus(ctx, x + Math.cos(ang) * len * 0.3, y - 1, 4 + cal * len * 0.45, { color: '#EDE5C0', friable: 0.6, seed: seed + 5 });
  // ембріоїди, що проривають стінку пиляка
  for (let k = 0; k < Math.ceil(emb); k++) {
    const f = clamp(emb - k, 0, 1);
    const ex = x + Math.cos(ang) * (R() - 0.5) * len * 0.7, ey = y - wd * 0.2;
    const eh = (3 + f * len * 0.6) * (0.75 + R() * 0.45), a = -Math.PI / 2 + (R() - 0.5) * 1.3;
    embryoShape(ctx, ex, ey, eh, a, f, '#F4EED8');
  }
}
/** Ембріоїд / зародок: глобулярний → серцеподібний → торпедо → сім'ядольний (phase 0..1). */
function embryoShape(ctx, x, y, len, ang, phase, color = '#E9EFC9', green = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2);
  const c = mix(color, '#7DB54C', green);
  const gr = (r, cx, cy) => { const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.1); g.addColorStop(0, rgba(shade(c, 0.4))); g.addColorStop(0.6, rgba(c)); g.addColorStop(1, rgba(shade(c, -0.35))); return g; };
  if (phase < 0.3) { const r = len * 0.42; ctx.fillStyle = gr(r, 0, -r); ctx.beginPath(); ctx.arc(0, -r, r, 0, TAU); ctx.fill(); }
  else if (phase < 0.55) { // серцеподібний
    const r = len * 0.32; ctx.fillStyle = gr(len * 0.5, 0, -len * 0.5);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-len * 0.55, -len * 0.25, -len * 0.55, -len, -r * 0.6, -len); ctx.quadraticCurveTo(0, -len * 0.8, r * 0.6, -len); ctx.bezierCurveTo(len * 0.55, -len, len * 0.55, -len * 0.25, 0, 0); ctx.fill();
  } else if (phase < 0.8) { // торпедо
    ctx.fillStyle = gr(len * 0.5, 0, -len * 0.5);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-len * 0.2, -len * 0.3, -len * 0.25, -len * 0.9, -len * 0.12, -len); ctx.quadraticCurveTo(0, -len * 0.92, len * 0.12, -len); ctx.bezierCurveTo(len * 0.25, -len * 0.9, len * 0.2, -len * 0.3, 0, 0); ctx.fill();
  } else { // сім'ядольний: вісь + дві сім'ядолі
    ctx.strokeStyle = rgba(shade(c, -0.1)); ctx.lineWidth = len * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * 0.55); ctx.stroke();
    for (const s of [-1, 1]) { ctx.fillStyle = gr(len * 0.3, s * len * 0.18, -len * 0.75); ctx.beginPath(); ctx.ellipse(s * len * 0.17, -len * 0.75, len * 0.13, len * 0.28, s * 0.35, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function initA() {
  const root = $('t10a');
  if (!root) return;
  const cv = $('t10a-cv'), hud = $('t10a-hud');
  const st = { L: 2.8, cold: 4, T: 25, N: 60, colch: 0.05, phase: 'idle', t: 0 };
  // t: 0..1 — холод (4 «доби» за 2 с), 1..31 — доби культури
  const sl = sliders($('t10a-sl'), [
    { id: 'L', label: 'Довжина бутона', min: 1.4, max: 5.6, step: 0.1, value: st.L, unit: 'мм', hint: 'Визначає стадію мікроспор у пиляках' },
    { id: 'cold', label: 'Холодова передобробка +4 °C', min: 0, max: 10, step: 1, value: st.cold, unit: 'діб', hint: 'За посібником — 4 доби (с. 136)' },
    { id: 'T', label: 'Температура культивування', min: 18, max: 33, step: 0.5, value: st.T, unit: '°C', hint: 'За посібником — +24…27 °C, 2000 лк, 14 год' },
    { id: 'N', label: 'Висаджено пиляків', min: 20, max: 200, step: 10, value: st.N, unit: 'шт.' },
    { id: 'colch', label: 'Колхіцин (24 год)', min: 0, max: 0.2, step: 0.01, value: st.colch, unit: '%', digits: 2, hint: 'Подвоєння хромосом у регенерантів (с. 134)' },
  ], (id) => { st[id] = sl.values[id]; refresh(); });
  const presets = $('t10a-pre');
  [['Оптимум ЛР 38', { L: 2.8, cold: 4, T: 25 }], ['Зарано: тетради', { L: 1.6, cold: 4, T: 25 }], ['Запізно: пилок', { L: 5.0, cold: 4, T: 25 }], ['Без холоду', { L: 2.8, cold: 0, T: 25 }]].forEach(([lab, v]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--outline btn--sm'; b.textContent = lab;
    b.addEventListener('click', () => { Object.entries(v).forEach(([k, x]) => { st[k] = x; sl.set(k, x, true); }); refresh(); });
    presets.append(b);
  });

  const p1 = new Plot($('t10a-p1'), { xLabel: 'Довжина бутона, мм', yLabel: 'Частка мікроспор, %', x: [1.4, 5.6], y: [0, 100], xShort: 'L', aspect: 1.5 });
  const p2 = new Plot($('t10a-p2'), { xLabel: 'Довжина бутона, мм', yLabel: 'Пиляків з ембріоїдами, %', x: [1.4, 5.6], xShort: 'L', aspect: 1.5 });
  const p3 = new Plot($('t10a-p3'), { xLabel: 'Покоління самозапилення k', yLabel: 'Гомозиготних рослин, %', x: [0, 10], y: [0, 100], xShort: 'k', aspect: 1.5 });

  let lay = null;
  function layout(w, h) {
    if (w >= 520) return { race: { x: 8, y: 40, w: w * 0.24, h: h - 56 }, mic: { cx: w * 0.465, cy: h * 0.47, r: Math.min(w * 0.18, h * 0.36) }, vial: { x: w * 0.67, y: h * 0.34, w: w * 0.3, h: h * 0.5 } };
    return { race: { x: 6, y: 74, w: w * 0.44, h: h * 0.4 }, mic: { cx: w / 2, cy: h * 0.73, r: Math.min(w * 0.33, h * 0.2) }, vial: { x: w * 0.56, y: 84, w: w * 0.36, h: h * 0.29 } };
  }
  function draw() {
    const { ctx, w, h } = fit(cv, { aspect: isPhone() ? 0.68 : 1.5, min: 340, max: 560 });
    if (w < 80) return;
    lay = layout(w, h);
    scene(ctx, w, h, { kind: 'bench', horizon: 0.88, light: 0.4 });
    const m = androModel(st);
    const frost = st.phase === 'cold' ? Math.sin(Math.PI * clamp(st.t, 0, 1)) : 0;
    drawRaceme(ctx, lay.race.x, lay.race.y, lay.race.w, lay.race.h, st.L, frost);
    // поле зору мікроскопа
    const M = lay.mic;
    microField(ctx, M.cx, M.cy, M.r, (c, f) => { const img = microFieldImage(st.L, Math.round(f.r * 2)); c.drawImage(img, f.cx - f.r, f.cy - f.r, f.r * 2, f.r * 2); }, { mode: 'bright', scale: { px: M.r * 0.35, text: '20 мкм' } });
    const dom = m.frac.indexOf(Math.max(...m.frac));
    tagSmall(ctx, M.cx, M.cy + M.r + 24, `ацетокармін · ${STAGES[dom].name}`, { size: 11.5, weight: 700, color: '#173322', bg: 'rgba(255,255,255,.88)' });
    // флакончик з пиляками
    const V = lay.vial, day = st.phase === 'culture' || st.phase === 'done' ? clamp(st.t - 1, 0, 30) : 0;
    const prog = sig((day - 18) / 3) - sig(-6), progC = sig((day - 12) / 3) - sig(-4);
    vial(ctx, V.x, V.y, V.w, V.h, (c, inn) => {
      const R = rng(9); const n = 4;
      for (let k = 0; k < n; k++) {
        const ax = inn.x + inn.w * (k % 2 ? 0.64 : 0.33) + (k > 1 ? inn.w * 0.04 : 0), ay = inn.surf + (k > 1 ? inn.h * 0.12 : inn.h * 0.04);
        const isEmb = R() < m.Pm * 1.6, isCal = R() < m.Pk;
        anther(c, ax, ay, inn.w * 0.3, (R() - 0.5) * 0.6, { emb: isEmb ? prog * (1 + m.emb) : 0, cal: isCal ? progC : 0, age: day / 30, seed: 30 + k });
      }
    });
    tagSmall(ctx, V.x + V.w / 2, V.y + V.h + 18, 'пиляки на середовищі', { size: 11, weight: 700, color: '#22382A' });
    const phaseTxt = st.phase === 'cold' ? `Холод +4 °C: доба ${Math.min(st.cold, Math.round(st.t * st.cold))} / ${st.cold}` : `Культура: доба ${Math.round(day)} / 30`;
    hud.innerHTML = `<span>${phaseTxt}</span><span>${fnum(st.T, 1)} °C · 2000 лк</span>`;
  }

  function updateReads() {
    const m = androModel(st);
    const day = st.phase === 'culture' || st.phase === 'done' ? clamp(st.t - 1, 0, 30) : 0;
    const shown = day >= 25 || st.phase === 'done';
    const nM = Math.round(st.N * m.Pm), nK = Math.round(st.N * m.Pk);
    setOut(root, 'stage', STAGES[m.frac.indexOf(Math.max(...m.frac))].name);
    setOut(root, 'uni', pct(m.frac[1] + m.frac[2]));
    setOut(root, 'comp', pct(m.R / R_MAX));
    setOut(root, 'morph', shown ? `${nM} шт. · ${pct(m.Pm, 1)}` : `очікується ${pct(m.Pm, 1)}`);
    setOut(root, 'cal', shown ? `${nK} шт. · ${pct(m.Pk, 1)}` : `очікується ${pct(m.Pk, 1)}`);
    setOut(root, 'ploidy', `n ${pct(m.hap)} · 2n ${pct(m.dh)} · ≥4n ${pct(m.p4)}`);
    // таблиця 11 посібника
    const tb = $('t10a-table');
    if (tb) tb.innerHTML = `<tr><td>1</td><td>ріпак (модель)</td><td class="num">${st.N}</td><td class="num">${shown ? nK : '…'}</td><td class="num">${shown ? fnum(nK / st.N * 100, 1) : '…'}</td><td class="num">${shown ? nM : '…'}</td><td class="num">${shown ? fnum(nM / st.N * 100, 1) : '…'}</td></tr>`;
    // графіки
    const xs = []; for (let L = 1.4; L <= 5.6001; L += 0.05) xs.push(L);
    const series = STAGES.map((S, i) => ({ data: xs.map((L) => [L, stageFractions(L)[i] * 100]), color: S.col, width: 2, label: S.name }));
    series.push({ data: xs.map((L) => [L, competence(L) / R_MAX * 100]), color: '#173322', width: 2.6, dash: [6, 4], label: 'компетентність' });
    p1.set(series, [{ x: st.L, color: '#B08A1E', label: 'бутон' }]);
    const s2 = [0, 4, 8].map((d, i) => ({ data: xs.map((L) => [L, androModel({ ...st, L, cold: d }).Pm * 100]), color: ['#9AA79B', '#2C7A4D', '#2A6A93'][i], width: d === 4 ? 3 : 1.8, dash: d === 4 ? null : [5, 4], label: `холод ${d} діб` }));
    s2.push({ data: [[st.L, m.Pm * 100]], type: 'points', color: '#C47A12', r: 6, label: 'ваш варіант' });
    p2.set(s2);
    const ks = []; for (let k = 0; k <= 10; k++) ks.push(k);
    const loci = [1, 5, 20];
    const s3 = loci.map((nl, i) => ({ data: ks.map((k) => [k, Math.pow(1 - Math.pow(0.5, k), nl) * 100]), color: ['#9AA79B', '#2A6A93', '#7A3FA0'][i], width: 2, label: `самозапилення, ${nl} ${nl === 1 ? 'локус' : 'локусів'}` }));
    s3.push({ data: [[1, 100]], type: 'points', color: '#C47A12', r: 6, label: 'DH (дигаплоїд), 1 покоління' });
    p3.set(s3);
    // вердикт
    const v = $('t10a-verdict');
    let txt, cls = '';
    if (sBar(st.L) < 0.5) { txt = `<b>Зарано.</b> У бутоні ${fnum(st.L, 1)} мм пиляки містять переважно тетради мікроспор — вони ще не відокремилися й не здатні переключитися на ембріогенез.`; cls = ' is-warn'; }
    else if (sBar(st.L) > 2.4) { txt = `<b>Запізно.</b> У бутоні ${fnum(st.L, 1)} мм переважає ${STAGES[m.frac.indexOf(Math.max(...m.frac))].name}: мікроспора вже пройшла перший мітоз і «запрограмована» на утворення гамет, накопичує крохмаль. Вихід ембріоїдів різко падає.`; cls = ' is-bad'; }
    else txt = `<b>Вдалий вибір бутона:</b> ${pct(m.frac[1] + m.frac[2])} мікроспор одноядерні, з них ${pct(m.frac[1])} — на ранній стадії, оптимальній для андрогенезу (с. 136). Очікувано ${pct(m.Pm, 1)} пиляків з морфологічними структурами.`;
    if (st.cold === 0) txt += ' Без холодової передобробки мікроспори рідше переключаються з гаметофітного на спорофітний шлях розвитку.';
    if (m.fT < 0.6) { txt += ` Температура ${fnum(st.T, 1)} °C поза рекомендованими +24…27 °C — ріст пригнічений.`; if (!cls) cls = ' is-warn'; }
    txt += st.colch === 0 ? ' Без колхіцину більшість регенерантів залишаться гаплоїдними (стерильними).' : st.colch > 0.12 ? ` Колхіцин ${fnum(st.colch, 2)} % — передозування: частина рослин гине (виживання ${pct(m.S)}), з'являються тетраплоїди.` : ` Колхіцин ${fnum(st.colch, 2)} % подвоїть набір хромосом у ${pct(m.p2)} регенерантів — отримаємо фертильні гомозиготні дигаплоїди.`;
    v.innerHTML = txt; v.className = 'ag-verdict' + cls;
  }
  function refresh() { draw(); updateReads(); }
  const runner = new Runner({
    btn: $('t10a-run'), reset: $('t10a-reset'),
    step: (dt, t, reset) => {
      if (reset) { st.phase = 'idle'; st.t = 0; $('t10a-status').textContent = ''; updateReads(); return; }
      if (st.phase === 'idle' || st.phase === 'done') { st.phase = st.cold > 0 ? 'cold' : 'culture'; st.t = st.cold > 0 ? 0 : 1; }
      const prevDay = Math.floor(st.t);
      st.t += st.phase === 'cold' ? dt / 2 : dt * 30 / 9;
      if (st.phase === 'cold' && st.t >= 1) { st.phase = 'culture'; st.t = 1; }
      $('t10a-status').textContent = st.phase === 'cold' ? 'Холодова передобробка бутонів…' : `Культура пиляків, доба ${Math.round(st.t - 1)}`;
      if (Math.floor(st.t) !== prevDay) updateReads();
      if (st.t >= 31) { st.t = 31; st.phase = 'done'; $('t10a-status').textContent = '25–30 доба: облік калюсу й ембріоїдів (табл. 11).'; runner.finish(); updateReads(); }
    },
    draw,
  });
  onResize(cv.parentElement, refresh);
  window.addEventListener('t10tab', () => { if (!root.closest('[hidden]')) refresh(); });
  refresh();
}

/* =====================================================================
   Б. ГІНОГЕНЕЗ ЦУКРОВОГО БУРЯКА (ЛР 39)
   ---------------------------------------------------------------------
   Стан зародкового мішка залежить від доби відносно розкриття квітки d (d < 0 — до цвітіння).
   Найкраще — повністю диференційований 7-клітинний мішок (яйцеклітина, 2 синергіди, 3 антиподи + центральна
   клітина; с. 137): компетентність g(d) = exp(−((d + 1,5)/1,6)²).
   Стерилізація діоцидом t хв (за посібником 10 хв, с. 138): інфікованих p_інф = 0,03 + 0,6·e^(−t/3,5);
   пошкодження тканин — виживання s = 1/(1 + (t/18)³).
   Калюс P_к = 0,35·s·(0,4 + 0,6·g); морфогенні структури P_м = 0,14·s·g (частки від асептичних експлантатів).
   ===================================================================== */
function gynoModel(p) {
  const g = Math.exp(-(((p.d + 1.5) / 1.6) ** 2));
  const inf = 0.03 + 0.6 * Math.exp(-p.ster / 3.5);
  const s = 1 / (1 + (p.ster / 18) ** 3);
  const Pk = 0.35 * s * (0.4 + 0.6 * g), Pm = 0.14 * s * g;
  const asept = Math.round(p.N * (1 - inf));
  return { g, inf, s, Pk, Pm, asept, nK: Math.round(asept * Pk), nM: Math.round(asept * Pm) };
}
function sacStage(d) { return d < -5 ? 0 : d < -4 ? 1 : d < -3 ? 2 : d < 0.5 ? 3 : 4; } // 0 мегаспороцит, 1 — 2-ядерний, 2 — 4-ядерний, 3 — зрілий 7-клітинний, 4 — дегенерація

function initB() {
  const root = $('t10b');
  if (!root) return;
  const cv = $('t10b-cv'), hud = $('t10b-hud');
  const st = { d: -2, ster: 10, N: 40, t: 0, phase: 'idle' };
  const sl = sliders($('t10b-sl'), [
    { id: 'd', label: 'Ізоляція відносно цвітіння (− до, + після)', min: -7, max: 2, step: 0.5, value: st.d, unit: '', digits: 1, format: (v) => (v === 0 ? 'день цвітіння' : v < 0 ? `−${fnum(-v, 1)} доби` : `+${fnum(v, 1)} доби`), hint: 'Кастрація — за 2–3 дні до цвітіння (с. 138)' },
    { id: 'ster', label: 'Стерилізація діоцидом', min: 2, max: 25, step: 1, value: st.ster, unit: 'хв', hint: 'За посібником — 10 хв + 3 промивання по 10 хв' },
    { id: 'N', label: 'Експлантатів (стовпчиків маточки)', min: 10, max: 100, step: 5, value: st.N, unit: 'шт.' },
  ], (id) => { st[id] = sl.values[id]; refresh(); });
  const p1 = new Plot($('t10b-p1'), { xLabel: 'Доба відносно цвітіння', yLabel: 'Частка, %', x: [-7, 2], y: [0, 100], xShort: 'd', aspect: 1.5 });
  const p2 = new Plot($('t10b-p2'), { xLabel: 'Стерилізація, хв', yLabel: 'Частка, %', x: [2, 25], y: [0, 100], xShort: 't', aspect: 1.5 });

  function drawSac(ctx, cx, cy, r, d) {
    microField(ctx, cx, cy, r, (c, f) => {
      // насіннєвий зачаток: інтегументи, нуцелус, зародковий мішок (просвітлений препарат)
      c.save(); c.translate(f.cx, f.cy); c.rotate(-0.25);
      const R = rng(5);
      const ow = f.r * 0.62, oh = f.r * 0.92;
      const ig = c.createRadialGradient(-ow * 0.3, -oh * 0.3, 5, 0, 0, oh);
      ig.addColorStop(0, '#E8E2C6'); ig.addColorStop(1, '#BDB38C');
      c.fillStyle = ig; c.beginPath(); c.ellipse(0, 0, ow, oh, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(110,100,60,.35)'; c.lineWidth = 1;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(0, 0, ow * (0.92 - k * 0.1), oh * (0.94 - k * 0.07), 0, -Math.PI * 0.42, Math.PI * 1.42); c.stroke(); }
      // клітинна сітка нуцелуса
      c.strokeStyle = 'rgba(120,110,70,.22)';
      for (let i = 0; i < 70; i++) { const a = R() * TAU, rr = Math.sqrt(R()) * 0.7; c.beginPath(); c.arc(Math.cos(a) * ow * rr, Math.sin(a) * oh * rr, 4 + R() * 4, 0, TAU); c.stroke(); }
      // мікропіле (вгорі)
      c.fillStyle = '#F7F2E2'; c.beginPath(); c.ellipse(0, -oh * 0.97, ow * 0.08, oh * 0.08, 0, 0, TAU); c.fill();
      const stg = sacStage(d);
      const sw = ow * 0.38, sh = oh * (stg === 0 ? 0.22 : stg === 1 ? 0.4 : 0.6);
      const sg = c.createRadialGradient(0, -sh * 0.2, 2, 0, 0, sh);
      sg.addColorStop(0, 'rgba(255,253,244,.95)'); sg.addColorStop(1, 'rgba(230,224,196,.9)');
      c.fillStyle = sg; c.beginPath(); c.ellipse(0, -oh * 0.08, sw, sh, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(120,100,60,.6)'; c.lineWidth = 1.2; c.stroke();
      const N = (x, y, rr, col = '#6E5A2E') => { const g = c.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0.5, x, y, rr); g.addColorStop(0, shadeCss(col, 0.4)); g.addColorStop(1, col); c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill(); };
      const cell = (x, y, rx, ry, col) => { c.fillStyle = col; c.strokeStyle = 'rgba(110,90,50,.55)'; c.lineWidth = 0.9; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.stroke(); };
      const top = -oh * 0.08 - sh, bot = -oh * 0.08 + sh;
      if (stg === 0) N(0, -oh * 0.08, sw * 0.4);
      else if (stg === 1) { N(0, top + sh * 0.35, sw * 0.28); N(0, bot - sh * 0.35, sw * 0.28); }
      else if (stg === 2) { for (const yy of [top + sh * 0.25, bot - sh * 0.25]) { N(-sw * 0.3, yy, sw * 0.2); N(sw * 0.3, yy, sw * 0.2); } }
      else {
        const dg = stg === 4 ? 0.6 : 0;
        cell(-sw * 0.38, top + sh * 0.26, sw * 0.3, sh * 0.2, `rgba(225,215,180,${0.9 - dg})`); cell(sw * 0.38, top + sh * 0.26, sw * 0.3, sh * 0.2, `rgba(225,215,180,${0.9 - dg})`); // синергіди
        cell(0, top + sh * 0.5, sw * 0.36, sh * 0.24, 'rgba(242,232,200,.95)'); N(0, top + sh * 0.58, sw * 0.17, '#8A3F2E'); // яйцеклітина
        N(-sw * 0.38, top + sh * 0.2, sw * 0.12); N(sw * 0.38, top + sh * 0.2, sw * 0.12);
        N(-sw * 0.13, -oh * 0.08 + sh * 0.05, sw * 0.16); N(sw * 0.13, -oh * 0.08 + sh * 0.05, sw * 0.16); // полярні ядра
        for (const xx of [-sw * 0.45, 0, sw * 0.45]) { cell(xx, bot - sh * 0.15, sw * 0.24, sh * 0.13, 'rgba(220,210,170,.9)'); N(xx, bot - sh * 0.15, sw * 0.09); } // антиподи
      }
      c.restore();
    }, { mode: 'bright', scale: { px: r * 0.3, text: '50 мкм' } });
    if (sacStage(d) >= 3) {
      // локальні координати клітин у повернутому (−0,25 рад) кадрі → координати полотна
      const ow = r * 0.62, oh = r * 0.92, sw = ow * 0.38, sh = oh * 0.6, top = -oh * 0.08 - sh, bot = -oh * 0.08 + sh;
      const P = (x, y) => [cx + x * Math.cos(-0.25) - y * Math.sin(-0.25), cy + x * Math.sin(-0.25) + y * Math.cos(-0.25)];
      const [ex, ey] = P(0, top + sh * 0.58), [ax, ay] = P(0, bot - sh * 0.15), [px, py] = P(sw * 0.13, -oh * 0.08 + sh * 0.05);
      const side = cx + r * 1.12 + 6;
      callout(ctx, ex, ey, side, cy - r * 0.55, 'яйцеклітина (n)');
      callout(ctx, px, py, side, cy - r * 0.05, 'полярні ядра');
      callout(ctx, ax, ay, side, cy + r * 0.45, 'антиподи');
    }
  }
  function shadeCss(col, k) { return rgba(shade(hex(col), k)); }

  function pistil(ctx, x, y, s, fate, prog, seed) {
    // стовпчик маточки буряка: коротка зав'язь + три приймочки
    ctx.save();
    const brown = fate === 'none' ? prog * 0.8 : 0;
    const col = mix('#B9C77A', '#8B6A3A', brown);
    const g = ctx.createRadialGradient(x - s * 0.2, y - s * 0.5, 1, x, y - s * 0.3, s * 0.6);
    g.addColorStop(0, rgba(shade(col, 0.35))); g.addColorStop(1, rgba(shade(col, -0.25)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - s * 0.28, s * 0.32, s * 0.3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(shade(col, -0.1)); ctx.lineWidth = Math.max(1.2, s * 0.08); ctx.lineCap = 'round';
    for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x + Math.sin(a) * s * 0.4, y - s * 0.5 - Math.cos(a) * s * 0.35); ctx.stroke(); }
    ctx.restore();
    if (fate === 'cal' || fate === 'morph') callus(ctx, x, y + 1, s * (0.25 + prog * 0.55), { color: '#EEE6C2', friable: 0.5, seed, green: fate === 'morph' ? 0.25 * prog : 0 });
    if (fate === 'morph' && prog > 0.45) {
      const R = rng(seed);
      for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k - 1) * 0.6 + (R() - 0.5) * 0.3; embryoShape(ctx, x + (k - 1) * s * 0.2, y - s * 0.25, s * 0.35 * smooth(0.45, 1, prog), a, 0.85, '#D9E7B0', 0.6 * prog); }
    }
  }
  let fates = [];
  function computeFates() {
    const m = gynoModel(st), R = rng(77);
    fates = [];
    for (let i = 0; i < 6; i++) {
      const u = R(), v = R();
      if (u < m.inf) fates.push(v < 0.5 ? 'bact' : 'fungus');
      else { const w = R(); fates.push(w < m.Pm / Math.max(1e-6, 1) * 1.5 ? 'morph' : w < (m.Pm * 1.5 + m.Pk) ? 'cal' : 'none'); }
    }
  }
  function draw() {
    const { ctx, w, h } = fit(cv, { aspect: isPhone() ? 0.7 : 1.6, min: 340, max: 560 });
    if (w < 80) return;
    scene(ctx, w, h, { kind: 'room', horizon: 0.86, light: 0.6 });
    const wide = w >= 520, prog = smooth(0, 1, st.t / 28);
    const mic = wide ? { cx: w * 0.2, cy: h * 0.48, r: Math.min(w * 0.165, h * 0.37) } : { cx: w * 0.33, cy: h * 0.27, r: Math.min(w * 0.29, h * 0.21) };
    drawSac(ctx, mic.cx, mic.cy, mic.r, st.d);
    const stgNames = ['мегаспороцит', '2-ядерний мішок', '4-ядерний мішок', 'зрілий 7-клітинний мішок', 'початок дегенерації'];
    tagSmall(ctx, mic.cx, mic.cy + mic.r + 20, stgNames[sacStage(st.d)], { size: 11.5, weight: 700, color: '#173322', bg: 'rgba(255,255,255,.9)' });
    // штатив з пробірками
    const area = wide ? { x: w * 0.585, w: w * 0.4, y: h * 0.14, h: h * 0.66 } : { x: 10, w: w - 20, y: h * 0.56, h: h * 0.33 };
    const n = 6, slot = area.w / n, tw = Math.min(slot * 0.66, 40), th = Math.min(area.h, tw * 4.2);
    for (let i = 0; i < n; i++) {
      const fate = fates[i] || 'none';
      const tx = area.x + slot * (i + 0.5) - tw / 2, ty = area.y + area.h - th;
      const contam = (fate === 'bact' || fate === 'fungus') ? smooth(0.05, 0.5, prog) : 0;
      tube(ctx, tx, ty, tw, th, { medium: { level: 0.3, color: fate === 'bact' ? toHex(mix('#EEE7C6', '#C9B77A', contam)) : '#EEE7C6', cloudy: fate === 'bact' ? contam : 0, seed: i }, plug: 'cotton',
        contents: (c, inn) => {
          pistil(c, inn.x + inn.w / 2, inn.surface + 1, inn.w * 0.9, fate === 'bact' || fate === 'fungus' ? 'none' : fate, prog, 50 + i);
          if (fate === 'fungus' && contam > 0) { const R = rng(i + 3); for (let k = 0; k < 26 * contam; k++) { c.strokeStyle = `rgba(250,250,250,${0.6})`; c.lineWidth = 0.7; const a = R() * TAU, l = 3 + R() * inn.w * 0.5; c.beginPath(); c.moveTo(inn.x + inn.w / 2, inn.surface - 2); c.lineTo(inn.x + inn.w / 2 + Math.cos(a) * l, inn.surface - 2 - Math.abs(Math.sin(a)) * l); c.stroke(); } c.fillStyle = `rgba(60,90,60,${0.6 * contam})`; c.beginPath(); c.arc(inn.x + inn.w / 2, inn.surface - 4, inn.w * 0.25 * contam, 0, TAU); c.fill(); }
        } });
    }
    tagSmall(ctx, area.x + area.w / 2, area.y + area.h + 18, 'вибірка з 6 пробірок', { size: 11, weight: 700, color: '#22382A' });
    hud.innerHTML = `<span>Доба ${Math.round(st.t)} / 28</span><span>+27 °C · 14 год світла</span>`;
  }
  function updateReads() {
    const m = gynoModel(st), done = st.t >= 25;
    setOut(root, 'sac', ['мегаспороцит', '2-ядерний', '4-ядерний', 'зрілий, 7 клітин', 'дегенерація'][sacStage(st.d)]);
    setOut(root, 'g', pct(m.g));
    setOut(root, 'inf', pct(m.inf));
    setOut(root, 'surv', pct(m.s));
    const tb = $('t10b-table');
    if (tb) tb.innerHTML = `<tr><td>1</td><td class="num">${st.N}</td><td class="num">${m.asept}</td><td class="num">${done ? m.nK : '…'}</td><td class="num">${done ? m.nM : '…'}</td></tr>`;
    setOut(root, 'res', done ? `${m.nK} калюсів · ${m.nM} морфогенних` : `очікується ${fnum(m.asept * m.Pk, 0)} · ${fnum(m.asept * m.Pm, 0)}`);
    const ds = []; for (let d = -7; d <= 2.0001; d += 0.1) ds.push(d);
    p1.set([
      { data: ds.map((d) => [d, gynoModel({ ...st, d }).g * 100]), color: '#2C7A4D', width: 2.6, label: 'компетентність мішка' },
      { data: ds.map((d) => [d, gynoModel({ ...st, d }).Pk * 100]), color: '#C9A227', width: 2, label: 'калюс' },
      { data: ds.map((d) => [d, gynoModel({ ...st, d }).Pm * 100]), color: '#7A3FA0', width: 2, label: 'морфогенні структури' },
    ], [{ x: st.d, color: '#B08A1E', label: 'ізоляція' }]);
    const ts = []; for (let t = 2; t <= 25.0001; t += 0.25) ts.push(t);
    p2.set([
      { data: ts.map((t) => [t, gynoModel({ ...st, ster: t }).inf * 100]), color: '#B5452B', width: 2.4, label: 'інфіковані' },
      { data: ts.map((t) => [t, gynoModel({ ...st, ster: t }).s * 100]), color: '#2A6A93', width: 2.4, label: 'життєздатні тканини' },
      { data: ts.map((t) => [t, (1 - gynoModel({ ...st, ster: t }).inf) * gynoModel({ ...st, ster: t }).Pk * 100]), color: '#C9A227', width: 2, dash: [5, 4], label: 'калюс від усіх' },
    ], [{ x: st.ster, color: '#B08A1E', label: 'ваш режим' }]);
    const v = $('t10b-verdict');
    let txt = '', cls = '';
    const stg = sacStage(st.d);
    if (stg < 3) { txt = `<b>Зарано:</b> зародковий мішок ще не сформований (${['мегаспороцит', '2 ядра', '4 ядра'][stg]}) — гаплоїдних елементів, здатних до розвитку, ще немає. `; cls = ' is-warn'; }
    else if (stg === 4) { txt = `<b>Запізно:</b> після розкриття квітки синергіди дегенерують, а без запилення зав'язь в'яне. `; cls = ' is-warn'; }
    else txt = '<b>Зародковий мішок зрілий:</b> диференційовані яйцеклітина, синергіди й антиподи — їхня тотипотентність може реалізуватися у зародок або калюс (с. 137). ';
    if (m.inf > 0.25) { txt += `Стерилізація ${st.ster} хв закоротка: інфіковано ≈ ${pct(m.inf)} експлантатів.`; cls = ' is-bad'; }
    else if (m.s < 0.6) { txt += `Стерилізація ${st.ster} хв задовга: діоцид пошкоджує тканини (живих ≈ ${pct(m.s)}).`; cls = cls || ' is-warn'; }
    else txt += `Режим стерилізації ${st.ster} хв — компроміс між асептичністю (${pct(1 - m.inf)}) і живістю тканин.`;
    v.innerHTML = txt; v.className = 'ag-verdict' + cls;
  }
  function refresh() { computeFates(); draw(); updateReads(); }
  const runner = new Runner({
    btn: $('t10b-run'), reset: $('t10b-reset'),
    step: (dt, t, reset) => {
      if (reset) { st.t = 0; $('t10b-status').textContent = ''; updateReads(); return; }
      if (st.t >= 28) st.t = 0;
      const p = Math.floor(st.t); st.t = Math.min(28, st.t + dt * 28 / 9);
      if (Math.floor(st.t) !== p) updateReads();
      $('t10b-status').textContent = `Культивування, доба ${Math.round(st.t)}`;
      if (st.t >= 28) { $('t10b-status').textContent = '25–30 доба: облік калюсу й морфогенних структур (табл. 12).'; runner.finish(); updateReads(); }
    },
    draw,
  });
  onResize(cv.parentElement, () => { draw(); });
  window.addEventListener('t10tab', () => { if (!root.closest('[hidden]')) refresh(); });
  refresh();
}

/* =====================================================================
   В. ЕМБРІОКУЛЬТУРА (ЛР 40) — порятунок незрілих (гібридних) зародків
   ---------------------------------------------------------------------
   Довжина зародка від доби після запилення (DAP): l = 2,5/(1 + e^(−0,35(DAP − 14))) мм (логістичне наближення).
   Стадії: l < 0,15 мм — глобулярна, < 0,4 — серцеподібна, < 1,0 — торпедо, далі — сім'ядольна.
   Віддалене схрещування: ендосперм деградує, E(DAP) = 1/(1 + e^((DAP − 11)/1,5)) (постгамна несумісність, с. 132);
   зародок у насінині живе, доки живий ендосперм (з запізненням 2 доби): V = E(DAP − 2). Для внутрішньовидового V = 1.
   Осмотичний потенціал середовища (рівняння Вант-Гоффа): Ψs = −i·c·R·T, c = 10·w/342,3 моль/л (w — % сахарози),
   i = 1, R = 0,008314 л·МПа/(моль·К), T = 299 К. Посібник: 30 г/л сахарози (3 %) → Ψs ≈ −0,22 МПа.
   Дрібним зародкам потрібна вища концентрація сахарози (с. 133): оптимум w* = 3 + 9·e^(−l/0,3) %.
   Успіх: P = V · (1 − e^(−l/0,12)) · (0,3 + 0,7·e^(−((w − w*)/3)²)) · k_холод, k_холод = 1,15 при 10 добах +10–12 °C (с. 140).
   Передчасне проростання (дрібний зародок на «бідному» середовищі): q = clamp((w* − w − 2)/6, 0, 0,85)·(1 − smooth(0,4; 1,2; l)).
   ===================================================================== */
const embLen = (dap) => 2.5 / (1 + Math.exp(-0.35 * (dap - 14)));
const embStage = (l) => (l < 0.15 ? 0 : l < 0.4 ? 1 : l < 1.0 ? 2 : 3);
const EMB_ST = ['глобулярний', 'серцеподібний', 'торпедоподібний', "сім'ядольний"];
const psiS = (w) => -(10 * w / 342.3) * 0.008314 * 299;
function rescue(p) {
  const l = embLen(p.dap);
  const E = p.cross === 'wide' ? 1 / (1 + Math.exp((p.dap - 11) / 1.5)) : 1;
  const V = p.cross === 'wide' ? 1 / (1 + Math.exp((p.dap - 2 - 11) / 1.5)) : 1;
  const wOpt = 3 + 9 * Math.exp(-l / 0.3);
  const fs = 1 - Math.exp(-l / 0.12);
  const fo = 0.3 + 0.7 * Math.exp(-(((p.suc - wOpt) / 3) ** 2));
  const kc = p.cold ? 1.15 : 1;
  const P = clamp(V * fs * fo * kc, 0, 0.97);
  const q = clamp((wOpt - p.suc - 2) / 6, 0, 0.85) * (1 - smooth(0.4, 1.2, l));
  const inVivo = p.cross === 'wide' ? clamp(E * smooth(14, 30, p.dap + 10), 0, 1) * 0.05 : 0.9; // без порятунку
  return { l, E, V, wOpt, fs, fo, P, normal: P * (1 - q), q, psi: psiS(p.suc), stage: embStage(l), inVivo };
}

function initC() {
  const root = $('t10c');
  if (!root) return;
  const cv = $('t10c-cv'), hud = $('t10c-hud');
  const st = { cross: 'wide', dap: 10, suc: 6, cold: true, t: 0 };
  segmented($('t10c-cross'), 't10c-cross', [{ value: 'wide', label: 'Віддалене схрещування' }, { value: 'intra', label: 'Сорт × сорт' }], st.cross, (v) => { st.cross = v; refresh(); });
  const sl = sliders($('t10c-sl'), [
    { id: 'dap', label: 'Ізоляція зародка після запилення', min: 4, max: 24, step: 1, value: st.dap, unit: '', format: (v) => `${v}-та доба` },
    { id: 'suc', label: 'Сахароза в середовищі', min: 1, max: 14, step: 0.5, value: st.suc, unit: '%', digits: 1, hint: 'Посібник: 30 г/л (3 %) для зародків цукрового буряка' },
  ], (id) => { st[id] = sl.values[id]; refresh(); });
  const chk = $('t10c-cold'); chk.checked = st.cold; chk.addEventListener('change', () => { st.cold = chk.checked; refresh(); });
  const p1 = new Plot($('t10c-p1'), { xLabel: 'Доба після запилення', yLabel: '%', x: [4, 24], y: [0, 100], xShort: 'DAP', aspect: 1.5 });
  const p2 = new Plot($('t10c-p2'), { xLabel: 'Сахароза, % (Ψs від −0,07 до −1,0 МПа)', yLabel: 'Нормальні проростки, %', x: [1, 14], y: [0, 100], xShort: 'w', aspect: 1.5 });

  function seed(ctx, cx, cy, r, m, dap) {
    // поздовжній зріз насінини: шкірка, ендосперм (молочний → бурий при деградації), зародок
    shadow(ctx, cx + r * 0.1, cy + r * 0.62, r * 1.05, r * 0.2, 0.3);
    ctx.save();
    const coat = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
    coat.addColorStop(0, '#B9B884'); coat.addColorStop(0.7, '#8C8650'); coat.addColorStop(1, '#5E5A33');
    ctx.fillStyle = coat; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.66, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,55,25,.25)'; ctx.lineWidth = 1;
    for (let k = 0; k < 28; k++) { const a = k / 28 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.6); ctx.lineTo(cx + Math.cos(a) * r * 0.99, cy + Math.sin(a) * r * 0.655); ctx.stroke(); }
    ctx.fillStyle = '#4A4424'; ctx.beginPath(); ctx.ellipse(cx - r * 0.98, cy, r * 0.05, r * 0.1, 0, 0, TAU); ctx.fill(); // мікропіле / рубчик
    const endo = m.E, er = r * (0.88 - (1 - endo) * 0.25);
    const eg = ctx.createRadialGradient(cx - er * 0.3, cy - er * 0.3, 2, cx, cy, er);
    const ec = mix('#C9A26A', '#FBF7E8', endo);
    eg.addColorStop(0, rgba(shade(ec, 0.3))); eg.addColorStop(1, rgba(shade(ec, -0.15)));
    ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(cx, cy, er, er * 0.6, 0, 0, TAU); ctx.fill();
    if (endo < 0.5) { ctx.fillStyle = `rgba(90,55,25,${0.5 * (1 - endo)})`; const R = rng(4); for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc(cx + (R() - 0.5) * er * 1.6, cy + (R() - 0.5) * er, 1 + R() * 3, 0, TAU); ctx.fill(); } }
    // зародок біля мікропіле (ліворуч), збільшений масштаб: r ≈ 2,5 мм
    const pxmm = r / 1.25, el = Math.max(4, Math.min(m.l, 1.3) * pxmm);
    const alive = st.cross === 'wide' ? m.V : 1;
    embryoShape(ctx, cx - r * 0.72 + el * 0.1, cy, el, 0, [0.15, 0.45, 0.7, 0.95][m.stage], toHex(mix('#8A6A40', '#EAF2C8', alive)), 0.4 * alive);
    ctx.restore();
  }
  function draw() {
    const { ctx, w, h } = fit(cv, { aspect: isPhone() ? 0.78 : 1.6, min: 340, max: 560 });
    if (w < 80) return;
    scene(ctx, w, h, { kind: 'bench', horizon: 0.8, light: 0.55 });
    const m = rescue(st);
    const wide = w >= 520;
    const sd = wide ? { cx: w * 0.24, cy: h * 0.5, r: Math.min(w * 0.17, h * 0.3) } : { cx: w * 0.3, cy: h * 0.34, r: Math.min(w * 0.25, h * 0.15) };
    seed(ctx, sd.cx, sd.cy, sd.r, m, st.dap);
    tagSmall(ctx, sd.cx, sd.cy + sd.r * 0.66 + 24, `${EMB_ST[m.stage]}, ${fnum(m.l, 2)} мм`, { size: 11.5, weight: 700, color: '#173322', bg: 'rgba(255,255,255,.9)' });
    if (sd.r > 50) {
      const ty = sd.cy - sd.r * 0.66 - 16;
      callout(ctx, sd.cx - sd.r * 0.62, sd.cy - 2, sd.cx - sd.r * 0.55, ty, 'зародок');
      callout(ctx, sd.cx + sd.r * 0.25, sd.cy - sd.r * 0.15, sd.cx + sd.r * 0.3, ty, st.cross === 'wide' && m.E < 0.5 ? 'ендосперм гине' : 'ендосперм');
    }
    // стрілка «ізоляція ланцетом»
    const vx = wide ? w * 0.6 : w * 0.5, vy = wide ? h * 0.2 : h * 0.5, vw = wide ? w * 0.2 : w * 0.4, vh = wide ? h * 0.58 : h * 0.4;
    ctx.save(); ctx.strokeStyle = 'rgba(30,60,40,.55)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(sd.cx + sd.r + 8, sd.cy); ctx.quadraticCurveTo((sd.cx + vx) / 2 + 10, sd.cy - 30, vx - 6, vy + vh * 0.55); ctx.stroke(); ctx.restore();
    // флакон з ізольованим зародком
    const prog = smooth(0, 1, st.t / 30), fate = st.cross === 'wide' && m.V < 0.15 ? 'dead' : m.P < 0.2 ? 'dead' : m.q > 0.35 ? 'prec' : 'ok';
    vial(ctx, vx, vy, vw, vh, (c, inn) => {
      const bx = inn.x + inn.w / 2, by = inn.surf + 2;
      if (prog < 0.08 || fate === 'dead') {
        const el = Math.max(4, m.l * vw * 0.08);
        embryoShape(c, bx, by, el, -Math.PI / 2 + 0.2, [0.15, 0.45, 0.7, 0.95][m.stage], fate === 'dead' && prog > 0.2 ? '#8E6B3E' : '#EAF2C8', fate === 'dead' ? 0 : 0.3);
        if (fate === 'dead' && prog > 0.3) callus(c, bx, by + 1, 5 + prog * 4, { color: '#A98A5A', brown: 0.8, seed: 3 });
        return;
      }
      const g = smooth(0.08, 1, prog);
      if (fate === 'prec') plantlet(c, bx, by, { height: inn.h * 0.22 * g, nodes: 2, leafLen: 7 * g + 2, roots: { n: 1, len: 6 * g }, pale: 0.6, seed: 4 });
      else plantlet(c, bx, by, { height: inn.h * 0.5 * g * (0.55 + 0.45 * m.P), nodes: Math.max(2, Math.round(2 + 3 * g)), leafLen: inn.w * 0.32 * g + 2, roots: { n: Math.round(1 + 3 * g), len: inn.h * 0.25 * g }, rosette: true, seed: 6 });
    });
    const phase = st.t <= 0 ? 'Підготовка' : st.cold && st.t < 10 ? `+10–12 °C, світло 1,2–1,4 клк · доба ${Math.round(st.t)}` : `+26 °C · 16 год · доба ${Math.round(st.t)}`;
    tagSmall(ctx, vx + vw / 2, vy + vh + 18, `сахароза ${fnum(st.suc, 1)} % · Ψs ${fnum(m.psi, 2)} МПа`, { size: 11, weight: 700, color: '#22382A' });
    hud.innerHTML = `<span>${phase}</span><span>${st.cross === 'wide' ? 'віддалений гібрид' : 'внутрішньовидовий'}</span>`;
  }
  function updateReads() {
    const m = rescue(st);
    setOut(root, 'stage', `${EMB_ST[m.stage]}, ${fnum(m.l, 2)} мм`);
    setOut(root, 'endo', st.cross === 'wide' ? pct(m.E) : 'норма');
    setOut(root, 'psi', `${fnum(m.psi, 2)} МПа`);
    setOut(root, 'opt', `≈ ${fnum(m.wOpt, 1)} %`);
    setOut(root, 'P', pct(m.normal));
    setOut(root, 'prec', pct(m.P * m.q));
    const ds = []; for (let d = 4; d <= 24.0001; d += 0.25) ds.push(d);
    p1.set([
      { data: ds.map((d) => [d, rescue({ ...st, dap: d }).E * 100]), color: '#C9A227', width: 2.2, label: 'живий ендосперм' },
      { data: ds.map((d) => [d, embLen(d) / 2.5 * 100]), color: '#2A6A93', width: 1.8, dash: [5, 4], label: 'розмір зародка (% від 2,5 мм)' },
      { data: ds.map((d) => [d, rescue({ ...st, dap: d }).normal * 100]), color: '#2C7A4D', width: 3, label: 'порятунок in vitro' },
      { data: ds.map((d) => [d, rescue({ ...st, dap: d }).inVivo * 100]), color: '#B5452B', width: 1.8, label: 'без порятунку (у насінині)' },
    ], [{ x: st.dap, color: '#B08A1E', label: 'ізоляція' }]);
    const ws = []; for (let x = 1; x <= 14.0001; x += 0.1) ws.push(x);
    const s2 = [6, 10, 16].map((d, i) => ({ data: ws.map((x) => [x, rescue({ ...st, cross: 'intra', dap: d, suc: x }).normal * 100]), color: ['#7A3FA0', '#C47A12', '#2C7A4D'][i], width: 2, label: `${EMB_ST[embStage(embLen(d))]} (${d} доба)` }));
    s2.push({ data: [[st.suc, m.normal * 100]], type: 'points', color: '#173322', r: 6, label: 'ваш варіант' });
    p2.set(s2, [{ x: 3, color: '#8E9A90', label: '3 % (посібник)' }]);
    const v = $('t10c-verdict');
    let txt = '', cls = '';
    if (st.cross === 'wide' && m.V < 0.3) { txt = `<b>Запізно:</b> на ${st.dap}-ту добу ендосперм віддаленого гібрида вже зруйнований і зародок загинув у насінині. Ізолюйте раніше — до 10–12 доби.`; cls = ' is-bad'; }
    else if (m.l < 0.1) { txt = `<b>Зародок надто дрібний</b> (${fnum(m.l, 2)} мм): глобулярні зародки важко вичленувати без пошкоджень і виростити — потрібні багате середовище й досвід.`; cls = ' is-warn'; }
    else txt = `<b>Зародок ${EMB_ST[m.stage]}, ${fnum(m.l, 2)} мм.</b> Оптимальна сахароза для цієї стадії ≈ ${fnum(m.wOpt, 1)} % (Ψs ≈ ${fnum(psiS(m.wOpt), 2)} МПа); у вас ${fnum(st.suc, 1)} %. Очікувано ${pct(m.normal)} нормальних проростків. `;
    if (m.q > 0.25) { txt += ` На бідному середовищі незрілий зародок <b>передчасно проростає</b>: не завершивши ембріогенез, дає слабкий проросток (${pct(m.P * m.q)}).`; cls = cls || ' is-warn'; }
    if (st.cross === 'wide' && m.V >= 0.3) txt += ` Без порятунку з такого схрещування вижило б лише ${pct(rescue(st).inVivo, 1)} — ембріокультура долає постгамну несумісність.`;
    v.innerHTML = txt; v.className = 'ag-verdict' + cls;
  }
  function refresh() { draw(); updateReads(); }
  const runner = new Runner({
    btn: $('t10c-run'), reset: $('t10c-reset'),
    step: (dt, t, reset) => {
      if (reset) { st.t = 0; $('t10c-status').textContent = ''; return; }
      if (st.t >= 30) st.t = 0;
      st.t = Math.min(30, st.t + dt * 30 / 9);
      $('t10c-status').textContent = `Культура зародка, доба ${Math.round(st.t)}`;
      if (st.t >= 30) { $('t10c-status').textContent = '30-та доба: облік (табл. 13).'; runner.finish(); }
    },
    draw,
  });
  onResize(cv.parentElement, refresh);
  window.addEventListener('t10tab', () => { if (!root.closest('[hidden]')) refresh(); });
  refresh();
}

const tabRoot = $('t10-tabs');
if (tabRoot) tabs(tabRoot);
initA();
initB();
initC();
