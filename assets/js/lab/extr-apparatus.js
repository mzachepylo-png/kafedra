/* Лабораторні апарати: Сокслет, гідродистиляція (Клевенджер) і дистиляція з водяною парою.
   Малюнок виконано у «проєктних» координатах і вписано в полотно (D.fit). */
import { reg, D, C, clamp, lerp, rng, fmt, mixHex, alpha, extractColor } from "./extr-core.js";

const tube = (c, pts, w = 10, fill = "rgba(226,240,238,.85)") => {
  const path = () => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); };
  c.lineJoin = "round"; c.lineCap = "butt"; path(); c.strokeStyle = C.glass; c.lineWidth = w + 3; c.stroke(); path(); c.strokeStyle = fill; c.lineWidth = w; c.stroke();
};
const polyLen = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const along = (pts, s) => { const L = polyLen(pts); let d = s * L; for (let i = 1; i < pts.length; i++) { const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= seg) { const t = d / seg; return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]; } d -= seg; } return pts[pts.length - 1]; };
const roundFlask = (c, cx, cy, r, nw, top, fill, level, liquid, inside) => {
  const half = nw / 2, yk = cy - Math.sqrt(r * r - half * half), a = Math.atan2(-Math.sqrt(r * r - half * half), half);
  const path = (cc) => { cc.beginPath(); cc.moveTo(cx - half, top); cc.lineTo(cx - half, yk); cc.arc(cx, cy, r, Math.PI - Math.abs(a), Math.abs(a) * 1 + 0, true); cc.lineTo(cx + half, top); };
  const p2 = (cc) => { cc.beginPath(); cc.moveTo(cx - half, top); cc.lineTo(cx - half, yk); cc.arc(cx, cy, r, Math.atan2(yk - cy, -half), Math.atan2(yk - cy, half), true); cc.lineTo(cx + half, top); };
  D.vessel(c, p2, cx - r, top, r * 2, cy + r - top, level, liquid, { a: .9, inside });
};
const heater = (c, x, y, w, pw, t) => { D.rr(c, x, y, w, 20, 7); c.fillStyle = "#59666D"; c.fill(); const g = c.createLinearGradient(0, y - 14, 0, y); g.addColorStop(0, "rgba(255,120,40,0)"); g.addColorStop(1, `rgba(255,120,40,${.15 + pw * .6})`); c.fillStyle = g; c.fillRect(x + 6, y - 14, w - 12, 14); D.txt(c, "нагрівач", x + w / 2, y + 10.5, { size: 10.5, color: "#fff", align: "center" }); };
const lab = (c, s, x, y, ax, ay, align = "left", color = C.soft) => { c.strokeStyle = "rgba(60,80,70,.45)"; c.lineWidth = .9; c.beginPath(); c.moveTo(x + (align === "left" ? -3 : 3), y); c.lineTo(ax, ay); c.stroke(); };

/* ====================== СОКСЛЕТ ====================== */
reg("soxhlet", {
  aspect: 1.62,
  params: [{ k: "pw", label: "Нагрів колби", min: 30, max: 100, step: 5, v: 60, u: "%" }],
  info: "Розчинник кипить у колбі, пара по бічній трубці йде до холодильника, конденсат стікає на гільзу з сировиною й заповнює камеру. Коли рівень досягає коліна сифона, <b>весь екстракт переливається в колбу</b>, а на сировину знову капає свіжий чистий розчинник. Тому вичерпання майже повне, але БАР довго перебувають при температурі кипіння колби.",
  init() { return { Lc: 0, X: 1, cyc: 0, siph: 0, flaskC: 0, vap: [], drops: [], bub: [], hours: 0, hist: [[0, 100]] }; },
  step(S, P, dt) {
    const pw = P.pw / 100, fillT = 12 / (.35 + pw * 1.1);
    S.hours += dt * .085;
    if (S.siph > 0) { S.siph -= dt / 2.4; S.Lc = Math.max(0, S.Lc - dt / 2.2); if (S.siph <= 0) { S.siph = 0; S.Lc = 0; } }
    else { S.Lc += dt / fillT * .94; if (S.Lc >= .94) { S.Lc = .94; S.siph = 1; S.cyc++; const take = .34 * S.X; S.X -= take; S.flaskC += take; S.hist.push([S.cyc, S.X * 100]); } }
    const r = Math.random;
    if (r() < dt * 24 * pw) S.vap.push({ s: 0, j: r() }); for (const v of S.vap) v.s += dt * (.38 + pw * .6); S.vap = S.vap.filter(v => v.s < 1);
    if (r() < dt * 20 * pw) S.bub.push({ x: r(), y: 0, r: 1.8 + r() * 2.4 }); for (const b of S.bub) b.y += dt * (1.2 + pw); S.bub = S.bub.filter(b => b.y < 1);
    if (S.siph === 0 && r() < dt * 8 * pw) S.drops.push({ y: 0 }); for (const d of S.drops) d.y += dt * 2.4; S.drops = S.drops.filter(d => d.y < 1);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const pw = P.pw / 100, gw = W * .38;
    const VAP = [[258, 312], [330, 312], [330, 134], [276, 134], [276, 150]];
    D.fit(c, 6, 4, W * .62, H - 8, 480, 470, (s) => {
      // нагрівач і колба
      heater(c, 170, 446, 140, pw, t);
      roundFlask(c, 240, 386, 60, 36, 306, 0, .42, extractColor(S.flaskC * 1.15, "green"), (cc) => { for (const b of S.bub) { cc.fillStyle = "rgba(255,255,255,.75)"; cc.beginPath(); cc.arc(240 - 32 + b.x * 64, 410 - b.y * 40, b.r, 0, 7); cc.fill(); } });
      // камера
      const chamber = (cc) => { cc.beginPath(); cc.moveTo(186, 150); cc.lineTo(186, 282); cc.quadraticCurveTo(186, 298, 222, 306); cc.lineTo(258, 306); cc.quadraticCurveTo(294, 298, 294, 282); cc.lineTo(294, 150); };
      D.vessel(c, chamber, 186, 150, 108, 156, 0, "#fff", { glassFill: "rgba(214,235,230,.16)" });
      // гільза з сировиною
      c.fillStyle = "#F1E8D0"; D.rr(c, 213, 190, 54, 98, 5); c.fill(); c.strokeStyle = "#B7A67A"; c.lineWidth = 1.4; c.stroke();
      c.save(); D.rr(c, 214, 191, 52, 96, 4); c.clip(); const r2 = rng(2); for (let i = 0; i < 24; i++) D.chip(c, 218 + r2() * 44, 200 + r2() * 82, 4.4, r2() * 6, mixHex("#B9B07A", "#4F8F45", S.X)); c.restore();
      // рідина в камері (рівень 0.94 → коліно сифона)
      c.save(); chamber(c); c.clip(); const ly = 300 - (300 - 176) * clamp(S.Lc / .94, 0, 1); c.fillStyle = extractColor((1 - S.X) + .12, "green"); c.globalAlpha = .55; c.fillRect(180, ly, 120, 306 - ly); c.globalAlpha = 1; c.fillStyle = "rgba(255,255,255,.5)"; if (S.Lc > .01) c.fillRect(180, ly, 120, 1.6); c.restore();
      // з'єднувальна шийка камера → колба
      tube(c, [[240, 306], [240, 322]], 36, "rgba(226,240,238,.5)");
      // сифон (ліва трубка)
      const SIF = [[204, 300], [204, 178], [196, 170], [172, 170], [168, 178], [168, 318], [182, 326], [222, 326]];
      tube(c, SIF, 9);
      if (S.siph > 0) { c.save(); c.strokeStyle = extractColor((1 - S.X) + .18, "green"); c.lineWidth = 6; c.globalAlpha = .85; c.beginPath(); [[196, 172], [172, 172], [168, 180], [168, 314], [180, 322], [222, 322]].forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.restore(); }
      // бічна трубка пари (права)
      tube(c, VAP, 11, "rgba(226,240,238,.55)");
      for (const v of S.vap) { const [x, y] = along(VAP, clamp(v.s * 1.35, 0, 1)); if (v.s > .74) { const k = (v.s - .74) / .26; c.fillStyle = `rgba(255,255,255,${.9 * (1 - k)})`; c.beginPath(); c.arc(x - k * 34, y - 18 - k * 64, 2.8, 0, 7); c.fill(); } else { c.fillStyle = "rgba(255,255,255,.95)"; c.strokeStyle = "rgba(0,0,0,.28)"; c.lineWidth = .8; c.beginPath(); c.arc(x + Math.sin(v.j * 9 + t * 5) * 1.6, y, 2.7, 0, 7); c.fill(); c.stroke(); } }
      // холодильник
      D.vessel(c, (cc) => { cc.beginPath(); cc.moveTo(222, 28); cc.lineTo(222, 150); cc.lineTo(258, 150); cc.lineTo(258, 28); cc.closePath(); }, 222, 28, 36, 122, 0, "#fff", { glassFill: "rgba(214,235,230,.12)" });
      D.rr(c, 206, 50, 68, 86, 10); const wg = c.createLinearGradient(0, 50, 0, 136); wg.addColorStop(0, "rgba(142,193,234,.65)"); wg.addColorStop(1, "rgba(142,193,234,.22)"); c.fillStyle = wg; c.fill(); c.strokeStyle = alpha("#2E6FB5", .65); c.lineWidth = 1.6; c.stroke();
      for (let i = 0; i < 6; i++) { c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1.4; const yy = 60 + ((i * 14 + t * 22) % 70); c.beginPath(); c.moveTo(212, yy); c.lineTo(268, yy - 4); c.stroke(); }
      D.arrow(c, 316, 118, 276, 118, C.blue, 2.4, 7); D.arrow(c, 204, 66, 164, 66, C.blue, 2.4, 7);
      // краплі конденсату
      for (const d of S.drops) { c.fillStyle = "rgba(255,255,255,.95)"; c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = .8; c.beginPath(); c.arc(240 + Math.sin(d.y * 7) * 3, 150 + d.y * 40, 2.6, 0, 7); c.fill(); c.stroke(); }
      // підписи
      lab(c, s, 338, 94, 276, 94); D.txt(c, "холодильник", 340, 94, { size: 11.5, color: C.soft, weight: 700 });
      lab(c, s, 346, 222, 334, 222); D.txt(c, "труба пари", 348, 222, { size: 11.5, color: C.soft, weight: 700 });
      lab(c, s, 150, 244, 168, 244, "right"); D.txt(c, "сифон", 150, 244, { size: 11.5, color: C.soft, weight: 700, align: "right" });
      lab(c, s, 150, 214, 213, 214, "right"); D.txt(c, "гільза з сировиною", 150, 214, { size: 11.5, color: C.soft, weight: 700, align: "right" });
      lab(c, s, 150, 392, 182, 392, "right"); D.txt(c, "колба з розчинником", 150, 392, { size: 11.5, color: C.soft, weight: 700, align: "right" });
      D.txt(c, "вода (вихід)", 158, 54, { size: 10.5, color: C.blue, align: "right", weight: 700 }); D.txt(c, "вода (вхід)", 322, 134, { size: 10.5, color: C.blue, weight: 700 });
      if (S.siph > 0) D.tag(c, "СИФОН: екстракт → колба", 240, 20, { size: 12, bg: "#E6F4EA", stroke: C.green, color: C.greenD });
    });
    // права панель
    const gx = W * .64, gww = W * .32, gy = 40, gh = H * .46;
    D.chart(c, gx + 24, gy, gww - 24, gh, { x: [0, Math.max(8, S.cyc + 1)], y: [0, 100], xl: "цикл", yl: "залишок БАР у гільзі, %", series: [{ pts: S.hist, col: C.brown, w: 2.6, fill: "rgba(123,74,34,.1)" }], marks: [{ x: S.cyc, y: S.X * 100, col: C.brown }], hl: [{ y: 5, col: C.green, label: "≈ вичерпано" }], title: "Вичерпання сировини" });
    D.tag(c, S.siph > 0 ? "екстракт переливається" : S.Lc > .02 ? "камера заповнюється" : "розчинник кипить", gx + 24 + (gww - 24) / 2, gy + gh + 44, { size: 12 });
    D.txt(c, `Цикл № ${S.cyc}`, gx + 24, gy + gh + 78, { size: 15, weight: 800, color: C.greenD }); D.txt(c, `≈ ${fmt(S.hours, 1)} год роботи (модельний час)`, gx + 24, gy + gh + 100, { size: 11.5, color: C.soft });
  },
  reads: (S, P) => [["Циклів", String(S.cyc)], ["У гільзі лишилось", fmt(S.X * 100, 0), "%"], ["Екстракт у колбі", fmt(S.flaskC * 100, 0), "%"]],
});

/* ====================== ГІДРОДИСТИЛЯЦІЯ ====================== */
reg("hydro", {
  aspect: 1.62,
  modes: [["hd", "Гідродистиляція (апарат Клевенджера)"], ["st", "Дистиляція з водяною парою (промислова)"]],
  params: [{ k: "pw", label: "Нагрівання", min: 30, max: 100, step: 5, v: 70, u: "%" }],
  info: "Пара розриває залозки й виносить леткі компоненти. Конденсат розшаровується: ефірна олія легша за воду (збирається зверху), а <b>гідролат</b> повертається в колбу (Клевенджер) або відводиться окремо (флорентина). Мінус методу — гідроліз естерів (ліналілацетат → ліналоол) і втрата водорозчинних компонентів.",
  init() { return { th: 0, oil: 0, vap: [], bub: [], dr: [], hist: [[0, 0]] }; },
  step(S, P, dt) {
    const pw = P.pw / 100, rate = .3 + pw * 1.2, r = Math.random;
    S.th += dt * .045 * rate; S.oil += (1 - S.oil) * (1 - Math.exp(-dt * .16 * rate * .9));
    if (r() < dt * 26 * pw) S.vap.push({ s: 0, j: r() }); for (const v of S.vap) v.s += dt * (.32 + pw * .55); S.vap = S.vap.filter(v => v.s < 1);
    if (r() < dt * 24 * pw) S.bub.push({ x: r(), y: 0, r: 1.8 + r() * 2.4 }); for (const b of S.bub) b.y += dt * (1 + pw); S.bub = S.bub.filter(b => b.y < 1);
    if (r() < dt * 9 * pw) S.dr.push({ y: 0 }); for (const d of S.dr) d.y += dt * 2.2; S.dr = S.dr.filter(d => d.y < 1);
    if (S.hist.length === 0 || S.th - S.hist[S.hist.length - 1][0] > .02) S.hist.push([S.th, S.oil * 100]);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const pw = P.pw / 100, st = P.mode === "st";
    const herb = (cc, x0, y0, w, hh, seed) => { const r2 = rng(seed); for (let i = 0; i < 20; i++) D.chip(cc, x0 + 8 + r2() * (w - 16), y0 + r2() * hh + Math.sin(t * 1.4 + i) * 1.4, 6, r2() * 6, mixHex("#7FB06A", "#C9B96A", S.oil * .6)); };
    const oilTrap = (x, y, w, hh, lvl, tall) => { // колонка: олія зверху, гідролат знизу
      D.vessel(c, (cc) => { cc.beginPath(); cc.moveTo(x, y); cc.lineTo(x, y + hh); cc.lineTo(x + w, y + hh); cc.lineTo(x + w, y); }, x, y, w, hh, .88, "#BFE0F2", { a: .6, inside: (cc) => { cc.fillStyle = C.oil; cc.globalAlpha = .95; cc.fillRect(x, y + hh * .12, w, Math.max(1.2, S.oil * tall)); cc.globalAlpha = 1; for (let i = 0; i < 14; i++) { cc.fillStyle = C.muted; cc.fillRect(x + w - (i % 5 ? 7 : 13), y + hh * .12 + i * 10, i % 5 ? 7 : 13, 1); } } });
    };
    D.fit(c, 6, 4, W * .64, H - 8, 560, 468, (s) => {
      if (!st) {
        // КЛЕВЕНДЖЕР
        heater(c, 52, 416, 150, pw, t);
        roundFlask(c, 127, 346, 66, 40, 214, 0, .56, "#BFE0F2", (cc) => { herb(cc, 80, 330, 94, 60, 9); for (const b of S.bub) { cc.fillStyle = "rgba(255,255,255,.75)"; cc.beginPath(); cc.arc(88 + b.x * 78, 392 - b.y * 66, b.r, 0, 7); cc.fill(); } });
        D.txt(c, "вода + подрібнена сировина", 212, 428, { size: 11.5, color: C.soft, weight: 700 });
        const RIS = [[127, 216], [127, 104], [170, 104]]; tube(c, RIS, 18, "rgba(226,240,238,.55)");
        // холодильник (похила труба в кожусі)
        c.save(); c.translate(170, 104); const ang = Math.atan2(60, 160); c.rotate(ang); const L = Math.hypot(160, 60);
        D.rr(c, 0, -20, L, 40, 12); const wg = c.createLinearGradient(0, -20, 0, 20); wg.addColorStop(0, "rgba(142,193,234,.7)"); wg.addColorStop(1, "rgba(142,193,234,.25)"); c.fillStyle = wg; c.fill(); c.strokeStyle = alpha("#2E6FB5", .65); c.lineWidth = 1.6; c.stroke(); tube(c, [[0, 0], [L, 0]], 9);
        for (let i = 0; i < 6; i++) { c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 1.2; const xx = 10 + ((i * 28 + t * 24) % (L - 14)); c.beginPath(); c.moveTo(xx, -14); c.lineTo(xx + 8, 14); c.stroke(); } c.restore();
        D.txt(c, "холодильник", 270, 62, { size: 11.5, color: C.soft, weight: 700, align: "center" }); D.arrow(c, 214, 150, 232, 126, C.blue, 2, 6);
        // градуйована пастка
        oilTrap(318, 164, 50, 170, .8, 78); D.txt(c, "градуйована пастка", 343, 350, { size: 11.5, align: "center", color: C.soft, weight: 700 });
        lab(c, s, 396, 188, 368, 188); D.txt(c, "олія (зверху)", 398, 188, { size: 11.5, color: "#8A6A10", weight: 700 }); lab(c, s, 396, 280, 368, 280); D.txt(c, "гідролат (знизу)", 398, 280, { size: 11.5, color: C.blue, weight: 700 });
        // повернення гідролату
        const RET = [[318, 300], [150, 300], [150, 250]]; tube(c, RET, 9, "rgba(190,224,242,.65)"); D.arrow(c, 250, 300, 226, 300, C.blue, 2, 6); D.txt(c, "гідролат повертається в колбу", 232, 318, { size: 11, align: "center", color: C.blue, weight: 600 });
        const VAPP = [[127, 214], [127, 104], [170, 104], [330, 164]];
        for (const v of S.vap) { const [x, y] = along(VAPP, clamp(v.s * 1.15, 0, 1)); c.fillStyle = "rgba(255,255,255,.95)"; c.strokeStyle = "rgba(0,0,0,.28)"; c.lineWidth = .8; c.beginPath(); c.arc(x + Math.sin(v.j * 9 + t * 5) * 1.4, y, 2.6, 0, 7); c.fill(); c.stroke(); }
        for (const d of S.dr) { c.fillStyle = "rgba(200,225,240,.95)"; c.beginPath(); c.arc(331, 168 + d.y * 40, 2.6, 0, 7); c.fill(); }
      } else {
        // ПАРОВА ДИСТИЛЯЦІЯ
        heater(c, 28, 416, 130, pw, t);
        roundFlask(c, 93, 350, 54, 34, 258, 0, .55, "#A8D2EE", (cc) => { for (const b of S.bub) { cc.fillStyle = "rgba(255,255,255,.8)"; cc.beginPath(); cc.arc(62 + b.x * 62, 392 - b.y * 50, b.r, 0, 7); cc.fill(); } });
        D.txt(c, "парогенератор", 93, 454, { size: 11.5, align: "center", color: C.soft, weight: 700 });
        const vx = 210, vw = 116, vy = 150, vh = 224;
        D.vessel(c, D.beakerPath(vx, vy, vw, vh, 12), vx, vy, vw, vh, 0, "#fff", { glassFill: "rgba(214,235,230,.18)", inside: (cc) => { cc.fillStyle = "#c8d2d6"; cc.fillRect(vx, vy + vh - 52, vw, 3); herb(cc, vx, vy + 50, vw, vh - 130, 4); } });
        D.rr(c, vx - 5, vy - 10, vw + 10, 11, 4); c.fillStyle = "#8C9AA2"; c.fill();
        D.txt(c, "решітка", vx + vw + 6, vy + vh - 50, { size: 10.5, color: C.soft }); D.txt(c, "сировина на решітці", vx + vw / 2, vy + vh + 18, { size: 11.5, align: "center", color: C.soft, weight: 700 });
        const IN = [[93, 256], [93, 232], [268, 232], [268, vy + vh - 40]]; tube(c, IN, 8, "rgba(226,240,238,.5)");
        const OUT = [[268, vy - 8], [268, 100], [340, 100]]; tube(c, OUT, 10, "rgba(226,240,238,.55)");
        c.save(); c.translate(340, 100); c.rotate(Math.atan2(40, 90)); const L = Math.hypot(90, 40); D.rr(c, 0, -18, L, 36, 11); const wg = c.createLinearGradient(0, -18, 0, 18); wg.addColorStop(0, "rgba(142,193,234,.7)"); wg.addColorStop(1, "rgba(142,193,234,.25)"); c.fillStyle = wg; c.fill(); c.strokeStyle = alpha("#2E6FB5", .65); c.lineWidth = 1.6; c.stroke(); tube(c, [[0, 0], [L, 0]], 8); c.restore();
        D.txt(c, "холодильник", 390, 70, { size: 11.5, color: C.soft, weight: 700, align: "center" });
        // флорентина
        oilTrap(455, 196, 70, 190, .9, 70); D.txt(c, "флорентина", 490, 404, { size: 11.5, align: "center", color: C.soft, weight: 700 });
        lab(c, s, 535, 226, 525, 226, "left"); D.txt(c, "олія", 537, 226, { size: 11.5, color: "#8A6A10", weight: 700 }); lab(c, s, 535, 330, 525, 330); D.txt(c, "гідролат", 537, 330, { size: 11.5, color: C.blue, weight: 700 });
        const VAPP = [[93, 256], [93, 232], [268, 232], [268, 340], [268, 100], [340, 100], [430, 140]];
        const VP = [[93, 256], [93, 232], [268, 232], [268, vy + vh - 40], [268, vy - 8], [268, 100], [340, 100], [430, 142]];
        for (const v of S.vap) { const [x, y] = along(VP, clamp(v.s * 1.1, 0, 1)); c.fillStyle = "rgba(255,255,255,.95)"; c.strokeStyle = "rgba(0,0,0,.28)"; c.lineWidth = .8; c.beginPath(); c.arc(x + Math.sin(v.j * 9 + t * 5) * 1.4, y, 2.6, 0, 7); c.fill(); c.stroke(); }
        for (const d of S.dr) { c.fillStyle = "rgba(200,225,240,.95)"; c.beginPath(); c.arc(432, 146 + d.y * 56, 2.6, 0, 7); c.fill(); }
      }
    });
    const gx = W * .66, gww = W * .3, gy = 40, gh = H * .46;
    D.chart(c, gx + 24, gy, gww - 24, gh, { x: [0, 4], y: [0, 100], xl: "год", yl: "олія, % від макс.", series: [{ pts: S.hist, col: C.amber, w: 2.6, fill: "rgba(201,138,27,.12)" }], hl: [{ y: 95, col: C.green, label: "кінець відгону" }], title: "Накопичення ефірної олії" });
    D.txt(c, `Зібрано: ${fmt(S.oil * 100, 0)} % від максимуму`, gx + 24, gy + gh + 40, { size: 13, weight: 800, color: C.greenD }); D.txt(c, `≈ ${fmt(S.th, 1)} год відгону`, gx + 24, gy + gh + 62, { size: 12, color: C.soft });
  },
  reads: (S, P) => [["Час відгону", fmt(S.th, 1), "год"], ["Зібрано олії", fmt(S.oil * 100, 0), "% від макс."], ["Режим", P.mode === "st" ? "парова" : "гідро"]],
});
