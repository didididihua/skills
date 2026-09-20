# FFMAAS 适配：保留协议、ent 和现有分层

适用于 `ffmaas-backend` 及对应 FFMAAS 工作区。其他 Go 项目遵守自己的边界，不自动引入本页的技术栈。

## 不能被风格重构替换的约定

- 保留 `internal/service → internal/biz → internal/data`。`api/hertz/handler` 只绑定与转调；运行组件继续放在 `internal/runtime`。`internal/data` 不 import Eino。
- 正式服务入口是 `cmd/server/main.go`，同目录承载 `app.go`、`services.go` 和路由桥接；与 `cmd/migrate`、`cmd/runtrace-demo` 并列。启动 / 编译从仓库根目录执行 `go run ./cmd/server` / `go build -o bin/ffmaas ./cmd/server`。入口迁移要同步更新调用命令并验证 hz 生成链，不为学目录树大改 `internal`。
- unary HTTP 的唯一定义在 `api/proto/**/*.proto`：使用 Hertz `api.proto` 注解，RPC 同时有注释和 `(openapi.operation).summary`。不要另建平行 JSON 路由。
- API 变更通过 `scripts/hz_update.sh` 或 `.ps1` 逐个处理所有含 RPC 的 proto，维护 handler / model / router 和 Swagger。不要手改 `*.pb.go`、`*_api.go`、标记为生成的路由或 `openapi.yaml`。
- 继续使用 ent、既有 pgx 连接池和版本化 SQL 迁移。需要动 schema 时按项目 `docs/ent.md` 生成；不换 GORM，不加自动建表或外键。
- 保留版本冲突检查、锁与事务边界、业务状态与 `deleted_at` 的区别、DTO 的响应形状。

项目规则有更新时先读现场 `AGENTS.md`、`docs/idl.md`、`docs/ent.md`。本页不授权迁移执行、数据重置或部署。

## proto 的存在性要传到业务层

这是核对过的 `UpdateProviderReq` 中的关键字段（省略其他字段，已有字段号不能改）：

```protobuf
message UpdateProviderReq {
  int64 id = 1 [(api.path) = "id", (openapi.property) = { type: "integer", format: "int64" }];
  // 必填，必须与当前版本一致；冲突返回 409。
  string expected_version = 2 [(api.body) = "expected_version"];
  optional string name = 3 [(api.body) = "name"];
  // 缺省保留旧 Key；提供空值会被拒绝。
  optional string api_key = 6 [(api.body) = "api_key"];
  optional bool enabled = 9 [(api.body) = "enabled"];
}
```

不能用 `req.GetEnabled()` 判断是否提交；它会把未提供和显式 `false` 合并。DTO → patch 保留 `req.Enabled` 指针。参考 Nexus 时特别注意差异：Nexus 的更新样例允许空 Key 保留旧值；FFMAAS 的现有契约是“缺省保留、提供空值拒绝”，不能照搬覆盖规则。

## ent 查询按条件展开

下面将现有基础查询重新排版，保留原来的查询条件：

```go
func visibleModels(client *orm.Client) *orm.ModelQuery {
	return client.Model.Query().
		Where(
			em.DeletedAtIsNil(),
			em.HasProviderWith(
				ep.DeletedAtIsNil(),
				ep.Status(ProviderStatusActive),
			),
		).
		WithProvider()
}
```

这是基础查询，调用方仍需追加模型业务状态、权限和筛选条件。不能因为方法名叫 `visibleModels` 就删掉调用方已有的条件。

更新链按方法换行，读者可以看到到底改变了哪些字段：

```go
update := tx.Model.UpdateOneID(model.ID).
	SetDisplayName(model.DisplayName).
	SetDescription(model.Description).
	SetCategory(model.Category).
	SetStatus(model.Status).
	SetOnline(model.Online).
	AddVersion(1).
	SetUpdatedAt(time.Now())
```

这是排版片段，不是完整的 `ModelRepo.save`。当前保存逻辑还包含供应商锁、模型行锁、版本 / 状态校验、引用检查、features、价格及审计字段；重构时必须保留。不要用这个短片段整体覆盖原方法，也不要把事务内检查移动到事务外。

## 与可编译样例的关系

[业务样例](../examples/model_service.go) 用小接口表达依赖，并用假仓库测试字段存在性与并发冲突。它不提供新的生产内存仓库，也不要求 FFMAAS 的 biz 全部改成接口。

把样例的阶段化写法应用到现有 `service` / `biz` / `data` 中即可。若只改 DTO 换行，不应同时重写错误码、状态值、鉴权路径或 SQL。
