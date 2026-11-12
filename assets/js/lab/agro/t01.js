// Тема 1. Живильні середовища та стерилізація (ЛР 1–7, с. 49–61): п'ять інтерактивних моделей у вкладках.
// Модель ініціалізується, коли її вкладку вперше відкривають (полотну потрібна реальна ширина).
import { initAutoclave } from './t01-autoclave.js';
import { initStock } from './t01-stock.js';
import { initFilter } from './t01-filter.js';
import { initExplant } from './t01-explant.js';
import { initPolar } from './t01-polar.js';

const INIT = { autoclave: initAutoclave, stock: initStock, filter: initFilter, explant: initExplant, polar: initPolar };
const done = new Set();

function boot() {
  const tabs = [...document.querySelectorAll('#t1-tabs [role="tab"]')];
  if (!tabs.length) return;
  const show = (btn, focus = false) => {
    tabs.forEach((b) => {
      const on = b === btn, panel = document.getElementById(b.getAttribute('aria-controls'));
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
      if (on && !done.has(panel.id)) {
        done.add(panel.id);
        try { INIT[panel.dataset.model](panel); } catch (e) { console.error(e); }
      }
    });
    if (focus) btn.focus();
  };
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => { show(b); history.replaceState(null, '', '#' + b.getAttribute('aria-controls')); });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; show(tabs[j], true);
    });
  });
  // посилання з теорії на конкретну вкладку: <a href="#m-filter" data-tab>
  const fromHash = () => { const t = tabs.find((b) => '#' + b.getAttribute('aria-controls') === location.hash); if (t) { show(t); document.getElementById('model')?.scrollIntoView({ block: 'start' }); return true; } return false; };
  document.querySelectorAll('a[data-tab]').forEach((a) => a.addEventListener('click', (e) => { const t = tabs.find((b) => '#' + b.getAttribute('aria-controls') === a.getAttribute('href')); if (t) { e.preventDefault(); show(t); history.replaceState(null, '', a.getAttribute('href')); document.getElementById('model').scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) show(tabs[0]);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
