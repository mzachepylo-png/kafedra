// Підрозділ «Блоттинг»: інтерактивні моделі. Віджети монтуються, коли наближаються до екрана.
const D = JSON.parse(document.getElementById('bt-data').textContent);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const fmt = (x, d = 1) => (+x).toFixed(d).replace('.', ',');
const mix = (a, b, t) => a + (b - a) * t;
const C = { dna: '#2B6CB0', rna: '#0F9D8A', pro: '#D9770C', gly: '#7A3FB5' };
function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}
function chips(items, cur, attr = 'data-id', cls = 'bt-chips') {
  return `<div class="${cls}" role="group">${items.map((it) => `<button type="button" ${attr}="${it.id}" aria-pressed="${it.id === cur}"${it.col ? ` style="--c:${it.col}"` : ''}>${it.label}</button>`).join('')}</div>`;
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

/* ================================================================ шість стадій */
function scene(i, m, tick = 0) {
  const col = m.col, id = m.id, o = [];
  const bands = (x, y, n, w = 26) => Array.from({ length: n }, (_, k) => `<rect x="${x}" y="${y + k * 19 + (k % 2) * 3}" width="${w}" height="6" rx="3" fill="${col}" opacity="${0.5 + 0.1 * ((k * 3) % 5)}"/>`).join('');
  if (i === 0) {
    o.push(`<path d="M210 40h100l-14 110c-1 12-10 22-22 22h-28c-12 0-21-10-22-22z" fill="#fff" stroke="#8AA0B2" stroke-width="3"/><rect x="226" y="96" width="68" height="64" rx="10" fill="${col}" opacity=".35"/>`);
    o.push(`<text x="260" y="196" text-anchor="middle" class="bt-t bt-t--b">${m.stages[0].k}</text>`);
    o.push(`<path d="M120 150c20-50 60-62 70-50s-20 50-70 50z" fill="#6BAE56" opacity=".8"/><path d="M120 150l56-40" stroke="#3F7D33" stroke-width="2"/><text x="120" y="174" text-anchor="middle" class="bt-t bt-t--s">тканина</text>`);
    o.push(`<path d="M330 100l40-30" stroke="#46584C" stroke-width="5" stroke-linecap="round"/><path d="M370 70l12-12" stroke="#8AA0B2" stroke-width="9" stroke-linecap="round"/><text x="396" y="102" class="bt-t bt-t--s">${id === 'northern' ? '65 °C' : id === 'western' ? '95 °C' : id === 'southern' ? '37 °C' : 'метанол'}</text>`);
  } else if (i === 1) {
    if (id === 'eastern') {
      o.push(`<rect x="170" y="24" width="180" height="170" rx="6" fill="#F2F2F0" stroke="#8AA0B2" stroke-width="2.5"/><path d="M170 176h180" stroke="#8AA0B2"/>`);
      [[205, 150, 5], [205, 110, 6], [260, 128, 6], [260, 70, 5], [315, 160, 5], [315, 100, 6]].forEach(([x, y, r]) => o.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity=".7"/>`));
      o.push(`<text x="260" y="214" text-anchor="middle" class="bt-t bt-t--s">розчинник піднімається ↑</text>`);
    } else {
      o.push(`<rect x="170" y="30" width="180" height="150" rx="8" fill="#EAF3FA" stroke="#8AA0B2" stroke-width="2.5"/>`);
      for (let k = 0; k < 5; k++) { o.push(`<rect x="${184 + k * 34}" y="30" width="22" height="9" fill="#fff" stroke="#8AA0B2"/>`); o.push(bands(188 + k * 34, 60 + (k % 2) * 6, 5)); }
      o.push(`<text x="260" y="204" text-anchor="middle" class="bt-t bt-t--s">${id === 'southern' ? 'агароза' : id === 'northern' ? 'формальдегід-агароза' : 'SDS-PAGE'} · міграція ↓ до ${id === 'western' ? '+' : 'анода'}</text>`);
    }
  } else if (i === 2) {
    const layers = id === 'eastern' ? [['#C9C9C9', 'нагрівач'], ['#E5E5E5', 'скловолокно'], ['#CBE8F3', 'PTFE'], ['#F0DFA8', 'PVDF/PES'], ['#E3DBF3', 'пластинка ТШХ']] : id === 'western' ? [['#FFD1CB', 'катод (−)'], ['#E5D8B8', 'губка'], ['#EAF3FA', 'гель'], ['#F0DFA8', 'мембрана'], ['#E5D8B8', 'губка'], ['#CBE4FF', 'анод (+)']] : [['#9BA4AC', 'вантаж'], ['#E5E5E5', 'рушники'], ['#F3F3EE', 'Whatman'], ['#F0DFA8', 'мембрана'], ['#EAF3FA', 'гель'], ['#CBE4FF', 'буфер SSC']];
    layers.forEach(([c, t], k) => { o.push(`<rect x="170" y="${28 + k * 28}" width="180" height="24" rx="4" fill="${c}" stroke="#8AA0B2"/><text x="364" y="${45 + k * 28}" class="bt-t bt-t--s">${t}</text>`); });
    o.push(`<path d="M146 ${id === 'western' ? 40 : 170}V${id === 'western' ? 150 : 40}" stroke="${col}" stroke-width="4" stroke-dasharray="7 6" fill="none" stroke-dashoffset="${-tick * 20}" marker-end="url(#bt-ar)"/>`);
  } else if (i === 3) {
    o.push(`<rect x="150" y="150" width="220" height="14" rx="3" fill="#E5D8B8" stroke="#A89F7E"/>`);
    if (id === 'southern' || id === 'northern') {
      o.push(`<path d="M206 36l-18 70M260 36v70M314 36l18 70" stroke="#7A3FB5" stroke-width="4" opacity="${0.5 + 0.4 * Math.sin(tick * 3)}"/><rect x="170" y="20" width="180" height="16" rx="6" fill="#4C3A8C"/><text x="260" y="32" text-anchor="middle" class="bt-t bt-t--s" style="fill:#fff">УФ 254 нм</text>`);
      o.push(`<text x="260" y="194" text-anchor="middle" class="bt-t bt-t--s">ковалентна фіксація нуклеїнових кислот</text>`);
    } else {
      for (let k = 0; k < 16; k++) o.push(`<circle cx="${166 + k * 12.5}" cy="${120 + (k % 3) * 8}" r="${5 + (k % 2) * 2}" fill="${id === 'western' ? '#E8D9B8' : '#F5EFE0'}" stroke="#C9B58A"/>`);
      o.push(`<text x="260" y="194" text-anchor="middle" class="bt-t bt-t--s">блокатор закриває вільні ділянки мембрани</text>`);
    }
    o.push(`<rect x="214" y="144" width="26" height="6" rx="3" fill="${col}"/><rect x="290" y="144" width="26" height="6" rx="3" fill="${col}" opacity=".7"/>`);
  } else if (i === 4) {
    o.push(`<rect x="130" y="150" width="260" height="14" rx="3" fill="#E5D8B8" stroke="#A89F7E"/><rect x="214" y="144" width="26" height="6" rx="3" fill="${col}"/>`);
    const y0 = 96 + Math.sin(tick * 2) * 3;
    if (id === 'western' || id === 'eastern') {
      o.push(`<g transform="translate(227 ${y0})"><path d="M0 40L-14 12M0 40L14 12M0 40V64" stroke="#C0392B" stroke-width="5" stroke-linecap="round" fill="none"/></g>`);
      o.push(`<g transform="translate(227 ${y0 - 46}) scale(.8)"><path d="M0 40L-14 12M0 40L14 12M0 40V64" stroke="#2B6CB0" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="0" cy="-2" r="8" fill="#FFD54A" stroke="#C9A227"/></g>`);
    } else {
      o.push(`<path d="M214 144h26" stroke="#C0392B" stroke-width="5"/><path d="M214 138h26" stroke="${col}" stroke-width="4"/><circle cx="227" cy="${y0}" r="9" fill="#FFD54A" stroke="#C9A227"/><text x="227" y="${y0 + 4}" text-anchor="middle" class="bt-t bt-t--s">★</text>`);
      o.push(`<text x="260" y="196" text-anchor="middle" class="bt-t bt-t--s">зонд знаходить комплементарну послідовність</text>`);
    }
    o.push(`<text x="260" y="216" text-anchor="middle" class="bt-t bt-t--s">${m.stages[4].k}</text>`);
  } else {
    o.push(`<rect x="150" y="30" width="220" height="150" rx="8" fill="#13241A"/>`);
    [[190, 60, 56, .95], [190, 96, 40, .55], [260, 76, 50, .85], [260, 130, 36, .45], [320, 62, 30, .7]].forEach(([x, y, w, a], k) => { o.push(`<rect x="${x}" y="${y}" width="${w}" height="9" rx="4" fill="${id === 'eastern' ? '#B07AE8' : '#fff'}" opacity="${a * (0.8 + 0.2 * Math.sin(tick * 3 + k))}"/>`); });
    o.push(`<text x="260" y="204" text-anchor="middle" class="bt-t bt-t--s">${m.stages[5].k}</text>`);
  }
  return `<defs><marker id="bt-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker></defs>` + o.join('');
}
W.flow = (root) => {
  const m = $('[data-mount]', root);
  let mi = 0, si = 0, tick = 0;
  m.innerHTML = `<div class="fl">${chips(D.flow.map((f) => ({ id: f.id, label: f.name + ' · ' + f.sub, col: f.col })), D.flow[0].id)}
    <ol class="fl__rail" role="tablist"></ol><div class="fl__body"><svg class="bt-svg fl__svg" viewBox="0 0 520 230" role="img" aria-label="Схема стадії блоттингу"></svg><article class="fl__card" aria-live="polite"></article></div></div>`;
  const box = $('.bt-chips', m), rail = $('.fl__rail', m), svg = $('svg', m), card = $('.fl__card', m);
  const cur = () => D.flow[mi];
  const paint = () => {
    const f = cur(); m.style.setProperty('--c', f.col);
    rail.innerHTML = f.stages.map((s, k) => `<li><button type="button" role="tab" data-i="${k}" aria-selected="${k === si}"><span>${k + 1}</span>${s.t}</button></li>`).join('');
    const s = f.stages[si];
    card.innerHTML = `<h4>${si + 1}. ${s.t}</h4><p>${s.d}</p><p class="fl__k">${s.k}</p>`;
    svg.innerHTML = scene(si, f, tick);
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mi = D.flow.findIndex((x) => x.id === b.dataset.id); setPressed(box, b.dataset.id); paint(); });
  rail.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; si = +b.dataset.i; paint(); });
  paint();
  loopWhenVisible(m, (dt) => { tick += dt; svg.innerHTML = scene(si, cur(), tick); });
};

/* ================================================================ підбір методу */
W.chooser = (root) => {
  const m = $('[data-mount]', root);
  const meta = Object.fromEntries(D.flow.map((f) => [f.id, f]));
  const anchors = { southern: '#southern', northern: '#northern', western: '#western', eastern: '#eastern' };
  m.innerHTML = `<div class="ch"><ul class="ch__list">${D.chooser.map((t, i) => `<li><button type="button" data-i="${i}" aria-pressed="${i === 0}">${t.q}</button></li>`).join('')}</ul><article class="ch__card" aria-live="polite"></article></div>`;
  const card = $('.ch__card', m), list = $('.ch__list', m);
  const show = (i) => {
    $$('button', list).forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const t = D.chooser[i], f = meta[t.m];
    card.style.setProperty('--c', f.col);
    card.innerHTML = `<span class="ch__tag" style="background:${f.col}">${f.name}-блоттинг · ${f.sub}</span><h4>${t.q}</h4><p class="ch__why">${t.why}</p>
      <dl><dt>Мембрана</dt><dd>${t.mem}</dd><dt>Зонд</dt><dd>${t.probe}</dd><dt>Що побачимо</dt><dd>${t.exp}</dd></dl><a class="bt-link" href="${anchors[t.m]}">Перейти до розділу ${f.name}-блоттингу →</a>`;
  };
  list.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(+b.dataset.i); });
  show(0);
};

/* ================================================================ мембрани */
W.membranes = (root) => {
  const m = $('[data-mount]', root);
  let f = 'all';
  m.innerHTML = `<div class="mb">${chips(D.membTypes.map((t) => ({ id: t.id, label: t.label })), f)}<div class="mb__grid"></div></div>`;
  const grid = $('.mb__grid', m), box = $('.bt-chips', m);
  const paint = () => {
    const lab = { dna: 'ДНК', rna: 'РНК', protein: 'Білки', glyco: 'Глікозиди' };
    grid.innerHTML = D.memb.filter((x) => f === 'all' || x.types.includes(f)).map((x) => `<article class="mb__card"><h4>${x.name}</h4><div class="mb__tags">${x.types.map((t) => `<span class="mb__tag mb__tag--${t}">${lab[t]}</span>`).join('')}</div>
      <dl><dt>Зв’язувальна здатність</dt><dd>${x.cap}</dd><dt>Підготовка</dt><dd>${x.act}</dd><dt>Фіксація</dt><dd>${x.fix}</dd></dl><p>${x.note}</p></article>`).join('') || '<p class="bt-hint">Немає мембран для цього типу.</p>';
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; f = b.dataset.id; setPressed(box, f); paint(); });
  paint();
};

/* ================================================================ хронометраж */
W.gantt = (root) => {
  const m = $('[data-mount]', root);
  const fmtT = (min) => (min >= 120 ? `${fmt(min / 60)} год` : `${min} хв`);
  const tot = (g) => g.steps.reduce((a, s) => a + s[1], 0);
  const max = Math.max(...D.gantt.map(tot));
  m.innerHTML = `<div class="gn"><div class="gn__rows">${D.gantt.map((g) => `<div class="gn__row" data-id="${g.id}"><b>${g.name}</b><div class="gn__bar" style="--c:${g.col}">${g.steps.map((s, k) => `<button type="button" class="gn__seg" data-k="${k}" style="flex:${s[1]};min-width:3px" aria-label="${s[0]}: ${fmtT(s[1])}"><i style="height:${Math.max(18, (s[2] / s[1]) * 100)}%"></i></button>`).join('')}</div><span class="gn__tot">${fmtT(tot(g))}</span></div>`).join('')}</div>
    <div class="gn__axis" aria-hidden="true"><span>0</span><span>12 год</span><span>24 год</span><span>36 год</span><span>48 год</span></div>
    <p class="gn__read" aria-live="polite">Наведіть курсор або клацніть на сегмент.</p></div>`;
  const read = $('.gn__read', m);
  const info = (btn) => {
    const g = D.gantt.find((x) => x.id === btn.closest('.gn__row').dataset.id), s = g.steps[+btn.dataset.k];
    read.innerHTML = `<b>${g.name}: ${s[0]}</b> — загалом ${fmtT(s[1])}, з них активної роботи ≈ ${fmtT(s[2])} (${Math.round((s[2] / s[1]) * 100)} %).`;
  };
  // ширина рядка пропорційна повному часу
  $$('.gn__row', m).forEach((r, k) => { $('.gn__bar', r).style.width = (tot(D.gantt[k]) / max) * 100 + '%'; });
  m.addEventListener('mouseover', (e) => { const b = e.target.closest('.gn__seg'); if (b) info(b); });
  m.addEventListener('click', (e) => { const b = e.target.closest('.gn__seg'); if (b) info(b); });
  m.addEventListener('focusin', (e) => { const b = e.target.closest('.gn__seg'); if (b) info(b); });
};

/* ================================================================ гель-електрофорез */
const GEL = {
  dna: { name: 'Агарозний гель · ДНК', unit: 'п.н.', col: C.dna, pcts: [0.5, 2.0, 0.1, 1.0], lgc: (p) => 3.5 - 0.9 * (p - 1.0), wd: 2.4, front: 'бромфеноловий синій',
    marker: [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 750, 500, 250],
    lanes: [['Геномна ДНК + EcoRI', [9400, 5200, 2300, 1700]], ['Геномна ДНК + HindIII', [7100, 3600, 1200]], ['ПЛР-продукти', [1800, 900, 450]]] },
  rna: { name: 'Формальдегід-агароза · РНК', unit: 'нт', col: C.rna, pcts: [0.8, 2.0, 0.1, 1.2], lgc: (p) => 3.35 - 0.8 * (p - 1.2), wd: 2.3, front: 'барвник',
    marker: [6000, 4000, 3000, 2000, 1500, 1000, 500, 200],
    lanes: [['Тотальна РНК листка', [3400, 1800]], ['РНК, відібрана на oligo-dT', [2400, 1500, 1100]], ['мРНК гена-мішені', [1300]]] },
  pro: { name: 'SDS-PAGE · білки', unit: 'кДа', col: C.pro, pcts: [6, 18, 1, 12], lgc: (p) => 1.75 - 0.065 * (p - 12), wd: 2.1, front: 'бромфеноловий синій',
    marker: [250, 150, 100, 75, 50, 37, 25, 20, 15, 10],
    lanes: [['Екстракт листка (Rubisco)', [55, 15, 25]], ['Тепловий шок (HSP)', [90, 70, 55, 15]], ['Очищений рекомбінантний білок', [42]]] },
  small: { name: 'ПААГ 15 % + сечовина · малі РНК', unit: 'нт', col: C.rna, pcts: [10, 20, 1, 15], lgc: (p) => 1.5 - 0.07 * (p - 15), wd: 1.6, front: 'ксиленціанол',
    marker: [200, 100, 76, 60, 40, 30, 25, 22, 20, 17, 10],
    lanes: [['Листок, контроль', [76, 22, 21]], ['Листок, вірусна інфекція (vsiRNA)', [76, 24, 22, 21]], ['синтетичний олігонуклеотид', [30]]] },
};
W.gel = (root) => {
  const m = $('[data-mount]', root);
  let key = 'dna', pct = GEL.dna.pcts[3], time = 70, sel = null;
  m.innerHTML = `<div class="gl"><div class="gl__ctl">${chips(Object.entries(GEL).map(([id, g]) => ({ id, label: g.name, col: g.col })), key)}
    <div class="gl__sl"><label>Концентрація гелю: <output id="gl-p"></output></label><input type="range" id="gl-pr" aria-label="Концентрація гелю"></div>
    <div class="gl__sl"><label>Час електрофорезу: <output id="gl-t"></output></label><input type="range" id="gl-tr" min="10" max="120" step="1" value="70" aria-label="Час електрофорезу"></div></div>
    <div class="gl__body"><svg class="bt-svg gl__gel" viewBox="0 0 360 320" role="img" aria-label="Модель гелю"></svg><div class="gl__plot"><svg class="bt-svg" viewBox="0 0 300 260" role="img" aria-label="Калібрувальний графік lg M — відстань"></svg><p class="gl__read" aria-live="polite">Клацніть на смузі, щоб оцінити її розмір.</p></div></div></div>`;
  const box = $('.gl__ctl .bt-chips', m), gel = $('.gl__gel', m), plot = $('.gl__plot svg', m), read = $('.gl__read', m), pr = $('#gl-pr', m), tr = $('#gl-tr', m);
  const X0 = 40, LW = 60, LG = 18, TOP = 40, LEN = 250;
  const G = () => GEL[key];
  const rpos = (M, f) => {
    const g = G(), rr = 0.5 - (Math.log10(M) - g.lgc(pct)) / g.wd;
    const re = rr > 0.05 ? rr : 0.05 * Math.exp((rr - 0.05) * 6);
    return f * re;
  };
  const all = () => {
    const g = G(), f = time / 80, rows = [{ name: 'Маркер', sizes: g.marker, marker: true }, ...g.lanes.map((l) => ({ name: l[0], sizes: l[1] }))];
    return { f, rows };
  };
  const draw = () => {
    const g = G(), { f, rows } = all();
    gel.innerHTML = `<defs><filter id="gl-bl"><feGaussianBlur stdDeviation="1.2"/></filter></defs><rect x="14" y="${TOP - 20}" width="332" height="${LEN + 36}" rx="10" fill="#EAF3FA" stroke="#8AA0B2" stroke-width="2.5"/>`;
    rows.forEach((r, k) => {
      const x = 28 + k * (LW + LG);
      svgEl('rect', { x, y: TOP - 14, width: LW, height: 10, fill: '#fff', stroke: '#8AA0B2' }, gel);
      svgEl('text', { x: x + LW / 2, y: TOP + LEN + 26, 'text-anchor': 'middle', class: 'bt-t bt-t--cap' }, gel).textContent = r.marker ? 'M' : ['A', 'Б', 'В'][k - 1];
      r.sizes.forEach((M) => {
        const p = rpos(M, f);
        if (p > 0.985) return;
        const y = TOP + p * LEN;
        const b = svgEl('rect', { x: x + 4, y: y - 3, width: LW - 8, height: 6, rx: 3, fill: r.marker ? '#46584C' : g.col, opacity: r.marker ? 0.7 : 0.95, filter: 'url(#gl-bl)', 'data-m': M, 'data-lane': k, class: 'gl__band', tabindex: 0 }, gel);
        b.append(Object.assign(svgEl('title'), { textContent: r.marker ? `${M} ${g.unit}` : `${r.name}` }));
      });
      if (r.marker) { let lastY = -99; r.sizes.forEach((M) => { const p = rpos(M, f); const yy = TOP + p * LEN; if (p < 0.985 && yy - lastY > 11) { lastY = yy; svgEl('text', { x: x - 3, y: yy + 4, 'text-anchor': 'end', class: 'bt-t bt-t--cap' }, gel).textContent = M >= 1000 && g.unit === 'п.н.' ? fmt(M / 1000, 0) + 'к' : M; } }); }
    });
    const yf = TOP + f * LEN;
    if (yf < TOP + LEN - 2) { svgEl('rect', { x: 28, y: yf - 2, width: rows.length * (LW + LG) - LG, height: 4, fill: '#3B6DDE', opacity: 0.55 }, gel); svgEl('text', { x: 342, y: yf + 4, 'text-anchor': 'end', class: 'bt-t bt-t--cap', style: 'fill:#3B6DDE' }, gel).textContent = g.front; }
    else svgEl('text', { x: 180, y: TOP + LEN + 12, 'text-anchor': 'middle', class: 'bt-t bt-t--cap', style: 'fill:#C0392B' }, gel).textContent = 'фронт барвника вийшов із гелю';
    svgEl('text', { x: 180, y: 16, 'text-anchor': 'middle', class: 'bt-t bt-t--s' }, gel).textContent = '− катод';
    svgEl('text', { x: 180, y: TOP + LEN + 38, 'text-anchor': 'middle', class: 'bt-t bt-t--s' }, gel).textContent = '+ анод';
    drawPlot();
  };
  const regress = () => {
    const g = G(), f = time / 80;
    const pts = g.marker.map((M) => ({ M, p: rpos(M, f), r: rpos(M, f) / f })).filter((q) => q.p < 0.97 && q.r > 0.1 && q.r < 0.98);
    if (pts.length < 3) return null;
    const n = pts.length, xs = pts.map((q) => q.p), ys = pts.map((q) => Math.log10(q.M));
    const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    const b = sxy / sxx, a = my - b * mx;
    return { a, b, pts };
  };
  const drawPlot = () => {
    const g = G(), rg = regress();
    const lo = Math.log10(Math.min(...g.marker)) - 0.1, hi = Math.log10(Math.max(...g.marker)) + 0.1;
    plot.innerHTML = '<rect x="40" y="14" width="244" height="200" fill="#fff" stroke="#C3D3C4"/>';
    const px = (p) => 40 + p * 244, py = (l) => 214 - ((l - lo) / (hi - lo)) * 200;
    for (let k = Math.ceil(lo); k <= hi; k++) { svgEl('path', { d: `M40 ${py(k)}H284`, stroke: '#E4ECE4' }, plot); svgEl('text', { x: 34, y: py(k) + 4, 'text-anchor': 'end', class: 'bt-t bt-t--cap' }, plot).textContent = '10^' + k; }
    svgEl('text', { x: 162, y: 246, 'text-anchor': 'middle', class: 'bt-t bt-t--cap' }, plot).textContent = 'відстань від лунки (частка довжини гелю)';
    svgEl('text', { x: 10, y: 120, 'text-anchor': 'middle', class: 'bt-t bt-t--cap', transform: 'rotate(-90 10 120)' }, plot).textContent = `lg M (${g.unit})`;
    const f = time / 80;
    g.marker.forEach((M) => { const p = rpos(M, f); if (p < 0.985) { const good = regress() && regress().pts.some((q) => q.M === M); svgEl('circle', { cx: px(p), cy: py(Math.log10(M)), r: 4, fill: good ? '#46584C' : '#C9C9C9', stroke: '#fff' }, plot); } });
    if (rg) {
      const x1 = clamp((lo - rg.a) / rg.b, 0, 1), x2 = clamp((hi - rg.a) / rg.b, 0, 1);
      svgEl('path', { d: `M${px(x1)} ${py(rg.a + rg.b * x1)}L${px(x2)} ${py(rg.a + rg.b * x2)}`, stroke: g.col, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }, plot);
    } else svgEl('text', { x: 162, y: 120, 'text-anchor': 'middle', class: 'bt-t bt-t--s', style: 'fill:#C0392B' }, plot).textContent = 'надто мало точок у лінійній ділянці';
    if (sel && rg) {
      const p = rpos(sel.M, f); const est = Math.pow(10, rg.a + rg.b * p);
      svgEl('circle', { cx: px(p), cy: py(rg.a + rg.b * p), r: 6, fill: 'none', stroke: '#C0392B', 'stroke-width': 3 }, plot);
      const err = Math.abs(est - sel.M) / sel.M * 100;
      read.innerHTML = `Оцінка за графіком: <b>≈ ${fmt(est, est < 100 ? 0 : 0)} ${g.unit}</b>. Справжній розмір смуги: ${sel.M} ${g.unit} (похибка ${fmt(err, 0)} %).${err > 25 ? ' Смуга поза лінійною ділянкою гелю — оцінка ненадійна.' : ''}`;
    } else if (sel) read.textContent = 'Поза лінійною ділянкою гелю точної оцінки зробити не можна.';
  };
  const setRange = () => {
    const g = G(); pr.min = g.pcts[0]; pr.max = g.pcts[1]; pr.step = g.pcts[2]; pr.value = pct;
  };
  const upd = () => { $('#gl-p', m).textContent = fmt(pct, G().pcts[2] < 1 ? 1 : 0) + ' %'; $('#gl-t', m).textContent = time + ' хв'; draw(); };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; key = b.dataset.id; setPressed(box, key); pct = G().pcts[3]; sel = null; read.textContent = 'Клацніть на смузі, щоб оцінити її розмір.'; setRange(); upd(); });
  pr.addEventListener('input', () => { pct = +pr.value; upd(); });
  tr.addEventListener('input', () => { time = +tr.value; upd(); });
  gel.addEventListener('click', (e) => { const b = e.target.closest('.gl__band'); if (!b) return; sel = { M: +b.dataset.m }; draw(); });
  setRange(); upd();
};

/* ================================================================ капілярний блот */

W.capillary = (root) => {
  const m = $('[data-mount]', root);
  let t = 8, dep = true, tick = 0, sel = 3;
  const LAY = [
    ['Ванночка з 20× SSC', 'Буфер піднімається вгору завдяки капілярності — це «двигун» переносу.'],
    ['Скляна пластина + ґніт Whatman 3MM', 'Кінці паперу занурені в буфер, пластина тримає гель над рівнем рідини.'],
    ['Гель (лунками донизу)', 'Нуклеїнові кислоти виходять із гелю разом з буфером.'],
    ['Нейлонова мембрана (Hybond-N+)', 'Пастка: ДНК/РНК зв’язується з позитивно зарядженою поверхнею. Змочіть у воді й 20× SSC.'],
    ['3 аркуші Whatman 3MM', 'Рівномірно розподіляють потік і захищають мембрану від рушників.'],
    ['Стопка паперових рушників 8–10 см', 'Тягнуть буфер угору — створюють градієнт вологості.'],
    ['Скло та вантаж 500 г', 'Рівномірний контакт; надто важкий вантаж стискає гель і закриває пори.'],
  ];
  m.innerHTML = `<div class="cap"><div class="cap__body"><svg class="bt-svg" viewBox="90 8 380 236" role="img" aria-label="Капілярний блот"></svg><div class="cap__side"><div class="cap__layers"></div><div class="cap__info" aria-live="polite"></div></div></div>
    <div class="cap__ctl"><div class="cap__sl"><label>Час переносу: <output id="cp-t"></output></label><input type="range" id="cp-tr" min="0" max="18" step="0.5" value="8" aria-label="Час переносу"></div>
    <label class="bt-check"><input type="checkbox" id="cp-d" checked> Депуринізація 0,25 М HCl</label></div><div class="cap__bars"></div></div>`;
  const svg = $('svg', m), info = $('.cap__info', m), bars = $('.cap__bars', m), tr = $('#cp-tr', m), dc = $('#cp-d', m), layers = $('.cap__layers', m);
  const eff = (kb) => { const Leff = dep ? Math.min(kb, 4) : kb; const tau = 1.2 * Math.pow(Math.max(Leff, 0.3), 0.9) * (dep || kb < 4 ? 1 : 1.7); return 1 - Math.exp(-t / tau); };
  // шари зверху вниз: [індекс у LAY, колір, y, висота]
  const STACK = [[6, '#9BA4AC', 22, 22], [6, '#DDE3E8', 46, 8], [5, '#E5E5E5', 56, 40], [4, '#F3F3EE', 98, 14], [3, '#F0DFA8', 114, 8], [2, '#EAF3FA', 124, 38], [1, '#E8E4D6', 164, 8]];
  const sv = () => {
    const f = [0.5, 5, 15].map(eff);
    const o = [];
    o.push(`<rect data-i="0" x="100" y="176" width="250" height="60" rx="8" fill="#CBE4FF" stroke="${sel === 0 ? '#5B44A8' : '#8AA0B2'}" stroke-width="${sel === 0 ? 3.5 : 1.5}"/>`);
    o.push('<path d="M150 170v40M300 170v40" stroke="#E8E4D6" stroke-width="7"/>');
    STACK.forEach(([idx, c, y, h]) => o.push(`<rect data-i="${idx}" x="130" y="${y}" width="190" height="${h}" rx="3" fill="${c}" stroke="${sel === idx ? '#5B44A8' : '#8AA0B2'}" stroke-width="${sel === idx ? 3.5 : 1.5}"/>`));
    [['#7FB6E8', 0], ['#4A89C8', 1], ['#1F5C96', 2]].forEach(([c, k]) => {
      o.push(`<rect x="${160 + k * 40}" y="${138 + k * 4}" width="26" height="6" rx="3" fill="${c}" opacity="${1 - f[k]}"/><rect x="${160 + k * 40}" y="115" width="26" height="4" rx="2" fill="${c}" opacity="${f[k]}"/>`);
    });
    for (let k = 0; k < 4; k++) { const off = (tick * 40 + k * 20) % 60; o.push(`<path d="M${150 + k * 50} ${170 - off}v-14" stroke="#2B6CB0" stroke-width="3" stroke-linecap="round" opacity="${0.85 - off / 80}"/>`); }
    o.push('<text x="336" y="38" class="bt-t bt-t--s">вантаж 500 г</text><text x="336" y="82" class="bt-t bt-t--s">рушники</text><text x="336" y="108" class="bt-t bt-t--s">Whatman</text><text x="336" y="122" class="bt-t bt-t--s" style="fill:#8C6A10">мембрана</text><text x="336" y="148" class="bt-t bt-t--s">гель</text><text x="336" y="172" class="bt-t bt-t--s">ґніт на пластині</text><text x="360" y="212" class="bt-t bt-t--s">20× SSC</text>');
    svg.innerHTML = o.join('');
  };
  const ui = () => {
    const f = [0.5, 5, 15].map(eff);
    $('#cp-t', m).textContent = fmt(t, 1) + ' год';
    bars.innerHTML = [['0,5 т.п.н.', f[0], '#7FB6E8'], ['5 т.п.н.', f[1], '#4A89C8'], ['15 т.п.н.', f[2], '#1F5C96']].map(([n, v, c]) => `<div class="cap__bar"><span>${n}</span><i style="width:${v * 100}%;background:${c}"></i><b>${Math.round(v * 100)} % на мембрані</b></div>`).join('');
    layers.innerHTML = LAY.map((l, i) => `<button type="button" data-i="${i}" aria-pressed="${i === sel}">${l[0]}</button>`).join('');
    info.innerHTML = `<b>${LAY[sel][0]}</b><p>${LAY[sel][1]}</p>`;
  };
  layers.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sel = +b.dataset.i; ui(); sv(); });
  tr.addEventListener('input', () => { t = +tr.value; ui(); sv(); });
  dc.addEventListener('change', () => { dep = dc.checked; ui(); sv(); });
  ui(); sv();
  loopWhenVisible(m, (dt) => { tick += dt; sv(); });
};

/* ================================================================ сендвіч для Вестерну */
W.sandwich = (root) => {
  const m = $('[data-mount]', root);
  const KIND = { cat: ['Катод (−), чорна панель', '#2B2B2B', '#fff'], sp: ['Губка', '#E8D9B8', '#13241A'], pp: ['Whatman 3MM (2–3 аркуші)', '#F3F3EE', '#13241A'], gel: ['Гель SDS-PAGE', '#C9E3F5', '#13241A'], mem: ['Мембрана PVDF / нітроцелюлоза', '#F0DFA8', '#13241A'], an: ['Анод (+), червона панель', '#C0392B', '#fff'] };
  let order = ['pp', 'an', 'sp', 'gel', 'cat', 'mem', 'sp', 'pp'], sel = 0, status = null, anim = 0;
  m.innerHTML = `<div class="sw"><div class="sw__list"></div><div class="sw__vis"><svg class="bt-svg" viewBox="0 0 520 200" role="img" aria-label="Сендвіч для електропереносу"></svg><div class="sw__res" aria-live="polite"><p class="bt-hint">Складіть сендвіч від катода (−) до анода (+) і запустіть перенос.</p></div><div class="sw__btns"><button type="button" class="bt-btn" data-a="run">Запустити перенос</button><button type="button" class="bt-btn bt-btn--ghost" data-a="shuffle">Перемішати</button><button type="button" class="bt-btn bt-btn--ghost" data-a="solve">Показати правильно</button></div></div></div>`;
  const list = $('.sw__list', m), svg = $('svg', m), res = $('.sw__res', m);
  const GOOD = ['cat', 'sp', 'pp', 'gel', 'mem', 'pp', 'sp', 'an'];
  const drawList = () => {
    list.innerHTML = '<p class="sw__pole">− катод (початок)</p>' + order.map((k, i) => `<div class="sw__item${i === sel ? ' is-sel' : ''}" data-i="${i}" style="--bg:${KIND[k][1]};--fg:${KIND[k][2]}"><span>${i + 1}. ${KIND[k][0]}</span><div><button type="button" data-d="-1" aria-label="Вгору">↑</button><button type="button" data-d="1" aria-label="Вниз">↓</button></div></div>`).join('') + '<p class="sw__pole">+ анод (кінець)</p>';
  };
  const drawVis = (f = 0, evalr = null) => {
    const w = 440 / order.length;
    const o = ['<defs><marker id="sw-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#D9770C"/></marker></defs>'];
    order.forEach((k, i) => o.push(`<rect x="${40 + i * w}" y="50" width="${w - 3}" height="90" rx="4" fill="${KIND[k][1]}" stroke="#46584C" stroke-width="1.5"/>`));
    o.push('<text x="40" y="38" class="bt-t bt-t--cap">− катод</text><text x="480" y="38" text-anchor="end" class="bt-t bt-t--cap">анод +</text>');
    if (f > 0 && evalr) {
      const gi = order.indexOf('gel'), mi = order.indexOf('mem'), ai = order.length - 1;
      for (let d = 0; d < 6; d++) {
        const x0 = 40 + gi * w + w / 2, pos = (f * 1.0 + d * 0.15) % 1;
        const stop = evalr.lost ? 40 + (order.length) * w : 40 + mi * w + w / 2;
        const x = mix(x0, stop, pos > 1 ? 1 : pos);
        if (mi > gi || evalr.lost) o.push(`<circle cx="${x}" cy="${72 + d * 12}" r="5" fill="${evalr.lost ? '#C0392B' : '#D9770C'}" stroke="#fff"/>`);
      }
    }
    o.push('<path d="M60 168h400" stroke="#D9770C" stroke-width="3" marker-end="url(#sw-ar)"/><text x="260" y="188" text-anchor="middle" class="bt-t bt-t--s">білки (−) рухаються до анода (+)</text>');
    svg.innerHTML = o.join('');
  };
  const evaluate = () => {
    const ok = order.every((k, i) => k === GOOD[i]);
    const gi = order.indexOf('gel'), mi = order.indexOf('mem');
    const msgs = [];
    if (order[0] !== 'cat' || order[order.length - 1] !== 'an') msgs.push('Електроди мають стояти по краях: катод (−) спочатку, анод (+) в кінці.');
    if (mi < gi) msgs.push('Мембрана стоїть з боку катода — білки пройдуть крізь гель і нічого не потраплятиме на мембрану: усі білки будуть втрачені.');
    if (Math.abs(gi - mi) !== 1) msgs.push('Гель і мембрана мають торкатися одне одного без прошарків.');
    if (!(order[gi - 1] === 'pp' && order[mi + 1] === 'pp' && gi < mi)) msgs.push('З обох боків «пари гель–мембрана» потрібен фільтрувальний папір, потім губки.');
    return { ok, lost: mi < gi, msgs };
  };
  const run = () => {
    status = evaluate();
    res.innerHTML = status.ok ? '<div class="sw__ok"><b>Правильний порядок.</b> Білки виходять із гелю й зупиняються на мембрані: катод (−) → губка → папір → гель → мембрана → папір → губка → анод (+).</div>' : `<div class="sw__bad"><b>Є помилки:</b><ul>${status.msgs.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
    cancelAnimationFrame(anim); const t0 = performance.now();
    const loop = (now) => { const f = ((now - t0) / 2600); drawVis(f % 1 + 0.01, status); if (f < 3 && !REDUCED) anim = requestAnimationFrame(loop); };
    if (REDUCED) drawVis(0.6, status); else anim = requestAnimationFrame(loop);
  };
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.sw__item'); if (!item) return;
    const i = +item.dataset.i, b = e.target.closest('button');
    if (b) { const j = i + +b.dataset.d; if (j >= 0 && j < order.length) { [order[i], order[j]] = [order[j], order[i]]; sel = j; } } else sel = i;
    status = null; cancelAnimationFrame(anim); drawList(); drawVis();
  });
  $('.sw__btns', m).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'run') run();
    else if (b.dataset.a === 'shuffle') { order = ['pp', 'an', 'sp', 'gel', 'cat', 'mem', 'sp', 'pp']; sel = 0; cancelAnimationFrame(anim); res.innerHTML = '<p class="bt-hint">Складіть сендвіч від катода (−) до анода (+).</p>'; drawList(); drawVis(); }
    else if (b.dataset.a === 'solve') { order = GOOD.slice(); sel = 0; cancelAnimationFrame(anim); drawList(); run(); }
  });
  drawList(); drawVis();
};

/* ================================================================ жорсткість гібридизації */

W.stringency = (root) => {
  const m = $('[data-mount]', root);
  const S = { ssc: Math.log10(0.5), T: 62, form: 0, L: 400, gc: 45 };
  m.innerHTML = `<div class="sg"><div class="sg__ctl">
    <div class="sg__sl"><label>SSC: <output data-o="ssc"></output></label><input type="range" data-k="ssc" min="-1" max="0.3" step="0.05" aria-label="Концентрація SSC"></div>
    <div class="sg__sl"><label>Температура відмивки: <output data-o="T"></output></label><input type="range" data-k="T" min="40" max="80" step="1" aria-label="Температура"></div>
    <div class="sg__sl"><label>Формамід: <output data-o="form"></output></label><input type="range" data-k="form" min="0" max="50" step="5" aria-label="Формамід"></div>
    <div class="sg__sl"><label>Довжина зонда: <output data-o="L"></output></label><input type="range" data-k="L" min="20" max="1000" step="10" aria-label="Довжина зонда"></div>
    <div class="sg__sl"><label>GC-склад: <output data-o="gc"></output></label><input type="range" data-k="gc" min="30" max="65" step="1" aria-label="GC-склад"></div></div>
    <div class="sg__vis"><svg class="bt-svg sg__mem" viewBox="0 0 300 200" role="img" aria-label="Мембрана після відмивки"></svg><svg class="bt-svg sg__plot" viewBox="0 0 300 200" role="img" aria-label="Криві плавлення"></svg></div><div class="sg__out" aria-live="polite"></div></div>`;
  const mem = $('.sg__mem', m), plot = $('.sg__plot', m), out = $('.sg__out', m);
  const DUP = [['Ідеальна мішень', 0, '#2B6CB0'], ['Гомолог (≈ 8 % невідповідностей)', 8, '#D9770C'], ['Паралог (≈ 20 %)', 20, '#7A3FB5']];
  const tm = () => 81.5 + 16.6 * Math.log10(0.195 * Math.pow(10, S.ssc)) + 0.41 * S.gc - 0.63 * S.form - 600 / S.L;
  const frac = (T, Tm) => 1 / (1 + Math.exp((T - Tm) / 2.2));
  const draw = () => {
    const Tm = tm();
    mem.innerHTML = '<rect x="20" y="22" width="260" height="140" rx="8" fill="#F0E9CF" stroke="#A89F7E" stroke-width="2"/>';
    DUP.forEach(([n, mis, col], k) => {
      const f = frac(S.T, Tm - mis * 1.4);
      svgEl('rect', { x: 45 + k * 80, y: 66, width: 50, height: 12, rx: 5, fill: col, opacity: clamp(f, 0.04, 1) }, mem);
      svgEl('text', { x: 70 + k * 80, y: 106, 'text-anchor': 'middle', class: 'bt-t bt-t--s' }, mem).textContent = `${Math.round(f * 100)} %`;
      svgEl('text', { x: 70 + k * 80, y: 148, 'text-anchor': 'middle', class: 'bt-t bt-t--cap' }, mem).textContent = ['ідеал', '≈ 92 %', '≈ 80 %'][k];
    });
    svgEl('text', { x: 150, y: 14, 'text-anchor': 'middle', class: 'bt-t bt-t--s' }, mem).textContent = `Мембрана після відмивки при ${S.T} °C`;
    svgEl('text', { x: 150, y: 182, 'text-anchor': 'middle', class: 'bt-t bt-t--cap' }, mem).textContent = 'внизу — ідентичність зонда й мішені';
    plot.innerHTML = '<rect x="36" y="14" width="250" height="150" fill="#fff" stroke="#C3D3C4"/>';
    const px = (T) => 36 + ((T - 30) / 70) * 250, py = (f) => 164 - f * 150;
    DUP.forEach(([n, mis, col]) => {
      let d = ''; for (let T = 30; T <= 100; T += 2) d += (T === 30 ? 'M' : 'L') + px(T) + ' ' + py(frac(T, Tm - mis * 1.4));
      svgEl('path', { d, stroke: col, 'stroke-width': 2.5, fill: 'none' }, plot);
    });
    svgEl('path', { d: `M${px(S.T)} 14V164`, stroke: '#C0392B', 'stroke-width': 2, 'stroke-dasharray': '5 4' }, plot);
    [30, 50, 70, 90].forEach((T) => { svgEl('text', { x: px(T), y: 178, 'text-anchor': 'middle', class: 'bt-t bt-t--cap' }, plot).textContent = T; });
    svgEl('text', { x: 160, y: 196, 'text-anchor': 'middle', class: 'bt-t bt-t--cap' }, plot).textContent = 'температура, °C';
    svgEl('text', { x: 14, y: 90, 'text-anchor': 'middle', class: 'bt-t bt-t--cap', transform: 'rotate(-90 14 90)' }, plot).textContent = 'частка дуплексу';
    const spec = frac(S.T, Tm) - frac(S.T, Tm - 20 * 1.4);
    out.innerHTML = `<p><b>T<sub>m</sub> ідеального дуплексу ≈ ${fmt(Tm, 0)} °C</b>. Типова температура гібридизації ≈ T<sub>m</sub> − 25 ≈ ${fmt(Tm - 25, 0)} °C; відмивки — на 5–15 °C нижче T<sub>m</sub>.</p>
    <p>${S.T < Tm - 25 ? 'Надто низька жорсткість: зонд тримається за паралоги — буде багато додаткових смуг.' : S.T > Tm + 2 ? 'Надто висока жорсткість: навіть ідеальний дуплекс розплавляється — сигнал зникне.' : spec > 0.6 ? 'Хороша жорсткість: ідеальна мішень лишається, паралоги змиваються.' : 'Помірна жорсткість: гомологи й паралоги лишаються частково.'}</p>`;
    $$('output', m).forEach((o) => { const k = o.dataset.o; o.textContent = k === 'ssc' ? fmt(Math.pow(10, S.ssc), 2) + '× SSC' : k === 'T' ? S[k] + ' °C' : k === 'form' ? S[k] + ' %' : k === 'L' ? S[k] + ' нт' : S[k] + ' %'; });
  };
  $$('input[data-k]', m).forEach((r) => { r.value = S[r.dataset.k]; r.addEventListener('input', () => { S[r.dataset.k] = +r.value; draw(); }); });
  draw();
};

/* ================================================================ віртуальний Саузерн */
W.southernsim = (root) => {
  const m = $('[data-mount]', root);
  let tab = 'copy', enz = 'one', copies = [1, 2, 3, 1], revealed = false, meth = { c: 10, s: 70 };
  const SIZES = [[9.8, 6.1, 4.9], [8.4, 5.2], [11.2, 7.3, 3.9]];
  m.innerHTML = `<div class="ss">${chips([{ id: 'copy', label: 'Копійність трансгена' }, { id: 'meth', label: 'Метилювання (HpaII / MspI)' }], tab, 'data-t')}<div class="ss__body"></div></div>`;
  const body = $('.ss__body', m), tabs = $('.bt-chips', m);
  const blot = (lanes, ladder, col, w = 440) => {
    const lo = 0.5, hi = 12, py = (kb) => 20 + (1 - (Math.log10(kb) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 190;
    let s = `<svg class="bt-svg" viewBox="0 0 ${w} 250" role="img" aria-label="Віртуальний блот"><rect x="10" y="6" width="${w - 20}" height="220" rx="8" fill="#13241A"/>`;
    ladder.forEach((kb) => { s += `<path d="M18 ${py(kb)}h24" stroke="#8AA0B2" stroke-width="2"/><text x="46" y="${py(kb) + 3}" class="bt-t bt-t--cap" style="fill:#B9C8BF">${kb}</text>`; });
    lanes.forEach((l, k) => {
      const x = 80 + k * ((w - 100) / lanes.length);
      s += `<rect x="${x - 4}" y="14" width="46" height="8" rx="2" fill="#3A4A40"/><text x="${x + 19}" y="244" text-anchor="middle" class="bt-t bt-t--cap">${l.n}</text>`;
      l.b.forEach(([kb, a]) => { s += `<rect x="${x}" y="${py(kb)}" width="38" height="6" rx="3" fill="#fff" opacity="${clamp(a, 0.05, 1)}"/>`; });
    });
    return s + '</svg>';
  };
  const drawCopy = () => {
    const lanes = [{ n: 'WT', b: enz === 'one' ? [[3.1, 0.35]] : [[1.8, 0.0]] }];
    copies.forEach((c, i) => {
      const b = [];
      if (enz === 'one') { for (let k = 0; k < c; k++) b.push([SIZES[i % 3][k % 3] + k * 0.4, 0.9]); b.push([3.1, 0.3]); }
      else b.push([1.8, clamp(0.22 * c + 0.05, 0.1, 1)]);
      lanes.push({ n: 'L' + (i + 1), b });
    });
    body.innerHTML = `<div class="ss__row"><div class="ss__ctl"><p class="ss__lab">Фермент рестрикції</p>${chips([{ id: 'one', label: 'HindIII — ріже Т-ДНК один раз' }, { id: 'two', label: 'EcoRI — ріже по обидва боки гена' }], enz, 'data-e')}
      <p class="bt-hint">${enz === 'one' ? 'Кожна вставка дає власний «граничний» фрагмент (стик Т-ДНК з геномом), довжина якого залежить від місця вставки: число смуг = число копій.' : 'Внутрішній фрагмент однаковий для всіх копій (1,8 кб), але його інтенсивність зростає з кількістю копій — потрібна кількісна оцінка.'}</p>
      <div class="ss__btns"><button type="button" class="bt-btn" data-a="new">Нова задача</button><button type="button" class="bt-btn bt-btn--ghost" data-a="rev">${revealed ? 'Сховати відповідь' : 'Показати відповідь'}</button></div>
      <p class="ss__ans" aria-live="polite">${revealed ? 'Копій: ' + copies.map((c, i) => `L${i + 1} — ${c}`).join(', ') + '. WT — 0 (лише ендогенна смуга 3,1 кб).' : 'Скільки копій у ліній L1–L4?'}</p></div><div class="ss__fig">${blot(lanes, [10, 6, 3, 2, 1], '#fff')}</div></div>`;
  };
  const methFig = () => {
    const lanes = [];
    [['Контроль', meth.c], ['Стрес', meth.s]].forEach(([n, p]) => {
      lanes.push({ n: n.slice(0, 3) + ' −', b: [[2.0, 0.9]] });
      lanes.push({ n: n.slice(0, 3) + ' Msp', b: [[0.8, 0.95]] });
      lanes.push({ n: n.slice(0, 3) + ' Hpa', b: [[2.0, p / 100 + 0.05], [0.8, (100 - p) / 100 + 0.05]] });
    });
    $('.ss__fig', body).innerHTML = blot(lanes, [3, 2, 1, 0.5], '#fff', 460);
    $('.ss__ans', body).innerHTML = `Оцінка за блотом: контроль ≈ <b>${meth.c} %</b>, стрес ≈ <b>${meth.s} %</b> (відношення інтенсивності смуги 2,0 кб до суми смуг 2,0 + 0,8 кб у доріжці HpaII).`;
    $$('output', body).forEach((o) => { o.textContent = meth[o.dataset.o] + ' %'; });
  };
  const drawMeth = () => {
    body.innerHTML = `<div class="ss__row"><div class="ss__ctl"><p class="bt-hint">У промоторі один сайт CCGG. <b>MspI</b> ріже його незалежно від метилювання, <b>HpaII</b> — лише якщо внутрішній цитозин не метильований. Смуга 2,0 кб у доріжці HpaII означає метильований сайт.</p>
      <div class="gl__sl"><label>Метилювання, контроль: <output data-o="c"></output></label><input type="range" data-m="c" min="0" max="100" step="5" value="${meth.c}" aria-label="Метилювання, контроль"></div>
      <div class="gl__sl"><label>Метилювання, стрес: <output data-o="s"></output></label><input type="range" data-m="s" min="0" max="100" step="5" value="${meth.s}" aria-label="Метилювання, стрес"></div>
      <p class="ss__ans" aria-live="polite"></p></div><div class="ss__fig"></div></div>`;
    methFig();
  };
  const paint = () => (tab === 'copy' ? drawCopy() : drawMeth());
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; setPressed(tabs, tab, 'data-t'); paint(); });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.e) { enz = b.dataset.e; paint(); }
    else if (b.dataset.a === 'new') { copies = [1, 2, 3, 4].map(() => 1 + Math.floor(Math.random() * 4)); revealed = false; paint(); }
    else if (b.dataset.a === 'rev') { revealed = !revealed; paint(); }
  });
  body.addEventListener('input', (e) => { const r = e.target.closest('input[data-m]'); if (!r) return; meth[r.dataset.m] = +r.value; methFig(); });
  paint();
};

/* ================================================================ віртуальний Нозерн (CMV) */
W.northernsim = (root) => {
  const m = $('[data-mount]', root);
  const RN = [['РНК1', 3.3, ['3p', '1a']], ['РНК2', 3.0, ['3p', '2b']], ['РНК3', 2.2, ['3p', 'cp', 'mp']], ['РНК4', 1.0, ['3p', 'cp']], ['РНК4A', 0.7, ['3p', '2b']]];
  const PR = [['3p', '3′-кінцева консервативна ділянка'], ['cp', 'ген білка оболонки (CP)'], ['mp', 'ген білка руху (3a)'], ['2b', 'ген супресора сайленсингу 2b'], ['1a', 'ген 1a (метилтрансфераза/геліказа)']];
  let pr = '3p', nmd = false;
  m.innerHTML = `<div class="ns"><div class="ns__ctl"><p class="ss__lab">Зонд</p>${chips(PR.map(([id, l]) => ({ id, label: l })), pr, 'data-p')}<label class="bt-check"><input type="checkbox" id="ns-nmd"> Вибіркова деградація РНК3 (NMD)</label>
    <p class="bt-hint ns__hint"></p></div><div class="ns__fig"></div></div>`;
  const box = $('.bt-chips', m), fig = $('.ns__fig', m), hint = $('.ns__hint', m);
  const draw = () => {
    const py = (kb) => 30 + (1 - (Math.log10(kb) - Math.log10(0.5)) / (Math.log10(4.2) - Math.log10(0.5))) * 236;
    let s = '<svg class="bt-svg" viewBox="0 0 420 330" role="img" aria-label="Віртуальний Нозерн-блот"><rect x="10" y="6" width="400" height="296" rx="8" fill="#13241A"/>';
    [4, 3, 2, 1, 0.5].forEach((kb) => { s += `<path d="M20 ${py(kb)}h20" stroke="#8AA0B2" stroke-width="2"/><text x="44" y="${py(kb) + 3}" class="bt-t bt-t--cap" style="fill:#B9C8BF">${kb} кб</text>`; });
    [['Здорова', false], ['Інфікована', true]].forEach(([n, inf], k) => {
      const x = 130 + k * 130;
      s += `<rect x="${x - 4}" y="14" width="64" height="8" rx="2" fill="#3A4A40"/><text x="${x + 28}" y="322" text-anchor="middle" class="bt-t bt-t--cap">${n}</text>`;
      if (inf) RN.forEach(([name, kb, pb], i) => {
        if (!pb.includes(pr)) return;
        let a = i < 3 ? 0.85 : 1;
        if (name === 'РНК3' && nmd) a = 0.3;
        s += `<rect x="${x}" y="${py(kb)}" width="56" height="7" rx="3" fill="#fff" opacity="${a}"/><text x="${x + 62}" y="${py(kb) + (name === 'РНК1' ? 2 : name === 'РНК2' ? 13 : 8)}" class="bt-t bt-t--cap" style="fill:#fff">${name}</text>`;
      });
      else s += `<rect x="${x}" y="${py(3.4)}" width="56" height="4" rx="2" fill="#6B7C70" opacity=".35"/>`;
    });
    fig.innerHTML = s + '</svg>';
    const hit = RN.filter(([, , pb]) => pb.includes(pr)).map((r) => r[0]);
    hint.innerHTML = `Зонд розпізнає: <b>${hit.join(', ')}</b>. ${pr === '3p' ? 'Усі п’ять РНК мають спільний 3′-кінець, тому видно повний набір, зокрема субгеномні РНК4 і РНК4A.' : pr === 'cp' ? 'Білок оболонки кодується РНК3, але транслюється з субгеномної РНК4.' : pr === 'mp' ? 'Білок руху кодується лише РНК3 (вона біцистронна).' : pr === '2b' ? 'Ген 2b є на РНК2 та субгеномній РНК4A.' : 'Ген 1a міститься лише на РНК1.'} ${nmd ? 'Інтенсивність РНК3 знижена — NMD вибірково руйнує її.' : ''}`;
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pr = b.dataset.p; setPressed(box, pr, 'data-p'); draw(); });
  $('#ns-nmd', m).addEventListener('change', (e) => { nmd = e.target.checked; draw(); });
  draw();
};

/* ================================================================ детекція антитілами */

W.detect = (root) => {
  const m = $('[data-mount]', root);
  let mode = 'indirect', step = 0, k = 2, tick = 0;
  const STEPS = ['Антиген на мембрані', 'Первинні антитіла', 'Вторинні антитіла з ферментом', 'Субстрат ECL (люмінол + H₂O₂)', 'Світловий сигнал'];
  m.innerHTML = `<div class="dt"><div class="dt__ctl">${chips([{ id: 'direct', label: 'Пряма' }, { id: 'indirect', label: 'Непряма' }, { id: 'biotin', label: 'Біотин–стрептавідин' }], mode, 'data-m')}
    <div class="gl__sl dt__k"><label>Вторинних на одне первинне: <output></output></label><input type="range" min="1" max="4" step="1" value="2" aria-label="Вторинних антитіл на одне первинне"></div></div>
    <ol class="dt__steps"></ol><svg class="bt-svg" viewBox="0 20 520 210" role="img" aria-label="Схема детекції"></svg><p class="dt__sum" aria-live="polite"></p></div>`;
  const box = $('.bt-chips', m), svg = $('svg', m), ol = $('.dt__steps', m), sum = $('.dt__sum', m), kr = $('input', m);
  const mult = () => (mode === 'direct' ? 1 : mode === 'indirect' ? k : k * 3);
  const Y = (x, y, col, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0L-12 -22M0 0L12 -22M0 0V20" stroke="${col}" stroke-width="5" stroke-linecap="round" fill="none"/></g>`;
  const sv = () => {
    const o = ['<rect x="30" y="206" width="460" height="14" rx="3" fill="#D8D2BC" stroke="#A89F7E"/>'];
    [110, 260, 410].forEach((x, i) => {
      o.push(`<circle cx="${x}" cy="198" r="9" fill="${C.pro}"/>`);
      if (step >= 1) o.push(Y(x, 170, '#C0392B', 1));
      if (mode === 'direct' && step >= 1) o.push(`<circle cx="${x}" cy="138" r="8" fill="#FFD54A" stroke="#C9A227"/>`);
      if (mode !== 'direct' && step >= 2) for (let j = 0; j < k; j++) {
        const dx = (j - (k - 1) / 2) * 34;
        o.push(Y(x + dx, 110 - Math.abs(dx) * 0.2, '#2B6CB0', 0.8));
        if (mode === 'indirect') o.push(`<circle cx="${x + dx}" cy="${88 - Math.abs(dx) * 0.2}" r="7" fill="#FFD54A" stroke="#C9A227"/>`);
        else { o.push(`<path d="M${x + dx} 100l0 -12" stroke="#7A3FB5" stroke-width="3"/><circle cx="${x + dx}" cy="82" r="8" fill="#EFE3FA" stroke="#7A3FB5" stroke-width="2"/>`); for (let q = 0; q < 3; q++) o.push(`<circle cx="${x + dx + (q - 1) * 11}" cy="62" r="5" fill="#FFD54A" stroke="#C9A227"/>`); }
      }
      if (step >= 4) {
        const n = mult(), r = 20 + n * 10, a = clamp(0.12 + n * 0.04, 0.1, 0.5) * (0.85 + 0.15 * Math.sin(tick * 4 + i));
        o.push(`<circle cx="${x}" cy="${mode === 'direct' ? 138 : 84}" r="${r}" fill="#7FB6FF" opacity="${a}"/>`);
      }
    });
    if (step === 3) o.push('<text x="260" y="26" text-anchor="middle" class="bt-t bt-t--s">люмінол + H₂O₂ → (HRP) → 3-амінофталат*</text>');
    svg.innerHTML = o.join('');
  };
  const ui = () => {
    ol.innerHTML = STEPS.map((s, i) => `<li><button type="button" data-i="${i}" aria-current="${i === step}" class="${i <= step ? 'is-done' : ''}"><span>${i + 1}</span>${s}</button></li>`).join('');
    sum.innerHTML = `Ферментних молекул на одну молекулу антигена: <b>${mult()}</b>${mode === 'direct' ? ' — пряме мічення дає найслабший сигнал, зате швидке й без перехресної реакції.' : mode === 'indirect' ? ' — кілька вторинних антитіл на одне первинне підсилюють сигнал.' : ' — біотинільовані вторинні антитіла зв’язують стрептавідин з кількома HRP: максимальне підсилення.'}`;
    $('output', m).textContent = k; $('.dt__k', m).hidden = mode === 'direct';
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; setPressed(box, mode, 'data-m'); if (mode === 'direct' && step === 2) step = 1; ui(); sv(); });
  ol.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; step = +b.dataset.i; ui(); sv(); });
  kr.addEventListener('input', () => { k = +kr.value; ui(); sv(); });
  ui(); sv();
  loopWhenVisible(m, (dt) => { tick += dt; if (step >= 4) sv(); });
};

/* ================================================================ блокування */
W.blocking = (root) => {
  const m = $('[data-mount]', root);
  m.innerHTML = `<div class="bk"><ul class="bk__list">${D.blocking.map((b, i) => `<li><button type="button" data-i="${i}" aria-pressed="${i === 0}">${b.q}</button></li>`).join('')}</ul><article class="bk__card" aria-live="polite"></article></div>`;
  const list = $('.bk__list', m), card = $('.bk__card', m);
  const show = (i) => {
    $$('button', list).forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const b = D.blocking[i];
    card.innerHTML = `<h4>${b.q}</h4><div class="bk__cols"><div class="bk__good"><b>Підходить</b><ul>${b.good.map((x) => `<li>${x}</li>`).join('')}</ul></div>${b.bad.length ? `<div class="bk__bad"><b>Не використовувати</b><ul>${b.bad.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}</div><p class="bk__note">${b.note}</p>`;
  };
  list.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(+b.dataset.i); });
  show(0);
};

/* ================================================================ денситометрія й нормалізація */
W.quant = (root) => {
  const m = $('[data-mount]', root);
  const SETS = {
    w: { name: 'Вестерн: HSP70, тепловий шок 40 °C', col: C.pro, ref: 'актин', T: [1, 2.2, 3.8, 5.5, 5.0] },
    n: { name: 'Нозерн: транскрипт TaRca1', col: C.rna, ref: 'рРНК', T: [1, 1.8, 2.6, 2.1, 1.2] },
  };
  const TIME = ['0 год', '1 год', '2 год', '4 год', '6 год'];
  const L = [1, 0.62, 1.4, 0.75, 1.25];
  let key = 'w', unevenness = 60, norm = false;
  m.innerHTML = `<div class="qt">${chips(Object.entries(SETS).map(([id, s]) => ({ id, label: s.name, col: s.col })), key)}
    <div class="gl__sl"><label>Нерівність навантаження: <output></output></label><input type="range" min="0" max="100" step="5" value="60" aria-label="Нерівність навантаження"></div>
    <label class="bt-check"><input type="checkbox" id="qt-n"> Нормалізувати на референс</label><svg class="bt-svg" viewBox="0 0 520 340" role="img" aria-label="Денситометрія"></svg><p class="qt__sum" aria-live="polite"></p></div>`;
  const svg = $('svg', m), sum = $('.qt__sum', m), box = $('.bt-chips', m), rg = $('input[type=range]', m), nc = $('#qt-n', m);
  const draw = () => {
    const s = SETS[key], u = unevenness / 100;
    const load = L.map((l) => 1 + (l - 1) * u);
    const raw = s.T.map((t, i) => t * load[i]), refs = load.slice();
    const val = raw.map((r, i) => (norm ? r / refs[i] : r));
    const maxV = Math.max(...val, ...s.T) * 1.1;
    let o = '';
    // смуги
    o += `<text x="12" y="20" class="bt-t bt-t--b">${s.name.split(':')[0]}-блот</text><text x="12" y="42" class="bt-t bt-t--cap">Цільова смуга</text><text x="12" y="76" class="bt-t bt-t--cap">Референс (${s.ref})</text>`;
    TIME.forEach((t, i) => {
      const x = 130 + i * 76;
      o += `<rect x="${x}" y="28" width="56" height="62" rx="4" fill="#13241A"/>`;
      o += `<rect x="${x + 4}" y="36" width="48" height="12" rx="4" fill="#fff" opacity="${clamp(raw[i] / 6, 0.08, 1)}"/><rect x="${x + 4}" y="66" width="48" height="10" rx="4" fill="#fff" opacity="${clamp(refs[i] * 0.55, 0.08, 1)}"/>`;
      o += `<text x="${x + 28}" y="104" text-anchor="middle" class="bt-t bt-t--cap">${t}</text>`;
    });
    // діаграма
    const bx = 60, by = 290, bh = 140;
    o += `<path d="M${bx} ${by - bh}V${by}H500" stroke="#46584C" fill="none"/>`;
    TIME.forEach((t, i) => {
      const x = 90 + i * 76, h = (val[i] / maxV) * bh, ht = (s.T[i] / maxV) * bh;
      o += `<rect x="${x}" y="${by - h}" width="40" height="${h}" rx="3" fill="${s.col}" opacity="${norm ? 1 : 0.75}"/><text x="${x + 20}" y="${by - Math.max(h, ht) - 8}" text-anchor="middle" class="bt-t bt-t--cap" style="fill:#13241A;font-weight:800">${fmt(val[i], 1)}</text>`;
      o += `<path d="M${x - 4} ${by - ht}h48" stroke="#13241A" stroke-width="2" stroke-dasharray="4 3"/><text x="${x + 20}" y="${by + 16}" text-anchor="middle" class="bt-t bt-t--cap">${t}</text>`;
    });
    o += `<text x="260" y="328" text-anchor="middle" class="bt-t bt-t--cap">пунктир — справжній рівень (без похибки навантаження); ${norm ? 'стовпці — нормовані значення' : 'стовпці — сирі значення'}</text>`;
    svg.innerHTML = o;
    $('output', m).textContent = unevenness + ' %';
    const err = raw.map((r, i) => Math.abs(r / s.T[i] - 1) * 100), errN = raw.map((r, i) => Math.abs((r / refs[i]) / s.T[i] - 1) * 100);
    sum.innerHTML = norm ? `Після нормалізації відхилення від істини ≤ <b>${fmt(Math.max(...errN), 0)} %</b>: референс «скасовує» нерівне навантаження.` : `Без нормалізації сире значення відхиляється від істинного до <b>${fmt(Math.max(...err), 0)} %</b>: наприклад, у точці 1 год сигнал здається ${raw[1] < s.T[1] ? 'нижчим' : 'вищим'}, ніж справжній.`;
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; key = b.dataset.id; setPressed(box, key); draw(); });
  rg.addEventListener('input', () => { unevenness = +rg.value; draw(); });
  nc.addEventListener('change', () => { norm = nc.checked; draw(); });
  draw();
};

/* ================================================================ усунення несправностей */
W.trouble = (root) => {
  const m = $('[data-mount]', root);
  m.innerHTML = `<div class="tb">${chips(D.trouble.map((t) => ({ id: t.id, label: t.s })), D.trouble[0].id)}<div class="tb__list" aria-live="polite"></div></div>`;
  const box = $('.bt-chips', m), list = $('.tb__list', m);
  const show = (id) => { setPressed(box, id); const t = D.trouble.find((x) => x.id === id); list.innerHTML = t.c.map(([c, f], i) => `<article class="tb__item"><span>${i + 1}</span><div><b>${c}</b><p>${f}</p></div></article>`).join(''); };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.id); });
  show(D.trouble[0].id);
};

/* ================================================================ Істерн: покрокова модель */
W.eastern = (root) => {
  const m = $('[data-mount]', root);
  const P = {
    A: ['ТШХ-Істерн: рослинні глікозиди', ['Розгонка на пластинці ТШХ', 'Термічний перенос на PVDF/PES', 'Окиснення періодатом (NaIO₄)', 'Кон’югація з БСА (основа Шиффа)', 'Імунодетекція антитілами', 'Прояв 4-хлор-1-нафтолом'], [
      'Метанольні екстракти й стандарти нанесено на старт; рухома фаза піднімається по силікагелю й розділяє речовини за полярністю.',
      'Розчинник переносу «відриває» речовини від силікагелю; під тепловим пресом (120–180 °C, 30–50 с) вони переходять на мембрану.',
      'NaIO₄ (10 мг/мл, 30–60 хв) розщеплює вицинальні діоли цукру з утворенням альдегідних груп –CHO.',
      '1 % БСА в карбонатному буфері pH 9,6 (37 °C, 3 год): альдегіди реагують з ε-NH₂ лізину БСА, утворюючи основи Шиффа — глікозид «пришито» до мембрани.',
      'Блокування, анти-глікозидні MAb (1–3 год), IgG-HRP (1 год): антитіло розпізнає аглікон (гаптен) глікозиду.',
      '4-Хлор-1-нафтол + 0,03 % H₂O₂: HRP утворює пурпурно-коричневий осад — плями на місцях локалізації глікозиду.']],
    B: ['Лектиновий Істерн: глікопротеїни', ['SDS-PAGE й електроперенос', 'Блокування без молока', 'Біотинільований лектин (ConA / WGA)', 'Стрептавідин-HRP', 'Детекція ECL', 'Контроль: PNGase F'], [
      'Білкові екстракти або віріони розділено SDS-PAGE й перенесено на PVDF — як у Вестерні.',
      '3 % glycoprotein-free БСА чи 2 % ПВП-40 з 1 мМ CaCl₂, MnCl₂, MgCl₂; молоко — ні (глікопротеїни дають фон).',
      'Лектин (1–5 мкг/мл) зв’язується з вуглеводними залишками глікопротеїну: ConA — манозні, WGA — GlcNAc/сіалова кислота.',
      'Стрептавідин-HRP (1 : 5000, 45 хв) зв’язується з біотином на лектині.',
      'ECL: світловий сигнал на місці гліко-смуг.',
      'Паралельна смужка після PNGase F (відщеплює N-глікани) або лектин з конкурентним цукром (0,2 М α-метилманозид) — сигнал зникає: це доводить глікозилювання.']],
  };
  let mode = 'A', step = 0, ctrl = false, tick = 0;
  m.innerHTML = `<div class="es">${chips([{ id: 'A', label: 'Протокол А · глікозиди (ТШХ)', col: C.gly }, { id: 'B', label: 'Протокол Б · глікопротеїни (лектини)', col: C.gly }], mode, 'data-m')}
    <ol class="dt__steps es__steps"></ol><div class="es__body"><svg class="bt-svg" viewBox="0 0 520 250" role="img" aria-label="Схема Істерн-блоттингу"></svg><article class="es__card" aria-live="polite"></article></div></div>`;
  const box = $('.bt-chips', m), ol = $('.es__steps', m), svg = $('svg', m), card = $('.es__card', m);
  const sv = () => {
    const o = ['<defs><marker id="es-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#46584C"/></marker></defs>'];
    if (mode === 'A') {
      if (step === 0) {
        o.push('<rect x="190" y="20" width="140" height="190" rx="5" fill="#F2F2F0" stroke="#8AA0B2" stroke-width="2.5"/>');
        const up = REDUCED ? 1 : (tick * 0.15) % 1;
        o.push(`<rect x="192" y="${190 - 160 * 0.8}" width="136" height="${160 * 0.8 + 18}" fill="#CBE4FF" opacity=".25"/>`);
        [[220, 150, 5, .5], [220, 100, 6, .7], [260, 130, 6, .6], [260, 70, 5, .8], [300, 160, 5, .5], [300, 90, 6, .7]].forEach(([x, y, r, a]) => o.push(`<circle cx="${x}" cy="${y + 20 * (1 - up) * 0}" r="${r}" fill="${C.gly}" opacity="${a}"/>`));
        o.push('<path d="M360 190V50" stroke="#46584C" stroke-width="3" marker-end="url(#es-ar)"/><text x="372" y="124" class="bt-t bt-t--s">розчинник</text>');
      } else if (step === 1) {
        [['#C9C9C9', 40, 'нагрівач 120–180 °C'], ['#E5E5E5', 70, 'скловолокно'], ['#CBE8F3', 94, 'PTFE'], ['#F0DFA8', 116, 'PVDF / PES'], ['#E3DBF3', 140, 'пластинка ТШХ']].forEach(([c, y, t]) => o.push(`<rect x="170" y="${y}" width="180" height="22" rx="3" fill="${c}" stroke="#8AA0B2"/><text x="360" y="${y + 16}" class="bt-t bt-t--s">${t}</text>`));
        o.push(`<path d="M150 150V60" stroke="#C0392B" stroke-width="4" stroke-dasharray="6 5" stroke-dashoffset="${-tick * 20}" marker-end="url(#es-ar)"/>`);
      } else {
        o.push('<rect x="170" y="150" width="190" height="14" rx="3" fill="#F0DFA8" stroke="#A89F7E"/>');
        const spot = [215, 275, 330];
        spot.forEach((x, k) => {
          o.push(`<circle cx="${x}" cy="144" r="9" fill="${step >= 2 ? '#F2B45A' : C.gly}" opacity=".85"/>`);
          if (step === 2) o.push(`<text x="${x}" y="125" text-anchor="middle" class="bt-t bt-t--s" style="fill:#B8610C">–CHO</text>`);
          if (step >= 3) o.push(`<circle cx="${x}" cy="124" r="13" fill="#EAD2B0" stroke="#A8794A" stroke-width="2"/><text x="${x}" y="128" text-anchor="middle" class="bt-t bt-t--cap">БСА</text>`);
          if (step >= 4) o.push(`<g transform="translate(${x} 100)"><path d="M0 14L-10 -4M0 14L10 -4M0 14V34" stroke="#C0392B" stroke-width="4" stroke-linecap="round" fill="none"/></g>`);
          if (step === 4 || step === 5) o.push(`<circle cx="${x}" cy="72" r="7" fill="#FFD54A" stroke="#C9A227"/>`);
          if (step === 5) o.push(`<circle cx="${x}" cy="144" r="${16 + 3 * Math.sin(tick * 3 + k)}" fill="#B07AE8" opacity=".45"/>`);
        });
      }
    } else {
      o.push('<rect x="150" y="30" width="220" height="160" rx="6" fill="#EAF3FA" stroke="#8AA0B2" stroke-width="2"/>');
      [190, 260, 330].forEach((x, k) => {
        const have = step === 0 || step >= 1;
        o.push(`<rect x="${x - 20}" y="56" width="40" height="8" rx="4" fill="${C.pro}" opacity=".35"/>`);
        const glyc = k !== 2;
        const show = glyc && !(ctrl && step >= 5 && k === 1);
        o.push(`<rect x="${x - 20}" y="112" width="40" height="8" rx="4" fill="${C.pro}" opacity=".4"/>`);
        if (step >= 2 && show) o.push(`<path d="M${x} 112v-18" stroke="#2B6CB0" stroke-width="3"/><circle cx="${x}" cy="90" r="8" fill="#BFE0FF" stroke="#2B6CB0" stroke-width="2"/><text x="${x}" y="94" text-anchor="middle" class="bt-t bt-t--cap">L</text>`);
        if (step >= 3 && show) o.push(`<circle cx="${x}" cy="68" r="7" fill="#FFD54A" stroke="#C9A227"/>`);
        if (step >= 4 && show) o.push(`<rect x="${x - 22}" y="110" width="44" height="12" rx="5" fill="#fff" opacity="${0.55 + 0.35 * Math.sin(tick * 3 + k)}"/>`);
      });
      o.push('<text x="190" y="214" text-anchor="middle" class="bt-t bt-t--cap">гліко-білок 1</text><text x="260" y="214" text-anchor="middle" class="bt-t bt-t--cap">гліко-білок 2</text><text x="330" y="214" text-anchor="middle" class="bt-t bt-t--cap">негліко</text>');
    }
    svg.innerHTML = o.join('');
  };
  const ui = () => {
    const txt = P[mode][2];
    ol.innerHTML = P[mode][1].map((s, i) => `<li><button type="button" data-i="${i}" aria-current="${i === step}" class="${i <= step ? 'is-done' : ''}"><span>${i + 1}</span>${s}</button></li>`).join('');
    card.innerHTML = `<h4>${step + 1}. ${P[mode][1][step]}</h4><p>${txt[step]}</p>${mode === 'B' && step === 5 ? `<label class="bt-check"><input type="checkbox" id="es-c" ${ctrl ? 'checked' : ''}> Обробка PNGase F / конкурентний цукор</label>` : ''}`;
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; step = 0; ctrl = false; setPressed(box, mode, 'data-m'); ui(); sv(); });
  ol.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; step = +b.dataset.i; ui(); sv(); });
  card.addEventListener('change', (e) => { if (e.target.id === 'es-c') { ctrl = e.target.checked; ui(); sv(); } });
  ui(); sv();
  loopWhenVisible(m, (dt) => { tick += dt; sv(); });
};

/* ================================================================ запуск */
const mounted = new WeakSet();
const mount = (node) => {
  if (mounted.has(node)) return; mounted.add(node);
  const fn = W[node.dataset.w]; if (!fn) return;
  try { fn(node); node.classList.add('is-ready'); } catch (err) { console.error('bt widget', node.dataset.w, err); }
};
const widgets = $$('[data-w]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target); } }), { rootMargin: '300px 0px' });
  widgets.forEach((w) => io.observe(w));
} else widgets.forEach(mount);
addEventListener('hashchange', () => { const t = document.getElementById(location.hash.slice(1)); if (t) $$('[data-w]', t).forEach(mount); });
