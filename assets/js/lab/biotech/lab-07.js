(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

App.def(7, {
  cheat: `
    <p class="lead">
      <b>Ізольовані протопласти</b> (від грец. <i>protos</i> — перший і <i>plastos</i> — утворений) — це живі рослинні клітини, повністю позбавлені жорсткої целюлозно-пектинової клітинної стінки механічним або ферментативним шляхом, які обмежені лише зовнішньою цитоплазматичною мембраною — плазмалемою (М.&nbsp;Д.&nbsp;Мельничук, О.&nbsp;Л.&nbsp;Кляченко, 2014, Тема&nbsp;7, ЛР&nbsp;24–25, с.&nbsp;98–105). Завдяки поверхневому натягу ліпідного бішару (закон Лапласа) ізольовані протопласти в ізотонічному розчині набувають ідеальної сферичної форми, здатні поглинати чужорідну ДНК, віруси й органели, зливатися між собою за участі поліетиленгліколю (ПЕГ) з утворенням міжродових <b>соматичних гібридів і цибридів</b>, а за перенесення на поживне середовище К-3 — регенерувати нову клітинну стінку (протягом 48…72&nbsp;год), ділитися і відновлювати цілісні рослини.
    </p>

    <h3>1. Осмотичний статус клітини, плазмоліз і способи виділення протопластів (ЛР 24–25)</h3>
    <p>
      В інтактній рослинній клітині низький осмотичний потенціал вакуолярного соку (<var>Ψ<sub>s</sub></var> = −<var>iCRT</var> ≈ −0,8…−1,5&nbsp;МПа) врівноважується гідростатичним <b>тургорним тиском</b> (<var>P</var> &gt; 0) протопласта на міцну клітинну оболонку: <var>Ψ<sub>w</sub></var> = <var>Ψ<sub>s</sub></var> + <var>P</var>. Якщо зруйнувати клітинну стінку у звичайному гіпотонічному середовищі МС (0,088&nbsp;М сахарози), вода стрімко надійде всередину за градієнтом водного потенціалу і позбавлений механічної опори протопласт миттєво лусне (<b>осмотичний лізис</b>).
    </p>
    <p>
      Тому виділення і культивування протопластів обов'язково проводять у присутності <b>осмотичних стабілізаторів (осмотиків)</b> у концентрації 0,40…0,60&nbsp;М: метаболічно інертних шестиатомних спиртів (<b>D-маніту</b>, <b>D-сорбіту</b>), дисахариду <b>сахарози</b>, глюкози або мінеральних солей (CaCl<sub>2</sub>, KCl, суміш W-5).
    </p>

    <div class="eq">
      <var>Ψ<sub>s</sub></var> = −<var>i</var> · <var>C</var> · <var>R</var> · <var>T</var>, &emsp;
      <span class="fr"><span><var>V</var>(<var>C</var>)</span><span><var>V</var><sub>ізо</sub></span></span> = <var>b</var> + (1 − <var>b</var>) · <span class="fr"><span><var>C</var><sub>ізо</sub></span><span><var>C</var></span></span>
      <span class="c">— рівняння Вант-Гоффа та закон Бойля—Маріотта—Пфеффера для об'єму протопласта</span>
    </div>
    <dl class="vars">
      <dt>C</dt><dd>молярна концентрація осмотика у зовнішньому розчині (моль/л = М; у ЛР 24 досліджують ряд сахарози: 0,30; 0,35; 0,40; 0,50; 0,55; 0,60; 0,70&nbsp;М)</dd>
      <dt>R · T</dt><dd>добуток універсальної газової сталої (8,314&nbsp;Дж/(моль·К)) та абсолютної температури (298&nbsp;К при +25&nbsp;°C): <var>RT</var> ≈ 2,478&nbsp;МПа·л/моль</dd>
      <dt>b</dt><dd>неосмотичний («мертвий») об'єм органел і біополімерів протопласта (≈ 0,18…0,22)</dd>
    </dl>

    <h4>Порівняння механічного (ЛР 24) та ферментативного (ЛР 25) виділення</h4>
    <ul>
      <li><b>Механічний спосіб (за Клеркером, 1892; ЛР 24, с. 99–100):</b> смужки епідермісу соковитих лусок цибулі ріпчастої (<i>Allium cepa</i> L.) або паренхіму листка тютюну (<i>Nicotiana tabacum</i> L.) занурюють у гіпертонічні розчини сахарози (0,30…0,70&nbsp;М) на 20…30&nbsp;хв до настання стійкого <b>опуклого (конвексного) плазмолізу</b>, коли протопласт відходить від стінок у кутах клітини і заокруглюється. Після цього тканину розрізають гострим лезом: частина клітинних оболонок перерізається без ушкодження скороченого протопласта, який при легкому натисканні виходить у розчин. Недолік — дуже низький вихід (10<sup>2</sup>…10<sup>3</sup> протопластів).</li>
      <li><b>Ферментативний спосіб (за Кокінгом, 1960; ЛР 25, с. 100–104):</b> асептичні листки тютюну (<i>Nicotiana tabacum</i> L.) або ріпаку (<i>Brassica napus</i> L.) зі знятим нижнім епідермісом (або нарізані смужками 1&nbsp;мм) інкубують у суміші мікробних гідролаз:
        <ul>
          <li><b>Пектиназа (Macerozyme R-10 з <i>Rhizopus</i> sp., 0,1…0,3&nbsp;%):</b> гідролізує α-1,4-галактуронан середніх пластинок і мацерує тканину на окремі клітини;</li>
          <li><b>Целюлаза (Cellulase Onozuka R-10 з <i>Trichoderma viride</i>, 0,5…1,5&nbsp;%):</b> розщеплює β-1,4-глюканові мікрофібрили целюлози первинної оболонки;</li>
          <li><b>Геміцелюлаза (Driselase з <i>Irpex lacteus</i>, 0,1…0,2&nbsp;%):</b> руйнує ксилоглюкани та арабіногалактани.</li>
        </ul>
        Інкубацію проводять у розчині осмотика (0,4…0,6&nbsp;М маніту чи сахарози + 5&nbsp;мМ CaCl<sub>2</sub> для стабілізації плазмалеми, pH&nbsp;5,6) у темряві за +25&nbsp;°C протягом 14…16&nbsp;год. Вихід сягає 10<sup>6</sup>…10<sup>7</sup> протопластів із 1&nbsp;г листка.
      </li>
    </ul>

    <h3>2. Флотаційне очищення у двофазній системі Сахароза / W-5 та середовище К-3 (ЛР 25, с. 102–104)</h3>
    <p>
      Після ферментативного гідролізу суспензія містить суміш живих інтактних протопластів, неперетравлених судинних пучків, уламків клітинних стінок і вільних хлоропластів із зруйнованих клітин. Очищення проводять у три етапи:
    </p>
    <ol>
      <li><b>Фільтрування</b> крізь стерильне капронове або нейлонове сито з діаметром пор 60…100&nbsp;мкм для затримання залишків епідермісу й жилок.</li>
      <li><b>Флотація на межі розділу густин (центрифугування при 100&nbsp;<var>g</var>, 5…10&nbsp;хв):</b> у центрифужну пробірку наливають важкий гіпертонічний розчин <b>0,5…0,6&nbsp;М сахарози</b> (<var>ρ</var><sub>сах</sub> ≈ 1,070&nbsp;г/см<sup>3</sup>), а зверху обережно по стінці нашаровують 1…2&nbsp;мл легшого ізоосмотичного сольового розчину <b>W-5</b> (<var>ρ</var><sub>W5</sub> ≈ 1,018&nbsp;г/см<sup>3</sup>; склад: 154&nbsp;мМ NaCl, 125&nbsp;мМ CaCl<sub>2</sub>, 5&nbsp;мМ KCl, 5&nbsp;мМ глюкози, pH&nbsp;5,6). Живі вакуолізовані протопласти мають проміжну плавучу густину (<var>ρ<sub>p</sub></var> ≈ 1,042&nbsp;г/см<sup>3</sup>), тому за законом Стокса під час центрифугування спливають і концентруються на межі розділу фаз у вигляді чіткого <b>яскраво-зеленого кільця (інтерфази)</b>, тоді як важкі вільні хлоропласти, ядра та клітинний детрит (<var>ρ</var> &gt; 1,10&nbsp;г/см<sup>3</sup>) осідають на дно пробірки!</li>
      <li><b>Відмивання та посів у середовище К-3 (за Наджем і Малігою):</b> зелене кільце протопластів відбирають пастерівською піпеткою, промивають у розчині W-5 і висівають у густині (0,5…1,0)·10<sup>5</sup>&nbsp;мл<sup>−1</sup> у рідке середовище <b>К-3</b> з 0,4&nbsp;М сахарози/глюкози, ксилозою (250&nbsp;мг/л — попередник геміцелюлоз), 2,4-Д (0,1…1,0&nbsp;мг/л) та 6-БАП (0,2…1,0&nbsp;мг/л). Через 48…72&nbsp;год протопласти синтезують нову целюлозну оболонку (її виявляють за блакитною флуоресценцією барвника <i>Calcofluor White</i>), втрачають сферичність і вступають у перший мітотичний поділ.</li>
    </ol>

    <h3>3. Соматична гібридизація (парасексуальне злиття) та отримання цибридів</h3>
    <p>
      На відміну від статевої гібридизації, злиття ізольованих соматичних протопластів дозволяє долати бар'єри міжвидової та міжродової несумісності (наприклад, <i>Solanum tuberosum</i> + <i>Lycopersicon esculentum</i> — «помато», <i>Brassica napus</i> + <i>Arabidopsis thaliana</i>) і комбінувати цитоплазматичні геноми (пластом і хондріом) обох батьківських форм.
    </p>
    <p>
      У нормі поверхня плазмалеми протопластів заряджена негативно (ζ-потенціал близько −25…−35&nbsp;мВ), тому при зближенні вони взаємно відштовхуються. Для індукції злиття застосовують:
    </p>
    <ul>
      <li><b>Хімічну обробку ПЕГ + Ca<sup>2+</sup> за лужного pH (за Као і Міхайлюком, 1974):</b> високомолекулярний <b>поліетиленгліколь (ПЕГ 1500–6000, 25…40&nbsp;%)</b> зв'язує молекули гідратної оболонки мембран і викликає щільну аглютинацію протопластів, а подальше розведення розчином із високою концентрацією CaCl<sub>2</sub> (50&nbsp;мМ) при pH&nbsp;9,5…10,5 нейтралізує поверхневий заряд фосфоліпідів, створює кальцієві містки та спричиняє локальну перебудову ліпідних бішарів із утворенням спільного цитоплазматичного мостика.</li>
      <li><b>Електрозлиття:</b> вирівнювання протопластів у ланцюжки («перлинні нитки») змінним електричним полем (діелектрофорез, 1&nbsp;МГц, 100…200&nbsp;В/см) із наступним коротким високовольтним імпульсом (1…2&nbsp;кВ/см, 20…50&nbsp;мкс) для оборотної електропорації контактних мембран.</li>
    </ul>

    <div class="bcall bcall--model">
      <b>Типи продуктів злиття: симетричні гібриди, асиметричні гібриди та цибриди</b>
      <p>
        При злитті протопластів виду А і виду Б утворюються: <b>гомокаріони</b> (А+А, Б+Б) та двоядерні <b>гетерокаріони (А+Б)</b>. Якщо обидва ядра зливаються у синкаріон — виникає <b>симетричний соматичний гібрид</b> (амфідиплоїд). Якщо перед злиттям інактивувати ядро донора рентгенівським або γ-опроміненням, а в реципієнта інгібувати цитоплазму йодацетамідом, отримують <b>цибриди (цитоплазматичні гібриди)</b>, які поєднують ядро одного виду з хлоропластами та мітохондріями іншого (основний шлях передачі цитоплазматичної чоловічої стерильності — ЦЧС у селекції гібридів F<sub>1</sub>).
      </p>
    </div>

    <h3>4. Протоколи лабораторних робіт № 24–25 (с. 99–105)</h3>
    <details class="bproto">
      <summary>Хід роботи — Лабораторна робота № 24. Механічне виділення ізольованих протопластів у розчинах сахарози (с. 99–100)</summary>
      <div>
        <ol class="bsteps">
          <li>Приготуйте серію водних розчинів сахарози зростаючої молярної концентрації: <b>0,30; 0,35; 0,40; 0,50; 0,55; 0,60; 0,70&nbsp;М</b> і нанесіть по великій краплі кожного розчину на окремі предметні скельця.</li>
          <li>Зніміть пінцетом смужки внутрішнього епідермісу соковитих лусок цибулі (<i>Allium cepa</i> L.) або зріжте тонкі сегменти мезофілу листка тютюну (<i>Nicotiana tabacum</i> L.) і занурте у краплі розчинів сахарози на 20…30&nbsp;хв для індукції плазмолізу.</li>
          <li>Простежте під мікроскопом перехід від тургору (0,30&nbsp;М) через кутовий (початковий) та увігнутий плазмоліз (0,40…0,50&nbsp;М) до повного опуклого (конвексного) плазмолізу (0,55…0,60&nbsp;М).</li>
          <li>У краплі з опуклим плазмолізом (0,55…0,60&nbsp;М) виконайте 15–20 частих поперечних надрізів тканини гострим лезом бритви, злегка натисніть препарувальною голкою на край зрізу і спостерігайте вихід сферичних ізольованих протопластів із розрізаних клітинних оболонок.</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи — Лабораторна робота № 25. Ферментативне виділення, флотаційне очищення та культивування протопластів мезофілу (с. 100–105)</summary>
      <div>
        <ol class="bsteps">
          <li>У ламінарному боксі візьміть цілком сформовані листки асептичних пробіркових рослин тютюну (<i>Nicotiana tabacum</i> L.) або ріпаку (<i>Brassica napus</i> L.), тонким пінцетом зніміть нижній епідерміс (або наріжте пластинку смужками завширшки 1&nbsp;мм).</li>
          <li>Помістіть листкові експлантати нижнім боком донизу в чашку Петрі зі стерильним ферментним розчином (0,5&nbsp;% <i>Cellulase Onozuka R-10</i> + 0,2&nbsp;% <i>Macerozyme R-10</i> + 0,1&nbsp;% <i>Driselase</i> у 0,5&nbsp;М маніту чи сахарози з 5&nbsp;мМ CaCl<sub>2</sub>, pH&nbsp;5,6, простерилізованим крізь фільтр 0,22&nbsp;мкм).</li>
          <li>Інкубуйте чашки в темряві за температури +25&nbsp;°C протягом 14…16&nbsp;год без струшування, після чого обережно похитайте чашку для вивільнення протопластів.</li>
          <li>Профільтруйте суспензію крізь капронове сито (60…100&nbsp;мкм) у центрифужну пробірку з 0,55&nbsp;М сахарози, зверху обережно нашаруйте 1,5&nbsp;мл сольового розчину <b>W-5</b> і центрифугуйте при 100&nbsp;<var>g</var> протягом 7&nbsp;хв.</li>
          <li>Відберіть пастерівською піпеткою <b>зелене кільце інтактних протопластів</b> на межі розділу фаз сахароза / W-5, двічі промийте розчином W-5 і перенесіть у рідке живильне середовище <b>К-3</b> у густині 5·10<sup>4</sup>…10<sup>5</sup>&nbsp;протопластів/мл.</li>
        </ol>
      </div>
    </details>
  `,

  qa: [
    [
      "Чому виділення протопластів проводять у гіпертонічних або ізотонічних розчинах осмотиків (0,4–0,6 М сахарози чи маніту), а у звичайному середовищі МС вони миттєво руйнуються?",
      "<p>У клітині з клітинною стінкою низький осмотичний потенціал вакуолярного соку (<var>Ψ<sub>s</sub></var> ≈ −1,0…−1,4&nbsp;МПа) врівноважується зустрічним тургорним тиском клітинної оболонки (<var>P</var> &gt; 0). Після видалення целюлозної стінки плазмалема сама не здатна витримати гідростатичний тиск: у гіпотонічному середовищі МС (0,088&nbsp;М сахарози, <var>Ψ<sub>s</sub></var> ≈ −0,22&nbsp;МПа) вода лавиноподібно входить у протопласт і розриває його. Розчин 0,5&nbsp;М маніту чи сахарози (<var>Ψ<sub>s</sub></var> ≈ −1,24&nbsp;МПа) врівноважує водний потенціал цитоплазми (Δ<var>Ψ<sub>w</sub></var> = 0).</p>"
    ],
    [
      "Яку роль відіграє кожен із ферментів у стандартній суміші для виділення протопластів мезофілу (Onozuka R-10, Macerozyme R-10, Driselase; ЛР 25)?",
      "<p><b>Macerozyme R-10</b> (пектиназа / полігалактуроназа) розщеплює пектинові речовини середніх пластинок і роз'єднує тканину мезофілу на окремі клітини (мацерація). <b>Cellulase Onozuka R-10</b> гідролізує β-1,4-глюканові ланцюги целюлозного каркасу первинної стінки, а <b>Driselase</b> розщеплює геміцелюлозний матрикс (ксилоглюкани, манани), повністю звільняючи сферичний протопласт.</p>"
    ],
    [
      "Поясніть фізичний принцип очищення протопластів методом флотації у двофазній системі «0,55 М сахароза — розчин W-5» (ЛР 25, с. 102–103).",
      "<p>Розчин 0,55&nbsp;М сахарози має високу густину (<var>ρ</var><sub>1</sub> ≈ 1,070&nbsp;г/см<sup>3</sup>), а нашарований зверху ізоосмотичний сольовий розчин <b>W-5</b> — меншу густину (<var>ρ</var><sub>2</sub> ≈ 1,018&nbsp;г/см<sup>3</sup>). Інтактні вакуолізовані протопласти мають проміжну густину (<var>ρ<sub>p</sub></var> ≈ 1,042&nbsp;г/см<sup>3</sup>), тому при м'якому центрифугуванні (100&nbsp;<var>g</var>) вони спливають у сахарозі, але не можуть піднятися у шар W-5, збираючись у вузьке <b>зелене кільце на межі розділу фаз</b>. Натомість вільні хлоропласти, ядра та уламки клітинних стінок мають густину &gt;1,10&nbsp;г/см<sup>3</sup> і осідають на дно пробірки.</p>"
    ],
    [
      "Як за допомогою флуоресцентної мікроскопії підтвердити початок регенерації клітинної стінки протопластами у середовищі К-3 і чому без цього неможливий нормальний мітоз?",
      "<p>Регенерацію целюлозних мікрофібрил на поверхні плазмалеми реєструють через 48…72&nbsp;год за яскраво-блакитною флуоресценцією специфічного флуорохрому <b>Calcofluor White</b> (калькофлуору білого) в УФ-світлі. Без відновлення клітинної стінки під час поділу ядра не може сформуватися нормальна фрагмопластна клітинна пластинка (цитокінез порушується), що призводить до утворення багатоядерних нежиттєздатних структур.</p>"
    ],
    [
      "Який фізико-хімічний механізм лежить в основі злиття протопластів під дією поліетиленгліколю (ПЕГ) та іонів Ca²⁺ за лужного pH?",
      "<p>Плазмалема ізольованих протопластів несе негативний поверхневий заряд через дисоціацію фосфатних груп ліпідів, що перешкоджає їх зближенню. Полімерні молекули <b>ПЕГ (м. м. 1500–6000, 25–40 %)</b> зв'язують вільну воду (дегідратація поверхні мембран) і притискають протопласти один до одного, а іони Ca<sup>2+</sup> за pH&nbsp;9,5…10,5 утворюють електростатичні містки між негативно зарядженими головками фосфоліпідів сусідніх мембран, дестабілізують ліпідний бішар і запускають злиття цитоплазм.</p>"
    ]
  ],

  build({ stageBox, ctrls, below, tabsBox }) {
    const modes = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Плазмоліз і ферментативне виділення (ЛР 24–25)"],
      ["b", "Б. Флотація (сахароза / W-5) і середовище К-3"],
      ["c", "В. ПЕГ/Ca²⁺-індуковане злиття та цибриди"]
    ], () => { dirty = true; });

    let dirty = true;

    /* ======================================================================
       TAB A: PLASMOLYSIS IN SUCROSE SERIES & ENZYMATIC ISOLATION (LABS 24-25)
       ====================================================================== */
    const A = modes.box("a");
    const stA = new Stage(A.st, { aspect: 16 / 10, minH: 295, maxH: 455, tag: "ЛР 24–25 · Осмотичний ряд сахарози (0,30–0,70 М) і гідроліз клітинної стінки", minW: 580 });

    const stateA = {
      sucM: 0.55,     // Концентрація осмотика C (0.15..0.80 М; ряд ЛР 24: 0.30, 0.35, 0.40, 0.50, 0.55, 0.60, 0.70 М)
      cellulase: 0.5, // Cellulase Onozuka R-10 (0..1.5 %, протокол ЛР 25: 0,5 %)
      macero: 0.2,    // Macerozyme R-10 + Driselase (0..0.6 %, протокол ЛР 25: 0,2 % + 0,1 %)
      hours: 14       // Час ферментативної інкубації (0..22 год; протокол: 14–16 год)
    };

    UI.slider(A.ct, {
      id: "l7-suc", label: "Концентрація сахарози / маніту C", min: 0.15, max: 0.80, step: 0.05, value: stateA.sucM, unit: "М",
      fmt: v => fmt(v, 2), on: v => { stateA.sucM = v; dirty = true; }
    });
    UI.buttons(A.ct, [
      { label: "0,30 М (тургор)", on: () => setSucA(0.30) },
      { label: "0,40 М (кутовий)", on: () => setSucA(0.40) },
      { label: "0,55 М (опуклий)", pri: true, on: () => setSucA(0.55) },
      { label: "0,70 М (гіпертонія)", on: () => setSucA(0.70) }
    ]);
    function setSucA(v) {
      const el = $("#l7-suc", A.ct);
      if (el) { el.value = v; el.dispatchEvent(new Event("input")); }
    }

    UI.slider(A.ct, {
      id: "l7-cel", label: "Целюлаза Onozuka R-10", min: 0.0, max: 1.5, step: 0.1, value: stateA.cellulase, unit: "%",
      fmt: v => fmt(v, 1), on: v => { stateA.cellulase = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l7-mac", label: "Macerozyme R-10 + Driselase", min: 0.0, max: 0.6, step: 0.05, value: stateA.macero, unit: "%",
      fmt: v => fmt(v, 2), on: v => { stateA.macero = v; dirty = true; }
    });
    UI.slider(A.ct, {
      id: "l7-hrs", label: "Тривалість інкубації в темряві (+25 °C)", min: 0, max: 22, step: 0.5, value: stateA.hours, unit: "год",
      fmt: v => fmt(v, 1), on: v => { stateA.hours = v; dirty = true; }
    });

    const outA = UI.out(A.ct, "");

    const rdA = UI.reads(A.bl, [
      ["psi", "Осмотичний потенціал розчину Ψ_s"],
      ["pstate", "Стан протопласта (ЛР 24)"],
      ["wall", "Залишок клітинної стінки"],
      ["yield", "Вихід інтактних протопластів"],
      ["vrel", "Відносний об'єм протопласта V/V₀"]
    ]);

    const chRowA = h("div", { class: "charts" });
    A.bl.append(chRowA);
    const chA1 = UI.chart(chRowA, "Залежність виходу інтактних протопластів та відносного об'єму V/V₀ від концентрації осмотика C", { aspect: 1.85, minH: 195, maxH: 270 });
    const chA2 = UI.chart(chRowA, "Кінетика ферментативного гідролізу клітинної стінки та виходу протопластів у часі (ЛР 25)", { aspect: 1.85, minH: 195, maxH: 270 });

    function calcA(C = stateA.sucM, cel = stateA.cellulase, mac = stateA.macero, t = stateA.hours) {
      // Osmotic potential Psi_s = -i * C * R * T (at 25°C = 298.15 K, RT = 2.479 MPa*L/mol)
      const psiS = -1.0 * C * 2.479;
      const Ciso = 0.36; // incipient plasmolysis threshold (MPa ~ -0.89)
      const b = 0.20;    // non-osmotic volume fraction

      // Relative volume of protoplast (Pfeffer-Boyle-Van't Hoff):
      const vRel = C < Ciso
        ? clamp(1 + (Ciso - C) * 2.1, 1.0, 1.65)
        : clamp(b + (1 - b) * (Ciso / C), 0.38, 1.0);

      // Wall digestion kinetics:
      const kEnz = 0.24 * Math.pow(Math.max(0, cel) / 0.5, 0.75) * Math.pow(Math.max(0, mac) / 0.2, 0.65);
      const wallRem = Math.exp(-kEnz * t) * 100; // % remaining cellulose/pectin wall
      const wallDigested = 1 - wallRem / 100;

      // Osmotic intactness window (optimal at 0.45..0.60 M; hypotonic lysis < 0.35 M; hypertonic shrinkage > 0.68 M)
      const osmSurviv = Math.exp(-Math.pow((C - 0.52) / 0.13, 2.4));
      // Over-digestion enzyme toxicity if t * kEnz is too large
      const overDig = Math.exp(-Math.max(0, kEnz * t - 3.6) * 0.35);

      const yieldMillions = 4.8 * Math.pow(wallDigested, 1.6) * osmSurviv * overDig; // 10^6 protoplasts / g leaf

      let pState = "Опуклий плазмоліз / стабільна сфера";
      let cls = "good";
      if (C < 0.32) {
        pState = wallRem < 35 ? "Осмотичний лізис (розрив плазмалеми!)" : "Повний тургор (плазмоліз відсутній)";
        cls = wallRem < 35 ? "bad" : "warn";
      } else if (C < 0.42) {
        pState = "Початковий (кутовий) плазмоліз";
        cls = "warn";
      } else if (C < 0.49) {
        pState = "Увігнутий (конкавний) плазмоліз";
        cls = "good";
      } else if (C <= 0.62) {
        pState = wallRem < 25 ? "Ізольовані сферичні протопласти" : "Опуклий (конвексний) плазмоліз";
        cls = "good";
      } else {
        pState = "Гіпертонічна дегідратація (псевдоплазмоліз)";
        cls = "warn";
      }

      return { psiS, vRel, wallRem, wallDigested, osmSurviv, yieldMillions, pState, cls };
    }

    function drawA(time) {
      const res = calcA();
      rdA.set("psi", fmt(res.psiS, 2), "МПа");
      rdA.set("pstate", res.pState);
      rdA.set("wall", fmt(res.wallRem, 1), "% клітинної оболонки");
      rdA.set("yield", `${fmt(res.yieldMillions, 2)}×10⁶`, "протопластів / г листка");
      rdA.set("vrel", fmt(res.vRel * 100, 0), "% від V_ізо");

      outA.el.className = "bout " + res.cls;
      outA.set(
        `<b>Осмотичний і ферментативний стан (ЛР 24–25):</b> при <code>C = ${fmt(stateA.sucM, 2)} М</code> осмотичний потенціал розчину становить <b>Ψ<sub>s</sub> = ${fmt(res.psiS, 2)} МПа</b> (${res.pState}). ` +
        `За ${fmt(stateA.hours, 1)} год дії ферментів (Onozuka R-10 ${fmt(stateA.cellulase, 1)} % + Macerozyme ${fmt(stateA.macero, 2)} %) зруйновано <b>${fmt(100 - res.wallRem, 1)} %</b> целюлозно-пектинової стінки; ` +
        `вихід життєздатних сферичних протопластів: <b>${fmt(res.yieldMillions, 2)}·10⁶ шт./г</b>.`
      );

      // Draw Stage A: 6 mesophyll cells undergoing plasmolysis & wall dissolution into spherical protoplasts
      stA.clear();
      const c = stA.ctx, W = stA.W, H = stA.H, T = Theme.c;
      Gfx.text(c, `Мікроскопія мезофілу N. tabacum L.: C = ${fmt(stateA.sucM, 2)} М (Ψs = ${fmt(res.psiS, 2)} МПа) · деградація стінки ${fmt(100 - res.wallRem, 0)} %`, W / 2, 22, { align: "center", size: 12, weight: 700, color: T.ink });

      const cols = 3, rows = 2;
      const cellW = Math.min(165, (W - 60) / cols);
      const cellH = Math.min(125, (H - 76) / rows);
      const startX = (W - cols * cellW) / 2;
      const startY = 42;

      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const idx = r * cols + col;
          const cx = startX + (col + 0.5) * cellW;
          const cy = startY + (r + 0.5) * cellH;
          const hw = cellW * 0.42;
          const hh = cellH * 0.41;

          // 1. Hexagonal/polygonal rigid cell wall (fades out as wallRem -> 0)
          if (res.wallRem > 3) {
            c.save();
            c.strokeStyle = rgba("#7E8F78", clamp(res.wallRem / 100, 0.08, 0.92));
            c.lineWidth = 1.2 + (res.wallRem / 100) * 3.2;
            if (res.wallRem < 65) c.setLineDash([6, 4]);
            Gfx.rr(c, cx - hw, cy - hh, hw * 2, hh * 2, 10);
            c.stroke();
            c.restore();
          }

          // 2. Protoplast geometry inside or freed from cell wall
          const floatX = (1 - res.wallRem / 100) * Math.sin(time * 1.4 + idx * 1.7) * 7;
          const floatY = (1 - res.wallRem / 100) * Math.cos(time * 1.1 + idx * 2.1) * 5;
          const px = cx + floatX;
          const py = cy + floatY;

          const burst = stateA.sucM < 0.32 && res.wallRem < 35;
          if (burst) {
            // Burst protoplast: ruptured plasmalemma and scattered peripheral chloroplasts
            c.strokeStyle = T.bad;
            c.lineWidth = 1.5;
            c.setLineDash([3, 4]);
            c.beginPath();
            c.arc(px, py, hh * 0.92, 0.4, 5.2);
            c.stroke();
            c.setLineDash([]);
            for (let k = 0; k < 12; k++) {
              const a = k * 0.52 + idx;
              const d = hh * (0.45 + 0.65 * hash01(k, idx));
              Gfx.sphere(c, px + Math.cos(a) * d, py + Math.sin(a) * d, 4.2, "#2D8A4E");
            }
          } else {
            // Smooth interpolation between rectangular turgid cell and spherical Laplace protoplast
            const sphereFrac = clamp(1 - res.wallRem / 100 + smooth(0.36, 0.55, stateA.sucM) * 0.85, 0, 1);
            const scaleV = Math.sqrt(clamp(res.vRel, 0.42, 1.15));
            const rx = lerp(hw - 3, Math.min(hw, hh) * 0.86, sphereFrac) * scaleV;
            const ry = lerp(hh - 3, Math.min(hw, hh) * 0.86, sphereFrac) * scaleV;
            const cornerR = lerp(8, Math.min(rx, ry), sphereFrac);

            // Hechtian strands (нитки Гехта) during plasmolysis when cell wall is still present
            if (res.wallRem > 30 && stateA.sucM >= 0.40) {
              c.strokeStyle = rgba("#3A7D4E", 0.32);
              c.lineWidth = 0.8;
              for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                c.beginPath();
                c.moveTo(cx + dx * (hw - 4), cy + dy * (hh - 4));
                c.lineTo(px + dx * rx * 0.72, py + dy * ry * 0.72);
                c.stroke();
              }
            }

            // Protoplast body (plasmalemma + translucent central vacuole)
            c.save();
            Gfx.rr(c, px - rx, py - ry, rx * 2, ry * 2, cornerR);
            const pg = c.createRadialGradient(px - rx * 0.25, py - ry * 0.25, rx * 0.1, px, py, Math.max(rx, ry));
            pg.addColorStop(0, "rgba(218,242,216,0.85)");
            pg.addColorStop(0.75, "rgba(146,208,154,0.80)");
            pg.addColorStop(1, "rgba(62,142,84,0.88)");
            c.fillStyle = pg;
            c.fill();
            c.lineWidth = 1.8;
            c.strokeStyle = "#266D3E";
            c.stroke();

            // Central vacuole
            c.fillStyle = "rgba(245,252,245,0.52)";
            c.beginPath();
            c.ellipse(px - rx * 0.06, py, rx * 0.56, ry * 0.54, 0, 0, 7);
            c.fill();

            // Peripheral chloroplasts arranged as a green necklace along the plasmalemma
            const nChl = 12;
            for (let k = 0; k < nChl; k++) {
              const ang = (k / nChl) * Math.PI * 2 + time * 0.15;
              const chX = px + Math.cos(ang) * (rx * 0.78);
              const chY = py + Math.sin(ang) * (ry * 0.78);
              c.fillStyle = "#1E7A3C";
              c.beginPath();
              c.ellipse(chX, chY, 4.8, 2.8, ang + Math.PI / 2, 0, 7);
              c.fill();
            }
            c.restore();
          }
        }
      }

      // Bottom legend bar on Stage A
      Gfx.text(c, "Ряд сахарози за ЛР 24 (с. 99): 0,30 М (тургор) → 0,40 М (початковий) → 0,55–0,60 М (опуклий плазмоліз / ізольовані протопласти)", W / 2, H - 14, { align: "center", size: 11, color: T.muted });

      // Chart A1: Yield & Relative Volume vs Osmoticum concentration C
      const ptsY = [], ptsV = [];
      for (let cVal = 0.15; cVal <= 0.80; cVal += 0.02) {
        const m = calcA(cVal, stateA.cellulase, stateA.macero, stateA.hours);
        ptsY.push([cVal, m.yieldMillions]);
        ptsV.push([cVal, m.vRel * 3.0]); // scaled for dual display
      }
      drawChart(chA1, {
        x: [0.15, 0.80], y: [0, 5.5],
        xl: "Концентрація осмотика C (сахароза / маніт), М",
        yl: "Вихід (10⁶/г) / 3·(V/V_ізо)",
        band: [{ x0: 0.45, x1: 0.60, color: rgba(T.good, 0.10) }],
        vl: [{ x: stateA.sucM, color: T.ink, dash: [3, 3], label: `C = ${fmt(stateA.sucM, 2)} М` }],
        series: [
          { pts: ptsY, color: T.chl, w: 2.6, fill: rgba(T.chl, 0.08) },
          { pts: ptsV, color: T.data, w: 2.0, dash: [5, 3] }
        ],
        marks: [
          { x: stateA.sucM, y: res.yieldMillions, color: T.chl, label: `${fmt(res.yieldMillions, 2)}·10⁶` }
        ],
        legend: [
          { label: "Вихід інтактних протопластів (10⁶/г)", color: T.chl },
          { label: "Відносний об'єм 3·(V/V_ізо)", color: T.data }
        ]
      });

      // Chart A2: Enzymatic digestion kinetics over 0..22 hours
      const ptsWallT = [], ptsYieldT = [];
      for (let hVal = 0; hVal <= 22; hVal += 0.5) {
        const m = calcA(stateA.sucM, stateA.cellulase, stateA.macero, hVal);
        ptsWallT.push([hVal, m.wallRem]);
        ptsYieldT.push([hVal, m.yieldMillions * 20]); // 5*10^6 -> 100
      }
      drawChart(chA2, {
        x: [0, 22], y: [0, 105],
        xl: "Час інкубації у ферментній суміші t, год",
        yl: "Залишок стінки (%) / 20·Вихід",
        band: [{ x0: 14, x1: 16, color: rgba(T.good, 0.10) }],
        vl: [{ x: stateA.hours, color: T.ink, dash: [3, 3], label: `${fmt(stateA.hours, 1)} год` }],
        series: [
          { pts: ptsYieldT, color: T.chl, w: 2.5 },
          { pts: ptsWallT, color: T.carot, w: 2.2, dash: [5, 3] }
        ],
        legend: [
          { label: "Вихід протопластів (відн. од.)", color: T.chl },
          { label: "Залишок клітинної стінки (%)", color: T.carot }
        ]
      });
    }

    /* ======================================================================
       TAB B: FLOTATION PURIFICATION (SUCROSE / W-5) & K-3 MEDIUM
       ====================================================================== */
    const B = modes.box("b");
    const stB = new Stage(B.st, { aspect: 16 / 10, minH: 295, maxH: 455, tag: "ЛР 25 · Флотація на межі фаз сахароза / W-5 та регенерація стінки в середовищі К-3", minW: 580 });

    const stateB = {
      gForce: 100,    // Прискорення центрифугування (20..400 g; оптимум 100 g)
      sucBot: 0.55,   // Нижній шар сахарози (0.35..0.70 М; оптимум 0.55 М, ρ ≈ 1.070 г/см³)
      cultHours: 48,  // Час культивування у середовищі К-3 (0..96 год)
      uvCalco: true   // Флуоресценція Calcofluor White
    };

    UI.slider(B.ct, {
      id: "l7-gf", label: "Прискорення центрифугування g", min: 20, max: 400, step: 10, value: stateB.gForce, unit: "g",
      fmt: v => fmt(v, 0), on: v => { stateB.gForce = v; dirty = true; }
    });
    UI.slider(B.ct, {
      id: "l7-sucb", label: "Густина нижньої фази сахарози", min: 0.35, max: 0.70, step: 0.05, value: stateB.sucBot, unit: "М",
      fmt: v => `${fmt(v, 2)} М (ρ≈${fmt(1 + v * 0.128, 3)})`, on: v => { stateB.sucBot = v; dirty = true; }
    });
    UI.slider(B.ct, {
      id: "l7-k3h", label: "Культивування у середовищі К-3", min: 0, max: 96, step: 4, value: stateB.cultHours, unit: "год",
      fmt: v => fmt(v, 0) + ` (${fmt(v / 24, 1)} доби)`, on: v => { stateB.cultHours = v; dirty = true; }
    });
    UI.check(B.ct, {
      id: "l7-uv", label: "УФ-підсвічування Calcofluor White (нова целюлоза)", value: stateB.uvCalco,
      on: v => { stateB.uvCalco = v; dirty = true; }
    });

    const outB = UI.out(B.ct, "");

    const rdB = UI.reads(B.bl, [
      ["rho", "Густина фаз (Сахароза / Протопласт / W-5)"],
      ["ring", "Вихід у зеленому кільці інтерфази"],
      ["purity", "Чистота фракції інтактних протопластів"],
      ["calco", "Регенерація клітинної стінки (К-3)"],
      ["mitos", "Частка клітин у першому мітозі"]
    ]);

    const chRowB = h("div", { class: "charts" });
    B.bl.append(chRowB);
    const chB1 = UI.chart(chRowB, "Ефективність флотаційного збору в інтерфазі та механічне руйнування залежно від прискорення g", { aspect: 1.85, minH: 195, maxH: 270 });
    const chB2 = UI.chart(chRowB, "Динаміка ресинтезу целюлозної стінки та початку мітотичних поділів у середовищі К-3", { aspect: 1.85, minH: 195, maxH: 270 });

    function calcB(g = stateB.gForce, suc = stateB.sucBot, hK3 = stateB.cultHours) {
      const rhoSuc = 1.000 + suc * 0.128; // g/cm³ (~1.070 at 0.55 M)
      const rhoW5 = 1.018;                // g/cm³
      const rhoProto = 1.042;             // intact vacuolated protoplast density

      // Flotation occurs only if rhoSuc > rhoProto > rhoW5
      const buoyFactor = smooth(1.036, 1.058, rhoSuc);
      const sepEff = 1 - Math.exp(-g / 42);
      const gDamage = 1 / (1 + Math.exp(-(g - 235) / 38));
      const ringYield = clamp(buoyFactor * sepEff * (1 - gDamage) * 94, 2, 95);
      const purity = clamp(55 + 42 * buoyFactor * (1 - 0.6 * gDamage), 35, 97);

      // In K-3 medium: cell wall resynthesis (24..72 h) followed by first mitotic division (48..96 h)
      const wallRegen = 100 / (1 + Math.exp(-(hK3 - 38) / 10));
      const firstMitosis = 78 / (1 + Math.exp(-(hK3 - 66) / 11));

      return { rhoSuc, rhoW5, rhoProto, ringYield, gDamage: gDamage * 100, purity, wallRegen, firstMitosis };
    }

    function drawB(time) {
      const res = calcB();
      rdB.set("rho", `${fmt(res.rhoSuc, 3)} / 1,042 / 1,018`, "г/см³");
      rdB.set("ring", fmt(res.ringYield, 1), "% у кільці");
      rdB.set("purity", fmt(res.purity, 1), "% інтактних");
      rdB.set("calco", fmt(res.wallRegen, 1), "% (Calcofluor+)");
      rdB.set("mitos", fmt(res.firstMitosis, 1), "% біклітинних");

      let cls = "good";
      if (res.rhoSuc < 1.044) cls = "bad";
      else if (stateB.gForce > 200 || stateB.gForce < 50) cls = "warn";
      outB.el.className = "bout " + cls;
      outB.set(
        res.rhoSuc < 1.044
          ? `<b>Порушення умови флотації!</b> Густина нижнього шару сахарози (<code>ρ = ${fmt(res.rhoSuc, 3)} г/см³</code>) менша за густину протопластів (<code>1,042 г/см³</code>) — інтактні протопласти тонуть на дно разом із детритом.`
          : `<b>Двофазна флотація (ЛР 25, с. 103):</b> між нижнім шаром <code>${fmt(stateB.sucBot, 2)} М сахарози</code> (ρ = ${fmt(res.rhoSuc, 3)} г/см³) та верхнім сольовим розчином <b>W-5</b> (ρ = 1,018 г/см³) формується <b>зелене інтерфазне кільце</b> (вихід <b>${fmt(res.ringYield, 1)} %</b>, чистота <b>${fmt(res.purity, 1)} %</b>). У середовищі <b>К-3</b> за ${stateB.cultHours} год регенеровано <b>${fmt(res.wallRegen, 0)} %</b> клітинної стінки.`
      );

      // Draw Stage B: Left = Centrifuge tube with Sucrose / Interphase Green Ring / W-5; Right = K-3 Culture regeneration & mitosis
      stB.clear();
      const c = stB.ctx, W = stB.W, H = stB.H, T = Theme.c;

      // Left: Centrifuge tube
      const tx = W * 0.16;
      const ty = H * 0.12;
      const tw = Math.min(92, W * 0.18);
      const th = H * 0.72;

      Draw.tube(c, tx, ty, tw, th, [
        { frac: 0.62, color: Theme.dark ? "rgba(215,205,155,0.22)" : "rgba(242,234,190,0.68)" }, // bottom sucrose
        { frac: 0.38, color: Theme.dark ? "rgba(150,200,225,0.18)" : "rgba(210,234,246,0.62)" }  // top W-5 solution
      ], {
        fill: 0.84,
        label: `Центрифужна пробірка (${stateB.gForce} g)`,
        after(ctx, topY) {
          const fillH = 0.84 * th;
          const interY = ty + th - fillH * 0.62; // exact boundary between sucrose and W-5

          // Green interphase ring of intact protoplasts!
          const ringAlpha = clamp(res.ringYield / 100, 0.1, 0.95);
          const ringH = 7 + (res.ringYield / 100) * 9;
          const rg = ctx.createLinearGradient(0, interY - ringH, 0, interY + ringH);
          rg.addColorStop(0, "rgba(44,122,77,0)");
          rg.addColorStop(0.5, `rgba(34,139,68,${ringAlpha})`);
          rg.addColorStop(1, "rgba(44,122,77,0)");
          ctx.fillStyle = rg;
          ctx.fillRect(tx, interY - ringH, tw, ringH * 2);

          // Tiny rising protoplast spheres in sucrose layer
          const rF = rng(707);
          for (let i = 0; i < 24; i++) {
            const px = tx + 10 + rF() * (tw - 20);
            const py = interY + (rF() - 0.5) * 8;
            ctx.fillStyle = "#1E7B3B";
            ctx.beginPath();
            ctx.arc(px, py, 2.3, 0, 7);
            ctx.fill();
          }

          // Bottom pellet of debris and broken chloroplasts
          const pelY = ty + th - 14;
          ctx.fillStyle = "#3D5836";
          ctx.beginPath();
          ctx.ellipse(tx + tw / 2, pelY + 6, tw * 0.36, 8, 0, 0, 7);
          ctx.fill();
        }
      });

      // Labels pointing to the 3 zones of the centrifuge tube
      const lx = tx + tw + 14;
      const fillH = 0.84 * th;
      const interY = ty + th - fillH * 0.62;
      Gfx.text(c, "Розчин W-5 (ρ = 1,018 г/см³)", lx, interY - 34, { size: 11, weight: 600, color: T.data });
      Gfx.arrow(c, lx - 2, interY, tx + tw + 2, interY, { col: T.good, w: 1.8, head: 5 });
      Gfx.text(c, `Зелене кільце протопластів (${fmt(res.ringYield, 0)} %)`, lx + 4, interY + 4, { size: 11.5, weight: 700, color: T.good });
      Gfx.text(c, `${fmt(stateB.sucBot, 2)} М сахароза (ρ = ${fmt(res.rhoSuc, 3)})`, lx, interY + 42, { size: 11, weight: 600, color: T.carot });
      Gfx.text(c, "Осад: детрит і вільні хлоропласти", lx, ty + th - 10, { size: 10.5, color: T.muted });

      // Right panel: K-3 medium cell wall regeneration & first division
      const rx0 = W * 0.57;
      const rw = W - rx0 - 14;
      if (rw > 150) {
        Gfx.rr(c, rx0, ty, rw, th, 10);
        c.fillStyle = stateB.uvCalco ? "#0F1B29" : T.sheet;
        c.fill();
        c.strokeStyle = T.rule;
        c.stroke();

        Gfx.text(c, `Середовище К-3 (${stateB.cultHours} год)${stateB.uvCalco ? " · УФ Calcofluor White" : ""}`, rx0 + rw / 2, ty + 20, {
          align: "center", size: 11.5, weight: 700, color: stateB.uvCalco ? "#9AD1FF" : T.ink
        });

        const cxK = rx0 + rw / 2;
        const cyK = ty + th * 0.50;
        const divProg = clamp((stateB.cultHours - 44) / 42, 0, 1);
        const sep = divProg * 22;

        // Draw either single regenerating protoplast or dividing bi-cellular microcolony ("8" shape)
        for (const sgn of divProg > 0.05 ? [-1, 1] : [0]) {
          const xCell = cxK + sgn * sep;
          const rCell = sgn === 0 ? 36 : 29;
          if (stateB.uvCalco && res.wallRegen > 5) {
            Gfx.glow(c, xCell, cyK, rCell + 14, "#38B6FF", (res.wallRegen / 100) * 0.65);
          }
          Gfx.sphere(c, xCell, cyK, rCell, "#2E854B");
          if (res.wallRegen > 5) {
            c.strokeStyle = stateB.uvCalco
              ? `rgba(110,210,255,${clamp(res.wallRegen / 100, 0.15, 0.98)})`
              : `rgba(120,165,110,${clamp(res.wallRegen / 100, 0.2, 0.95)})`;
            c.lineWidth = 1.5 + (res.wallRegen / 100) * 3.0;
            c.beginPath();
            c.arc(xCell, cyK, rCell + 2, 0, 7);
            c.stroke();
          }
        }
        // Cell plate (фрагмопласт) between dividing daughter cells
        if (divProg > 0.15) {
          c.strokeStyle = stateB.uvCalco ? "#7CE0FF" : "#D4E8D0";
          c.lineWidth = 2.4;
          c.beginPath();
          c.moveTo(cxK, cyK - 22);
          c.lineTo(cxK, cyK + 22);
          c.stroke();
        }

        Gfx.text(c, res.firstMitosis > 25 ? "Регенерація оболонки та І мітоз (біклітинна стадія)" : res.wallRegen > 35 ? "Синтез целюлозних мікрофібрил (48–72 год)" : "Сферичний протопласт без клітинної стінки",
          cxK, ty + th - 14, { align: "center", size: 10.5, color: stateB.uvCalco ? "#B8DEFF" : T.muted }
        );
      }

      // Chart B1: Flotation yield & damage vs g-force
      const ptsRing = [], ptsDmg = [];
      for (let g = 20; g <= 400; g += 10) {
        const m = calcB(g, stateB.sucBot, stateB.cultHours);
        ptsRing.push([g, m.ringYield]);
        ptsDmg.push([g, m.gDamage]);
      }
      drawChart(chB1, {
        x: [20, 400], y: [0, 100],
        xl: "Прискорення центрифугування, g",
        yl: "Вихід у кільці / пошкодження, %",
        band: [{ x0: 80, x1: 130, color: rgba(T.good, 0.10) }],
        vl: [{ x: stateB.gForce, color: T.ink, dash: [3, 3], label: `${stateB.gForce} g` }],
        series: [
          { pts: ptsRing, color: T.chl, w: 2.5 },
          { pts: ptsDmg, color: T.bad, w: 2.0, dash: [4, 3] }
        ],
        marks: [
          { x: stateB.gForce, y: res.ringYield, color: T.chl, label: `${fmt(res.ringYield, 0)}%` }
        ],
        legend: [
          { label: "Інтактні протопласти в інтерфазі (%)", color: T.chl },
          { label: "Механічне руйнування (%)", color: T.bad }
        ]
      });

      // Chart B2: Wall regeneration and first mitosis in K-3 medium over 0..96 h
      const ptsW = [], ptsM = [];
      for (let hVal = 0; hVal <= 96; hVal += 4) {
        const m = calcB(stateB.gForce, stateB.sucBot, hVal);
        ptsW.push([hVal, m.wallRegen]);
        ptsM.push([hVal, m.firstMitosis]);
      }
      drawChart(chB2, {
        x: [0, 96], y: [0, 105],
        xl: "Час культивування в середовищі К-3, год",
        yl: "Частка клітин, %",
        vl: [{ x: stateB.cultHours, color: T.ink, dash: [3, 3], label: `${stateB.cultHours} год` }],
        series: [
          { pts: ptsW, color: T.data, w: 2.5 },
          { pts: ptsM, color: T.chl, w: 2.4 }
        ],
        legend: [
          { label: "Регенерація клітинної стінки (Calcofluor+)", color: T.data },
          { label: "Перший мітотичний поділ", color: T.chl }
        ]
      });
    }

    /* ======================================================================
       TAB C: PEG / Ca2+ SOMATIC HYBRIDIZATION & CYBRIDS
       ====================================================================== */
    const C = modes.box("c");
    const stC = new Stage(C.st, { aspect: 16 / 10, minH: 295, maxH: 455, tag: "Тема 7 · ПЕГ/Ca²⁺-індуковане злиття ліпідних бішарів: гетерокаріони та цибриди", minW: 580 });

    const stateC = {
      pegPct: 30,     // Концентрація ПЕГ-4000 (0..50 %, оптимум 25–35 %)
      caMM: 50,       // Концентрація CaCl2 при промиванні (5..100 мМ, оптимум 50 мМ при pH 10.0)
      stageProg: 0.65,// Стадія злиття (0 = окремі, 0.35 = аглютинація, 0.7 = місток, 1.0 = гетерокаріон)
      mode: "sym"     // "sym" (Симетричний гібрид A+B) | "cybrid" (Цибрид: перенесення ЦЧС)
    };

    UI.seg(C.ct, {
      label: "Тип соматичної гібридизації",
      options: [
        ["sym", "Симетричний гібрид (A + B)"],
        ["cybrid", "Цибрид (ядро інактивовано γ-променями)"]
      ],
      value: stateC.mode,
      on: v => { stateC.mode = v; dirty = true; }
    });
    UI.slider(C.ct, {
      id: "l7-peg", label: "Концентрація ПЕГ (м. м. 4000)", min: 0, max: 50, step: 2, value: stateC.pegPct, unit: "%",
      fmt: v => fmt(v, 0), on: v => { stateC.pegPct = v; dirty = true; }
    });
    UI.slider(C.ct, {
      id: "l7-ca", label: "Концентрація Ca²⁺ (при pH 9,8)", min: 5, max: 100, step: 5, value: stateC.caMM, unit: "мМ",
      fmt: v => fmt(v, 0), on: v => { stateC.caMM = v; dirty = true; }
    });
    UI.slider(C.ct, {
      id: "l7-prog", label: "Фаза контактного злиття мембран", min: 0.0, max: 1.0, step: 0.05, value: stateC.stageProg, unit: "",
      fmt: v => v < 0.25 ? "1. Відштовхування" : v < 0.55 ? "2. Аглютинація ПЕГ" : v < 0.85 ? "3. Бішаровий місток" : "4. Сферичний продукт",
      on: v => { stateC.stageProg = v; dirty = true; }
    });

    const outC = UI.out(C.ct, "");

    const rdC = UI.reads(C.bl, [
      ["zeta", "Поверхневий ζ-потенціал плазмалеми"],
      ["hetero", "Частота бінарних гетерокаріонів (A+B)"],
      ["homo", "Гомокаріони (A+A та B+B)"],
      ["multi", "Багатоядерні полікаріони (≥3) / лізис"],
      ["genome", "Генетична формула продукту злиття"]
    ]);

    const chRowC = h("div", { class: "charts" });
    C.bl.append(chRowC);
    const chC1 = UI.chart(chRowC, "Частота утворення гетерокаріонів (A+B) та токсичного лізису залежно від концентрації ПЕГ", { aspect: 1.85, minH: 195, maxH: 270 });
    const chC2 = UI.chart(chRowC, "Пуассонівський розподіл продуктів злиття за кількістю залучених протопластів k", { aspect: 1.85, minH: 195, maxH: 270 });

    function calcC(peg = stateC.pegPct, ca = stateC.caMM) {
      // Zeta potential neutralized from -32 mV toward 0 by Ca2+ and PEG dehydration
      const zeta = -32 * Math.exp(-ca / 48) * (1 - 0.55 * (peg / 50));
      // Fusion parameter lambda (average fusion events per protoplast)
      const pegOpt = Math.exp(-Math.pow((peg - 31) / 11, 2));
      const caFac = 0.35 + 0.65 * (ca / (18 + ca));
      const lam = 0.52 * pegOpt * caFac;

      // Binary fusion probability P(2) = (lam^2 / 2) * exp(-lam) scaled to realistic % (up to ~14% heterokaryons)
      const pBinary = 28 * pegOpt * caFac;
      const pHetero = pBinary * 0.5; // 2*0.5*0.5 = 50% of binary fusions are A+B, 50% are A+A or B+B
      const pHomo = pBinary * 0.5;
      const pMulti = clamp(100 / (1 + Math.exp(-(peg - 39) / 4.5)), 0.5, 65);
      const pUnfused = Math.max(0, 100 - pHetero - pHomo - pMulti);

      return { zeta, lam, pHetero, pHomo, pMulti, pUnfused };
    }

    function drawC(time) {
      const res = calcC();
      const isCyb = stateC.mode === "cybrid";
      rdC.set("zeta", fmt(res.zeta, 1), "мВ");
      rdC.set("hetero", fmt(res.pHetero, 1), "% (A+B)");
      rdC.set("homo", fmt(res.pHomo, 1), "% (A+A, B+B)");
      rdC.set("multi", fmt(res.pMulti, 1), "%");
      rdC.set("genome", isCyb ? "n_B + хлДНК_A + мтДНК_A/B (Цибрид)" : "2n_A + 2n_B + хлДНК_A/B (Амфідиплоїд)");

      outC.el.className = "bout " + (stateC.pegPct > 38 ? "warn" : stateC.pegPct < 15 ? "warn" : "good");
      outC.set(
        `<b>Соматична гібридизація (${isCyb ? "отримання цибрида з ЦЧС" : "симетричний соматичний гібрид"}):</b> ` +
        `при <code>${stateC.pegPct} % ПЕГ</code> та <code>${stateC.caMM} мМ Ca²⁺</code> поверхневий заряд плазмалеми знижується до <b>${fmt(res.zeta, 1)} мВ</b>. ` +
        `Частка цільових бінарних гетерокаріонів (зелений мезофільний протопласт А + безбарвний калюсний протопласт Б) становить <b>${fmt(res.pHetero, 1)} %</b>.`
      );

      // Draw Stage C: Top = Protoplast A (green mesophyll) + Protoplast B (translucent callus) fusing; Bottom = Lipid Bilayer bridge closeup
      stC.clear();
      const c = stC.ctx, W = stC.W, H = stC.H, T = Theme.c;
      const p = stateC.stageProg;
      const cx = W * 0.50;
      const cyTop = H * 0.36;
      const rP = Math.min(54, H * 0.21);
      const dist = lerp(rP * 1.45, 0, ease(p));

      const xA = cx - dist;
      const xB = cx + dist;

      // Protoplast A (Mesophyll: green chloroplasts + nucleus A; if cybrid, nucleus A is X-irradiated/inactivated)
      Gfx.sphere(c, xA, cyTop, rP * (p > 0.85 ? 1.18 : 1.0), "#348C51", { ring: "#1E6336", rw: 2 });
      // Protoplast B (Callus/Root: pale cream-amber + nucleus B)
      if (p < 0.92) {
        Gfx.sphere(c, xB, cyTop, rP, "#DFD4A6", { ring: "#9A8948", rw: 2, a: 1 - smooth(0.75, 0.98, p) * 0.55 });
      }

      // Chloroplasts from A (green) and vacuoles/leukoplasts from B inside the fusing pair
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + time * 0.3;
        const gx = lerp(xA, cx, p * 0.7) + Math.cos(a) * (rP * 0.65);
        const gy = cyTop + Math.sin(a) * (rP * 0.65);
        c.fillStyle = "#176330";
        c.beginPath();
        c.ellipse(gx, gy, 5.5, 3.0, a, 0, 7);
        c.fill();
      }

      // Nucleus A (left) and Nucleus B (right)
      if (!isCyb) {
        const nAx = lerp(xA - 8, cx - 10, p);
        Gfx.sphere(c, nAx, cyTop, 11, "#1C5A32", { ring: "#fff", rw: 1.2 });
        Gfx.text(c, "n_A", nAx, cyTop + 4, { align: "center", size: 9.5, weight: 700, color: "#fff" });
      } else {
        // Irradiated degraded nucleus A in cybridization!
        const nAx = xA - 8;
        if (p < 0.7) {
          c.strokeStyle = T.bad;
          c.setLineDash([2, 2]);
          c.beginPath();
          c.arc(nAx, cyTop, 10, 0, 7);
          c.stroke();
          c.setLineDash([]);
          Gfx.text(c, "γ-блок", nAx, cyTop - 14, { align: "center", size: 9.5, weight: 700, color: T.bad });
        }
      }
      const nBx = lerp(xB + 8, cx + (isCyb ? 0 : 10), p);
      Gfx.sphere(c, nBx, cyTop, 11, "#8A6218", { ring: "#fff", rw: 1.2 });
      Gfx.text(c, "n_B", nBx, cyTop + 4, { align: "center", size: 9.5, weight: 700, color: "#fff" });

      // Labels for parents
      Gfx.text(c, "Донор А (мезофіл, зелені хлоропласти)", W * 0.20, 22, { align: "center", size: 11, weight: 700, color: T.chl });
      Gfx.text(c, "Реципієнт Б (калюс, ядро n_B)", W * 0.80, 22, { align: "center", size: 11, weight: 700, color: T.carot });

      // Bottom inset: Molecular Phospholipid Bilayer Bridge (using Gfx.bilayer)
      const by0 = H * 0.67;
      const bh = H * 0.27;
      Gfx.rr(c, W * 0.08, by0, W * 0.84, bh, 10);
      c.fillStyle = T.sheet;
      c.fill();
      c.strokeStyle = T.rule;
      c.stroke();

      const gapPore = p > 0.45 ? (p - 0.45) * 95 : 0;
      Gfx.bilayer(c, W * 0.14, W * 0.86, by0 + bh * 0.54, 18, time, {
        s: 0.9,
        skip: x => Math.abs(x - cx) < gapPore
      });
      Gfx.text(c, "Молекулярний контакт двох плазмалем: дегідратація ПЕГ + кальцієві містки (Ca²⁺, pH 9,8)", cx, by0 + 16, { align: "center", size: 11, weight: 600, color: T.ink });

      // Chart C1: Heterokaryon yield & Lysis vs PEG %
      const ptsHet = [], ptsMul = [];
      for (let pg = 0; pg <= 50; pg += 2) {
        const m = calcC(pg, stateC.caMM);
        ptsHet.push([pg, m.pHetero]);
        ptsMul.push([pg, m.pMulti]);
      }
      drawChart(chC1, {
        x: [0, 50], y: [0, 50],
        xl: "Масова частка поліетиленгліколю (ПЕГ), %",
        yl: "Частка у суспензії, %",
        band: [{ x0: 25, x1: 35, color: rgba(T.good, 0.10) }],
        vl: [{ x: stateC.pegPct, color: T.ink, dash: [3, 3], label: `ПЕГ ${stateC.pegPct}%` }],
        series: [
          { pts: ptsHet, color: T.chl, w: 2.6 },
          { pts: ptsMul, color: T.bad, w: 2.0, dash: [4, 3] }
        ],
        marks: [
          { x: stateC.pegPct, y: res.pHetero, color: T.chl, label: `${fmt(res.pHetero, 1)}%` }
        ],
        legend: [
          { label: "Бінарні гетерокаріони А+Б (%)", color: T.chl },
          { label: "Полікаріони (≥3) та лізис (%)", color: T.bad }
        ]
      });

      // Chart C2: Product distribution bars
      drawChart(chC2, {
        x: [0.4, 4.6], y: [0, 100],
        xt: [1, 2, 3, 4],
        xfmt: v => ["", "Незлиті (1)", "Гомо (А+А, Б+Б)", "Гетеро (А+Б)", "Полікаріони (≥3)"][Math.round(v)] || "",
        yl: "Частка клітин, %",
        series: [
          {
            bars: true, bw: 34, color: alpha(T.chl, 0.82),
            pts: [
              [1, res.pUnfused],
              [2, res.pHomo],
              [3, res.pHetero],
              [4, res.pMulti]
            ]
          }
        ],
        marks: [
          { x: 3, y: res.pHetero, color: T.chl, label: `А+Б: ${fmt(res.pHetero, 1)}%` }
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
