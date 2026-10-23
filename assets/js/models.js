// Реєстр інтерактивних моделей для дистанційних лабораторних робіт.
//
// Щоб додати модель, допишіть об'єкт у масив MODELS, наприклад:
//   {
//     title: 'Кінетика Міхаеліса–Ментен',
//     discipline: 'Біохімія',
//     description: 'Залежність швидкості ферментативної реакції від концентрації субстрату.',
//     href: 'michaelis-menten/'
//   }
// Порожній масив — показується заглушка «Розділ у розробці».
var MODELS = [];

(function () {
  var grid = document.getElementById('models-grid');
  var empty = document.getElementById('models-empty');
  if (!grid) return;

  if (MODELS.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  MODELS.forEach(function (m) {
    var a = document.createElement('a');
    a.className = 'card';
    a.href = m.href;
    a.style.textDecoration = 'none';

    var badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = m.discipline;

    var h = document.createElement('h3');
    h.textContent = m.title;

    var p = document.createElement('p');
    p.textContent = m.description;

    var meta = document.createElement('span');
    meta.className = 'card__meta';
    meta.textContent = 'Відкрити модель →';

    a.append(badge, h, p, meta);
    grid.appendChild(a);
  });
})();
