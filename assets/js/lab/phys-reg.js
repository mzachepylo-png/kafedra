/* Конспект «Системи регуляції у рослин»: моделі дії фітогормонів (кисле зростання, полярний транспорт ауксину,
   тропізми, апікальне домінування, матриця «ефект — гормон», дозрівання плодів). Якісні моделі за матеріалом посібника. */
import { reg, D, C, fmt, clamp, lerp, smooth, rng, mixHex, alpha, hash01, btn } from "./extr-core.js";

const wrap = (c, text, x, y, maxW, lh, o = {}) => { c.font = `${o.weight || 600} ${o.size || 11}px Inter, system-ui, sans-serif`; const ws = text.split(" "); let line = "", yy = y; for (const w of ws) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { D.txt(c, line, x, yy, o); line = w; yy += lh; } else line = t; } if (line) D.txt(c, line, x, yy, o); return yy; };

/* ====================== 1. КИСЛЕ ЗРОСТАННЯ КЛІТИНИ ====================== */
reg("r-acid", {
  aspect: (w) => (w < 560 ? 0.95 : 1.65),
  params: [{ k: "aux", label: "Ауксин (ІОК) у клітині", min: 0, max: 100, step: 5, v: 70, u: "%" }],
  toggles: [{ k: "buf", label: "Нейтральний буфер у стінці (pH 7) — «вимиває» кислоту", v: false }, { k: "blk", label: "Заблокувати H⁺-АТФазу плазмалеми", v: false }],
  presets: [{ label: "Без ауксину", set: { aux: 0 } }, { label: "Помірний ауксин", set: { aux: 50 } }, { label: "Багато ауксину", set: { aux: 100 } }], presetsLabel: "Швидкий вибір",
  info: "За гіпотезою <b>кислого росту</b> ауксин активує <b>H⁺-АТФазу</b> плазмалеми. Протони підкислюють клітинну стінку, активуються ферменти (кислі гідролази, експансини), які розривають <b>кислотолабільні зв'язки</b> між компонентами стінки. Тургорний тиск розтягує пухку стінку, вакуоль збільшується — клітина росте <b>розтягуванням</b>. Потім розірвані зв'язки відновлюються й вбудовуються нові компоненти — розмір «фіксується».",
  init() { const r = rng(7); return { len: 1, t: 0, H: Array.from({ length: 26 }, () => ({ u: r(), s: r() })), hist: [] }; },
  step(S, P, dt) {
    const pump = P.blk ? 0 : P.aux / 100; S.pump = pump; S.pH = P.buf ? 7 : 6.5 - 2.0 * pump; S.loose = clamp((6.2 - S.pH) / 1.6, 0, 1);
    const dm = dt * 6; const g = 0.03 * S.loose; S.len = Math.min(S.len + g * dm, 3.2); S.g = g; S.t += dt; S.tm = (S.tm || 0) + dm;
    for (const h of S.H) { h.u += dt * (.15 + pump * .5) * (P.blk ? 0 : 1); if (h.u > 1) h.u -= 1; }
    if (!S.lastTm || S.tm - S.lastTm >= 1.5) { S.lastTm = S.tm; S.hist.push([S.tm, S.len]); if (S.hist.length > 140) S.hist.shift(); }
    if (S.tm > 140) { S.tm = 0; S.lastTm = 0; S.hist = []; S.len = 1; }
  },
  draw(c, S, P, W, H, t) {
    const nar = W < 560; D.bg(c, W, H, "#F4F8F0", "#E8F0E4");
    const cx = nar ? W * .5 : W * .28, top = 36, cw = Math.min(nar ? 130 : 150, W * .3), baseH = nar ? H * .26 : H * .38, ch = baseH * S.len, cy = top + 6;
    // клітинна стінка (кольором відображається pH)
    const wallCol = mixHex("#C9A874", "#E9B3A0", clamp((6.5 - S.pH) / 2, 0, 1) * .7);
    D.rr(c, cx - cw / 2 - 12, cy - 8, cw + 24, ch + 16, 20); c.fillStyle = wallCol; c.fill(); c.strokeStyle = "#8A6A38"; c.lineWidth = 1.5; c.stroke();
    // зв'язки в стінці (розриваються при підкисленні)
    c.strokeStyle = "rgba(90,60,25,.55)"; c.lineWidth = 1.4;
    for (let i = 0; i < 12; i++) { const y = cy + 6 + (ch - 12) * i / 11, br = hash01(i, 4) < S.loose * .8; for (const sx of [-1, 1]) { const x = cx + sx * (cw / 2 + 6); c.beginPath(); c.moveTo(x - 4, y - 5); if (br) { c.lineTo(x - 1, y - 1); c.moveTo(x + 1, y + 1); } c.lineTo(x + 4, y + 5); c.stroke(); } }
    // протопласт, вакуоль
    D.rr(c, cx - cw / 2, cy, cw, ch, 14); c.fillStyle = "#8FC77B"; c.fill(); c.strokeStyle = "#3F7D45"; c.lineWidth = 2; c.stroke();
    D.rr(c, cx - cw / 2 + 12, cy + 12, cw - 24, ch - 24, 10); const vg = c.createLinearGradient(0, cy, 0, cy + ch); vg.addColorStop(0, "#CBE6F6"); vg.addColorStop(1, "#9FCBEA"); c.fillStyle = vg; c.fill(); c.strokeStyle = "rgba(40,90,150,.5)"; c.stroke();
    D.txt(c, "вакуоль", cx, cy + ch / 2, { size: 11, align: "center", color: "#1E4A7A" });
    // АТФази (насоси) на мембрані
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const y = cy + ch * (.18 + i * .22); D.rr(c, cx + sx * cw / 2 - 5, y - 8, 10, 16, 3); c.fillStyle = P.blk ? "#9AA7A0" : "#C0392B"; c.fill(); }
    // протони з цитоплазми у стінку
    if (S.pump > .02) for (const h of S.H) { const side = h.s < .5 ? -1 : 1, y = cy + 12 + h.s * 2 % 1 * (ch - 24), x = cx + side * (cw / 2 - 2 + h.u * 16); c.fillStyle = `rgba(192,57,43,${1 - h.u * .5})`; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); D.txt(c, "H⁺", x + (side > 0 ? 6 : -6), y, { size: 8, color: "#C0392B", align: side > 0 ? "left" : "right", weight: 700 }); }
    D.tag(c, `pH стінки: ${fmt(S.pH, 1)}`, cx, cy + ch + 28, { size: 11.5, bg: "#fff", stroke: S.pH < 5.5 ? "#C0392B" : C.rule, color: S.pH < 5.5 ? "#C0392B" : C.soft });
    D.txt(c, "стінка", cx - cw / 2 - 18, cy + 4, { size: 10.5, color: "#7A5C2E", align: "right" }); D.txt(c, "H⁺-АТФаза", cx + cw / 2 + 18, cy + ch * .18, { size: 10.5, color: "#C0392B", weight: 700 });
    // графік довжини
    const gx = nar ? 16 : W * .54, gy = nar ? H * .6 : 40, gw = nar ? W - 32 : W * .43, gh = nar ? H * .3 : H * .62;
    D.chart(c, gx, gy, gw, gh, { x: [0, 140], y: [1, 3.4], xl: "час, умовні хв", yl: "довжина клітини, ×", xt: [0, 40, 80, 120], yt: [1, 2, 3], title: "Ріст клітини розтягуванням", series: [{ pts: S.hist.map(([tt, l]) => [Math.min(tt, 140), l]), col: C.green, w: 2.6 }], marks: [{ x: Math.min(S.tm || 0, 140), y: S.len, col: C.green, r: 4 }] });
    const msg = P.blk ? "насос заблоковано: стінка не підкислюється, клітина не росте" : P.buf ? "буфер нейтралізує кислоту: ріст зупинено, хоча ауксин є" : P.aux === 0 ? "немає ауксину: стінка тверда, клітина не росте" : S.len >= 3.19 ? "клітина досягла кінцевого розміру" : "стінка розпушується, тургор розтягує клітину";
    D.tag(c, msg, nar ? W / 2 : W * .76, nar ? H - 16 : H - 22, { size: 11, bg: "#fff", stroke: C.rule, color: C.soft });
  },
  reads: (S, P) => [["pH клітинної стінки", fmt(S.pH || 6.5, 1), ""], ["Розпушення стінки", fmt((S.loose || 0) * 100, 0), "%"], ["Швидкість росту", fmt((S.g || 0) * 100, 1), "% довжини за одиницю часу"], ["Довжина клітини", fmt(S.len || 1, 2), "×"]],
});

/* ====================== 2. ПОЛЯРНИЙ ТРАНСПОРТ АУКСИНУ ====================== */
reg("r-pin", {
  aspect: (w) => (w < 560 ? 0.85 : 1.7),
  params: [{ k: "pH", label: "pH апопласту (простору між клітинами)", min: 4.5, max: 7, step: 0.1, v: 5.5, d: 1 }],
  toggles: [{ k: "npa", label: "Заблокувати переносники виходу (інгібітор NPA)", v: false }, { k: "rnd", label: "Переносники розподілено рівномірно (немає полярності)", v: false }],
  info: "ІОК — <b>слабка кислота</b> (pK ≈ 4,75). У кислому апопласті більша її частка <b>нейтральна</b> (IAAH) і легко проходить крізь мембрану всередину клітини. У цитоплазмі (pH ≈ 7) молекула дисоціює на <b>аніон IAA⁻</b>, який через мембрану вільно не виходить: його випускають лише <b>переносники виходу (PIN)</b>, розташовані на нижньому («базальному») кінці клітини. Звідси спрямований рух від верхівки до основи (10–15 мм/год у пагонах).",
  init() { const r = rng(3); return { ps: Array.from({ length: 46 }, () => ({ cell: r() * 5 | 0, st: "in", x: r(), y: r(), vx: 0, vy: 0, id: r() })), t: 0, moved: 0, ev: 0, flux: [] }; },
  step(S, P, dt) {
    const frac = 1 / (1 + Math.pow(10, P.pH - 4.75)); S.frac = frac; S.t += dt; let down = 0;
    for (const p of S.ps) {
      p.x = clamp(p.x + (Math.random() - .5) * .08, .05, .95); p.y = clamp(p.y + (Math.random() - .5) * .08, .08, .92);
      if (p.st === "in") { const kout = P.npa ? 0 : (P.rnd ? .09 : .42); if (Math.random() < kout * dt) { if (P.rnd && Math.random() < .5) { p.st = "apoU"; } else { p.st = "apoD"; down++; } } }
      else { const kin = frac * 1.1; if (Math.random() < kin * dt * 2.2) { const to = p.st === "apoD" ? p.cell + 1 : p.cell - 1; if (to >= 0 && to < 5) { p.cell = to; p.st = "in"; } else { p.cell = p.st === "apoD" ? 0 : 4; p.st = "in"; } } }
    }
    S.flux.push(down); if (S.flux.length > 60) S.flux.shift();
  },
  draw(c, S, P, W, H) {
    D.bg(c, W, H, "#F5F8F2", "#E9F0E6"); const nar = W < 560;
    const N = 5, cx = nar ? W * .5 : W * .3, cw = Math.min(nar ? 120 : 150, W * .34), top = 30, bot = H - 26, ch = (bot - top) / N - 14;
    const ph = P.pH; const apoCol = mixHex("#F6C7BF", "#EDF3E9", clamp((ph - 4.5) / 2.5, 0, 1));
    D.txt(c, "верхівка (джерело ІОК)", cx, 14, { size: 10.5, align: "center", color: C.muted }); D.txt(c, "основа →", cx, H - 8, { size: 10.5, align: "center", color: C.muted });
    for (let i = 0; i < N; i++) {
      const y = top + i * (ch + 14);
      c.fillStyle = apoCol; c.fillRect(cx - cw / 2 - 14, y + ch, cw + 28, 14);
      D.rr(c, cx - cw / 2, y, cw, ch, 10); c.fillStyle = "#CFE7B8"; c.fill(); c.strokeStyle = "#5E8F4A"; c.lineWidth = 2; c.stroke();
      // переносники PIN на нижній мембрані (або рівномірно)
      const pinC = P.npa ? "#9AA7A0" : "#C0392B";
      if (P.rnd) { for (const [px, py] of [[0, .3], [0, .7], [1, .3], [1, .7], [.3, 0], [.7, 0], [.3, 1], [.7, 1]]) { D.rr(c, cx - cw / 2 + px * cw - 4, y + py * ch - 4, 8, 8, 2); c.fillStyle = pinC; c.fill(); } }
      else for (let k = 0; k < 4; k++) { D.rr(c, cx - cw / 2 + cw * (.2 + k * .2), y + ch - 4, 10, 8, 2); c.fillStyle = pinC; c.fill(); }
    }
    for (const p of S.ps) {
      const y0 = top + p.cell * (ch + 14);
      if (p.st === "in") { const x = cx - cw / 2 + 8 + p.x * (cw - 16), y = y0 + 8 + p.y * (ch - 16); D.sphere(c, x, y, 4.2, "#2E6FB5"); }
      else { const dir = p.st === "apoD" ? 1 : -1; const yy = (dir > 0 ? y0 + ch : y0 - 14) + 7, x = cx - cw / 2 - 6 + p.x * (cw + 12); D.sphere(c, x, yy, 3.6, "#E8A33B"); }
    }
    // легенда і лічильники праворуч / знизу
    const lx = nar ? 10 : W * .56, ly = nar ? H - 6 : 40;
    if (!nar) {
      D.sphere(c, lx + 6, ly, 4.2, "#2E6FB5"); D.txt(c, "IAA⁻ — аніон усередині клітини (pH ≈ 7)", lx + 18, ly, { size: 11, color: C.soft });
      D.sphere(c, lx + 6, ly + 22, 3.6, "#E8A33B"); D.txt(c, "IAAH — нейтральна молекула в апопласті", lx + 18, ly + 22, { size: 11, color: C.soft });
      D.rr(c, lx + 2, ly + 38, 9, 7, 2); c.fillStyle = "#C0392B"; c.fill(); D.txt(c, "переносники виходу (PIN)", lx + 18, ly + 42, { size: 11, color: C.soft });
      const gx = lx, gy = ly + 78, gw = W - lx - 14, gh = H - gy - 36; D.txt(c, "Нейтральна форма ІОК в апопласті", gx, gy - 10, { size: 11.5, weight: 700 });
      c.fillStyle = "#E4ECE4"; D.rr(c, gx, gy, gw, 16, 8); c.fill(); c.fillStyle = "#E8A33B"; D.rr(c, gx, gy, Math.max(6, gw * S.frac), 16, 8); c.fill(); D.txt(c, `${fmt(S.frac * 100, 0)} %`, gx + gw, gy + 30, { size: 11, align: "right", weight: 700 });
      const fl = S.flux.reduce((a, b) => a + b, 0) / Math.max(1, S.flux.length); D.txt(c, "Спрямований потік вниз (умовно)", gx, gy + 56, { size: 11.5, weight: 700 }); c.fillStyle = "#E4ECE4"; D.rr(c, gx, gy + 66, gw, 16, 8); c.fill(); c.fillStyle = "#2E6FB5"; D.rr(c, gx, gy + 66, Math.max(6, gw * clamp(fl * 4, 0, 1)), 16, 8); c.fill();
    }
    const msg = P.npa ? "NPA блокує PIN: ІОК не виходить, транспорту немає" : P.rnd ? "без полярності переносників рух хаотичний" : S.frac < .15 ? "апопласт майже нейтральний: ІОК слабо входить у клітини" : "ІОК рухається від верхівки до основи";
    D.tag(c, msg, nar ? W / 2 : W * .76, H - 16, { size: 11, bg: "#fff", stroke: C.rule, color: C.soft });
  },
  reads: (S, P) => { const fl = (S.flux || []).reduce((a, b) => a + b, 0) / Math.max(1, (S.flux || [1]).length); return [["pH апопласту", fmt(P.pH, 1), ""], ["Частка нейтральної форми IAAH", fmt((S.frac || 0) * 100, 0), "%"], ["Швидкість полярного транспорту (умовно)", P.npa ? "0" : fmt(10 + fl * 5, 0), "мм/год (в пагоні 10–15)"]]; },
});

/* ====================== 3. ТРОПІЗМИ: ФОТО- І ГЕОТРОПІЗМ ====================== */
reg("r-tropism", {
  aspect: (w) => (w < 560 ? 1.0 : 1.7),
  modes: [["photo", "Фототропізм пагона"], ["grav", "Геотропізм: пагін і корінь"]],
  params: [{ k: "ang", label: "Напрямок світла (ліворуч — праворуч)", min: -80, max: 80, step: 5, v: -60, u: "°" }],
  toggles: [{ k: "lay", label: "Покласти рослину горизонтально (для геотропізму)", v: true }],
  info: "Гіпотеза Холодного — Вента: ауксин, що утворюється у верхівці, <b>перерозподіляється</b> до затіненого (при фототропізмі) чи нижнього (при геотропізмі) боку. Стебло: більше ауксину — клітини витягуються швидше — пагін <b>вигинається до світла</b> і вгору. Корінь значно чутливіший до ауксину: надлишок ауксину <b>гальмує</b> розтягування — корінь вигинається <b>вниз</b>.",
  init() { return { th: [0, 0], t: 0 }; },
  step(S, P, dt) {
    S.t += dt;
    if (P.mode === "photo") { const bias = Math.sin(P.ang * Math.PI / 180); S.bias = bias; S.th[0] += (-bias * .9 - S.th[0] * .0) * dt * .22; S.th[0] = clamp(S.th[0], -1.4, 1.4); S.th[1] *= 1 - dt * .1; }
    else { const g = P.lay ? 1 : 0; S.bias = g; const goalS = g ? -1.35 : 0; const goalR = g ? 1.1 : 0; S.th[0] += (goalS - S.th[0]) * dt * .12; S.th[1] += (goalR - S.th[1]) * dt * .12; }
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#EEF5FA", "#E7EFE4"); const nar = W < 560;
    const photo = P.mode === "photo";
    const cx = nar ? W * .42 : W * .34, baseY = H * .74, L = Math.min(H * .6, 230);
    // ґрунт
    c.fillStyle = "#8B6A47"; c.fillRect(0, baseY, W, H - baseY); if (!nar) D.txt(c, "ґрунт", 12, baseY + 16, { size: 10.5, color: "#F4E6C8" });
    // сонце
    if (photo) { const a = P.ang * Math.PI / 180; const sx = cx + Math.sin(a) * W * .38, sy = H * .18; D.glow(c, sx, sy, 70, "#FFD46B", .6); D.sphere(c, sx, sy, 14, "#FFCB45"); D.arrow(c, sx - Math.sin(a) * 16, sy + 16, cx + Math.sin(a) * 40, baseY - L * .8, "#E8B24A", 2, 8); }
    // формула стебла з кривизною
    const seg = 24; const stem = (angle0, len, curv, grow, col, w0) => { const pts = []; let x = cx, y = baseY, a = angle0; pts.push([x, y]); for (let i = 1; i <= seg; i++) { const u = i / seg; a += (u > .4 ? curv * (u - .4) * (1 / seg) * 3 : 0); x += Math.cos(a) * len / seg; y += Math.sin(a) * len / seg; pts.push([x, y]); } c.strokeStyle = col; c.lineWidth = w0; c.lineCap = "round"; c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.stroke(); return pts; };
    let pts;
    if (photo || !P.lay) {
      pts = stem(-Math.PI / 2, L, S.th[0] * (photo ? 1 : 0) * 2.2, 1, "#5FAE5C", 12);
    } else {
      // положена рослина: вісь пагона горизонтальна (спочатку вправо), потім загинається вгору
      pts = stem(0, L * .9, S.th[0] * 2.2, 1, "#5FAE5C", 12);
    }
    // верхівкові листки
    const tip = pts[pts.length - 1], pre = pts[pts.length - 3]; const ta = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]);
    for (const s of [-1, 1]) { c.save(); c.translate(tip[0], tip[1]); c.rotate(ta + s * .9); c.fillStyle = "#4F9D50"; c.beginPath(); c.ellipse(22, 0, 26, 10, 0, 0, 7); c.fill(); c.restore(); }
    // корінь
    if (!photo) { const rpts = []; let x = cx, y = baseY, a = P.lay ? Math.PI : Math.PI / 2; for (let i = 0; i < 24; i++) { rpts.push([x, y]); a += S.th[1] * .04 * (i > 8 ? 1 : 0) * (P.lay ? 1 : 0); x += Math.cos(a) * L * .6 / 24; y += Math.sin(a) * L * .6 / 24; } c.strokeStyle = "#EADFC2"; c.lineWidth = 6; c.lineCap = "round"; c.beginPath(); rpts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.stroke(); D.txt(c, "корінь", rpts[rpts.length - 1][0] - 8, rpts[rpts.length - 1][1] + 14, { size: 10.5, color: "#F4E6C8" }); }
    // ауксин: дві сторони
    const gx = nar ? 14 : W * .62, gy = nar ? H * .84 : 50, gw = nar ? W - 28 : W * .34;
    D.txt(c, photo ? "Ауксин у стеблі: освітлений і затінений боки" : "Ауксин: верхній і нижній боки", gx, nar ? gy - 14 : 32, { size: 11.5, weight: 700 });
    const share = photo ? clamp(.5 + (Math.sin(P.ang * Math.PI / 180)) * .3, .1, .9) : (P.lay ? .75 : .5); // частка на «нижньому/затіненому» боці
    c.fillStyle = "#E4ECE4"; D.rr(c, gx, gy, gw, 18, 9); c.fill(); c.fillStyle = "#E8A33B"; D.rr(c, gx, gy, gw * (photo ? share : share), 18, 9); c.fill();
    D.txt(c, photo ? "затінений бік" : "нижній бік", gx + 6, gy + 9, { size: 10.5, color: "#fff", weight: 800 }); D.txt(c, photo ? "освітлений бік" : "верхній бік", gx + gw - 6, gy + 9, { size: 10.5, color: C.soft, weight: 800, align: "right" });
    if (!nar) wrap(c, photo ? "Більше ауксину на затіненому боці → клітини там витягуються швидше → пагін гнеться до світла." : P.lay ? "Нижній бік: у пагоні ауксин стимулює ріст (пагін гнеться вгору), у корені — гальмує (корінь гнеться вниз)." : "Вертикальна рослина: ауксин розподілений рівномірно, вигинів немає.", gx, gy + 40, gw, 16, { size: 11, color: C.soft });
    D.tag(c, photo ? `кут вигину пагона: ${fmt(Math.abs(S.th[0]) * 57, 0)}°` : `пагін: ${fmt(Math.abs(S.th[0]) * 57, 0)}° угору · корінь: ${fmt(Math.abs(S.th[1]) * 57, 0)}° униз`, nar ? W / 2 : cx, 20, { size: 11, bg: "#fff", stroke: C.rule, color: C.soft });
  },
  reads: (S, P) => P.mode === "photo" ? [["Світло", P.ang === 0 ? "згори" : P.ang < 0 ? "зліва" : "справа", ""], ["Де більше ауксину", P.ang === 0 ? "порівну" : "на затіненому боці", ""], ["Вигин пагона", P.ang === 0 ? "немає" : "до світла", ""]] : [["Положення", P.lay ? "горизонтальне" : "вертикальне", ""], ["Ауксин", P.lay ? "накопичується на нижньому боці" : "розподілений порівну", ""], ["Реакція", P.lay ? "пагін — вгору, корінь — вниз" : "немає вигину", ""]],
});

/* ====================== 4. АПІКАЛЬНЕ ДОМІНУВАННЯ ====================== */
reg("r-apical", {
  aspect: (w) => (w < 560 ? 1.0 : 1.7),
  params: [
    { k: "aux", label: "Ауксин, що йде вниз від верхівки", min: 0, max: 100, step: 5, v: 80, u: "%" },
    { k: "ck", label: "Цитокінін з кореня", min: 0, max: 100, step: 5, v: 30, u: "%" },
  ],
  toggles: [{ k: "cut", label: "Видалити верхівку пагона", v: false }, { k: "paste", label: "Нанести пасту з ІОК на зріз", v: false }, { k: "ckb", label: "Обробити бічні бруньки цитокініном", v: false }],
  presets: [{ label: "Нормальна рослина", set: { aux: 80, ck: 30 } }, { label: "Багато цитокініну", set: { aux: 80, ck: 100 } }, { label: "Немає ауксину", set: { aux: 0, ck: 30 } }],
  presetsLabel: "Сценарії",
  info: "<b>Апікальне домінування</b>: верхівка пагона виділяє ауксин, який рухається вниз і <b>пригнічує ріст бічних бруньок</b>. Цитокінін із кореня діє протилежно — <b>знімає</b> це гальмування. Якщо видалити верхівку, бічні пагони розвиваються (кущіння); паста з ІОК на зрізі повертає гальмування; цитокінін, нанесений на бруньки, розбуджує їх навіть при ауксині.",
  init() { return { g: [0, 0, 0, 0, 0, 0], t: 0 }; },
  step(S, P, dt) {
    S.t += dt; const apex = (P.cut && !P.paste) ? 0 : P.aux / 100 * (P.cut && P.paste ? 1 : 1); S.apexA = apex;
    const ck = P.ck / 100, inh = apex; S.drive = [];
    for (let i = 0; i < 6; i++) { const pos = i / 5; const aux_i = apex * (1 - pos * .35); const ckb = P.ckb ? .6 : 0; const drive = (ck * .9 + ckb) - aux_i * .9 + .12 + (i % 2 ? .02 : 0); S.drive.push(drive); S.g[i] = clamp(S.g[i] + (drive > .05 ? drive * dt * .12 : -dt * .04), 0, 1); }
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#EEF4EC", "#E6EEE2"); const nar = W < 560;
    const cx = nar ? W * .4 : W * .34, base = H * .88, topY = H * .1; const stemH = base - topY;
    c.fillStyle = "#8B6A47"; c.fillRect(0, base, nar ? W : W * .68, H - base);
    // корінь + цитокінін
    c.strokeStyle = "#EADFC2"; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, base); c.lineTo(cx, base + 12); c.moveTo(cx, base + 4); c.lineTo(cx - 24, base + 14); c.moveTo(cx, base + 4); c.lineTo(cx + 24, base + 14); c.stroke();
    // стебло
    const top = P.cut ? topY + stemH * .12 : topY;
    c.strokeStyle = "#4F9D50"; c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); c.moveTo(cx, base); c.lineTo(cx, top); c.stroke();
    if (P.cut) { c.fillStyle = P.paste ? "#E8A33B" : "#6B4A22"; c.fillRect(cx - 9, top - 5, 18, 7); if (P.paste) D.txt(c, "паста з ІОК", cx + 16, top - 6, { size: 10.5, weight: 700, color: "#B07A12" }); }
    else { c.fillStyle = "#6BB765"; c.beginPath(); c.ellipse(cx, top - 4, 12, 18, 0, 0, 7); c.fill(); D.txt(c, "верхівка (синтез ІОК)", cx + 20, top, { size: 10.5, weight: 700, color: "#B07A12" }); }
    // потік ауксину вниз (точки) і цитокініну вгору
    const ka = S.apexA || 0, kc = P.ck / 100;
    for (let i = 0; i < 18; i++) { const u = (t * .25 * (.4 + ka) + i / 18) % 1; if (ka > .02) { c.fillStyle = `rgba(232,163,59,${.85 * ka})`; c.beginPath(); c.arc(cx - 7, top + u * (base - top), 2.6, 0, 7); c.fill(); } const v = (t * .22 * (.4 + kc) + i / 18) % 1; if (kc > .02) { c.fillStyle = `rgba(60,150,200,${.8 * kc})`; c.beginPath(); c.arc(cx + 7, base - v * (base - top), 2.6, 0, 7); c.fill(); } }
    // бічні бруньки / пагони
    for (let i = 0; i < 6; i++) {
      const y = lerp(top + stemH * .16, base - stemH * .08, i / 5), g = S.g[i], side = i % 2 ? 1 : -1, len = 18 + g * 90;
      c.strokeStyle = g > .08 ? "#5FAE5C" : "#6B8A55"; c.lineWidth = 5 + g * 3; c.lineCap = "round"; c.beginPath(); c.moveTo(cx, y); c.lineTo(cx + side * (16 + g * 54), y - len * .5 - g * 8); c.stroke();
      c.fillStyle = g > .08 ? "#8FD07D" : "#8A7A4F"; c.beginPath(); c.arc(cx + side * (16 + g * 54), y - len * .5 - g * 8, 6 + g * 9, 0, 7); c.fill();
      if (P.ckb) { c.fillStyle = "rgba(60,150,200,.9)"; c.beginPath(); c.arc(cx + side * 6, y + 3, 3, 0, 7); c.fill(); }
    }
    D.txt(c, "бічні бруньки", cx - 28, top + stemH * .5, { size: 10.5, color: C.soft, align: "right" });
    // права панель
    const gx = nar ? 14 : W * .66, gw = nar ? W - 28 : W * .31; let y = nar ? H * .02 + 4 : 36;
    if (!nar) {
      const bar = (n, v, col, tx) => { D.txt(c, n, gx, y, { size: 11, color: C.soft }); c.fillStyle = "#E4ECE4"; D.rr(c, gx, y + 8, gw, 12, 6); c.fill(); c.fillStyle = col; D.rr(c, gx, y + 8, Math.max(4, gw * v), 12, 6); c.fill(); D.txt(c, tx, gx + gw, y, { size: 11, align: "right", weight: 700 }); y += 42; };
      bar("Ауксин від верхівки", S.apexA || 0, "#E8A33B", fmt((S.apexA || 0) * 100, 0) + " %"); bar("Цитокінін з кореня (+ на бруньки)", clamp(P.ck / 100 + (P.ckb ? .5 : 0), 0, 1), "#3C96C8", fmt(P.ck, 0) + " %");
      const n = S.g.filter(v => v > .3).length; D.txt(c, `Розбуджено бічних бруньок: ${n} з 6`, gx, y + 6, { size: 12, weight: 700, color: n ? "#2F7D4F" : C.soft });
      D.txt(c, n === 0 ? "Домінує верхівка: бруньки сплять." : n < 6 ? "Бруньки поступово «прокидаються»." : "Рослина кущиться.", gx, y + 26, { size: 11, color: C.soft });
    }
  },
  reads: (S, P) => { const n = (S.g || []).filter(v => v > .3).length; return [["Розбуджено бруньок", `${n} з 6`, ""], ["Ауксин вниз від верхівки", fmt((S.apexA || 0) * 100, 0), "%"], ["Цитокінін", fmt(P.ck, 0) + (P.ckb ? " + на бруньки" : ""), "%"], ["Тип росту", n === 0 ? "апікальне домінування" : n < 6 ? "перехідний" : "кущення", ""]]; },
});

/* ====================== 5. МАТРИЦЯ «ЕФЕКТ — ГОРМОН» ====================== */
const HORM = [["ІОК (ауксин)", "ауксин"], ["Цитокінін", "цитокінін"], ["Гіберелін", "гіберелін"], ["АБК", "абсцизова кислота"], ["Етилен", "етилен"], ["Брасиностероїди", "брасиностероїди"], ["Жасмонат", "жасмонова кислота"], ["Саліцилова к-та", "саліцилова кислота"]];
const EFF = [
  ["Розтягування клітин (ріст)", [2, 1, 2, -2, -1, 2, -1, 0]], ["Поділ клітин", [1, 2, 1, -1, 0, 1, -1, 0]], ["Апікальне домінування", [2, -2, 0, 0, 0, 0, 0, 0]], ["Утворення бічних коренів", [2, -1, 0, 0, 1, -2, 0, 0]],
  ["Подовження стебла", [1, 0, 2, -2, -1, 1, 0, 0]], ["Закривання продихів", [0, -1, 0, 2, 0, 0, 1, 0]], ["Спокій насіння", [0, -1, -2, 2, -1, 0, 0, 0]], ["Проростання насіння", [0, 1, 2, -2, 1, 0, 0, 0]],
  ["Старіння листків", [0, -2, -1, 1, 2, 0, 1, 0]], ["Дозрівання плодів", [0, 0, 0, 0, 2, 0, 0, 0]], ["Партенокарпія (плоди без насіння)", [2, 1, 2, 0, 0, 0, 0, 0]], ["Цвітіння (рослини довгого дня)", [0, 1, 2, 0, 0, 0, 0, 0]],
  ["Опадання листків і плодів", [-2, 0, 0, 2, 2, 0, 0, 0]], ["Захист від патогенів", [0, 0, 0, 0, 1, 0, 2, 2]], ["Стійкість до посухи, солі, холоду", [0, 0, 0, 2, 0, 1, 1, 0]],
];
const HD = {
  "ІОК (ауксин)": "Синтезується з триптофану переважно в апікальній меристемі пагона; рухається полярно від верхівки до основи (в корені — від основи до кінчика). Розтягування клітин, апікальне домінування, ризогенез, диференціація ксилеми, тропізми.",
  "Цитокінін": "Похідне аденіну (зеатин — основна форма); синтезується в апікальних меристемах коренів і рухається вгору ксилемою пасивно. Поділ клітин (разом з ауксином), затримка старіння, зняття апікального домінування, відкриття продихів.",
  "Гіберелін": "Дитерпенові кислоти; синтезуються в молодих листках, насінні, меристемах; пасивний транспорт ксилемою й флоемою. Подовження стебла, переривання спокою, мобілізація запасів при проростанні, цвітіння рослин довгого дня.",
  "АБК": "Сесквітерпен (С15), синтезується в листках і кореневому чохлику; «гормон стресу». Гальмує ріст, підтримує спокій, закриває продихи при водному дефіциті, сприяє опаданню.",
  "Етилен": "Єдиний газоподібний фітогормон; синтез із метіоніну через АЦК. Дозрівання плодів, старіння, «потрійна реакція» проростка, опадання, утворення аеренхіми при затопленні.",
  "Брасиностероїди": "Стероїди (брасинолід), понад 60 сполук; висока концентрація у молодих тканинах і пилку. Розтягування клітин, диференціація ксилеми, гальмування бічних коренів, стійкість до стресів.",
  "Жасмонат": "Похідне ліноленової кислоти; метилжасмонат — леткий. Гальмує вегетативний ріст, посилює імунну відповідь, закриває продихи, запускає синтез захисних білків.",
  "Саліцилова к-та": "Синтез із фенілаланіну; метилсаліцилат — леткий. Термогенез ароїдних, системна стійкість до патогенів (PR-білки); приєднується до залізовмісних ферментів, змінює вміст H₂O₂.",
};
reg("r-matrix", {
  dom(body) {
    body.innerHTML = `<div class="ph-dom"><div class="ph-chips" id="mh"></div><div style="overflow-x:auto"><table class="data-table ex-table" id="mt"></table></div><div class="ph-panel" id="mi"><b>Оберіть гормон</b>, щоб побачити коротку довідку, або клацніть на ефект, щоб підсвітити рядок.</div><p class="ex-note" style="margin:0"><b>+ +</b> сильно стимулює · <b>+</b> стимулює · <b>−</b> гальмує · <b>− −</b> сильно гальмує · порожньо — не описано в посібнику. Знаки відображають узагальнення із посібника й залежать від концентрації, виду та стану рослини.</p></div>`;
    const tb = body.querySelector("#mt"), info = body.querySelector("#mi"), chips = body.querySelector("#mh"); let selH = -1, selE = -1;
    const sym = (v) => ({ 2: "+ +", 1: "+", 0: "", "-1": "−", "-2": "− −" }[v]); const col = (v) => v > 0 ? `rgba(47,125,79,${.12 + v * .14})` : v < 0 ? `rgba(192,57,43,${.12 - v * .12})` : "transparent";
    const draw = () => {
      tb.innerHTML = `<thead><tr><th>Ефект</th>${HORM.map(([n], i) => `<th style="${selH === i ? "background:#E3F1E8" : ""}">${n}</th>`).join("")}</tr></thead><tbody>${EFF.map(([e, v], r) => `<tr data-r="${r}" style="${selE === r ? "outline:2px solid #2F7D4F" : ""};cursor:pointer"><td><b>${e}</b></td>${v.map((x, i) => `<td style="text-align:center;font-weight:800;background:${col(x)};${selH === i ? "box-shadow:inset 0 0 0 2px #2F7D4F" : ""}">${sym(x)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      tb.querySelectorAll("tr[data-r]").forEach(tr => tr.addEventListener("click", () => { selE = +tr.dataset.r; const [e, v] = EFF[selE]; const plus = HORM.filter((h, i) => v[i] > 0).map(h => h[0]), minus = HORM.filter((h, i) => v[i] < 0).map(h => h[0]); info.innerHTML = `<h4>${e}</h4><p style="margin:0 0 4px"><b>Стимулюють:</b> ${plus.join(", ") || "—"}</p><p style="margin:0"><b>Гальмують:</b> ${minus.join(", ") || "—"}</p>`; draw(); }));
      [...chips.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === selH)));
    };
    HORM.forEach(([n], i) => chips.append(btn(n, "", () => { selH = i; selE = -1; info.innerHTML = `<h4>${n}</h4><p style="margin:0">${HD[n]}</p>`; draw(); })));
    draw();
  },
});

/* ====================== 6. ЕТИЛЕН І ДОЗРІВАННЯ ПЛОДІВ ====================== */
const FRUITS = { citrus: { n: "Лимони й апельсини", norm: 22, eth: 4.5, c0: "#8FB04B", c1: "#F2B223" }, tomato: { n: "Помідори", norm: 11, eth: 5.5, c0: "#8DB04B", c1: "#D93A2B" } };
reg("r-ripen", {
  aspect: (w) => (w < 560 ? 1.05 : 1.8),
  modes: [["citrus", "Лимони й апельсини"], ["tomato", "Помідори"]],
  params: [{ k: "eth", label: "Етилен у камері", min: 0, max: 100, step: 5, v: 0, u: "%" }],
  presets: [{ label: "Звичайне дозрівання", set: { eth: 0 } }, { label: "Камера з етиленом", set: { eth: 100 } }], presetsLabel: "Умови",
  info: "Етилен — єдиний газоподібний фітогормон; саме він запускає дозрівання. У промисловості недозрілі плоди поміщають у камери, куди періодично подають етилен: за даними посібника лимони й апельсини дозрівають на 4–5-ту добу (замість звичайних 20–25), помідори — на 5–6-ту (замість 10–12). Модель плавно інтерполює час дозрівання між цими значеннями залежно від концентрації етилену.",
  init() { const r = rng(6); return { day: 0, mol: Array.from({ length: 40 }, () => ({ x: r(), y: r(), v: r() })), t: 0 }; },
  step(S, P, dt) { const f = FRUITS[P.mode]; S.T = lerp(f.norm, f.eth, P.eth / 100); S.day = S.day + dt * 1.2; if (S.day > S.T * 1.5) S.day = 0; S.t += dt; for (const m of S.mol) { m.x += (Math.random() - .5) * .02 + .002; m.y += (Math.random() - .5) * .02 - .0015 * m.v; m.x = (m.x + 1) % 1; m.y = clamp(m.y, 0, 1); } },
  draw(c, S, P, W, H, t) {
    const f = FRUITS[P.mode]; D.bg(c, W, H, "#F4F4EC", "#E8ECE2"); const nar = W < 560;
    const chW = nar ? W - 24 : W * .6, chH = nar ? H * .5 : H - 70, x0 = 12, y0 = 40;
    c.fillStyle = "#EEF3F2"; D.rr(c, x0, y0, chW, chH, 14); c.fill(); c.strokeStyle = "#90A4A0"; c.lineWidth = 2; c.stroke();
    D.txt(c, P.eth > 0 ? "камера з етиленом" : "звичайні умови", x0 + 12, y0 - 14, { size: 11.5, weight: 700, color: C.soft });
    const nm = Math.round(P.eth / 100 * 36); for (let i = 0; i < nm; i++) { const m = S.mol[i]; c.fillStyle = "rgba(60,150,200,.6)"; c.beginPath(); c.arc(x0 + 8 + m.x * (chW - 16), y0 + 8 + m.y * (chH - 16), 2.6, 0, 7); c.fill(); }
    const r = clamp(S.day / S.T, 0, 1); const col = mixHex(f.c0, f.c1, smooth(r));
    const cols = nar ? 3 : 3, rows = 2; for (let k = 0; k < 6; k++) { const cx = x0 + chW * (.2 + (k % cols) * .3), cy = y0 + chH * (.32 + Math.floor(k / cols) * .38), rad = Math.min(chW, chH) * .1; D.sphere(c, cx, cy, rad, mixHex(col, "#000000", (hash01(k, 8) - .5) * .12)); if (P.mode === "tomato") { c.fillStyle = "#3F7D45"; c.beginPath(); c.moveTo(cx, cy - rad * .9); for (let q = 0; q < 5; q++) { const a = q * 1.256; c.lineTo(cx + Math.cos(a) * rad * .5, cy - rad * .85 + Math.sin(a) * rad * .2); c.lineTo(cx, cy - rad * .8); } c.fill(); } }
    const gx = nar ? 14 : W * .66, gy = nar ? y0 + chH + 40 : 52, gw = nar ? W - 28 : W * .32;
    D.txt(c, `Доба: ${fmt(S.day, 1)}`, gx, gy - 14, { size: 12, weight: 700 }); c.fillStyle = "#E4ECE4"; D.rr(c, gx, gy, gw, 16, 8); c.fill(); c.fillStyle = mixHex("#8FB04B", f.c1, smooth(r)); D.rr(c, gx, gy, Math.max(6, gw * r), 16, 8); c.fill(); D.txt(c, `стиглість ${fmt(r * 100, 0)} %`, gx + gw, gy + 30, { size: 11, align: "right", weight: 700 });
    D.txt(c, "Час до дозрівання:", gx, gy + 56, { size: 11.5, weight: 700 });
    const bw = gw; [["без етилену", f.norm, "#B9C6B0"], ["у цій камері", S.T, "#2F7D4F"]].forEach(([n, v, col], i) => { const yy = gy + 66 + i * 34; D.txt(c, `${n}: ${fmt(v, 1)} діб`, gx, yy + 4, { size: 11, color: C.soft }); c.fillStyle = col; D.rr(c, gx, yy + 14, bw * v / (f.norm + 2), 10, 5); c.fill(); });
    if (S.day === 0) D.tag(c, "цикл спочатку", x0 + chW / 2, y0 + chH + 14, { size: 10.5, bg: "#fff", stroke: C.rule, color: C.muted });
  },
  reads: (S, P) => { const f = FRUITS[P.mode]; return [["Плоди", f.n, ""], ["Час дозрівання без етилену", fmt(f.norm, 0), "діб"], ["Час при цій концентрації", fmt(S.T || f.norm, 1), "діб"], ["Прискорення", "×" + fmt(f.norm / (S.T || f.norm), 1), ""]]; },
});
