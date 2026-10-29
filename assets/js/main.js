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
    // Дотик поза відкритим мобільним меню закриває його
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !e.target.closest('#site-nav, .nav-toggle')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    // Сенсорні планшети (немає наведення): перший дотик на «Про кафедру» відкриває підменю, другий — переходить
    var noHover = window.matchMedia('(hover: none)');
    nav.querySelectorAll('.nav__dd > .nav__link').forEach(function (link) {
      var dd = link.parentNode;
      link.addEventListener('click', function (e) {
        if (!noHover.matches || getComputedStyle(toggle).display !== 'none') return; // мобільне меню показує підменю відкритим
        if (!dd.classList.contains('is-open')) { e.preventDefault(); dd.classList.add('is-open'); link.setAttribute('aria-expanded', 'true'); }
      });
    });
    document.addEventListener('click', function (e) {
      nav.querySelectorAll('.nav__dd.is-open').forEach(function (dd) {
        if (!dd.contains(e.target)) { dd.classList.remove('is-open'); dd.firstElementChild.setAttribute('aria-expanded', 'false'); }
      });
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

  // «ПК-версія сайту» на телефонах і планшетах: вибір зберігається, сторінка перезавантажується
  var desktopView = document.documentElement.classList.contains('force-desktop');
  document.querySelectorAll('[data-view-switch]').forEach(function (b) {
    var l = b.querySelector('[data-view-label]'); if (l) l.textContent = desktopView ? 'Мобільна версія сайту' : 'ПК-версія сайту';
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-view-switch]')) return;
    try { if (desktopView) localStorage.removeItem('kf-view'); else localStorage.setItem('kf-view', 'desktop'); } catch (err) {}
    // спершу змінюємо масштаб, щоб після перезавантаження браузер не відновив попередній
    var vp = document.querySelector('meta[name=viewport]');
    if (vp) vp.setAttribute('content', desktopView ? 'width=device-width, initial-scale=1' : 'width=1280');
    setTimeout(function () { location.reload(); }, 60);
  });

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

  // Підменю: активний розділ
  document.querySelectorAll('.subnav').forEach(function (group) {
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
          var c = a.parentNode;
          c.scrollLeft = a.offsetLeft - (c.clientWidth - a.offsetWidth) / 2;
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) { spy.observe(document.getElementById(id)); });
  });

  // Зміст збоку: активний пункт (розділ або підрозділ) за позицією прокрутки;
  // довгий зміст прокручується всередині власної колонки слідом за активним пунктом
  document.querySelectorAll('.toc').forEach(function (toc) {
    var items = [];
    toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var s = document.getElementById(a.getAttribute('href').slice(1));
      if (s) items.push({ a: a, s: s, parent: a.closest('.toc__sub') ? a.closest('li').parentNode.parentNode.querySelector(':scope > a') : null });
    });
    if (!items.length) return;
    var cur = null, ticking = false;
    function line() { return window.innerHeight * 0.32; }
    function update() {
      ticking = false;
      var best = items[0], atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atEnd) best = items[items.length - 1];
      else items.forEach(function (it) { if (it.s.getBoundingClientRect().top <= line()) best = it; });
      if (best === cur) return;
      cur = best;
      toc.querySelectorAll('a.is-active, a.is-parent').forEach(function (a) { a.classList.remove('is-active', 'is-parent'); });
      best.a.classList.add('is-active');
      if (best.parent) best.parent.classList.add('is-parent');
      if (toc.scrollHeight > toc.clientHeight + 2 && toc.offsetParent !== null) {
        var t = best.a.getBoundingClientRect(), r = toc.getBoundingClientRect();
        if (t.top < r.top + 40 || t.bottom > r.bottom - 24) toc.scrollTop += (t.top - r.top) - toc.clientHeight / 2 + t.height / 2;
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
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
