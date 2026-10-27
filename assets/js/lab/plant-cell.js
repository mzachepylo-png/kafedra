// Конспект «Відмінності рослинної і тваринної клітин»: порівняльна схема, модель стінки, ланцюги глюкози,
// розетка целюлозосинтази, пектини й кальцій, апопласт/симпласт, плазмоліз, пластиди, цитокінез.
import { sliders, setOut, num } from './ui.js';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const D = JSON.parse($('cc-data').textContent);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
};
function seg(id, cb) {
  const btns = [...$(id).querySelectorAll('button')];
  btns.forEach((b) => b.addEventListener('click', () => { btns.forEach((x) => x.setAttribute('aria-checked', String(x === b))); cb(b.dataset.v); }));
}
/** Анімація лише коли елемент видно. */
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
  if (REDUCED) frame(0);
  return { kick };
}

// ---------------------------------------------------------------- порівняльна схема
(() => {
  const svg = $('cc-cmp');
  if (!svg) return;
  const [plant, animal] = svg.querySelectorAll('.cc-cell');
  const has = (cell, p) => !!cell.querySelector(`.cc-part[data-p="${p}"]`);
  const where = (p) => (has(plant, p) && has(animal, p) ? 'both' : has(plant, p) ? 'plant' : 'animal');
  const parts = [...svg.querySelectorAll('.cc-part')];
  let mode = 'all', sel = null;
  const info = $('cc-info');
  const LAB = { both: 'є в обох клітинах', plant: 'лише в рослинній клітині', animal: 'лише в тваринній клітині' };
  function apply() {
    parts.forEach((g) => {
      const w = where(g.dataset.p);
      g.classList.toggle('is-dim', (mode !== 'all' && w !== mode) || (sel && g.dataset.p !== sel));
      g.classList.toggle('is-sel', sel === g.dataset.p);
    });
    document.querySelectorAll('.cc-table tbody tr').forEach((tr) => tr.classList.toggle('is-hl', !!sel && tr.dataset.p === sel));
  }
  function show(p) {
    sel = sel === p ? null : p;
    if (!sel) { info.innerHTML = '<p class="cc-info__hint">Оберіть органелу на схемі, щоб дізнатися, чим вона відрізняється.</p>'; apply(); return; }
    const [t, d] = D.info[p] || [p, ''];
    const w = where(p);
    info.innerHTML = `<span class="cc-tag cc-tag--${w}">${LAB[w]}</span><h3>${t}</h3><p>${d}</p>`;
    apply();
  }
  parts.forEach((g) => {
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', (D.info[g.dataset.p] || [g.dataset.p])[0]);
    g.addEventListener('click', () => show(g.dataset.p));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(g.dataset.p); } });
  });
  seg('cc-mode', (v) => { mode = v; sel = null; show(null); sel = null; apply(); });
  show(null);
})();

// ---------------------------------------------------------------- модель первинної стінки
(() => {
  const svg = $('wall3d');
  if (!svg) return;
  const NOTE = {
    cel: 'Целюлозні мікрофібрили — «арматура»: кристалічні пучки β-1,4-глюканів, шари яких лягають під різними кутами.',
    hem: 'Зшиваючі глікани (ксилоглюкани, ксилани) зв\'язують мікрофібрили водневими зв\'язками; жовті кільця — «гарячі точки» тісного контакту, де розслаблення стінки дозволяє ріст.',
    pec: 'Пектиновий матрикс — гідратований гель з галактуронанів, зшитих Ca²⁺; визначає пористість і заряд стінки.',
    prot: 'Білки — структурні екстенсини, арабіногалактанові білки та ферменти перебудови стінки.',
  };
  const on = new Set(['cel', 'hem', 'pec', 'prot']);
  const btns = [...document.querySelectorAll('#wall-chips button')];
  const note = $('wall-note');
  btns.forEach((b) => b.addEventListener('click', () => {
    const l = b.dataset.l;
    if (on.has(l)) on.delete(l); else on.add(l);
    b.setAttribute('aria-pressed', String(on.has(l)));
    svg.querySelector(`[data-l="${l}"]`).style.opacity = on.has(l) ? 1 : 0.06;
    note.textContent = NOTE[l];
  }));
  note.textContent = 'Вимикайте й вмикайте компоненти, щоб побачити внесок кожного в будову стінки.';
})();

// ---------------------------------------------------------------- ланцюги глюкози
(() => {
  const svg = $('glc');
  if (!svg) return;
  const NOTE = {
    cel: '<b>Целюлоза:</b> β-1,4-зв\'язок, кожен залишок глюкози повернутий на 180° (позначка O₅ по черзі вгорі й унизу). Лінійний плаский ланцюг утворює максимум водневих зв\'язків із сусідніми — кристалічні мікрофібрили, нерозчинні у воді.',
    sta: '<b>Крохмаль:</b> α-1,4-зв\'язки в основному ланцюзі та α-1,6 у точках розгалуження (амілопектин). Усі залишки орієнтовані однаково — ланцюг закручується в спіраль, легко гідратується і гідролізується. Запасний полісахарид.',
    cal: '<b>Калоза:</b> β-1,3-зв\'язок, спірально закручений некристалічний полімер. Швидко синтезується й розбирається: закорковує плазмодесми, ситоподібні пластинки й місця поранення.',
  };
  function hex(g, x, y, flip, col) {
    const r = 22, pts = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; pts.push(`${x + r * Math.cos(a)},${y + r * 0.62 * Math.sin(a)}`); }
    el('polygon', { points: pts.join(' '), fill: col, stroke: '#46584C', 'stroke-width': 1.6 }, g);
    const o = el('circle', { cx: x + 8, cy: y + (flip ? 13 : -13), r: 4.5, fill: '#D0443A' }, g);
    void o;
  }
  function draw(k) {
    svg.innerHTML = '';
    const g = el('g', {}, svg);
    const n = 8, x0 = 50, dx = 74;
    if (k === 'cel') {
      for (let row = 0; row < 3; row++) {
        const y = 40 + row * 46;
        for (let i = 0; i < n; i++) {
          if (i) el('line', { x1: x0 + (i - 1) * dx + 22, y1: y, x2: x0 + i * dx - 22, y2: y, stroke: '#46584C', 'stroke-width': 2.6 }, g);
          hex(g, x0 + i * dx, y, i % 2 === 1, '#F1E7C8');
        }
        if (row < 2) for (let i = 0; i < n; i++) el('line', { x1: x0 + i * dx, y1: y + 14, x2: x0 + i * dx, y2: y + 32, stroke: '#3F7FD0', 'stroke-width': 1.4, 'stroke-dasharray': '2 3' }, g);
      }
    } else if (k === 'sta') {
      const pts = [];
      for (let i = 0; i < 9; i++) { const t = i / 8; pts.push([x0 + t * 520, 85 + 42 * Math.sin(t * Math.PI * 2.4)]); }
      pts.forEach(([x, y], i) => { if (i) el('line', { x1: pts[i - 1][0], y1: pts[i - 1][1], x2: x, y2: y, stroke: '#46584C', 'stroke-width': 2.6 }, g); });
      pts.forEach(([x, y]) => hex(g, x, y, false, '#E6F0FA'));
      const [bx, by] = pts[4];
      el('line', { x1: bx, y1: by + 10, x2: bx + 20, y2: by + 56, stroke: '#46584C', 'stroke-width': 2.6, 'stroke-dasharray': '5 3' }, g);
      hex(g, bx + 26, by + 64, false, '#E6F0FA');
      el('text', { x: bx + 54, y: by + 66, class: 'cc-t cc-t--b' }, g).textContent = 'α-1,6 (розгалуження)';
    } else {
      const pts = [];
      for (let i = 0; i < 9; i++) { const t = i / 8; pts.push([x0 + t * 520, 85 + 26 * Math.sin(t * Math.PI * 4)]); }
      pts.forEach(([x, y], i) => { if (i) el('path', { d: `M${pts[i - 1][0]} ${pts[i - 1][1]} Q${(pts[i - 1][0] + x) / 2} ${(pts[i - 1][1] + y) / 2 + (i % 2 ? -24 : 24)} ${x} ${y}`, fill: 'none', stroke: '#46584C', 'stroke-width': 2.6 }, g); });
      pts.forEach(([x, y], i) => hex(g, x, y, i % 2 === 1, '#F4E3EA'));
    }
    $('glc-note').innerHTML = NOTE[k];
  }
  seg('glc-seg', draw);
  draw('cel');
})();

// ---------------------------------------------------------------- розетка целюлозосинтази
(() => {
  const svg = $('ros-svg');
  if (!svg) return;
  const mt = $('ros-mt'), fib = $('ros-fib'), cx = $('ros-cx'), tok = $('ros-tok');
  for (let i = 0; i < 40; i++) el('circle', { cx: 10 + i * 16, cy: 170, r: 6.5, fill: i % 2 ? '#7FB8CF' : '#5E9DB8' }, mt);
  el('text', { x: 400, y: 200, class: 'cc-t', fill: '#2E6E8A' }, mt).textContent = 'кортикальна мікротрубочка';
  const fibers = [0, 1, 2].map((k) => el('path', { fill: 'none', stroke: '#C9B27A', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.9 - k * 0.15 }, fib));
  const rose = el('g', {}, cx);
  for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; el('circle', { cx: 12 * Math.cos(a), cy: 12 * Math.sin(a), r: 6, fill: '#4CAF50', stroke: '#2E7D32' }, rose); }
  el('circle', { r: 5, fill: '#2E7D32' }, rose);
  el('text', { x: 0, y: -22, 'text-anchor': 'middle', class: 'cc-t cc-t--b', fill: '#2E7D32' }, rose).textContent = 'розетка';
  const sus = el('g', {}, cx);
  el('rect', { x: -26, y: 142, width: 52, height: 18, rx: 9, fill: '#FFF3CF', stroke: '#C9A227' }, sus);
  el('text', { x: 0, y: 155, 'text-anchor': 'middle', class: 'cc-t', fill: '#8C6A10', 'font-size': 10 }, sus).textContent = 'SuSy';
  let x = 80, items = [], spawn = 0;
  loopWhenVisible(svg, (dt) => {
    x += dt * 34; if (x > 600) x = 80;
    rose.setAttribute('transform', `translate(${x} 121)`);
    sus.setAttribute('transform', `translate(${x} 0)`);
    fibers.forEach((f, k) => f.setAttribute('d', `M30 ${86 - k * 8} L${x - 10} ${86 - k * 8} Q${x - 2} ${98 - k * 3} ${x} 112`));
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.9;
      const g = el('g', {}, tok);
      el('rect', { x: -26, y: -9, width: 52, height: 18, rx: 9, fill: '#FFFFFF', stroke: '#C9A227' }, g);
      el('text', { x: 0, y: 4, 'text-anchor': 'middle', class: 'cc-t', 'font-size': 10, fill: '#8C6A10' }, g).textContent = 'сахароза';
      items.push({ g, t: 0, sx: x + 120 + Math.random() * 60 });
    }
    items = items.filter((it) => {
      it.t += dt / 1.6;
      if (it.t >= 1) { it.g.remove(); return false; }
      const tx = it.sx + (x - it.sx) * it.t, ty = 236 + (152 - 236) * it.t;
      it.g.setAttribute('transform', `translate(${tx} ${ty})`);
      it.g.setAttribute('opacity', String(Math.min(1, (1 - it.t) * 4)));
      return true;
    });
  });
})();

// ---------------------------------------------------------------- пектини й кальцій
(() => {
  const svg = $('pec-svg');
  if (!svg) return;
  const N = 14, ROWS = 4;
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const order = Array.from({ length: N * ROWS }, (_, i) => i).sort(() => rnd() - 0.5);
  const sl = sliders($('pec-c'), [
    { id: 'me', label: 'Ступінь метилювання пектинів', min: 0, max: 100, step: 1, value: 70, unit: '%', hint: 'Знижує пектинметилестераза (PME) у стінці' },
    { id: 'ca', label: 'Ca²⁺ у стінці', min: 0, max: 100, step: 1, value: 80, unit: '%' },
  ], draw);
  function draw() {
    const { me, ca } = sl.values;
    svg.innerHTML = '';
    el('rect', { x: 0, y: 0, width: 560, height: 250, rx: 14, fill: '#EEF6FA' }, svg);
    const metCount = Math.round(N * ROWS * me / 100);
    const methyl = new Set(order.slice(0, metCount));
    const free = (r, i) => !methyl.has(r * N + i);
    let cross = 0;
    const ys = [40, 95, 155, 210];
    ys.forEach((y, r) => el('path', { d: `M20 ${y} ` + Array.from({ length: N }, (_, i) => `L${30 + i * 37} ${y + (i % 2 ? 6 : -6)}`).join(' '), fill: 'none', stroke: '#2E8C7A', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg));
    // зшивки між парами рядів (0-1, 2-3)
    [[0, 1], [2, 3]].forEach(([a, b]) => {
      for (let i = 0; i < N; i++) {
        if (free(a, i) && free(b, i) && (i * 37 + a * 11) % 100 < ca) {
          const x = 30 + i * 37;
          el('path', { d: `M${x} ${ys[a] + 8} L${x} ${ys[b] - 8}`, stroke: '#C9A227', 'stroke-width': 2.4, 'stroke-dasharray': '3 3' }, svg);
          el('circle', { cx: x, cy: (ys[a] + ys[b]) / 2, r: 8, fill: '#F2B630', stroke: '#8C6A10' }, svg);
          el('text', { x, y: (ys[a] + ys[b]) / 2 + 3.5, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 800, fill: '#5C470B' }, svg).textContent = 'Ca';
          cross++;
        }
      }
    });
    ys.forEach((y, r) => {
      for (let i = 0; i < N; i++) {
        const x = 30 + i * 37, up = (r % 2 === 0) ? 1 : -1, cy = y + up * 14;
        if (methyl.has(r * N + i)) el('circle', { cx: x, cy: y - up * 14, r: 6, fill: '#9AA7B0', stroke: '#5E6B7E' }, svg);
        else el('text', { x, y: cy + 4, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 800, fill: '#B23B22' }, svg).textContent = '−';
      }
    });
    const maxCross = N * 2;
    const pore = 3.5 + 6.5 * (1 - cross / maxCross);
    setOut(document, { pfree: `${N * ROWS - metCount} з ${N * ROWS}`, pcross: String(cross), ppore: `≈ ${num(pore, 1)} нм` });
    $('pec-note').innerHTML = `Сірі кружечки — метильні групи (–COOCH₃), «−» — вільні карбоксили (–COO⁻), жовті — кальцієві містки. ${cross > maxCross * 0.5 ? 'Багато зшивок — щільний гель, дрібні пори, низька проникність.' : cross < maxCross * 0.15 ? 'Мало зшивок — пухкий матрикс, великі пори.' : 'Помірна кількість зшивок.'}`;
  }
  draw();
})();

// ---------------------------------------------------------------- апопласт і симпласт
(() => {
  const svg = $('tr-svg');
  if (!svg) return;
  const apo = $('tr-apo'), sym = $('tr-sym'), tok = $('tr-tok');
  const NOTE = {
    apo: '<b>Апопластний шлях</b> (сині пунктири): вода рухається клітинними стінками й міжклітинниками, не перетинаючи мембран, — швидко, але без контролю. У ендодермі шлях обривається <b>поясками Каспарі</b>: суберин у радіальних стінках змушує розчин пройти через плазмолему.',
    sym: '<b>Симпластний шлях</b> (зелена лінія): речовини один раз проходять плазмолему ризодерми й далі рухаються цитоплазмою від клітини до клітини через плазмодесми. Вибірковість забезпечує плазмолема на вході.',
  };
  let mode = 'apo', items = [], spawn = 0;
  function set(m) {
    mode = m;
    apo.style.opacity = m === 'apo' ? 1 : 0.25; sym.style.opacity = m === 'sym' ? 1 : 0.25;
    $('tr-note').innerHTML = NOTE[m];
    items.forEach((it) => it.g.remove()); items = [];
  }
  seg('tr-seg', set); set('apo');
  loopWhenVisible(svg, (dt) => {
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.5;
      const g = el('circle', { r: 6, fill: mode === 'apo' ? '#3F7FD0' : '#2E7D32', stroke: '#fff', 'stroke-width': 1.5 }, tok);
      items.push({ g, d: 0, p: mode === 'apo' ? apo : sym, L: (mode === 'apo' ? apo : sym).getTotalLength() });
    }
    items = items.filter((it) => {
      it.d += dt * 120;
      if (it.d >= it.L) {
        if (mode === 'apo') { it.g.setAttribute('fill', '#2E7D32'); it.p = sym; it.d = sym.getPointAtLength(0) && sym.getTotalLength() * 0.61; it.L = sym.getTotalLength(); return true; }
        it.g.remove(); return false;
      }
      const pt = it.p.getPointAtLength(it.d);
      it.g.setAttribute('cx', pt.x); it.g.setAttribute('cy', pt.y);
      return true;
    });
  });
})();

// ---------------------------------------------------------------- плазмоліз
(() => {
  const svg = $('pl-svg');
  if (!svg) return;
  const proto = $('pl-proto'), vac = $('pl-vac'), chlG = $('pl-chl'), water = $('pl-water');
  const PSI_CELL = -0.9; // МПа, осмотичний потенціал клітини при повному тургорі
  const chl = [];
  for (let i = 0; i < 12; i++) chl.push(el('ellipse', { rx: 9, ry: 5, fill: '#4CAF50', stroke: '#2E6E2A' }, chlG));
  const sl = sliders($('pls-c'), [
    { id: 'c', label: 'Концентрація сахарози зовні', min: 0, max: 1, step: 0.01, value: 0.05, unit: 'М', digits: 2, hint: 'Ψ розчину = −iCRT ≈ −2,48·C МПа (25 °C)' },
  ], draw);
  function draw() {
    const C = sl.values.c;
    const psiOut = -2.48 * C;
    // частка об'єму протопласта (1 — притиснутий до стінки)
    const v = psiOut >= PSI_CELL ? 1 : Math.max(0.38, PSI_CELL / psiOut);
    const turg = Math.max(0, psiOut - PSI_CELL);
    const s = Math.sqrt(v), w = 316 * s, h = 216 * (0.55 + 0.45 * s);
    const x = 180 - w / 2, y = 130 - h / 2;
    proto.setAttribute('x', x); proto.setAttribute('y', y); proto.setAttribute('width', w); proto.setAttribute('height', h);
    proto.setAttribute('rx', 14 + (1 - s) * 60);
    vac.setAttribute('rx', Math.max(20, w / 2 - 28)); vac.setAttribute('ry', Math.max(14, h / 2 - 26));
    const tint = Math.round(80 + (1 - v) * 120);
    vac.setAttribute('fill', `rgb(${206 - (1 - v) * 60},${Math.round(tint * 1.2)},${206 - (1 - v) * 30})`);
    chl.forEach((c, i) => {
      const a = (i / chl.length) * Math.PI * 2;
      c.setAttribute('cx', 180 + Math.cos(a) * (w / 2 - 12)); c.setAttribute('cy', 130 + Math.sin(a) * (h / 2 - 9));
      c.setAttribute('transform', `rotate(${a * 57.3 + 90} ${180 + Math.cos(a) * (w / 2 - 12)} ${130 + Math.sin(a) * (h / 2 - 9)})`);
    });
    water.innerHTML = '';
    const dir = psiOut < PSI_CELL ? 1 : -1;
    if (Math.abs(psiOut - PSI_CELL) > 0.05) {
      [[180, 22], [22, 130], [338, 130], [180, 238]].forEach(([wx, wy]) => {
        const tx = 180 + (wx - 180) * (dir > 0 ? 1 : 0.7), ty = 130 + (wy - 130) * (dir > 0 ? 1 : 0.7);
        const fx = 180 + (wx - 180) * (dir > 0 ? 0.7 : 1), fy = 130 + (wy - 130) * (dir > 0 ? 0.7 : 1);
        el('path', { d: `M${fx} ${fy} L${tx} ${ty}`, stroke: '#3F7FD0', 'stroke-width': 3, 'marker-end': 'url(#c-arr)' }, water);
      });
    }
    const state = v < 0.999 ? (v < 0.6 ? 'сильний (увігнутий) плазмоліз' : 'початковий плазмоліз') : turg > 0.5 ? 'повний тургор' : 'тургор знижений';
    setOut(document, { psi: `${num(Math.max(psiOut, PSI_CELL) , 2)} МПа`, turg: `${num(v < 0.999 ? 0 : turg, 2)} МПа`, state });
    $('pls-note').innerHTML = v < 0.999
      ? `Розчин гіпертонічний (Ψ = ${num(psiOut, 2)} МПа нижчий за −0,9 МПа клітини): вода виходить з вакуолі, сік концентрується й темнішає, протопласт відстає від стінки.`
      : `Розчин гіпотонічний: вода надходить у вакуолю, протопласт притиснутий до стінки, а стінка чинить протитиск — тургор ${num(turg, 2)} МПа.`;
  }
  draw();
})();

// ---------------------------------------------------------------- пластиди
(() => {
  const svg = $('pt-svg');
  if (!svg) return;
  const info = $('pt-info');
  const nodes = [...svg.querySelectorAll('.pt-n')], edges = [...svg.querySelectorAll('.pt-e')];
  function show(k) {
    const [t, d] = D.pl[k];
    nodes.forEach((n) => n.classList.toggle('is-on', n.dataset.k === k));
    edges.forEach((e) => e.classList.toggle('is-on', e.dataset.a === k || e.dataset.b === k));
    const img = D.plimg[k];
    info.innerHTML = `${img ? `<img src="${img}" alt="${t}" loading="lazy">` : ''}<div><h3>${t}</h3><p>${d}</p></div>`;
  }
  nodes.forEach((n) => {
    n.addEventListener('click', () => show(n.dataset.k));
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(n.dataset.k); } });
  });
  show('chl');
})();

// ---------------------------------------------------------------- цитокінез
(() => {
  const svg = $('ck-svg');
  if (!svg) return;
  const t = $('ck-t'), btn = $('ck-play'), lab = $('ck-lab');
  const aPath = $('ck-a'), ring = $('ck-ring'), an1 = $('ck-an1'), an2 = $('ck-an2');
  const mt = $('ck-mt'), ves = $('ck-ves'), plate = $('ck-plate');
  const ringDots = Array.from({ length: 2 }, (_, i) => el('circle', { r: 5, fill: '#D0443A' }, ring));
  const mts = [];
  for (let i = 0; i < 9; i++) mts.push(el('path', { stroke: '#5E9DB8', 'stroke-width': 1.6, fill: 'none', opacity: 0.8 }, mt));
  const vs = Array.from({ length: 14 }, () => el('circle', { r: 4, fill: '#F2B630', stroke: '#8C6A10' }, ves));
  let playing = false;
  function draw(p) {
    // тварина: перетяжка звужує талію
    const cx = 190, cy = 150, w = 150, h = 90, pinch = Math.min(1, p * 1.15);
    const waist = h * (1 - 0.98 * pinch);
    aPath.setAttribute('d', `M${cx - w} ${cy} C${cx - w} ${cy - h * 1.2} ${cx - 30} ${cy - h * 1.1} ${cx} ${cy - waist} C${cx + 30} ${cy - h * 1.1} ${cx + w} ${cy - h * 1.2} ${cx + w} ${cy} C${cx + w} ${cy + h * 1.2} ${cx + 30} ${cy + h * 1.1} ${cx} ${cy + waist} C${cx - 30} ${cy + h * 1.1} ${cx - w} ${cy + h * 1.2} ${cx - w} ${cy} Z`);
    ringDots[0].setAttribute('cx', cx); ringDots[0].setAttribute('cy', cy - waist);
    ringDots[1].setAttribute('cx', cx); ringDots[1].setAttribute('cy', cy + waist);
    an1.setAttribute('cx', cx - 70); an1.setAttribute('cy', cy); an2.setAttribute('cx', cx + 70); an2.setAttribute('cy', cy);
    // рослина: пластинка росте від центру до країв
    const ph = Math.min(170, p * 190);
    plate.setAttribute('y', 145 - ph / 2); plate.setAttribute('height', ph);
    mts.forEach((m, i) => {
      const y = 145 + (i - 4) * 18 * Math.max(0.35, Math.min(1, ph / 160 + 0.3));
      const edge = Math.abs(y - 145) <= ph / 2 + 12;
      m.setAttribute('d', `M520 ${y} L560 ${y} M580 ${y} L620 ${y}`);
      m.setAttribute('opacity', edge ? 0.85 : 0.15);
    });
    vs.forEach((v, i) => {
      const lane = (i % 7) - 3, phase = ((p * 6 + i * 0.37) % 1);
      const y = 145 + lane * 18 * Math.max(0.35, Math.min(1, ph / 160 + 0.3));
      const side = i % 2 ? 1 : -1;
      v.setAttribute('cx', 570 + side * (50 - 46 * phase)); v.setAttribute('cy', y);
      v.setAttribute('opacity', p > 0.02 && p < 0.98 ? 0.9 : 0);
    });
    lab.textContent = p < 0.05 ? 'початок телофази' : p < 0.5 ? 'перетяжка звужується · везикули Гольджі збираються в центрі' : p < 0.95 ? 'кільце скорочується · клітинна пластинка росте до країв' : 'дві дочірні клітини';
  }
  const ui = () => { btn.innerHTML = playing ? 'Пауза' : 'Відтворити поділ'; };
  btn.addEventListener('click', () => { playing = !playing; if (playing && +t.value >= 1) t.value = 0; ui(); loop.kick(); });
  t.addEventListener('input', () => { playing = false; ui(); draw(+t.value); });
  const loop = loopWhenVisible(svg, (dt) => {
    if (!playing) return;
    t.value = Math.min(1, +t.value + dt / 6);
    t.style.setProperty('--pct', t.value * 100 + '%');
    draw(+t.value);
    if (+t.value >= 1) { playing = false; ui(); }
  });
  ui(); draw(0);
})();
