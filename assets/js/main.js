// Спільна поведінка сторінок: мобільне меню, рік у футері, поява блоків під час прокрутки,
// підсвічування активного пункту підменю та вкладки.
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      var pop = document.getElementById('report-pop');
      if (pop && !pop.hidden) return; // спершу Esc закриває підказку «Повідомити про проблему»
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  // «Повідомити про проблему»: підказка з посиланням на Facebook
  var repBtn = document.querySelector('.report__btn');
  var repPop = document.getElementById('report-pop');
  if (repBtn && repPop) {
    var setRep = function (open) {
      repPop.hidden = !open;
      repBtn.setAttribute('aria-expanded', String(open));
    };
    repBtn.addEventListener('click', function () { setRep(repPop.hidden); });
    document.addEventListener('click', function (e) {
      if (!repPop.hidden && !e.target.closest('.report')) setRep(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !repPop.hidden) { setRep(false); repBtn.focus(); }
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // Поява блоків
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Декоративні анімації працюють лише у видимій області
  var anims = document.querySelectorAll('[data-anim]');
  if (anims.length && 'IntersectionObserver' in window) {
    var aio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-off', !en.isIntersecting); });
    });
    anims.forEach(function (el) { aio.observe(el); });
  }

  // Підменю та зміст: активний розділ
  document.querySelectorAll('.subnav, .toc').forEach(function (group) {
    var links = group.querySelectorAll('a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) {
      var s = document.getElementById(a.getAttribute('href').slice(1));
      if (s) map[s.id] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        var a = map[en.target.id];
        if (a) {
          a.classList.add('is-active');
          if (group.classList.contains('subnav')) {
            var c = a.parentNode;
            c.scrollLeft = a.offsetLeft - (c.clientWidth - a.offsetWidth) / 2;
          }
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) { spy.observe(document.getElementById(id)); });
  });

  // Вкладки (WAI-ARIA tabs)
  document.querySelectorAll('[data-tabs]').forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length, j = null;
        if (k === 'ArrowRight') j = (i + 1) % n;
        else if (k === 'ArrowLeft') j = (i - 1 + n) % n;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = n - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    var initial = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    if (initial) select(initial);
  });
})();
