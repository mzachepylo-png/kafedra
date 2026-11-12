// Тема 7. Культура ізольованих протопластів — розрахункове ядро (без DOM).
// Сторінки: Мельничук М. Д., Кляченко О. Л. «Біотехнологія в агросфері» (НУБіП, 2014), с. 97–105.

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ================= ЛР 24. Механічне виділення: плазмоліз (с. 100–101) ================= */
export const RGAS = 0.008314;                 // л·МПа/(моль·К)
/** Осмотичний потенціал розчину неелектроліту за Вант-Гоффом: Ψs = −i·C·R·T (i = 1 для сахарози). */
export const psiS = (C, T = 22, i = 1) => -i * C * RGAS * (T + 273.15);
/** Ряд концентрацій сахарози з посібника (с. 101), М. */
export const SERIES = [0.3, 0.35, 0.4, 0.5, 0.55, 0.6, 0.7];
/** Об'єкти ЛР 24. Cip — концентрація сахарози граничного плазмолізу (ізотонічна тканині), М: типові
 *  довідкові значення для навчання, у посібнику не наведені. */
export const OBJ = {
  onion: { name: 'Цибуля, епідерміс луски', lat: 'Allium cepa', auth: 'L.', Cip: 0.42, hue: [150, 38, 120], aspect: 3.4 },
  tradescantia: { name: 'Традесканція, епідерміс', lat: 'Tradescantia', auth: '', Cip: 0.36, hue: [118, 52, 150], aspect: 1.7 },
  begonia: { name: 'Бегонія, листок', lat: 'Begonia', auth: '', Cip: 0.31, hue: [176, 46, 70], aspect: 1.3 },
};
const B_NONOSM = 0.22;   // неосмотична частка об'єму протопласта (цитоплазма, органели)
/** Рівноважний відносний об'єм протопласта (закон Бойля — Вант-Гоффа): V/V₀ = b + (1 − b)·Cip/C при C > Cip. */
export function volRel(C, Cip) { return C <= Cip ? 1 : B_NONOSM + (1 - B_NONOSM) * Cip / C; }
/** Стан і вихід цілих протопластів для концентрації C. */
export function mech(C, obj = 'onion', tMin = 15) {
  const o = OBJ[obj];
  const Veq = volRel(C, o.Cip);
  const V = Veq + (1 - Veq) * Math.exp(-tMin / 2.5);      // плазмоліз розвивається за кілька хвилин (τ ≈ 2,5 хв)
  const deg = 1 - V;
  const form = C < o.Cip - 0.005 ? 'none' : deg < 0.07 ? 'incipient' : deg < 0.24 ? 'concave' : 'convex';
  // Цілий протопласт виходить, лише коли він відстав від стінки (плазмоліз) і не надто зневоднений.
  const pIntact = C < o.Cip ? 0.02 : 0.9 * smooth(0.02, 0.14, deg) * (1 - 0.85 * smooth(0.3, 0.55, deg));
  return { Veq, V, deg, form, pIntact, n: Math.round(40 * pIntact), psi: psiS(C), psiCell: psiS(o.Cip), d: Math.cbrt(V) };
}
export const FORMS = { none: 'плазмолізу немає (тургор)', incipient: 'кутовий (початковий) плазмоліз', concave: 'увігнутий плазмоліз', convex: 'опуклий плазмоліз' };

/* ================= ЛР 25. Ферментативне виділення (с. 101–102) ================= */
/** Рецептури посібника: листок тютюну — 0,5 % Cellulase, 0,5 % Macerozyme, 0,2 % Driselase, 1 г/7–10 мл, +28–30 °C, 15–18 год;
 *  калюс — 2 % / 1 % / 0,5 %, 2 г/7–10 мл, кімнатна температура, 20–22 год. */
export const RECIPES = {
  leaf: { cel: 0.5, mac: 0.5, dri: 0.2, T: 28, mlPerG: 8.5, h: 16 },
  callus: { cel: 2, mac: 1, dri: 0.5, T: 22, mlPerG: 4.25, h: 21 },
};
/**
 * Наближена кінетика (с. 98: целюлази, геміцелюлази, пектинази):
 *   стінка W(t) = exp(−k·(t − 1,5)), k = k₀·c/(c + 0,6)·2^((T−28)/10)·f(мл/г), c = Cellulase + 0,6·Driselase;
 *   мацерація M(t) = 1 − exp(−kₘ·t), kₘ ∝ пектинази (Macerozyme + 0,5·Driselase);
 *   життєздатність v(t) = exp(−k_d·t), k_d зростає з концентрацією ферментів і температурою;
 *   вихід Y = Y_max·M·(1 − W)·v·S_осм, Y_max = 10⁷ протопластів/г для листка (с. 98: «до 10 млн із 1 г»).
 */
export function enzyme({ mat = 'leaf', cel = 0.5, mac = 0.5, dri = 0.2, T = 28, mlPerG = 8.5, osm = 0.5, t = 16 }) {
  const leaf = mat === 'leaf';
  const k0 = leaf ? 0.42 : 0.27, Ymax = leaf ? 1e7 : 6e6;
  const c = cel + 0.6 * dri, p = mac + 0.5 * dri;
  const ratio = Math.pow(Math.min(1, mlPerG / (leaf ? 7 : 3.5)), 0.7);
  const k = k0 * c / (c + 0.6) * Math.pow(2, (T - 28) / 10) * ratio;
  const km = 0.9 * p / (p + 0.35) * Math.pow(2, (T - 28) / 10);
  const heat = T > 32 ? 1 + Math.pow((T - 32) / 3, 2) : 1;
  const kd = 0.008 * (1 + 0.25 * (cel + mac + 2 * dri)) * Math.pow(2.5, (T - 28) / 10) * heat;
  // осмотичний стабілізатор (маніт): нижче ≈ 0,4 М протопласти лопаються, вище ≈ 0,65 М — зневоднюються
  const sOsm = smooth(0.25, 0.42, osm) * (osm > 0.62 ? Math.exp(-Math.pow((osm - 0.62) / 0.18, 2)) : 1);
  const at = (tt) => {
    const W = tt <= 1.5 ? 1 : Math.exp(-k * (tt - 1.5));
    const M = 1 - Math.exp(-km * tt);
    const v = Math.exp(-kd * tt) * (0.35 + 0.65 * sOsm);
    const rel = M * (1 - W);
    return { t: tt, W, M, v, rel, Y: Ymax * rel * v * sOsm, Ytot: Ymax * rel };
  };
  let best = at(0);
  for (let tt = 0; tt <= 30; tt += 0.1) { const r = at(tt); if (r.Y > best.Y) best = r; }
  return { ...at(t), k, km, kd, sOsm, best, at };
}

/* ================= ЛР 25. Очищення: флотація й осадження (с. 102) ================= */
export const ROTOR_R = 9;                     // см, радіус бакет-ротора міні-центрифуги (наближення)
export const rcf = (rpm, r = ROTOR_R) => 1.118e-5 * r * rpm * rpm;   // відносна відцентрова сила, ×g
/** Густина (г/см³) і в'язкість (мПа·с) розчинів при +25 °C (наближення за довідковими даними). */
export function medium(kind, C) {
  if (kind === 'w5') return { rho: 1.019, mu: 0.95, name: 'W-5' };
  const salts = 0.005;
  if (kind === 'sucrose') return { rho: 0.998 + 0.1295 * C + salts, mu: 0.89 * Math.exp(0.95 * C), name: 'сахароза' };
  return { rho: 0.998 + 0.069 * C + salts, mu: 0.89 * Math.exp(0.5 * C), name: 'маніт' };
}
/** Частинки: інтактний протопласт, клітинні уламки (стінки), вільні хлоропласти. r — радіус, мкм; ρ — г/см³. */
export const PARTS = {
  proto: { name: 'інтактні протопласти', r: 15, rho: 1.045 },
  debris: { name: 'уламки клітин', r: 9, rho: 1.15 },
  chl: { name: 'вільні хлоропласти', r: 2.5, rho: 1.1 },
};
/** Швидкість осадження за Стоксом, мм/с (від'ємна — спливання): v = 2/9·Δρ·g·RCF·r²/μ. */
export function stokes(part, med, RCF) {
  const d = (part.rho - med.rho) * 1000, r = part.r * 1e-6, mu = med.mu * 1e-3;
  return (2 / 9) * d * 9.81 * RCF * r * r / mu * 1000;
}
export const COLUMN = 60;   // мм — висота стовпа рідини в центрифужній пробірці на 15 мл (≈ 10 мл)
/** Частка кожного типу частинок у верхній зоні (3 мм) після центрифугування тривалістю t хв. */
export function separation({ kind = 'sucrose', C = 0.6, rpm = 1000, tMin = 3, step = 'float' }) {
  const med = step === 'float' ? medium(kind, C) : medium('w5');
  const g = rcf(rpm), H = COLUMN, band = 3, s = tMin * 60;
  const res = { med, g };
  for (const [id, p] of Object.entries(PARTS)) {
    const v = stokes(p, med, g);
    const top = v < 0 ? Math.min(1, (-v * s + band) / H) : Math.max(0, (band - v * s) / H);
    const pellet = v > 0 ? Math.min(1, v * s / H) : 0;
    res[id] = { v, top, pellet };
  }
  const dmg = step === 'float' ? 0.5 * smooth(180, 450, g) : 0.6 * smooth(70, 260, g) * smooth(0.5, 4, tMin) + 0.15 * smooth(4, 10, tMin);
  res.damage = dmg;
  if (step === 'float') {
    const P = res.proto.top * (1 - dmg), Dd = res.debris.top * 0.8 + 0.035, Ch = res.chl.top * 1.5 + 0.03;   // частина уламків і хлоропластів захоплюється шаром протопластів
    res.yield = P; res.purity = P / (P + Dd + Ch + 1e-9);
  } else {
    res.yield = res.proto.pellet * (1 - dmg); res.purity = null;
  }
  return res;
}
/** Залишок ферменту після перенесення кільця протопластів (≈ 0,5 мл у 10 мл W-5) і n відмивань (у пробірці лишається ≈ 0,3 мл з 10). */
export const enzymeLeft = (n) => 0.05 * Math.pow(0.03, n);

/* ================= Культивування (с. 99, 102) ================= */
/** Ефективність утворення колоній залежно від густоти посіву (посібник: оптимум 10³ кл/мл, с. 102), світла й температури. Наближення. */
export function culture({ dens = 1e3, T = 27, light = 'diffuse', t = 14 }) {
  const ld = Math.log10(dens);
  const fD = Math.exp(-Math.pow((ld - 3.3) / 1.0, 2));               // оптимум біля 10³ кл/мл
  const fT = Math.exp(-Math.pow((T - 27) / 4.5, 2));                   // посібник: +26–28 °C
  const fL = light === 'diffuse' ? 1 : light === 'dark' ? 0.85 : 0.45; // ≤ 2000 лк
  const PE = 0.32 * fD * fT * fL;
  const wall = 1 - Math.exp(-t / 1.3);                                 // регенерація стінки за 1–3 доби
  const div = PE * 1.6 * smooth(2, 6, t);                              // перший поділ — 2–6 доба
  const colonies = PE * smooth(8, 18, t);                              // колонії — 10–20 доба (с. 102)
  const cells = t < 2.5 ? 1 : Math.min(256, Math.pow(2, (t - 2.5) / 1.6));
  return { PE, wall, div: Math.min(0.95, div), colonies, cells, fD, fT, fL };
}

/* ================= Злиття протопластів ПЕГ (с. 99–100) ================= */
/**
 * Пуассонівське наближення: кожен протопласт має в середньому λ партнерів злиття.
 * Частки протопластів: не злилися e^(−λ); у бінарних продуктах λe^(−λ); у багатоядерних 1 − e^(−λ)(1 + λ).
 * Серед бінарних злиттів суміші A і B у пропорції p : (1 − p) гетерокаріонів 2p(1 − p).
 * λ = λmax·ПЕГ⁴/(28⁴ + ПЕГ⁴)·(Ca²⁺/pH ? 1,5 : 1)·(1 − e^(−t/6)); токсичність ПЕГ понад 30 %. Наближення.
 */
export function fusion({ peg = 30, ca = true, p = 0.5, t = 15 }) {
  const lam = 0.55 * Math.pow(peg, 4) / (Math.pow(28, 4) + Math.pow(peg, 4)) * (ca ? 1.5 : 1) * (1 - Math.exp(-t / 6));
  const e = Math.exp(-lam);
  const un = e, bin = lam * e, multi = Math.max(0, 1 - e * (1 + lam));
  const het = bin * 2 * p * (1 - p), homo = bin - het;
  const viab = Math.exp(-Math.pow(Math.max(0, peg - 30), 2) / 160) * (ca ? 0.94 : 1);
  return { lam, un, bin, multi, het, homo, viab };
}
