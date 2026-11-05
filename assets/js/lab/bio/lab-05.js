// ПЗ 5: теорія, модель, питання (код згенеровано з вихідних файлів).
(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb } = window.BIO;
/* ПЗ 5. Маркерні ферменти: диференційне центрифугування, метод Фіске–Суббароу */
App.def(5, {
  cheat: "<p class=\"lead\">Щоб вивчати окремі органели чи мембрани, їх треба виділити з клітини, а потім довести, що препарат чистий. Для цього використовують <b>маркерні ферменти</b> — «молекулярні паспорти» органел. Ця тема показує, як за активністю таких ферментів впізнають мембранні фракції та як вимірюють активність за кількістю відщепленого неорганічного фосфату.</p><h3>Маркерні ферменти</h3><p><b>Маркерний фермент або хімічний компонент</b> — це компонент, який присутній практично лише в складі певного типу органел. Тому він слугує індикатором наявності чи відсутності фракції тих органел, до складу яких належить. Локалізацію ферменту in situ часто вдається встановити гістохімічно: тонкі (2–10 мкм) зрізи замороженої тканини обробляють розчином субстрату, специфічного до цього ферменту, і в місцях його розташування утворюється забарвлений продукт реакції.</p><p>Більшість ферментів має внутрішньоклітинну локалізацію й нерівномірний розподіл. Ферменти одного метаболічного шляху, як правило, зосереджені в одному компартменті; особливо важливий поділ шляхів на <b>анаболічні</b> та <b>катаболічні</b>, що мають протилежну спрямованість.</p><div class=\"tblwrap\"><table class=\"t bt \"><thead><tr><th>Фермент</th><th>Субклітинна фракція</th></tr></thead><tbody><tr><td>ДНК-полімераза</td><td>ядро</td></tr><tr><td>Сукцинатдегідрогеназа, цитохромоксидаза</td><td>мітохондрії</td></tr><tr><td>Глюкозо-6-фосфатаза</td><td>ендоплазматичний ретикулум</td></tr><tr><td>Кисла фосфатаза, рибонуклеаза</td><td>лізосоми</td></tr><tr><td>Каталаза, уратоксидаза</td><td>пероксисоми</td></tr><tr><td>5′-Нуклеотидаза</td><td>плазматична мембрана</td></tr><tr><td>Глюкозо-6-фосфатдегідрогеназа, лактатдегідрогеназа, фосфофруктокіназа</td><td>цитозоль</td></tr></tbody></table></div><div class=\"bf-gal bf-gal--3\"><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/mitoem2.webp\" data-lightbox data-caption=\"Будова мітохондрії: зовнішня й внутрішня мембрани (кристи) мають різні маркерні ферменти. Фото: Original uploader was Carmmann (talk) at en.wikipedia, Wikimedia Commons · Public domain\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/mitoem2.webp\" alt=\"Будова мітохондрії: зовнішня й внутрішня мембрани (кристи) мають різні маркерні ферменти.\" width=\"618\" height=\"409\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Будова мітохондрії: зовнішня й внутрішня мембрани (кристи) мають різні маркерні ферменти.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:MitochondrionCAM.jpg\" target=\"_blank\" rel=\"noopener\">Original uploader was Carmmann (talk) at en.wikipedia</a> · Public domain</span></figcaption></figure><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/er.webp\" data-lightbox data-caption=\"Ендоплазматичний ретикулум (шорсткий і гладкий) — маркер: глюкозо-6-фосфатаза. Фото: OpenStax, Wikimedia Commons · CC BY 3.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/er.webp\" alt=\"Ендоплазматичний ретикулум (шорсткий і гладкий) — маркер: глюкозо-6-фосфатаза.\" width=\"604\" height=\"362\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Ендоплазматичний ретикулум (шорсткий і гладкий) — маркер: глюкозо-6-фосфатаза.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:0313_Endoplasmic_Reticulum_a_en.png\" target=\"_blank\" rel=\"noopener\">OpenStax</a> · CC BY 3.0</span></figcaption></figure><figure class=\"bf \"><a href=\"../../assets/img/bio/golgi.webp\" data-lightbox data-caption=\"Апарат Гольджі: стоси цистерн, маркер — глікозилтрансферази. Фото: OpenStax, Wikimedia Commons · CC BY 3.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/golgi.webp\" alt=\"Апарат Гольджі: стоси цистерн, маркер — глікозилтрансферази.\" width=\"521\" height=\"435\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Апарат Гольджі: стоси цистерн, маркер — глікозилтрансферази.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:0314_Golgi_Apparatus_b_en.png\" target=\"_blank\" rel=\"noopener\">OpenStax</a> · CC BY 3.0</span></figcaption></figure></div><h4>Критерії маркерного ферменту</h4><ul><li>міцно зв’язаний з даною мембраною або органелою;</li><li>під час розділення фракцій не активується й не інгібується;</li><li>локалізований виключно в цьому типі мембран.</li></ul><p>На практиці для чіткого контролю чистоти визначають активність <b>двох–трьох</b> маркерів для кожного типу мембран; набір маркерів залежить від типу клітин. Саме тому активність маркерів використовують, щоб оцінити чистоту мембранних препаратів: частка маркера «чужої» органели у фракції показує забруднення.</p><div class=\"bcall bcall--note\"><b>Метаболон</b><p><b>Метаболон</b> — тимчасовий структурно-функціональний комплекс послідовних ферментів одного метаболічного шляху, зібраний на спільній основі (мембрані, цитоскелеті) або через білок-білкові контакти. Субстрат передається від ферменту до ферменту без виходу в об’єм цитозолю (метаболічна «канал»-передача), що підвищує швидкість і захищає нестійкі проміжні продукти. Збирання відбувається за принципами комплементарності поверхонь білків, взаємодії з мембранними якорями та регуляторними лігандами.</p></div><h3>Виділення фракцій: диференційне центрифугування</h3><p>Клітини руйнують м’яко (гомогенізація в ізотонічному буфері із сахарозою), а потім послідовно центрифугують зі зростаючим прискоренням. Спочатку осідають великі й щільні частинки, потім дрібніші:</p><div class=\"tblwrap\"><table class=\"t bt \"><thead><tr><th>Етап</th><th>Приблизно</th><th>Осад</th></tr></thead><tbody><tr><td>1</td><td>600–1000 g, 10 хв</td><td>ядра, неруйновані клітини, фрагменти стінок</td></tr><tr><td>2</td><td>10 000 g, 20 хв</td><td>мітохондрії, пероксисоми, лізосоми (у рослин — і хлоропласти раніше)</td></tr><tr><td>3</td><td>100 000 g, 60 хв</td><td>мікросоми: везикули ЕПР, Гольджі, плазмалеми</td></tr><tr><td>надосадок</td><td>—</td><td>цитозоль (розчинні ферменти)</td></tr></tbody></table></div><p>Швидкість осідання частинки радіуса <var>r</var> і густини <var>ρ</var> у середовищі з густиною <var>ρ</var><sub>0</sub> і в’язкістю <var>η</var> задає закон Стокса:</p><div class=\"eq\"><var>v</var> = <span class=\"fr\"><span>2<var>r</var><sup>2</sup>(<var>ρ</var> − <var>ρ</var><sub>0</sub>)</span><span>9<var>η</var></span></span>·<var>ω</var><sup>2</sup><var>R</var><span class=c>ω²R = a — відцентрове прискорення; відносне відцентрове прискорення RCF = ω²R/g</span></div><p>Фракції ніколи не бувають ідеально чистими: дрібні органели частково осідають уже на ранніх етапах, а в осад потрапляє трохи надосадку. Тому для кожної фракції визначають ферменти-маркери й порівнюють їх активність.</p><div class=\"bf-gal bf-gal--3\"><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/centrif.webp\" data-lightbox data-caption=\"Принцип диференційного центрифугування: послідовне осадження ядер, мітохондрій, мікросом. Фото: Thomasione, Wikimedia Commons · Public domain\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/centrif.webp\" alt=\"Принцип диференційного центрифугування: послідовне осадження ядер, мітохондрій, мікросом.\" width=\"1000\" height=\"600\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Принцип диференційного центрифугування: послідовне осадження ядер, мітохондрій, мікросом.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Differentielle_zentrifugation.png\" target=\"_blank\" rel=\"noopener\">Thomasione</a> · Public domain</span></figcaption></figure><figure class=\"bf \"><a href=\"../../assets/img/bio/ultracentrifuge.webp\" data-lightbox data-caption=\"Ультрацентрифуга, що дає прискорення в сотні тисяч g. Фото: Matylda Sęk, Wikimedia Commons · CC BY-SA 3.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/ultracentrifuge.webp\" alt=\"Ультрацентрифуга, що дає прискорення в сотні тисяч g.\" width=\"847\" height=\"1000\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Ультрацентрифуга, що дає прискорення в сотні тисяч g.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Beckman-Coulter_ultracentrifuge_XL-100K_-01.jpg\" target=\"_blank\" rel=\"noopener\">Matylda Sęk</a> · CC BY-SA 3.0</span></figcaption></figure><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/pellet.webp\" data-lightbox data-caption=\"Осад (пелета) і надосадок у пробірці після центрифугування. Фото: Ultrabem, Wikimedia Commons · CC0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/pellet.webp\" alt=\"Осад (пелета) і надосадок у пробірці після центрифугування.\" width=\"746\" height=\"712\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Осад (пелета) і надосадок у пробірці після центрифугування.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:How_centrifuge_works.png\" target=\"_blank\" rel=\"noopener\">Ultrabem</a> · CC0</span></figcaption></figure></div><h3>Лабораторна робота: неорганічний фосфор за Фіске–Суббароу</h3><p>Активність мембранних АТФаз (Na⁺,K⁺-АТФаза, Ca²⁺,Mg²⁺-АТФаза) і 5′-нуклеотидази визначають за кількістю <b>неорганічного фосфату (Фн)</b>, який вони відщеплюють від субстрату (АТФ, АМФ). Фн кількісно визначають спектрофотометрично за методом Фіске–Суббароу: з молібденовою кислотою він утворює фосфомолібдат, що відновлюється аскорбатом до сполуки синього кольору (<b>молібденова синь</b>). Інтенсивність забарвлення пропорційна кількості Фн.</p><div class=\"bf-gal bf-gal--3\"><figure class=\"bf \"><a href=\"../../assets/img/bio/spectro.webp\" data-lightbox data-caption=\"Спектрофотометр: прилад для вимірювання оптичної густини розчинів на заданій довжині хвилі. Фото: Skorpion87, Wikimedia Commons · Public domain\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/spectro.webp\" alt=\"Спектрофотометр: прилад для вимірювання оптичної густини розчинів на заданій довжині хвилі.\" width=\"1000\" height=\"732\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Спектрофотометр: прилад для вимірювання оптичної густини розчинів на заданій довжині хвилі.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Spektrofotometri.jpg\" target=\"_blank\" rel=\"noopener\">Skorpion87</a> · Public domain</span></figcaption></figure><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/cuvette.webp\" data-lightbox data-caption=\"Кювета для спектрофотометрії, у якій вимірюють E. Фото: {semfmaster}, Wikimedia Commons · CC BY-SA 3.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/cuvette.webp\" alt=\"Кювета для спектрофотометрії, у якій вимірюють E.\" width=\"1000\" height=\"961\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Кювета для спектрофотометрії, у якій вимірюють E.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:UV_Quartz_Cuvette.jpg\" target=\"_blank\" rel=\"noopener\">{semfmaster}</a> · CC BY-SA 3.0</span></figcaption></figure><figure class=\"bf \"><a href=\"../../assets/img/bio/mobdate.webp\" data-lightbox data-caption=\"Молібденова синь: розчин з фосфатом (праворуч, синій) і без нього (ліворуч, жовтий). Фото: Oguenther, Wikimedia Commons · CC BY-SA 3.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/mobdate.webp\" alt=\"Молібденова синь: розчин з фосфатом (праворуч, синій) і без нього (ліворуч, жовтий).\" width=\"646\" height=\"724\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Молібденова синь: розчин з фосфатом (праворуч, синій) і без нього (ліворуч, жовтий).<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Phosphatnachweis.jpg\" target=\"_blank\" rel=\"noopener\">Oguenther</a> · CC BY-SA 3.0</span></figcaption></figure></div><details class=\"bproto\"><summary>Хід роботи</summary><div><ol class=\"bsteps\"><li>Калібрування: розчиніть 4 мг висушеного KH₂PO₄ у 100 мл води (1 мл містить 40 мкг). У пробірки внесіть таку кількість розчину, щоб проби мали 5; 10; 15; 20; 25; 30 мкг солі; доведіть об’єм водою до 0,9 мл.</li><li>Додайте по 2,1 мл реактиву 3 (1 мл реактиву 1 — 10 % аскорбінова кислота + 6 мл реактиву 2 — 0,42 % молібдат амонію в 1 н H₂SO₄); інкубуйте 30 хв при 37 °C.</li><li>Виміряйте E на СФ або ФЕК (λ = 820 нм згідно методики; у тексті також фігурує 680 нм), кювети 5 чи 10 мм, проти контролю (вода + реактив 3).</li><li>Побудуйте калібрувальний графік E — C(Фн) та розрахуйте коефіцієнт <b>K = E / C</b>.</li><li>Для проби внесіть 0,9 мл реакційної суміші (джерело Фн) і 2,1 мл реактиву 3; інкубуйте 30 хв при 37 °C; виміряйте E.</li></ol></div></details><div class=\"eq\"><var>K</var> = <span class=\"fr\"><span><var>E</var><sub>820</sub></span><span><var>C</var><sub>Фн</sub></span></span> &nbsp;&nbsp; <var>C</var><sub>Фн</sub>(проби) = <span class=\"fr\"><span><var>E</var><sub>проби</sub></span><span><var>K</var></span></span> &nbsp;&nbsp; <var>A</var><sub>фер</sub> = <span class=\"fr\"><span><var>C</var><sub>Фн</sub></span><span><var>t</var>·<var>m</var><sub>білка</sub></span></span><span class=c>активність — кількість Фн за хвилину на 1 мг білка</span></div><div class=\"bcall bcall--warn\"><b>Зауваження до методики</b><p>У тексті методички вказано різні довжини хвиль (680 і 820 нм) та різні одиниці («мкг солі» й «концентрація Фн»). Коефіцієнт <var>K</var> завжди визначають у тих самих одиницях і за тієї ж довжини хвилі, що й вимірювання проб; у моделі використано 820 нм і «мкг KH₂PO₄ в пробі».</p></div><h3>Математична модель</h3><div class=\"bcall bcall--model\"><b>Що розраховує модель</b><p><b>Фракціонування.</b> Для кожної частинки за Стоксом знайдено швидкість осідання <var>v</var> і частку, що осяде за час <var>t</var> в пробірці довжиною 4 см (η = 2 мПа·с). Радіуси та густини орієнтовні. Стовпчики показують, у яких фракціях опиняється кожен маркер; «чистота» — частка маркера, що потрапила у «свою» фракцію. У осад потрапляє ще ≈ 3 % надосадку (захоплена рідина).</p><p><b>Фіске–Суббароу.</b> E = (<var>S</var>)·(1 − e<sup>−<var>εc</var>/<var>S</var></sup>) — майже лінійний закон Бера з м’яким насиченням при E &gt; 1; тому калібрувальний графік лінійний на початку. Кількість Фн у пробі = <var>v</var>·[білок]·<var>t</var>, де <var>v</var> залежить від ферменту; інгібітор зменшує її приблизно на 90 %.</p></div><div class=\"eq\"><var>A</var> = <var>ε</var>·<var>c</var>·<var>l</var><span class=c>закон Бера–Ламберта: оптична густина пропорційна концентрації й товщині шару</span></div>", qa: [["Відповідність: тип мембрани — маркерний фермент.", "<ul><li>апікальна мембрана ентероцита — лужна фосфатаза, амінопептидаза N, сахараза-ізомальтаза;</li><li>внутрішня мембрана мітохондрії — цитохромоксидаза, сукцинатдегідрогеназа, АТФ-синтаза;</li><li>зовнішня мембрана мітохондрії — моноаміноксидаза (поринові канали);</li><li>лізосоми — кисла фосфатаза, β-глюкуронідаза;</li><li>пероксисоми — каталаза, уратоксидаза;</li><li>апарат Гольджі — галактозилтрансфераза, сіалілтрансфераза;</li><li>ендоплазматичний ретикулум — глюкозо-6-фосфатаза, NADPH-цитохром c-редуктаза;</li><li>саркоплазматичний ретикулум — Ca²⁺-АТФаза (SERCA);</li><li>плазматична мембрана — Na⁺,K⁺-АТФаза (у рослин — H⁺-АТФаза P-типу), 5′-нуклеотидаза, аденілатциклаза.</li></ul>"], ["Опишіть, що таке метаболон, принципи його збирання.", "<p>Метаболон — структурно-функціональний комплекс послідовних ферментів одного шляху, у якому продукт одного ферменту безпосередньо передається наступному. Збирається за рахунок білок-білкових контактів (комплементарність поверхонь), прикріплення до мембран або цитоскелета (якорі), взаємодії з лігандами-організаторами. Переваги: висока локальна концентрація метаболітів, захист нестійких проміжних, регуляція.</p>"], ["Замалюйте будову біологічної мембрани та типи білків, які входять до її складу.", "<p>Подвійний ліпідний шар (фосфоліпіди, холестерол/стероли) із головками назовні та хвостами всередину. Білки: <b>інтегральні</b> (трансмембранні — канали, переносники, рецептори; пронизують бішар), <b>периферичні</b> (на поверхнях, зв’язані з білками чи головками ліпідів), <b>якірні</b> (прикріплені до ліпідів ковалентно). Зовні — глікокалікс.</p>"], ["Якими критеріями користуються при віднесенні ферментів до маркерних?", "<p>Фермент має бути міцно зв’язаним з даною мембраною/органелою, локалізованим лише в ній, не активуватися й не інгібуватися під час розділення фракцій, мати зручну методику визначення.</p>"], ["Чому активність маркерних ферментів використовують для встановлення чистоти мембранних препаратів?", "<p>Бо кожен маркер відображає наявність «своєї» органели. Якщо в мітохондріальній фракції є каталаза, кисла фосфатаза чи глюкозо-6-фосфатаза, значить, вона забруднена пероксисомами, лізосомами й ЕПР. Відносна питома активність маркера показує ступінь очищення.</p>"], ["Які властивості притаманні біологічним мембранам?", "<p>Напівпроникність (селективна проникність), текучість (латеральна дифузія ліпідів і білків), асиметрія (різний склад зовнішнього й внутрішнього листків), здатність до самозбирання, електрична ємність і поляризація, ферментативна активність, здатність до злиття й відшнурування.</p>"], ["Назвіть основні модельні мембранні системи.", "<p>Ліпосоми (везикули), плоскі бішарові ліпідні мембрани (БЛМ, чорні мембрани), моношари на межі розділу вода–повітря, мембранні везикули (мікросоми), мембранні «нанодиски», реконструйовані протеоліпосоми.</p>"], ["Перелічіть види мембранного транспорту.", "<p>Пасивний: проста дифузія, полегшена дифузія (канали, переносники). Активний: первинний (АТФ-залежні насоси) і вторинний (симпорт, антипорт за рахунок градієнта іонів). Також транспорт у мембранних пухирцях: ендоцитоз, екзоцитоз.</p>"], ["Які існують типи мембранних ферментів?", "<p>Інтегральні (трансмембранні, напр. АТФази, ацилтрансферази), периферичні (зв’язані електростатично чи з ліпідними якорями, напр. аденілатциклаза-G-білки, ферменти електронтранспортних комплексів), а також ферменти, що працюють на поверхні мембрани (екто-ферменти, напр. 5′-нуклеотидаза).</p>"], ["Яка хімічна основа визначення Фн за Фіске–Суббароу?", "<p>Фосфат реагує з молібдатом амонію в кислому середовищі (фосфомолібдатний комплекс); аскорбінова кислота відновлює його до молібденової сині, оптична густина якої при 680–820 нм прямо пропорційна кількості Фн.</p>"], ["Як розраховують калібрувальний коефіцієнт K і активність ферменту?", "<p>K = E₈₂₀/C(Фн) за лінійною ділянкою графіка. Для проби C(Фн) = E/K; активність = C(Фн)/(t·m білка) — кількість утвореного фосфату за хвилину на 1 мг білка.</p>"]],
  build({ stageBox, ctrls, below, tabsBox }) {
    let mode = "a";
    const M = UI.modes(tabsBox, stageBox, ctrls, below, [["a", "Фракціонування клітини"], ["b", "Фіске–Суббароу: неорганічний фосфор"]], id => { mode = id; });
    const A = M.box("a"), B = M.box("b");

    /* ================= A. Диференційне центрифугування ================= */
    // r — радіус, мкм; d — Δρ відносно середовища, кг/м³; mk — ферментний маркер
    const ORG = [
      { k: "nuc", n: "Ядра", r: 3, d: 290, col: "#5B44A8", mk: "ДНК-полімераза" },
      { k: "mit", n: "Мітохондрії", r: .4, d: 130, col: "#D1453B", mk: "Цитохромоксидаза", ms: "Цитохромоксидаза" },
      { k: "per", n: "Пероксисоми", r: .25, d: 200, col: "#2A8FB5", mk: "Каталаза" },
      { k: "lys", n: "Лізосоми / вакуолі", r: .3, d: 90, col: "#C77A12", mk: "Кисла фосфатаза" },
      { k: "er", n: "ЕПР (мікросоми)", r: .07, d: 80, col: "#3FA66A", mk: "Глюкозо-6-фосфатаза", ms: "Глюкозо-6-фосфатаза" },
      { k: "pm", n: "Плазмалема", r: .09, d: 80, col: "#C94F96", mk: "5′-Нуклеотидаза" },
      { k: "cyt", n: "Цитозоль (розчинні)", r: 0, d: 0, col: "#8A8A5A", mk: "Лактатдегідрогеназа", ms: "Лактат-ДГ" },
    ];
    const ST = [{ g: 600, t: 10, nm: "Етап 1 → ядра" }, { g: 10000, t: 20, nm: "Етап 2 → мітохондрії" }, { g: 100000, t: 60, nm: "Етап 3 → мікросоми" }];
    const eta = 2e-3, hcm = .04;
    const vel = (o, g) => o.r === 0 ? 0 : 2 * (o.r * 1e-6) ** 2 * o.d * (g * 9.81) / (9 * eta);
    const frac = (o, g, t) => o.r === 0 ? .03 : clamp(vel(o, g) * t * 60 / hcm, 0, 1) * .97 + .03 * 0;
    // розподіл маркерів по фракціях P1,P2,P3,S3
    function distrib() {
      const out = {}; for (const o of ORG) { let rem = 1; const row = []; for (let i = 0; i < 3; i++) { const f = o.r === 0 ? .03 : frac(o, ST[i].g, ST[i].t); const p = rem * f; row.push(p); rem -= p; } row.push(rem); out[o.k] = row; } return out;
    }
    const stA = new Stage(A.st, { aspect: 2.0, minH: 330, maxH: 470, minW: 560, tag: "Ультрацентрифугування" });
    const sel = { step: 0, tt: 0 };
    const rdA = UI.reads(A.st, [["g", "Прискорення"], ["rpm", "Оберти (ротор 8 см)"], ["pel", "Осад етапу"], ["pur", "Чистота маркера"]]);
    ST.forEach((s, i) => UI.slider(A.ct, { id: "p5-g" + i, label: `Етап ${i + 1}: g`, min: 100, max: i === 2 ? 200000 : 50000, step: 100, value: s.g, unit: "×g", on: v => { s.g = v; sel.step = i; sel.tt = 0; } }));
    UI.buttons(A.ct, [{ label: "▶ Етап 1", pri: true, on: () => { sel.step = 0; sel.tt = 0; } }, { label: "▶ Етап 2", on: () => { sel.step = 1; sel.tt = 0; } }, { label: "▶ Етап 3", on: () => { sel.step = 2; sel.tt = 0; } }]);
    UI.tip(A.ct, "Швидкість осідання за Стоксом: <b>v = 2r²(ρ − ρ₀)·ω²R/9η</b>. Великі й щільні частинки (ядра) осідають за малих g, дрібні (мікросоми) — лише за ~10⁵ g. Тому ферментні маркери розподіляються по фракціях; перекриття = забруднення.");
    const chA = h("div", { class: "charts" }); A.bl.append(chA);
    const cA1 = UI.chart(chA, "Розподіл ферментів-маркерів по фракціях, %", { aspect: 1.8, minH: 230, maxH: 340 });
    const tbA = h("div", { class: "tblwrap" }); A.bl.append(h("div", { class: "chart" }, h("h4", null, "Частинки, ферменти-маркери й швидкість осідання (v/g, нм/с на 1 g)"), tbA));
    UI.html(tbA, `<table class="t"><thead><tr><th>Частинка</th><th>Маркер</th><th>r, мкм</th><th>Δρ, кг/м³</th><th>v на 1g, нм/с</th></tr></thead><tbody>${ORG.map(o => `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${o.col};margin-right:6px"></span>${o.n}</td><td>${o.mk}</td><td class="n">${o.r ? NA(o.r, o.r >= 1 ? 0 : 2) : "—"}</td><td class="n">${o.d || "—"}</td><td class="n">${o.r ? NA(vel(o, 1) * 1e9, 2) : "—"}</td></tr>`).join("")}</tbody></table>`);
    // частинки в пробірці
    const rr = rng(13), pts = [];
    for (const o of ORG) { const n = o.k === "cyt" ? 70 : o.k === "nuc" ? 8 : o.k === "mit" || o.k === "per" ? 20 : 26; for (let i = 0; i < n; i++) pts.push({ o, x: rr(), y: rr() * .95, ph: rr() * 6 }); }
    function drawA(time) {
      const c = stA.ctx, W = stA.W, H = stA.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, Theme.dark ? "#1b2620" : "#EFF3EA"); bg.addColorStop(1, Theme.dark ? "#141e19" : "#DCE5D7"); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      const s = ST[sel.step], dur = 6, u = clamp(sel.tt / dur, 0, 1); // 0..1 прогрес
      // ротор: обертання
      const rx = W * .22, ry = H * .52, R = Math.min(W * .17, H * .36);
      const ang = time * (u < 1 ? clamp(Math.log10(s.g) * 4, 4, 22) : 0.4);
      Gfx.glow(c, rx, ry, R * 1.4, "#8a9099", .12);
      c.save(); c.translate(rx, ry); c.rotate(ang);
      const rg = c.createRadialGradient(0, 0, 4, 0, 0, R); rg.addColorStop(0, "#d9dde1"); rg.addColorStop(.6, "#9aa1a8"); rg.addColorStop(1, "#6b727a"); c.fillStyle = rg; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill(); c.strokeStyle = "#555c63"; c.lineWidth = 2; c.stroke();
      for (let k = 0; k < 6; k++) { c.save(); c.rotate(k * Math.PI / 3); Gfx.rr(c, R * .45, -10, R * .45, 20, 6); c.fillStyle = "#4a5057"; c.fill(); c.restore(); }
      c.fillStyle = "#3b4046"; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill(); c.restore();
      Gfx.text(c, s.nm, rx, ry + R + 24, { align: "center", size: 11.5, weight: 700, color: T0.ink });
      Gfx.text(c, `${NA(s.g, 0)} g · ${s.t} хв`, rx, ry + R + 42, { align: "center", size: 11, color: T0.muted });
      // пробірка
      const tx = W * .52, ty = H * .1, tw = Math.min(70, W * .1), th = H * .8;
      // стартова фаза: що в пробірці
      let alive = pts.map(p => ({ p }));
      // обчислюємо позицію кожної частинки залежно від прогресу осідання
      let rem = {}; const passed = [];
      const dist = distrib();
      Gfx.vial(c, tx, ty, tw, th, .92, "rgba(210,225,205,.7)", {
        inside: (cc, ly) => {
          const top = ty + th * .08, bot = ty + th - tw / 2, hh = bot - top;
          // осад по етапах: ступінь = f(g, t·u)
          let pellet = 0; const pelTop = {};
          // початкові ймовірності вхідних частинок для етапу: з урахуванням попередніх етапів
          for (const p of pts) {
            const o = p.o; let incl = 1; for (let i = 0; i < sel.step; i++) incl *= (1 - (o.r === 0 ? .03 : frac(o, ST[i].g, ST[i].t)));
            // частинка видима, якщо ще в надосадку на початку етапу (за детермінованим порогом p.y)
            if (p.y > incl) continue;
            const f = o.r === 0 ? .03 : frac(o, s.g, s.t * u);
            const settled = p.x * 1 < f; // залежить від випадкової «висоти»
            const yy = settled ? bot - (.98 - p.x * .98) * 14 - 2 + (p.ph % 1) * 3 : top + (p.y * hh * .55 + p.x * hh * .4) * (1 - 0) + Math.sin(time * 1.2 + p.ph) * 2 + (u * (f) * hh * .2);
            const xx = tx + 5 + ((p.ph * 37) % 1) * (tw - 10);
            if (o.k === "cyt") { cc.fillStyle = "rgba(138,138,90,.5)"; cc.beginPath(); cc.arc(xx, yy, 1.4, 0, 7); cc.fill(); continue; }
            Gfx.sphere(cc, xx, yy, Math.max(2.2, Math.min(5.5, 2 + o.r * 1.6)), o.col);
          }
        }
      });
      // шкала часу
      Gfx.chip(c, u < 1 ? `Центрифугування… ${NA(u * s.t, 0)} з ${s.t} хв` : "етап завершено", tx + tw / 2, ty - 6, { align: "center", size: 11 });
      Gfx.text(c, "надосадок", tx + tw + 8, ty + th * .35, { size: 10.5, color: T0.muted }); Gfx.text(c, "осад (пелета)", tx + tw + 8, ty + th * .92, { size: 10.5, color: T0.muted, weight: 700 });
      // легенда
      let ly = H * .14; for (const o of ORG) { Gfx.sphere(c, W * .72, ly, 5, o.col); Gfx.text(c, o.n, W * .72 + 12, ly, { size: 11, base: "middle", color: T0.ink }); Gfx.text(c, o.mk, W * .72 + 12, ly + 12, { size: 9.5, base: "middle", color: T0.muted }); ly += 40; }
      const f2 = ORG.filter(o => o.k === ["nuc", "mit", "er"][sel.step]).map(o => dist[o.k][sel.step])[0];
      rdA.set("g", NA(s.g, 0), "×g"); rdA.set("rpm", NA(Math.sqrt(s.g * 9.81 / .08) * 60 / (2 * Math.PI), 0), "об/хв");
      rdA.set("pel", ["Ядра", "Мітохондрії", "Мікросоми"][sel.step]); rdA.set("pur", NA(f2 * 100, 0), "%");
    }
    function chartsA() {
      const d = distrib(); const names = ["P₁ (ядерна)", "P₂ (мітох.)", "P₃ (мікросомна)", "S₃ (цитозоль)"];
      const st = c => c;
      // стековані стовпці: кожен маркер — стовпець зі сегментами по фракціях
      const c = cA1.ctx, W = cA1.W, H = cA1.H, T0 = Theme.c; c.fillStyle = T0.sheet; c.fillRect(0, 0, W, H);
      const nar = W < 420, L = 40, Rr = nar ? 46 : 8, Tp = nar ? 30 : 14, Bt = nar ? 108 : 92, pw = W - L - Rr, ph = H - Tp - Bt, n = ORG.length, bw = pw / n * .62, FC = ["#5B44A8", "#D1453B", "#3FA66A", "#B9C27A"];
      c.font = `11px ${FM()}`; c.textAlign = "right"; c.textBaseline = "middle";
      for (let v = 0; v <= 100; v += 25) { const y = Tp + ph * (1 - v / 100); c.strokeStyle = rgba(T0.ink, .08); c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); c.fillStyle = T0.muted; c.fillText(v, L - 6, y); }
      ORG.forEach((o, i) => { const x = L + pw / n * (i + .5) - bw / 2; let y = Tp + ph; d[o.k].forEach((v, j) => { const hh = v * ph; c.fillStyle = FC[j]; c.fillRect(x, y - hh, bw, hh); y -= hh; });
        c.save(); c.translate(x + bw / 2, Tp + ph + 8); c.rotate(nar ? .9 : .5); c.fillStyle = T0.ink; c.textAlign = "left"; c.font = `10.5px ${FB()}`; c.fillText(o.ms || o.mk, 0, 6); c.restore(); });
      let lx = L, ly = 7; names.forEach((nm, j) => { c.font = `10.5px ${FB()}`; const wn = c.measureText(nm).width; if (lx > L && lx + 14 + wn > W - 4) { lx = L; ly += 14; } c.fillStyle = FC[j]; c.fillRect(lx, ly - 5, 10, 8); c.fillStyle = T0.muted; c.textAlign = "left"; c.fillText(nm, lx + 14, ly); lx += wn + 34; });
    }

    /* ================= B. Фіске–Суббароу ================= */
    const EPS = .032, SAT = 3; // A на мкг KH2PO4 у пробі (3 мл)
    const absOf = (ug, noise = 0) => { const a = EPS * ug; return (SAT * (1 - Math.exp(-a / SAT))) + noise; };
    const calibUg = [0, 5, 10, 15, 20, 25, 30];
    const Q = { enz: 0, prot: 0.2, time: 20, inh: false, noise: .008 };
    const ENZ = [{ n: "Na⁺,K⁺-АТФаза (плазмалема)", v: 2.6, ink: "уабаїн" }, { n: "Ca²⁺,Mg²⁺-АТФаза", v: 1.7, ink: "ортованадат" }, { n: "5′-нуклеотидаза", v: .9, ink: "α,β-метилен-АДФ" }];
    const stB = new Stage(B.st, { aspect: 2.0, minH: 320, maxH: 450, tag: "Калібрувальний ряд і проба" });
    const rdB = UI.reads(B.st, [["A", "E₈₂₀ проби"], ["ug", "Фн за графіком"], ["K", "K = E/C"], ["act", "Активність"]]);
    UI.select(B.ct, { id: "p5-e", label: "Фермент у фракції", value: 0, options: ENZ.map((e, i) => [i, e.n]), on: v => Q.enz = +v });
    UI.slider(B.ct, { id: "p5-p", label: "Білок у пробі", min: .05, max: 1, step: .05, value: Q.prot, unit: "мг", on: v => Q.prot = v, fmt: v => NA(v, 2) });
    UI.slider(B.ct, { id: "p5-t", label: "Час інкубації (37 °C)", min: 5, max: 60, step: 5, value: Q.time, unit: "хв", on: v => Q.time = v });
    UI.check(B.ct, { id: "p5-i", label: "Додати специфічний інгібітор", value: false, on: v => Q.inh = v });
    UI.slider(B.ct, { id: "p5-n", label: "Шум приладу (E)", min: 0, max: .03, step: .002, value: Q.noise, on: v => Q.noise = v, fmt: v => NA(v, 3) });
    UI.tip(B.ct, "Реакційна суміш + реактив 3 (аскорбат + молібдат) → <b>молібденова синь</b>; E₈₂₀ прямо пропорційна кількості Фн (закон Бера) до ≈ 1. Калібрувальний коефіцієнт <b>K = E₈₂₀/C(Фн)</b>.");
    const cB = UI.chart(B.bl, "Калібрувальний графік E₈₂₀ — C(Фн), мкг в пробі", { aspect: 2.2, minH: 220, maxH: 320 });
    const bs = rng(77); const noiseArr = calibUg.map(() => (bs() - .5) * 2);
    function drawB(time) {
      const c = stB.ctx, W = stB.W, H = stB.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      c.fillStyle = Theme.dark ? "#18221c" : "#F1F4EC"; c.fillRect(0, 0, W, H);
      c.fillStyle = Theme.dark ? "#26332b" : "#CFC5A8"; c.fillRect(0, H * .84, W, H * .16);
      const tw = Math.min(34, W * .05), gap = Math.min(54, W * .07), x0 = W * .06, ty = H * .2, th = H * .5;
      const colOf = (A) => mixc("#EFF3F5", "#1D3F9E", clamp(A / .95, 0, 1));
      calibUg.forEach((ug, i) => {
        const A = absOf(ug, Q.noise * noiseArr[i]); const x = x0 + i * gap;
        Gfx.vial(c, x, ty, tw, th, .6, colOf(A), { label: i ? String(ug) : "0" });
        Gfx.text(c, "E=" + NA(Math.max(0, A), 2), x + tw / 2, ty + th + 36, { align: "center", size: 10, color: T0.muted });
      });
      Gfx.text(c, "Калібрувальні проби, мкг Фн", x0, ty - 12, { size: 11, weight: 700, color: T0.ink });
      // проба
      const ug = Q.inh ? ENZ[Q.enz].v * Q.prot * Q.time * .08 : ENZ[Q.enz].v * Q.prot * Q.time * .8 * 0 + ENZ[Q.enz].v * Q.prot * Q.time * .8;
      const uSamp = clamp(ug, 0, 38); const Asamp = absOf(uSamp, Q.noise * (Math.sin(time * 1.3) * .5));
      const sx = x0 + 7 * gap + 30; Gfx.vial(c, sx, ty, tw, th, .6, colOf(Asamp), { label: "проба" });
      Gfx.text(c, "Проба", sx + tw / 2, ty - 12, { align: "center", size: 11, weight: 700, color: "#B8481A" });
      // спектрофотометр
      const px = W * .66, py = H * .12, pw = W * .3, ph = H * .6;
      Gfx.rr(c, px, py, pw, ph, 14); const gg = c.createLinearGradient(px, py, px, py + ph); gg.addColorStop(0, Theme.dark ? "#35403a" : "#E7EBE4"); gg.addColorStop(1, Theme.dark ? "#27312b" : "#C9D0C5"); c.fillStyle = gg; c.fill(); c.strokeStyle = T0.rule; c.stroke();
      Gfx.rr(c, px + 14, py + 14, pw - 28, ph * .28, 8); c.fillStyle = "#0E1F14"; c.fill(); Gfx.text(c, "λ = 820 нм", px + 24, py + 30, { size: 11, color: "#7CD67F" });
      Gfx.text(c, NA(Math.max(0, Asamp), 3), px + pw - 26, py + 14 + ph * .14, { align: "right", base: "middle", size: 28, weight: 700, color: "#9FEFA2", font: "mono" });
      // кювета
      const cx = px + pw / 2 - 16; Gfx.rr(c, cx, py + ph * .45, 32, ph * .42, 3); c.fillStyle = colOf(Asamp); c.fill(); c.strokeStyle = T0.muted; c.stroke();
      c.strokeStyle = "rgba(255,80,60,.7)"; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(px + 6, py + ph * .66); c.lineTo(cx, py + ph * .66); c.moveTo(cx + 32, py + ph * .66); c.lineTo(px + pw - 6, py + ph * .66); c.stroke(); c.setLineDash([]);
      c.lineWidth = 1; Gfx.text(c, "кювета 10 мм", cx + 16, py + ph * .93, { align: "center", size: 10, color: T0.muted });
      // розрахунок
      const slope = EPS; // за калібруванням (лінійна ділянка)
      const found = Asamp > .0 ? -Math.log(1 - Math.min(.999, Asamp / SAT)) * SAT / EPS : 0; // зворотний розрахунок за кривою
      const K = EPS; // E/C за ліній. ділянкою
      const act = found / (Q.time * Q.prot);
      Gfx.text(c, `Фн = ${NA(found, 1)} мкг → активність ${NA(act, 2)} мкг Фн/(хв·мг білка)`, W * .06, H * .93, { size: 12, color: T0.ink, weight: 700 });
      rdB.set("A", NA(Math.max(0, Asamp), 3)); rdB.set("ug", NA(found, 1), "мкг"); rdB.set("K", NA(K, 3), "1/мкг"); rdB.set("act", NA(act, 2), "мкг/хв/мг");
      B.last = { found, Asamp };
      const pts = calibUg.map((u, i) => [u, absOf(u, Q.noise * noiseArr[i])]);
      const line = [[0, 0], [30, EPS * 30]];
      drawChart(cB, { x: [0, 40], y: [0, 1.3], xl: "Фн, мкг", yl: "E₈₂₀", series: [{ pts: line, color: T0.muted, w: 1.6, dash: [5, 4] }, { pts, color: "#1D3F9E", w: 2, dots: 4 }], marks: [{ x: found, y: Math.max(0, Asamp), color: "#B8481A", label: "проба" }], vl: [{ x: found, color: "#B8481A" }] });
    }

    M.init();
    return {
      stages: [stA, cA1, stB, cB],
      frame(dt, t) {
        if (mode === "a") { if (dt > 0) sel.tt = Math.min(7, sel.tt + dt); drawA(t); chartsA(); }
        else drawB(t);
      },
    };
  },
});

})();
