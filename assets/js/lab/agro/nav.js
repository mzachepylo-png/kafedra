// «Біотехнології в агросфері»: навігація збоку й пошук.
// • пошук по поточній сторінці: підсвічування збігів, перехід ↑/↓ (Enter / Shift+Enter), розкриття згорнутих блоків;
// • пошук по всіх опублікованих темах розділу за індексом search.json (генерується разом зі сторінками);
// • перехід за посиланням на «Робота N» розкриває відповідний блок ходу роботи;
// • на телефоні зміст згортається, а пошук і «назад» лишаються вгорі.

const root = document.querySelector('[data-ag-nav]');
const INDEX_URL = root ? root.dataset.index : null;
const CUR = root ? Number(root.dataset.topic || 0) : 0;
const BASE = root ? root.dataset.base || '' : '';
const article = document.querySelector('.lab-doc article, [data-ag-search-scope]');

/* ---------- розкриття <details> за якорем ---------- */
function openTarget(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'DETAILS') el.open = true;
  let p = el.parentElement;
  while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; }
}
function onHash() { const id = decodeURIComponent(location.hash.slice(1)); if (id) { openTarget(id); const el = document.getElementById(id); if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' })); } }
window.addEventListener('hashchange', onHash);
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (a) openTarget(decodeURIComponent(a.getAttribute('href').slice(1)));
});
if (location.hash) onHash();

/* ---------- зміст на телефоні ---------- */
const listBox = document.querySelector('.ag-toc__list');
if (listBox) {
  const mq = matchMedia('(min-width: 1081px)');
  const sync = () => { listBox.open = mq.matches; };
  sync(); mq.addEventListener('change', sync);
  // на телефоні згорнути після переходу
  listBox.addEventListener('click', (e) => { if (!mq.matches && e.target.closest('a')) listBox.open = false; });
}

/* ---------- нормалізація тексту ---------- */
const norm = (s) => s.toLowerCase().replace(/[’ʼ`]/g, "'").replace(/ё/g, 'е');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- пошук по сторінці ---------- */
let hits = [], cur = -1;
function clearMarks() {
  for (const m of document.querySelectorAll('mark.ag-hit')) {
    const t = document.createTextNode(m.textContent);
    m.replaceWith(t);
    t.parentNode && t.parentNode.normalize();
  }
  hits = []; cur = -1;
}
function visible(node) {
  const el = node.parentElement;
  if (!el) return false;
  if (el.closest('script,style,noscript,canvas,svg,.toc,.ag-search,.ag-see,[hidden],button,select,option,textarea,input')) return false;
  return true;
}
function markPage(q) {
  clearMarks();
  if (!article || q.length < 2) return 0;
  const nq = norm(q);
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() && visible(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const text = n.nodeValue, low = norm(text);
    let i = low.indexOf(nq);
    if (i < 0) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (i >= 0) {
      frag.append(text.slice(last, i));
      const m = document.createElement('mark'); m.className = 'ag-hit'; m.textContent = text.slice(i, i + q.length);
      frag.append(m); hits.push(m);
      last = i + q.length; i = low.indexOf(nq, last);
    }
    frag.append(text.slice(last));
    n.replaceWith(frag);
  }
  return hits.length;
}
function go(dir) {
  if (!hits.length) return;
  if (cur >= 0) hits[cur].classList.remove('is-cur');
  cur = (cur + dir + hits.length) % hits.length;
  const m = hits[cur];
  let p = m.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; }
  m.classList.add('is-cur');
  m.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  updateCount();
}

/* ---------- пошук по всіх темах ---------- */
let INDEX = null;
async function loadIndex() {
  if (INDEX || !INDEX_URL) return INDEX;
  try { INDEX = await (await fetch(INDEX_URL)).json(); } catch { INDEX = []; }
  return INDEX;
}
function snippet(text, nq, len = 140) {
  const low = norm(text), i = low.indexOf(nq);
  const a = Math.max(0, i - 50), b = Math.min(text.length, a + len);
  let s = (a > 0 ? '…' : '') + text.slice(a, b) + (b < text.length ? '…' : '');
  const ls = norm(s); let out = '', last = 0, j = ls.indexOf(nq);
  while (j >= 0) { out += esc(s.slice(last, j)) + '<mark>' + esc(s.slice(j, j + nq.length)) + '</mark>'; last = j + nq.length; j = ls.indexOf(nq, last); }
  return out + esc(s.slice(last));
}

/* ---------- інтерфейс ---------- */
const form = document.querySelector('.ag-search');
const input = form && form.querySelector('input');
const out = form && form.querySelector('.ag-search__out');
const countEl = form && form.querySelector('.ag-search__count');
function updateCount() {
  if (!countEl) return;
  const q = input.value.trim();
  if (!article) { countEl.textContent = ''; return; }
  countEl.textContent = q.length < 2 ? '' : hits.length ? `${cur + 1 || 0} з ${hits.length} на сторінці` : 'на сторінці немає';
}
let tm = 0;
async function run(scroll = true) {
  const q = input.value.trim();
  const n = markPage(q);
  if (n && scroll) go(1); else updateCount();
  if (!out) return;
  if (q.length < 2) { out.innerHTML = ''; out.hidden = true; return; }
  const idx = await loadIndex();
  const nq = norm(q);
  const words = nq.split(/\s+/).filter(Boolean);
  const res = [];
  for (const e of idx || []) {
    if (CUR && e.n === CUR) continue;
    const hay = norm(e.h + ' ' + e.x);
    if (!words.every((w) => hay.includes(w))) continue;
    const score = (norm(e.h).includes(nq) ? 3 : 0) + (hay.includes(nq) ? 1 : 0);
    res.push({ e, score });
  }
  res.sort((a, b) => b.score - a.score || a.e.n - b.e.n);
  const top = res.slice(0, 8);
  out.hidden = false;
  out.innerHTML = (article ? `<p class="ag-search__h">${CUR ? 'В інших темах розділу' : 'У темах розділу'}${res.length ? ` — ${res.length}` : ''}</p>` : '') +
    (top.length ? '<ul>' + top.map(({ e }) => `<li><a href="${BASE}${e.u}?q=${encodeURIComponent(q)}#${e.a}"><b>Тема ${e.n}. ${esc(e.h)}</b><span>${snippet(e.x, nq)}</span></a></li>`).join('') + '</ul>'
      : `<p class="ag-search__none">${CUR ? 'В інших темах збігів немає.' : 'Збігів немає.'}</p>`) +
    (res.length > top.length ? `<p class="ag-search__more">Ще ${res.length - top.length} — уточніть запит.</p>` : '');
}
if (form) {
  form.addEventListener('submit', (e) => { e.preventDefault(); if (hits.length) go(1); else run(); });
  input.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => run(true), 220); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); go(-1); }
    if (e.key === 'Escape') { input.value = ''; run(false); }
  });
  form.querySelector('[data-dir="-1"]')?.addEventListener('click', () => go(-1));
  form.querySelector('[data-dir="1"]')?.addEventListener('click', () => go(1));
  input.addEventListener('focus', () => loadIndex(), { once: true });
  // ?q= з іншої сторінки: підсвітити збіги (якір має пріоритет для прокрутки)
  const q0 = new URLSearchParams(location.search).get('q');
  if (q0) { input.value = q0; run(!location.hash); }
}
