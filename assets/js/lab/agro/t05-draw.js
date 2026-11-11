// Тема 5 — власні 2.5D-об'єкти: орбітальний шейкер, колба з круговою хвилею рідини, клітини й агрегати
// суспензії у світлому полі, лічильна камера Фукса — Розенталя, мікроскоп, піпетка.
import { TAU, clamp, lerp, smooth, rng, noise, hex, rgba, mix, shade, offscreen, roundRect, shadow } from './kit.js';

/* ================= Колба Ерленмеєра з орбітальним рухом рідини ================= */
/** Півширина колби на висоті y над дном (0…s). Конус + плечі + шийка. */
function halfAt(s, y) {
  const bw = s * 0.46, nw = s * 0.13, sh = s * 0.64;
  if (y >= sh) return nw;
  const k = y / sh;
  const cone = lerp(bw, nw, k);
  const round = 1 - smooth(0, 0.08, k) * 0;            // дно
  const sho = smooth(0.78, 1, k);                       // м'яке плече
  const fil = y < s * 0.035 ? bw - (s * 0.035 - y) * 0.9 : cone; // заокруглення біля дна
  return lerp(fil, nw * 1.05, sho * 0.55) * round;
}
function flaskPath(ctx, cx, by, s) {
  const N = 40;
  ctx.beginPath();
  ctx.moveTo(cx - halfAt(s, s), by - s);
  for (let i = N; i >= 0; i--) { const y = s * i / N; ctx.lineTo(cx - halfAt(s, y), by - y); }
  for (let i = 0; i <= N; i++) { const y = s * i / N; ctx.lineTo(cx + halfAt(s, y), by - y); }
  ctx.closePath();
}

const spriteCache = new Map();
/** Кешований спрайт агрегату (n клітин) для дрібного масштабу (колба). */
function aggSprite(n, px, tint, seed) {
  const key = `${n}|${px}|${tint}|${seed}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const R = rng(seed), pts = [[0, 0]];
  for (let i = 1; i < n; i++) { const b = pts[(R() * pts.length) | 0], a = R() * TAU; pts.push([b[0] + Math.cos(a) * px * 1.5, b[1] + Math.sin(a) * px * 1.5]); }
  let mx = 0; for (const p of pts) mx = Math.max(mx, Math.abs(p[0]), Math.abs(p[1]));
  const S = Math.ceil((mx + px * 1.6) * 2 + 2), c = offscreen(S, S), x = c.getContext('2d'), o = S / 2;
  const base = hex(tint);
  for (const [X, Y] of pts) {
    const g = x.createRadialGradient(o + X - px * 0.35, o + Y - px * 0.4, px * 0.1, o + X, o + Y, px);
    g.addColorStop(0, rgba(shade(base, 0.5), 0.95)); g.addColorStop(0.6, rgba(base, 0.9)); g.addColorStop(1, rgba(shade(base, -0.35), 0.95));
    x.fillStyle = g; x.beginPath(); x.arc(o + X, o + Y, px, 0, TAU); x.fill();
  }
  const out = { c, o };
  spriteCache.set(key, out);
  return out;
}

/**
 * Колба з суспензією на шейкері. phase — фаза орбіти (рад), amp — амплітуда хвилі (0…1),
 * dens — «каламутність» 0…1, parts — [{u, v, th, n, seed}] частинки (агрегати), tint — колір клітин.
 */
export function suspFlask(ctx, cx, by, s, { phase = 0, amp = 0.5, level = 0.36, dens = 0.3, parts = [], tint = '#EFE3BF', settle = 0, brown = 0, label = '' } = {}) {
  shadow(ctx, cx + s * 0.06, by + 1, s * 0.5, s * 0.07, 0.32);
  const liqH = s * level;
  // форма поверхні: нахилена хвиля, що біжить по колу
  const tilt = amp * s * 0.085 * Math.cos(phase), depthK = Math.sin(phase);
  const yS = by - liqH;
  const hw = halfAt(s, liqH);
  ctx.save(); flaskPath(ctx, cx, by, s); ctx.fillStyle = 'rgba(226,240,236,.22)'; ctx.fill(); ctx.clip();
  // тіло рідини
  const med = mix(hex('#F1EBCF'), hex('#B98E4E'), brown * 0.6);
  const lg = ctx.createLinearGradient(cx - s * 0.5, 0, cx + s * 0.5, 0);
  lg.addColorStop(0, rgba(shade(med, -0.25), 0.78)); lg.addColorStop(0.3, rgba(shade(med, 0.18), 0.62));
  lg.addColorStop(0.65, rgba(med, 0.6)); lg.addColorStop(1, rgba(shade(med, -0.3), 0.8));
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(cx - s, yS + tilt * 1.2); ctx.lineTo(cx + s, yS - tilt * 1.2); ctx.lineTo(cx + s, by + 4); ctx.lineTo(cx - s, by + 4); ctx.closePath(); ctx.fill();
  // каламуть суспензії (молочна)
  if (dens > 0) {
    const cg = ctx.createLinearGradient(0, yS, 0, by);
    const tc = mix(hex(tint), [255, 255, 250], 0.35);
    cg.addColorStop(0, rgba(tc, 0.18 * dens + 0.06 * settle)); cg.addColorStop(1, rgba(shade(tc, -0.1), 0.45 * dens + 0.4 * settle * dens));
    ctx.fillStyle = cg; ctx.fill();
  }
  // частинки: агрегати, що кружляють разом із рідиною
  const span = liqH * 0.92;
  for (const p of parts) {
    const th = p.th + phase * (0.9 + p.u * 0.2);
    const depth = Math.sin(th);                              // −1 зад … +1 перед
    let yy = by - 3 - (p.v * (1 - settle) + settle * p.v * 0.08) * span;
    const w = halfAt(s, by - yy) * 0.86;
    const xx = cx + Math.cos(th) * p.u * w;
    yy += -tilt * 1.2 * (xx - cx) / (hw || 1) * (1 - p.v * 0.5) * (by - yy) / Math.max(1, liqH);
    if (yy < yS - tilt * (xx - cx) / hw * 1.2 + 3) continue;
    const spr = aggSprite(p.n, p.px, tint, p.seed);
    const k = 0.75 + depth * 0.25;
    ctx.globalAlpha = 0.55 + 0.45 * (depth * 0.5 + 0.5);
    ctx.drawImage(spr.c, xx - spr.o * k, yy - spr.o * k, spr.c.width * k, spr.c.height * k);
  }
  ctx.globalAlpha = 1;
  // поверхня: еліпс дзеркала рідини
  const xl = cx - hw, xr = cx + hw, yl = yS + tilt * 1.2 * (hw / s) * 2 * 0 + tilt, yr = yS - tilt;
  const ang = Math.atan2(yr - yl, xr - xl), ry = Math.max(2, hw * (0.16 + 0.05 * depthK));
  ctx.save(); ctx.translate((xl + xr) / 2, (yl + yr) / 2); ctx.rotate(ang);
  const sg = ctx.createLinearGradient(-hw, -ry, hw, ry);
  sg.addColorStop(0, rgba(shade(med, 0.45), 0.85)); sg.addColorStop(0.5, rgba(shade(med, 0.2), 0.7)); sg.addColorStop(1, rgba(shade(med, -0.05), 0.75));
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 0, hw, ry, 0, 0, TAU); ctx.fill();
  if (dens > 0) { ctx.fillStyle = rgba(mix(hex(tint), [255, 255, 255], 0.3), 0.25 * dens); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, hw - 1, ry - 0.5, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(0, 0, hw - 1, ry - 0.5, 0, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
  // піна/бульбашки на гребені хвилі
  if (amp > 0.35) {
    const R = rng(11); ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 9 * amp; i++) { const a = Math.PI * (0.1 + R() * 0.8) + (Math.cos(phase) > 0 ? Math.PI : 0); ctx.beginPath(); ctx.arc(Math.cos(a) * hw * 0.9, Math.sin(a) * ry * 0.8, 0.7 + R() * 1.2, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  // відблиски скла
  const gl = ctx.createLinearGradient(cx - s * 0.46, 0, cx + s * 0.46, 0);
  gl.addColorStop(0, 'rgba(30,60,50,.32)'); gl.addColorStop(0.08, 'rgba(255,255,255,.04)'); gl.addColorStop(0.17, 'rgba(255,255,255,.62)');
  gl.addColorStop(0.24, 'rgba(255,255,255,.06)'); gl.addColorStop(0.72, 'rgba(255,255,255,0)'); gl.addColorStop(0.85, 'rgba(255,255,255,.28)');
  gl.addColorStop(0.9, 'rgba(255,255,255,.03)'); gl.addColorStop(1, 'rgba(30,60,50,.36)');
  ctx.fillStyle = gl; ctx.fillRect(cx - s * 0.5, by - s, s, s);
  ctx.restore();
  // контур
  ctx.save(); flaskPath(ctx, cx, by, s); ctx.strokeStyle = 'rgba(60,92,82,.6)'; ctx.lineWidth = 1.1; ctx.stroke();
  // товсте дно
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(cx, by - 1.5, halfAt(s, 2) - 2, s * 0.025, 0, 0, Math.PI); ctx.stroke();
  // шкала
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.9;
  for (let i = 1; i <= 3; i++) { const yy = by - s * 0.14 * i, hw2 = halfAt(s, s * 0.14 * i); ctx.beginPath(); ctx.moveTo(cx - hw2 * 0.55, yy); ctx.lineTo(cx - hw2 * 0.2, yy); ctx.stroke(); }
  ctx.restore();
  foilCap(ctx, cx, by - s, halfAt(s, s) * 2);
  if (label) { ctx.save(); ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#F2F7F3'; ctx.fillText(label, cx, by + 15); ctx.restore(); }
}

export function foilCap(ctx, cx, y, w) {
  ctx.save();
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, '#7E878B'); g.addColorStop(0.18, '#F4F6F7'); g.addColorStop(0.4, '#AEB6BA'); g.addColorStop(0.66, '#E6EAEC'); g.addColorStop(1, '#6E777B');
  ctx.fillStyle = g;
  const hgt = w * 0.95;
  ctx.beginPath(); ctx.moveTo(cx - w / 2 - 3, y + hgt);
  for (let i = 0; i <= 10; i++) ctx.lineTo(cx - w / 2 - 3 + (w + 6) * i / 10, y + hgt + (i % 2 ? 3 : -1.5));
  ctx.lineTo(cx + w / 2 + 2, y - w * 0.08); ctx.quadraticCurveTo(cx, y - w * 0.4, cx - w / 2 - 2, y - w * 0.08); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.22, y - w * 0.12); ctx.lineTo(cx - w * 0.12, y + hgt * 0.85); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,70,75,.35)'; ctx.beginPath(); ctx.moveTo(cx + w * 0.15, y - w * 0.1); ctx.lineTo(cx + w * 0.25, y + hgt * 0.8); ctx.stroke();
  ctx.restore();
}

/* ================= Орбітальний шейкер ================= */
/** Малює корпус і повертає геометрію платформи {x0, x1, yFront, yBack} (без зсуву). */
export function shakerBody(ctx, x, yb, W, H, { rpm = 120, day = 0, on = true, temp = 24 } = {}) {
  const bodyH = H, depth = H * 0.62, inset = W * 0.035;
  const yTop = yb - bodyH;
  shadow(ctx, x + W / 2 + W * 0.03, yb + 2, W * 0.58, H * 0.2, 0.4);
  // верхня грань корпусу
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x + inset, yTop - depth); ctx.lineTo(x + W - inset, yTop - depth); ctx.lineTo(x + W, yTop); ctx.closePath();
  const tg = ctx.createLinearGradient(0, yTop - depth, 0, yTop); tg.addColorStop(0, '#B9C3C4'); tg.addColorStop(1, '#DDE3E2');
  ctx.fillStyle = tg; ctx.fill();
  // фронтальна панель
  const fg = ctx.createLinearGradient(0, yTop, 0, yb);
  fg.addColorStop(0, '#F1F3F1'); fg.addColorStop(0.12, '#E2E7E5'); fg.addColorStop(1, '#AEB8B7');
  ctx.fillStyle = fg; roundRect(ctx, x, yTop, W, bodyH, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + 4, yTop + 1, W - 8, 1.5);
  // дисплей
  const dw = Math.min(W * 0.34, 150), dh = Math.min(bodyH * 0.5, 34), dx = x + W * 0.08, dy = yTop + (bodyH - dh) / 2;
  ctx.fillStyle = '#2B3431'; roundRect(ctx, dx - 3, dy - 3, dw + 6, dh + 6, 5); ctx.fill();
  const lg = ctx.createLinearGradient(0, dy, 0, dy + dh); lg.addColorStop(0, '#0E2A22'); lg.addColorStop(1, '#06140F');
  ctx.fillStyle = lg; roundRect(ctx, dx, dy, dw, dh, 3); ctx.fill();
  ctx.font = `700 ${Math.max(10, Math.round(dh * 0.42))}px ui-monospace, Menlo, Consolas, monospace`; ctx.textBaseline = 'middle';
  ctx.fillStyle = on ? '#7CF0B4' : '#2F6D52'; ctx.shadowColor = on ? 'rgba(90,255,170,.7)' : 'transparent'; ctx.shadowBlur = 6;
  ctx.textAlign = 'left'; ctx.fillText(`${Math.round(rpm)}`, dx + 6, dy + dh * 0.52);
  ctx.font = `600 ${Math.max(8, Math.round(dh * 0.27))}px system-ui, sans-serif`; ctx.fillText('об/хв', dx + 6 + dh * 0.95 + (rpm >= 100 ? dh * 0.3 : 0), dy + dh * 0.56);
  ctx.textAlign = 'right'; ctx.font = `700 ${Math.max(9, Math.round(dh * 0.34))}px ui-monospace, Menlo, monospace`; ctx.fillStyle = on ? '#FFD27A' : '#6D5A2E'; ctx.shadowColor = on ? 'rgba(255,200,90,.6)' : 'transparent';
  ctx.fillText(`${temp} °C`, dx + dw - 6, dy + dh * 0.52);
  ctx.shadowBlur = 0;
  // кнопки й ручка
  const kx = x + W * 0.86, ky = yTop + bodyH / 2, kr = Math.min(bodyH * 0.26, 14);
  const kg = ctx.createRadialGradient(kx - kr * 0.3, ky - kr * 0.35, 1, kx, ky, kr);
  kg.addColorStop(0, '#FAFBFA'); kg.addColorStop(0.7, '#9CA6A5'); kg.addColorStop(1, '#5D6766');
  ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3E4847'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(-2.3 + rpm / 200 * 4.6) * kr * 0.75, ky + Math.sin(-2.3 + rpm / 200 * 4.6) * kr * 0.75); ctx.stroke();
  for (let i = 0; i < 2; i++) {
    const bx = x + W * (0.55 + i * 0.1), by2 = ky;
    ctx.fillStyle = i === 0 && on ? '#38B26A' : '#C9D0CF'; ctx.beginPath(); ctx.arc(bx, by2, Math.min(5, bodyH * 0.1), 0, TAU); ctx.fill();
    if (i === 0 && on) { ctx.fillStyle = 'rgba(80,255,150,.35)'; ctx.beginPath(); ctx.arc(bx, by2, 9, 0, TAU); ctx.fill(); }
  }
  // ніжки
  ctx.fillStyle = '#2A2F2E'; for (const fx of [x + 10, x + W - 22]) { roundRect(ctx, fx, yb - 2, 12, 5, 2); ctx.fill(); }
  ctx.restore();
  return { x0: x, x1: x + W, yFront: yTop, yBack: yTop - depth, inset };
}

/** Платформа шейкера з гумовим килимком, зміщена на (ox, oy). */
export function shakerPlatform(ctx, g, ox, oy) {
  const th = 7, lift = 6;
  const a = [g.x0 + 4 + ox, g.yFront - lift + oy], b = [g.x0 + g.inset + 6 + ox, g.yBack - lift + 2 + oy], c = [g.x1 - g.inset - 6 + ox, g.yBack - lift + 2 + oy], d = [g.x1 - 4 + ox, g.yFront - lift + oy];
  ctx.save();
  // торець
  ctx.fillStyle = '#7D8786'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(d[0], d[1]); ctx.lineTo(d[0], d[1] + th); ctx.lineTo(a[0], a[1] + th); ctx.closePath(); ctx.fill();
  const eg = ctx.createLinearGradient(a[0], 0, d[0], 0); eg.addColorStop(0, 'rgba(255,255,255,.15)'); eg.addColorStop(0.3, 'rgba(255,255,255,.55)'); eg.addColorStop(1, 'rgba(255,255,255,.05)');
  ctx.fillStyle = eg; ctx.fill();
  // верх (нержавійка) і гумовий килимок
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  const sg = ctx.createLinearGradient(a[0], b[1], d[0], a[1]); sg.addColorStop(0, '#D7DDDD'); sg.addColorStop(0.45, '#F4F6F6'); sg.addColorStop(1, '#AFB8B8');
  ctx.fillStyle = sg; ctx.fill();
  const m = 0.08;
  const L = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  const ia = L(a, c, m), ib = L(b, d, m), ic = L(c, a, m), id = L(d, b, m);
  ctx.beginPath(); ctx.moveTo(ia[0], ia[1]); ctx.lineTo(ib[0], ib[1]); ctx.lineTo(ic[0], ic[1]); ctx.lineTo(id[0], id[1]); ctx.closePath();
  ctx.fillStyle = '#3E4644'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) { const p = L(ia, id, i / 12), q = L(ib, ic, i / 12); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
  ctx.restore();
  return { yMid: (a[1] + b[1]) / 2 + 2, ox, oy };
}

/** Пружинний затискач колби (кільце й стійки). */
export function clamp3(ctx, cx, by, s) {
  const hw = halfAt(s, s * 0.12) + 2;
  ctx.save();
  ctx.strokeStyle = '#8C9696'; ctx.lineWidth = 2;
  for (const dx of [-hw, hw]) { ctx.beginPath(); ctx.moveTo(cx + dx, by + 2); ctx.lineTo(cx + dx, by - s * 0.14); ctx.stroke(); }
  const rg = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
  rg.addColorStop(0, '#6F7979'); rg.addColorStop(0.25, '#F2F4F4'); rg.addColorStop(0.6, '#A5AEAE'); rg.addColorStop(1, '#5E6767');
  ctx.strokeStyle = rg; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(cx, by - s * 0.12, hw, s * 0.03, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
}

/* ================= Клітини суспензії у світлому полі ================= */
/**
 * Генерує поле зору: одиночні клітини, дрібні (2–12 кл.) і великі (> 12 кл.) агрегати.
 * fr — частки об'єктів [одиночні, дрібні, великі] у %; dead — частка мертвих клітин (0…1);
 * aggDead — додаткова частка мертвих усередині великих агрегатів; scale — px на 1 мкм.
 */
export function genField(seed, { fr = [40, 50, 10], dead = 0.1, aggDead = 0.15, n = 26, scale = 0.6, area = 1 } = {}) {
  const R = rng(seed), units = [];
  const tot = fr[0] + fr[1] + fr[2] || 1;
  const nU = Math.max(6, Math.round(n * area));
  for (let i = 0; i < nU; i++) {
    const r = R() * tot;
    const kind = r < fr[0] ? 0 : r < fr[0] + fr[1] ? 1 : 2;
    const nc = kind === 0 ? 1 : kind === 1 ? 2 + Math.floor(Math.pow(R(), 1.3) * 10) : 13 + Math.floor(R() * 18);
    // компонування клітин агрегату: «наростання» з перевіркою перекриття
    const cells = [];
    for (let k = 0; k < nc; k++) {
      const rx = (17 + R() * 12) * scale, ry = rx * (0.7 + R() * 0.28), rot = R() * Math.PI;
      if (!k) { cells.push({ x: 0, y: 0, rx, ry, rot }); continue; }
      let best = null;
      for (let tr = 0; tr < 14; tr++) {
        const b = cells[(R() * cells.length) | 0], a = R() * TAU, d = (b.rx + rx) * 0.82;
        const c = { x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d * 0.95, rx, ry, rot };
        let ov = 0; for (const o of cells) { const dd = Math.hypot(o.x - c.x, o.y - c.y); ov = Math.max(ov, (o.rx + c.rx) * 0.78 - dd); }
        const dc = Math.hypot(c.x, c.y);
        const score = ov * 4 + dc * 0.12;
        if (!best || score < best.score) best = { c, score };
      }
      cells.push(best.c);
    }
    const pDead = kind === 2 ? clamp(dead + aggDead, 0, 1) : kind === 1 ? clamp(dead + aggDead * 0.3, 0, 1) : dead;
    for (const c of cells) { c.dead = R() < pDead; c.seed = (R() * 1e6) | 0; c.shrink = c.dead ? 0.55 + R() * 0.3 : 1; }
    let ext = 0; for (const c of cells) ext = Math.max(ext, Math.hypot(c.x, c.y) + c.rx);
    units.push({ kind, cells, ext, x: 0, y: 0 });
  }
  return units;
}

/** Розкладає об'єкти в колі радіуса r (без сильних перекриттів). */
export function layoutUnits(units, r, seed = 3) {
  const R = rng(seed), placed = [];
  const order = units.slice().sort((a, b) => b.ext - a.ext);
  for (const u of order) {
    let ok = false;
    for (let tr = 0; tr < 60 && !ok; tr++) {
      const a = R() * TAU, d = Math.sqrt(R()) * Math.max(0, r * 0.98 - u.ext * 0.4);
      u.x = Math.cos(a) * d; u.y = Math.sin(a) * d;
      ok = placed.every((p) => Math.hypot(p.x - u.x, p.y - u.y) > (p.ext + u.ext) * 0.92);
    }
    if (ok) placed.push(u); else u.skip = true;
  }
  return units.filter((u) => !u.skip);
}

/**
 * Одна клітина суспензії (світле поле): тонка стінка з ореолом, центральна вакуоля, пристінна
 * зерниста цитоплазма з тяжами, ядро з ядерцем. stain: 0…1 (забарвлення мертвої клітини), dye: 'evans'|'mb'.
 */
export function suspCell(ctx, x, y, c, { stain = 0, dye = 'evans', tint = '#E6DDB8' } = {}) {
  const R = rng(c.seed);
  const { rx, ry, rot } = c;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  // ореол/стінка
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  const wg = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, Math.min(rx, ry) * 0.2, 0, 0, Math.max(rx, ry));
  wg.addColorStop(0, 'rgba(255,253,240,.55)'); wg.addColorStop(0.85, 'rgba(236,230,205,.45)'); wg.addColorStop(1, 'rgba(160,150,110,.55)');
  ctx.fillStyle = wg; ctx.fill();
  ctx.lineWidth = Math.max(0.8, rx * 0.07); ctx.strokeStyle = 'rgba(96,88,58,.78)'; ctx.stroke();
  ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,255,250,.85)'; ctx.beginPath(); ctx.ellipse(-0.4, -0.5, rx - rx * 0.09, ry - rx * 0.09, 0, Math.PI * 0.95, Math.PI * 1.75); ctx.stroke();
  const base = hex(tint);
  const blue = dye === 'evans' ? [38, 62, 168] : [32, 92, 170];
  if (c.dead) {
    // мертвий протопласт: стиснений, зернистий; барвник фарбує його в синій
    const k = c.shrink, px = (rx - rx * 0.1) * k, py = (ry - rx * 0.1) * k, ox = (R() - 0.5) * rx * 0.2;
    const col = mix(mix(base, [150, 130, 90], 0.45), blue, stain);
    const g = ctx.createRadialGradient(ox - px * 0.3, -py * 0.3, 0.5, ox, 0, Math.max(px, py));
    g.addColorStop(0, rgba(shade(col, 0.25), 0.75 + stain * 0.15)); g.addColorStop(1, rgba(shade(col, -0.3), 0.85 + stain * 0.1));
    ctx.fillStyle = g; ctx.beginPath();
    for (let j = 0; j <= 14; j++) { const t = j / 14 * TAU, rr = 0.82 + 0.3 * noise(Math.cos(t) * 1.6 + c.seed % 97, Math.sin(t) * 1.6, 2); const X = ox + Math.cos(t) * px * rr, Y = Math.sin(t) * py * rr; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.fill();
    ctx.fillStyle = rgba(shade(col, -0.45), 0.5);
    for (let i = 0; i < px * 0.9; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 0.85; ctx.beginPath(); ctx.arc(ox + Math.cos(a) * px * d, Math.sin(a) * py * d, 0.5 + R() * 0.8, 0, TAU); ctx.fill(); }
    if (dye === 'mb' || stain > 0.3) { // ядро — найтемніше
      const nr = Math.min(px, py) * 0.32;
      ctx.fillStyle = rgba(mix(shade(col, -0.5), blue, stain * 0.5), 0.9); ctx.beginPath(); ctx.arc(ox + px * 0.15, -py * 0.1, nr, 0, TAU); ctx.fill();
    }
  } else {
    // живий: пристінна цитоплазма
    const cyt = mix(base, [205, 196, 160], 0.25);
    ctx.lineWidth = Math.max(1.2, rx * 0.16); ctx.strokeStyle = rgba(cyt, 0.55);
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.84, ry * 0.8, 0, 0, TAU); ctx.stroke();
    // тяжі цитоплазми до ядра
    const na = R() * TAU, nx = Math.cos(na) * rx * 0.38, ny = Math.sin(na) * ry * 0.34;
    ctx.strokeStyle = rgba(shade(cyt, -0.1), 0.5); ctx.lineWidth = Math.max(0.6, rx * 0.04);
    for (let i = 0; i < 4; i++) { const a = na + Math.PI + (R() - 0.5) * 2.6; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo((nx + Math.cos(a) * rx * 0.5) / 1.4, (ny + Math.sin(a) * ry * 0.5) / 1.4 + (R() - 0.5) * 4, Math.cos(a) * rx * 0.8, Math.sin(a) * ry * 0.76); ctx.stroke(); }
    // гранули (пластиди, крохмаль)
    for (let i = 0; i < rx * 0.9; i++) {
      const a = R() * TAU, d = 0.7 + R() * 0.18;
      ctx.fillStyle = R() > 0.5 ? 'rgba(255,255,245,.75)' : rgba(shade(cyt, -0.35), 0.55);
      ctx.beginPath(); ctx.arc(Math.cos(a) * rx * d, Math.sin(a) * ry * d, 0.45 + R() * 0.75, 0, TAU); ctx.fill();
    }
    // ядро з ядерцем
    const nr = Math.min(rx, ry) * 0.24 + 0.6;
    const ng = ctx.createRadialGradient(nx - nr * 0.35, ny - nr * 0.35, 0.3, nx, ny, nr);
    ng.addColorStop(0, 'rgba(245,240,222,.95)'); ng.addColorStop(0.7, 'rgba(190,180,148,.9)'); ng.addColorStop(1, 'rgba(120,112,84,.95)');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.ellipse(nx, ny, nr, nr * 0.86, na, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(95,86,60,.75)'; ctx.beginPath(); ctx.arc(nx + nr * 0.2, ny - nr * 0.15, nr * 0.3, 0, TAU); ctx.fill();
    // ледь помітний «відблиск» інтактної мембрани
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.9, ry * 0.86, 0, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  }
  ctx.restore();
}

/** Малює всі об'єкти поля (у координатах центру поля). stainOf(cell) → 0…1. */
export function drawUnits(ctx, cx, cy, units, { dye = 'evans', tint = '#E6DDB8', stainOf = () => 0 } = {}) {
  for (const u of units) {
    // спільна тінь/оболонка агрегату
    if (u.cells.length > 1) {
      ctx.save(); ctx.fillStyle = 'rgba(120,108,70,.10)';
      for (const c of u.cells) { ctx.beginPath(); ctx.ellipse(cx + u.x + c.x + 1, cy + u.y + c.y + 1.5, c.rx * 1.03, c.ry * 1.03, c.rot, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    for (const c of u.cells) suspCell(ctx, cx + u.x + c.x, cy + u.y + c.y, c, { stain: c.dead ? stainOf(c, u) : 0, dye, tint });
  }
}

/** Кругле поле зору з кешуванням у позаекранне полотно. */
export function fieldBackground(ctx, cx, cy, r, { tint = 'bright', seed = 4 } = {}) {
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.05, cx, cy, r);
  g.addColorStop(0, '#FCFAF1'); g.addColorStop(0.7, '#F1EBD6'); g.addColorStop(1, '#DCD2B2');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  // дрібне сміття/уламки, нерівномірність освітлення
  const R = rng(seed);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(130,115,80,${0.05 + R() * 0.12})`; ctx.beginPath(); ctx.arc(cx + (R() - 0.5) * 2 * r, cy + (R() - 0.5) * 2 * r, 0.4 + R() * 1.4, 0, TAU); ctx.fill(); }
}

/** Оправа поля зору мікроскопа (віньєтка, хроматична облямівка, тубус). */
export function eyepiece(ctx, cx, cy, r, { dark = false } = {}) {
  ctx.save();
  const v = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.85, dark ? 'rgba(0,0,0,.35)' : 'rgba(90,70,30,.16)'); v.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = v; ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(80,140,255,.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r - 1.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,140,60,.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r - 4, 0, TAU); ctx.stroke();
  const ring = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.09);
  ring.addColorStop(0, '#050807'); ring.addColorStop(0.5, '#1B2420'); ring.addColorStop(1, '#3A4540');
  ctx.strokeStyle = ring; ctx.lineWidth = r * 0.09; ctx.beginPath(); ctx.arc(cx, cy, r * 1.045, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r * 1.09, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
}

/** Масштабна лінійка в полі зору. */
export function scaleBar(ctx, x, y, px, text, dark = false) {
  ctx.save();
  ctx.fillStyle = dark ? 'rgba(10,20,14,.55)' : 'rgba(255,255,255,.75)';
  ctx.font = '700 11px system-ui, sans-serif'; const m = ctx.measureText(text).width;
  roundRect(ctx, x - 6, y - 17, Math.max(px, m) + 12, 25, 6); ctx.fill();
  ctx.fillStyle = dark ? '#EAF5EC' : '#1B2A20'; ctx.fillRect(x, y + 1, px, 3);
  ctx.textAlign = 'center'; ctx.fillText(text, x + Math.max(px, m) / 2, y - 4);
  ctx.restore();
}

/* ================= Мікроскоп (2.5D) ================= */
export function microscope(ctx, x, by, s, { light = true, slideColor = 'rgba(70,100,190,.55)' } = {}) {
  ctx.save();
  shadow(ctx, x + s * 0.05, by + 2, s * 0.42, s * 0.07, 0.4);
  const metal = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#20282A'); g.addColorStop(0.3, '#5C6A6D'); g.addColorStop(0.5, '#2C3537'); g.addColorStop(1, '#141A1B'); return g; };
  const cream = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#C9CCC4'); g.addColorStop(0.35, '#F6F6F0'); g.addColorStop(1, '#A7ABA3'); return g; };
  // основа
  ctx.fillStyle = cream(x - s * 0.36, x + s * 0.36); roundRect(ctx, x - s * 0.36, by - s * 0.09, s * 0.72, s * 0.09, s * 0.03); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x - s * 0.34, by - s * 0.012, s * 0.68, s * 0.012);
  // освітлювач
  const lx = x + s * 0.02, ly = by - s * 0.105;
  ctx.fillStyle = '#2B3335'; ctx.beginPath(); ctx.ellipse(lx, ly, s * 0.07, s * 0.018, 0, 0, TAU); ctx.fill();
  if (light) { const lg = ctx.createRadialGradient(lx, ly - 2, 1, lx, ly - 2, s * 0.09); lg.addColorStop(0, 'rgba(255,250,220,.95)'); lg.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly - 2, s * 0.09, 0, TAU); ctx.fill(); }
  // штатив (дуга)
  ctx.fillStyle = cream(x - s * 0.3, x - s * 0.1);
  ctx.beginPath(); ctx.moveTo(x - s * 0.3, by - s * 0.09); ctx.lineTo(x - s * 0.14, by - s * 0.09);
  ctx.quadraticCurveTo(x - s * 0.1, by - s * 0.5, x - s * 0.02, by - s * 0.72); ctx.lineTo(x - s * 0.12, by - s * 0.8);
  ctx.quadraticCurveTo(x - s * 0.3, by - s * 0.5, x - s * 0.3, by - s * 0.09); ctx.closePath(); ctx.fill();
  // гвинти фокусування
  for (const [r, c] of [[s * 0.07, '#3A4446'], [s * 0.045, '#596568']]) { const g = ctx.createRadialGradient(x - s * 0.24, by - s * 0.32, 1, x - s * 0.22, by - s * 0.3, r); g.addColorStop(0, '#8E9A9C'); g.addColorStop(1, c); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x - s * 0.22, by - s * 0.3, r, 0, TAU); ctx.fill(); }
  // предметний столик
  ctx.fillStyle = '#20282A'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, by - s * 0.36); ctx.lineTo(x + s * 0.26, by - s * 0.36); ctx.lineTo(x + s * 0.22, by - s * 0.31); ctx.lineTo(x - s * 0.24, by - s * 0.31); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3B4547'; ctx.fillRect(x - s * 0.24, by - s * 0.31, s * 0.46, s * 0.025);
  // предметне скло з краплею
  ctx.fillStyle = 'rgba(220,240,240,.85)'; ctx.beginPath(); ctx.moveTo(x - s * 0.12, by - s * 0.375); ctx.lineTo(x + s * 0.24, by - s * 0.375); ctx.lineTo(x + s * 0.22, by - s * 0.355); ctx.lineTo(x - s * 0.14, by - s * 0.355); ctx.closePath(); ctx.fill();
  ctx.fillStyle = slideColor; ctx.beginPath(); ctx.ellipse(x + s * 0.03, by - s * 0.366, s * 0.04, s * 0.007, 0, 0, TAU); ctx.fill();
  // револьвер з об'єктивами
  ctx.fillStyle = metal(x - s * 0.06, x + s * 0.1); ctx.beginPath(); ctx.ellipse(x + s * 0.02, by - s * 0.55, s * 0.09, s * 0.03, -0.15, 0, TAU); ctx.fill();
  for (const [dx, len, col] of [[-0.03, 0.11, '#C7A64A'], [0.03, 0.13, '#C8CDD0'], [0.08, 0.09, '#A8302A']]) {
    ctx.fillStyle = metal(x + s * (dx - 0.018), x + s * (dx + 0.018)); roundRect(ctx, x + s * (dx - 0.018), by - s * 0.55, s * 0.036, s * len, 3); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(x + s * (dx - 0.018), by - s * 0.55 + s * len * 0.55, s * 0.036, 2);
  }
  // тубус і окуляр
  ctx.save(); ctx.translate(x + s * 0.0, by - s * 0.58); ctx.rotate(-0.42);
  ctx.fillStyle = cream(-s * 0.06, s * 0.06); roundRect(ctx, -s * 0.06, -s * 0.24, s * 0.12, s * 0.26, s * 0.02); ctx.fill();
  ctx.fillStyle = metal(-s * 0.035, s * 0.035); roundRect(ctx, -s * 0.035, -s * 0.36, s * 0.07, s * 0.13, 3); ctx.fill();
  ctx.fillStyle = '#0E1314'; ctx.beginPath(); ctx.ellipse(0, -s * 0.36, s * 0.037, s * 0.011, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

/* ================= Лічильна камера Фукса — Розенталя ================= */
/**
 * Сітка камери у полі зору: 4×4 великих квадрати (1 мм), кожен поділено на 16 малих (0,25 мм);
 * великі квадрати розділені потрійними лініями. (x, y) — лівий верхній кут, S — сторона сітки, px.
 */
export function frGrid(ctx, x, y, S, { hl = [], active = -1, done = [] } = {}) {
  const q = S / 4;
  ctx.save();
  // підсвітка квадратів для підрахунку
  for (const k of hl) {
    const i = k % 4, j = (k / 4) | 0;
    ctx.fillStyle = k === active ? 'rgba(255,196,60,.22)' : done.includes(k) ? 'rgba(60,170,110,.13)' : 'rgba(255,214,110,.10)';
    ctx.fillRect(x + i * q, y + j * q, q, q);
  }
  // малі поділки
  ctx.strokeStyle = 'rgba(70,60,40,.33)'; ctx.lineWidth = 0.7;
  for (let i = 0; i <= 16; i++) { if (i % 4 === 0) continue; const p = x + i * q / 4 + 0.5, pp = y + i * q / 4 + 0.5; ctx.beginPath(); ctx.moveTo(p, y); ctx.lineTo(p, y + S); ctx.moveTo(x, pp); ctx.lineTo(x + S, pp); ctx.stroke(); }
  // потрійні лінії між великими квадратами
  ctx.strokeStyle = 'rgba(55,45,28,.62)'; ctx.lineWidth = 0.8;
  for (let i = 0; i <= 4; i++) for (const d of [-2.2, 0, 2.2]) {
    const p = x + i * q + d, pp = y + i * q + d;
    if (p < x - 3 || p > x + S + 3) continue;
    ctx.beginPath(); ctx.moveTo(p, y - 3); ctx.lineTo(p, y + S + 3); ctx.moveTo(x - 3, pp); ctx.lineTo(x + S + 3, pp); ctx.stroke();
  }
  // рамка активного квадрата
  if (active >= 0) { const i = active % 4, j = (active / 4) | 0; ctx.strokeStyle = '#E39B12'; ctx.lineWidth = 2.2; ctx.strokeRect(x + i * q + 1, y + j * q + 1, q - 2, q - 2); }
  ctx.restore();
}

/** Предметне скло камери (вигляд 2.5D) з притертим покривним склом і кільцями Ньютона. */
export function frSlide(ctx, cx, cy, w, { t = 0, filled = 1 } = {}) {
  const h = w * 0.36, sk = w * 0.12;
  ctx.save();
  shadow(ctx, cx + w * 0.03, cy + h * 0.55, w * 0.55, h * 0.25, 0.35);
  // товсте скло
  const P = (u, v) => [cx - w / 2 + u * w + (1 - v) * sk * 0.5, cy - h / 2 + v * h];
  const poly = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
  poly([P(0, 1), P(1, 1), [P(1, 1)[0], P(1, 1)[1] + w * 0.035], [P(0, 1)[0], P(0, 1)[1] + w * 0.035]], 'rgba(150,190,180,.75)');
  const tg = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  tg.addColorStop(0, 'rgba(235,248,245,.92)'); tg.addColorStop(0.5, 'rgba(205,228,222,.85)'); tg.addColorStop(1, 'rgba(225,242,238,.9)');
  poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], tg, 'rgba(70,110,100,.55)');
  // жолоби (Н-подібна канавка) і платформа з сіткою
  poly([P(0.28, 0.12), P(0.31, 0.12), P(0.31, 0.88), P(0.28, 0.88)], 'rgba(90,130,120,.35)');
  poly([P(0.69, 0.12), P(0.72, 0.12), P(0.72, 0.88), P(0.69, 0.88)], 'rgba(90,130,120,.35)');
  poly([P(0.31, 0.47), P(0.69, 0.47), P(0.69, 0.53), P(0.31, 0.53)], 'rgba(90,130,120,.35)');
  // сітки
  for (const v0 of [0.2, 0.62]) { const a = P(0.44, v0), b = P(0.56, v0 + 0.18); ctx.strokeStyle = 'rgba(60,50,30,.5)'; ctx.lineWidth = 0.5; for (let i = 0; i <= 4; i++) { const u = 0.44 + i * 0.03; const p1 = P(u, v0), p2 = P(u, v0 + 0.18); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); const q1 = P(0.44, v0 + i * 0.045), q2 = P(0.56, v0 + i * 0.045); ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke(); } void a; void b; }
  // рідина під покривним склом
  if (filled > 0) poly([P(0.33, 0.14), P(0.67, 0.14), P(0.67, 0.14 + 0.72 * filled), P(0.33, 0.14 + 0.72 * filled)], 'rgba(214,190,120,.28)');
  // покривне скло з кільцями Ньютона
  poly([P(0.26, 0.06), P(0.74, 0.06), P(0.74, 0.94), P(0.26, 0.94)], 'rgba(255,255,255,.22)', 'rgba(255,255,255,.8)');
  for (const u of [0.27, 0.73]) {
    const [nx, ny] = P(u, 0.5);
    for (let i = 0; i < 5; i++) { const hue = (i * 70 + t * 40) % 360; ctx.strokeStyle = `hsla(${hue},80%,60%,.45)`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(nx, ny, w * 0.012 + i * 2.2, h * 0.25 - i * 3, 0, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
}

/* ================= Піпетка ================= */
export function pipette(ctx, x, y, len, { ang = 0.35, fill = 0.5, color = 'rgba(230,214,160,.85)' } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const w = Math.max(5, len * 0.05);
  // гумова груша
  const bg = ctx.createLinearGradient(-w * 1.4, 0, w * 1.4, 0); bg.addColorStop(0, '#6B1F1A'); bg.addColorStop(0.35, '#D2533F'); bg.addColorStop(1, '#5A1814');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, -len - w * 1.5, w * 1.35, w * 2.1, 0, 0, TAU); ctx.fill();
  // скляна трубка
  ctx.fillStyle = 'rgba(225,240,236,.45)'; ctx.beginPath(); ctx.moveTo(-w / 2, -len); ctx.lineTo(w / 2, -len); ctx.lineTo(w / 2, -len * 0.18); ctx.lineTo(w * 0.12, 0); ctx.lineTo(-w * 0.12, 0); ctx.lineTo(-w / 2, -len * 0.18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,100,90,.6)'; ctx.lineWidth = 0.9; ctx.stroke();
  if (fill > 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-w / 2 + 1, -len * 0.18 - len * 0.6 * fill); ctx.lineTo(w / 2 - 1, -len * 0.18 - len * 0.6 * fill); ctx.lineTo(w / 2 - 1, -len * 0.18); ctx.lineTo(w * 0.1, -1); ctx.lineTo(-w * 0.1, -1); ctx.lineTo(-w / 2 + 1, -len * 0.18); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(-w * 0.25, -len * 0.95); ctx.lineTo(-w * 0.25, -len * 0.22); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,60,50,.6)'; ctx.lineWidth = 0.7; for (let i = 1; i < 6; i++) { const yy = -len * 0.18 - len * 0.12 * i; ctx.beginPath(); ctx.moveTo(w * 0.05, yy); ctx.lineTo(w / 2, yy); ctx.stroke(); }
  ctx.restore();
}

/* ================= Колонії на агарі ================= */
/** Мікрокалюс (колонія-клон) у плані: кремова горбкувата пляма з тінню. */
export function colony(ctx, x, y, r, { seed = 1, tint = '#EDE2BE', brown = 0 } = {}) {
  if (r < 0.4) return;
  const R = rng(seed), base = mix(hex(tint), hex('#B88A4A'), brown);
  ctx.save();
  if (r > 1.5) { ctx.fillStyle = 'rgba(80,70,30,.18)'; ctx.beginPath(); ctx.ellipse(x + r * 0.25, y + r * 0.3, r * 1.05, r * 0.9, 0, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, rgba(shade(base, 0.45))); g.addColorStop(0.6, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.3)));
  ctx.fillStyle = g; ctx.beginPath();
  const n = 12;
  for (let j = 0; j <= n; j++) { const t = j / n * TAU, rr = r * (0.82 + 0.3 * noise(Math.cos(t) * 1.7 + seed, Math.sin(t) * 1.7, 5)); const X = x + Math.cos(t) * rr, Y = y + Math.sin(t) * rr * 0.9; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.fill();
  if (r > 3) { for (let i = 0; i < r * 0.8; i++) { const a = R() * TAU, d = Math.sqrt(R()) * r * 0.7; ctx.fillStyle = R() > 0.5 ? 'rgba(255,255,250,.45)' : rgba(shade(base, -0.35), 0.35); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, 0.5 + R() * r * 0.12, 0, TAU); ctx.fill(); } }
  if (r > 1.2) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.38, r * 0.25, r * 0.15, -0.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}
