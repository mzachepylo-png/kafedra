// Онлайн лабораторія доступна лише з комп'ютера: на телефонах і планшетах замість моделей показуємо повідомлення.
(function () {
  var ua = navigator.userAgent || '';
  var mobile = (navigator.userAgentData && navigator.userAgentData.mobile) ||
    /Android|iPhone|iPad|iPod|Mobi|Windows Phone|Opera Mini|IEMobile/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPadOS видає себе за Mac
  if (!mobile) return;
  document.documentElement.classList.add('lab-locked');

  var home = document.currentScript ? document.currentScript.src.replace(/assets\/js\/desktop-only\.js.*$/, '') : '/';
  function show() {
    var main = document.getElementById('main');
    if (!main || document.querySelector('.lab-lock')) return;
    var s = document.createElement('section');
    s.className = 'page-hero page-hero--lab lab-lock';
    s.innerHTML =
      '<div class="bg-molecules" aria-hidden="true" style="position:absolute;inset:0"></div>' +
      '<div class="container">' +
      '<span class="lab-lock__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span>' +
      '<span class="kicker">Онлайн лабораторія</span>' +
      '<h1>Лабораторія доступна лише з комп’ютера</h1>' +
      '<p>Інтерактивні моделі розраховані на великий екран, мишу та клавіатуру, тому на телефонах і планшетах їх вимкнено. Відкрийте цю сторінку на ПК або ноутбуці.</p>' +
      '<div class="lab-lock__actions">' +
      '<button class="btn btn--gold" type="button" data-copy>Скопіювати посилання</button>' +
      '<a class="btn btn--green" href="' + home + 'konspekt/">Перейти до «Конспекту»</a>' +
      '<a class="btn btn--ghost-light" href="' + home + '">На головну</a>' +
      '</div></div>';
    main.insertBefore(s, main.firstChild);
    var b = s.querySelector('[data-copy]');
    b.addEventListener('click', function () {
      var done = function () { b.textContent = 'Посилання скопійовано'; };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () {});
      else { var t = document.createElement('textarea'); t.value = location.href; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('readystatechange', function () { if (document.readyState !== 'loading') show(); });
  else show();
})();
