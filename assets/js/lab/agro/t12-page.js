// Тема 12, ЛР 52: ізоферментний спектр пероксидаз — вертикальний диск-електрофорез у ПААГ за Девісом і зимограма.
// Посібник (с. 185–186): 2,5 г листків + 3-кратний об'єм тріс-гліцинового буфера pH 8,3 (6 г тріс + 28,8 г гліцину / 1 л);
// центрифугування 20 хв при 2000 g; блоки 7,5 % ПААГ 115 × 115 × 2 мм; спершу 100 В, далі 200 В до кінця розділення
// (у тексті одиниця надрукована як «W»); фронт — бромфеноловий синій; проявлення бензидином з аскорбіновою кислотою
// (20 мл основного розчину бензидину + 70,4 мг аскорбінової кислоти + 20 мл 0,6 % H2O2 + 60 мл води);
// «час розвитку забарвлення прямо пропорційний концентрації аскорбінової кислоти й обернено пропорційний активності
// ферменту» → t = k·C/a; спектр характеризують відносною рухливістю Rf = l / l_фронту.
// Модельні (не з посібника): Rf і активності ізоформ у зразках — умовні навчальні дані; залежність Rf від %T —
// лінійна залежність Фергюсона lg Rf = lg Rf₇,₅ − K·(T − 7,5); рухливість фронту 0,0075 мм/(В·хв).
import { fit, scene, shadow, roundRect, rng, clamp, lerp, mix, rgba, shade, smooth, TAU, Runner, onResize, fnum, Plot, applyGrain, fbm, offscreen } from './kit.js';
import { frame, setRead, setVerdict, setHud, seg, slide, txt, setScale, el } from './t12-ui.js';

export const GEL = { H: 115, stack: 12, stop: 5, lanes: 6 };          // мм
export const MU = 0.0075;                                               // мм/(В·хв), модельне
export const ISO = [0.10, 0.18, 0.27, 0.38, 0.49, 0.61, 0.74];         // Rf ізопероксидаз А1…А7 у 7,5 % гелі (умовно)
export const LANES = [
  { short: 'К', name: 'Листок, контроль', a: [0, 0.5, 0, 0.8, 0.45, 0.3, 0] },
  { short: 'П', name: 'Листок, посуха', a: [0, 0.7, 0.45, 1.0, 0.7, 0.5, 0.35] },
  { short: 'NaCl', name: 'Листок, засолення', a: [0, 0.6, 0.5, 0.95, 0.6, 0.45, 0.25] },
  { short: 'Х', name: 'Загартування холодом', a: [0.35, 0.65, 0, 0.9, 0.55, 0.4, 0] },
  { short: 'Кл', name: 'Калюс', a: [0.55, 0, 0.7, 0.5, 0, 0.85, 0] },
  { short: 'Кр', name: 'Корінь', a: [0.8, 0.9, 0.6, 0, 0.5, 0, 0.7] },
];
const K_LAG = 2.4; // хв: час появи смуги з a = 1 при стандартній (1×) концентрації аскорбату

/** Rf ізоформи за %T гелю (Фергюсон). */
export function rfAt(rf75, T) { const K = 0.02 + 0.06 * (1 - rf75); return clamp(rf75 * Math.pow(10, -K * (T - 7.5)), 0.02, 0.97); }
/** Положення фронту (мм від верху гелю) і напруга за модельним часом t, хв. */
export function front(t) {
  const t1 = GEL.stack / (MU * 100);                 // прохід концентруючого гелю при 100 В
  const tEnd = t1 + (GEL.H - GEL.stack - GEL.stop) / (MU * 200);
  if (t <= t1) return { s: MU * 100 * t, U: 100, t1, tEnd };
  return { s: Math.min(GEL.H - GEL.stop, GEL.stack + MU * 200 * (t - t1)), U: t < tEnd ? 200 : 0, t1, tEnd };
}
/** Смуги доріжки: Rf, l (мм від початку розділяючого гелю), активність, час появи (хв). */
export function bands(lane, T, asc) {
  const lf = GEL.H - GEL.stack - GEL.stop;
  return LANES[lane].a.map((a, i) => a > 0 ? { n: i + 1, a, rf: rfAt(ISO[i], T), l: rfAt(ISO[i], T) * lf, lag: K_LAG * asc / a } : null).filter(Boolean);
}
const intensity = (b, ts) => ts <= b.lag ? 0 : b.a * (1 - Math.exp(-(ts - b.lag) / 1.6));

export class PageModel {
  constructor(host) {
    this.p = { lane: 1, T: 7.5, asc: 1 };
    const F = frame(host, {
      aria: 'Камера для вертикального електрофорезу з поліакриламідним гелем і кювета з гелем у бензидиновому барвнику: зимограма ізопероксидаз',
      reads: [['front', 'Фронт барвника, мм'], ['time', 'Час електрофорезу'], ['u', 'Напруга'], ['stain', 'Час проявлення'], ['nb', 'Видимих смуг на доріжці'], ['rf', 'Rf найактивнішої ізоформи']],
      panels: ['Зразки на доріжках', 'Гель і проявлення'],
      plots: [['dens', 'Денситограма обраної доріжки (інтенсивність забарвлення від Rf)'], ['lag', 'Час появи смуги: <i>t</i> = <i>k</i>·<i>C</i><sub>аск</sub> / <i>a</i>']],
      table: true,
      note: '<b>ПААГ</b> — поліакриламідний гель; <b>Rf</b> — відносна електрофоретична рухливість (відстань смуги від початку розділяючого гелю, поділена на відстань фронту бромфенолового синього); <b>ізопероксидази А1–А7</b> — молекулярні форми пероксидази з різною рухливістю (умовні навчальні дані). Торкніться доріжки на гелі, щоб обрати її. Пояснення — у <a href="#t12-page">теорії</a>.',
    });
    this.F = F;
    const [p1, p2] = F.panels;
    this.laneSeg = seg(p1, 'Доріжка для денситограми', LANES.map((l, i) => ({ value: String(i), label: `${i + 1}` })), String(this.p.lane), (v) => { this.p.lane = +v; this.update(); });
    p1.append(el('ol', { class: 't12-lanes' }, LANES.map((l) => el('li', { text: l.name }))));
    this.sl = slide(p2, [{ id: 'pg-T', label: 'Концентрація розділяючого гелю', min: 5, max: 10, step: 0.5, value: 7.5, unit: '%', digits: 1, hint: 'за посібником — 7,5 %; щільніший гель гальмує великі молекули' }],
      () => { this.p.T = this.sl.values['pg-T']; this.update(); });
    seg(p2, 'Аскорбінова кислота в барвнику', [{ value: '0.5', label: '35 мг' }, { value: '1', label: '70,4 мг' }, { value: '2', label: '141 мг' }], '1', (v) => { this.p.asc = +v; this.update(); });
    this.dens = new Plot(F.plots.dens, { xLabel: 'Rf', yLabel: 'інтенсивність', x: [0, 1], y: [0, 1.15], xShort: 'Rf', aspect: 1.55 });
    this.lag = new Plot(F.plots.lag, { xLabel: 'відносна активність a', yLabel: 't, хв', x: [0, 1.05], y: [0, 22], xShort: 'a', aspect: 1.55 });
    this.anim = { phase: 'idle', t: 0, ts: 20, load: 1 };
    this.runner = new Runner({ btn: F.run, reset: F.reset, step: (dt, t, r) => this.step(dt, r), draw: () => this.draw() });
    F.status.textContent = 'Статичний кадр: показано розрахунковий результат.';
    F.canvas.addEventListener('pointerdown', (e) => this.pick(e));
    onResize(F.canvas.parentElement, () => { this.texture = null; this.draw(); });
    this.update();
  }

  state() {
    const a = this.anim, st = this.runner.started;
    const fr = front(st ? a.t : 1e9);
    return { fr, ts: st ? (a.phase === 'stain' || a.phase === 'done' ? a.ts : 0) : 20, stain: !st || a.phase === 'stain' || a.phase === 'done', load: st ? a.load : 1, run: a.phase === 'run' };
  }

  update() { this.renderAll(); this.draw(); }

  renderAll() {
    const s = this.state(), R = this.F.reads, p = this.p;
    const bs = bands(p.lane, p.T, p.asc), vis = bs.filter((b) => intensity(b, s.ts) > 0.05);
    const strongest = bs.reduce((m, b) => (!m || b.a > m.a ? b : m), null);
    setRead(R.front, `${fnum(s.fr.s, 0)} / ${GEL.H}`);
    const tt = Math.min(this.runner.started ? this.anim.t : s.fr.tEnd, s.fr.tEnd);
    setRead(R.time, `${Math.floor(tt / 60)} год ${String(Math.round(tt % 60)).padStart(2, '0')} хв`);
    setRead(R.u, s.run ? `${s.fr.U} В` : '0 В');
    setRead(R.stain, `${fnum(s.ts, 1)} хв`);
    setRead(R.nb, `${vis.length} з ${bs.length}`, vis.length < bs.length ? 'bad' : 'ok');
    setRead(R.rf, strongest ? fnum(strongest.rf, 2) : '—');
    // вердикт
    const ctrl = bands(0, p.T, p.asc).map((b) => b.n), extra = bs.filter((b) => !ctrl.includes(b.n)).map((b) => 'А' + b.n), lost = ctrl.filter((n) => !bs.find((b) => b.n === n)).map((n) => 'А' + n);
    let html = `<b>Доріжка ${p.lane + 1} — ${LANES[p.lane].name.toLowerCase()}:</b> ${bs.length} ізоформ пероксидази, Rf ${bs.map((b) => fnum(b.rf, 2)).join('; ')}. `;
    if (p.lane > 0) html += extra.length || lost.length ? `Порівняно з контролем ${extra.length ? 'з’явилися ' + extra.join(', ') : ''}${extra.length && lost.length ? ', ' : ''}${lost.length ? 'зникли ' + lost.join(', ') : ''} — такі зміни спектра й використовують як біохімічний маркер стану тканини. ` : 'Спектр збігається з контролем. ';
    const late = bs.filter((b) => b.lag > 20);
    let kind = '';
    if (late.length) { kind = 'warn'; html += `За ${p.asc > 1 ? 'підвищеної' : ''} концентрації аскорбату слабкі смуги (${late.map((b) => 'А' + b.n).join(', ')}) не встигають проявитися за 20 хв: час появи t = k·C/a обернено пропорційний активності.`; }
    else if (p.T !== 7.5) html += `У ${fnum(p.T, 1)} % гелі Rf змінилися: ${p.T > 7.5 ? 'щільніша сітка сильніше гальмує великі (повільні) ізоформи' : 'рідша сітка пропускає молекули вільніше, смуги зсуваються до фронту'}.`;
    else html += 'Найактивніші ізоформи проявляються першими — за ними можна порівнювати зразки.';
    setVerdict(this.F.verdict, html, kind);
    // графіки
    const prof = (lane) => { const d = [], bb = bands(lane, p.T, p.asc); for (let x = 0; x <= 1.0001; x += 0.004) { let v = 0; for (const b of bb) v += intensity(b, s.ts) * Math.exp(-0.5 * Math.pow((x - b.rf) / 0.012, 2)); d.push([x, Math.min(1.1, v)]); } return d; };
    this.dens.set([
      p.lane ? { data: prof(0), color: '#B9C4BD', width: 1.5, label: 'контроль (доріжка 1)' } : null,
      { data: prof(p.lane), color: '#2B4C9B', width: 2.4, fill: 'rgba(43,76,155,.14)', label: `доріжка ${p.lane + 1}` },
    ], bs.map((b) => ({ x: b.rf, color: 'rgba(43,76,155,.35)', dash: [2, 4] })));
    const hyp = []; for (let a = 0.08; a <= 1.05; a += 0.01) hyp.push([a, K_LAG * p.asc / a]);
    this.lag.set([
      { data: hyp, color: '#8C6A10', width: 2.2, label: `${fnum(70.4 * p.asc, 1)} мг аскорбату` },
      { data: bs.map((b) => [b.a, Math.min(21.5, b.lag)]), type: 'points', color: '#2B4C9B', label: 'смуги доріжки' },
    ], [{ y: Math.max(0.01, s.ts), color: '#1F5C3A', label: `проявлення ${fnum(s.ts, 1)} хв` }]);
    // таблиця
    const lf = GEL.H - GEL.stack - GEL.stop;
    this.F.table.innerHTML = `<table class="ag-table"><thead><tr><th>Ізоформа</th><th class="num">l, мм</th><th class="num">Rf = l / ${fnum(lf, 0)}</th><th class="num">Відн. активність</th><th class="num">Поява, хв</th></tr></thead><tbody>${bs.map((b) => `<tr><td>А${b.n}</td><td class="num">${fnum(b.l, 1)}</td><td class="num">${fnum(b.rf, 2)}</td><td class="num">${fnum(b.a, 2)}</td><td class="num">${b.lag > 20 ? '> 20' : fnum(b.lag, 1)}</td></tr>`).join('')}</tbody></table>`;
  }

  step(dt, reset) {
    const a = this.anim;
    if (reset) { Object.assign(a, { phase: 'idle', t: 0, ts: 0, load: 1 }); this.F.status.textContent = 'Статичний кадр: показано розрахунковий результат.'; this.renderAll(); return; }
    if (a.phase === 'idle') { a.phase = 'load'; a.load = 0; a.t = 0; a.ts = 0; }
    const fr = front(0);
    if (a.phase === 'load') { a.load = Math.min(1, a.load + dt / 1.4); this.F.status.textContent = 'Наносимо зразки з бромфеноловим синім у лунки…'; if (a.load >= 1) a.phase = 'run'; }
    else if (a.phase === 'run') {
      a.t = Math.min(fr.tEnd, a.t + dt * fr.tEnd / 9);
      const f = front(a.t);
      this.F.status.textContent = `Електрофорез: ${f.U} В, ${Math.round(a.t)} хв — ${a.t < f.t1 ? 'концентрування в 2,5 % гелі' : 'розділення в 7,5 % гелі'}`;
      if (a.t >= fr.tEnd) { a.phase = 'stain'; a.ts = 0; }
    } else if (a.phase === 'stain') {
      a.ts = Math.min(20, a.ts + dt * 20 / 7);
      this.F.status.textContent = `Проявлення в бензидин-аскорбатному розчині: ${fnum(a.ts, 1)} хв`;
      if (a.ts >= 20) { a.phase = 'done'; this.F.status.textContent = 'Готово: виміряйте відстані смуг і розрахуйте Rf.'; this.renderAll(); this.runner.finish(); return; }
    }
    this.frameCount = (this.frameCount || 0) + 1;
    if (this.frameCount % 4 === 0) this.renderAll();
  }

  pick(e) {
    if (!this.trayRect) return;
    const r = this.F.canvas.getBoundingClientRect(), S = this.S;
    const x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S, g = this.trayRect;
    if (x < g.x || x > g.x + g.w || y < g.y - 10 || y > g.y + g.h + 30) return;
    const lane = clamp(Math.floor((x - g.x) / (g.w / GEL.lanes)), 0, GEL.lanes - 1);
    this.p.lane = lane; this.laneSeg.select(String(lane)); this.update();
  }

  draw() {
    const cv = this.F.canvas;
    if (cv.parentElement.clientWidth < 60) return; // вкладка прихована — малюємо, коли стане видимою
    const narrow = cv.parentElement.clientWidth < 620;
    const { ctx, w, h } = fit(cv, { aspect: narrow ? 0.62 : 1.75, min: 320, max: narrow ? 900 : 580 });
    const DW = narrow ? 560 : 1000, S = w / DW, DH = h / S; this.S = S;
    setScale(S); ctx.save(); ctx.scale(S, S);
    const s = this.state();
    const hy = scene(ctx, DW, DH, { kind: 'bench', horizon: narrow ? 0.93 : 0.86, light: 0.3 });
    let app, ps, tray;
    if (narrow) {
      app = { x: 52, y: DH * 0.52, w: DW * 0.5, h: hy - DH * 0.52 };
      ps = { x: DW * 0.64, y: hy - 96, w: DW * 0.32, h: 92 };
      tray = { x: 60, y: 46, w: DW - 100, h: DH * 0.38 };
    } else {
      app = { x: DW * 0.075, y: 56, w: DW * 0.29, h: hy - 56 };
      ps = { x: DW * 0.385, y: hy - 112, w: DW * 0.15, h: 104 };
      tray = { x: DW * 0.6, y: 50, w: DW * 0.34, h: hy - 120 };
    }
    this.apparatus(ctx, app, s);
    this.supply(ctx, ps, s, app);
    this.tray(ctx, tray, s);
    ctx.restore();
    const f = s.fr;
    setHud(this.F.hud, ['ЛР 52', `ПААГ ${fnum(this.p.T, 1)} %`, s.run ? `${f.U} В` : 'струм вимкнено', `проявлення ${fnum(s.ts, 0)} хв`]);
  }

  /** Камера для вертикального електрофорезу (2.5D): нижній бак, вертикальний блок із верхньою камерою, скляні пластини з гелем. */
  apparatus(ctx, r, s) {
    const { x, y, w, h } = r, by = y + h;
    shadow(ctx, x + w / 2, by + 2, w * 0.62, 12, 0.38);
    const tankT = by - h * 0.34, dz = h * 0.05;
    // задня стінка бака
    ctx.fillStyle = 'rgba(205,228,232,.35)'; roundRect(ctx, x + dz * 0.6, tankT - dz, w - dz * 0.6, by - tankT, 8); ctx.fill();
    // блок (кремовий пластик)
    const cx0 = x + w * 0.1, cw = w * 0.8, cy0 = y + h * 0.06, cb = by - h * 0.04;
    let g = ctx.createLinearGradient(cx0, 0, cx0 + cw, 0); g.addColorStop(0, '#CDBFA0'); g.addColorStop(0.15, '#EFE6CF'); g.addColorStop(0.85, '#E8DEC4'); g.addColorStop(1, '#BBAD8E');
    ctx.fillStyle = g; roundRect(ctx, cx0, cy0, cw, cb - cy0, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(110,95,60,.45)'; ctx.lineWidth = 1; ctx.stroke();
    // верхня буферна камера
    const ubT = cy0 + h * 0.03, ubB = cy0 + h * 0.16;
    ctx.fillStyle = 'rgba(150,195,215,.55)'; ctx.fillRect(cx0 + cw * 0.08, ubT + (ubB - ubT) * 0.35, cw * 0.84, (ubB - ubT) * 0.65);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.moveTo(cx0 + cw * 0.08, ubT + (ubB - ubT) * 0.35); ctx.lineTo(cx0 + cw * 0.92, ubT + (ubB - ubT) * 0.35); ctx.stroke();
    // скляні пластини з гелем
    const gx = cx0 + cw * 0.12, gw = cw * 0.76, gy = ubB - h * 0.035, gh = cb - h * 0.05 - gy;
    this.gelBox = { gx, gw, gy, gh };
    g = ctx.createLinearGradient(gx, 0, gx + gw, 0); g.addColorStop(0, 'rgba(215,232,234,.95)'); g.addColorStop(0.5, 'rgba(238,246,246,.92)'); g.addColorStop(1, 'rgba(212,229,232,.95)');
    ctx.fillStyle = g; ctx.fillRect(gx, gy, gw, gh);
    const mm = gh / GEL.H, stackY = gy + GEL.stack * mm;
    ctx.fillStyle = 'rgba(244,246,238,.9)'; ctx.fillRect(gx + 4, gy + 2, gw - 8, gh - 3);
    ctx.fillStyle = 'rgba(222,232,220,.9)'; ctx.fillRect(gx + 4, stackY, gw - 8, gh - (stackY - gy) - 1);
    ctx.strokeStyle = 'rgba(120,140,130,.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(gx + 4, stackY); ctx.lineTo(gx + gw - 4, stackY); ctx.stroke(); ctx.setLineDash([]);
    // лунки, зразки, фронт
    const lw = (gw - 8) / GEL.lanes;
    for (let i = 0; i < GEL.lanes; i++) {
      const lx = gx + 4 + i * lw + lw * 0.15, ww = lw * 0.7, wh = GEL.stack * mm * 0.45;
      ctx.fillStyle = 'rgba(175,198,205,.7)'; ctx.fillRect(lx, gy + 2, ww, wh);
      const fs = s.fr.s;
      if (s.load > 0 && fs < 0.5) { ctx.fillStyle = rgba([40, 70, 200], 0.7 * s.load); ctx.fillRect(lx, gy + 2 + wh * (1 - s.load), ww, wh * s.load); }
      else if (s.load > 0) {
        const fy = gy + fs * mm, thick = fs < GEL.stack ? lerp(wh / mm, 1.4, fs / GEL.stack) * mm : 1.6 * mm;
        const smile = Math.sin(Math.PI * (i + 0.5) / GEL.lanes) * 2;
        const fg = ctx.createLinearGradient(0, fy - thick, 0, fy + 1);
        fg.addColorStop(0, 'rgba(40,70,200,.05)'); fg.addColorStop(1, 'rgba(40,70,200,.85)');
        ctx.fillStyle = fg; ctx.fillRect(lx, fy - thick + smile, ww, thick);
      }
    }
    g = ctx.createLinearGradient(gx, gy, gx + gw * 0.6, gy + gh); g.addColorStop(0, 'rgba(255,255,255,.4)'); g.addColorStop(0.3, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = 'rgba(80,110,105,.6)'; ctx.lineWidth = 1.2; ctx.strokeRect(gx, gy, gw, gh);
    // червоні затискачі
    for (const side of [-1, 1]) {
      const kw = w * 0.11, kx = side < 0 ? cx0 - kw * 0.55 : cx0 + cw - kw * 0.45, ky = gy + gh * 0.1, kh = gh * 0.34;
      g = ctx.createLinearGradient(kx, 0, kx + kw, 0); g.addColorStop(0, '#8E1F14'); g.addColorStop(0.45, '#D2402F'); g.addColorStop(1, '#7E1A11');
      ctx.fillStyle = g; roundRect(ctx, kx, ky, kw, kh, 5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(kx, ky + kh * 0.45, kw, 2);
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(kx + kw * 0.22, ky + 3, 2, kh - 6);
    }
    // передня стінка бака з буфером
    ctx.fillStyle = 'rgba(200,226,232,.22)'; roundRect(ctx, x, tankT, w, by - tankT, 8); ctx.fill();
    g = ctx.createLinearGradient(0, tankT + (by - tankT) * 0.3, 0, by); g.addColorStop(0, 'rgba(160,200,218,.40)'); g.addColorStop(1, 'rgba(130,175,198,.5)');
    ctx.fillStyle = g; roundRect(ctx, x + 3, tankT + (by - tankT) * 0.3, w - 6, (by - tankT) * 0.7 - 3, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 4, tankT + (by - tankT) * 0.3); ctx.lineTo(x + w - 4, tankT + (by - tankT) * 0.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,120,120,.55)'; ctx.lineWidth = 1.2; roundRect(ctx, x, tankT, w, by - tankT, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x + 6, tankT + 5, 3, by - tankT - 12);
    if (s.run) {
      const R = rng(Math.floor(performance.now() / 120));
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(x + w * (0.15 + R() * 0.7), by - 6 - R() * (by - tankT) * 0.5, 0.8 + R() * 1.4, 0, TAU); ctx.fill(); }
    }
    // клеми
    const post = (px, py, c) => { ctx.fillStyle = '#C3C9C7'; ctx.fillRect(px - 2.5, py, 5, 14); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.fill(); };
    const pm = [cx0 + cw * 0.86, cy0 - 12], pp = [x + w - 14, tankT - 12];
    post(pm[0], pm[1], '#1A1F1C'); post(pp[0], pp[1], '#B32A1E');
    this.term = { minus: pm, plus: pp };
    txt(ctx, '− катод', pm[0] - 8, pm[1] - 4, { px: 10.5, weight: 700, color: '#1F2A24', align: 'right' });
    txt(ctx, '+ анод', pp[0] - 8, pp[1] - 4, { px: 10.5, weight: 700, color: '#A2281C', align: 'right' });
    txt(ctx, '2,5 %', x - 6, gy + GEL.stack * mm * 0.6, { px: 9.5, align: 'right', base: 'middle', color: '#33463B' });
    txt(ctx, `${fnum(this.p.T, 1)} %`, x - 6, gy + gh * 0.55, { px: 9.5, align: 'right', base: 'middle', color: '#33463B' });
    applyGrain(ctx, x, y, w, h, 0.03);
  }

  /** Джерело живлення з дисплеєм і дротами. */
  supply(ctx, r, s, app) {
    const { x, y, w, h } = r;
    const jr = Math.min(7, w * 0.05);
    const jk = [[x + w * 0.3, y + h * 0.78, '#1A1F1C'], [x + w * 0.7, y + h * 0.78, '#B32A1E']];
    // дроти
    const wire = (from, to, c) => { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.bezierCurveTo(from[0] + 10, from[1] + 40, to[0] + 70, to[1] - 30, to[0], to[1]); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke(); };
    wire([jk[0][0], jk[0][1]], this.term.minus, '#1A1F1C');
    wire([jk[1][0], jk[1][1]], this.term.plus, '#B32A1E');
    shadow(ctx, x + w / 2, y + h + 2, w * 0.6, 7, 0.35);
    let g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#E7EAE6'); g.addColorStop(1, '#BFC5C0');
    ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 6); ctx.fill();
    ctx.fillStyle = '#D5DAD5'; ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + w - 4, y); ctx.lineTo(x + w - 12, y - 10); ctx.lineTo(x + 12, y - 10); ctx.closePath(); ctx.fill();
    const Sc = this.S, r1 = y + 10 + 10 / Sc, r2 = r1 + 14 / Sc;
    ctx.fillStyle = '#132019'; roundRect(ctx, x + 8, y + 10, w - 16, Math.max(h * 0.42, 34 / Sc), 4); ctx.fill();
    const t = Math.min(this.runner.started ? this.anim.t : s.fr.tEnd, s.fr.tEnd);
    const U = s.run ? s.fr.U : 0, I = U ? U / (5.2 + 2.0 * s.fr.s / GEL.H) : 0;
    txt(ctx, `${U} V`, x + 14, r1, { px: 12, font: 'mono', weight: 700, color: '#8DF5A8', base: 'middle' });
    txt(ctx, `${fnum(I, 0)} mA`, x + w - 14, r1, { px: 10, font: 'mono', weight: 700, color: '#8DF5A8', base: 'middle', align: 'right' });
    txt(ctx, `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, x + 14, r2, { px: 10, font: 'mono', color: '#C6F7D2', base: 'middle' });
    for (const [jx, jy, c] of jk) { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(jx, jy); ctx.quadraticCurveTo(jx + 2, jy + 14, jx + 6, y + h + 6); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(jx, jy, jr, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(jx - 2, jy - 2, jr * 0.35, 0, TAU); ctx.fill(); }
    txt(ctx, 'джерело живлення', x + w / 2, y + h + 15, { px: 9.5, align: 'center', color: '#33463B' });
  }

  /** Кювета з гелем у барвнику: зимограма. */
  tray(ctx, r, s) {
    const { x, y, w, h } = r;
    // скляна кювета
    shadow(ctx, x + w / 2, y + h + 18, w * 0.6, 12, 0.3);
    const pad = Math.min(w, h) * 0.07;
    let g = ctx.createLinearGradient(0, y - pad, 0, y + h + pad);
    g.addColorStop(0, 'rgba(225,238,236,.7)'); g.addColorStop(1, 'rgba(200,220,216,.75)');
    ctx.fillStyle = g; roundRect(ctx, x - pad, y - pad, w + 2 * pad, h + 2 * pad + 6, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(90,120,115,.55)'; ctx.lineWidth = 1.3; ctx.stroke();
    // барвник
    const stainCol = s.stain ? mix([228, 226, 205], [205, 205, 214], smooth(0, 20, s.ts)) : [222, 236, 240];
    ctx.fillStyle = rgba(stainCol, 0.85); roundRect(ctx, x - pad * 0.6, y - pad * 0.6, w + pad * 1.2, h + pad * 1.2, 9); ctx.fill();
    // гель (розділяючий)
    const gx = x + w * 0.1, gw = w * 0.86, gy = y + 4, gh = h - 8;
    this.trayRect = { x: gx, y: gy, w: gw, h: gh };
    if (!this.texture || this.texture.width !== Math.ceil(gw * this.S) || this.texture.height !== Math.ceil(gh * this.S)) this.texture = gelTexture(gw * this.S, gh * this.S);
    ctx.drawImage(this.texture, gx, gy, gw, gh);
    const lf = GEL.H - GEL.stack - GEL.stop, mm = gh / (GEL.H - GEL.stack);
    const lw = gw / GEL.lanes;
    if (s.stain) {
      const col = mix([30, 55, 160], [110, 72, 40], 0.55 * smooth(5, 20, s.ts));
      for (let i = 0; i < GEL.lanes; i++) {
        for (const b of bands(i, this.p.T, this.p.asc)) {
          const I = intensity(b, s.ts); if (I <= 0.01) continue;
          const by = gy + b.l * mm, th = Math.max(3, 1.6 * mm), lx = gx + i * lw + lw * 0.12, ww = lw * 0.76;
          const bg = ctx.createLinearGradient(0, by - th, 0, by + th);
          bg.addColorStop(0, rgba(col, 0)); bg.addColorStop(0.5, rgba(col, 0.92 * I)); bg.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.moveTo(lx, by - th); ctx.quadraticCurveTo(lx + ww / 2, by - th + 2.5, lx + ww, by - th); ctx.lineTo(lx + ww, by + th); ctx.quadraticCurveTo(lx + ww / 2, by + th + 2.5, lx, by + th); ctx.closePath(); ctx.fill();
        }
      }
    }
    // фронт (слід барвника)
    ctx.fillStyle = 'rgba(60,90,200,.35)'; ctx.fillRect(gx + 2, gy + lf * mm - 1, gw - 4, 2);
    // виділення доріжки
    const sl = this.p.lane;
    ctx.strokeStyle = '#D4A017'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(gx + sl * lw + 2, gy + 1, lw - 4, gh - 2); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(80,100,90,.5)'; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
    // шкала Rf
    const rx = gx - 6;
    ctx.strokeStyle = '#33463B'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx, gy + lf * mm); ctx.stroke();
    for (let k = 0; k <= 10; k++) { const yy = gy + lf * mm * k / 10; ctx.beginPath(); ctx.moveTo(rx, yy); ctx.lineTo(rx - (k % 5 ? 3 : 6), yy); ctx.stroke(); if (k % 5 === 0) txt(ctx, fnum(k / 10, 1), rx - 8, yy, { px: 9, align: 'right', base: 'middle', color: '#33463B' }); }
    txt(ctx, 'Rf', rx - 8, gy - 10, { px: 10, align: 'right', weight: 800, color: '#1F3A2A' });
    for (let i = 0; i < GEL.lanes; i++) txt(ctx, String(i + 1), gx + i * lw + lw / 2, gy + gh + 16, { px: 11, align: 'center', weight: i === sl ? 800 : 600, color: i === sl ? '#8C6A10' : '#1F3A2A' });
    txt(ctx, s.stain ? 'Зимограма: гель у бензидин-аскорбатному барвнику' : 'Кювета для проявлення (чекає на гель)', x + w / 2, y - pad - 8, { px: 11, align: 'center', weight: 700, color: '#1F3A2A', max: w + 2 * pad });
    txt(ctx, 'фронт БФС', gx + gw - 3, gy + lf * mm - 5, { px: 9, align: 'right', color: '#2B4C9B' });
  }
}

/** Процедурна текстура поліакриламідного гелю (кешується). */
function gelTexture(w, h) {
  const c = offscreen(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#EEF1EA'); g.addColorStop(1, '#E2E8E0');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let j = 0; j < c.height; j += 2) for (let i = 0; i < c.width; i += 2) {
    const v = (fbm(i / 40, j / 40, 3, 3) - 0.5) * 14;
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = ((j + dj) * c.width + i + di) * 4; if (k < d.length) { d[k] += v; d[k + 1] += v; d[k + 2] += v; } }
  }
  x.putImageData(img, 0, 0);
  return c;
}
