// Prototype runtime. Each page registers FRAMES[id] = { states, views, width, render(state, view) }.
// The notes panel and the page title come from the Markdown; this script draws the stage and wires pins to notes.
window.FRAMES = window.FRAMES || {};
window.PROTO = (function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var zoomOK = window.CSS && CSS.supports && CSS.supports('zoom', '0.5');

  // Pin anchored to the nearest positioned ancestor; PI is the inline variant placed after a label.
  function P(n, kind, pos) {
    return '<i class="pin p-' + (kind || 'new') + '" data-n="' + n + '" style="' + (pos || 'top:-8px;right:-8px') + '" role="button" tabindex="0" aria-label="说明 ' + n + '">' + n + '</i>';
  }
  function PI(n, kind) {
    return '<i class="pin in p-' + (kind || 'new') + '" data-n="' + n + '" role="button" tabindex="0" aria-label="说明 ' + n + '">' + n + '</i>';
  }

  function seg(label, attr, items, current, classes) {
    return '<span class="switch-bar"><span class="seg-label">' + label + '</span><span class="seg" role="group" aria-label="' + label + '">' +
      items.map(function (it, i) {
        return '<button type="button" ' + (classes ? 'class="' + classes[i] + '" ' : '') + 'data-' + attr + '="' + it[0] + '" aria-pressed="' + (it[0] === current) + '">' + it[1] + '</button>';
      }).join('') + '</span></span>';
  }

  function initSpec(spec) {
    var id = spec.dataset.frame;
    var F = window.FRAMES[id];
    var inner = $('.stage-inner', spec);
    if (!F) { inner.innerHTML = '<div class="stage-fallback">缺少原型脚本：' + id + '</div>'; return; }
    var states = F.states && F.states.length ? F.states : [['default', '默认']];
    var st = { state: states[0][0], view: 'plan', marks: true, cut: 50 };
    var tools = $('.spec-tools', spec);
    var html = '';
    if (states.length > 1) html += seg('状态', 'state', states, st.state);
    if (F.views) html += seg('视图', 'view', [['cur', '现状'], ['plan', '方案'], ['diff', '对比']], st.view, ['v-cur', 'v-plan', 'v-diff']);
    html += '<label class="tg"><input type="checkbox" data-marks checked>改动标注</label>';
    tools.innerHTML = html;

    var stage = $('.stage', spec);
    var notes = $('.notes', spec);
    var caption = $('.stage-caption .cap-text', spec);
    var width = F.width || 960;
    inner.style.width = width + 'px';

    function fit() {
      if (!stage.clientWidth) return; // hidden view: refit when it is shown
      var z = Math.min(1, stage.clientWidth / width);
      if (zoomOK) { inner.style.zoom = z; stage.style.height = ''; }
      else { inner.style.transform = 'scale(' + z + ')'; stage.style.height = inner.offsetHeight * z + 'px'; }
    }

    function render() {
      var v = st.view;
      if (v === 'diff') {
        inner.innerHTML = '<div class="cmp" style="--cut:' + st.cut + '%"><div class="cmp-before">' + F.render(st.state, 'cur') + '</div><div class="cmp-after">' + F.render(st.state, 'plan') + '</div>' +
          '<div class="cmp-handle"><span>拖动对比</span></div><span class="cmp-label l">现状</span><span class="cmp-label r">方案</span>' +
          '<input class="cmp-range" type="range" min="0" max="100" value="' + st.cut + '" aria-label="拖动比较现状与方案"></div>';
        var r = $('.cmp-range', inner), box = $('.cmp', inner);
        r.addEventListener('input', function () { st.cut = +r.value; box.style.setProperty('--cut', st.cut + '%'); });
      } else {
        inner.innerHTML = F.render(st.state, v);
      }
      inner.classList.toggle('show-marks', st.marks && v !== 'cur');
      inner.classList.toggle('hide-pins', v !== 'plan');
      var label = states.filter(function (s) { return s[0] === st.state; })[0][1];
      if (caption) caption.innerHTML = F.views ? '<b>' + { cur: '现状', plan: '方案', diff: '对比' }[v] + '</b><span class="cap-sep"></span>' + label : '<b>' + label + '</b>';
      $$('[data-pin-count]', spec).forEach(function (x) { x.textContent = $$('.pin', inner).length; });
      bindPins();
      fit();
    }

    function bindPins() {
      $$('.pin', inner).forEach(function (p) {
        var n = p.dataset.n;
        var go = function () {
          var tab = $('.notes-tabs [data-tab="func"]', notes);
          if (tab) tab.click();
          var li = $('.notes li[data-n="' + n + '"]', notes);
          $$('.notes li.on', notes).forEach(function (x) { x.classList.remove('on'); });
          $$('.pin.on', inner).forEach(function (x) { x.classList.remove('on'); });
          p.classList.add('on');
          if (li) {
            li.classList.add('on');
            var body = $('.notes-body', notes);
            if (body && body.scrollHeight > body.clientHeight) body.scrollTop = li.offsetTop - body.offsetTop - 12;
            else li.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
          }
        };
        p.addEventListener('click', go);
        p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    }

    $$('.notes li[data-n]', notes).forEach(function (li) {
      var n = li.dataset.n;
      var pin = function () { return $('.pin[data-n="' + n + '"]', inner); };
      li.addEventListener('mouseenter', function () { var p = pin(); if (p) p.classList.add('on'); });
      li.addEventListener('mouseleave', function () { var p = pin(); if (p) p.classList.remove('on'); });
      li.addEventListener('click', function () {
        var p = pin();
        if (!p) return;
        var host = p.parentElement;
        host.classList.remove('flash'); void host.offsetWidth; host.classList.add('flash');
        p.classList.add('on');
        setTimeout(function () { p.classList.remove('on'); }, 1200);
      });
    });
    $$('.notes-tabs button', notes).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.notes-tabs button', notes).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        $$('.notes-pane', notes).forEach(function (p) { p.hidden = p.dataset.pane !== b.dataset.tab; });
      });
    });
    $$('[data-state]', spec).forEach(function (b) {
      b.addEventListener('click', function () {
        st.state = b.dataset.state;
        $$('[data-state]', spec).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        render();
      });
    });
    $$('[data-view]', spec).forEach(function (b) {
      b.addEventListener('click', function () {
        st.view = b.dataset.view;
        $$('[data-view]', spec).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        render();
      });
    });
    var mk = $('[data-marks]', spec);
    if (mk) mk.addEventListener('change', function () { st.marks = mk.checked; render(); });

    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage);
    else window.addEventListener('resize', fit);
    render();
  }

  function init() { $$('.spec[data-frame]').forEach(initSpec); }
  return { P: P, PI: PI, init: init };
})();
var P = PROTO.P, PI = PROTO.PI;
