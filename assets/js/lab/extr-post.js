/* Після екстракції: макропористі смоли, ротаційний випарник, розпилювальне сушіння; вибір методу й порівняння. */
import { reg, D, C, clamp, lerp, smooth, rng, hash01, fmt, mixHex, alpha, extractColor, el, btn } from "./extr-core.js";

/* ====================== МАКРОПОРИСТІ СМОЛИ ====================== */
const BVMAX = 12, PH = [[0, 3, "1. Завантаження екстракту"], [3, 6, "2. Промивання водою"], [6, 11, "3. Елюювання 60 % етанолом"], [11, 12, "Готово"]];
const sugarOut = (bv) => bv < 3 ? (bv < .6 ? smooth(bv / .6) * .9 : .9) : bv < 7 ? .9 * Math.exp(-(bv - 3) * 1.4) : 0;
const flavOut = (bv) => (bv < 3 ? .02 * smooth(bv / 3) : bv < 6 ? .015 : 0) + (bv >= 6 ? Math.exp(-Math.pow((bv - 7.8) / .85, 2)) * (bv > 6.3 ? 1 : smooth((bv - 6) / .3)) : 0);
reg("resin", {
  aspect: 1.65,
  buttons: [{ label: "→ Завантаження", run: (S) => { S.bv = 0; } }, { label: "→ Промивання", run: (S) => { S.bv = 3; } }, { label: "→ Елюювання", run: (S) => { S.bv = 6; } }],
  info: "Макропориста смола (AB-8, D101, HPD-100, XAD) сорбує флавоноїди з водного екстракту, а цукри й солі проходять крізь колонку. Після промивання водою флавоноїди десорбують 30–70 % етанолом. Для софори тонкінської (<i>Sophora tonkinensis</i>) смола AB-8 була найкращою з 10 випробуваних: вміст загальних флавоноїдів зріс приблизно в 4,76 раза — з 12,14 до 57,82 % — при виході 84,93 % (Hou та ін., 2019). Увага: «чистота» тут визначена колориметрично, а «вихід» — частка завантажених флавоноїдів, а не вихід із сировини.",
  init() { const r = rng(7), dots = []; for (let i = 0; i < 90; i++) dots.push({ y: r(), x: r(), k: i % 3 === 0 ? 0 : 1, v: .5 + r() * .5 }); return { bv: 0, dots, hs: [] }; },
  step(S, P, dt) { S.bv += dt * .42; if (S.bv > BVMAX + 1.5) S.bv = 0; if (!S.hs.length || S.bv - S.hs[S.hs.length - 1][0] > .08 || S.bv < S.hs[S.hs.length - 1][0]) { if (S.bv < (S.hs[S.hs.length - 1] || [0])[0]) S.hs = []; S.hs.push([S.bv, sugarOut(S.bv), flavOut(S.bv)]); } for (const d of S.dots) { d.y += dt * .35 * d.v; if (d.y > 1) { d.y = 0; d.x = Math.random(); } } },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const bv = Math.min(S.bv, BVMAX), ph = PH.find(p => bv >= p[0] && bv < p[1]) || PH[3];
    D.fit(c, 6, 4, W * .5, H - 8, 300, 400, (s) => {
      const x = 90, w = 120, y = 70, h = 250, bedTop = y + 14, bedH = h - 28;
      D.txt(c, ph[2], 150, 24, { size: 13, align: "center", weight: 800, color: C.greenD });
      // подача
      const feed = bv < 3 ? "екстракт" : bv < 6 ? "вода" : "60 % етанол"; const fcol = bv < 3 ? "#D9A441" : bv < 6 ? "#BFE0F2" : "#F2E7B8";
      D.rr(c, 105, 40, 90, 26, 8); c.fillStyle = fcol; c.fill(); c.strokeStyle = C.glass; c.lineWidth = 1.6; c.stroke(); D.txt(c, feed, 150, 53, { size: 11.5, align: "center", weight: 700 });
      D.vessel(c, (cc) => D.rr(cc, x, y, w, h, 12), x, y, w, h, .97, fcol, { a: .38, inside: (cc) => {
        // зона адсорбції
        const zf = bv < 3 ? .42 * smooth(clamp(bv / 3, 0, 1)) : .42; const ze = bv >= 6 ? clamp((bv - 6) / 4.2, 0, 1.05) * (.42 + .1) : 0;
        for (let j = 0; j < 14; j++) for (let i = 0; i < 6; i++) {
          const zz = j / 14, bx2 = x + 10 + i * 17.5 + (j % 2) * 8, by2 = bedTop + zz * bedH; let a = zz < zf ? 1 - zz / (zf + .05) * .45 : 0; if (bv >= 6) a *= zz < ze ? .08 : 1; a = clamp(a, 0, 1);
          cc.fillStyle = mixHex("#E9EEF1", "#D98A1B", a); cc.beginPath(); cc.arc(bx2, by2, 7.4, 0, 7); cc.fill(); cc.strokeStyle = "rgba(0,0,0,.18)"; cc.lineWidth = .8; cc.stroke();
        }
        // рідина й домішки
        for (const d of S.dots) { const yy = bedTop + d.y * bedH, zz = d.y; if (bv < 3 && d.k === 1) { cc.fillStyle = "#6F7F89"; cc.beginPath(); cc.arc(x + 8 + d.x * (w - 16), yy, 2.6, 0, 7); cc.fill(); } else if (bv < 3 && d.k === 0 && zz < zf * .98) { /* флавоноїди прилипають */ } else if (bv < 3 && d.k === 0) { cc.fillStyle = "#D98A1B"; cc.beginPath(); cc.arc(x + 8 + d.x * (w - 16), yy, 2.8, 0, 7); cc.fill(); } else if (bv >= 3 && bv < 6 && d.k === 1 && zz > (bv - 3) / 3 * .6) { cc.fillStyle = "#6F7F89"; cc.beginPath(); cc.arc(x + 8 + d.x * (w - 16), yy, 2.6, 0, 7); cc.fill(); } else if (bv >= 6 && d.k === 0 && zz > ze - .05 && zz < ze + .35) { cc.fillStyle = "#D98A1B"; cc.beginPath(); cc.arc(x + 8 + d.x * (w - 16), yy, 3.2, 0, 7); cc.fill(); } }
      } });
      c.fillStyle = "#99A5AB"; c.fillRect(x, y + h - 8, w, 8);
      // потік на виході
      const sg = sugarOut(bv), fl = flavOut(bv), ec = mixHex("#EAF1F5", "#6F7F89", clamp(sg, 0, 1)), ec2 = mixHex(ec, "#D98A1B", clamp(fl, 0, 1));
      c.strokeStyle = ec2; c.lineWidth = 4; c.beginPath(); c.moveTo(150, y + h); c.lineTo(150, y + h + 24); c.stroke();
      D.vessel(c, (cc) => D.rr(cc, 110, y + h + 28, 80, 54, 8), 110, y + h + 28, 80, 54, .6, ec2, { a: .85 });
      D.txt(c, "вихід колонки", 150, y + h + 96, { size: 11, align: "center", color: C.soft, weight: 700 });
      // легенда
      D.sphere(c, 22, 150, 5, "#D98A1B"); D.txt(c, "флавоноїди", 32, 150, { size: 10.5 }); D.sphere(c, 22, 172, 5, "#6F7F89"); D.txt(c, "цукри, солі", 32, 172, { size: 10.5 });
      c.fillStyle = "#D98A1B"; c.beginPath(); c.arc(30, 196, 7, 0, 7); c.fill(); D.txt(c, "смола з сорбованими флавоноїдами", 14, 214, { size: 9.5, color: C.muted });
    });
    // хроматограма
    const gx = W * .54 + 28, gw = W * .42 - 28, gy = 40, gh = H * .5, xs = []; for (let x = 0; x <= BVMAX; x += .1) xs.push(x);
    D.chart(c, gx, gy, gw, gh, { x: [0, BVMAX], y: [0, 1.1], xl: "об'єми шару смоли (BV)", yl: "C на виході, відн.", yt: [0, .5, 1], series: [{ pts: S.hs.map(p => [p[0], p[1]]), col: "#6F7F89", w: 2.6 }, { pts: S.hs.map(p => [p[0], p[2]]), col: "#D98A1B", w: 2.8, fill: "rgba(217,138,27,.14)" }], bands: [{ x0: 0, x1: 3, col: "rgba(217,164,65,.1)", label: "завантаж." }, { x0: 3, x1: 6, col: "rgba(142,193,234,.12)", label: "вода" }, { x0: 6, x1: 11, col: "rgba(242,231,184,.28)", label: "60 % EtOH" }], vl: [{ x: bv, col: C.red }], title: "Профіль на виході колонки" });
    D.txt(c, "— цукри, солі", gx, gy + gh + 34, { size: 11, color: "#6F7F89", weight: 700 }); D.txt(c, "— флавоноїди", gx + 100, gy + gh + 34, { size: 11, color: "#D98A1B", weight: 700 });
    const pur = bv < 6 ? 12.14 : lerp(12.14, 57.82, smooth(clamp((bv - 6) / 3.5, 0, 1)));
    D.txt(c, `Вміст флавоноїдів у продукті: ${fmt(pur, 1)} %`, gx, gy + gh + 62, { size: 13, weight: 800, color: C.greenD }); D.txt(c, "Sophora tonkinensis, смола AB-8: 12,14 → 57,82 % (≈ 4,76×), вихід 84,93 %", gx, gy + gh + 84, { size: 11, color: C.soft });
  },
  reads: (S) => { const bv = Math.min(S.bv, BVMAX), ph = PH.find(p => bv >= p[0] && bv < p[1]) || PH[3]; return [["Стадія", ph[2].replace(/^\d\.\s*/, "")], ["Пропущено", fmt(bv, 1), "BV"], ["Збагачення", "≈ 4,76×", "(літ.)"]]; },
});

/* ====================== РОТАЦІЙНИЙ ВИПАРНИК ====================== */
const bpEtOH = (mbar) => { const mm = Math.max(5, mbar * .750062); return 1642.89 / (8.20417 - Math.log10(mm)) - 230.3; };
const bpH2O = (mbar) => { const mm = Math.max(5, mbar * .750062); return 1730.63 / (8.07131 - Math.log10(mm)) - 233.426; };
reg("rotavap", {
  aspect: 1.65,
  modes: [["eth", "Етанол (з витяжки)"], ["h2o", "Вода"]],
  params: [
    { k: "p", label: "Тиск у системі", min: 20, max: 1013, step: 10, v: 150, u: "мбар" },
    { k: "Tb", label: "Температура бані", min: 25, max: 80, step: 1, v: 45, u: "°C" },
    { k: "rpm", label: "Обертання колби", min: 20, max: 200, step: 10, v: 100, u: "об/хв" },
  ],
  info: "Pн. Eur. вимагає концентрувати екстракт під зниженим тиском при температурі, за якої руйнування БАР мінімальне. У ротаційному випарнику вакуум знижує температуру кипіння (ротаційний випарник 35–50 °C, 20–200 мбар), а обертання колби створює тонку плівку з великою поверхнею. Занадто глибокий вакуум при гарячій бані викликає <b>піноутворення й «закипання з викидом»</b>.".replace("Pн. Eur.", "Ph. Eur."),
  init() { const r = rng(9), bs = []; return { vol: 1, th: 0, ang: 0, bub: [], vap: [], coll: 0, dr: [] }; },
  step(S, P, dt) {
    const bp = P.mode === "eth" ? bpEtOH(P.p) : bpH2O(P.p), dT = P.Tb - bp; S.bp = bp; S.dT = dT; S.ang += dt * P.rpm / 100 * 2.4; S.th += dt;
    const rate = Math.max(0, dT) * (P.rpm / 100) * .0018 * (S.vol > .06 ? 1 : 0); S.rate = rate;
    const dv = Math.min(S.vol - .05, rate * dt * 1.4); if (dv > 0) { S.vol -= dv; S.coll += dv; } S.foam = dT > 38 && P.p < 100;
    const r = Math.random; if (rate > 0 && r() < dt * 25 * clamp(dT / 20, 0, 2)) S.bub.push({ x: r(), y: 0, r: 1.6 + r() * 2 }); for (const b of S.bub) b.y += dt * 1.4; S.bub = S.bub.filter(b => b.y < 1);
    if (rate > 0 && r() < dt * 30 * clamp(dT / 15, 0, 2)) S.vap.push({ s: 0 }); for (const v of S.vap) v.s += dt * .7; S.vap = S.vap.filter(v => v.s < 1);
    if (S.coll > 0 && r() < dt * 8 * clamp(rate * 600, 0, 1.5)) S.dr.push({ y: 0 }); for (const d of S.dr) d.y += dt * 2; S.dr = S.dr.filter(d => d.y < 1);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const bp = S.bp ?? 78, eth = P.mode === "eth";
    D.fit(c, 6, 4, W * .64, H - 8, 520, 400, (s) => {
      // баня
      D.rr(c, 40, 280, 190, 90, 14); c.fillStyle = "#B7C6CD"; c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 1.6; c.stroke(); D.rr(c, 52, 296, 166, 66, 8); c.fillStyle = mixHex("#A8D2EE", "#F0C9A0", clamp((P.Tb - 25) / 55, 0, 1) * .6); c.fill();
      D.tag(c, `баня ${P.Tb} °C`, 135, 384, { size: 11 });
      // колба, що обертається (нахилена)
      c.save(); c.translate(140, 290); c.rotate(-.35); const ex = extractColor((1 - S.vol) * 1.3 + .05, "green");
      c.beginPath(); c.arc(0, 0, 54, 0, 7); c.fillStyle = "rgba(214,235,230,.3)"; c.fill(); c.save(); c.beginPath(); c.arc(0, 0, 53, 0, 7); c.clip(); c.fillStyle = ex; c.globalAlpha = .88; c.beginPath(); const lvl = 12 + (S.vol - .5) * 80; c.rect(-60, lvl - 14 * Math.sin(S.ang) * 0, 120, 70); c.fill(); c.globalAlpha = 1; for (const b of S.bub) { c.fillStyle = "rgba(255,255,255,.8)"; c.beginPath(); c.arc(-30 + b.x * 60, 40 - b.y * 30, b.r, 0, 7); c.fill(); } if (S.foam) { c.fillStyle = "rgba(255,255,255,.8)"; for (let i = 0; i < 20; i++) { c.beginPath(); c.arc(-40 + hash01(i, 3) * 80, lvl - 4 - hash01(i, 5) * 22, 4 + hash01(i, 7) * 4, 0, 7); c.fill(); } } c.restore();
      c.strokeStyle = C.glass; c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, 54, 0, 7); c.stroke();
      for (let k = 0; k < 4; k++) { const a = S.ang + k * Math.PI / 2; c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.arc(Math.cos(a) * 40, Math.sin(a) * 40, 3, 0, 7); c.fill(); }
      c.restore();
      // шийка та привід
      c.save(); c.translate(140, 290); c.rotate(-.35); tubeR(c, [[0, -54], [0, -110]], 22); c.restore();
      const hx = 140 + Math.sin(.35) * 110, hy = 290 - Math.cos(.35) * 110; c.fillStyle = "#4C5C64"; D.rr(c, hx - 18, hy - 36, 40, 34, 6); c.fill(); D.txt(c, "М", hx + 2, hy - 18, { size: 12, color: "#fff", align: "center", weight: 800 });
      // парова труба і холодильник
      c.strokeStyle = C.glass; c.lineWidth = 12; c.globalAlpha = .4; c.beginPath(); c.moveTo(hx + 4, hy - 4); c.lineTo(hx + 4, 74); c.lineTo(310, 74); c.stroke(); c.globalAlpha = 1;
      D.rr(c, 258, 62, 140, 88, 12); const wg = c.createLinearGradient(0, 62, 0, 150); wg.addColorStop(0, "rgba(142,193,234,.55)"); wg.addColorStop(1, "rgba(142,193,234,.2)"); c.fillStyle = wg; c.fill(); c.strokeStyle = alpha("#2E6FB5", .65); c.lineWidth = 1.6; c.stroke();
      c.strokeStyle = "#7FA9C4"; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 7; c.lineTo(278 + i * 2.6, 106 + Math.sin(a) * 28 + (i * 0)); } c.stroke();
      D.txt(c, "холодильник (змійовик)", 328, 56, { size: 11, align: "center", color: C.soft, weight: 700 });
      for (const v of S.vap) { const s2 = v.s; let x, y; if (s2 < .4) { x = hx + 4; y = lerp(hy - 4, 74, s2 / .4); } else { x = lerp(hx + 4, 340, (s2 - .4) / .6); y = 74; } c.fillStyle = "rgba(255,255,255,.95)"; c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = .8; c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); c.stroke(); }
      // приймач
      D.vessel(c, D.beakerPath(344, 244, 74, 90, 8), 344, 244, 74, 90, clamp(S.coll * 1.1, 0, .9), eth ? "#EAF1E6" : "#BFE0F2", { a: .8 }); D.txt(c, "конденсат (розчинник)", 381, 350, { size: 11, align: "center", color: C.soft, weight: 700 });
      for (const d of S.dr) { c.fillStyle = "rgba(200,225,240,.95)"; c.beginPath(); c.arc(381, 150 + d.y * 96, 2.6, 0, 7); c.fill(); }
      // вакуум-насос і манометр
      D.rr(c, 440, 150, 60, 50, 8); c.fillStyle = "#6D7B83"; c.fill(); D.txt(c, "вакуум", 470, 175, { size: 11, color: "#fff", align: "center", weight: 700 }); c.strokeStyle = C.glass; c.lineWidth = 3; c.beginPath(); c.moveTo(398, 100); c.lineTo(470, 100); c.lineTo(470, 150); c.stroke();
      D.sphere(c, 470, 70, 22, "#EEF1F3"); c.strokeStyle = C.steelD; c.lineWidth = 2; c.beginPath(); c.arc(470, 70, 22, 0, 7); c.stroke(); const a = -2.4 + clamp(P.p / 1013, 0, 1) * 4.7; c.strokeStyle = C.red; c.lineWidth = 2.4; c.beginPath(); c.moveTo(470, 70); c.lineTo(470 + Math.cos(a) * 17, 70 + Math.sin(a) * 17); c.stroke(); D.txt(c, `${P.p} мбар`, 470, 104, { size: 11, align: "center", color: C.red, weight: 700 });
    });
    const gx = W * .68 + 4, gw = W * .28, gy = 44;
    D.txt(c, "Режим випарювання", gx, gy, { size: 13, weight: 800 });
    const ok = S.dT > 8 && !S.foam; D.tag(c, S.foam ? "ризик піни й викиду!" : S.dT <= 0 ? "не кипить: підвищте вакуум або T бані" : P.Tb > 50 ? "гаряче для термолабільних БАР" : ok ? "щадне випарювання" : "повільно", gx + gw / 2, gy + 36, { size: 11.5, bg: S.foam || S.dT <= 0 ? "#FDECEA" : P.Tb > 50 ? "#FFF6E5" : "#E6F4EA", stroke: S.foam || S.dT <= 0 ? C.red : P.Tb > 50 ? C.amber : C.green, color: S.foam || S.dT <= 0 ? C.red : P.Tb > 50 ? "#8A5A00" : C.greenD });
    D.txt(c, `Т кипіння при ${P.p} мбар: ${fmt(bp, 0)} °C`, gx, gy + 70, { size: 12, color: C.soft, weight: 600 }); D.txt(c, `Перепад (баня − кипіння): ${fmt(S.dT ?? 0, 0)} °C`, gx, gy + 92, { size: 12, color: C.soft, weight: 600 });
    c.fillStyle = "#E3EEE5"; D.rr(c, gx, gy + 112, gw, 11, 5); c.fill(); c.fillStyle = C.green; D.rr(c, gx, gy + 112, gw * clamp(1 - S.vol, 0, 1), 11, 5); c.fill(); D.txt(c, `Відігнано розчинника: ${fmt(S.coll / .95 * 100, 0)} %`, gx, gy + 138, { size: 12, color: C.greenD, weight: 700 });
    D.txt(c, "Концентрат залишається в колбі", gx, gy + 162, { size: 11, color: C.muted });
  },
  reads: (S, P) => [["T кипіння", fmt(S.bp ?? 0, 0), "°C"], ["Перепад", fmt(S.dT ?? 0, 0), "°C"], ["Швидкість", fmt((S.rate || 0) * 600, 1), "відн."]],
});
function tubeR(c, pts, w) { c.lineJoin = "round"; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = C.glass; c.lineWidth = w + 3; c.stroke(); c.strokeStyle = "rgba(226,240,238,.85)"; c.lineWidth = w; c.stroke(); }

/* ====================== РОЗПИЛЮВАЛЬНЕ СУШІННЯ ====================== */
reg("spray", {
  aspect: 1.65,
  params: [{ k: "Tin", label: "Температура на вході", min: 120, max: 210, step: 5, v: 160, u: "°C" }, { k: "feed", label: "Подача екстракту", min: 10, max: 100, step: 5, v: 50, u: "%" }],
  toggles: [{ k: "carrier", label: "Додати носій (мальтодекстрин, гуміарабік)", v: true }],
  info: "Концентрований екстракт розпилюють у потік гарячого повітря (вхід 140–200 °C, вихід 60–90 °C): за секунди краплі висихають у сферичні частинки, які осаджує циклон. Цукристі екстракти <b>налипають</b> на стінки, тому додають носії (мальтодекстрин, гуміарабік) — вони ж слугують стінкою інкапсуляції. Висока температура на виході й тривалий контакт підвищують втрати летких сполук. Залежності якісні.",
  init() { return { dr: [], pw: [], th: 0 }; },
  step(S, P, dt) {
    const Tout = P.Tin - (40 + P.feed * .55); S.Tout = Tout; S.moist = clamp(14 - (Tout - 55) * .24, 1.5, 14) + (P.carrier ? -1 : 0); S.moist = Math.max(1.2, S.moist); S.sticky = Tout > (P.carrier ? 100 : 78) ? 1 : Tout > (P.carrier ? 88 : 68) ? .5 : 0; S.keep = clamp(100 - Math.max(0, Tout - 60) * 1.15, 40, 100); S.th += dt;
    const r = Math.random; if (r() < dt * 14 * (.3 + P.feed / 100)) S.dr.push({ x: .5 + (r() - .5) * .06, y: 0, vx: (r() - .5) * .12, k: r() }); for (const d of S.dr) { d.y += dt * (.28 + d.k * .1); d.x += d.vx * dt; d.x = clamp(d.x, .36, .64); } S.dr = S.dr.filter(d => d.y < 1);
    for (const d of S.dr) if (d.y > .9 && r() < .3) S.pw.push({ x: d.x, t: 0 }); for (const p of S.pw) p.t += dt; S.pw = S.pw.filter(p => p.t < 3).slice(-80);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const Tout = S.Tout ?? 80;
    D.fit(c, 6, 4, W * .6, H - 8, 460, 400, (s) => {
      // камера (циліндр + конус)
      const path = (cc) => { cc.beginPath(); cc.moveTo(130, 60); cc.lineTo(130, 230); cc.lineTo(210, 340); cc.lineTo(250, 340); cc.lineTo(330, 230); cc.lineTo(330, 60); cc.closePath(); };
      const g = c.createLinearGradient(0, 60, 0, 340); g.addColorStop(0, mixHex("#FFE6D0", "#FFB07A", clamp((P.Tin - 120) / 90, 0, 1) * .8)); g.addColorStop(1, mixHex("#FFF3E6", "#FFD9B8", clamp((Tout - 50) / 60, 0, 1))); c.fillStyle = g; path(c); c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 3; c.stroke();
      // гаряче повітря
      D.rr(c, 20, 72, 80, 28, 6); c.fillStyle = "#E2733F"; c.fill(); D.txt(c, `${P.Tin} °C`, 60, 86, { size: 12, color: "#fff", align: "center", weight: 800 }); D.arrow(c, 104, 86, 134, 86, "#E2733F", 3, 8); D.txt(c, "гаряче повітря", 22, 114, { size: 10.5, color: "#B5502A", weight: 700 });
      // форсунка
      c.fillStyle = "#6D7B83"; D.rr(c, 214, 40, 32, 30, 5); c.fill(); c.beginPath(); c.moveTo(220, 70); c.lineTo(240, 70); c.lineTo(230, 82); c.closePath(); c.fill(); D.txt(c, "форсунка", 230, 30, { size: 10.5, align: "center", color: C.soft, weight: 700 }); D.txt(c, "екстракт ↓", 290, 55, { size: 10.5, color: "#7A5A12", weight: 700 });
      // краплі та частинки
      for (const d of S.dr) { const y = 84 + d.y * (240 - 84) + (d.y > .55 ? (d.y - .55) * 140 : 0), x = 130 + d.x * 200, dry = clamp(d.y * 1.3, 0, 1), r = lerp(5, 2.4, dry); D.sphere(c, x, y, r, mixHex("#C98A1B", "#E9DDBF", dry), 1); }
      // повітряний потік, що закручується до циклону
      c.strokeStyle = "rgba(120,140,150,.5)"; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(330, 150); c.lineTo(390, 150); c.lineTo(390, 200); c.stroke(); c.setLineDash([]);
      D.arrow(c, 330, 150, 392, 150, "rgba(120,140,150,.7)", 2, 6);
      // циклон
      c.fillStyle = "#D5DDE1"; c.beginPath(); c.moveTo(366, 190); c.lineTo(416, 190); c.lineTo(416, 232); c.lineTo(400, 292); c.lineTo(382, 292); c.lineTo(366, 232); c.closePath(); c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 2; c.stroke(); D.txt(c, "циклон", 391, 178, { size: 11, align: "center", color: C.soft, weight: 700 }); D.txt(c, `${fmt(Tout, 0)} °C`, 440, 225, { size: 11.5, color: C.blue, weight: 800 }); D.txt(c, "вихід", 440, 240, { size: 10, color: C.muted });
      // порошок
      D.vessel(c, D.beakerPath(372, 296, 38, 46, 6), 372, 296, 38, 46, clamp(S.pw.length / 60, .1, .9), "#E8DCC0", { a: 1 }); D.txt(c, "порошок", 391, 358, { size: 11, align: "center", color: C.soft, weight: 700 });
      for (const p of S.pw) { c.fillStyle = "#E8DCC0"; c.fillRect(386 + (p.t * 12) % 8, 288 + p.t * 20, 2, 2); }
      // налипання
      if (S.sticky > 0) { c.fillStyle = `rgba(201,138,27,${.4 * S.sticky + .15})`; for (let i = 0; i < 12; i++) { const y = 120 + i * 18, xx = i < 8 ? 130 : 130 + (i - 7) * 14; c.beginPath(); c.arc(xx + 2, y, 3 + hash01(i, 3) * 3 * S.sticky, 0, 7); c.fill(); } }
    });
    const gx = W * .64 + 4, gw = W * .32, gy = 42;
    D.txt(c, "Результат", gx, gy, { size: 13, weight: 800 });
    const bar = (y, lab, v, col, txt) => { D.txt(c, lab, gx, y, { size: 11.5, color: C.soft, weight: 600 }); c.fillStyle = "#E3EEE5"; D.rr(c, gx, y + 8, gw, 11, 5); c.fill(); c.fillStyle = col; D.rr(c, gx, y + 8, gw * clamp(v, 0, 1), 11, 5); c.fill(); D.txt(c, txt, gx + gw, y, { size: 11.5, align: "right", weight: 800, color: col }); };
    bar(gy + 34, "Т на виході", (Tout - 40) / 70, Tout > 90 ? C.red : Tout < 60 ? C.blue : C.green, `${fmt(Tout, 0)} °C`);
    bar(gy + 76, "Вологість порошку", S.moist / 14, S.moist > 8 ? C.red : C.green, `${fmt(S.moist, 1)} %`);
    bar(gy + 118, "Збереження летких", S.keep / 100, S.keep < 70 ? C.amber : C.green, `${fmt(S.keep, 0)} %`);
    bar(gy + 160, "Ризик налипання", S.sticky, S.sticky > .4 ? C.red : C.green, S.sticky > .7 ? "високий" : S.sticky > .2 ? "помітний" : "низький");
    D.txt(c, S.sticky > .4 ? "Знизьте T на вході або додайте носій" : Tout < 60 ? "Занадто вологий порошок: підвищте T або знизьте подачу" : "Робоче вікно: вхід 140–200, вихід 60–90 °C", gx, gy + 214, { size: 11, color: C.soft });
  },
  reads: (S, P) => [["Т на виході", fmt(S.Tout ?? 0, 0), "°C"], ["Вологість", fmt(S.moist ?? 0, 1), "%"], ["Налипання", (S.sticky ?? 0) > .6 ? "так" : (S.sticky ?? 0) > .2 ? "частково" : "ні"]],
});

/* ====================== ВИБІР МЕТОДУ (правила з дерева рішень) ====================== */
const M = {
  macer: { n: "Мацерація", thermo: 2, scale: [1, 1, 1], cost: 1, pharma: 1, anchor: "m-macer" },
  perc: { n: "Перколяція / реперколяція", thermo: 2, scale: [1, 1, 1], cost: 1, pharma: 1, anchor: "m-perc" },
  decoct: { n: "Настій / відвар", thermo: -1, scale: [1, 1, 0], cost: 1, pharma: 1, anchor: "m-decoct" },
  soxhlet: { n: "Сокслет", thermo: -1, scale: [1, 1, 0], cost: 1, pharma: 0, anchor: "m-soxhlet" },
  hydro: { n: "Гідродистиляція / парова дистиляція", thermo: -1, scale: [1, 1, 1], cost: 1, pharma: 1, anchor: "m-hydro" },
  press: { n: "Холодне пресування", thermo: 2, scale: [0, 1, 1], cost: 2, pharma: 1, anchor: "m-press" },
  cc: { n: "Протитечійна екстракція", thermo: 1, scale: [0, 0, 1], cost: 3, pharma: 1, anchor: "m-cc" },
  uae: { n: "Ультразвукова екстракція (UAE)", thermo: 1, scale: [1, 1, 0], cost: 1, pharma: 1, anchor: "m-uae" },
  mae: { n: "Мікрохвильова екстракція (MAE / SFME)", thermo: 0, scale: [1, 1, 0], cost: 2, pharma: 1, anchor: "m-mae" },
  sfe: { n: "Надкритична CO₂-екстракція (SFE)", thermo: 2, scale: [1, 1, 1], cost: 3, pharma: 1, anchor: "m-sfe" },
  ple: { n: "Екстракція під тиском (PLE) / субкритична вода (SWE)", thermo: 0, scale: [1, 1, 0], cost: 3, pharma: 1, anchor: "m-swe" },
  eae: { n: "Ферментативна екстракція (EAE)", thermo: 1, scale: [1, 1, 1], cost: 1, pharma: 1, anchor: "m-eae" },
  pef: { n: "Імпульсне електричне поле (PEF)", thermo: 2, scale: [0, 1, 1], cost: 3, pharma: 1, anchor: "m-pef" },
  nades: { n: "NADES + UAE/MAE", thermo: 1, scale: [1, 1, 0], cost: 1, pharma: 0, anchor: "m-nades" },
  mic: { n: "Міцелярна екстракція / CPE / ATPS", thermo: 1, scale: [1, 0, 0], cost: 1, pharma: 0, anchor: "m-micelle" },
};
const CMAP = [   // клас → [основні методи, альтернативи, розчинники, примітка]
  ["Флавоноїди (глікозиди)", ["perc", "uae", "mae"], ["ple", "eae", "nades"], "50–70 % етанол; вода; NADES"],
  ["Аглікони флавоноїдів, катехіни", ["uae", "macer"], ["sfe"], "70–96 % етанол; етилацетат (фракціонування); SFE + 10–15 % етанолу"],
  ["Фенольні кислоти", ["uae", "decoct"], ["ple", "pef"], "30–70 % етанол; слабкокисла вода"],
  ["Дубильні речовини", ["decoct", "macer", "uae"], ["ple", "nades"], "вода (відвар); 50–70 % ацетон; 40–50 % етанол"],
  ["Алкалоїди", ["macer", "perc"], ["sfe", "ple"], "кислотно-основна схема: підкислена вода/етанол → підлужування → органічний розчинник"],
  ["Ефірні олії", ["hydro"], ["sfe", "mae"], "вода/пара; CO₂"],
  ["Сапоніни", ["macer", "uae"], ["nades", "ple"], "50–70 % етанол або вода"],
  ["Серцеві глікозиди", ["perc"], ["uae"], "70 % етанол після стабілізації сировини"],
  ["Антраглікозиди", ["perc", "macer"], ["uae", "mae"], "50–70 % етанол, вода"],
  ["Кумарини", ["soxhlet", "uae"], ["sfe"], "етанол, метанол; SFE з модифікатором"],
  ["Каротиноїди", ["sfe", "macer"], ["uae", "eae"], "CO₂; гексан/ацетон (з контролем залишків); рослинні олії"],
  ["Полісахариди", ["decoct", "eae"], ["uae", "ple", "mae"], "вода 70–100 °C → осадження 80 % етанолом"],
  ["Жирні олії", ["press"], ["sfe"], "холодне пресування; CO₂; 2-метилоксолан"],
  ["Вітамін C", ["macer"], [], "вода, 1–3 % метафосфорна або щавлева кислота (холодна екстракція)"],
  ["Токофероли / вітамін E", ["sfe"], ["macer"], "CO₂, олії"],
];
reg("decide", {
  dom(body) {
    const wrap = el("div", "ex-dec"); const form = el("div", "ex-dec__form"); const out = el("div", "ex-dec__out");
    const mk = (id, label, opts) => { const l = el("label", "ex-dec__f"); l.append(label); const s = document.createElement("select"); s.id = "dec-" + id; opts.forEach(([v, t], i) => { const o = document.createElement("option"); o.value = v; o.textContent = t; s.append(o); }); s.addEventListener("change", run); l.append(s); form.append(l); return s; };
    const sCls = mk("cls", "Цільовий клас БАР", CMAP.map((c, i) => [i, c[0]]));
    const sTh = mk("th", "Термолабільна ціль?", [[1, "так (катехіни, аскорбінова кислота, естери, антоціани…)"], [0, "ні (кофеїн, багато фенольних кислот, полісахариди)"]]);
    const sSc = mk("sc", "Масштаб", [[0, "лабораторія / аналітика"], [1, "пілотний"], [2, "промисловість"]]);
    const sBu = mk("bu", "Бюджет на обладнання", [[1, "низький"], [2, "середній"], [3, "високий"]]);
    const sPr = mk("pr", "Кінцевий продукт", [["pharma", "фармацевтичний препарат (Ph. Eur. / ДФУ)"], ["food", "харчова продукція / нутрицевтик"], ["cosm", "косметика"], ["lab", "аналітика / дослідження"]]);
    wrap.append(form, out); body.append(wrap);
    function run() {
      const c = CMAP[+sCls.value], th = +sTh.value, sc = +sSc.value, bu = +sBu.value, pr = sPr.value; const rows = [];
      const ids = new Set([...c[1], ...c[2]]); if (th === 0) { ids.add("soxhlet"); if (c[0].startsWith("Полісахариди") || c[0].startsWith("Фенольні")) ids.add("ple"); }
      for (const id of ids) {
        const m = M[id]; let score = c[1].includes(id) ? 6 : 3; const why = [], warn = []; if (c[1].includes(id)) why.push("метод першого вибору для цього класу БАР"); else why.push("альтернативний метод для цього класу");
        if (th === 1) { if (m.thermo === 2) { score += 2; why.push("працює при низькій температурі (термолабільна ціль)"); } else if (m.thermo === 1) { score += 1; } else if (m.thermo === -1) { score -= 5; warn.push("ризик деградації при нагріванні або гідролізу"); } else { score -= 1; warn.push("режим потрібно підібрати, щоб уникнути перегріву"); } } else if (m.thermo === 2) { score += .5; }
        if (m.scale[sc]) { score += 1.5; } else { score -= 3; warn.push(["для лабораторного масштабу", "для пілотного масштабу", "для промислового масштабу"][sc] + " метод застосовують обмежено"); }
        if (m.cost <= bu) score += 1; else { score -= 2.5; warn.push("потребує дорожчого обладнання, ніж обраний бюджет"); }
        if (pr === "pharma" && !m.pharma) { score -= 4; warn.push("немає фармакопейного статусу для лікарських засобів"); } if (pr === "pharma" && m.pharma) score += .5; if (pr === "cosm" && id === "nades") { score += 2; why.push("NADES-екстракт можна використати в косметиці без виділення продукту"); }
        rows.push({ id, m, score, why, warn });
      }
      rows.sort((a, b) => b.score - a.score); const top = rows.slice(0, 3);
      const solv = (pr === "pharma" ? "Фармацевтика: вода, етанол, CO₂ (етанол — ICH клас 3). Метанол і гексан — клас 2, у препаратах обмежені." : pr === "food" ? "Харчова продукція: розчинники з дозволеного переліку (ЄС — Директива 2009/32/ЄС); перевага — вода, етанол, CO₂." : pr === "cosm" ? "Косметика: вода, етанол, гліцерин, рослинні олії, NADES." : "Аналітика: можливі й метанол та інші розчинники, але з контролем безпеки.");
      out.innerHTML = `<h4>Рекомендація для класу «${c[0]}»</h4><ol class="ex-dec__list">${top.map(r => `<li><a href="#${r.m.anchor}"><b>${r.m.n}</b></a><span class="ex-dec__score" style="--w:${clamp(r.score / 11, .08, 1) * 100}%"></span><ul>${r.why.map(w => `<li class="ok">${w}</li>`).join("")}${r.warn.map(w => `<li class="no">${w}</li>`).join("")}</ul></li>`).join("")}</ol><p class="ex-dec__s"><b>Розчинники:</b> ${c[3]}.</p><p class="ex-dec__s">${solv}</p><p class="ex-dec__fn">Правила спрощені з розділів 5.10, 6.2 та 12 матеріалу; це підказка для навчання, а не регламент: процес валідують експериментально.</p>`;
    }
    run();
  },
});

/* ====================== ПОРІВНЯННЯ МЕТОДІВ (радар) ====================== */
const AX = ["Швидкість", "Економія розчинника", "Дешевизна обладнання", "Вихід", "Селективність", "Екологічність", "Масштабованість", "Щадність до термолабільних"];
const SC = {
  macer: ["Мацерація", [1, 1, 5, 2, 1, 3, 5, 5]], perc: ["Перколяція", [2, 1, 4, 3, 1, 3, 5, 5]], decoct: ["Настій / відвар", [4, 4, 5, 3, 1, 4, 3, 1]], soxhlet: ["Сокслет", [1.5, 3, 4, 4, 1, 1, 3, 1]], hydro: ["Гідродистиляція", [2, 5, 4, 4, 4, 4, 5, 1]],
  uae: ["UAE", [5, 4, 4, 4, 2, 4, 3, 4]], mae: ["MAE / SFME", [5, 5, 3, 4, 3, 4, 2, 3]], sfe: ["SFE-CO₂", [3, 5, 1, 4, 5, 5, 4, 5]], ple: ["PLE", [5, 4, 2, 4, 3, 4, 3, 3]], swe: ["SWE", [4, 5, 2, 4, 3, 5, 3, 1]],
  eae: ["EAE", [2.5, 5, 4, 4, 3, 4, 4, 4]], pef: ["PEF", [5, 4, 2, 4, 2, 5, 4, 5]], hhpe: ["HHPE", [5, 3, 1, 4, 2, 4, 1, 5]], nades: ["NADES + UAE/MAE", [4, 4, 4, 4, 3, 4, 2, 4]], cpe: ["CPE / ATPS", [4, 4, 4, 3, 3, 4, 1, 4]],
};
const RCOL = ["#2F7D4F", "#C98A1B", "#2E6FB5"];
reg("compare", {
  dom(body) {
    const wrap = el("div", "ex-cmp"); const chips = el("div", "ex-chips"); const cv = document.createElement("canvas"); cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Радарна діаграма порівняння методів екстракції"); const side = el("div", "ex-cmp__side");
    const sel = new Set(["macer", "uae", "sfe"]);
    Object.entries(SC).forEach(([id, [n]]) => { const b = btn(n, "", () => { if (sel.has(id)) { if (sel.size > 1) sel.delete(id); } else { if (sel.size >= 3) sel.delete([...sel][0]); sel.add(id); } draw(); }); b.dataset.id = id; chips.append(b); });
    wrap.append(chips, el("div", "ex-cmp__cv")); wrap.lastChild.append(cv); wrap.append(side); body.append(wrap);
    const ctx = cv.getContext("2d");
    const size = () => { const w = cv.parentElement.clientWidth || 600, h = Math.round(clamp(w * .72, 300, 460)), d = Math.min(2, devicePixelRatio || 1); cv.style.height = h + "px"; cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0); return [w, h]; };
    function draw() {
      const [W, H] = size(); [...chips.children].forEach(b => { const i = [...sel].indexOf(b.dataset.id); b.setAttribute("aria-pressed", String(i >= 0)); b.style.setProperty("--c", i >= 0 ? RCOL[i] : "#2F7D4F"); });
      const c = ctx; D.bg(c, W, H); const cx = W * .5, cy = H * .5, R = Math.min(W, H) * .32, n = AX.length; const pt = (i, v) => [cx + Math.sin(i / n * 6.2832) * R * v / 5, cy - Math.cos(i / n * 6.2832) * R * v / 5];
      for (let k = 1; k <= 5; k++) { c.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = pt(i, k); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); c.strokeStyle = k === 5 ? C.muted : C.rule; c.lineWidth = 1; c.stroke(); }
      for (let i = 0; i < n; i++) { const [x, y] = pt(i, 5), [lx, ly] = pt(i, 5.9); c.strokeStyle = C.rule; c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke(); D.txt(c, AX[i], lx, ly, { size: 11.5, align: lx < cx - 5 ? "right" : lx > cx + 5 ? "left" : "center", weight: 700, color: C.soft }); }
      [...sel].forEach((id, j) => { const v = SC[id][1]; c.beginPath(); v.forEach((x, i) => { const [px, py] = pt(i, x); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.fillStyle = alpha(RCOL[j], .16); c.fill(); c.strokeStyle = RCOL[j]; c.lineWidth = 2.6; c.stroke(); v.forEach((x, i) => { const [px, py] = pt(i, x); c.fillStyle = RCOL[j]; c.beginPath(); c.arc(px, py, 3.4, 0, 7); c.fill(); }); });
      side.innerHTML = [...sel].map((id, j) => `<div style="--c:${RCOL[j]}"><b>${SC[id][0]}</b><span>${SC[id][1].map((x, i) => `${AX[i]}: ${x}`).join(" · ")}</span></div>`).join("") + `<p class="ex-cmp__fn">Оцінки 1–5 — наш якісний переклад порівняльної таблиці 5.10 матеріалу (5 — найкраще за цим критерієм; для «Економії розчинника» і «Дешевизни обладнання» — найменша витрата чи вартість). Вони орієнтовні й не нормативні.</p>`;
    }
    new ResizeObserver(() => draw()).observe(wrap); draw();
  },
});
