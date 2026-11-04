/* Сучасні методи: UAE, MAE/SFME, SFE-CO2, SWE/PLE, EAE, PEF, NADES, міцелярна екстракція/CPE. */
import { reg, D, C, clamp, lerp, smooth, rng, hash01, fmt, mixHex, alpha, extractColor } from "./extr-core.js";

const interp = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return lerp(ys[i - 1], ys[i], t); } return ys[ys.length - 1]; };
const sig = (x) => 1 / (1 + Math.exp(-x));

/* ====================== УЛЬТРАЗВУКОВА ЕКСТРАКЦІЯ ====================== */
reg("uae", {
  aspect: 1.65,
  modes: [["bath", "Ультразвукова ванна (непряма дія)"], ["probe", "Зонд-сонотрод (пряма дія)"]],
  params: [
    { k: "P", label: "Потужність", min: 50, max: 500, step: 25, v: 200, u: "Вт" },
    { k: "f", label: "Частота", min: 20, max: 80, step: 5, v: 40, u: "кГц" },
  ],
  info: "Ультразвук створює в рідині акустичну кавітацію: бульбашки ростуть і схлопуються біля поверхні частинки, утворюючи мікроструміні та ударні хвилі, які <b>руйнують клітинні стінки</b> і прискорюють вихід БАР. Нижча частота дає більші бульбашки й сильніший ефект. Зворотний бік: тривала сонікація й нагрів породжують вільні радикали (·OH) та деградацію поліфенолів, а кавітаційна зона обмежена кількома сантиметрами від випромінювача — звідси складність масштабування.",
  init() {
    const r = rng(21), ps = []; for (let i = 0; i < 14; i++) ps.push({ x: 160 + r() * 140, y: 230 + r() * 100, vx: 0, vy: 0, rot: r() * 6, dmg: 0, L: 1 });
    const dots = []; for (let i = 0; i < 60; i++) dots.push({ x: 150 + r() * 160, y: 220 + r() * 120, a: r() * 6 });
    return { ps, dots, bub: [], fl: [], tmin: 0, Y: 0, Dg: 0, hist: [], Yc: 0, n: 0 };
  },
  step(S, P, dt) {
    const probe = P.mode === "probe", pw = P.P / 500, tm = dt * 4;
    S.tmin += tm; const T = 25 + (P.P / 300) * 14 * (1 - Math.exp(-S.tmin / 12)) * (probe ? 2.3 : 1); S.T = T;
    const kC = .03, kU = kC * (1 + 6 * (P.P / 300) * Math.sqrt(40 / P.f) * (probe ? 1.5 : 1)), kd = .0009 * Math.exp((T - 45) / 8) * Math.pow(P.P / 200, 1.2);
    for (let i = 0; i < 4; i++) { const h = tm / 4; const dY = kU * (1 - S.Y - S.Dg) * h - kd * S.Y * h; S.Dg += kd * S.Y * h; S.Y += dY; }
    S.Yc = 1 - Math.exp(-kC * S.tmin);
    if (!S.hist.length || S.tmin - S.hist[S.hist.length - 1][0] > 1) S.hist.push([S.tmin, S.Y * 100, S.Yc * 100, S.T]);
    const r = Math.random, cxz = probe ? 230 : 230, tipY = 250;
    for (const p of S.ps) { p.vx += (r() - .5) * 40 * dt; p.vy += (r() - .5) * 40 * dt; p.vx *= .95; p.vy *= .95; p.x = clamp(p.x + p.vx * dt, 158, 302); p.y = clamp(p.y + p.vy * dt, probe ? 250 : 230, probe ? 355 : 330); p.L = Math.max(0, 1 - S.Y * 1.1 * (.6 + .4 * hash01(S.ps.indexOf(p), 9))); }
    const rate = pw * 22 * (probe ? 1.7 : 1) * dt;
    if (r() < rate) { const p = S.ps[Math.floor(r() * S.ps.length)]; const a = r() * 6.28; S.bub.push({ x: probe && r() < .5 ? cxz + (r() - .5) * 60 : p.x + Math.cos(a) * 11, y: probe && r() < .5 ? tipY + 20 + r() * 40 : p.y + Math.sin(a) * 9, age: 0, rmax: 5 + 220 / P.f * 1.0, p }); }
    for (const b of S.bub) { b.age += dt * 2.2; if (b.age >= 1 && !b.done) { b.done = true; S.fl.push({ x: b.x, y: b.y, t: 0, ang: Math.atan2(b.p.y - b.y, b.p.x - b.x) }); b.p.dmg = Math.min(1, b.p.dmg + .06); S.n++; } }
    S.bub = S.bub.filter(b => b.age < 1.02);
    for (const f of S.fl) f.t += dt * 3; S.fl = S.fl.filter(f => f.t < 1);
    for (const d of S.dots) { d.a += dt * 1.5; d.x = clamp(d.x + Math.cos(d.a) * 14 * dt, 154, 306); d.y = clamp(d.y + Math.sin(d.a * 1.3) * 12 * dt, probe ? 240 : 224, 350); }
    S.wave = (S.wave || 0) + dt * (P.f / 30);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const probe = P.mode === "probe", pw = P.P / 500;
    D.fit(c, 6, 4, W * .62, H - 8, 460, probe ? 400 : 290, (s) => {
      if (!probe) c.translate(0, -110);
      if (!probe) {
        const g = c.createLinearGradient(40, 0, 420, 0); g.addColorStop(0, "#9AA8AF"); g.addColorStop(.5, "#DDE4E7"); g.addColorStop(1, "#8E9BA2"); c.fillStyle = g; D.rr(c, 40, 196, 380, 190, 14); c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 1.6; c.stroke();
        c.fillStyle = "rgba(142,193,234,.55)"; D.rr(c, 52, 214, 356, 160, 8); c.fill();
        c.strokeStyle = "#58666E"; c.lineWidth = 3; c.beginPath(); for (let x = 60; x <= 400; x += 14) c.lineTo(x, 366 + ((x / 14) % 2 ? 3 : -3)); c.stroke(); D.txt(c, "випромінювач (піезоелементи)", 230, 392, { size: 11, align: "center", color: C.soft, weight: 700 });
        // хвилі
        for (let k = 0; k < 5; k++) { const ph = ((S.wave || 0) * .5 + k / 5) % 1; c.strokeStyle = `rgba(255,255,255,${.5 * (1 - ph)})`; c.lineWidth = 2; c.beginPath(); c.moveTo(60, 360 - ph * 160); for (let x = 60; x <= 400; x += 8) c.lineTo(x, 360 - ph * 160 + Math.sin(x * .06 + t * 6) * 2.5); c.stroke(); }
      } else {
        D.stand(c, 400, 392, 380); D.clamp(c, 400, 90, 236); c.fillStyle = "#4C5C64"; D.rr(c, 190, 24, 90, 40, 8); c.fill(); D.txt(c, "генератор", 235, 44, { size: 11, color: "#fff", align: "center", weight: 700 });
        c.fillStyle = "#8997A0"; c.fillRect(231, 64, 8, 196); c.fillStyle = "#6B7B83"; c.beginPath(); c.moveTo(220, 254); c.lineTo(250, 254); c.lineTo(244, 266); c.lineTo(226, 266); c.closePath(); c.fill();
      }
      const bx = 150, bw = 160, by = probe ? 196 : 190, bh = probe ? 176 : 150;
      D.vessel(c, D.beakerPath(bx, by, bw, bh, 10), bx, by, bw, bh, .86, extractColor(S.Y * 1.2, "green"), { a: .75, inside: (cc) => {
        for (const d of S.dots) { if (hash01(S.dots.indexOf(d), 4) > S.Y * 1.05 + .03) continue; cc.fillStyle = "rgba(150,90,10,.8)"; cc.beginPath(); cc.arc(d.x, d.y + (probe ? 0 : 0), 1.9, 0, 7); cc.fill(); }
        for (const p of S.ps) { D.chip(cc, p.x, p.y, 8.5, p.rot + t * .1, mixHex("#4F8F45", "#B9B07A", 1 - p.L), p.L); if (p.dmg > .1) { cc.strokeStyle = "rgba(120,30,20,.8)"; cc.lineWidth = 1; cc.beginPath(); cc.moveTo(p.x - 5, p.y - 3); cc.lineTo(p.x + 1, p.y + 1 + p.dmg * 3); cc.lineTo(p.x + 6, p.y - 2); cc.stroke(); } }
        for (const b of S.bub) { const r = Math.max(1, Math.sin(b.age * Math.PI * .5) * b.rmax * .22); cc.strokeStyle = "rgba(255,255,255,.95)"; cc.lineWidth = 1.2; cc.fillStyle = "rgba(255,255,255,.35)"; cc.beginPath(); cc.arc(b.x, b.y, r, 0, 7); cc.fill(); cc.stroke(); }
        for (const f of S.fl) { cc.strokeStyle = `rgba(255,240,150,${1 - f.t})`; cc.lineWidth = 2; cc.beginPath(); cc.moveTo(f.x, f.y); cc.lineTo(f.x + Math.cos(f.ang) * (6 + f.t * 16), f.y + Math.sin(f.ang) * (6 + f.t * 16)); cc.stroke(); D.glow(cc, f.x, f.y, 12 * (1 - f.t) + 3, "#FFF3B0", .8 * (1 - f.t)); }
        if (probe) { D.glow(cc, 235, 270, 56, "#FFFFFF", .22 + .3 * pw); }
      } });
      D.tag(c, probe ? "кавітація біля сонотрода — найсильніша" : "кавітація — слабша й нерівномірна", 230, probe ? 12 : 140, { size: 11.5 });
    });
    const gx = W * .65, gww = W * .31, gy = 38, gh = H * .5;
    D.chart(c, gx + 24, gy, gww - 24, gh, { x: [0, 60], y: [0, 100], xl: "хв", yl: "вихід БАР, %", series: [{ pts: S.hist.map(p => [p[0], p[2]]), col: C.steel, w: 2.2, dash: [5, 4] }, { pts: S.hist.map(p => [p[0], p[1]]), col: C.green, w: 2.8, fill: "rgba(47,125,79,.12)" }], title: "UAE проти звичайної екстракції" });
    c.fillStyle = C.green; c.fillRect(gx + 24, gy + gh + 30, 14, 4); D.txt(c, "з ультразвуком", gx + 44, gy + gh + 32, { size: 11.5, color: C.soft }); c.fillStyle = C.steel; c.fillRect(gx + 24, gy + gh + 50, 14, 4); D.txt(c, "без ультразвуку (та сама T)", gx + 44, gy + gh + 52, { size: 11.5, color: C.soft });
    const T = S.T || 25; D.tag(c, `T розчину ≈ ${fmt(T, 0)} °C`, gx + 24 + (gww - 24) / 2, gy + gh + 84, { size: 12, bg: T > 50 ? "#FDECEA" : "#fff", stroke: T > 50 ? C.red : "rgba(0,0,0,.14)", color: T > 50 ? C.red : C.ink });
    if (S.Dg > .03) D.txt(c, `деградація від ·OH: ${fmt(S.Dg * 100, 0)} %`, gx + 24, gy + gh + 112, { size: 11.5, color: C.red, weight: 700 });
  },
  reads: (S, P) => [["Час", fmt(S.tmin, 0), "хв"], ["Вихід", fmt(S.Y * 100, 0), "%"], ["Без УЗ", fmt(S.Yc * 100, 0), "%"], ["Кавітаційних подій", String(S.n)]],
});

/* ====================== МІКРОХВИЛЬОВА ЕКСТРАКЦІЯ ====================== */
const MW = { eth: { n: "70 % етанол", k: 1.0, col: "#D9A441" }, hex: { n: "гексан", k: .03, col: "#CFE6F2" }, sf: { n: "без розчинника (SFME)", k: .85, col: "#B9D27A" } };
reg("mae", {
  aspect: 1.65,
  modes: [["eth", "MAE: водний етанол (добре нагрівається)"], ["hex", "MAE: гексан (прозорий для мікрохвиль)"], ["sf", "SFME: без розчинника, на власній воді рослини"]],
  params: [{ k: "P", label: "Потужність", min: 100, max: 800, step: 50, v: 400, u: "Вт" }],
  info: "Мікрохвилі (2450 МГц) нагрівають <b>полярні</b> молекули (вода, етанол) через дипольну поляризацію та іонну провідність. Внутрішньоклітинна вода закипає, тиск розриває клітини й залозки. <b>Гексан прозорий для мікрохвиль</b> і майже не нагрівається. У SFME свіжу сировину нагрівають без розчинника — олія переганяється з власною водою рослини: ефірні олії базиліку, м'яти кучерявої й чебрецю за 30 хв дали склад, подібний до гідродистиляції за 4,5 год (Lucchesi та ін., 2004).",
  init(P) { const r = rng(5), dip = []; for (let i = 0; i < 26; i++) dip.push({ x: r(), y: r(), a: r() * 6, w: .6 + r() }); const gl = []; for (let i = 0; i < 9; i++) gl.push({ a: i / 9 * 6.28 + .3, burst: 0, done: false }); return { T: 22, tmin: 0, dip, gl, oil: [], Y: 0, hist: [], rup: 0, ang: 0 }; },
  step(S, P, dt) {
    const m = MW[P.mode], tm = dt * 1.4; S.tmin += tm; S.ang += dt * 2;
    const Tmax = P.mode === "sf" ? 100 : P.mode === "eth" ? 78 : 69, rate = (P.P / 400) * m.k * 14;   // °C/хв
    S.T = Math.min(Tmax, S.T + rate * tm); if (P.mode === "hex") S.T = Math.min(Tmax, S.T + .12 * tm);
    const hot = clamp((S.T - 50) / 40, 0, 1);
    if (P.mode === "sf") S.Y += (1 - S.Y) * (1 - Math.exp(-tm * (hot * .22 + .004))); else if (P.mode === "eth") S.Y += (1 - S.Y) * (1 - Math.exp(-tm * (hot * .12 + .008))); else S.Y += (1 - S.Y) * (1 - Math.exp(-tm * .006));
    S.rup = clamp(S.Y * 1.05, 0, 1);
    for (const g of S.gl) if (!g.done && S.rup > hash01(S.gl.indexOf(g), 2) * .9 + .05) { g.done = true; g.burst = 1; for (let k = 0; k < 6; k++) S.oil.push({ a: g.a, s: 0, v: .5 + Math.random() * .6, j: Math.random() }); }
    for (const g of S.gl) g.burst = Math.max(0, g.burst - dt * 1.4);
    for (const o of S.oil) o.s += dt * o.v * .5; S.oil = S.oil.filter(o => o.s < 1);
    for (const d of S.dip) d.a += dt * d.w * (m.k > .1 ? 6 * clamp(S.T / 60, .2, 1) : 0);
    if (!S.hist.length || S.tmin - S.hist[S.hist.length - 1][0] > 1) S.hist.push([S.tmin, S.T, S.Y * 100]);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const m = MW[P.mode], sf = P.mode === "sf";
    D.fit(c, 6, 4, W * .64, H - 8, 520, 400, (s) => {
      // мікрохвильова піч
      c.fillStyle = "#C9D3D8"; D.rr(c, 20, 110, 250, 250, 14); c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 1.8; c.stroke();
      c.fillStyle = "#1F2B31"; D.rr(c, 36, 126, 178, 218, 8); c.fill(); c.fillStyle = "#3A474E"; D.rr(c, 224, 126, 34, 218, 6); c.fill(); for (let i = 0; i < 5; i++) { c.fillStyle = i === 0 ? C.green : "#8996A0"; c.beginPath(); c.arc(241, 150 + i * 30, 6, 0, 7); c.fill(); }
      D.txt(c, `${P.P} Вт`, 241, 322, { size: 10.5, color: "#fff", align: "center", weight: 700 });
      // магнетрон та хвилі
      c.fillStyle = C.violet; D.rr(c, 36, 84, 60, 26, 6); c.fill(); D.txt(c, "магнетрон", 66, 97, { size: 10, color: "#fff", align: "center", weight: 700 });
      for (let k = 0; k < 5; k++) { const ph = ((t * .8 + k * .2) % 1); c.strokeStyle = `rgba(190,150,255,${.75 * (1 - ph)})`; c.lineWidth = 2; c.beginPath(); for (let x = 70; x < 70 + ph * 110; x += 4) { const y = 150 + k * 32 + Math.sin(x * .25 - t * 14) * (4 + P.P / 100); x === 70 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); }
      // поворотний столик + посудина
      c.fillStyle = "#6B7B83"; c.beginPath(); c.ellipse(125, 330, 70, 9, 0, 0, 7); c.fill();
      D.vessel(c, D.beakerPath(88, 232, 74, 96, 8), 88, 232, 74, 96, sf ? .0 : .7, m.col, { a: .7, inside: (cc) => { const r2 = rng(5); for (let i = 0; i < 9; i++) D.chip(cc, 96 + r2() * 58, 262 + r2() * 56, 6, r2() * 6 + S.ang * .1, mixHex("#4F8F45", "#B9B07A", S.Y * .7)); } });
      if (sf) { c.fillStyle = "rgba(255,255,255,.8)"; for (let i = 0; i < 6; i++) { const ph = (t * .5 + i / 6) % 1; c.beginPath(); c.arc(100 + i * 10, 240 - ph * 30, 2 + ph * 2, 0, 7); c.fill(); } }
      // збільшення: клітина із залозками
      const zx = 400, zy = 250, zr = 100; c.strokeStyle = "rgba(60,80,70,.4)"; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(125, 232); c.lineTo(zx - 60, zy - zr + 14); c.moveTo(150, 330); c.lineTo(zx - 40, zy + zr - 10); c.stroke(); c.setLineDash([]);
      c.save(); c.beginPath(); c.arc(zx, zy, zr, 0, 7); c.fillStyle = m.col; c.globalAlpha = .55; c.fill(); c.globalAlpha = 1; c.clip();
      const tissueR = 62; c.fillStyle = "#CFE6B8"; c.beginPath(); c.arc(zx, zy, tissueR, 0, 7); c.fill(); c.strokeStyle = "#4F8F45"; c.lineWidth = 3; c.stroke(); c.fillStyle = sf ? "#A8D2EE" : "#9CC98A"; c.globalAlpha = .65; c.beginPath(); c.arc(zx, zy, tissueR - 6, 0, 7); c.fill(); c.globalAlpha = 1;
      // нагрів: світіння
      const hot = clamp((S.T - 30) / 70, 0, 1); D.glow(c, zx, zy, tissueR + 24, "#FF7A3C", .55 * hot);
      for (const g of S.gl) { const gx2 = zx + Math.cos(g.a) * (tissueR + 2), gy2 = zy + Math.sin(g.a) * (tissueR + 2); if (!g.done) { D.sphere(c, gx2, gy2, 8, "#E4B63B"); } else { c.fillStyle = "rgba(228,182,59,.35)"; c.beginPath(); c.arc(gx2, gy2, 8, 0, 7); c.fill(); if (g.burst > 0) D.glow(c, gx2, gy2, 24 * g.burst + 6, "#FFF0A0", .8 * g.burst); } }
      for (const o of S.oil) { const x = zx + Math.cos(o.a) * (tissueR + o.s * 54), y = zy + Math.sin(o.a) * (tissueR + o.s * 54); D.sphere(c, x, y, 3.2, "#E4B63B"); }
      // диполі
      if (m.k > .1 || true) for (const d of S.dip) { const dx = zx + (d.x - .5) * zr * 1.9, dy = zy + (d.y - .5) * zr * 1.9; if (Math.hypot(dx - zx, dy - zy) < tissueR - 6 || Math.hypot(dx - zx, dy - zy) > zr - 8) continue; const ang = d.a; c.strokeStyle = m.k > .1 ? "#2E6FB5" : "#8996A0"; c.lineWidth = 2.2; c.beginPath(); c.moveTo(dx - Math.cos(ang) * 6, dy - Math.sin(ang) * 6); c.lineTo(dx + Math.cos(ang) * 6, dy + Math.sin(ang) * 6); c.stroke(); c.fillStyle = "#D9534F"; c.beginPath(); c.arc(dx + Math.cos(ang) * 6, dy + Math.sin(ang) * 6, 2.4, 0, 7); c.fill(); c.fillStyle = "#2E6FB5"; c.beginPath(); c.arc(dx - Math.cos(ang) * 6, dy - Math.sin(ang) * 6, 2.4, 0, 7); c.fill(); }
      c.restore(); c.strokeStyle = C.steelD; c.lineWidth = 2; c.beginPath(); c.arc(zx, zy, zr, 0, 7); c.stroke();
      D.txt(c, sf ? "залозки розриваються парою власної води" : P.mode === "eth" ? "диполі розчинника обертаються й гріють" : "диполів немає: розчинник холодний", zx, zy + zr + 18, { size: 11, align: "center", color: C.soft, weight: 700 });
      D.tag(c, `T = ${fmt(S.T, 0)} °C`, zx, zy - zr - 16, { size: 12.5, bg: S.T > 70 ? "#FDECEA" : "#fff", stroke: S.T > 70 ? C.red : "rgba(0,0,0,.14)", color: S.T > 70 ? C.red : C.ink });
    });
    const gx = W * .66, gww = W * .3, gy = 38, gh = H * .5;
    if (sf) {
      const hd = (x) => 100 * (1 - Math.exp(-x / 70)), sfm = (x) => 100 * (1 - Math.exp(-x / 9)); const xs = []; for (let x = 0; x <= 280; x += 4) xs.push(x);
      D.chart(c, gx + 24, gy, gww - 24, gh, { x: [0, 280], y: [0, 100], xl: "хв", yl: "олія, % від макс.", series: [{ pts: xs.map(x => [x, hd(x)]), col: C.steel, w: 2.2, dash: [5, 4] }, { pts: xs.map(x => [x, sfm(x)]), col: C.green, w: 2.6 }], vl: [{ x: 30, col: C.green, label: "30 хв" }, { x: 270, col: C.steel, label: "4,5 год" }], marks: [{ x: Math.min(S.tmin, 280), y: sfm(S.tmin), col: C.red }], title: "SFME проти гідродистиляції" });
      c.fillStyle = C.green; c.fillRect(gx + 24, gy + gh + 30, 14, 4); D.txt(c, "SFME (мікрохвилі, без розчинника)", gx + 44, gy + gh + 32, { size: 11, color: C.soft }); c.fillStyle = C.steel; c.fillRect(gx + 24, gy + gh + 50, 14, 4); D.txt(c, "гідродистиляція", gx + 44, gy + gh + 52, { size: 11, color: C.soft });
    } else {
      const xs = []; for (let x = 0; x <= 30; x += 1) xs.push(x); const col = (k, cap) => xs.map(x => [x, Math.min(cap, 22 + k * (P.P / 400) * 14 * x)]);
      D.chart(c, gx + 24, gy, gww - 24, gh, { x: [0, 30], y: [20, 100], xl: "хв", yl: "T, °C", series: [{ pts: col(1, 78), col: "#D9A441", w: 2.4 }, { pts: col(.03, 69).map(p => [p[0], Math.min(69, 22 + .12 * p[0] + .03 * 14 * (P.P / 400) * p[0])]), col: "#6FB7D9", w: 2.4 }], hl: [{ y: 78, col: C.muted, label: "T кипіння етанолу" }], marks: [{ x: Math.min(S.tmin, 30), y: S.T, col: C.red }], title: "Нагрів розчинника (при цій потужності)" });
      c.fillStyle = "#D9A441"; c.fillRect(gx + 24, gy + gh + 30, 14, 4); D.txt(c, "70 % етанол", gx + 44, gy + gh + 32, { size: 11, color: C.soft }); c.fillStyle = "#6FB7D9"; c.fillRect(gx + 24, gy + gh + 50, 14, 4); D.txt(c, "гексан", gx + 44, gy + gh + 52, { size: 11, color: C.soft });
    }
    D.txt(c, `Вилучено: ${fmt(S.Y * 100, 0)} %`, gx + 24, gy + gh + 86, { size: 14, weight: 800, color: C.greenD }); D.txt(c, `${fmt(S.tmin, 0)} хв (модельний час)`, gx + 24, gy + gh + 108, { size: 11.5, color: C.soft });
  },
  reads: (S, P) => [["Температура", fmt(S.T, 0), "°C"], ["Час", fmt(S.tmin, 0), "хв"], ["Вилучено", fmt(S.Y * 100, 0), "%"], ["Розчинник", MW[P.mode].n]],
});

/* ====================== НАДКРИТИЧНА ФЛЮЇДНА ЕКСТРАКЦІЯ (CO2) ====================== */
const GT = [35, 40, 50, 60, 80], GP = [8, 10, 15, 20, 30, 40, 55];
const GR = [[420, 712, 817, 868, 925, 971, 1015], [277, 628, 781, 840, 911, 960, 1008], [220, 385, 654, 786, 880, 931, 985], [189, 288, 506, 665, 802, 886, 950], [150, 207, 311, 458, 656, 770, 870]];
const psat = (T) => interp([0, 10, 20, 25, 30, 31.1], [3.49, 4.5, 5.73, 6.43, 7.21, 7.38], T);
function dens(P, T) {   // оцінка густини CO2, кг/м³ (орієнтовна інтерполяція довідкових значень)
  if (T < 31.1) { const liq = interp([0, 20, 31], [927, 770, 600], T); return P > psat(T) ? liq + (P - psat(T)) * 3 : Math.max(10, P * 30); }
  const Tc = clamp(T, 35, 80), Pc = clamp(P, 8, 55), ti = GT.findIndex((v, i) => Tc <= GT[i + 1] || i === GT.length - 2), tt = (Tc - GT[ti]) / (GT[ti + 1] - GT[ti]);
  const row = (i) => interp(GP, GR[i], Pc); let d = lerp(row(ti), row(ti + 1), tt); if (P < 8) d = lerp(Math.max(60, P * 24), d, smooth(clamp((P - 3) / 5, 0, 1))); if (T < 35) d = lerp(Math.max(d * .9, 250), d, clamp((T - 31.1) / 3.9, 0, 1)); return d;
}
const SFE_PRE = [
  { label: "Лаванда, олія: 9 МПа, 48 °C", set: { P: 9, T: 48, cs: 0 }, note: "лаванда, м'який режим: 150 хв, вихід олії 4,9 %, ліналілацетату 34,7 % проти 12,1 % у гідродистиляті" },
  { label: "Лаванда, олія + феноли: 25 МПа, 60 °C", set: { P: 25, T: 60, cs: 0 }, note: "лаванда, «жорсткий» режим: 45 хв, вихід до 9,2 % (олія, феноли, воски)" },
  { label: "Ромашка: 20 МПа, 40 °C", set: { P: 20, T: 40, cs: 0 }, note: "ромашка: ≈ 2 год, вихід CO₂-екстракту 2,8 % (це не ефірна олія, а олія + ліпофільні нелеткі сполуки)" },
  { label: "Обліпиха, вичавки: 45 МПа, 35 °C", set: { P: 45, T: 35, cs: 0 }, note: "обліпиха, вичавки: 105 хв, найвищий вміст каротиноїдів, β-каротину й токоферолів" },
  { label: "Обліпиха, ягоди: 34,5 МПа, 44 °C", set: { P: 34.5, T: 44, cs: 0 }, note: "обліпиха, цілі ягоди: 80 хв, вилучено 71,7 % каротину й 85,1 % токоферолів" },
];
reg("sfe", {
  aspect: 1.6,
  params: [
    { k: "P", label: "Тиск", min: 3, max: 60, step: .5, v: 25, u: "МПа", d: 1 },
    { k: "T", label: "Температура", min: 10, max: 90, step: 1, v: 45, u: "°C" },
    { k: "cs", label: "Ко-розчинник (етанол)", min: 0, max: 15, step: 1, v: 0, u: "%" },
  ],
  toggles: [{ k: "frac", label: "Ступеневе фракціонування в сепараторах (воски окремо від олії)", v: true }],
  presets: SFE_PRE, presetsLabel: "Режими з літератури",
  info: "Вище критичної точки CO₂ (31,1 °C; 7,38 МПа) густина близька до рідини (висока розчинна здатність), а в'язкість і дифузія — до газу (швидке проникнення). <b>Тиском і температурою розчинну здатність налаштовують</b>: при зростанні тиску густина зростає. Після дроселювання CO₂ випаровується й екстракт лишається без розчинника. Для полярних БАР додають 1–15 % етанолу. Густини — оціночна інтерполяція довідкових даних, розчинність — якісна модель.",
  init() { const r = rng(8), dots = []; for (let i = 0; i < 90; i++) dots.push({ s: r() }); const ch = []; return { dots, t: 0, ph: 0, oilS: 0, waxS: 0 }; },
  step(S, P, dt) { const rho = dens(P.P, P.T); S.rho = rho; for (const d of S.dots) { d.s += dt * (.08 + Math.min(.12, P.P / 400)); if (d.s > 1) d.s -= 1; } const sol = SFE_S(P); S.sol = sol; S.oilS += dt * sol * .02; S.waxS += dt * sol * .01 * clamp((P.P - 12) / 20, 0, 1); },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const rho = dens(P.P, P.T), sol = SFE_S(P), crit = P.T > 31.1 && P.P > 7.38;
    // фазова діаграма
    const gx = W * .56 + 34, gy = 36, gw = W * .4 - 34, gh = H * .56;
    const Xt = (T) => gx + (T / 100) * gw, Yp = (p) => gy + gh - (p / 65) * gh;
    c.fillStyle = "#fff"; c.fillRect(gx, gy, gw, gh);
    const nx = 50, ny = 36; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const T = (i + .5) / nx * 100, p = (j + .5) / ny * 65, d = dens(p, T), k = clamp((d - 100) / 900, 0, 1); c.fillStyle = mixHex("#EAF3F8", "#2E6FB5", Math.pow(k, .85)); c.fillRect(gx + i * gw / nx, gy + gh - (j + 1) * gh / ny, gw / nx + .6, gh / ny + .6); }
    c.strokeStyle = C.muted; c.strokeRect(gx + .5, gy + .5, gw, gh);
    c.strokeStyle = "#1c2a31"; c.lineWidth = 2; c.beginPath(); for (let T = 0; T <= 31.1; T += 1.1) { T === 0 ? c.moveTo(Xt(T), Yp(psat(T))) : c.lineTo(Xt(T), Yp(psat(T))); } c.stroke();
    c.setLineDash([4, 4]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(Xt(31.1), gy); c.lineTo(Xt(31.1), gy + gh); c.moveTo(gx, Yp(7.38)); c.lineTo(gx + gw, Yp(7.38)); c.stroke(); c.setLineDash([]);
    D.sphere(c, Xt(31.1), Yp(7.38), 5, "#C0392B"); D.txt(c, "критична точка", Xt(31.1) + 8, Yp(7.38) - 9, { size: 10.5, color: C.red, weight: 700 });
    D.txt(c, "рідина", gx + 10, gy + gh * .6, { size: 11.5, color: "#fff", weight: 800 }); D.txt(c, "газ", gx + 10, gy + gh - 14, { size: 11.5, color: C.soft, weight: 800 }); D.txt(c, "надкритичний флюїд", gx + gw - 6, gy + 16, { size: 11.5, color: "#fff", weight: 800, align: "right" });
    for (const v of [0, 25, 50, 75, 100]) D.txt(c, String(v), Xt(v), gy + gh + 12, { size: 10.5, color: C.muted, align: "center" }); for (const v of [0, 20, 40, 60]) D.txt(c, String(v), gx - 6, Yp(v), { size: 10.5, color: C.muted, align: "right" });
    D.txt(c, "T, °C", gx + gw, gy + gh + 26, { size: 10.5, color: C.muted, align: "right" }); c.save(); c.translate(gx - 26, gy + gh / 2); c.rotate(-Math.PI / 2); D.txt(c, "P, МПа", 0, 0, { size: 10.5, color: C.muted, align: "center" }); c.restore();
    const mx = Xt(clamp(P.T, 0, 100)), my = Yp(clamp(P.P, 0, 65)); c.strokeStyle = "rgba(0,0,0,.35)"; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(mx, my); c.lineTo(mx, gy + gh); c.moveTo(mx, my); c.lineTo(gx, my); c.stroke(); c.setLineDash([]); D.sphere(c, mx, my, 7, crit ? "#E8B24A" : "#8A98A0"); c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(mx, my, 7, 0, 7); c.stroke();
    D.txt(c, "Фазова діаграма CO₂ (колір — густина)", gx, gy - 12, { size: 11.5, weight: 700 });
    // технологічна схема
    D.fit(c, 6, 4, W * .55, H - 8, 520, 400, (s) => {
      const pipe = (pts, col = "#8A98A0") => { c.strokeStyle = col; c.lineWidth = 5; c.lineJoin = "round"; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); };
      const dcol = mixHex("#EAF3F8", "#2E6FB5", clamp((rho - 100) / 900, 0, 1)), PIPE = [[70, 330], [70, 270], [150, 270], [150, 150], [270, 150], [270, 90], [380, 90], [380, 150], [440, 150], [440, 280], [440, 330], [380, 330], [380, 200]];
      pipe([[70, 330], [70, 270], [150, 270], [150, 120]]); pipe([[150, 120], [250, 120], [250, 76]]); pipe([[250, 76], [360, 76], [360, 120]]); pipe([[360, 190], [360, 230], [420, 230]]); pipe([[420, 230], [420, 250]]); pipe([[480, 250], [480, 340], [90, 340], [90, 330]], "#B7C4CB");
      // балон CO2
      D.rr(c, 40, 296, 60, 64, 12); const gcol = c.createLinearGradient(40, 0, 100, 0); gcol.addColorStop(0, "#7E8A91"); gcol.addColorStop(.5, "#C9D3D8"); gcol.addColorStop(1, "#7E8A91"); c.fillStyle = gcol; c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 1.5; c.stroke(); D.txt(c, "CO₂", 70, 328, { size: 13, align: "center", weight: 800 });
      // насос
      D.rr(c, 126, 250, 48, 40, 8); c.fillStyle = "#6D7B83"; c.fill(); D.txt(c, "насос", 150, 270, { size: 10.5, color: "#fff", align: "center", weight: 700 }); D.txt(c, `${fmt(P.P, 0)} МПа`, 150, 304, { size: 11, align: "center", color: C.soft, weight: 700 });
      // екстрактор
      D.vessel(c, D.beakerPath(190, 78, 100, 190, 10), 190, 78, 100, 190, 1, dcol, { a: .7, inside: (cc) => { const r2 = rng(6); for (let i = 0; i < 28; i++) D.chip(cc, 198 + r2() * 84, 120 + r2() * 140, 6, r2() * 6, "#9FB36A"); } });
      D.txt(c, "екстрактор", 240, 286, { size: 11.5, align: "center", color: C.soft, weight: 700 }); D.tag(c, `${fmt(P.T, 0)} °C`, 240, 66, { size: 11.5 });
      // потік флюїду
      for (const d of S.dots) { const L = [[150, 270], [150, 120], [250, 120], [250, 76], [360, 76], [360, 120]]; let tot = 0; const segs = L.slice(1).map((p, i) => { const l = Math.hypot(p[0] - L[i][0], p[1] - L[i][1]); tot += l; return l; }); let dd = d.s * tot, i = 0; while (i < segs.length && dd > segs[i]) { dd -= segs[i]; i++; } if (i >= segs.length) continue; const k = dd / segs[i], x = lerp(L[i][0], L[i + 1][0], k), y = lerp(L[i][1], L[i + 1][1], k); c.fillStyle = crit ? "#2E6FB5" : "#9AA6AD"; c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill(); if (crit && i > 1) { c.fillStyle = "#E4B63B"; c.beginPath(); c.arc(x + 3, y - 2, 1.8 * clamp(sol, 0, 1.3), 0, 7); c.fill(); } }
      // сепаратори
      const sepA = (x, y, name, lvl, col, pr) => { D.vessel(c, D.beakerPath(x, y, 50, 90, 8), x, y, 50, 90, lvl, col, { a: .9 }); D.txt(c, name, x + 25, y + 104, { size: 11, align: "center", color: C.soft, weight: 700 }); D.txt(c, pr, x + 25, y - 8, { size: 10.5, align: "center", color: C.muted, weight: 700 }); };
      sepA(350, 180, "сепаратор 1", clamp(S.waxS * 1.6, 0, .85), "#B8A878", P.frac ? "9–10 МПа" : "10 МПа"); sepA(430, 180 + 20, "сепаратор 2", clamp(S.oilS * .9, 0, .85), C.oil, P.frac ? "4–5 МПа" : "—");
      D.txt(c, P.frac ? "воски" : "суміш", 375, 292, { size: 10.5, align: "center", color: "#7A6A35", weight: 700 }); D.txt(c, "олія / екстракт", 455, 312, { size: 10.5, align: "center", color: "#8A6A10", weight: 700 }); D.txt(c, "рециркуляція CO₂ ↩", 270, 356, { size: 10.5, align: "center", color: C.muted, weight: 700 });
      D.txt(c, "дроселювання: CO₂ → газ, екстракт випадає", 300, 22, { size: 10.5, align: "center", color: C.muted });
    });
    const st = !crit ? (P.T < 31.1 ? (P.P > psat(P.T) ? "рідина" : "газ") : "стиснений газ") : "надкритичний флюїд";
    c.save(); D.tag(c, `ρ ≈ ${fmt(rho, 0)} кг/м³ · ${st}`, W * .76, H * .56 + 70, { size: 12.5, bg: crit ? "#E8F1FA" : "#fff", stroke: crit ? C.blue : "rgba(0,0,0,.14)", color: crit ? "#1E4F85" : C.ink }); c.restore();
    c.fillStyle = "#E3EEE5"; D.rr(c, gx, H * .56 + 98, gw, 11, 5); c.fill(); c.fillStyle = C.green; D.rr(c, gx, H * .56 + 98, gw * clamp(sol / 1.3, 0, 1), 11, 5); c.fill(); D.txt(c, `відносна розчинність цільових БАР: ${fmt(sol, 2)}`, gx, H * .56 + 124, { size: 11.5, color: C.soft, weight: 600 });
    if (S.note) D.txt(c, S.note, gx, H * .56 + 144, { size: 11, color: C.muted });
  },
  reads: (S, P) => [["Густина CO₂", fmt(dens(P.P, P.T), 0), "кг/м³"], ["Стан", P.T > 31.1 && P.P > 7.38 ? "надкритичний" : P.T < 31.1 && P.P > psat(P.T) ? "рідина" : "газ / пара"], ["Розчинність (відн.)", fmt(SFE_S(P), 2)], ["Ко-розчинник", P.cs ? P.cs + " %" : "—"]],
  onMode() {},
});
function SFE_S(P) { const rho = dens(P.P, P.T); if (!(P.T > 31.1 && P.P > 7.38)) return rho > 600 ? .3 : .02; const k = 4.2, base = Math.pow(rho / 800, k) * Math.exp((P.T - 60) / 40); return base * (1 + P.cs * .09) * .7; }
/* опис вибраного режиму під моделлю */
SFE_PRE.forEach((p) => { p.run = (S) => { S.note = p.note; }; });

/* ====================== СУБКРИТИЧНА ВОДА (SWE) / PLE ====================== */
const EPS_T = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300], EPS_V = [78.4, 69.9, 62.3, 55.4, 49.3, 43.5, 38.9, 34.6, 30.7, 27.1, 23.3, 19.7];
const PSAT_T = [25, 100, 150, 200, 250, 300], PSAT_V = [.003, .101, .476, 1.55, 3.98, 8.59];
const polyY = (T) => clamp(sig((T - 112) / 24) - .88 * sig((T - 246) / 11), 0, 1);
reg("swe", {
  aspect: 1.6,
  params: [{ k: "T", label: "Температура води", min: 25, max: 300, step: 5, v: 160, u: "°C" }],
  info: "Тиск утримує воду рідкою за температур вище 100 °C. З нагріванням діелектрична проникність води різко падає: за ≈ 250 °C вона відповідає полярності між метанолом (ε ≈ 33) та етанолом (ε ≈ 24), тож гаряча вода розчиняє й менш полярні сполуки <b>без органічних розчинників</b>. Але вище ≈ 150–200 °C зростають гідроліз, реакції Майяра та утворення гідроксиметилфурфуролу: для поліфенолів оптимум — 130–200 °C за 15–35 хв, для глікозидів — нижчі температури. Значення ε — довідкові, крива виходу — якісна.",
  init() { const r = rng(12), dots = []; for (let i = 0; i < 40; i++) dots.push({ x: r(), y: r(), a: r() * 6 }); return { dots, th: 0 }; },
  step(S, P, dt) { S.th += dt; for (const d of S.dots) { d.a += dt * (1 + P.T / 100); d.x = clamp(d.x + Math.cos(d.a) * dt * .04, .05, .95); d.y = clamp(d.y + Math.sin(d.a * 1.2) * dt * .04, .05, .95); } },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const T = P.T, eps = interp(EPS_T, EPS_V, T), ps = interp(PSAT_T, PSAT_V, T), Y = polyY(T);
    D.fit(c, 6, 4, W * .4, H - 8, 220, 400, (s) => {
      // комірка під тиском
      c.fillStyle = "#A9B5BB"; D.rr(c, 60, 90, 100, 230, 14); c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 2; c.stroke(); c.fillStyle = "#6D7B83"; D.rr(c, 52, 80, 116, 18, 6); c.fill(); D.rr(c, 52, 312, 116, 18, 6); c.fill();
      const hot = clamp((T - 25) / 275, 0, 1); D.vessel(c, (cc) => D.rr(cc, 72, 104, 76, 200, 8), 72, 104, 76, 200, 1, mixHex("#BFE0F2", "#F2D8A8", hot * .7 + Y * .25), { a: .75, inside: (cc) => { const r2 = rng(3); for (let i = 0; i < 12; i++) D.chip(cc, 80 + r2() * 60, 180 + r2() * 110, 6, r2() * 6, mixHex("#4F8F45", "#B9B07A", Y)); for (const d of S.dots) { if (hash01(S.dots.indexOf(d), 2) > Y * 1.1) continue; cc.fillStyle = "rgba(150,70,20,.8)"; cc.beginPath(); cc.arc(72 + d.x * 76, 110 + d.y * 190, 2, 0, 7); cc.fill(); } } });
      for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(255,${120 + 30 * Math.sin(t * 6 + i)},40,${.2 + .6 * hot})`; c.beginPath(); c.ellipse(76 + i * 14, 340, 5, 10 * (.4 + hot), 0, 0, 7); c.fill(); }
      // манометр
      D.sphere(c, 110, 40, 22, "#E9EEF0"); c.strokeStyle = C.steelD; c.lineWidth = 2; c.beginPath(); c.arc(110, 40, 22, 0, 7); c.stroke(); const a = -2.4 + clamp(ps / 10, 0, 1) * 4.7; c.strokeStyle = C.red; c.lineWidth = 2.4; c.beginPath(); c.moveTo(110, 40); c.lineTo(110 + Math.cos(a) * 17, 40 + Math.sin(a) * 17); c.stroke(); D.txt(c, `${fmt(ps, ps < 1 ? 2 : 1)} МПа`, 110, 76, { size: 11, align: "center", weight: 700, color: C.red });
      c.strokeStyle = C.steelD; c.lineWidth = 3; c.beginPath(); c.moveTo(110, 62); c.lineTo(110, 80); c.stroke();
      D.txt(c, "клітина високого тиску", 110, 372, { size: 11, align: "center", color: C.soft, weight: 700 });
    });
    const gx = W * .46 + 28, gww = W * .5 - 28, g1y = 36, g1h = H * .4;
    const xs = []; for (let x = 25; x <= 300; x += 5) xs.push(x);
    D.chart(c, gx, g1y, gww, g1h, { x: [25, 300], y: [0, 85], xl: "T, °C", yl: "ε води", series: [{ pts: xs.map(x => [x, interp(EPS_T, EPS_V, x)]), col: C.blue, w: 2.8 }], hl: [{ y: 32.7, col: C.muted, label: "метанол 33" }, { y: 24.5, col: C.amber, label: "етанол 24,5" }, { y: 20.7, col: C.green, label: "ацетон 20,7" }], marks: [{ x: T, y: eps, col: C.red, label: `ε = ${fmt(eps, 0)}`, dx: 8 }], title: "Полярність води «налаштовується» температурою" });
    const g2y = g1y + g1h + 54, g2h = H - g2y - 34;
    D.chart(c, gx, g2y, gww, g2h, { x: [25, 300], y: [0, 1.1], xl: "T, °C", yl: "вихід фенолів, відн.", yt: [0, .5, 1], series: [{ pts: xs.map(x => [x, polyY(x)]), col: C.green, w: 2.6, fill: "rgba(47,125,79,.12)" }], bands: [{ x0: 130, x1: 200, col: "rgba(47,125,79,.12)", label: "оптимум", lc: C.greenD }, { x0: 250, x1: 300, col: "rgba(192,57,43,.1)", label: "деградація", lc: C.red }], marks: [{ x: T, y: Y, col: C.red }], title: "Вихід поліфенолів (якісна крива)" });
  },
  reads: (S, P) => { const eps = interp(EPS_T, EPS_V, P.T); const sol = eps > 50 ? "вода" : eps > 33 ? "полярніша за метанол" : eps > 24.5 ? "між метанолом і етанолом" : "як етанол або менш полярна"; return [["ε води", fmt(eps, 0)], ["Тиск ≥", fmt(interp(PSAT_T, PSAT_V, P.T), P.T < 120 ? 2 : 1), "МПа"], ["Полярність", sol]]; },
});

/* ====================== ФЕРМЕНТАТИВНА ЕКСТРАКЦІЯ ====================== */
reg("eae", {
  aspect: 1.65,
  params: [
    { k: "dose", label: "Доза ферментів", min: .5, max: 5, step: .5, v: 2, u: "%", d: 1 },
    { k: "pH", label: "pH", min: 3, max: 8, step: .1, v: 5, d: 1 },
    { k: "T", label: "Температура", min: 25, max: 80, step: 1, v: 45, u: "°C" },
  ],
  buttons: [{ label: "Інактивувати ферменти (90 °C, 5–10 хв)", run: (S) => { S.dead = true; } }, { label: "Додати свіжі ферменти", run: (S) => { S.dead = false; } }],
  info: "Целюлази, геміцелюлази, пектинази, ксиланази й таннази гідролізують полісахариди клітинної стінки та міжклітинної пластинки й <b>вивільняють зв'язані БАР</b>. Типові умови: pH 4–6, 35–55 °C, 1–6 год. Вище ≈ 60 °C фермент денатурує, поза оптимумом pH — гальмується. Наприкінці його інактивують нагріванням (85–95 °C) і очищають витяжку від білка. Для лушпиння фісташки комбінація целюлази, пектинази й таннази дала до +112 % до виходу порівняно з екстракцією розчинником.",
  init() { const r = rng(14), en = [], bd = []; for (let i = 0; i < 26; i++) en.push({ x: r(), y: r(), a: r() * 6, cut: 0 }); for (let i = 0; i < 40; i++) bd.push({ x: r() * .4, y: r(), free: false, v: r() }); return { en, bd, tmin: 0, gap: 0, Y: 0, Yc: 0, dead: false, hist: [], brk: [] }; },
  step(S, P, dt) {
    const tm = dt * 3; S.tmin += tm;
    const fpH = Math.exp(-Math.pow((P.pH - 5) / 1.4, 2)), fT = P.T <= 58 ? Math.exp(-Math.pow((P.T - 46) / 14, 2)) : Math.exp(-Math.pow((58 - 46) / 14, 2)) * Math.exp(-(P.T - 58) / 2.5);
    S.act = S.dead ? 0 : clamp(P.dose / 5, 0, 1) * fpH * fT * (P.dose > 0 ? 1 : 0) * 1.6; S.fpH = fpH; S.fT = fT;
    S.gap = clamp(S.gap + S.act * tm * .018, 0, 1); S.Yc = 1 - Math.exp(-.012 * S.tmin);
    S.Y = clamp(Math.max(S.Yc, S.Yc + (1 - S.Yc) * S.gap * .88), 0, 1); if (!S.hist.length || S.tmin - S.hist[S.hist.length - 1][0] > 1.2) S.hist.push([S.tmin, S.Y * 100, S.Yc * 100]);
    for (const b of S.bd) if (!b.free && S.gap > .08 + b.v * .8 && Math.random() < dt * 2 * S.act) b.free = true;
    for (const b of S.bd) if (b.free && b.x < .96) b.x += dt * .12 * (.5 + b.v);
    const r = Math.random; for (const e of S.en) { e.a += dt * (S.dead ? .2 : 1.4); e.x = clamp(e.x + Math.cos(e.a * 1.1) * dt * .06 + (.5 - e.x) * dt * .02, .5, .97); e.y = clamp(e.y + Math.sin(e.a) * dt * .06, .04, .96); e.cut = Math.max(0, e.cut - dt * 2); if (!S.dead && Math.abs(e.x - .5) < .08 && r() < dt * 3 * S.act) { e.cut = 1; S.brk.push({ x: .5, y: e.y, t: 0 }); } }
    for (const k of S.brk) k.t += dt * 2; S.brk = S.brk.filter(k => k.t < 1);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H);
    D.fit(c, 6, 4, W * .62, H - 8, 470, 400, (s) => {
      const x0 = 30, wx = 200, ww = 70, y0 = 36, hh = 320;
      // клітина зліва, середовище справа
      c.fillStyle = "#EAF4E4"; c.fillRect(x0, y0, wx - x0, hh); c.fillStyle = "#EEF5FA"; c.fillRect(wx + ww, y0, 440 - wx - ww, hh); D.txt(c, "вміст клітини", x0 + 10, y0 + 14, { size: 11.5, color: C.greenD, weight: 700 }); D.txt(c, "екстрагент (вода)", wx + ww + 10, y0 + 14, { size: 11.5, color: C.blue, weight: 700 });
      // клітинна стіна: целюлозні мікрофібрили + пектин
      c.fillStyle = "#E7D7A6"; c.fillRect(wx, y0, ww, hh); for (let i = 0; i < 12; i++) { const y = y0 + 14 + i * 26; c.strokeStyle = "#A98C4A"; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(wx + 6, y + Math.sin(i) * 3); c.lineTo(wx + ww - 6, y + Math.cos(i) * 3); c.stroke(); c.strokeStyle = "#D9BC6B"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(wx + 6, y - 1); c.lineTo(wx + ww - 6, y - 1); c.stroke(); }
      for (let i = 0; i < 18; i++) { const hx = wx + 8 + (i * 37 % 54), hy = y0 + 8 + (i * 53 % 300), cut = clamp(S.gap * 1.2 - hash01(i, 5) * .4, 0, 1); c.fillStyle = `rgba(185,120,160,${.55 * (1 - cut)})`; c.beginPath(); c.arc(hx, hy, 6, 0, 7); c.fill(); }
      // розриви
      const gapw = S.gap * 24; if (gapw > 1) for (let i = 0; i < 6; i++) { const y = y0 + 32 + i * 52; c.fillStyle = "rgba(238,245,250,.95)"; c.fillRect(wx + ww / 2 - gapw / 2, y, gapw, 22); }
      D.txt(c, "клітинна стінка", wx + ww / 2, y0 + hh + 14, { size: 11.5, align: "center", color: "#7A6320", weight: 700 }); D.txt(c, "(целюлоза + пектин)", wx + ww / 2, y0 + hh + 29, { size: 10.5, align: "center", color: C.muted });
      // зв'язані БАР
      for (const b of S.bd) { const bx = x0 + 8 + b.x * (440 - x0 - 16), by = y0 + 20 + b.y * (hh - 40); if (!b.free && b.x > .4) continue; const bxx = b.free ? (b.x < .45 ? x0 + 8 + b.x * 420 : bx) : x0 + 14 + b.x * 400; D.sphere(c, Math.min(440, bxx), by, 4.6, b.free ? "#D9A441" : "#8D6E3C"); if (!b.free) { c.strokeStyle = "rgba(90,60,20,.5)"; c.lineWidth = 1; c.beginPath(); c.moveTo(bxx, by); c.lineTo(wx - 6, by); c.stroke(); } }
      // ферменти
      for (const e of S.en) { const ex = x0 + e.x * (440 - x0), ey = y0 + 12 + e.y * (hh - 24); if (ex < wx + ww) continue; const col = S.dead ? "#9AA5AB" : "#6E3FA3"; D.sphere(c, ex, ey, 6.5, col); if (!S.dead) { c.strokeStyle = "#fff"; c.lineWidth = 1.4; c.beginPath(); c.arc(ex, ey, 3, .4, 5.4); c.stroke(); } if (e.cut > 0) { D.glow(c, wx + ww, ey, 18, "#FFE08A", e.cut * .8); } }
      for (const k of S.brk) { c.strokeStyle = `rgba(255,220,100,${1 - k.t})`; c.lineWidth = 2; c.beginPath(); c.moveTo(wx + ww - 8, y0 + 12 + k.y * (hh - 24) - 6); c.lineTo(wx + ww + 4, y0 + 12 + k.y * (hh - 24) + 6); c.stroke(); }
      D.tag(c, S.dead ? "ферменти інактивовані" : `активність ≈ ${fmt(S.act * 100 / 1.6, 0)} %`, 235, 14, { size: 11.5, bg: S.dead ? "#FDECEA" : "#fff", stroke: S.dead ? C.red : "rgba(0,0,0,.14)", color: S.dead ? C.red : C.ink });
    });
    const gx = W * .66 + 26, gww = W * .3 - 26, gy = 40, gh = H * .5;
    D.chart(c, gx, gy, gww, gh, { x: [0, Math.max(60, S.tmin)], y: [0, 100], xl: "хв", yl: "вихід зв'язаних БАР, %", series: [{ pts: S.hist.map(p => [p[0], p[2]]), col: C.steel, w: 2.2, dash: [5, 4] }, { pts: S.hist.map(p => [p[0], p[1]]), col: C.violet, w: 2.8, fill: "rgba(125,91,166,.1)" }], title: "З ферментами проти без ферментів" });
    c.fillStyle = C.violet; c.fillRect(gx, gy + gh + 30, 14, 4); D.txt(c, "ферментативна екстракція", gx + 20, gy + gh + 32, { size: 11, color: C.soft }); c.fillStyle = C.steel; c.fillRect(gx, gy + gh + 50, 14, 4); D.txt(c, "тільки розчинник", gx + 20, gy + gh + 52, { size: 11, color: C.soft });
    D.txt(c, `Приріст виходу: +${fmt(Math.max(0, S.Y - S.Yc) * 100 / Math.max(.01, S.Yc) * 1, 0)} %`, gx, gy + gh + 84, { size: 13, weight: 800, color: C.greenD });
  },
  reads: (S, P) => [["pH-фактор", fmt(S.fpH * 100, 0), "%"], ["T-фактор", fmt(S.fT * 100, 0), "%"], ["Розрив стінки", fmt(S.gap * 100, 0), "%"], ["Вихід", fmt(S.Y * 100, 0), "%"]],
});

/* ====================== ІМПУЛЬСНЕ ЕЛЕКТРИЧНЕ ПОЛЕ (PEF) ====================== */
const PEFX = [0, 1, 3, 5, 7, 10], PEFY = [0, 20, 129, 153, 159, 161];
const pefGain = (E) => interp(PEFX, PEFY, E);
reg("pef", {
  aspect: 1.65,
  params: [
    { k: "E", label: "Напруженість поля", min: 0, max: 10, step: .5, v: 3, u: "кВ/см", d: 1 },
    { k: "n", label: "Кількість імпульсів", min: 1, max: 100, step: 1, v: 20 },
    { k: "tau", label: "Тривалість імпульсу", min: 10, max: 100, step: 5, v: 60, u: "мкс" },
  ],
  info: "Короткі (мікросекундні) імпульси високої напруги створюють на мембрані клітини додатковий потенціал, і при перевищенні критичного (≈ 1 В) у мембрані виникають <b>пори (електропорація)</b>. Найсильніше поле — на полюсах клітини, звернених до електродів. Нагрівання мінімальне, тому метод нетермічний. Для шкірки апельсина (60 мкс, пресування 5 бар) вихід загальних поліфенолів зріс на 20, 129, 153 і 159 % при 1, 3, 5 і 7 кВ/см (Luengo та ін., 2013). Крива моделі проведена через ці літературні точки.",
  init() { const r = rng(19), cells = []; for (let r1 = 0; r1 < 3; r1++) for (let c1 = 0; c1 < 4; c1++) cells.push({ x: 150 + c1 * 62 + (r1 % 2) * 20, y: 110 + r1 * 82, ph: r(), por: 0, leak: [] }); return { cells, pulse: 0, cnt: 0, acc: 0, flash: 0 }; },
  step(S, P, dt) {
    S.acc += dt * 1.2; if (S.acc > 1) { S.acc = 0; if (P.E > 0.05) { S.flash = 1; S.cnt = Math.min(P.n, S.cnt + 1); } }
    S.flash = Math.max(0, S.flash - dt * 3.2);
    const Vm = 1.5 * P.E * 1e5 * 6e-5, f = P.E <= 0 ? 0 : clamp(1 - Math.exp(-Math.pow(Vm / 1.0, 2.0) / 6) , 0, 1); S.Vm = Vm; S.f = f * (1 - Math.exp(-S.cnt * P.tau / 400));
    for (const c of S.cells) { c.por += (S.f - c.por) * dt * 3; }
    S.gain = pefGain(P.E) * (1 - Math.exp(-P.n * P.tau / 500)) / (1 - Math.exp(-20 * 60 / 500)) * (1 - Math.exp(-S.cnt * P.tau / 500)) / Math.max(.05, 1 - Math.exp(-P.n * P.tau / 500));
    S.dT = Math.pow(P.E * 1e5, 2) * .1 * P.tau * 1e-6 * P.n / 4.18e6;
    for (const c of S.cells) { if (c.por > .15 && Math.random() < dt * 10 * c.por) c.leak.push({ s: 0, a: Math.random() < .5 ? 0 : Math.PI, j: Math.random() }); for (const l of c.leak) l.s += dt * .7; c.leak = c.leak.filter(l => l.s < 1); }
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H);
    D.fit(c, 6, 4, W * .62, H - 8, 470, 400, (s) => {
      // електроди
      c.fillStyle = "#6D7B83"; D.rr(c, 44, 60, 22, 260, 4); c.fill(); D.rr(c, 410, 60, 22, 260, 4); c.fill(); D.txt(c, "+", 55, 50, { size: 18, align: "center", weight: 800, color: C.red }); D.txt(c, "−", 421, 50, { size: 18, align: "center", weight: 800, color: C.blue });
      c.fillStyle = "#EEF5FA"; c.fillRect(66, 60, 344, 260);
      // силові лінії
      for (let i = 0; i < 9; i++) { const y = 76 + i * 28; c.strokeStyle = `rgba(110,60,170,${.12 + .5 * S.flash * clamp(P.E / 6, 0, 1)})`; c.lineWidth = 1.4; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(66, y); c.lineTo(410, y); c.stroke(); c.setLineDash([]); if (S.flash > .02) D.arrow(c, 70, y, 70 + 40 * (1 - S.flash) + 20, y, `rgba(110,60,170,${S.flash})`, 1.6, 5); }
      for (const cl of S.cells) {
        const cx = cl.x + 20, cy = cl.y, r = 26; D.glow(c, cx, cy, r + 14, "#FFE08A", cl.por * .5);
        c.fillStyle = "#CFE6B8"; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.strokeStyle = "#4F8F45"; c.lineWidth = 3; c.stroke(); c.fillStyle = "#A8D08A"; c.beginPath(); c.arc(cx, cy, r - 7, 0, 7); c.fill();
        // пори на полюсах
        const npor = Math.round(cl.por * 6); for (let k = 0; k < npor; k++) for (const sd of [0, Math.PI]) { const a = sd + (k - npor / 2) * .22; c.fillStyle = "#fff"; c.strokeStyle = "#B8860B"; c.lineWidth = 1.4; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.4, 0, 7); c.fill(); c.stroke(); }
        for (const l of cl.leak) { const dx = Math.cos(l.a) * (r + l.s * 26), dy = Math.sin(l.a) * (r + l.s * 26) + Math.sin(l.j * 9) * 4; D.sphere(c, cx + dx, cy + dy, 3, "#D9A441", 1 - l.s * .6); }
      }
      D.txt(c, "пори утворюються на полюсах клітин, повернутих до електродів", 238, 346, { size: 11.5, align: "center", color: C.soft, weight: 700 });
      D.tag(c, `імпульс ${S.cnt} / ${P.n}`, 238, 30, { size: 12 });
    });
    const gx = W * .66 + 26, gww = W * .3 - 26, gy = 40, gh = H * .5, xs = []; for (let x = 0; x <= 10; x += .25) xs.push(x);
    D.chart(c, gx, gy, gww, gh, { x: [0, 10], y: [0, 180], xl: "E, кВ/см", yl: "приріст поліфенолів, %", series: [{ pts: xs.map(x => [x, pefGain(x)]), col: C.violet, w: 2.6, fill: "rgba(125,91,166,.1)" }], marks: [{ x: 1, y: 20, col: C.amber, r: 4.5 }, { x: 3, y: 129, col: C.amber, r: 4.5 }, { x: 5, y: 153, col: C.amber, r: 4.5 }, { x: 7, y: 159, col: C.amber, r: 4.5 }, { x: P.E, y: pefGain(P.E), col: C.red, r: 6 }], title: "Шкірка апельсина (Luengo та ін., 2013)" });
    D.txt(c, "● літературні точки", gx, gy + gh + 30, { size: 11, color: C.amber, weight: 700 });
    D.txt(c, `Індукований потенціал ≈ ${fmt(S.Vm || 0, 0)} В`, gx, gy + gh + 54, { size: 11.5, color: C.soft, weight: 600 }); D.txt(c, `Нагрів за серію: ΔT ≈ ${fmt(S.dT, 2)} °C`, gx, gy + gh + 74, { size: 11.5, color: C.soft, weight: 600 });
    D.txt(c, `Порованих клітин: ${fmt(S.f * 100, 0)} %`, gx, gy + gh + 98, { size: 13, weight: 800, color: C.greenD });
  },
  reads: (S, P) => [["Пори", fmt(S.f * 100, 0), "% клітин"], ["Приріст виходу", "+" + fmt(pefGain(P.E) * (1 - Math.exp(-P.n * P.tau / 500)) / (1 - Math.exp(-20 * 60 / 500)), 0), "%"], ["Нагрів", fmt(S.dT, 2), "°C"]],
});

/* ====================== ГЛИБОКІ ЕВТЕКТИЧНІ РОЗЧИННИКИ (DES / NADES) ====================== */
const liquidus = (x, water) => { const e = .667; const T = x <= e ? lerp(302, 12, x / e) : lerp(12, 133, (x - e) / (1 - e)); return T - water * 1.4; };
reg("nades", {
  aspect: 1.65,
  params: [
    { k: "x", label: "Частка донора водневого зв'язку (HBD, сечовина)", min: 0.05, max: .95, step: .01, v: .667, f: (v) => fmt(v * 100, 0) + " % (" + (v > .62 && v < .72 ? "≈ 1:2" : v < .5 ? "багато ChCl" : v > .8 ? "багато HBD" : "поза евтектикою") + ")" },
    { k: "T", label: "Температура", min: -20, max: 140, step: 1, v: 25, u: "°C" },
    { k: "w", label: "Вода в розчиннику", min: 0, max: 40, step: 1, v: 0, u: "%" },
  ],
  info: "Суміш акцептора водневого зв'язку (HBA, зазвичай холін хлорид) і донора (HBD: сечовина, органічні кислоти, поліоли, цукри) плавиться набагато нижче, ніж кожен компонент: холін хлорид : сечовина 1 : 2 має T<sub>пл</sub> ≈ 12 °C (Abbott та ін., 2003). Водневі зв'язки не дають компонентам утворити кристал. <b>Головний недолік — в'язкість</b>: її знижують додаванням 20–50 % води й нагріванням. Фазова діаграма тут схематична (прямі ліквідуси).",
  init(P) { const r = rng(23), ms = []; for (let i = 0; i < 46; i++) ms.push({ gx: i % 8, gy: Math.floor(i / 8), a: r() * 6, x: r(), y: r(), vx: 0, vy: 0, hba: r() < .5 }); return { ms, th: 0 }; },
  step(S, P, dt) {
    const Tl = liquidus(P.x, P.w), liquid = P.T > Tl; S.liquid = liquid; S.Tl = Tl; S.visc = Math.exp(-.045 * (P.T - 25)) * Math.exp(-.07 * P.w) * (liquid ? 1 : 1e3);
    const sp = liquid ? clamp(.25 + (P.T - Tl) / 80 - Math.log10(Math.max(1, S.visc * 100)) * .08, .05, 1) : .02;
    for (const m of S.ms) { const tgx = .1 + (m.gx / 8) * .82, tgy = .1 + (m.gy / 6) * .8; if (!liquid) { m.x += (tgx - m.x) * dt * 3; m.y += (tgy - m.y) * dt * 3; m.x += (Math.random() - .5) * dt * .02; } else { m.a += (Math.random() - .5) * dt * 3; m.vx += Math.cos(m.a) * dt * sp * .5; m.vy += Math.sin(m.a) * dt * sp * .5; m.vx *= .93; m.vy *= .93; m.x = clamp(m.x + m.vx * dt, .04, .96); m.y = clamp(m.y + m.vy * dt, .06, .94); } }
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H);
    const bx = 24, by = 38, bw = W * .5, bh = H - 76;
    D.rr(c, bx, by, bw, bh, 14); c.fillStyle = S.liquid ? mixHex("#EEF6F0", "#D9ECDC", clamp(P.w / 40, 0, 1)) : "#E4E9EC"; c.fill(); c.strokeStyle = C.glass; c.lineWidth = 2; c.stroke();
    const pts = S.ms.map(m => [bx + m.x * bw, by + m.y * bh, m]);
    // водневі зв'язки
    c.strokeStyle = S.liquid ? "rgba(46,111,181,.4)" : "rgba(46,111,181,.7)"; c.setLineDash([3, 3]); c.lineWidth = 1.2; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { if (pts[i][2].hba === pts[j][2].hba) continue; const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < (S.liquid ? 36 : 46)) { c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[j][0], pts[j][1]); c.stroke(); } } c.setLineDash([]);
    for (const [x, y, m] of pts) { if (m.hba) { D.sphere(c, x, y, 7.5, "#7D5BA6"); D.sphere(c, x + 8, y + 5, 4, "#4FA36A"); } else { c.save(); c.translate(x, y); c.rotate(m.a * .3); c.fillStyle = "#E0B04A"; D.rr(c, -8, -4, 16, 8, 3); c.fill(); c.strokeStyle = "#8A6A10"; c.lineWidth = 1; c.stroke(); c.restore(); } }
    if (P.w > 0) { const r2 = rng(3); c.fillStyle = "rgba(142,193,234,.6)"; for (let i = 0; i < Math.round(P.w * .9); i++) { c.beginPath(); c.arc(bx + 12 + r2() * (bw - 24) + Math.sin(t + i) * 2, by + 12 + r2() * (bh - 24) + Math.cos(t * 1.2 + i) * 2, 2.2, 0, 7); c.fill(); } }
    D.tag(c, S.liquid ? "рідина (евтектика)" : "тверда фаза (кристали)", bx + bw / 2, by - 16, { size: 12.5, bg: S.liquid ? "#E6F4EA" : "#EEF1F3", stroke: S.liquid ? C.green : C.steel, color: S.liquid ? C.greenD : C.steelD });
    // легенда
    const ly = by + bh + 22; D.sphere(c, bx + 8, ly, 6, "#7D5BA6"); D.txt(c, "холін⁺ Cl⁻ (HBA)", bx + 20, ly, { size: 11 }); c.fillStyle = "#E0B04A"; D.rr(c, bx + 130, ly - 4, 14, 8, 3); c.fill(); D.txt(c, "сечовина (HBD)", bx + 150, ly, { size: 11 }); c.strokeStyle = "rgba(46,111,181,.8)"; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(bx + 250, ly); c.lineTo(bx + 270, ly); c.stroke(); c.setLineDash([]); D.txt(c, "H-зв'язки", bx + 276, ly, { size: 11 }); c.fillStyle = "rgba(142,193,234,.8)"; c.beginPath(); c.arc(bx + 346, ly, 3, 0, 7); c.fill(); D.txt(c, "вода", bx + 354, ly, { size: 11 });
    // фазова діаграма
    const gx = W * .58 + 28, gww = W * .38 - 28, gy = 40, gh = H * .52, xs = []; for (let x = 0; x <= 1.0001; x += .02) xs.push(x);
    D.chart(c, gx, gy, gww, gh, { x: [0, 1], y: [-20, 320], xl: "частка HBD", yl: "T плавлення, °C", yt: [0, 100, 200, 300], xt: [0, .25, .5, .667, 1], xf: (v) => v === .667 ? "1:2" : fmt(v, 2), series: [{ pts: xs.map(x => [x, liquidus(x, P.w)]), col: C.violet, w: 2.6, fill: "rgba(125,91,166,.1)" }], marks: [{ x: P.x, y: Math.max(-20, Math.min(320, P.T)), col: S.liquid ? C.green : C.blue, r: 6.5, label: S.liquid ? "рідина" : "тверде", dx: 10, dy: -8 }], hl: [{ y: P.T, col: "rgba(46,111,181,.4)" }], title: "Схематична діаграма ChCl–сечовина" });
    D.txt(c, "ChCl (302 °C) ← евтектика 12 °C → сечовина (133 °C)", gx, gy + gh + 30, { size: 11, color: C.soft });
    D.txt(c, `Відносна в'язкість: ${S.visc > 500 ? "—" : fmt(S.visc, S.visc < 10 ? 1 : 0)}`, gx, gy + gh + 58, { size: 13, weight: 800, color: C.greenD }); D.txt(c, "Вода та нагрів різко знижують в'язкість", gx, gy + gh + 78, { size: 11, color: C.soft });
  },
  reads: (S, P) => [["T плавлення", fmt(S.Tl, 0), "°C"], ["Стан", S.liquid ? "рідина" : "тверде"], ["Вода", P.w + " %"]],
});

/* ====================== МІЦЕЛЯРНА ЕКСТРАКЦІЯ / CPE ====================== */
reg("micelle", {
  aspect: 1.65,
  modes: [["mic", "Міцелярна екстракція"], ["cpe", "Екстракція в точці помутніння (CPE)"]],
  params: [{ k: "cs", label: "Концентрація ПАР", min: 0, max: 5, step: .1, v: 2, u: "× ККМ", d: 1 }, { k: "T", label: "Температура", min: 20, max: 80, step: 1, v: 25, u: "°C" }],
  info: "Вище критичної концентрації міцелоутворення (ККМ) молекули ПАР збираються в міцели, в гідрофобне ядро яких «ховаються» ліпофільні БАР — тому водний розчин ПАР екстрагує й неполярні сполуки. У <b>CPE</b> неіонне ПАР при нагріванні вище точки помутніння (тут умовно ≈ 45 °C) розшаровується на малий об'єм фази, збагаченої ПАР з БАР, і розведену водну фазу — екстракт водночас концентрується. Мінус: ПАР потім треба відділяти.",
  init() { const r = rng(31), ms = []; for (let i = 0; i < 70; i++) ms.push({ x: r(), y: r(), a: r() * 6, v: r() * .5 + .5, grp: i % 14, k: r() }); return { ms, tl: 0, sep: 0 }; },
  step(S, P, dt) {
    const cpe = P.mode === "cpe" && P.cs >= 1 && P.T > 45; S.sep += ((cpe ? 1 : 0) - S.sep) * dt * .5; S.cpe = cpe;
    const cmc = P.cs >= 1; S.mic = cmc;
    for (const m of S.ms) { m.a += (Math.random() - .5) * dt * 4; const sp = (P.T / 50) * .05 * m.v; m.x = clamp(m.x + Math.cos(m.a) * dt * sp, .03, .97); m.y = clamp(m.y + Math.sin(m.a) * dt * sp + S.sep * dt * .06 * (m.y < .78 ? 1 : 0), .04, .96); }
    S.uptake = !cmc ? .03 : clamp(1 - Math.exp(-(P.cs - .8) * .9), 0, .95);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const bx = 26, by = 40, bw = W * .46, bh = H - 82, cpe = S.cpe;
    D.vessel(c, D.beakerPath(bx, by, bw, bh, 14), bx, by, bw, bh, .94, mixHex("#EAF3F8", "#D8D2C4", S.sep * .5 + (cpe ? .3 : 0)), { a: .8, inside: (cc) => {
      const sepY = by + bh * .78; if (S.sep > .02) { cc.fillStyle = `rgba(230,190,90,${.55 * S.sep})`; cc.fillRect(bx, sepY, bw, by + bh - sepY); }
      const groups = {}; for (const m of S.ms) (groups[m.grp] ||= []).push(m);
      for (const g of Object.values(groups)) {
        if (!S.mic) { for (const m of g.slice(0, 3)) { const x = bx + m.x * bw, y = by + m.y * bh; cc.strokeStyle = "#7D5BA6"; cc.lineWidth = 2; cc.beginPath(); cc.moveTo(x, y); cc.lineTo(x + 5, y + 8); cc.stroke(); cc.fillStyle = "#7D5BA6"; cc.beginPath(); cc.arc(x, y, 2.6, 0, 7); cc.fill(); } continue; }
        const cx = bx + g[0].x * bw, cy = by + g[0].y * bh, R = 15 + (P.cs > 3 ? 3 : 0); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28 + t * .2; cc.strokeStyle = "#7D5BA6"; cc.lineWidth = 1.8; cc.beginPath(); cc.moveTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); cc.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); cc.stroke(); cc.fillStyle = "#4FA3D9"; cc.beginPath(); cc.arc(cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3), 2.6, 0, 7); cc.fill(); }
        const cargo = Math.round(S.uptake * 4); for (let k = 0; k < cargo; k++) D.sphere(cc, cx + Math.cos(k * 2.1) * 4, cy + Math.sin(k * 2.1) * 4, 3.4, "#E4B63B");
      }
      for (let i = 0; i < 16; i++) { const a = hash01(i, 4), b = hash01(i, 5); if (hash01(i, 6) < S.uptake * .9 - .2) continue; cc.fillStyle = "#E4B63B"; cc.globalAlpha = .9; cc.beginPath(); cc.arc(bx + 12 + a * (bw - 24) + Math.sin(t + i) * 3, by + 14 + b * (bh - 28) * (cpe ? .75 : 1), 3, 0, 7); cc.fill(); cc.globalAlpha = 1; }
      if (S.sep > .05) { cc.fillStyle = `rgba(255,255,255,${.35 * S.sep})`; cc.fillRect(bx, by + bh * .1, bw, bh * .6); }
    } });
    D.tag(c, !S.mic ? "нижче ККМ: ПАР — окремі молекули" : cpe ? "вище точки помутніння: два шари" : "вище ККМ: міцели з БАР у ядрі", bx + bw / 2, by - 16, { size: 12 });
    if (S.sep > .5) { D.txt(c, "фаза, збагачена ПАР та БАР", bx + bw + 10, by + bh * .88, { size: 11, color: "#8A6A10", weight: 700 }); D.txt(c, "розведена водна фаза", bx + bw + 10, by + bh * .4, { size: 11, color: C.blue, weight: 700 }); }
    const ly = by + bh + 22; c.strokeStyle = "#7D5BA6"; c.lineWidth = 2; c.beginPath(); c.moveTo(bx + 4, ly); c.lineTo(bx + 10, ly + 6); c.stroke(); c.fillStyle = "#4FA3D9"; c.beginPath(); c.arc(bx + 3, ly - 1, 3, 0, 7); c.fill(); D.txt(c, "молекула ПАР (голова + хвіст)", bx + 18, ly + 2, { size: 11 }); D.sphere(c, bx + 190, ly, 4, "#E4B63B"); D.txt(c, "ліпофільна БАР", bx + 200, ly + 2, { size: 11 });
    const gx = W * .62 + 26, gww = W * .34 - 26, gy = 50, gh = H * .42, xs = []; for (let x = 0; x <= 5; x += .1) xs.push(x);
    D.chart(c, gx, gy, gww, gh, { x: [0, 5], y: [0, 100], xl: "C(ПАР), × ККМ", yl: "БАР у міцелах, %", series: [{ pts: xs.map(x => [x, x < 1 ? 3 : 100 * clamp(1 - Math.exp(-(x - .8) * .9), 0, .95)]), col: C.amber, w: 2.6, fill: "rgba(201,138,27,.12)" }], marks: [{ x: P.cs, y: S.uptake * 100, col: C.red }], vl: [{ x: 1, col: C.violet, label: "ККМ" }], title: "Солюбілізація в міцелах" });
    D.txt(c, `У міцелах: ${fmt(S.uptake * 100, 0)} % БАР`, gx, gy + gh + 34, { size: 13, weight: 800, color: C.greenD });
    if (P.mode === "cpe") D.txt(c, S.cpe ? "обсяг збагаченої фази ≈ 5–10 % → концентрування у 10–20 разів" : "щоб побачити розшарування: ПАР ≥ ККМ і T > 45 °C", gx, gy + gh + 56, { size: 11, color: C.soft, weight: 600 });
  },
  reads: (S, P) => [["Стан ПАР", S.mic ? "міцели" : "мономери"], ["БАР у міцелах", fmt(S.uptake * 100, 0), "%"], ["Фази", S.cpe ? "дві" : "одна"]],
});
