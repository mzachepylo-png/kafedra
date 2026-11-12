// Тема 8. Мікроклональне розмноження рослин — керування вкладками й лінива ініціалізація моделей.
import * as M1 from './t08-meristem.js';
import * as M2 from './t08-clone.js';
import * as M3 from './t08-tuber.js';
import * as M4 from './t08-root.js';
import * as M5 from './t08-adapt.js';
import * as M6 from './t08-growth.js';

const MODS = { m1: M1, m2: M2, m3: M3, m4: M4, m5: M5, m6: M6 };
const live = {};

function boot() {
  const tabs = [...document.querySelectorAll('#t8-tabs [role="tab"]')];
  if (!tabs.length) return;
  const show = (btn, focus = false) => {
    for (const b of tabs) {
      const on = b === btn;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(b.getAttribute('aria-controls'));
      panel.hidden = !on;
      const key = b.dataset.model;
      if (!on && live[key]?.runner?.running) live[key].runner.pause();
    }
    const key = btn.dataset.model;
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    try {
      if (!live[key]) live[key] = MODS[key].init(panel);
      else live[key].draw();
    } catch (e) { console.error(e); }
    if (focus) btn.focus();
    if (history.replaceState && focus !== null) history.replaceState(null, '', '#' + panel.id);
  };
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => show(b));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      show(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true);
    });
  });
  // посилання з теорії на конкретну вкладку: #tab-m3 тощо
  const open = () => {
    const id = location.hash.slice(1);
    const t = tabs.find((b) => b.getAttribute('aria-controls') === id);
    if (t) { show(t, null); document.getElementById('model').scrollIntoView({ block: 'start' }); return true; }
    return false;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#tab-"]');
    if (!a) return;
    const t = tabs.find((b) => '#' + b.getAttribute('aria-controls') === a.getAttribute('href'));
    if (t) { e.preventDefault(); show(t, null); document.getElementById(a.getAttribute('href').slice(1)).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  if (!open()) show(tabs[0], null);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
