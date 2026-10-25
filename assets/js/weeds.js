// Бур'яни України: фото й карти поширення у світі (заздалегідь завантажені з iNaturalist і GBIF), фільтри та пошук.
(function () {
  'use strict';
  var root = document.getElementById('wua-weeds');
  if (!root) return;
  var DATA = {};
  try { DATA = JSON.parse(document.getElementById('wua-data').textContent); } catch (e) {}
  var IMG = root.getAttribute('data-img') || 'img/';

  /* ---------- Карта світу: щільність знахідок GBIF (зображення підготовлено заздалегідь); показуємо всю карту, поля — колір океану ---------- */
  var TS = 256, Z_W = 1;
  function my(lat, z) { var r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * TS * Math.pow(2, z); }
  var WV = (function () { var y0 = my(80, Z_W), y1 = my(-58, Z_W); return { x: 0, y: y0, w: TS * 2, h: y1 - y0 }; })();
  function vb(v) { return [v.x, v.y, v.w, v.h].map(function (n) { return n.toFixed(1); }).join(' '); }
  function svgWorld(n, has, label) {
    return '<svg class="wua-svg" viewBox="' + vb(WV) + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + label + '">' +
      '<rect x="0" y="' + WV.y + '" width="' + WV.w + '" height="' + WV.h + '" fill="#cfcfcf"/>' +
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
    var g = d.gbif;

    function drawMap() {
      mf.innerHTML = svgWorld(n, !!(g && d.mw), 'Карта знахідок: ' + uk + ' у світі');
      mf.classList.remove('is-loading');
      if (!g) mc.textContent = 'Дані GBIF недоступні.';
      else mc.innerHTML = 'Щільність знахідок за <a href="https://www.gbif.org/species/' + g.key + '" target="_blank" rel="noopener">GBIF</a>: ' + fmt(g.all) + ' записів у світі';
    }
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
