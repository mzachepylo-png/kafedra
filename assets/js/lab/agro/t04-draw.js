// Тема 4. Процедурні об'єкти для моделей морфогенезу: корені, бруньки й апекси на калюсі,
// лупа з близьким планом поверхні калюсу, соматичні ембріоїди (глобулярний → сім'ядольний).
// Світло зверху-ліворуч; текстури кешуються в offscreen-полотна.
import { TAU, clamp, lerp, smooth, rng, fbm, noise, hex, rgba, mix, shade, offscreen, leaf, MAT, roundRect } from './kit.js';

/* ---------------- Корінь ---------------- */
/** Адвентивний корінь: звужений, злегка звивистий, з кореневими волосками за кінчиком. */
export function root(ctx, x, y, len, ang, { seed = 1, width = 2.2, alpha = 1, hairs = true, color = '#F4ECD8', edge = -0.28 } = {}) {
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
    ctx.strokeStyle = rgba(shade(c, edge)); ctx.lineWidth = w + 0.9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
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
    const L = s * (1.1 + open * 1.1);
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
/**
 * Близький план поверхні калюсу: щільні округлі вузлики (агрегати клітин) з об'ємним затіненням,
 * темні щілини між ними, вологий полиск і зерно. Кешується за розміром, сідом і кольором.
 */
export function callusTexture(size, seed, tint, fine = 1) {
  const key = `${size}|${seed}|${tint}|${fine}`;
  if (texCache.has(key)) return texCache.get(key);
  if (texCache.size > 12) texCache.clear();
  const c = offscreen(size, size), x = c.getContext('2d'), R = rng(seed * 7 + 1), base = hex(tint);
  // щілини між вузликами
  const bg = x.createRadialGradient(size * 0.4, size * 0.35, size * 0.1, size / 2, size / 2, size * 0.75);
  bg.addColorStop(0, rgba(shade(base, -0.3))); bg.addColorStop(1, rgba(shade(base, -0.5)));
  x.fillStyle = bg; x.fillRect(0, 0, size, size);
  const nod = [];
  const n = Math.round(size * size / 170 / (fine * fine));
  for (let i = 0; i < n; i++) {
    const r = size * fine * (0.03 + Math.pow(R(), 1.6) * 0.06);
    nod.push({ x: R() * size, y: R() * size, r, k: R() });
  }
  nod.sort((a, b) => a.r - b.r || a.y - b.y);
  for (const b of nod) {
    const cc = mix(base, b.k > 0.7 ? shade(base, 0.1) : shade(base, -0.08), b.k);
    // м'яка тінь під вузликом
    x.fillStyle = 'rgba(40,28,8,.28)'; x.beginPath(); x.ellipse(b.x + b.r * 0.18, b.y + b.r * 0.22, b.r * 1.02, b.r * 0.95, 0, 0, TAU); x.fill();
    const g = x.createRadialGradient(b.x - b.r * 0.38, b.y - b.r * 0.42, b.r * 0.06, b.x, b.y, b.r);
    g.addColorStop(0, rgba(shade(cc, 0.42))); g.addColorStop(0.45, rgba(cc)); g.addColorStop(0.85, rgba(shade(cc, -0.22))); g.addColorStop(1, rgba(shade(cc, -0.42)));
    x.fillStyle = g; x.beginPath();
    for (let j = 0; j <= 14; j++) { const t = j / 14 * TAU, rr = b.r * (0.9 + 0.12 * noise(Math.cos(t) * 1.6 + b.x, Math.sin(t) * 1.6 + b.y, seed)); const X = b.x + Math.cos(t) * rr, Y = b.y + Math.sin(t) * rr; j ? x.lineTo(X, Y) : x.moveTo(X, Y); }
    x.fill();
    // вологий полиск
    if (b.r > 4) { x.fillStyle = 'rgba(255,255,245,.45)'; x.beginPath(); x.ellipse(b.x - b.r * 0.36, b.y - b.r * 0.42, b.r * 0.2, b.r * 0.11, -0.6, 0, TAU); x.fill(); }
    // клітинна зернистість
    x.fillStyle = rgba(shade(cc, -0.3), 0.25);
    for (let k = 0; k < b.r * 0.6; k++) { const a = R() * TAU, d = R() * b.r * 0.8; x.beginPath(); x.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 0.5 + R() * 0.8, 0, TAU); x.fill(); }
  }
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
  const W = 1 + 0.15 * q1 - 0.4 * q2 - 0.15 * q3 - 0.05 * q4;        // напівширина тіла (гіпокотиля)
  const Hb = 1 + 0.7 * q2 + 0.25 * q3 + 0.3 * q4;                     // напівдовжина тіла
  const lobe = 0.35 * q1 + 0.3 * q2 + 0.9 * q3 + 0.25 * q4;           // довжина сім'ядоль
  const cw = Math.max(0.3, (0.5 + 0.0 * q1) * W + 0.12 * q3);         // ширина сім'ядолі
  const spread = 0.3 * q1 - 0.15 * q2 + 0.3 * q3 + 0.5 * q4;          // розходження сім'ядоль
  const notch = 0.22 * q1 + 0.1 * q2 + 0.35 * q3;                     // глибина виїмки між сім'ядолями
  const radicle = 0.2 * q2 + 0.15 * q3 + 1.5 * q4;                    // корінець
  return { W, Hb, lobe, cw, spread, notch, radicle, q1, q2, q3, q4 };
}

function embryoPath(ctx, S, sh) {
  const { W, Hb, lobe, cw, spread, notch, radicle } = sh;
  const top = -Hb * S, bot = (Hb + radicle) * S, lw = W * S, c = cw * S;
  ctx.beginPath();
  ctx.moveTo(0, bot);
  // права сторона: корінець → тіло
  ctx.bezierCurveTo(lw * 0.45, bot, lw * 0.75, Hb * S * 0.85, lw, Hb * S * 0.2);
  if (lobe < 0.03) {
    ctx.bezierCurveTo(lw * 1.02, -Hb * S * 0.6, lw * 0.55, top, 0, top);
    ctx.bezierCurveTo(-lw * 0.55, top, -lw * 1.02, -Hb * S * 0.6, -lw, Hb * S * 0.2);
  } else {
    // кінчик правої сім'ядолі (заокруглений), виїмка між сім'ядолями
    const tx = Math.max(lw * 0.5, c * 0.55) + Math.sin(spread) * lobe * S * 0.9, ty = top - lobe * S * Math.cos(spread * 0.6);
    const nY = top + notch * S;
    ctx.bezierCurveTo(lw * 1.04, top * 0.2, tx + c * 0.62, ty + c * 0.9, tx + c * 0.12, ty + c * 0.05);
    ctx.bezierCurveTo(tx - c * 0.3, ty - c * 0.25, tx - c * 0.9, ty + c * 0.1, c * 0.12, nY);
    ctx.quadraticCurveTo(0, nY - c * 0.12, -c * 0.12, nY);
    ctx.bezierCurveTo(-tx + c * 0.9, ty + c * 0.1, -tx + c * 0.3, ty - c * 0.25, -tx - c * 0.12, ty + c * 0.05);
    ctx.bezierCurveTo(-tx - c * 0.62, ty + c * 0.9, -lw * 1.04, top * 0.2, -lw, Hb * S * 0.2);
  }
  ctx.bezierCurveTo(-lw * 0.75, Hb * S * 0.85, -lw * 0.45, bot, 0, bot);
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
  const cream = [250, 246, 226], green = [118, 178, 76];
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
  ctx.globalAlpha = 0.3; ctx.fillStyle = cellPattern(ctx, Math.max(1.2, S * 0.09)); ctx.fillRect(-L, -L * 1.6, 2 * L, 3.2 * L); ctx.globalAlpha = 1;
  // прокамбій (провідний тяж) — на торпедоподібній і сім'ядольній стадіях
  const pc = smooth(2.1, 3.0, p);
  if (pc > 0.02) {
    ctx.strokeStyle = `rgba(150,140,60,${0.35 * pc})`; ctx.lineWidth = S * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, (sh.Hb + sh.radicle * 0.8) * S); ctx.lineTo(0, -(sh.Hb - sh.notch) * S * 0.7);
    if (sh.lobe > 0.3) { const y0 = -(sh.Hb - sh.notch) * S * 0.7, yt = -(sh.Hb + sh.lobe * 0.55) * S, xt = (sh.W * 0.5 + Math.sin(sh.spread) * sh.lobe * 0.5) * S; ctx.moveTo(0, y0); ctx.quadraticCurveTo(xt * 0.4, y0 - S * 0.2, xt, yt); ctx.moveTo(0, y0); ctx.quadraticCurveTo(-xt * 0.4, y0 - S * 0.2, -xt, yt); }
    ctx.stroke();
  }
  ctx.restore();
  // протодерма — світлий обідок, контур
  embryoPath(ctx, S, sh);
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
