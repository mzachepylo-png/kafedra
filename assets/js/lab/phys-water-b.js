/* Конспект «Водний режим рослин»: моделі 4–7 (кінцеві двигуни води, продихи, показники транспірації, екологічні групи). */
import { reg, D, C, fmt, clamp, lerp, smooth, rng, mixHex, alpha, hash01, el, btn } from "./extr-core.js";

/* ====================== 4. НИЖНІЙ І ВЕРХНІЙ КІНЦЕВІ ДВИГУНИ ====================== */
const psiAir = (rh) => 137 * Math.log(Math.max(rh, 1) / 100); // МПа при ≈ 20 °C
function water(P) {
  const soil = P.soil / 100, rh = P.rh / 100, vpd = 1 - rh;
  const sf = clamp((P.soil - 12) / 40, 0, 1);          // у посушливому ґрунті продихи закриваються
  const ap = clamp(P.light / 100, 0, 1) * sf;           // відкритість продихів
  const E = 0.05 + 1.35 * ap * vpd;                     // інтенсивність транспірації, г/(дм²·год) — діапазон як у посібнику
  const Pr = Math.max(0, soil * 2.0 - 1.9 * E);         // кореневий тиск, атм
  const psiSoil = -(0.01 + (1 - soil) * 1.4), psiRoot = psiSoil - 0.08 - 0.25 * E, psiStem = psiRoot - 0.15 - 0.5 * E, psiLeaf = psiStem - 0.15 - 0.7 * E;
  const q = Pr * 0.3 + E;
  return { ap, E, Pr, psiSoil, psiRoot, psiStem, psiLeaf, psiAir: psiAir(P.rh), q, gutt: !P.cut && P.rh >= 92 && E < 0.2 && Pr > 0.25 };
}
reg("w-pull", {
  aspect: (w) => (w < 560 ? 0.62 : 1.6),
  params: [
    { k: "light", label: "Освітленість (відкритість продихів)", min: 0, max: 100, step: 5, v: 70, u: "%" },
    { k: "rh", label: "Вологість повітря", min: 20, max: 100, step: 1, v: 45, u: "%" },
    { k: "soil", label: "Запас доступної води в ґрунті", min: 10, max: 100, step: 5, v: 80, u: "%" },
  ],
  toggles: [{ k: "cut", label: "Зрізати стебло: спостерігати «плач» (пасока)", v: false }],
  presets: [
    { label: "Спекотний полудень", set: { light: 100, rh: 30, soil: 70 } }, { label: "Ніч, туман (гутація)", set: { light: 0, rh: 98, soil: 100 } }, { label: "Посуха", set: { light: 90, rh: 35, soil: 15 } }, { label: "Рання весна: «плач»", set: { light: 20, rh: 80, soil: 95 } },
  ], presetsLabel: "Типові ситуації",
  info: "<b>Верхній кінцевий двигун (ВКД)</b> — транспірація: випаровування з листка знижує водний потенціал і «тягне» стовпчик води по ксилемі завдяки <b>когезії</b> (зчепленню молекул води) й <b>адгезії</b> (прилипанню до стінок судин). <b>Нижній кінцевий двигун (НКД)</b> — кореневий тиск: осмотичне нагнітання води в судини; помітний, коли транспірація слабка — вночі, ранньою весною, у вологому повітрі (<b>гутація</b>, <b>плач</b>). Значення — якісна модель; діапазон транспірації 0,15–1,5 г/(дм²·год) — із посібника.",
  init() { const r = rng(2); return { col: Array.from({ length: 26 }, (_, i) => i / 26), drops: [], vap: Array.from({ length: 12 }, () => ({ u: r(), x: r() })), t: 0, pas: 0 }; },
  step(S, P, dt) {
    const w = water(P); S.w = w; S.t += dt; const sp = .07 + w.q * .12;
    S.col = S.col.map(u => (u + dt * sp) % 1);
    for (const v of S.vap) { v.u += dt * (.2 + w.E * .6); if (v.u > 1) { v.u = 0; v.x = Math.random(); } }
    S.drops = S.drops.filter(d => (d.a += dt) < 3);
    if ((w.gutt || (P.cut && w.Pr > .1)) && Math.random() < dt * (P.cut ? w.Pr * 2.4 : 3)) S.drops.push({ a: 0, j: Math.random() });
  },
  draw(c, S, P, W, H, t) {
    const w = S.w || water(P); D.bg(c, W, H, mixHex("#EAF6FC", "#CDE7F6", 1 - P.rh / 100), "#EDF3EA");
    const nar = W < 560, HP = nar ? H * .5 : H, SW = nar ? W : W * .5; const px = nar ? W * .3 : W * .26, ground = HP * .66, rootB = HP * .94, topLeaf = HP * .12;
    // сонце
    if (P.light > 5) { D.glow(c, W * .08, H * .13, 60, "#FFD46B", .55 * P.light / 100); D.sphere(c, W * .08, H * .13, 14, "#FFCB45"); }
    else { D.sphere(c, W * .08, H * .13, 12, "#B8C4D8"); }
    // ґрунт
    const sg = c.createLinearGradient(0, ground, 0, H); sg.addColorStop(0, mixHex("#8B6A47", "#C9B07A", 1 - P.soil / 100)); sg.addColorStop(1, mixHex("#5D4630", "#9C8355", 1 - P.soil / 100)); c.fillStyle = sg; c.fillRect(0, ground, SW, HP - ground);
    for (let i = 0; i < 50; i++) { const hh = hash01(i, 1), hh2 = hash01(i, 2); if (hh2 < P.soil / 100) { c.fillStyle = "rgba(120,180,230,.45)"; c.beginPath(); c.arc(8 + hh * (SW - 16), ground + 10 + hash01(i, 3) * (HP - ground - 16), 2.2, 0, 7); c.fill(); } }
    // коріння
    c.strokeStyle = "#EADFC2"; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(px, ground); c.lineTo(px, ground + (rootB - ground) * .6);
    for (const [dx, dy] of [[-60, .35], [66, .45], [-34, .72], [44, .8], [0, 1]]) { c.moveTo(px, ground + (rootB - ground) * .3); c.quadraticCurveTo(px + dx * .4, ground + (rootB - ground) * dy * .85, px + dx, ground + (rootB - ground) * dy); } c.stroke();
    // стебло та ксилема
    const topY = P.cut ? ground - 70 : topLeaf + 30;
    c.fillStyle = "#4D8C4F"; c.fillRect(px - 8, topY, 16, ground - topY); c.fillStyle = "#CDE8F7"; c.fillRect(px - 4, topY, 8, ground - topY + (rootB - ground) * .5);
    // стовпчик води (рух)
    for (const u of S.col) { const y = ground + (rootB - ground) * .5 - u * (ground + (rootB - ground) * .5 - topY); c.fillStyle = "rgba(46,111,181,.8)"; c.beginPath(); c.arc(px, y, 1.9, 0, 7); c.fill(); }
    // листки
    if (!P.cut) {
      const leaf = (x, y, a, s) => { c.save(); c.translate(x, y); c.rotate(a); const g = c.createLinearGradient(0, -s * .3, 0, s * .3); g.addColorStop(0, "#6BB765"); g.addColorStop(1, "#3F8745"); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * .5, -s * .34, s, 0); c.quadraticCurveTo(s * .5, s * .34, 0, 0); c.fill(); c.strokeStyle = "rgba(255,255,255,.5)"; c.beginPath(); c.moveTo(4, 0); c.lineTo(s - 5, 0); c.stroke(); c.restore(); };
      leaf(px, topLeaf + 36, -.38, 96); leaf(px, topLeaf + 48, Math.PI + .38, 96); leaf(px, topLeaf + 110, -.18, 78); leaf(px, topLeaf + 120, Math.PI + .18, 78);
      // продихи + пара
      for (const v of S.vap) { const lx = px + (v.x - .5) * 150, ly = topLeaf + 10 - v.u * 40; c.fillStyle = `rgba(110,170,220,${.55 * (1 - v.u) * clamp(w.E / .9 + .08, 0, 1)})`; c.beginPath(); c.arc(lx, ly + 30, 2.5, 0, 7); c.fill(); }
      if (w.E > .12) D.arrow(c, px + 70, topLeaf + 44, px + 70, topLeaf - 4, "#5C8FB0", 2.4, 8);
      D.txt(c, "ВКД: транспірація", px + 80, topLeaf + 24, { size: 11, weight: 800, color: "#2D6E96" });
    } else { c.fillStyle = "#3F7D45"; c.fillRect(px - 10, topY - 4, 20, 6); }
    D.txt(c, "НКД: кореневий тиск", px + 12, ground + 18, { size: 11, weight: 800, color: "#8A5A10" });
    if (w.Pr > .1) D.arrow(c, px + 38, ground + 46, px + 38, ground + 18 + 2, "#C98A1B", 2.2, 8);
    // краплі гутації/пасоки
    for (const d of S.drops) { const a = d.a; const gx = P.cut ? px : px + (d.j < .5 ? -1 : 1) * (72 + d.j * 16); const gy = P.cut ? topY - 4 : topLeaf + 56 - (d.j < .5 ? 0 : 6); const fall = Math.max(0, a - 1.4) * 38; c.fillStyle = "rgba(120,190,240,.95)"; c.beginPath(); c.arc(gx, gy + 4 + fall, 2 + Math.min(a, 1.4) * 1.5, 0, 7); c.fill(); }
    if (w.gutt) D.tag(c, "гутація: краплі на краях листків", px + 90, topLeaf + 74, { size: 10.5, bg: "#E6F4FA", stroke: "#5C8FB0", color: "#245B7D" });
    if (P.cut && w.Pr > .1) D.tag(c, "плач: виділяється пасока", px + 80, topY - 18, { size: 10.5, bg: "#FCF3DF", stroke: C.amber, color: "#8A5A10" });
    // права панель: водні потенціали
    const gx = nar ? 12 : W * .52, gw = W - gx - 14, by = nar ? HP + 26 : 34; D.txt(c, "Водний потенціал, МПа", gx, nar ? HP + 10 : 16, { size: 11.5, weight: 700 });
    const rows = [["Ґрунт", w.psiSoil, "#7B5A33"], ["Корінь", w.psiRoot, "#B08A4C"], ["Стебло (ксилема)", w.psiStem, "#4D8C4F"], ["Листок", w.psiLeaf, "#2F7D4F"], ["Повітря", w.psiAir, "#5C8FB0"]];
    const maxv = 4.2, rh = (H - by - (nar ? 74 : 118)) / rows.length;
    rows.forEach(([n, v, col], i) => { const y = by + i * rh; D.txt(c, n, gx, y + 9, { size: 11, color: C.soft }); const len = clamp(-v / maxv, 0, 1) * (gw - 4); c.fillStyle = alpha(col, .85); c.fillRect(gx, y + 17, Math.max(2, len), 11); D.txt(c, i === 4 ? `${fmt(v, 0)} (шкалу обрізано)` : fmt(v, 2), i === 4 ? gx + len - 6 : gx + Math.max(2, len) + 5, y + 23, { size: 10.5, color: i === 4 ? "#fff" : C.ink, weight: 700, align: i === 4 ? "right" : "left" }); });
    D.arrow(c, gx + gw - 18, by + 4, gx + gw - 18, by + rows.length * rh - 4, C.muted, 1.4, 6);
    D.txt(c, "вода тече в бік нижчого Ψ", gx + gw - 24, by + rows.length * rh + 4, { size: 10, align: "right", color: C.muted });
    // мінібар: частки НКД і ВКД
    const sy = nar ? H - 56 : H - 78; const a1 = w.Pr * .3, a2 = w.E, tot = a1 + a2 || 1;
    D.txt(c, "Внесок двигунів у потік води", gx, sy, { size: 11.5, weight: 700 });
    c.fillStyle = "#C98A1B"; c.fillRect(gx, sy + 12, (gw - 4) * a1 / tot, 16); c.fillStyle = "#2E8BB5"; c.fillRect(gx + (gw - 4) * a1 / tot, sy + 12, (gw - 4) * a2 / tot, 16);
    D.txt(c, `НКД ${fmt(a1 / tot * 100, 0)} %`, gx, sy + 44, { size: 11, color: "#8A5A10", weight: 700 }); D.txt(c, `ВКД ${fmt(a2 / tot * 100, 0)} %`, gx + gw - 4, sy + 44, { size: 11, color: "#1F6E8F", weight: 700, align: "right" });
  },
  reads: (S, P) => { const w = water(P); return [["Інтенсивність транспірації", fmt(w.E, 2), "г/(дм²·год)"], ["Кореневий тиск", fmt(w.Pr, 2), "атм"], ["Продихи відкриті на", fmt(w.ap * 100, 0), "%"], ["Ψ листка / Ψ повітря", `${fmt(w.psiLeaf, 2)} / ${fmt(w.psiAir, 0)}`, "МПа"]]; },
});

/* ====================== 5. ПРОДИХИ: ЗАМИКАЮЧІ КЛІТИНИ ====================== */
reg("w-stoma", {
  aspect: (w) => (w < 560 ? 1.0 : 2.0),
  params: [
    { k: "light", label: "Світло (синє/червоне)", min: 0, max: 100, step: 5, v: 80, u: "%" },
    { k: "co2", label: "CO₂ в міжклітинниках", min: 0, max: 100, step: 5, v: 20, u: "%" },
    { k: "aba", label: "Абсцизова кислота (стресовий гормон)", min: 0, max: 100, step: 5, v: 0, u: "%" },
  ],
  presets: [{ label: "День, вода є", set: { light: 90, co2: 15, aba: 0 } }, { label: "Ніч", set: { light: 0, co2: 70, aba: 0 } }, { label: "Посуха: сплеск АБК", set: { light: 90, co2: 20, aba: 90 } }],
  presetsLabel: "Режими",
  info: "Замикаючі клітини бобоподібні, а їх стінки потовщені нерівномірно: <b>внутрішня стінка біля щілини товста й мало еластична</b>, зовнішня — тонка. Коли в клітині нагромаджуються осмотично активні речовини (<b>K⁺</b>, Cl⁻, малат), вода входить, <b>тургор</b> зростає, тонка стінка розтягується сильніше — клітини вигинаються назовні, і щілина розкривається. Світло й низький CO₂ відкривають продихи, <b>АБК</b> — закриває.",
  init() { const r = rng(4); return { a: 0.1, ions: Array.from({ length: 30 }, () => ({ x: r(), y: r(), v: r() })), w: Array.from({ length: 14 }, () => ({ u: r() })), t: 0 }; },
  step(S, P, dt) {
    const tgt = clamp(P.light / 100 * (1 - .75 * P.co2 / 100) * Math.pow(1 - P.aba / 100, 1.3), 0, 1); S.tgt = tgt; S.a = lerp(S.a, tgt, clamp(dt * .9, 0, 1)); S.t += dt;
    for (const w of S.w) { w.u += dt * (tgt - S.a > .01 ? .4 : tgt - S.a < -.01 ? -.4 : .05); if (w.u > 1) w.u -= 1; if (w.u < 0) w.u += 1; }
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#F2F7F2", "#E7F0E6");
    const nar = W < 560; const a = S.a, cx = nar ? W * .5 : W * .33, cy = nar ? H * .3 : H * .5, L = nar ? Math.min(W * .4, 150) : Math.min(W * .29, 200), pore = a * (nar ? 48 : 64); // півширина щілини ~ pore/2
    const draw1 = (sgn) => { // верхня (sgn=-1) або нижня (sgn=+1) замикаюча клітина
      const N = 40, inner = [], outer = [];
      for (let i = 0; i <= N; i++) { const s = i / N, sn = Math.sin(Math.PI * s); inner.push([cx - L + 2 * L * s, cy + sgn * (pore / 2) * Math.pow(sn, .9)]); const th = (34 + 26 * a) * (.55 + .45 * Math.pow(sn, .8)); outer.push([cx - L + 2 * L * s, cy + sgn * (pore / 2 * Math.pow(sn, .9) + th)]); }
      c.beginPath(); inner.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); outer.slice().reverse().forEach(([x, y]) => c.lineTo(x, y)); c.closePath();
      const g = c.createLinearGradient(0, cy - 60, 0, cy + 60); g.addColorStop(0, mixHex("#7FBF74", "#4E9B52", a)); g.addColorStop(1, mixHex("#8BCB7F", "#58A35B", a)); c.fillStyle = g; c.fill();
      c.strokeStyle = "#2E6B35"; c.lineWidth = 2; c.stroke();
      // товста внутрішня стінка
      c.strokeStyle = "#6B4A22"; c.lineWidth = 6; c.beginPath(); inner.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
      c.strokeStyle = "#B59463"; c.lineWidth = 2; c.beginPath(); outer.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
      // хлоропласти
      for (let k = 0; k < 6; k++) { const s = .16 + k * .136, sn = Math.sin(Math.PI * s); const x = cx - L + 2 * L * s, y = cy + sgn * (pore / 2 * Math.pow(sn, .9) + (34 + 26 * a) * .6 * (.55 + .45 * Math.pow(sn, .8))); D.sphere(c, x, y, 5.6, "#2F8F46"); }
      // K+ (нагромадження)
      const nK = Math.round(S.a * 24 + 3);
      for (let k = 0; k < nK; k++) { const q = S.ions[(k + (sgn > 0 ? 15 : 0)) % S.ions.length]; const s = .12 + q.x * .76, sn = Math.sin(Math.PI * s); const x = cx - L + 2 * L * s, y = cy + sgn * (pore / 2 * Math.pow(sn, .9) + (34 + 26 * a) * (.25 + .5 * q.y) * (.55 + .45 * Math.pow(sn, .8))) + Math.sin(S.t * 2 + k) * 1.2; D.sphere(c, x, y, 2.3, "#C98A1B", .95); }
    };
    // фон епідермісу
    c.fillStyle = "#E8F3E1"; D.rr(c, 8, cy - 100, nar ? W - 16 : W * .64 - 8, 200, 14); c.fill();
    c.strokeStyle = "#B7CDB0"; c.lineWidth = 3; for (const [x, y, w, h] of nar ? [[14, cy - 96, 40, 90], [14, cy + 6, 40, 90], [W - 54, cy - 96, 40, 90], [W - 54, cy + 6, 40, 90]] : [[16, cy - 112, 90, 100], [16, cy + 12, 90, 100], [W * .64 - 100, cy - 112, 88, 100], [W * .64 - 100, cy + 12, 88, 100], [W * .33 - 70, cy - 116, 140, 26], [W * .33 - 70, cy + 90, 140, 26]]) { D.rr(c, x, y, w, h, 14); c.stroke(); }
    draw1(-1); draw1(1);
    // щілина
    c.fillStyle = "rgba(30,60,40,.78)"; if (pore > 1) { c.beginPath(); c.ellipse(cx, cy, L * .86, Math.max(.1, pore / 2 * .98), 0, 0, 7); c.fill(); }
    // водяна пара/CO2 через щілину
    if (a > .06) for (const w of S.w) { const yy = cy - 60 + w.u * 120; c.fillStyle = "rgba(120,180,225,.7)"; c.beginPath(); c.arc(cx + (hash01(w.u * 99 | 0, 5) - .5) * pore * .6, yy, 2.2, 0, 7); c.fill(); }
    D.txt(c, "замикаюча клітина", cx - L * .9, cy - 72 - pore * .35, { size: 11, color: C.soft, weight: 700 }); if (pore > 22) D.txt(c, "продихова щілина", cx + L * .5, cy + 1, { size: 10.5, color: "#fff", weight: 700, align: "center" });
    D.tag(c, "товста мало еластична стінка", cx + L * .05, cy - pore * .5 - 1, { size: 10, bg: "#F4E3C6", stroke: "#7A4C1C", color: "#6A3F12" });
    c.fillStyle = "#C98A1B"; c.beginPath(); c.arc(nar ? 16 : W * .66 + 10, nar ? H * .52 : 22, 4, 0, 7); c.fill(); D.txt(c, "K⁺ та інші осмотично активні речовини", nar ? 26 : W * .66 + 20, nar ? H * .52 : 22, { size: 10.5, color: C.soft });
    // права панель: індикатори
    const gx = nar ? 14 : W * .66, gw = W - gx - 14; let y = nar ? H * .58 : 52;
    const bar = (name, v, col, txt) => { D.txt(c, name, gx, y, { size: 11, color: C.soft }); c.fillStyle = "#E4ECE4"; D.rr(c, gx, y + 8, gw, 12, 6); c.fill(); c.fillStyle = col; D.rr(c, gx, y + 8, Math.max(4, gw * v), 12, 6); c.fill(); D.txt(c, txt, gx + gw, y, { size: 11, color: C.ink, weight: 700, align: "right" }); y += nar ? 36 : 42; };
    bar("Тургор замикаючих клітин", S.a, "#2E8BB5", fmt(S.a * 100, 0) + " %"); bar("Розкриття щілини", S.a, "#2F7D4F", fmt(S.a * 12, 1) + " мкм"); bar("Транспірація і вхід CO₂", S.a, "#C98A1B", fmt(.05 + S.a * 1.3, 2) + " відн.");
    const note = S.tgt > .6 ? "продихи відкриті: фотосинтез іде, але вода випаровується" : S.tgt < .15 ? "продихи закриті: вода зберігається, але CO₂ не надходить" : "продихи напіввідкриті — компроміс";
    D.tag(c, note, W / 2, H - 20, { size: 11, bg: "#fff", stroke: C.rule, color: C.soft });
  },
  reads: (S, P) => [["Відкритість продихів (ціль)", fmt((S.tgt || 0) * 100, 0), "%"], ["Фактична щілина", fmt(S.a * 12, 1), "мкм"], ["Дія АБК", P.aba > 50 ? "закриває продихи" : P.aba > 0 ? "частково гальмує" : "немає", ""]],
});

/* ====================== 6. ПОКАЗНИКИ ТРАНСПІРАЦІЇ (калькулятор) ====================== */
reg("w-calc", {
  dom(body) {
    body.innerHTML = `<div class="ph-dom"><div class="ph-chips" id="pc"></div>
    <div class="ph-row"><label>Випарувано рослиною, г<input type="number" id="c-w" value="90" step="1" min="0"></label><label>Площа листків, дм²<input type="number" id="c-a" value="2" step="0.1" min="0.01"></label><label>Час, год<input type="number" id="c-t" value="3" step="0.5" min="0.1"></label>
    <label>Приріст сухої речовини, г<input type="number" id="c-d" value="0.2" step="0.01" min="0.001"></label><label>Випарувано з вільної водної поверхні тієї ж площі, г<input type="number" id="c-f" value="150" step="1" min="1"></label></div>
    <div class="ph-grid" id="c-out"></div><p class="ex-note" style="margin:0">Навчальні приклади — числа підібрано для тренування розрахунків, а не як довідкові значення для культур.</p></div>`;
    const $ = (id) => body.querySelector("#" + id);
    const pre = [["Приклад: помірне водопостачання", { w: 90, a: 2, t: 3, d: .2, f: 150 }], ["Приклад: спека", { w: 240, a: 2, t: 3, d: .22, f: 300 }], ["Приклад: економне водокористування", { w: 40, a: 2, t: 3, d: .16, f: 150 }]];
    const calc = () => {
      const w = +$("c-w").value, a = +$("c-a").value, t = +$("c-t").value, d = +$("c-d").value, f = +$("c-f").value;
      const IT = w / (a * t), TK = w / d, PT = d / (w / 1000), VT = w / f;
      $("c-out").innerHTML = [["Інтенсивність транспірації (ІТ)", fmt(IT, 2), "г/(дм²·год)", "в межах 0,15–1,5 для більшості рослин"], ["Транспіраційний коефіцієнт (ТК)", fmt(TK, 0), "г води на 1 г сухої речовини", "чим менше, тим економніше"], ["Продуктивність транспірації (ПТ)", fmt(PT, 2), "г сухої речовини на 1 кг води", "обернена до ТК · 1000"], ["Відносна транспірація (ВТ)", fmt(VT, 2), "частка від випаровування з води", "вода з рослини / вода з вільної поверхні"]].map(([n, v, u, h]) => `<div class="ph-card"><b>${n}</b><strong>${v}</strong> <small>${u}</small><br><small>${h}</small></div>`).join("");
    };
    const chips = $("pc"); pre.forEach(([n, v], i) => { const b = btn(n, "", () => { $("c-w").value = v.w; $("c-a").value = v.a; $("c-t").value = v.t; $("c-d").value = v.d; $("c-f").value = v.f; calc(); [...chips.children].forEach((x, j) => x.setAttribute("aria-pressed", String(i === j))); }); b.setAttribute("aria-pressed", String(i === 0)); chips.append(b); });
    body.addEventListener("input", calc); calc();
  },
});

/* ====================== 7. ЕКОЛОГІЧНІ ГРУПИ РОСЛИН ЗА ВІДНОШЕННЯМ ДО ВОДИ ====================== */
const ECO = [
  { id: "hyd", n: "Гідатофіти", sub: "повністю занурені", w: .95, root: 0, leaf: .4, cut: 0, ex: ["аеренхіма"], d: "Живуть у товщі води. Листки без кутикули (поглинають воду й гази всією поверхнею), коріння відсутнє або дуже слабке, у тканинах — аеренхіма (паренхіма з великими міжклітинниками для повітря).", em: "ЕЛОДЕЯ, ВОДЯНИЙ МОХ" },
  { id: "aero", n: "Аерогідатофіти", sub: "листки на поверхні води", w: .85, root: .2, leaf: .75, cut: .2, ex: ["аеренхіма"], d: "Листки плавають на поверхні води, продихи — на верхньому боці листка; черешки й стебла з аеренхімою.", em: "КУВШИНКА, ЖОВТА КУБИШКА" },
  { id: "hygr", n: "Гідрофіти", sub: "частково занурені, береги й болота", w: .7, root: .45, leaf: .8, cut: .3, ex: ["аеренхіма"], d: "Нижня частина в воді, верхня — над нею; ростуть по берегах водойм і на болотах; розвинена аеренхіма, відсутня надмірна транспірація.", em: "ТРОСТИНА, РОГІЗ" },
  { id: "hig", n: "Гігрофіти", sub: "вологі ґрунти й вологе повітря", w: .55, root: .5, leaf: .9, cut: .25, ex: ["тонка кутикула"], d: "Наземні рослини з надлишком вологи в ґрунті та повітрі: великі тонкі листки, слабка кутикула, продихи часто відкриті — легко в'януть при зниженні вологості.", em: "КАЛЮЖНИЦЯ, МІСЯЧНИК" },
  { id: "mez", n: "Мезофіти", sub: "помірне зволоження", w: .4, root: .65, leaf: .8, cut: .5, ex: [], d: "Більшість культурних рослин середньої смуги. Здатні регулювати транспірацію закриванням продихів, мають помірно розвинену кутикулу й кореневу систему.", em: "ПШЕНИЦЯ, ЯБЛУНЯ" },
  { id: "succ", n: "Ксерофіти-сукуленти", sub: "запасають воду", w: .15, root: .35, leaf: .5, cut: .85, ex: ["водозапасаюча тканина"], d: "Соковиті стебла або листки з водозапасаючою паренхімою; товста кутикула, мало продихів, поверхневе широке коріння, що швидко ловить дощ.", em: "АЛОЕ, КАКТУСИ, ОЧИТОК" },
  { id: "scl", n: "Ксерофіти-склерофіти", sub: "зменшують втрати води", w: .1, root: .95, leaf: .3, cut: .95, ex: ["опушення", "дрібні листки"], d: "Без водозапасаючої тканини; дрібні жорсткі листки, часто з опушенням і товстою кутикулою, глибоке коріння. Транспірація зведена до мінімуму.", em: "КОВИЛЬ, ПОЛИН" },
  { id: "eph", n: "Ефемери й ефемероїди", sub: "уникають посухи", w: .25, root: .3, leaf: .6, cut: .3, ex: ["короткий цикл"], d: "Вегетують лише ранньою весною або восени, коли є волога. Ефемери — однорічники (швидко дозрівають плоди), ефемероїди — багаторічники зі спокоєм у вигляді цибулин, бульб, кореневищ.", em: "ВЕРОНІКА ВЕСНЯНА, ТЮЛЬПАН" },
];
function ecoSvg(g) {
  const W = 360, H = 230, soil = 140, wl = H - g.w * 120; const root = g.root * 74, leaf = 18 + g.leaf * 34;
  const aq = g.id === "hyd" || g.id === "aero" || g.id === "hygr";
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${g.n}"><defs><linearGradient id="gs${g.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8B6A47"/><stop offset="1" stop-color="#5D4630"/></linearGradient><linearGradient id="gw${g.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED0F0" stop-opacity=".85"/><stop offset="1" stop-color="#4E94CC" stop-opacity=".9"/></linearGradient></defs>`;
  s += `<rect width="${W}" height="${H}" rx="12" fill="#EAF4FA"/>`;
  if (aq) { const top = g.id === "hyd" ? 26 : g.id === "aero" ? 100 : 128; s += `<rect y="${H - 90}" width="${W}" height="90" fill="url(#gs${g.id})"/><rect y="${top}" width="${W}" height="${H - 90 - top + 2}" fill="url(#gw${g.id})"/>`; }
  else s += `<rect y="${soil}" width="${W}" height="${H - soil}" fill="url(#gs${g.id})"/><rect y="${soil}" width="${W}" height="${(H - soil) * g.w * 1.8}" fill="#6FA4D4" opacity="${.15 + g.w * .5}"/>`;
  const px = 180, gy = aq ? H - 90 : soil;
  // коріння
  if (g.root > 0) { s += `<path d="M${px} ${gy} V${gy + root * .8} M${px} ${gy + 8} q-${root * .8} ${root * .3} -${root * .9} ${root * .7} M${px} ${gy + 14} q${root * .8} ${root * .3} ${root} ${root * .6} M${px} ${gy + 6} q-${root * .4} ${root * .4} -${root * .3} ${root}" stroke="#EADFC2" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; }
  // стебло і листки
  const top = g.id === "hyd" ? 60 : g.id === "aero" ? 96 : aq ? 40 : g.id === "succ" ? 60 : 36;
  if (g.id === "succ") s += `<rect x="${px - 34}" y="${top}" width="68" height="${gy - top}" rx="30" fill="#7FB87A" stroke="#3F7D45" stroke-width="2"/>` + [-18, 0, 18].map(x => `<path d="M${px + x} ${top + 10} V${gy - 6}" stroke="#4C8F52" stroke-width="1.6" opacity=".6"/>`).join("") + `<g stroke="#2E5B31" stroke-width="1.4">${[-22, 8, 26, -8].map((x, i) => `<path d="M${px + x} ${top + 28 + i * 14} l${x < 0 ? -6 : 6} -4"/>`).join("")}</g>`;
  else if (g.id === "aero") s += `<path d="M${px} ${gy} V${top + 6}" stroke="#4D8C4F" stroke-width="3"/><ellipse cx="${px}" cy="${top}" rx="${leaf * 1.8}" ry="${leaf * .45}" fill="#6BB765" stroke="#3F7D45"/><ellipse cx="${px - 90}" cy="${top + 2}" rx="${leaf * 1.2}" ry="${leaf * .32}" fill="#6BB765" stroke="#3F7D45"/><ellipse cx="${px + 98}" cy="${top + 2}" rx="${leaf * 1.2}" ry="${leaf * .32}" fill="#6BB765" stroke="#3F7D45"/>`;
  else if (g.id === "hyd") s += `<path d="M${px} ${gy} C${px - 10} ${gy - 40} ${px + 10} ${top + 40} ${px} ${top}" stroke="#4D8C4F" stroke-width="3" fill="none"/>` + [0, 1, 2, 3, 4].map(i => `<path d="M${px - 2 + (i % 2 ? 8 : -8)} ${top + 14 + i * 20} l${i % 2 ? 40 : -40} -8" stroke="#6BB765" stroke-width="3" stroke-linecap="round"/>`).join("");
  else {
    s += `<path d="M${px} ${gy} V${top + 14}" stroke="#4D8C4F" stroke-width="${g.id === "scl" ? 2 : 3.4}"/>`;
    const nL = g.id === "scl" ? 9 : 5, ln = g.id === "scl" ? 22 : leaf * 1.2;
    for (let i = 0; i < nL; i++) { const side = i % 2 ? 1 : -1, y = top + 16 + i * ((gy - top - 34) / nL); s += `<path d="M${px} ${y} q${side * ln * .5} ${-ln * .36} ${side * ln} 0 q${-side * ln * .5} ${ln * .28} ${-side * ln} 0z" fill="${g.id === "scl" ? "#8FAA7A" : "#6BB765"}" stroke="#3F7D45" stroke-width="1.2"/>`; if (g.id === "scl") s += `<path d="M${px} ${y} l${side * ln} 0" stroke="#EEF2E6" stroke-width="1" opacity=".8"/>`; }
  }
  if (g.cut > .5) s += `<text x="${W - 12}" y="22" text-anchor="end" font-size="11" font-weight="700" fill="#6A3F12">товста кутикула</text>`;
  if (g.ex.includes("аеренхіма")) s += `<g fill="#fff" opacity=".85">${[0, 1, 2, 3].map(i => `<circle cx="${px - 3 + (i % 2) * 6}" cy="${gy - 14 - i * 12}" r="2.4"/>`).join("")}</g><text x="12" y="22" font-size="11" font-weight="700" fill="#245B7D">аеренхіма (повітряні ходи)</text>`;
  s += `<text x="12" y="${H - 10}" font-size="11" font-weight="700" fill="#fff">${g.sub}</text></svg>`;
  return s;
}
reg("w-eco", {
  dom(body) {
    body.innerHTML = `<div class="ph-dom"><div class="ph-chips" id="ec"></div><div class="ph-panel" style="display:grid;gap:12px;grid-template-columns:minmax(220px,1fr) minmax(220px,1fr);align-items:center"><div id="e-svg"></div><div id="e-txt"></div></div></div>`;
    const chips = body.querySelector("#ec"); const show = (i) => { const g = ECO[i]; body.querySelector("#e-svg").innerHTML = ecoSvg(g); body.querySelector("#e-txt").innerHTML = `<h4>${g.n}</h4><p style="margin:0 0 8px"><b>${g.sub}</b></p><p style="margin:0 0 8px">${g.d}</p><p style="margin:0"><small>Приклади: ${g.em ? g.em.split(", ").map(x => x[0] + x.slice(1).toLowerCase()).join(", ") : "—"}</small></p>`; [...chips.children].forEach((x, j) => x.setAttribute("aria-pressed", String(i === j))); };
    ECO.forEach((g, i) => chips.append(btn(g.n, "", () => show(i)))); show(4);
    const st = document.createElement("style"); st.textContent = "@media(max-width:640px){.ph-panel{grid-template-columns:1fr!important}}"; body.append(st);
  },
});
