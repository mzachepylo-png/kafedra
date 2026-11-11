(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

App.def(6, {
  cheat: `
    <p class="lead">
      <b>Клітинна селекція <i>in vitro</i></b> — це спрямований добір мутантних або сомаклонально змінених клітинних ліній із мільйонів культивованих клітин чи калюсних експлантатів на поживних середовищах із селективними агентами: антибіотиками, гербіцидами, хлоридом натрію (NaCl), іонами важких металів, аналогами амінокислот або фітотоксинами патогенних грибів (М.&nbsp;Д.&nbsp;Мельничук, О.&nbsp;Л.&nbsp;Кляченко, 2014, Тема&nbsp;6, ЛР&nbsp;23, с.&nbsp;93–97). В одній чашці Петрі або колбі з суспензією міститься 10<sup>6</sup>…10<sup>8</sup> тотипотентних рослинних клітин, що за генетичним обсягом вибірки відповідає кільком гектарам польового селекційного розсадника.
    </p>

    <h3>1. Сомаклональна мінливість та індукований мутагенез у культурі тканин</h3>
    <p>
      Джерелом генетичного різноманіття при клітинній селекції є як <b>спонтанна сомаклональна мінливість</b> (термін П.&nbsp;Ларкіна та В.&nbsp;Скаукрофта, 1981; частота спонтанних мутацій 10<sup>−6</sup>…10<sup>−5</sup> на ген за клітинну генерацію), так і <b>індукований мутагенез</b> за обробки калюсу чи суспензії фізичними (УФ-випромінювання λ = 254&nbsp;нм, γ-промені) або хімічними супермутагенами (етилметансульфонат — ЕМС, <i>N</i>-нітрозо-<i>N</i>-метилсечовина — НМС, азид натрію NaN<sub>3</sub>), які підвищують частоту точкових мутацій у 10–100 разів (до 10<sup>−4</sup>…10<sup>−3</sup>).
    </p>
    <p>
      Причинами високої генетичної гетерогенності клітин у культурі <i>in vitro</i> є:
    </p>
    <ul>
      <li><b>Зняття організмового контролю:</b> поза цілісною рослиною виживають і діляться клітини з хромосомними абераціями, анеуплоїдією, поліплоїдією та цитоплазматичними мутаціями мітохондріальної (мтДНК) і хлоропластної ДНК (хлДНК).</li>
      <li><b>Активація мобільних генетичних елементів (транспозонів)</b> та зміни профілю метилювання цитозину в промоторних ділянках генів під впливом високих доз синтетичних ауксинів (2,4-Д).</li>
      <li><b>Ампліфікація генів детоксикації</b> при ступінчастому відборі на сублетальних дозах інгібіторів.</li>
    </ul>

    <h3>2. Відбір стрептоміцин-резистентних ліній тютюну <i>Nicotiana tabacum</i> L. (ЛР 23)</h3>
    <p>
      Класичною модельною системою клітинної селекції цитоплазматичних мутантів є відбір калюсних експлантатів тютюну справжнього (<i>Nicotiana tabacum</i> L.) на середовищі Мурасіге—Скуга (МС) із додаванням аміноглікозидного антибіотика <b>стрептоміцину сульфату</b> у селективній концентрації <b>0,5&nbsp;мг/мл</b> (500&nbsp;мг/л, с.&nbsp;95–96).
    </p>
    <p>
      <b>Молекулярний механізм селекції:</b> стрептоміцин вибірково зв'язується з <b>30S малою субодиницею пластидних 70S рибосом</b> прокаріотичного типу (білок S12 та 16S рРНК), блокуючи ініціацію трансляції білків фотосистем і рибулозобісфосфаткарбоксилази (РуБісКО) у хлоропластах, але не пригнічує цитоплазматичні 80S рибосоми еукаріотичної клітини. Унаслідок цього на світлі (2000…4000&nbsp;лк):
    </p>
    <ul>
      <li><b>Чутливі клітини дикого типу (Str<sup>S</sup>):</b> втрачають здатність формувати фотосинтетично активні хлоропласти з пропластид, зазнають <b>фотознебарвлення (етіоляції / побіління)</b>, набувають біло-жовтого чи бурого кольору й зупиняють ріст.</li>
      <li><b>Резистентні мутантні клони (Str<sup>R</sup>):</b> несуть точкову мутацію в хлоропластному гені 16S рРНК (<code>rrn16</code>) або гені рибосомного білка S12 (<code>rps12</code>), що унеможливлює зв'язування стрептоміцину з 30S субодиницею. Такі клітини на тлі білого пригніченого калюсу формують яскраво-зелені меристематичні острівці (клітинні клони), які активно проліферують і регенерують зелені пагони.</li>
    </ul>

    <div class="eq">
      <span class="fr"><span><var>dN</var><sub>S</sub></span><span><var>dt</var></span></span> = <mrow><mo>(</mo><span class="fr"><span><var>μ</var><sub>0</sub></span><span>1 + (<var>C</var> / <var>IC</var><sub>50</sub>)<sup><var>h</var></sup></span></span> − <var>k</var><sub>bl</sub>(<var>C</var>)<mo>)</mo></mrow> · <var>N</var><sub>S</sub>, &emsp;
      <span class="fr"><span><var>dN</var><sub>R</sub></span><span><var>dt</var></span></span> = <var>μ</var><sub>R</sub> · <var>N</var><sub>R</sub> + <var>m</var> · <var>μ</var><sub>0</sub> · <var>N</var><sub>S</sub>
      <span class="c">— конкурентна динаміка чутливих (N<sub>S</sub>) і резистентних (N<sub>R</sub>) клітин на селективному середовищі</span>
    </div>
    <dl class="vars">
      <dt>C</dt><dd>концентрація селективного агента — стрептоміцину сульфату в середовищі МС (мг/мл, у протоколі ЛР 23: <var>C</var> = 0,5&nbsp;мг/мл)</dd>
      <dt>IC<sub>50</sub></dt><dd>концентрація напівмаксимального інгібування росту дикого типу (IC<sub>50,S</sub> ≈ 0,08&nbsp;мг/мл, тоді як для мутантів Str<sup>R</sup> IC<sub>50,R</sub> &gt; 2,5&nbsp;мг/мл)</dd>
      <dt>k<sub>bl</sub>(C)</dt><dd>швидкість фотознебарвлення та некротизації пластид у чутливих клітинах на світлі</dd>
      <dt>m</dt><dd>частота виникнення мутацій резистентності (10<sup>−6</sup> спонтанно; до 10<sup>−4</sup> після мутагенезу)</dd>
    </dl>

    <div class="bcall bcall--warn">
      <b>Термолабільність антибіотиків при готуванні селективних середовищ (с. 95)</b>
      <p>
        Стрептоміцин сульфат (як і канаміцин, гігроміцин чи цефотаксим) руйнується під час автоклавування при 121&nbsp;°C. Тому концентрований маточний розчин стрептоміцину стерилізують <b>мембранною мікрофільтрацією</b> крізь бактеріальні фільтри <i>Millipore</i> з діаметром пор 0,22&nbsp;мкм і вносять асептично у вже проавтоклавоване та охолоджене до +45…50&nbsp;°C агаризоване середовище МС безпосередньо перед розливанням у чашки Петрі.
      </p>
    </div>

    <h3>3. Пряма і ступінчаста схеми клітинної селекції та перевірка стабільності ознаки</h3>
    <p>
      У біотехнологічній практиці застосовують дві принципові схеми добору резистентних клітинних ліній (с.&nbsp;94–95):
    </p>
    <div class="tblwrap">
      <table class="t bt">
        <thead>
          <tr>
            <th>Схема клітинної селекції</th>
            <th>Режим дії селективного фактора</th>
            <th>Генетична природа відібраних ліній</th>
            <th>Типові селективні агенти</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Пряма (одноступенева) селекція</td>
            <td>Одноразове висаджування експлантатів на середовище з сублетальною або летальною дозою (95…99&nbsp;% загибелі дикого типу) впродовж 1–2 пасажів.</td>
            <td>Відбираються якісні моногенні або цитоплазматичні (хлДНК/мтДНК) точкові мутанти з високою спадковою стабільністю.</td>
            <td>Стрептоміцин (0,5&nbsp;мг/мл), канаміцин, хлорат калію, аналоги амінокислот (5-метилтриптофан, S-аміноетилцистеїн).</td>
          </tr>
          <tr>
            <td>Ступінчаста (багатоступенева) селекція</td>
            <td>Поступове підвищення концентрації селективного агента від слабкоінгібуючої до летальної впродовж 4–8 послідовних пасажів.</td>
            <td>Відбираються полігенні форми, ампліфікації генів, але значну частку становлять <b>епігенетичні адаптації (фізіологічне звикання)</b>.</td>
            <td>Хлорид натрію (NaCl, 0,5 → 2,0&nbsp;%), ПЕГ (посуха), гідроксипролін (морозостійкість), культуральні фільтрати патогенів.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      <b>Тест на спадкову стабільність ознаки:</b> щоб відрізнити істинний генетичний мутант від тимчасової фізіологічної чи епігенетичної адаптації (звикання), відібрані резистентні калюсні лінії переносять на <b>2–3 пасажі на неселективне середовище</b> (без інгібітора), після чого повторно висаджують на селективне середовище з летальною дозою. Істинні мутанти (Str<sup>R</sup>) повністю зберігають резистентність (&gt;85…95&nbsp;%), тоді як епігенетично адаптовані лінії втрачають стійкість і гинуть.
    </p>

    <h3>4. Протокол лабораторної роботи № 23 (с. 95–97)</h3>
    <details class="bproto">
      <summary>Хід роботи — Лабораторна робота № 23. Відбір резистентних до стрептоміцину ліній тютюну Nicotiana tabacum L. (с. 95–97)</summary>
      <div>
        <ol class="bsteps">
          <li>Приготуйте агаризоване живильне середовище Мурасіге—Скуга (МС) із додаванням сахарози (30&nbsp;г/л), кінетину (0,2…0,5&nbsp;мг/л) та ІОК або НОК (1,0&nbsp;мг/л), доведіть pH до 5,6…5,8 і проавтоклавуйте при 121&nbsp;°C протягом 20&nbsp;хв.</li>
          <li>Охолодіть стерильне середовище на водяній бані до +45…48&nbsp;°C (до початку застигання агару). У ламінарному боксі внесіть стерильний розчин <b>стрептоміцину сульфату</b> (профільтрований крізь мембранний фільтр 0,22&nbsp;мкм) до кінцевої селективної концентрації <b>0,5&nbsp;мг/мл</b> (500&nbsp;мг/л) і розлийте по 25&nbsp;мл у стерильні чашки Петрі. Паралельно приготуйте контрольні чашки без антибіотика (<var>C</var> = 0).</li>
          <li>Візьміть добре ростучий морфогенний калюс тютюну (<i>Nicotiana tabacum</i> L.) і в асептичних умовах розділіть його скальпелем на невеликі однакові експлантати масою 25…40&nbsp;мг (діаметром 3…4&nbsp;мм).</li>
          <li>Розкладіть пінцетом по <b>30 шматочків калюсу</b> у кожну чашку Петрі на поверхню селективного середовища на рівній відстані один від одного, герметизуйте бортики плівкою <i>Parafilm</i>.</li>
          <li>Інкубуйте чашки в культуральній кімнаті за температури <b>+26&nbsp;°C</b>, освітленості <b>2000…4000&nbsp;лк</b> і 16-годинного фотоперіоду протягом <b>4–6 тижнів</b> (28…42 доби).</li>
          <li>Щотижня реєструйте колір і приріст експлантатів: чутливі калюси знебарвлюються (біліють/буріють), а поодинокі резистентні клони формують <b>зелені меристематичні зони та пагони</b>. Відокремте зелені колонії та перенесіть їх на свіже селективне середовище для підтвердження стабільності ознаки.</li>
        </ol>
      </div>
    </details>
  `,

  qa: [
    [
      "Чому стрептоміцин у концентрації 0,5 мг/мл викликає побіління (фотознебарвлення) чутливих калюсів тютюну на світлі, але не вбиває клітини миттєво (ЛР 23)?",
      "<p>Стрептоміцин є специфічним інгібітором прокаріотичних <b>70S рибосом пластид і мітохондрій</b> (зв'язується з 30S субодиницею), проте не діє на цитоплазматичні 80S рибосоми рослинної клітини. Завдяки наявності сахарози (30&nbsp;г/л) у середовищі МС клітини дикого типу спочатку зберігають гетеротрофний метаболізм, але їхні пропластиди не здатні синтезувати білки тилакоїдних мембран і хлорофіл-білкові комплекси, тому калюс на світлі повністю втрачає зелений пігмент (біліє) і поступово зупиняє поділ.</p>"
    ],
    [
      "Яка молекулярно-генетична подія забезпечує виникнення зелених стрептоміцин-стійких колоній на тлі білого калюсу та як успадковується ця ознака у рослин-регенерантів?",
      "<p>Резистентність зумовлена точковими мутаціями у хлоропластному геномі (хлДНК) — у гені 16S рРНК (<code>rrn16</code>) або рибосомного білка S12 (<code>rps12</code>), що знижує спорідненість 30S субодиниці пластидної рибосоми до антибіотика. Оскільки ген локалізований у хлоропластній ДНК, у рослин-регенерантів тютюну ознака Str<sup>R</sup> успадковується <b>неменделівськи — суто за материнською лінією (цитоплазматичне успадкування)</b>.</p>"
    ],
    [
      "Чому розчин стрептоміцину не можна додавати у середовище МС до автоклавування при 121 °C?",
      "<p>Молекула стрептоміцину є термолабільною і за температури парової стерилізації (121&nbsp;°C, 20&nbsp;хв) зазнає гідролізу глікозидних зв'язків із повною втратою біологічної активності. Тому маточний розчин антибіотика стерилізують холодною фільтрацією крізь бактеріальні мембранні фільтри з порами 0,22&nbsp;мкм і вносять у проавтоклавоване середовище після його охолодження до +45…48&nbsp;°C.</p>"
    ],
    [
      "У чому полягає принципова різниця між прямою (одноступеневою) та ступінчастою (багатоступеневою) клітинною селекцією?",
      "<p>При <b>прямій селекції</b> клітини одразу висаджують на сублетальну чи летальну дозу селективного фактора, що відбирає рідкісні якісні мутанти з високою спадковою стабільністю. При <b>ступінчастій селекції</b> концентрацію стресора підвищують поступово від пасажу до пасажу: це дозволяє виділити полігенно стійкі форми (наприклад, до засолення NaCl чи посухи), але одночасно накопичує велику частку клітин із тимчасовою фізіологічною адаптацією.</p>"
    ],
    [
      "Як експериментально довести, що відібрана резистентна калюсна лінія є справжнім генетичним мутантом, а не результатом епігенетичної адаптації (фізіологічного звикання)?",
      "<p>Необхідно провести <b>тест на стабільність у неселективних умовах</b>: перенести відібраний резистентний калюс на 2–3 послідовних пасажі (6–9 тижнів) на стандартне середовище МС <b>без селективного агента</b>, а потім знову повернути на селективне середовище. У клітин із фізіологічним звиканням експресія стресових білків і метилювання ДНК повертаються до базового рівня (стійкість зникає), тоді як істинні мутанти повністю зберігають резистентність і передають її регенерантам.</p>"
    ]
  ],

  build({ stageBox, ctrls, below, tabsBox }) {
    const modes = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Відбір стрептоміцин-стійких ліній тютюну (ЛР 23)"],
      ["b", "Б. Пряма та ступінчаста селекція, стабільність ознаки"]
    ], () => { dirty = true; });

    let dirty = true;

    /* ======================================================================
       TAB A: STREPTOMYCIN SELECTION OF NICOTIANA TABACUM CALLI (LAB 23)
       ====================================================================== */
    const A = modes.box("a");
    const stA = new Stage(A.st, { aspect: 16 / 10, minH: 300, maxH: 460, tag: "ЛР 23 · Селективна чашка Петрі (30 експлантатів калюсу N. tabacum L., +26 °C, 3000 лк)", minW: 580 });

    const stateA = {
      strep: 0.50,    // Концентрація стрептоміцину C (0..2.0 мг/мл; протокол: 0,5 мг/мл)
      days: 35,       // Тривалість інкубації t (0..42 доби; протокол: 4–6 тижнів)
      mutLog: -5.0,   // log10 частоти мутацій (-6.0 спонтанна .. -3.8 індукована ЕМС/УФ)
      lux: 3000,      // Освітленість (500..5000 лк; протокол: 2000–4000 лк)
      seed: 23        // Номер серії чашки Петрі
    };

    UI.slider(A.ct, {
      id: "l6-strep", label: "Концентрація стрептоміцину C", min: 0.0, max: 2.0, step: 0.05, value: stateA.strep, unit: "мг/мл",
      fmt: v => fmt(v, 2), on: v => { stateA.strep = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l6-days", label: "Тривалість культивування t", min: 0, max: 42, step: 1, value: stateA.days, unit: "діб",
      fmt: v => `${fmt(v, 0)} (${fmt(v / 7, 1)} тиж.)`, on: v => { stateA.days = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l6-mut", label: "Частота мутацій хлДНК (спонт. / УФ / ЕМС)", min: -6.0, max: -3.8, step: 0.1, value: stateA.mutLog, unit: "",
      fmt: v => sci(Math.pow(10, v), 1), on: v => { stateA.mutLog = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l6-lux", label: "Освітленість культуральної кімнати", min: 500, max: 5000, step: 250, value: stateA.lux, unit: "лк",
      fmt: v => fmt(v, 0), on: v => { stateA.lux = v; dirty = true; }
    });
    UI.buttons(A.ct, [
      { label: "Протокол ЛР 23 (0,5 мг/мл, 35 діб)", pri: true, on: () => {
        const s1 = $("#l6-strep", A.ct), s2 = $("#l6-days", A.ct), s3 = $("#l6-lux", A.ct);
        if (s1) { s1.value = 0.50; s1.dispatchEvent(new Event("input")); }
        if (s2) { s2.value = 35; s2.dispatchEvent(new Event("input")); }
        if (s3) { s3.value = 3000; s3.dispatchEvent(new Event("input")); }
      } },
      { label: "Новий посів (30 експлантатів)", on: () => { stateA.seed = (stateA.seed * 17 + 7) % 997; dirty = true; } }
    ]);

    const outA = UI.out(A.ct, "");

    const rdA = UI.reads(A.bl, [
      ["green", "Зелені резистентні колонії (Str^R)"],
      ["bleach", "Білі (етіольовані) калюси (Str^S)"],
      ["necr", "Бурі некротизовані експлантати"],
      ["freq", "Частота відбору резистентних ліній"],
      ["shoots", "Експлантати з регенерацією пагонів"]
    ]);

    const chRowA = h("div", { class: "charts" });
    A.bl.append(chRowA);
    const chA1 = UI.chart(chRowA, "Криві доза—ефект виживання та вмісту хлорофілу для чутливої (Str^S) і мутантної (Str^R) ліній", { aspect: 1.85, minH: 195, maxH: 270 });
    const chA2 = UI.chart(chRowA, "Динаміка накопичення біомаси калюсів у чашці Петрі впродовж 42 діб селекції", { aspect: 1.85, minH: 195, maxH: 270 });

    function calcCalliA() {
      const C = stateA.strep;
      const t = stateA.days;
      const mutFreq = Math.pow(10, stateA.mutLog);
      const lightFac = smooth(400, 2500, stateA.lux);

      // Sensitive wild-type inhibition (IC50_S = 0.08 mg/mL, Hill h = 2.1)
      const wtGrowthFac = 1 / (1 + Math.pow(C / 0.08, 2.1));
      // Resistant mutant inhibition (IC50_R = 2.4 mg/mL, Hill h = 2.4)
      const mutGrowthFac = 1 / (1 + Math.pow(C / 2.4, 2.4));

      // Photobleaching degree of sensitive tissue over time (requires streptomycin + light)
      const bleachRate = (C / (0.12 + C)) * (0.35 + 0.65 * lightFac);
      const wtChlorophyll = clamp(Math.exp(-bleachRate * (t / 11)) * lightFac, 0.02, 1);
      const wtNecrosis = clamp(smooth(0.65, 1.85, C) * smooth(14, 38, t), 0, 1);

      // Probability that a callus explant (~4*10^5 cells) harbors at least one viable Str^R sector:
      // Poisson model P = 1 - exp(-N_effective * mutFreq * mutGrowthFac)
      const lambdaMut = 3.2e4 * mutFreq * mutGrowthFac;
      const pMutSector = 1 - Math.exp(-lambdaMut);

      const calli = [];
      let nGreen = 0, nWhite = 0, nNecr = 0, nShoots = 0;

      for (let i = 0; i < 30; i++) {
        const u1 = hash01(i, stateA.seed);
        const u2 = hash01(i, stateA.seed + 101);
        const hasMut = C < 0.04 ? true : (u1 < pMutSector);

        let status = "green";
        let sizeRel = 1.0;
        let hasShoot = false;

        if (C < 0.04) {
          // Non-selective control: all 30 explants grow green!
          status = "green";
          sizeRel = 1 + 2.2 * (1 - Math.exp(-t / 16)) * wtGrowthFac * (0.85 + 0.3 * u2);
          if (t > 24 && lightFac > 0.5 && u2 > 0.35) { hasShoot = true; nShoots++; }
          nGreen++;
        } else if (hasMut && t >= 10) {
          // Mutant Str^R sector emerges and proliferates into bright green callus!
          status = "mutant";
          const sectorMaturity = smooth(8, 34, t) * mutGrowthFac;
          sizeRel = 0.9 + 2.1 * sectorMaturity * (0.85 + 0.3 * u2);
          if (t >= 24 && sectorMaturity > 0.45 && lightFac > 0.45) { hasShoot = true; nShoots++; }
          nGreen++;
        } else {
          // Wild-type sensitive callus: bleaches white or turns necrotic brown at high dose
          sizeRel = 0.85 + 0.65 * wtGrowthFac * (1 - Math.exp(-t / 14));
          if (wtNecrosis > 0.45 + 0.35 * (u2 - 0.5)) {
            status = "necrotic";
            nNecr++;
          } else if (wtChlorophyll < 0.38) {
            status = "bleached";
            nWhite++;
          } else {
            status = "pale";
            nWhite++;
          }
        }
        calli.push({ i, status, sizeRel, hasShoot, u1, u2 });
      }

      return { calli, nGreen, nWhite, nNecr, nShoots, wtGrowthFac, mutGrowthFac, wtChlorophyll, pMutSector };
    }

    function drawA(time) {
      const res = calcCalliA();
      rdA.set("green", `${res.nGreen} із 30`, `(${fmt((res.nGreen / 30) * 100, 1)} %)`);
      rdA.set("bleach", `${res.nWhite} із 30`, "білі / етіольовані");
      rdA.set("necr", `${res.nNecr} із 30`, "бурі / некроз");
      rdA.set("freq", stateA.strep < 0.04 ? "Контроль (без відбору)" : `${fmt((res.nGreen / 30) * 100, 1)} % експлантатів`);
      rdA.set("shoots", `${res.nShoots} колоній`, "пагони Str^R");

      if (stateA.strep < 0.04) {
        outA.el.className = "bout warn";
        outA.set(`<b>Контрольне середовище без селективного тиску (C = ${fmt(stateA.strep, 2)} мг/мл):</b> усі 30 експлантатів дикого типу активно зеленіють і ростуть, тому виділити рідкісні мутантні клони <code>Str^R</code> неможливо.`);
      } else if (stateA.strep > 1.35) {
        outA.el.className = "bout bad";
        outA.set(`<b>Надвисока токсична доза стрептоміцину (C = ${fmt(stateA.strep, 2)} мг/мл):</b> окрім побіління чутливих тканин спостерігається тотальний некроз (${res.nNecr}/30) та пригнічення навіть резистентних секторів. Оптимум за ЛР 23 — <b>0,50 мг/мл</b>.`);
      } else {
        outA.el.className = "bout good";
        outA.set(`<b>Селективний режим за протоколом ЛР 23 (C = ${fmt(stateA.strep, 2)} мг/мл, ${stateA.days} доба):</b> чутливі експлантати (<code>Str^S</code>, ${res.nWhite} шт.) зазнали фотознебарвлення через блокаду 30S субодиниці пластидних 70S рибосом, а на <b>${res.nGreen} експлантатах</b> утворилися яскраво-зелені резистентні колонії (<code>Str^R</code>), з яких ${res.nShoots} формують пагони.`);
      }

      // Draw Stage A: Large Petri dish with 30 tobacco calli arranged in rings + cellular mechanism inset
      stA.clear();
      const c = stA.ctx, W = stA.W, H = stA.H, T = Theme.c;
      const pCx = W * 0.34;
      const pCy = H * 0.48;
      const pR = Math.min(W * 0.28, H * 0.41);

      Gfx.petri(c, pCx, pCy, pR, Theme.dark ? "#203025" : "#E4EFE0", {
        label: `Чашка Петрі (МС + ${fmt(stateA.strep, 2)} мг/мл стрептоміцину · 30 калюсів · ${stateA.days} доба)`,
        inside(ctx) {
          // Position 30 calli in 3 concentric rings: 4 inner, 10 middle, 16 outer
          const rings = [
            { n: 4, r: pR * 0.23 },
            { n: 10, r: pR * 0.51 },
            { n: 16, r: pR * 0.78 }
          ];
          let idx = 0;
          for (const rg of rings) {
            for (let k = 0; k < rg.n; k++, idx++) {
              const cal = res.calli[idx];
              const ang = (k / rg.n) * Math.PI * 2 + rg.r * 0.03;
              const cx = pCx + Math.cos(ang) * rg.r;
              const cy = pCy + Math.sin(ang) * rg.r;
              const baseR = (pR * 0.068) * Math.sqrt(cal.sizeRel);

              // Base callus lobes (irregular bumpy parenchymal mass)
              let baseCol = "#F0ECD8"; // bleached white-cream
              if (cal.status === "green") baseCol = "#3C8D53";
              else if (cal.status === "necrotic") baseCol = "#7C5230";
              else if (cal.status === "pale") baseCol = mixc("#F0ECD8", "#5FA16A", res.wtChlorophyll);
              else if (cal.status === "mutant") baseCol = "#EAE5CE"; // white base with bright green mutant sector on top!

              for (let lobe = 0; lobe < 5; lobe++) {
                const la = lobe * 1.25 + idx;
                const lx = cx + Math.cos(la) * baseR * 0.38;
                const ly = cy + Math.sin(la) * baseR * 0.38;
                Gfx.sphere(ctx, lx, ly, baseR * 0.65, baseCol);
              }

              // If mutant sector: draw proliferating emerald-green dome on top of bleached base
              if (cal.status === "mutant") {
                const mR = baseR * clamp(smooth(8, 32, stateA.days) * 0.95, 0.3, 1.05);
                for (let s = 0; s < 4; s++) {
                  const sa = s * 1.57 + time * 0.4;
                  Gfx.sphere(ctx, cx + Math.cos(sa) * mR * 0.28, cy + Math.sin(sa) * mR * 0.28, mR * 0.62, "#288B48");
                }
              }

              // If regenerating shoot primordia (de novo organogenesis on green colony)
              if (cal.hasShoot) {
                ctx.fillStyle = "#1B6B36";
                ctx.beginPath();
                ctx.ellipse(cx - 3, cy - 3, 5.5, 2.5, -0.5, 0, 7);
                ctx.ellipse(cx + 3, cy - 3, 5.5, 2.5, 0.5, 0, 7);
                ctx.fill();
              }
            }
          }
        }
      });

      // Right panel: Plastid 70S ribosome mechanism comparison (Str^S vs Str^R)
      const rx0 = W * 0.64;
      const rw = W - rx0 - 14;
      const ry0 = H * 0.08;
      const rh = H * 0.80;

      if (rw > 140) {
        Gfx.rr(c, rx0, ry0, rw, rh, 10);
        c.fillStyle = T.sheet;
        c.fill();
        c.strokeStyle = T.rule;
        c.stroke();

        Gfx.text(c, "Механізм дії стрептоміцину на пластиди", rx0 + rw / 2, ry0 + 20, { align: "center", size: 12, weight: 700, color: T.ink });

        // Top box: Wild-type Str^S plastid
        const y1 = ry0 + rh * 0.28;
        Gfx.rr(c, rx0 + 10, y1 - 36, rw - 20, 76, 8);
        c.fillStyle = alpha(T.warn, 0.08);
        c.fill();
        Gfx.sphere(c, rx0 + 36, y1, 18, stateA.strep > 0.1 ? "#E8E2C8" : "#44945B", { ring: T.warn, rw: 1.5 });
        Gfx.text(c, "Дикий тип (Str^S): 70S рибосома", rx0 + 64, y1 - 15, { size: 11, weight: 700, color: T.warn });
        Gfx.text(c, "Стрептоміцин зв'язує 30S (16S рРНК)", rx0 + 64, y1 + 1, { size: 10.2, color: T.muted });
        Gfx.text(c, "→ блок синтезу хлорофілу → білий калюс", rx0 + 64, y1 + 15, { size: 10.2, color: T.muted });

        // Bottom box: Mutant Str^R plastid
        const y2 = ry0 + rh * 0.68;
        Gfx.rr(c, rx0 + 10, y2 - 36, rw - 20, 82, 8);
        c.fillStyle = alpha(T.good, 0.10);
        c.fill();
        Gfx.sphere(c, rx0 + 36, y2, 18, "#298A49", { ring: T.good, rw: 1.8 });
        Gfx.text(c, "Мутант хлДНК (Str^R): ген rrn16 / rps12", rx0 + 64, y2 - 17, { size: 11, weight: 700, color: T.good });
        Gfx.text(c, "30S субодиниця не зв'язує антибіотик", rx0 + 64, y2 - 1, { size: 10.2, color: T.muted });
        Gfx.text(c, "→ нормальна трансляція РуБісКО і ФС ІІ", rx0 + 64, y2 + 13, { size: 10.2, color: T.muted });
        Gfx.text(c, "→ зелена морфогенна колонія і пагони", rx0 + 64, y2 + 27, { size: 10.2, weight: 600, color: T.good });
      }

      // Chart A1: Dose-response curves for Str^S and Str^R
      const ptsS = [], ptsR = [], ptsChl = [];
      for (let cVal = 0; cVal <= 2.0; cVal += 0.05) {
        ptsS.push([cVal, 100 / (1 + Math.pow(cVal / 0.08, 2.1))]);
        ptsR.push([cVal, 100 / (1 + Math.pow(cVal / 2.4, 2.4))]);
        ptsChl.push([cVal, 100 * Math.exp(-(cVal / (0.12 + cVal)) * 3.2)]);
      }
      drawChart(chA1, {
        x: [0, 2.0], y: [0, 105],
        xl: "Концентрація стрептоміцину сульфату C, мг/мл",
        yl: "Відносний ріст / хлорофіл, %",
        vl: [
          { x: 0.5, color: T.good, dash: [4, 3], label: "ЛР 23: 0,5 мг/мл" },
          { x: stateA.strep, color: T.ink, dash: [2, 2] }
        ],
        series: [
          { pts: ptsR, color: T.chl, w: 2.6 },
          { pts: ptsS, color: T.warn, w: 2.2 },
          { pts: ptsChl, color: T.bad, w: 1.8, dash: [4, 3] }
        ],
        marks: [
          { x: stateA.strep, y: res.mutGrowthFac * 100, color: T.chl, label: `Str^R ${fmt(res.mutGrowthFac * 100, 0)}%` },
          { x: stateA.strep, y: res.wtGrowthFac * 100, color: T.warn, label: `Str^S ${fmt(res.wtGrowthFac * 100, 0)}%` }
        ],
        legend: [
          { label: "Ріст мутанта Str^R (хлДНК)", color: T.chl },
          { label: "Ріст дикого типу Str^S", color: T.warn },
          { label: "Хлорофіл у Str^S (%)", color: T.bad }
        ]
      });

      // Chart A2: Time course of callus growth over 0..42 days at current streptomycin concentration
      const ptsT_R = [], ptsT_S = [];
      for (let d = 0; d <= 42; d += 2) {
        const wS = 35 * (1 + 2.8 * res.wtGrowthFac * (1 - Math.exp(-d / 14)));
        const wR = 35 * (1 + 4.5 * res.mutGrowthFac * smooth(6, 38, d));
        ptsT_S.push([d, wS]);
        ptsT_R.push([d, wR]);
      }
      drawChart(chA2, {
        x: [0, 42], y: [25, 220],
        xl: "Час культивування на селективному середовищі t, діб",
        yl: "Середня сира маса колонії, мг",
        vl: [{ x: stateA.days, color: T.ink, dash: [3, 3], label: `${stateA.days} доба` }],
        series: [
          { pts: ptsT_R, color: T.chl, w: 2.5, fill: rgba(T.chl, 0.08) },
          { pts: ptsT_S, color: T.warn, w: 2.2, dash: [5, 3] }
        ],
        legend: [
          { label: "Зелені мутантні клони Str^R", color: T.chl },
          { label: "Білі чутливі експлантати Str^S", color: T.warn }
        ]
      });
    }

    /* ======================================================================
       TAB B: DIRECT VS STEPWISE SELECTION & EPIGENETIC STABILITY
       ====================================================================== */
    const B = modes.box("b");
    const stB = new Stage(B.st, { aspect: 16 / 10, minH: 290, maxH: 450, tag: "Тема 6 · Схема пасажів: пряма селекція проти ступінчастої та перевірка стабільності", minW: 580 });

    const stateB = {
      scheme: "direct",   // "direct" | "stepwise"
      agent: "nacl",      // "nacl" (NaCl 0..2,0%) | "strep" (Стрептоміцин) | "filtrate" (Фільтрат патогену)
      nonSelPass: 2,      // Кількість пасажів без селективного агента для перевірки стабільності (0..4)
      pressure: 0.80      // Інтенсивність селективного тиску (0.4..1.0)
    };

    UI.seg(B.ct, {
      label: "Схема клітинної селекції",
      options: [
        ["direct", "Пряма (одноступенева)"],
        ["stepwise", "Ступінчаста (4 пасажі)"]
      ],
      value: stateB.scheme,
      on: v => { stateB.scheme = v; dirty = true; }
    });
    UI.select(B.ct, {
      id: "l6-agent", label: "Селективний агент у середовищі МС",
      options: [
        ["nacl", "Хлорид натрію NaCl (солестійкість, 0,5 → 1,8 %)"],
        ["strep", "Стрептоміцин сульфат (0,5 мг/мл, маркер хлДНК)"],
        ["filtrate", "Культуральний фільтрат Fusarium spp. (10 → 40 %)"],
        ["hypro", "Гідроксипролін (морозо- й осмостійкість, 5 → 20 мМ)"]
      ],
      value: stateB.agent,
      on: v => { stateB.agent = v; dirty = true; }
    });
    UI.slider(B.ct, {
      id: "l6-press", label: "Жорсткість селективного тиску", min: 0.40, max: 0.98, step: 0.02, value: stateB.pressure, unit: "",
      fmt: v => fmt(v * 100, 0) + " % летальності дикого типу", on: v => { stateB.pressure = v; dirty = true; }
    });
    UI.slider(B.ct, {
      id: "l6-nonsel", label: "Перевірка стабільності (пасажів без стресора)", min: 0, max: 4, step: 1, value: stateB.nonSelPass, unit: "пасажі",
      fmt: v => fmt(v, 0), on: v => { stateB.nonSelPass = v; dirty = true; }
    });

    const outB = UI.out(B.ct, "");

    const rdB = UI.reads(B.bl, [
      ["initSurv", "Первинне виживання (пасажі 1–4)"],
      ["genFrac", "Частка істинних мутантів у лінії"],
      ["epiFrac", "Частка епігенетичної адаптації (звикання)"],
      ["finalStab", "Збереження резистентності після тесту"],
      ["verdict", "Генетичний висновок"]
    ]);

    const chRowB = h("div", { class: "charts" });
    B.bl.append(chRowB);
    const chB1 = UI.chart(chRowB, "Динаміка частки стійких клітин і генетичної стабільності впродовж 8 пасажів", { aspect: 1.85, minH: 195, maxH: 270 });
    const chB2 = UI.chart(chRowB, "Склад відібраної клітинної популяції до і після культивування на середовищі без інгібітора", { aspect: 1.85, minH: 195, maxH: 270 });

    function calcB() {
      const isDirect = stateB.scheme === "direct";
      const P = stateB.pressure;
      const nNon = stateB.nonSelPass;

      // In Direct selection: high initial mortality, but survivors after P4 are 88-96% true genetic mutants!
      // In Stepwise selection: higher survival during ramp-up, but 45-70% of resistant cells are epigenetic habituation that decays during non-selective passages!
      const trueMutFracAtP4 = isDirect
        ? clamp(0.68 + 0.28 * smooth(0.5, 0.95, P), 0.5, 0.96)
        : clamp(0.28 + 0.30 * smooth(0.5, 0.95, P), 0.2, 0.65);
      const epiFracAtP4 = 1 - trueMutFracAtP4;

      // Epigenetic memory decays exponentially over non-selective passages (half-life ~ 1.1 passages)
      const epiRetained = epiFracAtP4 * Math.exp(-0.68 * nNon);
      const retainedResistance = (trueMutFracAtP4 + epiRetained) * 100;

      // Build 8-passage trajectory:
      // Passages 1..4: Selection (Direct = constant high dose; Stepwise = 25%, 50%, 75%, 100% dose)
      // Passages 5..(4+nNon): Non-selective MS medium (relaxation of epigenetic habituation)
      // Passage 8: Re-test on 100% selective medium
      const ptsTotal = [], ptsGenetic = [], ptsDose = [];
      for (let p = 1; p <= 8; p++) {
        let dosePct = 100;
        let totR = 0, genR = 0;
        if (p <= 4) {
          dosePct = isDirect ? P * 100 : (P * 100 * p) / 4;
          genR = (trueMutFracAtP4 * 100) * Math.pow(p / 4, isDirect ? 0.75 : 1.3);
          const epiCur = (epiFracAtP4 * 100) * Math.pow(p / 4, 0.9);
          totR = genR + epiCur;
        } else if (p <= 4 + nNon) {
          dosePct = 0; // non-selective medium!
          const k = p - 4;
          genR = trueMutFracAtP4 * 100;
          totR = genR + (epiFracAtP4 * 100) * Math.exp(-0.68 * k);
        } else {
          dosePct = P * 100; // re-challenge on selective medium!
          genR = Math.min(98, trueMutFracAtP4 * 100 + (p - 4 - nNon) * 4);
          totR = Math.min(99, retainedResistance + (p - 4 - nNon) * 3);
        }
        ptsTotal.push([p, totR]);
        ptsGenetic.push([p, genR]);
        ptsDose.push([p, dosePct]);
      }

      return { isDirect, trueMutFracAtP4, epiFracAtP4, retainedResistance, ptsTotal, ptsGenetic, ptsDose };
    }

    function drawB() {
      const res = calcB();
      rdB.set("initSurv", res.isDirect ? "1,5–4,0 % клонів" : "18–35 % калюсів");
      rdB.set("genFrac", fmt(res.trueMutFracAtP4 * 100, 1), "% (спадкові мутанти)");
      rdB.set("epiFrac", fmt(res.epiFracAtP4 * 100, 1), "% (фізіол. звикання)");
      rdB.set("finalStab", fmt(res.retainedResistance, 1), `% (після ${stateB.nonSelPass} пас. без стресу)`);
      rdB.set("verdict", res.retainedResistance >= 75 ? "Стабільна мутантна лінія" : "Переважає епігенетична адаптація");

      outB.el.className = "bout " + (res.retainedResistance >= 75 ? "good" : "warn");
      outB.set(
        `<b>Порівняльний аналіз схеми селекції:</b> за <b>${res.isDirect ? "прямої (одноступеневої)" : "ступінчастої"}</b> селекції до 4-го пасажу частка істинних генетичних мутантів становить <b>${fmt(res.trueMutFracAtP4 * 100, 1)} %</b>, а частка клітин із тимчасовою епігенетичною адаптацією — <b>${fmt(res.epiFracAtP4 * 100, 1)} %</b>. ` +
        `Після <b>${stateB.nonSelPass} пасажів на середовищі без інгібітора</b> та повторного висіву на селективне середовище стійкість зберігають <b>${fmt(res.retainedResistance, 1)} %</b> калюсів.`
      );

      // Draw Stage B: Visual multi-passage flowchart (Passages 1..4 Selection -> Non-selective -> Re-challenge)
      stB.clear();
      const c = stB.ctx, W = stB.W, H = stB.H, T = Theme.c;
      const nSteps = 6;
      const padX = 28;
      const stepW = (W - padX * 2) / nSteps;
      const cy = H * 0.46;
      const rDish = Math.min(34, stepW * 0.34);

      const stepDefs = [
        { p: "Пасаж 1", dose: res.isDirect ? 1 : 0.25, mode: "sel" },
        { p: "Пасаж 2", dose: res.isDirect ? 1 : 0.50, mode: "sel" },
        { p: "Пасаж 3", dose: res.isDirect ? 1 : 0.75, mode: "sel" },
        { p: "Пасаж 4", dose: 1.0, mode: "sel" },
        { p: stateB.nonSelPass > 0 ? `${stateB.nonSelPass} пас. без агента` : "Без відпочинку", dose: 0, mode: "non" },
        { p: "Тест стабільності", dose: 1.0, mode: "test" }
      ];

      Gfx.text(c, res.isDirect
        ? "Пряма клітинна селекція: миттєве відсікання чутливих клітин летальною дозою"
        : "Ступінчаста клітинна селекція: поступове підвищення концентрації інгібітора (25% → 50% → 75% → 100%)",
        W / 2, 24, { align: "center", size: 12.5, weight: 700, color: T.ink }
      );

      stepDefs.forEach((st, idx) => {
        const cx = padX + stepW * (idx + 0.5);
        const agarC = st.mode === "non"
          ? (Theme.dark ? "#1E3024" : "#E6F0E4")
          : mixc(Theme.dark ? "#222E26" : "#E8EFE4", "#D8C28B", st.dose * stateB.pressure);

        Gfx.petri(c, cx, cy, rDish, agarC, {
          inside(ctx) {
            const r = rng(100 + idx * 17);
            for (let k = 0; k < 9; k++) {
              const a = (k / 9) * Math.PI * 2;
              const d = (k === 0 ? 0 : rDish * 0.54);
              const kx = cx + Math.cos(a) * d;
              const ky = cy + Math.sin(a) * d;
              let col = "#358B50"; // genetic mutant (dark green)
              if (idx < 3 && r() > (idx + 1) * 0.3) col = "#E2DAC0"; // sensitive bleached
              else if (idx <= 3 && r() > res.trueMutFracAtP4) col = "#7FB852"; // epigenetic adapted (yellow-green)
              else if (st.mode === "test" && (k / 9) * 100 > res.retainedResistance) col = "#D8CEB2"; // lost epigenetic resistance!
              Gfx.sphere(ctx, kx, ky, 5.2, col);
            }
          }
        });

        Gfx.text(c, st.p, cx, cy - rDish - 14, { align: "center", size: 11, weight: 700, color: T.ink });
        const subLbl = st.mode === "non" ? "МС без стресора" : `Доза ${Math.round(st.dose * stateB.pressure * 100)} %`;
        Gfx.chip(c, subLbl, cx, cy + rDish + 18, {
          align: "center", size: 10,
          bg: st.mode === "non" ? T["chl-soft"] : T.sheet,
          fg: st.mode === "non" ? T.chl : T.ink
        });

        if (idx < stepDefs.length - 1) {
          Gfx.arrow(c, cx + rDish + 6, cy, cx + stepW - rDish - 6, cy, { col: T.muted, w: 1.8, head: 6 });
        }
      });

      // Legend at bottom of Stage B
      const ly = H - 22;
      Gfx.sphere(c, W * 0.20, ly - 4, 5, "#358B50");
      Gfx.text(c, "Істинні мутанти (спадкові)", W * 0.20 + 10, ly, { size: 11, color: T.ink });
      Gfx.sphere(c, W * 0.50, ly - 4, 5, "#7FB852");
      Gfx.text(c, "Епігенетична адаптація (фізіол. звикання)", W * 0.50 + 10, ly, { size: 11, color: T.ink });
      Gfx.sphere(c, W * 0.82, ly - 4, 5, "#D8CEB2");
      Gfx.text(c, "Чутливі / ревертанти", W * 0.82 + 10, ly, { size: 11, color: T.ink });

      // Chart B1: Trajectory across 8 passages
      drawChart(chB1, {
        x: [1, 8], y: [0, 105],
        xt: [1, 2, 3, 4, 5, 6, 7, 8],
        xl: "Номер пасажу (1–4: відбір; 5+: без стресора та повторний тест)",
        yl: "Частка стійких клітин / доза, %",
        band: stateB.nonSelPass > 0 ? [{ x0: 4.2, x1: 4 + stateB.nonSelPass + 0.3, color: rgba(T.data, 0.10) }] : [],
        series: [
          { pts: res.ptsTotal, color: T.chl, w: 2.5, dots: 3.5 },
          { pts: res.ptsGenetic, color: T.data, w: 2.2, dash: [5, 3], dots: 3 },
          { pts: res.ptsDose, color: T.warn, w: 1.6, dash: [2, 3] }
        ],
        legend: [
          { label: "Загальна стійкість (%)", color: T.chl },
          { label: "Спадкові мутанти (%)", color: T.data },
          { label: "Доза селективного агента (%)", color: T.warn }
        ]
      });

      // Chart B2: Bar chart before vs after non-selective passages
      drawChart(chB2, {
        x: [0.4, 3.6], y: [0, 105],
        xt: [1, 2, 3],
        xfmt: v => ["", "Мутанти (4 пас.)", "Адаптація (4 пас.)", "Збережено у тесті"][Math.round(v)] || "",
        yl: "Частка у популяції, %",
        series: [
          {
            bars: true, bw: 36, color: alpha(T.chl, 0.82),
            pts: [
              [1, res.trueMutFracAtP4 * 100],
              [2, res.epiFracAtP4 * 100],
              [3, res.retainedResistance]
            ]
          }
        ],
        marks: [
          { x: 1, y: res.trueMutFracAtP4 * 100, color: T.chl, label: `${fmt(res.trueMutFracAtP4 * 100, 0)}%` },
          { x: 2, y: res.epiFracAtP4 * 100, color: T.warn, label: `${fmt(res.epiFracAtP4 * 100, 0)}%` },
          { x: 3, y: res.retainedResistance, color: T.data, label: `${fmt(res.retainedResistance, 0)}%` }
        ]
      });
    }

    modes.init();

    return {
      stages: [stA, chA1, chA2, stB, chB1, chB2],
      frame(dt, time) {
        if (modes.cur === "a") {
          if (dt > 0 || dirty || stA.dirty || chA1.dirty || chA2.dirty) {
            drawA(time);
            dirty = false; stA.dirty = false; chA1.dirty = false; chA2.dirty = false;
          }
        } else if (modes.cur === "b") {
          if (dt > 0 || dirty || stB.dirty || chB1.dirty || chB2.dirty) {
            drawB();
            dirty = false; stB.dirty = false; chB1.dirty = false; chB2.dirty = false;
          }
        }
      }
    };
  }
});
})();
