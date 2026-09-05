---
name: do-plan
description: >-
  Lands an existing plan as frozen tasks. Splits by user-visible slices, TDD
  only at named seams, re-reads the original plan each task. Use when the user
  invokes /doPlan or do-plan, or asks to land an already-written plan.
disable-model-invocation: true
---

# do-plan

在 **plan 已经存在** 之后做代码落地。不要写/重写原 plan。不要在用户确认 task 列表之前写测试或改业务代码。

## 何时停止用本 skill

- 用户要的是写 plan，而不是落地 → 不要用本 skill
- 用户只是普通改代码、没有 plan → 不要用本 skill

## 进度清单

复制到对话里，边做边勾：

```text
do-plan:
- [ ] 拿到 plan 位置并读懂
- [ ] 扫描项目约束文档
- [ ] 写出 draft sidecar，等人确认（freeze）
- [ ] 逐个 task：重读原 plan → 基线 → （有缝才红绿）→ 干净验收 → commit
- [ ] 全部 done 后跑 full 命令，再做一次整份 plan 终验
```

## 1. 找到并理解 plan

用户没给路径/URL 时 **先问**，不要用全仓库搜索代替提问。

读完后用几句话复述：目标、范围内、范围外、顺序、缺的验收。Plan 缺目标、自相矛盾、或无法写成可观察验收标准 → **停下问用户**，不要猜产品决策。

若 plan 是粘贴文本：先存到 sidecar 的 `plan-source.md`，`index.md` 指向它。

## 2. 扫描约束

只扫 **目标项目**（不是 skills 仓库）。按顺序找，把路径记进 `index.md`；找不到写 `none`：

1. `AGENTS.md` / `agents.md` / `AGENT.md`
2. `CLAUDE.md`
3. `.cursor/rules/**/*.mdc` 与 `.cursor/rules/**/*.md`
4. `RULE.md`、`rules/**/*.md`
5. `CONTRIBUTING.md`（仅当其中有代码规范）

仓库内明确的代码规范 skill（`.cursor/skills/` 或 `AGENTS.md` 指向的）要遵守。不要把无关的个人 skill 当成项目法律。没有约束文档时，只执行本 skill 的实现风格。

`index.md` 记两套命令：

- **baseline**：快的编译/类型检查。相关单测文件可选，不要把全量测试套在这里。
- **full**：终验前跑一次的全量测试。没有则写 `same as baseline`。

看不出来就 **问一次**。每个 task 开始只跑 baseline；full 只在终验前跑。

## 3. 拆 task 并冻结

默认写到目标项目：`docs/doplan/<plan-slug>/`。目录已存在则用 `<plan-slug>-2`，不要覆盖。若 `docs/` 明显不合适，问一次是否改用 `.doplan/<plan-slug>/`。

**不要改原 plan 文件。** 用模板：

- [templates/index.md](templates/index.md)
- [templates/task.md](templates/task.md)

每个 task 必须有：`id` `title` `goal` `seams` `do` `dont` `acceptance` `depends_on`。`acceptance` 每条都可观察（测试、命令输出、或具体文件/行为）。

状态只允许：`draft | confirmed | in_progress | done | blocked`。

拆分规则：

- **按原 plan 里用户能看见的一块行为拆**（一个接口行为、一个页面流、一条命令结果）。这是切片标准。
- 不要按分层拆：不要 DTO / mapper / controller /「先写测试文件」各算一刀。
- 宁可 2～4 个稍大的 task。超过 5 个 → 先问用户能否合并。
- plan 里已有可执行任务/里程碑就沿用，补 `dont` / `acceptance` / `seams`，不要为了拆而拆。
- **能独立红/绿不是拆分条件。**

`goal` 只写本刀一句话，并指回原 plan 的哪一块。不要把整份 plan 抄进每个 task。

`seams`：本刀要钉住的公共边界，最多 1～2 个；没有可测缝则写 `none`。胶水、配置、改一处调用点用 `none`。

写成 `draft` 后展示任务表和未决问题，然后 **等待确认**。确认前禁止测试与业务代码。用户只确认部分 task → 只做那些，其余保持 `draft`。用户改 spec → 改完再确认一次。

## 4. 实现风格（全程）

未在冻结 spec 里要求的，一律不做；验收子 agent 视为 `FAIL_SPEC`：

- 不要臆测的防御、重试、兜底
- 不要多余抽象（策略/工厂/没必要的接口）
- 不要为未来准备的配置或开关
- 控制流短、直、好读
- 跟项目现有目录和命名
- 禁止顺手改无关文件
- 不要为了让某一刀「能单独测」而先画接口或假实现

`do` 里没有对应 `acceptance` 的项：除非是某条验收的直接、极小前置，否则不做。

## 5. 每个已确认 task：重读 plan → 基线 → 落地 → 验收 → commit

选 `depends_on` 已满足的下一个 `confirmed` task。**基线没过之前不要标 `in_progress`，也不要写这个 task 的测试或生产代码。**

### 每刀输入（防偏航）

本刀的活目标是 **原 plan + 当前 task 文件**，不是上一刀的探索记录。

1. 动手前重读原 plan 的目标/范围内/范围外，以及当前 task。用两句话说明：本刀覆盖原 plan 的哪一块、明确不做什么。
2. 上一 task 只保留：commit SHA + 一句结果。不要把上一刀的测试日志、失败栈、验收长文当作本刀输入。
3. 基线和测试只记命令与 `pass`/`fail`（加关键末行即可）。不要把整份日志复述进后续回复。
4. 验收子 agent 回到父会话后，只留下 `VERDICT` 和 `REASONS` 短句。
5. 对话已经堆满上一刀过程（长日志、反复试错还在）→ 停下，请用户 **新开对话**，只发 sidecar 目录和「做 T0x」。

### 基线

用来隔离：现在红的是上一刀（或进场前的仓库）留下的，还是这一刀引入的。

1. 工作区不能有未提交的生产/测试代码。只允许 sidecar 日志字段脏。有无关脏文件 → 停下问用户。
2. 跑 `index.md` 的 **baseline**（当前 HEAD）。不要在这里跑 full。
3. 通过 → 把 `baseline: pass` 写入该 task 文件，再标 `in_progress`，进入落地。
4. 失败 → 标 `blocked`（或保持 `confirmed`），**不要开始本 task**。明确告诉用户：这是继承故障。T01 失败 = 进场前就坏；T02+ 失败 = 先怀疑上一 task 的 commit。这不是本 task 的红灯。只报结论，不要靠堆失败日志继续往下做。

### 落地（有缝才 TDD）

`seams` 不是 `none`：

1. **红**：只在这些缝上，从该 task 的 `acceptance` 写测试。用项目已有测试命令和目录。必须先跑到红。测试立刻全绿 → 测试没钉住新行为，先改测试，不准写生产代码。不要测私有实现、不要为了先红而造假缝。
2. **绿**：最少生产代码让这些测试通过。再跑同一批测试。
3. **有限度重构**：允许命名、抽出已经重复的本地 helper、对齐现有风格。禁止新框架、新模块边界、多余 interface/impl、配置化、验收没要求的错误处理体系。测试必须保持绿。重构需要新设计就跳过。

`seams` 为 `none`：按 `acceptance` 的命令、文件或行为直接改。不要为了走红绿而补单测。附近有现成相关测试就跑一下，没有就不造。

验收无法观察（既没有缝上的测试，也没有命令/文件/行为）→ 标 `blocked` 并问用户。跑不了已声明的测试命令 → 同样 `blocked`。

把实际用过的测试文件/命令写进该 task 的 `tests` 字段；`seams: none` 且没跑测试则写 `none`。

## 6. 干净验收

绿灯 **不等于** `done`。每次（含终验）新开一个子 agent，**不要**复用实现线程。

子 agent 指令：**先原样粘贴** [verifier-prompt.md](verifier-prompt.md)，再附输入包路径。只读，禁止改代码。

**每 task 输入包：** 原 plan、该 task 文件、本 task 的 diff/相关文件、`index.md` 里的约束路径（或 `none`）。

**终验输入包：** 原 plan、`index.md`、全部 task 文件、本轮 do-plan 的全部 diff、约束路径。终验前先跑 `index.md` 的 **full** 命令；失败则不要开终验子 agent。

禁止把实现过程闲聊、口头「我们跳过 X」传给子 agent；用户决策必须已写进冻结 spec 或 `index.md` notes。

### 裁决

只接受一种：

```text
VERDICT: PASS | FAIL_IMPL | FAIL_SPEC
```

- `PASS` → 按下面「每 task 一次 commit」提交后再进入下一个 task。终验 `PASS` 则把 `index.md` 的 final verify 设为 `pass`。
- `FAIL_IMPL`（缺实现、缝上的测试缺失或红、验收未覆盖、或约束里 **缺** 的必需要素）→ 用落地循环修，再开 **新的** 干净验收。同一 task 最多自动复验 2 轮（含首次共 3 次验收）。仍失败 → `blocked` 并问用户。`seams: none` 不因「没有单测」判 `FAIL_IMPL`。
- `FAIL_SPEC`（超范围、过度设计/封装/防御、与 plan/`dont` 冲突、约束 **禁止** 的模式、为单测而先画的多余缝）→ `blocked`，把报告给用户。用户可改 spec 再冻结、删多余代码、把例外写进 notes+spec、或停。
- 同时有实现缺口和 spec 违规 → 按 `FAIL_SPEC` 处理，两份都列出来。
- 输出格式坏了 → 再 spawn 一次要求按模板。还坏 → `blocked` 并问用户。

### 每 task 一次 commit

只在验收 `PASS` 之后。一 task 一 commit。

1. 把该 task 的 `verify` 写成 `PASS`，`status` 写成 `done`，`commit` 先写 `pending`。
2. stage：本 task 的生产代码、测试、sidecar（`index.md` + 该 task 文件）。不要 stage 无关文件或密钥。
3. commit 说明：`Txx: <title>`，正文一句来自 `goal`。仓库 `git log` 风格稳定则跟它。
4. 成功后把真实 SHA 写进 task 文件（不要 `--amend` 进刚才那次提交）。
5. 再开始下一个 task。从这一步起按「每刀输入」丢掉上一刀过程。

禁止：`--amend`、`--no-verify`、`--no-gpg-sign`、force、push。不是 git 仓库 → `commit: none`，仍可 `done`。hook 拒绝 → 不要当完成，问用户。

全部 task `done` 后，必须跑 **full** 再做一次整份 plan 终验。终验 `PASS` 且只有 sidecar 状态变更时，可再一次收尾 commit：`do-plan: <slug> complete`。仍不 push。中途用户改了原 plan → 停落地，受影响 task 改回 `draft`，重新冻结。

## 7. 完成

终验 `PASS` 后：列出 sidecar 路径、各 task 状态、baseline/full 命令、约束文档、每个 task 的 commit SHA。不要 push / 开 PR。

## 更多

- 字段与文件约定：[templates/index.md](templates/index.md)、[templates/task.md](templates/task.md)
- 验收合同：[verifier-prompt.md](verifier-prompt.md)
- 示例：[examples.md](examples.md)
