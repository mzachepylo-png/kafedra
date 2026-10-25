// Фотосинтез: покрокові схеми (цикл Кальвіна, фотодихання, C4), добовий цикл CAM, модель FvCB для C3 і C4.
import { Plot, linspace } from './plot.js';
import { sliders, segmented, setOut, num, sig } from './ui.js';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

// Кольори «молекул»-жетонів
const T = {
  co2: ['#E8EEF2', '#3D5A66'], atp: ['#FFE7A3', '#6E520A'], adp: ['#FFFFFF', '#8C6A10'], nadph: ['#D6E6FB', '#1F4F8F'], nadp: ['#FFFFFF', '#2E5FA0'],
  c: ['#FFFFFF', '#13241A'], o2: ['#DCEBFF', '#1F4F8F'], toxic: ['#FBE0D6', '#8A2E14'], acid: ['#FCE3CC', '#8A4513'], nh3: ['#EDE3FA', '#4A2E86'], sugar: ['#FFF3CF', '#8C6A10'],
};

/** Видимість елемента на екрані (для автоматичних анімацій). */
function watchVisible(el, cb) {
  const st = { on: false };
  new IntersectionObserver((es) => { st.on = es[0].isIntersecting; cb && cb(st.on); }, { rootMargin: '60px' }).observe(el);
  return st;
}

/** Жетон-молекула, що рухається вздовж шляху SVG. */
function makeToken(layer, label, kind) {
  const [bg, fg] = T[kind] || T.c;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'tok');
  const r = document.createElementNS(NS, 'rect');
  const t = document.createElementNS(NS, 'text');
  t.textContent = label;
  t.setAttribute('text-anchor', 'middle'); t.setAttribute('y', '4'); t.setAttribute('fill', fg);
  r.setAttribute('fill', bg); r.setAttribute('stroke', fg);
  g.append(r, t);
  layer.append(g);
  const w = Math.max(22, label.length * 6.6 + 14);
  r.setAttribute('x', -w / 2); r.setAttribute('y', -10); r.setAttribute('width', w); r.setAttribute('height', 20); r.setAttribute('rx', 10);
  return g;
}

const lenCache = new WeakMap();
function pathPoint(path, f) {
  let L = lenCache.get(path);
  if (L == null) { L = path.getTotalLength(); lenCache.set(path, L); }
  return path.getPointAtLength(clamp(f, 0, 1) * L);
}

// =====================================================================
//  Покроковий програвач схем
// =====================================================================
class Stepper {
  constructor(pid, steps, opts = {}) {
    this.pid = pid; this.opts = opts;
    this.svg = $(pid); this.layer = $(pid + '-tok');
    this.i = 0; this.playing = false; this.gen = 0; this.raf = 0; this.timer = 0;
    this.vis = watchVisible(this.svg, (on) => { if (!on) this.pause(); });
    $(pid + '-prev').addEventListener('click', () => { this.pause(); this.go(this.i - 1); });
    $(pid + '-next').addEventListener('click', () => { this.pause(); this.go(this.i + 1); });
    $(pid + '-play').addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    this.setSteps(steps);
  }
  setSteps(steps) {
    this.steps = steps;
    const dots = $(this.pid + '-dots');
    dots.innerHTML = steps.map((s, k) => `<button type="button" aria-label="Крок ${k + 1}: ${s.title}">${k + 1}</button>`).join('');
    [...dots.children].forEach((b, k) => b.addEventListener('click', () => { this.pause(); this.go(k); }));
    this.allIds = [...new Set(steps.flatMap((s) => s.hl || []))];
    this.go(Math.min(this.i, steps.length - 1), false);
    this.ui();
  }
  ui() { $(this.pid + '-play').innerHTML = this.playing ? PAUSE + 'Пауза' : PLAY + 'Відтворити'; }
  play() {
    if (this.playing) return;
    this.playing = true; this.ui();
    this.go(this.i >= this.steps.length - 1 && this.done ? 0 : this.i, true);
  }
  pause() { this.playing = false; clearTimeout(this.timer); this.ui(); }
  go(i, animate = true) {
    const n = this.steps.length;
    i = (i + n) % n;
    this.i = i;
    const s = this.steps[i];
    this.gen++; cancelAnimationFrame(this.raf); clearTimeout(this.timer);
    this.layer.replaceChildren();
    $(this.pid + '-n').textContent = `${i + 1} / ${n}`;
    $(this.pid + '-title').textContent = s.title;
    $(this.pid + '-eq').innerHTML = s.eq;
    $(this.pid + '-enz').innerHTML = s.enz;
    $(this.pid + '-where').innerHTML = s.where;
    $(this.pid + '-text').innerHTML = s.text;
    [...$(this.pid + '-dots').children].forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    const on = new Set(s.hl || []);
    this.allIds.forEach((id) => { const el = $(id); if (el) el.classList.toggle('is-on', on.has(id)); });
    this.opts.onStep && this.opts.onStep(i, s);
    this.done = false;
    const movers = s.movers || [];
    if (!animate || REDUCED || !movers.length) {
      // статичний кадр: жетони в кінцевих точках
      movers.forEach((m) => { const p = $(m.p); if (!p) return; const g = makeToken(this.layer, m.label, m.kind); const pt = pathPoint(p, 1); g.setAttribute('transform', `translate(${pt.x} ${pt.y})`); });
      this.done = true;
      if (this.playing) this.timer = setTimeout(() => this.playing && this.go(this.i + 1), 2600);
      return;
    }
    const gen = this.gen;
    const toks = movers.map((m) => ({ m, p: $(m.p), g: null }));
    const total = Math.max(...movers.map((m) => (m.delay || 0) + (m.dur || 1400)));
    const t0 = performance.now();
    const frame = (now) => {
      if (gen !== this.gen) return;
      const el = now - t0;
      toks.forEach((tk) => {
        if (!tk.p) return;
        const f = (el - (tk.m.delay || 0)) / (tk.m.dur || 1400);
        if (f < 0) return;
        if (!tk.g) tk.g = makeToken(this.layer, tk.m.label, tk.m.kind);
        const pt = pathPoint(tk.p, ease(clamp(f, 0, 1)));
        tk.g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        if (tk.m.fade && f >= 1) tk.g.setAttribute('opacity', String(clamp(1 - (f - 1) * 2, 0, 1)));
      });
      if (el < total + 500) this.raf = requestAnimationFrame(frame);
      else {
        this.done = true;
        if (this.playing) this.timer = setTimeout(() => { if (this.playing && this.vis.on) this.go(this.i + 1); else this.pause(); }, 2200);
      }
    };
    this.raf = requestAnimationFrame(frame);
  }
}

// =====================================================================
//  Огляд: потоки ATP / NADPH між гранами і циклом Кальвіна
// =====================================================================
(() => {
  const svg = $('ov');
  if (!svg) return;
  const layer = $('ov-tok'), pa = $('ov-p-atp'), pb = $('ov-p-adp');
  const toks = [];
  let last = 0, spawn = 0, raf = 0, k = 0;
  const vis = watchVisible(svg, (on) => { if (on && !raf && !REDUCED) raf = requestAnimationFrame(frame); });
  function frame(now) {
    raf = 0;
    if (!vis.on || document.hidden) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.75;
      const fwd = k % 2 === 0, kind = ['atp', 'nadph'][(k >> 1) % 2];
      const label = fwd ? (kind === 'atp' ? 'ATP' : 'NADPH') : (kind === 'atp' ? 'ADP' : 'NADP⁺');
      toks.push({ g: makeToken(layer, label, fwd ? kind : kind === 'atp' ? 'adp' : 'nadp'), p: fwd ? pa : pb, f: 0 });
      k++;
    }
    for (let i = toks.length - 1; i >= 0; i--) {
      const t = toks[i];
      t.f += dt / 2.4;
      if (t.f >= 1) { t.g.remove(); toks.splice(i, 1); continue; }
      const pt = pathPoint(t.p, t.f);
      t.g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      t.g.setAttribute('opacity', String(Math.min(1, t.f * 6, (1 - t.f) * 6)));
    }
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && vis.on && !raf && !REDUCED) { last = 0; raf = requestAnimationFrame(frame); } });
})();

// =====================================================================
//  Цикл Кальвіна
// =====================================================================
const CC = [
  { title: 'Карбоксилювання', eq: '3 RuBP (C₅) + 3 CO₂ + 3 H₂O → 6 3-ФГК (C₃)', enz: 'Рубіско (рибулозобісфосфаткарбоксилаза/оксигеназа)', where: 'строма хлоропласту',
    text: 'CO₂ приєднується до енольної форми RuBP. Шестивуглецевий інтермедіат миттєво гідролізується на дві молекули 3-фосфогліцерату. Вуглецевий баланс: 15 + 3 = 18 атомів C.',
    hl: ['cc-a0', 'cc-n0', 'cc-n1', 'cc-co2', 'cc-e0'], movers: [{ p: 'cc-co2', label: 'CO₂', kind: 'co2', dur: 1200 }, { p: 'cc-co2', label: 'CO₂', kind: 'co2', delay: 250, dur: 1200 }, { p: 'cc-co2', label: 'CO₂', kind: 'co2', delay: 500, dur: 1200 }, { p: 'cc-a0', label: '6 × 3-ФГК', kind: 'c', delay: 1300, dur: 1600 }], k: [3, 0, 0, 18] },
  { title: 'Фосфорилювання 3-ФГК', eq: '6 3-ФГК + 6 ATP → 6 1,3-бісфосфогліцерат + 6 ADP', enz: 'фосфогліцераткіназа', where: 'строма хлоропласту',
    text: 'Кінцевий фосфат ATP переноситься на карбоксильну групу 3-ФГК: утворюється макроергічний змішаний ангідрид, який легко відновити. Витрачено 6 ATP.',
    hl: ['cc-a1', 'cc-n1', 'cc-n2', 'cc-atp1', 'cc-adp1', 'cc-e1'], movers: [{ p: 'cc-atp1', label: 'ATP', kind: 'atp', dur: 1100 }, { p: 'cc-atp1', label: 'ATP', kind: 'atp', delay: 300, dur: 1100 }, { p: 'cc-a1', label: '6 × 1,3-БФГК', kind: 'c', delay: 1000, dur: 1600 }, { p: 'cc-adp1', label: 'ADP', kind: 'adp', delay: 1300, dur: 1100, fade: true }], k: [3, 6, 0, 18] },
  { title: 'Відновлення', eq: '6 1,3-БФГК + 6 NADPH + 6 H⁺ → 6 гліцеральдегід-3-фосфат + 6 NADP⁺ + 6 Pᵢ', enz: 'НАДФ-залежна гліцеральдегід-3-фосфатдегідрогеназа', where: 'строма хлоропласту',
    text: 'Карбоксильна група відновлюється до альдегідної: утворюється тріозофосфат — перший цукор фотосинтезу. Тут використовується відновник NADPH зі світлових реакцій; частина Г3Ф ізомеризується в дигідроксиацетонфосфат.',
    hl: ['cc-a2', 'cc-n2', 'cc-n3', 'cc-nadph', 'cc-nadp', 'cc-e2'], movers: [{ p: 'cc-nadph', label: 'NADPH', kind: 'nadph', dur: 1200 }, { p: 'cc-nadph', label: 'NADPH', kind: 'nadph', delay: 300, dur: 1200 }, { p: 'cc-a2', label: '6 × Г3Ф', kind: 'c', delay: 1100, dur: 1600 }, { p: 'cc-nadp', label: 'NADP⁺', kind: 'nadp', delay: 1400, dur: 1100, fade: true }], k: [3, 6, 6, 18] },
  { title: 'Вихід продукту', eq: '6 Г3Ф → 1 Г3Ф (вихід) + 5 Г3Ф (у циклі)', enz: 'тріозофосфатний транслокатор (обмін на Pᵢ)', where: 'строма → цитозоль',
    text: 'Одна з шести молекул тріозофосфату — чистий приріст трьох обертів. Її експортують у цитозоль для синтезу сахарози або залишають у хлоропласті для синтезу крохмалю. У циклі лишається 15 атомів C.',
    hl: ['cc-n3', 'cc-out'], movers: [{ p: 'cc-out', label: '1 Г3Ф', kind: 'sugar', dur: 1700 }], k: [3, 6, 6, 15] },
  { title: 'Регенерація: перебудова скелетів', eq: '5 Г3Ф (5 × C₃) → 3 Ru5P (3 × C₅)', enz: 'альдолаза, фруктозо-1,6-бісфосфатаза, транскетолаза, седогептулозо-1,7-бісфосфатаза, ізомераза, епімераза', where: 'строма хлоропласту',
    text: 'Через проміжні C₆ (фруктозо-6-фосфат), C₄ (еритрозо-4-фосфат) і C₇ (седогептулозо-7-фосфат) п\'ять тривуглецевих молекул перебудовуються на три п\'ятивуглецеві. Атомів C стільки ж: 15.',
    hl: ['cc-a3', 'cc-n3', 'cc-n4', 'cc-e3'], movers: [{ p: 'cc-a3', label: '5 Г3Ф → 3 Ru5P', kind: 'c', dur: 2200 }], k: [3, 6, 6, 15] },
  { title: 'Фосфорилювання Ru5P', eq: '3 Ru5P + 3 ATP → 3 RuBP + 3 ADP', enz: 'фосфорибулокіназа', where: 'строма хлоропласту',
    text: 'Акцептор CO₂ відновлено, цикл замкнувся. Підсумок трьох обертів: 3 CO₂, 9 ATP і 6 NADPH дають одну молекулу тріозофосфату.',
    hl: ['cc-a4', 'cc-n4', 'cc-n0', 'cc-atp2', 'cc-adp2', 'cc-e4'], movers: [{ p: 'cc-atp2', label: 'ATP', kind: 'atp', dur: 1100 }, { p: 'cc-a4', label: '3 × RuBP', kind: 'c', delay: 900, dur: 1600 }, { p: 'cc-adp2', label: 'ADP', kind: 'adp', delay: 1200, dur: 1100, fade: true }], k: [3, 9, 6, 15] },
];
if ($('cc')) {
  new Stepper('cc', CC, {
    onStep: (i, s) => { $('cc-k-co2').textContent = s.k[0]; $('cc-k-atp').textContent = s.k[1]; $('cc-k-nadph').textContent = s.k[2]; $('cc-k-c').textContent = s.k[3]; },
  });
}

// =====================================================================
//  Фотодихання
// =====================================================================
const PR = [
  { title: 'Оксигенування RuBP', eq: 'RuBP (C₅) + O₂ → 3-ФГК (C₃) + 2-фосфогліколат (C₂)', enz: 'Рубіско (оксигеназна реакція)', where: 'строма хлоропласту',
    text: 'Замість CO₂ Рубіско приєднує O₂. 3-ФГК повертається в цикл Кальвіна, а 2-фосфогліколат — отрута для тріозофосфатізомерази. Його переробляє гліколатний шлях.',
    hl: ['pr-rub', 'pr-p0'], movers: [{ p: 'pr-p0', label: 'O₂', kind: 'o2', dur: 1400 }] },
  { title: 'Гліколат залишає хлоропласт', eq: '2-фосфогліколат + H₂O → гліколат + Pᵢ', enz: 'фосфогліколатфосфатаза; транспортер PLGG1', where: 'хлоропласт → цитозоль → пероксисома',
    text: 'Фосфат відщеплюється, і гліколат через транспортер внутрішньої мембрани пластиди виходить у цитозоль, а звідти — у пероксисому.',
    hl: ['pr-rub', 'pr-p1'], movers: [{ p: 'pr-p1', label: 'гліколат', kind: 'toxic', dur: 1800 }] },
  { title: 'Окиснення в пероксисомі', eq: 'гліколат + O₂ → гліоксилат + H₂O₂;  2 H₂O₂ → 2 H₂O + O₂;  гліоксилат → гліцин', enz: 'гліколатоксидаза, каталаза, амінотрансферази (GGAT, SGAT)', where: 'пероксисома',
    text: 'Гліколатоксидаза окиснює гліколат киснем, утворюючи небезпечний пероксид водню, який одразу розкладає каталаза — її в пероксисомі так багато, що вона утворює кристалоїд. Гліоксилат трансамінується в амінокислоту гліцин.',
    hl: ['pr-gox'], movers: [{ p: 'pr-p1', label: 'гліколат', kind: 'toxic', dur: 500 }, { p: 'pr-p2', label: 'гліцин', kind: 'acid', delay: 700, dur: 1800 }] },
  { title: 'Мітохондрія: втрата CO₂ і NH₃', eq: '2 гліцин + NAD⁺ + H₂O → серин + CO₂ + NH₃ + NADH', enz: 'гліциндекарбоксилазний комплекс (GDC), серингідроксиметилтрансфераза', where: 'матрикс мітохондрії',
    text: 'Тут вуглець і азот втрачаються: з двох молекул гліцину (4 атоми C) утворюється серин (3 C), а один атом C виходить як CO₂ (саме його виділення на світлі й назвали «фотодиханням»). Аміак потрібно повернути — інакше рослина втратить азот.',
    hl: ['pr-gdc', 'pr-p3', 'pr-p4'], movers: [{ p: 'pr-p3', label: 'CO₂', kind: 'co2', dur: 1600 }, { p: 'pr-p4', label: 'NH₃', kind: 'nh3', delay: 300, dur: 2000 }] },
  { title: 'Серин → гліцерат', eq: 'серин + гліоксилат → гідроксипіруват + гліцин;  гідроксипіруват + NADH → гліцерат', enz: 'SGAT, гідроксипіруватредуктаза', where: 'пероксисома',
    text: 'Серин повертається в пероксисому, віддає аміногрупу новій молекулі гліоксилату й відновлюється до гліцерату.',
    hl: ['pr-gox', 'pr-p5'], movers: [{ p: 'pr-p5', label: 'серин', kind: 'acid', dur: 1700 }] },
  { title: 'Повернення в хлоропласт', eq: 'гліцерат + ATP → 3-ФГК + ADP;  NH₄⁺ + глутамат + ATP → глутамін (GS/GOGAT)', enz: 'гліцераткіназа; глутамінсинтетаза, глутаматсинтаза', where: 'строма хлоропласту',
    text: 'Гліцерат фосфорилюється до 3-ФГК, яка входить у цикл Кальвіна: повернуто 75 % вуглецю. Аміак знову зв\'язується в глутамін. Разом на одне оксигенування витрачено 3,5 ATP і 2 NADPH, а 0,5 CO₂ втрачено.',
    hl: ['pr-glyk', 'pr-gs', 'pr-p6', 'pr-p7'], movers: [{ p: 'pr-p6', label: 'гліцерат', kind: 'acid', dur: 1600 }, { p: 'pr-p7', label: '3-ФГК', kind: 'c', delay: 1500, dur: 1200 }] },
];
if ($('pr')) new Stepper('pr', PR);

// Γ*, K_c, K_o та інші константи з температурою (Bernacchi et al., 2001)
const RG = 8.314;
const arr = (k25, Ea, T) => k25 * Math.exp(Ea * (T + 273.15 - 298.15) / (298.15 * RG * (T + 273.15)));
const peaked = (k25, Ea, T, S = 650, Hd = 200000) => {
  const Tk = T + 273.15;
  return arr(k25, Ea, T) * (1 + Math.exp((298.15 * S - Hd) / (298.15 * RG))) / (1 + Math.exp((Tk * S - Hd) / (RG * Tk)));
};
const gammaStar = (T) => arr(42.75, 37830, T);

(() => {
  if (!$('pr-c')) return;
  const sl = sliders($('pr-c'), [
    { id: 'prT', label: 'Температура листка', min: 10, max: 45, step: 1, value: 25, unit: '°C' },
    { id: 'prCa', label: 'CO₂ в атмосфері', min: 200, max: 1000, step: 10, value: 420, unit: 'ppm' },
    { id: 'prSt', label: 'Продихи: Cᵢ / Cₐ', min: 0.2, max: 0.85, step: 0.01, value: 0.7, digits: 2, hint: '0,7 — відкриті; 0,3 і менше — прикриті в посуху' },
  ], upd);
  function upd() {
    const { prT, prCa, prSt } = sl.values;
    const g = gammaStar(prT), ci = prCa * prSt;
    const phi = 2 * g / ci; // vo/vc
    const loss = g / ci;
    const shareC = 1 / (1 + phi);
    $('pr-bar-c').style.width = shareC * 100 + '%';
    $('pr-bar-o').style.width = (1 - shareC) * 100 + '%';
    const net = 1 - phi / 2;
    const atp = net > 0 ? (3 + 3.5 * phi) / net - 3 : Infinity, nad = net > 0 ? (2 + 2 * phi) / net - 2 : Infinity;
    setOut(document, {
      prg: num(g, 0) + ' ppm', prr: num(phi, 2), prl: loss < 1 ? num(loss * 100, 0) + ' %' : '> 100 %',
      pre: net > 0 ? `+${num(atp * 100, 0)} ATP, +${num(nad * 100, 0)} NADPH` : '—',
    });
    let note = '';
    if (ci <= g) note = `Cᵢ = ${num(ci, 0)} ppm нижче компенсаційного пункту: фотодихання перевищує фіксацію, листок на світлі втрачає вуглець.`;
    else if (loss > 0.3) note = `Спека й прикриті продихи: майже третина фіксованого вуглецю повертається в повітря. Саме за таких умов C₄-рослини мають перевагу.`;
    else if (prCa >= 700) note = 'Підвищений CO₂ пригнічує оксигенування — тому в теплицях C₃-культури підживлюють вуглекислим газом.';
    $('pr-note').textContent = note;
  }
  upd();
})();

// =====================================================================
//  C4: підтипи та покрокова схема
// =====================================================================
const SUB = {
  nadp: { name: 'НАДФ-МЕ (кукурудза)', acid: 'малат', acidEnz: 'НАДФ-МДГ', acidWhere: 'хлоропласт мезофілу', acidEq: 'оксалоацетат + NADPH + H⁺ → малат + NADP⁺', ret: 'піруват',
    dec: 'НАДФ-МЕ', decFull: 'НАДФ-малік-ензим', decWhere: 'хлоропласт клітини обкладки', decEq: 'малат + NADP⁺ → піруват + CO₂ + NADPH', site: [790, 236], agr: true, sub: true,
    decText: 'Разом із CO₂ в обкладці утворюється NADPH — тому хлоропласти обкладки майже втратили ФС II і грани (агранальні) й не виділяють O₂, що конкурував би з CO₂. Суберинова пластинка в стінці не випускає CO₂ назад.' },
  nad: { name: 'НАД-МЕ (просо, щириця)', acid: 'аспартат', acidEnz: 'АсАТ', acidWhere: 'цитозоль мезофілу', acidEq: 'оксалоацетат + глутамат → аспартат + 2-оксоглутарат', ret: 'аланін',
    dec: 'НАД-МЕ', decFull: 'НАД-малік-ензим (мітохондрія)', decWhere: 'мітохондрія клітини обкладки', decEq: 'аспартат → оксалоацетат → малат;  малат + NAD⁺ → піруват + CO₂ + NADH', site: [800, 352], agr: false, sub: false,
    decText: 'Аспартат у мітохондрії перетворюється на малат, і його декарбоксилює НАД-малік-ензим; NADH одразу використовується знову. Піруват трансамінується в аланін, щоб зберегти баланс аміногруп між клітинами.' },
  pepck: { name: 'ФЕП-КК (гвінейська трава)', acid: 'аспартат', acidEnz: 'АсАТ', acidWhere: 'цитозоль мезофілу', acidEq: 'оксалоацетат + глутамат → аспартат + 2-оксоглутарат', ret: 'ФЕП',
    dec: 'ФЕП-КК', decFull: 'ФЕП-карбоксикіназа (+ частково НАД-МЕ)', decWhere: 'цитозоль клітини обкладки', decEq: 'оксалоацетат + ATP → ФЕП + CO₂ + ADP', site: [752, 300], agr: false, sub: true,
    decText: 'ФЕП-карбоксикіназа одразу утворює ФЕП, тож ця гілка не потребує ППДК у мезофілі. «Чистого» ФЕП-КК-підтипу в природі немає: він завжди працює разом з НАД- чи НАДФ-малік-ензимом.' },
};
let c4Step = null;
function c4Steps(k) {
  const s = SUB[k];
  return [
    { title: 'Первинна фіксація CO₂', eq: 'CO₂ + H₂O → HCO₃⁻ + H⁺;  ФЕП + HCO₃⁻ → оксалоацетат (C₄) + Pᵢ', enz: 'карбоангідраза (КА), ФЕП-карбоксилаза (ФЕП-К)', where: 'цитозоль клітини мезофілу',
      text: 'CO₂ з міжклітинника карбоангідраза перетворює на гідрокарбонат — справжній субстрат ФЕП-карбоксилази. Цей фермент має високу спорідненість до HCO₃⁻ і зовсім не реагує з O₂, тож працює навіть за низького CO₂ у листку.',
      hl: ['c4-s-ca', 'c4-s-pepc', 'c4-q0', 'c4-q1'], movers: [{ p: 'c4-q0', label: 'CO₂', kind: 'co2', dur: 1100 }, { p: 'c4-q1', label: 'HCO₃⁻', kind: 'co2', delay: 1100, dur: 1100 }] },
    { title: `Утворення C₄-кислоти: ${s.acid}`, eq: s.acidEq, enz: s.acidEnz === 'АсАТ' ? 'аспартатамінотрансфераза (АсАТ)' : 'НАДФ-малатдегідрогеназа', where: s.acidWhere,
      text: `Оксалоацетат нестійкий, тому перетворюється на транспортну форму — ${s.acid}, яка за градієнтом концентрації дифундує через численні плазмодесми в клітину обкладки.`,
      hl: ['c4-s-pepc', 'c4-s-acid', 'c4-q2'], movers: [{ p: 'c4-q2', label: 'ОА', kind: 'acid', dur: 1300 }] },
    { title: 'Декарбоксилювання в обкладці', eq: s.decEq, enz: s.decFull, where: s.decWhere, text: s.decText,
      hl: ['c4-s-dec', 'c4-q3'], movers: [{ p: 'c4-q3', label: s.acid, kind: 'acid', dur: 1900 }] },
    { title: 'Цикл Кальвіна при надлишку CO₂', eq: 'CO₂ (1000–2000 ppm) + RuBP → 2 3-ФГК', enz: 'Рубіско та ферменти циклу Кальвіна', where: 'хлоропласт клітини обкладки',
      text: 'Концентрація CO₂ біля Рубіско в 10–20 разів вища, ніж у листку C₃-рослини, тому оксигенування майже не відбувається (фотодихання < 2–5 %). Рубіско працює на повну швидкість, і C₄-рослині потрібно в 3–4 рази менше цього білка — азот використовується ефективніше.',
      hl: ['c4-s-rub', 'c4-s-dec', 'c4-q4'], movers: [0, 1, 2].map((j) => ({ p: 'c4-q4', label: 'CO₂', kind: 'co2', delay: j * 350, dur: 1200 })) },
    { title: k === 'pepck' ? 'Повернення ФЕП у мезофіл' : 'Повернення C₃ і регенерація ФЕП', eq: k === 'pepck' ? 'ФЕП повертається в мезофіл без витрат на ППДК; частина — як аланін' : 'піруват + ATP + Pᵢ → ФЕП + AMP + PPᵢ;  AMP + ATP → 2 ADP (разом 2 ATP)', enz: k === 'pepck' ? 'транспорт через плазмодесми' : 'піруват-ортофосфатдикіназа (ППДК), аденілаткіназа, пірофосфатаза', where: 'хлоропласт клітини мезофілу',
      text: k === 'pepck' ? 'Завдяки ФЕП-карбоксикіназі цей підтип енергетично найдешевший: ≈ 3,6–4 ATP на CO₂.' : `${s.ret[0].toUpperCase() + s.ret.slice(1)} повертається в мезофіл; у хлоропласті ППДК регенерує ФЕП. ATP розщеплюється до AMP, тому регенерація коштує 2 ATP — разом C₄-шлях потребує 5 ATP і 2 NADPH на один CO₂.`,
      hl: ['c4-s-ppdk', 'c4-q5', 'c4-q6'], movers: [{ p: 'c4-q5', label: s.ret, kind: 'c', dur: 1700 }, { p: 'c4-q6', label: 'ФЕП', kind: 'c', delay: 1600, dur: 1500 }] },
  ];
}
function setSub(k) {
  const s = SUB[k];
  [...$('c4-sub').children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.k === k)));
  $('c4-bsag').style.display = s.agr ? '' : 'none';
  $('c4-bsgr').style.display = s.agr ? 'none' : '';
  $('c4-suberin').style.display = s.sub ? '' : 'none';
  $('c4-t-acid').textContent = s.acidEnz === 'АсАТ' ? 'АсАТ → аспартат' : 'НАДФ-МДГ → малат';
  $('c4-t-dec').textContent = s.dec;
  const [x, y] = s.site;
  $('c4-s-dec').setAttribute('transform', `translate(${x} ${y})`);
  $('c4-s-acid').setAttribute('transform', k === 'nadp' ? 'translate(565 372)' : 'translate(565 318)');
  $('c4-mito').classList.toggle('is-on', k === 'nad');
  const ax = k === 'nadp' ? 565 : 565, ay = k === 'nadp' ? 358 : 304;
  $('c4-q2').setAttribute('d', `M592 250 C600 280 ${ax + 20} ${ay - 20} ${ax} ${ay}`);
  $('c4-q3').setAttribute('d', `M${ax + 56} ${ay + 6} C650 ${ay} 690 ${(ay + y) / 2} ${x - 64} ${y}`);
  $('c4-q4').setAttribute('d', `M${x} ${y - 16} C${x + 4} ${(y + 150) / 2} 794 170 790 150`);
  $('c4-q5').setAttribute('d', `M${x - 30} ${y + 14} C700 ${Math.max(y + 60, 380)} 650 440 606 462`);
  [...document.querySelectorAll('#c4 .pr-path')].forEach((p) => lenCache.delete(p));
  if (c4Step) c4Step.setSteps(c4Steps(k)); else c4Step = new Stepper('c4', c4Steps(k));
}
if ($('c4')) {
  $('c4-sub').innerHTML = Object.entries(SUB).map(([k, s]) => `<button type="button" role="radio" data-k="${k}">${s.name}</button>`).join('');
  [...$('c4-sub').children].forEach((b) => b.addEventListener('click', () => setSub(b.dataset.k)));
  setSub('nadp');
}

// =====================================================================
//  CAM: добовий цикл (модель станів за Осмундом)
// =====================================================================
(() => {
  if (!$('cam')) return;
  const MMAX = 180, DT = 0.05;
  const NOTES = {
    normal: 'Достатньо води: проходять усі чотири фази Осмунда. Наведіть повзунок на ранок і вечір, щоб побачити короткі періоди відкритих продихів удень.',
    drought: 'Посуха: фази II і IV випадають — удень продихи не відкриваються зовсім, нічне поглинання CO₂ слабшає, але рослина майже не витрачає воду.',
    idle: 'CAM на холостому ходу: продихи закриті цілодобово. Уночі ФЕП-карбоксилаза перехоплює лише власний «дихальний» CO₂, удень він повертається в цикл Кальвіна. Приріст біомаси нульовий, але фотосинтетичний апарат зберігається.',
  };
  function simulate(mode) {
    let M = 20, S = 0.8;
    const rows = [];
    for (let day = 0; day < 3; day++) {
      for (let h = 0; h < 24 - 1e-9; h += DT) {
        const night = h < 6 || h >= 18;
        let phase, gs = 0, A = 0, ci = 400, dec = 0;
        if (night) {
          phase = 1;
          const gN = mode === 'normal' ? 1 : mode === 'drought' ? 0.45 : 0;
          gs = gN * (1 - 0.6 * M / MMAX);
          const pep = clamp(S / 0.08, 0, 1);
          A = 6.5 * gN * (1 - M / MMAX) * pep;
          const refix = mode === 'idle' ? 1.1 * pep * (1 - M / MMAX) : 0.4;
          const dM = (A + refix) * 3.6 * DT;
          M = Math.min(MMAX, M + dM); S = Math.max(0, S - dM / (MMAX * 1.05));
          ci = mode === 'idle' ? 120 : 260;
        } else if (h < 7.5 && mode === 'normal') {
          phase = 2;
          gs = 1 - (h - 6) / 1.5;
          A = 4.5 * gs;
          M = Math.min(MMAX, M + 0.5 * gs * 3.6 * DT);
          ci = 300;
        } else if (M > 14 || mode !== 'normal') {
          phase = 3;
          gs = 0.02;
          dec = 0.42 * M;
          const dM = Math.min(M, dec * DT);
          M -= dM; S = Math.min(1, S + dM / (MMAX * 1.05));
          ci = 400 + 52 * dec;
          A = 0;
        } else {
          phase = 4;
          if (h < 18) { gs = clamp((h - 13.5) / 1.2, 0, 0.85) * (1 - clamp((h - 17) / 1, 0, 1)); }
          A = 5 * gs;
          S = Math.min(1, S + A * 3.6 * DT / (MMAX * 1.6));
          ci = 280;
        }
        if (day === 2) rows.push({ h, phase, gs, A, M, S, ci, dec });
      }
    }
    return rows;
  }
  const DATA = { normal: simulate('normal'), drought: simulate('drought'), idle: simulate('idle') };
  let mode = 'normal', t = 2, playing = false, raf = 0, last = 0;
  const plot = new Plot($('cam-plot'), { xLabel: 'Час доби, год', yLabel: '% від максимуму', xShort: 't', x: [0, 24], y: [0, 105], aspect: 2.6 });
  function drawPlot() {
    const d = DATA[mode];
    const aMax = 6.5, step = 4;
    const pick = (f) => d.filter((_, i) => i % step === 0).map((r) => [r.h, f(r)]);
    plot.set([
      { data: pick((r) => r.A / aMax * 100), color: '#2E7D32', width: 2.4, label: 'поглинання CO₂ листком', fill: 'rgba(46,125,50,.08)' },
      { data: pick((r) => r.M / MMAX * 100), color: '#E8833A', width: 2.4, label: 'малат у вакуолі' },
      { data: pick((r) => r.gs * 100), color: '#3F7FD0', width: 1.6, dash: [5, 4], label: 'провідність продихів' },
    ], [{ x: 6, color: '#E3C77A', dash: [2, 4], label: 'світанок' }, { x: 18, color: '#9FB3A3', dash: [2, 4], label: 'захід' }, { x: t, color: '#B08A1E', label: fmtH(t) }]);
  }
  segmented($('cam-mode'), 'cam-mode', [{ value: 'normal', label: 'Достатньо води' }, { value: 'drought', label: 'Посуха' }, { value: 'idle', label: 'CAM-idling' }], mode, (v) => { mode = v; $('cam-note').textContent = NOTES[v]; drawPlot(); show(); });
  $('cam-note').textContent = NOTES[mode];
  const slider = $('cam-time');
  slider.addEventListener('input', () => { t = +slider.value; pause(); show(); drawPlot(); });
  const btn = $('cam-play');
  const ui = () => { btn.innerHTML = playing ? PAUSE + 'Пауза' : PLAY + 'Прогнати добу'; };
  function pause() { playing = false; ui(); }
  btn.addEventListener('click', () => { playing = !playing; ui(); if (playing) { last = 0; loop(); } });
  ui();
  const vis = watchVisible($('cam'), (on) => { if (on) loop(); });
  function fmtH(h) { const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
  const PH = ['', 'I', 'II', 'III', 'IV'];
  const PHN = ['', 'Ніч: темнова фіксація CO₂', 'Світанок: перехід', 'День: декарбоксилювання малату', 'Вечір: пряма фіксація (C₃)'];
  const mals = [...document.querySelectorAll('#cam .cam-m')];
  const layer = $('cam-tok');
  const flows = [];
  let spawn = 0;
  const row = () => { const d = DATA[mode]; return d[clamp(Math.round(t / DT), 0, d.length - 1)]; };
  function show() {
    const r = row();
    slider.value = t; slider.style.setProperty('--pct', t / 24 * 100 + '%');
    $('cam-tlab').textContent = fmtH(t);
    const x = 30 + t / 24 * 840;
    $('cam-sun').setAttribute('transform', `translate(${x.toFixed(1)} 23)`);
    const day = t >= 6 && t < 18;
    $('cam-sunc').setAttribute('fill', day ? '#FFC93C' : '#DDE6F3');
    const gap = 1 + 9 * r.gs;
    $('cam-g1').setAttribute('transform', `translate(${-gap + 4} 0)`);
    $('cam-g2').setAttribute('transform', `translate(${gap - 4} 0)`);
    const f = r.M / MMAX;
    $('cam-mal').setAttribute('opacity', (0.32 * f).toFixed(3));
    const nOn = Math.round(f * mals.length);
    mals.forEach((m, i) => m.classList.toggle('is-on', i < nOn));
    const pH = 6.0 - 2.7 * f;
    $('cam-ph-t').textContent = `pH ${num(pH, 1)} · яблучна кислота`;
    const st = 0.4 + 0.9 * r.S;
    $('cam-st1').setAttribute('rx', (10 * st).toFixed(1)); $('cam-st1').setAttribute('ry', (6 * st).toFixed(1));
    $('cam-st2').setAttribute('rx', (5 * st).toFixed(1)); $('cam-st2').setAttribute('ry', (8 * st).toFixed(1));
    $('cam-phase').textContent = PH[r.phase];
    $('cam-phase-n').textContent = mode === 'idle' && r.phase === 1 ? 'Ніч: рефіксація дихального CO₂' : PHN[r.phase];
    $('cam-gs').textContent = r.gs > 0.5 ? 'відкриті' : r.gs > 0.08 ? 'частково відкриті' : 'закриті';
    $('cam-mv').textContent = `${num(r.M, 0)} ммоль·м⁻²`;
    $('cam-mbar').setAttribute('width', (158 * f).toFixed(1));
    $('cam-sbar').setAttribute('width', (158 * r.S).toFixed(1));
    $('cam-a').textContent = `${num(r.A, 1)} мкмоль·м⁻²·с⁻¹`;
    $('cam-ci').textContent = `≈ ${Math.round(r.ci / 10) * 10} ppm`;
    ['cam-s-pepc', 'cam-s-gly'].forEach((id) => $(id).classList.toggle('is-on', r.phase === 1 || r.phase === 2));
    $('cam-s-dec').classList.toggle('is-on', r.phase === 3 && r.dec > 1);
  }
  function activeFlows(r) {
    const out = [];
    if (r.phase === 1 || r.phase === 2) {
      if (r.gs > 0.05) out.push(['cam-q0', 'CO₂', 'co2', r.A]);
      else if (mode === 'idle') out.push(['cam-q0', 'CO₂', 'co2', 0]);
      out.push(['cam-q2', 'ФЕП', 'c', r.A + 0.8], ['cam-q1', 'малат', 'acid', r.A + 0.8]);
    }
    if (r.phase === 3 && r.dec > 1) out.push(['cam-q3', 'малат', 'acid', r.dec / 8], ['cam-q4', 'CO₂', 'co2', r.dec / 8], ['cam-q5', 'крохмаль', 'sugar', r.dec / 14]);
    if (r.phase === 4 && r.gs > 0.05) out.push(['cam-q6', 'CO₂', 'co2', r.A]);
    if (r.phase === 2 && r.gs > 0.05) out.push(['cam-q6', 'CO₂', 'co2', r.A * 0.6]);
    return out.filter((f) => f[3] > 0.15);
  }
  function loop() {
    if (raf || REDUCED) return;
    raf = requestAnimationFrame(function fr(now) {
      raf = 0;
      if (!vis.on || document.hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (playing) { t = (t + dt * 1.1) % 24; show(); if (Math.round(now / 120) % 2 === 0) drawPlot(); }
      const r = row();
      spawn -= dt;
      if (spawn <= 0) {
        spawn = 0.55;
        activeFlows(r).forEach(([p, label, kind, rate]) => { if (Math.random() < clamp(rate / 4, 0.25, 1)) flows.push({ g: makeToken(layer, label, kind), p: $(p), f: 0 }); });
      }
      for (let i = flows.length - 1; i >= 0; i--) {
        const fl = flows[i];
        fl.f += dt / 1.8;
        if (fl.f >= 1) { fl.g.remove(); flows.splice(i, 1); continue; }
        const pt = pathPoint(fl.p, fl.f);
        fl.g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        fl.g.setAttribute('opacity', String(Math.min(1, fl.f * 5, (1 - fl.f) * 5)));
      }
      raf = requestAnimationFrame(fr);
    });
  }
  show(); drawPlot();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; loop(); } });
})();

// =====================================================================
//  Модель FvCB: C3 (пшениця) проти C4 (кукурудза)
// =====================================================================
(() => {
  if (!$('fv-plot')) return;
  const O = 210000; // мкбар
  function c3(T, I, Ci) {
    const Vc = peaked(95, 65330, T, 645), Jm = peaked(165, 43540, T, 650), Rd = arr(1.2, 46390, T), Tp = peaked(9, 53100, T, 650);
    const Kc = arr(404.9, 79430, T), Ko = arr(278400, 36380, T), G = gammaStar(T);
    const I2 = 0.36 * I, th = 0.7;
    const J = (I2 + Jm - Math.sqrt((I2 + Jm) ** 2 - 4 * th * I2 * Jm)) / (2 * th);
    const Wc = Vc * (Ci - G) / (Ci + Kc * (1 + O / Ko));
    const Wj = J * (Ci - G) / (4 * Ci + 8 * G);
    const Wp = 3 * Tp;
    const m = Math.min(Wc, Wj, Ci > G ? Wp : Infinity);
    const lim = m === Wc ? 'Рубіско (W<sub>c</sub>)' : m === Wj ? 'світло, регенерація RuBP (W<sub>j</sub>)' : 'використання тріозофосфатів';
    return { A: m - Rd, lim, pr: Math.max(0, G / Ci) };
  }
  function c4(T, I, Ci) {
    const Vc = peaked(40, 78000, T, 645), Vpm = peaked(120, 70373, T, 645), Vpr = peaked(80, 70373, T, 645), Jm = peaked(400, 77900, T, 645), Rd = arr(0.8, 46390, T), Rm = Rd / 2;
    const Kp = arr(80, 36300, T), gbs = 0.003, x = 0.4;
    const I2 = 0.36 * I * 1.05, th = 0.7;
    const J = (I2 + Jm - Math.sqrt((I2 + Jm) ** 2 - 4 * th * I2 * Jm)) / (2 * th);
    const Cm = Ci;
    const Vp = Math.min(Cm * Vpm / (Cm + Kp), Vpr);
    const Ac = Math.min(Vp - Rm + gbs * Cm, Vc - Rd);
    const Aj = Math.min(x * J / 2 - Rm + gbs * Cm, (1 - x) * J / 3 - Rd);
    const A = Math.min(Ac, Aj);
    // CO₂ в обкладці за типового витоку ≈ 12 % від швидкості накачування
    const Cs = Cm + 0.12 * Math.max(0, A + Rd) / gbs;
    return { A, Cs };
  }
  let axis = 'co2';
  const sl = sliders($('fv-c'), [
    { id: 'fvT', label: 'Температура листка', min: 5, max: 45, step: 1, value: 25, unit: '°C' },
    { id: 'fvI', label: 'Освітленість (ФАР)', min: 50, max: 2200, step: 10, value: 1500, unit: 'мкмоль·м⁻²·с⁻¹' },
    { id: 'fvCa', label: 'CO₂ в атмосфері', min: 100, max: 1200, step: 10, value: 420, unit: 'ppm', hint: 'Cᵢ = 0,7·Cₐ для C₃ і 0,4·Cₐ для C₄ — C₄-рослина тримає продихи вужчими' },
  ], upd);
  segmented($('fv-axis'), 'fv-axis', [{ value: 'co2', label: 'CO₂' }, { value: 'light', label: 'Світло' }, { value: 'temp', label: 'Температура' }], axis, (v) => { axis = v; upd(); });
  const plot = new Plot($('fv-plot'), { xLabel: 'CO₂ в атмосфері, ppm', yLabel: 'A, мкмоль CO₂·м⁻²·с⁻¹', xShort: 'Cₐ', x: [0, 1200], y: 'auto', yZero: true, aspect: 1.75 });
  function upd() {
    const { fvT, fvI, fvCa } = sl.values;
    const f3 = (T, I, Ca) => c3(T, I, Ca * 0.7).A, f4 = (T, I, Ca) => c4(T, I, Ca * 0.4).A;
    let xs, X, opt, mk;
    if (axis === 'co2') { xs = linspace(40, 1200, 160); X = (x) => [fvT, fvI, x]; opt = { xLabel: 'CO₂ в атмосфері, ppm', xShort: 'Cₐ', x: [0, 1200] }; mk = fvCa; }
    else if (axis === 'light') { xs = linspace(0, 2200, 160); X = (x) => [fvT, x, fvCa]; opt = { xLabel: 'ФАР, мкмоль фотонів·м⁻²·с⁻¹', xShort: 'I', x: [0, 2200] }; mk = fvI; }
    else { xs = linspace(5, 45, 160); X = (x) => [x, fvI, fvCa]; opt = { xLabel: 'Температура листка, °C', xShort: 'T', x: [5, 45] }; mk = fvT; }
    plot.setOptions(opt);
    const cur = X(mk);
    plot.set([
      { data: xs.map((x) => [x, f3(...X(x))]), color: '#2E7D32', width: 2.6, label: 'C₃ — пшениця', marker: [mk, f3(...cur)] },
      { data: xs.map((x) => [x, f4(...X(x))]), color: '#C9A227', width: 2.6, label: 'C₄ — кукурудза', marker: [mk, f4(...cur)] },
    ], [{ y: 0, color: '#C9D3CC' }]);
    const r3 = c3(fvT, fvI, fvCa * 0.7), r4 = c4(fvT, fvI, fvCa * 0.4);
    setOut(document, {
      fva3: num(r3.A, 1), fva4: num(r4.A, 1), fvlim: r3.lim,
      fvpr: r3.pr < 1 ? num(r3.pr * 100, 0) + ' %' : '> 100 %',
      fvbs: '≈ ' + sig(Math.min(r4.Cs, 5000), 2).replace(',0', '') + ' ppm',
    });
  }
  upd();
})();
