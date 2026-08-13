# Independent Checks

Independent Check 解决的是“是否需要非 primary 判断”，不是增加固定仪式。
它由三个独立选择组成。

## Lens

Lens 决定要补哪一种专业视角。只选择与当前风险有关的 Lens；一个 Agent 可以
使用多个 Lens，一个 Lens 也可以由不同 Agent 提供。

## Agent

Agent 是实际提供判断或执行工作的主体。Agent Executor 根据独立性、上下文、成本、
可用 transport 与 enforcement 选择 current-tool subagent、reciprocal cc/cx 或其它
可用 actor；CatPaw 不固定 provider 优先级。Agent 不等同于 Lens。Role Catalog、Task
Envelope、collaboration patterns 与 concurrency contract 由
[Agent Orchestration](agent-dispatch.md) 统一规定。

## Evidence

Evidence 是可检查的事实记录，例如 research、review、test、provider 或
reflection。只有可用输出和已执行验证才算 Evidence；进程启动、稳定输出、
退出码为零或“看起来没问题”本身都不够。

## Delivery And Adoption

每次 Agent 调用只在有判断价值时记录最小结果：

```text
delivery: usable | partial | empty | failed
adoption: accepted | rejected | superseded
verification: <command, Evidence path, or remaining gap>
```

`delivery` 只描述 Agent output 是否完整可用；`adoption` 只由 Agent Executor 在读取、
核实输出后给出。Executor 尚未完成判断时在正文标为 review pending，并省略
`adoption`。未决 conflict 保留为 finding 或待决事项，不增加第四种 adoption value。

`ACK`、process/session started、`task_complete`、closed edge 或 exit zero are not a
usable deliverable。Agent Executor 必须读取最终输出、复现重要 finding，并把
accepted/rejected/superseded 与验证依据说清楚。Partial/empty/failed 必须进入
Executor-selected fallback，不能满足 required Independent Check。Parent 在读取结果后关闭
child/session；re-review 应携带前次 finding、修复事实和缩小后的验证范围。

## Trigger

Independent Check **required**：

- Gated Work；
- security、release、migration、external action 或 destructive risk；
- 高影响 contract、数据完整性、权限边界或反复失败；
- primary Agent 无法独立证明的关键完成声明。

Independent Check **preferred/recommended**：

- Tracked Work 进入陌生模块或 ownership boundary；
- diff 较大、跨多个共享文件或同时修改 policy/spec/template；
- 测试薄弱、不可运行，或需要独立 verification plan；
- 非平凡 UI、协议、文档规则或迁移设计变更。

Direct Work 也可使用多个 Agent；Mode 不决定调用数量。当局部改动暴露上述风险时
升级 Mode 或执行检查。

## Check Fallback

- recommended 检查若确实不值得调用，记录 `subagent skipped because ...`。
- 调用成功但结果偏题、为空或不能支持结论时，记录 `no usable output`。CatPaw 提供
  current-tool、reciprocal cc/cx、其它可用 actor、缩小任务与 inline gap 等选项；
  Agent Executor 选择下一 surface，不按固定 fallback ladder 自动路由。
- required 检查不能用 inline 自审冒充独立性。Agent 不可用时记录 gap；只有
  用户明确同意、并逐项列出当前缺失 gate 的 `accepted gap` 才能满足 Gated
  close；旧 gap 不覆盖后来新增的缺口。
- 多轮技术讨论可保留同一可观察 Agent session，但每轮使用更新后的 Task Envelope，
  直到结论、blocked 或用户停止；不把“输出暂时稳定”推断为完成。

## Read-only Enforcement

Prompt-only `read-only` is not a read-only boundary。任何称为 read-only 的调用都必须
在 tool boundary 预防性阻断 write/delete/rename，并把权限限制在 exact protected
scope。可用控制包括：

- filesystem sandbox 或 read-only mount；
- 最小 tool allowlist；
- read-only SQLite URI、immutable snapshot 或只包含任务所需事实的 export；
- 限定 task scope 的输入副本，而不是把整个 home/state 路径交给 Agent。

如果环境不能阻断写入，调用只能标为 `no-write requested + audited`，不能满足
read-only gate。涉及用户状态、配置、凭据、生产数据或其它 sensitive surface 时，
不委派该读取；由 Executor 在已授权工具中查询后提供最小事实。每次 enforced
read-only 调用前记录 exact protected scope，结束后执行 side-effect audit；发现
意外修改立即停止、保留现场并报告，不能用 usable output 抵消副作用。

## Authorization

Independent Check 与 Agent output 不自行 authorize 任何 Git 或外部动作。Bounded
local branch/worktree/stage/commit 权限只来自当前 authorized task、runtime policy 与
exact Task Envelope；final adoption 只由 Agent Executor 决定，integration 由其指定的
accountable owner 执行。Agent Orchestration 中的 current-tool Builder Git exception
不适用于 Independent Check。执行检查的
Reviewer/Verifier subagent 或 external Agent must not stage or commit；它只能提出
finding、反驳、方案、patch 或验证建议。Push、
PR、deploy、对 protected/base branch 的任何 update/integration、history-changing 或
destructive operation、external side effect、secret access 或 permission expansion
仍需 explicit user authorization。
