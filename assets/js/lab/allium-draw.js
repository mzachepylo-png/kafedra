// Малювання для моделі «Allium cepa тест»: цибулини з корінцями в пробірках, давлений препарат меристеми під мікроскопом,
// анімація поділу однієї клітини (норма й аберації).
import { rand } from './allium-model.js';

const TAU2 = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Полотно з урахуванням щільності пікселів. */
export function hiDPI(canvas, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, dpr };
}

/** Текстура шуму (зернистість цитоплазми, хроматину, лусок). */
function noiseTex(size, seed, { dots = 1400, rMin = 0.3, rMax = 1.3, alpha = 0.2, color = '0,0,0' } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), R = rand(seed);
  for (let i = 0; i < dots; i++) {
    g.fillStyle = `rgba(${color},${alpha * (0.3 + 0.7 * R())})`;
    g.beginPath(); g.arc(R() * size, R() * size, rMin + R() * (rMax - rMin), 0, TAU2); g.fill();
  }
  return c;
}

// =====================================================================================
//  Пробірки з цибулинами
// =====================================================================================
const bulbCache = new Map();
/** Спрайт цибулини (сухі луски, жилки, відблиск, денце). w — ширина, висота ≈ 1,02·w. */
function bulbSprite(w, seed) {
  const h = Math.round(w * 1.02), key = `${w}:${seed}`;
  if (bulbCache.has(key)) return bulbCache.get(key);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const R = rand(seed), cx = w / 2, bot = h - 3, top = 1, rw = w * 0.48;
  const shape = () => {
    g.beginPath();
    g.moveTo(cx - rw * 0.4, bot);
    g.bezierCurveTo(cx - rw * 1.04, bot - h * 0.02, cx - rw * 1.08, bot - h * 0.56, cx - rw * 0.34, bot - h * 0.8);
    g.bezierCurveTo(cx - rw * 0.14, bot - h * 0.88, cx - rw * 0.07, top + h * 0.06, cx - rw * 0.02, top);
    g.lineTo(cx + rw * 0.06, top + 1);
    g.bezierCurveTo(cx + rw * 0.1, top + h * 0.07, cx + rw * 0.18, bot - h * 0.88, cx + rw * 0.36, bot - h * 0.8);
    g.bezierCurveTo(cx + rw * 1.08, bot - h * 0.56, cx + rw * 1.04, bot - h * 0.02, cx + rw * 0.4, bot);
    g.closePath();
  };
  shape();
  const grd = g.createRadialGradient(cx - rw * 0.32, bot - h * 0.5, rw * 0.08, cx + rw * 0.1, bot - h * 0.38, rw * 1.2);
  grd.addColorStop(0, '#F0C47A'); grd.addColorStop(0.4, '#D49445'); grd.addColorStop(0.78, '#A1612A'); grd.addColorStop(1, '#6A3B16');
  g.fillStyle = grd; g.fill();
  g.save(); shape(); g.clip();
  for (let i = 0; i < 34; i++) {
    const f = (i / 33) * 2 - 1, x0 = cx + f * rw * 0.4;
    g.strokeStyle = `rgba(${R() < 0.55 ? '96,52,18' : '250,214,150'},${0.1 + R() * 0.22})`;
    g.lineWidth = 0.4 + R() * 1.1;
    g.beginPath(); g.moveTo(x0, bot + 2);
    g.bezierCurveTo(cx + f * rw * 1.3, bot - h * 0.18, cx + f * rw * 1.0, bot - h * 0.66, cx + f * rw * 0.05, top + h * 0.04);
    g.stroke();
  }
  const hl = g.createLinearGradient(cx - rw, 0, cx + rw, 0);
  hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.24, 'rgba(255,238,200,.38)'); hl.addColorStop(0.4, 'rgba(255,255,255,0)');
  hl.addColorStop(0.78, 'rgba(40,20,5,0)'); hl.addColorStop(1, 'rgba(40,20,5,.4)');
  g.fillStyle = hl; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = g.createPattern(noiseTex(96, seed + 7, { dots: 1100, alpha: 0.2, color: '90,45,12' }), 'repeat');
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  // відшарований край сухої луски і темна шийка
  g.fillStyle = 'rgba(240,200,135,.4)';
  g.beginPath(); g.moveTo(cx + rw * 0.25, bot - h * 0.22); g.quadraticCurveTo(cx + rw * 0.95, bot - h * 0.36, cx + rw * 0.7, bot - h * 0.08); g.closePath(); g.fill();
  g.fillStyle = 'rgba(70,38,12,.5)'; g.fillRect(cx - rw * 0.12, top, rw * 0.24, h * 0.12);
  g.restore();
  const pg = g.createLinearGradient(0, bot - 7, 0, bot + 2);
  pg.addColorStop(0, '#E2CFA5'); pg.addColorStop(1, '#B89C6E');
  g.fillStyle = pg; g.beginPath(); g.ellipse(cx, bot - 1.5, rw * 0.44, 4, 0, 0, TAU2); g.fill();
  const sprite = { c, w, h };
  if (bulbCache.size > 40) bulbCache.clear();
  bulbCache.set(key, sprite);
  return sprite;
}

/** Корінь: звужена напівпрозора біла трубка з тінню, відблиском і кореневим чохликом. */
function drawRoot(ctx, pts, w0, tipCol, tumor) {
  const n = pts.length;
  const layer = (wf, col, dx) => {
    ctx.strokeStyle = col;
    for (let i = 0; i < n - 1; i++) {
      const f = i / (n - 1);
      ctx.lineWidth = Math.max(0.6, lerp(w0, w0 * 0.62, f) * wf + (tumor && f > 0.85 ? tumor * w0 * 1.4 * (f - 0.85) / 0.15 * wf : 0));
      ctx.beginPath(); ctx.moveTo(pts[i][0] + dx, pts[i][1]); ctx.lineTo(pts[i + 1][0] + dx, pts[i + 1][1]); ctx.stroke();
    }
  };
  layer(1.25, 'rgba(150,140,110,.35)', 0.6);
  layer(1, 'rgba(240,236,220,.96)', 0);
  layer(0.42, 'rgba(255,255,255,.85)', -w0 * 0.2);
  const [x, y] = pts[n - 1], [px, py] = pts[n - 2];
  const a = Math.atan2(y - py, x - px), r = w0 * 0.42 * (1 + 1.5 * tumor);
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const tg = ctx.createLinearGradient(-r * 3, 0, r * 1.2, 0);
  tg.addColorStop(0, 'rgba(255,255,250,0)'); tg.addColorStop(0.55, tipCol); tg.addColorStop(1, 'rgba(215,200,150,.55)');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(-r * 0.8, 0, r * 2.2, r * 1.05, 0, 0, TAU2); ctx.fill();
  ctx.restore();
}

/**
 * Сцена з кількома пробірками. tubes: [{res, label, sub}] — результати моделі для кожної пробірки.
 * t — час експозиції, год; sway — фаза коливання корінців.
 */
export function drawTubes(ctx, w, h, tubes, { t = 0, sway = 0, maxLen = 60, tint = [] } = {}) {
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#EEF3EE'); bg.addColorStop(0.8, '#DDE6DD'); bg.addColorStop(0.801, '#CDBF9F'); bg.addColorStop(1, '#AE9F80');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const bench = h * 0.8, n = tubes.length, slot = (w - 34) / n;
  const tw = Math.min(slot * 0.5, 88), bw = Math.min(slot * 0.78, tw * 1.45);
  const rim = Math.max(bw * 0.98 + 10, h * 0.25), th = bench - rim;
  const pxmm = (th - 14) / maxLen;
  tubes.forEach((tb, i) => {
    const cx = 34 + slot * (i + 0.5), x0 = cx - tw / 2;
    const res = tb.res, R = rand(1000 + i * 17);
    const sh = ctx.createRadialGradient(cx, bench + 5, 2, cx, bench + 5, tw);
    sh.addColorStop(0, 'rgba(60,50,30,.38)'); sh.addColorStop(1, 'rgba(60,50,30,0)');
    ctx.fillStyle = sh; ctx.fillRect(cx - tw, bench - 4, tw * 2, 20);
    // розчин до самих вінців: денце цибулини торкається рідини (схема за Fiskesjö)
    const liqTop = rim + 3;
    ctx.fillStyle = tint[i] || 'rgba(215,232,240,.32)';
    ctx.fillRect(x0 + 2, liqTop, tw - 4, bench - liqTop - 2);
    ctx.save(); ctx.beginPath(); ctx.rect(x0 + 3, rim - 6, tw - 6, bench - rim + 2); ctx.clip();
    const L = res.len, nr = Math.min(18, Math.round(res.roots * 0.8));
    const tipCol = res.brown > 0.05 ? `rgb(${Math.round(lerp(248, 150, res.brown))},${Math.round(lerp(240, 100, res.brown))},${Math.round(lerp(212, 55, res.brown))})` : 'rgba(250,244,220,.95)';
    ctx.lineCap = 'round';
    const order = Array.from({ length: nr }, (_, k) => k).sort(() => R() - 0.5);
    for (const k of order) {
      const u = (k + 0.2 + R() * 0.6) / nr, sx = cx + (u - 0.5) * tw * 0.5, sy = rim - 2;
      const li = Math.max(4, L * (0.7 + 0.45 * R()) * pxmm);
      const spread = (u - 0.5) * 1.1 + (R() - 0.5) * 0.3;
      const seg = Math.max(5, Math.round(li / 9)), pts = [];
      const hook = res.tumor > 0.2 && R() < res.tumor ? (R() < 0.5 ? -1 : 1) * res.tumor : 0;
      for (let s2 = 0; s2 <= seg; s2++) {
        const f = s2 / seg, yy = sy + f * li;
        let xx = sx + Math.sin(f * 1.3) * spread * Math.min(li, tw * 1.2) * 0.38 + Math.sin(sway + k * 1.7 + f * 3) * 1.4 * f;
        if (hook && f > 0.78) xx += hook * Math.pow((f - 0.78) / 0.22, 2) * 10;
        pts.push([clamp(xx, x0 + 6, x0 + tw - 6), yy]);
      }
      if (li > 60) {
        ctx.strokeStyle = 'rgba(250,250,240,.45)'; ctx.lineWidth = 0.5;
        for (let q = 1; q < Math.min(seg - 2, 5); q++) { const [hx, hy] = pts[q]; for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + sgn * (2 + R() * 4), hy + 2 + R() * 2); ctx.stroke(); } }
      }
      drawRoot(ctx, pts, 3.4 + R() * 1.1, tipCol, hook ? Math.abs(hook) : res.tumor * 0.4);
    }
    ctx.restore();
    // скло
    ctx.strokeStyle = 'rgba(110,140,150,.6)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x0, rim); ctx.lineTo(x0, bench - 8); ctx.quadraticCurveTo(x0, bench, x0 + 8, bench); ctx.lineTo(x0 + tw - 8, bench); ctx.quadraticCurveTo(x0 + tw, bench, x0 + tw, bench - 8); ctx.lineTo(x0 + tw, rim); ctx.stroke();
    const gl = ctx.createLinearGradient(x0, 0, x0 + tw, 0);
    gl.addColorStop(0, 'rgba(255,255,255,.6)'); gl.addColorStop(0.09, 'rgba(255,255,255,.06)'); gl.addColorStop(0.84, 'rgba(255,255,255,.04)'); gl.addColorStop(0.92, 'rgba(255,255,255,.45)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(x0, rim, tw, bench - rim);
    ctx.fillStyle = 'rgba(215,228,232,.95)'; ctx.beginPath(); ctx.ellipse(cx, rim, tw / 2 + 2, 4.5, 0, 0, TAU2); ctx.fill();
    ctx.strokeStyle = 'rgba(110,140,150,.65)'; ctx.stroke();
    const sp = bulbSprite(Math.round(bw), 77 + i * 13);
    ctx.drawImage(sp.c, cx - bw / 2, rim - sp.h + 5, bw, sp.h);
    const fs = slot < 110 ? 0.86 : 1;
    ctx.textAlign = 'center'; ctx.fillStyle = '#183A22';
    ctx.font = `700 ${12.5 * fs}px system-ui, sans-serif`; ctx.fillText(tb.label, cx, bench + 20);
    ctx.font = `600 ${11 * fs}px system-ui, sans-serif`; ctx.fillStyle = '#4C6152';
    if (tb.sub) ctx.fillText(tb.sub, cx, bench + 34);
    ctx.fillStyle = '#183A22'; ctx.font = '700 11.5px ui-monospace, monospace';
    ctx.fillText(`${(res.len / 10).toFixed(1).replace('.', ',')} см`, cx, bench + (tb.sub ? 49 : 34));
  });
  const rx = 8, top = rim;
  ctx.strokeStyle = 'rgba(24,58,34,.5)'; ctx.fillStyle = 'rgba(24,58,34,.75)'; ctx.font = '600 9.5px system-ui'; ctx.textAlign = 'left'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx, top); ctx.lineTo(rx, top + maxLen * pxmm); ctx.stroke();
  for (let mm = 0; mm <= maxLen; mm += 5) {
    const y = top + mm * pxmm, big = mm % 10 === 0;
    ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx + (big ? 7 : 4), y); ctx.stroke();
    if (big && mm) ctx.fillText(mm / 10 + ' см', rx + 9, y + 3);
  }
  ctx.textAlign = 'right'; ctx.fillStyle = '#183A22'; ctx.font = '700 12px system-ui';
  ctx.fillText(`Експозиція: ${Math.round(t)} год`, w - 10, 16);
}

// =====================================================================================
//  Давлений препарат меристеми (ацетоорсеїн) під мікроскопом
// =====================================================================================
const INK = '#45102F', INK2 = '#5E1A45';

/** Хромосома: вигнутий стрижень з м'якими краями (дві хроматиди при split). */
function chromo(ctx, x, y, len, ang, wd = 2.6, bend = 0, split = 0) {
  const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
  const nx = -Math.sin(ang) * bend, ny = Math.cos(ang) * bend;
  const rod = (ox, oy, lw, col) => {
    ctx.lineWidth = lw; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(x - dx + ox, y - dy + oy); ctx.quadraticCurveTo(x + nx + ox, y + ny + oy, x + dx + ox, y + dy + oy); ctx.stroke();
  };
  rod(0, 0, wd * 1.5, 'rgba(70,15,50,.16)');
  if (split) { const sx = -Math.sin(ang) * wd * 0.42, sy = Math.cos(ang) * wd * 0.42; rod(sx, sy, wd * 0.7, INK); rod(-sx, -sy, wd * 0.7, INK); }
  else rod(0, 0, wd, INK);
  rod(-wd * 0.15, -wd * 0.15, wd * 0.3, 'rgba(200,110,165,.35)');
}
/** Анафазна хромосома: центромера веде до полюса, плечі тягнуться до екватора. */
function vchromo(ctx, x, y, dir, len, spread, wd, R) {
  const arms = [[len * (0.75 + R() * 0.35), -spread * (0.6 + R())], [len * (0.55 + R() * 0.45), spread * (0.6 + R())]];
  for (const [l, sp] of arms) {
    ctx.lineWidth = wd * 1.45; ctx.strokeStyle = 'rgba(70,15,50,.16)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - dir * l * 0.5, y + sp * 0.3 + (R() - 0.5) * 2, x - dir * l, y + sp); ctx.stroke();
    ctx.lineWidth = wd; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - dir * l * 0.5, y + sp * 0.3, x - dir * l, y + sp); ctx.stroke();
  }
}
/** Ядро: градієнт, зернистий хроматин, ядерця (в орсеїні світліші). */
function nucleus(ctx, x, y, rx, ry, R, tex, { pale = 0, nucleoli = 2, pyk = false } = {}) {
  const rot = (R() - 0.5) * 0.6;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU2);
  const g = ctx.createRadialGradient(x - rx * 0.25, y - ry * 0.3, 1, x, y, Math.max(rx, ry) * 1.08);
  if (pyk) { g.addColorStop(0, '#5A1747'); g.addColorStop(1, '#2C0922'); }
  else { g.addColorStop(0, `rgba(${172 - pale * 30},${88 + pale * 50},${142 + pale * 30},.94)`); g.addColorStop(0.75, `rgba(${132 - pale * 10},${52 + pale * 45},${106 + pale * 25},.96)`); g.addColorStop(1, `rgba(${104},${34 + pale * 40},${84 + pale * 20},.98)`); }
  ctx.fillStyle = g; ctx.fill();
  if (!pyk) {
    ctx.clip();
    ctx.globalAlpha = 0.95 - pale * 0.4; ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(tex, (R() * 60) | 0, (R() * 60) | 0, 64, 64, x - rx, y - ry, rx * 2, ry * 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (let i = 0; i < 7; i++) { const a = R() * TAU2, d = 0.3 + R() * 0.6; ctx.fillStyle = `rgba(70,12,52,${0.25 + R() * 0.3})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, 0.8 + R() * 1.6, 0, TAU2); ctx.fill(); }
    for (let i = 0; i < nucleoli; i++) {
      const a = R() * TAU2, d = R() * 0.38, rr = Math.min(rx, ry) * (0.17 + R() * 0.09);
      const ng = ctx.createRadialGradient(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, 0, x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, rr);
      ng.addColorStop(0, 'rgba(232,180,212,.95)'); ng.addColorStop(0.7, 'rgba(210,140,185,.7)'); ng.addColorStop(1, 'rgba(190,110,160,0)');
      ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, rr, 0, TAU2); ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(80,18,60,.45)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU2); ctx.stroke();
}
function spireme(ctx, rx, ry, R, wd, n = 12) {
  ctx.strokeStyle = INK; ctx.lineWidth = wd;
  for (let k = 0; k < n; k++) {
    ctx.beginPath(); let x = (R() - 0.5) * rx * 1.4, y = (R() - 0.5) * ry * 1.4, a = R() * TAU2; ctx.moveTo(x, y);
    for (let q = 0; q < 9; q++) { a += (R() - 0.5) * 2.2; const nx = clamp(x + Math.cos(a) * rx * 0.28, -rx * 0.92, rx * 0.92), ny = clamp(y + Math.sin(a) * ry * 0.28, -ry * 0.9, ry * 0.9); ctx.quadraticCurveTo((x + nx) / 2 + (R() - 0.5) * 3, (y + ny) / 2 + (R() - 0.5) * 3, nx, ny); x = nx; y = ny; }
    ctx.stroke();
  }
}

/** Малює клітину у власних координатах (вісь поділу — x, s — розмір клітини). */
export function drawCellState(ctx, st, s, R, tex, p = 0.5) {
  const rN = s * 0.33, wd = Math.max(1.5, s * 0.045);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (st) {
    case 'I': nucleus(ctx, (R() - 0.5) * s * 0.1, (R() - 0.5) * s * 0.08, rN * (0.88 + R() * 0.22), rN * (0.8 + R() * 0.2), R, tex, { nucleoli: 1 + (R() < 0.45 ? 1 : 0) }); break;
    case 'P': {
      const late = p > 0.5;
      nucleus(ctx, 0, 0, rN * 1.06, rN * 0.98, R, tex, { pale: 0.55, nucleoli: late ? 0 : 1 });
      spireme(ctx, rN, rN * 0.92, R, wd * (late ? 0.9 : 0.55), late ? 11 : 15);
      break;
    }
    case 'M': {
      for (let k = 0; k < 16; k++) chromo(ctx, (R() - 0.5) * s * 0.12, (k / 15 - 0.5) * s * 0.66 + (R() - 0.5) * 3, s * (0.2 + R() * 0.14), (R() - 0.5) * 0.9 + (R() < 0.3 ? Math.PI / 2 : 0), wd, (R() - 0.5) * 4, 1);
      break;
    }
    case 'A': case 'T': {
      const late = st === 'T';
      const d = late ? s * 0.34 : s * (0.1 + 0.16 * p);
      for (const dir of [-1, 1]) {
        if (late) {
          ctx.save();
          ctx.beginPath(); ctx.ellipse(dir * d, 0, s * 0.1, s * 0.3, 0, 0, TAU2);
          const tg = ctx.createRadialGradient(dir * d, 0, 1, dir * d, 0, s * 0.3);
          tg.addColorStop(0, INK2); tg.addColorStop(1, 'rgba(70,15,50,.9)');
          ctx.fillStyle = tg; ctx.fill(); ctx.clip(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.6;
          ctx.drawImage(tex, 0, 0, 64, 64, dir * d - s * 0.11, -s * 0.31, s * 0.22, s * 0.62); ctx.restore();
        } else for (let k = 0; k < 16; k++) vchromo(ctx, dir * (d + (R() - 0.5) * s * 0.03), (k / 15 - 0.5) * s * 0.58, dir, s * (0.13 + R() * 0.07), s * 0.025, wd * 0.85, R);
      }
      if (late) { ctx.strokeStyle = 'rgba(160,100,140,.4)'; ctx.lineWidth = 1.3; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(0, -s * 0.33); ctx.lineTo(0, s * 0.33); ctx.stroke(); ctx.setLineDash([]); }
      break;
    }
    default: break;
  }
}

/** Аберації: малюються замість нормальної фази. */
function drawAberr(ctx, ab, s, R, tex) {
  const wd = Math.max(1.5, s * 0.045);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const groups = (d, n = 15) => { for (const dir of [-1, 1]) for (let k = 0; k < n; k++) vchromo(ctx, dir * (d + (R() - 0.5) * s * 0.03), (k / (n - 1) - 0.5) * s * 0.58, dir, s * (0.13 + R() * 0.07), s * 0.025, wd * 0.85, R); };
  switch (ab) {
    case 'bridge': {
      const late = R() < 0.4, d = late ? s * 0.34 : s * 0.24;
      if (late) drawCellState(ctx, 'T', s, R, tex); else groups(d);
      const nb = R() < 0.3 ? 2 : 1;
      for (let b = 0; b < nb; b++) {
        const y0 = (R() - 0.5) * s * 0.3, y1 = y0 + (R() - 0.5) * s * 0.1;
        ctx.lineWidth = wd * 0.9; ctx.strokeStyle = 'rgba(70,15,50,.2)'; ctx.beginPath(); ctx.moveTo(-d, y0); ctx.quadraticCurveTo(0, (y0 + y1) / 2 + (R() - 0.5) * s * 0.1, d, y1); ctx.stroke();
        ctx.lineWidth = wd * 0.55; ctx.strokeStyle = INK; ctx.stroke();
      }
      break;
    }
    case 'frag': groups(s * 0.26); for (let k = 0; k < 1 + (R() * 2 | 0); k++) chromo(ctx, (R() - 0.5) * s * 0.12, (R() - 0.5) * s * 0.4, s * (0.05 + R() * 0.04), R() * 3, wd); break;
    case 'lag': groups(s * 0.28, 14); chromo(ctx, (R() - 0.5) * s * 0.06, (R() - 0.5) * s * 0.25, s * 0.24, Math.PI / 2 + (R() - 0.5) * 0.7, wd, 3); break;
    case 'vag': groups(s * 0.22, 14); chromo(ctx, (R() < 0.5 ? -1 : 1) * s * 0.42, (R() - 0.5) * s * 0.5, s * 0.2, R() * 3, wd, 2); break;
    case 'sticky': {
      const two = R() < 0.55;
      for (const dir of two ? [-1, 1] : [0]) {
        const cx = dir * s * 0.2, n = 14;
        ctx.save(); ctx.beginPath();
        for (let k = 0; k <= n; k++) { const a = k / n * TAU2, r = s * (two ? 0.12 : 0.17) * (0.72 + R() * 0.5); const x = cx + Math.cos(a) * r * (two ? 0.75 : 0.6), y = Math.sin(a) * r * 1.7; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath();
        const sg = ctx.createRadialGradient(cx, 0, 1, cx, 0, s * 0.3); sg.addColorStop(0, '#3E0D2E'); sg.addColorStop(1, '#2A0820');
        ctx.fillStyle = sg; ctx.fill(); ctx.restore();
      }
      if (two) { ctx.strokeStyle = '#2E0A24'; ctx.lineWidth = wd * 1.2; ctx.beginPath(); ctx.moveTo(-s * 0.12, 0); ctx.quadraticCurveTo(0, (R() - 0.5) * 6, s * 0.12, 0); ctx.stroke(); }
      break;
    }
    case 'cmit': for (let k = 0; k < 16; k++) { const x = (R() - 0.5) * s * 0.66, y = (R() - 0.5) * s * 0.62, a = R() * 3, l = s * (0.13 + R() * 0.08); chromo(ctx, x, y, l, a, wd * 0.95, (R() - 0.5) * 2); chromo(ctx, x, y, l * 0.92, a + 0.35 + R() * 0.3, wd * 0.95, (R() - 0.5) * 2); } break;
    case 'multi': for (let g3 = 0; g3 < 3; g3++) { const a = g3 / 3 * TAU2 + 0.4, gx = Math.cos(a) * s * 0.25, gy = Math.sin(a) * s * 0.25; for (let k = 0; k < 6; k++) vchromo(ctx, gx + (R() - 0.5) * s * 0.08, gy + (R() - 0.5) * s * 0.08, Math.cos(a) >= 0 ? 1 : -1, s * 0.12, s * 0.03, wd * 0.85, R); } break;
    case 'mn': drawCellState(ctx, 'I', s, R, tex); nucleus(ctx, s * (0.33 + R() * 0.04) * (R() < 0.5 ? -1 : 1), s * (R() - 0.5) * 0.36, s * 0.055, s * 0.05, R, tex, { nucleoli: 0 }); break;
    case 'bin': nucleus(ctx, -s * 0.21, 0, s * 0.19, s * 0.22, R, tex); nucleus(ctx, s * 0.21, 0, s * 0.19, s * 0.22, R, tex, { nucleoli: 1 }); break;
    case 'bud': { const rN = s * 0.31; nucleus(ctx, 0, 0, rN, rN * 0.92, R, tex); const a = R() * TAU2; ctx.strokeStyle = INK2; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rN * 0.9, Math.sin(a) * rN * 0.9); ctx.lineTo(Math.cos(a) * rN * 1.3, Math.sin(a) * rN * 1.3); ctx.stroke(); nucleus(ctx, Math.cos(a) * rN * 1.42, Math.sin(a) * rN * 1.42, s * 0.075, s * 0.07, R, tex, { nucleoli: 0 }); break; }
    case 'pyk': nucleus(ctx, (R() - 0.5) * s * 0.1, 0, s * 0.13, s * 0.12, R, tex, { pyk: true }); break;
    default: break;
  }
}

/** Розкладка тканини: файли клітин (квадрилатеральна сітка з шумом), стан кожної клітини. */
export class Slide {
  constructor(size, seed) {
    this.size = size; this.seed = seed;
    const R = rand(seed), cs = 46, cols = Math.ceil(size / cs) + 3, rows = Math.ceil(size / (cs * 1.08)) + 3;
    const P = [];
    for (let r = 0; r <= rows; r++) { P.push([]); for (let c = 0; c <= cols; c++) P[r].push([(c - 1.5) * cs + (R() - 0.5) * cs * 0.32, (r - 1.5) * cs * 1.08 + (R() - 0.5) * cs * 0.26]); }
    this.angle = -0.35 + (R() - 0.5) * 0.3;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle), mid = size / 2;
    const rot = ([x, y]) => [mid + (x - mid) * ca - (y - mid) * sa, mid + (x - mid) * sa + (y - mid) * ca];
    this.cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const poly = [P[r][c], P[r][c + 1], P[r + 1][c + 1], P[r + 1][c]].map(rot);
      const cx = poly.reduce((s, p) => s + p[0], 0) / 4, cy = poly.reduce((s, p) => s + p[1], 0) / 4;
      if (cx < -20 || cy < -20 || cx > size + 20 || cy > size + 20) continue;
      // розірвані ділянки препарату
      const hole = Math.hypot(cx - size * 0.72, cy - size * 0.3) < size * 0.08 || Math.hypot(cx - size * 0.2, cy - size * 0.78) < size * 0.07;
      if (hole && R() < 0.85) continue;
      const shrink = 0.952 + R() * 0.03;
      this.cells.push({ poly: poly.map(([x, y]) => [cx + (x - cx) * shrink, cy + (y - cy) * shrink]), cx, cy, s: cs * shrink, u: R(), v: R(), w: R(), seed: (R() * 1e9) | 0, st: 'I', ab: null });
    }
  }
  /** Призначає стани клітин з результатів моделі (u, v, w — сталі випадкові числа клітини: зміни моделі змінюють стани плавно). */
  assign(res) {
    const mi = res.mi / 100, ph = res.phases;
    const pP = ph.P / 100, pM = ph.M / 100, pA = ph.A / 100;
    const mix = res.mix, atTypes = ['bridge', 'frag', 'lag', 'vag', 'sticky', 'multi'];
    const wsum = atTypes.reduce((s, k) => s + (mix[k] || 0), 0) || 1;
    const lethal = Math.max(0, 1 - res.miRel / 0.35);
    const naExtra = Math.max(0, res.na - 2) / 1000;
    for (const c of this.cells) {
      c.ab = null;
      if (c.u < mi) {
        const f = c.v;
        c.st = f < pP ? 'P' : f < pP + pM ? 'M' : f < pP + pM + pA ? 'A' : 'T';
        if (c.st === 'M' && c.w < res.cm) c.ab = 'cmit';
        else if ((c.st === 'A' || c.st === 'T') && c.w < res.ca / 100) {
          let q = (c.w / (res.ca / 100)) * wsum;
          for (const k of atTypes) { q -= mix[k] || 0; if (q <= 0) { c.ab = k; break; } }
          c.ab = c.ab || 'bridge';
        } else if (c.st === 'M' && c.w > 1 - (res.ca / 100) * (mix.sticky || 0)) c.ab = 'sticky';
      } else {
        c.st = 'I';
        const q = (c.u - mi) / (1 - mi);
        if (q < res.mn / 1000 * 1.6) c.ab = 'mn';
        else if (q < res.mn / 1000 * 1.6 + naExtra * ((mix.bin || 0) + 0.15) * 3) c.ab = 'bin';
        else if (q < res.mn / 1000 * 1.6 + naExtra * ((mix.bin || 0) + (mix.bud || 0) + 0.3) * 3) c.ab = 'bud';
        else if (c.w < lethal * 0.35) c.ab = c.v < 0.5 ? 'pyk' : 'ghost';
      }
    }
  }
  render(canvas) {
    const S = this.size, dpr = 2.2;
    canvas.width = canvas.height = Math.round(S * dpr);
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#EFDCE3'; ctx.fillRect(0, 0, S, S);
    const tex = noiseTex(128, 11, { dots: 3600, alpha: 0.5, color: '55,8,40', rMin: 0.4, rMax: 1.9 });
    const ctex = noiseTex(160, 5, { dots: 1800, alpha: 0.12, color: '150,60,110', rMin: 0.3, rMax: 1.4 });
    const cpat = ctx.createPattern(ctex, 'repeat');
    for (const c of this.cells) {
      const R = rand(c.seed);
      ctx.save();
      ctx.beginPath(); c.poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      const ghost = c.ab === 'ghost';
      ctx.fillStyle = ghost ? 'rgba(246,238,240,.9)' : `rgba(${226 + (R() * 10 | 0)},${190 + (R() * 14 | 0)},${204 + (R() * 10 | 0)},.92)`;
      ctx.fill();
      if (!ghost) { ctx.fillStyle = cpat; ctx.fill(); }
      ctx.strokeStyle = 'rgba(160,90,125,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.clip();
      ctx.translate(c.cx, c.cy); ctx.rotate(this.angle);
      if (c.ab) drawAberr(ctx, c.ab, c.s, R, tex);
      else drawCellState(ctx, c.st, c.s, R, tex, c.w);
      ctx.restore();
    }
    // пил на склі і легка розфокусованість об'єктива (один прохід розмиття для всього препарату)
    const R = rand(this.seed + 3);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(90,40,60,${0.05 + R() * 0.12})`; ctx.beginPath(); ctx.arc(R() * S, R() * S, 0.6 + R() * 2.2, 0, TAU2); ctx.fill(); }
    if ('filter' in ctx) {
      const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
      tmp.getContext('2d').drawImage(canvas, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'blur(0.7px)'; ctx.drawImage(tmp, 0, 0); ctx.filter = 'none';
    }
  }
  hit(x, y) {
    for (const c of this.cells) if (inPoly(x, y, c.poly)) return c;
    return null;
  }
}
function inPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

/** Поле зору: кругла діафрагма, віньєтка, шкала. view: {x, y, z} — центр поля на препараті і збільшення. */
export function drawMicroscope(ctx, w, h, slideCanvas, prevCanvas, fade, view, { highlight = null, marks = [], scaleUm = 20, label = '' } = {}) {
  ctx.fillStyle = '#0B0F0C'; ctx.fillRect(0, 0, w, h);
  const r = Math.min(w, h) / 2 - 6, cx = w / 2, cy = h / 2;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU2); ctx.clip();
  const S = slideCanvas.width / 2.2, k = view.z * (2 * r) / 520;
  const drawSl = (cv, a) => { if (!cv) return; ctx.globalAlpha = a; ctx.drawImage(cv, 0, 0, cv.width, cv.height, cx - view.x * k, cy - view.y * k, S * k, S * k); };
  drawSl(slideCanvas, 1);
  if (prevCanvas && fade < 1) drawSl(prevCanvas, 1 - fade);
  ctx.globalAlpha = 1;
  // виділення клітин
  const toScr = ([x, y]) => [cx + (x - view.x) * k, cy + (y - view.y) * k];
  for (const m of marks) {
    ctx.strokeStyle = m.color; ctx.lineWidth = 2.2; ctx.setLineDash([5, 3]);
    ctx.beginPath(); m.poly.forEach((p, i) => { const [x, y] = toScr(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (highlight) {
    ctx.strokeStyle = '#FFB300'; ctx.lineWidth = 3;
    ctx.beginPath(); highlight.poly.forEach((p, i) => { const [x, y] = toScr(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
  }
  // віньєтка й світло лампи
  const vg = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, r * 0.2, cx, cy, r * 1.02);
  vg.addColorStop(0, 'rgba(255,250,240,.06)'); vg.addColorStop(0.72, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU2); ctx.stroke();
  // шкала: 1 одиниця препарату ≈ 0,4 мкм (клітина меристеми ≈ 18–20 мкм)
  const umPerUnit = 0.42, len = scaleUm / umPerUnit * k;
  const sx = cx + r * 0.62 - len, sy = cy + r * 0.72;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(sx - 8, sy - 16, len + 16, 26);
  ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, len, 3);
  ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${scaleUm} мкм`, sx + len / 2, sy - 4);
  if (label) { ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '700 12px system-ui'; ctx.fillText(label, 12, 20); }
  return { k, r, cx, cy };
}

// =====================================================================================
//  Кінограма: поділ однієї клітини (норма та аберація), t — 0..1 цикл
// =====================================================================================
export function drawCine(ctx, w, h, type, t, seed = 3) {
  ctx.fillStyle = '#F4E9EC'; ctx.fillRect(0, 0, w, h);
  const s = Math.min(w * 0.9, h * 1.25), cx = w / 2, cy = h / 2, R = rand(seed);
  const tex = cineTex || (cineTex = noiseTex(128, 11, { dots: 2600, alpha: 0.32, color: '60,10,45', rMin: 0.4, rMax: 1.6 }));
  // фази в часі: I 0–.1, P .1–.32, M .32–.46, A .46–.66, T .66–.82, цитокінез .82–1
  const cw = s * 0.92, ch = s * 0.6;
  ctx.save(); ctx.translate(cx, cy);
  const wall = (x0, x1) => {
    const g = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2);
    g.addColorStop(0, '#E6C3D0'); g.addColorStop(1, '#DDB5C5');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(150,80,110,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x0, -ch / 2, x1 - x0, ch, 10); ctx.fill(); ctx.stroke();
  };
  wall(-cw / 2, cw / 2);
  const wd = Math.max(2.2, s * 0.022), Lc = s * 0.12;
  ctx.lineCap = 'round';
  const nChr = 12, ys = Array.from({ length: nChr }, (_, k) => (k / (nChr - 1) - 0.5) * ch * 0.72);
  const scatter = ys.map(() => [(R() - 0.5) * cw * 0.6, (R() - 0.5) * ch * 0.62, R() * 3]);
  const multiDir = ys.map((_, k) => k % 3);
  const ph = t < 0.1 ? 'I' : t < 0.32 ? 'P' : t < 0.46 ? 'M' : t < 0.66 ? 'A' : t < 0.82 ? 'T' : 'C';
  const pa = ph === 'A' ? ease((t - 0.46) / 0.2) : ph === 'T' || ph === 'C' ? 1 : 0;
  const cmit = type === 'cmit', sticky = type === 'sticky', multi = type === 'multi';
  let label = { I: 'Інтерфаза', P: 'Профаза', M: 'Метафаза', A: 'Анафаза', T: 'Телофаза', C: 'Цитокінез' }[ph];
  if (ph === 'I' || ph === 'P') {
    const pp = ph === 'P' ? (t - 0.1) / 0.22 : 0;
    nucleus(ctx, 0, 0, s * 0.17, s * 0.15, rand(seed), tex, { pale: pp * 0.6, nucleoli: pp < 0.6 ? 2 : 0 });
    if (ph === 'P') { const Rr = rand(seed + 1); ctx.strokeStyle = INK; ctx.lineWidth = wd * (0.4 + pp * 0.7); for (let k = 0; k < 10; k++) { ctx.beginPath(); let x = (Rr() - 0.5) * s * 0.2, y = (Rr() - 0.5) * s * 0.18; ctx.moveTo(x, y); for (let q = 0; q < 6; q++) { x = clamp(x + (Rr() - 0.5) * s * 0.1, -s * 0.15, s * 0.15); y = clamp(y + (Rr() - 0.5) * s * 0.1, -s * 0.13, s * 0.13); ctx.lineTo(x, y); } ctx.stroke(); } }
  } else if (cmit) {
    // веретена немає: хромосоми розсіяні, потім реституційне ядро (поліплоїдне)
    if (t < 0.8) { const k = smooth(0.32, 0.5, t); ys.forEach((y, i) => { const [sx, sy, a] = scatter[i]; const x = lerp(0, sx, k), yy = lerp(y * 0.4, sy, k); chromo(ctx, x, yy, Lc, a, wd); chromo(ctx, x, yy, Lc * 0.92, a + 0.6, wd); }); label = 'К-мітоз: веретена немає'; }
    else { nucleus(ctx, 0, 0, s * 0.22, s * 0.19, rand(seed), tex); label = 'Реституційне поліплоїдне ядро (4n)'; }
  } else if (sticky && ph !== 'C') {
    const d = lerp(0, cw * 0.26, pa * 0.6);
    for (const dir of ph === 'M' ? [0] : [-1, 1]) { ctx.fillStyle = '#3A0B2C'; ctx.beginPath(); const Rr = rand(seed + 5 + dir); for (let k = 0; k <= 10; k++) { const a = k / 10 * TAU2, r = s * 0.075 * (0.8 + Rr() * 0.4); const x = dir * d + Math.cos(a) * r * 0.8, y = Math.sin(a) * r * 2.4; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); }
    if (ph !== 'M') { ctx.strokeStyle = '#3A0B2C'; ctx.lineWidth = wd * 1.4; ctx.beginPath(); ctx.moveTo(-d, 0); ctx.lineTo(d, 0); ctx.stroke(); }
    label = 'Липкість: хромосоми злиплися в аморфну масу';
  } else {
    // норма, міст, фрагмент, відстаюча, блукаюча, мультиполярна
    const pole = cw * 0.34;
    if (ph === 'M') {
      ctx.strokeStyle = 'rgba(120,120,160,.22)'; ctx.lineWidth = 1;
      for (const y of ys) { for (const dir of [-1, 1]) { ctx.beginPath(); ctx.moveTo(dir * pole * 1.1, 0); ctx.lineTo(0, y); ctx.stroke(); } }
      ys.forEach((y, i) => { if (type === 'frag' && i === 4) { chromo(ctx, s * 0.01, y, Lc * 0.6, Math.PI / 2, wd); chromo(ctx, s * 0.01, y + Lc * 0.55, Lc * 0.35, Math.PI / 2, wd); } else chromo(ctx, 0, y, Lc, Math.PI / 2 + (R() - 0.5) * 0.2, wd); });
    } else if (ph === 'A' || ph === 'T' || ph === 'C') {
      const d = lerp(s * 0.02, pole, pa);
      if (ph === 'A') { ctx.strokeStyle = 'rgba(120,120,160,.2)'; ctx.lineWidth = 1; for (const y of ys) for (const dir of [-1, 1]) { ctx.beginPath(); ctx.moveTo(dir * pole * 1.1, 0); ctx.lineTo(dir * d, y * (1 - pa * 0.35)); ctx.stroke(); } }
      if (ph === 'A') {
        ys.forEach((y, i) => {
          const yy = y * (1 - pa * 0.35);
          if (multi) { const a = [0, 2.1, 4.2][multiDir[i]] + 0.3; const x = Math.cos(a) * d * 0.9, y2 = Math.sin(a) * d * 0.9 + yy * 0.25; vchromo(ctx, x, y2, Math.cos(a) >= 0 ? 1 : -1, Lc * 0.8, s * 0.012, wd, R); return; }
          if (type === 'lag' && i === 6) { chromo(ctx, 0, yy * 0.2, Lc, Math.PI / 2 + 0.3, wd, 2); return; }
          if (type === 'vag' && i === 2) { vchromo(ctx, Math.min(pole * 1.25, d * 1.6), yy, 1, Lc, s * 0.012, wd, R); vchromo(ctx, -d, yy, -1, Lc, s * 0.012, wd, R); return; }
          vchromo(ctx, d, yy, 1, Lc, s * 0.012, wd, R); vchromo(ctx, -d, yy, -1, Lc, s * 0.012, wd, R);
        });
        if (type === 'frag') { chromo(ctx, s * 0.005, ys[4] * 0.5, Lc * 0.35, Math.PI / 2, wd); }
        if (type === 'bridge') { ctx.strokeStyle = INK; ctx.lineWidth = wd * 0.85; ctx.beginPath(); ctx.moveTo(-d, ys[5] * 0.7); ctx.quadraticCurveTo(0, ys[5] * 0.6 + 3, d, ys[5] * 0.7); ctx.stroke(); label = 'Анафаза з мостом (дицентрична хромосома)'; }
        if (type === 'frag') label = 'Анафаза з ацентричним фрагментом';
        if (type === 'lag') label = 'Анафаза з відстаючою хромосомою';
        if (type === 'vag') label = 'Анафаза з блукаючою хромосомою';
        if (multi) label = 'Триполярна анафаза';
      } else {
        // телофаза і цитокінез
        const nuc = (x, y) => { const g = ph === 'C' ? 1 : smooth(0.66, 0.8, t); if (g < 0.5) { ctx.fillStyle = INK2; ctx.beginPath(); ctx.ellipse(x, y, s * 0.05, ch * 0.3 * (1 - g * 0.5), 0, 0, TAU2); ctx.fill(); } else nucleus(ctx, x, y, s * 0.1, s * 0.11, rand(seed + 9), tex, { nucleoli: 1 }); };
        if (multi) { for (let g3 = 0; g3 < 3; g3++) { const a = [0, 2.1, 4.2][g3] + 0.3; nuc(Math.cos(a) * pole * 0.85, Math.sin(a) * ch * 0.28); } label = 'Три міні-ядра (анеуплоїдія)'; }
        else { nuc(-pole, 0); nuc(pole, 0); }
        if (type === 'bridge') {
          const br = t > 0.78;
          ctx.strokeStyle = INK; ctx.lineWidth = wd * 0.8;
          if (!br) { ctx.beginPath(); ctx.moveTo(-pole, 0); ctx.lineTo(pole, 0); ctx.stroke(); label = 'Телофазний міст'; }
          else { ctx.beginPath(); ctx.moveTo(-pole, 0); ctx.lineTo(-s * 0.05, 4); ctx.moveTo(pole, 0); ctx.lineTo(s * 0.06, -3); ctx.stroke(); label = 'Міст розірвався → цикл «розрив — злиття — міст»'; }
        }
        if (type === 'frag' || type === 'lag') {
          const r0 = type === 'frag' ? s * 0.022 : s * 0.04;
          if (ph === 'C' || t > 0.74) { nucleus(ctx, s * 0.02, ys[4] * 0.3, r0, r0, rand(seed + 2), tex, { nucleoli: 0 }); label = type === 'frag' ? 'Дрібне мікроядро з фрагмента (кластоген)' : 'Велике мікроядро з цілої хромосоми (анеуген)'; }
          else chromo(ctx, 0, ys[4] * 0.3, type === 'frag' ? Lc * 0.35 : Lc, Math.PI / 2, wd);
        }
        if (type === 'vag' && ph === 'C') label = 'Дочірні клітини з різною кількістю хромосом (2n ± 1)';
        if (ph === 'C' && !multi) {
          const k = smooth(0.82, 0.98, t);
          ctx.strokeStyle = 'rgba(150,80,110,.6)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -ch / 2 * k); ctx.lineTo(0, ch / 2 * k); ctx.stroke();
          if (type !== 'bridge') label = 'Цитокінез: клітинна пластинка від центру до країв';
        }
      }
    }
  }
  ctx.restore();
  return label;
}
let cineTex = null;
