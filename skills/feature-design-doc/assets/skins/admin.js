// admin skin: a generic antd-style admin console for prototype frames. Pairs with skins/admin.css.
// The brand, top menu, header style and primary color come from SKIN.config({...}) at the top of a .proto.js file.
// Product-specific skins (a copy of a real console) live in the local profile, see references/profile.md.
window.SKIN = window.SS = (function () {
  'use strict';
  var PATHS = {
    desktop: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    shop: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
    appstore: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    dollar: '<circle cx="12" cy="12" r="9"/><path d="M9 8l3 4 3-4M12 12v6M9 13h6M9 16h6"/>',
    fire: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 3 0-3 .5-6 1-8.5z"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8C10.5 4 6.5 4.5 7.5 7c.5 1 2.5 1 4.5 1zm0 0c1.5-4 5.5-3.5 4.5-1-.5 1-2.5 1-4.5 1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  };
  var FILLED = {
    info: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 11v6M12 7.6v.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    warn: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v6.5M12 16.6v.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    ok: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    err: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  };
  function ic(name) {
    if (FILLED[name]) return '<svg viewBox="0 0 24 24" aria-hidden="true">' + FILLED[name] + '</svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
  }
  // { mark: 'new' | 'chg' } outlines a new or changed block; { ask: 'B2' } marks content that waits for that question.
  var attr = function (o) { return (o && o.mark ? ' data-mark="' + o.mark + '"' : '') + (o && o.ask ? ' data-ask="' + o.ask + '"' : ''); };

  var CFG = {
    brand: '管理后台', logo: '管', scope: '', user: '管理员', primary: '#1677ff', header: 'primary',
    top: [['desktop', '工作台'], ['appstore', '商品'], ['dollar', '订单'], ['fire', '营销'], ['user', '会员'], ['chart', '数据']],
    activeTop: 'fire',
  };
  // SKIN.config({ brand, logo, scope, user, primary, header: 'primary' | 'dark' | 'light', top: [[icon, label]], activeTop })
  function config(o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) CFG[k] = o[k]; return CFG; }

  // Expanded side menu from data: [{ label, icon, open, active, mark: 'new' | 'chg', badge, pin, children: [...] }].
  function menu(items, depth) {
    depth = depth || 1;
    return items.map(function (it) {
      var cls = 'ss-mi' + (depth > 1 ? ' l' + depth : '') + (it.children ? ' sub' + (it.open ? ' open act' : '') : '') + (it.active ? ' on' : '');
      var head = '<div class="' + cls + '"' + (it.mark ? ' data-mark="' + it.mark + '"' : '') + '>' + (depth === 1 && it.icon ? ic(it.icon) : '') +
        '<span>' + it.label + '</span>' + (it.badge ? '<span class="new">' + it.badge + '</span>' : '') + (it.pin || '') + '</div>';
      return head + (it.children && it.open ? menu(it.children, depth + 1) : '');
    }).join('');
  }

  var HEADERS = { primary: '', dark: '--ss-header-bg:#001529;--ss-header-ink:#fff', light: '--ss-header-bg:#fff;--ss-header-ink:rgba(0,0,0,.85);--ss-header-line:#f0f0f0' };
  // o: { top, sider (SKIN.menu(...) html), tabs: [label…], title, back, extra, body, overlay }
  function app(o) {
    var collapsed = !o.sider;
    var active = o.top || CFG.activeTop;
    var sider = collapsed ? CFG.top.map(function (t) { return '<div class="ss-mi' + (t[0] === active ? ' on' : '') + '" title="' + t[1] + '">' + ic(t[0]) + '</div>'; }).join('') : o.sider;
    var tabs = (o.tabs || []).map(function (t, i, a) { return '<span class="ss-tab' + (i === a.length - 1 ? ' on' : '') + '">' + t + (i ? '<span class="x">✕</span>' : '') + '</span>'; }).join('');
    var head = o.title ? '<div class="ss-ph"><h1>' + (o.back ? '<span class="ss-desc">' + ic('left') + '</span>' : '') + o.title + '</h1>' + (o.extra || '') + '</div>' : '';
    var style = '--ss-pri:' + CFG.primary + ';' + (HEADERS[CFG.header] || '');
    return '<div class="ss ss-app' + (collapsed ? ' ss-collapsed' : '') + '" style="' + style + '">' +
      '<div class="ss-header"><div class="ss-logo"><i>' + CFG.logo + '</i><span>' + CFG.brand + '</span></div>' + (CFG.scope ? '<span class="ss-shop">' + ic('shop') + CFG.scope + ic('down') + '</span>' : '') +
      '<div class="ss-hright">' + ic('bell') + '<span>' + CFG.user + '</span><span class="ss-avatar"></span></div></div>' +
      '<div class="ss-main"><aside class="ss-sider">' + sider + '</aside><div class="ss-body"><div class="ss-tabs">' + tabs + '</div><div class="ss-page">' + head + o.body + '</div></div></div>' +
      (o.overlay || '') + '</div>';
  }

  // Form item. label: text, '' for an empty label column, null for a full-width row.
  function item(label, ctl, o) {
    o = o || {};
    var lab = label === null ? '' : '<div class="ss-label' + (o.req ? ' req' : '') + (o.nocolon || !label ? ' nocolon' : '') + '">' + (label ? '<span>' + label + '</span>' : '') + '</div>';
    var tail = (o.extra ? '<div class="ss-extra">' + o.extra + '</div>' : '') + (o.warn ? '<div class="ss-warnt">' + o.warn + '</div>' : '') + (o.err ? '<div class="ss-errt">' + o.err + '</div>' : '');
    return '<div class="ss-item' + (label === null ? ' full' : '') + '" style="position:relative' + (o.mb != null ? ';margin-bottom:' + o.mb + 'px' : '') + '"' + attr(o) + '>' + lab + '<div class="ss-ctl">' + ctl + tail + '</div>' + (o.pin || '') + '</div>';
  }
  function input(v, o) {
    o = o || {};
    var cls = 'ss-input' + (v ? '' : ' ph') + (o.err ? ' err' : '') + (o.focus ? ' focus' : '') + (o.dis ? ' dis' : '') + (o.select ? ' ss-select' : '') + (o.area ? ' area' : '') + (o.picker ? ' ss-picker' : '');
    var body = (o.prefix || '') + '<span>' + (v || o.ph || '请输入') + '</span>' + (o.tag || '') + (o.count ? '<span class="cnt">' + o.count + '</span>' : '') + (o.picker ? ic(o.picker) : '');
    return '<span class="' + cls + '" style="width:' + (o.w || 300) + 'px' + (o.style ? ';' + o.style : '') + '"' + attr(o) + '>' + body + '</span>';
  }
  function select(v, o) { o = o || {}; o.select = true; return '<span style="position:relative;display:inline-block">' + input(v, o) + (o.drop || '') + '</span>'; }
  function drop(options, foot) {
    return '<div class="ss-drop">' + options.map(function (op) { return '<div class="ss-opt' + (op.on ? ' on' : '') + (op.dis ? ' dis' : '') + '">' + op.label + (op.tag || '') + '</div>'; }).join('') + (foot ? '<div class="ss-drop-foot">' + foot + '</div>' : '') + '</div>';
  }
  function sw(on, o) {
    o = o || {};
    var t = o.txt ? '<span class="t">' + (on ? o.txt[0] : o.txt[1]) + '</span>' : '';
    return '<span class="ss-switch' + (on ? ' on' : '') + '"' + attr(o) + '>' + t + '</span>';
  }
  function radio(label, on) { return '<span class="ss-radio' + (on ? ' on' : '') + '"><i></i>' + label + '</span>'; }
  function check(label, on, o) { return '<span class="ss-check' + (on ? ' on' : '') + (o && o.dis ? ' dis' : '') + '"' + attr(o) + '><i></i>' + label + '</span>'; }
  function btn(text, type, o) { return '<span class="ss-btn' + (type ? ' ' + type : '') + '"' + attr(o) + '>' + text + '</span>'; }
  function tag(text, color, o) { return '<span class="ss-tag' + (color ? ' ' + color : '') + '"' + attr(o) + '>' + text + '</span>'; }
  function alert(type, text, o) { return '<div class="ss-alert ' + type + '"' + attr(o) + '>' + ic({ info: 'info', warn: 'warn', err: 'err', ok: 'ok' }[type]) + '<div>' + text + '</div></div>'; }
  function h3(text, sub, o) { return '<div class="ss-h3"' + attr(o) + '>' + text + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function table(cols, rows) {
    return '<div class="ss-tw"><table class="ss-table"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  return { config: config, ic: ic, app: app, menu: menu, item: item, input: input, select: select, drop: drop, sw: sw, radio: radio, check: check, btn: btn, tag: tag, alert: alert, h3: h3, table: table };
})();
