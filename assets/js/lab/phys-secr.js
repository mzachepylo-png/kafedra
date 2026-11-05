/* Конспект «Фізіологія виділення речовин»: типи секреції, видільні структури, формування вмістилищ, сольові залози.
   Якісні моделі за матеріалом посібника. */
import { reg, D, C, fmt, clamp, lerp, smooth, rng, mixHex, alpha, hash01, btn } from "./extr-core.js";
/* кегль, за якого плашка з текстом вміщується в maxW */
const fitSz = (c, s, maxW, size) => { c.font = `700 ${size}px Inter, system-ui, sans-serif`; const w = c.measureText(s).width + 14; return w > maxW ? Math.max(7.5, size * maxW / w) : size; };
const wrap = (c, text, x, y, maxW, lh, o = {}) => { c.font = `${o.weight || 600} ${o.size || 11}px Inter, system-ui, sans-serif`; const ws = text.split(" "); let line = "", yy = y; for (const w of ws) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { D.txt(c, line, x, yy, o); line = w; yy += lh; } else line = t; } if (line) D.txt(c, line, x, yy, o); return yy; };
const IMG = "../../../assets/img/phys/";

/* ====================== 1. ТИПИ СЕКРЕЦІЇ ====================== */
const SEC = {
  ecc: { n: "Мерокринова: еккринова (через мембрану)", d: "Окремі молекули й іони переносяться через мембрану білками-переносниками чи іонними помпами. Клітина лишається цілою." },
  gra: { n: "Мерокринова: гранулокринова (везикули)", d: "Секрет пакується в міхурці (везикули) в апараті Гольджі, які зливаються з плазмалемою й виділяють вміст назовні, або передають його у вакуолю. Клітина лишається цілою." },
  apo: { n: "Апокринова", d: "Разом із секретом відокремлюється частина цитоплазми — наприклад, голівки сольових волосків галофітів. Клітина відновлюється." },
  hol: { n: "Голокринова", d: "Уся клітина перетворюється на секрет — наприклад, слиз кореневого чохлика." },
};
reg("e-secr", {
  aspect: (w) => (w < 560 ? 1.0 : 1.9),
  modes: [["ecc", "Еккринова"], ["gra", "Гранулокринова"], ["apo", "Апокринова"], ["hol", "Голокринова"]],
  info: "<b>Секреція</b> — активне виведення речовин із витратою енергії (на відміну від <b>екскреції</b> — пасивного виділення за градієнтом концентрації). У рослин є три типи секреції: <b>мерокринова</b> (з двома різновидами — еккринова й гранулокринова), <b>апокринова</b> і <b>голокринова</b>. Перемикайте тип — спостерігайте, що відбувається з клітиною.",
  init() { return { t: 0 }; },
  step(S, P, dt) { S.t += dt; },
  draw(c, S, P, W, H) {
    D.bg(c, W, H, "#F3F6F0", "#E7EEE3"); const nar = W < 560; const mode = P.mode; const T = 7, u = (S.t % T) / T;
    const cx = nar ? W * .4 : W * .3, cy = nar ? H * .36 : H * .5, rw = nar ? 90 : 120, rh = nar ? 62 : 82;
    // середовище праворуч
    c.fillStyle = "#EAF2F6"; c.fillRect(cx + rw * .95, 0, W, nar ? H * .72 : H); D.txt(c, "зовнішнє середовище", W - 12, 20, { size: 10.5, align: "right", color: C.muted });
    const cellPath = (ax = 0, ay = 0, sc = 1) => { D.rr(c, cx - rw * sc, cy - rh * sc, rw * 2 * sc, rh * 2 * sc, 36 * sc); };
    const dot = (x, y, r = 3, col = "#C98A1B", a = 1) => { c.globalAlpha = a; D.sphere(c, x, y, r, col); c.globalAlpha = 1; };
    let msg = "";
    if (mode === "ecc") {
      cellPath(); c.fillStyle = "#CFE7B8"; c.fill(); c.strokeStyle = "#3F7D45"; c.lineWidth = 3; c.stroke();
      D.sphere(c, cx - rw * .45, cy - rh * .2, 14, "#7B6BB0"); D.txt(c, "ядро", cx - rw * .45, cy + rh * .3, { size: 10, align: "center", color: C.soft });
      for (let k = 0; k < 4; k++) { const py = cy - rh * .6 + k * rh * .4; D.rr(c, cx + rw - 7, py - 10, 14, 22, 4); c.fillStyle = "#C0392B"; c.fill(); }
      for (let k = 0; k < 14; k++) { const v = (u * 1.4 + k / 14) % 1, py = cy - rh * .6 + ((k % 4) * rh * .4), x = cx + rw * .1 + v * (rw * 1.9 + 40); dot(x, py + 1, 3.2, "#C98A1B", v < .85 ? 1 : 1 - (v - .85) * 6); }
      msg = "переносники й помпи (енергія АТФ) виводять молекули поодинці";
    } else if (mode === "gra") {
      cellPath(); c.fillStyle = "#CFE7B8"; c.fill(); c.strokeStyle = "#3F7D45"; c.lineWidth = 3; c.stroke();
      // Гольджі
      c.strokeStyle = "#7B6BB0"; c.lineWidth = 4; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(cx - rw * .3, cy, 22 + k * 7, -1.2, 1.2); c.stroke(); } D.txt(c, "апарат Гольджі", cx - rw * .5, cy + rh * .72, { size: 10, align: "center", color: C.soft });
      for (let k = 0; k < 4; k++) { const v = (u * 1.2 + k * .25) % 1, x = lerp(cx - rw * .1, cx + rw - 4, smooth(Math.min(1, v * 1.4))), y = cy + Math.sin(k * 2) * rh * .5; if (v < .75) { c.fillStyle = "rgba(201,138,27,.25)"; c.strokeStyle = "#C98A1B"; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.stroke(); dot(x, y, 3.2); } else { const w = (v - .75) / .25; for (let q = 0; q < 4; q++) dot(cx + rw + 8 + w * (30 + q * 8), y + (q - 1.5) * 6 * w, 2.8, "#C98A1B", 1 - w * .6); } }
      msg = "везикули з Гольджі зливаються з плазмалемою й викидають вміст назовні";
    } else if (mode === "apo") {
      const bulge = smooth(clamp(u / .6, 0, 1)), pinch = u > .6 ? smooth((u - .6) / .3) : 0;
      cellPath(); c.fillStyle = "#CFE7B8"; c.fill(); c.strokeStyle = "#3F7D45"; c.lineWidth = 3; c.stroke();
      // голівка
      const hx = cx + rw * .95 + bulge * 34 + pinch * 70, hy = cy; const hr = 8 + bulge * 26 * (1 - pinch * .0);
      c.fillStyle = "#CFE7B8"; c.strokeStyle = "#3F7D45"; c.lineWidth = 3; c.beginPath(); c.arc(hx, hy, hr, 0, 7); c.fill(); c.stroke();
      for (let k = 0; k < 10; k++) dot(hx + Math.cos(k * 2.4) * hr * .5, hy + Math.sin(k * 2.4) * hr * .5, 2.6, "#C98A1B", clamp(bulge * 1.4, 0, 1));
      D.txt(c, pinch > .1 ? "відокремлена частина цитоплазми з секретом" : "голівка наповнюється секретом", hx, hy - hr - 12, { size: 10.5, align: "center", color: C.soft });
      msg = "частина клітини (з цитоплазмою) відокремлюється разом із секретом — як у сольових волосків";
    } else {
      const fill = clamp(u / .55, 0, 1), burst = u > .6 ? clamp((u - .6) / .3, 0, 1) : 0;
      if (burst < .98) { cellPath(1 - burst * .0); c.fillStyle = mixHex("#CFE7B8", "#E9D8A4", fill); c.globalAlpha = 1 - burst * .6; c.fill(); c.globalAlpha = 1; c.strokeStyle = "#3F7D45"; c.setLineDash(burst > 0 ? [6, 6] : []); c.lineWidth = 3; c.stroke(); c.setLineDash([]); }
      if (burst < .98) { c.globalAlpha = 1 - fill * .85; D.sphere(c, cx - rw * .1, cy, 16, "#7B6BB0"); c.globalAlpha = 1; }
      for (let k = 0; k < 40; k++) { const a = k * 2.4, rr = (hash01(k, 3) * .8) * rw * .9; const spread = burst * (50 + hash01(k, 4) * 120); dot(cx + Math.cos(a) * rr * (.6 + burst) + spread, cy + Math.sin(a) * rr * .7 + burst * (hash01(k, 5) - .5) * 60, 3, "#C98A1B", clamp(fill * 1.3, 0, 1)); }
      msg = "клітина накопичує секрет, ядро зникає, клітина руйнується — уся стає секретом";
    }
    D.txt(c, SEC[mode].n, nar ? 12 : W * .5, nar ? H * .75 : 30, { size: 12.5, weight: 800, align: nar ? "left" : "left", color: C.ink });
    const tx = nar ? 12 : W * .5, ty = nar ? H * .82 : 52, tw = nar ? W - 24 : W * .46;
    wrap(c, SEC[mode].d, tx, ty, tw, 16, { size: 11.5, color: C.soft, weight: 500 }); D.tag(c, msg, nar ? W / 2 : W * .5 + tw / 2, nar ? H - 12 : H - 24, { size: fitSz(c, msg, nar ? W - 8 : W - 16, 10.5), bg: "#fff", stroke: C.rule, color: C.soft });
  },
  reads: (S, P) => [["Тип секреції", SEC[P.mode].n, ""], ["Клітина лишається цілою?", P.mode === "hol" ? "ні — стає секретом" : P.mode === "apo" ? "частково втрачає цитоплазму" : "так", ""]],
});

/* ====================== 2. ЗОВНІШНІ ВИДІЛЬНІ СТРУКТУРИ (DOM) ====================== */
const STR = [
  { n: "Залозисті волоски й емергенці", img: "e-gland-types", cap: "Залозисті волоски (1–3) з одно-, двох- і багатоклітинною голівкою (за посібником).", d: "<b>Трихоми</b> — вирости епідерми; <b>емергенці</b> — з участю й глибших тканин. Залозистий волосок має ніжку й голівку; голівка виділяє секрет під кутикулу, а при її розриві крапля виходить назовні — і кутикула відновлюється. Волоски пеларгонії виділяють ефірні олії, головчасті волоски лободи — воду й солі. Пекучі волоски собачої кропиви — «медичний шприц»: стінки просякнуті кремнеземом, голівка обламується й уколює отруйний секрет.", ex: "пеларгонія, лобода, кропива" },
  { n: "Нектарники", img: "e-bumblebee", cap: "Джмелі й бджоли збирають нектар — водний розчин цукрів.", d: "Нектар — водний розчин цукрів із білками, спиртами й ароматичними речовинами. Нектарники зазвичай розташовані на частинах квітки (можуть бути й на інших органах). Нектар — їжа для комах і птахів, які здійснюють <b>перехресне запилення</b>.", ex: "квітки лугових і плодових рослин" },
  { n: "Осмофори", img: null, d: "<b>Осмофори</b> — залозки на квітконосах чи пелюстках, що виділяють <b>леткі ефірні олії</b>, від яких залежить аромат квітів. Їх роль — приваблювати запилювачів.", ex: "квітки з сильним ароматом" },
  { n: "Гідатоди (гутація)", img: "e-guttation", cap: "Краплі води на краю листка: гутація через гідатоди.", d: "<b>Гідатоди</b> — «водяні продихи», крізь які виділяється крапельно-рідка вода з розчиненими солями (гутація). Характерна для рослин у вологій атмосфері й проростків із ще не сформованою випаровувальною поверхнею. Вихідна щілина й місце виділення води (<b>епітема</b>) заздалегідь «налаштовані» — це постійно готовий до дії механізм. Докладніше — у статті «Водний режим рослин».", ex: "приворотень, полуниця" },
  { n: "Травні залозки хижих рослин", img: "e-sundew", cap: "Росичка: волоски-щупальця з липкими краплями слизу.", d: "У комахоїдних рослин залозки виділяють <b>рідину з травними ферментами й кислими полісахаридами</b>; комахи — додаткове джерело азоту. Росичка (<i>Drosera</i>) росте на торф'яних болотах: блискучі краплі слизу приваблюють комах, вони прилипають, волоски й краї листка загинаються. Пухирчатка має пастки-пухирці з клапаном: дотик відкриває клапан, струмінь води затягує здобич усередину. Поживні речовини засвоюються залозами, пов'язаними з провідною системою листка.", ex: "росичка, венерина мухоловка, непентес, пухирчатка", more: ["e-flytrap", "e-nepenthes", "e-utricularia"] },
  { n: "Сольові залози й волоски галофітів", img: "e-saltgland", cap: "Сольова залоза листка кермеку на поперечному зрізі (за посібником).", d: "Розвиваються в рослин засолених ґрунтів (<b>галофітів</b>) на листках і стеблах. <b>Сольові залози</b> виводять надлишок мінеральних речовин на поверхню листка, де вони відкладаються на кутикулі й змиваються дощем. <b>Сольові волоски</b> з двох клітин: солі накопичуються у вакуолі верхньої клітини, а коли концентрація досягає порога, голівка відпадає й утворюється нова накопичувальна клітина.", ex: "кермек Гмеліна, армерія, солероса", more: ["e-limonium", "e-salicornia", "e-armeria"] },
];
reg("e-struct", {
  dom(body) {
    body.innerHTML = `<div class="ph-dom"><div class="ph-chips" id="st"></div><div class="ph-panel" id="sp"></div></div>`;
    const chips = body.querySelector("#st"), panel = body.querySelector("#sp");
    const show = (i) => { const s = STR[i]; const fig = (k, cap) => `<figure class="cp" style="margin:0"><img src="${IMG}${k}.webp" alt="${cap || s.n}" loading="lazy" decoding="async" style="width:100%;height:auto;border-radius:10px"></figure>`;
      const imgs = [s.img && fig(s.img, s.cap), ...((s.more || []).map(k => fig(k)))].filter(Boolean);
      panel.innerHTML = `<div style="display:grid;gap:14px;grid-template-columns:${imgs.length ? "minmax(200px,1fr) minmax(220px,1.2fr)" : "1fr"};align-items:start"><div style="display:grid;gap:8px;grid-template-columns:${imgs.length > 1 ? "repeat(2,1fr)" : "1fr"}">${imgs.join("")}${s.cap ? `<small style="grid-column:1/-1;color:var(--muted,#6B7A70)">${s.cap}</small>` : ""}</div><div><h4>${s.n}</h4><p style="margin:0 0 8px">${s.d}</p><p style="margin:0"><small>Приклади: ${s.ex}</small></p></div></div>`;
      [...chips.children].forEach((b, j) => b.setAttribute("aria-pressed", String(i === j))); };
    STR.forEach((s, i) => chips.append(btn(s.n, "", () => show(i)))); show(0);
    const st = document.createElement("style"); st.textContent = "@media(max-width:700px){.ph-panel>div{grid-template-columns:1fr!important}}"; body.append(st);
  },
});

/* ====================== 3. ФОРМУВАННЯ ВМІСТИЛИЩ: СХІЗОГЕННІ Й ЛІЗИГЕННІ ====================== */
reg("e-comp", {
  aspect: (w) => (w < 560 ? 1.05 : 1.8),
  modes: [["schiz", "Схізогенне (клітини розходяться)"], ["lysi", "Лізигенне (клітини розчиняються)"]],
  params: [{ k: "p", label: "Час формування вмістилища", min: 0, max: 100, step: 1, v: 100, u: "%" }],
  buttons: [{ label: "▶ Показати формування", pri: true, run: (S, P, sim) => { sim.P.p = 0; sim.sl.p.inp.value = 0; sim.sl.p.show(); S.play = true; } }],
  info: "<b>Секреторні вмістилища</b> — порожнини всередині рослини, заповнені секретом. <b>Схізогенні</b> утворюються розходженням клітин і формуванням великого міжклітинника, вистеленого живим <b>епітелієм</b>, який виробляє секрет (смоляні ходи хвойних, ефіроолійні канали зонтичних, вмістилища евкаліпту). <b>Лізигенні</b> виникають через розчинення групи клітин після нагромадження в них речовин (ефіроолійні вмістилища в навколоплоднику цитрусових). Часто зустрічаються й змішані — <b>схізолізигенні</b> (смоли й ефірні олії в корені оману).",
  init() { return { play: false }; },
  step(S, P, dt, sim) { if (S.play) { P.p = Math.min(100, P.p + dt * 14); sim.sl.p.inp.value = P.p; sim.sl.p.show(); if (P.p >= 100) S.play = false; } },
  draw(c, S, P, W, H) {
    D.bg(c, W, H, "#F5F6F0", "#EAEFE4"); const nar = W < 560; const p = P.p / 100; const sch = P.mode === "schiz";
    const cx = nar ? W / 2 : W * .32, cy = nar ? H * .36 : H * .5, R = nar ? Math.min(W * .4, 120) : Math.min(H * .42, 140);
    // клітини: кільця навколо центру (гексагональна упаковка)
    const cells = []; const rings = [[0, 1], [1, 6], [2, 12], [3, 18]]; let id = 0;
    const base = R / 3.6;
    for (const [r, n] of rings) for (let k = 0; k < n; k++) { const a = (k / Math.max(1, n)) * Math.PI * 2 + r * .3; cells.push({ r, a, x: r === 0 ? 0 : Math.cos(a) * r * base * .98, y: r === 0 ? 0 : Math.sin(a) * r * base * .98, id: id++ }); }
    cells.forEach(cl => {
      let x = cl.x, y = cl.y, alp = 1, fillv = 0, rad = base * .5;
      if (sch) { const push = smooth(clamp(p * 1.3, 0, 1)); const d = Math.hypot(x, y) || 1; const shift = cl.r <= 1 ? push * (cl.r === 0 ? 0 : base * 1.45) : push * base * .45; x += x / d * (cl.r === 0 ? 0 : shift); y += y / d * (cl.r === 0 ? 0 : shift); if (cl.r === 0) alp = 1 - smooth(clamp((p - .2) / .3, 0, 1)); fillv = cl.r === 1 ? smooth(clamp((p - .3) / .5, 0, 1)) : 0; }
      else { const d = Math.hypot(x, y); if (cl.r <= 1) { fillv = smooth(clamp(p * 1.6, 0, 1)); alp = 1 - smooth(clamp((p - .5) / .45, 0, 1)); rad = base * .5 * (1 + fillv * .2); } else if (cl.r === 2) { alp = 1 - smooth(clamp((p - .8) / .2, 0, 1)) * .0; } }
      const px = cx + x, py = cy + y; c.globalAlpha = alp;
      c.fillStyle = mixHex("#CFE6B5", sch && cl.r === 1 ? "#A9D36F" : "#E9D69A", fillv); c.strokeStyle = "#5E8F4A"; c.lineWidth = 2; c.beginPath(); c.arc(px, py, rad, 0, 7); c.fill(); c.stroke();
      if (fillv > .1) for (let q = 0; q < 4; q++) { c.fillStyle = "#C98A1B"; c.beginPath(); c.arc(px + (hash01(cl.id, q) - .5) * rad, py + (hash01(cl.id, q + 9) - .5) * rad, 2, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    });
    // секрет у порожнині
    if (p > .4) { const sr = (sch ? base * 1.15 : base * 1.3) * smooth(clamp((p - .4) / .5, 0, 1)); const g = c.createRadialGradient(cx, cy, 0, cx, cy, sr); g.addColorStop(0, "rgba(232,181,74,.95)"); g.addColorStop(1, "rgba(232,181,74,.35)"); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, sr, 0, 7); c.fill(); }
    if (p > .9) D.txt(c, sch ? "міжклітинник з секретом" : "порожнина на місці розчинених клітин", cx, cy + R + 18, { size: 11, align: "center", weight: 700, color: C.soft });
    const tx = nar ? 14 : W * .62, ty = nar ? H * .8 : 40, tw = nar ? W - 28 : W * .34;
    D.txt(c, sch ? "Схізогенне вмістилище" : "Лізигенне вмістилище", tx, nar ? H - 12 : ty, { size: 13, weight: 800 });
    const steps = sch ? ["клітини розходяться, утворюється міжклітинник", "навколо порожнини — живі клітини епітелію", "епітелій виділяє секрет у порожнину"] : ["клітини групи нагромаджують секрет", "їхні стінки розчиняються", "на місці клітин — порожнина із секретом"];
    if (!nar) steps.forEach((s, i) => { const on = p > i * .33 + .05; c.fillStyle = on ? "#2F7D4F" : "#C9D8CE"; c.beginPath(); c.arc(tx + 8, ty + 36 + i * 36, 8, 0, 7); c.fill(); D.txt(c, `${i + 1}`, tx + 8, ty + 36 + i * 36, { size: 10.5, color: "#fff", align: "center", weight: 800 }); wrap(c, s, tx + 26, ty + 31 + i * 36, tw - 26, 14, { size: 11, color: on ? C.ink : C.muted, weight: 600 }); });
  },
  reads: (S, P) => [["Тип", P.mode === "schiz" ? "схізогенне" : "лізигенне", ""], ["Стадія формування", fmt(P.p, 0), "%"], ["Приклад", P.mode === "schiz" ? "смоляні ходи хвойних, евкаліпт" : "навколоплідник цитрусових", ""]],
});

/* ====================== 4. СОЛЬОВІ ЗАЛОЗИ ГАЛОФІТІВ ====================== */
reg("e-salt", {
  aspect: (w) => (w < 560 ? 0.95 : 1.7),
  params: [{ k: "sal", label: "Засоленість ґрунту", min: 0, max: 100, step: 5, v: 60, u: "%" }],
  toggles: [{ k: "gl", label: "Сольові залози працюють", v: true }],
  buttons: [{ label: "🌧 Дощ (змиває кристали)", pri: true, run: (S) => { S.rain = 3; S.crys = 0; } }],
  presets: [{ label: "Незасолений ґрунт", set: { sal: 5 } }, { label: "Солончак", set: { sal: 90 } }], presetsLabel: "Ґрунт",
  info: "Галофіти ростуть на засолених ґрунтах і мають спеціальні пристосування для виведення надлишку солей. <b>Сольові залози</b> на листках виводять іони на поверхню, де вони осідають на кутикулі, а потім змиваються дощем. <b>Сольові волоски</b> накопичують солі у вакуолі верхньої клітини, і при досягненні порога голівка відпадає. Якщо залози вимкнути, сіль накопичується в тканині листка й вона починає жовтіти.",
  init() { const r = rng(5); return { leaf: .1, crys: 0, hair: 0, drops: [], ions: Array.from({ length: 20 }, () => ({ u: r(), x: r() })), rain: 0, t: 0, fall: [] }; },
  step(S, P, dt) {
    const up = P.sal / 100; S.t += dt; const ex = P.gl ? .5 * S.leaf : 0;
    S.leaf = clamp(S.leaf + dt * (.12 * up - ex * .25 - .01 * S.leaf), 0, 1);
    S.crys = Math.min(60, S.crys + dt * ex * 6);
    S.hair += dt * .18 * (P.gl ? 1 : .5) * S.leaf * 2; if (S.hair >= 1) { S.hair = 0; S.fall.push({ y: 0 }); }
    S.fall = S.fall.filter(f => (f.y += dt * 60) < 70);
    if (S.rain > 0) S.rain -= dt; for (const i of S.ions) { i.u += dt * (.1 + up * .2); if (i.u > 1) i.u -= 1; }
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H, S.rain > 0 ? "#B8CAD8" : "#EAF3F8", "#E8EFE6"); const nar = W < 560; const up = P.sal / 100;
    const gy = H * (nar ? .46 : .6), ground = c;
    c.fillStyle = mixHex("#8B6A47", "#D9CDB0", up * .6); c.fillRect(0, gy, nar ? W : W * .52, H - gy);
    if (up > .1) { c.fillStyle = `rgba(255,255,255,${up * .55})`; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(8 + hash01(i, 1) * ((nar ? W : W * .52) - 16), gy + 6 + hash01(i, 2) * (H - gy - 10), 1.6 + hash01(i, 3) * 2, 0, 7); c.fill(); } }
    D.txt(c, "засолений ґрунт", 10, gy + (nar ? 9 : 16), { size: 10.5, color: up > .5 ? "#6A5A3E" : "#F4E6C8", weight: 700 });
    // рослина (солероса-стиль: сегментований м'ясистий стебель)
    const px = nar ? W * .3 : W * .26; const col = mixHex("#6FB563", "#C9B84A", clamp(S.leaf - .55, 0, .45) / .45 * (P.gl ? .3 : 1));
    c.strokeStyle = col; c.lineWidth = 16; c.lineCap = "round"; c.beginPath(); c.moveTo(px, gy); c.lineTo(px, gy - H * .3); c.stroke();
    for (const s of [-1, 1]) { c.lineWidth = 11; c.beginPath(); c.moveTo(px, gy - H * .12); c.lineTo(px + s * 44, gy - H * .22); c.stroke(); }
    // іони по ксилемі
    for (const i of S.ions) { const y = gy + 6 - i.u * (H * .3 + 6); c.fillStyle = "rgba(255,255,255,.9)"; c.strokeStyle = "#7BA0C0"; c.beginPath(); c.arc(px + (i.x - .5) * 6, y, 2.4, 0, 7); c.fill(); c.stroke(); }
    // кристали на листку
    const nc = Math.round(S.crys); for (let i = 0; i < nc; i++) { const a = hash01(i, 7) * 6.28; c.fillStyle = "#fff"; c.strokeStyle = "#B7C4CF"; const rx = px + Math.cos(a) * (6 + hash01(i, 8) * 7), ry = gy - H * .08 - hash01(i, 9) * H * .2; c.fillRect(rx - 2, ry - 2, 4, 4); c.strokeRect(rx - 2, ry - 2, 4, 4); }
    // дощ
    if (S.rain > 0) for (let i = 0; i < 36; i++) { const x = hash01(i, 5) * W, y = ((t * 260 + hash01(i, 6) * H) % H); c.strokeStyle = "rgba(70,110,150,.6)"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 11); c.stroke(); }
    // права панель: лупа на сольові волоски
    const gx = nar ? 14 : W * .56, gw = nar ? W - 28 : W * .4; let y = nar ? H * .56 : 36;
    D.txt(c, "Сольовий волосок (збільшено)", gx, y - 8, { size: 11.5, weight: 700 });
    const hx = gx + 50, hy = y + 20; c.fillStyle = "#CFE6B5"; c.strokeStyle = "#5E8F4A"; c.lineWidth = 2; D.rr(c, hx - 11, hy + 36, 22, 40, 6); c.fill(); c.stroke();
    const hr = 12 + S.hair * 16; c.fillStyle = mixHex("#CFE6B5", "#EADFA8", S.hair); c.beginPath(); c.arc(hx, hy + 30, hr, 0, 7); c.fill(); c.stroke(); for (let i = 0; i < Math.round(S.hair * 10); i++) { c.fillStyle = "#C98A1B"; c.beginPath(); c.arc(hx + (hash01(i, 2) - .5) * hr, hy + 30 + (hash01(i, 3) - .5) * hr, 2, 0, 7); c.fill(); }
    for (const f of S.fall) { c.globalAlpha = 1 - f.y / 80; c.fillStyle = "#E8D58A"; c.strokeStyle = "#5E8F4A"; c.beginPath(); c.arc(hx + 4 + f.y * .3, hy + 30 + f.y, 16, 0, 7); c.fill(); c.stroke(); c.globalAlpha = 1; }
    D.txt(c, "голівка накопичує солі й відпадає", hx + 38, hy + 24, { size: 10.5, color: C.soft });
    // шкали
    const by = nar ? H * .86 : y + 130; const bar = (n, v, col, tx) => { D.txt(c, n, gx, by, { size: 11, color: C.soft }); c.fillStyle = "#E4ECE4"; D.rr(c, gx, by + 8, gw, 12, 6); c.fill(); c.fillStyle = col; D.rr(c, gx, by + 8, Math.max(4, gw * v), 12, 6); c.fill(); D.txt(c, tx, gx + gw, by, { size: 11, align: "right", weight: 700 }); };
    bar("Солі в тканині листка", S.leaf, S.leaf > .6 ? C.red : "#C98A1B", fmt(S.leaf * 100, 0) + " %");
    if (!nar) { c.save(); c.translate(0, 42); const by2 = by; D.txt(c, "Кристали на поверхні", gx, by2, { size: 11, color: C.soft }); c.fillStyle = "#E4ECE4"; D.rr(c, gx, by2 + 8, gw, 12, 6); c.fill(); c.fillStyle = "#8FA9BC"; D.rr(c, gx, by2 + 8, Math.max(4, gw * S.crys / 60), 12, 6); c.fill(); c.restore(); }
    if (!P.gl && S.leaf > .6) D.tag(c, "без залоз листки жовтіють: сіль накопичується", nar ? W / 2 : W * .3, 22, { size: 11, bg: "#FDECEA", stroke: C.red, color: C.red });
  },
  reads: (S, P) => [["Сіль у тканині листка", fmt(S.leaf * 100, 0), "%"], ["Кристалів на поверхні", fmt(S.crys, 0), "(умовно)"], ["Залози", P.gl ? "працюють" : "вимкнені", ""]],
});
