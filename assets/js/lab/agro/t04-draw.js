// Тема 4. Процедурні об'єкти для моделей морфогенезу: корені, бруньки й апекси на калюсі,
// лупа з близьким планом поверхні калюсу, соматичні ембріоїди (глобулярний → сім'ядольний).
// Світло зверху-ліворуч; текстури кешуються в offscreen-полотна.
import { TAU, clamp, lerp, smooth, rng, fbm, noise, hex, rgba, mix, shade, offscreen, leaf, MAT, roundRect } from './kit.js';

/* ---------------- Корінь ---------------- */
/** Адвентивний корінь: звужений, злегка звивистий, з кореневими волосками за кінчиком. */
export function root(ctx, x, y, len, ang, { seed = 1, width = 2.2, alpha = 1, hairs = true, color = '#F4ECD8' } = {}) {
  if (len < 1) return;
  const R = rng(seed), n = Math.max(4, Math.round(len / 4));
  const pts = [[x, y]];
  let a = ang, px = x, py = y;
  for (let i = 0; i < n; i++) {
    a += (noise(i * 0.7, seed * 3.1, 11) - 0.5) * 0.45;
    px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; pts.push([px, py]);
  }
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const c = hex(color);
  // кореневі волоски (зона всмоктування за кінчиком)
  if (hairs && len > 10) {
    ctx.strokeStyle = 'rgba(255,253,245,.55)'; ctx.lineWidth = 0.5;
    for (let i = Math.floor(n * 0.35); i < n - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], aa = Math.atan2(y1 - y0, x1 - x0);
      for (let k = 0; k < 4; k++) {
        const t = R(), hx = lerp(x0, x1, t), hy = lerp(y0, y1, t), s = R() > 0.5 ? 1 : -1, hl = 2 + R() * 3.5;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(aa + s * 1.3) * hl, hy + Math.sin(aa + s * 1.3) * hl); ctx.stroke();
      }
    }
  }
  // тіло кореня: темніший контур + світла серцевина + відблиск
  for (let i = 0; i < n; i++) {
    const w = width * (1 - (i / n) * 0.6);
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    ctx.strokeStyle = rgba(shade(c, -0.28)); ctx.lineWidth = w + 0.9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const w = width * (1 - (i / n) * 0.6);
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    ctx.strokeStyle = rgba(c); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(0.4, w * 0.3); ctx.beginPath(); ctx.moveTo(x0 - 0.4, y0 - 0.4); ctx.lineTo(x1 - 0.4, y1 - 0.4); ctx.stroke();
  }
  // кінчик (кореневий чохлик) — злегка жовтуватий
  const [tx, ty] = pts[n];
  ctx.fillStyle = 'rgba(236,214,150,.9)'; ctx.beginPath(); ctx.arc(tx, ty, Math.max(0.8, width * 0.42), 0, TAU); ctx.fill();
  ctx.restore();
}

/* ---------------- Брунька / апекс ---------------- */
/** Адвентивна брунька: зелений купол меристеми з двома листковими зачатками. s — радіус, px. */
export function bud(ctx, x, y, s, { green = 1, seed = 1, open = 0 } = {}) {
  if (s < 0.6) return;
  const c = mix([214, 222, 160], [72, 150, 58], clamp(green, 0, 1));
  ctx.save();
  // листкові зачатки
  for (const side of [-1, 1]) {
    const L = s * (1.25 + open * 1.6);
    leaf(ctx, x + side * s * 0.35, y - s * 0.2, L, -Math.PI / 2 + side * (0.55 + open * 0.5), { color: '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''), width: 0.55, veins: false });
  }
  const g = ctx.createRadialGradient(x - s * 0.35, y - s * 0.55, s * 0.08, x, y - s * 0.2, s * 1.05);
  g.addColorStop(0, rgba(shade(c, 0.45))); g.addColorStop(0.55, rgba(c)); g.addColorStop(1, rgba(shade(c, -0.4)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - s * 0.25, s * 0.78, s * 0.9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - s * 0.28, y - s * 0.62, s * 0.2, s * 0.12, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Зелена меристематична зона на поверхні калюсу (пляма дрібних щільних клітин). */
export function meristemZone(ctx, x, y, r, k, { light = true } = {}) {
  if (r < 0.5 || k <= 0) return;
  const c = light ? [96, 168, 64] : [214, 206, 150];
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.05, x, y, r);
  g.addColorStop(0, rgba(shade(c, 0.25), 0.95 * k)); g.addColorStop(0.6, rgba(c, 0.75 * k)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ---------------- Лупа: близький план поверхні калюсу ---------------- */
const texCache = new Map();
/** Карта рельєфу калюсу з освітленням (кешується за розміром і кольором). */
export function callusTexture(size, seed, tint) {
  const key = `${size}|${seed}|${tint}`;
  if (texCache.has(key)) return texCache.get(key);
  if (texCache.size > 12) texCache.clear();
  const c = offscreen(size, size), x = c.getContext('2d'), d = x.createImageData(size, size);
  const base = hex(tint), sc = 9 / size;
  const H = (i, j) => {
    const u = i * sc, v = j * sc;
    // горбки-клітинні агрегати (вузлуватість) + дрібна зернистість
    const n1 = fbm(u * 0.9, v * 0.9, seed, 4);
    const n2 = noise(u * 3.2, v * 3.2, seed + 5);
    return n1 * 0.8 + Math.pow(n2, 2) * 0.35;
  };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const h = H(i, j), hx = H(i + 1, j) - h, hy = H(i, j + 1) - h;
    const lam = clamp(0.62 - (hx * 0.62 + hy * 0.78) * 38, 0, 1.25); // світло зверху-ліворуч
    const cav = clamp((h - 0.35) * 1.8, 0, 1);                       // западини темніші
    const k = (0.42 + 0.62 * lam) * (0.55 + 0.45 * cav);
    const p = (j * size + i) * 4;
    d.data[p] = clamp(base[0] * k + (lam > 1.05 ? 40 : 0), 0, 255);
    d.data[p + 1] = clamp(base[1] * k + (lam > 1.05 ? 40 : 0), 0, 255);
    d.data[p + 2] = clamp(base[2] * k * 0.96 + (lam > 1.05 ? 34 : 0), 0, 255);
    d.data[p + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  texCache.set(key, c);
  return c;
}

/**
 * Лупа (бінокулярна лупа ×10) з близьким планом калюсу.
 * st: { zones:[{x,y,r,k}], buds:[{x,y,s,green,open}], roots:[{x,y,len,ang}], light, tint, brown }
 * Координати об'єктів — у частках радіуса від центру (−1..1).
 */
export function lens(ctx, cx, cy, r, st, { label = '', seed = 4 } = {}) {
  const size = Math.max(32, Math.round(r * 2));
  ctx.save();
  // тінь лупи
  const sh = ctx.createRadialGradient(cx + r * 0.1, cy + r * 0.14, r * 0.8, cx + r * 0.1, cy + r * 0.14, r * 1.25);
  sh.addColorStop(0, 'rgba(0,0,0,.28)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx + r * 0.1, cy + r * 0.14, r * 1.25, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.save(); ctx.clip();
  // фон — темне поле під калюсом
  ctx.fillStyle = '#1B1A14'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.drawImage(callusTexture(size, seed, st.tint || '#EDE1BC'), cx - r, cy - r, 2 * r, 2 * r);
  if (st.brown > 0) { ctx.fillStyle = `rgba(110,70,30,${0.45 * st.brown})`; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
  const P = (o) => [cx + o.x * r, cy + o.y * r];
  for (const z of st.zones || []) { const [x, y] = P(z); meristemZone(ctx, x, y, z.r * r, z.k, { light: st.light }); }
  for (const q of st.roots || []) { const [x, y] = P(q); root(ctx, x, y, q.len * r, q.ang, { seed: q.seed || 3, width: r * 0.07, hairs: true }); }
  for (const b of st.buds || []) { const [x, y] = P(b); bud(ctx, x, y, b.s * r, { green: b.green, open: b.open, seed: b.seed }); }
  // віньєтка лінзи + хроматична облямівка
  const v = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.85, 'rgba(0,0,0,.25)'); v.addColorStop(1, 'rgba(0,0,0,.7)');
  ctx.fillStyle = v; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.strokeStyle = 'rgba(90,150,255,.25)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r - 1.5, 0, TAU); ctx.stroke();
  // відблиск на склі лінзи
  const gl = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.2);
  gl.addColorStop(0, 'rgba(255,255,255,.22)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.restore();
  // металева оправа
  const rim = Math.max(5, r * 0.07);
  const mg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  mg.addColorStop(0, '#F2F4F3'); mg.addColorStop(0.3, '#8F999A'); mg.addColorStop(0.55, '#DADFDF'); mg.addColorStop(1, '#5E6869');
  ctx.strokeStyle = mg; ctx.lineWidth = rim; ctx.beginPath(); ctx.arc(cx, cy, r + rim / 2, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r + rim, 0, TAU); ctx.stroke();
  ctx.restore();
  if (label) {
    ctx.save(); ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    const m = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(8,26,17,.78)'; roundRect(ctx, cx - m / 2 - 7, cy + r + rim + 6, m + 14, 19, 9); ctx.fill();
    ctx.fillStyle = '#EAF5EC'; ctx.fillText(label, cx, cy + r + rim + 19.5); ctx.restore();
  }
}

/* ---------------- Соматичний ембріоїд ---------------- */
/**
 * Контур ембріоїда за неперервною стадією p:
 * 0–1 глобулярна (куля росте), 1–2 серцеподібна (два виступи сім'ядоль), 2–3 торпедоподібна (видовження осі),
 * 3–4 сім'ядольна (розгорнуті сім'ядолі), 4–5 проростання (корінець подовжується, сім'ядолі розходяться).
 * Локальні координати: вісь уздовж −y (верхівка пагона вгорі), одиниця = «радіус» S.
 */
function embryoShape(p) {
  const q1 = clamp(p - 1, 0, 1), q2 = clamp(p - 2, 0, 1), q3 = clamp(p - 3, 0, 1), q4 = clamp(p - 4, 0, 1);
  const W = lerp(1, 1.12, q1) * lerp(1, 0.62, q2) * lerp(1, 0.9, q3) * lerp(1, 0.85, q4);   // напівширина тіла
  const Hb = lerp(1, 1.0, q1) * lerp(1, 1.75, q2) * lerp(1, 1.18, q3) * lerp(1, 1.3, q4);   // напівдовжина тіла
  const lobe = 0.42 * q1 + 0.5 * q2 + 0.9 * q3 + 0.4 * q4;                                // довжина сім'ядоль
  const spread = 0.12 + 0.18 * q1 + 0.05 * q2 + 0.25 * q3 + 0.55 * q4;                     // кут розходження
  const notch = 0.18 * q1 + 0.25 * q2 + 0.45 * q3 + 0.2 * q4;                              // глибина виїмки
  const radicle = 0.25 * q2 + 0.2 * q3 + 1.6 * q4;                                         // корінець
  return { W, Hb, lobe, spread, notch, radicle, q1, q2, q3, q4 };
}

function embryoPath(ctx, S, sh) {
  const { W, Hb, lobe, spread, notch, radicle } = sh;
  const top = -Hb, bot = Hb + radicle;
  const lw = W * S, tipY = (top - lobe) * S, nY = (top + notch) * S, cw = W * 0.55 * S;
  ctx.beginPath();
  ctx.moveTo(0, bot * S);
  // права сторона: корінець → тіло (гіпокотиль) → права сім'ядоля
  ctx.bezierCurveTo(W * 0.35 * S, bot * S, W * 0.55 * S, Hb * S * 0.95, lw, Hb * S * 0.25);
  if (lobe < 0.02) {
    ctx.bezierCurveTo(lw * 1.02, -Hb * S * 0.6, lw * 0.55, top * S, 0, top * S);
    ctx.bezierCurveTo(-lw * 0.55, top * S, -lw * 1.02, -Hb * S * 0.6, -lw, Hb * S * 0.25);
  } else {
    const tx = cw + Math.sin(spread) * lobe * S, ty = tipY + (1 - Math.cos(spread)) * lobe * S * 0.6;
    ctx.bezierCurveTo(lw * 1.05, -Hb * S * 0.3, tx + cw * 0.55, ty + lobe * S * 0.35, tx, ty);
    ctx.bezierCurveTo(tx - cw * 0.55, ty - cw * 0.15, cw * 0.25, nY - cw * 0.2, 0, nY);
    ctx.bezierCurveTo(-cw * 0.25, nY - cw * 0.2, -tx + cw * 0.55, ty - cw * 0.15, -tx, ty);
    ctx.bezierCurveTo(-tx - cw * 0.55, ty + lobe * S * 0.35, -lw * 1.05, -Hb * S * 0.3, -lw, Hb * S * 0.25);
  }
  ctx.bezierCurveTo(-W * 0.55 * S, Hb * S * 0.95, -W * 0.35 * S, bot * S, 0, bot * S);
  ctx.closePath();
}

const cellTexCache = new Map();
/** Дрібноклітинна текстура (протодерма) — кешований патерн. */
function cellPattern(ctx, cell) {
  const k = Math.round(cell * 4) / 4;
  if (!cellTexCache.has(k)) {
    const sz = Math.max(16, Math.round(k * 8)), c = offscreen(sz, sz), x = c.getContext('2d'), R = rng(77);
    x.strokeStyle = 'rgba(120,100,50,.35)'; x.lineWidth = 0.6;
    const pts = []; for (let i = 0; i < 18; i++) pts.push([R() * sz, R() * sz]);
    // спрощена «вороноподібна» сітка: кола навколо центрів
    for (const [px, py] of pts) for (const ox of [-sz, 0, sz]) for (const oy of [-sz, 0, sz]) { x.beginPath(); x.arc(px + ox, py + oy, k * 0.95, 0, TAU); x.stroke(); }
    cellTexCache.set(k, c);
  }
  return ctx.createPattern(cellTexCache.get(k), 'repeat');
}

/**
 * Малює ембріоїд. (x, y) — центр тіла; S — масштаб (px); ang — нахил осі; light — зеленіння на світлі.
 * abnormal — 0..1, деформація (злиті/вкорочені сім'ядолі при надлишку ауксину).
 */
export function embryo(ctx, x, y, S, p, { ang = 0, seed = 1, light = 1, glow = 0 } = {}) {
  if (S < 0.8) return;
  const sh = embryoShape(p);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  // підвісок (суспензор) — ланцюжок клітин біля кореневого полюса на ранніх стадіях
  const susp = 1 - smooth(1.8, 3.2, p);
  if (susp > 0.02) {
    ctx.fillStyle = `rgba(232,222,180,${0.85 * susp})`; ctx.strokeStyle = `rgba(140,120,70,${0.5 * susp})`; ctx.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) { const r = S * (0.2 - i * 0.03); ctx.beginPath(); ctx.ellipse(0, (sh.Hb + 0.12) * S + i * r * 1.7 + r, r * 0.8, r, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  }
  // тінь
  ctx.save(); ctx.translate(S * 0.18, S * 0.22); embryoPath(ctx, S, sh); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill(); ctx.restore();
  embryoPath(ctx, S, sh);
  // заливка: восково-кремова, сім'ядолі зеленіють на пізніх стадіях
  const gr = clamp(smooth(2.6, 4.4, p) * light, 0, 1);
  const cream = [244, 236, 200], green = [118, 178, 76];
  const top = mix(cream, green, gr), bot = mix(cream, [240, 228, 186], 0.4);
  const lg = ctx.createLinearGradient(0, -(sh.Hb + sh.lobe) * S, 0, (sh.Hb + sh.radicle) * S);
  lg.addColorStop(0, rgba(top)); lg.addColorStop(0.45, rgba(mix(top, bot, 0.5))); lg.addColorStop(1, rgba(bot));
  ctx.fillStyle = lg; ctx.fill();
  // об'єм: світло зверху-ліворуч, тінь праворуч-знизу
  ctx.save(); ctx.clip();
  const L = Math.max(sh.W, sh.Hb) * S * 1.6;
  const rg = ctx.createRadialGradient(-S * 0.45, -S * 0.5, S * 0.05, 0, 0, L);
  rg.addColorStop(0, 'rgba(255,255,250,.75)'); rg.addColorStop(0.35, 'rgba(255,255,250,.08)'); rg.addColorStop(0.75, 'rgba(60,50,20,.12)'); rg.addColorStop(1, 'rgba(40,30,10,.38)');
  ctx.fillStyle = rg; ctx.fillRect(-L, -L * 1.6, 2 * L, 3.2 * L);
  // клітинна текстура
  ctx.globalAlpha = 0.55; ctx.fillStyle = cellPattern(ctx, Math.max(1.2, S * 0.09)); ctx.fillRect(-L, -L * 1.6, 2 * L, 3.2 * L); ctx.globalAlpha = 1;
  // прокамбій (провідний тяж) — на торпедоподібній і сім'ядольній стадіях
  const pc = smooth(2.1, 3.0, p);
  if (pc > 0.02) {
    ctx.strokeStyle = `rgba(150,140,60,${0.35 * pc})`; ctx.lineWidth = S * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, (sh.Hb + sh.radicle * 0.8) * S); ctx.lineTo(0, -(sh.Hb - sh.notch) * S * 0.7);
    if (sh.lobe > 0.3) { ctx.moveTo(0, -(sh.Hb - sh.notch) * S * 0.7); ctx.lineTo(S * 0.5 * sh.W, -(sh.Hb + sh.lobe * 0.6) * S); ctx.moveTo(0, -(sh.Hb - sh.notch) * S * 0.7); ctx.lineTo(-S * 0.5 * sh.W, -(sh.Hb + sh.lobe * 0.6) * S); }
    ctx.stroke();
  }
  ctx.restore();
  // протодерма — світлий обідок, контур
  ctx.strokeStyle = 'rgba(255,255,240,.6)'; ctx.lineWidth = Math.max(0.6, S * 0.06); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,80,40,.55)'; ctx.lineWidth = 0.8; ctx.stroke();
  // полиск
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-S * 0.38 * sh.W, -S * 0.42 * sh.Hb, S * 0.16, S * 0.09, -0.6, 0, TAU); ctx.fill();
  if (glow > 0) { embryoPath(ctx, S, sh); ctx.strokeStyle = `rgba(255,214,90,${glow})`; ctx.lineWidth = 2.2; ctx.stroke(); }
  ctx.restore();
}

/** Назва стадії за неперервним індексом p. */
export function stageName(p) {
  return p < 0.35 ? 'проембріо' : p < 1 ? 'глобулярна' : p < 2 ? 'серцеподібна' : p < 3 ? 'торпедоподібна' : p < 4 ? "сім'ядольна" : 'проростання';
}
