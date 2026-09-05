# Example

用户：`/doPlan`，plan 在 `docs/plans/invite-link.md`（「已登录用户可创建一次性邀请链接，24h 过期」）。

## Freeze

编排者写出 `docs/doplan/invite-link/index.md` 和两个 draft task，然后等待。不要拆成「建 DTO / 写 mapper / 写 controller」三刀。

- `T01` 创建链接。goal = 原 plan 的「已登录用户创建一次性链接」。seams = HTTP 创建接口。验收 = POST 成功返回 token；过期时间为 now+24h；未登录 401。
- `T02` 消费链接。goal = 原 plan 的「链接只能用一次」。seams = HTTP 消费接口。验收 = 有效 token 绑定一次后失效；过期或重复使用返回明确错误。

用户确认后才写测试。

## T01

0. 重读原 plan 范围内/范围外，再说一句本刀做什么。跑 `index.md` 的 baseline（编译/类型检查）。通过才开始；失败则停，算进场前的问题。
1. 红：只在创建接口这条缝上加测试并跑红。
2. 绿：只改邀请模块最少代码。不要为了 T01 能单独测而先抽策略接口。
3. 重构：无新抽象则跳过。
4. 干净验收输入：原 plan、`task-01-create-link.md`、本 task diff、`AGENTS.md`。父会话只留 VERDICT 短句。
5. `VERDICT: PASS` → commit `T01: create invite link` → `T01` 标 `done`。

## T02 开始前

重读原 plan + T02 文件。上一刀只留 SHA 和一句结果。再跑 baseline（不是 full）。若红，先查 T01 的 commit，不要把 T02 的改动混进去。

## 失败分类

- 创建缝上的测试没覆盖「24h 过期」→ `FAIL_IMPL`，补测试再验（计入自动复验次数）。
- 顺手加了「可配置过期时间 + 策略接口」→ `FAIL_SPEC`，停下问用户。
- 某个改配置的 task `seams: none` 且没写单测 → 不算 `FAIL_IMPL`。

## 终验

`T01` `T02` 都 `done` 后，先跑 `index.md` 的 full，再开一次干净子 agent：原 plan + `index.md` + 两个 task 文件 + 本轮全部 diff。通过才算落地完成。
