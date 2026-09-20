# 源码依据与取舍

来源：用户指定的 `nexus-agent` 项目，2026-09-20 提炼时核对版本为 `782d69b553beb49595a7a912f51853c4a0bc5ff5`。下面的路径相对于该仓库；以符号定位为准，行号可能随版本变化。无需每次使用技能都重新读取整个参考仓库。

## 从 Nexus 直接借鉴的组织方式

| 来源文件与符号 | 借鉴内容 |
|---|---|
| `backend/cmd/server/main.go`：`main`、`run` | 进程退出与初始化分开；按依赖顺序组织启动阶段 |
| `backend/cmd/migrate/main.go`：`main`、`run` | 命令按职责独立；可失败的工作返回错误 |
| `backend/internal/service/service.go`：`Deps`、`Services`、`New` | 装配参数具名，相关服务共享依赖 |
| `backend/internal/repo/repo.go`：`Repos`、`New` | 同一数据库连接交给相关仓库，构造关系可见 |
| `backend/internal/api/handler_model.go`：`UpdateProvider`、`UpdateModel` | HTTP 解析、调用业务、处理结果，主路径直接 |
| `backend/internal/service/modelsvc.go`：`Encryptor`、`UpdateProvider`、`UpdateModel` | 消费方小接口；加载原记录，区分缺省字段，再保存 |
| `backend/internal/service/agentsvc.go`：`Update` | 注释解释为什么不能用部分表单覆盖完整持久化对象 |
| `backend/internal/service/modelsvc.go`：`ResolveModel`、`descriptorOf` | 持久化配置与运行时描述符分开，组装字段明确 |
| `backend/internal/workflow/engine.go`：`Deps` | 复用已有组件，通过依赖表达协作，不在流程引擎重复实现工具或模型调用 |
| `backend/internal/pkg/errcode/errcode.go`：`WithCause`、`WithMsg`、`From` | 业务信息与内部原因分开，保留错误链 |

这些是风格与职责划分的依据，不表示参考项目每个实现都适合当前系统。

## 用户偏好与目标项目适配

2026-09-20 用户明确要求把 Nexus 风格提炼成 skill 并记忆。已有 Go 偏好包括：逻辑阶段空行、长调用 / 字面量 / ent 链展开、业务状态命名常量、避免过度设计。这些偏好在参考项目局部存在紧凑排版时仍适用。

FFMAAS 的 `service → biz → data`、proto 优先、ent、版本化迁移、禁止外键来自目标项目约定。它们不是 Nexus 原仓库的技术选型；示例会保留这些边界。

## 有意不复制的实现细节

- Nexus 使用 GORM 和手写 HTTP 路由；不能因此替换 FFMAAS 的 ent 和生成 API。
- Nexus 的部分字段与调用挤在同一行；样例按用户偏好展开，不追求逐字复制排版。
- Nexus `service.New` 会读取默认模型。不能推断所有构造函数都是无副作用的；借鉴的是依赖可见，并按当前初始化需求决定是否返回错误。
- Nexus 的启动示例同时使用后台 `Spin` 和独立信号 / `Shutdown`。迁移生命周期写法前须核对当前框架，保留唯一关闭责任方。
- 参考项目中的状态数值、默认账号、Key 更新约定、重试 / 熔断策略和数据库约束不是可直接推广的风格规则。

可编译样例是为讲清规则重新编写的最小业务例子；不是源码复制，也不证明 Nexus 或 FFMAAS 已通过生产验收。
