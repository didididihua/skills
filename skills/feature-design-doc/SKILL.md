---
name: feature-design-doc
description: "从一个需求写到它的功能设计文档：需求设计、原型交互、技术方案和决策记录合成一份单文件 HTML，右上角切换；也可以只写其中一部分（只要原型、只要技术方案）。先读 PRD 和相关代码，再按模板写；图按统一画法画，每张图下有图解。Use when the user asks for 需求设计、需求分析、功能原型、原型交互、原型图、技术方案、技术文档、设计文档、方案设计、需求调研与实现方案, or wants one document that goes from a requirement to its prototype and technical design."
---

# 功能设计文档

一个功能只出一份 HTML：`【设计文档】<功能名>.html`。右上角四个按钮「需求设计」「原型交互」「技术方案」「决策记录」切换内容，左侧目录跟着切换。各部分的编号互相跳转：正文写 `P1-3` 跳到原型上的那条说明，写「决策 2」跳到决策记录，写 `B3`、`RQ-2` 跳到定义它的表格行。还没写的部分按钮置灰，补上后重新构建就合在一起。

## 先确定做哪几部分

| 用户要的 | 写哪些部分 | 需要的输入 |
|---|---|---|
| 从需求到方案的完整文档 | 需求设计 → 原型交互 → 技术方案，决策记录贯穿始终 | PRD、前后端代码 |
| 只梳理需求 | 需求设计 | PRD 或需求描述 |
| 只要原型 | 原型交互，加决策记录 | PRD 或需求描述、前端代码 |
| 只要技术方案 | 技术方案、决策记录 | PRD、后端代码；有原型就引用，没有就在方案里写清页面怎么变 |

说不清要哪几部分时问一句。做全流程时，每写完一部分先交给用户看，方向确认了再写下一部分。

## 源文件

源文件放在需求所在仓库的 `docs/`（或用户指定的目录），每部分一份 Markdown，文件名前缀决定它属于哪一部分：

| 部分 | 源文件 | 怎么写 | 模板 |
|---|---|---|---|
| 需求设计 | `【需求设计】<功能名>.md` | `references/requirement.md` | `templates/requirement.md` |
| 原型交互 | `【功能原型】<功能名>.md` 和同名 `.proto.js` | `references/prototype.md` | `templates/prototype.md`、`templates/prototype.proto.js` |
| 技术方案 | `【技术文档】<功能名>.md` | `references/tech-design.md` | `templates/tech-design.md` |
| 决策记录 | `【决策记录】<功能名>.md` | `references/decisions.md` | `templates/decisions.md` |

各部分共用：组件语法 `references/components.md`，画图 `references/diagrams.md`，版式与写作 `references/style.md`。完整示例在 `examples/member-birthday/`。

## 开始前

1. 有本机配置就先读：`~/.config/feature-design-doc/profile.md` 写了产品皮肤、服务与代码仓库的位置、团队模板的章节对应关系。配置怎么写见 `references/profile.md`。
2. 第一次构建先装依赖：`cd <本技能目录>/scripts && PUPPETEER_SKIP_DOWNLOAD=1 npm install`。构建用本机 Chrome，路径不同时设置 `CHROME_PATH`。

## 步骤

1. **收集输入。** PRD、需求描述、三方接口文档、已有原型，缺的先问。按 profile 加载相关服务的资料。
2. **读代码。** 页面读前端，流程读后端。每个场景找到入口、现有链路和数据来源，记下 `[仓库] 文件:行号` 和代码基线（`origin/master` 的提交）。
3. **写需求设计**（全流程，或用户要梳理需求时）。按 `references/requirement.md`：目标、角色与场景、需求拆解、业务规则、数据口径、与 PRD 的差异、验收标准、待确认。
4. **画原型**（需要时）。按 `references/prototype.md`：列页面，照前端代码复刻，编号和说明一一对应，状态覆盖评审会问到的情况。
5. **写技术方案**（需要时）。按 `references/tech-design.md`：先定方案，优先复用现有流程；每个关键取舍写进决策记录。
6. **画图。** 按 `references/diagrams.md` 选图：分层架构用 `::: arch`，改动全貌用 `::: board`，流程和时序用 Mermaid，实施步骤用 `::: steps`。每张图下面写 `::: explain` 图解。
7. **构建并检查。**

   ```bash
   node <本技能目录>/scripts/build.mjs docs/【技术文档】<功能名>.md     # 任意一部分都行，会找到同名的其他部分
   node <本技能目录>/scripts/audit.mjs docs/【设计文档】<功能名>.html --shots /tmp/fdd-shots
   ```

   build 打出的 `warning:` 逐条改掉：图的写法问题、找不到的 § 引用、重复的编号。audit 检查每个视图的横向溢出、断开的锚点、脚本错误和图里文字的重叠。看截图：首屏、每张图、每个原型页的每个状态。
8. **交给用户。** 打开 HTML，说明结论、需要拍板的事和与 PRD 的差异。不提交代码，除非用户要求。

## 通用规则

- **结论在前。** 每章第一段说清结论；首屏的「一页看懂」让产品、研发、测试各自知道从哪读起。
- **编号全文统一。** 开工前确认 `B`、详设阶段确认 `D`、与 PRD 的差异 `G`、风险 `R`、需求点 `RQ-n`、业务规则 `BR-n`、验收标准 `AC-n`、场景规则用场景缩写（`PM-1`）、配置端规则 `CF-n`、原型页 `P1`、原型编号 `P1-3`。一个编号只在一张表里定义，其他地方引用；发出后不再复用，撤销的写明「已撤销」。
- **取舍都有记录。** 讨论中用户拍板的事（某个字段不做、这次不加缓存）写进决策记录，注明谁定的、哪天，正文引用「决策 N」。
- **数字和字段都有来源。** 代码默认值写出位置，生产值标「待查」，估算标【推断】。现有数据给不出的列为待确认，由产品决定是否一定要做。
- **不碰生产数据。** 需要数据时给出只读 SQL，交给用户执行。手机号用占位，不写密码和 Token。
- **图要能读懂。** 一张图回答一个问题，图名写结论，图下有图解；颜色只表示改动类型。build 的图检查有 warning 时不交付。
