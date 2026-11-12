// Тема 13 — математика кріозбереження (чисті функції, без DOM).
// Посібник, с. 191–197: небезпечна зона — від температури захисного розчину до −40 °C (інколи −70 °C);
// швидке охолодження (20 °C/хв) → внутрішньоклітинний лід; повільне (у парах азоту, програмні заморожувачі) →
// позаклітинний лід, градієнт водного потенціалу, зневоднення, денатурація білків, токсичні концентрації йонів;
// програмне заморожування з ініціацією кристалізації: 0,25–1,0 °C/хв до −40 °C, потім 9–10 °C/хв до ≈ −60 °C
// і занурення в рідкий азот (−196 °C); кріопротектори: ДМСО 5–10 %, гліцерин 10–20 %, непроникні — сахароза,
// трегалоза, ПЕГ, ПВП, декстран; дрібні клітини з малою вакуолею витримують краще.
// Модель (наближення за Мазуром, 1963–1970): вода виходить із клітини пропорційно осмотичній нерівновазі,
// проникність — за Арреніусом; позаклітинна рідина над льодом має осмоляльність Π = −T/1,86 (кріоскопічна стала
// води 1,86 °C·кг/моль); переохолодження цитоплазми ΔS = 1,86·(Π_непр − M₀/W); ризик внутрішньоклітинного льоду
// зростає експоненційно з ΔS і зникає, коли концентрована цитоплазма склується (Tg); «ефекти розчину» —
// інтеграл перевищення концентрації солей у часі. Коефіцієнти підібрано так, щоб відтворити класичну криву
// «виживання — швидкість охолодження» з оптимумом 0,3–3 °C/хв для рослинних клітин.

export const KF = 1.86;          // °C·кг/осмоль
export const M0 = 0.3;           // осмоль/кг — середовище й клітинний сік (ізотонія)
export const CPA = {
  none:   { name: 'без кріопротектора', perm: 0,    np: 0,    tox: 0 },
  dmso5:  { name: 'ДМСО 5 %',           perm: 0.70, np: 0,    tox: 0.02 },
  dmso10: { name: 'ДМСО 10 %',          perm: 1.45, np: 0,    tox: 0.05 },
  gly10:  { name: 'гліцерин 10 %',      perm: 1.20, np: 0,    tox: 0.03 },
  gly20:  { name: 'гліцерин 20 %',      perm: 2.50, np: 0,    tox: 0.14 },
  suc:    { name: 'сахароза 0,3 М',     perm: 0,    np: 0.33, tox: 0.03 },
  mix:    { name: 'ДМСО 5 % + сахароза 0,3 М', perm: 0.70, np: 0.33, tox: 0.05 },
};
export const CELLS = {
  small: { name: 'дрібні, слабковакуолізовані', k0: 0.42, vac: 0.35 },
  large: { name: 'великі, з центральною вакуолею', k0: 0.14, vac: 0.8 },
};
const EA = 55000, RG = 8.314;
const kT = (k0, T) => k0 * Math.exp(-EA / RG * (1 / (T + 273.15) - 1 / 273.15));

/** Програма охолодження: повертає функцію T(t) і кінцевий час. mode: 'two' | 'direct' */
export function program(mode, rate) {
  const seg = [];
  if (mode === 'direct') seg.push({ from: 2, to: -196, r: 180 });
  else { seg.push({ from: 2, to: -40, r: rate }); seg.push({ from: -40, to: -60, r: 10 }); seg.push({ from: -60, to: -196, r: 180 }); }
  let t = 0; for (const s of seg) { s.t0 = t; s.dt = (s.from - s.to) / s.r; t += s.dt; }
  const T = (tt) => { for (const s of seg) if (tt <= s.t0 + s.dt) return s.from - s.r * (tt - s.t0); return -196; };
  return { T, tEnd: t, seg };
}

/**
 * Симуляція однієї клітини. p = {mode, rate, cpa, cell, seed}
 * Повертає траєкторію [{t, T, W, Weq, dS, ice}] і підсумки: P_iif, dSol, surv.
 */
export function simulate(p, { trace = true } = {}) {
  const c = CPA[p.cpa] || CPA.none, cell = CELLS[p.cell] || CELLS.small;
  const pr = program(p.mode, p.rate);
  const tot0 = M0 + c.perm + c.np, Tm = -KF * tot0;           // температура плавлення захисного розчину
  const Tnuc = p.seed ? Tm - 1 : Math.min(Tm - 1, -9);        // ініціація кристалізації або спонтанна нуклеація
  const Min = M0 + c.perm;                                      // осмолі всередині клітини (протектор проник ДО заморожування; на холоді вже не рухається)
  let W = Min / tot0;                                           // попереднє зневоднення непроникним протектором
  const W0 = W;
  let t = 0, ice = false, surviveIIF = 1, dSol = 0, Tice = null, tIce = 0;
  const out = [];
  const nStep = 2400, dt0 = pr.tEnd / nStep;
  for (let i = 0; i <= nStep; i++) {
    const T = pr.T(t);
    if (!ice && T <= Tnuc) { ice = true; Tice = T; tIce = t; }
    const Pi = ice ? Math.max(tot0, -T / KF) : tot0;           // осмоляльність позаклітинної рідини
    const piSalt = Pi * M0 / tot0;
    const Weq = Math.max(0.04, Min / Pi);
    const piIn = Min / W;
    const Tg = -135 + 100 * (1 - Math.exp(-piIn / 3.5));       // склування концентрованої цитоплазми
    const mob = 1 / (1 + Math.exp((Tg - T) / 2.5));
    const dS = ice ? KF * (Pi - piIn) : Math.max(0, Tm - T);
    // потік води
    if (ice) { const dW = -kT(cell.k0, T) * mob * (Pi - piIn) * dt0; W = Math.max(0.04, W + dW); }
    // внутрішньоклітинний лід: ризик за хв ∝ W·exp((ΔS − θ)/σ)
    const theta = 6.5 + 2.4 * c.perm, haz = 2.2 * Math.max(0, W - 0.07) / 0.3 * cell.vac / 0.35 * Math.exp(Math.min(12, (dS - theta) / 1.3)) * (T < Tg - 4 ? 0 : mob * mob);
    surviveIIF *= Math.exp(-Math.min(50, haz * dt0));
    // «ефекти розчину»: перевищення концентрації солей понад 1,1 осмоль/кг, сповільнюється на холоді
    if (ice && T > -70) dSol += Math.max(0, piSalt - 1.1) * Math.exp(0.055 * (T + 10)) * mob * dt0 * 0.011 * (0.6 + cell.vac);
    if (trace && i % 8 === 0) out.push({ t, T, W, Weq, dS, ice, piSalt, p: surviveIIF });
    t += dt0;
  }
  const pSol = Math.exp(-dSol);
  const surv = surviveIIF * pSol * (1 - c.tox);
  return { trace: out, tEnd: pr.tEnd, seg: pr.seg, Tm, Tnuc, Tice, tIce, W0, pIIF: 1 - surviveIIF, pSol, tox: c.tox, surv };
}

/** Крива «виживання — швидкість охолодження» (лог-шкала 0,05…100 °C/хв). */
export function rateCurve(p, n = 36) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const lg = -1.3 + 3.3 * i / n, r = Math.pow(10, lg); pts.push([lg, 100 * simulate({ ...p, mode: 'two', rate: r }, { trace: false }).surv]); }
  return pts;
}
