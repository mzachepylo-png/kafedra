(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

App.def(11, {
  cheat: `
    <p class="lead">
      Методи <b>генетичної інженерії рослин</b> базуються на природній системі горизонтального перенесення генів ґрунтової фітопатогенної бактерії <i>Agrobacterium tumefaciens</i> (лабораторні роботи № 41–44), препаративному виділенні й хлорамфеніколовій ампліфікації векторних плазмід <i>Escherichia coli</i> (на прикладі класичної плазміди <code>pBR322</code>, ЛР 45–48), а також кількісному та якісному контролі препаратів дезоксирибонуклеїнової (ДНК) і рибонуклеїнової (РНК) кислот методами <b>ультрафіолетової (УФ) спектрофотометрії при 260/280 нм</b> та <b>електрофорезу в агарозному гелі</b> (ЛР 49–50).
    </p>

    <h3>1. Біологія Agrobacterium tumefaciens, індукція корончастих галів та трансформація (ЛР 41–44)</h3>
    <p>
      Вірулентні штами <i>Agrobacterium tumefaciens</i> містять велику (~200 т.п.н.) <b>Ti-плазміду</b> (від англ. <i>tumor-inducing</i> — пухлиноіндукуюча), фрагмент якої — <b>Т-ДНК</b> (<i>transfer DNA</i>, 12–24 т.п.н.), обмежений консервативними прямими повторами довжиною 25 пар нуклеотидів (п.н.) — лівим (<code>LB</code>) і правим (<code>RB</code>) кордонами, переноситься до ядра рослинної клітини та ковалентно інтегрується в її хромосоми.
    </p>
    <ul>
      <li><b>Хемотаксис і активація <i>vir</i>-оперона:</b> клітини пораненої рослинної тканини виділяють у кисле середовище (pH 5,2–5,6) низькомолекулярні фенольні сполуки — передусім <b>ацетосирингон</b> та α-гідроксіацетосирингон. Мембранна гістидинкіназа <code>VirA</code> розпізнає фенольний сигнал і фосфорилює транскрипційний фактор <code>VirG</code>, який активує експресію генів вірулентності (<code>virB, virC, virD, virE</code>).</li>
      <li><b>Вирізання і транспорт Т-нитки:</b> ендонуклеазний комплекс <code>VirD1/VirD2</code> вносить одноланцюговий розрив у сайт <code>RB</code>, звільняючи одноланцюгову Т-нитку (<i>T-strand</i>) із ковалентно приєднаним до 5′-кінця білком <code>VirD2</code>. Білки <code>VirE2</code> вкривають Т-нитку, захищаючи її від нуклеаз, а апарат секреції IV типу (пілус <code>VirB/VirD4</code>) транспортує комплекс у цитоплазму і далі через ядерні пори рослинної клітини.</li>
      <li><b>Дикі Ti-плазміди та корончасті гали (ЛР 41–42):</b> нативна Т-ДНК несе онкогени автономного синтезу фітогормонів: <code>iaaM</code> (триптофан-2-монооксигеназа) та <code>iaaH</code> (індоліл-3-ацетамідгідролаза) перетворюють триптофан на індоліл-3-оцтову кислоту (ІОК, ауксин), а ген <code>ipt</code> (ізопентенілтрансфераза) синтезує цитокінін ізопентеніладенін. Тому інфіковані диски коренеплоду моркви (<i>Daucus carota</i> L.) та стебла томата (<i>Solanum lycopersicum</i> L.) утворюють <b>корончасті гали</b>, здатні необмежено рости <i>in vitro</i> на <b>безгормональному середовищі Мурасіге—Скуга (МС)</b> і синтезувати специфічні похідні амінокислот — <b>опіни</b> (октопін або нопалін), які слугують джерелом карбону й нітрогену для агробактерій.</li>
      <li><b>Обеззброєні вектори та трансформація листкових дисків тютюну (ЛР 43–44):</b> у генно-інженерних бінарних векторах онкогени <code>iaaM, iaaH, ipt</code> видалено («обеззброєна» Т-ДНК), а між <code>RB</code> і <code>LB</code> вбудовано цільовий ген та селективний маркер — найчастіше ген <b>неоміцинфосфотрансферази II (<code>nptII</code>)</b> під контролем нопалінсинтазного промотора (<code>Pnos</code>), який фосфорилює й інактивує аміноглікозидні антибіотики (<b>канаміцин</b>, неоміцин, генетицин G418). Після 48 год кокультивації експлантатів <i>Nicotiana tabacum</i> L. з агробактеріями диски переносять на регенераційні середовища R, R<sub>1</sub>, R<sub>2</sub> з <b>канаміцином (50–100 мг/л)</b> для відбору трансгенних пагонів та <b>клафораном (цефотаксимом, 250–500 мг/л)</b> або карбеніциліном для повного знищення клітин <i>A. tumefaciens</i>.</li>
    </ul>

    <h3>2. Ампліфікація плазміди pBR322 та лужний лізис E. coli (ЛР 45–48)</h3>
    <p>
      Векторна плазміда <b><code>pBR322</code></b> (довжина <b>4361 п.н.</b>, молекулярна маса 2,88 МДа) містить гени стійкості до ампіциліну (Ap<sup>r</sup>, β-лактамаза) і тетрацикліну (Tc<sup>r</sup>), унікальні сайти рестрикції (<code>EcoRI, HindIII, BamHI, SalI, PstI</code>) та реплікон типу <code>ColE1</code> (<i>relaxed control</i> — «послаблений контроль реплікації»).
    </p>
    <div class="bcall bcall--idea">
      <b>Принцип хлорамфеніколової ампліфікації (ЛР 46)</b>
      <p>
        Ініціація реплікації бактеріальної хромосоми <i>Escherichia coli</i> в точці <i>oriC</i> потребує синтезу <i>de novo</i> білка-ініціатора DnaA у кожному клітинному циклі. Натомість реплікація плазміди <code>pBR322</code> здійснюється стабільними конститутивними ферментами клітини-хазяїна (ДНК-полімеразою І та РНК-полімеразою) і регулюється лише короткими некодуючими молекулами РНК I та РНК II. Якщо в середині логарифмічної фази росту культури (<i>D</i><sub>600</sub> ≈ 0,6–0,8) додати бактеріостатичний антибіотик <b>хлорамфенікол (170 мкг/мл)</b>, він блокує 50S субодиницю рибосом: поділ клітин і реплікація хромосомної ДНК миттєво припиняються, а плазміда <code>pBR322</code> продовжує реплікуватися протягом 12–16 год, збільшуючи копійність із <b>20–40 до 1000–3000 копій на клітину</b> (до 40–50 % сумарної клітинної ДНК)!
      </p>
    </div>

    <p>
      Препаративне виділення плазмідної ДНК проводять методом <b>лужного лізису за Бірнбоймом—Долі</b> (ЛР 47–48), що ґрунтується на топологічній відмінності між ковалентно замкненою кільцевою суперспіралізованою плазмідою (<code>cccDNA</code>) та лінійно фрагментованою високомолекулярною хромосомною ДНК:
    </p>
    <div class="tblwrap">
      <table class="t bt">
        <thead>
          <tr>
            <th>Етап / Розчин</th>
            <th>Склад реактиву</th>
            <th>Біохімічна та фізико-хімічна функція</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Розчин I (ресуспендування)</td>
            <td>50 мМ глюкоза, 25 мМ Трис-HCl (pH 8,0), 10 мМ ЕДТА + лізоцим (5 мг/мл)</td>
            <td>Глюкоза підтримує осмотичний тиск; ЕДТА зв’язує йони Mg<sup>2+</sup>/Ca<sup>2+</sup> (дестабілізує зовнішню мембрану грамнегативних бактерій та інгібує клітинні ДНКази); лізоцим гідролізує β(1→4)-глікозидні зв’язки пептидоглікану, утворюючи сферопласти.</td>
          </tr>
          <tr>
            <td>Розчин II (лужний лізис)</td>
            <td>0,2 н. NaOH + 1 % додецилсульфат натрію (ДСН / SDS), <b>pH 12,0–12,5</b></td>
            <td>Аніонний детергент ДСН руйнує ліпідні мембрани та денатурує білки. При pH 12,0–12,5 водневі зв’язки між комплементарними основами ДНК розриваються: лінійні фрагменти хромосомної ДНК розходяться на окремі нитки, а кільцеві ланцюги суперспіралізованої плазміди (<code>cccDNA</code>) залишаються топологічно зчепленими.</td>
          </tr>
          <tr>
            <td>Розчин III (нейтралізація)</td>
            <td>3 М CH<sub>3</sub>COOK (ацетат калію), доведений льодяною CH<sub>3</sub>COOH до pH 4,8</td>
            <td>Різке зниження pH зумовлює миттєву точну ренатурацію комплементарних ланцюгів плазміди, тоді як довгі нитки хромосомної ДНК безладно переплутуються і разом із нерозчинним осадом додецилсульфату калію (KDS) та денатурованими білками випадають в осад при центрифугуванні.</td>
          </tr>
          <tr>
            <td>Спиртове осадження</td>
            <td>0,6 об’єму ізопропанолу або 2,5 об’єму охолодженого 96 % етанолу (−20 °C)</td>
            <td>Дегідратація фосфатного остова нуклеїнових кислот у присутності одновалентних катіонів (K<sup>+</sup>/Na<sup>+</sup>) і кількісне осадження очищеної плазмідної ДНК із супернатанту.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3>3. УФ-спектрофотометрія ДНК і РНК (ЛР 50) та електрофорез в агарозному гелі (ЛР 49)</h3>
    <p>
      Пуринові (аденін, гуанін) та піримідинові (цитозин, тимін, урацил) азотисті основи нуклеїнових кислот мають спряжені подвійні зв’язки у гетероциклічних кільцях і інтенсивно поглинають ультрафіолетове світло з максимумом при <b>λ<sub>max</sub> = 260 нм</b>. Ароматичні амінокислоти білків (триптофан, тирозин, фенілаланін) мають максимум поглинання при <b>λ = 280 нм</b>, а фенол і солі гуанідину/тіоціанату — при λ = 230 нм.
    </p>
    <p>
      За законом Бугера—Ламберта—Бера у кварцовій кюветі з довжиною оптичного шляху <i>l</i> = 10 мм (1 см) одиниця оптичної густини (<i>D</i><sub>260</sub> = 1,0) відповідає концентрації: <b>50 мкг/мл</b> для дволанцюгової нативної ДНК (dsDNA), <b>40 мкг/мл</b> для одноланцюгової ДНК чи РНК (ssRNA) та <b>33 мкг/мл</b> для олігонуклеотидів. Звідси розрахункові формули практикуму (ЛР 50, с. 181):
    </p>
    <div class="eq">
      <i>C</i><sub>ДНК</sub> = <i>D</i><sub>260</sub> · 50 · <i>K</i> (мкг/мл), &emsp; <i>C</i><sub>РНК</sub> = <i>D</i><sub>260</sub> · 40 · <i>K</i> (мкг/мл), &emsp; <i>R</i> = <i>D</i><sub>260</sub> / <i>D</i><sub>280</sub>
    </div>
    <p>
      Де <i>K</i> = <i>V</i><sub>кювети</sub> / <i>V</i><sub>аліквоти</sub> — кратність розведення вихідного препарату в буфері ТЕ. Критерій чистоти препарату:
    </p>
    <ul>
      <li><b>Чиста нативна ДНК:</b> <i>R</i> = <i>D</i><sub>260</sub> / <i>D</i><sub>280</sub> = <b>1,75–1,85</b> (еталонне значення <b>1,80</b>);</li>
      <li><b>Чиста РНК:</b> <i>R</i> = <i>D</i><sub>260</sub> / <i>D</i><sub>280</sub> = <b>1,90–2,05</b> (еталонне значення <b>2,00</b>);</li>
      <li><b>Забруднення білками або фенолом:</b> <i>R</i> &lt; 1,70 (потребує додаткової депротеїнізації сумішшю фенол–хлороформ 1:1);</li>
      <li><b>Домішка РНК у препараті ДНК:</b> <i>R</i> &gt; 1,90 (потребує обробки панкреатичною РНКазою А).</li>
    </ul>

    <p>
      При <b>горизонтальному електрофорезі у 0,8 % агарозному гелі</b> (ЛР 49) у трис-боратному (TBE) або трис-ацетатному (TAE) буфері (pH 8,0–8,3) негативно заряджені молекули ДНК (завдяки дисоціації залишків ортофосфатної кислоти PO<sub>4</sub><sup>−</sup>) рухаються від катода (−) до анода (+). Відстань міграції лінійних фрагментів ДНК обернено пропорційна десятковому логарифму їхньої довжини у парах нуклеотидів: lg(bp) = <i>a</i> − <i>b</i> · <i>R<sub>f</sub></i>. У неденатурованому препараті плазміди <code>pBR322</code> візуалізуються три топологічні ізоформи (при фарбуванні інтеркалюючим барвником <b>бромистим етидієм, EtBr</b>, який світиться оранжево-червоним у променях УФ-трансілюмінатора при 312 нм):
    </p>
    <ol>
      <li><b>Суперспіралізована кільцева ДНК (<code>cccDNA</code>, Форма I)</b> — компактна скручена молекула, зазнає найменшого опору пор агарозного гелю і рухається <b>найшвидше</b> (попереду лінійної форми);</li>
      <li><b>Лінійна ДНК (<code>linDNA</code>, Форма III, 4361 п.н.)</b> — утворюється при дволанцюговому розрізанні плазміди унікальною рестриктазою (наприклад, <code>EcoRI</code> або <code>BamHI</code>) і рухається з середньою швидкістю строго відповідно до своєї молекулярної маси;</li>
      <li><b>Релаксована відкрита кільцева ДНК (<code>ocDNA</code>, Форма II)</b> — містить одноланцюговий розрив («нік»), розкручується у велике некомпактне кільце і рухається <b>найповільніше</b> (ближче до лунки старту).</li>
    </ol>

    <details class="bproto">
      <summary>Хід роботи (Лабораторні роботи № 41–44 — Корончасті гали моркви та трансформація листкових дисків тютюну)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Індукція корончастих галів на дисках моркви (ЛР 41–42):</b> коренеплід <i>Daucus carota</i> L. миють, занурюють у 70 % етанол і стерилізують 15 хв у 5–7 % гіпохлориті натрію, тричі промивають стерильною водою. Стерильним скальпелем нарізають поперечні диски завтовшки 5 мм із камбіальним кільцем, розкладають у чашки Петрі на <b>безгормональне середовище МС</b> (апікальною або базальною стороною догори) і наносять у центр камбію по 20–30 мкл нічної суспензії вірулентного штаму <i>A. tumefaciens</i> (10<sup>8</sup> кл/мл). Через 2–3 тижні при +25 °C обліковують масу гормононезалежних пухлин.</li>
          <li><b>Трансформація листкових дисків тютюну (ЛР 43–44):</b> зі стерильних рослин <i>Nicotiana tabacum</i> L. вирізають листкові експлантати (0,8 × 0,8 см), занурюють на 10–15 хв у суспензію агробактерій із обеззброєним вектором (ген <code>nptII</code>), підсушують на стерильному фільтрі й кокультивують 48 год у темряві на середовищі R (МС + 1 мг/л БАП + 0,1 мг/л НОК).</li>
          <li><b>Селекція трансформантів і елімінація бактерій:</b> експлантати переносять на селективне середовище R<sub>1</sub> (МС + 1 мг/л БАП + 0,1 мг/л НОК + <b>50–100 мг/л канаміцину</b> + <b>500 мг/л клафорану/цефотаксиму</b>). Нетрансформовані контрольні диски біліють і гинуть, а на трансгенних дисках через 3–4 тижні формуються зелені пагони, які вкорінюють на середовищі R<sub>2</sub> (МС без гормонів + 100 мг/л канаміцину).</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи (Лабораторні роботи № 45–48 — Культивування E. coli, ампліфікація pBR322 та лужний лізис)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Нарощування та хлорамфеніколова ампліфікація (ЛР 45–46):</b> клітини <i>E. coli</i> зі штамом-носієм плазміди <code>pBR322</code> висівають у середовище LB з ампіциліном (50 мкг/мл) і тетрацикліном (15 мкг/мл) та вирощують на шейкері при +37 °C до оптичної густини <i>D</i><sub>600</sub> = 0,6–0,8. Вносять спиртовий розчин <b>хлорамфеніколу до кінцевої концентрації 170 мкг/мл</b> і продовжують інкубацію ще 12–16 год при інтенсивній аерації.</li>
          <li><b>Отримання сферопластів (ЛР 47–48):</b> 1,5 мл бактеріальної суспензії осаджують у мікроцентрифузі (10 000 об/хв, 1 хв), осад ресуспендують у 100 мкл охолодженого <b>Розчину I</b> (50 мМ глюкоза, 25 мМ Трис-HCl pH 8,0, 10 мМ ЕДТА) із свіжоприготованим лізоцимом (4–5 мг/мл) та витримують 5 хв при кімнатній температурі.</li>
          <li><b>Лужна денатурація та ренатурація:</b> додають 200 мкл <b>Розчину II</b> (0,2 н. NaOH + 1 % ДСН), обережно перевертають пробірку 4–5 разів (не струшувати на вортексі, щоб не подрібнити хромосомну ДНК!) і тримають на льоду рівно 5 хв до просвітлення в’язкого лізату. Вносять 150 мкл крижаного <b>Розчину III</b> (3 М CH<sub>3</sub>COOK, pH 4,8), перемішують, витримують 5 хв на льоду і центрифугують 10 хв при 12 000 об/хв.</li>
          <li><b>Осадження плазміди:</b> прозорий супернатант переносять у чисту пробірку, додають 2 об’єми 96 % етанолу (або 0,6 об’єму ізопропанолу), витримують при −20 °C 15 хв, центрифугують, промивають осад ДНК 70 % етанолом, підсушують і розчиняють у 30–50 мкл буфера ТЕ з РНКазою А (20 мкг/мл).</li>
        </ol>
      </div>
    </details>

    <details class="bproto">
      <summary>Хід роботи (Лабораторні роботи № 49–50 — Електрофорез в агарозному гелі та спектрофотометрія ДНК/РНК)</summary>
      <div>
        <ol class="bsteps">
          <li><b>Горизонтальний електрофорез (ЛР 49):</b> наважку агарози (0,8 г на 100 мл 1× буфера TBE або TAE) розплавляють на водяній бані до прозорості, охолоджують до +55 °C, додають бромистий етидій до 0,5 мкг/мл і заливають у форму з гребінцем. Після полімеризації гель переносять у камеру, зразки ДНК змішують у співвідношенні 5:1 із буфером нанесення (0,25 % бромфеноловий синій + 30 % гліцерин або сахароза), вносять у лунки поблизу катода (−) і проводять розділення при напрузі 4–5 В/см протягом 45–60 хв. Положення смуг фотографують на УФ-трансілюмінаторі (λ = 312 нм).</li>
          <li><b>УФ-спектрофотометрія (ЛР 50):</b> аліквоту препарату ДНК або РНК розводять у кварцовій кюветі (<i>l</i> = 10 мм) буфером ТЕ у <i>K</i> = 20…100 разів. Калібрують спектрофотометр за чистим буфером ТЕ (<i>D</i> = 0), вимірюють оптичну густину розчину при λ = 260 нм та λ = 280 нм, обчислюють концентрацію за формулою <i>C</i><sub>ДНК</sub> = <i>D</i><sub>260</sub> · 50 · <i>K</i> та оцінюють чистоту за відношенням <i>R</i> = <i>D</i><sub>260</sub> / <i>D</i><sub>280</sub>.</li>
        </ol>
      </div>
    </details>
  `,

  qa: [
    [
      "Чому тканини корончастого гала моркви (ЛР 41–42) здатні рости in vitro на середовищі МС без додавання ауксинів і цитокінінів?",
      "<p>Під час інфікування вірулентним штамом <i>Agrobacterium tumefaciens</i> у ядерний геном рослинних клітин інтегрується Т-ДНК дикої Ti-плазміди, яка містить бактеріальні гени біосинтезу ауксину індоліл-3-оцтової кислоти (<code>iaaM</code> та <code>iaaH</code>) і цитокініну ізопентеніладеніну (<code>ipt</code>) під контролем еукаріотичних промоторів. Тому трансформовані клітини гала стають <b>прототрофними (автономними) щодо фітогормонів</b> і необмежено діляться на безгормональному середовищі.</p>"
    ],
    [
      "Для чого до селективного середовища при трансформації листкових дисків тютюну (ЛР 43–44) одночасно додають два антибіотики — канаміцин і клафоран (цефотаксим)?",
      "<p>Ці антибіотики виконують протилежні, але взаємодоповнювальні функції після завершення 48-годинної кокультивації: <b>клафоран (цефотаксим, 250–500 мг/л)</b> — цефалоспориновий антибіотик, який блокує синтез клітинної стінки прокаріотів і повністю <b>знищує клітини <i>Agrobacterium tumefaciens</i></b>, не шкодячи рослинним тканинам; а <b>канаміцин (50–100 мг/л)</b> є селективним агентом для рослинних клітин — він викликає фотознебарвлення і загибель нетрансформованих клітин, дозволяючи регенерувати пагони лише тим клітинам, що отримали маркерний ген <code>nptII</code> у складі Т-ДНК.</p>"
    ],
    [
      "Чому додавання хлорамфеніколу в культуру E. coli (ЛР 46) зупиняє реплікацію бактеріальної хромосоми, але прискорює накопичення плазміди pBR322?",
      "<p>Хлорамфенікол блокує пептидилтрансферазний центр 50S субодиниці рибосом і припиняє синтез білків <i>de novo</i>. Оскільки кожен акт ініціації реплікації хромосоми <i>E. coli</i> в точці <i>oriC</i> вимагає новосинтезованого білка DnaA, реплікація хромосомної ДНК зупиняється. Натомість реплікон типу <code>ColE1</code> плазміди <code>pBR322</code> використовує лише праймерну РНК II та довгоживучі ферменти клітини (ДНК-полімеразу І), тому плазміда продовжує ділитися до 1000–3000 копій на клітину.</p>"
    ],
    [
      "Яке фізико-хімічне явище лежить в основі розділення плазмідної та хромосомної ДНК під час лужного лізису за Бірнбоймом—Долі (ЛР 47–48)?",
      "<p>У вузькому інтервалі <b>pH 12,0–12,5</b> (Розчин II: 0,2 н. NaOH + 1 % ДСН) руйнуються водневі зв’язки між комплементарними парами основ. Лінійні фрагменти високомолекулярної хромосомної ДНК повністю розплітаються на окремі нитки, і після різкої нейтралізації кислим ацетатом калію (Розчин III, pH 4,8) вони агрегують у нерозчинний клубок разом із осадом додецилсульфату калію (KDS) і білками. Натомість у ковалентно замкненій кільцевій плазміді (<code>cccDNA</code>) обидва ланцюги топологічно зчеплені, тому при нейтралізації вона миттєво відновлює нативну дволанцюгову структуру й залишається в розчині.</p>"
    ],
    [
      "Про що свідчить відношення D₂₆₀ / D₂₈₀ = 1,45 у виділеному препараті плазмідної ДНК і як це виправити (ЛР 50)?",
      "<p>Для чистої нативної ДНК відношення <i>R</i> = <i>D</i><sub>260</sub> / <i>D</i><sub>280</sub> становить <b>1,80 (1,75–1,85)</b>. Зниження <i>R</i> до 1,45 свідчить про значне <b>забруднення препарату білками</b> (які містять ароматичні амінокислоти триптофан і тирозин з піком поглинання при 280 нм) або залишками фенолу. Для очищення препарат необхідно додатково екстрагувати сумішшю фенол : хлороформ : ізоаміловий спирт (25:24:1) з наступним переосадженням ДНК етанолом.</p>"
    ],
    [
      "Чому на електрофореграмі нативної плазміди pBR322 в агарозному гелі (ЛР 49) спостерігається не одна, а дві або три смуги?",
      "<p>Молекули однієї й тієї самої плазміди (4361 п.н.) можуть перебувати у різних <b>топологічних конформаціях</b>, які мають різний гідродинамічний радіус у порах гелю: найшвидше до анода рухається компактна <b>суперспіралізована форма (<code>cccDNA</code>, Форма I)</b>; повільніше — <b>лінійна форма (<code>linDNA</code>, Форма III)</b>, якщо стався дволанцюговий розрив; і найповільніше — розкручена <b>релаксована кільцева форма з одноланцюговим розривом (<code>ocDNA</code>, Форма II)</b>, а також димери плазміди.</p>"
    ]
  ],

  build({ stageBox, ctrls, below, tabsBox }) {
    const modes = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. Agrobacterium-трансформація та корончасті гали (ЛР 41–44)"],
      ["b", "Б. Ампліфікація плазміди pBR322 та лужний лізис (ЛР 45–48)"],
      ["c", "В. Спектрофотометрія ДНК/РНК (260/280 нм) та електрофорез (ЛР 49–50)"]
    ]);

    /* ==================== TAB A: AGROBACTERIUM TRANSFORMATION ==================== */
    const boxA = modes.box("a");
    const stA = new Stage(boxA.st, { aspect: 1.68, minH: 310, maxH: 480, minW: 580, tag: "ЛР 41–44 · Agrobacterium tumefaciens: Т-ДНК (RB→LB), корончасті гали моркви та nptII-селекція тютюну" });

    const stateA = {
      vec: "disarmed", // "wild" (ЛР 41-42: дика Ti-плазміда, гали моркви) | "disarmed" (ЛР 43-44: обеззброєний вектор nptII, диски тютюну)
      aceto: 100,      // мкМ ацетосирингону / фенолів поранення (0 - 200)
      kan: 75,         // мг/л канаміцину (0 - 250)
      cefo: 400        // мг/л клафорану / цефотаксиму (0 - 600)
    };

    UI.seg(boxA.ct, {
      label: "Система трансформації та тип плазмідного вектора",
      options: [
        ["wild", "ЛР 41–42: Дика Ti (гали моркви)"],
        ["disarmed", "ЛР 43–44: Вектор nptII (тютюн)"]
      ],
      value: stateA.vec,
      on: v => { stateA.vec = v; updateA(); }
    });

    const slAceto = UI.slider(boxA.ct, {
      id: "l11a-aceto", label: "Ацетосирингон / феноли поранення", min: 0, max: 200, step: 5, value: stateA.aceto, unit: "мкМ",
      fmt: v => fmt(v, 0), on: v => { stateA.aceto = v; updateA(); }
    });
    const slKan = UI.slider(boxA.ct, {
      id: "l11a-kan", label: "Селекція: канаміцин у середовищі", min: 0, max: 250, step: 5, value: stateA.kan, unit: "мг/л",
      fmt: v => fmt(v, 0), on: v => { stateA.kan = v; updateA(); }
    });
    const slCefo = UI.slider(boxA.ct, {
      id: "l11a-cefo", label: "Елімінація бактерій: клафоран", min: 0, max: 600, step: 25, value: stateA.cefo, unit: "мг/л",
      fmt: v => fmt(v, 0), on: v => { stateA.cefo = v; updateA(); }
    });

    UI.buttons(boxA.ct, [
      {
        label: "Оптимум ЛР 43–44 (тютюн nptII)", pri: true, on: () => {
          stateA.vec = "disarmed"; slAceto.set(stateA.aceto = 100); slKan.set(stateA.kan = 75); slCefo.set(stateA.cefo = 400); updateA();
        }
      },
      {
        label: "ЛР 41–42: Корончасті гали моркви", on: () => {
          stateA.vec = "wild"; slAceto.set(stateA.aceto = 120); slKan.set(stateA.kan = 0); slCefo.set(stateA.cefo = 300); updateA();
        }
      },
      {
        label: "Без клафорану (ріст бактерій)", on: () => {
          stateA.vec = "disarmed"; slAceto.set(stateA.aceto = 100); slKan.set(stateA.kan = 75); slCefo.set(stateA.cefo = 0); updateA();
        }
      },
      {
        label: "Без канаміцину (escape-пагони)", on: () => {
          stateA.vec = "disarmed"; slAceto.set(stateA.aceto = 100); slKan.set(stateA.kan = 0); slCefo.set(stateA.cefo = 400); updateA();
        }
      }
    ]);

    const readsA = UI.reads(boxA.bl, [
      ["vir", "Експресія vir-оперона (VirA/VirG)"],
      ["tdna", "Частота переносу Т-ДНК у ядро"],
      ["wt", "Виживання нетрансформованих клітин (WT)"],
      ["trans", "Вихід трансгенних регенерантів / галів"]
    ]);
    const outA = UI.out(boxA.bl, "");
    const chartsA = h("div", { class: "charts" });
    boxA.bl.append(chartsA);
    const chKanA = UI.chart(chartsA, "Селективне вікно канаміцину: виживання nptII+ трансформантів vs дикого типу (WT)");
    const chVirA = UI.chart(chartsA, "Індукція генів вірулентності (virB/virD2/virE2) фенольним індуктором ацетосирингоном");

    function modelA(vec = stateA.vec, aceto = stateA.aceto, kan = stateA.kan, cefo = stateA.cefo) {
      // Hill activation of VirA/VirG by acetosyringone (K_d ~ 25 uM) + basal wound phenolics (equiv ~ 18 uM)
      const effPhen = aceto + 18;
      const virAct = (Math.pow(effPhen, 1.8) / (Math.pow(32, 1.8) + Math.pow(effPhen, 1.8))) * 100;

      // Bacterial overgrowth penalty if cefotaxime < 200 mg/L after cocultivation
      const agroKill = 1 / (1 + Math.exp(-(cefo - 160) / 42)); // 1 = bacteria eliminated cleanly
      const agroOvergrowth = (1 - agroKill) * 100;

      // Survival of Wild-Type (WT, non-transformed) cells vs Kanamycin (IC50 = 18 mg/L)
      const wtSurv = 100 / (1 + Math.pow(kan / 18, 2.6));
      // Survival of nptII+ transgenic cells vs Kanamycin (IC50 = 185 mg/L); wild Ti has no nptII!
      const hasNpt = vec === "disarmed";
      const trSurv = hasNpt
        ? 100 / (1 + Math.pow(kan / 185, 3.2))
        : wtSurv;

      const tdnaFreq = virAct * 0.88 * (0.25 + 0.75 * agroKill);
      const netSuccess = vec === "wild"
        ? clamp((virAct / 100) * (wtSurv / 100) * (0.35 + 0.65 * agroKill) * 95, 0, 95)
        : clamp((tdnaFreq / 100) * (trSurv / 100) * (1 - wtSurv / 140) * agroKill * 100, 0, 92);

      return { virAct, agroKill, agroOvergrowth, wtSurv, trSurv, tdnaFreq, netSuccess };
    }

    function updateA() {
      const m = modelA();
      readsA.set("vir", fmt(m.virAct, 1), "% від максимуму");
      readsA.set("tdna", fmt(m.tdnaFreq, 1), "% компетентних клітин");
      readsA.set("wt", fmt(m.wtSurv, 1), "% (чутливі клітини без nptII)");
      readsA.set("trans", fmt(m.netSuccess, 1), stateA.vec === "wild" ? "% дисків із корончастими галами" : "% чистих Kanᴿ трансгенних пагонів");

      let cls = "good", msg = "";
      if (m.agroOvergrowth > 40) {
        cls = "bad";
        msg = `<b>Бактеріальне заростання експлантатів (${fmt(m.agroOvergrowth, 0)} %):</b> концентрація клафорану (цефотаксиму) ${stateA.cefo} мг/л є недостатньою для елімінації <i>Agrobacterium tumefaciens</i> після кокультивації! Слизові колонії бактерій вкривають експлантати й викликають їх некроз. Додайте <b>250–500 мг/л клафорану</b>.`;
      } else if (stateA.vec === "wild" && stateA.kan > 25) {
        cls = "warn";
        msg = `<b>Увага (ЛР 41–42):</b> дика Ti-плазміда несе онкогени <code>iaaM/iaaH</code> та <code>ipt</code>, але не містить гена канаміцин-резистентності <code>nptII</code>! Тому додавання ${stateA.kan} мг/л канаміцину пригнічує ріст корончастих галів моркви. Для відбору галів достатньо <b>безгормонального середовища МС (0 мг/л канаміцину)</b>.`;
      } else if (stateA.vec === "disarmed" && stateA.kan < 35) {
        cls = "warn";
        msg = `<b>Слабка селекція (${stateA.kan} мг/л канаміцину):</b> виживає ${fmt(m.wtSurv, 1)} % нетрансформованих клітин дикого типу (WT), які утворюють велику кількість «хибних» нетрансгенних пагонів (<i>escapes</i>). Підвищте канаміцин до <b>50–100 мг/л</b>.`;
      } else if (stateA.vec === "disarmed" && stateA.kan > 150) {
        cls = "warn";
        msg = `<b>Фітотоксичний надлишок канаміцину (${stateA.kan} мг/л):</b> навіть у трансгенних клітинах із геном <code>nptII</code> активність ферменту не встигає інактивувати антибіотик, і виживання падає до ${fmt(m.trSurv, 1)} %.`;
      } else {
        cls = "good";
        msg = stateA.vec === "wild"
          ? `<b>Індукція корончастих галів (ЛР 41–42):</b> інтеграція дикої Т-ДНК забезпечує синтез власних ауксинів (<code>iaaM/iaaH</code>), цитокінінів (<code>ipt</code>) та опінів — на камбіальному кільці моркви формуються гормононезалежні пухлини (${fmt(m.netSuccess, 1)} %) на середовищі МС без фітогормонів.`
          : `<b>Оптимальний режим трансформації тютюну (ЛР 43–44):</b> клафоран (${stateA.cefo} мг/л) повністю елімінує агробактерії, а канаміцин (${stateA.kan} мг/л) знебарвлює нетрансформовані тканини (виживання WT лише ${fmt(m.wtSurv, 1)} %), забезпечуючи регенерацію <b>${fmt(m.netSuccess, 1)} % зелених трансгенних пагонів <i>nptII⁺</i></b>.`;
      }
      outA.el.className = "bout " + cls;
      outA.set(msg);

      drawChartsA();
      stA.dirty = true;
    }

    function drawChartsA() {
      const T = Theme.c;
      const ptsWT = [], ptsNpt = [], ptsWindow = [];
      for (let k = 0; k <= 250; k += 5) {
        const md = modelA("disarmed", stateA.aceto, k, stateA.cefo);
        ptsWT.push([k, md.wtSurv]);
        ptsNpt.push([k, md.trSurv]);
        ptsWindow.push([k, Math.max(0, md.trSurv - md.wtSurv)]);
      }
      const curM = modelA();

      drawChart(chKanA, {
        x: [0, 250], y: [0, 105],
        xl: "Концентрація канаміцину C_Kan (мг/л)", yl: "Виживання експлантатів (%)",
        band: [{ x0: 50, x1: 100, color: rgba(T.good, 0.13) }],
        vl: [{ x: stateA.kan, color: T.carot, dash: [3, 3], label: `${stateA.kan} мг/л` }],
        series: [
          { pts: ptsNpt, color: T.chl, w: 2.5, fill: rgba(T.chl, 0.10) },
          { pts: ptsWT, color: T.bad, w: 2.1 },
          { pts: ptsWindow, color: T.data, w: 1.6, dash: [4, 4] }
        ],
        marks: [
          { x: stateA.kan, y: curM.trSurv, r: 5, color: T.chl, label: `${fmt(curM.trSurv, 0)} %` },
          { x: stateA.kan, y: curM.wtSurv, r: 4.5, color: T.bad }
        ],
        legend: [
          { color: T.chl, label: "Трансформанти nptII⁺ (Kanᴿ)" },
          { color: T.bad, label: "Нетрансформовані клітини (WT)" },
          { color: T.data, label: "Диференційна селективність" }
        ]
      });

      const ptsVir = [];
      for (let a = 0; a <= 200; a += 5) {
        ptsVir.push([a, modelA(stateA.vec, a, stateA.kan, stateA.cefo).virAct]);
      }
      drawChart(chVirA, {
        x: [0, 200], y: [0, 105],
        xl: "Концентрація ацетосирингону (мкМ)", yl: "Активність vir-оперона (%)",
        series: [
          { pts: ptsVir, color: T.antho, w: 2.5, fill: rgba(T.antho, 0.11) }
        ],
        marks: [
          { x: stateA.aceto, y: curM.virAct, r: 5.5, color: T.antho, label: `${fmt(curM.virAct, 1)} %` }
        ],
        legend: [
          { color: T.antho, label: "Фосфорилювання VirA → VirG-P (pH 5,5)" }
        ]
      });
    }

    function drawStageA(dt, t) {
      const c = stA.ctx, W = stA.W, H = stA.H, T = Theme.c;
      stA.clear();
      const m = modelA();
      const pad = 10, leftW = W * 0.54;

      // Left Card: Molecular mechanism of T-DNA transfer from A. tumefaciens to Plant Nucleus
      Gfx.rr(c, pad, pad, leftW - pad * 1.5, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();
      Gfx.text(c, "1. Перенесення Т-ДНК з A. tumefaciens у рослинну клітину", pad + 12, pad + 18, { weight: 700, size: 12, color: T.ink });

      // Agrobacterium rod on the left
      const ax = pad + (leftW - pad) * 0.25, ay = H * 0.46;
      Gfx.rr(c, ax - 54, ay - 34, 108, 68, 34);
      c.fillStyle = Theme.dark ? "#2E2538" : "#F3E8F6";
      c.fill(); c.strokeStyle = T.antho; c.lineWidth = 2.2; c.stroke();
      Gfx.text(c, "A. tumefaciens", ax, ay - 42, { align: "center", size: 10.5, weight: 700, color: T.antho });

      // Ti-plasmid circle inside bacterium
      c.beginPath(); c.arc(ax, ay, 22, 0, Math.PI * 2);
      c.strokeStyle = rgba(T.antho, 0.55); c.lineWidth = 3; c.stroke();
      // T-DNA arc on Ti-plasmid (top right arc)
      c.beginPath(); c.arc(ax, ay, 22, -0.9, 0.9);
      c.strokeStyle = T.chl; c.lineWidth = 5; c.stroke();
      Gfx.text(c, "Ti", ax, ay + 4, { align: "center", size: 10, weight: 700, font: "mono", color: T.ink });

      // Plant cell with nucleus on the right of Left Card
      const px = pad + (leftW - pad) * 0.74, py = H * 0.46;
      Gfx.rr(c, px - 62, py - 58, 124, 116, 16);
      c.fillStyle = Theme.dark ? "#1B2E22" : "#E6F2EA";
      c.fill(); c.strokeStyle = "#3E8456"; c.lineWidth = 3; c.stroke();
      // Plant nucleus
      Gfx.sphere(c, px + 8, py, 34, Theme.dark ? "#284734" : "#CBE3D3", { ring: T.chl, rw: 2 });
      Gfx.text(c, "Ядро рослини", px + 8, py - 20, { align: "center", size: 9.5, weight: 600, color: T.ink });

      // Integrated T-DNA cassette inside plant chromosome
      c.strokeStyle = T.ink; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(px - 18, py + 4); c.lineTo(px + 34, py + 4); c.stroke();
      c.strokeStyle = T.carot; c.lineWidth = 5;
      c.beginPath(); c.moveTo(px - 6, py + 4); c.lineTo(px + 22, py + 4); c.stroke();
      Gfx.text(c, stateA.vec === "wild" ? "iaaM · ipt · ocs" : "Pnos · nptII · ген", px + 8, py + 19, { align: "center", size: 9.5, font: "mono", weight: 700, color: T.carot });

      // Type IV secretion pilus bridge + animated VirD2-T-strand + VirE2 complex
      c.fillStyle = rgba(T.antho, 0.22);
      c.fillRect(ax + 52, ay - 6, px - 62 - (ax + 52), 12);
      const prog = (t * 0.55) % 1;
      const tx = lerp(ax + 24, px - 4, prog);
      c.strokeStyle = T.chl; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(tx - 16, ay); c.lineTo(tx, ay); c.stroke();
      Gfx.sphere(c, tx, ay, 4.5, T.carot); // VirD2 pilot protein at 5' RB end
      Gfx.text(c, "VirD2–Т-нитка", (ax + px) / 2, ay - 14, { align: "center", size: 9.5, font: "mono", color: T.chl });

      // Acetosyringone phenolic signal molecules
      for (let i = 0; i < 4; i++) {
        const fx = lerp(px - 62, ax + 50, ((t * 0.4 + i * 0.25) % 1));
        const fy = ay + 24 + Math.sin(t * 3 + i) * 5;
        Gfx.sphere(c, fx, fy, 3.2, "#D97706");
      }
      Gfx.text(c, `Ацетосирингон (${stateA.aceto} мкМ) → VirA/VirG (${fmt(m.virAct, 0)} %)`, pad + (leftW - pad) * 0.5, H - 30, { align: "center", size: 10.5, color: T.muted });

      // T-DNA map bar at bottom of Left Card
      const by = H - 64, bx0 = pad + 20, bw = leftW - pad * 1.5 - 40;
      Gfx.rr(c, bx0, by - 10, bw, 20, 5);
      c.fillStyle = T.paper; c.fill(); c.strokeStyle = T.rule; c.stroke();
      Gfx.chip(c, "LB", bx0 + 18, by, { align: "center", size: 9.5, bg: T.antho, fg: "#fff" });
      Gfx.chip(c, "RB", bx0 + bw - 18, by, { align: "center", size: 9.5, bg: T.antho, fg: "#fff" });
      Gfx.text(c, stateA.vec === "wild"
        ? "Дика Т-ДНК: [ iaaM / iaaH (ІОК) ] + [ ipt (цитокінін) ] + [ синтаза опінів ]"
        : "Обеззброєна Т-ДНК: [ Pnos → nptII (Kanᴿ) → Tnos ] + [ цільовий ген ]",
        bx0 + bw / 2, by, { align: "center", size: 9.5, font: "mono", weight: 600, color: T.ink });

      // Right Card: Petri dish bioassay (Carrot disc crown galls OR Tobacco leaf discs on Kan + Cefo)
      const rx0 = leftW + pad * 0.5, rw = W - leftW - pad * 1.5;
      Gfx.rr(c, rx0, pad, rw, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();
      Gfx.text(c, stateA.vec === "wild" ? "2. Корончасті гали моркви (ЛР 41–42)" : "2. Селекція дисків тютюну на Kan + Клафоран (ЛР 43–44)", rx0 + 12, pad + 18, { weight: 700, size: 12, color: T.ink });

      const pcx = rx0 + rw * 0.5, pcy = H * 0.48, pr = Math.min(82, Math.min(rw * 0.39, H * 0.32));
      Gfx.petri(c, pcx, pcy, pr, Theme.dark ? "rgba(62,88,70,.55)" : "rgba(224,237,216,.9)", {
        label: stateA.vec === "wild"
          ? `Середовище МС без гормонів · Kan ${stateA.kan} мг/л`
          : `Середовище R₁: Kan ${stateA.kan} мг/л + Клафоран ${stateA.cefo} мг/л`,
        inside: (ctx) => {
          // Bacterial slime halo if cefotaxime is too low
          if (m.agroOvergrowth > 25) {
            Gfx.glow(ctx, pcx, pcy, pr * 0.88, "#D4C685", clamp(m.agroOvergrowth / 130, 0.15, 0.65));
          }
          if (stateA.vec === "wild") {
            // Orange carrot root disc with cambial ring and growing crown gall tumors
            Gfx.sphere(ctx, pcx, pcy, pr * 0.62, "#E06D2B", { ring: "#B54E16", rw: 2 });
            ctx.strokeStyle = "#F5B87A"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(pcx, pcy, pr * 0.38, 0, Math.PI * 2); ctx.stroke(); // cambial ring
            const nGalls = Math.round((m.netSuccess / 100) * 10);
            for (let g = 0; g < nGalls; g++) {
              const ga = (g / 10) * Math.PI * 2 + 0.2;
              const gx = pcx + Math.cos(ga) * pr * 0.38, gy = pcy + Math.sin(ga) * pr * 0.38;
              const gr = 5.5 + 2.5 * Math.sin(t * 2 + g);
              Gfx.sphere(ctx, gx, gy, gr, "#C5D97E", { ring: "#648232" });
            }
          } else {
            // 5 Tobacco leaf discs: 4 transformed (green with KanR shoot buds) + 1 WT control disc at center (bleaches on Kan!)
            const pos = [[-0.42, -0.36, true], [0.42, -0.36, true], [-0.42, 0.36, true], [0.42, 0.36, true], [0, 0, false]];
            for (let i = 0; i < pos.length; i++) {
              const [dx, dy, isTr] = pos[i];
              const lx = pcx + dx * pr, ly = pcy + dy * pr;
              const surv = isTr ? m.trSurv / 100 : m.wtSurv / 100;
              const discCol = mixc("#EDE8D0", "#2E854B", surv);
              ctx.save(); ctx.translate(lx, ly);
              Gfx.rr(ctx, -14, -11, 28, 22, 5);
              ctx.fillStyle = discCol; ctx.fill();
              ctx.strokeStyle = shade(discCol, -0.3); ctx.lineWidth = 1.2; ctx.stroke();
              // Regenerating green transgenic shoot buds on periphery
              if (surv > 0.45) {
                for (let b = 0; b < 3; b++) {
                  const ba = b * 2.1 + i;
                  Gfx.sphere(ctx, Math.cos(ba) * 12, Math.sin(ba) * 9, 4.2, "#52B76E", { ring: "#1E5E32" });
                }
              }
              ctx.restore();
            }
          }
        }
      });

      Gfx.text(c, stateA.vec === "wild"
        ? "Пухлинні гали формуються уздовж камбіального кільця моркви"
        : "У центрі — контрольний диск WT (біліє на канаміцині), по краях — диски nptII⁺",
        pcx, H - 18, { align: "center", size: 10, color: T.muted });
    }

    /* ==================== TAB B: PLASMID pBR322 AMPLIFICATION & ALKALINE LYSIS ==================== */
    const boxB = modes.box("b");
    const stB = new Stage(boxB.st, { aspect: 1.68, minH: 310, maxH: 480, minW: 580, tag: "ЛР 45–48 · Плазміда pBR322 (4361 п.н., ApᴿTcᴿ): хлорамфеніколова ампліфікація та лужний лізис" });

    const stateB = {
      cmAdd: 1,       // 1 = хлорамфенікол 170 мкг/мл внесено при D600 = 0,6; 0 = без хлорамфеніколу
      alkPh: 12.2,    // pH Розчину II (10,5 - 13,2; оптимум 12,0 - 12,5)
      lysisMin: 4.5,  // тривалість лужної обробки (хв, оптимум 3-5 хв)
      rnase: 1        // обробка РНКазою А
    };

    UI.seg(boxB.ct, {
      label: "Режим культивування E. coli (ЛР 45–46)",
      options: [
        ["1", "З хлорамфеніколом (170 мкг/мл)"],
        ["0", "Без хлорамфеніколу (контроль)"]
      ],
      value: String(stateB.cmAdd),
      on: v => { stateB.cmAdd = +v; updateB(); }
    });

    const slPhB = UI.slider(boxB.ct, {
      id: "l11b-ph", label: "pH лужного Розчину II (NaOH + ДСН)", min: 10.5, max: 13.2, step: 0.1, value: stateB.alkPh, unit: "од. pH",
      fmt: v => fmt(v, 1), on: v => { stateB.alkPh = v; updateB(); }
    });
    const slTimeB = UI.slider(boxB.ct, {
      id: "l11b-time", label: "Експозиція з Розчином II", min: 1.0, max: 15.0, step: 0.5, value: stateB.lysisMin, unit: "хв",
      fmt: v => fmt(v, 1), on: v => { stateB.lysisMin = v; updateB(); }
    });

    UI.buttons(boxB.ct, [
      {
        label: "Еталон Бірнбойма—Долі (pH 12,2; 4,5 хв)", pri: true, on: () => {
          stateB.cmAdd = 1; slPhB.set(stateB.alkPh = 12.2); slTimeB.set(stateB.lysisMin = 4.5); updateB();
        }
      },
      {
        label: "Перелуження (pH 13,0; 12 хв)", on: () => {
          stateB.cmAdd = 1; slPhB.set(stateB.alkPh = 13.0); slTimeB.set(stateB.lysisMin = 12.0); updateB();
        }
      },
      {
        label: "Недолуження (pH 11,0) — хромосомна ДНК", on: () => {
          stateB.cmAdd = 1; slPhB.set(stateB.alkPh = 11.0); slTimeB.set(stateB.lysisMin = 3.0); updateB();
        }
      }
    ]);

    const readsB = UI.reads(boxB.bl, [
      ["copies", "Копійність плазміди pBR322"],
      ["ccc", "Вихід нативної суперспіральної cccDNA"],
      ["chr", "Залишкова хромосомна ДНК у супернатанті"],
      ["denat", "Незворотно денатурована плазміда (Форма IV)"]
    ]);
    const outB = UI.out(boxB.bl, "");
    const chartsB = h("div", { class: "charts" });
    boxB.bl.append(chartsB);
    const chAmpB = UI.chart(chartsB, "Кінетика ампліфікації копійності pBR322 після внесення хлорамфеніколу (ЛР 46)");
    const chPhB = UI.chart(chartsB, "Вікно pH лужного лізису (ЛР 47–48): денатурація хромосомної vs плазмідної ДНК");

    function modelB(cm = stateB.cmAdd, ph = stateB.alkPh, tMin = stateB.lysisMin) {
      const copies = cm ? 2200 : 32; // копій на клітину після 16 год
      // Chromosomal DNA denaturation efficiency (needs pH >= 11.8)
      const chrDenat = 1 / (1 + Math.exp(-(ph - 11.65) / 0.18));
      const chrContam = (1 - chrDenat) * 100; // % chromosomal DNA remaining double-stranded in supernatant

      // Irreversible denaturation of supercoiled cccDNA into collapsed Form IV if pH > 12.6 or time > 7 min
      const timeStress = Math.max(0, (tMin - 5.5) * 0.055);
      const cccDenat = 1 / (1 + Math.exp(-(ph + timeStress - 12.68) / 0.14));
      const intactCcc = clamp(chrDenat * (1 - cccDenat) * 100, 0, 98);
      const yieldUgPerMl = (copies / 2200) * (intactCcc / 100) * 4.8; // мкг плазміди з 1 мл культури

      return { copies, chrDenat: chrDenat * 100, chrContam, cccDenat: cccDenat * 100, intactCcc, yieldUgPerMl };
    }

    function updateB() {
      const m = modelB();
      readsB.set("copies", fmt(m.copies, 0), "копій/клітину (pBR322, 4361 п.н.)");
      readsB.set("ccc", `${fmt(m.intactCcc, 1)} %`, ` (${fmt(m.yieldUgPerMl, 2)} мкг/мл культури)`);
      readsB.set("chr", fmt(m.chrContam, 1), "% (лінійна високомолекулярна ДНК)");
      readsB.set("denat", fmt(m.cccDenat, 1), "% (коагульована одноланцюгова форма IV)");

      let cls = "good", msg = "";
      if (stateB.alkPh < 11.8) {
        cls = "bad";
        msg = `<b>Недостатня лужність Розчину II (pH ${fmt(stateB.alkPh, 1)}):</b> водневі зв’язки хромосомної ДНК <i>E. coli</i> не руйнуються повністю, тому після внесення Розчину III хромосомна ДНК не випадає в осад із KDS, забруднюючи супернатант (${fmt(m.chrContam, 1)} %). Оптимум становить <b>pH 12,0–12,5</b>.`;
      } else if (m.cccDenat > 25) {
        cls = "bad";
        msg = `<b>Перелуження лізату (pH ${fmt(stateB.alkPh, 1)}, експозиція ${fmt(stateB.lysisMin, 1)} хв):</b> руйнуються всі водневі зв’язки навіть у кільцевій плазміді <code>pBR322</code>, і ${fmt(m.cccDenat, 1)} % молекул незворотно переходять у дефектну неренатуровану «Форму IV». Не перевищуйте <b>pH 12,5 та 5 хв</b> на льоду!`;
      } else if (!stateB.cmAdd) {
        cls = "warn";
        msg = `<b>Культивування без хлорамфеніколової ампліфікації:</b> чистота плазміди висока (${fmt(m.intactCcc, 1)} %), але копійність становить лише ${m.copies} копій/клітину (вихід ${fmt(m.yieldUgPerMl, 2)} мкг/мл). Додавання хлорамфеніколу при <i>D</i><sub>600</sub> = 0,6 підвищує вихід у ~70 разів!`;
      } else {
        cls = "good";
        msg = `<b>Класичний протокол ЛР 45–48:</b> хлорамфеніколова ампліфікація підвищила копійність <code>pBR322</code> до <b>${m.copies} копій/клітину</b>, а лужний лізис при pH ${fmt(stateB.alkPh, 1)} за ${fmt(stateB.lysisMin, 1)} хв кількісно осадив хромосомну ДНК з KDS, зберігши <b>${fmt(m.intactCcc, 1)} % нативної суперспіральної плазміди</b> (${fmt(m.yieldUgPerMl, 2)} мкг/мл).`;
      }
      outB.el.className = "bout " + cls;
      outB.set(msg);

      drawChartsB();
      stB.dirty = true;
    }

    function drawChartsB() {
      const T = Theme.c;
      const ptsCm = [], ptsNoCm = [];
      for (let h = 0; h <= 18; h += 0.5) {
        const cNo = 28 + 8 * smooth(0, 6, h);
        const cWith = h <= 3.5 ? cNo : 34 + 2166 * smooth(3.5, 16, h);
        ptsNoCm.push([h, cNo]);
        ptsCm.push([h, cWith]);
      }
      drawChart(chAmpB, {
        x: [0, 18], y: [0, 2400],
        xl: "Час культивування E. coli (год)", yl: "Копій pBR322 на 1 клітину",
        vl: [{ x: 3.5, color: T.carot, dash: [3, 3], label: "Внесення хлорамфеніколу (D₆₀₀=0,6)" }],
        series: [
          { pts: ptsCm, color: T.chl, w: 2.5, fill: rgba(T.chl, 0.12) },
          { pts: ptsNoCm, color: T.muted, w: 2, dash: [5, 4] }
        ],
        legend: [
          { color: T.chl, label: "+ Хлорамфенікол 170 мкг/мл" },
          { color: T.muted, label: "Без хлорамфеніколу (~32 копії)" }
        ]
      });

      const ptsChr = [], ptsCcc = [], ptsWin = [];
      for (let p = 10.5; p <= 13.201; p += 0.04) {
        const md = modelB(stateB.cmAdd, p, stateB.lysisMin);
        ptsChr.push([p, md.chrDenat]);
        ptsCcc.push([p, md.cccDenat]);
        ptsWin.push([p, md.intactCcc]);
      }
      const curM = modelB();
      drawChart(chPhB, {
        x: [10.5, 13.2], y: [0, 105],
        xl: "pH лужного лізису (Розчин II)", yl: "Частка ДНК (%)",
        band: [{ x0: 12.0, x1: 12.5, color: rgba(T.good, 0.14) }],
        vl: [{ x: stateB.alkPh, color: T.carot, dash: [3, 3], label: `pH ${fmt(stateB.alkPh, 1)}` }],
        series: [
          { pts: ptsWin, color: T.chl, w: 2.6, fill: rgba(T.chl, 0.11) },
          { pts: ptsChr, color: T.data, w: 1.8, dash: [4, 3] },
          { pts: ptsCcc, color: T.bad, w: 2.0 }
        ],
        marks: [
          { x: stateB.alkPh, y: curM.intactCcc, r: 5.5, color: T.chl, label: `${fmt(curM.intactCcc, 0)} %` }
        ],
        legend: [
          { color: T.chl, label: "Вихід нативної cccDNA pBR322" },
          { color: T.data, label: "Денатурація хромосомної ДНК" },
          { color: T.bad, label: "Руйнування плазміди (Форма IV)" }
        ]
      });
    }

    function drawStageB(dt, t) {
      const c = stB.ctx, W = stB.W, H = stB.H, T = Theme.c;
      stB.clear();
      const m = modelB();
      const pad = 10, leftW = W * 0.48;

      // Left Card: Genetic map of plasmid pBR322 (4361 bp)
      Gfx.rr(c, pad, pad, leftW - pad * 1.5, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();
      Gfx.text(c, "1. Генетична карта плазміди pBR322 (4361 п.н.)", pad + 12, pad + 18, { weight: 700, size: 12, color: T.ink });

      const cx = pad + (leftW - pad * 1.5) * 0.5, cy = H * 0.50;
      const r = Math.min(78, Math.min((leftW - 50) * 0.36, H * 0.31));

      // Outer dsDNA ring
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
      c.strokeStyle = rgba(T.ink, 0.25); c.lineWidth = 12; c.stroke();

      // Tc^r gene arc (right side: 0.1 to 1.8 rad)
      c.beginPath(); c.arc(cx, cy, r, -0.95, 0.95);
      c.strokeStyle = T.chl; c.lineWidth = 12; c.stroke();

      // Ap^r gene arc (left side: 2.3 to 4.1 rad)
      c.beginPath(); c.arc(cx, cy, r, 2.25, 4.05);
      c.strokeStyle = T.antho; c.lineWidth = 12; c.stroke();

      // ori (ColE1) arc (bottom: 1.2 to 1.95 rad)
      c.beginPath(); c.arc(cx, cy, r, 1.25, 1.95);
      c.strokeStyle = T.data; c.lineWidth = 12; c.stroke();

      // Center labels
      Gfx.text(c, "pBR322", cx, cy - 6, { align: "center", size: 14, weight: 700, font: "mono", color: T.ink });
      Gfx.text(c, "4361 п.н.", cx, cy + 11, { align: "center", size: 11, font: "mono", color: T.muted });
      Gfx.text(c, `${m.copies} копій/кл`, cx, cy + 26, { align: "center", size: 10.5, weight: 700, color: T.chl, font: "mono" });

      // Restriction sites markers around ring
      const sites = [
        [-Math.PI / 2, "EcoRI (4361)", T.ink],
        [-0.75, "HindIII (29)", T.ink],
        [-0.25, "BamHI (375)", T.chl],
        [0.45, "SalI (651)", T.chl],
        [1.60, "ori ColE1", T.data],
        [3.15, "PstI (3609)", T.antho]
      ];
      for (const [ang, lbl, col] of sites) {
        const x1 = cx + Math.cos(ang) * (r - 8), y1 = cy + Math.sin(ang) * (r - 8);
        const x2 = cx + Math.cos(ang) * (r + 12), y2 = cy + Math.sin(ang) * (r + 12);
        c.strokeStyle = col; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        const tx = cx + Math.cos(ang) * (r + 22), ty = cy + Math.sin(ang) * (r + 20);
        Gfx.text(c, lbl, tx, ty + 3, {
          align: Math.cos(ang) > 0.2 ? "left" : Math.cos(ang) < -0.2 ? "right" : "center",
          size: 9.5, font: "mono", weight: 600, color: col
        });
      }
      Gfx.text(c, "Apᴿ (ампіцилін)", cx - r * 0.55, cy, { align: "center", size: 9.5, weight: 700, color: T.antho });
      Gfx.text(c, "Tcᴿ (тетрациклін)", cx + r * 0.52, cy, { align: "center", size: 9.5, weight: 700, color: T.chl });

      // Right Card: Birnboim-Doly Alkaline Lysis in Microcentrifuge Tube
      const rx0 = leftW + pad * 0.5, rw = W - leftW - pad * 1.5;
      Gfx.rr(c, rx0, pad, rw, H - pad * 2, 12);
      c.fillStyle = T.sheet; c.fill(); c.strokeStyle = T.rule; c.stroke();
      Gfx.text(c, "2. Лужний лізис за Бірнбоймом—Долі (ЛР 47–48)", rx0 + 12, pad + 18, { weight: 700, size: 12, color: T.ink });

      const tx = rx0 + rw * 0.34, ty = pad + 48, tw = 74, th = H - 108;
      Draw.tube(c, tx - tw / 2, ty, tw, th, [
        { frac: 0.28, color: Theme.dark ? "rgba(235,240,235,0.82)" : "rgba(235,238,230,0.95)" }, // White KDS + chromosomal DNA + protein pellet
        { frac: 0.72, color: rgba(T.chl, 0.16) } // Clear supernatant with supercoiled plasmid
      ], {
        fill: 0.76,
        label: "Епендорф після Розчину III (12 000 об/хв)",
        after: (ctx, topY) => {
          // Draw floating supercoiled figure-8 plasmids in supernatant
          const supTop = topY + 12, supBot = ty + th * 0.76;
          const nPlasm = Math.max(2, Math.round((m.intactCcc / 100) * 9));
          for (let i = 0; i < nPlasm; i++) {
            const px2 = tx - tw * 0.28 + ((i * 23) % (tw * 0.56));
            const py2 = supTop + ((i * 19 + Math.sin(t * 2 + i) * 4) % Math.max(16, supBot - supTop - 16));
            ctx.strokeStyle = T.chl; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.ellipse(px2 - 3, py2, 4, 2.5, 0.3, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(px2 + 3, py2, 4, 2.5, -0.3, 0, Math.PI * 2); ctx.stroke();
          }
          // Tangled chromosomal DNA threads in white KDS pellet at bottom
          ctx.strokeStyle = "#6B7280"; ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let k = 0; k < 14; k++) {
            const kx = tx - tw * 0.32 + hash01(k, 3) * tw * 0.64;
            const ky = ty + th * 0.78 + hash01(k, 9) * th * 0.18;
            k ? ctx.lineTo(kx, ky) : ctx.moveTo(kx, ky);
          }
          ctx.stroke();
        }
      });

      // Explanatory callouts on the right of the tube
      const lx = tx + tw * 0.5 + 16;
      Gfx.text(c, "Супернатант (надосадова рідина):", lx, ty + 38, { weight: 700, size: 11, color: T.chl });
      Gfx.text(c, `• Нативна плазміда cccDNA: ${fmt(m.intactCcc, 1)} %`, lx, ty + 55, { size: 10.5, color: T.ink });
      Gfx.text(c, `• Домішка хрДНК: ${fmt(m.chrContam, 1)} %`, lx, ty + 71, { size: 10.5, color: m.chrContam > 15 ? T.bad : T.muted });
      Gfx.text(c, `• Форма IV (перелужена): ${fmt(m.cccDenat, 1)} %`, lx, ty + 87, { size: 10.5, color: m.cccDenat > 15 ? T.bad : T.muted });

      Gfx.text(c, "Білий осад на дні (pH 4,8):", lx, ty + th - 48, { weight: 700, size: 11, color: T.ink });
      Gfx.text(c, "• Додецилсульфат калію (KDS)", lx, ty + th - 31, { size: 10.5, color: T.muted });
      Gfx.text(c, "• Денатуровані білки клітин", lx, ty + th - 16, { size: 10.5, color: T.muted });
      Gfx.text(c, "• Переплутані нитки хромосомної ДНК", lx, ty + th - 1, { size: 10.5, color: T.muted });
    }

    /* ==================== TAB C: UV SPECTROPHOTOMETRY & AGAROSE GEL (ЛР 49–50) ==================== */
    const boxC = modes.box("c");
    const stC = new Stage(boxC.st, { aspect: 1.68, minH: 320, maxH: 490, minW: 590, tag: "ЛР 49–50 · Спектрофотометрія ДНК/РНК (260/280 нм) та електрофорез у 0,8 % агарозному гелі (EtBr)" });

    const stateC = {
      naType: "dna",   // "dna" (50 мкг/мл) | "rna" (40 мкг/мл)
      d260: 0.48,      // оптична густина при 260 нм (0,05 - 1,40)
      protPct: 8,      // рівень забруднення білком/фенолом (0 - 70 %)
      dilK: 50,        // кратність розведення K (10 - 100)
      voltTime: 75     // прогрес електрофорезу (%)
    };

    UI.seg(boxC.ct, {
      label: "Тип досліджуваного препарату (ЛР 50)",
      options: [
        ["dna", "ДНК (1 о.о.г. = 50 мкг/мл)"],
        ["rna", "РНК (1 о.о.г. = 40 мкг/мл)"]
      ],
      value: stateC.naType,
      on: v => { stateC.naType = v; updateC(); }
    });

    const slD260 = UI.slider(boxC.ct, {
      id: "l11c-d260", label: "Оптична густина при 260 нм (D₂₆₀)", min: 0.05, max: 1.40, step: 0.01, value: stateC.d260, unit: "о.о.г.",
      fmt: v => fmt(v, 2), on: v => { stateC.d260 = v; updateC(); }
    });
    const slProt = UI.slider(boxC.ct, {
      id: "l11c-prot", label: "Домішка білка / фенолу (поглинання 280 нм)", min: 0, max: 70, step: 2, value: stateC.protPct, unit: "%",
      fmt: v => fmt(v, 0), on: v => { stateC.protPct = v; updateC(); }
    });
    const slDil = UI.slider(boxC.ct, {
      id: "l11c-dil", label: "Кратність розведення проби K", min: 10, max: 100, step: 5, value: stateC.dilK, unit: "разів",
      fmt: v => fmt(v, 0), on: v => { stateC.dilK = v; updateC(); }
    });
    const slGel = UI.slider(boxC.ct, {
      id: "l11c-gel", label: "Пробіг електрофорезу в 0,8 % агарозі", min: 15, max: 100, step: 5, value: stateC.voltTime, unit: "%",
      fmt: v => fmt(v, 0), on: v => { stateC.voltTime = v; updateC(); }
    });

    UI.buttons(boxC.ct, [
      {
        label: "Чиста ДНК (R = 1,80)", pri: true, on: () => {
          stateC.naType = "dna"; slD260.set(stateC.d260 = 0.52); slProt.set(stateC.protPct = 4); slDil.set(stateC.dilK = 50); updateC();
        }
      },
      {
        label: "Чиста РНК (R = 2,00)", on: () => {
          stateC.naType = "rna"; slD260.set(stateC.d260 = 0.60); slProt.set(stateC.protPct = 2); slDil.set(stateC.dilK = 50); updateC();
        }
      },
      {
        label: "Забруднення білком (R = 1,38)", on: () => {
          stateC.naType = "dna"; slD260.set(stateC.d260 = 0.55); slProt.set(stateC.protPct = 52); slDil.set(stateC.dilK = 50); updateC();
        }
      }
    ]);

    const readsC = UI.reads(boxC.bl, [
      ["d260", "Оптична густина D₂₆₀ / D₂₈₀"],
      ["ratio", "Показник чистоти R = D₂₆₀ / D₂₈₀"],
      ["conc", "Концентрація у вихідному розчині C"],
      ["verdict", "Висновок про чистоту препарату"]
    ]);
    const outC = UI.out(boxC.bl, "");
    const chartsC = h("div", { class: "charts" });
    boxC.bl.append(chartsC);
    const chUvC = UI.chart(chartsC, "УФ-спектр поглинання D(λ) у діапазоні 220–320 нм (пік 260 нм і білкове плече 280 нм)");
    const chCalC = UI.chart(chartsC, "Калібрувальний графік електрофорезу lg(bp) від відносної рухливості Rf (λ/HindIII)");

    function spectrumAt(lam, d260, protPct, naType) {
      const pureR = naType === "dna" ? 1.82 : 2.02;
      // Nucleic acid Gaussian peak at 259 nm + peptide bond rise below 225 nm
      const naPeak = d260 * (
        Math.exp(-0.5 * Math.pow((lam - 259) / 16.2, 2)) +
        0.55 * Math.exp(-0.5 * Math.pow((lam - 208) / 12.0, 2))
      );
      // Protein peak at 280 nm + strong peptide/phenol peak at 225 nm
      const pFactor = (protPct / 100) * d260 * 0.72;
      const protPeak = pFactor * (
        Math.exp(-0.5 * Math.pow((lam - 280) / 13.5, 2)) +
        1.65 * Math.exp(-0.5 * Math.pow((lam - 224) / 11.5, 2))
      );
      // Fine-tune 280 value so at protPct=0 ratio is pureR
      const corr280 = (d260 / pureR - d260 * Math.exp(-0.5 * Math.pow((280 - 259) / 16.2, 2))) * Math.exp(-0.5 * Math.pow((lam - 280) / 12, 2));
      return Math.max(0, naPeak + corr280 + protPeak);
    }

    function modelC() {
      const d260 = spectrumAt(260, stateC.d260, stateC.protPct, stateC.naType);
      const d280 = spectrumAt(280, stateC.d260, stateC.protPct, stateC.naType);
      const d230 = spectrumAt(230, stateC.d260, stateC.protPct, stateC.naType);
      const R = d260 / Math.max(1e-4, d280);
      const kExt = stateC.naType === "dna" ? 50 : 40;
      const concUgMl = d260 * kExt * stateC.dilK; // мкг/мл
      return { d260, d280, d230, R, kExt, concUgMl };
    }

    function updateC() {
      const m = modelC();
      const naLbl = stateC.naType === "dna" ? "ДНК" : "РНК";
      readsC.set("d260", `${fmt(m.d260, 3)} / ${fmt(m.d280, 3)}`, "о.о.г. (l = 10 мм)");
      readsC.set("ratio", fmt(m.R, 2), stateC.naType === "dna" ? "(норма ДНК: 1,75–1,85)" : "(норма РНК: 1,90–2,05)");
      readsC.set("conc", fmt(m.concUgMl, 1), `мкг/мл (${fmt(m.concUgMl / 1000, 3)} мг/мл)`);

      let verd = "Високоочищений препарат", cls = "good";
      if (stateC.naType === "dna" && m.R < 1.72) {
        verd = "Забруднення білками / фенолом (R < 1,75)"; cls = "bad";
      } else if (stateC.naType === "rna" && m.R < 1.85) {
        verd = "Забруднення білками (R < 1,90)"; cls = "bad";
      }
      readsC.set("verdict", verd);

      outC.el.className = "bout " + cls;
      outC.set(
        `<b>Розрахунок за формулою ЛР 50 (с. 181):</b> ` +
        `<i>C</i><sub>${naLbl}</sub> = <i>D</i><sub>260</sub> · ${m.kExt} · <i>K</i> = ${fmt(m.d260, 3)} · ${m.kExt} · ${stateC.dilK} = <b>${fmt(m.concUgMl, 1)} мкг/мл</b>. ` +
        `Відношення оптичних густин <i>R</i> = <i>D</i><sub>260</sub> / <i>D</i><sub>280</sub> = ${fmt(m.d260, 3)} / ${fmt(m.d280, 3)} = <b>${fmt(m.R, 2)}</b> ` +
        `(при λ = 230 нм <i>D</i><sub>230</sub> = ${fmt(m.d230, 3)}, <i>D</i><sub>260</sub> / <i>D</i><sub>230</sub> = ${fmt(m.d260 / Math.max(1e-4, m.d230), 2)}). ` +
        (cls === "good"
          ? `Препарат ${naLbl} відповідає критерію чистоти й придатний для рестрикції, ПЛР та клонування.`
          : `Підвищене поглинання при 280 нм свідчить про присутність ароматичних амінокислот білка або фенолу — необхідна депротеїнізація хлороформом.`)
      );

      drawChartsC();
      stC.dirty = true;
    }

    function drawChartsC() {
      const T = Theme.c;
      const m = modelC();
      const ptsCur = [], ptsPure = [];
      for (let l = 220; l <= 320; l += 2) {
        ptsCur.push([l, spectrumAt(l, stateC.d260, stateC.protPct, stateC.naType)]);
        ptsPure.push([l, spectrumAt(l, stateC.d260, 0, stateC.naType)]);
      }

      drawChart(chUvC, {
        x: [220, 320], y: [0, Math.max(1.2, m.d260 * 1.45)],
        xl: "Довжина хвилі λ (нм)", yl: "Оптична густина D",
        vl: [
          { x: 260, color: T.chl, dash: [3, 3], label: "260 нм (ДНК/РНК)" },
          { x: 280, color: T.antho, dash: [3, 3], label: "280 нм (білки)" }
        ],
        series: [
          { pts: ptsCur, color: T.chl, w: 2.5, fill: rgba(T.chl, 0.12) },
          { pts: ptsPure, color: T.muted, w: 1.7, dash: [5, 4] }
        ],
        marks: [
          { x: 260, y: m.d260, r: 5, color: T.chl, label: `D₂₆₀=${fmt(m.d260, 2)}` },
          { x: 280, y: m.d280, r: 5, color: T.antho, label: `D₂₈₀=${fmt(m.d280, 2)}` }
        ],
        legend: [
          { color: T.chl, label: `Досліджуваний зразок (R = ${fmt(m.R, 2)})` },
          { color: T.muted, label: "Еталон без білкових домішок" }
        ]
      });

      // Calibration curve of Lambda/HindIII marker: lg(bp) vs Rf
      const ladderBp = [23130, 9416, 6557, 4361, 2322, 2027, 564];
      const rfOfBp = (bp) => clamp((4.48 - Math.log10(bp)) / 1.95, 0.08, 0.94);
      const ptsLine = [[0.08, 4.48 - 1.95 * 0.08], [0.92, 4.48 - 1.95 * 0.92]];
      const marksLad = ladderBp.map(bp => ({
        x: rfOfBp(bp),
        y: Math.log10(bp),
        r: bp === 4361 ? 5.8 : 4.2,
        color: bp === 4361 ? T.carot : T.data,
        label: bp === 4361 ? "pBR322 lin (4361 п.н.)" : `${bp}`
      }));

      drawChart(chCalC, {
        x: [0, 1.0], y: [2.5, 4.5],
        xl: "Відносна електрофоретична рухливість Rf", yl: "lg(довжини фрагмента, п.н.)",
        series: [
          { pts: ptsLine, color: T.data, w: 2.2 }
        ],
        marks: marksLad,
        legend: [
          { color: T.data, label: "Маркер λ / HindIII (564–23130 п.н.)" },
          { color: T.carot, label: "Лінійна плазміда pBR322 (4361 п.н.)" }
        ]
      });
    }

    function drawStageC(dt, t) {
      const c = stC.ctx, W = stC.W, H = stC.H, T = Theme.c;
      stC.clear();
      const m = modelC();
      const pad = 10, leftW = W * 0.43;

      // Left: UV Spectrophotometer (260 / 280 nm quartz cuvette)
      Gfx.spectro(c, pad, pad, leftW - pad * 1.5, H - pad * 2, {
        lam: 260,
        A: m.d260,
        text: `D260=${fmt(m.d260, 2)} · R=${fmt(m.R, 2)}`,
        col: "rgba(210, 232, 248, 0.65)",
        sub: `Кварцова кювета 10 мм · C = ${fmt(m.concUgMl, 0)} мкг/мл (K=${stateC.dilK})`
      });

      // Right: Dark UV Transilluminator (312 nm) with 4-lane 0.8% Agarose Gel stained with EtBr
      const gx = leftW + pad * 0.5, gy = pad, gw = W - leftW - pad * 1.5, gh = H - pad * 2;
      Gfx.rr(c, gx, gy, gw, gh, 12);
      c.fillStyle = "#120C18"; c.fill();
      c.strokeStyle = "#4A2E56"; c.lineWidth = 1.5; c.stroke();

      Gfx.text(c, "Електрофореграма в 0,8 % агарозному гелі (УФ 312 нм, бромистий етидій)", gx + 14, gy + 18, {
        weight: 700, size: 11.5, color: "#F6C8A0"
      });

      // Cathode (-) at top, Anode (+) at bottom
      const gelX = gx + 24, gelY = gy + 38, gelW = gw - 48, gelH = gh - 64;
      Gfx.rr(c, gelX, gelY, gelW, gelH, 8);
      c.fillStyle = "#1C1226"; c.fill();
      c.strokeStyle = "rgba(255,140,90,0.28)"; c.lineWidth = 1; c.stroke();

      Gfx.text(c, "− Катод (старт)", gelX + 8, gelY + 13, { size: 9.5, font: "mono", color: "#B89EC4" });
      Gfx.text(c, "+ Анод (фронт бромфенолового синього)", gelX + 8, gelY + gelH - 6, { size: 9.5, font: "mono", color: "#7AA8E8" });

      const lanes = [
        { title: "1: λ/HindIII", sub: "маркер" },
        { title: "2: pBR322 нат.", sub: "ccc / oc" },
        { title: "3: pBR322 + EcoRI", sub: "лін. 4361" },
        { title: "4: Дослід. проба", sub: stateC.naType === "dna" ? "ДНК" : "РНК" }
      ];
      const lw = gelW / lanes.length;
      const runFrac = stateC.voltTime / 100;
      const wellY = gelY + 22, maxRun = (gelH - 44) * runFrac;

      const drawEtBrBand = (lx, yPos, bw, intensity, label = null) => {
        const glowA = clamp(intensity * (0.88 + 0.12 * Math.sin(t * 3.2)), 0.15, 1);
        const grad = c.createLinearGradient(0, yPos - 6, 0, yPos + 6);
        grad.addColorStop(0, "rgba(255,94,36,0)");
        grad.addColorStop(0.5, `rgba(255,126,56,${glowA * 0.85})`);
        grad.addColorStop(1, "rgba(255,94,36,0)");
        c.fillStyle = grad;
        c.fillRect(lx - bw / 2 - 3, yPos - 6, bw + 6, 12);
        Gfx.rr(c, lx - bw / 2, yPos - 2, bw, 4, 2);
        c.fillStyle = `rgba(255,215,165,${glowA})`; c.fill();
        if (label) {
          Gfx.text(c, label, lx + bw / 2 + 5, yPos + 3, { size: 8.8, font: "mono", color: "#FFD7A8" });
        }
      };

      const rfOfBp = (bp) => clamp((4.48 - Math.log10(bp)) / 1.95, 0.08, 0.94);

      lanes.forEach((L, i) => {
        const lcx = gelX + (i + 0.5) * lw, bw = Math.min(44, lw * 0.54);
        // Well slot
        c.fillStyle = "#0B0610";
        c.fillRect(lcx - bw / 2, wellY - 4, bw, 5);
        Gfx.text(c, L.title, lcx, gy + gh - 9, { align: "center", size: 9.5, font: "mono", weight: 600, color: "#E9D2F4" });

        // Bromophenol blue tracking dye front
        c.fillStyle = "rgba(70,130,240,0.35)";
        c.fillRect(lcx - bw / 2, wellY + maxRun, bw, 3);

        if (i === 0) {
          // Lane 1: Lambda / HindIII ladder
          const bps = [23130, 9416, 6557, 4361, 2322, 2027, 564];
          for (const bp of bps) {
            const yy = wellY + rfOfBp(bp) * maxRun;
            drawEtBrBand(lcx - 6, yy, bw * 0.72, bp === 564 ? 0.45 : 0.82, bp === 23130 || bp === 4361 || bp === 2027 ? `${bp}` : null);
          }
        } else if (i === 1) {
          // Lane 2: Uncut native plasmid pBR322 (3 topological isoforms!)
          drawEtBrBand(lcx - 8, wellY + 0.25 * maxRun, bw * 0.72, 0.55, "oc (II)");
          drawEtBrBand(lcx - 8, wellY + rfOfBp(4361) * maxRun, bw * 0.72, 0.32, "lin (III)");
          drawEtBrBand(lcx - 8, wellY + 0.62 * maxRun, bw * 0.72, 0.98, "ccc (I)");
        } else if (i === 2) {
          // Lane 3: EcoRI-linearized pBR322 (single sharp band at 4361 bp)
          drawEtBrBand(lcx - 6, wellY + rfOfBp(4361) * maxRun, bw * 0.76, 0.95, "4361 п.н.");
        } else if (i === 3) {
          // Lane 4: Sample from Spectrophotometer (intensity scales with d260, protein stays in well)
          const intS = clamp(m.d260 / 0.7, 0.22, 1.0);
          if (stateC.protPct > 25) {
            // Protein-bound DNA trapped in loading well
            drawEtBrBand(lcx, wellY + 2, bw * 0.82, clamp(stateC.protPct / 70, 0.3, 0.95));
          }
          if (stateC.naType === "dna") {
            drawEtBrBand(lcx, wellY + 0.16 * maxRun, bw * 0.8, intS * 0.92, "вмДНК");
            drawEtBrBand(lcx, wellY + 0.62 * maxRun, bw * 0.8, intS * 0.88);
          } else {
            // Plant total RNA: 28S rRNA, 18S rRNA (approx 2:1 ratio) and 5S/tRNA low molecular band
            drawEtBrBand(lcx, wellY + 0.42 * maxRun, bw * 0.8, intS * 0.95, "28S");
            drawEtBrBand(lcx, wellY + 0.58 * maxRun, bw * 0.8, intS * 0.75, "18S");
            drawEtBrBand(lcx, wellY + 0.84 * maxRun, bw * 0.8, intS * 0.48, "5S/тРНК");
          }
        }
      });
    }

    updateA();
    updateB();
    updateC();
    modes.init();

    return {
      stages: [stA, chKanA, chVirA, stB, chAmpB, chPhB, stC, chUvC, chCalC],
      frame(dt, time) {
        if (modes.cur === "a" && (dt > 0 || stA.dirty)) { stA.dirty = false; drawStageA(dt, time); }
        if (modes.cur === "b" && (dt > 0 || stB.dirty)) { stB.dirty = false; drawStageB(dt, time); }
        if (modes.cur === "c" && (dt > 0 || stC.dirty)) { stC.dirty = false; drawStageC(dt, time); }
      }
    };
  }
});
})();
