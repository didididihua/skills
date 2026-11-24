/* 会员生日礼：原型页面 P1、P2。
   用通用的 admin 皮肤绘制，数据为示意。 */
(function () {
  'use strict';
  var S = window.SKIN;
  S.config({ brand: '门店后台', logo: '店', scope: '全部门店', primary: '#1677ff', header: 'primary' });
  var item = S.item, input = S.input, btn = S.btn, tag = S.tag;
  var row = function () { return '<div class="ss-row">' + Array.prototype.join.call(arguments, '') + '</div>'; };
  var ROW_PIN = 'top:6px;left:-22px';

  /* ---------------- P1 新增页面：生日礼设置 ---------------- */
  FRAMES.P1 = {
    width: 1040,
    states: [['normal', '正常'], ['empty', '未选券'], ['off', '已停用']],
    render: function (state) {
      var on = state !== 'off';
      var sider = S.menu([
        { label: '工作台', icon: 'desktop' },
        { label: '营销', icon: 'fire', open: true, children: [
          { label: '营销活动' },
          { label: '优惠券' },
          { label: '生日礼', active: true, mark: 'new', badge: '新', pin: P(1, 'new', 'top:10px;right:8px') }
        ] },
        { label: '会员', icon: 'user', children: [] },
        { label: '数据', icon: 'chart', children: [] }
      ]);
      var coupon = state === 'empty'
        ? item('生日券', S.select('', { w: 320, ph: '请选择券模板', err: true }), { req: true, err: '请选择一张生日券', pin: P(3, 'new', ROW_PIN), mark: 'new' })
        : item('生日券', S.select('生日满 50 减 10 券', { w: 320 }), { req: true, extra: '只能选择可用的券模板；有效期从发放日起 30 天', pin: P(3, 'new', ROW_PIN), mark: 'new' });
      var body = S.h3('生日礼规则', '每个会员每年最多发一次') +
        item('启用', S.sw(on, { txt: ['开', '关'] }), { extra: on ? '次日起按规则自动发放' : '已停用：次日起不再发放，已发的券不受影响', pin: P(2, 'new', ROW_PIN), mark: 'new' }) +
        coupon +
        item('提前天数', row(input('3', { w: 120 }), '<span class="ss-desc">天，可选 0 到 7 天</span>'), { req: true, pin: P(4, 'new', ROW_PIN), mark: 'new' }) +
        item('发送时间', S.select('10:00', { w: 120, picker: 'clock' }), { req: true, extra: '9:00 到 20:00，整点', pin: P(5, 'new', ROW_PIN), mark: 'new', ask: 'B2' }) +
        item('提醒渠道', row(S.check('订阅消息', true), S.check('短信', true)), { extra: '会员没有订阅时才发短信，消耗短信余额', pin: P(6, 'new', ROW_PIN), mark: 'new' }) +
        item('', row(btn('取消'), btn('保存', 'pri')), { nocolon: true, mb: 0 });
      if (!on) body = S.alert('warn', '生日礼已停用，次日起不再发放') + '<div style="height:16px"></div>' + body;
      return S.app({ sider: sider, tabs: ['工作台', '生日礼'], title: '生日礼', body: body });
    }
  };

  /* ---------------- P2 改动页面：会员详情 ---------------- */
  FRAMES.P2 = {
    states: [['normal', '有记录'], ['none', '没有记录']],
    views: true,
    render: function (state, view) {
      var cur = view === 'cur';
      var info = '<div class="ss-card"><div class="ss-card-h">基本信息</div>' +
        item('姓名', '<span>王小明</span>', { mb: 8 }) +
        item('手机号', '<span>138****0000</span>', { mb: 8 }) +
        item('生日', cur ? '<span>3 月 5 日</span>' : row('<span>3 月 5 日</span>', tag('今年已发', 'green')), { mb: 0, pin: cur ? '' : P(2, 'chg', ROW_PIN), mark: cur ? '' : 'chg' }) +
        '</div>';
      var records = '';
      if (!cur) {
        var rows = state === 'none' ? [] : [
          ['2026-03-02 10:00', '生日满 50 减 10 券', tag('未使用', 'blue'), tag('订阅消息已送达', 'green')],
          ['2025-03-02 10:00', '生日满 50 减 10 券', tag('已使用', 'gray'), tag('短信已送达', 'green')]
        ];
        var table = rows.length ? S.table(['发放时间', '券', '券状态', '提醒'], rows) : '<div class="ss-desc" style="padding:24px 0;text-align:center">暂无生日礼记录</div>';
        records = '<div style="height:16px"></div><div class="ss-card" data-mark="new" style="position:relative"><div class="ss-card-h">生日礼记录</div>' + table + P(1, 'new') + '</div>';
      }
      return S.app({ top: 'user', tabs: ['工作台', '会员列表', '会员详情'], title: '会员详情', back: true, body: info + records });
    }
  };
})();
