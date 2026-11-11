(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

const EMBRYO_STAGES = [
  { id: 0, name: "1. Одиночна ембріогенна клітина", dayRange: "0–2 доби", sizeUm: 45, desc: "Дрібна ізодіаметрична клітина з густою цитоплазмою, великим ядром, дрібними вакуолями та потовщеною клітинною стінкою з калозою; втрачає плазмодесмові зв'язки з сусідніми клітинами калюсу." },
  { id: 1, name: "2. Проембріогенна маса (ПЕКМ)", dayRange: "3–6 діб", sizeUm: 110, desc: "Компактний багатоклітинний глобулярний комплекс (8–32 клітини), що формується шляхом серії симетричних і асиметричних поділів на середовищі з 2,4-Д, але зупиняється у розвитку до видалення екзогенного ауксину." },
  { id: 2, name: "3. Глобулярний ембріоїд", dayRange: "7–11 діб (без 2,4-Д)", sizeUm: 220, desc: "Після перенесення на середовище без 2,4-Д виділяється зовнішній шар протодерми (майбутній епідерміс) і виникає радіальна симетрія; білки PIN1 створюють два симетричні максимуми ауксину на апікальному полюсі." },
  { id: 3, name: "4. Серцеподібний ембріоїд", dayRange: "12–16 діб", sizeUm: 480, desc: "Перехід від радіальної до білатеральної симетрії: розростання двох сім'ядольних примордіїв, між якими закладається апікальна меристема пагона (плюмула), а на протилежному полюсі — зародковий корінець (радикула) з підвіском (суспензором)." },
  { id: 4, name: "5. Торпедоподібний ембріоїд", dayRange: "17–22 доби", sizeUm: 950, desc: "Інтенсивне осьове видовження гіпокотиля, диференціація замкненого прокамбіального тяжа (провідної системи, не зв'язаної з калюсом!) та накопичення запасних білків і ліпідів." },
  { id: 5, name: "6. Сім'ядольний ембріоїд (проросток)", dayRange: "23–30 діб", sizeUm: 2400, desc: "Повністю сформований біполярний соматичний зародок із зеленими сім'ядолями, точкою росту стебла і первинним корінцем, готовий до конверсії в цілу рослину-регенерант на середовищі 1/2 МС." },
];

App.def(4, {
  cheat: `
    <p class="lead">Реалізація <b>тотипотентності</b> культивованих клітин <i>in vitro</i> — тобто відновлення цілісних рослин-регенерантів із дедиференційованого калюсу чи клітинної суспензії — відбувається двома принципово різними шляхами морфогенезу: <b>непрямим органогенезом (геммагенезом і ризогенезом)</b> за правилом гормонального балансу Скуга—Міллера та <b>соматичним ембріогенезом (ембріоїдогенезом)</b>.</p>

    <h3>1. Гормональна регуляція органогенезу за Скугом і Міллером (ЛР № 15, с. 79–81)</h3>
    <p>У класичних працях Ф. Скуга та К. Міллера (Skoog, Miller, 1957) на культурі серцевинної паренхіми стебла тютюну (<i>Nicotiana tabacum</i> L.) було відкрито фундаментальний закон: напрям морфогенезу визначається не абсолютною концентрацією одного гормону, а <b>кількісним співвідношенням ауксинів до цитокінінів ($[\\text{Ауксин}] / [\\text{Цитокінін}]$)</b> у живильному середовищі:</p>
    <ul>
      <li><b>Високе співвідношення $[\\text{Ауксин}] / [\\text{Цитокінін}] \\gg 1$ (напр., 2,0–3,0 мг/л ІОК або НОК + 0,02–0,1 мг/л кінетину, $R > 10:1$):</b> індукує <b>ризогенез</b> — диференціацію адвентивних (придаткових) коренів із меристематичних центрів калюсу.</li>
      <li><b>Проміжне (збалансоване) співвідношення $[\\text{Ауксин}] / [\\text{Цитокінін}] \\approx 1:1\\dots 4:1$ (напр., 1,0–2,0 мг/л ІОК або 2,4-Д + 0,2–0,5 мг/л кінетину):</b> підтримує безперервну неорганізовану проліферацію клітин — <b>ріст недиференційованого калюсу</b>.</li>
      <li><b>Низьке співвідношення $[\\text{Ауксин}] / [\\text{Цитокінін}] \\ll 1$ (напр., 0,05–0,2 мг/л ІОК або НОК + 1,0–2,0 мг/л 6-БАП чи кінетину, $R < 1:4$):</b> індукує <b>каулогенез (геммагенез)</b> — закладку меристемоїдів (компактних скупчень дрібних клітин із густою цитоплазмою) та диференціацію з них адвентивних стеблових бруньок і пагонів. Надалі ці пагони відокремлюють скальпелем і переносять на середовище для вкорінення (1/2 МС + 0,5 мг/л ІОК або ІМК без цитокінінів).</li>
    </ul>

    <div class="eq">$$R_{\\text{горм}} = \\frac{[\\text{Ауксин}]}{[\\text{Цитокінін}]}, \\qquad \\begin{cases} R_{\\text{горм}} > 10 & \\Rightarrow \\text{Ризогенез (утворення коренів)}, \\\\ 0,4 \\le R_{\\text{горм}} \\le 6 & \\Rightarrow \\text{Неорганізований калюсогенез}, \\\\ R_{\\text{горм}} < 0,3 & \\Rightarrow \\text{Каулогенез (утворення стеблових бруньок)}. \\end{cases}$$</div>

    <h3>2. Соматичний ембріогенез у культурі моркви (ЛР № 16–17, с. 81–85)</h3>
    <p><b>Соматичний ембріогенез (ембріоїдогенез)</b> — це процес формування біполярних зародкоподібних структур (<b>соматичних ембріоїдів</b>) із нестатевих (соматичних) клітин без гаметогенезу та запліднення. Вперше описаний Ф. Стюардом (Steward, 1958) та Дж. Рейнертом у суспензійній і калюсній культурі дикої та посівної моркви (<i>Daucus carota</i> L.).</p>
    <p>На відміну від органогенезу (де спочатку формується уніполярна брунька пагона, тісно зв'язана провідними пучками з калюсом, а корінь доводиться індукувати окремо), <b>соматичний ембріоїд від самого початку є біполярною структурою</b> (має одночасно апікальну меристему пагона — плюмулу, та апікальну меристему кореня — радикулу), оточений власною протодермою, має замкнену прокамбіальну систему і <b>не має судинного зв'язку з материнською калюсною тканиною</b>, тому легко відокремлюється від неї.</p>

    <h4>Двоетапний протокол індукції та розвитку ембріоїдів</h4>
    <ol>
      <li><b>Етап I — Індукція ембріогенних клітин і проембріогенних клітинних мас (ПЕКМ) на середовищі з 2,4-Д (0,5–1,0 мг/л):</b> синтетичний ауксин 2,4-Д викликає асиметричний поділ соматичних клітин і експресію генів родини <i>SERK</i> (Somatic Embryogenesis Receptor Kinase) та <i>LEC</i> (Leafy Cotyledon). Проте в присутності екзогенного 2,4-Д розвиток зупиняється на стадії ПЕКМ та ранньої глобули, оскільки рівномірне насичення тканини 2,4-Д унеможливлює створення ендогенних полярних градієнтів ауксину.</li>
      <li><b>Етап II — Диференціація та дозрівання ембріоїдів на середовищі без ауксину (МС без 2,4-Д):</b> при перенесенні ембріогенного калюсу або суспензії на середовище МС, позбавлене 2,4-Д (але з обов'язковою присутністю відновленого азоту — іонів $\\text{NH}_4^+$ з $\\text{NH}_4\\text{NO}_3$ або амінокислоти L-глутаміну чи гідролізату казеїну!), білки PIN1 встановлюють полярний потік ендогенної ІОК, і ПЕКМ синхронно проходять стадії, ідентичні зиготичному ембріогенезу: <b>глобулярну $\\to$ серцеподібну $\\to$ торпедоподібну $\\to$ сім'ядольну стадію</b>.</li>
    </ol>

    <div class="tblwrap">
      <table class="t bt">
        <caption>Порівняльна характеристика двох шляхів регенерації рослин <i>in vitro</i> (до ЛР № 15–17)</caption>
        <thead>
          <tr><th>Ознака</th><th>Органогенез (геммагенез / ризогенез)</th><th>Соматичний ембріогенез (ембріоїдогенез)</th></tr>
        </thead>
        <tbody>
          <tr><td>Полярність зачатка</td><td>Уніполярний (окремо брунька або окремо корінь)</td><td>Біполярний (одночасно плюмула і радикула на протилежних полюсах)</td></tr>
          <tr><td>Зв'язок із калюсом</td><td>Широка основа, спільні провідні пучки з калюсом</td><td>Провідна система замкнена, судинного зв'язку немає (легко відділяється)</td></tr>
          <tr><td>Походження</td><td>Група клітин меристемоїда (часто химерність)</td><td>Переважно з однієї соматичної клітини (клональна однорідність)</td></tr>
          <tr><td>Гормональний тригер</td><td>Зсув балансу [Ауксин]/[Цитокінін] за Скугом—Міллером</td><td>Індукція на +2,4-Д $\\to$ перенесення на середовище без 2,4-Д (+$\\text{NH}_4^+$)</td></tr>
          <tr><td>Практичне застосування</td><td>Мікроклональне розмноження, регенерація трансформантів</td><td>Масове розмноження у біореакторах, штучне насіння (капсулювання в альгінат)</td></tr>
        </tbody>
      </table>
    </div>

    <details class="bproto">
      <summary>Хід роботи (Лабораторні роботи № 15–17, с. 79–85)</summary>
      <div>
        <ol class="bsteps">
          <li><b>ЛР № 15. Індукція органогенезу (ризогенезу та стеблоутворення) у калюсній культурі тютюну:</b> розділіть пасажований калюс тютюну (<i>Nicotiana tabacum</i> L.) у ламінарному боксі на фрагменти масою 80–100 мг і перенесіть на 3 варіанти середовища МС: Варіант 1 (ризогенне) — 2,0 мг/л ІОК + 0,1 мг/л кінетину; Варіант 2 (калюсогенне) — 1,0 мг/л ІОК + 0,5 мг/л кінетину; Варіант 3 (каулогенне) — 0,1 мг/л ІОК + 2,0 мг/л 6-БАП. Культивуйте на світлі (3000 лк, 16-год фотоперіод, 25 °C) протягом 3–4 тижнів і підрахуйте кількість коренів та стеблових бруньок на експлантат.</li>
          <li><b>ЛР № 16–17. Індукція соматичного ембріогенезу та мікроскопічний аналіз ембріоїдів моркви:</b> візьміть ембріогенний калюс моркви (<i>Daucus carota</i> L.), вирощений на середовищі МС + 1,0 мг/л 2,4-Д, і перенесіть у пробірки або рідке середовище МС <b>без регуляторів росту</b> (0 мг/л 2,4-Д). Через 14–21 добу перенесіть порцію культури препарувальною голкою у краплю води або гліцерину на предметне скло, розгляньте під бінокулярною лупою та мікроскопом і замалюйте глобулярну, серцеподібну, торпедоподібну та сім'ядольну стадії розвитку соматичних зародків.</li>
        </ol>
      </div>
    </details>
  `,
  qa: [
    [
      "Яке співвідношення ауксинів та цитокінінів у живильному середовищі потрібно створити для індукції стеблових бруньок (каулогенезу), а яке — для утворення коренів (ризогенезу)?",
      "<p>За правилом Скуга—Міллера (1957) для індукції <b>стеблових бруньок (каулогенезу)</b> необхідне значне переважання цитокінінів над ауксинами (наприклад, 1–2 мг/л 6-БАП або кінетину та 0,05–0,2 мг/л ІОК чи НОК, співвідношення $[\\text{Ауксин}]/[\\text{Цитокінін}] < 1:4$). Для індукції <b>адвентивних коренів (ризогенезу)</b>, навпаки, потрібне переважання ауксинів над цитокінінами ($2–3\\text{ мг/л}$ ІОК або ІМК при $0–0,1\\text{ мг/л}$ кінетину, співвідношення $> 10:1$).</p>"
    ],
    [
      "Чому для переходу соматичних проембріогенних мас (ПЕКМ) моркви до утворення серцеподібних і торпедоподібних ембріоїдів необхідно обов'язково виключити 2,4-Д із живильного середовища?",
      "<p>Синтетичний ауксин 2,4-Д необхідний лише на першому етапі для дедиференціації клітин та індукції експресії генів ембріогенної компетентності. Проте 2,4-Д погано транспортується полярними переносниками PIN і рівномірно заливає всі клітини глобули. Поки 2,4-Д присутній у середовищі, ембріоїд не може встановити внутрішній полярний градієнт ендогенної ІОК, необхідний для переходу від радіальної симетрії (глобули) до білатеральної симетрії (закладки двох сім'ядольних горбків на серцеподібній стадії).</p>"
    ],
    [
      "За якими анатомо-морфологічними ознаками під мікроскопом можна відрізнити соматичний ембріоїд від адвентивної стеблової бруньки (органогенезу)?",
      "<p>Соматичний ембріоїд є <b>біполярною структурою</b> (має одночасно точку росту пагона з сім'ядолями та зародковий корінець на протилежному кінці), вкритий суцільною протодермою і має <b>замкнену прокамбіальну судинну систему</b>, яка не з'єднана з клітинами калюсу (тому ембріоїд легко відділяється при легкому дотику голкою). Адвентивна брунька є <b>уніполярною</b> (не має кореневого полюса) і міцно зрощена широкою основою та спільними судинними трахеїдними пучками з материнським калюсом.</p>"
    ],
    [
      "Чому соматичний ембріогенез на середовищі Уайта блокується, але успішно відбувається на середовищі Мурасіге—Скуга (МС)?",
      "<p>Критичною умовою індукції та дозрівання соматичних ембріоїдів є наявність у середовищі джерела <b>відновленого азоту</b> — катіонів амонію $\\text{NH}_4^+$ (або амінокислоти L-глутаміну). Середовище МС містить $20,6\\text{ мМ } \\text{NH}_4^+$ (у складі $\\text{NH}_4\\text{NO}_3$), тоді як середовище Уайта містить виключно окиснений нітратний азот ($\\text{NO}_3^-$), якого недостатньо для інтенсивного синтезу ембріоспецифічних білків.</p>"
    ],
    [
      "Що таке «штучне насіння» і на якій стадії розвитку соматичні ембріоїди використовують для його виготовлення?",
      "<p><b>Штучне (синтетичне) насіння</b> — це ізольовані соматичні ембріоїди на пізній <b>торпедоподібній або ранній сім'ядольній стадії</b> (після обробки абсцизовою кислотою [АБК] для індукції стану спокою і накопичення запасних білків), інкапсульовані у захисну гідрогелеву оболонку з альгінату кальцію (іноді з додаванням сахарози, фунгіцидів та ендоспермоподібних поживних речовин), що дозволяє висівати клональний матеріал безпосередньо у теплицю чи поле.</p>"
    ]
  ],
  build({ stageBox, ctrls, below, tabsBox }) {
    let mode = "a";
    const M = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Фазова діаграма Скуга—Міллера (ЛР 15)"],
      ["b", "Б. Соматичний ембріогенез моркви (ЛР 16–17)"]
    ], id => { mode = id; });

    /* ==================== TAB A: SKOOG–MILLER PHASE PLANE (LAB 15) ==================== */
    const A = M.box("a");
    let auxConc = 0.2; // mg/L IAA / NAA (0.02 .. 5.0)
    let cytConc = 2.0; // mg/L BAP / Kinetin (0.02 .. 5.0)
    let lightOn = true; // 16-h photoperiod (needed for greening & shoot buds)

    const stA = new Stage(A.st, { aspect: 1.75, minH: 290, maxH: 420 });
    const rdA = UI.reads(A.st, [
      ["rat", "Співвідношення [Ауксин] / [Цитокінін]"],
      ["path", "Домінуючий шлях морфогенезу"],
      ["shoots", "Адвентивні бруньки / пагони"],
      ["roots", "Адвентивні корені"],
    ]);

    const sAux = UI.slider(A.ct, {
      id: "l4-aux", label: "Концентрація ауксину (ІОК / НОК)", min: 0.02, max: 4.0, step: 0.02, value: auxConc, unit: "мг/л",
      fmt: v => fmt(v, 2), on: v => { auxConc = v; }
    });
    const sCyt = UI.slider(A.ct, {
      id: "l4-cyt", label: "Концентрація цитокініну (6-БАП / Кінетин)", min: 0.02, max: 4.0, step: 0.02, value: cytConc, unit: "мг/л",
      fmt: v => fmt(v, 2), on: v => { cytConc = v; }
    });
    UI.check(A.ct, {
      id: "l4-light", label: "Освітлення 3000 лк (16 год день / 8 год ніч)", value: lightOn,
      on: v => { lightOn = v; }
    });
    UI.buttons(A.ct, [
      { label: "Каулогенез — пагони (0,1 ІОК + 2,0 БАП)", pri: true, on: () => { sAux.set(0.10); auxConc = 0.10; sCyt.set(2.0); cytConc = 2.0; } },
      { label: "Ризогенез — корені (2,5 ІОК + 0,06 Кін.)", on: () => { sAux.set(2.50); auxConc = 2.50; sCyt.set(0.06); cytConc = 0.06; } },
      { label: "Неорганізований калюс (1,2 ІОК + 0,6 Кін.)", on: () => { sAux.set(1.20); auxConc = 1.20; sCyt.set(0.60); cytConc = 0.60; } }
    ]);

    const outA = UI.out(A.bl, "");
    const chRowA = h("div", { class: "charts" }); A.bl.append(chRowA);
    const chA1 = UI.chart(chRowA, "Залежність числа стеблових бруньок і коренів від логарифма lg([Ауксин]/[Цитокінін])");
    const chA2 = UI.chart(chRowA, "Динаміка нагромадження біомаси калюсу та органів упродовж 28 діб (ЛР 15)");

    function evalSkoog(a = auxConc, c = cytConc) {
      const ratio = a / Math.max(0.01, c);
      const logR = Math.log10(ratio);
      const totHorm = a + c;
      const act = totHorm / (0.12 + totHorm);
      // Shoot probability peaks when logR < -0.5 (Cytokinin >> Auxin) and requires light
      const pShoot = act * (1 / (1 + Math.exp((logR + 0.45) * 4.2))) * (lightOn ? 1.0 : 0.32);
      // Root probability peaks when logR > +0.65 (Auxin >> Cytokinin)
      const pRoot = act * (1 / (1 + Math.exp(-(logR - 0.65) * 4.2)));
      // Unorganized callus peaks around logR in [-0.4, +0.6]
      const pCallus = act * Math.exp(-Math.pow((logR - 0.1) / 0.72, 2));
      const nShoots = Math.round(pShoot * 16);
      const nRoots = Math.round(pRoot * 14);
      let path = "Слабкий ріст (дефіцит гормонів)";
      if (totHorm >= 0.15) {
        if (logR < -0.45) path = "Каулогенез (стеблові бруньки і пагони)";
        else if (logR > 0.65) path = "Ризогенез (адвентивні корені)";
        else path = "Проліферація недиференційованого калюсу";
      }
      return { ratio, logR, pShoot, pRoot, pCallus, nShoots, nRoots, path };
    }

    function drawA(time) {
      const { ctx: c, w, h: hh } = stA;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const S = evalSkoog();

      rdA.set("rat", `${fmt(S.ratio, 2)} : 1`, `(lg R = ${fmt(S.logR, 2)})`);
      rdA.set("path", S.path, "");
      rdA.set("shoots", fmt(S.nShoots, 0), "бруньок / експлантат");
      rdA.set("roots", fmt(S.nRoots, 0), "коренів / експлантат");

      // Left: 2D Skoog-Miller Phase Plane ([Cytokinin] on X-axis, [Auxin] on Y-axis)
      const px = 44, py = 26, pw = Math.min(w * 0.44, hh - 64), ph = pw;
      // Draw 3 colored sectors in the square phase plane
      c.save();
      c.beginPath(); c.rect(px, py, pw, ph); c.clip();
      // Upper-left triangle: High Auxin, Low Cytokinin -> Rhizogenesis (Roots)
      c.fillStyle = "rgba(217, 119, 6, 0.16)";
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + pw * 0.48, py); c.lineTo(px, py + ph * 0.85); c.closePath(); c.fill();
      // Middle diagonal band: Callus
      c.fillStyle = "rgba(21, 101, 192, 0.13)";
      c.beginPath();
      c.moveTo(px + pw * 0.48, py); c.lineTo(px + pw, py); c.lineTo(px + pw, py + ph * 0.42);
      c.lineTo(px, py + ph); c.lineTo(px, py + ph * 0.85); c.closePath(); c.fill();
      // Lower-right triangle: High Cytokinin, Low Auxin -> Caulogenesis (Shoots)
      c.fillStyle = "rgba(46, 125, 50, 0.18)";
      c.beginPath(); c.moveTo(px + pw, py + ph * 0.42); c.lineTo(px + pw, py + ph); c.lineTo(px, py + ph); c.closePath(); c.fill();
      c.restore();

      c.strokeStyle = T.rule; c.lineWidth = 1.4;
      c.strokeRect(px, py, pw, ph);
      Gfx.text(c, "РИЗОГЕНЕЗ (корені)", px + 10, py + 20, { size: 10, weight: 700, color: "#D97706" });
      Gfx.text(c, "КАЛЮСОГЕНЕЗ", px + pw * 0.48, py + ph * 0.48, { align: "center", size: 10, weight: 700, color: "#1565C0" });
      Gfx.text(c, "КАУЛОГЕНЕЗ (пагони)", px + pw - 10, py + ph - 12, { align: "right", size: 10, weight: 700, color: "#2E7D32" });
      Gfx.text(c, "Цитокінін (6-БАП / Кінетин), мг/л →", px + pw / 2, py + ph + 18, { align: "center", size: 10.5, color: T.ink });
      c.save();
      c.translate(16, py + ph / 2); c.rotate(-Math.PI / 2);
      Gfx.text(c, "Ауксин (ІОК / НОК), мг/л →", 0, 0, { align: "center", size: 10.5, color: T.ink });
      c.restore();

      // Current operating point marker on phase plane
      const mx = px + clamp(cytConc / 4.0, 0, 1) * pw;
      const my = py + ph - clamp(auxConc / 4.0, 0, 1) * ph;
      Gfx.glow(c, mx, my, 18, T.accent, 0.55);
      c.fillStyle = T.accent; c.beginPath(); c.arc(mx, my, 6, 0, 7); c.fill();
      c.strokeStyle = "#FFF"; c.lineWidth = 2; c.stroke();

      // Right: Culture vessel showing morphogenic response of Tobacco callus explant
      const vx = w * 0.73, vy = 26, vw = Math.min(w * 0.36, 175), vh = hh - 52;
      Gfx.flask(c, vx, vy, vw, vh, 0.32, "rgba(235, 224, 175, 0.52)", {
        wave: 0,
        plug: true,
        label: `Морфогенез: ${S.nShoots} пагонів · ${S.nRoots} коренів`,
        inside(ctx, ly) {
          // 1. Adventitious roots growing DOWN into the agar medium
          const rRoot = rng(501);
          c.strokeStyle = "#F5F0DC"; c.lineWidth = 2.0; c.lineCap = "round";
          for (let r = 0; r < S.nRoots; r++) {
            const rx0 = vx + (rRoot() - 0.5) * 32;
            const len = 16 + S.pRoot * 38 * (0.6 + 0.4 * rRoot());
            const bend = (rRoot() - 0.5) * 22;
            c.beginPath();
            c.moveTo(rx0, ly);
            c.quadraticCurveTo(rx0 + bend * 0.5, ly + len * 0.55, rx0 + bend, ly + len);
            c.stroke();
          }

          // 2. Callus mass sitting on agar surface
          const calCol = lightOn && S.pShoot > 0.25 ? "#66BB6A" : "#C5E1A5";
          const rCal = rng(502);
          for (let k = 0; k < 12; k++) {
            const cxLoc = vx + (rCal() - 0.5) * 44;
            const cyLoc = ly - 4 - rCal() * 14 * (0.6 + S.pCallus * 0.8);
            Gfx.sphere(c, cxLoc, cyLoc, 7 + S.pCallus * 5, calCol, { ring: "rgba(46,125,50,0.4)" });
          }

          // 3. Adventitious shoots with leaves growing UP from meristemoids
          const rShoot = rng(503);
          for (let s = 0; s < S.nShoots; s++) {
            const sx0 = vx + (rShoot() - 0.5) * 40;
            const shH = 18 + S.pShoot * 54 * (0.55 + 0.45 * rShoot());
            const sway = Math.sin(time * 2 + s) * 2.5;
            const shootCol = lightOn ? "#2E7D32" : "#DCE775";
            c.strokeStyle = shootCol; c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(sx0, ly - 6); c.lineTo(sx0 + sway, ly - 6 - shH); c.stroke();
            // Pair of apical leaves
            c.fillStyle = lightOn ? "#43A047" : "#E6EE9C";
            c.beginPath();
            c.ellipse(sx0 + sway - 5, ly - 6 - shH, 5.5, 2.8, -0.4, 0, 7);
            c.ellipse(sx0 + sway + 5, ly - 6 - shH, 5.5, 2.8, 0.4, 0, 7);
            c.fill();
          }
        }
      });

      outA.set(`
        <b>Аналіз гормонального балансу Скуга—Міллера (ЛР № 15):</b> за концентрації ауксину <b>${fmt(auxConc, 2)} мг/л</b> та цитокініну <b>${fmt(cytConc, 2)} мг/л</b> відношення $[\\text{Ауксин}]/[\\text{Цитокінін}] = ${fmt(S.ratio, 2)}:1$ ($\\lg R = ${fmt(S.logR, 2)}$). Домінуючий напрям розвитку: <b>${S.path}</b> (середній вихід — <b>${S.nShoots}</b> стеблових бруньок і <b>${S.nRoots}</b> адвентивних коренів на експлантат).
      `);

      // Chart A1: Morphogenic response curves vs log10(Auxin/Cytokinin)
      const ptsSh = [], ptsRt = [], ptsCa = [];
      for (let lr = -2.0; lr <= 2.0; lr += 0.08) {
        const sh = (1 / (1 + Math.exp((lr + 0.45) * 4.2))) * (lightOn ? 100 : 32);
        const rt = (1 / (1 + Math.exp(-(lr - 0.65) * 4.2))) * 100;
        const ca = Math.exp(-Math.pow((lr - 0.1) / 0.72, 2)) * 100;
        ptsSh.push([lr, sh]);
        ptsRt.push([lr, rt]);
        ptsCa.push([lr, ca]);
      }
      drawChart(chA1.ctx, chA1.w, chA1.h, {
        x: [-2, 2], y: [0, 105],
        xl: "Логарифм співвідношення lg([Ауксин] / [Цитокінін])", yl: "Інтенсивність морфогенезу, %",
        vl: [{ x: S.logR, color: T.ink, label: `lg R = ${fmt(S.logR, 2)}` }],
        series: [
          { pts: ptsSh, color: "#2E7D32", w: 2.6, fill: "rgba(46,125,50,0.10)" },
          { pts: ptsCa, color: "#1565C0", w: 2.2, dash: [4, 3] },
          { pts: ptsRt, color: "#D97706", w: 2.6, fill: "rgba(217,119,6,0.10)" }
        ],
        legend: [
          { label: "Каулогенез (пагони)", color: "#2E7D32" },
          { label: "Неорганізований калюс", color: "#1565C0" },
          { label: "Ризогенез (корені)", color: "#D97706" }
        ]
      });

      // Chart A2: Time course of organ appearance over 28 days
      const tSh = [], tRt = [];
      for (let d = 0; d <= 28; d++) {
        tSh.push([d, S.nShoots / (1 + Math.exp(-(d - 16) / 2.8))]);
        tRt.push([d, S.nRoots / (1 + Math.exp(-(d - 12) / 2.5))]);
      }
      drawChart(chA2.ctx, chA2.w, chA2.h, {
        x: [0, 28], y: [0, 18],
        xl: "Доба культивування на індукційному середовищі", yl: "Кількість органів на експлантат, шт.",
        series: [
          { pts: tSh, color: "#2E7D32", w: 2.5 },
          { pts: tRt, color: "#D97706", w: 2.5 }
        ],
        legend: [
          { label: "Стеблові бруньки (з'являються на 14–18 добу)", color: "#2E7D32" },
          { label: "Адвентивні корені (з'являються на 10–14 добу)", color: "#D97706" }
        ]
      });
    }

    /* ==================== TAB B: SOMATIC EMBRYOGENESIS IN CARROT (LABS 16–17) ==================== */
    const B = M.box("b");
    let dayEmb = 15; // Days after transfer to auxin-free medium (0..28)
    let rem24D = 0.0; // Residual 2,4-D in maturation medium (0..1.0 mg/L; >0.2 blocks transition past globular stage!)
    let nh4mM = 20.6; // Ammonium NH4+ concentration in medium (0..30 mM; White = 0 mM blocks embryogenesis, MS = 20.6 mM optimal)

    const stB = new Stage(B.st, { aspect: 1.75, minH: 290, maxH: 420 });
    const rdB = UI.reads(B.st, [
      ["stg", "Домінуюча стадія ембріоїдів"],
      ["len", "Середня довжина ембріоїда"],
      ["yield", "Вихід зрілих ембріоїдів"],
      ["sym", "Тип симетрії та провідна система"],
    ]);

    const sDayB = UI.slider(B.ct, {
      id: "l4-ed", label: "Доба розвитку на середовищі II (ЛР 16–17)", min: 0, max: 28, step: 0.5, value: dayEmb, unit: "доба",
      fmt: v => fmt(v, 1), on: v => { dayEmb = v; }
    });
    const s24D = UI.slider(B.ct, {
      id: "l4-24d", label: "Залишковий 2,4-Д у середовищі II", min: 0.0, max: 1.0, step: 0.05, value: rem24D, unit: "мг/л",
      fmt: v => fmt(v, 2), on: v => { rem24D = v; }
    });
    const sNh4 = UI.slider(B.ct, {
      id: "l4-nh4", label: "Відновлений азот NH₄⁺ (МС = 20,6 мМ)", min: 0, max: 30, step: 1, value: nh4mM, unit: "мМ",
      fmt: v => fmt(v, 1), on: v => { nh4mM = v; }
    });
    UI.buttons(B.ct, [
      { label: "Глобулярна (9-та доба без 2,4-Д)", on: () => { s24D.set(0); rem24D = 0; sNh4.set(21); nh4mM = 21; sDayB.set(9); dayEmb = 9; } },
      { label: "Серцеподібна (14-та доба)", on: () => { s24D.set(0); rem24D = 0; sNh4.set(21); nh4mM = 21; sDayB.set(14); dayEmb = 14; } },
      { label: "Торпедоподібна (19-та доба)", pri: true, on: () => { s24D.set(0); rem24D = 0; sNh4.set(21); nh4mM = 21; sDayB.set(19); dayEmb = 19; } },
      { label: "Сім'ядольний проросток (26-та доба)", on: () => { s24D.set(0); rem24D = 0; sNh4.set(21); nh4mM = 21; sDayB.set(26); dayEmb = 26; } },
      { label: "Блок на +2,4-Д (0,8 мг/л — тільки ПЕКМ)", on: () => { s24D.set(0.8); rem24D = 0.8; sDayB.set(20); dayEmb = 20; } }
    ]);

    const outB = UI.out(B.bl, "");
    const chRowB = h("div", { class: "charts" }); B.bl.append(chRowB);
    const chB1 = UI.chart(chB1Title());
    const chB2 = UI.chart(chRowB, "Вплив концентрації 2,4-Д та іонів NH₄⁺ на вихід біполярних ембріоїдів");
    function chB1Title() { return chRowB; }
    chB1.el.querySelector("h4").textContent = "Хвилі послідовного проходження стадій соматичного ембріогенезу моркви (%)";

    function calcEmbryo(d = dayEmb) {
      const nFactor = nh4mM / (3.5 + nh4mM); // requires reduced nitrogen NH4+
      const auxBlock = 1 / (1 + Math.pow(rem24D / 0.14, 2.4)); // 2,4-D blocks transition past globular stage!
      // Effective developmental progress index p in [0 .. 5.2]
      const rawProg = (d / 5.2) * nFactor;
      const prog = rawProg <= 1.8 ? rawProg : 1.8 + (rawProg - 1.8) * auxBlock;
      const stIdx = clamp(Math.floor(prog), 0, 5);
      const stObj = EMBRYO_STAGES[stIdx];
      // Stage fractions (Gaussian waves centered at prog = 0.5, 1.3, 2.2, 3.1, 4.0, 4.9)
      const centers = [0.4, 1.25, 2.15, 3.05, 3.95, 4.85];
      const rawW = centers.map(c0 => Math.exp(-Math.pow((prog - c0) / 0.65, 2)));
      const sumW = rawW.reduce((a, b) => a + b, 0) || 1;
      const fracs = rawW.map(w => (w / sumW) * 100);
      const sizeUm = Math.round(45 * Math.pow(2.2, prog));
      const yieldEmbr = Math.round(420 * nFactor * auxBlock);
      const symTxt = prog < 2.5 ? "Радіальна (актиноморфна) · замкнена" : "Білатеральна · біполярна вісь (плюмула—радикула)";
      return { prog, stIdx, stObj, fracs, sizeUm, yieldEmbr, symTxt, auxBlock, nFactor };
    }

    function drawEmbryoShape(c, cx, cy, scale, prog, time, T) {
      c.save();
      c.translate(cx, cy);
      const sway = Math.sin(time * 2.2) * 0.03;
      c.rotate(sway);

      if (prog < 0.9) {
        // Stage 0: Single totipotent cell with dense cytoplasm & nucleus
        Gfx.sphere(c, 0, 0, 28 * scale, "#AED581", { ring: "#33691E", rw: 2.5 });
        Gfx.sphere(c, -4, -3, 10 * scale, "#558B2F");
        Gfx.text(c, "Тотипотентна клітина", 0, 44 * scale, { align: "center", size: 10.5, weight: 700, color: T.ink });
      } else if (prog < 1.85) {
        // Stage 1: Proembryogenic mass (PEM) — cluster of 10-14 dividing cells
        const r = rng(16);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const d = (i < 4 ? 8 : 20) * scale;
          Gfx.sphere(c, Math.cos(a) * d, Math.sin(a) * d, 12 * scale, "#9CCC65", { ring: "#33691E", rw: 1.4 });
        }
        Gfx.text(c, "Проембріогенна маса (ПЕКМ)", 0, 48 * scale, { align: "center", size: 10.5, weight: 700, color: T.ink });
      } else if (prog < 2.65) {
        // Stage 2: Globular embryoid with distinct outer protoderm layer and suspensor
        // Suspensor cells at bottom
        for (let s = 0; s < 3; s++) {
          Gfx.sphere(c, 0, (36 + s * 11) * scale, 6 * scale, "#DCEDC8", { ring: "#689F38" });
        }
        Gfx.sphere(c, 0, 0, 34 * scale, "#7CB342", { ring: "#1B5E20", rw: 2.2 });
        // Protoderm ring
        c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, 30 * scale, 0, 7); c.stroke();
        // Two apical PIN1 auxin maxima dots
        Gfx.glow(c, -14 * scale, -18 * scale, 10, "#FFEE58", 0.8);
        Gfx.glow(c, 14 * scale, -18 * scale, 10, "#FFEE58", 0.8);
        Gfx.text(c, "Глобулярний ембріоїд (протодерма)", 0, 76 * scale, { align: "center", size: 10.5, weight: 700, color: T.ink });
      } else {
        // Stage 3 (Heart), Stage 4 (Torpedo), Stage 5 (Cotyledonary) smooth morphing contour!
        const elong = clamp((prog - 2.65) / 2.2, 0, 1.15); // 0 = heart, 0.55 = torpedo, 1.0 = cotyledonary
        const cotLen = (18 + elong * 36) * scale;
        const bodyH = (32 + elong * 48) * scale;
        const bodyW = (28 - elong * 6) * scale;

        // Suspensor at root tip
        c.fillStyle = "#DCEDC8";
        c.beginPath(); c.arc(0, bodyH * 0.6 + 8 * scale, 5 * scale, 0, 7); c.fill();

        // Main bipolar embryoid body + two cotyledonary lobes
        const grad = c.createLinearGradient(0, -bodyH * 0.5 - cotLen, 0, bodyH * 0.6);
        grad.addColorStop(0, "#2E7D32");
        grad.addColorStop(0.55, "#66BB6A");
        grad.addColorStop(1, "#FFF59D"); // pale radicle pole

        c.fillStyle = grad;
        c.strokeStyle = "#1B5E20";
        c.lineWidth = 2.0;
        c.beginPath();
        // Start at bottom radicle tip
        c.moveTo(0, bodyH * 0.6);
        // Right flank up to right cotyledon tip
        c.bezierCurveTo(bodyW, bodyH * 0.2, bodyW * 1.15, -bodyH * 0.2, (16 + elong * 10) * scale, -bodyH * 0.35 - cotLen);
        // Inner cleft of right cotyledon down to SAM (plumule) notch
        c.bezierCurveTo(6 * scale, -bodyH * 0.35 - cotLen * 0.85, 4 * scale, -bodyH * 0.32, 0, -bodyH * 0.30);
        // Left cotyledon cleft up to left cotyledon tip
        c.bezierCurveTo(-4 * scale, -bodyH * 0.32, -6 * scale, -bodyH * 0.35 - cotLen * 0.85, -(16 + elong * 10) * scale, -bodyH * 0.35 - cotLen);
        // Left flank back to radicle tip
        c.bezierCurveTo(-bodyW * 1.15, -bodyH * 0.2, -bodyW, bodyH * 0.2, 0, bodyH * 0.6);
        c.closePath();
        c.fill();
        c.stroke();

        // Closed Y-shaped procambial vascular strand inside embryoid
        c.strokeStyle = "rgba(255, 241, 118, 0.78)";
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(0, bodyH * 0.42);
        c.lineTo(0, -bodyH * 0.22);
        c.lineTo(-10 * scale, -bodyH * 0.30 - cotLen * 0.65);
        c.moveTo(0, -bodyH * 0.22);
        c.lineTo(10 * scale, -bodyH * 0.30 - cotLen * 0.65);
        c.stroke();

        // Labels for bipolar poles
        Gfx.chip(c, "Плюмула + 2 сім'ядолі", 0, -bodyH * 0.38 - cotLen - 14, { color: "#1B5E20", bg: "rgba(46,125,50,0.15)", size: 9.5 });
        Gfx.chip(c, "Радикула (корінець)", 0, bodyH * 0.6 + 20, { color: "#D97706", bg: "rgba(217,119,6,0.15)", size: 9.5 });
      }
      c.restore();
    }

    function drawB(time) {
      const { ctx: c, w, h: hh } = stB;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const E = calcEmbryo();

      rdB.set("stg", E.stObj.name, `(${E.stObj.dayRange})`);
      rdB.set("len", fmt(E.sizeUm, 0), "мкм");
      rdB.set("yield", fmt(E.yieldEmbr, 0), "ембріоїдів / мл");
      rdB.set("sym", E.symTxt, "");

      // Left: Large high-magnification microscope view of the current somatic embryoid stage
      const mcx = w * 0.28, mcy = hh * 0.50, mr = Math.min(w * 0.25, hh * 0.43);
      Gfx.rr(c, 16, 16, w * 0.50, hh - 32, 14);
      c.fillStyle = Theme.dark ? "#131F18" : "#F5FAF4"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1.2; c.stroke();

      drawEmbryoShape(c, mcx, mcy, Math.min(1.15, mr / 88), E.prog, time, T);

      if (rem24D > 0.22 && dayEmb > 10) {
        Gfx.chip(c, "БЛОК 2,4-Д: зупинка на стадії глобули!", mcx, hh - 28, {
          color: "#C62828", bg: "rgba(198,40,40,0.16)"
        });
      }

      // Right: Developmental progression strip (all 6 stages thumbnail bar)
      const rx = w * 0.54, ry = 16, rw = w * 0.44, rh = hh - 32;
      Gfx.rr(c, rx, ry, rw, rh, 14);
      c.fillStyle = Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(15,42,29,0.03)"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
      Gfx.text(c, "Морфогенетичний ряд соматичного ембріогенезу (ЛР 17):", rx + 12, ry + 18, { size: 11.5, weight: 700, color: T.ink });

      EMBRYO_STAGES.forEach((st, i) => {
        const sy = ry + 34 + i * ((rh - 44) / 6);
        const active = i === E.stIdx;
        Gfx.rr(c, rx + 10, sy, rw - 20, (rh - 56) / 6, 8);
        c.fillStyle = active ? rgba(T.accent, 0.16) : (Theme.dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.6)");
        c.fill();
        if (active) { c.strokeStyle = T.accent; c.lineWidth = 1.6; c.stroke(); }
        Gfx.text(c, st.name, rx + 18, sy + 15, { size: 10.5, weight: active ? 700 : 500, color: active ? T.accent : T.ink });
        Gfx.text(c, `${fmt(E.fracs[i], 0)} %`, rx + rw - 18, sy + 15, { align: "right", size: 10.5, font: "mono", weight: 700, color: active ? T.accent : T.muted });
        // Progress bar of fraction
        Gfx.rr(c, rx + 18, sy + 21, (rw - 36) * (E.fracs[i] / 100), 4, 2);
        c.fillStyle = active ? T.accent : rgba(T.ink, 0.22); c.fill();
      });

      outB.set(`
        <b>Цитоембріологічна характеристика стадії «${E.stObj.name}» (ЛР № 16–17):</b> ${E.stObj.desc}<br/>
        Середній лінійний розмір зародка становить <b>${fmt(E.sizeUm, 0)} мкм</b>, вихід зрілих біполярних ембріоїдів — <b>${fmt(E.yieldEmbr, 0)} шт./мл суспензії</b>.
      `);

      // Chart B1: Developmental stage waves over 0..28 days
      const cols = ["#8D6E63", "#BA68C8", "#1565C0", "#D97706", "#2E7D32", "#00897B"];
      const waveSeries = [1, 2, 3, 4, 5].map(idx => {
        const pts = [];
        for (let d = 0; d <= 28; d += 0.5) pts.push([d, calcEmbryo(d).fracs[idx]]);
        return { pts, color: cols[idx], w: idx === E.stIdx ? 2.8 : 1.8, label: EMBRYO_STAGES[idx].name.slice(3) };
      });
      drawChart(chB1.ctx, chB1.w, chB1.h, {
        x: [0, 28], y: [0, 100],
        xl: "Доба після перенесення на середовище без 2,4-Д", yl: "Частка ембріоїдів на стадії, %",
        vl: [{ x: dayEmb, color: T.ink, label: `Доба ${fmt(dayEmb, 0)}` }],
        series: waveSeries,
        legend: waveSeries.map(s => ({ label: s.label, color: s.color }))
      });

      // Chart B2: Effect of 2,4-D and NH4+ on mature embryoid yield
      const pts24D = [], ptsNH4 = [];
      for (let x = 0; x <= 1.0; x += 0.04) {
        const b = 1 / (1 + Math.pow(x / 0.14, 2.4));
        pts24D.push([x * 30, b * 100]); // scaled to 0..30 axis
      }
      for (let n = 0; n <= 30; n += 1) {
        ptsNH4.push([n, (n / (3.5 + n)) * 100]);
      }
      drawChart(chB2.ctx, chB2.w, chB2.h, {
        x: [0, 30], y: [0, 105],
        xl: "Концентрація NH₄⁺ (мМ) або залишкового 2,4-Д (×30 мг/л)", yl: "Ефективність дозрівання ембріоїдів, %",
        series: [
          { pts: ptsNH4, color: T.accent, w: 2.5 },
          { pts: pts24D, color: "#C62828", w: 2.4, dash: [5, 3] }
        ],
        marks: [
          { x: nh4mM, y: E.nFactor * 100, r: 5, color: T.accent, label: `NH₄⁺: ${fmt(E.nFactor * 100, 0)} %` },
          { x: rem24D * 30, y: E.auxBlock * 100, r: 5, color: "#C62828", label: `2,4-Д: ${fmt(E.auxBlock * 100, 0)} %` }
        ],
        legend: [
          { label: "Стимуляція іонами NH₄⁺ (0–30 мМ)", color: T.accent },
          { label: "Інгібування залишковим 2,4-Д (0–1,0 мг/л)", color: "#C62828" }
        ]
      });
    }

    M.init();
    return {
      stages: [stA, chA1, chA2, stB, chB1, chB2],
      frame(dt, time) {
        if (mode === "a") drawA(time);
        else drawB(time);
      }
    };
  }
});
})();
