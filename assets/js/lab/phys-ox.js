/* Конспект «Резистентність рослин та окисний стрес»: драбина відновлення кисню й баланс АФК; ланцюгове перекисне окиснення ліпідів.
   Якісні моделі за матеріалом посібника (числа умовні). */
import { reg, D, C, fmt, clamp, lerp, smooth, rng, mixHex, alpha, hash01, btn } from "./extr-core.js";
const wrap = (c, text, x, y, maxW, lh, o = {}) => { c.font = `${o.weight || 600} ${o.size || 11}px Inter, system-ui, sans-serif`; const ws = text.split(" "); let line = "", yy = y; for (const w of ws) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { D.txt(c, line, x, yy, o); line = w; yy += lh; } else line = t; } if (line) D.txt(c, line, x, yy, o); return yy; };

/* ====================== 1. ДРАБИНА АФК ТА ПРООКСИДАНТНО-АНТИОКСИДАНТНИЙ БАЛАНС ====================== */
function ros(P) {
  const Pp = P.prod / 100, sod = P.sod / 100, cat = P.cat / 100, fe = P.fe / 100;
  const dis = Pp * (sod / (sod + .15));              // потік дисмутації
  const O2 = Pp * (.15 / (sod + .15));               // супероксид, що лишився
  const H2O2 = (dis + .08 * Pp) / (.18 + 1.6 * cat);
  const OH = fe * .55 * H2O2 + .05 * O2 * H2O2;      // Фентон + Габер–Вайс
  const damage = clamp(OH * 3.2 + O2 * .5 + H2O2 * .15, 0, 1.6);
  const fate = damage < .12 ? "ros-sig" : damage < .35 ? "adapt" : damage < .7 ? "repair" : damage < 1.05 ? "apo" : "necro";
  return { O2, H2O2, OH, damage, fate };
}
const FATE = { "ros-sig": ["Нормальна сигнальна дія АФК", "#2F7D4F"], adapt: ["Адаптивна відповідь", "#6B9E3A"], repair: ["Пошкодження; клітина може відновитися", "#C98A1B"], apo: ["Запускається апоптоз", "#C0612B"], necro: ["Некроз: патологічна загибель", "#C0392B"] };
reg("o-ros", {
  aspect: (w) => (w < 560 ? 0.9 : 2.1),
  params: [
    { k: "prod", label: "Утворення супероксиду (стрес: світло, метали, УФ…)", min: 0, max: 100, step: 5, v: 40, u: "%" },
    { k: "sod", label: "Супероксиддисмутаза (СОД)", min: 0, max: 100, step: 5, v: 60, u: "%" },
    { k: "cat", label: "Каталаза / пероксидази (розклад H₂O₂)", min: 0, max: 100, step: 5, v: 60, u: "%" },
    { k: "fe", label: "Вільні іони заліза Fe²⁺ (реакція Фентона)", min: 0, max: 100, step: 5, v: 30, u: "%" },
  ],
  presets: [{ label: "Норма", set: { prod: 20, sod: 70, cat: 70, fe: 10 } }, { label: "Сильний стрес", set: { prod: 80, sod: 60, cat: 60, fe: 40 } }, { label: "Слабкий захист", set: { prod: 60, sod: 15, cat: 15, fe: 50 } }, { label: "Стрес + багато заліза", set: { prod: 70, sod: 70, cat: 70, fe: 100 } }], presetsLabel: "Сценарії",
  info: "Молекулярний кисень відновлюється до води чотирма електронами. Якщо електрони приєднуються <b>по одному</b>, виникають проміжні <b>активні форми кисню</b>: супероксид O₂•⁻ → пероксид водню H₂O₂ → гідроксильний радикал •OH → вода. <b>СОД</b> перетворює супероксид на H₂O₂, <b>каталаза</b> й пероксидази розкладають H₂O₂ до води. Але H₂O₂ у присутності <b>Fe²⁺</b> дає найагресивніший радикал •OH (<b>реакція Фентона</b>). Порушення рівноваги між утворенням АФК і антиоксидантним захистом — основа <b>окисного стресу</b>.",
  init() { return { t: 0 }; }, step(S, P, dt) { S.t += dt; },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#F6F5F0", "#EAEBE3"); const nar = W < 560; const R = ros(P);
    // драбина
    const steps = [["O₂", "кисень", 0, "#8FA8B8", "—"], ["O₂•⁻", "супероксид", R.O2, "#C98A1B", "10⁻⁶ с"], ["H₂O₂", nar ? "пероксид" : "пероксид водню", R.H2O2, "#5C8FB0", "10⁻² с"], ["•OH", nar ? "гідроксил" : "гідроксил-радикал", R.OH, "#C0392B", "10⁻⁹ с"], ["H₂O", "вода", 0, "#7FB0D4", "—"]];
    const x0 = nar ? 20 : 30, x1 = nar ? W - 20 : W * .56, y0 = nar ? 74 : 90, dx = (x1 - x0) / 4;
    steps.forEach(([f, n, v, col, life], i) => {
      const x = x0 + i * dx, r = i === 0 || i === 4 ? 18 : 14 + clamp(v, 0, 1.2) * 34; D.glow(c, x, y0, r * 1.8, col, .35); D.sphere(c, x, y0, r, col);
      D.txt(c, f, x, y0, { size: nar ? 11 : 13, weight: 800, align: "center", color: "#fff" }); D.txt(c, n, x, y0 + r + 14, { size: 10, align: "center", color: C.soft }); if (life !== "—") D.txt(c, `життя ≈ ${life}`, x, y0 + r + 28, { size: 9.5, align: "center", color: C.muted });
      if (i < 4) { D.arrow(c, x + r + 4, y0, x + dx - (i + 1 === 4 ? 18 : 14 + clamp([R.O2, R.H2O2, R.OH][i], 0, 1.2) * 34) - 8, y0, "#6B7A70", 2, 7); D.txt(c, i === 0 ? "+ e⁻" : i === 1 ? "СОД, +2H⁺" : i === 2 ? "Fe²⁺ (Фентон)" : "+ e⁻, H⁺", x + dx / 2, y0 - 26, { size: 9.5, align: "center", color: i === 2 ? "#C0392B" : "#3F5247", weight: 700 }); }
    });
    D.txt(c, "каталаза / пероксидази: H₂O₂ → H₂O + ½O₂", x0 + dx * 2, y0 + 78, { size: 10.5, align: "center", color: "#1F6E8F", weight: 700 });
    D.arrow(c, x0 + dx * 2, y0 + 60, x0 + dx * 2, y0 + 70, "#1F6E8F", 2, 6);
    // шкали
    const by = nar ? y0 + 118 : y0 + 120; const gx = nar ? 20 : 30, gw = nar ? W - 40 : W * .56 - 30;
    const bar = (i, n, v, col) => { const yy = by + i * 38; D.txt(c, n, gx, yy, { size: 11, color: C.soft }); c.fillStyle = "#E4E8DE"; D.rr(c, gx, yy + 8, gw, 14, 7); c.fill(); c.fillStyle = col; D.rr(c, gx, yy + 8, Math.max(5, gw * clamp(v / 1.1, 0, 1)), 14, 7); c.fill(); };
    bar(0, "Супероксид O₂•⁻", R.O2, "#C98A1B"); bar(1, "Пероксид водню H₂O₂", R.H2O2, "#5C8FB0"); bar(2, "Гідроксил-радикал •OH (найтоксичніший)", R.OH, "#C0392B");
    // доля клітини
    const fx = nar ? 20 : W * .62, fw = nar ? W - 40 : W * .34, fy = nar ? by + 124 : 50;
    D.txt(c, "Пошкодження клітини", fx, fy, { size: 12, weight: 800 }); const g = c.createLinearGradient(fx, 0, fx + fw, 0); g.addColorStop(0, "#2F7D4F"); g.addColorStop(.35, "#C9B53A"); g.addColorStop(.7, "#E08A3A"); g.addColorStop(1, "#C0392B"); c.fillStyle = g; D.rr(c, fx, fy + 14, fw, 18, 9); c.fill();
    const mx = fx + fw * clamp(R.damage / 1.3, 0, 1); c.fillStyle = "#16221A"; c.beginPath(); c.moveTo(mx, fy + 38); c.lineTo(mx - 7, fy + 50); c.lineTo(mx + 7, fy + 50); c.closePath(); c.fill();
    const [ft, fc] = FATE[R.fate]; D.tag(c, ft, fx + fw / 2, fy + 72, { size: 11.5, bg: "#fff", stroke: fc, color: fc });
    wrap(c, R.fate === "ros-sig" ? "У малих кількостях АФК регулюють ріст, диференціацію й відповідь на стреси." : R.fate === "adapt" ? "Помірне підвищення АФК запускає адаптаційні програми." : R.fate === "repair" ? "Пероксидне окиснення ліпідів і пошкодження ДНК, але клітина ще може відновитися." : R.fate === "apo" ? "Пошкоджені клітини вибірково видаляються програмою загибелі." : "Руйнування мембран, невпорядкована деградація ДНК, вихід ферментів.", fx, fy + 98, fw, 15, { size: 11, color: C.soft, weight: 500 });
  },
  reads: (S, P) => { const R = ros(P); return [["O₂•⁻ / H₂O₂ / •OH (відн.)", `${fmt(R.O2, 2)} / ${fmt(R.H2O2, 2)} / ${fmt(R.OH, 2)}`, ""], ["Індекс пошкодження", fmt(R.damage, 2), ""], ["Доля клітини", FATE[R.fate][0], ""]]; },
});

/* ====================== 2. ЛАНЦЮГОВЕ ПЕРЕКИСНЕ ОКИСНЕННЯ ЛІПІДІВ ====================== */
// стани: 0 — нормальний ліпід LH; 1 — L•; 2 — LOO•; 3 — LOOH (пероксид)
reg("o-lpo", {
  aspect: (w) => (w < 560 ? 0.95 : 2.0),
  params: [{ k: "oh", label: "Потік гідроксил-радикалів (ініціація)", min: 0, max: 100, step: 5, v: 20, u: "%" }, { k: "vit", label: "Токофероли (жиророзчинний антиоксидант)", min: 0, max: 100, step: 5, v: 20, u: "%" }],
  toggles: [{ k: "fe", label: "Є Fe²⁺: розгалуження ланцюгів (Fe²⁺ + LOOH → OH⁻ + LO•)", v: false }, { k: "o2", label: "O₂ присутній", v: true }],
  buttons: [{ label: "⚡ Один удар ·OH", pri: true, run: (S) => { const i = S.cells.findIndex(c => c === 0); const idx = Math.floor(Math.random() * S.cells.length); if (S.cells[idx] === 0) S.cells[idx] = 1; } }, { label: "↺ Нова мембрана", run: (S) => { S.cells.fill(0); } }],
  info: "<b>Пероксидне окиснення ліпідів (ПОЛ)</b> — ланцюгова реакція: (1) <b>ініціація</b>: •OH відриває атом H від ненасиченої жирної кислоти (LH): •OH + LH → H₂O + L•; (2) <b>продовження</b>: L• + O₂ → LOO•, а LOO• + LH → LOOH + L• — реакції чергуються й самопідтримуються; (3) <b>розгалуження</b>: Fe²⁺ + LOOH → Fe³⁺ + OH⁻ + LO•; (4) <b>обрив</b>: антиоксидант (токоферол) віддає атом H радикалу LOO•, і ланцюг припиняється. Продукти — гідропероксиди й ненасичені альдегіди (гено- і цитотоксичні); мембрана стає проникною.",
  init() { const r = rng(2); return { cells: new Array(48).fill(0), timer: new Array(48).fill(0), t: 0, leak: [] }; },
  step(S, P, dt) {
    const n = S.cells.length, W = 24; S.t += dt;
    const nb = (i) => { const row = i < W ? 0 : 1, col = i % W; const o = []; if (col > 0) o.push(i - 1); if (col < W - 1) o.push(i + 1); o.push(row ? i - W : i + W); return o; };
    // ініціація
    if (Math.random() < P.oh / 100 * 1.6 * dt) { const i = Math.floor(Math.random() * n); if (S.cells[i] === 0) S.cells[i] = 1; }
    const next = S.cells.slice();
    for (let i = 0; i < n; i++) {
      const st = S.cells[i]; if (st === 1) { S.timer[i] += dt; if (P.o2 && S.timer[i] > .35) { next[i] = 2; S.timer[i] = 0; } }
      else if (st === 2) { // LOO•: квенчинг або атака сусіда
        const q = P.vit / 100 * 2.2 * dt, a = 2.6 * dt; if (Math.random() < q) { next[i] = 3; } else if (Math.random() < a) { const ns = nb(i).filter(j => S.cells[j] === 0); if (ns.length) { next[ns[Math.floor(Math.random() * ns.length)]] = 1; next[i] = 3; } }
      } else if (st === 3 && P.fe) { if (Math.random() < .12 * dt) { const ns = nb(i).filter(j => S.cells[j] === 0); if (ns.length) next[ns[Math.floor(Math.random() * ns.length)]] = 1; } }
    }
    for (let i = 0; i < n; i++) if (next[i] === 1 && S.cells[i] === 0) S.timer[i] = 0; S.cells = next;
    S.dmg = S.cells.filter(x => x === 3).length / n; S.rad = S.cells.filter(x => x === 1 || x === 2).length / n;
    if (S.dmg > .25 && Math.random() < S.dmg * 3 * dt) S.leak.push({ x: Math.random(), u: 0 }); S.leak = S.leak.filter(l => (l.u += dt * .8) < 1);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#F6F4EE", "#E9E6DC"); const nar = W < 560; const Wd = 24, gx = nar ? 12 : 26, gw = (nar ? W - 24 : W * .6), cw = gw / Wd, gy = nar ? 44 : 60, tail = clamp((H - gy - (nar ? 190 : 100)) / 2, 30, 78);
    D.txt(c, "Ліпідний бішар мембрани (вигляд збоку)", gx, 20, { size: 12, weight: 800 });
    D.txt(c, "зовні клітини", gx, gy - 12, { size: 10, color: C.muted }); D.txt(c, "цитоплазма", gx, gy + 2 * tail + 32, { size: 10, color: C.muted });
    const col = ["#7FBF63", "#E8A33B", "#D2402F", "#4B3A5E"]; const names = ["ліпід LH", "радикал L•", "радикал LOO•", "пероксид LOOH"];
    for (let i = 0; i < 48; i++) { const row = i < Wd ? 0 : 1, k = i % Wd, x = gx + (k + .5) * cw, st = S.cells[i], cc = col[st]; const yh = row ? gy + 2 * tail + 12 : gy + 6, dir = row ? -1 : 1;
      c.fillStyle = cc; c.beginPath(); c.arc(x, yh, cw * .38, 0, 7); c.fill(); c.strokeStyle = cc; c.lineWidth = Math.max(2, cw * .22); c.lineCap = "round";
      c.beginPath(); c.moveTo(x - cw * .15, yh + dir * cw * .35); c.lineTo(x - cw * .15, yh + dir * tail); c.moveTo(x + cw * .15, yh + dir * cw * .35); c.lineTo(x + cw * .15, yh + dir * tail * (st === 3 ? .7 : 1)); c.stroke();
      if (st === 1 || st === 2) { D.glow(c, x, yh + dir * tail * .5, cw * .9, cc, .45); }
    }
    // витік іонів
    for (const l of S.leak) { const x = gx + l.x * gw; c.fillStyle = `rgba(60,120,190,${1 - l.u})`; c.beginPath(); c.arc(x, gy + 2 * tail * l.u + 10, 3, 0, 7); c.fill(); }
    // легенда
    const lx = nar ? 12 : gx, ly = gy + 2 * tail + 56; names.forEach((n, i) => { const xx = lx + (nar ? (i % 2) * (W / 2 - 10) : i * (gw / 4)), yy = ly + (nar ? Math.floor(i / 2) * 20 : 0); c.fillStyle = col[i]; c.beginPath(); c.arc(xx + 6, yy, 6, 0, 7); c.fill(); D.txt(c, n, xx + 16, yy, { size: 10, color: C.soft }); });
    // права панель
    const px = nar ? 14 : W * .68, pw = nar ? W - 28 : W * .29; let y = nar ? ly + (nar ? 52 : 0) : 60;
    const bar = (n, v, cc, tx) => { D.txt(c, n, px, y, { size: 11, color: C.soft }); c.fillStyle = "#E4E8DE"; D.rr(c, px, y + 8, pw, 13, 6); c.fill(); c.fillStyle = cc; D.rr(c, px, y + 8, Math.max(4, pw * clamp(v, 0, 1)), 13, 6); c.fill(); D.txt(c, tx, px + pw, y, { size: 11, align: "right", weight: 700 }); y += 40; };
    bar("Радикали (L•, LOO•)", clamp((S.rad || 0) * 2, 0, 1), "#E8A33B", fmt((S.rad || 0) * 100, 0) + " %"); bar("Пероксиди LOOH", clamp((S.dmg || 0) * 1.5, 0, 1), "#4B3A5E", fmt((S.dmg || 0) * 100, 0) + " %"); bar("Проникність мембрани (витік)", clamp((S.dmg || 0) * 1.6, 0, 1), "#3C78BE", fmt(clamp((S.dmg || 0) * 160, 0, 100), 0) + " %");
    if (!nar) wrap(c, (S.dmg || 0) > .5 ? "Мембрана «розсипається»: іони й метаболіти витікають, клітина гине." : (S.rad || 0) > .08 ? "Ланцюг розвивається: кожен радикал породжує наступний." : P.vit > 60 ? "Антиоксидант швидко обриває ланцюги." : "Натисніть «Один удар ·OH» або збільшіть потік радикалів.", px, y + 6, pw, 15, { size: 11, color: C.soft, weight: 500 });
  },
  reads: (S, P) => [["Радикалів у мембрані", fmt((S.rad || 0) * 100, 0), "%"], ["Окиснених ліпідів (LOOH)", fmt((S.dmg || 0) * 100, 0), "%"], ["Обрив ланцюга", P.vit > 50 ? "ефективний (токоферол)" : "слабкий", ""]],
});

/* ====================== 3. ДОЛЯ КЛІТИНИ: АПОПТОЗ І НЕКРОЗ ====================== */
reg("o-fate", {
  aspect: (w) => (w < 560 ? 1.0 : 2.0),
  modes: [["apo", "Апоптоз (програмована загибель)"], ["nec", "Некроз (патологічна загибель)"]],
  params: [{ k: "p", label: "Час після ураження", min: 0, max: 100, step: 1, v: 0, u: "%" }],
  buttons: [{ label: "▶ Показати процес", pri: true, run: (S, P, sim) => { sim.P.p = 0; sim.sl.p.inp.value = 0; sim.sl.p.show(); S.play = true; } }],
  info: "<b>Апоптоз</b> — запрограмована загибель: клітина зменшується, хроматин конденсується, ДНК розрізається на упорядковані фрагменти (в цьому беруть участь Ca²⁺-залежні ендонуклеази), а залишки впаковуються в апоптотичні тільця без «пожежі» в оточенні. <b>Некроз</b> — непрограмована патологічна загибель груп клітин: органели набухають, мембрани розриваються, ДНК деградує невпорядковано, ферменти вивільняються в позаклітинне середовище.",
  init() { return { play: false }; },
  step(S, P, dt, sim) { if (S.play) { P.p = Math.min(100, P.p + dt * 14); sim.sl.p.inp.value = P.p; sim.sl.p.show(); if (P.p >= 100) S.play = false; } },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, "#F7F5F0", "#EBE8DF"); const nar = W < 560; const p = P.p / 100, apo = P.mode === "apo";
    const cx = nar ? W / 2 : W * .29, cy = nar ? H * .32 : H * .52, R0 = Math.min(nar ? W * .12 : W * .07, H * (nar ? .085 : .15));
    // сусідні клітини
    const nb = [[-2.3, -.2], [2.3, .1], [-1.1, 1.9], [1.2, -1.9], [-1.2, -1.9], [1.2, 1.9]];
    nb.forEach(([dx, dy], i) => { const x = cx + dx * R0 * .95, y = cy + dy * R0 * .95; c.fillStyle = "rgba(180,215,170,.55)"; c.strokeStyle = "#6B9E3A"; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, R0 * .8, 0, 7); c.fill(); c.stroke(); c.fillStyle = "rgba(60,110,60,.5)"; c.beginPath(); c.arc(x, y, R0 * .22, 0, 7); c.fill(); if (!apo && p > .6) { c.fillStyle = `rgba(200,80,60,${(p - .6) * .5})`; c.beginPath(); c.arc(x, y, R0 * .8, 0, 7); c.fill(); } });
    let r, wob = 0;
    if (apo) r = R0 * (1 - .45 * smooth(clamp(p / .6, 0, 1))); else r = R0 * (1 + .45 * smooth(clamp(p / .7, 0, 1)));
    // клітина
    c.save(); c.fillStyle = apo ? "#B9D99B" : "#E9C79B"; c.strokeStyle = apo ? "#4F8A2F" : "#B5651D"; c.lineWidth = 2.5;
    if (apo && p > .35) { // пухирчастість (blebbing) і тільця
      const k = clamp((p - .35) / .4, 0, 1), n = 7; c.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, bump = 1 + .16 * k * Math.sin(a * n + t * 2); const x = cx + Math.cos(a) * r * bump, y = cy + Math.sin(a) * r * bump; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); c.fill(); c.stroke();
    } else if (!apo && p > .72) { // розрив мембрани
      const k = clamp((p - .72) / .28, 0, 1); c.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, bump = 1 + .1 * k * Math.sin(a * 5 + 1) + .12 * k * hash01(i); const x = cx + Math.cos(a) * r * bump, y = cy + Math.sin(a) * r * bump; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); c.fillStyle = `rgba(233,199,155,${1 - .5 * k})`; c.fill(); c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
    } else { c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.stroke(); }
    c.restore();
    // ядро та органели
    if (apo) { const nr = r * .4 * (1 - .3 * smooth(clamp(p / .5, 0, 1))); c.fillStyle = p > .3 ? "#3B2F4E" : "#7B5EA7"; c.beginPath(); c.arc(cx, cy, nr, 0, 7); c.fill();
      if (p > .5) { const k = clamp((p - .5) / .4, 0, 1); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + .5, d = r * (.35 + .75 * k); c.fillStyle = "#8EB56F"; c.strokeStyle = "#4F8A2F"; c.lineWidth = 1.5; c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * .16 * (1 - .2 * k), 0, 7); c.fill(); c.stroke(); c.fillStyle = "#3B2F4E"; c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * .06, 0, 7); c.fill(); } }
    } else { const nr = r * .38 * (1 + .25 * p); c.fillStyle = p > .5 ? "rgba(123,94,167,.55)" : "#7B5EA7"; c.beginPath(); c.arc(cx, cy, nr, 0, 7); c.fill();
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .3, d = r * .62, orr = r * .1 * (1 + .9 * p); c.fillStyle = "#D98B3A"; c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, orr, 0, 7); c.fill(); c.strokeStyle = "#8A4A12"; c.lineWidth = 1; c.stroke(); }
      if (p > .72) { const k = clamp((p - .72) / .28, 0, 1); for (let i = 0; i < 14; i++) { const a = hash01(i) * 6.28, d = r * (1 + k * (.3 + .7 * hash01(i, 3))); c.fillStyle = alpha("#C0392B", .6 * (1 - .3 * k)); c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3.5, 0, 7); c.fill(); } D.tag(c, "вихід ферментів → запалення", cx, cy + r * 1.55, { size: 10.5, color: "#8A3010", stroke: "#C0392B" }); }
    }
    // таблиця порівняння
    const tx = nar ? 14 : W * .56, tw = nar ? W - 28 : W * .41; let y = nar ? H * .66 : 36;
    D.txt(c, "Ознаки", tx, y, { size: 12, weight: 800 }); D.txt(c, apo ? "Апоптоз" : "Некроз", tx + tw, y, { size: 12, weight: 800, align: "right", color: apo ? "#2F7D4F" : "#B5651D" }); y += 14;
    const rows = apo ? [["Тип загибелі", "програмована"], ["Об'єм клітини", "зменшується"], ["Мембрана", "цілісна, пухирі"], ["ДНК", "упорядковано розрізана"], ["Оточення", "без запалення"]] : [["Тип загибелі", "патологічна"], ["Об'єм клітини", "набухає"], ["Мембрана", "розривається"], ["ДНК", "хаотична деградація"], ["Оточення", "ексудативне запалення"]];
    const rh = nar ? 17 : 26; rows.forEach(([a, b], i) => { y += rh; c.fillStyle = i % 2 ? "rgba(0,0,0,.03)" : "rgba(0,0,0,0)"; c.fillRect(tx - 4, y - rh / 2, tw + 8, rh); D.txt(c, a, tx, y, { size: nar ? 10.5 : 11.5, color: C.soft, weight: 500 }); D.txt(c, b, tx + tw, y, { size: nar ? 10.5 : 11.5, align: "right" }); });
    D.txt(c, p < .05 ? "здорова клітина" : p < .6 ? "ураження наростає…" : "кінцева стадія", cx, nar ? 16 : 18, { size: 11, align: "center", color: C.muted });
  },
  reads: (S, P) => [["Тип загибелі", P.mode === "apo" ? "апоптоз" : "некроз", ""], ["Стадія процесу", fmt(P.p, 0), "%"]],
});
