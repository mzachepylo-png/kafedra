// Теми 2–3 «Біотехнологій в агросфері»: спільні примітиви.
// • callusSprite — фотореалістичний калюс: об'єднання сферичних горбків із z-буфером, нормалями,
//   дрібнозернистою поверхнею, вологим полиском, підповерхневим розсіюванням, затіненням западин
//   і плямами побуріння (хінони). Рендер попіксельний, тому кешується в offscreen-полотна.
// • vial — пеніциліновий флакон з агаром і фольговою капою; thermostat — інтер'єр термостата.
// • growth — модель S-подібної кривої росту калюсу (див. коментарі до формул).
// • BandPlot — графік kit.Plot зі смугами фаз; Heat — теплова карта «ауксин × цитокінін».
import { Plot, TAU, clamp, lerp, smooth, rng, noise, fbm, hex, rgba, mix, shade, offscreen, roundRect, shadow, applyGrain, fnum, MAT } from './kit.js';

/* ======================================================================
   Калюс
   ====================================================================== */
const spriteCache = new Map();
function cacheGet(k) { const v = spriteCache.get(k); if (v) { spriteCache.delete(k); spriteCache.set(k, v); } return v; }
function cachePut(k, v) { spriteCache.set(k, v); if (spriteCache.size > 160) spriteCache.delete(spriteCache.keys().next().value); }

// Нормалізовані горбки калюсу для seed: позиції на куполі (x — праворуч, y — до глядача, z — угору).
const nodCache = new Map();
function nodules(seed, friable) {
  const k = seed + '|' + Math.round(friable * 10);
  if (nodCache.has(k)) return nodCache.get(k);
  const R = rng(seed * 7919 + 13), list = [];
  const n = Math.round(70 + friable * 170);
  // кілька великих «лопатей», навколо яких групуються горбки — щоб калюс був нерівний, а не півсфера
  const lobes = [];
  for (let i = 0; i < 5; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 0.55; lobes.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, h: 0.55 + R() * 0.5 }); }
  for (let i = 0; i < n; i++) {
    const L = lobes[i % lobes.length];
    const a = R() * TAU, d = Math.pow(R(), 0.8) * (0.55 + friable * 0.12);
    let x = L.x * 0.6 + Math.cos(a) * d, y = L.y * 0.6 + Math.sin(a) * d * 0.85;
    const rr = Math.hypot(x, y / 0.85);
    if (rr > 1) { x /= rr; y /= rr; }
    const dome = Math.sqrt(Math.max(0, 1 - x * x - (y * y) / 0.72));
    const z = dome * (0.5 + 0.35 * L.h) * (0.75 + 0.35 * R());
    const r = (0.11 + R() * 0.12) * (1.25 - friable * 0.55) * (0.75 + 0.45 * dome);
    list.push({ x, y, z, r, k: R(), rank: R() * 0.35 + rr * 0.65 });
  }
  nodCache.set(k, list);
  return list;
}

/**
 * Спрайт калюсу. size — півширина основи (CSS px). Повертає {c, w, h, ax, ay} — полотно і якір
 * (центр основи) у CSS px. opts: seed, friable 0..1 (пухкий/щільний), color, green, brown 0..1,
 * yellow 0..1, glossy, buds (зелені бруньки 0..1), roots (корінці 0..1), dpr.
 */
export function callusSprite(size, o = {}) {
  const seed = o.seed ?? 1, fr = clamp(o.friable ?? 0.5, 0, 1), dpr = o.dpr || 1;
  const q = (v, s = 0.05) => Math.round((v || 0) / s) * s;
  const S = Math.max(4, Math.round(size));
  const key = [seed, q(fr, 0.1), o.color || '', q(o.green), q(o.brown), q(o.yellow), S, dpr, q(o.glossy ?? 0.8, 0.1), q(o.buds, 0.1), q(o.roots, 0.1), q(o.tall ?? 1.25, 0.1)].join('|');
  const hit = cacheGet(key);
  if (hit) return hit;

  const elev = 0.5; // кут огляду ≈ 29°
  const se = Math.sin(elev), ce = Math.cos(elev);
  const tall = o.tall ?? 1.25;
  const W = Math.ceil(S * 2.5), H = Math.ceil(S * (1.7 + 0.4 * tall));
  const ax = W / 2, ay = H - S * 0.42;
  const bw = Math.ceil(W * dpr), bh = Math.ceil(H * dpr);
  const N = bw * bh;
  const zb = new Float32Array(N).fill(-1e9), nxA = new Float32Array(N), nyA = new Float32Array(N), nzA = new Float32Array(N);
  const cov = new Float32Array(N), kA = new Float32Array(N), hA = new Float32Array(N);
  const nods = nodules(seed, fr);
  const sc = S * dpr;
  for (const nd of nods) {
    const X = nd.x * sc, Y = nd.y * sc * 0.9, Z = nd.z * sc * 0.95 * tall, r = nd.r * sc;
    const sx = ax * dpr + X, sy = ay * dpr + Y * se - Z * ce, dep = Y * ce + Z * se;
    const x0 = Math.max(0, Math.floor(sx - r - 1)), x1 = Math.min(bw - 1, Math.ceil(sx + r + 1));
    const y0 = Math.max(0, Math.floor(sy - r - 1)), y1 = Math.min(bh - 1, Math.ceil(sy + r + 1));
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - sy;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - sx, d2 = dx * dx + dy * dy;
        if (d2 > (r + 0.7) * (r + 0.7)) continue;
        const hz = Math.sqrt(Math.max(0, r * r - d2)), z = dep + hz, i = py * bw + px;
        if (z > zb[i]) {
          zb[i] = z; nxA[i] = dx / r; nyA[i] = -dy / r; nzA[i] = hz / r;
          cov[i] = Math.max(cov[i], clamp(r + 0.5 - Math.sqrt(d2), 0, 1)); kA[i] = nd.k; hA[i] = nd.z;
        } else if (cov[i] < 1) cov[i] = Math.max(cov[i], clamp(r + 0.5 - Math.sqrt(d2), 0, 1));
      }
    }
  }
  // освітлення: зверху-ліворуч-спереду
  let Lx = -0.5, Ly = 0.7, Lz = 0.55; const ll = Math.hypot(Lx, Ly, Lz); Lx /= ll; Ly /= ll; Lz /= ll;
  let Hx = Lx, Hy = Ly, Hz = Lz + 1; const hl = Math.hypot(Hx, Hy, Hz); Hx /= hl; Hy /= hl; Hz /= hl;
  let base = o.color ? hex(o.color) : hex(MAT.callusWhite);
  if (o.yellow) base = mix(base, [226, 204, 120], clamp(o.yellow, 0, 1));
  const greenC = [150, 184, 84], brownC = [128, 84, 40], deadC = [74, 50, 28];
  const green = clamp(o.green || 0, 0, 1), brown = clamp(o.brown || 0, 0, 1), gloss = o.glossy ?? 0.8;
  const out = offscreen(bw, bh), cx = out.getContext('2d'), img = cx.createImageData(bw, bh), D = img.data;
  const gs = 0.9 / dpr; // масштаб зерна
  const aoR = Math.max(2, Math.round(sc * 0.06));
  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const i = py * bw + px; const a = cov[i];
      if (a <= 0) continue;
      // дрібне зерно: збурення нормалі шумом
      const gf = 0.32 + fr * 0.3, gx = px * gs * gf, gy = py * gs * gf;
      const n1 = noise(gx, gy, seed) - 0.5, n2 = noise(gx + 31.7, gy - 12.3, seed) - 0.5;
      const amp = 0.3 + fr * 0.55;
      let nx = nxA[i] + n1 * amp, ny = nyA[i] + n2 * amp, nz = nzA[i] + 0.15;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      // затінення западин (AO): наскільки точка глибша за сусідів
      let s = 0, cnt = 0;
      for (const [ox, oy] of [[aoR, 0], [-aoR, 0], [0, aoR], [0, -aoR], [aoR, aoR], [-aoR, -aoR]]) {
        const xx = px + ox, yy = py + oy; if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
        const j = yy * bw + xx; if (cov[j] <= 0) continue; s += zb[j] - zb[i]; cnt++;
      }
      const ao = cnt ? clamp(1 - Math.max(0, s / cnt) / (sc * 0.09), 0.45, 1) : 1;
      const ndl = nx * Lx + ny * Ly + nz * Lz;
      const diff = clamp((ndl + 0.45) / 1.45, 0, 1);         // «обгорнуте» світло — тканина напівпрозора
      const spec = Math.pow(Math.max(0, nx * Hx + ny * Hy + nz * Hz), 38) * gloss;
      const rim = Math.pow(1 - clamp(nz, 0, 1), 3);
      // колір: варіація горбків, позеленіння на верхівці, побуріння знизу й плямами
      const k = kA[i], h = hA[i];
      let c = mix(base, shade(base, k > 0.5 ? 0.1 : -0.08), Math.abs(k - 0.5) * 1.6);
      const gm = green * clamp(0.35 + h * 1.1 + (noise(px * gs * 0.05, py * gs * 0.05, seed + 3) - 0.5), 0, 1);
      if (gm > 0) c = mix(c, greenC, gm);
      if (brown > 0) {
        const bn = fbm(px * gs * 0.045, py * gs * 0.045, seed + 11, 3) + (0.45 - h) * 0.8;
        const bm = smooth(1.05 - brown * 0.95, 1.2 - brown * 0.95, bn);
        if (bm > 0) c = mix(c, brown > 0.75 && bm > 0.8 ? deadC : brownC, bm * clamp(brown * 1.3, 0, 1));
      }
      const lit = (0.42 + 0.68 * diff) * ao;
      let r = c[0] * lit, g = c[1] * lit, b = c[2] * lit;
      // підповерхневе розсіювання: тепле світіння на краях
      r += rim * 38; g += rim * 34; b += rim * 22;
      r += spec * 255; g += spec * 255; b += spec * 245;
      D[i * 4] = clamp(r, 0, 255); D[i * 4 + 1] = clamp(g, 0, 255); D[i * 4 + 2] = clamp(b, 0, 255); D[i * 4 + 3] = 255 * a;
    }
  }
  cx.putImageData(img, 0, 0);
  // бруньки (органогенез) і корінці (ризогенез) поверх калюсу
  if (o.buds > 0.05 || o.roots > 0.05) {
    cx.save(); cx.scale(dpr, dpr);
    const R = rng(seed + 77);
    const top = nods.slice().sort((p, q2) => q2.z - p.z);
    const nb = Math.round(o.buds * 5);
    for (let i = 0; i < nb && i < top.length; i++) {
      const nd = top[i * 3 % top.length];
      const bx = ax + nd.x * S, by = ay + nd.y * S * 0.9 * se - nd.z * S * 0.95 * tall * ce - nd.r * S * 0.6;
      const L = S * (0.18 + R() * 0.12) * (0.5 + o.buds * 0.6);
      for (const s of [-1, 1]) {
        cx.save(); cx.translate(bx, by); cx.rotate(-Math.PI / 2 + s * (0.35 + R() * 0.3));
        const g = cx.createLinearGradient(0, -L * 0.3, 0, L * 0.3); g.addColorStop(0, '#9CCF63'); g.addColorStop(1, '#3E7F2B');
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(0, 0); cx.bezierCurveTo(L * 0.3, -L * 0.32, L * 0.8, -L * 0.22, L, 0); cx.bezierCurveTo(L * 0.8, L * 0.2, L * 0.3, L * 0.28, 0, 0); cx.fill();
        cx.fillStyle = 'rgba(255,255,255,.25)'; cx.beginPath(); cx.ellipse(L * 0.45, -L * 0.08, L * 0.22, L * 0.05, 0, 0, TAU); cx.fill();
        cx.restore();
      }
    }
    const nr = Math.round(o.roots * 6);
    for (let i = 0; i < nr; i++) {
      const nd = nods[(i * 17 + 3) % nods.length];
      let x = ax + nd.x * S * 0.9, y = ay - nd.z * S * 0.3, a = (nd.x < 0 ? Math.PI * 0.85 : Math.PI * 0.15) + (R() - 0.5) * 0.5;
      const L = S * (0.4 + R() * 0.5) * o.roots;
      cx.strokeStyle = 'rgba(250,246,232,.95)'; cx.lineWidth = Math.max(1, S * 0.035); cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { a += (R() - 0.5) * 0.35 + 0.08; x += Math.cos(a) * L / 6; y += Math.sin(a) * L / 6; cx.lineTo(x, y); }
      cx.stroke(); cx.strokeStyle = 'rgba(150,130,90,.35)'; cx.lineWidth = 0.6; cx.stroke();
    }
    cx.restore();
  }
  const res = { c: out, w: W, h: H, ax, ay };
  cachePut(key, res);
  return res;
}

/** Малює калюс з контактною тінню; (cx, by) — центр основи. */
export function drawCallus(ctx, cx, by, size, o = {}) {
  if (size < 2) return;
  const sp = callusSprite(size, o);
  shadow(ctx, cx + size * 0.12, by + size * 0.05, size * 1.05, size * 0.22, 0.32);
  ctx.drawImage(sp.c, cx - sp.ax, by - sp.ay, sp.w, sp.h);
}

/* ======================================================================
   Скло: пеніциліновий флакон
   ====================================================================== */
export function glassShine(ctx, x, y, w, h, k = 1) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, `rgba(40,70,60,${0.32 * k})`); g.addColorStop(0.07, `rgba(255,255,255,${0.06 * k})`);
  g.addColorStop(0.15, `rgba(255,255,255,${0.7 * k})`); g.addColorStop(0.22, `rgba(255,255,255,${0.1 * k})`);
  g.addColorStop(0.72, 'rgba(255,255,255,0)'); g.addColorStop(0.85, `rgba(255,255,255,${0.3 * k})`);
  g.addColorStop(0.9, `rgba(255,255,255,${0.05 * k})`); g.addColorStop(1, `rgba(40,70,60,${0.36 * k})`);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

/** Агаризоване середовище в посудині (вже обрізано). top — поверхня. */
export function agarFill(ctx, x, top, w, bottom, { color = MAT.agar, brown = 0, alpha = 0.92 } = {}) {
  let c = hex(color); if (brown > 0) c = mix(c, [176, 132, 70], clamp(brown, 0, 1));
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, rgba(shade(c, -0.3), alpha)); g.addColorStop(0.22, rgba(shade(c, 0.14), alpha * 0.9));
  g.addColorStop(0.6, rgba(c, alpha * 0.86)); g.addColorStop(1, rgba(shade(c, -0.34), alpha));
  ctx.fillStyle = g; ctx.fillRect(x, top, w, bottom - top);
  const d = ctx.createLinearGradient(0, top, 0, bottom); d.addColorStop(0, 'rgba(255,255,255,.12)'); d.addColorStop(1, 'rgba(70,55,20,.2)');
  ctx.fillStyle = d; ctx.fillRect(x, top, w, bottom - top);
}

/**
 * Пеніциліновий флакон (≈ 10 мл): x, y — верхній лівий кут, w×h. contents(ctx, {cx, surf, w, rx, ry}) малює
 * вміст на поверхні агару (еліпс поверхні rx×ry). label — підпис під флаконом.
 */
export function vial(ctx, x, y, w, h, { level = 0.32, agar = MAT.agar, agarBrown = 0, contents = null, label = '', cap = 'foil', highlight = false } = {}) {
  const neckW = w * 0.56, neckH = h * 0.12, shoulder = h * 0.1, r = w * 0.12;
  const body = y + neckH + shoulder, bot = y + h, cxm = x + w / 2;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(cxm - neckW / 2, y + 2); ctx.lineTo(cxm - neckW / 2, y + neckH);
    ctx.bezierCurveTo(cxm - neckW / 2, y + neckH + shoulder * 0.6, x, y + neckH + shoulder * 0.35, x, body);
    ctx.lineTo(x, bot - r); ctx.quadraticCurveTo(x, bot, x + r, bot); ctx.lineTo(x + w - r, bot); ctx.quadraticCurveTo(x + w, bot, x + w, bot - r);
    ctx.lineTo(x + w, body); ctx.bezierCurveTo(x + w, y + neckH + shoulder * 0.35, cxm + neckW / 2, y + neckH + shoulder * 0.6, cxm + neckW / 2, y + neckH);
    ctx.lineTo(cxm + neckW / 2, y + 2);
  };
  shadow(ctx, cxm + w * 0.1, bot + 1, w * 0.68, w * 0.12, 0.3);
  if (highlight) { ctx.save(); outline(); ctx.closePath(); ctx.shadowColor = 'rgba(230,180,40,.9)'; ctx.shadowBlur = 14; ctx.strokeStyle = 'rgba(230,180,40,.9)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
  ctx.save(); outline(); ctx.closePath(); ctx.fillStyle = 'rgba(222,238,233,.30)'; ctx.fill(); ctx.clip();
  // задня стінка: холодний відблиск
  const bg = ctx.createLinearGradient(0, y, 0, bot); bg.addColorStop(0, 'rgba(255,255,255,.12)'); bg.addColorStop(1, 'rgba(160,190,180,.12)'); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  const surf = bot - (bot - body) * level * 1.0 - 2, ry = Math.max(2, w * 0.09), rx = w / 2 - 1.5;
  agarFill(ctx, x, surf, w, bot, { color: agar, brown: agarBrown });
  // поверхня агару (еліпс) — світліша
  let ac = hex(agar); if (agarBrown) ac = mix(ac, [176, 132, 70], agarBrown);
  const sg = ctx.createLinearGradient(x, surf - ry, x + w, surf + ry);
  sg.addColorStop(0, rgba(shade(ac, 0.3), 0.95)); sg.addColorStop(1, rgba(shade(ac, -0.05), 0.95));
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cxm, surf, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,248,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cxm, surf, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  if (contents) contents(ctx, { cx: cxm, surf, w, rx, ry, top: body, x, y, h });
  glassShine(ctx, x, y, w, h, 0.95);
  // вертикальний блік на плечі
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x + w * 0.24, body - shoulder * 0.1, w * 0.05, shoulder * 0.45, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save(); outline(); ctx.strokeStyle = 'rgba(60,92,82,.6)'; ctx.lineWidth = 1.1; ctx.stroke();
  // товсте дно
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + r, bot - 3); ctx.lineTo(x + w - r, bot - 3); ctx.stroke();
  ctx.restore();
  // капа з фольги / парафільм
  const cw = neckW + 6, ch = neckH * 1.15 + 4, cy0 = y - 3;
  if (cap === 'foil') {
    const g = ctx.createLinearGradient(cxm - cw / 2, 0, cxm + cw / 2, 0);
    g.addColorStop(0, '#7D878B'); g.addColorStop(0.18, '#F3F5F6'); g.addColorStop(0.4, '#AEB6BA'); g.addColorStop(0.62, '#E6EAEC'); g.addColorStop(1, '#6E787C');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cxm - cw / 2, cy0 + 3);
    ctx.quadraticCurveTo(cxm, cy0 - 5, cxm + cw / 2, cy0 + 3);
    for (let i = 0; i <= 10; i++) ctx.lineTo(cxm + cw / 2 - cw * i / 10, cy0 + ch + (i % 2 ? 2 : -1.5));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 0.8;
    for (const f of [0.28, 0.55]) { ctx.beginPath(); ctx.moveTo(cxm - cw / 2 + cw * f, cy0 + 1); ctx.lineTo(cxm - cw / 2 + cw * f + 2, cy0 + ch - 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(40,50,55,.35)'; ctx.beginPath(); ctx.moveTo(cxm - cw / 2 + 1, cy0 + ch * 0.62); ctx.lineTo(cxm + cw / 2 - 1, cy0 + ch * 0.62); ctx.stroke();
  }
  if (label) tag(ctx, cxm, bot + 16, label, { size: 11 });
  return { cx: cxm, surf, bot, top: y };
}

/** Підпис із напівпрозорою підкладкою (не губиться на будь-якому тлі). */
export function tag(ctx, x, y, text, { size = 11, weight = 700, color = '#173322', bg = 'rgba(255,255,255,.82)', align = 'center', dark = false } = {}) {
  ctx.save(); ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text).width, px = align === 'center' ? x - m / 2 : align === 'right' ? x - m : x;
  if (bg) { ctx.fillStyle = dark ? 'rgba(8,24,16,.72)' : bg; roundRect(ctx, px - 5, y - size - 1, m + 10, size + 7, 6); ctx.fill(); }
  ctx.fillStyle = dark ? '#EEF7F0' : color; ctx.fillText(text, x, y); ctx.restore();
  return m + 10;
}

/* ======================================================================
   Інтер'єри
   ====================================================================== */
/** Камера термостата (темрява, +25 °C): нержавійка, перфорована полиця, тепле тьмяне світло від відчинених дверей. */
export function thermostat(ctx, w, h, { horizon = 0.7 } = {}) {
  const hy = Math.round(h * horizon);
  const g = ctx.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, '#2B3236'); g.addColorStop(1, '#4A5257'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy);
  // бічні стінки в перспективі
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.07, h * 0.08); ctx.lineTo(w * 0.07, hy); ctx.lineTo(0, hy + 8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w * 0.93, h * 0.08); ctx.lineTo(w * 0.93, hy); ctx.lineTo(w, hy + 8); ctx.closePath(); ctx.fill();
  // шліфування нержавійки
  ctx.globalAlpha = 0.07; ctx.strokeStyle = '#fff';
  for (let i = 0; i < 60; i++) { const x = (i / 60) * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 3, hy); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // світло з дверцят
  const r = ctx.createRadialGradient(w * 0.35, hy * 0.2, 10, w * 0.35, hy * 0.2, w * 0.8);
  r.addColorStop(0, 'rgba(255,236,200,.28)'); r.addColorStop(1, 'rgba(255,236,200,0)'); ctx.fillStyle = r; ctx.fillRect(0, 0, w, hy);
  // полиця
  const t = ctx.createLinearGradient(0, hy, 0, h); t.addColorStop(0, '#9AA3A7'); t.addColorStop(1, '#5D666A'); ctx.fillStyle = t; ctx.fillRect(0, hy, w, h - hy);
  ctx.fillStyle = 'rgba(30,36,40,.35)';
  for (let y = hy + 6, row = 0; y < h; y += 8 + row * 0.6, row++) for (let x = (row % 2) * 6 + 4; x < w; x += 12) { ctx.beginPath(); ctx.ellipse(x, y, 2.4, 1.1 + row * 0.08, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, hy, w, 1.2);
  // віньєтка
  const v = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  applyGrain(ctx, 0, 0, w, h, 0.05);
  return hy;
}

/* ======================================================================
   Модель росту калюсу (S-крива)
   ======================================================================
   Посібник (с. 63–64) описує п'ять фаз ростової кривої — лаг, експоненційну (логарифмічну), лінійну,
   уповільненого росту, стаціонарну — і наступну деградацію, але не дає рівнянь. Тому використано
   механістичне наближення (сира маса W, мг; сахароза S, мг у флаконі; мертва маса Wd, мг):
     dW/dt  = μmax·A(t)·f(S)·W·Wc/(W + Wc) − kd·W
     dS/dt  = −(1/Y)·μmax·A(t)·f(S)·W·Wc/(W + Wc) − ms·W
     dWd/dt = kd·W − kdry·Wd
   A(t) = (t/λ)³ / (1 + (t/λ)³) — адаптація клітин у лаг-фазі; f(S) = S/(Ks + S) — забезпеченість цукром;
   множник Wc/(W + Wc): поки калюс малий, діляться майже всі клітини (експонента), а коли великий —
   лише шар біля агару й на поверхні, тож приріст за добу стає сталим (лінійна фаза);
   kd = kd0 + kd1·(1 − f(S))² — відмирання зростає, коли цукор вичерпано (уповільнення → плато → деградація).
   Сахароза: 20 г/л (с. 67, 71) × 8 мл середовища у флаконі = 160 мг.
*/
export function simulate(p, days, dt = 0.05) {
  const mu = p.mu, lam = Math.max(0.5, p.lag), Wc = p.Wc ?? 220, Y = p.Y ?? 9, ms = p.ms ?? 0.005, Ks = p.Ks ?? 12;
  const kd0 = p.kd0 ?? 0.004, kd1 = p.kd1 ?? 0.03, kdry = p.kdry ?? 0.015, S0 = p.S0 ?? 160;
  const delta = p.delta ?? 0.6, m0 = p.m0 ?? 0.3; // частка приросту за рахунок поділу; маса клітини, мкг
  let W = p.W0, S = S0, Wd = p.Wd0 || 0, t = 0;
  let Nc = (W * 1000) / m0; // кількість клітин (W у мг → мкг)
  const out = { t: [0], W: [W + Wd], live: [W], S: [S], dead: [Wd], rate: [0], N: [Nc], mc: [m0] };
  const steps = Math.round(days / dt), every = Math.max(1, Math.round(0.25 / dt));
  for (let i = 1; i <= steps; i++) {
    const A = Math.pow(t / lam, 3) / (1 + Math.pow(t / lam, 3));
    const f = S / (Ks + S);
    const G = mu * A * f * W * Wc / (W + Wc);
    const kd = kd0 + kd1 * Math.pow(1 - f, 2) + (p.tox || 0);
    const dW = G - kd * W, dS = -G / Y - ms * W, dD = kd * W - kdry * Wd;
    const mc = (W * 1000) / Math.max(1, Nc);
    const dN = (delta * G * 1000) / mc - kd * Nc;
    W = Math.max(0.01, W + dW * dt); S = Math.max(0, S + dS * dt); Wd = Math.max(0, Wd + dD * dt); Nc = Math.max(1, Nc + dN * dt); t += dt;
    if (i % every === 0 || i === steps) {
      out.t.push(t); out.W.push(W + Wd); out.live.push(W); out.S.push(S); out.dead.push(Wd); out.N.push(Nc); out.mc.push((W * 1000) / Nc);
      const k = out.W.length - 1; out.rate.push((out.W[k] - out.W[k - 1]) / (out.t[k] - out.t[k - 1]));
    }
  }
  return out;
}

/** Значення ряду в момент t (лінійна інтерполяція). */
export function at(sim, key, t) {
  const T = sim.t, A = sim[key];
  if (t <= T[0]) return A[0];
  if (t >= T[T.length - 1]) return A[A.length - 1];
  let lo = 0, hi = T.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
  const k = (t - T[lo]) / (T[hi] - T[lo]);
  return A[lo] + k * (A[hi] - A[lo]);
}

export const PHASES = [
  { id: 'lag', name: 'Лаг-фаза', short: 'Лаг', color: 'rgba(120,130,140,.13)' },
  { id: 'exp', name: 'Експоненційна', short: 'Експ.', color: 'rgba(46,125,91,.13)' },
  { id: 'lin', name: 'Лінійна', short: 'Лін.', color: 'rgba(46,125,91,.22)' },
  { id: 'dec', name: 'Уповільнення росту', short: 'Упов.', color: 'rgba(200,160,40,.16)' },
  { id: 'sta', name: 'Стаціонарна', short: 'Стац.', color: 'rgba(200,160,40,.28)' },
  { id: 'deg', name: 'Деградація', short: 'Дегр.', color: 'rgba(160,80,40,.2)' },
];
/**
 * Межі фаз за розрахованою кривою. Лаг — класичне визначення: перетин дотичної до ln W у точці
 * максимальної питомої швидкості з рівнем ln W0. Лінійна — доки абсолютна швидкість ≥ 85 % максимуму;
 * стаціонарна — |dW/dt| < 6 % максимуму; деградація — спад маси.
 */
export function phases(sim) {
  const T = sim.t, W = sim.W, n = T.length;
  let mu = -1, im = 1;
  for (let i = 1; i < n - 1; i++) { const m = (Math.log(W[i + 1]) - Math.log(W[i - 1])) / (T[i + 1] - T[i - 1]); if (m > mu) { mu = m; im = i; } }
  const lag = clamp(T[im] - (Math.log(W[im]) - Math.log(W[0])) / Math.max(1e-6, mu), 0, T[n - 1]);
  const R = sim.rate; let rmax = 0, ir = 1;
  for (let i = 1; i < n; i++) if (R[i] > rmax) { rmax = R[i]; ir = i; }
  let l0 = ir, l1 = ir;
  while (l0 > 1 && R[l0 - 1] >= 0.85 * rmax) l0--;
  while (l1 < n - 1 && R[l1 + 1] >= 0.85 * rmax) l1++;
  let s0 = n - 1; for (let i = l1; i < n; i++) if (R[i] < 0.06 * rmax) { s0 = i; break; }
  let d0 = n - 1; for (let i = s0; i < n; i++) if (R[i] < -0.06 * rmax) { d0 = i; break; }
  const b = [0, lag, Math.max(lag, T[l0]), T[l1], T[s0], T[d0], T[n - 1]];
  for (let i = 1; i < b.length; i++) b[i] = Math.max(b[i], b[i - 1]);
  const bands = PHASES.map((p, i) => ({ ...p, a: b[i], b: b[i + 1] })).filter((x) => x.b - x.a > 0.2);
  return { bands, lag, mu, rmax };
}
export function phaseAt(ph, t) { for (const b of ph.bands) if (t >= b.a && t <= b.b) return b; return ph.bands[ph.bands.length - 1]; }

/* ======================================================================
   Графік зі смугами фаз
   ====================================================================== */
export class BandPlot extends Plot {
  constructor(host, o) { super(host, o); this.bands = []; }
  setBands(b) { this.bands = b || []; this.draw(); }
  draw() {
    super.draw();
    if (!this.d || !this.bands || !this.bands.length || !this.w) return;
    const ctx = this.ctx, m = this.m, ph = this.h - m.t - m.b, pw = this.w - m.l - m.r;
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
    ctx.globalCompositeOperation = 'destination-over';
    for (const b of this.bands) { const x0 = this.X(b.a), x1 = this.X(b.b); ctx.fillStyle = b.color; ctx.fillRect(x0, m.t, x1 - x0, ph); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '700 10.5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const b of this.bands) {
      const x0 = this.X(b.a), x1 = this.X(b.b), wd = x1 - x0;
      const txt = ctx.measureText(b.name).width + 6 < wd ? b.name : ctx.measureText(b.short).width + 4 < wd ? b.short : '';
      if (!txt) continue;
      ctx.fillStyle = 'rgba(255,255,255,.75)'; const tw = ctx.measureText(txt).width; ctx.fillRect((x0 + x1) / 2 - tw / 2 - 2, m.t + 2, tw + 4, 13);
      ctx.fillStyle = '#4A5A50'; ctx.fillText(txt, (x0 + x1) / 2, m.t + 3);
    }
    ctx.restore();
  }
}

/* ======================================================================
   Інтерфейс: вкладки, показники
   ====================================================================== */
export function tabs(root) {
  const btns = [...root.querySelectorAll('[role="tab"]')];
  const show = (b) => {
    btns.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; });
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => show(b));
    b.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length; show(btns[j]); btns[j].focus(); });
  });
  show(btns.find((b) => b.getAttribute('aria-selected') === 'true') || btns[0]);
}

/** Блок показників .ag-reads: spec [[id, label]]; повертає set(id, value, cls). */
export function reads(root, spec) {
  const els = {};
  for (const [id, label] of spec) {
    const d = document.createElement('div'); d.className = 'ag-read';
    d.innerHTML = `<small>${label}</small><b>—</b>`; root.append(d); els[id] = d.querySelector('b');
  }
  return (id, v, cls = '') => { const b = els[id]; if (!b) return; b.innerHTML = v; b.className = cls; };
}

/** Простий селект із підписом (≥ 40 px). */
export function select(root, label, options, value, onChange, id) {
  const wrap = document.createElement('div'); wrap.className = 'ctrl agx-sel';
  const lab = document.createElement('label'); lab.htmlFor = id; lab.innerHTML = `<span>${label}</span>`;
  const s = document.createElement('select'); s.id = id;
  for (const [v, t] of options) { const o = document.createElement('option'); o.value = v; o.textContent = t; s.append(o); }
  s.value = value; s.addEventListener('change', () => onChange(s.value));
  wrap.append(lab, s); root.append(wrap);
  return s;
}

export function checkbox(root, label, value, onChange, id) {
  const l = document.createElement('label'); l.className = 'agx-check';
  l.innerHTML = `<input type="checkbox" id="${id}"${value ? ' checked' : ''}><span>${label}</span>`;
  l.querySelector('input').addEventListener('change', (e) => onChange(e.target.checked));
  root.append(l);
  return l.querySelector('input');
}

export function fmtMg(v) { return v >= 1000 ? fnum(v / 1000, 2) + ' г' : fnum(v, 0) + ' мг'; }
export { fnum, clamp, lerp, smooth, rng, TAU, hex, rgba, mix, shade };
