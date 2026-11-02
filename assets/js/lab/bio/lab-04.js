// ПЗ 4: теорія, модель, питання (код згенеровано з вихідних файлів).
(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb } = window.BIO;
/* ПЗ 4. Потенціал спокою (Нернст, Гольдман), потенціал дії (Ходжкін–Хакслі), в'язкість цитоплазми */
App.def(4, {
  cheat: "<p class=\"lead\">Біологічні мембрани — основа будови будь-якої клітини. Крім бар’єрної та матричної функцій, вони виявляють електричну активність: на мембрані існують потенціал спокою й, у збудливих клітинах, потенціал дії. За фізичною природою обидва мають <b>іонний</b> механізм: це наслідок пасивного й активного транспорту іонів Na⁺, K⁺, Cl⁻ крізь мембрану.</p><h3>Мембрана як електричний елемент</h3><p>Молекули ліпідів упорядковані перпендикулярно до поверхні у два шари: полярні гідрофільні голівки спрямовані назовні, неполярні вуглеводневі хвости — всередину. Ліпідний шар ефективно перешкоджає вільному проходженню іонів і поводиться як <b>діелектрик</b>, а мембрана в цілому має електричну ємність. Мембранні білки утворюють канали й переносники; частина занурена в ліпідний шар, а деякі пронизують мембрану наскрізь (наприклад, Na⁺/K⁺-АТФаза). Білки не закріплені нерухомо й мають певну свободу переміщення.</p><div class=\"bf-gal bf-gal--2\"><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/bilayer.webp\" data-lightbox data-caption=\"Ліпідний бішар із вбудованими білками: гідрофобне ядро — діелектрик, білки утворюють канали. Фото: Unknown authorUnknown author, Wikimedia Commons · CC BY-SA 4.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/bilayer.webp\" alt=\"Ліпідний бішар із вбудованими білками: гідрофобне ядро — діелектрик, білки утворюють канали.\" width=\"699\" height=\"383\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Ліпідний бішар із вбудованими білками: гідрофобне ядро — діелектрик, білки утворюють канали.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Lipid_bilayer_closeup.png\" target=\"_blank\" rel=\"noopener\">Unknown authorUnknown author</a> · CC BY-SA 4.0</span></figcaption></figure><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/nak.webp\" data-lightbox data-caption=\"Na⁺/K⁺-АТФаза — білок-помпа, що створює градієнти Na⁺ і K⁺. Фото: Biology with Risa, Wikimedia Commons · CC BY-SA 4.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/nak.webp\" alt=\"Na⁺/K⁺-АТФаза — білок-помпа, що створює градієнти Na⁺ і K⁺.\" width=\"1000\" height=\"488\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Na⁺/K⁺-АТФаза — білок-помпа, що створює градієнти Na⁺ і K⁺.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Sodium_Potassium_Pump.jpg\" target=\"_blank\" rel=\"noopener\">Biology with Risa</a> · CC BY-SA 4.0</span></figcaption></figure></div><p>Білки не лише полегшують проходження кожного з іонів, але й керують його потоком, звідси — <b>вибіркова (селективна) проникність</b> мембрани: канали пропускають лише певні іони й відкриваються або закриваються залежно від умов (напруга, ліганд).</p><h3>Потенціал спокою</h3><p>Наявність потенціалу спокою зумовлена двома чинниками: (1) <b>різною концентрацією іонів</b> усередині й поза клітиною; (2) <b>вибірковою проникністю мембрани</b> для різних іонів. У збудливих клітинах концентрація K⁺ всередині набагато перевищує зовнішню, а Na⁺ і Cl⁻ — навпаки, більше зовні. Нерівність концентрацій викликає дифузію іонів з області високої концентрації в область низької, швидкість якої залежить від різниці концентрацій і проникності.</p><p>Оскільки іони заряджені, а мембрана має ємність, заряди накопичуються на її поверхнях, виникає різниця потенціалів і електричне поле, що діє на заряджені частинки в мембрані. Дифузія й електричне поле врівноважуються — настає стаціонарний стан, а не рівновага: для підтримання градієнтів працює Na⁺/K⁺-насос.</p><div class=\"tblwrap\"><table class=\"t bt \"><thead><tr><th>Іон</th><th>Всередині, мМ</th><th>Зовні, мМ</th><th>Рівноважний потенціал</th></tr></thead><tbody><tr><td>K⁺</td><td>≈ 140</td><td>≈ 5</td><td>≈ −90 мВ</td></tr><tr><td>Na⁺</td><td>≈ 15</td><td>≈ 145</td><td>≈ +60 мВ</td></tr><tr><td>Cl⁻</td><td>≈ 10</td><td>≈ 110</td><td>≈ −65 мВ</td></tr></tbody></table></div><p>Класична ілюстрація — нейрон ссавця (значення округлені). У рослин та сама схема працює для K⁺ і Cl⁻, але величину потенціалу спокою (−120…−200 мВ) визначає насамперед електрогенна H⁺-АТФаза плазмалеми.</p><h3>Дифузія й рівняння Нернста–Планка</h3><div class=\"eq\"><var>J</var> = −<var>D</var> <span class=\"fr\"><span>d<var>c</var></span><span>d<var>x</var></span></span><span class=c>закон Фіка: потік пасивно дифундувальної речовини пропорційний градієнту концентрації</span></div><div class=\"eq\"><var>J</var> = −<var>D</var>(<span class=\"fr\"><span>d<var>c</var></span><span>d<var>x</var></span></span> + <span class=\"fr\"><span><var>zF</var></span><span><var>RT</var></span></span> <var>c</var> <span class=\"fr\"><span>d<var>φ</var></span><span>d<var>x</var></span></span>)<span class=c>рівняння Нернста–Планка: потік іона визначають і градієнт концентрації, і електричне поле</span></div><p>Нернст–Планк узагальнює закон Фіка на заряджені частинки: до дифузійної складової додається <b>електрична</b> (дрейф у полі). Коли обидві складові врівноважують одна одну, потік дорівнює нулю — саме звідси виводять рівняння Нернста.</p><div class=\"eq\"><var>E</var><sub>i</sub> = <span class=\"fr\"><span><var>RT</var></span><span><var>z</var><sub>i</sub><var>F</var></span></span> ln<span class=\"fr\"><span><var>c</var><sub>зовн</sub></span><span><var>c</var><sub>внутр</sub></span></span> ≈ <span class=\"fr\"><span>61,5 мВ</span><span><var>z</var></span></span> lg<span class=\"fr\"><span><var>c</var><sub>зовн</sub></span><span><var>c</var><sub>внутр</sub></span></span> (37 °C)<span class=c>потенціал Нернста: мембранний потенціал, за якого потік іона дорівнює нулю</span></div><h4>Рівняння Гольдмана (ГГК)</h4><p>Реальна мембрана проникна для кількох іонів одразу, тому потенціал спокою — зважене середнє потенціалів Нернста з вагами <b>проникностей</b> <var>P</var>:</p><div class=\"eq\"><var>V</var><sub>m</sub> = <span class=\"fr\"><span><var>RT</var></span><span><var>F</var></span></span> ln<span class=\"fr\"><span><var>P</var><sub>K</sub>[K⁺]<sub>зовн</sub> + <var>P</var><sub>Na</sub>[Na⁺]<sub>зовн</sub> + <var>P</var><sub>Cl</sub>[Cl⁻]<sub>внутр</sub></span><span><var>P</var><sub>K</sub>[K⁺]<sub>внутр</sub> + <var>P</var><sub>Na</sub>[Na⁺]<sub>внутр</sub> + <var>P</var><sub>Cl</sub>[Cl⁻]<sub>зовн</sub></span></span></div><p>У спокої <var>P</var><sub>K</sub> ≫ <var>P</var><sub>Na</sub>, тому <var>V</var><sub>m</sub> близький до <var>E</var><sub>K</sub> (≈ −70 мВ). Під час потенціалу дії проникність для Na⁺ різко зростає, і <var>V</var><sub>m</sub> прямує до <var>E</var><sub>Na</sub>.</p><h4>Як зміниться потенціал спокою?</h4><div class=\"tblwrap\"><table class=\"t bt \"><thead><tr><th>Зміна</th><th>Вплив на V спокою</th></tr></thead><tbody><tr><td>[K⁺]<sub>зовн</sub> ↑</td><td>деполяризація (V стає менш від’ємним)</td></tr><tr><td>[K⁺]<sub>зовн</sub> ↓</td><td>гіперполяризація</td></tr><tr><td>[K⁺]<sub>внутр</sub> ↑</td><td>гіперполяризація</td></tr><tr><td>[Na⁺]<sub>зовн</sub> ↑</td><td>слабка деполяризація (бо P<sub>Na</sub> мала)</td></tr><tr><td>[Na⁺]<sub>внутр</sub> ↑</td><td>слабка деполяризація</td></tr><tr><td>[Cl⁻]<sub>зовн</sub> ↑</td><td>гіперполяризація (аніон)</td></tr><tr><td>[Cl⁻]<sub>внутр</sub> ↑</td><td>деполяризація</td></tr></tbody></table></div><h3>Потенціал дії та модель Ходжкіна–Хакслі</h3><div class=\"bf-gal bf-gal--2\"><figure class=\"bf bf--contain\"><a href=\"../../assets/img/bio/apgraph.webp\" data-lightbox data-caption=\"Фази потенціалу дії: деполяризація, пік, реполяризація, гіперполяризація. Фото: Peter Duncan, Wikimedia Commons · CC BY-SA 4.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/apgraph.webp\" alt=\"Фази потенціалу дії: деполяризація, пік, реполяризація, гіперполяризація.\" width=\"1000\" height=\"781\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Фази потенціалу дії: деполяризація, пік, реполяризація, гіперполяризація.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Action_potential_schematic.png\" target=\"_blank\" rel=\"noopener\">Peter Duncan</a> · CC BY-SA 4.0</span></figcaption></figure><figure class=\"bf \"><a href=\"../../assets/img/bio/plasmolysis2.webp\" data-lightbox data-caption=\"Епідерма цибулі в гіпертонічному розчині: протопласти відокремлюються від клітинних стінок (плазмоліз) — приклад мембранного осмосу. Фото: Trương Minh Khải, Wikimedia Commons · CC BY 4.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/plasmolysis2.webp\" alt=\"Епідерма цибулі в гіпертонічному розчині: протопласти відокремлюються від клітинних стінок (плазмоліз) — приклад мембранного осмосу.\" width=\"998\" height=\"1000\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Епідерма цибулі в гіпертонічному розчині: протопласти відокремлюються від клітинних стінок (плазмоліз) — приклад мембранного осмосу.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Plasmolysis_of_red_onion_(Allium_cepa)_cells.jpg\" target=\"_blank\" rel=\"noopener\">Trương Minh Khải</a> · CC BY 4.0</span></figcaption></figure></div><p>У нерві й м’язі електрична активація пов’язана з рухом іонів Na⁺ та K⁺ крізь потенціал-залежні канали. Достатня деполяризація відкриває Na⁺-канали (швидка <b>активація</b>, ворота m); Na⁺ входить за градієнтом, і потенціал стрімко зростає (самопідсилення). Пізніше Na⁺-канали <b>інактивуються</b> (ворота h), відкриваються K⁺-канали (ворота n) — і мембрана реполяризується, на короткий час навіть гіперполяризується (рефрактерність).</p><div class=\"eq\"><var>C</var><sub>m</sub> <span class=\"fr\"><span>d<var>V</var></span><span>d<var>t</var></span></span> = −<var>g</var><sub>Na</sub><var>m</var><sup>3</sup><var>h</var>(<var>V</var> − <var>E</var><sub>Na</sub>) − <var>g</var><sub>K</sub><var>n</var><sup>4</sup>(<var>V</var> − <var>E</var><sub>K</sub>) − <var>g</var><sub>L</sub>(<var>V</var> − <var>E</var><sub>L</sub>) + <var>I</var></div><div class=\"eq\"><span class=\"fr\"><span>d<var>x</var></span><span>d<var>t</var></span></span> = <var>α</var><sub>x</sub>(<var>V</var>)(1 − <var>x</var>) − <var>β</var><sub>x</sub>(<var>V</var>)<var>x</var> &nbsp;&nbsp; (<var>x</var> = <var>m</var>, <var>h</var>, <var>n</var>)<span class=c>кінетика воріт: імовірність, що ворота відкриті</span></div><h3>Лабораторна робота: в’язкість цитоплазми й концентрація іонів K⁺</h3><p>В’язкість — опір переміщенню шару рідини відносно іншого; вона зумовлена зчепленням молекул і опором структурних компонентів клітини. Зміна функціональної активності клітини корелює зі зміною в’язкості цитоплазми. <b>Одновалентні</b> катіони підвищують гідратацію колоїдів і <b>зменшують</b> в’язкість, <b>двовалентні</b> спричиняють коагуляцію та дегідратацію білків і <b>підвищують</b> в’язкість.</p><p>Початкова форма плазмолізу — <b>ввігнутий</b>. Надалі вона або зберігається, або з певною швидкістю переходить в <b>опуклий</b>. Час від занурення до опуклого плазмолізу значною мірою залежить від в’язкості: чим вона менша, тим швидше настає опуклий плазмоліз.</p><div class=\"bf-gal bf-gal--2\"><figure class=\"bf \"><a href=\"../../assets/img/bio/plasmolysis.webp\" data-lightbox data-caption=\"Плазмоліз у клітинах епідерми цибулі: протопласт відсунувся від клітинної стінки. Фото: Mnolf, Wikimedia Commons · CC BY-SA 3.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/plasmolysis.webp\" alt=\"Плазмоліз у клітинах епідерми цибулі: протопласт відсунувся від клітинної стінки.\" width=\"1000\" height=\"922\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Плазмоліз у клітинах епідерми цибулі: протопласт відсунувся від клітинної стінки.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Rhoeo_Discolor_-_Plasmolysis.jpg\" target=\"_blank\" rel=\"noopener\">Mnolf</a> · CC BY-SA 3.0</span></figcaption></figure><figure class=\"bf \"><a href=\"../../assets/img/bio/plasmolysis2.webp\" data-lightbox data-caption=\"Різні стадії плазмолізу в клітинах рослини. Фото: Trương Minh Khải, Wikimedia Commons · CC BY 4.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/plasmolysis2.webp\" alt=\"Різні стадії плазмолізу в клітинах рослини.\" width=\"998\" height=\"1000\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Різні стадії плазмолізу в клітинах рослини.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Plasmolysis_of_red_onion_(Allium_cepa)_cells.jpg\" target=\"_blank\" rel=\"noopener\">Trương Minh Khải</a> · CC BY 4.0</span></figcaption></figure></div><details class=\"bproto\"><summary>Хід роботи</summary><div><ol class=\"bsteps\"><li>Об’єкт — епідерма із зовнішнього боку забарвленої луски синьої цибулі. Плазмолітики: 1 М KNO₃ та 0,7 М Ca(NO₃)₂.</li><li>На предметному склі проведіть плазмоліз: з одного боку накривного скельця нанесіть краплину розчину, з протилежного відтягніть воду смужкою фільтрувального паперу.</li><li>Визначте час, за який настає плазмоліз (і перехід у випуклий) у клітинах у KNO₃ та Ca(NO₃)₂.</li><li>Зробіть висновки про в’язкість цитоплазми та вплив на неї різних іонів.</li></ol></div></details><h3>Математична модель</h3><div class=\"bcall bcall--model\"><b>Три вкладки моделі</b><p><b>Потенціал спокою:</b> рівняння Нернста для K⁺, Na⁺, Cl⁻ і рівняння Гольдмана. Змінюйте концентрації й проникності та спостерігайте, як зсувається <var>V</var><sub>m</sub> до потенціалу іона з найбільшою проникністю. Напрям «потоків» через канали визначає різниця <var>V</var> − <var>E</var><sub>i</sub> (рушійна сила).</p><p><b>Ходжкін–Хакслі:</b> чотири звичайні диференціальні рівняння (<var>V</var>, <var>m</var>, <var>h</var>, <var>n</var>), інтеграція кроком 0,02 мс; параметри класичні: <var>g</var><sub>Na</sub> = 120, <var>g</var><sub>K</sub> = 36, <var>g</var><sub>L</sub> = 0,3 мСм/см², <var>C</var><sub>m</sub> = 1 мкФ/см²; швидкості воріт множаться на <var>Q</var><sub>10</sub><sup>(<var>T</var>−6,3)/10</sup> із <var>Q</var><sub>10</sub> = 3. Тетродотоксин знімає <var>g</var><sub>Na</sub>, ТЕА — <var>g</var><sub>K</sub>.</p><p><b>Плазмоліз:</b> якісна модель: час опуклого плазмолізу пропорційний відносній в’язкості η, яка зменшується з [K⁺] і зростає з [Ca²⁺]. Числа — ілюстративні.</p></div>", qa: [["Що таке селективна проникність біомембран?", "<p>Здатність мембрани пропускати одні речовини й іони набагато легше за інші. Забезпечується ліпідним бішаром (проникний для малих неполярних молекул) і білковими каналами та переносниками, специфічними до певних іонів. Завдяки цьому між сторонами мембрани підтримуються різні іонні склади.</p>"], ["Запишіть закон Фіка для пасивного транспорту крізь біомембрану.", "<p>J = −D·dc/dx; для мембрани товщиною l потік: J = P·(c₁ − c₂), де P = D·β/l — коефіцієнт проникності. Потік спрямований від більшої концентрації до меншої й пропорційний її різниці.</p>"], ["Рівняння Нернста–Планка. Що воно характеризує?", "<p>J = −D(dc/dx + zF/(RT)·c·dφ/dx). Описує потік іона, що дифундує під дією як градієнта концентрації, так і електричного поля. Коли J = 0, з нього випливає рівняння Нернста.</p>"], ["Який іонний склад характерний для внутрішньоклітинного та позаклітинного простору?", "<p>У тваринній клітині: усередині багато K⁺ (≈ 140 мМ) і органічних аніонів, мало Na⁺ (≈ 15) і Cl⁻ (≈ 10); зовні — багато Na⁺ (≈ 145) і Cl⁻ (≈ 110), мало K⁺ (≈ 5). Рослинні клітини також накопичують K⁺ (≈ 100 мМ), підтримують низькі концентрації Na⁺ й мають від’ємний потенціал близько −150 мВ.</p>"], ["Що таке потенціал Нернста?", "<p>Мембранний потенціал, за якого потоки іона, що створюються градієнтом концентрації й електричним полем, взаємно компенсуються: E = (RT/zF)·ln(c<sub>зовн</sub>/c<sub>внутр</sub>). Для K⁺ у нейроні ≈ −90 мВ, для Na⁺ ≈ +60 мВ.</p>"], ["Чим обумовлений потенціал спокою та які фактори на нього впливають?", "<p>Нерівномірним розподілом іонів і вибірковою проникністю мембрани (насамперед для K⁺), а також роботою електрогенних насосів. Впливають: концентрації K⁺, Na⁺, Cl⁻ по обидва боки, відносні проникності, температура, активність насосів (наприклад, зупинка Na⁺/K⁺-АТФази при гіпоксії).</p>"], ["Як зміниться потенціал спокою, якщо позаклітинна [K⁺] зросте?", "<p>E(K⁺) стане менш від’ємним, і V спокою зсунеться в бік деполяризації (приблизно +58 мВ на кожне десятикратне зростання при великій P<sub>K</sub>). Зниження [K⁺]<sub>зовн</sub> спричинить гіперполяризацію.</p>"], ["Як зміниться потенціал спокою, якщо внутрішньоклітинна [Na⁺] збільшиться?", "<p>Слабко деполяризується: в рівнянні Гольдмана Na⁺ має малу вагу (P<sub>Na</sub> ≪ P<sub>K</sub>), тому ефект менший за ефект K⁺. Зате зменшується рушійна сила входу Na⁺.</p>"], ["Які фази потенціалу дії та які канали за них відповідають?", "<p>Деполяризація — відкриття Na⁺-каналів (m-ворота), пік — наближення V до E(Na⁺); реполяризація — інактивація Na⁺-каналів (h) і відкриття K⁺-каналів (n); гіперполяризація — запізніле закриття K⁺-каналів; рефрактерність — Na⁺-канали ще інактивовані.</p>"], ["Що відбудеться при додаванні тетродотоксину та ТЕА?", "<p>Тетродотоксин блокує потенціал-залежні Na⁺-канали — потенціал дії не виникає. ТЕА блокує K⁺-канали — реполяризація сповільнюється, потенціал дії подовжується.</p>"], ["Як у досліді з плазмолізом визначити вплив іонів K⁺ та Ca²⁺ на в’язкість цитоплазми? Який результат очікується?", "<p>Порівнюють час переходу від ввігнутого до опуклого плазмолізу в KNO₃ та Ca(NO₃)₂. У розчині калієвої солі опуклий плазмоліз настає швидше (одновалентний K⁺ гідратує колоїди, в’язкість падає); у розчині Ca²⁺ — повільніше (двовалентний катіон дегідратує й коагулює білки, в’язкість зростає).</p>"]],
  build({ stageBox, ctrls, below, tabsBox }) {
    let mode = "a";
    const M = UI.modes(tabsBox, stageBox, ctrls, below, [["a", "Потенціал спокою"], ["b", "Потенціал дії (Ходжкін–Хакслі)"], ["c", "Плазмоліз і в’язкість"]], id => { mode = id; });
    const A = M.box("a"), B = M.box("b"), C = M.box("c");
    const Rg = 8.314, F = 96485;
    const COLI = { K: "#6A4FB5", Na: "#2A8FB5", Cl: "#3FA66A" };

    /* ===================== A. Нернст і Гольдман ===================== */
    const PRE = { neuron: { K: [140, 5], Na: [15, 145], Cl: [10, 110], pK: 1, pNa: .04, pCl: .45, T: 37 }, squid: { K: [400, 20], Na: [50, 440], Cl: [52, 560], pK: 1, pNa: .04, pCl: .45, T: 18 }, plant: { K: [100, 1], Na: [5, 1], Cl: [15, 1], pK: 1, pNa: .05, pCl: .2, T: 22 } };
    const S = { ...JSON.parse(JSON.stringify(PRE.neuron)) };
    const E = (ion) => { const [ci, co] = S[ion], z = ion === "Cl" ? -1 : 1; return Rg * (S.T + 273.15) / (z * F) * Math.log(co / ci) * 1000; };
    const Vm = () => { const a = S.pK * S.K[1] + S.pNa * S.Na[1] + S.pCl * S.Cl[0], b = S.pK * S.K[0] + S.pNa * S.Na[0] + S.pCl * S.Cl[1]; return Rg * (S.T + 273.15) / F * Math.log(a / b) * 1000; };
    const stA = new Stage(A.st, { aspect: 1.85, minH: 320, maxH: 470, tag: "Мембрана в стані спокою" });
    const rdA = UI.reads(A.st, [["EK", "E(K⁺)"], ["ENa", "E(Na⁺)"], ["ECl", "E(Cl⁻)"], ["V", "V спокою (Гольдман)"]]);
    UI.select(A.ct, { id: "p4-pre", label: "Клітина", value: "neuron", options: [["neuron", "Нейрон ссавця (37 °C)"], ["squid", "Гігантський аксон кальмара (18 °C)"], ["plant", "Рослинна клітина (спрощено)"]], on: v => { Object.assign(S, JSON.parse(JSON.stringify(PRE[v]))); syncA(); } });
    const sl = {};
    const grid = h("div", { class: "ctlgrid" }); A.bl.append(grid);
    grid.append(h("h5", null, "Концентрації (мМ) і відносні проникності іонів"));
    const colOf = (title, col) => { const d = h("div", { class: "ctl-col" }, h("h5", { style: `color:${col}` }, title)); grid.append(d); return d; };
    const cK = colOf("K⁺", COLI.K), cNa = colOf("Na⁺", COLI.Na), cCl = colOf("Cl⁻", COLI.Cl);
    const mk = (par, id, lab, key, idx, max, st) => { sl[id] = UI.slider(par, { id: "p4a-" + id, label: lab, min: 1, max, step: st || 1, value: S[key][idx], unit: "мМ", on: v => { S[key][idx] = v; } }); };
    mk(cK, "Ki", "всередині", "K", 0, 500); mk(cK, "Ko", "зовні", "K", 1, 60, .5);
    const pk = UI.slider(cK, { id: "p4a-pk", label: "P(K⁺) відносно", min: .1, max: 5, step: .05, value: S.pK, on: v => S.pK = v, fmt: v => NA(v, 2) });
    mk(cNa, "Nai", "всередині", "Na", 0, 100); mk(cNa, "Nao", "зовні", "Na", 1, 500);
    const pn = UI.slider(cNa, { id: "p4a-pn", label: "P(Na⁺) відносно", min: .005, max: 3, step: .005, value: S.pNa, on: v => S.pNa = v, fmt: v => NA(v, 3) });
    mk(cCl, "Cli", "всередині", "Cl", 0, 100); mk(cCl, "Clo", "зовні", "Cl", 1, 600);
    const pc = UI.slider(cCl, { id: "p4a-pc", label: "P(Cl⁻) відносно", min: .02, max: 2, step: .02, value: S.pCl, on: v => S.pCl = v, fmt: v => NA(v, 2) });
    function syncA() { sl.Ki.set(S.K[0]); sl.Ko.set(S.K[1]); sl.Nai.set(S.Na[0]); sl.Nao.set(S.Na[1]); sl.Cli.set(S.Cl[0]); sl.Clo.set(S.Cl[1]); pk.set(S.pK); pn.set(S.pNa); pc.set(S.pCl); }
    UI.tip(A.ct, "<b>Рівняння Гольдмана</b> зважує внесок кожного іона його проникністю: що більша P, то ближче V до рівноважного потенціалу цього іона. У спокої мембрана найпроникніша для K⁺, тому V ≈ E(K⁺), трохи зсунутий до E(Na⁺).");
    UI.tip(A.ct, "У рослин мембранний потенціал (−120…−200 мВ) значною мірою створює електрогенна H⁺-АТФаза; ця модель враховує лише дифузійний (гольдманівський) внесок K⁺, Na⁺, Cl⁻.");
    const chA = h("div", { class: "charts" }); A.bl.append(chA);
    const cA1 = UI.chart(chA, "Залежність V спокою від [K⁺] зовні (мВ) — нахил ≈ 58–62 мВ на декаду");
    const cA2 = UI.chart(chA, "Рівноважні потенціали іонів і V спокою (мВ)");
    function drawA(time) {
      const c = stA.ctx, W = stA.W, H = stA.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      const my = H * .5, gap = 26; const V = Vm();
      const o = c.createLinearGradient(0, 0, 0, my); o.addColorStop(0, Theme.dark ? "#16303f" : "#D9EAF6"); o.addColorStop(1, Theme.dark ? "#1b3b4d" : "#C4DDEE"); c.fillStyle = o; c.fillRect(0, 0, W, my);
      const ii = c.createLinearGradient(0, my, 0, H); ii.addColorStop(0, Theme.dark ? "#2b4430" : "#E4EFD2"); ii.addColorStop(1, Theme.dark ? "#223a29" : "#D6E7BC"); c.fillStyle = ii; c.fillRect(0, my, W, H - my);
      const mx1 = W * .64; Gfx.bilayer(c, 0, mx1, my, gap, time, { s: 1.15 });
      // канали: K (завжди), Na (малопровідний), Cl
      const chs = [["K", W * .14, S.pK], ["Na", W * .31, S.pNa], ["Cl", W * .48, S.pCl]];
      const flux = {};
      for (const [ion, x, p] of chs) {
        const open = clamp(p / 1.2, .06, 1); c.save(); c.translate(x, my); Gfx.channel(c, 0, 0, gap, 34, open, ion === "K" ? "#8D7BD0" : ion === "Na" ? "#4FA9D0" : "#59B988"); c.restore();
        Gfx.text(c, { K: "K⁺-канал", Na: "Na⁺-канал", Cl: "Cl⁻-канал" }[ion], x, my - gap / 2 - 14, { align: "center", size: 10.5, color: T0.muted, weight: 600 });
        const z = ion === "Cl" ? -1 : 1, drive = (V - E(ion)) * z; // ефлюкс, якщо > 0 (вихід катіона)
        flux[ion] = p * drive;
        const mag = clamp(Math.abs(flux[ion]) / 40, 0, 1) * 5 + .3; const dir = flux[ion] > 0 ? -1 : 1; // позитивний → вихід катіона вгору
        for (let k = 0; k < 3; k++) { const ph = (time * (.6 + p * .3) + k / 3) % 1, y = my + dir * (-gap + ph * 2 * gap) * 1.2 * (z === -1 ? -1 : 1) * -1; Gfx.sphere(c, x + Math.sin(k * 2 + time * 3) * 3, my + (dir) * (gap * .9 - ph * gap * 1.8), 4.5, COLI[ion], { a: clamp(mag / 3, .2, 1) }); }
      }
      // іони розчину (кількість ∝ log c)
      for (const ion of ["K", "Na", "Cl"]) {
        const [ci, co] = S[ion], rr = rng(ion.charCodeAt(0) * 7);
        const ni = Math.round(clamp(Math.log10(ci + 1) * 6, 2, 16)), no = Math.round(clamp(Math.log10(co + 1) * 6, 2, 16));
        for (let i = 0; i < no; i++) { const x = rr() * mx1, y = 10 + rr() * (my - gap / 2 - 22), ph = rr() * 6; Gfx.sphere(c, x + Math.sin(time * .7 + ph) * 6, y + Math.cos(time * .6 + ph) * 5, 4.4, COLI[ion], { a: .9 }); }
        for (let i = 0; i < ni; i++) { const x = rr() * mx1, y = my + gap / 2 + 12 + rr() * (H - my - gap / 2 - 22), ph = rr() * 6; Gfx.sphere(c, x + Math.sin(time * .7 + ph) * 6, y + Math.cos(time * .6 + ph) * 5, 4.4, COLI[ion], { a: .9 }); }
      }
      // заряди
      const q = clamp(Math.abs(V) / 100, .1, 1);
      for (let x = 14; x < mx1; x += 22) { c.font = `700 13px ${FM()}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = `rgba(179,54,58,${.25 + .6 * q})`; c.fillText(V < 0 ? "−" : "+", x, my + gap / 2 + 9); c.fillStyle = `rgba(42,106,147,${.25 + .6 * q})`; c.fillText(V < 0 ? "+" : "−", x + 11, my - gap / 2 - 9); }
      // шкала потенціалів
      const px = W * .7, pw = W * .26, y0 = H * .1, hh = H * .8, vmin = -130, vmax = 80, Yv = v => y0 + (vmax - v) / (vmax - vmin) * hh;
      c.fillStyle = Theme.dark ? "#10241a" : "#F6F9F3"; Gfx.rr(c, px - 40, y0 - 14, pw + 46, hh + 28, 10); c.fill(); c.strokeStyle = T0.rule; c.stroke();
      c.strokeStyle = T0.rule; for (let v = -120; v <= 80; v += 40) { c.beginPath(); c.moveTo(px - 4, Yv(v)); c.lineTo(px + pw, Yv(v)); c.stroke(); Gfx.text(c, v, px - 8, Yv(v), { align: "right", base: "middle", size: 10, color: T0.muted }); }
      Gfx.text(c, "мВ", px - 34, y0 - 4, { size: 10, color: T0.muted });
      const lines = [["E(K⁺)", E("K"), COLI.K], ["E(Cl⁻)", E("Cl"), COLI.Cl], ["E(Na⁺)", E("Na"), COLI.Na], ["V спокою", V, "#B3363A"]];
      const ly = []; lines.forEach(([n, v, col], i) => { const y = Yv(clamp(v, vmin, vmax)); c.strokeStyle = col; c.lineWidth = i === 3 ? 3.5 : 2.2; c.beginPath(); c.moveTo(px + i * pw * .07, y); c.lineTo(px + pw, y); c.stroke(); ly.push({ i, y, n, v, col }); });
      ly.sort((p1, p2) => p1.y - p2.y); let lastY = -1e9; for (const q of ly) { const yy = Math.max(q.y - 9, lastY + 14); lastY = yy; Gfx.text(c, `${q.n}  ${NA(q.v, 0)}`, px + pw - 3, yy, { align: "right", base: "middle", size: 10.5, color: q.col, weight: 700 }); }
      c.lineWidth = 1;
      rdA.set("EK", NA(E("K"), 1), "мВ"); rdA.set("ENa", NA(E("Na"), 1), "мВ"); rdA.set("ECl", NA(E("Cl"), 1), "мВ"); rdA.set("V", NA(V, 1), "мВ");
      const pts = []; const old = S.K[1]; for (let e = -.3; e <= 2.0; e += .1) { S.K[1] = Math.pow(10, e); pts.push([e, Vm()]); } S.K[1] = old;
      drawChart(cA1, { x: [-.3, 2], y: [-130, 20], xl: "lg [K⁺]зовні", yl: "мВ", series: [{ pts, color: "#6A4FB5", w: 2.6 }], marks: [{ x: Math.log10(S.K[1]), y: V, color: "#B3363A", label: "зараз" }] });
      drawChart(cA2, { x: [0, 5], y: [-130, 90], yl: "мВ", xt: [], series: [{ bars: true, bw: 40, color: COLI.K, pts: [[.7, E("K")]] }, { bars: true, bw: 40, color: COLI.Cl, pts: [[1.7, E("Cl")]] }, { bars: true, bw: 40, color: COLI.Na, pts: [[2.7, E("Na")]] }, { bars: true, bw: 40, color: "#B3363A", pts: [[3.9, V]] }], hl: [{ y: 0, color: T0.muted }], legend: [{ label: "E(K⁺)", color: COLI.K }, { label: "E(Cl⁻)", color: COLI.Cl }, { label: "E(Na⁺)", color: COLI.Na }, { label: "V спокою", color: "#B3363A" }] });
    }

    /* ===================== B. Ходжкін–Хакслі ===================== */
    const HH = { V: -65, m: .053, h: .596, n: .318, t: 0, I: 0, pulse: 0, tail: 0, tx: 0, hist: [], last: 0, gNa: 120, gK: 36, gL: .3, ENa: 50, EK: -77, EL: -54.4, T: 6.3, ttx: false, tea: false, dc: 0, NaOut: 440, spd: 3 };
    const am = (V) => Math.abs(V + 40) < 1e-6 ? 1 : .1 * (V + 40) / (1 - Math.exp(-(V + 40) / 10)), bm = (V) => 4 * Math.exp(-(V + 65) / 18);
    const ah = (V) => .07 * Math.exp(-(V + 65) / 20), bh = (V) => 1 / (1 + Math.exp(-(V + 35) / 10));
    const an = (V) => Math.abs(V + 55) < 1e-6 ? .1 : .01 * (V + 55) / (1 - Math.exp(-(V + 55) / 10)), bn = (V) => .125 * Math.exp(-(V + 65) / 80);
    function hhStep(dt) {
      const phi = Math.pow(3, (HH.T - 6.3) / 10), gNa = HH.ttx ? 0 : HH.gNa, gK = HH.tea ? 0 : HH.gK;
      const ENa = 50 + 61.5 * Math.log10(HH.NaOut / 440) * (HH.T + 273) / 310;
      let I = HH.dc + (HH.pulse > 0 ? HH.amp : 0);
      const dV = (-gNa * HH.m ** 3 * HH.h * (HH.V - ENa) - gK * HH.n ** 4 * (HH.V - HH.EK) - HH.gL * (HH.V - HH.EL) + I) / 1;
      const V = HH.V; HH.V += dV * dt;
      HH.m += phi * (am(V) * (1 - HH.m) - bm(V) * HH.m) * dt; HH.h += phi * (ah(V) * (1 - HH.h) - bh(V) * HH.h) * dt; HH.n += phi * (an(V) * (1 - HH.n) - bn(V) * HH.n) * dt;
      HH.pulse = Math.max(0, HH.pulse - dt); HH.t += dt;
      HH.iNa = gNa * HH.m ** 3 * HH.h * (HH.V - ENa); HH.iK = gK * HH.n ** 4 * (HH.V - HH.EK); HH.gNa_t = gNa * HH.m ** 3 * HH.h; HH.gK_t = gK * HH.n ** 4; HH.ENa_now = ENa;
    }
    HH.amp = 15; HH.tStim = 0;
    const stim = (dt0 = 0) => { HH.pulse = 1; HH.tStim = HH.t + dt0; };
    const stB = new Stage(B.st, { aspect: 2.0, minH: 260, maxH: 400, tag: "Аксон: Na⁺- і K⁺-канали" });
    const rdB = UI.reads(B.st, [["V", "V мембрани"], ["m3h", "g(Na⁺)"], ["n4", "g(K⁺)"], ["t", "t"]]);
    UI.slider(B.ct, { id: "p4b-a", label: "Амплітуда імпульсу струму", min: 2, max: 40, step: 1, value: HH.amp, unit: "мкА/см²", on: v => HH.amp = v });
    UI.buttons(B.ct, [{ label: "⚡ Подразнити (1 мс)", pri: true, on: () => { stim(); } }, { label: "Подвійний імпульс (через 8 мс)", on: () => { stim(); HH.again = HH.t + 8; } }]);
    UI.slider(B.ct, { id: "p4b-dc", label: "Постійний струм", min: 0, max: 30, step: 1, value: 0, unit: "мкА/см²", on: v => HH.dc = v });
    UI.slider(B.ct, { id: "p4b-T", label: "Температура", min: 6.3, max: 30, step: .5, value: HH.T, unit: "°C", on: v => HH.T = v });
    UI.slider(B.ct, { id: "p4b-na", label: "[Na⁺] зовні", min: 50, max: 500, step: 10, value: HH.NaOut, unit: "мМ", on: v => HH.NaOut = v });
    UI.check(B.ct, { id: "p4b-ttx", label: "Тетродотоксин (блокує Na⁺-канали)", value: false, on: v => HH.ttx = v });
    UI.check(B.ct, { id: "p4b-tea", label: "ТЕА (блокує K⁺-канали)", value: false, on: v => HH.tea = v });
    UI.slider(B.ct, { id: "p4b-sp", label: "Швидкість моделі", min: .5, max: 8, step: .5, value: HH.spd, on: v => HH.spd = v, fmt: v => "×" + NA(v, 1) });
    UI.tip(B.ct, "Модель Ходжкіна–Хакслі: деполяризація відкриває <b>m-ворота</b> Na⁺-каналів (швидко), потім Na⁺ входить; повільніше закриваються <b>h-ворота</b> (інактивація) й відкриваються K⁺-канали (<b>n</b>), мембрана реполяризується.");
    const chB = h("div", { class: "charts" }); B.bl.append(chB);
    const cB1 = UI.chart(chB, "Мембранний потенціал V(t), мВ", { aspect: 2.1 });
    const cB2 = UI.chart(chB, "Змінні воріт m, h, n", { aspect: 2.1 });
    const cB3 = UI.chart(chB, "Провідності g(Na⁺), g(K⁺), мСм/см²", { aspect: 2.1 });
    function drawB(time) {
      const c = stB.ctx, W = stB.W, H = stB.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      const my = H * .5, gap = 26;
      const o = c.createLinearGradient(0, 0, 0, my); o.addColorStop(0, Theme.dark ? "#16303f" : "#D9EAF6"); o.addColorStop(1, Theme.dark ? "#1b3b4d" : "#C4DDEE"); c.fillStyle = o; c.fillRect(0, 0, W, my);
      const ii = c.createLinearGradient(0, my, 0, H); ii.addColorStop(0, Theme.dark ? "#2b4430" : "#E4EFD2"); ii.addColorStop(1, Theme.dark ? "#223a29" : "#D6E7BC"); c.fillStyle = ii; c.fillRect(0, my, W, H - my);
      const NAX = [.12, .40, .68], KX = [.26, .54, .82];
      const skip = (x) => NAX.some(f => Math.abs(x - W * f) < 22) || KX.some(f => Math.abs(x - W * f) < 20);
      Gfx.bilayer(c, 0, W, my, gap, time, { s: 1.15, skip });
      const mOpen = HH.m ** 3, hOpen = HH.h, nOpen = HH.n ** 4;
      // Na⁺-канали: m-«заслінка» зверху, h-«кулька» знизу; K⁺-канали: ворота n⁴
      NAX.forEach((f, k) => { const x = W * f; Gfx.channel(c, x, my, gap, 38, clamp(mOpen * hOpen * 1.6, .06, 1), "#4FA9D0");
        c.fillStyle = "#2A6A93"; c.fillRect(x - 15 + mOpen * 12, my - gap / 2 - 9, 30 - mOpen * 22, 5);
        Gfx.sphere(c, x, my + gap / 2 + 6 + hOpen * 2, 4 + (1 - hOpen) * 9, "#C77A12"); });
      KX.forEach(f => Gfx.channel(c, W * f, my, gap, 38, clamp(nOpen * 2.2, .06, 1), "#8D7BD0"));
      Gfx.chip(c, "Na⁺-канали: ворота m (вгорі) · h (внизу)", W * NAX[1], my - gap / 2 - 36, { align: "center", size: 10 });
      Gfx.chip(c, "K⁺-канали: ворота n⁴", W * KX[1], my + gap / 2 + 38, { align: "center", size: 10 });
      // іони
      const rr = rng(4); for (let i = 0; i < 22; i++) { const x = rr() * W, y = 40 + rr() * (my - gap / 2 - 70); Gfx.sphere(c, x + Math.sin(time + i) * 5, y + Math.cos(time * .8 + i) * 4, 4.3, COLI.Na, { a: .85 }); }
      for (let i = 0; i < 18; i++) { const x = rr() * W, y = my + gap / 2 + 52 + rr() * (H - my - gap / 2 - 74); Gfx.sphere(c, x + Math.sin(time + i) * 5, y + Math.cos(time * .8 + i) * 4, 4.3, COLI.K, { a: .85 }); }
      // потоки через канали: Na⁺ досередини, K⁺ назовні
      const fNa = clamp(-HH.iNa / 800, 0, 1), fK = clamp(HH.iK / 400, 0, 1);
      for (let k = 0; k < 5; k++) { const ph = (time * 1.4 + k / 5) % 1;
        if (fNa > .02) NAX.forEach((f, j) => Gfx.sphere(c, W * f + Math.sin(k + j) * 4, my - gap - 6 + ph * (gap * 2 + 12), 5, COLI.Na, { a: fNa * .5 + .35 }));
        if (fK > .02) KX.forEach((f, j) => Gfx.sphere(c, W * f + Math.sin(k + j) * 4, my + gap + 6 - ph * (gap * 2 + 12), 5, COLI.K, { a: fK * .5 + .35 })); }
      // заряди
      const q = clamp(Math.abs(HH.V + 65) / 120, 0, 1), pos = HH.V > -20;
      for (let x = 12; x < W; x += 24) { c.font = `700 13px ${FM()}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = pos ? "rgba(42,106,147,.8)" : "rgba(179,54,58,.6)"; c.fillText(pos ? "+" : "−", x, my + gap / 2 + 9); c.fillStyle = pos ? "rgba(179,54,58,.8)" : "rgba(42,106,147,.55)"; c.fillText(pos ? "−" : "+", x + 12, my - gap / 2 - 9); }
      Gfx.chip(c, `V = ${NA(HH.V, 1)} мВ`, 12, H - 16, { size: 12, weight: 700 }); Gfx.chip(c, HH.V > 0 ? "ПОТЕНЦІАЛ ДІЇ" : HH.V < -70 ? "гіперполяризація (рефрактерність)" : "спокій", W - 12, 16, { align: "right", size: 11, fg: HH.V > 0 ? "#B3363A" : T0.ink });
    }
    function chartsB() {
      // вікно: від −5 мс до +40 мс відносно останнього стимулу; потім — прокручування
      const H = HH.hist, W0 = 45, x0 = HH.t < HH.tStim + W0 - 5 ? Math.max(0, HH.tStim - 5) : HH.t - W0;
      drawChart(cB1, { x: [x0, x0 + 45], y: [-90, 60], xl: "t, мс", series: [{ pts: H.map(r => [r[0], r[1]]), color: "#B3363A", w: 2.4 }], hl: [{ y: -65, color: T0c().muted }, { y: 0, color: T0c().muted, dash: [2, 3] }] });
      drawChart(cB2, { x: [x0, x0 + 45], y: [0, 1], xl: "t, мс", series: [{ pts: H.map(r => [r[0], r[2]]), color: "#2A6A93", w: 2.2 }, { pts: H.map(r => [r[0], r[3]]), color: "#C77A12", w: 2.2 }, { pts: H.map(r => [r[0], r[4]]), color: "#6A4FB5", w: 2.2 }], legend: [{ label: "m", color: "#2A6A93" }, { label: "h", color: "#C77A12" }, { label: "n", color: "#6A4FB5" }] });
      drawChart(cB3, { x: [x0, x0 + 45], y: [0, 40], xl: "t, мс", series: [{ pts: H.map(r => [r[0], r[5]]), color: "#2A8FB5", w: 2.2 }, { pts: H.map(r => [r[0], r[6]]), color: "#6A4FB5", w: 2.2 }], legend: [{ label: "g(Na⁺)", color: "#2A8FB5" }, { label: "g(K⁺)", color: "#6A4FB5" }] });
    }
    const T0c = () => Theme.c;
    const rec = () => { HH.hist.push([HH.t, HH.V, HH.m, HH.h, HH.n, HH.gNa_t || 0, HH.gK_t || 0]); if (HH.hist.length > 4000) HH.hist.shift(); };
    function resetB() { Object.assign(HH, { V: -65, m: .053, h: .596, n: .318, t: 0, pulse: 0, hist: [], again: 3, tStim: 3 }); hhStep(0); rec(); }
    resetB();

    /* ===================== C. Плазмоліз ===================== */
    const SOL = { k: { name: "KNO₃", eta: c => 1 / (1 + .9 * c), cK: 1 }, ca: { name: "Ca(NO₃)₂", eta: c => 1 + 1.4 * c, cK: 0 }, na: { name: "NaCl", eta: c => 1 / (1 + .15 * c), cK: 0 }, suc: { name: "сахароза", eta: c => 1, cK: 0 } };
    const Pl = { s: "k", c: 1.0, t: 0, run: true, kap: 1, vol: 1 };
    const stC = new Stage(C.st, { aspect: 1.9, minH: 300, maxH: 440, tag: "Епідерма цибулі під мікроскопом" });
    const rdC = UI.reads(C.st, [["sol", "Розчин"], ["eta", "Відн. в’язкість η/η₀"], ["tau", "Час опуклого плазмолізу"], ["ph", "Форма"]]);
    UI.select(C.ct, { id: "p4c-s", label: "Плазмолітик", value: "k", options: [["k", "KNO₃ (одновалентний K⁺)"], ["ca", "Ca(NO₃)₂ (двовалентний Ca²⁺)"], ["na", "NaCl"], ["suc", "Сахароза (контроль)"]], on: v => { Pl.s = v; resetC(); } });
    UI.slider(C.ct, { id: "p4c-c", label: "Концентрація", min: .4, max: 1.4, step: .05, value: Pl.c, unit: "М", on: v => { Pl.c = v; resetC(); }, fmt: v => NA(v, 2) });
    UI.buttons(C.ct, [{ label: "Занурити зрізи заново", pri: true, on: () => resetC() }]);
    UI.tip(C.ct, "Одновалентні катіони підвищують гідратацію колоїдів і <b>зменшують</b> в’язкість цитоплазми → опуклий плазмоліз настає швидше. Двовалентні (Ca²⁺) коагулюють і дегідратують білки, <b>підвищують</b> в’язкість → форма довго лишається ввігнутою.");
    const chC = h("div", { class: "charts" }); C.bl.append(chC);
    const cC1 = UI.chart(chC, "Час до опуклого плазмолізу від концентрації (за типом іона)");
    const tbC = h("div", { class: "tblwrap" }); C.bl.append(h("div", { class: "chart" }, h("h4", null, "Порівняння розчинів (модельні значення при вибраній концентрації)"), tbC));
    const tauOf = (s, c) => 8.8 * SOL[s].eta(c); // хв до опуклого плазмолізу (KNO₃ 1 М ≈ 4,6 хв)
    function resetC() { Pl.t = 0; Pl.kap = 1; Pl.vol = 1; }
    function drawC(time) {
      const c = stC.ctx, W = stC.W, H = stC.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      const bg = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * .7); bg.addColorStop(0, "#FBF6EE"); bg.addColorStop(1, "#D8CDBD"); c.fillStyle = Theme.dark ? "#1a1612" : bg; c.fillRect(0, 0, W, H);
      const cx = W * .5, cy = H * .5, cw = W * .72, ch = H * .56;
      // клітини (три в ряд) — центральна у фокусі
      const protoPath = (x, y, w, hh, rc, bx, by) => { // rc — радіус кутів; bx, by > 0 — опуклі бокові сторони, < 0 — ввігнуті
        const l = x - w / 2, r = x + w / 2, t = y - hh / 2, b = y + hh / 2;
        c.beginPath(); c.moveTo(l + rc, t); c.quadraticCurveTo(x, t - by, r - rc, t); c.quadraticCurveTo(r, t, r, t + rc);
        c.quadraticCurveTo(r + bx, y, r, b - rc); c.quadraticCurveTo(r, b, r - rc, b); c.quadraticCurveTo(x, b + by, l + rc, b);
        c.quadraticCurveTo(l, b, l, b - rc); c.quadraticCurveTo(l - bx, y, l, t + rc); c.quadraticCurveTo(l, t, l + rc, t); c.closePath();
      };
      const cell = (x, y, w, hh, sc, focus) => {
        c.fillStyle = "#F2E9D2"; Gfx.rr(c, x - w / 2, y - hh / 2, w, hh, 6); c.fill(); c.lineWidth = 3; c.strokeStyle = "#B59B6E"; c.stroke();
        c.lineWidth = 1; c.strokeStyle = "rgba(181,155,110,.45)"; Gfx.rr(c, x - w / 2 + 4, y - hh / 2 + 4, w - 8, hh - 8, 4); c.stroke();
        const pw = clamp(sc.vol, .3, 1), cur = sc.kap;
        const W2 = (w - 10) * (.34 + .64 * pw), H2 = (hh - 10) * (.5 + .46 * pw);
        const rc = lerp(Math.min(W2, H2) * .46, 5, cur), bx = lerp(.06, -.2, cur) * W2, by = lerp(.05, -.1, cur) * H2;
        // нитки Хехта: мембрана лишається прикріпленою до стінки у кутах
        if (cur > .2 && pw < .97) { c.strokeStyle = "rgba(110,50,100,.5)"; c.lineWidth = 1; for (let k = 0; k < 6; k++) { const yy = y - H2 / 2 + (k + .5) * H2 / 6; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x + sd * (W2 / 2 - 2 + bx * .5 * (-1)), yy); c.quadraticCurveTo(x + sd * (w / 2 - 14), yy + Math.sin(k * 2 + sd) * 4, x + sd * (w / 2 - 5), yy + Math.sin(k + sd) * 5); c.stroke(); } } }
        protoPath(x, y, W2, H2, rc, bx, by);
        const g = c.createRadialGradient(x - W2 * .15, y - H2 * .2, 4, x, y, Math.max(W2, H2) * .62); g.addColorStop(0, "#CF8CBF"); g.addColorStop(.6, "#9A4592"); g.addColorStop(1, "#6C2B67"); c.fillStyle = g; c.fill(); c.strokeStyle = "#4D1C4A"; c.lineWidth = 2; c.stroke();
        c.save(); protoPath(x, y, W2, H2, rc, bx, by); c.clip(); const rg2 = rng(9); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${.04 + rg2() * .06})`; c.beginPath(); c.arc(x + (rg2() - .5) * W2, y + (rg2() - .5) * H2, 1 + rg2() * 3, 0, 7); c.fill(); } c.restore();
        if (focus) { Gfx.sphere(c, x - W2 * .25, y - H2 * .18, Math.min(W2, H2) * .1, "#8EA2C9"); }
        return { px: x, py: y, pwid: W2, phh: H2 };
      };
      cell(cx - cw * .5, cy - ch * .1, cw * .3, ch * .8, { vol: Pl.vol, kap: Pl.kap }, false); cell(cx + cw * .5, cy + ch * .08, cw * .3, ch * .8, { vol: Pl.vol, kap: Pl.kap }, false);
      const g = cell(cx, cy, cw * .5, ch, { vol: Pl.vol, kap: Pl.kap }, true);
      // цитоплазматична течія: частинки з швидкістю ∝ 1/η
      const eta = SOL[Pl.s].eta(Pl.c); const rr = rng(31); const spd = 1 / eta;
      for (let i = 0; i < 26; i++) { const ph = rr() * 6.28, rad = (.15 + rr() * .3), ang = (time * .5 * spd + ph) % 6.28; const x = g.px + Math.cos(ang) * g.pwid * rad * 1.5, y = g.py + Math.sin(ang) * g.phh * rad * 1.3; Gfx.sphere(c, x, y, 2.6, "#DCEFA8", { a: .9 }); }
      for (let i = 0; i < 5; i++) { const a2 = (time * .3 * spd + i * 1.26) % 6.28; Gfx.sphere(c, g.px + Math.cos(a2) * g.pwid * .28, g.py + Math.sin(a2) * g.phh * .28, 5.5, "#3E9B4E"); }
      Gfx.chip(c, `t = ${NA(Pl.t, 1)} хв`, 12, H - 16, { size: 11.5 }); Gfx.chip(c, `${SOL[Pl.s].name} · ${NA(Pl.c, 2)} М`, W - 12, 16, { align: "right", size: 11.5 });
      const label = Pl.kap > .55 ? "ввігнутий плазмоліз" : Pl.kap > .12 ? "перехід до випуклого" : "випуклий плазмоліз";
      Gfx.chip(c, label, W / 2, H - 16, { align: "center", size: 12, fg: Pl.kap > .55 ? "#C77A12" : "#2C7A4D" });
      const tau = tauOf(Pl.s, Pl.c);
      rdC.set("sol", SOL[Pl.s].name); rdC.set("eta", NA(eta, 2)); rdC.set("tau", NA(tau, 1), "хв"); rdC.set("ph", label);
      const lines = ["k", "ca", "na", "suc"].map(s => `<tr${s === Pl.s ? ' style="background:var(--chl-soft)"' : ""}><td>${SOL[s].name}</td><td class="n">${NA(SOL[s].eta(Pl.c), 2)}</td><td class="n">${NA(tauOf(s, Pl.c), 1)}</td></tr>`).join("");
      UI.html(tbC, `<table class="t"><thead><tr><th>Плазмолітик</th><th>η/η₀</th><th>час опуклого, хв</th></tr></thead><tbody>${lines}</tbody></table>`);
      const mk2 = (s) => { const p = []; for (let cc = .4; cc <= 1.4; cc += .1) p.push([cc, tauOf(s, cc)]); return p; };
      drawChart(cC1, { x: [.4, 1.4], y: [0, 25], xl: "c, М", yl: "хв", series: [{ pts: mk2("k"), color: "#6A4FB5", w: 2.4 }, { pts: mk2("ca"), color: "#B3363A", w: 2.4 }, { pts: mk2("na"), color: "#2A6A93", w: 2 }], marks: [{ x: Pl.c, y: tauOf(Pl.s, Pl.c), color: "#2C7A4D", label: "зараз" }], legend: [{ label: "KNO₃", color: "#6A4FB5" }, { label: "Ca(NO₃)₂", color: "#B3363A" }, { label: "NaCl", color: "#2A6A93" }] });
    }
    function stepC(dt) {
      Pl.t += dt * .25; const tw = .8;
      Pl.vol = .3 + .7 * Math.exp(-Pl.t / tw) * 1; Pl.vol = clamp(Pl.vol - .0 * 0, .3, 1);
      Pl.kap = Math.exp(-2.12 * Pl.t / tauOf(Pl.s, Pl.c)); // kap < 0,12 ≈ опуклий
    }

    M.init();
    return {
      stages: [stA, cA1, cA2, stB, cB1, cB2, cB3, stC, cC1],
      frame(dt, t) {
        if (mode === "a") drawA(t);
        else if (mode === "b") {
          if (dt > 0) { const sim = dt * 1000 * HH.spd * .01, n = Math.ceil(sim / .02); const hdt = sim / n; for (let i = 0; i < n; i++) { if (HH.again != null && HH.t >= HH.again) { stim(); HH.again = null; } hhStep(hdt); if (HH.t - HH.last > .1) { HH.last = HH.t; rec(); } } }
          drawB(t); chartsB(); rdB.set("V", NA(HH.V, 1), "мВ"); rdB.set("m3h", NA(HH.gNa_t || 0, 1)); rdB.set("n4", NA(HH.gK_t || 0, 1)); rdB.set("t", NA(HH.t, 1), "мс");
        } else { if (dt > 0) stepC(dt); drawC(t); }
      },
    };
  },
});

})();
