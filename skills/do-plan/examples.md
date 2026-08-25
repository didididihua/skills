# Example

用户：`/doPlan`，plan 在 `docs/plans/invite-link.md`（「已登录用户可创建一次性邀请链接，24h 过期」）。

## Freeze

编排者写出 `docs/doplan/invite-link/index.md` 和两个 draft task，然后等待：

- `T01` 创建链接：验收 = POST 成功返回 token；过期时间为 now+24h；未登录 401。
- `T02` 消费链接：验收 = 有效 token 绑定一次后失效；过期或重复使用返回明确错误。

用户确认后才写测试。

## T01

0. 基线：跑 `index.md` 里的编译/测试命令。通过才开始；失败则停，算进场前的问题。
1. 红：先加 `createInviteLink_unauthenticated_returns401` 等测试并跑红。
2. 绿：只改邀请模块最少代码。
3. 重构：无新抽象则跳过。
4. 干净验收输入：原 plan、`task-01-create-link.md`、本 task diff、`AGENTS.md`。
5. `VERDICT: PASS` → commit `T01: create invite link` → `T01` 标 `done`。

## T02 开始前

再跑同一组基线命令。若红，先查 T01 的 commit，不要把 T02 的改动混进去。

## 失败分类

- 测试没覆盖「24h 过期」→ `FAIL_IMPL`，补测试再验（计入自动复验次数）。
- 顺手加了「可配置过期时间 + 策略接口」→ `FAIL_SPEC`，停下问用户。

## 终验

`T01` `T02` 都 `done` 后，再开一次干净子 agent：原 plan + `index.md` + 两个 task 文件 + 本轮全部 diff。通过才算落地完成。
