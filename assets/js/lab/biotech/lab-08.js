(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

App.def(8, {
  cheat: `
    <p class="lead">
      <b>Мікроклональне розмноження</b> — це масове безстатеве (вегетативне) розмноження рослин у стерильній культурі <i>in vitro</i>, за якого отримані клони є генетично ідентичними вихідному материнському екземпляру та звільненими від вірусної, бактеріальної, мікоплазмової й грибної інфекції (М.&nbsp;Д.&nbsp;Мельничук, О.&nbsp;Л.&nbsp;Кляченко, 2014, Тема&nbsp;8, ЛР&nbsp;26–30, с.&nbsp;106–117). Поєднання культури <b>апікальних меристем</b> (за Ж.&nbsp;Морелем, 1952) із термо- та хіміотерапією становить основу сучасного безвірусного насінництва картоплі (<i>Solanum tuberosum</i> L.), суниці, хмелю, винограду, плодових і декоративних культур.
    </p>

    <h3>1. Етапи мікроклонального розмноження рослин (ЛР 26, за Мурасіге, 1974)</h3>
    <p>
      Технологічний цикл промислового мікроклонального розмноження поділяють на <b>чотири послідовні етапи</b> (с.&nbsp;106–108):
    </p>
    <ol>
      <li><b>Етап І — Введення експлантата у стерильну культуру <i>in vitro</i>:</b> поверхнева стерилізація пагонів або вічок пророщених бульб, вичленення апікальної меристеми чи пазушної бруньки і висаджування на агаризоване середовище Мурасіге—Скуга (МС) для первинного відростання пагона.</li>
      <li><b>Етап ІІ — Власне мультиплікація (розмноження мікропагонів):</b> багаторазове субкультивування шляхом активації пазушних меристем цитокінінами (6-БАП 0,5…2,0&nbsp;мг/л, кінетин) або живцювання регенерантів на одновузлові мікроживці кожні 3…4 тижні. За коефіцієнта розмноження <var>K</var> = 4…7 за один пасаж чисельність рослин після <var>m</var> пасажів зростає за геометричною прогресією:
        <div class="eq">
          <var>N<sub>m</sub></var> = <var>N</var><sub>0</sub> · <var>K<sup>m</sup></var>, &emsp;
          <var>I</var><sub>росту</sub> = <span class="fr"><span><var>L<sub>t</sub></var></span><span><var>L</var><sub>0</sub></span></span>
          <span class="c">— геометрична прогресія мультиплікації та індекс росту пагона (с. 108)</span>
        </div>
        Завдяки цьому з однієї вихідної меристеми за рік (<var>m</var> = 8…10 пасажів) отримують від 10<sup>5</sup> до 10<sup>6</sup> генетично однорідних рослин (тоді як польове розмноження бульб картоплі дає лише 1:5…1:8 за рік).
      </li>
      <li><b>Етап ІІІ — Укорінення (ризогенез) або індукція мікробульб:</b> перенесення мікропагонів на середовище МС зі зниженим удвічі вмістом макросолей (½&nbsp;МС), сахарози (10…15&nbsp;г/л) і додаванням ауксинів — ІОК, ІМК або НОК (0,5…1,0&nbsp;мг/л) без цитокінінів. Для картоплі альтернативою є отримання <b>мікробульб <i>in vitro</i></b> (ЛР&nbsp;29).</li>
      <li><b>Етап ІV — Акліматизація (адаптація) регенерантів до умов <i>ex vitro</i> (ЛР 30):</b> пересаджування пробіркових рослин у стерильний грунтовий субстрат (торф : перліт : пісок) із поступовим зниженням відносної вологості повітря з 95…100&nbsp;% до 60…65&nbsp;%.</li>
    </ol>

    <h3>2. Оздоровлення картоплі від вірусів методом апікальної меристеми, термо- та хіміотерапії (ЛР 27–28)</h3>
    <p>
      Вегетативно розмножувані сорти картоплі уражуються комплексом фітовірусів: X-вірусом (<b>PVX</b>), Y-вірусом (<b>PVY</b>), S-вірусом (<b>PVS</b>), M-вірусом (<b>PVM</b>) та вірусом скручування листя (<b>PLRV</b>), що знижує врожайність на 30…70&nbsp;%. Меристематичний купол конуса наростання пагона (100…250&nbsp;мкм) зазвичай вільний від вірусних часток із трьох причин:
    </p>
    <ul>
      <li><b>Відсутність провідних пучків (флоеми та ксилеми)</b> в апікальному куполі: віруси змушені рухатися повільним симпластним шляхом крізь плазмодесми, не встигаючи за швидким мітотичним поділом клітин верхівки.</li>
      <li><b>Висока метаболічна та РНК-інтерференційна активність</b> меристематичних клітин і підвищений ендогенний вміст ауксинів, які конкурують із реплікацією вірусної РНК за рибосоми й нуклеотидний пул.</li>
    </ul>

    <div class="eq">
      <var>P</var><sub>VF</sub>(<var>L</var>, <var>T</var>, <var>C</var><sub>риб</sub>) = exp<mrow><mo>(</mo>−<span class="fr"><span><var>L</var><sup>2</sup></span><span><var>λ<sub>v</sub></var>(<var>T</var>, <var>C</var><sub>риб</sub>)<sup>2</sup></span></span><mo>)</mo></mrow>, &emsp;
      <var>P</var><sub>рег</sub>(<var>L</var>) = 1 − exp<mrow><mo>(</mo>−<span class="fr"><span><var>L</var><sup>2</sup></span><span><var>λ<sub>r</sub></var><sup>2</sup></span></span><mo>)</mo></mrow>, &emsp;
      <var>Y</var>(<var>L</var>) = <var>P</var><sub>VF</sub> · <var>P</var><sub>рег</sub>
      <span class="c">— компроміс між імовірністю звільнення від вірусів (P<sub>VF</sub>) і приживлюваністю меристеми (P<sub>рег</sub>)</span>
    </div>
    <dl class="vars">
      <dt>L</dt><dd>розмір (висота) вичлененого експлантата — купола апікальної меристеми з 1–2 листковими примордіями (мкм; оптимальний діапазон за с.&nbsp;110–112: <b>100…250&nbsp;мкм</b>, тобто 0,10…0,25&nbsp;мм)</dd>
      <dt>λ<sub>v</sub>(T, C<sub>риб</sub>)</dt><dd>глибина вільно-вірусної зони апексу (мкм), яка залежить від інвазивності вірусу (PVX &gt; PVS &gt; PVM &gt; PVY &gt; PLRV) і суттєво розширюється за <b>термотерапії</b> (+37…38&nbsp;°C протягом 3…4 тижнів — інактивація вірусної РНК-залежної РНК-полімерази) та <b>хіміотерапії</b> у середовищі з аналогом нуклеозидів <b>віразолом / рибавірином</b> (10…30&nbsp;мг/л)</dd>
      <dt>Y(L)</dt><dd>інтегральний вихід оздоровлених життєздатних регенерантів (контроль на відсутність вірусів проводять імуноферментним аналізом — <b>ІФА / ELISA</b> та полімеразною ланцюговою реакцією — <b>ПЛР</b>)</dd>
    </dl>

    <h3>3. Індукція мікробульб картоплі <i>in vitro</i> (ЛР 29) та акліматизація <i>ex vitro</i> (ЛР 30)</h3>
    <p>
      <b>Мікробульби (ЛР 29, с. 113–115):</b> для тривалого зберігання колекцій без пасажування та зручного висаджування в теплиці у пробіркових рослин картоплі індукують столони та пазушні мікробульби (діаметром 4…8&nbsp;мм, масою 50…300&nbsp;мг). Ключові індуктори бульбоутворення <i>in vitro</i>:
    </p>
    <ul>
      <li><b>Підвищена концентрація сахарози (60…80&nbsp;г/л або 6…8&nbsp;% проти 20&nbsp;г/л при розмноженні):</b> створює високий вуглеводний потенціал для синтезу крохмалю в амілопластах.</li>
      <li><b>Цитокініни або ретарданти:</b> 6-БАП чи кінетин (1,0…2,0&nbsp;мг/л) або хлорхолінхлорид (ССС, 200…500&nbsp;мг/л), які гальмують апікальне видовження пагона (блокують дію гіберелінів) і переспрямовують потік асимілятів у пазушні столони.</li>
      <li><b>Короткий фотоперіод (8&nbsp;год світла) або повна темрява</b> за зниженої температури +18…20&nbsp;°C.</li>
    </ul>
    <p>
      <b>Акліматизація регенерантів <i>ex vitro</i> (ЛР 30, с. 115–117):</b> у герметичній пробірці за відносної вологості повітря RH = 98…100&nbsp;% та живлення готовою сахарозою рослини формують ювенільний <b>міксотрофний фенотип</b>: тонкий кутикулярний віск на епідермісі, широко відкриті продихи з уповільненою реакцією замикання у відповідь на абсцизову кислоту (АБК) та слабкий розвиток кореневих волосків. Різке перенесення в сухе повітря теплиці (RH = 50&nbsp;%) викликає катастрофічну кутикулярну й продихову транспірацію і в'янення за кілька годин. Ступінчасте зниження вологості під плівковим укриттям упродовж 10…14 діб забезпечує відновлення воскового шару, функціональності продихів і перехід до фотоавтотрофного живлення.
    </p>

    <h3>4. Протоколи лабораторних робіт № 26–30 (с. 108–117)</h3>
    <details class="bproto">
      <summary>Хід роботи — Лабораторна робота № 27–28. Вичленення апікальної меристеми, термо- та хіміотерапія картоплі (с. 109–113)</summary>
      <div>
        <ol class="bsteps">
          <li>Проростіть попередньо відібрані бульби картоплі (<i>Solanum tuberosum</i> L.) у термокамері при +37…38&nbsp;°C протягом 3…4 тижнів (термотерапія) до утворення етіольованих паростків завдовжки 3…5&nbsp;см.</li>
          <li>Відокремте верхівки паростків (1&nbsp;см), промийте у мильному розчині, простерилізуйте у 70&nbsp;% етанолі (30&nbsp;с) та 0,1&nbsp;% розчині сулеми HgCl<sub>2</sub> або 5&nbsp;% гіпохлориті натрію (5…7&nbsp;хв) і тричі промийте стерильною дистильованою водою.</li>
          <li>У ламінарному боксі під бінокулярним стереомікроскопом (×25…40) стерильними препарувальними голками послідовно відігніть та видаліть покривні луски і молоді зачатки листків, оголюючи блискучий напівсферичний купол апікальної меристеми.</li>
          <li>Мікроскальпелем (уламком леза бритви у тримачі) зріжте <b>купол апікальної меристеми з 1–2 листковими примордіями розміром 100…250&nbsp;мкм</b> і перенесіть на поверхню середовища МС із 0,1&nbsp;мг/л ГК<sub>3</sub>, 0,05&nbsp;мг/л кінетину та (за хіміотерапії) 10…20&nbsp;мг/л <b>віразолу (рибавірину)</b>.</li>
          <li>Культивуйте за +24…25&nbsp;°C та 16-годинного фотоперіоду до утворення пагона, проведіть ІФА-тестування на віруси PVX, PVY, PVS, PVM, PLRV та розмножте безвірусну лінію живцюванням на одновузлові сегменти (ЛР&nbsp;26).</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи — Лабораторна робота № 29–30. Отримання мікробульб in vitro та акліматизація регенерантів у ґрунті (с. 113–117)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Для індукції мікробульб (ЛР 29):</b> розживцюйте безвірусні пробіркові рослини картоплі на стеблові сегменти з 2–3 вузлами, висадіть на середовище МС із <b>80&nbsp;г/л сахарози</b> та 1,0…2,0&nbsp;мг/л 6-БАП і перенесіть у темряву (або 8-годинний короткий день) за температури +18…20&nbsp;°C на 6…8 тижнів до формування пазушних мікробульб.</li>
          <li><b>Для акліматизації регенерантів (ЛР 30):</b> вийміть укорінені пробіркові рослини (заввишки 5…7&nbsp;см із 4–6 листками та кореневою системою), ретельно відмийте корені теплою водою від залишків агару (щоб запобігти розвитку сапрофітної мікобіоти) та висадіть у касети з пропареним субстратом (торф : перліт : пісок у співвідношенні 1:1:1).</li>
          <li>Накрийте касети прозорим поліетиленовим куполом (вологість 95&nbsp;%), а починаючи з 4–5 доби щодня провітрюйте та поступово знижуйте вологість до тепличного рівня (65&nbsp;%) на 12–14 добу.</li>
        </ol>
      </div>
    </details>
  `,

  qa: [
    [
      "Чому купол апікальної меристеми пагона (100–250 мкм) зазвичай вільний від фітовірусів і чому не можна ізолювати занадто великий експлантат (>500 мкм)?",
      "<p>У меристематичному куполі відсутні диференційовані елементи провідної системи (флоема та ксилема), якими віруси швидко транспортуються по рослині; крім того, висока швидкість мітотичних поділів і активність РНК-інтерференції випереджають повільний симпластний рух віріонів крізь плазмодесми. Якщо зрізати верхівку розміром &gt;500&nbsp;мкм, у зріз потрапляють прокамбіальні тяжі та первинна флоема, де титр вірусів (особливо PVX і PVS) уже високий.</p>"
    ],
    [
      "У чому полягає компроміс під час вибору розміру меристематичного експлантата (ЛР 27) та як його зміщують термотерапія (+37 °C) і хіміотерапія віразолом (ЛР 28)?",
      "<p>Дуже малий купол без листкових примордіїв (&lt;80&nbsp;мкм) має майже 100&nbsp;% безвірусність, але вкрай низьку приживлюваність (10…20&nbsp;%) через рановий стрес і дефіцит ендогенних гормонів. Попередня <b>термотерапія</b> (+37…38&nbsp;°C) і додавання <b>віразолу (рибавірину)</b> пригнічують реплікацію вірусної РНК і розширюють безвірусну зону апексу вглиб до 300…450&nbsp;мкм, що дозволяє ізолювати більші меристеми з високою регенераційною здатністю.</p>"
    ],
    [
      "Які фактори живильного середовища та мікроклімату перемикають вегетативний ріст пробіркової картоплі на формування мікробульб (ЛР 29)?",
      "<p>Індукція столонів і мікробульб <i>in vitro</i> потребує комплексу з трьох факторів: 1) підвищення концентрації <b>сахарози до 60…80&nbsp;г/л</b> (6…8&nbsp;%), що створює надлишок вуглеводів для синтезу крохмалю та осмотичний сигнал; 2) внесення цитокінінів (6-БАП 1…2&nbsp;мг/л) або ретарданта хлорхолінхлориду (ССС) для блокування дії гіберелінів; 3) переведення на <b>короткий фотоперіод (8&nbsp;год) або в повну темряву</b> за зниженої температури +18…20&nbsp;°C.</p>"
    ],
    [
      "Чому під час перенесення рослин із пробірки у ґрунт (ЛР 30) необхідно ретельно змивати агар із коренів і поступово знижувати вологість повітря?",
      "<p>Агар із залишками сахарози в нестерильному ґрунті стає ідеальним поживним середовищем для бурхливого розвитку цвілевих грибів і бактерій, які спричиняють загнивання кореневої шийки. Поступове зниження вологості повітря (від 98&nbsp;% до 65&nbsp;% за 10–14 діб) необхідне тому, що в пробірці листки мають тонку кутикулу без епікутикулярного воску та нездатні швидко закривати продихи, тому без вологої камери миттєво гинуть від зневоднення.</p>"
    ],
    [
      "Яка різниця за інвазивністю (глибиною проникнення в апекс) спостерігається між вірусами картоплі PVX, PVS, PVM, PVY та PLRV?",
      "<p>Найважче елімінується <b>X-вірус картоплі (PVX)</b> та <b>S-вірус (PVS)</b>, які проникають у нижні шари апікального купола (безвірусна зона становить лише 80…120&nbsp;мкм без термотерапії). Помірну глибину проникнення мають <b>PVM</b> і <b>PVY</b>, а найлегше видаляється флоемно-обмежений <b>вірус скручування листя (PLRV)</b>, який не виходить за межі ситоподібних трубок провідних пучків (&gt;350&nbsp;мкм від верхівки).</p>"
    ]
  ],

  build({ stageBox, ctrls, below, tabsBox }) {
    const modes = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Апікальна меристема, термо- і хіміотерапія (ЛР 27–28)"],
      ["b", "Б. Мультиплікація N₀·Kᵐ і мікробульби картоплі (ЛР 26, 29)"],
      ["c", "В. Акліматизація регенерантів ex vitro (ЛР 30)"]
    ], () => { dirty = true; });

    let dirty = true;

    /* ======================================================================
       TAB A: APICAL MERISTEM EXCISION, THERMO- & CHEMOTHERAPY (LABS 27-28)
       ====================================================================== */
    const A = modes.box("a");
    const stA = new Stage(A.st, { aspect: 16 / 10, minH: 300, maxH: 460, tag: "ЛР 27–28 · Поздовжній зріз апексу пагона S. tuberosum L. та вичленення меристеми", minW: 580 });

    const VIRUS_DB = {
      PVX:  { name: "PVX (X-вірус картоплі — найвища інвазивність)", lam0: 115 },
      PVS:  { name: "PVS (S-вірус картоплі — висока інвазивність)", lam0: 145 },
      PVM:  { name: "PVM (M-вірус картоплі — помірна інвазивність)", lam0: 190 },
      PVY:  { name: "PVY (Y-вірус картоплі — середня інвазивність)", lam0: 240 },
      PLRV: { name: "PLRV (Вірус скручування листя — флоемний)", lam0: 360 }
    };

    const stateA = {
      L: 180,         // Розмір вичлененої меристеми L (50..800 мкм; оптимум 100–250 мкм)
      virus: "PVX",   // Тип вірусу
      thermoWks: 3,   // Термотерапія при +37..38 °C (0..5 тижнів)
      ribavirin: 20   // Концентрація віразолу / рибавірину в середовищі МС (0..50 мг/л)
    };

    UI.select(A.ct, {
      id: "l8-vir", label: "Фітовірус картоплі (S. tuberosum L.)",
      options: Object.entries(VIRUS_DB).map(([k, v]) => [k, v.name]),
      value: stateA.virus,
      on: v => { stateA.virus = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l8-size", label: "Розмір ізольованої меристеми L", min: 50, max: 800, step: 10, value: stateA.L, unit: "мкм",
      fmt: v => `${fmt(v, 0)} мкм (${fmt(v / 1000, 2)} мм)`, on: v => { stateA.L = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l8-thermo", label: "Термотерапія при +37…38 °C", min: 0, max: 5, step: 0.5, value: stateA.thermoWks, unit: "тиж.",
      fmt: v => fmt(v, 1), on: v => { stateA.thermoWks = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l8-rib", label: "Хіміотерапія: Віразол (рибавірин)", min: 0, max: 50, step: 5, value: stateA.ribavirin, unit: "мг/л",
      fmt: v => fmt(v, 0), on: v => { stateA.ribavirin = v; dirty = true; }
    });

    const outA = UI.out(A.ct, "");

    const rdA = UI.reads(A.bl, [
      ["lamv", "Безвірусна зона апексу λ_v"],
      ["pvf", "Імовірність безвірусності P_VF"],
      ["preg", "Приживлюваність і регенерація P_рег"],
      ["yield", "Вихід здорових регенерантів Y = P_VF·P_рег"],
      ["lopt", "Оптимальний розмір експлантата L_опт"]
    ]);

    const chRowA = h("div", { class: "charts" });
    A.bl.append(chRowA);
    const chA1 = UI.chart(chRowA, "Криві безвірусності P_VF(L), регенерації P_рег(L) та інтегрального виходу здорових рослин Y(L)", { aspect: 1.85, minH: 195, maxH: 270 });
    const chA2 = UI.chart(chRowA, "Порівняння ефективності елімінації п'яти основних вірусів картоплі за поточного L", { aspect: 1.85, minH: 195, maxH: 270 });

    function calcA(L = stateA.L, virKey = stateA.virus, thW = stateA.thermoWks, rib = stateA.ribavirin) {
      const vObj = VIRUS_DB[virKey];
      // Thermo- and chemotherapy expand the virus-free zone depth lambda_v:
      const thermoBoost = 1 + 0.32 * thW;
      const chemoBoost = 1 + 0.022 * rib;
      const lamV = vObj.lam0 * thermoBoost * chemoBoost;

      // Virus-free probability: Gaussian falloff with depth L
      const pVF = Math.exp(-Math.pow(L / lamV, 2.2)) * 100;
      // Regeneration survival probability (phytotoxicity slightly penalizes ribavirin > 30 mg/L)
      const ribTox = Math.exp(-Math.max(0, rib - 25) * 0.008);
      const lamR = 145; // μm characteristic scale for meristem survival
      const pReg = (1 - Math.exp(-Math.pow(L / lamR, 1.85))) * ribTox * 100;
      const Y = (pVF * pReg) / 100;

      // Find optimal L
      let bestL = 150, bestY = 0;
      for (let l = 50; l <= 800; l += 5) {
        const vf = Math.exp(-Math.pow(l / lamV, 2.2)) * 100;
        const rg = (1 - Math.exp(-Math.pow(l / lamR, 1.85))) * ribTox * 100;
        const y = (vf * rg) / 100;
        if (y > bestY) { bestY = y; bestL = l; }
      }

      return { lamV, pVF, pReg, Y, bestL, bestY };
    }

    function drawA(time) {
      const res = calcA();
      rdA.set("lamv", fmt(res.lamV, 0), "мкм від верхівки");
      rdA.set("pvf", fmt(res.pVF, 1), "% (ІФА-негативні)");
      rdA.set("preg", fmt(res.pReg, 1), "% виживання");
      rdA.set("yield", fmt(res.Y, 1), "% оздоровлених рослин");
      rdA.set("lopt", `${fmt(res.bestL, 0)} мкм`, `(макс. вихід ${fmt(res.bestY, 1)} %)`);

      let cls = "good";
      if (res.Y < 25) cls = "bad";
      else if (res.Y < 45) cls = "warn";
      outA.el.className = "bout " + cls;
      outA.set(
        `<b>Аналіз елімінації вірусу ${stateA.virus} (ЛР 27–28):</b> за термотерапії (${fmt(stateA.thermoWks, 1)} тиж.) та рибавірину (${stateA.ribavirin} мг/л) границя безвірусної зони апексу опускається до <b>λ<sub>v</sub> ≈ ${fmt(res.lamV, 0)} мкм</b>. ` +
        `При вичлененні меристеми розміром <code>L = ${stateA.L} мкм</code> приживлюваність становить <b>${fmt(res.pReg, 1)} %</b>, безвірусність — <b>${fmt(res.pVF, 1)} %</b>, а підсумковий вихід здорових регенерантів <b>Y = ${fmt(res.Y, 1)} %</b> (оптимум: <code>L_опт = ${res.bestL} мкм</code>).`
      );

      // Draw Stage A: Longitudinal anatomical section of shoot apex with excision scalpel line at depth L
      stA.clear();
      const c = stA.ctx, W = stA.W, H = stA.H, T = Theme.c;
      const apexX = W * 0.36;
      const topY = H * 0.14;
      const botY = H * 0.88;
      const apexH = botY - topY; // represents 800 μm total vertical scale
      const umToPx = apexH / 850;

      // Draw anatomical shoot apex dome + leaf primordia P1, P2, P3
      c.save();
      c.beginPath();
      // Left outer contour with leaf primordia lobes
      c.moveTo(apexX - 115, botY);
      c.quadraticCurveTo(apexX - 95, topY + 280 * umToPx, apexX - 105, topY + 120 * umToPx); // P3 left
      c.quadraticCurveTo(apexX - 80, topY + 60 * umToPx, apexX - 68, topY + 190 * umToPx);
      c.quadraticCurveTo(apexX - 64, topY + 75 * umToPx, apexX - 50, topY + 45 * umToPx);   // P1 left primordium
      c.quadraticCurveTo(apexX - 36, topY + 95 * umToPx, apexX - 32, topY + 75 * umToPx);
      // Apical meristem dome itself (tunica-corpus)
      c.bezierCurveTo(apexX - 24, topY - 4, apexX + 24, topY - 4, apexX + 32, topY + 75 * umToPx);
      // Right leaf primordia P2, P4
      c.quadraticCurveTo(apexX + 36, topY + 95 * umToPx, apexX + 54, topY + 55 * umToPx);   // P2 right primordium
      c.quadraticCurveTo(apexX + 68, topY + 85 * umToPx, apexX + 68, topY + 210 * umToPx);
      c.quadraticCurveTo(apexX + 86, topY + 90 * umToPx, apexX + 108, topY + 140 * umToPx);
      c.quadraticCurveTo(apexX + 95, topY + 300 * umToPx, apexX + 115, botY);
      c.closePath();

      // Gradient fill: bright virus-free emerald meristem at top -> infected reddish-brown vascularized base
      const vfPx = topY + res.lamV * umToPx;
      const ag = c.createLinearGradient(0, topY, 0, botY);
      ag.addColorStop(0, "#43A865");
      ag.addColorStop(clamp((vfPx - topY) / apexH * 0.75, 0.08, 0.85), "#65B878");
      ag.addColorStop(clamp((vfPx - topY) / apexH * 1.15, 0.18, 0.96), "#D89A5B");
      ag.addColorStop(1, "#B84A42");
      c.fillStyle = ag;
      c.fill();

      // Clip inside shoot apex to draw procambial vascular strands & viral particles
      c.save();
      c.clip();
      // Procambial strands (stop ~230 μm below tip)
      const vascTop = topY + 230 * umToPx;
      c.strokeStyle = "rgba(140,35,35,0.55)";
      c.lineWidth = 4;
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.moveTo(apexX + sgn * 52, botY);
        c.quadraticCurveTo(apexX + sgn * 36, (vascTop + botY) / 2, apexX + sgn * 22, vascTop);
        c.stroke();
      }
      // Viral particles (red dots) below lambda_v
      const rV = rng(808);
      for (let i = 0; i < 95; i++) {
        const vy = vfPx - 15 + Math.pow(rV(), 0.75) * (botY - vfPx + 30);
        const vx = apexX + (rV() - 0.5) * 190;
        if (vy > topY + 35) {
          c.fillStyle = "#A61C24";
          c.beginPath();
          c.arc(vx, vy + Math.sin(time * 2 + i) * 1.5, 2.4, 0, 7);
          c.fill();
        }
      }
      c.restore();

      c.strokeStyle = "#1E5C35";
      c.lineWidth = 2;
      c.stroke();
      c.restore();

      // Virus-free zone boundary dashed line (lambda_v)
      const yLam = clamp(vfPx, topY + 20, botY - 10);
      c.strokeStyle = T.good;
      c.lineWidth = 1.5;
      c.setLineDash([5, 4]);
      c.beginPath();
      c.moveTo(apexX - 135, yLam);
      c.lineTo(apexX + 135, yLam);
      c.stroke();
      c.setLineDash([]);
      Gfx.text(c, `Межа безвірусної зони λ_v ≈ ${fmt(res.lamV, 0)} мкм`, apexX - 135, yLam - 6, { size: 10.5, weight: 700, color: T.good });

      // Scalpel excision line at depth L
      const cutY = topY + stateA.L * umToPx;
      c.strokeStyle = T.ink;
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(apexX - 145, cutY);
      c.lineTo(apexX + 145, cutY);
      c.stroke();
      Gfx.chip(c, `Лінія зрізу скальпелем: L = ${stateA.L} мкм`, apexX + 150, cutY, { align: "left", bg: T.sheet, fg: T.ink });

      // Vertical caliper on left
      Gfx.arrow(c, apexX - 155, topY, apexX - 155, cutY, { col: T.ink, w: 1.6, head: 5 });
      Gfx.arrow(c, apexX - 155, cutY, apexX - 155, topY, { col: T.ink, w: 1.6, head: 5 });
      Gfx.text(c, `${stateA.L} мкм`, apexX - 162, (topY + cutY) / 2 + 4, { align: "right", size: 11, weight: 700, font: "mono", color: T.ink });

      // Right info card on Stage A
      const rx0 = W * 0.66;
      const rw = W - rx0 - 14;
      if (rw > 130) {
        Gfx.rr(c, rx0, topY, rw, apexH, 10);
        c.fillStyle = T.sheet;
        c.fill();
        c.strokeStyle = T.rule;
        c.stroke();

        Gfx.text(c, "Зони апексу пагона (ЛР 27)", rx0 + rw / 2, topY + 22, { align: "center", size: 11.5, weight: 700, color: T.ink });
        const zones = [
          ["0–100 мкм", "Купол меристеми (туніка-корпус): вірусів немає, але низьке виживання"],
          ["100–250 мкм", "Оптимум за посібником: купол + 1–2 листкові примордії"],
          ["250–450 мкм", "Початок прокамбіальних тяжів (потребує термо-/хіміотерапії)"],
          ["> 500 мкм", "Диференційована флоема і ксилема з високим титром віріонів"]
        ];
        zones.forEach(([rngTxt, dsc], idx) => {
          const yy = topY + 48 + idx * ((apexH - 58) / 4);
          Gfx.chip(c, rngTxt, rx0 + 12, yy, { size: 10, bg: idx === 1 ? T["chl-soft"] : T.paper, fg: idx === 1 ? T.chl : T.ink });
          Gfx.text(c, dsc, rx0 + 12, yy + 22, { size: 10, color: T.muted });
        });
      }

      // Chart A1: P_VF(L), P_reg(L), and Yield Y(L)
      const ptsVF = [], ptsReg = [], ptsY = [];
      for (let l = 50; l <= 800; l += 15) {
        const m = calcA(l, stateA.virus, stateA.thermoWks, stateA.ribavirin);
        ptsVF.push([l, m.pVF]);
        ptsReg.push([l, m.pReg]);
        ptsY.push([l, m.Y]);
      }
      drawChart(chA1, {
        x: [50, 800], y: [0, 105],
        xl: "Розмір вичлененої апікальної меристеми L, мкм",
        yl: "Імовірність / Вихід, %",
        band: [{ x0: 100, x1: 250, color: rgba(T.good, 0.10) }],
        vl: [
          { x: stateA.L, color: T.ink, dash: [3, 3], label: `L = ${stateA.L} мкм` },
          { x: res.bestL, color: T.good, dash: [2, 3] }
        ],
        series: [
          { pts: ptsY, color: T.chl, w: 2.8, fill: rgba(T.chl, 0.09) },
          { pts: ptsVF, color: T.data, w: 2.0, dash: [5, 3] },
          { pts: ptsReg, color: T.carot, w: 2.0, dash: [2, 3] }
        ],
        marks: [
          { x: stateA.L, y: res.Y, color: T.chl, label: `Y = ${fmt(res.Y, 1)}%` }
        ],
        legend: [
          { label: "Вихід здорових Y(L)", color: T.chl },
          { label: "Безвірусність P_VF(L)", color: T.data },
          { label: "Регенерація P_рег(L)", color: T.carot }
        ]
      });

      // Chart A2: Bar chart across the 5 potato viruses at current L, thermo, ribavirin
      const vKeys = ["PVX", "PVS", "PVM", "PVY", "PLRV"];
      const barPts = vKeys.map((k, idx) => [idx + 1, calcA(stateA.L, k, stateA.thermoWks, stateA.ribavirin).Y]);
      drawChart(chA2, {
        x: [0.4, 5.6], y: [0, 100],
        xt: [1, 2, 3, 4, 5],
        xfmt: v => vKeys[Math.round(v) - 1] || "",
        yl: "Вихід оздоровлених рослин Y, %",
        series: [
          { bars: true, bw: 32, color: alpha(T.chl, 0.82), pts: barPts }
        ],
        marks: barPts.map(([x, y], i) => ({ x, y, color: vKeys[i] === stateA.virus ? T.ink : T.chl, label: `${fmt(y, 0)}%` }))
      });
    }

    /* ======================================================================
       TAB B: CLONAL MULTIPLICATION N0*K^m & MICROTUBERIZATION (LABS 26, 29)
       ====================================================================== */
    const B = modes.box("b");
    const stB = new Stage(B.st, { aspect: 16 / 10, minH: 295, maxH: 455, tag: "ЛР 26, 29 · Пробіркова культура картоплі: мікроживцювання та індукція мікробульб", minW: 580 });

    const stateB = {
      K: 5,           // Коефіцієнт розмноження за 1 пасаж (2..8 мікроживців)
      passages: 6,    // Кількість пасажів m (1..10)
      sucGL: 80,      // Концентрація сахарози (20..100 г/л; для мікробульб 60–80 г/л)
      bap: 1.5,       // Концентрація 6-БАП / кінетину (0..3.0 мг/л)
      photoper: 8     // Фотоперіод (0 = темрява, 8 = короткий день, 16 = довгий день)
    };

    UI.slider(B.ct, {
      id: "l8-k", label: "Коефіцієнт мультиплікації K (вузлів/пасаж)", min: 2, max: 8, step: 1, value: stateB.K, unit: "",
      fmt: v => fmt(v, 0), on: v => { stateB.K = v; dirty = true; }
    });
    UI.slider(B.ct, {
      id: "l8-m", label: "Кількість послідовних пасажів m", min: 1, max: 9, step: 1, value: stateB.passages, unit: "пасажів",
      fmt: v => `${fmt(v, 0)} (~${fmt(v * 3.5, 0)} тиж.)`, on: v => { stateB.passages = v; dirty = true; }
    });
    UI.slider(B.ct, {
      id: "l8-suc", label: "Сахароза у середовищі МС (ЛР 29)", min: 20, max: 100, step: 5, value: stateB.sucGL, unit: "г/л",
      fmt: v => `${fmt(v, 0)} г/л (${fmt(v / 10, 1)} %)`, on: v => { stateB.sucGL = v; dirty = true; }
    });
    UI.slider(B.ct, {
      id: "l8-bap", label: "Цитокінін 6-БАП (індуктор бульб)", min: 0.0, max: 3.0, step: 0.25, value: stateB.bap, unit: "мг/л",
      fmt: v => fmt(v, 2), on: v => { stateB.bap = v; dirty = true; }
    });
    UI.seg(B.ct, {
      label: "Фотоперіод при індукції мікробульб (+19 °C)",
      options: [
        [0, "Темрява (0 год)"],
        [8, "Короткий (8 год)"],
        [16, "Довгий (16 год)"]
      ],
      value: stateB.photoper,
      on: v => { stateB.photoper = +v; dirty = true; }
    });

    const outB = UI.out(B.ct, "");

    const rdB = UI.reads(B.bl, [
      ["nm", "Вихід клонів N_m = N₀·Kᵐ (з 1 меристеми)"],
      ["tubidx", "Індекс індукції мікробульб (ЛР 29)"],
      ["tubmass", "Середня маса мікробульби"],
      ["tubnum", "Кількість мікробульб на 1 рослину"],
      ["mode", "Фізіологічний напрям розвитку"]
    ]);

    const chRowB = h("div", { class: "charts" });
    B.bl.append(chRowB);
    const chB1 = UI.chart(chRowB, "Експоненційне нарощування кількості безвірусних рослин lg(N_m) за пасажами m", { aspect: 1.85, minH: 195, maxH: 270 });
    const chB2 = UI.chart(chRowB, "Залежність середньої маси мікробульби (мг) від концентрації сахарози у середовищі МС", { aspect: 1.85, minH: 195, maxH: 270 });

    function calcB(suc = stateB.sucGL, bap = stateB.bap, photo = stateB.photoper) {
      const Nm = Math.pow(stateB.K, stateB.passages);
      // Tuberization response peaks at sucrose 70..85 g/L, BAP 1.0..2.0 mg/L, and darkness/short day (0..8 h)
      const sucFac = Math.exp(-Math.pow((suc - 75) / 26, 2)) * smooth(22, 55, suc);
      const bapFac = 0.35 + 0.65 * Math.exp(-Math.pow((bap - 1.5) / 1.1, 2));
      const photoFac = photo === 0 ? 1.0 : photo === 8 ? 0.88 : 0.28;
      const tubIdx = clamp(sucFac * bapFac * photoFac * 100, 0, 100);
      const tubMass = 25 + 260 * (tubIdx / 100); // mg per microtuber
      const nTubers = tubIdx > 55 ? 2.4 : tubIdx > 25 ? 1.3 : 0.2;
      return { Nm, tubIdx, tubMass, nTubers };
    }

    function drawB(time) {
      const res = calcB();
      rdB.set("nm", `${sci(res.Nm, 2)} (${res.Nm.toLocaleString("uk-UA")} шт.)`);
      rdB.set("tubidx", fmt(res.tubIdx, 1), "%");
      rdB.set("tubmass", fmt(res.tubMass, 0), "мг (d ≈ " + fmt(2.2 + 5.8 * (res.tubIdx / 100), 1) + " мм)");
      rdB.set("tubnum", fmt(res.nTubers, 1), "шт./пробірку");
      rdB.set("mode", res.tubIdx >= 50 ? "Активний столоно- і бульбогенез" : "Вегетативне видовження пагона");

      outB.el.className = "bout " + (res.tubIdx >= 50 ? "good" : "warn");
      outB.set(
        `<b>Мультиплікація (ЛР 26) та мікробульбоутворення (ЛР 29):</b> за <code>K = ${stateB.K}</code> після <code>m = ${stateB.passages}</code> пасажів із однієї апікальної меристеми отримують <b>N<sub>m</sub> = ${stateB.K}<sup>${stateB.passages}</sup> = ${res.Nm.toLocaleString("uk-UA")}</b> генетично ідентичних рослин. ` +
        `При концентрації сахарози <code>${stateB.sucGL} г/л</code> і фотоперіоді <code>${stateB.photoper} год</code> індекс бульбоутворення становить <b>${fmt(res.tubIdx, 1)} %</b> (середня маса мікробульби <b>${fmt(res.tubMass, 0)} мг</b>).`
      );

      // Draw Stage B: Two test tubes side by side:
      // Tube 1: Stage II Vegetative microcutting multiplication (20 g/L sucrose, 16 h light)
      // Tube 2: Stage III Microtuber induction (current sucrose, BAP, photoperiod)
      stB.clear();
      const c = stB.ctx, W = stB.W, H = stB.H, T = Theme.c;
      const tw = Math.min(92, W * 0.17);
      const th = H * 0.72;
      const ty = H * 0.12;

      // Tube 1 (Left): Vegetative Micropropagation (ЛР 26)
      const tx1 = W * 0.22 - tw / 2;
      Gfx.vial(c, tx1, ty, tw, th, 0.24, Theme.dark ? "rgba(180,215,190,0.22)" : "rgba(218,236,216,0.75)", {
        plug: true,
        label: `Етап ІІ: Живцювання (K = ${stateB.K} вузлів)`,
        inside(ctx, ly) {
          const sx = tx1 + tw / 2;
          // Roots in agar
          ctx.strokeStyle = "#8C6F3E";
          ctx.lineWidth = 1.3;
          for (let r = -2; r <= 2; r++) {
            ctx.beginPath();
            ctx.moveTo(sx, ly);
            ctx.quadraticCurveTo(sx + r * 8, ly + 18, sx + r * 13, ty + th - 10);
            ctx.stroke();
          }
          // Main green stem with K nodes and dashed cutting lines
          const stemTop = ty + 28;
          ctx.strokeStyle = "#297D45";
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(sx, ly);
          ctx.lineTo(sx, stemTop);
          ctx.stroke();

          for (let n = 1; n <= stateB.K; n++) {
            const ny = lerp(ly - 12, stemTop + 10, (n - 0.5) / stateB.K);
            const dir = n % 2 ? 1 : -1;
            ctx.fillStyle = "#339454";
            ctx.beginPath();
            ctx.ellipse(sx + dir * 13, ny - 2, 11, 5, dir * 0.35, 0, 7);
            ctx.fill();
            // Axillary bud dot
            Gfx.sphere(ctx, sx + dir * 3.5, ny - 3, 2.5, "#175C2E");
            // Microcutting dashed line
            if (n < stateB.K) {
              const cutY = lerp(ly - 12, stemTop + 10, n / stateB.K);
              ctx.strokeStyle = rgba(T.ink, 0.35);
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(tx1 + 10, cutY);
              ctx.lineTo(tx1 + tw - 10, cutY);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }
      });

      // Tube 2 (Right): Microtuber Induction in vitro (ЛР 29)
      const tx2 = W * 0.68 - tw / 2;
      Gfx.vial(c, tx2, ty, tw, th, 0.26, Theme.dark ? "rgba(215,195,140,0.25)" : "rgba(238,225,180,0.80)", {
        plug: true,
        label: `ЛР 29: Мікробульби (${stateB.sucGL} г/л сах., ${stateB.photoper} год)`,
        inside(ctx, ly) {
          const sx = tx2 + tw / 2;
          const stemTop = ty + 48;
          ctx.strokeStyle = "#3E7A42";
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(sx, ly);
          ctx.lineTo(sx, stemTop);
          ctx.stroke();

          // Draw axillary stolons and swelling microtubers proportional to res.tubIdx
          const rTub = 2.5 + 8.5 * (res.tubIdx / 100);
          const nodes = [0.22, 0.48, 0.74];
          nodes.forEach((f, idx) => {
            const ny = lerp(ly - 8, stemTop + 12, f);
            const dir = idx % 2 ? 1 : -1;
            // Stolon branch
            ctx.strokeStyle = "#8C734B";
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(sx, ny);
            ctx.quadraticCurveTo(sx + dir * 12, ny + 4, sx + dir * 20, ny + 10);
            ctx.stroke();
            // Swelling potato microtuber at stolon tip
            Gfx.sphere(ctx, sx + dir * 22, ny + 11, rTub * (idx === 0 ? 1.15 : 0.9), "#C8963E", { ring: "#7A5518", rw: 1.2 });
          });
        }
      });

      // Arrow between Tube 1 and Tube 2
      Gfx.arrow(c, tx1 + tw + 18, ty + th * 0.45, tx2 - 18, ty + th * 0.45, { col: T.chl, w: 2.2 });
      Gfx.text(c, `× Kᵐ = ${sci(res.Nm, 1)}`, (tx1 + tw + tx2) / 2, ty + th * 0.45 - 12, { align: "center", size: 12, weight: 700, font: "mono", color: T.chl });
      Gfx.text(c, "60–80 г/л сахарози + БАП", (tx1 + tw + tx2) / 2, ty + th * 0.45 + 18, { align: "center", size: 10.5, color: T.muted });

      // Chart B1: Log10(N_m) across passages m = 0..9
      const ptsCurK = [], ptsK3 = [], ptsK7 = [];
      for (let m = 0; m <= 9; m++) {
        ptsCurK.push([m, m * Math.log10(stateB.K)]);
        ptsK3.push([m, m * Math.log10(3)]);
        ptsK7.push([m, m * Math.log10(7)]);
      }
      drawChart(chB1, {
        x: [0, 9], y: [0, 8],
        xl: "Номер пасажу субкультивування m",
        yl: "Десятковий логарифм lg(N_m)",
        vl: [{ x: stateB.passages, color: T.ink, dash: [3, 3], label: `m = ${stateB.passages}` }],
        series: [
          { pts: ptsCurK, color: T.chl, w: 2.6, dots: 3.5 },
          { pts: ptsK7, color: T.data, w: 1.7, dash: [4, 3] },
          { pts: ptsK3, color: T.muted, w: 1.7, dash: [2, 3] }
        ],
        marks: [
          { x: stateB.passages, y: stateB.passages * Math.log10(stateB.K), color: T.chl, label: `lg N = ${fmt(stateB.passages * Math.log10(stateB.K), 2)}` }
        ],
        legend: [
          { label: `Поточний K = ${stateB.K}`, color: T.chl },
          { label: "Високий K = 7", color: T.data },
          { label: "Низький K = 3", color: T.muted }
        ]
      });

      // Chart B2: Microtuber mass vs sucrose concentration (20..100 g/L)
      const ptsDark = [], ptsShort = [], ptsLong = [];
      for (let s = 20; s <= 100; s += 4) {
        ptsDark.push([s, calcB(s, stateB.bap, 0).tubMass]);
        ptsShort.push([s, calcB(s, stateB.bap, 8).tubMass]);
        ptsLong.push([s, calcB(s, stateB.bap, 16).tubMass]);
      }
      drawChart(chB2, {
        x: [20, 100], y: [0, 310],
        xl: "Концентрація сахарози в середовищі МС, г/л",
        yl: "Середня маса мікробульби, мг",
        band: [{ x0: 60, x1: 80, color: rgba(T.good, 0.10) }],
        vl: [{ x: stateB.sucGL, color: T.ink, dash: [3, 3], label: `${stateB.sucGL} г/л` }],
        series: [
          { pts: ptsDark, color: T.chl, w: 2.5 },
          { pts: ptsShort, color: T.data, w: 2.1, dash: [5, 3] },
          { pts: ptsLong, color: T.warn, w: 1.8, dash: [2, 3] }
        ],
        marks: [
          { x: stateB.sucGL, y: res.tubMass, color: T.ink, label: `${fmt(res.tubMass, 0)} мг` }
        ],
        legend: [
          { label: "Темрява (0 год)", color: T.chl },
          { label: "Короткий день (8 год)", color: T.data },
          { label: "Довгий день (16 год)", color: T.warn }
        ]
      });
    }

    /* ======================================================================
       TAB C: EX VITRO ACCLIMATIZATION & WATER BALANCE (LAB 30)
       ====================================================================== */
    const C = modes.box("c");
    const stC = new Stage(C.st, { aspect: 16 / 10, minH: 295, maxH: 455, tag: "ЛР 30 · Акліматизація регенерантів ex vitro: кутикулярний віск, продихи та водний баланс", minW: 580 });

    const stateC = {
      protocol: "gradual", // "gradual" (Ступінчасте зняття укриття за 14 діб) | "abrupt" (Різке відкриття у 1-шу добу)
      extRH: 55,           // Вологість повітря у теплиці (35..85 %)
      agarWashed: true,    // Відмивання коренів від агару
      day: 7               // Доба адаптації (0..14)
    };

    UI.seg(B ? C.ct : C.ct, {
      label: "Режим вологості під час адаптації ex vitro (ЛР 30)",
      options: [
        ["gradual", "Поступовий (під плівкою, 14 діб)"],
        ["abrupt", "Різкий (без укриття з 1-ї доби)"]
      ],
      value: stateC.protocol,
      on: v => { stateC.protocol = v; dirty = true; }
    });
    UI.slider(C.ct, {
      id: "l8-rh", label: "Вологість повітря в теплиці RH_зовн", min: 35, max: 85, step: 5, value: stateC.extRH, unit: "%",
      fmt: v => fmt(v, 0), on: v => { stateC.extRH = v; dirty = true; }
    });
    UI.slider(C.ct, {
      id: "l8-day", label: "Доба акліматизації ex vitro t", min: 0, max: 14, step: 1, value: stateC.day, unit: "доба",
      fmt: v => fmt(v, 0), on: v => { stateC.day = v; dirty = true; }
    });
    UI.check(C.ct, {
      id: "l8-wash", label: "Ретельно змито агар і сахарозу з коренів теплою водою", value: stateC.agarWashed,
      on: v => { stateC.agarWashed = v; dirty = true; }
    });

    const outC = UI.out(C.ct, "");

    const rdC = UI.reads(C.bl, [
      ["rwc", "Відносний вміст води у листках (RWC)"],
      ["wax", "Товщина епікутикулярного воску"],
      ["stom", "Продихова провідність g_s (втрата води)"],
      ["surv", "Приживлюваність регенерантів ex vitro"],
      ["rot", "Ризик кореневої гнилі (залишки агару)"]
    ]);

    const chRowC = h("div", { class: "charts" });
    C.bl.append(chRowC);
    const chC1 = UI.chart(chRowC, "Динаміка відносного вмісту води (RWC, %) у листках за поступової та різкої акліматизації", { aspect: 1.85, minH: 195, maxH: 270 });
    const chC2 = UI.chart(chRowC, "Формування кутикулярного воску та відновлення регуляції продихів упродовж 14 діб", { aspect: 1.85, minH: 195, maxH: 270 });

    function simC(proto = stateC.protocol, rhExt = stateC.extRH, washed = stateC.agarWashed) {
      const ptsRWC = [], ptsWax = [], ptsCond = [];
      let curAtDay = null;
      for (let d = 0; d <= 14; d++) {
        // Cuticular wax synthesis & stomatal ABA responsiveness mature over ~10 days
        const waxPct = 18 + 82 * (1 - Math.exp(-d / 5.5));
        const stomControl = 15 + 85 * (1 - Math.exp(-d / 4.8)); // % ability to close stomata
        const gStomRel = 100 - 0.72 * stomControl;              // relative water loss conductance

        // Chamber RH around plantlet:
        const rhLocal = proto === "gradual"
          ? lerp(98, rhExt, smooth(2, 13, d))
          : (d === 0 ? 98 : rhExt);

        // Vapor pressure deficit factor (100 - rhLocal) vs plant's barrier resistance
        const vpdStress = ((100 - rhLocal) / 50) * (gStomRel / 60);
        const rootRotPenalty = washed ? 0 : smooth(2, 9, d) * 28;
        const rwc = clamp(96 - vpdStress * 36 - rootRotPenalty, 28, 97);

        ptsRWC.push([d, rwc]);
        ptsWax.push([d, waxPct]);
        ptsCond.push([d, gStomRel]);
        if (d === stateC.day) {
          const surv = clamp(smooth(45, 82, rwc) * (washed ? 96 : 52), 5, 98);
          curAtDay = { rwc, waxPct, gStomRel, rhLocal, surv };
        }
      }
      return { ptsRWC, ptsWax, ptsCond, cur: curAtDay };
    }

    function drawC(time) {
      const res = simC();
      const altRes = simC(stateC.protocol === "gradual" ? "abrupt" : "gradual");
      const cVal = res.cur;

      rdC.set("rwc", fmt(cVal.rwc, 1), "% (норма > 75 %)");
      rdC.set("wax", fmt(cVal.waxPct, 0), "% від норми in vivo");
      rdC.set("stom", fmt(cVal.gStomRel, 0), "% (неконтрольована транспірація)");
      rdC.set("surv", fmt(cVal.surv, 1), "% рослин");
      rdC.set("rot", stateC.agarWashed ? "Низький (< 3 %, агар змито)" : "Високий (> 45 %, гниття агару!)");

      let cls = "good";
      if (cVal.rwc < 62 || !stateC.agarWashed) cls = "bad";
      else if (cVal.rwc < 76) cls = "warn";
      outC.el.className = "bout " + cls;
      outC.set(
        `<b>Водний статус регенеранта на ${stateC.day}-ту добу акліматизації (ЛР 30):</b> локальна вологість під укриттям становить <b>${fmt(cVal.rhLocal, 0)} %</b>, ` +
        `відносний вміст води у листках <b>RWC = ${fmt(cVal.rwc, 1)} %</b>, сформованість епікутикулярного воску — <b>${fmt(cVal.waxPct, 0)} %</b>. ` +
        (!stateC.agarWashed ? `<b>Увага:</b> незмитий агар із сахарозою на коренях провокує спалах грибної та бактеріальної кореневої гнилі!` : `Очікувана приживлюваність партії: <b>${fmt(cVal.surv, 1)} %</b>.`)
      );

      // Draw Stage C: Pot with peat:perlite:sand (1:1:1), humidity dome, plantlet turgor/wilting, and stomatal inset
      stC.clear();
      const c = stC.ctx, W = stC.W, H = stC.H, T = Theme.c;
      const px = W * 0.30;
      const botY = H * 0.84;
      const potW = 130, potH = 86;

      // Substrate pot (peat : perlite : sand = 1:1:1)
      c.fillStyle = "#5B4331";
      c.beginPath();
      c.moveTo(px - potW / 2, botY - potH);
      c.lineTo(px + potW / 2, botY - potH);
      c.lineTo(px + potW * 0.38, botY);
      c.lineTo(px - potW * 0.38, botY);
      c.closePath();
      c.fill();
      // White perlite granules in substrate
      const rP = rng(303);
      for (let i = 0; i < 32; i++) {
        c.fillStyle = "rgba(240,244,238,0.75)";
        c.beginPath();
        c.arc(px + (rP() - 0.5) * potW * 0.72, botY - potH + 10 + rP() * (potH - 18), 2.1, 0, 7);
        c.fill();
      }
      Gfx.text(c, "Субстрат: торф : перліт : пісок (1:1:1)", px, botY + 18, { align: "center", size: 11, weight: 600, color: T.ink });

      // Roots in substrate
      const soilTop = botY - potH;
      c.strokeStyle = stateC.agarWashed ? "#D8C698" : "#9E3B33";
      c.lineWidth = 1.8;
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.moveTo(px, soilTop);
        c.quadraticCurveTo(px + k * 14, soilTop + 34, px + k * 20, botY - 12);
        c.stroke();
      }

      // Plantlet shoot above soil (wilts if RWC < 70%)
      const wiltBend = clamp((78 - cVal.rwc) / 45, 0, 1) * 38;
      const stemTopX = px + wiltBend;
      const stemTopY = soilTop - 115 + wiltBend * 0.45;
      c.strokeStyle = "#2E854A";
      c.lineWidth = 3.2;
      c.beginPath();
      c.moveTo(px, soilTop);
      c.quadraticCurveTo(px + wiltBend * 0.3, soilTop - 60, stemTopX, stemTopY);
      c.stroke();

      // Leaves (droop downward when wilted)
      const droop = clamp((80 - cVal.rwc) / 40, 0, 1) * 0.85;
      for (let i = 1; i <= 4; i++) {
        const f = i / 4.2;
        const lx = lerp(px, stemTopX, f);
        const ly = lerp(soilTop - 15, stemTopY, f);
        const dir = i % 2 ? 1 : -1;
        c.fillStyle = cVal.rwc < 65 ? "#7C9B54" : "#2D8A4D";
        c.beginPath();
        c.ellipse(lx + dir * 18, ly + droop * 14, 16, 6.5, dir * (0.25 + droop), 0, 7);
        c.fill();
      }

      // Transparent acclimatization dome if gradual protocol & day < 13
      if (stateC.protocol === "gradual" && stateC.day < 13) {
        const lift = smooth(4, 13, stateC.day) * 26;
        c.save();
        Gfx.rr(c, px - 86, stemTopY - 38 - lift, 172, soilTop - stemTopY + 38, 28);
        c.fillStyle = "rgba(185,228,245,0.18)";
        c.fill();
        c.strokeStyle = "rgba(90,165,200,0.65)";
        c.lineWidth = 1.6;
        c.stroke();
        c.restore();
        Gfx.chip(c, `Купол: RH = ${fmt(cVal.rhLocal, 0)} %`, px, stemTopY - 48 - lift, { align: "center", bg: T.sheet, fg: T.data });
      }

      // Right side of Stage C: Stomatal aperture & Epicuticular wax closeup
      const rx0 = W * 0.58;
      const rw = W - rx0 - 16;
      const ry0 = H * 0.12;
      const rh = H * 0.74;
      if (rw > 140) {
        Gfx.rr(c, rx0, ry0, rw, rh, 10);
        c.fillStyle = T.sheet;
        c.fill();
        c.strokeStyle = T.rule;
        c.stroke();

        Gfx.text(c, `Анатомія листка на ${stateC.day}-ту добу ex vitro`, rx0 + rw / 2, ry0 + 22, { align: "center", size: 11.5, weight: 700, color: T.ink });

        // Guard cells & stomatal pore aperture (open wide at day 0, regulated narrow at day 14)
        const sCx = rx0 + rw / 2;
        const sCy = ry0 + rh * 0.42;
        const poreOpen = lerp(13, 3.2, (100 - cVal.gStomRel) / 80);

        // Left & right guard cells (замикаючі клітини продиху)
        c.fillStyle = "#3A9458";
        c.strokeStyle = "#1D5E33";
        c.lineWidth = 1.8;
        c.beginPath();
        c.ellipse(sCx - poreOpen - 10, sCy, 12, 26, 0.12, 0, 7);
        c.fill(); c.stroke();
        c.beginPath();
        c.ellipse(sCx + poreOpen + 10, sCy, 12, 26, -0.12, 0, 7);
        c.fill(); c.stroke();

        // Pore opening
        c.fillStyle = Theme.dark ? "#0D1711" : "#223328";
        c.beginPath();
        c.ellipse(sCx, sCy, poreOpen, 18, 0, 0, 7);
        c.fill();

        Gfx.text(c, `Продихова щілина: втрата води ${fmt(cVal.gStomRel, 0)} %`, sCx, sCy + 40, { align: "center", size: 10.5, weight: 600, color: T.ink });

        // Cuticular wax layer bar at bottom of inset
        const wy = ry0 + rh * 0.78;
        const waxH = 3 + (cVal.waxPct / 100) * 14;
        c.fillStyle = "#62AD75";
        c.fillRect(rx0 + 24, wy, rw - 48, 18);
        c.fillStyle = "#E8DFB0";
        c.fillRect(rx0 + 24, wy - waxH, rw - 48, waxH);
        Gfx.text(c, `Епікутикулярний віск (${fmt(cVal.waxPct, 0)} % норми)`, sCx, wy - waxH - 7, { align: "center", size: 10.5, weight: 600, color: T.carot });
      }

      // Chart C1: RWC(t) comparing current protocol vs alternative
      drawChart(chC1, {
        x: [0, 14], y: [25, 100],
        xl: "Час після пересаджування у субстрат ex vitro, діб",
        yl: "Відносний вміст води RWC, %",
        hl: [{ y: 70, color: T.bad, dash: [4, 3], label: "Поріг летального в'янення (70 %)" }],
        vl: [{ x: stateC.day, color: T.ink, dash: [3, 3], label: `${stateC.day} доба` }],
        series: [
          { pts: res.ptsRWC, color: T.chl, w: 2.6 },
          { pts: altRes.ptsRWC, color: T.warn, w: 2.0, dash: [5, 3] }
        ],
        marks: [
          { x: stateC.day, y: cVal.rwc, color: T.chl, label: `${fmt(cVal.rwc, 0)}%` }
        ],
        legend: [
          { label: stateC.protocol === "gradual" ? "Поступова адаптація (поточна)" : "Різке відкриття (поточне)", color: T.chl },
          { label: stateC.protocol === "gradual" ? "Різке відкриття (порівняння)" : "Поступова адаптація (порівняння)", color: T.warn }
        ]
      });

      // Chart C2: Wax formation & Stomatal conductance over 14 days
      drawChart(chC2, {
        x: [0, 14], y: [0, 105],
        xl: "Час акліматизації ex vitro, діб",
        yl: "Віск (%) / Продихова транспірація (%)",
        vl: [{ x: stateC.day, color: T.ink, dash: [3, 3] }],
        series: [
          { pts: res.ptsWax, color: T.chl, w: 2.5 },
          { pts: res.ptsCond, color: T.data, w: 2.2, dash: [4, 3] }
        ],
        legend: [
          { label: "Накопичення кутикулярного воску (%)", color: T.chl },
          { label: "Неконтрольована транспірація g_s (%)", color: T.data }
        ]
      });
    }

    modes.init();

    return {
      stages: [stA, chA1, chA2, stB, chB1, chB2, stC, chC1, chC2],
      frame(dt, time) {
        if (modes.cur === "a") {
          if (dt > 0 || dirty || stA.dirty || chA1.dirty || chA2.dirty) {
            drawA(time);
            dirty = false; stA.dirty = false; chA1.dirty = false; chA2.dirty = false;
          }
        } else if (modes.cur === "b") {
          if (dt > 0 || dirty || stB.dirty || chB1.dirty || chB2.dirty) {
            drawB(time);
            dirty = false; stB.dirty = false; chB1.dirty = false; chB2.dirty = false;
          }
        } else if (modes.cur === "c") {
          if (dt > 0 || dirty || stC.dirty || chC1.dirty || chC2.dirty) {
            drawC(time);
            dirty = false; stC.dirty = false; chC1.dirty = false; chC2.dirty = false;
          }
        }
      }
    };
  }
});
})();
