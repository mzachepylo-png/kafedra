// ЛР 1, 5, 6. Поверхнева стерилізація рослинного матеріалу: компроміс «контамінація ↔ некроз».
// Посібник дає режими (с. 51–52, 58–60), але не кінетику; модель — правдоподібне наближення:
//  • Загибель мікрофлори — закон Чіка — Вотсона: lg(N/N₀) = −k·Cⁿ·t (n = 1 для окисників). Двофазна популяція:
//    частка f мікроорганізмів захищена (рубчик насінини, тріщини, продихи, повітряні бульбашки) і гине в 4 рази повільніше.
//    70 % етанол перед стерилянтом знімає восковий наліт і вбиває вегетативні клітини (−1 lg за хв, не більше −2 lg);
//    без нього змочування гірше (k × 0,55), твін-80 (1 крапля на 100 мл, с. 52) підвищує k у 1,3 раза.
//  • Імовірність контамінації експлантата P_к = 1 − exp(−N) (пуассонівське число живих клітин, що залишились).
//  • Отруєння тканини — логістична «доза — ефект» за правилом Габера: D = Cᵐ·(t + t_зал), P_н = 1/(1 + (D₅₀/D)ʰ), m > n,
//    тож висока концентрація шкодить більше, ніж прискорює стерилізацію. t_зал — недовідмитий стерилянт:
//    t_зал = 30·exp(−r·t_пр/τ) хв (r промивань по t_пр хв; посібник: 4 × 15 хв, для сої 3 × 10 хв).
//  • Коренеплоди й бульби (ЛР 6): занурення в 96 % спирт і обпалювання знищують поверхневу мікрофлору (−3,5 lg за цикл);
//    циліндр, вирізаний свердлом, переносить 10⁻⁴ залишку з поверхні; ендофіти дають λ = 0,03 (морква) / 0,07 (картопля).
//  Ефективність стерилізації (табл. 4, с. 59) = частка неінфікованих і життєздатних (для сої — схожих) експлантатів, %.
import { Plot, sliders, segmented, setOut, fnum, clamp, lerp, TAU, rng, scene, shadow, petri, callus, Runner, onResize, fit, roundRect, MAT } from './kit.js';
import { soySprout, soySeed, bacterialHalo, mycelium, tissueDisc, vial, chip, font, discCallus, spiritLamp } from './t01-draw.js';

export const AGENTS = {
  naclo: { n: 'NaClO (гіпохлорит натрію, «Білизна»)', short: 'NaClO', u: '%', min: 0.25, max: 5, step: 0.25, def: 1, k: 0.32, tox: 1, hint: '«Білизна» 1 : 3 (с. 58) ≈ 1 % (оцінка; залежить від вмісту NaClO у препараті). Посібник: 0,5–5 %' },
  caclo: { n: 'Ca(ClO)₂ (гіпохлорит кальцію)', short: 'Ca(ClO)₂', u: '%', min: 3, max: 12, step: 0.5, def: 9, k: 0.032, tox: 0.075, hint: 'Посібник: 9 % розчин' },
  hgcl2: { n: 'HgCl₂ (сулема) — дуже отруйна', short: 'HgCl₂', u: '%', min: 0.05, max: 0.5, step: 0.05, def: 0.1, k: 4.2, tox: 14, hint: 'Посібник: 0,2–0,5 %. Ртутні препарати потребують окремої утилізації' },
  h2o2: { n: 'H₂O₂ (пероксид водню)', short: 'H₂O₂', u: '%', min: 3, max: 20, step: 1, def: 10, k: 0.026, tox: 0.06, hint: 'Посібник: 5–20 %' },
  agno3: { n: 'AgNO₃ (нітрат срібла)', short: 'AgNO₃', u: '%', min: 0.25, max: 2, step: 0.25, def: 1, k: 0.3, tox: 1.35, hint: 'Посібник: 0,5–2 %' },
};
// Об'єкти: lg0 — мікрофлора на експлантаті, f — захищена частка, D50 (одиниці NaClO·хв), h — крутизна, eth50 — хв у 70 % етанолі до 50 % ушкоджень
export const OBJECTS = {
  soy: { n: 'Насіння сої (ЛР 5)', method: 'chem', lg0: 4.5, f: 0.002, D50: 45, h: 3.5, eth50: 4.5, G0: 0.92, tau: 6, days: 7, rec: { ag: 'naclo', C: 1, t: 17, eth: 1.5, rin: 3, rt: 10 }, unit: 'насінин' },
  leaf: { n: 'Листкові диски тютюну', method: 'chem', lg0: 4.0, f: 0.004, D50: 14, h: 3, eth50: 1.1, G0: 0.95, tau: 4, days: 14, rec: { ag: 'naclo', C: 0.5, t: 8, eth: 0.5, rin: 4, rt: 15 }, unit: 'дисків' },
  carrot: { n: 'Коренеплід моркви (ЛР 6)', method: 'flame', lg0: 5.5, lam: 0.03, days: 28, unit: 'дисків', kind: 'carrot' },
  potato: { n: 'Бульба картоплі (ЛР 6)', method: 'flame', lg0: 5.8, lam: 0.07, days: 28, unit: 'дисків', kind: 'potato' },
};

/** Хімічна стерилізація: імовірності для одного експлантата. */
export function chemModel(o, s) {
  const A = AGENTS[s.ag];
  const ethKill = Math.min(2, s.eth * 1.0);
  const w = (s.eth > 0 ? 1 : 0.55) * (s.tween ? 1.3 : 1);
  const r = A.k * s.C * w;                          // lg/хв
  const lg0 = o.lg0 + s.load - ethKill;
  const N = Math.pow(10, lg0) * ((1 - o.f) * Math.pow(10, -r * s.t) + o.f * Math.pow(10, -0.25 * r * s.t));
  const fungi = 0.3, Nc = N * ((1 - fungi) * (s.claf ? 0.01 : 1) + fungi);
  const pC = 1 - Math.exp(-Nc), pFung = Nc > 0 ? N * fungi / Nc : 0.3;
  const tRes = 30 * Math.exp(-s.rin * s.rt / o.tau);
  const D = A.tox * Math.pow(s.C, 1.3) * (s.t + tRes);
  const pChem = D > 0 ? 1 / (1 + Math.pow(o.D50 / D, o.h)) : 0;
  const pEth = s.eth > 0 ? 1 / (1 + Math.pow(o.eth50 / s.eth, 4)) : 0;
  const pN = 1 - (1 - pChem) * (1 - pEth);
  const pAlive = (1 - pN) * o.G0;                  // схожість / життєздатність
  return { pC, pN, pAlive, eff: (1 - pC) * pAlive, pFung, tRes, lgN: Math.log10(Math.max(1e-12, N)) };
}
/** ЛР 6: спирт 96 % + обпалювання, вирізання циліндрів свердлом. */
export function flameModel(o, s) {
  const lgS = o.lg0 + s.load + (s.wash ? -2 : 0) - 3.5 * s.cycles;
  const N = Math.pow(10, lgS - 4) + o.lam;
  const pC = 1 - Math.exp(-N);
  const pN = clamp((s.trim ? 0.03 : 0.55) + Math.max(0, s.cycles - 3) * 0.08 + (s.thick < 1.2 ? (1.2 - s.thick) * 0.6 : 0) + (s.thick > 2.5 ? (s.thick - 2.5) * 0.08 : 0), 0, 1);
  const pAlive = (1 - pN) * 0.96;
  return { pC, pN, pAlive, eff: (1 - pC) * pAlive, pFung: 0.45, lgN: Math.log10(N) };
}

export function initExplant(root) {
  const $ = (s) => root.querySelector(s);
  const cv = $('canvas'), hud = $('.ag-stage__hud'), verdict = $('.ag-verdict');
  const S = { obj: 'soy', ag: 'naclo', C: 1, t: 17, eth: 1.5, tween: false, rin: 3, rt: 10, claf: false, load: 0, n: 20, wash: true, cycles: 2, trim: true, thick: 1.5 };
  let M = null, day = 0, history = [];
  const objSeg = segmented($('[data-ctl="obj"]'), 'eob', Object.entries(OBJECTS).map(([k, o]) => ({ value: k, label: o.n.replace(/ \(ЛР \d\)/, '') })), S.obj, (v) => { S.obj = v; applyRec(); build(); recalc(); runner.reset(); });
  const agBox = $('[data-ctl="ag"]'), slBox = $('[data-ctl="sl"]'), optBox = $('[data-ctl="opt"]');
  let sl, segAg;
  function applyRec() { const r = OBJECTS[S.obj].rec; if (r) Object.assign(S, { ag: r.ag, C: r.C, t: r.t, eth: r.eth, rin: r.rin, rt: r.rt }); else Object.assign(S, { wash: true, cycles: 2, trim: true, thick: 1.5 }); }
  function build() {
    const o = OBJECTS[S.obj];
    agBox.replaceChildren(); slBox.replaceChildren(); optBox.replaceChildren();
    root.querySelector('[data-grp="ag"]').hidden = o.method !== 'chem';
    if (o.method === 'chem') {
      segAg = segmented(agBox, 'eag', Object.entries(AGENTS).map(([k, a]) => ({ value: k, label: a.short })), S.ag, (v) => { S.ag = v; S.C = AGENTS[v].def; build(); recalc(); });
      const A = AGENTS[S.ag];
      sl = sliders(slBox, [
        { id: 'C', label: `Концентрація ${A.short}`, min: A.min, max: A.max, step: A.step, value: S.C, unit: '%', digits: A.step < 0.1 ? 2 : A.step < 1 ? 2 : 0, hint: A.hint },
        { id: 't', label: 'Час у стерилянті', min: 1, max: 45, step: 1, value: S.t, unit: 'хв' },
        { id: 'eth', label: '70 % етанол перед стерилянтом', min: 0, max: 6, step: 0.25, value: S.eth, unit: 'хв', digits: 2, hint: 'Насіння — 2–3 хв, листки й корені — 0,5–1 хв (с. 51); соя — 1–2 хв (с. 58)' },
        { id: 'rin', label: 'Промивань стерильною водою', min: 0, max: 5, step: 1, value: S.rin, unit: '' },
        { id: 'rt', label: 'Тривалість одного промивання', min: 2, max: 20, step: 1, value: S.rt, unit: 'хв', hint: 'Загальне правило: 4 × 15 хв (с. 52); соя: 3 × 10 хв' },
        { id: 'load', label: 'Зараженість матеріалу', min: -1, max: 2, step: 0.5, value: S.load, format: (v) => (v <= -1 ? 'низька' : v < 0.5 ? 'звичайна' : v < 1.5 ? 'висока' : 'дуже висока'), unit: '' },
      ], (id) => { Object.assign(S, sl.values); recalc(); });
      const tw = document.createElement('label'); tw.className = 't1-check'; tw.innerHTML = `<input type="checkbox" ${S.tween ? 'checked' : ''}> Твін-80 (1 крапля на 100 мл)`; tw.querySelector('input').addEventListener('change', (e) => { S.tween = e.target.checked; recalc(); });
      const cf = document.createElement('label'); cf.className = 't1-check'; cf.innerHTML = `<input type="checkbox" ${S.claf ? 'checked' : ''}> Клафоран 500 мг/л (3 год) + у середовищі з канаміцином`; cf.querySelector('input').addEventListener('change', (e) => { S.claf = e.target.checked; recalc(); });
      optBox.append(tw, cf);
    } else {
      sl = sliders(slBox, [
        { id: 'cycles', label: 'Циклів «96 % спирт → полум\'я»', min: 0, max: 5, step: 1, value: S.cycles, unit: '' },
        { id: 'thick', label: 'Товщина дисків', min: 0.6, max: 4, step: 0.1, value: S.thick, unit: 'мм', digits: 1, hint: 'Посібник: 1,2–1,5 мм (с. 60), для ЛР 7 — 1,5–2 мм' },
        { id: 'load', label: 'Зараженість поверхні', min: -1, max: 2, step: 0.5, value: S.load, format: (v) => (v <= -1 ? 'низька' : v < 0.5 ? 'звичайна' : v < 1.5 ? 'висока' : 'дуже висока'), unit: '' },
      ], () => { Object.assign(S, sl.values); recalc(); });
      const wa = document.createElement('label'); wa.className = 't1-check'; wa.innerHTML = `<input type="checkbox" ${S.wash ? 'checked' : ''}> Мити щіткою з милом, ополоснути, очистити`; wa.querySelector('input').addEventListener('change', (e) => { S.wash = e.target.checked; recalc(); });
      const tr = document.createElement('label'); tr.className = 't1-check'; tr.innerHTML = `<input type="checkbox" ${S.trim ? 'checked' : ''}> Відсікти обпалені краї циліндра`; tr.querySelector('input').addEventListener('change', (e) => { S.trim = e.target.checked; recalc(); });
      optBox.append(wa, tr);
    }
    const nn = sliders(optBox, [{ id: 'n', label: 'Кількість експлантатів', min: 10, max: 40, step: 2, value: S.n, unit: 'шт' }], () => { S.n = nn.values.n; recalc(); });
  }

  const p1 = new Plot($('[data-plot="t"]'), { xLabel: 'Час у стерилянті, хв', yLabel: 'Частка, %', xShort: 't', y: [0, 100], ariaLabel: 'Частки інфікованих, некротизованих і чистих живих експлантатів від часу' });
  const hm = $('[data-plot="hm"]'); const hmc = document.createElement('canvas'); hmc.setAttribute('role', 'img'); hmc.setAttribute('aria-label', 'Карта ефективності стерилізації: концентрація × час'); hm.append(hmc);
  const hmCache = { key: '', img: null };

  function outcomes() {
    // спільні випадкові числа: зміна параметрів змінює результат монотонно
    const R = rng(77), o = OBJECTS[S.obj], out = [];
    for (let i = 0; i < S.n; i++) {
      const u1 = R(), u2 = R(), u3 = R(), u4 = R(), u5 = R(), u6 = R();
      const cont = u1 < M.pC, fung = u3 < M.pFung, dead = u2 > (M.pAlive / (o.G0 || 0.96)) * (o.G0 || 0.96) ? true : false;
      out.push({ cont, fung, dead: u2 >= M.pAlive, onset: (fung ? 2.2 : 1.4) + u4 * 1.8, vig: 0.75 + u5 * 0.5, rot: u6 * TAU, seed: 100 + i });
      void dead;
    }
    return out;
  }

  function recalc() {
    const o = OBJECTS[S.obj];
    M = o.method === 'chem' ? chemModel(o, S) : flameModel(o, S);
    const res = outcomes();
    const nC = res.filter((r) => r.cont).length, nOk = res.filter((r) => !r.cont && !r.dead).length, nAlive = res.filter((r) => !r.dead).length;
    setOut(root, {
      pc: `<span class="${M.pC > 0.2 ? 'is-bad' : ''}">${fnum(M.pC * 100, 0)} %</span>`,
      pn: `<span class="${1 - M.pAlive / (o.G0 || 0.96) > 0.2 ? 'is-bad' : ''}">${fnum((1 - M.pAlive / (o.G0 || 0.96)) * 100, 0)} %</span>`,
      eff: `<span class="${M.eff > 0.7 ? 'is-ok' : M.eff < 0.4 ? 'is-bad' : ''}">${fnum(M.eff * 100, 0)} %</span>`,
      cnt: `${nOk} з ${S.n}`,
      extra: o.method === 'chem' ? `${fnum(M.tRes, M.tRes < 1 ? 2 : 1)} хв` : `10^${fnum(M.lgN, 1)}`,
    });
    $('[data-out-label="extra"]').textContent = o.method === 'chem' ? 'Залишок стерилянту (екв. хв)' : 'Живих клітин на циліндрі';
    // графік 1
    if (o.method === 'chem') {
      const xs = []; for (let t = 0; t <= 45; t += 0.5) xs.push(t);
      const ev = xs.map((t) => chemModel(o, Object.assign({}, S, { t })));
      p1.setOptions({ xLabel: 'Час у стерилянті, хв', x: [0, 45] });
      p1.set([
        { data: xs.map((t, i) => [t, ev[i].pC * 100]), color: '#C2410C', label: 'інфіковані', width: 2.4 },
        { data: xs.map((t, i) => [t, (1 - ev[i].pAlive / o.G0) * 100]), color: '#7C2D12', dash: [6, 4], label: 'некроз / втрата схожості', width: 2.2 },
        { data: xs.map((t, i) => [t, ev[i].eff * 100]), color: '#15803D', label: 'чисті й живі', width: 3, fill: 'rgba(21,128,61,.10)', marker: [S.t, M.eff * 100] },
      ], o.rec ? [{ x: o.rec.t, color: '#8C6A10', label: 'режим посібника' }] : []);
    } else {
      const xs = [0, 1, 2, 3, 4, 5];
      p1.setOptions({ xLabel: 'Циклів «спирт → полум\'я»', x: [0, 5] });
      const ev = xs.map((c) => flameModel(o, Object.assign({}, S, { cycles: c })));
      p1.set([
        { data: xs.map((c, i) => [c, ev[i].pC * 100]), color: '#C2410C', label: 'інфіковані', width: 2.4 },
        { data: xs.map((c, i) => [c, (1 - ev[i].pAlive / 0.96) * 100]), color: '#7C2D12', dash: [6, 4], label: 'некроз', width: 2.2 },
        { data: xs.map((c, i) => [c, ev[i].eff * 100]), color: '#15803D', label: 'чисті й живі', width: 3, fill: 'rgba(21,128,61,.10)', marker: [S.cycles, M.eff * 100] },
      ]);
    }
    drawHeat();
    // вердикт
    let cls = '', msg = '';
    const nec = 1 - M.pAlive / (o.G0 || 0.96);
    if (o.method === 'chem') {
      const A = AGENTS[S.ag];
      if (M.pC > 0.3 && nec < 0.15) { cls = 'is-bad'; msg = `<b>Недостерилізовано:</b> після ${S.t} хв у ${fnum(S.C, 2)} % ${A.short} на експлантаті лишається ≈ 10<sup>${fnum(M.lgN, 1)}</sup> живих клітин — ${fnum(M.pC * 100, 0)} % ${o.unit} інфікуються за 3–4 доби. ${S.eth === 0 ? 'Попереднє занурення в 70 % етанол прибирає восковий наліт і повітряні бульбашки — без нього стерилянт гірше змочує поверхню. ' : ''}Подовжте експозицію або візьміть твін-80.`; }
      else if (nec > 0.3 && M.tRes > 3) { cls = 'is-bad'; msg = `<b>Недостатнє відмивання:</b> ${S.rin} × ${S.rt} хв не видаляють стерилянт із тканини (залишок еквівалентний ще ${fnum(M.tRes, 0)} хв експозиції). «При порушенні такого режиму відбувається отруєння культури» (с. 52): ${fnum(nec * 100, 0)} % ${o.unit} гинуть або не проростають.`; }
      else if (nec > 0.3) { cls = 'is-bad'; msg = `<b>Пересушено стерилянтом:</b> доза ${A.short} надто велика — ${fnum(nec * 100, 0)} % ${o.unit} некротизовані${S.obj === 'soy' ? ' (насіння не проростає)' : ''}. ${S.C > A.def * 1.5 ? 'Знизьте концентрацію: вона шкодить тканині сильніше, ніж прискорює загибель мікробів.' : 'Скоротіть час.'}`; }
      else if (M.pC > 0.15) { cls = 'is-warn'; msg = `<b>Компроміс не досягнуто:</b> ${fnum(M.pC * 100, 0)} % інфікованих. ${S.load >= 1 && !S.claf ? 'Для сильно зараженого матеріалу посібник радить клафоран 500 мг/л (діє на бактерії, але не на гриби).' : 'Трохи подовжте експозицію.'}`; }
      else { msg = `<b>Вдалий режим:</b> ${fnum(M.eff * 100, 0)} % ${o.unit} чисті й життєздатні (очікувано ${Math.round(M.eff * S.n)} з ${S.n}). ${S.ag === 'hgcl2' ? 'Але сулема — отрута 1 класу; її уникають, якщо гіпохлорит дає подібний результат.' : ''}`; }
    } else {
      if (!S.trim) { cls = 'is-bad'; msg = '<b>Обпалені краї не відсічено:</b> зварена й обвуглена тканина на торцях циліндра буріє й гине, токсичні продукти гальмують калюсогенез.'; }
      else if (M.pC > 0.25) { cls = 'is-bad'; msg = `<b>Поверхнева мікрофлора не знищена:</b> ${S.wash ? '' : 'без миття щіткою з милом на шкірці лишається ґрунт зі спорами; '}свердло переносить залишок усередину тканини — ${fnum(M.pC * 100, 0)} % флаконів інфікуються.`; }
      else if (nec > 0.25) { cls = 'is-warn'; msg = `<b>Ушкодження тканини:</b> ${S.thick < 1.2 ? 'надто тонкі диски пересихають і гинуть' : S.cycles > 3 ? 'надмірне обпалювання прогріває тканину вглиб' : 'зріз завеликий'} (${fnum(nec * 100, 0)} % некрозу).`; }
      else { msg = `<b>Правильно за ЛР 6:</b> обпалювання знищує мікрофлору поверхні, а внутрішні тканини коренеплоду чи бульби стерильні. Інфікуються лише ${fnum(M.pC * 100, 0)} % — переважно через ендофітні бактерії (живуть усередині тканин${S.obj === 'potato' ? ', у бульб картоплі їх більше' : ''}).`; }
    }
    verdict.className = 'ag-verdict ' + cls; verdict.innerHTML = msg;
    renderTable();
    draw();
  }

  function drawHeat() {
    const o = OBJECTS[S.obj];
    const box = hm.getBoundingClientRect(); const W = Math.max(260, hm.clientWidth), H = Math.round(Math.min(330, Math.max(220, W / 1.6)));
    const dpr = Math.min(2, devicePixelRatio || 1);
    hmc.width = W * dpr; hmc.height = H * dpr; hmc.style.width = '100%'; hmc.style.height = H + 'px';
    const ctx = hmc.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    void box;
    const m = { l: 50, r: 12, t: 10, b: 42 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    if (o.method !== 'chem') {
      // для ЛР 6: ефективність за товщиною дисків і циклами
      font(ctx, 12, 600); ctx.fillStyle = '#46584C'; ctx.textAlign = 'center';
    }
    const A = AGENTS[S.ag];
    const xs = 60, ys = 40;
    const xMax = o.method === 'chem' ? 45 : 5, yMin = o.method === 'chem' ? A.min : 0.6, yMax = o.method === 'chem' ? A.max : 4;
    const key = `${S.obj}|${S.ag}|${S.eth}|${S.tween}|${S.rin}|${S.rt}|${S.claf}|${S.load}|${S.wash}|${S.trim}|${W}x${H}`;
    if (hmCache.key !== key) {
      const img = ctx.createImageData(Math.round(pw * dpr), Math.round(ph * dpr));
      const cw = img.width, ch = img.height;
      const grid = [];
      for (let j = 0; j < ys; j++) { grid.push([]); for (let i = 0; i < xs; i++) { const x = (i + 0.5) / xs * xMax, y = yMax - (j + 0.5) / ys * (yMax - yMin); grid[j].push((o.method === 'chem' ? chemModel(o, Object.assign({}, S, { t: x, C: y })) : flameModel(o, Object.assign({}, S, { cycles: Math.round(x), thick: y }))).eff); } }
      for (let py = 0; py < ch; py++) for (let px = 0; px < cw; px++) {
        const v = grid[Math.min(ys - 1, Math.floor(py / ch * ys))][Math.min(xs - 1, Math.floor(px / cw * xs))];
        const c = heatCol(v), k = (py * cw + px) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
      hmCache.key = key; hmCache.img = img; hmCache.grid = grid;
    }
    ctx.putImageData(hmCache.img, Math.round(m.l * dpr), Math.round(m.t * dpr));
    // осі
    ctx.strokeStyle = '#46584C'; ctx.lineWidth = 1; ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);
    font(ctx, 11.5, 500); ctx.fillStyle = '#46584C'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xt = o.method === 'chem' ? [0, 10, 20, 30, 40] : [0, 1, 2, 3, 4, 5];
    xt.forEach((v) => { const x = m.l + v / xMax * pw; ctx.fillText(String(v), x, m.t + ph + 5); });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) { const v = yMin + (yMax - yMin) * k / 4; ctx.fillText(fnum(v, v < 1 ? 2 : 1), m.l - 5, m.t + ph - k / 4 * ph); }
    font(ctx, 12, 600); ctx.fillStyle = '#13241A'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(o.method === 'chem' ? 'Час у стерилянті, хв' : 'Циклів «спирт → полум\'я»', m.l + pw / 2, H - 4);
    ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(o.method === 'chem' ? `${A.short}, %` : 'Товщина, мм', 0, 0); ctx.restore();
    // поточна точка
    const cx = m.l + (o.method === 'chem' ? S.t : S.cycles) / xMax * pw, cy = m.t + ph - ((o.method === 'chem' ? S.C : S.thick) - yMin) / (yMax - yMin) * ph;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill(); ctx.stroke();
    if (o.rec) { const rx = m.l + o.rec.t / xMax * pw, ry = m.t + ph - (o.rec.C - yMin) / (yMax - yMin) * ph; if (S.ag === o.rec.ag) { ctx.strokeStyle = '#8C6A10'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(rx, ry, 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } }
  }
  function heatCol(v) { const st = [[0, [125, 40, 30]], [0.4, [214, 120, 60]], [0.65, [236, 214, 120]], [0.82, [140, 196, 110]], [1, [30, 120, 70]]]; for (let i = 1; i < st.length; i++) if (v <= st[i][0]) { const a = st[i - 1], b = st[i], t = (v - a[0]) / (b[0] - a[0]); return [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)]; } return st[4][1]; }

  function renderTable() {
    const o = OBJECTS[S.obj], tb = $('[data-table="t4"]');
    const rows = history.filter((r) => r.obj === S.obj);
    const head = o.method === 'chem' ? '<tr><th>Об\'єкт</th><th>Стерилянт, %</th><th class="num">Час, хв</th><th class="num">Усього</th><th class="num">Інфіковано, шт / %</th><th class="num">' + (S.obj === 'soy' ? 'Схожість' : 'Живі') + ', шт / %</th><th class="num">Ефективність, %</th></tr>'
      : '<tr><th>Об\'єкт</th><th>Обробка</th><th class="num">Товщина, мм</th><th class="num">Усього</th><th class="num">Інфіковано, шт / %</th><th class="num">Живі, шт / %</th><th class="num">Ефективність, %</th></tr>';
    tb.innerHTML = `<thead>${head}</thead><tbody>${rows.length ? rows.map((r) => `<tr><td>${r.name}</td><td>${r.reg}</td><td class="num">${r.time}</td><td class="num">${r.n}</td><td class="num">${r.inf} / ${fnum(r.inf / r.n * 100, 0)}</td><td class="num">${r.alive} / ${fnum(r.alive / r.n * 100, 0)}</td><td class="num"><b>${fnum(r.ok / r.n * 100, 0)}</b></td></tr>`).join('') : '<tr><td colspan="7"><small>Запустіть дослід — результат запишеться сюди, як у табл. 4 посібника (с. 59). Змініть режим і порівняйте варіанти.</small></td></tr>'}</tbody>`;
  }

  /* ---------- сцена: чашки Петрі або пеніцилінові флакони, тиждень інкубації ---------- */
  function draw() {
    if (!M) return;
    const o = OBJECTS[S.obj];
    const mob = cv.parentElement.clientWidth < 480;
    const { ctx, w, h } = fit(cv, { aspect: mob ? 0.78 : 1.35, min: 360, max: 520 });
    const res = outcomes();
    const t = performance.now() / 1000;
    if (o.method === 'chem') drawDishes(ctx, w, h, res, mob, o, t);
    else drawVials(ctx, w, h, res, mob, o, t);
    const names = runner.started ? `Доба ${fnum(day, 1)} з ${o.days}` : 'День 0: експлантати висаджено';
    hud.innerHTML = `<span>${names}</span><span>${o.method === 'chem' ? (S.obj === 'soy' ? 'термостат +23–25 °C, темрява' : 'світлова кімната +25 °C') : 'термостат +25–26 °C, темрява'}</span>`;
  }

  function drawDishes(ctx, w, h, res, mob, o, t) {
    const hy = scene(ctx, w, h, { kind: 'hood', horizon: mob ? 0.17 : 0.14 });
    const per = S.obj === 'soy' ? 5 : 6, nd = Math.ceil(S.n / per);
    let cols = 1, r = 0;
    for (let c = 1; c <= nd; c++) { const rr = Math.min(w / c * 0.46, ((h - hy - 14) / Math.ceil(nd / c) - 34) / 1.1); if (rr > r) { r = rr; cols = c; } }
    const rows = Math.ceil(nd / cols), cw = w / cols, rh = (h - hy - 14) / rows;
    let k = 0;
    for (let d = 0; d < nd; d++) {
      const ci = d % cols, ri = Math.floor(d / cols);
      const nIn = Math.min(cols, nd - ri * cols), cx = (w - nIn * cw) / 2 + cw * (ci + 0.5), cy = hy + 8 + rh * ri + (rh - 34) * 0.48;
      const items = res.slice(d * per, d * per + per);
      petri(ctx, cx, cy, r, { tilt: 0.42, medium: { color: S.obj === 'soy' ? '#E9E3C3' : '#E6E1BE' }, lid: true, contents: (c, p) => {
        items.forEach((e, j) => {
          const a = j / items.length * TAU + 0.4, dd = items.length > 1 ? 0.52 : 0;
          const x = p.cx + Math.cos(a) * p.rx * dd, y = p.cy + Math.sin(a) * p.ry * dd;
          const rs = p.rx * (S.obj === 'soy' ? 0.13 : 0.16);
          const grow = e.cont ? clamp((day - e.onset) / 3.5, 0, 1) : 0;
          if (e.cont && grow > 0 && !e.fung) bacterialHalo(c, x, y, rs * (1.2 + grow * 1.6), { seed: e.seed, tilt: 0.42 / 0.42 * 0.6 });
          if (S.obj === 'soy') {
            const stage = e.dead ? 0 : clamp((day - 0.8) / 5.5, 0, 1) * e.vig * (e.cont ? 1 - grow * 0.8 : 1);
            if (e.dead) soySeed(c, x, y, rs, { rot: e.rot, seed: e.seed, brown: clamp(day / 3, 0, 0.8) });
            else soySprout(c, x, y, rs, stage, { rot: e.rot, seed: e.seed });
          } else {
            leafDisc(c, x, y, rs, { dead: e.dead, day, seed: e.seed, cont: e.cont && grow > 0.3 });
          }
          if (e.cont && grow > 0 && e.fung) mycelium(c, x, y, rs * (1.1 + grow * 2.2), { seed: e.seed, spore: clamp(grow * 1.4 - 0.4, 0, 1), tilt: 0.6, hue: e.seed % 3 ? 'green' : 'black' });
          k++;
        });
      } });
      chip(ctx, cx, cy + r * 0.62 + 24, `чашка ${d + 1}`, { size: 10.5 });
    }
    // підсумок на полотні
    if (runner.started && day >= 3) {
      const inf = res.filter((e) => e.cont && day > e.onset + 0.6).length;
      chip(ctx, w - 10, 26, `видно інфекцію: ${inf} з ${S.n}`, { size: 12, align: 'right', color: inf ? '#9A3412' : '#166534' });
    }
  }

  function leafDisc(c, x, y, r, { dead, day, seed, cont }) {
    const R = rng(seed), k = clamp(day / 10, 0, 1);
    const col = dead ? [mix3(120, 160, 70, 110, 80, 40, k)] : null;
    c.save(); shadow(c, x + 1, y + 2, r * 1.05, r * 0.35, 0.25);
    const base = dead ? [lerp(110, 120, k), lerp(160, 85, k), lerp(70, 40, k)] : [lerp(80, 95, k), lerp(150, 165, k), lerp(60, 70, k)];
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.2, 1, x, y, r);
    g.addColorStop(0, `rgb(${base.map((v) => Math.min(255, v + 40) | 0)})`); g.addColorStop(1, `rgb(${base.map((v) => v * 0.75 | 0)})`);
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - r * 0.8, y); c.lineTo(x + r * 0.8, y); c.stroke();
    if (!dead && day > 6) discCallus(c, x, y, r, clamp((day - 6) / 8, 0, 1) * 0.6, { tilt: 0.6, seed, rim: true });
    c.restore(); void col; void R; void cont;
  }
  function mix3(a, b, c2, d, e, f, k) { return [lerp(a, d, k), lerp(b, e, k), lerp(c2, f, k)]; }

  function drawVials(ctx, w, h, res, mob, o, t) {
    const hy = scene(ctx, w, h, { kind: 'hood', horizon: mob ? 0.17 : 0.14 });
    const cols = mob ? 5 : Math.min(10, Math.ceil(S.n / 2)), rows = Math.ceil(S.n / cols);
    const left = mob ? 8 : w * 0.2, cw = (w - left - 8) / cols, rh = (h - hy - 10) / rows;
    const vw = Math.min(cw * 0.72, rh * 0.5), vh = Math.min(rh * 0.82, vw * 1.6);
    if (!mob) { // спиртівка й коренеплід — що робили перед висаджуванням
      spiritLamp(ctx, w * 0.1, hy + (h - hy) * 0.62, Math.min(w * 0.08, 80), { t, lit: true });
      tissueDisc(ctx, w * 0.1, hy + (h - hy) * 0.84, Math.min(w * 0.05, 40), { kind: o.kind, tilt: 0.45, thick: 6, seed: 4 });
      chip(ctx, w * 0.1, hy + (h - hy) * 0.84 + 34, `диск ${fnum(S.thick, 1)} мм`, { size: 10.5 });
    }
    res.forEach((e, i) => {
      const ci = i % cols, ri = Math.floor(i / cols);
      const x = left + cw * ci + (cw - vw) / 2, by = hy + rh * (ri + 1) - rh * 0.08;
      const grow = e.cont ? clamp((day - e.onset * 1.2) / 4, 0, 1) : 0;
      vial(ctx, x, by, vw, vh, { cloudy: e.cont && !e.fung ? grow * 0.6 : 0, contents: (c, v) => {
        const r = v.w * 0.32, dy = v.surf + 1;
        const brown = e.dead ? clamp(day / 6, 0.2, 0.85) : 0;
        tissueDisc(c, v.cx, dy, r, { kind: o.kind, tilt: 0.42, thick: clamp(S.thick * 1.6, 1.5, 5), seed: e.seed, brown });
        if (!e.dead && !e.cont) discCallus(c, v.cx, dy, r, clamp((day - 9) / 16, 0, 1) * e.vig, { tilt: 0.42, seed: e.seed });
        if (e.cont && grow > 0 && !e.fung) bacterialHalo(c, v.cx, dy + 1, r * (1.05 + grow * 0.5), { seed: e.seed, tilt: 0.4, color: '#E5D9A8' });
        if (e.cont && grow > 0 && e.fung) mycelium(c, v.cx, dy - r * 0.2, r * (0.8 + grow * 1.6), { seed: e.seed, spore: clamp(grow * 1.3 - 0.3, 0, 1), tilt: 0.75 });
      } });
    });
    if (runner.started && day >= 4) {
      const inf = res.filter((e) => e.cont && day > e.onset * 1.2 + 0.8).length;
      chip(ctx, w - 10, 26, `інфіковано: ${inf} з ${S.n}`, { size: 12, align: 'right', color: inf ? '#9A3412' : '#166534' });
    }
  }

  const runner = new Runner({
    btn: $('.ag-run'), reset: $('[data-act="reset"]'),
    step: (dt, tt, reset) => {
      if (reset) { day = 0; recalc(); return; }
      const o = OBJECTS[S.obj];
      day += dt * o.days / 9;
      if (day >= o.days) {
        day = o.days;
        // запис у табл. 4
        const res = outcomes();
        const inf = res.filter((r) => r.cont).length, alive = res.filter((r) => !r.dead).length, ok = res.filter((r) => !r.cont && !r.dead).length;
        const A = AGENTS[S.ag];
        history.push({ obj: S.obj, name: o.n.replace(/ \(ЛР \d\)/, ''), reg: o.method === 'chem' ? `${A.short} ${fnum(S.C, S.C < 1 ? 2 : 1)}${S.eth ? `; EtOH ${fnum(S.eth, 1)} хв` : ''}; ${S.rin}×${S.rt} хв` : `${S.cycles} цикл.${S.wash ? ', миття' : ''}${S.trim ? '' : ', без обрізання'}`, time: o.method === 'chem' ? S.t : fnum(S.thick, 1), n: S.n, inf, alive, ok });
        if (history.length > 24) history.shift();
        renderTable(); runner.finish(); return;
      }
      draw();
    },
    draw: () => draw(),
  });
  applyRec(); build();
  onResize(cv.parentElement, () => { hmCache.key = ''; recalc(); });
  recalc();
  void objSeg;
}
