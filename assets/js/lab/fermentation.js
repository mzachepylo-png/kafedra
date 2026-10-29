// Стаття «Бродіння»: інтерактивні моделі. Віджети монтуються, коли наближаються до екрана.
const D = JSON.parse(document.getElementById('fm-data').textContent);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const fmt = (x, d = 1) => (+x).toFixed(d).replace('.', ',');
const mix = (a, b, t) => a + (b - a) * t;
const T = Object.fromEntries(D.types.map((t) => [t.id, t]));
const MOL = (k, w = 70) => `<img src="../../assets/img/ferm/mol/${k}.svg" alt="" width="${w}" height="${Math.round(w * 0.75)}" loading="lazy">`;
function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}
function chips(items, cur, attr = 'data-id') {
  return `<div class="fm-chips" role="group">${items.map((it) => `<button type="button" ${attr}="${it.id}" aria-pressed="${it.id === cur}"${it.col ? ` style="--c:${it.col}"` : ''}>${it.label}</button>`).join('')}</div>`;
}
const setPressed = (box, id, attr = 'data-id') => $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === id)));
function loopWhenVisible(node, frame) {
  let vis = false, raf = 0, last = 0;
  const tick = (now) => {
    raf = 0;
    if (!vis || document.hidden) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; frame(dt, now / 1000);
    raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && vis && !document.hidden && !REDUCED) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; kick(); }, { rootMargin: '60px' }).observe(node);
  document.addEventListener('visibilitychange', kick);
}
const W = {};
const typeLabel = (t) => (t.true ? '<span class="fm-badge" style="--c:#2E7D32">Справжнє бродіння</span>' : '<span class="fm-badge fm-badge--no">Окиснювальне «бродіння» (аеробне)</span>');

/* ================================================================ перехрестя пірувату */
W.crossroads = (node) => {
  const m = $('[data-mount]', node);
  const ids = ['ethanol', 'acetic', 'lactic', 'propionic', 'butyric', 'citric'];
  const key = { ethanol: 'піруватдекарбоксилаза', acetic: 'PQQ-ADH (периплазма)', lactic: 'лактатдегідрогеназа', propionic: 'транскарбоксилаза', butyric: 'ПФОР + тіолаза', citric: 'піруваткарбоксилаза' };
  const pos = { ethanol: [420, 40], acetic: [610, 40], lactic: [420, 110], propionic: [420, 180], butyric: [420, 250], citric: [420, 320] };
  const hub = [190, 190];
  let cur = 'ethanol';
  m.innerHTML = `<div class="fm-xr"><div class="fm-stage fm-stage--col"><svg viewBox="0 0 770 380" role="img" aria-label="Піруват і шість шляхів бродіння" class="fm-sv"></svg><div class="fm-info" aria-live="polite"></div></div>${chips(ids.map((i) => ({ id: i, label: T[i].name, col: T[i].col })), cur)}</div>`;
  const svg = $('svg', m), info = $('.fm-info', m), box = $('.fm-chips', m);
  const defs = svgEl('defs', {}, svg);
  const paths = {};
  svg.insertAdjacentHTML('beforeend', `<rect x="14" y="150" width="86" height="80" rx="14" fill="#FFF4DC" stroke="#E0B13C" stroke-width="2"/><text x="57" y="184" text-anchor="middle" class="tb">Глюкоза</text><text x="57" y="202" text-anchor="middle" class="tm">C₆H₁₂O₆</text><path d="M100 190H146" stroke="#46584C" stroke-width="3"/><text x="124" y="178" text-anchor="middle" class="tm">гліколіз</text><text x="124" y="214" text-anchor="middle" class="tm">+2 АТФ</text><circle cx="${hub[0]}" cy="${hub[1]}" r="46" fill="#FFF8E7" stroke="#C9951B" stroke-width="3"/><text x="${hub[0]}" y="${hub[1] - 4}" text-anchor="middle" class="tb">Піруват</text><text x="${hub[0]}" y="${hub[1] + 14}" text-anchor="middle" class="tm">2 NADH</text>`);
  ids.forEach((id) => {
    const [x, y] = pos[id], t = T[id], dash = id === 'citric' || id === 'acetic';
    const d = id === 'acetic' ? `M${pos.ethanol[0] + 150} ${pos.ethanol[1] + 26}H${x}` : `M${hub[0] + 46} ${hub[1]}C${hub[0] + 150} ${hub[1]} ${x - 90} ${y + 26} ${x} ${y + 26}`;
    const p = svgEl('path', { d, fill: 'none', stroke: t.col, 'stroke-width': 3, 'stroke-dasharray': dash ? '7 5' : '' }, svg); p.dataset.id = id; paths[id] = p;
    const g = svgEl('g', { class: 'tp', tabindex: 0, role: 'button', 'aria-label': t.name, 'data-id': id }, svg);
    svgEl('rect', { x, y, width: 150, height: 52, rx: 12, fill: '#fff', stroke: t.col, 'stroke-width': 2.5 }, g);
    const tx = svgEl('text', { x: x + 75, y: y + 22, 'text-anchor': 'middle', class: 'tb' }, g); tx.textContent = t.name;
    const t2 = svgEl('text', { x: x + 75, y: y + 40, 'text-anchor': 'middle', class: 'tm' }, g); t2.textContent = t.prod.length > 24 ? t.prod.slice(0, 23) + '…' : t.prod;
    const k = svgEl('text', { x: x + 160 - (id === 'acetic' ? 0 : 0), y: y + 30, class: 'tm', 'text-anchor': 'start', opacity: 0 }, g); k.textContent = ''; 
  });
  svg.insertAdjacentHTML('beforeend', `<text x="14" y="368" class="tm">пунктир — аеробні процеси (потрібен O₂)</text>`);
  const dots = Array.from({ length: 6 }, () => svgEl('circle', { r: 5, fill: '#C0392B' }, svg));
  let pl = 0;
  const ui = () => {
    const t = T[cur], d = cur === 'ethanol' || cur === 'lactic' || cur === 'propionic' || cur === 'butyric';
    info.innerHTML = `<h4>${t.name} бродіння</h4>${typeLabel(t)}<dl><dt>Ключ</dt><dd>${key[cur]}</dd><dt>Продукт</dt><dd>${t.prod}</dd><dt>Збудники</dt><dd><i>${t.orgs}</i></dd><dt>Акцептор</dt><dd>${t.acc}</dd><dt>АТФ на глюкозу</dt><dd>${t.atp}</dd><dt>ΔG°′</dt><dd>${t.dg}</dd><dt>Кисень</dt><dd>${t.o2}</dd></dl><p>${t.mol.slice(0, 2).map((k) => MOL(k, 64)).join('')}</p>`;
    $$('.tp', svg).forEach((g) => { const on = g.dataset.id === cur; g.firstChild.setAttribute('fill', on ? T[g.dataset.id].col : '#fff'); $$('text', g).forEach((x) => x.setAttribute('style', `fill:${on ? '#fff' : ''}`)); });
    Object.entries(paths).forEach(([id, p]) => { p.setAttribute('stroke-width', id === cur ? 5 : 2.2); p.setAttribute('opacity', id === cur ? 1 : 0.35); });
    dots.forEach((c) => c.setAttribute('fill', T[cur].col));
    chipsSync();
  };
  const chipsSync = () => setPressed(box, cur);
  const sel = (id) => { cur = id; ui(); };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) sel(b.dataset.id); });
  svg.addEventListener('click', (e) => { const g = e.target.closest('.tp'); if (g) sel(g.dataset.id); });
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const g = e.target.closest('.tp'); if (g) { e.preventDefault(); sel(g.dataset.id); } } });
  const place = () => {
    const p = paths[cur], L = p.getTotalLength();
    dots.forEach((c, i) => { const q = p.getPointAtLength(((pl + i / dots.length) % 1) * L); c.setAttribute('cx', q.x); c.setAttribute('cy', q.y); });
  };
  ui(); place();
  loopWhenVisible(m, (dt) => { pl = (pl + dt * 0.22) % 1; place(); });
};

/* ================================================================ класифікація */
W.classify = (node) => {
  const m = $('[data-mount]', node);
  let cur = D.classify[0].id;
  const col = { fer: '#2E7D32', ox: '#C0392B', ar: '#2B6CB0' };
  const ui = () => {
    const c = D.classify.find((x) => x.id === cur);
    $('.fm-info', m).innerHTML = `<h4>${c.q}</h4><dl><dt>Кінцевий акцептор</dt><dd>${c.acc}</dd></dl><p><span class="fm-badge" style="--c:${col[c.verdict]}">${c.t}</span></p><p>${c.why}</p>`;
    setPressed($('.fm-chips', m), cur);
  };
  m.innerHTML = `<div class="fm-xr">${chips(D.classify.map((c) => ({ id: c.id, label: c.q.split(',')[0].split(';')[0], col: col[c.verdict] })), cur)}<div class="fm-info" style="margin-top:12px" aria-live="polite"></div></div>`;
  $('.fm-chips', m).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { cur = b.dataset.id; ui(); } });
  ui();
};

/* ================================================================ історія */
W.timeline = (node) => {
  const m = $('[data-mount]', node);
  let cur = 0;
  m.innerHTML = `<div class="fm-chips" role="group">${D.timeline.map((e, i) => `<button type="button" data-i="${i}" aria-pressed="${i === cur}" style="--c:#8A4A0A">${e.y}</button>`).join('')}</div><div class="fm-info" style="margin-top:12px" aria-live="polite"></div>`;
  const ui = () => { const e = D.timeline[cur]; $('.fm-info', m).innerHTML = `<h4>${e.y} — ${e.t}</h4><p>${e.d}</p>`; $$('button', m).forEach((b, i) => b.setAttribute('aria-pressed', String(i === cur))); };
  m.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { cur = +b.dataset.i; ui(); } });
  ui();
};

/* ================================================================ візочки NAD⁺ */
W.nad = (node) => {
  const m = $('[data-mount]', node);
  const acc = [
    { id: 'none', label: 'Немає акцептора', r: 0.02, atp: 0, col: '#7B8794', txt: 'Електрони нікуди скинути — візочки заповнюються, гліколіз гальмується.' },
    { id: 'o2', label: 'O₂ (дихання)', r: 0.9, atp: 15, col: '#2B6CB0', txt: 'Електрони йдуть дихальним ланцюгом на кисень: кожен NADH дає ≈ 15 АТФ (разом ≈ 32 на глюкозу).' },
    { id: 'lac', label: 'Піруват → лактат', r: 3.0, atp: 0, col: '#4A3A9C', txt: 'ЛДГ швидко відновлює піруват: NAD⁺ повертається, але додаткового АТФ немає (разом 2 на глюкозу).' },
    { id: 'eth', label: 'Ацетальдегід → етанол', r: 2.4, atp: 0, col: '#D9770C', txt: 'Піруватдекарбоксилаза й ADH: CO₂ іде з клітини, NAD⁺ повертається (2 АТФ на глюкозу).' },
  ];
  let cur = 'lac', f = 0, atp = 0, glc = 0, time = 0;
  m.innerHTML = `<div class="fm-xr">${chips(acc.map((a) => ({ id: a.id, label: a.label, col: a.col })), cur)}<div class="fm-stage" style="margin-top:12px"><svg viewBox="0 0 560 220" class="fm-sv" role="img" aria-label="Візочки NAD⁺ та NADH"></svg><div class="fm-info" aria-live="polite"></div></div><div class="fm-row"><button type="button" class="fm-btn fm-btn--ghost" data-reset>↺ Скинути</button><span class="fm-leg"><span style="--c:#C0392B"><i></i>NADH (повний візочок)</span><span style="--c:#fff"><i style="border:1.5px solid #46584C"></i>NAD⁺ (порожній)</span></span></div></div>`;
  const svg = $('svg', m), info = $('.fm-info', m);
  const N = 20, carts = [];
  svg.insertAdjacentHTML('beforeend', '<text x="14" y="22" class="tb">Гліколіз «навантажує» візочки</text><text x="14" y="206" class="tm">частка NADH → швидкість конвеєра гліколізу падає</text><rect x="14" y="150" width="532" height="14" rx="7" fill="#E8DDB8" stroke="#B9A468"/>');
  for (let i = 0; i < N; i++) { const g = svgEl('g', {}, svg); svgEl('rect', { width: 20, height: 14, rx: 3, stroke: '#46584C', 'stroke-width': 1.5 }, g); svgEl('circle', { cx: 5, cy: 18, r: 3, fill: '#46584C' }, g); svgEl('circle', { cx: 15, cy: 18, r: 3, fill: '#46584C' }, g); carts.push(g); }
  const bars = svgEl('g', {}, svg);
  const rr = (cur) => acc.find((a) => a.id === cur);
  const draw = () => {
    const nFull = Math.round(f * N);
    carts.forEach((g, i) => { const x = 20 + (i % 10) * 52, y = 56 + Math.floor(i / 10) * 40 + (i % 2) * 2; g.setAttribute('transform', `translate(${x} ${y})`); g.firstChild.setAttribute('fill', i < nFull ? '#C0392B' : '#fff'); });
    const a = rr(cur), flux = 1 * (1 - f);
    bars.innerHTML = `<rect x="14" y="176" width="${Math.max(2, 532 * flux)}" height="8" rx="4" fill="${a.col}"/><text x="14" y="196" class="tm">потік гліколізу: ${fmt(flux * 100, 0)} % від максимуму</text>`;
    const rate = (flux * (2 + a.atp * 2) / 2);
    info.innerHTML = `<h4>${a.label}</h4><p>${a.txt}</p><dl><dt>Частка NADH</dt><dd>${fmt(f * 100, 0)} %</dd><dt>Глюкози спожито</dt><dd>${fmt(glc, 1)}</dd><dt>АТФ накопичено</dt><dd>${fmt(atp, 0)}</dd><dt>АТФ/с (відн.)</dt><dd>${fmt(rate, 1)}</dd></dl>`;
  };
  const step = (dt) => {
    const a = rr(cur), g = 1 * (1 - f), r = a.r * f; // потік гліколізу та регенерація
    f = clamp(f + (2 * g - r) * dt * 0.8, 0, 1);
    glc += g * dt; atp += g * dt * 2 + (r * dt) * a.atp; time += dt;
  };
  m.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.reset !== undefined) { f = 0; atp = 0; glc = 0; draw(); return; } if (b.dataset.id) { cur = b.dataset.id; f = 0; atp = 0; glc = 0; setPressed(m, cur); draw(); } });
  draw();
  loopWhenVisible(m, (dt) => { step(dt); draw(); });
  if (REDUCED) { for (let i = 0; i < 200; i++) step(0.05); draw(); }
};

/* ================================================================ баланс атомів */
W.balance = (node) => {
  const m = $('[data-mount]', node);
  let cur = D.eqs[0].id, co = {};
  const atoms = (f) => { const r = {}; (f.match(/([A-Z][a-z]?)(\d*)/g) || []).forEach((x) => { const [, e, n] = x.match(/([A-Z][a-z]?)(\d*)/); r[e] = (r[e] || 0) + (n ? +n : 1); }); return r; };
  const sub = (f) => f.replace(/(\d+)/g, '<sub>$1</sub>');
  const load = () => { const q = D.eqs.find((e) => e.id === cur); co = {}; q.L.forEach((x, i) => (co['L' + i] = x[1])); q.R.forEach((x, i) => (co['R' + i] = x[1])); };
  const ui = () => {
    const q = D.eqs.find((e) => e.id === cur), tot = { L: {}, R: {} };
    const sp = (side) => q[side].map((x, i) => { const a = atoms(x[0]); for (const e in a) tot[side][e] = (tot[side][e] || 0) + a[e] * co[side + i]; return `<span class="fm-sp"><button type="button" data-k="${side}${i}" data-d="-1" aria-label="менше">−</button><b>${co[side + i]}</b><button type="button" data-k="${side}${i}" data-d="1" aria-label="більше">+</button><span class="fm-fx">${sub(x[0])} <small>${D.names[x[0]] || ''}</small></span></span>`; }).join(' + ');
    const els = ['C', 'H', 'O'], ok = els.every((e) => (tot.L[e] || 0) === (tot.R[e] || 0));
    m.querySelector('.fm-eqrow').innerHTML = `${sp('L')} <b>→</b> ${sp('R')}`;
    m.querySelector('.fm-bal').innerHTML = els.map((e) => { const a = tot.L[e] || 0, b = tot.R[e] || 0; return `<div class="${a === b ? 'fm-okc' : 'fm-badc'}"><b>${e}</b><span>${a} ⇄ ${b}</span><i>${a === b ? '✓' : '✗'}</i></div>`; }).join('');
    m.querySelector('.fm-bres').innerHTML = `<p class="${ok ? 'fm-ok' : 'fm-bad'}">${ok ? 'Рівняння збалансоване.' : 'Баланс атомів порушено.'}</p><p>${q.note}${q.wrong ? ' <b class="fm-bad">Це рівняння хибне: зменшіть коефіцієнт CO₂ до 0 — і баланс відновиться.</b>' : ''}</p>`;
    setPressed(m, cur);
  };
  m.innerHTML = `<div class="fm-xr">${chips(D.eqs.map((e) => ({ id: e.id, label: e.name, col: e.wrong ? '#C0392B' : '#B45F06' })), cur)}<div class="fm-eqrow"></div><div class="fm-bal"></div><div class="fm-bres fm-info"></div><button type="button" class="fm-btn fm-btn--ghost" data-reset>↺ Початкові коефіцієнти</button></div>`;
  m.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.id) { cur = b.dataset.id; load(); ui(); } else if (b.dataset.reset !== undefined) { load(); ui(); } else if (b.dataset.k) { co[b.dataset.k] = clamp(co[b.dataset.k] + +b.dataset.d, 0, 12); ui(); }
  });
  load(); ui();
};

/* ================================================================ енергетика */
W.energy = (node) => {
  const m = $('[data-mount]', node);
  const P = [
    { id: 'eth', label: 'Спиртове', dg: 251, atp: 2, min: 1, max: 3, col: '#D9770C' },
    { id: 'lac', label: 'Молочнокисле (гомо-)', dg: 185, atp: 2, min: 1, max: 3, col: '#2B6CB0' },
    { id: 'het', label: 'Фосфокетолазне', dg: 187, atp: 1, min: 1, max: 3, col: '#4A3A9C' },
    { id: 'res', label: 'Дихання', dg: 2870, atp: 32, min: 28, max: 36, col: '#2E7D32' },
  ];
  let cur = 'lac'; const vals = Object.fromEntries(P.map((p) => [p.id, p.atp]));
  m.innerHTML = `<div class="fm-xr">${chips(P.map((p) => ({ id: p.id, label: p.label, col: p.col })), cur)}<div class="fm-row"><label class="fm-ctl">АТФ на молекулу глюкози: <output></output><input type="range" step="0.5"></label></div><div class="fm-info out"></div><div class="fm-glc" aria-hidden="true"></div></div>`;
  const rng = $('input', m), outp = $('output', m), out = $('.out', m), gl = $('.fm-glc', m);
  const ui = () => {
    const p = P.find((x) => x.id === cur); rng.min = p.min; rng.max = p.max; rng.value = vals[cur]; outp.textContent = fmt(vals[cur], 1);
    const n = vals[cur], eff = n * 30.5 / p.dg * 100, need = 32 / n, share = p.dg / 2870 * 100;
    out.innerHTML = `<dl><dt>Вивільнено енергії</dt><dd>${p.dg} кДж/моль (${fmt(share, 1)} % від повного окиснення)</dd><dt>Запасається в АТФ</dt><dd><b>${fmt(eff, 0)} %</b> (${fmt(n, 1)} × 30,5 / ${p.dg})</dd><dt>Глюкози для 32 АТФ</dt><dd><b>${fmt(need, need % 1 ? 1 : 0)}</b> молекул замість 1 при диханні</dd></dl><p class="fm-hint">Ефективність запасання схожа (≈ 26–34 %), різниця — у кількості енергії, що вивільняється з однієї молекули.</p>`;
    gl.innerHTML = Array.from({ length: Math.min(40, Math.ceil(need)) }, () => `<svg viewBox="0 0 22 22" width="26" height="26"><rect x="2" y="3" width="18" height="16" rx="5" fill="#FFF4DC" stroke="${p.col}" stroke-width="2"/><text x="11" y="15" text-anchor="middle" font-size="9" font-weight="800" fill="#46584C">C₆</text></svg>`).join('');
    setPressed(m, cur);
  };
  m.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.id) { cur = b.dataset.id; ui(); } });
  rng.addEventListener('input', () => { vals[cur] = +rng.value; ui(); });
  ui();
};

/* ================================================================ покроковий шлях */
W.pathway = (node) => {
  const m = $('[data-mount]', node), t = T[m.dataset.type], S = t.steps;
  let cur = -1, auto = 0;
  m.style.setProperty('--c', t.col);
  m.innerHTML = `<div class="fm-pw">${t.basis ? `<p class="fm-hint">Баланс ${t.basis}.</p>` : ''}<ol class="fm-pw__steps"></ol><div class="fm-pw__ledger"></div><div class="fm-info out" aria-live="polite"></div><div class="fm-row"><button type="button" class="fm-btn" data-a="next">Далі ▶</button><button type="button" class="fm-btn fm-btn--ghost" data-a="play">⏵ Автоматично</button><button type="button" class="fm-btn fm-btn--ghost" data-a="reset">↺ Спочатку</button></div></div>`;
  const ol = $('.fm-pw__steps', m), led = $('.fm-pw__ledger', m), out = $('.out', m);
  const ui = () => {
    let e = 0, a = 0, gas = [];
    S.forEach((s, i) => { if (i <= cur) { e += s.e; a += s.atp; if (s.gas && !gas.includes(s.gas)) gas.push(s.gas); } });
    ol.innerHTML = S.map((s, i) => `<li data-i="${i}" class="${i <= cur ? 'on' : ''}${i === cur ? ' cur' : ''}"><span class="fm-pw__n">${i + 1}</span><div><b>${s.n}</b><small>${s.enz} · <i>${s.cof}</i></small></div><span class="fm-pw__d">${s.e ? `<i style="color:${s.e > 0 ? '#C0392B' : '#2B6CB0'}">${s.e > 0 ? '+' : '−'}${Math.abs(s.e)} e-пар</i>` : ''}${s.atp ? `<i style="color:#B45F06">${s.atp > 0 ? '+' : '−'}${Math.abs(s.atp)} АТФ</i>` : ''}</span></li>`).join('');
    const hasATP = !['acetic', 'citric'].includes(t.id);
    led.innerHTML = `<div><b style="color:${e === 0 && cur === S.length - 1 ? '#2E7D32' : e > 0 ? '#C0392B' : '#2B6CB0'}">${e > 0 ? '+' : ''}${e}</b><small>електронних пар (NADH-екв.) «в обігу»</small></div>${hasATP ? `<div><b style="color:#B45F06">${a > 0 ? '+' : ''}${a}</b><small>АТФ (субстратне фосфорилювання)</small></div>` : '<div><b>—</b><small>АТФ: окисним фосфорилюванням, кількість не визначена</small></div>'}<div><b>${gas.join(' · ') || '—'}</b><small>газ</small></div>`;
    const s = S[cur];
    out.innerHTML = cur < 0 ? '<p>Натисніть «Далі», щоб пройти шлях від субстрату до продукту.</p>' : `<h4>${cur + 1}. ${s.n}</h4><p><b>Реакція:</b> ${s.rx}</p><p><b>Фермент:</b> ${s.enz}<br><b>Кофактор:</b> ${s.cof}</p>${s.mol ? `<p>${MOL(s.mol, 76)}</p>` : ''}${cur === S.length - 1 ? `<p class="${e === 0 ? 'fm-ok' : 'fm-bad'}">${e === 0 ? 'Баланс замкнено: усі електрони, що з’явилися, віддано акцептору.' : 'Баланс електронів не замкнено.'}</p>` : ''}`;
  };
  const go = (i) => { cur = clamp(i, -1, S.length - 1); ui(); };
  m.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]'); if (li) return go(+li.dataset.i);
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'next') go(cur >= S.length - 1 ? 0 : cur + 1);
    else if (b.dataset.a === 'reset') { go(-1); clearInterval(auto); auto = 0; }
    else if (b.dataset.a === 'play') { clearInterval(auto); go(-1); auto = setInterval(() => { if (cur >= S.length - 1) { clearInterval(auto); auto = 0; } else go(cur + 1); }, 1500); }
  });
  ui();
};

/* ================================================================ партія дріжджів */
W.yeast = (node) => {
  const m = $('[data-mount]', node);
  const st = { s0: 100, o2: false, temp: 30 };
  m.innerHTML = `<div class="fm-xr"><div class="fm-row"><label class="fm-ctl">Початкова глюкоза, г/л: <output data-o="s0"></output><input type="range" data-k="s0" min="0.5" max="200" step="0.5"></label><label class="fm-ctl">Температура, °C: <output data-o="temp"></output><input type="range" data-k="temp" min="10" max="45" step="1"></label><label class="fm-check"><input type="checkbox" data-k="o2"> Аерація (O₂ є)</label></div><svg viewBox="0 0 640 260" class="fm-sv fm-sv--wide" role="img" aria-label="Графік партії дріжджів"></svg><div class="fm-info out" aria-live="polite"></div></div>`;
  const svg = $('svg', m), out = $('.out', m);
  const run = () => {
    const tf = Math.exp(-(((st.temp - 31) / 7) ** 2)), Emax = 110, dt = 0.05, H = 48;
    let S = st.s0, X = 0.2, E = 0, ethMax = 0, resp = 0, ferm = 0, Sdep = null; const pts = [];
    for (let t = 0; t <= H; t += dt) {
      const qs = 3 * S / (0.5 + S) * tf * Math.sqrt(Math.max(0, 1 - E / Emax));
      const qr = st.o2 ? Math.min(qs, 0.9 * tf) : 0, qf = qs - qr;
      let mu = 0.5 * qr + 0.1 * qf, dE = 0.45 * qf;
      if (st.o2 && S < 1 && E > 0.05) { const qe = 0.25 * E / (E + 2) * tf; dE -= qe; mu += 0.4 * qe; }
      const dS = -qs * X, dX = (mu - 0.01) * X;
      S = Math.max(0, S + dS * dt); X = Math.max(0, X + dX * dt); E = Math.max(0, E + dE * X * dt);
      resp += qr * X * dt; ferm += qf * X * dt; ethMax = Math.max(ethMax, E); if (Sdep === null && S < 0.5 && t > 0) Sdep = t;
      if (Math.round(t / dt) % 10 === 0) pts.push([t, S, X, E]);
    }
    const ymax = Math.max(st.s0, ethMax, 10), px = (t) => 50 + (t / H) * 570, py = (v) => 222 - (v / ymax) * 196;
    const line = (i, col) => `<polyline fill="none" stroke="${col}" stroke-width="3" points="${pts.map((p) => px(p[0]).toFixed(1) + ',' + py(p[i]).toFixed(1)).join(' ')}"/>`;
    svg.innerHTML = `<rect x="50" y="26" width="570" height="196" fill="#FFFCF4" stroke="#E4DCCA"/>${[0, 0.25, 0.5, 0.75, 1].map((k) => `<text x="44" y="${222 - k * 196 + 4}" text-anchor="end" class="tm">${fmt(k * ymax, ymax > 20 ? 0 : 1)}</text>`).join('')}${[0, 12, 24, 36, 48].map((h) => `<text x="${px(h)}" y="240" text-anchor="middle" class="tm">${h} год</text>`).join('')}${line(1, '#C9951B')}${line(2, '#2E7D32')}${line(3, '#D9770C')}<text x="50" y="16" class="ts">г/л</text><g class="ts"><circle cx="360" cy="14" r="5" fill="#C9951B"/><text x="370" y="18" class="ts">глюкоза</text><circle cx="440" cy="14" r="5" fill="#D9770C"/><text x="450" y="18" class="ts">етанол</text><circle cx="520" cy="14" r="5" fill="#2E7D32"/><text x="530" y="18" class="ts">біомаса</text></g>`;
    const used = st.s0 - S, yE = used > 0 ? ethMax / used / 0.511 * 100 : 0;
    let reg;
    if (!st.o2) reg = '<b>Анаеробне бродіння:</b> усі електрони скидаються на ацетальдегід, АТФ мало, біомаси мало, етанолу багато.';
    else if (ethMax < 2) reg = '<b>Ефект Пастера:</b> кисень пригнічує бродіння — дріжджі дихають, ростуть швидко, етанол майже не накопичується.';
    else reg = '<b>Ефект Кребтрі:</b> навіть із киснем за високої концентрації глюкози дихальна здатність обмежена, і дріжджі «переливають» надлишок у етанол; коли цукор закінчується, вони споживають етанол (діауксія).';
    out.innerHTML = `<p>${reg}</p><dl><dt>Пік етанолу</dt><dd>${fmt(ethMax, 1)} г/л</dd><dt>Вихід від теоретичного (0,511 г/г)</dt><dd>${fmt(yE, 0)} %</dd><dt>Кінцева біомаса</dt><dd>${fmt(X, 1)} г/л</dd><dt>Глюкоза вичерпана</dt><dd>${Sdep ? 'після ' + fmt(Sdep, 0) + ' год' : 'ні (за 48 год)'}</dd></dl><p class="fm-hint">${st.temp > 38 ? 'Понад 38–40 °C дріжджі гинуть (T<sub>max</sub> 39–41 °C).' : st.temp < 15 ? 'Холодне бродіння повільне: так зберігають аромат пива, сидру й білих вин (10–25 °C).' : 'Оптимум росту <i>S. cerevisiae</i> — 28–33 °C. Модель навчальна, якісна.'}</p>`;
  };
  const sync = () => { $$('input[data-k]', m).forEach((i) => { const k = i.dataset.k; if (i.type === 'checkbox') i.checked = st[k]; else i.value = st[k]; }); $$('[data-o]', m).forEach((o) => (o.textContent = fmt(st[o.dataset.o], st[o.dataset.o] % 1 ? 1 : 0))); };
  m.addEventListener('input', (e) => { const i = e.target; if (!i.dataset.k) return; st[i.dataset.k] = i.type === 'checkbox' ? i.checked : +i.value; sync(); run(); });
  sync(); run();
};

/* ================================================================ оцтовокисла бактерія */
W.acetic = (node) => {
  const m = $('[data-mount]', node);
  const st = { o2: true, etoh: true }; let tick = 0;
  m.innerHTML = `<div class="fm-xr"><div class="fm-row"><label class="fm-check"><input type="checkbox" data-k="o2" checked> Кисень (O₂)</label><label class="fm-check"><input type="checkbox" data-k="etoh" checked> Етанол у середовищі</label></div><div class="fm-stage"><svg viewBox="0 0 520 340" class="fm-sv" role="img" aria-label="Периплазматичне окиснення етанолу"></svg><div class="fm-info out" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), out = $('.out', m);
  svg.innerHTML = `<rect x="10" y="10" width="500" height="320" rx="40" fill="#FFFCF4" stroke="#B9A468" stroke-width="2"/><rect x="40" y="46" width="440" height="250" rx="30" fill="#EAF3FA" stroke="#2B6CB0" stroke-width="2.5"/><rect x="40" y="46" width="440" height="90" rx="30" fill="#FFE9E5" opacity=".75"/><rect x="40" y="136" width="440" height="22" fill="#F7C873" stroke="#C9951B" stroke-width="2"/><text x="260" y="32" text-anchor="middle" class="tm">зовнішня мембрана · середовище</text><text x="260" y="66" text-anchor="middle" class="ts" style="fill:#C0392B">периплазма — тут окиснюється етанол</text><text x="260" y="184" text-anchor="middle" class="tm">цитоплазматична мембрана: PQQ-ADH · ALDH · убіхінон · оксидаза</text><text x="260" y="286" text-anchor="middle" class="ts">цитоплазма</text><g><rect x="90" y="112" width="86" height="34" rx="8" fill="#C0392B"/><text x="133" y="133" text-anchor="middle" class="tb" style="fill:#fff">PQQ-ADH</text><rect x="214" y="112" width="76" height="34" rx="8" fill="#B8470B"/><text x="252" y="133" text-anchor="middle" class="tb" style="fill:#fff">ALDH</text><rect x="362" y="112" width="86" height="34" rx="8" fill="#2B6CB0"/><text x="405" y="133" text-anchor="middle" class="tb" style="fill:#fff">оксидаза</text></g><ellipse cx="300" cy="206" rx="52" ry="14" fill="#CFE6F5" stroke="#2B6CB0"/><text x="300" y="210" text-anchor="middle" class="ts">убіхінон UQ/UQH₂</text><g id="ac-cyto"><rect x="150" y="226" width="220" height="48" rx="12" fill="#fff" stroke="#46584C" stroke-dasharray="6 4"/><text x="260" y="248" text-anchor="middle" class="tb">цикл Кребса</text><text x="260" y="265" text-anchor="middle" class="tm">працює лише для «переокиснення»</text></g>`;
  const mk = (n, col, r = 6) => Array.from({ length: n }, () => svgEl('circle', { r, fill: col }, svg));
  const eth = mk(5, '#D9770C'), ald = mk(3, '#B8470B'), ace = mk(5, '#C0392B'), el = mk(4, '#FFD54A', 4), co2 = mk(4, '#8A9BA8', 5), wat = mk(2, '#2B6CB0', 5);
  const lab = svgEl('text', { x: 260, y: 318, 'text-anchor': 'middle', class: 'ts' }, svg);
  const upd = () => {
    const on = st.o2 && st.etoh, rate = on ? 1 : 0;
    eth.forEach((c, i) => { const p = (tick * 0.25 + i / eth.length) % 1; c.setAttribute('cx', 50 + 80 * p + (i % 2) * 12); c.setAttribute('cy', 38 + 62 * p); c.setAttribute('opacity', st.etoh ? 1 : 0); });
    ald.forEach((c, i) => { const p = (tick * 0.25 + i / ald.length + 0.1) % 1; c.setAttribute('cx', 150 + 100 * p); c.setAttribute('cy', 98 + (i % 2) * 8); c.setAttribute('opacity', rate); });
    ace.forEach((c, i) => { const p = (tick * 0.25 + i / ace.length) % 1; c.setAttribute('cx', 290 + 170 * p); c.setAttribute('cy', 100 - 56 * p + (i % 2) * 6); c.setAttribute('opacity', rate * (1 - 0.3 * p)); });
    el.forEach((c, i) => { const p = (tick * 0.35 + i / el.length) % 1; c.setAttribute('cx', 150 + 240 * p); c.setAttribute('cy', 170 + 16 * Math.sin(p * Math.PI)); c.setAttribute('opacity', rate); });
    wat.forEach((c, i) => { const p = (tick * 0.3 + i / 2) % 1; c.setAttribute('cx', 420 + 18 * i); c.setAttribute('cy', 170 + 30 * p); c.setAttribute('opacity', rate * (1 - p)); });
    const over = st.o2 && !st.etoh;
    co2.forEach((c, i) => { const p = (tick * 0.3 + i / co2.length) % 1; c.setAttribute('cx', 180 + 40 * i + 6 * Math.sin(p * 9)); c.setAttribute('cy', 232 - 190 * p); c.setAttribute('opacity', over ? 1 - p : 0); });
    $('#ac-cyto', svg).setAttribute('opacity', over ? 1 : 0.35);
    lab.textContent = !st.o2 ? 'Без кисню: електрони нікуди йти — продукція зупиняється' : !st.etoh ? 'Етанол вичерпано: бактерії окиснюють ацетат до CO₂ («переокиснення»)' : 'C₂H₅OH → CH₃CHO → CH₃COOH; електрони → UQ → O₂';
  };
  const ui = () => {
    const on = st.o2 && st.etoh;
    out.innerHTML = `<h4>${on ? 'Окиснення триває' : !st.o2 ? 'Гіпоксія' : 'Етанол вичерпано'}</h4><p>${on ? 'Етанол окиснюється <b>на зовнішньому боці</b> цитоплазматичної мембрани: PQQ-ADH → ALDH, електрони через убіхінон йдуть на оксидазу bo₃ (за нейтрального pH) або bd (за низького pH). Протонрушійна сила живить АТФ-синтазу.' : !st.o2 ? 'Облігатні аероби: O₂ — кінцевий акцептор електронів. Гіпоксія знижує продукцію оцтової кислоти й може вбити клітини.' : 'Коли етанол вичерпується, <i>Acetobacter</i> і <i>Komagataeibacter</i> окиснюють накопичений ацетат через цикл трикарбонових кислот: CH₃COOH + 2 O₂ → 2 CO₂ + 2 H₂O. <i>Gluconobacter</i> цього не робить.'}</p><dl><dt>Тип процесу</dt><dd>аеробне окиснення (не справжнє бродіння)</dd><dt>АТФ</dt><dd>лише окисним фосфорилюванням</dd></dl>`;
  };
  m.addEventListener('change', (e) => { const i = e.target; if (i.dataset.k) { st[i.dataset.k] = i.checked; ui(); upd(); } });
  ui(); upd();
  loopWhenVisible(m, (dt) => { tick += dt; upd(); });
};

/* ================================================================ Lactococcus */
W.lactis = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="fm-xr"><label class="fm-ctl">Швидкість гліколітичного потоку (цукор): <output></output><input type="range" min="0" max="100" value="80"></label><div class="fm-out"></div></div>`;
  const rng = $('input', m), o = $('output', m), out = $('.fm-out', m);
  const ui = () => {
    const J = +rng.value, h = 1 / (1 + Math.exp(-(J - 45) / 9)), ratio = 0.08 + 0.7 * (J / 100) ** 1.4;
    const lac = 2 * h, form = 2 * (1 - h), ace = 1 - h, eth = 1 - h, atp = 2 + (1 - h);
    o.textContent = J < 33 ? `${J} % · повільні цукри (лактоза, галактоза)` : J < 66 ? `${J} %` : `${J} % · багато глюкози`;
    const bar = (n, v, col, max = 2) => `<div class="fm-brow"><span>${n}</span><div class="fm-bar" style="--c:${col}"><i style="width:${v / max * 100}%"></i></div><b>${fmt(v, 2)}</b></div>`;
    out.innerHTML = `<div class="fm-info"><h4>${h > 0.5 ? 'Гомолактатне бродіння' : 'Змішане кислотне бродіння'}</h4><p>${h > 0.5 ? 'Швидкий потік і висока NADH/NAD⁺: ЛДГ активна, піруват-форміат-ліаза пригнічена тріозофосфатами.' : 'Повільні цукри: ЛДГ пригнічена співвідношенням NADH/NAD⁺, піруват іде через піруват-форміат-ліазу; ацетил-КоА → ацетилфосфат → ацетат дає додатковий АТФ.'}</p>${bar('лактат', lac, '#2B6CB0')}${bar('форміат', form, '#2E7D32')}${bar('ацетат', ace, '#C0392B', 1)}${bar('етанол', eth, '#D9770C', 1)}<dl><dt>NADH/NAD⁺ (відн.)</dt><dd>${fmt(ratio, 2)}</dd><dt>АТФ на глюкозу</dt><dd>${fmt(atp, 1)}</dd></dl><p class="fm-hint">Продукти — моль на моль глюкози. Якісна модель за даними Garrigues et al. (1997).</p></div>`;
  };
  rng.addEventListener('input', ui); ui();
};

/* ================================================================ цикл Вуда–Веркмана */
W.propcycle = (node) => {
  const m = $('[data-mount]', node);
  const N = [
    ['1', 'Транскарбоксилаза', 'біотин', '(S)-метилмалоніл-КоА + піруват → пропіоніл-КоА + оксалоацетат', 'Передає COO⁻ прямо на піруват — без вільного CO₂ та без витрати АТФ.'],
    ['2', 'Малатдегідрогеназа', 'NADH', 'Оксалоацетат → малат', 'Тут і на наступній відновній стадії «спалюються» електрони гліколізу.'],
    ['3', 'Фумараза', '—', 'Малат → фумарат + H₂O', 'Дегідратація без окисно-відновного балансу.'],
    ['4', 'Фумаратредуктаза', 'менахінон, цитохроми', 'Фумарат → сукцинат', 'Мембранний фермент: електронтранспортне фосфорилювання (≈ ⅔–1 АТФ).'],
    ['5', 'Пропіоніл-КоА:сукцинат-КоА-трансфераза', '—', 'Сукцинат + пропіоніл-КоА → сукциніл-КоА + <b>пропіонат</b>', 'Саме тут цикл «випускає» продукт — пропіонат.'],
    ['6', 'Метилмалоніл-КоА-мутаза', 'аденозилкобаламін (B₁₂)', 'Сукциніл-КоА → (R)-метилмалоніл-КоА', 'Ізомеризація, для якої потрібен вітамін B₁₂.'],
    ['7', 'Метилмалоніл-КоА-епімераза', '—', '(R)- → (S)-метилмалоніл-КоА', 'Повертає (S)-форму на етап 1 — цикл замкнено.'],
  ];
  const st = { b12: true, biotin: true, i: 0 }; let ang = 0;
  m.innerHTML = `<div class="fm-xr"><div class="fm-row"><label class="fm-check"><input type="checkbox" data-k="b12" checked> Вітамін B₁₂ (кобальт)</label><label class="fm-check"><input type="checkbox" data-k="biotin" checked> Біотин</label><button type="button" class="fm-btn" data-n>Крок ▶</button></div><div class="fm-stage"><svg viewBox="0 0 440 400" class="fm-sv" role="img" aria-label="Цикл Вуда–Веркмана"></svg><div class="fm-info out" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), out = $('.out', m), cx = 220, cy = 190, R = 130;
  const pos = (i) => { const a = -Math.PI / 2 + (i / 7) * Math.PI * 2; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
  const dot = svgEl('circle', { r: 9, fill: '#C0392B', stroke: '#fff', 'stroke-width': 2 });
  const blocked = (i) => (i === 0 && !st.biotin) || (i === 5 && !st.b12);
  const draw = () => {
    let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#E0B13C" stroke-width="3" stroke-dasharray="6 5"/><text x="${cx}" y="${cy - 4}" text-anchor="middle" class="tb">метилмалоніл-КоА</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" class="tb">цикл</text>`;
    const stop = st.i; const fail = [0, 1, 2, 3, 4, 5, 6].findIndex((i) => blocked(i));
    N.forEach((n, i) => { const [x, y] = pos(i), bl = blocked(i), after = fail >= 0 && i > fail, on = i === st.i; s += `<g class="tp" data-i="${i}" tabindex="0" role="button" aria-label="${n[1]}"><circle cx="${x}" cy="${y}" r="26" fill="${bl ? '#FDECEC' : on ? '#2E7D32' : '#fff'}" stroke="${bl ? '#C0392B' : '#2E7D32'}" stroke-width="3" opacity="${after ? 0.35 : 1}"/><text x="${x}" y="${y + 6}" text-anchor="middle" class="tb" style="fill:${on ? '#fff' : bl ? '#C0392B' : '#1f4f25'}">${n[0]}</text></g>`; });
    const LB = ['транскарбоксилаза', 'малатдегідрогеназа', 'фумараза', 'фумаратредуктаза', 'КоА-трансфераза → пропіонат', 'мутаза (B₁₂)', 'епімераза'];
    N.forEach((n, i) => { const [x, y] = pos(i), dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy), tx = x + dx / L * 40, ty = y + dy / L * 40 + 4; s += `<text x="${tx}" y="${ty}" text-anchor="${Math.abs(dx) < 20 ? 'middle' : dx > 0 ? 'start' : 'end'}" class="tm" style="fill:#46584C;font-size:11px">${LB[i]}</text>`; });
    s += `<text x="${cx - 120}" y="38" class="ts" style="fill:#2B6CB0">піруват →</text><text x="${cx + 118}" y="${pos(4)[1] + 44}" class="ts" style="fill:#C0392B">→ пропіонат</text>`;
    svg.innerHTML = s + `<text x="${cx}" y="388" text-anchor="middle" class="tm">клацайте вузли або кнопку «Крок»</text>`; svg.append(dot);
  };
  const ui = () => {
    const n = N[st.i], bl = blocked(st.i), fail = [0, 1, 2, 3, 4, 5, 6].findIndex((i) => blocked(i));
    out.innerHTML = `<h4>${n[0]}. ${n[1]}</h4><dl><dt>Кофактор</dt><dd>${n[2]}</dd><dt>Реакція</dt><dd>${n[3]}</dd></dl><p>${n[4]}</p>${fail >= 0 ? `<p class="fm-bad">Цикл зупинено на етапі ${fail + 1}: ${fail === 0 ? 'без біотину транскарбоксилаза не працює' : 'без B₁₂ мутаза не ізомеризує сукциніл-КоА'}. Пропіонат не утворюється, електрони нікуди не діваються — клітина накопичує лактат/сукцинат.</p>` : '<p class="fm-ok">Цикл працює: на 3 глюкози — 4 пропіонат + 2 ацетат + 2 CO₂ (2 : 1).</p>'}${bl ? '<p class="fm-bad">Цей етап заблоковано.</p>' : ''}`;
    draw();
  };
  m.addEventListener('change', (e) => { const i = e.target; if (i.dataset.k) { st[i.dataset.k] = i.checked; ui(); } });
  m.addEventListener('click', (e) => { if (e.target.closest('[data-n]')) { st.i = (st.i + 1) % 7; ui(); return; } const g = e.target.closest('.tp'); if (g) { st.i = +g.dataset.i; ui(); } });
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const g = e.target.closest('.tp'); if (g) { e.preventDefault(); st.i = +g.dataset.i; ui(); } } });
  ui();
  loopWhenVisible(m, (dt) => { ang = (ang + dt * 0.15) % 1; const fail = [0, 1, 2, 3, 4, 5, 6].findIndex((i) => blocked(i)); const lim = fail >= 0 ? fail / 7 : 1; const a = -Math.PI / 2 + Math.min(ang, lim) * Math.PI * 2; dot.setAttribute('cx', cx + R * Math.cos(a)); dot.setAttribute('cy', cy + R * Math.sin(a)); });
};

/* ================================================================ сир у розрізі */
W.cheese = (node) => {
  const m = $('[data-mount]', node);
  const st = { days: 60, temp: 22, spores: 1, lyso: false };
  m.innerHTML = `<div class="fm-xr"><div class="fm-row"><label class="fm-ctl">Дозрівання, діб: <output data-o="days"></output><input type="range" data-k="days" min="0" max="90" step="1"></label><label class="fm-ctl">Температура камери, °C: <output data-o="temp"></output><input type="range" data-k="temp" min="4" max="26" step="1"></label><label class="fm-ctl">Спори клостридій, log MPN/л молока: <output data-o="spores"></output><input type="range" data-k="spores" min="0" max="4.5" step="0.1"></label><label class="fm-check"><input type="checkbox" data-k="lyso"> Лізоцим у молоці</label></div><div class="fm-stage"><svg viewBox="0 0 360 330" class="fm-sv" role="img" aria-label="Розріз сиру"></svg><div class="fm-info out" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), out = $('.out', m);
  let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const eyes = Array.from({ length: 16 }, () => { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 130; return [180 + r * Math.cos(a), 165 + r * Math.sin(a), 0.5 + rnd() * 0.5]; });
  const cracks = Array.from({ length: 26 }, () => { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 125, L = 14 + rnd() * 30, b = rnd() * 6.283; return [180 + r * Math.cos(a), 165 + r * Math.sin(a), b, L, rnd()]; });
  const run = () => {
    const warm = clamp((st.temp - 14) / 8), A = warm * clamp(st.days / 45);
    const risk = st.spores >= 2.8, ok = !risk || (st.lyso && st.spores <= 3.7), blow = risk && !ok;
    const act = blow ? clamp(st.days / 40) * clamp((st.temp - 8) / 14) : 0;
    let s = `<defs><clipPath id="chz"><circle cx="180" cy="165" r="150"/></clipPath></defs><circle cx="180" cy="165" r="156" fill="#D9B779"/><circle cx="180" cy="165" r="150" fill="#F6E3A6"/><g clip-path="url(#chz)">`;
    eyes.forEach((e) => { const r = A * (5 + e[2] * 11); if (r > 1.5) s += `<circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="${r.toFixed(1)}" fill="#E4C56E" stroke="#C9A24B" stroke-width="2"/><circle cx="${(e[0] - r * 0.25).toFixed(1)}" cy="${(e[1] - r * 0.25).toFixed(1)}" r="${(r * 0.45).toFixed(1)}" fill="#F3DE98" opacity=".7"/>`; });
    cracks.forEach((c) => { if (c[4] < act) s += `<path d="M${c[0].toFixed(1)} ${c[1].toFixed(1)}l${(Math.cos(c[2]) * c[3] * act).toFixed(1)} ${(Math.sin(c[2]) * c[3] * act).toFixed(1)}l${(Math.cos(c[2] + 1) * 8).toFixed(1)} ${(Math.sin(c[2] + 1) * 8).toFixed(1)}" stroke="#8A6A22" stroke-width="${(1.5 + act * 2).toFixed(1)}" fill="none" stroke-linecap="round"/>`; });
    svg.innerHTML = s + `</g><text x="180" y="326" text-anchor="middle" class="tm">схематичний розріз головки</text>`;
    const co2 = A * 120 * (blow ? 1 : 1);
    out.innerHTML = `<h4>${blow ? 'Пізнє спучування (маслянокислі клостридії)' : A > 0.15 ? 'Швейцарський сир з «очками»' : 'Молодий сир'}</h4><p>${blow ? '<i>C. tyrobutyricum</i> зброджує лактат до бутирату, ацетату, H₂ і CO₂ — у сирі з’являються тріщини, щілини, неправильні очки й різкий запах.' : A > 0.15 ? '<i>P. freudenreichii</i> у теплій камері (≈ 20–24 °C) зброджує лактат до пропіонату, ацетату й CO₂. Газ утворює круглі «очки», а кислоти — солодкувато-горіховий смак.' : 'Пропіоновокислі бактерії ще не розгорнулись: холодно або мало часу.'}</p><dl><dt>CO₂ (80-кг голова)</dt><dd>≈ ${fmt(co2, 0)} л <small>(до 120 л)</small></dd><dt>Ризик вади</dt><dd>${risk ? (ok ? 'спор небагато для лізоциму — захист працює' : '<span class="fm-bad">≥ 2,8 log MPN/л без захисту</span>') : 'низький'}</dd></dl><p class="fm-hint">Лізоцим працює до ≈ 5000 спор/л (≈ 3,7 log). Схематична навчальна модель.</p>`;
  };
  const sync = () => { $$('input[data-k]', m).forEach((i) => { const k = i.dataset.k; if (i.type === 'checkbox') i.checked = st[k]; else i.value = st[k]; }); $$('[data-o]', m).forEach((o) => (o.textContent = fmt(st[o.dataset.o], st[o.dataset.o] % 1 ? 1 : 0))); };
  m.addEventListener('input', (e) => { const i = e.target; if (!i.dataset.k) return; st[i.dataset.k] = i.type === 'checkbox' ? i.checked : +i.value; sync(); run(); });
  sync(); run();
};

/* ================================================================ біфуркація */
W.bifurc = (node) => {
  const m = $('[data-mount]', node);
  const st = { bif: true, sink: 'h2' }; let tick = 0;
  m.innerHTML = `<div class="fm-xr"><div class="fm-row"><label class="fm-check"><input type="checkbox" data-k="bif" checked> Біфуркація (Bcd–EtfAB)</label>${chips([{ id: 'h2', label: 'Fd → H₂ (гідрогеназа)', col: '#7A3FB5' }, { id: 'rnf', label: 'Fd → Rnf → АТФ', col: '#2E7D32' }], st.sink, 'data-s')}</div><div class="fm-stage"><svg viewBox="0 0 560 380" class="fm-sv" role="img" aria-label="Енергетична діаграма флавінової біфуркації"></svg><div class="fm-info out" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), out = $('.out', m);
  const Y = { fd: 50, nadh: 150, cro: 320 }, FX = 250, FY = 232;
  svg.innerHTML = `<text x="14" y="18" class="ts">вище — більше енергії електронів (E°′, мВ)</text><path d="M30 28V360" stroke="#46584C" stroke-width="2"/>` + [['fd', 'Fd відн. ≈ −410…−420', '#7A3FB5'], ['nadh', 'NADH/NAD⁺ −320', '#C0392B'], ['cro', 'кротоніл-КоА → бутирил-КоА ≈ −10', '#2B6CB0']].map(([k, t, c]) => `<line x1="30" x2="548" y1="${Y[k]}" y2="${Y[k]}" stroke="${c}" stroke-dasharray="5 4" opacity=".55"/><text x="40" y="${Y[k] - 6}" class="ts" style="fill:${c}">${t}</text>`).join('') + `<path d="M70 ${Y.nadh}L${FX} ${FY}" stroke="#C0392B" stroke-width="2" opacity=".35" fill="none"/><path d="M${FX} ${FY}L350 ${Y.fd}" stroke="#7A3FB5" stroke-width="2" stroke-dasharray="5 4" opacity=".6" fill="none"/><path d="M${FX} ${FY}L210 ${Y.cro}" stroke="#2B6CB0" stroke-width="2" stroke-dasharray="5 4" opacity=".6" fill="none"/><rect x="${FX - 70}" y="${FY - 22}" width="140" height="44" rx="12" fill="#FFF1C9" stroke="#C9951B" stroke-width="2.5"/><text x="${FX}" y="${FY - 3}" text-anchor="middle" class="tb">Bcd–EtfAB</text><text x="${FX}" y="${FY + 13}" text-anchor="middle" class="tm">флавін-біфуркатор</text>`;
  const el = Array.from({ length: 6 }, () => svgEl('circle', { r: 6, fill: '#FFD54A', stroke: '#C9951B', 'stroke-width': 1.5 }, svg));
  const lab = svgEl('g', {}, svg);
  const draw = () => {
    el.forEach((c, i) => {
      const p = (tick * 0.3 + (i % 3) / 3) % 1, up = i % 2 === 0;
      let x, y; c.setAttribute('opacity', 1);
      if (p < 0.4) { const q = p / 0.4; x = 70 + (FX - 70) * q; y = Y.nadh + (FY - Y.nadh) * q; }
      else { const q = (p - 0.4) / 0.6; const goUp = st.bif && up; const tx = goUp ? 350 : 210, ty = goUp ? Y.fd : Y.cro; x = FX + (tx - FX) * q; y = FY + (ty - FY) * q; if (!st.bif && i >= 4) c.setAttribute('opacity', 0); }
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('fill', st.bif && up && p >= 0.4 ? '#B38DE5' : '#FFD54A');
    });
    const dGc = -2 * 96.485 * 0.31, dGf = 2 * 96.485 * 0.1;
    lab.innerHTML = st.bif ? `<text x="362" y="${Y.fd + 4}" class="ts" style="fill:#7A3FB5">+${fmt(dGf, 0)} кДж/моль (ендергонічно)</text><text x="222" y="${Y.cro + 24}" class="ts" style="fill:#2B6CB0">${fmt(dGc, 0)} кДж/моль (екзергонічно)</text>` : `<text x="222" y="${Y.cro + 24}" class="ts" style="fill:#C0392B">уся енергія розсіюється як тепло</text>`;
  };
  const ui = () => {
    const dGc = -2 * 96.485 * 0.31, dGf = 2 * 96.485 * 0.1;
    out.innerHTML = st.bif ? `<h4>Із біфуркацією</h4><p>Дві пари електронів NADH (−320 мВ) зустрічаються на флавіні. Одна пара «падає» до кротоніл-КоА (−10 мВ) і віддає енергію, інша «підштовхується вгору» до фередоксину (≈ −410…−420 мВ).</p><p><b>2 NADH + Fd<sub>ок</sub> + кротоніл-КоА → 2 NAD⁺ + Fd<sub>відн</sub> + бутирил-КоА</b></p><p>ΔG = −n·F·ΔE°′: ${fmt(dGc, 1)} і +${fmt(dGf, 1)} кДж/моль → сумарно ${fmt(dGc + dGf, 1)} кДж/моль <small>(наш розрахунок за E°′ з тексту)</small>.</p><p>${st.sink === 'h2' ? 'Fd<sub>відн</sub> віддає електрони гідрогеназі: 2 H⁺ → H₂ («запасний вихід»).' : 'Fd<sub>відн</sub> через мембранний комплекс Rnf створює Na⁺/H⁺-градієнт для АТФ-синтази — до ≈ 1,5 АТФ додатково (попередня оцінка).'}</p>` : `<h4>Без біфуркації</h4><p>Якби NADH просто відновлював кротоніл-КоА (ΔE ≈ +310 мВ), ≈ ${fmt(-dGc, 0)} кДж/моль виділялося б як тепло, а фередоксин лишався б окисненим — клітина втратила б «запас» енергії.</p><p class="fm-hint">Біфуркація розв’язує єдину стадію β-окиснення, яку за фізіологічних потенціалів неможливо просто «повернути назад».</p>`;
    setPressed(m, st.sink, 'data-s');
  };
  m.addEventListener('change', (e) => { if (e.target.dataset.k) { st.bif = e.target.checked; ui(); draw(); } });
  m.addEventListener('click', (e) => { const b = e.target.closest('button[data-s]'); if (b) { st.sink = b.dataset.s; ui(); } });
  ui(); draw();
  loopWhenVisible(m, (dt) => { tick += dt; draw(); });
};

/* ================================================================ SCFA */
W.gut = (node) => {
  const m = $('[data-mount]', node);
  const A = [
    { id: 'ace', name: 'Ацетат', v: 60, col: '#C0392B', t: 'Найчисленніша коротколанцюгова кислота товстої кишки: утворюється багатьма анаеробними бродильниками. Ацетат як продукт бродіння дає додатковий АТФ, але не окиснює NADH.' },
    { id: 'pro', name: 'Пропіонат', v: 20, col: '#2E7D32', t: 'Утворюється переважно сукцинатним шляхом Bacteroidetes і Negativicutes (ген <i>mmdA</i>); поглинається переважно печінкою; імовірно, знижує ліпогенез і рівень холестерину.' },
    { id: 'but', name: 'Бутират', v: 20, col: '#7A3FB5', t: 'Головне джерело енергії для колоноцитів; інгібує гістондеацетилази, діє через три G-білок-спряжені рецептори, підтримує кишковий бар’єр і зменшує запалення. Поглинається переважно епітелієм кишки; при хворобі Крона кількість F. prausnitzii знижена.' },
  ];
  let cur = 'but';
  m.innerHTML = `<div class="fm-xr"><div class="fm-stage"><svg viewBox="0 0 300 300" class="fm-sv" role="img" aria-label="Співвідношення ацетату, пропіонату й бутирату"></svg><div class="fm-info out" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), out = $('.out', m);
  const arc = (a0, a1, r0, r1) => { const p = (a, r) => [150 + r * Math.cos(a), 150 + r * Math.sin(a)], l = a1 - a0 > Math.PI ? 1 : 0, [x0, y0] = p(a0, r1), [x1, y1] = p(a1, r1), [x2, y2] = p(a1, r0), [x3, y3] = p(a0, r0); return `M${x0} ${y0}A${r1} ${r1} 0 ${l} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${l} 0 ${x3} ${y3}z`; };
  const ui = () => {
    let a = -Math.PI / 2; let s = '';
    A.forEach((x) => { const sw = x.v / 100 * Math.PI * 2, on = x.id === cur, mid = a + sw / 2; s += `<path class="tp" data-i="${x.id}" tabindex="0" role="button" aria-label="${x.name}" d="${arc(a + 0.01, a + sw - 0.01, on ? 62 : 68, on ? 140 : 132)}" fill="${x.col}" opacity="${on ? 1 : 0.55}"/><text x="${150 + 100 * Math.cos(mid)}" y="${150 + 100 * Math.sin(mid) + 5}" text-anchor="middle" class="tb" style="fill:#fff">${x.v}</text>`; a += sw; });
    svg.innerHTML = s + `<text x="150" y="146" text-anchor="middle" class="tb">60 : 20 : 20</text><text x="150" y="164" text-anchor="middle" class="tm">молярне співвідношення</text>`;
    const x = A.find((y) => y.id === cur); out.innerHTML = `<h4 style="color:${x.col}">${x.name} — ≈ ${x.v} %</h4><p>${x.t}</p>`;
  };
  svg.addEventListener('click', (e) => { const g = e.target.closest('.tp'); if (g) { cur = g.dataset.i; ui(); } });
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const g = e.target.closest('.tp'); if (g) { e.preventDefault(); cur = g.dataset.i; ui(); } } });
  ui();
};

/* ================================================================ цитрат */
W.citric = (node) => {
  const m = $('[data-mount]', node);
  const st = { mn: 5, ph: 2, sugar: 15, o2: 30, fe: 0.2 };
  const R = [['mn', 'Mn²⁺, мкг/л', 0, 150, 1], ['ph', 'pH', 1, 6, 0.1], ['sugar', 'Цукор, %', 2, 30, 1], ['o2', 'Розчинений O₂, % насичення', 5, 80, 1], ['fe', 'Залізо, ppm', 0, 5, 0.05]];
  m.innerHTML = `<div class="fm-xr"><div class="fm-row">${R.map(([k, n, a, b, s]) => `<label class="fm-ctl">${n}: <output data-o="${k}"></output><input type="range" data-k="${k}" min="${a}" max="${b}" step="${s}"></label>`).join('')}</div><div class="fm-stage"><svg viewBox="0 0 360 260" class="fm-sv" role="img" aria-label="Морфологія гіфів і вихід"></svg><div class="fm-info out" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), out = $('.out', m);
  const f = {
    mn: (x) => (x <= 5 ? 1 : Math.exp(-(x - 5) / (95 / Math.log(3)))),
    ph: (x) => (x >= 2 ? Math.exp(-(((x - 2) / 1.2) ** 2)) : Math.exp(-(((2 - x) / 1.0) ** 2))),
    sugar: (x) => (x < 14 ? clamp((x - 2) / 12) ** 1.2 : x <= 22 ? 1 : Math.max(0.6, 1 - (x - 22) * 0.05)),
    o2: (x) => clamp(x / 25) ** 1.5,
    fe: (x) => (x < 0.05 ? 0.7 : x <= 0.5 ? 1 : Math.max(0.15, 1 - (x - 0.5) * 0.4)),
  };
  const run = () => {
    const fs = Object.fromEntries(Object.keys(f).map((k) => [k, f[k](st[k])]));
    const q = Object.values(fs).reduce((a, b) => a * b, 1), titre = 135 * q, Y = clamp(titre / (st.sugar * 10), 0, 1.067);
    const pellet = st.mn <= 10 && st.ph <= 2.6;
    let s = `<rect x="6" y="6" width="348" height="248" rx="16" fill="#FFFCF4" stroke="#E4DCCA"/>`;
    if (pellet) for (let i = 0; i < 6; i++) { const x = 60 + (i % 3) * 110, y = 70 + Math.floor(i / 3) * 110; s += `<circle cx="${x}" cy="${y}" r="30" fill="#7A6A3A" opacity=".75"/>` + Array.from({ length: 9 }, (_, k) => { const a = k * 0.7; return `<line x1="${x}" y1="${y}" x2="${x + 36 * Math.cos(a)}" y2="${y + 36 * Math.sin(a)}" stroke="#7A6A3A" stroke-width="2" opacity=".5"/>`; }).join(''); }
    else for (let i = 0; i < 9; i++) { const x = 30 + (i % 3) * 110, y = 40 + Math.floor(i / 3) * 80; s += `<path d="M${x} ${y}q30 -20 55 10t55 -5M${x + 20} ${y + 6}q8 30 30 40M${x + 70} ${y + 8}q-10 28 -25 44" stroke="#7A6A3A" stroke-width="2.2" fill="none" opacity=".75"/>`; }
    svg.innerHTML = s + `<text x="180" y="246" text-anchor="middle" class="tb">${pellet ? 'компактні пелети' : 'нитчасті гіфи'}</text>`;
    const wk = Object.entries(fs).sort((a, b) => a[1] - b[1])[0], names = { mn: 'Манган', ph: 'pH', sugar: 'Цукор', o2: 'Кисень', fe: 'Залізо' };
    out.innerHTML = `<h4>Орієнтовний вихід: ${fmt(titre, 0)} г/л</h4><div class="fm-bar"><i style="width:${clamp(titre / 135) * 100}%"></i></div><dl><dt>Вихід Y</dt><dd>${fmt(Y, 2)} г/г <small>(теор. 1,067)</small></dd><dt>Морфологія</dt><dd>${pellet ? 'пелети — оптимум' : 'нитчасті гіфи — гірше'}</dd><dt>Найслабша ланка</dt><dd>${q > 0.9 ? 'усе в оптимумі' : names[wk[0]] + ' (' + fmt(wk[1] * 100, 0) + ' %)'}</dd></dl><p class="fm-hint">Орієнтири з джерел: Mn²⁺ ≤ 5 мкг/л (120 г/л при 5 і 40–45 г/л при 100 мкг/л), pH &lt; 2, цукор 14–22 %, O₂ &gt; 20–30 %, залізо 0,05–0,5 ppm. Навчальна якісна модель.</p>`;
  };
  const sync = () => { $$('input[data-k]', m).forEach((i) => (i.value = st[i.dataset.k])); $$('[data-o]', m).forEach((o) => (o.textContent = fmt(st[o.dataset.o], st[o.dataset.o] % 1 ? 2 : 0))); };
  m.addEventListener('input', (e) => { const i = e.target; if (!i.dataset.k) return; st[i.dataset.k] = +i.value; sync(); run(); });
  sync(); run();
};

/* ================================================================ вуглецевий облік */
W.carbons = (node) => {
  const m = $('[data-mount]', node);
  let cur = 'ethanol', p = 0; const dots = [];
  m.innerHTML = `<div class="fm-xr">${chips(D.carbon.map((c) => ({ id: c.id, label: c.name })), cur)}<div class="fm-stage"><svg viewBox="0 0 600 290" class="fm-sv" role="img" aria-label="Куди йдуть атоми вуглецю"></svg><div class="fm-info out" aria-live="polite"></div></div><button type="button" class="fm-btn fm-btn--ghost" data-replay>↺ Повторити</button></div>`;
  const svg = $('svg', m), out = $('.out', m);
  const layout = () => {
    const c = D.carbon.find((x) => x.id === cur); svg.innerHTML = ''; dots.length = 0;
    svgEl('text', { x: 20, y: 22, class: 'tb' }, svg).textContent = `Субстрат: ${c.unit} (${c.n} C)`;
    const cols = Math.ceil(c.n / 3);
    const src = (i) => [36 + (i % cols) * 22, 70 + Math.floor(i / cols) * 22];
    svgEl('rect', { x: 20, y: 44, width: cols * 22 + 32, height: 3 * 22 + 52, rx: 14, fill: '#FFF4DC', stroke: '#E0B13C', 'stroke-width': 2 }, svg);
    for (let g = 0; g < c.n; g++) { const q = src(g); svgEl('circle', { cx: q[0], cy: q[1], r: 6, fill: 'none', stroke: '#C9B98A', 'stroke-dasharray': '2 2' }, svg); }
    const bx0 = 40 + cols * 22 + 60;
    let k = 0;
    c.parts.forEach((part, pi) => {
      const bx = bx0 + (pi % 2) * 160, by = 44 + Math.floor(pi / 2) * 100;
      svgEl('rect', { x: bx, y: by, width: 150, height: 86, rx: 12, fill: '#fff', stroke: part[2], 'stroke-width': 2.5 }, svg);
      const tt = svgEl('text', { x: bx + 75, y: by + 18, 'text-anchor': 'middle', class: 'tb' }, svg); tt.textContent = `${part[0]} — ${part[1]} C`;
      for (let j = 0; j < part[1]; j++) dots.push({ from: src(k++), to: [bx + 16 + (j % 8) * 16, by + 38 + Math.floor(j / 8) * 18], col: part[2], el: svgEl('circle', { r: 6, fill: part[2], stroke: '#fff', 'stroke-width': 1 }, svg) });
    });
    const gas = c.parts.filter((x) => x[0] === 'CO₂').reduce((a, b) => a + b[1], 0);
    out.innerHTML = `<h4>${c.name}</h4><dl>${c.parts.map((x) => `<dt style="color:${x[2]}">${x[0]}</dt><dd>${x[1]} з ${c.n} C (${fmt(x[1] / c.n * 100, 0)} %)</dd>`).join('')}</dl><p>${gas ? `Вуглець, що йде як CO₂: <b>${fmt(gas / c.n * 100, 0)} %</b>.` : 'Газ не виділяється — увесь вуглець лишається в продукті.'}</p>${c.note ? `<p class="fm-hint">${c.note}</p>` : ''}`;
    p = 0; draw();
  };
  const draw = () => { const e = p < 1 ? 1 - (1 - p) ** 3 : 1; dots.forEach((d) => { d.el.setAttribute('cx', mix(d.from[0], d.to[0], e)); d.el.setAttribute('cy', mix(d.from[1], d.to[1], e)); }); };
  m.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.id) { cur = b.dataset.id; setPressed(m, cur); layout(); } else if (b.dataset.replay !== undefined) { p = 0; if (REDUCED) { p = 1; draw(); } } });
  layout(); p = REDUCED ? 1 : 0; draw();
  loopWhenVisible(m, (dt) => { if (p < 1) { p = Math.min(1, p + dt / 1.6); draw(); } });
};

/* ================================================================ естафета */
W.relay = (node) => {
  const m = $('[data-mount]', node);
  let cur = D.relay[0].id, pulse = 0, P = 100;
  const col = { ethanol: '#D9770C', acetic: '#C0392B', lactic: '#2B6CB0', propionic: '#2E7D32', butyric: '#7A3FB5', o2: '#7B8794' };
  m.innerHTML = `<div class="fm-xr">${chips(D.relay.map((r) => ({ id: r.id, label: r.name, col: '#8A4A0A' })), cur)}<div class="fm-scroll"><svg viewBox="0 0 720 150" class="fm-sv fm-sv--wide" role="img" aria-label="Ланцюг бродінь"></svg></div><div class="fm-h2" hidden><label class="fm-ctl">Парціальний тиск H₂, Па (логарифмічна шкала): <output></output><input type="range" min="-1" max="3.7" step="0.05" value="2"></label></div><div class="fm-info out" aria-live="polite"></div></div>`;
  const svg = $('svg', m), out = $('.out', m), h2 = $('.fm-h2', m), rng = $('input', h2), o = $('output', h2);
  const draw = () => {
    const r = D.relay.find((x) => x.id === cur); let s = '';
    r.steps.forEach((st, i) => { const x = 14 + i * 236, c = col[st[1]]; s += `<rect class="stp" data-c="${c}" x="${x}" y="30" width="200" height="86" rx="14" fill="#fff" stroke="${c}" stroke-width="3"/><text x="${x + 100}" y="56" text-anchor="middle" class="tb">${st[0]}</text><foreignObject x="${x + 8}" y="62" width="184" height="50"><div xmlns="http://www.w3.org/1999/xhtml" style="font:11.5px system-ui;color:#46584C;text-align:center;line-height:1.25">${st[2]}</div></foreignObject>`; if (i < r.steps.length - 1) s += `<path d="M${x + 204} 73H${x + 232}" stroke="#46584C" stroke-width="3" marker-end="url(#fm-rar)"/>`; });
    svg.innerHTML = `<defs><marker id="fm-rar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#46584C"/></marker></defs>${s}`;
  };
  const ui = () => {
    const r = D.relay.find((x) => x.id === cur); h2.hidden = cur !== 'gas';
    const lg = +rng.value, Pa = 10 ** lg, y = 3.3 + 0.7 * clamp((Math.log10(5000) - lg) / (Math.log10(5000) - 1));
    o.textContent = Pa < 10 ? `${fmt(Pa, 1)} Па` : `${fmt(Pa, 0)} Па`;
    out.innerHTML = `<p>${r.note}</p>${cur === 'gas' ? `<dl><dt>Зона</dt><dd>${Pa <= 10 ? 'осади (&lt; 1–10 Па)' : Pa <= 5000 ? (Pa >= 20 ? 'рубець (20–5000 Па)' : 'проміжна') : 'вище за природний діапазон'}</dd><dt>АТФ маслянокислого бродіння</dt><dd><b>≈ ${fmt(y, 1)}</b> на глюкозу <small>(3,3 у реальній суміші → ≈ 4 при низькому H₂)</small></dd></dl>` : ''}`;
    setPressed(m, cur); draw();
  };
  m.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) { cur = b.dataset.id; ui(); } });
  rng.addEventListener('input', ui);
  ui();
  loopWhenVisible(m, (dt) => { pulse = (pulse + dt * 0.4) % 1; const rs = $$('.stp', svg), a = Math.floor(pulse * rs.length); rs.forEach((r, i) => r.setAttribute('fill', i === a ? r.dataset.c + '22' : '#fff')); });
};

/* ================================================================ вікторина */
W.quiz = (node) => {
  const m = $('[data-mount]', node);
  let i = 0, score = 0, done = false, answered = false;
  const ids = ['ethanol', 'lactic', 'propionic', 'butyric', 'acetic', 'citric'];
  const ui = () => {
    if (done) { m.innerHTML = `<div class="fm-info"><h4>Результат: ${score} із ${D.quiz.length}</h4><p>${score === D.quiz.length ? 'Відмінно: ви розрізняєте всі шість процесів.' : 'Перегляньте розділи про типи бродіння й спробуйте ще раз.'}</p></div><button type="button" class="fm-btn" data-r>↺ Ще раз</button>`; return; }
    const q = D.quiz[i];
    m.innerHTML = `<div class="fm-xr"><p class="fm-q"><b>Сцена ${i + 1} із ${D.quiz.length}:</b> ${q.scene}</p>${chips(ids.map((id) => ({ id, label: T[id].name, col: T[id].col })), '')}<div class="fm-info out" aria-live="polite" style="margin-top:12px" ${answered ? '' : 'hidden'}></div></div>`;
  };
  m.addEventListener('click', (e) => {
    if (e.target.closest('[data-r]')) { i = 0; score = 0; done = false; answered = false; ui(); return; }
    if (e.target.closest('[data-nx]')) { i++; answered = false; if (i >= D.quiz.length) done = true; ui(); return; }
    const b = e.target.closest('button[data-id]'); if (!b || answered) return;
    answered = true; const q = D.quiz[i], ok = b.dataset.id === q.ans; if (ok) score++;
    const box = $('.out', m); box.hidden = false;
    setPressed(m, b.dataset.id); $$('button[data-id]', m).forEach((x) => { x.disabled = true; if (x.dataset.id === q.ans) x.style.background = '#2E7D32', x.style.color = '#fff'; });
    box.innerHTML = `<h4 class="${ok ? 'fm-ok' : 'fm-bad'}">${ok ? 'Правильно!' : 'Ні — це ' + T[q.ans].name.toLowerCase() + ' бродіння.'}</h4><p>${q.why}</p><p><b>${q.tf}</b></p><button type="button" class="fm-btn" data-nx>${i + 1 >= D.quiz.length ? 'Результат' : 'Далі ▶'}</button>`;
  });
  ui();
};

/* ================================================================ запуск */
const mounted = new WeakSet();
const mount = (node) => {
  if (mounted.has(node)) return; mounted.add(node);
  const fn = W[node.dataset.w]; if (!fn) return;
  try { fn(node); node.classList.add('is-ready'); } catch (err) { console.error('fm widget', node.dataset.w, err); }
};
const widgets = $$('[data-w]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target); } }), { rootMargin: '300px 0px' });
  widgets.forEach((w) => io.observe(w));
} else widgets.forEach(mount);
addEventListener('hashchange', () => { const t = document.getElementById(location.hash.slice(1)); if (t) $$('[data-w]', t).forEach(mount); });
