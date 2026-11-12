// Вкладка 5. Адаптація рослин-регенерантів ex vitro (с. 113–114, ЛР 33): вологість, загартування, виживання.
import { scene, microField, Runner, onResize, Plot, sliders, segmented, fnum, rng, clamp, smooth, lerp, MAT, TAU } from './kit.js';
import { adapt, openFrac, es } from './t08-math.js';
import { pot, bellJar, hygro, stomaView, shoot, pill, text } from './t08-draw.js';
import { stageFit, reads, verdict, presets, checkbox } from './t08-ui.js';

const DAYS = 30; // підживлення — через 20–30 діб після посадки (с. 114, 126)

export function init(root) {
  const $ = (id) => root.querySelector('#' + id);
  const cv = $('m5-cv');
  const fitStage = stageFit(cv, { desk: 16 / 8.6, mob: 0.78, min: 330, max: 500, mobMax: 560 });
  const st = { proto: 'cover', N: 10, RH: 70, T: 22, I: 5000, glycerol: false, roots: 'good', washed: true };
  let sim = adapt(st), alt = adapt({ ...st, proto: 'open', glycerol: false });
  const anim = { on: false, day: DAYS };

  const segP = segmented($('m5-proto'), 'm5p', [{ value: 'open', label: 'Одразу без укриття' }, { value: 'cover', label: 'Під банкою, відкривати поступово' }, { value: 'fog', label: 'Штучний туман' }], st.proto, (v) => { st.proto = v; toggle(); update(); });
  const segR = segmented($('m5-roots'), 'm5r', [{ value: 'good', label: 'Добре розвинені корені' }, { value: 'weak', label: 'Слабкі корені' }], st.roots, (v) => { st.roots = v; update(); });
  const sl = sliders($('m5-sliders'), [
    { id: 'N', label: 'Відкривати укриття протягом', min: 3, max: 20, step: 1, value: st.N, unit: 'діб', hint: 'перші 3 доби банку не піднімають' },
    { id: 'RH', label: 'Вологість повітря в теплиці', min: 35, max: 95, step: 1, value: st.RH, unit: '%', hint: 'рекомендовано 65–90 % (с. 114)' },
    { id: 'T', label: 'Температура', min: 16, max: 32, step: 0.5, value: st.T, unit: '°C', format: (v) => '+' + fnum(v, 1), hint: '+20–22 °C (с. 114), +22–25 °C (ЛР 33)' },
    { id: 'I', label: 'Освітленість', min: 1000, max: 12000, step: 500, value: st.I, unit: 'лк', hint: 'не більше 5000 лк (с. 114)' },
  ], () => { Object.assign(st, sl.values); update(); });
  const cbG = checkbox($('m5-opts'), 'Зрошувати листки 50 % гліцерином (с. 114)', st.glycerol, (v) => { st.glycerol = v; update(); });
  const cbW = checkbox($('m5-opts'), 'Корені відмито від агару', st.washed, (v) => { st.washed = v; update(); });
  function toggle() { sl.inputs.N.row.hidden = st.proto !== 'cover'; }
  const setAll = (o) => { Object.assign(st, o); segP.select(st.proto); segR.select(st.roots); cbG.checked = st.glycerol; cbW.checked = st.washed; for (const k of ['N', 'RH', 'T', 'I']) sl.set(k, st[k], true); toggle(); update(); };
  presets($('m5-presets'), [
    { label: 'ЛР 33: банка, 10 діб', apply: () => setAll({ proto: 'cover', N: 10, RH: 70, T: 22, I: 5000, glycerol: false, roots: 'good', washed: true }) },
    { label: 'Різко в сухе повітря', apply: () => setAll({ proto: 'open', RH: 50, glycerol: false }) },
    { label: 'Гліцерин без укриття', apply: () => setAll({ proto: 'open', RH: 60, glycerol: true }) },
    { label: 'Агар не відмито', apply: () => setAll({ proto: 'cover', washed: false, glycerol: false }) },
  ]);
  const p1 = new Plot($('m5-p1'), { xLabel: 'Доба після пересаджування', yLabel: 'RWC листків, %', x: [0, DAYS], y: [30, 100], xShort: 'доба', aspect: 1.55 });
  const p2 = new Plot($('m5-p2'), { xLabel: 'Доба після пересаджування', yLabel: 'Виживання, %', x: [0, DAYS], y: [0, 100], xShort: 'доба', aspect: 1.55 });

  const at = (arr, d) => arr[clamp(Math.round(d / 0.05), 0, arr.length - 1)];
  function update() {
    sim = adapt(st); alt = adapt({ ...st, proto: 'open', glycerol: false });
    if (!runner.running) runner.reset(); else draw();
    const pick = (a, k) => a.filter((_, i) => i % 5 === 0).map((e) => [e.t, e[k]]);
    p1.set([
      { data: pick(alt, 'rwc'), color: '#B23A2A', label: 'одразу без укриття', width: 2, dash: [5, 4] },
      { data: pick(sim, 'rwc'), color: '#2E7D5B', label: 'поточний варіант', width: 3 },
    ], [{ y: 82, label: 'поріг пошкодження', color: '#B7791F' }]);
    p2.set([
      { data: pick(alt, 'surv'), color: '#B23A2A', label: 'одразу без укриття', width: 2, dash: [5, 4] },
      { data: pick(sim, 'surv'), color: '#2E7D5B', label: 'поточний варіант', width: 3, fill: 'rgba(46,125,91,.1)' },
    ]);
    const end = sim[sim.length - 1];
    const minR = Math.min(...sim.map((e) => e.rwc));
    reads(root, {
      vpd0: `${fnum(es(st.T) * (1 - st.RH / 100), 2)} кПа`, rwc: `${fnum(minR, 0)} %`, g: fnum(end.g, 2), surv: `${fnum(end.surv, 0)} %`,
      hard: sim.find((e) => e.g < 0.35) ? `${Math.round(sim.find((e) => e.g < 0.35).t)}-та доба` : 'ще ні',
    });
    let lvl = 'ok', msg;
    if (end.surv < 50) { lvl = 'bad'; msg = `Приживлюється лише ≈ ${fnum(end.surv, 0)} % рослин. Листки пробіркових рослин мають продихи, що майже не закриваються, і тонку кутикулу, а корені ще без кореневих волосків — у сухому повітрі (дефіцит тиску пари ${fnum(es(st.T) * (1 - st.RH / 100), 2)} кПа) рослина за кілька годин втрачає воду швидше, ніж поглинає.`; }
    else if (end.surv < 85) { lvl = 'warn'; msg = `Приживлюється ≈ ${fnum(end.surv, 0)} %: найнебезпечніші перші 2–5 діб, коли оводненість листків падає до ${fnum(minR, 0)} %.`; }
    else { msg = `Приживлюється ≈ ${fnum(end.surv, 0)} % рослин. Висока вологість під укриттям дає час, щоб продихи навчилися закриватися, а нові корені — поглинати воду; укриття знімають поступово.`; }
    if (!st.washed) { lvl = lvl === 'ok' ? 'warn' : lvl; msg += ' Залишки агару на коренях — живильне середовище для грибів і бактерій: корені загнивають.'; }
    if (st.glycerol) msg += ' Плівка гліцерину на листках знижує випаровування — у посібнику цей прийом описано як спосіб обійтися без тривалого загартування.';
    if (st.I > 7000) msg += ' Надто яскраве світло посилює транспірацію: у теплиці для адаптації — не більше 5000 лк.';
    if (st.T > 27) msg += ' Спека прискорює випаровування й гальмує ріст — оптимум +20–25 °C.';
    msg += ' Через 20–30 діб укорінені рослини підживлюють розчинами МС або Кнудсона.';
    verdict($('m5-verdict'), msg, lvl);
  }

  function draw() {
    const F = fitStage(); if (!F) return;
    const { ctx, w, h, narrow } = F;
    const day = anim.on ? anim.day : 0;
    const e = at(sim, day);
    scene(ctx, w, h, { kind: 'bench', horizon: narrow ? 0.6 : 0.72, light: 0.45 });
    // теплиця: світло з вікна
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5); sky.addColorStop(0, `rgba(255,250,220,${0.15 + 0.3 * clamp(st.I / 10000, 0, 1)})`); sky.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.5);
    const wilt = clamp((92 - e.rwc) / 35, 0, 1);
    const dead = e.surv < 50 && day > 4 ? smooth(50, 10, e.surv) : 0;
    const cx = narrow ? w * 0.5 : w * 0.45, by = narrow ? h * 0.6 : h * 0.84;
    const pw = narrow ? Math.min(w * 0.36, 130) : Math.min(w * 0.17, 150), ph = pw * 0.82;
    // задній ряд горщиків (партія, частка вцілілих)
    const nBack = narrow ? 0 : 6;
    const pw2 = pw * (narrow ? 0.42 : 0.5);
    for (let i = 0; i < nBack; i++) {
      const bx = narrow ? w * (0.1 + 0.8 * i / (nBack - 1)) : w * (0.62 + 0.33 * i / (nBack - 1));
      const byy = narrow ? by - ph * 1.7 : by - ph * (i % 2 ? 0.55 : 1.05);
      const ttop = pot(ctx, bx, byy, pw2, pw2 * 0.8);
      const survives = (i + 0.5) / nBack * 100 < e.surv;
      const wl = survives ? wilt * 0.7 : 1;
      shoot(ctx, bx, ttop, { h: pw2 * (0.7 + 0.25 * smooth(0, DAYS, day)), nodes: 3, leafLen: pw2 * 0.3, leafW: 0.45, droop: wl, color: survives ? MAT.leaf : '#9C8F55', pale: survives ? 0 : 0.6, seed: 40 + i, sway: wl * 0.3 });
    }
    // головний горщик із рослиною
    const top = pot(ctx, cx, by, pw, ph);
    const grow = 0.75 + 0.35 * smooth(5, DAYS, day) * (e.rwc > 85 ? 1 : 0.4);
    shoot(ctx, cx, top, { h: pw * 0.95 * grow, nodes: 4, leafLen: pw * 0.36, leafW: 0.5, droop: Math.max(wilt, dead), color: dead > 0.5 ? '#A2945A' : MAT.leaf, pale: dead * 0.7, seed: 7, sway: wilt * 0.4, stemW: 2.6 });
    // укриття
    if (st.proto === 'cover') {
      const o = openFrac(day, st);
      if (o < 1) bellJar(ctx, cx, top + 2, pw * 1.12, pw * 1.35, { lift: o, fog: clamp((e.rh - 80) / 18, 0, 1) });
      else text(ctx, 'укриття знято', cx, top - pw * 1.2, { align: 'center', size: 11.5, weight: 700, color: '#2C4234' });
    }
    if (st.proto === 'fog' && e.rh > 85) { // туман
      const R = rng(9);
      for (let i = 0; i < 70; i++) { const fx = R() * w, fy = R() * h * 0.8, fr = 12 + R() * 30; const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr); g.addColorStop(0, `rgba(255,255,255,${0.16 * clamp((e.rh - 85) / 10, 0, 1)})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(fx - fr, fy - fr, 2 * fr, 2 * fr); }
    }
    // гігрометр
    const hx = narrow ? 12 : w * 0.04, hyy = narrow ? h * 0.66 : h * 0.18;
    hygro(ctx, hx, hyy, narrow ? 150 : 168, [`${st.T.toFixed(1).replace('.', ',')} °C`, `RH ${Math.round(e.rh)} %`, `VPD ${fnum(e.vpd, 2)} кПа`]);
    // продих
    const S = narrow ? { cx: w - Math.min(w * 0.22, 80) - 14, cy: h * 0.8, r: Math.min(w * 0.22, 80) } : { cx: w * 0.16, cy: h * 0.66, r: Math.min(h * 0.17, w * 0.085) };
    const aperture = clamp((e.g / (st.glycerol ? 0.4 : 1) - 0.15) / 0.85, 0.05, 1);
    microField(ctx, S.cx, S.cy, S.r, (c) => stomaView(c, S.cx, S.cy, S.r, { aperture, wax: clamp(1 - (e.g / (st.glycerol ? 0.4 : 1) - 0.25) / 0.75, 0, 1) }), { mode: 'bright' });
    text(ctx, aperture > 0.6 ? 'продих відкритий' : aperture > 0.3 ? 'продих прикритий' : 'продих закритий', S.cx, S.cy + S.r * 1.1 + 17, { align: 'center', size: 11.5, weight: 700, color: '#23382B' });
    // HUD
    pill(ctx, anim.on ? `Доба ${fnum(day, 1)} з ${DAYS}` : 'Доба 0: щойно пересаджено', 10, 10);
    pill(ctx, `оводненість листка ${fnum(e.rwc, 0)} % · вижило ${fnum(e.surv, 0)} %`, 10, 36, { dark: false, color: e.rwc < 75 ? '#9B2C1F' : '#173322' });
  }
  const runner = new Runner({
    btn: $('m5-run'), reset: $('m5-reset'), status: $('m5-status'),
    step: (dt, t, reset) => {
      if (reset) { anim.on = false; $('m5-status').textContent = ''; return; }
      anim.on = true; anim.day = Math.min(DAYS, t * 2.6);
      const e = at(sim, anim.day);
      $('m5-status').textContent = `Доба ${Math.round(anim.day)}: RH ${Math.round(e.rh)} %, оводненість ${fnum(e.rwc, 0)} %`;
      if (anim.day >= DAYS) runner.finish();
    },
    draw,
  });
  onResize(cv.parentElement, draw);
  toggle(); update();
  return { draw, runner };
}
