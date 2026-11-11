// Тема 11: математика моделей. Кожна формула — з посиланням на сторінку посібника
// Мельничук М. Д., Кляченко О. Л. «Біотехнологія в агросфері» (НУБіП, 2014)
// або чітко позначена як правдоподібне наближення (там, де посібник дає лише якісну картину).

import { clamp } from './kit.js';

/* ======================================================================
   1. Агробактеріальна трансформація: корончасті гали (ЛР 42–44, с. 173–177)
   ====================================================================== */

/**
 * Індукція vir-генів фенольним індуктором (ацетосирингоном), частка 0..1.
 * Посібник (с. 161) описує vir-область якісно: «гени, відповідальні за вирізання,
 * перенесення та інтеграцію Т-ДНК». Кількісна залежність — рівняння Гілла
 * (наближення за літературними даними: напівмаксимум ≈ 55 мкМ, n ≈ 1,6).
 * Базова індукція 0,25 — фенольні сполуки, які виділяє сам поранений експлантат.
 */
export function virInduction(acetoUM) {
  const K = 55, n = 1.6;
  const hill = Math.pow(acetoUM, n) / (Math.pow(K, n) + Math.pow(acetoUM, n));
  // базова індукція 0,35 — фенольні сполуки, які виділяє сам поранений експлантат
  // (саме тому в посібнику гали утворюються й без додавання ацетосирингону)
  return clamp(0.35 + 0.65 * hill, 0, 1);
}

/**
 * Температурний множник перенесення Т-ДНК (0..1): дзвін з оптимумом ≈ 24 °C
 * і різким спадом вище 29 °C (vir-білки термолабільні). Наближення поза посібником.
 */
export function virTemp(T) {
  const bell = Math.exp(-0.5 * Math.pow((T - 24) / 4.2, 2));
  const cut = 1 / (1 + Math.exp((T - 29) / 0.9));
  return clamp(bell * cut, 0, 1);
}

/** Температурний множник росту пухлинної тканини: оптимум +26…27 °C (посібник, с. 174). */
export function tumorTemp(T) {
  return clamp(Math.exp(-0.5 * Math.pow((T - 26.5) / 5.5, 2)), 0, 1);
}

/** Виживання клітин на канаміцині (ЛР 44, с. 177): nptII-трансформанти vs нетрансформовані. */
export function kanSurvival(kan, transgenic) {
  const K = transgenic ? 220 : 22;
  return 1 / (1 + Math.pow(kan / K, 3));
}

/** Пригнічення агробактерії цефалоспорином (клафоран) + карбеніциліном, сумарно мг/л. */
export function agroSuppression(cefo) {
  return 1 / (1 + Math.exp(-(cefo - 180) / 55));
}

export const OBJECTS = {
  carrot: { dmax: 6.0, t50: 11, k: 0.42, label: 'Диски коренеплоду моркви' },   // с. 174–175
  tomato: { dmax: 20.0, t50: 13, k: 0.34, label: 'Стебло асептичного томата' }, // с. 175: пухлини до 2 см
  disc: { dmax: 0, t50: 27, k: 0.30, label: 'Листкові диски картоплі/тютюну' }, // с. 177: пагони на 25–30 добу
};

/**
 * Стан досліду з трансформації на добу day.
 * obj: 'carrot' | 'tomato' | 'disc'; strain: 'wild' | 'disarmed' | 'none'
 */
export function gallState({ obj = 'carrot', strain = 'wild', aceto = 0, T = 26, kan = 50, cefo = 500, day = 0 }) {
  const o = OBJECTS[obj];
  const vir = virInduction(aceto);
  const fT = virTemp(T);
  const grow = tumorTemp(T);
  // частка експлантатів, у клітини яких перенесено Т-ДНК
  const pMax = strain === 'none' ? 0 : strain === 'wild' ? 1 : 0.85;
  // частка експлантатів, на яких відбулася хоча б одна подія перенесення (розподіл Пуассона)
  const transform = clamp(1 - Math.exp(-6 * pMax * vir * fT), 0, 1);
  // онкогени (ipt, iaaM/iaaH) має лише природна (не роззброєна) Т-ДНК: пухлини дає тільки дикий штам
  const onco = strain === 'wild' ? 1 : 0;
  const tau = o.t50 / Math.max(0.3, grow);
  const logistic = 1 / (1 + Math.exp(-o.k * grow * (day - tau)));
  const logistic0 = 1 / (1 + Math.exp(o.k * grow * tau));
  const L = clamp((logistic - logistic0) / (1 - logistic0), 0, 1);

  const gallD = o.dmax * transform * onco * L;            // середній діаметр пухлини, мм
  const coverage = clamp(transform * onco * L, 0, 1);     // частка вкритої галами поверхні
  // доба появи перших пухлин (d ≥ 0,5 мм)
  let firstDay = NaN;
  if (o.dmax > 0 && transform * onco > 0.02) {
    for (let d = 1; d <= 40; d += 0.25) {
      const l = 1 / (1 + Math.exp(-o.k * grow * (d - tau)));
      const ln = clamp((l - logistic0) / (1 - logistic0), 0, 1);
      if (o.dmax * transform * onco * ln >= 0.5) { firstDay = d; break; }
    }
  }
  // листкові диски: селекція на канаміцині (ЛР 44)
  const survTr = kanSurvival(kan, true);
  const survWT = kanSurvival(kan, false);
  const kill = agroSuppression(cefo);
  const shootsTr = clamp(transform * survTr * kill * L, 0, 1);     // трансгенні пагони
  const shootsWT = clamp((1 - transform) * survWT * kill * L, 0, 1); // «втікачі» (нетрансгенні)
  const overgrowth = clamp(1 - kill, 0, 1);                        // заростання агробактерією
  return {
    vir, fT, grow, transform, onco, gallD, coverage, firstDay,
    survTr, survWT, shootsTr, shootsWT, overgrowth,
    purity: shootsTr + shootsWT > 0 ? shootsTr / (shootsTr + shootsWT) : 0,
  };
}

/* ======================================================================
   2. Ампліфікація плазміди та виділення нуклеїнових кислот (ЛР 45–48, с. 177–182)
   ====================================================================== */

export const CELLS_PER_OD = 8e8;      // клітин E. coli в 1 мл при D600 = 1 (довідкове)
export const DA_PER_BP = 650;          // середня маса пари нуклеотидів, Да
export const NA_AVOGADRO = 6.022e23;
export const PBR322_BP = 4361;         // pBR322 (посібник, с. 154, рис.: ApR, TcR, ori)

/** Маса однієї кільцевої молекули ДНК довжиною bp, у грамах. */
export function dnaMass(bp) { return (bp * DA_PER_BP) / NA_AVOGADRO; }

/** Ріст культури E. coli в LB при +37 °C: D600(t), години. Час подвоєння 25 хв, плато 3,5. */
export function od600(t, { D0 = 0.0286, td = 25 / 60, Dmax = 3.5 } = {}) {
  const exp = D0 * Math.pow(2, t / td);
  return (exp * Dmax) / (Dmax + exp - D0);   // логістичне насичення
}

/** Час (год), за який культура з D0 доросте до D. */
export function timeToOD(D, D0 = 0.0286, td = 25 / 60) {
  return td * Math.log2((D * (3.5 - D0)) / (D0 * (3.5 - D)));
}

/**
 * Копійність pBR322 на клітину після внесення хлорамфеніколу (ЛР 46, с. 178–179).
 * Посібник не дає чисел; базова копійність ≈ 20, після 12–16 год ампліфікації ≈ 2000
 * (літературні значення для релаксованих плазмід), кінетика — експоненційне насичення.
 */
export function copyNumber(hours, { cm = true, n0 = 20, nmax = 2000, tau = 4.5 } = {}) {
  if (!cm) return n0;
  return n0 + (nmax - n0) * (1 - Math.exp(-hours / tau));
}

/** Вихід плазмідної ДНК, мкг на 1 мл культури. */
export function plasmidYieldPerMl({ od = 0.4, copies = 2000, bp = PBR322_BP }) {
  const cells = od * CELLS_PER_OD;
  return cells * copies * dnaMass(bp) * 1e6;   // г → мкг
}

/**
 * Кип'ятильний лізис (ЛР 47, с. 179–180: лізоцим + 100 °C, 40 с).
 * Повертає {release, damage}: частку лізованих клітин і частку пошкодженої
 * (деградованої / зруйнованої) ДНК. Наближення: насичення за часом і термодеградація.
 */
export function boilingLysis(sec, { lysozyme = true } = {}) {
  const k = lysozyme ? 18 : 55;                      // без лізоциму стінка руйнується значно повільніше
  const release = 1 - Math.exp(-sec / k);
  const damage = 1 / (1 + Math.exp(-(sec - 75) / 14)); // > 60–90 с: денатурація, розрив ланцюгів
  return { release: clamp(release, 0, 1), damage: clamp(damage, 0, 1) };
}

/** Повнота осадження спиртом: 2 об'єми етанолу, −20 °C (ЛР 45, п. 7, с. 178). */
export function precipitation(minutes, { cold70 = false } = {}) {
  const tau = cold70 ? 7 : 12;
  return clamp(1 - Math.exp(-minutes / tau), 0, 1);
}

/** Залишковий білок відносно маси нуклеїнової кислоти після k депротеїнізацій. */
export function proteinCarryover(k) {
  const p0 = 300;      // у сирому гомогенаті білка приблизно у 300 разів більше, ніж НК
  return p0 * Math.pow(0.03, k);
}

/** Залишковий фенол у препараті, мкг/мл. */
export function phenolCarryover(k, precipMin) {
  if (k <= 0) return 0;
  return 18 * Math.exp(-precipMin / 20);
}

export const SOURCES = {
  plasmid: { label: 'Плазмідна ДНК (E. coli)', unit: 'мл культури' },
  nuclear: { label: 'Ядерна ДНК рослин', yield: 25, callus: 12, unit: 'г тканини' }, // мкг/г листків
  rna: { label: 'Тотальна РНК рослин', yield: 80, callus: 45, unit: 'г тканини' },
};

/**
 * Повний препаративний розрахунок.
 * sample: 'plasmid' | 'nuclear' | 'rna'
 */
export function prepState({
  sample = 'plasmid', mass = 5, tissue = 'leaf', nitrogen = true,
  cm = true, ampliH = 14, lysisSec = 40, deprot = 2, precipMin = 30, cultureMl = 500,
}) {
  let crude = 0, degraded = 0;
  if (sample === 'plasmid') {
    const copies = copyNumber(ampliH, { cm });
    const od = cm ? 0.4 : od600(timeToOD(0.4) + ampliH);
    const perMl = plasmidYieldPerMl({ od, copies });
    const lys = boilingLysis(lysisSec);
    crude = perMl * cultureMl * lys.release * (1 - 0.6 * lys.damage);   // мкг з усього об'єму культури
    degraded = lys.damage;
  } else {
    const s = SOURCES[sample];
    const base = tissue === 'callus' ? s.callus : s.yield;
    const homog = nitrogen ? 1 : 0.55;              // без розтирання з рідким азотом вихід менший
    crude = base * mass * homog;
    degraded = nitrogen ? (sample === 'rna' ? 0.05 : 0.03) : (sample === 'rna' ? 0.45 : 0.25);
  }
  const rec = precipitation(precipMin);
  const lossDeprot = Math.pow(0.9, deprot);          // кожна депротеїнізація коштує ≈ 10 % виходу
  const yieldUg = crude * rec * lossDeprot;
  const protRatio = proteinCarryover(deprot);
  const phenolUgMl = phenolCarryover(deprot, precipMin);
  return { yieldUg, protRatio, phenolUgMl, degraded, recovery: rec };
}

/* ======================================================================
   3. Електрофорез в агарозному гелі (ЛР 47 п. 12, ЛР 49, с. 180–183)
   ====================================================================== */

/** Межі розділення гелю: найдовший (виключення) і найкоротший (біля фронту) фрагменти. */
export function gelLimits(agarosePct) {
  const lgMax = 4.30 - 0.95 * (agarosePct - 0.8);
  const lgMin = 2.70 - 0.62 * (agarosePct - 0.8);
  return { lgMax, lgMin };
}

/**
 * Відносна електрофоретична рухливість Rf = відстань смуги / відстань фронту барвника.
 * Класична залежність: Rf лінійна відносно lg(довжини) (Гелінг, Саузерн).
 */
export function rfOf(bp, agarosePct) {
  const { lgMax, lgMin } = gelLimits(agarosePct);
  const lg = Math.log10(Math.max(1, bp));
  return clamp(0.05 + 0.9 * (lgMax - lg) / (lgMax - lgMin), 0.02, 1);
}

/** Обернене перетворення: довжина фрагмента за виміряною рухливістю. */
export function bpOfRf(rf, agarosePct) {
  const { lgMax, lgMin } = gelLimits(agarosePct);
  const lg = lgMax - ((rf - 0.05) / 0.9) * (lgMax - lgMin);
  return Math.pow(10, lg);
}

/** Шлях фронту барвника, см: v = k·E, E = U/d (d = 20 см — відстань між електродами). */
export function frontCm(volt, hours, agarosePct, { d = 20, k = 1.0, gelCm = 8 } = {}) {
  const E = volt / d;
  const v = (k * E) / (1 + 0.35 * (agarosePct - 0.8));
  return Math.min(gelCm, v * hours);
}

/** Яскравість смуги за масою ДНК у ній (поріг виявлення бромистим етидієм ≈ 5 нг). */
export function bandBrightness(ng) {
  return clamp(1 - Math.exp(-ng / 45), 0, 1);
}

/** Форми плазміди: уявна («ефективна») довжина відносно справжньої. */
export const PLASMID_FORMS = [
  { id: 'oc', label: 'Відкрита кільцева (ОК, з розривом)', factor: 1.35, share: 0.18 },
  { id: 'lin', label: 'Лінійна', factor: 1.0, share: 0.12 },
  { id: 'ccc', label: 'Надспіралізована (ккк)', factor: 0.63, share: 0.70 },
];

/** Маркер довжин 100–3000 п. н. (рис. 28, с. 181). */
export const LADDER = [100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000];

/* ======================================================================
   4. Спектрофотометрія ДНК/РНК (ЛР 50, с. 183)
   ====================================================================== */

/** Коефіцієнти з посібника: D260 = 1 ↔ 50 мкг/мл дволанцюгової ДНК, 40 мкг/мл РНК. */
export const NA_FACTOR = { dna: 50, rna: 40 };
/** Еталонні відношення чистоти (посібник, с. 183). */
export const PURE_RATIO = { dna: 1.8, rna: 2.0 };

const gauss = (lam, mu, sigma) => Math.exp(-0.5 * Math.pow((lam - mu) / sigma, 2));

/** Нормований спектр нуклеїнової кислоти (максимум ≈ 258 нм, значення 1,0 при 260 нм). */
export function naShape(lam, type = 'dna') {
  const sigma = type === 'dna' ? 20.21 : 18.61;   // підібрано так, щоб D260/D280 = 1,8 (ДНК) і 2,0 (РНК)
  const f = (l) => gauss(l, 258, sigma) + 0.5 * gauss(l, 205, 14);
  return f(lam) / f(260);
}

/** Нормований спектр білка (значення 1,0 при 280 нм). */
export function proteinShape(lam) {
  const f = (l) => gauss(l, 278, 14) + 0.35 * gauss(l, 230, 18) + 3 * gauss(l, 200, 12);
  return f(lam) / f(280);
}

/** Нормований спектр фенолу (максимум 270 нм). */
export function phenolShape(lam) {
  const f = (l) => gauss(l, 270, 11) + 1.6 * gauss(l, 210, 10);
  return f(lam) / f(270);
}

export const A280_PER_MG_PROTEIN = 0.67;  // 1 мг/мл сироваткового альбуміну → D280 ≈ 0,67
export const A270_PER_MG_PHENOL = 15.4;   // ε270(фенол) ≈ 1450 М⁻¹·см⁻¹, M = 94 г/моль

/**
 * Оптична густина суміші в кюветі 10 мм на довжині хвилі lam.
 * naUgMl, protUgMl, phenolUgMl — концентрації в кюветі (мкг/мл).
 */
export function absorbance(lam, { naUgMl = 0, protUgMl = 0, phenolUgMl = 0, type = 'dna' }) {
  const na = (naUgMl / NA_FACTOR[type]) * naShape(lam, type);
  const pr = (protUgMl / 1000) * A280_PER_MG_PROTEIN * proteinShape(lam);
  const ph = (phenolUgMl / 1000) * A270_PER_MG_PHENOL * phenolShape(lam);
  return na + pr + ph;
}

/**
 * Повний розрахунок ЛР 50. C0 — концентрація НК у вихідному препараті (мкг/мл),
 * K — кратність розведення в кюветі. Повертає виміряні D, відношення і розраховану концентрацію.
 */
export function spectroState({ type = 'dna', C0 = 500, protRatio = 0.3, phenolUgMl = 0, K = 50 }) {
  const naCuv = C0 / K;
  const protCuv = (C0 * protRatio) / K;
  const phCuv = phenolUgMl / K;
  const at = (l) => absorbance(l, { naUgMl: naCuv, protUgMl: protCuv, phenolUgMl: phCuv, type });
  const D260 = at(260), D280 = at(280), D230 = at(230);
  const R = D280 > 1e-6 ? D260 / D280 : Infinity;
  const R230 = D230 > 1e-6 ? D260 / D230 : Infinity;
  const Ccalc = D260 * NA_FACTOR[type] * K;       // формула посібника, с. 183
  return {
    naCuv, protCuv, phCuv, D260, D280, D230, R, R230, Ccalc, C0,
    error: C0 > 0 ? (Ccalc - C0) / C0 : 0,
    inRange: D260 >= 0.1 && D260 <= 1.0,          // лінійний діапазон закону Бугера — Ламберта — Бера
    at,
  };
}
