// Конспект «Відмінності рослинної і тваринної клітин»: шари стінки, модель «залізобетону»,
// шляхи води в корені, цитокінез. Анімації працюють лише коли елемент видно.
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
function seg(id, cb) {
  const btns = [...$(id).querySelectorAll('button')];
  btns.forEach((b) => b.addEventListener('click', () => { btns.forEach((x) => x.setAttribute('aria-checked', String(x === b))); cb(b.dataset.v); }));
}
function loopWhenVisible(node, frame) {
  let vis = false, raf = 0, last = 0;
  const tick = (now) => {
    raf = 0;
    if (!vis || document.hidden) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; frame(dt);
    raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && vis && !document.hidden && !REDUCED) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; kick(); }, { rootMargin: '60px' }).observe(node);
  document.addEventListener('visibilitychange', kick);
  return { kick };
}

// ---------------------------------------------------------------- шари клітинної стінки
(() => {
  const svg = $('cl-svg');
  if (!svg) return;
  const L = [
    ['pm', 1, 'Плазмолема', '#E0A526', '≈ 8 нм', '—',
      'Подвійний ліпідний шар із білками. У ній сидять <b>розетки целюлозосинтази</b>: вони виштовхують мікрофібрили назовні й рухаються вздовж <b>кортикальних мікротрубочок</b> — саме тому орієнтація мікротрубочок задає орієнтацію мікрофібрил у стінці.'],
    ['s3', 2, 'S3 — внутрішній шар вторинної стінки', '#B8863A', '≈ 0,1–1 мкм', '≈ 60–90° (майже поперечно)',
      'Тонкий шар, найближчий до протопласта. Поперечні мікрофібрили не дають клітині (особливо судині ксилеми) <b>схлопнутися</b> під від\'ємним тиском води. Целюлоза, ксилан, лігнін.'],
    ['s2', 3, 'S2 — середній шар вторинної стінки', '#9C7F3F', '≈ 1–10 мкм (до 70–90 % вторинної стінки)', '≈ 5–30° (майже вздовж осі)',
      'Найтовщий шар: мікрофібрили майже паралельні осі клітини, тому він дає величезну <b>міцність на розрив</b> і визначає властивості деревини й волокон. Целюлоза, ксилан або глюкоманан, лігнін.'],
    ['s1', 4, 'S1 — зовнішній шар вторинної стінки', '#C9A45C', '≈ 0,1–0,35 мкм', '≈ 50–70°',
      'Тонкий перехідний шар між первинною стінкою і S2. Перехресна укладка мікрофібрил S1 і S3 відносно S2 працює як <b>фанера</b>: стінка не розшаровується і стійка на стиск.'],
    ['p', 5, 'Первинна стінка', '#7DA35A', '≈ 0,1–0,5 мкм', 'без суворого порядку',
      'Є в усіх рослинних клітин, еластична. Орієнтація мікрофібрил змінюється за ростом клітини. Приблизно: целюлоза ≈ 25–30 %, зшиваючі глікани ≈ 20–25 %, пектини ≈ 35 % (у двосім\'ядольних). Саме її розслаблення дозволяє клітині рости.'],
    ['ml', 6, 'Серединна пластинка', '#D9A82E', '≈ 0,1–1 мкм', 'мікрофібрил немає',
      'Спільний шар двох клітин, утворений із клітинної пластинки при поділі. Складається з <b>пектинів</b>, зшитих Ca²⁺ (кальцієві «мости»), у здерев\'янілих тканинах — із лігніном. Коли пектини розчиняються (при дозріванні плодів), клітини розходяться й плід <b>м\'якне</b>.'],
  ];
  const leg = $('cl-leg'), info = $('cl-info');
  const bands = [...svg.querySelectorAll('.cl-b')], badges = [...svg.querySelectorAll('.cl-badge')], dials = [...svg.querySelectorAll('.cl-dial')];
  let sel = null;
  leg.innerHTML = L.map(([k, n, name, col]) => `<button type="button" data-k="${k}" aria-pressed="false" style="--c:${col}"><b>${n}</b>${name}</button>`).join('');
  const btns = [...leg.querySelectorAll('button')];
  function show(k) {
    sel = sel === k ? null : k;
    bands.forEach((b) => { b.classList.toggle('is-dim', !!sel && b.dataset.k !== sel); b.classList.toggle('is-sel', b.dataset.k === sel); });
    badges.forEach((b) => b.classList.toggle('is-dim', !!sel && b.dataset.k !== sel));
    dials.forEach((b) => b.classList.toggle('is-dim', !!sel && b.dataset.k !== sel));
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === sel)));
    if (!sel) { info.innerHTML = '<p class="cl-info__hint">Оберіть шар на схемі або в списку — тут з\'являться його товщина, кут мікрофібрил і функція.</p>'; return; }
    const [, n, name, col, th, mfa, txt] = L.find((x) => x[0] === sel);
    info.style.setProperty('--c', col);
    info.innerHTML = `<h4><span>${n}</span>${name}</h4><div class="cl-tags"><span>Товщина: <b>${th}</b></span><span>Кут мікрофібрил: <b>${mfa}</b></span></div><p>${txt}</p>`;
  }
  btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.k)));
  bands.forEach((b) => {
    b.addEventListener('click', () => show(b.dataset.k));
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(b.dataset.k); } });
  });
  badges.forEach((b) => b.addEventListener('click', () => show(b.dataset.k)));
  show(null);
})();

// ---------------------------------------------------------------- «залізобетон»
(() => {
  const svg = $('cw-svg');
  if (!svg) return;
  const NOTE = {
    cel: 'Целюлозні мікрофібрили — «арматура»: кристалічні пучки β-1,4-глюканів. Без них стінка не витримує тургорного тиску.',
    hem: 'Зшиваючі глікани (ксилоглюкани) з\'єднують мікрофібрили водневими зв\'язками; жовті кільця — вузли, де стінку можна розслабити.',
    pec: 'Пектиновий гель — гідратований матрикс, зшитий Ca²⁺; визначає пористість, заряд і вологість стінки.',
    prot: 'Білки — експансини, XTH, екстенсини: розслаблюють, перебудовують і зміцнюють стінку.',
  };
  const on = new Set(['cel', 'hem', 'pec', 'prot']);
  const btns = [...document.querySelectorAll('#wall-chips button')];
  const note = $('wall-note');
  const apply = () => {
    svg.querySelectorAll('.w-l').forEach((g) => { g.style.opacity = on.has(g.dataset.l) ? 1 : 0.06; });
    svg.querySelectorAll('.cw-call').forEach((g) => { g.style.opacity = on.has(g.dataset.l) ? 1 : 0.25; });
  };
  btns.forEach((b) => b.addEventListener('click', () => {
    const l = b.dataset.l;
    if (on.has(l)) on.delete(l); else on.add(l);
    b.setAttribute('aria-pressed', String(on.has(l)));
    note.textContent = NOTE[l]; apply();
  }));
  document.querySelectorAll('.cw-list li').forEach((li) => {
    li.addEventListener('mouseenter', () => svg.classList.add('is-focus', 'f-' + li.dataset.l));
    li.addEventListener('mouseleave', () => svg.classList.remove('is-focus', 'f-' + li.dataset.l));
  });
  note.textContent = 'Вимикайте й вмикайте компоненти, щоб побачити внесок кожного в будову стінки.';
})();

// ---------------------------------------------------------------- шляхи води в корені
(() => {
  const svg = $('rt-svg');
  if (!svg) return;
  const tok = $('rt-tok'), stall = $('rt-stall');
  const P = (id) => $(id);
  const ROUTES = {
    apo: { segs: ['rt-a1', 'rt-a2', 'rt-a3'], speed: 150, pause: { 0: 1.0 }, cls: 'apo' },
    sym: { segs: ['rt-sym'], speed: 95, cls: 'sym' },
    trn: { segs: ['rt-trn'], speed: 70, cls: 'trn' },
  };
  Object.values(ROUTES).forEach((r) => { r.paths = r.segs.map(P); r.len = r.paths.map((p) => p.getTotalLength()); r.col = r.paths.map((p) => p.getAttribute('stroke')); });
  const NOTE = {
    apo: '<b>Апопластний шлях</b> (синій): вода рухається клітинними стінками й міжклітинниками, не перетинаючи жодної мембрани, — швидко, але без контролю. Біля ендодерми <b>пояски Каспарі</b> (суберин + лігнін) перекривають стінки — вода змушена перейти <b>через плазмолему</b> (фіолетовий відрізок) і лише потім знову потрапляє в апопласт центрального циліндра та в ксилему.',
    sym: '<b>Симпластний шлях</b> (зелений): вода й розчинені речовини один раз заходять через плазмолему кореневого волоска й далі рухаються цитоплазмою від клітини до клітини <b>крізь плазмодесми</b>, не виходячи в апопласт. Це шлях, яким рослина контролює, що потрапить у стелу.',
    trn: '<b>Шлях через мембрани</b> (фіолетовий): вода послідовно перетинає плазмолему на вході в клітину й на виході з неї (через аквапорини), потім стінку, потім знову мембрану. Найповільніший, але найкерованіший шлях.',
    all: '<b>Усі три шляхи одночасно.</b> У реальному корені вода рухається всіма шляхами, а їхня частка залежить від швидкості транспірації та проникності мембран: за інтенсивної транспірації переважає апопластний потік, за слабкої — клітинний.',
  };
  let mode = 'apo', items = [], spawn = 0, wait = 0;
  const colorOf = (r, i) => r.col[Math.min(i, r.col.length - 1)];
  function mk(key) {
    const r = ROUTES[key];
    const g = el('g', {}, tok);
    el('circle', { r: 7, fill: colorOf(r, 0), stroke: '#fff', 'stroke-width': 1.8 }, g);
    el('circle', { r: 2.2, cx: -2, cy: -2.4, fill: '#fff', opacity: 0.85 }, g);
    return { g, r, key, seg: 0, d: 0, hold: 0 };
  }
  function place(it) {
    const r = it.r, p = r.paths[it.seg].getPointAtLength(Math.min(it.d, r.len[it.seg]));
    it.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    it.g.firstChild.setAttribute('fill', colorOf(r, it.seg));
  }
  function show(m) {
    mode = m;
    svg.querySelectorAll('.rt-r').forEach((p) => {
      const k = p.classList.contains('rt-r--apo') ? 'apo' : p.classList.contains('rt-r--sym') ? 'sym' : 'trn';
      p.style.opacity = m === 'all' || m === k ? 1 : 0;
    });
    $('tr-note').innerHTML = NOTE[m];
    items.forEach((it) => it.g.remove()); items = []; spawn = 0;
    stall.style.opacity = 0;
    if (REDUCED) staticDots();
  }
  function staticDots() {
    items.forEach((it) => it.g.remove()); items = [];
    Object.keys(ROUTES).filter((k) => mode === 'all' || mode === k).forEach((k) => {
      [0.15, 0.4, 0.65, 0.88].forEach((f) => {
        const it = mk(k), r = ROUTES[k], total = r.len.reduce((a, b) => a + b, 0); let d = total * f;
        it.seg = 0; while (it.seg < r.len.length - 1 && d > r.len[it.seg]) { d -= r.len[it.seg]; it.seg++; }
        it.d = d; place(it); items.push(it);
      });
    });
  }
  seg('tr-seg', show); show('apo');
  loopWhenVisible(svg, (dt) => {
    spawn -= dt;
    const active = Object.keys(ROUTES).filter((k) => mode === 'all' || mode === k);
    if (spawn <= 0) {
      spawn = mode === 'all' ? 0.42 : 0.6;
      active.forEach((k) => { items.push(mk(k)); });
    }
    let held = false;
    items = items.filter((it) => {
      if (it.hold > 0) { it.hold -= dt; held = true; if (it.hold <= 0) { it.seg++; it.d = 0; } place(it); return true; }
      it.d += dt * it.r.speed;
      if (it.d >= it.r.len[it.seg]) {
        const pause = it.r.pause && it.r.pause[it.seg];
        if (pause && it.seg < it.r.len.length - 1) { it.hold = pause; it.d = it.r.len[it.seg]; held = true; place(it); return true; }
        if (it.seg < it.r.len.length - 1) { it.seg++; it.d = 0; } else { it.g.remove(); return false; }
      }
      place(it); return true;
    });
    stall.style.opacity = held && (mode === 'apo' || mode === 'all') ? 1 : 0;
  });
})();

// ---------------------------------------------------------------- цитокінез
(() => {
  const sp = $('dv-plant'), sa = $('dv-animal');
  if (!sp || !sa) return;
  const t = $('dv-t'), btn = $('dv-play'), lab = $('dv-lab'), cap = $('dv-cap'), stBox = $('dv-stages');
  const STAGES = [
    { p: 0, n: 'Анафаза', a: 'Хроматиди розійшлися до полюсів, веретено розтягнуте.', pl: 'Хроматиди на полюсах; між ними ще видно залишки веретена.' },
    { p: 0.2, n: 'Рання телофаза', a: 'Навколо хромосом відновлюються ядерні оболонки; з\'являється скоротливе кільце (актин + міозин II).', pl: 'Відновлюються ядра; мікротрубочки веретена перебудовуються у <b>фрагмопласт</b>.' },
    { p: 0.45, n: 'Перетяжка · клітинна пластинка', a: 'Кільце стягується й втягує плазмолему всередину — утворюється <b>борозна перетяжки</b>.', pl: 'Везикули Гольджі рухаються по мікротрубочках до екватора й зливаються в <b>клітинну пластинку</b>.' },
    { p: 0.7, n: 'Ріст борозни · ріст пластинки', a: 'Борозна глибшає; між майбутніми клітинами залишається тонкий місток із мікротрубочок.', pl: 'Пластинка росте <b>від центру до країв</b>; фрагмопласт зміщується до периферії.' },
    { p: 0.9, n: 'Завершення', a: 'Місток розривається (<b>серединне тільце</b>) — клітини відокремлюються.', pl: 'Пластинка зливається з материнською стінкою; утворюються серединна пластинка й нові первинні стінки.' },
    { p: 1, n: 'Дві дочірні клітини', a: 'Дві клітини без жорсткої стінки — вони округлюються.', pl: 'Дві клітини розділені новою стінкою; <b>плазмодесми</b> зберігають цитоплазматичний зв\'язок.' },
  ];
  stBox.innerHTML = STAGES.map((s, i) => `<button type="button" data-i="${i}" aria-pressed="false"><b>${i + 1}</b>${s.n}</button>`).join('');
  const stBtns = [...stBox.querySelectorAll('button')];

  // ---------- рослинна клітина
  const CX = 240, CY = 170, IH = 260;
  const gOrg = $('dv-p-org'), gMt = $('dv-p-mt'), gVes = $('dv-p-ves'), gPlate = $('dv-p-plate'), gNuc = $('dv-p-nuc'), gPd = $('dv-p-pd'), nw = $('dv-p-nw');
  [[88, 84, -20], [396, 74, 25], [96, 262, 15], [388, 256, -18]].forEach(([x, y, r]) => {
    el('ellipse', { cx: x, cy: y, rx: 22, ry: 11, fill: 'url(#c-chl)', stroke: '#2E6E2A', 'stroke-width': 1.4, transform: `rotate(${r} ${x} ${y})` }, gOrg);
    el('path', { d: `M${x - 12} ${y}h24`, stroke: '#2E6E2A', 'stroke-width': 1, opacity: 0.4, transform: `rotate(${r} ${x} ${y})` }, gOrg);
  });
  [[150, 60], [330, 288], [70, 170], [410, 170]].forEach(([x, y]) => el('ellipse', { cx: x, cy: y, rx: 12, ry: 6, fill: 'url(#c-mito)', stroke: '#C9743A', 'stroke-width': 1.2 }, gOrg));
  const pMt = Array.from({ length: 15 }, () => el('path', { stroke: '#4E8CA6', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }, gMt));
  const pVes = Array.from({ length: 22 }, () => el('circle', { r: 4.4, fill: '#F2B630', stroke: '#8C6A10', 'stroke-width': 1.2 }, gVes));
  const plateRect = el('rect', { x: CX - 3, width: 6, rx: 3, fill: '#7FB8CF', stroke: '#2E6E8A', 'stroke-width': 1.4 }, gPlate);
  const plateBeads = Array.from({ length: 30 }, () => el('circle', { r: 3.6, fill: '#B5DCEC', stroke: '#2E6E8A', 'stroke-width': 1 }, gPlate));
  el('path', { d: 'M233 40V300M247 40V300', stroke: '#E0A526', 'stroke-width': 2.6 }, gPd).setAttribute('opacity', 0);
  const pdLines = gPd.firstChild;
  const midLine = el('path', { d: `M${CX} 40V300`, stroke: '#E5B94E', 'stroke-width': 3 }, gPd); midLine.setAttribute('opacity', 0);
  const pdPores = [80, 125, 170, 215, 260].map((y) => {
    const g = el('g', { opacity: 0 }, gPd);
    el('rect', { x: 233, y: y - 5, width: 14, height: 10, fill: '#F3F8E6', stroke: '#E0A526', 'stroke-width': 1.4 }, g);
    el('path', { d: `M233 ${y}h14`, stroke: '#C79AD8', 'stroke-width': 2.4 }, g);
    return g;
  });
  const NR = 24, nucs = [-1, 1].map(() => {
    const g = el('g', {}, gNuc);
    const chr = Array.from({ length: 7 }, () => el('path', { stroke: '#3E2678', 'stroke-width': 4.4, fill: 'none', 'stroke-linecap': 'round' }, g));
    const c = el('circle', { fill: 'url(#c-nuc)', stroke: '#6A4BA8', 'stroke-width': 2 }, g);
    const nl = el('circle', { r: 5.5, fill: 'url(#c-nucl)' }, g);
    return { g, chr, c, nl };
  });
  function drawPlant(p) {
    const a = sm((p - 0.12) / 0.25);
    const off = lerp(128, 112, sm((p - 0.1) / 0.5));
    nucs.forEach((n, i) => {
      const sgn = i ? 1 : -1, x = CX + sgn * off;
      const grow = sm((p - 0.1) / 0.35), r = lerp(8, NR, grow);
      n.c.setAttribute('cx', x); n.c.setAttribute('cy', CY); n.c.setAttribute('r', r.toFixed(1)); n.c.setAttribute('opacity', sm((p - 0.1) / 0.3));
      n.nl.setAttribute('cx', x - sgn * 3); n.nl.setAttribute('cy', CY - 2); n.nl.setAttribute('opacity', sm((p - 0.3) / 0.25));
      const co = 1 - sm((p - 0.12) / 0.3);
      n.chr.forEach((c, k) => {
        const y = CY + (k - 3) * 17 * lerp(1, 0.25, 1 - co), xx = x - sgn * lerp(-4, 0, 1 - co);
        c.setAttribute('d', `M${xx - 6 * sgn} ${y - 7}L${xx} ${y + 3}L${xx + 6 * sgn} ${y - 7}`); c.setAttribute('opacity', co);
      });
    });
    const H = IH * sm((p - 0.22) / 0.62);
    const fade = 1 - sm((p - 0.86) / 0.1);
    // мікротрубочки: від веретена до фрагмопласта
    pMt.forEach((m, i) => {
      const y = CY + (i - 7) * 14, ay = Math.abs(y - CY);
      const inSpindle = ay <= 62;
      const inRing = H > 30 ? ay >= H / 2 - 26 && ay <= H / 2 + 12 : ay <= 40;
      const w = lerp(inSpindle ? 1 : 0, inRing ? 1 : 0.0, a);
      const x1 = lerp(CX - off + 28, CX - 62, a), x2 = CX - 9, x3 = CX + 9, x4 = lerp(CX + off - 28, CX + 62, a);
      m.setAttribute('d', `M${x1.toFixed(1)} ${y}L${x2} ${y}M${x3} ${y}L${x4.toFixed(1)} ${y}`);
      m.setAttribute('opacity', (w * 0.85 * fade).toFixed(2));
    });
    // везикули
    pVes.forEach((v, i) => {
      const side = i % 2 ? 1 : -1, ph = (p * 7 + i * 0.37) % 1;
      const lane = ((i * 53) % 100) / 100;
      const ry = H > 40 ? (H / 2 - 4 + lane * 18) * (i % 4 < 2 ? 1 : -1) : (lane - 0.5) * 60;
      v.setAttribute('cx', (CX + side * lerp(64, 8, ph)).toFixed(1)); v.setAttribute('cy', (CY + clamp(ry, -IH / 2 + 6, IH / 2 - 6)).toFixed(1));
      v.setAttribute('opacity', p > 0.14 && p < 0.88 ? (0.95 * (ph < 0.9 ? 1 : (1 - ph) * 10)).toFixed(2) : 0);
    });
    // пластинка
    plateRect.setAttribute('y', (CY - H / 2).toFixed(1)); plateRect.setAttribute('height', H.toFixed(1));
    gPlate.setAttribute('opacity', (H > 1 ? fade : 0).toFixed(2));
    plateBeads.forEach((b, i) => {
      const n = Math.floor(H / 9); b.setAttribute('opacity', i < n ? 1 : 0);
      b.setAttribute('cx', CX + ((i % 2) ? 2.6 : -2.6)); b.setAttribute('cy', (CY - H / 2 + 4.5 + i * 9).toFixed(1));
    });
    // нова стінка
    const w = sm((p - 0.84) / 0.1);
    nw.setAttribute('opacity', w); pdLines.setAttribute('opacity', w); midLine.setAttribute('opacity', w);
    pdPores.forEach((g) => g.setAttribute('opacity', sm((p - 0.94) / 0.06)));
  }

  // ---------- тваринна клітина
  const gS = $('dv-a-strokes'), gF = $('dv-a-fills'), gAm = $('dv-a-mt'), gAs = $('dv-a-aster'), gAn = $('dv-a-nuc'), gR = $('dv-a-ring');
  const ell = () => ({ s: el('ellipse', { fill: 'none', stroke: '#C98B74', 'stroke-width': 5 }, gS), f: el('ellipse', { fill: 'url(#c-cytoA)' }, gF), d: el('ellipse', { fill: 'url(#c-dotsA)' }, gF) });
  const ells = [ell(), ell()];
  const aMt = Array.from({ length: 9 }, () => el('path', { stroke: '#4E8CA6', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, gAm));
  const bridge = el('path', { stroke: '#8C5E4A', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, gAm);
  const mbody = el('ellipse', { rx: 6, ry: 4, fill: '#8C5E4A', stroke: '#fff', 'stroke-width': 1.2 }, gAm);
  const asters = [-1, 1].map(() => {
    const g = el('g', {}, gAs);
    for (let k = 0; k < 9; k++) el('path', { stroke: '#4E8CA6', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.7, d: `M0 0L${(Math.cos(k * 0.7 - 1.4) * 30).toFixed(1)} ${(Math.sin(k * 0.7 - 1.4) * 30).toFixed(1)}`, transform: 'rotate(0)' }, g);
    el('circle', { r: 4.5, fill: '#E98E4E', stroke: '#fff', 'stroke-width': 1.2 }, g);
    return g;
  });
  const anucs = [-1, 1].map(() => {
    const g = el('g', {}, gAn);
    const chr = Array.from({ length: 7 }, () => el('path', { stroke: '#3E2678', 'stroke-width': 4.4, fill: 'none', 'stroke-linecap': 'round' }, g));
    const c = el('circle', { fill: 'url(#c-nuc)', stroke: '#6A4BA8', 'stroke-width': 2 }, g);
    const nl = el('circle', { r: 5.5, fill: 'url(#c-nucl)' }, g);
    return { g, chr, c, nl };
  });
  const ringDots = [-1, 1].map(() => {
    const g = el('g', {}, gR);
    el('circle', { r: 11, fill: '#D0443A', opacity: 0.22 }, g); el('circle', { r: 5.5, fill: '#D0443A', stroke: '#fff', 'stroke-width': 1.5 }, g);
    return g;
  });
  const arrows = [-1, 1].map(() => el('path', { stroke: '#D0443A', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gR));
  function drawAnimal(p) {
    const e = sm((p - 0.12) / 0.8), d = 100 * e, rx = 190 - 100 * e, ry = 106 - 8 * e;
    ells.forEach((o, i) => {
      const cx = 240 + (i ? d : -d);
      ['s', 'f', 'd'].forEach((k) => { o[k].setAttribute('cx', cx.toFixed(1)); o[k].setAttribute('cy', 170); o[k].setAttribute('rx', rx.toFixed(1)); o[k].setAttribute('ry', ry.toFixed(1)); });
    });
    const nx = 118 - 18 * e, grow = sm((p - 0.1) / 0.35);
    anucs.forEach((n, i) => {
      const sgn = i ? 1 : -1, x = 240 + sgn * nx, r = lerp(9, 29, grow);
      n.c.setAttribute('cx', x.toFixed(1)); n.c.setAttribute('cy', 170); n.c.setAttribute('r', r.toFixed(1)); n.c.setAttribute('opacity', sm((p - 0.1) / 0.3));
      n.nl.setAttribute('cx', x - sgn * 3); n.nl.setAttribute('cy', 168); n.nl.setAttribute('opacity', sm((p - 0.3) / 0.25));
      const co = 1 - sm((p - 0.12) / 0.3);
      n.chr.forEach((c, k) => {
        const y = 170 + (k - 3) * 17 * lerp(1, 0.25, 1 - co), xx = x - sgn * lerp(-4, 0, 1 - co);
        c.setAttribute('d', `M${xx - 6 * sgn} ${y - 7}L${xx} ${y + 3}L${xx + 6 * sgn} ${y - 7}`); c.setAttribute('opacity', co);
      });
    });
    asters.forEach((g, i) => { const sgn = i ? 1 : -1; g.setAttribute('transform', `translate(${(240 + sgn * (nx + 44 - 8 * e)).toFixed(1)} 170) scale(${sgn})`); g.setAttribute('opacity', 1 - sm((p - 0.8) / 0.2)); });
    const sep = d > rx;
    const waist = sep ? 0 : ry * Math.sqrt(Math.max(0, 1 - (d / rx) ** 2));
    const gapY = clamp(waist * 0.34, 2.2, 10);
    const mtOp = 0.85 * (1 - sm((e - 0.82) / 0.14));
    aMt.forEach((m, k) => {
      const y = 170 + (k - 4) * gapY;
      m.setAttribute('d', `M${(240 - nx + 28).toFixed(1)} ${y.toFixed(1)}L${(240 + nx - 28).toFixed(1)} ${y.toFixed(1)}`);
      m.setAttribute('opacity', (Math.abs(k - 4) * gapY < Math.max(waist, 5) * 0.85 ? mtOp : 0).toFixed(2));
    });
    const br = e > 0.86;
    bridge.setAttribute('d', `M${(240 - Math.max(0, d - rx) - 2).toFixed(1)} 170H${(240 + Math.max(0, d - rx) + 2).toFixed(1)}`);
    bridge.setAttribute('opacity', br && p < 0.995 ? 0.9 : 0);
    mbody.setAttribute('cx', 240); mbody.setAttribute('cy', 170); mbody.setAttribute('opacity', br && p < 0.995 ? 0.95 : 0);
    ringDots.forEach((g, i) => {
      const sgn = i ? 1 : -1, y = 170 + sgn * Math.max(waist, sep ? 0 : 1);
      g.setAttribute('transform', `translate(240 ${y.toFixed(1)})`); g.setAttribute('opacity', (sep || p < 0.1 ? 0 : 1 - sm((e - 0.9) / 0.1)).toFixed(2));
    });
    arrows.forEach((a, i) => {
      const sgn = i ? 1 : -1, y = 170 + sgn * (waist + 24 + 8 * (1 - e));
      a.setAttribute('d', `M240 ${(y + sgn * 14).toFixed(1)}L240 ${y.toFixed(1)}M233 ${(y + sgn * 7).toFixed(1)}L240 ${y.toFixed(1)}L247 ${(y + sgn * 7).toFixed(1)}`);
      a.setAttribute('opacity', (p > 0.14 && e < 0.8 ? 0.9 : 0).toFixed(2));
    });
  }

  // ---------- керування
  let p = 0, playing = false, tween = null;
  function stageOf(v) { let k = 0; STAGES.forEach((s, i) => { if (v >= s.p - 0.001) k = i; }); return k; }
  function render(v) {
    p = clamp(v);
    t.value = p; t.style.setProperty('--pct', (p * 100).toFixed(1) + '%');
    drawPlant(p); drawAnimal(p);
    const k = stageOf(p), s = STAGES[k];
    lab.textContent = `${k + 1}/6 · ${s.n}`;
    stBtns.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === k)); b.classList.toggle('is-past', i < k); });
    cap.innerHTML = `<div><b>Тваринна клітина.</b> ${s.a}</div><div><b>Рослинна клітина.</b> ${s.pl}</div>`;
  }
  const ui = () => { btn.textContent = playing ? 'Пауза' : (p >= 1 ? 'Повторити' : 'Відтворити поділ'); };
  function goTo(target) {
    playing = false; ui(); cancelAnimationFrame(tween);
    const from = p, dur = 650, t0 = performance.now();
    const step = (now) => { const k = sm((now - t0) / dur); render(lerp(from, target, k)); if (k < 1) tween = requestAnimationFrame(step); };
    tween = requestAnimationFrame(step);
  }
  stBtns.forEach((b) => b.addEventListener('click', () => goTo(STAGES[+b.dataset.i].p)));
  t.addEventListener('input', () => { playing = false; cancelAnimationFrame(tween); ui(); render(+t.value); });
  btn.addEventListener('click', () => { if (!playing && p >= 1) render(0); playing = !playing; ui(); loop.kick(); });
  const loop = loopWhenVisible(sp, (dt) => {
    if (!playing) return;
    render(p + dt / 11);
    if (p >= 1) { playing = false; ui(); }
  });
  render(0.0); ui();
})();
