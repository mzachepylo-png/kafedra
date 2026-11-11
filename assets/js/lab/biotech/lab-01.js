(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

const MEDIA_DATA = {
  MS: {
    name: "Мурасіге—Скуга (МС, 1962)",
    short: "МС",
    desc: "Високосольове універсальне середовище з високим вмістом амонійного та нітратного азоту (60 мМ N) для більшості дводольних і однодольних культур.",
    macro: [
      ["NH₄NO₃", 1650, 80.04, 2, 1],
      ["KNO₃", 1900, 101.10, 2, 1],
      ["CaCl₂·2H₂O", 440, 147.01, 3, 1.33],
      ["MgSO₄·7H₂O", 370, 246.47, 2, 2],
      ["KH₂PO₄", 170, 136.09, 2, 1],
    ],
    micro: [
      ["H₃BO₃", 6.2], ["MnSO₄·4H₂O", 22.3], ["ZnSO₄·7H₂O", 8.6],
      ["KI", 0.83], ["Na₂MoO₄·2H₂O", 0.25], ["CuSO₄·5H₂O", 0.025], ["CoCl₂·6H₂O", 0.025]
    ],
    fe: [["FeSO₄·7H₂O", 27.8], ["Na₂ЕДТА·2H₂O", 37.3]],
    vit: [["Мезоінозит", 100], ["Нікотинова кислота (PP)", 0.5], ["Піридоксин·HCl (B₆)", 0.5], ["Тіамін·HCl (B₁)", 0.1], ["Гліцин", 2.0]],
    suc0: 30, agar0: 7.0
  },
  B5: {
    name: "Гамборга B₅ (1968)",
    short: "B₅",
    desc: "Середовище з низьким вмістом амонію [(NH₄)₂SO₄] та переважанням нітратів (KNO₃) і високою дозою тіаміну (10 мг/л); оптимальне для суспензійних культур бобових і хрестоцвітих.",
    macro: [
      ["KNO₃", 2500, 101.10, 2, 1],
      ["(NH₄)₂SO₄", 134, 132.14, 3, 1.33],
      ["CaCl₂·2H₂O", 150, 147.01, 3, 1.33],
      ["MgSO₄·7H₂O", 250, 246.47, 2, 2],
      ["NaH₂PO₄·H₂O", 150, 137.99, 2, 1],
    ],
    micro: [
      ["H₃BO₃", 3.0], ["MnSO₄·H₂O", 10.0], ["ZnSO₄·7H₂O", 2.0],
      ["KI", 0.75], ["Na₂MoO₄·2H₂O", 0.25], ["CuSO₄·5H₂O", 0.025], ["CoCl₂·6H₂O", 0.025]
    ],
    fe: [["FeSO₄·7H₂O", 27.8], ["Na₂ЕДТА·2H₂O", 37.3]],
    vit: [["Мезоінозит", 100], ["Нікотинова кислота (PP)", 1.0], ["Піридоксин·HCl (B₆)", 1.0], ["Тіамін·HCl (B₁)", 10.0]],
    suc0: 20, agar0: 7.0
  },
  White: {
    name: "Уайта (White, 1963)",
    short: "Уайта",
    desc: "Низькосольове без-амонійне середовище з низьким осмотичним тиском; класичне для культури ізольованих коренів і зародків.",
    macro: [
      ["Ca(NO₃)₂·4H₂O", 300, 236.15, 3, 1.33],
      ["KNO₃", 80, 101.10, 2, 1],
      ["KCl", 65, 74.55, 2, 1],
      ["MgSO₄·7H₂O", 720, 246.47, 2, 2],
      ["Na₂SO₄", 200, 142.04, 3, 1.33],
      ["NaH₂PO₄·H₂O", 16.5, 137.99, 2, 1],
    ],
    micro: [
      ["H₃BO₃", 1.5], ["MnSO₄·4H₂O", 7.0], ["ZnSO₄·7H₂O", 3.0],
      ["KI", 0.75], ["MoO₃", 0.0001], ["CuSO₄·5H₂O", 0.001]
    ],
    fe: [["Fe₂(SO₄)₃", 2.5]],
    vit: [["Мезоінозит", 100], ["Нікотинова кислота (PP)", 0.5], ["Піридоксин·HCl (B₆)", 0.1], ["Тіамін·HCl (B₁)", 0.1], ["Гліцин", 3.0]],
    suc0: 20, agar0: 6.5
  },
  Miller: {
    name: "Міллера (Miller, 1965)",
    short: "Міллера",
    desc: "Спеціалізоване середовище з підвищеним вмістом фосфатів і азоту для калюсного біотесту сім'ядолей сої (<i>Glycine max</i> L.) на цитокінінову активність.",
    macro: [
      ["NH₄NO₃", 1000, 80.04, 2, 1],
      ["KNO₃", 1000, 101.10, 2, 1],
      ["Ca(NO₃)₂·4H₂O", 500, 236.15, 3, 1.33],
      ["MgSO₄·7H₂O", 35, 246.47, 2, 2],
      ["KH₂PO₄", 300, 136.09, 2, 1],
      ["KCl", 65, 74.55, 2, 1],
    ],
    micro: [
      ["H₃BO₃", 1.6], ["MnSO₄·4H₂O", 6.5], ["ZnSO₄·7H₂O", 2.7], ["KI", 0.8]
    ],
    fe: [["FeSO₄·7H₂O", 27.8], ["Na₂ЕДТА·2H₂O", 37.3]],
    vit: [["Мезоінозит", 100], ["Нікотинова кислота (PP)", 0.5], ["Піридоксин·HCl (B₆)", 0.1], ["Тіамін·HCl (B₁)", 0.1], ["Гліцин", 2.0]],
    suc0: 30, agar0: 8.0
  }
};

const VESSELS = [
  { v: 25, label: "Пробірка / колба 20–50 мл", tRec: 15, tau: 2.2 },
  { v: 75, label: "Колба 75 мл", tRec: 20, tau: 3.6 },
  { v: 250, label: "Колба 150–500 мл", tRec: 25, tau: 5.5 },
  { v: 1000, label: "Колба 1000 мл (1 л)", tRec: 30, tau: 8.2 },
  { v: 2000, label: "Бутель 2000 мл (2 л)", tRec: 40, tau: 12.5 },
];

App.def(1, {
  cheat: `
    <p class="lead">Успіх культивування ізольованих клітин, тканин і органів рослин <i>in vitro</i> (лат. «у склі») насамперед визначається двома фундаментальними умовами: <b>асептичністю</b> (повною відсутністю сторонньої бактеріальної та грибної мікрофлори) і <b>збалансованим мінерально-гормональним складом живильного середовища</b>. Оскільки рослинні клітини у культурі гетеротрофні щодо вуглецю й ростуть у 10–100 разів повільніше за сапрофітні бактерії чи цвілеві гриби, навіть поодинока спора <i>Bacillus subtilis</i> або <i>Aspergillus niger</i> у колбі призводить до повного заростання експлантата за 24–48 год.</p>

    <h3>1. Методи стерилізації посуду, інструментів і живильних середовищ (ЛР № 1)</h3>
    <p>Згідно з практикумом (с. 50–52), у біотехнологічній лабораторії застосовують чотири основні режими фізичної стерилізації залежно від термостабільності матеріалу:</p>
    <ul>
      <li><b>Сухожарова стерилізація</b> (у сушильній шафі гарячим сухим повітрям) — для скляного посуду (чашки Петрі, піпетки, колби, мірні циліндри, загорнуті у крафт-папір або фольгу), металевих інструментів, вати й паперових фільтрів за температури <b>160–180 °C протягом 1,5–2 год</b> (при 140 °C — 3 год). Живильні середовища сухим жаром стерилізувати не можна через википання води й обвуглювання органіки.</li>
      <li><b>Автоклавування (стерилізація насиченою водяною парою під надлишковим тиском)</b> — основний метод стерилізації агаризованих і рідких живильних середовищ, дистильованої води та термостійкого пластику при тиску <b>P = 1,0–1,2 атм (0,10–0,12 МПа) і температурі T = 120–121 °C</b>. Тривалість експозиції залежить від об'єму рідини в посудині через теплову інерцію прогрівання центрального шару розчину (табл. 2 підручника).</li>
      <li><b>Роздрібнена стерилізація (тиндалізація / текучою парою)</b> — триразове прогрівання середовища при 100 °C по 30 хв із добовими інтервалами при 25–30 °C, під час яких терморезистентні ендоспори проростають у вегетативні клітини і гинуть при наступному прогріванні.</li>
      <li><b>Холодна стерилізація (мембранна ультрафільтрація)</b> — пропускання розчинів термолабільних речовин (гіберелова кислота ГК₃, індоліл-3-оцтова кислота ІОК, зеатин, вітаміни B₁, B₆, PP, антибіотики канаміцин, стрептоміцин, цефотаксим, ферменти Onozuka R-10) крізь нітроцелюлозні або поліефірсульфонові мембранні фільтри типу Millipore з діаметром пор <b>0,22 мкм</b> (або 0,45 мкм) та додавання їх у вже автоклавоване середовище, охолоджене до 45–50 °C.</li>
    </ul>

    <div class="tblwrap">
      <table class="t bt">
        <caption>Таблиця 2. Режим стерилізації живильних середовищ в автоклаві при тиску 1 атм (121 °C) залежно від об'єму посудини (за М. Д. Мельничуком, О. Л. Кляченко, 2014, с. 51)</caption>
        <thead>
          <tr><th>Об'єм середовища в посудині, мл</th><th>Рекомендована тривалість стерилізації, хв</th><th>Час прогрівання ядра τ<sub>lag</sub>, хв</th><th>Типовий вид лабораторного посуду</th></tr>
        </thead>
        <tbody>
          <tr><td class="n">20–50</td><td class="n">15</td><td class="n">2,0–2,5</td><td>Культуральні пробірки, малі колби Ерленмейєра</td></tr>
          <tr><td class="n">75</td><td class="n">20</td><td class="n">3,5–4,0</td><td>Колби Ерленмейєра на 100–150 мл</td></tr>
          <tr><td class="n">150–500</td><td class="n">25</td><td class="n">5,0–6,5</td><td>Колби Ерленмейєра на 250–1000 мл</td></tr>
          <tr><td class="n">1000</td><td class="n">30</td><td class="n">8,0–9,0</td><td>Колби на 2 л (заповнення на 50 %)</td></tr>
          <tr><td class="n">2000</td><td class="n">40</td><td class="n">12,0–14,0</td><td>Маточні бутлі для розливу</td></tr>
        </tbody>
      </table>
    </div>

    <h4>Термодинаміка насиченої пари та кінетика інактивації ендоспор</h4>
    <p>Температура кипіння води у замкненій камері автоклава (за умови повного продування повітря через паровий кран!) однозначно пов'язана з абсолютним тиском рівнянням Клаузіуса—Клапейрона (в інженерній формі Антуана): при надлишковому тиску 0,5 атм T = 111,4 °C; при <b>1,0 атм — 120,2 °C</b>; при <b>1,1 атм — 121,8 °C</b>; при 1,5 атм — 127,4 °C; при 2,0 атм — 133,5 °C. Термічна загибель термостійких бактеріальних ендоспор (<i>Geobacillus stearothermophilus</i>, <i>Bacillus subtilis</i>) підпорядковується кінетиці першого порядку, яку характеризують часом десятикратного скорочення чисельності <b>D<sub>T</sub></b> (при 121 °C D<sub>121</sub> ≈ 1,5 хв) та температурним коефіцієнтом <b>z ≈ 10 °C</b>:</p>
    <div class="eq">$$D(T) = D_{121}\\cdot 10^{-(T - 121)/z}, \\qquad \\log_{10}\\!\\left(\\frac{N(t)}{N_0}\\right) = -\\frac{F_0}{D_{121}} = -\\frac{1}{D_{121}}\\int_0^t 10^{\\frac{T_{\\text{ядра}}(\\tau)-121}{z}}\\,d\\tau$$</div>
    <dl class="vars">
      <dt>F<sub>0</sub></dt><dd>еквівалентний летальний час стерилізації у хвилинах при еталонній температурі 121 °C (для повної гарантії стерильності — рівня забезпечення стерильності SAL ≤ 10⁻⁶ при початковій контамінації N₀ = 10⁶ спор — необхідно досягти спаду ≥ 12 lg, тобто F₀ ≥ 12 · D₁₂₁ ≈ 15–18 хв);</dd>
      <dt>T<sub>ядра</sub>(t)</dt><dd>температура в геометричному центрі колби, яка відстає від температури пари у камері T<sub>кам</sub> за експоненційним законом теплопередачі Ньютона: $T_{\\text{ядра}}(t) = T_{\\text{кам}} - (T_{\\text{кам}} - T_0)e^{-t/\\tau(V)}$.</dd>
    </dl>
    <p>Надмірне перевищення температури (&gt; 125 °C) або часу автоклавування (&gt; 40–45 хв) призводить до небажаної <b>карамелізації сахарози</b> (кислотного гідролізу до глюкози й фруктози та дегідратації фруктози до <b>5-гідроксиметилфурфуролу [5-ГМФ]</b>, який має високу цитотоксичність і надає середовищу бурого відтінку), реакції Майяра з амінокислотами та руйнування вітаміну B₁ (тіаміну).</p>

    <h3>2. Склад та класифікація живильних середовищ (ЛР № 2–4)</h3>
    <p>Будь-яке синтетичне живильне середовище для культури тканин складається з 6 функціональних блоків (с. 52–56):</p>
    <ol>
      <li><b>Макроелементи (N, P, K, Ca, Mg, S)</b> у концентраціях десятки—сотні мг/л. Класичне середовище <b>Мурасіге—Скуга (МС, 1962)</b> вирізняється високою загальною концентрацією солей (~4,3 г/л) та синергічним поєднанням відновленого азоту ($\text{NH}_4^+$ з $\text{NH}_4\text{NO}_3$ — 20,6 мМ) і окисненого азоту ($\text{NO}_3^-$ з $\text{NH}_4\text{NO}_3$ та $\text{KNO}_3$ — 39,4 мМ). Середовище <b>Гамборга B₅</b> має знижений вміст амонію (2 мМ), а середовище <b>Уайта</b> містить виключно нітратний азот і має низьку іонну силу.</li>
      <li><b>Мікроелементи (B, Mn, Zn, Cu, Mo, Co, I)</b> у мікромолярних кількостях (від 0,025 до 22,3 мг/л), що входять до активних центрів металоферментів.</li>
      <li><b>Джерело заліза (Fe-хелат)</b> — комплекс сульфату заліза(II) $\text{FeSO}_4\cdot 7\text{H}_2\text{O}$ (27,8 мг/л) з двонатрієвою сіллю етилендіамінтетраоцтової кислоти $\text{Na}_2\text{ЕДТА}\cdot 2\text{H}_2\text{O}$ (37,3 мг/л) у молярному співвідношенні 1:1 (0,1 мМ). Хелатування запобігає випадінню нерозчинного гідроксиду та фосфату заліза(III) $\text{FePO}_4\downarrow$ при $\text{pH } 5,6–5,8$.</li>
      <li><b>Вітаміни та амінокислоти</b> — тіамін ($\text{B}_1$, кофермент декарбоксилаз пірувату й $\alpha$-кетоглутарату), піридоксин ($\text{B}_6$, трансамінази), нікотинова кислота ($\text{PP}$, попередник $\text{НАД}^+/\text{НАДФ}^+$), мезоінозит (100 мг/л — біосинтез пектинів клітинної стінки та фосфатидилінозитолів мембран) та гліцин.</li>
      <li><b>Джерело вуглецю й енергії</b> — зазвичай <b>сахароза (20–30 г/л, або 2–3 %)</b>, яка під час автоклавування та під дією клітинної інвертази частково розщеплюється до глюкози й фруктози і водночас формує основну частку осмотичного потенціалу середовища $\Psi_s$.</li>
      <li><b>Фітогормони (регулятори росту) та гелеутворювач</b> — ауксини (2,4-дихлорфеноксиоцтова кислота [2,4-Д], $\alpha$-нафтилоцтова кислота [НОК], індоліл-3-оцтова кислота [ІОК]), цитокініни (6-бензиламінопурин [6-БАП], кінетин, зеатин) та <b>агар-агар (6–10 г/л, тобто 0,6–1,0 %)</b> — полісахарид червоних водоростей <i>Gelidium</i> і <i>Gracilaria</i> (суміш лінійної агарози й сульфатованого агаропектину), що плавиться при 85–95 °C і застигає в пружний гель при 35–40 °C.</li>
    </ol>

    <div class="tblwrap">
      <table class="t bt">
        <caption>Таблиця 3. Склад основних живильних середовищ для культури клітин і тканин рослин, мг/л (за М. Д. Мельничуком, О. Л. Кляченко, 2014, с. 53)</caption>
        <thead>
          <tr><th>Компонент середовища</th><th>Мурасіге—Скуга (МС)</th><th>Гамборга (B₅)</th><th>Уайта (White)</th><th>Міллера (Miller)</th></tr>
        </thead>
        <tbody>
          <tr><td>NH₄NO₃</td><td class="n">1650</td><td class="n">—</td><td class="n">—</td><td class="n">1000</td></tr>
          <tr><td>KNO₃</td><td class="n">1900</td><td class="n">2500</td><td class="n">80</td><td class="n">1000</td></tr>
          <tr><td>Ca(NO₃)₂·4H₂O</td><td class="n">—</td><td class="n">—</td><td class="n">300</td><td class="n">500</td></tr>
          <tr><td>(NH₄)₂SO₄</td><td class="n">—</td><td class="n">134</td><td class="n">—</td><td class="n">—</td></tr>
          <tr><td>CaCl₂·2H₂O</td><td class="n">440</td><td class="n">150</td><td class="n">—</td><td class="n">—</td></tr>
          <tr><td>MgSO₄·7H₂O</td><td class="n">370</td><td class="n">250</td><td class="n">720</td><td class="n">35</td></tr>
          <tr><td>KH₂PO₄</td><td class="n">170</td><td class="n">—</td><td class="n">—</td><td class="n">300</td></tr>
          <tr><td>NaH₂PO₄·H₂O</td><td class="n">—</td><td class="n">150</td><td class="n">16,5</td><td class="n">—</td></tr>
          <tr><td>KCl / Na₂SO₄</td><td class="n">—</td><td class="n">—</td><td class="n">65 / 200</td><td class="n">65 / —</td></tr>
          <tr><td>FeSO₄·7H₂O + Na₂ЕДТА</td><td class="n">27,8 + 37,3</td><td class="n">27,8 + 37,3</td><td class="n">Fe₂(SO₄)₃ 2,5</td><td class="n">27,8 + 37,3</td></tr>
          <tr><td>H₃BO₃</td><td class="n">6,2</td><td class="n">3,0</td><td class="n">1,5</td><td class="n">1,6</td></tr>
          <tr><td>MnSO₄·4H₂O (або ·H₂O)</td><td class="n">22,3</td><td class="n">10,0</td><td class="n">7,0</td><td class="n">6,5</td></tr>
          <tr><td>ZnSO₄·7H₂O</td><td class="n">8,6</td><td class="n">2,0</td><td class="n">3,0</td><td class="n">2,7</td></tr>
          <tr><td>KI</td><td class="n">0,83</td><td class="n">0,75</td><td class="n">0,75</td><td class="n">0,80</td></tr>
          <tr><td>Na₂MoO₄·2H₂O</td><td class="n">0,25</td><td class="n">0,25</td><td class="n">0,0001</td><td class="n">—</td></tr>
          <tr><td>CuSO₄·5H₂O / CoCl₂·6H₂O</td><td class="n">0,025 / 0,025</td><td class="n">0,025 / 0,025</td><td class="n">0,001 / —</td><td class="n">—</td></tr>
          <tr><td>Мезоінозит</td><td class="n">100</td><td class="n">100</td><td class="n">100</td><td class="n">100</td></tr>
          <tr><td>Нікотинова к-та / Піридоксин / Тіамін</td><td class="n">0,5 / 0,5 / 0,1</td><td class="n">1,0 / 1,0 / 10,0</td><td class="n">0,5 / 0,1 / 0,1</td><td class="n">0,5 / 0,1 / 0,1</td></tr>
          <tr><td>Сахароза, г/л</td><td class="n">30</td><td class="n">20</td><td class="n">20</td><td class="n">30</td></tr>
          <tr><td>Агар-агар, г/л</td><td class="n">7–8</td><td class="n">7–8</td><td class="n">6–7</td><td class="n">8</td></tr>
        </tbody>
      </table>
    </div>

    <h4>Осмотичний потенціал $\\Psi_s$, іонна сила $I$ та pH-залежне гелеутворення</h4>
    <p>Сумарний осмотичний потенціал живильного середовища за законом Вант-Гоффа складається з внеску дисоційованих мінеральних солей і неелектроліту сахарози ($M = 342,3\\text{ г/моль}$):</p>
    <div class="eq">$$\\Psi_s = -R T \\left(\\sum_j i_j C_j + \\frac{C_{\\text{сах}}}{342,3}\\right), \\qquad I = \\frac{1}{2}\\sum_k c_k z_k^2$$</div>
    <p>Для стандартного середовища 1× МС із 30 г/л сахарози при 25 °C ($RT = 2,479\\text{ л}\\cdot\\text{МПа/моль}$) солі дають $\\approx -0,23\\text{ МПа}$, а сахароза ($87,6\\text{ мМ}$) дає $\\approx -0,22\\text{ МПа}$, формуючи сумарний $\\Psi_s \\approx -0,45\\text{ МПа}$. Оптимальний водневий показник середовища перед автоклавуванням становить <b>pH 5,6–5,8</b> (доводять 0,1–1,0 н. розчинами KOH/NaOH або HCl). Якщо pH &lt; 5,0, під час автоклавування при 121 °C відбувається кислотний гідроліз глікозидних зв'язків агарози — середовище втрачає здатність тверднути й залишається рідким; якщо pH &gt; 6,2 — випадає осад фосфатів кальцію та заліза, а іони $\\text{NH}_4^+$ переходять у токсичний вільний $\\text{NH}_3$.</p>

    <details class="bproto">
      <summary>Хід роботи (Лабораторні роботи № 1–4, с. 50–57)</summary>
      <div>
        <ol class="bsteps">
          <li><b>ЛР № 1. Підготовка посуду та стерилізація в автоклаві:</b> вимитий содою та хромовою сумішшю посуд обполосніть дистильованою водою, висушіть, загорніть чашки Петрі та піпетки у крафт-папір і простерилізуйте у сухожаровій шафі при 160–180 °C протягом 2 год. Живильні середовища у колбах (заповнених не більш як на 1/2–2/3 об'єму, закритих ватно-марлевими корками та фольгою) завантажте в автоклав, продуйте пару до повного витіснення повітря, доведіть тиск до 1,0–1,2 атм (121 °C) і витримайте час згідно з табл. 2 (15–40 хв).</li>
          <li><b>ЛР № 2. Приготування концентрованих маточних (сток-) розчинів:</b> щоб уникнути щоразового зважування міліграмових наважок і випадіння осаду $\\text{CaSO}_4$ чи $\\text{Ca}_3(\\text{PO}_4)_2$, приготуйте окремі маточні розчини макросолей (концентрат 10× або 20×; $\\text{CaCl}_2$ розчиняють окремо!), мікросолей (100× або 1000×), Fe-хелату (при нагріванні $\\text{FeSO}_4\\cdot 7\\text{H}_2\\text{O}$ та $\\text{Na}_2\\text{ЕДТА}$ у темному склі, 100×) і вітамінів (100×, зберігають при −20 °C або +4 °C).</li>
          <li><b>ЛР № 3–4. Приготування 1 л агаризованого середовища МС:</b> у мірну колбу або склянку на 1 л налийте 500 мл бідистильованої води, внесіть аліквоти маточних розчинів макросолей (50 мл 20×), мікросолей (1 мл 1000×), Fe-хелату (5 мл 200×), вітамінів і мезоінозиту (100 мг), додайте 30 г сахарози та необхідні регулятори росту.</li>
          <li>Доведіть об'єм до ~800 мл, виміряйте pH на іономірі та відтитруйте 0,1 н. NaOH або 0,1 н. HCl до <b>pH 5,6–5,8</b>. Додайте наважку агар-агару (7–8 г/л), доведіть об'єм до 1000 мл, розплавте агар на водяній бані або електроплитці при помішуванні до повної прозорості, розлийте у колби/пробірки й простерилізуйте в автоклаві.</li>
        </ol>
      </div>
    </details>
  `,
  qa: [
    [
      "Чому під час запуску автоклава обов'язково потрібно повністю випустити повітря через паровий кран перед підняттям тиску до 1 атм?",
      "<p>За законом Дальтона парціальний тиск пароповітряної суміші дорівнює сумі тисків пари та повітря ($P_{\\text{заг}} = P_{\\text{пари}} + P_{\\text{пов}}$). Якщо у камері залишилося повітря, то при показі манометра 1,0 атм парціальний тиск насиченої водяної пари буде меншим, а реальна температура становитиме лише 108–112 °C замість 121 °C. Крім того, повітря утворює в нижній частині камери холодні «кишені», що призводить до нестерильності середовища при формально витриманому тиску.</p>"
    ],
    [
      "Чому залізо в живильне середовище Мурасіге—Скуга вводять у формі хелату Fe-ЕДТА, а не простої солі FeSO₄ чи FeCl₃?",
      "<p>У водному розчині за фізіологічного pH 5,6–5,8 та в присутності фосфат-іонів ($\\text{H}_2\\text{PO}_4^-$) вільні катіони $\\text{Fe}^{2+}$ швидко окиснюються киснем повітря до $\\text{Fe}^{3+}$ і випадають у нерозчинний осад фосфату та гідроксиду заліза(III), стаючи недоступними для експлантатів (розвивається залізний хлороз калюсу та пагонів). Ліганд $\\text{ЕДТА}^{4-}$ утворює стійкий розчинний внутрішньокомплексний хелат ($\\lg K_{\\text{ст}} \\approx 25$), який утримує залізо в розчині під час автоклавування та поступово віддає його клітинам.</p>"
    ],
    [
      "Які речовини не можна стерилізувати в автоклаві разом із основним середовищем і як їх вводять?",
      "<p>Не витримують автоклавування при 121 °C термолабільні сполуки: <b>індоліл-3-оцтова кислота (ІОК)</b>, <b>гіберелова кислота (ГК₃)</b>, природний цитокінін <b>зеатин</b>, <b>аскорбінова кислота</b>, деякі вітаміни (тіамін частково гідролізується), <b>антибіотики</b> (канаміцин, стрептоміцин, клафоран/цефотаксим, ампіцилін) та ферментні препарати для виділення протопластів. Їх стерилізують холодною мембранною фільтрацією крізь фільтри Millipore з порами 0,22 мкм у ламінарному боксі та додають у стерильне середовище, охолоджене до 45–50 °C перед застиганням агару.</p>"
    ],
    [
      "Чому живильне середовище МС із pH 4,2 після автоклавування залишається рідким, навіть якщо до нього додали 8 г/л якісного агар-агару?",
      "<p>За низького значення pH (&lt; 5,0) при високій температурі автоклавування (121 °C) іони водню $\\text{H}^+$ каталізують кислотний гідроліз $\\beta$-1,4- та $\\alpha$-1,3-галактозидних зв'язків у полісахаридних ланцюгах агарози. Полімер деполімеризується на короткі олігосахариди, які при охолодженні до кімнатної температури не здатні утворити просторову тривимірну сітку гелю.</p>"
    ],
    [
      "У чому полягає принципова відмінність мінерального складу середовища Мурасіге—Скуга (МС) від середовищ Гамборга B₅ та Уайта?",
      "<p>Середовище МС має високу загальну іонну силу ($I \\approx 95\\text{ мМ}$) і високий вміст як нітратного ($39,4\\text{ мМ } \\text{NO}_3^-$), так і амонійного ($20,6\\text{ мМ } \\text{NH}_4^+$) азоту у співвідношенні $\\sim 2:1$. Середовище Гамборга $\\text{B}_5$ містить високу дозу нітратів ($25\\text{ мМ } \\text{KNO}_3$) і лише $2\\text{ мМ } \\text{NH}_4^+$ у формі $(\\text{NH}_4)_2\\text{SO}_4$, оскільки надлишок амонію пригнічує поділ клітин у суспензійних культурах сої та ряду інших культур. Середовище Уайта є низькосольовим ($I \\approx 19\\text{ мМ}$) і взагалі не містить іонів $\\text{NH}_4^+$, що оптимально для росту ізольованих коренів.</p>"
    ]
  ],
  build({ stageBox, ctrls, below, tabsBox }) {
    let mode = "a";
    const M = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Автоклавування та кінетика (ЛР 1)"],
      ["b", "Б. Конструктор середовищ і сток-розчини (ЛР 2–3)"],
      ["c", "В. Титрування pH та гель агару (ЛР 4)"]
    ], id => { mode = id; });

    /* ==================== TAB A: AUTOCLAVING ==================== */
    const A = M.box("a");
    let vIdx = 2; // 250 mL default (tRec = 25 min)
    let pAtm = 1.0; // excess pressure, atm -> T = 120.2..121 °C
    let tHold = 25; // hold time, min
    let airPurged = true;
    let n0Log = 6; // initial log10 spores (10^6)

    const stA = new Stage(A.st, { aspect: 1.75, minH: 280, maxH: 410 });
    const rdA = UI.reads(A.st, [
      ["tCam", "Температура пари Tкам"],
      ["f0", "Еквівалентна доза F₀ (121 °C)"],
      ["sal", "Залишкові спори lg(N/N₀)"],
      ["hmf", "Карамелізація / B₁ втрати"],
    ]);

    UI.select(A.ct, {
      id: "l1-ves", label: "Об'єм посудини за табл. 2", value: "2",
      options: VESSELS.map((x, i) => [String(i), `${x.label} (норма ${x.tRec} хв)`]),
      on: v => { vIdx = +v; sHold.set(VESSELS[vIdx].tRec); tHold = VESSELS[vIdx].tRec; }
    });
    const sPres = UI.slider(A.ct, {
      id: "l1-p", label: "Надлишковий тиск пари P", min: 0.2, max: 2.0, step: 0.05, value: pAtm, unit: "атм",
      fmt: v => fmt(v, 2), on: v => { pAtm = v; }
    });
    const sHold = UI.slider(A.ct, {
      id: "l1-t", label: "Тривалість витримки t", min: 5, max: 60, step: 1, value: tHold, unit: "хв",
      fmt: v => fmt(v, 0), on: v => { tHold = v; }
    });
    const sN0 = UI.slider(A.ct, {
      id: "l1-n0", label: "Початкове обсіменіння lg N₀", min: 3, max: 9, step: 0.5, value: n0Log, unit: "lg спор",
      fmt: v => fmt(v, 1), on: v => { n0Log = v; }
    });
    UI.check(A.ct, {
      id: "l1-air", label: "Повне продування повітря через паровий кран", value: airPurged,
      on: v => { airPurged = v; }
    });
    UI.buttons(A.ct, [
      { label: "Стандарт табл. 2 (1,0 атм · 121 °C)", pri: true, on: () => { sPres.set(1.05); pAtm = 1.05; sHold.set(VESSELS[vIdx].tRec); tHold = VESSELS[vIdx].tRec; } },
      { label: "Перегрів (1,8 атм · 45 хв)", on: () => { sPres.set(1.8); pAtm = 1.8; sHold.set(45); tHold = 45; } }
    ]);
    UI.tip(A.ct, "За табл. 2 посібника (с. 51) зі збільшенням об'єму середовища від 20–50 мл до 2000 мл час автоклавування збільшують із 15 до 40 хв через теплову інерцію прогрівання центрального шару рідини.");

    const outA = UI.out(A.bl, "");
    const chRowA = h("div", { class: "charts" }); A.bl.append(chRowA);
    const chA1 = UI.chart(chRowA, "Прогрівання ядра колби T(t) та інактивація ендоспор lg N(t)");
    const chA2 = UI.chart(chRowA, "Час стерилізації за табл. 2 та накопичення токсичного 5-ГМФ");

    function calcAutoclave() {
      const ves = VESSELS[vIdx];
      // Antoine-like steam saturation temperature for absolute pressure (1 + pAtm) atm
      // With air trapped, partial steam pressure is reduced by ~0.35 atm
      const pEff = airPurged ? pAtm : Math.max(0.05, pAtm - 0.38);
      const tSteam = 100 + 20.6 * Math.log(1 + pEff) / Math.log(2.05);
      const dtStep = 0.25;
      const tTotal = tHold + 12; // include heating + cooling tail
      const ptsTCam = [], ptsTCore = [], ptsLogN = [], ptsHMF = [];
      let f0 = 0, hmf = 0, vitLoss = 0;
      const D121 = 1.5, z = 10.0;
      for (let t = 0; t <= tTotal; t += dtStep) {
        const tCam = t <= tHold
          ? 20 + (tSteam - 20) * (1 - Math.exp(-t / 1.4))
          : 80 + (tSteam - 80) * Math.exp(-(t - tHold) / 3.8);
        const prevCore = ptsTCore.length ? ptsTCore[ptsTCore.length - 1][1] : 20;
        const dCore = ((tCam - prevCore) / ves.tau) * dtStep;
        const tCore = prevCore + dCore;
        if (tCore > 95) {
          const leth = Math.pow(10, (tCore - 121) / z);
          f0 += leth * dtStep;
          // Sucrose caramelization has higher activation energy (z_chem ~ 22 °C)
          hmf += 0.32 * Math.pow(10, (tCore - 121) / 18) * dtStep;
          vitLoss += 0.0085 * Math.pow(10, (tCore - 121) / 21) * dtStep;
        }
        const logN = n0Log - f0 / D121;
        ptsTCam.push([t, tCam]);
        ptsTCore.push([t, tCore]);
        ptsLogN.push([t, clamp(logN, -10, 10)]);
        ptsHMF.push([t, hmf]);
      }
      const finalLogN = n0Log - f0 / D121;
      const b1LostPct = (1 - Math.exp(-vitLoss)) * 100;
      return { ves, tSteam, f0, finalLogN, hmf, b1LostPct, ptsTCam, ptsTCore, ptsLogN, ptsHMF, tTotal };
    }

    function drawA(time) {
      const { ctx: c, w, h: hh } = stA;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const R = calcAutoclave();
      const sterOK = R.finalLogN <= -6;
      const caramelized = R.hmf > 14;

      rdA.set("tCam", fmt(R.tSteam, 1), "°C");
      rdA.set("f0", fmt(R.f0, 1), "хв");
      rdA.set("sal", (R.finalLogN > 0 ? "+" : "") + fmt(R.finalLogN, 1), sterOK ? "стерильно" : "ризик росту!");
      rdA.set("hmf", `${fmt(R.hmf, 1)} мг/л · −${fmt(R.b1LostPct, 0)}% B₁`, caramelized ? "карамелізація!" : "норма");

      // Autoclave ВК-75 chamber cross-section on left (57% width), diagnostic gauges on right
      const cx = w * 0.30, cy = hh * 0.55;
      const chW = Math.min(w * 0.46, 252), chH = Math.min(hh * 0.74, 236);
      const x0 = cx - chW / 2, y0 = cy - chH / 2;
      const heatFrac = clamp((R.tSteam - 100) / 34, 0, 1);

      // Floor shadow under autoclave
      const flSh = c.createRadialGradient(cx, y0 + chH + 14, chW * 0.15, cx, y0 + chH + 14, chW * 0.62);
      flSh.addColorStop(0, "rgba(0,0,0,0.25)");
      flSh.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = flSh;
      c.beginPath(); c.ellipse(cx, y0 + chH + 14, chW * 0.58, 8, 0, 0, Math.PI * 2); c.fill();

      // Outer cylindrical stainless-steel jacket (ВК-75) with multi-stop metallic shading
      Gfx.rr(c, x0 - 12, y0 - 12, chW + 24, chH + 24, 24);
      const gSteel = c.createLinearGradient(x0 - 12, 0, x0 + chW + 12, 0);
      gSteel.addColorStop(0, Theme.dark ? "#2B353D" : "#8D9CA6");
      gSteel.addColorStop(0.18, Theme.dark ? "#5A6B78" : "#EDF3F7");
      gSteel.addColorStop(0.35, Theme.dark ? "#43515C" : "#C7D3DC");
      gSteel.addColorStop(0.75, Theme.dark ? "#2E3840" : "#9BA9B3");
      gSteel.addColorStop(0.92, Theme.dark ? "#475560" : "#CFD9E0");
      gSteel.addColorStop(1, Theme.dark ? "#1E262C" : "#6F7E88");
      c.fillStyle = gSteel; c.fill();
      c.strokeStyle = rgba(T.ink, 0.55); c.lineWidth = 1.8; c.stroke();

      // Steam-jacketed double-wall channels on left and right
      for (const sx of [x0 - 7, x0 + chW + 2]) {
        Gfx.rr(c, sx, y0 + 8, 5, chH - 16, 2.5);
        c.fillStyle = heatFrac > 0.2 ? `rgba(255, 138, 101, ${0.25 + 0.35 * heatFrac})` : "rgba(120, 170, 210, 0.25)";
        c.fill();
      }

      // Inner steam sterilization chamber
      c.save();
      Gfx.rr(c, x0, y0, chW, chH, 16);
      const chBg = c.createLinearGradient(x0, y0, x0, y0 + chH);
      chBg.addColorStop(0, Theme.dark ? mixc("#1C2A33", "#40251D", heatFrac * 0.75) : mixc("#E3EEF5", "#FCE6D8", heatFrac * 0.85));
      chBg.addColorStop(0.65, Theme.dark ? mixc("#152028", "#331D17", heatFrac * 0.65) : mixc("#F2F7FA", "#FFF3EB", heatFrac * 0.75));
      chBg.addColorStop(1, Theme.dark ? "#12212B" : "#D9E8F2");
      c.fillStyle = chBg; c.fill();
      c.clip();

      // If air not purged, draw heavy cold air pocket stratified at the bottom
      if (!airPurged) {
        const airGrad = c.createLinearGradient(0, y0 + chH * 0.52, 0, y0 + chH);
        airGrad.addColorStop(0, "rgba(66, 165, 245, 0.04)");
        airGrad.addColorStop(0.35, "rgba(41, 121, 255, 0.22)");
        airGrad.addColorStop(1, "rgba(21, 101, 192, 0.34)");
        c.fillStyle = airGrad;
        c.fillRect(x0, y0 + chH * 0.52, chW, chH * 0.48);
        c.strokeStyle = "rgba(41, 121, 255, 0.45)"; c.setLineDash([5, 3]); c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x0 + 4, y0 + chH * 0.56); c.lineTo(x0 + chW - 4, y0 + chH * 0.56); c.stroke();
        c.setLineDash([]);
        Gfx.text(c, "Холодна повітряна кишеня (108–112 °C)!", cx, y0 + chH - 29, { align: "center", size: 9.8, weight: 700, color: "#1565C0" });
      }

      // Billowing clouds of saturated water vapor (клуби насиченої водяної пари)
      const rCloud = rng(307);
      for (let i = 0; i < 14; i++) {
        const cxCloud = x0 + 24 + rCloud() * (chW - 48) + Math.sin(time * 1.1 + i * 1.7) * 10;
        const speed = 12 + rCloud() * 14;
        const cyCloud = y0 + chH - 26 - ((time * speed + i * 19) % (chH - 36));
        const rPuff = 18 + rCloud() * 18;
        const isWarm = airPurged || cyCloud < y0 + chH * 0.56;
        const puffCol = isWarm ? mixc("#FFFFFF", "#FFAB91", heatFrac * 0.65) : "#90CAF9";
        Gfx.glow(c, cxCloud, cyCloud, rPuff, puffCol, 0.16 + 0.14 * heatFrac);
      }

      // Fine rising steam micro-droplets & turbulence
      const r = rng(101);
      for (let i = 0; i < 26; i++) {
        const px = x0 + 14 + r() * (chW - 28);
        const speed = 22 + r() * 26;
        const py = y0 + chH - 22 - ((time * speed + r() * chH) % (chH - 30));
        const rad = 1.6 + r() * 3.2;
        c.fillStyle = airPurged || py < y0 + chH * 0.56
          ? `rgba(255, 160, 115, ${0.18 + 0.18 * heatFrac})`
          : "rgba(90, 165, 235, 0.24)";
        c.beginPath(); c.arc(px + Math.sin(time * 2.4 + i) * 3.5, py, rad, 0, Math.PI * 2); c.fill();
      }

      // Condensation droplets trickling down the inner stainless walls
      const rDrop = rng(709);
      for (let d = 0; d < 16; d++) {
        const onLeft = d % 2 === 0;
        const dx = onLeft ? x0 + 3.5 + rDrop() * 4 : x0 + chW - 3.5 - rDrop() * 4;
        const dy = y0 + 18 + ((time * (4 + rDrop() * 5) + d * 23) % (chH - 48));
        const dr = 1.8 + (d % 3) * 0.6;
        c.fillStyle = "rgba(180, 225, 250, 0.65)";
        c.beginPath();
        c.ellipse(dx, dy, dr * 0.78, dr * 1.25, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.85)";
        c.beginPath(); c.arc(dx - 0.4, dy - 0.6, dr * 0.32, 0, Math.PI * 2); c.fill();
      }

      // Distilled water reservoir at bottom of autoclave + boiling bubbles + glowing tubular heaters (ТЕНи)
      const watTop = y0 + chH - 24;
      const wGrad = c.createLinearGradient(0, watTop, 0, y0 + chH);
      wGrad.addColorStop(0, "rgba(79, 195, 247, 0.48)");
      wGrad.addColorStop(1, "rgba(2, 119, 189, 0.68)");
      c.fillStyle = wGrad;
      c.beginPath();
      c.moveTo(x0, y0 + chH);
      for (let wx = 0; wx <= chW; wx += 8) {
        const wy = watTop + Math.sin(wx * 0.12 + time * 6) * 1.4;
        c.lineTo(x0 + wx, wy);
      }
      c.lineTo(x0 + chW, y0 + chH);
      c.closePath();
      c.fill();

      // Electric heater coils & boiling bubbles in bottom water bath
      for (let i = 0; i < 6; i++) {
        const hx = x0 + 24 + i * ((chW - 48) / 5);
        Gfx.glow(c, hx, y0 + chH - 11, 13, "#FF5722", 0.5 + 0.25 * Math.sin(time * 5 + i));
        Gfx.sphere(c, hx, y0 + chH - 11, 3.8, "#FF3D00", { ring: "#FFCCBC", rw: 0.8 });
        // Rising boiling bubble above heater
        const by = y0 + chH - 11 - ((time * 28 + i * 7) % 14);
        c.strokeStyle = "rgba(255,255,255,0.68)"; c.lineWidth = 0.9;
        c.beginPath(); c.arc(hx + Math.sin(time * 8 + i) * 2, by, 2.0, 0, Math.PI * 2); c.stroke();
      }

      // Stainless-steel wire mesh sterilization basket (сітчастий кошик)
      const bskW = chW * 0.82, bskH = chH * 0.58;
      const bskX = cx - bskW / 2, bskBot = y0 + chH - 27, bskTop = bskBot - bskH;
      c.save();
      c.strokeStyle = Theme.dark ? "rgba(200,215,225,0.26)" : "rgba(70,90,105,0.26)";
      c.lineWidth = 1.0;
      for (let gx = bskX + 8; gx < bskX + bskW; gx += 12) {
        c.beginPath(); c.moveTo(gx, bskTop + 18); c.lineTo(gx, bskBot); c.stroke();
      }
      for (let gy = bskTop + 26; gy < bskBot; gy += 14) {
        c.beginPath(); c.moveTo(bskX, gy); c.lineTo(bskX + bskW, gy); c.stroke();
      }
      c.restore();

      // Main Erlenmeyer flask inside basket scaled by selected volume
      const flScale = [0.64, 0.74, 0.86, 0.98, 1.08][vIdx];
      const flW = 70 * flScale, flH = 94 * flScale;
      const flCx = cx - 14;
      // Medium color darkens from pale straw (#F5E6B8) to caramelized amber-brown (#9E470E) via Maillard / 5-HMF reaction
      const medCol = mixc("#F5E5AA", "#9C450C", clamp((R.hmf - 2.5) / 26, 0, 1));
      Gfx.flask(c, flCx, bskBot - 1, flW, flH, 0.54, medCol, {
        wave: time * 5.0,
        amp: 1.8,
        plug: true,
        inside(ctx, ly) {
          // Thermal convection currents & spores inside medium
          const rs = rng(55);
          const aliveRatio = clamp((R.finalLogN + 6) / (n0Log + 6), 0, 1);
          for (let k = 0; k < 16; k++) {
            const sx = flCx + (rs() - 0.5) * flW * 0.66 + Math.sin(time * 2.2 + k) * 1.5;
            const sy = ly + 6 + rs() * Math.max(8, bskBot - 10 - ly);
            const isAlive = (k / 16) < aliveRatio;
            if (isAlive) {
              Gfx.glow(ctx, sx, sy, 5.5, "#69F0AE", 0.45);
              Gfx.sphere(ctx, sx, sy, 2.5, "#2E7D32", { ring: "#B9F6CA", rw: 0.7 });
            } else {
              ctx.fillStyle = "rgba(115, 105, 95, 0.36)";
              ctx.beginPath(); ctx.arc(sx, sy, 1.7, 0, Math.PI * 2); ctx.fill();
            }
          }
          // Micro-bubbles of gentle boiling along bottom of flask
          for (let b = 0; b < 5; b++) {
            const bx = flCx + (b - 2) * (flW * 0.12);
            const by = bskBot - 5 - ((time * 18 + b * 11) % Math.max(10, bskBot - ly - 8));
            ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, Math.PI * 2); ctx.stroke();
          }
        }
      });

      // Biological indicator ampoule (Bacillus / Geobacillus stearothermophilus) in basket on the right
      const indX = cx + bskW * 0.28, indW = 20, indH = 48, indY = bskBot - indH - 1;
      const indCol = sterOK ? "#7E57C2" : "#FBC02D"; // purple = sterile (spores killed), yellow = acid from surviving spores
      Gfx.vial(c, indX, indY, indW, indH, 0.68, indCol, {
        wave: time * 4.2,
        plug: true,
        inside(ctx, ly) {
          // Spore strip inside bioindicator
          Gfx.rr(ctx, indX + indW * 0.32, ly + 4, indW * 0.36, indH * 0.42, 2);
          ctx.fillStyle = sterOK ? "rgba(255,255,255,0.65)" : "rgba(230,81,0,0.75)";
          ctx.fill();
        }
      });
      Gfx.text(c, "Біоіндикатор", indX + indW / 2, indY - 16, { align: "center", size: 8.5, weight: 700, color: T.ink });
      Gfx.text(c, "B. stearotherm.", indX + indW / 2, indY - 7, { align: "center", size: 7.8, color: T.muted });

      // Perforated shelf & basket rimdrawn in front
      c.strokeStyle = Theme.dark ? "#90A4AE" : "#546E7A"; c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(x0 + 8, bskBot); c.lineTo(x0 + chW - 8, bskBot);
      c.moveTo(bskX, bskTop + 18); c.lineTo(bskX, bskBot);
      c.moveTo(bskX + bskW, bskTop + 18); c.lineTo(bskX + bskW, bskBot);
      c.stroke();

      c.restore(); // end inner chamber clip

      // Inner chamber border
      Gfx.rr(c, x0, y0, chW, chH, 16);
      c.strokeStyle = rgba(T.ink, 0.48); c.lineWidth = 1.5; c.stroke();

      // Domed heavy autoclave lid with clamping wing-bolts
      Gfx.rr(c, x0 - 16, y0 - 20, chW + 32, 13, 6);
      const lidG = c.createLinearGradient(x0 - 16, 0, x0 + chW + 16, 0);
      lidG.addColorStop(0, Theme.dark ? "#37474F" : "#78909C");
      lidG.addColorStop(0.35, Theme.dark ? "#607D8B" : "#ECEFF1");
      lidG.addColorStop(1, Theme.dark ? "#263238" : "#607D8B");
      c.fillStyle = lidG; c.fill();
      c.strokeStyle = rgba(T.ink, 0.55); c.lineWidth = 1.3; c.stroke();
      for (const bx of [x0 - 8, x0 + chW * 0.12, x0 + chW * 0.5, x0 + chW * 0.88, x0 + chW + 8]) {
        Gfx.rr(c, bx - 3, y0 - 24, 6, 8, 2);
        c.fillStyle = Theme.dark ? "#90A4AE" : "#455A64"; c.fill();
      }

      // Brass/Copper pressure manometer with tick marks, red limit line, and glass reflection
      const gx = x0 + chW * 0.25, gy = y0 - 38, gr = 18;
      // Brass bezel
      const brassG = c.createLinearGradient(gx - gr, gy - gr, gx + gr, gy + gr);
      brassG.addColorStop(0, "#FFE082");
      brassG.addColorStop(0.5, "#D49B2A");
      brassG.addColorStop(1, "#795548");
      c.fillStyle = brassG;
      c.beginPath(); c.arc(gx, gy, gr + 3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = rgba(T.ink, 0.6); c.lineWidth = 1.1; c.stroke();

      // Dial face
      c.fillStyle = Theme.dark ? "#141C22" : "#FCFBF7";
      c.beginPath(); c.arc(gx, gy, gr, 0, Math.PI * 2); c.fill();
      // Scale ticks
      for (let tk = 0; tk <= 8; tk++) {
        const aTk = -Math.PI * 0.75 + (tk / 8) * Math.PI * 1.5;
        c.strokeStyle = tk >= 6 ? "#C62828" : rgba(T.ink, 0.55);
        c.lineWidth = tk % 2 === 0 ? 1.4 : 0.8;
        c.beginPath();
        c.moveTo(gx + Math.cos(aTk) * (gr - 4.5), gy + Math.sin(aTk) * (gr - 4.5));
        c.lineTo(gx + Math.cos(aTk) * (gr - 1.2), gy + Math.sin(aTk) * (gr - 1.2));
        c.stroke();
      }
      // Needle
      const ang = -Math.PI * 0.75 + clamp(pAtm / 2.2, 0, 1) * Math.PI * 1.5;
      c.strokeStyle = pAtm > 1.35 ? "#C62828" : "#2E7D32"; c.lineWidth = 2.1;
      c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(ang) * (gr - 3.5), gy + Math.sin(ang) * (gr - 3.5)); c.stroke();
      Gfx.sphere(c, gx, gy, 2.8, "#D49B2A");
      // Specular glass highlight on manometer
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.beginPath(); c.arc(gx - 3, gy - 3, gr * 0.75, -Math.PI * 0.85, -Math.PI * 0.15); c.fill();
      Gfx.text(c, `${fmt(pAtm, 2)} атм`, gx, gy - gr - 6, { align: "center", size: 10.5, weight: 700, font: "mono", color: T.ink });

      // Steam purge valve on top right with animated steam jet when airPurged
      const vx = x0 + chW * 0.68, vy = y0 - 20;
      c.strokeStyle = "#B8860B"; c.lineWidth = 3.0;
      c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx, vy - 14); c.lineTo(vx + 12, vy - 14); c.stroke();
      if (airPurged) {
        for (let s = 0; s < 4; s++) {
          const sx = vx + 16 + ((time * 24 + s * 6) % 22);
          const sy = vy - 14 - ((time * 8 + s * 3) % 8);
          Gfx.glow(c, sx, sy, 6 + s * 2, "#FFFFFF", 0.35);
        }
      }
      Gfx.chip(c, airPurged ? "Кран продуто ✓" : "Повітря в камері!", vx + 16, vy - 14, {
        color: airPurged ? T.accent : "#C62828",
        bg: airPurged ? rgba(T.accent, 0.12) : "rgba(198,40,40,0.14)"
      });

      // Right panel: summary badges and physical state
      const rx = w * 0.60, rw = w * 0.37;
      Gfx.rr(c, rx, y0 - 12, rw, chH + 24, 12);
      c.fillStyle = Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(15,42,29,0.03)"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();

      Gfx.text(c, "Параметри автоклава ВК-75 (ЛР № 1)", rx + 14, y0 + 12, { size: 12, weight: 700, color: T.ink });
      const rows = [
        ["Посудина:", `${R.ves.v} мл (норма ${R.ves.tRec} хв)`],
        ["Інерція прогріву τ:", `${fmt(R.ves.tau, 1)} хв`],
        ["Температура пари:", `${fmt(R.tSteam, 1)} °C`],
        ["Летальна доза F₀:", `${fmt(R.f0, 1)} хв (поріг ≥ 18 хв)`],
        ["Залишкові спори:", `${fmt(R.finalLogN, 1)} lg (SAL ≤ −6 lg)`],
        ["5-ГМФ (реакція Майяра):", `${fmt(R.hmf, 1)} мг/л`],
        ["Руйнування тіаміну:", `${fmt(R.b1LostPct, 1)} %`],
      ];
      rows.forEach(([k, val], i) => {
        const yy = y0 + 36 + i * 24;
        Gfx.text(c, k, rx + 14, yy, { size: 11, color: T.muted });
        Gfx.text(c, val, rx + rw - 14, yy, { size: 11, weight: 600, font: "mono", align: "right", color: T.ink });
      });

      const statusCol = !sterOK ? "#C62828" : caramelized ? "#D97706" : T.accent;
      const statusTxt = !sterOK
        ? "НЕСТЕРИЛЬНО: спори виживають!"
        : caramelized
        ? "СТЕРИЛЬНО, але карамелізація сахарози!"
        : "ОПТИМАЛЬНА СТЕРИЛІЗАЦІЯ (SAL ≤ 10⁻⁶)";
      Gfx.rr(c, rx + 12, y0 + chH - 24, rw - 24, 26, 7);
      c.fillStyle = alpha(statusCol, 0.15); c.fill();
      Gfx.text(c, statusTxt, rx + rw / 2, y0 + chH - 7, { align: "center", size: 10.5, weight: 700, color: statusCol });

      // Status callout below
      outA.set(`
        <b>Аналіз режиму автоклавування (${R.ves.label}):</b> при надлишковому тиску <b>${fmt(pAtm, 2)} атм</b> ${airPurged ? "(повітря повністю витіснено парою)" : "(УВАГА: повітря не випущено, температура пари занижена!)"} температура насиченої пари становить <b>${fmt(R.tSteam, 1)} °C</b>, а характерний час прогрівання центрального шару розчину дорівнює <b>τ = ${fmt(R.ves.tau, 1)} хв</b>. За <b>${tHold} хв</b> експозиції інтегральний летальний ефект досягає <b>F₀ = ${fmt(R.f0, 1)} хв</b>, знижуючи титр термостійких ендоспор із $10^{${fmt(n0Log, 1)}}$ до $10^{${fmt(R.finalLogN, 1)}}$. Концентрація продукту карамелізації сахарози (5-гідроксиметилфурфуролу) становить <b>${fmt(R.hmf, 1)} мг/л</b> (втрати тіаміну B₁ — <b>${fmt(R.b1LostPct, 1)} %</b>).
      `);

      // Chart A1: T_cam, T_core & spore logN
      drawChart(chA1.ctx, chA1.w, chA1.h, {
        x: [0, R.tTotal], y: [20, 140],
        xl: "Час автоклавування t, хв", yl: "Температура T, °C",
        hl: [{ y: 121, color: rgba(T.accent, 0.55), label: "Еталон 121 °C" }],
        vl: [{ x: R.ves.tRec, color: rgba(T.gold, 0.7), label: `Норма табл. 2 (${R.ves.tRec} хв)` }],
        series: [
          { pts: R.ptsTCam, color: "#D97706", w: 1.8, dash: [4, 3] },
          { pts: R.ptsTCore, color: T.accent, w: 2.6, fill: rgba(T.accent, 0.10) },
          { pts: R.ptsLogN.map(([x, y]) => [x, 20 + (y + 10) * 6]), color: "#C62828", w: 2.1 }
        ],
        legend: [
          { label: "T камери (°C)", color: "#D97706" },
          { label: "T ядра колби (°C)", color: T.accent },
          { label: "Життєздатні спори lg N (шкала −10…+10)", color: "#C62828" }
        ]
      });

      // Chart A2: Table 2 vessel volumes vs recommended time
      const tabPts = VESSELS.map((v, i) => [i + 1, v.tRec]);
      const curPts = [[vIdx + 1, tHold]];
      drawChart(chA2.ctx, chA2.w, chA2.h, {
        x: [0.5, 5.5], y: [0, 50],
        xt: [1, 2, 3, 4, 5],
        xfmt: v => ["", "20–50 мл", "75 мл", "150–500", "1000 мл", "2000 мл"][Math.round(v)] || "",
        xl: "Об'єм посудини за табл. 2", yl: "Тривалість стерилізації, хв",
        series: [
          { pts: tabPts, bars: true, bw: 28, color: rgba(T.accent, 0.45) },
          { pts: tabPts, color: T.accent, w: 2, dots: 4 }
        ],
        marks: [
          { x: vIdx + 1, y: tHold, r: 6, color: "#D97706", label: `Обрано: ${tHold} хв` }
        ],
        legend: [
          { label: "Норма за табл. 2 (121 °C)", color: T.accent },
          { label: "Ваш поточний режим", color: "#D97706" }
        ]
      });
    }

    /* ==================== TAB B: MEDIA CONSTRUCTOR (TABLE 3) ==================== */
    const B = M.box("b");
    let medKey = "MS";
    let saltMult = 1.0; // 0.25x, 0.5x (1/2 MS), 1.0x, 1.5x, 2.0x
    let sucGL = 30; // g/L sucrose
    let volL = 1.0; // target batch volume in L
    let chelateOK = true; // whether Na2EDTA is added with FeSO4

    const stB = new Stage(B.st, { aspect: 1.75, minH: 280, maxH: 410 });
    const rdB = UI.reads(B.st, [
      ["psi", "Осмотичний потенціал Ψs"],
      ["ion", "Іонна сила розчину I"],
      ["ntot", "Загальний азот (NH₄⁺ + NO₃⁻)"],
      ["mass", "Сумарна маса солей + сахарози"],
    ]);

    UI.select(B.ct, {
      id: "l1-med", label: "Пропис середовища (табл. 3)", value: medKey,
      options: Object.entries(MEDIA_DATA).map(([k, v]) => [k, v.name]),
      on: v => { medKey = v; sSuc.set(MEDIA_DATA[v].suc0); sucGL = MEDIA_DATA[v].suc0; }
    });
    const sSalt = UI.slider(B.ct, {
      id: "l1-mult", label: "Кратність макросолей (1/2 МС … 2× МС)", min: 0.25, max: 2.0, step: 0.25, value: saltMult, unit: "×",
      fmt: v => fmt(v, 2), on: v => { saltMult = v; }
    });
    const sSuc = UI.slider(B.ct, {
      id: "l1-suc", label: "Концентрація сахарози Cсах", min: 0, max: 80, step: 2, value: sucGL, unit: "г/л",
      fmt: v => fmt(v, 0), on: v => { sucGL = v; }
    });
    const sVol = UI.slider(B.ct, {
      id: "l1-vol", label: "Об'єм партії середовища V", min: 0.25, max: 5.0, step: 0.25, value: volL, unit: "л",
      fmt: v => fmt(v, 2), on: v => { volL = v; }
    });
    UI.check(B.ct, {
      id: "l1-edta", label: "Хелатувати залізо трилоном Б (Na₂ЕДТА · 1:1)", value: chelateOK,
      on: v => { chelateOK = v; }
    });
    UI.buttons(B.ct, [
      { label: "Стандарт МС (1× · 30 г/л)", pri: true, on: () => { medKey = "MS"; $("#l1-med").value = "MS"; sSalt.set(1.0); saltMult = 1.0; sSuc.set(30); sucGL = 30; } },
      { label: "1/2 МС для вкорінення (0,5× · 15 г/л)", on: () => { medKey = "MS"; $("#l1-med").value = "MS"; sSalt.set(0.5); saltMult = 0.5; sSuc.set(15); sucGL = 15; } },
      { label: "Мікробульби (МС · 70 г/л сах.)", on: () => { medKey = "MS"; $("#l1-med").value = "MS"; sSalt.set(1.0); saltMult = 1.0; sSuc.set(70); sucGL = 70; } }
    ]);

    const outB = UI.out(B.bl, "");
    const chRowB = h("div", { class: "charts" }); B.bl.append(chRowB);
    const chB1 = UI.chart(chRowB, "Порівняння мінерального профілю середовищ за табл. 3 (мМ іонів)");
    const chB2 = UI.chart(chRowB, "Внесок солей та сахарози в осмотичний потенціал Ψs (МПа)");

    function calcMedia(key = medKey, mult = saltMult, suc = sucGL) {
      const D = MEDIA_DATA[key];
      let osmSalt = 0; // mol/L osmoles
      let ionStr = 0; // mol/L ionic strength
      let saltMgL = 0;
      for (const [name, mg, mw, vantHoff, z2factor] of D.macro) {
        const mgl = mg * mult;
        saltMgL += mgl;
        const molL = (mgl / 1000) / mw;
        osmSalt += molL * vantHoff;
        ionStr += molL * z2factor;
      }
      const microMgL = D.micro.reduce((s, x) => s + x[1], 0);
      const feMgL = D.fe.reduce((s, x) => s + x[1], 0);
      const vitMgL = D.vit.reduce((s, x) => s + x[1], 0);
      const totalSaltGL = (saltMgL + microMgL + feMgL + vitMgL) / 1000;
      const osmSuc = suc / 342.3; // mol/L
      const RT = 2.479; // L*MPa/mol at 25 °C
      const psiSalt = -RT * osmSalt;
      const psiSuc = -RT * osmSuc;
      const psiTot = psiSalt + psiSuc;
      // N balance in mM
      let nh4 = 0, no3 = 0, kIon = 0, caIon = 0, po4 = 0;
      if (key === "MS") { nh4 = 20.61 * mult; no3 = 39.40 * mult; kIon = 20.05 * mult; caIon = 2.99 * mult; po4 = 1.25 * mult; }
      else if (key === "B5") { nh4 = 2.03 * mult; no3 = 24.73 * mult; kIon = 24.73 * mult; caIon = 1.02 * mult; po4 = 1.09 * mult; }
      else if (key === "White") { nh4 = 0; no3 = 3.33 * mult; kIon = 1.66 * mult; caIon = 1.27 * mult; po4 = 0.12 * mult; }
      else if (key === "Miller") { nh4 = 12.49 * mult; no3 = 26.62 * mult; kIon = 12.97 * mult; caIon = 2.12 * mult; po4 = 2.20 * mult; }
      return { D, totalSaltGL, psiSalt, psiSuc, psiTot, ionStr: ionStr * 1000, nh4, no3, kIon, caIon, po4 };
    }

    function drawB(time) {
      const { ctx: c, w, h: hh } = stB;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const M0 = calcMedia();

      rdB.set("psi", fmt(M0.psiTot, 2), "МПа");
      rdB.set("ion", fmt(M0.ionStr, 1), "мМ");
      rdB.set("ntot", `${fmt(M0.nh4 + M0.no3, 1)} (${fmt(M0.nh4, 1)} + ${fmt(M0.no3, 1)})`, "мМ");
      rdB.set("mass", `${fmt(M0.totalSaltGL * volL, 2)} г солей + ${fmt(sucGL * volL, 0)} г сах.`, `на ${fmt(volL, 2)} л`);

      // Draw 5 stock bottles on top-left pouring aliquots into the main 1L volumetric flask
      const stocks = [
        { name: "Макро (20×)", alq: 50 * saltMult * volL, col: "#4FC3F7" },
        { name: "CaCl₂ (100×)", alq: 10 * saltMult * volL, col: "#81C784" },
        { name: "Мікро (1000×)", alq: 1 * volL, col: "#BA68C8" },
        { name: "Fe-ЕДТА (200×)", alq: 5 * volL, col: "#FFB74D" },
        { name: "Вітаміни (100×)", alq: 10 * volL, col: "#F06292" },
      ];
      const bx0 = 18, by0 = 36, bw = 42, bh = 68, gap = Math.min(58, (w * 0.52) / 5);
      Gfx.text(c, "Маточні сток-розчини (ЛР № 2) та аліквоти на партію:", bx0, 20, { size: 11.5, weight: 700, color: T.ink });

      stocks.forEach((s, i) => {
        const x = bx0 + i * gap;
        Gfx.vial(c, x, by0, bw, bh, { fill: 0.72, col: alpha(s.col, 0.55), cap: true });
        Gfx.text(c, s.name, x + bw / 2, by0 + bh + 13, { align: "center", size: 9.5, weight: 600, color: T.ink });
        Gfx.text(c, `${fmt(s.alq, s.alq < 5 ? 1 : 0)} мл`, x + bw / 2, by0 + bh + 25, { align: "center", size: 10, font: "mono", weight: 700, color: T.accent });
      });

      // Lower section on left: Chelation schematic (FeSO4 + Na2EDTA vs FePO4 precipitate)
      const cyBox = by0 + bh + 38, chBox = hh - cyBox - 12;
      Gfx.rr(c, bx0, cyBox, w * 0.50, chBox, 10);
      c.fillStyle = Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(15,42,29,0.035)"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
      Gfx.text(c, chelateOK ? "Хелатний комплекс [Fe(ЕДТА)]⁻ — іони Fe²⁺/Fe³⁺ захищені в розчині" : "БЕЗ Na₂ЕДТА: випадання нерозчинного осаду FePO₄↓ та Fe(OH)₃↓!", bx0 + 12, cyBox + 18, {
        size: 11, weight: 700, color: chelateOK ? T.accent : "#C62828"
      });
      const ringX = bx0 + w * 0.25, ringY = cyBox + chBox * 0.58;
      if (chelateOK) {
        Gfx.glow(c, ringX, ringY, 34, "#FFB74D", 0.45);
        Gfx.sphere(c, ringX, ringY, 11, "#E65100");
        Gfx.text(c, "Fe²⁺", ringX, ringY + 4, { align: "center", size: 9.5, weight: 700, color: "#FFF" });
        const ligs = ["COO⁻", "COO⁻", "N", "N", "COO⁻", "COO⁻"];
        ligs.forEach((lb, j) => {
          const a = time * 0.6 + (j * Math.PI * 2) / 6;
          const lx = ringX + Math.cos(a) * 28, ly = ringY + Math.sin(a) * 20;
          c.strokeStyle = rgba(T.accent, 0.55); c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(ringX, ringY); c.lineTo(lx, ly); c.stroke();
          Gfx.sphere(c, lx, ly, 6.5, "#2E7D32");
        });
      } else {
        // Show brown precipitate at bottom
        for (let j = 0; j < 18; j++) {
          const px = ringX - 65 + (j * 7.5), py = cyBox + chBox - 14 - (j % 3) * 4;
          Gfx.sphere(c, px, py, 5, "#8D4E2A");
        }
        Gfx.text(c, "Осад FePO₄↓ на дні колби (залізний хлороз експлантатів)", ringX, ringY - 4, { align: "center", size: 10.5, color: "#C62828", weight: 600 });
      }

      // Right side: Large main preparation flask
      const fx = w * 0.76, fy = 36, fw = Math.min(w * 0.34, 155), fh = hh - 64;
      const flCol = chelateOK ? "rgba(244, 228, 168, 0.62)" : "rgba(195, 140, 95, 0.68)";
      Gfx.flask(c, fx, fy, fw, fh, 0.68, flCol, {
        wave: time * 1.8,
        plug: false,
        label: `${M0.D.short} (${fmt(volL, 2)} л) · Ψs = ${fmt(M0.psiTot, 2)} МПа`,
        inside(ctx, ly) {
          const r2 = rng(202);
          for (let i = 0; i < 24; i++) {
            const ix = fx + (r2() - 0.5) * fw * 0.72;
            const iy = ly + 10 + ((time * 14 + r2() * (fh * 0.6)) % Math.max(10, fh * 0.58));
            c.fillStyle = i % 3 === 0 ? "#2E7D32" : i % 3 === 1 ? "#1565C0" : "#E65100";
            c.globalAlpha = 0.55;
            c.beginPath(); c.arc(ix, iy, 2.3, 0, 7); c.fill();
          }
          c.globalAlpha = 1;
          if (!chelateOK) {
            c.fillStyle = "rgba(130, 65, 25, 0.75)";
            c.fillRect(fx - fw / 2, fy + fh - 12, fw, 12);
          }
        }
      });

      // Recipe table in output box
      const macroRows = M0.D.macro.map(([nm, mg]) => `<tr><td>${nm}</td><td class="n">${fmt(mg, 1)}</td><td class="n"><b>${fmt(mg * saltMult * volL, 1)} мг</b></td></tr>`).join("");
      outB.set(`
        <b>Пропис середовища ${M0.D.name}:</b> ${M0.D.desc}<br/>
        Для приготування <b>${fmt(volL, 2)} л</b> середовища з кратністю солей <b>${fmt(saltMult, 2)}×</b> та <b>${fmt(sucGL, 0)} г/л сахарози</b> осмотичний потенціал становить <b>$\\Psi_s = ${fmt(M0.psiTot, 2)}\\text{ МПа}$</b> (внесок солей ${fmt(M0.psiSalt, 2)} МПа, сахарози ${fmt(M0.psiSuc, 2)} МПа).
        <div class="tblwrap" style="margin-top:8px"><table class="t bt">
          <thead><tr><th>Макросіль (табл. 3)</th><th class="n">Норма 1×, мг/л</th><th class="n">Наважка на ${fmt(volL, 2)} л (${fmt(saltMult, 2)}×)</th></tr></thead>
          <tbody>${macroRows}</tbody>
        </table></div>
      `);

      // Chart B1: Ion comparison across all 4 media
      const keys = ["MS", "B5", "White", "Miller"];
      const nh4Pts = [], no3Pts = [], kPts = [];
      keys.forEach((k, i) => {
        const m = calcMedia(k, k === medKey ? saltMult : 1, sucGL);
        nh4Pts.push([i + 1 - 0.18, m.nh4]);
        no3Pts.push([i + 1, m.no3]);
        kPts.push([i + 1 + 0.18, m.kIon]);
      });
      drawChart(chB1.ctx, chB1.w, chB1.h, {
        x: [0.4, 4.6], y: [0, 65],
        xt: [1, 2, 3, 4],
        xfmt: v => ["", "МС", "Гамборга B₅", "Уайта", "Міллера"][Math.round(v)] || "",
        xl: "Живильне середовище (табл. 3)", yl: "Концентрація іонів, мМ",
        series: [
          { pts: nh4Pts, bars: true, bw: 14, color: "#1565C0" },
          { pts: no3Pts, bars: true, bw: 14, color: T.accent },
          { pts: kPts, bars: true, bw: 14, color: "#D97706" },
        ],
        legend: [
          { label: "Амоній NH₄⁺ (мМ)", color: "#1565C0" },
          { label: "Нітрат NO₃⁻ (мМ)", color: T.accent },
          { label: "Калій K⁺ (мМ)", color: "#D97706" }
        ]
      });

      // Chart B2: Osmotic potential vs sucrose for current medium
      const ptsPsiTot = [], ptsPsiSuc = [];
      for (let s = 0; s <= 80; s += 4) {
        const m = calcMedia(medKey, saltMult, s);
        ptsPsiTot.push([s, Math.abs(m.psiTot)]);
        ptsPsiSuc.push([s, Math.abs(m.psiSuc)]);
      }
      drawChart(chB2.ctx, chB2.w, chB2.h, {
        x: [0, 80], y: [0, 1.0],
        xl: "Концентрація сахарози Cсах, г/л", yl: "Осмотичний тиск −Ψs, МПа",
        band: [{ x0: 20, x1: 30, color: rgba(T.accent, 0.10) }],
        series: [
          { pts: ptsPsiTot, color: T.accent, w: 2.5, fill: rgba(T.accent, 0.10) },
          { pts: ptsPsiSuc, color: "#D97706", w: 1.8, dash: [4, 3] }
        ],
        marks: [{ x: sucGL, y: Math.abs(M0.psiTot), r: 5, color: T.accent, label: `${fmt(M0.psiTot, 2)} МПа` }],
        legend: [
          { label: "Сумарний −Ψs (солі + сахароза)", color: T.accent },
          { label: "Тільки сахароза", color: "#D97706" }
        ]
      });
    }

    /* ==================== TAB C: pH TITRATION & AGAR GELATION ==================== */
    const C = M.box("c");
    let naohMl = 2.6; // mL of 0.1 N NaOH (negative = HCl)
    let agarPct = 0.75; // % agar (6..10 g/L)
    let postAutoclave = true;

    const stC = new Stage(C.st, { aspect: 1.75, minH: 280, maxH: 410 });
    const rdC = UI.reads(C.st, [
      ["ph0", "pH до автоклавування"],
      ["ph1", "pH після автоклавування"],
      ["gel", "Міцність гелю агару G'"],
      ["state", "Фізичний стан середовища"],
    ]);

    const sTit = UI.slider(C.ct, {
      id: "l1-tit", label: "Додано титранту (−HCl … +NaOH 0,1 н.)", min: -4.0, max: 6.0, step: 0.1, value: naohMl, unit: "мл/л",
      fmt: v => (v >= 0 ? "+" : "") + fmt(v, 1), on: v => { naohMl = v; }
    });
    const sAgar = UI.slider(C.ct, {
      id: "l1-agar", label: "Концентрація агар-агару", min: 0.0, max: 1.2, step: 0.05, value: agarPct, unit: "%",
      fmt: v => `${fmt(v, 2)} % (${fmt(v * 10, 1)} г/л)`, on: v => { agarPct = v; }
    });
    UI.check(C.ct, {
      id: "l1-post", label: "Врахувати зсув pH та гідроліз агару при автоклавуванні (121 °C)", value: postAutoclave,
      on: v => { postAutoclave = v; }
    });
    UI.buttons(C.ct, [
      { label: "Довести до оптимуму (pH 5,7 · 0,75 % агару)", pri: true, on: () => { sTit.set(2.6); naohMl = 2.6; sAgar.set(0.75); agarPct = 0.75; } },
      { label: "Кисле середовище (pH 4,3 — гідроліз агару)", on: () => { sTit.set(-2.5); naohMl = -2.5; sAgar.set(0.75); agarPct = 0.75; } },
      { label: "Лужне середовище (pH 6,7 — осад солей)", on: () => { sTit.set(5.2); naohMl = 5.2; sAgar.set(0.75); agarPct = 0.75; } }
    ]);

    const outC = UI.out(C.bl, "");
    const chRowC = h("div", { class: "charts" }); C.bl.append(chRowC);
    const chC1 = UI.chart(chRowC, "Крива титрування живильного середовища МС (фосфатний буфер KH₂PO₄)");
    const chC2 = UI.chart(chRowC, "Міцність агарового гелю G' (г/см²) залежно від pH та концентрації агару");

    function phOfTit(vMl) {
      // Initial freshly dissolved MS medium has pH ~ 4.75 due to KH2PO4 and NH4NO3
      // Buffering zone around pKa2(H2PO4-) = 6.86 and Fe-EDTA
      return 4.75 + 0.36 * vMl + 0.035 * Math.sinh((vMl - 2.2) * 0.65);
    }
    function calcGel(phPre, agPct, autoclaved) {
      const phPost = autoclaved ? phPre - 0.18 - 0.08 * Math.max(0, phPre - 5.5) : phPre;
      const phEff = autoclaved ? phPost : phPre;
      // Agar gelation requires agPct > 0.35% and resists acid hydrolysis only if pH > 5.0 during autoclaving
      const acidFactor = autoclaved ? smooth(4.3, 5.45, phEff) : 1.0;
      const alkFactor = 1 - 0.35 * smooth(6.3, 7.4, phEff);
      const concFactor = Math.pow(Math.max(0, agPct - 0.25), 1.45) * 620;
      const gelG = concFactor * acidFactor * alkFactor;
      const precip = smooth(6.05, 6.75, phEff);
      return { phPre, phPost, phEff, gelG, precip, acidFactor };
    }

    function drawC(time) {
      const { ctx: c, w, h: hh } = stC;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const phPre = phOfTit(naohMl);
      const G = calcGel(phPre, agarPct, postAutoclave);

      const optPH = G.phPre >= 5.55 && G.phPre <= 5.85;
      const stateStr = agarPct < 0.3 ? "Рідке середовище" : G.gelG < 90 ? "Рідке (гідроліз агару!)" : G.gelG < 210 ? "Напіврідке (м'який гель)" : "Твердий пружний гель";

      rdC.set("ph0", fmt(G.phPre, 2), optPH ? "оптимум 5,6–5,8" : "поза нормою!");
      rdC.set("ph1", fmt(G.phPost, 2), postAutoclave ? "після 121 °C" : "без автоклав.");
      rdC.set("gel", fmt(G.gelG, 0), "г/см²");
      rdC.set("state", stateStr, G.precip > 0.25 ? "осад фосфатів!" : "");

      // Left: Digital pH-meter & beaker with magnetic stirrer
      const px = 22, py = 26, pw = Math.min(w * 0.42, 195), phMeterH = 92;
      Gfx.rr(c, px, py, pw, phMeterH, 12);
      c.fillStyle = Theme.dark ? "#1E2A24" : "#E6ECE8"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1.2; c.stroke();
      Gfx.rr(c, px + 12, py + 12, pw - 24, 48, 7);
      c.fillStyle = "#0E1F14"; c.fill();
      c.font = `700 24px ${FM()}`;
      c.fillStyle = optPH ? "#8CF290" : "#FFB74D";
      c.textAlign = "right"; c.textBaseline = "middle";
      c.fillText(`pH ${fmt(G.phPre, 2)}`, px + pw - 20, py + 36);
      Gfx.text(c, "Іономір · 25,0 °C", px + 18, py + 24, { size: 9.5, font: "mono", color: "#68B66C" });
      Gfx.text(c, optPH ? "Норма МС: 5,6–5,8 ✓" : G.phPre < 5.6 ? "Додайте 0,1 н. NaOH ↑" : "Додайте 0,1 н. HCl ↓", px + pw / 2, py + phMeterH - 13, {
        align: "center", size: 10.5, weight: 700, color: optPH ? T.accent : "#D97706"
      });

      // Petri dish / test tube showing explant sitting on surface vs sinking into hydrolyzed liquid agar
      const tx = w * 0.68, ty = 34, tw = Math.min(w * 0.44, 210), th = hh - 58;
      Gfx.petri(c, tx, ty + th * 0.48, Math.min(tw, th) * 0.42, {
        agar: G.precip > 0.3 ? "rgba(210,195,165,0.65)" : "rgba(235,224,175,0.45)",
        label: `Чашка Петрі (${fmt(agarPct, 2)} % агару, G' = ${fmt(G.gelG, 0)} г/см²)`
      });

      // Draw agarose polymer mesh inside Petri dish (dense cross-linked mesh if G.gelG high, broken fragments if low)
      const pr = Math.min(tw, th) * 0.36, pcx = tx, pcy = ty + th * 0.48;
      c.save();
      c.beginPath(); c.arc(pcx, pcy, pr, 0, 7); c.clip();
      const meshStrength = clamp(G.gelG / 350, 0, 1);
      c.strokeStyle = rgba(T.accent, 0.12 + 0.32 * meshStrength);
      c.lineWidth = 1.2;
      for (let i = -4; i <= 4; i++) {
        const off = i * (pr * 0.24);
        c.beginPath();
        if (meshStrength > 0.35) {
          c.moveTo(pcx - pr, pcy + off);
          c.bezierCurveTo(pcx - pr * 0.3, pcy + off + 6 * Math.sin(time * 2 + i), pcx + pr * 0.3, pcy + off - 6 * Math.sin(time * 2 + i), pcx + pr, pcy + off);
          c.moveTo(pcx + off, pcy - pr);
          c.lineTo(pcx + off, pcy + pr);
        } else {
          // Liquid wave / broken short chains
          for (let k = -2; k <= 2; k++) {
            const sx = pcx + k * 24 + Math.sin(time * 3 + i) * 5;
            c.moveTo(sx - 6, pcy + off); c.lineTo(sx + 6, pcy + off + 3);
          }
        }
        c.stroke();
      }
      // Explant in center of Petri dish
      const sink = meshStrength < 0.3 ? Math.sin(time * 3) * 4 : 0;
      Gfx.sphere(c, pcx, pcy + sink, 16, meshStrength >= 0.3 ? "#43A047" : "#689F38", { ring: rgba(T.ink, 0.4) });
      Gfx.text(c, meshStrength >= 0.3 ? "Експлантат на поверхні гелю" : "Експлантат тоне (гіпоксія!)", pcx, pcy + 28, {
        align: "center", size: 10, weight: 700, color: meshStrength >= 0.3 ? T.accent : "#C62828"
      });
      c.restore();

      outC.set(`
        <b>Фізико-хімічний висновок (ЛР № 4):</b> до автоклавування середовище має <b>pH ${fmt(G.phPre, 2)}</b>, а після стерилізації при 121 °C — <b>pH ${fmt(G.phPost, 2)}</b>. За концентрації агару <b>${fmt(agarPct, 2)} % (${fmt(agarPct * 10, 1)} г/л)</b> міцність утвореного гелю становить <b>G' = ${fmt(G.gelG, 0)} г/см²</b> (${stateStr}). ${G.acidFactor < 0.5 ? "Через занадто кислу реакцію середовища під час автоклавування відбувся кислотний гідроліз полісахаридних ланцюгів агарози!" : G.precip > 0.25 ? "Через підвищений pH (> 6,0) випадає нерозчинний осад фосфатів кальцію і заліза!" : "Середовище прозоре, щільність гелю оптимальна для утримання експлантата на межі поділу фаз «гель — повітря»."}
      `);

      // Chart C1: Titration curve
      const titPts = [];
      for (let v = -4; v <= 6; v += 0.2) titPts.push([v, phOfTit(v)]);
      drawChart(chC1.ctx, chC1.w, chC1.h, {
        x: [-4, 6], y: [3.2, 7.6],
        xl: "Об'єм титранту 0,1 н. (−HCl / +NaOH), мл/л", yl: "Показник pH середовища",
        hl: [
          { y: 5.6, color: rgba(T.accent, 0.6), label: "pH 5,6" },
          { y: 5.8, color: rgba(T.accent, 0.6), label: "pH 5,8 (норма)" }
        ],
        series: [{ pts: titPts, color: T.accent, w: 2.5 }],
        marks: [{ x: naohMl, y: G.phPre, r: 5.5, color: "#D97706", label: `pH ${fmt(G.phPre, 2)}` }]
      });

      // Chart C2: Gel strength vs pH
      const gelPts = [];
      for (let ph = 3.8; ph <= 7.2; ph += 0.1) {
        gelPts.push([ph, calcGel(ph, agarPct, postAutoclave).gelG]);
      }
      drawChart(chC2.ctx, chC2.w, chC2.h, {
        x: [3.8, 7.2], y: [0, 550],
        xl: "Початковий pH середовища перед автоклавуванням", yl: "Міцність гелю G', г/см²",
        band: [{ x0: 5.6, x1: 5.8, color: rgba(T.accent, 0.14) }],
        hl: [{ y: 180, color: "#D97706", label: "Межа твердого гелю" }],
        series: [{ pts: gelPts, color: T.accent, w: 2.5, fill: rgba(T.accent, 0.10) }],
        marks: [{ x: G.phPre, y: G.gelG, r: 5.5, color: "#C62828", label: `${fmt(G.gelG, 0)} г/см²` }]
      });
    }

    M.init();
    return {
      stages: [stA, chA1, chA2, stB, chB1, chB2, stC, chC1, chC2],
      frame(dt, time) {
        if (mode === "a") drawA(time);
        else if (mode === "b") drawB(time);
        else drawC(time);
      }
    };
  }
});
})();
