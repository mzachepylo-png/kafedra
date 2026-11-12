// Тема 7 — власні 2.5D-об'єкти: протопласти (мезофільні, калюсні, гетерокаріони), епідерміс із плазмолізом,
// штатив пробірок із сахарозою, мезофіл під дією ферментів, конічна центрифужна пробірка, міні-центрифуга.
import { TAU, clamp, lerp, smooth, rng, noise, hex, rgba, mix, shade, roundRect, shadow, tube, tagSmall } from './kit.js';

/* ================= Протопласт ================= */
/**
 * type: 'meso' — зелений протопласт мезофілу (хлоропласти по периферії, вакуоля в центрі);
 * 'callus' — безбарвний вакуолізований; 'hetero' — гетерокаріон (половина з хлоропластами, два ядра);
 * wall 0…1 — регенерована стінка; burst 0…1 — руйнування; squash — сплющення (у осаді).
 */
export function proto(ctx, x, y, r, { type = 'meso', seed = 1, burst = 0, wall = 0, alpha = 1, oval = 0, rot = 0, light = 1 } = {}) {
  const R = rng(seed);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
  const sx = 1 + oval * 0.18, sy = 1 - oval * 0.12;
  if (burst > 0.6) {
    // розірвана мембрана: уривки й розсип хлоропластів
    ctx.strokeStyle = 'rgba(110,120,80,.45)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) { const a = R() * TAU; ctx.beginPath(); ctx.arc(R() * r * 0.3, R() * r * 0.3, r * (0.7 + R() * 0.5), a, a + 0.6 + R()); ctx.stroke(); }
    if (type !== 'callus') for (let i = 0; i < r * 1.1; i++) { const a = R() * TAU, d = r * (0.3 + R() * (0.8 + burst)); chl(ctx, Math.cos(a) * d, Math.sin(a) * d, Math.max(1, r * 0.1), a, 0.75); }
    else { ctx.fillStyle = 'rgba(150,140,100,.35)'; for (let i = 0; i < r; i++) { const a = R() * TAU, d = r * R() * 1.4; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 0.6 + R(), 0, TAU); ctx.fill(); } }
    ctx.restore(); return;
  }
  ctx.scale(sx, sy);
  // ореол (світле поле: край заломлює світло)
  ctx.fillStyle = 'rgba(255,255,248,.35)'; ctx.beginPath(); ctx.arc(0, 0, r + 1.6, 0, TAU); ctx.fill();
  const base = type === 'callus' ? [236, 232, 214] : [205, 222, 180];
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, rgba(shade(base, 0.5), 0.75)); g.addColorStop(0.75, rgba(base, 0.6)); g.addColorStop(1, rgba(shade(base, -0.3), 0.8));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // цитоплазма й хлоропласти
  const nCh = type === 'callus' ? 0 : Math.round(r * (type === 'hetero' ? 0.9 : 1.6));
  const chR = Math.max(1, r * 0.105);
  for (let i = 0; i < nCh; i++) {
    let a = R() * TAU;
    if (type === 'hetero') a = Math.PI * 0.55 + R() * Math.PI * 0.95;
    const d = r * (0.5 + 0.42 * Math.sqrt(R()));
    const k = 1 - (d / r) * 0.35;
    chl(ctx, Math.cos(a) * d, Math.sin(a) * d, chR * k, a + Math.PI / 2, light);
  }
  if (type !== 'meso') { // зерниста пристінна цитоплазма і тяжі
    ctx.strokeStyle = 'rgba(170,160,120,.45)'; ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, type === 'hetero' ? -Math.PI * 0.5 : 0, type === 'hetero' ? Math.PI * 0.55 : TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(130,120,85,.5)';
    for (let i = 0; i < r * 0.8; i++) { const a = type === 'hetero' ? -Math.PI * 0.5 + R() * Math.PI * 1.05 : R() * TAU, d = r * (0.72 + R() * 0.22); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 0.5 + R() * 0.7, 0, TAU); ctx.fill(); }
  }
  // ядро(а)
  const nuc = (nx, ny, c) => { const nr = r * 0.2; const ng = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.3, 0.3, nx, ny, nr); ng.addColorStop(0, rgba(shade(c, 0.4), 0.9)); ng.addColorStop(1, rgba(shade(c, -0.25), 0.9)); ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(80,70,50,.6)'; ctx.beginPath(); ctx.arc(nx + nr * 0.2, ny - nr * 0.1, nr * 0.3, 0, TAU); ctx.fill(); };
  if (type === 'callus') nuc(r * 0.35, -r * 0.2, [175, 165, 130]);
  if (type === 'hetero') { nuc(-r * 0.3, r * 0.1, [150, 165, 120]); nuc(r * 0.38, -r * 0.15, [175, 165, 130]); }
  // мембрана й відблиск
  ctx.strokeStyle = 'rgba(70,82,52,.6)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, 0, r - 1.3, Math.PI * 1.08, Math.PI * 1.5); ctx.stroke();
  // нова клітинна стінка
  if (wall > 0.02) {
    ctx.strokeStyle = `rgba(120,108,66,${0.75 * wall})`; ctx.lineWidth = 0.8 + wall * 1.4; ctx.beginPath(); ctx.arc(0, 0, r + 1.8, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,240,${0.6 * wall})`; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(0, 0, r + 3, Math.PI * 0.9, Math.PI * 1.7); ctx.stroke();
  }
  ctx.restore();
}
/** Хлоропласт: лінзоподібний, з гранами. */
export function chl(ctx, x, y, s, a, light = 1) {
  const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, 0.2, x, y, s * 1.2);
  g.addColorStop(0, rgba(shade([110, 175, 70], 0.25 * light))); g.addColorStop(1, '#2C6B23');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, s * 1.25, s * 0.78, a, 0, TAU); ctx.fill();
  if (s > 2.2) { ctx.fillStyle = 'rgba(20,60,15,.5)'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(a) * i * s * 0.5, y + Math.sin(a) * i * s * 0.5, s * 0.18, 0, TAU); ctx.fill(); } }
}

/* ================= Епідерміс із плазмолізом ================= */
/** Генерує сітку клітин епідермісу (цегляна кладка). Повертає масив прямокутників. */
export function epiCells(w, h, cw, aspect, seed = 1) {
  const R = rng(seed), out = [];
  const L = cw * aspect, rh = cw;
  for (let j = -1, row = 0; j * rh < h + rh; j++, row++) {
    let x = -L * (row % 2 ? 0.5 : 0.15) - R() * L * 0.3;
    while (x < w + L) { const len = L * (0.75 + R() * 0.5); out.push({ x, y: j * rh, w: len, h: rh, seed: (R() * 1e6) | 0, j: R() }); x += len; }
  }
  return out;
}
/** Протопласт у клітині: форма залежить від стадії плазмолізу. */
export function epiCell(ctx, c, { V = 1, form = 'none', hue = [150, 38, 120], cut = false, wallW = 2.4 } = {}) {
  const { x, y, w, h } = c, R = rng(c.seed);
  const pad = wallW;
  // стінка (целюлоза) — світла, з подвійним контуром
  ctx.fillStyle = 'rgba(246,242,232,.9)'; ctx.fillRect(x, y, w, h);
  const deg = 1 - V;
  // плазмоліз: протопласт скорочується переважно вздовж довгої осі
  const iw = w - 2 * pad, ih = h - 2 * pad;
  const kx = form === 'none' ? 1 : clamp(1 - deg * 1.25, 0.25, 1), ky = form === 'none' ? 1 : clamp(V / kx, 0.3, 1);
  const pw = iw * kx, ph = ih * ky, px = x + pad + (iw - pw) * (0.5 + (c.j - 0.5) * 0.5), py = y + pad + (ih - ph) / 2;
  const col = shade(hue, form === 'none' ? 0.15 : 0.15 - deg * 0.9);
  const alpha = 0.55 + deg * 0.6;
  if (!cut) {
    ctx.save();
    ctx.beginPath();
    if (form === 'none' || form === 'incipient') {
      const rr = form === 'none' ? 1.5 : Math.min(pw, ph) * 0.32;
      roundRect(ctx, px, py, pw, ph, rr);
    } else if (form === 'concave') {
      const b = Math.min(pw, ph) * 0.16 * (0.6 + R() * 0.8);
      ctx.moveTo(px + 2, py + 2);
      ctx.quadraticCurveTo(px + pw / 2, py + b, px + pw - 2, py + 2);
      ctx.quadraticCurveTo(px + pw - b * 1.2, py + ph / 2, px + pw - 2, py + ph - 2);
      ctx.quadraticCurveTo(px + pw / 2, py + ph - b, px + 2, py + ph - 2);
      ctx.quadraticCurveTo(px + b * 1.2, py + ph / 2, px + 2, py + 2);
    } else roundRect(ctx, px, py, pw, ph, Math.min(pw, ph) / 2);
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, rgba(shade(col, 0.25), alpha)); g.addColorStop(0.5, rgba(col, alpha)); g.addColorStop(1, rgba(shade(col, -0.2), alpha));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rgba(shade(col, -0.45), 0.55); ctx.lineWidth = 0.8; ctx.stroke();
    // ядро
    ctx.fillStyle = 'rgba(240,230,235,.55)'; ctx.beginPath(); ctx.ellipse(px + pw * (0.3 + c.j * 0.4), py + ph * 0.5, Math.min(ph * 0.22, 5), Math.min(ph * 0.18, 4), 0, 0, TAU); ctx.fill();
    // тяжі Гехта (між протопластом і стінкою) при плазмолізі
    if (form === 'concave' || form === 'convex') {
      ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = 0.6;
      for (const [ax, ay, bx, by] of [[px, py + ph / 2, x + pad, py + ph / 2 + (R() - 0.5) * 6], [px + pw, py + ph / 2, x + w - pad, py + ph / 2 + (R() - 0.5) * 6]]) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
    }
    ctx.restore();
  }
  // межі клітин
  ctx.strokeStyle = 'rgba(120,112,92,.75)'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2);
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.6; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  return { px, py, pw, ph };
}

/* ================= Штатив пробірок ================= */
export function tubeRack(ctx, x, y, w, h, { conc = [], sel = 0, hue = [150, 38, 120], deg = [] } = {}) {
  const n = conc.length, tw = Math.min(w / n * 0.42, 26), th = h * 0.78;
  const hits = [];
  // задня планка штатива
  shadow(ctx, x + w / 2, y + h + 3, w * 0.55, 8, 0.3);
  const wood = (yy, hh) => { const g = ctx.createLinearGradient(0, yy, 0, yy + hh); g.addColorStop(0, '#E9EEF0'); g.addColorStop(1, '#AEB8BC'); ctx.fillStyle = g; roundRect(ctx, x, yy, w, hh, 4); ctx.fill(); };
  wood(y + h * 0.3, h * 0.08);
  for (let i = 0; i < n; i++) {
    const cx = x + w * (i + 0.5) / n, tx = cx - tw / 2, ty = y + h - th - 6;
    if (i === sel) { const gg = ctx.createRadialGradient(cx, ty + th * 0.6, 2, cx, ty + th * 0.6, tw * 2.4); gg.addColorStop(0, 'rgba(255,214,110,.55)'); gg.addColorStop(1, 'rgba(255,214,110,0)'); ctx.fillStyle = gg; ctx.fillRect(cx - tw * 2.5, ty, tw * 5, th); }
    tube(ctx, tx, ty, tw, th, {
      medium: { level: 0.5, color: '#EEF3F2', gel: false, alpha: 0.5 }, plug: null,
      contents: (c, inn) => { // шматочок тканини
        const d = deg[i] || 0, col = shade(hue, 0.1 - d * 0.6);
        c.fillStyle = rgba(col, 0.85); c.save(); c.translate(inn.x + inn.w / 2, inn.surface + th * 0.2); c.rotate(-0.25 + i * 0.07);
        roundRect(c, -inn.w * 0.36, -th * 0.07, inn.w * 0.72, th * 0.14, 2); c.fill(); c.restore();
      },
    });
    ctx.save(); ctx.font = `${i === sel ? 800 : 600} ${tw > 20 ? 11 : 10}px system-ui, sans-serif`; ctx.textAlign = 'center';
    ctx.fillStyle = i === sel ? '#7A4E00' : '#2A3A30'; ctx.fillText(String(conc[i]).replace('.', ','), cx, y + h + 14); ctx.restore();
    hits.push({ x: cx - w / n / 2, y: ty, w: w / n, h: th + 24, i });
  }
  wood(y + h - 8, 8);
  ctx.save(); ctx.font = '600 10px system-ui, sans-serif'; ctx.fillStyle = '#46584C'; ctx.textAlign = 'right'; ctx.fillText('М сахарози', x + w, y + h + 27); ctx.restore();
  return hits;
}

/* ================= Мезофіл під дією ферментів ================= */
/** Генерує клітини мезофілу (округлі, з хлоропластами) на ділянці R. */
export function mesoCells(R0, seed = 2) {
  const R = rng(seed), cells = [];
  const r0 = R0 * 0.105;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const x = (i + (j % 2 ? 0.5 : 0)) * r0 * 1.9 + (R() - 0.5) * r0 * 0.3, y = j * r0 * 1.62 + (R() - 0.5) * r0 * 0.3;
    if (Math.hypot(x, y) > R0 * 1.05) continue;
    cells.push({ x, y, rx: r0 * (0.95 + R() * 0.2), ry: r0 * (0.82 + R() * 0.2), rot: R() * 0.6, thr: R(), die: R(), dx: (R() - 0.5), dy: (R() - 0.5), seed: (R() * 1e6) | 0 });
  }
  return cells;
}
/** W — залишок стінки 0…1, M — мацерація 0…1, v — частка живих серед вивільнених. */
export function mesoField(ctx, cx, cy, R0, cells, { W = 1, M = 0, v = 1, t = 0 } = {}) {
  const free = 1 - W;
  for (const c of cells) {
    const sep = M * R0 * 0.07;
    const x = cx + c.x + c.dx * sep * 2, y = cy + c.y + c.dy * sep * 2;
    const released = c.thr < free * 1.02 && M > 0.3;
    if (released) {
      const dead = c.die > v;
      const rr = Math.sqrt(c.rx * c.ry) * 0.92;
      proto(ctx, x + c.dx * R0 * 0.05, y + c.dy * R0 * 0.05, rr, { type: 'meso', seed: c.seed, burst: dead ? 0.9 : 0 });
    } else {
      // клітина зі стінкою: стінка тоншає з перетравленням, форма округлюється
      const k = clamp(free / Math.max(0.05, c.thr), 0, 1);
      const rx = lerp(c.rx, Math.sqrt(c.rx * c.ry), k), ry = lerp(c.ry, Math.sqrt(c.rx * c.ry), k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(c.rot);
      ctx.fillStyle = 'rgba(214,226,186,.7)'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 1 + 2.4 * W * (1 - k * 0.6); ctx.strokeStyle = `rgba(120,128,82,${0.35 + 0.5 * W})`; ctx.stroke();
      const R = rng(c.seed);
      for (let i = 0; i < 14; i++) { const a = R() * TAU, d = 0.62 + R() * 0.28; chl(ctx, Math.cos(a) * rx * d, Math.sin(a) * ry * d, Math.max(1.1, rx * 0.1), a + Math.PI / 2); }
      ctx.restore();
    }
  }
}

/* ================= Центрифужна пробірка (конічна, 15 мл) ================= */
/** Профіль: циліндр + конус. Повертає функцію mm→y та півширину на висоті. H — висота стовпа рідини, мм. */
export function cTube(ctx, cx, top, w, h, { level = 0.72, layers = null, parts = null, cap = '#2C6FB0', label = '' } = {}) {
  const coneH = h * 0.2, bodyB = top + h - coneH;
  const path = () => { ctx.beginPath(); ctx.moveTo(cx - w / 2, top); ctx.lineTo(cx - w / 2, bodyB); ctx.quadraticCurveTo(cx - w * 0.12, top + h - 2, cx, top + h); ctx.quadraticCurveTo(cx + w * 0.12, top + h - 2, cx + w / 2, bodyB); ctx.lineTo(cx + w / 2, top); };
  shadow(ctx, cx + w * 0.3, top + h + 4, w * 0.9, w * 0.14, 0.25);
  ctx.save(); path(); ctx.closePath(); ctx.fillStyle = 'rgba(230,240,238,.35)'; ctx.fill(); ctx.clip();
  const ly = top + h * (1 - level);
  const yAt = (mm, H) => lerp(top + h - 3, ly + 2, mm / H);
  if (layers) layers(ctx, { cx, w, ly, bottom: top + h, yAt });
  if (parts) parts(ctx, { cx, w, ly, bottom: top + h, yAt, half: (yy) => (yy < bodyB ? w / 2 : (w / 2) * Math.max(0.05, (top + h - yy) / coneH)) });
  // меніск
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - w / 2, ly - 2); ctx.quadraticCurveTo(cx, ly + 3, cx + w / 2, ly - 2); ctx.stroke();
  // скло (пластик)
  const gl = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  gl.addColorStop(0, 'rgba(40,70,60,.25)'); gl.addColorStop(0.15, 'rgba(255,255,255,.55)'); gl.addColorStop(0.25, 'rgba(255,255,255,.05)'); gl.addColorStop(0.82, 'rgba(255,255,255,.25)'); gl.addColorStop(1, 'rgba(40,70,60,.3)');
  ctx.fillStyle = gl; ctx.fillRect(cx - w / 2, top, w, h);
  ctx.restore();
  ctx.save(); path(); ctx.strokeStyle = 'rgba(70,100,90,.6)'; ctx.lineWidth = 1.1; ctx.stroke();
  // шкала
  ctx.strokeStyle = 'rgba(30,40,40,.45)'; ctx.fillStyle = 'rgba(30,40,40,.6)'; ctx.font = '600 9px system-ui, sans-serif'; ctx.textAlign = 'left';
  for (let i = 1; i <= 7; i++) { const yy = top + h - coneH - (bodyB - top) * (i - 1) / 7.5; ctx.beginPath(); ctx.moveTo(cx + w / 2 - w * 0.22, yy); ctx.lineTo(cx + w / 2, yy); ctx.stroke(); if (i % 2 && w > 50) ctx.fillText(String(i * 2 - 1), cx + w / 2 - w * 0.2, yy - 2); }
  ctx.restore();
  // кришка
  const cg = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); cg.addColorStop(0, shadeHex(cap, -0.4)); cg.addColorStop(0.3, shadeHex(cap, 0.3)); cg.addColorStop(1, shadeHex(cap, -0.45));
  ctx.fillStyle = cg; roundRect(ctx, cx - w / 2 - 3, top - w * 0.28, w + 6, w * 0.32, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 1; i < 9; i++) ctx.fillRect(cx - w / 2 - 3 + (w + 6) * i / 9, top - w * 0.26, 1, w * 0.28);
  if (label) tagSmall(ctx, cx, top + h + 18, label, { color: '#173322', bg: 'rgba(255,255,255,.85)' });
}
const shadeHex = (c, k) => rgba(shade(hex(c), k));

/* ================= Міні-центрифуга ================= */
export function miniCentrifuge(ctx, x, y, s, { angle = 0, spin = 0, rpm = 1000, timeTxt = '' } = {}) {
  const w = s, h = s * 0.42;
  shadow(ctx, x + w / 2, y + h + 4, w * 0.6, h * 0.18, 0.35);
  // корпус
  const bg = ctx.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, '#F3F5F4'); bg.addColorStop(1, '#AAB4B3');
  ctx.fillStyle = bg; roundRect(ctx, x, y + h * 0.25, w, h * 0.75, 10); ctx.fill();
  // кришка (прозора) — еліпс зверху з ротором
  const cx = x + w / 2, cy = y + h * 0.3, rx = w * 0.42, ry = h * 0.32;
  const lg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry); lg.addColorStop(0, '#5D6B6C'); lg.addColorStop(1, '#2C3536');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.92, ry * 0.88, 0, 0, TAU); ctx.clip();
  ctx.fillStyle = '#1A2122'; ctx.fillRect(cx - rx, cy - ry, 2 * rx, 2 * ry);
  // ротор з 4 стаканами
  for (let k = 0; k < 4; k++) {
    const a = angle + k * Math.PI / 2;
    const bx = cx + Math.cos(a) * rx * 0.6, by = cy + Math.sin(a) * ry * 0.6;
    ctx.fillStyle = 'rgba(200,208,210,.9)'; ctx.beginPath(); ctx.ellipse(bx, by, rx * 0.16, ry * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = k % 2 ? '#2C6FB0' : '#C9D3D5'; ctx.beginPath(); ctx.ellipse(bx, by, rx * 0.08, ry * 0.1, 0, 0, TAU); ctx.fill();
  }
  if (spin > 0) { ctx.fillStyle = `rgba(40,50,52,${0.65 * spin})`; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.92, ry * 0.88, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(200,210,212,${0.3 * spin})`; ctx.lineWidth = rx * 0.14; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.6, ry * 0.6, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#8E9A9C'; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.12, ry * 0.14, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.95, ry * 0.9, 0, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
  // дисплей
  const dx = x + w * 0.2, dy = y + h * 0.7, dw = w * 0.6, dh = h * 0.22;
  ctx.fillStyle = '#0B1E18'; roundRect(ctx, dx, dy, dw, dh, 4); ctx.fill();
  ctx.font = `700 ${Math.max(9, dh * 0.6)}px ui-monospace, Menlo, monospace`; ctx.fillStyle = '#7CF0B4'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(rpm)}`, dx + 5, dy + dh / 2 + 0.5);
  ctx.textAlign = 'right'; ctx.fillStyle = '#FFD27A'; ctx.fillText(timeTxt, dx + dw - 5, dy + dh / 2 + 0.5);
  ctx.textBaseline = 'alphabetic';
}

/* ================= Поле зору ================= */
export function bfBackground(ctx, cx, cy, r, seed = 3) {
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.05, cx, cy, r);
  g.addColorStop(0, '#FBFAF2'); g.addColorStop(0.7, '#EEEBD8'); g.addColorStop(1, '#D6D0B4');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  const R = rng(seed);
  for (let i = 0; i < 50; i++) { ctx.fillStyle = `rgba(120,115,80,${0.05 + R() * 0.12})`; ctx.beginPath(); ctx.arc(cx + (R() - 0.5) * 2 * r, cy + (R() - 0.5) * 2 * r, 0.4 + R() * 1.4, 0, TAU); ctx.fill(); }
}
export function ocular(ctx, cx, cy, r) {
  ctx.save();
  const v = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.86, 'rgba(90,70,30,.16)'); v.addColorStop(1, 'rgba(0,0,0,.7)');
  ctx.fillStyle = v; ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(80,140,255,.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r - 1.5, 0, TAU); ctx.stroke();
  const ring = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.09);
  ring.addColorStop(0, '#050807'); ring.addColorStop(0.5, '#1B2420'); ring.addColorStop(1, '#3A4540');
  ctx.strokeStyle = ring; ctx.lineWidth = r * 0.09; ctx.beginPath(); ctx.arc(cx, cy, r * 1.045, 0, TAU); ctx.stroke();
  ctx.restore();
}
export function scaleBar(ctx, x, y, px, text) {
  ctx.save(); ctx.font = '700 11px system-ui, sans-serif'; const m = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,.78)'; roundRect(ctx, x - 6, y - 17, Math.max(px, m) + 12, 25, 6); ctx.fill();
  ctx.fillStyle = '#1B2A20'; ctx.fillRect(x, y + 1, px, 3); ctx.textAlign = 'center'; ctx.fillText(text, x + Math.max(px, m) / 2, y - 4); ctx.restore();
}
export { smooth, noise, mix, hex };
