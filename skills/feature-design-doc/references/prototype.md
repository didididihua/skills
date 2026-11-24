# 原型交互

为后台功能画可交互的原型：按前端代码复刻真实页面，标出新增和改动，编号对应功能说明和改动说明，横向切换页面状态和「现状 / 方案」。用来和用户讨论功能、给产品和其他人演示，也是技术方案引用页面的依据（`P1-3`）。

源文件放在需求所在仓库的 `docs/`：

- `【功能原型】<功能名>.md`：概览、每个页面的说明、待确认（模板 `templates/prototype.md`）
- `【功能原型】<功能名>.proto.js`：每个页面怎么画（模板 `templates/prototype.proto.js`）

页面用产品皮肤绘制。皮肤在本机配置里指定（见 `profile.md`）；没有配置时用通用的 `admin` 皮肤（antd 风格的后台），在 `.proto.js` 开头用 `SKIN.config()` 设品牌、菜单和主题色，尽量贴近真实页面。

## 步骤

1. **列页面。** 读需求设计或 PRD，列出要改的页面，分成新增页面和改动页面，按使用顺序编号 P1、P2……
2. **读前端。** 每个改动页面读前端代码（仓库位置见 profile）：路由和菜单位置、表单结构和文案、布局和主题。现状视图要和代码一致：标签、占位文字、说明文字照抄。
3. **写文档。** 复制 `templates/prototype.md`，填写文档头、概览（指标行、使用路径、怎么看原型）、每个页面一个 `::: proto` 块、待确认表。
4. **画页面。** 复制 `templates/prototype.proto.js`，每个页面一个 `FRAMES.Pn`：用皮肤函数拼页面，`P(n, kind, pos)` 放编号，`data-mark` 标新增和改动，`data-ask` 标等确认结论的内容，`states` 列出要切换的情况，改动页面加 `views: true`。
5. **构建检查。** `node <本技能目录>/scripts/build.mjs docs/【功能原型】<功能名>.md`，生成 `【设计文档】<功能名>.html`；再用 `audit.mjs` 检查并截图。每个状态和视图都切一遍，确认编号和说明对得上。
6. **交给用户。** 打开 HTML，说明有哪些页面、哪些地方和 PRD 不同、哪些待确认。

## 规则

- **状态要覆盖评审会问到的情况。** 正常、空、出错、下拉展开、不同场景；一个页面通常 2 到 4 个状态。
- **编号。** 紫色是新增、琥珀色是改动；只给新增和改动的地方编号，一处一个编号，序号与说明一一对应。技术方案里写 `P1-3` 就能跳到这条说明，所以编号定了之后不要重排。
- **功能说明写给产品和测试。** 先写**名称**，再写行为、限制和默认值；不引用技术方案的规则编号，待定的事项引用待确认表里的编号。
- **改动说明写给研发。** 列前端文件和接口，后端细节留给技术方案。
- **待确认表。** 「问题」写成能直接回答的问题（比如「发 1 条还是每张券 1 条」），并写上 PRD 怎么要求；「建议」写推荐的选项和代价。全流程时，和需求设计重复的问题直接引用需求设计的 B 编号，不另起编号；和 PRD 冲突的地方每个冲突点各占一行，写明冲突的原因，三方平台的规定要点名，「找谁」带上三方。不改页面的冲突，「影响的页面」写「不改页面」。会被读成别的意思的说法（「合并为 1 条」），写成谁收到几条。
- **讨论中定下的取舍**（某个字段不做、某个交互怎么改）记进 `【决策记录】<功能名>.md`，原型说明里引用「决策 N」。
- **每个数字、字段都有数据来源。** 画之前先查代码，确认现有接口给得出。给不出的（要新统计、新存储或要三方提供）不能当成现成功能画：页面上加 `data-ask="编号"`，功能说明里标【待确认】，写清两种结论下页面的样子，再列进待确认表。
- **数据用示意值。** 品牌、人数前后一致；手机号、链接用占位或示例值。
- **复刻现有前端，不重新设计视觉。** PRD 的设计稿只作为参考，与代码冲突时以代码的组件和样式为准。

## 页面定义

页面脚本在 `<文档名>.proto.js`，构建时和运行时、皮肤一起内联进 HTML。运行时提供 `FRAMES`、`P`、`PI`；皮肤提供 `SKIN`（`admin` 皮肤同时提供旧名 `SS`）。

```js
FRAMES.P1 = {
  width: 960,                                   // 舞台宽度，默认 960；展开侧栏的页面可用 1040
  states: [['normal', '正常'], ['err', '出错']], // 横向切换的状态，第一个是默认
  views: true,                                  // 改动页面：提供现状、方案、对比
  render: function (state, view) {              // view 为 'cur' 或 'plan'
    return SKIN.app({ ... });
  }
};
```

- 现状视图（`view === 'cur'`）照前端代码画，不放编号、不加 `data-mark`。
- 对比视图由运行时把现状和方案叠在一起，用分界线拖动对比，页面脚本不用处理。
- 舞台按宽度缩放到文档里；按 960px 设计，表单宽度、表格列数按这个宽度安排。

## 编号与标注

- `P(n, kind, pos)`：绝对定位的编号，`kind` 为 `'new'`（紫）或 `'chg'`（琥珀），`pos` 是相对最近的定位父元素的 CSS，默认 `'top:-8px;right:-8px'`。表单项用 `SKIN.item(…, { pin: P(1, 'new', 'top:6px;left:-22px') })`，编号落在标签左侧。
- `PI(n, kind)`：跟在文字后面的行内编号，适合表头、按钮旁。
- `data-mark="new"` / `data-mark="chg"`：「改动标注」打开时画紫色或琥珀色虚线框。皮肤的大多数函数接受 `{ mark: 'new' }`。
- `data-ask="B11"`（皮肤函数传 `{ ask: 'B11' }`）：这块内容要等确认结论才知道做不做，比如现有数据给不出的数字。「改动标注」打开时画深琥珀色点线框，右上角标「待确认 B11」；可以和 `data-mark` 同时用。一段文字里只有一句待确认时，用 `<span data-ask="G2">…</span>` 包住这句。
- 编号 n 与 Markdown 里 `::: proto` 有序列表的序号一一对应；构建后点编号会定位到同号说明。

## admin 皮肤函数

| 函数 | 作用 |
|---|---|
| `SKIN.config({ brand, logo, scope, user, primary, header, top, activeTop })` | 品牌名、logo 字、顶栏左侧的范围选择（如「全部门店」，不填不显示）、右上角用户名、主题色、顶栏样式（`primary` 主题色、`dark` 深色、`light` 白色）、收起时的一级菜单 `[[图标, 名称]]` 和高亮项 |
| `SKIN.app({ top, sider, tabs, title, back, extra, body, overlay })` | 整页外壳：顶栏、侧栏（不传 `sider` 时收起成图标）、页签、白色页面卡片 |
| `SKIN.menu(items)` | 展开的侧栏菜单：`[{ label, icon, open, active, mark, badge, pin, children }]`，新增的菜单项加 `mark: 'new'`、`badge: '新'` |
| `SKIN.h3(text, sub, o)` | 表单分区标题，`sub` 是灰色副标题 |
| `SKIN.item(label, ctl, { req, extra, warn, err, pin, mark, ask, nocolon, mb })` | 横向表单项：标签列 4/24、必填星号、说明、警告、错误；`label` 为 `''` 时空出标签列，为 `null` 时整行 |
| `SKIN.input(value, { ph, w, count, err, dis, picker, tag, area, mark })` | 输入框；`count` 是右侧字数，`picker` 为 `'clock'`、`'calendar'` 时画日期时间框 |
| `SKIN.select(value, { w, tag, drop, err })`、`SKIN.drop(options, foot)` | 下拉框，`drop` 传入展开的选项层 |
| `SKIN.sw(on, { txt: ['开', '关'] })` | 开关 |
| `SKIN.radio(label, on)`、`SKIN.check(label, on)` | 单选、复选 |
| `SKIN.btn(text, type)` | 按钮：`pri` 主按钮、`ghost` 描边、`link` 文字、`dis` 禁用 |
| `SKIN.tag(text, color)` | 标签：`green`、`red`、`orange`、`blue`、`purple`、`gray` |
| `SKIN.alert(type, text)` | 提示条：`info`、`warn`、`err`、`ok` |
| `SKIN.table(cols, rows)` | 表格 |
| `SKIN.ic(name)` | 图标：`down`、`left`、`right`、`plus`、`search`、`close`、`clock`、`calendar`、`reload`、`out`、`bell`、`gift`、`user`、`mail`、`phone` 等 |

复合样式类可直接写在 HTML 里：`ss-card`（带标题的卡片，配 `ss-card-h`）、`ss-preview`（消息预览，`.v` 标变量）、`ss-stats`（三格统计）、`ss-vars`（变量表）、`ss-chcard`（带标题的配置卡）、`ss-mask` 加 `ss-modal`（弹窗）。

## 从前端代码复刻

- 表单：`Form` 的 `labelCol` 是 4/24 时用 `SKIN.item`；`label=""` 的行传 `''`；`colon={false}` 传 `nocolon: true`。
- 文案：`label`、`placeholder`、`extra`、`message` 原样照抄，现状视图才能当回归基线。
- 菜单：一级菜单和层级以前端的路由配置为准，用 `SKIN.menu` 画出展开的那一支。
- 产品专用皮肤（照某个真实后台做的完整复刻）放在本机配置的 `skins/` 下，文档头写 `skin: <名称>`；做法见 `profile.md`。
