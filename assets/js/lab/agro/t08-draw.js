// Тема 8. Власні 2.5D-примітиви сцен мікроклонального розмноження (доповнюють kit.js):
// дерев'яний штатив, планшет ІФА, скальпель, пагін із вузлами, рослина картоплі з мікробульбами, корені в агарі,
// апекс пагона під бінокуляром, горщик із субстратом, скляний ковпак, гігрометр, продих, міліметровий папір.
import { TAU, clamp, lerp, rng, noise, hex, rgba, mix, shade, roundRect, shadow, leaf, offscreen, MAT, tagSmall } from './kit.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export function text(ctx, s, x, y, { size = 12, weight = 600, color = '#1F3A2A', align = 'left', base = 'alphabetic', shadowC = null } = {}) {
  ctx.save(); ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = base;
  if (shadowC) { ctx.fillStyle = shadowC; ctx.fillText(s, x + 1, y + 1); }
  ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
}
/** Табличка-плашка з текстом (для HUD на полотні). */
export function pill(ctx, s, x, y, { size = 11.5, dark = true, align = 'left', color = null } = {}) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`;
  const m = ctx.measureText(s).width, w = m + 14, h = size + 9;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = dark ? 'rgba(10,28,18,.74)' : 'rgba(255,255,255,.9)';
  roundRect(ctx, x0, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(20,60,35,.16)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color || (dark ? '#EAF5EC' : '#173322'); ctx.textBaseline = 'middle'; ctx.fillText(s, x0 + 7, y + h / 2 + 0.5);
  ctx.restore();
  return { w, h };
}

/* ---------- Дерево ---------- */
const woodCache = new Map();
function woodTex(w, h, seed) {
  const k = `${Math.round(w)}|${Math.round(h)}|${seed}`;
  if (woodCache.has(k)) return woodCache.get(k);
  const c = offscreen(w, h), x = c.getContext('2d'), d = x.createImageData(c.width, c.height);
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
    const n = noise(i * 0.012, j * 0.35, seed) * 0.6 + noise(i * 0.05, j * 0.9, seed + 3) * 0.4;
    const ring = 0.5 + 0.5 * Math.sin((j * 0.55 + n * 9) * 1.3);
    const v = 0.78 + 0.16 * ring + 0.1 * n;
    const p = (j * c.width + i) * 4;
    d.data[p] = 196 * v; d.data[p + 1] = 132 * v; d.data[p + 2] = 76 * v; d.data[p + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  if (woodCache.size > 30) woodCache.clear();
  woodCache.set(k, c);
  return c;
}
export function woodBlock(ctx, x, y, w, h, { seed = 2, r = 3, top = 0 } = {}) {
  ctx.save();
  if (top > 0) { // верхня грань (перспектива)
    ctx.beginPath(); ctx.moveTo(x + top * 0.6, y - top); ctx.lineTo(x + w - top * 0.2, y - top); ctx.lineTo(x + w, y); ctx.lineTo(x, y); ctx.closePath();
    const g = ctx.createLinearGradient(0, y - top, 0, y); g.addColorStop(0, '#E3B47E'); g.addColorStop(1, '#C8925A');
    ctx.fillStyle = g; ctx.fill();
  }
  roundRect(ctx, x, y, w, h, r); ctx.clip();
  ctx.drawImage(woodTex(Math.min(900, w), Math.max(8, h), seed), x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,230,190,.35)'); g.addColorStop(0.15, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,30,10,.35)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Дерев'яний штатив: задня планка з отворами (малювати ДО пробірок). */
export function rackBack(ctx, x, y, w, tubes) {
  shadow(ctx, x + w / 2 + 8, y + 6, w * 0.56, 10, 0.3);
  woodBlock(ctx, x, y - 10, w, 12, { seed: 5, top: 6 });
  ctx.save(); ctx.fillStyle = 'rgba(40,20,8,.55)';
  for (const t of tubes) { ctx.beginPath(); ctx.ellipse(t.cx, y - 7, t.w * 0.62, 2.6, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}
/** Передня планка штатива (малювати ПІСЛЯ пробірок). */
export function rackFront(ctx, x, y, w, h) {
  shadow(ctx, x + w / 2 + 6, y + h + 2, w * 0.55, 8, 0.35);
  woodBlock(ctx, x, y, w, h, { seed: 9, top: 7 });
  ctx.save(); ctx.strokeStyle = 'rgba(255,240,215,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2, y + 0.5); ctx.lineTo(x + w - 2, y + 0.5); ctx.stroke(); ctx.restore();
}

/* ---------- Планшет ІФА ---------- */
/** Стрип ІФА: states — [{v: 0..1 (жовте забарвлення), na: true — не тестували}], reveal 0..1. */
export function elisaStrip(ctx, x, y, w, states, { reveal = 1, label = '' } = {}) {
  const n = states.length, h = Math.max(22, w / n * 1.05), cell = w / n, r = Math.min(cell * 0.36, h * 0.38);
  shadow(ctx, x + w / 2 + 4, y + h + 3, w * 0.55, 6, 0.25);
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#FAFBFA'); g.addColorStop(1, '#DCE3DF');
  ctx.fillStyle = g; roundRect(ctx, x - 6, y, w + 12, h, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(80,100,90,.35)'; ctx.lineWidth = 1; ctx.stroke();
  states.forEach((s, i) => {
    const cx = x + cell * (i + 0.5), cy = y + h / 2;
    const wg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
    wg.addColorStop(0, '#FFFFFF'); wg.addColorStop(1, '#C4CEC9');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    const a = clamp(reveal * n - i, 0, 1);
    if (s.na) {
      ctx.strokeStyle = `rgba(120,120,120,${0.6 * a})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - r * 0.4, cy - r * 0.4); ctx.lineTo(cx + r * 0.4, cy + r * 0.4); ctx.moveTo(cx + r * 0.4, cy - r * 0.4); ctx.lineTo(cx - r * 0.4, cy + r * 0.4); ctx.stroke();
    } else if (a > 0) {
      const c = mix([236, 240, 228], [244, 190, 20], clamp(s.v, 0, 1));
      const lg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 0.5, cx, cy, r * 0.86);
      lg.addColorStop(0, rgba(shade(c, 0.35), 0.95 * a)); lg.addColorStop(1, rgba(shade(c, -0.12), 0.95 * a));
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(70,90,80,.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
  });
  ctx.restore();
  if (label) text(ctx, label, x - 4, y - 6, { size: 11, color: '#E9F3EC', weight: 700 });
  return h;
}

/* ---------- Скальпель ---------- */
export function scalpel(ctx, x, y, ang, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
  // лезо (вістря в точці 0,0)
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(18, -9, 44, -8); ctx.lineTo(46, 2); ctx.lineTo(8, 2); ctx.closePath();
  const g = ctx.createLinearGradient(0, -9, 0, 3); g.addColorStop(0, '#F7F9FA'); g.addColorStop(0.5, '#B9C2C7'); g.addColorStop(1, '#7E888E');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(3, -1); ctx.quadraticCurveTo(18, -8, 42, -7); ctx.stroke();
  // ручка
  const hg = ctx.createLinearGradient(0, -5, 0, 6); hg.addColorStop(0, '#E8ECEE'); hg.addColorStop(0.45, '#9AA4AA'); hg.addColorStop(1, '#5D676D');
  ctx.fillStyle = hg; roundRect(ctx, 44, -5, 92, 9, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(40,50,55,.35)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(70 + i * 5, -4); ctx.lineTo(72 + i * 5, 3); ctx.stroke(); }
  ctx.restore();
}

/* ---------- Рослини ---------- */
/**
 * Прямостоячий пагін із вузлами. Повертає масив вузлів [{x, y, side}].
 * o: h, nodes, leafLen, leafW, color, opposite, droop 0..1 (в'янення), pale, seed, sway, lean
 */
export function shoot(ctx, x, y, o = {}) {
  const { h = 60, nodes = 4, leafLen = 14, leafW = 0.45, color = MAT.leaf, opposite = false, droop = 0, pale = 0, seed = 1, sway = 0, lean = 0, stemW = null } = o;
  const R = rng(seed);
  const pts = [[x, y]];
  let px = x, py = y, a = -Math.PI / 2 + lean;
  const seg = h / Math.max(1, nodes);
  for (let i = 0; i < nodes; i++) {
    a += (R() - 0.5) * 0.22 + sway * 0.25 + droop * 0.06 * (i / nodes);
    px += Math.cos(a) * seg; py += Math.sin(a) * seg; pts.push([px, py]);
  }
  const stemC = mix(hex(MAT.stem), hex(MAT.leafPale), pale * 0.7);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const sw = stemW ?? Math.max(1.3, Math.min(3.2, h * 0.035));
  ctx.strokeStyle = rgba(shade(stemC, -0.3)); ctx.lineWidth = sw;
  ctx.beginPath(); pts.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.stroke();
  ctx.strokeStyle = rgba(shade(stemC, 0.3), 0.75); ctx.lineWidth = sw * 0.38; ctx.stroke();
  ctx.restore();
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const [X, Y] = pts[i];
    const rel = i / pts.length;
    const sz = leafLen * (0.55 + 0.5 * Math.sin(Math.PI * Math.min(0.92, rel + 0.12)));
    const side = i % 2 ? 1 : -1;
    const up = -0.62 + droop * 1.5 + (R() - 0.5) * 0.25;
    const curl = 0.1 + droop * 0.35;
    const drawLeaf = (sd) => leaf(ctx, X, Y, sz * (1 - droop * 0.15), sd > 0 ? up : Math.PI - up, { color, pale, width: leafW * (1 - droop * 0.35), curl });
    drawLeaf(side);
    if (opposite) drawLeaf(-side);
    ctx.fillStyle = rgba(shade(stemC, -0.35)); ctx.beginPath(); ctx.arc(X, Y, Math.max(1, sw * 0.55), 0, TAU); ctx.fill();
    out.push({ x: X, y: Y, side });
  }
  const [tx, ty] = pts[pts.length - 1];
  leaf(ctx, tx, ty, leafLen * 0.42, -Math.PI / 2 - 0.4 + droop * 0.8, { color, pale, veins: false, width: leafW });
  leaf(ctx, tx, ty, leafLen * 0.38, -Math.PI / 2 + 0.4 + droop * 0.8, { color, pale, veins: false, width: leafW });
  return { nodes: out, top: [tx, ty] };
}

/** Корені в агарі (напівпрозорі, з волосками). */
export function roots(ctx, x, y, { n = 4, len = 20, seed = 3, w = 1.2, spread = 1.4, hairs = true, maxY = Infinity, color = MAT.root } = {}) {
  if (n <= 0 || len <= 0.5) return;
  const R = rng(seed);
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let px = x + (R() - 0.5) * 3, py = y, a = Math.PI / 2 + (R() - 0.5) * spread;
    const L = len * (0.55 + R() * 0.6), seg = 9, pts = [[px, py]];
    for (let s = 0; s < seg; s++) { a += (R() - 0.5) * 0.45; px += Math.cos(a) * L / seg; py = Math.min(maxY, py + Math.sin(a) * L / seg); pts.push([px, py]); }
    ctx.strokeStyle = rgba(shade(color, -0.12), 0.95); ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach(([X, Y], k) => (k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = w * 0.4; ctx.stroke();
    // бічні корінці
    if (L > 14) for (let k = 3; k < seg; k += 3) { const [qx, qy] = pts[k], b = a + (R() > 0.5 ? 1 : -1) * (0.9 + R() * 0.5), l2 = L * 0.18 * (1 - k / seg); ctx.strokeStyle = rgba(color, 0.8); ctx.lineWidth = w * 0.55; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + Math.cos(b) * l2, Math.min(maxY, qy + Math.abs(Math.sin(b)) * l2)); ctx.stroke(); }
    if (hairs) { ctx.strokeStyle = 'rgba(255,255,248,.35)'; ctx.lineWidth = 0.5; for (let k = 2; k < seg; k++) { const [qx, qy] = pts[k]; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + (R() - 0.5) * 4, qy + R() * 2.5); ctx.stroke(); } }
  }
  ctx.restore();
}

/** Мікробульба картоплі: кремово-жовта, з вічками й сочевичками; green — позеленіння на світлі. */
export function microtuber(ctx, x, y, r, { ang = 0.2, green = 0.15, seed = 1 } = {}) {
  if (r < 0.6) return;
  const R = rng(seed);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  shadow(ctx, r * 0.15, r * 0.75, r * 1.1, r * 0.3, 0.25);
  const base = mix([224, 190, 122], [168, 182, 104], green);
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.25);
  g.addColorStop(0, rgba(shade(base, 0.45))); g.addColorStop(0.55, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.42)));
  ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i <= 18; i++) { const t = i / 18 * TAU, k = 1 + 0.06 * Math.sin(t * 3 + seed); const X = Math.cos(t) * r * 1.22 * k, Y = Math.sin(t) * r * 0.92 * k; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(shade(base, -0.5), 0.5); ctx.lineWidth = 0.6; ctx.stroke();
  // шкірка: дрібні цятки
  if (r > 6) for (let i = 0; i < r * 2; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 0.95; ctx.fillStyle = R() > 0.5 ? rgba(shade(base, 0.3), 0.35) : rgba(shade(base, -0.35), 0.25); ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.15 * d, Math.sin(a) * r * 0.85 * d, 0.5 + R() * 0.6, 0, TAU); ctx.fill(); }
  // вічка: заглибина з бровою
  for (let i = 0; i < 3; i++) { const a = -2.4 + i * 1.3 + R() * 0.4, d = 0.62 + R() * 0.2, X = Math.cos(a) * r * 1.1 * d, Y = Math.sin(a) * r * 0.8 * d, er = Math.max(0.8, r * 0.13);
    const eg = ctx.createRadialGradient(X, Y + er * 0.2, 0, X, Y, er * 1.4); eg.addColorStop(0, rgba(shade(base, -0.5), 0.75)); eg.addColorStop(1, rgba(shade(base, -0.5), 0));
    ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(X, Y, er * 1.4, er * 0.9, a, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(shade(base, 0.4), 0.7); ctx.lineWidth = Math.max(0.6, r * 0.04); ctx.beginPath(); ctx.ellipse(X, Y - er * 0.4, er * 1.3, er * 0.7, a, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  // сочевички
  ctx.fillStyle = rgba(shade(base, -0.45), 0.45);
  for (let i = 0; i < 6; i++) { const a = R() * TAU, d = R() * 0.8; ctx.beginPath(); ctx.arc(Math.cos(a) * r * d, Math.sin(a) * r * 0.7 * d, Math.max(0.4, r * 0.05), 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,245,.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.45, -r * 0.42, r * 0.38, r * 0.16, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Розетка листків (гербера, буряк) — з центру догори-в боки. */
export function rosette(ctx, x, y, { n = 6, leafLen = 22, seed = 2, color = MAT.leaf, droop = 0, pale = 0, width = 0.34, spread = 2.2 } = {}) {
  const R = rng(seed);
  const order = [];
  for (let i = 0; i < n; i++) order.push({ a: -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * spread + (R() - 0.5) * 0.25, l: leafLen * (0.7 + R() * 0.45) });
  order.sort((p, q) => Math.abs(q.a + Math.PI / 2) - Math.abs(p.a + Math.PI / 2));
  for (const o of order) {
    const a = o.a + droop * Math.sign(o.a + Math.PI / 2 || 1) * 0.9;
    // черешок
    ctx.strokeStyle = rgba(shade(MAT.stem, -0.2)); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * o.l * 0.28, y + Math.sin(a) * o.l * 0.28); ctx.stroke();
    leaf(ctx, x + Math.cos(a) * o.l * 0.25, y + Math.sin(a) * o.l * 0.25, o.l * 0.8, a, { color, pale, width: width * (1 - droop * 0.3), curl: 0.12 + droop * 0.3 });
  }
}

/* ---------- Апекс пагона під бінокуляром ---------- */
/**
 * Малює апекс пагона у полі зору (вже обрізано по колу). Вісь апекса вертикальна, верхівка купола — topY.
 * s — пікселів на мкм. L — глибина зрізу (мкм). lam — глибина безвірусної зони (мкм).
 * cut 0..1 — анімація зрізу; lift — підняття вирізаного експлантата (px).
 */
const PRIM = [ // листкові примордії: глибина основи (мкм), висота над основою (мкм), бік
  { d: 75, hgt: 70, side: 1 }, { d: 150, hgt: 170, side: -1 }, { d: 300, hgt: 330, side: 1 }, { d: 520, hgt: 560, side: -1 }, { d: 780, hgt: 800, side: 1 },
];
export function primordiaIn(L) { return PRIM.filter((p) => p.d < L).length; }
export function apexField(ctx, cx, topY, s, { L = 200, lam = 130, showVirus = true, cut = 0, lift = 0, r = 200, cy = 0, seed = 4 } = {}) {
  const R = rng(seed);
  const dome = 70; // радіус купола, мкм
  const widthAt = (d) => (d < dome ? Math.sqrt(Math.max(0, dome * dome - (dome - d) ** 2)) : dome + (d - dome) * 0.2); // мкм, напівширина осі
  const X = (um) => cx + um * s, Y = (d) => topY + d * s;
  // фон: скло чашки Петрі на темному столику, кільцеве світло
  const bg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r * 1.1);
  bg.addColorStop(0, '#5A6A5E'); bg.addColorStop(1, '#1D2620');
  ctx.fillStyle = bg; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  // відбиток кільцевого освітлювача
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();

  const axisPath = (d0, d1) => {
    ctx.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps; i++) { const d = lerp(d0, d1, i / steps); const w = widthAt(d); i ? ctx.lineTo(X(-w), Y(d)) : ctx.moveTo(X(-w), Y(d)); }
    for (let i = steps; i >= 0; i--) { const d = lerp(d0, d1, i / steps); ctx.lineTo(X(widthAt(d)), Y(d)); }
    ctx.closePath();
  };
  const primPath = (p) => {
    const bw = widthAt(p.d), base = p.d, tipD = p.d - p.hgt, sd = p.side;
    const thick = 30 + p.hgt * 0.22;
    ctx.beginPath();
    ctx.moveTo(X(sd * (bw - 6)), Y(base));
    ctx.bezierCurveTo(X(sd * (bw + thick * 1.1)), Y(base - p.hgt * 0.25), X(sd * (bw + thick * 0.9)), Y(tipD + p.hgt * 0.25), X(sd * (bw * 0.55 + thick * 0.2)), Y(tipD));
    ctx.bezierCurveTo(X(sd * (bw * 0.5 + thick * 0.05)), Y(tipD + p.hgt * 0.35), X(sd * (bw - 4)), Y(base - p.hgt * 0.35), X(sd * (bw - 6)), Y(base - 8));
    ctx.closePath();
  };
  const tissue = (d) => mix([206, 228, 170], [120, 168, 84], clamp(d / 700, 0, 1));
  const drawPart = (dMax, dy) => {
    ctx.save(); ctx.translate(0, dy);
    // старші примордії позаду
    for (let i = PRIM.length - 1; i >= 0; i--) {
      const p = PRIM[i]; if (p.d > dMax + 1) continue;
      primPath(p);
      const c = tissue(p.d + 150);
      const g = ctx.createLinearGradient(X(p.side * widthAt(p.d)), 0, X(p.side * (widthAt(p.d) + 60)), 0);
      g.addColorStop(0, rgba(shade(c, -0.15))); g.addColorStop(0.5, rgba(shade(c, 0.12))); g.addColorStop(1, rgba(shade(c, -0.3)));
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = rgba(shade(c, -0.45), 0.6); ctx.lineWidth = 0.8; ctx.stroke();
      // трихоми на старших примордіях
      if (p.hgt > 250) { ctx.strokeStyle = 'rgba(245,250,235,.55)'; ctx.lineWidth = 0.6; for (let k = 0; k < p.hgt / 25; k++) { const dd = p.d - k * 22, ww = widthAt(p.d) + 20 + (p.hgt - k * 22) * 0.05; const px = X(p.side * ww), py = Y(dd); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + p.side * (3 + R() * 4), py - 2 - R() * 3); ctx.stroke(); } }
    }
    // вісь з куполом
    axisPath(0, dMax);
    const ag = ctx.createLinearGradient(X(-widthAt(dMax)), 0, X(widthAt(dMax)), 0);
    ag.addColorStop(0, 'rgb(118,160,82)'); ag.addColorStop(0.35, 'rgb(214,234,176)'); ag.addColorStop(0.7, 'rgb(170,206,128)'); ag.addColorStop(1, 'rgb(96,140,66)');
    ctx.fillStyle = ag; ctx.fill();
    const vg = ctx.createLinearGradient(0, Y(0), 0, Y(dMax)); vg.addColorStop(0, 'rgba(255,255,235,.45)'); vg.addColorStop(0.3, 'rgba(255,255,235,0)'); vg.addColorStop(1, 'rgba(40,80,30,.25)');
    ctx.fillStyle = vg; ctx.fill();
    // прокамбій — тяжі, що не доходять до купола (≈ 230 мкм)
    ctx.save(); axisPath(0, dMax); ctx.clip();
    for (const sx of [-0.45, 0.45]) { ctx.strokeStyle = 'rgba(90,140,60,.55)'; ctx.lineWidth = Math.max(1, 14 * s); ctx.beginPath(); ctx.moveTo(X(sx * widthAt(dMax)), Y(dMax)); ctx.quadraticCurveTo(X(sx * 60), Y(400), X(sx * 30), Y(230)); ctx.stroke(); }
    // клітинна текстура купола (тунiка)
    ctx.strokeStyle = 'rgba(255,255,240,.22)'; ctx.lineWidth = 0.6;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const d = k * 9 + (i / 24) * 0; const t = -1 + 2 * i / 24; const wx = t * (dome - k * 6); const dd = dome - Math.sqrt(Math.max(0, (dome - k * 6) ** 2 - wx * wx)) + k * 6; i ? ctx.lineTo(X(wx), Y(dd)) : ctx.moveTo(X(wx), Y(dd)); } ctx.stroke(); }
    if (showVirus) { // частка інфікованих клітин зростає з глибиною: 1 − exp(−(d/λ)²)
      const vgr = ctx.createLinearGradient(0, Y(0), 0, Y(Math.min(dMax, lam * 3)));
      const n = 8;
      for (let i = 0; i <= n; i++) { const d = lam * 3 * i / n, p = 1 - Math.exp(-Math.pow(d / lam, 2)); vgr.addColorStop(i / n, `rgba(214,48,40,${0.36 * p})`); }
      ctx.fillStyle = vgr; ctx.fillRect(cx - r, Y(0), 2 * r, (dMax) * s + 2);
      ctx.fillStyle = 'rgba(160,20,20,.7)';
      const R2 = rng(11);
      for (let i = 0; i < 160; i++) { const d = R2() * Math.min(dMax, 900), p = 1 - Math.exp(-Math.pow(d / lam, 2)); if (R2() > p) continue; const wv = widthAt(d) * (R2() * 2 - 1) * 0.9; ctx.beginPath(); ctx.arc(X(wv), Y(d), 1.1, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    // примордії перед віссю (наймолодші двоє обіймають купол)
    for (const p of PRIM.slice(0, 2)) {
      if (p.d > dMax + 1) continue;
      primPath(p); const c = tissue(p.d);
      const g = ctx.createRadialGradient(X(p.side * widthAt(p.d) * 0.8), Y(p.d - p.hgt * 0.6), 1, X(p.side * widthAt(p.d)), Y(p.d - p.hgt * 0.3), p.hgt * s);
      g.addColorStop(0, rgba(shade(c, 0.25))); g.addColorStop(1, rgba(shade(c, -0.2)));
      ctx.fillStyle = g; ctx.globalAlpha = 0.72; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba(shade(c, -0.45), 0.55); ctx.lineWidth = 0.7; ctx.stroke();
    }
    // волога: відблиск на куполі
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(X(-dome * 0.35), Y(dome * 0.32), Math.max(1.5, dome * 0.25 * s), Math.max(1, dome * 0.1 * s), -0.5, 0, TAU); ctx.fill();
    ctx.restore();
  };
  const dBottom = (cy + r - topY) / s + 20;
  if (cut <= 0 || lift <= 0) {
    drawPart(dBottom, 0);
  } else {
    // нижня частина (залишок) і піднятий експлантат
    ctx.save(); ctx.beginPath(); ctx.rect(cx - r, Y(L), 2 * r, 2 * r); ctx.clip(); drawPart(dBottom, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(cx - r, topY - r, 2 * r, (L) * s + r); ctx.clip(); drawPart(L, -lift); ctx.restore();
  }
  // межа безвірусної зони
  if (showVirus && Y(lam) < cy + r) {
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,214,120,.95)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(X(-widthAt(lam) - 70), Y(lam)); ctx.lineTo(X(widthAt(lam) + 70), Y(lam)); ctx.stroke(); ctx.restore();
  }
  // лінія зрізу
  const yc = Y(L);
  ctx.save(); ctx.strokeStyle = cut > 0 ? 'rgba(255,255,255,.95)' : 'rgba(120,220,255,.95)'; ctx.lineWidth = 1.6;
  const half = (widthAt(L) + 40) * s;
  ctx.setLineDash(cut > 0 ? [] : [7, 4]);
  ctx.beginPath(); ctx.moveTo(cx - half, yc); ctx.lineTo(cx - half + 2 * half * (cut > 0 ? cut : 1), yc); ctx.stroke(); ctx.restore();
  return { yCut: yc, half, widthAt, X, Y };
}

/* ---------- Горщик, субстрат, ковпак ---------- */
const soilCache = new Map();
function soilTex(w, h) {
  const k = `${Math.round(w)}|${Math.round(h)}`;
  if (soilCache.has(k)) return soilCache.get(k);
  const c = offscreen(w, h), x = c.getContext('2d'), R = rng(21);
  x.fillStyle = '#3E2A1C'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < w * h * 0.05; i++) { const px = R() * w, py = R() * h, t = R(); x.fillStyle = t < 0.12 ? 'rgba(245,245,240,.95)' : t < 0.3 ? 'rgba(200,170,120,.7)' : t < 0.6 ? 'rgba(90,60,38,.9)' : 'rgba(30,20,12,.8)'; x.beginPath(); x.arc(px, py, t < 0.12 ? 0.9 + R() * 1.5 : 0.5 + R() * 1.3, 0, TAU); x.fill(); }
  if (soilCache.size > 20) soilCache.clear();
  soilCache.set(k, c); return c;
}
/** Торф'яний горщик із субстратом (торф : пісок : перліт 1 : 1 : 1). Повертає y поверхні. */
export function pot(ctx, cx, by, w, h) {
  const tw = w, bw = w * 0.78, top = by - h, rim = Math.max(5, h * 0.09);
  shadow(ctx, cx + w * 0.08, by + 2, w * 0.62, w * 0.1, 0.38);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx - tw / 2, top + rim); ctx.lineTo(cx - bw / 2, by); ctx.lineTo(cx + bw / 2, by); ctx.lineTo(cx + tw / 2, top + rim); ctx.closePath();
  const g = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  g.addColorStop(0, '#4E3A2A'); g.addColorStop(0.3, '#8A6A4C'); g.addColorStop(0.6, '#6C5038'); g.addColorStop(1, '#3B2B1F');
  ctx.fillStyle = g; ctx.fill();
  ctx.globalAlpha = 0.25; ctx.strokeStyle = '#2A1E14'; ctx.lineWidth = 0.6; // волокна торфу
  const R = rng(4); for (let i = 0; i < 40; i++) { const yy = top + rim + R() * (h - rim), xx = cx + (R() - 0.5) * lerp(tw, bw, (yy - top) / h) * 0.9; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + (R() - 0.5) * 8, yy + (R() - 0.5) * 3); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // обідок
  const rg = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  rg.addColorStop(0, '#5A4430'); rg.addColorStop(0.35, '#A07E5C'); rg.addColorStop(1, '#4A3626');
  ctx.fillStyle = rg; roundRect(ctx, cx - tw / 2 - 2, top, tw + 4, rim + 2, 3); ctx.fill();
  // субстрат
  ctx.beginPath(); ctx.ellipse(cx, top + 2, tw / 2 - 2, rim * 0.7, 0, 0, TAU); ctx.save(); ctx.clip();
  ctx.drawImage(soilTex(tw, rim * 2), cx - tw / 2, top + 2 - rim * 0.7, tw, rim * 1.4);
  ctx.restore();
  ctx.restore();
  return top + 2;
}
/** Скляний ковпак (банка догори дном): lift 0..1 — підпирання/зняття; fog 0..1 — конденсат. */
export function bellJar(ctx, cx, by, w, h, { lift = 0, fog = 0, seed = 2 } = {}) {
  const tilt = lift * 0.32, raise = lift * h * 0.12;
  ctx.save(); ctx.translate(cx + w / 2, by); ctx.rotate(tilt); ctx.translate(-(cx + w / 2), -by - raise);
  const x = cx - w / 2, top = by - h, r = w * 0.18;
  ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, top + r); ctx.quadraticCurveTo(x, top, x + r, top); ctx.lineTo(x + w - r, top); ctx.quadraticCurveTo(x + w, top, x + w, top + r); ctx.lineTo(x + w, by);
  ctx.fillStyle = `rgba(225,240,236,${0.1 + 0.25 * fog})`; ctx.fill();
  ctx.save(); ctx.clip();
  if (fog > 0.02) { // крапельки конденсату
    const R = rng(seed);
    for (let i = 0; i < 260 * fog; i++) { const px = x + R() * w, py = top + R() * h, rr = 0.6 + R() * 1.8; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(80,110,100,.25)'; ctx.beginPath(); ctx.arc(px + rr * 0.3, py + rr * 0.35, rr * 0.5, 0, TAU); ctx.fill(); }
  }
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(40,70,60,.28)'); g.addColorStop(0.12, 'rgba(255,255,255,.55)'); g.addColorStop(0.2, 'rgba(255,255,255,.06)'); g.addColorStop(0.82, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(40,70,60,.3)');
  ctx.fillStyle = g; ctx.fillRect(x, top, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,100,90,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, by, w / 2, 3, 0, 0, TAU); ctx.strokeStyle = 'rgba(70,100,90,.35)'; ctx.stroke();
  ctx.restore();
}
/** Цифровий термогігрометр. */
export function hygro(ctx, x, y, w, lines) {
  const h = 16 + lines.length * 17;
  shadow(ctx, x + w / 2 + 3, y + h + 2, w * 0.5, 5, 0.3);
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#F4F6F5'); g.addColorStop(1, '#CDD5D1');
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = 'rgba(60,80,70,.4)'; ctx.stroke();
  ctx.fillStyle = '#9FB5A3'; roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 4); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + 6, y + 6, w - 12, 3);
  lines.forEach((s, i) => text(ctx, s, x + 12, y + 22 + i * 17, { size: 12.5, weight: 700, color: '#15261B' }));
  ctx.restore();
}
/** Продих (вигляд зверху) у колі: aperture 0..1, wax 0..1. */
export function stomaView(ctx, cx, cy, r, { aperture = 0.8, wax = 0.2 } = {}) {
  // клітини епідермісу
  const R = rng(3);
  ctx.fillStyle = '#E8EFD8'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.strokeStyle = 'rgba(110,130,90,.55)'; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + R() * 0.3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42); for (let k = 1; k <= 4; k++) ctx.lineTo(cx + Math.cos(a + (R() - 0.5) * 0.4) * r * (0.42 + k * 0.17), cy + Math.sin(a + (R() - 0.5) * 0.4) * r * (0.42 + k * 0.17)); ctx.stroke(); }
  // замикаючі клітини
  const gw = r * 0.2, gl = r * 0.36, ap = clamp(aperture, 0.03, 1) * r * 0.1;
  for (const sd of [-1, 1]) {
    const gx = cx + sd * (gw * 0.55 + ap * 0.6);
    const g = ctx.createRadialGradient(gx - gw * 0.2, cy - gl * 0.3, 1, gx, cy, gl);
    g.addColorStop(0, '#CFEA9A'); g.addColorStop(1, '#5E9A3A');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(gx, cy, gw * 0.62, gl, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(50,90,30,.6)'; ctx.stroke();
    ctx.fillStyle = '#2F7A2A'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(gx + (R() - 0.5) * gw * 0.5, cy + (R() - 0.5) * gl * 1.2, 1.8, 1.2, R() * 3, 0, TAU); ctx.fill(); }
  }
  ctx.fillStyle = '#2A3326'; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.6, ap), gl * 0.62, 0, 0, TAU); ctx.fill();
  // кутикулярний віск (світлий наліт)
  if (wax > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * wax})`; for (let i = 0; i < 90 * wax; i++) { ctx.beginPath(); ctx.arc(cx + (R() - 0.5) * 2 * r, cy + (R() - 0.5) * 2 * r, 0.7 + R() * 1.4, 0, TAU); ctx.fill(); } }
}

/* ---------- Міліметровий папір і лінійка ---------- */
const paperCache = new Map();
export function graphPaper(ctx, x, y, w, h, pxmm) {
  const k = `${Math.round(w)}|${Math.round(h)}|${pxmm.toFixed(2)}`;
  let c = paperCache.get(k);
  if (!c) {
    c = offscreen(w, h); const g = c.getContext('2d');
    g.fillStyle = '#FBFAF3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i * pxmm < w; i++) { g.strokeStyle = i % 10 === 0 ? 'rgba(222,120,80,.55)' : i % 5 === 0 ? 'rgba(222,120,80,.3)' : 'rgba(222,120,80,.14)'; g.lineWidth = i % 10 === 0 ? 1 : 0.6; g.beginPath(); g.moveTo(i * pxmm + 0.5, 0); g.lineTo(i * pxmm + 0.5, h); g.stroke(); }
    for (let j = 0; j * pxmm < h; j++) { g.strokeStyle = j % 10 === 0 ? 'rgba(222,120,80,.55)' : j % 5 === 0 ? 'rgba(222,120,80,.3)' : 'rgba(222,120,80,.14)'; g.lineWidth = j % 10 === 0 ? 1 : 0.6; g.beginPath(); g.moveTo(0, j * pxmm + 0.5); g.lineTo(w, j * pxmm + 0.5); g.stroke(); }
    if (paperCache.size > 12) paperCache.clear();
    paperCache.set(k, c);
  }
  shadow(ctx, x + w / 2 + 6, y + h + 4, w * 0.52, 10, 0.25);
  ctx.drawImage(c, x, y, w, h);
}
export function ruler(ctx, x, y, mm, pxmm) {
  const w = mm * pxmm + 16, h = 22;
  shadow(ctx, x + w / 2 + 4, y + h + 2, w * 0.5, 4, 0.3);
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(250,252,255,.92)'); g.addColorStop(1, 'rgba(205,220,228,.92)');
  ctx.fillStyle = g; roundRect(ctx, x - 8, y, w, h, 3); ctx.fill(); ctx.strokeStyle = 'rgba(60,80,90,.45)'; ctx.stroke();
  ctx.strokeStyle = '#22313A'; ctx.lineWidth = 0.8; ctx.font = `600 9px ${FONT}`; ctx.fillStyle = '#22313A'; ctx.textAlign = 'center';
  for (let i = 0; i <= mm; i++) { const px = x + i * pxmm + 0.5, l = i % 10 === 0 ? 9 : i % 5 === 0 ? 6 : 3.5; if (pxmm < 2.2 && i % 5) continue; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + l); ctx.stroke(); if (i % 10 === 0) ctx.fillText(String(i / 10), px, y + 19); }
  ctx.restore();
}

/* ---------- Термокамера ---------- */
export function thermoCabinet(ctx, x, y, w, h, { T = 37, on = true, day = 0, trays = 2 } = {}) {
  shadow(ctx, x + w / 2 + 6, y + h + 3, w * 0.58, 8, 0.32);
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#C9D0D3'); g.addColorStop(0.3, '#F2F5F6'); g.addColorStop(1, '#AEB7BB');
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 6); ctx.fill(); ctx.strokeStyle = 'rgba(60,70,75,.4)'; ctx.stroke();
  // скляні дверцята
  const ix = x + w * 0.08, iy = y + h * 0.2, iw = w * 0.84, ih = h * 0.72;
  const ig = ctx.createLinearGradient(0, iy, 0, iy + ih); ig.addColorStop(0, on ? '#FFF3D9' : '#E8EEF0'); ig.addColorStop(1, on ? '#F2D9A8' : '#C9D3D6');
  ctx.fillStyle = ig; roundRect(ctx, ix, iy, iw, ih, 4); ctx.fill();
  for (let t = 0; t < trays; t++) { // кювети з піском і паростками
    const ty = iy + ih * (0.45 + t * 0.45) - 4;
    ctx.fillStyle = '#D8C49A'; ctx.fillRect(ix + 4, ty, iw - 8, 5); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(ix + 4, ty + 5, iw - 8, 1.5);
    const R = rng(7 + t); for (let k = 0; k < 6; k++) { const sx = ix + 8 + k * (iw - 16) / 5, sh = 4 + R() * 6 + day * 0.15; ctx.strokeStyle = '#B9C98A'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx, ty); ctx.quadraticCurveTo(sx + 2, ty - sh * 0.6, sx + 1, ty - sh); ctx.stroke(); ctx.fillStyle = '#E4D8B0'; ctx.beginPath(); ctx.ellipse(sx, ty + 1, 3, 2, 0, 0, TAU); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(ix, iy + ih); ctx.lineTo(ix + iw * 0.3, iy); ctx.lineTo(ix + iw * 0.45, iy); ctx.lineTo(ix + iw * 0.15, iy + ih); ctx.fill();
  // дисплей
  ctx.fillStyle = '#18241D'; roundRect(ctx, x + w * 0.5, y + h * 0.05, w * 0.42, h * 0.11, 3); ctx.fill();
  text(ctx, `${Math.round(T)}°C`, x + w * 0.71, y + h * 0.05 + h * 0.085, { size: Math.max(9, h * 0.075), weight: 800, color: on ? '#FF9F43' : '#6C8D78', align: 'center' });
  ctx.fillStyle = on ? '#FF6B3D' : '#4E6355'; ctx.beginPath(); ctx.arc(x + w * 0.16, y + h * 0.105, 3, 0, TAU); ctx.fill();
  ctx.restore();
}
export { tagSmall };
