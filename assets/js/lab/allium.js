// Модель «Allium cepa тест»: вибір чинників, запуск експозиції, пробірки з корінцями, мікроскоп, графіки, підрахунок і віртуальний експеримент.
import { Plot } from './plot.js';
import { num, sig, segmented, rng, hashSeed, renderTable, downloadCSV } from './ui.js';
import { AGENTS, GROUPS, ABERR, CLS, byId, simulate, ec50MI, count, chi2, CONTROL } from './allium-model.js';
import { hiDPI, drawTubes, Slide, drawMicroscope, drawCine } from './allium-draw.js';

const $ = (id) => document.getElementById(id);
const ART = '../../../konspekt/allium-cepa-test/';
const PHOTOS = (() => { try { return JSON.parse($('al-photos-data')?.textContent || '{}'); } catch { return {}; } })();
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const fmtC = (v) => { if (v < 1e4) return sig(v, v < 1 ? 2 : 3); const [m, e] = v.toExponential(1).split('e+'); return `${m.replace('.', ',')}·10${[...e].map((d) => SUP[d]).join('')}`; };
const plain = (h) => String(h).replace(/<[^>]+>/g, '');

// ------------------------------------------------------------------ стан
const S = {
  sel: [{ id: 'cd', c: 3 }], water: 'tap', protocol: 'sim', target: 48, recover: false,
  t: 0, running: false, phase: 'idle', // idle | expo | recover | done
  zoom: 1, view: { x: 450, y: 450 }, highlight: false, picked: null, seed: 7, cine: 'auto', cineT: 0, cinePlay: false,
};
const MAX_SEL = 3;
let protoSeg = null;

// ------------------------------------------------------------------ вибір чинників
function buildPicker() {
  const box = $('al-pick');
  const kinds = [['abiotic', 'Абіотичні чинники'], ['biotic', 'Біотичні чинники']];
  for (const [kind, title] of kinds) {
    const col = document.createElement('div'); col.className = 'al-pick__col';
    col.innerHTML = `<h4>${title}</h4>`;
    for (const [gid, g] of Object.entries(GROUPS)) {
      if (g.kind !== kind) continue;
      const grp = document.createElement('div'); grp.className = 'al-pick__grp';
      grp.innerHTML = `<div class="al-pick__gname">${g.name}</div>`;
      const chips = document.createElement('div'); chips.className = 'al-chips';
      for (const a of AGENTS.filter((x) => x.group === gid)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'al-chip' + (a.dr || a.stim ? ' al-chip--pos' : a.horm ? ' al-chip--horm' : '');
        b.dataset.id = a.id; b.title = plain(a.note);
        b.innerHTML = `<span class="al-chip__sign" aria-hidden="true">${a.dr || a.stim ? '+' : a.horm ? '±' : '−'}</span>${a.name}`;
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => toggle(a.id));
        chips.append(b);
      }
      grp.append(chips); col.append(grp);
    }
    box.append(col);
  }
}
function toggle(id) {
  const i = S.sel.findIndex((x) => x.id === id);
  if (i >= 0) S.sel.splice(i, 1);
  else {
    if (S.sel.length >= MAX_SEL) S.sel.shift();
    S.sel.push({ id, c: byId[id].def });
  }
  resetRun(); renderActive(); update(true);
}
function renderActive() {
  const box = $('al-active'); box.replaceChildren();
  document.querySelectorAll('.al-chip').forEach((b) => b.setAttribute('aria-pressed', String(S.sel.some((x) => x.id === b.dataset.id))));
  if (!S.sel.length) { box.innerHTML = '<p class="al-empty">Оберіть до трьох чинників зі списку — або залиште порожнім, щоб побачити негативний контроль (вода).</p>'; return; }
  for (const s of S.sel) {
    const a = byId[s.id];
    const row = document.createElement('div'); row.className = 'al-act' + (a.dr || a.stim ? ' al-act--pos' : '');
    const lmin = Math.log10(a.min), lmax = Math.log10(a.max);
    row.innerHTML = `<div class="al-act__head"><b>${a.name}</b><button type="button" class="al-act__x" aria-label="Прибрати ${plain(a.name)}">×</button></div>
      <label class="al-act__lab"><span>Концентрація</span><output>${fmtC(s.c)} ${a.unit}</output></label>
      <input type="range" min="${lmin}" max="${lmax}" step="any" value="${Math.log10(s.c)}" aria-label="Концентрація: ${plain(a.name)}">
      <p class="al-act__note">${a.note} <a href="${ART}#${a.art}">Теорія →</a></p>`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    const pct = () => inp.style.setProperty('--pct', ((inp.value - lmin) / (lmax - lmin) * 100) + '%');
    pct();
    inp.addEventListener('input', () => { s.c = +(10 ** +inp.value).toPrecision(3); out.textContent = `${fmtC(s.c)} ${a.unit}`; pct(); S.dragging = true; update(); });
    inp.addEventListener('change', () => { S.dragging = false; update(true); });
    row.querySelector('.al-act__x').addEventListener('click', () => toggle(a.id));
    box.append(row);
  }
}

// ------------------------------------------------------------------ сцена з пробірками: контроль + серія розведень
const tubesCv = $('al-tubes');
let tubesSize = { w: 0, h: 0 }, tubesCtx = null;
function sizeTubes() {
  const w = tubesCv.parentElement.clientWidth; if (!w) return;
  const h = Math.round(Math.max(300, Math.min(420, w * 0.5)));
  if (w === tubesSize.w && h === tubesSize.h) return;
  tubesSize = { w, h }; tubesCtx = hiDPI(tubesCv, w, h).ctx;
}
const FACTORS = [0, 0.1, 0.32, 1];
function tubesModel(t, recover) {
  const tox = S.sel.filter((x) => !byId[x.id].dr);
  return FACTORS.map((f) => {
    const sel = f === 0 ? [] : S.sel.map((x) => (byId[x.id].dr ? x : { id: x.id, c: x.c * f }));
    const res = simulate(sel, { t, water: S.water, protocol: S.protocol, recover });
    const lead = tox[0] || S.sel[0];
    const narrow = tubesSize.w < 620;
    const sub = f === 0 ? (S.water === 'tap' ? (narrow ? 'вода' : 'водопровідна вода') : (narrow ? 'дист. вода' : 'дистильована вода')) : lead ? `${fmtC(lead.c * (byId[lead.id].dr ? 1 : f))} ${byId[lead.id].unit}` : '';
    return { res, label: f === 0 ? 'Контроль' : f === 1 ? 'C' : f === 0.32 ? 'C / 3' : 'C / 10', sub };
  });
}
function tintFor(f) {
  if (!f || !S.sel.length) return null;
  const a = byId[(S.sel.find((x) => !byId[x.id].dr) || S.sel[0]).id];
  return a.tint ? a.tint.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * (0.35 + 0.65 * f)).toFixed(2) + ')') : null;
}

// ------------------------------------------------------------------ мікроскоп
const microCv = $('al-micro');
let microSize = 0, microCtx = null, slide = null, slideCv = document.createElement('canvas'), prevCv = null, spareCv = null, microDirty = true, fade = 1, fadeT0 = 0, lastAssignKey = '';
function sizeMicro() {
  const w = Math.min(microCv.parentElement.clientWidth, 560); if (!w || w === microSize) return;
  microSize = w; microCtx = hiDPI(microCv, w, w).ctx;
}
function rebuildSlide(res, crossfade) {
  const fresh = !slide || slide.seed !== S.seed;
  if (fresh) slide = new Slide(900, S.seed);
  slide.assign(res);
  const fadeIn = crossfade && !REDUCED;
  if (fresh || !slideCv.width) {
    if (fadeIn && slideCv.width) { prevCv = slideCv; slideCv = document.createElement('canvas'); fade = 0; fadeT0 = performance.now(); }
    slide.render(slideCv);
  } else {
    // змінюються лише окремі клітини: копія старого поля для плавного переходу + точкове перемальовування
    if (fadeIn) {
      if (!spareCv) spareCv = document.createElement('canvas');
      if (spareCv.width !== slideCv.width) { spareCv.width = slideCv.width; spareCv.height = slideCv.height; }
      const g = spareCv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(slideCv, 0, 0);
    }
    const n = slide.patch(slideCv);
    if (fadeIn && n) { prevCv = spareCv; fade = 0; fadeT0 = performance.now(); }
  }
  if (fade < 1) kick(); // плавна зміна поля зору навіть коли модель стоїть
  microDirty = true;
  S.picked = null; showPicked();
}
function marks() {
  if (!S.highlight || !slide) return [];
  return slide.cells.filter((c) => c.ab && c.ab !== 'ghost').map((c) => ({ poly: c.poly, color: c.ab === 'pyk' ? '#B91C1C' : CLS[ABERR[c.ab]?.cls]?.color || '#B91C1C' }));
}
function drawMicro() {
  if (!microCtx) return;
  const z = S.zoom === 1 ? 1 : 2.5;
  S.view.x = Math.max(260 / z, Math.min(900 - 260 / z, S.view.x)); S.view.y = Math.max(260 / z, Math.min(900 - 260 / z, S.view.y));
  microGeom = drawMicroscope(microCtx, microSize, microSize, slideCv, prevCv, fade, { ...S.view, z }, { highlight: S.picked, marks: marks(), scaleUm: z > 1 ? 10 : 20, label: `${z > 1 ? '1000' : '400'}× · ацетоорсеїн` });
}
let microGeom = null;
function cellAt(ev) {
  if (!microGeom || !slide) return null;
  const r = microCv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
  if (Math.hypot(x - microGeom.cx, y - microGeom.cy) > microGeom.r) return null;
  return slide.hit(S.view.x + (x - microGeom.cx) / microGeom.k, S.view.y + (y - microGeom.cy) / microGeom.k);
}
const STATE_NAME = { I: 'Інтерфаза', P: 'Профаза', M: 'Метафаза', A: 'Анафаза', T: 'Телофаза' };
const STATE_INFO = {
  I: ['Клітина між поділами: ядро з ядерцями, хромосоми деспіралізовані.', 'cell-cycle'],
  P: ['Хромосоми спіралізуються і стають видимими як нитки (спірема), ядерця зникають.', 'cell-cycle'],
  M: ['Хромосоми вишикувалися на екваторі веретена поділу (метафазна пластинка).', 'cell-cycle'],
  A: ['Сестринські хроматиди розходяться до полюсів. Саме тут найкраще видно мости, фрагменти, відстаючі хромосоми.', 'why-anaphase'],
  T: ['Хромосоми досягли полюсів, формуються дочірні ядра і клітинна пластинка.', 'why-anaphase'],
};
const AB_INFO = {
  bridge: 'Хроматинова нитка між полюсами: дицентрична хромосома після злиття розірваних кінців.',
  frag: 'Шматок хромосоми без центромери: не прикріплюється до веретена і лишається на екваторі.',
  lag: 'Ціла хромосома запізнюється через погане прикріплення кінетохора до мікротрубочок.',
  vag: 'Хромосома випереджає основну групу і відходить до полюса раніше: нерівний розподіл (2n ± 1).',
  sticky: 'Хромосоми злиплися в аморфну темну масу; за Fiskesjö — ознака незворотної токсичності.',
  cmit: 'К-мітоз: веретена немає, конденсовані X-подібні хромосоми розсіяні по клітині.',
  multi: 'Хромосоми розходяться до трьох і більше полюсів — утворюються нежиттєздатні міні-ядра.',
  mn: 'Маленьке окреме ядро з фрагмента або відстаючої хромосоми, яка не потрапила в дочірнє ядро.',
  bin: 'Два ядра в одній клітині: поділ ядра відбувся, а клітинна пластинка не утворилась.',
  bud: 'Випинання ядерної оболонки на ніжці: клітина виводить надлишкову або пошкоджену ДНК.',
  pyk: 'Пікноз: ядро зморщилося й ущільнилося — ознака загибелі клітини.',
  ghost: 'Клітина-привид без ядра: термінальна стадія загибелі.',
};
function showPicked() {
  const box = $('al-cell'); if (!box) return;
  const c = S.picked;
  if (!c) { box.innerHTML = '<p class="al-cell__hint">Торкніться клітини в полі зору, щоб дізнатися, що з нею відбувається.</p>'; return; }
  if (c.ab) {
    const A = ABERR[c.ab], cls = A ? CLS[A.cls] : { name: 'ознака загибелі клітини', color: '#B91C1C' };
    const name = A ? A.name : c.ab === 'pyk' ? 'Пікноз ядра' : 'Клітина-привид';
    const ph = PHOTOS.atlas?.[c.ab];
    box.innerHTML = `<b style="color:${cls.color}">${name}</b><span class="al-tag" style="--c:${cls.color}">${cls.name}</span><p>${AB_INFO[c.ab]}</p>
      <p class="al-cell__links"><a href="${ART}#${A?.art || 'nuclear-anomalies'}">У теорії →</a>${ph ? ` <button type="button" class="al-linkbtn" data-photo="${c.ab}">Справжнє фото</button>` : ''}</p>`;
    box.querySelector('[data-photo]')?.addEventListener('click', () => openPhoto(ph));
  } else {
    const [txt, art] = STATE_INFO[c.st];
    box.innerHTML = `<b>${STATE_NAME[c.st]}</b><span class="al-tag" style="--c:#2E7D32">норма</span><p>${txt}</p><p class="al-cell__links"><a href="${ART}#${art}">У теорії →</a></p>`;
  }
}
let phA = null;
function openPhoto(ph) {
  if (!ph) return;
  if (!phA) { phA = document.createElement('a'); phA.hidden = true; phA.dataset.lightbox = ''; document.body.append(phA); }
  phA.href = ph.src; phA.dataset.caption = `${plain(ph.caption)} ${plain(ph.cred)}`;
  phA.click(); // lightbox.js перехоплює клік по a[data-lightbox]
}

// ------------------------------------------------------------------ кінограма поділу
const cineCv = $('al-cine');
let cineSize = { w: 0, h: 0 }, cineCtx = null;
function sizeCine() {
  const w = cineCv.parentElement.clientWidth; if (!w) return;
  const h = Math.round(Math.min(260, w * 0.62));
  if (w === cineSize.w && h === cineSize.h) return;
  cineSize = { w, h }; cineCtx = hiDPI(cineCv, w, h).ctx;
}
function cineType(res) {
  if (S.cine !== 'auto') return S.cine;
  if (!res || res.ca < CONTROL.ca + 3) return 'normal';
  const ent = Object.entries(res.mix).filter(([k]) => ['bridge', 'frag', 'lag', 'vag', 'sticky', 'cmit', 'multi'].includes(k)).sort((a, b) => b[1] - a[1]);
  return ent[0]?.[0] || 'normal';
}
function drawCineNow(res) {
  if (!cineCtx) return;
  const ty = cineType(res);
  const label = drawCine(cineCtx, cineSize.w, cineSize.h, ty, S.cineT);
  $('al-cine-lab').textContent = label;
}

// ------------------------------------------------------------------ графіки
let doseP, timeP;
function leadAgent() { const t = S.sel.find((x) => !byId[x.id].dr); return t || S.sel[0]; }
function drawPlots() {
  const L = leadAgent();
  const opts = { t: S.target, water: S.water, protocol: S.protocol };
  if (L) {
    const a = byId[L.id], lo = Math.log10(a.min), hi = Math.log10(a.max), mi = [], ca = [];
    for (let i = 0; i <= 80; i++) {
      const lc = lo + (hi - lo) * i / 80, sel = S.sel.map((x) => (x.id === L.id ? { id: x.id, c: 10 ** lc } : x));
      const r = simulate(sel, opts); mi.push([lc, r.miRel * 100]); ca.push([lc, r.ca]);
    }
    const cur = simulate(S.sel, opts);
    doseP.setOptions({ xLabel: `lg C (${a.unit})`, x: [lo, hi] });
    doseP.set([
      { data: mi, color: '#1B5E20', width: 2.4, label: 'MI, % від контролю' },
      { data: ca, color: '#C2410C', width: 2.2, dash: [6, 4], label: 'Аберантні анафази–телофази, %' },
      { data: [[Math.log10(L.c), cur.miRel * 100]], color: '#1B5E20', type: 'points', r: 5 },
      { data: [[Math.log10(L.c), cur.ca]], color: '#C2410C', type: 'points', r: 5 },
    ], [{ y: 50, label: 'LCV 50 %', color: '#B45309' }, { y: 22, label: 'летальний поріг 22 %', color: '#B91C1C' }]);
  } else doseP.set([], []);
  const T = S.target + (S.recover ? 24 : 0), mi = [], len = [], ctl = [];
  for (let i = 0; i <= 96; i++) {
    const tt = T * i / 96, rec = tt > S.target ? tt - S.target : 0;
    const r = simulate(S.sel, { ...opts, t: Math.min(tt, S.target), recover: rec });
    mi.push([tt, r.mi]); len.push([tt, r.len / 10]);
    ctl.push([tt, simulate([], { ...opts, t: Math.min(tt, S.target), recover: rec }).mi]);
  }
  timeP.setOptions({ x: [0, T] });
  timeP.set([
    { data: ctl, color: '#94A3B8', width: 1.6, dash: [4, 4], label: 'MI контролю, %' },
    { data: mi, color: '#1B5E20', width: 2.4, label: 'MI, %' },
    { data: len, color: '#00695C', width: 2, label: 'Довжина корінців, см' },
  ], [{ x: S.t, label: `${Math.round(S.t)} год`, color: '#FFB300' }].concat(S.recover ? [{ x: S.target, label: 'вода', color: '#0284C7' }] : []));
}

// ------------------------------------------------------------------ результати
function readouts(res) {
  const set = (k, v) => { const el = document.querySelector(`[data-out="${k}"]`); if (el) el.innerHTML = v; };
  set('mi', `${num(res.mi, 1)} %`);
  set('mirel', `${num(res.miRel * 100, 0)} %`);
  set('pi', `${num(res.phases.P, 0)} / ${num(res.phases.M, 0)} / ${num(res.phases.A + res.phases.T, 0)}`);
  set('ca', `${num(res.ca, 1)} %`);
  set('mn', `${num(res.mn, 1)} ‰`);
  set('len', `${num(res.len / 10, 1)} см`);
  set('dr', res.protected ? `${num(res.dr, 0)} %` : '—');
  const L = leadAgent();
  const e = L && !byId[L.id].dr ? ec50MI(byId[L.id], { water: S.water, protocol: S.protocol }) : null;
  set('ec50', !e ? '—' : e > byId[L.id].max ? `&gt; ${fmtC(byId[L.id].max)} ${byId[L.id].unit}` : `${fmtC(e)} ${byId[L.id].unit}`);
  const v = $('al-verdict');
  // той самий критерій, що й у таблиці підрахунку: χ² для очікуваної кількості аберантних A–T (до 300 з 5000 клітин)
  const nAT = (r) => Math.min(300, 5000 * r.mi / 100 * (r.phases.A + r.phases.T) / 100);
  const o = curOpts(), ctl = simulate([], { ...o, protocol: 'sim' }), n1 = nAT(res), n0 = nAT(ctl);
  const fewAT = n1 < 20;
  const genotox = !fewAT && res.ca > ctl.ca && chi2(Math.round(res.ca / 100 * n1), Math.round(n1), Math.round(ctl.ca / 100 * n0), Math.round(n0)).p < 0.05;
  const txt = {
    lethal: ['al-v--bad', 'Летальна (мітоцидна) дія: MI нижче 22 % від контролю — меристема майже не ділиться.'],
    sublethal: ['al-v--warn', 'Сублетальна цитотоксичність: MI знизився більш ніж удвічі (поріг LCV).'],
    stim: ['al-v--good', 'Мітостимулювальна дія: поділ інтенсивніший, ніж у контролі, без приросту аберацій.'],
    cmit: ['al-v--warn', 'К-мітоз: клітини зупинились у метафазі через ушкодження веретена, тому MI формально зріс — це не стимуляція поділу.'],
    ok: ['al-v--ok', res.miRel < 0.85 ? 'Помірна цитотоксичність: MI знижений, але вище порогу LCV.' : 'Цитотоксичності не виявлено: MI на рівні контролю.'],
  }[res.verdict];
  v.className = 'al-verdict ' + txt[0];
  v.innerHTML = `<b>${txt[1]}</b> ${fewAT && res.ca > ctl.ca + 2 ? '<span>Анафаз і телофаз майже немає — аберації в анафазо-телофазному тесті оцінити неможливо (лише за мікроядрами й ядерними аномаліями).</span>' : genotox ? `<span>Генотоксичність: частка аберантних анафаз–телофаз ${num(res.ca, 1)} % проти ${num(CONTROL.ca, 1)} % у контролі${res.mix ? ' — переважають ' + topTypes(res) : ''}.</span>` : '<span>Генотоксичного ефекту не виявлено.</span>'}${res.protected ? ` <span>Протектор знизив пошкодження на ${num(res.dr, 0)} % (%DR, ${{ pre: 'пре-обробка', sim: 'одночасна обробка', post: 'пост-обробка' }[S.protocol]}).</span>` : ''}`;
}
function topTypes(res) {
  return Object.entries(res.mix).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => `<a href="${ART}#${ABERR[k].art}">${ABERR[k].name.toLowerCase()}</a> (${CLS[ABERR[k].cls].name})`).join(' та ');
}

// ------------------------------------------------------------------ підрахунок під мікроскопом і χ²
function countTable() {
  const o = curOpts();
  const res = simulate(S.sel, o);
  const ctl = simulate([], { ...o, protocol: 'sim' });
  const a = count(res, S.seed * 31 + 1), b = count(ctl, S.seed * 31 + 2);
  const head = ['', 'Клітин', 'I', 'P', 'M', 'A', 'T', 'MI, %', 'A–T оцінено', 'Аберантних', 'CA, %', 'MN'];
  const row = (n, c) => [n, c.N, c.I, c.P, c.M, c.A, c.T, num(c.div / c.N * 100, 1), c.nAT, c.aberr, c.nAT ? num(c.aberr / c.nAT * 100, 1) : '—', c.mn];
  renderTable($('al-count'), head, [row('Контроль', b), row('Дослід', a)]);
  const x = chi2(a.aberr, a.nAT, b.aberr, b.nAT);
  $('al-chi').innerHTML = `χ² = ${num(x.chi, 2)}, p ${x.p < 0.001 ? '&lt; 0,001' : '= ' + num(x.p, 3)} — ${x.p < 0.05 ? '<b>різниця з контролем достовірна</b> (p &lt; 0,05)' : 'різниця з контролем <b>недостовірна</b>'}. <a href="${ART}#biomarkers">Як рахують MI, CA і χ² →</a>`;
  S.lastCount = { a, b };
}

// ------------------------------------------------------------------ час і анімація
const runBtn = $('al-run'), resetBtn = $('al-reset'), statusEl = $('al-status');
function resetRun() { S.running = false; S.t = 0; S.phase = 'idle'; runBtn.textContent = '▶ Запустити'; setStatus(); }
function setStatus() {
  const msg = { idle: 'Модель зупинена — натисніть «Запустити». Цибулини вже пророщені у воді (корінці 0,8 см).', expo: `Експозиція в розчині: ${Math.round(S.t)} з ${S.target} год`, recover: `Відновлення в чистій воді: ${Math.round(S.t - S.target)} з 24 год`, done: 'Експозицію завершено. Розгляньте препарат і підрахуйте клітини.' }[S.phase];
  statusEl.textContent = S.running ? msg : S.phase === 'idle' ? msg : S.phase === 'done' ? msg : 'Пауза. ' + msg;
  statusEl.classList.toggle('on', S.running);
}
runBtn.addEventListener('click', () => {
  if (S.running) { S.running = false; runBtn.textContent = '▶ Продовжити'; setStatus(); return; }
  if (S.phase === 'done' || S.phase === 'idle') { S.t = 0; S.phase = 'expo'; }
  S.running = true; runBtn.textContent = '⏸ Пауза'; setStatus(); kick();
});
resetBtn.addEventListener('click', () => { resetRun(); update(true); });

let raf = 0, last = 0, lastSlideT = -99, sway = 0, lastPlotTs = 0, lastCountT = -99;
function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
function curOpts() {
  const rec = S.phase === 'recover' || (S.phase === 'done' && S.recover) ? Math.max(0, S.t - S.target) : 0;
  return { t: Math.min(S.t, S.target), water: S.water, protocol: S.protocol, recover: rec };
}
function curRes() { return simulate(S.sel, curOpts()); }
function frame(ts) {
  raf = 0;
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
  let need = false;
  if (S.running) {
    const end = S.target + (S.recover ? 24 : 0);
    S.t = Math.min(end, S.t + dt * (REDUCED ? 30 : 7));
    S.phase = S.t >= end ? 'done' : S.t > S.target ? 'recover' : 'expo';
    if (S.phase === 'done') { S.running = false; runBtn.textContent = '▶ Запустити знову'; }
    sway += dt * 1.3;
    setStatus(); need = S.running;
    // графік часу й таблиця підрахунку оновлюються під час експозиції (не щокадру)
    if (ts - lastPlotTs > 350 || !S.running) { lastPlotTs = ts; drawPlots(); }
    if (Math.abs(S.t - lastCountT) >= 6 || !S.running) { lastCountT = S.t; countTable(); }
  }
  if (S.cinePlay) { S.cineT = (S.cineT + dt / 9) % 1; $('al-cine-t').value = S.cineT; need = true; }
  if (fade < 1) { fade = Math.min(1, (performance.now() - fadeT0) / 450); if (fade >= 1) prevCv = null; need = true; microDirty = true; }
  render(S.running && Math.abs(S.t - lastSlideT) >= 4, true);
  if (!need) readouts(curRes());
  if (need) raf = requestAnimationFrame(frame);
}
let lastReadTs = 0, lastCineKey = '';
let sizeDirty = true;
function render(refreshSlide = false, live = false) {
  // розміри полотен читаємо лише після зміни розмітки (читання clientWidth щокадру змушує браузер перераховувати верстку)
  if (!live || sizeDirty) { sizeTubes(); sizeMicro(); sizeCine(); sizeDirty = false; }
  const res = curRes();
  if (tubesCtx) {
    const rec = S.phase === 'recover' || (S.phase === 'done' && S.recover) ? Math.max(0, S.t - S.target) : 0;
    const tm = tubesModel(Math.min(S.t, S.target), rec);
    drawTubes(tubesCtx, tubesSize.w, tubesSize.h, tm, { t: S.t, sway, maxLen: 60, tint: FACTORS.map((f) => tintFor(f)) });
  }
  const key = JSON.stringify([S.sel, S.water, S.protocol, S.recover, S.seed]);
  if (refreshSlide || key !== lastAssignKey) {
    clearTimeout(slideTimer);
    if (S.dragging && !refreshSlide) slideTimer = setTimeout(() => { rebuildSlide(curRes(), true); lastAssignKey = key; drawMicro(); }, 220);
    else { rebuildSlide(res, true); lastAssignKey = key; lastSlideT = S.t; }
  }
  // під час анімації мікроскоп, кінограму й показники оновлюємо лише коли вони справді змінились
  if (!live || microDirty) { drawMicro(); microDirty = false; }
  const cineKey = cineType(res) + S.cineT;
  if (!live || S.cinePlay || cineKey !== lastCineKey) { drawCineNow(res); lastCineKey = cineKey; }
  const now = performance.now();
  if (!live || now - lastReadTs > 250) { lastReadTs = now; readouts(res); }
}
let plotTimer = 0, slideTimer = 0;
function update(full) {
  render(full);
  clearTimeout(plotTimer); plotTimer = setTimeout(() => { drawPlots(); countTable(); renderPhotos(); }, full ? 0 : 120);
}

// ------------------------------------------------------------------ справжні фото з наукових статей
function renderPhotos() {
  const box = $('al-real'); if (!box) return;
  const groups = [...new Set(S.sel.map((x) => byId[x.id].group))];
  const list = [];
  for (const g of groups) for (const p of PHOTOS.groups?.[g] || []) if (!list.includes(p)) list.push(p);
  if (!list.length) for (const p of PHOTOS.groups?.control || []) list.push(p);
  box.replaceChildren(...list.slice(0, 6).map((p) => {
    const f = document.createElement('figure'); f.className = 'cp';
    f.innerHTML = `<a href="${p.src}" data-lightbox data-caption="${(plain(p.caption) + ' ' + plain(p.cred)).replace(/"/g, '&quot;')}" aria-label="Відкрити фото в повному розмірі"><img src="${p.src}" alt="${p.alt}" loading="lazy" decoding="async" width="${p.w}" height="${p.h}"></a><figcaption>${p.caption}<span class="cp-cred">${p.cred}</span></figcaption>`;
    return f;
  }));
  $('al-real-wrap').hidden = !list.length;
}

// ------------------------------------------------------------------ налаштування
function buildSettings() {
  segmented($('al-water'), 'al-water', [{ value: 'tap', label: 'Водопровідна' }, { value: 'dist', label: 'Дистильована' }], S.water, (v) => { S.water = v; resetRun(); update(true); });
  protoSeg = segmented($('al-proto'), 'al-proto', [{ value: 'pre', label: 'Пре-обробка' }, { value: 'sim', label: 'Одночасно' }, { value: 'post', label: 'Пост-обробка' }], S.protocol, (v) => { S.protocol = v; resetRun(); update(true); });
  segmented($('al-time'), 'al-time', [{ value: '24', label: '24 год' }, { value: '48', label: '48 год' }, { value: '72', label: '72 год' }], String(S.target), (v) => { S.target = +v; resetRun(); update(true); });
  $('al-rec').addEventListener('change', (e) => { S.recover = e.target.checked; resetRun(); update(true); });
  segmented($('al-zoom'), 'al-zoom', [{ value: '1', label: '400×' }, { value: '2', label: '1000×' }], '1', (v) => { S.zoom = +v; drawMicro(); });
  $('al-hl').addEventListener('change', (e) => { S.highlight = e.target.checked; drawMicro(); });
  $('al-field').addEventListener('click', () => { S.seed = (S.seed * 7 + 13) % 9973; update(true); });
  $('al-recount').addEventListener('click', () => { S.seed = (S.seed * 7 + 13) % 9973; update(true); });
  const types = [['auto', 'Як у досліді'], ['normal', 'Норма'], ['bridge', 'Міст'], ['frag', 'Фрагмент'], ['lag', 'Відстаюча'], ['vag', 'Блукаюча'], ['sticky', 'Липкість'], ['cmit', 'К-мітоз'], ['multi', 'Мультиполярна']];
  const sel = $('al-cine-type');
  sel.innerHTML = types.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  sel.addEventListener('change', () => { S.cine = sel.value; drawCineNow(curRes()); });
  $('al-cine-play').addEventListener('click', () => { S.cinePlay = !S.cinePlay; $('al-cine-play').textContent = S.cinePlay ? '⏸' : '▶'; $('al-cine-play').setAttribute('aria-label', S.cinePlay ? 'Пауза' : 'Відтворити поділ'); if (S.cinePlay) kick(); });
  $('al-cine-t').addEventListener('input', (e) => { S.cineT = +e.target.value; drawCineNow(curRes()); });
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset, true)));
  // мікроскоп: перетягування поля, торкання клітини
  let drag = null;
  microCv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: S.view.x, vy: S.view.y, moved: false }; microCv.setPointerCapture(e.pointerId); });
  microCv.addEventListener('pointermove', (e) => {
    if (!drag || !microGeom) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved) { S.view.x = drag.vx - dx / microGeom.k; S.view.y = drag.vy - dy / microGeom.k; drawMicro(); }
  });
  microCv.addEventListener('pointerup', (e) => { if (drag && !drag.moved) { S.picked = cellAt(e); showPicked(); drawMicro(); } drag = null; });
  microCv.addEventListener('pointercancel', () => { drag = null; });
}
/** Пресет: набір чинників і схема обробки (кнопки «Швидкий старт» і посилання зі статті …#preset-cd). */
function applyPreset(name, scroll) {
  const p = PRESETS[name]; if (!p) return false;
  S.sel = p.sel.map((x) => ({ ...x }));
  const proto = p.protocol || 'sim';
  if (proto !== S.protocol) { S.protocol = proto; protoSeg?.select(proto, false); }
  resetRun(); renderActive(); update(true);
  if (scroll) $('al-model').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  return true;
}
const PRESETS = {
  neg: { sel: [] },
  mms: { sel: [{ id: 'mms', c: 10 }] },
  cd: { sel: [{ id: 'cd', c: 3 }] },
  cu_chl: { sel: [{ id: 'cu', c: 3 }, { id: 'chlorella', c: 2 }], protocol: 'sim' },
  mms_inu: { sel: [{ id: 'mms', c: 10 }, { id: 'inulin', c: 2 }], protocol: 'post' },
  afb1_tri: { sel: [{ id: 'afb1', c: 5 }, { id: 'tricho', c: 5 }] },
  colch: { sel: [{ id: 'colch', c: 0.05 }] },
  argovit: { sel: [{ id: 'argovit', c: 60 }] },
};

// ------------------------------------------------------------------ віртуальний експеримент
const EXP_POOL = ['cd', 'pb', 'cu', 'cr', 'hg', 'gly', 'tbz', 'alpraz', 'afb1', 'ota', 'pat', 'mcylr', 'ehirta', 'sezno', 'agno3', 'dox', 'bpa', 'nacl'];
let EXP = null;
function runExperiment() {
  const v = $('al-variant').value.trim();
  if (!v) { $('al-variant').focus(); $('al-variant').setAttribute('aria-invalid', 'true'); return; }
  $('al-variant').removeAttribute('aria-invalid');
  const seed = hashSeed(v.toLowerCase()), R = rng(seed);
  const a = byId[EXP_POOL[Math.floor(R() * EXP_POOL.length)]];
  const e = ec50MI(a);
  const base = e * (0.5 + R() * 0.5), fac = [0, 0.2, 0.5, 1, 2, 4];
  const cs = fac.map((f) => +(base * f).toPrecision(2));
  const rows = cs.map((c, i) => { const res = simulate(c ? [{ id: a.id, c }] : [], { t: 48 }); const k = count(res, seed + i * 101, { N: 1000, nAT: 200, poolAT: 30000 }); return { c, res, k }; });
  EXP = { a, rows };
  $('al-exp').hidden = false;
  $('al-exp-cond').innerHTML = `<div class="readout"><div class="readout__label">Чинник</div><div class="readout__value" style="font-size:1rem">${a.name}</div></div><div class="readout"><div class="readout__label">Експозиція</div><div class="readout__value">48 год</div></div><div class="readout"><div class="readout__label">Препарат</div><div class="readout__value" style="font-size:1rem">1000 клітин на дозу</div></div>`;
  renderTable($('al-exp-table'), [`C, ${a.unit}`, 'I', 'P', 'M', 'A', 'T', 'A–T оцінено', 'Аберантних A–T', 'Мікроядер'], rows.map((r) => [r.c ? fmtC(r.c) : '0 (контроль)', r.k.I, r.k.P, r.k.M, r.k.A, r.k.T, r.k.nAT, r.k.aberr, r.k.mn]));
  $('al-exp-verdict').textContent = '';
  ['al-a-mi', 'al-a-ec', 'al-a-ca'].forEach((id) => { $(id).value = ''; });
  $('al-a-ec-u').textContent = a.unit;
}
function checkExperiment() {
  if (!EXP) return;
  const parse = (id) => parseFloat(String($(id).value).replace(',', '.').replace(/\s/g, ''));
  const ctl = EXP.rows[0].k, miC = ctl.div / ctl.N * 100;
  const rel = EXP.rows.map((r) => [Math.log10(r.c || 1e-9), r.k.div / r.k.N * 100 / miC]);
  let ecTrue = null;
  for (let i = 1; i < rel.length - 1; i++) if (rel[i][1] >= 0.5 && rel[i + 1][1] < 0.5) { const [x1, y1] = rel[i], [x2, y2] = rel[i + 1]; ecTrue = 10 ** (x1 + (0.5 - y1) * (x2 - x1) / (y2 - y1)); }
  const hi = EXP.rows[EXP.rows.length - 1].k, caTrue = hi.nAT ? hi.aberr / hi.nAT * 100 : 0;
  const close = (v, t, rel, abs) => isFinite(v) && Math.abs(v - t) <= Math.max(rel * Math.abs(t), abs);
  const ok1 = close(parse('al-a-mi'), miC, 0.05, 0.06), ok2 = ecTrue ? close(parse('al-a-ec'), ecTrue, 0.15, 0) : null, ok3 = close(parse('al-a-ca'), caTrue, 0.08, 0.15);
  const mark = (ok) => ok == null ? '—' : ok ? '✓' : '✗';
  $('al-exp-verdict').innerHTML = `MI контролю: ${mark(ok1)} (${num(miC, 2)} %) · EC50 за MI: ${mark(ok2)}${ecTrue ? ` (≈ ${sig(ecTrue, 3)} ${EXP.a.unit}, лінійна інтерполяція між сусідніми дозами в координатах lg C)` : ' (MI не впав нижче 50 %)'} · CA за найбільшої дози: ${mark(ok3)} (${num(caTrue, 1)} %)`;
  $('al-exp-verdict').className = 'verdict ' + (ok1 && ok3 && ok2 !== false ? 'verdict--ok' : 'verdict--bad');
}

// ------------------------------------------------------------------ запуск
function init() {
  buildPicker(); buildSettings(); renderActive();
  doseP = new Plot($('al-plot-dose'), { xLabel: 'lg C', yLabel: '%', y: [0, 110], aspect: 1.55, xFmt: (v) => num(v, Math.abs(v) < 10 ? 1 : 0) });
  timeP = new Plot($('al-plot-time'), { xLabel: 'Час, год', yLabel: 'MI, % · L, см', aspect: 1.55, y: 'auto' });
  $('al-exp-run').addEventListener('click', runExperiment);
  $('al-variant').addEventListener('keydown', (e) => { if (e.key === 'Enter') runExperiment(); });
  $('al-exp-check').addEventListener('click', checkExperiment);
  $('al-exp-csv').addEventListener('click', () => EXP && downloadCSV(`allium-${EXP.a.id}.csv`, ['C', 'I', 'P', 'M', 'A', 'T', 'AT_scored', 'AT_aberrant', 'MN'], EXP.rows.map((r) => [r.c, r.k.I, r.k.P, r.k.M, r.k.A, r.k.T, r.k.nAT, r.k.aberr, r.k.mn])));
  setStatus();
  let vis = true;
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis && (S.running || S.cinePlay)) kick(); }).observe($('al-model'));
  new ResizeObserver(() => { sizeDirty = true; render(false); }).observe($('al-model'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (S.running || S.cinePlay)) kick(); });
  update(true);
  const m = /^#preset-([\w-]+)$/.exec(location.hash);
  if (m && applyPreset(m[1], false)) requestAnimationFrame(() => $('al-model').scrollIntoView({ block: 'start' }));
  addEventListener('hashchange', () => { const h = /^#preset-([\w-]+)$/.exec(location.hash); if (h) applyPreset(h[1], true); });
}
init();
