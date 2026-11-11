// «Біотехнології в агросфері» — спільний набір для 2.5D-візуалізацій на Canvas.
// Сцена (лабораторний стіл, ламінар-бокс), скляний посуд (пробірка, колба Ерленмеєра, банка,
// чашка Петрі, стакан, кювета), живильне середовище й рідини, біологічні об'єкти (калюс,
// рослина-регенерант, клітини, протопласти), поле зору мікроскопа, виноски, контролер запуску.
// Усе малюється процедурно: м'яке світло зверху-ліворуч, контактні тіні, відблиски на склі.

export { Plot, sample, linspace } from '../plot.js';
export { sliders, segmented, num, sig, setOut, renderTable, downloadCSV } from '../ui.js';

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ---------------- Числа ---------------- */
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
/** Українське форматування: кома, мінус «−», великі/малі числа як m·10ⁿ. */
export function fnum(v, d = 2) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) {
    const [m, e] = v.toExponential(Math.max(0, d - 1)).split('e');
    return `${m.replace('.', ',').replace('-', '−')}·10${[...String(+e)].map((c) => SUP[c]).join('')}`;
  }
  return v.toFixed(d).replace('.', ',').replace('-', '−');
}

/* ---------------- Випадковість і шум ---------------- */
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** Гладкий шум значень 0..1. */
export function noise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, s = 0, oct = 4) { let v = 0, amp = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += amp * noise(x * f, y * f, s + i * 17); f *= 2; amp *= 0.5; } return v / (1 - Math.pow(0.5, oct)); }

/* ---------------- Кольори ---------------- */
export function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgba(c, a = 1) { const [r, g, b] = Array.isArray(c) ? c : hex(c); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
export function mix(c1, c2, t) { const A = Array.isArray(c1) ? c1 : hex(c1), B = Array.isArray(c2) ? c2 : hex(c2); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; }
export function shade(c, k) { const A = Array.isArray(c) ? c : hex(c); return k >= 0 ? mix(A, [255, 255, 255], k) : mix(A, [0, 0, 0], -k); }

/** Палітра матеріалів. */
export const MAT = {
  agar: '#EDE6C8', agarMS: '#E9E2BE', agarBrown: '#C9A56A', liquid: '#F3EFD8',
  callusWhite: '#F1E9CF', callusYellow: '#E6D27E', callusGreen: '#9DBF5A', callusBrown: '#9A6A35', callusDead: '#5B4128',
  leaf: '#4E9A3A', leafLight: '#86C25A', leafPale: '#C9D98A', stem: '#6FA243', root: '#F4EEDD',
  foil: '#C9CED1', cotton: '#F4F1EA', cap: '#2E6B47', glass: '#DDEBE6',
};

/* ---------------- Полотно ---------------- */
/** Підганяє canvas під ширину батька (CSS px), ставить HiDPI. Повертає {ctx, w, h}. */
export function fit(canvas, { aspect = 16 / 9, min = 240, max = 560, maxDpr = 2 } = {}) {
  const w = Math.max(1, canvas.parentElement.clientWidth);
  const h = Math.round(clamp(w / aspect, min, max));
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr };
}
/** Позаекранне полотно для кешування текстур. */
export function offscreen(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

/** Плівка зерна (кешується): дрібний шум для «матеріальності» поверхонь. */
const grainCache = new Map();
export function grain(size = 256, alpha = 0.06, seed = 3) {
  const k = `${size}|${alpha}|${seed}`;
  if (grainCache.has(k)) return grainCache.get(k);
  const c = offscreen(size, size), x = c.getContext('2d'), d = x.createImageData(size, size), R = rng(seed);
  for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = alpha * 255; }
  x.putImageData(d, 0, 0);
  grainCache.set(k, c);
  return c;
}
export function applyGrain(ctx, x, y, w, h, alpha = 0.05) {
  const g = grain(256, 1, 7);
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'overlay';
  const p = ctx.createPattern(g, 'repeat'); ctx.fillStyle = p; ctx.fillRect(x, y, w, h); ctx.restore();
}

/* ---------------- Сцена ---------------- */
/**
 * Лабораторний фон: стіна з м'яким світлом і стільниця в перспективі.
 * kind: 'bench' — світла лабораторія; 'hood' — ламінар-бокс (нержавійка, УФ-лампа);
 *       'room' — світлова культуральна кімната (стелаж, лампи); 'dark' — темна кімната (УФ-трансілюмінатор).
 * Повертає y лінії стільниці (horizon).
 */
export function scene(ctx, w, h, { kind = 'bench', horizon = 0.66, light = 0.5 } = {}) {
  const hy = Math.round(h * horizon);
  ctx.save();
  if (kind === 'dark') {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0B1410'); g.addColorStop(1, '#030705');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const t = ctx.createLinearGradient(0, hy, 0, h); t.addColorStop(0, '#1A2420'); t.addColorStop(1, '#0A0F0D');
    ctx.fillStyle = t; ctx.fillRect(0, hy, w, h - hy);
  } else {
    const wall = kind === 'hood' ? ['#E7ECEC', '#C9D1D2'] : kind === 'room' ? ['#F2F4EE', '#D9DED3'] : ['#EEF2EC', '#D6DDD3'];
    const g = ctx.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, wall[0]); g.addColorStop(1, wall[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy);
    // пляма світла від лампи
    const r = ctx.createRadialGradient(w * light, -h * 0.1, 10, w * light, -h * 0.1, h * 1.1);
    r.addColorStop(0, 'rgba(255,255,250,.75)'); r.addColorStop(1, 'rgba(255,255,250,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, w, hy);
    if (kind === 'hood') {
      // перфорована задня стінка й УФ/люмінесцентна лампа вгорі
      ctx.fillStyle = 'rgba(90,105,108,.16)';
      for (let y = hy * 0.18; y < hy - 8; y += 9) for (let x = 6 + ((y / 9) % 2) * 4.5; x < w; x += 9) { ctx.beginPath(); ctx.arc(x, y, 1.2, 0, TAU); ctx.fill(); }
      const lg = ctx.createLinearGradient(0, 0, 0, hy * 0.12); lg.addColorStop(0, '#FFFFFF'); lg.addColorStop(1, '#DCE6E8');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, w, hy * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, hy * 0.12, w, 2);
    } else if (kind === 'room') {
      // полиця стелажа з лампами денного світла
      for (const yy of [hy * 0.08]) {
        const lg = ctx.createLinearGradient(0, yy, 0, yy + 10); lg.addColorStop(0, '#FFFFFF'); lg.addColorStop(1, '#E9F2FF');
        ctx.fillStyle = lg; roundRect(ctx, w * 0.06, yy, w * 0.88, 8, 4); ctx.fill();
        ctx.fillStyle = 'rgba(230,240,255,.35)'; ctx.fillRect(0, yy + 8, w, hy * 0.5);
      }
    } else {
      // кахель стіни
      ctx.strokeStyle = 'rgba(120,135,125,.10)'; ctx.lineWidth = 1;
      const s = Math.max(28, h * 0.11);
      for (let y = hy - s; y > 0; y -= s) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
      for (let x = s * 0.5; x < w; x += s) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, hy); ctx.stroke(); }
    }
    // стільниця
    const top = kind === 'hood' ? ['#D9E0E1', '#AEB9BB'] : ['#F7F8F4', '#D5DBD2'];
    const t = ctx.createLinearGradient(0, hy, 0, h); t.addColorStop(0, top[0]); t.addColorStop(1, top[1]);
    ctx.fillStyle = t; ctx.fillRect(0, hy, w, h - hy);
    if (kind === 'hood') { // шліфована нержавійка
      ctx.globalAlpha = 0.18; ctx.strokeStyle = '#FFFFFF';
      for (let i = 0; i < 40; i++) { const y = hy + (i / 40) * (h - hy); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + 2); ctx.lineWidth = 0.6; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // крайка стільниці
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(0, hy, w, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0, hy + 1.5, w, 1);
  }
  // віньєтка
  const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, kind === 'dark' ? 'rgba(0,0,0,.55)' : 'rgba(20,35,25,.16)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  applyGrain(ctx, 0, 0, w, h, kind === 'dark' ? 0.05 : 0.035);
  return hy;
}

/** М'яка контактна тінь під предметом (еліпс). */
export function shadow(ctx, cx, cy, rx, ry, a = 0.28) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(10,25,15,${a})`); g.addColorStop(0.55, `rgba(10,25,15,${a * 0.45})`); g.addColorStop(1, 'rgba(10,25,15,0)');
  ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, TAU); ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ---------------- Скло ---------------- */
/** Відблиски на циліндричному склі: вузька яскрава смуга ліворуч, слабка праворуч, темні краї (рефракція). */
function glassShine(ctx, x, y, w, h, { strength = 1 } = {}) {
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, `rgba(40,70,60,${0.30 * strength})`);
  g.addColorStop(0.06, `rgba(255,255,255,${0.05 * strength})`);
  g.addColorStop(0.16, `rgba(255,255,255,${0.75 * strength})`);
  g.addColorStop(0.24, `rgba(255,255,255,${0.10 * strength})`);
  g.addColorStop(0.7, 'rgba(255,255,255,0)');
  g.addColorStop(0.84, `rgba(255,255,255,${0.32 * strength})`);
  g.addColorStop(0.9, `rgba(255,255,255,${0.04 * strength})`);
  g.addColorStop(1, `rgba(40,70,60,${0.34 * strength})`);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * Шар живильного середовища / рідини всередині вже обрізаного (clip) об'єму.
 * top — y поверхні; meniscus — висота меніска; gel — агар (матовий, щільний), інакше рідина (прозора).
 */
function mediumFill(ctx, x, top, w, bottom, { color = MAT.agar, gel = true, alpha = 0.9, meniscus = 3, cloudy = 0, bubbles = 0, seed = 1, t = 0 } = {}) {
  const c = hex(color);
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  const a0 = gel ? alpha : alpha * 0.55;
  g.addColorStop(0, rgba(shade(c, -0.28), a0)); g.addColorStop(0.25, rgba(shade(c, 0.12), a0 * 0.9));
  g.addColorStop(0.6, rgba(c, a0 * 0.85)); g.addColorStop(1, rgba(shade(c, -0.32), a0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x, top - meniscus);
  ctx.quadraticCurveTo(x + w / 2, top + meniscus * 0.6, x + w, top - meniscus);
  ctx.lineTo(x + w, bottom); ctx.lineTo(x, bottom); ctx.closePath(); ctx.fill();
  // глибина: темніше донизу
  const d = ctx.createLinearGradient(0, top, 0, bottom);
  d.addColorStop(0, 'rgba(255,255,255,0)'); d.addColorStop(1, `rgba(60,50,20,${gel ? 0.16 : 0.08})`);
  ctx.fillStyle = d; ctx.fill();
  if (cloudy > 0) { // каламуть (бактерії / суспензія)
    const R = rng(seed);
    ctx.fillStyle = rgba(shade(c, -0.25), 0.18 * cloudy);
    for (let i = 0; i < 260 * cloudy; i++) { const px = x + R() * w, py = top + R() * (bottom - top); ctx.beginPath(); ctx.arc(px, py, 0.6 + R() * 1.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = rgba(shade(c, -0.2), 0.22 * cloudy); ctx.fillRect(x, top, w, bottom - top);
  }
  // меніск: світла лінія поверхні
  ctx.strokeStyle = gel ? 'rgba(255,255,245,.85)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x + 1, top - meniscus + 0.5); ctx.quadraticCurveTo(x + w / 2, top + meniscus * 0.6 + 0.5, x + w - 1, top - meniscus + 0.5); ctx.stroke();
  if (bubbles > 0) {
    const R = rng(seed + 9);
    for (let i = 0; i < bubbles; i++) {
      const bx = x + 3 + R() * (w - 6), sp = 0.3 + R(), by = bottom - ((R() * (bottom - top) + t * 40 * sp) % (bottom - top - 2)), r = 0.8 + R() * 1.8;
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.3, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

/** Пробка: 'cotton' — ватно-марлева, 'foil' — фольга, 'cap' — пластикова кришка, 'film' — парафільм. */
function plug(ctx, cx, y, w, kind) {
  ctx.save();
  if (kind === 'foil') {
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, '#8E979B'); g.addColorStop(0.2, '#F4F6F7'); g.addColorStop(0.45, '#B7BEC2'); g.addColorStop(0.7, '#E8ECEE'); g.addColorStop(1, '#7C8589');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - w / 2 - 2, y + w * 0.55);
    for (let i = 0; i <= 8; i++) ctx.lineTo(cx - w / 2 - 2 + (w + 4) * i / 8, y + w * 0.55 + (i % 2 ? 2.5 : -1));
    ctx.lineTo(cx + w / 2 + 1, y - w * 0.12); ctx.quadraticCurveTo(cx, y - w * 0.32, cx - w / 2 - 1, y - w * 0.12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx - w * 0.2, y - w * 0.15); ctx.lineTo(cx - w * 0.1, y + w * 0.4); ctx.stroke();
  } else if (kind === 'cap') {
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, '#173B27'); g.addColorStop(0.3, '#3E8A5C'); g.addColorStop(0.55, '#2E6B47'); g.addColorStop(1, '#123020');
    ctx.fillStyle = g; roundRect(ctx, cx - w / 2 - 2, y - w * 0.3, w + 4, w * 0.62, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 1; i < 6; i++) ctx.fillRect(cx - w / 2 - 2 + (w + 4) * i / 6, y - w * 0.28, 0.8, w * 0.58);
  } else if (kind === 'film') {
    ctx.fillStyle = 'rgba(245,240,225,.75)'; roundRect(ctx, cx - w / 2 - 1.5, y - 2, w + 3, w * 0.35, 2); ctx.fill();
  } else if (kind === 'cotton') {
    const R = rng(7);
    for (let i = 0; i < 22; i++) {
      const px = cx + (R() - 0.5) * w * 0.9, py = y - w * 0.25 + R() * w * 0.55, r = w * (0.16 + R() * 0.14);
      const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.4, 1, px, py, r);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#D8D2C2');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Пробірка. (x, y) — верхній лівий кут; w×h. medium: {level 0..1, color, gel, ...}.
 * contents(ctx, inner) — малює вміст (рослина, калюс) у межах inner = {x,y,w,h,surface}.
 * Повертає inner.
 */
export function tube(ctx, x, y, w, h, { medium = { level: 0.35 }, plug: pk = 'foil', contents = null, label = '', slant = false } = {}) {
  const r = w / 2, wall = Math.max(1.2, w * 0.06);
  const path = () => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h - r); ctx.arc(x + r, y + h - r, r, Math.PI, 0, true); ctx.lineTo(x + w, y); };
  shadow(ctx, x + r + w * 0.15, y + h + 1, w * 0.9, w * 0.22, 0.25);
  // тло скла
  ctx.save(); path(); ctx.closePath(); ctx.fillStyle = 'rgba(225,240,235,.30)'; ctx.fill(); ctx.clip();
  const inner = { x: x + wall, y, w: w - 2 * wall, h: h - wall, surface: y + h * (1 - (medium?.level ?? 0)) };
  if (medium && medium.level > 0) {
    if (slant) { // скошений агар
      const s = inner.surface;
      ctx.save(); ctx.beginPath(); ctx.moveTo(x, s - h * 0.18); ctx.lineTo(x + w, s); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.clip();
      mediumFill(ctx, x, s - h * 0.18, w, y + h, Object.assign({ meniscus: 0 }, medium));
      ctx.restore();
    } else mediumFill(ctx, x, inner.surface, w, y + h, Object.assign({ meniscus: Math.min(4, w * 0.12) }, medium));
  }
  if (contents) contents(ctx, inner);
  glassShine(ctx, x, y, w, h);
  ctx.restore();
  // контур скла
  ctx.save(); path();
  ctx.strokeStyle = 'rgba(70,100,90,.55)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + 1.6, y + 4); ctx.lineTo(x + 1.6, y + h - r); ctx.stroke();
  // обідок
  ctx.strokeStyle = 'rgba(80,110,100,.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x + r, y, r + 1, Math.max(1.5, r * 0.22), 0, 0, TAU); ctx.stroke();
  ctx.restore();
  if (pk) plug(ctx, x + r, y, w, pk);
  if (label) tagSmall(ctx, x + r, y + h + 14, label);
  return inner;
}

/** Колба Ерленмеєра. cx — центр, by — дно, s — висота. liquid: {level, color, cloudy, swirl}. */
export function flask(ctx, cx, by, s, { liquid = { level: 0.4 }, plug: pk = 'foil', t = 0, contents = null, label = '' } = {}) {
  const bw = s * 0.92, nw = s * 0.26, nh = s * 0.3, top = by - s;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(cx - nw / 2, top); ctx.lineTo(cx - nw / 2, top + nh);
    ctx.bezierCurveTo(cx - nw / 2, top + nh + s * 0.08, cx - bw / 2 + s * 0.02, by - s * 0.12, cx - bw / 2, by - s * 0.05);
    ctx.quadraticCurveTo(cx - bw / 2 - 1, by, cx - bw / 2 + s * 0.05, by);
    ctx.lineTo(cx + bw / 2 - s * 0.05, by); ctx.quadraticCurveTo(cx + bw / 2 + 1, by, cx + bw / 2, by - s * 0.05);
    ctx.bezierCurveTo(cx + bw / 2 - s * 0.02, by - s * 0.12, cx + nw / 2, top + nh + s * 0.08, cx + nw / 2, top + nh);
    ctx.lineTo(cx + nw / 2, top);
  };
  shadow(ctx, cx + s * 0.08, by + 1, bw * 0.62, bw * 0.12, 0.3);
  ctx.save(); outline(); ctx.closePath(); ctx.fillStyle = 'rgba(225,240,235,.28)'; ctx.fill(); ctx.clip();
  const lv = liquid?.level ?? 0;
  const surf = by - s * 0.66 * lv;
  if (lv > 0) {
    const sw = liquid.swirl ? Math.sin(t * 6) * s * 0.035 * liquid.swirl : 0;
    ctx.save(); ctx.translate(cx, surf); ctx.rotate(sw / s); ctx.translate(-cx, -surf);
    mediumFill(ctx, cx - bw / 2 - 4, surf, bw + 8, by + 6, Object.assign({ gel: false, meniscus: s * 0.02 }, liquid, { t }));
    ctx.restore();
  }
  if (contents) contents(ctx, { cx, by, s, surf, bw });
  glassShine(ctx, cx - bw / 2, top, bw, s, { strength: 0.9 });
  ctx.restore();
  ctx.save(); outline();
  ctx.strokeStyle = 'rgba(70,100,90,.55)'; ctx.lineWidth = 1.1; ctx.stroke();
  // градуювання
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8;
  for (let i = 1; i <= 3; i++) { const yy = by - s * 0.16 * i, hw = bw / 2 * (1 - i * 0.18); ctx.beginPath(); ctx.moveTo(cx - hw * 0.35, yy); ctx.lineTo(cx - hw * 0.1, yy); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(cx, top, nw / 2 + 1.5, nw * 0.16, 0, 0, TAU); ctx.strokeStyle = 'rgba(80,110,100,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
  if (pk) plug(ctx, cx, top, nw, pk);
  if (label) tagSmall(ctx, cx, by + 16, label);
  return { surf, bw, top };
}

/** Культуральна банка (з кришкою). */
export function jar(ctx, x, y, w, h, { medium = { level: 0.22 }, contents = null, lid = 'cap', label = '' } = {}) {
  const r = Math.min(10, w * 0.12);
  shadow(ctx, x + w / 2 + w * 0.08, y + h + 1, w * 0.62, w * 0.11, 0.3);
  ctx.save(); roundRect(ctx, x, y + h * 0.06, w, h * 0.94, r); ctx.fillStyle = 'rgba(225,240,235,.30)'; ctx.fill(); ctx.clip();
  const inner = { x: x + 3, y: y + h * 0.06, w: w - 6, h: h * 0.94 - 3, surface: y + h * (1 - medium.level) };
  if (medium.level > 0) mediumFill(ctx, x, inner.surface, w, y + h, Object.assign({ meniscus: 2 }, medium));
  if (contents) contents(ctx, inner);
  glassShine(ctx, x, y, w, h, { strength: 0.85 });
  ctx.restore();
  ctx.save(); roundRect(ctx, x, y + h * 0.06, w, h * 0.94, r); ctx.strokeStyle = 'rgba(70,100,90,.5)'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore();
  if (lid) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#173B27'); g.addColorStop(0.28, '#4A9A68'); g.addColorStop(0.5, '#2E6B47'); g.addColorStop(1, '#0F281A');
    ctx.fillStyle = g; roundRect(ctx, x - 2, y, w + 4, h * 0.09, 3); ctx.fill();
  }
  if (label) tagSmall(ctx, x + w / 2, y + h + 15, label);
  return inner;
}

/**
 * Чашка Петрі в ракурсі 3/4: центр (cx, cy), радіус r, нахил tilt (= ry/rx).
 * contents(ctx, {cx, cy, rx, ry, top}) — малює вміст у площині агару (вже обрізано по чашці).
 */
export function petri(ctx, cx, cy, r, { tilt = 0.42, medium = { color: MAT.agar }, lid = true, contents = null, depth = 0.16, label = '' } = {}) {
  const rx = r, ry = r * tilt, d = r * depth;
  shadow(ctx, cx + r * 0.08, cy + d + ry * 0.35, r * 1.08, ry * 1.1, 0.26);
  ctx.save();
  // бічна стінка дна
  ctx.beginPath(); ctx.ellipse(cx, cy + d, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); ctx.closePath();
  const sg = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  sg.addColorStop(0, 'rgba(120,150,140,.45)'); sg.addColorStop(0.2, 'rgba(255,255,255,.55)'); sg.addColorStop(0.5, 'rgba(210,228,222,.35)'); sg.addColorStop(1, 'rgba(110,140,130,.5)');
  ctx.fillStyle = sg; ctx.fill();
  // середовище
  const c = hex(medium.color || MAT.agar);
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy + d * 0.35, rx - 2, ry - 1, 0, 0, TAU); ctx.clip();
  const mg = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, r * 0.1, cx, cy, r * 1.05);
  mg.addColorStop(0, rgba(shade(c, 0.18), 0.95)); mg.addColorStop(0.7, rgba(c, 0.92)); mg.addColorStop(1, rgba(shade(c, -0.22), 0.95));
  ctx.fillStyle = mg; ctx.fillRect(cx - rx, cy - ry, 2 * rx, 2 * ry + d);
  if (contents) contents(ctx, { cx, cy: cy + d * 0.35, rx: rx - 2, ry: ry - 1, top: cy });
  ctx.restore();
  // кришка
  if (lid) {
    ctx.beginPath(); ctx.ellipse(cx, cy - d * 0.25, rx + 2, ry + 1, 0, 0, TAU);
    const lg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.4, cy + ry);
    lg.addColorStop(0, 'rgba(255,255,255,.34)'); lg.addColorStop(0.35, 'rgba(255,255,255,.04)'); lg.addColorStop(0.62, 'rgba(255,255,255,.16)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.fill();
    ctx.strokeStyle = 'rgba(80,110,100,.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(cx, cy - d * 0.25, rx - 2, ry - 1.5, 0, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(80,110,100,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy + d, rx, ry, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
  if (label) tagSmall(ctx, cx, cy + d + ry + 16, label);
  return { cx, cy: cy + d * 0.35, rx: rx - 2, ry: ry - 1 };
}

/** Хімічний стакан / кювета зі шкалою. */
export function beaker(ctx, x, y, w, h, { liquid = { level: 0.5, color: '#DDEBF0' }, label = '', scale = true } = {}) {
  shadow(ctx, x + w / 2 + w * 0.08, y + h + 1, w * 0.62, w * 0.1, 0.28);
  ctx.save(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y + h - 4); ctx.quadraticCurveTo(x + 2, y + h, x + 6, y + h); ctx.lineTo(x + w - 6, y + h); ctx.quadraticCurveTo(x + w - 2, y + h, x + w - 2, y + h - 4); ctx.lineTo(x + w, y); ctx.closePath();
  ctx.fillStyle = 'rgba(225,240,235,.28)'; ctx.fill(); ctx.save(); ctx.clip();
  if (liquid.level > 0) mediumFill(ctx, x, y + h * (1 - liquid.level), w, y + h, Object.assign({ gel: false, meniscus: 2 }, liquid));
  glassShine(ctx, x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,100,90,.55)'; ctx.lineWidth = 1.1; ctx.stroke();
  if (scale) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.8; for (let i = 1; i < 5; i++) { const yy = y + h - h * 0.18 * i; ctx.beginPath(); ctx.moveTo(x + w * 0.62, yy); ctx.lineTo(x + w * (i % 2 ? 0.74 : 0.8), yy); ctx.stroke(); } }
  ctx.restore();
  if (label) tagSmall(ctx, x + w / 2, y + h + 15, label);
}

/* ---------------- Біологічні об'єкти ---------------- */
/**
 * Калюс: скупчення округлих горбків із затіненням, зерном і вологим полиском.
 * state: {color (hex), friable 0..1 (пухкий/компактний), green 0..1, brown 0..1, size}
 */
export function callus(ctx, cx, by, size, { color = MAT.callusWhite, friable = 0.4, green = 0, brown = 0, seed = 5, glossy = 0.7, n = 0 } = {}) {
  if (size < 1) return;
  const R = rng(seed);
  let base = hex(color);
  if (green > 0) base = mix(base, hex(MAT.callusGreen), clamp(green, 0, 1));
  if (brown > 0) base = mix(base, hex(MAT.callusBrown), clamp(brown, 0, 1));
  const count = n || Math.round(14 + size * (0.5 + friable * 0.9));
  const blobs = [];
  for (let i = 0; i < count; i++) {
    const a = R() * Math.PI, rr = Math.pow(R(), 0.7) * size * 0.62;
    const px = cx + Math.cos(a) * rr * (1.15 + friable * 0.25) * (R() > 0.5 ? 1 : -1);
    const py = by - Math.abs(Math.sin(a)) * rr * 0.9 - size * 0.12;
    const r = size * (0.12 + R() * (0.16 - friable * 0.05)) * (1 - rr / size * 0.35);
    blobs.push({ x: px, y: py, r: Math.max(1, r), k: R() });
  }
  blobs.sort((a, b) => a.y - b.y);
  shadow(ctx, cx + size * 0.05, by + 1, size * 0.85, size * 0.16, 0.35);
  // основа (тінь у середовищі)
  ctx.save();
  for (const b of blobs) {
    const c = mix(base, b.k > 0.75 ? shade(base, 0.12) : shade(base, -0.06), b.k);
    const brownSpot = brown > 0.3 && b.k < brown * 0.6;
    const cc = brownSpot ? mix(c, hex(MAT.callusDead), 0.55) : c;
    const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.45, b.r * 0.08, b.x, b.y, b.r * 1.05);
    g.addColorStop(0, rgba(shade(cc, 0.32))); g.addColorStop(0.55, rgba(cc)); g.addColorStop(1, rgba(shade(cc, -0.38)));
    ctx.fillStyle = g; ctx.beginPath();
    // нерівний край горбка
    const pts = 10;
    for (let j = 0; j <= pts; j++) { const t = j / pts * TAU, rr = b.r * (0.86 + 0.18 * noise(Math.cos(t) * 2 + b.x * 0.1, Math.sin(t) * 2 + b.y * 0.1, seed)); const X = b.x + Math.cos(t) * rr, Y = b.y + Math.sin(t) * rr * 0.92; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.fill();
    if (glossy > 0 && b.r > 3) { ctx.fillStyle = `rgba(255,255,255,${0.35 * glossy})`; ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.35, b.y - b.r * 0.42, b.r * 0.22, b.r * 0.12, -0.5, 0, TAU); ctx.fill(); }
  }
  // дрібнозерниста поверхня
  ctx.globalAlpha = 0.5;
  for (const b of blobs) { if (b.r < 4) continue; for (let i = 0; i < b.r * 0.9; i++) { const a = R() * TAU, rr = R() * b.r * 0.8; ctx.fillStyle = R() > 0.5 ? 'rgba(255,255,255,.35)' : rgba(shade(base, -0.4), 0.35); ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, 0.5 + R() * 0.7, 0, TAU); ctx.fill(); } }
  ctx.restore();
}

/** Листок (еліпсоїдний, з жилками). */
export function leaf(ctx, x, y, len, ang, { color = MAT.leaf, width = 0.42, curl = 0.15, pale = 0, veins = true } = {}) {
  const c = pale > 0 ? mix(hex(color), hex(MAT.leafPale), pale) : hex(color);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const wd = len * width;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -wd * 0.9, len * 0.75, -wd * (0.7 + curl), len, 0);
  ctx.bezierCurveTo(len * 0.75, wd * (0.6 - curl), len * 0.25, wd * 0.8, 0, 0);
  const g = ctx.createLinearGradient(0, -wd, 0, wd);
  g.addColorStop(0, rgba(shade(c, 0.22))); g.addColorStop(0.5, rgba(c)); g.addColorStop(1, rgba(shade(c, -0.3)));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = rgba(shade(c, -0.35), 0.6); ctx.lineWidth = 0.6; ctx.stroke();
  if (veins && len > 8) {
    ctx.strokeStyle = rgba(shade(c, 0.35), 0.7); ctx.lineWidth = Math.max(0.5, len * 0.025);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -wd * 0.06, len * 0.95, 0); ctx.stroke();
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) { const t = i / 5; ctx.beginPath(); ctx.moveTo(len * t, -wd * 0.02); ctx.lineTo(len * (t + 0.12), -wd * 0.45 * Math.sin(Math.PI * t)); ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.12), wd * 0.38 * Math.sin(Math.PI * t)); ctx.stroke(); }
  }
  // полиск
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.ellipse(len * 0.45, -wd * 0.3, len * 0.25, wd * 0.12, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/**
 * Рослина-регенерант / мікроживець у посудині: стебло з вузлами й листками, корені в агарі.
 * opts: height (px), nodes, leafLen, roots {n, len}, sway (рад), pale (хлороз 0..1), vitro (гіпергідричність 0..1),
 *       tuber (мікробульба 0..1), seed
 */
export function plantlet(ctx, x, baseY, { height = 60, nodes = 4, leafLen = 14, roots = { n: 4, len: 20 }, sway = 0, pale = 0, vitro = 0, tuber = 0, seed = 3, color = MAT.leaf, rosette = false } = {}) {
  const R = rng(seed);
  // корені (під поверхнею, напівпрозорі в агарі)
  if (roots && roots.n > 0 && roots.len > 0) {
    ctx.save();
    for (let i = 0; i < roots.n; i++) {
      let px = x, py = baseY, a = Math.PI / 2 + (R() - 0.5) * 1.6;
      const L = roots.len * (0.6 + R() * 0.6), seg = 8;
      ctx.strokeStyle = rgba(MAT.root, 0.9); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let s = 0; s < seg; s++) { a += (R() - 0.5) * 0.5; px += Math.cos(a) * L / seg; py += Math.sin(a) * L / seg; ctx.lineTo(px, py); }
      ctx.lineWidth = Math.max(0.8, height * 0.018); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.5; ctx.stroke();
      // кореневі волоски
      ctx.strokeStyle = 'rgba(255,255,250,.35)';
      for (let k = 0; k < 6; k++) { const qx = lerp(x, px, 0.3 + k * 0.1), qy = lerp(baseY, py, 0.3 + k * 0.1); ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + (R() - 0.5) * 5, qy + R() * 3); ctx.stroke(); }
    }
    ctx.restore();
  }
  if (tuber > 0) { // мікробульба біля основи
    const tr = 4 + tuber * height * 0.12;
    const g = ctx.createRadialGradient(x + 3 - tr * 0.3, baseY - tr * 0.5, 1, x + 3, baseY - tr * 0.2, tr * 1.1);
    g.addColorStop(0, '#FBF2D6'); g.addColorStop(0.6, '#E2CC93'); g.addColorStop(1, '#A88A4E');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + 3, baseY - tr * 0.25, tr * 1.15, tr * 0.9, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,80,40,.5)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 3 + (R() - 0.5) * tr * 1.4, baseY - tr * 0.25 + (R() - 0.5) * tr, 0.8, 0, TAU); ctx.fill(); }
  }
  const stemC = mix(hex(MAT.stem), hex(MAT.leafPale), pale * 0.7);
  if (rosette) { // розетка (стевія/буряк/гербера)
    const n = 5 + nodes;
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4 + sway; leaf(ctx, x, baseY - 2, leafLen * (0.8 + R() * 0.5) * (1 + vitro * 0.2), a, { color, pale, width: 0.38 + vitro * 0.15 }); }
    return { top: baseY - leafLen };
  }
  let px = x, py = baseY, a = -Math.PI / 2;
  const seg = height / nodes, pts = [[px, py]];
  for (let i = 0; i < nodes; i++) { a += (R() - 0.5) * 0.25 + sway * (i + 1) / nodes * 0.6; px += Math.cos(a) * seg; py += Math.sin(a) * seg; pts.push([px, py]); }
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(shade(stemC, -0.25)); ctx.lineWidth = Math.max(1.4, height * 0.035 * (1 + vitro * 0.6));
  ctx.beginPath(); pts.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.stroke();
  ctx.strokeStyle = rgba(shade(stemC, 0.25), 0.8); ctx.lineWidth *= 0.4; ctx.stroke();
  ctx.restore();
  for (let i = 1; i < pts.length; i++) {
    const [X, Y] = pts[i], sz = leafLen * (0.55 + 0.45 * Math.sin(Math.PI * i / (pts.length + 0.5))) * (1 + vitro * 0.25);
    const side = i % 2 ? 1 : -1;
    leaf(ctx, X, Y, sz, side > 0 ? -0.55 + sway : Math.PI + 0.55 + sway, { color, pale, width: 0.42 + vitro * 0.2, curl: vitro * 0.3 });
    // вузол
    ctx.fillStyle = rgba(shade(stemC, -0.3)); ctx.beginPath(); ctx.arc(X, Y, Math.max(1, height * 0.02), 0, TAU); ctx.fill();
  }
  // верхівкова брунька
  const [tx, ty] = pts[pts.length - 1];
  leaf(ctx, tx, ty, leafLen * 0.5, -Math.PI / 2 - 0.35 + sway, { color, pale, veins: false });
  leaf(ctx, tx, ty, leafLen * 0.45, -Math.PI / 2 + 0.35 + sway, { color, pale, veins: false });
  return { top: ty, pts };
}

/* ---------------- Мікроскопія ---------------- */
/**
 * Поле зору мікроскопа: кругла діафрагма з віньєткою й кольоровою облямівкою.
 * draw(ctx, {cx, cy, r}) малює препарат (вже обрізано). mode: 'bright' (світле поле), 'dark' (темне поле),
 * 'fluor' (флуоресценція), 'phase' (фазовий контраст).
 */
export function microField(ctx, cx, cy, r, draw, { mode = 'bright', label = '', scale = null } = {}) {
  ctx.save();
  // корпус окуляра
  const ring = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.12);
  ring.addColorStop(0, '#0B0F0D'); ring.addColorStop(1, '#2A332E');
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  const bg = mode === 'fluor' || mode === 'dark' ? ['#0A100D', '#020403'] : mode === 'phase' ? ['#B7B9AE', '#8C8F84'] : ['#FBF8EE', '#E7E0C8'];
  const g = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.2, r * 0.1, cx, cy, r);
  g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  draw(ctx, { cx, cy, r });
  // віньєтка та хроматична облямівка
  const v = ctx.createRadialGradient(cx, cy, r * 0.62, cx, cy, r);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.86, mode === 'bright' ? 'rgba(90,70,30,.18)' : 'rgba(0,0,0,.35)'); v.addColorStop(1, 'rgba(0,0,0,.75)');
  ctx.fillStyle = v; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.strokeStyle = 'rgba(80,140,255,.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r - 1.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,140,60,.15)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r - 4, 0, TAU); ctx.stroke();
  ctx.restore();
  applyGrain(ctx, cx - r, cy - r, 2 * r, 2 * r, 0.03);
  if (scale) { // масштабна лінійка {px, text}
    ctx.save(); ctx.fillStyle = mode === 'bright' || mode === 'phase' ? '#1B2A20' : '#EAF5EC';
    const x0 = cx + r * 0.25, y0 = cy + r * 0.72;
    ctx.fillRect(x0, y0, scale.px, 3); ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(scale.text, x0 + scale.px / 2, y0 - 5); ctx.restore();
  }
  if (label) { ctx.save(); ctx.font = '600 12px system-ui, sans-serif'; ctx.fillStyle = '#E8F2EA'; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy - r * 1.1 - 6 < 12 ? cy + r * 1.1 + 16 : cy - r * 1.1 - 6); ctx.restore(); }
}

/**
 * Рослинна клітина (світле поле): клітинна стінка, цитоплазма, вакуоля, ядро, хлоропласти.
 * opts: wall (товщина), chloro (к-сть), dead (0..1 — прокрашена синім Евансом/плазмоліз), stain ('evans'|'none'),
 *       plasmolysis 0..1, seed, poly — масив вершин (для паренхіми) або null (еліпс).
 */
export function plantCell(ctx, x, y, rx, ry, { wall = 1.6, chloro = 0, dead = 0, stain = 'none', plasmolysis = 0, seed = 1, rot = 0, cyto = '#E8EBC8', nucleus = true, amyloplasts = 0 } = {}) {
  const R = rng(seed);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  // стінка
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = 'rgba(250,247,232,.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,110,70,.65)'; ctx.lineWidth = wall; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(-0.6, -0.6, rx - wall, ry - wall, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  // протопласт (стискається при плазмолізі)
  const k = 1 - plasmolysis * 0.45, prx = (rx - wall) * k, pry = (ry - wall) * k;
  const deadC = stain === 'evans' ? [40, 70, 170] : [120, 100, 70];
  const cc = dead > 0 ? mix(hex(cyto), deadC, clamp(dead, 0, 1)) : hex(cyto);
  const g = ctx.createRadialGradient(-prx * 0.3, -pry * 0.35, 1, 0, 0, Math.max(prx, pry));
  g.addColorStop(0, rgba(shade(cc, 0.25), 0.55)); g.addColorStop(1, rgba(shade(cc, -0.15), 0.85));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(plasmolysis * rx * 0.08, 0, prx, pry, 0, 0, TAU); ctx.fill();
  // вакуоля (світліша)
  if (dead < 0.5) { ctx.fillStyle = 'rgba(255,255,248,.42)'; ctx.beginPath(); ctx.ellipse(0, pry * 0.08, prx * 0.72, pry * 0.66, 0, 0, TAU); ctx.fill(); }
  // хлоропласти по периметру
  for (let i = 0; i < chloro; i++) {
    const a = R() * TAU, rr = 0.82 + R() * 0.12, cxp = Math.cos(a) * prx * rr, cyp = Math.sin(a) * pry * rr;
    const cg = ctx.createRadialGradient(cxp - 0.6, cyp - 0.6, 0.2, cxp, cyp, 2.4);
    cg.addColorStop(0, '#9CD36A'); cg.addColorStop(1, dead > 0.5 ? '#4B6040' : '#2F7A2A');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cxp, cyp, 2.2, 1.5, a, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < amyloplasts; i++) { const a = R() * TAU, rr = R() * 0.6; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.strokeStyle = 'rgba(120,110,80,.4)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(Math.cos(a) * prx * rr, Math.sin(a) * pry * rr, 1.2 + R() * 1.6, 0, TAU); ctx.fill(); ctx.stroke(); }
  if (nucleus) {
    const na = R() * TAU, nx = Math.cos(na) * prx * 0.55, ny = Math.sin(na) * pry * 0.55, nr = Math.min(prx, pry) * 0.24 + 1;
    const ng = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.3, 0.3, nx, ny, nr);
    const nc = dead > 0.5 && stain === 'evans' ? [20, 40, 140] : [150, 140, 105];
    ng.addColorStop(0, rgba(shade(nc, 0.3), 0.9)); ng.addColorStop(1, rgba(shade(nc, -0.25), 0.9));
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(70,60,40,.7)'; ctx.beginPath(); ctx.arc(nx + nr * 0.2, ny - nr * 0.1, nr * 0.28, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** Протопласт — сферична клітина без стінки (світле поле): кулястий об'єм, хлоропласти, мембранний відблиск. */
export function protoplast(ctx, x, y, r, { chloro = 24, seed = 1, burst = 0, alpha = 1, tint = null } = {}) {
  const R = rng(seed);
  ctx.save(); ctx.globalAlpha = alpha;
  if (burst > 0.7) { // зруйнований: розсип хлоропластів
    for (let i = 0; i < chloro; i++) { const a = R() * TAU, d = r * (0.6 + R() * burst * 1.4); ctx.fillStyle = 'rgba(60,120,40,.7)'; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.2, 1.5, a, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  const base = tint ? hex(tint) : [214, 228, 190];
  g.addColorStop(0, rgba(shade(base, 0.45), 0.55)); g.addColorStop(0.75, rgba(base, 0.45)); g.addColorStop(1, rgba(shade(base, -0.3), 0.75));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  // хлоропласти: густіше по краю (сферична проекція)
  for (let i = 0; i < chloro; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * 0.88, px = x + Math.cos(a) * r * d, py = y + Math.sin(a) * r * d;
    const s = 1 - d * 0.35, cr = Math.max(1.2, r * 0.11) * s;
    const cg = ctx.createRadialGradient(px - cr * 0.3, py - cr * 0.3, 0.2, px, py, cr);
    cg.addColorStop(0, '#A9DA74'); cg.addColorStop(1, '#2E7428');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(px, py, cr, cr * (0.55 + 0.45 * (1 - d)), a, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(70,90,55,.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(x, y, r - 1.2, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
  ctx.restore();
}

/* ---------------- Підписи ---------------- */
export function tagSmall(ctx, x, y, text, { color = '#1F3A2A', align = 'center', size = 11, weight = 600, bg = null } = {}) {
  ctx.save(); ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (bg) { const m = ctx.measureText(text).width, px = align === 'center' ? x - m / 2 : align === 'right' ? x - m : x; ctx.fillStyle = bg; roundRect(ctx, px - 5, y - size, m + 10, size + 6, 5); ctx.fill(); }
  ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
}
/** Виноска з лінією-вказівником: від точки (ax, ay) до тексту в (tx, ty). */
export function callout(ctx, ax, ay, tx, ty, text, { dark = false, size = 11.5 } = {}) {
  ctx.save();
  ctx.strokeStyle = dark ? 'rgba(230,245,235,.75)' : 'rgba(25,55,38,.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = dark ? '#E9F4EC' : '#1F3A2A'; ctx.beginPath(); ctx.arc(ax, ay, 2, 0, TAU); ctx.fill();
  ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const m = ctx.measureText(text).width, left = tx >= ax;
  const bx = left ? tx + 2 : tx - m - 12, by = ty - size + 1;
  ctx.fillStyle = dark ? 'rgba(10,25,16,.72)' : 'rgba(255,255,255,.88)';
  roundRect(ctx, bx, by - 3, m + 10, size + 8, 6); ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.15)' : 'rgba(30,70,45,.15)'; ctx.stroke();
  ctx.fillStyle = dark ? '#F1F8F2' : '#173322'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, bx + 5, ty + 2);
  ctx.restore();
}

/* ---------------- Запуск моделі ---------------- */
/**
 * Контролер анімації: модель стартує лише після натискання «▶ Запустити»; далі «⏸ Пауза»/«▶ Продовжити».
 * Пауза автоматично, коли полотно поза екраном або вкладка прихована.
 * step(dt, t) — оновлення стану (dt у с модельного часу); draw() — перемальовування.
 */
export class Runner {
  constructor({ btn, reset = null, status = null, step, draw, speed = 1, labels = {} }) {
    this.btn = btn; this.resetBtn = reset; this.status = status; this.stepFn = step; this.drawFn = draw; this.speed = speed;
    this.L = Object.assign({ start: '▶ Запустити', pause: '⏸ Пауза', cont: '▶ Продовжити', again: '↻ Ще раз' }, labels);
    this.running = false; this.started = false; this.done = false; this.t = 0; this.last = 0; this.visible = true; this.raf = 0;
    btn.addEventListener('click', () => (this.running ? this.pause() : this.play()));
    if (reset) reset.addEventListener('click', () => this.reset());
    const host = btn.closest('section') || document.body;
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; if (this.visible && this.running) this.loop(); }).observe(host);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.running) this.loop(); });
    this.label();
  }
  label() {
    this.btn.textContent = this.running ? this.L.pause : this.done ? this.L.again : this.started ? this.L.cont : this.L.start;
    this.btn.setAttribute('aria-pressed', String(this.running));
    this.btn.classList.toggle('is-running', this.running);
  }
  play() { if (this.done) this.reset(true); this.running = true; this.started = true; this.label(); this.loop(); }
  pause() { this.running = false; this.label(); }
  finish() { this.running = false; this.done = true; this.label(); this.drawFn(); }
  reset(keepRunning = false) { this.t = 0; this.done = false; if (!keepRunning) { this.running = false; this.started = false; } this.stepFn(0, 0, true); this.label(); this.drawFn(); }
  loop() {
    cancelAnimationFrame(this.raf); this.last = 0;
    const tick = (ts) => {
      if (!this.running || !this.visible || document.hidden) { this.last = 0; return; }
      const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 0; this.last = ts;
      this.t += dt * this.speed;
      this.stepFn(dt * this.speed, this.t, false);
      this.drawFn();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}

/** Перемалювати полотно при зміні розміру (з дебаунсом). */
export function onResize(el, fn) {
  let tm = 0;
  const ro = new ResizeObserver(() => { clearTimeout(tm); tm = setTimeout(fn, 60); });
  ro.observe(el);
  return ro;
}

/** Відкриває фото у лайтбоксі сайту (через прихований якір, якщо підключено lightbox.js). */
export function $(id) { return document.getElementById(id); }
