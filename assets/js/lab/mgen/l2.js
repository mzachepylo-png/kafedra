// Частина 2. Регуляція експресії геному: інтерактивні блоки.
import { register, el, svg, options, stepper, clamp, lerp, $, $$, loop } from './util.js';
import { sliders } from '../ui.js';

const L2 = 'var(--l2)';
const hot = (root, sel, f) => $$(sel, root).forEach((g) => { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.addEventListener('click', () => f(g)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(g); } }); });
const tgl = (label, on, f) => { const b = el('button', { type: 'button', class: 'mg-opt', 'aria-pressed': String(on) }, label); b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); f(v); }); return b; };

// ------------------------------------------------------------------ цис-фактори, транс-фактори, хроматин
register('cistrans', (root) => {
  const S = { box: true, act: true, rep: false, open: true };
  const row = el('div', { class: 'mg-opts' },
    tgl('Цис: регуляторний бокс у промоторі', true, (v) => { S.box = v; draw(); }),
    tgl('Транс: активатор (ФТ)', true, (v) => { S.act = v; draw(); }),
    tgl('Транс: репресор', false, (v) => { S.rep = v; draw(); }),
    tgl('Хроматин розпушений', true, (v) => { S.open = v; draw(); }));
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 280', role: 'img', 'aria-label': 'Схема: цис-елемент, транс-фактор і хроматин визначають експресію гена' });
  const out = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function level() {
    if (!S.open) return [0, 'Хроматин ущільнений: нуклеосоми щільно упаковані, ген «виведено з обігу» — ФТ і РНК-полімераза не мають доступу, навіть якщо бокс і активатор на місці.'];
    if (!S.box) return [0, 'У промоторі немає потрібного регуляторного бокса (цис-елемента) — ФТ не має де зв\'язатися; експресії немає.'];
    if (!S.act) return [8, 'Бокс є, але відповідного активатора в клітині немає — транскрипція лише базальна.'];
    if (S.rep) return [22, 'Активатор і репресор конкурують у транскрипційному комплексі: репресор пригнічує активність — експресія низька.'];
    return [100, 'Усі три умови виконано: бокс (цис), активатор (транс) і розпушений хроматин — ген активно транскрибується.'];
  };
  function draw() {
    const [lv, txt] = level();
    let h = '<rect x="0" y="0" width="640" height="280" rx="14" fill="#FBFDFB"/>';
    h += '<text x="16" y="24" class="mg-tb">Хроматин</text>';
    // нуклеосоми
    const nuc = (x, y) => `<g transform="translate(${x} ${y})"><circle r="13" fill="#B7A4D9" stroke="#6A4BA8" stroke-width="2"/><circle r="6" fill="#8B6FC8"/></g>`;
    if (S.open) {
      h += `<path d="M20 120 H620" stroke="#4A78C8" stroke-width="3"/>`;
      [[50, 120], [95, 120], [520, 120], [570, 120]].forEach(([x, y]) => h += nuc(x, y));
    } else {
      h += `<path d="M20 120 H620" stroke="#4A78C8" stroke-width="3"/>`;
      for (let x = 40; x < 620; x += 26) h += nuc(x, 120);
    }
    // промотор + ген
    h += `<rect x="170" y="140" width="130" height="24" rx="6" fill="#7B3FA0" opacity="${S.open ? 1 : .35}"/><text x="268" y="157" text-anchor="middle" style="font:700 11px system-ui;fill:#fff" opacity="${S.open ? 1 : .5}">промотор</text>`;
    h += `<rect x="300" y="140" width="190" height="24" rx="6" fill="${lv > 0 ? '#2E7D32' : '#9AA79D'}" opacity="${S.open ? 1 : .35}"/><text x="395" y="157" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">ген</text>`;
    if (S.box) h += `<rect x="176" y="144" width="40" height="16" rx="4" fill="#E9A825"/><text x="196" y="156" text-anchor="middle" style="font:800 10px system-ui">бокс</text>`;
    // ФТ
    if (S.open && S.box && S.act) h += `<g><path d="M196 100 L196 142" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/><ellipse cx="196" cy="88" rx="38" ry="17" fill="#2E7D32"/><text x="196" y="92" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">активатор</text></g>`;
    else if (S.act) h += `<g opacity=".55"><ellipse cx="130" cy="64" rx="38" ry="17" fill="#2E7D32"/><text x="130" y="68" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">активатор</text></g>`;
    if (S.rep) h += `<g><ellipse cx="${S.open && S.box ? 268 : 120}" cy="${S.open && S.box ? 108 : 24}" rx="34" ry="15" fill="#C0573E"/><text x="${S.open && S.box ? 268 : 120}" y="${S.open && S.box ? 112 : 28}" text-anchor="middle" style="font:800 11px system-ui;fill:#fff">репресор</text></g>`;
    // мРНК
    const n = Math.round(lv / 20);
    for (let i = 0; i < n; i++) h += `<path d="M${400 + i * 34} ${110 - i * 6} q9 -16 18 0 t18 0" fill="none" stroke="#C2415C" stroke-width="3" stroke-linecap="round"/>`;
    h += `<text x="500" y="212" class="mg-tb" text-anchor="end">Рівень експресії</text>`;
    h += `<rect x="20" y="226" width="600" height="18" rx="9" fill="#E6EDE6"/><rect x="20" y="226" width="${Math.max(3, lv * 6)}" height="18" rx="9" fill="${lv > 50 ? '#2E7D32' : lv > 10 ? '#E9A825' : '#C0573E'}"/>`;
    h += `<text x="${Math.min(600, 28 + lv * 6)}" y="259" class="mg-t" text-anchor="${lv > 85 ? 'end' : 'start'}" style="font-weight:800">${lv} %</text>`;
    s.innerHTML = h;
    out.innerHTML = `<p>${txt}</p>`;
  }
  root.append(row, s, out);
  draw();
});

// ------------------------------------------------------------------ родини факторів транскрипції
register('tf-families', (root) => {
  const F = [
    ['Zn', 'Цинкові пальці', 'Zn-finger', 'атом Zn координований 2 His + 2 Cys; α-спіраль і β-шпилька входять у велику борозну ДНК (форма лише умовно схожа на «палець»).', '<i>CONSTANS</i>-подібні (<i>COL</i>) — індукція цвітіння; <i>YABBY</i> — розвиток квітки й листка (абаксіальна ідентичність).', 'zn'],
    ['B3', 'B3-домен', 'ARF · Aux/IAA · VP1', 'Домен переважно β-структурний (~300 а. к. у повному білку).', '<b>ARF</b> — первинна відповідь на ауксин; споріднені <b>Aux/IAA</b> — репресори, що блокують ARF, доки їх не знищить убіквітин-протеасомна система; <b>VP1</b> кукурудзи — відповідь на АБК. Той самий тип домену обслуговує різні гормони.', 'b3'],
    ['HD', 'Гомеодомен', 'KNOX · HD-ZIP · WOX', '~60 а. к.; три α-спіралі з петлями; кодується гомеобоксом (~180 bp). Назва — від гомеозисних змін у тварин (<i>Bithorax</i> у дрозофіли: «дві груди»).', '<b>KNOX</b> (від <i>KNOTTED1</i>) — меристематична активність пагона; <b>HD-ZIP</b> — програма листка, верх/низ; <b>WOX</b> — розмір меристем кореня й пагона. Гомологія з тваринами — лише в самому гомеодомені.', 'hd'],
    ['AP2', 'AP2/ERF', 'APETALA2', 'Повтори ~70 а. к.; впізнавання ДНК β-складками (є й α-спіраль). Родина вперше відкрита в рослин.', '<i>APETALA2</i> («безпелюстковий») контролює розвиток органів квітки: у мутанта <i>ap2</i> зникають пелюстки.', 'ap2'],
    ['MADS', 'MADS-бокс', 'AG · DEF', 'Домен 56–58 а. к.; працюють як <b>тетрамери</b> різних MADS-білків.', 'Ідентичність органів квітки: мутант <i>agamous</i> — махровість (замість тичинок і маточки утворюються пелюстки й чашолистки).', 'mads'],
    ['MYB', 'MYB', 'R1 R2 R3', 'До трьох тандемних повторів по ~50 а. к., кожен із 3 α-спіралей. В арабідопсису ~200 генів (при м\'якшому критерії >300); повних R1R2R3 — лише ~5, більшість — R2R3-тип.', 'Антоціани, трихоми та ін. Назва — від вірусу мієлобластозу птахів (<i>myb</i>-онкоген спричиняє лейкоз). У хребетних лише 3 гени з повним R1R2R3.', 'myb'],
    ['bHLH', 'bHLH', 'базова ділянка + спіраль–петля–спіраль', 'Основний (позитивно заряджений) домен електростатично взаємодіє з ДНК (кислотою); працюють як <b>димери</b>, що обхоплюють ДНК, наче щипці.', 'Партнери MYB у MBW-комплексі. Можуть поєднуватися з лейциновою блискавкою (<b>bZIP</b>): гідрофобні лейцини двох α-спіралей забезпечують димеризацію.', 'bhlh'],
    ['WRKY', 'WRKY', 'W-R-K-Y + Zn', 'Мотив триптофан–аргінін–лізин–тирозин зв\'язує Zn; β-складки взаємодіють з ДНК.', 'Вторинні ФТ, що зазвичай вмикаються після MBW-комплексу.', 'wrky'],
  ];
  const G = {
    zn: '<path d="M10 70 q12 -40 24 0 q12 40 24 0" fill="none" stroke="#2E7D32" stroke-width="5"/><path d="M62 30 l14 36 l14 -36" fill="none" stroke="#C0573E" stroke-width="5"/><circle cx="50" cy="38" r="9" fill="#9AA79D"/><text x="50" y="42" text-anchor="middle" style="font:800 9px system-ui;fill:#fff">Zn</text>',
    b3: '<path d="M12 26 h60 M12 40 h60 M12 54 h60 M12 68 h60" stroke="#1565C0" stroke-width="8" stroke-linecap="round" opacity=".85"/>',
    hd: '<path d="M14 62 q8 -40 22 -40" fill="none" stroke="#7B3FA0" stroke-width="9" stroke-linecap="round"/><path d="M40 70 q0 -42 18 -46" fill="none" stroke="#9C5BC0" stroke-width="9" stroke-linecap="round"/><path d="M66 24 q16 14 10 46" fill="none" stroke="#C09BDB" stroke-width="9" stroke-linecap="round"/>',
    ap2: '<path d="M12 34 h40 M12 50 h40 M12 66 h40" stroke="#A8660B" stroke-width="7" stroke-linecap="round"/><path d="M62 24 q12 20 0 48" fill="none" stroke="#E9A825" stroke-width="8" stroke-linecap="round"/>',
    mads: '<circle cx="28" cy="28" r="15" fill="#C2415C"/><circle cx="62" cy="28" r="15" fill="#E57373"/><circle cx="28" cy="62" r="15" fill="#E57373"/><circle cx="62" cy="62" r="15" fill="#C2415C"/>',
    myb: '<g fill="none" stroke-width="7" stroke-linecap="round"><path d="M12 54 q4 -30 12 -30" stroke="#2E7D32"/><path d="M30 60 q4 -34 12 -34" stroke="#43A047"/><path d="M48 54 q4 -30 12 -30" stroke="#66BB6A"/><path d="M66 60 q4 -34 12 -34" stroke="#81C784"/></g><text x="45" y="84" text-anchor="middle" class="mg-ts">R1 R2 R3</text>',
    bhlh: '<path d="M18 74 V30 q0 -10 10 -10 q10 0 10 10 V74" fill="none" stroke="#1565C0" stroke-width="8" stroke-linecap="round"/><path d="M52 74 V30 q0 -10 10 -10 q10 0 10 10 V74" fill="none" stroke="#42A5F5" stroke-width="8" stroke-linecap="round"/><rect x="10" y="74" width="70" height="5" rx="2.5" fill="#4A78C8"/>',
    wrky: '<text x="12" y="52" style="font:800 30px Georgia;fill:#7B3FA0">WRKY</text><circle cx="46" cy="68" r="8" fill="#9AA79D"/><text x="46" y="72" text-anchor="middle" style="font:800 9px system-ui;fill:#fff">Zn</text>',
  };
  let sel = 2;
  const list = el('div', { class: 'mg-tfs' });
  const info = el('div', { class: 'mg-info mg-tfinfo', 'aria-live': 'polite' });
  F.forEach((f, i) => {
    const b = el('button', { type: 'button', class: 'mg-tf', 'aria-pressed': 'false' });
    b.innerHTML = `<svg viewBox="0 0 90 90" aria-hidden="true">${G[f[5]]}</svg><b>${f[1]}</b>`;
    b.addEventListener('click', () => show(i)); list.append(b);
  });
  function show(i) {
    sel = i; $$('.mg-tf', list).forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    const f = F[i];
    info.innerHTML = `<div class="mg-tfinfo__g"><svg viewBox="0 0 90 90" aria-hidden="true">${G[f[5]]}</svg></div><div><h4>${f[1]} <small>${f[2]}</small></h4><p><b>Як зв'язується з ДНК.</b> ${f[3]}</p><p><b>Приклади й функції.</b> ${f[4]}</p></div>`;
  }
  root.append(list, info);
  show(sel);
});

// ------------------------------------------------------------------ акронім MADS
register('mads-name', (root) => {
  const P = [['M', 'MCM1', 'дріжджі', 'Білок підтримання мініхромосом'], ['A', 'AGAMOUS', 'арабідопсис', 'Мутант <i>agamous</i> — махрова квітка'], ['D', 'DEFICIENS', 'левиний зів', 'Мутант <i>deficiens</i> — недорозвинені пелюстки й тичинки'], ['S', 'SRF', 'людина', 'Фактор відповіді на сироватку (<i>serum response factor</i>)']];
  const row = el('div', { class: 'mg-mads' });
  const info = el('div', { class: 'mg-info' }, 'Натискайте на літери: у слові MADS зашифровано чотири перші білки з цим доменом — у дріжджів, рослин і людини.');
  P.forEach((p, i) => {
    const b = el('button', { type: 'button', 'aria-pressed': 'false' }, el('b', null, p[0]), el('small', null, p[2]));
    b.addEventListener('click', () => { $$('button', row).forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); info.innerHTML = `<h4>${p[0]} = ${p[1]} <small>(${p[2]})</small></h4><p>${p[3]}.</p>`; });
    row.append(b);
  });
  root.append(row, info);
});

// ------------------------------------------------------------------ MBW-комплекс
register('mbw', (root) => {
  const B = [['GL3', 'GL3 / EGL3'], ['TT8', 'TT8'], ['X', 'інший bHLH']];
  const M = [['GL1', 'GL1 (MYB)'], ['TT2', 'TT2 (MYB)'], ['ACT', 'MYB-активатор антоціанів'], ['REP', 'MYB-репресор']];
  let b = 'GL3', m = 'GL1';
  const r1 = el('div', { class: 'mg-opts' }), r2 = el('div', { class: 'mg-opts' });
  options(r1, B.map((x) => ({ v: x[0], t: x[1] })), b, (v) => { b = v; draw(); });
  options(r2, M.map((x) => ({ v: x[0], t: x[1] })), m, (v) => { m = v; draw(); });
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 270', role: 'img', 'aria-label': 'MBW-комплекс: WD40 TTG1 як платформа, bHLH і MYB' });
  const out = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function result() {
    if (m === 'REP') return ['репресія', '#C0573E', 'MYB-репресор у складі комплексу конкурує з активаторами за місце: експресія генів-мішеней падає (так працює, напр., MYB27 петунії в темряві; подібний комплекс діє репресором в кореневих волосках).'];
    if (m === 'GL1' && b === 'GL3') return ['розвиток трихом', '#2E7D32', 'Комплекс TTG1 + GL3/EGL3 + GL1 запускає розвиток трихом (волосків) на листках.'];
    if (m === 'TT2' && b === 'TT8') return ['пігментація насіннєвої шкірки', '#A8660B', 'Комплекс TTG1 + TT8 + TT2 (<i>TRANSPARENT TESTA</i>) відповідає за пігментацію насіннєвої шкірки; мутанти <i>tt</i> — прозора («transparent») шкірка.'];
    if (m === 'ACT') return ['синтез антоціанів', '#C2415C', 'Один комплекс запускає цілий процес: активує практично всі гени біосинтезу антоціанів — від PAL до антоціанідинсинтази, глікозилтрансферази й гени транспорту у вакуолю.'];
    return ['інший процес', '#7B3FA0', 'Ця комбінація не винесена в окремий приклад. Загальне правило: WD40 майже всюди, bHLH частково спеціалізовані, MYB — вузькоспецифічні; саме пара bHLH + MYB визначає, <b>який</b> процес запуститься (слиз насіннєвої шкірки, жири, запасні білки, час цвітіння, відповіді на стреси).'];
  }
  function draw() {
    const [proc, col, txt] = result(); const act = m !== 'REP';
    let h = '<rect width="640" height="270" rx="14" fill="#FBFDFB"/>';
    // WD40 пропелер
    h += `<g transform="translate(320 96)"><path d="M0 -58 L22 -50 L48 -26 L48 12 L22 44 L-22 44 L-48 12 L-48 -26 L-22 -50Z" fill="#F0E6FB" stroke="#7B3FA0" stroke-width="3"/><g stroke="#7B3FA0" stroke-width="2" opacity=".5"><path d="M0 -8 L0 -52 M0 -8 L40 -28 M0 -8 L40 14 M0 -8 L0 40 M0 -8 L-40 14 M0 -8 L-40 -28"/></g><text y="2" text-anchor="middle" class="mg-tb" style="font-size:14px;fill:#4A2A7A">TTG1</text><text y="20" text-anchor="middle" class="mg-ts">WD40 · платформа</text></g>`;
    h += `<g><path d="M276 120 C240 140 220 150 200 156" stroke="#7A8A7E" stroke-width="2" fill="none"/><ellipse cx="170" cy="164" rx="52" ry="26" fill="#1565C0"/><text x="170" y="168" text-anchor="middle" style="font:800 12px system-ui;fill:#fff">bHLH: ${b === 'X' ? '…' : b === 'GL3' ? 'GL3' : 'TT8'}</text></g>`;
    h += `<g><path d="M364 120 C400 140 420 150 440 156" stroke="#7A8A7E" stroke-width="2" fill="none"/><ellipse cx="470" cy="164" rx="52" ry="26" fill="${act ? '#2E7D32' : '#C0573E'}"/><text x="470" y="168" text-anchor="middle" style="font:800 12px system-ui;fill:#fff">MYB: ${m === 'REP' ? 'репресор' : m === 'ACT' ? 'актив.' : m}</text></g>`;
    h += '<path d="M60 230 H580" stroke="#4A78C8" stroke-width="3"/>';
    h += `<rect x="260" y="214" width="120" height="30" rx="7" fill="${act ? col : '#9AA79D'}"/><text x="320" y="233" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">гени-мішені</text>`;
    h += `<path d="M320 160 V208" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)" stroke-dasharray="${act ? 0 : '5 4'}"/>`;
    h += `<text x="320" y="262" text-anchor="middle" class="mg-tb" style="fill:${col}">→ ${proc}</text>`;
    s.innerHTML = h;
    out.innerHTML = `<h4>${proc}</h4><p>${txt}</p>`;
  }
  const tbl = el('div', { class: 'mg-cards' });
  tbl.innerHTML = '<div style="--c:#7B3FA0"><b>WD40 (TTG1)</b><p>Мало копій у геномі, експресія майже скрізь — «чекає», хто приєднається.</p></div><div style="--c:#1565C0"><b>bHLH</b><p>Помірно, частково спеціалізовані.</p></div><div style="--c:#2E7D32"><b>MYB</b><p>Суперродина: вузькоспецифічні (певні тканини, клітини, умови); активатори <i>або</i> репресори.</p></div>';
  root.append(el('div', { class: 'mg-ts', style: 'margin-bottom:4px;font-weight:700' }, 'Оберіть bHLH-партнера'), r1, el('div', { class: 'mg-ts', style: 'margin-bottom:4px;font-weight:700' }, 'Оберіть MYB-партнера'), r2, s, out, tbl);
  draw();
});

// ------------------------------------------------------------------ петунія: чотири MYB-активатори
register('petunia-myb', (root) => {
  const A = {
    AN2: ['AN2 (ANTHOCYANIN2)', 'відгин (лімб) віночка', '#B0256B', 'Забарвлює відгин зрослопелюсткового віночка; біла незабарвлена пляма в зіві.'],
    AN4: ['AN4', 'трубка віночка', '#7B1FA2', 'Якщо діє лише він — чітка кругла пляма в центрі (трубка).'],
    DPL: ['DPL (DEEP PURPLE)', 'жилки', '#4A148C', 'Прив\'язаний до жилок: глибоке малинове жилкування.'],
    PHZ: ['PHZ (PURPLE HAZE)', 'зворотний бік пелюсток, чашолистки, бруньки', '#8E24AA', '«Пурпуровий серпанок» на зворотному боці пелюсток і в чашолистках, у бутонах; індукується світлом — захист від УФ.'],
  };
  const on = { AN2: true, AN4: false, DPL: false, PHZ: false };
  let light = 'sun';
  const row = el('div', { class: 'mg-opts' });
  Object.entries(A).forEach(([k, v]) => row.append(tgl(v[0], on[k], (x) => { on[k] = x; draw(); })));
  const row2 = el('div', { class: 'mg-opts' });
  options(row2, [{ v: 'sun', t: '☀ яскраве світло / УФ' }, { v: 'dark', t: '☾ тінь / темрява' }], 'sun', (v) => { light = v; draw(); });
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 300', role: 'img', 'aria-label': 'Квітка петунії: зони дії AN2, AN4, DPL, PHZ' });
  const out = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function draw() {
    const k = light === 'sun' ? 1 : .45;
    const col = (key) => (on[key] ? A[key][2] : null);
    const limb = on.AN2 ? A.AN2[2] : '#F6EEF2';
    const tube = on.AN4 ? A.AN4[2] : '#F6EEF2';
    let h = '<rect width="640" height="300" rx="14" fill="#FBFDFB"/>';
    // вигляд зверху
    h += '<g transform="translate(170 148)">';
    for (let i = 0; i < 5; i++) h += `<g transform="rotate(${i * 72})"><path d="M0 0 C-48 -30 -56 -92 0 -112 C56 -92 48 -30 0 0Z" fill="${limb}" fill-opacity="${on.AN2 ? k : 1}" stroke="#C9AFBF" stroke-width="2"/>${on.DPL ? `<path d="M0 -10 V-100 M0 -40 L-22 -78 M0 -40 L22 -78" stroke="${A.DPL[2]}" stroke-width="3.2" stroke-linecap="round" opacity="${(.6 + k * .4).toFixed(2)}" fill="none"/>` : `<path d="M0 -10 V-100 M0 -40 L-22 -78 M0 -40 L22 -78" stroke="#E4D3DC" stroke-width="2" fill="none"/>`}</g>`;
    h += `<circle r="34" fill="${tube}" fill-opacity="${on.AN4 ? k : 1}" stroke="#C9AFBF" stroke-width="2"/><circle r="12" fill="#F7E9A8"/></g>`;
    h += '<text x="170" y="22" text-anchor="middle" class="mg-tb">Віночок зверху</text>';
    // зворотний бік / чашолистки
    h += '<g transform="translate(470 150)"><text y="-120" text-anchor="middle" class="mg-tb">Зворотний бік і чашечка</text>';
    for (let i = 0; i < 5; i++) h += `<g transform="rotate(${i * 72 + 36})"><path d="M0 0 C-30 -20 -34 -64 0 -82 C34 -64 30 -20 0 0Z" fill="${on.PHZ ? A.PHZ[2] : '#E3EFD3'}" fill-opacity="${on.PHZ ? .35 + .65 * k : 1}" stroke="#9FB77F" stroke-width="2"/></g>`;
    h += `<circle r="16" fill="#9FC270"/><text y="112" text-anchor="middle" class="mg-ts">PHZ: світлозалежний «серпанок»</text></g>`;
    h += `<g class="mg-ts"><text x="170" y="290" text-anchor="middle">відгин — AN2 · трубка — AN4 · жилки — DPL</text></g>`;
    s.innerHTML = h;
    const act = Object.keys(on).filter((x) => on[x]);
    const names = act.map((x) => A[x][0].split(' ')[0]).join(' + ') || 'жоден';
    out.innerHTML = `<p><b>Активні MYB:</b> ${names}.</p>` + act.map((x) => `<p><b>${A[x][0].split(' ')[0]}:</b> ${A[x][3]}</p>`).join('') +
      (light === 'sun' ? '<p><b>Світло:</b> різко зростає експресія MYB-активаторів (переважно <i>PHZ</i>, трохи <i>DPL</i>) — рослини «засмагають»; рівень WD40 і bHLH майже незмінний.</p>' : '<p><b>Тінь:</b> зростає експресія MYB-репресора <b>MYB27</b> — він конкурує за місце в комплексі, антоціанів стає менше.</p>');
  }
  root.append(row, row2, s, out);
  draw();
});

// ------------------------------------------------------------------ pH вакуолі і відтінок
register('vacuole-ph', (root) => {
  const ctl = el('div');
  const S = sliders(ctl, [{ id: 'ph', label: 'pH вакуолярного соку', min: 4.5, max: 7.5, step: 0.1, value: 5.2, digits: 1, hint: 'Протонні P-АТФази тонопласта (PH1, PH5 петунії) підкислюють вакуолю.' }], upd);
  const sw = el('div', { class: 'mg-ph' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  root.append(ctl, sw, info);
  function mix(a, b, t) { return a.map((v, i) => Math.round(lerp(v, b[i], t))); }
  function upd() {
    const ph = S.values.ph; const t = (ph - 4.5) / 3;
    const stops = [[214, 40, 80], [160, 40, 140], [92, 70, 190], [60, 100, 200]];
    const x = t * 3; const i = Math.min(2, Math.floor(x)); const c = mix(stops[i], stops[i + 1], x - i);
    const rgb = `rgb(${c.join(',')})`;
    sw.innerHTML = `<svg viewBox="0 0 300 120" class="mg-svg" role="img" aria-label="Колір пелюстки залежно від pH"><rect width="300" height="120" rx="14" fill="#FBFDFB"/><g transform="translate(150 66)">${Array.from({ length: 5 }, (_, k) => `<path transform="rotate(${k * 72})" d="M0 0 C-24 -14 -26 -46 0 -54 C26 -46 24 -14 0 0Z" fill="${rgb}"/>`).join('')}<circle r="7" fill="#F7E9A8"/></g></svg>`;
    info.innerHTML = ph < 5.4 ? '<b>Кисла вакуоля</b> — пігмент у червоній (флавілієвій) формі: червоно-рожеві відтінки.'
      : ph < 6.6 ? '<b>Помірне підкислення</b> — фіолетові відтінки; кінцевий pH вакуолярного соку визначає відтінок кольору.'
        : '<b>Майже нейтральна вакуоля</b> — синюватий колір. Без підкислення вакуолі накопичення антоціанів неможливе, а мутація <i>ph</i> зсуває колір до синього.';
  }
  upd();
});

// ------------------------------------------------------------------ ремоделювання хроматину
register('remodel', (root) => {
  const M = {
    assembly: ['Збирання (assembly)', 'АТФ-залежний комплекс збирає нові нуклеосоми на вільній ДНК.'],
    sliding: ['Ковзання (sliding)', 'Нуклеосома пересувається вздовж ДНК, не втрачаючи зв\'язку; відкривається проміжок із промотором.'],
    eviction: ['«Виселення» (eviction)', 'Нуклеосому розбирають: ДНК розплітається й активується — ген стає доступним для транскрипції.'],
    unwrapping: ['Розмотування (unwrapping)', 'Послаблюється зв\'язок ДНК з гістонами: частина витків відпускає ДНК.'],
    exchange: ['Заміна гістонів (exchange)', 'Гістони замінюються варіантами; складу октамеру змінюється, а з ним — конформація ДНК.'],
  };
  let mode = 'eviction', t = 0, dir = 0;
  const row = el('div', { class: 'mg-opts' });
  options(row, Object.entries(M).map(([k, v]) => ({ v: k, t: v[0] })), mode, (v) => { mode = v; t = 0; dir = 0; draw(); });
  const go = el('button', { type: 'button', class: 'mg-btn' }, '▶ Запустити ремоделер');
  const rs = el('button', { type: 'button', class: 'mg-btn mg-btn--o' }, '↺ Скинути');
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 200', role: 'img', 'aria-label': 'Нуклеосоми на ДНК та дії ремоделера' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  root.append(row, el('div', { class: 'mg-row' }, go, rs), s, info);
  go.addEventListener('click', () => { dir = 1; t = t >= 1 ? 0 : t; });
  rs.addEventListener('click', () => { t = 0; dir = 0; draw(); });
  const ease = (x) => x * x * (3 - 2 * x);
  function nuc(x, wrap, col, op) {
    const r = 22;
    return `<g transform="translate(${x} 100)" opacity="${op}"><circle r="${r}" fill="${col}" stroke="#5A3E96" stroke-width="2.5"/><circle r="${r - 8}" fill="#fff" opacity=".35"/><path d="M${-r - 2} 8 a${r + 2} ${r + 2} 0 0 1 ${2 * r + 4} 0" fill="none" stroke="#4A78C8" stroke-width="5" stroke-dasharray="${(wrap * 70).toFixed(0)} 100" opacity="${(.35 + wrap * .65).toFixed(2)}"/></g>`;
  }
  function draw() {
    const e = ease(clamp(t, 0, 1));
    let h = '<rect width="640" height="200" rx="14" fill="#FBFDFB"/><path d="M14 128 H626" stroke="#4A78C8" stroke-width="4"/>';
    h += `<rect x="404" y="140" width="84" height="26" rx="6" fill="${(mode === 'eviction' || mode === 'sliding') && e > .6 ? '#2E7D32' : '#9AA79D'}"/><text x="446" y="158" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">промотор</text>`;
    const P = '#B7A4D9', Q = '#E9B8A0';
    if (mode === 'assembly') {
      h += nuc(90, 1, P, 1) + nuc(150, 1, P, 1);
      [260, 320, 380].forEach((x, i) => { const o = clamp(e * 3 - i, 0, 1); h += nuc(x, 1, P, o.toFixed(2)); });
    } else if (mode === 'sliding') {
      h += nuc(90, 1, P, 1) + nuc(lerp(430, 540, e), 1, P, 1) + nuc(250, 1, P, 1);
    } else if (mode === 'eviction') {
      h += nuc(90, 1, P, 1) + nuc(160, 1, P, 1) + nuc(446, 1, P, (1 - e).toFixed(2)) + nuc(530, 1, P, 1);
      if (e > .5) h += `<path d="M430 96 q8 -20 16 0 t16 0" fill="none" stroke="#C2415C" stroke-width="3"/><text x="446" y="76" text-anchor="middle" class="mg-ts" style="fill:#C2415C">транскрипція</text>`;
    } else if (mode === 'unwrapping') {
      h += nuc(90, 1, P, 1) + nuc(160, 1, P, 1) + nuc(446, 1 - e * .8, P, 1) + nuc(530, 1, P, 1);
    } else {
      const col = e < .5 ? P : Q;
      h += nuc(90, 1, P, 1) + nuc(160, 1, P, 1) + nuc(446, 1, col, 1) + nuc(530, 1, P, 1);
    }
    h += '<g transform="translate(300 40)"><rect x="-80" y="-14" width="160" height="26" rx="13" fill="#E9A825"/><text y="4" text-anchor="middle" style="font:800 11px system-ui">АТФ-залежний ремоделер</text></g>';
    h += `<path d="M300 54 V${mode === 'sliding' || mode === 'eviction' ? 94 : 94}" stroke="#46584C" stroke-width="2" stroke-dasharray="4 4"/>`;
    s.innerHTML = h;
    info.innerHTML = `<h4>${M[mode][0]}</h4><p>${M[mode][1]}</p>`;
  }
  loop(root, (dt) => { if (dir && t < 1) { t = Math.min(1, t + dt / 1.8); draw(); if (t >= 1) dir = 0; } });
  draw();
});

// ------------------------------------------------------------------ яровизація: FLC
register('vernal', (root) => {
  const ctl = el('div');
  const S = sliders(ctl, [{ id: 'w', label: 'Тривалість охолодження (умовні тижні)', min: 0, max: 12, step: 1, value: 0, digits: 0, hint: 'Якісна ілюстрація: показано лише принцип — тривале охолодження вимикає <i>FLC</i> через епігенетичне пакування хроматину.' }], upd);
  const out = el('div', { class: 'mg-info', 'aria-live': 'polite' }); const sv = el('div');
  root.append(ctl, sv, out);
  function upd() {
    const w = S.values.w; const flc = 1 / (1 + Math.exp((w - 6) * 0.9)); // активність FLC
    const fl = 1 - flc;
    const nuc = Array.from({ length: 10 }, (_, i) => { const dense = fl; return `<circle cx="${40 + i * (lerp(60, 31, dense))}" cy="26" r="${lerp(9, 12, dense)}" fill="${fl > .5 ? '#8B6FC8' : '#D8CDF0'}" stroke="#6A4BA8" stroke-width="1.5"/>`; }).join('');
    sv.innerHTML = `<svg viewBox="0 0 640 150" class="mg-svg" role="img" aria-label="Ген FLC: активність і хроматин після охолодження"><rect width="640" height="150" rx="14" fill="#FBFDFB"/>
      <text x="16" y="20" class="mg-ts">хроматин гена FLC</text><g transform="translate(0 8)">${nuc}</g>
      <rect x="16" y="64" width="${Math.max(3, flc * 300)}" height="16" rx="8" fill="#C0573E"/><text x="330" y="77" class="mg-t" style="font-weight:700">активність FLC (репресор цвітіння) ${Math.round(flc * 100)} %</text>
      <rect x="16" y="94" width="${Math.max(3, fl * 300)}" height="16" rx="8" fill="#2E7D32"/><text x="330" y="107" class="mg-t" style="font-weight:700">здатність до цвітіння ${Math.round(fl * 100)} %</text>
      <text x="16" y="136" class="mg-ts">${fl > .6 ? 'ген «замкнений» у щільному хроматині — після потепління рослина зацвіте' : 'ген активний — рослина лишається вегетативною («зимовий» стан)'}</text></svg>`;
    out.innerHTML = '<p>Цей механізм — частина загальної ролі системи Polycomb: перемикання фаз розвитку. Так само на проростання насіння впливає <b>стратифікація</b> (тривале охолодження).</p>';
  }
  upd();
});
