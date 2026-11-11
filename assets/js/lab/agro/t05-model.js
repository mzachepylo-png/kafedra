// Тема 5. Суспензійна культура клітин — розрахункове ядро (без DOM, можна перевіряти в Node).
// Посилання на сторінки: Мельничук М. Д., Кляченко О. Л. «Біотехнологія в агросфері» (НУБіП, 2014).

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Види з ЛР 18 (с. 87–88). td — час подвоєння, доби (посібник: «від однієї до трьох діб», с. 85);
 *  friable — пухкість калюсу (0…1), lag — тривалість лаг-фази, доби (наближення). */
export const SPECIES = {
  ginseng: { name: 'Женьшень', lat: 'Panax ginseng', auth: 'C. A. Mey.', td: 2.6, lag: 2.6, friable: 0.55, tint: '#EFE3BF' },
  carrot: { name: 'Морква', lat: 'Daucus carota', auth: 'L.', td: 1.6, lag: 1.6, friable: 0.85, tint: '#F2D9A8' },
  topinambur: { name: 'Топінамбур', lat: 'Helianthus tuberosus', auth: 'L.', td: 1.8, lag: 1.8, friable: 0.72, tint: '#EEE5C6' },
  carnation: { name: 'Гвоздика', lat: 'Dianthus caryophyllus', auth: 'L.', td: 2.1, lag: 2.0, friable: 0.62, tint: '#E2E5C2' },
  tomato: { name: 'Томати', lat: 'Solanum lycopersicum', auth: 'L.', td: 1.9, lag: 2.0, friable: 0.66, tint: '#EAE3B8' },
};

/* Калібрування за посібником:
 * – 2–3 г калюсу на 100 мл середовища (с. 85, 88) і стартова щільність 5·10⁴ кл/мл (с. 86) ⇒ 2·10⁶ клітин на 1 г калюсу,
 *   що переходять у суспензію (2,5 г · 2·10⁶ / 100 мл = 5·10⁴ кл/мл);
 * – максимальна щільність 5·10⁶ кл/мл (с. 86) при 20 г/л сахарози в середовищі (с. 88) ⇒ витрата 4·10⁻⁹ г сахарози на клітину;
 * – суха маса клітини 2·10⁻⁹ г (економічний коефіцієнт ≈ 0,5 г сухої маси на 1 г сахарози; наближення), вода ≈ 95 % сирої маси;
 * – об'єм клітини ≈ 3,5·10⁻⁸ мл (сфера Ø ≈ 40 мкм), упаковка осаду 0,6 — для об'єму осаджених клітин (ЛР 19, с. 89). */
export const CAL = { cellsPerG: 2e6, S0: 20, q: 4e-9, dryCell: 2e-9, water: 0.95, vCell: 3.5e-8, pack: 0.6, Rlin: 7e5 };

/** Чинник аерації від швидкості обертання шейкера (посібник: 100–120 об/хв, с. 85; 130–150 об/хв, с. 88). */
export function aeration(rpm) { return clamp(Math.pow(Math.max(0, rpm - 40) / 80, 1.2), 0.12, 1.25); }
/** Пошкодження клітин зсувом при надто швидкому струшуванні, доба⁻¹ (наближення). */
export function shear(rpm) { return 0.05 * Math.pow(Math.max(0, rpm - 155) / 25, 2); }

/**
 * Періодична (накопичувальна) культура в колбі: модель «лаг → експонента → лінійна (обмеження аерацією) →
 * стаціонарна (вичерпано сахарозу) → відмирання» (фази — с. 87).
 *   r = softmin(μ·a(t)·V, Rлін(rpm)) · S/(S + Ks)  — приріст живих клітин, кл/(мл·добу)
 *   dV/dt = r − kd·V;  dD/dt = kd·V − kл·D;  dS/dt = −q·r·1000
 * μ = ln2 / td; a(t) = 1 − exp(−(t/L)³) — вихід із лагу; kd зростає після вичерпання сахарози.
 */
export function simulate({ sp = 'carrot', rpm = 120, inoc = 2.5, friable = 1, days = 30, dt = 0.02 } = {}) {
  const S = SPECIES[sp] || SPECIES.carrot;
  const X0 = inoc * CAL.cellsPerG / 100;                       // кл/мл
  const mu = Math.LN2 / S.td;
  const L = S.lag * (1 + 0.55 * Math.max(0, Math.log10(5e4 / X0)));   // менший інокулят — довший лаг
  const Rl = CAL.Rlin * aeration(rpm);
  const Ks = 0.4, kShear = shear(rpm);
  let V = X0 * 0.96, D = X0 * 0.04, Sg = CAL.S0, starve = 0;
  const out = [];
  const n = Math.round(days / dt);
  let prevX = V + D;
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    const a = 1 - Math.exp(-Math.pow(t / L, 3));
    const ex = Math.max(1e-9, mu * a * V), p = 4;
    const lim = Math.pow(Math.pow(ex, -p) + Math.pow(Rl, -p), -1 / p);
    const sub = Sg / (Sg + Ks);
    const r = lim * sub;
    if (Sg < 1) starve += dt; else starve = Math.max(0, starve - dt);
    const kd = 0.008 + kShear + 0.16 * smooth(1, 4, starve);
    const X = V + D;
    const rec = { t, X, V, D, S: Sg, viab: V / X, r, mu: i ? Math.log(X / prevX) / dt : 0, limExp: ex < Rl, a };
    rec.dw = (V + 0.6 * D) * CAL.dryCell * 1000;               // г/л
    rec.fw = rec.dw / (1 - CAL.water);                           // г/л
    rec.pcv = clamp(X * CAL.vCell / CAL.pack * 100, 0, 95);      // %
    out.push(rec);
    prevX = X;
    V += (r - kd * V) * dt;
    D += (kd * V - 0.06 * D) * dt;
    Sg = Math.max(0, Sg - CAL.q * r * 1000 * dt);
  }
  // класифікація фаз
  const muMax = mu;
  let tSub = null;
  for (const o of out) {
    if (o.mu < -0.01) o.phase = 'death';
    else if (o.S < 1.2 && o.mu < 0.06) o.phase = 'stat';
    else if (o.a < 0.5 && o.mu < 0.5 * muMax) o.phase = 'lag';
    else if (o.limExp && o.S > 2) o.phase = 'exp';
    else o.phase = o.S > 1.2 ? 'lin' : 'stat';
    if (tSub === null && o.S < CAL.S0 * 0.15) tSub = o.t;   // кінець активного росту — час пересіву
  }
  return { out, X0, L, mu, Rl, td: S.td, tSub, sp: S };
}

export const PHASES = {
  lag: { name: 'лаг-фаза', color: '#9AA79E' },
  exp: { name: 'експоненційна', color: '#2E8B57' },
  lin: { name: 'лінійна', color: '#C59A1B' },
  stat: { name: 'стаціонарна', color: '#5B7FA8' },
  death: { name: 'відмирання', color: '#B5523B' },
};

export function at(sim, t) {
  const o = sim.out, dt = o[1].t - o[0].t;
  const i = clamp(Math.round(t / dt), 0, o.length - 1);
  return o[i];
}

/* ---------- Агрегація (с. 86–87) ---------- */
/** Класи агрегованості за посібником (частки об'єктів у полі зору): одиночні / дрібні агрегати (≤ 10–12 кл.) / великі (> 12 кл.). */
export const AGG_CLASSES = [
  { id: 'fine', name: 'дрібноагрегована', f: [40, 60, 0] },
  { id: 'mid', name: 'середньоагрегована', f: [40, 40, 20] },
  { id: 'coarse', name: 'крупноагрегована', f: [0, 40, 60] },
];
/** Індекс агрегованості a∈[0;1] (0 — дрібна, 0,5 — середня, 1 — крупна): пухкість калюсу, перемішування, вік культури. */
export function aggIndex({ sp = 'carrot', rpm = 120, friable = 1, t = 10 }) {
  const f = (SPECIES[sp] || SPECIES.carrot).friable * (friable ? 1 : 0.45);
  const a = 0.86 - 0.72 * f + 0.42 * (1 - smooth(70, 125, rpm)) - 0.08 * smooth(130, 170, rpm) + 0.16 * smooth(12, 26, t);
  return clamp(a, 0, 1);
}
export function aggFractions(a) {
  const [A, B, C] = AGG_CLASSES.map((c) => c.f);
  const m = (P, Q, k) => P.map((v, i) => lerp(v, Q[i], k));
  return a <= 0.5 ? m(A, B, a / 0.5) : m(B, C, (a - 0.5) / 0.5);
}
export function aggClass(fr) {
  let best = null, bd = Infinity;
  for (const c of AGG_CLASSES) { const d = c.f.reduce((s, v, i) => s + (v - fr[i]) ** 2, 0); if (d < bd) { bd = d; best = c; } }
  return best;
}

/* ---------- Камера Фукса — Розенталя (ЛР 20, с. 90–91) ---------- */
/** 16 великих квадратів по 1 мм², глибина 0,2 мм ⇒ об'єм камери 3,2 мм³; один великий квадрат — 0,2 мм³ = 2·10⁻⁴ мл. */
export const FR = { squares: 16, side: 1, depth: 0.2, vol: 3.2 };
/** X = M · N · 1000 / 3,2, де M — середнє число клітин у камері (на всі 16 квадратів), N — розведення (с. 91). */
export function densityFromCount(meanPerSquare, N) { const M = meanPerSquare * FR.squares; return { M, X: (M * N * 1000) / FR.vol }; }
/** Очікуване число клітин в одному великому квадраті. */
export function lambdaPerSquare(X, N) { return (X / N) * FR.side * FR.side * FR.depth / 1000; }

/* ---------- Висів на агар (ЛР 22, с. 92) ---------- */
/** Ефективність висіву (частка клітин, що дали колонії): насичення Гілла за поверхневою щільністю (умовне
 *  «кондиціювання» середовища сусідніми клітинами); експоненційна фаза — краща (с. 92). Наближення. */
export const PLATE = { area: 63.6, vol: 0.5, Xc: 20, h: 1.6, peExp: 0.32, peStat: 0.2 };
export function plating({ X = 1e6, dil = 100, phase = 'exp', single = 0.4, viab = 0.9 }) {
  const cells = X * PLATE.vol / dil;                 // клітин у 0,5 мл після розведення
  const dens = cells / PLATE.area;                    // кл/см²
  const pe0 = phase === 'exp' ? PLATE.peExp : PLATE.peStat;
  const pe = pe0 * viab * Math.pow(dens, PLATE.h) / (Math.pow(PLATE.Xc, PLATE.h) + Math.pow(dens, PLATE.h));
  // одиночні клітини дають клони; агрегати — неклональні колонії (виживають краще)
  const avgAgg = 6;                                  // середня кількість клітин в агрегаті
  const units = cells * single / 100 + cells * (1 - single / 100) / avgAgg;
  const singlesU = cells * single / 100;
  const aggU = units - singlesU;
  const colSingle = singlesU * pe, colAgg = aggU * Math.min(0.9, pe * 2.2);
  const colonies = colSingle + colAgg;
  const perCm2 = colonies / PLATE.area;
  const spacing = perCm2 > 0 ? 10 / Math.sqrt(perCm2) : Infinity;   // мм
  return { cells, dens, pe, colonies, colSingle, colAgg, clonal: colonies ? colSingle / colonies : 0, perCm2, spacing };
}
/** Діаметр колонії (мм) на добу t: перший поділ 3–6 доби, видимі мікрокалюси за 2–3 тижні (наближення). */
export function colonyDiam(t, t0 = 4, k = 1) { return Math.max(0, 2.2 * k / (1 + Math.exp(-(t - t0 - 12) / 3.2)) - 2.2 * k / (1 + Math.exp((t0 + 12) / 3.2)) * 0); }
