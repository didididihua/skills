/* 功能名称：原型页面 P1–Pn。
   页面按当前前端绘制，数据为示意。皮肤由文档头 skin: 或本机配置决定，默认 admin。 */
(function () {
  'use strict';
  var S = window.SKIN;
  // 通用皮肤按产品调整品牌、主题色和一级菜单；产品专用皮肤已经内置这些，可以删掉这一段。
  S.config({ brand: '管理后台', logo: '管', primary: '#1677ff', header: 'primary' });
  var item = S.item, input = S.input, btn = S.btn;
  var row = function () { return '<div class="ss-row">' + Array.prototype.join.call(arguments, '') + '</div>'; };
  // 表单项左侧的编号位置
  var ROW_PIN = 'top:6px;left:-22px';

  /* ---------------- P1 改动页面：现状、方案、对比 ---------------- */
  FRAMES.P1 = {
    states: [['normal', '正常'], ['err', '出错']],
    views: true,
    render: function (state, view) {
      var cur = view === 'cur';
      var body = S.h3('基础信息') +
        item('名称', input('示例名称', { w: 300 }), { req: true });
      if (!cur) {
        // 新增的表单项：mark 让「改动标注」画出虚线框，P() 放编号
        body += item('新字段', S.sw(true), { mark: 'new', pin: P(1, 'new', ROW_PIN), extra: '说明文字' });
        if (state === 'err') body += S.alert('err', '出错时页面怎么提示');
      }
      body += item('', row(btn('取消'), btn('保存', 'pri')), { nocolon: true, mb: 0 });
      return S.app({ tabs: ['工作台', '列表页', '编辑'], title: '编辑', back: true, body: body });
    }
  };

  /* ---------------- P2 新增页面：展开菜单，标出入口 ---------------- */
  FRAMES.P2 = {
    width: 1040,
    states: [['normal', '正常']],
    render: function () {
      var sider = S.menu([
        { label: '工作台', icon: 'desktop' },
        { label: '营销', icon: 'fire', open: true, children: [
          { label: '营销活动' },
          { label: '新页面', active: true, mark: 'new', badge: '新', pin: P(1, 'new', 'top:10px;right:8px') }
        ] },
        { label: '会员', icon: 'user', children: [] }
      ]);
      var table = S.table(['列一' + PI(2), '列二', '操作'], [['值', '值', '<a>配置</a>']]);
      return S.app({
        sider: sider,
        tabs: ['工作台', '新页面'], title: '新页面',
        body: S.alert('info', '页面说明') + '<div style="height:16px"></div>' + table
      });
    }
  };
})();
