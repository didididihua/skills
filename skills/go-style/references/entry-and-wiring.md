# 入口、装配与退出的样例

以下片段模仿 Nexus 的 `cmd/server/main.go`、`service.Deps` 和 `repo.New` 的组织方式，类型名按 FFMAAS 的实际组件改写。片段依赖目标项目，不是独立可执行程序；不要求新增同名包装或复制全部目录。

## main 与 run

```go
func main() {
	slog.SetDefault(slogx.New())

	if err := run(); err != nil {
		slog.Error("server exited", "err", err)
		os.Exit(1)
	}
}
```

把容易失败的工作放在 `run`。例如下面是初始化阶段的片段：

```go
cfg, err := config.Load()
if err != nil {
	return err
}
if err := cfg.Validate(); err != nil {
	return err
}

db, err := data.Open(ctx, cfg.Database)
if err != nil {
	return fmt.Errorf("open database: %w", err)
}
defer db.Close()
```

配置解析和校验在一起；数据资源获得成功后立即注册释放。`main` 看到错误时，`run` 中的 defer 已执行完。是否启动时迁移数据库取决于目标项目现有约定，不由本技能改变。

不要仅为了让 `main.go` 行数下降，把所有代码搬进同一个无边界的 `bootstrap` 函数；装配文件里的依赖关系也应能顺着读清楚。多命令 Go 后端优先把正式 HTTP 入口放在 `cmd/server/main.go`，与 `cmd/migrate`、其他工具命令并列。

用户选择迁移入口时，同步更新启动 / 编译命令、文档和测试路径，并验证生成流程；不把维持 `go run .` 当作硬约束。只有实际调用方需要兼容时才保留薄入口，避免重复维护两套装配。FFMAAS 已采用 `go run ./cmd/server` 和 `go build -o bin/ffmaas ./cmd/server`。

## 有名字的依赖与共享实例

多个相关构造函数确实共享这些依赖时，装配点可使用：

```go
type serviceDeps struct {
	Config *config.Config
	DB     *data.DB
	Cipher *secret.Cipher
	Probe  *modelprovider.Client
	Tracer *runtrace.Tracer
}

deps := serviceDeps{
	Config: cfg,
	DB:     db,
	Cipher: cipher,
	Probe:  probe,
	Tracer: tracer,
}
```

装配函数内部按需要构造仓库、运行组件和业务对象。下面是相关模块的片段：

```go
providerRepo := data.NewProviderRepo(deps.DB, deps.Cipher)
modelRepo := data.NewModelRepo(deps.DB)
groupRepo := data.NewModelGroupRepo(deps.DB)
audits := data.NewAuditRepo(deps.DB)

factory := modelprovider.NewFactory(data.NewFactoryRepo(deps.DB, providerRepo))
engine := rtwf.NewEngine(factory).SetTracer(deps.Tracer)

providers := biz.NewProviders(
	providerRepo,
	deps.Probe,
	audits,
	deps.Config.Providers.ProbeInterval.Duration(),
	deps.Config.Providers.ProbeConcurrency,
)
models := biz.NewModels(modelRepo, audits, providerRepo, deps.Probe, groupRepo)
groups := biz.NewModelGroups(groupRepo, audits)

modelService := service.NewModel(providers, models, groups).SetCatalog(factory)
```

`engine` 交给工作流服务，`factory` 同时交给模型服务；共享是由真实依赖决定的。不要每注册一个路由就重建仓库、签名器或模型工厂，也不要新增带反射的 DI 框架。

业务只拿它用到的对象；`Deps` 留在装配点。像 `NewModelGroupRepo(db)` 这样的简单构造保持简短即可。

## 构造与注册分开

在 HTTP 开始接收请求前，集中将构造好的服务交给生成的绑定点：

```go
func (s *services) register(db *data.DB) {
	handlerv1.SetPingService(service.Ping{})
	handlerv1.SetPlatformService(s.platform)
	handlerv1.SetMonitoringService(s.monitoring)
	handlerv1.SetModelService(s.model)
	handlerv1.SetWorkspaceService(s.workspace)
	handlerv1.SetWorkflowService(s.workflow)

	httpserver.SetReadyDB(db)
	httpserver.SetWorkflowRun(s.workflow.HandleRunStream)
}
```

这是 FFMAAS 对 Nexus HTTP 组织方式的适配：复用生成的 ServiceAPI，不照搬手写的 unary 路由。也不修改生成接口来迁就装配。

## 资源按依赖顺序收尾

在拥有资源的函数里明确表达顺序。以下片段放在命名返回值为 `err` 的函数中，`stopProbes` 需要先取消并等待探测任务：

```go
defer func() {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	// 已停止业务入口；先等生产者结束，再刷最终记录。
	probeErr := stopProbes(ctx)
	callbackErr := traceHandler.Flush(ctx)
	storeErr := store.Flush(ctx)
	err = errors.Join(err, probeErr, callbackErr, storeErr)
}()
```

这个期限只覆盖片段里的关闭链；HTTP 框架若有自己的排空期限，不能声称整个进程退出只需一个 timeout。数据库要等使用它的生产者和写入队列收尾后再关闭。

不要照抄参考项目中并行调用 `Spin` 又额外管理一套信号 / `Shutdown` 的具体实现。先核对当前 Hertz 版本的生命周期行为；启动监听错误不能被吞掉，信号处理必须有清楚的唯一归属。
