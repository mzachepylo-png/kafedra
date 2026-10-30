// Стаття «Механізми стійкості рослин»: інтерактивні моделі. Віджети монтуються, коли наближаються до екрана.
const D = JSON.parse(document.getElementById('st-data').textContent);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const fmt = (x, d = 1) => (+x).toFixed(d).replace('.', ',');
const mix = (a, b, t) => a + (b - a) * t;
const ST = Object.fromEntries(D.stresses.map((s) => [s.id, s]));
function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}
function chips(items, cur, attr = 'data-id') {
  return `<div class="st-chips" role="group">${items.map((it) => `<button type="button" ${attr}="${it.id}" aria-pressed="${it.id === cur}"${it.col ? ` style="--c:${it.col}"` : ''}>${it.label}</button>`).join('')}</div>`;
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
const slider = (id, label, min, max, val, step = 1, unit = '') => `<label class="st-ctl"><span>${label}: <output id="${id}-o">${val}${unit}</output></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
const W = {};

/* ================================================================ драбина стійкості */
W.ladder = (node) => {
  const m = $('[data-mount]', node);
  let cur = 'drought';
  m.innerHTML = `<div class="st-ladder">${chips(D.stresses.map((s) => ({ id: s.id, label: s.name, col: s.col })), cur)}<div class="st-ladder__row" aria-live="polite"></div></div>`;
  const row = $('.st-ladder__row', m), box = $('.st-chips', m);
  const draw = () => {
    const s = ST[cur], L = D.ladder[cur];
    row.style.setProperty('--c', s.col);
    row.innerHTML = D.levels.map((lv, i) => `<div class="st-lvl" style="--i:${i}"><b><i>${i + 1}</i>${lv}</b><ul>${L[i].map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('');
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed(box, cur); draw(); });
  draw();
};

/* ================================================================ тренажер стратегій */
W.strategy = (node) => {
  const m = $('[data-mount]', node);
  const items = D.strategy.map((x, i) => ({ t: x[0], k: x[1], w: x[2], i }));
  let i = 0, score = 0, ans = false, done = false;
  const L = { escape: 'Втеча', avoid: 'Уникнення', tol: 'Толерантність' };
  const draw = () => {
    if (done) { m.innerHTML = `<div class="st-info"><h4>Результат: ${score} із ${items.length}</h4><p>${score >= items.length - 2 ? 'Чудово: ви добре розрізняєте стратегії.' : 'Перегляньте таблицю вище й спробуйте ще раз.'}</p></div><button type="button" class="st-btn" data-r>↺ Ще раз</button>`; return; }
    const q = items[i];
    m.innerHTML = `<p class="st-q"><b>${i + 1} із ${items.length}:</b> ${q.t}</p>${chips(Object.keys(L).map((id) => ({ id, label: L[id] })), '')}<div class="st-info out" aria-live="polite" style="margin-top:12px" ${ans ? '' : 'hidden'}></div>`;
  };
  m.addEventListener('click', (e) => {
    if (e.target.closest('[data-r]')) { i = 0; score = 0; done = false; ans = false; draw(); return; }
    if (e.target.closest('[data-nx]')) { i++; ans = false; if (i >= items.length) done = true; draw(); return; }
    const b = e.target.closest('button[data-id]'); if (!b || ans) return;
    ans = true; const q = items[i], ok = b.dataset.id === q.k; if (ok) score++;
    $$('button[data-id]', m).forEach((x) => { x.disabled = true; if (x.dataset.id === q.k) { x.style.background = '#2E7D32'; x.style.color = '#fff'; } });
    const box = $('.out', m); box.hidden = false;
    box.innerHTML = `<h4 class="${ok ? 'st-ok' : 'st-bad'}">${ok ? 'Правильно!' : 'Ні — це ' + L[q.k].toLowerCase() + '.'}</h4><p>${q.w}</p><button type="button" class="st-btn" data-nx>${i + 1 >= items.length ? 'Результат' : 'Далі ▶'}</button>`;
  });
  draw();
};

/* ================================================================ рівновага АФК */
W.rosbalance = (node) => {
  const m = $('[data-mount]', node);
  const presets = [['norm', 'Норма', 10], ['dr', 'Посуха', 40], ['drl', 'Посуха + яскраве світло', 70], ['heat', 'Спека', 55], ['salt', 'Засолення', 35], ['met', 'Метали', 45]];
  m.innerHTML = `<div class="st-stage st-stage--col"><div>${chips(presets.map((p) => ({ id: p[0], label: p[1] })), 'norm')}<div class="st-row">${slider('rb-p', 'Виробництво АФК', 0, 100, 10)}${slider('rb-s', 'Потужність антиоксидантів', 10, 100, 60)}</div></div>
    <svg viewBox="0 0 700 150" class="st-sv" role="img" aria-label="Шкала рівня АФК"></svg><div class="st-info" aria-live="polite"></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), pI = $('#rb-p', m), sI = $('#rb-s', m);
  svg.innerHTML = `<rect x="30" y="50" width="164" height="30" fill="#CFE9D7"/><rect x="194" y="50" width="316" height="30" fill="#FBE5A8"/><rect x="510" y="50" width="160" height="30" fill="#F4B6AA"/>
  <text x="112" y="40" text-anchor="middle" class="ts">фон, «спокій»</text><text x="352" y="40" text-anchor="middle" class="ts">сигнальне вікно</text><text x="590" y="40" text-anchor="middle" class="ts">окислювальна шкода</text>
  <rect x="30" y="50" width="640" height="30" fill="none" stroke="#46584C" stroke-width="1.5" rx="4"/><path id="rb-mk" d="M0 0l-9 -14h18z" fill="#1B3B28" transform="translate(30 84)"/>
  <text id="rb-v" x="30" y="122" class="tb" text-anchor="middle"></text>`;
  const mk = $('#rb-mk', svg), vt = $('#rb-v', svg);
  const upd = () => {
    const P = +pI.value, S = +sI.value; $('#rb-p-o', m).textContent = P; $('#rb-s-o', m).textContent = S;
    const R = P / (0.5 + S / 20), x = 30 + clamp(R / 24) * 640;
    mk.setAttribute('transform', `translate(${x} 84)`); vt.setAttribute('x', clamp(x, 70, 630)); vt.textContent = 'рівень АФК ≈ ' + fmt(R);
    const z = R < 3 ? 0 : R <= 12 ? 1 : 2;
    const txt = [
      ['Фоновий рівень', 'АФК виробляються й гасяться — «шум» метаболізму. Сигнальних програм ще не вмикнуто.'],
      ['Сигнальне вікно', 'Рівень досить високий, щоб H₂O₂ окиснював цистеїни білків і вмикав захисні програми (Ca²⁺-канали, MAP-кінази, HSF). Це корисний, «еустрес».'],
      ['Зона шкоди', 'Антиоксиданти не встигають: окиснюються ліпіди, білки, ДНК — «дистрес». Допомагають NPQ, циклічний потік електронів, зростання SOD/APX/GSH.']][z];
    info.innerHTML = `<h4 class="${z === 2 ? 'st-bad' : z === 1 ? '' : 'st-ok'}">${txt[0]}</h4><p>${txt[1]}</p><p class="st-hint">Модель якісна: R = P / (0,5 + S/20) — стаціонарний рівень як відношення виробництва до потужності гасіння.</p>`;
  };
  m.addEventListener('input', upd);
  $('.st-chips', m).addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; setPressed($('.st-chips', m), b.dataset.id); pI.value = presets.find((p) => p[0] === b.dataset.id)[2]; upd(); });
  upd();
};

/* ================================================================ цикл Асади–Галлівелла */
W.asada = (node) => {
  const m = $('[data-mount]', node);
  const steps = [
    ['SOD: O₂˙⁻ → H₂O₂', 'Супероксиддисмутаза (Cu/Zn, Mn, Fe) дисмутує супероксид у H₂O₂ — стабільнішу молекулу.'],
    ['APX: H₂O₂ → H₂O', 'Аскорбатпероксидаза відновлює H₂O₂ до води, окиснюючи 2 аскорбати до монодегідроаскорбату (MDA).'],
    ['MDHAR: MDA → аскорбат', 'MDHAR повертає аскорбат за рахунок НАД(Ф)Н.'],
    ['DHAR: DHA → аскорбат', 'MDA, що диспропорціонує, дає дегідроаскорбат (DHA); DHAR відновлює його коштом 2 GSH → GSSG.'],
    ['GR: GSSG → 2 GSH', 'Глутатіонредуктаза відновлює глутатіон коштом НАДФН — тут цикл замикається.']];
  let cur = 0, ko = '';
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 560 380" class="st-sv" role="img" aria-label="Цикл Асади–Галлівелла"></svg><div><div class="st-info" aria-live="polite"></div><div class="st-row" style="margin-top:10px"><button type="button" class="st-btn st-btn--ghost" data-p>◀</button><button type="button" class="st-btn" data-n>Крок ▶</button></div><div class="st-row"><label class="st-check"><input type="checkbox" data-ko="apx"> Вимкнути APX</label><label class="st-check"><input type="checkbox" data-ko="gr"> Вимкнути GR</label></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m);
  const N = { o2: [60, 40, 'O₂˙⁻'], h2o2: [230, 40, 'H₂O₂'], h2o: [460, 40, '2 H₂O'], asc: [90, 190, 'Аскорбат'], mda: [350, 130, 'MDA'], dha: [350, 260, 'DHA'], gsh: [140, 330, '2 GSH'], gssg: [350, 330, 'GSSG'] };
  const E = [['o2', 'h2o2', 0, 'SOD'], ['asc', 'mda', 1, 'APX'], ['mda', 'asc', 2, 'MDHAR'], ['mda', 'dha', 3, ''], ['dha', 'asc', 3, 'DHAR'], ['gssg', 'gsh', 4, 'GR']];
  svg.innerHTML = `<defs><marker id="as-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#46584C"/></marker></defs>`;
  const nodes = {}, edges = [];
  const path = (a, b, i) => { const [x1, y1] = N[a], [x2, y2] = N[b]; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 22, ny = dx / L * 22; const ex = a === 'asc' && b === 'mda' || a === 'dha' && b === 'asc' || a === 'o2' ? 1 : 0;
    const sx = x1 + dx / L * 38, sy = y1 + dy / L * 18, tx = x2 - dx / L * 38, ty = y2 - dy / L * 18; return ex ? `M${sx} ${sy}Q${(x1 + x2) / 2 + nx} ${(y1 + y2) / 2 + ny} ${tx} ${ty}` : `M${sx} ${sy}L${tx} ${ty}`; };
  E.forEach(([a, b, st, lb]) => {
    const p = svgEl('path', { d: path(a, b, st), fill: 'none', stroke: '#9AA8A0', 'stroke-width': 2.6, 'marker-end': 'url(#as-a)' }, svg);
    const [x1, y1] = N[a], [x2, y2] = N[b]; const t = svgEl('text', { x: (x1 + x2) / 2 + (a === 'mda' && b === 'asc' ? 0 : (a === 'asc' ? 0 : 0)), y: (y1 + y2) / 2 + (a === 'mda' && b === 'asc' ? 22 : a === 'asc' ? -26 : a === 'dha' ? 24 : -6), 'text-anchor': 'middle', class: 'tb' }, svg); t.textContent = lb; edges.push([p, t, st]);
  });
  svg.insertAdjacentHTML('beforeend', `<path d="M230 60L226 140" stroke="#9AA8A0" stroke-width="2" stroke-dasharray="5 4" fill="none"/><path d="M226 140L410 62" stroke="#9AA8A0" stroke-width="2" stroke-dasharray="5 4" fill="none" marker-end="url(#as-a)"/><text x="230" y="14" text-anchor="middle" class="tm">кисень → пероксид → вода</text><text x="466" y="238" class="tm" text-anchor="middle">GSH — глутатіон</text>`);
  Object.entries(N).forEach(([k, [x, y, t]]) => { const g = svgEl('g', {}, svg); svgEl('rect', { x: x - 42, y: y - 18, width: 84, height: 36, rx: 12, fill: '#fff', stroke: '#2F8F5B', 'stroke-width': 2 }, g); const tx = svgEl('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'tb' }, g); tx.textContent = t; nodes[k] = g.firstChild; });
  svg.insertAdjacentHTML('beforeend', `<text x="20" y="370" class="tm">електрони: НАДФН → GSH → аскорбат → H₂O₂</text>`);
  const tog = (id) => m.querySelector(`[data-ko="${id}"]`).checked;
  const draw = () => {
    const kapx = tog('apx'), kgr = tog('gr');
    edges.forEach(([p, t, st]) => { const on = st <= cur, blocked = (kapx && st >= 1) || (kgr && st === 4); const col = blocked && on ? '#C0392B' : on ? '#2F8F5B' : '#B9C3BC'; p.setAttribute('stroke', col); p.setAttribute('stroke-width', st === cur ? 4.6 : 2.6); if (blocked && on) p.setAttribute('stroke-dasharray', '6 5'); else p.removeAttribute('stroke-dasharray'); t.style.fill = col; });
    const act = { 0: ['o2', 'h2o2'], 1: ['asc', 'mda', 'h2o', 'h2o2'], 2: ['mda', 'asc'], 3: ['mda', 'dha', 'asc', 'gsh', 'gssg'], 4: ['gssg', 'gsh'] }[cur];
    Object.entries(nodes).forEach(([k, r]) => { r.setAttribute('fill', act.includes(k) ? '#E4F4EA' : '#fff'); r.setAttribute('stroke', act.includes(k) ? '#1F6B45' : '#2F8F5B'); });
    let msg = '';
    if (kapx) msg = '<p class="st-bad"><b>APX вимкнено:</b> H₂O₂ не розкладається аскорбатом — накопичується й окиснює ферменти циклу Кальвіна. Каталази лишаються резервом, але лише в пероксисомах.</p>';
    else if (kgr) msg = '<p class="st-bad"><b>GR вимкнено:</b> глутатіон не відновлюється, DHAR стоїть, аскорбат вичерпується — через кілька хвилин припиняється й APX.</p>';
    info.innerHTML = `<h4>Крок ${cur + 1} із ${steps.length}: ${steps[cur][0]}</h4><p>${steps[cur][1]}</p>${msg}`;
  };
  m.addEventListener('click', (e) => { if (e.target.closest('[data-n]')) cur = (cur + 1) % steps.length; else if (e.target.closest('[data-p]')) cur = (cur + steps.length - 1) % steps.length; else return; draw(); });
  m.addEventListener('change', draw);
  draw();
};

/* ================================================================ куди йде світло */
W.npq = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="st-stage st-stage--col"><div class="st-row">${slider('nq-l', 'Освітленість, мкмоль·м⁻²·с⁻¹', 100, 2000, 1200, 50)}</div>
  <div class="st-row"><label class="st-check"><input type="checkbox" data-o="st"> Продихи закриті (посуха)</label><label class="st-check"><input type="checkbox" data-o="npq" checked> NPQ (PsbS, зеаксантин)</label><label class="st-check"><input type="checkbox" data-o="cyc" checked> Циклічний потік (PGR5/NDH)</label></div>
  <div class="st-bars" aria-live="polite"></div><div class="st-info"></div></div>`;
  const bars = $('.st-bars', m), info = $('.st-info', m), lI = $('#nq-l', m);
  const upd = () => {
    const A = +lI.value; $('#nq-l-o', m).textContent = A;
    const closed = $('[data-o=st]', m).checked, npq = $('[data-o=npq]', m).checked, cyc = $('[data-o=cyc]', m).checked;
    const P = closed ? 130 : 480, used = Math.min(A, P); let ex = A - used;
    const nq = Math.min(ex, npq ? 0.55 * A : 0.08 * A); ex -= nq;
    const cy = Math.min(ex, cyc ? 0.12 * A : 0); ex -= cy;
    const seg = [['Фотохімія (асиміляція)', used, '#2F8F5B'], ['NPQ (тепло)', nq, '#E1A52C'], ['Циклічний потік / фотодихання', cy, '#4C8DD6'], ['Надлишок → АФК', ex, '#D1432B']];
    bars.innerHTML = `<div class="st-stack">${seg.map((s) => `<i style="width:${(s[1] / A * 100).toFixed(1)}%;background:${s[2]}" title="${s[0]}"></i>`).join('')}</div><div class="st-leg">${seg.map((s) => `<span style="--c:${s[2]}"><i></i>${s[0]}: <b>${Math.round(s[1] / A * 100)} %</b></span>`).join('')}</div>`;
    const risk = ex / A;
    info.innerHTML = `<h4 class="${risk > .2 ? 'st-bad' : risk > .05 ? '' : 'st-ok'}">${risk > .2 ? 'Високий ризик фотоінгібування' : risk > .05 ? 'Помірне навантаження' : 'Енергія розсіюється безпечно'}</h4><p>${closed ? 'Продихи закриті: CO₂ у листку мало, фотохімія обмежена, надлишок зростає швидко. ' : ''}${!npq ? 'Без NPQ листок не гасить надлишок тепловим шляхом. ' : ''}${!cyc ? 'Без циклічного потоку ФС I менш захищена. ' : ''}Якісна модель: у реальності частки залежать від виду, акліматизації й температури.</p>`;
  };
  m.addEventListener('input', upd); m.addEventListener('change', upd); upd();
};

/* ================================================================ універсальний ланцюг із мутантами */
function chainWidget(node, key) {
  const m = $('[data-mount]', node), C = D.chains[key];
  let ko = '', sel = 0, oe = '';
  m.innerHTML = `<div class="st-stage"><ol class="st-chain"></ol><div><div class="st-info" aria-live="polite"></div><p class="st-hint">Мутант / варіант:</p><div class="st-kos"></div></div></div>`;
  const ol = $('.st-chain', m), info = $('.st-info', m), kos = $('.st-kos', m);
  const all = [{ id: '', label: 'дикий тип' }, ...C.ko.map((k) => ({ id: k.id, label: k.label })), ...(C.oe || []).map((k) => ({ id: k.id, label: k.label }))];
  kos.innerHTML = chips(all, '');
  ol.innerHTML = C.nodes.map((n, i) => `<li data-i="${i}" tabindex="0"><span class="st-chain__n">${i + 1}</span><b>${n[0]}</b></li>`).join('');
  let timer = 0;
  const draw = (anim) => {
    const K = C.ko.find((k) => k.id === ko), O = (C.oe || []).find((k) => k.id === ko);
    const cut = K ? K.cut : 99;
    clearTimeout(timer);
    const lis = $$('li', ol);
    const paint = (upto) => lis.forEach((li, i) => { li.classList.toggle('is-on', i < Math.min(upto, cut)); li.classList.toggle('is-off', i >= cut); li.classList.toggle('is-block', i === cut); li.classList.toggle('is-partial', !!(K && K.partial && i >= cut)); li.classList.toggle('is-sel', i === sel); });
    if (anim && !REDUCED) { let k = 0; const go = () => { paint(++k); if (k < lis.length) timer = setTimeout(go, 120); }; paint(0); go(); } else paint(99);
    const n = C.nodes[sel];
    let res = '';
    if (K) res = `<p class="${K.partial ? '' : 'st-bad'}"><b>Мутант ${K.label}:</b> ${K.res}</p>`;
    else if (O) res = `<p><b>${O.label}:</b> ${O.res}</p><div class="st-pair"><span>Морозостійкість</span><div class="st-bar"><i style="width:${O.stat[0]}%;--c:#3B82C4"></i></div><span>Ріст</span><div class="st-bar"><i style="width:${O.stat[1]}%;--c:${O.stat[1] < 60 ? '#C0392B' : '#2F8F5B'}"></i></div></div>`;
    else res = '<p class="st-ok">Ланцюг працює повністю.</p>';
    info.innerHTML = `<h4>${sel + 1}. ${n[0]}</h4><p>${n[1]}</p>${res}`;
  };
  ol.addEventListener('click', (e) => { const li = e.target.closest('li'); if (!li) return; sel = +li.dataset.i; draw(false); });
  ol.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const li = e.target.closest('li'); if (li) { e.preventDefault(); sel = +li.dataset.i; draw(false); } } });
  kos.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; ko = b.dataset.id; setPressed(kos, ko); draw(true); });
  draw(true);
}
['drought', 'salt', 'cold'].forEach((k) => { W['chain_' + k] = (node) => chainWidget(node, k); });

/* ================================================================ замикаюча клітина */
W.guard = (node) => {
  const m = $('[data-mount]', node);
  const mut = [{ id: 'wt', label: 'дикий тип', f: 1 }, { id: 'ost1', label: 'ost1 (SnRK2.6)', f: 0.04 }, { id: 'slac1', label: 'slac1 (аніонний канал)', f: 0.18 }, { id: 'abi1', label: 'abi1-1 (PP2C домінантно)', f: 0.02 }];
  let cur = 'wt';
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 440 320" class="st-sv" role="img" aria-label="Замикаючі клітини"></svg><div><div class="st-row">${slider('gd-a', 'ABA (відносні одиниці)', 0, 100, 0)}</div>${chips(mut.map((x) => ({ id: x.id, label: x.label })), cur)}<div class="st-info" aria-live="polite" style="margin-top:10px"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), aI = $('#gd-a', m);
  svg.innerHTML = `<defs><marker id="gd-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#46584C"/></marker></defs><path id="gd-l" stroke="#1F6B45" stroke-width="3"/><path id="gd-r" stroke="#1F6B45" stroke-width="3"/>
  <g id="gd-ar1"><path d="M110 150H46" stroke="#C0392B" stroke-width="2.6" marker-end="url(#gd-ar)" fill="none"/><text x="8" y="136" class="tm">Cl⁻, малат⁻</text><text x="8" y="176" class="tm">K⁺ (GORK)</text></g>
  <g id="gd-ar2"><path d="M334 150H394" stroke="#C0392B" stroke-width="2.6" marker-end="url(#gd-ar)" fill="none"/><text x="398" y="146" class="tm">H₂O</text></g>
  <text x="220" y="20" text-anchor="middle" class="tb" id="gd-t"></text><text x="220" y="304" text-anchor="middle" class="ts" id="gd-s"></text>
  <g id="gd-ion"><text x="220" y="284" text-anchor="middle" class="tm">SLAC1 відкривається · KAT1 закривається · RBOHF → H₂O₂ → Ca²⁺</text></g>`;
  const L = $('#gd-l', svg), R2 = $('#gd-r', svg);
  const cell = (a, side) => { const g = 3 + 34 * a, cx = 220, s = side, x0 = cx + s * g / 2, out = x0 + s * 96, bow = x0 + s * (-30 * a + 8);
    return `M${x0} 56C${out - s * 6} 60 ${out} 100 ${out} 160C${out} 220 ${out - s * 6} 260 ${x0} 264C${bow} 210 ${bow} 110 ${x0} 56Z`; };
  const upd = () => {
    const ABA = +aI.value, f = mut.find((x) => x.id === cur).f; $('#gd-a-o', m).textContent = ABA;
    const s = ABA * f, cl = s * s / (s * s + 35 * 35), a = 1 - 0.96 * cl;
    L.setAttribute('d', cell(a, -1)); R2.setAttribute('d', cell(a, 1));
    const col = `hsl(${mix(100, 130, a)} ${mix(25, 48, a)}% ${mix(74, 62, a)}%)`; L.setAttribute('fill', col); R2.setAttribute('fill', col);
    $('#gd-ar1', svg).style.opacity = cl; $('#gd-ar2', svg).style.opacity = cl; $('#gd-ion', svg).style.opacity = .35 + .65 * cl;
    $('#gd-t', svg).textContent = a > .7 ? 'Продих відкритий' : a > .35 ? 'Продих частково відкритий' : 'Продих закритий';
    $('#gd-s', svg).textContent = 'тургор замикаючих клітин ≈ ' + Math.round(a * 100) + ' %';
    const notes = { wt: 'ABA → PYR/PYL → PP2C заблоковано → SnRK2 активні → SLAC1 відкривається, K⁺ виходить, вода слідом, тургор падає.', ost1: 'Без OST1 продих майже не реагує на ABA: рослина швидко в’яне за посухи.', slac1: 'Без SLAC1 аніони не виходять — закриття сильно затримується.', abi1: 'Домінантна abi1-1 не блокується ABA: фосфатаза гасить SnRK2 навіть за високого ABA.' };
    info.innerHTML = `<h4>${mut.find((x) => x.id === cur).label}</h4><p>${notes[cur]}</p><dl><dt>Транспірація</dt><dd>${Math.round(a * 100)} % від максимуму</dd><dt>Надходження CO₂</dt><dd>${Math.round(a * 100)} % — компроміс: вода ↔ асиміляція</dd></dl>`;
  };
  m.addEventListener('input', upd);
  $('.st-chips', m).addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed($('.st-chips', m), cur); upd(); });
  upd();
};

/* ================================================================ діаграма Гефлера */
W.hofler = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 520 320" class="st-sv" role="img" aria-label="Діаграма Гефлера"></svg><div>${slider('hf-r', 'Відносний вміст води, %', 60, 100, 100)}${slider('hf-o', 'Осмотична адаптація (додатково), МПа', 0, 1, 0, 0.05)}<div class="st-info" aria-live="polite" style="margin-top:10px"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), rI = $('#hf-r', m), oI = $('#hf-o', m);
  const X = (r) => 50 + (100 - r) / 40 * 440, Y = (v) => 40 + (1.2 - v) / 4.2 * 240;
  const model = (r, oa) => { const pi100 = 1 + oa, rr = r / 100, rb = 0.1; const pi = pi100 * (1 - rb) / (rr - rb); const psiP = Math.max(0, pi100 - 8 * (1 - rr)); return { s: -pi, p: psiP, w: -pi + psiP }; };
  const line = (oa, key, col, dash) => { let d = ''; for (let r = 100; r >= 60; r -= 1) { d += (r === 100 ? 'M' : 'L') + X(r).toFixed(1) + ' ' + Y(model(r, oa)[key]).toFixed(1); } return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.6" ${dash ? 'stroke-dasharray="5 4" opacity=".55"' : ''}/>`; };
  const draw = () => {
    const r = +rI.value, oa = +oI.value; $('#hf-r-o', m).textContent = r; $('#hf-o-o', m).textContent = fmt(oa, 2);
    const M = model(r, oa); let tlp = 100; for (let q = 100; q >= 60; q--) { if (model(q, oa).p <= 0) { tlp = q; break; } }
    let g = `<rect x="50" y="40" width="440" height="240" fill="#FAFEFB" stroke="#CFE6D7"/><path d="M50 ${Y(0)}H490" stroke="#46584C" stroke-width="1.5"/><text x="46" y="${Y(0) + 4}" text-anchor="end" class="tm">0</text><text x="46" y="${Y(-2) + 4}" text-anchor="end" class="tm">−2</text><text x="46" y="${Y(1) + 4}" text-anchor="end" class="tm">+1</text><text x="20" y="36" class="tm">МПа</text>`;
    for (let r2 = 100; r2 >= 60; r2 -= 10) g += `<text x="${X(r2)}" y="${Y(-3) + 18}" text-anchor="middle" class="tm">${r2}</text>`;
    g += `<text x="270" y="${Y(-3) + 34}" text-anchor="middle" class="ts">відносний вміст води (RWC), %</text>`;
    g += line(0, 's', '#2B6CB0', true) + line(0, 'p', '#2F8F5B', true) + line(0, 'w', '#46584C', true);
    g += line(oa, 's', '#2B6CB0') + line(oa, 'p', '#2F8F5B') + line(oa, 'w', '#1B3B28');
    g += `<text x="${X(66)}" y="${Y(model(66, oa).s) + 16}" class="tb" style="fill:#2B6CB0">ψs</text><text x="${X(97)}" y="${Y(model(97, oa).p) - 8}" class="tb" style="fill:#2F8F5B">ψp (тургор)</text><text x="${X(62)}" y="${Y(model(62, oa).w) - 8}" class="tb">ψw</text>`;
    g += `<path d="M${X(tlp)} ${Y(1.2)}V${Y(-3)}" stroke="#C0392B" stroke-dasharray="4 4"/><text x="${X(tlp)}" y="${Y(1.2) - 4}" text-anchor="middle" class="tm" style="fill:#C0392B">TLP ≈ ${tlp} %</text>`;
    g += `<circle cx="${X(r)}" cy="${Y(M.w)}" r="6" fill="#1B3B28"/>`;
    svg.innerHTML = g;
    info.innerHTML = `<h4 class="${M.p > 0 ? 'st-ok' : 'st-bad'}">${M.p > 0 ? 'Тургор є' : 'Тургор втрачено — листок в’яне'}</h4><dl><dt>ψs</dt><dd>${fmt(M.s, 2)} МПа</dd><dt>ψp</dt><dd>${fmt(M.p, 2)} МПа</dd><dt>ψw = ψs + ψp</dt><dd>${fmt(M.w, 2)} МПа</dd><dt>Точка втрати тургору</dt><dd>RWC ≈ ${tlp} %</dd></dl><p class="st-hint">Пунктир — без осмотичної адаптації. Модель якісна: ψs ∝ 1/RWC; ψp спадає лінійно зі втратою води.</p>`;
  };
  m.addEventListener('input', draw); draw();
};

/* ================================================================ DRO1 */
W.dro1 = (node) => {
  const m = $('[data-mount]', node);
  const G = { ir64: { n: 'IR64 (нефункціональний DRO1)', depth: 38, spread: 1.15, y: [100, 40, 0] }, nil: { n: 'Dro1-NIL (алель Kinandang Patong)', depth: 82, spread: 0.45, y: [100, 90, 30] } };
  let g = 'ir64', dr = 1;
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 440 340" class="st-sv" role="img" aria-label="Профіль ґрунту й корені"></svg><div>${chips([{ id: 'ir64', label: 'IR64' }, { id: 'nil', label: 'Dro1-NIL' }], g)}<p class="st-hint">Посуха:</p>${chips([{ id: '0', label: 'немає' }, { id: '1', label: 'помірна' }, { id: '2', label: 'сильна' }], '1', 'data-d')}<div class="st-info" aria-live="polite" style="margin-top:10px"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), boxes = $$('.st-chips', m);
  const draw = () => {
    const G0 = G[g]; const moist = (z) => clamp(0.92 - dr * 0.78 * Math.exp(-z / 38) - dr * 0.1 * (1 - z / 100), 0.05, 1);
    let s = `<rect x="20" y="40" width="400" height="280" fill="#F6EBD6" stroke="#B9A57C"/>`;
    for (let z = 0; z < 100; z += 5) { const mo = moist(z); s += `<rect x="20" y="${40 + z * 2.8}" width="400" height="14.1" fill="rgb(${Math.round(mix(246, 70, mo))},${Math.round(mix(235, 130, mo))},${Math.round(mix(214, 200, mo))})"/>`; }
    s += `<path d="M20 40H420" stroke="#4A7C3A" stroke-width="5"/><text x="30" y="30" class="ts">поверхня ґрунту</text><text x="408" y="316" text-anchor="end" class="tm">глибина 100 см</text><text x="408" y="${40 + 50 * 2.8}" text-anchor="end" class="tm">50 см</text>`;
    const x0 = 220, n = 9;
    for (let i = 0; i < n; i++) { const t = (i / (n - 1)) * 2 - 1, ang = t * G0.spread, len = G0.depth * (1 - 0.35 * Math.abs(t) * (G0.spread / 1.15)); const x1 = x0 + Math.sin(ang) * len * 2.8 * 0.95, y1 = 40 + Math.cos(ang) * len * 2.8; s += `<path d="M${x0} 42Q${(x0 + x1) / 2} ${40 + (y1 - 40) * 0.5} ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="#6A3B12" stroke-width="2.4" stroke-linecap="round"/>`; }
    s += `<path d="M${x0} 42V6" stroke="#4A7C3A" stroke-width="5"/>`;
    const avail = (() => { let a = 0, tot = 0; for (let z = 0; z < 100; z += 2) { const w = z <= G0.depth ? 1 : 0; a += moist(z) * w; tot += 1; } return a / (G0.depth / 2); })();
    svg.innerHTML = s; const Y = G0.y[dr];
    info.innerHTML = `<h4>${G0.n}</h4><dl><dt>Глибина коренів</dt><dd>≈ ${G0.depth} см</dd><dt>Вологість у зоні коренів</dt><dd>${Math.round(avail * 100)} % від максимуму</dd><dt>Відносний урожай*</dt><dd><b>${Y} %</b> від урожаю без стресу</dd></dl><div class="st-bar"><i style="width:${Y}%;--c:${Y < 20 ? '#C0392B' : Y < 70 ? '#E1A52C' : '#2F8F5B'}"></i></div><p class="st-hint">*Значення — за повідомленням IRRI (Rice Today): помірна посуха — IR64 втратив майже 60 %, Dro1-NIL — лише 10 %; сильна — IR64 не дав урожаю, Dro1-NIL — близько 30 %. У першоджерелі (Uga 2013) показник інший — частка виповнених зерен.</p>`;
  };
  boxes[0].addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; g = b.dataset.id; setPressed(boxes[0], g); draw(); });
  boxes[1].addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (!b) return; dr = +b.dataset.d; setPressed(boxes[1], String(dr), 'data-d'); draw(); });
  setPressed(boxes[1], '1', 'data-d'); draw();
};

/* ================================================================ Nax2 */
W.nax2 = (node) => {
  const m = $('[data-mount]', node);
  const lines = [{ id: 'tam', n: 'Tamaroi (без Nax2)', ret: .25, pen: 1, boost: 1 }, { id: 'nax2', n: 'Tamaroi + Nax2 (TmHKT1;5-A)', ret: .65, pen: 1, boost: 1.25 }, { id: 'nax1', n: 'Tamaroi + Nax1 (TmHKT1;4-A2)', ret: .35, pen: .93, boost: 1.05 }];
  let cur = 'tam';
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 420 340" class="st-sv" role="img" aria-label="Ксилема кореня й повернення Na⁺"></svg><div>${chips(lines.map((l) => ({ id: l.id, label: l.n })), cur)}${slider('nx-s', 'Засолення ґрунту, мМ NaCl', 0, 150, 100, 10)}<div class="st-info" aria-live="polite" style="margin-top:10px"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), sI = $('#nx-s', m);
  svg.innerHTML = `<rect x="10" y="260" width="400" height="70" fill="#F0E6CF"/><text x="20" y="320" class="tm">ґрунтовий розчин із NaCl</text><rect x="50" y="130" width="320" height="130" fill="#E8F3E1" stroke="#7FAF6A"/><text x="60" y="150" class="tm">кора кореня</text>
  <rect x="150" y="60" width="120" height="200" fill="#F7FBF2" stroke="#4A7C3A" stroke-width="3"/><text x="160" y="80" class="tm">стела</text>
  <rect x="195" y="20" width="30" height="240" fill="#BFE3F2" stroke="#2B6CB0" stroke-width="2.5"/><text x="210" y="14" text-anchor="middle" class="ts">ксилема → листок</text>
  <rect x="150" y="150" width="45" height="50" fill="#FFE9C2" stroke="#C9951B"/><text x="172" y="172" text-anchor="middle" class="tm">паренхіма</text><text x="172" y="188" text-anchor="middle" class="tm">HKT1;5</text>
  <path d="M195 180H178" stroke="#C0392B" stroke-width="3" marker-end="url(#nx-a)"/><defs><marker id="nx-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#C0392B"/></marker></defs><g id="nx-p"></g><text x="380" y="30" text-anchor="end" class="tb" id="nx-leaf">листок</text>`;
  const gp = $('#nx-p', svg); const parts = Array.from({ length: 36 }, (_, i) => ({ y: 260 - (i / 36) * 240, x: 200 + (Math.random() - .5) * 14, e: 0, ph: Math.random() })); 
  const els = parts.map(() => svgEl('circle', { r: 3.6, fill: '#C0392B' }, gp));
  let sal = 100, ln = lines[0];
  const frame = (dt) => {
    const n = Math.round(parts.length * sal / 150); 
    parts.forEach((p, i) => { const e = els[i]; if (i >= n) { e.setAttribute('opacity', 0); return; } e.setAttribute('opacity', 1);
      if (p.e) { p.e -= dt; p.x -= 40 * dt; if (p.e <= 0) { p.y = 260; p.x = 200 + (Math.random() - .5) * 14; p.e = 0; } } else { p.y -= 55 * dt; if (p.y < 190 && p.y > 150 && Math.random() < ln.ret * dt * 3) { p.e = 0.5; } if (p.y < 22) { p.y = 260; } } e.setAttribute('cx', p.x); e.setAttribute('cy', p.y); });
  };
  loopWhenVisible(node, frame);
  const upd = () => {
    ln = lines.find((l) => l.id === cur); sal = +sI.value; $('#nx-s-o', m).textContent = sal;
    const leaf = sal * (1 - ln.ret * 0.85) * 0.9, base = Math.max(0, 100 - 0.35 * sal), y = sal < 5 ? 100 * ln.pen : Math.min(100, base * ln.boost * (ln.id === 'nax2' ? 1 : 1) * ln.pen);
    $('#nx-leaf', svg).textContent = `Na⁺ у листку ≈ ${Math.round(leaf)} (відн.)`;
    info.innerHTML = `<h4>${ln.n}</h4><dl><dt>Na⁺ у листку</dt><dd>${Math.round(leaf)} відн. од.</dd><dt>Відносний урожай</dt><dd><b>${Math.round(y)} %</b></dd></dl><div class="st-bar"><i style="width:${y}%;--c:${y < 60 ? '#C0392B' : y < 80 ? '#E1A52C' : '#2F8F5B'}"></i></div><p class="st-hint">Достовірно відомо: Nax2 дав +25 % урожаю на засолених полях без втрат без засолення (Munns 2012); Nax1 поступався Tamaroi (James 2012). Решта — схематична шкала.</p>`;
  };
  m.addEventListener('input', upd);
  $('.st-chips', m).addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed($('.st-chips', m), cur); upd(); });
  upd(); if (REDUCED) frame(0.03);
};

/* ================================================================ термометр рослини */
W.thermo = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 300 330" class="st-sv" role="img" aria-label="Проросток Arabidopsis"></svg><div>${slider('th-t', 'Температура, °C', 17, 32, 22)}<div class="st-bars2"></div><div class="st-info" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), box = $('.st-bars2', m), tI = $('#th-t', m);
  const sg = (x, c, k) => 1 / (1 + Math.exp(-(x - c) / k));
  const upd = () => {
    const T = +tI.value; $('#th-t-o', m).textContent = T;
    const pfr = 1 - 0.55 * sg(T, 25, 2.6), elf = 1 - sg(T, 27, 1.3), pif = clamp(0.1 + 0.9 * sg(T, 25.5, 2.1)), yuc = pif, hyp = 2 + 5.5 * pif;
    const rows = [['phyB в формі Pfr', pfr, '#2B6CB0'], ['ELF3 активний (поза краплями)', elf, '#0E8F86'], ['PIF4 (активність)', pif, '#D1432B'], ['Ауксин (YUCCA8/TAA1)', yuc, '#B7791F']];
    box.innerHTML = rows.map((r) => `<div class="st-pair"><span>${r[0]}</span><div class="st-bar"><i style="width:${Math.round(r[1] * 100)}%;--c:${r[2]}"></i></div></div>`).join('');
    const hy = 40 + hyp * 22; const w = 3 + hyp * .1;
    svg.innerHTML = `<rect x="10" y="290" width="280" height="30" fill="#7B5A2E"/><path d="M150 290V${300 - hy}" stroke="#7FB85A" stroke-width="${w * 2}" stroke-linecap="round"/><path d="M150 ${300 - hy} q-50 -12 -62 14 q38 8 62 -14z" fill="#3E9A50"/><path d="M150 ${300 - hy} q50 -12 62 14 q-38 8 -62 -14z" fill="#3E9A50"/><text x="150" y="20" text-anchor="middle" class="tb">${T} °C</text><text x="150" y="40" text-anchor="middle" class="ts">гіпокотиль ≈ ${fmt(hyp)} мм</text>`;
    info.innerHTML = `<h4>${T < 24 ? 'Нормальна температура' : T < 28 ? 'Помірне підвищення: термоморфогенез' : 'Висока температура'}</h4><p>${T < 24 ? 'Pfr стабільний, ELF3 тримає промотори PIF4-мішеней «вимкненими», гіпокотиль короткий.' : 'Тепло прискорює реверсію Pfr → Pr, ELF3 переходить у конденсати, PIF4 вмикає синтез ауксину — гіпокотиль подовжується (Jung 2016; Legris 2016; Jung 2020).'}</p><p class="st-hint">Якісна схема для <i>Arabidopsis</i>; у злаків механізми можуть відрізнятися.</p>`;
  };
  m.addEventListener('input', upd); upd();
};

/* ================================================================ симулятор теплового шоку */
W.hsrsim = (node) => {
  const m = $('[data-mount]', node);
  const G = [{ id: 'wt', label: 'дикий тип' }, { id: 'hsp101', label: 'hsp101' }, { id: 'hsfa1', label: 'hsfa1 (мутант)' }, { id: 'prime', label: 'після акліматизації (37 °C)' }];
  let g = 'wt';
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 520 300" class="st-sv" role="img" aria-label="Динаміка білків і шаперонів за теплового шоку"></svg><div>${chips(G, g)}${slider('hs-t', 'Температура шоку, °C', 34, 46, 42)}${slider('hs-d', 'Тривалість, хв', 20, 180, 90, 10)}<div class="st-info" aria-live="polite" style="margin-top:10px"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), tI = $('#hs-t', m), dI = $('#hs-d', m);
  const sim = () => {
    const T = +tI.value, dur = +dI.value, tot = 360;
    let N = 1, U = 0, A = 0, H = g === 'prime' ? 2.4 : 1, minN = 1; const out = [];
    for (let t = 0; t <= tot; t++) {
      const Tc = t <= dur ? T : 22, kd = 0.012 * Math.exp((Tc - 37) / 2.3);
      const fold = 0.05 * H, agg = 0.05 * U * (1 + 8 * U), dis = (g === 'hsp101' ? 0.0004 : 0.03) * H;
      const hsf = g === 'hsfa1' ? 0 : U / (U + 0.06), syn = (g === 'hsfa1' ? 0.0004 : 0.016) * (1 + 4 * hsf);
      const dN = -kd * N + fold * U, dU = kd * N - fold * U - agg + dis * A, dA = agg - dis * A;
      N += dN; U += dU; A += dA; H += syn - 0.004 * (H - 1) * (g === 'prime' ? 0.3 : 1);
      N = clamp(N); U = clamp(U); A = clamp(A); minN = Math.min(minN, N); out.push([t, N, A, H]);
    } return { out, minN, Aend: A, Nend: N };
  };
  const draw = () => {
    $('#hs-t-o', m).textContent = tI.value; $('#hs-d-o', m).textContent = dI.value;
    const { out, minN, Aend, Nend } = sim(), dur = +dI.value;
    const X = (t) => 40 + t / 360 * 460, Y = (v) => 260 - v * 220;
    const pl = (k, sc, col) => `<path d="${out.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(Math.min(1.05, p[k] / sc)).toFixed(1)).join('')}" fill="none" stroke="${col}" stroke-width="2.8"/>`;
    svg.innerHTML = `<rect x="${X(0)}" y="30" width="${X(dur) - X(0)}" height="230" fill="#FBE0D8" opacity=".6"/><text x="${X(dur / 2)}" y="46" text-anchor="middle" class="tm">стрес</text><path d="M40 260H500M40 40V260" stroke="#46584C"/><text x="270" y="288" text-anchor="middle" class="ts">час, хв</text><text x="10" y="150" transform="rotate(-90 10 150)" text-anchor="middle" class="ts">частка / відн. рівень</text>` + pl(1, 1, '#2F8F5B') + pl(2, 1, '#D1432B') + pl(3, 10, '#4C8DD6') + `<g class="tb"><text x="300" y="70" style="fill:#2F8F5B">нативні білки</text><text x="300" y="88" style="fill:#4C8DD6">шаперони (HSP, відн.)</text><text x="300" y="106" style="fill:#D1432B">агрегати</text></g>`;
    const ok = minN > 0.2 && Aend < 0.05;
    info.innerHTML = `<h4 class="${ok ? 'st-ok' : 'st-bad'}">${ok ? 'Рослина виживає й відновлюється' : 'Критичне ушкодження: відновлення неповне'}</h4><dl><dt>Мінімум нативних білків</dt><dd>${Math.round(minN * 100)} %</dd><dt>Агрегатів наприкінці</dt><dd>${Math.round(Aend * 100)} %</dd></dl><p class="st-hint">${g === 'hsp101' ? 'Без дезагрегази HSP101 агрегати лишаються — це пояснює, чому hsp101 не набуває термотолерантності. ' : g === 'hsfa1' ? 'Без HSFA1 шаперони не синтезуються, і система спирається лише на початковий запас. ' : g === 'prime' ? 'Акліматизований рослинний «запас» шаперонів дозволяє переживати вищу температуру. ' : ''}Модель якісна: узагальнена схема «денатурація → шаперони → відновлення» (Queitsch 2000; Ohama 2017).</p>`;
  };
  m.addEventListener('input', draw);
  $('.st-chips', m).addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; g = b.dataset.id; setPressed($('.st-chips', m), g); draw(); });
  draw();
};

/* ================================================================ заморозок на рівні клітини */
W.freeze = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="st-stage st-stage--col"><div>${slider('fz-t', 'Температура тканини, °C', -20, 2, -9)}</div><svg viewBox="0 0 700 300" class="st-sv" role="img" aria-label="Клітини під час замерзання"></svg><div class="st-info" aria-live="polite"></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), tI = $('#fz-t', m);
  const leak = (T, lt) => 1 / (1 + Math.exp((T - lt) / 1.6));
  const vol = (T, acc) => { const Tn = -T; if (Tn < (acc ? 2.5 : 2)) return 1; return 1 - (acc ? 0.42 : 0.55) * (1 - Math.exp(-(Tn - 2) / 6)); };
  const cellSvg = (cx, label, acc, T) => {
    const v = vol(T, acc), lk = leak(T, acc ? -15 : -6), w = 150 * Math.sqrt(v), h = 150 * Math.sqrt(v), ice = T < (acc ? -3 : -2);
    let s = `<text x="${cx}" y="22" text-anchor="middle" class="tb">${label}</text>`;
    if (ice) for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rx = cx + Math.cos(a) * 100, ry = 150 + Math.sin(a) * 100; s += `<path d="M${cx + Math.cos(a) * 82} ${150 + Math.sin(a) * 82}L${rx} ${ry}" stroke="#A9D6F5" stroke-width="5" stroke-linecap="round"/>`; }
    s += `<rect x="${cx - 80}" y="70" width="160" height="160" rx="22" fill="none" stroke="#8B6B3A" stroke-width="5"/><rect x="${cx - w / 2}" y="${150 - h / 2}" width="${w}" height="${h}" rx="18" fill="${lk > .5 ? '#F2C1B5' : acc ? '#CDE8B0' : '#D5EBB8'}" stroke="${lk > .5 ? '#C0392B' : '#2F8F5B'}" stroke-width="${lk > .5 ? 4 : 3}" ${lk > .5 ? 'stroke-dasharray="6 5"' : ''}/>`;
    if (acc) s += `<circle cx="${cx - 10}" cy="150" r="5" fill="#E1A52C"/><circle cx="${cx + 12}" cy="162" r="5" fill="#E1A52C"/><circle cx="${cx + 4}" cy="136" r="5" fill="#E1A52C"/>`;
    s += `<text x="${cx}" y="258" text-anchor="middle" class="ts">об’єм ≈ ${Math.round(v * 100)} % · витік електролітів ≈ ${Math.round(lk * 100)} %</text><text x="${cx}" y="276" text-anchor="middle" class="tm">${acc ? 'сахарози, COR15A, дегідрини, AFP' : 'без акліматизації'}</text>`; return s;
  };
  const draw = () => {
    const T = +tI.value; $('#fz-t-o', m).textContent = T;
    svg.innerHTML = cellSvg(175, 'Неакліматизована клітина', false, T) + cellSvg(525, 'Акліматизована (холодове загартування)', true, T);
    const a = leak(T, -6), b = leak(T, -15);
    info.innerHTML = `<h4>${T > -2 ? 'Над нулем або легке переохолодження' : 'Позаклітинний лід «висмоктує» воду з клітин'}</h4><p>Вода випаровується в лід, клітина зневоднюється — це дегідратаційний стрес, тому цукри, дегідрини й COR15A працюють так само, як за посухи. Мембрана ушкоджується, коли об’єм падає надто сильно (фазовий перехід до гексагональної фази II). Умовні LT50: ≈ −6 °C (без акліматизації) і ≈ −15 °C (з акліматизацією). Витік: <b>${Math.round(a * 100)} %</b> проти <b>${Math.round(b * 100)} %</b>.</p><p class="st-hint">Якісна модель; числа LT50 — ілюстративні й залежать від виду.</p>`;
  };
  m.addEventListener('input', draw); draw();
};

/* ================================================================ скільки варіації пояснюють гени */
W.varexp = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="st-var">${D.varexp.map((r) => `<div class="st-var__row"><span>${r[0]}</span><div class="st-bar st-bar--tall"><i style="width:${r[2]}%;--c:#C9DDE9"></i><i style="width:${r[1]}%;--c:#3B82C4;position:absolute;left:0;top:0"></i><b>${r[1] === r[2] ? (r[3] === 'близько' ? '≈ ' : '') + String(r[1]).replace('.', ',') + ' %' : r[1] + '–' + r[2] + ' %'}</b></div></div>`).join('')}</div><p class="st-hint">Різні панелі, моделі й показники: порівнювати рядки між собою некоректно. Для української селекції власних оцінок CNV <i>CBF</i> немає.</p>`;
};

/* ================================================================ N-degron: як рослина «рахує» кисень */
W.ndegron = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 480 330" class="st-sv" role="img" aria-label="N-degron шлях і ERF-VII"></svg><div>${slider('nd-o', 'Кисень, % (повітря = 21)', 0, 21, 21)}<label class="st-check"><input type="checkbox" id="nd-e"> Етилен накопичується (під водою)</label><div class="st-bars2"></div><div class="st-info" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), box = $('.st-bars2', m), oI = $('#nd-o', m), eI = $('#nd-e', m);
  const steps = ['MetAP відщеплює Met', 'N-кінцевий Cys відкрито', 'PCO окиснює Cys (потрібен O₂ і NO)', 'ATE додає Arg', 'PRT6 (E3-лігаза)', 'Протеасома'];
  const upd = () => {
    const O = +oI.value, eth = eI.checked; $('#nd-o-o', m).textContent = O;
    const NO = eth ? 0.35 : 1, act = O / (O + 8) * NO, S = 1 - act;
    let s = '<defs><marker id="nd-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#46584C"/></marker></defs>';
    steps.forEach((t, i) => { const y = 14 + i * 52, op = i < 2 ? 1 : 0.25 + 0.75 * act; s += `<rect x="20" y="${y}" width="260" height="38" rx="12" fill="${i === 2 ? '#E4F4EA' : '#fff'}" stroke="#2F8F5B" stroke-width="2" opacity="${op}"/><text x="150" y="${y + 24}" text-anchor="middle" class="ts" opacity="${op}">${t}</text>${i < 5 ? `<path d="M150 ${y + 38}V${y + 52}" stroke="#46584C" stroke-width="2" marker-end="url(#nd-a)" opacity="${op}"/>` : ''}`; });
    s += `<rect x="310" y="14" width="150" height="150" rx="14" fill="#FFF1EC" stroke="#C0392B" stroke-width="2" opacity="${.25 + .75 * S}"/><text x="385" y="38" text-anchor="middle" class="tb">ERF-VII у ядрі</text><text x="385" y="58" text-anchor="middle" class="tm">стабільні: ${Math.round(S * 100)} %</text>`;
    ['ADH1', 'PDC1', 'SUS', 'HB1', 'LBD41', 'PCO1/2'].forEach((g, i) => { s += `<rect x="320" y="${68 + i * 15}" width="${130 * S}" height="10" rx="4" fill="#C0392B" opacity=".75"/><text x="324" y="${77 + i * 15}" class="tm" style="fill:#fff;font-size:9px">${g}</text>`; });
    s += `<path d="M385 164V196" stroke="#C0392B" stroke-width="3" marker-end="url(#nd-a)"/><text x="385" y="216" text-anchor="middle" class="ts">бродіння, пошук цукру,</text><text x="385" y="232" text-anchor="middle" class="ts">гемоглобіни, PCO ↺</text>`;
    svg.innerHTML = s;
    box.innerHTML = [['ERF-VII стабільні', S, '#C0392B'], ['Активність PCO', act, '#2F8F5B']].map((r) => `<div class="st-pair"><span>${r[0]}</span><div class="st-bar"><i style="width:${Math.round(r[1] * 100)}%;--c:${r[2]}"></i></div></div>`).join('');
    info.innerHTML = `<h4>${S < 0.4 ? 'Кисню достатньо: ERF-VII розпадаються' : S < 0.8 ? 'Гіпоксія: ERF-VII накопичуються' : 'Анаеробіоз: гени бродіння активні'}</h4><p>${eth && O > 10 ? 'Етилен індукує фітоглобін, що поглинає NO; деградації ERF-VII бракує NO — тому гіпоксійна програма вмикається ще до реального падіння O₂. ' : ''}Кисень сприймається як субстрат ферменту PCO, а не мембранним рецептором — аналог пролілгідроксилаз/HIF1α у тварин.</p><p class="st-hint">Модель якісна: стабільність ERF-VII = 1 − (O₂/(O₂ + K))·NO.</p>`;
  };
  m.addEventListener('input', upd); m.addEventListener('change', upd); upd();
};

/* ================================================================ рис під водою */
W.submerge = (node) => {
  const m = $('[data-mount]', node);
  const PL = { normal: { n: 'Звичайний сорт', rate: 12, grow: 0.3 }, sub1a: { n: 'SUB1A (спокій)', rate: 4, grow: 0.05 }, sk: { n: 'SK1/2 (втеча)', rate: 5, grow: 7 } };
  const FL = { flash: { n: 'Швидка повінь (2 тижні)' }, deep: { n: 'Глибока повільна (2 місяці)' } };
  let pl = 'normal', fl = 'flash', day = 0, playing = 0;
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 440 320" class="st-sv" role="img" aria-label="Рис під водою"></svg><div>${chips(Object.entries(PL).map(([id, v]) => ({ id, label: v.n })), pl)}<p class="st-hint">Тип повені:</p>${chips(Object.entries(FL).map(([id, v]) => ({ id, label: v.n })), fl, 'data-f')}${slider('sm-d', 'День', 0, 60, 0)}<div class="st-row"><button type="button" class="st-btn" data-play>▶ Пуск</button></div><div class="st-info" aria-live="polite" style="margin-top:10px"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), dI = $('#sm-d', m), boxes = $$('.st-chips', m);
  const water = (t) => fl === 'flash' ? (t < 3 ? 27 * t : t < 14 ? 80 : t < 17 ? 80 - 27 * (t - 14) : 0) : Math.min(180, 3 * t);
  const simulate = (d) => { let H = 40, C = 100, dead = -1; const P = PL[pl]; for (let t = 1; t <= d; t++) { const W0 = water(t), sub = W0 > H; if (sub) { C -= P.rate; if (pl === 'sk') H += P.grow; else H += P.grow; } else H += pl === 'sk' ? 0.8 : 0.5; if (pl === 'sk' && sub) H = Math.min(H, W0 + 25); if (C <= 0 && dead < 0) { dead = t; C = 0; } } return { H, C, dead, W: water(d) }; };
  const draw = () => {
    day = +dI.value; $('#sm-d-o', m).textContent = day;
    const r = simulate(day), alive = r.dead < 0, sc = 1.15, gy = 285, px = (cm) => gy - cm * sc;
    let s = `<rect x="0" y="0" width="440" height="${gy}" fill="#EAF4FB"/><rect x="0" y="${gy}" width="440" height="35" fill="#7B5A2E"/><rect x="0" y="${px(r.W)}" width="440" height="${r.W * sc}" fill="#6AA8D8" opacity=".5"/><path d="M0 ${px(r.W)}H440" stroke="#2B6CB0" stroke-width="2"/>`;
    for (let i = 0; i < 5; i++) { const x = 60 + i * 80, h = r.H * (0.9 + 0.05 * (i % 3)); const col = alive ? '#3E9A50' : '#9C7A3C'; s += `<path d="M${x} ${gy}V${gy - h * sc}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`; for (let k = 0; k < 4; k++) { const yy = gy - h * sc + k * 14, dir = k % 2 ? 1 : -1; s += `<path d="M${x} ${yy}q${dir * 30} -4 ${dir * 44} 22" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>`; } }
    s += `<text x="12" y="20" class="tb">день ${day}</text><text x="12" y="38" class="ts">вода ≈ ${Math.round(r.W)} см · висота ≈ ${Math.round(r.H)} см</text>`;
    svg.innerHTML = s;
    const msg = alive ? (day >= 60 || (fl === 'flash' && day >= 17) ? 'Рослина вижила.' : 'Рослина виживає.') : `Рослина загинула на ${r.dead}-й день: вуглеводи вичерпано.`;
    info.innerHTML = `<h4 class="${alive ? 'st-ok' : 'st-bad'}">${PL[pl].n}</h4><div class="st-pair"><span>Запас вуглеводів</span><div class="st-bar"><i style="width:${Math.max(0, Math.round(r.C))}%;--c:${r.C < 25 ? '#C0392B' : '#2F8F5B'}"></i></div></div><p>${msg}</p><p class="st-hint">${pl === 'sub1a' ? 'SUB1A гальмує ріст (DELLA SLR1/SLRL1) і береже вуглеводи — перемагає в короткій повені, програє в глибокій. ' : pl === 'sk' ? 'SK1/2 запускають GA-залежне подовження міжвузлів — перемагає в глибокій повільній повені, у швидкій може виснажитися. ' : 'Звичайний сорт швидко витрачає вуглеводи й гине. '}Схематична модель; значення швидкостей ілюстративні.</p>`;
  };
  boxes[0].addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; pl = b.dataset.id; setPressed(boxes[0], pl); draw(); });
  boxes[1].addEventListener('click', (e) => { const b = e.target.closest('button[data-f]'); if (!b) return; fl = b.dataset.f; setPressed(boxes[1], fl, 'data-f'); draw(); });
  dI.addEventListener('input', draw);
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-play]'); if (!b) return; if (playing) { clearInterval(playing); playing = 0; b.textContent = '▶ Пуск'; return; } if (+dI.value >= 60) dI.value = 0; b.textContent = '⏸ Пауза'; playing = setInterval(() => { if (+dI.value >= 60) { clearInterval(playing); playing = 0; b.textContent = '▶ Пуск'; return; } dI.value = +dI.value + 1; draw(); }, REDUCED ? 30 : 150); });
  setPressed(boxes[1], fl, 'data-f'); draw();
};

/* ================================================================ аеренхіма */
W.aer = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 400 320" class="st-sv" role="img" aria-label="Переріз кореня з аеренхімою"></svg><div>${slider('ae-t', 'Тривалість затоплення, діб', 0, 7, 4)}<label class="st-check"><input type="checkbox" id="ae-r"> Бар’єр ROL (суберин, лігнін екзодерми)</label><div class="st-bars2"></div><div class="st-info" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), box = $('.st-bars2', m), tI = $('#ae-t', m), rI = $('#ae-r', m);
  const cells = []; const cx = 200, cy = 160; for (let ring = 0; ring < 4; ring++) { const n = 10 + ring * 6, rr = 55 + ring * 26; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + ring * 0.2; cells.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, r: 12, ring, k: ((i * 7 + ring * 13) % 17) / 17 }); } }
  const upd = () => {
    const t = +tI.value, rol = rI.checked; $('#ae-t-o', m).textContent = t;
    const f = clamp((t - 1) / 4);
    let s = `<circle cx="${cx}" cy="${cy}" r="${141}" fill="#F5F1E1" stroke="${rol ? '#6A3B12' : '#7B5A2E'}" stroke-width="${rol ? 9 : 4}"/><circle cx="${cx}" cy="${cy}" r="30" fill="#BFE3F2" stroke="#2B6CB0" stroke-width="3"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="tm">стела</text>`;
    cells.forEach((c) => { const gone = c.ring >= 1 && c.ring <= 2 && c.k < f * 0.95; s += gone ? `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.r}" fill="#FFFFFF" stroke="#C9B98E" stroke-dasharray="3 3"/>` : `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.r}" fill="#CDE8B0" stroke="#7FAF6A"/>`; });
    const leak = rol ? 0.06 : 0.38;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; s += `<path d="M${cx + Math.cos(a) * 143} ${cy + Math.sin(a) * 143}L${cx + Math.cos(a) * (143 + 40 * leak + 6)} ${cy + Math.sin(a) * (143 + 40 * leak + 6)}" stroke="#2B6CB0" stroke-width="${2 + 4 * leak}" opacity="${.3 + leak}"/>`; }
    s += `<text x="200" y="14" text-anchor="middle" class="tb">переріз кореня</text><text x="200" y="312" text-anchor="middle" class="ts">білі кола — аеренхіма (повітряні порожнини)</text>`;
    svg.innerHTML = s;
    const lam = 2 + 18 * f, O2 = t < 1 ? 17 : 21 * Math.exp(-10 / lam) * (1 - leak * 0.7);
    box.innerHTML = [['Пористість кори', f, '#7FAF6A'], ['O₂ на кінчику кореня, % від 21', O2 / 21, O2 > 7 ? '#2F8F5B' : '#C0392B']].map((r) => `<div class="st-pair"><span>${r[0]}</span><div class="st-bar"><i style="width:${Math.round(r[1] * 100)}%;--c:${r[2]}"></i></div></div>`).join('');
    info.innerHTML = `<h4>${t < 1 ? 'Нормальний корінь' : f < 1 ? 'Етилен запускає загибель клітин кори' : 'Сформована аеренхіма'}</h4><p>Етилен → RBOH-залежні АФК і Ca²⁺ → програмована загибель клітин кори (лізигенна аеренхіма). O₂ тепер дифундує газовою фазою до кінчика. ${rol ? 'Бар’єр ROL зменшує втрату O₂ в ґрунт і вхід Fe²⁺/Mn²⁺/H₂S.' : 'Без бар’єра значна частина O₂ «витікає» в ризосферу.'}</p><p class="st-hint">Якісна модель: O₂ ≈ 21·e^(−L/λ), де λ зростає з пористістю.</p>`;
  };
  m.addEventListener('input', upd); m.addEventListener('change', upd); upd();
};

/* ================================================================ шлях металу */
W.metal = (node) => {
  const m = $('[data-mount]', node);
  const labels = ['Апопласт', 'Вхід у клітину', 'Цитозоль: хелатування', 'Вакуоля: секвестрація', 'Ксилема: транслокація'];
  let cur = 'cd';
  m.innerHTML = `<div class="st-metal">${chips(D.metals.map((x) => ({ id: x.id, label: x.n, col: x.col })), cur)}<ol class="st-flow"></ol><div class="st-info"></div></div>`;
  const ol = $('.st-flow', m), info = $('.st-info', m), box = $('.st-chips', m);
  const draw = () => { const x = D.metals.find((z) => z.id === cur); ol.style.setProperty('--c', x.col); ol.innerHTML = x.steps.map((t, i) => `<li style="--i:${i}"><b>${labels[i]}</b><span>${t}</span></li>`).join(''); info.innerHTML = `<h4 style="color:${x.col}">${x.n}</h4><p>${x.note}</p>`; };
  box.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed(box, cur); draw(); });
  draw();
};

/* ================================================================ компроміс NRAMP5 */
W.nramp5 = (node) => {
  const m = $('[data-mount]', node);
  let cur = 'wt', soil = 'ok';
  m.innerHTML = `<div class="st-stage"><div>${chips(D.nramp5.map((x) => ({ id: x.id, label: x.n })), cur)}<p class="st-hint">Ґрунт:</p>${chips([{ id: 'ok', label: 'Mn достатньо' }, { id: 'low', label: 'нестача Mn' }, { id: 'heat', label: 'спека' }], soil, 'data-s')}</div><div class="st-info" aria-live="polite"></div></div>`;
  const boxes = $$('.st-chips', m), info = $('.st-info', m);
  const bar = (lab, v, col) => `<div class="st-pair"><span>${lab}</span><div class="st-bar ${v == null ? 'st-bar--unk' : ''}"><i style="width:${v == null ? 100 : Math.round(v)}%;--c:${col}"></i></div><b class="st-pair__v">${v == null ? '↓' : Math.round(v) + ' %'}</b></div>`;
  const draw = () => {
    const x = D.nramp5.find((z) => z.id === cur);
    const risk = cur === 'ko' ? (soil === 'ok' ? 'Втрат урожаю на ґрунтах із достатнім Mn немає.' : 'Рис вразливий: нестача Mn і спека знижують урожай.') : cur === 'q337k' ? 'Слабкий алель: помірне зниження Cd і Mn при однаковому врожаї в полі.' : cur === 'hma3' ? 'Mn-живлення не порушується.' : 'Базовий рівень: Cd у зерні високий на забруднених ґрунтах.';
    const riskCol = cur === 'ko' && soil !== 'ok' ? 'st-bad' : 'st-ok';
    info.innerHTML = `<h4>${x.n}</h4>${bar('Cd у зерні (дикий тип = 100 %)', x.cd, '#C0392B')}${bar('Mn у зерні (дикий тип = 100 %)', x.mn, '#2F8F5B')}<p class="${riskCol}"><b>${risk}</b></p><p>${x.y}</p><p class="st-hint">Достовірні числа: нокаут — понад 90 % менше Cd; Q337K — −50 % Cd, −30 % Mn (Sasaki 2012; Ishikawa 2012; Tang 2017; Ueno 2010). Стрілка «↓» — зниження без точного значення.</p>`;
  };
  boxes[0].addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed(boxes[0], cur); draw(); });
  boxes[1].addEventListener('click', (e) => { const b = e.target.closest('button[data-s]'); if (!b) return; soil = b.dataset.s; setPressed(boxes[1], soil, 'data-s'); draw(); });
  setPressed(boxes[1], soil, 'data-s'); draw();
};

/* ================================================================ алюміній */
W.algate = (node) => {
  const m = $('[data-mount]', node);
  const G = [{ id: 's', n: 'Чутливий', ex: 0 }, { id: 'almt', n: 'TaALMT1 (малат)', ex: 0.7 }, { id: 'mate', n: 'SbMATE (цитрат)', ex: 0.82 }];
  let cur = 's';
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 300 300" class="st-sv" role="img" aria-label="Кінчик кореня й Al"></svg><div>${chips(G.map((x) => ({ id: x.id, label: x.n })), cur)}${slider('al-p', 'pH ґрунту', 3.5, 6.5, 4.5, 0.1)}<div class="st-bars2"></div><div class="st-info" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), box = $('.st-bars2', m), pI = $('#al-p', m);
  const upd = () => {
    const pH = +pI.value; $('#al-p-o', m).textContent = fmt(pH); const g = G.find((x) => x.id === cur);
    const Al = 100 / (1 + Math.exp((pH - 4.9) / 0.35)), eff = Al * (1 - g.ex), L = 100 * (1 - 0.92 * eff / (eff + 28));
    const tipY = 50 + 190 * (L / 100);
    let s = `<rect x="0" y="0" width="300" height="300" fill="#F0E3CB"/><circle cx="150" cy="${tipY}" r="${16 + Al * 0.55}" fill="#8E9AA5" opacity="${(0.12 + Al / 100 * .4).toFixed(2)}"/><path d="M150 14V${tipY}" stroke="#6A3B12" stroke-width="22" stroke-linecap="round"/>`;
    if (g.ex > 0) for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, rr = 18 + Math.random() * 24; s += `<circle cx="${150 + Math.cos(a) * rr}" cy="${tipY + Math.sin(a) * rr}" r="3.4" fill="#E1A52C"/>`; }
    s += `<text x="150" y="292" text-anchor="middle" class="ts">${g.ex > 0 ? '● — органічні кислоти, що хелатують Al³⁺' : 'Al³⁺ потрапляє в апекс кореня'}</text>`;
    svg.innerHTML = s;
    box.innerHTML = [['Вільний Al³⁺ (відн.)', Al / 100, '#7F8C8D'], ['Ріст кореня, % від норми', L / 100, L < 40 ? '#C0392B' : '#2F8F5B']].map((r) => `<div class="st-pair"><span>${r[0]}</span><div class="st-bar"><i style="width:${Math.round(r[1] * 100)}%;--c:${r[2]}"></i></div></div>`).join('');
    info.innerHTML = `<h4>${g.n}</h4><p>${pH > 5.4 ? 'За pH > 5,5 Al переважно нерозчинний — токсичності немає.' : g.ex ? 'Корінь виводить із апекса малат/цитрат, які зв’язують Al³⁺ у хелат поза клітиною, тому ріст значною мірою зберігається.' : 'Чутливий генотип не виводить кислоти — Al³⁺ швидко зупиняє подовження клітин.'}</p><p class="st-hint">Якісна модель: рівень Al³⁺ залежить від pH за сигмоїдою; виведення знижує ефективну концентрацію.</p>`;
  };
  m.addEventListener('input', upd);
  $('.st-chips', m).addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed($('.st-chips', m), cur); upd(); });
  upd();
};

/* ================================================================ гормональна мережа */
W.hormnet = (node) => {
  const m = $('[data-mount]', node);
  let cur = 'drought', sel = 'aba';
  m.innerHTML = `<div class="st-hn">${chips(D.stresses.map((s) => ({ id: s.id, label: s.name, col: s.col })), cur)}<div class="st-stage"><svg viewBox="0 0 460 380" class="st-sv" role="img" aria-label="Гормональна мережа"></svg><div class="st-info" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), box = $('.st-chips', m);
  const pos = {}; D.hormones.forEach((h, i) => { const a = i / D.hormones.length * Math.PI * 2 - Math.PI / 2; pos[h.id] = [230 + Math.cos(a) * 150, 180 + Math.sin(a) * 122]; });
  const G = ['↓', '~', '↑', '↑↑'];
  const draw = () => {
    const map = D.hmap[cur]; let s = '<defs><marker id="hn-p" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2F8F5B"/></marker><marker id="hn-n" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#C0392B"/></marker></defs>';
    D.hedges.forEach(([a, b, d]) => { const [x1, y1] = pos[a], [x2, y2] = pos[b]; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); s += `<path d="M${x1 + dx / L * 30} ${y1 + dy / L * 30}L${x2 - dx / L * 33} ${y2 - dy / L * 33}" stroke="${d > 0 ? '#2F8F5B' : '#C0392B'}" stroke-width="2" ${d < 0 ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#${d > 0 ? 'hn-p' : 'hn-n'})" opacity=".55" fill="none"/>`; });
    D.hormones.forEach((h) => { const [x, y] = pos[h.id], v = map[h.id], r = 27 + v * 3; s += `<g class="hn-n" data-h="${h.id}" tabindex="0" role="button" aria-label="${h.n}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${r}" fill="${h.col}" opacity="${v === 0 ? .5 : v < 0 ? .55 : .95}" stroke="${sel === h.id ? '#1B3B28' : '#fff'}" stroke-width="${sel === h.id ? 4 : 2}"/><text x="${x}" y="${y - 1}" text-anchor="middle" class="tb" style="fill:#fff;font-size:13px">${h.sh}</text><text x="${x}" y="${y + 15}" text-anchor="middle" class="tb" style="fill:#fff;font-size:14px">${G[v + 1]}</text><text x="${x}" y="${y + r + 14}" text-anchor="middle" class="tm">${h.n}</text></g>`; });
    s += `<text x="12" y="368" class="tm">→ активація · ⊣ (пунктир) пригнічення · ↑ зростання · ↓ спадання</text>`;
    svg.innerHTML = s;
    const h = D.hormones.find((x) => x.id === sel), v = map[h.id];
    info.innerHTML = `<h4 style="color:${h.col}">${h.n} · ${ST[cur].name.toLowerCase()}: ${['знижується', 'без змін / змінно', 'зростає', 'різко зростає'][v + 1]}</h4><p>${h.d}</p>${D.hnote[cur] ? `<p class="st-hint">${D.hnote[cur]}</p>` : ''}<p class="st-hint">Напрями узагальнено; у різних видах і фазах стресу бувають виключення.</p>`;
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed(box, cur); draw(); });
  svg.addEventListener('click', (e) => { const g = e.target.closest('[data-h]'); if (!g) return; sel = g.dataset.h; draw(); });
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const g = e.target.closest('[data-h]'); if (g) { e.preventDefault(); sel = g.dataset.h; draw(); } } });
  draw();
};

/* ================================================================ ріст – стійкість */
W.tradeoff = (node) => {
  const m = $('[data-mount]', node);
  const S = [{ id: 'wt', n: 'Дикий тип', good: 100, bad: 50, col: '#7B8794' }, { id: 'c35', n: 'Надекспресія під 35S (конститутивно)', good: 68, bad: 84, col: '#C0392B' }, { id: 'ind', n: 'Стресоіндукований промотор (rd29A)', good: 98, bad: 86, col: '#2F8F5B' }];
  m.innerHTML = `<div>${slider('to-f', 'Частка посушливих років, %', 0, 100, 30, 5)}<div class="st-var"></div><div class="st-info" aria-live="polite"></div></div>`;
  const box = $('.st-var', m), info = $('.st-info', m), fI = $('#to-f', m);
  const upd = () => {
    const f = +fI.value / 100; $('#to-f-o', m).textContent = fI.value;
    const res = S.map((s) => ({ ...s, avg: (1 - f) * s.good + f * s.bad })); const best = res.reduce((a, b) => (b.avg > a.avg ? b : a));
    box.innerHTML = res.map((s) => `<div class="st-var__row"><span>${s.n}</span><div class="st-bar st-bar--tall"><i style="width:${s.avg}%;--c:${s.col}"></i><b>${Math.round(s.avg)} %</b></div></div>`).join('');
    info.innerHTML = `<h4>Найкраща стратегія за такої частоти посух: <span style="color:${best.col}">${best.n.toLowerCase()}</span></h4><p>У добрі роки конститутивна надекспресія коштує росту (карликовість), у посушливі — окупається. Індукований промотор вмикає захист лише за потреби й майже не програє в нормі.</p><p class="st-hint">Схематична модель: урожай у добрі/посушливі роки — 100/50 (дикий тип), 68/84 (35S), 98/86 (rd29A); значення ілюстративні й не є експериментальними.</p>`;
  };
  m.addEventListener('input', upd); upd();
};

/* ================================================================ хвиля сигналу */
W.wave = (node) => {
  const m = $('[data-mount]', node);
  const N = 24, tracks = [{ id: 'ros', n: 'АФК-хвиля (RBOHD)', v: 1.0, col: '#D1432B', ko: 'rbohd' }, { id: 'ca', n: 'Ca²⁺-хвиля', v: 0.3, col: '#3B82C4', ko: 'glr' }];
  let t0 = null, start = 0;
  m.innerHTML = `<div class="st-wave"><div class="st-row"><button type="button" class="st-btn" data-go>▶ Подразнити корінь</button><label class="st-check"><input type="checkbox" data-ko="rbohd"> rbohd</label><label class="st-check"><input type="checkbox" data-ko="glr"> glr3.3/glr3.6</label></div>${tracks.map((tr) => `<div class="st-wave__t" style="--c:${tr.col}"><span>${tr.n}</span><div class="st-wave__cells">${Array.from({ length: N }, () => '<i></i>').join('')}</div></div>`).join('')}<div class="st-wave__lab"><span>корінь</span><span>стебло</span><span>листок</span></div><div class="st-info" aria-live="polite"></div></div>`;
  const info = $('.st-info', m), rows = $$('.st-wave__cells', m).map((r) => $$('i', r));
  const kos = () => ({ rbohd: $('[data-ko=rbohd]', m).checked, glr: $('[data-ko=glr]', m).checked });
  const paint = (tt) => { const k = kos(); tracks.forEach((tr, ti) => { const block = (tr.ko === 'rbohd' && k.rbohd) ? 3 : (tr.ko === 'glr' && k.glr) ? 6 : N; const front = tt === null ? -1 : tt * tr.v * 4; rows[ti].forEach((c, i) => { const on = i <= front && i < block; c.style.opacity = on ? 1 : 0.18; c.style.transform = on && i > front - 2 ? 'scaleY(1.5)' : 'none'; }); }); };
  const frame = (now) => { const tt = (now - start) / 1000; paint(tt); if (tt < 14) requestAnimationFrame(frame); };
  const go = () => { start = performance.now(); const k = kos(); if (REDUCED) { paint(14); } else requestAnimationFrame(frame);
    info.innerHTML = `<h4>${k.rbohd ? 'RBOHD вимкнено: АФК-хвиля обривається на початку.' : k.glr ? 'GLR вимкнено: Ca²⁺-сигнал гасне на півдорозі.' : 'Хвилі досягають листка'}</h4><p>АФК-хвиля — порядку 8 см/хв (Miller 2009); Ca²⁺-хвиля під час засолення — близько 400 мкм/с (Choi 2014); у глутаматних рецепторів GLR є ключова роль у дальній передачі Ca²⁺-сигналу (Toyota 2018). Швидкість показано відносно.</p>`; };
  m.addEventListener('click', (e) => { if (e.target.closest('[data-go]')) go(); });
  m.addEventListener('change', () => { paint(null); info.innerHTML = '<p class="st-hint">Натисніть «Подразнити корінь».</p>'; });
  paint(null); info.innerHTML = '<p class="st-hint">Натисніть «Подразнити корінь» і спостерігайте.</p>';
};

/* ================================================================ комбінація стресів і дилема продихів */
W.combo = (node) => {
  const m = $('[data-mount]', node);
  const names = ['Спека', 'Засолення', 'Яскраве світло', 'Cd', 'Кислотність', 'Паракват'];
  let mode = 'stack', on = new Set();
  m.innerHTML = `<div>${chips([{ id: 'stack', label: 'Шість слабких стресів' }, { id: 'dil', label: 'Дилема продихів: посуха + спека' }], mode)}<div class="st-body"></div></div>`;
  const body = $('.st-body', m), box = $('.st-chips', m);
  const draw = () => {
    if (mode === 'stack') {
      body.innerHTML = `<p class="st-hint">Увімкніть стреси (кожен — низької інтенсивності):</p><div class="st-chips">${names.map((n, i) => `<button type="button" data-i="${i}" aria-pressed="${on.has(i)}" style="--c:#7E57C2">${n}</button>`).join('')}</div><div class="st-var"></div><div class="st-info"></div>`;
      const n = on.size, add = 100 - 2.5 * n, real = 100 - 95 * Math.pow(n / 6, 2.2), surv = 100 - 85 * Math.pow(n / 6, 3);
      $('.st-var', body).innerHTML = [['Ріст за адитивним прогнозом', add, '#7B8794'], ['Ріст за «реальною» відповіддю', real, '#C0392B'], ['Виживання', surv, '#2F8F5B']].map((r) => `<div class="st-var__row"><span>${r[0]}</span><div class="st-bar st-bar--tall"><i style="width:${r[1]}%;--c:${r[2]}"></i><b>${Math.round(r[1])} %</b></div></div>`).join('');
      $('.st-info', body).innerHTML = `<h4>Активних стресів: ${n}</h4><p>${n === 0 ? 'Натискайте на стреси — побачите, як «реальна» відповідь відхиляється від суми.' : n < 3 ? 'Один-два слабких стреси майже не змінюють ріст — тут адитивний прогноз працює.' : 'Починаючи з трьох-чотирьох стресів ріст і виживання падають непропорційно: транскрипційна відповідь унікальна, а не сума окремих (Zandalinas 2021).'}</p><p class="st-hint">Криві схематичні; експеримент — Zandalinas et al., 2021 (спека, сіль, світло, Cd, кислотність, паракват).</p>`;
    } else {
      body.innerHTML = `<div class="st-row">${slider('cb-g', 'Провідність продихів, %', 0, 100, 50)}${slider('cb-t', 'Температура повітря, °C', 25, 45, 38)}</div><label class="st-check"><input type="checkbox" id="cb-d" checked> Ґрунт сухий</label><div class="st-var"></div><div class="st-info"></div>`;
      const upd = () => { const g = +$('#cb-g', body).value / 100, T = +$('#cb-t', body).value, dry = $('#cb-d', body).checked; $('#cb-g-o', body).textContent = Math.round(g * 100); $('#cb-t-o', body).textContent = T;
        const leaf = T + 9 * (1 - g) * (T - 20) / 20, loss = g * (0.5 + (T - 20) / 25), dehyd = dry ? loss : loss * 0.35, hotDmg = clamp((leaf - 38) / 8), dehydDmg = clamp((dehyd - 0.45) / 0.8);
        $('.st-var', body).innerHTML = [['Температура листка, °C', clamp((leaf - 20) / 35) * 100, '#D1432B', Math.round(leaf)], ['Втрата води (відн.)', clamp(loss) * 100, '#2B6CB0', ''], ['Ризик теплового ушкодження', hotDmg * 100, '#D1432B', ''], ['Ризик зневоднення', dehydDmg * 100, '#2B6CB0', '']].map((r) => `<div class="st-var__row"><span>${r[0]}</span><div class="st-bar st-bar--tall"><i style="width:${r[1]}%;--c:${r[2]}"></i><b>${r[3] || Math.round(r[1]) + ' %'}</b></div></div>`).join('');
        $('.st-info', body).innerHTML = `<h4>${hotDmg > .4 && dehydDmg > .4 ? 'Конфлікт: немає хорошого вибору' : hotDmg > .4 ? 'Листок перегрівається — продихи варто відкрити' : dehydDmg > .4 ? 'Загроза зневоднення — продихи варто закрити' : 'Помірний режим'}</h4><p>Посуха вимагає закрити продихи (зберегти воду), спека — відкрити (охолодитися транспірацією). Коли діють обидві, програми конфліктують; тому рис і кукурудза втрачають стійкість зі зростанням складності стресу (Sinha 2024; Cohen 2021).</p>`; };
      body.addEventListener('input', upd); body.addEventListener('change', upd); upd();
    }
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; mode = b.dataset.id; setPressed(box, mode); draw(); });
  m.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; const i = +b.dataset.i; on.has(i) ? on.delete(i) : on.add(i); draw(); });
  draw();
};

/* ================================================================ пам'ять */
W.memory = (node) => {
  const m = $('[data-mount]', node);
  const G = [{ id: 'wt', label: 'дикий тип', tau: 4 }, { id: 'hsfa2', label: 'hsfa2 (пам’ять втрачено)', tau: 0.4 }, { id: 'long', label: 'сильний праймінг (довша пам’ять)', tau: 9 }];
  let cur = 'wt';
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 520 280" class="st-sv" role="img" aria-label="Праймінг і пам’ять стресу"></svg><div>${chips(G, cur)}${slider('me-g', 'Проміжок між стресами, діб', 1, 14, 4)}<div class="st-info" aria-live="polite" style="margin-top:10px"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), gI = $('#me-g', m);
  const draw = () => {
    const g = +gI.value; $('#me-g-o', m).textContent = g; const tau = G.find((x) => x.id === cur).tau;
    const Mk = (t) => t < 0 ? 0 : t <= 1 ? t : Math.exp(-(t - 1) / tau);
    const X = (t) => 40 + t / 20 * 460, Y = (v) => 230 - v * 170;
    const mark = Mk(g), amp1 = 1, amp2 = 1 + 1.8 * (cur === 'hsfa2' ? 0.15 : 1) * mark / (cur === 'wt' ? 1 : 1);
    let d = ''; for (let t = 0; t <= 20; t += 0.1) d += (t ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(Mk(t)).toFixed(1);
    const peak = (t0, a, col) => `<path d="M${X(t0)} ${Y(0)}Q${X(t0 + 0.5)} ${Y(a * 0.55 + 0.1)} ${X(t0 + 1)} ${Y(a * 0.5)}Q${X(t0 + 1.8)} ${Y(0.05)} ${X(t0 + 3)} ${Y(0)}" fill="none" stroke="${col}" stroke-width="3.2"/>`;
    svg.innerHTML = `<path d="M40 230H500M40 50V230" stroke="#46584C"/><rect x="${X(0)}" y="50" width="${X(1) - X(0)}" height="180" fill="#FBE0D8" opacity=".7"/><rect x="${X(g)}" y="50" width="${X(1) - X(0)}" height="180" fill="#FBE0D8" opacity=".7"/><text x="${X(.5)}" y="46" text-anchor="middle" class="tm">стрес 1</text><text x="${X(g + .5)}" y="46" text-anchor="middle" class="tm">стрес 2</text><path d="${d}" fill="none" stroke="#7E57C2" stroke-width="3" stroke-dasharray="6 4"/>${peak(0, amp1, '#D1432B')}${peak(g, Math.min(1.6, amp2) / 1.2, '#D1432B')}<text x="270" y="262" text-anchor="middle" class="ts">час, доби</text><text x="12" y="140" transform="rotate(-90 12 140)" text-anchor="middle" class="ts">відносний рівень</text><g class="tb"><text x="320" y="80" style="fill:#7E57C2">слід пам’яті (H3K4me3)</text><text x="330" y="98" style="fill:#D1432B">відповідь на стрес</text></g>`;
    info.innerHTML = `<h4>Другий стрес: відповідь ×${fmt(Math.min(1.6, amp2) / 1, 2)} відносно першого</h4><p>Слід від першого стресу зберігається ≈ ${Math.round(mark * 100)} % до другого. ${cur === 'hsfa2' ? 'Без HSFA2 слід швидко зникає, праймінгу немає.' : g > 8 && cur === 'wt' ? 'Проміжок задовгий — слід майже зник, відповідь нагадує первинну.' : 'Збережений слід дозволяє швидше й сильніше вмикати гени HSP/APX.'}</p><p class="st-hint">Якісна модель: слід загасає експоненційно; для HSFA2 пам’ять триває кілька діб; трансгенераційна пам’ять зазвичай нестабільна (Lämke і Bäurle 2017).</p>`;
  };
  m.addEventListener('input', draw);
  $('.st-chips', m).addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed($('.st-chips', m), cur); draw(); });
  draw();
};

/* ================================================================ воскресіння */
W.resur = (node) => {
  const m = $('[data-mount]', node);
  m.innerHTML = `<div class="st-stage"><svg viewBox="0 0 400 320" class="st-sv" role="img" aria-label="Рослина-воскресінець"></svg><div>${slider('rs-w', 'Вміст води (RWC), %', 5, 100, 100)}<div class="st-row"><button type="button" class="st-btn" data-wet>💧 Полити</button><button type="button" class="st-btn st-btn--ghost" data-dry>Висушити</button></div><div class="st-bars2"></div><div class="st-info" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), info = $('.st-info', m), box = $('.st-bars2', m), wI = $('#rs-w', m);
  let anim = 0;
  const draw = () => {
    const w = +wI.value; $('#rs-w-o', m).textContent = w; const dry = 1 - (w - 5) / 95;
    let s = `<rect x="0" y="260" width="400" height="60" fill="#8A7A62"/><ellipse cx="200" cy="262" rx="150" ry="14" fill="#74654F"/>`;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, ang = -Math.PI / 2 + (i - 4) * 0.34, len = 150 - Math.abs(i - 4) * 12, curl = dry * 1.3; const x0 = 200, y0 = 255; const mx = x0 + Math.cos(ang) * len * .6, my = y0 + Math.sin(ang) * len * .6; const tx = x0 + Math.cos(ang + curl * Math.sign(i - 4 || 1) * .9) * len * (1 - dry * .55), ty = y0 + Math.sin(ang + curl * Math.sign(i - 4 || 1) * .9) * len * (1 - dry * .55); const wd = (1 - dry) * 15 + 3; const col = `hsl(${mix(115, 40, dry)} ${mix(45, 12, dry)}% ${mix(40, 38, dry)}%)`; s += `<path d="M${x0} ${y0}Q${mx} ${my} ${tx} ${ty}" fill="none" stroke="${col}" stroke-width="${wd}" stroke-linecap="round"/>`; }
    s += `<text x="200" y="22" text-anchor="middle" class="tb">RWC = ${w} %</text><text x="200" y="40" text-anchor="middle" class="ts">${w > 70 ? 'гідратований стан' : w > 30 ? 'скручування, накопичення захисту' : 'анабіоз (склоподібний стан)'}</text>`;
    svg.innerHTML = s;
    const sugar = clamp(dry * 1.15), lea = clamp((dry - .15) * 1.2), glass = clamp((dry - .6) * 2.8), meta = 1 - dry;
    box.innerHTML = [['Сахароза/трегалоза (склоутворювачі)', sugar, '#E1A52C'], ['LEA-білки', lea, '#7E57C2'], ['Склоподібний стан цитоплазми', glass, '#3B82C4'], ['Метаболізм', meta, '#2F8F5B']].map((r) => `<div class="st-pair"><span>${r[0]}</span><div class="st-bar"><i style="width:${Math.round(r[1] * 100)}%;--c:${r[2]}"></i></div></div>`).join('');
    info.innerHTML = `<h4>${w > 70 ? 'Активна рослина' : w > 30 ? 'Регульоване висихання' : 'Анабіоз'}</h4><p>${w > 30 ? 'Рослина вмикає насіннєву програму десикаційної толерантності: LEA, цукри, антиоксиданти; розбирає (або захищає) фотосинтетичний апарат.' : 'Цитоплазма вітрифікується — молекулярна рухливість майже нульова, мембрани й білки зберігаються. Полив повертає метаболізм за години.'}</p>`;
  };
  const tween = (to) => { cancelAnimationFrame(anim); const from = +wI.value, t0 = performance.now(), dur = REDUCED ? 1 : 2400; const f = (now) => { const k = clamp((now - t0) / dur), e = 1 - Math.pow(1 - k, 3); wI.value = Math.round(from + (to - from) * e); draw(); if (k < 1) anim = requestAnimationFrame(f); }; anim = requestAnimationFrame(f); };
  m.addEventListener('input', draw);
  m.addEventListener('click', (e) => { if (e.target.closest('[data-wet]')) tween(100); else if (e.target.closest('[data-dry]')) tween(5); });
  draw();
};

/* ================================================================ каталог генів */
W.genes = (node) => {
  const m = $('[data-mount]', node);
  let cur = 'all';
  m.innerHTML = `<div>${chips([{ id: 'all', label: 'Усі' }, ...D.stresses.map((s) => ({ id: s.id, label: s.name, col: s.col }))], cur)}<div class="st-genes"></div></div>`;
  const box = $('.st-chips', m), list = $('.st-genes', m);
  const draw = () => { list.innerHTML = D.genes.filter((g) => cur === 'all' || g.s === cur).map((g) => `<article class="st-gene" style="--c:${ST[g.s].col}"><span class="st-gene__s">${ST[g.s].name}</span><h4><i>${g.g}</i> <small>${g.crop}</small></h4><p><b>Механізм:</b> ${g.m}</p><p class="st-gene__e"><b>Польовий доказ:</b> ${g.e}</p><p class="st-gene__l"><b>Обмеження:</b> ${g.l}</p></article>`).join(''); };
  box.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; cur = b.dataset.id; setPressed(box, cur); draw(); });
  draw();
};

/* ================================================================ вікторина */
W.quiz = (node) => {
  const m = $('[data-mount]', node);
  const Q = D.quiz.map((q) => { const opts = q[1].map((t, i) => ({ t, ok: i === q[2], k: (i * 7 + q[0].length) % 11 })).sort((a, b) => a.k - b.k); return { q: q[0], opts, why: q[3] }; });
  let i = 0, score = 0, ans = false, done = false;
  const draw = () => {
    if (done) { m.innerHTML = `<div class="st-info"><h4>Результат: ${score} із ${Q.length}</h4><p>${score >= Q.length - 2 ? 'Відмінно: ви добре засвоїли матеріал.' : 'Перегляньте розділи, де помилилися, й спробуйте ще раз.'}</p></div><button type="button" class="st-btn" data-r>↺ Ще раз</button>`; return; }
    const q = Q[i];
    m.innerHTML = `<p class="st-q"><b>Запитання ${i + 1} із ${Q.length}.</b> ${q.q}</p><div class="st-chips st-chips--col">${q.opts.map((o, k) => `<button type="button" data-k="${k}">${o.t}</button>`).join('')}</div><div class="st-info out" aria-live="polite" style="margin-top:12px" ${ans ? '' : 'hidden'}></div>`;
  };
  m.addEventListener('click', (e) => {
    if (e.target.closest('[data-r]')) { i = 0; score = 0; ans = false; done = false; draw(); return; }
    if (e.target.closest('[data-nx]')) { i++; ans = false; if (i >= Q.length) done = true; draw(); return; }
    const b = e.target.closest('button[data-k]'); if (!b || ans) return; ans = true; const q = Q[i], o = q.opts[+b.dataset.k]; if (o.ok) score++;
    $$('button[data-k]', m).forEach((x, k) => { x.disabled = true; if (q.opts[k].ok) { x.style.background = '#2E7D32'; x.style.color = '#fff'; } else if (x === b) { x.style.background = '#C0392B'; x.style.color = '#fff'; } });
    const box = $('.out', m); box.hidden = false;
    box.innerHTML = `<h4 class="${o.ok ? 'st-ok' : 'st-bad'}">${o.ok ? 'Правильно!' : 'Не зовсім.'}</h4><p>${q.why}</p><button type="button" class="st-btn" data-nx>${i + 1 >= Q.length ? 'Результат' : 'Далі ▶'}</button>`;
  });
  draw();
};

/* ================================================================ запуск */
const mounted = new WeakSet();
const mount = (node) => {
  if (mounted.has(node)) return; mounted.add(node);
  const fn = W[node.dataset.w]; if (!fn) return;
  try {
    fn(node); node.classList.add('is-ready');
    $$('svg.st-sv', node).forEach((svg) => {
      const vb = svg.viewBox.baseVal.width; if (vb < 400 || svg.parentNode.classList.contains('st-scroll')) return;
      const box = document.createElement('div'); box.className = 'st-scroll'; svg.replaceWith(box); box.append(svg); svg.style.minWidth = Math.round(vb * 0.8) + 'px';
    });
  } catch (err) { console.error('st widget', node.dataset.w, err); }
};
const widgets = $$('[data-w]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target); } }), { rootMargin: '300px 0px' });
  widgets.forEach((w) => io.observe(w));
} else widgets.forEach(mount);
addEventListener('hashchange', () => { const t = document.getElementById(location.hash.slice(1)); if (t) $$('[data-w]', t).forEach(mount); });
