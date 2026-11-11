(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

App.def(9, {
  cheat: `
    <p class="lead">
      <b>Культура ізольованих органів</b> (коренів, пагонів, листків, меристем і квіток) та <b>специфічні біотести на фітогормони</b> — фундаментальний розділ експериментальної біотехнології рослин, що дозволяє вивчати трофічні й гормональні взаємодії між органами цілісної рослини та кількісно визначати біологічну активність ендогенних і синтетичних регуляторів росту за калібрувальними кривими «доза — ефект» (М.&nbsp;Д.&nbsp;Мельничук, О.&nbsp;Л.&nbsp;Кляченко, 2014, Тема&nbsp;9, ЛР&nbsp;31–37, с.&nbsp;117–132).
    </p>

    <h3>1. Культура ізольованих коренів та вегетативних органів <i>in vitro</i> (ЛР 31–34)</h3>
    <p>
      Історично першою тривалою культурою органів вищих рослин була культура ізольованих кінчиків коренів томата у рідкому живильному середовищі, здійснена Ф.&nbsp;Уайтом (1934). Ізольований корінь у стерильному рідкому середовищі Уайта або Мурасіге—Скуга (МС) росте за рахунок апікальної кореневої меристеми, галузиться латеральними корінцями й зберігає нормальну анатомічну будову, але виявляє <b>ауксотрофність за вітамінами групи B</b>:
    </p>
    <ul>
      <li>У цілісній рослині корінь отримує з листків сахарозу, <b>тіамін (вітамін B<sub>1</sub>)</b>, <b>піридоксин (B<sub>6</sub>)</b> і <b>нікотинову кислоту (PP)</b>. Тому додавання цих вітамінів (0,1…0,5&nbsp;мг/л) та заліза в хелатній формі (Fe-ЕДТА) до рідкого середовища є суворо обов'язковим для необмеженого росту коренів (ЛР&nbsp;31–32, с.&nbsp;117–121).</li>
      <li>Культуру ізольованих коренів використовують для вивчення симбіозу з бульбочковими бактеріями (<i>Rhizobium</i>) та арбускулярними мікоризними грибами, розмноження облігатних кореневих нематод, а також промислового біосинтезу тропанових алкалоїдів (атропіну, скополаміну), гінзенозидів і шиконіну (особливо у трансформованих <i>Agrobacterium rhizogenes</i> «бородатих коренях» — <i>hairy roots</i>).</li>
    </ul>

    <h3>2. Біотест сім'ядольного калюсу сої <i>Glycine max</i> L. на цитокініни (ЛР 35, с. 124–126)</h3>
    <p>
      <b>Біотест (біологічна проба)</b> — це метод кількісного визначення концентрації та активності фітогормону за величиною специфічної фізіологічної або морфометричної відповіді високочутливого тестового експлантата. Золотим стандартом біотестування <b>цитокінінів</b> є розроблений К.&nbsp;Міллером (1965) метод приросту сирої та сухої маси <b>калюсної тканини сім'ядолей сої (<i>Glycine max</i> L.)</b> (ЛР&nbsp;35, с.&nbsp;124–126).
    </p>
    <p>
      <b>Принцип методу:</b> калюс сім'ядолей сої є <b>цитокінін-залежним (ауксотрофним за цитокінінами)</b>: на поживному середовищі Міллера або МС, що містить постійний фоновий рівень ауксину (α-нафтилоцтову кислоту — НОК 2,0&nbsp;мг/л або ІОК), але позбавлене цитокінінів (<var>C</var> = 0), клітини не діляться і приріст маси практично відсутній (<var>W</var> ≈ <var>W</var><sub>0</sub>). При внесенні у середовище зростаючих концентрацій цитокініну (за протоколом ЛР&nbsp;35: <b>0; 0,1; 0,5&nbsp;мг/л</b>, у ширшому калібрувальному ряду від 10<sup>−3</sup> до 10&nbsp;мг/л) після 21…28 діб інкубації при +26&nbsp;°C у темряві маса калюсу лінійно зростає пропорційно логарифму концентрації гормону lg&nbsp;<var>C</var>.
    </p>

    <div class="eq">
      <var>W</var>(<var>C</var>) = <var>W</var><sub>0</sub> + <span class="fr"><span>(<var>W</var><sub>max</sub> − <var>W</var><sub>0</sub>) · <var>C<sup>h</sup></var></span><span><var>EC</var><sub>50</sub><sup><var>h</var></sup> + <var>C<sup>h</sup></var></span></span> · <span class="fr"><span>1</span><span>1 + (<var>C</var> / <var>K<sub>i</sub></var>)<sup>2</sup></span></span>, &emsp;
      <var>ΔW</var> = <span class="fr"><span><var>W<sub>t</sub></var> − <var>W</var><sub>0</sub></span><span><var>W</var><sub>0</sub></span></span>
      <span class="c">— модифіковане рівняння Гілла—Холдейна для дозової відповіді калюсного біотесту</span>
    </div>
    <dl class="vars">
      <dt>W<sub>0</sub>, W<sub>max</sub></dt><dd>початкова маса експлантата у контролі без цитокініну (≈ 45…60&nbsp;мг) та максимальна маса калюсу в оптимумі (≈ 550…750&nbsp;мг)</dd>
      <dt>EC<sub>50</sub></dt><dd>напівмаксимальна ефективна концентрація цитокініну, що відображає спорідненість до гістидинкіназних рецепторів AHK: ряд біологічної активності має вигляд <b>Зеатин (EC<sub>50</sub> ≈ 0,015&nbsp;мг/л) &gt; 6-БАП (0,045&nbsp;мг/л) &gt; Кінетин (0,12&nbsp;мг/л)</b></dd>
      <dt>K<sub>i</sub></dt><dd>константа супраоптимального інгібування при надлишкових дозах фітогормону (&gt;5&nbsp;мг/л)</dd>
    </dl>

    <h3>3. Біотест паренхіми бульб топінамбура <i>Helianthus tuberosus</i> L. на ауксини (ЛР 36, с. 126–128)</h3>
    <p>
      Більшість паренхімних тканин (зокрема серцевина стебла тютюну чи коренеплід моркви) містять значні запаси власних (ендогенних) ауксинів і здатні до спонтанного калюсогенезу після поранення. На відміну від них, спочиваюча резервна паренхіма бульб <b>топінамбура (земляної груші — <i>Helianthus tuberosus</i> L.)</b> вирізняється двома унікальними властивостями (за Ж.&nbsp;П.&nbsp;Нічем, 1956; ЛР&nbsp;36, с.&nbsp;126–128):
    </p>
    <ul>
      <li><b>Повна відсутність фізіологічно активних вільних ауксинів</b> у зимових бульбах: на середовищі без екзогенного ауксину (<var>C</var> = 0) циліндричні експлантати топінамбура взагалі не діляться (нульовий фоновий ріст).</li>
      <li><b>Висока анатомічна та фізіологічна однорідність</b> запасаючої паренхіми (відсутність камбіального кільця у центральній зоні), що дозволяє висікати корковим свердлом десятки абсолютно ідентичних циліндричних експлантатів.</li>
    </ul>
    <p>
      У лабораторній роботі №&nbsp;36 досліджують індукцію калюсогенезу експлантатів бульб топінамбура за градієнта концентрацій <b>0; 0,5; 1,0; 1,5&nbsp;мг/л</b> трьох регуляторів ауксинового типу: природного індоліл-3-оцтового ауксину (<b>ІОК</b>, легко окиснюється ІОК-оксидазою), синтетичного гербіцидного ауксину (<b>2,4-Д</b>, метаболічно стабільний, найвища калюсогенна активність при 0,5…1,0&nbsp;мг/л) та вітчизняного синтетичного регулятора росту <b>Івіну</b> (<i>N</i>-оксид-2,6-диметилпіридину).
    </p>

    <h3>4. Вплив ІОК, кінетину та гіберелової кислоти (ГК₃) на морфогенез мікроживців (ЛР 37, с. 128–132)</h3>
    <p>
      У лабораторній роботі №&nbsp;37 на одновузлових мікроживцях <b>стевії медової (<i>Stevia rebaudiana</i> Bertoni)</b>, <b>картоплі (<i>Solanum tuberosum</i> L.)</b> або <b>гвоздики ремонтантної (<i>Dianthus caryophyllus</i> L.)</b> порівнюють специфічну морфогенетичну дію трьох класів фітогормонів відносно безгормонального контролю:
    </p>
    <div class="tblwrap">
      <table class="t bt">
        <thead>
          <tr>
            <th>Варіант середовища МС (ЛР 37)</th>
            <th>Домінуючий морфофізіологічний ефект</th>
            <th class="n">Індекс росту пагона I = L<sub>t</sub> / L<sub>0</sub></th>
            <th class="n">Кількість бічних пагонів, шт.</th>
            <th class="n">Укорінення (ризогенез), %</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1. Контроль (МС без гормонів)</td>
            <td>Помірний збалансований ріст одного головного пагона та формування 2–3 коренів за рахунок ендогенних гормонів верхівки.</td>
            <td class="n">3,2–4,0</td>
            <td class="n">1,0</td>
            <td class="n">65–75</td>
          </tr>
          <tr>
            <td>2. МС + ІОК (0,5–1,0 мг/л)</td>
            <td>Стимуляція закладання адвентивних кореневих примордіїв у базальній частині живця (інтенсивний <b>ризогенез</b>, густа коренева система), збереження апікального домінування.</td>
            <td class="n">3,5–4,5</td>
            <td class="n">1,0–1,2</td>
            <td class="n">95–100</td>
          </tr>
          <tr>
            <td>3. МС + Кінетин (0,5–2,0 мг/л)</td>
            <td><b>Зняття апікального домінування:</b> масове пробудження пазушних бруньок і кущіння (множинні пагони), потовщення стебла, <b>повне гальмування ризогенезу</b>.</td>
            <td class="n">2,0–2,8</td>
            <td class="n">4,5–7,5</td>
            <td class="n">0–10</td>
          </tr>
          <tr>
            <td>4. МС + ГК<sub>3</sub> (1,0–5,0 мг/л)</td>
            <td>Різке <b>інтеркалярне видовження міжвузлів</b> (поділ і розтягування клітин субмеристеми), тонке світло-зелене стебло з дрібними листками, слабке укорінення.</td>
            <td class="n">6,5–9,5</td>
            <td class="n">1,0–1,5</td>
            <td class="n">25–40</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3>5. Протоколи лабораторних робіт № 35–37 (с. 124–132)</h3>
    <details class="bproto">
      <summary>Хід роботи — Лабораторна робота № 35. Визначення активності цитокінінів за ростом калюсу сім'ядолей сої (с. 124–126)</summary>
      <div>
        <ol class="bsteps">
          <li>Приготуйте базове агаризоване середовище Міллера або Мурасіге—Скуга (МС) із постійним фоном ауксину (α-НОК 2,0&nbsp;мг/л) у чотирьох варіантах концентрації досліджуваного цитокініну (кінетину або 6-БАП): <b>0 (контроль); 0,1; 0,5&nbsp;мг/л</b> та варіант із невідомим рослинним екстрактом.</li>
          <li>У ламінарному боксі наріжте цитокінін-залежний калюс сім'ядолей сої (<i>Glycine max</i> L.) на однакові трансплантати початковою масою <var>W</var><sub>0</sub> = 50 ± 5&nbsp;мг і висадіть по 4–5 шматочків у кожну колбу чи чашку Петрі.</li>
          <li>Інкубуйте культуру в термостаті при +26&nbsp;°C у темряві протягом 21…28 діб.</li>
          <li>Після завершення інкубації зважте калюсні колонії на торсійних або аналітичних вагах (<var>W<sub>t</sub></var>), обчисліть індекс приросту Δ<var>W</var> = (<var>W<sub>t</sub></var> − <var>W</var><sub>0</sub>) / <var>W</var><sub>0</sub> і за калібрувальним графіком встановіть еквівалентну цитокінінову активність досліджуваного препарату.</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи — Лабораторна робота № 36. Біотест експлантатів бульб топінамбура на ауксини (с. 126–128)</summary>
      <div>
        <ol class="bsteps">
          <li>Очищені здорові бульби топінамбура (<i>Helianthus tuberosus</i> L.) промийте водою з милом, простерилізуйте у 70&nbsp;% етанолі (1&nbsp;хв) і 6&nbsp;% перекисі водню або гіпохлориті натрію (15&nbsp;хв) та тричі промийте стерильною дистильованою водою.</li>
          <li>У ламінарному боксі стерильним корковим свердлом (∅ 6…8&nbsp;мм) висвердліть із центральної запасаючої паренхіми циліндри і наріжте їх скальпелем на однакові диски заввишки 3…4&nbsp;мм (<var>W</var><sub>0</sub> ≈ 120&nbsp;мг).</li>
          <li>Розмістіть експлантати у пробірках із середовищем МС, що містить <b>0 (контроль); 0,5; 1,0; 1,5&nbsp;мг/л</b> ауксину (ІОК, 2,4-Д або регулятора Івін).</li>
          <li>Культивуйте при +25&nbsp;°C у темряві впродовж 21…28 діб, після чого визначте сиру й суху масу новоутвореного калюсу і порівняйте специфічну активність ІОК, 2,4-Д та Івіну.</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи — Лабораторна робота № 37. Дія ІОК, кінетину та ГК₃ на ріст і органогенез мікроживців (с. 128–132)</summary>
      <div>
        <ol class="bsteps">
          <li>Асептичні пробіркові рослини стевії (<i>Stevia rebaudiana</i> Bertoni), картоплі (<i>Solanum tuberosum</i> L.) або гвоздики (<i>Dianthus caryophyllus</i> L.) розживцюйте у ламінарному боксі на одновузлові сегменти початковою довжиною <var>L</var><sub>0</sub> = 10…12&nbsp;мм із парою супротивних або чергових листків.</li>
          <li>Висадіть мікроживці вертикально базальним кінцем у пробірки з 4 варіантами середовища МС: 1) Контроль (без фітогормонів); 2) +ІОК (0,5&nbsp;мг/л); 3) +Кінетин (1,0&nbsp;мг/л); 4) +ГК<sub>3</sub> (2,0&nbsp;мг/л).</li>
          <li>Культивуйте у світловій кімнаті (+24…25&nbsp;°C, 3000&nbsp;лк, фотоперіод 16&nbsp;год) протягом 21…28 діб.</li>
          <li>Виміряйте кінцеву висоту пагонів <var>L<sub>t</sub></var>, розрахуйте <b>індекс росту <var>I</var> = <var>L<sub>t</sub></var> / <var>L</var><sub>0</sub></b>, підрахуйте кількість вузлів, пазушних пагонів, довжину міжвузлів і кількість та довжину адвентивних коренів.</li>
        </ol>
      </div>
    </details>
  `,

  qa: [
    [
      "Чому ізольовані корені у стерильному рідкому середовищі (ЛР 31–32) не здатні рости без додавання тіаміну (B₁), піридоксину (B₆) і нікотинової кислоти (PP)?",
      "<p>У цілісній рослині коренева система є гетеротрофним органом, який не лише отримує сахарозу з фотосинтезуючих листків по флоемі, а й позбавлений здатності самостійно синтезувати тіамінпірофосфат (кофермент піруватдегідрогенази та α-кетоглутаратдегідрогенази циклу Кребса) і піридоксальфосфат (кофермент амінотрансфераз). Тому в культурі ізольованих коренів <i>in vitro</i> без екзогенних вітамінів групи B клітинне дихання та поділ апікальної меристеми зупиняються після 1–2 пасажів.</p>"
    ],
    [
      "Чому калюс сім'ядолей сої Glycine max L. є високоспецифічним біотестом саме на цитокініни і чому зеатин у ньому активніший за кінетин (ЛР 35)?",
      "<p>Клітини сім'ядольного калюсу сої мають генетично закріплену ауксотрофність за цитокінінами: за наявності ауксину (НОК 2&nbsp;мг/л) вони переходять із фази G<sub>1</sub> до мітозу лише після зв'язування екзогенного цитокініну з гістидинкіназними рецепторами AHK. Природний ізопреноїдний цитокінін <i>транс</i>-<b>зеатин</b> має найвищу комплементарність до активного центру рецептора AHK3/AHK4 (EC<sub>50</sub> ≈ 0,015&nbsp;мг/л), за ним іде ароматичний <b>6-БАП</b> (0,045&nbsp;мг/л) та фурфурильний похідний <b>кінетин</b> (0,12&nbsp;мг/л).</p>"
    ],
    [
      "Які фізіологічні переваги роблять паренхіму бульб топінамбура Helianthus tuberosus L. еталонним тест-об'єктом на ауксини (ЛР 36)?",
      "<p>Запасаюча паренхіма зимових бульб топінамбура практично не містить ендогенної ІОК, тому в контролі без ауксину експлантати не дають фонового калюсогенезу (нульовий контроль). Крім того, велика однорідна серцевина бульби без провідних пучків дозволяє висікати десятки анатомічно тотожних циліндрів, що зводить до мінімуму біологічну похибку вимірювань.</p>"
    ],
    [
      "Як відрізняється габітус і морфогенез мікроживців стевії та картоплі на середовищах з ІОК, кінетином та гібереловою кислотою ГК₃ (ЛР 37)?",
      "<p>На середовищі з <b>ІОК</b> стимулюється базальний ризогенез (утворюється потужна коренева система при одному прямостоячому пагоні). <b>Кінетин</b> знімає апікальне домінування верхівкової бруньки, викликаючи масове кущіння пазушних пагонів, але повністю блокує закладку коренів. <b>ГК<sub>3</sub></b> активує інтеркалярні меристеми та розтягування клітин міжвузлів, унаслідок чого індекс росту <var>I</var> = <var>L<sub>t</sub></var> / <var>L</var><sub>0</sub> зростає у 2–2,5 раза, а пагін стає високим, тонким і світло-зеленим.</p>"
    ],
    [
      "Чому при перевищенні оптимальної концентрації фітогормонів у біотестах (>2–5 мг/л для 2,4-Д чи цитокінінів) приріст біомаси калюсу різко падає?",
      "<p>Супраоптимальні (надвисокі) дози екзогенних ауксинів і цитокінінів індукують експресію ферментів біосинтезу <b>етилену</b> (АЦК-синтази), порушують кальцієвий гомеостаз і проникність мембран, викликають десенситизацію рецепторів та накопичення токсичних фенольних сполук, що переводить гормональний сигнал зі стимуляції проліферації у гальмування росту й некроз (гербіцидний ефект).</p>"
    ]
  ],

  build({ stageBox, ctrls, below, tabsBox }) {
    const modes = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Біотест сім'ядольного калюсу сої на цитокініни (ЛР 35)"],
      ["b", "Б. Біотест бульб топінамбура на ауксини (ЛР 36)"],
      ["c", "В. Дія ІОК, кінетину та ГК₃ на мікроживці (ЛР 31–34, 37)"]
    ], () => { dirty = true; });

    let dirty = true;

    /* ======================================================================
       TAB A: SOYBEAN COTYLEDON CALLUS BIOASSAY FOR CYTOKININS (LAB 35)
       ====================================================================== */
    const A = modes.box("a");
    const stA = new Stage(A.st, { aspect: 16 / 10, minH: 295, maxH: 455, tag: "ЛР 35 · Калюсний біотест сім'ядолей сої Glycine max L. (фон: α-НОК 2,0 мг/л, 28 діб)", minW: 580 });

    const CYTO_DB = {
      zeatin:  { name: "Зеатин (природний ізопреноїдний)", ec50: 0.016, wMax: 740, ki: 6.5, col: "#2C7A4D" },
      bap:     { name: "6-БАП (6-бензиламінопурин)",      ec50: 0.048, wMax: 660, ki: 5.2, col: "#2A6A93" },
      kinetin: { name: "Кінетин (6-фурфуриламінопурин)",  ec50: 0.130, wMax: 580, ki: 4.8, col: "#C77A12" }
    };

    const stateA = {
      cyto: "kinetin",  // "zeatin" | "bap" | "kinetin"
      conc: 0.50,       // Концентрація цитокініну C (0..5.0 мг/л; точки ЛР 35: 0, 0.1, 0.5 мг/л)
      w0: 50,           // Початкова маса експлантата W0 (30..80 мг)
      unkW: 410         // Маса калюсу на невідомому екстракті для зворотного розрахунку (100..650 мг)
    };

    UI.select(A.ct, {
      id: "l9-cyto", label: "Досліджуваний цитокінін (ЛР 35)",
      options: Object.entries(CYTO_DB).map(([k, v]) => [k, v.name]),
      value: stateA.cyto,
      on: v => { stateA.cyto = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l9-conc", label: "Концентрація цитокініну C", min: 0.0, max: 5.0, step: 0.05, value: stateA.conc, unit: "мг/л",
      fmt: v => fmt(v, 2), on: v => { stateA.conc = v; dirty = true; }
    });
    UI.buttons(A.ct, [
      { label: "0 мг/л (Контроль)", on: () => setConcA(0.0) },
      { label: "0,1 мг/л (ЛР 35)", on: () => setConcA(0.10) },
      { label: "0,5 мг/л (ЛР 35)", pri: true, on: () => setConcA(0.50) },
      { label: "4,0 мг/л (Надлишок)", on: () => setConcA(4.0) }
    ]);
    function setConcA(v) {
      const el = $("#l9-conc", A.ct);
      if (el) { el.value = v; el.dispatchEvent(new Event("input")); }
    }

    UI.slider(A.ct, {
      id: "l9-w0", label: "Початкова маса трансплантата W₀", min: 30, max: 80, step: 5, value: stateA.w0, unit: "мг",
      fmt: v => fmt(v, 0), on: v => { stateA.w0 = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l9-unk", label: "Маса калюсу у дослідному екстракті W_х", min: 90, max: 620, step: 10, value: stateA.unkW, unit: "мг",
      fmt: v => fmt(v, 0), on: v => { stateA.unkW = v; dirty = true; }
    });

    const outA = UI.out(A.ct, "");

    const rdA = UI.reads(A.bl, [
      ["wt", "Кінцева сира маса калюсу W_t"],
      ["dw", "Індекс приросту ΔW = (W_t − W₀)/W₀"],
      ["ec50", "Поріг напівнасичення EC₅₀"],
      ["c015", "Маса при 0 / 0,1 / 0,5 мг/л (за ЛР 35)"],
      ["cunk", "Еквівалентна концентрація в екстракті C_х"]
    ]);

    const chRowA = h("div", { class: "charts" });
    A.bl.append(chRowA);
    const chA1 = UI.chart(chRowA, "Калібрувальні криві доза—ефект W(C) для зеатину, 6-БАП і кінетину (логарифмічна шкала lg C)", { aspect: 1.85, minH: 195, maxH: 270 });
    const chA2 = UI.chart(chRowA, "Порівняння приросту калюсу сої у стандартних точках практикуму (0; 0,1; 0,5 мг/л, ЛР 35)", { aspect: 1.85, minH: 195, maxH: 270 });

    function massCyto(cytoKey, C, w0 = stateA.w0) {
      const p = CYTO_DB[cytoKey];
      const base = w0 * 1.18; // slight hydration swelling at C = 0
      if (C <= 1e-6) return base;
      const h = 1.15;
      const stim = (p.wMax - base) * Math.pow(C, h) / (Math.pow(p.ec50, h) + Math.pow(C, h));
      const inhib = 1 / (1 + Math.pow(C / p.ki, 2.1));
      return base + stim * inhib;
    }

    function solveUnkC(cytoKey, targetW) {
      const p = CYTO_DB[cytoKey];
      const base = stateA.w0 * 1.18;
      if (targetW <= base + 5) return 0;
      const span = Math.max(20, p.wMax * 0.92 - base);
      const frac = clamp((targetW - base) / span, 0.01, 0.98);
      return p.ec50 * Math.pow(frac / (1 - frac), 1 / 1.15);
    }

    function drawA() {
      const curP = CYTO_DB[stateA.cyto];
      const Wt = massCyto(stateA.cyto, stateA.conc);
      const dW = (Wt - stateA.w0) / stateA.w0;
      const wAt0 = massCyto(stateA.cyto, 0);
      const wAt01 = massCyto(stateA.cyto, 0.1);
      const wAt05 = massCyto(stateA.cyto, 0.5);
      const cEq = solveUnkC(stateA.cyto, stateA.unkW);

      rdA.set("wt", fmt(Wt, 0), "мг");
      rdA.set("dw", fmt(dW, 2), `разів (+${fmt(dW * 100, 0)} %)`);
      rdA.set("ec50", fmt(curP.ec50, 3), "мг/л");
      rdA.set("c015", `${fmt(wAt0, 0)} / ${fmt(wAt01, 0)} / ${fmt(wAt05, 0)}`, "мг");
      rdA.set("cunk", fmt(cEq, 3), `мг/л екв. (${stateA.cyto})`);

      outA.el.className = "bout " + (stateA.conc > 3.0 ? "warn" : stateA.conc === 0 ? "warn" : "good");
      outA.set(
        `<b>Біотест сім'ядольного калюсу сої (ЛР 35, с. 124–126):</b> для препарату <b>${curP.name}</b> при <code>C = ${fmt(stateA.conc, 2)} мг/л</code> сира маса калюсу зростає з <code>W₀ = ${stateA.w0} мг</code> до <b>W<sub>t</sub> = ${fmt(Wt, 0)} мг</b> (індекс приросту <b>ΔW = ${fmt(dW, 2)}</b>). ` +
        `За калібрувальною кривою дослідний екстракт, що дав масу <code>W_х = ${stateA.unkW} мг</code>, містить <b>C<sub>х</sub> ≈ ${fmt(cEq, 3)} мг/л</b> у перерахунку на ${curP.name.split(" ")[0].toLowerCase()}.`
      );

      // Draw Stage A: 4 Petri dishes/flasks corresponding to 0 mg/L, 0.1 mg/L, 0.5 mg/L, and Current/Extract
      stA.clear();
      const c = stA.ctx, W = stA.W, H = stA.H, T = Theme.c;
      Gfx.text(c, `Культура калюсу сім'ядолей сої (Glycine max L.) на середовищі з 2,0 мг/л α-НОК + ${curP.name}`, W / 2, 22, { align: "center", size: 12, weight: 700, color: T.ink });

      const dishes = [
        { lbl: "Контроль (0 мг/л)", cVal: 0, wVal: wAt0, sub: `W = ${fmt(wAt0, 0)} мг (ΔW = ${fmt((wAt0 - stateA.w0) / stateA.w0, 2)})` },
        { lbl: "0,1 мг/л (ЛР 35)", cVal: 0.1, wVal: wAt01, sub: `W = ${fmt(wAt01, 0)} мг (ΔW = ${fmt((wAt01 - stateA.w0) / stateA.w0, 2)})` },
        { lbl: "0,5 мг/л (ЛР 35)", cVal: 0.5, wVal: wAt05, sub: `W = ${fmt(wAt05, 0)} мг (ΔW = ${fmt((wAt05 - stateA.w0) / stateA.w0, 2)})` },
        { lbl: `Варіант (${fmt(stateA.conc, 2)} мг/л)`, cVal: stateA.conc, wVal: Wt, sub: `W = ${fmt(Wt, 0)} мг (ΔW = ${fmt(dW, 2)})`, hi: true }
      ];

      const dR = Math.min(58, W * 0.105);
      const cy = H * 0.48;

      dishes.forEach((d, idx) => {
        const cx = W * (0.14 + idx * 0.24);
        Gfx.petri(c, cx, cy, dR, d.hi ? (Theme.dark ? "#203528" : "#DFEFE2") : (Theme.dark ? "#1E2A22" : "#E8EFE6"), {
          inside(ctx) {
            // 4 soybean cotyledon callus explants in each dish
            const rad = 5.5 + Math.sqrt(Math.max(0, d.wVal - 30)) * 0.62;
            const col = d.cVal > 3.2 ? "#9E7840" : d.cVal === 0 ? "#C9BE8E" : mixc("#C9BE8E", "#529E62", clamp(d.wVal / 650, 0.2, 1));
            for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
              const kx = cx + dx * dR * 0.40;
              const ky = cy + dy * dR * 0.40;
              for (let lobe = 0; lobe < 5; lobe++) {
                const a = lobe * 1.25 + idx;
                Gfx.sphere(ctx, kx + Math.cos(a) * rad * 0.28, ky + Math.sin(a) * rad * 0.28, rad * 0.68, col);
              }
            }
          }
        });
        Gfx.text(c, d.lbl, cx, cy - dR - 14, { align: "center", size: 11, weight: 700, color: d.hi ? T.chl : T.ink });
        Gfx.chip(c, d.sub, cx, cy + dR + 18, { align: "center", size: 10, bg: d.hi ? T["chl-soft"] : T.sheet, fg: d.hi ? T.chl : T.ink });
      });

      Gfx.text(c, "Ряд специфічної цитокінінової активності у біотесті сої: Зеатин (EC₅₀ ≈ 0,016 мг/л) > 6-БАП (0,048 мг/л) > Кінетин (0,13 мг/л)", W / 2, H - 14, { align: "center", size: 11, color: T.muted });

      // Chart A1: Log dose-response curves for Zeatin, 6-BAP, Kinetin (C from 0.002 to 10 mg/L)
      const ptsZ = [], ptsB = [], ptsK = [];
      for (let e = -2.7; e <= 1.0; e += 0.1) {
        const cVal = Math.pow(10, e);
        ptsZ.push([cVal, massCyto("zeatin", cVal)]);
        ptsB.push([cVal, massCyto("bap", cVal)]);
        ptsK.push([cVal, massCyto("kinetin", cVal)]);
      }
      const markC = clamp(stateA.conc, 0.002, 10);
      drawChart(chA1, {
        x: [0.002, 10], y: [0, 800], xlog: true,
        xl: "Концентрація цитокініну C, мг/л (лог. шкала)",
        yl: "Сира маса калюсу W_t, мг",
        hl: [{ y: stateA.unkW, color: T.antho, dash: [3, 3], label: `Екстракт W_x = ${stateA.unkW} мг` }],
        vl: cEq > 0.002 ? [{ x: clamp(cEq, 0.002, 10), color: T.antho, dash: [3, 3], label: `C_x≈${fmt(cEq, 2)}` }] : [],
        series: [
          { pts: ptsZ, color: T.chl, w: stateA.cyto === "zeatin" ? 2.8 : 1.8 },
          { pts: ptsB, color: T.data, w: stateA.cyto === "bap" ? 2.8 : 1.8 },
          { pts: ptsK, color: T.carot, w: stateA.cyto === "kinetin" ? 2.8 : 1.8 }
        ],
        marks: [
          { x: markC, y: Wt, color: curP.col, label: `${fmt(Wt, 0)} мг` }
        ],
        legend: [
          { label: "Зеатин", color: T.chl },
          { label: "6-БАП", color: T.data },
          { label: "Кінетин", color: T.carot }
        ]
      });

      // Chart A2: Textbook concentrations bar chart (0; 0.1; 0.5 mg/L + Current)
      drawChart(chA2, {
        x: [0.4, 4.6], y: [0, 800],
        xt: [1, 2, 3, 4],
        xfmt: v => ["", "0 мг/л", "0,1 мг/л", "0,5 мг/л", `Поточна (${fmt(stateA.conc, 1)})`][Math.round(v)] || "",
        yl: "Сира маса калюсу сої W_t, мг",
        series: [
          {
            bars: true, bw: 34, color: alpha(curP.col, 0.82),
            pts: [[1, wAt0], [2, wAt01], [3, wAt05], [4, Wt]]
          }
        ],
        marks: [
          { x: 1, y: wAt0, color: curP.col, label: `${fmt(wAt0, 0)}` },
          { x: 2, y: wAt01, color: curP.col, label: `${fmt(wAt01, 0)}` },
          { x: 3, y: wAt05, color: curP.col, label: `${fmt(wAt05, 0)}` },
          { x: 4, y: Wt, color: T.ink, label: `${fmt(Wt, 0)} мг` }
        ]
      });
    }

    /* ======================================================================
       TAB B: JERUSALEM ARTICHOKE TUBER BIOASSAY FOR AUXINS (LAB 36)
       ====================================================================== */
    const B = modes.box("b");
    const stB = new Stage(B.st, { aspect: 16 / 10, minH: 295, maxH: 455, tag: "ЛР 36 · Біотест циліндричних експлантатів бульб топінамбура Helianthus tuberosus L. на ауксини", minW: 580 });

    const AUX_DB = {
      d24:  { name: "2,4-Д (2,4-дихлорфеноксиоцтова кислота)", ec50: 0.22, wMax: 640, ki: 2.2, col: "#2C7A4D" },
      iaa:  { name: "ІОК (β-індоліл-3-оцтова кислота)",        ec50: 0.48, wMax: 520, ki: 3.8, col: "#2A6A93" },
      ivin: { name: "Івін (N-оксид-2,6-диметилпіридину)",      ec50: 0.38, wMax: 470, ki: 3.2, col: "#C77A12" }
    };

    const stateB = {
      aux: "d24",     // "d24" | "iaa" | "ivin"
      conc: 1.0,      // Концентрація (0..2.5 мг/л; точки ЛР 36: 0; 0.5; 1.0; 1.5 мг/л)
      days: 24        // Тривалість інкубації (7..28 діб)
    };

    UI.select(B.ct, {
      id: "l9-aux", label: "Регулятор ауксинового типу (ЛР 36, с. 127)",
      options: Object.entries(AUX_DB).map(([k, v]) => [k, v.name]),
      value: stateB.aux,
      on: v => { stateB.aux = v; dirty = true; }
    });
    UI.slider(B.ct, {
      id: "l9-aconc", label: "Концентрація регулятора C", min: 0.0, max: 2.5, step: 0.1, value: stateB.conc, unit: "мг/л",
      fmt: v => fmt(v, 1), on: v => { stateB.conc = v; dirty = true; }
    });
    UI.buttons(B.ct, [
      { label: "0 мг/л", on: () => setConcB(0.0) },
      { label: "0,5 мг/л", on: () => setConcB(0.5) },
      { label: "1,0 мг/л", pri: true, on: () => setConcB(1.0) },
      { label: "1,5 мг/л", on: () => setConcB(1.5) }
    ]);
    function setConcB(v) {
      const el = $("#l9-aconc", B.ct);
      if (el) { el.value = v; el.dispatchEvent(new Event("input")); }
    }
    UI.slider(B.ct, {
      id: "l9-adays", label: "Тривалість культивування в темряві", min: 7, max: 28, step: 1, value: stateB.days, unit: "діб",
      fmt: v => fmt(v, 0), on: v => { stateB.days = v; dirty = true; }
    });

    const outB = UI.out(B.ct, "");

    const rdB = UI.reads(B.bl, [
      ["w0b", "Початкова маса циліндра W₀ (контроль C=0)"],
      ["wtb", "Маса експлантата за поточної C"],
      ["dwb", "Відносний приріст калюсу ΔW"],
      ["row4", "Ряд ЛР 36 (0 / 0,5 / 1,0 / 1,5 мг/л)"],
      ["dry", "Суха речовина калюсу (~8,5 %)"]
    ]);

    const chRowB = h("div", { class: "charts" });
    B.bl.append(chRowB);
    const chB1 = UI.chart(chRowB, "Криві доза—ефект приросту паренхіми бульб топінамбура для 2,4-Д, ІОК та Івіну (ЛР 36)", { aspect: 1.85, minH: 195, maxH: 270 });
    const chB2 = UI.chart(chRowB, "Приріст маси експлантатів у 4 варіантах концентрацій за протоколом (0; 0,5; 1,0; 1,5 мг/л)", { aspect: 1.85, minH: 195, maxH: 270 });

    function massArtichoke(auxKey, C, days = stateB.days) {
      const p = AUX_DB[auxKey];
      const w0 = 120; // mg initial parenchymal cylinder
      if (C <= 1e-4) return w0 + 4; // strictly zero autonomous division in H. tuberosus!
      const timeFac = 1 - Math.exp(-Math.pow(days / 16, 1.5));
      const stim = (p.wMax - w0) * Math.pow(C, 1.45) / (Math.pow(p.ec50, 1.45) + Math.pow(C, 1.45));
      const inhib = 1 / (1 + Math.pow(C / p.ki, 2.6));
      return w0 + stim * inhib * timeFac;
    }

    function drawB() {
      const p = AUX_DB[stateB.aux];
      const w0 = 120;
      const Wt = massArtichoke(stateB.aux, stateB.conc);
      const dW = (Wt - w0) / w0;
      const w00 = massArtichoke(stateB.aux, 0.0);
      const w05 = massArtichoke(stateB.aux, 0.5);
      const w10 = massArtichoke(stateB.aux, 1.0);
      const w15 = massArtichoke(stateB.aux, 1.5);

      rdB.set("w0b", "120 → 124", "мг (нульовий автономий ріст!)");
      rdB.set("wtb", fmt(Wt, 0), "мг");
      rdB.set("dwb", fmt(dW, 2), `разів (+${fmt(dW * 100, 0)} %)`);
      rdB.set("row4", `${fmt(w00, 0)} / ${fmt(w05, 0)} / ${fmt(w10, 0)} / ${fmt(w15, 0)}`, "мг");
      rdB.set("dry", fmt(Wt * 0.085, 1), "мг сух. реч.");

      outB.el.className = "bout " + (stateB.conc === 0 ? "warn" : stateB.conc > 1.8 ? "warn" : "good");
      outB.set(
        `<b>Біотест паренхіми бульб топінамбура (<i>Helianthus tuberosus</i> L., ЛР 36, с. 126–128):</b> завдяки повній відсутності ендогенних ауксинів у контролі (<code>0 мг/л</code>) циліндричний експлантат зберігає початкову форму (<b>124 мг</b>). ` +
        `При внесенні <b>${p.name}</b> у дозі <code>${fmt(stateB.conc, 1)} мг/л</code> на ${stateB.days}-ту добу маса калюсу сягає <b>${fmt(Wt, 0)} мг</b> (ΔW = <b>${fmt(dW, 2)}</b>).`
      );

      // Draw Stage B: 4 test tubes with Jerusalem artichoke tuber cylinders at 0, 0.5, 1.0, 1.5 mg/L
      stB.clear();
      const c = stB.ctx, W = stB.W, H = stB.H, T = Theme.c;
      Gfx.text(c, `Експлантати бульб топінамбура (H. tuberosus L.) за градієнта ${p.name} (0; 0,5; 1,0; 1,5 мг/л)`, W / 2, 22, { align: "center", size: 12, weight: 700, color: T.ink });

      const doses = [0.0, 0.5, 1.0, 1.5];
      const tw = Math.min(76, W * 0.14);
      const th = H * 0.68;
      const ty = H * 0.14;

      doses.forEach((dVal, idx) => {
        const tx = W * (0.14 + idx * 0.24) - tw / 2;
        const wCur = massArtichoke(stateB.aux, dVal);
        const expScale = Math.sqrt(wCur / 120);
        const isNear = Math.abs(stateB.conc - dVal) < 0.22;

        Gfx.vial(c, tx, ty, tw, th, 0.28, Theme.dark ? "rgba(195,215,195,0.22)" : "rgba(224,236,218,0.78)", {
          plug: true,
          label: `${fmt(dVal, 1)} мг/л (${fmt(wCur, 0)} мг)`,
          inside(ctx, ly) {
            const cx = tx + tw / 2;
            const cw = 20 * expScale;
            const ch = 12 * expScale;
            if (dVal === 0) {
              // Crisp unproliferated parenchymal cylinder in control!
              Gfx.rr(ctx, cx - 11, ly - 13, 22, 14, 2);
              ctx.fillStyle = "#E5DCA8";
              ctx.fill();
              ctx.strokeStyle = "#9C8D52";
              ctx.lineWidth = 1.2;
              ctx.stroke();
            } else {
              // Proliferating bumpy callus crown growing from cylinder
              for (let k = 0; k < 7; k++) {
                const a = (k / 7) * Math.PI * 2;
                const kx = cx + Math.cos(a) * cw * 0.35;
                const ky = ly - ch * 0.55 + Math.sin(a) * ch * 0.35;
                Gfx.sphere(ctx, kx, ky, cw * 0.44, mixc("#E5DCA8", "#8AB864", clamp((wCur - 120) / 480, 0.15, 0.95)));
              }
            }
          }
        });

        if (isNear) {
          Gfx.chip(c, "Обраний рівень", tx + tw / 2, ty - 20, { align: "center", size: 9.5, bg: T["chl-soft"], fg: T.chl });
        }
      });

      // Chart B1: Dose-response curves for 2,4-D, IAA, and Ivin
      const pts24D = [], ptsIAA = [], ptsIvin = [];
      for (let cVal = 0; cVal <= 2.5; cVal += 0.05) {
        pts24D.push([cVal, massArtichoke("d24", cVal)]);
        ptsIAA.push([cVal, massArtichoke("iaa", cVal)]);
        ptsIvin.push([cVal, massArtichoke("ivin", cVal)]);
      }
      drawChart(chB1, {
        x: [0, 2.5], y: [100, 680],
        xl: "Концентрація регулятора росту C, мг/л",
        yl: "Сира маса експлантата W_t, мг",
        vl: [{ x: stateB.conc, color: T.ink, dash: [3, 3], label: `C = ${fmt(stateB.conc, 1)}` }],
        series: [
          { pts: pts24D, color: T.chl, w: stateB.aux === "d24" ? 2.8 : 1.8 },
          { pts: ptsIAA, color: T.data, w: stateB.aux === "iaa" ? 2.8 : 1.8 },
          { pts: ptsIvin, color: T.carot, w: stateB.aux === "ivin" ? 2.8 : 1.8 }
        ],
        marks: [
          { x: stateB.conc, y: Wt, color: p.col, label: `${fmt(Wt, 0)} мг` }
        ],
        legend: [
          { label: "2,4-Д", color: T.chl },
          { label: "ІОК", color: T.data },
          { label: "Івін", color: T.carot }
        ]
      });

      // Chart B2: Bar chart at textbook concentrations (0; 0.5; 1.0; 1.5 mg/L)
      drawChart(chB2, {
        x: [0.4, 4.6], y: [0, 680],
        xt: [1, 2, 3, 4],
        xfmt: v => ["", "0 (Контроль)", "0,5 мг/л", "1,0 мг/л", "1,5 мг/л"][Math.round(v)] || "",
        yl: "Сира маса калюсу топінамбура, мг",
        series: [
          {
            bars: true, bw: 34, color: alpha(p.col, 0.82),
            pts: [[1, w00], [2, w05], [3, w10], [4, w15]]
          }
        ],
        marks: [
          { x: 1, y: w00, color: p.col, label: `${fmt(w00, 0)}` },
          { x: 2, y: w05, color: p.col, label: `${fmt(w05, 0)}` },
          { x: 3, y: w10, color: p.col, label: `${fmt(w10, 0)}` },
          { x: 4, y: w15, color: p.col, label: `${fmt(w15, 0)}` }
        ]
      });
    }

    /* ======================================================================
       TAB C: IAA, KINETIN & GA3 EFFECTS ON MICROCUTTINGS (LABS 31-34, 37)
       ====================================================================== */
    const C = modes.box("c");
    const stC = new Stage(C.st, { aspect: 16 / 10, minH: 300, maxH: 460, tag: "ЛР 37 · Порівняльна морфометрія мікроживців: Контроль, +ІОК, +Кінетин, +ГК₃", minW: 580 });

    const SPECIES_DB = {
      stevia:    { name: "Стевія медова (Stevia rebaudiana Bertoni)", l0: 12, kMul: 6.2, gaBoost: 2.35 },
      potato:    { name: "Картопля (Solanum tuberosum L.)",           l0: 14, kMul: 4.8, gaBoost: 2.55 },
      carnation: { name: "Гвоздика ремонтантна (Dianthus caryophyllus L.)", l0: 11, kMul: 5.6, gaBoost: 2.15 }
    };

    const stateC = {
      sp: "stevia",   // "stevia" | "potato" | "carnation"
      doseScale: 1.0, // Відносна доза фітогормонів (0.2..2.5x від норми)
      days: 24,       // Час культивування (0..28 діб)
      metric: "idx"   // "idx" (Індекс росту I = Lt/L0 та міжвузля) | "org" (Пагони та корені)
    };

    UI.select(C.ct, {
      id: "l9-sp", label: "Вид рослини-регенеранта (ЛР 37, с. 129)",
      options: Object.entries(SPECIES_DB).map(([k, v]) => [k, v.name]),
      value: stateC.sp,
      on: v => { stateC.sp = v; dirty = true; }
    });
    UI.slider(C.ct, {
      id: "l9-cdays", label: "Тривалість культивування t", min: 2, max: 28, step: 1, value: stateC.days, unit: "діб",
      fmt: v => fmt(v, 0), on: v => { stateC.days = v; dirty = true; }
    });
    UI.slider(C.ct, {
      id: "l9-cdose", label: "Кратність концентрації гормонів", min: 0.25, max: 2.5, step: 0.25, value: stateC.doseScale, unit: "× норми",
      fmt: v => fmt(v, 2), on: v => { stateC.doseScale = v; dirty = true; }
    });
    UI.seg(C.ct, {
      label: "Показник на другому графіку",
      options: [
        ["idx", "Індекс росту I = L_t / L₀"],
        ["org", "Кількість пагонів і коренів"]
      ],
      value: stateC.metric,
      on: v => { stateC.metric = v; dirty = true; }
    });

    const outC = UI.out(C.ct, "");

    const rdC = UI.reads(C.bl, [
      ["ctrl", "1. Контроль (I = L_t/L₀ · коренів)"],
      ["iaa", "2. +ІОК (ризогенез · коренів)"],
      ["kin", "3. +Кінетин (кущіння · бічних пагонів)"],
      ["ga3", "4. +ГК₃ (видовження · I = L_t/L₀)"]
    ]);

    const chRowC = h("div", { class: "charts" });
    C.bl.append(chRowC);
    const chC1 = UI.chart(chRowC, "Динаміка висоти головного пагона L(t) у чотирьох варіантах досліду впродовж 28 діб", { aspect: 1.85, minH: 195, maxH: 270 });
    const chC2 = UI.chart(chRowC, "Порівняльна морфограма варіантів (Контроль, +ІОК, +Кінетин, +ГК₃, ЛР 37)", { aspect: 1.85, minH: 195, maxH: 270 });

    function calcMorphC(days = stateC.days) {
      const sp = SPECIES_DB[stateC.sp];
      const L0 = sp.l0; // mm
      const prog = 1 - Math.exp(-Math.pow(days / 15, 1.35));
      const dFac = stateC.doseScale / (0.35 + 0.65 * stateC.doseScale);

      // 1. Control (hormone-free MS):
      const ctrl = {
        L: L0 * (1 + 2.7 * prog),
        shoots: 1.0,
        roots: 3.2 * prog,
        rootLen: 22 * prog,
        nodes: Math.round(1 + 3.5 * prog)
      };
      // 2. +IAA (0.5 mg/L): strong adventitious rhizogenesis!
      const iaa = {
        L: L0 * (1 + 3.1 * prog * dFac),
        shoots: 1.1,
        roots: (8.5 + 3.5 * stateC.doseScale) * prog,
        rootLen: 38 * prog,
        nodes: Math.round(1 + 4.0 * prog)
      };
      // 3. +Kinetin (1.0 mg/L): breaks apical dominance -> bush of 5-7 axillary shoots, inhibits roots!
      const kin = {
        L: L0 * (1 + 1.45 * prog),
        shoots: 1 + (sp.kMul - 1) * prog * dFac,
        roots: Math.max(0, 0.4 * (1 - 0.6 * stateC.doseScale) * prog),
        rootLen: 4 * prog,
        nodes: Math.round(1 + 3.2 * prog)
      };
      // 4. +GA3 (2.0 mg/L): dramatic internode elongation!
      const ga3 = {
        L: L0 * (1 + 2.7 * sp.gaBoost * prog * dFac),
        shoots: 1.2,
        roots: 1.4 * prog,
        rootLen: 12 * prog,
        nodes: Math.round(1 + 4.2 * prog)
      };

      for (const m of [ctrl, iaa, kin, ga3]) {
        m.I = m.L / L0;
        m.internode = m.L / Math.max(1, m.nodes);
      }
      return { L0, ctrl, iaa, kin, ga3 };
    }

    function drawC() {
      const m = calcMorphC();
      rdC.set("ctrl", `I = ${fmt(m.ctrl.I, 2)}`, `(${fmt(m.ctrl.L, 0)} мм · ${fmt(m.ctrl.roots, 1)} кор.)`);
      rdC.set("iaa", `I = ${fmt(m.iaa.I, 2)}`, `(Ризогенез: ${fmt(m.iaa.roots, 1)} кор., l=${fmt(m.iaa.rootLen, 0)} мм)`);
      rdC.set("kin", `${fmt(m.kin.shoots, 1)} пагонів`, `(I = ${fmt(m.kin.I, 2)} · коренів: ${fmt(m.kin.roots, 1)})`);
      rdC.set("ga3", `I = ${fmt(m.ga3.I, 2)}`, `(${fmt(m.ga3.L, 0)} мм · міжвузля ${fmt(m.ga3.internode, 1)} мм)`);

      outC.el.className = "bout good";
      outC.set(
        `<b>Морфогенез мікроживців <i>${SPECIES_DB[stateC.sp].name.split("(")[1].replace(")", "")}</i> на ${stateC.days}-ту добу (ЛР 37, с. 128–132):</b> ` +
        `<b>+ІОК</b> стимулює потужне коренеутворення (<b>${fmt(m.iaa.roots, 1)} коренів/живець</b>); ` +
        `<b>+Кінетин</b> знімає апікальне домінування й індукує <b>${fmt(m.kin.shoots, 1)} пазушних пагонів</b> за гальмування ризогенезу; ` +
        `<b>+ГК₃</b> видовжує міжвузля до <b>${fmt(m.ga3.internode, 1)} мм</b> і підвищує індекс росту до <b>I = ${fmt(m.ga3.I, 2)}</b> (проти ${fmt(m.ctrl.I, 2)} у контролі).`
      );

      // Draw Stage C: 4 side-by-side test tubes (Control, +IAA, +Kinetin, +GA3)
      stC.clear();
      const c = stC.ctx, W = stC.W, H = stC.H, T = Theme.c;
      const tw = Math.min(82, W * 0.16);
      const th = H * 0.74;
      const ty = H * 0.12;

      const tubes = [
        { key: "ctrl", lbl: "1. Контроль (МС)", obj: m.ctrl, col: "#2C7A4D" },
        { key: "iaa",  lbl: "2. +ІОК (ризогенез)", obj: m.iaa, col: "#2A6A93" },
        { key: "kin",  lbl: "3. +Кінетин (кущіння)", obj: m.kin, col: "#C77A12" },
        { key: "ga3",  lbl: "4. +ГК₃ (видовження)", obj: m.ga3, col: "#9A2E66" }
      ];

      tubes.forEach((tb, idx) => {
        const tx = W * (0.14 + idx * 0.24) - tw / 2;
        Gfx.vial(c, tx, ty, tw, th, 0.25, Theme.dark ? "rgba(185,215,192,0.22)" : "rgba(222,238,220,0.78)", {
          plug: true,
          label: tb.lbl,
          inside(ctx, ly) {
            const sx = tx + tw / 2;
            const d = tb.obj;

            // 1. Roots in agar medium below ly
            const nRoots = Math.round(d.roots);
            ctx.strokeStyle = "#8B6936";
            ctx.lineWidth = 1.4;
            for (let r = 0; r < nRoots; r++) {
              const spread = (r - (nRoots - 1) / 2) * 5.2;
              const rLenPx = Math.min(th * 0.22, d.rootLen * 0.9);
              ctx.beginPath();
              ctx.moveTo(sx, ly);
              ctx.quadraticCurveTo(sx + spread * 0.7, ly + rLenPx * 0.5, sx + spread, ly + rLenPx);
              ctx.stroke();
            }

            // 2. Shoots above agar line ly
            const nShoots = Math.max(1, Math.round(d.shoots));
            const hPx = clamp(d.L * 1.35, 16, th * 0.68);
            const shootCol = tb.key === "ga3" ? "#66B562" : "#288246";

            for (let s = 0; s < nShoots; s++) {
              const ang = nShoots === 1 ? 0 : ((s / (nShoots - 1)) - 0.5) * 0.85;
              const sLen = s === Math.floor(nShoots / 2) ? hPx : hPx * 0.82;
              const topX = sx + Math.sin(ang) * sLen * 0.55;
              const topY = ly - Math.cos(ang) * sLen;

              ctx.strokeStyle = shootCol;
              ctx.lineWidth = tb.key === "ga3" ? 1.7 : 2.5;
              ctx.beginPath();
              ctx.moveTo(sx, ly);
              ctx.quadraticCurveTo(sx + Math.sin(ang) * sLen * 0.25, ly - sLen * 0.5, topX, topY);
              ctx.stroke();

              // Pairs of opposite leaves (characteristic of Stevia & Carnation)
              const nNodes = Math.max(2, d.nodes);
              for (let n = 1; n <= nNodes; n++) {
                const f = n / (nNodes + 0.3);
                const nx = lerp(sx, topX, f);
                const ny = lerp(ly, topY, f);
                const lw = tb.key === "ga3" ? 6.5 : 9.0;
                ctx.fillStyle = shootCol;
                ctx.beginPath();
                ctx.ellipse(nx - lw * 0.8, ny, lw, 3.2, -0.3, 0, 7);
                ctx.ellipse(nx + lw * 0.8, ny, lw, 3.2, 0.3, 0, 7);
                ctx.fill();
              }
            }
          }
        });
        Gfx.chip(c, `I = ${fmt(tb.obj.I, 2)}`, tx + tw / 2, ty - 20, { align: "center", size: 10, bg: T.sheet, fg: tb.col });
      });

      // Chart C1: Shoot height L(t) over 0..28 days for all 4 treatments
      const ptsCtrl = [], ptsIAA = [], ptsKin = [], ptsGA3 = [];
      for (let d = 0; d <= 28; d += 2) {
        const md = calcMorphC(d);
        ptsCtrl.push([d, md.ctrl.L]);
        ptsIAA.push([d, md.iaa.L]);
        ptsKin.push([d, md.kin.L]);
        ptsGA3.push([d, md.ga3.L]);
      }
      drawChart(chC1, {
        x: [0, 28], y: [0, 130],
        xl: "Час культивування мікроживців t, діб",
        yl: "Висота головного пагона L_t, мм",
        vl: [{ x: stateC.days, color: T.ink, dash: [3, 3], label: `${stateC.days} доба` }],
        series: [
          { pts: ptsGA3, color: T.antho, w: 2.6 },
          { pts: ptsIAA, color: T.data, w: 2.2 },
          { pts: ptsCtrl, color: T.chl, w: 2.2, dash: [5, 3] },
          { pts: ptsKin, color: T.carot, w: 2.2 }
        ],
        legend: [
          { label: "+ГК₃", color: T.antho },
          { label: "+ІОК", color: T.data },
          { label: "Контроль", color: T.chl },
          { label: "+Кінетин", color: T.carot }
        ]
      });

      // Chart C2: Bar chart of Growth Index I = Lt/L0 OR Organ counts (Shoots & Roots)
      if (stateC.metric === "idx") {
        drawChart(chC2, {
          x: [0.4, 4.6], y: [0, 10],
          xt: [1, 2, 3, 4],
          xfmt: v => ["", "Контроль", "+ІОК", "+Кінетин", "+ГК₃"][Math.round(v)] || "",
          yl: "Індекс росту I = L_t / L₀",
          series: [
            {
              bars: true, bw: 34, color: alpha(T.chl, 0.82),
              pts: [[1, m.ctrl.I], [2, m.iaa.I], [3, m.kin.I], [4, m.ga3.I]]
            }
          ],
          marks: [
            { x: 1, y: m.ctrl.I, color: T.chl, label: fmt(m.ctrl.I, 2) },
            { x: 2, y: m.iaa.I, color: T.data, label: fmt(m.iaa.I, 2) },
            { x: 3, y: m.kin.I, color: T.carot, label: fmt(m.kin.I, 2) },
            { x: 4, y: m.ga3.I, color: T.antho, label: fmt(m.ga3.I, 2) }
          ]
        });
      } else {
        drawChart(chC2, {
          x: [0.4, 4.6], y: [0, 14],
          xt: [1, 2, 3, 4],
          xfmt: v => ["", "Контроль", "+ІОК", "+Кінетин", "+ГК₃"][Math.round(v)] || "",
          yl: "Кількість органів на експлантат, шт.",
          series: [
            {
              bars: true, bw: 26, color: alpha(T.data, 0.78),
              pts: [[1, m.ctrl.roots], [2, m.iaa.roots], [3, m.kin.roots], [4, m.ga3.roots]]
            },
            {
              pts: [[1, m.ctrl.shoots], [2, m.iaa.shoots], [3, m.kin.shoots], [4, m.ga3.shoots]],
              color: T.carot, w: 2.4, dots: 4.5
            }
          ],
          legend: [
            { label: "Адвентивні корені (шт.)", color: T.data },
            { label: "Бічні пагони кущіння (шт.)", color: T.carot }
          ]
        });
      }
    }

    modes.init();

    return {
      stages: [stA, chA1, chA2, stB, chB1, chB2, stC, chC1, chC2],
      frame(dt, time) {
        if (modes.cur === "a") {
          if (dt > 0 || dirty || stA.dirty || chA1.dirty || chA2.dirty) {
            drawA();
            dirty = false; stA.dirty = false; chA1.dirty = false; chA2.dirty = false;
          }
        } else if (modes.cur === "b") {
          if (dt > 0 || dirty || stB.dirty || chB1.dirty || chB2.dirty) {
            drawB();
            dirty = false; stB.dirty = false; chB1.dirty = false; chB2.dirty = false;
          }
        } else if (modes.cur === "c") {
          if (dt > 0 || dirty || stC.dirty || chC1.dirty || chC2.dirty) {
            drawC();
            dirty = false; stC.dirty = false; chC1.dirty = false; chC2.dirty = false;
          }
        }
      }
    };
  }
});
})();
