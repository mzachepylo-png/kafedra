// Частина 3. Трансформація рослин: інтерактивні блоки.
import { register, el, svg, options, stepper, clamp, lerp, rnd, $, $$, loop } from './util.js';
import { sliders } from '../ui.js';

const L3 = 'var(--l3)';

// ------------------------------------------------------------------ опіни
register('opines', (root) => {
  const O = [
    ['Нопалін', ['аргінін', 'α-кетоглутарат'], ['#C0573E', '#E9A825'], 'Нопалінові штами. Продукт конденсації двох молекул із частковим відновленням.'],
    ['Октопін', ['аргінін', 'піруват'], ['#C0573E', '#2E7D32'], 'Уперше виділений 1927 р. з м\'язів восьминога <i>Octopus</i>: у молюсків утворюється при гіпоксії — відновлювальні еквіваленти NADH «скидаються» на багаті азотом сполуки, а не на піруват → лактат, як у людини.'],
    ['Агроцинопіни A/B', ['цукор', 'цукор'], ['#1565C0', '#42A5F5'], 'Фосфодиефіри цукрів.'],
    ['Манопін', ['маноза', 'глутамін(ат)'], ['#7B3FA0', '#2E7D32'], 'Манопінові Ri-плазміди.'],
    ['Кукумопін', ['гістидин …'], ['#00796B'], 'Похідне гістидину.'],
    ['Агропін', ['(цукровий компонент)'], ['#8D6E63'], 'Опін агропінового типу Ri-плазмід (<i>A. rhizogenes</i>).'],
  ];
  const row = el('div', { class: 'mg-opts' });
  const view = el('div', { class: 'mg-opine' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  options(row, O.map((o, i) => ({ v: i, t: o[0] })), 0, show);
  function show(i) {
    const o = O[+i];
    view.innerHTML = o[1].map((x, k) => `<span class="mg-pill" style="--c:${o[2][k]}">${x}</span>`).join('<b class="mg-plus">+</b>') + `<b class="mg-plus">⇒</b><span class="mg-pill mg-pill--big">${o[0]}</span>`;
    info.innerHTML = `<p>${o[3]}</p><p><b>Навіщо це бактерії.</b> Рослина не здатна катаболізувати опіни; їх катаболізує <i>лише</i> агробактерія відповідного типу (гени катаболізму — на тій самій плазміді). Різні опіни в одній пухлині зазвичай не трапляються — між штамами є конкуренція.</p>`;
  }
  root.append(row, view, info);
  show(0);
});

// ------------------------------------------------------------------ «генетична колонізація»: потік ресурсів
register('opine-flow', (root) => {
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 250', role: 'img', 'aria-label': 'Потік ресурсів: рослина → пухлина → опіни → агробактерія' });
  let on = true;
  const b = el('button', { type: 'button', class: 'mg-btn mg-btn--o', 'aria-pressed': 'true' }, '❚❚ Пауза');
  b.addEventListener('click', () => { on = !on; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '❚❚ Пауза' : '▶ Відновити'; });
  const N = (x, y, w, h, f, t, t2 = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${f}"/><text x="${x + w / 2}" y="${y + h / 2 - (t2 ? 2 : -4)}" text-anchor="middle" style="font:800 13px system-ui;fill:#fff">${t}</text>${t2 ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" style="font:600 10.5px system-ui;fill:#fff;opacity:.9">${t2}</text>` : ''}`;
  s.innerHTML = `<rect width="640" height="250" rx="14" fill="#FBFDFB"/>
    ${N(20, 30, 150, 70, '#2E7D32', 'Рослина', 'фотосинтез: N, P, асиміляти')}
    ${N(250, 30, 140, 70, '#A8660B', 'Пухлина', 'гормон-незалежний ріст')}
    ${N(470, 30, 150, 70, '#7B3FA0', 'Агробактерія', 'єдина катаболізує опін')}
    <path d="M170 55 H250" stroke="#46584C" stroke-width="2.5" marker-end="url(#mg-arr)"/><path d="M250 80 H170" stroke="#9AA79D" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#mg-arr)"/>
    <path d="M390 55 H470" stroke="#46584C" stroke-width="2.5" marker-end="url(#mg-arr)"/>
    <text x="210" y="46" text-anchor="middle" class="mg-ts">ресурси</text><text x="430" y="46" text-anchor="middle" class="mg-ts">опіни</text><text x="210" y="96" text-anchor="middle" class="mg-ts">нові порції N, P, асимілятів</text>
    <g id="of-dots"></g>
    <text x="20" y="150" class="mg-tb">Замкнене коло «генетичної колонізації»</text>
    <text x="20" y="172" class="mg-t">1. Пухлина робить із ресурсів рослини опіни — тих, що рослина сама не засвоює.</text>
    <text x="20" y="192" class="mg-t">2. Опіни споживає лише агробактерія, чиї гени катаболізму лежать на тій самій Ti-плазміді.</text>
    <text x="20" y="212" class="mg-t">3. Рослина у відповідь шле у пухлину нові порції N, P й асимілятів — пухлина «стягує» ресурси з усієї рослини.</text>`;
  const g = $('#of-dots', s);
  const dots = [];
  for (let i = 0; i < 12; i++) { const c = svg('circle', { r: 4.5, fill: i % 2 ? '#E9A825' : '#C0573E' }); g.append(c); dots.push({ c, t: i / 12, seg: i < 6 ? 0 : 1 }); }
  const dots2 = [];
  for (let i = 0; i < 4; i++) { const c = svg('circle', { r: 3.5, fill: '#9AA79D' }); g.append(c); dots2.push({ c, t: i / 4 }); }
  root.append(el('div', { class: 'mg-row' }, b), s);
  loop(root, (dt) => {
    if (!on) return;
    dots.forEach((d) => { d.t = (d.t + dt * .35) % 1; const x = d.seg === 0 ? lerp(170, 250, d.t) : lerp(390, 470, d.t); d.c.setAttribute('cx', x); d.c.setAttribute('cy', 55); });
    dots2.forEach((d) => { d.t = (d.t + dt * .25) % 1; d.c.setAttribute('cx', lerp(250, 170, d.t)); d.c.setAttribute('cy', 80); });
  });
});

// ------------------------------------------------------------------ покрокове зараження і перенесення Т-ДНК
register('infection', (root) => {
  const ST = [
    ['Пошук господаря', 'Поранення коренів дводольних виділяє фенольну сполуку <b>ацетосирингон</b>; руйнування клітинної стінки звільняє глюкуронову/галактуронову кислоту, арабінозу, глюкозу — ще один сигнал. Бактерії спрямовуються до поранення (хемотаксис) і прикріплюються полюсом: на поверхні — уніполярний полісахарид (UPP).'],
    ['Сприйняття сигналу: VirA → VirG', '<b>VirA</b> — мембранний сенсор (гістидинкіназа, димер); сайт зв\'язування ацетосирингону — з цитоплазматичного боку. Білок <b>ChvE</b> зв\'язує моносахариди й підвищує спорідненість VirA до ацетосирингону. VirA автофосфорилюється по His і переносить фосфат на Asp білка <b>VirG</b> — фактора транскрипції, що вмикає решту <i>vir</i>-генів.'],
    ['Вирізання Т-ДНК', 'Комплекс <b>VirD1 + VirD2</b> надрізає консервативні межі (RB, LB; по 25 bp). <b>VirD2 ковалентно приєднується до 5′-кінця</b> одноланцюгової Т-ДНК (пілот-білок). Старий ланцюг добудовується — з однієї Ti-плазміди можна зробити багато копій Т-ДНК.'],
    ['Канал T4SS', 'Транспортний комплекс <b>VirB1–VirB11 + VirD4</b> (система секреції IV типу). Цитоплазматичні АТФази VirB4, VirB11, VirD4 «ловлять» Т-ДНК і білки; VirB2 — білок пілі, VirB5 — «віночок» на верхівці, що продірявлює мембрану господаря. Систему споріднено з кон\'югативними системами плазмід.'],
    ['Сім бар\'єрів', 'оцДНК долає: <b>1</b> внутрішню мембрану → <b>2</b> періплазму → <b>3</b> зовнішню мембрану → <b>4</b> клітинну стінку → <b>5</b> плазмалему → <b>6</b> цитоплазму → <b>7</b> ядерну оболонку. Разом із Т-ДНК у клітину потрапляють білки VirE2, VirF, VirD5.'],
    ['Маскування й рух до ядра', '<b>VirE2</b> щільно «одягає» оцДНК, захищаючи від нуклеаз, і має власний NLS; <b>VirD2</b> несе сигнал ядерної локалізації; VirE2 взаємодіє з активованим господарським білком <b>VIP1</b> (теж з NLS). Комплекс тричі «помічений» сигналами — і пропущений в ядро.'],
    ['Розбирання комплексу', '<b>VirF</b> — компонент убіквітин-лігази (F-box) зі спорідненістю до VIP1: після доставки VIP1 стає мішенню протеасоми й розбирається, не піднімаючи SOS-сигналу; <b>VirD5</b> стабілізує VirF. Т-ДНК звільняється від «одягу».'],
    ['Інтеграція в геном', 'VirD2 робить надрізи у <b>випадкових</b> місцях хроматину. Репарація рослини йде переважно <b>негомологічним з\'єднанням кінців (NHEJ)</b>: кінці зшиваються з першим-ліпшим обривком → Т-ДНК вбудовується назавжди. Не всім копіям щастить: частина лишається в ядрі кілька днів і губиться (транзієнтна експресія).'],
    ['Експресія онкогенів', 'Гени Т-ділянки стоять під <b>еукаріотичними</b> промоторами — в бактерії вони мовчать і працюють лише в рослині: <i>iaaM</i>/<i>iaaH</i> (ауксин), <i>ipt</i> (цитокінін), ген синтезу опіну. Клітина переходить до гормон-незалежного поділу — утворюється пухлина.'],
  ];
  const sv = svg('svg', { class: 'mg-svg mg-inf', viewBox: '0 0 700 330', role: 'img', 'aria-label': 'Схема перенесення Т-ДНК з агробактерії в ядро рослинної клітини' });
  const cap = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const bar = el('div');
  // елементи сцени: [від, до, розмітка]
  const E = [];
  const add = (a, b, h) => E.push([a, b, h]);
  // фон: клітина рослини
  const base = `<rect width="700" height="330" rx="14" fill="#FBFDFB"/>
    <rect x="388" y="20" width="26" height="290" fill="#D6C28C"/><text x="401" y="14" text-anchor="middle" class="mg-ts">стінка</text>
    <rect x="414" y="20" width="9" height="290" fill="#7FB8CF"/><text x="440" y="14" class="mg-ts">плазмалема</text>
    <rect x="423" y="20" width="270" height="290" rx="8" fill="#F2F7E8"/>
    <circle cx="590" cy="170" r="74" fill="#EFE6FB" stroke="#7B3FA0" stroke-width="3"/><text x="590" y="98" text-anchor="middle" class="mg-ts" style="fill:#5A2F7A">ядро</text>
    <path d="M520 170 a74 74 0 0 1 0 0" stroke="#7B3FA0" stroke-width="4" fill="none"/>
    <g stroke="#9C5BC0" stroke-width="6" stroke-linecap="round" fill="none"><path d="M560 150 q8 18 0 36"/><path d="M585 142 q-8 20 0 40"/><path d="M612 150 q8 20 0 38"/><path d="M570 198 q10 12 22 0"/></g>`;
  add(0, 8, base);
  // бактерія
  add(0, 8, `<g class="mg-bact"><rect x="40" y="120" width="320" height="100" rx="50" fill="#F8EEFB" stroke="#7B3FA0" stroke-width="3"/><rect x="48" y="128" width="304" height="84" rx="42" fill="none" stroke="#B592D0" stroke-width="2"/>
    <text x="200" y="108" text-anchor="middle" class="mg-tb" style="fill:#5A2F7A">Agrobacterium tumefaciens</text>
    <circle cx="150" cy="178" r="30" fill="none" stroke="#A8660B" stroke-width="4"/><text x="150" y="182" text-anchor="middle" class="mg-ts" style="font-weight:800;fill:#7A4A08">Ti-плазміда</text>
    <rect x="125" y="146" width="18" height="12" rx="3" fill="#C0573E"/><text x="134" y="142" text-anchor="middle" class="mg-ts">RB</text><rect x="166" y="146" width="18" height="12" rx="3" fill="#C0573E"/><text x="175" y="142" text-anchor="middle" class="mg-ts">LB</text>
    <path d="M360 160 q8 0 8 8 v22 q0 8 -8 8" fill="none" stroke="#9C5BC0" stroke-width="5"/></g>`);
  // ацетосирингон і рана
  add(0, 1, `<path d="M388 90 l-8 14 l8 12 l-8 14 l8 12 l-8 14 l8 12 l-8 14" fill="none" stroke="#C0573E" stroke-width="3"/><text x="380" y="82" text-anchor="end" class="mg-ts" style="fill:#C0573E">поранення</text>
    ${Array.from({ length: 9 }, (_, i) => `<circle cx="${300 + (i % 3) * 26 + (i * 7) % 15}" cy="${110 + Math.floor(i / 3) * 32}" r="4" fill="${i % 3 ? '#E9A825' : '#C0573E'}"/>`).join('')}<text x="320" y="262" text-anchor="middle" class="mg-ts">ацетосирингон, цукри, кислоти</text>
    <path d="M300 245 C330 230 350 215 368 205" stroke="#C0573E" stroke-width="2" fill="none" marker-end="url(#mg-arr)"/>`);
  // VirA/VirG
  add(1, 1, `<g><rect x="338" y="148" width="22" height="48" rx="8" fill="#1565C0"/><text x="349" y="176" text-anchor="middle" style="font:800 10px system-ui;fill:#fff" transform="rotate(-90 349 172)">VirA</text>
    <circle cx="305" cy="118" r="11" fill="#E9A825"/><text x="305" y="122" text-anchor="middle" style="font:800 8px system-ui">ChvE</text>
    <circle cx="260" cy="172" r="14" fill="#2E7D32"/><text x="260" y="176" text-anchor="middle" style="font:800 9px system-ui;fill:#fff">VirG</text><text x="260" y="152" text-anchor="middle" class="mg-ts">P → Asp</text>
    <path d="M338 172 C310 172 285 172 276 172" stroke="#46584C" stroke-width="2" fill="none" marker-end="url(#mg-arr)"/><text x="300" y="164" text-anchor="middle" class="mg-ts">His~P</text>
    <path d="M246 172 L190 172" stroke="#2E7D32" stroke-width="2" fill="none" marker-end="url(#mg-arr)"/><text x="215" y="190" text-anchor="middle" class="mg-ts" style="fill:#2E7D32">vir ON</text></g>`);
  // VirD2 / T-ланцюг
  add(2, 2, `<g><rect x="120" y="176" width="64" height="8" rx="4" fill="#C0573E" opacity=".0"/><path d="M134 154 H182" stroke="#E57373" stroke-width="5" stroke-linecap="round"/>
    <path d="M110 150 q6 -10 12 0" fill="none" stroke="#46584C" stroke-width="2.5"/><circle cx="134" cy="152" r="8" fill="#1565C0"/><text x="134" y="155" text-anchor="middle" style="font:800 8px system-ui;fill:#fff">D2</text>
    <path d="M200 120 C240 110 260 120 268 130" fill="none" stroke="#E57373" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 9"/><text x="250" y="108" text-anchor="middle" class="mg-ts" style="fill:#C0573E">оц Т-ДНК + VirD2 на 5′-кінці</text></g>`);
  // T4SS
  add(3, 8, `<g><rect x="352" y="168" width="22" height="26" rx="4" fill="#1565C0" opacity=".9"/><path d="M370 181 H430" stroke="#1565C0" stroke-width="14" stroke-linecap="round" opacity=".35"/><path d="M370 181 H430" stroke="#1565C0" stroke-width="5" stroke-linecap="round"/>
    <circle cx="432" cy="181" r="6" fill="#E9A825" stroke="#8C6A10" stroke-width="2"/><text x="400" y="162" text-anchor="middle" class="mg-ts" style="fill:#0D47A1;font-weight:800">T4SS · VirB2 пілі · VirB5</text>
    <rect x="318" y="176" width="26" height="12" rx="3" fill="#E9A825"/><text x="331" y="203" text-anchor="middle" class="mg-ts">B4·B11·D4</text></g>`);
  // сім бар'єрів
  add(4, 4, `<g>${[[348, 1], [360, 2], [372, 3], [401, 4], [418, 5], [470, 6], [516, 7]].map(([x, n]) => `<circle cx="${x}" cy="232" r="9" fill="#C0573E"/><text x="${x}" y="236" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">${n}</text><path d="M${x} 223 V198" stroke="#C0573E" stroke-width="1.4" stroke-dasharray="3 3"/>`).join('')}<text x="400" y="266" text-anchor="middle" class="mg-ts" style="fill:#C0573E;font-weight:700">внутрішня мембрана · періплазма · зовнішня мембрана · стінка</text><text x="560" y="284" text-anchor="middle" class="mg-ts" style="fill:#C0573E;font-weight:700">плазмалема · цитоплазма · ядерна оболонка</text></g>`);
  // T-комплекс у клітині
  add(4, 4, `<g><path d="M430 181 H470" stroke="#E57373" stroke-width="5" stroke-linecap="round"/><circle cx="478" cy="181" r="9" fill="#1565C0"/><text x="478" y="184" text-anchor="middle" style="font:800 8px system-ui;fill:#fff">D2</text></g>`);
  add(5, 5, `<g><path d="M460 181 C480 181 500 181 520 181" stroke="#E57373" stroke-width="5" stroke-linecap="round" opacity=".5"/><ellipse cx="492" cy="181" rx="38" ry="15" fill="#2E7D32" opacity=".85"/><text x="492" y="185" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">VirE2 + ДНК</text><circle cx="478" cy="160" r="10" fill="#E9A825"/><text x="478" y="163" text-anchor="middle" style="font:800 7px system-ui">VIP1</text>
    <text x="492" y="140" text-anchor="middle" class="mg-ts" style="fill:#2E7D32;font-weight:800">NLS ×3: VirD2 · VirE2 · VIP1</text><path d="M530 181 H546" stroke="#46584C" stroke-width="2.5" marker-end="url(#mg-arr)"/></g>`);
  add(6, 6, `<g><ellipse cx="560" cy="120" rx="34" ry="16" fill="#C0573E"/><text x="560" y="124" text-anchor="middle" style="font:800 10px system-ui;fill:#fff">VirF → VIP1</text><text x="560" y="86" text-anchor="middle" class="mg-ts" style="fill:#C0573E;font-weight:800">протеасома розбирає VIP1</text>
    <path d="M520 230 H600" stroke="#E57373" stroke-width="5" stroke-linecap="round"/><circle cx="520" cy="230" r="8" fill="#1565C0"/><text x="560" y="252" text-anchor="middle" class="mg-ts">«оголена» оцДНК</text></g>`);
  add(7, 7, `<g><path d="M586 150 q8 18 0 36" stroke="#9C5BC0" stroke-width="6" stroke-linecap="round" fill="none"/><rect x="572" y="156" width="28" height="9" rx="4" fill="#E57373"/><text x="586" y="212" text-anchor="middle" class="mg-ts" style="fill:#C0573E;font-weight:800">Т-ДНК вбудована</text><text x="586" y="226" text-anchor="middle" class="mg-ts">NHEJ, випадкове місце</text></g>`);
  add(8, 8, `<g><path d="M596 106 q10 -22 20 0 t20 0" fill="none" stroke="#C2415C" stroke-width="3"/><text x="620" y="88" text-anchor="middle" class="mg-ts" style="font-weight:800;fill:#C2415C">iaaM · iaaH · ipt</text>
    <path d="M620 290 q-10 -30 -50 -34" stroke="#C2415C" stroke-width="2" fill="none"/><text x="560" y="304" text-anchor="middle" class="mg-ts">ауксин + цитокінін → гормон-незалежний поділ → пухлина</text></g>`);
  let step = 0;
  function scene(i) {
    step = i;
    sv.innerHTML = E.filter(([a, b]) => i >= a && i <= b).map((e) => e[2]).join('');
    const bact = $('.mg-bact', sv); if (bact && i === 0) bact.setAttribute('transform', 'translate(-30 0)');
    cap.innerHTML = `<h4>Крок ${i + 1}. ${ST[i][0]}</h4><p>${ST[i][1]}</p>`;
  }
  root.append(bar, sv, cap);
  stepper(bar, ST.length, scene, { lc: L3 });
});

// ------------------------------------------------------------------ баланс ауксин/цитокінін
register('hormone-balance', (root) => {
  const M = { wt: ['Дикий тип Т-ДНК', 1, 'Обидва гормони синтезуються в пухлині: ріст калусу.'], tms: ['tms (немає синтезу ауксину)', .08, 'Мутант <i>tms</i> — «коса шута»: пухлини з пагонами. Ушкоджено ауксинові гени (<i>iaaM, iaaH</i>) → баланс зсувається до цитокінінів → пагони.'], tmr: ['tmr (немає синтезу цитокініну)', 12, 'Мутант <i>tmr</i> — пухлини з коренями, пухлина більша. Ушкоджено <i>ipt</i> → надлишок ауксинів → корені.'] };
  const row = el('div', { class: 'mg-opts' });
  const ctl = el('div');
  let S;
  options(row, Object.entries(M).map(([k, v]) => ({ v: k, t: v[0] })), 'wt', (v) => { S.set('r', M[v][1]); mutant = v; draw(); });
  S = sliders(ctl, [{ id: 'r', label: 'Співвідношення ауксин : цитокінін', min: 0.05, max: 20, step: 0.01, value: 1, log: true, digits: 2, hint: 'Ліворуч — переважають цитокініни, праворуч — ауксини.' }], () => { mutant = ''; draw(); });
  let mutant = 'wt';
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 270', role: 'img', 'aria-label': 'Морфологія пухлини залежно від співвідношення ауксину і цитокініну' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const rnd1 = (i) => ((Math.sin(i * 91.7) + 1) / 2);
  function draw() {
    const r = S.values.r; const lg = Math.log10(r);
    const shoots = lg < -0.35 ? clamp(Math.round((-lg - 0.1) * 6), 1, 9) : 0;
    const roots = lg > 0.35 ? clamp(Math.round((lg - 0.1) * 7), 1, 11) : 0;
    let h = '<rect width="640" height="270" rx="14" fill="#FBFDFB"/>';
    h += '<rect x="30" y="230" width="580" height="18" rx="9" fill="url(#mg-hgrad)"/><defs><linearGradient id="mg-hgrad" x1="0" x2="1"><stop offset="0" stop-color="#7BC96F"/><stop offset=".5" stop-color="#E6D9A8"/><stop offset="1" stop-color="#C9A27A"/></linearGradient></defs>';
    const px = 30 + (lg + 1.3) / 2.6 * 580;
    h += `<path d="M${px} 224 l-8 -12 h16z" fill="#13241A"/><text x="30" y="264" class="mg-ts">цитокініни ↑ → пагони</text><text x="610" y="264" text-anchor="end" class="mg-ts">ауксини ↑ → корені</text><text x="320" y="264" text-anchor="middle" class="mg-ts">баланс → калус</text>`;
    h += '<g transform="translate(320 150)">';
    h += `<ellipse rx="${64 + roots * 2}" ry="46" fill="#C9A875" stroke="#8D6E3F" stroke-width="3"/><ellipse cx="-14" cy="-12" rx="26" ry="14" fill="#E3C79A" opacity=".7"/><text y="6" text-anchor="middle" class="mg-tb" style="fill:#5A4220">пухлина</text>`;
    for (let i = 0; i < shoots; i++) { const a = -150 + (i / Math.max(1, shoots - 1)) * 120 + (shoots === 1 ? 60 : 0); const L = 56 + rnd1(i) * 30; const rad = a * Math.PI / 180; const x = Math.cos(rad) * 50, y = Math.sin(rad) * 38; h += `<path d="M${x} ${y} l${Math.cos(rad) * L} ${Math.sin(rad) * L}" stroke="#4E8A36" stroke-width="5" stroke-linecap="round"/><ellipse cx="${x + Math.cos(rad) * L}" cy="${y + Math.sin(rad) * L}" rx="12" ry="7" fill="#7BC96F" transform="rotate(${a} ${x + Math.cos(rad) * L} ${y + Math.sin(rad) * L})"/>`; }
    for (let i = 0; i < roots; i++) { const a = 25 + (i / Math.max(1, roots - 1)) * 130 + (roots === 1 ? 60 : 0); const L = 40 + rnd1(i + 5) * 40; const rad = a * Math.PI / 180; const x = Math.cos(rad) * 52, y = Math.sin(rad) * 38; h += `<path d="M${x} ${y} q${Math.cos(rad) * L * .5 + (i % 2 ? 10 : -10)} ${Math.sin(rad) * L * .5} ${Math.cos(rad) * L} ${Math.sin(rad) * L}" fill="none" stroke="#A8886B" stroke-width="3.5" stroke-linecap="round"/>`; }
    h += '</g>';
    sv.innerHTML = h;
    const kind = shoots ? 'пагони (баланс зсунуто до цитокінінів)' : roots ? 'корені (баланс зсунуто до ауксинів)' : 'калус — недиференційована тканина';
    info.innerHTML = `<h4>${M[mutant] ? M[mutant][0] : 'Довільне співвідношення'} → ${kind}</h4><p>${M[mutant] ? M[mutant][2] : 'Для поділу клітин потрібні і ауксини, і цитокініни; їхній баланс визначає, що виросте з тканини.'}</p>`;
  }
  root.append(row, ctl, sv, info);
  draw();
});

// ------------------------------------------------------------------ бінарний вектор: порядок генів у Т-ДНК
register('binary-builder', (root) => {
  let order = 'A';
  const row = el('div', { class: 'mg-opts' });
  options(row, [{ v: 'A', t: 'Ген інтересу біля RB, маркер біля LB (правильно)' }, { v: 'B', t: 'Маркер біля RB, ген інтересу біля LB' }], 'A', (v) => { order = v; sim(false); });
  const btn = el('button', { type: 'button', class: 'mg-btn' }, '▶ Перенести Т-ДНК у 60 клітин');
  const sv = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 120', role: 'img', 'aria-label': 'Т-ДНК: RB, ген інтересу, маркер, LB' });
  const grid = el('div', { class: 'mg-cellgrid' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const leg = el('div', { class: 'mg-legend' });
  leg.innerHTML = '<span><i style="--c:#2E7D32"></i>вижила на антибіотику й має ген інтересу</span><span><i style="--c:#E9A825"></i>вижила, але гена інтересу немає</span><span><i style="--c:#C9D3CA"></i>загинула (маркер пошкоджено)</span>';
  function map() {
    const goi = order === 'A' ? [0.1, 0.45] : [0.55, 0.9]; const mk = order === 'A' ? [0.55, 0.9] : [0.1, 0.45];
    const X = (f) => 30 + f * 580;
    let h = '<rect width="640" height="120" rx="14" fill="#FBFDFB"/><path d="M30 60 H610" stroke="#4A78C8" stroke-width="3"/>';
    h += `<rect x="${X(0) - 6}" y="40" width="40" height="40" rx="8" fill="#C0573E"/><text x="${X(0) + 14}" y="65" text-anchor="middle" style="font:800 13px system-ui;fill:#fff">RB</text>`;
    h += `<rect x="${X(1) - 36}" y="40" width="40" height="40" rx="8" fill="#C0573E"/><text x="${X(1) - 16}" y="65" text-anchor="middle" style="font:800 13px system-ui;fill:#fff">LB</text>`;
    h += `<rect x="${X(goi[0])}" y="42" width="${X(goi[1]) - X(goi[0])}" height="36" rx="8" fill="#2E7D32"/><text x="${(X(goi[0]) + X(goi[1])) / 2}" y="65" text-anchor="middle" style="font:800 12px system-ui;fill:#fff">ген інтересу</text>`;
    h += `<rect x="${X(mk[0])}" y="42" width="${X(mk[1]) - X(mk[0])}" height="36" rx="8" fill="#E9A825"/><text x="${(X(mk[0]) + X(mk[1])) / 2}" y="65" text-anchor="middle" style="font:800 12px system-ui">маркер (nptII)</text>`;
    h += '<path d="M30 100 H600" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/><text x="320" y="116" text-anchor="middle" class="mg-ts">Т-ланцюг синтезується від RB до LB; недобудований («з\'їдений») кінець — біля LB</text>';
    sv.innerHTML = h;
  }
  function sim(run) {
    map(); grid.innerHTML = '';
    if (!run) { info.innerHTML = '<p>Натисніть кнопку: у кожній із 60 клітин Т-ланцюг може обірватися (частіше — з боку LB). Виживають лише клітини з цілим маркером.</p>'; return; }
    const N = 60; let ok = 0, bad = 0, dead = 0;
    for (let i = 0; i < N; i++) {
      const k = Math.random() < .45 ? 1 : Math.random();     // доля Т-ДНК, що перенеслася від RB
      const goiEnd = order === 'A' ? .45 : .9, mkEnd = order === 'A' ? .9 : .45;
      const alive = k >= mkEnd, hasG = k >= goiEnd;
      const cls = !alive ? '#C9D3CA' : hasG ? '#2E7D32' : '#E9A825';
      if (!alive) dead++; else if (hasG) ok++; else bad++;
      grid.append(el('i', { style: `background:${cls}` }));
    }
    info.innerHTML = `<p><b>Вижило ${ok + bad} із ${N}.</b> З них <b>${ok}</b> мають ген інтересу, <b>${bad}</b> — «порожні» (стійкість є, потрібного гена немає).</p>` +
      (order === 'A' ? '<p>Ген інтересу — біля RB (добре захищений), маркер — біля LB (часто ушкоджується): якщо LB-кінець «з\'їдено», маркер пошкоджено й клітина відсіюється — це гарантує інтеграцію всієї конструкції.</p>'
        : '<p>Маркер ближче до RB переживе обрив, а ген інтересу біля LB — ні: з\'являються стійкі клітини <i>без</i> потрібного гена. Тому порядок в Т-ДНК — не дрібниця.</p>');
  }
  btn.addEventListener('click', () => sim(true));
  root.append(row, sv, el('div', { class: 'mg-row' }, btn), grid, leg, info);
  sim(false);
});
