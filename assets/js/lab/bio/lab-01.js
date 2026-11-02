// ПЗ 1: теорія, модель, питання (код згенеровано з вихідних файлів).
(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb } = window.BIO;
/* ПЗ 1. Стаціонарний стан: відкрита клітина, ентропія, електрохімічний потенціал Na⁺ */
App.def(1, {
  cheat: "<p class=\"lead\">Усі хімічні реакції в живих клітинах підпорядковуються законам термодинаміки. Клітина — не «закрита банка», у якій реакції доходять до кінця, а відкрита система, що живе завдяки постійним потокам речовини й енергії. Ця робота пояснює, чим <b>стаціонарний стан</b> живого відрізняється від термодинамічної <b>рівноваги</b>, і вводить величину, яка керує рухом іонів через мембрану, — <b>електрохімічний потенціал</b>.</p><h3>Два закони термодинаміки в живих системах</h3><ul><li><b>Перший закон.</b> Енергія не створюється з нічого й не зникає, а лише перетворюється з одного виду в інший в еквівалентних кількостях; внутрішня енергія ізольованої системи залишається сталою. Самовільні хімічні процеси йдуть лише в одному напрямку — до рівноваги, тобто до максимальної ентропії.</li><li><b>Другий закон.</b> Ентропія при самовільних процесах зростає. Самовільно неупорядкована система ніколи не стане упорядкованою: для цього треба витратити додаткову енергію.</li></ul><p>Здається, що життя суперечить другому закону: клітина впорядкована й складна. Суперечності немає — клітина відкрита й постійно «вичерпує» вільну енергію із середовища (світло, їжа), а виробляючи ентропію, виводить її у вигляді тепла та простих продуктів.</p><div class=\"bf-gal bf-gal--2\"><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/benard.webp\" data-lightbox data-caption=\"Комірки Бенара: упорядкована структура, що існує лише поки крізь шар рідини тече тепло — класична «дисипативна структура» (за І. Пригожиним). Фото: Hansmuller, Wikimedia Commons · CC BY-SA 4.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/benard.webp\" alt=\"Комірки Бенара: упорядкована структура, що існує лише поки крізь шар рідини тече тепло — класична «дисипативна структура» (за І. Пригожиним).\" width=\"1000\" height=\"975\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Комірки Бенара: упорядкована структура, що існує лише поки крізь шар рідини тече тепло — класична «дисипативна структура» (за І. Пригожиним).<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Convection_cell_pattern_after_boiling_rice_in_a_pan,_2024.jpg\" target=\"_blank\" rel=\"noopener\">Hansmuller</a> · CC BY-SA 4.0</span></figcaption></figure><figure class=\"bf \"><a href=\"../../assets/img/bio/skunkcabbage.webp\" data-lightbox data-caption=\"Скунсова капуста (Symplocarpus foetidus): суцвіття дихає так інтенсивно, що нагрівається до +15…+35 °C і розтоплює сніг — пряма ілюстрація того, що живий організм розсіює енергію у вигляді тепла. Фото: Martin Bravenboer, Wikimedia Commons · Public domain\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/skunkcabbage.webp\" alt=\"Скунсова капуста (Symplocarpus foetidus): суцвіття дихає так інтенсивно, що нагрівається до +15…+35 °C і розтоплює сніг — пряма ілюстрація того, що живий організм розсіює енергію у вигляді тепла.\" width=\"750\" height=\"1000\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Скунсова капуста (Symplocarpus foetidus): суцвіття дихає так інтенсивно, що нагрівається до +15…+35 °C і розтоплює сніг — пряма ілюстрація того, що живий організм розсіює енергію у вигляді тепла.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:WesternSkunkCabbage.JPG\" target=\"_blank\" rel=\"noopener\">Martin Bravenboer</a> · Public domain</span></figcaption></figure></div><h3>Рівновага й стаціонарний стан</h3><p><b>Стаціонарним</b> називають такий стан відкритої системи, за якого основні макроскопічні параметри залишаються сталими. Принципова різниця між ним і рівноважним станом — у табл. 1.</p><div class=\"tblwrap\"><table class=\"t bt \"><thead><tr><th>Ознака</th><th>Рівноважний стан</th><th>Стаціонарний стан</th></tr></thead><tbody><tr><td>Вільна енергія й працездатність</td><td>мінімальні</td><td>сталі, але не мінімальні</td></tr><tr><td>Ентропія системи</td><td>максимальна</td><td>стала — за рахунок рівності продукції та потоку ентропії</td></tr><tr><td>Градієнти</td><td>відсутні — усе вирівняне</td><td>постійні градієнти зберігаються</td></tr><tr><td>Обмін із середовищем</td><td>немає потоків речовини</td><td>є: речовина й вільна енергія надходять, продукти й тепло виводяться</td></tr><tr><td>У живій системі</td><td>настає лише зі смертю</td><td>нормальний стан живого</td></tr></tbody></table></div><p>У рівновазі припиняються всі процеси, крім теплового руху молекул, а градієнти вирівнюються. У стаціонарному стані відбуваються реакції, дифузія й перенесення іонів, проте вони настільки збалансовані, що стан системи в цілому не змінюється. Це створює зовнішнє враження «спокою» за надзвичайно активної роботи всередині.</p><h4>Термодинамічний критерій стаціонарного стану</h4><p>Зміну ентропії відкритої системи розкладають на дві частини: <b>продукцію</b> ентропії всередині (завжди ≥ 0, бо процеси необоротні) і <b>потік</b> ентропії через межу системи (може бути від’ємним — коли ентропія виводиться в довкілля).</p><div class=\"eq\"><span class=\"fr\"><span>d<var>S</var></span><span>d<var>t</var></span></span> = <span class=\"fr\"><span>d<sub>i</sub><var>S</var></span><span>d<var>t</var></span></span> + <span class=\"fr\"><span>d<sub>e</sub><var>S</var></span><span>d<var>t</var></span></span><span class=c>повна зміна ентропії = внутрішня продукція + обмін із середовищем</span></div><div class=\"eq\"><span class=\"fr\"><span>d<sub>i</sub><var>S</var></span><span>d<var>t</var></span></span> = −<span class=\"fr\"><span>d<sub>e</sub><var>S</var></span><span>d<var>t</var></span></span> &nbsp;⇒&nbsp; <span class=\"fr\"><span>d<var>S</var></span><span>d<var>t</var></span></span> = 0<span class=c>умова стаціонарного стану: ентропія, вироблена клітиною, дорівнює ентропії, яку вона віддає</span></div><p>Термодинамічній рівновазі властива відсутність потоків між системою та середовищем, тоді як стаціонарний стан підтримується саме обміном. Для збереження рівноваги витрачати вільну енергію не треба — для підтримання стаціонарного стану треба постійно.</p><div class=\"bcall bcall--idea\"><b>Теорема Пригожина</b><p>Поблизу рівноваги (лінійний режим) стаціонарний стан відкритої системи відповідає <b>мінімуму швидкості виробництва ентропії</b> σ = dᵢS/dt за заданих зовнішніх обмежень. Якщо збурити такий стан, σ спадає назад до свого мінімального сталого значення. У рівновазі σ = 0, у стаціонарному стані σ &gt; 0.</p></div><h3>Гомеостаз — стаціонарний стан організму</h3><div class=\"bf-gal bf-gal--2\"><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/bernard.webp\" data-lightbox data-caption=\"Клод Бернар (1813–1878) — французький фізіолог, автор уявлення про сталість «внутрішнього середовища» організму. Фото: Unknown authorUnknown author, Wikimedia Commons · Public domain\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/bernard.webp\" alt=\"Клод Бернар (1813–1878) — французький фізіолог, автор уявлення про сталість «внутрішнього середовища» організму.\" width=\"713\" height=\"1000\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Клод Бернар (1813–1878) — французький фізіолог, автор уявлення про сталість «внутрішнього середовища» організму.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Claude_Bernard_5.jpg\" target=\"_blank\" rel=\"noopener\">Unknown authorUnknown author</a> · Public domain</span></figcaption></figure><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/prigogine.webp\" data-lightbox data-caption=\"Ілля Пригожин (1917–2003) — лауреат Нобелівської премії з хімії 1977 р. за термодинаміку необоротних процесів. Фото: Unknown (Keystone - US), Wikimedia Commons · Public domain\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/prigogine.webp\" alt=\"Ілля Пригожин (1917–2003) — лауреат Нобелівської премії з хімії 1977 р. за термодинаміку необоротних процесів.\" width=\"719\" height=\"718\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Ілля Пригожин (1917–2003) — лауреат Нобелівської премії з хімії 1977 р. за термодинаміку необоротних процесів.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Ilya_Prigogine_1977b.jpg\" target=\"_blank\" rel=\"noopener\">Unknown (Keystone - US)</a> · Public domain</span></figcaption></figure></div><p>Біологічні системи, особливо високоорганізовані, підтримують основні показники життєдіяльності на сталому рівні протягом усього життя. К. Бернар назвав «внутрішнім середовищем» кров, лімфу й міжклітинну рідину, у яку «занурені» клітини тканин, і порівняв його з «оранжереєю»: сталість внутрішнього середовища — необхідна умова вільного життя вищих тварин. Температура, pH, вміст кисню, CO₂, води, іонів і цукру коливаються лише у вузьких межах.</p><p>Внутрішнє середовище — це «буфер» між клітинами та зовнішнім світом: коли параметри довкілля різко змінюються, його властивості утримуються регуляцією кровообігу, дихання, виділення й травлення. Наприклад, за зниження вмісту кисню у вдихуваному повітрі посилюються дихання й кровообіг, і вміст кисню у внутрішньому середовищі зберігається. Отже, <b>гомеостаз — це стаціонарний стан організму вищих тварин</b>.</p><div class=\"bcall bcall--note\"><b>Про рослини</b><p>Рослини теж підтримують стаціонарний стан, але інакше: сталість забезпечують клітинні механізми (тургор, pH цитоплазми, іонний гомеостаз, баланс окисників і антиоксидантів). У цьому курсі ми розглядаємо саме клітинний рівень: потоки речовини крізь мембрану, ентропію й електрохімічні градієнти.</p></div><h3>Типи систем і тип процесів</h3><div class=\"tblwrap\"><table class=\"t bt \"><thead><tr><th>Система</th><th>Обмін енергією</th><th>Обмін речовиною</th><th>Приклад</th></tr></thead><tbody><tr><td>Відкрита</td><td>так</td><td>так</td><td>клітина, організм, мітохондрія з субстратом</td></tr><tr><td>Замкнена</td><td>так</td><td>ні</td><td>запаяна ампула з культурою у термостаті</td></tr><tr><td>Ізольована</td><td>ні</td><td>ні</td><td>ідеалізована модель (термос)</td></tr></tbody></table></div><p>Кожна клітина й весь організм належать переважно до відкритих біосистем. До енергетичних процесів належать дихання, скорочення м’язів, фотосинтез, активний транспорт речовин. Усі вони поділяються на <b>оборотні</b> й <b>необоротні</b>.</p><p><b>Оборотний процес</b> — такий, коли система в кожен момент нескінченно близька до рівноваги, і досить трохи змінити умови, щоб процес пішов у зворотному напрямку без залишкових змін у довкіллі. Під рівновагою тут розуміють стан, коли градієнти різних видів енергії (хімічної, електричної) вирівняні, а здатність виконувати роботу дорівнює нулю. <b>Необоротний процес</b> веде систему до кінцевого стану (при мимовільному перебігу — до рівноваги) з певною швидкістю; саме такими є реальні процеси життєдіяльності, і саме тому σ &gt; 0.</p><h3>Термодинамічні потенціали</h3><p>Стан системи можна повністю описати термодинамічними потенціалами, кожному з яких відповідає свій набір незалежних змінних. Крім внутрішньої енергії <var>U</var>, це ентальпія <var>H</var>, вільна енергія Гельмгольца <var>F</var> і вільна енергія Гіббса <var>G</var> (<var>P</var> — тиск, <var>V</var> — об’єм, <var>S</var> — ентропія, <var>T</var> — температура):</p><div class=\"eq\"><var>H</var> = <var>U</var> + <var>PV</var> &nbsp;&nbsp; <var>F</var> = <var>U</var> − <var>TS</var> &nbsp;&nbsp; <var>G</var> = <var>U</var> + <var>PV</var> − <var>TS</var> = <var>H</var> − <var>TS</var></div><p>Енергія Гіббса відповідає стану системи за <b>сталих тиску й температури</b> — саме такі умови в живій клітині, тому цей потенціал вживають для опису біосистем. Корисна робота виконується за рахунок зменшення потенціалу Гіббса: реакція йде самовільно, якщо Δ<var>G</var> &lt; 0.</p><h3>Електрохімічний потенціал</h3><p>Вільна енергія Гіббса, що припадає на один моль речовини, — це <b>хімічний потенціал</b>. Для заряджених частинок (іонів) до нього додається електрична складова, і вийшов <b>електрохімічний потенціал</b>, який об’єднує хімічну, осмотичну та електричну енергії:</p><div class=\"eq\"><var>μ̃</var> = <var>μ</var><sup>0</sup> + <var>RT</var> ln <var>C</var> + <var>zF</var><var>φ</var></div><dl class=\"vars\"><dt>μ⁰</dt><dd>стандартний хімічний потенціал: залежить від природи речовини</dd><dt>C</dt><dd>концентрація (активність) іона</dd><dt>R</dt><dd>універсальна газова стала, 8,31 Дж/(моль·К)</dd><dt>T</dt><dd>абсолютна температура, К</dd><dt>z</dt><dd>заряд іона (для Na⁺ z = +1)</dd><dt>F</dt><dd>стала Фарадея, 9,6485·10⁴ Кл/моль</dd><dt>φ</dt><dd>електричний потенціал фази, В</dd></dl><p>Електрохімічний потенціал Na⁺, K⁺ та інших іонів відіграє вирішальну роль у перенесенні речовин крізь клітинні мембрани. Іони самовільно рухаються туди, де <var>μ̃</var> менший; щоб перенести іон у зворотному напрямку (проти градієнта), клітина мусить виконати роботу, рівну різниці електрохімічних потенціалів.</p><h3>Математична модель</h3><div class=\"bcall bcall--model\"><b>Що розраховує модель</b><p>Модель має дві частини. У першій клітина — це ділянка з речовиною, що <b>надходить</b> із середовища, <b>перетворюється</b> ферментативною реакцією і <b>виходить</b>. У другій — розраховується робота перенесення іона Na⁺ крізь мембрану за формулами цієї теми.</p></div><h4>Частина А. Відкрита система «субстрат S → продукт P»</h4><div class=\"eq\"><span class=\"fr\"><span>d<var>S</var></span><span>d<var>t</var></span></span> = <var>J</var><sub>вх</sub> − <var>v</var> &nbsp;&nbsp;&nbsp; <span class=\"fr\"><span>d<var>P</var></span><span>d<var>t</var></span></span> = <var>v</var> − <var>J</var><sub>вих</sub></div><div class=\"eq\"><var>J</var><sub>вх</sub> = <var>k</var><sub>M</sub>(<var>S</var><sub>зовн</sub> − <var>S</var>) &nbsp;&nbsp; <var>v</var> = <var>k</var><sub>f</sub><var>S</var> − <var>k</var><sub>r</sub><var>P</var> &nbsp;&nbsp; <var>J</var><sub>вих</sub> = <var>k</var><sub>M</sub>(<var>P</var> − <var>P</var><sub>зовн</sub>)</div><p>Тут <var>k</var><sub>M</sub> — проникність мембрани, <var>K</var> = <var>k</var><sub>f</sub>/<var>k</var><sub>r</sub> — константа рівноваги реакції. Якщо мембрана закрита (<var>k</var><sub>M</sub> = 0), то система доходить до рівноваги <var>S</var>/<var>P</var> = 1/<var>K</var>. Якщо відкрита, <var>S</var> і <var>P</var> виходять на сталі значення, які задаються балансом потоків, а не рівноважним відношенням.</p><p>Швидкість виробництва ентропії дорівнює сумі добутків потоків на спряжені сили (в одиницях <var>R</var>):</p><div class=\"eq\"><var>σ</var> = <span class=\"fr\"><span>d<sub>i</sub><var>S</var></span><span>d<var>t</var></span></span> = <var>v</var> ln<span class=\"fr\"><span><var>K</var><var>S</var></span><span><var>P</var></span></span> + <var>J</var><sub>вх</sub> ln<span class=\"fr\"><span><var>S</var><sub>зовн</sub></span><span><var>S</var></span></span> + <var>J</var><sub>вих</sub> ln<span class=\"fr\"><span><var>P</var></span><span><var>P</var><sub>зовн</sub></span></span> ≥ 0</div><p>Кожен доданок — це потік × термодинамічна сила, і для самовільних процесів вони мають однаковий знак, тому σ ≥ 0. Ентропія самої системи розраховується для ідеального розчину; потік ентропії обчислюється з балансу <var>d</var><sub>e</sub><var>S</var>/<var>dt</var> = <var>dS</var>/<var>dt</var> − σ. У стаціонарному стані <var>dS</var>/<var>dt</var> = 0, тож <var>d</var><sub>e</sub><var>S</var>/<var>dt</var> = −σ: система віддає в довкілля стільки ентропії, скільки виробляє.</p><h4>Як працювати з моделлю</h4><ol class=\"bsteps\"><li>Залиште мембрану <b>відкритою</b>. Спостерігайте, як клітина заповнюється субстратом і виходить на стаціонарний стан: σ стає сталою й додатною, потік ентропії дорівнює −σ.</li><li>Натисніть «Збурити». Концентрація S різко зростає, σ збільшується, а потім система повертається до свого стаціонарного значення — це ілюстрація теореми Пригожина.</li><li>Перемкніть мембрану на «Без обміну речовиною» або поставте позначку «Отруїти клітину». Потоки зникають, σ → 0, G зменшується до мінімуму — настала рівновага. Для живої системи це смерть.</li></ol><h4>Частина Б. Робота перенесення Na⁺</h4><div class=\"eq\"><var>A</var><sub>осм</sub> = <var>RT</var> ln<span class=\"fr\"><span><var>c</var><sub>2</sub></span><span><var>c</var><sub>1</sub></span></span> &nbsp;&nbsp; <var>A</var><sub>ел</sub> = <var>zF</var>(<var>φ</var><sub>2</sub> − <var>φ</var><sub>1</sub>) &nbsp;&nbsp; Δ<var>μ̃</var> = Δ<var>μ</var><sup>0</sup> + <var>A</var><sub>осм</sub> + <var>A</var><sub>ел</sub></div><p>Індекс 1 — внутрішній бік мембрани (клітина), 2 — зовнішній. Na⁺ не зазнає хімічних змін під час переносу, тому Δμ⁰ = 0. Модель обчислює три складові й показує, скільки молів Na⁺ можна виштовхнути за рахунок гідролізу 1 моль АТФ.</p><h3>Практична частина: задача про Na⁺</h3><div class=\"bcall bcall--task\"><b>Умова (з методички)</b><p>У клітині концентрація Na⁺ становить 0,020 моль/л, у позаклітинному середовищі — 0,20 моль/л. Температура 37 °C, потенціал внутрішнього боку −60·10⁻³ В. Яка величина осмотичної та електричної роботи і зміна електрохімічного потенціалу під час перенесення іонів натрію через плазматичну мембрану назовні? Електричну роботу обчислити для φ₂ = 0; 15; 20 мВ.</p></div><ol class=\"bsteps\"><li><b>Осмотична робота.</b> <var>T</var> = 310 К; <var>A</var><sub>осм</sub> = 8,31 · 310 · ln(0,20/0,020) = 8,31 · 310 · 2,3026 ≈ <b>5,93 кДж/моль</b>.</li><li><b>Електрична робота для φ₂ = 0:</b> <var>A</var><sub>ел</sub> = 1 · 96 485 · (0 − (−0,060)) ≈ <b>5,79 кДж/моль</b>. Для φ₂ = 15 мВ: 96 485 · 0,075 ≈ <b>7,24</b>; для 20 мВ: 96 485 · 0,080 ≈ <b>7,72 кДж/моль</b>.</li><li><b>Зміна електрохімічного потенціалу</b> Δμ̃ = A<sub>осм</sub> + A<sub>ел</sub>: ≈ <b>11,7</b>; <b>13,2</b>; <b>13,7 кДж/моль</b>.</li></ol><div class=\"bcall bcall--warn\"><b>Примітка до умови</b><p>У тексті методички потенціал записано як «−60·10³ В» — це друкарська помилка, мається на увазі <b>−60·10⁻³ В = −60 мВ</b>. Значення φ₂ = 15 і 20 слід розуміти як мілівольти.</p></div><p>Перенесення Na⁺ назовні — процес, що вимагає енергії (Δμ̃ &gt; 0), тому його виконує Na⁺/K⁺-АТФаза за рахунок гідролізу АТФ. У зворотному напрямку (досередини) Na⁺ рухається самовільно: тут Δμ̃ від’ємний.</p>", qa: [["Навіщо потрібний стаціонарний стан біосистемам?", "<p>Стаціонарний стан дозволяє підтримувати сталі параметри внутрішнього середовища (концентрації, градієнти, pH, мембранні потенціали) за умови постійного обміну речовиною й енергією з довкіллям. Саме градієнти (наприклад, Na⁺/K⁺ чи H⁺ на мембрані) є джерелом роботи клітини: вони потрібні для транспорту, сигналізації, синтезу АТФ. У рівновазі градієнтів немає, і працездатність нульова.</p>"], ["Які зміни ентропії в живому організмі призводять до патологічних змін, а які підтримують життєдіяльність?", "<p>Життя підтримується, коли організм <b>виробляє ентропію всередині</b> (σ &gt; 0, бо його процеси необоротні) і <b>виводить рівно стільки ж</b> у довкілля (dₑS/dt = −dᵢS/dt, тобто dS/dt = 0). Патологічні зміни виникають, коли виведення ентропії порушується або її продукція зростає понад можливості виведення: це руйнування мембран, втрата градієнтів, денатурація білків, перегрів, гіпоксія. Тоді dS/dt &gt; 0, система зміщується до рівноваги — до загибелі.</p>"], ["Сформулюйте теорему Пригожина. Якими критеріями стійкості характеризуються рівновага й стаціонарний стан?", "<p>Теорема Пригожина: у лінійній області стаціонарний стан відкритої системи (за сталих зовнішніх умов) відповідає <b>мінімальній</b> швидкості виробництва ентропії σ. Критерії стійкості: для <b>рівноваги</b> — максимум ентропії (для ізольованої системи) або мінімум вільної енергії (за сталих T, P); σ = 0. Для <b>стаціонарного стану</b> — мінімум σ &gt; 0 за заданих обмежень; після збурення σ спадає назад до цього мінімуму, тобто стан стійкий.</p>"], ["Запишіть закони термодинаміки, що описують живі системи.", "<p><b>I закон:</b> енергія не створюється і не зникає, а лише перетворюється з одного виду на інший у еквівалентних кількостях. <b>II закон:</b> ентропія ізольованої системи при самовільних процесах зростає; перехід від неупорядкованого до упорядкованого стану потребує додаткових витрат енергії. Для відкритих систем: dS = dᵢS + dₑS, причому dᵢS ≥ 0.</p>"], ["Чим відрізняється стаціонарний стан від рівноважного?", "<p>У рівновазі вільна енергія мінімальна, ентропія максимальна, градієнтів і потоків немає, процеси припинені (крім теплового руху). У стаціонарному стані вільна енергія стала, але не мінімальна; ентропія стала через рівність її продукції та виведення; існують постійні градієнти й постійні потоки речовини й енергії.</p>"], ["У клітині [Na⁺] = 0,020 моль/л, зовні — 0,20 моль/л, T = 37 °C, φ₁ = −60 мВ. Яка осмотична й електрична робота перенесення Na⁺ назовні при φ₂ = 0?", "<p><b>A<sub>осм</sub></b> = RT·ln(c₂/c₁) = 8,31·310·ln 10 ≈ <b>5,93 кДж/моль</b>. <b>A<sub>ел</sub></b> = zF(φ₂ − φ₁) = 96 485·0,060 ≈ <b>5,79 кДж/моль</b>. <b>Δμ̃</b> = 5,93 + 5,79 ≈ <b>11,7 кДж/моль</b> (Δμ⁰ = 0).</p>"], ["Як зміниться електрична робота, якщо потенціал зовнішнього боку зросте до +20 мВ?", "<p>Різниця потенціалів зросте з 60 до 80 мВ, отже A<sub>ел</sub> = 96 485·0,080 ≈ 7,72 кДж/моль (було 5,79), а Δμ̃ ≈ 13,7 кДж/моль. Чим більший позитивний потенціал зовні, тим важче виштовхувати катіон назовні.</p>"], ["Що таке оборотний і необоротний процеси? Які з них властиві живому?", "<p>Оборотний процес відбувається через послідовність станів, нескінченно близьких до рівноваги; його можна повернути без залишкових змін у довкіллі. Необоротний веде систему до кінцевого стану з певною швидкістю й супроводжується виробництвом ентропії (σ &gt; 0). Усі реальні процеси життєдіяльності — дихання, транспорт, синтез — необоротні.</p>"], ["Який термодинамічний потенціал найзручніший для опису біосистем і чому?", "<p>Вільна енергія Гіббса G = H − TS, бо в клітині тиск і температура практично сталі. Самовільні процеси супроводжуються зменшенням G, а корисна робота виконується за рахунок цього зменшення.</p>"], ["Що таке електрохімічний потенціал і з яких складових він складається?", "<p>Це вільна енергія Гіббса на один моль іонів: μ̃ = μ⁰ + RT ln C + zFφ. Складові: стандартна хімічна (μ⁰, залежить від природи речовини), осмотична (RT ln C, залежить від концентрації), електрична (zFφ, залежить від заряду й потенціалу).</p>"], ["Чому термодинамічна рівновага в біологічній системі настає лише зі смертю?", "<p>Рівновага означає відсутність градієнтів і потоків, тож немає й роботи. Живій системі потрібно постійно підтримувати градієнти (Na⁺/K⁺, H⁺, концентрації метаболітів) і для цього витрачати вільну енергію. Коли обмін припиняється, градієнти розсіюються й система досягає рівноваги.</p>"], ["Що таке гомеостаз і чому його називають стаціонарним станом організму?", "<p>Гомеостаз — відносна сталість складу й властивостей внутрішнього середовища попри зміни зовнішнього. Параметри (температура, pH, іони, глюкоза) тримаються на сталому рівні не тому, що процесів немає, а тому, що надходження й виведення, утворення й споживання збалансовані. Це визначення стаціонарного стану.</p>"]],
  build({ stageBox, ctrls, below, tabsBox }) {
    let mode = "a";
    const M = UI.modes(tabsBox, stageBox, ctrls, below, [["a", "Рівновага й стаціонарний стан"], ["b", "Електрохімічний потенціал Na⁺"]], (id) => { mode = id; });
    const A = M.box("a"), B = M.box("b");
    const COL = { S: "#E0A52B", P: "#3FA66A", heat: "#E0623A", water: "#9CC7E8", ion: "#2A6A93" };

    /* ================== РЕЖИМ A: ODE «клітина в середовищі» ================== */
    const P = { Sout: 1.0, perm: 0.8, kf: 1.2, lnK: 3, closed: false, poison: false };
    const Pout = 0.02, DS0 = -2; // s0(P) − s0(S) у одиницях R
    const X = { S: 0.05, Pp: 0.0, t: 0, hist: [], last: 0, sigma: 0, dSe: 0, dS: 0, G: 0, J: 0, v: 0 };
    const K = () => Math.exp(P.lnK);
    const rates = () => {
      const kin = P.closed ? 0 : P.perm * 0.8, kout = kin;
      const kf = P.poison ? 0 : P.kf, kr = kf / K();
      return { kin, kout, kf, kr };
    };
    function deriv(S, Pp) {
      const r = rates();
      const Jin = r.kin * (P.Sout - S), v = r.kf * S - r.kr * Pp, Jout = r.kout * (Pp - Pout);
      return { dS: Jin - v, dP: v - Jout, Jin, v, Jout };
    }
    const lnp = (x) => Math.log(Math.max(x, 1e-6));
    function thermo() {
      const d = deriv(X.S, X.Pp), r = rates();
      let sg = 0;
      if (r.kf > 0) sg += d.v * (lnp(K() * X.S) - lnp(X.Pp));
      sg += d.Jin * (lnp(P.Sout) - lnp(X.S));
      sg += d.Jout * (lnp(X.Pp) - lnp(Pout));
      sg = Math.max(0, sg);
      const dSsys = (0 - lnp(X.S)) * d.dS + (DS0 - lnp(X.Pp)) * d.dP;
      X.sigma = sg; X.dS = dSsys; X.dSe = dSsys - sg; X.v = d.v; X.J = d.Jin;
      X.G = X.S * (lnp(X.S) - 1) + X.Pp * (lnp(X.Pp) - 1 - P.lnK);
      const tot = X.S + X.Pp; X.Geq = (tot / (1 + K())) * (lnp(tot / (1 + K())) - 1) + (tot * K() / (1 + K())) * (lnp(tot * K() / (1 + K())) - 1 - P.lnK);
    }
    function step(dts) {
      const n = Math.ceil(dts / 0.01), h2 = dts / n;
      for (let i = 0; i < n; i++) {
        const d = deriv(X.S, X.Pp);
        X.S = Math.max(1e-4, X.S + d.dS * h2); X.Pp = Math.max(1e-4, X.Pp + d.dP * h2);
      }
      X.t += dts; thermo();
      if (X.t - X.last > 0.25) { X.last = X.t; X.hist.push([X.t, X.S, X.Pp, X.G, X.Geq, X.sigma, X.dSe, X.dS]); if (X.hist.length > 320) X.hist.shift(); }
    }
    function resetA() {
      X.S = P.closed ? 0.95 : 0.05; X.Pp = P.closed ? 0.0 : 0.0; X.t = 0; X.last = 0; X.hist = []; parts.length = 0; heat.length = 0; thermo(); seedParts();
    }

    // --- частинки ---
    const parts = [], heat = [], bath = [];
    const stA = new Stage(A.st, { aspect: 1.95, minH: 300, maxH: 450, tag: "Клітина в середовищі" });
    const geo = () => { const W = stA.W, H = stA.H; return { x0: W * .31, x1: W * .69, y0: H * .2, y1: H * .8, W, H, cy: H * .5 }; };
    const NMAX = 80;
    function seedParts() {
      const g = geo(); const r = rng(5);
      for (let i = 0; i < 30; i++) bath.push({ x: r() * g.x0 * .85 + 6, y: r() * g.H, t: 0, vx: (r() - .5) * 18, vy: (r() - .5) * 18, ph: r() * 6 });
      for (let i = 0; i < 24; i++) bath.push({ x: g.x1 + 14 + r() * (g.W - g.x1 - 22), y: r() * g.H, t: 1, vx: (r() - .5) * 18, vy: (r() - .5) * 18, ph: r() * 6 });
      const nS = Math.round(X.S * NMAX), nP = Math.round(X.Pp * NMAX);
      for (let i = 0; i < nS; i++) parts.push(newPart(0, g)); for (let i = 0; i < nP; i++) parts.push(newPart(1, g));
    }
    function newPart(t, g, fromX, fromY) {
      return { x: fromX ?? g.x0 + 12 + Math.random() * (g.x1 - g.x0 - 24), y: fromY ?? g.y0 + 12 + Math.random() * (g.y1 - g.y0 - 24), vx: (Math.random() - .5) * 26, vy: (Math.random() - .5) * 26, t, mode: fromX == null ? "cell" : "enter", fl: 0, life: 1 };
    }
    let accIn = 0, accOut = 0, accV = 0;
    function moveParts(dt) {
      const g = geo(); const d = deriv(X.S, X.Pp);
      accIn += d.Jin * NMAX * dt * 1.0; accOut += d.Jout * NMAX * dt * 1.0; accV += d.v * NMAX * dt * 1.0;
      while (accIn >= 1) { accIn--; parts.push(newPart(0, g, g.x0 - 18, g.cy + (Math.random() - .5) * 18)); }
      while (accIn <= -1) { accIn++; const i = parts.findIndex(p => p.t === 0 && p.mode === "cell"); if (i >= 0) parts[i].mode = "exitL"; }
      while (accOut >= 1) { accOut--; const i = parts.findIndex(p => p.t === 1 && p.mode === "cell"); if (i >= 0) parts[i].mode = "exitR"; }
      while (accV >= 1) { accV--; const i = parts.findIndex(p => p.t === 0 && p.mode === "cell"); if (i >= 0) { parts[i].t = 1; parts[i].fl = 1; if (!P.closed || true) heat.push({ x: parts[i].x, y: parts[i].y, a: Math.random() * 6.28, life: 1 }); } }
      while (accV <= -1) { accV++; const i = parts.findIndex(p => p.t === 1 && p.mode === "cell"); if (i >= 0) { parts[i].t = 0; parts[i].fl = .6; } }
      // підгонка кількості до концентрацій
      const cnt = [0, 0]; for (const p of parts) if (p.mode === "cell" || p.mode === "enter") cnt[p.t]++;
      const tg = [Math.round(X.S * NMAX), Math.round(X.Pp * NMAX)];
      for (const t of [0, 1]) {
        if (cnt[t] < tg[t] - 2) parts.push(newPart(t, g));
        else if (cnt[t] > tg[t] + 2) { const i = parts.findIndex(p => p.t === t && p.mode === "cell"); if (i >= 0) parts.splice(i, 1); }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (p.mode === "enter") { p.x += (g.x0 + 34 - p.x) * Math.min(1, dt * 3) + p.vx * dt * .2; p.y += (g.cy - p.y) * Math.min(1, dt * 1.2) * .3 + p.vy * dt * .3; if (p.x > g.x0 + 24) p.mode = "cell"; continue; }
        if (p.mode === "exitL") { p.x += (g.x0 - 40 - p.x) * dt * 2.4; p.y += (g.cy - p.y) * dt * 2.4; p.life -= dt * 1.4; if (p.life <= 0) parts.splice(i, 1); continue; }
        if (p.mode === "exitR") { const tx = g.x1 + 40; p.x += (tx - p.x) * dt * 2.4; p.y += (g.cy - p.y) * dt * 2.4; p.life -= dt * 1.4; if (p.life <= 0) parts.splice(i, 1); continue; }
        p.vx += (Math.random() - .5) * 90 * dt; p.vy += (Math.random() - .5) * 90 * dt;
        const sp = Math.hypot(p.vx, p.vy), mx = 34; if (sp > mx) { p.vx *= mx / sp; p.vy *= mx / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.fl = Math.max(0, p.fl - dt * 1.6);
        if (p.x < g.x0 + 8) { p.x = g.x0 + 8; p.vx = Math.abs(p.vx); } if (p.x > g.x1 - 8) { p.x = g.x1 - 8; p.vx = -Math.abs(p.vx); }
        if (p.y < g.y0 + 8) { p.y = g.y0 + 8; p.vy = Math.abs(p.vy); } if (p.y > g.y1 - 8) { p.y = g.y1 - 8; p.vy = -Math.abs(p.vy); }
      }
      for (let i = heat.length - 1; i >= 0; i--) { const q = heat[i]; q.x += Math.cos(q.a) * 22 * dt + 26 * dt; q.y += Math.sin(q.a) * 22 * dt; q.life -= dt * .5; if (q.life <= 0) heat.splice(i, 1); }
      // середовище
      for (const b of bath) {
        const left = b.t === 0, lo = left ? 4 : g.x1 + 12, hi = left ? g.x0 - 12 : g.W - 4;
        b.x += b.vx * dt; b.y += b.vy * dt; b.vx += (Math.random() - .5) * 40 * dt; b.vy += (Math.random() - .5) * 40 * dt;
        if (b.x < lo) { b.x = lo; b.vx = Math.abs(b.vx); } if (b.x > hi) { b.x = hi; b.vx = -Math.abs(b.vx); } if (b.y < 4) { b.y = 4; b.vy = Math.abs(b.vy); } if (b.y > g.H - 4) { b.y = g.H - 4; b.vy = -Math.abs(b.vy); }
      }
    }
    function membrane(c, g, t) {
      const x0 = g.x0, x1 = g.x1, y0 = g.y0, y1 = g.y1, R = 16, pts = [];
      const per = [[x0 + R, y0, 1, 0, 0, -1], [x1 - R, y0, 1, 0, 0, -1], [x1, y0 + R, 0, 1, 1, 0], [x1, y1 - R, 0, 1, 1, 0], [x1 - R, y1, -1, 0, 0, 1], [x0 + R, y1, -1, 0, 0, 1], [x0, y1 - R, 0, -1, -1, 0], [x0, y0 + R, 0, -1, -1, 0]];
      const sides = [[x0 + R, y0, x1 - R, y0, 0, -1], [x1, y0 + R, x1, y1 - R, 1, 0], [x1 - R, y1, x0 + R, y1, 0, 1], [x0, y1 - R, x0, y0 + R, -1, 0]];
      const corners = [[x1 - R, y0 + R, -Math.PI / 2, 0], [x1 - R, y1 - R, 0, Math.PI / 2], [x0 + R, y1 - R, Math.PI / 2, Math.PI], [x0 + R, y0 + R, Math.PI, Math.PI * 1.5]];
      const place = (px, py, nx, ny, i) => pts.push([px, py, nx, ny, i]);
      let i = 0;
      for (let s = 0; s < 4; s++) {
        const [ax, ay, bx, by, nx, ny] = sides[s]; const L = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.round(L / 8));
        for (let k = 0; k <= n; k++) place(lerp(ax, bx, k / n), lerp(ay, by, k / n), nx, ny, i++);
        const [cx, cy, a0, a1] = corners[s];
        for (let k = 1; k < 4; k++) { const a = lerp(a0, a1, k / 4); place(cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.cos(a), Math.sin(a), i++); }
      }
      c.lineCap = "round";
      for (const [px, py, nx, ny, k] of pts) {
        const j = Math.sin(t * 1.4 + k * 1.3) * .8;
        for (const sd of [1, -1]) {
          const hx = px + nx * (5 + j) * sd, hy = py + ny * (5 + j) * sd;
          c.strokeStyle = "rgba(190,150,60,.8)"; c.lineWidth = 1.2;
          for (const o of [-2, 2]) { c.beginPath(); c.moveTo(hx - ny * o, hy + nx * o); c.lineTo(px - ny * o * 1.1 + nx * (.5) * sd, py + nx * o * 1.1 + ny * .5 * sd); c.stroke(); }
          Gfx.sphere(c, hx, hy, 3.3, "#E0B341");
        }
      }
    }
    function drawA(time) {
      const c = stA.ctx, g = geo(), T = Theme.c, W = g.W, H = g.H; c.clearRect(0, 0, W, H);
      // середовище
      const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, Theme.dark ? "#16303f" : "#DCEBF5"); bg.addColorStop(1, Theme.dark ? "#10242f" : "#C9E0EF"); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      const rr = rng(3); for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${.04 + rr() * .06})`; c.beginPath(); c.arc(rr() * W, rr() * H, 4 + rr() * 16, 0, 7); c.fill(); }
      // цитоплазма
      Gfx.rr(c, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, 16);
      const cg = c.createLinearGradient(0, g.y0, 0, g.y1); cg.addColorStop(0, Theme.dark ? "#2d4a2f" : "#EAF3D8"); cg.addColorStop(1, Theme.dark ? "#26402a" : "#DCEBC4"); c.fillStyle = cg; c.fill();
      c.save(); Gfx.rr(c, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, 16); c.clip();
      const gr = rng(11); for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${gr() < .5 ? "255,255,255" : "60,90,40"},${.05 + gr() * .07})`; c.beginPath(); c.arc(g.x0 + gr() * (g.x1 - g.x0), g.y0 + gr() * (g.y1 - g.y0), .8 + gr() * 2.4, 0, 7); c.fill(); }
      // тепловий серпанок
      for (const q of heat) { c.strokeStyle = `rgba(224,98,58,${q.life * .7})`; c.lineWidth = 1.6; c.beginPath(); for (let k = 0; k < 8; k++) { const xx = q.x + k * 3.2, yy = q.y + Math.sin(k * 1.1 + time * 6 + q.a) * 3; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }
      for (const p of parts) {
        if (p.mode !== "cell" && p.mode !== "enter") continue;
        if (p.fl > 0) Gfx.glow(c, p.x, p.y, 16 * p.fl + 4, COL.heat, .55 * p.fl);
        Gfx.sphere(c, p.x, p.y, 5, p.t ? COL.P : COL.S);
      }
      c.restore();
      membrane(c, g, time);
      // перенесення назовні/досередини (проходять крізь мембрану)
      for (const p of parts) if (p.mode === "exitL" || p.mode === "exitR" || (p.mode === "enter" && p.x < g.x0 + 12)) { c.globalAlpha = clamp(p.life, .15, 1); Gfx.sphere(c, p.x, p.y, 5, p.t ? COL.P : COL.S); c.globalAlpha = 1; }
      // канали: ліворуч — вхід S; праворуч — вихід P
      const open = P.closed ? 0 : clamp(P.perm, .05, 1);
      for (const [x, col] of [[g.x0, COL.S], [g.x1, COL.P]]) {
        c.save(); c.translate(x, g.cy); c.rotate(Math.PI / 2); Gfx.channel(c, 0, 0, 11, 24, open, mixc("#8B7BB5", col, .25), { gate: P.closed, gateCol: "#B3363A" }); c.restore();
        if (P.closed) { c.fillStyle = "#B3363A"; Gfx.rr(c, x - 3, g.cy - 12, 6, 24, 2); c.fill(); }
      }
      for (const b of bath) Gfx.sphere(c, b.x, b.y, 4.2, b.t ? COL.P : COL.S, { a: .9 });
      // потоки (стрілки)
      const d = deriv(X.S, X.Pp), arw = (v) => clamp(v * 8 + 1.5, 1.5, 7);
      if (!P.closed) {
        Gfx.arrow(c, g.x0 - 64, g.cy - 40, g.x0 - 14, g.cy - 40, { col: COL.S, w: arw(Math.max(0, d.Jin)), head: 11 });
        Gfx.arrow(c, g.x1 + 14, g.cy - 40, g.x1 + 64, g.cy - 40, { col: COL.P, w: arw(Math.max(0, d.Jout)), head: 11 });
        Gfx.chip(c, "J вхід " + NA(d.Jin, 2), g.x0 - 38, g.cy - 58, { align: "center", size: 10.5, fg: "#8A6410" });
        Gfx.chip(c, "J вихід " + NA(d.Jout, 2), g.x1 + 38, g.cy - 58, { align: "center", size: 10.5, fg: "#2C7A4D" });
      }
      // потік ентропії/тепла назовні
      if (X.sigma > 0.01) { const w = clamp(X.sigma * 10, 1.5, 9); Gfx.arrow(c, (g.x0 + g.x1) / 2 + 40, g.y0 - 6, (g.x0 + g.x1) / 2 + 40, g.y0 - 34, { col: COL.heat, w, head: 11, dash: [6, 4] }); Gfx.chip(c, "dₑS/dt < 0: ентропія виноситься", (g.x0 + g.x1) / 2 + 52, g.y0 - 22, { size: 10.5, fg: "#B8481A" }); }
      Gfx.chip(c, "Зовнішнє середовище: S", 10, 42, { size: 10.5, fg: "#8A6410" }); Gfx.chip(c, "P (стік)", W - 10, 14, { size: 10.5, fg: "#2C7A4D", align: "right" });
      Gfx.chip(c, `Клітина · S ${NA(X.S, 2)} · P ${NA(X.Pp, 2)}`, (g.x0 + g.x1) / 2, g.y1 + 20, { align: "center", size: 11 });
      // стан
      const flux = Math.abs(d.Jin) + Math.abs(d.Jout) + Math.abs(d.v);
      const eq = flux < 0.012, ss = !eq && Math.abs(X.dS) < 0.012 && Math.abs(d.dS) < 0.006 && Math.abs(d.dP) < 0.006;
      const lab = eq ? "ТЕРМОДИНАМІЧНА РІВНОВАГА" : ss ? "СТАЦІОНАРНИЙ СТАН" : "ПЕРЕХІДНИЙ ПРОЦЕС";
      c.font = `700 11px ${FM()}`; const lw = c.measureText(lab).width + 18;
      Gfx.rr(c, W / 2 - lw / 2, H - 30, lw, 22, 11); c.fillStyle = eq ? "#B3363A" : ss ? "#2C7A4D" : "#C77A12"; c.fill();
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(lab, W / 2, H - 19);
      rdA.set("st", eq ? "рівновага" : ss ? "стаціонарний" : "перехідний");
    }
    // елементи керування A
    const rdA = UI.reads(A.st, [["st", "Стан системи"], ["sg", "σ = dᵢS/dt, R/с"], ["fl", "Потік J"], ["gg", "G/RT"]]);
    UI.seg(A.ct, { label: "Мембрана", value: "open", options: [["open", "Відкрита система"], ["closed", "Без обміну речовиною"]], on: v => { P.closed = v === "closed"; resetA(); } });
    UI.slider(A.ct, { id: "p1-s", label: "S у середовищі", min: .2, max: 1.6, step: .05, value: P.Sout, on: v => P.Sout = v, fmt: v => NA(v, 2) });
    UI.slider(A.ct, { id: "p1-p", label: "Проникність мембрани", min: .1, max: 1, step: .05, value: P.perm, on: v => P.perm = v, fmt: v => NA(v, 2) });
    UI.slider(A.ct, { id: "p1-k", label: "Швидкість реакції k", min: .2, max: 3, step: .1, value: P.kf, on: v => P.kf = v, fmt: v => NA(v, 1) });
    UI.slider(A.ct, { id: "p1-K", label: "ln K (спорідненість)", min: 1, max: 5, step: .5, value: P.lnK, on: v => P.lnK = v, fmt: v => NA(v, 1) });
    UI.check(A.ct, { id: "p1-x", label: "Отруїти клітину (k → 0, метаболізм зупинено)", value: false, on: v => { P.poison = v; } });
    UI.buttons(A.ct, [{ label: "Збурити: +S усередину", on: () => { X.S += .5; } }, { label: "Почати спочатку", pri: true, on: () => resetA() }]);
    UI.tip(A.ct, "Відкрита система виходить на <b>стаціонарний стан</b>: потоки не нульові, σ > 0, а градієнти сталі. Закрийте мембрану або отруїть клітину — система скотиться до <b>рівноваги</b> (σ → 0, потоків немає).");

    const chA = h("div", { class: "charts" }); A.bl.append(chA);
    const c1 = UI.chart(chA, "Концентрації в клітині: S (бурштин), P (зелений)");
    const c2 = UI.chart(chA, "Вільна енергія G/RT (пунктир — мінімум для тієї ж кількості речовини)");
    const c3 = UI.chart(chA, "Баланс ентропії: dᵢS/dt, dₑS/dt, dS/dt (в одиницях R/с)");
    function chartsA() {
      const H = X.hist, t1 = Math.max(60, X.t), x0 = Math.max(0, t1 - 80);
      drawChart(c1, { x: [x0, x0 + 80], y: [0, 1.6], xl: "t, с", series: [{ pts: H.map(r => [r[0], r[1]]), color: COL.S, w: 2.4 }, { pts: H.map(r => [r[0], r[2]]), color: COL.P, w: 2.4 }], hl: [{ y: P.Sout, color: COL.S, label: "S зовні" }] });
      const gs = H.map(r => r[3]), gmin = Math.min(...gs, -3, ...H.map(r => r[4])) - .2, gmax = Math.max(...gs, 0.2) + .2;
      drawChart(c2, { x: [x0, x0 + 80], y: [gmin, gmax], xl: "t, с", series: [{ pts: H.map(r => [r[0], r[3]]), color: "#2A6A93", w: 2.4 }, { pts: H.map(r => [r[0], r[4]]), color: T().muted, w: 1.6, dash: [5, 4] }] });
      const ys = H.flatMap(r => [r[5], r[6], r[7]]); const ym = Math.max(1, ...ys.map(Math.abs)) * 1.1;
      drawChart(c3, { x: [x0, x0 + 80], y: [-ym, ym], xl: "t, с", series: [{ pts: H.map(r => [r[0], r[5]]), color: COL.heat, w: 2.4 }, { pts: H.map(r => [r[0], r[6]]), color: "#2A6A93", w: 2.4 }, { pts: H.map(r => [r[0], r[7]]), color: T().ink, w: 1.8, dash: [3, 3] }], hl: [{ y: 0, color: T().muted, dash: [2, 3] }], legend: [{ label: "dᵢS/dt", color: COL.heat }, { label: "dₑS/dt", color: "#2A6A93" }, { label: "dS/dt", color: T().ink }] });
    }
    const T = () => Theme.c;

    /* ================== РЕЖИМ B: μ̃ для Na⁺ ================== */
    const Q = { cin: 20, cout: 200, T: 37, pin: -60, pout: 0 };
    const F = 96485.309, Rg = 8.31;
    const stB = new Stage(B.st, { aspect: 1.9, minH: 300, maxH: 440, tag: "Na⁺ через плазматичну мембрану" });
    const calc = (po) => { const Tk = Q.T + 273.15, Aos = Rg * Tk * Math.log(Q.cout / Q.cin), Ael = 1 * F * (po - Q.pin) / 1000; return { Aos, Ael, mu: Aos + Ael, E: Rg * Tk / F * Math.log(Q.cout / Q.cin) * 1000 }; };
    const rdB = UI.reads(B.st, [["os", "A осмотична, Дж/моль"], ["el", "A електрична, Дж/моль"], ["mu", "Δμ̃ назовні, кДж/моль"], ["EN", "Потенціал Нернста E(Na⁺)"]]);
    UI.slider(B.ct, { id: "p1b-ci", label: "[Na⁺] у клітині", min: 5, max: 150, step: 1, value: Q.cin, unit: "мМ", on: v => Q.cin = v });
    UI.slider(B.ct, { id: "p1b-co", label: "[Na⁺] зовні", min: 20, max: 300, step: 5, value: Q.cout, unit: "мМ", on: v => Q.cout = v });
    UI.slider(B.ct, { id: "p1b-T", label: "Температура", min: 5, max: 45, step: 1, value: Q.T, unit: "°C", on: v => Q.T = v });
    UI.slider(B.ct, { id: "p1b-pi", label: "φ всередині", min: -120, max: 0, step: 1, value: Q.pin, unit: "мВ", on: v => Q.pin = v });
    UI.slider(B.ct, { id: "p1b-po", label: "φ ззовні", min: 0, max: 40, step: 1, value: Q.pout, unit: "мВ", on: v => Q.pout = v });
    UI.tip(B.ct, "У методичці: <b>c₁ = 0,020 М, c₂ = 0,20 М, T = 37 °C, φ₁ = −60 мВ</b>; φ₂ = 0; 15; 20 мВ. Це початкові значення повзунків.");
    const tb = h("div", { class: "tblwrap" }); B.bl.append(h("div", { class: "chart" }, h("h4", null, "Перенесення 1 моль Na⁺ назовні: три випадки з методички"), tb));
    const chB = UI.chart(B.bl, "Складові Δμ̃ (кДж/моль) для різних φ ззовні");
    function tableB() {
      const rows = [0, 15, 20].map(po => { const r = calc(po); return `<tr><td class="n">${po} мВ</td><td class="n">${NA(r.Aos, 0)}</td><td class="n">${NA(r.Ael, 0)}</td><td class="n"><b>${NA(r.mu / 1000, 2)}</b></td></tr>`; }).join("");
      UI.html(tb, `<table class="t"><thead><tr><th>φ₂</th><th>A осм., Дж/моль</th><th>A ел., Дж/моль</th><th>Δμ̃, кДж/моль</th></tr></thead><tbody>${rows}</tbody></table>`);
    }
    function drawB(time) {
      const c = stB.ctx, W = stB.W, H = stB.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      const my = H * .5, mx1 = Math.round(W * .6), r = calc(Q.pout), gap = 24, pumpX = mx1 * .42;
      c.fillStyle = T0.sheet; c.fillRect(0, 0, W, H);
      /* ---- сцена: зовні (вище), всередині (нижче) ---- */
      c.save(); c.beginPath(); c.rect(0, 0, mx1, H); c.clip();
      const o = c.createLinearGradient(0, 0, 0, my); o.addColorStop(0, Theme.dark ? "#16303f" : "#D9EAF6"); o.addColorStop(1, Theme.dark ? "#1b3b4d" : "#C4DDEE"); c.fillStyle = o; c.fillRect(0, 0, mx1, my);
      const ii = c.createLinearGradient(0, my, 0, H); ii.addColorStop(0, Theme.dark ? "#2b4430" : "#E4EFD2"); ii.addColorStop(1, Theme.dark ? "#223a29" : "#D6E7BC"); c.fillStyle = ii; c.fillRect(0, my, mx1, H - my);
      const rb = rng(21); for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(255,255,255,${.04 + rb() * .06})`; c.beginPath(); c.arc(rb() * mx1, rb() * H, 5 + rb() * 18, 0, 7); c.fill(); }
      Gfx.bilayer(c, 0, mx1, my, gap, time, { s: 1.15 });
      // іони (положення стабільні, коливаються навколо власного центру)
      const rr = rng(7), nOut = Math.round(clamp(Q.cout / 6, 3, 50)), nIn = Math.round(clamp(Q.cin / 3, 3, 50));
      for (let i = 0; i < nOut; i++) { const x = 12 + rr() * (mx1 - 24), y = rr() * (my - gap / 2 - 36) + 22, ph = rr() * 6; Gfx.sphere(c, x + Math.sin(time * .9 + ph) * 6, y + Math.cos(time * .7 + ph) * 5, 5.2, COL.ion); }
      for (let i = 0; i < nIn; i++) { const x = 12 + rr() * (mx1 - 24), y = my + gap / 2 + 18 + rr() * (H - my - gap / 2 - 44), ph = rr() * 6; Gfx.sphere(c, x + Math.sin(time * .9 + ph) * 6, y + Math.cos(time * .7 + ph) * 5, 5.2, COL.ion); }
      // заряди біля мембрани
      const sgIn = clamp(-Q.pin / 120, 0, 1), sgOut = clamp(Q.pout / 40, 0, 1);
      c.font = `700 14px ${FM()}`; c.textAlign = "center"; c.textBaseline = "middle";
      for (let x = 14; x < mx1; x += 26) {
        c.fillStyle = `rgba(179,54,58,${.25 + .65 * sgIn})`; c.fillText("−", x, my + gap / 2 + 10);
        c.fillStyle = `rgba(42,106,147,${.2 + .6 * Math.max(sgIn, sgOut)})`; c.fillText("+", x + 13, my - gap / 2 - 10);
      }
      // насос, стрілка переносу, підписи
      Gfx.channel(c, pumpX, my, gap, 46, .3 + .3 * Math.sin(time * 2), "#8B7BB5");
      Gfx.chip(c, "Na⁺/K⁺-АТФаза", pumpX, my - gap / 2 - 36, { align: "center", size: 10.5 });
      const ax = pumpX + 46; Gfx.arrow(c, ax, my + 56, ax, my - 56, { col: "#B8481A", w: 4, head: 11 });
      Gfx.chip(c, "Na⁺ назовні", ax + 12, my, { size: 10.5, fg: "#8A3A10" });
      Gfx.chip(c, "ЗОВНІ · c₂ = " + NA(Q.cout, 0) + " мМ", mx1 - 10, 16, { align: "right", size: 10.5 });
      Gfx.chip(c, "ВСЕРЕДИНІ · c₁ = " + NA(Q.cin, 0) + " мМ", mx1 - 10, H - 16, { align: "right", size: 10.5 });
      c.restore();
      /* ---- права картка з енергетикою ---- */
      const cx0 = mx1 + 14, cw = W - cx0 - 10, ch = H - 20, px = cx0 + 16, pw = cw - 32, atp = 50000, mxE = Math.max(atp, r.mu) * 1.04;
      Gfx.rr(c, cx0, 10, cw, ch, 12); c.fillStyle = Theme.dark ? "rgba(255,255,255,.04)" : "#FFFFFF"; c.fill(); c.strokeStyle = T0.rule; c.lineWidth = 1; c.stroke();
      let y = 34;
      Gfx.text(c, "Енергія переносу 1 моль Na⁺ назовні", px, y, { size: 12, color: T0.ink, weight: 700 }); y += 16;
      const bar = (v0, v1, col, yy) => { const a = px + v0 / mxE * pw, bb = px + v1 / mxE * pw; if (bb - a < .5) return; const g2 = c.createLinearGradient(0, yy, 0, yy + 28); g2.addColorStop(0, shade(col, .25)); g2.addColorStop(1, shade(col, -.2)); c.fillStyle = g2; c.fillRect(a, yy, bb - a, 28); };
      c.fillStyle = alpha("#888888", .12); c.fillRect(px, y, pw, 28);
      bar(0, r.Aos, "#2A6A93", y); bar(r.Aos, r.Aos + r.Ael, "#B3363A", y);
      Gfx.text(c, "Δμ̃ = " + NA(r.mu / 1000, 2) + " кДж/моль", px, y + 48, { size: 14, color: T0.ink, weight: 700 });
      // легенда
      const lg = (x2, y2, col, t2) => { c.fillStyle = col; Gfx.rr(c, x2, y2 - 5, 10, 10, 2); c.fill(); Gfx.text(c, t2, x2 + 15, y2, { size: 11, color: T0.ink, base: "middle" }); };
      lg(px, y + 70, "#2A6A93", "A осм. = " + NA(r.Aos / 1000, 2) + " кДж"); lg(px, y + 88, "#B3363A", "A ел. = " + NA(r.Ael / 1000, 2) + " кДж");
      y += 118;
      Gfx.text(c, "Для порівняння: 1 моль АТФ ≈ 50 кДж", px, y, { size: 11, color: T0.muted }); y += 12;
      bar(0, atp, "#C77A12", y + 2); Gfx.text(c, "АТФ ≈ 50 кДж", px + 8, y + 16, { size: 11, color: "#fff", weight: 700, base: "middle" }); y += 52;
      Gfx.text(c, `≈ ${NA(atp / Math.max(1, r.mu), 1)} моль Na⁺ на 1 моль АТФ`, px, y, { size: 12, color: T0.ink, weight: 600 }); y += 24;
      Gfx.text(c, `E(Na⁺) = ${NA(r.E, 1)} мВ (потенціал Нернста)`, px, y, { size: 11, color: T0.muted }); y += 17;
      Gfx.text(c, `Рушійна сила входу: V − E = ${NA(Q.pin - r.E, 0)} мВ`, px, y, { size: 11, color: T0.muted });
      rdB.set("os", NA(r.Aos, 0)); rdB.set("el", NA(r.Ael, 0)); rdB.set("mu", NA(r.mu / 1000, 2)); rdB.set("EN", NA(r.E, 1), "мВ");
      tableB();
      const cs = [0, 5, 10, 15, 20, 30, 40].map(po => { const q = calc(po); return [po, q.Aos / 1000, q.Ael / 1000]; });
      drawChart(chB, { x: [0, 40], y: [0, 20], xl: "φ зовні, мВ", yl: "кДж/моль", series: [{ pts: cs.map(r2 => [r2[0], r2[1]]), color: "#2A6A93", w: 2.4 }, { pts: cs.map(r2 => [r2[0], r2[1] + r2[2]]), color: "#B3363A", w: 2.6 }], marks: [{ x: Q.pout, y: (r.Aos + r.Ael) / 1000, color: "#B3363A", label: "Δμ̃ зараз" }], legend: [{ label: "A осм.", color: "#2A6A93" }, { label: "Δμ̃ = A осм. + A ел.", color: "#B3363A" }] });
    }

    resetA(); M.init();
    let tmr = 0;
    return {
      stages: [stA, stB, c1, c2, c3, chB],
      frame(dt, t) {
        if (mode === "a") { if (dt > 0) { step(dt * 3); moveParts(dt); } drawA(t); chartsA();
          rdA.set("sg", NA(X.sigma, 3)); rdA.set("fl", NA(X.J, 3)); rdA.set("gg", NA(X.G, 2)); }
        else drawB(t);
      },
    };
  },
});

})();
