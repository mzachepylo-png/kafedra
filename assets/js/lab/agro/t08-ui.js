// Тема 8. Спільні дрібниці інтерфейсу моделей: розмір полотна, показники, вердикт, пресети.
import { fit, setOut } from './kit.js';

/** Повертає функцію, що підганяє полотно: на вузьких екранах — вища сцена. */
export function stageFit(cv, { desk = 16 / 9, mob = 0.82, min = 320, max = 560, mobMax = 620 } = {}) {
  return () => {
    const w = cv.parentElement.clientWidth;
    const narrow = w < 640;
    return Object.assign(fit(cv, { aspect: narrow ? mob : desk, min, max: narrow ? mobMax : max }), { narrow });
  };
}
export function reads(root, map) { setOut(root, map); }
export function verdict(el, html, level = 'ok') {
  el.innerHTML = html;
  el.classList.toggle('is-warn', level === 'warn');
  el.classList.toggle('is-bad', level === 'bad');
}
/** Кнопки-пресети: [{label, apply}] у контейнер. */
export function presets(host, list) {
  if (!host) return;
  for (const p of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 't8-preset'; b.innerHTML = p.label;
    b.addEventListener('click', p.apply);
    host.append(b);
  }
}
/** Перемикач-галочка в стилі сайту. */
export function checkbox(host, label, checked, on) {
  const l = document.createElement('label'); l.className = 't8-check';
  const i = document.createElement('input'); i.type = 'checkbox'; i.checked = checked;
  i.addEventListener('change', () => on(i.checked));
  l.append(i, document.createTextNode(' ' + label)); l.querySelector('input');
  host.append(l);
  return i;
}
export const q = (root, sel) => root.querySelector(sel);
/** Позначка «перемалювати» з requestAnimationFrame, щоб не малювати по кілька разів за кадр. */
export function scheduler(fn) {
  let pending = false;
  return () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; fn(); }); };
}
