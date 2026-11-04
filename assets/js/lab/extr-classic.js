/* Класичні методи екстракції: мацерація, перколяція, настій/відвар, Сокслет, гідродистиляція, пресування, протитечія. */
import { reg, D, C, clamp, lerp, smooth, rng, hash01, fmt, mixHex, alpha, extractColor } from "./extr-core.js";

/* ====================== МАЦЕРАЦІЯ ====================== */
reg("macer", {
  aspect: 1.75,
  params: [
    { k: "stir", label: "Перемішування", min: 0, max: 100, step: 5, v: 0, u: "%" },
    { k: "d", label: "Розмір частинок", min: 1, max: 6, step: .5, v: 3, u: "мм", d: 1 },
  ],
  buttons: [
    { label: "Злити витяжку й залити свіжий екстрагент (ремацерація)", run: (S) => { S.K += S.q; S.q = 0; S.fresh = 1; S.drain = 1; S.n++; } },
  ],
  info: "Мацерація — рівноважний процес: витяжка насичується, і рушійна сила (Cs − C) падає. <b>Перемішування</b> стоншує дифузійний шар, <b>дрібніші частинки</b> скорочують шлях дифузії, а <b>заміна екстрагенту</b> повертає градієнт — тому кілька порцій ефективніші за одну тієї самої сумарної ваги.",
  init() {
    const r = rng(11), parts = []; for (let i = 0; i < 30; i++) parts.push({ x: r(), y: r(), vx: 0, vy: 0, rot: r() * 6, L: 1, ph: r() * 6 });
    const dots = []; for (let i = 0; i < 70; i++) dots.push({ x: r(), y: r(), a: r() * 6, s: .4 + r() });
    return { parts, dots, q: 0, K: 0, drain: 0, fresh: 0, n: 1, th: 0, ang: 0 };
  },
  step(S, P, dt) {
    const h = dt * 3;                       // 1 с моделі ≈ 3 год
    const k = .26 * (.3 + P.stir / 100 * 1.4) / Math.pow(P.d / 3, 2), p = .22;
    let dq = 0;
    for (const o of S.parts) { const dL = -k * (o.L - p * S.q) * h; const nl = Math.max(0, o.L + dL); dq += (o.L - nl) / S.parts.length; o.L = nl; }
    S.q += dq; S.th += h; S.ang += dt * (P.stir / 100) * 14;
    if (S.drain > 0) S.drain = Math.max(0, S.drain - dt * 1.4);
    if (S.fresh > 0) S.fresh = Math.max(0, S.fresh - dt * .6);
    const sp = P.stir / 100, rr = rng(S.parts.length);
    for (const o of S.parts) {                // рух частинок: осідання + вихор
      o.vy += (.16 - o.y * 0 + .02) * dt; o.vx += (Math.sin(o.ph + S.ang * .6) * .5 * sp) * dt * 1.5; o.vy += (Math.cos(o.ph * 1.7 + S.ang * .5) * .5 * sp - .08) * dt;
      o.vx *= .96; o.vy *= .96; o.x = clamp(o.x + o.vx * dt * 2, .03, .97); o.y = clamp(o.y + o.vy * dt * 2, .04, .96);
      if (o.y > .94) o.vy *= -.2; if (o.y < .05) o.vy = Math.abs(o.vy);
    }
    for (const d of S.dots) { d.a += dt * (.4 + sp * 2) * d.s; d.x = clamp(d.x + Math.cos(d.a) * dt * .03 * d.s, .03, .97); d.y = clamp(d.y + Math.sin(d.a * 1.3) * dt * .03, .05, .95); }
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const h = H / 400;
    const tx = W * .08, tw = W * .42, ty = 80 * h, th = 270 * h;
    // бак з нержавіючої сталі
    const g = c.createLinearGradient(tx - 14, 0, tx + tw + 14, 0); g.addColorStop(0, "#9AA8AF"); g.addColorStop(.5, "#E3E9EC"); g.addColorStop(1, "#8E9BA2"); c.fillStyle = g; D.rr(c, tx - 14, ty - 8, tw + 28, th + 26, 16); c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 1.5; c.stroke();
    const lvl = .86 - S.drain * .5, col = extractColor(S.q * 1.25, "green");
    D.vessel(c, D.beakerPath(tx, ty, tw, th, 14), tx, ty, tw, th, lvl, col, { a: .9, deep: extractColor(S.q * 1.35, "green"), inside: (cc) => {
      const ly = ty + th * (1 - lvl);
      for (const d of S.dots) { if (d.x * tw + tx < 0) continue; const vis = hash01(S.dots.indexOf(d), 3) < Math.min(1, S.q * 1.2 + .02); if (!vis) continue; cc.fillStyle = "rgba(150,90,10,.75)"; cc.beginPath(); cc.arc(tx + d.x * tw, ly + d.y * (ty + th - ly), 1.9, 0, 7); cc.fill(); }
      for (const o of S.parts) { const px = tx + o.x * tw, py = Math.max(ly + 8, ty + o.y * th); D.chip(cc, px, py, 7.5 * (P.d / 3) ** .55 + 1, o.rot + S.th * .01 * (P.stir / 100), mixHex("#4F8F45", "#B9B07A", 1 - o.L), o.L); }
    } });
    // мішалка
    const sx = tx + tw / 2; c.fillStyle = C.steelD; c.fillRect(sx - 3, ty - 40 * h, 6, 40 * h + th * (1 - lvl) + th * lvl * .72);
    D.rr(c, sx - 22, ty - 64 * h, 44, 28 * h, 5); c.fillStyle = "#4C5C64"; c.fill(); D.txt(c, "М", sx, ty - 50 * h, { color: "#fff", size: 12, align: "center", weight: 800 });
    const by = ty + th * .8, bl = 52 * Math.abs(Math.cos(S.ang)); c.fillStyle = C.steelD; c.fillRect(sx - bl / 2, by - 3, bl, 6); c.fillStyle = "#6B7B83"; c.fillRect(sx - 52 * Math.abs(Math.sin(S.ang)) / 2, by - 24, 52 * Math.abs(Math.sin(S.ang)), 5);
    D.tag(c, P.stir > 0 ? "динамічна мацерація" : "статична мацерація", tx + tw / 2, ty + th + 40 * h, { size: 11 });
    // права панель: графік
    const cx = W * .6, cw = W * .36, cy = 56 * h, ch = 170 * h;
    c.save(); const pts = (S.hist ||= []); if (!S.hist.length || S.th - S.hist[S.hist.length - 1][0] > .5) S.hist.push([S.th, (S.K + S.q) * 100]); c.restore();
    D.chart(c, cx + 20, cy, cw - 20, ch, { x: [0, Math.max(60, S.th * 1.05)], y: [0, 100], xl: "год", yl: "вилучено, %", series: [{ pts: S.hist.concat([[S.th, (S.K + S.q) * 100]]), col: C.green, w: 2.6, fill: "rgba(47,125,79,.12)" }], hl: [{ y: 100 * (1 / 1.22), col: C.amber, label: "рівновага однієї порції ≈ 82 %" }], title: "Сумарне вилучення БАР" });
    // індикатори
    const bar = (y, lab, v, col) => { D.txt(c, lab, cx + 20, y, { size: 11.5, color: C.soft }); c.fillStyle = "#E3EEE5"; D.rr(c, cx + 20, y + 8, cw - 20, 11, 5); c.fill(); c.fillStyle = col; D.rr(c, cx + 20, y + 8, Math.max(0, (cw - 20) * clamp(v, 0, 1)), 11, 5); c.fill(); };
    bar(cy + ch + 40 * h, `у витяжці: ${fmt(S.q * 100, 0)} %`, S.q, C.green);
    bar(cy + ch + 78 * h, `зібрано з попередніх порцій: ${fmt(S.K * 100, 0)} %`, S.K, C.amber);
    bar(cy + ch + 116 * h, `залишилось у шроті: ${fmt(S.parts.reduce((a, o) => a + o.L, 0) / S.parts.length * 100, 0)} %`, S.parts.reduce((a, o) => a + o.L, 0) / S.parts.length, C.brown);
    if (S.fresh > 0) D.tag(c, "свіжий екстрагент", tx + tw / 2, ty + 18, { bg: "#E8F4FB", stroke: C.blue, color: C.blue });
  },
  reads: (S) => [["Час", fmt(S.th, 0), "год"], ["Порція №", String(S.n)], ["Вилучено разом", fmt((S.K + S.q) * 100, 0), "%"]],
});

/* ====================== ПЕРКОЛЯЦІЯ ====================== */
reg("perc", {
  aspect: 1.75,
  modes: [["one", "Проста перколяція"], ["bat", "Реперколяція (батарея з 3 перколяторів)"]],
  params: [{ k: "u", label: "Швидкість перколяції", min: 1, max: 10, step: 1, v: 4, f: (v) => `1/${Math.round(96 / v)} об'єму за год` }],
  info: "Свіжий екстрагент весь час контактує з сировиною — градієнт концентрації максимальний, тому процес наближається до вичерпного. Занадто швидкий потік не встигає насититися, занадто повільний — зайве витрачає час. У <b>реперколяції</b> слабкі витяжки з майже виснаженого перколятора стають екстрагентом для свіжого, тож міцний екстракт виходить без випарювання.",
  init(P) {
    const N = 14, mk = (x0) => ({ x: Array(N).fill(x0), y: Array(N).fill(0) });
    const cols = P.mode === "bat" ? [mk(.12), mk(.55), mk(1)] : [mk(1)];
    return { cols, N, coll: 0, out: 0, drops: [], hist: [], vol: 0, acc: 0, sum: 0, th: 0 };
  },
  step(S, P, dt) {
    const h = dt * 1.6, N = S.N, u = P.u * .9, m = .5;
    S.th += h; let inflow = 0, outC = 0;
    for (let ci = 0; ci < S.cols.length; ci++) {
      const col = S.cols[ci], a = clamp(u * h * .5, 0, .9), y = col.y, x = col.x, prev = ci === 0 ? 0 : S.cols[ci - 1].y[N - 1];
      for (let i = N - 1; i >= 0; i--) { const up = i === 0 ? prev : y[i - 1]; y[i] += a * (up - y[i]); }
      for (let i = 0; i < N; i++) { const ex = .55 * h * (x[i] - m * y[i] * 2.2); const mv = clamp(ex, -x[i], 1); x[i] -= mv; y[i] += mv * .55; y[i] = clamp(y[i], 0, 1.6); }
      if (ci === S.cols.length - 1) outC = y[N - 1];
    }
    S.out = outC; S.vol += a0(u, h); S.coll += outC * a0(u, h); S.sum = S.coll;
    const a0f = a0(u, h); S.acc += a0f; if (S.hist.length === 0 || S.vol - S.hist[S.hist.length - 1][0] > .15) S.hist.push([S.vol, outC]);
    S.dropT = (S.dropT || 0) + dt * (1 + P.u * .6); if (S.dropT > 1) { S.dropT = 0; S.drops.push({ y: 0, col: outC }); }
    for (const d of S.drops) d.y += dt * 2.6; S.drops = S.drops.filter(d => d.y < 1);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const h = H / 400, N = S.N, nc = S.cols.length;
    const cw = nc === 1 ? 92 * h : 70 * h, gap = nc === 1 ? 0 : 36 * h, total = nc * cw + (nc - 1) * gap, x0 = W * .06 + (nc === 1 ? 30 * h : 0);
    const ty = 62 * h, th = 232 * h;
    for (let ci = 0; ci < nc; ci++) {
      const col = S.cols[ci], x = x0 + ci * (cw + gap), cell = th * .74 / N;
      // резервуар / крапельниця
      if (ci === 0) { D.rr(c, x + cw / 2 - 20 * h, 4 * h, 40 * h, 34 * h, 6); c.fillStyle = alpha("#2E6FB5", .22); c.fill(); c.strokeStyle = C.glass; c.lineWidth = 1.6; c.stroke(); D.txt(c, "екстрагент", x + cw / 2, 21 * h, { size: 10, align: "center", color: C.blue }); }
      else { const pc = S.cols[ci - 1].y[N - 1]; c.fillStyle = extractColor(pc * 1.1, "green"); c.beginPath(); c.arc(x + cw / 2, ty - 10 * h, 3.4, 0, 7); c.fill(); }
      c.strokeStyle = C.glass; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + cw / 2, 38 * h); c.lineTo(x + cw / 2, ty); c.stroke();
      D.vessel(c, (cc) => { cc.beginPath(); cc.moveTo(x, ty); cc.lineTo(x, ty + th - 24 * h); cc.lineTo(x + cw * .4, ty + th); cc.lineTo(x + cw * .6, ty + th); cc.lineTo(x + cw, ty + th - 24 * h); cc.lineTo(x + cw, ty); }, x, ty, cw, th, .94, "#EAF4E4", { a: .5, inside: (cc) => {
        const by = ty + 14 * h;
        for (let i = 0; i < N; i++) {
          const yy = by + i * cell; const lc = extractColor(col.y[i] * 1.3, "green"); cc.fillStyle = lc; cc.globalAlpha = .55; cc.fillRect(x, yy, cw, cell + .5); cc.globalAlpha = 1;
          const lo = col.x[i]; const r2 = rng(i * 7 + ci * 31 + 3); for (let k = 0; k < 7; k++) { D.chip(cc, x + 8 + r2() * (cw - 16), yy + r2() * cell, 4.4, r2() * 6, mixHex("#B9B07A", "#4F8F45", lo)); }
        }
        cc.fillStyle = "#cdd8d2"; cc.fillRect(x, ty + th - 26 * h, cw, 3);
      } });
      D.txt(c, nc === 1 ? "шар сировини" : `перколятор ${ci + 1}`, x + cw / 2, ty + th + 14 * h, { size: 10.5, align: "center", color: C.soft });
      if (ci < nc - 1) { D.arrow(c, x + cw * .5, ty + th - 6 * h, x + cw + gap * .5, ty + th + 20 * h, C.green, 1.6, 5); c.strokeStyle = alpha(C.green, .5); c.lineWidth = 1.4; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x + cw + gap * .5, ty + th + 20 * h); c.lineTo(x + cw + gap + cw / 2, ty - 10 * h); c.stroke(); c.setLineDash([]); }
    }
    // приймач
    const lx = x0 + (nc - 1) * (cw + gap) + cw / 2, ry = ty + th + 22 * h, rw = 66 * h, rh = 64 * h;
    const frac = clamp(S.vol / 12, 0, 1) * .85; D.vessel(c, D.flaskPath(lx, ry + rh * .62, rh * .5, 22 * h, 14 * h), lx - rh * .5, ry, rh, rh * 1.1, frac * .8, extractColor(S.coll / Math.max(.4, S.vol) * 1.4, "green"), {});
    for (const d of S.drops) { c.fillStyle = extractColor(d.col * 1.3, "green"); c.beginPath(); c.arc(lx, ty + th + d.y * 22 * h, 2.8, 0, 7); c.fill(); }
    // графік
    const gx = x0 + total + 54 * h, gw = W - gx - 18, gy = 56 * h, gh = 150 * h;
    if (gw > 120) {
      D.chart(c, gx + 8, gy, gw - 8, gh, { x: [0, Math.max(14, S.vol * 1.1)], y: [0, 1], xl: "об'єм екстрагенту, умовні од.", yl: "C витяжки", series: [{ pts: S.hist.concat([[S.vol, S.out]]), col: C.green, w: 2.6, fill: "rgba(47,125,79,.12)" }], title: "Концентрація на виході" });
      const left = S.cols.reduce((a, col) => a + col.x.reduce((s, v) => s + v, 0) / S.N, 0) / nc;
      D.txt(c, `У шарі лишилось: ${fmt(left * 100, 0)} %`, gx + 8, gy + gh + 44 * h, { size: 12, weight: 700, color: C.brown });
      D.txt(c, `Зібрано БАР (сум.): ${fmt(S.coll * 100 / (nc === 1 ? 5.2 : 8), 0)} %`, gx + 8, gy + gh + 64 * h, { size: 12, weight: 700, color: C.greenD });
    }
  },
  reads: (S, P) => [["Об'єм екстрагенту", fmt(S.vol / 3, 1), "шарів"], ["Концентрація на виході", fmt(S.out * 100, 0), "%"], ["Режим", P.mode === "bat" ? "батарея 3×" : "один шар"]],
});
const a0 = (u, h) => clamp(u * h * .5, 0, .9);

/* ====================== НАСТІЙ / ВІДВАР ====================== */
reg("decoct", {
  aspect: 1.75,
  modes: [["inf", "Настій (листя, квіти, трава)"], ["dec", "Відвар (кора, коріння, шкірясте листя)"]],
  params: [{ k: "T", label: "Температура бані", min: 70, max: 100, step: 1, v: 98, u: "°C" }],
  toggles: [{ k: "hot", label: "Проціджувати гарячим (для сировини з дубильними речовинами)", v: true }],
  info: "Настій: нагрівання на киплячій водяній бані 15 хв, настоювання 45 хв, проціджування. Відвар: нагрівання 30 хв, <b>проціджування гарячим</b> — дубильні речовини при охолодженні випадають в осад. Леткі компоненти (ефірна олія) тим часом губляться з парою, тож для ефіроолійної сировини цей спосіб непридатний.",
  init(P) { return { th: 0, poly: 0, tann: 0, vol: 0, prec: 0, T: 22, hist: [], steam: [] }; },
  step(S, P, dt) {
    const h = dt * 1.6, plan = P.mode === "dec" ? [30, 0] : [15, 45], total = plan[0] + plan[1];
    S.th += h; const heating = S.th <= plan[0], done = S.th >= total;
    S.T += ((heating ? P.T : done && !P.hot ? 20 : heating ? P.T : 55) - S.T) * clamp(h * .22, 0, 1);
    if (!heating && !done && P.mode === "inf") S.T += ((60 - S.T) * clamp(h * .05, 0, 1)); // повільно остигає під кришкою
    const kT = Math.exp((S.T - 90) / 22);
    if (!done) { S.poly += (1 - S.poly) * .035 * kT * h * (P.mode === "dec" ? .8 : 1); S.tann += (1 - S.tann) * .045 * kT * h; S.vol += (heating ? 0 : 0) + (S.T > 78 ? (.012 * Math.exp((S.T - 78) / 12) * h * (S.vol0 ?? 1)) : 0); S.vol = Math.max(0, Math.min(1, S.vol)); }
    S.oil = Math.max(0, (S.oil ?? 0) + (.02 * (1 - (S.oil ?? 0)) - .012 * Math.exp((S.T - 78) / 12) * (S.oil ?? 0)) * h);
    if (done && !S.checked) { S.checked = true; S.prec = P.hot ? 0 : S.tann * .38; }
    if (S.hist.length === 0 || S.th - S.hist[S.hist.length - 1][0] > 1.2) S.hist.push([S.th, S.poly, S.tann, S.oil]);
    if (S.T > 80 && Math.random() < dt * 10) S.steam.push({ x: .3 + Math.random() * .4, y: 0, a: Math.random() * 6 });
    for (const p of S.steam) { p.y += dt * .55; p.a += dt * 2; } S.steam = S.steam.filter(p => p.y < 1);
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const h = H / 400, plan = P.mode === "dec" ? [30, 0] : [15, 45], total = plan[0] + plan[1];
    // водяна баня
    const bx = W * .06, bw = W * .44, by = 190 * h, bh = 130 * h;
    D.rr(c, bx, by, bw, bh, 12); c.fillStyle = "#C9D5DA"; c.fill(); c.strokeStyle = C.steelD; c.stroke();
    D.vessel(c, (cc) => D.rr(cc, bx + 8, by + 10, bw - 16, bh - 18, 8), bx + 8, by + 10, bw - 16, bh - 18, .72, "#A8D2EE", { a: .8 });
    // колба/склянка з сировиною
    const fx = bx + bw / 2, fw = 120 * h, fy = 78 * h, fh = 150 * h; const col = extractColor(S.poly * .9 + S.tann * .3, "tea");
    D.vessel(c, D.beakerPath(fx - fw / 2, fy, fw, fh, 10), fx - fw / 2, fy, fw, fh, .62, col, { inside: (cc, l) => { const r = rng(5); for (let i = 0; i < 16; i++) D.chip(cc, fx - fw / 2 + 10 + r() * (fw - 20), fy + fh * (.45 + r() * .45) + Math.sin(t * 1.2 + i) * 2, 6, r() * 6 + t * .1, mixHex("#4F8F45", "#B9B07A", S.poly * .8)); if (S.prec > .02) { cc.fillStyle = `rgba(110,60,20,${.2 + S.prec})`; cc.fillRect(fx - fw / 2, fy + fh - 12 * h * (1 + S.prec * 3), fw, 12 * h * (1 + S.prec * 3)); } } });
    D.rr(c, fx - fw / 2 - 6, fy - 8, fw + 12, 9, 4); c.fillStyle = "#8C9AA2"; c.fill();
    for (const p of S.steam) { c.fillStyle = `rgba(255,255,255,${.7 * (1 - p.y)})`; c.beginPath(); c.arc(bx + bw * (.1 + p.x * .8) + Math.sin(p.a) * 6, by + 6 - p.y * 80 * h, 5 + p.y * 9, 0, 7); c.fill(); }
    // пальник
    const heat = clamp((S.T - 25) / 75, 0, 1) * (S.th < total ? 1 : .2); for (let i = 0; i < 8; i++) { const fx2 = bx + 24 + i * (bw - 48) / 7; c.fillStyle = `rgba(255,${120 + 40 * Math.sin(t * 8 + i)},40,${.2 + .7 * heat})`; c.beginPath(); c.ellipse(fx2, by + bh + 12 * h, 6, 11 * (.4 + heat * .8), 0, 0, 7); c.fill(); }
    // термометр
    const tx = bx + bw - 16; c.fillStyle = "#fff"; D.rr(c, tx, by - 70 * h, 12, 100 * h, 6); c.fill(); c.strokeStyle = C.steelD; c.stroke(); c.fillStyle = C.red; D.rr(c, tx + 3, by + 30 * h - 90 * h * clamp(S.T / 100, 0, 1) - 2, 6, 90 * h * clamp(S.T / 100, 0, 1) + 2, 3); c.fill();
    D.txt(c, `${fmt(S.T, 0)} °C`, tx + 6, by - 82 * h, { size: 11.5, align: "center", weight: 800, color: C.red });
    // етапи
    const stage = S.th <= plan[0] ? "нагрівання на бані" : S.th < total ? "настоювання (остигає)" : "готово: проціджування";
    D.tag(c, stage, bx + bw / 2, 34 * h, { size: 12, bg: S.th >= total ? "#E6F4EA" : "#fff" });
    c.fillStyle = "#E3EEE5"; D.rr(c, bx, 56 * h, bw, 8, 4); c.fill(); c.fillStyle = C.green; D.rr(c, bx, 56 * h, bw * clamp(S.th / total, 0, 1), 8, 4); c.fill();
    D.txt(c, `${fmt(Math.min(S.th, total), 0)} / ${total} хв`, bx + bw, 74 * h, { size: 10.5, align: "right", color: C.muted });
    // графік
    const gx = W * .6, gw = W * .36, gy = 56 * h, gh = 200 * h;
    D.chart(c, gx + 20, gy, gw - 20, gh, { x: [0, total], y: [0, 1], xl: "хв", yl: "вміст у витяжці, відн.", series: [{ pts: S.hist.map(p => [p[0], p[1]]), col: C.green, w: 2.4 }, { pts: S.hist.map(p => [p[0], p[2]]), col: C.brown, w: 2.4 }, { pts: S.hist.map(p => [p[0], p[3]]), col: C.amber, w: 2.4, dash: [5, 4] }] });
    const lg = (x, y, col, tx) => { c.fillStyle = col; c.fillRect(x, y - 2, 14, 4); D.txt(c, tx, x + 20, y, { size: 11, color: C.soft }); };
    lg(gx + 24, gy + gh + 36 * h, C.green, "полісахариди, глікозиди"); lg(gx + 24, gy + gh + 54 * h, C.brown, "дубильні речовини"); lg(gx + 24, gy + gh + 72 * h, C.amber, "леткі (ефірна олія)");
    if (S.prec > .02) D.tag(c, "дубильні випали в осад", fx, fy + fh + 18 * h, { bg: "#FDECEA", stroke: C.red, color: C.red });
  },
  reads: (S, P) => [["Температура", fmt(S.T, 0), "°C"], ["Полісахариди", fmt(S.poly * 100, 0), "%"], ["Дубильні", fmt(S.tann * 100, 0), "%"], ["Леткі", fmt((S.oil || 0) * 100, 0), "%"]],
});

/* ====================== ХОЛОДНЕ ПРЕСУВАННЯ ====================== */
reg("press", {
  aspect: 1.75,
  params: [{ k: "sp", label: "Швидкість шнека", min: 10, max: 100, step: 5, v: 40, u: "%" }, { k: "gap", label: "Зазор на виході (вичавлювання)", min: 20, max: 100, step: 5, v: 60, u: "%" }],
  info: "Шнековий прес стискає сировину в камері з щілинами: олія стікає крізь щілини, макуха виходить із торця. <b>Холодне пресування</b> веде процес при T < 40–50 °C (нативний склад, без розчинника), але в макусі лишається 8–15 % олії. Швидкий шнек і малий зазор підвищують вихід, проте нагрівають матеріал.",
  init() { return { ang: 0, seeds: [], cake: [], drops: [], oil: 0, T: 24, fed: 0 }; },
  step(S, P, dt) {
    const sp = P.sp / 100, cl = 1 - P.gap / 100;
    S.ang += dt * sp * 7; S.T += ((24 + 38 * sp * (.5 + cl * .9)) - S.T) * dt * .5; const r = Math.random;
    if (r() < dt * 7 * sp) S.seeds.push({ s: 0, y: r() });
    for (const e of S.seeds) e.s += dt * sp * .22; S.seeds = S.seeds.filter(e => { if (e.s >= 1) { S.cake.push({ x: 0, y: r() }); return false; } return true; });
    for (const k of S.cake) k.x += dt * .8; S.cake = S.cake.filter(k => k.x < 1);
    const yld = (.72 + .2 * cl + .08 * sp) * (S.T > 50 ? 1.02 : 1);
    S.rate = sp * 5 * yld; S.oil += dt * S.rate * .6; S.fed += dt * sp * 2;
    if (r() < dt * 12 * sp * (.4 + yld)) S.drops.push({ x: .25 + r() * .5, y: 0 }); for (const d of S.drops) d.y += dt * 2.6; S.drops = S.drops.filter(d => d.y < 1);
    S.yld = yld;
  },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const h = H / 400, sp = P.sp / 100, cl = 1 - P.gap / 100;
    const bx = W * .08, bw = W * .56, by = 150 * h, bh = 74 * h;
    // бункер
    c.fillStyle = "#97A5AC"; c.beginPath(); c.moveTo(bx + 10, by - 70 * h); c.lineTo(bx + 130 * h, by - 70 * h); c.lineTo(bx + 100 * h, by); c.lineTo(bx + 40 * h, by); c.closePath(); c.fill(); c.strokeStyle = C.steelD; c.stroke();
    const r2 = rng(6); for (let i = 0; i < 14; i++) D.chip(c, bx + 24 + r2() * 90 * h, by - 56 * h + r2() * 44 * h, 5, r2() * 6, "#8E7B3C");
    D.txt(c, "насіння / ягоди", bx + 70 * h, by - 80 * h, { size: 11, align: "center", color: C.soft });
    // барель
    const g = c.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, "#C9D4D9"); g.addColorStop(.5, "#EEF2F4"); g.addColorStop(1, "#8D9AA1"); c.fillStyle = g; D.rr(c, bx, by, bw, bh, 12); c.fill(); c.strokeStyle = C.steelD; c.lineWidth = 1.6; c.stroke();
    // щілини
    c.fillStyle = "#3b464c"; for (let i = 0; i < 14; i++) c.fillRect(bx + 60 * h + i * (bw - 130 * h) / 14, by + bh - 4, 3, 6);
    // шнек (витки)
    c.save(); D.rr(c, bx + 6, by + 6, bw - 12, bh - 12, 8); c.clip(); c.fillStyle = "#5F6E76"; c.fillRect(bx, by + bh / 2 - 6, bw, 12);
    const pitch = 26 * h; for (let i = -2; i < (bw / pitch) + 2; i++) { const x0 = bx + i * pitch + (S.ang * 12 * h) % pitch; c.strokeStyle = "#394850"; c.lineWidth = 4 - cl * 1.2 * (i / 30); c.beginPath(); c.moveTo(x0, by + 8); c.lineTo(x0 + pitch * .5, by + bh - 8); c.stroke(); c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0 + 2, by + 8); c.lineTo(x0 + pitch * .5 + 2, by + bh - 8); c.stroke(); }
    // стиснення
    for (const e of S.seeds) D.chip(c, bx + 12 + e.s * (bw - 24), by + 14 + e.y * (bh - 28), 5 * (1 - e.s * .5), e.s * 8, "#8E7B3C"); c.restore();
    // конусний вихід + макуха
    c.fillStyle = "#6D7B83"; c.beginPath(); c.moveTo(bx + bw, by + 6); c.lineTo(bx + bw + 40 * h, by + 6 + (bh - 12) * (.5 - (P.gap / 100) * .38)); c.lineTo(bx + bw + 40 * h, by + bh - 6 - (bh - 12) * (.5 - (P.gap / 100) * .38)); c.lineTo(bx + bw, by + bh - 6); c.closePath(); c.fill();
    for (const k of S.cake) { c.fillStyle = "#6E5A22"; D.rr(c, bx + bw + 40 * h + k.x * 70 * h, by + 22 + k.y * (bh - 44) + k.x * k.x * 90 * h, 11, 6, 3); c.fill(); }
    const heap = clamp(S.fed / 40, 0, 1); c.fillStyle = "#6E5A22"; c.beginPath(); c.moveTo(bx + bw + 40 * h, 330 * h); c.quadraticCurveTo(bx + bw + 100 * h, 330 * h - 70 * h * heap, bx + bw + 150 * h, 330 * h); c.fill(); D.txt(c, "макуха", bx + bw + 95 * h, 345 * h, { size: 11, align: "center", color: C.soft });
    // олія
    for (const d of S.drops) { c.fillStyle = C.oil; c.beginPath(); c.ellipse(bx + 60 * h + d.x * (bw - 130 * h), by + bh + 4 + d.y * 80 * h, 2.4, 3.6, 0, 0, 7); c.fill(); }
    const ox = bx + bw * .4, oy = 258 * h, ow = 90 * h, oh = 84 * h, lvl = clamp(S.oil / 60, 0, 1) * .75;
    D.vessel(c, D.beakerPath(ox, oy, ow, oh, 8), ox, oy, ow, oh, lvl, "#E9B93A", { a: .92 }); D.txt(c, "олія", ox + ow / 2, oy + oh + 14 * h, { size: 11, align: "center", color: C.soft });
    // термометр
    const T = S.T, tc = T > 50 ? C.red : T > 40 ? C.amber : C.green; D.tag(c, `T барелю ≈ ${fmt(T, 0)} °C`, W * .78, 60 * h, { bg: "#fff", stroke: tc, color: tc, size: 12 });
    D.txt(c, T > 50 ? "перегрів: окиснення, втрата якості" : T > 40 ? "межа «холодного» пресування" : "холодне пресування", W * .78, 84 * h, { size: 11, align: "center", color: tc, weight: 700 });
    D.txt(c, `Вихід олії ≈ ${fmt(S.yld * 100, 0)} %`, W * .78, 130 * h, { size: 14, align: "center", weight: 800, color: C.greenD }); D.txt(c, `У макусі лишається ≈ ${fmt((1 - S.yld) * 100, 0)} %`, W * .78, 152 * h, { size: 12, align: "center", color: C.brown });
    const bar = (y, v, col) => { c.fillStyle = "#E3EEE5"; D.rr(c, W * .78 - 80, y, 160, 11, 5); c.fill(); c.fillStyle = col; D.rr(c, W * .78 - 80, y, 160 * clamp(v, 0, 1), 11, 5); c.fill(); }; bar(166 * h, S.yld, C.amber);
  },
  reads: (S, P) => [["Температура", fmt(S.T, 0), "°C"], ["Вихід олії", fmt(S.yld * 100, 0), "%"], ["Залишок у макусі", fmt((1 - S.yld) * 100, 0), "%"]],
});

/* ====================== ПРОТИТЕЧІЯ ====================== */
const ccSolve = (N, A, counter) => {   // A = L/(m·S): співвідношення рідини й «утримання» твердої фази
  if (!counter) { const phi = (A / N) / (A / N + 1); return { rec: 1 - Math.pow(1 - phi, N), y: Array(N).fill(0), x: Array(N).fill(0) }; }
  const y = Array(N + 2).fill(0), x = Array(N + 2).fill(0); x[0] = 1;                 // x: частка у твердій; y: концентрація (рівноважна)
  // рівняння ступені i: x_{i-1} + A·m·y_{i+1}... у безрозмірній формі: x_i = y_i (рівновага), x_{i-1} + A y_{i+1} = (1 + A) y_i
  for (let it = 0; it < 400; it++) for (let i = 1; i <= N; i++) { y[i] = (x[i - 1] + A * (i === N ? 0 : y[i + 1])) / (1 + A); x[i] = y[i]; }
  const outSolid = x[N]; const rec = 1 - outSolid; return { rec, y: y.slice(1, N + 1), x: x.slice(1, N + 1) };
};
reg("cc", {
  aspect: 1.75,
  modes: [["ct", "Протитечія"], ["cr", "Свіжий екстрагент у кожну ступінь (для порівняння)"]],
  params: [{ k: "N", label: "Кількість ступенів (апаратів)", min: 1, max: 8, step: 1, v: 5 }, { k: "A", label: "Витрата екстрагенту L/S", min: .5, max: 4, step: .1, v: 1.5, d: 1, u: "відн." }],
  info: "У протитечійній схемі сировина і екстрагент рухаються назустріч: <b>найбагатша витяжка контактує зі свіжою сировиною, а найчистіший екстрагент — з майже виснаженою</b>. Рушійна сила зберігається вздовж усього апарата, тож при тій самій витраті розчинника вилучення вище, а витяжка концентрованіша, ніж при подачі свіжого екстрагенту в кожну ступінь.",
  init() { const r = rng(4), dots = []; for (let i = 0; i < 60; i++) dots.push({ s: r(), k: r() < .5 ? 0 : 1 }); return { dots, ph: 0 }; },
  step(S, P, dt) { for (const d of S.dots) { d.s += dt * (d.k === 0 ? .12 : -.12); if (d.s > 1) d.s -= 1; if (d.s < 0) d.s += 1; } S.ph += dt; },
  draw(c, S, P, W, H, t) {
    D.bg(c, W, H); const h = H / 400, N = P.N, A = P.A, counter = P.mode === "ct", res = ccSolve(N, A, counter);
    const x0 = W * .06, w = W * .88, cw = Math.min(70 * h, w / (N + .6) - 14 * h), step = (w - cw) / Math.max(1, N - 1) * (N > 1 ? 1 : 0), y0 = 150 * h, ch = 130 * h;
    // потоки
    D.arrow(c, x0, 96 * h, x0 + w, 96 * h, C.brown, 2, 8); D.txt(c, "сировина (свіжа → виснажена)", x0 + 4, 80 * h, { size: 11.5, color: C.brown, weight: 700 });
    if (counter) { D.arrow(c, x0 + w, 340 * h, x0, 340 * h, C.blue, 2, 8); D.txt(c, "екстрагент (чистий → міцна витяжка)", x0 + w - 4, 358 * h, { size: 11.5, color: C.blue, weight: 700, align: "right" }); }
    for (let i = 0; i < N; i++) {
      const x = N === 1 ? x0 + (w - cw) / 2 : x0 + i * step, fresh = !counter ? (A / N) : 0;
      const yv = counter ? res.y[i] : 0, xv = counter ? res.x[i] : Math.pow(1 - (A / N) / (A / N + 1), i + 1);
      const yc = counter ? yv : (1 - xv) * .6;
      D.vessel(c, D.beakerPath(x, y0, cw, ch, 10), x, y0, cw, ch, .8, extractColor(counter ? yv * 1.2 : (xv > 0 ? yc * 1.0 : 0), "green"), { a: .85, inside: (cc) => { const r2 = rng(i * 5 + 1); for (let k = 0; k < 10; k++) D.chip(cc, x + 6 + r2() * (cw - 12), y0 + ch * (.35 + r2() * .55), 4.4, r2() * 6, mixHex("#B9B07A", "#4F8F45", clamp(xv, 0, 1))); } });
      D.txt(c, String(i + 1), x + cw / 2, y0 + ch + 14 * h, { size: 11.5, weight: 700, align: "center", color: C.soft });
      if (!counter) D.arrow(c, x + cw / 2, y0 - 36 * h, x + cw / 2, y0 - 6, C.blue, 1.6, 5);
      if (i < N - 1 && counter) { c.strokeStyle = alpha(C.blue, .5); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + cw + 4, y0 + ch * .7); c.lineTo(x + step - 4, y0 + ch * .7); c.stroke(); }
    }
    if (!counter) D.txt(c, "свіжий екстрагент у кожну ступінь", x0 + w / 2, 126 * h, { size: 11, align: "center", color: C.blue });
    // точки-потоки
    for (const d of S.dots) { const xx = x0 + d.s * w; if (d.k === 0) { c.fillStyle = alpha(C.brown, .75); c.beginPath(); c.arc(xx, 96 * h + Math.sin(d.s * 40) * 3, 2.6, 0, 7); c.fill(); } else if (counter) { c.fillStyle = alpha(C.blue, .7); c.beginPath(); c.arc(xx, 340 * h + Math.sin(d.s * 33) * 3, 2.6, 0, 7); c.fill(); } }
    // результат
    D.tag(c, `Вилучено: ${fmt(res.rec * 100, 0)} %`, W * .5, 30 * h, { size: 15, bg: "#fff", stroke: C.green, color: C.greenD });
  },
  reads: (S, P) => { const a = ccSolve(P.N, P.A, true), b = ccSolve(P.N, P.A, false); return [["Протитечія", fmt(a.rec * 100, 0), "%"], ["Свіжий у кожну ступінь", fmt(b.rec * 100, 0), "%"], ["Виграш", "+" + fmt((a.rec - b.rec) * 100, 0), "п. п."]]; },
});
