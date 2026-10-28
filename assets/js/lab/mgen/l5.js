// Частина 5. Позиційний контроль розвитку: інтерактивні блоки.
import { register, el, svg, options, stepper, clamp, lerp, rnd, $, $$, loop } from './util.js';
import { sliders } from '../ui.js';

const L5 = 'var(--l5)';
const tgl = (label, on, f) => { const b = el('button', { type: 'button', class: 'mg-opt', 'aria-pressed': String(on) }, label); b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); f(v); }); return b; };
const hot = (root, sel, f) => $$(sel, root).forEach((g) => { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.addEventListener('click', () => f(g)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(g); } }); });

// ------------------------------------------------------------------ «французький прапор»
register('flag', (root) => {
  const ctl = el('div', { class: 'mg-ctrls' });
  const sl = el('div');
  const S = sliders(sl, [
    { id: 'lam', label: 'Дальність дифузії морфогену (λ)', min: 3, max: 20, step: 0.5, value: 9, digits: 1, hint: 'Чим довше живе й далі дифундує морфоген, тим пологіший градієнт.' },
    { id: 'th', label: 'Чутливість клітин (пороги)', min: 0.5, max: 2, step: 0.05, value: 1, digits: 2, hint: 'Регулюючи чутливість до одного й того ж морфогену, з ряду клітин роблять кілька зон.' },
  ], draw);
  const side = el('div', { class: 'mg-opts', style: 'align-self:end' });
  let zones = 3, two = false;
  options(side, [{ v: 2, t: '2 зони' }, { v: 3, t: '3 зони (прапор)' }, { v: 5, t: '5 зон (пальці)' }], 3, (v) => { zones = +v; draw(); });
  const t2 = tgl('Друге джерело праворуч (пересадка ZPA)', false, (v) => { two = v; draw(); });
  ctl.append(sl, el('div', null, side, t2));
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Градієнт морфогену і пороги: модель французького прапора' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const COL = ['#E53935', '#FFB300', '#FAFAFA', '#64B5F6', '#1E88E5'];
  const PAL = { 2: ['#E53935', '#1E88E5'], 3: ['#E53935', '#F5F5F5', '#1E88E5'], 5: ['#E53935', '#FB8C00', '#FDD835', '#66BB6A', '#1E88E5'] };
  function conc(x, N, lam) { const c1 = Math.exp(-x / lam); return two ? Math.max(c1, Math.exp(-(N - 1 - x) / lam)) : c1; }
  function draw() {
    const lam = S.values.lam, th = S.values.th, N = 30;
    const pal = PAL[zones];
    // пороги: у логарифмічному просторі рівномірно між 0.8 і 0.06, зсув чутливістю
    const T = []; for (let k = 1; k < zones; k++) T.push(Math.exp(lerp(Math.log(0.75), Math.log(0.06), (k - 0.5) / (zones - 1))) * th);
    let h = '<rect width="640" height="300" rx="14" fill="#FBFDFB"/>';
    // графік
    h += '<g transform="translate(40 20)"><path d="M0 0 V130 H560" stroke="#7A8A7E" fill="none"/><text x="-6" y="8" text-anchor="end" class="mg-ts">C</text><text x="560" y="148" text-anchor="end" class="mg-ts">положення клітини</text>';
    const pts = Array.from({ length: 121 }, (_, i) => { const x = i / 120 * (N - 1); return `${i / 120 * 560},${130 - Math.min(1, conc(x, N, lam)) * 120}`; }).join(' ');
    h += `<polyline points="${pts}" fill="none" stroke="#7B3FA0" stroke-width="3"/>`;
    T.forEach((t, i) => { const y = 130 - clamp(t, 0, 1) * 120; h += `<path d="M0 ${y} H560" stroke="#C2415C" stroke-dasharray="5 4"/><text x="564" y="${y + 4}" class="mg-ts" style="fill:#C2415C">T${i + 1}</text>`; });
    h += '</g>';
    // клітини
    const w = 560 / N; let cnt = 0; const zoneCount = new Array(zones).fill(0);
    for (let i = 0; i < N; i++) {
      const c = conc(i, N, lam); let z = 0; while (z < T.length && c < T[z]) z++;
      zoneCount[z]++;
      h += `<rect x="${40 + i * w + 1}" y="190" width="${w - 2}" height="44" rx="7" fill="${pal[z]}" stroke="#9AA79D"/><circle cx="${40 + i * w + w / 2}" cy="212" r="3.5" fill="#F7E9A8" stroke="#B9A94A"/>`;
    }
    h += `<g><path d="M40 252 L40 240" stroke="#7B3FA0" stroke-width="3"/><circle cx="40" cy="262" r="10" fill="#7B3FA0"/><text x="56" y="266" class="mg-t" style="font-weight:700">джерело морфогену</text></g>`;
    if (two) h += `<g><circle cx="600" cy="262" r="10" fill="#7B3FA0"/><text x="584" y="266" text-anchor="end" class="mg-t" style="font-weight:700">друге джерело</text></g>`;
    sv.innerHTML = h;
    const mirror = two ? ' Пересадка другого джерела дає <b>дзеркальний</b> набір зон — як подвоєння пальців у курячого крила.' : '';
    info.innerHTML = `<p><b>Клітини зчитують концентрацію морфогену:</b> вище порога T₁ → «червоний», нижче останнього порога → «синій»; ${zones} зон${zones === 5 ? ' (так задається «номер» пальця — ретиноєва кислота)' : ''}. Зони: ${zoneCount.join(' / ')} клітин.${mirror}</p>`;
  }
  root.append(ctl, sv, info);
  draw();
});

// ------------------------------------------------------------------ дозрівання CLE-пептиду
register('cle-steps', (root) => {
  const ST = [
    ['Пре-пропептид', 'Ген CLE кодує <b>пре-пропептид</b>: сигнальна послідовність + пропептид + ділянка зрілого пептиду. В арабідопсису понад 30 CLE-генів.'],
    ['ЕПР: відщеплення сигнальної послідовності', 'Синтез іде в просвіт ендоплазматичного ретикулума; сигнальний пептид відщеплюється.'],
    ['Модифікації', 'Гідроксилювання проліну, глікозилювання пропептиду. Порушення будь-якого етапу → збій сигналу (мутації).'],
    ['Протеоліз і секреція', 'Протеази вкорочують пропептид до зрілого короткого пептиду; він секретується в апопласт.'],
    ['Зв\'язування з LRR-рецептором', 'Екстрацелюлярний LRR-домен рецепторної кінази (CLV1, TDR/PXY…) зв\'язує CLE (у димерній формі), <b>необоротно</b> — після зв\'язування рецептор деградує.'],
    ['Градієнт, як на афінній колонці', 'Пептиди «розсідаються» на рецепторах — концентрація падає з відстанню від джерела: це і є позиційний сигнал.'],
  ];
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 220', role: 'img', 'aria-label': 'Дозрівання CLE-пептиду і зв\'язування з LRR-рецептором' });
  const cap = el('div', { class: 'mg-info', 'aria-live': 'polite' }); const bar = el('div');
  function scene(i) {
    let h = '<rect width="640" height="220" rx="14" fill="#FBFDFB"/>';
    const bead = (x, y, c, t, w = 70) => `<rect x="${x}" y="${y}" width="${w}" height="26" rx="13" fill="${c}"/><text x="${x + w / 2}" y="${y + 17}" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">${t}</text>`;
    if (i === 0) h += bead(60, 90, '#9AA79D', 'сигнал') + bead(134, 90, '#7B3FA0', 'пропептид', 120) + bead(258, 90, '#C2415C', 'CLE', 70) + '<text x="320" y="150" text-anchor="middle" class="mg-t">пре-пропептид</text>';
    if (i === 1) h += '<rect x="30" y="40" width="580" height="130" rx="16" fill="#EFE6FB" stroke="#7B3FA0" stroke-width="2"/><text x="320" y="34" text-anchor="middle" class="mg-ts">просвіт ЕПР</text>' + bead(220, 90, '#7B3FA0', 'пропептид', 110) + bead(334, 90, '#C2415C', 'CLE', 70) + '<g opacity=".5"><rect x="130" y="60" width="64" height="26" rx="13" fill="#9AA79D"/><text x="162" y="77" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">сигнал ✂</text></g>';
    if (i === 2) h += bead(170, 90, '#7B3FA0', 'пропептид', 110) + bead(284, 90, '#C2415C', 'CLE', 70) + '<circle cx="204" cy="76" r="8" fill="#E9A825"/><text x="204" y="62" text-anchor="middle" class="mg-ts">OH</text><circle cx="316" cy="76" r="8" fill="#2E7D32"/><text x="316" y="62" text-anchor="middle" class="mg-ts">глікан</text>';
    if (i === 3) h += bead(200, 90, '#C2415C', 'зрілий CLE', 90) + '<path d="M300 104 H420" stroke="#46584C" stroke-width="2.5" marker-end="url(#mg-arr)"/><text x="360" y="92" text-anchor="middle" class="mg-ts">секреція в апопласт</text><text x="200" y="150" class="mg-ts">протеази ✂ пропептид</text>';
    if (i >= 4) { h += '<rect x="40" y="160" width="560" height="14" rx="7" fill="#7FB8CF"/><text x="320" y="196" text-anchor="middle" class="mg-ts">плазмалема</text>'; for (let k = 0; k < 5; k++) { const x = 90 + k * 110; h += `<g><rect x="${x}" y="112" width="26" height="48" rx="8" fill="#1565C0"/><text x="${x + 13}" y="140" text-anchor="middle" style="font:800 8px system-ui;fill:#fff" transform="rotate(-90 ${x + 13} 136)">LRR</text>${i === 4 || k < 3 ? `<circle cx="${x + 13}" cy="${100 - (i === 4 ? 0 : k * 4)}" r="7" fill="#C2415C"/>` : ''}</g>`; } }
    if (i === 5) h += '<defs><linearGradient id="clg" x1="0" x2="1"><stop offset="0" stop-color="#C2415C"/><stop offset="1" stop-color="#C2415C" stop-opacity=".05"/></linearGradient></defs><rect x="60" y="48" width="520" height="22" rx="11" fill="url(#clg)"/><text x="70" y="42" class="mg-ts">джерело</text><text x="570" y="42" text-anchor="end" class="mg-ts">концентрація CLE падає з відстанню</text>';
    sv.innerHTML = h;
    cap.innerHTML = `<h4>Крок ${i + 1}. ${ST[i][0]}</h4><p>${ST[i][1]}</p>`;
  }
  root.append(bar, sv, cap);
  stepper(bar, ST.length, scene, { lc: L5 });
});

// ------------------------------------------------------------------ TDIF: флоема – прокамбій – ксилема
register('tdif', (root) => {
  const M = {
    wt: ['Дикий тип', 'TDIF (CLE-пептид, що гальмує диференціювання ксилеми) виділяється з флоеми. Багато TDIF → <b>флоема</b>; середня доза → <b>прокамбій → камбій</b>; підпорогова (мало TDIF) → <b>ксилема</b>. Рецептор — TDR/PXY. Сигнал іде на <b>WOX4</b> (прокамбій), який має позитивний зворотний зв\'язок і запускає поділ → камбій.'],
    pxy: ['pxy / tdr (немає рецептора)', 'Клітини не відчувають рівня сигналу: судини перервані, зони флоеми, прокамбію й ксилеми перемішані.'],
    ox: ['35S::TDIF (посилення сигналу)', 'TDIF скрізь: уся система зсувається від флоемного полюса — ксилема витісняється, прокамбій і «флоемні» ідентичності розростаються.'],
    irx: ['IRX3::TDIF (інверсія сигналу)', 'TDIF виробляють самі клітини ксилеми (промотор целюлозосинтази IRX3 вмикається при диференціюванні ксилеми) — диференціювання ксилеми гальмується: «ксилема тане, як цукор».'],
  };
  let mode = 'wt';
  const row = el('div', { class: 'mg-opts' });
  options(row, Object.entries(M).map(([v, m]) => ({ v, t: m[0] })), 'wt', (v) => { mode = v; draw(); });
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 270', role: 'img', 'aria-label': 'Судинний пучок як французький прапор TDIF' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const N = 26;
  function cType(i) {
    const x = i / (N - 1);
    const c = mode === 'ox' ? 0.85 * Math.exp(-x * 1.2) + 0.2 : mode === 'irx' ? 0.5 * Math.exp(-x * 4) + 0.5 * Math.exp(-Math.pow((x - 0.95) / 0.12, 2)) : Math.exp(-x * 3.2);
    let t = c > 0.62 ? 'ph' : c > 0.26 ? 'pc' : 'xy';
    if (mode === 'pxy') { const r = Math.sin(i * 12.9898) * 43758.5453; t = ['ph', 'pc', 'xy'][Math.floor((r - Math.floor(r)) * 3)]; }
    if (mode === 'irx' && x > 0.8) t = 'pc';
    return [t, c];
  }
  function draw() {
    const COL = { ph: '#E57393', pc: '#7BC96F', xy: '#4A78C8' };
    let h = '<rect width="640" height="270" rx="14" fill="#FBFDFB"/>';
    h += '<g transform="translate(40 18)"><path d="M0 0 V100 H560" stroke="#7A8A7E" fill="none"/><text x="-6" y="8" text-anchor="end" class="mg-ts">TDIF</text>';
    h += `<polyline points="${Array.from({ length: N }, (_, i) => `${i / (N - 1) * 560},${100 - Math.min(1, cType(i)[1]) * 90}`).join(' ')}" fill="none" stroke="#C2415C" stroke-width="3"/>`;
    h += '</g>';
    const w = 560 / N;
    for (let i = 0; i < N; i++) { const [t] = cType(i); h += `<rect x="${40 + i * w + 1}" y="150" width="${w - 2}" height="46" rx="6" fill="${COL[t]}" ${t === 'xy' ? 'opacity=".95"' : ''}/>${t === 'xy' && mode !== 'pxy' ? `<circle cx="${40 + i * w + w / 2}" cy="173" r="6" fill="#fff" opacity=".7"/>` : ''}`; }
    h += `<g class="mg-t"><text x="40" y="216" class="mg-ts"><tspan fill="#C2415C" font-weight="800">■</tspan> флоема (багато TDIF)</text><text x="230" y="216" class="mg-ts"><tspan fill="#4E9A3F" font-weight="800">■</tspan> прокамбій / камбій (WOX4)</text><text x="440" y="216" class="mg-ts"><tspan fill="#4A78C8" font-weight="800">■</tspan> ксилема (мало TDIF)</text></g>`;
    h += '<text x="40" y="244" class="mg-ts">← флоемний полюс</text><text x="600" y="244" text-anchor="end" class="mg-ts">ксилемний полюс →</text>';
    sv.innerHTML = h;
    info.innerHTML = `<h4>${M[mode][0]}</h4><p>${M[mode][1]}</p>`;
  }
  root.append(row, sv, info);
  draw();
});

// ------------------------------------------------------------------ WUS–CLV3
register('wus-clv3', (root) => {
  const ctl = el('div', { class: 'mg-ctrls' });
  const S = sliders(ctl, [
    { id: 'rho', label: 'Синтез CLV3 (клітини в поверхневому шарі)', min: 0, max: 2.5, step: 0.05, value: 1, digits: 2, hint: '0 — мутант clv3: меристема «не відчуває» кількості клітин.' },
    { id: 'kap', label: 'Захоплення CLV3 рецепторами (CLV1, CLV2/CORYNE)', min: 0, max: 3, step: 0.05, value: 1, digits: 2 },
  ], draw);
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Меристема і контур WUS–CLV3' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function run(rho, kap) {
    const a = 1, b = 1, g = 1, d = 1; let Sx = 0.25, W = 0.25; const out = [];
    for (let t = 0; t <= 60; t += 0.1) { const C = rho * Sx; const dW = g / (1 + kap * C) - d * W; const dS = a * W - b * Sx; W += dW * 0.1; Sx += dS * 0.1; if (Math.abs(t - Math.round(t)) < 1e-6) out.push([t, Sx, W]); }
    return out;
  }
  function draw() {
    const { rho, kap } = S.values;
    const cur = run(rho, kap), wt = run(1, 1);
    const sfin = cur[cur.length - 1][1], wfin = cur[cur.length - 1][2], s0 = wt[wt.length - 1][1];
    const rel = sfin / s0;
    let h = '<rect width="640" height="300" rx="14" fill="#FBFDFB"/>';
    // меристема: купол
    const R = clamp(48 * Math.sqrt(rel), 24, 130);
    h += `<g transform="translate(150 230)"><path d="M${-R * 1.6} 0 Q ${-R * 1.4} ${-R * 1.6} 0 ${-R * 1.7} Q ${R * 1.4} ${-R * 1.6} ${R * 1.6} 0 Z" fill="#CDE8B8" stroke="#4E8A36" stroke-width="3"/>`;
    h += `<path d="M${-R * 1.3} ${-R * .28} Q ${-R * 1.1} ${-R * 1.45} 0 ${-R * 1.5} Q ${R * 1.1} ${-R * 1.45} ${R * 1.3} ${-R * .28}" fill="none" stroke="#2E7D32" stroke-width="3" opacity=".6"/>`;
    h += `<ellipse cx="0" cy="${-R * .6}" rx="${R * .5}" ry="${R * .3}" fill="#7B3FA0" opacity="${clamp(wfin * .8, .12, .9).toFixed(2)}"/><text x="0" y="${-R * .56}" text-anchor="middle" class="mg-ts" style="fill:#fff;font-weight:800">WUS</text>`;
    h += `<circle cx="0" cy="${-R * 1.62}" r="${R * .26}" fill="#C2415C" opacity="${clamp(rho * .7, 0, .9)}"/><text x="${R * .4}" y="${-R * 1.62}" class="mg-ts" style="font-weight:800;fill:#C2415C">CLV3</text></g>`;
    h += '<text x="150" y="268" text-anchor="middle" class="mg-ts">повздовжній розріз меристеми пагона (схема)</text>';
    // графік
    h += '<g transform="translate(330 24)"><rect width="290" height="200" rx="8" fill="#fff" stroke="#DCE6DC"/><path d="M34 16 V170 H274" stroke="#7A8A7E" fill="none"/><text x="12" y="100" class="mg-ts" transform="rotate(-90 12 100)">стовбурові клітини</text><text x="154" y="190" text-anchor="middle" class="mg-ts">час (відн. од.)</text>';
    const ymax = Math.max(2, ...cur.map((p) => p[1])) * 1.05;
    const poly = (arr, col, dash) => `<polyline fill="none" stroke="${col}" stroke-width="3" ${dash ? 'stroke-dasharray="6 4"' : ''} points="${arr.map((p) => `${34 + p[0] / 60 * 240},${170 - p[1] / ymax * 150}`).join(' ')}"/>`;
    h += poly(wt, '#2E7D32', true) + poly(cur, '#C2415C', false);
    h += '<text x="150" y="34" class="mg-ts" style="fill:#2E7D32;font-weight:800">╍ дикий тип</text><text x="150" y="48" class="mg-ts" style="fill:#C2415C;font-weight:800">━ поточні параметри</text></g>';
    sv.innerHTML = h;
    info.innerHTML = rel > 1.8 ? `<p><b>Меристема розростається (≈ ×${rel.toFixed(1).replace('.', ',')}) — фасціація:</b> без CLV3-сигналу зворотний зв\'язок не гальмує WUS; центральна зона збільшується, меристема стає витягнутою, «гребінчастою» (типово для складноцвітих, напр. целозії).</p>`
      : rel < 0.55 ? '<p><b>Меристема виснажується:</b> надмірне гальмування WUS — стовбурових клітин забракне.</p>'
        : '<p><b>Стабільний розмір.</b> Білок WUS рухається плазмодесмами в поверхневий шар, де вмикає <i>CLV3</i>; CLV3 дозріває, секретується й дифундує вглиб; у 2-му шарі рецептори «виловлюють» частину пептиду, решта доходить до клітин WUS і знижує його експресію — негативний зворотний зв\'язок підтримує сталий розмір.</p>';
  }
  root.append(ctl, sv, info);
  draw();
});

// ------------------------------------------------------------------ активатор/інгібітор: трихоми
register('trichome-ai', (root) => {
  const M = { wt: ['Дикий тип', 'Активатор (TTG1/GL1/GL3) підсилює сам себе, а клітина-трихома виділяє інгібітор <b>TRY</b>, що поширюється на сусідів і пригнічує там розвиток волосків → трихоми рівномірно розставлені.'], gl1: ['gl1 (немає активатора)', 'Немає GL1 — жодна клітина не стає трихомою: гладкий лист.'], try: ['try (немає інгібітора)', 'Без <b>TRY</b> сусідні клітини не пригнічуються — утворюються «гнізда» трихом.'] };
  let mode = 'wt', seed = 1;
  const row = el('div', { class: 'mg-opts' });
  options(row, Object.entries(M).map(([v, m]) => ({ v, t: m[0] })), 'wt', (v) => { mode = v; gen(); });
  const ctl = el('div');
  const S = sliders(ctl, [{ id: 'R', label: 'Радіус дії інгібітора', min: 1, max: 4, step: 0.1, value: 2.2, digits: 1, unit: 'клітини', hint: 'Дикий тип: інгібітор «розставляє» трихоми.' }], gen);
  const cv = el('canvas', { class: 'mg-canvas', width: 640, height: 380, role: 'img', 'aria-label': 'Епідерміс: розташування трихом за моделлю активатор–інгібітор' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const btn = el('button', { type: 'button', class: 'mg-btn' }, '↻ Новий лист');
  btn.addEventListener('click', () => { seed++; gen(); });
  root.append(row, ctl, el('div', { class: 'mg-row' }, btn), cv, info);
  const ctx = cv.getContext('2d');
  function rngf(s) { let a = s * 2654435761 >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gen() {
    const R = S.values.R; const rand = rngf(seed * 977 + (mode === 'try' ? 13 : 0));
    const cols = 30, rows = 19, cs = 20; const cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push({ x: i + (j % 2 ? .5 : 0), y: j * .866, t: false, i, j });
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    if (mode !== 'gl1') {
      for (let round = 0; round < 60; round++) {
        for (const c of cells) {
          if (c.t) continue;
          let p = 0.0035;
          const near = cells.filter((o) => o.t && dist(o, c) < (mode === 'try' ? 1.6 : R));
          if (mode === 'try') { if (near.length) p *= 9; }
          else if (near.length) p = 0;
          if (rand() < p) c.t = true;
        }
      }
    }
    ctx.fillStyle = '#F4F9EC'; ctx.fillRect(0, 0, 640, 380);
    cells.forEach((c) => { const x = 14 + c.x * cs, y = 14 + c.y * cs * 1.02; ctx.beginPath(); ctx.arc(x, y, cs * .47, 0, 6.283); ctx.fillStyle = c.t ? '#2E7D32' : '#D8E8C6'; ctx.fill(); ctx.strokeStyle = '#B9CFA0'; ctx.stroke(); if (c.t) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { const a = k * 2.094 + .5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); ctx.stroke(); } ctx.lineWidth = 1; } });
    const T = cells.filter((c) => c.t); let touch = 0;
    for (let a = 0; a < T.length; a++) for (let b = a + 1; b < T.length; b++) if (dist(T[a], T[b]) < 1.2) touch++;
    info.innerHTML = `<p><b>${M[mode][0]}:</b> трихом — ${T.length}, пар сусідніх трихом — ${touch}. ${M[mode][1]}</p><p>Подвійний мутант двох інгібіторів дає великі острівці волосків. Така ж логіка «одна клітина між продихами» працює для продихів: пептид STOMAGEN/EPF → рецептор TMM → фактор SPEECHLESS (SPCH); мутант <i>tmm</i> — продихи торкаються один одного.</p>`;
  }
  gen();
});

// ------------------------------------------------------------------ філотаксис: поле інгібування
register('phyllo', (root) => {
  const ctl = el('div');
  const S = sliders(ctl, [{ id: 'z', label: 'Розмір зони інгібування відносно меристеми', min: 0, max: 100, step: 1, value: 44, digits: 0, unit: '%', hint: 'Ліворуч — велика зона (дистихія), праворуч — мала (супротивне, кільчасте).' }], restart);
  const cv = el('canvas', { class: 'mg-canvas', width: 520, height: 520, role: 'img', 'aria-label': 'Вигляд зверху на апекс: утворення примордіїв за моделлю поля інгібування' });
  cv.style.maxWidth = '420px'; cv.style.margin = '0 auto';
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const rst = el('button', { type: 'button', class: 'mg-btn mg-btn--o' }, '↺ Почати спочатку');
  rst.addEventListener('click', restart);
  root.append(ctl, el('div', { class: 'mg-row' }, rst), cv, info);
  const ctx = cv.getContext('2d');
  let P = [], ang = [], t0 = 0, Ec = 0.2, hist = [];
  function restart() {
    const z = S.values.z / 100; Ec = Math.exp(lerp(Math.log(0.004), Math.log(9), z)); P = []; ang = []; hist = []; div = [];
  }
  const E = (th) => { const x = Math.cos(th), y = Math.sin(th); let s = 0; for (const q of P) { const dx = x - q.r * Math.cos(q.a), dy = y - q.r * Math.sin(q.a); s += 1 / Math.pow(Math.hypot(dx, dy), 3); } return s; };
  function step() {
    for (let sub = 0; sub < 6; sub++) {
      let best = 1e9, ba = 0; for (let k = 0; k < 180; k++) { const th = k / 180 * 6.2832; const e = E(th); if (e < best) { best = e; ba = th; } }
      if (best < Ec || !P.length) {
        P.push({ a: ba, r: 1, n: (hist.length ? hist[hist.length - 1] : 0) + 1 }); hist.push(P[P.length - 1].n);
        ang.push(ba);
        if (ang.length > 1) { let d = (ang[ang.length - 1] - ang[ang.length - 2]) * 180 / Math.PI; d = ((d % 360) + 360) % 360; if (d > 180) d = 360 - d; div.push(d); if (div.length > 24) div.shift(); }
        continue;
      }
      for (const q of P) q.r *= 1.006;
    }
    P = P.filter((q) => q.r < 4.2);
  }
  let div = [];
  function classify() {
    if (div.length < 8) return '…';
    const l = div.slice(-8); const m = l.reduce((a, b) => a + b, 0) / l.length;
    const big = l.filter((x) => x > 165).length, mid = l.filter((x) => x > 60 && x < 125).length;
    if (m > 172) return 'дистихія (дворядне розташування, кут 180°)';
    if (m > 150) return 'перехід від дистихії до спіралі';
    if (m > 130 && m < 150 && big < 3) return 'спіральне розташування (кут ≈ 137,5° — золотий кут)';
    if (big >= 2 && mid >= 2) return 'супротивне (пари під 180°, наступна пара повернена на ≈ 90°) або кільчасте';
    return 'перехідний / нерегулярний малюнок';
  }
  let fr = 0;
  restart();
  loop(cv, () => {
    step();
    const W = 520, c = W / 2, sc = 54;
    ctx.fillStyle = '#F4F9EC'; ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#B9CFA0'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(c, c, sc, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#CDE8B8'; ctx.beginPath(); ctx.arc(c, c, sc, 0, 6.283); ctx.fill();
    for (const q of P) { const x = c + Math.cos(q.a) * q.r * sc, y = c + Math.sin(q.a) * q.r * sc; const rad = 8 + q.r * 7; const age = clamp((q.r - 1) / 3, 0, 1); ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fillStyle = `hsl(${110 - age * 30} ${55 - age * 10}% ${60 - age * 18}%)`; ctx.fill(); ctx.strokeStyle = '#3D6E2C'; ctx.stroke(); ctx.fillStyle = '#13241A'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; if (rad > 11) ctx.fillText(q.n, x, y + 4); }
    if (++fr % 10 === 0) info.innerHTML = `<p><b>Малюнок розташування:</b> ${classify()}. Нові примордії закладаються там, де сумарне інгібування найменше; закладений примордій зберігає кутову координату й відсувається від центру; навколо нього — зона інгібування.</p>`;
  });
});

// ------------------------------------------------------------------ мірність квітки
register('merosity', (root) => {
  const ctl = el('div');
  const S = sliders(ctl, [{ id: 'z', label: 'Розмір зони інгібування відносно кола апекса', min: 0.9, max: 2.1, step: 0.01, value: 1.74, digits: 2 }], draw);
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Мірність квітки залежить від геометрії апекса' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function draw() {
    const z = S.values.z; const nReal = Math.PI / Math.asin(Math.min(1, z / 2)); const n = Math.floor(nReal); const fr = nReal - n;
    const step = 2 * Math.asin(z / 2); // кутовий крок
    let h = '<rect width="640" height="300" rx="14" fill="#FBFDFB"/>';
    const cx = 200, cy = 150, R = 95;
    h += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#C9D7CB" stroke-dasharray="4 5"/>`;
    const rad = R * z / 2 * 0.92;
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * step; h += `<circle cx="${cx + Math.cos(a) * R}" cy="${cy + Math.sin(a) * R}" r="${Math.min(rad, 46)}" fill="#F7C1D3" stroke="#C2415C" stroke-width="2"/>`; }
    const gap = 2 * Math.PI - n * step;
    if (fr > 0.35 && gap > 0.2) { const a = -Math.PI / 2 + n * step + gap / 2; h += `<circle cx="${cx + Math.cos(a) * R}" cy="${cy + Math.sin(a) * R}" r="${Math.min(rad, 46) * (gap / step) * 0.9}" fill="#FBE3EE" stroke="#C2415C" stroke-width="2" stroke-dasharray="4 3"/>`; }
    h += `<circle cx="${cx}" cy="${cy}" r="10" fill="#9FC270"/>`;
    const label = fr > 0.35 && fr < 0.65 ? `проміжна «${n},5-мірна» квітка` : `${fr >= 0.65 ? n + 1 : n}-мірна квітка`;
    h += `<text x="400" y="110" class="mg-th">${label}</text><text x="400" y="136" class="mg-t">n = ${nReal.toFixed(2).replace('.', ',')}</text>`;
    h += `<text x="400" y="170" class="mg-ts">Мірність значною мірою задає геометрія (об'єм меристеми /</text><text x="400" y="186" class="mg-ts">зона інгібування).</text>`;
    h += `<text x="400" y="212" class="mg-ts">3-мірні: традесканція, хіонодокса, лілійник;</text><text x="400" y="228" class="mg-ts">проміжні «2,5-мірні» — нарцис, лілія, гортензія.</text>`;
    sv.innerHTML = h;
    info.innerHTML = '<p>Це спрощена геометрична ілюстрація: що менша зона інгібування відносно кола, то більше примордіїв на ньому вміщується. На практиці число органів залежить ще й від генів, що задають розмір меристеми (наприклад, <i>CLV</i>, <i>WUS</i>).</p>';
  }
  root.append(ctl, sv, info);
  draw();
});

// ------------------------------------------------------------------ ABC-модель квітки
register('abc-flower', (root) => {
  const ORG = { sepal: ['чашолисток', '#66BB6A'], petal: ['пелюстка', '#EC407A'], stamen: ['тичинка', '#FFB300'], carpel: ['плодолисток', '#8E24AA'], leaf: ['листкоподібний орган', '#9E9D24'] };
  const G = {
    wt: ['Дикий тип', [1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 1], 'У нормі A діє у вертикалах 1–2, B — у 2–3, C — у 3–4: чашолистки, пелюстки, тичинки, плодолистки.'],
    ap2: ['<i>ap2</i> (немає A)', [0, 0, 0, 0], [0, 1, 1, 0], [1, 1, 1, 1], 'Без A функція C поширюється на всі вертикали (A і C взаємно пригнічуються): у зовнішніх вертикалах — плодолистки й тичинки.'],
    ap3: ['<i>ap3</i> або <i>pi</i> (немає B)', [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 1, 1], 'Без B пелюстки перетворюються на чашолистки, а тичинки — на плодолистки.'],
    ag: ['<i>ag</i> (немає C)', [1, 1, 1, 1], [0, 1, 1, 0], [0, 0, 0, 0], 'Без C функція A поширюється на всі вертикали: тичинки стають пелюстками, а замість плодолистків закладається нова квітка (детермінованість втрачено).'],
    sep: ['<i>sep1 sep2 sep3</i>', null, null, null, 'Без білків SEPALLATA комплекси MADS-білків не працюють, тож усі вертикали розвиваються як чашолисткоподібні органи (у чотирикратному мутанті — як листки).'],
  };
  const row = el('div', { class: 'mg-opts' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 330', role: 'img', 'aria-label': 'Діаграма квітки з чотирма вертикалами та експресією генів класів A, B, C' });
  const o = options(row, Object.keys(G).map((k) => ({ v: k, t: G[k][0].replace(/<[^>]+>/g, ''), c: '#8E24AA' })), 'wt', show);
  function organ(g, w) {
    if (g === 'sep') return 'sepal';
    const [, A, B, C] = G[g];
    if (A[w] && B[w]) return 'petal';
    if (B[w] && C[w]) return 'stamen';
    if (A[w]) return 'sepal';
    if (C[w]) return 'carpel';
    return 'leaf';
  }
  function show(g) {
    o.set(g);
    const cx = 170, cy = 165, R = [140, 108, 76, 44];
    let h = '<rect width="640" height="330" rx="14" fill="#FBFDFB"/>';
    for (let w = 0; w < 4; w++) { const k = organ(g, w); h += `<circle cx="${cx}" cy="${cy}" r="${R[w]}" fill="${ORG[k][1]}" stroke="#fff" stroke-width="3" opacity="${g === 'sep' ? 0.85 : 1}"/>`; }
    h += `<circle cx="${cx}" cy="${cy}" r="14" fill="none"/>`;
    for (let w = 0; w < 4; w++) h += `<text x="${cx}" y="${cy - R[w] + 16}" text-anchor="middle" class="mg-ts" fill="#fff" font-weight="700">${w + 1}</text>`;
    h += '<text x="360" y="30" class="mg-tb">Вертикаль</text>';
    ['1', '2', '3', '4'].forEach((t, i) => { h += `<text x="${440 + i * 44}" y="30" class="mg-tb" text-anchor="middle">${t}</text>`; });
    const rows = [['A', 1], ['B', 2], ['C', 3]];
    rows.forEach(([name, idx], r) => {
      h += `<text x="360" y="${64 + r * 30}" class="mg-t">Клас ${name}</text>`;
      for (let w = 0; w < 4; w++) {
        const on = G[g][idx] ? G[g][idx][w] : 0;
        h += `<rect x="${422 + w * 44}" y="${48 + r * 30}" width="36" height="22" rx="5" fill="${on ? '#5B3FA0' : '#EEF1EE'}"/>`;
      }
    });
    h += '<text x="360" y="150" class="mg-tb">Утворюється:</text>';
    for (let w = 0; w < 4; w++) { const k = organ(g, w); h += `<circle cx="368" cy="${178 + w * 30}" r="9" fill="${ORG[k][1]}"/><text x="386" y="${183 + w * 30}" class="mg-t">${w + 1}: ${ORG[k][0]}</text>`; }
    sv.innerHTML = h;
    info.innerHTML = `<h4>${G[g][0]}</h4><p>${G[g][4]}</p>`;
  }
  root.append(row, sv, info);
  show('wt');
});
