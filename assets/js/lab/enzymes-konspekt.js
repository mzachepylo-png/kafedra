// Конспект «Ферменти»: будова, класи КФ, енергетичний профіль, ключ — замок,
// pH і температура, кінетика з інгібуванням, алостерична регуляція.
import { Plot, linspace } from './plot.js';
import { sliders, segmented, setOut, num, sig } from './ui.js';

const $ = (id) => document.getElementById(id);
const D = JSON.parse($('ez-data').textContent);

// ---------------------------------------------------------------- будова ферменту
(() => {
  const box = document.querySelector('.ez-anat');
  if (!box) return;
  const INFO = {
    active: ['1', 'Активний центр', 'Просторова щілина, утворена при згортанні поліпептидного ланцюга радикалами 5–15 амінокислот (найчастіше Ser, His, Cys, Asp, Glu, Lys, Arg, Tyr), які в первинній структурі далеко одна від одної. Тут субстрат зв\'язується і перетворюється на продукт.'],
    contact: ['2', 'Контактна (субстратна) ділянка', 'Висококомплементарна частина активного центру: впізнає субстрат і фіксує його водневими, іонними та гідрофобними зв\'язками. Саме вона визначає специфічність ферменту.'],
    catal: ['3', 'Каталітична ділянка', 'Групи, що безпосередньо атакують хімічні зв\'язки субстрату: нуклеофіли (–OH серину, –SH цистеїну), кислотно-основні каталізатори (імідазол гістидину), кофактори.'],
    allo: ['4', 'Алостеричний (регуляторний) центр', 'Просторово віддалена ділянка, часто на окремій регуляторній субодиниці. Зв\'язування ефектора-метаболіту запускає кооперативну конформаційну хвилю, яка змінює спорідненість активного центру до субстрату або швидкість каталізу.'],
    glob: ['5', 'Білкова глобула', 'Решта сотень амінокислот утримує точну тривимірну форму центрів. Тому денатурація (нагрівання, екстремальні pH, важкі метали) руйнує активність, навіть якщо самі амінокислоти активного центру не змінені.'],
  };
  const info = $('ez-anat-info');
  const nums = [...box.querySelectorAll('.ez-num g')];
  function show(k) {
    const [n, t, d] = INFO[k];
    info.innerHTML = `<small>Ділянка ${n}</small><h3>${t}</h3><p>${d}</p>`;
    box.classList.toggle('has-sel', k !== 'glob');
    box.querySelectorAll('.ez-hot').forEach((g) => g.classList.toggle('is-on', g.dataset.k === k || (k === 'active' && g.dataset.k !== 'allo')));
    nums.forEach((g) => g.classList.toggle('is-on', g.dataset.k === k));
  }
  nums.forEach((g) => {
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', INFO[g.dataset.k][1]);
    g.addEventListener('click', () => show(g.dataset.k));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(g.dataset.k); } });
  });
  show('active');
})();

// ---------------------------------------------------------------- класи КФ і шифр
(() => {
  const grid = $('ec-grid');
  if (!grid) return;
  const card = $('ec-card');
  const tiles = [...grid.querySelectorAll('.ec-tile')];
  tiles.forEach((t) => t.style.setProperty('--s', D.ec[+t.dataset.n - 1].share));
  const li = (arr) => arr.map(([n, c]) => `<li><span>${n}</span><code>КФ ${c}</code></li>`).join('');
  function show(n) {
    const e = D.ec[n - 1];
    tiles.forEach((t) => t.setAttribute('aria-pressed', String(+t.dataset.n === n)));
    card.style.setProperty('--c', e.c);
    card.innerHTML = `<div class="ec-card__head"><h3>КФ ${e.n}. ${e.name}</h3><span class="ec-eq">${e.eq}</span></div>
      <div class="ec-card__body">
        <div><h4>Тип реакції</h4><p>${e.what}</p><h4 style="margin-top:10px">Підкласи</h4><p>${e.sub}</p><h4 style="margin-top:10px">Кофактори</h4><p>${e.cof}</p></div>
        <div><h4>Класичні приклади</h4><ul>${li(e.ex)}</ul><h4 style="margin-top:10px">Ферменти рослин</h4><ul class="is-plant">${li(e.plant)}</ul></div>
      </div>`;
  }
  tiles.forEach((t) => t.addEventListener('click', () => show(+t.dataset.n)));
  show(4);
  const DEC = {
    '1.1.1.1': ['алкогольдегідрогеназа', 'діють на групу CH–OH донора', 'акцептор — НАД⁺ або НАДФ⁺'],
    '1.11.1.6': ['каталаза', 'акцептор — пероксид', 'пероксидази'],
    '1.7.1.1': ['нітратредуктаза (NADH)', 'донор — інші азотисті сполуки (нітрит / нітрат)', 'акцептор — НАД⁺ або НАДФ⁺'],
    '1.10.3.1': ['поліфенолоксидаза (катехолоксидаза)', 'донор — дифеноли', 'акцептор — кисень'],
    '2.7.1.1': ['гексокіназа', 'перенесення фосфоровмісних груп', 'акцептор — спиртова група'],
    '2.6.1.1': ['аспартатамінотрансфераза', 'перенесення азотовмісних груп', 'трансамінази'],
    '2.7.1.19': ['фосфорибулокіназа', 'перенесення фосфоровмісних груп', 'акцептор — спиртова група'],
    '3.2.1.1': ['α-амілаза', 'глікозилази', 'гідроліз O- та S-глікозидних зв\'язків'],
    '3.4.21.4': ['трипсин', 'пептидази', 'серинові ендопептидази'],
    '3.4.22.2': ['папаїн', 'пептидази', 'цистеїнові ендопептидази'],
    '3.5.1.5': ['уреаза', 'діють на C–N зв\'язки, крім пептидних', 'у лінійних амідах'],
    '4.1.1.39': ['рибулозобісфосфаткарбоксилаза (Рубіско)', 'C–C-ліази', 'карбокси-ліази (декарбоксилази / карбоксилази)'],
    '4.1.1.31': ['фосфоенолпіруваткарбоксилаза', 'C–C-ліази', 'карбокси-ліази'],
    '4.3.1.24': ['фенілаланінамоній-ліаза (PAL)', 'C–N-ліази', 'аміак-ліази'],
    '5.3.1.1': ['тріозофосфатізомераза', 'внутрішньомолекулярні оксидоредуктази', 'взаємоперетворення альдоз і кетоз'],
    '6.3.1.2': ['глутамінсинтетаза', 'утворення зв\'язків C–N', 'кислота-аміак-лігази (амідсинтетази)'],
    '6.4.1.2': ['ацетил-КоА-карбоксилаза', 'утворення зв\'язків C–C', 'карбоксилази'],
    '7.1.2.2': ['H⁺-транспортуюча ATP-синтаза', 'транслокація протонів (гідронів)', 'спряжена з гідролізом нуклеозидтрифосфату'],
  };
  const sel = $('ec-code');
  sel.innerHTML = Object.entries(DEC).map(([c, d]) => `<option value="${c}">КФ ${c} — ${d[0]}</option>`).join('');
  sel.value = '4.1.1.39';
  const dec = () => {
    const c = sel.value, d = DEC[c], p = c.split('.');
    const cls = D.ec[+p[0] - 1];
    $('ec-digits').innerHTML = `<div><b style="color:${cls.c}">${p[0]}</b><span>клас: ${cls.name.toLowerCase()}</span></div><div><b>${p[0]}.${p[1]}</b><span>підклас: ${d[1]}</span></div><div><b>${p.slice(0, 3).join('.')}</b><span>підпідклас: ${d[2]}</span></div><div><b>${c}</b><span>№ ${p[3]}: ${d[0]}</span></div>`;
  };
  sel.addEventListener('change', () => { dec(); show(+sel.value[0]); });
  dec();
})();

// ---------------------------------------------------------------- енергетичний профіль
(() => {
  const svg = $('eg-svg');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const sl = sliders($('eg-c'), [
    { id: 'ga', label: 'ΔG‡ без ферменту', min: 50, max: 120, step: 1, value: 90, unit: 'кДж/моль' },
    { id: 'dd', label: 'Зниження бар\'єру ферментом', min: 5, max: 60, step: 1, value: 40, unit: 'кДж/моль' },
    { id: 'dg', label: 'ΔG реакції', min: -60, max: 0, step: 1, value: -30, unit: 'кДж/моль' },
  ], draw);
  $('eg-enz').addEventListener('change', draw);
  const W = 620, H = 330, m = { l: 54, r: 18, t: 18, b: 40 };
  const step = (x) => 1 / (1 + Math.exp(-(x - 0.5) / 0.05));
  const g = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  function draw() {
    const { ga, dd, dg } = sl.values, gc = ga - dd, enz = $('eg-enz').checked;
    const f0 = (x) => dg * step(x) + (ga - dg / 2) * g(x, 0.5, 0.12) * (1 - 0.0 * x);
    const fc = (x) => dg * step(x) + (gc - dg / 2) * g(x, 0.5, 0.07) + 0.6 * gc * g(x, 0.31, 0.05) - 9 * g(x, 0.4, 0.035) - 9 * g(x, 0.6, 0.035) + 0.45 * gc * g(x, 0.69, 0.05);
    const lo = Math.min(dg, -10) - 12, hi = 130;
    const X = (x) => m.l + x * (W - m.l - m.r), Y = (v) => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b);
    const xs = linspace(0, 1, 220);
    const path = (f) => xs.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(f(x)).toFixed(1)}`).join('');
    const peak0 = Y(ga), peakC = Y(gc);
    svg.innerHTML = `
      <rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="#FFFFFF" stroke="#E3EBE3"/>
      <line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(0)}" stroke="#C3D3C4" stroke-dasharray="4 4"/>
      <line x1="${X(0.55)}" y1="${Y(dg)}" x2="${X(1)}" y2="${Y(dg)}" stroke="#C3D3C4" stroke-dasharray="4 4"/>
      <path d="${path(f0)}" fill="none" stroke="#D0443A" stroke-width="3" stroke-dasharray="9 6"/>
      ${enz ? `<path d="${path(fc)}" fill="none" stroke="#0E3F4A" stroke-width="3.4"/>` : ''}
      <g stroke-width="2" fill="none"><path d="M${X(0.53)} ${Y(0)} V${peak0 + 4}" stroke="#D0443A" marker-end="url(#eg-a)"/>${enz ? `<path d="M${X(0.47)} ${Y(0)} V${peakC + 4}" stroke="#0E3F4A" marker-end="url(#eg-a)"/>` : ''}<path d="M${X(0.93)} ${Y(0)} V${Y(dg) - 4}" stroke="#14946B" marker-end="url(#eg-a)"/></g>
      <defs><marker id="eg-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>
      <text x="${X(0.55)}" y="${peak0 + 18}" class="eg-t eg-t--b" style="fill:#B23B22">ΔG‡ = ${ga} кДж/моль (без ферменту)</text>
      ${enz ? `<text x="${X(0.45)}" y="${Math.max(peakC - 8, m.t + 12)}" text-anchor="end" class="eg-t eg-t--b" style="fill:#0E3F4A">ΔG‡ = ${gc} (з ферментом)</text><text x="${X(0.4)}" y="${Y(fc(0.4)) + 18}" text-anchor="middle" class="eg-t">ES</text><text x="${X(0.6)}" y="${Y(fc(0.6)) + 18}" text-anchor="middle" class="eg-t">EP</text>` : ''}
      <text x="${X(0.02)}" y="${Y(0) - 8}" class="eg-t eg-t--b">E + S</text>
      <text x="${X(0.98)}" y="${Y(dg) - 8}" text-anchor="end" class="eg-t eg-t--b">E + P</text>
      <text x="${X(0.91)}" y="${(Y(0) + Y(dg)) / 2}" text-anchor="end" class="eg-t" style="fill:#0E6B4C">ΔG = ${dg}</text>
      <text x="${(m.l + W - m.r) / 2}" y="${H - 10}" text-anchor="middle" class="eg-t">Хід реакції →</text>
      <text transform="translate(16 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle" class="eg-t">Вільна енергія G →</text>`;
    void NS;
    const k = dd * 1000 / (8.314 * 298.15) / Math.LN10;
    setOut(document, { eg0: `${ga} кДж/моль`, eg1: `${gc} кДж/моль`, egk: `≈ 10<sup>${num(k, 1)}</sup> разів` });
  }
  draw();
})();

// ---------------------------------------------------------------- ключ — замок
$('fit-btn')?.addEventListener('click', (e) => {
  const box = e.target.closest('.ez-fit');
  const on = box.classList.toggle('is-on');
  e.target.textContent = on ? 'Повторити' : 'Показати зв\'язування';
  if (!on) requestAnimationFrame(() => requestAnimationFrame(() => { box.classList.add('is-on'); e.target.textContent = 'Повторити'; }));
});

// ---------------------------------------------------------------- pH і температура
(() => {
  if (!$('ph-plot')) return;
  const on = new Set(['pep', 'amy', 'try', 'alp', 'rub']);
  const tg = $('ph-tg');
  tg.innerHTML = D.ph.map((p) => `<button type="button" data-id="${p.id}" style="--c:${p.c}" aria-pressed="${on.has(p.id)}"><i></i>${p.n}</button>`).join('');
  const pp = new Plot($('ph-plot'), { xLabel: 'pH', yLabel: 'Активність, %', xShort: 'pH', x: [0, 12], y: [0, 105], aspect: 1.35 });
  const phs = linspace(0, 12, 241);
  const drawPh = () => pp.set(D.ph.filter((p) => on.has(p.id)).map((p) => ({ data: phs.map((x) => [x, 100 * Math.exp(-0.5 * ((x - p.o) / p.w) ** 2)]), color: p.c, width: 2.4, label: `${p.n} (опт. ${num(p.o, 1)})` })));
  tg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.id;
    if (on.has(id)) on.delete(id); else on.add(id);
    b.setAttribute('aria-pressed', String(on.has(id)));
    drawPh();
  }));
  drawPh();
  const pt = new Plot($('t-plot'), { xLabel: 'Температура, °C', yLabel: 'Активність, %', xShort: 'T', x: [0, 95], y: [0, 105], aspect: 1.35 });
  const sl = sliders($('t-c'), [
    { id: 'q10', label: 'Температурний коефіцієнт Q₁₀', min: 1.4, max: 3, step: 0.1, value: 2, digits: 1 },
    { id: 'tm', label: 'Температура денатурації T<sub>m</sub>', min: 38, max: 70, step: 1, value: 47, unit: '°C' },
  ], drawT);
  const Ts = linspace(0, 95, 381);
  const act = (T, q, tm) => q ** ((T - 25) / 10) / (1 + Math.exp((T - tm) / 2.4));
  function drawT() {
    const { q10, tm } = sl.values;
    const a = Ts.map((T) => act(T, q10, tm)), mx = Math.max(...a);
    const iO = a.indexOf(mx), tO = Ts[iO];
    const taq = Ts.map((T) => act(T, 1.6, 82)), tmx = Math.max(...taq);
    pt.set([
      { data: Ts.map((T, i) => [T, a[i] / mx * 100]), color: '#0E3F4A', width: 2.6, label: 'Фермент (ваші параметри)', marker: [tO, 100] },
      { data: Ts.map((T, i) => [T, taq[i] / tmx * 100]), color: '#D9822B', width: 2, dash: [7, 5], label: 'Taq-ДНК-полімераза (опт. ≈ 74 °C)' },
    ], [{ x: tm, color: '#D0443A', dash: [3, 3], label: 'T_m' }]);
    setOut(document, { topt: `${num(tO, 0)} °C`, tnat: `${num(100 / (1 + Math.exp((tO - tm) / 2.4)), 0)} %` });
  }
  drawT();
})();

// ---------------------------------------------------------------- кінетика та інгібування
(() => {
  if (!$('mm-plot')) return;
  let type = 'comp';
  const NOTES = {
    none: 'Без інгібітора: гіпербола Міхаеліса — Ментен; на графіку Лайнуівера — Берка пряма перетинає осі в точках 1/V<sub>max</sub> та −1/K<sub>m</sub>.',
    comp: 'Конкурентне: прямі перетинаються на осі ординат — V<sub>max</sub> та сама, але для її досягнення потрібно більше субстрату (K<sub>m</sub> зростає в α разів).',
    noncomp: 'Неконкурентне: спільна точка на осі абсцис (−1/K<sub>m</sub>) — спорідненість не змінюється, але частина ферменту «вимкнена», тому V<sub>max</sub> падає.',
    uncomp: 'Безконкурентне: паралельні прямі — інгібітор зв\'язується лише з ES, тому зменшуються і V<sub>max</sub>, і K<sub>m</sub> в однакову кількість разів.',
    mixed: 'Змішане: K<sub>i</sub> ≠ K<sub>i</sub>′, перетин у II або III квадранті. Змінюйте K<sub>i</sub>′ і спостерігайте, як точка перетину зміщується.',
    irrev: 'Незворотне: інгібітор ковалентно «вимикає» частину молекул ферменту. Це рівносильне зменшенню [E]₀ — V<sub>max</sub> падає, K<sub>m</sub> не змінюється, і надлишок субстрату не допомагає.',
  };
  segmented($('ki-type'), 'ki-type', [
    { value: 'none', label: 'Без інгібітора' }, { value: 'comp', label: 'Конкурентне' }, { value: 'noncomp', label: 'Неконкурентне' },
    { value: 'uncomp', label: 'Безконкурентне' }, { value: 'mixed', label: 'Змішане' }, { value: 'irrev', label: 'Незворотне' },
  ], type, (v) => { type = v; upd(); });
  const sl = sliders($('ki-c'), [
    { id: 'km', label: 'K<sub>m</sub>', min: 0.5, max: 10, step: 0.1, value: 2, unit: 'мМ', digits: 1 },
    { id: 'vm', label: 'V<sub>max</sub>', min: 40, max: 150, step: 1, value: 100, unit: 'мкмоль/хв' },
    { id: 'ic', label: 'Концентрація інгібітора [I]', min: 0, max: 10, step: 0.1, value: 3, unit: 'мМ', digits: 1 },
    { id: 'ki', label: 'K<sub>i</sub> (зв\'язування з E)', min: 0.5, max: 10, step: 0.1, value: 1.5, unit: 'мМ', digits: 1 },
    { id: 'ki2', label: 'K<sub>i</sub>′ (зв\'язування з ES)', min: 0.5, max: 10, step: 0.1, value: 5, unit: 'мМ', digits: 1 },
  ], upd);
  const pM = new Plot($('mm-plot'), { xLabel: '[S], мМ', yLabel: 'V₀', xShort: '[S]', x: [0, 20], y: 'auto', aspect: 1.3 });
  const pL = new Plot($('lb-plot'), { xLabel: '1/[S], мМ⁻¹', yLabel: '1/V₀', xShort: '1/[S]', x: [-1.2, 2], y: 'auto', yZero: true, aspect: 1.3 });
  function params() {
    const { km, vm, ic, ki, ki2 } = sl.values;
    let a = 1, a2 = 1, V = vm;
    if (type === 'comp') a = 1 + ic / ki;
    if (type === 'noncomp') { a = 1 + ic / ki; a2 = a; }
    if (type === 'uncomp') a2 = 1 + ic / ki2;
    if (type === 'mixed') { a = 1 + ic / ki; a2 = 1 + ic / ki2; }
    if (type === 'irrev') V = vm * Math.max(0, 1 - ic / 10);
    return { km, vm, V, a, a2, vmApp: V / a2, kmApp: km * a / a2 };
  }
  function upd() {
    const p = params();
    const show = (id, vis) => sl.inputs[id].row.classList.toggle('is-disabled', !vis);
    show('ic', type !== 'none'); show('ki', ['comp', 'noncomp', 'mixed'].includes(type)); show('ki2', ['uncomp', 'mixed'].includes(type));
    const S = linspace(0.02, 20, 300);
    const v0 = (s) => p.vm * s / (p.km + s), vi = (s) => p.V * s / (p.a * p.km + p.a2 * s);
    pM.set([
      { data: S.map((s) => [s, v0(s)]), color: '#9FB3A3', width: 2, dash: [6, 5], label: 'без інгібітора' },
      ...(type !== 'none' ? [{ data: S.map((s) => [s, vi(s)]), color: '#D0443A', width: 2.6, label: 'з інгібітором' }] : []),
    ], [{ y: p.vm, color: '#C9D3CC', dash: [2, 4], label: 'V_max' }, { y: p.vmApp / 2, color: '#E8C3B8', dash: [2, 4] }]);
    const xs = linspace(-1.2, 2, 2);
    const lb0 = (x) => p.km / p.vm * x + 1 / p.vm, lbi = (x) => p.a * p.km / p.V * x + p.a2 / p.V;
    pL.set([
      { data: xs.map((x) => [x, lb0(x)]), color: '#9FB3A3', width: 2, dash: [6, 5], label: 'без інгібітора' },
      ...(type !== 'none' ? [{ data: xs.map((x) => [x, lbi(x)]), color: '#D0443A', width: 2.6, label: 'з інгібітором' }] : []),
    ], [{ x: 0, color: '#9FB3A3' }, { y: 0, color: '#9FB3A3' }]);
    const inh = type === 'none' ? 0 : 1 - vi(p.km) / v0(p.km);
    setOut(document, { kvm: sig(p.vmApp, 3), kkm: sig(p.kmApp, 3) + ' мМ', kinh: num(inh * 100, 0) + ' %' });
    $('ki-note').innerHTML = NOTES[type];
  }
  upd();
})();

// ---------------------------------------------------------------- алостерія
(() => {
  if (!$('al-plot')) return;
  const K0 = 4;
  const sl = sliders($('al-c'), [
    { id: 'nh', label: 'Коефіцієнт Хілла n<sub>H</sub>', min: 1, max: 4, step: 0.1, value: 2.8, digits: 1 },
    { id: 'act', label: 'Активатор (AMP, фруктозо-2,6-бісфосфат)', min: 0, max: 5, step: 0.1, value: 0, digits: 1, unit: 'відн.' },
    { id: 'inh', label: 'Інгібітор (ATP, цитрат)', min: 0, max: 5, step: 0.1, value: 0, digits: 1, unit: 'відн.' },
  ], upd);
  const plot = new Plot($('al-plot'), { xLabel: '[S], відн. од.', yLabel: 'V₀, % від V_max', xShort: '[S]', x: [0, 12], y: [0, 105], aspect: 1.9 });
  const mwc = $('ez-mwc');
  mwc.innerHTML = '<span></span><span></span><span></span><span></span>';
  const subs = [...mwc.children];
  function upd() {
    const { nh, act, inh } = sl.values;
    const K = K0 * (1 + inh) / (1 + act);
    const S = linspace(0, 12, 300);
    const hill = (s, n, k) => 100 * s ** n / (k ** n + s ** n);
    plot.set([
      { data: S.map((s) => [s, hill(s, 1, 1.6)]), color: '#9AA7B0', width: 1.6, dash: [2, 4], label: 'гіпербола Міхаеліса — Ментен (n = 1)' },
      { data: S.map((s) => [s, hill(s, nh, K0)]), color: '#0E3F4A', width: 2, dash: [7, 5], label: 'без ефекторів' },
      { data: S.map((s) => [s, hill(s, nh, K)]), color: act > inh ? '#14946B' : inh > act ? '#D0443A' : '#0E3F4A', width: 2.8, label: 'поточний стан', marker: [K, 50] },
    ], [{ y: 50, color: '#C9D3CC', dash: [2, 4] }]);
    const v4 = hill(4, nh, K);
    const r = Math.round(v4 / 25);
    subs.forEach((s, i) => s.classList.toggle('is-r', i < r));
    setOut(document, { ak: num(K, 2), ar: `${r} з 4`, av: num(v4, 0) + ' %' });
    $('al-note').innerHTML = act > inh ? 'Активатор стабілізує R-стан (кружечки): крива зсувається вліво, K<sub>0,5</sub> зменшується.' : inh > act ? 'Інгібітор стабілізує T-стан (квадрати): крива зсувається вправо, потрібна вища концентрація субстрату.' : 'Без ефекторів: S-подібна крива; при n<sub>H</sub> = 1 вона стає гіперболою.';
  }
  upd();
})();
