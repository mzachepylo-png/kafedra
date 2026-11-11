(() => {
"use strict";
const { App, Gfx, UI, h, $, Stage, drawChart, Spectral, Theme, Draw, clamp, lerp, smooth, rng, gauss, fmt, fmtSig, rgba, mixHex, shade, alpha, mixc, ease, FB, FM, FD, NA, RG, REDUCED, niceTicks, tickFmt, logTicks, hex2rgb, sci, hash01 } = window.BIO;

const HORMONE_REGIMES = {
  opt24d: {
    name: "2,4-Д (1,0 мг/л) + Кінетин (0,2 мг/л) — інтенсивний пухкий калюс",
    rmax: 0.23, K: 1450, lag: 3.5, dryPct: 5.8, friable: 0.85,
    desc: "Синтетичний ауксин 2,4-Д стійкий до ферментативного окиснення ІОК-оксидазою і підтримує високу швидкість клітинних поділів, формуючи світло-жовтий пухкий оводнений калюс."
  },
  naaBap: {
    name: "НОК (1,0 мг/л) + 6-БАП (1,0 мг/л) — щільний компактний калюс",
    rmax: 0.19, K: 1180, lag: 4.2, dryPct: 8.4, friable: 0.25,
    desc: "Поєднання α-нафтилоцтової кислоти з високою дозою 6-бензиламінопурину індукує утворення меристематичних вогнищ і трахеїдних елементів, формуючи щільний зеленуватий калюс із вищою часткою сухої маси."
  },
  iaaKin: {
    name: "ІОК (2,0 мг/л) + Кінетин (0,5 мг/л) — помірний ріст",
    rmax: 0.15, K: 860, lag: 5.0, dryPct: 7.1, friable: 0.50,
    desc: "Природний ауксин ІОК швидко руйнується пероксидазами (ІОК-оксидазою) та світлом, тому фаза активного росту коротша."
  },
  noHorm: {
    name: "Без фітогормонів (контроль МС) — затухаючий ріст",
    rmax: 0.05, K: 165, lag: 7.5, dryPct: 9.2, friable: 0.15,
    desc: "За відсутності екзогенних ауксинів і цитокінінів клітини експлантата здійснюють лише кілька поділів за рахунок ендогенного пулу гормонів на рановій поверхні."
  }
};

App.def(3, {
  cheat: `
    <p class="lead"><b>Калюс</b> (від лат. <i>callus</i> — мозоль) — це неорганізовано проліферуюча тканина, що складається переважно з дедиференційованих паренхімних клітин і виникає у відповідь на механічне поранення та дію фітогормонів (ауксинів і цитокінінів). Утворення калюсу ґрунтується на фундаментальній властивості рослинних клітин — <b>тотипотентності</b> (здатності диференційованої соматичної клітини повертатися до ембріонального меристематичного стану — <b>дедиференціації</b> — та реалізовувати всю генетичну програму цілого організму).</p>

    <h3>1. S-подібна крива росту калюсної культури та 5 її фаз (ЛР № 13–14, с. 63–72)</h3>
    <p>При періодичному культивуванні калюсу на агаризованому середовищі залежність сирої чи сухої біомаси $W(t)$ або кількості клітин від часу описується <b>S-подібною (сигмоїдною) кривою Сакса—Ферхюльста</b>, на якій виділяють п'ять послідовних фаз (с. 68–70):</p>
    <ol>
      <li><b>Лаг-фаза (прихована фаза адаптації, 0–4 доби):</b> поділи клітин ще відсутні; відбувається дедиференціація спеціалізованих клітин експлантата, реорганізація цитоскелета, активація транскрипції рРНК і біосинтезу білків-циклінів під дією ауксину.</li>
      <li><b>Експоненційна (логарифмічна) фаза (4–12 діб):</b> клітини діляться з максимальною питомою швидкістю росту $\\mu_{\\max}$; біомаса зростає за показниковим законом $W(t) = W_0 e^{\\mu t}$, переважають дрібні меристемоподібні клітини з густою цитоплазмою.</li>
      <li><b>Лінійна фаза (12–20 діб):</b> приріст біомаси на одиницю часу стає сталим ($\\text{d}W/\\text{d}t \\approx \\text{const}$), оскільки поділ обмежується дифузією кисню й сахарози вглиб калюсного конгломерату; одночасно починається вакуолізація та розтягнення клітин.</li>
      <li><b>Фаза сповільнення росту (20–26 діб):</b> вичерпуються джерела вуглецю, азоту й фітогормонів у середовищі, накопичуються вторинні метаболіти та фенольні інгібітори; мітотичний індекс стрімко падає.</li>
      <li><b>Стаціонарна фаза та фаза відмирання (після 26–30 діб):</b> швидкість поділу зрівнюється зі швидкістю лізису клітин ($\\text{d}W/\\text{d}t = 0$, $W \\to K$). Саме на <b>прикінці лінійної — на початку стаціонарної фази (21–28 доба)</b> необхідно проводити <b>пасаж (субкультивування)</b> на свіже середовище, інакше калюс буріє через окиснення поліфенолів до хінонів і некротизується.</li>
    </ol>

    <h4>Кількісні показники росту калюсної тканини (с. 71–73)</h4>
    <p>Для об'єктивної оцінки ефективності середовищ і регуляторів росту визначають <b>абсолютний приріст</b> $\\Delta W_{\\text{абс}}$, <b>відносний індекс приросту</b> $\\Delta W$ (або ростовий індекс $I_W$), <b>питому швидкість росту</b> $\\mu$ та <b>частку сухої речовини</b> $K_{\\text{сух}}$ (після висушування наважки у бюксі при $105\\ ^\\circ\\text{C}$ до постійної маси):</p>
    <div class="eq">$$\\Delta W_{\\text{абс}} = W_t - W_0, \\qquad \\Delta W = \\frac{W_t - W_0}{W_0}, \\qquad \\mu = \\frac{\\ln W_t - \\ln W_0}{t}, \\qquad K_{\\text{сух}} = \\frac{W_{\\text{сух}}}{W_{\\text{сир}}}\\cdot 100\\,\\%$$</div>
    <p>За морфологією розрізняють <b>пухкий (friable) калюс</b> — сильно оводнений ($92–95\\,\\%$ води), світло-жовтий або білуватий, легко розпадається на окремі клітини при струшуванні (ідеальний для ініціації суспензійних культур, утворюється при високому співвідношенні 2,4-Д / цитокінін) — та <b>щільний (компактний) калюс</b> — містить лігніфіковані трахеїдні елементи й меристематичні вузлики, зеленіє на світлі й здатний до органогенезу (пагоноутворення при підвищенні частки цитокінінів).</p>

    <h3>2. Мацерація тканини за Брауном і підрахунок клітин у камері Фукса—Розенталя (ЛР № 13, с. 73–75)</h3>
    <p>Збільшення сирої маси калюсу може відбуватися як за рахунок справжньої проліферації (поділу клітин — гіперплазії), так і за рахунок простого поглинання води й вакуолярного розтягнення клітин (гіпертрофії). Щоб розрізнити ці два процеси, у <b>Лабораторній роботі № 13</b> визначають кількість клітин в 1 г калюсної тканини методом мацерації за Р. Брауном (Brown, 1951):</p>
    <ul>
      <li><b>Хімічна мацерація:</b> наважку калюсу $d$ ($0,1–0,3\\text{ г}$) заливають точним об'ємом $V$ ($2–5\\text{ мл}$) мацеруючої суміші — <b>5 % розчину хромового ангідриду ($\\text{CrO}_3$) у 5 % соляній кислоті ($\\text{HCl}$)</b> — і витримують 8–10 год (або 15–20 хв при підігріванні на водяній бані при 40–50 °C), після чого інтенсивно струшують або пропускають крізь шприц. Розчин селективно гідролізує пектати кальцію серединної пластинки, не руйнуючи целюлозні оболонки, тому тканина розпадається на ізольовані клітини.</li>
      <li><b>Лічильна камера Фукса—Розенталя:</b> має глибину зазору під притертим накривним скельцем (до появи <b>райдужних інтерференційних кілець Ньютона</b>!) $h = 0,2\\text{ мм}$. Сітка камери складається з 16 великих квадратів площею по $1\\text{ мм}^2$ кожний (кожен великий квадрат поділений на 16 малих квадратів). Отже, об'єм суспензії над <b>одним великим квадратом</b> становить рівно $1\\text{ мм}^2 \\times 0,2\\text{ мм} = 0,2\\text{ мм}^3 = 0,2\\cdot 10^{-3}\\text{ мл}$.</li>
      <li><b>Підрахунок і розрахункова формула підручника (с. 74):</b> під мікроскопом підраховують кількість клітин у <b>4 великих квадратах по діагоналі</b> (у 5 повторностях), знаходять середню кількість клітин в одному великому квадраті $n$ і обчислюють загальну кількість клітин $N$ в 1 г калюсної тканини:</li>
    </ul>
    <div class="eq">$$N = \\frac{n \\cdot V \\cdot 10^3}{d \\cdot 0,2} \\quad (\\text{клітин в 1 г тканини}), \\qquad \\bar{m}_{\\text{кл}} = \\frac{1}{N}\\text{ (г)} = \\frac{10^9}{N}\\text{ (нг)}$$</div>
    <dl class="vars">
      <dt>n</dt><dd>середня кількість клітин в одному великому квадраті камери Фукса—Розенталя ($n = \\frac{1}{4}\\sum_{i=1}^4 n_i$);</dd>
      <dt>V</dt><dd>об'єм мацеруючого розчину (5 % CrO₃ у 5 % HCl), взятий для мацерації наважки, мл (см³);</dd>
      <dt>d</dt><dd>наважка досліджуваної калюсної тканини, г;</dd>
      <dt>0,2</dt><dd>об'єм камерної суспензії над одним великим квадратом ($0,2\\text{ мм}^3$);</dd>
      <dt>10³</dt><dd>коефіцієнт переведення $\\text{мм}^3$ у $\\text{см}^3$ (мл).</dd>
    </dl>

    <details class="bproto">
      <summary>Хід роботи (Лабораторні роботи № 13–14, с. 73–78)</summary>
      <div>
        <ol class="bsteps">
          <li><b>ЛР № 13 (част. 1). Визначення сирої та сухої біомаси й індексу росту калюсу:</b> стерильним пінцетом вийміть калюс із пробірки (відокремте залишки агару), зважте на аналітичних вагах ($W_t$), обчисліть абсолютний приріст $\\Delta W_{\\text{абс}} = W_t - W_0$ та відносний індекс приросту $\\Delta W = (W_t - W_0)/W_0$. Помістіть наважку у попередньо зважений алюмінієвий або скляний бюкс, висушіть у сушильній шафі при 105 °C до постійної маси, охолодіть в ексикаторі над $\\text{CaCl}_2$ і визначте суху масу $W_{\\text{сух}}$.</li>
          <li><b>ЛР № 13 (част. 2). Мацерація та підрахунок клітин у камері Фукса—Розенталя:</b> наважку калюсу $d = 0,2\\text{ г}$ помістіть у флакон із притертим корком, прилийте $V = 3,0\\text{ мл}$ суміші 5 % $\\text{CrO}_3$ + 5 % $\\text{HCl}$ та залиште на 8–10 год. Збовтайте до отримання гомогенної суспензії клітин, притріть накривне скельце до камери Фукса—Розенталя до появи кілець Ньютона, заповніть камеру пастерівською піпеткою, підрахуйте клітини у 4 великих діагональних квадратах за правилом Єгорова (верхня і ліва межі враховуються, нижня і права — ні) та обчисліть $N$ за формулою $N = \\frac{n\\cdot V\\cdot 10^3}{d\\cdot 0,2}$.</li>
          <li><b>ЛР № 14. Вивчення дії фітогормонів на ріст калюсу моркви та тютюну:</b> порівняйте біомасу, морфологію (колір, пухкість/щільність, оводненість) та розмір клітин калюсів, вирощених на середовищах із 2,4-Д, НОК, ІОК та різними дозами 6-БАП і кінетину.</li>
        </ol>
      </div>
    </details>
  `,
  qa: [
    [
      "Чому для визначення істинної швидкості росту калюсу недостатньо виміряти лише приріст сирої маси, а потрібно визначати також суху масу та кількість клітин?",
      "<p>Сира маса калюсу на 90–95 % складається з вакуолярної води. Під дією високих доз ауксинів (зокрема 2,4-Д) або зниженого осмотичного тиску середовища клітини можуть сильно розтягуватися за рахунок поглинання води без збільшення кількості поділів і синтезу цитоплазматичних білків. Одночасний підрахунок числа клітин $N$ після мацерації та визначення сухої маси $W_{\\text{сух}}$ дозволяють відокремити справжню мітотичну проліферацію (гіперплазію) від вакуолярного розтягнення клітин (гіпертрофії).</p>"
    ],
    [
      "Яку роль виконують хромовий ангідрид (CrO₃) і соляна кислота (HCl) під час мацерації калюсної тканини за Брауном?",
      "<p>Суміш 5 % $\\text{CrO}_3$ і 5 % $\\text{HCl}$ вибірково гідролізує й окиснює нерозчинний протопектин і пектати кальцію/магнію серединної пластинки, що склеюють сусідні клітини між собою, але за кімнатної температури не руйнує целюлозний каркас первинної клітинної стінки. Завдяки цьому тканина при струшуванні розпадається на цілі ізольовані клітини, придатні для підрахунку у лічильній камері.</p>"
    ],
    [
      "Що свідчить про правильне притирання накривного скельця до лічильної камери Фукса—Розенталя і чому це критично для точності розрахунку?",
      "<p>Критерієм правильного притирання є поява <b>райдужних інтерференційних смуг (кілець Ньютона)</b> на бічних опорних площинках камери. Лише за цієї умови висота щілини над сіткою точно дорівнює паспортній величині $h = 0,200\\text{ мм}$ (об'єм над великим квадратом $0,2\\text{ мм}^3$). Якщо скельце просто покласти зверху, шар рідини підніметься за рахунок капілярних сил до 0,25–0,35 мм, і розрахована концентрація клітин буде завищена на 25–75 %.</p>"
    ],
    [
      "На якій фазі S-подібної кривої росту необхідно пересаджувати (пасажувати) калюсну культуру на свіже живильне середовище і чому?",
      "<p>Пересаджування (субкультивування) проводять на <b>прикінці лінійної — на самому початку стаціонарної фази (зазвичай на 21–28 добу)</b>. Якщо пересадити занадто рано, малий приріст не виправдовує трудомісткості пасажу; якщо затримати культуру у стаціонарній фазі, виснаження сахарози й накопичення токсичних продуктів окиснення фенолів (хінонів) спричиняє побуріння та необоротний некроз клітин, що різко подовжує лаг-фазу наступного пасажу.</p>"
    ],
    [
      "Чому синтетичний ауксин 2,4-Д індукує утворення пухкого неморфогенного калюсу значно активніше за природну індоліл-3-оцтову кислоту (ІОК)?",
      "<p>Молекула 2,4-дихлорфеноксиоцтової кислоти (2,4-Д) не розщеплюється рослинною ІОК-оксидазою (пероксидазою) і повільно кон'югується з амінокислотами, тому підтримує стабільно високий внутрішньоклітинний рівень ауксинового сигналу протягом усього пасажу. Це стимулює безперервну дедиференціацію та поділ паренхімних клітин, але водночас блокує полярні градієнти ауксину, необхідні для закладки меристематичних центрів органогенезу чи дозрівання соматичних ембріоїдів.</p>"
    ]
  ],
  build({ stageBox, ctrls, below, tabsBox }) {
    let mode = "a";
    const M = UI.modes(tabsBox, stageBox, ctrls, below, [
      ["a", "А. S-подібна крива росту та дія фітогормонів (ЛР 14)"],
      ["b", "Б. Мацерація за Брауном і камера Фукса—Розенталя (ЛР 13)"]
    ], id => { mode = id; });

    /* ==================== TAB A: S-CURVE & PHYTOHORMONES (LAB 14) ==================== */
    const A = M.box("a");
    let regKey = "opt24d";
    let w0 = 60; // initial explant weight, mg (50..150 mg)
    let dayT = 21; // current day of culture (0..40)

    const stA = new Stage(A.st, { aspect: 1.75, minH: 280, maxH: 410 });
    const rdA = UI.reads(A.st, [
      ["wt", "Сира маса калюсу Wt"],
      ["dw", "Індекс приросту ΔW = (Wt−W₀)/W₀"],
      ["wdry", "Суха маса Wсух (105 °C)"],
      ["phase", "Поточна фаза росту (1–5)"],
    ]);

    UI.select(A.ct, {
      id: "l3-reg", label: "Гормональний варіант середовища МС (ЛР 14)", value: regKey,
      options: Object.entries(HORMONE_REGIMES).map(([k, v]) => [k, v.name]),
      on: v => { regKey = v; }
    });
    const sDay = UI.slider(A.ct, {
      id: "l3-day", label: "Доба культивування в пасажі t", min: 0, max: 40, step: 1, value: dayT, unit: "доба",
      fmt: v => fmt(v, 0), on: v => { dayT = v; }
    });
    const sW0 = UI.slider(A.ct, {
      id: "l3-w0", label: "Початкова маса експлантата W₀", min: 30, max: 150, step: 5, value: w0, unit: "мг",
      fmt: v => fmt(v, 0), on: v => { w0 = v; }
    });
    UI.buttons(A.ct, [
      { label: "Експоненційна фаза (8-ма доба)", on: () => { sDay.set(8); dayT = 8; } },
      { label: "Лінійна фаза (15-та доба)", on: () => { sDay.set(15); dayT = 15; } },
      { label: "Час пасажу — початок стаціонару (24-та доба)", pri: true, on: () => { sDay.set(24); dayT = 24; } },
      { label: "Перетримування — старіння (37-ма доба)", on: () => { sDay.set(37); dayT = 37; } }
    ]);

    const outA = UI.out(A.bl, "");
    const chRowA = h("div", { class: "charts" }); A.bl.append(chRowA);
    const chA1 = UI.chart(chRowA, "S-подібна крива росту калюсу W(t) та виділення 5 фаз ростового циклу");
    const chA2 = UI.chart(chRowA, "Швидкість росту dW/dt (мг/добу) та індекс приросту ΔW у варіантах ЛР 14");

    function evalGrowth(key, t, initW = w0) {
      const R = HORMONE_REGIMES[key];
      // Richards-Verhulst logistic growth with lag phase and late-stage senescence (>30 days)
      const tEff = Math.max(0, t - R.lag * (1 - Math.exp(-t / Math.max(0.5, R.lag))));
      const K = R.K * Math.pow(initW / 60, 0.25);
      const wtRaw = (initW * K) / (initW + (K - initW) * Math.exp(-R.rmax * tEff));
      // Senescence / dehydration loss after day 30
      const senLoss = t > 29 ? 1 - 0.014 * Math.pow(t - 29, 1.35) : 1.0;
      const wt = Math.max(initW, wtRaw * clamp(senLoss, 0.65, 1.0));
      const dwAbs = wt - initW;
      const dwIdx = dwAbs / initW;
      const wDry = wt * (R.dryPct / 100);
      // Determine phase 1..5
      let phaseName = "I. Лаг-фаза (дедиференціація)";
      if (t >= R.lag && t < 11) phaseName = "II. Експоненційна (логарифмічна)";
      else if (t >= 11 && t < 20) phaseName = "III. Лінійна фаза";
      else if (t >= 20 && t < 26) phaseName = "IV. Фаза сповільнення росту";
      else if (t >= 26 && t <= 31) phaseName = "V. Стаціонарна (час пасажу!)";
      else if (t > 31) phaseName = "VI. Старіння і побуріння (некроз)";
      return { R, wt, dwAbs, dwIdx, wDry, phaseName, K };
    }

    function drawA(time) {
      const { ctx: c, w, h: hh } = stA;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const G = evalGrowth(regKey, dayT);

      rdA.set("wt", fmt(G.wt, 0), `мг (ΔWабс = +${fmt(G.dwAbs, 0)} мг)`);
      rdA.set("dw", fmt(G.dwIdx, 2), `разів (+${fmt(G.dwIdx * 100, 0)} %)`);
      rdA.set("wdry", fmt(G.wDry, 1), `мг (${fmt(G.R.dryPct, 1)} % сух. реч.)`);
      rdA.set("phase", G.phaseName, "");

      // Left: Erlenmeyer flask with growing callus mass on agar
      const fx = w * 0.28, fy = 26, fw = Math.min(w * 0.38, 175), fh = hh - 52;
      Gfx.flask(c, fx, fy, fw, fh, 0.28, "rgba(235, 224, 175, 0.52)", {
        wave: 0,
        plug: true,
        label: `Доба ${dayT}: W = ${fmt(G.wt, 0)} мг (ΔW = ${fmt(G.dwIdx, 2)})`,
        inside(ctx, ly) {
          // Draw 3D-like lobate callus mound sitting on top of the agar surface at y = ly
          const scale = Math.pow(G.wt / 60, 0.36);
          const nSph = Math.round(8 + scale * 12);
          const rGen = rng(404);
          // Color depends on hormone regime (pale yellow friable for 2,4-D, greenish compact for NAA+BAP, brownish if senescent > 31 d)
          const senFrac = smooth(29, 39, dayT);
          const baseCol = G.R.friable > 0.6 ? "#E6D97A" : G.R.friable < 0.35 ? "#8BC34A" : "#C5E1A5";
          const calCol = mixc(baseCol, "#795548", senFrac * 0.78);
          for (let i = 0; i < nSph; i++) {
            const rx = (rGen() - 0.5) * 28 * scale;
            const ry = -rGen() * 14 * scale;
            const rad = (5 + 4 * rGen()) * Math.min(1.6, scale * 0.55);
            Gfx.sphere(c, fx + rx, ly - 3 + ry, rad, calCol, { ring: "rgba(60,50,30,0.28)" });
          }
        }
      });

      // Right: Microscopic histology inset (friable parenchyma vs compact tracheid nodules + weighing pan)
      const rx = w * 0.56, ry = 26, rw = w * 0.41, rh = hh - 46;
      Gfx.rr(c, rx, ry, rw, rh, 12);
      c.fillStyle = Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(15,42,29,0.03)"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();
      Gfx.text(c, G.R.friable > 0.6 ? "Гістологія: пухкий паренхімний калюс" : "Гістологія: щільний калюс із трахеїдами", rx + rw / 2, ry + 18, {
        align: "center", size: 11.5, weight: 700, color: T.ink
      });

      const mcx = rx + rw / 2, mcy = ry + rh * 0.46, mr = Math.min(rw, rh) * 0.32;
      c.save();
      c.beginPath(); c.arc(mcx, mcy, mr, 0, 7);
      c.fillStyle = Theme.dark ? "#142018" : "#F8FBF6"; c.fill();
      c.clip();

      const rc = rng(303);
      const cellCount = G.R.friable > 0.6 ? 14 : 26;
      for (let i = 0; i < cellCount; i++) {
        const ang = (i / cellCount) * Math.PI * 2 + rc() * 0.5;
        const dist = rc() * mr * (G.R.friable > 0.6 ? 0.78 : 0.62);
        const cxCell = mcx + Math.cos(ang) * dist;
        const cyCell = mcy + Math.sin(ang) * dist;
        const rCell = G.R.friable > 0.6 ? 11 + rc() * 6 : 7 + rc() * 4;
        Gfx.sphere(c, cxCell, cyCell, rCell, G.R.friable > 0.6 ? "rgba(230,215,120,0.75)" : "rgba(130,195,90,0.85)", {
          ring: rgba(T.ink, 0.45)
        });
        // Nucleus
        c.fillStyle = rgba(T.accent, 0.65);
        c.beginPath(); c.arc(cxCell - 2, cyCell - 1, 2.5, 0, 7); c.fill();
      }
      // If compact callus, draw spiral lignified tracheid vessel elements in center
      if (G.R.friable < 0.4) {
        c.strokeStyle = "#8D4E2A"; c.lineWidth = 1.6;
        for (let s = -14; s <= 14; s += 4) {
          c.beginPath(); c.moveTo(mcx - 10, mcy + s); c.lineTo(mcx + 10, mcy + s + 2); c.stroke();
        }
      }
      c.restore();
      c.strokeStyle = rgba(T.ink, 0.4); c.lineWidth = 1.5;
      c.beginPath(); c.arc(mcx, mcy, mr, 0, 7); c.stroke();

      Gfx.text(c, `Оводненість: ${fmt(100 - G.R.dryPct, 1)} % води · Суха реч.: ${fmt(G.R.dryPct, 1)} %`, mcx, ry + rh - 28, {
        align: "center", size: 10.5, font: "mono", weight: 600, color: T.ink
      });
      Gfx.text(c, dayT > 30 ? "УВАГА: накопичення хінонів, пасажуйте негайно!" : "Оптимальний вік пасажування: 21–28 доба", mcx, ry + rh - 12, {
        align: "center", size: 10, weight: 700, color: dayT > 30 ? "#C62828" : T.accent
      });

      outA.set(`
        <b>Розрахунок ростових показників (ЛР № 13–14, ${G.R.name}):</b> ${G.R.desc}<br/>
        На <b>${dayT}-ту добу</b> культивування за початкової маси експлантата $W_0 = ${w0}\\text{ мг}$ сира маса калюсу становить <b>$W_t = ${fmt(G.wt, 0)}\\text{ мг}$</b>, абсолютний приріст $\\Delta W_{\\text{абс}} = W_t - W_0 = ${fmt(G.dwAbs, 0)}\\text{ мг}$, індекс приросту <b>$\\Delta W = \\frac{${fmt(G.wt, 0)} - ${w0}}{${w0}} = ${fmt(G.dwIdx, 2)}$</b>, суха маса бюкса <b>$W_{\\text{сух}} = ${fmt(G.wDry, 1)}\\text{ мг}$</b>.
      `);

      // Chart A1: S-shaped growth curves for all 4 hormone regimes + phase bands
      const seriesA1 = [
        ["opt24d", T.accent, "2,4-Д + Кінетин", 2.6],
        ["naaBap", "#1565C0", "НОК + 6-БАП", 2.1],
        ["iaaKin", "#D97706", "ІОК + Кінетин", 1.9],
        ["noHorm", "#8D6E63", "Контроль (без гормонів)", 1.6],
      ].map(([k, col, lb, lw]) => {
        const pts = [];
        for (let d = 0; d <= 40; d++) pts.push([d, evalGrowth(k, d).wt]);
        return { pts, color: col, w: k === regKey ? 3.0 : lw, dash: k === regKey ? [] : [4, 3], label: lb };
      });

      drawChart(chA1.ctx, chA1.w, chA1.h, {
        x: [0, 40], y: [0, 1600],
        xl: "Тривалість вирощування t, діб (фази I–V)", yl: "Сира біомаса калюсу W(t), мг",
        band: [
          { x0: 0, x1: 4, color: "rgba(120,120,120,0.08)" },
          { x0: 21, x1: 28, color: rgba(T.accent, 0.12) }
        ],
        vl: [
          { x: 4, color: T.muted, label: "I→II" },
          { x: 11, color: T.muted, label: "II→III" },
          { x: 20, color: T.muted, label: "III→IV" },
          { x: 26, color: T.accent, label: "V. Пасаж" }
        ],
        series: seriesA1,
        marks: [{ x: dayT, y: G.wt, r: 5.5, color: T.accent, label: `${fmt(G.wt, 0)} мг` }],
        legend: seriesA1.map(s => ({ label: s.label, color: s.color }))
      });

      // Chart A2: Daily growth rate dW/dt (bell-shaped curve peaking in linear phase)
      const ratePts = [];
      for (let d = 1; d <= 39; d++) {
        const wPrev = evalGrowth(regKey, d - 0.5).wt;
        const wNext = evalGrowth(regKey, d + 0.5).wt;
        ratePts.push([d, Math.max(0, wNext - wPrev)]);
      }
      const curRate = Math.max(0, evalGrowth(regKey, dayT + 0.5).wt - evalGrowth(regKey, Math.max(0, dayT - 0.5)).wt);
      drawChart(chA2.ctx, chA2.w, chA2.h, {
        x: [0, 40], y: [0, 110],
        xl: "Доба культивування t", yl: "Добовий приріст dW/dt, мг/добу",
        series: [{ pts: ratePts, color: "#D97706", w: 2.5, fill: "rgba(217,119,6,0.12)" }],
        marks: [{ x: dayT, y: curRate, r: 5.5, color: "#D97706", label: `${fmt(curRate, 1)} мг/добу` }],
        legend: [{ label: "Швидкість приросту dW/dt (максимум у фазі III)", color: "#D97706" }]
      });
    }

    /* ==================== TAB B: BROWN'S MACERATION & FUCHS–ROSENTHAL CHAMBER (LAB 13) ==================== */
    const B = M.box("b");
    let sampleD = 0.20; // g of fresh callus weighed for maceration (0.05..0.50 g)
    let macVol = 3.0; // mL of 5% CrO3 + 5% HCl (1.0..10.0 mL)
    let meanN = 28; // average cells counted per 1 large square (5..80)
    let newtonOK = true; // cover slip properly pressed to Newton's rings (h = 0.2 mm)
    let seedGrid = 1;

    const stB = new Stage(B.st, { aspect: 1.75, minH: 290, maxH: 420 });
    const rdB = UI.reads(B.st, [
      ["n4", "Клітин у 4 діагон. квадратах"],
      ["navg", "Середнє в 1 великому квадраті n"],
      ["Ntot", "Кількість клітин N в 1 г тканини"],
      ["mcell", "Середня маса 1 клітини mкл"],
    ]);

    const sCount = UI.slider(B.ct, {
      id: "l3-n", label: "Середня кількість клітин в 1 великому квадраті n", min: 6, max: 75, step: 1, value: meanN, unit: "клітин",
      fmt: v => fmt(v, 0), on: v => { meanN = v; }
    });
    const sVolB = UI.slider(B.ct, {
      id: "l3-v", label: "Об'єм мацеруючого розчину CrO₃+HCl (V)", min: 1.0, max: 8.0, step: 0.5, value: macVol, unit: "мл",
      fmt: v => fmt(v, 1), on: v => { macVol = v; }
    });
    const sMassD = UI.slider(B.ct, {
      id: "l3-d", label: "Наважка калюсної тканини для мацерації (d)", min: 0.05, max: 0.50, step: 0.05, value: sampleD, unit: "г",
      fmt: v => fmt(v, 2), on: v => { sampleD = v; }
    });
    UI.check(B.ct, {
      id: "l3-newt", label: "Притерти накривне скельце до появи кілець Ньютона (h = 0,20 мм)", value: newtonOK,
      on: v => { newtonOK = v; }
    });
    UI.buttons(B.ct, [
      { label: "Нова вибірка клітин (перезаповнити камеру)", pri: true, on: () => { seedGrid++; } },
      { label: "Дрібноклітинний меристематичний калюс (n = 55)", on: () => { sCount.set(55); meanN = 55; seedGrid++; } },
      { label: "Крупноклітинний вакуолізований калюс (n = 16)", on: () => { sCount.set(16); meanN = 16; seedGrid++; } }
    ]);

    const outB = UI.out(B.bl, "");
    const chRowB = h("div", { class: "charts" }); B.bl.append(chRowB);
    const chB1 = UI.chart(chRowB, "Залежність густини клітин N (тис./г) від показника камери n за формулою ЛР 13");
    const chB2 = UI.chart(chRowB, "Співвідношення числа клітин N та середньої маси клітини mкл за фазами росту");

    function calcFuchs() {
      const r = rng(seedGrid * 71 + meanN);
      const hEff = newtonOK ? 0.20 : 0.29; // if not pressed to Newton's rings, depth is inflated!
      const scaleH = hEff / 0.20;
      const sqCounts = [0, 1, 2, 3].map(() => Math.max(1, Math.round(meanN * scaleH + (r() - 0.5) * 6)));
      const sum4 = sqCounts.reduce((a, b) => a + b, 0);
      const nBar = sum4 / 4;
      // Exact textbook formula (p. 74): N = (n * V * 10^3) / (d * 0.2)
      const N = (nBar * macVol * 1000) / (sampleD * 0.2);
      const mCellNg = (1 / N) * 1e9; // nanograms per cell
      return { sqCounts, sum4, nBar, N, mCellNg, hEff };
    }

    function drawB(time) {
      const { ctx: c, w, h: hh } = stB;
      const T = Theme.c;
      c.clearRect(0, 0, w, hh);
      const F = calcFuchs();

      rdB.set("n4", `${F.sqCounts.join(" + ")} = ${F.sum4}`, "клітин");
      rdB.set("navg", fmt(F.nBar, 2), "кл./квадрат");
      rdB.set("Ntot", sci(F.N, 2), "клітин / 1 г");
      rdB.set("mcell", fmt(F.mCellNg, 0), "нг/клітину");

      // Left: Fuchs-Rosenthal 4x4 grid of 16 large squares (with 4 diagonal squares highlighted)
      const gridS = Math.min(w * 0.48, hh - 48);
      const gx = 20, gy = (hh - gridS) / 2;

      // Glass slide background + rainbow Newton's rings on side rails if newtonOK
      Gfx.rr(c, gx - 10, gy - 16, gridS + 20, gridS + 32, 10);
      c.fillStyle = Theme.dark ? "#172620" : "#E8F1EE"; c.fill();
      c.strokeStyle = rgba(T.ink, 0.4); c.lineWidth = 1.4; c.stroke();

      if (newtonOK) {
        // Draw rainbow interference rings on left and right margins
        const cols = ["#FF5252", "#FFB74D", "#FFEE58", "#69F0AE", "#40C4FF"];
        cols.forEach((col, idx) => {
          c.strokeStyle = col; c.lineWidth = 1.5; c.globalAlpha = 0.65;
          c.beginPath();
          c.ellipse(gx - 5, gy + gridS / 2, 2 + idx * 0.7, gridS * 0.35 - idx * 8, 0, 0, 7);
          c.ellipse(gx + gridS + 5, gy + gridS / 2, 2 + idx * 0.7, gridS * 0.35 - idx * 8, 0, 0, 7);
          c.stroke();
        });
        c.globalAlpha = 1;
      }

      const sqW = gridS / 4;
      for (let r = 0; r < 4; r++) {
        for (let col = 0; col < 4; col++) {
          const sx = gx + col * sqW, sy = gy + r * sqW;
          const isDiag = r === col;
          c.fillStyle = isDiag
            ? (Theme.dark ? "rgba(76, 175, 80, 0.18)" : "rgba(46, 125, 50, 0.12)")
            : (Theme.dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.65)");
          c.fillRect(sx, sy, sqW, sqW);

          // 4x4 small subdivisions inside each large square
          c.strokeStyle = rgba(T.ink, 0.14); c.lineWidth = 0.6;
          for (let sub = 1; sub < 4; sub++) {
            c.beginPath();
            c.moveTo(sx + (sqW * sub) / 4, sy); c.lineTo(sx + (sqW * sub) / 4, sy + sqW);
            c.moveTo(sx, sy + (sqW * sub) / 4); c.lineTo(sx + sqW, sy + (sqW * sub) / 4);
            c.stroke();
          }

          // Double ruling border of large square
          c.strokeStyle = isDiag ? T.accent : rgba(T.ink, 0.45);
          c.lineWidth = isDiag ? 2.0 : 1.0;
          c.strokeRect(sx + 0.5, sy + 0.5, sqW - 1, sqW - 1);

          // Populate cells inside square
          const nHere = isDiag ? F.sqCounts[r] : Math.round(F.nBar);
          const rc = rng(seedGrid * 131 + r * 17 + col * 31 + meanN);
          const maxDraw = Math.min(nHere, 45);
          for (let k = 0; k < maxDraw; k++) {
            const cxCell = sx + 5 + rc() * (sqW - 10);
            const cyCell = sy + 5 + rc() * (sqW - 10);
            c.fillStyle = isDiag ? "#2E7D32" : rgba(T.ink, 0.42);
            c.beginPath(); c.arc(cxCell, cyCell, 2.3, 0, 7); c.fill();
          }
          if (isDiag) {
            Gfx.chip(c, `n${r + 1} = ${F.sqCounts[r]}`, sx + sqW / 2, sy + 12, {
              color: "#FFF", bg: T.accent, size: 9.5
            });
          }
        }
      }

      // Right panel: Step-by-step live formula substitution & Brown's maceration vial
      const rx = gx + gridS + 24, rw = w - rx - 14;
      Gfx.rr(c, rx, gy - 16, rw, gridS + 32, 12);
      c.fillStyle = Theme.dark ? "rgba(255,255,255,0.03)" : "rgba(15,42,29,0.035)"; c.fill();
      c.strokeStyle = T.rule; c.lineWidth = 1; c.stroke();

      Gfx.text(c, "Мацерація за Брауном (5% CrO₃ + 5% HCl)", rx + 12, gy + 6, { size: 11.5, weight: 700, color: T.ink });
      Gfx.vial(c, rx + 16, gy + 20, 40, 68, {
        fill: 0.65,
        col: "rgba(230, 126, 34, 0.65)", // orange-amber chromic acid solution
        cap: true
      });
      Gfx.text(c, `d = ${fmt(sampleD, 2)} г калюсу`, rx + 68, gy + 38, { size: 11, font: "mono", weight: 600, color: T.ink });
      Gfx.text(c, `V = ${fmt(macVol, 1)} мл CrO₃+HCl`, rx + 68, gy + 56, { size: 11, font: "mono", weight: 600, color: "#D97706" });
      Gfx.text(c, newtonOK ? "Кільця Ньютона: Є (h = 0,20 мм) ✓" : "Помилка: немає кілець Ньютона!", rx + 68, gy + 74, {
        size: 10.5, weight: 700, color: newtonOK ? T.accent : "#C62828"
      });

      const fy = gy + 112;
      Gfx.text(c, "Підстановка у формулу посібника (с. 74):", rx + 12, fy, { size: 11, weight: 700, color: T.ink });
      Gfx.text(c, "N = (n · V · 10³) / (d · 0,2)", rx + 12, fy + 20, { size: 11.5, font: "mono", weight: 700, color: T.accent });
      Gfx.text(c, `n = (${F.sqCounts.join("+")}) / 4 = ${fmt(F.nBar, 2)}`, rx + 12, fy + 40, { size: 10.5, font: "mono", color: T.ink });
      Gfx.text(c, `N = (${fmt(F.nBar, 2)} · ${fmt(macVol, 1)} · 1000) / (${fmt(sampleD, 2)} · 0,2)`, rx + 12, fy + 58, { size: 10.5, font: "mono", color: T.ink });
      Gfx.text(c, `N = ${fmt(F.N / 1e3, 1)} тис. кл./г = ${sci(F.N, 2)} кл./г`, rx + 12, fy + 78, { size: 11.5, font: "mono", weight: 700, color: "#D97706" });
      Gfx.text(c, `Середня маса клітини: ${fmt(F.mCellNg, 0)} нг`, rx + 12, fy + 98, { size: 10.5, font: "mono", color: T.muted });

      outB.set(`
        <b>Розрахунок за камерою Фукса—Розенталя (ЛР № 13, с. 74):</b> у 4 великих діагональних квадратах підраховано <b>${F.sqCounts.join(", ")}</b> клітин (сума ${F.sum4}, середнє $n = ${fmt(F.nBar, 2)}$). За формулою $N = \\frac{n \\cdot V \\cdot 10^3}{d \\cdot 0,2} = \\frac{${fmt(F.nBar, 2)} \\cdot ${fmt(macVol, 1)} \\cdot 1000}{${fmt(sampleD, 2)} \\cdot 0,2}$ отримуємо <b>$N = ${sci(F.N, 2)}\\text{ клітин в 1 г сирої тканини}$</b>, а середня маса однієї клітини становить $\\bar{m}_{\\text{кл}} = 1/N = ${fmt(F.mCellNg, 0)}\\text{ нг}$.
      `);

      // Chart B1: N vs n for current V and d
      const ptsN = [];
      for (let x = 5; x <= 75; x += 2) {
        ptsN.push([x, ((x * macVol * 1000) / (sampleD * 0.2)) / 1e6]); // in millions per g
      }
      drawChart(chB1.ctx, chB1.w, chB1.h, {
        x: [5, 75], y: [0, ptsN[ptsN.length - 1][1] * 1.1],
        xl: "Середнє число клітин в 1 великому квадраті n", yl: "Густина клітин N, млн кл./г",
        series: [{ pts: ptsN, color: T.accent, w: 2.5, fill: rgba(T.accent, 0.10) }],
        marks: [{ x: F.nBar, y: F.N / 1e6, r: 5.5, color: "#D97706", label: `${fmt(F.N / 1e6, 2)} млн/г` }]
      });

      // Chart B2: Cell number per g vs mean cell weight across phases of callus growth
      const phDays = [2, 6, 10, 14, 18, 22, 26, 30];
      const nPerG = [1.1, 2.4, 3.6, 3.1, 2.2, 1.7, 1.5, 1.4].map((v, i) => [phDays[i], v]);
      const cellMass = nPerG.map(([d, v]) => [d, 1000 / v]); // ng/cell scaled
      drawChart(chB2.ctx, chB2.w, chB2.h, {
        x: [0, 32], y: [0, 4.0],
        xl: "Доба росту калюсу в пасажі", yl: "Густина клітин N, млн/г тканини",
        series: [
          { pts: nPerG, color: T.accent, w: 2.5, dots: 4 },
          { pts: cellMass.map(([d, m]) => [d, m / 250]), color: "#1565C0", w: 2.0, dash: [4, 3], dots: 3.5 }
        ],
        legend: [
          { label: "Число клітин в 1 г (пік у фазі II — поділ)", color: T.accent },
          { label: "Маса 1 клітини (зростає у фазі III — розтягнення)", color: "#1565C0" }
        ]
      });
    }

    M.init();
    return {
      stages: [stA, chA1, chA2, stB, chB1, chB2],
      frame(dt, time) {
        if (mode === "a") drawA(time);
        else drawB(time);
      }
    };
  }
});
})();
