// Тема 4, вкладка В: соматичний ембріогенез у калюсі листків люцерни (ЛР 17, с. 83–85).
// Чашка Петрі з калюсом + поле зору стереомікроскопа з ембріоїдами на різних стадіях.
import { TAU, clamp, lerp, smooth, rng, fnum, rgba, fit, scene, petri, callus, plantlet, microField, tagSmall, roundRect, MAT, Runner, onResize, Plot, sample, sliders, setOut, $ } from './kit.js';
import { embryo, stageName, callusTexture } from './t04-draw.js';
import { SE, seFactors, seStage, sePopulation } from './t04-model.js';

const STAGES = [
  { key: 'g', name: 'глобулярна', color: '#C9AE4E', p: 0.6 },
  { key: 'h', name: 'серцеподібна', color: '#C98A3A', p: 1.55 },
  { key: 't', name: 'торпедоподібна', color: '#8FA83C', p: 2.55 },
  { key: 'c', name: "сім'ядольна", color: '#4E9A3A', p: 3.6 },
  { key: 'p', name: 'проросток', color: '#1F6B3A', p: 4.7 },
];
const STEP = (t) => (t < SE.t1 ? 0 : t < SE.t2 ? 1 : 2);
const MEDIA = [
  { name: 'I. Індукція', short: 'Уайт + 2 ІОК + 0,5 кін. + 100 г/л сахарози', light: '1000 лк, 14 год' },
  { name: 'II. Розвиток ембріоїдів', short: 'Уайт + глутамін + НОК + сахароза', light: '1000 лк, 16 год' },
  { name: 'III. Проростання', short: 'МС + 2 кін. + 500 мг/л гідролізату казеїну', light: '2000 лк, 14 год' },
];
// той самий набір «віртуальних» ембріоїдів, що й у sePopulation
const U = (i) => ((i * 0.6180339887) % 1), TAU0 = (i) => 3 + 16 * ((i * 0.7548776662) % 1);

export function initC() {
  const cv = $('t4c-scene'); if (!cv) return null;
  const S = { naa: 0.1, gln: 800, suc: 60, passage: 1, day: 35 };
  let F = seFactors(S);
  const sl = sliders($('t4c-ctrl'), [
    { id: 't4c-naa', label: 'НОК у середовищі II', min: 0, max: 2, step: 0.05, value: S.naa, unit: 'мг/л', hint: 'НОК — α-нафтилоцтова кислота (ауксин). За посібником 0,1 мг/л.' },
    { id: 't4c-gln', label: 'Глутамін у середовищі II', min: 0, max: 1600, step: 50, value: S.gln, unit: 'мг/л', hint: 'Джерело відновленого азоту; за посібником 800 мг/л.' },
    { id: 't4c-suc', label: 'Сахароза в середовищі II', min: 20, max: 120, step: 5, value: S.suc, unit: 'г/л', hint: 'За посібником 60 г/л (на етапі I — 100 г/л).' },
    { id: 't4c-pas', label: 'Пасаж калюсу', min: 1, max: 10, step: 1, value: S.passage, unit: '' },
    { id: 't4c-day', label: 'Доба від посадки', min: 0, max: SE.t3, step: 1, value: S.day, unit: 'доба' },
  ], (id) => {
    const v = sl.values; S.naa = v['t4c-naa']; S.gln = v['t4c-gln']; S.suc = v['t4c-suc']; S.passage = v['t4c-pas']; S.day = v['t4c-day'];
    if (id !== 't4c-day') { F = seFactors(S); document.querySelectorAll('#t4c-presets [data-preset]').forEach((x) => x.setAttribute('aria-pressed', 'false')); }
    update();
  });
  const PRE = { book: { naa: 0.1, gln: 800, suc: 60, passage: 1 }, aux: { naa: 1, gln: 800, suc: 60, passage: 1 }, noN: { naa: 0.1, gln: 0, suc: 60, passage: 1 }, old: { naa: 0.1, gln: 800, suc: 60, passage: 8 } };
  document.querySelectorAll('#t4c-presets [data-preset]').forEach((b) => b.addEventListener('click', () => {
    const p = PRE[b.dataset.preset];
    sl.set('t4c-naa', p.naa, true); sl.set('t4c-gln', p.gln, true); sl.set('t4c-suc', p.suc, true); sl.set('t4c-pas', p.passage, true);
    Object.assign(S, p); F = seFactors(S);
    document.querySelectorAll('#t4c-presets [data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    update();
  }));
  // мініатюри стадій
  const icons = document.querySelectorAll('#t4c-stages canvas');
  function drawIcons() {
    icons.forEach((c, i) => {
      const w = c.clientWidth || 44, dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = w * dpr; c.height = w * dpr; const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = x.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w * 0.7); g.addColorStop(0, '#2A2B22'); g.addColorStop(1, '#0E0F0B');
      x.fillStyle = g; x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, TAU); x.fill();
      const p = STAGES[i].p, sc = w * (0.2 - Math.min(p, 4.5) * 0.024);
      embryo(x, w / 2, w * (0.52 + (p > 4 ? -0.06 : 0)), sc, p, { seed: i, light: 1 });
    });
  }

  const p1 = new Plot($('t4c-p1'), { xLabel: 'доба від посадки калюсу', yLabel: 'частка ембріоїдів, %', x: [0, SE.t3], y: [0, 100], xShort: 'доба', aspect: 1.7 });
  const p2 = new Plot($('t4c-p2'), { xLabel: 'НОК у середовищі II, мг/л', yLabel: 'рослин на калюс (70 доба)', x: [0, 1], y: 'auto', xShort: 'НОК', aspect: 1.7 });

  const runner = new Runner({
    btn: $('t4c-run'), reset: $('t4c-reset'), status: $('t4c-status'),
    step: (dt, t, reset) => {
      if (reset) { S.day = 0; sl.set('t4c-day', 0, true); reads(); plots(); return; }
      S.day = Math.min(SE.t3, S.day + dt * 4.5); if (S.day >= SE.t3) runner.finish();
      sl.set('t4c-day', Math.round(S.day), true);
      if (Math.floor(S.day) !== last) { last = Math.floor(S.day); reads(); plots(); }
    },
    draw: () => draw(),
  });
  let last = -1;
  const origPlay = runner.play.bind(runner);
  runner.play = () => { if (!runner.started || S.day >= SE.t3 - 0.5) { S.day = 0; sl.set('t4c-day', 0, true); } origPlay(); };

  function embryosNow() {
    const nShow = Math.max(2, Math.round(10 * F.pot));
    const out = [];
    const R = rng(311);
    for (let i = 0; i < 10; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 0.6, ang = (R() - 0.5) * 1.6 + (R() > 0.5 ? Math.PI : 0) * 0.15;
      if (i >= nShow) continue;
      const p = seStage(S.day, TAU0(i * 17 + 3), U(i * 17 + 3), F);
      out.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9, p, ang, i });
    }
    return out.sort((a, b) => a.y - b.y);
  }
  function draw() {
    const W = cv.parentElement.clientWidth; if (!W) return;
    const phone = W < 620;
    const { ctx, w, h } = fit(cv, { aspect: phone ? 0.78 : 1.85, min: 330, max: 520 });
    const step = STEP(S.day), light = step === 2 ? 1 : 0.55;
    const hy = scene(ctx, w, h, { kind: 'bench', horizon: phone ? 0.36 : 0.62, light: 0.25 });
    // чашка Петрі з калюсом
    const pr = phone ? Math.min(w * 0.2, h * 0.12) : Math.min(w * 0.17, h * 0.32);
    const pcx = phone ? w * 0.26 : w * 0.2, pcy = phone ? h * 0.2 : hy + (h - hy) * 0.2;
    const emb = embryosNow();
    petri(ctx, pcx, pcy, pr, {
      medium: { color: step === 2 ? MAT.agarMS : '#EEE8C9' },
      contents: (c, P) => {
        const R = rng(5);
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * TAU + 0.4, x = P.cx + Math.cos(a) * P.rx * 0.5, y = P.cy + Math.sin(a) * P.ry * 0.5;
          callus(c, x, y + 3, pr * 0.16 * (0.85 + R() * 0.3) * (0.7 + 0.3 * smooth(0, 40, S.day)), { color: '#EFE3B6', friable: 0.7, seed: 20 + i, green: step === 2 ? 0.15 : 0, n: 12 });
          if (step === 2) for (let j = 0; j < 3; j++) { const pl = clamp((S.day - SE.t2) / 21, 0, 1); if (pl > 0.15) plantlet(c, x + (j - 1) * pr * 0.07, y - pr * 0.05, { height: pr * 0.3 * pl, nodes: 2, leafLen: pr * 0.08, roots: { n: 0, len: 0 }, seed: i * 3 + j }); }
        }
      },
    });
    if (phone) tagSmall(ctx, pcx + pr + 10, pcy + 4, 'Калюс люцерни', { bg: 'rgba(255,255,255,.85)', size: 11, align: 'left' });
    else tagSmall(ctx, pcx, pcy + pr * 0.42 + pr * 0.16 + 18, 'Калюс люцерни', { bg: 'rgba(255,255,255,.85)', size: 11 });
    // поле зору стереомікроскопа
    const mr = phone ? Math.min(w * 0.42, h * 0.33) : Math.min(h * 0.44, w * 0.25);
    const mcx = phone ? w * 0.5 : w * 0.66, mcy = phone ? h * 0.63 : h * 0.47;
    // промінь від чашки до поля зору
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.13)';
    const ax = pcx + pr * 0.4, ay = pcy - pr * 0.1, ang = Math.atan2(mcy - ay, mcx - ax) + Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mcx + Math.cos(ang) * mr, mcy + Math.sin(ang) * mr); ctx.lineTo(mcx - Math.cos(ang) * mr, mcy - Math.sin(ang) * mr); ctx.closePath(); ctx.fill(); ctx.restore();
    microField(ctx, mcx, mcy, mr, (c, f) => {
      const tex = callusTexture(Math.round(f.r * 2), 9 + S.passage, step === 2 ? '#BDB27A' : '#C2AE76', 0.5);
      c.globalAlpha = 0.92; c.drawImage(tex, f.cx - f.r, f.cy - f.r, f.r * 2, f.r * 2); c.globalAlpha = 1;
      // старий калюс буріє
      if (S.passage > 3) { c.fillStyle = `rgba(110,72,28,${clamp((S.passage - 3) / 10, 0, 0.4)})`; c.fillRect(f.cx - f.r, f.cy - f.r, f.r * 2, f.r * 2); }
      for (const e of emb) {
        if (e.p < 0) continue;
        const sc = f.r * 0.03 * Math.exp(0.4 * Math.min(e.p, 4));  // ≈ 0,2 мм (глобула) … 3 мм (сім'ядольний)
        embryo(c, f.cx + e.x * f.r, f.cy + e.y * f.r, sc, e.p, { ang: e.ang, seed: e.i, light });
      }
    }, { mode: 'dark', scale: { px: mr * 0.25, text: '1 мм' } });
    // підпис етапу
    const M = MEDIA[step];
    const lx = phone ? w * 0.5 : w * 0.06, ly = phone ? h * 0.07 : h * 0.1;
    ctx.save(); ctx.font = `800 ${phone ? 12 : 13}px system-ui, sans-serif`; ctx.textAlign = phone ? 'left' : 'left';
    const lines = [M.name, M.light];
    const mw = Math.max(...lines.map((t) => ctx.measureText(t).width));
    ctx.fillStyle = 'rgba(255,255,255,.88)'; roundRect(ctx, lx - 8, ly - 16, mw + 16, 40, 9); ctx.fill();
    ctx.fillStyle = '#173322'; ctx.fillText(lines[0], lx, ly);
    ctx.font = `600 ${phone ? 10.5 : 11}px system-ui, sans-serif`; ctx.fillStyle = '#46584C'; ctx.fillText(lines[1], lx, ly + 16);
    ctx.restore();
    $('t4c-hud').innerHTML = `<span>Доба ${Math.round(S.day)}</span><span>Етап ${['I', 'II', 'III'][step]}</span>`;
  }
  function reads() {
    const pop = sePopulation(S.day, F), init = 1 - pop[5];
    const end2 = sePopulation(SE.t2 - 0.01, F), end3 = sePopulation(SE.t3, F);
    const nTot = SE.nMax * F.pot;
    let dom = 0; for (let i = 1; i < 5; i++) if (pop[i] > pop[dom]) dom = i;
    setOut($('t4c-reads'), {
      step: ['I · індукція', 'II · розвиток', 'III · проростання'][STEP(S.day)],
      dom: init > 0.05 ? STAGES[dom].name : 'ініціація',
      n: `${fnum(nTot, 0)}`,
      cot: `${fnum((end2[3] + end2[4]) * 100, 0)} %`,
      pl: `${fnum(nTot * end3[4], 0)}`,
    });
    document.querySelectorAll('#t4c-stages li').forEach((li, i) => {
      const v = init > 0 ? pop[i] / Math.max(1e-9, init) : 0;
      li.querySelector('b').textContent = `${fnum(v * 100, 0)} %`;
      li.style.setProperty('--v', `${(v * 100).toFixed(1)}%`);
      li.classList.toggle('is-on', i === dom && init > 0.05);
    });
    const v = $('t4c-verdict');
    let txt, cls = '';
    if (F.fAux < 0.3) { txt = `<b>Ембріоїди «застрягли» на глобулярній стадії.</b> НОК ${fnum(S.naa, 2)} мг/л — надто багато ауксину: він підтримує дедиференціацію, і перехід до серцеподібної стадії гальмується (у моделі швидкість × ${fnum(F.fAux, 2)}). Розвиток зародків починається лише після видалення дедиференціюючого фактора (с. 80).`; cls = 'is-bad'; }
    else if (F.pot < 0.4) { txt = `<b>Старий калюс.</b> Пасаж ${S.passage}: морфогенний потенціал знизився до ${fnum(F.pot * 100, 0)} %, ембріоїдів мало — для ЛР 17 беруть калюс перших пасажів з молодих тканин (с. 83).`; cls = 'is-warn'; }
    else if (F.fN < 0.6) { txt = `<b>Розвиток сповільнений.</b> Без глутаміну бракує відновленого азоту (с. 79–80: амонійний азот потрібен для початку морфогенезу), тож до кінця етапу II сім'ядольної стадії досягає лише ${fnum((end2[3] + end2[4]) * 100, 0)} % ембріоїдів.`; cls = 'is-warn'; }
    else txt = `<b>Нормальний хід ембріогенезу.</b> Після етапу I (проембріогенна маса, глобули) на середовищі II ембріоїди проходять серцеподібну й торпедоподібну стадії; до 49-ї доби сім'ядольних — ${fnum((end2[3] + end2[4]) * 100, 0)} %. На середовищі III з кінетином вони проростають у рослини-регенеранти: ≈ ${fnum(nTot * end3[4], 0)} на калюс.`;
    if (F.fSuc < 0.6) txt += ` Сахароза ${fnum(S.suc, 0)} г/л далека від оптимуму (60 г/л) — швидкість розвитку × ${fnum(F.fSuc, 2)}.`;
    v.className = 'ag-verdict ' + cls; v.innerHTML = txt;
  }
  function plots() {
    const ser = STAGES.map(() => []);
    for (let t = 0; t <= SE.t3; t += 1) { const pop = sePopulation(t, F, 160); for (let i = 0; i < 5; i++) ser[i].push([t, pop[i] * 100]); }
    p1.set(STAGES.map((s, i) => ({ data: ser[i], color: s.color, label: s.name, width: 2.2 })), [
      { x: SE.t1, label: 'II', color: '#7A8A80', dash: [3, 4] }, { x: SE.t2, label: 'III', color: '#7A8A80', dash: [3, 4] }, { x: S.day, color: '#8C6A10' },
    ]);
    const yieldAt = (naa) => { const FF = seFactors({ ...S, naa }); return SE.nMax * FF.pot * sePopulation(SE.t3, FF, 120)[4]; };
    p2.set([{ data: sample(yieldAt, 0, 1, 80), color: '#3E8F3A', label: 'рослин-регенерантів', fill: 'rgba(62,143,58,.08)', marker: S.naa <= 1 ? [S.naa, yieldAt(S.naa)] : undefined }], [{ x: 0.1, label: '0,1 (посібник)', color: '#7A8A80' }]);
  }
  function update() { draw(); reads(); plots(); }
  onResize(cv.parentElement, () => { draw(); drawIcons(); });
  update(); drawIcons();
  return { runner, redraw: () => { draw(); drawIcons(); } };
}
