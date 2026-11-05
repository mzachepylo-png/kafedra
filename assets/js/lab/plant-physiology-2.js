// Фізіологія рослин в моделях: лабораторні роботи 13–21 (за навчальним посібником «Фізіологія рослин», ч. ІІ, НУБіП, 2024).
// Використовує ядро застосунку з plant-physiology.js (App, UI, Stage, drawChart, Theme, Draw, h, rng, fmt…).
"use strict";

/* ---- допоміжне для цього файлу ---- */
const WATER = "#8EC1EA";
function mixH(a, b, t) { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const f = (sh) => Math.round(lerp((A >> sh) & 255, (B >> sh) & 255, t)); return "#" + [16, 8, 0].map(sh => f(sh).toString(16).padStart(2, "0")).join(""); }
const bell = (x, mu, s) => Math.exp(-0.5 * ((x - mu) / s) ** 2);
const cl01 = (x) => clamp(x, 0, 1);
/* текст на полотні: за потреби зменшує кегль, щоб підпис не обрізався краєм */
function fitText(c, s, x, y, maxW, o = {}) {
  let size = o.size || 11; const fam = getComputedStyle(document.body).getPropertyValue("--f-mono");
  c.font = `${o.weight || ""} ${size}px ${fam}`; const w = c.measureText(s).width;
  if (w > maxW) size = Math.max(7.5, size * maxW / w);
  Draw.text(c, s, x, y, Object.assign({}, o, { size }));
}
function roundRect(c, x, y, w, hh, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function bisect(f, a, b, n = 50) { let fa = f(a); for (let i = 0; i < n; i++) { const m = (a + b) / 2, fm = f(m); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; }
function beaker(c, x, y, w, hh, level, col, o = {}) { // склянка з рідиною
  const T = Theme.c;
  c.save(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y + hh - 8); c.quadraticCurveTo(x + 4, y + hh, x + 14, y + hh); c.lineTo(x + w - 14, y + hh); c.quadraticCurveTo(x + w - 4, y + hh, x + w - 3, y + hh - 8); c.lineTo(x + w, y); c.clip();
  const ly = y + hh * (1 - level); c.fillStyle = col; c.globalAlpha = o.alpha ?? .55; c.fillRect(x, ly, w, hh); c.globalAlpha = 1;
  c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(x + 4, y + 4, 5, hh - 12);
  if (o.inner) o.inner(c, ly);
  c.restore();
  c.strokeStyle = rgba(T.ink, .5); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y + hh - 8); c.quadraticCurveTo(x + 4, y + hh, x + 14, y + hh); c.lineTo(x + w - 14, y + hh); c.quadraticCurveTo(x + w - 4, y + hh, x + w - 3, y + hh - 8); c.lineTo(x + w, y); c.stroke(); c.lineWidth = 1;
  return ly;
}
function cuvette(c, x, y, w, hh, col, fill = .7, glow = null) { // кювета з розчином
  const T = Theme.c; c.save(); roundRect(c, x, y, w, hh, 4); c.clip();
  c.fillStyle = Theme.dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.55)"; c.fillRect(x, y, w, hh);
  c.fillStyle = col; c.fillRect(x, y + hh * (1 - fill), w, hh * fill);
  if (glow) { const g = c.createRadialGradient(x + w / 2, y + hh * .6, 2, x + w / 2, y + hh * .6, hh); g.addColorStop(0, glow); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x, y, w, hh); }
  c.fillStyle = "rgba(255,255,255,.28)"; c.fillRect(x + 3, y + 3, 3, hh - 6);
  c.restore(); c.strokeStyle = rgba(T.ink, .55); c.lineWidth = 1.5; roundRect(c, x, y, w, hh, 4); c.stroke(); c.lineWidth = 1;
}

/* ============ ЛР 13. Тургор клітини коренеплоду моркви ============ */
App.add({
  n: 13, short: "Тургор коренеплоду моркви", tag: "водний потенціал · осмос",
  title: "Вивчення тургору рослинної клітини: поглинання води та її вихід із клітин коренеплоду моркви",
  model: "ψ = ψₛ + P · ψₛ(v) = ψₛ₀/v · P = ε·(v − v_p)/v_p · dv/dt = L_p·(ψ_розчину − ψ_клітини)",
  build({ stageBox, ctrls, below }) {
    const RT = (T) => 0.008314 * (273.15 + T);           // МПа·л/моль
    const PS0 = -1.1, VP = 0.93, EPS = 5, LP = 0.045;     // ψₛ при v = 1, об'єм плазмолізу, модуль пружності, провідність
    const S = { C: 0.1, T: 22, t: 0, v: 1, play: false, hist: [], drops: [] };
    const psiS = (v) => PS0 / v, press = (v) => v > VP ? EPS * (v - VP) / VP : 0, psiC = (v) => psiS(v) + press(v);
    const psiOut = () => -S.C * RT(S.T);
    const vEq = (C) => bisect((v) => psiC(v) - (-C * RT(S.T)), 0.3, 1.5);
    const dm = (v) => (v - 1) * 100;                      // зміна маси, % (маса ~ об'єм)
    const Q = () => Math.pow(1.6, (S.T - 22) / 10);
    function reset() { S.t = 0; S.v = 1; S.hist = [[0, 0]]; S.play = true; S.drops = []; }
    reset(); S.play = false;
    const st = new Stage(stageBox, { aspect: (stageBox.clientWidth || 700) < 560 ? 0.95 : 1.6, minH: 300, maxH: 460, tag: "Смужки коренеплоду в розчині" });
    const rd = UI.reads(stageBox, [["po", "ψ розчину"], ["pc", "ψ клітини"], ["p", "Тургор P"], ["dm", "Зміна маси"], ["iso", "Ізотонічна C"], ["t", "Час"]]);
    UI.slider(ctrls, { id: "l13-c", label: "Концентрація сахарози в розчині", min: 0, max: 0.8, step: 0.02, value: S.C, unit: "моль/л", fmt: v => fmt(v, 2), on: v => { S.C = v; reset(); S.play = true; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l13-T", label: "Температура", min: 5, max: 40, step: 1, value: S.T, unit: "°C", on: v => { S.T = v; ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Занурити смужки", pri: true, on: () => { reset(); ch.dirty = true; } }]);
    ctrls.append(h("p", { class: "note" }, "Дистильована вода (0 моль/л) — смужки набирають воду й тверднуть; у розчині вище ізотонічного — втрачають воду, в’януть, а клітини плазмолізуються."));
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Зміна маси смужок у часі, %");
    const ch2 = UI.chart(row, "Рівноважна зміна маси від концентрації розчину");

    function strip(c, x, y, len, wd, bend, col) { // смужка з прогином
      c.beginPath(); c.moveTo(x, y);
      for (let i = 0; i <= 20; i++) { const u = i / 20; c.lineTo(x + u * len, y + bend * Math.sin(u * Math.PI) * 1); }
      for (let i = 20; i >= 0; i--) { const u = i / 20; c.lineTo(x + u * len, y + wd + bend * Math.sin(u * Math.PI)); }
      c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = "rgba(120,60,0,.55)"; c.stroke();
    }
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear();
      const narrow = W < 520;
      const bx = narrow ? 14 : 24, bw = narrow ? W - 28 : W * .56, by = narrow ? 44 : 52, bh = narrow ? H * .5 - 8 : H - 82;
      const turg = cl01(press(S.v) / press(vEq(0)) );
      const solCol = S.C > 0 ? "#C7E3F2" : "#B6DDF5";
      beaker(c, bx, by, bw, bh, .86, solCol, { inner: (cc, ly) => {
        // смужки
        const base = 1, scale = Math.cbrt(S.v) / Math.cbrt(1);
        for (let k = 0; k < 4; k++) {
          const len = (bw - 70) * .86 * scale, wd = 15 * Math.sqrt(S.v), yy = by + bh * .28 + k * (bh * .13);
          const sag = (1 - turg) * 16 * (k % 2 ? .8 : 1) + Math.sin(time * 1.4 + k) * 1.2 * (1 - turg);
          strip(cc, bx + 34, yy, len, wd, sag, mixHex("#E27F18", "#EDAE57", cl01(1 - turg)));
        }
        // дрібні бульбашки води
        for (const d of S.drops) { cc.fillStyle = `rgba(255,255,255,${.5 * (1 - d.u)})`; cc.beginPath(); cc.arc(d.x, d.y, 2.2, 0, 7); cc.fill(); }
      } });
      Draw.text(c, S.C === 0 ? "H₂O" : `${fmt(S.C, 2)} М сахарози`, bx + bw / 2, by - 12, { align: "center", color: T.ink, size: 12 });
      // зум на клітину
      const cx = narrow ? W / 2 : bx + bw + (W - bx - bw) / 2, cy = narrow ? by + bh + (H - by - bh) / 2 + 6 : by + bh * .38, R = narrow ? Math.min(60, (H - by - bh) / 2 - 12) : Math.min(80, (W - bx - bw) / 2 - 10);
      const rw = R * (0.92 + 0.12 * Math.min(1.08, S.v)), pv = Math.max(0, Math.min(1, (S.v - 0.7) / (VP - 0.7))) ;
      roundRect(c, cx - rw, cy - rw * .8, rw * 2, rw * 1.6, 10); c.fillStyle = Theme.dark ? "#2d3a2a" : "#E8F2D8"; c.fill(); c.strokeStyle = Theme.dark ? "#8fb06d" : "#5E8F4A"; c.lineWidth = 4; c.stroke(); c.lineWidth = 1;
      const shrink = S.v >= VP ? 1 : 0.55 + 0.45 * pv; // плазмоліз — протопласт відходить від стінки
      roundRect(c, cx - rw * .86 * shrink, cy - rw * .66 * shrink, rw * 1.72 * shrink, rw * 1.32 * shrink, 8); c.fillStyle = Theme.dark ? "rgba(140,190,230,.45)" : "rgba(150,200,235,.7)"; c.fill(); c.strokeStyle = "#5C8FB0"; c.stroke();
      Draw.text(c, "вакуоля", cx, cy, { align: "center", color: T.ink, size: 10 });
      if (S.v < VP) Draw.text(c, "плазмоліз", cx, cy + rw * .98, { align: "center", color: T.warn, size: 11 });
      else Draw.text(c, press(S.v) > .1 ? "тургор" : "в’янення", cx, cy + rw * .98, { align: "center", color: T.muted, size: 11 });
      // стрілки руху води
      const flux = psiOut() - psiC(S.v);
      if (Math.abs(flux) > .02) { const dir = flux > 0 ? 1 : -1; for (let k = 0; k < 3; k++) { const u = ((time * .8 + k / 3) % 1); const ax = cx + dir * (rw * 1.15 - u * 24); c.fillStyle = rgba(WATER.length ? "#2E6FB5" : "#000", .7 * (1 - u)); c.beginPath(); c.arc(ax, cy - rw * .95 + k * 6, 3, 0, 7); c.fill(); } Draw.text(c, flux > 0 ? "вода всередину" : "вода назовні", cx, cy - rw * .95 - 10, { align: "center", size: 10, color: T.data }); }
    }
    function charts() {
      drawChart(ch, { x: [0, 90], y: [Math.min(-30, ...S.hist.map(p => p[1]) , dm(vEq(S.C)) - 2), Math.max(10, ...S.hist.map(p => p[1]), dm(vEq(S.C)) + 5)], xl: "хв", yl: "Δm, %", hl: [{ y: 0, color: Theme.c.muted }, { y: dm(vEq(S.C)), color: Theme.c.data, label: "рівновага" }], series: [{ pts: S.hist, color: Theme.c.data, w: 2.4 }], marks: [{ x: Math.min(90, S.t), y: dm(S.v), color: Theme.c.antho }] });
      const eq = []; for (let C = 0; C <= 0.8001; C += 0.02) eq.push([C, dm(vEq(C))]);
      const cIso = bisect((C) => dm(vEq(C)), 0, 1);
      drawChart(ch2, { x: [0, 0.8], y: [-50, 10], xl: "C, моль/л", yl: "Δm, %", hl: [{ y: 0, color: Theme.c.muted }], vl: [{ x: cIso, color: Theme.c.good, label: "ізотонічна C" }], series: [{ pts: eq, color: Theme.c.chl, w: 2.4 }], marks: [{ x: S.C, y: dm(vEq(S.C)), color: Theme.c.antho, label: "ваш розчин" }] });
      rd.set("iso", fmt(cIso, 2), "моль/л");
    }
    return {
      stages: [st, ch, ch2],
      frame(dt, time) {
        if (S.play && dt > 0) {
          const sim = dt * 8; let left = sim;
          while (left > 0) { const d = Math.min(.1, left); S.v += Q() * LP * (psiOut() - psiC(S.v)) * d / (S.v * 1) * 0.55; S.t += d; left -= d; }
          S.v = clamp(S.v, .35, 1.5); if (S.t - (S.hist[S.hist.length - 1]?.[0] ?? 0) > 1) S.hist.push([S.t, dm(S.v)]);
          if (Math.abs(psiOut() - psiC(S.v)) > .03 && Math.random() < dt * 14) S.drops.push({ x: 30 + Math.random() * 120, y: 60 + Math.random() * 120, u: 0 });
          if (S.t > 90) S.play = false; ch.dirty = true;
        }
        S.drops = S.drops.filter(d => (d.u += dt * .9) < 1);
        draw(time);
        if (ch.dirty) { charts(); ch.dirty = false; ch2.dirty = false; }
        rd.set("po", fmt(psiOut(), 2), "МПа"); rd.set("pc", fmt(psiC(S.v), 2), "МПа"); rd.set("p", fmt(press(S.v), 2), "МПа"); rd.set("dm", (dm(S.v) >= 0 ? "+" : "") + fmt(dm(S.v), 1), "%"); rd.set("t", fmt(S.t, 0), "хв");
      },
    };
  },
  cheat: `
<h3>Тургор і водний потенціал клітини</h3>
<p>Рослинна клітина — осмотична система: її вакуоля з розчином відокремлена від зовнішнього середовища напівпроникною мембраною, а ззовні клітину стискає пружна клітинна стінка. Коли вода входить у клітину, вакуоля тисне на стінку, а стінка — на вакуолю: цей гідростатичний тиск називають <b>тургором</b> (<var>P</var>).</p>
<div class="eq"><var>ψ</var> = <var>ψ</var><sub>s</sub> + <var>P</var> &nbsp;·&nbsp; <var>ψ</var><sub>s</sub> = −<var>i</var>·<var>C</var>·<var>R</var>·<var>T</var></div>
<dl class="vars"><dt>ψ</dt><dd>водний потенціал клітини (МПа); вода рухається туди, де він нижчий</dd><dt>ψₛ</dt><dd>осмотичний потенціал клітинного соку (завжди від’ємний)</dd><dt>P</dt><dd>тургорний тиск (≥ 0); у плазмолізованій клітині P = 0</dd></dl>
<p>У посібнику ця ж рівновага записана як <b>S = P − T</b>, де <b>S</b> — сисна сила клітини, <b>P</b> — осмотичний тиск, <b>T</b> — тургорний тиск.</p>
<h3>Що відбувається з шматочками моркви</h3>
<p>У воді та розчинах нижче ізотонічного ψ розчину вищий, ніж ψ клітини, — вода входить, об’єм клітин і маса смужок зростають, смужки стають пружними (тургор). В <b>ізотонічному</b> розчині (ψ розчину = ψ клітини) маса не змінюється. У вищій концентрації вода виходить, смужки м’якшають і вигинаються, а протопласти відстають від стінок — настає плазмоліз.</p>
<h3>Як знайти ізотонічну концентрацію</h3>
<p>Поміщайте смужки в розчини різної концентрації, зважуйте до і після й будуйте залежність Δm від C. Точка, де крива перетинає нуль, — ізотонічна концентрація; за нею розраховують осмотичний потенціал соку: ψ<sub>s</sub> ≈ −C·R·T (для неелектроліту).</p>
<div class="fix"><b>Про модель.</b> Параметри (початковий ψ<sub>s</sub> ≈ −1,1 МПа, модуль пружності стінки, проникність мембран) — ілюстративні, підібрані так, щоб ізотонічна концентрація сахарози була близько 0,3 моль/л; реальні значення залежать від сорту й стану коренеплоду.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому смужки в дистильованій воді стають твердішими?</summary><p>Вода входить у клітини за градієнтом водного потенціалу, об’єм вакуолі зростає, і стінка створює тургор. Стінка пружна, тому клітина не лопається.</p></details>
<details class="qa"><summary>Що таке плазмоліз і чому він оборотний?</summary><p>Відхід протопласта від стінки в гіпертонічному розчині. Якщо клітину повернути у воду, вона знову набирає воду й повертається до тургору — деплазмоліз; необоротний він лише після загибелі протопласта.</p></details>
<details class="qa"><summary>Чому вилучення води змінює довжину смужки менше, ніж маса?</summary><p>Маса пропорційна об’єму (~L³), а довжина — його кореню кубічному, тому відносна зміна довжини приблизно втричі менша.</p></details>`,
});

/* ============ ЛР 14. Продихи: інфільтрація (за Молішем) і роль K⁺ ============ */
App.add({
  n: 14, short: "Продихи: K⁺ та інфільтрація", tag: "насос H⁺ · K⁺ · метод Моліша",
  title: "Рух продихів: роль K⁺ і оцінка стану продихів методом інфільтрації (за Молішем)",
  model: "a* = a_max·s(світло)·K/(K+K_m)·(1 − ABA/(ABA+K_A)) · da/dt = (a* − a)/τ · інфільтрація: v = k·(a − a_c(рідини))₊",
  build({ stageBox, ctrls, below }) {
    const LIQ = { eth: { name: "етанол 96 %", ac: 1.8, g: 22, col: "#7A5CC0" }, xyl: { name: "ксилол", ac: 1.0, g: 29, col: "#C9682B" }, ben: { name: "бензол", ac: 0.5, g: 29, col: "#3B8F6B" }, wat: { name: "вода", ac: 99, g: 72, col: "#2E6FB5" } };
    const S = { light: 60, aba: 0, K: 25, liq: "xyl", a: 1.5, t: 0, hist: [], inf: 0, infPlay: false, play: true };
    const Amax = 12;
    const target = () => Amax * Math.pow(S.light / 100, 1.25) * (S.K / (S.K + 6)) * (1 - S.aba / (S.aba + 1.5));
    const Kg = () => 20 + 340 * cl01(S.a / Amax) * 1.0; // мМ K⁺ у замикальних клітинах (ілюстративно)
    const rate = (a, L) => Math.max(0, a - L.ac) * 0.08;
    function reset() { S.a = 1.5; S.t = 0; S.hist = [[0, S.a]]; S.inf = 0; S.infPlay = false; S.play = true; }
    reset();
    const rg = rng(14);
    const st = new Stage(stageBox, { aspect: (stageBox.clientWidth || 700) < 560 ? 0.78 : 1.55, minH: 300, maxH: 460, tag: "Продихи й краплі" });
    const rd = UI.reads(stageBox, [["a", "Ширина щілини"], ["k", "K⁺ у замикальних клітинах"], ["tg", "Цільова ширина"], ["lq", "Рідина"], ["inf", "Пляма інфільтрації"], ["ac", "Критична ширина a_c"]]);
    UI.slider(ctrls, { id: "l14-l", label: "Освітленість (синє світло)", min: 0, max: 100, step: 5, value: S.light, unit: "%", on: v => { S.light = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l14-k", label: "Калій у середовищі", min: 0, max: 60, step: 1, value: S.K, unit: "мМ", on: v => { S.K = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l14-a", label: "Абсцизова кислота (АБК)", min: 0, max: 10, step: 0.1, value: S.aba, unit: "мкМ", fmt: v => fmt(v, 1), on: v => { S.aba = v; ch.dirty = true; } });
    UI.select(ctrls, { id: "l14-q", label: "Рідина для інфільтрації", value: S.liq, options: Object.entries(LIQ).map(([k, o]) => [k, o.name]), on: v => { S.liq = v; S.inf = 0; S.infPlay = false; ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Нанести краплю", pri: true, on: () => { S.inf = 0; S.infPlay = true; ch.dirty = true; } }, { label: "Скинути щілину", on: () => { reset(); ch.dirty = true; } }]);
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Ширина щілини за вибраних умов (прогрів і рух)");
    const ch2 = UI.chart(row, "Швидкість інфільтрації залежно від ширини щілини");

    function stoma(c, cx, cy, W, a, time) { // продих: дві бобоподібні замикальні клітини
      const open = a / Amax, gw = W * .15, gl = W * .46, gap = (a / Amax) * gw * 1.9;
      c.save(); c.translate(cx, cy);
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(-gl, 0);
        c.bezierCurveTo(-gl * .7, s * (gap / 2 + gw * 1.05), gl * .7, s * (gap / 2 + gw * 1.05), gl, 0);
        c.bezierCurveTo(gl * .7, s * (gap / 2 + gw * .08), -gl * .7, s * (gap / 2 + gw * .08), -gl, 0);
        c.closePath(); c.fillStyle = Theme.dark ? "#5C8F4A" : "#8FC36B"; c.fill(); c.strokeStyle = Theme.dark ? "#2b4a22" : "#4F7F3A"; c.lineWidth = 2; c.stroke();
        c.fillStyle = Theme.dark ? "#3B6A32" : "#6AA64E"; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-gl * .35 + i * gl * .24, s * (gap / 2 + gw * .55), 3.2, 0, 7); c.fill(); }
        // іони K+
        const n = Math.round(4 + 16 * cl01(open));
        for (let i = 0; i < n; i++) { const u = (i + .5) / n; const x = -gl * .75 + u * gl * 1.5, y = s * (gap / 2 + gw * (.2 + .7 * (.5 + .5 * Math.sin(i * 2.3 + time * 1.5)) * .85)); c.fillStyle = "rgba(46,111,181,.85)"; c.beginPath(); c.arc(x, y * 1, 2.4, 0, 7); c.fill(); }
      }
      c.restore();
    }
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear();
      const nar = W < 520, L = LIQ[S.liq];
      // епідерма
      const ex = 10, ey = 12, ew = nar ? W - 20 : W * .6, eh = nar ? H * .45 : H - 24; const r = rng(7);
      c.save(); c.beginPath(); c.rect(ex, ey, ew, eh); c.clip();
      c.fillStyle = Theme.dark ? "#2e4026" : "#DDEBC8"; c.fillRect(ex, ey, ew, eh);
      for (let i = 0; i < 28; i++) { const px = ex + r() * ew, py = ey + r() * eh, rr = 24 + r() * 26; c.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, rad = rr * (.8 + .35 * Math.sin(k * 2.7 + i)); const xx = px + Math.cos(a) * rad, yy = py + Math.sin(a) * rad * .8; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.closePath(); c.strokeStyle = Theme.dark ? "rgba(160,200,130,.35)" : "rgba(95,140,70,.35)"; c.stroke(); }
      // інфільтрована пляма
      const radius = Math.min(ew * .45, S.inf * 1);
      if (radius > 1) { const g = c.createRadialGradient(ex + ew / 2, ey + eh / 2, 2, ex + ew / 2, ey + eh / 2, radius); g.addColorStop(0, rgba("#1d3a1c", .78)); g.addColorStop(.85, rgba("#2c5a28", .62)); g.addColorStop(1, rgba("#2c5a28", 0)); c.fillStyle = g; c.beginPath(); c.arc(ex + ew / 2, ey + eh / 2, radius, 0, 7); c.fill(); }
      stoma(c, ex + ew / 2, ey + eh / 2, Math.min(ew, eh) * .56, S.a, time);
      c.restore(); c.strokeStyle = T.rule; c.strokeRect(ex + .5, ey + .5, ew, eh);
      Draw.text(c, `щілина ≈ ${fmt(S.a, 1)} мкм`, ex + 8, ey + 16, { color: T.ink, size: 12 });
      // права панель: мірна шкала відкритості
      const px = nar ? 14 : ex + ew + 16, pw = nar ? W - 28 : W - px - 12, py = nar ? ey + eh + 18 : ey + 8;
      Draw.text(c, "Відкритість щілини", px, py + 4, { color: T.ink, size: 12 });
      c.fillStyle = rgba(T.ink, .1); roundRect(c, px, py + 14, pw, 14, 7); c.fill(); c.fillStyle = T.chl; roundRect(c, px, py + 14, Math.max(8, pw * cl01(S.a / Amax)), 14, 7); c.fill();
      c.strokeStyle = T.antho; c.beginPath(); c.moveTo(px + pw * cl01(target() / Amax), py + 10); c.lineTo(px + pw * cl01(target() / Amax), py + 32); c.stroke(); Draw.text(c, "ціль", px + pw * cl01(target() / Amax), py + 44, { size: 10, align: "center", color: T.antho });
      // критичні ширини рідин
      Draw.text(c, "Проходить, якщо a > a_c:", px, py + 66, { size: 11, color: T.muted });
      Object.entries(LIQ).forEach(([k, o], i) => { const yy = py + 84 + i * 22, x0 = px + pw * cl01(o.ac / Amax); c.fillStyle = rgba(T.ink, .08); c.fillRect(px, yy, pw, 7); c.fillStyle = S.a > o.ac ? o.col : rgba(o.col, .3); c.fillRect(px, yy, Math.min(pw, pw * cl01(S.a / Amax)), 7); c.fillStyle = o.col; c.fillRect(x0 - 1.5, yy - 3, 3, 13); Draw.text(c, o.ac > 50 ? `${o.name} — не проходить` : `${o.name}, a_c = ${fmt(o.ac, 1)}`, px, yy - 5, { size: 10, color: T.ink }); });
      void L;
    }
    function charts() {
      drawChart(ch, { x: [0, 60], y: [0, 13], xl: "хв", yl: "a, мкм", hl: [{ y: target(), color: Theme.c.antho, label: "цільова" }], series: [{ pts: S.hist, color: Theme.c.chl, w: 2.4 }], marks: [{ x: Math.min(60, S.t), y: S.a, color: Theme.c.chl }] });
      const ser = Object.entries(LIQ).filter(([k]) => k !== "wat").map(([k, o]) => ({ pts: Array.from({ length: 61 }, (_, i) => [i / 5, rate(i / 5, o)]), color: o.col, w: 2 }));
      drawChart(ch2, { x: [0, 12], y: [0, 1], xl: "ширина щілини a, мкм", yl: "швидкість, відн.", legend: Object.entries(LIQ).filter(([k]) => k !== "wat").map(([k, o]) => ({ color: o.col, label: o.name })), series: ser, marks: [{ x: S.a, y: rate(S.a, LIQ[S.liq]), color: Theme.c.ink }] });
    }
    return {
      stages: [st, ch, ch2],
      frame(dt, time) {
        const sim = dt * 4;
        if (sim > 0) {
          S.t += sim; S.a += (target() - S.a) * (1 - Math.exp(-sim / 7)); if (S.t - (S.hist[S.hist.length - 1]?.[0] ?? 0) > .6) S.hist.push([S.t, S.a]);
          if (S.infPlay) { S.inf += rate(S.a, LIQ[S.liq]) * dt * 90; if (S.inf > 200) S.infPlay = false; }
          ch.dirty = true;
        }
        draw(time);
        if (ch.dirty) { charts(); ch.dirty = false; }
        const L = LIQ[S.liq];
        rd.set("a", fmt(S.a, 1), "мкм"); rd.set("k", fmt(Kg(), 0), "мМ"); rd.set("tg", fmt(target(), 1), "мкм"); rd.set("lq", L.name); rd.set("inf", S.inf < 1 ? "—" : `Ø ${fmt(Math.min(S.inf, 200) / 4, 0)} відн.`); rd.set("ac", L.ac > 50 ? "не проникає" : fmt(L.ac, 1), L.ac > 50 ? "" : "мкм");
      },
    };
  },
  cheat: `
<h3>Як продихи відкриваються й закриваються</h3>
<p><b>Продихи</b> — щілини в епідермі, обрамлені двома замикальними клітинами; крізь них рослина вбирає CO₂ й випаровує воду. Щілина відкривається, коли замикальні клітини набирають воду й вигинаються, і закривається, коли втрачають її. Рушій — <b>іони K<sup>+</sup></b>: на світлі (особливо синьому) в плазмалемі замикальних клітин працює H⁺-АТФаза; вона виводить протони, мембрана гіперполяризується, і K⁺ за градієнтом входить у клітину разом з Cl⁻ та малатом. Концентрація розчину в замикальних клітинах зростає (до сотень мМ), вода входить за осмосом, тургор збільшується — щілина відкривається.</p>
<div class="eq"><var>a</var>* = <var>a</var><sub>max</sub>·<var>s</var>(<var>I</var>)·<span class="fr"><span><var>K</var></span><span><var>K</var>+<var>K</var><sub>m</sub></span></span>·(1 − <span class="fr"><span>ABA</span><span>ABA+<var>K</var><sub>A</sub></span></span>)</div>
<p><b>Абсцизова кислота</b> (гормон стресу посухи) запускає вихід K⁺ і аніонів з замикальних клітин: тургор падає, продихи закриваються. Нестача K⁺ у середовищі обмежує відкривання.</p>
<h3>Метод інфільтрації Моліша</h3>
<p>Про стан продихів судять за здатністю органічних рідин, що добре змочують поверхню (етанол, ксилол, бензол), проникати у міжклітинники через продихову щілину. Чим ширша щілина, тим легше проходить рідина — на листку з’являється темна прозора пляма (міжклітинники заповнені рідиною). Рідини з більшою поверхневою енергією проникають лише в широкі щілини: у моделі кожній відповідає своя <b>критична ширина</b> <var>a</var><sub>c</sub>. Вода листок не змочує, тому крізь здорові продихи не інфільтрує.</p>
<p>Порівнюючи, у які рідини листок «пропускає», знаходять приблизну ширину щілини: щілина закрита — не проходить жодна; середня — проходять ксилол і бензол; широка — і спирт.</p>
<div class="fix"><b>Про модель.</b> Критичні ширини й швидкості — ілюстративні (якісна залежність між шириною щілини, змочуванням і швидкістю проникнення), а не виміряні величини.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому продихи відкриваються на світлі?</summary><p>Світло (синя частина спектра) активує H⁺-АТФазу замикальних клітин, вхід K⁺ підвищує осмотичний тиск, вода надходить і тургор розкриває щілину; крім того, фотосинтез зменшує вміст CO₂ у міжклітинниках.</p></details>
<details class="qa"><summary>Що відбувається з продихами під час посухи?</summary><p>Синтез абсцизової кислоти запускає вихід K⁺ й аніонів із замикальних клітин; вони втрачають воду, продихи закриваються і транспірація зменшується.</p></details>
<details class="qa"><summary>Чому ксилол «чутливіший» за спирт?</summary><p>Він добре змочує кутикулу й має меншу критичну ширину, тож проникає й у вузькі щілини, а спирт — лише в досить відкриті.</p></details>`,
});


/* ============ ЛР 15. Фітогормони: дозові залежності й антагонізм ============ */
App.add({
  n: 15, short: "Фітогормони: дози й антагонізм", tag: "ауксин · ГК · цитокінін/АБК · етилен",
  title: "Дія фітогормонів на ріст рослин: ауксин, гібереліни, цитокінін, абсцизова кислота й етилен",
  model: "відповідь = f(lg C) · ауксин: дзвоноподібна, оптимум різний для кореня й стебла · ГК: насичення · ЦК ↔ АБК: A_еф = A/(1 + ЦК/K) · етилен: потрійна реакція",
  build({ stageBox, ctrls, below }) {
    const MODES = [["aux", "Ауксин"], ["ga", "Гіберелін"], ["ck", "Цитокінін ↔ АБК"], ["eth", "Етилен"]];
    const S = { mode: "aux", lg: -6, ga: 20, gen: "dwarf", ck: 1, aba: 10, eth: 1, g: 1, play: true };
    const sig = (x) => 1 / (1 + Math.exp(-x));
    const stem = (lg) => Math.max(4, 100 + 95 * bell(lg, -5.3, 0.95) - 105 * sig((lg + 3.3) / 0.3));
    const root = (lg) => Math.max(4, 100 + 35 * bell(lg, -10, 1.0) - 100 * sig((lg + 7.8) / 0.45));
    const roots = (lg) => Math.max(0, 3 + 24 * bell(lg, -4.4, 0.75) - 3.2 * sig((lg + 2.9) / 0.25));   // кількість коренів у живця
    const germ = (ga, gen) => (gen === "dwarf" ? 12 : 55) + (gen === "dwarf" ? 83 : 40) * ga / (ga + 8);
    const height = (ga, gen) => 100 + (gen === "dwarf" ? 160 : 40) * ga / (ga + 15);
    const abaEff = (ck, aba) => aba / (1 + ck / 1.2);
    const germCK = (ck, aba) => 96 / (1 + Math.pow(abaEff(ck, aba) / 9, 2.2));
    const chlKeep = (ck, aba) => Math.max(5, 100 * (0.22 + 0.78 * ck / (ck + 0.9)) * (1 - 0.55 * aba / (aba + 25)));
    const ethLen = (e) => 100 * (1 - 0.7 * e / (e + 0.6)), ethThick = (e) => 100 * (1 + 1.3 * e / (e + 0.6));
    const st = new Stage(stageBox, { aspect: 1.6, minH: 300, maxH: 460, tag: "Відповідь рослин на гормон" });
    const rd = UI.reads(stageBox, [["a", ""], ["b", ""], ["c", ""]]);
    const rdEls = rd; // підписи змінюються за режимом
    const labels = stageBox.querySelectorAll(".reads .rd .k");
    UI.seg(ctrls, { label: "Гормон", value: S.mode, options: MODES, on: v => { S.mode = v; S.g = 0; sync(); ch.dirty = true; } });
    const sAux = UI.slider(ctrls, { id: "l15-lg", label: "Ауксин (ІОК), lg C [моль/л]", min: -12, max: -2, step: 0.1, value: S.lg, unit: "", fmt: v => fmt(v, 1), on: v => { S.lg = v; S.g = 0; ch.dirty = true; } });
    const sGA = UI.slider(ctrls, { id: "l15-ga", label: "Гіберелова кислота (ГК₃)", min: 0, max: 100, step: 1, value: S.ga, unit: "мг/л", on: v => { S.ga = v; S.g = 0; ch.dirty = true; } });
    const sGen = UI.select(ctrls, { id: "l15-gen", label: "Генотип", value: S.gen, options: [["dwarf", "карликова лінія (дефіцит ГК)"], ["wt", "нормальна лінія"]], on: v => { S.gen = v; S.g = 0; ch.dirty = true; } });
    const sCK = UI.slider(ctrls, { id: "l15-ck", label: "Цитокінін (6-БАП)", min: 0, max: 10, step: 0.1, value: S.ck, unit: "мкМ", fmt: v => fmt(v, 1), on: v => { S.ck = v; S.g = 0; ch.dirty = true; } });
    const sAB = UI.slider(ctrls, { id: "l15-ab", label: "Абсцизова кислота (АБК)", min: 0, max: 50, step: 1, value: S.aba, unit: "мкМ", on: v => { S.aba = v; S.g = 0; ch.dirty = true; } });
    const sET = UI.slider(ctrls, { id: "l15-et", label: "Етилен у повітрі", min: 0, max: 10, step: 0.1, value: S.eth, unit: "мкл/л", fmt: v => fmt(v, 1), on: v => { S.eth = v; S.g = 0; ch.dirty = true; } });
    const hideAll = { aux: [sAux], ga: [sGA, sGen], ck: [sCK, sAB], eth: [sET] };
    const wraps = (x) => (x.el || x).closest(".ctl");
    function sync() { const all = [sAux, sGA, sGen, sCK, sAB, sET]; for (const x of all) wraps(x).hidden = true; for (const x of hideAll[S.mode]) wraps(x).hidden = false;
      const L = { aux: ["Корінь, % контролю", "Стебло, % контролю", "Коренів у живця"], ga: ["Проростання насіння, %", "Висота пагона, %", "Генотип"], ck: ["Проростання насіння, %", "Хлорофіл у дисках, %", "Ефективна АБК, мкМ"], eth: ["Довжина гіпокотиля, %", "Товщина гіпокотиля, %", "Гачок"] }[S.mode];
      labels.forEach((el, i) => el.textContent = L[i]); }
    sync();
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Крива «доза — ефект»");
    const ch2 = UI.chart(row, "Додаткова залежність");

    function ground(c, W, H, y) { c.fillStyle = Theme.dark ? "#3b3023" : "#C8B08A"; c.fillRect(0, y, W, H - y); c.fillStyle = rgba("#000", .07); for (let i = 0; i < 90; i++) { const r = rng(i + 3); c.fillRect(r() * W, y + r() * (H - y), 2, 1.5); } }
    function seedlingAux(c, x, y0, len, col, grow) { c.strokeStyle = col; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 - len * grow); c.stroke(); c.lineCap = "butt"; c.lineWidth = 1; }
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear(); const g = smooth(0, 1, S.g);
      const gy = H * .62; ground(c, W, H, gy);
      if (S.mode === "aux") {
        const cols = ["корінь", "стебло", "живець"]; const w3 = W / 3;
        // корінь (проросток, корінь донизу)
        let x = w3 * .5; const rr = root(S.lg) / 100, ss = stem(S.lg) / 100, nr = roots(S.lg);
        c.strokeStyle = "#E7D3A0"; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(x, gy); c.lineTo(x, gy + (H - gy - 26) * Math.min(1, rr * .62) * g); c.stroke();
        c.strokeStyle = "#7BB05B"; c.beginPath(); c.moveTo(x, gy); c.lineTo(x, gy - 30); c.stroke();
        // стебло (етіольоване)
        x = w3 * 1.5; c.strokeStyle = "#8FBF68"; c.beginPath(); c.moveTo(x, gy); c.lineTo(x, gy - Math.min(130 * ss * .8, gy - 30) * g - 8); c.stroke(); c.fillStyle = "#4F9248"; c.beginPath(); c.ellipse(x + 5, gy - Math.min(130 * ss * .8, gy - 30) * g - 8, 11, 5, -.4, 0, 7); c.fill();
        // живець
        x = w3 * 2.5; c.strokeStyle = "#7BB05B"; c.beginPath(); c.moveTo(x, gy - 70); c.lineTo(x, gy + 6); c.stroke(); c.fillStyle = "#4F9248"; c.beginPath(); c.ellipse(x - 12, gy - 60, 13, 6, .4, 0, 7); c.ellipse(x + 12, gy - 70, 13, 6, -.4, 0, 7); c.fill();
        c.lineWidth = 2; c.strokeStyle = "#E7D3A0"; const n = Math.round(nr * g); for (let i = 0; i < n; i++) { const a = (i / Math.max(1, n) - .5) * 2.1, L = 24 + (i % 3) * 8; c.beginPath(); c.moveTo(x, gy + 3); c.quadraticCurveTo(x + Math.sin(a) * L * .6, gy + 3 + L * .4, x + Math.sin(a) * L, gy + 3 + L * .9 * Math.cos(a * .5)); c.stroke(); }
        c.lineCap = "butt"; c.lineWidth = 1; cols.forEach((t, i) => Draw.text(c, t, w3 * (i + .5), H - 8, { align: "center", color: T.muted, size: 11 }));
        Draw.text(c, `lg C = ${fmt(S.lg, 1)}`, 10, 44, { color: T.ink, size: 12 });
      } else if (S.mode === "ga") {
        // чашка з насінням + рослини
        const px = W * .04, pw = W * .5, py = 30, ph = H - 60;
        c.fillStyle = Theme.dark ? "#223024" : "#F3F7E8"; roundRect(c, px, py, pw, ph, 12); c.fill(); c.strokeStyle = T.rule; c.stroke();
        const N = 40, gp = germ(S.ga, S.gen) / 100; for (let i = 0; i < N; i++) { const r = rng(i * 7 + 1), sx = px + 18 + (i % 8) * (pw - 36) / 7.2 + (r() - .5) * 8, sy = py + 18 + Math.floor(i / 8) * (ph - 36) / 4.4 + (r() - .5) * 8; const germ_i = (i + .5) / N < gp * g; c.fillStyle = "#B58A52"; c.beginPath(); c.ellipse(sx, sy, 6, 4, .5, 0, 7); c.fill(); if (germ_i) { c.strokeStyle = "#F4EBCF"; c.lineWidth = 2; c.beginPath(); c.moveTo(sx + 4, sy + 2); c.quadraticCurveTo(sx + 12, sy + 6, sx + 14 * g, sy + 3 + 6 * g); c.stroke(); c.lineWidth = 1; } }
        Draw.text(c, "Насіння в чашці Петрі", px + 8, py + ph + 14, { color: T.ink, size: 11 });
        const hh = height(S.ga, S.gen) / 100, bx = W * .72;
        c.save(); c.beginPath(); c.rect(W * .58, 0, W * .42, H); c.clip(); ground(c, W, H, gy);
        for (let k = 0; k < 2; k++) { const x = bx - 24 + k * 48; c.strokeStyle = "#7CB460"; c.lineWidth = 6; c.lineCap = "round"; c.beginPath(); c.moveTo(x, gy); c.lineTo(x, gy - 55 * hh * g * (k ? 1 : 1)); c.stroke(); for (let n = 0; n < 4; n++) { const y = gy - 12 - n * 18 * hh * g; c.fillStyle = "#4F9248"; c.beginPath(); c.ellipse(x + (n % 2 ? 10 : -10), y, 10, 4, n % 2 ? -.4 : .4, 0, 7); c.fill(); } }
        c.restore(); c.lineCap = "butt"; c.lineWidth = 1; Draw.text(c, "Висота пагона", W * .72, 44, { align: "center", color: T.ink, size: 11 });
      } else if (S.mode === "ck") {
        const px = W * .04, pw = W * .5, py = 30, ph = H - 60; c.fillStyle = Theme.dark ? "#223024" : "#F3F7E8"; roundRect(c, px, py, pw, ph, 12); c.fill(); c.strokeStyle = T.rule; c.stroke();
        const N = 36, gp = germCK(S.ck, S.aba) / 100; for (let i = 0; i < N; i++) { const r = rng(i * 11 + 5), sx = px + 20 + (i % 6) * (pw - 40) / 5, sy = py + 22 + Math.floor(i / 6) * (ph - 44) / 5; const ok = (i * 0.61803 % 1) < gp * g; c.fillStyle = "#B58A52"; c.beginPath(); c.ellipse(sx, sy, 6, 4, r(), 0, 7); c.fill(); if (ok) { c.strokeStyle = "#F4EBCF"; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + 8, sy + 3, sx + 12 * g, sy + 8 * g); c.stroke(); c.lineWidth = 1; } }
        Draw.text(c, "Проростання насіння", px + 8, py + ph + 14, { color: T.ink, size: 11 });
        const keep = chlKeep(S.ck, S.aba) / 100; for (let k = 0; k < 4; k++) { const x = W * .66 + (k % 2) * 62, y = 70 + Math.floor(k / 2) * 80; const mix = 1 - keep * (.8 + .2 * g); const col = mixHex(Theme.dark ? "#5FA050" : "#4E9C3C", "#D9C940", clamp(1 - keep, 0, 1) * g + (1 - g) * 0); c.fillStyle = col; c.beginPath(); c.arc(x, y, 26, 0, 7); c.fill(); c.strokeStyle = rgba("#000", .25); c.stroke(); void mix; }
        fitText(c, "Листкові диски (старіння)", W * .76, 44, W * .46, { align: "center", color: T.ink, size: 11 });
      } else {
        const lenF = ethLen(S.eth) / 100, thF = ethThick(S.eth) / 100; const hook = cl01(S.eth / 2.5);
        c.fillStyle = Theme.dark ? "#161c14" : "#2C3B2A"; c.fillRect(0, 0, W, gy); ground(c, W, H, gy);
        for (let k = 0; k < 5; k++) { const x = W * (.12 + k * .18) + 0; const L = Math.min(150, gy - 84) * lenF * g + 10, th = 3 + 5 * (thF - 1) * .8 + 2, xx = x; c.strokeStyle = "#E8DDA0"; c.lineWidth = th; c.lineCap = "round"; c.beginPath(); c.moveTo(xx, gy); c.lineTo(xx, gy - L); const rr = 8 + 5 * hook; c.arc(xx + rr, gy - L, rr, Math.PI, Math.PI * (1 + .9 * Math.max(.3, hook) * g) , false); c.stroke(); }
        c.lineCap = "butt"; c.lineWidth = 1; fitText(c, "Етіольовані проростки в темряві", 12, 44, W - 24, { color: "#cfe0c8", size: 11 });
        fitText(c, "укорочення · потовщення · посилений апікальний гачок", W - 12, 62, W - 24, { align: "right", color: "#cfe0c8", size: 10.5 });
      }
    }
    function charts() {
      const xs = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
      if (S.mode === "aux") {
        drawChart(ch, { x: [-12, -2], y: [0, 200], xl: "lg C", yl: "% контролю", hl: [{ y: 100, color: Theme.c.muted, label: "контроль" }], legend: [{ color: Theme.c.antho, label: "корінь" }, { color: Theme.c.chl, label: "стебло" }], series: [{ pts: xs(-12, -2, 200).map(x => [x, root(x)]), color: Theme.c.antho, w: 2.4 }, { pts: xs(-12, -2, 200).map(x => [x, stem(x)]), color: Theme.c.chl, w: 2.4 }], marks: [{ x: S.lg, y: root(S.lg), color: Theme.c.antho }, { x: S.lg, y: stem(S.lg), color: Theme.c.chl }] });
        drawChart(ch2, { x: [-12, -2], y: [0, 30], xl: "lg C", yl: "коренів на живці", series: [{ pts: xs(-12, -2, 200).map(x => [x, roots(x)]), color: Theme.c.data, w: 2.4 }], marks: [{ x: S.lg, y: roots(S.lg), color: Theme.c.data }] });
        rd.set("a", fmt(root(S.lg), 0), "%"); rd.set("b", fmt(stem(S.lg), 0), "%"); rd.set("c", fmt(roots(S.lg), 0), "шт.");
      } else if (S.mode === "ga") {
        drawChart(ch, { x: [0, 100], y: [0, 100], xl: "ГК₃, мг/л", yl: "проростання, %", legend: [{ color: Theme.c.antho, label: "карликова" }, { color: Theme.c.chl, label: "нормальна" }], series: [{ pts: xs(0, 100, 100).map(x => [x, germ(x, "dwarf")]), color: Theme.c.antho, w: 2.4 }, { pts: xs(0, 100, 100).map(x => [x, germ(x, "wt")]), color: Theme.c.chl, w: 2.4 }], marks: [{ x: S.ga, y: germ(S.ga, S.gen), color: Theme.c.ink }] });
        drawChart(ch2, { x: [0, 100], y: [80, 280], xl: "ГК₃, мг/л", yl: "висота, % контролю", series: [{ pts: xs(0, 100, 100).map(x => [x, height(x, "dwarf")]), color: Theme.c.antho, w: 2.4 }, { pts: xs(0, 100, 100).map(x => [x, height(x, "wt")]), color: Theme.c.chl, w: 2.4 }], marks: [{ x: S.ga, y: height(S.ga, S.gen), color: Theme.c.ink }] });
        rd.set("a", fmt(germ(S.ga, S.gen), 0), "%"); rd.set("b", fmt(height(S.ga, S.gen), 0), "%"); rd.set("c", S.gen === "dwarf" ? "карликовий" : "нормальний");
      } else if (S.mode === "ck") {
        const abs = xs(0, 50, 100);
        drawChart(ch, { x: [0, 50], y: [0, 100], xl: "АБК, мкМ", yl: "проростання, %", legend: [{ color: Theme.c.antho, label: "без ЦК" }, { color: Theme.c.chl, label: "з ЦК: 5 мкМ" }], series: [{ pts: abs.map(a => [a, germCK(0, a)]), color: Theme.c.antho, w: 2.4 }, { pts: abs.map(a => [a, germCK(5, a)]), color: Theme.c.chl, w: 2.4 }], marks: [{ x: S.aba, y: germCK(S.ck, S.aba), color: Theme.c.ink }] });
        const cks = xs(0, 10, 100);
        drawChart(ch2, { x: [0, 10], y: [0, 100], xl: "цитокінін, мкМ", yl: "хлорофіл, %", legend: [{ color: Theme.c.chl, label: "без АБК" }, { color: Theme.c.antho, label: "АБК 25 мкМ" }], series: [{ pts: cks.map(k => [k, chlKeep(k, 0)]), color: Theme.c.chl, w: 2.4 }, { pts: cks.map(k => [k, chlKeep(k, 25)]), color: Theme.c.antho, w: 2.4 }], marks: [{ x: S.ck, y: chlKeep(S.ck, S.aba), color: Theme.c.ink }] });
        rd.set("a", fmt(germCK(S.ck, S.aba), 0), "%"); rd.set("b", fmt(chlKeep(S.ck, S.aba), 0), "%"); rd.set("c", fmt(abaEff(S.ck, S.aba), 1), "мкМ");
      } else {
        const es = xs(0, 10, 100);
        drawChart(ch, { x: [0, 10], y: [0, 100], xl: "етилен, мкл/л", yl: "довжина, % контролю", series: [{ pts: es.map(e => [e, ethLen(e)]), color: Theme.c.antho, w: 2.4 }], marks: [{ x: S.eth, y: ethLen(S.eth), color: Theme.c.antho }] });
        drawChart(ch2, { x: [0, 10], y: [90, 250], xl: "етилен, мкл/л", yl: "товщина, % контролю", series: [{ pts: es.map(e => [e, ethThick(e)]), color: Theme.c.data, w: 2.4 }], marks: [{ x: S.eth, y: ethThick(S.eth), color: Theme.c.data }] });
        rd.set("a", fmt(ethLen(S.eth), 0), "%"); rd.set("b", fmt(ethThick(S.eth), 0), "%"); rd.set("c", S.eth > 0.8 ? "виражений" : S.eth > 0.2 ? "слабкий" : "немає");
      }
    }
    return { stages: [st, ch, ch2], frame(dt, time) { if (dt > 0 && S.g < 1) { S.g = Math.min(1, S.g + dt / 2.2); } else if (dt === 0 && S.g === 0) S.g = 1; draw(time); if (ch.dirty) { charts(); ch.dirty = false; } void rdEls; } };
  },
  cheat: `
<h3>Дія гормону залежить від дози й органа</h3>
<p><b>Фітогормони</b> — органічні речовини, які в дуже малих кількостях регулюють ріст і розвиток. Для кожного з них відповідь має вигляд кривої «доза — ефект»; одна й та сама концентрація може стимулювати одні органи й гальмувати інші.</p>
<h3>Ауксини</h3>
<p>Ауксин (індоліл-3-оцтова кислота, <b>ІОК</b>) стимулює розтягнення клітин. Оптимальні концентрації для кореня на кілька порядків нижчі, ніж для стебла: корінь найчутливіший, тому вже помірні дози його гальмують, а стебло ще росте. Висока доза гальмує всі органи (основа дії гербіцидів-ауксинів). Ауксин також стимулює утворення додаткових коренів у живців — на цьому ґрунтується вкорінення живців.</p>
<h3>Гібереліни</h3>
<p>Гібереліни (<b>ГК</b>) стимулюють розтягнення міжвузлів і виводять насіння зі спокою, активуючи гідролази (зокрема амілазу) в ендоспермі. Карликові лінії з дефіцитом ГК відповідають на обробку різким збільшенням висоти, а нормальні — слабко: рівень гормону в них уже близький до насичення.</p>
<h3>Цитокініни й абсцизова кислота: антагонізм</h3>
<p><b>Цитокініни</b> стимулюють поділ клітин і затримують старіння листків (хлорофіл довго зберігається); <b>абсцизова кислота (АБК)</b> гальмує проростання насіння й прискорює старіння. Їхній вплив протилежний, тому відповідь визначає співвідношення гормонів: цитокінін «знімає» гальмування АБК. У моделі це відображено як зменшення ефективної АБК: A<sub>еф</sub> = A / (1 + ЦК/K).</p>
<h3>Етилен</h3>
<p>Етилен — газоподібний гормон, що гальмує розтягнення і спонукає до радіального росту. Етіольовані проростки в його присутності виявляють «потрійну реакцію»: вкорочення і потовщення гіпокотиля та посилений апікальний гачок.</p>
<div class="fix"><b>Про модель.</b> Положення оптимумів і форми кривих якісно відповідають описаним у літературі закономірностям; числові значення ілюстративні.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому корінь «чутливіший» до ауксину, ніж стебло?</summary><p>Оптимум розтягнення кореня припадає на значно менші концентрації; помірна для стебла доза вже гальмує ріст кореня (частково через етилен, який індукує ауксин).</p></details>
<details class="qa"><summary>Як ГК виводять насіння зі спокою?</summary><p>Вони індукують синтез гідролаз, що мобілізують запасні речовини, і ослаблюють стримуючу дію АБК.</p></details>
<details class="qa"><summary>Що означає «потрійна реакція»?</summary><p>Реакція етіольованого проростка на етилен: вкорочення гіпокотиля, його потовщення та утворення посиленого гачка.</p></details>`,
});

/* ============ ЛР 16. Зони росту кореня й стебла ============ */
App.add({
  n: 16, short: "Зони росту кореня й стебла", tag: "швидкість розтягнення · мітки Сакса",
  title: "Визначення зон росту в органах рослин: корінь і стебло",
  model: "V(x) = ∫₀ˣ r(u)du · dx/dt = V(x) · r(s) = R_max·exp[−((s − s₀)/w)²] · Δlᵢ = (xᵢ₊₁ − xᵢ)(t) − l₀",
  build({ stageBox, ctrls, below }) {
    const ORG = { root: { name: "корінь", unit: "мм", l0: 1, n: 12, s0: 3.6, w: 2.1, Rm: 0.5, tipMax: 14, color: "#EBDDB5" }, stem: { name: "стебло", unit: "мм", l0: 5, n: 12, s0: 26, w: 15, Rm: 0.07, tipMax: 90, color: "#9BC96F" } };
    const S = { org: "root", t: 0, T: 22, aux: 0, play: false, spd: 1.2 };
    const Q = () => Math.pow(2, (S.T - 22) / 10) * (S.org === "root" ? 1 - 0.7 * sig((Math.log10(Math.max(S.aux, 1e-3)) - (-0.3)) / .35) : 1 + .2 * bell(Math.log10(Math.max(S.aux, 1e-3)), 0.5, .8));
    const sig = (x) => 1 / (1 + Math.exp(-x));
    const o = () => ORG[S.org];
    const r = (s) => { const O = o(); return Q() * O.Rm * Math.exp(-(((s - O.s0) / O.w) ** 2)) * smooth(0, O.l0 * .6, s); };
    const Vel = (x) => { let a = 0; const n = Math.max(8, Math.ceil(x / 0.25)), d = x / n; for (let i = 0; i < n; i++) a += r((i + .5) * d) * d; return a; };
    function positions(t) { // положення міток (від кінчика) після часу t, год
      const O = o(), out = []; for (let i = 0; i <= O.n; i++) { let x = i * O.l0; const nst = Math.max(20, Math.ceil(t / 0.1)), dt = t / nst; for (let k = 0; k < nst; k++) { const v1 = Vel(x), v2 = Vel(x + v1 * dt / 2); x += v2 * dt; } out.push(x); } return out; }
    const st = new Stage(stageBox, { aspect: 1.5, minH: 320, maxH: 500, tag: "Мічений орган" });
    const rd = UI.reads(stageBox, [["t", "Час, год"], ["dl", "Приріст органа"], ["zone", "Зона найшвидшого росту (від кінчика)"], ["sp", "Швидкість росту органа"]]);
    UI.seg(ctrls, { label: "Орган", value: S.org, options: [["root", "Корінь"], ["stem", "Стебло"]], on: v => { S.org = v; S.t = 0; ch.dirty = true; } });
    const tS = UI.slider(ctrls, { id: "l16-t", label: "Час після нанесення міток", min: 0, max: 24, step: 0.25, value: 0, unit: "год", fmt: v => fmt(v, 2), on: v => { S.t = v; S.play = false; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l16-T", label: "Температура", min: 8, max: 38, step: 1, value: S.T, unit: "°C", on: v => { S.T = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l16-a", label: "Ауксин у середовищі", min: 0, max: 10, step: 0.1, value: S.aux, unit: "відн.", fmt: v => fmt(v, 1), on: v => { S.aux = v; ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Спостерігати ріст", pri: true, on: () => { S.t = 0; tS.set(0); S.play = true; ch.dirty = true; } }]);
    ctrls.append(h("p", { class: "note" }, "Мітки наносять через однакові інтервали (корінь — 1 мм, стебло — 5 мм). Найбільше розтягуються сегменти в зоні розтягнення; на верхівці й у зрілій частині мітки майже не віддаляються."));
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Приріст кожного сегмента, мм");
    const ch2 = UI.chart(row, "Швидкість розтягнення r(s) і швидкість руху міток V(x)");

    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear(); const O = o(), pos = positions(S.t);
      const horiz = W > 520; const isRoot = S.org === "root";
      const scale = horiz ? (W - 150) / (O.tipMax + (O.n * O.l0 > O.tipMax ? 0 : 0) + Math.max(0, pos[O.n] - O.n * O.l0) + 4) : (H - 90) / (O.tipMax + 10);
      const total = Math.max(O.n * O.l0 + 4, pos[O.n] + 3);
      const sc = horiz ? (W - 160) / Math.max(total, O.tipMax) : (H - 80) / Math.max(total, O.tipMax); void scale;
      const x0 = horiz ? 90 : W / 2, y0 = horiz ? H / 2 : 50;
      const P = (s) => horiz ? [x0 + s * sc, y0] : [x0, y0 + s * sc];
      // орган: тіло як смуга шириною w
      const wd = isRoot ? 22 : 18;
      const [ax, ay] = P(0), [bx, by] = P(total + 2);
      const grad = horiz ? c.createLinearGradient(0, y0 - wd / 2, 0, y0 + wd / 2) : c.createLinearGradient(x0 - wd / 2, 0, x0 + wd / 2, 0);
      grad.addColorStop(0, Theme.dark ? "#8f8660" : mixHex(O.color, "#ffffff", .3)); grad.addColorStop(.5, O.color); grad.addColorStop(1, Theme.dark ? "#6d6644" : mixHex(O.color, "#000000", .25));
      c.fillStyle = grad;
      if (horiz) { roundRect(c, ax - 10, y0 - wd / 2, (bx - ax) + 10, wd, wd / 2); c.fill(); } else { roundRect(c, x0 - wd / 2, ay - 10, wd, (by - ay) + 10, wd / 2); c.fill(); }
      // клітини, що розтягуються
      for (let i = 0; i < O.n; i++) { const [p1x, p1y] = P(pos[i]), [p2x, p2y] = P(pos[i + 1]); c.fillStyle = i % 2 ? rgba("#ffffff", .08) : rgba("#000000", .05); if (horiz) c.fillRect(p1x, y0 - wd / 2 + 2, p2x - p1x, wd - 4); else c.fillRect(x0 - wd / 2 + 2, p1y, wd - 4, p2y - p1y); }
      // мітки
      for (let i = 0; i <= O.n; i++) { const [px, py] = P(pos[i]); c.strokeStyle = i % 2 ? "#C03A2B" : "#2E6FB5"; c.lineWidth = 2.4; c.beginPath(); if (horiz) { c.moveTo(px, y0 - wd / 2 - 6); c.lineTo(px, y0 + wd / 2 + 6); } else { c.moveTo(x0 - wd / 2 - 6, py); c.lineTo(x0 + wd / 2 + 6, py); } c.stroke(); if (i % 2 === 0 || S.t === 0) Draw.text(c, String(i * O.l0), horiz ? px : x0 + wd / 2 + 10, horiz ? y0 - wd / 2 - 14 : py + 4, { size: 10, color: T.muted, align: horiz ? "center" : "left" }); } c.lineWidth = 1;
      // кінчик
      const [tx, ty] = P(0); c.fillStyle = isRoot ? "#8B6A3C" : "#6FAE45"; c.beginPath(); if (horiz) c.arc(tx - 6, y0, wd / 2 + 1, Math.PI / 2, -Math.PI / 2, false); else c.arc(x0, ty - 6, wd / 2 + 1, Math.PI, 0, false); c.fill();
      Draw.text(c, isRoot ? "кореневий чохлик · кінчик" : "верхівка стебла", horiz ? tx - 22 : x0 + wd, horiz ? y0 + wd / 2 + 26 : ty - 8, { size: 10.5, color: T.muted, align: horiz ? "left" : "left" });
      // зона найшвидшого росту: підсвітка
      const sMax = O.s0; const [zx, zy] = P(sMax); c.fillStyle = rgba(T.chl, .25); if (horiz) { c.fillRect(zx - O.w * sc * .8, y0 - wd / 2 - 18, O.w * sc * 1.6, wd + 36); } else { c.fillRect(x0 - wd / 2 - 20, zy - O.w * sc * .8, wd + 40, O.w * sc * 1.6); }
      Draw.text(c, `довжина від кінчика: ${fmt(pos[O.n], 1)} мм (було ${O.n * O.l0})`, 12, H - 12, { color: T.ink, size: 11.5 });
      void time;
    }
    function charts() {
      const O = o(), pos = positions(S.t); const inc = []; for (let i = 0; i < O.n; i++) inc.push([i + 1, (pos[i + 1] - pos[i]) - O.l0]);
      const mx = Math.max(.5, ...inc.map(p => p[1])) * 1.15;
      drawChart(ch, { x: [0.4, O.n + .6], y: [0, S.t === 0 ? 1 : mx], xt: Array.from({ length: O.n }, (_, i) => i + 1), xl: `сегмент (від кінчика, по ${O.l0} мм)`, yl: "приріст, мм", series: [{ pts: inc, bars: true, color: rgba(Theme.c.chl, .75), bw: 14 }] });
      const xmax = O.tipMax * 1.2, rs = [], vs = []; for (let k = 0; k <= 60; k++) { const x = xmax * k / 60; rs.push([x, r(x)]); vs.push([x, Vel(x)]); }
      const vm = Math.max(...vs.map(p => p[1]), 1e-6), rm = Math.max(...rs.map(p => p[1]), 1e-6);
      drawChart(ch2, { x: [0, xmax], y: [0, 1.05], xl: "відстань від кінчика, мм", yl: "відносні одиниці", legend: [{ color: Theme.c.antho, label: "r(s) відн." }, { color: Theme.c.data, label: "V(x) відн." }, { color: Theme.c.chl, label: "максимум r (пунктир)" }], series: [{ pts: rs.map(p => [p[0], p[1] / rm]), color: Theme.c.antho, w: 2.4 }, { pts: vs.map(p => [p[0], p[1] / vm]), color: Theme.c.data, w: 2.4 }], vl: [{ x: O.s0, color: Theme.c.chl }] });
      rd.set("t", fmt(S.t, 2)); rd.set("dl", fmt(pos[O.n] - O.n * O.l0, 1), "мм"); rd.set("zone", `${fmt(Math.max(0, O.s0 - O.w), 1)}–${fmt(O.s0 + O.w, 1)}`, "мм"); rd.set("sp", fmt(Vel(O.tipMax * 2), 2), "мм/год");
    }
    return { stages: [st, ch, ch2], frame(dt, time) { if (S.play && dt > 0) { S.t = Math.min(24, S.t + dt * S.spd * 2.2); tS.set(S.t); ch.dirty = true; if (S.t >= 24) S.play = false; } draw(time); if (ch.dirty) { charts(); ch.dirty = false; } } };
  },
  cheat: `
<h3>Де саме росте орган</h3>
<p>Ріст органа не однаковий по всій довжині. У корені <b>меристема</b> (зона поділу клітин) лежить біля самого кінчика, за нею — <b>зона розтягнення</b> (клітини швидко витягуються за рахунок поглинання води), далі — зона диференціації (кореневі волоски, провідні тканини), де росту вже немає. У стеблі зона росту довша і розташована під верхівкою.</p>
<h3>Метод міток</h3>
<p>Щоб знайти зони росту, на орган наносять тонкі мітки через рівні інтервали (корінь — 1 мм, стебло — 5 мм), а через певний час вимірюють відстані між ними. Сегмент, що перебуває в зоні розтягнення, витягується найбільше; сегменти меристеми й зрілої зони майже не змінюються.</p>
<div class="eq"><var>V</var>(<var>x</var>) = <span class="int">∫</span><sub>0</sub><sup><var>x</var></sup> <var>r</var>(<var>u</var>) d<var>u</var> &nbsp;·&nbsp; <span class="fr"><span>d<var>x</var></span><span>d<var>t</var></span></span> = <var>V</var>(<var>x</var>)</div>
<dl class="vars"><dt>r(s)</dt><dd>відносна швидкість розтягнення елемента на відстані s від кінчика (1/год)</dd><dt>V(x)</dt><dd>швидкість, з якою віддаляється від кінчика мітка, що лежить на відстані x; вона зростає в зоні розтягнення й далі стала</dd></dl>
<p>Швидкість росту органа дорівнює V для зрілої частини — це сума внесків усіх елементів зони. Температура змінює її приблизно вдвічі на кожні 10 °C (Q<sub>10</sub> ≈ 2); ауксин у високій концентрації гальмує ріст кореня, але не стебла.</p>
<div class="fix"><b>Про модель.</b> Профіль швидкості розтягнення подано гаусовою кривою; положення й ширина зони та швидкості ілюстративні й відрізняються для різних рослин.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому мітки біля самого кінчика кореня майже не розходяться?</summary><p>Там меристема: клітини діляться, але ще не розтягуються. Розходження міток створюють клітини зони розтягнення.</p></details>
<details class="qa"><summary>Чим зона росту стебла відрізняється від кореневої?</summary><p>Вона довша, розташована далі від верхівки й складається з кількох міжвузлів, що ростуть уставним (інтеркалярним) ростом.</p></details>
<details class="qa"><summary>Як розрахувати швидкість росту органа за мітками?</summary><p>Додати прирости всіх сегментів і поділити на час: це й є V для зрілої частини органа.</p></details>`,
});

/* ============ ЛР 17. Геотропізм і клиностат ============ */
App.add({
  n: 17, short: "Геотропізм і клиностат", tag: "статоліти · перерозподіл ауксину",
  title: "Дослідження геотропічної реакції рослин: статоліти, ауксин і клиностат",
  model: "dG/dt = (g·n(t) − G)/τ_s · dα/dt = ±k·(−R_y)·cos α · R = Rot(ωt)·G · |G| = 1/√(1 + (ωτ_s)²)",
  build({ stageBox, ctrls, below }) {
    const S = { g: 1, rpm: 0, clino: false, alphaS: 0, alphaR: 0, Gx: 0, Gy: -1, spin: 0, t: 0, play: false, hist: [], tau: 150, speed: 25 };
    const KS = 0.28, KR = 0.22;  // °/хв
    function reset() { S.alphaS = 0; S.alphaR = 0; S.Gx = 0; S.Gy = -1 * 0; S.spin = 0; S.t = 0; S.hist = [[0, 0, 0]]; S.play = true; }
    reset(); S.play = false;
    const st = new Stage(stageBox, { aspect: 1.6, minH: 310, maxH: 480, tag: "Горизонтальний проросток" });
    const rd = UI.reads(stageBox, [["t", "Час, год"], ["as", "Кут стебла"], ["ar", "Кут кореня"], ["G", "|G| у статоцитах"], ["aux", "Ауксин знизу : зверху"]]);
    UI.slider(ctrls, { id: "l17-g", label: "Сила тяжіння g", min: 0, max: 2, step: 0.05, value: S.g, unit: "g", fmt: v => fmt(v, 2), on: v => { S.g = v; } });
    UI.check(ctrls, { id: "l17-c", label: "Клиностат (обертання навколо осі проростка)", value: false, on: v => { S.clino = v; reset(); S.play = true; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l17-r", label: "Швидкість обертання клиностата", min: 0.01, max: 10, step: 0.01, value: 2, unit: "об/хв", fmt: v => fmt(v, 2), on: v => { S.rpm = v; reset(); S.play = true; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l17-tau", label: "Час осідання статолітів τ", min: 30, max: 600, step: 10, value: S.tau, unit: "с", on: v => { S.tau = v; ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Покласти горизонтально", pri: true, on: () => { reset(); S.play = true; ch.dirty = true; } }]);
    S.rpm = 2;
    ctrls.append(h("p", { class: "note" }, "Без обертання статоліти осідають на нижню стінку клітин, ауксин накопичується на нижньому боці: стебло згинається вгору, корінь — вниз. Клиностат постійно змінює напрям «низу» й гасить реакцію."));
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Кут вигину органів від горизонталі (°)");
    const ch2 = UI.chart(row, "Подавлення реакції залежно від швидкості обертання");
    const stim = (rpm) => { const w = 2 * Math.PI * rpm / 60; return 1 / Math.sqrt(1 + (w * S.tau) ** 2); };

    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear(); const nar = W < 520;
      // агаровий блок
      const bx = 14, by = 14, bw = nar ? W - 28 : W * .62, bh = nar ? H * .55 : H - 28;
      c.fillStyle = Theme.dark ? "rgba(120,160,120,.12)" : "rgba(200,225,190,.55)"; roundRect(c, bx, by, bw, bh, 10); c.fill(); c.strokeStyle = T.rule; c.stroke();
      // зерно/вузол у центрі
      const cx = bx + bw * .5, cy = by + bh * .5, L = Math.min(bw * .42, 150);
      // стебло (вправо), корінь (вліво) — початково горизонтально; вигин плавний
      const bend = (a, dir) => { // повертає ламану з кривизною, кут кінця = a (°)
        const pts = [[cx, cy]]; let ang = 0, x = cx, y = cy; const n = 24; for (let i = 1; i <= n; i++) { ang = (a * Math.pow(i / n, 1.6)) * Math.PI / 180; x += dir * Math.cos(ang) * L / n; y -= Math.sin(ang) * L / n; pts.push([x, y]); } return pts; };
      const stemPts = bend(S.alphaS, 1), rootPts = bend(S.alphaR, -1);
      const rot = (S.clino ? S.spin : 0);
      const line = (pts, col, w, cap) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.lineCap = "butt"; c.lineWidth = 1; };
      line(rootPts, "#EBDDB5", 8); line(stemPts, "#8FC468", 8);
      // сім'ядолі та кореневий чохлик
      const [sx, sy] = stemPts[stemPts.length - 1], [rx, ry] = rootPts[rootPts.length - 1];
      c.fillStyle = "#4F9248"; c.beginPath(); c.ellipse(sx + 6, sy - 5, 14, 6, -.5, 0, 7); c.fill(); c.fillStyle = "#8B6A3C"; c.beginPath(); c.arc(rx, ry, 5.5, 0, 7); c.fill();
      // клиностат: обертальна стрілка
      if (S.clino) { c.strokeStyle = T.antho; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 24, rot, rot + 4.2); c.stroke(); c.lineWidth = 1; const a = rot + 4.2; c.fillStyle = T.antho; c.beginPath(); c.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24); c.lineTo(cx + Math.cos(a - .3) * 30, cy + Math.sin(a - .3) * 30); c.lineTo(cx + Math.cos(a + .35) * 28, cy + Math.sin(a + .35) * 28); c.fill(); }
      Draw.text(c, "корінь", cx - L - 10, cy + 30, { size: 11, color: T.muted, align: "center" }); Draw.text(c, "стебло", cx + L, cy + 30, { size: 11, color: T.muted, align: "center" });
      // вектор g
      c.strokeStyle = T.muted; c.beginPath(); c.moveTo(bx + 20, by + 24); c.lineTo(bx + 20, by + 56); c.stroke(); c.fillStyle = T.muted; c.beginPath(); c.moveTo(bx + 20, by + 64); c.lineTo(bx + 14, by + 52); c.lineTo(bx + 26, by + 52); c.fill(); Draw.text(c, `g = ${fmt(S.g, 2)}`, bx + 34, by + 46, { size: 11, color: T.muted });
      // статоцит
      const zx = nar ? W / 2 : bx + bw + (W - bx - bw) / 2, zy = nar ? by + bh + (H - by - bh) / 2 + 4 : by + bh * .45, R = nar ? Math.min(52, (H - by - bh) / 2 - 12) : Math.min(82, (W - bx - bw) / 2 - 12);
      c.fillStyle = Theme.dark ? "#2c3a2a" : "#EAF3DC"; c.strokeStyle = Theme.dark ? "#8fb06d" : "#5E8F4A"; c.lineWidth = 3; roundRect(c, zx - R, zy - R * .85, R * 2, R * 1.7, 12); c.fill(); c.stroke(); c.lineWidth = 1;
      const gm = Math.hypot(S.Gx, S.Gy), ux = gm > 1e-3 ? S.Gx / gm : 0, uy = gm > 1e-3 ? S.Gy / gm : 0, mag = Math.min(1, gm);
      // ядро
      c.fillStyle = "#8A7BB5"; c.beginPath(); c.arc(zx - ux * R * .35 * 0, zy - R * .1, R * .2, 0, 7); c.fill();
      const rr = rng(21); for (let i = 0; i < 14; i++) { const bx0 = (rr() - .5) * R * 1.3, by0 = (rr() - .5) * R * 1.1; // осідання у напрямі G (у системі клітини; центр спрайту)
        const sx2 = clamp(bx0 + ux * R * .5 * mag * (.6 + .4 * rr()), -R * .85, R * .85), sy2 = clamp(by0 + uy * R * .5 * mag * (.6 + .4 * rr()) * -1 * -1, -R * .68, R * .68);
        c.fillStyle = "#F4E7B4"; c.strokeStyle = "#B59A4A"; c.beginPath(); c.arc(zx + sx2, zy + sy2, 5, 0, 7); c.fill(); c.stroke(); }
      Draw.text(c, "статоцит", zx, zy - R * .85 - 10, { align: "center", size: 11, color: T.ink });
      Draw.text(c, "статоліти (амілопласти) осідають", zx, zy + R * .85 + 14, { align: "center", size: 10, color: T.muted });
      void time;
    }
    function charts() {
      const m = S.hist.map(p => [p[0], p[1]]), r = S.hist.map(p => [p[0], p[2]]);
      drawChart(ch, { x: [0, 12], y: [-95, 95], xl: "год", yl: "кут, °", hl: [{ y: 0, color: Theme.c.muted }], legend: [{ color: Theme.c.chl, label: "стебло" }, { color: Theme.c.antho, label: "корінь" }], series: [{ pts: m, color: Theme.c.chl, w: 2.4 }, { pts: r, color: Theme.c.antho, w: 2.4 }] });
      const rp = []; for (let k = 0; k <= 80; k++) { const v = Math.pow(10, -2 + 3 * k / 80); rp.push([v, stim(v)]); }
      drawChart(ch2, { x: [0.01, 10], y: [0, 1.05], xlog: true, xl: "об/хв", yl: "|G| відн.", series: [{ pts: rp, color: Theme.c.data, w: 2.4 }], marks: S.clino ? [{ x: S.rpm, y: stim(S.rpm), color: Theme.c.ink, label: "ви" }] : [], hl: [{ y: 0.1, color: Theme.c.muted, label: "10 %" }] });
    }
    return {
      stages: [st, ch, ch2],
      frame(dt, time) {
        if (S.play && dt > 0) {
          const sim = dt * S.speed * 60; // секунд моделі
          let left = sim; const w = S.clino ? 2 * Math.PI * S.rpm / 60 : 0;
          while (left > 0) { const d = Math.min(2, left); S.spin += w * d; S.t += d;
            // напрям «низу» у системі клітини: Rot(−spin)·(0, −g)
            const gx = S.g * Math.sin(S.spin) * (S.clino ? 1 : 0), gy = -S.g * (S.clino ? Math.cos(S.spin) : 1);
            S.Gx += (gx - S.Gx) * d / S.tau; S.Gy += (gy - S.Gy) * d / S.tau;
            // відповідь у системі лабораторії: R = Rot(spin)·G
            const Ry = S.clino ? (S.Gx * Math.sin(S.spin) + S.Gy * Math.cos(S.spin)) : S.Gy;
            S.alphaS += KS * (-Ry) * Math.cos(S.alphaS * Math.PI / 180) * d / 60;
            S.alphaR -= KR * (-Ry) * Math.cos(S.alphaR * Math.PI / 180) * d / 60;
            left -= d; }
          S.alphaS = clamp(S.alphaS, -90, 90); S.alphaR = clamp(S.alphaR, -90, 90);
          if (S.t / 3600 - (S.hist[S.hist.length - 1]?.[0] ?? 0) > 0.05) S.hist.push([S.t / 3600, S.alphaS, S.alphaR]);
          if (S.t > 12 * 3600) S.play = false; ch.dirty = true;
        }
        draw(time); if (ch.dirty) { charts(); ch.dirty = false; }
        const gm = Math.hypot(S.Gx, S.Gy);
        rd.set("t", fmt(S.t / 3600, 2)); rd.set("as", fmt(S.alphaS, 0), "°"); rd.set("ar", fmt(-S.alphaR, 0), "°"); rd.set("G", fmt(gm, 2)); rd.set("aux", fmt(1 + 1.2 * Math.min(1, gm) * (S.clino ? 0.2 : 1) * S.g / Math.max(0.5, S.g), 2));
      },
    };
  },
  cheat: `
<h3>Як рослина відчуває вектор сили тяжіння</h3>
<p><b>Геотропізм</b> (гравітропізм) — напрямлений ріст органів за дією сили тяжіння. Головний корінь росте вниз (позитивний геотропізм), стебло — угору (негативний), бічні органи — під кутом (плагіотропізм). Гравітаційний сигнал сприймають <b>статоцити</b> — клітини кореневого чохлика й крохмальної піхви стебла, що містять важкі крохмальні зерна — <b>статоліти</b> (амілопласти). Вони осідають на нижню стінку клітини; тиск на мембрани спричиняє каскад сигналів і перерозподіл ауксину: на нижньому боці горизонтально розміщеного органа його більше.</p>
<h3>Чому корінь і стебло реагують протилежно</h3>
<p>Більша концентрація ауксину на нижньому боці стебла стимулює розтягнення — стебло вигинається вгору; для кореня така концентрація вже надмірна й гальмує ріст нижнього боку — корінь згинається вниз (оптимуми розтягнення кореня й стебла різні — див. ЛР 15).</p>
<div class="eq"><span class="fr"><span>d<var>α</var></span><span>d<var>t</var></span></span> = ±<var>k</var>·(−<var>R</var><sub>y</sub>)·cos <var>α</var> &nbsp;·&nbsp; <span class="fr"><span>d<var>G</var></span><span>d<var>t</var></span></span> = <span class="fr"><span><var>g</var>·<var>n</var>(<var>t</var>) − <var>G</var></span><span><var>τ</var><sub>s</sub></span></span></div>
<h3>Клиностат</h3>
<p>Клиностат — прилад, що повільно обертає рослину навколо горизонтальної осі. Напрям сили тяжіння відносно клітин постійно змінюється, статоліти не встигають осісти ні в який бік, і розподіл ауксину залишається симетричним. Орган росте прямо. Якщо період обертання значно менший за час осідання статолітів τ<sub>s</sub>, залишкова реакція дуже мала: |G| = 1/√(1+(ωτ<sub>s</sub>)²).</p>
<div class="fix"><b>Про модель.</b> Часові сталі та швидкості вигину ілюстративні; модель відтворює якісну картину: осідання статолітів, перерозподіл ауксину, протилежні реакції кореня й стебла, ефект клиностата.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому клиностат гасить геотропічну реакцію?</summary><p>Через постійну зміну напряму «низу» статоліти не залишаються на одній стінці, і ауксин не накопичується на одному боці органа.</p></details>
<details class="qa"><summary>Чому корінь згинається вниз, а стебло — вгору, якщо ауксину внизу більше в обох?</summary><p>Корінь значно чутливіший до ауксину: концентрація, що стимулює стебло, гальмує розтягнення клітин кореня.</p></details>
<details class="qa"><summary>Що буде в невагомості?</summary><p>Статоліти не осідають, сигналу немає — органи ростуть у довільних напрямах (за інших орієнтирів, наприклад світла).</p></details>`,
});


/* ============ ЛР 18. Мобілізація запасних речовин: насіння й зимові пагони ============ */
App.add({
  n: 18, short: "Мобілізація запасних речовин", tag: "амілаза · ліпаза · цукри · жири",
  title: "Перетворення запасних речовин: у насінні при проростанні та в пагонах деревних рослин узимку",
  model: "насіння: dS/dt = −k·A(t)·S · dG/dt = k·A·S − (u + r)·G · пагони: крохмаль ⇄ цукри/жири залежно від T",
  build({ stageBox, ctrls, below }) {
    const SEED = { starch: { name: "крохмалисте (горох, пшениця)", S: 70, L: 3 }, fat: { name: "жирове (соняшник, рицина)", S: 4, L: 55 } };
    const TREE = { starchy: { name: "«крохмальна» порода (дуб, клен)" }, fatty: { name: "«жирова» порода (липа, береза)" } };
    const S = { mode: "seed", kind: "starch", tree: "starchy", d: 0, play: false, spd: 1 };
    const Tm = [14, 9, 4, 0, -4, -6, -3, 3, 9, 15];   // середня температура: вересень…червень
    const MON = ["вер", "жов", "лис", "гру", "січ", "лют", "бер", "кві", "тра", "чер"];
    const sig = (x) => 1 / (1 + Math.exp(-x));
    function simSeed(days) { // повертає ряд станів із кроком 0.1 доби
      const K = SEED[S.kind]; let St = K.S, L = K.L, G = 2, M = 2, R = 0; const out = [{ d: 0, St, L, G, M, R }]; const n = Math.round(days * 10);
      for (let i = 1; i <= n; i++) { const d = i / 10, dt = .1; const A = sig((d - 1.3) / .55), Lp = sig((d - 2.0) / .6);
        const ds = -.55 * A * St * dt, dl = -.5 * Lp * L * dt; const conv = -ds + -dl * .9;
        St += ds; L += dl; const u = .5 * G * (1 - M / 60) * dt, r = .22 * G * dt; G += conv - u - r; M += .8 * u; R += r; out.push({ d, St: Math.max(0, St), L: Math.max(0, L), G: Math.max(0, G), M, R }); }
      return out;
    }
    function simTree(months) {
      let St = S.tree === "starchy" ? 60 : 55, F = 4, G = 6; const out = [{ m: 0, St, F, G }]; const n = Math.round(months * 20);
      for (let i = 1; i <= n; i++) { const m = i / 20, T = interp(Tm, m), cold = clamp((7 - T) / 12, 0, 1), warm = clamp((T - 4) / 10, 0, 1), dt = 1 / 20;
        const toG = 1.4 * cold * St * dt, back = 1.1 * warm * G * dt; St += back - toG; G += toG - back;
        if (S.tree === "fatty") { const toF = 1.0 * cold * G * dt, fr = 0.9 * warm * F * dt; G += fr - toF; F += toF - fr; }
        out.push({ m, St: Math.max(0, St), F: Math.max(0, F), G: Math.max(0, G) }); }
      return out;
    }
    const interp = (a, x) => { const i = clamp(Math.floor(x), 0, a.length - 2), f = clamp(x - i, 0, 1); return a[i] * (1 - f) + a[i + 1] * f; };
    const st = new Stage(stageBox, { aspect: (stageBox.clientWidth || 700) < 560 ? 0.9 : 1.55, minH: 300, maxH: 460, tag: "Зріз і кольорові реакції" });
    const rd = UI.reads(stageBox, [["a", ""], ["b", ""], ["c", ""], ["d", ""]]);
    const labs = stageBox.querySelectorAll(".reads .rd .k");
    UI.seg(ctrls, { label: "Об’єкт", value: S.mode, options: [["seed", "Насіння, що проростає"], ["tree", "Пагони взимку"]], on: v => { S.mode = v; S.d = 0; sync(); ch.dirty = true; } });
    const sK = UI.select(ctrls, { id: "l18-k", label: "Тип запасу насіння", value: S.kind, options: Object.entries(SEED).map(([k, o]) => [k, o.name]), on: v => { S.kind = v; ch.dirty = true; } });
    const sT = UI.select(ctrls, { id: "l18-tr", label: "Тип дерев", value: S.tree, options: Object.entries(TREE).map(([k, o]) => [k, o.name]), on: v => { S.tree = v; ch.dirty = true; } });
    const sD = UI.slider(ctrls, { id: "l18-d", label: "Доба проростання", min: 0, max: 10, step: 0.1, value: 0, unit: "діб", fmt: v => fmt(v, 1), on: v => { S.d = v; S.play = false; ch.dirty = true; } });
    const sM = UI.slider(ctrls, { id: "l18-m", label: "Місяць (вересень → червень)", min: 0, max: 9, step: 0.05, value: 0, unit: "", fmt: v => MON[Math.min(9, Math.round(v))] + (Math.abs(v - Math.round(v)) > .25 ? "…" : ""), on: v => { S.d = v; S.play = false; ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Спостерігати за процесом", pri: true, on: () => { S.d = 0; sD.set(0); sM.set(0); S.play = true; ch.dirty = true; } }]);
    function sync() { const seed = S.mode === "seed"; [sK, sD].forEach(x => (x.el || x).closest(".ctl").hidden = !seed); [sT, sM].forEach(x => (x.el || x).closest(".ctl").hidden = seed);
      const L = seed ? ["Крохмаль", "Жири", "Розчинні цукри", "Сира маса проростка"] : ["Крохмаль, бал", "Цукри, бал", "Жири, бал", "Температура"]; labs.forEach((e, i) => e.textContent = L[i]); }
    sync();
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Вміст запасних речовин у часі"); const ch2 = UI.chart(row, "Баланс сухої маси / температура");

    function drawSlice(c, cx, cy, R, parts, label) { // круглий зріз із забарвленням
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip(); c.fillStyle = Theme.dark ? "#3a3a2c" : "#F1E8C8"; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      const r = rng(5); for (let i = 0; i < 90; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * R * .92; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; const [col, a0] = parts(r()); c.fillStyle = rgba(col, a0); c.beginPath(); c.arc(x, y, R * (.1 + r() * .05), 0, 7); c.fill(); }
      c.restore(); c.strokeStyle = Theme.c.rule; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.lineWidth = 1; Draw.text(c, label, cx, cy + R + 14, { align: "center", size: 11, color: Theme.c.ink });
    }
    function tube(c, x, y, col, label, lvl = .6) { Draw.tube(c, x, y, 26, 70, [{ frac: 1, color: col }], { fill: lvl, label }); }
    function draw() {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear(); const nar = W < 520;
      let sc, su, fa, head;
      if (S.mode === "seed") { const sim = simSeed(10); const k = Math.min(sim.length - 1, Math.round(S.d * 10)), p = sim[k]; const K = SEED[S.kind]; sc = p.St / 70; fa = p.L / 55; su = p.G / 30; head = `доба ${fmt(S.d, 1)}`; S.cur = p; S.sim = sim; }
      else { const sim = simTree(9); const k = Math.min(sim.length - 1, Math.round(S.d * 20)), p = sim[k]; sc = p.St / 60; su = p.G / 40; fa = p.F / 40; head = MON[Math.min(9, Math.round(S.d))]; S.cur = p; S.sim = sim; }
      const R = nar ? Math.min(54, W * .14) : Math.min(78, H * .2, W * .1);
      const xs = nar ? [W * .2, W * .5, W * .8] : [W * .17, W * .39, W * .61];
      const yy = nar ? H * .26 : H * .3;
      const starchCol = (v) => mixH("#D9C98B", "#2B1A4F", cl01(v)); const sugarCol = (v) => mixH("#EFE7C8", "#C4204A", cl01(v)); const fatCol = (v) => mixH("#EFE7C8", "#E8541B", cl01(v));
      drawSlice(c, xs[0], yy, R, (u) => [starchCol(sc * (.6 + .6 * u)), .85], nar ? "I₂/KI" : "I₂/KI → крохмаль");
      drawSlice(c, xs[1], yy, R, (u) => [sugarCol(su * (.6 + .6 * u)), .85], nar ? "цукри" : (S.mode === "seed" ? "Фелінг → цукри" : "α-нафтол → цукри"));
      drawSlice(c, xs[2], yy, R, (u) => [fatCol(fa * (.6 + .6 * u)), .85], nar ? "судан III" : "судан III → жири");
      if (S.mode === "seed") { // проросток
        const bx = nar ? W * .5 : W * .84, by = nar ? H * .86 : H * .78, grow = cl01(S.cur.M / 40);
        c.fillStyle = Theme.dark ? "#3b3023" : "#C8B08A"; c.fillRect(bx - 60, by, 120, nar ? H - by : 40);
        c.strokeStyle = "#E7D3A0"; c.lineWidth = 4; c.lineCap = "round"; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by + 30 * grow + 4); c.stroke(); c.strokeStyle = "#7BB05B"; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by - 70 * grow - 4); c.stroke(); c.lineCap = "butt"; c.lineWidth = 1;
        if (grow > .25) { c.fillStyle = "#4F9248"; for (let s = -1; s <= 1; s += 2) { c.beginPath(); c.ellipse(bx + s * 12 * grow, by - 66 * grow, 12 * grow, 5 * grow, s * -.5, 0, 7); c.fill(); } }
        c.fillStyle = "#B58A52"; c.beginPath(); c.ellipse(bx, by + 3, 9 * (1 - .5 * grow), 6 * (1 - .5 * grow), 0, 0, 7); c.fill();
      } else { // пагін з бруньками: «термометр»
        const bx = nar ? W * .5 : W * .84, by = nar ? H * .86 : H * .78; c.strokeStyle = "#7A5A3A"; c.lineWidth = 6; c.lineCap = "round"; c.beginPath(); c.moveTo(bx - 40, by); c.lineTo(bx + 30, by - 36); c.stroke(); c.lineWidth = 3; c.beginPath(); c.moveTo(bx - 10, by - 14); c.lineTo(bx - 4, by - 40); c.stroke(); c.lineCap = "butt"; c.lineWidth = 1; c.fillStyle = "#9C5530"; c.beginPath(); c.ellipse(bx - 4, by - 42, 4, 7, 0, 0, 7); c.fill();
        const Tn = interp(Tm, S.d); Draw.text(c, `${fmt(Tn, 0)} °C`, bx, by + 22, { align: "center", size: 13, color: Tn < 0 ? T.data : T.warn });
      }
      Draw.text(c, head, 12, 18, { size: 13, color: T.ink });
      // пробірки Фелінга
      const ty = nar ? H * .52 : H * .62;
      if (!nar) { tube(c, xs[1] - 13, ty, mixHex("#3F7FD6", "#B8341E", cl01(su)), "Фелінг", .55); }
    }
    function charts() {
      if (S.mode === "seed") {
        const sim = S.sim || simSeed(10); const mk = (f) => sim.map(p => [p.d, f(p)]);
        drawChart(ch, { x: [0, 10], y: [0, 80], xl: "доба", yl: "% від початкового запасу", legend: [{ color: Theme.c.antho, label: "крохмаль" }, { color: Theme.c.carot, label: "жири" }, { color: Theme.c.data, label: "цукри" }], series: [{ pts: mk(p => p.St), color: Theme.c.antho, w: 2.4 }, { pts: mk(p => p.L), color: Theme.c.carot, w: 2.4 }, { pts: mk(p => p.G), color: Theme.c.data, w: 2.4 }], vl: [{ x: S.d, color: Theme.c.muted }] });
        drawChart(ch2, { x: [0, 10], y: [0, 60], xl: "доба", yl: "відн. од.", legend: [{ color: Theme.c.chl, label: "маса проростка" }, { color: Theme.c.bad, label: "втрати на дихання" }], series: [{ pts: mk(p => p.M), color: Theme.c.chl, w: 2.4 }, { pts: mk(p => p.R), color: Theme.c.bad, w: 2.4 }], vl: [{ x: S.d, color: Theme.c.muted }] });
        const p = S.cur || sim[0]; rd.set("a", fmt(p.St, 0), "%"); rd.set("b", fmt(p.L, 0), "%"); rd.set("c", fmt(p.G, 0), "відн."); rd.set("d", fmt(p.M, 0), "відн.");
      } else {
        const sim = S.sim || simTree(9); const mk = (f) => sim.map(p => [p.m, f(p)]);
        drawChart(ch, { x: [0, 9], y: [0, 70], xt: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], xfmt: v => MON[v], xl: "місяць", yl: "% від початкового запасу", legend: [{ color: Theme.c.antho, label: "крохмаль" }, { color: Theme.c.data, label: "цукри" }, { color: Theme.c.carot, label: "жири" }], series: [{ pts: mk(p => p.St), color: Theme.c.antho, w: 2.4 }, { pts: mk(p => p.G), color: Theme.c.data, w: 2.4 }, { pts: mk(p => p.F), color: Theme.c.carot, w: 2.4 }], vl: [{ x: S.d, color: Theme.c.muted }] });
        drawChart(ch2, { x: [0, 9], y: [-10, 20], xt: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], xfmt: v => MON[v], xl: "місяць", yl: "T, °C", hl: [{ y: 0, color: Theme.c.muted }], series: [{ pts: Array.from({ length: 91 }, (_, i) => [i / 10, interp(Tm, i / 10)]), color: Theme.c.data, w: 2.4 }], vl: [{ x: S.d, color: Theme.c.muted }] });
        const p = S.cur || sim[0]; const sc5 = (v, m) => clamp(Math.round(1 + 4 * v / m), 1, 5); rd.set("a", String(sc5(p.St, 60)), "з 5"); rd.set("b", String(sc5(p.G, 40)), "з 5"); rd.set("c", String(sc5(p.F, 40)), "з 5"); rd.set("d", fmt(interp(Tm, S.d), 0), "°C");
      }
    }
    return { stages: [st, ch, ch2], frame(dt) { if (S.play && dt > 0) { const lim = S.mode === "seed" ? 10 : 9; S.d = Math.min(lim, S.d + dt * (S.mode === "seed" ? 1.1 : 1) * S.spd); (S.mode === "seed" ? sD : sM).set(S.d); ch.dirty = true; if (S.d >= lim) S.play = false; } draw(); if (ch.dirty) { charts(); ch.dirty = false; } } };
  },
  cheat: `
<h3>Запасні речовини й їх мобілізація</h3>
<p>Насіння накопичує <b>запасні речовини</b> — крохмаль, жири, білки. При проростанні вони мобілізуються (гідролізуються ферментами до розчинних сполук і транспортуються до зародка): крохмаль розщеплює <b>амілаза</b> до цукрів, жири — <b>ліпаза</b>, білки — протеази. Жири перетворюються на вуглеводи через гліоксилатний цикл у гліоксисомах, тому проростки жирового насіння спершу «худнуть» на сухій масі: частина речовини витрачається на дихання, а жири містять більше вуглецю й менше кисню, ніж цукри. Сира маса проростка при цьому зростає (поглинання води).</p>
<h3>Реакції на запасні речовини</h3>
<ul><li><b>Крохмаль</b>: розчин Люголя (йод у йодиді калію) дає синьо-фіолетове або чорне забарвлення.</li><li><b>Цукри</b>: з α-нафтолом і концентрованою H₂SO₄ — від рожевого до темно-малинового; для відновних цукрів — реакція Фелінга (синій → цегляно-червоний осад).</li><li><b>Жири</b>: судан III забарвлює краплі у яскраво-червоний або помаранчевий колір.</li></ul>
<h3>Зимовий спокій деревних рослин</h3>
<p>У пагонах деревних рослин узимку відбуваються перетворення, що підвищують морозостійкість: крохмаль перетворюється на цукри (знижують температуру замерзання клітинного соку й захищають білки й мембрани), а в «жирових» порід — і на жири. Відокремлюється протоплазма, зникають плазмодесми. Зимостійкі види переробляють крохмаль повніше, а менш стійкі — частково. Навесні — зворотний процес: цукри знову йдуть на синтез крохмалю й ріст бруньок. Вміст кожної речовини оцінюють у балах від 1 до 5 за інтенсивністю забарвлення.</p>
<div class="eq"><span class="fr"><span>d<var>S</var></span><span>d<var>t</var></span></span> = −<var>k</var>·<var>A</var>(<var>t</var>)·<var>S</var> &nbsp;·&nbsp; <span class="fr"><span>d<var>G</var></span><span>d<var>t</var></span></span> = <var>k</var>·<var>A</var>·<var>S</var> − (<var>u</var> + <var>r</var>)·<var>G</var></div>
<div class="fix"><b>Про модель.</b> Швидкості перетворень і температурні залежності ілюстративні; вони відображають послідовність подій (запуск амілази/ліпази, перехід запасів у цукри, дихання, ріст) та сезонний хід у пагонах.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому вміст цукрів у пагонах узимку зростає?</summary><p>Крохмаль гідролізується до цукрів, що знижують температуру замерзання клітинного соку й захищають протоплазму — це частина загартування.</p></details>
<details class="qa"><summary>Чому жирове насіння спочатку втрачає суху масу?</summary><p>Перетворення жирів на цукри потребує окиснення і частина вуглецю втрачається при диханні.</p></details>
<details class="qa"><summary>Який період року дає максимум крохмалю в пагонах?</summary><p>Пізнє літо й рання осінь, до початку холодового перетворення.</p></details>`,
});

/* ============ ЛР 19. Активні форми кисню: НСТ-тест і флуоресцентний зонд ============ */
App.add({
  n: 19, short: "АФК: НСТ та DCF", tag: "супероксид · флуоресценція",
  title: "Визначення вмісту активних форм кисню: супероксидний радикал (НСТ) та флуоресцентний зонд DCFH-DA",
  model: "A₅₄₀(t) = A_max·(1 − e^{−k·t}) · F(t) = F₀ + F_max·(1 − e^{−k·t}) · k = k₀·P · P = 1 + 0,15·[H₂O₂] + κ·D/100",
  build({ stageBox, ctrls, below }) {
    const NP = { np1: { name: "НЧ 1 (антиоксидантна)", kap: -0.8, col: "#2E6FB5" }, np2: { name: "НЧ 2 (нейтральна)", kap: 0.05, col: "#6B7A70" }, np3: { name: "НЧ 3 (прооксидантна)", kap: 0.95, col: "#C03A2B" } };
    const SAMP = [["K", "К", null, 0], ["H", "H₂O₂", null, 1], ["n1", "НЧ1", "np1", 0], ["n2", "НЧ2", "np2", 0], ["n3", "НЧ3", "np3", 0], ["n1h", "НЧ1+H₂O₂", "np1", 1], ["n2h", "НЧ2+H₂O₂", "np2", 1], ["n3h", "НЧ3+H₂O₂", "np3", 1]];
    const S = { mode: "nbt", dose: 100, h2o2: 3, t: 0, play: false, spd: 1 };
    const P = (np, hh) => Math.max(0.05, 1 + (hh ? 0.15 * S.h2o2 : 0) + (np ? NP[np].kap * S.dose / 100 : 0));
    const TMAX = () => S.mode === "nbt" ? 600 : 60;   // с або хв
    const val = (np, hh, t) => S.mode === "nbt" ? 1.0 * (1 - Math.exp(-0.0042 * P(np, hh) * t)) : 6 + 90 * (1 - Math.exp(-0.022 * P(np, hh) * t));
    const st = new Stage(stageBox, { aspect: (stageBox.clientWidth || 700) < 560 ? 0.8 : 1.65, minH: 290, maxH: 460, tag: "Штатив із пробами" });
    const rd = UI.reads(stageBox, [["a", "Ваша проба"], ["b", "К (контроль)"], ["c", "Відношення"], ["d", "Час"]]);
    UI.seg(ctrls, { label: "Метод", value: S.mode, options: [["nbt", "НСТ (A₅₄₀)"], ["dcf", "DCF (флуоресценція)"]], on: v => { S.mode = v; S.t = 0; S.play = false; ch.dirty = true; } });
    const selNP = UI.select(ctrls, { id: "l19-np", label: "Наночастинки для вашої проби", value: "np3", options: Object.entries(NP).map(([k, o]) => [k, o.name]), on: v => { S.np = v; ch.dirty = true; } }); S.np = "np3";
    UI.slider(ctrls, { id: "l19-d", label: "Доза НЧ", min: 0, max: 200, step: 5, value: S.dose, unit: "мкг/мл", on: v => { S.dose = v; ch.dirty = true; } });
    UI.slider(ctrls, { id: "l19-h", label: "Індуктор окисного стресу H₂O₂", min: 0, max: 10, step: 0.5, value: S.h2o2, unit: "мМ", fmt: v => fmt(v, 1), on: v => { S.h2o2 = v; ch.dirty = true; } });
    UI.check(ctrls, { id: "l19-hh", label: "Додати H₂O₂ до вашої проби", value: true, on: v => { S.hh = v; ch.dirty = true; } }); S.hh = true;
    UI.buttons(ctrls, [{ label: "Додати НАДН / DCFH-DA", pri: true, on: () => { S.t = 0; S.play = true; ch.dirty = true; } }]);
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Кінетика для всіх проб (як у таблиці 6.1 / 6.2)"); const ch2 = UI.chart(row, "Значення у вибраний момент: усі проби");

    function vial(c, x, y, w, hh, A, k, label, sel) {
      const T = Theme.c; let col, glow = null;
      if (S.mode === "nbt") col = mixHex("#F1E9B0", "#35238F", cl01(A)); else { col = mixHex(Theme.dark ? "#1c241c" : "#CFE0CC", "#30D26A", cl01(A / 100)); glow = rgba("#3CFF7A", cl01(A / 100) * .9); }
      cuvette(c, x, y, w, hh, col, .72, glow);
      Draw.text(c, label.replace("H₂O₂", "+H₂O₂").replace("++", "+"), x + w / 2, y + hh + 14, { align: "center", size: 9.5, color: sel ? T.antho : T.ink, weight: sel ? "700" : "" });
      if (sel) { c.strokeStyle = T.antho; c.lineWidth = 2; roundRect(c, x - 4, y - 4, w + 8, hh + 8, 7); c.stroke(); c.lineWidth = 1; }
      void k;
    }
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear(); const nar = W < 520;
      if (S.mode === "dcf") { c.fillStyle = rgba("#1b2a52", Theme.dark ? .3 : .08); c.fillRect(0, 0, W, H); }
      const cols = nar ? 4 : 8, rows = nar ? 2 : 1, vw = Math.min(46, (W - 24) / cols - 10), vh = nar ? H * .17 : H * .5, gx = (W - cols * (vw + 10)) / 2 + 5;
      SAMP.forEach(([id, lab, np, hh], i) => {
        const col = i % cols, rowi = Math.floor(i / cols), x = gx + col * (vw + 10), y = 40 + rowi * (vh + 46);
        const mine = false; const t = S.t; vial(c, x, y, vw, vh, val(np, hh, t), 0, lab, mine);
      });
      // «ваша проба»
      const A = val(S.np, S.hh ? 1 : 0, S.t), A0 = val(null, 0, S.t);
      const my = nar ? 40 + 2 * (vh + 46) : H * .66, mxw = 60, tx = nar ? 100 : W / 2 - mxw / 2 - 90 + mxw + 18, ta = "left"; vial(c, nar ? 24 : W / 2 - mxw / 2 - 90, my, mxw, nar ? H * .14 : H * .22, A, 0, "ваша", true);
      Draw.text(c, S.mode === "nbt" ? `A₅₄₀ = ${fmt(A, 3)}` : `F = ${fmt(A, 1)} ум. од.`, tx, my + 18, { align: ta, size: 16, color: T.ink, font: "display" });
      fitText(c, S.mode === "nbt" ? "НСТ + ФМС + НАДН → O₂•⁻ → формазан" : "DCFH-DA → DCFH → (АФК) → DCF, 480/520 нм", tx, my + 40, W - tx - 8, { align: ta, size: 10.5, color: T.muted });
      Draw.text(c, `t = ${S.mode === "nbt" ? fmt(S.t, 0) + " с" : fmt(S.t, 0) + " хв"}`, 12, 18, { size: 12, color: T.ink });
      // частинки: супероксид
      if (S.mode === "nbt") { const r = rng(9); for (let i = 0; i < 18; i++) { const px = W * .08 + r() * W * .84, py0 = H * .1 + r() * H * .1, tt = (time * .5 + r()) % 1; c.fillStyle = rgba("#E8A33B", (1 - tt) * .5 * cl01(P(S.np, S.hh ? 1 : 0) / 2)); c.beginPath(); c.arc(px, py0 + tt * 20, 2.4, 0, 7); c.fill(); } }
      void A0;
    }
    function charts() {
      const tm = TMAX(), xs = Array.from({ length: 61 }, (_, i) => tm * i / 60); const cols = ["#6B7A70", "#E8A33B", "#2E6FB5", "#7FA69C", "#C03A2B", "#5B8FC9", "#9AB3AE", "#E0705E"];
      drawChart(ch, { x: [0, tm], y: [0, S.mode === "nbt" ? 1.05 : 105], xl: S.mode === "nbt" ? "с" : "хв", yl: S.mode === "nbt" ? "A₅₄₀" : "F, ум. од.", legend: SAMP.slice(0, 5).map((s, i) => ({ color: cols[i], label: s[1] })), series: SAMP.map(([id, lab, np, hh], i) => ({ pts: xs.map(t => [t, val(np, hh, t)]), color: cols[i], w: i === 0 ? 2.8 : 1.8, dash: hh ? [5, 3] : undefined })).concat([{ pts: xs.map(t => [t, val(S.np, S.hh ? 1 : 0, t)]), color: Theme.c.ink, w: 2.8 }]), vl: [{ x: S.t, color: Theme.c.muted }] });
      const bars = SAMP.map(([id, lab, np, hh], i) => [i + 1, val(np, hh, S.t)]);
      drawChart(ch2, { x: [0.4, 8.6], y: [0, S.mode === "nbt" ? 1.05 : 105], xt: [1, 2, 3, 4, 5, 6, 7, 8], xfmt: v => ["К", "H₂O₂", "НЧ1", "НЧ2", "НЧ3", "НЧ1+", "НЧ2+", "НЧ3+"][v - 1], series: [{ pts: bars, bars: true, color: rgba(Theme.c.chl, .75), bw: 18 }] });
      const mine = val(S.np, S.hh ? 1 : 0, S.t), k0 = val(null, 0, S.t);
      rd.set("a", S.mode === "nbt" ? fmt(mine, 3) : fmt(mine, 1)); rd.set("b", S.mode === "nbt" ? fmt(k0, 3) : fmt(k0, 1)); rd.set("c", fmt(k0 > 0 ? mine / k0 : 0, 2), "×"); rd.set("d", fmt(S.t, 0), S.mode === "nbt" ? "с" : "хв");
    }
    return { stages: [st, ch, ch2], frame(dt, time) { if (S.play && dt > 0) { S.t = Math.min(TMAX(), S.t + dt * TMAX() / 14 * S.spd); ch.dirty = true; if (S.t >= TMAX()) S.play = false; } else if (dt === 0 && S.t === 0) S.t = TMAX(); draw(time); if (ch.dirty) { charts(); ch.dirty = false; } } };
  },
  cheat: `
<h3>Активні форми кисню та способи їх визначення</h3>
<p><b>Активні форми кисню (АФК)</b> — продукти неповного відновлення O₂ (супероксид, пероксид водню, гідроксил, синглетний кисень); докладніше див. статтю «Резистентність рослин та окисний стрес». Для їх вимірювання використовують індикаторні реакції, продукт яких має колір або флуоресценцію.</p>
<h3>Супероксид: реакція з нітросинім тетразолієм (НСТ)</h3>
<p>У безклітинній системі супероксидні радикали утворюються при взаємодії <b>НАДН</b> і <b>феназинметасульфату (ФМС)</b> в анаеробних умовах. <b>НСТ</b> відновлюється супероксидом до нерозчинного синьо-фіолетового <b>формазану</b>: чим більше O₂•⁻, тим вища оптична густина на 540 нм. Якщо в пробі є речовина, що «гасить» супероксид (антиоксидант), забарвлення зростає повільніше; якщо вона посилює утворення АФК (прооксидант) чи додано індуктор H₂O₂, — швидше.</p>
<h3>Флуоресцентний зонд DCFH-DA</h3>
<p>Діацетат дихлордигідрофлуоресцеїну проникає в клітини, де естерази відщеплюють ацетатні групи й утворюють нефлуоресцентний DCFH. АФК окиснюють його до <b>DCF</b>, який флуоресціює (збудження 480 нм, випромінювання 520 нм). Інтенсивність флуоресценції пропорційна внутрішньоклітинному вмісту АФК; вимірюють її кожні 10 хв протягом години.</p>
<div class="eq"><var>k</var> = <var>k</var><sub>0</sub>·<var>P</var> &nbsp;·&nbsp; <var>P</var> = 1 + 0,15·[H₂O₂] + <var>κ</var>·<var>D</var>/100</div>
<dl class="vars"><dt>κ</dt><dd>характер наночастинок: &lt; 0 — антиоксидантні, ≈ 0 — нейтральні, &gt; 0 — прооксидантні</dd><dt>D</dt><dd>доза НЧ, мкг/мл</dd></dl>
<div class="fix"><b>Про модель.</b> Кінетика спрощена: швидкість виходу сигналу пропорційна відносній інтенсивності утворення АФК; параметри НЧ і значення констант ілюстративні (у посібнику використано експериментальні зразки наночастинок).</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому в системі НАДН + ФМС утворюється супероксид?</summary><p>ФМС віддає електрони з НАДН на молекулярний кисень, перетворюючи його на O₂•⁻; НСТ конкурує за ці радикали й відновлюється до формазану.</p></details>
<details class="qa"><summary>Яку АФК виявляє DCFH-DA?</summary><p>Зонд реагує насамперед із H₂O₂ та пероксидними радикалами (неспецифічний індикатор загального рівня АФК); для супероксиду краще застосовувати інші зонди.</p></details>
<details class="qa"><summary>Що означає зменшення A₅₄₀ у присутності речовини?</summary><p>Речовина перехоплює супероксид (антиоксидант) або інгібує його утворення.</p></details>`,
});

/* ============ ЛР 20. Антиоксидантні ферменти: каталаза, АПО, СОД ============ */
App.add({
  n: 20, short: "Каталаза, АПО, СОД у проростках", tag: "Міхаеліс–Ментен · спектрофотометрія",
  title: "Визначення активності антиоксидантних ферментів у проростках гороху: каталаза, аскорбатпероксидаза, супероксиддисмутаза",
  model: "АК = (A_к − A_д)·V·… · AP = (tg_д − tg_к)·V_p/(2,8·C_p) · інгібування СОД = (1 − ΔE_д/ΔE_к)·100 % · активність a(s): гормезис",
  build({ stageBox, ctrls, below }) {
    const S = { enz: "cat", s: 0, prot: 4, vol: 0.1, inc: 10, asc: 0.3, h2o2: 1, t: 0, play: false, spd: 1 };
    const sig = (x) => 1 / (1 + Math.exp(-x));
    const act = { cat: (s) => Math.max(.15, 1 + 1.1 * bell(s, 45, 25) - .8 * sig((s - 78) / 7)), apx: (s) => Math.max(.15, 1 + .9 * bell(s, 50, 22) - .7 * sig((s - 82) / 6)), sod: (s) => Math.max(.15, 1 + 1.3 * bell(s, 40, 24) - .85 * sig((s - 75) / 7)) };
    const a = () => act[S.enz](S.s);
    // каталаза: A410 залишкового H₂O₂ з молібдатом
    const AK0 = 0.62;
    const catA = (t, ar) => AK0 * Math.exp(-0.0026 * ar * (S.vol / 0.1) * t);
    // АПО: A290 з часом (хв)
    const A290_0 = () => 2.8 * S.asc;
    const apxSlope = (ar) => 2.8 * 0.06 * ar * (S.h2o2 / (S.h2o2 + 0.3)) * (S.asc / (S.asc + 0.08)) * (S.prot / 4);  // А/хв
    const apxA = (t, ar) => Math.max(0, A290_0() - apxSlope(ar) * t - (ar ? 0 : 0.002 * t));
    // СОД: % інгібування
    const sodInh = (ar, vol) => { const x = ar * vol / 0.05 * .9; return 100 * x / (1 + x); };
    const st = new Stage(stageBox, { aspect: (stageBox.clientWidth || 700) < 560 ? 1.0 : 1.65, minH: 290, maxH: 460, tag: "Спектрофотометр" });
    const rd = UI.reads(stageBox, [["a", ""], ["b", ""], ["c", ""], ["d", ""]]); const labs = stageBox.querySelectorAll(".reads .rd .k");
    UI.seg(ctrls, { label: "Фермент", value: S.enz, options: [["cat", "Каталаза"], ["apx", "Аскорбат-пероксидаза"], ["sod", "СОД"]], on: v => { S.enz = v; S.t = 0; sync(); ch.dirty = true; } });
    UI.slider(ctrls, { id: "l20-s", label: "Інтенсивність стресу (посуха, засолення…)", min: 0, max: 100, step: 1, value: S.s, unit: "%", on: v => { S.s = v; ch.dirty = true; } });
    const sV = UI.slider(ctrls, { id: "l20-v", label: "Об’єм надосаду в пробі", min: 0.02, max: 0.3, step: 0.01, value: 0.1, unit: "мл", fmt: v => fmt(v, 2), on: v => { S.vol = v; ch.dirty = true; } });
    const sI = UI.slider(ctrls, { id: "l20-i", label: "Тривалість інкубації", min: 2, max: 20, step: 1, value: 10, unit: "хв", on: v => { S.inc = v; ch.dirty = true; } });
    const sA = UI.slider(ctrls, { id: "l20-a", label: "Аскорбат у кюветі", min: 0.05, max: 0.5, step: 0.05, value: S.asc, unit: "мМ", fmt: v => fmt(v, 2), on: v => { S.asc = v; ch.dirty = true; } });
    const sH = UI.slider(ctrls, { id: "l20-h", label: "H₂O₂ у кюветі", min: 0.1, max: 2, step: 0.1, value: 1, unit: "мМ", fmt: v => fmt(v, 1), on: v => { S.h2o2 = v; ch.dirty = true; } });
    const sP = UI.slider(ctrls, { id: "l20-p", label: "Білок у надосаді", min: 1, max: 8, step: 0.5, value: 4, unit: "мг/мл", fmt: v => fmt(v, 1), on: v => { S.prot = v; ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Запустити реакцію", pri: true, on: () => { S.t = 0; S.play = true; ch.dirty = true; } }]);
    const groups = { cat: [sV, sI], apx: [sA, sH, sP], sod: [sV] };
    function sync() { for (const x of [sV, sI, sA, sH, sP]) (x.el || x).closest(".ctl").hidden = !groups[S.enz].includes(x);
      const L = { cat: ["A₄₁₀ контроль", "A₄₁₀ дослід", "Активність", "Каталаза відн."], apx: ["tg контроль", "tg дослід", "Активність АПО", "АПО відн."], sod: ["ΔE контроль", "ΔE дослід", "Інгібування НСТ", "СОД відн."] }[S.enz]; labs.forEach((e, i) => e.textContent = L[i]); }
    sync();
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Показники приладу"); const ch2 = UI.chart(row, "Активність ферменту залежно від стресу");

    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear(); const nar = W < 520;
      // корпус приладу
      const bx = 14, by = 28, bw = nar ? W - 28 : W * .5, bh = nar ? H * .42 : H - 52;
      c.fillStyle = Theme.dark ? "#2a302c" : "#E9EDE9"; roundRect(c, bx, by, bw, bh, 14); c.fill(); c.strokeStyle = T.rule; c.stroke();
      // кювета
      const cw = 40, chh = Math.min(110, bh * .55), cx = bx + bw * .5 - cw / 2, cy = by + bh * .12; let col, A;
      if (S.enz === "cat") { A = catA(Math.min(S.t, 14) / 14 * S.inc * 60, a()); col = mixHex("#F6F2D8", "#E8C93A", cl01(A / AK0)); }
      else if (S.enz === "apx") { A = apxA(Math.min(S.t, 3), a()); col = mixHex("#EEF2F4", "#D9E3A8", cl01(A / Math.max(.01, A290_0()))); }
      else { const frac = S.t < 7 ? 0 : cl01((S.t - 7) / 7); const dE = 0.5 * frac * (1 - sodInh(a(), S.vol) / 100); A = 0.05 + dE; col = mixHex("#F1E9B0", "#35238F", cl01((A - .05) / .5)); }
      cuvette(c, cx, cy, cw, chh, col, .7);
      // пучок світла
      const ly = cy + chh * .55; const lam = S.enz === "cat" ? 410 : S.enz === "apx" ? 290 : 540; const beam = S.enz === "apx" ? "#8E6FD6" : Spectral.lambdaToRGB(lam);
      c.fillStyle = beam; c.globalAlpha = .55; c.fillRect(bx + 14, ly - 2, cx - bx - 14, 4); c.globalAlpha = .55 * Math.pow(10, -(A || 0) * .6); c.fillRect(cx + cw, ly - 2, bx + bw - 22 - cx - cw, 4); c.globalAlpha = 1;
      Draw.text(c, `λ = ${lam} нм`, bx + 16, by + 18, { size: 11, color: T.muted });
      // дисплей
      const dx = bx + 20, dy = by + bh - 56, dw = bw - 40; c.fillStyle = "#16221A"; roundRect(c, dx, dy, dw, 40, 8); c.fill(); Draw.text(c, `A = ${fmt(A || 0, 3)}`, dx + dw / 2, dy + 21, { align: "center", size: 20, color: "#8EF0B0", font: "display" });
      // права частина: ціль-графік у реальному часі
      if (S.enz === "sod") Draw.text(c, S.t < 7 ? "до НАДН: E₁" : "через 10 хв після НАДН: E₂", bx + bw / 2, cy + chh + 18, { align: "center", size: 11, color: T.ink });
      fitText(c, S.enz === "cat" ? "H₂O₂ + молібдат амонію → жовтий комплекс" : S.enz === "apx" ? "аскорбат + H₂O₂ → дегідроаскорбат (A₂₉₀↓)" : "O₂•⁻ + НСТ → формазан (A₅₄₀↑); СОД конкурує", bx + bw / 2, by + bh + 14, bw - 8, { align: "center", size: 10.5, color: T.muted });
      void time;
    }
    function charts() {
      const ar = a(), tmax = S.enz === "cat" ? S.inc : S.enz === "apx" ? 3 : 14;
      if (S.enz === "cat") { const t = Array.from({ length: 51 }, (_, i) => S.inc * i / 50); drawChart(ch, { x: [0, S.inc], y: [0, 0.7], xl: "хв", yl: "A₄₁₀ (залишок H₂O₂)", legend: [{ color: Theme.c.muted, label: "контроль" }, { color: Theme.c.antho, label: "дослід" }], series: [{ pts: t.map(x => [x, catA(x * 60, 0)]), color: Theme.c.muted, w: 2, dash: [5, 3] }, { pts: t.map(x => [x, catA(x * 60, ar)]), color: Theme.c.antho, w: 2.4 }], marks: [{ x: S.inc, y: catA(S.inc * 60, ar), color: Theme.c.antho }] });
        const dA = AK0 - catA(S.inc * 60, ar), act_ = dA / 22.2 * 2.1 / (S.inc * 60) / 5; // мкат/мг (за формулою K = 22,2 мМ⁻¹см⁻¹, V = 2,1 мл, m = 5 мг)
        rd.set("a", fmt(AK0, 3)); rd.set("b", fmt(catA(S.inc * 60, ar), 3)); rd.set("c", fmt(act_ * 1e6, 2), "нкат/мг"); rd.set("d", fmt(ar, 2), "×"); }
      else if (S.enz === "apx") { const t = Array.from({ length: 19 }, (_, i) => i * 10 / 60); drawChart(ch, { x: [0, 3], y: [0, Math.max(0.5, A290_0() * 1.05)], xl: "хв", yl: "A₂₉₀", legend: [{ color: Theme.c.muted, label: "контроль" }, { color: Theme.c.antho, label: "дослід" }], series: [{ pts: t.map(x => [x, apxA(x, 0)]), color: Theme.c.muted, w: 2, dash: [5, 3] }, { pts: t.map(x => [x, apxA(x, ar)]), color: Theme.c.antho, w: 2.4, dots: 2.5 }] });
        const tgE = -apxSlope(ar), tgK = -0.002; const AP = (Math.abs(tgE) - Math.abs(tgK)) * 2.65 / (2.8 * (S.prot * 0.05));
        rd.set("a", fmt(tgK, 3), "А/хв"); rd.set("b", fmt(tgE, 3), "А/хв"); rd.set("c", fmt(AP, 2), "мкМ/(мг·хв)"); rd.set("d", fmt(ar, 2), "×"); }
      else { const vs = Array.from({ length: 61 }, (_, i) => 0.005 + 0.3 * i / 60); drawChart(ch, { x: [0, 0.3], y: [0, 100], xl: "об’єм надосаду, мл", yl: "інгібування НСТ, %", series: [{ pts: vs.map(v => [v, sodInh(ar, v)]), color: Theme.c.antho, w: 2.4 }], marks: [{ x: S.vol, y: sodInh(ar, S.vol), color: Theme.c.antho }], hl: [{ y: 50, color: Theme.c.muted, label: "50 %" }] });
        const dK = 0.5, dD = dK * (1 - sodInh(ar, S.vol) / 100); rd.set("a", fmt(dK, 3)); rd.set("b", fmt(dD, 3)); rd.set("c", fmt(sodInh(ar, S.vol), 1), "%"); rd.set("d", fmt(ar, 2), "×"); }
      const ss = Array.from({ length: 101 }, (_, i) => i);
      drawChart(ch2, { x: [0, 100], y: [0, 2.8], xl: "стрес, %", yl: "активність, відн.", legend: [{ color: Theme.c.antho, label: "каталаза" }, { color: Theme.c.chl, label: "АПО" }, { color: Theme.c.data, label: "СОД" }], series: [{ pts: ss.map(s => [s, act.cat(s)]), color: Theme.c.antho, w: S.enz === "cat" ? 2.8 : 1.6 }, { pts: ss.map(s => [s, act.apx(s)]), color: Theme.c.chl, w: S.enz === "apx" ? 2.8 : 1.6 }, { pts: ss.map(s => [s, act.sod(s)]), color: Theme.c.data, w: S.enz === "sod" ? 2.8 : 1.6 }], marks: [{ x: S.s, y: act[S.enz](S.s), color: Theme.c.ink }] });
      void tmax;
    }
    return { stages: [st, ch, ch2], frame(dt, time) { if (S.play && dt > 0) { S.t += dt * (S.enz === "sod" ? 1.4 : S.enz === "apx" ? .3 : 1) * S.spd; const lim = S.enz === "apx" ? 3 : 14; if (S.t >= lim) { S.t = lim; S.play = false; } ch.dirty = true; } else if (dt === 0 && S.t === 0) { S.t = S.enz === "apx" ? 3 : 14; } draw(time); if (ch.dirty) { charts(); ch.dirty = false; } } };
  },
  cheat: `
<h3>Антиоксидантні ферменти</h3>
<p>Рівень <b>активних форм кисню</b> у клітині контролюють ферменти: <b>супероксиддисмутаза (СОД)</b> перетворює супероксид O₂•⁻ на H₂O₂ та O₂; <b>каталаза</b> розкладає 2H₂O₂ → 2H₂O + O₂ (одна молекула пероксиду слугує донором електронів, друга — акцептором); <b>аскорбатпероксидаза (АПО)</b> відновлює H₂O₂ до води за рахунок аскорбату, який потім регенерується глутатіоном і НАД(Ф)Н. Ці ферменти — головна ланка резистентності до окисного стресу; їх активність у стресованих рослинах змінюється: помірний стрес її підвищує, а надто сильний — знижує (ферменти руйнуються й виснажується синтез).</p>
<h3>Каталаза: молібдатний метод</h3>
<p>Проба з надосадом інкубується з H₂O₂ при 37 °C 10 хв, потім реакцію зупиняють молібдатом амонію, що утворює з залишком H₂O₂ жовтий комплекс (A<sub>410</sub>). Чим активніша каталаза, тим менше H₂O₂ лишається й тим блідіший розчин. Активність: <b>АК = (A<sub>к</sub> − A<sub>д</sub>)·V·…/(K·t·m)</b> — у посібнику; тут реалізовано еквівалентний розрахунок через мМ-коефіцієнт екстинкції комплексу (22,2 мМ⁻¹·см⁻¹); 1 катал = 1 моль/с.</p>
<h3>Аскорбатпероксидаза</h3>
<p>Реакцію стежать за зниженням A<sub>290</sub> (окиснення аскорбату) протягом 2–3 хв; швидкість — тангенс нахилу лінійної ділянки tg = ΔD/t.</p>
<div class="eq"><var>A</var><sub>ПО</sub> = <span class="fr"><span>(tg<sub>д</sub> − tg<sub>к</sub>)·<var>V</var><sub>р</sub></span><span>2,8·<var>C</var><sub>р</sub></span></span></div>
<p>де 2,8 мМ⁻¹·см⁻¹ — коефіцієнт екстинкції аскорбату, V<sub>р</sub> = 2,65 мл — об’єм суміші, C<sub>р</sub> — вміст білка в пробі (мг). Результат — мкМ аскорбату на мг білка за хв.</p>
<h3>СОД: конкуренція за супероксид</h3>
<p>Супероксид (з НАДН + ФМС) відновлює НСТ до формазану. СОД конкурує з НСТ за O₂•⁻, тому гальмує утворення формазану. Вимірюють E<sub>1</sub> до додавання НАДН та E<sub>2</sub> через 10 хв; % пригнічення відновлення НСТ показує активність ферменту.</p>
<div class="fix"><b>Про модель.</b> Кінетика й залежності від стресу ілюстративні (гормезис: підвищення на помірному стресі, спад при сильному). Для реальних вимірювань використовують калібрувальні криві й вміст білка за Бредфорд.</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому активність каталази в досліді визначають за залишком H₂O₂?</summary><p>H₂O₂ зникає в реакції, а його залишок дає з молібдатом жовтий комплекс; різниця оптичних густин контролю й досліду пропорційна кількості розкладеного H₂O₂.</p></details>
<details class="qa"><summary>Що означає зниження активності СОД?</summary><p>Менше перетворення супероксиду на H₂O₂, а отже вищий ризик утворення гідроксилу й пероксидного окиснення ліпідів — це свідчить про виснаження антиоксидантного захисту.</p></details>
<details class="qa"><summary>Чим відрізняються цитозольна й хлоропластна АПО?</summary><p>Хлоропластна форма швидко інактивується за відсутності аскорбату й пов’язана з тилакоїдами або стромою, цитозольна — стабільніша.</p></details>`,
});

/* ============ ЛР 21. Пероксидне окиснення ліпідів (ТБК-тест) і оксид азоту ============ */
App.add({
  n: 21, short: "ПОЛ (МДА) і NO", tag: "ТБК · закон Бугера–Ламберта–Бера",
  title: "Оцінка пошкодження мембран і сигнальних молекул: ТБК-активні продукти (МДА) та оксид азоту (реакція Гріса)",
  model: "D = C·P·ε·l / (V·10⁶) · C(нмоль/г) = D·V·10⁶/(ε·l·P) · NO = (E_д − E_к)/(E_ст − E_к)·c_ст·f/C_білка",
  build({ stageBox, ctrls, below }) {
    const S = { mode: "mda", s: 20, prot: 0, f: 1, cb: 3, t: 0, play: false, spd: 1 };
    const sig = (x) => 1 / (1 + Math.exp(-x));
    const EPS = 1.56e5, V = 3, P = 0.2;
    const mda = (s, anti) => (12 + 70 * sig((s - 55) / 13)) * (1 - 0.6 * anti / 100);       // нмоль/г
    const Dmda = (s, anti) => mda(s, anti) * P * EPS * 1 / (V * 1e6);
    const noC = (s) => 8 + 120 * sig((s - 50) / 14);                                          // мкмоль/л (у пробі)
    const STD = [[0, .010], [10, .021], [20, .032], [40, .054], [100, .120], [300, .348], [500, .580], [700, .784]];
    const od = (c) => { for (let i = 1; i < STD.length; i++) if (c <= STD[i][0]) { const [x0, y0] = STD[i - 1], [x1, y1] = STD[i]; return y0 + (y1 - y0) * (c - x0) / (x1 - x0); } return STD[STD.length - 1][1]; };
    const st = new Stage(stageBox, { aspect: (stageBox.clientWidth || 700) < 560 ? 1.0 : 1.65, minH: 290, maxH: 460, tag: "Пробірки" });
    const rd = UI.reads(stageBox, [["a", ""], ["b", ""], ["c", ""], ["d", ""]]); const labs = stageBox.querySelectorAll(".reads .rd .k");
    UI.seg(ctrls, { label: "Показник", value: S.mode, options: [["mda", "ТБК-активні продукти (МДА)"], ["no", "Оксид азоту (NO)"]], on: v => { S.mode = v; S.t = 0; sync(); ch.dirty = true; } });
    UI.slider(ctrls, { id: "l21-s", label: "Інтенсивність стресу", min: 0, max: 100, step: 1, value: S.s, unit: "%", on: v => { S.s = v; ch.dirty = true; } });
    const sA = UI.slider(ctrls, { id: "l21-a", label: "Захист антиоксидантами", min: 0, max: 100, step: 5, value: 0, unit: "%", on: v => { S.prot = v; ch.dirty = true; } });
    const sC = UI.slider(ctrls, { id: "l21-c", label: "Білок у надосаді C", min: 1, max: 10, step: 0.5, value: S.cb, unit: "г/л", fmt: v => fmt(v, 1), on: v => { S.cb = v; ch.dirty = true; } });
    const sF = UI.slider(ctrls, { id: "l21-f", label: "Коефіцієнт розведення f", min: 1, max: 10, step: 1, value: 1, unit: "×", on: v => { S.f = v; ch.dirty = true; } });
    UI.buttons(ctrls, [{ label: "Провести реакцію", pri: true, on: () => { S.t = 0; S.play = true; ch.dirty = true; } }]);
    function sync() { for (const x of [sA]) (x.el || x).closest(".ctl").hidden = S.mode !== "mda"; for (const x of [sC, sF]) (x.el || x).closest(".ctl").hidden = S.mode !== "no";
      const L = S.mode === "mda" ? ["D₅₃₂ (дослід)", "МДА", "Стрес, %", "Рівень ПОЛ"] : ["E₅₅₀ контроль", "E₅₅₀ дослід", "NO у пробі", "NO / білок"]; labs.forEach((e, i) => e.textContent = L[i]); }
    sync();
    const row = h("div", { class: "charts" }); below.append(row);
    const ch = UI.chart(row, "Спектр поглинання / стандартна крива"); const ch2 = UI.chart(row, "Показник залежно від стресу");
    function draw(time) {
      const c = st.ctx, W = st.W, H = st.H, T = Theme.c; st.clear(); const nar = W < 520; const k = cl01(S.t / 12);
      if (S.mode === "mda") {
        const D = Dmda(S.s, S.prot) * k, Dk = Dmda(0, 0) * k;
        // водяна баня
        const bx = 14, by = H * .36, bw = nar ? W - 28 : W * .6, bh = H * .5; c.fillStyle = mixHex("#BFDDF0", "#7FB3D6", .3); roundRect(c, bx, by, bw, bh, 12); c.fill(); c.strokeStyle = T.rule; c.stroke();
        const r = rng(3); for (let i = 0; i < 26; i++) { const tt = (time * .6 + r()) % 1, x = bx + 12 + r() * (bw - 24), y = by + bh - 8 - tt * (bh - 16); c.fillStyle = `rgba(255,255,255,${.7 * (1 - tt)})`; c.beginPath(); c.arc(x, y, 1.5 + r() * 2.2, 0, 7); c.fill(); }
        const tubes = [["К", Dk, false], ["Дослід", D, true]]; tubes.forEach(([lab, d, mine], i) => { const x = bx + bw * (.3 + i * .35) - 15; Draw.tube(c, x, by - 38, 30, bh * .9, [{ frac: 1, color: mixHex("#F3E6C6", "#D9367E", cl01(d / .6)) }], { fill: .5, label: lab }); });
        Draw.text(c, "100 °C, 10 хв", bx + bw / 2, by + bh + 16, { align: "center", size: 11, color: T.muted });
        Draw.text(c, `D₅₃₂ = ${fmt(D, 3)}`, 12, 44, { size: 14, color: T.ink });
        fitText(c, "МДА + 2 ТБК → рожевий комплекс (λmax = 532 нм)", 12, 62, W - 24, { size: 11, color: T.muted });
        // молекула МДА: схема справа
        if (!nar) { const mx = bx + bw + 24, my = H * .4; Draw.text(c, "Мембрана", mx, 40, { size: 12, color: T.ink }); const danger = cl01((mda(S.s, S.prot) - 12) / 70);
          for (let i = 0; i < 12; i++) { const y = 60 + i * 10; c.strokeStyle = mixHex("#7FBF63", "#4B3A5E", danger * (i % 3 ? .7 : 1)); c.lineWidth = 4; c.beginPath(); c.moveTo(mx, y); c.lineTo(mx + 70, y); c.stroke(); } c.lineWidth = 1;
          Draw.text(c, danger > .4 ? "ПОЛ: мембрана пошкоджена" : "мембрана ціла", mx, 60 + 12 * 10 + 14, { size: 11, color: danger > .4 ? T.bad : T.muted }); void my; }
      } else {
        const ctrl = od(0) * k, std = od(40) * k, sam = od(noC(S.s) / S.f) * k; const bx = 14, by = H * .3, bh = H * .5; const items = [["Контроль", ctrl], ["Стандарт 40 мкмоль/л", std], ["Дослід", sam]]; const tw = (W - 40) / 3;
        items.forEach(([lab, e], i) => { const x = 20 + i * tw + tw / 2 - 16; Draw.tube(c, x, by - 20, 32, bh, [{ frac: 1, color: mixHex("#F6F1EA", "#B3197A", cl01((e - .01) / .5)) }], { fill: .5, label: i === 1 ? "ст." : i === 0 ? "К" : "Д" }); Draw.text(c, `E₅₅₀ = ${fmt(e, 3)}`, 20 + i * tw + tw / 2, by + bh + 14, { align: "center", size: 11, color: T.ink }); });
        fitText(c, "NO → NO₂⁻ + реактиви Гріса → азосполука (λ = 550 нм)", 12, 44, W - 24, { size: 12, color: T.ink });
        void time;
      }
    }
    function charts() {
      if (S.mode === "mda") {
        const D = Dmda(S.s, S.prot); const xs = Array.from({ length: 80 }, (_, i) => 400 + 250 * i / 79); const g = (l, m, s) => Math.exp(-.5 * ((l - m) / s) ** 2);
        drawChart(ch, { x: [400, 650], y: [0, 0.8], spectrum: true, xl: "λ, нм", yl: "A", series: [{ pts: xs.map(l => [l, D * (g(l, 532, 22) + .22 * g(l, 450, 30)) + .01]), color: Theme.c.antho, w: 2.4 }], vl: [{ x: 532, color: Theme.c.muted, label: "532" }] });
        const ss = Array.from({ length: 101 }, (_, i) => i);
        drawChart(ch2, { x: [0, 100], y: [0, 100], xl: "стрес, %", yl: "МДА, нмоль/г", legend: [{ color: Theme.c.antho, label: "без захисту" }, { color: Theme.c.chl, label: "антиоксидант 60 %" }], series: [{ pts: ss.map(s => [s, mda(s, 0)]), color: Theme.c.antho, w: 2.4 }, { pts: ss.map(s => [s, mda(s, 60)]), color: Theme.c.chl, w: 2.4 }], marks: [{ x: S.s, y: mda(S.s, S.prot), color: Theme.c.ink }] });
        const M = mda(S.s, S.prot); rd.set("a", fmt(D, 3)); rd.set("b", fmt(M, 1), "нмоль/г"); rd.set("c", fmt(S.s, 0), "%"); rd.set("d", M > 60 ? "високий" : M > 28 ? "помірний" : "низький");
      } else {
        const c = noC(S.s); drawChart(ch, { x: [0, 700], y: [0, 0.85], xl: "NO₂⁻, мкмоль/л", yl: "E₅₅₀", series: [{ pts: STD, color: Theme.c.data, w: 2.4, dots: 3 }], marks: [{ x: Math.min(700, c / S.f), y: od(c / S.f), color: Theme.c.antho, label: "дослід" }] });
        const ss = Array.from({ length: 101 }, (_, i) => i); drawChart(ch2, { x: [0, 100], y: [0, 140], xl: "стрес, %", yl: "NO, мкмоль/л", series: [{ pts: ss.map(s => [s, noC(s)]), color: Theme.c.antho, w: 2.4 }], marks: [{ x: S.s, y: c, color: Theme.c.ink }] });
        const ctrl = od(0), std = od(40), sam = od(c / S.f); const NO = (sam - ctrl) / (std - ctrl) * 40 * S.f / S.cb;
        rd.set("a", fmt(ctrl, 3)); rd.set("b", fmt(sam, 3)); rd.set("c", fmt(c, 1), "мкмоль/л"); rd.set("d", fmt(NO, 1), "мкмоль/г білка");
      }
    }
    return { stages: [st, ch, ch2], frame(dt, time) { if (S.play && dt > 0) { S.t = Math.min(12, S.t + dt * 1.6 * S.spd); ch.dirty = true; if (S.t >= 12) S.play = false; } else if (dt === 0 && S.t === 0) S.t = 12; draw(time); if (ch.dirty) { charts(); ch.dirty = false; } } };
  },
  cheat: `
<h3>Пероксидне окиснення ліпідів і ТБК-тест</h3>
<p>Під дією <b>активних форм кисню</b> поліненасичені жирні кислоти мембран окиснюються ланцюговою реакцією (<b>ПОЛ</b>); продукти її розпаду, зокрема <b>малоновий діальдегід (МДА)</b>, свідчать про пошкодження мембран. У кислому середовищі при кип’ятінні МДА реагує з <b>тіобарбітуровою кислотою (ТБК)</b>, утворюючи рожевий комплекс із максимумом поглинання при 532 нм. За накопиченням ТБК-активних продуктів оцінюють резистентність рослин до біотичних і абіотичних стресів.</p>
<div class="eq"><var>C</var> = <span class="fr"><span><var>D</var>·<var>V</var>·10⁶</span><span><var>ε</var>·<var>l</var>·<var>P</var></span></span></div>
<dl class="vars"><dt>D</dt><dd>оптична густина при 532 нм</dd><dt>V</dt><dd>об’єм реакційної суміші, мл (3)</dd><dt>ε</dt><dd>коефіцієнт молярної екстинкції, 1,56·10⁵ л·см⁻¹·моль⁻¹</dd><dt>l</dt><dd>товщина шару, 1 см</dd><dt>P</dt><dd>наважка, г (0,2)</dd></dl>
<p>Множник 10⁶ у цій моделі переводить мл → л і моль → нмоль (C — у нмоль/г сирої маси).</p>
<h3>Оксид азоту</h3>
<p><b>NO</b> — реакційноздатний радикал і вторинний месенджер. Він швидко окиснюється до нітриту NO₂⁻, а нітрит у реакції Гріса дає червоно-фіолетову азосполуку, її концентрацію вимірюють при 550 нм. Вміст NO у тканині розраховують за стандартом нітриту: <b>NO = (E<sub>д</sub> − E<sub>к</sub>)/(E<sub>ст</sub> − E<sub>к</sub>) · c<sub>ст</sub> · f / C<sub>білка</sub></b>, де c<sub>ст</sub> = 40 мкмоль/л, f — коефіцієнт розведення, C<sub>білка</sub> — вміст білка (г/л); білок визначають за Бредфорд.</p>
<div class="fix"><b>Про модель.</b> Залежності МДА й NO від стресу ілюстративні. Стандартну криву NO подано за даними посібника (8 точок від 0 до 700 мкмоль/л, лінійність у межах діапазону чутливості).</div>
<h3>До контрольних питань</h3>
<details class="qa"><summary>Чому МДА — маркер окисного стресу?</summary><p>Він утворюється при розпаді гідропероксидів поліненасичених жирних кислот: його кількість пропорційна інтенсивності ПОЛ і ступеню пошкодження мембран.</p></details>
<details class="qa"><summary>Навіщо потрібна ТХО і кип’ятіння?</summary><p>ТХО осаджує білки й створює кисле середовище; нагрівання потрібне для реакції МДА з ТБК.</p></details>
<details class="qa"><summary>Чому NO вимірюють через нітрит?</summary><p>NO живе секунди й перетворюється на нітрат і нітрит; нітрит кількісно вловлюється реактивом Гріса, а його концентрація лінійно залежить від кількості NO.</p></details>`,
});

App.boot();
