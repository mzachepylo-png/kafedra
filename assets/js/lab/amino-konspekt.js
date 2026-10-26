// Конспект «Амінокислоти»: L/D-ізомери, плитки 20 амінокислот, титрування і заряд у компартментах,
// діаграми pI/гідропатичності, карта шести родин біосинтезу, N:C і стресовий пул.
import { Plot, linspace } from './plot.js';
import { sliders, setOut, num } from './ui.js';

const $ = (id) => document.getElementById(id);
const D = JSON.parse($('aa-data').textContent);
const AA = D.aa, CLS = D.cls;
const byT = Object.fromEntries(AA.map((a) => [a.t, a]));
const sign = (v, d = 2) => (v > 0.005 ? '+' : '') + num(v, d);

/** Сегментований перемикач з розмітки (.aa-seg). */
function seg(id, cb) {
  const root = $(id);
  const btns = [...root.querySelectorAll('button')];
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    cb(b.dataset.v);
  }));
}

// ---------------------------------------------------------------- хімія кислотно-основних груп
/** Іоногенні групи: [pK, тип] — 'a' кислота (0 → −1), 'b' основа (+1 → 0). */
const groups = (a) => {
  const g = [[a.p1, 'a'], [a.p2, 'b']];
  if (a.pr) g.push([a.pr, a.rt]);
  return g;
};
const protFrac = (pK, pH) => 1 / (1 + 10 ** (pH - pK));
function charge(a, pH) {
  return groups(a).reduce((q, [pK, t]) => q + (t === 'a' ? -(1 - protFrac(pK, pH)) : protFrac(pK, pH)), 0);
}
/** Розподіл молекул за сумарним зарядом (незалежні групи). */
function chargeDist(a, pH) {
  let dist = { 0: 1 };
  groups(a).forEach(([pK, t]) => {
    const p = protFrac(pK, pH), nd = {};
    const [qp, qd] = t === 'a' ? [0, -1] : [1, 0];
    for (const [q, w] of Object.entries(dist)) {
      nd[+q + qp] = (nd[+q + qp] || 0) + w * p;
      nd[+q + qd] = (nd[+q + qd] || 0) + w * (1 - p);
    }
    dist = nd;
  });
  return dist;
}
const R_ION = {
  Asp: ['CH₂–COOH', 'CH₂–COO⁻'], Glu: ['CH₂–CH₂–COOH', 'CH₂–CH₂–COO⁻'], Cys: ['CH₂–SH', 'CH₂–S⁻'], Tyr: ['CH₂–C₆H₄–OH', 'CH₂–C₆H₄–O⁻'],
  His: ['CH₂–імідазол-H⁺', 'CH₂–імідазол'], Lys: ['(CH₂)₄–NH₃⁺', '(CH₂)₄–NH₂'], Arg: ['(CH₂)₃–NH–C(=NH₂⁺)–NH₂', '(CH₂)₃–NH–C(=NH)–NH₂'],
};
const paint = (s) => s.replace(/([A-Za-zА-я₀-₉()–=-]*⁺)/g, '<span class="pos">$1</span>').replace(/([A-Za-zА-я₀-₉()–=-]*⁻)/g, '<span class="neg">$1</span>');
function formAt(a, pH) {
  const n = pH < a.p2 ? '⁺H₃N' : 'H₂N';
  const c = pH < a.p1 ? 'COOH' : 'COO⁻';
  let r = a.r.split(' (')[0].replace(/^–/, '');
  if (R_ION[a.t]) r = R_ION[a.t][pH < a.pr ? 0 : 1];
  if (a.t === 'Gly') return `${n}–CH₂–${c}`;
  if (a.t === 'Pro') return `${n === '⁺H₃N' ? '⁺H₂N' : 'HN'}(CH₂)₃–CH–${c}`;
  return `${n}–CH(${r})–${c}`;
}

/** Підпис стовпчика: праворуч від нього, а якщо не вміщується — всередині. */
function placeVal(val, x0, w, right) {
  const track = val.parentElement.clientWidth || 1, vw = val.offsetWidth + 8;
  if (!right) { val.style.left = `calc(${x0}% - ${vw}px)`; val.style.color = ''; return; }
  const fits = (x0 + w) / 100 * track + vw <= track;
  val.style.left = fits ? `calc(${x0 + w}% + 6px)` : `calc(${x0 + w}% - ${vw}px)`;
  val.style.color = fits ? '' : '#fff';
}

// ---------------------------------------------------------------- L / D
(() => {
  const shapes = $('mol-shapes'), tx = $('mol-tx');
  if (!shapes) return;
  const texts = [...tx.querySelectorAll('.mt')].map((t) => ({ t, x: +t.getAttribute('x') }));
  const cap = $('mol-cap');
  seg('mol-seg', (v) => {
    const d = v === 'D';
    shapes.classList.toggle('is-d', d);
    tx.style.opacity = '0';
    setTimeout(() => {
      texts.forEach(({ t, x }) => t.setAttribute('x', d ? 440 - x : x));
      tx.style.opacity = '1';
    }, 350);
    $('mol-name').textContent = d ? 'D-амінокислота' : 'L-амінокислота';
    cap.textContent = d
      ? 'Дзеркальне відображення: аміногрупа праворуч — D-ізомер. Його не можна сумістити з L-формою, як ліву руку з правою.'
      : 'Аміногрупа ліворуч у проєкції Фішера — L-ізомер. Рибосоми рослин вбудовують у білки лише L-амінокислоти.';
  });
})();

// ---------------------------------------------------------------- плитки і паспорт амінокислоти
const famOf = (a) => D.fam.find((f) => f.id === a.fam);
function showCard(t) {
  const a = byT[t], c = CLS[a.k], f = famOf(a);
  document.querySelectorAll('.aa-tile').forEach((el) => el.setAttribute('aria-current', String(el.dataset.t === t)));
  document.querySelectorAll('#aa-table tbody tr').forEach((tr) => tr.classList.toggle('is-hl', tr.dataset.t === t));
  const card = $('aa-card');
  card.style.setProperty('--c', c.c);
  card.innerHTML = `
    <div class="aa-card__head"><small>${c.n}</small><h3>${a.n}${a.e ? ' *' : ''}</h3><p>${a.t} · ${a.c} · ${a.f} · M<sub>r</sub> ${num(a.m, 2)}</p></div>
    <div class="aa-card__body">
      <div class="aa-card__r">R: ${a.r}</div>
      <dl>
        <div><dt>pK<sub>a1</sub></dt><dd>${num(a.p1, 2)}</dd></div>
        <div><dt>pK<sub>a2</sub></dt><dd>${num(a.p2, 2)}</dd></div>
        <div><dt>pK<sub>aR</sub></dt><dd>${a.pr ? num(a.pr, 2) : '—'}</dd></div>
        <div><dt>pI</dt><dd>${num(a.pi, 2)}</dd></div>
        <div><dt>Гідропат.</dt><dd>${sign(a.h, 1)}</dd></div>
        <div><dt>Q, pH 7,3</dt><dd>${sign(charge(a, 7.3), 2)}</dd></div>
      </dl>
      <h4>Біосинтез</h4><p><button type="button" class="aa-link" data-fam="${f.id}">${f.name}</button> — попередник: ${f.pre.toLowerCase()}.</p>
      <h4>Роль у білках і первинному обміні</h4><p>${a.r1}</p>
      <h4>Спеціалізовані функції в рослині</h4><p>${a.r2}</p>
      ${a.e ? '<p class="aa-note" style="margin:0">* Незамінна для людини і тварин — надходить з рослинною їжею.</p>' : ''}
    </div>`;
  card.querySelector('.aa-link').addEventListener('click', (e) => { selectFam(e.target.dataset.fam); $('biosynthesis').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}
(() => {
  const tiles = [...document.querySelectorAll('.aa-tile')];
  tiles.forEach((el) => el.addEventListener('click', () => { showCard(el.dataset.t); syncTitr(el.dataset.t); }));
  const chips = [...document.querySelectorAll('.aa-chip-btn')];
  chips.forEach((b) => b.addEventListener('click', () => {
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const k = b.dataset.k;
    tiles.forEach((el) => {
      const a = byT[el.dataset.t];
      const on = k === 'all' || (k === 'ess' ? a.e : a.k === k);
      el.classList.toggle('is-dim', !on);
    });
    const first = tiles.find((el) => !el.classList.contains('is-dim'));
    if (first && k !== 'all') showCard(first.dataset.t);
  }));
  showCard('Glu');
})();

// ---------------------------------------------------------------- титрування і заряд
let syncTitr = () => {};
(() => {
  const sel = $('ti-aa');
  if (!sel) return;
  sel.innerHTML = AA.map((a) => `<option value="${a.t}">${a.n} (${a.t})</option>`).join('');
  sel.value = 'His';
  const sl = sliders($('ti-c'), [{ id: 'tiph', label: 'pH середовища', min: 0, max: 14, step: 0.05, value: 7.3, digits: 2 }], upd);
  const pT = new Plot($('ti-plot'), { xLabel: 'Еквіваленти OH⁻', yLabel: 'pH', xShort: 'екв.', x: [0, 3], y: [0, 14], aspect: 1.25 });
  const pQ = new Plot($('q-plot'), { xLabel: 'pH', yLabel: 'Заряд Q', xShort: 'pH', x: [0, 14], y: [-2.2, 2.2], yZero: false, aspect: 1.25 });
  const SPC = { 2: ['#2C4FA8', '+2'], 1: ['#3F7FD0', '+1 (катіон)'], 0: ['#2E7D32', '0 (цвітеріон)'], '-1': ['#E07A2E', '−1 (аніон)'], '-2': ['#B23B22', '−2'] };
  function upd() {
    const a = byT[sel.value], pH = sl.values.tiph;
    const g = groups(a), n = g.length;
    const phs = linspace(0.2, 13.8, 300);
    const eq = (p) => g.reduce((s, [pK]) => s + (1 - protFrac(pK, p)), 0);
    pT.setOptions({ x: [0, n] });
    pT.set([
      { data: phs.map((p) => [eq(p), p]), color: CLS[a.k].c, width: 2.6, label: a.n, marker: [eq(pH), pH] },
    ], [...g.map(([pK]) => ({ y: pK, color: '#C9D3CC', dash: [4, 4], label: 'pK ' + num(pK, 2) })), { y: a.pi, color: '#B08A1E', dash: [2, 3], label: 'pI ' + num(a.pi, 2) }]);
    pQ.set([
      { data: phs.map((p) => [p, charge(a, p)]), color: CLS[a.k].c, width: 2.6, label: 'Q(pH)', marker: [pH, charge(a, pH)] },
    ], [{ y: 0, color: '#9FB3A3' }, { x: 5.5, color: '#E8833A', dash: [3, 3] }, { x: 7.3, color: '#2E7D32', dash: [3, 3] }, { x: 8.0, color: '#3F7FD0', dash: [3, 3] }]);
    const q = charge(a, pH);
    setOut(document, { tipi: num(a.pi, 2), tiq: sign(q), tiv: sign(charge(a, 5.5)), tic: sign(charge(a, 7.3)), tis: sign(charge(a, 8.0)) });
    const dist = chargeDist(a, pH);
    const keys = Object.keys(dist).map(Number).sort((x, y) => y - x);
    const dom = keys.reduce((m, k) => (dist[k] > dist[m] ? k : m), keys[0]);
    const name = dom > 0 ? 'катіон' : dom < 0 ? 'аніон' : 'цвітеріон';
    $('ti-form').innerHTML = `<small>Переважна форма при pH ${num(pH, 1)}</small><b>${paint(formAt(a, pH))}</b><em>${name}, Q = ${dom > 0 ? '+' : ''}${dom}</em>`;
    $('ti-spec').innerHTML = `<div class="aa-species__bar">${keys.map((k) => `<span style="width:${dist[k] * 100}%;background:${(SPC[k] || SPC[0])[0]}"></span>`).join('')}</div>
      <div class="aa-species__lab">${keys.filter((k) => dist[k] > 0.005).map((k) => `<span><i style="background:${(SPC[k] || SPC[0])[0]}"></i>Q = ${(SPC[k] || [0, k])[1]}: ${num(dist[k] * 100, 0)} %</span>`).join('')}</div>`;
  }
  sel.addEventListener('change', upd);
  syncTitr = (t) => { sel.value = t; upd(); };
  upd();
})();

// ---------------------------------------------------------------- pI / гідропатичність
(() => {
  const box = $('aa-bars');
  if (!box) return;
  const ROW = 24;
  const wrap = document.createElement('div');
  wrap.className = 'aa-bars__wrap';
  wrap.style.height = AA.length * ROW + 'px';
  box.append(wrap);
  const rows = AA.map((a) => {
    const r = document.createElement('div');
    r.className = 'aa-bar';
    r.style.cssText = `position:absolute;left:0;right:0;transition:top .55s cubic-bezier(.4,0,.2,1);--c:${CLS[a.k].c}`;
    r.innerHTML = `<span class="aa-bar__name">${a.t} · ${a.n}</span><span class="aa-bar__track"><span class="aa-bar__fill"></span><span class="aa-bar__val"></span></span>`;
    wrap.append(r);
    return { a, r, fill: r.querySelector('.aa-bar__fill'), val: r.querySelector('.aa-bar__val') };
  });
  const refs = [];
  function set(mode) {
    refs.forEach((x) => x.remove()); refs.length = 0;
    const key = mode === 'pi' ? 'pi' : 'h';
    const lo = mode === 'pi' ? 0 : -5, hi = mode === 'pi' ? 12 : 5;
    const pct = (v) => (v - lo) / (hi - lo) * 100;
    const sorted = [...rows].sort((x, y) => y.a[key] - x.a[key]);
    sorted.forEach((o, i) => {
      o.r.style.top = i * ROW + 'px';
      const v = o.a[key];
      const x0 = mode === 'pi' ? 0 : Math.min(pct(0), pct(v)), w = mode === 'pi' ? pct(v) : Math.abs(pct(v) - pct(0));
      o.fill.style.left = x0 + '%'; o.fill.style.width = w + '%';
      o.val.textContent = mode === 'pi' ? num(v, 2) : sign(v, 1);
      placeVal(o.val, x0, w, mode === 'pi' || v >= 0);
    });
    const track = rows[0].r.querySelector('.aa-bar__track');
    const addRef = (v, col, lab) => {
      const d = document.createElement('span');
      d.className = 'aa-bars__ref';
      const left = track.offsetLeft;
      d.style.cssText = `left:calc(${left}px + (100% - ${left}px) * ${pct(v) / 100});border-color:${col}`;
      d.title = lab;
      wrap.append(d); refs.push(d);
    };
    if (mode === 'pi') { addRef(5.5, '#E8833A', 'pH вакуолі 5,5'); addRef(7.3, '#2E7D32', 'pH цитозолю 7,3'); }
    else addRef(0, '#9FB3A3', '0');
    $('bar-note').innerHTML = mode === 'pi'
      ? 'Пунктир: pH вакуолі (5,5, помаранчевий) і цитозолю (7,3, зелений). Нейтральні амінокислоти мають pI 5,07–6,30 — у вакуолі вони електронейтральні; кислі (Asp 2,77; Glu 3,22) несуть заряд −1, основні (His 7,59; Lys 9,74; Arg 10,76) — позитивний.'
      : 'Додатні значення — гідрофобні радикали (Ile, Val, Leu, Phe): вони занурюються в ліпідний бішар мембран тилакоїдів. Від\'ємні — гідрофільні (Arg, Lys, Asp, Glu, Asn, Gln): добре розчинні та переважають у флоемному соку.';
  }
  let mode = 'pi';
  seg('bar-seg', (m) => { mode = m; set(m); });
  set(mode);
  new ResizeObserver(() => set(mode)).observe(box);
})();

// ---------------------------------------------------------------- таблиця: сортування
(() => {
  const t = $('aa-table');
  if (!t) return;
  const tb = t.tBodies[0];
  const clsOrder = Object.keys(CLS);
  t.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort;
    const dir = b.dataset.dir === 'desc' ? 'asc' : 'desc';
    t.querySelectorAll('th button').forEach((x) => delete x.dataset.dir);
    b.dataset.dir = dir;
    const val = (tr) => { const a = byT[tr.dataset.t]; return k === 'n' ? a.n : k === 'k' ? clsOrder.indexOf(a.k) : (a[k] ?? -99); };
    [...tb.rows].sort((x, y) => {
      const p = val(x), q = val(y);
      const c = typeof p === 'string' ? p.localeCompare(q, 'uk') : p - q;
      return dir === 'asc' ? c : -c;
    }).forEach((tr) => tb.append(tr));
  }));
})();

// ---------------------------------------------------------------- біосинтез
let selectFam = () => {};
(() => {
  const svg = $('fams');
  if (!svg) return;
  const panel = $('aa-fam');
  selectFam = (id) => {
    const f = D.fam.find((x) => x.id === id);
    svg.classList.add('has-sel');
    document.querySelectorAll('#fam-chips button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === id)));
    svg.querySelectorAll('[data-f]').forEach((el) => el.classList.toggle('is-on', el.dataset.f === id));
    panel.style.setProperty('--c', f.color);
    const aaNames = new Set(f.aa.map((t) => byT[t].n));
    const isAA = (m) => aaNames.has(m) || [...aaNames].some((n) => m.startsWith(n + ' '));
    const path = (p) => `<div class="aa-path">${p.map((x, i) => (i % 2 ? `<span class="aa-path__e">${x}</span>` : `<span class="aa-path__m${isAA(x) ? ' is-aa' : ''}">${x}</span>`)).join('')}</div>`;
    panel.innerHTML = `
      <div class="aa-fam__head"><h3>${f.name}</h3><p>Попередник: <b>${f.pre}</b> — ${f.preFrom}</p></div>
      <div class="aa-fam__body">
        ${f.paths.map(path).join('')}
        <div class="aa-fam__grid">
          <div><h4>Регуляція</h4><ul>${f.reg.map((r) => `<li>${r.replace(/(гальм\S*|блокує|інгіб\S*)/g, '<span class="inh">$1</span>')}</li>`).join('')}</ul></div>
          <div><h4>Де відбувається</h4><ul><li>${f.loc}</li></ul><h4 style="margin-top:12px">Амінокислоти родини</h4><ul><li>${f.aa.map((t) => `${byT[t].n}${byT[t].e ? '*' : ''}`).join(', ')}</li></ul></div>
        </div>
      </div>`;
  };
  svg.querySelectorAll('.fam-box').forEach((g) => {
    g.addEventListener('click', () => selectFam(g.dataset.f));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectFam(g.dataset.f); } });
  });
  document.querySelectorAll('#fam-chips button').forEach((b) => b.addEventListener('click', () => selectFam(b.dataset.f)));
  selectFam('asp');
})();

// ---------------------------------------------------------------- N:C і вартість синтезу
(() => {
  const box = $('nc-bars');
  if (!box) return;
  const famCol = (t) => (byT[t] ? CLS[byT[t].k].c : '#888');
  const rows = D.nc.map((d) => {
    const r = document.createElement('div');
    r.className = 'aa-bar';
    r.style.setProperty('--c', famCol(d.t));
    r.innerHTML = `<span class="aa-bar__name">${d.t}</span><span class="aa-bar__track"><span class="aa-bar__fill" style="left:0"></span><span class="aa-bar__val"></span></span>`;
    box.append(r);
    return { d, fill: r.querySelector('.aa-bar__fill'), val: r.querySelector('.aa-bar__val') };
  });
  function set(m) {
    const max = m === 'nc' ? 0.7 : 80;
    rows.forEach(({ d, fill, val }) => {
      const v = m === 'nc' ? d.N / d.C : d.atp;
      const w = v / max * 82;
      fill.style.width = w + '%';
      val.textContent = m === 'nc' ? `${num(v, 2)} · ${d.N}N : ${d.C}C` : `≈ ${d.atp} ATP`;
      placeVal(val, 0, w, true);
    });
  }
  seg('nc-seg', set);
  set('nc');
})();

// ---------------------------------------------------------------- стресовий пул
(() => {
  const st = $('pool-stack');
  if (!st) return;
  const COLS = ['#2E7D32', '#D0503A', '#D9A21B', '#E8833A', '#3E8E5A', '#7FA88A', '#7A5BD0', '#2C8FA3', '#B9C4BC'];
  COLS[4] = '#1F5E8C';
  const segs = D.pool.map((p, i) => {
    const s = document.createElement('span');
    s.style.background = COLS[i];
    st.append(s);
    return s;
  });
  const lg = $('pool-legend');
  function set(k) {
    D.pool.forEach((p, i) => {
      const v = p[k];
      segs[i].style.flex = `0 0 ${v}%`;
      segs[i].textContent = v >= 6 ? `${p.t === 'other' ? 'інші' : p.t} ${num(v, 0)}%` : '';
    });
    lg.innerHTML = D.pool.map((p, i) => `<span><i style="background:${COLS[i]}"></i>${p.n}: <b>${num(p[k], p[k] % 1 ? 1 : 0)} %</b></span>`).join('');
  }
  seg('pool-seg', set);
  set('a');
})();
