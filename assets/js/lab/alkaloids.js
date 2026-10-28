// Конспект «Алкалоїди рослин»: інтерактивні моделі. Усі віджети монтуються, коли наближаються до екрана.
const D = JSON.parse(document.getElementById('ak-data').textContent);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const MOL = (k) => `../../assets/img/alk/mol/${k}.svg`;
const molImg = (k, cls = '') => (k ? `<img class="mol ${cls}" src="${MOL(k)}" alt="Структурна формула: ${D.names[k] || k}" loading="lazy" decoding="async">` : '');
const nm = (k) => D.names[k] || k;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const fmt = (x, d = 1) => x.toFixed(d).replace('.', ',');
const pct = (x) => (x >= 99.95 ? '100' : x < 0.05 ? (x === 0 ? '0' : '< 0,1') : x >= 10 ? x.toFixed(0) : x.toFixed(1).replace('.', ','));
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
};
function loopWhenVisible(node, frame) {
  let vis = false, raf = 0, last = 0;
  const tick = (now) => {
    raf = 0;
    if (!vis || document.hidden) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; frame(dt, now / 1000);
    raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && vis && !document.hidden && !REDUCED) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; kick(); }, { rootMargin: '80px' }).observe(node);
  document.addEventListener('visibilitychange', kick);
  return { kick };
}
const chips = (items, cur, attr = 'data-id', cls = 'ak-chips') =>
  `<div class="${cls}" role="group">${items.map((it) => `<button type="button" ${attr}="${it.id}" aria-pressed="${it.id === cur}"${it.col ? ` style="--c:${it.col}"` : ''}>${it.label}</button>`).join('')}</div>`;
function setPressed(box, id, attr = 'data-id') { $$('button', box).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === id))); }

const W = {};

/* ============================================================ схема метаболітів */
W.metab = (root) => {
  const info = $('#mb-info', root), groups = $$('.mb', root);
  let cur = null;
  const show = (k) => {
    cur = cur === k ? null : k;
    groups.forEach((g) => g.classList.toggle('is-on', g.dataset.k === cur));
    info.innerHTML = cur ? `<p>${D.metab[cur]}</p>` : '<p class="ak-info__hint">Натисніть на блок діаграми.</p>';
  };
  groups.forEach((g) => { g.addEventListener('click', () => show(g.dataset.k)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(g.dataset.k); } }); });
  show('alk');
};

/* ============================================================ стрічка історії */
W.timeline = (root) => {
  const m = $('[data-mount]', root);
  m.innerHTML = `<div class="tl"><div class="tl__rail" role="tablist">${D.timeline.map((e, i) => `<button type="button" role="tab" class="tl__item" data-i="${i}" aria-selected="${i === 0}"><b>${e.y}</b><span>${e.t}</span></button>`).join('')}</div><article class="tl__card" aria-live="polite"></article></div>`;
  const card = $('.tl__card', m), items = $$('.tl__item', m);
  const show = (i) => {
    items.forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    const e = D.timeline[i];
    card.innerHTML = `<div class="tl__txt"><span class="tl__year">${e.y}</span><h4>${e.t}</h4><p>${e.d}</p></div>${e.k ? `<figure class="tl__mol">${molImg(e.k)}<figcaption>${nm(e.k)}</figcaption></figure>` : ''}`;
    items[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
  };
  items.forEach((b, i) => { b.addEventListener('click', () => show(i)); b.addEventListener('mouseenter', () => { if (matchMedia('(hover:hover)').matches) show(i); }); });
  show(0);
};

/* ============================================================ pKa: частки форм */
const FORM = { cat: '#C0392B', neu: '#2B6CB0', ani: '#7A3FB5' };
function fractions(a, pH) {
  if (a.type === 'quat') return { cat: 1, neu: 0, ani: 0 };
  if (a.type === 'ampho') {
    const x = Math.pow(10, pH - a.pka1), y = Math.pow(10, 2 * pH - a.pka1 - a.pka2), d = 1 + x + y;
    return { cat: 1 / d, neu: x / d, ani: y / d };
  }
  const c = 1 / (1 + Math.pow(10, pH - a.pka1));
  return { cat: c, neu: 1 - c, ani: 0 };
}
const mixHex = (f) => {
  const m = (a, b, c) => Math.round(a * f.cat + b * f.neu + c * f.ani);
  const [c1, c2, c3] = [[192, 57, 43], [43, 108, 176], [122, 63, 181]];
  return `rgb(${m(c1[0], c2[0], c3[0])},${m(c1[1], c2[1], c3[1])},${m(c1[2], c2[2], c3[2])})`;
};
W.pka = (root) => {
  const m = $('[data-mount]', root), keys = Object.keys(D.pka);
  m.innerHTML = `<div class="pk"><div class="pk__ctl"><label>pH розчину: <output id="pk-out">7,0</output></label><input type="range" min="0" max="14" step="0.1" value="7" aria-label="pH"></div>
    <div class="pk__legend"><span style="--c:${FORM.cat}">катіон [Alk–H]⁺ (у воді)</span><span style="--c:${FORM.neu}">вільна основа (в органіці)</span><span style="--c:${FORM.ani}">фенолят-аніон</span></div>
    <div class="pk__rows">${keys.map((k) => { const a = D.pka[k]; return `<div class="pk__row" data-k="${k}">${molImg(a.key, 'pk__mol')}<div class="pk__name"><b>${a.name}</b><small>${a.type === 'quat' ? 'четвертинний: завжди катіон' : a.type === 'ampho' ? `pK<sub>a1</sub> ${fmt(a.pka1)} (N) · pK<sub>a2</sub> ${fmt(a.pka2)} (OH)` : `pK<sub>a</sub> ${fmt(a.pka1)}`}</small></div>
      <div class="pk__bar"><i class="pk__fill"></i><span class="pk__cursor"></span>${a.pka1 !== null ? `<span class="pk__tick" style="left:${(a.pka1 / 14) * 100}%"><em>${fmt(a.pka1)}</em></span>` : ''}${a.pka2 ? `<span class="pk__tick" style="left:${(a.pka2 / 14) * 100}%"><em>${fmt(a.pka2)}</em></span>` : ''}</div><div class="pk__val"></div></div>`; }).join('')}</div>
    <div class="pk__axis"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span><span>12</span><span>14</span></div></div>`;
  const rng = $('input', m), out = $('#pk-out', m), rows = $$('.pk__row', m);
  rows.forEach((r) => {
    const a = D.pka[r.dataset.k], stops = [];
    for (let i = 0; i <= 28; i++) stops.push(`${mixHex(fractions(a, i / 2))} ${(i / 28) * 100}%`);
    $('.pk__fill', r).style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  });
  const upd = () => {
    const pH = +rng.value; out.textContent = fmt(pH);
    rows.forEach((r) => {
      const f = fractions(D.pka[r.dataset.k], pH);
      $('.pk__cursor', r).style.left = (pH / 14) * 100 + '%';
      $('.pk__val', r).innerHTML = `<span style="color:${FORM.cat}">${pct(f.cat * 100)} %</span>${f.ani > 0.0005 || D.pka[r.dataset.k].type === 'ampho' ? `<small>нейтр. ${pct(f.neu * 100)} %</small>` : ''}`;
    });
  };
  rng.addEventListener('input', upd); upd();
};

/* ============================================================ pH-симулятор: екстракція та іонна пастка */
W.phsim = (root) => {
  const m = $('[data-mount]', root), keys = Object.keys(D.pka);
  let key = 'atropine', mode = m.dataset.mode || 'ext', pH = 7.3, pHv = 5.0, pHc = 7.3;
  m.innerHTML = `<div class="ps"><div class="ps__ctl">
      <div class="ps__row"><b>Алкалоїд</b><div class="ak-chips ps__alk">${keys.map((k) => `<button type="button" data-k="${k}" aria-pressed="${k === key}">${D.pka[k].name.replace(/ \(.*\)/, '')}</button>`).join('')}</div></div>
      <div class="ps__row"><b>Сценарій</b><div class="ak-chips ps__mode"><button type="button" data-m="ext" aria-pressed="${mode === 'ext'}">Екстракція (вода / хлороформ)</button><button type="button" data-m="cell" aria-pressed="${mode === 'cell'}">Клітина (цитозоль / вакуоля)</button></div></div>
      <div class="ps__sl" data-sl="ext"><label>pH водної фази: <output>7,3</output></label><input type="range" min="1" max="13" step="0.1" value="7.3" data-r="ext" aria-label="pH водної фази"></div>
      <div class="ps__sl" data-sl="cell"><label>pH цитозолю: <output>7,3</output></label><input type="range" min="6.5" max="8" step="0.1" value="7.3" data-r="c" aria-label="pH цитозолю">
        <label>pH вакуолі: <output>5,0</output></label><input type="range" min="3.5" max="7.5" step="0.1" value="5" data-r="v" aria-label="pH вакуолі"></div>
      <div class="ps__mol"></div></div>
    <div class="ps__vis"><svg class="ak-svg" viewBox="0 0 520 360" aria-hidden="true"></svg><div class="ps__out" aria-live="polite"></div></div></div>`;
  const svg = $('svg', m), out = $('.ps__out', m), molBox = $('.ps__mol', m);
  const N = 70, dots = [];
  const drawScene = () => {
    svg.innerHTML = '';
    if (mode === 'ext') {
      // ділильна лійка (спрощено): вгорі вода, внизу хлороформ (він важчий)
      el('rect', { x: 118, y: 70, width: 284, height: 100, fill: '#DDEEFA' }, svg);
      el('rect', { x: 118, y: 170, width: 284, height: 92, fill: '#E3DAF5' }, svg);
      el('path', { d: 'M118 170h284', stroke: '#6D5A9A', 'stroke-width': 2, 'stroke-dasharray': '5 4' }, svg);
      el('path', { d: 'M118 36V250c0 14 8 22 22 22h240c14 0 22-8 22-22V36', fill: 'none', stroke: '#8AA0B2', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
      el('text', { x: 18, y: 124, class: 'ak-t ak-t--b' }, svg).textContent = 'вода';
      el('text', { x: 18, y: 222, class: 'ak-t ak-t--b' }, svg).textContent = 'CHCl₃';
      el('path', { d: 'M240 272v28h40v-28', fill: '#B7C4CE', stroke: '#8AA0B2', 'stroke-width': 3 }, svg);
      el('text', { x: 260, y: 324, class: 'ak-t ak-t--s', 'text-anchor': 'middle' }, svg).textContent = 'кран';
    } else {
      el('rect', { x: 16, y: 20, width: 488, height: 320, rx: 36, fill: '#E7F3D8', stroke: '#8DB36A', 'stroke-width': 4 }, svg);
      el('rect', { x: 220, y: 56, width: 250, height: 250, rx: 70, fill: '#D3E6F5', stroke: '#6FA5CC', 'stroke-width': 4 }, svg);
      el('text', { x: 40, y: 54, class: 'ak-t ak-t--b' }, svg).textContent = 'цитозоль';
      el('text', { x: 345, y: 82, class: 'ak-t ak-t--b', 'text-anchor': 'middle' }, svg).textContent = 'вакуоля';
      el('text', { x: 262, y: 328, class: 'ak-t ak-t--s' }, svg).textContent = 'тонопласт (мембрана)';
    }
    dots.length = 0;
    const g = el('g', {}, svg);
    for (let i = 0; i < N; i++) dots.push({ c: el('circle', { r: 6, cx: 0, cy: 0, stroke: '#fff', 'stroke-width': 1.4 }, g), a: Math.random() * 6.28, r: Math.random(), s: 0.6 + Math.random() * 0.9, ph: Math.random() * 6.28 });
  };
  const A = () => D.pka[key];
  const place = (t) => {
    const a = A();
    if (mode === 'ext') {
      const f = fractions(a, pH);
      const nOrg = Math.round(N * (f.neu)), nCat = Math.round(N * f.cat);
      dots.forEach((d, i) => {
        const org = i < nOrg, ani = !org && i >= N - Math.round(N * f.ani);
        const box = org ? { x: 124, y: 182, w: 272, h: 70 } : { x: 128, y: 82, w: 264, h: 78 };
        const x = box.x + box.w * (0.5 + 0.46 * Math.sin(d.a + t * 0.3 * d.s)), y = box.y + box.h * (0.5 + 0.42 * Math.sin(d.ph + t * 0.4 * d.s));
        d.c.setAttribute('cx', x.toFixed(1)); d.c.setAttribute('cy', y.toFixed(1));
        d.c.setAttribute('fill', org ? FORM.neu : ani ? FORM.ani : FORM.cat);
      });
      const water = f.cat + f.ani, org = f.neu;
      out.innerHTML = `<div class="ps__bars"><div><span>У воді: катіон${f.ani > 0.001 ? ' + фенолят' : ''}</span><i style="width:${water * 100}%;background:${FORM.cat}"></i><b>${pct(water * 100)} %</b></div><div><span>У хлороформі: вільна основа</span><i style="width:${org * 100}%;background:${FORM.neu}"></i><b>${pct(org * 100)} %</b></div></div>
        <p class="ps__msg">${a.type === 'quat' ? 'Четвертинна основа завжди несе заряд: у хлороформ її переводять лише іон-парною екстракцією або після відновлення до третинної основи.' : a.type === 'ampho' ? `Максимум нейтральної форми — поблизу ізоелектричної точки pI = (pK<sub>a1</sub> + pK<sub>a2</sub>)/2 ≈ ${fmt((a.pka1 + a.pka2) / 2, 2)}. За pH &gt; 10,5 морфін утворює фенолят і лишається у воді, тому його виділяють слабкою основою (NH₄OH, pH ≈ 8,5–9).` : pH < a.pka1 - 2 ? 'У кислому середовищі алкалоїд — катіон: він у воді (стадія кислої екстракції).' : pH > a.pka1 + 2 ? 'У лужному середовищі переважає вільна основа: вона переходить у хлороформ (реекстракція).' : 'Поблизу pK<sub>a</sub> співіснують обидві форми — розподіл між фазами чутливий до pH.'}</p>`;
    } else {
      const fc = fractions(a, pHc), fv = fractions(a, pHv);
      let ratio = a.type === 'quat' ? 1 : (1 / fv.neu) / (1 / fc.neu); // загальна концентрація у вакуолі / цитозолі за рівноваги нейтральної форми
      if (a.type === 'quat') ratio = 1;
      const cVac = ratio / (1 + ratio);
      const nV = Math.round(N * cVac);
      dots.forEach((d, i) => {
        const vac = i < nV;
        const box = vac ? { x: 232, y: 96, w: 226, h: 196 } : { x: 34, y: 70, w: 170, h: 238 };
        const x = box.x + box.w * (0.5 + 0.44 * Math.sin(d.a + t * 0.3 * d.s)), y = box.y + box.h * (0.5 + 0.44 * Math.sin(d.ph + t * 0.4 * d.s));
        const f = vac ? fv : fc;
        d.c.setAttribute('cx', x.toFixed(1)); d.c.setAttribute('cy', y.toFixed(1));
        d.c.setAttribute('fill', mixHex(f));
        d.c.setAttribute('r', a.type === 'quat' ? 6 : 4 + 3 * f.cat);
      });
      const pr = null;
      out.innerHTML = `<div class="ps__bars"><div><span>Цитозоль (pH ${fmt(pHc)}): мембранопроникна форма</span><i style="width:${fc.neu * 100}%;background:${FORM.neu}"></i><b>${pct(fc.neu * 100)} %</b></div><div><span>Вакуоля (pH ${fmt(pHv)}): мембранопроникна форма</span><i style="width:${fv.neu * 100}%;background:${FORM.neu}"></i><b>${pct(fv.neu * 100)} %</b></div></div>
        <p class="ps__msg">${a.type === 'quat' ? 'Четвертинний берберин несе постійний заряд і мембрану не перетинає — у вакуолю його закачують <b>активні транспортери MATE та ABC</b>.' : `Рівноважне накопичення: у вакуолі алкалоїду в <b class="ps__big">${ratio < 10 ? fmt(ratio) : Math.round(ratio).toLocaleString('uk-UA')}</b> ${ratio >= 2 && ratio < 5 ? 'рази' : 'разів'} більше, ніж у цитозолі. ${ratio < 1.5 ? 'Для такої слабкої основи пастки практично немає: і в цитозолі, і у вакуолі вона нейтральна.' : ratio > 100 ? 'Це і є «іонна пастка»: протонована форма не може повернутися крізь тонопласт.' : ''}`}</p>`;
    }
  };
  const mol = () => { const a = A(); molBox.innerHTML = `${molImg(a.key)}<small>${a.type === 'quat' ? 'четвертинний катіон' : a.type === 'ampho' ? `амфотерний: pK<sub>a1</sub> ${fmt(a.pka1)} / pK<sub>a2</sub> ${fmt(a.pka2)}` : `pK<sub>a</sub> ${fmt(a.pka1)}`}</small>`; };
  const sl = () => { $$('.ps__sl', m).forEach((s) => (s.hidden = s.dataset.sl !== mode)); };
  drawScene(); mol(); sl(); place(0);
  $$('.ps__alk button', m).forEach((b) => b.addEventListener('click', () => { key = b.dataset.k; setPressed($('.ps__alk', m), key, 'data-k'); mol(); place(performance.now() / 1000); }));
  $$('.ps__mode button', m).forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; setPressed($('.ps__mode', m), mode, 'data-m'); drawScene(); sl(); place(performance.now() / 1000); }));
  $$('input[data-r]', m).forEach((r) => r.addEventListener('input', () => {
    const v = +r.value; r.previousElementSibling.querySelector('output').textContent = fmt(v);
    if (r.dataset.r === 'ext') pH = v; else if (r.dataset.r === 'c') pHc = v; else pHv = v;
    place(performance.now() / 1000);
  }));
  // pH-повзунок з виводом
  $$('input[data-r]', m).forEach((r) => { const o = r.previousElementSibling.querySelector('output'); if (o) o.textContent = fmt(+r.value); });
  loopWhenVisible(svg, (dt, t) => place(t));
};

/* ============================================================ родини */
W.families = (root) => {
  const m = $('[data-mount]', root);
  m.innerHTML = `<div class="fm">${chips(D.families.map((f) => ({ id: f.lat, label: f.ua.replace(/ \(.*?\)/g, '') })), D.families[0].lat)}<article class="fm__card" aria-live="polite"></article></div>`;
  const card = $('.fm__card', m), box = $('.ak-chips', m);
  const show = (id) => {
    setPressed(box, id);
    const f = D.families.find((x) => x.lat === id);
    card.innerHTML = `${f.img ? `<figure class="fm__img"><img src="${f.img}" alt="${f.cap || f.ua}" loading="lazy" decoding="async"></figure>` : ''}<div class="fm__txt"><h4>${f.ua} <small>(${f.lat})</small></h4><p><b>Класи алкалоїдів:</b> ${f.cl}.</p><p><b>Типові продуценти:</b> <i>${f.pl}</i>.</p><div class="mc-row mc-row--sm">${f.keys.map((k) => `<figure class="mc">${molImg(k)}<figcaption><b>${nm(k)}</b></figcaption></figure>`).join('')}</div></div>`;
  };
  $$('button', box).forEach((b) => b.addEventListener('click', () => show(b.dataset.id)));
  show(D.families[0].lat);
};

/* ============================================================ карта класів */
W.classmap = (root) => {
  const m = $('[data-mount]', root);
  const gs = Object.entries(D.groups).map(([id, g]) => ({ id, label: g.name, col: g.col }));
  let grp = 'all', cur = D.classes[0].id;
  m.innerHTML = `<div class="cm"><div class="cm__groups">${chips([{ id: 'all', label: 'Усі попередники' }, ...gs], grp, 'data-g')}</div>
    <div class="cm__body"><ul class="cm__list" role="listbox" aria-label="Класи алкалоїдів"></ul><article class="cm__card" aria-live="polite"></article></div></div>`;
  const list = $('.cm__list', m), card = $('.cm__card', m), gbox = $('.cm__groups .ak-chips', m);
  const paint = () => {
    const vis = D.classes.filter((c) => grp === 'all' || c.grp === grp);
    if (!vis.some((c) => c.id === cur)) cur = vis[0] ? vis[0].id : cur;
    list.innerHTML = vis.map((c) => `<li><button type="button" role="option" data-id="${c.id}" aria-selected="${c.id === cur}" style="--c:${D.groups[c.grp].col}"><i></i>${c.name}</button></li>`).join('');
    const c = D.classes.find((x) => x.id === cur), g = D.groups[c.grp];
    card.style.setProperty('--c', g.col);
    card.innerHTML = `<header><span class="cm__tag" style="background:${g.col}">${g.name}</span><h4>${c.name}</h4></header>
      <div class="cm__grid"><figure class="cm__sk">${molImg(c.sc)}<figcaption>${c.ring}</figcaption></figure>
      <dl><dt>Попередник</dt><dd>${c.prec}</dd><dt>Ключові інтермедіати</dt><dd>${c.inter}</dd><dt>Представники</dt><dd>${c.reps}</dd><dt>Рослини</dt><dd><i>${c.plants}</i></dd></dl></div>
      ${c.keys.length ? `<div class="mc-row mc-row--sm">${c.keys.map((k) => `<figure class="mc">${molImg(k)}<figcaption><b>${nm(k)}</b></figcaption></figure>`).join('')}</div>` : ''}`;
  };
  gbox.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; grp = b.dataset.g; setPressed(gbox, grp, 'data-g'); paint(); });
  list.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cur = b.dataset.id; paint(); });
  paint();
};

/* ============================================================ плеєр біосинтезу */
W.player = (root) => {
  const m = $('[data-mount]', root);
  let pi = 0, si = 0, timer = 0;
  m.innerHTML = `<div class="pl"><div class="pl__tabs">${chips(D.pathways.map((p) => ({ id: p.id, label: p.title, col: p.color })), D.pathways[0].id)}</div>
    <p class="pl__sub"></p><div class="pl__rail" role="tablist"></div>
    <article class="pl__card" aria-live="polite"></article>
    <div class="pl__ctl"><button type="button" data-a="prev" aria-label="Попередній крок">◀</button><button type="button" data-a="play" aria-label="Відтворити">▶ Відтворити</button><button type="button" data-a="next" aria-label="Наступний крок">▶▶</button><span class="pl__prog"><i></i></span><output></output></div></div>`;
  const tabs = $('.ak-chips', m), rail = $('.pl__rail', m), card = $('.pl__card', m), prog = $('.pl__prog i', m), out = $('output', m), playBtn = $('[data-a="play"]', m);
  const P = () => D.pathways[pi];
  const stop = () => { clearInterval(timer); timer = 0; playBtn.textContent = '▶ Відтворити'; };
  const drawRail = () => {
    $('.pl__sub', m).innerHTML = P().sub;
    m.style.setProperty('--c', P().color);
    rail.innerHTML = P().nodes.map((n, i) => `<button type="button" role="tab" class="pl__node" data-i="${i}" aria-selected="${i === si}">${molImg(n.k)}<span>${n.label || nm(n.k)}</span>${i < P().nodes.length - 1 ? '<em aria-hidden="true">→</em>' : ''}</button>`).join('');
  };
  const show = (i) => {
    si = clamp(i, 0, P().nodes.length - 1);
    const n = P().nodes[si], tot = P().nodes.length;
    $$('.pl__node', rail).forEach((b, k) => { b.setAttribute('aria-selected', String(k === si)); b.classList.toggle('is-done', k < si); });
    const cur = $('.pl__node[aria-selected="true"]', rail); if (cur) rail.scrollTo({ left: cur.offsetLeft - rail.clientWidth / 2 + cur.clientWidth / 2, behavior: REDUCED ? 'auto' : 'smooth' });
    card.innerHTML = `<div class="pl__mol">${molImg(n.k)}<b>${n.label || nm(n.k)}</b></div><div class="pl__txt">${n.enz ? `<p><span class="pl__lab">Фермент</span>${n.enz}</p>` : '<p class="pl__start">Вихідний метаболіт первинного обміну.</p>'}${n.rx ? `<p><span class="pl__lab">Реакція</span>${n.rx}</p>` : ''}${n.loc ? `<p><span class="pl__lab">Де відбувається</span>${n.loc}</p>` : ''}${n.note ? `<p class="pl__note">${n.note}</p>` : ''}</div>`;
    prog.style.width = ((si + 1) / tot) * 100 + '%'; out.textContent = `крок ${si + 1} з ${tot}`;
  };
  const step = (d) => { if (d > 0 && si >= P().nodes.length - 1) { stop(); return; } show(si + d); };
  $('.pl__ctl', m).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'play') { if (timer) { stop(); return; } if (si >= P().nodes.length - 1) show(0); playBtn.textContent = '❚❚ Пауза'; timer = setInterval(() => step(1), 3600); }
    else { stop(); step(b.dataset.a === 'next' ? 1 : -1); }
  });
  rail.addEventListener('click', (e) => { const b = e.target.closest('.pl__node'); if (!b) return; stop(); show(+b.dataset.i); });
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; stop(); pi = D.pathways.findIndex((p) => p.id === b.dataset.id); setPressed(tabs, b.dataset.id); si = 0; drawRail(); show(0); });
  drawRail(); show(0);
  new IntersectionObserver((es) => { if (!es[0].isIntersecting) stop(); }).observe(m);
};

/* ============================================================ «кінцеві штрихи» */
W.tailor = (root) => {
  const m = $('[data-mount]', root);
  m.innerHTML = `<div class="tf">${chips(D.tailor.map((t) => ({ id: t.n, label: `${t.n}. ${t.t.split(',')[0].split(' (')[0]}` })), '1')}<article class="tf__card" aria-live="polite"></article></div>`;
  const box = $('.ak-chips', m), card = $('.tf__card', m);
  const show = (id) => {
    setPressed(box, id); const t = D.tailor.find((x) => x.n === id);
    card.innerHTML = `<h4>${t.t}</h4><dl><dt>Ферменти</dt><dd>${t.e}</dd><dt>Кофактори й донори</dt><dd>${t.co}</dd><dt>Значення й приклади</dt><dd>${t.ex}</dd></dl>${t.keys.length ? `<div class="mc-row mc-row--sm">${t.keys.map((k) => `<figure class="mc">${molImg(k)}<figcaption><b>${nm(k)}</b></figcaption></figure>`).join('')}</div>` : ''}`;
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.id); });
  show('1');
};

/* ============================================================ клітина */
const ORG_SHAPES = {
  plastid: (g) => { el('ellipse', { cx: 96, cy: 100, rx: 62, ry: 42, class: 'oc', 'data-o': 'plastid' }, g); [[72, 104], [98, 118], [124, 102]].forEach(([x, y]) => el('ellipse', { cx: x, cy: y, rx: 15, ry: 6, fill: '#1F7A33', opacity: 0.55, 'pointer-events': 'none' }, g)); el('text', { x: 96, y: 88, class: 'ak-t ak-t--s', 'text-anchor': 'middle', 'pointer-events': 'none' }, g).textContent = 'хлоропласт'; },
  nucleus: (g) => { el('circle', { cx: 444, cy: 96, r: 42, class: 'oc', 'data-o': 'nucleus' }, g); el('circle', { cx: 450, cy: 102, r: 12, fill: '#6A4C93', opacity: 0.5, 'pointer-events': 'none' }, g); el('text', { x: 444, y: 156, class: 'ak-t ak-t--s', 'text-anchor': 'middle', 'pointer-events': 'none' }, g).textContent = 'ядро'; },
  er: (g) => { el('path', { d: 'M196 238c18-22 40 20 58 0s40 20 58 0 40 20 58 0', class: 'oc oc--line', 'data-o': 'er' }, g); el('path', { d: 'M196 258c18-22 40 20 58 0s40 20 58 0 40 20 58 0', class: 'oc oc--line', 'data-o': 'er' }, g); el('text', { x: 312, y: 294, class: 'ak-t ak-t--s', 'text-anchor': 'middle', 'pointer-events': 'none' }, g).textContent = 'ЕР (цитохроми P450)'; },
  vacuole: (g) => { el('ellipse', { cx: 270, cy: 112, rx: 104, ry: 68, class: 'oc', 'data-o': 'vacuole' }, g); el('text', { x: 270, y: 108, class: 'ak-t ak-t--b', 'text-anchor': 'middle', 'pointer-events': 'none' }, g).textContent = 'вакуоля'; el('text', { x: 270, y: 128, class: 'ak-t ak-t--s', 'text-anchor': 'middle', 'pointer-events': 'none' }, g).textContent = 'pH ≈ 5 · іонна пастка'; },
  cytosol: (g) => { el('text', { x: 40, y: 190, class: 'ak-t ak-t--s' }, g).textContent = 'цитозоль'; },
  laticifer: (g) => { el('rect', { x: 36, y: 214, width: 124, height: 72, rx: 34, class: 'oc', 'data-o': 'laticifer' }, g); el('text', { x: 98, y: 255, class: 'ak-t ak-t--s', 'text-anchor': 'middle', 'pointer-events': 'none' }, g).textContent = 'молочник'; },
};
W.cell = (root) => {
  const m = $('[data-mount]', root);
  const col = Object.fromEntries(D.orgs.map((o) => [o.id, o.color]));
  m.innerHTML = `<div class="cl"><svg class="ak-svg" viewBox="0 0 520 330" role="group" aria-label="Схема рослинної клітини: натисніть на органелу"></svg><article class="cl__card" aria-live="polite"></article></div>`;
  const svg = $('svg', m), card = $('.cl__card', m);
  el('rect', { x: 14, y: 14, width: 492, height: 302, rx: 34, fill: '#F1F7E8', stroke: '#8FB36B', 'stroke-width': 4 }, svg);
  el('rect', { x: 26, y: 26, width: 468, height: 278, rx: 26, class: 'oc oc--cyt', 'data-o': 'cytosol' }, svg);
  ['cytosol', 'vacuole', 'plastid', 'nucleus', 'er', 'laticifer'].forEach((k) => { const g = el('g', { 'data-g': k, tabindex: 0, role: 'button', 'aria-label': D.orgs.find((o) => o.id === k).name }, svg); g.style.setProperty('--oc', col[k]); ORG_SHAPES[k](g); });
  let cur = 'vacuole';
  const show = (k) => {
    cur = k; const o = D.orgs.find((x) => x.id === k);
    $$('g[data-g]', svg).forEach((g) => g.classList.toggle('is-on', g.dataset.g === k));
    card.style.setProperty('--c', o.color);
    card.innerHTML = `<h4><i></i>${o.name}</h4><ul class="ak-ul">${o.items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  };
  svg.addEventListener('click', (e) => { const g = e.target.closest('g[data-g]'); if (g) show(g.dataset.g); });
  svg.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-g]')) { e.preventDefault(); show(e.target.dataset.g); } });
  show(cur);
};

/* ============================================================ тканини: джерело → маршрут → сток */
W.tissue = (root) => {
  const m = $('[data-mount]', root);
  m.innerHTML = `<div class="ts">${chips(D.tissue.map((t) => ({ id: t.id, label: t.name.replace(/ \(.*\)/, '') })), D.tissue[0].id)}<div class="ts__body"><div class="ts__fig"><svg class="ak-svg" viewBox="0 0 300 380" role="img" aria-label="Схема рослини: джерело, шлях транспорту й сток алкалоїдів"></svg><p class="ts__lg"><span class="is-source">■ джерело</span><span class="is-sink">■ накопичення</span><span class="is-xyl">⇡ ксилема</span><span class="is-phl">⇡ флоема</span></p></div><article class="ts__card" aria-live="polite"></article></div></div>`;
  const svg = $('svg', m), card = $('.ts__card', m), box = $('.ak-chips', m);
  const base = `<defs><marker id="ts-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>
    <path class="ts__soil" d="M0 322h300v58H0z"/>
    <path class="ts__stem" d="M150 322V70" />
    <g data-organ="root"><path class="ts__o" d="M150 322c-14 14-50 20-66 46M150 322c0 20-6 36 0 54M150 322c14 14 50 20 66 46"/><ellipse class="ts__o ts__root" cx="150" cy="332" rx="24" ry="14"/></g>
    <g data-organ="stem"><rect class="ts__o" x="143" y="150" width="14" height="150" rx="6"/></g>
    <g data-organ="leaf"><path class="ts__o" d="M150 250c-40-20-82-6-96 14 40 20 82 12 96-14zM150 200c40-20 82-6 96 14-40 20-82 12-96-14z"/></g>
    <g data-organ="flower"><circle class="ts__o" cx="150" cy="52" r="20"/><circle cx="150" cy="52" r="7" fill="#FFD54A"/></g>
    <g data-organ="berry"><path d="M150 140L104 124M150 132L196 116" stroke="#5C9A4B" stroke-width="3" fill="none"/><circle class="ts__o" cx="104" cy="124" r="13"/><circle class="ts__o" cx="196" cy="116" r="13"/></g>
    <g data-organ="capsule"><path class="ts__o" d="M150 18c-18 0-26 12-24 28 2 10 10 14 24 14s22-4 24-14c2-16-6-28-24-28z"/><path d="M130 26h40" stroke="#6D5A9A" stroke-width="2"/></g>
    <g data-organ="seed"><path d="M150 168L190 150M150 170L204 162M150 172L180 166" stroke="#5C9A4B" stroke-width="3" fill="none"/><circle class="ts__o" cx="190" cy="150" r="7"/><circle class="ts__o" cx="204" cy="162" r="7"/><circle class="ts__o" cx="180" cy="166" r="7"/></g>`;
  const draw = (t) => {
    svg.innerHTML = base;
    $$('g[data-organ]', svg).forEach((g) => { g.style.display = 'none'; });
    const z = t.zones, show = (o, cls) => { const g = $(`g[data-organ="${o}"]`, svg); if (g) { g.style.display = ''; g.classList.add(cls); } };
    ['root', 'stem', 'leaf'].forEach((o) => show(o, 'is-base'));
    if (z.sink.includes('capsule') || z.source.includes('capsule')) show('capsule', 'is-base');
    if (z.sink.includes('flower')) show('flower', 'is-base');
    if (z.sink.includes('berry')) show('berry', 'is-base');
    if (z.sink.includes('seed')) show('seed', 'is-base');
    z.source.forEach((o) => show(o, 'is-source')); z.sink.forEach((o) => show(o, 'is-sink'));
    // шлях
    const ph = z.route === 'phloem';
    const sx = z.source.includes('root') ? 150 : 150;
    const y0 = z.source.includes('root') ? 318 : z.source.includes('stem') ? 270 : 230, y1 = z.sink.includes('capsule') ? 70 : z.sink.includes('berry') || z.sink.includes('flower') ? 100 : z.sink.includes('seed') ? 150 : 200;
    const up = y1 < y0;
    const p = el('path', { d: `M${ph ? 154 : 146} ${y0}V${y1}`, class: 'ts__flow ' + (ph ? 'is-phloem' : 'is-xylem'), 'marker-end': 'url(#ts-ar)' }, svg);
    if (!up) p.setAttribute('d', `M${ph ? 154 : 146} ${y0}V${y1}`);
    card.innerHTML = `<h4>${t.name}</h4><dl class="ts__dl"><dt class="is-source">Джерело</dt><dd>${t.source}</dd><dt class="is-route">Маршрут</dt><dd>${t.route}</dd><dt class="is-sink">Накопичення</dt><dd>${t.sink}</dd><dt class="is-trig">Тригер</dt><dd>${t.trigger}</dd></dl>`;
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; setPressed(box, b.dataset.id); draw(D.tissue.find((x) => x.id === b.dataset.id)); });
  draw(D.tissue[0]);
};

/* ============================================================ екстракція Стаса — Отто */
W.stasotto = (root) => {
  const m = $('[data-mount]', root);
  const cols = { solid: '#C9B58A', acid: '#F2C14E', base: '#E7E3CE', org: '#B9A4E3', check: '#7FC4A0' };
  let i = 0;
  m.innerHTML = `<div class="so"><ol class="so__steps">${D.stas.map((s, k) => `<li><button type="button" data-i="${k}" aria-current="${k === 0}"><span>${k + 1}</span>${s.t}</button></li>`).join('')}</ol>
    <div class="so__vis"><svg class="ak-svg" viewBox="0 0 320 300" aria-hidden="true"><defs><clipPath id="so-c"><path d="M110 40h100v170c0 30-100 30-100 0z"/></clipPath></defs>
    <path d="M110 40h100v170c0 30-100 30-100 0z" fill="#fff" stroke="#8AA0B2" stroke-width="3"/>
    <g clip-path="url(#so-c)"><rect class="so__liq" x="100" y="150" width="120" height="120" fill="#C9B58A"/><rect class="so__liq2" x="100" y="150" width="120" height="0" fill="#B9A4E3"/><g class="so__ppt"></g></g>
    <path d="M110 40h100" stroke="#8AA0B2" stroke-width="3"/><text class="so__lab ak-t ak-t--b" x="160" y="286" text-anchor="middle"></text><text class="so__ph ak-t ak-t--b" x="262" y="130" text-anchor="start"></text></svg></div>
    <article class="so__card" aria-live="polite"></article>
    <div class="so__ctl"><button type="button" data-a="prev">◀ Назад</button><button type="button" data-a="next">Далі ▶</button></div></div>`;
  const card = $('.so__card', m), liq = $('.so__liq', m), liq2 = $('.so__liq2', m), ppt = $('.so__ppt', m), lab = $('.so__lab', m), phT = $('.so__ph', m);
  const PH = ['', 'pH 2–3', 'pH 9–10', 'pH 9–10', ''];
  const show = (k) => {
    i = clamp(k, 0, D.stas.length - 1); const s = D.stas[i];
    $$('.so__steps button', m).forEach((b, n) => { b.setAttribute('aria-current', String(n === i)); b.classList.toggle('is-done', n < i); });
    liq.setAttribute('fill', cols[s.st] || '#ccc'); liq.setAttribute('y', i === 0 ? 170 : 130); liq.setAttribute('height', i === 0 ? 100 : 140);
    liq2.setAttribute('height', s.st === 'org' ? 70 : 0); liq2.setAttribute('y', 130);
    if (s.st === 'org') { liq.setAttribute('y', 200); liq.setAttribute('height', 70); liq.setAttribute('fill', '#E7E3CE'); liq2.setAttribute('y', 130); liq2.setAttribute('height', 70); }
    ppt.innerHTML = s.st === 'base' ? Array.from({ length: 26 }, (_, n) => `<circle cx="${122 + ((n * 37) % 76)}" cy="${150 + ((n * 53) % 100)}" r="${2 + (n % 3)}" fill="#fff" opacity=".8"/>`).join('') : '';
    lab.textContent = s.lab; phT.textContent = PH[i];
    card.innerHTML = `<h4>${i + 1}. ${s.t}</h4><p>${s.d}</p>`;
    $('[data-a="prev"]', m).disabled = i === 0; $('[data-a="next"]', m).disabled = i === D.stas.length - 1;
  };
  m.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i) show(+b.dataset.i); else if (b.dataset.a === 'next') show(i + 1); else if (b.dataset.a === 'prev') show(i - 1);
  });
  show(0);
};

/* ============================================================ віртуальна лабораторія */
W.reagents = (root) => {
  const m = $('[data-mount]', root);
  let samp = D.samples[0].id, rea = null;
  m.innerHTML = `<div class="rg"><div class="rg__ctl"><div class="rg__row"><b>Зразок</b>${chips(D.samples.map((s) => ({ id: s.id, label: s.name })), samp, 'data-s')}</div>
    <div class="rg__row"><b>Реактив</b>${chips(D.reagents.map((r) => ({ id: r.id, label: r.name, col: r.col })), '', 'data-r', 'ak-chips rg__rea')}</div></div>
    <div class="rg__vis"><svg class="ak-svg" viewBox="0 0 220 260" aria-hidden="true"><defs><clipPath id="rg-c"><path d="M80 30h60v150c0 28-60 28-60 0z"/></clipPath></defs>
      <path d="M80 30h60v150c0 28-60 28-60 0z" fill="#fff" stroke="#8AA0B2" stroke-width="3"/><g clip-path="url(#rg-c)"><rect class="rg__liq" x="70" y="100" width="80" height="120" fill="#EAF2F8"/><g class="rg__ppt"></g></g><path d="M74 30h72" stroke="#8AA0B2" stroke-width="3"/></svg><div class="rg__mol"></div></div>
    <article class="rg__res" aria-live="polite"><p class="ak-info__hint">Оберіть реактив — і подивіться, що станеться в пробірці.</p></article></div>`;
  const liq = $('.rg__liq', m), ppt = $('.rg__ppt', m), res = $('.rg__res', m), molB = $('.rg__mol', m);
  const run = () => {
    const s = D.samples.find((x) => x.id === samp); molB.innerHTML = `${molImg(s.k)}<small>${s.name}</small>`;
    if (!rea) { liq.setAttribute('fill', '#EAF2F8'); ppt.innerHTML = ''; return; }
    const r = D.reagents.find((x) => x.id === rea), v = D.results[`${samp}|${rea}`];
    if (!v) { liq.setAttribute('fill', '#EAF2F8'); ppt.innerHTML = ''; res.innerHTML = `<h4>${r.name}</h4><p>Для цього зразка реакція не характерна: <b>видимих змін немає</b> (або реактив не дає специфічної реакції з цим типом сполук).</p>`; return; }
    liq.setAttribute('fill', v.t === 'color' ? v.col : '#EEF3F6');
    ppt.innerHTML = v.t === 'ppt' ? Array.from({ length: 40 }, (_, n) => `<circle cx="${84 + ((n * 29) % 52)}" cy="${150 + ((n * 47) % 64)}" r="${2 + (n % 3)}" fill="${v.col}" opacity=".92" style="animation:rg-fall .9s ${(n % 8) * 0.07}s both"/>`).join('') : '';
    res.innerHTML = `<h4>Реактив ${r.name} · <span class="rg__chip" style="background:${v.col}"></span>${v.t === 'ppt' ? 'осад' : 'забарвлення'}</h4><p>${v.txt}</p>`;
  };
  m.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.s) { samp = b.dataset.s; setPressed($('.rg__ctl .ak-chips', m), samp, 'data-s'); } else if (b.dataset.r) { rea = b.dataset.r; setPressed($('.rg__rea', m), rea, 'data-r'); } else return;
    run();
  });
  run();
};

/* ============================================================ мімікрія нейромедіаторів */
W.mimicry = (root) => {
  const m = $('[data-mount]', root);
  m.innerHTML = `<div class="mi">${chips(D.mimicry.map((x) => ({ id: x.id, label: x.name })), D.mimicry[0].id)}<article class="mi__card" aria-live="polite"></article></div>`;
  const box = $('.ak-chips', m), card = $('.mi__card', m);
  const show = (id) => {
    setPressed(box, id); const x = D.mimicry.find((y) => y.id === id);
    card.innerHTML = `<div class="mi__nt">${molImg(x.nt)}<b>${x.name}</b><small>${x.mech}</small></div>
      <ul class="mi__list">${x.items.map((it) => `<li><div class="mi__mol">${molImg(it.k)}<b>${nm(it.k)}</b></div><div><span class="mi__role">${it.role}</span><p>${it.eff}</p></div></li>`).join('')}</ul>
      <p class="mi__eff"><b>Наслідок:</b> ${x.eff}</p>`;
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.id); });
  show(D.mimicry[0].id);
};

/* ============================================================ жасмонатний контур */
W.jasmonate = (root) => {
  const m = $('[data-mount]', root);
  const icons = ['🐛', '✉', '🧬', '⚗', '🍃'];
  let i = 0, timer = 0;
  m.innerHTML = `<div class="js"><div class="js__rail">${D.jas.map((s, k) => `<button type="button" data-i="${k}" aria-selected="${k === 0}"><span>${icons[k] || k + 1}</span><b>${s.t}</b></button>`).join('')}</div>
    <div class="js__bar"><i></i></div><article class="js__card" aria-live="polite"></article>
    <div class="js__ctl"><button type="button" data-a="play">▶ Відтворити</button><button type="button" data-a="next">Далі ▶</button></div></div>`;
  const card = $('.js__card', m), bar = $('.js__bar i', m), play = $('[data-a="play"]', m);
  const stop = () => { clearInterval(timer); timer = 0; play.textContent = '▶ Відтворити'; };
  const show = (k) => {
    i = clamp(k, 0, D.jas.length - 1);
    $$('.js__rail button', m).forEach((b, n) => { b.setAttribute('aria-selected', String(n === i)); b.classList.toggle('is-done', n < i); });
    bar.style.width = ((i + 1) / D.jas.length) * 100 + '%';
    card.innerHTML = `<h4>${i + 1}. ${D.jas[i].t}</h4><p>${D.jas[i].d}</p>`;
  };
  m.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i) { stop(); show(+b.dataset.i); }
    else if (b.dataset.a === 'next') { stop(); show(i >= D.jas.length - 1 ? 0 : i + 1); }
    else if (b.dataset.a === 'play') { if (timer) { stop(); return; } if (i >= D.jas.length - 1) show(0); play.textContent = '❚❚ Пауза'; timer = setInterval(() => { if (i >= D.jas.length - 1) stop(); else show(i + 1); }, 3400); }
  });
  show(0);
  new IntersectionObserver((es) => { if (!es[0].isIntersecting) stop(); }).observe(m);
};

/* ============================================================ препарати */
W.drugs = (root) => {
  const m = $('[data-mount]', root);
  let area = D.drugs[0].id, cur = D.drugs[0].items[0].id;
  m.innerHTML = `<div class="dg">${chips(D.drugs.map((a) => ({ id: a.id, label: a.name })), area, 'data-a')}<div class="dg__body"><ul class="dg__list"></ul><article class="dg__card" aria-live="polite"></article></div></div>`;
  const abox = $('.dg > .ak-chips', m), list = $('.dg__list', m), card = $('.dg__card', m);
  const paint = () => {
    const a = D.drugs.find((x) => x.id === area);
    if (!a.items.some((i) => i.id === cur)) cur = a.items[0].id;
    list.innerHTML = a.items.map((i) => `<li><button type="button" data-id="${i.id}" aria-pressed="${i.id === cur}">${i.k ? molImg(i.k, 'dg__mol') : '<span class="dg__nomol">без<br>структури</span>'}<span>${i.name}</span></button></li>`).join('');
    const it = a.items.find((x) => x.id === cur);
    card.innerHTML = `<h4>${it.name}</h4><p class="dg__src"><b>Джерело:</b> ${it.src} · <b>клас:</b> ${it.cls}</p><dl><dt>Механізм</dt><dd>${it.mech}</dd><dt>Застосування</dt><dd>${it.use}</dd>${it.act ? `<dt>Активність</dt><dd>${it.act}</dd>` : ''}</dl>`;
  };
  abox.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; area = b.dataset.a; setPressed(abox, area, 'data-a'); paint(); });
  list.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cur = b.dataset.id; paint(); });
  paint();
};

/* ============================================================ запуск: віджет монтується, коли наближається до екрана */
const mounted = new WeakSet();
const mount = (node) => {
  if (mounted.has(node)) return; mounted.add(node);
  const fn = W[node.dataset.w];
  if (!fn) return;
  try { fn(node); node.classList.add('is-ready'); } catch (err) { console.error('alk widget', node.dataset.w, err); }
};
const widgets = $$('[data-w]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target); } }), { rootMargin: '300px 0px' });
  widgets.forEach((w) => io.observe(w));
} else widgets.forEach(mount);
// перехід за якорем у ще не змонтований віджет
addEventListener('hashchange', () => { const t = document.getElementById(location.hash.slice(1)); if (t) $$('[data-w]', t).forEach(mount); });
