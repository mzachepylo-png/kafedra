// Тема 13: ЛР 54 (захисна дія кріопротекторів на клітини коренеплоду буряка) і ЛР 55 (на білки клітинного соку).
// Посібник, с. 198–201 (у тексті роботи пронумеровано 53 і 54):
//  ЛР 54: охолоджувальна суміш 3 ч. снігу/льоду + 1 ч. кухонної солі ≈ −20 °C; висічки Ø 5–6 мм з пластинок 5 мм,
//   по 3–4 у пробірку; №1 — 5 мл води; №2 — 2,5 мл 1 М сахарози + 2,5 мл води; №3 — 5 мл 1 М сахарози;
//   №4 — 2,5 мл 1 М гліцерину + 2,5 мл води; №5 — 5 мл 1 М гліцерину; №6 — 2,5 мл 1 М сахарози + 2,5 мл 1 М гліцерину;
//   15–20 хв у суміші, розморожування в склянці води кімнатної температури; підрахунок знебарвлених клітин (×10)
//   і плазмолізованих у 8 % NaCl (10 хв, не менше 5 полів зору).
//  ЛР 55: 2,5 мл соку картоплі (капусти) + 2,5 мл: води; 1 М сахарози; 0,5 М сахарози; 1 М гліцерину; 0,5 М гліцерину;
//   15–20 хв при ≈ −20 °C, розморожування без струшування, облік пластівців коагульованого білка.
// Модель (наближення): тепловий баланс пробірки з переохолодженням і «плато» кристалізації (ентальпійний метод:
// теплота плавлення льоду / теплоємність води ≈ 80 °C); частка незамерзлої води за кріоскопічним законом
// f = T_замерз / T; пошкодження — функція Вейбулла від «дози» заморожування, яку зменшують кріопротектори.
import { fit, scene, shadow, roundRect, rng, clamp, lerp, mix, rgba, shade, smooth, TAU, Runner, onResize, fnum, Plot, applyGrain, tube, noise } from './kit.js';
import { frame, setRead, setVerdict, setHud, seg, slide, presets, txt, setScale, el } from './t13-ui.js';

export const KF = 1.86;
/** Температура замерзання розчину: сахароза (φ ≈ 1,1) і гліцерин, моляльність через воду в 1 л. */
export function freezePoint(cs, cg, base = 0) {
  const water = Math.max(0.5, 1 - cs * 0.215 - cg * 0.073);   // кг води в 1 л (питомі об'єми 0,63 і 0,79 мл/г)
  return -KF * ((cs * 1.1 + cg) / water + base);
}
/** Охолодження пробірки в суміші: повертає [{t, T, ice}] (ентальпійний метод з переохолодженням на 3 °C). */
export function coolTube(Tf, Tmix, minutes, { tau = 1.3, T0 = 20, dt = 0.02 } = {}) {
  let T = T0, H = T0, nucleated = false, ice = 0;
  const out = [{ t: 0, T, ice }];
  const Hof = (TT) => TT - 80 * (TT < Tf ? 1 - Tf / TT : 0);
  for (let t = dt; t <= minutes + 1e-9; t += dt) {
    H += (Tmix - T) / tau * dt;
    if (!nucleated) { T = H; if (T <= Tf - 3 && Tmix < Tf) { nucleated = true; } }
    if (nucleated) { let lo = Math.min(Tmix - 1, Tf - 60), hi = Tf; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (Hof(m) > H) hi = m; else lo = m; } T = (lo + hi) / 2; ice = T < Tf ? 1 - Tf / T : 0; }
    out.push({ t, T, ice });
  }
  return out;
}

const DISC = [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [0, 1], [0.5, 0.5]];
const SAP = [[0, 0], [0.5, 0], [0.25, 0], [0, 0.5], [0, 0.25]];
export const CFGS = {
  beet: {
    key: 'beet', lab: 'ЛР 54', tubes: DISC.map(([s, g], i) => ({ n: i + 1, s, g, label: ['вода', 'сах. 0,5 М', 'сах. 1 М', 'гл. 0,5 М', 'гл. 1 М', 'сах.+гл.'][i] })),
    recipe: ['5 мл води (контроль)', '2,5 мл 1 М сахарози + 2,5 мл води', '5 мл 1 М сахарози', '2,5 мл 1 М гліцерину + 2,5 мл води', '5 мл 1 М гліцерину', '2,5 мл 1 М сахарози + 2,5 мл 1 М гліцерину'],
  },
  sap: {
    key: 'sap', lab: 'ЛР 55', tubes: SAP.map(([s, g], i) => ({ n: i + 1, s, g, label: ['вода', 'сах. 0,5 М', 'сах. 0,25 М', 'гл. 0,5 М', 'гл. 0,25 М'][i] })),
    recipe: ['2,5 мл соку + 2,5 мл води (контроль)', '2,5 мл соку + 2,5 мл 1 М сахарози', '2,5 мл соку + 2,5 мл 0,5 М сахарози', '2,5 мл соку + 2,5 мл 1 М гліцерину', '2,5 мл соку + 2,5 мл 0,5 М гліцерину'],
  },
};
const SAPS = { potato: { name: 'картопля', osm: 0.15, stab: 1.0, color: '#D9C489', note: 'бульби' }, cabbage: { name: 'капуста', osm: 0.18, stab: 0.55, color: '#C9D68E', note: 'листя' } };

/** Результат однієї пробірки. */
export function tubeResult(cfg, tb, p) {
  const base = cfg.key === 'sap' ? SAPS[p.sap].osm : 0;
  const Tf = freezePoint(tb.s, tb.g, base);
  const tr = coolTube(Tf, p.Tmix, p.exp);
  let dose = 0, last = tr[tr.length - 1];
  for (let i = 1; i < tr.length; i++) {
    const r = tr[i], dt = r.t - tr[i - 1].t;
    if (cfg.key === 'beet') dose += r.ice * (Math.max(0, -r.T - 1) / 10 + 0.04) * dt;
    else if (r.ice > 0) dose += Math.log(1 / Math.max(0.01, 1 - r.ice)) * dt;
  }
  let X;
  if (cfg.key === 'beet') { const P = Math.exp(-(1.1 * tb.s + 1.4 * tb.g)); X = 1 - Math.exp(-Math.pow(dose * P / 11, 2)); }
  else { const P = Math.exp(-(2.4 * tb.s + 1.7 * tb.g)); X = 1 - Math.exp(-0.03 * dose * P * SAPS[p.sap].stab); }
  return { Tf, tr, dose, X, iceEnd: last.ice, Tend: last.T };
}

export class TubesModel {
  constructor(host, cfg) {
    this.cfg = cfg;
    const beet = cfg.key === 'beet';
    this.p = { Tmix: -20, exp: 20, sel: beet ? 2 : 0, sap: 'potato', nacl: true };
    const F = frame(host, {
      aria: beet ? 'Шість пробірок з висічками коренеплоду буряка в охолоджувальній суміші та поле зору мікроскопа з клітинами паренхіми' : 'П’ять пробірок із клітинним соком у охолоджувальній суміші та схема білкових молекул у розчині',
      reads: beet
        ? [['tf', 'Температура замерзання розчину'], ['tmin', 'Температура в пробірці наприкінці'], ['ice', 'Частка води у вигляді льоду'], ['dead', 'Знебарвлені (пошкоджені) клітини'], ['plas', 'Плазмолізовані в 8 % NaCl'], ['col', 'Забарвлення рідини бетаціаніном']]
        : [['tf', 'Температура замерзання суміші'], ['tmin', 'Температура в пробірці наприкінці'], ['ice', 'Частка води у вигляді льоду'], ['conc', 'У скільки разів сконцентровано розчин'], ['coag', 'Скоагульовано білка'], ['flk', 'Пластівці (бали)']],
      panels: [beet ? 'Охолоджувальна суміш' : 'Клітинний сік і суміш', beet ? 'Пробірка й мікроскопія' : 'Пробірка'],
      plots: beet
        ? [['temp', 'Температура вмісту пробірки (з плато кристалізації)'], ['bars', 'Частка пошкоджених клітин за пробірками, %']]
        : [['temp', 'Незамерзла частка води при заморожуванні'], ['bars', 'Коагульований білок за пробірками, %']],
      note: beet
        ? '<b>Бетаціанін</b> — червоно-фіолетовий пігмент вакуолі буряка: з живої клітини він не виходить, а з пошкодженої (мембрани зруйновані) переходить у розчин. <b>Плазмоліз</b> — відставання протопласта від стінки в гіпертонічному розчині — можливий лише в живій клітині. Значення — модельні (<a href="#t13-assume">наближення</a>); теорія — <a href="#t13-protect">кріопротектори</a>.'
        : '<b>Коагуляція</b> — незворотне злипання денатурованих білків у пластівці. Коли вода вимерзає, білки й солі концентруються в незамерзлих прошарках («концентрування виморожуванням») — саме це їх і руйнує. Значення — модельні (<a href="#t13-assume">наближення</a>); теорія — <a href="#t13-protect">кріопротектори</a>.',
    });
    this.F = F;
    const [p1, p2] = F.panels;
    if (!beet) this.sapSeg = seg(p1, 'Клітинний сік', [{ value: 'potato', label: 'картопля (бульби)' }, { value: 'cabbage', label: 'капуста (листя)' }], 'potato', (v) => { this.p.sap = v; this.update(); });
    this.sl = slide(p1, [
      { id: cfg.key + '-T', label: 'Температура суміші', min: -21, max: -4, step: 1, value: -20, unit: '°C', digits: 0, hint: '3 ч. льоду + 1 ч. NaCl ≈ −20 °C (евтектика NaCl −21 °C)', format: (v) => fnum(v, 0) },
      { id: cfg.key + '-e', label: 'Експозиція', min: 5, max: 30, step: 1, value: 20, unit: 'хв', digits: 0, hint: 'посібник: 15–20 хв' },
    ], () => { this.p.Tmix = this.sl.values[cfg.key + '-T']; this.p.exp = this.sl.values[cfg.key + '-e']; this.update(); });
    this.selSeg = seg(p2, 'Пробірка №', cfg.tubes.map((t) => ({ value: String(t.n - 1), label: String(t.n) })), String(this.p.sel), (v) => { this.p.sel = +v; this.update(); });
    this.recipeEl = el('p', { class: 'ag-note t13-recipe' }); p2.append(this.recipeEl);
    if (beet) seg(p2, 'Препарат під мікроскопом', [{ value: '0', label: 'у своєму розчині' }, { value: '1', label: 'у 8 % NaCl, 10 хв' }], '1', (v) => { this.p.nacl = v === '1'; this.draw(); this.renderReads(); });
    presets(p2, [['За посібником (−20 °C, 20 хв)', () => { this.sl.set(cfg.key + '-T', -20, true); this.sl.set(cfg.key + '-e', 20, true); this.p.Tmix = -20; this.p.exp = 20; this.update(); }]]);
    this.plT = new Plot(F.plots.temp, beet ? { xLabel: 't, хв', yLabel: 'T, °C', y: [-22, 22], yZero: false, xShort: 't', aspect: 1.5 } : { xLabel: 'T, °C', yLabel: 'незамерзла вода, частка', x: [-21, 0], y: [0, 1.05], xShort: 'T', aspect: 1.5 });
    this.plB = new Plot(F.plots.bars, { xLabel: '№ пробірки', yLabel: '%', x: [0.4, cfg.tubes.length + 0.6], y: [0, 100], xShort: '№', aspect: 1.5, xFmt: (v) => (Math.abs(v - Math.round(v)) < 0.01 ? String(Math.round(v)) : '') });
    this.anim = { u: 1 };
    this.runner = new Runner({ btn: F.run, reset: F.reset, step: (dt, t, r) => this.step(dt, r), draw: () => this.draw() });
    F.status.textContent = 'Статичний кадр: пробірки після розморожування (розрахунок).';
    F.canvas.addEventListener('pointerdown', (e) => this.pick(e));
    onResize(F.canvas.parentElement, () => { this.draw(); });
    this.update();
  }

  update() {
    this.res = this.cfg.tubes.map((tb) => tubeResult(this.cfg, tb, this.p));
    if (this.cfg.key === 'sap') this.resOther = this.cfg.tubes.map((tb) => tubeResult(this.cfg, tb, { ...this.p, sap: this.p.sap === 'potato' ? 'cabbage' : 'potato' }));
    this.recipeEl.innerHTML = `№ ${this.p.sel + 1}: ${this.cfg.recipe[this.p.sel]}.`;
    this.renderReads(); this.renderPlots(); this.draw();
  }

  renderReads() {
    const r = this.res[this.p.sel], R = this.F.reads, tb = this.cfg.tubes[this.p.sel], beet = this.cfg.key === 'beet';
    setRead(R.tf, fnum(r.Tf, 1) + ' °C');
    setRead(R.tmin, fnum(r.Tend, 1) + ' °C');
    setRead(R.ice, fnum(r.iceEnd * 100, 0) + ' %');
    const pl = (x) => (x < 0.1 ? '−' : x < 0.3 ? '+' : x < 0.6 ? '++' : '+++');
    if (beet) {
      setRead(R.dead, fnum(r.X * 100, 0) + ' %', r.X > 0.5 ? 'bad' : r.X < 0.2 ? 'ok' : '');
      setRead(R.plas, fnum((1 - r.X) * 100, 0) + ' %');
      setRead(R.col, ['безбарвна', 'ледь рожева', 'рожева', 'червона', 'темно-червона'][Math.min(4, Math.round(r.X * 4))]);
    } else {
      setRead(R.conc, '×' + fnum(1 / Math.max(0.01, 1 - r.iceEnd), 0));
      setRead(R.coag, fnum(r.X * 100, 0) + ' %', r.X > 0.5 ? 'bad' : r.X < 0.15 ? 'ok' : '');
      setRead(R.flk, pl(r.X));
    }
    const ctrl = this.res[0];
    let html = `<b>Пробірка № ${tb.n} (${this.cfg.recipe[this.p.sel]}):</b> розчин замерзає при ${fnum(r.Tf, 1)} °C; за ${this.p.exp} хв у суміші ${fnum(this.p.Tmix, 0)} °C ${fnum(r.iceEnd * 100, 0)} % води перетворилося на лід. `;
    let kind = '';
    if (beet) {
      html += tb.n === 1 ? `Без захисту лід пошкоджує ${fnum(r.X * 100, 0)} % клітин: мембрани втрачають напівпроникність, бетаціанін виходить у воду, і вона червоніє.` : `Пошкоджено ${fnum(r.X * 100, 0)} % клітин проти ${fnum(ctrl.X * 100, 0)} % у контролі: ${tb.g ? 'гліцерин проникає в зрізані клітини й зменшує кількість льоду в них' : ''}${tb.g && tb.s ? ', а ' : ''}${tb.s ? 'сахароза підвищує водоутримну здатність і стабілізує мембрани ззовні' : ''}.`;
      if (r.X > 0.5) kind = 'bad'; else if (r.X > 0.2) kind = 'warn';
      if (this.p.Tmix > -8) html += ' При слабкому морозі розчин ледь промерзає — різниця між пробірками мала.';
    } else {
      html += tb.n === 1 ? `Білки й солі соку ${SAPS[this.p.sap].name === 'картопля' ? 'картоплі' : 'капусти'} сконцентровано в ${fnum(1 / Math.max(0.01, 1 - r.iceEnd), 0)} разів — скоагульовано ${fnum(r.X * 100, 0)} %, після розморожування видно пластівці.` : `Скоагульовано ${fnum(r.X * 100, 0)} % білка проти ${fnum(ctrl.X * 100, 0)} % у контролі: ${tb.s ? 'сахароза' : 'гліцерин'} знижує частку льоду, розводить незамерзлий розчин і, утворюючи водневі зв’язки, стабілізує нативну структуру білків.`;
      html += this.p.sap === 'cabbage' ? ' Білки капусти — холодостійкої культури — стабільніші, ніж білки картоплі.' : '';
      if (r.X > 0.5) kind = 'bad'; else if (r.X > 0.2) kind = 'warn';
    }
    setVerdict(this.F.verdict, html, kind);
  }

  renderPlots() {
    const beet = this.cfg.key === 'beet', r = this.res[this.p.sel];
    if (beet) {
      const cut = (tr) => tr.filter((_, i) => i % 5 === 0).map((q) => [q.t, q.T]);
      this.plT.setOptions({ x: [0, this.p.exp] });
      this.plT.set([
        this.p.sel ? { data: cut(this.res[0].tr), color: '#B9C4BD', width: 1.6, label: '№ 1, вода' } : null,
        { data: cut(r.tr), color: '#2B6CB0', width: 2.6, label: `№ ${this.p.sel + 1}` },
      ], [{ y: this.p.Tmix, color: '#5B6B63', label: 'суміш' }, { y: r.Tf, color: '#8C6A10', label: `замерзання ${fnum(r.Tf, 1)} °C`, dash: [3, 3] }]);
    } else {
      const fu = (Tf) => { const d = []; for (let T = -21; T <= 0.001; T += 0.25) d.push([T, T < Tf ? Tf / T : 1]); return d; };
      this.plT.set([
        { data: fu(this.res[0].Tf), color: '#B9C4BD', width: 1.8, label: '№ 1, вода' },
        { data: fu(r.Tf), color: '#2B6CB0', width: 2.6, label: `№ ${this.p.sel + 1}` },
      ], [{ x: this.p.Tmix, color: '#5B6B63', label: 'суміш' }]);
    }
    const bars = [], w = beet ? 0.34 : 0.2;
    const bar = (x, y, color, label) => ({ data: [[x - w, 0], [x - w, y], [x + w, y], [x + w, 0]], color, width: 1, fill: color, label, noHover: !label });
    this.res.forEach((q, i) => {
      const on = i === this.p.sel;
      if (beet) bars.push(bar(i + 1, q.X * 100, on ? '#B0304A' : 'rgba(176,48,74,.55)', i === 0 ? 'пошкоджені клітини' : ''));
      else {
        bars.push(bar(i + 1 - 0.21, q.X * 100, this.p.sap === 'potato' ? (on ? '#9A7B2F' : 'rgba(154,123,47,.6)') : (on ? '#6E8F2E' : 'rgba(110,143,46,.6)'), i === 0 ? SAPS[this.p.sap].name : ''));
        bars.push(bar(i + 1 + 0.21, this.resOther[i].X * 100, 'rgba(150,160,155,.45)', i === 0 ? SAPS[this.p.sap === 'potato' ? 'cabbage' : 'potato'].name : ''));
      }
    });
    this.plB.set(bars);
  }

  pick(e) {
    if (!this.tubeX) return;
    const rc = this.F.canvas.getBoundingClientRect(), x = (e.clientX - rc.left) / this.S, y = (e.clientY - rc.top) / this.S;
    const i = this.tubeX.findIndex((t) => x >= t.x - 6 && x <= t.x + t.w + 6 && y >= t.y - 20 && y <= t.y + t.h + 20);
    if (i >= 0) { this.p.sel = i; this.selSeg.select(String(i)); this.update(); }
  }

  step(dt, reset) {
    const a = this.anim;
    if (reset) { a.u = 1; a.running = false; this.F.status.textContent = 'Статичний кадр: пробірки після розморожування (розрахунок).'; return; }
    if (!a.running) { a.running = true; a.u = 0; }
    a.u = Math.min(1, a.u + dt / 11);
    const ph = this.phase(a.u);
    this.F.status.textContent = ph.name === 'down' ? 'Ставимо пробірки в охолоджувальну суміш…' : ph.name === 'cool' ? `Заморожування: ${fnum(ph.k * this.p.exp, 0)} хв із ${this.p.exp}` : ph.name === 'up' ? 'Переносимо в склянку з водою кімнатної температури' : 'Розморожування й вихід пігменту';
    if (a.u >= 1) { a.running = false; this.F.status.textContent = 'Готово: порівняйте забарвлення рідини й зробіть препарати.'; this.runner.finish(); }
  }

  /** Фази анімації: down (0–0,08), cool (до 0,6), up (до 0,68), thaw (до 1). */
  phase(u) {
    if (u < 0.08) return { name: 'down', k: u / 0.08 };
    if (u < 0.6) return { name: 'cool', k: (u - 0.08) / 0.52 };
    if (u < 0.68) return { name: 'up', k: (u - 0.6) / 0.08 };
    return { name: 'thaw', k: (u - 0.68) / 0.32 };
  }

  draw() {
    const cv = this.F.canvas, narrow = cv.parentElement.clientWidth < 620;
    const { ctx, w, h } = fit(cv, { aspect: narrow ? 0.62 : 1.85, min: 320, max: narrow ? 920 : 560 });
    const DW = narrow ? 560 : 1000, S = w / DW, DH = h / S; this.S = S;
    setScale(S); ctx.save(); ctx.scale(S, S);
    const u = this.runner.started ? this.anim.u : 1, ph = this.phase(u), beet = this.cfg.key === 'beet';
    const hy = scene(ctx, DW, DH, { kind: 'bench', horizon: narrow ? 0.92 : 0.86, light: 0.3 });
    let rack, inset;
    if (narrow) { inset = { cx: DW / 2, cy: DH * 0.285, r: Math.min(DW * 0.4, DH * 0.205) }; rack = { x: 18, w: DW - 36, by: hy, h: DH * 0.42 }; }
    else { rack = { x: DW * 0.03, w: DW * 0.56, by: hy, h: DH * 0.72 }; inset = { cx: DW * 0.795, cy: DH * 0.45, r: Math.min(DH * 0.36, 178) }; }
    this.bench(ctx, rack, u, ph);
    if (beet) this.beetMicro(ctx, inset, u, ph); else this.molecules(ctx, inset, u, ph);
    ctx.restore();
    const r = this.res[this.p.sel];
    setHud(this.F.hud, [this.cfg.lab, `суміш ${fnum(this.p.Tmix, 0)} °C`, `№ ${this.p.sel + 1}`, ph.name === 'cool' ? `${fnum(ph.k * this.p.exp, 0)} хв` : ph.name === 'thaw' || !this.runner.started ? 'розморожено' : '…']);
  }

  /** Пробірки, штатив, охолоджувальна суміш / склянка з водою. */
  bench(ctx, r, u, ph) {
    const beet = this.cfg.key === 'beet', n = this.cfg.tubes.length;
    const bathX = r.x + r.w * 0.02, bathW = r.w * 0.96, bathH = r.h * 0.42, bathY = r.by - bathH;
    const cooling = ph.name === 'down' || ph.name === 'cool';
    const warm = ph.name === 'up' || ph.name === 'thaw' || !this.runner.started;
    // ванна: суміш льоду з сіллю або вода кімнатної температури
    shadow(ctx, bathX + bathW / 2, r.by + 3, bathW * 0.55, 10, 0.3);
    ctx.save();
    roundRect(ctx, bathX, bathY, bathW, bathH, 10); ctx.fillStyle = 'rgba(220,235,238,.28)'; ctx.fill(); ctx.clip();
    if (cooling) {
      const R = rng(41);
      const g = ctx.createLinearGradient(0, bathY, 0, bathY + bathH); g.addColorStop(0, '#E8EEF2'); g.addColorStop(1, '#C9D6DE'); ctx.fillStyle = g; ctx.fillRect(bathX, bathY + bathH * 0.12, bathW, bathH);
      for (let i = 0; i < 260; i++) { const x = bathX + R() * bathW, y = bathY + bathH * 0.12 + R() * bathH * 0.88, s = 3 + R() * 9; ctx.fillStyle = `rgba(${R() > 0.5 ? '255,255,255' : '190,208,220'},${0.5 + R() * 0.4})`; ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x + s * 0.1, y + s * 0.55); ctx.lineTo(x - s * 0.55, y + s * 0.1); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 160; i++) { ctx.fillRect(bathX + R() * bathW, bathY + bathH * 0.12 + R() * bathH * 0.88, 1.2, 1.2); }
    } else {
      const g = ctx.createLinearGradient(0, bathY, 0, bathY + bathH); g.addColorStop(0, 'rgba(190,220,232,.55)'); g.addColorStop(1, 'rgba(150,195,215,.65)');
      ctx.fillStyle = g; ctx.fillRect(bathX, bathY + bathH * 0.18, bathW, bathH);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.moveTo(bathX, bathY + bathH * 0.18); ctx.lineTo(bathX + bathW, bathY + bathH * 0.18); ctx.stroke();
    }
    ctx.restore();
    // пробірки
    const gap = (bathW - 34) / n, tw = Math.min(gap * 0.42, 38), th = r.h * 0.72;
    const lift = ph.name === 'down' ? 1 - ph.k : ph.name === 'up' ? ph.k * 0.0 : 0;
    this.tubeX = [];
    this.cfg.tubes.forEach((tb, i) => {
      const res = this.res[i];
      const x = bathX + gap * (i + 0.5) - tw / 2, y = r.by - th - 8 - lift * r.h * 0.25;
      this.tubeX.push({ x, y, w: tw, h: th });
      // стан вмісту
      let iceK = 0, leak = 0, flocs = 0;
      if (!this.runner.started) { leak = res.X; flocs = res.X; }
      else if (ph.name === 'cool') { const t = ph.k * this.p.exp; const q = res.tr[Math.min(res.tr.length - 1, Math.round(t / 0.02))]; iceK = q.ice; }
      else if (ph.name === 'up') iceK = res.iceEnd;
      else if (ph.name === 'thaw') { iceK = res.iceEnd * (1 - smooth(0, 0.45, ph.k)); leak = res.X * smooth(0.25, 1, ph.k); flocs = res.X * smooth(0.3, 0.9, ph.k); }
      const sapC = SAPS[this.p.sap].color;
      const liq = beet ? mix([236, 240, 238], [168, 18, 72], clamp(leak * 0.95, 0, 1)) : mix(sapC, [236, 228, 196], 0.25 * (tb.s + tb.g));
      const color = '#' + mix(liq, [238, 244, 250], iceK * 0.85).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      tube(ctx, x, y, tw, th, {
        medium: { level: 0.5, color, gel: iceK > 0.3, alpha: beet ? 0.55 + leak * 0.35 : 0.75, cloudy: beet ? 0 : 0.35 }, plug: null,
        contents: (c, inner) => {
          if (beet) beetDiscs(c, inner, x + tw / 2, y + th, res.X * (u > 0.7 || !this.runner.started ? 1 : 0), i);
          else drawFlocs(c, inner, y + th, flocs, i);
          if (iceK > 0.05) { // кристали льоду
            const R = rng(90 + i); c.strokeStyle = `rgba(255,255,255,${0.6 * iceK})`; c.lineWidth = 0.8;
            for (let k = 0; k < 26 * iceK; k++) { const px = inner.x + R() * inner.w, py = inner.surface + R() * (y + th - inner.surface), l = 2 + R() * 5, a = R() * Math.PI; c.beginPath(); c.moveTo(px - Math.cos(a) * l, py - Math.sin(a) * l); c.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); c.stroke(); }
          }
        },
      });
      if (iceK > 0.2 && ph.name !== 'thaw') { ctx.fillStyle = `rgba(250,252,255,${0.35 * iceK})`; roundRect(ctx, x, y + th * 0.35, tw, th * 0.65, tw / 2); ctx.fill(); }
      // етикетка
      const on = i === this.p.sel;
      txt(ctx, String(tb.n), x + tw / 2, y - 10, { px: 12, align: 'center', weight: 800, color: on ? '#FFFFFF' : '#1F3A2A', bg: on ? '#8C6A10' : 'rgba(255,255,255,.85)' });
      if (gap > 60 / this.S) txt(ctx, tb.label, x + tw / 2, r.by + 16, { px: 9.5, align: 'center', color: '#33463B' });
    });
    // скло ванни поверх
    ctx.strokeStyle = 'rgba(90,120,120,.55)'; ctx.lineWidth = 1.3; roundRect(ctx, bathX, bathY, bathW, bathH, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(bathX + 6, bathY + 6, 4, bathH - 12);
    // термометр
    const tx = bathX + bathW - 16, ty = bathY - r.h * 0.3, tl = r.h * 0.66;
    const Tnow = cooling ? this.p.Tmix : 21;
    ctx.fillStyle = 'rgba(240,248,250,.9)'; roundRect(ctx, tx - 4, ty, 8, tl, 4); ctx.fill(); ctx.strokeStyle = 'rgba(80,110,110,.6)'; ctx.stroke();
    const fy = ty + tl * (1 - (Tnow + 30) / 60);
    ctx.fillStyle = '#C7452E'; ctx.fillRect(tx - 1.5, fy, 3, ty + tl - fy - 4); ctx.beginPath(); ctx.arc(tx, ty + tl - 2, 5, 0, TAU); ctx.fill();
    txt(ctx, `${fnum(Tnow, 0)} °C`, tx + 6, ty - 8, { px: 10.5, align: 'right', weight: 700, color: '#1F3A2A', bg: 'rgba(255,255,255,.85)' });
    txt(ctx, cooling ? 'ванна: лід + NaCl (3 : 1)' : 'ванна: вода кімнатної температури', bathX + bathW / 2, r.by + 34, { px: 10.5, align: 'center', weight: 700, color: '#1F3A2A', bg: 'rgba(255,255,255,.75)' });
  }

  /** Поле зору: тонкий зріз паренхіми буряка (×10 об'єктив). */
  beetMicro(ctx, f, u, ph) {
    const res = this.res[this.p.sel];
    const show = !this.runner.started || ph.name === 'thaw';
    const X = show ? res.X : 0;
    ctx.save();
    const ring = ctx.createRadialGradient(f.cx, f.cy, f.r, f.cx, f.cy, f.r * 1.1); ring.addColorStop(0, '#0B0F0D'); ring.addColorStop(1, '#2A332E');
    ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(f.cx, f.cy, f.r * 1.09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(f.cx, f.cy, f.r, 0, TAU); ctx.clip();
    const bg = ctx.createRadialGradient(f.cx - f.r * 0.2, f.cy - f.r * 0.2, 5, f.cx, f.cy, f.r);
    bg.addColorStop(0, '#FBF6EE'); bg.addColorStop(1, '#E9DCCF'); ctx.fillStyle = bg; ctx.fillRect(f.cx - f.r, f.cy - f.r, 2 * f.r, 2 * f.r);
    // паренхіма: зміщена гексагональна ґратка; вершини — центроїди трійок сусідніх центрів (спільні для сусідів)
    const cs = f.r * 0.25, R = rng(12), G = new Map(), N = 6;
    for (let row = -N; row <= N; row++) for (let col = -N; col <= N; col++) {
      const cx = f.cx + col * cs + (row & 1 ? cs * 0.5 : 0) + (R() - 0.5) * cs * 0.34, cy = f.cy + row * cs * 0.87 + (R() - 0.5) * cs * 0.3;
      G.set(row + ',' + col, { row, col, cx, cy, k: R(), s: R() });
    }
    const nb = (c) => { const o = c.row & 1 ? [[0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0], [1, 1]] : [[0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0]]; return o.map(([dr, dc]) => G.get((c.row + dr) + ',' + (c.col + dc))); };
    const live = [];
    for (const c of G.values()) {
      if (Math.hypot(c.cx - f.cx, c.cy - f.cy) > f.r + cs) continue;
      const ns = nb(c); if (ns.some((q) => !q)) continue;
      c.poly = ns.map((q, j) => { const q2 = ns[(j + 1) % 6]; return [(c.cx + q.cx + q2.cx) / 3, (c.cy + q.cy + q2.cy) / 3]; });
      live.push(c);
    }
    const nIn = live.filter((c) => Math.hypot(c.cx - f.cx, c.cy - f.cy) < f.r - cs * 0.3).length;
    let deadN = 0;
    for (const c of live) {
      const dead = c.k < X, inField = Math.hypot(c.cx - f.cx, c.cy - f.cy) < f.r - cs * 0.3;
      if (dead && inField) deadN++;
      const path = (k) => { const m = c.poly.length; ctx.beginPath(); for (let j = 0; j <= m; j++) { const [x0, y0] = c.poly[j % m], [x1, y1] = c.poly[(j + 1) % m]; const ax = c.cx + (x0 - c.cx) * k, ay = c.cy + (y0 - c.cy) * k, bx = c.cx + (x1 - c.cx) * k, by2 = c.cy + (y1 - c.cy) * k; const mx = (ax + bx) / 2, my = (ay + by2) / 2; j ? ctx.quadraticCurveTo(ax, ay, mx, my) : ctx.moveTo(mx, my); } ctx.closePath(); };
      path(1); ctx.fillStyle = '#E9DCCB'; ctx.fill(); ctx.strokeStyle = 'rgba(120,92,72,.85)'; ctx.lineWidth = 2.2; ctx.stroke();
      path(0.93); ctx.fillStyle = 'rgba(252,247,240,.95)'; ctx.fill();
      const plas = this.p.nacl && !dead ? 0.6 + 0.12 * c.s : 0.9;
      if (!dead) {
        ctx.save(); ctx.translate((c.s - 0.5) * cs * 0.06, (c.k - 0.5) * cs * 0.06);
        path(plas);
        const g = ctx.createRadialGradient(c.cx - cs * 0.15, c.cy - cs * 0.18, 1, c.cx, c.cy, cs * 0.55 * plas);
        g.addColorStop(0, this.p.nacl ? '#CF2A6E' : '#D9447A'); g.addColorStop(0.7, this.p.nacl ? '#9C0F4A' : '#B21E57'); g.addColorStop(1, '#6E0A33');
        ctx.fillStyle = g; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(80,10,40,.4)'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(c.cx - cs * 0.12, c.cy - cs * 0.14, cs * 0.12, cs * 0.06, -0.5, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        // мертва клітина: знебарвлена, зі скоагульованою зернистою цитоплазмою
        const R2 = rng(Math.floor(c.k * 1e6));
        ctx.fillStyle = 'rgba(170,140,120,.55)';
        for (let q = 0; q < 14; q++) { const a = R2() * TAU, d = R2() * cs * 0.35; ctx.beginPath(); ctx.arc(c.cx + Math.cos(a) * d, c.cy + Math.sin(a) * d, 0.8 + R2() * 1.4, 0, TAU); ctx.fill(); }
        if (this.p.nacl) { ctx.fillStyle = 'rgba(214,160,170,.25)'; path(0.88); ctx.fill(); }
      }
    }
    // міжклітинники на стиках
    ctx.fillStyle = 'rgba(110,90,70,.55)';
    for (const c of live) for (const [x, y] of c.poly) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); }
    const v = ctx.createRadialGradient(f.cx, f.cy, f.r * 0.62, f.cx, f.cy, f.r); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.86, 'rgba(90,60,40,.16)'); v.addColorStop(1, 'rgba(0,0,0,.72)');
    ctx.fillStyle = v; ctx.fillRect(f.cx - f.r, f.cy - f.r, 2 * f.r, 2 * f.r);
    ctx.restore();
    applyGrain(ctx, f.cx - f.r, f.cy - f.r, 2 * f.r, 2 * f.r, 0.03);
    txt(ctx, `Пробірка № ${this.p.sel + 1}, ${this.p.nacl ? 'у 8 % NaCl' : 'у власному розчині'}, об’єктив ×10`, f.cx, f.cy - f.r * 1.09 - 8, { px: 11, align: 'center', weight: 700, color: '#1F3A2A', max: f.r * 2.4 });
    txt(ctx, show ? `знебарвлених ${deadN} з ${nIn}${this.p.nacl ? `; плазмоліз — у ${nIn - deadN}` : ''}` : 'свіжа тканина до заморожування', f.cx, f.cy + f.r * 1.09 + 16, { px: 11, align: 'center', color: '#1F3A2A', bg: 'rgba(255,255,255,.85)' });
  }

  /** Схема: білкові глобули з гідратною оболонкою, молекули протектора, пластівці коагуляту. */
  molecules(ctx, f, u, ph) {
    const res = this.res[this.p.sel], tb = this.cfg.tubes[this.p.sel];
    const frozen = this.runner.started && (ph.name === 'cool' || ph.name === 'up');
    const X = !this.runner.started || ph.name === 'thaw' ? res.X : 0;
    const box = { x: f.cx - f.r, y: f.cy - f.r, w: 2 * f.r, h: 2 * f.r };
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, 18);
    const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h); g.addColorStop(0, '#16304A'); g.addColorStop(1, '#0C1B2A'); ctx.fillStyle = g; ctx.fill(); ctx.clip();
    const R = rng(77 + this.p.sel);
    const iceK = frozen ? res.iceEnd : 0;
    // замерзлий розчин: лід (світлі зерна) і вузькі незамерзлі прошарки, куди витіснено білки й солі
    const chans = [];
    if (iceK > 0) {
      const ig = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h); ig.addColorStop(0, '#9FC3E2'); ig.addColorStop(1, '#7FA8CC');
      ctx.fillStyle = ig; ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const cx = box.x + R() * box.w, cy = box.y + R() * box.h, rr = box.w * (0.08 + R() * 0.1); ctx.beginPath(); for (let j = 0; j <= 6; j++) { const a2 = j / 6 * TAU + i; j ? ctx.lineTo(cx + Math.cos(a2) * rr, cy + Math.sin(a2) * rr) : ctx.moveTo(cx + Math.cos(a2) * rr, cy + Math.sin(a2) * rr); } ctx.stroke(); }
      const cw = box.w * (0.03 + 0.12 * (1 - iceK));
      for (let k = 0; k < 3; k++) {
        const y0 = box.y + box.h * (0.25 + k * 0.25), pts = [];
        for (let i = 0; i <= 12; i++) pts.push([box.x + box.w * i / 12, y0 + Math.sin(i * 0.9 + k * 2) * box.h * 0.06]);
        ctx.strokeStyle = 'rgba(12,30,50,.92)'; ctx.lineWidth = cw; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        chans.push(pts);
      }
    }
    const tt = this.runner.running ? performance.now() / 1000 : 0;
    // молекули протектора
    const nCpa = Math.round((tb.s + tb.g) * 120);
    const spot = () => { if (!chans.length) return [box.x + R() * box.w, box.y + R() * box.h]; const pts = chans[Math.floor(R() * chans.length)], q = R() * 12, i0 = Math.floor(q), f2 = q - i0, A = pts[i0], B = pts[Math.min(12, i0 + 1)]; return [lerp(A[0], B[0], f2), lerp(A[1], B[1], f2) + (R() - 0.5) * box.w * 0.03]; };
    for (let i = 0; i < nCpa; i++) { const [sx, sy] = spot(); const x = sx + Math.sin(tt * 2 + i) * 2, y = sy + Math.cos(tt * 2.3 + i) * 2; ctx.fillStyle = i % 2 && tb.s ? 'rgba(255,214,120,.8)' : tb.g ? 'rgba(140,240,200,.8)' : 'rgba(255,214,120,.8)'; ctx.beginPath(); ctx.arc(x, y, tb.s && (i % 2 || !tb.g) ? 2.6 : 1.6, 0, TAU); ctx.fill(); }
    // білки
    const N = 22, agg = Math.round(N * X);
    const pr = (x, y, r, dn) => {
      if (!dn) { ctx.fillStyle = 'rgba(120,190,255,.16)'; ctx.beginPath(); ctx.arc(x, y, r * 1.55, 0, TAU); ctx.fill(); }
      const pg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      pg.addColorStop(0, dn ? '#E8D8B8' : '#F4D7A0'); pg.addColorStop(1, dn ? '#8A7458' : '#B4782E'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (!dn) { ctx.strokeStyle = 'rgba(90,50,20,.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0.3, 4); ctx.stroke(); }
    };
    const pr0 = box.w * 0.03;
    // скупчення (пластівці)
    let left = agg, ci = 0;
    while (left > 0) { const k = Math.min(left, 3 + (ci % 3)); const cx = box.x + box.w * (0.2 + 0.6 * R()), cy = box.y + box.h * (0.55 + 0.35 * R()); for (let j = 0; j < k; j++) pr(cx + (R() - 0.5) * pr0 * 2.4, cy + (R() - 0.5) * pr0 * 2.2, pr0 * 0.95, true); left -= k; ci++; }
    for (let i = agg; i < N; i++) { const [sx, sy] = chans.length ? spot() : [box.x + box.w * (0.08 + 0.84 * R()), box.y + box.h * (0.1 + 0.8 * R())]; pr(sx + Math.sin(tt + i) * 3, sy + Math.cos(tt * 1.2 + i) * 3, pr0 * (chans.length ? 0.8 : 1), false); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; roundRect(ctx, box.x, box.y, box.w, box.h, 18); ctx.stroke();
    txt(ctx, frozen ? 'під час заморожування: лід і концентровані прошарки' : X > 0.1 ? `після розморожування: ${fnum(X * 100, 0)} % білка в пластівцях` : 'білки в нативному стані', f.cx, box.y + 18, { px: 10.5, align: 'center', color: '#EAF3FF', weight: 700, max: box.w - 16 });
    txt(ctx, 'білок + гідратна оболонка', box.x + 14, box.y + box.h - 32, { px: 9.5, color: '#DCEBFA', bg: 'rgba(8,20,34,.75)' });
    txt(ctx, tb.s || tb.g ? `${tb.s ? '● сахароза ' : ''}${tb.g ? '• гліцерин' : ''}` : 'без протектора', box.x + 14, box.y + box.h - 13, { px: 9.5, color: '#F5E1A8', bg: 'rgba(8,20,34,.75)' });
    txt(ctx, 'Схема на рівні молекул (не в масштабі)', f.cx, box.y + box.h + 16, { px: 10.5, align: 'center', color: '#1F3A2A' });
  }
}

function beetDiscs(c, inner, cx, bottom, X, i) {
  const R = rng(300 + i), n = 4;
  for (let k = 0; k < n; k++) {
    const w = inner.w * 0.7, h = w * 0.55, x = cx - w / 2 + (R() - 0.5) * inner.w * 0.18, y = bottom - inner.w * 0.5 - (k + 0.5) * h * 0.9;
    const col = mix([150, 18, 64], [205, 120, 140], X * 0.55);
    const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, rgba(shade(col, -0.35))); g.addColorStop(0.4, rgba(shade(col, 0.15))); g.addColorStop(1, rgba(shade(col, -0.4)));
    c.fillStyle = g; roundRect(c, x, y - h / 2, w, h, h * 0.35); c.fill();
    c.fillStyle = rgba(shade(col, 0.3), 0.6); c.beginPath(); c.ellipse(x + w / 2, y - h / 2 + 1.5, w / 2 - 1, h * 0.18, 0, 0, TAU); c.fill();
    // кільця судинних пучків
    c.strokeStyle = rgba(shade(col, 0.45), 0.4); c.lineWidth = 0.6; c.beginPath(); c.ellipse(x + w / 2, y - h / 2 + 1.5, w * 0.3, h * 0.1, 0, 0, TAU); c.stroke();
  }
  // хмарка пігменту біля дисків
  if (X > 0.05) { const g = c.createRadialGradient(cx, bottom - inner.w * 1.2, 1, cx, bottom - inner.w * 1.2, inner.w * 1.6); g.addColorStop(0, `rgba(170,20,80,${0.35 * X})`); g.addColorStop(1, 'rgba(170,20,80,0)'); c.fillStyle = g; c.fillRect(inner.x, inner.surface, inner.w, bottom - inner.surface); }
}

function drawFlocs(c, inner, bottom, k, i) {
  if (k <= 0.02) return;
  const R = rng(500 + i), n = Math.round(40 * k);
  for (let j = 0; j < n; j++) {
    const settled = R() < 0.55, x = inner.x + 2 + R() * (inner.w - 4), y = settled ? bottom - 3 - R() * inner.w * 0.5 : inner.surface + 4 + R() * (bottom - inner.surface - 8), s = 1 + R() * 2.6;
    c.fillStyle = `rgba(250,246,232,${0.6 + R() * 0.35})`; c.beginPath();
    for (let q = 0; q < 6; q++) { const a = q / 6 * TAU, rr = s * (0.6 + R() * 0.7); q ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
}
