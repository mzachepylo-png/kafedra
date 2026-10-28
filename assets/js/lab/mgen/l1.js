// Лекція 1. Модельні об'єкти та геноми: інтерактивні блоки.
import { register, el, svg, options, stepper, clamp, rnd, $, $$ } from './util.js';
import { sliders } from '../ui.js';

const L1 = 'var(--l1)';

// ------------------------------------------------------------------ хронологія арабідопсису
register('timeline', (root) => {
  const EV = [
    ['1577', 'Йоганн Таль', 'У горах Гарц (Німеччина) лікар Таль знаходить непоказну рослину й описує її як <i>Pilosella siliquosa</i> — «пухнаста стручкова» (опушене листя і плоди-стручки). Це ще донаукова, добінарна номенклатура.'],
    ['1753', 'Карл Лінней', 'Перейменовує рослину на <i>Arabis thaliana</i> (резуха Таля) — на честь першовідкривача.'],
    ['1842', 'Густав Гейнгольд', 'Під час ревізії роду <i>Arabis</i> виділяє рід <i>Arabidopsis</i>. Повна назва — <i>Arabidopsis thaliana</i> (L.) Heynh.: у дужках автор першого опису, далі — автор нової комбінації.'],
    ['1935', 'Н. Титова (за дорученням Вавилова)', 'Експедиція, що шукала «ботанічну дрозофілу», публікує звіт у «Советской ботанике»: арабідопсис уперше названо перспективним об\'єктом генетики. Через утиски генетики в СРСР роботи не мали продовження.'],
    ['1943', 'Фрідріх Лайбах*', 'У Німеччині обґрунтовує придатність арабідопсису як модельного об\'єкта. <small>* У лекції не згадано — додано для повноти.</small>'],
    ['1956–57', 'Георг Редеї', 'Виїздить до США (Колумбія, штат Міссурі), вирощує арабідопсис у теплиці «як хобі», добирає й схрещує раси та накопичує цінну колекцію мутантів. Раса Columbia (Col) походить саме з цієї колекції.'],
    ['1982', 'Маартен Корнеф', 'Нідерланди: захищає дисертацію з арабідопсису, багато працює з мутагенезом, будує першу генетичну карту (76 ознак/маркерів). Його колекція мутантів — одна з основних у світі.'],
    ['2000', 'Геном секвеновано', 'Арабідопсис — перша рослина з прочитаним геномом: ~135 Мб і ~25–27 тис. генів. Малий геном — зручна «ємність», знання з якої переносять на складніші види.'],
  ];
  const box = el('div', { class: 'mg-tl' });
  const ol = el('ol');
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const btns = EV.map((e, i) => {
    const b = el('button', { type: 'button', 'aria-pressed': 'false' }, el('b', null, e[0]), el('span', null, e[1]));
    b.addEventListener('click', () => show(i));
    ol.append(el('li', null, b)); return b;
  });
  function show(i) {
    btns.forEach((b, j) => { b.setAttribute('aria-pressed', String(j === i)); b.parentNode.classList.toggle('is-past', j < i); });
    info.innerHTML = `<h4>${EV[i][0]} · ${EV[i][1]}</h4><p>${EV[i][2]}</p>`;
  }
  box.append(ol);
  root.append(box, info);
  show(0);
});

// ------------------------------------------------------------------ екотипи
register('ecotypes', (root) => {
  const E = [
    ['Col', 'Columbia', 'Відібрана в США (Колумбія, Міссурі) з колекції Редеї. Найпопулярніший «дикий тип»; саме її геном секвеновано першим.', '#2E7D32'],
    ['Ler', 'Landsberg <i>erecta</i>', 'Низькоросла компактна раса. Несе мутацію <i>erecta</i> (карликовість), тому не є «чистим» диким типом — аналізуючи мутації, потрібно враховувати цей фон.', '#1565C0'],
    ['Ws', 'Wassilewskija', 'За лекцією — виведена в Польщі (за іншими даними походить з Білорусі/Росії).', '#A8660B'],
    ['Cvi', 'Cape Verde Islands', 'Походить з островів Зеленого Мису — крайній південний, «тропічний» полюс різноманітності.', '#C2415C'],
    ['Di', 'Dijon', 'З околиць Діжона (Франція; поля регіону гірчиці). Передана МДУ, де з 1980-х на кафедрі генетики її піддавали радіаційному й хімічному мутагенезу. Московська лінія, що помітно відрізняється від французької, названа <b>Dijon-M</b>.', '#7B3FA0'],
  ];
  const row = el('div', { class: 'mg-opts' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const o = options(row, E.map((e) => ({ v: e[0], t: e[0], c: e[3] })), 'Col', show);
  function show(v) { const e = E.find((x) => x[0] === v); info.innerHTML = `<h4>${e[0]} — ${e[1]}</h4><p>${e[2]}</p>`; o.set(v); }
  root.append(row, info);
  show('Col');
});

// ------------------------------------------------------------------ розміри геномів
register('genomes', (root) => {
  const D = [
    ['Arabidopsis thaliana', 'Арабідопсис', 135, 'Секвеновано 2000 р.; ~25–27 тис. генів. Малий геном — головна зручність моделі.'],
    ['Oryza sativa', 'Рис', 400, 'Серед злаків — один із найменших геномів.'],
    ['Solanum tuberosum', 'Картопля', 800, '2n = 48, але геном ≈ 0,8 Гб — число хромосом не корелює напряму з розміром геному.'],
    ['Solanum lycopersicum', 'Томат', 900, 'Родина Пасльонових: ряд картопля → томат → баклажан → петунія → тютюн → перець.'],
    ['Zea mays', 'Кукурудза', 2300, '≈ 2,3 Гб; значну частку займають ретротранспозони.'],
    ['Nicotiana tabacum', 'Тютюн', 4500, 'Алотетраплоїд: поєднує геноми <i>N. sylvestris</i> і <i>N. tomentosiformis</i>.'],
    ['Abies / хвойні', 'Ялиця (хвойні)', 20000, 'До ~20 Гб — розмір геному не залежить від життєвої форми: є дерева й трави і з малими, і з великими геномами.'],
  ];
  let log = true, sel = 0;
  const bar = el('div', { class: 'mg-row' });
  const sc = el('div', { class: 'mg-opts', style: 'margin:0' });
  options(sc, [{ v: 'log', t: 'Логарифмічна шкала' }, { v: 'lin', t: 'Лінійна шкала' }], 'log', (v) => { log = v === 'log'; draw(); });
  bar.append(sc);
  const list = el('div', { class: 'mg-bars' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const fmt = (m) => (m >= 1000 ? (m / 1000).toLocaleString('uk', { maximumFractionDigits: 1 }) + ' Гб' : m + ' Мб');
  function draw() {
    list.innerHTML = '';
    const lo = Math.log10(100), hi = Math.log10(30000);
    D.forEach((d, i) => {
      const w = log ? (Math.log10(d[2]) - lo) / (hi - lo) * 100 : d[2] / 20000 * 100;
      const row = el('button', { type: 'button', class: 'mg-bars__r' + (i === sel ? ' is-sel' : ''), 'aria-pressed': String(i === sel) },
        el('span', { class: 'mg-bars__l' }, d[1]), el('span', { class: 'mg-bars__t' }, el('i', { style: `width:${Math.max(1.5, w)}%` })), el('span', { class: 'mg-bars__v' }, fmt(d[2])));
      row.addEventListener('click', () => { sel = i; draw(); });
      list.append(row);
    });
    const d = D[sel];
    info.innerHTML = `<h4>${d[1]} · <i>${d[0]}</i> · ${fmt(d[2])}</h4><p>${d[3]}</p>`;
  }
  root.append(bar, list, info);
  draw();
});

// ------------------------------------------------------------------ еволюція пшениці
register('wheat', (root) => {
  const N = {
    tu: { x: 80, y: 60, t: '<i>T. urartu</i>', g: 'AA', p: 'диплоїд, 2n = 14', i: 'Дика диплоїдна пшениця — донор генома A (вихідна лінія: дика однозернянка <i>T. boeoticum</i> з Малої Азії та Греції). Росте на порушених місцях.', c: ['#2E7D32'] },
    as: { x: 80, y: 190, t: '<i>Ae. speltoides</i>', g: 'BB', p: 'диплоїд, 2n = 14', i: 'Егілопс «циліндричні колоски» — бур\'ян давніх полів. Донор генома B (G). Спонтанна гібридизація з ним дала форми з вищою врожайністю й крупнішим зерном.', c: ['#1565C0'] },
    t4: { x: 270, y: 125, t: 'Емер / тверда', g: 'AABB', p: 'тетраплоїд, 2n = 28', i: 'Результат гібридизації <i>T. urartu</i> × <i>Ae. speltoides</i> з подальшим подвоєнням хромосом — алотетраплоїд. Геноми A і B «співіснують» в одному ядрі.', c: ['#2E7D32', '#1565C0'] },
    at: { x: 270, y: 245, t: '<i>Ae. tauschii</i>', g: 'DD', p: 'диплоїд, 2n = 14', i: '<i>Ae. squarrosa</i> («розчепірений») — донор генома D.', c: ['#C2415C'] },
    t6: { x: 480, y: 185, t: 'М\'яка пшениця', g: 'AABBDD', p: 'гексаплоїд, 2n = 42', i: 'Тетраплоїд × <i>Ae. tauschii</i>: утричі більше хромосом, ніж у вихідної диплоїдної пшениці. Багато генів представлені трьома гомеологічними копіями, не всі працюють; є гетерозисна сила, більша врожайність і фізіологічна пластичність, але вивчати такий об\'єкт складно.', c: ['#2E7D32', '#1565C0', '#C2415C'] },
  };
  const links = [['tu', 't4'], ['as', 't4'], ['t4', 't6'], ['at', 't6']];
  const W = 620, H = 330;
  const s = svg('svg', { class: 'mg-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Схема еволюції пшениці: геноми A, B і D' });
  let showChr = false, sel = 't6';
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const ctl = el('div', { class: 'mg-row' });
  const chk = el('button', { type: 'button', class: 'mg-opt', 'aria-pressed': 'false' }, 'Показати хромосоми');
  chk.addEventListener('click', () => { showChr = !showChr; chk.setAttribute('aria-pressed', String(showChr)); draw(); });
  ctl.append(chk, el('span', { class: 'mg-out' }, 'натисніть на вузол'));
  function draw() {
    let h = '<defs><marker id="wm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7A8A7E"/></marker></defs>';
    links.forEach(([a, b]) => { const A = N[a], B = N[b]; h += `<path d="M${A.x + 62} ${A.y} C${A.x + 130} ${A.y} ${B.x - 70} ${B.y} ${B.x - 62} ${B.y}" fill="none" stroke="#9AA79D" stroke-width="2.2" marker-end="url(#wm)"/>`; });
    h += `<text x="196" y="156" class="mg-ts" text-anchor="middle" transform="rotate(-48 196 156)">× гібридизація</text><text x="404" y="160" class="mg-ts" text-anchor="middle" transform="rotate(-30 404 160)">× гібридизація</text>`;
    for (const [k, n] of Object.entries(N)) {
      const on = k === sel;
      h += `<g class="mg-hot${on ? ' is-sel' : ''}" data-k="${k}" tabindex="0" role="button" aria-label="${n.g}">`;
      h += `<rect x="${n.x - 66}" y="${n.y - 36}" width="132" height="72" rx="14" fill="${on ? '#FFF6D9' : '#fff'}" stroke="${on ? '#C9A227' : '#B7C4B9'}" stroke-width="${on ? 3 : 1.6}"/>`;
      h += `<text x="${n.x}" y="${n.y - 17}" text-anchor="middle" class="mg-t" style="font-style:${n.t.includes('<i>') ? 'italic' : 'normal'}">${n.t.replace(/<[^>]+>/g, '')}</text>`;
      h += `<text x="${n.x}" y="${n.y + 4}" text-anchor="middle" class="mg-th" style="font-size:19px">${n.g}</text>`;
      h += `<text x="${n.x}" y="${n.y + 20}" text-anchor="middle" class="mg-ts">${n.p.split(',')[0]}</text>`;
      if (showChr) {
        const cols = n.c; const nb = n.g.length / 2 * 7; let bx = n.x - nb * 4;
        for (let i = 0; i < nb; i++) h += `<rect x="${bx + i * 8}" y="${n.y + 40}" width="5" height="14" rx="2.5" fill="${cols[Math.floor(i / 7)]}"/>`;
      }
      h += '</g>';
    }
    s.innerHTML = h;
    $$('.mg-hot', s).forEach((g) => { const f = () => { sel = g.dataset.k; draw(); }; g.addEventListener('click', f); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } }); });
    const n = N[sel];
    info.innerHTML = `<h4>${n.t} · ${n.g} <small>(${n.p})</small></h4><p>${n.i}</p>`;
  }
  root.append(ctl, s, info);
  draw();
});

// ------------------------------------------------------------------ цикл ретротранспозиції (copy–paste)
register('retrocycle', (root) => {
  const ST = [
    ['Транскрипція', 'Активна копія ретроелемента в геномі транскрибується → утворюється РНК-копія.'],
    ['Зворотна транскрипція', 'Зворотна транскриптаза (RT) синтезує ДНК на матриці РНК.'],
    ['РНКаза H і другий ланцюг', 'РНКаза H видаляє РНК із гібрида РНК/ДНК, добудовується другий ланцюг — виходить двоколанцюгова ДНК-копія.'],
    ['Розріз у новому місці', 'Інтеграза (ендонуклеазна активність) робить розріз ДНК у новому місці хромосоми.'],
    ['Вставка: копій побільшало', 'Копію вбудовано. Старий елемент лишається на місці — геном росте: принцип «copy–paste».'],
  ];
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 250', role: 'img', 'aria-label': 'Цикл ретротранспозиції' });
  const cap = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const bar = el('div');
  const el_ = (x, y, w, f = '#2E7D32', l = '') => `<rect x="${x}" y="${y}" width="${w}" height="22" rx="5" fill="${f}"/><text x="${x + w / 2}" y="${y + 15}" text-anchor="middle" style="font:700 10px system-ui;fill:#fff">${l}</text>`;
  const chrom = (y, extra = '') => `<rect x="30" y="${y}" width="580" height="12" rx="6" fill="#C9D7CB"/>${extra}`;
  function scene(i) {
    let h = '<defs><marker id="rm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#46584C"/></marker></defs>';
    h += `<text x="30" y="24" class="mg-tb">Хромосома</text>`;
    h += chrom(100, el_(120, 95, 110, '#2E7D32', 'ретроелемент'));
    h += `<text x="175" y="132" text-anchor="middle" class="mg-ts">активна копія</text>`;
    if (i >= 0) h += `<g opacity="${i === 0 ? 1 : .35}"><path d="M175 92 C175 60 210 50 240 50" fill="none" stroke="#46584C" stroke-width="2" marker-end="url(#rm)"/><path d="M245 50 q10 -9 20 0 t20 0 t20 0 t20 0" fill="none" stroke="#C2415C" stroke-width="3"/><text x="355" y="46" class="mg-t">РНК-копія</text></g>`;
    if (i >= 1) h += `<g><path d="M355 54 C380 70 400 80 420 84" fill="none" stroke="#46584C" stroke-width="2" marker-end="url(#rm)"/><text x="425" y="70" class="mg-t">RT</text><circle cx="450" cy="66" r="14" fill="#E9A825"/><text x="450" y="70" text-anchor="middle" style="font:800 11px system-ui">RT</text></g>`;
    if (i >= 1) h += `<g transform="translate(400 170)"><path d="M0 0 q10 -9 20 0 t20 0 t20 0" fill="none" stroke="#C2415C" stroke-width="3" opacity="${i === 1 ? 1 : 0}"/><rect x="0" y="9" width="62" height="6" rx="3" fill="#1565C0"/><text x="70" y="14" class="mg-t">ДНК/РНК</text></g>`;
    if (i === 2) h += `<g transform="translate(400 170)"><rect x="0" y="9" width="62" height="6" rx="3" fill="#1565C0"/><rect x="0" y="21" width="62" height="6" rx="3" fill="#1565C0"/><text x="70" y="20" class="mg-t">двоколанцюгова ДНК</text><text x="0" y="47" class="mg-ts">РНКаза H прибирає РНК</text></g>`;
    if (i >= 3) {
      h += `<g transform="translate(400 170)"><rect x="0" y="9" width="62" height="6" rx="3" fill="#1565C0"/><rect x="0" y="21" width="62" height="6" rx="3" fill="#1565C0"/></g>`;
      h += `<text x="520" y="132" text-anchor="middle" class="mg-ts">нове місце</text>`;
      h += `<path d="M500 100 l10 -16 l10 16" fill="none" stroke="#C2415C" stroke-width="2.5"/><path d="M505 80 l30 0" stroke="#C2415C" stroke-width="0"/>`;
      h += `<text x="520" y="76" text-anchor="middle" class="mg-tb" style="fill:#C2415C">інтеграза: розріз</text>`;
    }
    if (i === 4) h += el_(465, 95, 110, '#2E7D32', 'нова копія') + `<path d="M470 190 C470 150 500 130 520 126" fill="none" stroke="#46584C" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#rm)"/>`;
    s.innerHTML = h;
    cap.innerHTML = `<h4>Крок ${i + 1}. ${ST[i][0]}</h4><p>${ST[i][1]}</p>`;
  }
  root.append(bar, s, cap);
  stepper(bar, ST.length, scene, { lc: L1 });
});

// ------------------------------------------------------------------ петунія: сайленсинг ендогенних вірусів із віком
register('petunia-virus', (root) => {
  const V = [[1, 1, 'низький рівень вірусної РНК'], [2, 2, 'у 2 рази вище'], [3, 17, 'у 17 разів вище'], [4, 100000, 'приблизно у 100 000 разів вище']];
  const box = el('div', { class: 'mg-two' });
  const left = el('div'); const right = el('div');
  const ctrl = el('div');
  const S = sliders(ctrl, [{ id: 'm', label: 'Вік культури петунії', min: 1, max: 4, step: 1, value: 1, unit: 'міс.', digits: 0 }], upd);
  const fl = el('div'); const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  left.append(ctrl, fl, info);
  const chart = el('div', { class: 'mg-bars mg-bars--v' });
  right.append(el('div', { class: 'mg-ts', style: 'margin-bottom:6px' }, 'Вірусна РНК (відносно 1-го місяця, логарифмічна шкала)'), chart);
  box.append(left, right); root.append(box);
  function upd() {
    const m = Math.round(S.values.m);
    const k = (m - 1) / 3; // 0..1
    const stripe = 1 - k; // чіткість білих смуг (сайленсинг CHS)
    fl.innerHTML = `<svg class="mg-svg" viewBox="0 0 300 150" role="img" aria-label="Квітка петунії: чіткі смуги в молодої рослини, суцільне забарвлення в старої">
      <defs><radialGradient id="pg" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#F6E7F1"/><stop offset="1" stop-color="#B0256B"/></radialGradient></defs>
      <g transform="translate(75 75)">${Array.from({ length: 5 }, (_, i) => { const a = i * 72 - 90; return `<g transform="rotate(${a})"><path d="M0 0 C-30 -20 -34 -52 0 -64 C34 -52 30 -20 0 0Z" fill="#B0256B"/><path d="M0 -4 C-8 -22 -8 -44 0 -62 C8 -44 8 -22 0 -4Z" fill="#fff" opacity="${stripe.toFixed(2)}"/></g>`; }).join('')}<circle r="9" fill="#F6E7A0"/></g>
      <g transform="translate(205 78)"><path d="M0 -50 C40 -40 48 30 0 56 C-48 30 -40 -40 0 -50Z" fill="#6DAE4F"/><path d="M0 -48 V54 M0 -20 L-22 -4 M0 -2 L24 16 M0 20 L-16 34" stroke="#DDEFC2" stroke-width="${(1 + k * 4).toFixed(1)}" stroke-linecap="round" opacity="${(.25 + k * .75).toFixed(2)}" fill="none"/></g>
      <text x="75" y="144" text-anchor="middle" class="mg-ts">квітка</text><text x="205" y="144" text-anchor="middle" class="mg-ts">листок</text></svg>`;
    info.innerHTML = m === 1 ? '<b>Молода рослина:</b> сайленсинг працює — гени халконсинтази (CHS) вимкнені «смугами», вірусна РНК майже відсутня.'
      : m < 4 ? '<b>Сайленсинг слабшає:</b> білі смуги блякнуть, вірусна РНК зростає; починають проявлятися симптоми.'
        : '<b>Стара культура:</b> квітки суцільно малинові, а на листках — світлі жилки й деформації: ендогенний параретровірус (PVCV) «прокинувся».';
    chart.innerHTML = '';
    const lo = 0, hi = 5;
    V.forEach((v) => {
      const w = Math.max(2, (Math.log10(v[1]) - lo) / (hi - lo) * 100);
      chart.append(el('div', { class: 'mg-bars__r' + (v[0] === m ? ' is-sel' : '') }, el('span', { class: 'mg-bars__l' }, v[0] + '-й міс.'), el('span', { class: 'mg-bars__t' }, el('i', { style: `width:${w}%` })), el('span', { class: 'mg-bars__v' }, '×' + v[1].toLocaleString('uk'))));
    });
  }
  upd();
});

// ------------------------------------------------------------------ Ac/Ds: механізм
register('acds-steps', (root) => {
  const ST = [
    ['Будова системи', '<b>Ac</b> (~4,6 kb): ген транспозази (~3,5 kb) між короткими кінцевими інвертованими повторами (<b>TIR</b>, ~11 bp). <b>Ds</b> — дефектний елемент: зіпсована транспозаза або лише TIR.'],
    ['Транспозаза впізнає TIR', 'Фермент транспозаза зв\'язується з TIR обох кінців — вони утворюють петлю. Ds не має власного ферменту, але TIR у нього є, тож його «обслуговує» транспозаза Ac.'],
    ['Вирізання (excision)', 'Елемент вирізається зі старого місця; на місці вирізання лишається «слід» (1–2 додаткові нуклеотиди) — це може зсунути рамку зчитування.'],
    ['Вставка в нове місце', 'Транспозаза вбудовує елемент в нову ділянку, часто в межах тієї ж хромосоми: «cut–paste» — елемент не копіюється, а переноситься.'],
    ['Ds рухається лише разом з Ac', 'Без Ac у зернівках забарвлення рівномірне. Транспозаза Ac діє в <i>trans</i>: у геномі кукурудзи 2–4 активні Ac і до ~50 Ds різної будови.'],
  ];
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 230', role: 'img', 'aria-label': 'Вирізання і вставка транспозона Ac/Ds' });
  const cap = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const bar = el('div');
  const tir = (x, y, d) => `<path d="M${x} ${y + 24} L${x + d * 12} ${y + 12} L${x} ${y}Z" fill="#C2415C"/>`;
  function dna(y) { return `<rect x="20" y="${y}" width="600" height="10" rx="5" fill="#9DB6E8"/><rect x="20" y="${y + 14}" width="600" height="10" rx="5" fill="#C9D7F3"/>`; }
  function scene(i) {
    let h = '';
    h += `<text x="20" y="22" class="mg-tb">ДНК хромосоми</text>`;
    // ген пігменту
    h += `<rect x="40" y="52" width="80" height="26" rx="6" fill="#2E7D32"/><text x="80" y="70" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">промотор</text>`;
    const geneBroken = (i === 0 || i === 1) ? 1 : 0;
    h += `<rect x="124" y="52" width="150" height="26" rx="6" fill="${geneBroken ? '#9AA79D' : '#2E7D32'}"/><text x="199" y="70" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">ген пігменту${geneBroken ? ' (розірваний)' : ''}</text>`;
    h += dna(86);
    // Ac на старому місці (кроки 0..1), вирізаний (2), на новому місці (3..4)
    const ac = (x, y, label = 'Ac · транспозаза') => `<g>${tir(x, y, 1)}<rect x="${x + 12}" y="${y + 2}" width="190" height="20" rx="5" fill="#E9A825"/><text x="${x + 107}" y="${y + 16}" text-anchor="middle" style="font:800 11px system-ui">${label}</text>${tir(x + 214, y, -1)}</g>`;
    if (i <= 1) h += ac(150, 118);
    if (i === 1) h += `<circle cx="215" cy="190" r="16" fill="#46584C"/><text x="215" y="194" text-anchor="middle" style="font:800 9px system-ui;fill:#fff">транспозаза</text><path d="M215 174 V144" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/>`;
    if (i === 2) h += `<g transform="translate(0 -52)">${ac(150, 98)}</g><path d="M265 52 q-6 -28 0 -36" stroke="#C2415C" stroke-width="2" fill="none"/><text x="300" y="30" class="mg-ts" style="fill:#C2415C">слід вирізання (1–2 нт)</text><path d="M232 52 v34" stroke="#C2415C" stroke-width="4" stroke-dasharray="3 3"/>`;
    if (i >= 3) h += ac(380, 118, i === 4 ? 'Ds (без транспозази)' : 'Ac · нове місце');
    if (i >= 3) h += `<path d="M260 150 C330 110 350 110 372 124" fill="none" stroke="#46584C" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#mg-arr)"/>`;
    if (i === 4) h += `<text x="30" y="205" class="mg-t">Ds рухається тільки в присутності транспозази Ac (діє in trans).</text>`;
    s.innerHTML = h;
    cap.innerHTML = `<h4>Крок ${i + 1}. ${ST[i][0]}</h4><p>${ST[i][1]}</p>`;
  }
  root.append(bar, s, cap);
  stepper(bar, ST.length, scene, { lc: L1 });
});

// ------------------------------------------------------------------ Ac/Ds: три позиції вставки
register('acds-pos', (root) => {
  const P = [
    ['Між промотором і кодувальною частиною', 'Вставка порушує експресію (віддаляє промотор від гена).', '<b>Вихід відновлює функцію</b> → плями дикого типу на мутантному фоні.', 0],
    ['В екзоні', 'Ген руйнується; частина вставок може вирізатися зі сплайсингом, ефект мінімальний.', 'На місці вирізання лишається «слід» (1–2 нт) → <b>зсув рамки</b> → мутація.', 1],
    ['В інтроні', 'Вставка видаляється під час сплайсингу (TIR гомологічні межам інтронів) — ефекту немає.', 'Вихід зазвичай безпечний.', 2],
  ];
  let pos = 0, out = false;
  const row = el('div', { class: 'mg-opts' });
  const o = options(row, P.map((p, i) => ({ v: i, t: (i + 1) + '. ' + p[0] })), 0, (v) => { pos = +v; draw(); });
  const tog = el('button', { type: 'button', class: 'mg-opt', 'aria-pressed': 'false' }, '✂ Транспозон вирізається (excision)');
  tog.addEventListener('click', () => { out = !out; tog.setAttribute('aria-pressed', String(out)); draw(); });
  row.append(tog);
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 150', role: 'img', 'aria-label': 'Три позиції вставки транспозона в гені' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  function draw() {
    const xs = [150, 270, 365]; // позиції: проміжок, екзон 1, інтрон
    let ok = out ? (pos === 0) : false; // функціональність
    if (pos === 2) ok = true; // інтрон: ніколи не ламає
    const exCol = (pos === 1) ? (out ? '#C0573E' : '#9AA79D') : (ok ? '#2E7D32' : '#9AA79D');
    const proCol = (pos === 0 && !out) ? '#9AA79D' : '#2E7D32';
    const funcText = (pos === 0 && !out) ? 'ген мовчить' : (pos === 1 ? (out ? 'зсув рамки: мутація' : 'ген зруйновано') : 'ген працює');
    let h = '<rect x="20" y="86" width="600" height="8" rx="4" fill="#C9D7CB"/>';
    h += `<rect x="40" y="60" width="90" height="30" rx="7" fill="${proCol}"/><text x="85" y="79" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">промотор</text>`;
    h += `<rect x="205" y="60" width="130" height="30" rx="7" fill="${exCol}"/><text x="270" y="79" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">екзон 1</text>`;
    h += `<rect x="335" y="72" width="70" height="6" fill="#9AA79D"/><text x="370" y="64" text-anchor="middle" class="mg-ts">інтрон</text>`;
    h += `<rect x="405" y="60" width="130" height="30" rx="7" fill="${(pos === 1 && !out) ? '#9AA79D' : (pos === 1 ? '#C0573E' : (ok ? '#2E7D32' : '#9AA79D'))}"/><text x="470" y="79" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">екзон 2</text>`;
    if (!out) {
      const x = pos === 0 ? 152 : pos === 1 ? 240 : 338;
      h += `<g><path d="M${x} 22 l-6 -8 h12z" fill="none"/><rect x="${x - 8}" y="14" width="64" height="26" rx="6" fill="#E9A825"/><text x="${x + 24}" y="31" text-anchor="middle" style="font:800 11px system-ui">Ac/Ds</text><path d="M${x + 24} 40 V${pos === 0 ? 58 : 58}" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/></g>`;
    } else {
      h += `<g opacity=".55"><rect x="500" y="14" width="64" height="26" rx="6" fill="#E9A825"/><text x="532" y="31" text-anchor="middle" style="font:800 11px system-ui">Ac/Ds</text></g><text x="580" y="31" class="mg-ts">вирізано</text>`;
    }
    h += `<text x="320" y="130" text-anchor="middle" class="mg-tb" style="fill:${(funcText === 'ген працює') ? '#2E7D32' : '#C0573E'}">${funcText}</text>`;
    s.innerHTML = h;
    info.innerHTML = `<h4>${pos + 1}. ${P[pos][0]}</h4><p><b>Вставка:</b> ${P[pos][1]}</p><p><b>Вихід (excision):</b> ${P[pos][2]}</p>`;
  }
  root.append(row, s, info);
  draw();
});

// ------------------------------------------------------------------ мозаїка: «стрибки» транспозона під час росту тканини
register('mosaic', (root) => {
  const ctl = el('div', { class: 'mg-ctrls' });
  const sl = el('div');
  const S = sliders(sl, [
    { id: 'p', label: 'Ймовірність вирізання за один поділ клітини', min: 0.2, max: 12, step: 0.1, value: 3, unit: '%', digits: 1, hint: 'Чим частіше «стрибає» транспозон, тим більше плям.' },
    { id: 'L', label: 'Кількість поділів (стадій розвитку)', min: 4, max: 7, step: 1, value: 6, digits: 0, hint: '6 поділів → 64×64 клітини.' },
  ], gen);
  const temp = el('div', { class: 'mg-opts', style: 'align-self:end' });
  options(temp, [{ v: 16, t: '16 °C — транспозаза активна' }, { v: 28, t: '28 °C — транспозаза «заморожена»' }], 16, (v) => { T = +v; gen(); });
  ctl.append(sl, temp);
  const cv = el('canvas', { class: 'mg-canvas', width: 512, height: 512, role: 'img', 'aria-label': 'Мозаїчне забарвлення: плями різного розміру на тканині' });
  cv.style.maxWidth = '380px'; cv.style.margin = '0 auto';
  const btn = el('button', { type: 'button', class: 'mg-btn' }, '↻ Нова зернівка');
  btn.addEventListener('click', gen);
  const stat = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  const row = el('div', { class: 'mg-row' }, btn, el('span', { class: 'mg-legend' }, el('span', null, el('i', { style: '--c:#F3EFE0;border:1px solid #bbb' }), 'мутантний фон (транспозон у гені)'), el('span', null, el('i', { style: '--c:#7B1FA2' }), 'сектор, де транспозон вирізався → пігмент відновлено')));
  let T = 16;
  root.append(ctl, row, cv, stat);
  const ctx = cv.getContext('2d');
  function gen() {
    const p = T === 16 ? S.values.p / 100 : 0.0002;
    const Lv = Math.round(S.values.L), N = 1 << Lv, cell = 512 / N;
    ctx.fillStyle = '#F3EFE0'; ctx.fillRect(0, 0, 512, 512);
    let sectors = 0, biggest = 0;
    const hue = () => `hsl(${278 + rnd(-10, 10)} ${60 + rnd(-8, 8)}% ${32 + rnd(-6, 8)}%)`;
    function node(x, y, level, colored, area) {
      if (level === Lv) { if (colored) { ctx.fillStyle = colored; ctx.fillRect(x * cell, y * cell, cell + .6, cell + .6); } return; }
      const sz = 1 << (Lv - level - 1);
      for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
        let c = colored;
        if (!c && Math.random() < p) { c = hue(); sectors++; biggest = Math.max(biggest, sz * sz); }
        node(x + dx * sz, y + dy * sz, level + 1, c);
      }
    }
    node(0, 0, 0, null);
    // тонкі межі клітин для великих сіток
    if (Lv <= 6) { ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 1; for (let i = 0; i <= N; i++) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, 512); ctx.moveTo(0, i * cell); ctx.lineTo(512, i * cell); ctx.stroke(); } }
    const share = biggest / (N * N) * 100;
    stat.innerHTML = T === 28
      ? '<b>28 °C:</b> транспозаза неактивна, вирізань майже немає — тканина майже однотонна («алель заморожено»). Якщо при підвищенні температури смугастість зникає, транспозон справді сидить у гені забарвлення.'
      : `<b>Сектори:</b> ${sectors} · найбільший займає ≈ ${share < 0.1 ? '<0,1' : share.toFixed(1).replace('.', ',')} % площі. <b>Що раніше в розвитку трапився «стрибок» — то більший сектор:</b> нащадки тієї клітини успадковують відновлений ген. Малюнок плям випадковий і не повторюється від зернівки до зернівки.`;
  }
  gen();
});

// ------------------------------------------------------------------ будова гена
register('genestruct', (root) => {
  const P = {
    prom: ['Промотор', 'Регуляторна ділянка перед геном. Містить TATA-бокс (~30 нт до старту транскрипції — маркер промотора), інші бокси (напр., G-бокс — зв\'язує PIF, фітохромні відповіді) та сайти зв\'язування факторів транскрипції.', '#7B3FA0'],
    utr5: ['5′-нетранслюється ділянка', 'Транскрибується, але не кодує білок. До пре-мРНК приєднується 5′-кеп.', '#9C7BB8'],
    ex: ['Екзони', 'Кодувальні фрагменти: залишаються в зрілій мРНК. Трансляція — від ініціюючого кодону (з контекстом) до стоп-кодону.', '#2E7D32'],
    in: ['Інтрон', 'Некодувальна вставка: вирізається під час сплайсингу пре-мРНК. (Деякі транспозони «ховаються» в інтронах саме через це.)', '#9AA79D'],
    utr3: ['3′-нетранслюється ділянка', 'Містить сигнал термінації, за яким додається 3′-полі(А)-хвіст — його немає в ДНК; хвіст стабілізує мРНК.', '#C9A227'],
    term: ['Термінатор', 'Ділянка завершення транскрипції. Прокаріотичні РНК мають на 3′-кінці шпильку; у цитоплазмі еукаріот такі РНК сприймаються як чужорідні й швидко деградують.', '#C0573E'],
  };
  const s = svg('svg', { class: 'mg-svg', viewBox: '0 0 640 270', role: 'group', 'aria-label': 'Будова еукаріотичного гена і шлях від ДНК до білка' });
  const info = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  let sel = 'prom';
  const box = (k, x, w, y = 40, lbl = '') => `<g class="mg-hot${sel === k ? ' is-sel' : ''}" data-k="${k}" tabindex="0" role="button" aria-label="${P[k][0]}"><rect x="${x}" y="${y}" width="${w}" height="30" rx="6" fill="${P[k][2]}"/><text x="${x + w / 2}" y="${y + 19}" text-anchor="middle" style="font:700 11px system-ui;fill:#fff">${lbl}</text></g>`;
  function draw() {
    let h = '<text x="12" y="24" class="mg-tb">ДНК</text><rect x="12" y="68" width="616" height="4" fill="#C9D7CB"/>';
    h += box('prom', 20, 100, 40, 'промотор · TATA');
    h += box('utr5', 130, 50, 40, '5′UTR') + box('ex', 180, 90, 40, 'екзон 1') + box('in', 270, 80, 48, '') + `<text x="310" y="42" text-anchor="middle" class="mg-ts">інтрон</text>`;
    h += box('ex', 350, 110, 40, 'екзон 2') + box('utr3', 460, 60, 40, '3′UTR') + box('term', 520, 100, 40, 'термінатор');
    h += `<path d="M20 98 H600" stroke="#46584C" stroke-width="2" marker-end="url(#mg-arr)"/><text x="30" y="92" class="mg-ts">транскрипція →</text>`;
    // пре-мРНК
    h += '<text x="12" y="126" class="mg-tb">пре-мРНК</text>';
    h += `<rect x="130" y="134" width="390" height="10" rx="5" fill="#E0B5C9"/><rect x="180" y="132" width="90" height="14" rx="4" fill="#2E7D32"/><rect x="350" y="132" width="110" height="14" rx="4" fill="#2E7D32"/><circle cx="128" cy="139" r="7" fill="#7B3FA0"/><text x="112" y="160" class="mg-ts" text-anchor="middle">5′-кеп</text>`;
    h += `<path d="M270 150 q40 26 80 0" fill="none" stroke="#C0573E" stroke-width="2" stroke-dasharray="4 3"/><text x="310" y="176" text-anchor="middle" class="mg-ts" style="fill:#C0573E">сплайсинг</text>`;
    // мРНК
    h += '<text x="12" y="196" class="mg-tb">мРНК</text><circle cx="128" cy="205" r="7" fill="#7B3FA0"/>';
    h += `<rect x="135" y="200" width="200" height="10" rx="5" fill="#2E7D32"/><text x="140" y="226" class="mg-ts">AUG … стоп</text><text x="360" y="209" class="mg-ts" style="fill:#8C6A10">AAAAAA… полі(А)-хвіст</text>`;
    h += `<path d="M345 205 H350" stroke="#C9A227" stroke-width="4"/>`;
    h += `<text x="12" y="258" class="mg-tb">білок: N-кінцева послідовність → ЕПР, вакуоля, мітохондрії, хлоропласти (див. нижче)</text>`;
    s.innerHTML = h;
    $$('.mg-hot', s).forEach((g) => { const f = () => { sel = g.dataset.k; draw(); }; g.addEventListener('click', f); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } }); });
    info.innerHTML = `<h4>${P[sel][0]}</h4><p>${P[sel][1]}</p>`;
  }
  // сортування білка
  const D = {
    none: ['немає сигнальної послідовності', 'цитозоль', 'Для цитозольних білків лідер відсутній.'],
    sp: ['сигнальна послідовність (сигнальний пептид)', 'ендоплазматичний ретикулум (далі — Гольджі, вакуоля, апопласт)', 'Сигнальний пептид відщеплюється; пре-білок процесується, глікозилюється, модифікується.'],
    vac: ['сигнал вакуолярного сортування', 'вакуоля', 'Через ЕПР і апарат Гольджі; процесинг і модифікації.'],
    mt: ['транзитна послідовність для мітохондрій', 'мітохондрії', 'Транзитний пептид відщеплюється після імпорту.'],
    cp: ['транзитна послідовність для хлоропластів', 'хлоропласт', 'Транзитний пептид відщеплюється після імпорту; зріла форма — у стромі.'],
  };
  const row = el('div', { class: 'mg-opts' });
  const pinfo = el('div', { class: 'mg-info' });
  options(row, [{ v: 'none', t: 'без лідера' }, { v: 'sp', t: 'сигнальний пептид' }, { v: 'vac', t: 'вакуолярний сигнал' }, { v: 'mt', t: 'транзит у мітохондрії' }, { v: 'cp', t: 'транзит у хлоропласти' }], 'none', (v) => { const d = D[v]; pinfo.innerHTML = `<b>N-кінець:</b> ${d[0]} → <b>${d[1]}</b>. ${d[2]}`; });
  pinfo.innerHTML = `<b>N-кінець:</b> ${D.none[0]} → <b>${D.none[1]}</b>. ${D.none[2]}`;
  root.append(s, info, el('h4', { style: 'margin:16px 0 6px' }, 'Посттрансляційні етапи: куди піде білок'), row, pinfo);
  draw();
});

// ------------------------------------------------------------------ декодер назв генів
register('nomen', (root) => {
  const AA = { A: 'аланін', R: 'аргінін', N: 'аспарагін', D: 'аспарагінова к-та', C: 'цистеїн', Q: 'глутамін', E: 'глутамінова к-та', G: 'гліцин', H: 'гістидин', I: 'ізолейцин', L: 'лейцин', K: 'лізин', M: 'метіонін', F: 'фенілаланін', P: 'пролін', S: 'серин', T: 'треонін', W: 'триптофан', Y: 'тирозин', V: 'валін' };
  const SP = { Zm: 'Zea mays (кукурудза)', Nt: 'Nicotiana tabacum (тютюн)', Os: 'Oryza sativa (рис)', At: 'Arabidopsis thaliana', Ps: 'Pisum sativum (горох) <i>або</i> Pinus sylvestris (сосна) — читайте, які об\'єкти досліджували!', Pa: 'Petunia axillaris', Ph: 'Petunia hybrida', Am: 'Antirrhinum majus (левиний зів)', Sl: 'Solanum lycopersicum (томат)' };
  const EX = ['AGAMOUS', 'ag-1', 'ap2-5', 'CLV1', 'CLV1(R204F)', 'ZmAG', 'NtAP2', 'rbcL', 'psaA', 'rps12', 'PIN1', 'CAULIFLOWER', 'SEPALLATA'];
  const NAMED = { PIN1: 'Назву дано за мутантним фенотипом: <i>pin-formed</i> — «шпилькоподібне» голе стебло без квіток; функція гена протилежна — забезпечує утворення органів (транспорт ауксину).', CAULIFLOWER: 'Назву дано за фенотипом мутанта: суцвіття з недорозвинених квіток, як цвітна капуста; ген забезпечує нормальний розвиток квіток.', SEPALLATA: 'У мутанта всі органи квітки перетворюються на чашолистки (<i>sepals</i>); ген потрібен для розвитку пелюсток, тичинок і плодолистків.', AGAMOUS: 'Повна назва гена (<b>AGAMOUS</b>) і його скорочення з 1–3 літер (<b>AG</b>). Мутант <i>ag</i> — махровість: у центрі квітки замість тичинок і маточки утворюються пелюстки й чашолистки.' };
  const inp = el('input', { type: 'text', value: 'ap2-5', 'aria-label': 'Назва гена або алеля', spellcheck: 'false', autocomplete: 'off' });
  const row = el('div', { class: 'mg-opts' });
  const out = el('div', { class: 'mg-info', 'aria-live': 'polite' });
  EX.forEach((e) => { const b = el('button', { type: 'button', class: 'mg-opt' }, e); b.addEventListener('click', () => { inp.value = e; run(); }); row.append(b); });
  function run() {
    const v = inp.value.trim(); const L = [];
    let m;
    if (!v) { out.innerHTML = 'Введіть назву, напр. <b>ag-1</b>.'; return; }
    if ((m = v.match(/^([A-Z0-9]+)\(([A-Z])(\d+)([A-Z])\)$/))) L.push(`<b>${m[1]}(${m[2]}${m[3]}${m[4]})</b> — амінокислотна заміна в білку ${m[1]}: у позиції <b>${m[3]}</b> залишок <b>${AA[m[2]] || m[2]}</b> (${m[2]}) замінено на <b>${AA[m[4]] || m[4]}</b> (${m[4]}) — однолітерні коди амінокислот.`);
    else if ((m = v.match(/^([a-z]{1,3}\d*)-(\d+)$/))) L.push(`<b>Мутантний алель</b> ядерного гена: малі літери <i>курсивом</i>, номер алеля через дефіс. Тут — алель № <b>${m[2]}</b> мутації гена <i>${m[1]}</i> (дикий алель — <i>${m[1].toUpperCase()}</i>). Нумерує лабораторія, що отримала мутацію.`);
    else if ((m = v.match(/^([A-Z][a-z])([A-Z][A-Za-z]*\d*)$/)) && SP[m[1]]) L.push(`<b>Ортолог з іншого виду.</b> Префікс <b>${m[1]}</b> = ${SP[m[1]]}; решта — <i>${m[2]}</i>, ген-ортолог відповідного гена арабідопсису.`);
    else if ((m = v.match(/^([a-z]{3})([A-Z]\d*|\d+)$/))) L.push(`<b>Пластидний/мітохондріальний ген</b> — за правилами номенклатури прокаріотів: три малі літери (<i>${m[1]}</i>) і велика літера чи номер (<i>${m[2]}</i>). Білок пишуть прямим шрифтом з великої літери: <b>${v[0].toUpperCase() + v.slice(1)}</b>. Спеціального позначення мутантних алелів немає — тож слід пам\'ятати, про який геном ідеться.`);
    else if ((m = v.match(/^[A-Z]{2,9}\d*$/))) L.push(`<b>Ядерний ген дикого типу</b> — ВЕЛИКІ літери <i>курсивом</i> (1–3 літери + цифра без дефіса, напр. <i>${v}</i>). Прямим шрифтом (${v}) так само позначають <b>білок</b>.${/\d$/.test(v) ? ' Цифра часто (але не завжди!) вказує на членів однієї родини: CLV1 (кіназа) і CLV3 (пептид) — різні родини.' : ''}`);
    else L.push('Не вдалося розпізнати: перевірте регістр літер і дефіс. Ядерні гени: <i>AG</i>, <i>ag-1</i>; пластидні: <i>rbcL</i>.');
    if (NAMED[v.toUpperCase()]) L.push(NAMED[v.toUpperCase()]);
    out.innerHTML = L.map((x) => `<p>${x}</p>`).join('');
  }
  inp.addEventListener('input', run);
  root.append(el('label', { class: 'field mg-nomin' }, 'Введіть назву гена чи алеля (або оберіть приклад)', inp), row, out);
  run();
});
