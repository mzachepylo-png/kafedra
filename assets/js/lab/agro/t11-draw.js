// Тема 11 «Молекулярна біологія та генетична інженерія»: власні 2.5D-примітиви,
// яких немає в kit.js — диск коренеплоду моркви з корончастими галами, стебло томата,
// листковий диск, качалка (шейкер) з колбою, лабораторна центрифуга, водяна баня,
// спектрофотометр із кюветою, камера для горизонтального електрофорезу й УФ-трансілюмінатор
// з агарозним гелем. Світло — зверху-ліворуч, тіні м'які, скло з відблисками.

import {
  TAU, clamp, lerp, rng, noise, hex, rgba, mix, shade, roundRect, shadow, callus, leaf,
  tagSmall, offscreen, MAT,
} from './kit.js';

/* ---------------- дрібні утиліти ---------------- */

/** Текст із тонкою підкладкою — щоб підпис читався на будь-якому тлі. */
export function chip(ctx, x, y, text, { dark = false, size = 11.5, align = 'center', weight = 700 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = ctx.measureText(text).width;
  const px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = dark ? 'rgba(6,18,12,.66)' : 'rgba(255,255,255,.86)';
  roundRect(ctx, px - 7, y - size - 2, w + 14, size + 9, 7);
  ctx.fill();
  ctx.fillStyle = dark ? '#E9F4EC' : '#17321F';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, px, y + 1);
  ctx.restore();
  return { w: w + 14, h: size + 9 };
}

/** Стрілка-потік між станціями конвеєра. */
export function arrow(ctx, x1, y1, x2, y2, { color = 'rgba(30,70,45,.55)', width = 2, head = 7, dash = null } = {}) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.42) * head, y2 - Math.sin(a - 0.42) * head);
  ctx.lineTo(x2 - Math.cos(a + 0.42) * head, y2 - Math.sin(a + 0.42) * head);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------------- рослинні об'єкти ---------------- */

/**
 * Диск (експлантат) коренеплоду моркви у ракурсі 3/4.
 * Анатомія зрізу: кора (флоема) — темніший оранжевий, серцевина (ксилема) — світліша,
 * між ними камбіальне кільце, де й виникають корончасті гали.
 * gall 0..1 — розвиненість пухлин, ring — частка кільця, вкрита галами.
 */
export function carrotDisc(ctx, cx, cy, rx, { tilt = 0.42, thick = 0.2, gall = 0, ring = 1, green = 0, seed = 1, t = 0 } = {}) {
  const ry = rx * tilt, d = rx * thick;
  const R = rng(seed);
  shadow(ctx, cx + rx * 0.1, cy + d + ry * 0.45, rx * 1.1, ry * 0.95, 0.3);
  // бічна поверхня (товщина зрізу)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy + d, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  const sg = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  sg.addColorStop(0, '#9A4A16'); sg.addColorStop(0.22, '#E07A2C');
  sg.addColorStop(0.55, '#C9601F'); sg.addColorStop(1, '#8A3F12');
  ctx.fillStyle = sg; ctx.fill();
  ctx.restore();
  // верхній зріз
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.5, rx * 0.05, cx, cy, rx);
  g.addColorStop(0, '#FBB267'); g.addColorStop(0.55, '#EE8C33'); g.addColorStop(1, '#C8631D');
  ctx.fillStyle = g; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  // серцевина (ксилема) — світліша
  const xr = rx * 0.52;
  const xg = ctx.createRadialGradient(cx - xr * 0.3, cy - ry * 0.3, 1, cx, cy, xr);
  xg.addColorStop(0, '#FDD79B'); xg.addColorStop(0.75, '#F6BC6A'); xg.addColorStop(1, '#E59A46');
  ctx.fillStyle = xg;
  ctx.beginPath(); ctx.ellipse(cx, cy, xr, xr * tilt, 0, 0, TAU); ctx.fill();
  // камбіальне кільце
  ctx.strokeStyle = 'rgba(150,70,20,.5)'; ctx.lineWidth = Math.max(1, rx * 0.035);
  ctx.beginPath(); ctx.ellipse(cx, cy, xr, xr * tilt, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,190,.55)'; ctx.lineWidth = Math.max(0.6, rx * 0.015);
  ctx.beginPath(); ctx.ellipse(cx, cy, xr * 1.04, xr * tilt * 1.04, 0, 0, TAU); ctx.stroke();
  // радіальні тяжі провідних пучків
  ctx.strokeStyle = 'rgba(180,90,30,.22)'; ctx.lineWidth = Math.max(0.5, rx * 0.012);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + R() * 0.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * xr * 0.2, cy + Math.sin(a) * xr * tilt * 0.2);
    ctx.lineTo(cx + Math.cos(a) * rx * 0.96, cy + Math.sin(a) * ry * 0.96);
    ctx.stroke();
  }
  // вологий полиск свіжого зрізу
  const sh = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.3, cy + ry);
  sh.addColorStop(0, 'rgba(255,255,255,.34)'); sh.addColorStop(0.4, 'rgba(255,255,255,.05)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();
  // контур
  ctx.save();
  ctx.strokeStyle = 'rgba(110,50,15,.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  ctx.restore();

  // корончасті гали — по камбіальному кільцю
  if (gall > 0.02) {
    const n = Math.max(1, Math.round(3 + ring * 9));
    const items = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R() * 0.35;
      const rr = rx * 0.52 * (0.92 + R() * 0.18);
      items.push({
        x: cx + Math.cos(a) * rr,
        y: cy + Math.sin(a) * rr * tilt,
        s: rx * (0.14 + 0.2 * gall) * (0.7 + R() * 0.6),
        k: R(),
      });
    }
    items.sort((p, q) => p.y - q.y);
    for (const it of items) {
      if (it.k > ring) continue;
      const pulse = 1 + 0.03 * Math.sin(t * 1.6 + it.k * 6);
      callus(ctx, it.x, it.y + it.s * 0.22, it.s * pulse, {
        color: MAT.callusWhite, friable: 0.55, green: green * (0.5 + it.k * 0.6), seed: 3 + Math.round(it.k * 99), glossy: 0.85,
      });
    }
  }
}

/** Листковий диск (ЛР 44) у площині агару: зелений кружечок із жилками, з пагоновими точками. */
export function leafDisc(ctx, cx, cy, rx, { tilt = 0.42, shoots = 0, browning = 0, seed = 2, t = 0 } = {}) {
  const ry = rx * tilt, R = rng(seed);
  shadow(ctx, cx + rx * 0.08, cy + ry * 0.5, rx * 1.05, ry * 0.8, 0.26);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.clip();
  const base = mix(hex('#4E9A3A'), hex('#8C6F35'), clamp(browning, 0, 1));
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.6, 1, cx, cy, rx);
  g.addColorStop(0, rgba(shade(base, 0.3))); g.addColorStop(0.7, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.3)));
  ctx.fillStyle = g; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  // жилки
  ctx.strokeStyle = rgba(shade(base, 0.35), 0.75); ctx.lineWidth = Math.max(0.6, rx * 0.04);
  ctx.beginPath(); ctx.moveTo(cx - rx, cy + ry * 0.1); ctx.quadraticCurveTo(cx, cy - ry * 0.25, cx + rx, cy + ry * 0.05); ctx.stroke();
  ctx.lineWidth = Math.max(0.4, rx * 0.02);
  for (let i = -2; i <= 2; i++) {
    if (!i) continue;
    ctx.beginPath();
    ctx.moveTo(cx + i * rx * 0.3, cy - ry * 0.05);
    ctx.lineTo(cx + i * rx * 0.3 + rx * 0.2, cy + ry * (i > 0 ? 0.7 : -0.6));
    ctx.stroke();
  }
  // зона некрозу по краю зрізу
  if (browning > 0.1) {
    ctx.strokeStyle = rgba([110, 78, 34], 0.55 * browning); ctx.lineWidth = rx * 0.14;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.96, ry * 0.96, 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath(); ctx.ellipse(cx - rx * 0.28, cy - ry * 0.35, rx * 0.35, ry * 0.4, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(28,60,24,.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  // темно-зелені точки → пагони
  const n = Math.round(shoots * 5);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, rr = Math.sqrt(R()) * rx * 0.7;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * tilt;
    const s = clamp(shoots * 2 - i * 0.25, 0.1, 1);
    const dg = ctx.createRadialGradient(px - 1, py - 1.5, 0.4, px, py, rx * 0.16 * s + 1.5);
    dg.addColorStop(0, '#7ED36A'); dg.addColorStop(1, '#17591F');
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.ellipse(px, py, rx * 0.15 * s + 1.4, rx * 0.11 * s + 1.1, 0, 0, TAU); ctx.fill();
    if (s > 0.55) {
      const L = rx * 0.5 * (s - 0.5) * 2 + 3;
      leaf(ctx, px, py - 1, L, -Math.PI / 2 - 0.5 + Math.sin(t + i) * 0.05, { color: '#49A33C', width: 0.4 });
      leaf(ctx, px, py - 1, L * 0.85, -Math.PI / 2 + 0.55 + Math.sin(t + i) * 0.05, { color: '#56B347', width: 0.4 });
    }
  }
}

/**
 * Асептична рослина томата в пробірці: стебло з корончастим галом у місці ін'єкції.
 * gallD — діаметр пухлини в мм, stemD — товщина стебла в мм, pxPerMm — масштаб.
 */
export function tomatoStem(ctx, x, baseY, h, { gallD = 0, stemD = 3, pxPerMm = 4, sway = 0, seed = 5, t = 0 } = {}) {
  const R = rng(seed);
  const sw = Math.max(2, stemD * pxPerMm * 0.45);
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push([x + Math.sin(f * 2.2 + sway) * h * 0.035, baseY - f * h]);
  }
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3D7A2E'; ctx.lineWidth = sw;
  ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,230,150,.55)'; ctx.lineWidth = sw * 0.3;
  ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px - sw * 0.22, py) : ctx.moveTo(px - sw * 0.22, py)));
  ctx.stroke();
  ctx.restore();
  // листки
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i];
    const side = i % 2 ? 1 : -1;
    const L = h * 0.2 * (0.6 + 0.4 * Math.sin((i / n) * Math.PI));
    leaf(ctx, px, py, L, side > 0 ? -0.5 + sway * 0.4 : Math.PI + 0.5 + sway * 0.4, { color: '#4E9A3A', width: 0.4, curl: 0.18 });
  }
  // пухлина в місці ін'єкції (на 40 % висоти)
  if (gallD > 0.05) {
    const i = Math.round(n * 0.42);
    const [px, py] = pts[i];
    const rad = (gallD * pxPerMm) / 2;
    callus(ctx, px, py + rad * 0.55, rad * 1.5, {
      color: MAT.callusWhite, friable: 0.5, green: 0.28, seed: 11, glossy: 0.9,
    });
    return { gx: px, gy: py, grad: rad };
  }
  return { gx: pts[Math.round(n * 0.42)][0], gy: pts[Math.round(n * 0.42)][1], grad: 0 };
}

/* ---------------- обладнання ---------------- */

/** Качалка (шейкер) ротаційного типу з колбою: платформа з затискачами, що гойдається. */
export function shaker(ctx, cx, by, w, { phase = 0, on = false, label = '' } = {}) {
  const h = w * 0.34;
  shadow(ctx, cx + w * 0.06, by + 2, w * 0.56, w * 0.07, 0.3);
  // корпус
  const g = ctx.createLinearGradient(0, by - h, 0, by);
  g.addColorStop(0, '#E8EDEE'); g.addColorStop(0.45, '#C9D3D5'); g.addColorStop(1, '#8F9B9E');
  ctx.fillStyle = g; roundRect(ctx, cx - w / 2, by - h, w, h, w * 0.05); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,55,.3)'; ctx.lineWidth = 1; ctx.stroke();
  // панель керування
  ctx.fillStyle = '#2B3A3A'; roundRect(ctx, cx + w * 0.16, by - h * 0.62, w * 0.28, h * 0.3, 3); ctx.fill();
  ctx.fillStyle = on ? '#9DE8B1' : '#4E6A60';
  ctx.font = `700 ${Math.max(7, w * 0.045)}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('100 об/хв', cx + w * 0.3, by - h * 0.47);
  ctx.fillStyle = on ? '#6EE36E' : '#53685F';
  ctx.beginPath(); ctx.arc(cx - w * 0.36, by - h * 0.45, w * 0.022, 0, TAU); ctx.fill();
  // платформа (зміщується по колу)
  const dx = on ? Math.cos(phase) * w * 0.035 : 0;
  const dy = on ? Math.sin(phase) * w * 0.012 : 0;
  const pg = ctx.createLinearGradient(0, by - h - 10, 0, by - h + 6);
  pg.addColorStop(0, '#F3F6F6'); pg.addColorStop(1, '#AEBABC');
  ctx.fillStyle = pg;
  roundRect(ctx, cx - w * 0.46 + dx, by - h - 9 + dy, w * 0.92, 10, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,55,.28)'; ctx.stroke();
  if (label) tagSmall(ctx, cx, by + 16, label);
  return { px: cx + dx, py: by - h - 9 + dy, dx, dy };
}

/** Лабораторна центрифуга: корпус, кришка, ротор, індикатор обертів. */
export function centrifuge(ctx, cx, by, w, { spin = 0, rpm = 0, open = false, label = '' } = {}) {
  const h = w * 0.62;
  shadow(ctx, cx + w * 0.06, by + 2, w * 0.58, w * 0.08, 0.3);
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, '#9FACAF'); g.addColorStop(0.25, '#E9EFF0'); g.addColorStop(0.6, '#CAD4D6'); g.addColorStop(1, '#8B989B');
  ctx.fillStyle = g; roundRect(ctx, cx - w / 2, by - h, w, h, w * 0.08); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,55,.32)'; ctx.lineWidth = 1; ctx.stroke();
  // кришка
  const lidY = by - h + (open ? -w * 0.1 : 0);
  ctx.save();
  ctx.translate(cx, lidY);
  if (open) ctx.rotate(-0.35);
  const lg = ctx.createLinearGradient(-w / 2, -w * 0.1, w / 2, 0);
  lg.addColorStop(0, '#CDD8DA'); lg.addColorStop(0.3, '#F7FAFA'); lg.addColorStop(1, '#9CA9AC');
  ctx.fillStyle = lg; roundRect(ctx, -w * 0.5, -w * 0.09, w, w * 0.11, w * 0.05); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,55,.3)'; ctx.stroke();
  ctx.restore();
  // оглядове віконце з ротором
  const wy = by - h * 0.56;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, wy, w * 0.3, w * 0.12, 0, 0, TAU); ctx.clip();
  ctx.fillStyle = '#0D1714'; ctx.fillRect(cx - w * 0.3, wy - w * 0.14, w * 0.6, w * 0.3);
  ctx.strokeStyle = 'rgba(180,200,195,.75)'; ctx.lineWidth = Math.max(1.4, w * 0.018);
  for (let i = 0; i < 6; i++) {
    const a = spin + (i / 6) * TAU;
    ctx.globalAlpha = rpm > 0 ? 0.35 + 0.3 * Math.abs(Math.cos(a)) : 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, wy);
    ctx.lineTo(cx + Math.cos(a) * w * 0.26, wy + Math.sin(a) * w * 0.1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,60,55,.45)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(cx, wy, w * 0.3, w * 0.12, 0, 0, TAU); ctx.stroke();
  // дисплей
  ctx.fillStyle = '#16221E'; roundRect(ctx, cx - w * 0.22, by - h * 0.3, w * 0.44, h * 0.19, 3); ctx.fill();
  ctx.fillStyle = rpm > 0 ? '#8FE8A8' : '#4B6356';
  ctx.font = `700 ${Math.max(8, w * 0.075)}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(rpm > 0 ? `${Math.round(rpm)}` : '— — —', cx, by - h * 0.3 + h * 0.095);
  if (label) tagSmall(ctx, cx, by + 16, label);
}

/** Пробірка Еппендорф (1,5 мл) з надосадовою рідиною та осадом. */
export function eppendorf(ctx, cx, topY, w, h, {
  liquid = 0.75, color = '#E6EEDE', pellet = 0, pelletColor = '#D9E2C4', open = false, label = '', cloudy = 0, seed = 3, layers = null,
} = {}) {
  const r = w / 2;
  const coneH = h * 0.3;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - r, topY);
    ctx.lineTo(cx - r, topY + h - coneH);
    ctx.quadraticCurveTo(cx - r * 0.25, topY + h, cx, topY + h);
    ctx.quadraticCurveTo(cx + r * 0.25, topY + h, cx + r, topY + h - coneH);
    ctx.lineTo(cx + r, topY);
    ctx.closePath();
  };
  shadow(ctx, cx + w * 0.2, topY + h + 2, w * 0.8, w * 0.18, 0.25);
  ctx.save();
  path(); ctx.fillStyle = 'rgba(228,241,236,.34)'; ctx.fill(); ctx.clip();
  const surf = topY + (h - coneH * 0.2) * (1 - liquid);
  if (liquid > 0.02) {
    const c = hex(color);
    const lg = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    lg.addColorStop(0, rgba(shade(c, -0.3), 0.62)); lg.addColorStop(0.3, rgba(shade(c, 0.1), 0.5));
    lg.addColorStop(0.75, rgba(c, 0.5)); lg.addColorStop(1, rgba(shade(c, -0.32), 0.62));
    ctx.fillStyle = lg; ctx.fillRect(cx - r, surf, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(cx - r + 1, surf + 1.2); ctx.quadraticCurveTo(cx, surf + 3.4, cx + r - 1, surf + 1.2); ctx.stroke();
    if (cloudy > 0) {
      const R = rng(seed);
      ctx.fillStyle = rgba(shade(hex(color), -0.25), 0.2 * cloudy);
      for (let i = 0; i < 120 * cloudy; i++) {
        ctx.beginPath();
        ctx.arc(cx - r + R() * w, surf + R() * (topY + h - surf), 0.5 + R() * 1.1, 0, TAU);
        ctx.fill();
      }
    }
  }
  // кілька фаз (фенол — хлороформ — водна фаза)
  if (layers) {
    let y = surf;
    const total = layers.reduce((s, L) => s + L.f, 0) || 1;
    const H = topY + h - coneH * 0.25 - surf;
    for (const L of layers) {
      const lh = (L.f / total) * H;
      const c = hex(L.color);
      const lg = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
      lg.addColorStop(0, rgba(shade(c, -0.3), 0.78)); lg.addColorStop(0.35, rgba(shade(c, 0.12), 0.62));
      lg.addColorStop(1, rgba(shade(c, -0.3), 0.78));
      ctx.fillStyle = lg; ctx.fillRect(cx - r, y, w, lh + 0.6);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(cx - r, y + 0.5); ctx.lineTo(cx + r, y + 0.5); ctx.stroke();
      y += lh;
    }
  }
  // осад на дні конуса
  if (pellet > 0.02) {
    const ph = coneH * 0.55 * clamp(pellet, 0, 1);
    const pg = ctx.createRadialGradient(cx - r * 0.2, topY + h - ph, 1, cx, topY + h, ph * 1.8);
    pg.addColorStop(0, rgba(shade(hex(pelletColor), 0.3), 0.98));
    pg.addColorStop(1, rgba(shade(hex(pelletColor), -0.3), 0.98));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.72, topY + h - ph * 1.1);
    ctx.quadraticCurveTo(cx, topY + h - ph * 1.55, cx + r * 0.72, topY + h - ph * 1.1);
    ctx.lineTo(cx + r * 0.5, topY + h);
    ctx.lineTo(cx - r * 0.5, topY + h);
    ctx.closePath(); ctx.fill();
  }
  // відблиски скла/пластику
  const gs = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  gs.addColorStop(0, 'rgba(50,80,70,.22)'); gs.addColorStop(0.14, 'rgba(255,255,255,.6)');
  gs.addColorStop(0.3, 'rgba(255,255,255,.06)'); gs.addColorStop(0.82, 'rgba(255,255,255,.26)');
  gs.addColorStop(1, 'rgba(50,80,70,.26)');
  ctx.fillStyle = gs; ctx.fillRect(cx - r, topY, w, h);
  ctx.restore();
  ctx.save(); path(); ctx.strokeStyle = 'rgba(70,100,90,.5)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  // кришечка
  ctx.save();
  ctx.translate(cx, topY);
  if (open) ctx.rotate(-0.9);
  const cg = ctx.createLinearGradient(-r, 0, r, 0);
  cg.addColorStop(0, '#AFBCB7'); cg.addColorStop(0.3, '#F2F6F4'); cg.addColorStop(1, '#93A39C');
  ctx.fillStyle = cg; roundRect(ctx, -r - 1.5, -w * 0.32, w + 3, w * 0.34, 2.5); ctx.fill();
  ctx.strokeStyle = 'rgba(60,85,75,.4)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore();
  if (label) tagSmall(ctx, cx, topY + h + 15, label);
  return { surf };
}

/** Водяна баня / термостат: ванна з водою, що кипить, і штатив із пробіркою. */
export function waterBath(ctx, cx, by, w, { temp = 100, boil = 0, t = 0, label = '' } = {}) {
  const h = w * 0.46;
  shadow(ctx, cx + w * 0.05, by + 2, w * 0.56, w * 0.06, 0.28);
  const g = ctx.createLinearGradient(0, by - h, 0, by);
  g.addColorStop(0, '#E4EBEC'); g.addColorStop(0.5, '#C2CDD0'); g.addColorStop(1, '#8D999C');
  ctx.fillStyle = g; roundRect(ctx, cx - w / 2, by - h, w, h, w * 0.04); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,55,.3)'; ctx.lineWidth = 1; ctx.stroke();
  // вода
  const wy = by - h * 0.74;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - w * 0.44, wy, w * 0.88, h * 0.6); ctx.clip();
  const wg = ctx.createLinearGradient(0, wy, 0, by - h * 0.14);
  wg.addColorStop(0, 'rgba(186,220,232,.9)'); wg.addColorStop(1, 'rgba(120,168,186,.95)');
  ctx.fillStyle = wg; ctx.fillRect(cx - w * 0.44, wy, w * 0.88, h);
  if (boil > 0) {
    const R = rng(7);
    for (let i = 0; i < 30 * boil; i++) {
      const bx = cx - w * 0.42 + R() * w * 0.84;
      const sp = 0.4 + R();
      const byy = by - h * 0.16 - ((R() * h * 0.5 + t * 55 * sp) % (h * 0.56));
      const r = 0.8 + R() * 2.1;
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.arc(bx, byy, r, 0, TAU); ctx.fill();
    }
    // пара
    for (let i = 0; i < 5; i++) {
      const sx = cx - w * 0.3 + i * w * 0.15;
      const ph = (t * 0.6 + i * 0.37) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.2 * (1 - ph) * boil})`;
      ctx.beginPath();
      ctx.ellipse(sx + Math.sin(t * 2 + i) * 4, wy - ph * h * 0.55, w * 0.05 * (0.6 + ph), w * 0.035 * (0.6 + ph), 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.44, wy + 0.5); ctx.lineTo(cx + w * 0.44, wy + 0.5); ctx.stroke();
  // термометр-дисплей
  ctx.fillStyle = '#16221E'; roundRect(ctx, cx - w * 0.17, by - h * 0.22, w * 0.34, h * 0.16, 3); ctx.fill();
  ctx.fillStyle = '#F3C969';
  ctx.font = `700 ${Math.max(8, w * 0.07)}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(temp)} °C`, cx, by - h * 0.22 + h * 0.08);
  if (label) tagSmall(ctx, cx, by + 16, label);
  return { waterY: wy, innerTop: wy };
}

/**
 * Спектрофотометр: корпус, кюветне відділення з кварцовою кюветою, промінь, дисплей.
 * lam — довжина хвилі (нм), D — оптична густина, beam 0..1 — яскравість променя.
 */
export function spectro(ctx, x, y, w, h, { lam = 260, D = 0, beam = 1, sampleColor = '#DCE9F2', scanning = false, t = 0 } = {}) {
  const bodyY = y + h * 0.18;
  const bodyH = h * 0.72;
  shadow(ctx, x + w * 0.52, bodyY + bodyH + 3, w * 0.46, w * 0.045, 0.3);
  // корпус
  const g = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  g.addColorStop(0, '#EDF1F2'); g.addColorStop(0.35, '#D2DBDD'); g.addColorStop(1, '#8E9B9E');
  ctx.fillStyle = g; roundRect(ctx, x, bodyY, w, bodyH, Math.min(14, w * 0.04)); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,55,.32)'; ctx.lineWidth = 1; ctx.stroke();
  // верхня панель-скіс
  const tg = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH * 0.22);
  tg.addColorStop(0, '#FAFCFC'); tg.addColorStop(1, '#D8E0E2');
  ctx.fillStyle = tg; roundRect(ctx, x + 3, bodyY + 3, w - 6, bodyH * 0.2, 8); ctx.fill();

  // дисплей
  const dx = x + w * 0.055, dy = bodyY + bodyH * 0.3, dw = w * 0.42, dh = bodyH * 0.42;
  ctx.fillStyle = '#0E1A17'; roundRect(ctx, dx, dy, dw, dh, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
  const fs = Math.max(10, dh * 0.3);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${fs * 0.62}px ui-monospace, monospace`;
  ctx.fillStyle = '#7FD6A6';
  ctx.fillText('λ', dx + dw * 0.08, dy + dh * 0.28);
  ctx.font = `700 ${fs}px ui-monospace, monospace`;
  ctx.fillStyle = '#B9F3CD';
  ctx.fillText(`${Math.round(lam)} нм`, dx + dw * 0.22, dy + dh * 0.28);
  ctx.font = `700 ${fs * 0.62}px ui-monospace, monospace`;
  ctx.fillStyle = '#7FD6A6';
  ctx.fillText('D', dx + dw * 0.08, dy + dh * 0.72);
  ctx.font = `700 ${fs}px ui-monospace, monospace`;
  ctx.fillStyle = '#F5E3A0';
  ctx.fillText(D.toFixed(3).replace('.', ','), dx + dw * 0.22, dy + dh * 0.72);
  if (scanning) {
    ctx.fillStyle = `rgba(160,230,255,${0.5 + 0.5 * Math.sin(t * 7)})`;
    ctx.beginPath(); ctx.arc(dx + dw * 0.9, dy + dh * 0.22, Math.max(2, dh * 0.07), 0, TAU); ctx.fill();
  }

  // кюветне відділення (відкрите)
  const cx0 = x + w * 0.56, cy0 = bodyY + bodyH * 0.22, cw = w * 0.38, ch = bodyH * 0.62;
  ctx.fillStyle = '#20302C'; roundRect(ctx, cx0, cy0, cw, ch, 6); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(ctx, cx0 + 3, cy0 + 3, cw - 6, ch - 6, 4); ctx.fill();

  // промінь (УФ — умовно фіолетовий)
  const bY = cy0 + ch * 0.46;
  const col = lam < 240 ? [150, 110, 235] : lam < 290 ? [138, 130, 245] : [120, 160, 250];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bg = ctx.createLinearGradient(cx0 + 4, 0, cx0 + cw - 4, 0);
  bg.addColorStop(0, rgba(col, 0.75 * beam));
  bg.addColorStop(0.45, rgba(col, 0.5 * beam * Math.exp(-D * 0.8)));
  bg.addColorStop(1, rgba(col, 0.42 * beam * Math.exp(-D * 1.6)));
  ctx.fillStyle = bg;
  ctx.fillRect(cx0 + 4, bY - ch * 0.08, cw - 8, ch * 0.16);
  ctx.restore();

  // кварцова кювета 10 мм
  const qw = cw * 0.3, qh = ch * 0.72, qx = cx0 + cw * 0.36, qy = cy0 + ch * 0.17;
  ctx.save();
  ctx.beginPath(); roundRect(ctx, qx, qy, qw, qh, 2);
  ctx.fillStyle = 'rgba(225,240,245,.3)'; ctx.fill(); ctx.clip();
  const sc = hex(sampleColor);
  const lg = ctx.createLinearGradient(qx, 0, qx + qw, 0);
  lg.addColorStop(0, rgba(shade(sc, -0.25), 0.72)); lg.addColorStop(0.35, rgba(shade(sc, 0.18), 0.6));
  lg.addColorStop(1, rgba(shade(sc, -0.3), 0.72));
  ctx.fillStyle = lg; ctx.fillRect(qx, qy + qh * 0.16, qw, qh);
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(qx + 1, qy + qh * 0.16); ctx.quadraticCurveTo(qx + qw / 2, qy + qh * 0.2, qx + qw - 1, qy + qh * 0.16); ctx.stroke();
  const sg = ctx.createLinearGradient(qx, 0, qx + qw, 0);
  sg.addColorStop(0, 'rgba(255,255,255,.5)'); sg.addColorStop(0.22, 'rgba(255,255,255,.08)');
  sg.addColorStop(0.8, 'rgba(255,255,255,.3)'); sg.addColorStop(1, 'rgba(255,255,255,.08)');
  ctx.fillStyle = sg; ctx.fillRect(qx, qy, qw, qh);
  ctx.restore();
  ctx.strokeStyle = 'rgba(220,240,245,.75)'; ctx.lineWidth = 1.2;
  roundRect(ctx, qx, qy, qw, qh, 2); ctx.stroke();
  return { cuvette: { x: qx, y: qy, w: qw, h: qh }, body: { x, y: bodyY, w, h: bodyH } };
}

/**
 * Камера для горизонтального електрофорезу (вид 3/4): ванна з буфером, гель, електроди,
 * джерело струму. front 0..1 — положення фронту барвника.
 */
export function gelTank(ctx, x, y, w, h, { volt = 35, front = 0, running = false, lanes = [], t = 0 } = {}) {
  const tankH = h * 0.56, tankY = y + h * 0.3;
  shadow(ctx, x + w * 0.52, tankY + tankH + 3, w * 0.46, w * 0.03, 0.3);
  // ванна (прозорий акрил)
  ctx.save();
  ctx.fillStyle = 'rgba(205,228,230,.35)';
  roundRect(ctx, x, tankY, w, tankH, 6); ctx.fill();
  ctx.clip();
  // буфер
  const bufY = tankY + tankH * 0.2;
  const bg = ctx.createLinearGradient(0, bufY, 0, tankY + tankH);
  bg.addColorStop(0, 'rgba(176,214,226,.6)'); bg.addColorStop(1, 'rgba(120,170,186,.75)');
  ctx.fillStyle = bg; ctx.fillRect(x, bufY, w, tankH);
  // гель усередині буфера
  const gx = x + w * 0.1, gy = bufY + tankH * 0.16, gw = w * 0.8, gh = tankH * 0.62;
  ctx.fillStyle = 'rgba(236,246,244,.55)';
  roundRect(ctx, gx, gy, gw, gh, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.stroke();
  // лунки + синій фронт барвника
  const n = Math.max(1, lanes.length || 4);
  for (let i = 0; i < n; i++) {
    const lx = gx + gw * ((i + 0.5) / n);
    ctx.fillStyle = 'rgba(30,55,45,.5)';
    roundRect(ctx, lx - gw / n * 0.3, gy + 3, gw / n * 0.6, Math.max(3, gh * 0.07), 1.5); ctx.fill();
    const fy = gy + 6 + front * (gh - 14);
    ctx.fillStyle = `rgba(40,70,190,${0.55 + 0.2 * Math.sin(t * 2 + i)})`;
    roundRect(ctx, lx - gw / n * 0.3, fy, gw / n * 0.6, Math.max(2.5, gh * 0.05), 1.5); ctx.fill();
  }
  // відблиск на буфері
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath(); ctx.ellipse(x + w * 0.3, bufY + 5, w * 0.22, 4, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,95,90,.45)'; ctx.lineWidth = 1.2;
  roundRect(ctx, x, tankY, w, tankH, 6); ctx.stroke();
  // кришка-електроди
  ctx.strokeStyle = '#B23A2A'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + w * 0.04, tankY - 4); ctx.lineTo(x + w * 0.04, tankY + tankH * 0.5); ctx.stroke();
  ctx.strokeStyle = '#1F3A5A';
  ctx.beginPath(); ctx.moveTo(x + w * 0.96, tankY - 4); ctx.lineTo(x + w * 0.96, tankY + tankH * 0.5); ctx.stroke();
  // джерело струму
  const sw = w * 0.3, sh = h * 0.24, sx = x + w * 0.35, sy = y;
  const pg = ctx.createLinearGradient(0, sy, 0, sy + sh);
  pg.addColorStop(0, '#E9EEEF'); pg.addColorStop(1, '#97A4A7');
  ctx.fillStyle = pg; roundRect(ctx, sx, sy, sw, sh, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,55,.3)'; ctx.lineWidth = 1; ctx.stroke();
  const dw2 = sw * 0.56, dh2 = sh * 0.5;
  ctx.fillStyle = '#101D18'; roundRect(ctx, sx + sw * 0.07, sy + sh * 0.24, dw2, dh2, 3); ctx.fill();
  ctx.fillStyle = running ? '#9DE8B1' : '#5A6F64';
  ctx.font = `700 ${Math.max(8, Math.min(dh2 * 0.6, dw2 * 0.26))}px ui-monospace, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(volt)} В`, sx + sw * 0.07 + dw2 / 2, sy + sh * 0.24 + dh2 / 2);
  ctx.fillStyle = running ? '#F05A4B' : '#55655E';
  ctx.beginPath(); ctx.arc(sx + sw * 0.82, sy + sh * 0.4, Math.max(2.5, sh * 0.08), 0, TAU); ctx.fill();
  // дроти
  ctx.strokeStyle = '#B23A2A'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(sx + sw * 0.7, sy + sh); ctx.quadraticCurveTo(x + w * 0.12, sy + sh * 1.6, x + w * 0.04, tankY - 4); ctx.stroke();
  ctx.strokeStyle = '#1F3A5A';
  ctx.beginPath(); ctx.moveTo(sx + sw * 0.86, sy + sh); ctx.quadraticCurveTo(x + w * 0.9, sy + sh * 1.6, x + w * 0.96, tankY - 4); ctx.stroke();
  return { gel: { x: gx, y: gy, w: gw, h: gh } };
}

/**
 * УФ-трансілюмінатор з агарозним гелем: темна кімната, фіолетове світло знизу,
 * смуги ДНК світяться оранжево-рожевим (бромистий етидій).
 * lanes: [{label, bands: [{rf, bright 0..1, w, smear 0..1}]}]
 */
export function transilluminator(ctx, x, y, w, h, { lanes = [], front = 1, glow = 1, t = 0, padLeft = 0 } = {}) {
  // корпус приладу
  const bodyPad = Math.min(16, w * 0.035);
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2A3634'); g.addColorStop(1, '#171F1E');
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.stroke();
  // світлове поле (УФ 312 нм)
  const px = x + bodyPad, py = y + bodyPad, pw = w - bodyPad * 2, ph = h - bodyPad * 2;
  const ug = ctx.createLinearGradient(0, py, 0, py + ph);
  ug.addColorStop(0, '#2B1F63'); ug.addColorStop(0.5, '#3A2A80'); ug.addColorStop(1, '#241A52');
  ctx.fillStyle = ug; roundRect(ctx, px, py, pw, ph, 5); ctx.fill();
  // гель на склі
  const gx = px + pw * 0.06, gy = py + ph * 0.07, gw = pw * 0.88, gh = ph * 0.86;
  ctx.save();
  roundRect(ctx, gx, gy, gw, gh, 4); ctx.clip();
  const gg = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
  gg.addColorStop(0, 'rgba(120,80,160,.5)'); gg.addColorStop(0.5, 'rgba(96,62,140,.42)'); gg.addColorStop(1, 'rgba(78,50,120,.5)');
  ctx.fillStyle = gg; ctx.fillRect(gx, gy, gw, gh);
  // фонове світіння бромистого етидію в гелі
  ctx.globalCompositeOperation = 'lighter';
  const bgGlow = ctx.createRadialGradient(gx + gw * 0.5, gy + gh * 0.5, gh * 0.1, gx + gw * 0.5, gy + gh * 0.5, gw * 0.7);
  bgGlow.addColorStop(0, 'rgba(188,96,120,.22)'); bgGlow.addColorStop(1, 'rgba(120,60,110,0)');
  ctx.fillStyle = bgGlow; ctx.fillRect(gx, gy, gw, gh);
  ctx.globalCompositeOperation = 'source-over';

  const n = Math.max(1, lanes.length);
  const lanesX = gx + padLeft;
  const lanesW = gw - padLeft;
  const laneW = lanesW / n;
  const wellY = gy + gh * 0.045;
  const runH = gh * 0.88;
  for (let i = 0; i < n; i++) {
    const lx = lanesX + laneW * (i + 0.5);
    const bw = laneW * 0.62;
    // лунка
    ctx.fillStyle = 'rgba(12,8,30,.72)';
    roundRect(ctx, lx - bw / 2, wellY, bw, Math.max(3, gh * 0.035), 1.5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 0.8; ctx.stroke();
    for (const b of (lanes[i].bands || [])) {
      const byy = wellY + gh * 0.05 + b.rf * runH * front;
      const bh = Math.max(2.2, (b.h || 0.016) * gh);
      const bright = clamp(b.bright, 0, 1) * glow;
      if (bright <= 0.02) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (b.smear > 0.02) {
        const sh2 = runH * 0.55 * b.smear;
        const sg = ctx.createLinearGradient(0, byy, 0, byy + sh2);
        sg.addColorStop(0, `rgba(255,140,80,${0.3 * bright})`);
        sg.addColorStop(1, 'rgba(255,120,70,0)');
        ctx.fillStyle = sg; ctx.fillRect(lx - bw / 2, byy, bw, sh2);
      }
      // ореол
      const hg = ctx.createRadialGradient(lx, byy + bh / 2, 0, lx, byy + bh / 2, bw * 0.75);
      hg.addColorStop(0, `rgba(255,150,90,${0.55 * bright})`);
      hg.addColorStop(0.55, `rgba(255,110,70,${0.2 * bright})`);
      hg.addColorStop(1, 'rgba(255,90,60,0)');
      ctx.fillStyle = hg;
      ctx.save(); ctx.translate(lx, byy + bh / 2); ctx.scale(1, Math.max(0.3, bh / (bw * 0.6))); ctx.translate(-lx, -(byy + bh / 2));
      ctx.beginPath(); ctx.arc(lx, byy + bh / 2, bw * 0.75, 0, TAU); ctx.fill();
      ctx.restore();
      // ядро смуги
      const cg = ctx.createLinearGradient(lx - bw / 2, 0, lx + bw / 2, 0);
      cg.addColorStop(0, `rgba(255,170,120,${0.5 * bright})`);
      cg.addColorStop(0.5, `rgba(255,232,200,${0.95 * bright})`);
      cg.addColorStop(1, `rgba(255,160,110,${0.5 * bright})`);
      ctx.fillStyle = cg;
      roundRect(ctx, lx - bw / 2, byy, bw, bh, Math.min(2, bh / 2)); ctx.fill();
      ctx.restore();
    }
  }
  // легкі дефекти гелю (бульбашки, подряпини) — реалістичність
  const R = rng(17);
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 16; i++) {
    const bx = gx + R() * gw, byy = gy + R() * gh;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(bx, byy, 0.6 + R() * 1.6, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // скляне відбиття на гелі
  ctx.save();
  roundRect(ctx, gx, gy, gw, gh, 4); ctx.clip();
  const refl = ctx.createLinearGradient(gx, gy, gx + gw * 0.7, gy + gh);
  refl.addColorStop(0, 'rgba(255,255,255,.12)'); refl.addColorStop(0.35, 'rgba(255,255,255,.02)'); refl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = refl; ctx.fillRect(gx, gy, gw, gh);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
  roundRect(ctx, gx, gy, gw, gh, 4); ctx.stroke();
  ctx.restore();
  return { gel: { x: gx, y: gy, w: gw, h: gh, wellY, runH, laneW, n, lanesX } };
}

/** Моток ниток ДНК в етанолі (видимий осад при осадженні). */
export function dnaThreads(ctx, cx, cy, r, { amount = 1, seed = 4, t = 0 } = {}) {
  if (amount <= 0.02) return;
  const R = rng(seed);
  ctx.save();
  ctx.globalAlpha = clamp(amount, 0, 1);
  ctx.strokeStyle = 'rgba(252,252,245,.85)';
  ctx.lineWidth = Math.max(0.8, r * 0.07);
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a0 = R() * TAU;
    ctx.beginPath();
    let px = cx + Math.cos(a0) * r * 0.2, py = cy + Math.sin(a0) * r * 0.2;
    ctx.moveTo(px, py);
    let a = a0;
    for (let s = 0; s < 7; s++) {
      a += (R() - 0.5) * 1.6 + Math.sin(t * 0.6 + i) * 0.08;
      px += Math.cos(a) * r * 0.26;
      py += Math.sin(a) * r * 0.2;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Кільцева плазміда (схема): коло ДНК із позначеними генами/сайтами. */
export function plasmidRing(ctx, cx, cy, r, { arcs = [], label = '', t = 0, supercoil = 0 } = {}) {
  ctx.save();
  // тінь кола
  ctx.strokeStyle = 'rgba(20,45,30,.18)'; ctx.lineWidth = Math.max(3, r * 0.14);
  ctx.beginPath(); ctx.arc(cx, cy + 1.5, r, 0, TAU); ctx.stroke();
  if (supercoil > 0.02) {
    // надспіралізована форма — «вісімка»
    ctx.strokeStyle = 'rgba(70,110,90,.35)'; ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * TAU;
      const rr = r * (1 + supercoil * 0.22 * Math.sin(a * 3 + t));
      const px = cx + Math.cos(a) * rr * 0.9, py = cy + Math.sin(a) * rr * 0.62;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.strokeStyle = '#4E7E63'; ctx.lineWidth = Math.max(2.4, r * 0.1);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(0.8, r * 0.03);
  ctx.beginPath(); ctx.arc(cx, cy, r - r * 0.045, Math.PI * 1.05, Math.PI * 1.65); ctx.stroke();
  for (const a of arcs) {
    ctx.strokeStyle = a.color; ctx.lineWidth = Math.max(4, r * 0.17);
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(cx, cy, r, a.a0, a.a1); ctx.stroke();
    if (a.label) {
      const am = (a.a0 + a.a1) / 2;
      const lx = cx + Math.cos(am) * (r + r * 0.42), ly = cy + Math.sin(am) * (r + r * 0.42);
      ctx.strokeStyle = 'rgba(40,70,55,.4)'; ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(am) * (r + r * 0.12), cy + Math.sin(am) * (r + r * 0.12));
      ctx.lineTo(lx, ly); ctx.stroke();
      chip(ctx, lx, ly + 3, a.label, { size: Math.max(9, r * 0.15), align: Math.cos(am) < -0.3 ? 'right' : Math.cos(am) > 0.3 ? 'left' : 'center' });
    }
  }
  if (label) chip(ctx, cx, cy + Math.max(4, r * 0.1), label, { size: Math.max(10, r * 0.17) });
  ctx.restore();
}

/** Клітина агробактерії (паличка з джгутиками) — для сцени кокультивування. */
export function agroCell(ctx, cx, cy, len, ang, { t = 0, seed = 1, alpha = 1, glow = false } = {}) {
  const R = rng(seed);
  const wdt = len * 0.38;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy); ctx.rotate(ang);
  // джгутики
  ctx.strokeStyle = 'rgba(90,120,100,.55)'; ctx.lineWidth = Math.max(0.5, len * 0.035);
  for (let i = 0; i < 3; i++) {
    const side = i - 1;
    ctx.beginPath();
    ctx.moveTo(-len * 0.45, side * wdt * 0.3);
    for (let s = 1; s <= 6; s++) {
      const f = s / 6;
      ctx.lineTo(-len * 0.45 - f * len * 0.7, side * wdt * 0.3 + Math.sin(t * 6 + f * 7 + i) * wdt * 0.35 * f);
    }
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, -wdt / 2, 0, wdt / 2);
  g.addColorStop(0, glow ? '#C8F5C0' : '#BFD9A8');
  g.addColorStop(0.45, glow ? '#79C47A' : '#8FB56C');
  g.addColorStop(1, glow ? '#357A45' : '#5A7C3F');
  ctx.fillStyle = g;
  roundRect(ctx, -len / 2, -wdt / 2, len, wdt, wdt / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,70,40,.5)'; ctx.lineWidth = Math.max(0.5, len * 0.025); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath(); ctx.ellipse(-len * 0.12, -wdt * 0.2, len * 0.2, wdt * 0.13, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
