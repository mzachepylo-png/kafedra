// Частина 4. Трансгенні рослини в дослідженнях: інтерактивні блоки.
import { register, el, svg, options, stepper, clamp, lerp, rnd, $, $$, loop } from './util.js';
import { sliders } from '../ui.js';

const L4 = 'var(--l4)';
const tgl = (label, on, f) => { const b = el('button', { type: 'button', class: 'mg-opt', 'aria-pressed': String(on) }, label); b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); f(v); }); return b; };

// ------------------------------------------------------------------ делеційний аналіз промотора
register('promoter-del', (root) => {
  const ctl = el('div');
  const S = sliders(ctl, [{ id: 'd', label: 'Конструкція (серія вкорочених промоторів)', min: 0, max: 5, step: 1, value: 0, digits: 0, format: (v) => 'D' + v, hint: 'D0 — повний промотор; D5 — лише мінімальний (TATA).' }], draw);
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 270', role: 'img', 'aria-label': 'Делеційний аналіз промотора з репортером' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const els = [['дистальна ділянка', '#9C7BB8', 0], ['підсилювач', '#7B3FA0', 1], ['світлочутливий елемент', '#E9A825', 3], ['інший елемент', '#1565C0', 2], ['TATA', '#C0573E', 5]];
  function draw() {
    const d = Math.round(S.values.d);
    // порядок зліва направо: дистальна(0) підсилювач(1) інший(2) світло(3) TATA
    const parts = [['дистальна ділянка', '#9C7BB8', 1], ['підсилювач', '#7B3FA0', 2], ['інший регуляторний елемент', '#1565C0', 3], ['світлочутливий елемент', '#E9A825', 4], ['TATA-бокс', '#C0573E', 6]];
    let h = '<rect width="640" height="270" rx="14" fill="#FBFDFB"/><path d="M20 70 H620" stroke="#C9D7CB" stroke-width="3"/>';
    let x = 30;
    parts.forEach(([n, c, k]) => {
      const present = d < k; const w = n === 'TATA-бокс' ? 70 : 100;
      h += `<g opacity="${present ? 1 : .18}"><rect x="${x}" y="46" width="${w}" height="46" rx="8" fill="${c}" ${present ? '' : 'stroke-dasharray="5 4" stroke="#7A8A7E" fill-opacity=".25"'}/><text x="${x + w / 2}" y="${n.length > 14 ? 66 : 73}" text-anchor="middle" style="font:700 10.5px system-ui;fill:#fff">${n.length > 14 ? n.split(' ').slice(0, 2).join(' ') : n}</text>${n.length > 14 ? `<text x="${x + w / 2}" y="80" text-anchor="middle" style="font:700 10.5px system-ui;fill:#fff">${n.split(' ').slice(2).join(' ')}</text>` : ''}</g>`;
      x += w + 8;
    });
    h += `<rect x="${x + 4}" y="46" width="90" height="46" rx="8" fill="#2E7D32"/><text x="${x + 49}" y="73" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">репортер</text>`;
    // активність
    const dark = d < 2 ? 22 : d < 4 ? 10 : d < 6 ? 6 : 6; // темрява
    const light = d < 2 ? 100 : d < 4 ? 68 : d === 4 ? 12 : 4; // світло: втрата відповіді після видалення світлочутливого елемента (D4)
    const bar = (y, lbl, v, col) => `<text x="20" y="${y + 13}" class="mg-t" style="font-weight:700">${lbl}</text><rect x="150" y="${y}" width="450" height="18" rx="9" fill="#E6EDE6"/><rect x="150" y="${y}" width="${Math.max(3, v * 4.5)}" height="18" rx="9" fill="${col}"/><text x="${Math.min(595, 156 + v * 4.5)}" y="${y + 13}" class="mg-ts" style="font-weight:800" text-anchor="${v > 88 ? 'end' : 'start'}" fill="${v > 88 ? '#fff' : '#13241A'}">${v}</text>`;
    h += bar(140, '☀ на світлі', light, '#E9A825') + bar(172, '☾ у темряві', dark, '#7A8A7E');
    h += `<text x="20" y="226" class="mg-ts">Активність репортера, відносні одиниці (схема-ілюстрація принципу Нам-Хай Чуа для промотора rbcS).</text>`;
    sv.innerHTML = h;
    info.innerHTML = d < 4 ? '<p>Промотор ще містить світлочутливий елемент — на світлі активність висока, у темряві низька.</p>'
      : d === 4 ? '<p><b>Видалено ділянку, що відповідає за світлову активацію:</b> відповідь на світло зникає — рівень на світлі = рівню в темряві. Так за серією делецій знаходять потрібну ділянку.</p>'
        : '<p>Лишився мінімальний промотор: лише базальна транскрипція.</p>';
  }
  root.append(ctl, sv, info);
  draw();
});

// ------------------------------------------------------------------ репортери: порівняльна таблиця з фільтрами
register('reporters', (root) => {
  const R = [
    ['GUS', 'β-глюкуронідаза (<i>uidA</i>, <i>E. coli</i>)', { vivo: 0, sub: 0, inst: 1, off: 0 }, 'Субстрат X-Gluc → синя нерозчинна речовина там, де працював промотор. Об\'єкт треба <b>вбити</b> (фіксація, просвітлення): лише «моментальний знімок».'],
    ['GFP', 'зелений флуоресцентний білок (<i>Aequorea victoria</i>)', { vivo: 1, sub: 1, inst: 0, off: 0 }, 'Світиться під синім світлом, не вбиваючи об\'єкт; субстрату не треба. Надто сильне/часте збудливе світло токсичне. Є варіанти BFP/CFP/YFP/RFP, швидкодозрівальні та швидкодеградовані форми.'],
    ['Люцифераза світляка', 'ферментативне світіння', { vivo: 1, sub: 0, inst: 0, off: 1 }, 'Потрібно просочити рослину люциферином: у високих концентраціях токсичний, успіх залежить від рівномірності просочення. Дозволяє бачити динаміку.'],
    ['Грибна люцифераза', 'кофейна кислота → 3-гідроксигіспідин', { vivo: 1, sub: 1, inst: 0, off: 1 }, 'Треба перенести 3–4 грибні гени — і рослина світиться <b>автономно</b>, без субстрату. Світло в «зеленому провалі» хлорофілу. Показує фенольний метаболізм неінвазивно.'],
    ['RUBY', 'бетанінові пігменти (буряк)', { vivo: 1, sub: 1, inst: 1, off: 0 }, 'Три ферменти під 35S, розділені пептидами 2A → червоне забарвлення видно без приладів і хімікатів. Бетаніни накопичуються й не зникають: видно лише ввімкнення, не вимкнення.'],
  ];
  const Q = [['vivo', 'не вбиває об\'єкт (in vivo)'], ['sub', 'не потребує субстрату ззовні'], ['inst', 'видно без приладів'], ['off', 'видно й вимкнення (динаміка)']];
  const on = {};
  const chips = el('div', { class: 'mg-opts' });
  Q.forEach(([k, t]) => chips.append(tgl(t, false, (v) => { on[k] = v; draw(); })));
  const tbody = el('tbody');
  const tbl = el('div', { class: 'data-wrap' }, el('table', { class: 'data-table mg-table mg-rep' }, el('thead', null, el('tr', null, ...['Репортер', ...Q.map((q) => q[1]), 'Нотатка'].map((t) => el('th', null, t)))), tbody));
  function draw() {
    tbody.innerHTML = '';
    R.forEach((r) => {
      const ok = Q.every(([k]) => !on[k] || r[2][k]);
      const tr = el('tr', { class: ok ? '' : 'is-off' });
      tr.append(el('th', { scope: 'row', html: `${r[0]}<small>${r[1]}</small>` }));
      Q.forEach(([k]) => tr.append(el('td', { class: r[2][k] ? 'yes' : 'no' }, r[2][k] ? '✔' : '✘')));
      tr.append(el('td', { html: r[3] }));
      tbody.append(tr);
    });
  }
  root.append(el('div', { class: 'mg-ts', style: 'font-weight:700;margin-bottom:6px' }, 'Що мені потрібно від репортера?'), chips, tbl);
  draw();
});

// ------------------------------------------------------------------ флуоресцентні білки + FRET
register('fp-fret', (root) => {
  const FP = [['BFP', 450, '#3F51B5', 'синій; Tyr→His у хромофорі'], ['CFP', 475, '#00BCD4', 'ціановий; Tyr→Trp'], ['GFP', 510, '#4CAF50', 'зелений; хромофор із трьох амінокислот'], ['YFP', 530, '#CDDC39', 'жовтий; додаткова електронна густина'], ['RFP / DsRed', 583, '#F44336', 'червоний; з корала <i>Discosoma</i>']];
  const spec = el('div', { class: 'mg-spec' });
  FP.forEach(([n, nm, c, t]) => { const x = (nm - 420) / 200 * 100; spec.append(el('button', { type: 'button', class: 'mg-spec__m', style: `left:${x}%;--c:${c}`, title: t, html: `<i></i><b>${n}</b><small>~${nm} нм</small>` })); });
  const info = el('div', { class: 'mg-info' }, 'Натискайте на маркери: піки емісії варіантів флуоресцентних білків (значення наближені).');
  $$('.mg-spec__m', spec).forEach((b, i) => b.addEventListener('click', () => { info.innerHTML = `<h4>${FP[i][0]} · ~${FP[i][1]} нм</h4><p>${FP[i][3]}. Два різні білки дозволяють стежити одразу за двома процесами.</p>`; }));
  const ctl = el('div');
  const S = sliders(ctl, [{ id: 'r', label: 'FRET: відстань між CFP (донор) і YFP (акцептор)', min: 2, max: 10, step: 0.1, value: 4, unit: 'нм', digits: 1, hint: 'Передача енергії працює лише за контакту білків: ефективність ~ 1/(1+(r/R₀)⁶), R₀ ≈ 5 нм.' }], drawF);
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 150', role: 'img', 'aria-label': 'Схема FRET між CFP і YFP' });
  const fi = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function drawF() {
    const r = S.values.r; const E = 1 / (1 + Math.pow(r / 5, 6));
    const x1 = 320 - r * 22, x2 = 320 + r * 22;
    sv.innerHTML = `<rect width="640" height="150" rx="14" fill="#FBFDFB"/>
      <circle cx="${x1}" cy="76" r="30" fill="#00BCD4" opacity="${(0.25 + 0.75 * (1 - E)).toFixed(2)}"/><text x="${x1}" y="81" text-anchor="middle" class="mg-tb">CFP</text>
      <circle cx="${x2}" cy="76" r="30" fill="#CDDC39" opacity="${(0.25 + 0.75 * E).toFixed(2)}"/><text x="${x2}" y="81" text-anchor="middle" class="mg-tb">YFP</text>
      <path d="M${x1 + 32} 76 H${x2 - 32}" stroke="#7B3FA0" stroke-width="${(1 + 5 * E).toFixed(1)}" stroke-dasharray="6 5" opacity="${(0.15 + 0.85 * E).toFixed(2)}" marker-end="url(#mg-arr)"/>
      <text x="320" y="30" text-anchor="middle" class="mg-t" style="font-weight:700">світло збудження ~430 нм → CFP</text>
      <text x="320" y="132" text-anchor="middle" class="mg-t">ефективність передачі енергії ≈ ${Math.round(E * 100)} %</text>`;
    fi.innerHTML = E > .5 ? '<p><b>Білки близько:</b> енергія з CFP переходить на YFP — світиться <b>жовтий</b>: взаємодія молекул виявлена.</p>' : '<p><b>Білки далеко:</b> передачі енергії немає — світиться <b>ціановий</b> CFP.</p>';
  }
  root.append(spec, info, el('hr', { style: 'border:0;border-top:1px solid var(--line);margin:14px 0' }), ctl, sv, fi);
  drawF();
});

// ------------------------------------------------------------------ система двох ліній (драйвер × таргет)
register('lhg4', (root) => {
  let mode = 'f1';
  const row = el('div', { class: 'mg-opts' });
  options(row, [{ v: 'drv', t: 'Лінія-драйвер' }, { v: 'tgt', t: 'Таргетна лінія' }, { v: 'f1', t: 'F₁ = драйвер × таргет' }], 'f1', (v) => { mode = v; draw(); });
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Двокомпонентна система: драйвер і таргет' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function flower(cx, cy, on) {
    let h = `<g transform="translate(${cx} ${cy})">`;
    h += `<circle r="70" fill="#BFE3A5" stroke="#4E8A36" stroke-width="2"/><circle r="52" fill="${on ? '#E8A0A0' : '#FBE3EE'}" stroke="#C2415C" stroke-width="2"/><circle r="34" fill="${on ? '#E8A0A0' : '#F6E58C'}" stroke="#B08A1E" stroke-width="2"/><circle r="15" fill="#A8D58A" stroke="#4E8A36" stroke-width="2"/>`;
    if (on) h += `<text y="94" text-anchor="middle" class="mg-ts" style="fill:#C0573E;font-weight:800">AG там, де промотор AP3: нема пелюсток, розвиток зупинено</text>`;
    else h += `<text y="94" text-anchor="middle" class="mg-ts">нормальна квітка</text>`;
    return h + '</g>';
  }
  function draw() {
    const d = mode !== 'tgt', t = mode !== 'drv', on = d && t;
    let h = '<rect width="640" height="300" rx="14" fill="#FBFDFB"/>';
    if (d) h += `<g><rect x="20" y="24" width="150" height="34" rx="8" fill="#7B3FA0"/><text x="95" y="46" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">pAP3 (промотор)</text><rect x="172" y="24" width="190" height="34" rx="8" fill="#E9A825"/><text x="267" y="46" text-anchor="middle" style="font:800 11px system-ui">химерний активатор (lac-репресор без репресії)</text></g>`;
    if (t) h += `<g><rect x="380" y="24" width="120" height="34" rx="8" fill="#1565C0"/><text x="440" y="46" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">lac-оператор × n</text><rect x="502" y="24" width="120" height="34" rx="8" fill="#2E7D32"/><text x="562" y="46" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">AGAMOUS</text></g>`;
    if (on) h += `<path d="M267 60 C300 90 380 90 440 60" stroke="#C0573E" stroke-width="2.5" fill="none" marker-end="url(#mg-arr)"/><text x="354" y="96" text-anchor="middle" class="mg-ts" style="fill:#C0573E;font-weight:800">активатор зв'язує оператор</text>`;
    h += flower(320, 190, on);
    sv.innerHTML = h;
    info.innerHTML = mode === 'drv' ? '<p><b>Лише драйвер:</b> активатор є, але оператора в геномі рослин немає — нічого не відбувається; гена <i>AG</i> немає.</p>'
      : mode === 'tgt' ? '<p><b>Лише таргет:</b> ген <i>AG</i> перед оператором мовчить: без активатора експресії немає (корисно, коли білок токсичний — лінія мирно розмножується).</p>'
        : '<p><b>Покоління F₁:</b> активатор під промотором <i>AP3</i> вмикає <i>AG</i> там, де працює <i>AP3</i> → втрата пелюсток і чашолистків, зупинка розвитку квітки. Система корисна для слабких промоторів і для небезпечних для рослини генів.</p>';
  }
  root.append(row, sv, info);
  draw();
});

// ------------------------------------------------------------------ індуковані системи
register('inducible', (root) => {
  const SYS = {
    hsp: { n: 'Тепловий шок (HSP)', ind: 'нагрівання до ~37–40 °C', info: 'Промотор білків теплового шоку (напр., <i>HSP18.2</i>): ФТ <b>HSF</b> зв\'язує елементи <b>HSE</b>. Недолік — «підтікання» (leaky): за норми теж потрібно трохи HSP. Можна нагріти навіть окремі клітини лазером. Застосування: ген флоригену (<i>FT</i>) під HSP-промотором в евкаліпта — кілька годин нагрівання → квітки за ~9 тижнів.', slider: [20, 42, 22, '°C', 37], leak: 6 },
    cor: { n: 'Холодовий стрес (COR)', ind: 'охолодження до ~0–5 °C', info: 'Білки холодового стресу: ФТ типу AP2/EREBP (CBF/DREB); частково перекривається з відповіддю на посуху; антифризні білки проти кристалів льоду.', slider: [0, 25, 22, '°C', 5, true], leak: 4 },
    gr: { n: 'Глюкокортикоїдна (GR)', ind: 'дексаметазон', info: 'Химера (lac-зв\'язування + GR-домен + активатор): без гормону зв\'язана з HSP90 у цитозолі й не йде в ядро; дексаметазон → звільнення → ядро → експресія. Приклад: подвійний мутант <i>gl1 gl3</i> (голий лист) + <i>pLGL3::GR-GL3</i>: через 4 год після обробки — нові трихоми, через 7 днів — нові листки, суцільно вкриті волосками.', leak: 0 },
    er: { n: 'Естрогенна (ER)', ind: 'естроген', info: 'Те саме, але рецептор — людський ER. Естрогеном можна «намалювати» літери й побачити локальну експресію. Недолік тваринних гормонів: повільна дифузія, бар\'єри — реакція не охоплює всю рослину одночасно.', leak: 0 },
    alc: { n: 'Етанол-індукована (Alc)', ind: 'пари/полив спиртом', info: 'ФТ <b>AlcR</b> + промотор алкогольдегідрогенази <i>alcA</i> з <i>Aspergillus</i>: реагує на етанол; <b>швидко</b> поширюється по рослині; лінійна відповідь у певному діапазоні.', leak: 0 },
    tet: { n: 'Тетрациклінова (Tet)', ind: 'тетрациклін', info: 'Активатор або репресор, злитий із tet-рецептором: з тетрацикліном ген вмикається (Tet-ON) або вимикається (Tet-OFF).', leak: 0, tet: true },
  };
  let k = 'hsp', inducer = false, temp = 22, tetMode = 'on';
  const tabs = el('div', { class: 'mg-opts' });
  options(tabs, Object.entries(SYS).map(([v, s]) => ({ v, t: s.n })), 'hsp', (v) => { k = v; inducer = false; draw(); });
  const ctl = el('div', { class: 'mg-row' });
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 230', role: 'img', 'aria-label': 'Схема індукованої системи експресії' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  root.append(tabs, ctl, sv, info);
  function draw() {
    const s = SYS[k]; ctl.innerHTML = '';
    let expr;
    if (s.slider) {
      const [mn, mx, v0, u, thr, inv] = s.slider; if (k === 'cor' && temp > 25) temp = 22; if (k === 'hsp' && temp < 20) temp = 22;
      const wrap = el('div', { style: 'min-width:260px' }); const sl = sliders(wrap, [{ id: 't', label: 'Температура', min: mn, max: mx, step: 1, value: clamp(temp, mn, mx), unit: u, digits: 0 }], () => { temp = sl.values.t; draw2(); });
      ctl.append(wrap); temp = sl.values.t; function draw2() { const t = temp; const on = inv ? t <= thr : t >= thr; paint(on, s.leak); } draw2(); return;
    }
    const b = el('button', { type: 'button', class: 'mg-btn', 'aria-pressed': String(inducer) }, inducer ? `✔ ${s.ind} додано` : `+ Додати індуктор: ${s.ind}`);
    b.addEventListener('click', () => { inducer = !inducer; draw(); });
    ctl.append(b);
    if (s.tet) { const o = el('div', { class: 'mg-opts', style: 'margin:0' }); options(o, [{ v: 'on', t: 'Tet-ON' }, { v: 'off', t: 'Tet-OFF' }], tetMode, (v) => { tetMode = v; draw(); }); ctl.append(o); }
    expr = s.tet ? (tetMode === 'on' ? inducer : !inducer) : inducer;
    paint(expr, s.leak);
  }
  function paint(on, leak) {
    const s = SYS[k]; const lv = on ? 100 : leak;
    let h = '<rect width="640" height="230" rx="14" fill="#FBFDFB"/>';
    h += '<ellipse cx="170" cy="108" rx="130" ry="84" fill="#F4FAEE" stroke="#9CC27A" stroke-width="3"/><text x="170" y="34" text-anchor="middle" class="mg-ts">цитоплазма</text>';
    h += '<circle cx="450" cy="108" r="84" fill="#EFE6FB" stroke="#7B3FA0" stroke-width="3"/><text x="450" y="34" text-anchor="middle" class="mg-ts">ядро</text>';
    h += `<rect x="340" y="150" width="76" height="26" rx="6" fill="#7B3FA0"/><text x="378" y="167" text-anchor="middle" style="font:700 10px system-ui;fill:#fff">промотор</text><rect x="416" y="150" width="86" height="26" rx="6" fill="${on ? '#2E7D32' : '#9AA79D'}"/><text x="459" y="167" text-anchor="middle" style="font:700 10px system-ui;fill:#fff">ген</text><path d="M330 176 H520" stroke="#4A78C8" stroke-width="3"/>`;
    const recept = (x, y, inn) => `<g><ellipse cx="${x}" cy="${y}" rx="38" ry="17" fill="#E9A825"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="font:800 10px system-ui">${inn}</text></g>`;
    if (k === 'gr' || k === 'er') {
      const lab = k === 'gr' ? 'GR-активатор' : 'ER-активатор';
      if (!on) h += recept(140, 120, lab) + `<ellipse cx="140" cy="164" rx="34" ry="15" fill="#C0573E"/><text x="140" y="168" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">HSP90</text><text x="140" y="196" text-anchor="middle" class="mg-ts">утримується в цитозолі</text>`;
      else h += `<circle cx="110" cy="100" r="8" fill="#7B3FA0"/><text x="110" y="84" text-anchor="middle" class="mg-ts" style="font-weight:800">${k === 'gr' ? 'дексаметазон' : 'естроген'}</text>` + recept(400, 120, lab) + '<path d="M180 118 C250 118 320 118 356 120" stroke="#46584C" stroke-width="2" stroke-dasharray="5 4" fill="none" marker-end="url(#mg-arr)"/><path d="M400 138 V148" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/>';
    } else if (k === 'hsp' || k === 'cor') {
      const lab = k === 'hsp' ? 'HSF' : 'CBF/DREB';
      h += `<circle cx="150" cy="115" r="30" fill="${on ? '#C0573E' : '#CFD8D1'}"/><text x="150" y="119" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">${on ? (k === 'hsp' ? '37–40 °C' : '0–5 °C') : 'норма'}</text>`;
      if (on) h += recept(400, 120, lab) + '<path d="M180 118 C250 118 320 118 356 120" stroke="#46584C" stroke-width="2" stroke-dasharray="5 4" fill="none" marker-end="url(#mg-arr)"/><path d="M400 138 V148" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/>';
    } else if (k === 'alc') {
      h += `<ellipse cx="400" cy="100" rx="40" ry="17" fill="#1565C0"/><text x="400" y="104" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">AlcR</text>`;
      if (on) h += `<circle cx="110" cy="100" r="9" fill="#E9A825"/><text x="110" y="84" text-anchor="middle" class="mg-ts" style="font-weight:800">етанол</text><path d="M120 104 C220 110 300 108 356 104" stroke="#46584C" stroke-width="2" stroke-dasharray="5 4" fill="none" marker-end="url(#mg-arr)"/><path d="M400 118 V148" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/><text x="170" y="196" text-anchor="middle" class="mg-ts">швидко поширюється по всій рослині</text>`;
    } else {
      const act = tetMode === 'on';
      h += `<ellipse cx="400" cy="100" rx="52" ry="17" fill="${act ? '#2E7D32' : '#C0573E'}"/><text x="400" y="104" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">tet-${act ? 'активатор' : 'репресор'}</text>`;
      if (inducer) h += `<circle cx="110" cy="100" r="9" fill="#E9A825"/><text x="110" y="84" text-anchor="middle" class="mg-ts" style="font-weight:800">тетрациклін</text><path d="M120 104 C220 110 300 108 346 104" stroke="#46584C" stroke-width="2" stroke-dasharray="5 4" fill="none" marker-end="url(#mg-arr)"/>`;
    }
    h += `<rect x="30" y="206" width="580" height="12" rx="6" fill="#E6EDE6"/><rect x="30" y="206" width="${Math.max(4, lv * 5.8)}" height="12" rx="6" fill="${on ? '#2E7D32' : '#9AA79D'}"/>`;
    sv.innerHTML = h;
    info.innerHTML = `<h4>${s.n}</h4><p>Експресія: <b>${on ? 'ввімкнена' : lv ? 'базальна («підтікання» ~' + lv + ' %)' : 'вимкнена'}</b>. ${s.info}</p>` + (k !== 'hsp' && k !== 'cor' ? '<p><small>Чужорідні (рослинам невластиві) системи не дають «підтікання», на відміну від власних промоторів.</small></p>' : '');
  }
  draw();
});

// ------------------------------------------------------------------ RNAi
register('rnai', (root) => {
  const ST = [
    ['Конструкція', 'Кодувальну частину гена (або її фрагмент) під сильним промотором (35S) ставлять у двох орієнтаціях — з інвертованим повтором у кінці. Достатньо навіть ~13–25 нт гомології.'],
    ['Шпилькова РНК', 'Транскрипт складається в шпильку: двоколанцюгова ділянка (dsRNA) з петлею.'],
    ['Dicer ріже на siRNA', 'Небажана дволанцюгова РНК ріжеться на фрагменти <b>21–23 нт</b> (siRNA) ферментом Dicer.'],
    ['RISC / Argonaute', 'Одна з ниток siRNA завантажується в комплекс <b>RISC</b> (компонент — Argonaute) і слугує «еталоном».'],
    ['Руйнування мРНК', 'Усі РНК із цією послідовністю розпізнаються й руйнуються — білок не синтезується. Експресія знижується (часто не до нуля).'],
    ['Поширення сигналу', 'siRNA переносяться плазмодесмами в сусідні клітини — сайленсингом охоплюються цілі органи чи рослина; також діють на рівні ДНК (метилювання, ремоделювання хроматину).'],
  ];
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 230', role: 'img', 'aria-label': 'Механізм РНК-інтерференції' });
  const cap = el('div', { class: 'mg-info', 'aria-live': 'polite' }); const bar = el('div');
  function scene(i) {
    let h = '<rect width="640" height="230" rx="14" fill="#FBFDFB"/>';
    if (i === 0) h += `<rect x="30" y="80" width="90" height="34" rx="8" fill="#7B3FA0"/><text x="75" y="102" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">35S</text><rect x="124" y="80" width="170" height="34" rx="8" fill="#2E7D32"/><text x="209" y="102" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">фрагмент гена →</text><rect x="298" y="80" width="170" height="34" rx="8" fill="#C0573E"/><text x="383" y="102" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">← інвертований повтор</text><rect x="472" y="80" width="90" height="34" rx="8" fill="#9AA79D"/><text x="517" y="102" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">термінатор</text><text x="320" y="150" text-anchor="middle" class="mg-t">під сильним промотором; повтор у кінці дає шпильку на 3′-кінці РНК</text>`;
    if (i === 1) h += `<path d="M110 150 H330" stroke="#2E7D32" stroke-width="5" stroke-linecap="round"/><path d="M110 170 H330" stroke="#C0573E" stroke-width="5" stroke-linecap="round"/><path d="M330 150 q40 10 0 20" fill="none" stroke="#7A8A7E" stroke-width="5"/><text x="400" y="166" class="mg-t" style="font-weight:800">шпилькова dsRNA</text>`;
    if (i === 2) h += `<g>${[0, 1, 2, 3].map((k) => `<path d="M${90 + k * 130} 100 h60" stroke="#2E7D32" stroke-width="5" stroke-linecap="round"/><path d="M${90 + k * 130} 114 h60" stroke="#C0573E" stroke-width="5" stroke-linecap="round"/>`).join('')}</g><ellipse cx="320" cy="50" rx="52" ry="20" fill="#E9A825"/><text x="320" y="54" text-anchor="middle" style="font:800 12px system-ui">Dicer ✂</text><text x="320" y="170" text-anchor="middle" class="mg-t" style="font-weight:700">siRNA 21–23 нт</text>`;
    if (i >= 3 && i <= 4) h += `<ellipse cx="170" cy="100" rx="90" ry="48" fill="#EFE6FB" stroke="#7B3FA0" stroke-width="3"/><text x="170" y="96" text-anchor="middle" class="mg-tb" style="fill:#4A2A7A">RISC</text><text x="170" y="114" text-anchor="middle" class="mg-ts">Argonaute</text><path d="M120 134 h100" stroke="#2E7D32" stroke-width="5" stroke-linecap="round"/>`;
    if (i === 4) h += `<path d="M300 100 q10 -16 20 0 t20 0 t20 0 t20 0" fill="none" stroke="#C2415C" stroke-width="3"/><text x="380" y="126" text-anchor="middle" class="mg-ts">мРНК-мішень</text><path d="M356 74 L364 128" stroke="#13241A" stroke-width="3"/><text x="364" y="66" text-anchor="middle" class="mg-t" style="font-weight:800;fill:#C0573E">розріз → деградація</text><text x="320" y="200" text-anchor="middle" class="mg-tb" style="fill:#C0573E">білка немає</text>`;
    if (i === 5) h += `${[0, 1, 2].map((k) => `<rect x="${30 + k * 205}" y="64" width="175" height="100" rx="14" fill="#F4FAEE" stroke="#9CC27A" stroke-width="3"/><circle cx="${117 + k * 205}" cy="114" r="${k === 0 ? 14 : 12}" fill="${k === 0 ? '#7B3FA0' : '#C9B5E0'}"/>`).join('')}<path d="M205 114 H235 M410 114 H440" stroke="#2E7D32" stroke-width="3" stroke-dasharray="3 4" marker-end="url(#mg-arr)"/><text x="320" y="190" text-anchor="middle" class="mg-t" style="font-weight:700">siRNA рухаються плазмодесмами: сайленсинг охоплює орган чи всю рослину</text>`;
    sv.innerHTML = h;
    cap.innerHTML = `<h4>Крок ${i + 1}. ${ST[i][0]}</h4><p>${ST[i][1]}</p>`;
  }
  root.append(bar, sv, cap);
  stepper(bar, ST.length, scene, { lc: L4 });
});

// ------------------------------------------------------------------ дегрони
register('degron', (root) => {
  let aux = true, stab = false;
  const row = el('div', { class: 'mg-opts' }, tgl('Ауксин доданий', true, (v) => { aux = v; draw(); }), tgl('Стабілізований дегрон (контроль)', false, (v) => { stab = v; draw(); }));
  const ctl = el('div');
  const S = sliders(ctl, [{ id: 't', label: 'Час після додавання ауксину', min: 0, max: 120, step: 1, value: 0, unit: 'хв', digits: 0 }], draw);
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 270', role: 'img', 'aria-label': 'Деградація Venus-дегрон-білка під дією ауксину' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const level = (t, a, s) => (a && !s ? Math.exp(-t / 14) : 1);
  function draw() {
    const t = S.values.t; const lv = level(t, aux, stab);
    let h = '<rect width="640" height="270" rx="14" fill="#FBFDFB"/>';
    // ядра
    for (let i = 0; i < 18; i++) { const x = 40 + (i % 6) * 40, y = 34 + Math.floor(i / 6) * 40; const j = 0.8 + ((i * 37) % 10) / 25; h += `<circle cx="${x}" cy="${y}" r="13" fill="#F4F0A0" stroke="#B9B24A" stroke-width="1.5" opacity="${Math.min(1, 0.08 + lv * j * 0.92).toFixed(2)}"/>`; }
    h += '<text x="150" y="168" text-anchor="middle" class="mg-ts">ядра: жовтий сигнал Venus-дегрон</text>';
    // графік
    h += '<g transform="translate(330 20)"><rect width="290" height="170" rx="8" fill="#fff" stroke="#DCE6DC"/><path d="M30 14 V140 H276" stroke="#7A8A7E" fill="none"/>';
    const pts = (a, s) => Array.from({ length: 41 }, (_, i) => { const tt = i * 3; return `${30 + tt / 120 * 246},${140 - level(tt, a, s) * 120}`; }).join(' ');
    h += `<polyline points="${pts(true, false)}" fill="none" stroke="#C0573E" stroke-width="2.5"/><polyline points="${pts(true, true)}" fill="none" stroke="#2E7D32" stroke-width="2.5" stroke-dasharray="6 4"/><polyline points="${pts(false, false)}" fill="none" stroke="#9AA79D" stroke-width="2" stroke-dasharray="2 4"/>`;
    h += `<circle cx="${30 + t / 120 * 246}" cy="${140 - lv * 120}" r="5.5" fill="#13241A"/><text x="153" y="162" text-anchor="middle" class="mg-ts">час, хв</text><text x="8" y="80" class="mg-ts" transform="rotate(-90 8 80)">Venus</text>`;
    h += '<text x="120" y="96" class="mg-ts" style="fill:#C0573E;font-weight:800">━ дегрон + ауксин</text><text x="120" y="110" class="mg-ts" style="fill:#2E7D32;font-weight:800">╍ стабілізований дегрон</text><text x="120" y="124" class="mg-ts">┈ без ауксину</text></g>';
    h += `<text x="320" y="230" text-anchor="middle" class="mg-tb">Залишок білка: ${Math.round(lv * 100)} %</text>`;
    sv.innerHTML = h;
    info.innerHTML = '<p>У присутності ауксину degron Aux/IAA впізнається убіквітин-лігазою <b>SCF<sup>TIR1</sup></b> (TIR1 — рецептор ауксину) → убіквітинування → протеасома. Якщо до білка-мішені «пришити» degron, він деградуватиме за наявності ауксину. Замінюючи degron, так само стежать за гіберелінами чи жасмонатами (біосенсори).</p>';
  }
  root.append(row, ctl, sv, info);
  draw();
});

// ------------------------------------------------------------------ барназа/барстар
register('barnase', (root) => {
  const S = { A: true, R: false };
  const row = el('div', { class: 'mg-opts' }, tgl('Лінія А: барназа під промотором тапетуму', true, (v) => { S.A = v; draw(); }), tgl('Лінія-відновник (Rf): барстар', false, (v) => { S.R = v; draw(); }));
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 250', role: 'img', 'aria-label': 'Пиляк з тапетумом: барназа руйнує, барстар захищає' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function draw() {
    const dead = S.A && !S.R;
    let h = '<rect width="640" height="250" rx="14" fill="#FBFDFB"/>';
    h += `<g transform="translate(200 118)"><circle r="86" fill="#FFF8E3" stroke="#B08A1E" stroke-width="3"/><circle r="66" fill="${dead ? '#E0C8C0' : '#B8D99C'}" stroke="${dead ? '#C0573E' : '#4E8A36'}" stroke-width="${dead ? 2 : 10}" stroke-dasharray="${dead ? '6 6' : '0'}"/><circle r="44" fill="#FBF3D9"/>`;
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; h += `<circle cx="${Math.cos(a) * 24}" cy="${Math.sin(a) * 24}" r="7" fill="${dead ? '#B7A89B' : '#E9A825'}" ${dead ? 'opacity=".6"' : ''}/>`; }
    h += `<text y="108" text-anchor="middle" class="mg-ts">тапетум — шар живлення пилку</text></g>`;
    h += `<g transform="translate(450 70)"><text x="0" y="0" class="mg-tb">Стан пиляка</text><text x="0" y="24" class="mg-tb" style="font-size:15px;fill:${dead ? '#C0573E' : '#2E7D32'}">${dead ? 'чоловіча стерильність' : 'фертильний'}</text>`;
    h += `<g transform="translate(0 46)">${S.A ? '<rect width="146" height="26" rx="13" fill="#C0573E"/><text x="73" y="17" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">барназа (РНКаза)</text>' : '<text y="17" class="mg-ts">барназа відсутня</text>'}</g>`;
    h += `<g transform="translate(0 82)">${S.R ? '<rect width="146" height="26" rx="13" fill="#2E7D32"/><text x="73" y="17" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">барстар (інгібітор)</text>' : '<text y="17" class="mg-ts">барстара немає</text>'}</g>`;
    if (S.A && S.R) h += `<text y="150" class="mg-ts" style="fill:#2E7D32;font-weight:800">барстар закриває активний</text><text y="164" class="mg-ts" style="fill:#2E7D32;font-weight:800">центр барнази: комплекс, клітини живі</text>`;
    h += '</g>';
    sv.innerHTML = h;
    info.innerHTML = dead ? '<p><b>Лінія А (барназа у тапетумі, промотор гена тапетуму з гороху):</b> відмирають лише тканини пиляка — тичинкова нитка ціла. Рослина не здатна до самозапилення — зручна материнська форма для гібридів F₁.</p>'
      : S.A && S.R ? '<p><b>Нащадки F₁ (лінія А × відновник):</b> барназа + барстар «склеюються», РНКаза вимкнена — фертильність відновлено. Так отримують гібриди F₁ з чоловічою стерильністю материнської лінії.</p>'
        : '<p><b>Без барназа:</b> пиляк нормальний.</p>';
  }
  root.append(row, sv, info);
  draw();
});

register('terminator', (root) => {
  const ST = [
    ['Насіннєва компанія обробляє насіння тетрацикліном', 'У конструкції є tet-індукований активатор.'],
    ['Рекомбіназа вирізає спейсер', 'Після обробки тетрацикліном рекомбіназа видаляє спейсер між промотором і геном.'],
    ['Промотор пізнього ембріогенезу вмикає RIP', 'Білок, що інгібує рибосоми (RIP), вмикається під час формування насіння.'],
    ['Зародок у зібраному урожаї гине', 'Фермер не може висіяти власне насіння — воно не проростає. Технологія викликає етичні заперечення (доступність продовольства для країн, що розвиваються).'],
  ];
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 120', role: 'img', 'aria-label': 'Каскад генетичного термінатора' });
  const cap = el('div', { class: 'mg-info', 'aria-live': 'polite' }); const bar = el('div');
  function scene(i) {
    const cols = ['#E9A825', '#C0573E', '#7B3FA0', '#2E7D32'];
    let h = '<rect width="640" height="120" rx="14" fill="#FBFDFB"/>';
    ST.forEach((s, k) => { const x = 20 + k * 155; const a = k <= i; h += `<rect x="${x}" y="30" width="140" height="60" rx="12" fill="${a ? cols[k] : '#E6EDE6'}"/><text x="${x + 70}" y="66" text-anchor="middle" style="font:800 12px system-ui;fill:${a ? '#fff' : '#7A8A7E'}">${['tet', 'рекомбіназа', 'LEA → RIP', 'мертвий зародок'][k]}</text>${k < 3 ? `<path d="M${x + 142} 60 h12" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/>` : ''}`; });
    sv.innerHTML = h;
    cap.innerHTML = `<h4>${i + 1}. ${ST[i][0]}</h4><p>${ST[i][1]}</p>`;
  }
  root.append(bar, sv, cap);
  stepper(bar, ST.length, scene, { lc: L4 });
});

// ------------------------------------------------------------------ CRISPR: нокаут, нокін, dCas9, редактор основ
register('crispr', (root) => {
  const SEQ = 'ATGGCTCAAGGATTCGAGCCATGGACAGGTGAATCGTTAAACTGA';
  const CODON = { TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L', CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L', ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M', GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V', TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S', CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P', ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T', GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A', TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*', CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q', AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K', GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E', TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W', CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R', AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R', GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G' };
  const prot = (s) => { let o = ''; for (let i = 0; i + 3 <= s.length; i += 3) { const a = CODON[s.slice(i, i + 3)] || '?'; o += a; if (a === '*') break; } return o; };
  const modes = [['ko', 'Нокаут (NHEJ)'], ['ki', 'Нокін (HDR)'], ['dcas', 'dCas9 як платформа'], ['be', 'Редактор основ']];
  let mode = 'ko', edit = 'del1';
  const tabs = el('div', { class: 'mg-opts' });
  options(tabs, modes.map(([v, t]) => ({ v, t })), 'ko', (v) => { mode = v; draw(); });
  const body = el('div');
  root.append(tabs, body);
  const seqRow = (s, hl = {}, label = '') => `<div class="mg-seq"><span class="mg-seq__l">${label}</span>${[...s].map((c, i) => `<i class="${hl[i] || ''}">${c}</i>`).join('')}</div>`;
  const aaRow = (s, label = 'білок') => { const p = prot(s); let h = `<div class="mg-seq mg-seq--aa"><span class="mg-seq__l">${label}</span>`; for (let i = 0; i < p.length; i++) h += `<b class="${p[i] === '*' ? 'stop' : ''}" style="grid-column:span 3">${p[i]}</b>`; return h + '</div>'; };
  function draw() {
    body.innerHTML = '';
    if (mode === 'ko') {
      const cut = 18; // розріз між позиціями 17 і 18: за 3 нт до PAM (TGG, позиції 21–23); протоспейсер — 1–20
      const ed = el('div', { class: 'mg-opts' });
      options(ed, [{ v: 'del1', t: '−1 нт (зсув рамки)' }, { v: 'ins1', t: '+1 нт (зсув рамки)' }, { v: 'del3', t: '−3 нт (рамка збережена)' }], edit, (v) => { edit = v; draw(); });
      let out = SEQ;
      if (edit === 'del1') out = SEQ.slice(0, 17) + SEQ.slice(18); else if (edit === 'ins1') out = SEQ.slice(0, cut) + 'A' + SEQ.slice(cut); else out = SEQ.slice(0, 15) + SEQ.slice(18);
      const hl0 = {}; for (let i = 1; i <= 20; i++) hl0[i] = 'g'; for (let i = 21; i <= 23; i++) hl0[i] = 'pam'; hl0[17] = 'g cut';
      const o = prot(SEQ), n = prot(out);
      body.append(el('div', { class: 'mg-info', html: '<p>Гідова РНК (синя смуга) знаходить ціль за гомологією; поряд — PAM (жовтий). Cas9 вносить дволанцюговий розріз за ~3 нт від PAM. У рослин розрив зшивається переважно <b>негомологічним з\'єднанням кінців (NHEJ)</b> — втрати/вставки нуклеотидів.</p>' }), ed,
        el('div', { class: 'mg-seqbox', html: `<div class="mg-cut">✂ розріз Cas9 — між 17-м і 18-м нт (3 нт від PAM)</div>${seqRow(SEQ, hl0, 'ДНК до')}${aaRow(SEQ, 'білок до')}<div class="mg-arrow">▼ ${edit === 'del1' ? 'делеція 1 нт' : edit === 'ins1' ? 'вставка 1 нт' : 'делеція 3 нт'}</div>${seqRow(out, {}, 'ДНК після')}${aaRow(out, 'білок після')}` }),
        el('div', { class: 'mg-info', html: edit === 'del3' ? '<p><b>Рамка збережена:</b> випала одна амінокислота (Glu), решта білка недоторкана — нокауту може не бути.</p>' : `<p><b>Зсув рамки → змінена амінокислотна послідовність → передчасний стоп-кодон:</b> білок вкорочено з ${o.length - 1} до ${n.length - 1} а. к. — це <b>нокаут</b> гена. Прицільно, на відміну від хімічного/радіаційного мутагенезу.</p>` }));
    } else if (mode === 'ki') {
      const st = el('div'); const bar = el('div'); body.append(bar, st);
      const ST = [['Два gRNA вирізають ділянку', 'Два розрізи видаляють фрагмент гена.'], ['Донорна ДНК з плечима гомології', 'Поруч — донор із новою послідовністю, обрамленою ділянками, гомологічними сусідам розрізу. Для гомологічної репарації підвищують копійність донора (гемінівірусні реплікони, генна гармата).'], ['Гомологічна репарація (HDR) — нокін', 'HDR у рослин трапляється рідше за NHEJ, але вставляє нову послідовність точно на місце.']];
      const sc = (i) => {
        let h = '<svg class="mg-svg" viewBox="0 0 640 170"><rect width="640" height="170" rx="14" fill="#FBFDFB"/>';
        h += '<path d="M20 70 H620" stroke="#4A78C8" stroke-width="4"/>';
        h += `<rect x="40" y="50" width="170" height="40" rx="8" fill="#9AA79D"/><text x="125" y="75" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">ліве плече</text><rect x="430" y="50" width="170" height="40" rx="8" fill="#9AA79D"/><text x="515" y="75" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">праве плече</text>`;
        if (i === 0) h += '<rect x="220" y="50" width="200" height="40" rx="8" fill="#C0573E"/><text x="320" y="75" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">стара ділянка</text><path d="M214 36 V104 M426 36 V104" stroke="#13241A" stroke-width="3"/><text x="214" y="28" text-anchor="middle" class="mg-ts">gRNA 1 ✂</text><text x="426" y="28" text-anchor="middle" class="mg-ts">gRNA 2 ✂</text>';
        if (i === 1) h += '<rect x="240" y="120" width="160" height="34" rx="8" fill="#2E7D32"/><text x="320" y="142" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">нова послідовність</text><rect x="190" y="120" width="48" height="34" rx="8" fill="#9AA79D"/><rect x="402" y="120" width="48" height="34" rx="8" fill="#9AA79D"/><path d="M214 114 V92 M426 114 V92" stroke="#46584C" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#mg-arr)"/><text x="320" y="48" text-anchor="middle" class="mg-ts">розрив між плечима</text>';
        if (i === 2) h += '<rect x="220" y="50" width="200" height="40" rx="8" fill="#2E7D32"/><text x="320" y="75" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">нова послідовність (нокін)</text>';
        return h + '</svg>';
      };
      const up = (i) => { st.innerHTML = sc(i) + `<div class="mg-info"><h4>${i + 1}. ${ST[i][0]}</h4><p>${ST[i][1]}</p></div>`; };
      stepper(bar, 3, up, { lc: L4 });
    } else if (mode === 'dcas') {
      const F = { act: ['Активатор ФТ', '#2E7D32', 'Вмикання гена: dCas9 приводить активатор до промотора.'], rep: ['Репресор / ремоделер хроматину', '#C0573E', 'Вимикання гена: dCas9 приводить репресор чи фактор ремоделювання хроматину.'], gfp: ['Флуоресцентний білок', '#4CAF50', 'Візуалізація локусів у хромосомах.'], enz: ['Інші ферменти', '#1565C0', 'dCas9 як «шасі» для будь-яких ферментів у заданій точці геному.'] };
      const ro = el('div', { class: 'mg-opts' }); const sv = el('div'); const inf = el('div', { class: 'mg-info' });
      options(ro, Object.entries(F).map(([v, f]) => ({ v, t: f[0], c: f[1] })), 'act', sh);
      function sh(v) {
        const f = F[v];
        sv.innerHTML = `<svg class="mg-svg" viewBox="0 0 640 150"><rect width="640" height="150" rx="14" fill="#FBFDFB"/><path d="M20 110 H620" stroke="#4A78C8" stroke-width="4"/><rect x="260" y="95" width="60" height="30" rx="6" fill="#7B3FA0"/><text x="290" y="114" text-anchor="middle" style="font:700 10px system-ui;fill:#fff">промотор</text><rect x="324" y="95" width="130" height="30" rx="6" fill="${v === 'rep' ? '#9AA79D' : '#2E7D32'}"/><text x="389" y="114" text-anchor="middle" style="font:700 10px system-ui;fill:#fff">ген</text>
          <ellipse cx="290" cy="60" rx="52" ry="24" fill="#7A8A7E"/><text x="290" y="58" text-anchor="middle" style="font:800 12px system-ui;fill:#fff">dCas9</text><text x="290" y="72" text-anchor="middle" style="font:600 9px system-ui;fill:#fff">без нуклеази</text><path d="M290 84 V94" stroke="#46584C" stroke-width="2"/>
          <ellipse cx="400" cy="48" rx="68" ry="22" fill="${f[1]}"/><text x="400" y="52" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">${f[0].split(' ')[0]} ${f[0].split(' ')[1] || ''}</text><path d="M340 54 H332" stroke="#46584C" stroke-width="2"/>
          <text x="40" y="40" class="mg-ts">gRNA веде dCas9 до цілі</text></svg>`;
        inf.innerHTML = `<h4>dCas9 + ${f[0]}</h4><p>${f[2]}</p>`;
      }
      body.append(el('div', { class: 'mg-info' }, el('p', { html: '<b>dCas9</b> — дефектна Cas9 без нуклеазної активності: розрізу немає, лишається точна «навігація» до будь-якого локуса.' })), ro, sv, inf); sh('act');
    } else {
      let done = false;
      const b = el('button', { type: 'button', class: 'mg-btn' }, '⚙ Запустити редактор основ (цитидиндезаміназа)');
      const view = el('div');
      b.addEventListener('click', () => { done = !done; b.textContent = done ? '↺ Повернути вихідну' : '⚙ Запустити редактор основ (цитидиндезаміназа)'; paint(); });
      function paint() {
        let s = SEQ; const hl = {}; if (done) { s = SEQ.slice(0, 6) + 'T' + SEQ.slice(7); hl[6] = 'ed'; }
        const win = {}; for (let i = 3; i < 12; i++) win[i] = win[i] || 'g'; Object.assign(win, hl);
        view.innerHTML = `<div class="mg-seqbox">${seqRow(s, win, 'ДНК')}${aaRow(s)}${done ? '<div class="mg-cut">C → U (у ДНК читається як T): пара G·C → A·T; розриву ДНК немає</div>' : ''}</div>`;
        $('.mg-info', view.parentNode).innerHTML = done ? '<p>У кодоні CAA (глутамін) цитидин дезамінується до уридину → кодон TAA = <b>стоп</b>: ген вимкнено без дволанцюгового розриву. Аденіндезаміназа працює навпаки: A→I, пара A·T → G·C.</p>' : '<p>dCas9/nCas9 + <b>цитидиндезаміназа</b> (C→U → пара G·C → A·T) або <b>аденіндезаміназа</b> (A→I → пара A·T → G·C): прицільна заміна однієї пари основ.</p>';
      }
      const wrap = el('div'); wrap.append(el('div', { class: 'mg-row' }, b), view, el('div', { class: 'mg-info' })); body.append(wrap); paint();
    }
  }
  draw();
});

// ------------------------------------------------------------------ каротиноїди томата
register('carotenoid', (root) => {
  const ST = {
    wt: ['Дикий тип (стиглий плід)', '#D32F2F', 'Фітоєн → … → <b>лікопін</b> (червоний). При достиганні вимикаються β-циклаза та гідроксилаза → у плоді переважає лікопін.', { lyc: 1, cyc: 0, hyd: 0 }],
    tan: ['Мутант tangerine (tan)', '#F57C00', 'Ген каротиноїд-ізомерази (<i>CRTISO</i>) пошкоджено: плід помаранчевий, накопичується пролікопін замість лікопіну; жовтіє листя, бліднуть квітки.', { lyc: 0, cyc: 0, hyd: 0, pro: 1 }],
    fix: ['Виправлення: CRISPR + HDR', '#D32F2F', 'Гемінівірусний реплікон + CRISPR надрізає дефектний алель <i>tan</i>, HDR вставляє нормальний фрагмент <i>CRTISO</i> → помаранчеві томати знову стають червоними. Редагування не лише ламає, а й <b>виправляє</b> гени.', { lyc: 1, cyc: 0, hyd: 0 }],
    xan: ['Проєкт «Xantomato»', '#FFB300', 'Гідроксилаза не вимикається при достиганні → томат, збагачений <b>ксантофілами</b> (антиоксиданти, користь для зору) і β-каротином.', { lyc: 0, cyc: 1, hyd: 1 }],
  };
  let k = 'wt';
  const row = el('div', { class: 'mg-opts' });
  options(row, Object.entries(ST).map(([v, s]) => ({ v, t: s[0] })), 'wt', (v) => { k = v; draw(); });
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Шлях біосинтезу каротиноїдів томата з точками втручання' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function draw() {
    const s = ST[k]; const f = s[3];
    const N = (x, y, w, t, c, on) => `<g opacity="${on ? 1 : .3}"><rect x="${x}" y="${y}" width="${w}" height="34" rx="10" fill="${c}" ${on ? 'stroke="#13241A" stroke-width="2"' : ''}/><text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">${t}</text></g>`;
    const A = (x1, y1, x2, y2, on = true) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${on ? '#46584C' : '#C9D3CA'}" stroke-width="2.5" marker-end="url(#mg-arr)"/>`;
    let h = '<rect width="640" height="300" rx="14" fill="#FBFDFB"/>';
    h += N(20, 30, 90, 'фітоєн', '#9AA79D', true) + A(112, 47, 150, 47);
    h += N(152, 30, 110, 'пролікопін', '#EF6C00', true) + `<text x="207" y="26" text-anchor="middle" class="mg-ts" style="font-weight:800;color:#C0573E;fill:${k === 'tan' ? '#C0573E' : '#7A8A7E'}">CRTISO${k === 'tan' ? ' ✘' : ''}</text>` + A(264, 47, 300, 47, !f.pro);
    h += N(302, 30, 100, 'лікопін', '#D32F2F', f.lyc) + A(404, 47, 450, 47, f.cyc || f.lyc);
    h += N(452, 30, 160, 'α-/β-каротин', '#F9A825', f.cyc);
    h += `<text x="532" y="84" text-anchor="middle" class="mg-ts" style="font-weight:800">β-/ε-циклаза</text>${k === 'wt' || k === 'fix' ? '<text x="532" y="98" text-anchor="middle" class="mg-ts">вимикається при достиганні</text>' : ''}`;
    h += A(532, 104, 532, 140, f.hyd) + N(452, 142, 160, 'ксантофіли', '#FFB300', f.hyd);
    h += `<text x="532" y="196" text-anchor="middle" class="mg-ts" style="font-weight:800">гідроксилаза${f.hyd ? ' (активна)' : ' (вимикається)'}</text>`;
    h += `<text x="532" y="212" text-anchor="middle" class="mg-ts">зеаксантин ⇄ антераксантин</text><text x="532" y="226" text-anchor="middle" class="mg-ts">⇄ віолаксантин</text>`;
    h += `<g transform="translate(110 230)"><circle r="30" fill="${s[1]}" stroke="#13241A" stroke-width="2"/><path d="M-6 -30 q6 -12 14 0" fill="none" stroke="#4E8A36" stroke-width="5"/><text x="48" y="4" class="mg-tb">колір плода</text></g>`;
    sv.innerHTML = h;
    info.innerHTML = `<h4>${s[0]}</h4><p>${s[2]}</p>`;
  }
  root.append(row, sv, info);
  draw();
});
