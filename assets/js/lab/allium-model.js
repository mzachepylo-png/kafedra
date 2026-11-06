// Модель біотесту Allium cepa: доза — ефект для мітотичного індексу, фаз мітозу, аберацій, мікроядер і росту корінців.
// Параметри — навчальні оцінки за даними джерел конспекту «Allium cepa тест» (Fiskesjö, 1985; Rank & Nielsen, 1994;
// Leme & Marin-Morales, 2009; Ping et al., 2012; Nefic et al., 2013; Mauro et al., 2014; Voica et al., 2024;
// Meganid et al., 2025; Nicuță et al., 2025; Torres-Bugarín et al., 2026 та ін.).

// Типи аберацій: клас (кластогенна / анеугенна / фізіологічна / інтерфазна), назва, розділ конспекту
export const ABERR = {
  bridge: { name: 'Анафазний міст', cls: 'clast', where: 'AT', art: 'bridges' },
  frag: { name: 'Ацентричний фрагмент', cls: 'clast', where: 'AT', art: 'fragments' },
  lag: { name: 'Відстаюча хромосома', cls: 'aneu', where: 'AT', art: 'laggards' },
  vag: { name: 'Блукаюча хромосома', cls: 'aneu', where: 'AT', art: 'laggards' },
  sticky: { name: 'Липкість хромосом', cls: 'phys', where: 'MAT', art: 'sticky' },
  cmit: { name: 'К-мітоз', cls: 'aneu', where: 'M', art: 'cmitosis' },
  multi: { name: 'Мультиполярна анафаза', cls: 'aneu', where: 'AT', art: 'multipolar' },
  mn: { name: 'Мікроядро', cls: 'inter', where: 'I', art: 'micronuclei' },
  bin: { name: 'Двоядерна клітина', cls: 'inter', where: 'I', art: 'binucleate' },
  bud: { name: 'Ядерна брунька', cls: 'inter', where: 'I', art: 'nuclear-anomalies' },
};
export const CLS = {
  clast: { name: 'кластогенна', color: '#C2410C' },
  aneu: { name: 'анеугенна', color: '#6D28D9' },
  phys: { name: 'фізіологічна (незворотна)', color: '#B91C1C' },
  inter: { name: 'ядерна аномалія інтерфази', color: '#0E7490' },
};

// Групи чинників
export const GROUPS = {
  ref: { name: 'Еталонні мутагени (позитивний контроль)', kind: 'abiotic' },
  metal: { name: 'Важкі метали та металоїди', kind: 'abiotic' },
  nano: { name: 'Наночастинки', kind: 'abiotic' },
  pest: { name: 'Пестициди', kind: 'abiotic' },
  pharma: { name: 'Ліки', kind: 'abiotic' },
  ind: { name: 'Промислові полютанти і солі', kind: 'abiotic' },
  myco: { name: 'Мікотоксини пліснявих грибів', kind: 'biotic' },
  cyano: { name: 'Ціанотоксини', kind: 'biotic' },
  biopest: { name: 'Мікробні біопестициди', kind: 'biotic' },
  extract: { name: 'Рослинні екстракти', kind: 'biotic' },
  protect: { name: 'Пробіотики, дріжджі, водорості, симбіонти', kind: 'biotic' },
};

// Параметри чинника:
// ec50 — концентрація, за якої MI падає вдвічі (рівняння Хілла), n — коефіцієнт Хілла; horm — гормезис {h — висота піку, c — доза піку};
// ca — максимальний приріст частки аберантних анафаз-телофаз, % (ec50ca — напівнасичення); mn — максимальний приріст мікроядер, ‰;
// prof — відносна частка типів аберацій; phase — зсув фаз: 'cmit' (накопичення метафаз), 'pro' (затримка профази), 'g1s' (блок входу в мітоз);
// rootF — чутливість росту корінців відносно MI (EC50 росту = ec50·rootF); irr — частка незворотного ефекту після відновлення;
// tumor — гачки й пухлинки (c-tumors) на кінчиках; brown — побуріння кінчиків; tint — колір розчину;
// stim — стимуляція поділу (Smax, K); dr — захист від мутагену: максимальний %DR, K, режим ('des' — десмутаген, 'bio' — біоантимутаген, 'aox' — антиоксидант);
// detox — зниження ефективної дози мікотоксинів (Trichoderma)
export const AGENTS = [
  // ---- еталонні мутагени
  { id: 'mms', name: 'Метилметансульфонат (MMS)', group: 'ref', unit: 'мкг/мл', min: 1, max: 200, def: 10, ec50: 45, n: 1.3, ca: 26, ec50ca: 9, mn: 14,
    prof: { bridge: 4, frag: 4, lag: 1, vag: .5, sticky: .5, mn: 2 }, rootF: 1.1, irr: .35, tint: 'rgba(235,240,245,.25)',
    note: 'Алкілуючий кластоген, стандартний позитивний контроль 10 мкг/мл.', art: 'controls', src: 'Mauro et al., 2014' },
  { id: 'ems', name: 'Етилметансульфонат (EMS)', group: 'ref', unit: 'мкг/мл', min: 50, max: 3000, def: 1000, ec50: 600, n: 1.2, ca: 12, ec50ca: 700, mn: 9,
    prof: { bridge: 3, frag: 3, sticky: 2, cmit: 1, vag: 1, mn: 1.5 }, rootF: 1.2, irr: .3, tint: 'rgba(235,240,245,.25)',
    note: 'За 1000 мкг/мл MI падає з 50,9 до 18,4 %, аберацій 6,7 % (Ping et al., 2012).', art: 'controls', src: 'Ping et al., 2012' },
  { id: 'colch', name: 'Колхіцин', group: 'ref', unit: '%', min: 0.001, max: 0.2, def: 0.05, ec50: 2, n: 1, ca: 85, ec50ca: 0.012, mn: 6,
    prof: { cmit: 10, multi: 1, bin: .5 }, phase: 'cmit', rootF: 0.08, irr: .1, tumor: true, tint: 'rgba(245,240,220,.25)',
    note: 'Веретенна отрута: блокує полімеризацію тубуліну, клітини зупиняються в К-метафазі (Levan, 1938).', art: 'cmitosis', src: 'Torres-Bugarín et al., 2026' },
  { id: 'mh', name: 'Малеїновий гідразид', group: 'ref', unit: 'мг/л', min: 1, max: 100, def: 10, ec50: 25, n: 1.2, ca: 18, ec50ca: 8, mn: 10,
    prof: { frag: 4, bridge: 3, mn: 2, sticky: .5 }, rootF: .9, irr: .4, tint: 'rgba(240,240,235,.2)',
    note: 'Класичний рослинний кластоген, інгібітор синтезу нуклеїнових кислот.', art: 'controls', src: 'Torres-Bugarín et al., 2026' },
  // ---- метали (ряд токсичності Hg > Cd ≥ Pb > Cr > Cu > Ni > Zn)
  { id: 'hg', name: 'Ртуть (HgCl₂)', group: 'metal', unit: 'мг/л', min: 0.05, max: 50, def: 1, ec50: 0.9, n: 1.5, ca: 45, ec50ca: 0.7, mn: 9,
    prof: { cmit: 5, sticky: 4, multi: 2, vag: 1, bridge: 1 }, phase: 'cmit', rootF: .7, irr: .7, tumor: true, brown: .8, tint: 'rgba(225,230,235,.3)',
    note: 'Зв’язує –SH групи тубуліну: тотальний К-мітоз, липкість, руйнування веретена (Animasaun et al., 2024).', art: 'metals', src: 'Animasaun et al., 2024' },
  { id: 'cd', name: 'Кадмій (CdCl₂)', group: 'metal', unit: 'мг/л', min: 0.1, max: 50, def: 3, ec50: 3.5, n: 1.3, ca: 32, ec50ca: 2.5, mn: 12,
    prof: { bridge: 4, vag: 3, frag: 2, bud: 2, sticky: 1, mn: 2 }, rootF: .8, irr: .55, brown: .6, tint: 'rgba(235,235,225,.25)',
    note: 'Виснажує глутатіон і фітохелатини, витісняє Zn²⁺ з білків репарації ДНК (Voica et al., 2024).', art: 'metals', src: 'Voica et al., 2024' },
  { id: 'pb', name: 'Свинець (Pb(NO₃)₂)', group: 'metal', unit: 'мг/л', min: 1, max: 300, def: 20, ec50: 22, n: 1.2, ca: 28, ec50ca: 15, mn: 11,
    prof: { cmit: 3, bridge: 3, frag: 3, mn: 2, sticky: 1 }, phase: 'cmit', rootF: .75, irr: .5, tumor: true, brown: .5, tint: 'rgba(235,238,240,.25)',
    note: 'Сорбується пектатами стінок, заміщує Ca²⁺ у кальмодуліні, порушує мікротрубочки (Wierzbicka, 1987).', art: 'metals', src: 'Voica et al., 2024' },
  { id: 'cr', name: 'Хром(VI) (K₂Cr₂O₇)', group: 'metal', unit: 'мг/л', min: 0.5, max: 100, def: 10, ec50: 12, n: 1.3, ca: 30, ec50ca: 8, mn: 14,
    prof: { frag: 5, bridge: 4, mn: 3, sticky: 1 }, rootF: .8, irr: .5, brown: .4, tint: 'rgba(250,200,90,.38)',
    note: 'Відновлення Cr(VI) → Cr(III) дає гідроксильні радикали та зшивки «ДНК–хром–білок».', art: 'metals', src: 'Torres-Bugarín et al., 2026' },
  { id: 'cu', name: 'Мідь (CuSO₄)', group: 'metal', unit: 'мг/л', min: 0.02, max: 30, def: 3, ec50: 4.5, n: 1.4, ca: 22, ec50ca: 3, mn: 8, horm: { h: 0.28, c: 0.35 },
    prof: { sticky: 5, bridge: 2, frag: 1, vag: 1 }, rootF: .7, irr: .45, brown: .7, tint: 'rgba(110,170,230,.35)',
    note: 'Мікродози — кофактор супероксиддисмутази (SOD, ферменту, що знешкоджує супероксид-радикал), тому стимулюють (гормезис); понад 2 мг/л — цикл Фентона, липкість і пікноз; позитивний контроль 0,6–6 мг/л.', art: 'metals', src: 'Voica et al., 2024' },
  { id: 'zn', name: 'Цинк (ZnSO₄)', group: 'metal', unit: 'мг/л', min: 1, max: 1000, def: 50, ec50: 220, n: 1.3, ca: 12, ec50ca: 180, mn: 5, horm: { h: 0.3, c: 15 },
    prof: { sticky: 3, cmit: 1, bridge: 1, vag: 1 }, rootF: .8, irr: .3, tint: 'rgba(240,240,240,.2)',
    note: 'Двофазна (горметична) дія: малі дози стимулюють поділ і синтез поліфенолів, великі — пригнічують.', art: 'metals', src: 'Voica et al., 2024' },
  // ---- наночастинки
  { id: 'agno3', name: 'Іонне срібло (AgNO₃)', group: 'nano', unit: 'мг/л', min: 0.05, max: 50, def: 2, ec50: 1.6, n: 1.3, ca: 20, ec50ca: 1.5, mn: 6,
    prof: { bridge: 3, sticky: 3, frag: 2, mn: 2 }, rootF: .7, irr: .5, brown: .5, tint: 'rgba(230,230,235,.25)',
    note: 'Жорсткий цитотоксикант: MI до 8,6 %, мікроядра 4,0 ‰ (Torres-Bugarín et al., 2026).', art: 'nano', src: 'Torres-Bugarín et al., 2026' },
  { id: 'agnp', name: 'Наночастинки срібла без покриття', group: 'nano', unit: 'мг/л', min: 1, max: 300, def: 30, ec50: 45, n: 1.2, ca: 18, ec50ca: 30, mn: 6,
    prof: { sticky: 4, frag: 3, bridge: 2, mn: 1 }, rootF: .8, irr: .45, tint: 'rgba(190,175,140,.35)',
    note: 'Оксидативний стрес, розриви хромосом, метафазна липкість; діє і як «троянський кінь», вивільняючи Ag⁺.', art: 'nano', src: 'PMC8675964' },
  { id: 'argovit', name: 'Argovit™ (наносрібло з ПВП)', group: 'nano', unit: 'мг/л', min: 1, max: 1000, def: 50, ec50: 2500, n: 1, ca: 3, ec50ca: 800, mn: 1.3, horm: { h: 0.88, c: 60 },
    prof: { sticky: 1, bridge: 1 }, rootF: 1, irr: .1, tint: 'rgba(200,170,110,.35)',
    note: 'Покриття полівінілпіролідоном (ПВП) змінює профіль: MI 23,0 % проти 12,5 % у контролі, мікроядра лише 2,6 ‰.', art: 'nano', src: 'Torres-Bugarín et al., 2026' },
  { id: 'sezno', name: 'Наночастинки Se/ZnO', group: 'nano', unit: 'ppm', min: 1, max: 80, def: 20, ec50: 26, n: 1.4, ca: 24, ec50ca: 18, mn: 8,
    prof: { sticky: 4, bridge: 4, vag: 3, cmit: 2 }, phase: 'pro', rootF: .9, irr: .4, tint: 'rgba(230,225,210,.3)',
    note: 'Наночастинки селену й оксиду цинку; доза в ppm (мільйонних частках ≈ мг/л). Липкі анафази з множинними мостами, забігаючі хромосоми, затримка в профазі (Meganid et al., 2025).', art: 'nano', src: 'Meganid et al., 2025' },
  { id: 'tio2', name: 'Наночастинки TiO₂', group: 'nano', unit: 'мг/л', min: 10, max: 2000, def: 200, ec50: 900, n: 1.1, ca: 9, ec50ca: 600, mn: 4,
    prof: { sticky: 2, frag: 1, bridge: 1, mn: 1 }, rootF: 1.1, irr: .2, tint: 'rgba(250,250,250,.45)',
    note: 'Помірна генотоксичність, залежить від агрегації та розміру частинок.', art: 'nano', src: 'Torres-Bugarín et al., 2026' },
  // ---- пестициди
  { id: 'gly', name: 'Гліфосат (комерційна формуляція)', group: 'pest', unit: 'мг/л', min: 0.5, max: 200, def: 10, ec50: 18, n: 1.3, ca: 24, ec50ca: 10, mn: 9,
    prof: { bridge: 4, cmit: 3, vag: 2, mn: 2, sticky: 1 }, rootF: .6, irr: .45, tumor: true, tint: 'rgba(235,240,225,.25)',
    note: 'Мости, К-мітоз, блукаючі хромосоми; комерційні суміші з поверхнево-активною речовиною POEA (поліоксіетиленаміном) токсичніші за чистий гліфосат.', art: 'pesticides', src: 'Nicuță et al., 2025' },
  { id: 'imid', name: 'Імідаклоприд (інсектицид)', group: 'pest', unit: 'мг/л', min: 1, max: 1000, def: 100, ec50: 160, n: 1.2, ca: 16, ec50ca: 120, mn: 8,
    prof: { frag: 3, bridge: 3, mn: 3, sticky: 1 }, rootF: .9, irr: .4, tint: 'rgba(240,235,220,.25)',
    note: 'Хромосомні розриви, анафазні мости та мікроядра в інтерфазі (Bianchi et al., 2016).', art: 'pesticides', src: 'Nicuță et al., 2025' },
  { id: 'tbz', name: 'Тіабендазол (фунгіцид)', group: 'pest', unit: 'мг/л', min: 5, max: 300, def: 60, ec50: 70, n: 1.4, ca: 40, ec50ca: 45, mn: 10,
    prof: { cmit: 5, multi: 4, bin: 3, lag: 2 }, phase: 'cmit', rootF: .8, irr: .3, tumor: true, tint: 'rgba(245,245,235,.25)',
    note: 'Бензимідазол блокує тубулін: К-метафази, мультиполярні анафази, двоядерні клітини.', art: 'pesticides', src: 'Nicuță et al., 2025' },
  // ---- ліки
  { id: 'alpraz', name: 'Алпразолам', group: 'pharma', unit: 'мкг/мл', min: 20, max: 800, def: 200, ec50: 190, n: 2, ca: 26, ec50ca: 170, mn: 10,
    prof: { bridge: 3, frag: 2, lag: 2, multi: 2, bud: 2, bin: 2, mn: 2 }, rootF: 1, irr: .4, tint: 'rgba(240,240,250,.25)',
    note: 'r = −0,745 між дозою і MI; за 500 мкг/мл поділ майже зупиняється (Nefic et al., 2013).', art: 'pharma', src: 'Nefic et al., 2013' },
  { id: 'dox', name: 'Доксорубіцин (цитостатик)', group: 'pharma', unit: 'мкг/мл', min: 0.05, max: 30, def: 2, ec50: 1.8, n: 1.3, ca: 34, ec50ca: 1.2, mn: 13,
    prof: { bridge: 6, frag: 3, mn: 2 }, rootF: .9, irr: .6, tint: 'rgba(220,60,60,.35)',
    note: 'Інтеркалятор ДНК та інгібітор топоізомерази II: численні мости й фрагменти.', art: 'pharma', src: 'Nicuță et al., 2025' },
  { id: 'mtx', name: 'Метотрексат (антиметаболіт)', group: 'pharma', unit: 'мг/л', min: 0.05, max: 50, def: 2, ec50: 2, n: 1.6, ca: 6, ec50ca: 5, mn: 3,
    prof: { frag: 2, bridge: 1, sticky: 1 }, phase: 'g1s', rootF: 1, irr: .2, tint: 'rgba(250,220,80,.38)',
    note: 'Блокує тимідилатсинтазу (фермент синтезу тиміну для ДНК) і перехід G1→S: MI падає, а аберацій мало (цитостатичний ефект).', art: 'pharma', src: 'Nicuță et al., 2025' },
  // ---- промислові полютанти і солі
  { id: 'bpa', name: 'Бісфенол А', group: 'ind', unit: 'мг/л', min: 1, max: 200, def: 30, ec50: 40, n: 1.3, ca: 20, ec50ca: 30, mn: 7,
    prof: { cmit: 4, multi: 3, lag: 3, vag: 1 }, phase: 'cmit', rootF: .9, irr: .35, tint: 'rgba(240,240,235,.25)',
    note: 'Порушує мікротрубочки веретена: К-мітоз, мультиполярні анафази, відстаючі хромосоми.', art: 'industrial', src: 'Nicuță et al., 2025' },
  { id: 'nacl', name: 'Засолення (NaCl)', group: 'ind', unit: 'мМ', min: 5, max: 400, def: 100, ec50: 160, n: 2, ca: 10, ec50ca: 180, mn: 4,
    prof: { sticky: 3, bridge: 1, vag: 1, frag: 1 }, rootF: .55, irr: .2, tint: 'rgba(235,245,250,.3)',
    note: 'Осмотичний та іонний стрес гальмують ріст корінців сильніше, ніж поділ.', art: 'abiotic', src: 'Torres-Bugarín et al., 2026' },
  // ---- мікотоксини
  { id: 'afb1', name: 'Афлатоксин B1 (<i>Aspergillus flavus</i>)', group: 'myco', unit: 'мкг/мл', min: 0.2, max: 30, def: 5, ec50: 3.5, n: 1.4, ca: 42, ec50ca: 3, mn: 16,
    prof: { frag: 4, bridge: 4, cmit: 2, sticky: 2, mn: 3 }, rootF: .8, irr: .65, tint: 'rgba(240,230,180,.3)',
    note: 'Клітина перетворює його на реакційноздатний 8,9-епоксид, що утворює ковалентні сполуки (аддукти) з гуаніном ДНК: розриви, мости, мікроядра (Reiss, 1974).', art: 'mycotoxins', src: 'Reiss, 1974' },
  { id: 'ota', name: 'Охратоксин А (<i>Aspergillus</i>, <i>Penicillium</i>)', group: 'myco', unit: 'мкг/мл', min: 0.5, max: 80, def: 10, ec50: 11, n: 1.3, ca: 28, ec50ca: 9, mn: 9,
    prof: { bridge: 3, vag: 3, cmit: 2, bin: 2 }, rootF: .5, irr: .45, tint: 'rgba(240,235,200,.3)',
    note: 'Інгібує фенілаланіл-тРНК-синтетазу: різке гальмування росту, мости, К-метафази (Lerda et al., 2010).', art: 'mycotoxins', src: 'Lerda et al., 2010' },
  { id: 'pat', name: 'Патулін (<i>Penicillium expansum</i>)', group: 'myco', unit: 'мкг/мл', min: 0.5, max: 60, def: 8, ec50: 7, n: 1.5, ca: 36, ec50ca: 6, mn: 10,
    prof: { cmit: 4, multi: 3, frag: 2, bridge: 1 }, phase: 'cmit', rootF: .8, irr: .5, tumor: true, tint: 'rgba(245,240,225,.25)',
    note: 'Тіолова веретенна отрута: К-мітоз, багатополюсні анафази, фрагментація ядерець.', art: 'mycotoxins', src: 'Reiss, 1974' },
  { id: 'don', name: 'Дезоксиніваленол (<i>Fusarium</i>)', group: 'myco', unit: 'мкг/мл', min: 0.2, max: 50, def: 5, ec50: 4.5, n: 1.5, ca: 20, ec50ca: 5, mn: 7,
    prof: { frag: 3, bridge: 3, sticky: 2, lag: 1 }, phase: 'g1s', rootF: .7, irr: .4, tint: 'rgba(240,225,215,.3)',
    note: 'Блокує велику (60S) субодиницю рибосом — «риботоксичний стрес»: блок G1/S і G2/M, пікноз ядер.', art: 'mycotoxins', src: 'Mycotoxins review, 2022' },
  // ---- ціанотоксини
  { id: 'mcylr', name: 'Мікроцистин-LR (<i>Microcystis</i>)', group: 'cyano', unit: 'мкг/мл', min: 0.05, max: 30, def: 3, ec50: 3, n: 1.3, ca: 30, ec50ca: 2.5, mn: 9,
    prof: { cmit: 3, multi: 4, lag: 3, mn: 2 }, phase: 'cmit', rootF: .8, irr: .4, tint: 'rgba(120,180,90,.38)',
    note: 'Інгібує протеїнфосфатази PP1/PP2A (ферменти, що знімають фосфат з білків поділу): гіперконденсація, зірчасті метафази, мультиполярні веретена (Máthé et al., 2013).', art: 'cyanotoxins', src: 'Máthé et al., 2013' },
  { id: 'cyn', name: 'Циліндроспермопсин', group: 'cyano', unit: 'мкг/мл', min: 0.05, max: 30, def: 2, ec50: 2.2, n: 1.4, ca: 26, ec50ca: 2, mn: 11,
    prof: { multi: 4, lag: 3, frag: 2, mn: 2 }, rootF: .7, irr: .5, tint: 'rgba(110,170,110,.35)',
    note: 'Блокує синтез білка, порушує препрофазну стрічку: розщеплення полюсів, втрата хромосом.', art: 'cyanotoxins', src: 'Máthé et al., 2013' },
  // ---- мікробні біопестициди
  { id: 'bt', name: 'Біоінсектицид <i>Bacillus thuringiensis</i>', group: 'biopest', unit: 'КУО/мл', min: 1e4, max: 1e9, def: 1e7, ec50: 3e8, n: 0.8, ca: 12, ec50ca: 2e8, mn: 5,
    prof: { sticky: 3, cmit: 2, bridge: 2, lag: 1 }, rootF: 1, irr: .3, tint: 'rgba(230,225,200,.35)',
    note: 'Дозу задають у КУО/мл (колонієутворювальних одиницях — живих клітинах — на мілілітр). У підвищених дозах (разом з технологічними добавками) знижує MI і викликає аберації, як синтетичні пестициди.', art: 'biopesticides', src: 'MDPI Ecotoxicology' },
  // ---- рослинні екстракти
  { id: 'ehirta', name: 'Екстракт <i>Euphorbia hirta</i>', group: 'extract', unit: 'мкг/мл', min: 50, max: 2000, def: 500, ec50: 1700, n: 0.7, ca: 8, ec50ca: 900, mn: 4,
    prof: { sticky: 3, bridge: 2, cmit: 2, vag: 1, mn: 1 }, rootF: .9, irr: .3, tint: 'rgba(140,150,80,.4)',
    note: 'MI 50,9 → 40,3 → 37,9 → 29,9 % за 0–125–500–1000 мкг/мл (Ping et al., 2012).', art: 'extracts', src: 'Ping et al., 2012' },
  { id: 'chamom', name: 'Настій ромашки лікарської', group: 'extract', unit: 'мг/мл', min: 0.5, max: 50, def: 10, ec50: 900, n: 1, ca: 0.5, ec50ca: 500, mn: 0.2,
    prof: { sticky: 1 }, rootF: 1, irr: 0, dr: { max: 0.25, K: 8, mode: 'aox' }, tint: 'rgba(225,190,90,.35)',
    note: 'У терапевтичних дозах не генотоксичний і не цитотоксичний (Nicuță et al., 2025).', art: 'extracts', src: 'Nicuță et al., 2025' },
  { id: 'propolis', name: 'Зелений прополіс (екстракт)', group: 'extract', unit: 'мкг/мл', min: 1, max: 500, def: 50, ec50: 3000, n: 1, ca: 0.5, ec50ca: 2000, mn: 0.2,
    prof: { sticky: 1 }, rootF: 1, irr: 0, dr: { max: 0.62, K: 25, mode: 'aox' }, tint: 'rgba(190,150,60,.4)',
    note: 'Пригнічує індуковані MMS аберації та мікроядра в меристемі й F1 (Roberto et al., 2016).', art: 'protective', src: 'Roberto et al., 2016' },
  // ---- корисні мікроорганізми
  { id: 'inulin', name: 'Інулін (пребіотик)', group: 'protect', unit: 'мг/мл', min: 0.05, max: 20, def: 2, ec50: 1e4, n: 1, ca: 0, ec50ca: 1e4, mn: 0,
    prof: {}, rootF: 1, irr: 0, dr: { max: 0.66, K: 0.5, mode: 'bio' }, tint: 'rgba(245,245,240,.25)',
    note: 'Без власної токсичності; знижує аберації від MMS на 42,96–64,07 %, найкраще в пост-обробці (Mauro et al., 2014).', art: 'protective', src: 'Mauro et al., 2014' },
  { id: 'bglucan', name: 'β-глюкан <i>Saccharomyces cerevisiae</i>', group: 'protect', unit: 'мг/мл', min: 0.05, max: 20, def: 2, ec50: 1e4, n: 1, ca: 0, ec50ca: 1e4, mn: 0,
    prof: {}, rootF: 1, irr: 0, dr: { max: 0.6, K: 0.6, mode: 'des' }, tint: 'rgba(240,230,205,.3)',
    note: 'Десмутаген і біоантимутаген: адсорбує мутаген і стимулює репарацію ДНК.', art: 'protective', src: 'Mauro et al., 2014' },
  { id: 'chlorella', name: 'Суспензія <i>Chlorella vulgaris</i>', group: 'protect', unit: 'мг/мл', min: 0.05, max: 20, def: 2, ec50: 1e4, n: 1, ca: 0, ec50ca: 1e4, mn: 0,
    prof: {}, rootF: 1, irr: 0, dr: { max: 0.7, K: 1, mode: 'des', chelate: true }, tint: 'rgba(60,150,60,.45)',
    note: 'Хелатує Cu²⁺ і важкі метали хлорофіліном та полісахаридами, відновлює поділ (2022).', art: 'protective', src: 'Chlorella vulgaris in Allium cepa test, 2022' },
  { id: 'lacto', name: 'Ферментат <i>Lactobacillus plantarum</i>', group: 'protect', unit: '%', min: 0.1, max: 20, def: 5, ec50: 1e4, n: 1, ca: 0, ec50ca: 1e4, mn: 0,
    prof: {}, rootF: 1, irr: 0, dr: { max: 0.45, K: 3, mode: 'aox' }, stim: { max: 0.08, K: 4 }, tint: 'rgba(240,235,215,.3)',
    note: 'Бактерії перетворюють глюкозиди на вільний кверцетин — сильніший захист ДНК від оксидативного стресу.', art: 'protective', src: 'Nicuță et al., 2025' },
  { id: 'tricho', name: 'Метаболіти <i>Trichoderma harzianum</i>', group: 'protect', unit: '%', min: 0.1, max: 20, def: 5, ec50: 1e4, n: 1, ca: 0, ec50ca: 1e4, mn: 0,
    prof: {}, rootF: 1, irr: 0, dr: { max: 0.3, K: 4, mode: 'aox' }, stim: { max: 0.32, K: 3, root: 0.35 }, detox: 0.65, tint: 'rgba(170,200,140,.35)',
    note: 'Ауксини (індоліл-3-оцтова кислота, ІОК) і гібереліни — фітогормони росту — прискорюють перехід G1→S і ріст корінців; знешкоджують мікотоксини.', art: 'protective', src: 'Endophytic Fungi, MDPI' },
];
export const byId = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

// Контроль: водопровідна вода (за Fiskesjö), MI 10 %, фази за Matagne (1968): P 50 %, M 16,7 %, A+T 33,3 %
export const CONTROL = { mi: 10, ca: 1.0, mn: 1.3, na: 2.0, v: 0.45, roots: 22 };
export const PHASES0 = { P: 50, M: 16.7, A: 18.3, T: 15 };
export const TAU = 10; // характерний час розвитку ефекту, год (поглинання й розподіл у меристемі)

const hill = (c, e, n) => 1 / (1 + Math.pow(c / e, n));
const sat = (c, e) => c / (c + e);

/** Горметичний множник: пік висотою h за дози c₀, далі згасає, g(c) = (c/c₀)·e^(1 − c/c₀). */
const hormG = (a, c) => a.horm ? 1 + a.horm.h * (c / a.horm.c) * Math.exp(1 - c / a.horm.c) : 1;
/** Відносний MI (частка контролю) для одного чинника: рівняння Хілла × горметичний множник. */
export function relMI(a, c) {
  if (!(c > 0)) return 1;
  return hill(c, a.ec50, a.n) * hormG(a, c);
}
/** Приріст частки аберантних анафаз-телофаз, % (насичення за Хіллом). */
export function addCA(a, c) {
  if (!(c > 0) || !a.ca) return 0;
  const m = Math.min(2, Math.max(1, a.n));
  return a.ca * Math.pow(c, m) / (Math.pow(c, m) + Math.pow(a.ec50ca, m));
}

/**
 * Модель на момент t (год експозиції).
 * sel: [{id, c}], water: 'tap'|'dist', protocol: 'pre'|'sim'|'post', recover: год у чистій воді після експозиції (0 — без відновлення)
 */
export function simulate(sel, { t = 48, water = 'tap', protocol = 'sim', recover = 0 } = {}) {
  const items = sel.map((s) => ({ a: byId[s.id], c: s.c })).filter((x) => x.a && x.c > 0);
  const toxic = items.filter((x) => !x.a.dr), prot = items.filter((x) => x.a.dr);
  const detox = items.reduce((k, x) => k * (x.a.detox ? 1 - x.a.detox * sat(x.c, 3) : 1), 1);
  const effC = (x) => x.a.group === 'myco' ? x.c * detox : x.c;

  // захист: %DR сумарно (незалежні механізми), залежить від схеми обробки
  const PF = { des: { pre: .5, sim: 1, post: .3 }, bio: { pre: .55, sim: .7, post: 1 }, aox: { pre: 1, sim: .75, post: .55 } };
  const dr = 1 - prot.reduce((k, x) => k * (1 - x.a.dr.max * sat(x.c, x.a.dr.K) * PF[x.a.dr.mode][protocol]), 1);
  const chelate = prot.some((x) => x.a.dr.chelate);

  // цитотоксичність: незалежна дія (Блісс)
  let miTox = 1, rootTox = 1, caTox = 0, mnTox = 0, irr = 0, cm = 0, pro = 0, g1s = 0, tumor = 0, brown = 0;
  const prof = {};
  for (const x of toxic) {
    const c = effC(x) * (chelate && x.a.group === 'metal' ? 0.45 : 1);
    const r = relMI(x.a, c);
    miTox *= r;
    rootTox *= hill(c, x.a.ec50 * x.a.rootF, x.a.n) * hormG(x.a, c);
    const add = addCA(x.a, c);
    caTox = 100 - (100 - caTox) * (1 - add / 100);
    mnTox += x.a.mn * sat(c, x.a.ec50ca);
    const sev = 1 - Math.min(1, r);
    irr = Math.max(irr, x.a.irr * sev);
    if (x.a.phase === 'cmit') cm = 1 - (1 - cm) * (1 - sat(c, x.a.ec50ca * 1.2));
    if (x.a.phase === 'pro') pro = Math.max(pro, sat(c, x.a.ec50));
    if (x.a.phase === 'g1s') g1s = Math.max(g1s, sev);
    if (x.a.tumor) tumor = Math.max(tumor, sat(c, x.a.ec50ca * 1.5));
    if (x.a.brown) brown = Math.max(brown, x.a.brown * sat(c, x.a.ec50));
    for (const [k, w] of Object.entries(x.a.prof)) prof[k] = (prof[k] || 0) + w * add;
  }
  let stim = 1, rootStim = 1;
  for (const x of items) if (x.a.stim) { stim *= 1 + x.a.stim.max * sat(x.c, x.a.stim.K); rootStim *= 1 + (x.a.stim.root ?? x.a.stim.max) * sat(x.c, x.a.stim.K); }

  // захист знижує аберації й частково відновлює поділ
  const caT = caTox * (1 - dr), mnT = mnTox * (1 - dr);
  miTox = 1 - (1 - Math.min(miTox, 1)) * (1 - 0.6 * dr) + Math.max(0, miTox - 1);
  rootTox = 1 - (1 - Math.min(rootTox, 1)) * (1 - 0.5 * dr) + Math.max(0, rootTox - 1);

  const w0 = water === 'dist' ? 0.86 : 1; // бідистилят без Ca²⁺ і Mg²⁺ знижує MI (Şuţan et al., 2016)
  const miRelInf = Math.max(0, miTox * stim);
  const k = 1 - Math.exp(-t / TAU);
  let miRel = (1 - (1 - miRelInf) * k) * (1 + 0.45 * cm * k); // К-мітоз накопичує метафази
  let caAdd = caT * k, mnAdd = mnT * k;
  // відновлення в чистій воді: оборотна частина ефекту зникає з часом τ_r = 16 год, незворотна (irr) лишається
  if (recover > 0) {
    const kr = 1 - Math.exp(-recover / 16);
    const keep = irr + (1 - irr) * (1 - kr);
    miRel = 1 - (1 - miRel) * keep;
    caAdd *= irr + (1 - irr) * (1 - kr * 0.8);
    mnAdd *= 1 + 0.35 * kr * (1 - irr); // фрагменти першого мітозу стають мікроядрами в наступному циклі
  }
  const mi = Math.max(0, CONTROL.mi * w0 * miRel);
  const ca = Math.min(99, CONTROL.ca + caAdd);
  const mn = CONTROL.mn + mnAdd;
  const na = CONTROL.na + 0.6 * mnAdd + 6 * (1 - Math.min(1, miRel)) * k;

  // фазові індекси
  const kk = k * (recover > 0 ? Math.exp(-recover / 16) : 1);
  let P = PHASES0.P * (1 + 0.9 * pro * kk), M = PHASES0.M * (1 + 3.2 * cm * kk), A = PHASES0.A * (1 - 0.92 * cm * kk), T = PHASES0.T * (1 - 0.85 * cm * kk);
  const sum = P + M + A + T;
  P = 100 * P / sum; M = 100 * M / sum; A = 100 * A / sum; T = 100 * T / sum;

  // ріст корінців (мм): інтеграл швидкості з наростанням ефекту за τ
  const g = Math.max(0, rootTox * rootStim * w0);
  const lenAt = (tt) => CONTROL.v * (tt - (1 - g) * (tt - TAU * (1 - Math.exp(-tt / TAU))));
  let len = 8 + lenAt(t);
  if (recover > 0) {
    const gEnd = 1 - (1 - g) * k, gR = 1 - (1 - gEnd) * (irr + (1 - irr) * Math.exp(-recover / 16));
    len += CONTROL.v * recover * (gEnd + gR) / 2;
  }
  const roots = Math.max(3, Math.round(CONTROL.roots * Math.min(1.15, Math.pow(Math.min(1.2, g), 0.6))));

  // розподіл типів аберацій (нормований)
  const tot = Object.values(prof).reduce((s, v) => s + v, 0);
  const mix = {};
  if (tot > 0) for (const [kk2, v] of Object.entries(prof)) mix[kk2] = v / tot;
  else Object.assign(mix, { bridge: .35, frag: .3, sticky: .2, vag: .15 });

  const verdict = miRel < 0.22 ? 'lethal' : miRel < 0.5 ? 'sublethal' : cm * kk > 0.25 ? 'cmit' : miRel > 1.08 && ca < CONTROL.ca + 2 ? 'stim' : 'ok';
  return {
    mi, miRel, ca, mn, na, len, roots, phases: { P, M, A, T }, mix, dr: dr * 100, protected: prot.length > 0 && toxic.some((x) => addCA(x.a, x.c) > 0),
    tumor: tumor * k, brown: brown * k, verdict, irr, cm: cm * kk, k,
  };
}

/** Концентрація, за якої відносний MI = 0,5 (для гормезису — праворуч від максимуму), бісекція в лог-шкалі. */
export function ec50MI(a, opts = {}) {
  const f = (c) => simulate([{ id: a.id, c }], { ...opts, t: 1e4 }).miRel - 0.5;
  let lo = Math.log10(a.min) - 2, hi = Math.log10(a.max) + 3;
  if (f(10 ** hi) > 0) return null;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(10 ** m) > 0) lo = m; else hi = m; }
  return 10 ** ((lo + hi) / 2);
}

/** Детермінований генератор псевдовипадкових чисел (mulberry32). */
export function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const binom = (R, n, p) => { // нормальне наближення для великих n, точне для малих
  if (n * p * (1 - p) > 25) { const u = Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R()); return Math.max(0, Math.min(n, Math.round(n * p + u * Math.sqrt(n * p * (1 - p))))); }
  let k = 0; for (let i = 0; i < n; i++) if (R() < p) k++; return k;
};

/** «Підрахунок під мікроскопом»: N клітин (5 препаратів × 1000) і до nAT анафаз-телофаз;
 *  анафази-телофази добирають з додаткових препаратів загалом до poolAT клітин (як у анафазо-телофазному тесті). */
export function count(res, seed, { N = 5000, nAT = 300, poolAT = N } = {}) {
  const R = rand(seed);
  const div = binom(R, N, res.mi / 100);
  const ph = res.phases, p = {};
  p.P = binom(R, div, ph.P / 100);
  p.M = binom(R, div - p.P, ph.M / Math.max(1e-9, ph.M + ph.A + ph.T));
  p.A = binom(R, div - p.P - p.M, ph.A / Math.max(1e-9, ph.A + ph.T));
  p.T = div - p.P - p.M - p.A;
  const atPool = poolAT > N ? binom(R, poolAT, res.mi / 100 * (ph.A + ph.T) / 100) : p.A + p.T;
  const nScored = Math.min(nAT, Math.max(p.A + p.T, atPool));
  const aberr = binom(R, nScored, res.ca / 100);
  const mn = binom(R, N - div, res.mn / 1000);
  return { N, div, I: N - div, ...p, nAT: nScored, aberr, mn };
}

/** χ²-критерій 2×2 (з поправкою Єйтса): чи відрізняється частка аберантних A–T від контролю. */
export function chi2(a1, n1, a2, n2) {
  const b1 = n1 - a1, b2 = n2 - a2, n = n1 + n2;
  if (!n1 || !n2) return { chi: 0, p: 1 };
  const num = n * Math.pow(Math.max(0, Math.abs(a1 * b2 - a2 * b1) - n / 2), 2);
  const den = (a1 + a2) * (b1 + b2) * n1 * n2;
  const chi = den > 0 ? num / den : 0;
  // p для 1 ст. свободи: p = erfc(√(χ²/2))
  const x = Math.sqrt(chi / 2), tt = 1 / (1 + 0.5 * x);
  const erfc = tt * Math.exp(-x * x - 1.26551223 + tt * (1.00002368 + tt * (0.37409196 + tt * (0.09678418 + tt * (-0.18628806 + tt * (0.27886807 + tt * (-1.13520398 + tt * (1.48851587 + tt * (-0.82215223 + tt * 0.17087277)))))))));
  return { chi, p: Math.min(1, erfc) };
}
