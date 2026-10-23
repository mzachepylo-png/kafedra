// Фільтр карток «Під мікроскопом» за типом збудника.
(function () {
  var group = document.querySelector('[data-filter-group]');
  if (!group) return;
  var cards = document.querySelectorAll('.micro[data-type]');

  group.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    var f = btn.getAttribute('data-filter');

    group.querySelectorAll('button[data-filter]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    cards.forEach(function (c) {
      c.hidden = f !== 'all' && c.getAttribute('data-type') !== f;
    });
  });
})();
