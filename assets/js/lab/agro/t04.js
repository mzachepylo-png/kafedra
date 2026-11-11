// Тема 4. Морфогенез і регенерація в культурі калюсних тканин (ЛР 15–17).
// Вкладки: А — баланс ауксин/цитокінін (Скуг — Міллер), Б — укорінення й вихід регенерантів, В — соматичний ембріогенез.
import { initA, initB } from './t04-organ.js';
import { initC } from './t04-embryo.js';

const A = initA();
const B = initB(() => A);
const C = initC();
const models = { a: A, b: B, c: C };

// вкладки (доступні з клавіатури: стрілки ← →)
const tabs = [...document.querySelectorAll('#t4-tabs [role="tab"]')];
function show(tab, focus) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    const m = models[t.dataset.k];
    if (!on && m && m.runner.running) m.runner.pause();
  });
  const m = models[tab.dataset.k];
  if (m) requestAnimationFrame(() => m.redraw());
  if (focus) tab.focus();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => show(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault(); show(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
  });
});
// посилання #t4-tab-b тощо відкривають потрібну вкладку
function fromHash() { const k = { '#t4-tab-a': 0, '#t4-tab-b': 1, '#t4-tab-c': 2 }[location.hash]; if (k !== undefined) { show(tabs[k]); document.getElementById('model').scrollIntoView({ behavior: 'smooth' }); } }
addEventListener('hashchange', fromHash);
document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#t4-tab-"]'); if (a && a.getAttribute('href') === location.hash) fromHash(); });
fromHash();
