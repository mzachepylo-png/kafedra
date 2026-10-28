// Спільні утиліти: створення елементів, SVG, реєстр інтерактивних блоків (ліниве монтування).
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

export function svg(tag, attrs, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

/** Розмітка SVG-рядком у вже створений <svg>. */
export function svgHTML(root, html) { root.innerHTML = html; return root; }

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);

/** Кнопки-перемикачі (радіогрупа). opts: [{v, t, c}] */
export function options(root, opts, value, onChange, cls = 'mg-opt') {
  const btns = opts.map((o) => {
    const b = el('button', { type: 'button', class: cls, role: 'radio', 'aria-checked': 'false', 'data-v': o.v }, o.c ? el('i', { style: `--c:${o.c}` }) : null, o.t);
    b.addEventListener('click', () => set(o.v, true));
    root.append(b); return b;
  });
  root.setAttribute('role', 'radiogroup');
  function set(v, fire) {
    btns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === String(v))));
    if (fire) onChange(v);
  }
  set(value, false);
  return { set: (v) => set(v, false), btns };
}

/** Покроковий програвач: dots + кнопки. */
export function stepper(root, n, onStep, { start = 0, auto = false, lc } = {}) {
  let i = start, timer = 0;
  const dots = el('div', { class: 'mg-step__dots' });
  const prev = el('button', { type: 'button', class: 'mg-btn mg-btn--o', 'aria-label': 'Назад' }, '←');
  const next = el('button', { type: 'button', class: 'mg-btn', 'aria-label': 'Далі' }, 'Далі →');
  const play = el('button', { type: 'button', class: 'mg-btn mg-btn--o', 'aria-pressed': 'false' }, '▶ Автоматично');
  const btns = [];
  for (let k = 0; k < n; k++) { const b = el('button', { type: 'button', 'aria-label': 'Крок ' + (k + 1) }, k + 1); b.addEventListener('click', () => go(k)); btns.push(b); dots.append(b); }
  root.classList.add('mg-step'); if (lc) root.style.setProperty('--lc', lc);
  root.append(prev, dots, next, play);
  function go(k) {
    i = clamp(k, 0, n - 1);
    btns.forEach((b, j) => { b.classList.toggle('is-on', j === i); b.classList.toggle('is-done', j < i); });
    prev.disabled = i === 0; next.disabled = i === n - 1;
    onStep(i);
  }
  prev.addEventListener('click', () => { stop(); go(i - 1); });
  next.addEventListener('click', () => { stop(); go(i + 1); });
  function stop() { clearInterval(timer); timer = 0; play.setAttribute('aria-pressed', 'false'); play.textContent = '▶ Автоматично'; }
  play.addEventListener('click', () => {
    if (timer) return stop();
    play.setAttribute('aria-pressed', 'true'); play.textContent = '❚❚ Пауза';
    if (i === n - 1) go(0);
    timer = setInterval(() => { if (i >= n - 1) stop(); else go(i + 1); }, 2600);
  });
  go(i);
  return { go, get i() { return i; } };
}

// ---------------------------------------------------------------- реєстр блоків
const REG = {};
export function register(name, fn) { REG[name] = fn; }

export function mountAll() {
  const nodes = $$('.mg-w[data-w]');
  const run = (n) => {
    if (n.dataset.ready) return;
    n.dataset.ready = '1';
    const fn = REG[n.dataset.w];
    if (!fn) { console.warn('mgen: немає блоку', n.dataset.w); return; }
    try { fn(n.querySelector('.mg-fig__b') || n, n); } catch (e) { console.error('mgen:', n.dataset.w, e); }
  };
  if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }), { rootMargin: '400px 0px' });
  nodes.forEach((n) => io.observe(n));
  // якщо перейшли за якорем у віддалений блок — змонтувати негайно
  addEventListener('hashchange', () => { const t = document.getElementById(location.hash.slice(1)); if (t) $$('.mg-w', t).forEach(run); });
}

/** Спільна анімація: виклик f(dt) кожен кадр, поки елемент видимий. */
export function loop(node, f) {
  let raf = 0, last = 0, vis = true;
  const tick = (t) => { const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; f(dt, t / 1000); raf = requestAnimationFrame(tick); };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { vis = es[0].isIntersecting; vis ? start() : stop(); }).observe(node);
  else start();
  return { start, stop };
}
