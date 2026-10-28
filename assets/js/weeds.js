// Бур'яни України: фото й карти поширення у світі (заздалегідь завантажені з iNaturalist і GBIF) і навігація по видах.
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

  /* ---------- Бічна навігація: поточний вид, прогрес, висувна панель на телефоні ---------- */
  var nav = document.getElementById('wua-nav');
  var links = nav.querySelectorAll('.wua-nav__list a'), list = nav.querySelector('.wua-nav__list');
  var bar = nav.querySelector('.wua-nav__prog i'), curEl = nav.querySelector('[data-cur]');
  var fab = root.querySelector('.wua-fab'), scrim = root.querySelector('.wua-scrim');
  var cur = -2, ticking = false;
  function spy() {
    ticking = false;
    var line = Math.min(220, innerHeight * 0.3), idx = -1;
    for (var i = 0; i < cardsEls.length; i++) { if (cardsEls[i].getBoundingClientRect().top <= line) idx = i; else break; }
    if (idx === cur) return;
    cur = idx;
    Array.prototype.forEach.call(links, function (a, k) { a.classList.toggle('is-cur', k === idx); a.classList.toggle('is-seen', k < idx); });
    curEl.textContent = idx < 0 ? '—' : idx + 1;
    bar.style.width = (idx < 0 ? 0 : (idx + 1) / cardsEls.length * 100) + '%';
    if (idx >= 0 && list.scrollHeight > list.clientHeight) {
      var a = links[idx], top = a.offsetTop - list.offsetTop;
      if (top < list.scrollTop + 20 || top + a.offsetHeight > list.scrollTop + list.clientHeight - 20) list.scrollTop = top - list.clientHeight / 3;
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
  spy();
  function setOpen(on) {
    nav.classList.toggle('is-open', on); scrim.hidden = !on; fab.setAttribute('aria-expanded', on);
    document.documentElement.style.overflow = on ? 'hidden' : '';
  }
  fab.addEventListener('click', function () { setOpen(true); });
  scrim.addEventListener('click', function () { setOpen(false); });
  nav.querySelector('.wua-nav__x').addEventListener('click', function () { setOpen(false); });
  list.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
})();
