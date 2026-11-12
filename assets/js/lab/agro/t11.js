// Тема 11. «Молекулярна біологія та генетична інженерія. Трансформація рослинного геному»
// Чотири інтерактивні моделі (ЛР 41–50) з перемиканням вкладками.

import { $ } from './kit.js';
import { initGall } from './t11-gall.js';
import { initPrep } from './t11-prep.js';
import { initGel } from './t11-gel.js';
import { initSpec } from './t11-spec.js';

const bus = {};

function tabs() {
  const list = document.querySelector('.ag-tabs[role="tablist"]');
  if (!list) return null;
  const btns = [...list.querySelectorAll('[role="tab"]')];
  const api = {
    select(id, focus) {
      for (const b of btns) {
        const on = b.id === id;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(b.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
        if (on && focus) b.focus();
      }
      window.dispatchEvent(new Event('resize'));
    },
  };
  btns.forEach((b) => b.addEventListener('click', () => api.select(b.id, false)));
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = btns.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
    api.select(btns[j].id, true);
  });
  api.select(btns[0].id, false);
  return api;
}

const tabApi = tabs();

initGall();
initPrep(bus);
initGel(bus);
const spec = initSpec(bus);

// «Передати пробу в спектрофотометр» (вкладка Б → вкладка Г)
bus.onSend = () => {
  if (spec && bus.prep) spec.load(bus.prep);
  if (tabApi) tabApi.select('t11-tab-d', true);
  const el = $('t11-panel-d');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
