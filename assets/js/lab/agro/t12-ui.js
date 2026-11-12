// Тема 12 — спільні дрібниці інтерфейсу моделей: каркас моделі, вкладки, показники, підписи на полотні.
import { Plot, sliders, segmented, roundRect, TAU, clamp } from './kit.js';

/** Створює елемент з атрибутами й дітьми. */
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}

/**
 * Каркас моделі всередині host (.ag-model): сцена, рядок запуску, показники, вердикт, панелі керування, графіки.
 * spec: {id, aria, hud:[keys], reads:[[key, label]], panels:[title], plots:[[key,title]], note}
 */
export function frame(host, spec) {
  const canvas = el('canvas', { role: 'img', 'aria-label': spec.aria });
  const hud = el('div', { class: 'ag-stage__hud', 'aria-hidden': 'true' });
  const stage = el('div', { class: 'ag-stage' }, canvas, hud);
  const run = el('button', { class: 'btn btn--gold ag-run', type: 'button' }, '▶ Запустити');
  const reset = el('button', { class: 'btn btn--outline', type: 'button' }, '↺ Скинути');
  const status = el('span', { class: 'ag-status', 'aria-live': 'polite' });
  const runbar = el('div', { class: 'ag-runbar' }, run, reset, status);
  const reads = {};
  const readsBox = el('div', { class: 'ag-reads' }, spec.reads.map(([k, label]) => {
    const b = el('b', { text: '—' }); reads[k] = b;
    return el('div', { class: 'ag-read' }, el('small', { html: label }), b);
  }));
  const verdict = el('div', { class: 'ag-verdict', 'aria-live': 'polite' });
  const panels = spec.panels.map((t) => el('div', { class: 'ag-panel' }, el('h4', { html: t })));
  const side = el('div', { class: 'ag-side' }, panels);
  const main = el('div', { class: 'ag-main' }, stage, runbar, readsBox, verdict);
  const grid = el('div', { class: 'ag-grid' }, main, side);
  const plots = {};
  const plotBox = el('div', { class: 'ag-plots' }, (spec.plots || []).map(([k, title]) => {
    const d = el('div'); plots[k] = d;
    return el('div', { class: 'ag-plot' }, el('h4', { html: title }), d);
  }));
  host.append(grid, plotBox);
  let extra = null;
  if (spec.table) { extra = el('div', { class: 'ag-tablewrap' }); host.append(extra); }
  if (spec.note) host.append(el('p', { class: 'ag-note', html: spec.note }));
  return { canvas, hud, run, reset, status, reads, verdict, panels, plots, table: extra, stage };
}

/** Встановлює текст показника з класом стану. */
export function setRead(b, html, state = '') { b.innerHTML = html; b.className = state ? 'is-' + state : ''; }
export function setVerdict(v, html, kind = '') { v.innerHTML = html; v.className = 'ag-verdict' + (kind ? ' is-' + kind : ''); }
export function setHud(hud, items) { hud.replaceChildren(...items.map((t) => el('span', { html: t }))); }

/** Сегментований перемикач у панелі з підписом. */
export function seg(panel, label, options, value, on) {
  const wrap = el('div', { class: 'ctrl' }, el('label', {}, el('span', { html: label })));
  const box = el('div');
  wrap.append(box); panel.append(wrap);
  const r = segmented(box, label, options, value, on);
  if ([3, 5, 6].includes(options.length) && options.every((o) => String(o.label).length <= 9)) box.classList.add('is-n' + options.length);
  return r;
}
/** Повзунки в панелі. */
export function slide(panel, spec, on) { return sliders(panel, spec, on); }

/** Кнопки-пресети. */
export function presets(panel, list) {
  const box = el('div', { class: 'ag-presets' });
  for (const [label, fn] of list) { const b = el('button', { type: 'button', class: 'btn btn--outline btn--sm', html: label }); b.addEventListener('click', fn); box.append(b); }
  panel.append(box); return box;
}

/** Вкладки .ag-tabs з панелями .ag-tabpanel (aria). */
export function tabs(root) {
  const list = root.querySelector('.ag-tabs');
  if (!list) return;
  const btns = [...list.querySelectorAll('[role="tab"]')];
  const select = (b, focus) => {
    btns.forEach((x) => {
      const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
      const p = document.getElementById(x.getAttribute('aria-controls')); if (p) p.hidden = !on;
    });
    if (focus) b.focus();
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); select(btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length], true);
    });
  });
  const hash = location.hash.slice(1);
  select(btns.find((b) => b.dataset.hash === hash) || btns[0]);
}

/* ---------- Текст на полотні в «дизайн-координатах» (масштаб S) ---------- */
let S = 1;
export function setScale(s) { S = s; }
export function getScale() { return S; }
/** Текст із розміром у реальних CSS-пікселях незалежно від масштабу сцени. */
export function txt(ctx, text, x, y, { px = 12, weight = 600, color = '#1F3A2A', align = 'left', base = 'alphabetic', bg = null, pad = 5, font = 'sans', max = 0 } = {}) {
  ctx.save();
  const fam = font === 'mono' ? 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace' : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.font = `${weight} ${px / S}px ${fam}`; ctx.textAlign = align; ctx.textBaseline = base;
  let m = ctx.measureText(text).width;
  if (max && m > max) { const k = max / m; ctx.font = `${weight} ${(px * k) / S}px ${fam}`; m = max; }
  if (bg) {
    const p = pad / S, hgt = px / S;
    const bx = align === 'center' ? x - m / 2 : align === 'right' ? x - m : x;
    const by = base === 'middle' ? y - hgt / 2 : base === 'top' ? y : y - hgt * 0.82;
    ctx.fillStyle = bg; roundRect(ctx, bx - p, by - p * 0.7, m + 2 * p, hgt + p * 1.4, (hgt + p) / 2.4); ctx.fill();
  }
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
  return m;
}
export function measure(ctx, text, px = 12, weight = 600) {
  ctx.save(); ctx.font = `${weight} ${px / S}px system-ui, sans-serif`; const m = ctx.measureText(text).width; ctx.restore(); return m;
}

/** Колір видимого світла для довжини хвилі (нм) — наближення Брутона. */
export function waveColor(l) {
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = -(l - 440) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; } else if (l < 510) { g = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; } else if (l < 645) { r = 1; g = -(l - 645) / 65; } else { r = 1; }
  const f = l < 420 ? 0.35 + 0.65 * (l - 380) / 40 : l > 700 ? 0.35 + 0.65 * (780 - l) / 80 : 1;
  return [Math.round(255 * Math.pow(clamp(r * f, 0, 1), 0.8)), Math.round(255 * Math.pow(clamp(g * f, 0, 1), 0.8)), Math.round(255 * Math.pow(clamp(b * f, 0, 1), 0.8))];
}

/** Секундомір (циферблат із секундною стрілкою). */
export function stopwatch(ctx, cx, cy, r, sec, { running = false } = {}) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, '#F4F6F5'); g.addColorStop(0.7, '#B9C2C0'); g.addColorStop(1, '#69736F');
  ctx.fillStyle = '#7C8582'; ctx.fillRect(cx - r * 0.12, cy - r * 1.32, r * 0.24, r * 0.25);
  ctx.beginPath(); ctx.arc(cx, cy - r * 1.36, r * 0.16, 0, TAU); ctx.fillStyle = running ? '#C7452E' : '#8A938F'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.08, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, TAU); ctx.fillStyle = '#FFFEF8'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = r * 0.03; ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * TAU - Math.PI / 2, l = i % 5 ? 0.08 : 0.16;
    ctx.strokeStyle = i % 5 ? 'rgba(30,40,35,.45)' : '#1C2620'; ctx.lineWidth = i % 5 ? r * 0.015 : r * 0.035;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86); ctx.lineTo(cx + Math.cos(a) * r * (0.86 - l), cy + Math.sin(a) * r * (0.86 - l)); ctx.stroke();
  }
  const a = (sec % 60) / 60 * TAU - Math.PI / 2;
  ctx.strokeStyle = '#C7452E'; ctx.lineWidth = r * 0.04; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * r * 0.15, cy - Math.sin(a) * r * 0.15); ctx.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); ctx.stroke();
  const am = (sec / 60) / 30 * TAU - Math.PI / 2; // малий циферблат хвилин
  ctx.strokeStyle = '#1C2620'; ctx.lineWidth = r * 0.03;
  ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.38); ctx.lineTo(cx + Math.cos(am) * r * 0.2, cy + r * 0.38 + Math.sin(am) * r * 0.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.38, r * 0.24, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = r * 0.02; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.06, 0, TAU); ctx.fillStyle = '#1C2620'; ctx.fill();
  // скляний відблиск
  ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.42, r * 0.42, r * 0.2, -0.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
  ctx.restore();
}

export { Plot };
