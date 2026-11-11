// Тема 4. Математика моделей морфогенезу (без DOM — перевіряється в Node).
// Посібник: Мельничук, Кляченко (2014), с. 77–85.
//  • Скуг — Міллер (с. 79): переважання ауксинів → корені без регенерації рослини; переважання цитокінінів → пагони.
//  • ЛР 15 (с. 81–83): калюс картоплі 5×5 мм; а) МС без гормонів, б) МС + 2 мг/л 6-БАП + 1 мг/л НОК; 25 °C, 70 %, 3 клк;
//    через 1 тиж — структуровані осередки, через 3–5 тиж — яскраво-зелені меристематичні зони, ще через 1–2 тиж — апекси
//    → мікропагони; до кількох десятків пагонів на експлантат; пагони 10 мм → укорінення (МС або МС + 2 мг/л ІМК + 1 мг/л ГК),
//    20 діб у темряві при 25 °C, корені — через 7–14 діб.
//  • ЛР 16 (с. 83): томати, середовище Уайта + кінетин 0,25 мг/л + ІОК 2 мг/л; 23–26 °C, 2000 лк, 14 год.
//  • ЛР 17 (с. 83–85): люцерна, три середовища (індукція, розвиток ембріоїдів, проростання); стадії: глобулярна, «сердечка»,
//    торпедоподібна, соматичного зародка (с. 81); морфогенний потенціал втрачається при тривалому субкультивуванні (с. 81, 83).
// Кількісних залежностей посібник не дає — нижче правдоподібні наближення (логістичні функції, Гілл), калібровані за
// класичними даними Skoog & Miller (1957) для серцевини тютюну: ІОК 2 мг/л + кінетин 0,02 → корені, 0,2 → калюс, 1,0 → пагони.

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const logistic = (z) => 1 / (1 + Math.exp(-z));

/** Відносна активність (еквіваленти ІОК і кінетину) — наближення моделі. */
export const AUX = {
  iaa: { name: 'ІОК', full: 'індоліл-3-оцтова кислота', k: 1 },
  naa: { name: 'НОК', full: 'α-нафтилоцтова кислота', k: 5 },
  d24: { name: '2,4-Д', full: '2,4-дихлорфеноксиоцтова кислота', k: 10 },
};
export const CYT = {
  kin: { name: 'кінетин', full: '6-фурфуриламінопурин', k: 1 },
  bap: { name: '6-БАП', full: '6-бензиламінопурин', k: 3 },
};
// ендогенний (власний) рівень гормонів калюсу, екв. мг/л
export const ENDO = { A: 0.02, C: 0.01 };
// пороги lg(А/Ц) для пагонів і коренів та ширина переходу (калібрування за Skoog & Miller, 1957)
export const TH = { shoot: 0.75, root: 1.45, w: 0.2 };

/**
 * Відгук калюсу на гормональний баланс.
 * aux, cyt — мг/л; light — true (3 клк, 16 год) | false (темрява); passage — номер пасажу калюсу.
 */
export function organo({ aux, auxType = 'iaa', cyt, cytType = 'kin', light = true, passage = 1 }) {
  const A = aux * AUX[auxType].k + ENDO.A, C = cyt * CYT[cytType].k + ENDO.C;
  const r = Math.log10(A / C);                                   // lg(А/Ц), А і Ц в еквівалентах
  const s = logistic(-(r - TH.shoot) / TH.w);                    // схильність до стеблового органогенезу
  const rho = logistic((r - TH.root) / TH.w);                    // схильність до ризогенезу
  const hC = C / (C + 0.1), hA = A / (A + 0.15);                 // достатність цитокініну / ауксину
  const d24 = auxType === 'd24' ? 1 / (1 + Math.pow(aux / 0.2, 1.5)) : 1; // 2,4-Д — дедиференціюючий фактор (с. 80)
  const tox = 1 / (1 + Math.pow(A / 60, 2));                     // надлишок ауксину
  const L = light ? 1 : 0.4;                                     // світло потрібне для бруньок і позеленіння
  const capS = Math.exp(-(passage - 1) / 4), capR = Math.exp(-(passage - 1) / 10); // с. 81: здатність до органогенезу
  //                                                               зменшується з пасажами, до коренеутворення — довше
  const shoot = s * hC * L * capS * d24 * tox;
  const rootS = rho * hA * capR * d24 * tox;
  const g = (0.2 + 0.8 * A / (A + 0.1)) * (0.35 + 0.65 * C / (C + 0.1)) * tox; // інтенсивність проліферації (0..1)
  const nShoots = Math.round(30 * shoot);                        // «до декількох десятків пагонів» (с. 82)
  const nRoots = Math.round(18 * rootS);
  const callus = clamp(g * (1 - 0.65 * Math.max(shoot, rootS)), 0, 1);
  let path = 'callus';
  if (g < 0.22 && shoot < 0.15 && rootS < 0.15) path = 'weak';
  else if (shoot >= 0.3 && shoot >= rootS) path = rootS > 0.2 ? 'mixed' : 'shoots';
  else if (rootS >= 0.3) path = 'roots';
  else if (shoot >= 0.12 || rootS >= 0.12) path = 'callus+';
  return { A, C, r, ratio: A / C, s, rho, hC, hA, shoot, rootS, g, callus, nShoots, nRoots, path, d24, capS, capR, light };
}

/** Час появи k-го з N органів (квантилі логістичного розподілу навколо t50). */
export function appear(k, N, t50, s) { const q = (k + 0.5) / N; return t50 + s * Math.log(q / (1 - q)); }

/** Динаміка: доба t → маса калюсу (г), зони, апекси, висота пагонів, корені. */
export const TIME = { foci: 7, zone50: 28, zoneS: 3.5, apex50: 38, apexS: 3, shootRate: 0.6, root50: 12, rootS: 2, rootRate: 1.5, m0: 0.08, K: 1.5, mu: 0.11 };
export function dynamics(o, t) {
  const T = TIME;
  const mu = T.mu * o.g * (o.path === 'shoots' || o.path === 'mixed' ? 0.75 : 1);
  const mass = T.K * T.m0 / (T.m0 + (T.K - T.m0) * Math.exp(-mu * t));       // логістичний ріст сирої маси, г
  const foci = (o.shoot > 0.08 || o.rootS > 0.08) ? logistic((t - T.foci) / 1.2) : 0;
  const zones = logistic((t - T.zone50) / T.zoneS) * Math.min(1, o.shoot * 1.6);
  const apices = []; let nAp = 0, n10 = 0;
  for (let k = 0; k < o.nShoots; k++) {
    const ti = appear(k, o.nShoots, T.apex50, T.apexS);
    const h = t > ti ? Math.min(25, (t - ti) * T.shootRate * (o.light ? 1 : 1.25)) : 0;   // мм; у темряві — етиоляція
    if (t > ti) nAp++; if (h >= 10) n10++;
    apices.push({ ti, h });
  }
  const roots = []; let nR = 0;
  for (let k = 0; k < o.nRoots; k++) {
    const ti = appear(k, o.nRoots, T.root50, T.rootS);
    const len = t > ti ? Math.min(40, (t - ti) * T.rootRate) : 0;
    if (t > ti) nR++;
    roots.push({ ti, len });
  }
  return { mass, foci, zones, apices, nAp, n10, roots, nR };
}

/** ЛР 15 п. 4–5: укорінення мікропагонів (частка вкорінених до доби t). Параметри — наближення моделі. */
export const ROOTING = {
  ms: { name: 'МС без гормонів', Rmax: 0.55, t50: 13, s: 2, nRoots: 2, rate: 1.2 },
  iba: { name: 'МС + 2 мг/л ІМК + 1 мг/л ГК', Rmax: 0.95, t50: 9, s: 1.5, nRoots: 5, rate: 1.5 },
};
export function rooted(med, t, dark = true) {
  const m = ROOTING[med], t50 = m.t50 + (dark ? 0 : 3), Rmax = m.Rmax * (dark ? 1 : 0.8);
  return Rmax * logistic((t - t50) / m.s);
}
/** Вихід рослин-регенерантів на експлантат: пагони ≥ 10 мм × частка вкорінених на 20-ту добу. */
export function regenerants(nShoots, med, dark = true, f10 = 0.7) { return nShoots * f10 * rooted(med, 20, dark); }

/* ---------------- Соматичний ембріогенез (ЛР 17) ---------------- */
// Етапи (тривалість — припущення моделі): I індукція 0–21 доба, II розвиток 21–49, III проростання 49–70.
export const SE = { t1: 21, t2: 49, t3: 70, v0: 0.14, nMax: 40 };
/** Чинники швидкості розвитку на середовищі II. naa — мг/л, gln — мг/л, suc — г/л. */
export function seFactors({ naa = 0.1, gln = 800, suc = 60, passage = 1 }) {
  const fAux = 1 / (1 + Math.pow(naa / 0.3, 3));             // ауксин гальмує перехід від глобулярної стадії (с. 80)
  const fN = 0.4 + 0.6 * gln / (gln + 250);                   // відновлений азот (глутамін; NH4+ — с. 79–80)
  const fSuc = Math.exp(-Math.pow(Math.log(suc / 60) / 1.0, 2)); // осмотичний оптимум ≈ 60 г/л (посібник: 60 г)
  const pot = Math.exp(-(passage - 1) / 3.5);                 // морфогенний потенціал (с. 83)
  return { fAux, fN, fSuc, pot, v: SE.v0 * fN * fSuc };
}
/** Стадія p одного ембріоїда на добу t. u — індивідуальна варіація 0..1, tau — доба ініціації. */
export function seStage(t, tau, u, F) {
  if (t < tau) return -1;
  // етап I (ІОК 2 мг/л + кінетин): проембріогенна маса → глобулярні (стеля p ≈ 0,9)
  const v1 = 0.07 * (0.8 + 0.4 * u);
  let p = Math.min(0.9, (Math.min(t, SE.t1) - tau) * v1);
  if (t <= SE.t1) return p;
  // етап II: дозрівання глобули не залежить від ауксину; перехід до серцеподібної й далі гальмує ауксин (fAux)
  const v = F.v * (0.75 + 0.5 * u);
  let dt = Math.min(t, SE.t2) - SE.t1;
  const toG = Math.max(0, (0.8 - p) / v);
  if (dt <= toG) return p + dt * v;
  p = Math.max(p, 0.8); dt -= toG;
  p = Math.min(3.99, p + dt * v * F.fAux);
  if (t <= SE.t2) return p;
  // етап III (кінетин 2 мг/л, 2000 лк): проростають ембріоїди, що дійшли до торпедоподібної/сім'ядольної стадії
  const d3 = t - SE.t2;
  if (p >= 2.6 && u > 0.2) return Math.min(5, p + d3 * 0.11 * (0.8 + 0.4 * u)); // ≈ 80 % конверсії в рослини
  if (p >= 2.6) return Math.min(3.99, p + d3 * 0.05);
  return Math.min(p + d3 * 0.02, 2.6);                         // недорозвинені — не проростають
}
/** Популяція (N віртуальних ембріоїдів): частки стадій на добу t. */
export function sePopulation(t, F, N = 240, seedU = (i) => ((i * 0.6180339887) % 1)) {
  const c = [0, 0, 0, 0, 0, 0]; // глоб, серц, торп, сім'яд, проростання/рослина, ще не ініційовані
  for (let i = 0; i < N; i++) {
    const u = seedU(i), tau = 3 + 16 * ((i * 0.7548776662) % 1);
    const p = seStage(t, tau, u, F);
    if (p < 0) c[5]++; else c[Math.min(4, Math.floor(p))]++;
  }
  return c.map((x) => x / N);
}
