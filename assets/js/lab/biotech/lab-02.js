(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

const EXPLANT_TAB4 = {
  soy: {
    name: "Насіння сої (Glycine max L.) — ЛР 5, 8",
    etohSec: 60,
    recAgent: "naclo",
    recMin: 18,
    kMicro: 0.24, // microbial kill rate base
    kDamage: 0.020, // tissue sensitivity (hard seed coat = resistant)
    n0: 4.5,
    note: "Щільна насіннєва шкірка (теста) захищає зародок: 70 % етанол (1 хв) → гіпохлорит натрію («Білизна» 1:2, 15–20 хв) або 10 % H₂O₂ (15–20 хв) → 3–4 промивання стерильною дистильованою водою."
  },
  carrot: {
    name: "Коренеплід моркви (Daucus carota L.) — ЛР 6, 9",
    etohSec: 45,
    recAgent: "naclo",
    recMin: 15,
    kMicro: 0.25,
    kDamage: 0.032,
    n0: 5.2,
    note: "Ґрунтовий орган із високим обсіменінням спорами Bacillus: миття з милом → очищення покривної перидерми → 70 % етанол (30–60 с) або обпалювання у спирті → розчин «Білизни» (1:2, 15 хв) → триразове промивання стерильною водою по 10–15 хв."
  },
  potato: {
    name: "Бульба картоплі (Solanum tuberosum L.) — ЛР 10",
    etohSec: 40,
    recAgent: "hgcl2",
    recMin: 10,
    kMicro: 0.27,
    kDamage: 0.038,
    n0: 5.0,
    note: "Очищені кубики паренхіми бульби обробляють 70 % етанолом (30 с), потім 0,1 % сулемою (HgCl₂, 8–10 хв) або 10 % H₂O₂ (12–15 хв) і ретельно відмивають стерильною водою."
  },
  tobacco: {
    name: "Листок тютюну (Nicotiana tabacum L.) — ЛР 11–12",
    etohSec: 10,
    recAgent: "agno3",
    recMin: 7,
    kMicro: 0.34,
    kDamage: 0.085, // tender leaf epidermis = highly sensitive to necrosis!
    n0: 3.6,
    note: "Ніжна листкова пластинка легко некротизується: коротка обробка 70 % етанолом (5–10 с) → 0,1 % AgNO₃ або слабкий гіпохлорит (5–8 хв) → промивання 0,5 % NaCl (для зв'язування Ag⁺ в AgCl↓) та тричі стерильною водою."
  }
};

const AGENTS = {
  naclo: { name: "Гіпохлорит натрію NaClO («Білизна» 1:2, ~2,5 % акт. Cl)", potKill: 1.15, potTox: 1.00 },
  h2o2:  { name: "Пероксид водню H₂O₂ (10 % розчин)", potKill: 0.92, potTox: 0.78 },
  agno3: { name: "Нітрат срібла AgNO₃ (0,1–0,5 % розчин)", potKill: 1.25, potTox: 1.12 },
  hgcl2: { name: "Сулема HgCl₂ (0,1 % розчин, високотоксичний)", potKill: 1.48, potTox: 1.35 },
  chlor: { name: "Хлорамін Б (3–5 % водний розчин)", potKill: 0.85, potTox: 0.72 },
};

App.def(2, {
  cheat: `
    <p class="lead">Первинний <b>експлантат</b> (від лат. <i>ex</i> — ззовні, <i>planto</i> — саджаю) — це ізольований фрагмент тканини або органа інтактної рослини, поміщений на стерильне живильне середовище для індукції калюсогенезу чи морфогенезу. Поверхня рослин, вирощених у відкритому ґрунті чи теплиці, завжди колонізована епіфітною мікрофлорою (бактеріями родів <i>Pseudomonas</i>, <i>Bacillus</i>, <i>Erwinia</i> та спорами грибів <i>Aspergillus</i>, <i>Penicillium</i>, <i>Alternaria</i>), тому першим критичним етапом роботи є <b>поверхнева хімічна стерилізація</b> рослинного матеріалу.</p>

    <h3>1. Поверхнева стерилізація рослинних об'єктів (ЛР № 5–6, табл. 4)</h3>
    <p>Завдання поверхневої стерилізації полягає у повному знищенні мікроорганізмів на кутикулі й у продихових щілинах при збереженні життєздатності паренхімних і меристематичних клітин самого експлантата. Згідно з практикумом (с. 57–60, табл. 4), процес проводять за багатоступеневою схемою:</p>
    <ol>
      <li><b>Механічне очищення та попереднє промивання:</b> коренеплоди моркви, бульби картоплі або насіння сої ретельно миють теплою проточною водою з милом або детергентом (Твін-20 / Твін-80) для змивання часточок ґрунту та пилу.</li>
      <li><b>Знежирення та змочування 70 % етиловим спиртом (етанолом) протягом 5–60 с:</b> розчиняє восковий наліт кутикули, знижує поверхневий натяг і видаляє пухирці повітря з мікронерівностей епідермісу, забезпечуючи контакт основного окиснювача з поверхнею тканини.</li>
      <li><b>Експозиція в основному стерилізуючому розчині (5–25 хв):</b> застосовують окиснювачі з активним хлором — гіпохлорит натрію $\\text{NaClO}$ (побутовий препарат «Білизна» у розведенні 1:1–1:3 або «Доместос»), гіпохлорит кальцію $\\text{Ca(ClO)}_2$ (5–10 %), хлорамін Б (3–5 %), пероксид водню $\\text{H}_2\\text{O}_2$ (10–12 %) або солі важких металів — нітрат срібла $\\text{AgNO}_3$ (0,1–0,5 %) та дихлорид ртуті (сулему) $\\text{HgCl}_2$ (0,1 %), які необоротно блокують сульфгідрильні ($-\\text{SH}$) групи білків мікробних клітин.</li>
      <li><b>Три-чотириразове відмивання стерильною дистильованою водою у ламінарному боксі (по 10–15 хв кожне):</b> для повного видалення залишків фітотоксичного стерилізатора (після $\\text{AgNO}_3$ перше промивання проводять 0,5 % розчином $\\text{NaCl}$ для зв'язування іонів $\\text{Ag}^+$ у нерозчинний $\\text{AgCl}\\downarrow$).</li>
    </ol>

    <div class="tblwrap">
      <table class="t bt">
        <caption>Таблиця 4. Режими поверхневої стерилізації різних видів рослинного матеріалу (за М. Д. Мельничуком, О. Л. Кляченко, 2014, с. 58–59)</caption>
        <thead>
          <tr><th>Рослинний об'єкт</th><th>Попередня обробка</th><th>Основний стерилізатор</th><th>Концентрація</th><th>Час, хв</th></tr>
        </thead>
        <tbody>
          <tr><td>Насіння сої (<i>Glycine max</i> L.), гороху, пшениці</td><td>Вода з милом; 70 % етанол (1 хв)</td><td>«Білизна» (NaClO) або H₂O₂</td><td class="n">1:2 (2–3 %) / 10 %</td><td class="n">15–20</td></tr>
          <tr><td>Коренеплід моркви (<i>Daucus carota</i> L.)</td><td>Миття щіткою, зняття шкірки; 70 % спирт (45 с)</td><td>«Білизна» (NaClO) або хлорамін</td><td class="n">1:2 / 5 %</td><td class="n">15–20</td></tr>
          <tr><td>Бульба картоплі (<i>Solanum tuberosum</i> L.), топінамбура</td><td>Миття з милом; 70 % етанол (30–40 с)</td><td>Сулема HgCl₂ або H₂O₂</td><td class="n">0,1 % / 10 %</td><td class="n">8–12</td></tr>
          <tr><td>Листки тютюну (<i>Nicotiana tabacum</i> L.), стевії</td><td>70 % етанол (5–10 с) + Твін-80</td><td>Нітрат срібла AgNO₃ або NaClO</td><td class="n">0,1 % / 1:4</td><td class="n">5–8</td></tr>
          <tr><td>Пагони та бруньки деревних і трав'янистих рослин</td><td>Миття у воді з Твін-20; 70 % спирт (20 с)</td><td>Діацид або HgCl₂</td><td class="n">0,1 %</td><td class="n">7–10</td></tr>
        </tbody>
      </table>
    </div>

    <h4>Математична модель «вікна асептичної життєздатності» $\\eta(t)$</h4>
    <p>Зі збільшенням часу експозиції $t$ у стерилізуючому розчині частка інфікованих експлантатів $P_{\\text{конт}}(t)$ спадає експоненційно, тоді як частка некротизованих (отруєних окиснювачем внаслідок дифузії реагенту вглиб паренхіми на відстань $x \\sim \\sqrt{D t}$) експлантатів $P_{\\text{некр}}(t)$ зростає за сигмоїдною кривою Вейбулла. Ймовірність одержання <b>стерильного і водночас життєздатного експлантата</b> $\\eta(t)$ має чіткий максимум:</p>
    <div class="eq">$$P_{\\text{конт}}(t) = 1 - \\exp\\!\\left(-N_0 e^{-k_m t}\\right), \\qquad P_{\\text{некр}}(t) = 1 - \\exp\\!\\left(-(k_d t)^m\\right), \\qquad \\eta(t) = \\bigl[1 - P_{\\text{конт}}(t)\\bigr]\\cdot\\bigl[1 - P_{\\text{некр}}(t)\\bigr]$$</div>

    <h3>2. Фізіологічна полярність калюсогенезу та морфогенезу (ЛР № 7, с. 60–61)</h3>
    <p>Рослинні органи та вичленовані з них сегменти стебла чи коренеплоду мають <b>фізіологічну полярність</b> — нерівноцінність морфологічно <b>апікального</b> (верхівкового, зверненого до конуса наростання пагона) та <b>базального</b> (нижнього, зверненого до кореневої шийки або кінчика кореня) полюсів. Головним механізмом полярності є <b>базипетальний полярний транспорт ауксину (індоліл-3-оцтової кислоти [ІОК])</b> із клітини в клітину зі швидкістю $v_{\\text{PIN}} \\approx 5–15\\text{ мм/год}$.</p>
    <p>За хеміосмотичною моделлю Рубері—Шеldрейка у слабкокислому апопласті ($\\text{pH } 5,0–5,5$) частина молекул ІОК ($\\text{p}K_a = 4,75$) перебуває у протонованій ліпофільній формі $\\text{ІОК-H}$, яка вільно дифундує крізь плазмалему всередину цитоплазми ($\\text{pH } 7,2$), де дисоціює до аніона $\\text{ІОК}^-$, не здатного вийти назовні без участі специфічних ефлюксних білків-переносників родини <b>PIN (PIN-FORMED)</b>. Оскільки білки PIN локалізовані виключно на морфологічно <b>базальній мембрані</b> клітин, потік ІОК спрямований строго від апікального кінця до базального згідно з рівнянням адвекції-дифузії:</p>
    <div class="eq">$$\\frac{\\partial A}{\\partial t} = D_A \\frac{\\partial^2 A}{\\partial x^2} - v_{\\text{PIN}} \\frac{\\partial A}{\\partial x} - k_{\\text{дегр}} A + S(x)$$</div>
    <p>Тому у <b>Лабораторній роботі № 7</b> при висаджуванні циліндрів коренеплоду моркви або стеблових сегментів у пробірки у <b>нормальній орієнтації</b> (базальним кінцем униз на агар) і в <b>інвертованій орієнтації</b> (перевернутими догори дном — морфологічно базальним кінцем догори у повітря!) калюс однаково інтенсивно утворюється саме на <b>морфологічно базальному полюсі</b>, де акумулюється ендогенна ІОК.</p>

    <h3>3. Гістотопографія первинного експлантата коренеплоду моркви (ЛР № 8–12, с. 61–63)</h3>
    <p>На поперечному зрізі запасаючого коренеплоду моркви (<i>Daucus carota</i> L.) чітко розрізняють: зовнішню покривну <b>перидерму</b> (яку зрізають і відкидають), широке зовнішнє кільце <b>вторинної флоеми (корової паренхіми)</b>, вузьку світлішу смужку вторинної латеральної меристеми — <b>камбіальне кільце</b>, та центральний циліндр <b>вторинної ксилеми (серцевини)</b>. Найвищу мітотичну компетентність і швидкість індукції первинного калюсу проявляють експлантати, висічені пробковим свердлом або скальпелем саме із зони <b>камбіального кільця</b>, клітини якого вже знаходяться у G₁/S-фазі клітинного циклу й не потребують тривалої дедиференціації.</p>

    <details class="bproto">
      <summary>Хід роботи (Лабораторні роботи № 5–12, с. 57–63)</summary>
      <div>
        <ol class="bsteps">
          <li><b>ЛР № 5, 8. Введення в культуру насіння сої (<i>Glycine max</i> L.):</b> відберіть неушкоджене насіння сої, промийте мильною водою, перенесіть у ламінарний бокс, витримайте 1 хв у 70 % етанолі та 15–20 хв у розчині «Білизни» (1:2) або 10 % H₂O₂. Тричі промийте стерильною дистильованою водою по 10 хв і розкладіть стерильним пінцетом на безгормональне агаризоване середовище МС для одержання асептичних проростків (донорів сім'ядольних і гіпокотильних експлантатів).</li>
          <li><b>ЛР № 6, 9. Ізоляція експлантатів коренеплоду моркви (<i>Daucus carota</i> L.):</b> ретельно вимитий коренеплід очистіть від шкірки, розріжте на поперечні шайби завтовшки 1,5–2 см, простерилізуйте у 70 % спирті (45 с) та розчині гіпохлориту натрію (15 хв), тричі відмийте стерильною водою. У стерильній чашці Петрі зріжте скальпелем торцеві поверхні (1–2 мм), пошкоджені стерилізатором, і пробковим свердлом ($d = 5\\text{ мм}$) або скальпелем вичленуйте експлантати із зони <b>камбіального кільця</b> масою 50–100 мг.</li>
          <li><b>ЛР № 7. Вивчення фізіологічної полярності калюсогенезу:</b> перед вичленуванням циліндрів зробіть косий зріз на апікальному кінці сегмента коренеплоду для маркування полюсів. Половину експлантатів висадіть на середовище МС (+ 1 мг/л 2,4-Д, 0,5 мг/л кінетину) у нормальному положенні (базальним кінцем на агар), а другу половину — в інвертованому положенні (апікальним кінцем на агар, базальним догори). Через 2–3 тижні культивування в темряві при 25–26 °C порівняйте локалізацію та масу калюсу.</li>
          <li><b>ЛР № 10–12. Ізоляція експлантатів бульби картоплі (<i>Solanum tuberosum</i> L.) та листка тютюну (<i>Nicotiana tabacum</i> L.):</b> проведіть щадну стерилізацію згідно з табл. 4, виріжте листкові диски ($d = 8\\text{ мм}$) без головної жилки та висадіть абаксіальною (нижньою) стороною на поверхню агаризованого середовища МС.</li>
        </ol>
      </div>
    </details>
  `,
  qa: [
    [
      "Чому під час підготовки експлантатів моркви чи картоплі після промивання стерильною водою обов'язково зрізають і відкидають зовнішні торцеві шари тканини (1–2 мм)?",
      "<p>Під час 15-хвилинної експозиції у гіпохлориті натрію, пероксиді водню чи сулемі окиснювач дифундує на глибину 0,5–1,5 мм у паренхіму, викликаючи хімічний опік, денатурацію білків і некроз зовнішніх клітин. Якщо не оновити зрізи стерильним скальпелем, мертвий некротичний шар стане бар'єром для дифузії поживних речовин із середовища і виділятиме в агар токсичні продукти окиснення поліфенолів (хінони).</p>"
    ],
    [
      "Для чого перед основним стерилізатором рослинний матеріал на кілька десятків секунд занурюють у 70 % етиловий спирт та додають детергент Твін-80?",
      "<p>Епідерміс надземних органів рослин вкритий гідрофобною восковою кутикулою та трихомами, які утримують мікроскопічні пухирці повітря й не змочуються водними розчинами солей чи гіпохлориту. 70 % етанол і поверхнево-активна речовина Твін-80 знижують поверхневий натяг, розчиняють поверхневі воски й забезпечують проникнення основного стерилізатора у продихові щілини та мікротріщини покривної тканини.</p>"
    ],
    [
      "Чому після стерилізації листків нітратом срібла (AgNO₃) перше промивання проводять стерильним розчином хлориду натрію (NaCl), а не просто дистильованою водою?",
      "<p>Іони срібла $\\text{Ag}^+$ міцно адсорбуються на негативно заряджених карбоксильних групах пектинів клітинної стінки й погано відмиваються чистою водою, продовжуючи чинити цитотоксичну дію під час культивування. За реакцією обміну $\\text{Ag}^+ + \\text{Cl}^- \\rightarrow \\text{AgCl}\\downarrow$ хлорид-іони миттєво переводять катіони срібла у біологічно інертний нерозчинний осад хлориду срібла, який потім змивають стерильною водою.</p>"
    ],
    [
      "Чому у досліді з перевернутими догори дном сегментами моркви (ЛР № 7) калюс утворюється переважно на верхньому (віддаленому від живильного середовища!) морфологічно базальному торці?",
      "<p>Полярний транспорт ауксину (ІОК) визначається асиметричним розташуванням ефлюксних білків-переносників <b>PIN</b> на морфологічно базальній плазмалемі клітин і не залежить від вектора сили тяжіння. Навіть коли експлантат перевернутий морфологічно базальним полюсом догори, активний транспорт перекачує ендогенну ІОК знизу вгору до базального торця, де підвищена концентрація гормону індукує дедиференціацію та поділ клітин.</p>"
    ],
    [
      "Чому експлантати коренеплоду моркви вирізають переважно із зони камбіального кільця, а не з центральної ксилеми?",
      "<p>Камбій є вторинною твірною тканиною (латеральною меристемою), дрібні тонкостінні клітини якої зберігають високу мітотичну активність і легко переходять до проліферації калюсу. Натомість у центральній ксилемі значна частина клітин є мертвими здерев'янілими судинами або глибоко вакуолізованою запасаючою паренхімою з низьким ядерно-цитоплазматичним співвідношенням.</p>"
    ]
  ],
  build({ stageBox, ctrls, below, tabsBox }) {
    let mode = "a";
    const M = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Оптимізація поверхневої стерилізації (ЛР 5–6)"],
      ["b", "Б. Фізіологічна полярність та PIN-транспорт (ЛР 7)"],
      ["c", "В. Гістотопографія експлантата моркви (ЛР 8–12)"]
    ], id => { mode = id; });

    /* ==================== TAB A: SURFACE STERILIZATION ==================== */
    const A = M.box("a");
    let objKey = "carrot";
    let agKey = "naclo";
    let concRel = 1.0; // relative concentration multiplier 0.4..2.0
    let expMin = 15; // exposure time in min
    let useEtOH = true; // 70% ethanol wetting pretreatment

    const stA = new Stage(A.st, { aspect: 1.75, minH: 280, maxH: 410 });
    const rdA = UI.reads(A.st, [
      ["ster", "Чисті (асептичні) експлантати"],
      ["cont", "Мікробна контамінація Pконт"],
      ["necr", "Фітотоксичний некроз Pнекр"],
      ["opt", "Оптимальне вікно tопт"],
    ]);

    UI.select(A.ct, {
      id: "l2-obj", label: "Рослинний об'єкт (табл. 4)", value: objKey,
      options: Object.entries(EXPLANT_TAB4).map(([k, v]) => [k, v.name]),
      on: v => {
        objKey = v;
        agKey = EXPLANT_TAB4[v].recAgent;
        $("#l2-ag").value = agKey;
        sTime.set(EXPLANT_TAB4[v].recMin); expMin = EXPLANT_TAB4[v].recMin;
      }
    });
    UI.select(A.ct, {
      id: "l2-ag", label: "Стерилізуючий агент", value: agKey,
      options: Object.entries(AGENTS).map(([k, v]) => [k, v.name]),
      on: v => { agKey = v; }
    });
    const sTime = UI.slider(A.ct, {
      id: "l2-t", label: "Час експозиції у стерилізаторі t", min: 1, max: 35, step: 0.5, value: expMin, unit: "хв",
      fmt: v => fmt(v, 1), on: v => { expMin = v; }
    });
    const sConc = UI.slider(A.ct, {
      id: "l2-c", label: "Відносна концентрація реагенту", min: 0.4, max: 2.0, step: 0.1, value: concRel, unit: "× норми",
      fmt: v => fmt(v, 1), on: v => { concRel = v; }
    });
    UI.check(A.ct, {
      id: "l2-etoh", label: "Попереднє змочування 70 % етанолом + Твін-80", value: useEtOH,
      on: v => { useEtOH = v; }
    });
    UI.buttons(A.ct, [
      { label: "Рекомендований режим табл. 4", pri: true, on: () => {
        const ob = EXPLANT_TAB4[objKey];
        agKey = ob.recAgent; $("#l2-ag").value = agKey;
        sTime.set(ob.recMin); expMin = ob.recMin;
        sConc.set(1.0); concRel = 1.0;
        useEtOH = true; $("#l2-etoh").checked = true;
      }}
    ]);

    const outA = UI.out(A.bl, "");
    const chRowA = h("div", { class: "charts" }); A.bl.append(chRowA);
    const chA1 = UI.chart(chRowA, "Криві контамінації, некрозу та виходу життєздатних асептичних експлантатів η(t)");
    const chA2 = UI.chart(chRowA, "Глибина дифузії стерилізатора в паренхіму експлантата x(t), мм");

    function evalSter(t) {
      const ob = EXPLANT_TAB4[objKey];
      const ag = AGENTS[agKey];
      const wetFactor = useEtOH ? 1.0 : 0.48; // without ethanol wetting, air bubbles shield spores!
      const km = ob.kMicro * ag.potKill * Math.pow(concRel, 0.75) * wetFactor;
      const kd = ob.kDamage * ag.potTox * Math.pow(concRel, 0.9);
      const residualSpores = Math.pow(10, ob.n0) * Math.exp(-km * t);
      const pCont = 1 - Math.exp(-residualSpores * 0.012);
      const pNecr = 1 - Math.exp(-Math.pow(kd * t, 2.35));
      const pViable = (1 - pCont) * (1 - pNecr);
      const penMm = 0.28 * Math.sqrt(ag.potTox * concRel * t);
      return { pCont, pNecr, pViable, penMm };
    }

    function drawA(time) {
      const { ctx: c, w, h: hh } = stA;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);

      const cur = evalSter(expMin);
      // Find optimal time tOpt
      let bestT = 1, bestEta = 0;
      for (let t = 1; t <= 35; t += 0.25) {
        const e = evalSter(t).pViable;
        if (e > bestEta) { bestEta = e; bestT = t; }
      }

      rdA.set("ster", fmt(cur.pViable * 100, 1), "%");
      rdA.set("cont", fmt(cur.pCont * 100, 1), "%");
      rdA.set("necr", fmt(cur.pNecr * 100, 1), "%");
      rdA.set("opt", `${fmt(bestT, 1)} хв (макс. ${fmt(bestEta * 100, 0)} %)`, "");

      // Left: Grid of 20 culture tubes / Petri explants showing statistical outcome (healthy green, moldy contaminated, bleached necrotic)
      const gx = 16, gy = 32, gw = w * 0.56, gh = hh - 46;
      Gfx.rr(c, gx, gy, gw, gh, 12);
      c.fillStyle = Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(15,42,29,0.03)"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
      Gfx.text(c, "Статистичний результат висіву 20 експлантатів через 7 діб:", gx + 12, gy + 18, { size: 11.5, weight: 700, color: T.ink });

      const cols = 5, rows = 4;
      const cellW = (gw - 24) / cols, cellH = (gh - 52) / rows;
      const nCont = Math.round(cur.pCont * 20);
      const nViable = Math.round(cur.pViable * 20);
      const nNecr = Math.max(0, 20 - nCont - nViable);

      for (let i = 0; i < 20; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = gx + 12 + col * cellW + cellW / 2;
        const cy = gy + 34 + row * cellH + cellH / 2;
        const rDish = Math.min(cellW, cellH) * 0.38;

        // Dish circle
        c.fillStyle = Theme.dark ? "#1E2B24" : "#F5F2E9";
        c.beginPath(); c.arc(cx, cy, rDish, 0, 7); c.fill();
        c.strokeStyle = rgba(T.ink, 0.35); c.lineWidth = 1.1; c.stroke();

        if (i < nViable) {
          // Viable aseptic explant proliferating bright green callus
          const pulse = 1 + 0.05 * Math.sin(time * 3 + i);
          Gfx.sphere(c, cx, cy, rDish * 0.52 * pulse, "#2E7D32", { ring: "#81C784" });
        } else if (i < nViable + nCont) {
          // Contaminated with fuzzy fungal hyphae / bacterial halo
          Gfx.glow(c, cx, cy, rDish * 0.92, "#D97706", 0.55);
          c.strokeStyle = "rgba(180, 95, 20, 0.65)"; c.lineWidth = 1;
          for (let hIdx = 0; hIdx < 7; hIdx++) {
            const ang = (hIdx * Math.PI * 2) / 7 + time * 0.4;
            c.beginPath(); c.moveTo(cx, cy);
            c.lineTo(cx + Math.cos(ang) * rDish * 0.82, cy + Math.sin(ang) * rDish * 0.82);
            c.stroke();
          }
          Gfx.sphere(c, cx, cy, rDish * 0.36, "#8D6E63");
        } else {
          // Bleached / brown necrotic explant (killed by sterilant)
          Gfx.sphere(c, cx, cy, rDish * 0.42, "#BDB8AD", { ring: "#795548" });
        }
      }

      // Legend at bottom of grid
      Gfx.chip(c, `Стерильні живі: ${nViable}/20`, gx + 14, gy + gh - 14, { color: "#2E7D32", bg: "rgba(46,125,50,0.14)" });
      Gfx.chip(c, `Інфіковані: ${nCont}/20`, gx + gw * 0.40, gy + gh - 14, { color: "#D97706", bg: "rgba(217,119,6,0.14)" });
      Gfx.chip(c, `Некроз: ${nNecr}/20`, gx + gw * 0.72, gy + gh - 14, { color: "#6D4C41", bg: "rgba(109,76,65,0.14)" });

      // Right: Cross-section of explant showing radial penetration of sterilant (necrotic outer rim vs healthy inner core)
      const rx = w * 0.61, ry = 32, rw = w * 0.36, rh = hh - 46;
      Gfx.rr(c, rx, ry, rw, rh, 12);
      c.fillStyle = Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(15,42,29,0.03)"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
      Gfx.text(c, "Дифузія стерилізатора в експлантат:", rx + rw / 2, ry + 18, { align: "center", size: 11.5, weight: 700, color: T.ink });

      const exCx = rx + rw / 2, exCy = ry + rh * 0.50, exR = Math.min(rw, rh) * 0.33;
      const penFrac = clamp(cur.penMm / 3.0, 0.04, 0.96);
      // Outer bleached/necrotic ring caused by sterilant penetration
      c.fillStyle = "#D7CCC8";
      c.beginPath(); c.arc(exCx, exCy, exR, 0, 7); c.fill();
      // Healthy living core
      c.fillStyle = objKey === "carrot" ? "#EF6C00" : objKey === "potato" ? "#FBC02D" : "#43A047";
      c.beginPath(); c.arc(exCx, exCy, exR * (1 - penFrac), 0, 7); c.fill();
      // Scalpel cut dashed line at 1.2 mm depth
      c.setLineDash([4, 3]); c.strokeStyle = T.ink; c.lineWidth = 1.4;
      c.beginPath(); c.arc(exCx, exCy, exR * 0.68, 0, 7); c.stroke(); c.setLineDash([]);
      Gfx.text(c, `Глибина опіку: ${fmt(cur.penMm, 2)} мм`, exCx, ry + rh - 30, { align: "center", size: 11, font: "mono", weight: 700, color: cur.penMm > 1.3 ? "#C62828" : T.ink });
      Gfx.text(c, "Пунктир — лінія обрізання торців скальпелем", exCx, ry + rh - 14, { align: "center", size: 9.5, color: T.muted });

      outA.set(`
        <b>Протокол для об'єкта «${EXPLANT_TAB4[objKey].name}»:</b> ${EXPLANT_TAB4[objKey].note}<br/>
        За обраної експозиції <b>${fmt(expMin, 1)} хв</b> вихід асептичних життєздатних експлантатів становить <b>$\\eta = ${fmt(cur.pViable * 100, 1)}\\,\\%$</b> (контамінація ${fmt(cur.pCont * 100, 1)} %, фітотоксичний некроз ${fmt(cur.pNecr * 100, 1)} %, глибина проникнення окиснювача ${fmt(cur.penMm, 2)} мм).
      `);

      // Chart A1: Contamination, Necrosis & Viable yield vs time
      const ptsC = [], ptsN = [], ptsV = [];
      for (let t = 0; t <= 35; t += 0.5) {
        const s = evalSter(t);
        ptsC.push([t, s.pCont * 100]);
        ptsN.push([t, s.pNecr * 100]);
        ptsV.push([t, s.pViable * 100]);
      }
      drawChart(chA1.ctx, chA1.w, chA1.h, {
        x: [0, 35], y: [0, 100],
        xl: "Час стерилізації t, хв", yl: "Частка експлантатів, %",
        vl: [{ x: bestT, color: rgba(T.accent, 0.7), label: `Оптимум ${fmt(bestT, 1)} хв` }],
        series: [
          { pts: ptsV, color: T.accent, w: 2.8, fill: rgba(T.accent, 0.12) },
          { pts: ptsC, color: "#D97706", w: 2.0, dash: [5, 3] },
          { pts: ptsN, color: "#C62828", w: 2.0, dash: [3, 3] },
        ],
        marks: [{ x: expMin, y: cur.pViable * 100, r: 5.5, color: T.accent, label: `${fmt(cur.pViable * 100, 1)} %` }],
        legend: [
          { label: "Стерильні живі η(t)", color: T.accent },
          { label: "Інфіковані Pконт(t)", color: "#D97706" },
          { label: "Некроз Pнекр(t)", color: "#C62828" }
        ]
      });

      // Chart A2: Penetration depth vs time
      const ptsPen = [];
      for (let t = 0; t <= 35; t += 0.5) ptsPen.push([t, evalSter(t).penMm]);
      drawChart(chA2.ctx, chA2.w, chA2.h, {
        x: [0, 35], y: [0, 3.0],
        xl: "Час стерилізації t, хв", yl: "Глибина некрозу паренхіми, мм",
        hl: [{ y: 1.2, color: "#C62828", label: "Межа зрізання скальпелем (1,2 мм)" }],
        series: [{ pts: ptsPen, color: "#1565C0", w: 2.4, fill: "rgba(21,101,192,0.10)" }],
        marks: [{ x: expMin, y: cur.penMm, r: 5, color: "#1565C0", label: `${fmt(cur.penMm, 2)} мм` }]
      });
    }

    /* ==================== TAB B: PHYSIOLOGICAL POLARITY (LAB 7) ==================== */
    const B = M.box("b");
    let vPin = 10.0; // PIN polar transport velocity mm/h (0 when TIBA added)
    let tibaConc = 0; // TIBA or NPA inhibitor (0..50 uM)
    let daysPol = 18; // incubation days (1..28)

    const stB = new Stage(B.st, { aspect: 1.75, minH: 280, maxH: 410 });
    const rdB = UI.reads(B.st, [
      ["veff", "Швидкість потоку ІОК vPIN"],
      ["rat", "Асиметрія ІОК (базальн. / апік.)"],
      ["calNorm", "Калюс у нормі (базальний внизу)"],
      ["calInv", "Калюс при інверсії (базальний вгорі)"],
    ]);

    const sDaysB = UI.slider(B.ct, {
      id: "l2-days", label: "Тривалість культивування (ЛР 7)", min: 1, max: 28, step: 1, value: daysPol, unit: "діб",
      fmt: v => fmt(v, 0), on: v => { daysPol = v; }
    });
    const sPin = UI.slider(B.ct, {
      id: "l2-pin", label: "Активність базальних переносників PIN", min: 2, max: 16, step: 0.5, value: vPin, unit: "мм/год",
      fmt: v => fmt(v, 1), on: v => { vPin = v; }
    });
    const sTiba = UI.slider(B.ct, {
      id: "l2-tiba", label: "Інгібітор полярного транспорту ТІБК / НФК", min: 0, max: 50, step: 2, value: tibaConc, unit: "мкМ",
      fmt: v => fmt(v, 0), on: v => { tibaConc = v; }
    });
    UI.buttons(B.ct, [
      { label: "Класичний дослід ЛР 7 (без інгібітора, 18 діб)", pri: true, on: () => { sDaysB.set(18); daysPol = 18; sPin.set(10); vPin = 10; sTiba.set(0); tibaConc = 0; } },
      { label: "Блокада PIN-білків (+40 мкМ ТІБК — втрата полярності)", on: () => { sTiba.set(40); tibaConc = 40; } }
    ]);

    const outB = UI.out(B.bl, "");
    const chRowB = h("div", { class: "charts" }); B.bl.append(chRowB);
    const chB1 = UI.chart(chRowB, "Стаціонарний профіль концентрації ІОК A(x) вздовж осі експлантата (0 = апікальний, L = базальний)");
    const chB2 = UI.chart(chRowB, "Динаміка накопичення маси калюсу на базальному та апікальному полюсах (мг)");

    function calcPolarity() {
      const inhib = 1 / (1 + Math.pow(tibaConc / 10, 1.5));
      const vEff = vPin * inhib;
      const D = 2.2; // diffusion coeff
      const Pe = (vEff * 1.0) / D; // Peclet number along normalized length x in [0, 1]
      const profPts = [];
      for (let i = 0; i <= 40; i++) {
        const x = i / 40; // 0 = apical pole, 1 = morphological basal pole
        const cVal = Pe < 0.05 ? 1.0 : (Pe * Math.exp(Pe * x)) / (Math.exp(Pe) - 1);
        profPts.push([x * 15, cVal]); // 15 mm segment length
      }
      const apicalIAA = profPts[0][1];
      const basalIAA = profPts[profPts.length - 1][1];
      const ratio = basalIAA / Math.max(0.05, apicalIAA);
      // Callus mass growth over daysPol at basal vs apical ends
      const growthFactor = (t) => 1 / (1 + Math.exp(-(t - 11) / 3.5));
      const mBasalNorm = 18 + 265 * growthFactor(daysPol) * clamp(basalIAA / 2.2, 0.25, 1.4);
      const mApicalNorm = 18 + 55 * growthFactor(daysPol) * clamp(apicalIAA, 0.1, 1.2);
      // In inverted orientation, basal pole is in air (slightly lower nutrient supply ~0.78x, but still dominant!)
      const mBasalInv = mBasalNorm * 0.82;
      const mApicalInv = mApicalNorm * 1.15;
      return { vEff, Pe, profPts, ratio, mBasalNorm, mApicalNorm, mBasalInv, mApicalInv };
    }

    function drawB(time) {
      const { ctx: c, w, h: hh } = stB;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const P = calcPolarity();

      rdB.set("veff", fmt(P.vEff, 1), "мм/год");
      rdB.set("rat", `${fmt(P.ratio, 1)} : 1`, P.ratio > 3 ? "сильна полярність" : "полярність знято");
      rdB.set("calNorm", `${fmt(P.mBasalNorm, 0)} мг (внизу)`, `апік. ${fmt(P.mApicalNorm, 0)} мг`);
      rdB.set("calInv", `${fmt(P.mBasalInv, 0)} мг (вгорі!)`, `апік. ${fmt(P.mApicalInv, 0)} мг`);

      // Draw two large culture tubes side by side:
      // Tube 1: Normal orientation (Apical UP, Basal DOWN on agar)
      // Tube 2: Inverted orientation (Basal UP in air, Apical DOWN on agar)
      const drawPolTube = (cx, title, inverted) => {
        const tw = Math.min(w * 0.28, 124), th = hh - 66, tx = cx - tw / 2, ty = 34;
        // Glass tube
        Gfx.rr(c, tx, ty, tw, th, 16);
        c.fillStyle = Theme.dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.68)"; c.fill();
        c.strokeStyle = rgba(T.ink, 0.48); c.lineWidth = 1.5; c.stroke();
        // Agar medium in bottom 30%
        const agY = ty + th * 0.70;
        Gfx.rr(c, tx + 2, agY, tw - 4, th * 0.30 - 2, 14);
        c.fillStyle = "rgba(235, 222, 170, 0.55)"; c.fill();
        Gfx.text(c, "Агар МС", cx, ty + th - 12, { align: "center", size: 10, color: T.muted });

        // Carrot cylinder explant sitting on agar surface
        const exW = 42, exH = 78, exX = cx - exW / 2, exY = agY - exH + 10;
        Gfx.rr(c, exX, exY, exW, exH, 5);
        c.fillStyle = "#E66C1E"; c.fill();
        c.strokeStyle = "#BF4F0B"; c.lineWidth = 1.3; c.stroke();

        // Animated IAA molecules streaming toward the morphologically BASAL pole
        const dir = inverted ? -1 : 1; // +1 = downward, -1 = upward!
        for (let k = 0; k < 8; k++) {
          const frac = ((time * (0.12 * P.vEff) + k / 8) % 1);
          const py = inverted ? (exY + exH - 8 - frac * (exH - 16)) : (exY + 8 + frac * (exH - 16));
          const px = cx + ((k % 3) - 1) * 10;
          Gfx.sphere(c, px, py, 3.2, "#FFEE58");
        }
        // Arrow showing polar IAA transport direction
        if (P.vEff > 1.5) {
          Gfx.arrow(c, cx + exW / 2 + 12, inverted ? exY + exH - 12 : exY + 12, cx + exW / 2 + 12, inverted ? exY + 12 : exY + exH - 12, {
            col: T.accent, w: 2.2, head: 7
          });
          Gfx.text(c, "ІОК", cx + exW / 2 + 24, exY + exH / 2 + 4, { size: 10, weight: 700, color: T.accent });
        }

        // Callus proliferation clusters at Morphological Basal Pole and Apical Pole
        const basalY = inverted ? exY : exY + exH;
        const apicalY = inverted ? exY + exH : exY;
        const mBas = inverted ? P.mBasalInv : P.mBasalNorm;
        const mApi = inverted ? P.mApicalInv : P.mApicalNorm;

        const drawCallusCluster = (cyPole, massMg, seed) => {
          const rBase = clamp((massMg - 18) / 14, 0, 22);
          if (rBase < 1) return;
          const rGen = rng(seed);
          for (let b = 0; b < 11; b++) {
            const bx = cx + (rGen() - 0.5) * (exW + rBase * 0.9);
            const by = cyPole + (rGen() - 0.5) * rBase * 0.85;
            Gfx.sphere(c, bx, by, 4 + rBase * 0.36 * (0.6 + 0.4 * rGen()), "#8BC34A", { ring: "rgba(46,125,50,0.45)" });
          }
        };
        drawCallusCluster(basalY, mBas, inverted ? 77 : 33);
        drawCallusCluster(apicalY, mApi, inverted ? 88 : 44);

        // Pole labels ("Б" = Базальний, "А" = Апікальний)
        Gfx.chip(c, inverted ? "Базальний полюс (Б)" : "Апікальний полюс (А)", cx, exY - 14, {
          color: inverted ? "#2E7D32" : T.muted, bg: inverted ? "rgba(46,125,50,0.16)" : "rgba(128,128,128,0.12)"
        });
        Gfx.chip(c, inverted ? "Апікальний полюс (А)" : "Базальний полюс (Б)", cx, exY + exH + 16, {
          color: !inverted ? "#2E7D32" : T.muted, bg: !inverted ? "rgba(46,125,50,0.16)" : "rgba(128,128,128,0.12)"
        });
        Gfx.text(c, title, cx, 18, { align: "center", size: 11.5, weight: 700, color: T.ink });
      };

      drawPolTube(w * 0.26, "1. Нормальна орієнтація (Б внизу)", false);
      drawPolTube(w * 0.74, "2. Інвертована орієнтація (Б вгорі!)", true);

      outB.set(`
        <b>Фізіологічний механізм полярності (ЛР № 7):</b> за швидкості базипетального транспорту <b>$v_{\\text{PIN}} = ${fmt(P.vEff, 1)}\\text{ мм/год}$</b> число Пекле становить $\\text{Pe} = ${fmt(P.Pe, 2)}$, а концентрація ауксину на морфологічно базальному полюсі у <b>${fmt(P.ratio, 1)} раза</b> перевищує концентрацію на апікальному полюсі. Тому навіть у перевернутому експлантаті (пробірка № 2) на верхньому (морфологічно базальному!) торці наростає <b>${fmt(P.mBasalInv, 0)} мг</b> калюсу проти <b>${fmt(P.mApicalInv, 0)} мг</b> на нижньому апікальному торці.
      `);

      // Chart B1: Auxin profile along segment
      drawChart(chB1.ctx, chB1.w, chB1.h, {
        x: [0, 15], y: [0, 6],
        xl: "Координата вздовж експлантата x, мм (0 = Апікальний → 15 = Базальний)", yl: "Відносна концентрація ІОК",
        series: [{ pts: P.profPts, color: T.accent, w: 2.6, fill: rgba(T.accent, 0.12) }],
        legend: [{ label: `Профіль ІОК (Pe = ${fmt(P.Pe, 1)})`, color: T.accent }]
      });

      // Chart B2: Callus growth curves at Basal vs Apical poles
      const ptsBas = [], ptsApi = [];
      const curRatio = P.profPts[P.profPts.length - 1][1];
      const apiRatio = P.profPts[0][1];
      for (let d = 0; d <= 28; d++) {
        const gf = 1 / (1 + Math.exp(-(d - 11) / 3.5));
        ptsBas.push([d, 18 + 265 * gf * clamp(curRatio / 2.2, 0.25, 1.4)]);
        ptsApi.push([d, 18 + 55 * gf * clamp(apiRatio, 0.1, 1.2)]);
      }
      drawChart(chB2.ctx, chB2.w, chB2.h, {
        x: [0, 28], y: [0, 380],
        xl: "Час культивування, діб", yl: "Маса калюсу на полюсі, мг",
        series: [
          { pts: ptsBas, color: T.accent, w: 2.6 },
          { pts: ptsApi, color: "#D97706", w: 2.0, dash: [4, 3] }
        ],
        marks: [{ x: daysPol, y: P.mBasalNorm, r: 5, color: T.accent, label: `${fmt(P.mBasalNorm, 0)} мг` }],
        legend: [
          { label: "Морфологічно базальний полюс (Б)", color: T.accent },
          { label: "Морфологічно апікальний полюс (А)", color: "#D97706" }
        ]
      });
    }

    /* ==================== TAB C: HISTOTOPOGRAPHY OF CARROT ROOT (LABS 8–12) ==================== */
    const C = M.box("c");
    let radPos = 0.62; // normalized radius where cork borer excises explant (0 = center xylem, 0.62 = cambial ring, 0.82 = phloem, 0.96 = periderm)
    let auxin24D = 1.0; // mg/L 2,4-D in MS medium

    const stC = new Stage(C.st, { aspect: 1.75, minH: 280, maxH: 410 });
    const rdC = UI.reads(C.st, [
      ["zone", "Вибрана гістологічна зона"],
      ["mit", "Мітотичний індекс MI"],
      ["lag", "Тривалість лаг-фази дедиференціації"],
      ["w28", "Маса калюсу на 28-му добу"],
    ]);

    const sRad = UI.slider(C.ct, {
      id: "l2-rad", label: "Радіальне положення свердла r/R", min: 0.05, max: 0.95, step: 0.01, value: radPos, unit: "r/R",
      fmt: v => fmt(v, 2), on: v => { radPos = v; }
    });
    const sAuxC = UI.slider(C.ct, {
      id: "l2-aux", label: "Концентрація 2,4-Д у середовищі МС", min: 0.1, max: 3.0, step: 0.1, value: auxin24D, unit: "мг/л",
      fmt: v => fmt(v, 1), on: v => { auxin24D = v; }
    });
    UI.buttons(C.ct, [
      { label: "Камбіальне кільце (r/R = 0,62 — оптимум ЛР 9)", pri: true, on: () => { sRad.set(0.62); radPos = 0.62; } },
      { label: "Флоемна паренхіма (r/R = 0,80)", on: () => { sRad.set(0.80); radPos = 0.80; } },
      { label: "Ксилемна серцевина (r/R = 0,20)", on: () => { sRad.set(0.20); radPos = 0.20; } }
    ]);

    const outC = UI.out(C.bl, "");
    const chRowC = h("div", { class: "charts" }); C.bl.append(chRowC);
    const chC1 = UI.chart(chRowC, "Радіальний розподіл мітотичної компетентності по перерізу коренеплоду моркви");
    const chC2 = UI.chart(chRowC, "Кінетика наростання біомаси калюсу для експлантатів із різних тканинних зон");

    function evalZone(r) {
      // Cambial ring is centered at r = 0.62 with width ~ 0.07
      const cambPeak = Math.exp(-Math.pow((r - 0.62) / 0.085, 2));
      const phloemBase = r > 0.62 && r < 0.90 ? 0.48 : 0.15;
      const xylemBase = r < 0.62 ? 0.25 + 0.18 * (r / 0.62) : 0;
      const peridermPenalty = smooth(0.88, 0.95, r);
      const comp = clamp((0.28 + 0.72 * cambPeak + 0.22 * phloemBase + 0.1 * xylemBase) * (1 - 0.85 * peridermPenalty), 0.05, 1.0);
      const auxFactor = (auxin24D / (0.25 + auxin24D)) * (1 - 0.12 * Math.max(0, auxin24D - 1.5));
      const miPct = comp * auxFactor * 9.4; // mitotic index %
      const lagDays = 3.0 + (1 - comp) * 6.5;
      const w28 = 50 + 520 * comp * auxFactor;
      const zoneName = r < 0.54 ? "Вторинна ксилема (серцевина)"
        : r <= 0.69 ? "Камбіальне кільце (меристема)"
        : r <= 0.89 ? "Вторинна флоема (корова паренхіма)"
        : "Перидерма (покривна тканина)";
      return { comp, miPct, lagDays, w28, zoneName };
    }

    function drawC(time) {
      const { ctx: c, w, h: hh } = stC;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const Z = evalZone(radPos);

      rdC.set("zone", Z.zoneName, "");
      rdC.set("mit", fmt(Z.miPct, 1), "% клітин у мітозі");
      rdC.set("lag", fmt(Z.lagDays, 1), "діб");
      rdC.set("w28", fmt(Z.w28, 0), "мг (з 50 мг)");

      // Left: Transverse anatomical cross-section of Carrot taproot (Daucus carota L.)
      const cx = w * 0.30, cy = hh * 0.52, R = Math.min(w * 0.26, hh * 0.42);
      // 1. Periderm outer ring
      c.fillStyle = "#B85318";
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
      // 2. Secondary Phloem (broad orange-red carotene-rich cortex)
      c.fillStyle = "#EF6C00";
      c.beginPath(); c.arc(cx, cy, R * 0.90, 0, 7); c.fill();
      // 3. Cambial Ring (bright yellow-green meristematic ring at r = 0.57..0.67 R)
      c.fillStyle = "#DCE775";
      c.beginPath(); c.arc(cx, cy, R * 0.67, 0, 7); c.fill();
      // 4. Secondary Xylem (lighter yellow-orange vascular core)
      c.fillStyle = "#FFA726";
      c.beginPath(); c.arc(cx, cy, R * 0.56, 0, 7); c.fill();

      // Radial medullary rays
      c.strokeStyle = "rgba(255, 245, 180, 0.38)"; c.lineWidth = 1.2;
      for (let a = 0; a < 16; a++) {
        const ang = (a * Math.PI * 2) / 16;
        c.beginPath();
        c.moveTo(cx + Math.cos(ang) * R * 0.12, cy + Math.sin(ang) * R * 0.12);
        c.lineTo(cx + Math.cos(ang) * R * 0.89, cy + Math.sin(ang) * R * 0.89);
        c.stroke();
      }

      // Cork borer circle at selected radPos
      const bx = cx + radPos * R, by = cy;
      const bRad = R * 0.13;
      Gfx.glow(c, bx, by, bRad * 1.9, "#FFFFFF", 0.65);
      c.strokeStyle = "#1B5E20"; c.lineWidth = 2.6;
      c.beginPath(); c.arc(bx, by, bRad, 0, 7); c.stroke();
      Gfx.text(c, `Свердло (r/R = ${fmt(radPos, 2)})`, cx, cy + R + 18, { align: "center", size: 11, weight: 700, color: T.ink });

      // Right: Excised explant cylinder in Petri dish showing resulting callus proliferation
      const rx = w * 0.72, ry = hh * 0.52, pRad = Math.min(w * 0.22, hh * 0.38);
      Gfx.petri(c, rx, ry, pRad, {
        agar: "rgba(235, 224, 175, 0.48)",
        label: `Індукція калюсу на 28-му добу: ${fmt(Z.w28, 0)} мг`
      });
      // Original carrot disc in center + proliferating green-yellow callus lobes around it
      const nLobes = Math.round(6 + Z.comp * 18);
      const rLobe = rng(99);
      for (let k = 0; k < nLobes; k++) {
        const ang = (k / nLobes) * Math.PI * 2 + time * 0.2;
        const dist = 12 + Z.comp * 26 * (0.6 + 0.4 * rLobe());
        const lx = rx + Math.cos(ang) * dist, ly = ry + Math.sin(ang) * dist;
        Gfx.sphere(c, lx, ly, 6 + Z.comp * 9, "#9CCC65", { ring: "rgba(51,105,30,0.4)" });
      }
      Gfx.sphere(c, rx, ry, 14, "#EF6C00", { ring: "#BF360C" });

      outC.set(`
        <b>Гістотопографічна оцінка експлантата (ЛР № 9):</b> висічка на відносній відстані <b>$r/R = ${fmt(radPos, 2)}$</b> потрапляє у зону <b>«${Z.zoneName}»</b>. Частка клітин, здатних вступати в мітотичний цикл, становить <b>$\\text{MI} = ${fmt(Z.miPct, 1)}\\,\\%$</b>, лаг-фаза дедиференціації триває <b>${fmt(Z.lagDays, 1)} діб</b>, а маса калюсу на 28-му добу досягає <b>${fmt(Z.w28, 0)} мг</b>.
      `);

      // Chart C1: Mitotic index across radius
      const radPts = [];
      for (let r = 0.05; r <= 0.95; r += 0.015) radPts.push([r, evalZone(r).miPct]);
      drawChart(chC1.ctx, chC1.w, chC1.h, {
        x: [0, 1.0], y: [0, 10],
        xl: "Відносний радіус коренеплоду r/R (0 = центр → 1 = перидерма)", yl: "Мітотичний індекс MI, %",
        band: [{ x0: 0.56, x1: 0.68, color: rgba(T.accent, 0.15) }],
        series: [{ pts: radPts, color: T.accent, w: 2.6, fill: rgba(T.accent, 0.10) }],
        marks: [{ x: radPos, y: Z.miPct, r: 5.5, color: "#D97706", label: `${fmt(Z.miPct, 1)} %` }]
      });

      // Chart C2: Growth curves for Cambium vs Phloem vs Xylem
      const ptsCamb = [], ptsPhlo = [], ptsXyl = [];
      const zCamb = evalZone(0.62), zPhlo = evalZone(0.80), zXyl = evalZone(0.20);
      for (let d = 0; d <= 28; d++) {
        const f = (z) => 50 + (z.w28 - 50) / (1 + Math.exp(-(d - (z.lagDays + 9)) / 3.6));
        ptsCamb.push([d, f(zCamb)]);
        ptsPhlo.push([d, f(zPhlo)]);
        ptsXyl.push([d, f(zXyl)]);
      }
      drawChart(chC2.ctx, chC2.w, chC2.h, {
        x: [0, 28], y: [0, 600],
        xl: "Час культивування, діб", yl: "Сира маса калюсу W(t), мг",
        series: [
          { pts: ptsCamb, color: T.accent, w: 2.6 },
          { pts: ptsPhlo, color: "#D97706", w: 2.1 },
          { pts: ptsXyl, color: "#1565C0", w: 1.9, dash: [4, 3] }
        ],
        legend: [
          { label: "Камбіальне кільце (r/R = 0,62)", color: T.accent },
          { label: "Вторинна флоема (r/R = 0,80)", color: "#D97706" },
          { label: "Ксилемна серцевина (r/R = 0,20)", color: "#1565C0" }
        ]
      });
    }

    M.init();
    return {
      stages: [stA, chA1, chA2, stB, chB1, chB2, stC, chC1, chC2],
      frame(dt, time) {
        if (mode === "a") drawA(time);
        else if (mode === "b") drawB(time);
        else drawC(time);
      }
    };
  }
});
})();
