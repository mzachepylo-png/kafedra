// Тема 1. Власні 2.5D-об'єкти: автоклав у розрізі, манометр, ваги, магнітна мішалка, пляшка з темного скла,
// колба Бунзена з фільтром Зейтца, спиртівка, насіння сої, диски моркви/картоплі, мікробні колонії й міцелій,
// живець верби. Світло зверху-ліворуч, м'які тіні, відблиски; текстури кешуються в offscreen-полотна.
import { TAU, clamp, lerp, rng, noise, fbm, hex, rgba, mix, shade, shadow, roundRect, offscreen, MAT } from './kit.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export function font(ctx, size, weight = 600) { ctx.font = `${weight} ${size}px ${FONT}`; }

/** Підпис-«плашка» з фоном (не перекривається з об'єктами, читається на будь-якому тлі). */
export function chip(ctx, x, y, text, { size = 11.5, align = 'center', dark = false, color = null, bg = null, bold = 700 } = {}) {
  ctx.save(); font(ctx, size, bold);
  const m = ctx.measureText(text).width, pad = 6;
  const bx = align === 'center' ? x - m / 2 - pad : align === 'right' ? x - m - 2 * pad : x;
  roundRect(ctx, bx, y - size - 3, m + 2 * pad, size + 9, 6);
  ctx.fillStyle = bg || (dark ? 'rgba(8,24,15,.78)' : 'rgba(255,255,255,.9)'); ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(30,70,45,.16)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color || (dark ? '#EEF7F0' : '#173322'); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillText(text, bx + pad, y + 1);
  ctx.restore();
  return m + 2 * pad;
}

/** Колірна шкала температури (синій → зелений → жовтий → червоний). */
export function tempColor(T, lo = 20, hi = 125) {
  const t = clamp((T - lo) / (hi - lo), 0, 1);
  const stops = [[0, [70, 120, 200]], [0.45, [90, 175, 150]], [0.7, [235, 200, 80]], [0.88, [235, 120, 50]], [1, [200, 40, 40]]];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const a = stops[i - 1], b = stops[i]; return mix(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
  return stops[stops.length - 1][1];
}

/* ---------------- Метал ---------------- */
/** Горизонтальний градієнт полірованої нержавійки для циліндра від x0 до x1. */
export function steel(ctx, x0, x1, { dark = 0, warm = 0 } = {}) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  const k = (c) => rgba(warm ? mix(shade(c, -dark), [235, 170, 120], warm * 0.25) : shade(c, -dark));
  g.addColorStop(0, k([92, 100, 104])); g.addColorStop(0.08, k([170, 178, 182])); g.addColorStop(0.18, k([238, 242, 244]));
  g.addColorStop(0.26, k([150, 158, 162])); g.addColorStop(0.5, k([196, 202, 205])); g.addColorStop(0.72, k([126, 134, 138]));
  g.addColorStop(0.86, k([210, 214, 216])); g.addColorStop(1, k([78, 86, 90]));
  return g;
}

/** Шліфування (тонкі горизонтальні риски), кешоване. */
const brushCache = new Map();
function brushed(w, h) {
  const k = `${w | 0}x${h | 0}`;
  if (brushCache.has(k)) return brushCache.get(k);
  const c = offscreen(w, h), x = c.getContext('2d'), R = rng(11);
  for (let i = 0; i < h * 1.4; i++) { const y = R() * h; x.strokeStyle = `rgba(255,255,255,${0.04 + R() * 0.07})`; x.lineWidth = 0.6; x.beginPath(); x.moveTo(R() * w * 0.3, y); x.lineTo(w * (0.7 + R() * 0.3), y + (R() - 0.5)); x.stroke(); }
  for (let i = 0; i < h * 0.8; i++) { const y = R() * h; x.strokeStyle = `rgba(0,0,0,${0.03 + R() * 0.05})`; x.lineWidth = 0.5; x.beginPath(); x.moveTo(R() * w * 0.4, y); x.lineTo(w * (0.6 + R() * 0.4), y); x.stroke(); }
  brushCache.set(k, c); if (brushCache.size > 20) brushCache.delete(brushCache.keys().next().value);
  return c;
}

/* ---------------- Манометр ---------------- */
/** Круглий манометр: value у кгс/см² (атм надлишкового тиску), шкала 0..max. */
export function gauge(ctx, cx, cy, r, value, { max = 3, unit = 'кгс/см²', red = 2.5, label = 'МАНОМЕТР', minor = 0.1, major = 0.5 } = {}) {
  ctx.save();
  shadow(ctx, cx + r * 0.1, cy + r * 1.02, r * 0.95, r * 0.22, 0.25);
  // корпус-обідок
  let g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.5, r * 0.2, cx, cy, r * 1.12);
  g.addColorStop(0, '#F5F7F8'); g.addColorStop(0.55, '#9AA3A8'); g.addColorStop(1, '#4A5357');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, TAU); ctx.fill();
  // циферблат
  g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#E3E6E1');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 0.95, 0, TAU); ctx.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = (v) => a0 + (a1 - a0) * clamp(v / max, 0, 1.04);
  // червона зона
  ctx.strokeStyle = 'rgba(200,40,40,.85)'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, ang(red), ang(max)); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,150,80,.75)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, ang(1), ang(1.2)); ctx.stroke();
  // поділки
  ctx.strokeStyle = '#1E2A24'; ctx.fillStyle = '#1E2A24';
  font(ctx, Math.max(8, r * 0.2), 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let v = 0; v <= max + 1e-9; v += minor) {
    const a = ang(v), isM = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    ctx.lineWidth = isM ? 1.6 : 0.7;
    const r0 = r * (isM ? 0.68 : 0.74), r1 = r * 0.86;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    if (isM && r > 22 && Math.abs(v - Math.round(v)) < 1e-6) ctx.fillText(String(Math.round(v)), cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
  }
  font(ctx, Math.max(7, r * 0.12), 600); ctx.fillStyle = '#56625C';
  if (unit && r > 20) ctx.fillText(unit, cx, cy + r * 0.66);
  if (label && r > 34) ctx.fillText(label, cx, cy - r * 0.32);
  // стрілка
  const a = ang(value);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(-r * 0.12, 2.5); ctx.lineTo(r * 0.82, 1.5); ctx.lineTo(-r * 0.12, -1.5); ctx.fill();
  ctx.fillStyle = '#B42318'; ctx.beginPath(); ctx.moveTo(-r * 0.14, r * 0.03); ctx.lineTo(r * 0.8, 0); ctx.lineTo(-r * 0.14, -r * 0.03); ctx.closePath(); ctx.fill();
  ctx.restore();
  g = ctx.createRadialGradient(cx - 2, cy - 2, 0.5, cx, cy, r * 0.1);
  g.addColorStop(0, '#E9EDEF'); g.addColorStop(1, '#3A4246');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 0.09, 0, TAU); ctx.fill();
  // скло: відблиск
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.42, r * 0.18, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ---------------- Пара ---------------- */
/** Струмені пари / туману (напівпрозорі клуби), t — час (с). */
export function steamPuffs(ctx, x, y, { t = 0, n = 6, spread = 30, rise = 60, a = 0.35, seed = 3, scale = 1 } = {}) {
  if (a <= 0.01) return;
  const R = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ph = (t * (0.25 + R() * 0.2) + R()) % 1, px = x + (R() - 0.5) * spread + Math.sin(t * 1.3 + i) * 6 * ph, py = y - ph * rise;
    const rr = (6 + ph * 18) * scale * (0.7 + R() * 0.6);
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, `rgba(255,255,255,${a * (1 - ph)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ---------------- Пляшка з темного скла ---------------- */
export function darkBottle(ctx, x, by, w, h, { label = '', sub = '', fill = 0.8, liquid = '#E9E6CF', cap = '#1D2B23' } = {}) {
  const neck = w * 0.36, sh = h * 0.28, top = by - h;
  const path = () => {
    ctx.beginPath(); ctx.moveTo(x + w / 2 - neck / 2, top + h * 0.06); ctx.lineTo(x + w / 2 - neck / 2, top + h * 0.14);
    ctx.bezierCurveTo(x + w / 2 - neck / 2, top + sh * 0.9, x, top + sh * 0.7, x, top + sh + 6);
    ctx.lineTo(x, by - 6); ctx.quadraticCurveTo(x, by, x + 6, by); ctx.lineTo(x + w - 6, by); ctx.quadraticCurveTo(x + w, by, x + w, by - 6);
    ctx.lineTo(x + w, top + sh + 6); ctx.bezierCurveTo(x + w, top + sh * 0.7, x + w / 2 + neck / 2, top + sh * 0.9, x + w / 2 + neck / 2, top + h * 0.14);
    ctx.lineTo(x + w / 2 + neck / 2, top + h * 0.06); ctx.closePath();
  };
  shadow(ctx, x + w * 0.58, by + 1, w * 0.62, w * 0.12, 0.32);
  ctx.save(); path();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#2A1608'); g.addColorStop(0.18, '#6B3C14'); g.addColorStop(0.3, '#8A5420'); g.addColorStop(0.62, '#4B2A0E'); g.addColorStop(1, '#1E0F05');
  ctx.fillStyle = g; ctx.fill(); ctx.clip();
  if (fill > 0) { const ly = by - (h - sh) * fill; ctx.fillStyle = 'rgba(30,14,4,.35)'; ctx.fillRect(x, ly, w, by - ly); ctx.strokeStyle = 'rgba(255,210,150,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke(); }
  // відблиски
  ctx.fillStyle = 'rgba(255,230,190,.35)'; ctx.fillRect(x + w * 0.14, top + sh, w * 0.06, h - sh - 8);
  ctx.fillStyle = 'rgba(255,230,190,.14)'; ctx.fillRect(x + w * 0.8, top + sh + 8, w * 0.04, h - sh - 20);
  ctx.restore();
  // кришка
  const cg = ctx.createLinearGradient(x + w / 2 - neck / 2, 0, x + w / 2 + neck / 2, 0);
  cg.addColorStop(0, rgba(shade(hex(cap), -0.3))); cg.addColorStop(0.35, rgba(shade(hex(cap), 0.35))); cg.addColorStop(1, rgba(shade(hex(cap), -0.4)));
  ctx.fillStyle = cg; roundRect(ctx, x + w / 2 - neck / 2 - 2, top - 2, neck + 4, h * 0.11, 3); ctx.fill();
  // етикетка
  if (label) {
    const ly = top + sh + (h - sh) * 0.18, lh = Math.min((h - sh) * 0.5, 40);
    ctx.save(); roundRect(ctx, x + 3, ly, w - 6, lh, 3);
    const lg = ctx.createLinearGradient(x, 0, x + w, 0); lg.addColorStop(0, '#D8D2C0'); lg.addColorStop(0.3, '#FFFDF5'); lg.addColorStop(1, '#CFC8B4');
    ctx.fillStyle = lg; ctx.fill();
    ctx.fillStyle = '#1C2E22'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = Math.min(12, w * 0.2); font(ctx, fs, 800);
    while (fs > 7 && ctx.measureText(label).width > w - 10) { fs -= 0.5; font(ctx, fs, 800); }
    ctx.fillText(label, x + w / 2, ly + lh * (sub ? 0.36 : 0.5));
    if (sub) { let s2 = Math.min(10, w * 0.16); font(ctx, s2, 600); while (s2 > 6 && ctx.measureText(sub).width > w - 10) { s2 -= 0.5; font(ctx, s2, 600); } ctx.fillStyle = '#4E5E54'; ctx.fillText(sub, x + w / 2, ly + lh * 0.72); }
    ctx.restore();
  }
}

/* ---------------- Аналітичні ваги ---------------- */
/** Аналітичні ваги зі скляною захисною шафкою. Повертає {px, py} — центр чашки. */
export function balance(ctx, x, by, w, { reading = '0,0000 g', heap = 0, heapColor = '#FFFFFF', doors = 0 } = {}) {
  const h = w * 0.92, base = w * 0.24, top = by - h;
  shadow(ctx, x + w * 0.55, by + 2, w * 0.62, w * 0.08, 0.35);
  // корпус-основа
  let g = ctx.createLinearGradient(0, by - base, 0, by);
  g.addColorStop(0, '#F4F5F2'); g.addColorStop(0.6, '#D9DCD6'); g.addColorStop(1, '#AEB3AC');
  ctx.fillStyle = g; roundRect(ctx, x, by - base, w, base, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.stroke();
  // дисплей
  const dw = w * 0.5, dh = base * 0.42, dx = x + w * 0.25, dy = by - base * 0.72;
  ctx.fillStyle = '#20272A'; roundRect(ctx, dx - 3, dy - 3, dw + 6, dh + 6, 5); ctx.fill();
  g = ctx.createLinearGradient(0, dy, 0, dy + dh); g.addColorStop(0, '#0E2416'); g.addColorStop(1, '#06140C');
  ctx.fillStyle = g; roundRect(ctx, dx, dy, dw, dh, 3); ctx.fill();
  ctx.fillStyle = '#7CF29A'; ctx.shadowColor = 'rgba(124,242,154,.7)'; ctx.shadowBlur = 6;
  let fs = dh * 0.66; font(ctx, fs, 700); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  while (fs > 7 && ctx.measureText(reading).width > dw - 8) { fs -= 0.5; font(ctx, fs, 700); }
  ctx.fillText(reading, dx + dw - 5, dy + dh / 2 + 1); ctx.shadowBlur = 0;
  // кнопки
  for (let i = 0; i < 2; i++) { ctx.fillStyle = '#5B6660'; ctx.beginPath(); ctx.arc(x + w * (0.1 + i * 0.07), by - base * 0.5, w * 0.022, 0, TAU); ctx.fill(); }
  // шафка (скло)
  const sx = x + w * 0.04, sw = w * 0.92, sy = top, sh = h - base;
  g = ctx.createLinearGradient(sx, 0, sx + sw, 0);
  g.addColorStop(0, 'rgba(200,225,220,.35)'); g.addColorStop(0.12, 'rgba(255,255,255,.45)'); g.addColorStop(0.2, 'rgba(220,235,232,.12)'); g.addColorStop(1, 'rgba(170,200,195,.30)');
  ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = 'rgba(90,110,105,.55)'; ctx.lineWidth = 1.4; ctx.strokeRect(sx, sy, sw, sh);
  ctx.fillStyle = '#C9CEC8'; ctx.fillRect(sx - 2, sy - 5, sw + 4, 6);
  // чашка
  const px = x + w / 2, py = by - base - sh * 0.12;
  ctx.fillStyle = '#7C8681'; ctx.fillRect(px - 2, py, 4, sh * 0.1);
  g = ctx.createLinearGradient(px - w * 0.2, 0, px + w * 0.2, 0); g.addColorStop(0, '#8E979B'); g.addColorStop(0.3, '#F2F4F5'); g.addColorStop(1, '#7D868A');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, w * 0.2, w * 0.04, 0, 0, TAU); ctx.fill();
  // човник для зважування з наважкою
  ctx.fillStyle = '#EDEFF3'; ctx.strokeStyle = 'rgba(80,90,100,.5)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(px - w * 0.13, py - w * 0.03); ctx.lineTo(px + w * 0.13, py - w * 0.03); ctx.lineTo(px + w * 0.1, py); ctx.lineTo(px - w * 0.1, py); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (heap > 0.01) crystals(ctx, px, py - w * 0.028, w * 0.11 * Math.sqrt(heap), w * 0.06 * Math.sqrt(heap), heapColor, 21);
  // дверцята-відблиск
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(sx + sw * 0.08 + doors * sw * 0.3, sy + 4); ctx.lineTo(sx + sw * 0.16 + doors * sw * 0.3, sy + 4); ctx.lineTo(sx + sw * 0.04 + doors * sw * 0.3, sy + sh - 4); ctx.lineTo(sx + doors * sw * 0.3 + 1, sy + sh - 4); ctx.fill();
  return { px, py };
}

/** Купка кристалів солі. */
export function crystals(ctx, cx, by, rx, ry, color = '#FFFFFF', seed = 1) {
  const R = rng(seed), c = hex(color);
  ctx.save();
  ctx.fillStyle = rgba(shade(c, -0.2), 0.9); ctx.beginPath(); ctx.ellipse(cx, by, rx, ry * 0.5, 0, Math.PI, 0); ctx.fill();
  const g = ctx.createRadialGradient(cx - rx * 0.3, by - ry * 0.6, 1, cx, by, rx);
  g.addColorStop(0, rgba(shade(c, 0.3))); g.addColorStop(1, rgba(shade(c, -0.18)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - rx, by); ctx.quadraticCurveTo(cx - rx * 0.2, by - ry * 1.5, cx + rx, by); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 26; i++) { const a = R(), px = cx + (a - 0.5) * 1.8 * rx, top = by - ry * 1.4 * (1 - Math.pow((px - cx) / rx, 2)); const py = lerp(top, by, R() * 0.8); ctx.fillStyle = R() > 0.5 ? 'rgba(255,255,255,.9)' : rgba(shade(c, -0.3), 0.6); ctx.fillRect(px, py, 1.1, 1.1); }
  ctx.restore();
}

/* ---------------- Магнітна мішалка ---------------- */
export function stirrer(ctx, x, by, w, { on = false, t = 0, hot = 0 } = {}) {
  const h = w * 0.3;
  shadow(ctx, x + w * 0.55, by + 2, w * 0.6, w * 0.08, 0.32);
  let g = ctx.createLinearGradient(0, by - h, 0, by); g.addColorStop(0, '#E9ECE8'); g.addColorStop(1, '#A9AFA8');
  ctx.fillStyle = g; roundRect(ctx, x, by - h, w, h, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.stroke();
  // плита
  g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#9BA3A6'); g.addColorStop(0.3, '#F0F2F3'); g.addColorStop(1, '#8B9397');
  ctx.fillStyle = g; roundRect(ctx, x + w * 0.06, by - h - 4, w * 0.88, 6, 2); ctx.fill();
  if (hot > 0) { ctx.fillStyle = `rgba(255,90,40,${0.35 * hot})`; roundRect(ctx, x + w * 0.06, by - h - 4, w * 0.88, 6, 2); ctx.fill(); }
  // ручки
  for (let i = 0; i < 2; i++) {
    const kx = x + w * (0.3 + i * 0.4), ky = by - h * 0.45;
    g = ctx.createRadialGradient(kx - 2, ky - 2, 1, kx, ky, h * 0.22); g.addColorStop(0, '#5C6863'); g.addColorStop(1, '#1D2622');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kx, ky, h * 0.22, 0, TAU); ctx.fill();
    const a = (i === 0 && on) ? -0.6 + t * 0 : -2.2; ctx.strokeStyle = '#E7ECEA'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(a) * h * 0.18, ky + Math.sin(a) * h * 0.18); ctx.stroke();
  }
  ctx.fillStyle = on ? '#4ADE80' : '#53605A'; ctx.beginPath(); ctx.arc(x + w * 0.5, by - h * 0.45, 2.4, 0, TAU); ctx.fill();
  return by - h - 4;
}

/** Мірна колба (кругла з довгою шийкою і міткою). cx — центр, by — дно, s — діаметр кулі. */
export function volumetric(ctx, cx, by, s, { level = 0, color = '#EAF2EF', label = '', t = 0, swirl = 0 } = {}) {
  const r = s / 2, cy = by - r * 0.95, nw = s * 0.2, nTop = cy - r - s * 0.95, mark = cy - r - s * 0.55;
  const dl = Math.asin(clamp(nw / 2 / r, 0, 0.9));
  const outline = () => {
    ctx.beginPath(); ctx.moveTo(cx - nw / 2, nTop); ctx.lineTo(cx - nw / 2, cy - r * Math.cos(dl));
    ctx.arc(cx, cy, r, -Math.PI / 2 - dl, -Math.PI / 2 + dl, true);
    ctx.lineTo(cx + nw / 2, nTop);
  };
  shadow(ctx, cx + s * 0.08, by + 1, r * 0.95, r * 0.18, 0.3);
  ctx.save(); outline(); ctx.closePath(); ctx.fillStyle = 'rgba(225,240,235,.28)'; ctx.fill(); ctx.clip();
  if (level > 0) {
    // рівень: 0..1 — куля, >1 — шийка до мітки
    const ly = level <= 1 ? by - (by - (cy - r)) * level : lerp(cy - r, mark, clamp(level - 1, 0, 1));
    const c = hex(color);
    const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, rgba(shade(c, -0.25), 0.7)); g.addColorStop(0.3, rgba(shade(c, 0.1), 0.55)); g.addColorStop(1, rgba(shade(c, -0.3), 0.7));
    ctx.fillStyle = g; ctx.fillRect(cx - r - 2, ly, s + 4, by - ly + 2);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - r, ly + Math.sin(t * 8) * swirl); ctx.lineTo(cx + r, ly - Math.sin(t * 8) * swirl); ctx.stroke();
  }
  const sg = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  sg.addColorStop(0, 'rgba(40,70,60,.28)'); sg.addColorStop(0.16, 'rgba(255,255,255,.6)'); sg.addColorStop(0.26, 'rgba(255,255,255,.06)'); sg.addColorStop(0.85, 'rgba(255,255,255,.25)'); sg.addColorStop(1, 'rgba(40,70,60,.32)');
  ctx.fillStyle = sg; ctx.fillRect(cx - r, nTop, s, by - nTop);
  ctx.restore();
  ctx.save(); outline(); ctx.strokeStyle = 'rgba(70,100,90,.6)'; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.strokeStyle = 'rgba(30,60,45,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, mark, nw / 2, nw * 0.12, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, nTop, nw / 2 + 1.5, nw * 0.15, 0, 0, TAU); ctx.strokeStyle = 'rgba(80,110,100,.6)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
  if (label) { ctx.save(); font(ctx, Math.max(8, s * 0.12), 700); ctx.fillStyle = 'rgba(30,55,40,.75)'; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy + r * 0.25); ctx.restore(); }
  return { mark, nTop, cy, r };
}

/* ---------------- Спиртівка ---------------- */
export function spiritLamp(ctx, cx, by, s, { t = 0, lit = true } = {}) {
  const w = s, h = s * 0.62;
  shadow(ctx, cx + s * 0.08, by + 1, w * 0.6, w * 0.1, 0.3);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx - w * 0.18, by - h); ctx.bezierCurveTo(cx - w * 0.2, by - h * 0.7, cx - w / 2, by - h * 0.55, cx - w / 2, by - h * 0.25);
  ctx.quadraticCurveTo(cx - w / 2, by, cx - w * 0.3, by); ctx.lineTo(cx + w * 0.3, by); ctx.quadraticCurveTo(cx + w / 2, by, cx + w / 2, by - h * 0.25);
  ctx.bezierCurveTo(cx + w / 2, by - h * 0.55, cx + w * 0.2, by - h * 0.7, cx + w * 0.18, by - h); ctx.closePath();
  ctx.fillStyle = 'rgba(225,240,235,.35)'; ctx.fill(); ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(205,225,240,.45)'; ctx.fillRect(cx - w / 2, by - h * 0.42, w, h);
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, 'rgba(40,70,60,.3)'); g.addColorStop(0.2, 'rgba(255,255,255,.6)'); g.addColorStop(0.3, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(40,70,60,.35)');
  ctx.fillStyle = g; ctx.fillRect(cx - w / 2, by - h, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(70,100,90,.55)'; ctx.lineWidth = 1; ctx.stroke();
  // ковпачок-гніздо й ґніт
  ctx.fillStyle = '#9CA6A0'; roundRect(ctx, cx - w * 0.14, by - h - s * 0.08, w * 0.28, s * 0.09, 2); ctx.fill();
  ctx.fillStyle = '#F2EBDA'; ctx.fillRect(cx - 1.5, by - h - s * 0.16, 3, s * 0.09);
  ctx.restore();
  if (lit) flame(ctx, cx, by - h - s * 0.15, s * 0.55, t);
}

export function flame(ctx, x, y, size, t = 0) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fl = 1 + Math.sin(t * 17) * 0.05 + Math.sin(t * 29) * 0.04, sw = Math.sin(t * 7) * size * 0.04;
  const shape = (k) => { ctx.beginPath(); ctx.moveTo(x - size * 0.16 * k, y); ctx.bezierCurveTo(x - size * 0.2 * k, y - size * 0.4 * k * fl, x + sw, y - size * 0.75 * k * fl, x + sw * 1.4, y - size * k * fl); ctx.bezierCurveTo(x + sw, y - size * 0.75 * k * fl, x + size * 0.2 * k, y - size * 0.4 * k * fl, x + size * 0.16 * k, y); ctx.closePath(); };
  let g = ctx.createRadialGradient(x, y - size * 0.3, 1, x, y - size * 0.4, size * 0.8);
  g.addColorStop(0, 'rgba(255,220,140,.75)'); g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g; shape(1); ctx.fill();
  g = ctx.createLinearGradient(0, y, 0, y - size * 0.5); g.addColorStop(0, 'rgba(80,140,255,.85)'); g.addColorStop(1, 'rgba(80,140,255,0)');
  ctx.fillStyle = g; shape(0.55); ctx.fill();
  ctx.restore();
}

/* ---------------- Колба Бунзена з фільтром Зейтца ---------------- */
/** Повертає геометрію: {tipX, tipY (кінчик носика фільтра), surf, arm: [x,y]}. */
export function bunsenFlask(ctx, cx, by, s, { level = 0, color = '#EFE9C9', cloudy = 0 } = {}) {
  const bw = s * 0.95, nw = s * 0.3, top = by - s, nh = s * 0.32;
  const outline = () => {
    ctx.beginPath(); ctx.moveTo(cx - nw / 2, top); ctx.lineTo(cx - nw / 2, top + nh);
    ctx.bezierCurveTo(cx - nw / 2, top + nh + s * 0.08, cx - bw / 2 + s * 0.02, by - s * 0.12, cx - bw / 2, by - s * 0.05);
    ctx.quadraticCurveTo(cx - bw / 2 - 1, by, cx - bw / 2 + s * 0.05, by); ctx.lineTo(cx + bw / 2 - s * 0.05, by);
    ctx.quadraticCurveTo(cx + bw / 2 + 1, by, cx + bw / 2, by - s * 0.05);
    ctx.bezierCurveTo(cx + bw / 2 - s * 0.02, by - s * 0.12, cx + nw / 2, top + nh + s * 0.08, cx + nw / 2, top + nh);
    ctx.lineTo(cx + nw / 2, top);
  };
  shadow(ctx, cx + s * 0.08, by + 2, bw * 0.62, bw * 0.12, 0.32);
  // бічний відросток
  const ay = top + nh * 0.35;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(120,150,140,.55)'; ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.moveTo(cx + nw / 2 - 2, ay + s * 0.04); ctx.lineTo(cx + nw / 2 + s * 0.2, ay - s * 0.02); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = s * 0.018; ctx.beginPath(); ctx.moveTo(cx + nw / 2, ay + s * 0.015); ctx.lineTo(cx + nw / 2 + s * 0.2, ay - s * 0.04); ctx.stroke();
  ctx.restore();
  ctx.save(); outline(); ctx.closePath(); ctx.fillStyle = 'rgba(225,240,235,.3)'; ctx.fill(); ctx.clip();
  const surf = by - s * 0.62 * level;
  if (level > 0.002) {
    const c = hex(color);
    const g = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    g.addColorStop(0, rgba(shade(c, -0.25), 0.75)); g.addColorStop(0.3, rgba(shade(c, 0.12), 0.6)); g.addColorStop(1, rgba(shade(c, -0.3), 0.75));
    ctx.fillStyle = g; ctx.fillRect(cx - bw / 2 - 2, surf, bw + 4, by - surf + 2);
    if (cloudy > 0) { ctx.fillStyle = `rgba(190,170,110,${0.35 * cloudy})`; ctx.fillRect(cx - bw / 2, surf, bw, by - surf); }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(cx - bw / 2, surf); ctx.lineTo(cx + bw / 2, surf); ctx.stroke();
  }
  const sg = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  sg.addColorStop(0, 'rgba(40,70,60,.32)'); sg.addColorStop(0.15, 'rgba(255,255,255,.6)'); sg.addColorStop(0.24, 'rgba(255,255,255,.06)'); sg.addColorStop(0.82, 'rgba(255,255,255,.26)'); sg.addColorStop(1, 'rgba(40,70,60,.36)');
  ctx.fillStyle = sg; ctx.fillRect(cx - bw / 2, top, bw, s);
  ctx.restore();
  ctx.save(); outline(); ctx.strokeStyle = 'rgba(70,100,90,.6)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
  // гумова пробка
  const pg = ctx.createLinearGradient(cx - nw / 2, 0, cx + nw / 2, 0);
  pg.addColorStop(0, '#2B2F2C'); pg.addColorStop(0.35, '#5A605B'); pg.addColorStop(1, '#202421');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(cx - nw / 2 - 3, top - s * 0.08); ctx.lineTo(cx + nw / 2 + 3, top - s * 0.08); ctx.lineTo(cx + nw / 2 - 1, top + s * 0.07); ctx.lineTo(cx - nw / 2 + 1, top + s * 0.07); ctx.closePath(); ctx.fill();
  return { tipX: cx, tipY: top + s * 0.14, surf, arm: [cx + nw / 2 + s * 0.2, ay - s * 0.02], top: top - s * 0.08, bw };
}

/** Фільтр Зейтца: металевий корпус — верхній циліндр-резервуар, фланець із гвинтами, нижня лійка з носиком. */
export function seitzFilter(ctx, cx, by, s, { level = 0, color = '#EFE9C9', t = 0, damaged = false } = {}) {
  // by — нижній край носика (входить у пробку)
  const fw = s * 0.62, flY = by - s * 0.42, topY = flY - s * 0.55;
  ctx.save();
  // носик
  ctx.fillStyle = steel(ctx, cx - s * 0.045, cx + s * 0.045); ctx.fillRect(cx - s * 0.04, flY + s * 0.18, s * 0.08, by - flY - s * 0.18);
  // нижня лійка
  ctx.fillStyle = steel(ctx, cx - fw / 2, cx + fw / 2, { dark: 0.05 });
  ctx.beginPath(); ctx.moveTo(cx - fw / 2, flY + s * 0.04); ctx.lineTo(cx + fw / 2, flY + s * 0.04); ctx.lineTo(cx + s * 0.06, flY + s * 0.2); ctx.lineTo(cx - s * 0.06, flY + s * 0.2); ctx.closePath(); ctx.fill();
  // фланець
  ctx.fillStyle = steel(ctx, cx - fw / 2 - s * 0.08, cx + fw / 2 + s * 0.08);
  roundRect(ctx, cx - fw / 2 - s * 0.08, flY - s * 0.05, fw + s * 0.16, s * 0.1, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(30,40,40,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - fw / 2 - s * 0.08, flY); ctx.lineTo(cx + fw / 2 + s * 0.08, flY); ctx.stroke();
  // гвинти-баранці
  for (const sx of [-1, 1]) {
    const bx = cx + sx * (fw / 2 + s * 0.035);
    ctx.fillStyle = '#5E676B'; ctx.fillRect(bx - 1.5, flY - s * 0.13, 3, s * 0.2);
    ctx.fillStyle = steel(ctx, bx - s * 0.06, bx + s * 0.06); ctx.beginPath(); ctx.ellipse(bx - s * 0.035, flY - s * 0.13, s * 0.035, s * 0.016, 0, 0, TAU); ctx.ellipse(bx + s * 0.035, flY - s * 0.13, s * 0.035, s * 0.016, 0, 0, TAU); ctx.fill();
  }
  // верхній резервуар (циліндр) — розріз: видно рівень середовища
  const rw = fw * 0.92;
  ctx.fillStyle = steel(ctx, cx - rw / 2, cx + rw / 2);
  ctx.fillRect(cx - rw / 2, topY, rw, flY - s * 0.05 - topY);
  ctx.globalAlpha = 0.5; ctx.drawImage(brushed(64, 64), cx - rw / 2, topY, rw, flY - topY); ctx.globalAlpha = 1;
  // віконце-розріз
  const wx = cx - rw * 0.32, ww = rw * 0.64, wy = topY + s * 0.07, wh = flY - s * 0.12 - wy;
  ctx.fillStyle = '#2B3436'; roundRect(ctx, wx - 2, wy - 2, ww + 4, wh + 4, 4); ctx.fill();
  ctx.fillStyle = '#4C5A5C'; roundRect(ctx, wx, wy, ww, wh, 3); ctx.fill();
  if (level > 0) {
    const ly = wy + wh * (1 - level), c = hex(color);
    const g = ctx.createLinearGradient(wx, 0, wx + ww, 0); g.addColorStop(0, rgba(shade(c, -0.35))); g.addColorStop(0.4, rgba(shade(c, 0.05))); g.addColorStop(1, rgba(shade(c, -0.4)));
    ctx.fillStyle = g; ctx.fillRect(wx, ly, ww, wy + wh - ly);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx, ly + Math.sin(t * 3) * 0.6); ctx.lineTo(wx + ww, ly - Math.sin(t * 3) * 0.6); ctx.stroke();
  }
  // мембрана на дні вікна
  ctx.fillStyle = damaged ? '#E8C9A0' : '#F7F5EE'; ctx.fillRect(wx, wy + wh - 2.5, ww, 2.5);
  if (damaged) { ctx.strokeStyle = '#8A3A1A'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(wx + ww * 0.55, wy + wh - 2.5); ctx.lineTo(wx + ww * 0.62, wy + wh); ctx.stroke(); }
  // обідок зверху
  ctx.fillStyle = steel(ctx, cx - rw / 2 - 3, cx + rw / 2 + 3); roundRect(ctx, cx - rw / 2 - 3, topY - 4, rw + 6, 7, 3); ctx.fill();
  ctx.fillStyle = 'rgba(40,50,50,.55)'; ctx.beginPath(); ctx.ellipse(cx, topY - 1, rw / 2 - 1, 2.2, 0, 0, TAU); ctx.fill();
  ctx.restore();
  return { topY, flY, wy, wh, wx, ww };
}

/* ---------------- Біологічні об'єкти ---------------- */
/** Насінина сої (вид згори, 3/4): овальна, жовта, з рубчиком. */
export function soySeed(ctx, x, y, r, { rot = 0, seed = 1, brown = 0, swell = 0 } = {}) {
  const R = rng(seed);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const rx = r * (1 + swell * 0.18), ry = r * 0.8 * (1 + swell * 0.15);
  shadow(ctx, 1, ry * 0.55, rx * 1.05, ry * 0.4, 0.3);
  const base = mix([226, 196, 120], [140, 100, 50], brown);
  const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.45, r * 0.1, 0, 0, rx * 1.05);
  g.addColorStop(0, rgba(shade(base, 0.4))); g.addColorStop(0.55, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.35)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
  // рубчик
  ctx.fillStyle = rgba(mix([120, 90, 50], [60, 40, 20], brown)); ctx.beginPath(); ctx.ellipse(rx * 0.15, ry * 0.52, rx * 0.32, ry * 0.12, 0.05, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-rx * 0.38, -ry * 0.42, rx * 0.25, ry * 0.12, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Проросток сої на агарі: корінець, гіпокотиль, сім'ядолі (етап 0..1). */
export function soySprout(ctx, x, y, r, stage, { rot = 0, seed = 1 } = {}) {
  const R = rng(seed + 5);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  // корінець
  if (stage > 0.08) {
    const L = r * 4.2 * clamp((stage - 0.08) / 0.6, 0, 1);
    ctx.strokeStyle = '#F4EED8'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, r * 0.28);
    ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.3); ctx.bezierCurveTo(r * 0.8, r * 0.9, r * 0.3 + L * 0.4, r * 0.9 + L * 0.5, r * 0.2 + L * 0.5, r * 0.5 + L);
    ctx.stroke(); ctx.strokeStyle = 'rgba(160,130,80,.35)'; ctx.lineWidth = 0.6; ctx.stroke();
    if (stage > 0.5) { ctx.strokeStyle = 'rgba(250,245,230,.75)'; ctx.lineWidth = 0.7; for (let i = 0; i < 6; i++) { const t = 0.4 + i * 0.1, px = r * 0.2 + L * 0.5 * t, py = r * 0.5 + L * t; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (R() - 0.5) * r * 1.2, py + R() * r * 0.4); ctx.stroke(); } }
  }
  ctx.restore();
  if (stage > 0.45) { // сім'ядолі розкриваються (зеленіють); поруч — скинута насінна шкірка
    const k = clamp((stage - 0.45) / 0.5, 0, 1), g = mix([226, 196, 120], [110, 170, 70], k);
    ctx.save(); ctx.translate(x - r * 0.9, y + r * 0.55); ctx.rotate(rot + 0.6);
    ctx.fillStyle = 'rgba(205,170,100,.85)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.22, 0, 0, Math.PI * 1.6); ctx.fill(); ctx.restore();
    ctx.strokeStyle = rgba(mix([200, 190, 120], [120, 160, 80], k)); ctx.lineWidth = Math.max(1.4, r * 0.22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + r * 0.2, y + r * 0.4); ctx.quadraticCurveTo(x - r * 0.3, y + r * 0.3, x, y - r * 0.15 * k); ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(x + s * r * 0.45 * k, y - r * 0.2 * k); ctx.rotate(rot + s * 0.5 * k);
      const gg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 0.9);
      gg.addColorStop(0, rgba(shade(g, 0.35))); gg.addColorStop(1, rgba(shade(g, -0.3)));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, 0, r * (0.75 + 0.2 * k), r * 0.55, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(shade(g, -0.35), 0.5); ctx.lineWidth = 0.7; ctx.stroke();
      ctx.strokeStyle = rgba(shade(g, 0.4), 0.6); ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.22, r * 0.35, r * 0.12, -0.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
  } else soySeed(ctx, x, y, r, { rot, seed, swell: stage * 2 });
}

/** Бактеріальна колонія / слизовий наліт навколо експлантата: кремова, блискуча, з нерівним краєм. */
export function bacterialHalo(ctx, x, y, r, { seed = 1, color = '#E9DDB0', tilt = 1 } = {}) {
  if (r < 1) return;
  const R = rng(seed), c = hex(color);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU, rr = r * (0.82 + 0.3 * noise(Math.cos(a) * 2.2 + seed, Math.sin(a) * 2.2, seed)); const X = x + Math.cos(a) * rr, Y = y + Math.sin(a) * rr * tilt; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3 * tilt, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, rgba(shade(c, 0.3), 0.95)); g.addColorStop(0.7, rgba(c, 0.85)); g.addColorStop(1, rgba(shade(c, -0.2), 0.7));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = rgba(shade(c, -0.35), 0.5); ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4 * tilt, r * 0.3, r * 0.1 * tilt + 0.5, -0.4, 0, TAU); ctx.fill();
  // дрібні колонії-сателіти
  for (let i = 0; i < 5; i++) { const a = R() * TAU, d = r * (1.15 + R() * 0.5), rr = r * (0.06 + R() * 0.08); ctx.fillStyle = rgba(c, 0.9); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * tilt, rr, rr * tilt, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/** Міцелій гриба: пухнастий білий наліт, у центрі — зеленувате/сіре спороношення. Кешується за параметрами. */
const myCache = new Map();
export function mycelium(ctx, x, y, r, { seed = 1, spore = 0.5, tilt = 1, hue = 'green' } = {}) {
  if (r < 2) return;
  const q = Math.max(8, Math.round(r / 2) * 2), key = `${q}|${seed % 9}|${Math.round(spore * 4)}|${hue}`;
  let c = myCache.get(key);
  if (!c) {
    const S = q * 2.6; c = offscreen(S, S); const x2 = c.getContext('2d'), R = rng(seed), cx = S / 2;
    for (let i = 0; i < q * 9; i++) {
      const a = R() * TAU, L = q * (0.35 + R() * 0.8); let px = cx, py = cx, an = a;
      x2.strokeStyle = `rgba(255,255,255,${0.08 + R() * 0.16})`; x2.lineWidth = 0.6; x2.beginPath(); x2.moveTo(px, py);
      for (let k = 0; k < 6; k++) { an += (R() - 0.5) * 0.7; px += Math.cos(an) * L / 6; py += Math.sin(an) * L / 6; x2.lineTo(px, py); }
      x2.stroke();
    }
    const g = x2.createRadialGradient(cx, cx, 0, cx, cx, q * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.6, 'rgba(246,246,240,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x2.fillStyle = g; x2.beginPath(); x2.arc(cx, cx, q * 1.1, 0, TAU); x2.fill();
    if (spore > 0.05) {
      const sc = hue === 'green' ? [70, 120, 60] : hue === 'black' ? [40, 40, 38] : [120, 140, 130];
      for (let i = 0; i < q * 6 * spore; i++) { const a = R() * TAU, d = Math.sqrt(R()) * q * 0.55 * spore; x2.fillStyle = rgba(shade(sc, (R() - 0.5) * 0.4), 0.55); x2.beginPath(); x2.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, 0.8 + R() * 1.4, 0, TAU); x2.fill(); }
    }
    myCache.set(key, c); if (myCache.size > 60) myCache.delete(myCache.keys().next().value);
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(r / q, (r / q) * tilt); ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore();
}

/** Текстура поперечного зрізу коренеплоду моркви / бульби картоплі (кешується). kind: 'carrot'|'potato'. */
const discCache = new Map();
function discTexture(kind, R0, seed) {
  const key = `${kind}|${Math.round(R0)}|${seed % 5}`;
  if (discCache.has(key)) return discCache.get(key);
  const S = Math.ceil(R0 * 2 + 4), c = offscreen(S, S), x = c.getContext('2d'), d = x.createImageData(S, S), cx = S / 2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i - cx, dy = j - cx, r = Math.hypot(dx, dy) / R0, k = (j * S + i) * 4;
    if (r > 1) { d.data[k + 3] = 0; continue; }
    let col;
    const n = fbm(i * 0.18, j * 0.18, seed, 3);
    if (kind === 'carrot') {
      const a = Math.atan2(dy, dx), rays = 0.5 + 0.5 * Math.sin(a * 22 + n * 4);
      if (r < 0.42) col = mix([246, 170, 70], [252, 205, 120], 0.4 + 0.35 * rays + (n - 0.5) * 0.3);           // ксилема (серцевина)
      else if (r < 0.5) col = mix([255, 214, 140], [255, 232, 180], n);                                       // камбій
      else col = mix([232, 110, 30], [244, 140, 50], 0.5 + (n - 0.5) * 0.8 + 0.15 * rays);                       // флоема (кора)
    } else {
      col = mix([242, 230, 190], [250, 242, 214], n);
      if (r > 0.86 && r < 0.9) col = mix(col, [215, 200, 150], 0.6); // судинне кільце
    }
    d.data[k] = col[0]; d.data[k + 1] = col[1]; d.data[k + 2] = col[2]; d.data[k + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  discCache.set(key, c); if (discCache.size > 30) discCache.delete(discCache.keys().next().value);
  return c;
}

/** Диск тканини (моркви або картоплі) у ракурсі 3/4: верхня грань + бокова товщина. */
export function tissueDisc(ctx, x, y, r, { kind = 'carrot', tilt = 0.5, thick = 4, seed = 1, brown = 0, torn = false } = {}) {
  ctx.save();
  shadow(ctx, x + r * 0.1, y + thick + r * tilt * 0.4, r * 1.1, r * tilt * 0.6, 0.3);
  // бік
  const side = kind === 'carrot' ? [205, 95, 25] : [220, 205, 160];
  const sc = mix(side, [110, 70, 35], brown);
  ctx.fillStyle = rgba(shade(sc, -0.1)); ctx.beginPath(); ctx.ellipse(x, y + thick, r, r * tilt, 0, 0, Math.PI); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, r * tilt, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  const sg = ctx.createLinearGradient(x - r, 0, x + r, 0); sg.addColorStop(0, 'rgba(0,0,0,.25)'); sg.addColorStop(0.3, 'rgba(255,255,255,.18)'); sg.addColorStop(1, 'rgba(0,0,0,.3)');
  ctx.fillStyle = sg; ctx.fill();
  // верхня грань (текстура)
  const tex = discTexture(kind, Math.max(6, r), seed);
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, r, r * tilt, 0, 0, TAU); ctx.clip();
  ctx.translate(x, y); ctx.scale(r / (tex.width / 2 - 2), (r * tilt) / (tex.width / 2 - 2)); ctx.drawImage(tex, -tex.width / 2, -tex.height / 2); ctx.restore();
  if (brown > 0) { ctx.fillStyle = `rgba(90,55,25,${0.6 * brown})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * tilt, 0, 0, TAU); ctx.fill(); }
  if (torn) { ctx.strokeStyle = 'rgba(120,50,10,.45)'; ctx.lineWidth = 0.8; const R = rng(seed + 3); for (let i = 0; i < 7; i++) { const a = R() * TAU, d = R() * r * 0.8; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d * tilt); ctx.lineTo(x + Math.cos(a) * d + (R() - 0.5) * r * 0.4, y + Math.sin(a) * d * tilt + (R() - 0.5) * r * 0.2); ctx.stroke(); } }
  const hg = ctx.createRadialGradient(x - r * 0.4, y - r * tilt * 0.5, 1, x, y, r);
  hg.addColorStop(0, 'rgba(255,255,255,.35)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(0,0,0,.15)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(x, y, r, r * tilt, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Пеніциліновий флакон з агаром і фольговим ковпачком. */
export function vial(ctx, x, by, w, h, { contents = null, medium = '#EDE6C8', foil = true, cloudy = 0 } = {}) {
  const nw = w * 0.62, sh = h * 0.2, top = by - h;
  const path = () => { ctx.beginPath(); ctx.moveTo(x + (w - nw) / 2, top); ctx.lineTo(x + (w - nw) / 2, top + sh * 0.5); ctx.quadraticCurveTo(x, top + sh * 0.6, x, top + sh); ctx.lineTo(x, by - 4); ctx.quadraticCurveTo(x, by, x + 4, by); ctx.lineTo(x + w - 4, by); ctx.quadraticCurveTo(x + w, by, x + w, by - 4); ctx.lineTo(x + w, top + sh); ctx.quadraticCurveTo(x + w, top + sh * 0.6, x + (w + nw) / 2, top + sh * 0.5); ctx.lineTo(x + (w + nw) / 2, top); ctx.closePath(); };
  shadow(ctx, x + w * 0.58, by + 1, w * 0.62, w * 0.14, 0.3);
  ctx.save(); path(); ctx.fillStyle = 'rgba(225,240,235,.3)'; ctx.fill(); ctx.clip();
  const surf = by - h * 0.32, c = hex(medium);
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, rgba(shade(c, -0.28), 0.92)); g.addColorStop(0.3, rgba(shade(c, 0.12), 0.9)); g.addColorStop(1, rgba(shade(c, -0.32), 0.92));
  ctx.fillStyle = g; ctx.fillRect(x, surf, w, by - surf);
  if (cloudy > 0) { ctx.fillStyle = `rgba(200,180,110,${0.5 * cloudy})`; ctx.fillRect(x, surf, w, by - surf); }
  ctx.strokeStyle = 'rgba(255,255,245,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, surf); ctx.lineTo(x + w, surf); ctx.stroke();
  if (contents) contents(ctx, { cx: x + w / 2, surf, w, top });
  const sg = ctx.createLinearGradient(x, 0, x + w, 0); sg.addColorStop(0, 'rgba(40,70,60,.3)'); sg.addColorStop(0.15, 'rgba(255,255,255,.6)'); sg.addColorStop(0.24, 'rgba(255,255,255,.05)'); sg.addColorStop(0.85, 'rgba(255,255,255,.25)'); sg.addColorStop(1, 'rgba(40,70,60,.34)');
  ctx.fillStyle = sg; ctx.fillRect(x, top, w, h);
  ctx.restore();
  ctx.save(); path(); ctx.strokeStyle = 'rgba(70,100,90,.55)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  if (foil) {
    const fg = ctx.createLinearGradient(x + (w - nw) / 2, 0, x + (w + nw) / 2, 0);
    fg.addColorStop(0, '#8E979B'); fg.addColorStop(0.25, '#F4F6F7'); fg.addColorStop(0.5, '#B7BEC2'); fg.addColorStop(0.75, '#E8ECEE'); fg.addColorStop(1, '#7C8589');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x + (w - nw) / 2 - 3, top + sh * 0.8);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + (w - nw) / 2 - 3 + (nw + 6) * i / 6, top + sh * 0.8 + (i % 2 ? 2 : -1));
    ctx.lineTo(x + (w + nw) / 2 + 2, top - 3); ctx.quadraticCurveTo(x + w / 2, top - 7, x + (w - nw) / 2 - 2, top - 3); ctx.closePath(); ctx.fill();
  }
  return { surf };
}

/** Живець верби: циліндр з корою, бруньками (апікальний кінець) і коренями (базальний кінець). inverted — перевернутий. */
export function cutting(ctx, x, y0, y1, w, { roots = 0, shoots = 0, callus = 0, inverted = false, seed = 1, t = 0 } = {}) {
  // y0 — верх (на екрані), y1 — низ. Морфологічно: apical = верх, якщо не inverted.
  const R = rng(seed), apY = inverted ? y1 : y0, baY = inverted ? y0 : y1, dir = inverted ? 1 : -1; // dir: напрямок від бази до апексу на екрані
  ctx.save();
  // кора
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#4A3A22'); g.addColorStop(0.25, '#9C8456'); g.addColorStop(0.45, '#B79E6A'); g.addColorStop(0.75, '#7C6640'); g.addColorStop(1, '#3E301B');
  ctx.fillStyle = g; roundRect(ctx, x - w / 2, y0, w, y1 - y0, w * 0.2); ctx.fill();
  ctx.strokeStyle = 'rgba(50,35,15,.35)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < (y1 - y0) / 7; i++) { const yy = y0 + R() * (y1 - y0); ctx.beginPath(); ctx.moveTo(x - w * 0.3 + R() * w * 0.2, yy); ctx.lineTo(x + w * 0.1 + R() * w * 0.2, yy + 1); ctx.stroke(); }
  // косий зріз на базальному кінці, прямий — на апікальному (як роблять для маркування)
  ctx.fillStyle = '#E8DDB4'; ctx.beginPath(); ctx.ellipse(x, apY, w / 2, w * 0.16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#E8DDB4'; ctx.beginPath(); ctx.ellipse(x, baY, w / 2, w * 0.22, inverted ? 0.35 : -0.35, 0, TAU); ctx.fill();
  // бруньки вздовж
  const L = Math.abs(y1 - y0);
  for (let i = 1; i <= 3; i++) {
    const by = baY + dir * L * (0.25 + i * 0.22), side = i % 2 ? 1 : -1;
    ctx.fillStyle = '#6A4E26'; ctx.beginPath(); ctx.ellipse(x + side * w * 0.5, by, w * 0.18, w * 0.32, side * 0.4 * -dir, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // калюс на базальному кінці
  if (callus > 0.02) {
    const R2 = rng(seed + 7);
    for (let i = 0; i < 9; i++) { const a = R2() * Math.PI, rr = w * 0.22 * (0.6 + R2() * 0.6) * callus; const px = x + Math.cos(a) * w * 0.45, py = baY + (inverted ? -1 : 1) * R2() * w * 0.15; const gg = ctx.createRadialGradient(px - rr * 0.3, py - rr * 0.3, 0.5, px, py, rr); gg.addColorStop(0, '#FFFBEA'); gg.addColorStop(1, '#D9CB98'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill(); }
  }
  // корені з базального кінця (ростуть вниз — позитивний гравітропізм)
  if (roots > 0.02) {
    const R3 = rng(seed + 11);
    ctx.save(); ctx.lineCap = 'round';
    const n = 3 + Math.round(roots * 5);
    for (let i = 0; i < n; i++) {
      const sy = baY + (inverted ? 1 : -1) * R3() * L * 0.18, sx = x + (R3() > 0.5 ? 1 : -1) * w * 0.48;
      let px = sx, py = sy, a = (sx > x ? 0 : Math.PI) + (R3() - 0.5) * 0.6;
      const len = L * (0.35 + R3() * 0.45) * roots, seg = 10;
      ctx.strokeStyle = '#F2EAD3'; ctx.lineWidth = Math.max(1, w * 0.12);
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let s = 0; s < seg; s++) { a = lerp(a, Math.PI / 2, 0.18) + (R3() - 0.5) * 0.25; px += Math.cos(a) * len / seg; py += Math.sin(a) * len / seg; ctx.lineTo(px, py); }
      ctx.stroke(); ctx.strokeStyle = 'rgba(150,120,70,.35)'; ctx.lineWidth = 0.6; ctx.stroke();
    }
    ctx.restore();
  }
  // пагони з апікальних бруньок (ростуть угору — негативний гравітропізм)
  if (shoots > 0.02) {
    const R4 = rng(seed + 13);
    for (let i = 0; i < 2; i++) {
      const sy = apY - dir * 0 + (inverted ? -1 : 1) * L * (0.06 + i * 0.2), side = i % 2 ? 1 : -1;
      let px = x + side * w * 0.5, py = sy, a = side > 0 ? -0.6 : -Math.PI + 0.6;
      const len = L * 0.45 * shoots, seg = 8, pts = [[px, py]];
      for (let s = 0; s < seg; s++) { a = lerp(a, -Math.PI / 2, 0.25) + (R4() - 0.5) * 0.15; px += Math.cos(a) * len / seg; py += Math.sin(a) * len / seg; pts.push([px, py]); }
      ctx.strokeStyle = '#6E9A3A'; ctx.lineWidth = Math.max(1, w * 0.12); ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([X, Y], k) => (k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.stroke();
      for (let k = 2; k < pts.length; k += 2) leafSmall(ctx, pts[k][0], pts[k][1], len * 0.28 * (0.6 + k / pts.length * 0.4), (k % 4 ? -0.4 : -2.7) + (side > 0 ? 0.1 : -0.1));
    }
  }
}

function leafSmall(ctx, x, y, len, ang) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, -len * 0.2, 0, len * 0.2); g.addColorStop(0, '#9CCB62'); g.addColorStop(1, '#4E8A2E');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.22, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.2, 0, 0); ctx.fill();
  ctx.restore();
}

/** Калюс-нарости на грані диска (гранульований кремовий). */
export function discCallus(ctx, x, y, r, amount, { tilt = 0.5, seed = 1, rim = false } = {}) {
  if (amount < 0.02) return;
  const R = rng(seed);
  const n = Math.round(6 + amount * 22);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = rim ? r * (0.85 + R() * 0.2) : r * Math.sqrt(R()) * 0.85;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * tilt - amount * r * 0.12;
    const rr = r * (0.08 + R() * 0.1) * (0.5 + amount);
    const g = ctx.createRadialGradient(px - rr * 0.35, py - rr * 0.4, 0.3, px, py, rr);
    g.addColorStop(0, '#FFFCEB'); g.addColorStop(0.6, '#F0E5BF'); g.addColorStop(1, '#C8B783');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, rr, rr * 0.85, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** Стрілка (для схем на полотні). */
export function arrow(ctx, x0, y0, x1, y1, { color = '#B45309', width = 2, head = 7, dash = null } = {}) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * head, y1 - Math.sin(a - 0.45) * head); ctx.lineTo(x1 - Math.cos(a + 0.45) * head, y1 - Math.sin(a + 0.45) * head); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export { brushed };
