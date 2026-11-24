// Table of contents on the left: highlight the current section and keep it in view.
var DocNav = (function () {
  'use strict';
  var nav = document.querySelector('.nav');
  var items = [], ticking = false;

  function reset(toc) {
    var parent = null;
    items = toc ? Array.prototype.slice.call(toc.querySelectorAll('a')).map(function (a) {
      return { a: a, el: document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))), level: a.classList.contains('l2') ? 2 : 3 };
    }).filter(function (x) { return x.el; }) : [];
    items.forEach(function (x) { if (x.level === 2) parent = x; x.parent = parent || x; });
    update();
  }

  function reveal(a) {
    var m = 24;
    if (nav.scrollHeight > nav.clientHeight) {
      var top = a.offsetTop, bottom = top + a.offsetHeight;
      if (top < nav.scrollTop + m) nav.scrollTop = top - m;
      else if (bottom > nav.scrollTop + nav.clientHeight - m) nav.scrollTop = bottom - nav.clientHeight + m;
    }
    if (nav.scrollWidth > nav.clientWidth) {
      var left = a.offsetLeft, right = left + a.offsetWidth;
      if (left < nav.scrollLeft + m) nav.scrollLeft = left - m;
      else if (right > nav.scrollLeft + nav.clientWidth - m) nav.scrollLeft = right - nav.clientWidth + m;
    }
  }

  function update() {
    ticking = false;
    if (!items.length) return;
    var line = 110, cur = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].el.getBoundingClientRect().top <= line) cur = items[i]; else break;
    }
    var sec = cur ? cur.parent : items[0];
    items.forEach(function (x) {
      x.a.classList.toggle('on', x === cur && x.a.offsetParent !== null);
      x.a.classList.toggle('cur', x === sec && x !== cur);
    });
    if (sec.a.offsetParent && !(cur && cur.a.offsetParent)) sec.a.classList.add('on');
    reveal(cur && cur.a.offsetParent ? cur.a : sec.a);
  }

  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  return { reset: reset };
})();

// Horizontal switches: one block of content, several states.
(function () {
  document.querySelectorAll('[data-switch]').forEach(function (box) {
    var buttons = box.querySelectorAll('.switch-bar button');
    var panes = box.querySelectorAll(':scope > .switch-pane');
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        panes.forEach(function (p) { p.hidden = p.dataset.pane !== b.dataset.pane; });
      });
    });
  });
})();

// Printing shows folded content too; it folds back afterwards.
(function () {
  var opened = [];
  window.addEventListener('beforeprint', function () {
    opened = Array.prototype.filter.call(document.querySelectorAll('details:not([open])'), function (d) { d.open = true; return true; });
  });
  window.addEventListener('afterprint', function () { opened.forEach(function (d) { d.open = false; }); opened = []; });
})();

// Views: 需求设计, 原型交互, 技术方案 and 决策记录 share one page, switched from the top right.
(function () {
  'use strict';
  var root = document.documentElement;
  var views = Array.prototype.slice.call(document.querySelectorAll('.view[data-view]'));
  var tocs = Array.prototype.slice.call(document.querySelectorAll('.toc[data-view]'));
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-view-btn]'));
  var key = 'doc-view:' + location.pathname;
  var has = function (name) { return views.some(function (v) { return v.dataset.view === name; }); };
  var viewOf = function (el) { var v = el && el.closest('.view'); return v ? v.dataset.view : null; };

  function setView(name, keepScroll) {
    if (!has(name)) return;
    views.forEach(function (v) { v.hidden = v.dataset.view !== name; });
    tocs.forEach(function (t) { t.hidden = t.dataset.view !== name; });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.viewBtn === name)); });
    root.dataset.view = name;
    try { localStorage.setItem(key, name); } catch (e) { /* private mode */ }
    if (!keepScroll) window.scrollTo(0, 0);
    DocNav.reset(tocs.filter(function (t) { return !t.hidden; })[0]);
    window.dispatchEvent(new Event('resize'));
  }

  // Jump to an element in either view; a prototype note (P1-3) also lights up its pin.
  function go(id) {
    var el = id && document.getElementById(id);
    if (!el) return false;
    var v = viewOf(el);
    if (v && v !== root.dataset.view) setView(v, true);
    // Targets inside a folded section or another switch state are shown first.
    for (var d = el.closest('details:not([open])'); d; d = d.parentElement.closest('details:not([open])')) d.open = true;
    var pane = el.closest('.switch-pane[hidden]');
    var paneBtn = pane && pane.parentElement.querySelector('.switch-bar button[data-pane="' + pane.dataset.pane + '"]');
    if (paneBtn) paneBtn.click();
    var note = el.matches('.notes li[data-n]') ? el : null;
    var target = note ? note.closest('.spec') : el;
    // Jumps across views land instantly; smooth scrolling over the whole page would trail behind.
    root.style.scrollBehavior = 'auto';
    target.scrollIntoView({ block: 'start' });
    requestAnimationFrame(function () { root.style.scrollBehavior = ''; });
    if (target.matches('.decision')) { target.classList.remove('hit'); void target.offsetWidth; target.classList.add('hit'); }
    if (note) {
      var tab = note.closest('.notes').querySelector('[data-tab="func"]');
      if (tab) tab.click();
      note.classList.add('on');
      setTimeout(function () { note.click(); }, 60);
    }
    return true;
  }

  buttons.forEach(function (b) { b.addEventListener('click', function () { if (!b.disabled) setView(b.dataset.viewBtn); }); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    var el = document.getElementById(id);
    if (!el) return;
    if (viewOf(el) !== root.dataset.view || el.matches('.notes li[data-n]')) {
      e.preventDefault();
      history.pushState(null, '', '#' + encodeURIComponent(id));
      go(id);
    }
  });
  window.addEventListener('hashchange', function () { go(decodeURIComponent(location.hash.slice(1))); });

  var hash = decodeURIComponent(location.hash.slice(1));
  var initial = hash && document.getElementById(hash) ? viewOf(document.getElementById(hash)) : null;
  if (!initial) initial = new URLSearchParams(location.search).get('view');
  if (!initial) { try { initial = localStorage.getItem(key); } catch (e) { /* private mode */ } }
  if (!has(initial)) initial = views.length ? views[0].dataset.view : null;
  if (initial) setView(initial, true);
  if (hash) go(hash);
})();
