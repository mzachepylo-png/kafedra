// Навігація по великому конспекту: липка панель, прогрес, підсвічування розділу, зміст-шухляда,
// режим «одна лекція», пошук по тексту, глосарій, збереження місця читання.
import { $, $$, el } from './util.js';

const article = $('#mg-article');
if (article) init();

function init() {
  const header = $('.site-header');
  const bar = $('#mg-bar');
  const lecs = $$('.mg-lec', article);
  const sections = $$('.mg-sec', article); // розділи лекцій, глосарій, джерела
  const intro = $('#intro');
  const toc = $('#mg-toc');
  const norm = (s) => String(s).toLowerCase().replace(/[’ʼ`]/g, "'").replace(/ё/g, 'е');
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* без збереження */ } },
  };
  const css = getComputedStyle(document.documentElement);
  const offset = () => (header ? header.offsetHeight : 68) + bar.offsetHeight + 24;

  // ---------------------------------------------------------------- режим «одна лекція»
  const focusBtn = $('#mg-focus');
  let focus = LS.get('mg-focus') === '1';
  function setFocus(on, keepPos) {
    focus = on;
    document.body.classList.toggle('mg-focus', on);
    focusBtn.setAttribute('aria-pressed', String(on));
    LS.set('mg-focus', on ? '1' : '0');
    if (on) showLec(currentLecNum(), keepPos);
  }
  function currentLecNum() {
    const cur = $('.mg-lec.is-current');
    if (cur) return +cur.dataset.lec;
    const spyLec = lecs.find((l) => l.getBoundingClientRect().bottom > offset());
    return spyLec ? +spyLec.dataset.lec : 1;
  }
  function showLec(n) { lecs.forEach((l) => l.classList.toggle('is-current', +l.dataset.lec === n)); }
  focusBtn.addEventListener('click', () => setFocus(!focus));

  /** Перейти до елемента за id, відкривши потрібну лекцію у режимі фокусу. */
  function goTo(id, smooth = true) {
    const t = document.getElementById(id);
    if (!t) return;
    const lec = t.closest('.mg-lec');
    if (lec && focus) showLec(+lec.dataset.lec);
    else if (lec) showLec(+lec.dataset.lec);
    const y = t.getBoundingClientRect().top + scrollY - offset() + 10;
    scrollTo({ top: Math.max(0, y), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  }
  // усі внутрішні посилання на якорі статті — через goTo (враховує фіксовану панель і режим фокусу)
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || a.getAttribute('href') === '#') return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!document.getElementById(id) || !article.contains(document.getElementById(id))) return;
    e.preventDefault();
    closeDrawer();
    goTo(id);
  });

  // ---------------------------------------------------------------- видимі розділи
  const allNav = [intro, ...sections].filter(Boolean);
  const visible = () => allNav.filter((s) => s.offsetParent !== null);

  // ---------------------------------------------------------------- стеження за прокруткою
  const tocLinks = toc ? $$('a[href^="#"]', toc) : [];
  const hereL = $('#mg-here-l'), hereS = $('#mg-here-s');
  const progress = $('#mg-progress');
  const pills = $$('#mg-pills a');
  const tocLecs = toc ? $$('.mg-toc__lec', toc) : [];
  let curSec = null;

  function update() {
    const y = offset();
    const vs = visible();
    let cur = vs[0];
    for (const s of vs) { if (s.getBoundingClientRect().top <= y + 4) cur = s; else break; }
    // загальний прогрес
    const r = article.getBoundingClientRect();
    const total = r.height - innerHeight * 0.6;
    progress.style.width = Math.max(0, Math.min(100, (-r.top + y) / total * 100)).toFixed(1) + '%';
    // прогрес лекцій у змісті
    tocLecs.forEach((li) => {
      const lec = document.getElementById('l' + li.dataset.lec);
      if (!lec || lec.offsetParent === null) return;
      const b = lec.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (y - b.top) / (b.height - innerHeight * 0.4)));
      li.querySelector('.mg-toc__bar i').style.width = (p * 100).toFixed(0) + '%';
    });
    if (cur !== curSec) { curSec = cur; mark(cur); }
    $('#mg-top').hidden = scrollY < 900;
  }
  function mark(cur) {
    if (!cur) return;
    const lec = cur.closest('.mg-lec');
    const ln = lec ? +lec.dataset.lec : 0;
    if (lec && !focus) lecs.forEach((l) => l.classList.toggle('is-current', l === lec));
    hereL.textContent = lec ? `Лекція ${ln}` : cur.id === 'intro' ? 'Вступ' : 'Додатки';
    hereS.textContent = (cur.dataset.n ? cur.dataset.n + ' ' : '') + (cur.dataset.title || 'Про конспект');
    pills.forEach((p) => p.classList.toggle('is-active', +p.dataset.lec === ln));
    tocLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + cur.id));
    tocLecs.forEach((li) => { const on = +li.dataset.lec === ln; li.classList.toggle('is-open', on); li.classList.toggle('is-current', on); });
    const act = toc && $('a.is-active', toc);
    if (act && toc.scrollHeight > toc.clientHeight) {
      const t = act.offsetTop - toc.clientHeight / 2;
      if (Math.abs(toc.scrollTop - t) > toc.clientHeight / 3) toc.scrollTo({ top: t, behavior: 'smooth' });
    }
    if (cur.id !== 'intro') LS.set('mg-pos', cur.id);
  }
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } }, { passive: true });
  addEventListener('resize', update);

  // ---------------------------------------------------------------- попередній/наступний розділ
  function step(d) {
    const vs = visible();
    const i = vs.indexOf(curSec);
    let j = Math.max(0, Math.min(vs.length - 1, (i < 0 ? 0 : i) + d));
    // якщо ми посередині розділу, «назад» повертає на його початок
    if (d < 0 && i >= 0 && vs[i].getBoundingClientRect().top < -40) j = i;
    // у режимі фокусу після останнього розділу лекції — наступна лекція
    if (focus && d > 0 && i === vs.length - 1) return;
    if (focus && vs[j] && vs[j].closest('.mg-lec') !== (curSec && curSec.closest('.mg-lec')) && vs[j].closest('.mg-lec')) showLec(+vs[j].closest('.mg-lec').dataset.lec);
    if (vs[j]) goTo(vs[j].id);
  }
  $('#mg-prev').addEventListener('click', () => step(-1));
  $('#mg-next').addEventListener('click', () => step(1));

  // ---------------------------------------------------------------- шухляда змісту
  const drawer = $('#mg-drawer'), drawerBody = $('#mg-drawer-body'), openBtn = $('#mg-toc-open');
  function closeDrawer() { if (!drawer.hidden) { drawer.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; } }
  openBtn.addEventListener('click', () => {
    if (!drawerBody.firstChild && toc) {
      const c = toc.cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      drawerBody.append(c);
    }
    drawerBody.querySelectorAll('a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + (curSec && curSec.id)));
    drawer.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden';
    const act = $('a.is-active', drawerBody); if (act) act.scrollIntoView({ block: 'center' });
  });
  drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });

  // ---------------------------------------------------------------- нагору
  $('#mg-top').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  // ---------------------------------------------------------------- пошук по конспекту
  const sBox = $('#mg-search'), sBtn = $('#mg-search-open'), sIn = $('#mg-q'), sHits = $('#mg-hits');
  const docs = sections.filter((s) => s.dataset.n).map((s) => ({
    id: s.id, n: s.dataset.n, title: s.dataset.title, lec: +s.closest('.mg-lec').dataset.lec,
    text: (s.querySelector('.mg-prose') || s).textContent.replace(/\s+/g, ' '),
  }));
  docs.forEach((d) => { d._t = norm(d.title); d._x = norm(d.text); });
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function openSearch(q) {
    sBox.hidden = false; sBtn.setAttribute('aria-expanded', 'true');
    if (q != null) sIn.value = q;
    sIn.focus(); sIn.select(); run();
  }
  function closeSearch() { sBox.hidden = true; sBtn.setAttribute('aria-expanded', 'false'); }
  sBtn.addEventListener('click', () => (sBox.hidden ? openSearch() : closeSearch()));
  $('#mg-search-close').addEventListener('click', closeSearch);
  let lastToks = [];
  function run() {
    const q = norm(sIn.value.trim());
    const toks = q.split(/\s+/).filter((t) => t.length > 1);
    lastToks = toks;
    if (!toks.length) { sHits.innerHTML = '<li class="mg-hits__none">Введіть слово чи термін — пошук іде по всіх 5 лекціях.</li>'; return; }
    const res = [];
    for (const d of docs) {
      if (!toks.every((t) => d._x.includes(t) || d._t.includes(t))) continue;
      let sc = 0, first = -1;
      for (const t of toks) {
        if (d._t.includes(t)) sc += 20;
        let i = -1, c = 0; while ((i = d._x.indexOf(t, i + 1)) !== -1 && c < 50) { c++; if (first < 0 || i < first) first = i; }
        sc += Math.min(c, 12);
      }
      res.push({ d, sc, first });
    }
    res.sort((a, b) => b.sc - a.sc);
    if (!res.length) { sHits.innerHTML = '<li class="mg-hits__none">Нічого не знайдено. Спробуйте коротше слово або латиницею (напр. «AGAMOUS»).</li>'; return; }
    const re = new RegExp('(' + toks.map(reEsc).join('|') + ')', 'ig');
    sHits.innerHTML = res.slice(0, 12).map(({ d, first }) => {
      const a = Math.max(0, first - 60);
      let snip = d.text.slice(a, a + 190); if (a > 0) snip = '…' + snip;
      return `<li><a href="#${d.id}" data-q="1" style="--lc:var(--l${d.lec})"><b><i>${d.n}</i>${esc(d.title)}</b><small>${esc(snip).replace(re, '<mark>$1</mark>')}…</small></a></li>`;
    }).join('') + (res.length > 12 ? `<li class="mg-hits__none">…ще ${res.length - 12}. Уточніть запит.</li>` : '');
  }
  let st = 0;
  sIn.addEventListener('input', () => { clearTimeout(st); st = setTimeout(run, 90); });
  sHits.addEventListener('click', (e) => { const a = e.target.closest('a[data-q]'); if (a) { setTimeout(() => { highlight(a.getAttribute('href').slice(1), lastToks); }, 450); closeSearch(); } });

  function clearMarks() {
    $$('mark.mg-hl', article).forEach((m) => { const p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
  }
  function highlight(id, toks) {
    clearMarks();
    const sec = document.getElementById(id); if (!sec || !toks.length) return;
    const re = new RegExp('(' + toks.map(reEsc).join('|') + ')', 'ig');
    const w = document.createTreeWalker($('.mg-prose', sec) || sec, NodeFilter.SHOW_TEXT);
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    let n = 0;
    for (const t of nodes) {
      if (n > 40) break;
      if (!norm(t.nodeValue).match(new RegExp(toks.map(reEsc).join('|')))) continue;
      const frag = document.createDocumentFragment(); let last = 0, m; const s = t.nodeValue;
      re.lastIndex = 0;
      const ns = norm(s); const re2 = new RegExp(toks.map(reEsc).join('|'), 'g');
      while ((m = re2.exec(ns))) {
        frag.append(document.createTextNode(s.slice(last, m.index)), el('mark', { class: 'mg-hl' }, s.slice(m.index, m.index + m[0].length)));
        last = m.index + m[0].length; n++;
      }
      frag.append(document.createTextNode(s.slice(last))); t.parentNode.replaceChild(frag, t);
    }
  }

  // ---------------------------------------------------------------- терміни → пошук
  function termClick(li) {
    const t = li.textContent.replace(/\(.*?\)/g, '').trim().split('/')[0].trim();
    openSearch(t); scrollTo({ top: Math.max(0, bar.getBoundingClientRect().top + scrollY - (header ? header.offsetHeight : 68)), behavior: 'smooth' });
  }
  $$('.mg-chips li', article).forEach((li) => {
    li.tabIndex = 0; li.setAttribute('role', 'button'); li.title = 'Знайти в конспекті';
    li.addEventListener('click', () => termClick(li));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); termClick(li); } });
  });

  // ---------------------------------------------------------------- глосарій
  const gq = $('#mg-gq'), gl = $('#mg-gl'), gterms = $$('#mg-gterms li');
  let gLec = 0;
  function gfilter() {
    const q = norm(gq.value.trim());
    gterms.forEach((li) => { li.hidden = !((gLec === 0 || +li.dataset.lec === gLec) && (!q || norm(li.textContent).includes(q))); });
  }
  gq.addEventListener('input', gfilter);
  gl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    gLec = +b.dataset.l; $$('button', gl).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); gfilter();
  });

  // ---------------------------------------------------------------- клавіатура
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if (e.key === 'Escape') { if (!sBox.hidden) closeSearch(); else closeDrawer(); clearMarks(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); openSearch(); }
    else if (e.key === ']') step(1);
    else if (e.key === '[') step(-1);
  });

  // ---------------------------------------------------------------- місце читання
  const resume = $('#mg-resume');
  const last = LS.get('mg-pos');
  if (resume && last && document.getElementById(last) && !location.hash && last !== 'l1-1') {
    const s = document.getElementById(last);
    const a = resume.querySelector('a');
    a.href = '#' + last; a.textContent = (s.dataset.n ? s.dataset.n + ' ' : '') + (s.dataset.title || '');
    resume.classList.add('is-on');
    resume.querySelector('button').addEventListener('click', () => { resume.classList.remove('is-on'); LS.set('mg-pos', ''); });
  }

  // ---------------------------------------------------------------- старт
  if (focus) setFocus(true);
  const h = decodeURIComponent(location.hash.slice(1));
  if (h && document.getElementById(h) && article.contains(document.getElementById(h))) {
    const lec = document.getElementById(h).closest('.mg-lec');
    if (lec) showLec(+lec.dataset.lec);
    setTimeout(() => goTo(h, false), 60);
    addEventListener('load', () => goTo(h, false));
  } else if (!$('.mg-lec.is-current')) showLec(1);
  addEventListener('hashchange', () => { const id = decodeURIComponent(location.hash.slice(1)); if (id && article.contains(document.getElementById(id) || document.body) && document.getElementById(id)) goTo(id); });
  update();
}
