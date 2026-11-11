(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

App.def(12, {
  cheat: `
    <p class="lead">
      Оксидоредуктази рослинної клітини — <b>гваяколова пероксидаза</b> (ПО, КФ 1.11.1.7) та <b>поліфенолоксидаза</b> (ПФО, <i>o</i>-дифенолоксидаза, КФ 1.10.3.1) — є чутливими молекулярними маркерами окиснювального стресу (засолення, важких металів, дії фітопатогенів), а також біохімічними індикаторами <b>диференціації клітин, ризогенезу та соматичного ембріогенезу <i>in vitro</i></b> (лабораторні роботи № 51–53, с. 184–190).
    </p>

    <h3>1. Спектрофотометричне визначення активності пероксидази (ЛР 51) та поліфенолоксидази (ЛР 53)</h3>
    <p>
      <b>Пероксидаза (КФ 1.11.1.7)</b> — гемвмісний фермент (містить залізопорфіриновий простетичний гем <i>b</i>), який каталізує окиснення широкого спектра фенольних та ароматичних субстратів за рахунок пероксиду водню (H<sub>2</sub>O<sub>2</sub>). У рослинних тканинах пероксидаза знешкоджує надлишок H<sub>2</sub>O<sub>2</sub>, регулює рівень ендогенного ауксину (як ІОК-оксидаза, каталізуючи окиснювальне декарбоксилювання індоліл-3-оцтової кислоти) та забезпечує полімеризацію монолігнолів під час лігніфікації клітинної стінки. У лабораторній роботі № 51 активність ферменту визначають за швидкістю окиснення безбарвного <b>гваяколу (<i>o</i>-метоксифенолу)</b> пероксидом водню до забарвленого в інтенсивний червоно-бурий колір <b>тетрагваяколу</b> з максимумом поглинання при <b>λ = 470 нм</b>:
    </p>
    <div class="eq">
      4 Гваякол + 4 H<sub>2</sub>O<sub>2</sub> &nbsp;→<sup>Пероксидаза (Fe<sup>3+</sup>)</sup>&nbsp; Тетрагваякол (червоно-бурий, λ<sub>max</sub> = 470 нм) + 8 H<sub>2</sub>O
    </div>
    <p>
      <b>Поліфенолоксидаза (ПФО, тирозиназа, КФ 1.10.3.1)</b> — мідьвмісний фермент (містить два іони Cu<sup>2+</sup> в активному центрі), який за участю молекулярного кисню (O<sub>2</sub>, без участі H<sub>2</sub>O<sub>2</sub>!) окиснює орто-дифеноли до відповідних високореакційних <b>орто-хінонів</b>. Саме ПФО зумовлює швидке потемніння (фенольне побуріння та некротизацію) зрізів первинних експлантатів при введенні їх у культуру <i>in vitro</i>. У лабораторній роботі № 53 активність ПФО визначають за окисненням <b>пірокатехіну (1,2-дигідроксібензолу)</b> до жовто-коричневого <i>o</i>-бензохінону при <b>λ = 420 нм</b>:
    </p>
    <div class="eq">
      2 Пірокатехін + O<sub>2</sub> &nbsp;→<sup>Поліфенолоксидаза (Cu<sup>2+</sup>)</sup>&nbsp; 2 <i>o</i>-Бензохінон (λ<sub>max</sub> = 420 нм) + 2 H<sub>2</sub>O
    </div>

    <div class="bcall bcall--model">
      <b>Розрахункова формула активності ферменту (ЛР 51, 53, с. 185, 190)</b>
      <p>
        Оптичну густину реакційної суміші в кюветі (<i>l</i> = 10 мм) реєструють кожні <b>20 с протягом 2 хв</b> (<i>t</i> = 0, 20, 40, 60, 80, 100, 120 с). Активність ферменту <i>A</i> (в умовних одиницях зміни оптичної густини за 1 хв на 1 г сирої маси тканини з урахуванням розведень) обчислюють за формулою:
      </p>
      <div class="eq">
        <i>A</i> = [ (<i>D</i><sub>2</sub> − <i>D</i><sub>1</sub>) · <i>V</i> · <i>V</i><sub>2</sub> · 60 ] / [ (<i>t</i><sub>2</sub> − <i>t</i><sub>1</sub>) · <i>V</i><sub>1</sub> · <i>H</i> ]
      </div>
      <p>
        де <i>D</i><sub>1</sub> і <i>D</i><sub>2</sub> — початкова (<i>t</i><sub>1</sub> = 0 с) та кінцева (<i>t</i><sub>2</sub> = 120 с) оптична густина розчину; <i>V</i> — загальний об’єм буферного екстракту (25 мл); <i>V</i><sub>1</sub> — об’єм ферментної витяжки, взятий у кювету (0,5 мл); <i>V</i><sub>2</sub> — загальний об’єм реакційної суміші в кюветі (3,0 мл); <i>t</i><sub>2</sub> − <i>t</i><sub>1</sub> = 120 с — час реакції; 60 — коефіцієнт перерахунку секунд у хвилини; <i>H</i> — наважка рослинної тканини (0,5 г).
      </p>
    </div>

    <h3>2. Вертикальний диск-електрофорез ізоферментів пероксидази в ПААГ за Девісом (ЛР 52)</h3>
    <p>
      Пероксидаза вищих рослин представлена множинними молекулярними формами — <b>ізоферментами (ізозимами)</b>, які кодуються мультигенною родиною або виникають внаслідок посттрансляційної глікозиляції. Вони каталізують ту саму реакцію, але відрізняються за сумарним електричним зарядом, ізоелектричною точкою (pI), молекулярною масою та спорідненістю до субстратів. Спектр ізоферментів (<b>зимограма</b>) є видо- і тканиноспецифічним генетичним паспортом і закономірно змінюється під час калюсогенезу, соматичного ембріогенезу та стресової адаптації.
    </p>
    <p>
      Для розділення кислих (аніонних) ізоферментів пероксидази застосовують <b>лужний диск-електрофорез у поліакриламідному гелі (ПААГ) за методом Б. Девіса (B. Davis, 1964)</b> (ЛР 52, с. 186–189). Назва «диск-електрофорез» походить від англ. <i>discontinuous</i> — переривчастий (неоднорідний за pH і розміром пор гелю):
    </p>
    <div class="tblwrap">
      <table class="t bt">
        <thead>
          <tr>
            <th>Елемент системи Девіса</th>
            <th>Склад та pH</th>
            <th>Фізико-хімічний механізм (ефект Кольрауша)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Електродний буфер</td>
            <td>Трис-гліциновий буфер, <b>pH 8,3</b></td>
            <td>Забезпечує потік замикаючих цвітеріонів гліцину з верхньої (катодної, −) до нижньої (анодної, +) камери.</td>
          </tr>
          <tr>
            <td>Концентруючий гель (верхній)</td>
            <td><b>2,5 % ПААГ, pH 6,7</b> (Трис-HCl)</td>
            <td>Крупнопористий гель без ефекту молекулярного сита. При pH 6,7 іони хлору (Cl<sup>−</sup>) мають високу рухливість, а гліцин майже не дисоційований (рухливість мінімальна). Білки опиняються між фронтом Cl<sup>−</sup> і хвостом гліцину та стискаються у надтонкий диск (~20 мкм).</td>
          </tr>
          <tr>
            <td>Розділяючий гель (нижній)</td>
            <td><b>7,5 % ПААГ, pH 8,9</b> (Трис-HCl + ПСА + ТЕМЕД)</td>
            <td>При переході у pH 8,9 гліцин дисоціює, стає високорухливим аніоном і обганяє білки. Далі ізоферменти рухаються в однорідному полі й розділяються як за величиною негативного заряду, так і за ефектом молекулярного сита дрібнопористого 7,5 % гелю.</td>
          </tr>
          <tr>
            <td>Гістохімічне проявлення</td>
            <td>Бензидин + аскорбінова кислота + H<sub>2</sub>O<sub>2</sub> (або гваякол)</td>
            <td>Після завершення форезу гель занурюють у субстратну суміш. Спочатку аскорбінова кислота відновлює радикали бензидину (лаг-період), а після її вичерпання на місці кожної ізоформи з’являються чіткі <b>сині смуги</b> окисненого бензидину, що згодом переходять у коричневі.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Кожну виявлену ізоформу характеризують величиною <b>відносної електрофоретичної рухливості <i>R<sub>f</sub></i></b> (від англ. <i>relative front</i>):
    </p>
    <div class="eq">
      <i>R<sub>f</sub></i> = <i>l</i><sub>ізоферменту</sub> / <i>l</i><sub>бромфенолового синього</sub>
    </div>
    <p>
      де <i>l</i><sub>ізоферменту</sub> — відстань (мм) від межі розділяючого гелю до середини забарвленої смуги ізоферменту; <i>l</i><sub>бромфенолового синього</sub> — відстань (мм) від початку розділяючого гелю до лідируючої смуги маркерного барвника бромфенолового синього. За величиною <i>R<sub>f</sub></i> ізоферменти поділяють на повільнорухомі (<i>R<sub>f</sub></i> = 0,10–0,35, високомолекулярні, пов’язані з клітинними стінками і лігніфікацією), середньорухомі (<i>R<sub>f</sub></i> = 0,36–0,65) та швидкорухомі анодні ізоформи (<i>R<sub>f</sub></i> = 0,66–0,90, низькомолекулярні стресові та ембріоспецифічні форми).
    </p>

    <details class="bproto">
      <summary>Хід роботи (Лабораторна робота № 51 — Визначення активності пероксидази за Бояркіним / гваяколовим методом)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Екстракція ферменту:</b> наважку рослинної тканини <i>H</i> = 0,5 г (листок або калюс) розтирають в охолодженій фарфоровій ступці на льоду з 0,06 М фосфатним буфером (pH 7,0) та кварцовим піском. Гомогенат кількісно переносять у мірну колбу на <i>V</i> = 25 мл, доводять буфером до мітки і центрифугують 15 хв при 6000 об/хв (при +4 °C).</li>
          <li><b>Приготування реакційної суміші в кюветі:</b> у робочу спектрофотометричну кювету (<i>l</i> = 10 мм) вносять 2,0 мл фосфатного буфера (pH 7,0), <i>V</i><sub>1</sub> = 0,5 мл прозорого надосадового ферментного екстракту та 0,3 мл 0,1 % розчину гваяколу. У контрольний розчин замість H<sub>2</sub>O<sub>2</sub> додають 0,2 мл дистильованої води.</li>
          <li><b>Запуск реакції та хронометраж:</b> встановлюють довжину хвилі спектрофотометра λ = 470 нм, швидко вносять у робочу кювету 0,2 мл 0,03 % розчину пероксиду водню (H<sub>2</sub>O<sub>2</sub>, загальний об’єм суміші <i>V</i><sub>2</sub> = 3,0 мл), перемішують скляною паличкою і вмикають секундомір. Фіксують оптичну густину <i>D</i> кожні 20 с протягом 2 хв (0, 20, 40, 60, 80, 100, 120 с).</li>
          <li><b>Розрахунок активності:</b> за лінійною ділянкою приросту оптичної густини (<i>D</i><sub>2</sub> − <i>D</i><sub>1</sub>) обчислюють активність пероксидази за формулою <i>A</i> = [ (<i>D</i><sub>2</sub> − <i>D</i><sub>1</sub>) · <i>V</i> · <i>V</i><sub>2</sub> · 60 ] / [ (<i>t</i><sub>2</sub> − <i>t</i><sub>1</sub>) · <i>V</i><sub>1</sub> · <i>H</i> ].</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи (Лабораторна робота № 52 — Диск-електрофорез ізоферментів пероксидази в ПААГ за Девісом)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Полімеризація двошарового гелю:</b> у скляні трубочки або вертикальну касету заливають розчин нижнього дрібнопористого розділяючого гелю (7,5 % ПААГ, Трис-HCl pH 8,9 з ПСА і ТЕМЕД), нашаровують зверху воду для вирівнювання меніска. Після полімеризації (30 хв) воду зливають і нашаровують верхній крупнопористий концентруючий гель (2,5 % ПААГ, pH 6,7) зі вставленим гребінцем.</li>
          <li><b>Нанесення проб та електрофорез:</b> ферментні екстракти змішують із сахарозою (до 20 % для обважнення) та слідами бромфенолового синього, вносять по 40–60 мкл у лунки під шар трис-гліцинового електродного буфера (pH 8,3). Перші 20 хв (проходження концентруючого гелю) підтримують силу струму 1,5–2 мА на доріжку, а після входження барвника у розділяючий гель — 3–4 мА на доріжку при +4 °C до підходу лідируючого барвника за 5 мм до нижнього краю.</li>
          <li><b>Гістохімічне виявлення зимограми:</b> гель виймають із форми, вимірюють пробіг бромфенолового синього (<i>l</i><sub>БФС</sub>) і занурюють у розчин бензидину з аскорбіновою кислотою на 5 хв, після чого додають 0,3 % H<sub>2</sub>O<sub>2</sub>. Відмічають час появи синіх зон ізоферментів, промивають гель водою, вимірюють відстань міграції кожної смуги (<i>l<sub>i</sub></i>) та розраховують <i>R<sub>f</sub></i> = <i>l<sub>i</sub></i> / <i>l</i><sub>БФС</sub>.</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи (Лабораторна робота № 53 — Визначення активності поліфенолоксидази)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Приготування ферментної витяжки:</b> <i>H</i> = 0,5 г тканини бульби картоплі або калюсу гомогенізують на холоді у <i>V</i> = 25 мл 0,06 М фосфатним буфером (pH 6,8–7,0) і центрифугують 15 хв при 6000 об/хв.</li>
          <li><b>Спектрофотометричне вимірювання при 420 нм:</b> у кювету (<i>l</i> = 10 мм) вносять 2,0 мл фосфатного буфера, <i>V</i><sub>1</sub> = 0,5 мл ферментної витяжки та швидко додають 0,5 мл свіжоприготованого 0,05 М розчину пірокатехіну (<i>V</i><sub>2</sub> = 3,0 мл). Реєструють наростання оптичної густини при λ = 420 нм кожні 20 с протягом 2 хв і обчислюють активність ПФО за тією ж розрахунковою формулою.</li>
        </ol>
      </div>
    </details>
  `,

  qa: [
    [
      "Чому для реакції пероксидази (ЛР 51) необхідне внесення пероксиду водню H₂O₂, а для поліфенолоксидази (ЛР 53) реакція йде без H₂O₂?",
      "<p>Ці ферменти належать до різних підкласів оксидоредуктаз і мають різні простетичні групи та кінцеві акцептори електронів: <b>пероксидаза (КФ 1.11.1.7)</b> містить гем (Fe<sup>3+</sup>) і використовує як акцептор електронів виключно <b>пероксид водню (H<sub>2</sub>O<sub>2</sub>)</b>; натомість <b>поліфенолоксидаза (КФ 1.10.3.1)</b> є мідьвмісною оксидазою (Cu<sup>2+</sup>), яка окиснює орто-дифеноли безпосередньо <b>молекулярним киснем повітря (O<sub>2</sub>)</b> до орто-хінонів.</p>"
    ],
    [
      "Як і чому змінюється активність пероксидази в рослинних тканинах за дії сольового стресу, важких металів або інфікування патогеном?",
      "<p>Будь-який абіотичний чи біотичний стрес спричиняє в клітинах «окиснювальний вибух» — різке накопичення активних форм кисню (АФК: супероксид-радикала O<sub>2</sub><sup>•−</sup> та пероксиду водню H<sub>2</sub>O<sub>2</sub>). У відповідь у клітині вмикається експресія генів захисних антиоксидантних ферментів: <b>активність пероксидази зростає у 2–4 рази</b> для детоксикації H<sub>2</sub>O<sub>2</sub> та зміцнення клітинних стінок шляхом прискореної лігніфікації і суберинізації (утворення механічного бар’єра проти патогена).</p>"
    ],
    [
      "Яка роль високоактивної поліфенолоксидази при введенні первинних експлантатів деревних і бульбових культур in vitro і як запобігти побурінню?",
      "<p>При механічному розрізанні тканини вакуолярні фенольні сполуки (хлорогенова кислота, тирозин, катехіни) контактують із цитоплазматичною та пластидною <b>поліфенолоксидазою (ПФО)</b>. Фермент окиснює їх киснем повітря до високотоксичних коричневих <b>орто-хінонів</b>, які необоротно інактивують білки й зумовлюють некроз експлантата. Для запобігання цьому до середовища додають антиоксиданти (аскорбінову чи лимонну кислоту, глутатіон, цистеїн) або сорбенти фенолів (активоване вугілля, полівінілпіролідон — ПВП).</p>"
    ],
    [
      "Для чого в системі диск-електрофорезу за Девісом (ЛР 52) використовують два шари гелю з різною концентрацією акриламіду (2,5 % і 7,5 %) та різним pH (6,7 і 8,9)?",
      "<p>Верхній крупнопористий <b>концентруючий гель (2,5 %, pH 6,7)</b> забезпечує <b>ізотахофоретичне концентрування</b> проби: при pH 6,7 гліцин майже не має заряду і рухається дуже повільно, а хлорид-іони (Cl<sup>−</sup>) рухаються швидко. Усі білки проби вишиковуються на межі між Cl<sup>−</sup> та гліцином, стискаючись із об’єму 50 мкл у надтонку стартову смужку (~20 мкм). Коли ця смужка входить у нижній <b>розділяючий гель (7,5 %, pH 8,9)</b>, гліцин дисоціює, обганяє білки, і попередньо сконцентровані ізоферменти дають надзвичайно вузькі, чіткі смуги зимограми.</p>"
    ],
    [
      "Що таке відносна електрофоретична рухливість ізоферменту Rf і чому вона не залежить від загальної тривалості електрофорезу?",
      "<p>Величина <i>R<sub>f</sub></i> = <i>l</i><sub>ізоферменту</sub> / <i>l</i><sub>бромфенолового синього</sub> показує відношення шляху, пройденого даним ізоферментом у розділяючому гелі, до шляху лідируючого низькомолекулярного барвника бромфенолового синього, що рухається разом із фронтом хлорид-іонів. Оскільки і білок, і барвник рухаються пропорційно напруженості поля та часу, їхнє відношення <i>R<sub>f</sub></i> ∈ (0; 1) є відтворюваною фізико-хімічною константою кожної ізоформи за даної концентрації ПААГ та pH.</p>"
    ]
  ],

  build({ stageBox, ctrls, below, tabsBox }) {
    const modes = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Спектрофотометрична кінетика пероксидази та ПФО (ЛР 51, 53)"],
      ["b", "Б. ПААГ диск-електрофорез ізоферментів пероксидази за Девісом (ЛР 52)"]
    ]);

    /* ==================== TAB A: SPECTROPHOTOMETRIC KINETICS (ЛР 51, 53) ==================== */
    const boxA = modes.box("a");
    const stA = new Stage(boxA.st, { aspect: 1.68, minH: 315, maxH: 480, minW: 580, tag: "ЛР 51, 53 · A = (D₂ − D₁)·V·V₂·60 / ((t₂ − t₁)·V₁·H) · Кювета l = 10 мм" });

    const STRESS_PROFILES = {
      ctrl:   { name: "Інтактний листок (контроль)",      d1_pox: 0.045, rate_pox: 0.24, d1_ppo: 0.040, rate_ppo: 0.16, note: "Базальний фізіологічний рівень антиоксидантного захисту за відсутності стресу." },
      callus: { name: "Ембріогенний калюс in vitro",     d1_pox: 0.052, rate_pox: 0.44, d1_ppo: 0.048, rate_ppo: 0.25, note: "Висока активність пероксидази супроводжує диференціацію клітинних стінок і закладку соматичних ембріоїдів." },
      salt:   { name: "Сольовий стрес (150 мМ NaCl)",    d1_pox: 0.060, rate_pox: 0.62, d1_ppo: 0.055, rate_ppo: 0.36, note: "Осмотичний та іонний стрес індукує синтез ізоферментів пероксидази для детоксикації H₂O₂." },
      metal:  { name: "Важкі метали (Cd²⁺ / Pb²⁺)",      d1_pox: 0.065, rate_pox: 0.74, d1_ppo: 0.062, rate_ppo: 0.48, note: "Іони важких металів викликають сильний окиснювальний стрес і активацію як пероксидази, так і ПФО." },
      patho:  { name: "Інфекція патогеном / поранення",  d1_pox: 0.070, rate_pox: 0.88, d1_ppo: 0.075, rate_ppo: 0.72, note: "Максимальна активація обох ферментів: пероксидаза зміцнює клітинні стінки лігніном, а ПФО генерує бактерицидні орто-хінони." }
    };

    const stateA = {
      enz: "pox",      // "pox" (Пероксидаза 470 нм, ЛР 51) | "ppo" (Поліфенолоксидаза 420 нм, ЛР 53)
      stress: "salt",  // key in STRESS_PROFILES
      H: 0.50,         // г наважка тканини (за методикою 0,5 г)
      V: 25,           // мл загальний об'єм екстракту (за методикою 25 мл)
      V1: 0.50,        // мл об'єм витяжки в кюветі (за методикою 0,5 мл)
      V2: 3.0          // мл загальний об'єм суміші в кюветі (2,0 буфер + 0,5 витяжка + 0,5 субстрати)
    };

    UI.seg(boxA.ct, {
      label: "Досліджуваний фермент та довжина хвилі",
      options: [
        ["pox", "ЛР 51: Пероксидаза (470 нм)"],
        ["ppo", "ЛР 53: ПФО (420 нм)"]
      ],
      value: stateA.enz,
      on: v => { stateA.enz = v; updateA(); }
    });

    UI.select(boxA.ct, {
      id: "l12a-stress", label: "Фізіологічний стан / стресовий чинник",
      options: Object.entries(STRESS_PROFILES).map(([k, v]) => [k, v.name]),
      value: stateA.stress,
      on: v => { stateA.stress = v; updateA(); }
    });

    const slHA = UI.slider(boxA.ct, {
      id: "l12a-h", label: "Наважка рослинної тканини H", min: 0.20, max: 1.50, step: 0.05, value: stateA.H, unit: "г",
      fmt: v => fmt(v, 2), on: v => { stateA.H = v; updateA(); }
    });
    const slVA = UI.slider(boxA.ct, {
      id: "l12a-v", label: "Загальний об’єм гомогенату V", min: 10, max: 50, step: 5, value: stateA.V, unit: "мл",
      fmt: v => fmt(v, 0), on: v => { stateA.V = v; updateA(); }
    });
    const slV1A = UI.slider(boxA.ct, {
      id: "l12a-v1", label: "Аліквота витяжки в кюветі V₁", min: 0.20, max: 1.00, step: 0.05, value: stateA.V1, unit: "мл",
      fmt: v => fmt(v, 2), on: v => { stateA.V1 = v; updateA(); }
    });

    UI.buttons(boxA.ct, [
      {
        label: "Стандарт практикуму (H=0,5 г; V=25 мл; V₁=0,5 мл)", pri: true, on: () => {
          slHA.set(stateA.H = 0.50); slVA.set(stateA.V = 25); slV1A.set(stateA.V1 = 0.50); updateA();
        }
      },
      {
        label: "Контроль vs Патоген", on: () => {
          stateA.stress = stateA.stress === "patho" ? "ctrl" : "patho";
          $("#l12a-stress").value = stateA.stress;
          updateA();
        }
      }
    ]);

    const readsA = UI.reads(boxA.bl, [
      ["d1d2", "Оптична густина D₁ (0 с) → D₂ (120 с)"],
      ["dD", "Приріст ΔD = D₂ − D₁ за 120 с"],
      ["act", "Активність ферменту A (за формулою)"],
      ["fold", "Кратність індукції відносно контролю"]
    ]);
    const outA = UI.out(boxA.bl, "");
    const chartsA = h("div", { class: "charts" });
    boxA.bl.append(chartsA);
    const chKinA = UI.chart(chartsA, "Кінетика ферментативної реакції D(t) з кроком 20 с (0–120 с)");
    const chBarA = UI.chart(chartsA, "Порівняння питомої активності A за різних стресових станів");

    // Optical density at time tSec (0..120 s) scales with enzyme concentration in cuvette: (H / V) * (V1 / V2)
    function dAtTime(tSec, stressKey = stateA.stress, enz = stateA.enz, H = stateA.H, V = stateA.V, V1 = stateA.V1, V2 = stateA.V2) {
      const pr = STRESS_PROFILES[stressKey];
      const baseD1 = enz === "pox" ? pr.d1_pox : pr.d1_ppo;
      const baseRate = enz === "pox" ? pr.rate_pox : pr.rate_ppo; // deltaD over 120 s under standard H=0.5, V=25, V1=0.5, V2=3.0
      const concScale = (H / 0.50) * (25 / V) * (V1 / 0.50) * (3.0 / V2);
      const d1 = baseD1 * clamp(concScale, 0.25, 2.8);
      // Slight substrate saturation curvature at high OD
      const rawDelta = baseRate * concScale * (tSec / 120) * (1 - 0.08 * Math.pow(tSec / 120, 2));
      return d1 + rawDelta;
    }

    function modelA(stressKey = stateA.stress, enz = stateA.enz, H = stateA.H, V = stateA.V, V1 = stateA.V1, V2 = stateA.V2) {
      const times = [0, 20, 40, 60, 80, 100, 120];
      const pts = times.map(t => [t, dAtTime(t, stressKey, enz, H, V, V1, V2)]);
      const D1 = pts[0][1], D2 = pts[pts.length - 1][1];
      const dD = D2 - D1;
      const dtSec = 120;
      // Exact textbook formula: A = (D2 - D1) * V * V2 * 60 / ((t2 - t1) * V1 * H)
      const A = (dD * V * V2 * 60) / (dtSec * V1 * H);
      const A_ctrl = ((dAtTime(120, "ctrl", enz, H, V, V1, V2) - dAtTime(0, "ctrl", enz, H, V, V1, V2)) * V * V2 * 60) / (dtSec * V1 * H);
      const fold = A / Math.max(1e-6, A_ctrl);
      return { pts, D1, D2, dD, A, A_ctrl, fold, pr: STRESS_PROFILES[stressKey] };
    }

    function updateA() {
      const m = modelA();
      const lam = stateA.enz === "pox" ? 470 : 420;
      const enzName = stateA.enz === "pox" ? "пероксидази (λ = 470 нм, тетрагваякол)" : "поліфенолоксидази (λ = 420 нм, о-бензохінон)";

      readsA.set("d1d2", `${fmt(m.D1, 3)} → ${fmt(m.D2, 3)}`, `о.о.г. (λ = ${lam} нм)`);
      readsA.set("dD", fmt(m.dD, 3), "о.о.г. за 120 с");
      readsA.set("act", fmt(m.A, 2), "ум. од. / (г·хв)");
      readsA.set("fold", `${fmt(m.fold, 2)}×`, "відносно інтактного контролю");

      outA.el.className = "bout " + (m.fold > 1.8 ? "warn" : "good");
      outA.set(
        `<b>Покрокова підстановка у формулу практикуму (${stateA.enz === "pox" ? "ЛР 51, с. 185" : "ЛР 53, с. 190"}):</b><br>` +
        `<i>A</i> = [ (<i>D</i><sub>2</sub> − <i>D</i><sub>1</sub>) · <i>V</i> · <i>V</i><sub>2</sub> · 60 ] / [ (<i>t</i><sub>2</sub> − <i>t</i><sub>1</sub>) · <i>V</i><sub>1</sub> · <i>H</i> ] = ` +
        `[ (${fmt(m.D2, 3)} − ${fmt(m.D1, 3)}) · ${fmt(stateA.V, 0)} · ${fmt(stateA.V2, 1)} · 60 ] / [ 120 · ${fmt(stateA.V1, 2)} · ${fmt(stateA.H, 2)} ] = ` +
        `<b>${fmt(m.A, 2)} ум. од./(г·хв)</b>.<br>` +
        `Для варіанту «<b>${m.pr.name}</b>» активність ${enzName} становить <b>${fmt(m.fold, 2)}×</b> від контрольного рівня. ${m.pr.note}`
      );

      drawChartsA();
      stA.dirty = true;
    }

    function drawChartsA() {
      const T = Theme.c;
      const m = modelA();
      const mCtrl = modelA("ctrl");

      const fineCur = [], fineCtrl = [];
      for (let t = 0; t <= 120; t += 4) {
        fineCur.push([t, dAtTime(t, stateA.stress, stateA.enz)]);
        fineCtrl.push([t, dAtTime(t, "ctrl", stateA.enz)]);
      }

      drawChart(chKinA, {
        x: [0, 120], y: [0, Math.max(0.85, m.D2 * 1.18)],
        xt: [0, 20, 40, 60, 80, 100, 120],
        xl: "Час ферментативної реакції t (с)", yl: `Оптична густина D (${stateA.enz === "pox" ? "470" : "420"} нм)`,
        series: [
          { pts: fineCur, color: stateA.enz === "pox" ? T.warn : T.carot, w: 2.5, fill: rgba(stateA.enz === "pox" ? T.warn : T.carot, 0.12) },
          { pts: m.pts, color: stateA.enz === "pox" ? T.warn : T.carot, w: 0, dots: 4.2 },
          { pts: fineCtrl, color: T.muted, w: 1.8, dash: [5, 4] }
        ],
        marks: [
          { x: 0, y: m.D1, r: 4.5, color: T.ink, label: `D₁=${fmt(m.D1, 2)}` },
          { x: 120, y: m.D2, r: 5.5, color: T.bad, align: "right", label: `D₂=${fmt(m.D2, 2)}` }
        ],
        legend: [
          { color: stateA.enz === "pox" ? T.warn : T.carot, label: `${m.pr.name} (кожні 20 с)` },
          { color: T.muted, label: "Інтактний контроль" }
        ]
      });

      const keys = Object.keys(STRESS_PROFILES);
      const shortLabels = ["Контр.", "Калюс", "NaCl", "Cd²⁺", "Патоген"];
      const barPts = keys.map((k, idx) => [idx + 1, modelA(k, stateA.enz).A]);
      const curIdx = keys.indexOf(stateA.stress) + 1;

      drawChart(chBarA, {
        x: [0.4, 5.6], y: [0, Math.max(85, ...barPts.map(p => p[1])) * 1.15],
        xt: [1, 2, 3, 4, 5],
        xfmt: v => shortLabels[Math.round(v) - 1] || "",
        xl: "Варіант досліду", yl: "Активність A, ум. од./(г·хв)",
        series: [
          { pts: barPts, bars: true, bw: 28, color: rgba(stateA.enz === "pox" ? T.chl : T.carot, 0.72) }
        ],
        marks: [
          { x: curIdx, y: m.A, r: 5.5, color: T.bad, label: `${fmt(m.A, 1)}` }
        ],
        legend: [
          { color: stateA.enz === "pox" ? T.chl : T.carot, label: stateA.enz === "pox" ? "Пероксидаза (470 нм)" : "Поліфенолоксидаза (420 нм)" }
        ]
      });
    }

    function drawStageA(dt, t) {
      const c = stA.ctx, W = stA.W, H = stA.H, T = Theme.c;
      stA.clear();
      const m = modelA();
      const pad = 10, leftW = W * 0.44;

      // Real-time cyclic reaction timer 0 -> 120 s (loops smoothly every 10 seconds of animation)
      const simSec = ((t * 14) % 135);
      const curSec = clamp(simSec, 0, 120);
      const curD = dAtTime(curSec);
      const lam = stateA.enz === "pox" ? 470 : 420;
      const cuvCol = stateA.enz === "pox"
        ? Spectral.colorOf({ guaiacol: curD * 1.35 })
        : Spectral.colorOf({ quinone: curD * 1.45 });

      // Left: Animated Spectrophotometer with real-time cuvette color
      Gfx.spectro(c, pad, pad, leftW - pad * 1.5, H - pad * 2, {
        lam,
        A: curD,
        text: `t=${fmt(curSec, 0)}с · D=${fmt(curD, 3)}`,
        col: cuvCol,
        sub: stateA.enz === "pox"
          ? "Кювета 10 мм: гваякол + H₂O₂ → тетрагваякол (червоно-бурий)"
          : "Кювета 10 мм: пірокатехін + O₂ → о-бензохінон (жовто-бурий)"
      });

      // Right Card: 7-point 20-second kinetic table & reaction scheme
      const rx0 = leftW + pad * 0.5, rw = W - leftW - pad * 1.5;
      Gfx.rr(c, rx0, pad, rw, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();

      Gfx.text(c, stateA.enz === "pox"
        ? "Журнал вимірювань оптичної густини D₄₇₀ кожні 20 с (ЛР 51)"
        : "Журнал вимірювань оптичної густини D₄₂₀ кожні 20 с (ЛР 53)",
        rx0 + 14, pad + 20, { weight: 700, size: 12, color: T.ink });

      // Draw 7 mini-cuvettes / time slots for t = 0, 20, 40, 60, 80, 100, 120 s
      const slotW = (rw - 28) / 7, slotY = pad + 42, slotH = H * 0.44;
      m.pts.forEach(([sec, dVal], i) => {
        const sx = rx0 + 14 + i * slotW;
        const active = curSec >= sec;
        const col = stateA.enz === "pox"
          ? Spectral.colorOf({ guaiacol: dVal * 1.35 })
          : Spectral.colorOf({ quinone: dVal * 1.45 });

        Gfx.rr(c, sx + 3, slotY, slotW - 6, slotH, 7);
        c.fillStyle = active ? rgba(T.chl, 0.09) : T.paper;
        c.fill();
        c.strokeStyle = (i === 0 || i === 6) ? T.chl : T.rule;
        c.lineWidth = (i === 0 || i === 6) ? 1.6 : 1;
        c.stroke();

        // Mini cuvette color swatch inside slot
        const cw = slotW - 16, ch = slotH * 0.48, cx2 = sx + 8, cy2 = slotY + 24;
        Gfx.rr(c, cx2, cy2, cw, ch, 4);
        c.fillStyle = col; c.fill();
        c.strokeStyle = rgba(T.ink, 0.35); c.lineWidth = 1; c.stroke();

        Gfx.text(c, `${sec} с`, sx + slotW / 2, slotY + 15, { align: "center", size: 10, font: "mono", weight: 700, color: T.ink });
        Gfx.text(c, fmt(dVal, 3), sx + slotW / 2, cy2 + ch + 16, { align: "center", size: 10, font: "mono", weight: 700, color: (i === 0 || i === 6) ? T.chl : T.ink });
        if (i === 0) Gfx.text(c, "(D₁)", sx + slotW / 2, cy2 + ch + 29, { align: "center", size: 9, font: "mono", color: T.muted });
        if (i === 6) Gfx.text(c, "(D₂)", sx + slotW / 2, cy2 + ch + 29, { align: "center", size: 9, font: "mono", color: T.chl });
      });

      // Summary box at bottom of Right Card
      const by = slotY + slotH + 14, bh = H - pad - by - 10;
      Gfx.rr(c, rx0 + 14, by, rw - 28, bh, 9);
      c.fillStyle = T.paper; c.fill(); c.strokeStyle = T.rule; c.stroke();

      Gfx.text(c, `Склад кювети (V₂ = ${fmt(stateA.V2, 1)} мл): 2,0 мл фосфатного буфера (pH 7,0) + V₁ = ${fmt(stateA.V1, 2)} мл витяжки + субстрат`, rx0 + 24, by + 18, { size: 10.5, color: T.muted });
      Gfx.text(c, `ΔD = D₂ − D₁ = ${fmt(m.D2, 3)} − ${fmt(m.D1, 3)} = ${fmt(m.dD, 3)} о.о.г. за 120 с`, rx0 + 24, by + 36, { size: 11, font: "mono", weight: 700, color: T.ink });
      Gfx.text(c, `Питома активність A = ${fmt(m.A, 2)} ум. од. / (г сирої маси · хв)  [${fmt(m.fold, 2)}× до контролю]`, rx0 + 24, by + 54, { size: 11.5, font: "mono", weight: 700, color: T.chl });
    }

    /* ==================== TAB B: DAVIS PAGE ZYMOGRAM OF PEROXIDASE ISOZYMES (ЛР 52) ==================== */
    const boxB = modes.box("b");
    const stB = new Stage(boxB.st, { aspect: 1.68, minH: 330, maxH: 490, minW: 590, tag: "ЛР 52 · Диск-електрофорез у ПААГ за Девісом (2,5 % pH 6,7 → 7,5 % pH 8,9) · Зимограма Rf" });

    // 6 lanes with realistic anionic peroxidase isozyme bands: [Rf, relativeIntensity, bandLabel]
    const ZYM_LANES = [
      {
        id: 0, short: "1: Листок", name: "Листок інтактний (контроль)",
        lagSec: 42,
        bands: [
          [0.18, 0.55, "A₁ (клітинна стінка)"],
          [0.44, 0.72, "A₂ (конститутивна)"],
          [0.64, 0.48, "A₃ (цитозольна)"]
        ]
      },
      {
        id: 1, short: "2: Корінь", name: "Корінь (тканинна специфічність)",
        lagSec: 28,
        bands: [
          [0.14, 0.88, "R₁ (лігніфікація ксилеми)"],
          [0.24, 0.78, "R₂ (суберинізація)"],
          [0.44, 0.65, "A₂ (конститутивна)"],
          [0.54, 0.52, "R₃ (ІОК-оксидазна)"]
        ]
      },
      {
        id: 2, short: "3: Калюс неморф.", name: "Неморфогенний пухкий калюс",
        lagSec: 55,
        bands: [
          [0.18, 0.30, "A₁ (слабка)"],
          [0.44, 0.68, "A₂ (базальна)"]
        ]
      },
      {
        id: 3, short: "4: Калюс ембріо.", name: "Ембріогенний морфогенний калюс",
        lagSec: 24,
        bands: [
          [0.18, 0.74, "A₁ (диференціація стінки)"],
          [0.34, 0.64, "E₁ (морфогенна)"],
          [0.44, 0.82, "A₂ (конститутивна)"],
          [0.64, 0.60, "A₃ (цитозольна)"],
          [0.79, 0.86, "E₂ (маркер ембріогенезу!)"]
        ]
      },
      {
        id: 4, short: "5: Стрес NaCl", name: "Сольовий стрес (150 мМ NaCl)",
        lagSec: 19,
        bands: [
          [0.18, 0.78, "A₁"],
          [0.34, 0.70, "S₁ (стрес-індукована)"],
          [0.44, 0.90, "A₂"],
          [0.64, 0.84, "A₃"],
          [0.74, 0.80, "S₂ (швидка анодна)"]
        ]
      },
      {
        id: 5, short: "6: Патоген", name: "Інфікування фітопатогеном",
        lagSec: 14,
        bands: [
          [0.14, 0.95, "P₁ (гіперлігніфікація)"],
          [0.24, 0.85, "P₂"],
          [0.34, 0.76, "S₁"],
          [0.44, 0.96, "A₂"],
          [0.64, 0.88, "A₃"],
          [0.85, 0.94, "P₃ (надшвидка захисна!)"]
        ]
      }
    ];

    const stateB = {
      lane: 3,         // selected lane index (0..5) for densitogram & Rf table
      lBpb: 65,        // пробіг фронту бромфенолового синього l_БФС (мм, 40 - 80 мм)
      stainTime: 65    // тривалість бензидинового проявлення (%: синій -> коричневий)
    };

    UI.select(boxB.ct, {
      id: "l12b-lane", label: "Обрана доріжка для денситометрії та розрахунку Rf",
      options: ZYM_LANES.map(L => [String(L.id), `${L.short} — ${L.name}`]),
      value: String(stateB.lane),
      on: v => { stateB.lane = +v; updateB(); }
    });

    const slBpb = UI.slider(boxB.ct, {
      id: "l12b-bpb", label: "Пробіг бромфенолового синього l_БФС", min: 40, max: 80, step: 1, value: stateB.lBpb, unit: "мм",
      fmt: v => fmt(v, 0), on: v => { stateB.lBpb = v; updateB(); }
    });
    const slStain = UI.slider(boxB.ct, {
      id: "l12b-stain", label: "Проявлення бензидином + H₂O₂", min: 15, max: 100, step: 5, value: stateB.stainTime, unit: "%",
      fmt: v => fmt(v, 0), on: v => { stateB.stainTime = v; updateB(); }
    });

    UI.buttons(boxB.ct, [
      {
        label: "Ембріогенний калюс (доріжка 4)", pri: true, on: () => {
          stateB.lane = 3; $("#l12b-lane").value = "3"; slBpb.set(stateB.lBpb = 65); slStain.set(stateB.stainTime = 65); updateB();
        }
      },
      {
        label: "Неморфогенний калюс (доріжка 3)", on: () => {
          stateB.lane = 2; $("#l12b-lane").value = "2"; updateB();
        }
      },
      {
        label: "Патогенний стрес (доріжка 6)", on: () => {
          stateB.lane = 5; $("#l12b-lane").value = "5"; updateB();
        }
      }
    ]);

    const readsB = UI.reads(boxB.bl, [
      ["sample", "Досліджуваний зразок (доріжка)"],
      ["niso", "Кількість виявлених ізоферментів"],
      ["lag", "Лаг-період появи синього забарвлення"],
      ["rfs", "Спектр відносної рухливості Rf"]
    ]);
    const outB = UI.out(boxB.bl, "");
    const tblBoxB = h("div", { class: "tblwrap" });
    boxB.bl.append(tblBoxB);
    const chDensB = UI.chart(boxB.bl, "Денситограма зимограми I(Rf): профіль оптичної щільності смуг ізоферментів пероксидази");

    function updateB() {
      const L = ZYM_LANES[stateB.lane];
      const rfs = L.bands.map(b => fmt(b[0], 2)).join(" · ");

      readsB.set("sample", `${L.short} (${L.name})`);
      readsB.set("niso", String(L.bands.length), "молекулярних форм у 7,5 % ПААГ");
      readsB.set("lag", String(L.lagSec), "с (до вичерпання аскорбату)");
      readsB.set("rfs", rfs);

      outB.el.className = "bout good";
      outB.set(
        `<b>Аналіз зимограми доріжки № ${L.id + 1} («${L.name}», ЛР 52):</b> при довжині пробігу лідируючого барвника бромфенолового синього <i>l</i><sub>БФС</sub> = ${stateB.lBpb} мм виявлено <b>${L.bands.length} ізоформ</b> пероксидази. ` +
        (L.id === 3
          ? `Поява швидкорухомої анодної ізоформи <b>E₂ (<i>R<sub>f</sub></i> = 0,79)</b> та середньорухомої <b>E₁ (<i>R<sub>f</sub></i> = 0,34)</b> є специфічним біохімічним маркером переходу калюсу до <b>соматичного ембріогенезу</b> (порівняйте з бідним спектром неморфогенного калюсу на доріжці 3, де присутні лише 2 смуги).`
          : L.id >= 4
          ? `Стресовий вплив зумовлює <i>de novo</i> експресію високоактивних швидкорухомих анодних ізопероксидаз (<i>R<sub>f</sub></i> = 0,74–0,85) та посилення повільнорухомих ізоформ клітинної стінки (<i>R<sub>f</sub></i> = 0,14–0,24).`
          : `Спектр відображає тканиноспецифічний набір конститутивних ізоферментів.`)
      );

      // Build Rf calculation table
      const rowsHtml = L.bands.map(([rf, inten, desc], idx) => {
        const li = rf * stateB.lBpb;
        return `<tr>
          <td>Ізоформа № ${idx + 1} — <b>${desc}</b></td>
          <td class="n">${fmt(li, 1)} мм</td>
          <td class="n">${fmt(stateB.lBpb, 0)} мм</td>
          <td class="n"><b>${fmt(rf, 2)}</b></td>
          <td class="n">${fmt(inten * 100, 0)} %</td>
        </tr>`;
      }).join("");

      UI.html(tblBoxB, `
        <table class="t bt">
          <thead>
            <tr>
              <th>Ізофермент пероксидази (доріжка № ${L.id + 1})</th>
              <th class="n">Відстань смуги l_ізоф</th>
              <th class="n">Фронт барвника l_БФС</th>
              <th class="n">Рухливість Rf = l / l_БФС</th>
              <th class="n">Відносна інтенсивність</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `);

      drawChartB();
      stB.dirty = true;
    }

    function drawChartB() {
      const T = Theme.c;
      const L = ZYM_LANES[stateB.lane];
      const Lctrl = ZYM_LANES[0];

      const densAt = (laneObj, rf) => {
        let sum = 0.02;
        for (const [bRf, inten] of laneObj.bands) {
          sum += inten * Math.exp(-0.5 * Math.pow((rf - bRf) / 0.026, 2));
        }
        return sum * 100;
      };

      const ptsSel = [], ptsCtrl = [];
      for (let r = 0; r <= 1.001; r += 0.008) {
        ptsSel.push([r, densAt(L, r)]);
        ptsCtrl.push([r, densAt(Lctrl, r)]);
      }

      const marks = L.bands.map(([bRf, inten, desc]) => ({
        x: bRf,
        y: densAt(L, bRf),
        r: 4.8,
        color: T.chl,
        label: `Rf=${fmt(bRf, 2)}`
      }));

      drawChart(chDensB, {
        x: [0, 1.0], y: [0, 115],
        xl: "Відносна електрофоретична рухливість Rf (від старту 7,5 % гелю до фронту БФС)",
        yl: "Оптична щільність смуги (%)",
        series: [
          { pts: ptsSel, color: T.chl, w: 2.5, fill: rgba(T.chl, 0.14) },
          { pts: ptsCtrl, color: T.muted, w: 1.7, dash: [5, 4] }
        ],
        marks,
        legend: [
          { color: T.chl, label: `${L.short}: ${L.name}` },
          { color: T.muted, label: "1: Листок (контроль)" }
        ]
      });
    }

    // Allow clicking on a lane in stB canvas to select it
    stB.cv.addEventListener("pointerdown", (e) => {
      const r = stB.cv.getBoundingClientRect();
      const x = e.clientX - r.left;
      const gelX = stB.W * 0.28, gelW = stB.W * 0.68;
      if (x >= gelX && x <= gelX + gelW) {
        const idx = clamp(Math.floor(((x - gelX) / gelW) * 6), 0, 5);
        stateB.lane = idx;
        $("#l12b-lane").value = String(idx);
        updateB();
      }
    });

    function drawStageB(dt, t) {
      const c = stB.ctx, W = stB.W, H = stB.H, T = Theme.c;
      stB.clear();
      const pad = 10;

      // Left schematic panel (25% width): Davis Discontinuous Buffer System (Stacking vs Resolving Gel + Ruler)
      const leftW = W * 0.26;
      Gfx.rr(c, pad, pad, leftW - pad, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();
      Gfx.text(c, "Система Девіса (ПААГ)", pad + 10, pad + 18, { weight: 700, size: 12, color: T.ink });

      const gx = W * 0.28, gy = pad, gw = W - gx - pad, gh = H - pad * 2;
      Gfx.rr(c, gx, gy, gw, gh, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();

      const topBufY = gy + 28;
      const stackY = gy + 50, stackH = 38;
      const resY = stackY + stackH, resH = gh - (resY - gy) - 34;
      const bpbY = resY + resH * 0.88; // Bromophenol blue front (Rf = 1.0)

      // Annotations on Left Card aligned with Gel zones
      Gfx.chip(c, "− Катод: Трис-гліцин pH 8,3", pad + 10, topBufY + 6, { size: 9.5, bg: T.paper });
      Gfx.chip(c, "Концентруючий: 2,5 % pH 6,7", pad + 10, stackY + stackH / 2, { size: 9.5, bg: rgba(T.carot, 0.14), stroke: T.carot });
      Gfx.text(c, "Ефект Кольрауша: Cl⁻ / гліцин", pad + 12, stackY + stackH + 14, { size: 9.5, color: T.muted });
      Gfx.chip(c, "Розділяючий: 7,5 % pH 8,9", pad + 10, resY + 36, { size: 9.5, bg: rgba(T.data, 0.14), stroke: T.data });
      Gfx.text(c, "Молекулярне сито + заряд", pad + 12, resY + 56, { size: 9.5, color: T.muted });
      Gfx.chip(c, "+ Анод: лідируючий БФС (Rf=1)", pad + 10, bpbY, { size: 9.5, bg: rgba("#2563EB", 0.14), stroke: "#2563EB" });

      // Gel Cassette on Right Card
      const casX = gx + 44, casW = gw - 58;
      Gfx.text(c, "Зимограма ізоферментів пероксидази (бензидин + H₂O₂; натисніть на доріжку 1–6)", gx + 14, gy + 18, { weight: 700, size: 11.5, color: T.ink });

      // Stacking gel (2.5% acrylamide, pH 6.7)
      c.fillStyle = Theme.dark ? "rgba(180,195,210,0.12)" : "rgba(218,228,238,0.65)";
      c.fillRect(casX, stackY, casW, stackH);
      c.strokeStyle = T.rule; c.strokeRect(casX, stackY, casW, stackH);

      // Resolving gel (7.5% acrylamide, pH 8.9)
      c.fillStyle = Theme.dark ? "rgba(145,175,205,0.16)" : "rgba(232,240,248,0.88)";
      c.fillRect(casX, resY, casW, resH);
      c.strokeStyle = T.rule; c.strokeRect(casX, resY, casW, resH);

      // Rf scale ruler on left edge of resolving gel (Rf = 0.0 to 1.0)
      const runPx = bpbY - resY;
      c.strokeStyle = rgba(T.ink, 0.45); c.lineWidth = 1;
      c.beginPath(); c.moveTo(casX - 8, resY); c.lineTo(casX - 8, bpbY); c.stroke();
      for (let rf = 0; rf <= 1.001; rf += 0.2) {
        const ry = resY + rf * runPx;
        c.beginPath(); c.moveTo(casX - 13, ry); c.lineTo(casX - 8, ry); c.stroke();
        Gfx.text(c, fmt(rf, 1), casX - 16, ry + 3, { align: "right", size: 9.5, font: "mono", color: T.muted });
      }

      // Benzidine stain color transitions from deep royal blue (oxidized benzidine radical cation) to brown with stainTime
      const brownFrac = clamp((stateB.stainTime - 55) / 45, 0, 1);
      const bandBaseCol = mixc("#1D4ED8", "#6B3E1D", brownFrac);

      const lw = casW / ZYM_LANES.length;
      ZYM_LANES.forEach((L, i) => {
        const lcx = casX + (i + 0.5) * lw, bw = Math.min(54, lw * 0.66);
        const isSel = i === stateB.lane;

        // Highlight selected lane
        if (isSel) {
          c.fillStyle = rgba(T.chl, 0.11);
          c.fillRect(casX + i * lw, stackY, lw, stackH + resH);
          c.strokeStyle = T.chl; c.lineWidth = 1.8;
          c.strokeRect(casX + i * lw + 1, stackY + 1, lw - 2, stackH + resH - 2);
        }

        // Sample well in stacking gel
        c.fillStyle = Theme.dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.85)";
        c.fillRect(lcx - bw / 2, stackY + 4, bw, 12);
        c.strokeStyle = rgba(T.ink, 0.3); c.lineWidth = 1;
        c.strokeRect(lcx - bw / 2, stackY + 4, bw, 12);

        // Bromophenol blue tracking dye line at Rf = 1.0
        c.fillStyle = "rgba(37, 99, 235, 0.55)";
        c.fillRect(lcx - bw / 2, bpbY - 1.5, bw, 3);

        // Draw isozyme bands in resolving gel
        for (const [rf, inten, desc] of L.bands) {
          const by2 = resY + rf * runPx;
          const alphaVal = clamp(inten * (stateB.stainTime / 55), 0.18, 0.96);
          const bh2 = 3.5 + inten * 3.2;

          // Soft halo around band
          const gr = c.createLinearGradient(0, by2 - bh2 * 1.4, 0, by2 + bh2 * 1.4);
          gr.addColorStop(0, alpha(bandBaseCol, 0));
          gr.addColorStop(0.5, alpha(bandBaseCol, alphaVal * 0.45));
          gr.addColorStop(1, alpha(bandBaseCol, 0));
          c.fillStyle = gr;
          c.fillRect(lcx - bw / 2 - 2, by2 - bh2 * 1.4, bw + 4, bh2 * 2.8);

          // Core isozyme band
          Gfx.rr(c, lcx - bw / 2, by2 - bh2 / 2, bw, bh2, bh2 / 2);
          c.fillStyle = alpha(bandBaseCol, alphaVal);
          c.fill();

          if (isSel) {
            Gfx.text(c, fmt(rf, 2), lcx + bw / 2 + 3, by2 + 3, { size: 8.8, font: "mono", weight: 700, color: T.chl });
          }
        }

        // Lane label at bottom
        Gfx.text(c, L.short, lcx, resY + resH + 16, {
          align: "center", size: 10, font: "mono", weight: isSel ? 700 : 500,
          color: isSel ? T.chl : T.ink
        });
      });
    }

    updateA();
    updateB();
    modes.init();

    return {
      stages: [stA, chKinA, chBarA, stB, chDensB],
      frame(dt, time) {
        if (modes.cur === "a" && (dt > 0 || stA.dirty)) { stA.dirty = false; drawStageA(dt, time); }
        if (modes.cur === "b" && (dt > 0 || stB.dirty)) { stB.dirty = false; drawStageB(dt, time); }
      }
    };
  }
});
})();
