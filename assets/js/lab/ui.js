// Спільні елементи керування для моделей Онлайн лабораторії.

/** Число українською: кома як десятковий роздільник. */
export function num(v, digits = 2) {
  if (!isFinite(v)) return '—';
  return v.toFixed(digits).replace('.', ',').replace('-', '−');
}

/** Значущі цифри (для довільних величин). */
export function sig(v, n = 3) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v))));
  return num(v, Math.min(d, 6));
}

/**
 * Створює повзунки за специфікацією і повертає об'єкт значень (оновлюється наживо).
 * spec: [{ id, label, min, max, step, value, unit, digits, hint, log }]
 * log: true — логарифмічна шкала повзунка (min, max > 0).
 */
export function sliders(root, spec, onChange) {
  const values = {};
  const api = { values, set: null, inputs: {} };
  for (const s of spec) {
    const row = document.createElement('div');
    row.className = 'ctrl';
    const id = 'c-' + s.id;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.innerHTML = `<span>${s.label}</span>`;
    const out = document.createElement('output');
    out.htmlFor = id;
    label.append(out);
    const input = document.createElement('input');
    input.type = 'range'; input.id = id;
    const toPos = (v) => s.log ? Math.log10(v) : v;
    const fromPos = (p) => s.log ? Math.pow(10, p) : p;
    input.min = toPos(s.min); input.max = toPos(s.max);
    input.step = s.log ? 'any' : s.step;
    input.value = toPos(s.value);
    const show = () => {
      let v = fromPos(parseFloat(input.value));
      if (s.log) v = roundSig(v, 3);
      values[s.id] = v;
      out.textContent = (s.format ? s.format(v) : num(v, s.digits ?? decimals(s.step))) + (s.unit ? ' ' + s.unit : '');
      const pct = (parseFloat(input.value) - input.min) / (input.max - input.min) * 100;
      input.style.setProperty('--pct', pct + '%');
    };
    input.addEventListener('input', () => { show(); onChange && onChange(s.id); });
    show();
    row.append(label, input);
    if (s.hint) {
      const h = document.createElement('small');
      h.className = 'ctrl__hint';
      h.textContent = s.hint;
      row.append(h);
    }
    root.append(row);
    api.inputs[s.id] = { input, show, row, toPos };
  }
  api.set = (id, v, silent) => {
    const c = api.inputs[id];
    if (!c) return;
    c.input.value = c.toPos(v);
    c.show();
    if (!silent && onChange) onChange(id);
  };
  return api;
}

function decimals(step) {
  if (!step || step >= 1) return 0;
  return Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
}

function roundSig(v, n) {
  if (v === 0) return 0;
  const p = Math.pow(10, n - 1 - Math.floor(Math.log10(Math.abs(v))));
  return Math.round(v * p) / p;
}

/**
 * Сегментований перемикач. options: [{ value, label }]
 */
export function segmented(root, name, options, value, onChange) {
  root.classList.add('seg');
  root.setAttribute('role', 'radiogroup');
  const state = { value };
  const btns = options.map((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.value = o.value;
    b.innerHTML = o.label;
    b.addEventListener('click', () => select(o.value, true));
    root.append(b);
    return b;
  });
  function select(v, fire) {
    state.value = v;
    btns.forEach((b) => {
      const on = b.dataset.value === String(v);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    if (fire && onChange) onChange(v);
  }
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = options.findIndex((o) => String(o.value) === String(state.value));
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    select(options[j].value, true);
    btns[j].focus();
  });
  select(value, false);
  state.select = select;
  return state;
}

/** Оновлює картки показників: { key: text }. Елементи: [data-out="key"]. */
export function setOut(root, map) {
  for (const [k, v] of Object.entries(map)) {
    root.querySelectorAll(`[data-out="${k}"]`).forEach((el) => { el.innerHTML = v; });
  }
}

/** Завантаження CSV (роздільник «;», десяткова кома — відкривається в Excel з укр. локаллю). */
export function downloadCSV(filename, header, rows) {
  const esc = (v) => {
    const s = typeof v === 'number' ? String(+v.toPrecision(8)).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Детермінований генератор псевдовипадкових чисел (mulberry32). */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.normal = () => {
    let u = 0, v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return next;
}

/** Хеш рядка → seed (щоб варіант можна було задати як прізвище або номер). */
export function hashSeed(str) {
  let h = 2166136261;
  for (const ch of String(str).trim().toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Таблиця з даних: header — масив назв, rows — масив масивів. */
export function renderTable(table, header, rows) {
  const thead = `<thead><tr>${header.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
  table.innerHTML = thead + tbody;
}

/** Перевірка відповіді з допуском (відносна похибка). */
export function check(answer, truth, tol = 0.05) {
  const a = parseFloat(String(answer).replace(',', '.').replace('−', '-'));
  if (!isFinite(a)) return { ok: false, empty: String(answer).trim() === '', err: NaN };
  const err = Math.abs(a - truth) / Math.abs(truth);
  return { ok: err <= tol, err, value: a };
}
