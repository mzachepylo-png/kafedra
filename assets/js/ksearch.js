// Пошук по конспекту: статті, розділи, хвороби, бур'яни, амінокислоти, ферменти.
(function () {
  var input = document.getElementById('ksearch');
  var data = document.getElementById('k-index');
  if (!input || !data) return;
  var idx = JSON.parse(data.textContent);
  var list = document.getElementById('kresults');
  var count = document.getElementById('ksearch-count');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.kcard'));
  var norm = function (s) { return String(s).toLowerCase().replace(/[’ʼ`]/g, "'").replace(/ё/g, 'е'); };
  idx.forEach(function (e) { e._t = norm(e.t); e._all = norm(e.t + ' ' + (e.s || '') + ' ' + e.k + ' ' + e.a); });
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function mark(text, toks) {
    var out = esc(text);
    toks.forEach(function (t) {
      if (t.length < 2) return;
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }
  function run() {
    var q = norm(input.value.trim());
    var toks = q.split(/\s+/).filter(Boolean);
    if (!toks.length) {
      list.hidden = true; list.innerHTML = ''; count.textContent = '';
      cards.forEach(function (c) { c.hidden = false; });
      return;
    }
    var hits = [];
    idx.forEach(function (e) {
      var ok = toks.every(function (t) { return e._all.indexOf(t) !== -1; });
      if (!ok) return;
      var sc = 0;
      toks.forEach(function (t) {
        if (e._t.indexOf(t) === 0) sc += 6; else if (e._t.indexOf(t) !== -1) sc += 4;
        if (new RegExp('(^|[\\s(«-])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(e._t)) sc += 2;
      });
      if (e.top) sc += 1;
      hits.push({ e: e, sc: sc });
    });
    hits.sort(function (a, b) { return b.sc - a.sc; });
    var arts = {};
    hits.forEach(function (h) { arts[h.e.u.split('/')[0]] = true; });
    cards.forEach(function (c) { c.hidden = !arts[c.getAttribute('href').split('/')[0]]; });
    count.textContent = hits.length ? 'Знайдено: ' + hits.length : 'Нічого не знайдено';
    list.innerHTML = hits.slice(0, 14).map(function (h) {
      var e = h.e;
      return '<li><a href="' + e.u + '"><span class="kresults__a">' + esc(e.a) + '</span><b>' + mark(e.t, toks) + '</b>' +
        (e.s ? '<small>' + mark(e.s, toks) + '</small>' : '') + '</a></li>';
    }).join('') + (hits.length > 14 ? '<li class="kresults__more">…ще ' + (hits.length - 14) + '. Уточніть запит.</li>' : '');
    list.hidden = !hits.length;
  }
  var t = 0;
  input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 80); });
  document.querySelectorAll('#ksearch-tags button').forEach(function (b) {
    b.addEventListener('click', function () { input.value = b.textContent; run(); input.focus(); });
  });
  var q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q; run(); }
})();
