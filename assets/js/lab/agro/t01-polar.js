// ЛР 7. Фізіологічна полярність (с. 60–61): калюс інтенсивніше утворюється на боці експлантата, оберненому в рослині
// «до кореня»; у бульб полярність несуттєва; у малих експлантатів вона виражена слабше.
// Модель (наближення, у посібнику кількісних даних немає):
//  • Полярний транспорт ауксину ІОК уздовж осі експлантата товщиною L (адвекція зі швидкістю v + дифузія D, торці
//    непроникні) у стаціонарі дає експоненційний профіль a(x) = Pe·e^(Pe·x)/(e^Pe − 1), x = 0…1 (0 — бік «до пагона»,
//    1 — бік «до кореня»), середнє = 1; число Пекле Pe = v·L/D_еф. Для запасної паренхіми моркви взято L₀ = D_еф/v = 0,8 мм
//    (Pe ≈ 2 для дисків 1,5–2 мм), для бульби картоплі полярний транспорт у 12 разів слабший, для стебла верби — сильний.
//    У стеблі «до кореня» — базальний кінець; у корені (морква) — апікальний, звернений до кінчика кореня: у центральному
//    циліндрі кореня ауксин рухається акропетально, тобто теж «до кореня».
//  • Калюсогенез на грані ∝ рівень ауксину × контакт із середовищем (грань на агарі — 1, грань у повітрі — 0,35).
//    Частка дисків із калюсом P(w) = 1 − exp(−c·g(w)·Σk), g(w) — логістичний вихід (лаг ≈ 2–3 тижні), c = 0,9.
import { Plot, sliders, segmented, setOut, fnum, clamp, lerp, TAU, rng, scene, shadow, petri, Runner, onResize, fit, roundRect, jar, rgba } from './kit.js';
import { tissueDisc, discCallus, cutting, chip, font, arrow } from './t01-draw.js';

export const TISSUE = {
  carrot: { n: 'Морква (коренеплід)', L0: 0.8, kind: 'carrot', rootward: 'apical' },
  potato: { n: 'Картопля (бульба)', L0: 10, kind: 'potato', rootward: 'apical' },
  willow: { n: 'Живці верби (стебло)', L0: 0.8, kind: 'willow', rootward: 'basal' },
};
const CONTACT_UP = 0.35, CC = 0.9;
export const prof = (Pe, x) => (Pe < 1e-6 ? 1 : Pe * Math.exp(Pe * x) / (Math.exp(Pe) - 1));
export const gw = (w) => { const f = (u) => 1 / (1 + Math.exp(-(u - 3) / 0.7)); return clamp((f(w) - f(0)) / (f(6) - f(0)), 0, 1.05); };
export function polarCalc(tis, L) {
  const T = TISSUE[tis], Pe = L / T.L0;
  const ar = prof(Pe, 1), as = prof(Pe, 0);
  const kA = ar * 1 + as * CONTACT_UP;   // А: бік «до кореня» на середовищі (для моркви — апікальний)
  const kB = as * 1 + ar * CONTACT_UP;   // Б: протилежний бік на середовищі
  const kT = (ar + as) / 2 * (1 + CONTACT_UP) * 0.9; // тангентальне розміщення (обидві грані збоку)
  const P = (k, w) => 1 - Math.exp(-CC * gw(w) * k);
  return { Pe, ar, as, kA, kB, kT, P };
}

export function initPolar(root) {
  const $ = (s) => root.querySelector(s);
  const cv = $('canvas'), hud = $('.ag-stage__hud'), verdict = $('.ag-verdict');
  const S = { tis: 'carrot', L: 1.75, n: 16, week: 6 };
  let R = null, wk = 6, running = false;
  segmented($('[data-ctl="tis"]'), 'ptis', Object.entries(TISSUE).map(([k, t]) => ({ value: k, label: t.n })), S.tis, (v) => { S.tis = v; recalc(); });
  const sl = sliders($('[data-ctl="sl"]'), [
    { id: 'L', label: 'Товщина диска (довжина експлантата)', min: 0.5, max: 4, step: 0.05, value: S.L, unit: 'мм', digits: 2, hint: 'Посібник: диски 1,5–2 мм (с. 61)' },
    { id: 'n', label: 'Дисків у кожному варіанті', min: 8, max: 24, step: 2, value: S.n, unit: 'шт' },
    { id: 'week', label: 'Тривалість культивування', min: 0, max: 6, step: 0.5, value: S.week, unit: 'тиж.', digits: 1, hint: 'Облік — через 5–6 тижнів' },
  ], () => { Object.assign(S, sl.values); if (!running) wk = S.week; recalc(); });

  const pA = new Plot($('[data-plot="a"]'), { xLabel: 'Відстань від грані «до пагона», мм', yLabel: 'Ауксин, відн. од.', xShort: 'x', yZero: true, ariaLabel: 'Профіль ауксину вздовж осі експлантата' });
  const pF = new Plot($('[data-plot="f"]'), { xLabel: 'Тижні культивування', yLabel: 'Частота калюсоутворення, %', xShort: 'тиж.', x: [0, 6], y: [0, 100], ariaLabel: 'Частота калюсоутворення від часу для двох варіантів' });

  function recalc() {
    const T = TISSUE[S.tis];
    R = polarCalc(S.tis, S.tis === 'willow' ? 8 : S.L);
    const w = wk;
    const L = S.tis === 'willow' ? 100 : S.L;
    const xs = []; for (let i = 0; i <= 60; i++) xs.push(i / 60);
    pA.setOptions({ xLabel: S.tis === 'willow' ? 'Від апікального до базального кінця живця, мм' : (T.rootward === 'apical' ? 'Від базальної грані до апікальної, мм' : 'Від апікальної грані до базальної, мм') });
    pA.set([{ data: xs.map((x) => [x * L, Math.min(prof(R.Pe, x), 12)]), color: '#B45309', label: `ІОК, Pe = ${fnum(R.Pe, 1)}`, width: 2.6, fill: 'rgba(180,83,9,.12)' }],
      [{ y: 1, color: '#64748B', label: 'без полярності' }]);
    const ws = []; for (let u = 0; u <= 6.0001; u += 0.1) ws.push(u);
    const lab = S.tis === 'willow' ? ['прямий живець: корені', 'перевернутий: корені'] : S.tis === 'potato' ? ['А: апікальною вниз', 'Б: базальною вниз'] : ['А: апікальною стороною вниз', 'Б: базальною стороною вниз'];
    const kAA = S.tis === 'willow' ? 3 : R.kA, kBB = S.tis === 'willow' ? 2.6 : R.kB;
    pF.set([
      { data: ws.map((u) => [u, R.P(kAA, u) * 100]), color: '#15803D', label: lab[0], width: 2.6, marker: [w, R.P(kAA, w) * 100] },
      { data: ws.map((u) => [u, R.P(kBB, u) * 100]), color: '#B45309', label: lab[1], width: 2.6, dash: [6, 4], marker: [w, R.P(kBB, w) * 100] },
      S.tis === 'potato' ? { data: ws.map((u) => [u, R.P(R.kT, u) * 100]), color: '#2563EB', label: 'тангентально', width: 2, dash: [2, 3] } : null,
    ], [{ x: 5, color: '#8C6A10', label: 'облік 5–6 тиж.' }]);
    const res = outcomes();
    const fA = res.A.filter((d) => d.on).length, fB = res.B.filter((d) => d.on).length;
    setOut(root, {
      fa: `${fnum(fA / S.n * 100, 0)} % <small>(${fA}/${S.n})</small>`,
      fb: `${fnum(fB / S.n * 100, 0)} % <small>(${fB}/${S.n})</small>`,
      ratio: S.tis === 'willow' ? '≫ 100' : `${fnum(R.ar / R.as, R.ar / R.as < 10 ? 1 : 0)}×`,
      pe: fnum(R.Pe, 2),
    });
    const lbA = S.tis === 'willow' ? 'Прямий живець' : 'Варіант А', lbB = S.tis === 'willow' ? 'Перевернутий' : 'Варіант Б';
    root.querySelector('[data-out-label="fa"]').textContent = S.tis === 'willow' ? 'Укорінення: прямий' : 'А: апікальною вниз';
    root.querySelector('[data-out-label="fb"]').textContent = S.tis === 'willow' ? 'Укорінення: перевернутий' : 'Б: базальною вниз';
    let cls = '', msg = '';
    if (w < 2) { cls = 'is-warn'; msg = `<b>Зарано для обліку:</b> калюс з'являється через 2–3 тижні; частоту калюсоутворення порівнюють через 5–6 тижнів (с. 61).`; }
    else if (S.tis === 'willow') msg = `<b>Полярність незалежна від положення в просторі.</b> В обох живців корені утворюються на морфологічно <b>базальному</b> кінці, а пагони — з бруньок <b>апікального</b> кінця; у перевернутого живця корені ростуть угорі й загинаються донизу (гравітропізм), пагони — внизу й вигинаються вгору. ${lbA} і ${lbB.toLowerCase()} відрізняються лише швидкістю.`;
    else if (S.tis === 'potato') { msg = `<b>У бульби полярність несуттєва</b> (Pe = ${fnum(R.Pe, 2)}): ауксин розподілений майже рівномірно, частоти А і Б близькі (${fnum(fA / S.n * 100, 0)} і ${fnum(fB / S.n * 100, 0)} %). Щоб повністю виключити вплив полярності, диски бульб кладуть на середовище тангентально (с. 61).`; }
    else if (S.L < 1) { cls = 'is-warn'; msg = `<b>Тонкі диски (${fnum(S.L, 2)} мм):</b> градієнт ауксину слабкий (Pe = ${fnum(R.Pe, 1)}), тож орієнтація впливає менше — «при невеликих розмірах експлантата дотримання умов полярності стає менш важливим» (с. 61).`; }
    else { msg = `<b>Полярність виражена:</b> ауксин накопичується на апікальній грані диска (у корені вона звернена до кінчика кореня, тобто «до кореня»), там у ${fnum(R.ar / R.as, 0)} раза більше гормону, ніж на базальній. Коли ця грань лежить на середовищі (А), калюс отримують у ${fnum(fA / S.n * 100, 0)} % дисків, у варіанті Б — ${fnum(fB / S.n * 100, 0)} %. Тому шматочки кореня моркви кладуть на середовище апікальною стороною.`; }
    verdict.className = 'ag-verdict ' + cls; verdict.innerHTML = msg;
    draw();
  }

  function outcomes() {
    const Rn = rng(31), A = [], B = [], kA = S.tis === 'willow' ? 3 : R.kA, kB = S.tis === 'willow' ? 2.6 : R.kB;
    const H = (k) => CC * gw(wk) * k;
    for (let i = 0; i < S.n; i++) { const e = -Math.log(1 - Rn() * 0.999), e2 = -Math.log(1 - Rn() * 0.999); A.push({ on: H(kA) >= e, amt: clamp((H(kA) - e) / 1.6, 0, 1), seed: 10 + i }); B.push({ on: H(kB) >= e2, amt: clamp((H(kB) - e2) / 1.6, 0, 1), seed: 50 + i }); }
    return { A, B };
  }

  function draw() {
    if (!R) return;
    const mob = cv.parentElement.clientWidth < 480;
    const { ctx, w, h } = fit(cv, { aspect: mob ? 0.72 : 1.3, min: 380, max: 540 });
    if (S.tis === 'willow') drawWillow(ctx, w, h, mob); else drawDiscs(ctx, w, h, mob);
    hud.innerHTML = `<span>${fnum(wk, 1)} тиж. культивування</span><span>${S.tis === 'willow' ? 'волога камера, світло' : 'термостат +25 °C, темрява'}</span>`;
  }

  function drawDiscs(ctx, w, h, mob) {
    const hy = scene(ctx, w, h, { kind: 'bench', horizon: 0.12 });
    const res = outcomes();
    // схема: циліндр тканини з маркуванням полюсів
    const schemeW = mob ? w : w * 0.3;
    const dishArea = mob ? { x: 0, y: h * 0.36, w, h: h * 0.64 } : { x: w * 0.3, y: hy, w: w * 0.7, h: h - hy };
    drawScheme(ctx, mob ? w * 0.04 : w * 0.02, hy + 6, schemeW * (mob ? 0.92 : 0.94), mob ? h * 0.3 : h - hy - 12, mob);
    const cols = mob ? 1 : 2;
    const variants = [['A', res.A, S.tis === 'carrot' ? 'А: апікальною стороною вниз' : 'А: апікальною вниз'], ['B', res.B, S.tis === 'carrot' ? 'Б: базальною стороною вниз' : 'Б: базальною вниз']];
    variants.forEach(([v, arr, label], i) => {
      const cw = dishArea.w / (mob ? 2 : 2), cx = dishArea.x + cw * (i + 0.5);
      const cy = dishArea.y + dishArea.h * (mob ? 0.46 : 0.46);
      const r = Math.min(cw * 0.45, dishArea.h * 0.62);
      petri(ctx, cx, cy, r, { tilt: 0.5, medium: { color: '#E9E1BC' }, lid: false, contents: (c, p) => {
        const n = arr.length, cols2 = Math.ceil(Math.sqrt(n * 1.6)), rows2 = Math.ceil(n / cols2);
        const items = [];
        arr.forEach((d, j) => { const ci = j % cols2, ri = Math.floor(j / cols2); const x = p.cx + (ci - (cols2 - 1) / 2) * p.rx * 1.55 / cols2, y = p.cy + (ri - (rows2 - 1) / 2) * p.ry * 1.45 / rows2; if (((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 < 0.85) items.push([x, y, d]); else items.push([p.cx + (x - p.cx) * 0.8, p.cy + (y - p.cy) * 0.8, d]); });
        const dr = Math.min(p.rx * 0.62 / cols2, p.ry * 1.1 / rows2) * 0.95;
        items.forEach(([x, y, d]) => {
          // у варіанті А калюс з грані на агарі — виступає валиком по краю; у Б — на верхній грані
          if (d.on && v === 'A') discCallus(c, x, y + 2, dr, d.amt, { tilt: 0.5, seed: d.seed, rim: true });
          tissueDisc(c, x, y, dr, { kind: TISSUE[S.tis].kind, tilt: 0.5, thick: Math.max(2, S.L * dr * 0.12 + 1.5), seed: d.seed, torn: v === 'B' ? false : true });
          if (d.on && v === 'B') discCallus(c, x, y, dr, d.amt, { tilt: 0.5, seed: d.seed });
          if (d.on && v === 'A' && d.amt > 0.4) discCallus(c, x, y, dr, (d.amt - 0.4) * 0.6, { tilt: 0.5, seed: d.seed + 3 });
        });
      } });
      chip(ctx, cx, cy + r * 0.5 + r * 0.16 + 24, label, { size: mob ? 10.5 : 12, bold: 800 });
      const f = arr.filter((d) => d.on).length;
      chip(ctx, cx, cy - r * 0.5 - 12, `калюс: ${f} з ${arr.length}`, { size: mob ? 10.5 : 11.5, color: '#166534' });
    });
  }

  function drawScheme(ctx, x, y, W, H, mob) {
    // бокова проекція: циліндр тканини (свердло) → диски; градієнт ауксину; гладкий/надірваний зріз
    ctx.save();
    roundRect(ctx, x, y, W, H, 12); ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.fill(); ctx.strokeStyle = 'rgba(30,70,45,.15)'; ctx.stroke();
    font(ctx, mob ? 11 : 12, 800); ctx.fillStyle = '#1F3A2A'; ctx.textAlign = 'left'; ctx.fillText('Диск у розрізі: ауксин і калюс', x + 12, y + 20);
    const cx = x + W * (mob ? 0.3 : 0.5), dw = Math.min(W * (mob ? 0.42 : 0.62), 150), th = Math.max(16, Math.min(H * 0.18, S.L * 14));
    const ys = mob ? [y + H * 0.48] : [y + H * 0.36, y + H * 0.74];
    const vs = mob ? ['A'] : ['A', 'B'];
    vs.forEach((v, i) => {
      const yy = ys[i];
      // агар
      ctx.fillStyle = '#E6DDB4'; ctx.fillRect(cx - dw * 0.75, yy + th / 2, dw * 1.5, th * 0.7);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(cx - dw * 0.75, yy + th / 2, dw * 1.5, 1.5);
      // диск: градієнт ауксину (темніше = більше). Для моркви: апікальна грань — «до кореня».
      const apicalDown = v === 'A';
      const g = ctx.createLinearGradient(0, yy - th / 2, 0, yy + th / 2);
      const top = apicalDown ? R.as : R.ar, bot = apicalDown ? R.ar : R.as, mx = Math.max(R.ar, 1.2);
      g.addColorStop(0, `rgba(${S.tis === 'carrot' ? '235,120,40' : '240,226,180'},1)`); g.addColorStop(1, `rgba(${S.tis === 'carrot' ? '235,120,40' : '240,226,180'},1)`);
      ctx.fillStyle = g; roundRect(ctx, cx - dw / 2, yy - th / 2, dw, th, 3); ctx.fill();
      const ag = ctx.createLinearGradient(0, yy - th / 2, 0, yy + th / 2);
      ag.addColorStop(0, `rgba(120,40,0,${0.55 * top / mx})`); ag.addColorStop(1, `rgba(120,40,0,${0.55 * bot / mx})`);
      ctx.fillStyle = ag; roundRect(ctx, cx - dw / 2, yy - th / 2, dw, th, 3); ctx.fill();
      // маркування граней: апікальна — гладкий зріз, базальна — надірваний
      ctx.strokeStyle = '#3B2A1A'; ctx.lineWidth = 1.4;
      const smoothY = apicalDown ? yy + th / 2 : yy - th / 2, tornY = apicalDown ? yy - th / 2 : yy + th / 2;
      ctx.beginPath(); ctx.moveTo(cx - dw / 2, smoothY); ctx.lineTo(cx + dw / 2, smoothY); ctx.stroke();
      ctx.beginPath(); for (let k = 0; k <= 16; k++) { const xx = cx - dw / 2 + dw * k / 16; ctx.lineTo(xx, tornY + (k % 2 ? 2 : -2)); } ctx.stroke();
      // калюс
      const amt = clamp(CC * gw(wk) * (v === 'A' ? R.kA : R.kB) / 2.5, 0, 1);
      if (amt > 0.05) {
        const rootwardDown = apicalDown;
        const R2 = rng(5 + i);
        for (let k = 0; k < 7 + amt * 10; k++) {
          const px = cx - dw / 2 + R2() * dw, rr = 2 + R2() * 4 * amt + amt * 3;
          const py = rootwardDown ? yy + th / 2 - rr * 0.2 : yy - th / 2 - rr * 0.6;
          const pxx = rootwardDown ? (R2() > 0.5 ? cx - dw / 2 - rr * 0.6 : cx + dw / 2 + rr * 0.6) : px;
          const gg = ctx.createRadialGradient(pxx - rr * 0.3, py - rr * 0.3, 0.5, pxx, py, rr); gg.addColorStop(0, '#FFFCEB'); gg.addColorStop(1, '#CDBB86');
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(pxx, py, rr, 0, TAU); ctx.fill();
        }
      }
      // стрілка полярного транспорту ауксину
      const ay0 = apicalDown ? yy - th / 2 - 2 : yy + th / 2 + 2, ay1 = apicalDown ? yy + th / 2 + 2 : yy - th / 2 - 2;
      if (S.tis !== 'potato') arrow(ctx, cx + dw / 2 + 18, ay0 - (apicalDown ? 8 : -8), cx + dw / 2 + 18, ay1 + (apicalDown ? 4 : -4), { color: '#B45309', width: 2, head: 6 });
      font(ctx, 10.5, 700); ctx.fillStyle = '#1F3A2A'; ctx.textAlign = 'left';
      const lx = cx - dw / 2 - (mob ? 0 : 4);
      ctx.textAlign = 'right';
      ctx.fillText(apicalDown ? 'базальна (надірвана)' : 'апікальна (гладка)', cx - dw / 2 - 6 > x + 70 ? cx - dw / 2 - 6 : cx + dw / 2 + 26 + 90, yy - th / 2 + 2);
      ctx.fillText(apicalDown ? 'апікальна (гладка)' : 'базальна (надірвана)', cx - dw / 2 - 6 > x + 70 ? cx - dw / 2 - 6 : cx + dw / 2 + 26 + 90, yy + th / 2 + 2);
      void lx;
      ctx.textAlign = 'left'; font(ctx, 11, 800); ctx.fillStyle = v === 'A' ? '#15803D' : '#B45309';
      ctx.fillText(v === 'A' ? 'А' : 'Б', x + 12, yy + 4);
    });
    if (mob) { font(ctx, 10.5, 600); ctx.fillStyle = '#46584C'; ctx.textAlign = 'left'; ctx.fillText('стрілка — полярний транспорт ІОК', x + W * 0.58, y + H * 0.5); ctx.fillText('темніше — більше ауксину', x + W * 0.58, y + H * 0.5 + 15); }
    else { font(ctx, 10.5, 600); ctx.fillStyle = '#46584C'; ctx.textAlign = 'left'; ctx.fillText('стрілка — полярний транспорт ІОК;', x + 12, y + H - 24); ctx.fillText('темніше — більше ауксину', x + 12, y + H - 10); }
    ctx.restore();
  }

  function drawWillow(ctx, w, h, mob) {
    const hy = scene(ctx, w, h, { kind: 'room', horizon: 0.86 });
    const g = gw(wk);
    const jw = mob ? w * 0.4 : Math.min(w * 0.22, 230), jh = Math.min(h * 0.8, jw * 2);
    [0, 1].forEach((i) => {
      const x = mob ? w * (0.06 + i * 0.5) : w * (0.18 + i * 0.36), by = hy + 6;
      jar(ctx, x, by - jh, jw, jh, { medium: { level: 0.12, color: '#CFE3EA', gel: false }, lid: 'cap', contents: (c, inn) => {
        const inv = i === 1, cx = inn.x + inn.w / 2, cw = Math.max(6, jw * 0.07);
        const y0 = inn.y + inn.h * 0.18, y1 = inn.y + inn.h * 0.84;
        // волога камера: крапельки конденсату
        const R2 = rng(9 + i); c.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 40; k++) { c.beginPath(); c.arc(inn.x + R2() * inn.w, inn.y + R2() * inn.h * 0.7, 0.8 + R2() * 1.6, 0, TAU); c.fill(); }
        cutting(c, cx, y0, y1, cw, { roots: clamp(g * (inv ? 0.85 : 1), 0, 1), shoots: clamp((g - 0.1) * (inv ? 0.8 : 1), 0, 1), callus: clamp(g * 1.5, 0, 1), inverted: inv, seed: 3 + i });
      } });
      chip(ctx, x + jw / 2, by - jh - 12, i ? 'перевернутий живець' : 'живець у природному положенні', { size: mob ? 10.5 : 12, bold: 800 });
      const by2 = by - jh * (i ? 0.2 : 0.8);
      void by2;
    });
    if (!mob) {
      chip(ctx, w * 0.9, h * 0.3, 'база ↓ корені', { size: 11.5, color: '#7C2D12' });
      chip(ctx, w * 0.9, h * 0.3 + 24, 'апекс ↑ пагони', { size: 11.5, color: '#166534' });
    }
  }

  const runner = new Runner({
    btn: $('.ag-run'), reset: $('[data-act="reset"]'),
    step: (dt, t, reset) => {
      if (reset) { running = false; wk = S.week; recalc(); return; }
      if (!running) { running = true; wk = 0; }
      wk += dt * 6 / 10;
      if (wk >= S.week) { wk = S.week; running = false; recalc(); runner.finish(); return; }
      recalc();
    },
    draw: () => draw(),
  });
  onResize(cv.parentElement, () => draw());
  recalc();
}
