// Бур'яни України: фото й карти поширення (заздалегідь завантажені з iNaturalist і GBIF), фільтри та пошук.
(function () {
  'use strict';
  var root = document.getElementById('wua-weeds');
  if (!root) return;
  var DATA = {};
  try { DATA = JSON.parse(document.getElementById('wua-data').textContent); } catch (e) {}
  var IMG = root.getAttribute('data-img') || 'img/';

  /* ---------- Геометрія: контур України (міжнародно визнані кордони, спрощено), Дніпро, міста ---------- */
  var UA = [[23.61,51.51],[23.98,51.59],[24.39,51.88],[24.9,51.9],[25.6,51.93],[26.2,51.86],[26.8,51.77],[27.3,51.62],[27.8,51.58],[28.3,51.56],[28.75,51.43],[29.2,51.39],[29.6,51.48],[30.25,51.48],[30.55,51.4],[30.6,51.65],[30.75,51.9],[31.1,52.08],[31.5,52.1],[31.78,52.1],[32.1,52.05],[32.4,52.27],[32.9,52.26],[33.2,52.37],[33.55,52.3],[33.85,52.05],[34.15,51.75],[34.35,51.65],[34.25,51.35],[34.7,51.2],[35.1,51.15],[35.4,50.75],[35.55,50.38],[36.1,50.43],[36.6,50.27],[37.0,50.37],[37.45,50.3],[37.75,50.1],[38.1,49.95],[38.3,50.05],[38.7,49.95],[39.2,49.85],[39.65,49.62],[40.1,49.6],[40.22,49.25],[40.05,49.0],[39.85,48.7],[39.85,48.4],[39.75,48.05],[39.3,47.85],[38.85,47.85],[38.35,47.6],[38.22,47.1],[37.9,47.08],[37.55,47.07],[37.25,46.95],[36.95,46.78],[36.8,46.75],[36.76,46.62],[36.7,46.73],[36.35,46.72],[36.15,46.56],[36.0,46.62],[35.6,46.53],[35.35,46.38],[35.25,46.22],[35.0,46.27],[34.82,46.17],[34.6,46.12],[34.45,46.02],[34.2,46.12],[33.95,46.17],[33.78,46.12],[33.85,45.95],[34.1,45.85],[34.5,45.78],[34.9,45.6],[35.2,45.4],[35.45,45.3],[35.75,45.45],[36.1,45.47],[36.45,45.42],[36.62,45.36],[36.6,45.2],[36.45,45.08],[36.0,45.05],[35.8,44.98],[35.45,45.05],[35.38,45.03],[35.2,44.93],[34.98,44.83],[34.65,44.8],[34.42,44.67],[34.25,44.55],[34.17,44.49],[33.95,44.42],[33.75,44.39],[33.6,44.5],[33.38,44.58],[33.53,44.75],[33.58,44.95],[33.6,45.1],[33.37,45.19],[32.95,45.35],[32.5,45.35],[32.7,45.52],[32.95,45.62],[33.2,45.78],[33.45,45.95],[33.62,46.08],[33.4,46.12],[33.0,46.1],[32.6,46.08],[32.3,46.12],[32.1,46.2],[31.75,46.35],[31.55,46.5],[31.5,46.57],[31.53,46.62],[31.3,46.62],[31.0,46.6],[30.75,46.5],[30.75,46.35],[30.55,46.15],[30.25,45.9],[29.95,45.75],[29.75,45.6],[29.7,45.4],[29.75,45.35],[29.6,45.4],[29.3,45.43],[29.0,45.33],[28.84,45.35],[28.5,45.3],[28.3,45.42],[28.21,45.47],[28.45,45.6],[28.55,45.8],[28.75,46.0],[28.95,46.3],[29.2,46.48],[29.6,46.37],[30.05,46.4],[30.12,46.45],[29.98,46.62],[29.85,46.9],[29.62,47.3],[29.35,47.6],[29.15,47.9],[28.85,48.1],[28.3,48.22],[27.8,48.45],[27.58,48.47],[27.2,48.36],[26.66,48.27],[26.35,48.15],[26.0,48.03],[25.55,47.95],[25.2,47.8],[24.9,47.72],[24.6,47.93],[24.2,47.92],[23.85,47.95],[23.5,48.0],[23.2,48.1],[22.89,48.0],[22.75,48.08],[22.6,48.2],[22.42,48.25],[22.15,48.4],[22.25,48.65],[22.4,48.9],[22.57,49.08],[22.75,49.15],[22.7,49.5],[22.95,49.8],[23.3,50.1],[23.65,50.35],[24.05,50.47],[24.1,50.85],[23.95,51.1],[23.7,51.4]];
  var DNIPRO = [[30.55,51.4],[30.55,51.0],[30.55,50.45],[30.95,50.1],[31.45,49.75],[32.05,49.43],[32.6,49.2],[33.4,49.07],[34.1,48.85],[34.6,48.5],[35.05,48.46],[35.15,47.85],[34.6,47.6],[34.0,47.3],[33.4,46.85],[33.0,46.75],[32.6,46.63],[32.2,46.55],[31.75,46.56]];
  var CITIES = [['Київ',30.52,50.45,1],['Львів',24.03,49.84,1],['Харків',36.23,49.99,-1],['Одеса',30.73,46.48,1],['Дніпро',35.05,48.46,1],['Сімферополь',34.1,44.95,1],['Ужгород',22.29,48.62,1]];

  var TS = 256;
  function mx(lon, z) { return (lon + 180) / 360 * TS * Math.pow(2, z); }
  function my(lat, z) { var r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * TS * Math.pow(2, z); }
  function pathD(pts, z, close) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + mx(p[0], z).toFixed(1) + ' ' + my(p[1], z).toFixed(1); }).join('') + (close ? 'Z' : '');
  }

  /* Вікно карти 4:3 навколо України (те саме, що й під час підготовки зображень) */
  var Z_UA = 5;
  var UAV = (function () {
    var x0 = mx(21.7, Z_UA), x1 = mx(40.7, Z_UA), y0 = my(52.7, Z_UA), y1 = my(44.1, Z_UA);
    var w = x1 - x0, h = w * 3 / 4, cy = (y0 + y1) / 2;
    return { x: x0, y: cy - h / 2, w: w, h: h };
  })();
  var UA_D = pathD(UA, Z_UA, true);
  var DN_D = pathD(DNIPRO, Z_UA, false);
  var Z_W = 1;
  var WV = (function () { var y0 = my(80, Z_W), y1 = my(-58, Z_W); return { x: 0, y: y0, w: TS * 2, h: y1 - y0 }; })();
  function vb(v) { return [v.x, v.y, v.w, v.h].map(function (n) { return n.toFixed(1); }).join(' '); }

  var uid = 0;
  function svgUA(n, has, label) {
    var id = 'wua-m' + (++uid);
    var img = has ? '<image href="' + IMG + 'ua/' + n + '.webp" x="' + UAV.x.toFixed(1) + '" y="' + UAV.y.toFixed(1) + '" width="' + UAV.w.toFixed(1) + '" height="' + UAV.h.toFixed(1) + '" preserveAspectRatio="none"/>' : '';
    var cities = CITIES.map(function (c) {
      var x = mx(c[1], Z_UA), y = my(c[2], Z_UA), right = c[3] > 0;
      return '<circle class="city" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.6"/>' +
        '<text class="city-l" x="' + (x + (right ? 3.2 : -3.2)).toFixed(1) + '" y="' + (y + 2.8).toFixed(1) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + c[0] + '</text>';
    }).join('');
    return '<svg class="wua-svg" viewBox="' + vb(UAV) + '" role="img" aria-label="' + label + '">' +
      '<defs><mask id="' + id + '" maskUnits="userSpaceOnUse" x="' + UAV.x + '" y="' + UAV.y + '" width="' + UAV.w + '" height="' + UAV.h + '">' +
      '<rect x="' + UAV.x + '" y="' + UAV.y + '" width="' + UAV.w + '" height="' + UAV.h + '" fill="#3a3a3a"/><path d="' + UA_D + '" fill="#fff"/></mask></defs>' +
      '<path class="ua-fill" d="' + UA_D + '"/>' +
      '<g mask="url(#' + id + ')">' + img + '</g>' +
      '<path class="river" d="' + DN_D + '"/>' +
      '<path class="ua-line" d="' + UA_D + '"/>' + cities +
      '<text class="note" x="' + (UAV.x + 6) + '" y="' + (UAV.y + UAV.h - 6) + '">Дані: GBIF.org · контур спрощено</text></svg>';
  }
  function svgWorld(n, has, label) {
    return '<svg class="wua-svg" viewBox="' + vb(WV) + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + label + '">' +
      '<rect x="0" y="' + WV.y + '" width="' + WV.w + '" height="' + WV.h + '" fill="#e9eef0"/>' +
      (has ? '<image href="' + IMG + 'world/' + n + '.webp" x="0" y="' + WV.y.toFixed(1) + '" width="' + WV.w + '" height="' + WV.h.toFixed(1) + '" preserveAspectRatio="none"/>' : '') + '</svg>';
  }

  var LIC = { 'cc0': 'CC0', 'cc-by': 'CC BY', 'cc-by-sa': 'CC BY-SA', 'cc-by-nc': 'CC BY-NC', 'cc-by-nc-sa': 'CC BY-NC-SA', 'cc-by-nd': 'CC BY-ND', 'cc-by-nc-nd': 'CC BY-NC-ND' };
  function fmt(n) { return n == null ? '—' : n.toLocaleString('uk-UA'); }
  function escA(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // «(c) Ім'я, деякі права захищені (CC BY-NC)» → «Ім'я»
  function author(a) {
    var t = String(a || '').replace(/\s+/g, ' ').trim(), up = t.match(/uploaded by (.+)$/i);
    t = t.replace(/^\(c\)\s*/i, '').replace(/,?\s*(some|all|no) rights reserved.*$/i, '').trim();
    return t || (up ? up[1] : 'автор невідомий');
  }

  /* ---------- Картки ---------- */
  function initCard(card) {
    if (card._wua) return; card._wua = true;
    var n = card.id.replace('wua-sp-', '');
    var d = DATA[n] || {};
    var names = card.getAttribute('data-names').split('|');
    var uk = card.getAttribute('data-uk');
    var pf = card.querySelector('.wua-frame--photo'), pc = card.querySelector('.wua-cap--photo');
    var mf = card.querySelector('.wua-frame--map'), mc = card.querySelector('.wua-count');
    var tabs = card.querySelectorAll('.wua-maptabs button');
    var g = d.gbif, view = 'ua';

    function drawMap() {
      var label = 'Карта знахідок: ' + uk + (view === 'ua' ? ' в Україні' : ' у світі');
      mf.innerHTML = view === 'ua' ? svgUA(n, !!(g && d.mu), label) : svgWorld(n, !!(g && d.mw), label);
      mf.classList.remove('is-loading');
      if (!g) mc.textContent = 'Дані GBIF недоступні — показано лише контур.';
      else mc.innerHTML = 'Щільність знахідок за <a href="https://www.gbif.org/species/' + g.key + '" target="_blank" rel="noopener">GBIF</a>: ' +
        (view === 'ua' ? fmt(g.ua) + ' записів в Україні' : fmt(g.all) + ' записів у світі');
    }
    Array.prototype.forEach.call(tabs, function (b) {
      b.addEventListener('click', function () {
        view = b.getAttribute('data-view');
        Array.prototype.forEach.call(tabs, function (o) { var on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-selected', on); });
        drawMap();
      });
    });
    drawMap();

    var p = d.photo;
    if (p) {
      var src = IMG + 'photo/' + n + '.webp';
      var a = document.createElement('a');
      a.href = src;
      a.setAttribute('data-lightbox', '');
      a.setAttribute('aria-label', 'Відкрити фото в повному розмірі');
      a.setAttribute('data-caption', uk + ' (' + names[0] + '). Фото: ' + author(p.attr) + ' · iNaturalist · ' + (LIC[p.lic] || p.lic));
      var img = new Image();
      img.alt = uk + ' (' + names[0] + ')';
      img.decoding = 'async';
      img.width = p.w; img.height = p.h;
      img.onload = function () { pf.classList.remove('is-loading'); };
      img.onerror = function () { pf.classList.remove('is-loading'); pf.innerHTML = '<span class="wua-ph"><i>' + escA(names[0]) + '</i><small>фото не завантажилось</small></span>'; };
      img.src = src;
      a.appendChild(img);
      pf.innerHTML = ''; pf.appendChild(a);
      pc.innerHTML = 'Фото: ' + escA(author(p.attr)) + ' · <a href="' + escA(p.photo || p.link) + '" target="_blank" rel="noopener">iNaturalist</a> · ' + escA(LIC[p.lic] || p.lic);
    } else {
      pf.classList.remove('is-loading');
      pf.innerHTML = '<span class="wua-ph"><i>' + escA(names[0]) + '</i><small>фото тимчасово недоступне</small></span>';
      pc.innerHTML = '<a href="https://www.inaturalist.org/search?q=' + encodeURIComponent(names[0]) + '" target="_blank" rel="noopener">Переглянути фото на iNaturalist</a>';
    }
  }

  var cardsEls = Array.prototype.slice.call(root.querySelectorAll('.wua-card'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); initCard(e.target); } });
    }, { rootMargin: '600px 0px' });
    cardsEls.forEach(function (c) { io.observe(c); });
  } else cardsEls.forEach(initCard);

  /* ---------- Фільтри та пошук ---------- */
  var chips = root.querySelectorAll('.wua-chip'), input = root.querySelector('.wua-search input');
  var shown = root.querySelector('.wua-shown'), empty = root.querySelector('.wua-empty');
  var idx = root.querySelectorAll('.wua-index li');
  var group = 'all';
  function apply() {
    var s = (input.value || '').trim().toLowerCase(), n = 0;
    cardsEls.forEach(function (c, i) {
      var ok = (group === 'all' || (' ' + c.getAttribute('data-groups') + ' ').indexOf(' ' + group + ' ') > -1) &&
               (!s || c.getAttribute('data-search').indexOf(s) > -1);
      c.hidden = !ok; if (ok) n++;
      if (idx[i]) idx[i].classList.toggle('is-hidden', !ok);
    });
    shown.textContent = 'Показано ' + n + ' з ' + cardsEls.length;
    empty.hidden = n > 0;
  }
  Array.prototype.forEach.call(chips, function (b) {
    b.addEventListener('click', function () {
      group = b.getAttribute('data-group');
      Array.prototype.forEach.call(chips, function (o) { var on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', on); });
      apply();
    });
  });
  input.addEventListener('input', apply);
  apply();
})();
