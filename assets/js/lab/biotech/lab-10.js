(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

App.def(10, {
  cheat: `
    <p class="lead">
      <b>Гаплоїдна біотехнологія</b> та <b>ембріокультура</b> (культивування ізольованих зародків <i>in vitro</i> — «у склі») дозволяють скоротити селекційний процес створення чистих гомозиготних ліній з 6–8 років класичного інбридингу (самозапилення) до <b>одного вегетаційного періоду</b>, а також долати бар’єри <b>постзиготичної несумісності</b> (загибелі гібридного зародка після запліднення через дегенерацію ендосперму) при віддаленій міжвидовій та міжродовій гібридизації.
    </p>

    <h3>1. Андрогенез in vitro: культура пиляків і мікроспор (ЛР 38)</h3>
    <p>
      <b>Андрогенез <i>in vitro</i></b> — це шлях формування гаплоїдної рослини-регенеранта (з одинарним гаплоїдним набором хромосом <i>n</i>) із чоловічого гаметофіта — <b>мікроспори</b> або незрілого пилкового зерна у культурі ізольованих пиляків (<i>anther culture</i>) чи ізольованих мікроспор. За нормального розвитку <i>in vivo</i> (у живій рослині) одноядерна мікроспора проходить <b>асиметричний перший гаметофітний мітоз</b>, утворюючи велику <i>вегетативну клітину</i> (яка формує пилкову трубку) та малу веретеноподібну <i>генеративну клітину</i> (яка ділиться на два спермії).
    </p>
    <p>
      Під дією стресової передобробки (холодовий шок бутонів при <b>+4 °C протягом 3–5 діб</b> та/або тепловий шок ізольованих пиляків при <b>+32…35 °C протягом 24 год</b> на початку культивування) полярність цитоскелета мікроспори порушується. Мікротрубочки перебудовуються, і замість асиметричного гаметофітного поділу відбувається <b>симетричний спорофітний мітоз</b> з утворенням двох морфологічно однакових ядер, або ж вегетативне ядро починає багаторазово ділитися. Всередині міцної оболонки мікроспори (екзини) формується багатоклітинна структура, яка розриває екзину і розвивається у <b>гаплоїдний андрогенний ембріоїд</b> (зародок), минаючи стадію калюсу (<i>прямий ембріогенез</i>), або утворює гаплоїдний морфогенний калюс (<i>непрямий андрогенез</i>).
    </p>

    <div class="bcall bcall--idea">
      <b>Критичне цитологічне «вікно компетентності» (ЛР 38)</b>
      <p>
        Здатність до перемикання з гаметофітного на спорофітний шлях мають лише мікроспори у вузькій фазі — від <b>пізньої одноядерної вакуолізованої мікроспори</b> (коли центральна вакуоля відтісняє ядро до клітинної стінки перед першим мітозом, фаза G<sub>2</sub>/M) до самого початку першого пилкового мітозу. У ріпаку ярого та озимого (<i>Brassica napus</i> L.) цій стадії чітко відповідає морфометричний маркер — <b>довжина зеленого квіткового бутона 2,5–3,5 мм</b> (коли пелюстки досягають 1/2–2/3 довжини чашолистків, а пиляки мають жовто-зелене забарвлення). У дрібніших бутонах (&lt; 2,0 мм) мікроспори ще перебувають у тетрадах, а у більших (&gt; 4,0 мм) пилок уже двоядерний і накопичив крохмаль, що блокує ембріогенез.
      </p>
    </div>

    <h3>2. Гіногенез in vitro: культура незапліднених зав’язей та насіннєвих зачатків (ЛР 39)</h3>
    <p>
      <b>Гіногенез <i>in vitro</i></b> — отримання гаплоїдних рослин із клітин жіночого гаметофіта (зародкового мішка — мегагаметофіта) шляхом введення в культуру <i>in vitro</i> незапилених квіток, ізольованих зав’язей або <b>незапліднених насіннєвих зачатків</b> (<i>ovule culture</i>). Джерелом гаплоїдного ембріоїда або калюсу найчастіше стає <b>гаплоїдна яйцеклітина</b> (апогаметія / партеногенез <i>in vitro</i>), рідше — синергіди або клітини антиподів.
    </p>
    <p>
      Гіногенез є незамінним для культур, у яких пиляки дають високу частку альбіносних (безхлорофільних) регенерантів або низький вихід ембріоїдів, а також для ліній з <b>цитоплазматичною чоловічою стерильністю (ЦМС)</b>, де пилок дегенерує. Класичний об’єкт лабораторної роботи № 39 — <b>цукровий буряк (<i>Beta vulgaris</i> L.)</b>: незапліднені насіннєві зачатки ізолюють із закритих зелених бутонів за 1–2 доби до розкриття квітки та висаджують на агаризоване середовище Мурасіге—Скуга (МС), доповнене 6-бензиламінопурином (БАП, 0,3–1,0 мг/л) і підвищеним вмістом сахарози (6–8 %).
    </p>

    <h3>3. Дигаплоїдизація (колхіцинування) та математика досягнення гомозиготності</h3>
    <p>
      Первинні регенеранти андро- чи гіногенезу є <b>гаплоїдами (<i>n</i>)</b>: у ріпаку <i>Brassica napus</i> L. (амфідиплоїд 2<i>n</i> = 4<i>x</i> = 38) гаплоїд містить <i>n</i> = 2<i>x</i> = 19 хромосом; у диплоїдного цукрового буряка <i>Beta vulgaris</i> L. (2<i>n</i> = 2<i>x</i> = 18) гаплоїд має <i>n</i> = <i>x</i> = 9 хромосом. Оскільки гомологічні пари хромосом відсутні, мейоз у гаплоїдів порушений і вони є <b>стерильними</b> (не утворюють життєздатного насіння).
    </p>
    <p>
      Для відновлення фертильності проводять <b>подвоєння числа хромосом</b> (дигаплоїдизацію) за допомогою антимітотичного алкалоїду <b>колхіцину</b> (0,05–0,1 % водний розчин з експозицією 4–24 год для пагонів, корінців або безпосередньо в культурі мікроспор). Колхіцин специфічно зв’язується з димерами білка тубуліну, блокує полімеризацію ниток веретена поділу в метафазі мітозу (<b>К-мітоз</b>), внаслідок чого сестринські хроматиди розходяться, але цитокінез не відбувається — утворюється ядро з подвоєним набором хромосом (2<i>n</i>), де кожна хромосома представлена двома абсолютно ідентичними копіями. Такі рослини називають <b>подвоєними гаплоїдами</b> (<i>doubled haploids</i>, <b>DH-лінії</b>).
    </p>

    <div class="eq">
      <i>H<sub>k</sub></i><sup>інбр</sup> = 1 − (1/2)<sup><i>k</i></sup>, &emsp; <i>H</i><sub>1</sub><sup>DH</sup> = 100 % &ensp;(<i>k</i> = 1)
    </div>
    <p>
      Де <i>H<sub>k</sub></i><sup>інбр</sup> — частка гомозиготних локусів після <i>k</i> поколінь примусового самозапилення (інбридингу) гетерозиготного гібрида F<sub>1</sub>. Якщо за класичної селекції після <i>k</i> = 1 покоління гомозиготність становить лише 50 %, після <i>k</i> = 3 — 87,5 %, після <i>k</i> = 6 — 98,44 %, то DH-технологія забезпечує <b>100 % гомозиготність за всіма генами вже у першому поколінні (<i>H</i><sub>1</sub> = 1)</b>, а всі рецесивні алелі виявляються миттєво у фенотипі.
    </p>

    <div class="tblwrap">
      <table class="t bt">
        <thead>
          <tr>
            <th>Показник / Культура</th>
            <th>Андрогенез ріпаку (ЛР 38)</th>
            <th>Гіногенез буряка (ЛР 39)</th>
            <th>Ембріокультура (ЛР 40)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Рослинний об’єкт</td>
            <td>Ріпак ярий/озимий (<i>Brassica napus</i> L., 2<i>n</i> = 38 → <i>n</i> = 19)</td>
            <td>Буряк цукровий (<i>Beta vulgaris</i> L., 2<i>n</i> = 18 → <i>n</i> = 9)</td>
            <td>Міжвидові гібриди томата (<i>Solanum lycopersicum</i> L.), ріпаку, злаків</td>
          </tr>
          <tr>
            <td>Первинний експлантат</td>
            <td>Пиляки з бутонів довжиною <b>2,5–3,5 мм</b> (пізня одноядерна мікроспора)</td>
            <td>Незапліднені насіннєві зачатки з бутонів за 1–2 доби до цвітіння</td>
            <td>Незрілі гібридні зиготичні зародки (2<i>n</i>) через 8–16 діб після запилення</td>
          </tr>
          <tr>
            <td>Стресова передобробка</td>
            <td>Бутони <b>+4 °C (4 доби)</b>; пиляки в культурі <b>+32 °C (24 год)</b> у темряві</td>
            <td>Витримування суцвіть при <b>+4…+6 °C (2–4 доби)</b></td>
            <td>Не потрібна (важливе вчасне вилучення зародка до дегенерації ендосперму)</td>
          </tr>
          <tr>
            <td>Живильне середовище</td>
            <td>B<sub>5</sub> Гамборга або Ліхтера (NLN): <b>10 % сахарози</b>, 0,1 мг/л 2,4-Д + 0,1 мг/л НОК</td>
            <td>МС (Мурасіге—Скуга): <b>6–8 % сахарози</b>, 0,5 мг/л БАП + 0,1 мг/л ІОК</td>
            <td>Уайта, МС або Монньє: <b>8–12 % сахарози</b> (ранні зародки) або <b>2–3 %</b> (пізні)</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3>4. Ембріокультура та порятунок зародків (Embryo rescue, ЛР 40)</h3>
    <p>
      При віддаленій гібридизації (міжвидовій чи міжродовій) запліднення яйцеклітини часто відбувається нормально, проте триплоїдний <b>ендосперм (3<i>n</i>)</b> виявляється генетично незбалансованим і дегенерує на 7–15-ту добу після запилення. Позбавлений трофічної та гормональної підтримки, молодий гібридний зародок гине — це явище називають <b>постзиготичною несумісністю</b>. Метод <b>ембріокультури</b> (<i>embryo rescue</i> — «порятунок зародків») полягає в асептичному вилученні незрілого зародка з насіннєвого зачатка під бінокулярним мікроскопом і перенесенні його на штучне живильне середовище, яке замінює функції ендосперму.
    </p>
    <p>
      Ключовим фізико-хімічним параметром середовища в ембріокультурі є його <b>осмотичний потенціал Ψ<sub>s</sub></b>, який регулюють концентрацією сахарози (або маніту):
    </p>
    <div class="eq">
      Ψ<sub>s</sub> = −<i>i</i> · <i>C</i><sub>сах</sub> · <i>R</i> · <i>T</i>, &emsp; <i>C</i><sub>сах</sub> (моль/л) = 10 · <i>w</i><sub>сах</sub> (%) / 342,3
    </div>
    <ul>
      <li><b>Глобулярні та серцеподібні зародки (0,1–0,5 мм):</b> у живому насіннєвому зачатку вони оточені рідким ендоспермом із високим осмотичним тиском (Ψ<sub>s</sub> ≈ −0,6…−0,9 МПа). Для їх виживання <i>in vitro</i> необхідна <b>висока концентрація сахарози (8–12 %)</b>, гідролізат казеїну (200–500 мг/л) і глутамін. Якщо такий зародок помістити на середовище з низьким вмістом сахарози (2 %), відбувається <b>передчасне проростання (<i>precocious germination</i>)</b> — зародок припиняє ембріональний морфогенез, не закладає повноцінної апікальної меристеми пагона (плюмули) і утворює слабкий нежиттєздатний проросток.</li>
      <li><b>Торпедоподібні та сім’ядольні зародки (&gt; 1,0 мм):</b> вже стали автотрофними щодо амінокислот і потребують зниження осмотичного тиску (<b>2–3 % сахарози</b>, Ψ<sub>s</sub> ≈ −0,15…−0,22 МПа) для переходу від ембріогенезу до нормального проростання корінця і пагона.</li>
    </ul>

    <details class="bproto">
      <summary>Хід роботи (Лабораторна робота № 38 — Культура пиляків ріпаку Brassica napus L.)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Відбір суцвіть і холодова передобробка:</b> з донорних рослин ріпаку (<i>Brassica napus</i> L.) на початку цвітіння головного суцвіття зрізають верхівкові китиці з закритими зеленими бутонами. Пагони ставлять у склянку з водою, накривають поліетиленовим пакетом і витримують у холодильнику при <b>+4 °C протягом 4 діб</b>.</li>
          <li><b>Калібрування бутонів та експрес-цитологія:</b> у ламінарному боксі на міліметровій сітці відбирають бутони довжиною <b>2,5–3,5 мм</b>. З одного контрольного бутона видавлюють пиляк у краплю 1 % ацетокарміну на предметному склі й перевіряють під мікроскопом наявність стадії <i>пізньої одноядерної вакуолізованої мікроспори</i>.</li>
          <li><b>Поверхнева стерилізація:</b> відібрані бутони занурюють у 70 % етанол на 30 с, потім у 5 % гіпохлорит натрію (NaClO) або 0,1 % діацид на 7–10 хв і тричі промивають стерильною дистильованою водою по 5 хв.</li>
          <li><b>Ізоляція пиляків і тепловий шок:</b> у стерильній чашці Петрі під бінокуляром тонким пінцетом та препарувальною голкою розкривають чашолистки, обережно відокремлюють 6 пиляків від тичинкових ниток (не пошкоджуючи стінку пиляка і не переносячи диплоїдну тканину нитки!) та розкладають на поверхню середовища B<sub>5</sub> із 10 % сахарози (по 20–30 пиляків на чашку). Інкубують у термостаті при <b>+32 °C у темряві протягом 24 год</b>, після чого переносять на +25 °C.</li>
          <li><b>Регенерація та колхіцинування:</b> через 3–4 тижні з тріщин пиляків з’являються білі ембріоїди. Їх переносять на регенераційне середовище МС із 2 % сахарози на світло (16 год фотоперіод). Отримані гаплоїдні рослини обробляють 0,05 % розчином колхіцину для одержання фертильних дигаплоїдів (DH).</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи (Лабораторна робота № 39 — Гіногенез у культурі незапліднених насіннєвих зачатків буряка)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Підготовка експлантатів:</b> з квітконосних пагонів цукрового буряка (<i>Beta vulgaris</i> L.) відбирають нерозкриті бутони за 1–2 доби до антезису (до розтріскування власних пиляків або на лініях із ЦМС) після витримування при +4…+6 °C протягом 2–3 діб.</li>
          <li><b>Стерилізація та вилучення насіннєвих зачатків:</b> бутони стерилізують у 70 % спирті (30 с) та 7 % хлорному вапні або NaClO (10 хв), тричі промивають стерильною водою. Під стереомікроскопом скальпелем розтинають зав’язь і препарувальною голкою вилучають білий комоподібний <b>незапліднений насіннєвий зачаток</b> (~1 мм).</li>
          <li><b>Культивування:</b> насіннєві зачатки висаджують у чашки Петрі на агаризоване середовище МС + 0,5 мг/л БАП + 8 % сахарози та культивують у темряві при +26 °C, а після появи первинних гіногенних ембріоїдів або калюсу (через 25–35 діб) — переносять на світло.</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи (Лабораторна робота № 40 — Культура ізольованих зародків / Embryo rescue)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Стерилізація плодів / стручків:</b> незрілі гібридні плоди (зав’язі або зелені стручки через 8–16 діб після контрольованого міжвидового схрещування) протирають 70 % етанолом, стерилізують 10–15 хв у розчині гіпохлориту натрію та тричі промивають стерильною водою.</li>
          <li><b>Мікрохірургічне виділення зародка:</b> у стерильній чашці Петрі під бінокуляром (збільшення ×16…×40) скальпелем розрізають стінку зав’язі, фіксують насіннєвий зачаток пінцетом і двома тонкими препарувальними голками обережно розтинають інтегументи біля мікропілярного кінця. Не пошкоджуючи зародок, вивільняють його на кінчик голки або мікрошпателя.</li>
          <li><b>Посадка на осмотично узгоджене середовище:</b> зародки на серцеподібній стадії висаджують на поверхню середовища з <b>8–10 % сахарози</b> та гідролізатом казеїну (400 мг/л); зародки на торпедоподібній стадії — на середовище з <b>2–3 % сахарози</b>. Культивують спершу 5–7 діб у темряві при +24 °C до завершення диференціації сім’ядолей, потім переносять у світлову кімнату (16 год фотоперіод, 3000 лк) для утворення нормальних проростків.</li>
        </ol>
      </div>
    </details>
  `,

  qa: [
    [
      "Чому для індукції андрогенезу в культурі пиляків ріпаку відбирають бутони строго довжиною 2,5–3,5 мм?",
      "<p>Довжина бутона <b>2,5–3,5 мм</b> у <i>Brassica napus</i> L. є надійним зовнішнім морфологічним маркером того, що мікроспори всередині пиляків перебувають на стадії <b>пізньої одноядерної вакуолізованої мікроспори</b> (безпосередньо перед першим пилковим мітозом). Саме на цій стадії мікроспора зберігає тотипотентність: стресовий шок здатен перебудувати мікротрубочки з асиметричного гаметофітного поділу на <b>симетричний спорофітний поділ</b>. У бутонах &gt; 4 мм пилок уже двоядерний і переповнений запасним крохмалем, тому ембріогенез практично не відбувається.</p>"
    ],
    [
      "Який цитологічний механізм дії холодового (+4 °C) та теплового (+32 °C) шоків при перемиканні розвитку мікроспори?",
      "<p>Температурний стрес пригнічує експресію гаметофіт-специфічних генів, деполімеризує кортикальні мікротрубочки, які утримують ядро в ексцентричному положенні біля інтини, та блокує встановлення полярної осі клітини. У результаті перший мітоз проходить <b>симетрично</b> з утворенням двох рівноцінних спорофітних клітин, які діляться далі й формують гаплоїдний ембріоїд (<i>n</i>) замість пилкової трубки та сперміїв.</p>"
    ],
    [
      "У чому полягає принципова перевага дигаплоїдних (DH) ліній над класичним інбридингом (самозапиленням)?",
      "<p>При класичному самозапиленні гетерозиготи частка гомозиготних локусів зростає за законом <i>H<sub>k</sub></i> = 1 − (1/2)<sup><i>k</i></sup>, тобто навіть після 6 поколінь (6 років для озимих культур) залишається близько 1,56 % гетерозиготності, а рецесивні алелі маскуються домінантними. Подвоєння хромосом гаплоїда колхіцином (<b>DH-технологія</b>) дає <b>100 % гомозиготність за 1 покоління</b>, бо кожна пара гомологічних хромосом є точною реплікою однієї вихідної хромосоми гамети.</p>"
    ],
    [
      "Коли в селекційній практиці застосовують гіногенез (культуру незапліднених насіннєвих зачатків) замість культури пиляків?",
      "<p><b>Гіногенез <i>in vitro</i></b> (ЛР 39, наприклад, у цукрового буряка <i>Beta vulgaris</i> L., цибулі, гербери) використовують тоді, коли культура пиляків є малоефективною (рефрактерні генотипи), дає високу частоту хлорофіл-дефектних рослин-альбіносів (як у багатьох злаків), або коли вихідна материнська рослина має <b>цитоплазматичну чоловічу стерильність (ЦМС)</b> і взагалі не формує життєздатних мікроспор.</p>"
    ],
    [
      "Чому ранні (глобулярні та серцеподібні) ізольовані зародки в ембріокультурі потребують 8–12 % сахарози, а пізні — лише 2–3 %?",
      "<p>У ранніх зародків сахароза виконує не лише трофічну, а передусім <b>осморегуляторну роль</b>: високий осмотичний тиск середовища (Ψ<sub>s</sub> ≈ −0,6…−0,9 МПа при 8–12 % сахарози) імітує рідкий ендосперм насіннєвого зачатка, стабілізує клітинні мембрани та <b>запобігає передчасному проростанню</b> (<i>precocious germination</i>), даючи зародку змогу завершити диференціацію сім’ядолей та апікальної меристеми пагона (плюмули). На стадії торпедо зародок уже сформований, і зниження сахарози до 2–3 % знімає осмотичний блок, запускаючи нормальний ріст корінця й пагона.</p>"
    ]
  ],

  build({ stageBox, ctrls, below, tabsBox }) {
    const modes = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Андрогенез ріпаку та гіногенез буряка (ЛР 38–39)"],
      ["b", "Б. Ембріокультура та порятунок зародків (ЛР 40)"]
    ]);

    /* ==================== TAB A: HAPLOID BIOTECHNOLOGY ==================== */
    const boxA = modes.box("a");
    const stA = new Stage(boxA.st, { aspect: 1.68, minH: 310, maxH: 480, minW: 580, tag: "ЛР 38–39 · мікроспора (n) → шок +4 °C / +32 °C → ембріоїд (n) → колхіцин → DH (2n)" });

    const stateA = {
      mode: "anther", // "anther" (Brassica napus, ЛР 38) | "ovule" (Beta vulgaris, ЛР 39)
      budL: 3.0,      // мм (оптимум 2,5–3,5 мм)
      coldD: 4.0,     // діб при +4 °C (оптимум 4 доби)
      heatH: 24,      // год при +32 °C (оптимум 24 год)
      colch: 0.05     // % колхіцину (оптимум 0,05–0,10 %)
    };

    UI.seg(boxA.ct, {
      label: "Об’єкт та метод індукції гаплоїдів",
      options: [
        ["anther", "ЛР 38: Пиляки ріпаку (n=19)"],
        ["ovule", "ЛР 39: Зав’язі буряка (n=9)"]
      ],
      value: stateA.mode,
      on: (v) => { stateA.mode = v; updateA(); }
    });

    const slBud = UI.slider(boxA.ct, {
      id: "l10a-bud", label: "Довжина бутона L_бутона", min: 1.5, max: 5.5, step: 0.1, value: stateA.budL, unit: "мм",
      fmt: v => fmt(v, 1), on: v => { stateA.budL = v; updateA(); }
    });
    const slCold = UI.slider(boxA.ct, {
      id: "l10a-cold", label: "Холодовий шок (+4 °C)", min: 0, max: 10, step: 0.5, value: stateA.coldD, unit: "діб",
      fmt: v => fmt(v, 1), on: v => { stateA.coldD = v; updateA(); }
    });
    const slHeat = UI.slider(boxA.ct, {
      id: "l10a-heat", label: "Тепловий шок (+32 °C)", min: 0, max: 72, step: 4, value: stateA.heatH, unit: "год",
      fmt: v => fmt(v, 0), on: v => { stateA.heatH = v; updateA(); }
    });
    const slColch = UI.slider(boxA.ct, {
      id: "l10a-colch", label: "Концентрація колхіцину", min: 0, max: 0.20, step: 0.01, value: stateA.colch, unit: "%",
      fmt: v => fmt(v, 2), on: v => { stateA.colch = v; updateA(); }
    });

    UI.buttons(boxA.ct, [
      {
        label: "Оптимум ЛР 38 (ріпак)", pri: true, on: () => {
          stateA.mode = "anther"; slBud.set(stateA.budL = 3.0); slCold.set(stateA.coldD = 4.0);
          slHeat.set(stateA.heatH = 24); slColch.set(stateA.colch = 0.05); updateA();
        }
      },
      {
        label: "Перезрілий бутон (4,8 мм)", on: () => {
          stateA.mode = "anther"; slBud.set(stateA.budL = 4.8); slCold.set(stateA.coldD = 4.0);
          slHeat.set(stateA.heatH = 24); slColch.set(stateA.colch = 0.05); updateA();
        }
      },
      {
        label: "Без шоку та колхіцину", on: () => {
          slBud.set(stateA.budL = 3.0); slCold.set(stateA.coldD = 0);
          slHeat.set(stateA.heatH = 0); slColch.set(stateA.colch = 0); updateA();
        }
      },
      {
        label: "Оптимум ЛР 39 (гіногенез)", on: () => {
          stateA.mode = "ovule"; slBud.set(stateA.budL = 3.2); slCold.set(stateA.coldD = 3.0);
          slHeat.set(stateA.heatH = 12); slColch.set(stateA.colch = 0.08); updateA();
        }
      }
    ]);

    const readsA = UI.reads(boxA.bl, [
      ["stage", "Цитологічна стадія гаметофіта"],
      ["sw", "Перемикання на спорофітний шлях"],
      ["yield", "Вихід ембріоїдів (на 100 експл.)"],
      ["dh", "Частка фертильних DH (2n) / Поліплоїдів"],
      ["homo", "Гомозиготність DH vs Інбридинг F₁"]
    ]);
    const outA = UI.out(boxA.bl, "");
    const chartsA = h("div", { class: "charts" });
    boxA.bl.append(chartsA);
    const chWindow = UI.chart(chartsA, "Вікно компетентності: вихід ембріоїдів від довжини бутона L (мм)");
    const chHomo = UI.chart(chartsA, "Досягнення гомозиготності H_k (%): класичний інбридинг vs DH-лінії");

    function modelA(budL = stateA.budL, coldD = stateA.coldD, heatH = stateA.heatH, colch = stateA.colch, mode = stateA.mode) {
      const optL = mode === "anther" ? 3.0 : 3.2;
      const sigL = mode === "anther" ? 0.52 : 0.62;
      const wBud = Math.exp(-0.5 * Math.pow((budL - optL) / sigL, 2));

      // Cold stress factor (optimum around 4 days for anther, 3 days for ovule)
      const optCold = mode === "anther" ? 4.0 : 3.0;
      const fCold = 0.14 + 0.86 * Math.exp(-0.5 * Math.pow((coldD - optCold) / 2.4, 2));

      // Heat shock factor (optimum around 24 h at 32 °C for Brassica, mild effect for Beta)
      const fHeat = mode === "anther"
        ? (0.25 + 0.75 * Math.exp(-0.5 * Math.pow((heatH - 24) / 16, 2)))
        : (0.65 + 0.35 * Math.exp(-0.5 * Math.pow((heatH - 12) / 18, 2)));

      const switchProb = clamp(wBud * fCold * fHeat * 100, 0.5, 96);
      const maxYield = mode === "anther" ? 145 : 28; // на 100 пиляків або 100 насіннєвих зачатків
      const embryoids = maxYield * (switchProb / 100);

      // Colchicine chromosome doubling (optimum 0.05 - 0.10 %)
      const spontDH = mode === "anther" ? 12 : 8; // спонтанна диплоїдизація (%)
      const indDH = colch > 0 ? 78 * Math.exp(-0.5 * Math.pow((colch - 0.07) / 0.045, 2)) : 0;
      const dhPct = clamp(spontDH + indDH, 0, 92);
      const mixoPct = colch > 0.10 ? clamp((colch - 0.10) * 420, 0, 55) : 0; // тетраплоїди / міксоплоїди (4n) при передозуванні
      const hapPct = Math.max(0, 100 - dhPct - mixoPct);

      let stageName = "";
      let stageCode = 0; // 0: tetrad, 1: early uni, 2: late vacuolated uni, 3: binucleate mature
      if (budL < 2.1) {
        stageCode = 0;
        stageName = mode === "anther" ? "Тетради мікроспор (надто рано)" : "Археспорій / мегаспороцит (надто рано)";
      } else if (budL < 2.5) {
        stageCode = 1;
        stageName = mode === "anther" ? "Рання одноядерна мікроспора" : "Формування зародкового мішка";
      } else if (budL <= 3.6) {
        stageCode = 2;
        stageName = mode === "anther" ? "Пізня одноядерна вакуолізована мікроспора (ОПТИМУМ)" : "Зріла гаплоїдна яйцеклітина до запліднення (ОПТИМУМ)";
      } else {
        stageCode = 3;
        stageName = mode === "anther" ? "Двоядерний пилок із крохмалем (пізно)" : "Перезріла зав’язь / дегенерація синергід";
      }

      return { wBud, fCold, fHeat, switchProb, embryoids, dhPct, mixoPct, hapPct, stageName, stageCode };
    }

    function updateA() {
      const m = modelA();
      const nHap = stateA.mode === "anther" ? "n = 19" : "n = 9";
      const nDip = stateA.mode === "anther" ? "2n = 38" : "2n = 18";

      readsA.set("stage", m.stageName);
      readsA.set("sw", fmt(m.switchProb, 1), "% (симетричний мітоз)");
      readsA.set("yield", fmt(m.embryoids, 1), stateA.mode === "anther" ? "ембріоїдів / 100 пиляків" : "регенерантів / 100 зачатків");
      readsA.set("dh", `${fmt(m.dhPct, 1)} % DH (${nDip})`, ` · гаплоїди (${nHap}): ${fmt(m.hapPct, 0)} % · 4n: ${fmt(m.mixoPct, 0)} %`);
      readsA.set("homo", "100,0 % (1 покоління)", "проти 50,0 % у F₂ та 96,9 % у F₅");

      let cls = "good", msg = "";
      if (m.stageCode !== 2) {
        cls = "bad";
        msg = `<b>Порушення вікна компетентності (<i>L</i> = ${fmt(stateA.budL, 1)} мм):</b> ${m.stageCode < 2 ? "мікроспори ще не досягли вакуолізованої одноядерної фази" : "відбувся асиметричний гаметофітний мітоз (вегетативне + генеративне ядро) і накопичився крохмаль"}. Відгук на індукцію ембріогенезу низький (${fmt(m.switchProb, 1)} %). Відберіть бутони <b>2,5–3,5 мм</b>.`;
      } else if (stateA.coldD < 1.5 || (stateA.mode === "anther" && stateA.heatH < 8)) {
        cls = "warn";
        msg = `<b>Недостатня стресова індукція:</b> бутон перебуває в оптимальній цитологічній фазі, але без холодової передобробки (+4 °C, 4 доби) та теплового шоку (+32 °C, 24 год) більшість мікроспор продовжує звичайний гаметофітний шлях розвитку пилку.`;
      } else if (stateA.colch < 0.02) {
        cls = "warn";
        msg = `<b>Високий вихід ембріоїдів (${fmt(m.embryoids, 1)}), але регенеранти залишаються стерильними гаплоїдами (${nHap}):</b> без обробки 0,05–0,10 % колхіцином подвоєння хромосом відбувається лише спонтанно (${fmt(m.dhPct, 0)} %).`;
      } else if (stateA.colch > 0.13) {
        cls = "warn";
        msg = `<b>Передозування колхіцину (${fmt(stateA.colch, 2)} %):</b> окрім бажаних дигаплоїдів (${nDip}), зростає частка небажаних тетраплоїдних та міксоплоїдних хімер (${fmt(m.mixoPct, 0)} %). Оптимум становить <b>0,05–0,10 %</b>.`;
      } else {
        cls = "good";
        msg = `<b>Оптимальний протокол ${stateA.mode === "anther" ? "ЛР 38 (ріпак <i>Brassica napus</i> L.)" : "ЛР 39 (цукровий буряк <i>Beta vulgaris</i> L.)"}:</b> висока частота перемикання на спорофітний шлях (${fmt(m.switchProb, 1)} %) забезпечує ${fmt(m.embryoids, 1)} ембріоїдів на 100 експлантатів, а колхіцинування дає <b>${fmt(m.dhPct, 1)} % фертильних 100 % гомозиготних DH-рослин (${nDip})</b> за один сезон!`;
      }
      outA.el.className = "bout " + cls;
      outA.set(msg);

      drawChartsA();
      stA.dirty = true;
    }

    function drawChartsA() {
      const T = Theme.c;
      const ptsOpt = [], ptsNoShock = [];
      for (let L = 1.5; L <= 5.501; L += 0.08) {
        ptsOpt.push([L, modelA(L, stateA.coldD, stateA.heatH, stateA.colch, stateA.mode).embryoids]);
        ptsNoShock.push([L, modelA(L, 0, 0, stateA.colch, stateA.mode).embryoids]);
      }
      const curM = modelA();
      const yMax = stateA.mode === "anther" ? 160 : 35;

      drawChart(chWindow, {
        x: [1.5, 5.5], y: [0, yMax],
        xl: "Довжина бутона L_бутона (мм)", yl: "Вихід ембріоїдів (на 100 експл.)",
        band: [{ x0: 2.5, x1: 3.5, color: rgba(T.good, 0.13) }],
        vl: [
          { x: 2.5, color: T.good, dash: [3, 3], label: "2,5 мм" },
          { x: 3.5, color: T.good, dash: [3, 3], label: "3,5 мм (оптимум)" }
        ],
        series: [
          { pts: ptsOpt, color: T.chl, w: 2.5, fill: rgba(T.chl, 0.12) },
          { pts: ptsNoShock, color: T.muted, w: 1.7, dash: [5, 4] }
        ],
        marks: [
          { x: stateA.budL, y: curM.embryoids, r: 5.5, color: T.carot, label: `${fmt(curM.embryoids, 1)}` }
        ],
        legend: [
          { color: T.chl, label: "Із обраним температурним шоком" },
          { color: T.muted, label: "Без холодового/теплового шоку" }
        ]
      });

      // Chart 2: Homozygosity progression H_k = 1 - (1/2)^k vs DH = 100%
      const ptsInbr = [], ptsDH = [];
      for (let k = 0; k <= 8; k++) {
        ptsInbr.push([k, (1 - Math.pow(0.5, k)) * 100]);
        ptsDH.push([k, k === 0 ? 0 : 100]);
      }
      drawChart(chHomo, {
        x: [0, 8], y: [0, 105],
        xt: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        xl: "Покоління селекції k (років)", yl: "Гомозиготність лінії H_k (%)",
        hl: [{ y: 100, color: T.good, dash: [3, 3], label: "100 % чиста лінія" }],
        series: [
          { pts: ptsDH, color: T.chl, w: 2.6, dots: 3.5 },
          { pts: ptsInbr, color: T.antho, w: 2.2, dots: 3.2, fill: rgba(T.antho, 0.08) }
        ],
        marks: [
          { x: 1, y: 100, r: 5.5, color: T.chl, label: "DH: 100 % за 1 рік!" },
          { x: 1, y: 50, r: 4.5, color: T.antho, label: "F₂: 50 %" },
          { x: 6, y: 98.44, r: 4.5, color: T.antho, align: "right", label: "F₇: 98,4 %" }
        ],
        legend: [
          { color: T.chl, label: "Дигаплоїдизація (DH, колхіцин)" },
          { color: T.antho, label: "Класичне самозапилення: 1 − (1/2)ᵏ" }
        ]
      });
    }

    function drawStageA(dt, t) {
      const c = stA.ctx, W = stA.W, H = stA.H, T = Theme.c;
      stA.clear();
      const m = modelA();
      const isAnther = stateA.mode === "anther";

      // Layout: 3 visual zones
      // Zone 1 (Left, 30%): Flower bud scale + Anatomical cross-section of 4-locular anther / ovule + Petri dish
      // Zone 2 (Center, 40%): Cytological microscope view (Gfx.microscope) of microspore/megaspore division pathway
      // Zone 3 (Right, 30%): In vitro regenerants (Gfx.vial + Gfx.shootPlantlet) & Colchicine chromosome doubling (n -> 2n DH)
      const z1W = W * 0.30, z2W = W * 0.40, z3W = W - z1W - z2W;
      const pad = 10;

      // ==================== ZONE 1: ANTHER ANATOMY, BUD & PETRI DISH ====================
      Gfx.rr(c, pad, pad, z1W - pad * 1.5, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();

      Gfx.text(c, isAnther ? "1. Бутон, зріз пиляка і культура (ЛР 38)" : "1. Бутон, насіннєвий зачаток і культура (ЛР 39)", pad + 10, pad + 18, { weight: 700, size: 11.5, color: T.ink });

      // Top-left of Zone 1: Flower bud to scale with millimeter ruler
      const bx = pad + (z1W - pad) * 0.25, by = pad + 78;
      const budPixH = 14 + stateA.budL * 8.5, budPixW = budPixH * 0.48;
      const rx = bx - 28;
      c.strokeStyle = rgba(T.ink, 0.45); c.lineWidth = 1;
      c.beginPath(); c.moveTo(rx, by + 26); c.lineTo(rx, by + 26 - 6 * 8.5); c.stroke();
      for (let mm = 0; mm <= 6; mm++) {
        const ry = by + 26 - mm * 8.5;
        c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + (mm % 2 === 0 ? 6 : 3.5), ry); c.stroke();
        if (mm % 2 === 0) Gfx.text(c, `${mm}`, rx - 3, ry + 3, { size: 9, align: "right", color: T.muted, font: "mono" });
      }
      // Optimal 2.5-3.5 mm bracket
      c.fillStyle = rgba(T.good, 0.25);
      c.fillRect(rx + 1, by + 26 - 3.5 * 8.5, 5, 1.0 * 8.5);

      // Pedicel & Receptacle
      c.strokeStyle = "#3E7B34"; c.lineWidth = 2.8; c.lineCap = "round";
      c.beginPath(); c.moveTo(bx, by + 26); c.lineTo(bx, by + 40); c.stroke();
      c.fillStyle = "#36692D";
      c.beginPath(); c.ellipse(bx, by + 26, budPixW * 0.35, 3.2, 0, 0, Math.PI * 2); c.fill();

      // Realistic 3D Flower Bud (sepals + peeking yellow-green petals)
      const budY = by + 26 - budPixH / 2;
      const petalFrac = clamp((stateA.budL - 1.8) / 3.2, 0, 1);
      const budCol = mixc("#3A8442", "#E2C83B", petalFrac);
      const bGrad = c.createRadialGradient(bx - budPixW * 0.18, budY - budPixH * 0.15, 2, bx, budY, budPixH * 0.55);
      bGrad.addColorStop(0, shade(budCol, 0.32));
      bGrad.addColorStop(0.6, budCol);
      bGrad.addColorStop(1, shade(budCol, -0.35));
      c.fillStyle = bGrad;
      c.beginPath();
      c.ellipse(bx, budY, budPixW / 2, budPixH / 2, 0, 0, Math.PI * 2);
      c.fill();
      // Sepal seams
      c.strokeStyle = "#254D28"; c.lineWidth = 1.2; c.stroke();
      c.beginPath();
      c.moveTo(bx, by + 26);
      c.quadraticCurveTo(bx - budPixW * 0.18, budY, bx, by + 26 - budPixH);
      c.moveTo(bx, by + 26);
      c.quadraticCurveTo(bx + budPixW * 0.18, budY, bx, by + 26 - budPixH);
      c.stroke();
      Gfx.text(c, `L=${fmt(stateA.budL, 1)}мм`, bx, by + 51, { align: "center", size: 10, weight: 700, font: "mono", color: m.stageCode === 2 ? T.good : T.warn });

      // Top-right of Zone 1: Detailed Anatomical Cross-Section of 4-locular Anther (or Ovule)
      const axC = pad + (z1W - pad) * 0.69, ayC = pad + 72;
      const ar = Math.min(34, (z1W - pad) * 0.22);
      c.save();
      c.translate(axC, ayC);
      if (isAnther) {
        // 4-locular anther cross-section (butterfly shape: epidermis, fibrous endothecium, tapetum, connective + vascular bundle)
        const locOffsets = [
          [-ar * 0.48, -ar * 0.34, ar * 0.42, ar * 0.34],
          [ar * 0.48, -ar * 0.34, ar * 0.42, ar * 0.34],
          [-ar * 0.44, ar * 0.36, ar * 0.38, ar * 0.32],
          [ar * 0.44, ar * 0.36, ar * 0.38, ar * 0.32]
        ];
        // Outer epidermis + endothecium (yellow-olive wall)
        c.fillStyle = Theme.dark ? "#4A5830" : "#E5DC9A";
        c.strokeStyle = "#7D7028"; c.lineWidth = 1.8;
        for (const [lx, ly, lrx, lry] of locOffsets) {
          c.beginPath(); c.ellipse(lx, ly, lrx + 4.5, lry + 4.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        }
        // Central connective tissue (зв'язник)
        c.fillStyle = Theme.dark ? "#3D4B28" : "#D6CD88";
        c.beginPath(); c.ellipse(0, 0, ar * 0.34, ar * 0.38, 0, 0, Math.PI * 2); c.fill();
        // Fibrous thickenings in endothecium (фіброзні пояски ендотецію)
        c.strokeStyle = "rgba(120, 95, 30, 0.55)"; c.lineWidth = 0.8;
        for (const [lx, ly, lrx, lry] of locOffsets) {
          for (let a = 0; a < Math.PI * 2; a += 0.45) {
            c.beginPath();
            c.moveTo(lx + Math.cos(a) * (lrx + 1), ly + Math.sin(a) * (lry + 1));
            c.lineTo(lx + Math.cos(a) * (lrx + 4), ly + Math.sin(a) * (lry + 4));
            c.stroke();
          }
          // Tapetum layer (nutritive inner ring) + pollen sac lumen
          c.fillStyle = Theme.dark ? "#1F2D22" : "#F8F6EB";
          c.beginPath(); c.ellipse(lx, ly, lrx, lry, 0, 0, Math.PI * 2); c.fill();
          c.strokeStyle = "#C78D20"; c.lineWidth = 2.0; c.stroke();
          // Microspores inside each of the 4 pollen sacs
          for (let k = 0; k < 4; k++) {
            const ma = k * 1.57 + 0.4 + t * 0.2;
            const mx = lx + Math.cos(ma) * lrx * 0.48;
            const my = ly + Math.sin(ma) * lry * 0.48;
            Gfx.sphere(c, mx, my, 2.8, m.stageCode === 2 ? "#43A047" : "#D4AF37");
          }
        }
        // Vascular bundle in connective (судинний пучок зв'язника)
        Gfx.sphere(c, 0, 0, ar * 0.16, "#8D6E63", { ring: "#4E342E", rw: 1 });
        // Stomium (ділянка розкриття пиляка збоку)
        c.fillStyle = "#B4541A";
        c.beginPath(); c.arc(-ar * 0.88, 0, 2.2, 0, Math.PI * 2); c.arc(ar * 0.88, 0, 2.2, 0, Math.PI * 2); c.fill();
        Gfx.text(c, "Зріз пиляка (4 гнізда)", 0, ar + 14, { align: "center", size: 9, weight: 600, color: T.ink });
        Gfx.text(c, `Шок: +4°C (${fmt(stateA.coldD, 0)}д) · +32°C (${stateA.heatH}г)`, 0, ar + 25, { align: "center", size: 8.5, font: "mono", color: stateA.coldD > 0 ? "#2563EB" : T.muted });
      } else {
        // Unfertilized Ovule cross-section (Beta vulgaris): integuments, nucellus, embryo sac with haploid egg cell
        c.fillStyle = Theme.dark ? "#2E4234" : "#DCEAD7";
        c.strokeStyle = "#4A7C59"; c.lineWidth = 1.8;
        c.beginPath(); c.ellipse(0, 0, ar * 0.92, ar * 0.72, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        // Embryo sac (мегагаметофіт)
        c.fillStyle = Theme.dark ? "#18261D" : "#F8FBF6";
        c.strokeStyle = "#689F38"; c.lineWidth = 1.2;
        c.beginPath(); c.ellipse(0, 0, ar * 0.56, ar * 0.42, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        // Egg apparatus (haploid egg cell n=9 + 2 synergids) & central cell + antipodals
        Gfx.sphere(c, -ar * 0.32, 0, 5.2, "#9A2E66", { ring: "#fff", rw: 1 });
        Gfx.sphere(c, -ar * 0.38, -5, 3.0, "#7CB342");
        Gfx.sphere(c, -ar * 0.38, 5, 3.0, "#7CB342");
        Gfx.sphere(c, 0, -2, 3.2, "#5C6BC0");
        Gfx.sphere(c, 0, 2, 3.2, "#5C6BC0");
        Gfx.text(c, "Зародковий мішок (n=9)", 0, ar + 14, { align: "center", size: 9, weight: 600, color: T.ink });
        Gfx.text(c, `Холод: +4°C (${fmt(stateA.coldD, 0)} діб)`, 0, ar + 25, { align: "center", size: 8.5, font: "mono", color: "#2563EB" });
      }
      c.restore();

      // Petri dish at bottom of Zone 1
      const px = pad + (z1W - pad * 1.5) / 2, py = H - 82, pr = Math.min(52, (z1W - 40) * 0.40);
      Gfx.petri(c, px, py, pr, Theme.dark ? "rgba(65,92,72,.55)" : "rgba(222,236,214,.9)", {
        label: isAnther ? "Середовище B₅ (10 % сах.)" : "Середовище МС (8 % сах.)",
        inside: (ctx) => {
          for (let i = 0; i < 6; i++) {
            const ang = i * Math.PI / 3 + 0.3, rr = pr * 0.52;
            const ax = px + Math.cos(ang) * rr, ay = py + Math.sin(ang) * rr;
            ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
            if (isAnther) {
              // Realistic bilobed yellow-green anther with longitudinal dehiscence slit
              const ag = ctx.createLinearGradient(-7, -3, 7, 3);
              ag.addColorStop(0, "#E6C645"); ag.addColorStop(0.5, "#C8A028"); ag.addColorStop(1, "#9E7B18");
              ctx.fillStyle = ag; ctx.strokeStyle = "#6E520C"; ctx.lineWidth = 0.8;
              ctx.beginPath(); ctx.ellipse(-2.6, 0, 7.2, 2.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(2.6, 0, 7.2, 2.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            } else {
              // White comma-shaped unfertilized ovule
              ctx.fillStyle = "#F4F1E8"; ctx.strokeStyle = "#8C968E"; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.ellipse(0, 0, 6.2, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            }
            // Emerging white-green androgenic/gynogenic embryoids proportional to yield
            if (m.switchProb > 25 && (i % 2 === 0 || m.switchProb > 60)) {
              const er = 2.6 + 1.4 * Math.sin(t * 2.2 + i);
              Gfx.sphere(ctx, 2.5, -2.5, er, "#E8F5E9", { ring: "#43A047" });
              if (m.switchProb > 55) Gfx.sphere(ctx, -2, 2.5, er * 0.85, "#C8E6C9", { ring: "#2E7D32" });
            }
            ctx.restore();
          }
        }
      });

      // ==================== ZONE 2: CYTOLOGICAL MICROSCOPE VIEWPORT ====================
      const z2X = z1W + pad * 0.5;
      Gfx.rr(c, z2X, pad, z2W - pad, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
      Gfx.text(c, "2. Мікроскопія перемикання гаметофіта (×600)", z2X + 12, pad + 18, { weight: 700, size: 12, color: T.ink });

      const mcx = z2X + (z2W - pad) * 0.5, mcy = pad + (H - pad * 2) * 0.44;
      const mr = Math.min(72, Math.min((z2W - 36) * 0.36, (H - 115) * 0.42));

      Gfx.microscope(c, mcx, mcy, mr, {
        scale: "15 мкм",
        inside: (ctx) => {
          // Out-of-focus background bokeh microspores
          ctx.fillStyle = "rgba(180, 195, 150, 0.22)";
          ctx.beginPath(); ctx.arc(mcx - mr * 0.62, mcy - mr * 0.48, mr * 0.24, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(mcx + mr * 0.66, mcy + mr * 0.45, mr * 0.21, 0, Math.PI * 2); ctx.fill();

          const spR = mr * 0.68;
          const pulse = Math.sin(t * 2.4) * 1.8;
          ctx.save();
          ctx.translate(mcx, mcy);

          // Cyc for stage 2 animation (0..0.36: signet-ring vacuole, 0.36..0.68: symmetric mitosis, 0.68..1: multicellular embryoid)
          const cyc = (t * 0.26) % 1;
          const isRupturing = m.stageCode === 2 && m.switchProb >= 40 && cyc >= 0.68;

          // 1. Sculpted Sporopollenin Exine Wall (екзина з шипиками та 3 борознами-апертурами проростання)
          const exOpen = isRupturing ? 0.55 : 0; // exine ruptures open when multicellular embryoid emerges!
          ctx.save();
          // Intine (inner cellulose-pectin layer)
          ctx.fillStyle = Theme.dark ? "#293B2C" : "#F3EFE0";
          ctx.strokeStyle = "#C5B37A"; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, spR - 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

          // Outer Exine with 3 germination apertures (триборозний пилок Brassica) and echinate spines
          ctx.strokeStyle = "#9C7316"; ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.arc(0, 0, spR, exOpen, Math.PI * 2 - exOpen);
          ctx.stroke();

          // Exine radial spines / bacula sculpture
          const nSpines = 32;
          ctx.strokeStyle = "#825D0E"; ctx.lineWidth = 2.0; ctx.lineCap = "round";
          for (let k = 0; k < nSpines; k++) {
            const a = (k / nSpines) * Math.PI * 2;
            if (isRupturing && (a < exOpen || a > Math.PI * 2 - exOpen)) continue;
            // Skip 3 germination colpi / pores (апертури проростання)
            const nearAperture = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].some(ap => Math.abs( Math.atan2(Math.sin(a - ap), Math.cos(a - ap)) ) < 0.16);
            if (nearAperture) {
              // Thin translucent aperture membrane
              ctx.fillStyle = "rgba(245, 225, 150, 0.85)";
              ctx.beginPath(); ctx.arc(Math.cos(a) * spR, Math.sin(a) * spR, 3.2, 0, Math.PI * 2); ctx.fill();
              continue;
            }
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (spR - 1), Math.sin(a) * (spR - 1));
            ctx.lineTo(Math.cos(a) * (spR + 4.5), Math.sin(a) * (spR + 4.5));
            ctx.stroke();
          }
          ctx.restore();

          // 2. Cytological content depending on developmental stage
          if (m.stageCode === 0) {
            // Tetrad of 4 haploid microspores inside thick callose wall
            ctx.strokeStyle = "rgba(120, 185, 225, 0.7)"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, spR * 0.86, 0, Math.PI * 2); ctx.stroke();
            for (let q = 0; q < 4; q++) {
              const qa = q * Math.PI / 2 + 0.4, qr = spR * 0.42;
              const qx = Math.cos(qa) * qr, qy = Math.sin(qa) * qr;
              Gfx.sphere(ctx, qx, qy, spR * 0.34, "#D7E8D2", { ring: "#5E8B60", rw: 1.2 });
              Gfx.sphere(ctx, qx, qy, 6.5, "#8E244D", { ring: "#4A1026" });
              Gfx.sphere(ctx, qx - 1.5, qy - 1.5, 2.2, "#38081B", { spec: false });
            }
            Gfx.chip(ctx, "Тетрада в калозі (4×n)", 0, spR + 12, { align: "center", size: 9, bg: rgba(T.sheet, 0.9) });
          } else if (m.stageCode === 1) {
            // Early uninucleate microspore (dense cytoplasm, central nucleus, small vacuoles)
            for (let v = 0; v < 5; v++) {
              const va = v * 1.25 + t * 0.3;
              Gfx.sphere(ctx, Math.cos(va) * spR * 0.48, Math.sin(va) * spR * 0.48, 5.5, "rgba(185,228,245,0.65)", { ring: "#81B9D4" });
            }
            Gfx.sphere(ctx, 0, 0, spR * 0.30, "#8E244D", { ring: "#4A1026", rw: 1.5, shadow: true });
            Gfx.sphere(ctx, -3, -3, spR * 0.11, "#38081B");
            Gfx.text(ctx, "n", 3, 4, { align: "center", size: 9.5, weight: 700, color: "#fff", font: "mono" });
          } else if (m.stageCode === 2) {
            if (m.switchProb >= 40) {
              if (cyc < 0.36) {
                // Stage 2a: Late Uninucleate Vacuolated ("Signet-Ring" / ефект "персня з печаткою")
                const vacR = spR * 0.64;
                const vg = ctx.createRadialGradient(-spR * 0.26, -spR * 0.12, 2, -spR * 0.14, 0, vacR);
                vg.addColorStop(0, "rgba(225, 246, 255, 0.88)");
                vg.addColorStop(0.75, "rgba(165, 218, 242, 0.65)");
                vg.addColorStop(1, "rgba(95, 168, 205, 0.80)");
                ctx.fillStyle = vg;
                ctx.beginPath(); ctx.arc(-spR * 0.14, 0, vacR, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = "#4B93B8"; ctx.lineWidth = 1.4; ctx.stroke(); // Tonoplast
                Gfx.text(ctx, "Вакуоля", -spR * 0.16, 3, { align: "center", size: 9.5, weight: 600, color: "#1E5B7A" });

                // Eccentric nucleus pressed against intine ("signet-ring" stone)
                const nx = spR * 0.58, ny = 0;
                Gfx.sphere(ctx, nx, ny, 11.5, "#9A2E66", { ring: "#4A1026", rw: 1.4, shadow: true });
                Gfx.sphere(ctx, nx - 2.5, ny - 2.5, 3.8, "#38081B");
                Gfx.text(ctx, "n", nx + 2, ny + 4, { align: "center", size: 9.5, weight: 700, color: "#fff", font: "mono" });
                Gfx.chip(ctx, "Стадія «персня з печаткою» (G₂/M)", 0, spR + 12, { align: "center", size: 8.8, bg: rgba(T.sheet, 0.92), fg: T.good });
              } else if (cyc < 0.68) {
                // Stage 2b: Symmetric Sporophytic Mitosis (2 equal nuclei + equatorial phragmoplast & spindle fibers)
                // Mitotic spindle microtubules
                ctx.strokeStyle = "rgba(44, 122, 77, 0.38)"; ctx.lineWidth = 1.0;
                for (let s = -4; s <= 4; s++) {
                  ctx.beginPath();
                  ctx.moveTo(-spR * 0.36, pulse * 0.3);
                  ctx.quadraticCurveTo(0, s * 6, spR * 0.36, -pulse * 0.3);
                  ctx.stroke();
                }
                // Equatorial cell plate
                ctx.strokeStyle = "#2C7A4D"; ctx.lineWidth = 2.2; ctx.setLineDash([4, 3]);
                ctx.beginPath(); ctx.moveTo(0, -spR * 0.85); ctx.lineTo(0, spR * 0.85); ctx.stroke(); ctx.setLineDash([]);
                // Two identical sporophytic daughter nuclei (n and n)
                for (const side of [-1, 1]) {
                  const nx = side * spR * 0.36, ny = side * pulse * 0.3;
                  Gfx.sphere(ctx, nx, ny, 12, "#2C7A4D", { ring: "#164228", rw: 1.4, shadow: true });
                  Gfx.sphere(ctx, nx - 2.5, ny - 2.5, 3.8, "#0E2B19");
                  Gfx.text(ctx, "n", nx + 2, ny + 4, { align: "center", size: 9.5, weight: 700, color: "#fff", font: "mono" });
                }
                Gfx.chip(ctx, "Симетричний спорофітний мітоз (n + n)", 0, spR + 12, { align: "center", size: 8.8, bg: rgba(T.sheet, 0.92), fg: T.chl });
              } else {
                // Stage 2c: Multicellular Androgenic Embryoid rupturing through the exine!
                const eCells = [
                  [-16, -13, 12], [-17, 13, 12], [0, -16, 12], [0, 16, 12],
                  [-4, 0, 13], [15, -11, 12.5], [15, 11, 12.5], [16, 0, 13],
                  [31, -8, 11.5], [31, 8, 11.5], [42, 0, 10.5]
                ];
                for (const [cx2, cy2, cr] of eCells) {
                  Gfx.sphere(ctx, cx2, cy2, cr, "#4CAF50", { ring: "#1B5E20", rw: 1.1, shadow: true });
                  Gfx.sphere(ctx, cx2 - 1.5, cy2 - 1.5, cr * 0.34, "#1B5E20");
                }
                Gfx.chip(ctx, "Вихід андрогенного ембріоїда з екзини!", 0, spR + 12, { align: "center", size: 8.8, bg: rgba(T.sheet, 0.92), fg: T.good });
              }
            } else {
              // Without stress shock: Asymmetric Gametophytic Mitosis (Large vegetative + spindle-shaped generative cell)
              Gfx.sphere(ctx, -spR * 0.18, 0, 14.5, "#9A2E66", { ring: "#4A1026", shadow: true });
              Gfx.sphere(ctx, -spR * 0.22, -3, 4.5, "#38081B");
              Gfx.text(ctx, "Вегет. (n)", -spR * 0.18, 23, { align: "center", size: 9, weight: 600, color: T.ink });

              // Lens/spindle-shaped generative cell at periphery
              ctx.save();
              ctx.translate(spR * 0.46, -spR * 0.18);
              ctx.rotate(0.35);
              ctx.fillStyle = "rgba(245, 205, 215, 0.85)";
              ctx.strokeStyle = "#B3363A"; ctx.lineWidth = 1.4;
              ctx.beginPath(); ctx.ellipse(0, 0, 13, 6.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              Gfx.sphere(ctx, 0, 0, 5.2, "#B3363A");
              ctx.restore();
              Gfx.text(ctx, "Генер. (n)", spR * 0.44, 6, { align: "center", size: 9, weight: 700, color: T.bad });
              Gfx.chip(ctx, "Асиметричний гаметофітний поділ", 0, spR + 12, { align: "center", size: 8.8, bg: rgba(T.sheet, 0.92), fg: T.warn });
            }
          } else {
            // Stage 3: Mature binucleate pollen packed with starch granules (amyloplasts)
            for (let s = 0; s < 22; s++) {
              const sa = s * 2.399, sr = Math.sqrt(s / 22) * spR * 0.72;
              const sx2 = Math.cos(sa) * sr, sy2 = Math.sin(sa) * sr;
              Gfx.sphere(ctx, sx2, sy2, 5.2, "#DFD39E", { ring: "#9E8C4A", rw: 0.8 });
            }
            Gfx.sphere(ctx, -12, -6, 12, "#7A5230", { ring: "#3E2723" });
            Gfx.sphere(ctx, 18, 10, 6.5, "#B3363A");
            Gfx.chip(ctx, "Зрілий пилок із крохмалем (некомпетентний)", 0, spR + 12, { align: "center", size: 8.8, bg: rgba(T.sheet, 0.92), fg: T.bad });
          }
          ctx.restore();
        }
      });

      // Pathway comparison badge at bottom of Zone 2
      const py2 = H - 50;
      Gfx.chip(c, m.switchProb >= 40
        ? `Спорофітний шлях (симетричний поділ): ${fmt(m.switchProb, 1)} %`
        : `Переважає гаметофітний шлях (пилок): ${fmt(100 - m.switchProb, 1)} %`,
        mcx, py2, {
          align: "center",
          bg: m.switchProb >= 40 ? rgba(T.good, 0.15) : rgba(T.warn, 0.15),
          stroke: m.switchProb >= 40 ? T.good : T.warn,
          fg: T.ink
        });
      Gfx.text(c, m.stageName, mcx, py2 + 20, { align: "center", size: 10, color: T.muted });

      // ==================== ZONE 3: IN VITRO REGENERANTS & COLCHICINE DOUBLING ====================
      const z3X = z1W + z2W - pad * 0.5;
      const z3InnerW = z3W - pad * 0.5;
      Gfx.rr(c, z3X, pad, z3InnerW, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
      Gfx.text(c, "3. Регенеранти та дигаплоїдизація (DH)", z3X + 10, pad + 18, { weight: 700, size: 11.5, color: T.ink });

      const rcx = z3X + z3InnerW * 0.5;
      const vialW = Math.min(48, z3InnerW * 0.34), vialH = Math.min(118, (H - pad * 2) * 0.40);
      const vialY = pad + 42;

      // Left Vial: Haploid / Albino regenerant (n) before or without colchicine
      const vx1 = z3X + z3InnerW * 0.27 - vialW / 2;
      Gfx.vial(c, vx1, vialY, vialW, vialH, 0.28, "rgba(210, 232, 212, 0.65)", {
        plug: true,
        inside: (ctx, surfY) => {
          // Small sterile haploid shoot (plus small albino shoot on the side)
          Gfx.shootPlantlet(ctx, vx1 + vialW * 0.42, surfY + 2, vialH * 0.46, {
            stemCol: "#66BB6A", leafCol: "#43A047", leaves: 3, roots: 2, rootLen: 14, time: t
          });
          // Albino regenerant shoot (хлорофіл-дефектний альбінос)
          Gfx.shootPlantlet(ctx, vx1 + vialW * 0.72, surfY + 2, vialH * 0.28, {
            stemCol: "#F5F0DC", leafCol: "#FFFDF2", leaves: 2, roots: 1, rootLen: 8, time: t + 1
          });
        }
      });
      Gfx.text(c, `Гаплоїд (${isAnther ? "n=19" : "n=9"})`, vx1 + vialW / 2, vialY + vialH + 8, { align: "center", size: 9.5, weight: 700, font: "mono", color: T.warn });
      Gfx.text(c, "+ альбіноси", vx1 + vialW / 2, vialY + vialH + 19, { align: "center", size: 8.5, color: T.muted });

      // Arrow with Colchicine C-mitosis treatment between vials
      const midVx = rcx;
      Gfx.arrow(c, vx1 + vialW + 4, vialY + vialH * 0.48, vx1 + vialW + (z3InnerW * 0.46 - vialW) - 4, vialY + vialH * 0.48, {
        col: stateA.colch >= 0.02 ? T.antho : T.muted, w: 2
      });
      Gfx.chip(c, `Колхіцин ${fmt(stateA.colch, 2)}%`, midVx, vialY + vialH * 0.26, {
        align: "center", size: 8.8,
        bg: stateA.colch >= 0.02 ? rgba(T.antho, 0.15) : T.paper,
        stroke: stateA.colch >= 0.02 ? T.antho : T.rule
      });

      // Right Vial: Vigorous Doubled Haploid (DH, 2n) green plantlet!
      const vx2 = z3X + z3InnerW * 0.73 - vialW / 2;
      const isDH = stateA.colch >= 0.02;
      Gfx.vial(c, vx2, vialY, vialW, vialH, 0.28, "rgba(195, 228, 200, 0.72)", {
        plug: true,
        inside: (ctx, surfY) => {
          Gfx.shootPlantlet(ctx, vx2 + vialW * 0.5, surfY + 2, vialH * (isDH ? 0.64 : 0.45), {
            stemCol: isDH ? "#2E7D32" : "#66BB6A",
            leafCol: isDH ? "#1B5E20" : "#43A047",
            leaves: isDH ? 5 : 3,
            roots: isDH ? 5 : 2,
            rootLen: isDH ? 22 : 12,
            time: t
          });
        }
      });
      Gfx.text(c, isDH ? `DH (${isAnther ? "2n=38" : "2n=18"})` : `Стерильний (${isAnther ? "n=19" : "n=9"})`, vx2 + vialW / 2, vialY + vialH + 8, {
        align: "center", size: 9.5, weight: 700, font: "mono", color: isDH ? T.good : T.warn
      });
      Gfx.text(c, isDH ? `Фертильний ${fmt(m.dhPct, 0)}%` : "Без колхіцину", vx2 + vialW / 2, vialY + vialH + 19, {
        align: "center", size: 8.5, color: isDH ? T.good : T.bad
      });

      // Bottom of Zone 3: Cytogenetic Metaphase Plate & K-mitosis Chromosome Doubling Box
      const cy3 = H - 56, boxH3 = 82;
      Gfx.rr(c, z3X + 10, cy3 - boxH3 / 2, z3InnerW - 20, boxH3, 10);
      c.fillStyle = T.paper; c.fill(); c.strokeStyle = T.rule; c.stroke();

      const drawChr = (x, y, col, duplicated = false) => {
        c.save(); c.translate(x, y);
        c.strokeStyle = col; c.lineWidth = 2.8; c.lineCap = "round";
        c.beginPath(); c.moveTo(-3.5, -8); c.lineTo(3.5, 8); c.stroke();
        c.beginPath(); c.moveTo(3.5, -8); c.lineTo(-3.5, 8); c.stroke();
        // Centromere constriction
        Gfx.sphere(c, 0, 0, 2.2, "#FFF");
        if (duplicated) {
          c.translate(10, 0);
          c.beginPath(); c.moveTo(-3.5, -8); c.lineTo(3.5, 8); c.stroke();
          c.beginPath(); c.moveTo(3.5, -8); c.lineTo(-3.5, 8); c.stroke();
          Gfx.sphere(c, 0, 0, 2.2, "#FFF");
        }
        c.restore();
      };

      Gfx.text(c, "Цитологічний контроль плоїдності (К-мітоз):", rcx, cy3 - 26, { align: "center", size: 9.5, weight: 700, color: T.ink });
      if (isDH) {
        drawChr(rcx - 38, cy3 - 5, T.chl, true);
        drawChr(rcx - 6, cy3 - 5, T.data, true);
        drawChr(rcx + 26, cy3 - 5, T.antho, true);
        Gfx.text(c, `Дигаплоїд DH (${isAnther ? "2n = 38" : "2n = 18"}) · H₁ = 100 %`, rcx, cy3 + 17, { align: "center", size: 10, weight: 700, color: T.good, font: "mono" });
        Gfx.text(c, `Блок веретена поділу → 100 % гомозиготні пари (${fmt(m.dhPct, 0)} %)`, rcx, cy3 + 30, { align: "center", size: 9, color: T.muted });
      } else {
        drawChr(rcx - 28, cy3 - 5, T.warn, false);
        drawChr(rcx, cy3 - 5, T.data, false);
        drawChr(rcx + 28, cy3 - 5, T.antho, false);
        Gfx.text(c, `Гаплоїд (${isAnther ? "n = 19" : "n = 9"}) — непарні хромосоми`, rcx, cy3 + 17, { align: "center", size: 10, weight: 700, color: T.warn, font: "mono" });
        Gfx.text(c, "Стерильний: відсутня кон’югація гомологів у мейозі", rcx, cy3 + 30, { align: "center", size: 9, color: T.bad });
      }
    }

    /* ==================== TAB B: EMBRYO RESCUE (ЛР 40) ==================== */
    const boxB = modes.box("b");
    const stB = new Stage(boxB.st, { aspect: 1.68, minH: 310, maxH: 480, minW: 580, tag: "ЛР 40 · Постзиготична несумісність і порятунок гібридних зародків (Embryo rescue)" });

    const STAGES_E = {
      glob:    { name: "Глобулярна (0,15 мм)", optSuc: 10.5, sigSuc: 2.2, dapMin: 5, dapOpt: 7,  sizeMm: 0.15, needAA: 400 },
      heart:   { name: "Серцеподібна (0,45 мм)", optSuc: 8.5,  sigSuc: 2.3, dapMin: 8, dapOpt: 10, sizeMm: 0.45, needAA: 300 },
      torpedo: { name: "Торпедоподібна (1,2 мм)", optSuc: 3.5, sigSuc: 1.8, dapMin: 11, dapOpt: 13, sizeMm: 1.20, needAA: 100 },
      cot:     { name: "Сім’ядольна (2,6 мм)",   optSuc: 2.0,  sigSuc: 1.5, dapMin: 14, dapOpt: 16, sizeMm: 2.60, needAA: 0 }
    };

    const stateB = {
      embStage: "heart", // "glob" | "heart" | "torpedo" | "cot"
      sucrose: 8.5,      // % сахарози (1 - 14 %)
      casein: 400,       // мг/л гідролізату казеїну / глутаміну
      dap: 10            // доба ізоляції після запилення (4 - 22)
    };

    UI.seg(boxB.ct, {
      label: "Стадія ізольованого зародка при вилученні",
      options: [
        ["glob", "Глобула (0,15 мм)"],
        ["heart", "Сердечко (0,45 мм)"],
        ["torpedo", "Торпедо (1,2 мм)"],
        ["cot", "Сім’ядольна (2,6 мм)"]
      ],
      value: stateB.embStage,
      on: v => { stateB.embStage = v; updateB(); }
    });

    const slSucB = UI.slider(boxB.ct, {
      id: "l10b-suc", label: "Концентрація сахарози у середовищі", min: 1.0, max: 14.0, step: 0.5, value: stateB.sucrose, unit: "%",
      fmt: v => fmt(v, 1), on: v => { stateB.sucrose = v; updateB(); }
    });
    const slCasB = UI.slider(boxB.ct, {
      id: "l10b-cas", label: "Гідролізат казеїну / глутамін", min: 0, max: 800, step: 50, value: stateB.casein, unit: "мг/л",
      fmt: v => fmt(v, 0), on: v => { stateB.casein = v; updateB(); }
    });
    const slDapB = UI.slider(boxB.ct, {
      id: "l10b-dap", label: "Доба ізоляції після запилення (DAP)", min: 4, max: 22, step: 1, value: stateB.dap, unit: "доба",
      fmt: v => fmt(v, 0), on: v => { stateB.dap = v; updateB(); }
    });

    UI.buttons(boxB.ct, [
      {
        label: "Серцеподібний (оптимум 8,5 %)", pri: true, on: () => {
          stateB.embStage = "heart"; slSucB.set(stateB.sucrose = 8.5); slCasB.set(stateB.casein = 400); slDapB.set(stateB.dap = 10); updateB();
        }
      },
      {
        label: "Глобулярний (10,5 % сах.)", on: () => {
          stateB.embStage = "glob"; slSucB.set(stateB.sucrose = 10.5); slCasB.set(stateB.casein = 500); slDapB.set(stateB.dap = 7); updateB();
        }
      },
      {
        label: "Помилка: 2 % для сердечка", on: () => {
          stateB.embStage = "heart"; slSucB.set(stateB.sucrose = 2.0); slCasB.set(stateB.casein = 100); slDapB.set(stateB.dap = 10); updateB();
        }
      },
      {
        label: "Торпедоподібний (3 % сах.)", on: () => {
          stateB.embStage = "torpedo"; slSucB.set(stateB.sucrose = 3.0); slCasB.set(stateB.casein = 200); slDapB.set(stateB.dap = 13); updateB();
        }
      }
    ]);

    const readsB = UI.reads(boxB.bl, [
      ["psi", "Осмотичний потенціал Ψ_s"],
      ["endo", "Стан гібридного ендосперму (in vivo)"],
      ["surv", "Виживання та нормальний морфогенез"],
      ["prec", "Ризик передчасного проростання"]
    ]);
    const outB = UI.out(boxB.bl, "");
    const chartsB = h("div", { class: "charts" });
    boxB.bl.append(chartsB);
    const chOsmB = UI.chart(chartsB, "Виживання зародка (%) залежно від концентрації сахарози");
    const chDapB = UI.chart(chartsB, "Дегенерація ендосперму та вікно порятунку зародка (діб після запилення)");

    function modelB(stKey = stateB.embStage, suc = stateB.sucrose, cas = stateB.casein, dap = stateB.dap) {
      const st = STAGES_E[stKey];
      // Osmotic potential of sucrose + mineral salts (~ -0.10 MPa base MS/White salts)
      const cMol = (suc * 10) / 342.3;
      const psiS = -(cMol * 0.008314 * 298.15 + 0.10); // МПа

      // Endosperm viability in distant crosses drops sharply after day 11-13
      const endoAlive = 100 / (1 + Math.exp((dap - 12.2) / 1.6));
      // Embryo in vivo viability before isolation (needs to reach minimum stage, dies if left too long with dead endosperm)
      const inVivoViab = smooth(3.5, 6.5, dap) * (1 / (1 + Math.exp((dap - 15.0) / 1.7)));

      // Osmotic match for the selected embryo stage
      const osmFit = Math.exp(-0.5 * Math.pow((suc - st.optSuc) / st.sigSuc, 2));
      // Amino acid requirement (crucial for globular & heart stages)
      const aaFit = st.needAA === 0 ? 1 : (0.38 + 0.62 * (cas / (cas + st.needAA * 0.45)));

      // Precocious germination happens when early embryo (glob/heart) is placed on low sucrose (< 5%)
      const precocious = (stKey === "glob" || stKey === "heart")
        ? clamp((st.optSuc - 2.0 - suc) / (st.optSuc - 2.0), 0, 1) * 88
        : 0;

      const normalRegen = clamp(osmFit * aaFit * inVivoViab * 95, 1, 95);
      return { st, cMol, psiS, endoAlive, inVivoViab, osmFit, aaFit, precocious, normalRegen };
    }

    function updateB() {
      const m = modelB();
      readsB.set("psi", fmt(m.psiS, 2), `МПа (${fmt(m.cMol, 2)} М сахарози)`);
      readsB.set("endo", fmt(m.endoAlive, 1), "% живих клітин ендосперму");
      readsB.set("surv", fmt(m.normalRegen, 1), "% нормальних гібридних проростків");
      readsB.set("prec", fmt(m.precocious, 1), "% (передчасне проростання без плюмули)");

      let cls = "good", msg = "";
      if (stateB.dap > 16) {
        cls = "bad";
        msg = `<b>Запізніла ізоляція (${stateB.dap}-та доба після запилення):</b> через постзиготичну несумісність триплоїдний ендосперм дегенерував (живих клітин лише ${fmt(m.endoAlive, 1)} %), і гібридний зародок загинув до введення в культуру. Вилучайте зародки на <b>8–14-ту добу</b>.`;
      } else if (m.precocious > 35) {
        cls = "bad";
        msg = `<b>Передчасне проростання (<i>precocious germination</i>, ${fmt(m.precocious, 0)} %):</b> для раннього зародка (${m.st.name}) концентрація сахарози ${fmt(stateB.sucrose, 1)} % (Ψ<sub>s</sub> = ${fmt(m.psiS, 2)} МПа) є надто низькою! Зародок передчасно витягує слабкий корінець без формування апікальної меристеми пагона (плюмули). Підвищте сахарозу до <b>${fmt(m.st.optSuc, 1)} %</b>.`;
      } else if (stateB.sucrose > m.st.optSuc + 3.5) {
        cls = "warn";
        msg = `<b>Гіперосмотичне гальмування (Ψ<sub>s</sub> = ${fmt(m.psiS, 2)} МПа):</b> надмірна концентрація сахарози (${fmt(stateB.sucrose, 1)} %) спричиняє плазмоліз і блокує перехід зародка стадії «${m.st.name}» до проростання. Оптимум для цієї стадії — <b>${fmt(m.st.optSuc, 1)} %</b>.`;
      } else {
        cls = "good";
        msg = `<b>Успішний порятунок гібридного зародка (ЛР 40):</b> при Ψ<sub>s</sub> = ${fmt(m.psiS, 2)} МПа (${fmt(stateB.sucrose, 1)} % сахарози) та ${stateB.casein} мг/л гідролізату казеїну ізольований зародок стадії «${m.st.name}» завершує диференціацію сім’ядолей та формує <b>${fmt(m.normalRegen, 1)} % життєздатних міжвидових гібридів</b>.`;
      }
      outB.el.className = "bout " + cls;
      outB.set(msg);

      drawChartsB();
      stB.dirty = true;
    }

    function drawChartsB() {
      const T = Theme.c;
      const ptsGlob = [], ptsHeart = [], ptsTorp = [];
      for (let s = 1; s <= 14.01; s += 0.25) {
        ptsGlob.push([s, modelB("glob", s, stateB.casein, 8).normalRegen]);
        ptsHeart.push([s, modelB("heart", s, stateB.casein, 10).normalRegen]);
        ptsTorp.push([s, modelB("torpedo", s, stateB.casein, 12).normalRegen]);
      }
      const curM = modelB();

      drawChart(chOsmB, {
        x: [1, 14], y: [0, 100],
        xl: "Концентрація сахарози w_сах (%)", yl: "Нормальна регенерація (%)",
        series: [
          { pts: ptsGlob, color: T.antho, w: 2 },
          { pts: ptsHeart, color: T.chl, w: 2.5, fill: rgba(T.chl, 0.10) },
          { pts: ptsTorp, color: T.data, w: 2 }
        ],
        marks: [
          { x: stateB.sucrose, y: curM.normalRegen, r: 5.5, color: T.carot, label: `${fmt(curM.normalRegen, 1)} %` }
        ],
        legend: [
          { color: T.antho, label: "Глобула (опт. 10,5 %)" },
          { color: T.chl, label: "Сердечко (опт. 8,5 %)" },
          { color: T.data, label: "Торпедо (опт. 3,5 %)" }
        ]
      });

      const ptsEndo = [], ptsRescue = [];
      for (let d = 4; d <= 22; d += 0.4) {
        const md = modelB(stateB.embStage, stateB.sucrose, stateB.casein, d);
        ptsEndo.push([d, md.endoAlive]);
        ptsRescue.push([d, md.normalRegen]);
      }
      drawChart(chDapB, {
        x: [4, 22], y: [0, 105],
        xl: "Час після запилення (діб, DAP)", yl: "Життєздатність (%)",
        band: [{ x0: 8, x1: 14, color: rgba(T.good, 0.12) }],
        vl: [{ x: stateB.dap, color: T.carot, dash: [3, 3], label: `${stateB.dap} доба` }],
        series: [
          { pts: ptsEndo, color: T.bad, w: 2, dash: [5, 4] },
          { pts: ptsRescue, color: T.chl, w: 2.5, fill: rgba(T.chl, 0.12) }
        ],
        marks: [
          { x: stateB.dap, y: curM.normalRegen, r: 5.5, color: T.chl, label: `${fmt(curM.normalRegen, 1)} %` }
        ],
        legend: [
          { color: T.chl, label: "Успіх Embryo rescue (in vitro)" },
          { color: T.bad, label: "Гібридний ендосперм (in vivo)" }
        ]
      });
    }

    function drawStageB(dt, t) {
      const c = stB.ctx, W = stB.W, H = stB.H, T = Theme.c;
      stB.clear();
      const m = modelB();

      // Left half: Hybrid ovule in vivo (showing degenerating endosperm & embryo excision)
      // Right half: Culture vessel with isolated embryo developing according to osmotic potential
      const midX = W * 0.48, pad = 10;

      // Left Card
      Gfx.rr(c, pad, pad, midX - pad * 1.5, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();
      Gfx.text(c, `1. Гібридний насіннєвий зачаток (${stateB.dap}-та доба)`, pad + 12, pad + 18, { weight: 700, size: 12, color: T.ink });

      const ox = pad + (midX - pad * 1.5) * 0.5, oy = H * 0.50;
      const orx = Math.min(82, (midX - 48) * 0.38), ory = orx * 0.72;

      // Outer integuments
      c.fillStyle = Theme.dark ? "#2B3A30" : "#DCE6D5";
      c.strokeStyle = "#4E7356"; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(ox, oy, orx, ory, 0, 0, Math.PI * 2); c.fill(); c.stroke();

      // Endosperm cavity (browns and shrinks as endoAlive drops)
      const endoT = m.endoAlive / 100;
      const endoCol = mixc("#7A4928", "#E9F2DF", endoT);
      c.fillStyle = endoCol;
      c.beginPath(); c.ellipse(ox, oy, orx * 0.76, ory * 0.72, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = rgba(T.ink, 0.3); c.lineWidth = 1; c.stroke();

      // Draw embryo inside ovule
      drawEmbryoShape(c, ox - orx * 0.22, oy, stateB.embStage, 0.9, m.inVivoViab > 0.35 ? "#389458" : "#8A6D3B");
      Gfx.text(c, `Ендосперм (3n): ${fmt(m.endoAlive, 0)} % живий`, ox, oy + ory + 18, {
        align: "center", size: 11, weight: 600, color: m.endoAlive > 50 ? T.good : T.bad
      });
      Gfx.text(c, `Зародок (2n): стадія «${m.st.name}»`, ox, oy + ory + 34, { align: "center", size: 10.5, color: T.muted });

      // Micro-dissection needle transferring embryo to right card
      Gfx.arrow(c, ox + orx * 0.5, oy - 12, midX + 26, oy - 12, { col: T.chl, w: 2.2, dash: [4, 3] });
      Gfx.chip(c, "Мікропрепарування", midX, oy - 28, { align: "center", size: 10, bg: T.sheet, stroke: T.chl, fg: T.chl });

      // Right Card: In vitro Embryo Culture
      Gfx.rr(c, midX + pad * 0.5, pad, W - midX - pad * 1.5, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();
      Gfx.text(c, "2. Культура ізольованого зародка in vitro (ЛР 40)", midX + pad * 0.5 + 12, pad + 18, { weight: 700, size: 12, color: T.ink });

      const vx = midX + (W - midX) * 0.5, vy = H * 0.50;
      const vw = Math.min(130, (W - midX) * 0.48), vh = Math.min(175, H * 0.58);

      Gfx.vial(c, vx - vw / 2, vy - vh / 2 + 10, vw, vh, 0.36, rgba(T.chl, 0.18), {
        plug: true,
        label: `Сахароза ${fmt(stateB.sucrose, 1)} % (Ψ_s = ${fmt(m.psiS, 2)} МПа)`,
        inside: (ctx, surfY) => {
          const cx2 = vx, cy2 = surfY - 4;
          const bob = Math.sin(t * 2) * 1.5;
          if (m.precocious > 35) {
            // Precocious germination: weak thin rootlet, stunted yellow shoot apex without cotyledons
            ctx.strokeStyle = "#C79A3B"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.quadraticCurveTo(cx2 - 8, cy2 + 18, cx2 + 4, cy2 + 34); ctx.stroke();
            Gfx.sphere(ctx, cx2, cy2 - 4, 6, "#C77A12");
          } else if (m.normalRegen > 45) {
            // Healthy green plantlet with expanding cotyledons, shoot meristem (plumule) and root
            ctx.strokeStyle = "#88B082"; ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2 - 6, cy2 + 28); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2 + 7, cy2 + 25); ctx.stroke();
            // Hypocotyl + two bright green cotyledons + plumule
            ctx.strokeStyle = "#2C7A4D"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2, cy2 - 28 + bob); ctx.stroke();
            ctx.fillStyle = "#35965B";
            ctx.beginPath(); ctx.ellipse(cx2 - 12, cy2 - 30 + bob, 11, 5.5, -0.4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx2 + 12, cy2 - 30 + bob, 11, 5.5, 0.4, 0, Math.PI * 2); ctx.fill();
            // Plumule (apical shoot meristem)
            Gfx.sphere(ctx, cx2, cy2 - 34 + bob, 4, "#7CD67F");
          } else {
            // Arrested / plasmolyzed embryo
            drawEmbryoShape(ctx, cx2, cy2 - 8, stateB.embStage, 0.85, "#8C7048");
          }
        }
      });

      const statusTxt = m.precocious > 35
        ? "Передчасне проростання (немає плюмули!)"
        : m.normalRegen > 45
        ? `Повноцінний проросток (${fmt(m.normalRegen, 1)} %)`
        : "Дегенерація / осмотичний стрес";
      Gfx.chip(c, statusTxt, vx, pad + 44, {
        align: "center", size: 10.5,
        bg: m.normalRegen > 45 && m.precocious <= 35 ? rgba(T.good, 0.15) : rgba(T.bad, 0.15),
        stroke: m.normalRegen > 45 && m.precocious <= 35 ? T.good : T.bad
      });
    }

    function drawEmbryoShape(c, x, y, stageKey, scale, col) {
      c.save(); c.translate(x, y); c.scale(scale, scale);
      c.fillStyle = col; c.strokeStyle = shade(col, -0.35); c.lineWidth = 1.5;
      if (stageKey === "glob") {
        Gfx.sphere(c, 0, -4, 10, col, { ring: shade(col, -0.35) });
        // Suspensor
        c.beginPath(); c.moveTo(0, 6); c.lineTo(0, 18); c.stroke();
      } else if (stageKey === "heart") {
        c.beginPath();
        c.moveTo(0, 14);
        c.bezierCurveTo(-14, 4, -18, -12, -7, -14);
        c.bezierCurveTo(-2, -15, 0, -8, 0, -6);
        c.bezierCurveTo(0, -8, 2, -15, 7, -14);
        c.bezierCurveTo(18, -12, 14, 4, 0, 14);
        c.fill(); c.stroke();
      } else {
        const hMul = stageKey === "cot" ? 1.35 : 1.0;
        c.scale(1, hMul);
        c.beginPath();
        c.moveTo(0, 18);
        c.bezierCurveTo(-12, 10, -16, -16, -6, -19);
        c.bezierCurveTo(-1, -20, 0, -8, 0, -5);
        c.bezierCurveTo(0, -8, 1, -20, 6, -19);
        c.bezierCurveTo(16, -16, 12, 10, 0, 18);
        c.fill(); c.stroke();
      }
      c.restore();
    }

    updateA();
    updateB();
    modes.init();

    return {
      stages: [stA, chWindow, chHomo, stB, chOsmB, chDapB],
      frame(dt, time) {
        if (modes.cur === "a" && (dt > 0 || stA.dirty)) { stA.dirty = false; drawStageA(dt, time); }
        if (modes.cur === "b" && (dt > 0 || stB.dirty)) { stB.dirty = false; drawStageB(dt, time); }
      }
    };
  }
});
})();
