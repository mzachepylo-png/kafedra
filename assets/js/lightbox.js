// Перегляд фото в повному розмірі: посилання з атрибутом data-lightbox відкриваються у вікні поверх сторінки.
(function () {
  var links = [].slice.call(document.querySelectorAll('a[data-lightbox]'));
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  var dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Перегляд фото');
  dlg.innerHTML =
    '<figure class="lightbox__fig"><img alt=""><figcaption class="lightbox__cap"></figcaption></figure>' +
    '<button class="lightbox__btn lightbox__close" type="button" aria-label="Закрити">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
    '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Попереднє фото">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>' +
    '<button class="lightbox__btn lightbox__next" type="button" aria-label="Наступне фото">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>';
  document.body.appendChild(dlg);

  var img = dlg.querySelector('img');
  var cap = dlg.querySelector('figcaption');
  var cur = null;

  // розмір: вписати у вікно, але не збільшувати більш ніж удвічі від справжнього
  function fit() {
    if (!img.naturalWidth) return;
    var r = img.naturalWidth / img.naturalHeight;
    var w = Math.min(innerWidth * 0.94, innerHeight * 0.8 * r, img.naturalWidth * 2);
    img.style.width = Math.round(w) + 'px';
  }
  img.addEventListener('load', fit);
  addEventListener('resize', function () { if (dlg.open) fit(); });

  function show(a) {
    var thumb = a.querySelector('img');
    cur = a;
    img.style.width = '';
    img.alt = thumb ? thumb.alt : '';
    img.src = a.href;
    cap.textContent = a.getAttribute('data-caption') || img.alt;
  }
  // гортаємо лише видимі фото (з урахуванням фільтра карток)
  function step(d) {
    var v = links.filter(function (a) { return a.offsetParent !== null; });
    var i = v.indexOf(cur);
    if (i < 0) return;
    show(v[(i + d + v.length) % v.length]);
  }

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault();
      show(a);
      dlg.showModal();
    });
  });
  dlg.querySelector('.lightbox__close').addEventListener('click', function () { dlg.close(); });
  dlg.querySelector('.lightbox__prev').addEventListener('click', function () { step(-1); });
  dlg.querySelector('.lightbox__next').addEventListener('click', function () { step(1); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('lightbox__fig')) dlg.close(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  dlg.addEventListener('close', function () { img.removeAttribute('src'); });
})();
