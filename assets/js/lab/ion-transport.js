// Конспект «Транспорт іонів у клітинах рослин»: навігація по лекціях і інтерактивні моделі.
// Кожна модель ініціалізується лише тоді, коли наближається до видимої області.
import { Plot, sample, linspace } from './plot.js';
import { sliders, segmented, num, sig } from './ui.js';

const DATA = JSON.parse(document.getElementById('it-data').textContent);
const IDX = JSON.parse(document.getElementById('enz-index').textContent);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mv = (v) => num(v, Math.abs(v) < 10 ? 1 : 0) + ' мВ';

/* =========================================================
   Навігація
   ========================================================= */
const nav = $('#it-nav');
const lecs = $$('.it-lec');
const subs = $$('.it-sub');
const navLecs = new Map($$('.it-nav__lec[data-lec]', nav).map((li) => [li.dataset.lec, li]));
const subLinks = new Map($$('.it-nav__subs a', nav).map((a) => [a.getAttribute('href').slice(1), a]));
const userOpen = new Set();
const prog = $('.it-progress');
const progBar = prog.firstElementChild;
const progT = $('.it-progress__t');
const topBtn = $('.it-top');
const article = $('.it-article');
const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 68;

navLecs.forEach((li, id) => {
  const tg = $('.it-nav__tg', li);
  tg.addEventListener('click', () => {
    const open = !li.classList.contains('is-open');
    li.classList.toggle('is-open', open);
    tg.setAttribute('aria-expanded', String(open));
    if (open) userOpen.add(id); else userOpen.delete(id);
  });
});

let curLec = null, curSub = null, ticking = false;
function onScroll() {
  ticking = false;
  const hh = headerH();
  const line = hh + 120;
  const vh = window.innerHeight;
  // загальний поступ
  const ar = article.getBoundingClientRect();
  const total = clamp((hh + 40 - ar.top) / Math.max(1, ar.height - vh + hh), 0, 1);
  progBar.style.setProperty('--p', (total * 100).toFixed(1) + '%');
  prog.classList.toggle('is-on', ar.top < hh && ar.bottom > hh);
  topBtn.classList.toggle('is-on', window.scrollY > 900);
  // поточна лекція і поступ кожної
  let cur = null;
  for (const s of lecs) {
    const r = s.getBoundingClientRect();
    const p = clamp((line - r.top) / Math.max(1, r.height), 0, 1);
    const li = navLecs.get(s.id);
    if (li) li.querySelector('.it-nav__bar > i').style.setProperty('--p', (p * 100).toFixed(0) + '%');
    if (r.top <= line && r.bottom > line) cur = s;
  }
  if (cur !== curLec) {
    curLec = cur;
    navLecs.forEach((li, id) => {
      const on = cur && cur.id === id;
      li.classList.toggle('is-cur', !!on);
      const open = on || userOpen.has(id);
      li.classList.toggle('is-open', open);
      $('.it-nav__tg', li).setAttribute('aria-expanded', String(open));
    });
  }
  // поточний підрозділ
  let cs = null;
  for (const s of subs) { if (s.getBoundingClientRect().top <= line) cs = s; else break; }
  if (cs && cur && !cur.contains(cs)) cs = null;
  if (cs !== curSub) {
    if (curSub) subLinks.get(curSub.id)?.classList.remove('is-active');
    curSub = cs;
    const a = cs && subLinks.get(cs.id);
    if (a) {
      a.classList.add('is-active');
      if (!nav.classList.contains('is-open')) {
        const nr = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
        if (r.top < nr.top + 40 || r.bottom > nr.bottom - 20) nav.scrollTop += r.top - nr.top - nr.height / 3;
      }
    }
  }
  progT.textContent = cur ? `Лекція ${cur.dataset.lec} · ${cur.dataset.title}` + (cs ? ' — ' + $('h3', cs).textContent.replace(/^\d+\.\d+/, '') : '') : '';
}
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
window.addEventListener('resize', () => requestAnimationFrame(onScroll));
onScroll();
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

// Мобільна шухляда
const fab = $('.it-fab'), scrim = $('.it-scrim');
function drawer(open) {
  nav.classList.toggle('is-open', open);
  scrim.hidden = !open;
  fab.setAttribute('aria-expanded', String(open));
  document.documentElement.style.overflow = open ? 'hidden' : '';
  if (open) {
    const a = nav.querySelector('.is-active') || nav.querySelector('.is-cur');
    if (a) a.scrollIntoView({ block: 'center' });
    setTimeout(() => $('.it-nav__close', nav).focus(), 50);
  }
}
fab.addEventListener('click', () => drawer(true));
scrim.addEventListener('click', () => drawer(false));
$('.it-nav__close', nav).addEventListener('click', () => { drawer(false); fab.focus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { drawer(false); fab.focus(); } });
// Перехід за посиланням навігації: далекі стрибки — миттєво, близькі — плавно
function jump(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const far = Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 3;
  const top = el.getBoundingClientRect().top + window.scrollY - headerH() - 14;
  window.scrollTo({ top, behavior: far || reduceMotion ? 'instant' : 'smooth' });
  history.pushState(null, '', '#' + id);
  flash(id);
}
nav.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  e.preventDefault();
  if (nav.classList.contains('is-open')) drawer(false);
  requestAnimationFrame(() => jump(a.getAttribute('href').slice(1)));
});
article.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || a.getAttribute('href').length < 2) return;
  e.preventDefault();
  jump(a.getAttribute('href').slice(1));
});

function flash(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const t = el.matches('.it-sub') ? $('h3', el) : el.matches('.it-lec') ? $('.it-lec__head', el) : el;
  t.classList.remove('it-flash'); void t.offsetWidth; t.classList.add('it-flash');
}

// Пошук по конспекту
const find = $('#it-find'), res = $('#it-find-res');
const norm = (s) => s.toLowerCase().replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 8320)).replace(/[⁺⁻²³]/g, '').replace(/ё/g, 'е');
const IDXN = IDX.map((r) => ({ r, h: norm(r.t + ' ' + (r.k || '') + ' ' + r.s), t: norm(r.t) }));
const secName = Object.fromEntries($$('.it-sub').map((s) => [s.id, $('h3', s).textContent.replace(/^(\d+\.\d+)/, '$1 ')]));
function search() {
  const q = norm(find.value.trim());
  if (q.length < 2) { res.hidden = true; res.innerHTML = ''; return; }
  const words = q.split(/\s+/);
  const hits = IDXN.filter((x) => words.every((w) => x.h.includes(w)))
    .sort((a, b) => (b.t.startsWith(q) - a.t.startsWith(q)) || (b.t.includes(q) - a.t.includes(q)))
    .slice(0, 9);
  res.innerHTML = hits.length
    ? hits.map((x) => `<li><a href="#${x.r.id}">${x.r.t}<small>${x.r.s.startsWith('Лекція') ? x.r.s : x.r.s + ' · ' + (secName[x.r.id] || '')}</small></a></li>`).join('')
    : '<li class="is-empty">Нічого не знайдено</li>';
  res.hidden = false;
}
find.addEventListener('input', search);
find.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const a = $('a', res); if (a) { e.preventDefault(); a.click(); } }
  if (e.key === 'ArrowDown') { const a = $('a', res); if (a) { e.preventDefault(); a.focus(); } }
});
res.addEventListener('keydown', (e) => {
  const links = $$('a', res); const i = links.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? links[i - 1] : find).focus(); }
});
res.addEventListener('click', (e) => { if (e.target.closest('a')) { find.value = ''; setTimeout(() => { res.hidden = true; }, 0); } });

// Перехід за якорем із пошуку на сторінці «Конспект»
if (location.hash) setTimeout(() => flash(location.hash.slice(1)), 400);

/* =========================================================
   Ледача ініціалізація моделей
   ========================================================= */
const W = {};
function boot() {
  const roots = $$('[data-w]');
  const start = (el) => {
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    const fn = W[el.dataset.w];
    if (fn) { try { fn(el.querySelector('.it-viz__body') || el); } catch (err) { console.error(el.dataset.w, err); } }
  };
  if (!('IntersectionObserver' in window)) { roots.forEach(start); return; }
  const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); start(en.target); } }), { rootMargin: '400px 0px' });
  roots.forEach((r) => io.observe(r));
}
/** Анімація лише у видимій області (для requestAnimationFrame-циклів). */
function whenVisible(el, cb) {
  if (!('IntersectionObserver' in window)) { cb(true); return; }
  new IntersectionObserver((ents) => ents.forEach((en) => cb(en.isIntersecting))).observe(el);
}
const pill = (txt, col) => `<span class="cm__tag" style="background:${col}">${txt}</span>`;
const kpi = (label, val) => `<div class="it-kpi"><small>${label}</small><b>${val}</b></div>`;

/* ---------- Карта клітини ---------- */
W.cellmap = (root) => {
  const svg = $('svg', root), info = $('[data-info]', root);
  const ps = $$('.cm-p', svg);
  const TCOL = { ch: '#1F7A8C', tr: '#6B4FBB', pu: '#C8890E' };
  let fIon = 'all', fType = 'all';
  const apply = () => ps.forEach((g) => {
    const d = DATA.cm[g.dataset.id];
    const ok = (fIon === 'all' || d.ions.includes(fIon)) && (fType === 'all' || d.t === fType);
    g.classList.toggle('is-dim', !ok);
  });
  segmented($('[data-ion]', root), 'cm-ion', [{ value: 'all', label: 'Усі іони' }, ...Object.entries(DATA.ions).map(([k, v]) => ({ value: k, label: v[0] }))], 'all', (v) => { fIon = v; apply(); });
  segmented($('[data-type]', root), 'cm-type', [{ value: 'all', label: 'Усі типи' }, ...Object.entries(DATA.types).map(([k, v]) => ({ value: k, label: v.replace(' (АТФаза)', '') }))], 'all', (v) => { fType = v; apply(); });
  const show = (g) => {
    ps.forEach((x) => x.classList.toggle('is-sel', x === g));
    const d = DATA.cm[g.dataset.id];
    const [l, s] = d.sec.slice(1).split('-');
    info.innerHTML = `<div class="cm__tags">${pill(DATA.types[d.t], TCOL[d.t])}${d.ions.map((i) => pill(DATA.ions[i][0], DATA.ions[i][1])).join('')}</div>
      <h4>${d.n}</h4><p>${DATA.mems[d.mem]}</p><p class="cm__dir">→ ${d.d}</p><p>${d.info}</p>
      <a class="btn btn--sm btn--outline" href="#${d.sec}">Розділ ${l}.${s}: ${d.secT}</a>`;
  };
  ps.forEach((g) => {
    g.addEventListener('click', () => show(g));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(g); } });
  });
  show(ps.find((g) => g.dataset.id === 'aha2'));
};

/* ---------- Рівняння Нернста і баланс сил ---------- */
const ION_P = {
  K: { l: 'K⁺', z: 1, ci: 140, co: 4, rng: [0.001, 1000] },
  Na: { l: 'Na⁺', z: 1, ci: 14, co: 140, rng: [0.001, 1000] },
  Ca: { l: 'Ca²⁺', z: 2, ci: 0.0001, co: 1, rng: [0.00001, 100] },
  Cl: { l: 'Cl⁻', z: -1, ci: 20, co: 1, rng: [0.001, 1000] },
  NO3: { l: 'NO₃⁻', z: -1, ci: 10, co: 1, rng: [0.001, 1000] },
  H: { l: 'H⁺', z: 1, ci: 0.00005, co: 0.0032, rng: [0.000001, 1] },
};
const fmtC = (v) => (v >= 1 ? sig(v, 3) + ' мМ' : v >= 0.001 ? sig(v * 1000, 3) + ' мкМ' : sig(v * 1e6, 3) + ' нМ');
W.nernst = (root) => {
  let ion = 'K';
  const host = $('[data-sl]', root);
  let api;
  const build = () => {
    const p = ION_P[ion];
    host.innerHTML = '';
    api = sliders(host, [
      { id: 'co', label: `[${p.l}] ззовні`, min: p.rng[0], max: p.rng[1], value: p.co, log: true, format: fmtC },
      { id: 'ci', label: `[${p.l}] у цитозолі`, min: p.rng[0], max: p.rng[1], value: p.ci, log: true, format: fmtC },
      { id: 'vm', label: 'Потенціал мембрани V<sub>m</sub>', min: -250, max: 60, step: 1, value: -150, unit: 'мВ' },
      { id: 't', label: 'Температура', min: 0, max: 40, step: 1, value: 21, unit: '°C' },
    ], draw);
    draw();
  };
  segmented($('[data-ion]', root), 'nernst-ion', Object.entries(ION_P).map(([k, v]) => ({ value: k, label: v.l })), ion, (v) => { ion = v; build(); });
  const forces = $('[data-forces]', root), kpis = $('[data-kpis]', root), verdict = $('[data-verdict]', root);
  function draw() {
    const p = ION_P[ion], v = api.values;
    const T = 273.15 + v.t;
    const E = 1000 * 8.314 * T / (p.z * 96485) * Math.log(v.co / v.ci);
    const s = Math.sign(p.z);
    const chem = s * E, elec = -s * v.vm, net = chem + elec; // > 0 — сила всередину
    kpis.innerHTML = kpi(`E<sub>${p.l}</sub>`, mv(E)) + kpi('V<sub>m</sub>', mv(v.vm)) + kpi('V<sub>m</sub> − E', mv(v.vm - E)) + kpi('Коефіцієнт RT/F·ln10', num(1000 * 8.314 * T / 96485 * Math.LN10, 1) + ' мВ');
    const dir = Math.abs(net) < 2 ? 0 : net > 0 ? 1 : -1;
    verdict.innerHTML = dir === 0 ? `Рівновага: V<sub>m</sub> ≈ E<sub>${p.l}</sub>, результуючого потоку немає, хоча канали можуть бути відкриті.`
      : `Пасивно ${p.l} рухатиметься <b>${dir > 0 ? 'в клітину' : 'з клітини'}</b> з рушійною силою ${mv(Math.abs(net))}.` +
        (dir < 0 && (ion === 'K') ? ' Щоб поглинати K⁺ каналом, мембрана має бути негативнішою за E<sub>K</sub>.' : '') +
        (dir > 0 && (ion === 'Na' || ion === 'Ca') ? ` Вхід ${p.l} пасивний — клітина мусить активно його видаляти.` : '') +
        (dir < 0 && (ion === 'NO3' || ion === 'Cl') ? ' Тому аніони поглинаються лише вторинно-активним симпортом з H⁺.' : '');
    const M = Math.max(60, Math.abs(chem), Math.abs(elec), Math.abs(net));
    const W_ = 560, cx = W_ / 2, L = 220;
    const arrow = (y, val, col, label) => {
      const len = (val / M) * L, x2 = cx - len; // всередину = ліворуч (клітина ліворуч)
      const txt = `<text x="${Math.abs(len) < 2 ? cx : (cx + x2) / 2}" y="${y - 12}" text-anchor="middle" class="it-t it-t--b" style="fill:${col}">${label}: ${Math.abs(len) < 2 ? '≈ 0' : mv(Math.abs(val)) + (len > 0 ? ' ← всередину' : ' назовні →')}</text>`;
      if (Math.abs(len) < 2) return txt;
      return `<path d="M${cx} ${y}H${x2}" stroke="${col}" stroke-width="9" stroke-linecap="round" marker-end="url(#nf-a${col.slice(1)})"/>` + txt;
    };
    const mk = (c) => `<marker id="nf-a${c.slice(1)}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`;
    forces.innerHTML = `<svg viewBox="0 0 ${W_} 190" role="img" aria-label="Хімічна, електрична і сумарна сили">
      <defs>${mk('#2E86C1')}${mk('#C0392B')}${mk('#13241A')}</defs>
      <rect x="0" y="0" width="${cx - 6}" height="190" fill="#F3F8EE"/><rect x="${cx + 6}" y="0" width="${cx - 6}" height="190" fill="#F4F9FD"/>
      <rect x="${cx - 6}" y="0" width="12" height="190" fill="#E9B54E"/>
      <text x="12" y="20" class="it-t it-t--b">Цитозоль · ${fmtC(v.ci)}</text><text x="${W_ - 12}" y="20" text-anchor="end" class="it-t it-t--b">Апопласт · ${fmtC(v.co)}</text>
      <text x="12" y="182" class="it-t it-t--s">${v.vm < 0 ? '− − − − −' : '+ + + + +'}</text><text x="${W_ - 12}" y="182" text-anchor="end" class="it-t it-t--s">${v.vm < 0 ? '+ + + + +' : '− − − − −'}</text>
      ${arrow(62, chem, '#2E86C1', 'хімічна')}${arrow(106, elec, '#C0392B', 'електрична')}${arrow(150, net, '#13241A', 'сумарна')}</svg>`;
  }
  build();
};

/* ---------- Канал vs транспортер ---------- */
W.kin = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: '[S], мМ', yLabel: 'Швидкість переносу (відн.)', x: [0, 20], y: [0, 'auto'], yZero: true, xShort: '[S]', aspect: 1.7 });
  plot.o.y = 'auto';
  const api = sliders($('[data-sl]', root), [
    { id: 'k', label: 'Канал: провідність (нахил)', min: 0.2, max: 3, step: 0.1, value: 1 },
    { id: 'vmax', label: 'Транспортер: V<sub>max</sub>', min: 2, max: 20, step: 0.5, value: 10 },
    { id: 'km', label: 'Транспортер: K<sub>m</sub>', min: 0.1, max: 10, step: 0.1, value: 2, unit: 'мМ' },
  ], draw);
  function draw() {
    const v = api.values;
    plot.set([
      { data: sample((s) => v.k * s, 0, 20, 60), color: '#1F7A8C', label: 'Канал (без насичення)' },
      { data: sample((s) => v.vmax * s / (v.km + s), 0, 20, 200), color: '#6B4FBB', label: 'Транспортер (Міхаеліс–Ментен)' },
      { data: [[0, v.vmax], [20, v.vmax]], color: '#6B4FBB', dash: [6, 6], width: 1.5, noHover: true },
    ], [{ x: v.km, label: 'Kₘ', color: '#6B4FBB' }]);
  }
  draw();
};

/* ---------- Уніпорт / симпорт / антипорт ---------- */
W.porters = (root) => {
  const host = $('[data-porters]', root);
  const ion = (x, lab, col, cls) => `<g class="pt-ion ${cls}" style="transform-box:fill-box"><circle cx="${x}" cy="80" r="11" fill="${col}"/><text x="${x}" y="84" text-anchor="middle" class="it-t it-t--w" style="font-size:10px">${lab}</text></g>`;
  const card = (title, txt, inner) => `<figure><svg class="it-svg" viewBox="0 0 200 160" role="img" aria-label="${title}">
    <rect width="200" height="160" fill="#FBFCFE"/><rect x="0" y="66" width="200" height="28" fill="#F3DFA6"/><text x="6" y="14" class="it-t it-t--s">ззовні</text><text x="6" y="154" class="it-t it-t--s">цитозоль</text>
    <rect x="70" y="58" width="60" height="44" rx="16" fill="#6B4FBB" opacity=".9"/>${inner}</svg><figcaption><b>${title}</b>${txt}</figcaption></figure>`;
  host.innerHTML =
    card('Уніпорт', 'Один субстрат за градієнтом (полегшена дифузія).', ion(100, 'K⁺', '#7B4FD0', '')) +
    card('Симпорт', 'Два субстрати в одному напрямку: H⁺ «тягне» NO₃⁻ чи K⁺.', ion(88, 'H⁺', '#D04545', '') + ion(112, 'NO₃⁻', '#1F5FA8', '')) +
    card('Антипорт', 'Два субстрати назустріч: Na⁺ назовні, H⁺ всередину (SOS1).', ion(88, 'H⁺', '#D04545', '') + ion(112, 'Na⁺', '#E07A3E', 'pt-ion--r'));
  const set = (p) => host.classList.toggle('is-paused', p);
  let user = false;
  host.addEventListener('click', () => { user = !host.classList.contains('is-paused'); set(user); });
  whenVisible(host, (vis) => set(!vis || user));
};

/* ---------- KcsA ---------- */
W.kcsa = (root) => {
  const k = $('.ks-k', root), na = $('.ks-na', root);
  segmented($('[data-ks]', root), 'ks', [{ value: 'k', label: 'K⁺ (1,33 Å)' }, { value: 'na', label: 'Na⁺ (0,95 Å)' }], 'k', (v) => { k.style.display = v === 'k' ? '' : 'none'; na.style.display = v === 'na' ? '' : 'none'; });
};

/* ---------- Конфігурації patch clamp ---------- */
W.patch = (root) => {
  const TXT = [
    '<b>Cell-attached.</b> Гігаомний контакт з цілою клітиною: під кінчиком 1–3 канали, цитоплазма не порушена, але склад розчину з внутрішнього боку контролювати не можна.',
    '<b>Whole-cell.</b> Імпульс тиску чи струму прориває мембрану під кінчиком; розчин піпетки заповнює клітину. Реєструється сумарний струм усіх каналів (сотні пА — нА).',
    '<b>Inside-out.</b> Піпетку різко відводять від cell-attached — вириваючи фрагмент. Цитоплазматичний бік дивиться у ванночку: зручно міняти Ca²⁺, АТФ, цАМФ, кінази.',
    '<b>Outside-out.</b> Піпетку відводять від whole-cell; краї мембрани замикаються так, що назовні дивиться апопластний бік — зручно тестувати зовнішні ліганди й блокатори.',
  ];
  const panels = $$('.pc-panel', root), txt = $('[data-txt]', root);
  segmented($('[data-btns]', root), 'pc', ['Cell-attached', 'Whole-cell', 'Inside-out', 'Outside-out'].map((l, i) => ({ value: i, label: l })), 0, sel);
  function sel(i) { i = +i; panels.forEach((p, j) => p.classList.toggle('is-on', j === i)); txt.innerHTML = TXT[i]; }
  sel(0);
};

/* ---------- Поодинокі канали ---------- */
W.chan = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: 't, мс', yLabel: 'I, пА', x: [0, 200], y: [-0.5, 'auto'], yZero: true, xShort: 't', aspect: 1.8 });
  const api = sliders($('[data-sl]', root), [
    { id: 'n', label: 'Каналів у патчі', min: 1, max: 5, step: 1, value: 3 },
    { id: 'p', label: 'P<sub>open</sub> у стаціонарі', min: 0.05, max: 0.9, step: 0.05, value: 0.4 },
    { id: 'i', label: 'Струм одного каналу i', min: 0.5, max: 4, step: 0.5, value: 2, unit: 'пА' },
  ], () => run(false));
  const dt = 0.2, t0 = 20, tau = 12;
  function trace(n, P, i) {
    // α + β = 1/τ, P = α/(α+β); до сходинки канали закриті
    const a = P / tau, b = (1 - P) / tau;
    const st = new Array(n).fill(0), out = [];
    for (let t = 0; t <= 200; t += dt) {
      if (t >= t0) for (let k = 0; k < n; k++) { const r = Math.random(); if (st[k]) { if (r < b * dt) st[k] = 0; } else if (r < a * dt) st[k] = 1; }
      out.push([t, st.reduce((s, x) => s + x, 0) * i]);
    }
    return out;
  }
  let avg = null;
  function run(doAvg) {
    const { n, p, i } = api.values;
    const one = trace(n, p, i);
    if (doAvg) {
      const acc = one.map(([t]) => [t, 0]);
      for (let r = 0; r < 300; r++) trace(n, p, i).forEach(([, y], j) => { acc[j][1] += y / 300; });
      avg = acc;
    } else avg = null;
    const theo = sample((t) => (t < t0 ? 0 : n * i * p * (1 - Math.exp(-(t - t0) / tau))), 0, 200, 300);
    plot.setOptions({ y: [-0.3, n * i + 0.8] });
    plot.set([
      { data: one, color: avg ? 'rgba(31,122,140,.35)' : '#1F7A8C', type: 'step', width: 1.6, label: 'Один запис' },
      avg && { data: avg, color: '#C8890E', width: 2.6, label: 'Середнє 300 записів' },
      avg && { data: theo, color: '#13241A', dash: [5, 5], width: 1.5, label: 'N·i·P(t) — макрострум' },
    ], [{ x: t0, label: 'сходинка V', color: '#8A6D1E' }, ...Array.from({ length: n }, (_, k) => ({ y: (k + 1) * i, color: '#B8C8BD', dash: [2, 4] }))]);
  }
  $('[data-new]', root).addEventListener('click', () => run(false));
  $('[data-avg]', root).addEventListener('click', () => run(true));
  run(false);
};

/* ---------- I–V криві та струми ---------- */
W.iv = (root) => {
  const TYPES = {
    ohm: { l: 'Потенціал-незалежний', P: () => 1, hold: -60, steps: linspace(-180, 60, 9), tau: () => 0.01 },
    kat1: { l: 'KAT1 — вхідний', P: (V) => 1 / (1 + Math.exp((V + 115) / 12)), hold: -40, steps: linspace(-200, -40, 9), tau: (V) => 40 + 160 / (1 + Math.exp(-(V + 120) / 20)) },
    gork: { l: 'GORK — вихідний', P: (V) => 1 / (1 + Math.exp(-(V + 10) / 13)), hold: -100, steps: linspace(-100, 60, 9), tau: (V) => 30 + 120 / (1 + Math.exp((V - 0) / 20)) },
  };
  let type = 'kat1';
  const ivp = new Plot($('[data-iv]', root), { xLabel: 'V, мВ', yLabel: 'I, відн. од.', x: [-220, 80], y: 'auto', yZero: true, xShort: 'V', aspect: 1.9 });
  const trp = new Plot($('[data-tr]', root), { xLabel: 't, мс', yLabel: 'I', x: [0, 900], y: 'auto', yZero: true, xShort: 't', aspect: 1.9 });
  const note = $('[data-note]', root);
  const api = sliders($('[data-sl]', root), [
    { id: 'ko', label: '[K⁺] ззовні', min: 0.1, max: 300, value: 10, log: true, format: fmtC },
    { id: 'g', label: 'Активатор ↔ інгібітор (g<sub>max</sub>)', min: 0.2, max: 2, step: 0.05, value: 1, format: (v) => '× ' + num(v, 2) },
  ], draw);
  segmented($('[data-type]', root), 'iv', Object.entries(TYPES).map(([k, v]) => ({ value: k, label: v.l })), type, (v) => { type = v; draw(); });
  function draw() {
    const T = TYPES[type], { ko, g } = api.values;
    const E = 58.2 * Math.log10(ko / 100);
    const I = (V) => g * T.P(V) * (V - E) / 100;
    ivp.set([
      { data: sample(I, -220, 80, 260), color: '#7B4FD0', label: 'I(V)' },
      { data: sample((V) => (V - E) / 100, -220, 80, 2), color: '#9AA8A0', dash: [5, 5], width: 1.3, label: 'відкриті всі канали' },
    ], [{ x: E, label: 'E_rev = E_K', color: '#C0392B' }]);
    // родина струмів при сходинках напруги: утримання → сходинка 100–600 мс → повернення (хвостові струми)
    const ser = T.steps.map((Vs, k) => {
      const P0 = T.P(T.hold), Pinf = T.P(Vs), tu = T.tau(Vs), tb = T.tau(T.hold);
      const P1 = Pinf + (P0 - Pinf) * Math.exp(-500 / tu);
      const f = (t) => {
        if (t < 100) return g * P0 * (T.hold - E) / 100;
        if (t < 600) return g * (Pinf + (P0 - Pinf) * Math.exp(-(t - 100) / tu)) * (Vs - E) / 100;
        return g * (P0 + (P1 - P0) * Math.exp(-(t - 600) / tb)) * (T.hold - E) / 100;
      };
      const hue = 260 - k * 22;
      return { data: sample(f, 0, 900, 450), color: `hsl(${hue} 55% 45%)`, width: 1.8, label: k === 0 || k === T.steps.length - 1 ? `${num(Vs, 0)} мВ` : '' };
    });
    trp.set(ser, [{ x: 100, color: '#C9D4CC', dash: [3, 4] }, { x: 600, label: 'хвіст', color: '#8A6D1E' }]);
    note.innerHTML = `E<sub>K</sub> = ${mv(E)} при [K⁺]<sub>in</sub> = 100 мМ. ` + (type === 'ohm' ? 'Пряма I–V: провідність стала, P<sub>open</sub> не залежить від напруги.'
      : type === 'kat1' ? 'Канали відкриваються лише при гіперполяризації нижче ≈ −100 мВ; струм вхідний (I &lt; 0). «Активатор» змінює нахил, але не E<sub>rev</sub>.'
        : 'Канали відкриваються при деполяризації; струм вихідний (I &gt; 0), коли V &gt; E<sub>K</sub>.');
  }
  draw();
};

/* ---------- Везикули: закислення та Ca²⁺/H⁺-обмін ---------- */
W.ves = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: 't, с', yLabel: 'Флуоресценція АО, %', x: [0, 600], y: [20, 105], yZero: false, xShort: 't', aspect: 1.7 });
  const btns = $('[data-btns]', root);
  const EV = [
    ['atp', 'Додати Mg-АТФ (запуск H⁺-АТФази)'], ['ca', 'Додати CaCl₂ (Ca²⁺/H⁺-антипортер)'], ['van', 'Додати ортованадат'], ['nh4', 'Додати NH₄Cl (руйнує ΔpH)'], ['reset', 'Почати спочатку'],
  ];
  btns.innerHTML = EV.map(([k, l]) => `<button class="btn btn--sm ${k === 'reset' ? 'btn--outline' : ''}" type="button" data-k="${k}">${l}</button>`).join('');
  let st, raf = 0, last = 0, running = false, visible = false;
  const LBL = { atp: '+АТФ', ca: '+Ca²⁺', van: '+ванадат', nh4: '+NH₄Cl' };
  function reset() { st = { t: 0, h: 0, atp: false, ca: false, van: false, nh4: false, pts: [[0, 100]], ev: [] }; $$('button', btns).forEach((b) => b.classList.remove('is-used')); plot.set([{ data: st.pts, color: '#C8890E', label: 'Флуоресценція' }], []); }
  function step(dt) {
    const pump = st.atp && !st.van ? (st.ca ? 0.55 : 1) : 0;
    const leak = 0.004 + (st.nh4 ? 0.25 : 0) + (st.ca ? 0.022 : 0);
    st.h += dt * (0.02 * pump * (1 - st.h) - leak * st.h);
    st.t += dt;
    st.pts.push([st.t, 100 - 72 * st.h + (Math.random() - 0.5) * 0.6]);
  }
  function frame(now) {
    if (!running || !visible) { raf = 0; return; }
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    for (let k = 0; k < 8; k++) if (st.t < 600) step(dt * 6);
    plot.set([{ data: st.pts, color: '#C8890E', label: 'Флуоресценція' }], st.ev);
    if (st.t >= 600) { running = false; raf = 0; return; }
    raf = requestAnimationFrame(frame);
  }
  const go = () => { if (!raf && visible && running) { last = 0; raf = requestAnimationFrame(frame); } };
  btns.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'reset') { running = false; reset(); return; }
    if (st[k] || st.t >= 600) return;
    st[k] = true; b.classList.add('is-used');
    st.ev.push({ x: st.t, label: LBL[k], color: '#6B7C70' });
    running = true; go();
  });
  whenVisible(root, (v) => { visible = v; go(); });
  reset();
};

/* =========================================================
   Лекції 3–5
   ========================================================= */
const logFmt = (v) => (Math.abs(v - Math.round(v)) < 1e-6 ? (v >= 3 ? sig(Math.pow(10, v) / 1000, 2) + ' мМ' : sig(Math.pow(10, v), 2) + ' мкМ') : '');

/* ---------- HATS / LATS ---------- */
W.hats = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: '[K⁺] ззовні (лог. шкала)', yLabel: 'Поглинання Rb⁺, відн.', x: [0, 4], y: 'auto', yZero: true, xFmt: logFmt, xShort: 'lg[K⁺]', aspect: 1.7 });
  const hak = (K) => 1.0 * K / (K + 15);
  const akt = (K) => 3.2 * K / (K + 900) / (1 + Math.exp(-(Math.log10(K) - 1.4) / 0.14));
  const G = {
    wt: ['Дикий тип', (K) => hak(K) + akt(K), 'HAK5 працює в мікромолярному діапазоні, AKT1 — від ~0,1 мМ.'],
    hak5: ['hak5', akt, 'Без HAK5 поглинання при 10–50 мкМ майже зникає, але відновлюється при високих концентраціях: HAK5 — високоафінний.'],
    akt1: ['akt1', hak, 'Без AKT1 поглинання падає при вищих концентраціях — AKT1 відповідає за низькоафінну складову.'],
    dbl: ['akt1 hak5', (K) => 0.03 * K / (K + 2000), 'Подвійний мутант майже не поглинає K⁺ — рослина виживає лише на високому калії.'],
  };
  const note = $('[data-note]', root);
  let g = 'wt';
  segmented($('[data-g]', root), 'hats', Object.entries(G).map(([k, v]) => ({ value: k, label: `<i>${v[0]}</i>` })), g, (v) => { g = v; draw(); });
  const COL = { wt: '#1E8449', hak5: '#7B4FD0', akt1: '#B5651D', dbl: '#7F8C8D' };
  function draw() {
    plot.set(Object.entries(G).map(([k, v]) => ({ data: sample((x) => v[1](Math.pow(10, x)), 0, 4, 220), color: COL[k], width: k === g ? 3.4 : 1.4, dash: k === g ? [] : [5, 5], label: v[0] })),
      [{ x: 2, label: '100 мкМ', color: '#B8C8BD' }]);
    note.innerHTML = G[g][2];
  }
  draw();
};

/* ---------- Субодиниця Shaker ---------- */
W.shaker = (root) => {
  const T = {
    vsd: '<b>S1–S3</b> — частина потенціал-чутливого домену, що оточує сенсор S4 і передає його рух на пору.',
    s4: '<b>S4 — сенсор потенціалу.</b> Регулярно розташовані позитивні аргініни й лізини: зміна поля мембрани зсуває S4 і відкриває чи закриває ворота. У вхідних каналах (AKT1, KAT1) ворота відкриваються гіперполяризацією.',
    pore: '<b>S5 і S6</b> утворюють пору; нижня частина S6 — «ворота» з боку цитозолю.',
    p: '<b>P-петля між S5 і S6</b> з мотивом <b>TVGYG</b> — селективний фільтр: карбонільні кисні чотирьох субодиниць координують дегідратований K⁺ (див. KcsA, лекція 1).',
    n: '<b>Короткий N-кінець</b> у цитозолі. В AKT1 тут <b>Ser26</b> — сайт фосфорилювання кіназою CIPK23.',
    clink: '<b>C-лінкер</b> передає конформаційний сигнал на ворота пори. В AKT1 тут <b>Ser338</b> — другий ключовий сайт CIPK23.',
    cnbd: '<b>CNBD</b> — домен гомології зв\'язування циклічних нуклеотидів. У рослинних Shaker-каналах він не активується цАМФ прямо (на відміну від CNGC), а бере участь у тетрамеризації й внутрішній регуляції.',
    ank: '<b>Анкіриновий домен</b> — тандемні повтори для білок-білкових взаємодій: тут сідають кінази CIPK і фосфатази PP2C. Є в 6 з 9 каналів (немає в KAT1, KAT2, AtKC1).',
    kha: '<b>KHA-домен</b> на самому C-кінці (гідрофобні й кислі залишки): кластеризація і взаємодія субодиниць.',
  };
  const txt = $('[data-txt]', root), parts = $$('.sh-part', root);
  const sel = (g) => { parts.forEach((p) => p.classList.toggle('is-sel', p.dataset.k === g.dataset.k)); txt.innerHTML = T[g.dataset.k]; };
  parts.forEach((g) => { g.addEventListener('click', () => sel(g)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(g); } }); });
  sel(parts.find((p) => p.dataset.k === 's4'));
};

/* ---------- Карта органів (Shaker) ---------- */
W.plantk = (root) => {
  const ls = $$('.pk-l', root);
  segmented($('[data-g]', root), 'pk', [{ value: 'all', label: 'Усі групи' }, ...['I', 'II', 'III', 'IV', 'V'].map((r, i) => ({ value: 'g' + (i + 1), label: 'Група ' + r }))], 'all',
    (v) => ls.forEach((l) => l.classList.toggle('is-dim', v !== 'all' && !l.classList.contains(v))));
};

/* ---------- TEVC: AKT1 + CBL1/CIPK23 ---------- */
W.akt1 = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: 'V, мВ', yLabel: 'I, мкА', x: [-180, 20], y: 'auto', yZero: true, xShort: 'V', aspect: 1.6 });
  const C = {
    alone: ['AKT1', 0.05, 'Сам AKT1 в ооциті неактивний — струму майже немає.'],
    cbl: ['+ CBL1 + CIPK23', 1, 'Коекспресія кальцієвого сенсора і кінази дає великий вхідний K⁺-струм при гіперполяризації.'],
    s26: ['S26A', 0.45, 'Без фосфорилювання Ser26 струм суттєво менший.'],
    s338: ['S338A', 0.08, 'Без Ser338 у C-лінкері активація майже зникає.'],
    dbl: ['S26A/S338A', 0.03, 'Подвійний мутант практично не активується комплексом CBL1–CIPK23.'],
  };
  let c = 'cbl'; const plp = $('[data-plp]', root), note = $('[data-note]', root);
  segmented($('[data-c]', root), 'akt1', Object.entries(C).map(([k, v]) => ({ value: k, label: v[0] })), c, (v) => { c = v; draw(); });
  plp.addEventListener('change', draw);
  const E = -58;
  const I = (g) => (V) => -g * 0.06 * (E - V) / (1 + Math.exp((V + 105) / 13));
  function draw() {
    const k = plp.checked ? 0.35 : 1;
    plot.set([
      { data: sample(I(C[c][1] * k), -180, 20, 200), color: '#7B4FD0', width: 3, label: C[c][0] + (plp.checked ? ' + PLP' : '') },
      c !== 'cbl' && { data: sample(I(1), -180, 20, 200), color: '#9AA8A0', dash: [5, 5], width: 1.4, label: '+ CBL1 + CIPK23 (еталон)' },
    ], [{ x: E, label: 'E_K', color: '#C0392B' }]);
    note.innerHTML = C[c][2] + (plp.checked ? ' <b>PLP</b> (активний вітамін B₆) додатково пригнічує струм — так діє NO через синтез PLP.' : '');
  }
  draw();
};

/* ---------- Протонно-рушійна сила тилакоїда ---------- */
function bars(host, rows) {
  host.innerHTML = rows.map(([l, v, col, txt]) => `<div class="it-bar"><span>${l}</span><i><b style="width:${clamp(v, 0, 100)}%;background:${col}"></b></i><em>${txt ?? Math.round(v) + ' %'}</em></div>`).join('');
}
W.pmf = (root) => {
  const V = {
    high: { wt: [30, 70, 80, 'Яскраве світло: TPK3 випускає K⁺ з люмена — ΔΨ розряджається, PMF переходить у ΔpH, вмикається захисне NPQ.'],
      tpk3: [58, 42, 45, 'Без TPK3 більше PMF «застрягає» в ΔΨ, ΔpH і NPQ нижчі — фотосинтетичний апарат гірше захищений.'],
      kea3: [30, 70, 82, 'На сталому світлі KEA3 майже не впливає.'] },
    shade: { wt: [18, 22, 14, 'Перехід у тінь: KEA3 обмінює H⁺ на K⁺, швидко скидає ΔpH — NPQ вимикається, ефективність зростає.'],
      tpk3: [24, 26, 18, 'У тіні різниця з диким типом невелика.'],
      kea3: [15, 58, 62, 'Без KEA3 ΔpH і NPQ довго лишаються високими: світло в тіні марно розсіюється теплом.'] },
  };
  let light = 'high', gen = 'wt';
  const note = $('[data-note]', root), host = $('[data-bars]', root), tpk = $('.th-tpk', root), kea = $('.th-kea', root);
  segmented($('[data-light]', root), 'pmf-l', [{ value: 'high', label: 'Яскраве світло' }, { value: 'shade', label: 'Перехід у тінь' }], light, (v) => { light = v; draw(); });
  segmented($('[data-gen]', root), 'pmf-g', [{ value: 'wt', label: 'Дикий тип' }, { value: 'tpk3', label: '<i>tpk3</i>' }, { value: 'kea3', label: '<i>kea3</i>' }], gen, (v) => { gen = v; draw(); });
  function draw() {
    const [psi, ph, npq, t] = V[light][gen];
    tpk.style.opacity = gen === 'tpk3' ? 0.15 : 1; kea.style.opacity = gen === 'kea3' ? 0.15 : 1;
    bars(host, [['ΔΨ (електрична)', psi, '#2471A3'], ['ΔpH (хімічна)', ph, '#D04545'], ['NPQ', npq, '#C8890E']]);
    note.innerHTML = t + ' <small>(схематичні відносні значення)</small>';
  }
  draw();
};

/* ---------- HKT: зсув потенціалу реверсії ---------- */
W.hkt = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: 'V, мВ', yLabel: 'I, відн.', x: [-180, 60], y: 'auto', yZero: true, xShort: 'V', aspect: 1.6 });
  let p = 'wt'; const note = $('[data-note]', root);
  segmented($('[data-p]', root), 'hkt', [{ value: 'wt', label: 'AtHKT1;1' }, { value: 'nd', label: 'AtHKT1;1-N211D' }], p, (v) => { p = v; draw(); });
  const api = sliders($('[data-sl]', root), [
    { id: 'na', label: '[Na⁺] ззовні', min: 0.3, max: 100, value: 10, log: true, format: fmtC },
    { id: 'k', label: '[K⁺] ззовні', min: 0.3, max: 100, value: 1, log: true, format: fmtC },
  ], draw);
  const NAI = 35, KI = 100;
  const erev = (pp, na, k) => (pp === 'wt' ? 58 * Math.log10(na / NAI) : 58 * Math.log10((na + 2 * k) / (NAI + 2 * KI)));
  function draw() {
    const { na, k } = api.values;
    const e1 = erev(p, na, k), o = p === 'wt' ? 'nd' : 'wt', e2 = erev(o, na, k);
    const g = (pp) => (pp === 'wt' ? 1 : 0.45);
    plot.set([
      { data: sample((V) => g(p) * (V - e1) / 60, -180, 60, 80), color: p === 'wt' ? '#E07A3E' : '#7B4FD0', width: 3, label: p === 'wt' ? 'AtHKT1;1' : 'N211D' },
      { data: sample((V) => g(o) * (V - e2) / 60, -180, 60, 80), color: '#9AA8A0', dash: [5, 5], width: 1.4, label: o === 'wt' ? 'AtHKT1;1' : 'N211D' },
    ], [{ x: e1, label: 'E_rev', color: '#C0392B' }]);
    note.innerHTML = `E<sub>rev</sub> = ${mv(e1)}. ` + (p === 'wt' ? 'Змінюйте [K⁺] — точка перетину не рухається: K⁺ не проходить. Змінюйте [Na⁺] — E<sub>rev</sub> зсувається за Нернстом.'
      : 'Тепер E<sub>rev</sub> реагує і на K⁺, а вхідний Na⁺-струм менший: заміна N→D у порі P<sub>B</sub> «повертає» калієву селективність.');
  }
  draw();
};

/* ---------- HKT1;1 у ксилемній паренхімі ---------- */
W.hktroot = (root) => {
  const wt = $('.hr-wt', root), up = $('.hr-up', root), leaves = $$('.hr-leaf', root), cap = $('.hr-cap', root), txt = $('[data-txt]', root);
  segmented($('[data-g]', root), 'hr', [{ value: 'wt', label: 'Дикий тип' }, { value: 'mut', label: 'Мутант <i>hkt1</i> (<i>sas2</i>)' }], 'wt', set);
  function set(v) {
    const m = v === 'mut';
    wt.style.display = m ? 'none' : '';
    up.setAttribute('stroke-width', m ? 9 : 2.5);
    leaves.forEach((l) => l.setAttribute('fill', m ? '#C9B037' : '#4E8B3A'));
    cap.textContent = m ? 'Багато Na⁺ у листки → хлороз' : 'Мало Na⁺ у листки';
    txt.innerHTML = m ? 'Без HKT1;1 натрій, що проник у корінь крізь неселективні канали, вільно піднімається з транспіраційним потоком і руйнує хлоропласти молодих листків.'
      : 'HKT1;1 у клітинах ксилемної паренхіми <b>забирає Na⁺ з ксилемного соку</b> назад у корінь — це фільтр, що не пускає натрій у листки.';
  }
  set('wt');
};

/* ---------- PA – SOS2 ---------- */
W.sos = (root) => {
  const G = {
    wt: ['Col-0', [], 1.0, 72, 'Сіль → PLD синтезує PA → SOS2 через Lys57 сідає на мембрану, фосфорилює SOS1 (Na⁺ назовні) і підтримує надходження K⁺.'],
    pld: ['pldα1;pldδ', ['.so-pa', '.so-link'], 3.3, 38, 'Немає PA — SOS2 не закріплюється на плазмалемі; ефлюкс Na⁺ падає, витік K⁺ зростає.'],
    sos2: ['sos2', ['.so-sos2', '.so-link', '.so-act1', '.so-act2'], 3.5, 34, 'Немає кінази — SOS1 не активується; фенотип як у <i>pldα1;pldδ</i>: шлях спільний.'],
    k57: ['SOS2<sup>K57G</sup>', ['.so-link'], 3.0, 40, 'Кіназа є, але без Lys57 не зв\'язує PA і лишається в цитозолі — солестійкість не відновлюється.'],
  };
  const host = $('[data-bars]', root), txt = $('[data-txt]', root);
  const sos2 = $$('.so-sos2, .so-sos3', root);
  segmented($('[data-g]', root), 'sos', Object.entries(G).map(([k, v]) => ({ value: k, label: `<i>${v[0]}</i>` })), 'wt', set);
  function set(v) {
    const g = G[v];
    $$('.so-n', root).forEach((el) => { el.style.opacity = ''; });
    g[1].forEach((sel) => $$(sel, root).forEach((el) => { el.style.opacity = 0.12; }));
    const off = v === 'pld' || v === 'k57';
    sos2.forEach((el) => { el.style.transform = off ? 'translateY(52px)' : ''; });
    $$('.so-act1, .so-act2', root).forEach((el) => { if (off) el.style.opacity = 0.15; });
    $('.so-sos1', root).style.opacity = v === 'wt' ? 1 : 0.4;
    bars(host, [['Na⁺/K⁺ у тканинах (NaCl), відн.', g[2] / 4 * 100, '#E07A3E', '×' + num(g[2], 1)], ['Ріст кореня на NaCl', g[3], '#1E8449']]);
    txt.innerHTML = g[4] + ' <small>(схематичні значення за тенденціями статті)</small>';
  }
  set('wt');
};

/* =========================================================
   Лекції 6–7
   ========================================================= */
const pulse = (t, t0, rise, dec, amp) => (t <= t0 ? 0 : amp * (1 - Math.exp(-(t - t0) / rise)) * Math.exp(-(t - t0) / dec));

/* ---------- Кальцієві сигнатури ---------- */
W.casig = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: 't, с', yLabel: '[Ca²⁺]цит, нМ', x: [0, 300], y: 'auto', yZero: true, xShort: 't', aspect: 1.7 });
  const S = {
    touch: ['Дотик', '#C0392B', (t, k) => pulse(t, 5, 0.6, 4 * k, 900), 'Дуже швидкий короткий спалах — за секунди.'],
    cold: ['Холод', '#2471A3', (t, k) => pulse(t, 10, 2, 15 * k, 1300), 'Різкий високий пік, швидкий спад.'],
    heat: ['Тепло', '#E67E22', (t, k) => pulse(t, 10, 15, 60 * k, 520), 'Повільніший, нижчий і тривалий підйом.'],
    h2o2: ['H₂O₂', '#8E44AD', (t, k) => pulse(t, 15, 4, 20 * k, 650) + pulse(t, 70, 12, 80 * k, 320), 'Двофазна відповідь: швидкий пік і другий, повільніший.'],
    salt: ['NaCl', '#E07A3E', (t, k) => pulse(t, 8, 3, 25 * k, 650) + (t > 8 ? 160 * (1 - Math.exp(-(t - 8) / 30)) : 0), 'Пік і тривале плато.'],
    aba: ['АБК', '#1E8449', (t, k) => [20, 70, 120, 170, 220, 270].reduce((a, t0) => a + pulse(t, t0, 3, 8 * k, 480), 0), 'Осциляції — частоту «зчитують» замикаючі клітини продихів.'],
    aux: ['Ауксин', '#B7950B', (t, k) => pulse(t, 5, 3, 40 * k, 380), 'Швидкий підйом через CNGC14 (див. 6.3).'],
  };
  let st = 'cold'; const off = $('[data-off]', root), note = $('[data-note]', root);
  segmented($('[data-s]', root), 'casig', [...Object.entries(S).map(([k, v]) => ({ value: k, label: v[0] })), { value: 'all', label: 'Усі разом' }], st, (v) => { st = v; draw(); });
  off.addEventListener('change', draw);
  function draw() {
    const k = off.checked ? 4 : 1;
    const ks = st === 'all' ? Object.keys(S) : [st];
    plot.set(ks.map((key) => ({ data: sample((t) => 100 + S[key][2](t, k), 0, 300, 600), color: S[key][1], width: ks.length > 1 ? 1.8 : 3, label: S[key][0] })), [{ y: 100, color: '#B8C8BD', label: 'спокій ~100 нМ' }]);
    note.innerHTML = (st === 'all' ? 'Той самий іон — різні «підписи»: амплітуда, тривалість, частота.' : S[st][3]) + (off.checked ? ' <b>Без відкачування</b> піки розпливаються, осциляції зливаються — сигнатура втрачає чіткість.' : '');
  }
  draw();
};

/* ---------- FRET-сенсор YC3.6 ---------- */
W.fret = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: 'λ, нм', yLabel: 'Інтенсивність емісії', x: [450, 600], y: [0, 1.15], yZero: true, xShort: 'λ', aspect: 1.5 });
  const kp = $('[data-kpis]', root), cart = $('[data-cartoon]', root);
  const fmtCa = (v) => (v >= 1000 ? num(v / 1000, 1) + ' мкМ' : Math.round(v) + ' нМ');
  const api = sliders($('[data-sl]', root), [{ id: 'ca', label: '[Ca²⁺] у цитозолі', min: 10, max: 10000, value: 100, log: true, format: fmtCa }], draw);
  const gs = (x, m, w) => Math.exp(-((x - m) ** 2) / (2 * w * w));
  function draw() {
    const c = api.values.ca, th = c ** 1.7 / (250 ** 1.7 + c ** 1.7);
    const cfp = (l) => (1 - 0.68 * th) * (gs(l, 477, 13) + 0.45 * gs(l, 505, 14));
    const yfp = (l) => (0.12 + 0.78 * th) * (gs(l, 528, 12) + 0.35 * gs(l, 560, 16));
    plot.set([
      { data: sample((l) => cfp(l) + yfp(l), 450, 600, 200), color: '#13241A', width: 2.6, label: 'Сумарний спектр' },
      { data: sample(cfp, 450, 600, 200), color: '#2E86C1', dash: [5, 4], width: 1.6, label: 'CFP (донор)' },
      { data: sample(yfp, 450, 600, 200), color: '#D4AC0D', dash: [5, 4], width: 1.6, label: 'YFP (акцептор)' },
    ], [{ x: 480, color: '#2E86C1' }, { x: 535, color: '#D4AC0D' }]);
    const r = (cfp(535) + yfp(535)) / (cfp(480) + yfp(480));
    kp.innerHTML = kpi('Зайнятість CaM', Math.round(th * 100) + ' %') + kpi('Відношення YFP/CFP', num(r, 2));
    const d = 150 - 92 * th;
    cart.innerHTML = `<svg viewBox="0 0 280 110" class="it-svg" role="img" aria-label="Конформація сенсора">
      <path d="M${140 - d / 2 + 18} 55 C ${140 - d / 4} ${20 + 30 * th}, ${140 + d / 4} ${20 + 30 * th}, ${140 + d / 2 - 18} 55" stroke="#7F8C8D" stroke-width="4" fill="none"/>
      <circle cx="140" cy="${32 + 22 * th}" r="${10 + 4 * th}" fill="#58D68D"/><text x="140" y="${36 + 22 * th}" text-anchor="middle" class="it-t it-t--s" style="font-size:9px">CaM</text>
      <rect x="${140 - d / 2 - 20}" y="34" width="40" height="44" rx="12" fill="#5DADE2"/><text x="${140 - d / 2}" y="60" text-anchor="middle" class="it-t it-t--w" style="font-size:11px">CFP</text>
      <rect x="${140 + d / 2 - 20}" y="34" width="40" height="44" rx="12" fill="#F4D03F"/><text x="${140 + d / 2}" y="60" text-anchor="middle" class="it-t" style="font-size:11px;font-weight:800">YFP</text>
      ${th > 0.25 ? `<path d="M${140 - d / 2 + 22} 90 Q140 ${104} ${140 + d / 2 - 22} 90" stroke="#E67E22" stroke-width="2.5" stroke-dasharray="4 3" fill="none"/><text x="140" y="108" text-anchor="middle" class="it-t it-t--s" style="font-size:10px;fill:#B9770E">FRET</text>` : ''}</svg>`;
  }
  draw();
};

/* ---------- Системна хвиля Ca²⁺ / АФК ---------- */
W.wave = (root) => {
  const cv = $('[data-cv]', root), ctx = cv.getContext('2d'), note = $('[data-note]', root);
  const SC = {
    salt: { l: 'NaCl → кінчик кореня', a: 'кінчик кореня (NaCl)', b: 'пагін, листки', g: { wt: ['Дикий тип', 0.11, 1], tpc1: ['tpc1', 0.4, 0.86], rbohd: ['rbohd', 0.4, 0.88], dpi: ['+ DPI', 0.45, 0.85] } },
    wound: { l: 'Поранення листка', a: 'поранений листок 1', b: 'листок 6', g: { wt: ['Дикий тип', 0.13, 1], glr: ['glr3.3;glr3.6', 0.6, 0.45] } },
  };
  let sc = 'salt', g = 'wt', t = -1, raf = 0, vis = false, last = 0;
  const N = 34;
  const gseg = $('[data-g]', root);
  const mkG = () => { gseg.innerHTML = ''; segmented(gseg, 'wave-g', Object.entries(SC[sc].g).map(([k, v]) => ({ value: k, label: `<i>${v[0]}</i>` })), g, (v) => { g = v; t = -1; draw(); }); };
  segmented($('[data-sc]', root), 'wave-s', Object.entries(SC).map(([k, v]) => ({ value: k, label: v.l })), sc, (v) => { sc = v; g = 'wt'; t = -1; mkG(); draw(); });
  mkG();
  const lvl = (i) => {
    if (t < 0) return 0;
    const [, dt, att] = SC[sc].g[g];
    const t0 = i * dt * 1.6, A = Math.pow(att, i);
    return A < 0.08 ? 0 : A * pulse(t, t0, 0.35, 3.2, 1.6);
  };
  const col = (x) => { x = clamp(x, 0, 1); const c0 = [232, 245, 233], c1 = [244, 208, 63], c2 = [231, 76, 60]; const [a, b, u] = x < 0.5 ? [c0, c1, x * 2] : [c1, c2, (x - 0.5) * 2]; return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',')})`; };
  function draw() {
    const w = cv.clientWidth, h = 130, dpr = Math.min(devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const cw = (w - 20) / N;
    let reached = 0;
    for (let i = 0; i < N; i++) {
      const v = lvl(i); if (v > 0.3) reached = i;
      ctx.fillStyle = col(v); ctx.strokeStyle = '#9DB8A2'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(10 + i * cw + 1, 34, cw - 2, 52, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(19,36,26,.35)'; ctx.beginPath(); ctx.arc(10 + i * cw + cw / 2, 60, Math.min(5, cw / 5), 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#46584C'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(SC[sc].a, 10, 22); ctx.textAlign = 'right'; ctx.fillText(SC[sc].b + ' →', w - 10, 22);
    ctx.textAlign = 'left'; ctx.fillStyle = '#6B7C70'; ctx.fillText(t < 0 ? 'Натисніть «Запустити стимул»' : `t = ${num(t * 20, 0)} с`, 10, 112);
    const [, , att] = SC[sc].g[g];
    note.innerHTML = t < 0 ? '' : att > 0.95 ? `Регенеративна естафета: кожна клітина підсилює сигнал і передає далі — хвиля доходить до кінця за ~${Math.round((N - 1) * SC[sc].g[g][1] * 1.6 * 20)} с.`
      : sc === 'wound' ? 'Без GLR3.3 і GLR3.6 глутамат не запускає системну хвилю — сигнал гасне біля рани.' : 'Без TPC1 / RBOHD (або з інгібітором DPI) немає підсилення — хвиля повільніша, згасає і не доходить до пагона.';
  }
  function frame(now) {
    if (!vis || t < 0) { raf = 0; return; }
    t += Math.min(0.05, (now - (last || now)) / 1000) * 1.2; last = now;
    draw();
    if (t > 12) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
  }
  const go = () => { if (!raf && vis && t >= 0 && t <= 12) { last = 0; raf = requestAnimationFrame(frame); } };
  $('[data-go]', root).addEventListener('click', () => { t = 0; go(); });
  whenVisible(root, (v) => { vis = v; go(); });
  new ResizeObserver(() => draw()).observe(cv);
  draw();
};

/* ---------- Проростання пилку ---------- */
W.pollen = (root) => {
  const STEPS = [
    ['Циркуляція', 'Везикули з форміном AtFH5 і каналом CNGC18 2–3 рази обходять периферію зерна вздовж актинових філаментів.'],
    ['Зупинка', 'Везикули зупиняються й фокусуються в майбутній точці проростання.'],
    ['Спалахи Ca²⁺', 'У цій точці CNGC18 впускає зовнішній Ca²⁺ — 2–3 періодичні спалахи.'],
    ['Екзоцитоз', 'Кожен спалах запускає злиття везикул: FH5 і CNGC18 вбудовуються в плазмалему сходинками, секретуються пектини.'],
    ['Пилкова трубка', 'Стінка пластично випинається (bulge) — і проростає пилкова трубка.'],
  ];
  const svg = $('.pg-svg', root), vs = $$('.pg-v', svg), txt = $('[data-txt]', root);
  let step = 0, ang = 0, raf = 0, vis = false;
  const pos = (i) => {
    if (step === 0) { const a = ang + i * 0.9; return [200 + 80 * Math.cos(a), 160 + 66 * Math.sin(a)]; }
    const a = (i - 3) * 0.16;
    return step >= 3 ? [292 + 6 * Math.cos(a * 6), 160 + 46 * Math.sin(a)] : [270 + 10 * Math.cos(a * 6), 160 + 56 * Math.sin(a)];
  };
  const place = () => vs.forEach((v, i) => { const [x, y] = pos(i); v.setAttribute('cx', x.toFixed(1)); v.setAttribute('cy', y.toFixed(1)); v.style.opacity = step === 4 && i % 2 ? 0 : 1; });
  function set(i) {
    step = +i;
    $('.pg-ca', svg).setAttribute('opacity', step === 2 ? 1 : step === 3 ? 0.5 : 0);
    $('.pg-ca', svg).classList.toggle('is-pulse', step === 2);
    $('.pg-pec', svg).setAttribute('opacity', step >= 3 ? 1 : 0);
    $('.pg-bulge', svg).setAttribute('opacity', step >= 3 ? 1 : 0);
    $('.pg-tube', svg).setAttribute('opacity', step === 4 ? 1 : 0);
    txt.innerHTML = `<b>${step + 1}. ${STEPS[step][0]}.</b> ${STEPS[step][1]}`;
    place(); loop();
  }
  segmented($('[data-btns]', root), 'pg', STEPS.map((s, i) => ({ value: i, label: `${i + 1}. ${s[0]}` })), 0, set);
  function loop() { if (!raf && vis && step === 0 && !reduceMotion) raf = requestAnimationFrame(tick); }
  function tick() { if (!vis || step !== 0) { raf = 0; return; } ang += 0.012; place(); raf = requestAnimationFrame(tick); }
  whenVisible(root, (v) => { vis = v; loop(); });
  set(0);
  // осциляції Ca²⁺ у зерні
  const plot = new Plot($('[data-plot]', root), { xLabel: 't, с', yLabel: 'GCaMP6, ΔF/F', x: [0, 300], y: [-0.1, 2], yZero: true, xShort: 't', aspect: 1.45 });
  const G = {
    wt: ['Дикий тип', '#1E8449', (t) => [90, 140, 190].reduce((a, t0) => a + pulse(t, t0, 2, 7, 0.75), 0) + (t > 230 ? 1.5 * (1 - Math.exp(-(t - 230) / 12)) : 0), '2–3 локальні спалахи, потім потужний підйом — випинання і прорив трубки.'],
    cngc18: ['cngc18', '#C0392B', (t) => [100, 175, 255].reduce((a, t0) => a + pulse(t, t0, 2, 7, 0.22), 0), 'Амплітуда спалахів різко падає, ритм збитий — проростання немає.'],
    gd: ['+ GdCl₃ / EGTA', '#7F8C8D', (t) => [110, 205].reduce((a, t0) => a + pulse(t, t0, 2, 7, 0.28), 0), 'Без зовнішнього Ca²⁺ піки слабкі й рідкі; базовий рівень не змінюється.'],
    a23: ['+ A23187', '#8E44AD', (t) => [80, 125, 170].reduce((a, t0) => a + pulse(t, t0, 2, 7, 1.05), 0) + (t > 210 ? 1.6 * (1 - Math.exp(-(t - 210) / 12)) : 0), 'Іонофор підсилює піки, паттерн проростання зберігається.'],
    latb: ['+ LatB / fh5', '#B7950B', (t) => 0.05 * Math.sin(t / 7) * Math.sin(t / 3), 'Без актину везикули розсіюються — фокусованих спалахів немає.'],
  };
  let g = 'wt'; const note = $('[data-note]', root);
  segmented($('[data-g]', root), 'pg-g', Object.entries(G).map(([k, v]) => ({ value: k, label: `<i>${v[0]}</i>` })), g, (v) => { g = v; draw(); });
  function draw() { plot.set([{ data: sample(G[g][2], 0, 300, 600), color: G[g][1], width: 2.6, label: G[g][0] }, g !== 'wt' && { data: sample(G.wt[2], 0, 300, 400), color: '#9AA8A0', dash: [5, 5], width: 1.3, label: 'дикий тип' }]); note.innerHTML = G[g][3] + ' <small>(схематично)</small>'; }
  draw();
};

/* =========================================================
   Лекції 8–9
   ========================================================= */
/* ---------- R- і S-струми ---------- */
W.rs = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: 't, с', yLabel: 'Аніонний струм (назовні), відн.', x: [0, 30], y: 'auto', yZero: true, xShort: 't', aspect: 1.7 });
  const R = (t) => (t < 2 ? 0 : (1 - Math.exp(-(t - 2) / 0.05)) * Math.exp(-(t - 2) / 2.5));
  const Sx = (t) => (t < 2 ? 0 : 0.7 * (1 - Math.exp(-(t - 2) / 6)));
  const G = { wt: ['Дикий тип', 1, 1, 'Сума двох компонент: швидкий R-пік і повільний стабільний S-струм.'], slac1: ['slac1', 1, 0, 'Без SLAC1 зникає S-струм — продихи не закриваються на CO₂, АБК, озон.'], almt12: ['almt12', 0, 1, 'Без ALMT12 (QUAC1) немає швидкого R-піка.'] };
  let g = 'wt'; const note = $('[data-note]', root);
  segmented($('[data-g]', root), 'rs', Object.entries(G).map(([k, v]) => ({ value: k, label: `<i>${v[0]}</i>` })), g, (v) => { g = v; draw(); });
  function draw() {
    const [, r, sx, t] = G[g];
    plot.set([
      { data: sample((x) => r * R(x) + sx * Sx(x), 0, 30, 600), color: '#13241A', width: 2.8, label: 'Сумарний струм' },
      { data: sample((x) => r * R(x), 0, 30, 600), color: '#E67E22', dash: [5, 4], width: 1.6, label: 'R-тип (ALMT12)' },
      { data: sample((x) => sx * Sx(x), 0, 30, 300), color: '#C0392B', dash: [5, 4], width: 1.6, label: 'S-тип (SLAC1)' },
    ], [{ x: 2, label: 'деполяризація', color: '#8A6D1E' }]);
    note.innerHTML = t;
  }
  draw();
};

/* ---------- Мережа закривання продиху ---------- */
W.stoma = (root) => {
  const IN = { aba: 'АБК', ca: 'Ca²⁺', co2: 'Високий CO₂' }, MUT = { slac1: 'slac1', ost1: 'ost1', almt12: 'almt12' };
  const on = { aba: false, ca: false, co2: false }, mut = { slac1: false, ost1: false, almt12: false };
  const mk = (host, obj, lab, italic) => { host.innerHTML = Object.entries(lab).map(([k, v]) => `<button class="btn btn--sm btn--outline it-tog" type="button" aria-pressed="false" data-k="${k}">${italic ? `<i>${v}</i>` : v}</button>`).join('');
    host.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; obj[b.dataset.k] = !obj[b.dataset.k]; b.setAttribute('aria-pressed', String(obj[b.dataset.k])); draw(); }); };
  mk($('[data-in]', root), on, IN, false); mk($('[data-mut]', root), mut, MUT, true);
  const ap = $('[data-ap]', root), note = $('[data-note]', root);
  function draw() {
    const a = {};
    a.aba = on.aba; a.pyr = on.aba; a.abi1 = !on.aba; a.ca = on.ca; a.cpk = on.ca; a.cipk = on.ca;
    a.co2 = on.co2; a.bca = on.co2; a.rhc1 = on.co2; a.ht1 = !on.co2;
    a.ost1 = !mut.ost1 && (on.aba || on.co2);
    a.slac1 = !mut.slac1 && (a.ost1 || a.cpk || a.cipk);
    a.almt12 = !mut.almt12 && a.ost1; a.clca = a.ost1;
    const cl = (a.slac1 ? 0.62 : 0) + (a.almt12 ? 0.24 : 0) + (a.clca ? 0.14 : 0);
    a.dep = cl > 0; a.gork = a.dep; a.close = a.dep;
    $$('.sn-n', root).forEach((n) => n.classList.toggle('is-on', !!a[n.dataset.n]));
    $$('.sn-e', root).forEach((e) => { const [x, y] = e.dataset.e.split('-'); e.classList.toggle('is-on', !!a[x] && (a[y] || x === 'abi1' || x === 'ht1' || x === 'pyr' || x === 'rhc1')); });
    const open = 1 - cl;
    ap.innerHTML = `<svg viewBox="0 0 220 120" class="it-svg" role="img" aria-label="Продих: відкритість ${Math.round(open * 100)} %"><rect width="220" height="120" rx="14" fill="#EAF4E4"/>
      <path d="M110 18 C ${60 - 14 * open} 18, ${60 - 14 * open} 102, 110 102 C ${92 - 22 * open} 84, ${92 - 22 * open} 36, 110 18z" fill="#7DBB5A" stroke="#4E8B3A" stroke-width="3"/>
      <path d="M110 18 C ${160 + 14 * open} 18, ${160 + 14 * open} 102, 110 102 C ${128 + 22 * open} 84, ${128 + 22 * open} 36, 110 18z" fill="#7DBB5A" stroke="#4E8B3A" stroke-width="3"/>
      <text x="110" y="116" text-anchor="middle" class="it-t it-t--s">відкритість ${Math.round(open * 100)} %</text></svg>`;
    note.innerHTML = !on.aba && !on.ca && !on.co2 ? 'Без стимулів ABI1 і HT1 тримають OST1 вимкненою — продих відкритий.'
      : cl === 0 ? 'Сигнал є, але аніонні канали не відкриваються — продих лишається відкритим (як у мутанта).'
        : mut.slac1 ? 'Без SLAC1 закривання лише часткове — R-канал і AtClC-a не компенсують S-струм.' : 'Аніони виходять → деполяризація → GORK випускає K⁺ → вода виходить — продих закривається.';
  }
  draw();
};

/* ---------- AtClC-a: АТФ/АМФ ---------- */
W.clca = (root) => {
  const api = sliders($('[data-sl]', root), [{ id: 'atp', label: 'АТФ', min: 0, max: 5, step: 0.1, value: 3, unit: 'мМ' }, { id: 'amp', label: 'АМФ', min: 0, max: 5, step: 0.1, value: 0.2, unit: 'мМ' }], draw);
  const host = $('[data-bars]', root), note = $('[data-note]', root);
  function draw() {
    const { atp, amp } = api.values;
    const occ = (atp / 0.5) / (1 + atp / 0.5 + amp / 0.3); // частка CBS-доменів з АТФ
    const act = 1 - 0.6 * occ;
    bars(host, [['Активність AtClC-a', act * 100, '#1F5FA8'], ['CBS-домени з АТФ', occ * 100, '#C0392B'], ['Запасання NO₃⁻ у вакуолі', act * 100, '#16A085']]);
    note.innerHTML = act < 0.6 ? 'Багато АТФ (світло, ситий метаболізм): обмін гальмується, нітрат лишається в цитозолі для асиміляції.' : 'Зростання АМФ (дефіцит енергії) знімає гальмування — нітрат іде у вакуолярний запас.';
  }
  draw();
};

/* ---------- Модель гідратації пилку ---------- */
function hydrate(model, geno, cout) {
  const Lp = 0.0042, Km = model === 'base' ? 40 : 10, so = 0.35, eps0 = model === 'base' ? 0 : 0.1, nonlin = model !== 'base';
  const kf = { wt: 1, msl8: 0, oe: 3 }[geno] * 2.2;
  let S = 3, r = 1, h = 1, lost = 0, prev = 0, opened = null, lys = null;
  const V = [], Sg = [], dt = 0.01;
  for (let i = 0, t = 0; t <= 60; i++, t = i * dt) {
    const e = r - 1, sig = Km * Math.max(0, e - eps0);
    let Pw = 2 * e + (nonlin ? 0.35 * (Math.exp(Math.max(0, e - 0.12) / 0.06) - 1) : 0);
    if (model === 'F') Pw *= 1 + 12 * lost;
    const cin = S / r ** 3; let flux = 0;
    if (sig > so && kf > 0) {
      if (opened === null) opened = t;
      const g = model === 'D' ? Math.exp(-(t - opened) / 40) : model === 'E' ? h : 1;
      flux = kf * (sig - so) * g * S / r ** 3;
    }
    if (model === 'E' && sig > so && (sig - prev) / dt < 1e-3) h = Math.max(0, h - dt * 2.5);
    prev = sig; S -= flux * dt; lost += flux * dt;
    r += dt * Lp * (cin - cout - Pw);
    if (sig > 1 && lys === null) lys = t;
    if (i % 20 === 0) { V.push([t, r ** 3]); Sg.push([t, Math.min(sig, 2.6)]); }
  }
  return { V, Sg, lys };
}
W.hydr = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: 't, с', yLabel: 'V/V₀  ·  σ/σ_розриву', x: [0, 60], y: [0, 2.6], yZero: true, xShort: 't', aspect: 1.5 });
  const M = { base: 'Модель 1 (базова)', mod: '+ складки ε₀ + стінка p_c', D: 'D: інактивація в часі', E: 'E: закриття при спаді натягу', F: 'F: зміцнення стінки' };
  let m = 'E', g = 'wt'; const note = $('[data-note]', root);
  segmented($('[data-m]', root), 'hy-m', Object.entries(M).map(([k, v]) => ({ value: k, label: v })), m, (v) => { m = v; draw(); });
  segmented($('[data-g]', root), 'hy-g', [{ value: 'wt', label: 'Дикий тип' }, { value: 'msl8', label: '<i>msl8</i>' }, { value: 'oe', label: 'MSL8-YFP' }], g, (v) => { g = v; draw(); });
  const api = sliders($('[data-sl]', root), [{ id: 'c', label: 'Осмолярність середовища (PEG)', min: 0, max: 1.2, step: 0.05, value: 0, format: (v) => (v === 0 ? 'вода' : num(v, 2)) }], draw);
  const TXT = {
    base: 'Натяг мембрани миттєво перевищує поріг розриву, у дикого типу — «горб» і стискання, мутант не схожий на експеримент.',
    mod: 'Складки мембрани знижують натяг нижче порогу; мутант <i>msl8</i> росте монотонно, але в дикого типу ще лишається «горб».',
    D: 'Часова інактивація все ще дає «горб» і неправильний порядок кривих з PEG та надекспресією.',
    E: 'Канал закривається, щойно натяг починає спадати: плато без «горба», надекспресор нижче дикого типу — відповідає всім тестам.',
    F: 'Потік іонів зміцнює стінку і зупиняє розширення: теж узгоджується з даними — прямих доказів зміцнення немає.',
  };
  function draw() {
    const res = hydrate(m, g, api.values.c);
    plot.set([
      { data: res.V, color: '#1F7A8C', width: 3, label: 'V/V₀' },
      { data: res.Sg, color: '#C0392B', dash: [6, 4], width: 1.8, label: 'σ/σ розриву' },
      g !== 'wt' && { data: hydrate(m, 'wt', api.values.c).V, color: '#9AA8A0', dash: [4, 4], width: 1.4, label: 'дикий тип' },
    ], [{ y: 1, label: 'поріг розриву мембрани', color: '#C0392B' }, { x: 28, label: '28 с', color: '#B8C8BD' }]);
    note.innerHTML = TXT[m] + (res.lys !== null ? ` <b>Натяг перейшов поріг розриву на ${num(res.lys, 1)} с.</b>` : '');
  }
  draw();
};

/* ---------- NRT1.1 ---------- */
W.nrt = (root) => {
  const plot = new Plot($('[data-plot]', root), { xLabel: '[NO₃⁻] ззовні (лог. шкала)', yLabel: 'Поглинання NO₃⁻, відн.', x: [1, 5], y: 'auto', yZero: true, xFmt: logFmt, xShort: 'lg[NO₃⁻]', aspect: 1.6 });
  const api = sliders($('[data-sl]', root), [{ id: 'n', label: '[NO₃⁻] у ґрунті', min: 10, max: 50000, value: 200, log: true, format: (v) => (v >= 1000 ? num(v / 1000, 1) + ' мМ' : Math.round(v) + ' мкМ') }], draw);
  const G = { wt: 'Дикий тип', t101a: 'T101A', t101d: 'T101D', chl15: 'chl1-5', chl19: 'chl1-9' };
  let g = 'wt';
  segmented($('[data-g]', root), 'nrt', Object.entries(G).map(([k, v]) => ({ value: k, label: `<i>${v}</i>` })), g, (v) => { g = v; draw(); });
  const kp = $('[data-kpis]', root), cart = $('[data-cartoon]', root), note = $('[data-note]', root);
  const phos = (N) => 1 / (1 + (N / 1000) ** 2.5);
  const P = (gg, N) => (gg === 't101a' ? 0 : gg === 't101d' ? 1 : phos(N));
  const up = (gg, N) => { if (gg === 'chl15' || gg === 'chl19') return 0; const p = P(gg, N); return p * N / (N + 50) + (1 - p) * 4 * N / (N + 4000); };
  function draw() {
    const N = api.values.n, p = P(g, N);
    plot.set([
      { data: sample((x) => up(g, 10 ** x), 1, 5, 240), color: '#1F5FA8', width: 3, label: G[g] },
      g !== 'wt' && { data: sample((x) => up('wt', 10 ** x), 1, 5, 240), color: '#9AA8A0', dash: [5, 5], width: 1.4, label: 'дикий тип' },
    ], [{ x: Math.log10(N), label: 'зараз', color: '#C0392B' }]);
    const transport = g !== 'chl15' && g !== 'chl19';
    const signal = g === 'chl15' ? 0 : g === 't101d' ? 0.35 : g === 't101a' ? 1.6 : 1;
    const auxOut = g === 'chl15' ? 0 : (g === 'chl19' ? p : p) * (1 - Math.min(1, N / 3000));
    const lr = clamp(1 - auxOut, 0, 1);
    kp.innerHTML = kpi('Стан', g === 'chl15' ? 'білка немає' : p > 0.5 ? 'мономер · P-Thr101' : 'димер') + kpi('Поглинання', transport ? num(up(g, N), 2) : '0') + kpi('Індукція NRT2.1', signal ? '×' + num(signal, 1) : 'немає') + kpi('Ріст бічних коренів', Math.round(lr * 100) + ' %');
    const mono = p > 0.5;
    cart.innerHTML = g === 'chl15' ? '' : `<svg viewBox="0 0 260 96" class="it-svg" role="img" aria-label="Стан NRT1.1"><rect y="30" width="260" height="36" fill="#F6E7BE"/>
      ${mono ? `<rect x="60" y="22" width="40" height="52" rx="14" fill="#5DADE2"/><rect x="160" y="22" width="40" height="52" rx="14" fill="#5DADE2"/><circle cx="100" cy="74" r="9" fill="#C0392B"/><text x="100" y="78" text-anchor="middle" class="it-t it-t--w" style="font-size:9px">P</text><circle cx="200" cy="74" r="9" fill="#C0392B"/><text x="200" y="78" text-anchor="middle" class="it-t it-t--w" style="font-size:9px">P</text>`
        : `<rect x="96" y="22" width="34" height="52" rx="12" fill="#1F5FA8"/><rect x="130" y="22" width="34" height="52" rx="12" fill="#1F5FA8"/>`}
      <text x="130" y="16" text-anchor="middle" class="it-t it-t--s">${mono ? 'високоафінний (Kₘ ≈ 50 мкМ)' : 'низькоафінний (Kₘ ≈ 4 мМ)'}</text>
      ${auxOut > 0.1 ? `<path d="M30 80V8" stroke="#B7950B" stroke-width="${2 + 5 * auxOut}" marker-end="url(#bl-arr)"/><text x="36" y="92" class="it-t it-t--s" style="fill:#B7950B">ауксин назовні</text>` : ''}</svg>`;
    note.innerHTML = g === 'chl19' ? '<i>chl1-9</i> (P492L): транспорту немає, а сигнал на <i>NRT2.1</i> зберігається — NRT1.1 працює як рецептор.'
      : g === 'chl15' ? '<i>chl1-5</i>: білка немає — ні транспорту, ні первинної сигнальної відповіді.'
        : p > 0.5 ? 'Мало нітрату: CIPK23 фосфорилює Thr101 — високоафінні мономери; NRT1.1 відкачує ауксин із зачатків бічних коренів, і вони не ростуть у бідну зону.'
          : 'Багато нітрату: димер, низька афінність і висока ємність; нітрат блокує транспорт ауксину — ауксин накопичується, бічні корені ростуть.';
  }
  draw();
};

/* ---------- Петля CEP ---------- */
W.cep = (root) => {
  const T = ['<b>1.</b> Клітини кореня в «голодній» зоні синтезують пептиди <b>CEP1</b> (15 а.к.) і завантажують у ксилему.', '<b>2.</b> CEP1 піднімаються з транспіраційним потоком у пагін.', '<b>3.</b> У провідних пучках листка їх розпізнає рецепторна кіназа <b>CEPR1</b>.',
    '<b>4.</b> Флоема листка синтезує поліпептиди-глутаредоксини <b>CEPD1/2</b>, які спускаються у <b>всі</b> корені.', '<b>5.</b> У коренях CEPD індукують <i>NRT2.1</i> і фосфатазу <b>CEPH</b>, що знімає інгібуюче фосфорилювання <b>Ser501</b> — NRT2.1 активний там, де нітрат є.'];
  const st = $$('.cp-st', root), txt = $('[data-txt]', root);
  segmented($('[data-btns]', root), 'cep', T.map((_, i) => ({ value: i, label: `Крок ${i + 1}` })), 0, (v) => sel(+v));
  function sel(i) { st.forEach((g) => g.style.opacity = +g.dataset.k <= i + 1 ? 1 : 0.12); txt.innerHTML = T[i]; }
  sel(0);
};

/* ---------- Регуляція PHT1 ---------- */
W.pht = (root) => {
  const LV = [
    ['Хроматин', [['ARP6 / IPK1 → H2A.Z', (s) => s.hi, 'gate'], ['H2A.Z знято, промотори відкриті', (s) => s.lo, 'go']]],
    ['Транскрипція', [['PHR1 (сумоїлювання SIZ1)', (s) => s.lo, 'go'], ['SPX1 ⊣ PHR1', (s) => s.hi, 'gate'], ['WRKY42/45', (s) => s.lo, 'go'], ['WRKY6 ⊣ PHT1;1', (s) => s.as, 'gate']]],
    ['Посттранскрипційно', [['miR399 ⊣ PHO2 (E2)', (s) => s.lo, 'go'], ['IPS1 — «губка» для miR399', (s) => s.lo, 'gate'], ['miR827 ⊣ NLA (E3)', (s) => s.lo, 'go'], ['PHO2/NLA → деградація PHT1', (s) => s.hi, 'gate']]],
    ['Вихід з ЕР', [['PHF1 — шаперон', (s) => !s.hi, 'go'], ['CK2 фосфорилює PHT1 — затримка в ЕР', (s) => s.hi, 'gate']]],
  ];
  const S = { hi: { l: 'Надлишок Pᵢ', hi: true, lo: false, as: false }, lo: { l: 'Фосфорне голодування', hi: false, lo: true, as: false }, as: { l: 'Арсенат у ґрунті', hi: false, lo: true, as: true } };
  const reg = $('[data-reg]', root), host = $('[data-bars]', root);
  segmented($('[data-g]', root), 'pht', Object.entries(S).map(([k, v]) => ({ value: k, label: v.l })), 'lo', (v) => draw(S[v], v));
  function draw(s, k) {
    reg.innerHTML = LV.map(([name, items]) => `<div class="it-reg__row"><b>${name}</b><div>${items.map(([t, f, kind]) => `<span class="it-reg__chip ${f(s) ? 'is-on' : ''} it-reg__chip--${kind}">${t}</span>`).join('')}</div></div>`).join('');
    const amount = k === 'lo' ? 92 : k === 'as' ? 45 : 12;
    bars(host, [['PHT1 на плазмалемі', amount, '#B08A1E'], ['Поглинання Pᵢ (і AsO₄³⁻!)', amount * 0.95, '#1E8449']]);
  }
  draw(S.lo, 'lo');
};

/* ---------- Фосфо-код AHA2 ---------- */
W.aha2 = (root) => {
  const SIG = { blue: 'Синє світло (продихи)', aux: 'Ауксин (SAUR ⊣ PP2C.D)', psy: 'Пептид PSY1', ralf: 'Пептид RALF → FERONIA', pks5: 'PKS5 (лужний стрес)' };
  const on = { blue: false, aux: true, psy: false, ralf: false, pks5: false };
  const host = $('[data-in]', root), txt = $('[data-txt]', root), bh = $('[data-bars]', root);
  host.innerHTML = Object.entries(SIG).map(([k, v]) => `<button class="btn btn--sm btn--outline it-tog" type="button" aria-pressed="${on[k]}" data-k="${k}">${v}</button>`).join('');
  host.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; on[b.dataset.k] = !on[b.dataset.k]; b.setAttribute('aria-pressed', String(on[b.dataset.k])); draw(); });
  function draw() {
    const P = { t947: on.blue || on.aux, t881: on.psy, s899: on.ralf, s931: on.pks5 };
    const b1433 = P.t947 && !P.s931;
    $$('.ah-site', root).forEach((g) => g.classList.toggle('is-on', P[g.dataset.s]));
    $('.ah-1433', root).style.opacity = b1433 ? 1 : 0.15;
    $('.ah-r', root).style.transform = b1433 ? 'translateY(16px)' : '';
    let act = 0.15 + (b1433 ? 0.6 : 0) + (P.t881 ? 0.22 : 0);
    if (P.s899) act *= 0.3;
    act = Math.min(1, act);
    $('.ah-h', root).style.opacity = 0.2 + 0.8 * act;
    bars(bh, [['Активність помпи', act * 100, '#D4AC0D'], ['Закислення апопласту', act * 100, '#D04545', 'pH ' + num(6.5 - 1.5 * act, 1)]]);
    txt.innerHTML = (b1433 ? '<b>P-Thr947 + 14-3-3</b> відводять R-домен — помпа розблокована. ' : P.t947 && P.s931 ? '<b>Ser931</b> фосфорильований PKS5 — 14-3-3 не сідає, хоча Thr947 фосфорильований. ' : 'R-домен притиснутий до ядра — автоінгібування. ')
      + (P.t881 ? 'Thr881 додатково підсилює активність. ' : '') + (P.s899 ? '<b>RALF–FERONIA</b> фосфорилює Ser899 — помпа гальмується, апопласт залужнюється, ріст зупиняється.' : on.aux && b1433 ? 'Ауксин → «кислий ріст»: закислення стінки активує експансини.' : '');
  }
  draw();
};

boot();
