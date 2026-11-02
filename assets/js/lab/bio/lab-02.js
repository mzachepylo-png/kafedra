// ПЗ 2: теорія, модель, питання (код згенеровано з вихідних файлів).
(() => {
"use strict";
const { hash01, App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb } = window.BIO;
/* ПЗ 2. Ентальпія, закон Гесса, зсув рівноваги «йод — крохмаль», закон Фур'є */
App.def(2, {
  cheat: "<p class=\"lead\">Біохімічні перетворення змінюють внутрішню енергію системи: внутрішня енергія продуктів не дорівнює енергії реагентів. Різниця виділяється або поглинається у вигляді теплоти. Ця тема вчить рахувати теплові ефекти реакцій, користуватися законом Гесса й розуміти, чому температура зсуває хімічну рівновагу.</p><h3>Ентальпія</h3><p><b>Тепловий ефект біохімічної реакції</b> — це теплота, що виділяється або поглинається внаслідок реакції, тобто величина хімічної енергії, яку позначають <b>ентальпією H</b> (від грецького «нагріваю»). Ентальпія залежить від параметрів стану: внутрішньої енергії <var>U</var>, тиску <var>P</var> та об’єму <var>V</var>:</p><div class=\"eq\"><var>H</var> = <var>U</var> + <var>PV</var><span class=c>ентальпія = внутрішня енергія + добуток тиску на об’єм</span></div><p>Ентальпія всієї системи дорівнює сумі ентальпій її складових. Для сталого тиску (<var>P</var> = const) виконується <b>d<var>Q</var> = d<var>H</var></b>: ентальпія — функція, що показує, скільки хімічної енергії можна перетворити на теплоту. Оскільки <var>H</var> залежить від кількості речовини, її зміну Δ<var>H</var> відносять до одного моля й вимірюють у кДж/моль. У ізобарному процесі виділена теплота дорівнює зміні ентальпії: <b><var>Q</var><sub>p</sub> = Δ<var>H</var></b>.</p><div class=\"bf-gal bf-gal--1\"><figure class=\"bf \"><a href=\"../../assets/img/bio/calorimeter.webp\" data-lightbox data-caption=\"Калориметр: прилад, у якому за зміною температури визначають тепловий ефект реакції чи згоряння речовини. Фото: Maciej J. Mrowinski, Wikimedia Commons · CC BY-SA 4.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/calorimeter.webp\" alt=\"Калориметр: прилад, у якому за зміною температури визначають тепловий ефект реакції чи згоряння речовини.\" width=\"750\" height=\"1000\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Калориметр: прилад, у якому за зміною температури визначають тепловий ефект реакції чи згоряння речовини.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Kalorimeter.png\" target=\"_blank\" rel=\"noopener\">Maciej J. Mrowinski</a> · CC BY-SA 4.0</span></figcaption></figure></div><h3>Тепловий ефект реакції та закон Гесса</h3><p>Тепловим ефектом біохімічної реакції називають теплоту, що виділяється чи поглинається за таких умов: (1) тиск або об’єм постійні; (2) не виконується жодної роботи, крім роботи розширення; (3) температура вихідних речовин і продуктів однакова (<var>T</var><sub>1</sub> = <var>T</var><sub>2</sub>).</p><div class=\"bcall bcall--idea\"><b>Закон Гесса</b><p>Тепловий ефект реакції, що проходить за постійного тиску або сталого об’єму, <b>не залежить від шляху</b>, а визначається лише станом вихідних речовин і продуктів. Термодинамічна основа цього закону — незалежність теплового ефекту від способу перебігу реакції (ентальпія є функцією стану).</p></div><p>Практична цінність закону: він дозволяє розрахувати тепловий ефект реакції <b>теоретично</b>, не вдаючись до експерименту. Часто використовують наслідок: Δ<var>H</var> реакції дорівнює сумі ентальпій утворення продуктів мінус сума ентальпій утворення реагентів (з урахуванням стехіометричних коефіцієнтів).</p><div class=\"eq\">Δ<var>H</var><sub>х.р.</sub> = Σ <var>ν</var><sub>прод</sub> Δ<var>H</var><sub>f</sub> − Σ <var>ν</var><sub>реаг</sub> Δ<var>H</var><sub>f</sub></div><h4>Знаки й порівняння ΔH з Q</h4><p>За загальним правилом знаків позитивною вважають теплоту, що надходить <i>до системи</i>. Тому для <b>ендотермічної</b> реакції (з поглинанням теплоти) Δ<var>H</var> &gt; 0, а для <b>екзотермічної</b> (з виділенням теплоти) Δ<var>H</var> &lt; 0. Ентальпія реакції Δ<var>H</var> характеризує тепловий стан реагуючої системи, а теплота <var>Q</var> — довкілля, тому вони мають протилежні знаки: <b><var>Q</var> = −Δ<var>H</var></b>.</p><div class=\"tblwrap\"><table class=\"t bt \"><thead><tr><th></th><th>Екзотермічна реакція</th><th>Ендотермічна реакція</th></tr></thead><tbody><tr><td>Теплота</td><td>виділяється в довкілля, +Q</td><td>поглинається з довкілля, −Q</td></tr><tr><td>Ентальпія системи</td><td>зменшується: H<sub>прод</sub> &lt; H<sub>реаг</sub></td><td>зростає: H<sub>прод</sub> &gt; H<sub>реаг</sub></td></tr><tr><td>Знак ΔH</td><td>ΔH &lt; 0</td><td>ΔH &gt; 0</td></tr><tr><td>Приклад</td><td>окиснення глюкози, гідроліз АТФ</td><td>фотосинтез, розчинення NH₄NO₃</td></tr></tbody></table></div><div class=\"bcall bcall--warn\"><b>Уточнення до тексту методички</b><p>Для ендотермічних реакцій у тексті методички надруковано «ΔH &lt; 0» — це описка: ендотермічна реакція має <b>ΔH &gt; 0</b> (ентальпія продуктів більша). Також Q ≠ ΔH за змістом, хоч їх модулі й можуть збігатися: ΔH віднесено до 1 моль речовини за P = const, а Q — до довільної кількості за будь-яких умов.</p></div><h4>Що впливає на тепловий ефект</h4><ul><li><b>Агрегатний (фазовий) стан</b> реагентів і продуктів (наприклад, вода рідка чи пара).</li><li><b>Температура</b>: у межах практичних температур і тисків залежність невелика, тому для неточних розрахунків ΔH вважають сталою.</li><li><b>Умови перебігу</b>: за сталого тиску чи за сталого об’єму.</li></ul><p>Перший закон термодинаміки застосовують і до біологічних об’єктів: порівнюють енергію, поглинуту з їжею, і теплову енергію, виділену організмом. Але він характеризує лише кількісні перетворення й <b>не показує спрямованості та ймовірності процесу</b> — для цього потрібен другий закон (ентропія).</p><h3>Зсув хімічної рівноваги: принцип Ле Шательє</h3><p>Принцип рухомої рівноваги: якщо змінити одну з умов, за яких система перебуває у стані рівноваги, то відбувається таке зміщення рівноваги, яке <b>послаблює</b> цю зміну. Для температури кількісний зв’язок дає рівняння ван’т-Гоффа:</p><div class=\"eq\">ln <span class=\"fr\"><span><var>K</var><sub>2</sub></span><span><var>K</var><sub>1</sub></span></span> = − <span class=\"fr\"><span>Δ<var>H</var></span><span><var>R</var></span></span>(<span class=\"fr\"><span>1</span><span><var>T</var><sub>2</sub></span></span> − <span class=\"fr\"><span>1</span><span><var>T</var><sub>1</sub></span></span>)<span class=c>для екзотермічної реакції (ΔH < 0) K зменшується з нагріванням</span></div><p>Звідси: нагрівання зсуває рівновагу в бік ендотермічного напрямку, охолодження — в бік екзотермічного.</p><div class=\"bf-gal bf-gal--2\"><figure class=\"bf \"><a href=\"../../assets/img/bio/iodine.webp\" data-lightbox data-caption=\"Синій комплекс йоду з крохмалем: поліодидні ланцюги вбудовуються в спіраль амілози. Фото: Mezhenskyj, Wikimedia Commons · CC BY-SA 4.0\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/iodine.webp\" alt=\"Синій комплекс йоду з крохмалем: поліодидні ланцюги вбудовуються в спіраль амілози.\" width=\"750\" height=\"1000\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Синій комплекс йоду з крохмалем: поліодидні ланцюги вбудовуються в спіраль амілози.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Iodine-starch_test_for_apples.jpg\" target=\"_blank\" rel=\"noopener\">Mezhenskyj</a> · CC BY-SA 4.0</span></figcaption></figure><figure class=\"bf \"><a href=\"../../assets/img/bio/iodine2.webp\" data-lightbox data-caption=\"Проба з йодом на крохмаль у лунках: фіолетово-синє забарвлення в присутності крохмалю, жовте — у його відсутності. Фото: Flo Sorg, Wikimedia Commons · Public domain\" aria-label=\"Відкрити зображення\"><img src=\"../../assets/img/bio/iodine2.webp\" alt=\"Проба з йодом на крохмаль у лунках: фіолетово-синє забарвлення в присутності крохмалю, жовте — у його відсутності.\" width=\"1000\" height=\"697\" loading=\"lazy\" decoding=\"async\"></a><figcaption>Проба з йодом на крохмаль у лунках: фіолетово-синє забарвлення в присутності крохмалю, жовте — у його відсутності.<span class=\"bf-cr\"><a href=\"https://commons.wikimedia.org/wiki/File:Jodprobe.jpg\" target=\"_blank\" rel=\"noopener\">Flo Sorg</a> · Public domain</span></figcaption></figure></div><h3>Лабораторна робота: вплив температури на зсув рівноваги</h3><p>Під час взаємодії йоду з крохмалем утворюється адсорбційна сполука складної будови синього кольору. Реакція екзотермічна, її рівновагу умовно записують так: <b>йод + крохмаль ⇄ йодо-крохмальний комплекс</b>.</p><details class=\"bproto\"><summary>Хід роботи (скорочено)</summary><div><ol class=\"bsteps\"><li>У пробірку налийте 4–5 мл 1 % розчину крохмалю й додайте 1 краплю 0,1 М розчину йоду до появи синього забарвлення.</li><li>Нагрійте пробірку на водяній бані й зафіксуйте забарвлення.</li><li>Охолодіть ту саму пробірку водою з-під крана й знову спостерігайте.</li><li>Поясніть зміну кольору принципом Ле Шательє; зробіть висновок про вплив температури та оборотність зсуву рівноваги.</li></ol></div></details><p><b>Пояснення.</b> Нагрівання зсуває рівновагу <i>вліво</i> (в бік ендотермічного розпаду комплексу): спіраль амілози розкручується, йод виходить із каналу — синій колір зникає. Під час охолодження рівновага зміщується <i>вправо</i>, комплекс утворюється знову, і синє забарвлення повертається.</p><h3>Математична модель</h3><div class=\"bcall bcall--model\"><b>Три моделі теми</b><p><b>1. Йод + крохмаль.</b> Частка зв’язаного йоду α за надлишку крохмалю: α<sub>рівн</sub> = <var>K</var>′/(1 + <var>K</var>′), де <var>K</var>′(T) змінюється за ван’т-Гоффом. Температура пробірки наближається до температури бані за законом Ньютона: d<var>T</var>/d<var>t</var> = (<var>T</var><sub>бані</sub> − <var>T</var>)/τ, а α релаксує до рівноважного значення з константою швидкості, що зростає з температурою.</p><p><b>2. Закон Гесса.</b> Діаграма ентальпій: куля йде прямим шляхом і через проміжні сходинки; суми Δ<var>H</var> збігаються. Повзунок додає штучну помилку, щоб побачити, як порушується баланс.</p><p><b>3. Теплові потоки.</b> Закон Фур’є й конвекція Ньютона для задач 2–3, а також ентропія оборотного плавлення Δ<var>S</var> = <var>Q</var>/<var>T</var>.</p></div><div class=\"eq\"><var>q</var> = <span class=\"fr\"><span><var>λ</var>·Δ<var>T</var></span><span><var>δ</var></span></span> &nbsp; (Фур’є, Вт/м²) &nbsp;&nbsp; <var>q</var> = <var>α</var>(<var>T</var><sub>т</sub> − <var>T</var><sub>п</sub>) &nbsp; (конвекція) &nbsp;&nbsp; Δ<var>S</var> = <span class=\"fr\"><span><var>m</var>·<var>L</var></span><span><var>T</var><sub>пл</sub></span></span></div><dl class=\"vars\"><dt>λ</dt><dd>коефіцієнт теплопровідності, Вт/(м·К)</dd><dt>ΔT</dt><dd>різниця температур на шарі, К</dd><dt>δ</dt><dd>товщина шару, м</dd><dt>α</dt><dd>коефіцієнт тепловіддачі, Вт/(м²·К)</dd><dt>L</dt><dd>питома теплота плавлення, Дж/кг</dd><dt>T</dt><dd>абсолютна температура, К (T = t + 273,15)</dd></dl><h3>Практична частина: задачі</h3><div class=\"bcall bcall--task\"><b>Задача 1</b><p>Визначити зміну ентропії при плавленні 250 г свинцю, якщо <var>T</var><sub>пл</sub> = 327,4 °C, а питома теплота плавлення 23 040 Дж/кг.</p></div><ol class=\"bsteps\"><li>Теплота: <var>Q</var> = 23 040 Дж/кг · 0,25 кг = 5760 Дж. <i>(У розв’язку методички вжито 5750 — це неточність друку; відповідь 9,59 збігається саме з 5760.)</i></li><li><var>T</var> = 327,4 + 273,15 = 600,55 К.</li><li>Δ<var>S</var> = <var>Q</var>/<var>T</var> = 5760 / 600,55 ≈ <b>9,59 Дж/К</b>.</li></ol><div class=\"bcall bcall--task\"><b>Задача 2</b><p>Питомий тепловий потік через шкіру людини, що стоїть на льоду: температура поверхні льоду 0 °C, стопи 34 °C, товщина шкіри 5 мм, λ = 0,3 Вт/(м·К).</p></div><ol class=\"bsteps\"><li>Закон Фур’є: <var>q</var> = <var>λ</var>·Δ<var>T</var>/<var>δ</var> = 0,3 · 34 / 0,005.</li><li><b>q = 2040 Вт/м²</b>.</li></ol><div class=\"bcall bcall--warn\"><b>Про одиницю відповіді</b><p>У методичці відповідь подано як «2040 кДж/год». Числове значення 2040 є потоком у <b>Вт/м²</b>; якщо переводити у кДж/год на 1 м², вийде 2040·3,6 ≈ 7344 кДж/год.</p></div><div class=\"bcall bcall--task\"><b>Задача 3</b><p>Втрата тепла людиною з одиниці поверхні за рахунок конвекції: середня температура поверхні тіла 33 °C, довкілля 20 °C, α = 50 Вт/(м²·К).</p></div><ol class=\"bsteps\"><li><var>q</var> = <var>α</var>(<var>T</var><sub>т</sub> − <var>T</var><sub>п</sub>) = 50 · 13 = <b>650 Вт/м²</b>.</li></ol><div class=\"bcall bcall--task\"><b>Приклад із методички: діалізатор крові</b><p>Мембрана товщиною 1 мм, λ = 0,2 Вт/(м·К), кров 37 °C, діалізат 24 °C; процес стаціонарний. За Фур’є: <var>q</var> = 0,2 · 13 / 0,001 = <b>2600 Вт/м²</b>.</p></div>", qa: [["Що таке ентальпія? Від яких параметрів вона залежить?", "<p>Ентальпія H — функція стану, H = U + PV. Залежить від внутрішньої енергії U, тиску P та об’єму V. За сталого тиску зміна ентальпії дорівнює теплоті процесу (Q<sub>p</sub> = ΔH) і показує, скільки хімічної енергії може бути перетворено на тепло.</p>"], ["Сформулюйте закон Гесса. У чому його практичне значення?", "<p>Тепловий ефект реакції за P = const або V = const не залежить від шляху, а визначається лише початковим і кінцевим станом. Закон дозволяє розраховувати теплові ефекти реакцій теоретично, у тому числі тих, що важко виміряти прямо, за ентальпіями утворення чи спалювання.</p>"], ["Чим відрізняються ΔH і Q? Які знаки вони мають для екзо- й ендотермічних реакцій?", "<p>ΔH характеризує тепловий стан реагуючої системи й віднесена до 1 моль за P = const; Q — теплота, що отримує або віддає довкілля. Вони мають протилежні знаки: екзотермічна реакція — ΔH &lt; 0, Q &gt; 0; ендотермічна — ΔH &gt; 0, Q &lt; 0.</p>"], ["За яких умов виконується співвідношення «тепловий ефект = ΔH»?", "<p>(1) P = const (або V = const); (2) відсутня робота, крім розширення; (3) температура вихідних речовин і продуктів однакова.</p>"], ["Від чого залежить тепловий ефект реакції?", "<p>Від агрегатного стану реагентів і продуктів, від температури (слабко в межах практичних діапазонів) та від умов перебігу — за сталого тиску чи сталого об’єму.</p>"], ["Сформулюйте принцип Ле Шательє. Поясніть, чому забарвлення йодо-крохмального комплексу зникає під час нагрівання й повертається при охолодженні.", "<p>Зміна умов зсуває рівновагу в бік, що послаблює цю зміну. Утворення комплексу екзотермічне, тож нагрівання зсуває рівновагу вліво (комплекс розпадається, колір зникає), а охолодження — вправо (колір повертається). Процес оборотний.</p>"], ["Розрахуйте зміну ентропії при плавленні 250 г свинцю (T<sub>пл</sub> = 327,4 °C, питома теплота плавлення 23 040 Дж/кг).", "<p>Q = 23 040 · 0,25 = 5760 Дж; T = 600,55 К; ΔS = Q/T ≈ 9,59 Дж/К.</p>"], ["Розрахуйте тепловий потік через шкіру (ΔT = 34 К, δ = 5 мм, λ = 0,3 Вт/(м·К)) і через діалізну мембрану (ΔT = 13 К, δ = 1 мм, λ = 0,2 Вт/(м·К)).", "<p>За Фур’є q = λΔT/δ: шкіра — 0,3·34/0,005 = 2040 Вт/м²; мембрана — 0,2·13/0,001 = 2600 Вт/м².</p>"], ["Яка кількість тепла втрачається з 1 м² поверхні тіла внаслідок конвекції при Tт = 33 °C, Tп = 20 °C, α = 50 Вт/(м²·К)?", "<p>q = α(Tт − Tп) = 50 · 13 = 650 Вт/м².</p>"], ["Чому перший закон термодинаміки недостатній для опису біологічних процесів?", "<p>Він лише підраховує кількісні перетворення енергії, не показуючи спрямованості й ймовірності процесу, тому його доповнюють другим законом (ентропія, вільна енергія).</p>"], ["Як залежить константа рівноваги екзотермічної реакції від температури?", "<p>За рівнянням ван’т-Гоффа ln(K₂/K₁) = −(ΔH/R)(1/T₂ − 1/T₁): при ΔH &lt; 0 з підвищенням температури K зменшується, тобто рівновага зміщується у бік реагентів.</p>"]],
  build({ stageBox, ctrls, below, tabsBox }) {
    let mode = "a";
    const M = UI.modes(tabsBox, stageBox, ctrls, below, [["a", "Йод + крохмаль: рівновага"], ["b", "Закон Гесса"], ["c", "Теплові потоки (задачі)"]], id => { mode = id; });
    const A = M.box("a"), B = M.box("b"), C = M.box("c");
    const RG2 = 8.314;

    /* ============ A. Йод–крохмаль у водяній бані ============ */
    const S = { dH: -55, bathTarget: 22, bath: 22, tube: 22, al: 0, t: 0, hist: [] , last: 0 };
    const Kp = (T) => 12 * Math.exp(-(S.dH * 1000) / RG2 * (1 / (T + 273.15) - 1 / 293.15));
    const alEq = (T) => { const k = Kp(T); return k / (1 + k); };
    S.al = alEq(22);
    const stA = new Stage(A.st, { aspect: 1.8, minH: 320, maxH: 470, tag: "Пробірка у водяній бані" });
    const rdA = UI.reads(A.st, [["tb", "T бані"], ["tt", "T пробірки"], ["al", "Частка комплексу"], ["K", "K′(T)"]]);
    UI.slider(A.ct, { id: "p2-dh", label: "ΔH реакції комплексоутворення", min: -90, max: -20, step: 5, value: S.dH, unit: "кДж/моль", on: v => { S.dH = v; } });
    UI.buttons(A.ct, [
      { label: "🔥 Нагріти на водяній бані (95 °C)", pri: true, on: () => { S.bathTarget = 95; } },
      { label: "💧 Охолодити водою з-під крана (15 °C)", on: () => { S.bathTarget = 15; } },
      { label: "Кімнатна температура (22 °C)", on: () => { S.bathTarget = 22; } }]);
    UI.tip(A.ct, "Реакція <b>екзотермічна</b> (ΔH &lt; 0): за принципом Ле Шательє нагрівання зсуває рівновагу вліво — синє забарвлення зникає; охолодження повертає його. Процес оборотний.");
    const chA = h("div", { class: "charts" }); A.bl.append(chA);
    const cA1 = UI.chart(chA, "Температура пробірки та частка комплексу в часі");
    const cA2 = UI.chart(chA, "Рівноважна частка комплексу від температури (рівняння ван’т-Гоффа)");
    const bub = []; const rr0 = rng(21);
    function drawA(time) {
      const c = stA.ctx, W = stA.W, H = stA.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, Theme.dark ? "#1d2a24" : "#EEF2EA"); bg.addColorStop(1, Theme.dark ? "#16211c" : "#DDE6D8"); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      // стіл
      c.fillStyle = Theme.dark ? "#2a3a30" : "#C9B58A"; c.fillRect(0, H * .88, W, H * .12);
      const cx = W * .36, bw = Math.min(W * .3, 220), bt = H * .44, bh = H * .42, bx = cx - bw / 2;
      // плитка
      Gfx.rr(c, bx - 20, H * .86, bw + 40, 14, 4); c.fillStyle = "#3b3f44"; c.fill();
      const hot = clamp((S.bath - 40) / 55, 0, 1); if (S.bathTarget > 60) { Gfx.glow(c, cx, H * .86, bw * .8, "#E0623A", .5 * hot + .15); }
      // склянка
      c.save(); Gfx.rr(c, bx, bt, bw, bh, 10); c.clip();
      const wc = mixc("#8EC3E6", "#E7A59A", clamp((S.bath - 20) / 75, 0, 1)); const wy = bt + bh * .12;
      const wg = c.createLinearGradient(0, wy, 0, bt + bh); wg.addColorStop(0, shade(wc, .15)); wg.addColorStop(1, shade(wc, -.12)); c.fillStyle = wg;
      c.beginPath(); c.moveTo(bx, wy); for (let x = 0; x <= bw; x += 6) c.lineTo(bx + x, wy + Math.sin(x * .09 + time * 2) * 1.6); c.lineTo(bx + bw, bt + bh); c.lineTo(bx, bt + bh); c.fill();
      // бульбашки
      if (S.bath > 55) { if (Math.random() < .5 * hot) bub.push({ x: bx + 10 + Math.random() * (bw - 20), y: bt + bh - 4, r: 1.5 + Math.random() * 3, v: 30 + Math.random() * 40 }); }
      for (let i = bub.length - 1; i >= 0; i--) { const b = bub[i]; b.y -= b.v * .016; b.x += Math.sin(b.y * .1) * .3; c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = 1; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.stroke(); if (b.y < wy) bub.splice(i, 1); }
      c.restore();
      c.lineWidth = 2; c.strokeStyle = rgba(T0.ink, .55); Gfx.rr(c, bx, bt, bw, bh, 10); c.stroke();
      // пара
      if (S.bath > 70) { c.strokeStyle = `rgba(255,255,255,${.35 * hot})`; c.lineWidth = 3; for (let k = 0; k < 3; k++) { c.beginPath(); for (let y = 0; y < 50; y += 4) c.lineTo(bx + bw * (.25 + k * .25) + Math.sin(y * .2 + time * 3 + k) * 6, bt - y); c.stroke(); } }
      // кран
      if (S.bathTarget < 20) { Gfx.rr(c, bx + bw * .7, H * .08, 16, 36, 3); c.fillStyle = "#8a9099"; c.fill(); c.strokeStyle = "rgba(120,190,240,.85)"; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + bw * .7 + 8, H * .08 + 36); c.lineTo(bx + bw * .7 + 8 + Math.sin(time * 9) * 1.5, wy); c.stroke(); }
      // пробірка у штативі
      const tw = 30, tx = cx - tw / 2 + 0, ty = H * .08, th = H * .62;
      const col = mixc("#EBCB6B", "#1A2272", clamp(S.al / .9, 0, 1));
      Gfx.vial(c, tx, ty, tw, th, .62, col, { label: "" });
      // штатив
      c.fillStyle = "#6a6e73"; c.fillRect(W * .09, H * .06, 8, H * .82); c.fillRect(W * .09, H * .06, cx - W * .09 - tw / 2 - 2, 7);
      // термометр
      const thx = bx + bw + 26, thy = H * .1, thh = H * .62; Gfx.rr(c, thx - 6, thy, 12, thh, 6); c.fillStyle = "rgba(255,255,255,.65)"; c.fill(); c.strokeStyle = T0.muted; c.stroke();
      const lv = clamp((S.bath + 5) / 105, 0, 1); c.fillStyle = "#D1453B"; Gfx.rr(c, thx - 3, thy + thh * (1 - lv), 6, thh * lv, 3); c.fill(); Gfx.sphere(c, thx, thy + thh + 4, 8, "#D1453B");
      for (let T = 0; T <= 100; T += 20) { const y = thy + thh * (1 - (T + 5) / 105); c.strokeStyle = T0.muted; c.beginPath(); c.moveTo(thx + 8, y); c.lineTo(thx + 14, y); c.stroke(); Gfx.text(c, T + "°", thx + 16, y, { size: 9.5, base: "middle", color: T0.muted }); }
      // збільшення: спіраль амілози з йодом
      const ix = W * .66, iw = W * .31, iy = H * .12, ih = H * .62;
      Gfx.rr(c, ix, iy, iw, ih, 14); c.fillStyle = Theme.dark ? "#1c2b23" : "#F7F9F4"; c.fill(); c.strokeStyle = T0.rule; c.lineWidth = 1; c.stroke();
      Gfx.text(c, "Збільшення: амілоза + поліодид", ix + 12, iy + 18, { size: 11, weight: 700, color: T0.ink });
      const hy = iy + ih * .38, hr = 26, ox = ix + 22, L = iw - 44; const un = 1 - clamp(Math.max(0, (S.tube - 45) / 45), 0, 1) * (1 - S.al);
      c.lineWidth = 6; c.lineCap = "round"; c.strokeStyle = "#B9A57A"; c.beginPath();
      for (let x = 0; x <= L; x += 2) { const ph = x / L * Math.PI * 7, amp = hr * (0.35 + .65 * un); const yy = hy + Math.sin(ph) * amp; x ? c.lineTo(ox + x, yy) : c.moveTo(ox + x, yy); } c.stroke();
      const nI = Math.round(S.al * 22);
      for (let k = 0; k < 22; k++) { const x = (k + .5) / 22 * L; if (k < nI) { Gfx.sphere(c, ox + x, hy + Math.sin(time * 2 + k) * 1.2, 5.2, "#2B2F8C"); } }
      for (let k = nI; k < 10; k++) { const x = ox + hash01(k, 5) * L, y = hy + hr + 26 + hash01(k, 6) * (ih * .32); Gfx.sphere(c, x + Math.sin(time + k) * 5, y + Math.cos(time * .8 + k) * 4, 4.4, "#C7A233", { a: .9 }); }
      Gfx.text(c, S.al > .5 ? "I₅⁻ у каналі спіралі → синій комплекс" : "спіраль розкручена, йод вільний (жовтий)", ix + 12, iy + ih - 12, { size: 10.5, color: T0.muted });
      Gfx.chip(c, `${NA(S.tube, 0)} °C`, tx + tw / 2, ty - 10 + 0, { align: "center", size: 11 });
      Gfx.chip(c, "t = " + NA(S.t, 0) + " с", W - 10, H - 12, { align: "right", size: 10.5 });
    }
    function stepA(dt) {
      S.bath += clamp(S.bathTarget - S.bath, -14 * dt, 14 * dt);
      S.tube += (S.bath - S.tube) * (1 - Math.exp(-dt / 5));
      const kk = .35 * (1 + Math.max(0, S.tube - 20) / 50), a = alEq(S.tube);
      S.al += (a - S.al) * (1 - Math.exp(-kk * dt)); S.t += dt;
      if (S.t - S.last > .5) { S.last = S.t; S.hist.push([S.t, S.tube, S.al * 100]); if (S.hist.length > 400) S.hist.shift(); }
    }
    function chartsA() {
      const H = S.hist, x0 = Math.max(0, S.t - 120);
      drawChart(cA1, { x: [x0, x0 + 120], y: [0, 100], xl: "t, с", series: [{ pts: H.map(r => [r[0], r[1]]), color: "#D1453B", w: 2.2 }, { pts: H.map(r => [r[0], r[2]]), color: "#2B2F8C", w: 2.6 }], legend: [{ label: "T, °C", color: "#D1453B" }, { label: "комплекс, %", color: "#2B2F8C" }] });
      const pts = []; for (let T = 5; T <= 100; T += 3) pts.push([T, alEq(T) * 100]);
      drawChart(cA2, { x: [0, 100], y: [0, 100], xl: "T, °C", yl: "комплекс, %", series: [{ pts, color: "#2B2F8C", w: 2.4 }], marks: [{ x: clamp(S.tube, 0, 100), y: S.al * 100, color: "#D1453B", label: "зараз" }] });
    }

    /* ============ B. Закон Гесса ============ */
    const RX = [
      { n: "C + O₂ → CO₂ (через CO)", steps: [["C + ½O₂ → CO", -110.5], ["CO + ½O₂ → CO₂", -283.0]], total: -393.5, a: "C + O₂", z: "CO₂", mid: ["CO + ½O₂"] },
      { n: "Глюкоза → 2 етанол + 2 CO₂ (бродіння)", steps: [["C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂", -69.1]], total: -69.1, a: "C₆H₁₂O₆", z: "2 C₂H₅OH + 2 CO₂", mid: [] },
      { n: "Глюкоза + 6O₂ → 6CO₂ + 6H₂O (дихання)", steps: [["бродіння до етанолу", -69.1], ["етанол → CO₂ + H₂O (2×)", -2733.4]], total: -2802.5, a: "C₆H₁₂O₆ + 6O₂", z: "6CO₂ + 6H₂O", mid: ["2 C₂H₅OH + 2CO₂ + 4O₂"] },
    ];
    const Hs = { rx: 0, t: 0, extra: 0 };
    const stB = new Stage(B.st, { aspect: 1.8, minH: 320, maxH: 470, tag: "Діаграма ентальпій" });
    const rdB = UI.reads(B.st, [["d", "ΔH прямого шляху"], ["s", "Σ ΔH кроків"], ["q", "Q (теплота у довкілля)"], ["ty", "Тип"]]);
    UI.select(B.ct, { id: "p2-rx", label: "Реакція", value: 0, options: RX.map((r, i) => [i, r.n]), on: v => { Hs.rx = +v; Hs.t = 0; } });
    UI.slider(B.ct, { id: "p2-ex", label: "Помилка в одному кроці (для перевірки)", min: -40, max: 40, step: 5, value: 0, unit: "кДж", on: v => { Hs.extra = v; } });
    UI.buttons(B.ct, [{ label: "Пустити куль ще раз", pri: true, on: () => { Hs.t = 0; } }]);
    UI.tip(B.ct, "Теплота реакції за P = const дорівнює приросту ентальпії: <b>Q<sub>p</sub> = ΔH</b>. Для екзотермічної реакції ΔH &lt; 0, а довкілля отримує +Q. Куля скочується по кроках і по прямому шляху до того самого рівня — це і є закон Гесса. Повзунок додає помилку в одному кроці: тоді суми розходяться.");
    const tbB = h("div", { class: "tblwrap" }); B.bl.append(h("div", { class: "chart" }, h("h4", null, "Стандартні ентальпії утворення ΔH°ᶠ (кДж/моль) і розрахунок за наслідком із закону Гесса"), tbB));
    const HF = [["CO₂(г)", -393.5], ["H₂O(р)", -285.8], ["CO(г)", -110.5], ["C₆H₁₂O₆(т)", -1273.3], ["C₂H₅OH(р)", -277.7]];
    UI.html(tbB, `<table class="t"><thead><tr><th>Речовина</th><th>ΔH°ᶠ</th></tr></thead><tbody>${HF.map(r => `<tr><td>${r[0]}</td><td class="n">${NA(r[1], 1)}</td></tr>`).join("")}<tr><td colspan="2" class="note">ΔH(реакції) = Σν·ΔH°ᶠ(продуктів) − Σν·ΔH°ᶠ(реагентів). Глюкоза → 6CO₂ + 6H₂O: 6·(−393,5) + 6·(−285,8) − (−1273,3) = −2802,5 кДж/моль.</td></tr></tbody></table>`);
    function drawB(time) {
      const c = stB.ctx, W = stB.W, H = stB.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, Theme.dark ? "#1a2620" : "#F4F7F0"); bg.addColorStop(1, Theme.dark ? "#13201a" : "#E4ECDF"); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      const R = RX[Hs.rx], tot = R.total, steps = R.steps.map((s, i) => [s[0], s[1] + (i === 0 ? Hs.extra : 0)]);
      const sum = steps.reduce((a, s) => a + s[1], 0);
      const lo = Math.min(tot, sum, 0), top = 0, Y = v => H * .12 + (v - top) / (lo - top || -1) * H * .64, X0 = W * .12, X1 = W * .88;
      // шкала
      c.strokeStyle = T0.rule; c.lineWidth = 1; for (let k = 0; k <= 4; k++) { const v = lo * k / 4, y = Y(v); c.beginPath(); c.moveTo(X0 - 20, y); c.lineTo(X1 + 10, y); c.stroke(); Gfx.text(c, NA(v, 0), X0 - 26, y, { size: 10, align: "right", base: "middle", color: T0.muted }); }
      Gfx.text(c, "H, кДж/моль", X0 - 26, H * .07, { size: 10.5, color: T0.muted, align: "left" });
      // рівні
      const xa = X0 + 20, xz = X1 - 120, xm = (xa + xz) / 2;
      const lvl = (x, y, w, lab, col) => { c.fillStyle = col; c.fillRect(x, y - 3, w, 6); Gfx.text(c, lab, x + w / 2, y - 12, { align: "center", size: 11, weight: 700, color: T0.ink }); };
      lvl(xa, Y(0), 150, R.a, "#2A6A93");
      // шлях через проміжні
      let cur = 0, px = xa + 150, py = Y(0); const pts = [[xa + 75, Y(0)]];
      steps.forEach((s, i) => { cur += s[1]; if (i === steps.length - 1) return; const nx = lerp(xa + 190, xz - 40, (i + 1) / steps.length); const ny = Y(cur); lvl(nx - 50, ny, 100, R.mid[i] || "проміжні", "#8B7BB5"); pts.push([nx, ny]); });
      lvl(xz, Y(sum), 150, R.z, "#3FA66A");
      // стрілки кроків
      let prev = [xa + 150, Y(0)]; const ptsA = [prev]; cur = 0;
      steps.forEach((s, i) => { cur += s[1]; const nx = i === steps.length - 1 ? xz : lerp(xa + 190, xz - 40, (i + 1) / steps.length) - 50, ny = Y(cur); Gfx.arrow(c, prev[0] + 10, prev[1], nx + 40, ny, { col: "#8B7BB5", w: 2.5, head: 9 }); Gfx.chip(c, `ΔH${i + 1} = ${NA(s[1], 1)}`, (prev[0] + nx) / 2 + 20, (prev[1] + ny) / 2 - 12, { size: 10.5, fg: "#5B44A8" }); prev = [nx + 80, ny]; ptsA.push([nx + 40, ny]); });
      // прямий шлях
      Gfx.arrow(c, xa + 75, Y(0) + 8, xa + 75, Y(tot), { col: "#B8481A", w: 3, head: 11, dash: [6, 4] });
      Gfx.chip(c, `прямий шлях: ΔH = ${NA(tot, 1)}`, xa + 90, (Y(0) + Y(tot)) / 2, { size: 11, fg: "#B8481A" });
      // кулі
      const f = ease(clamp(Hs.t, 0, 1));
      Gfx.sphere(c, xa + 75, lerp(Y(0), Y(tot), f), 9, "#B8481A");
      const seg = steps.length; let acc = 0, bx2 = xa + 150, by2 = Y(0);
      const ft = f * seg, k = Math.min(seg - 1, Math.floor(ft)), u = ft - k; let curv = 0; for (let i = 0; i < k; i++) curv += steps[i][1];
      const P0 = (k === 0 ? [xa + 150, Y(0)] : [lerp(xa + 190, xz - 40, k / seg) - 50 + 80, Y(curv)]);
      const nx = k === seg - 1 ? xz + 40 : lerp(xa + 190, xz - 40, (k + 1) / seg), ny = Y(curv + steps[k][1]);
      Gfx.sphere(c, lerp(P0[0], nx, u), lerp(P0[1], ny, u), 9, "#5B44A8");
      // тепло
      const heat = Math.min(1, f) * clamp(-tot / 400, .1, 1);
      for (let i = 0; i < 6; i++) { const yy = Y(tot) + 20 + i * 4; c.strokeStyle = `rgba(224,98,58,${heat * .6})`; c.lineWidth = 2; c.beginPath(); for (let x = 0; x < 60; x += 3) c.lineTo(xz + 170 + x * .4 + 0, yy - 28 + Math.sin(x * .3 + time * 5 + i) * 3 - i * 6); c.stroke(); }
      Gfx.chip(c, `Q = ${NA(-sum, 1)} кДж/моль → довкілля`, xz + 75, Y(sum) + 36, { align: "center", size: 10.5, fg: "#B8481A" });
      if (Math.abs(sum - tot) > .01) Gfx.chip(c, "Σ кроків ≠ прямий шлях — перевірте дані!", W / 2, H - 16, { align: "center", size: 11, fg: "#B3363A" });
      rdB.set("d", NA(tot, 1), "кДж"); rdB.set("s", NA(sum, 1), "кДж"); rdB.set("q", NA(-tot, 1), "кДж"); rdB.set("ty", tot < 0 ? "екзотермічна" : "ендотермічна");
    }

    /* ============ C. Фур'є, конвекція, ентропія плавлення ============ */
    const Cq = { dT: 34, d: 5, lam: .3, alpha: 50, ts: 33, tair: 20, m: .25 };
    const stC = new Stage(C.st, { aspect: 1.8, minH: 300, maxH: 440, tag: "Теплопровідність шкіри" });
    const rdC = UI.reads(C.st, [["q", "q = λΔT/δ"], ["conv", "q конвекції"], ["S", "ΔS плавлення Pb"], ["dial", "Діалізатор"]]);
    UI.slider(C.ct, { id: "p2c-dt", label: "ΔT через шкіру (34 °C ↔ лід 0 °C)", min: 5, max: 40, step: 1, value: Cq.dT, unit: "°C", on: v => Cq.dT = v });
    UI.slider(C.ct, { id: "p2c-d", label: "Товщина шкіри δ", min: 1, max: 10, step: .5, value: Cq.d, unit: "мм", on: v => Cq.d = v });
    UI.slider(C.ct, { id: "p2c-l", label: "Теплопровідність λ", min: .1, max: 1, step: .05, value: Cq.lam, unit: "Вт/(м·К)", on: v => Cq.lam = v, fmt: v => NA(v, 2) });
    UI.slider(C.ct, { id: "p2c-a", label: "Коефіцієнт тепловіддачі α", min: 5, max: 100, step: 5, value: Cq.alpha, unit: "Вт/(м²·К)", on: v => Cq.alpha = v });
    UI.slider(C.ct, { id: "p2c-m", label: "Маса свинцю", min: .05, max: 1, step: .05, value: Cq.m, unit: "кг", on: v => Cq.m = v, fmt: v => NA(v, 2) });
    UI.tip(C.ct, "Значення за замовчуванням — умови задач 1–3 методички. Відповіді: <b>9,59 Дж/К</b>; <b>2040 Вт/м²</b>; <b>650 Вт/м²</b>.");
    function drawC(time) {
      const c = stC.ctx, W = stC.W, H = stC.H, T0 = Theme.c; c.clearRect(0, 0, W, H);
      c.fillStyle = Theme.dark ? "#1a2620" : "#F4F7F0"; c.fillRect(0, 0, W, H);
      const q = Cq.lam * Cq.dT / (Cq.d / 1000), qc = Cq.alpha * (Cq.ts - Cq.tair);
      // шкіра як шар
      const x0 = W * .08, x1 = W * .5, y0 = H * .22, hh = H * .52;
      const sk = c.createLinearGradient(x0, 0, x1, 0); sk.addColorStop(0, "#E3857A"); sk.addColorStop(.5, "#E8B09A"); sk.addColorStop(1, "#EFD0BD"); c.fillStyle = sk; c.fillRect(x0, y0, x1 - x0, hh);
      const r = rng(5); for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(150,60,40,${.05 + r() * .08})`; c.beginPath(); c.arc(x0 + r() * (x1 - x0), y0 + r() * hh, 1 + r() * 2, 0, 7); c.fill(); }
      Gfx.text(c, "стопа 34 °C", x0 - 4, y0 - 12, { size: 11, color: "#B3363A", weight: 700 }); Gfx.text(c, "лід 0 °C", x1 + 6, y0 - 12, { size: 11, color: "#2A6A93", weight: 700, align: "right" });
      c.fillStyle = "#CFE6F7"; c.fillRect(x1, y0, W * .1, hh); Gfx.text(c, "лід", x1 + W * .05, y0 + hh / 2, { align: "center", base: "middle", size: 12, color: "#2A6A93" });
      // профіль температури
      c.strokeStyle = "#D1453B"; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0 + hh * .12); c.lineTo(x1, y0 + hh * .88); c.stroke();
      // стрілки теплового потоку
      const wv = clamp(q / 500, 1, 10); for (let i = 0; i < 4; i++) { const y = y0 + 16 + i * (hh - 32) / 3, ph = (time * .6 + i * .25) % 1; Gfx.arrow(c, lerp(x0 + 10, x1 - 40, ph), y, lerp(x0 + 10, x1 - 40, ph) + 34, y, { col: "#E0623A", w: wv * .5 + 1, head: 8 }); }
      Gfx.chip(c, `q = ${NA(q, 0)} Вт/м²`, (x0 + x1) / 2, y0 + hh + 22, { align: "center", size: 12 });
      Gfx.text(c, "δ = " + NA(Cq.d, 1) + " мм", (x0 + x1) / 2, y0 + hh + 46, { align: "center", size: 11, color: T0.muted });
      // конвекція
      const bx = W * .66; Gfx.rr(c, bx, y0, W * .1, hh, 40); c.fillStyle = "#EDC9B3"; c.fill(); c.strokeStyle = "#C48C6C"; c.stroke(); Gfx.text(c, "тіло 33 °C", bx + W * .05, y0 + hh / 2, { align: "center", base: "middle", size: 11, color: "#7a3d28" });
      for (let i = 0; i < 5; i++) { const ph = (time * .5 + i * .2) % 1, y = y0 + 20 + i * (hh - 40) / 4; Gfx.arrow(c, bx + W * .1 + 4 + ph * 30, y, bx + W * .1 + 36 + ph * 30, y, { col: "#2A6A93", w: clamp(qc / 200, 1, 6), head: 8 }); }
      Gfx.chip(c, `q = α(Tт − Tп) = ${NA(qc, 0)} Вт/м²`, bx + W * .12, y0 + hh + 22, { align: "center", size: 11.5 });
      Gfx.text(c, "повітря 20 °C", bx + W * .17, y0 - 12, { size: 11, color: "#2A6A93", weight: 700, align: "center" });
      Gfx.text(c, "Закон Фур’є: q = λ·ΔT/δ · Конвекція: q = α·ΔT", W / 2, H * .08, { align: "center", size: 12, weight: 700, color: T0.ink });
      Gfx.text(c, "q = λ·ΔT/δ — зверніть увагу: одиниця λ — Вт/(м·К), тоді q виходить у Вт/м²", W / 2, H - 12, { align: "center", size: 10.5, color: T0.muted });
      const Sm = Cq.m * 23040 / (327.4 + 273.15), dial = .2 * 13 / .001;
      rdC.set("q", NA(q, 0), "Вт/м²"); rdC.set("conv", NA(qc, 0), "Вт/м²"); rdC.set("S", NA(Sm, 2), "Дж/К"); rdC.set("dial", NA(dial, 0), "Вт/м²");
    }

    M.init();
    return {
      stages: [stA, cA1, cA2, stB, stC],
      frame(dt, t) {
        if (mode === "a") { if (dt > 0) stepA(dt); drawA(t); chartsA(); rdA.set("tb", NA(S.bath, 0), "°C"); rdA.set("tt", NA(S.tube, 1), "°C"); rdA.set("al", NA(S.al * 100, 0), "%"); rdA.set("K", NA(Kp(S.tube), 2)); }
        else if (mode === "b") { if (dt > 0) Hs.t = Math.min(1.2, Hs.t + dt * .22); drawB(t); }
        else drawC(t);
      },
    };
  },
});

})();
