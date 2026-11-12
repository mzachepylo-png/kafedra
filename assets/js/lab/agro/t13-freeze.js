// Тема 13: загальна модель кріозбереження — програмне заморожування, кріопротектори, лід під кріомікроскопом.
// Посібник, с. 191–197 (див. t13-cryo-math.js — формули й коефіцієнти).
import { fit, scene, shadow, roundRect, rng, clamp, lerp, mix, rgba, shade, smooth, TAU, Runner, onResize, fnum, Plot, applyGrain, fbm, noise, offscreen, easeInOut } from './kit.js';
import { frame, setRead, setVerdict, setHud, seg, slide, presets, txt, setScale, el } from './t13-ui.js';
import { simulate, rateCurve, CPA, CELLS, KF, M0 } from './t13-cryo-math.js';

const PH = { cool: 0.72, store: 0.78, thaw: 0.89, stain: 1 }; // частки шкали «момент досліду»

export class FreezeModel {
  constructor(host) {
    this.p = { mode: 'two', rate: 0.5, cpa: 'dmso10', cell: 'small', seed: true, pos: 0.42 };
    const F = frame(host, {
      aria: 'Програмний заморожувач і посудина Дьюара з рідким азотом; поле зору кріомікроскопа з рослинними клітинами, позаклітинним і внутрішньоклітинним льодом',
      reads: [['surv', 'Виживання після відтавання'], ['iif', 'Клітини з внутрішньоклітинним льодом'], ['sol', 'Пошкодження «ефектами розчину»'], ['wmin', 'Вода в клітині на −40 °C'], ['nuc', 'Лід утворився при'], ['dur', 'Тривалість програми до N₂']],
      panels: ['Програма охолодження', 'Кріопротектор і клітини', 'Момент досліду'],
      plots: [['prog', 'Температура зразка в часі'], ['vol', 'Вода в клітині: реальна й рівноважна'], ['rate', 'Виживання залежно від швидкості охолодження']],
      note: '<b>W</b> — частка осмотично активної води в клітині від вихідної; <b>рівноважна W</b> — скільки води лишилося б, якби клітина встигала віддавати її льоду. Чим далі реальна крива від рівноважної, тим сильніше переохолоджена цитоплазма і тим імовірніший <b>внутрішньоклітинний лід</b>. Барвник <b>синька Еванса</b> (0,25 %) фарбує в синій лише мертві клітини. Пояснення — у <a href="#t13-ice">теорії</a>; наближення моделі — у <a href="#t13-assume">примітці</a>.',
    });
    this.F = F;
    const [p1, p2, p3] = F.panels;
    this.modeSeg = seg(p1, 'Спосіб', [{ value: 'two', label: 'Програмне (2 етапи)' }, { value: 'direct', label: 'Пряме занурення в N₂' }], 'two', (v) => { this.p.mode = v; this.rateCtl.row.classList.toggle('is-disabled', v === 'direct'); this.update(); });
    this.sl = slide(p1, [{ id: 'cr-rate', label: 'Швидкість 1-го етапу (до −40 °C)', min: 0.05, max: 50, value: 0.5, log: true, unit: '°C/хв', format: (v) => fnum(v, v < 1 ? 2 : v < 10 ? 1 : 0), hint: 'посібник: 0,25–1,0 °C/хв; 2-й етап — 10 °C/хв до −60 °C' }], () => { this.p.rate = this.sl.values['cr-rate']; this.update(); });
    this.rateCtl = this.sl.inputs['cr-rate'];
    this.seedSeg = seg(p1, 'Ініціація кристалізації', [{ value: '1', label: 'так (біля −2…−4 °C)' }, { value: '0', label: 'ні (лід при −9 °C)' }], '1', (v) => { this.p.seed = v === '1'; this.update(); });
    this.cpaSeg = seg(p2, 'Кріопротектор', Object.entries(CPA).map(([k, c]) => ({ value: k, label: c.name.replace('без кріопротектора', 'без захисту') })), this.p.cpa, (v) => { this.p.cpa = v; this.update(); });
    this.cellSeg = seg(p2, 'Клітини', [{ value: 'small', label: 'дрібні, мала вакуоля' }, { value: 'large', label: 'великі, вакуолізовані' }], 'small', (v) => { this.p.cell = v; this.cells = null; this.update(); });
    this.pos = slide(p3, [{ id: 'cr-pos', label: 'Момент досліду (статичний кадр)', min: 0, max: 1, step: 0.005, value: this.p.pos, format: () => this.posLabel() }], () => { this.p.pos = this.pos.values['cr-pos']; this.anim.u = this.p.pos; this.draw(); });
    presets(p3, [
      ['За посібником', () => this.preset({ mode: 'two', rate: 0.5, cpa: 'dmso10', cell: 'small', seed: true })],
      ['20 °C/хв', () => this.preset({ mode: 'two', rate: 20, cpa: 'dmso10', cell: 'small', seed: true })],
      ['Без протектора', () => this.preset({ mode: 'two', rate: 1, cpa: 'none', cell: 'small', seed: true })],
    ]);
    this.plProg = new Plot(F.plots.prog, { xLabel: 't, хв', yLabel: 'T, °C', y: [-200, 10], yZero: false, xShort: 't', aspect: 1.35 });
    this.plVol = new Plot(F.plots.vol, { xLabel: 'T, °C', yLabel: 'W, частка', x: [-60, 0], y: [0, 1.05], xShort: 'T', aspect: 1.35 });
    this.plRate = new Plot(F.plots.rate, { xLabel: 'швидкість, °C/хв (лог. шкала)', yLabel: 'виживання, %', x: [-1.3, 2], y: [0, 100], xShort: 'lg v', aspect: 1.35, xFmt: (v) => fnum(Math.pow(10, v), v < -0.1 ? 2 : v < 0.9 ? 1 : 0) });
    this.anim = { u: this.p.pos };
    this.runner = new Runner({ btn: F.run, reset: F.reset, step: (dt, t, r) => this.step(dt, r), draw: () => this.draw() });
    F.status.textContent = 'Статичний кадр: момент у небезпечній зоні. «Запустити» — уся програма до відтавання.';
    onResize(F.canvas.parentElement, () => { this.iceTex = null; this.cells = null; this.draw(); });
    this.update();
  }

  preset(q) {
    Object.assign(this.p, q);
    this.modeSeg.select(q.mode); this.sl.set('cr-rate', q.rate, true); this.cpaSeg.select(q.cpa); this.cellSeg.select(q.cell); this.seedSeg.select(q.seed ? '1' : '0');
    this.rateCtl.row.classList.toggle('is-disabled', q.mode === 'direct'); this.cells = null; this.update();
  }

  posLabel() {
    const u = this.anim ? this.anim.u : this.p.pos;
    if (!this.sim) return '';
    if (u <= PH.cool) { const st = this.at(u); return `${fnum(st.T, 0)} °C`; }
    return u <= PH.store ? 'у рідкому N₂' : u <= PH.thaw ? 'відтавання' : 'синька Еванса';
  }

  update() {
    this.sim = simulate(this.p);
    this.curveNow = rateCurve({ ...this.p });
    this.curveNone = rateCurve({ ...this.p, cpa: 'none' });
    this.pos.inputs['cr-pos'].show();
    this.renderReads(); this.renderPlots(); this.draw();
  }

  /** Стан клітини в момент u шкали досліду (0…PH.cool — охолодження). */
  at(u) {
    const s = this.sim, tr = s.trace;
    const t = clamp(u / PH.cool, 0, 1) * s.tEnd;
    let i = 0; while (i < tr.length - 1 && tr[i + 1].t < t) i++;
    const a = tr[i], b = tr[Math.min(tr.length - 1, i + 1)], k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    return { t, T: lerp(a.T, b.T, k), W: lerp(a.W, b.W, k), Weq: lerp(a.Weq, b.Weq, k), dS: lerp(a.dS, b.dS, k), ice: b.ice && (a.ice || k > 0.5), p: lerp(a.p, b.p, k), piSalt: lerp(a.piSalt, b.piSalt, k) };
  }

  renderReads() {
    const s = this.sim, R = this.F.reads, c = CPA[this.p.cpa];
    const surv = s.surv * 100;
    setRead(R.surv, fnum(surv, 0) + ' %', surv > 60 ? 'ok' : surv < 30 ? 'bad' : '');
    setRead(R.iif, fnum(s.pIIF * 100, 0) + ' %', s.pIIF > 0.3 ? 'bad' : '');
    setRead(R.sol, fnum((1 - s.pSol) * 100, 0) + ' %', 1 - s.pSol > 0.3 ? 'bad' : '');
    const w40 = s.trace.find((r) => r.T <= -40) || s.trace[s.trace.length - 1];
    setRead(R.wmin, fnum(w40.W * 100, 0) + ' %');
    setRead(R.nuc, fnum(s.Tnuc, 1) + ' °C');
    const plunge = s.seg[s.seg.length - 1].t0;
    setRead(R.dur, plunge >= 60 ? `${Math.floor(plunge / 60)} год ${Math.round(plunge % 60)} хв` : `${fnum(plunge, plunge < 2 ? 1 : 0)} хв`);
    // вердикт
    const rateTxt = this.p.mode === 'direct' ? 'пряме занурення (≈ 180 °C/хв)' : `${fnum(this.p.rate, this.p.rate < 1 ? 2 : 1)} °C/хв до −40 °C`;
    let html = `<b>${c.name[0].toUpperCase() + c.name.slice(1)}, ${CELLS[this.p.cell].name} клітини, ${rateTxt}:</b> після відтавання живих ≈ ${fnum(surv, 0)} %. `;
    let kind = '';
    if (s.pIIF > 0.5) { kind = 'bad'; html += 'Охолодження надто швидке для цих клітин: вода не встигає вийти до позаклітинного льоду, цитоплазма переохолоджується, і в протопласті кристалізується лід, що механічно руйнує мембрани.'; }
    else if (1 - s.pSol > 0.5) { kind = 'bad'; html += `Охолодження надто повільне ${c.perm ? '' : 'і без проникного протектора'}: клітини довго перебувають серед концентрованого незамерзлого розчину солей — зневоднення, денатурація білків, ушкодження плазмалеми («ефекти розчину»).`; }
    else if (surv > 60) html += 'Компроміс знайдено: позаклітинний лід поступово зневоднює протопласт, внутрішньоклітинного льоду майже немає, а протектор знижує концентрацію солей. Так і працює двоетапна програма посібника.';
    else { kind = 'warn'; html += 'Обидва чинники пошкодження ще помітні — спробуйте змінити швидкість, протектор або ініціювати кристалізацію.'; }
    if (!this.p.seed && this.p.mode === 'two') html += ' Без ініціації кристалізації розчин переохолоджується до −9 °C, і клітини зустрічають лід уже переохолодженими.';
    if (c.tox > 0.1) html += ` Висока концентрація протектора сама токсична (−${fnum(c.tox * 100, 0)} %).`;
    setVerdict(this.F.verdict, html, kind);
  }

  renderPlots() {
    const s = this.sim, u = this.anim.u, cur = this.at(Math.min(u, PH.cool));
    const prog = s.trace.map((r) => [r.t, r.T]);
    this.plProg.setOptions({ x: [0, s.tEnd] });
    this.plProg.set([
      { data: prog, color: '#2B6CB0', width: 2.4, label: 'T зразка' },
      { data: [[cur.t, cur.T]], type: 'points', color: '#C7452E', label: 'зараз', r: 5 },
    ], [{ y: -40, color: '#8C6A10', label: '−40 °C' }, { y: -196, color: '#5B6B63', label: 'рідкий азот' }]);
    const tr = s.trace.filter((r) => r.T >= -60);
    this.plVol.set([
      { data: tr.map((r) => [r.T, Math.min(1, r.Weq)]), color: '#7DA7C9', width: 2, dash: [5, 4], label: 'рівноважна' },
      { data: tr.map((r) => [r.T, r.W]), color: '#1F5C3A', width: 2.6, label: 'реальна W' },
      cur.T >= -60 ? { data: [[cur.T, cur.W]], type: 'points', color: '#C7452E', label: 'зараз' } : null,
    ], [{ x: s.Tnuc, color: '#2B6CB0', label: 'лід', dash: [3, 3] }]);
    const lg = this.p.mode === 'direct' ? null : Math.log10(this.p.rate);
    this.plRate.set([
      { data: this.curveNone, color: '#C5CEC8', width: 1.6, label: 'без протектора' },
      { data: this.curveNow, color: '#1F5C3A', width: 2.6, fill: 'rgba(31,92,58,.10)', label: CPA[this.p.cpa].name },
      lg != null ? { data: [[lg, s.surv * 100]], type: 'points', color: '#C7452E', label: 'обраний режим' } : null,
    ], [{ x: Math.log10(0.25), color: '#8C6A10', dash: [3, 3] }, { x: 0, color: '#8C6A10', dash: [3, 3], label: 'посібник' }]);
  }

  step(dt, reset) {
    const a = this.anim;
    if (reset) { a.u = this.p.pos; a.running = false; this.F.status.textContent = 'Статичний кадр.'; this.renderPlots(); return; }
    if (!a.running) { a.running = true; a.u = 0; }
    a.u = Math.min(1, a.u + dt / 14);
    const st = this.at(a.u);
    this.F.status.textContent = a.u <= PH.cool ? `Охолодження: ${fnum(st.T, 1)} °C, t = ${fnum(st.t, st.t < 10 ? 1 : 0)} хв` : a.u <= PH.store ? 'Зберігання в рідкому азоті (−196 °C)' : a.u <= PH.thaw ? 'Швидке відтавання' : 'Забарвлення синькою Еванса: мертві клітини сині';
    this.fc = (this.fc || 0) + 1; if (this.fc % 3 === 0) this.renderPlots();
    if (a.u >= 1) { a.running = false; this.renderPlots(); this.F.status.textContent = 'Готово: порахуйте забарвлені (мертві) клітини.'; this.runner.finish(); }
  }

  /* ---------------- малювання ---------------- */
  draw() {
    const cv = this.F.canvas, narrow = cv.parentElement.clientWidth < 620;
    const { ctx, w, h } = fit(cv, { aspect: narrow ? 0.6 : 1.8, min: 320, max: narrow ? 960 : 560 });
    const DW = narrow ? 560 : 1000, S = w / DW, DH = h / S; this.S = S;
    setScale(S); ctx.save(); ctx.scale(S, S);
    const u = this.runner.started ? this.anim.u : this.p.pos;
    const st = this.at(Math.min(u, PH.cool));
    const hy = scene(ctx, DW, DH, { kind: 'bench', horizon: narrow ? 0.9 : 0.8, light: 0.25 });
    let fz, dw, field;
    if (narrow) {
      field = { cx: DW / 2, cy: DH * 0.31, r: Math.min(DW * 0.43, DH * 0.27) };
      fz = { x: 26, y: hy - DH * 0.24, w: DW * 0.5, h: DH * 0.24 };
      dw = { cx: DW * 0.8, by: hy, w: DW * 0.24, h: DH * 0.22 };
    } else {
      field = { cx: DW * 0.71, cy: DH * 0.455, r: Math.min(DH * 0.385, 215) };
      fz = { x: DW * 0.04, y: hy - DH * 0.42, w: DW * 0.26, h: DH * 0.42 };
      dw = { cx: DW * 0.38, by: hy, w: DW * 0.12, h: DH * 0.36 };
    }
    const T = u <= PH.cool ? st.T : u <= PH.store ? -196 : u <= PH.thaw ? lerp(-196, 20, smooth(PH.store, PH.thaw, u)) : 20;
    const inN2 = (u > PH.cool * 0.999 && u <= PH.store) || (u <= PH.cool && st.T <= -60);
    this.freezer(ctx, fz, T, st, u, inN2);
    this.dewar(ctx, dw, inN2, u);
    this.micro(ctx, field, st, u, T);
    ctx.restore();
    setHud(this.F.hud, ['кріомікроскоп', `T = ${fnum(T, 0)} °C`, u <= PH.cool ? (st.ice ? 'лід є' : 'без льоду') : u <= PH.store ? 'у N₂' : u <= PH.thaw ? 'відтавання' : 'синька Еванса']);
  }

  freezer(ctx, r, T, st, u, inN2) {
    const { x, y, w, h } = r;
    shadow(ctx, x + w / 2, y + h + 2, w * 0.62, 10, 0.35);
    // корпус з нержавійки
    let g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#9AA3A6'); g.addColorStop(0.18, '#E6EBEC'); g.addColorStop(0.5, '#C4CBCD'); g.addColorStop(0.82, '#E1E6E7'); g.addColorStop(1, '#8E979A');
    ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(60,70,72,.4)'; ctx.lineWidth = 1; ctx.stroke();
    // кришка
    g = ctx.createLinearGradient(0, y - h * 0.08, 0, y + h * 0.04); g.addColorStop(0, '#F3F6F6'); g.addColorStop(1, '#AEB6B9');
    ctx.fillStyle = g; roundRect(ctx, x - 4, y - h * 0.06, w + 8, h * 0.1, 6); ctx.fill();
    // камера з вікном
    const cx = x + w * 0.1, cy = y + h * 0.1, cw = w * 0.8, ch = h * 0.42;
    ctx.fillStyle = '#1B2328'; roundRect(ctx, cx, cy, cw, ch, 6); ctx.fill();
    const cold = smooth(0, -60, T);
    g = ctx.createLinearGradient(0, cy, 0, cy + ch); g.addColorStop(0, rgba(mix([40, 52, 58], [120, 160, 190], cold), 1)); g.addColorStop(1, rgba(mix([22, 30, 34], [70, 100, 130], cold), 1));
    ctx.fillStyle = g; roundRect(ctx, cx + 4, cy + 4, cw - 8, ch - 8, 4); ctx.fill();
    // кріопробірки (якщо не в азоті)
    if (!inN2) for (let i = 0; i < 4; i++) vial(ctx, cx + cw * (0.2 + i * 0.2), cy + ch * 0.86, Math.min(cw * 0.1, 14), ch * 0.55, cold, i);
    // іній на вікні
    if (cold > 0.2) { const R = rng(4); ctx.fillStyle = `rgba(235,245,255,${0.25 * cold})`; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(cx + 4 + R() * (cw - 8), cy + 4 + R() * (ch - 8), 0.6 + R() * 2.2, 0, TAU); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(cx + 6, cy + 6); ctx.lineTo(cx + cw * 0.35, cy + 6); ctx.lineTo(cx + 6, cy + ch * 0.6); ctx.closePath(); ctx.fill();
    // дисплей
    const dx = x + w * 0.1, dy = y + h * 0.6, dwid = w * 0.8, dh = h * 0.24;
    ctx.fillStyle = '#0E1714'; roundRect(ctx, dx, dy, dwid, dh, 4); ctx.fill();
    const Sc = this.S;
    txt(ctx, `${fnum(T, 1)} °C`, dx + dwid / 2, dy + dh * 0.38, { px: 15, align: 'center', base: 'middle', font: 'mono', weight: 700, color: '#8DF5A8', max: dwid * 0.9 });
    const stage = u > PH.cool ? 'програму завершено' : this.p.mode === 'direct' ? 'пряме занурення' : st.T > -40 ? `етап 1: −${fnum(this.p.rate, this.p.rate < 1 ? 2 : 1)} °C/хв` : st.T > -60 ? 'етап 2: −10 °C/хв' : 'занурення в N₂';
    txt(ctx, stage, dx + dwid / 2, dy + dh * 0.78, { px: 9.5, align: 'center', base: 'middle', font: 'mono', color: '#C6F7D2', max: dwid * 0.92 });
    txt(ctx, 'програмний заморожувач', x + w / 2, y + h + 16, { px: 10, align: 'center', color: '#33463B' });
    applyGrain(ctx, x, y, w, h, 0.04);
  }

  dewar(ctx, r, inN2, u) {
    const { cx, by, w, h } = r, x = cx - w / 2, y = by - h;
    shadow(ctx, cx, by + 2, w * 0.7, 8, 0.35);
    let g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#7E888B'); g.addColorStop(0.2, '#EEF2F3'); g.addColorStop(0.45, '#BFC7CA'); g.addColorStop(0.8, '#DCE2E3'); g.addColorStop(1, '#737D80');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + w * 0.08, y + h * 0.12); ctx.lineTo(x + w * 0.92, y + h * 0.12); ctx.quadraticCurveTo(x + w, y + h * 0.2, x + w, y + h * 0.3); ctx.lineTo(x + w, by - 8); ctx.quadraticCurveTo(x + w, by, x + w - 8, by); ctx.lineTo(x + 8, by); ctx.quadraticCurveTo(x, by, x, by - 8); ctx.lineTo(x, y + h * 0.3); ctx.quadraticCurveTo(x, y + h * 0.2, x + w * 0.08, y + h * 0.12); ctx.fill();
    // шийка
    g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#5B6467'); g.addColorStop(0.3, '#C9D0D2'); g.addColorStop(1, '#4F585B');
    ctx.fillStyle = g; roundRect(ctx, cx - w * 0.28, y + h * 0.02, w * 0.56, h * 0.12, 4); ctx.fill();
    ctx.fillStyle = '#20282B'; ctx.beginPath(); ctx.ellipse(cx, y + h * 0.03, w * 0.26, w * 0.06, 0, 0, TAU); ctx.fill();
    // етикетка
    ctx.fillStyle = '#F5F0D6'; roundRect(ctx, x + w * 0.18, y + h * 0.45, w * 0.64, h * 0.2, 3); ctx.fill();
    txt(ctx, 'N₂', cx, y + h * 0.55, { px: 12, align: 'center', base: 'middle', weight: 800, color: '#2B4C9B' });
    // пара
    const tt = performance.now() / 1000;
    const R = rng(7);
    for (let i = 0; i < 9; i++) {
      const ph = (R() + (this.runner.running ? tt * 0.25 : 0.3)) % 1, px = cx + (R() - 0.5) * w * 0.4 + Math.sin(ph * 6 + i) * 6, py = y - ph * h * 0.45, rr = w * (0.08 + ph * 0.2);
      const vg = ctx.createRadialGradient(px, py, 0, px, py, rr); vg.addColorStop(0, `rgba(245,250,255,${0.45 * (1 - ph)})`); vg.addColorStop(1, 'rgba(245,250,255,0)');
      ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    }
    if (inN2) { // штатив-«кейн» із кріопробірками занурено
      ctx.strokeStyle = '#9AA3A6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 4, y - h * 0.18); ctx.lineTo(cx + 4, y + h * 0.05); ctx.stroke();
      ctx.fillStyle = '#C7452E'; roundRect(ctx, cx - 4, y - h * 0.22, 16, 8, 2); ctx.fill();
    }
    txt(ctx, 'посудина Дьюара, −196 °C', cx, by + 16, { px: 10, align: 'center', color: '#33463B' });
  }

  ensureCells(f) {
    const key = `${f.r}|${this.p.cell}`;
    if (this.cells && this.cellKey === key) return;
    const R = rng(this.p.cell === 'small' ? 21 : 33), big = this.p.cell === 'large';
    const n = big ? 7 : 12, cells = [];
    const base = f.r * (big ? 0.24 : 0.17);
    let tries = 0;
    while (cells.length < n && tries++ < 4000) {
      const a = R() * TAU, d = Math.sqrt(R()) * f.r * 0.82, x = f.cx + Math.cos(a) * d, y = f.cy + Math.sin(a) * d;
      const rx = base * (0.85 + R() * 0.3), ry = rx * (0.7 + R() * 0.25), rot = R() * Math.PI;
      if (cells.some((c) => Math.hypot(c.x - x, c.y - y) < (c.rx + rx) * 0.98)) continue;
      cells.push({ x, y, rx, ry, rot, seed: Math.floor(R() * 1e6), u: 0 });
    }
    // «поріг» долі кожної клітини: ранжуємо, щоб частка мертвих відповідала моделі
    cells.forEach((c, i) => { c.u = (i + 0.5) / cells.length; });
    const R2 = rng(5); for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R2() * (i + 1)); [cells[i].u, cells[j].u] = [cells[j].u, cells[i].u]; }
    this.cells = cells; this.cellKey = key;
  }

  micro(ctx, f, st, u, T) {
    const s = this.sim, c = CPA[this.p.cpa], vac = CELLS[this.p.cell].vac;
    this.ensureCells(f);
    if (!this.iceTex || this.iceTex.r !== f.r) this.iceTex = iceTexture(f.r, this.S);
    // корпус окуляра
    ctx.save();
    const ring = ctx.createRadialGradient(f.cx, f.cy, f.r, f.cx, f.cy, f.r * 1.1); ring.addColorStop(0, '#0B0F0D'); ring.addColorStop(1, '#2A332E');
    ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(f.cx, f.cy, f.r * 1.09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(f.cx, f.cy, f.r, 0, TAU); ctx.clip();
    const cold = smooth(5, -40, T), stained = smooth(PH.thaw, 1, u);
    let g = ctx.createRadialGradient(f.cx - f.r * 0.2, f.cy - f.r * 0.25, f.r * 0.1, f.cx, f.cy, f.r);
    g.addColorStop(0, rgba(mix(mix([252, 249, 238], [236, 243, 248], cold), [222, 232, 248], stained * 0.6))); g.addColorStop(1, rgba(mix(mix([232, 226, 204], [205, 220, 232], cold), [196, 210, 236], stained * 0.6)));
    ctx.fillStyle = g; ctx.fillRect(f.cx - f.r, f.cy - f.r, 2 * f.r, 2 * f.r);
    // лід: росте від точок нуклеації, тане при відтаванні
    let iceK = 0;
    if (u <= PH.cool && st.ice) iceK = clamp((st.t - s.tIce) / Math.max(0.02 * s.tEnd, 0.3), 0, 1);
    else if (u > PH.cool) iceK = 1 - smooth(PH.store, PH.thaw - 0.03, u);
    const uf = u <= PH.cool && st.ice ? clamp((M0 + c.perm + c.np) / Math.max(1e-3, -st.T / KF), 0, 1) : 1;
    if (iceK > 0) {
      ctx.save(); ctx.beginPath();
      const seeds = [[-0.7, -0.5], [0.6, 0.65], [0.2, -0.85]];
      for (const [sx, sy] of seeds) ctx.arc(f.cx + sx * f.r, f.cy + sy * f.r, f.r * 2.1 * easeIce(iceK), 0, TAU);
      ctx.clip();
      ctx.drawImage(this.iceTex, f.cx - f.r, f.cy - f.r, 2 * f.r, 2 * f.r);
      ctx.restore();
    }
    // клітини
    const dead = 1 - s.surv;
    const W0 = s.W0;
    for (const cl of this.cells) {
      const W = u <= PH.cool ? st.W : u <= PH.store ? Math.min(st.W, 1) : lerp(this.at(PH.cool).W, cl.u < dead ? 0.6 : W0, smooth(PH.store, PH.thaw, u));
      const iif = u <= PH.cool ? (1 - st.p > cl.u ? 1 : 0) : (s.pIIF > cl.u ? 1 : 0);
      const isDead = cl.u < dead;
      // незамерзлий канал навколо клітини
      if (iceK > 0.9 && u <= PH.store) {
        const ch = 1.04 + 0.22 * uf;
        ctx.fillStyle = 'rgba(244,236,200,.85)'; ctx.beginPath(); ctx.ellipse(cl.x, cl.y, cl.rx * ch, cl.ry * ch, cl.rot, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(160,180,200,.6)'; ctx.lineWidth = 0.8; ctx.stroke();
      }
      cryoCell(ctx, cl, { shrink: Math.sqrt(0.28 + 0.72 * clamp(W, 0.04, 1)), iif, stain: isDead ? stained : 0, vac, frozenAll: u > PH.cool * 0.999 && u <= PH.store });
    }
    // віньєтка
    const v = ctx.createRadialGradient(f.cx, f.cy, f.r * 0.62, f.cx, f.cy, f.r);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.86, 'rgba(60,70,90,.18)'); v.addColorStop(1, 'rgba(0,0,0,.7)');
    ctx.fillStyle = v; ctx.fillRect(f.cx - f.r, f.cy - f.r, 2 * f.r, 2 * f.r);
    ctx.restore();
    applyGrain(ctx, f.cx - f.r, f.cy - f.r, 2 * f.r, 2 * f.r, 0.03);
    // масштаб
    const px = f.r * 0.32;
    ctx.fillStyle = '#1B2A20'; ctx.fillRect(f.cx + f.r * 0.2, f.cy + f.r * 0.8, px, 3);
    txt(ctx, '50 мкм', f.cx + f.r * 0.2 + px / 2, f.cy + f.r * 0.8 - 5, { px: 10, align: 'center', color: '#1B2A20', weight: 700 });
    // виноски
    const narrow = this.S && f.r < 200;
    if (iceK > 0.9 && u <= PH.cool) {
      const cl = this.cells.reduce((m, q) => (q.x > m.x ? q : m), this.cells[0]);
      txt(ctx, 'позаклітинний лід', f.cx - f.r * 0.15, f.cy - f.r * 0.92, { px: 10.5, align: 'center', color: '#173322', bg: 'rgba(255,255,255,.82)' });
      const icy = this.cells.find((q) => 1 - st.p > q.u);
      if (icy) txt(ctx, 'лід у протопласті', icy.x, icy.y + icy.ry + 14, { px: 10, align: 'center', color: '#7A1E12', bg: 'rgba(255,255,255,.85)' });
      else txt(ctx, st.W < 0.6 ? 'клітина зневоднюється' : 'незамерзлий розчин', cl.x - cl.rx * 0.2, cl.y + cl.ry + 14, { px: 10, align: 'center', color: '#173322', bg: 'rgba(255,255,255,.85)' });
    }
    if (u > PH.thaw) txt(ctx, `живі — безбарвні, мертві — сині (${fnum((1 - s.surv) * 100, 0)} %)`, f.cx, f.cy - f.r * 0.9, { px: 10.5, align: 'center', color: '#173322', bg: 'rgba(255,255,255,.85)' });
    txt(ctx, 'Кріомікроскоп, ×400', f.cx, f.cy + f.r * 1.09 + 15, { px: 11, align: 'center', weight: 700, color: '#1F3A2A' });
  }
}

const easeIce = (k) => 1 - Math.pow(1 - k, 2);

/** Рослинна клітина суспензійної культури в кріомікроскопі. */
function cryoCell(ctx, c, { shrink = 1, iif = 0, stain = 0, vac = 0.4, frozenAll = false }) {
  const R = rng(c.seed);
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
  // клітинна стінка (нерівний еліпс)
  const path = (k, j = 0) => { ctx.beginPath(); for (let i = 0; i <= 36; i++) { const a = i / 36 * TAU, n = 1 + 0.05 * (noise(Math.cos(a) * 1.6 + c.seed % 97, Math.sin(a) * 1.6, 3) - 0.5) * 2; const X = Math.cos(a) * c.rx * k * n, Y = Math.sin(a) * c.ry * k * n + j; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath(); };
  path(1); ctx.fillStyle = 'rgba(250,248,236,.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(130,115,75,.75)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.7; path(0.94); ctx.stroke();
  // протопласт
  const k = 0.9 * shrink;
  path(k);
  let base = [226, 232, 200];
  if (iif) base = [92, 96, 98];
  if (stain > 0) base = mix(base, [38, 72, 178], stain);
  const g = ctx.createRadialGradient(-c.rx * 0.3 * k, -c.ry * 0.35 * k, 1, 0, 0, c.rx * k);
  g.addColorStop(0, rgba(shade(base, 0.25), 0.9)); g.addColorStop(1, rgba(shade(base, -0.2), 0.95));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = iif ? 'rgba(40,40,40,.6)' : 'rgba(110,120,80,.55)'; ctx.lineWidth = 0.9; ctx.stroke();
  // вакуоля
  if (!iif) { ctx.save(); ctx.scale(Math.sqrt(vac) * 0.95, Math.sqrt(vac) * 0.9); path(k); ctx.fillStyle = stain > 0.3 ? `rgba(200,215,245,${0.35 + 0.3 * (1 - stain)})` : 'rgba(255,255,250,.55)'; ctx.fill(); ctx.restore(); }
  // пластиди й ядро
  for (let i = 0; i < 10; i++) { const a = R() * TAU, d = (0.55 + R() * 0.3) * k; ctx.fillStyle = iif ? 'rgba(30,30,30,.5)' : 'rgba(150,160,110,.75)'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * c.rx * d, Math.sin(a) * c.ry * d, 1.6, 1.1, a, 0, TAU); ctx.fill(); }
  const na = R() * TAU, nx = Math.cos(na) * c.rx * k * 0.55, ny = Math.sin(na) * c.ry * k * 0.5, nr = Math.min(c.rx, c.ry) * 0.2 * Math.max(0.7, shrink);
  const ng = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.3, 0.4, nx, ny, nr);
  const nc = stain > 0.3 ? [24, 44, 140] : iif ? [50, 50, 52] : [160, 150, 112];
  ng.addColorStop(0, rgba(shade(nc, 0.3))); ng.addColorStop(1, rgba(shade(nc, -0.25))); ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.fill();
  // кристалики внутрішньоклітинного льоду
  if (iif) {
    ctx.strokeStyle = 'rgba(230,240,250,.8)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 14; i++) { const a = R() * TAU, d = R() * 0.7 * k, x0 = Math.cos(a) * c.rx * d, y0 = Math.sin(a) * c.ry * d, l = 2 + R() * 4, b = R() * Math.PI; ctx.beginPath(); for (let j = 0; j < 3; j++) { const bb = b + j * Math.PI / 3; ctx.moveTo(x0 - Math.cos(bb) * l, y0 - Math.sin(bb) * l); ctx.lineTo(x0 + Math.cos(bb) * l, y0 + Math.sin(bb) * l); } ctx.stroke(); }
  }
  if (frozenAll && !iif) { path(k); ctx.fillStyle = 'rgba(200,220,240,.18)'; ctx.fill(); }
  ctx.restore();
}

/** Текстура позаклітинного льоду: зерна (полігони Вороного) і дендрити. Кешується. */
function iceTexture(r, S) {
  const sz = Math.ceil(2 * r * S), c = offscreen(sz, sz), x = c.getContext('2d');
  const R = rng(17), n = 34, pts = [];
  for (let i = 0; i < n; i++) pts.push([R() * sz, R() * sz, 0.85 + R() * 0.15]);
  const img = x.createImageData(sz, sz), d = img.data;
  for (let j = 0; j < sz; j += 1) for (let i = 0; i < sz; i += 1) {
    let b1 = 1e9, b2 = 1e9, k1 = 0;
    for (let q = 0; q < n; q++) { const dx = i - pts[q][0], dy = j - pts[q][1], dd = dx * dx + dy * dy; if (dd < b1) { b2 = b1; b1 = dd; k1 = q; } else if (dd < b2) b2 = dd; }
    const edge = Math.sqrt(b2) - Math.sqrt(b1), e = edge < 1.6 * S ? 1 - edge / (1.6 * S) : 0;
    const tone = pts[k1][2] + (fbm(i / (60 * S), j / (60 * S), 9, 3) - 0.5) * 0.12;
    const k = (j * sz + i) * 4;
    d[k] = 222 * tone - 40 * e; d[k + 1] = 234 * tone - 35 * e; d[k + 2] = 246 * tone - 25 * e; d[k + 3] = 235;
  }
  x.putImageData(img, 0, 0);
  // дендрити-«пір'я»
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineCap = 'round';
  for (let q = 0; q < n; q += 2) {
    const [px, py] = pts[q], a0 = R() * TAU;
    for (let br = 0; br < 3; br++) {
      const a = a0 + br * TAU / 3, L = (20 + R() * 30) * S;
      x.lineWidth = 1.2 * S; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke();
      x.lineWidth = 0.7 * S;
      for (let s = 0.25; s < 1; s += 0.18) { const bx = px + Math.cos(a) * L * s, by = py + Math.sin(a) * L * s, l = L * 0.25 * (1 - s); for (const sg of [-1, 1]) { x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(a + sg * Math.PI / 3) * l, by + Math.sin(a + sg * Math.PI / 3) * l); x.stroke(); } }
    }
  }
  c.r = r;
  return c;
}

function vial(ctx, cx, by, w, h, cold, i) {
  const x = cx - w / 2, y = by - h;
  ctx.fillStyle = 'rgba(235,240,245,.75)'; roundRect(ctx, x, y + h * 0.2, w, h * 0.8, w * 0.4); ctx.fill();
  ctx.fillStyle = rgba(mix([240, 236, 210], [225, 238, 250], cold), 0.95); roundRect(ctx, x + 1.5, y + h * 0.45, w - 3, h * 0.53, w * 0.35); ctx.fill();
  ctx.fillStyle = ['#C7452E', '#2B6CB0', '#D4A017', '#1F5C3A'][i % 4]; roundRect(ctx, x - 1, y, w + 2, h * 0.22, 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x + w * 0.22, y + h * 0.25, 1.5, h * 0.7);
  if (cold > 0.3) { ctx.fillStyle = `rgba(245,250,255,${0.5 * cold})`; roundRect(ctx, x, y + h * 0.2, w, h * 0.8, w * 0.4); ctx.fill(); }
}
