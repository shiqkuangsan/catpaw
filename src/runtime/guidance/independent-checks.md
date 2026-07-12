# Independent Checks

Independent Check 解决的是“是否需要非 primary 判断”，不是增加固定仪式。
它由三个独立选择组成。

## Lens

Lens 决定要补哪一种专业视角。只选择与当前风险有关的 Lens；一个 Agent 可以
使用多个 Lens，一个 Lens 也可以由不同 Agent 提供。

## Agent

Agent 是实际提供判断或执行工作的主体。优先选择成本低且上下文合适的
current-tool subagent；需要另一模型、用户点名“老二”或当前工具自审不足时，
按 cc/cx recipe 调用 reciprocal Agent。Agent 不等同于 Lens。

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

`delivery` 只描述 Agent output 是否完整可用；`adoption` 只由 Primary Agent 在读取、
核实输出后给出。Primary Agent 尚未完成判断时在正文标为 review pending，并省略
`adoption`。未决 conflict 保留为 finding 或待决事项，不增加第四种 adoption value。

`ACK`、process/session started、`task_complete`、closed edge 或 exit zero are not a
usable deliverable。Primary Agent 必须读取最终输出、复现重要 finding，并把
accepted/rejected/superseded 与验证依据说清楚。Partial/empty/failed 必须进入
fallback，不能满足 required Independent Check。Parent 在读取结果后关闭
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

Direct Work 默认 inline；当局部改动暴露上述风险时升级 Mode 或执行检查。

## Autonomous Routing

- primary Agent 应在触发条件出现时主动调用，不等待用户提醒。
- recommended 检查若确实不值得调用，记录 `subagent skipped because ...`。
- 调用成功但结果偏题、为空或不能支持结论时，记录 `no usable output`，然后换
  current-tool subagent、reciprocal cc/cx Agent，或使用明确的 inline Lens。
- required 检查不能用 inline 自审冒充独立性。Agent 不可用时记录 gap；只有
  用户明确同意、并逐项列出当前缺失 gate 的 `accepted gap` 才能满足 Gated
  close；旧 gap 不覆盖后来新增的缺口。
- 多轮技术讨论应保留同一可观察 Agent session，直到结论、blocked 或用户停止；
  不把“输出暂时稳定”推断为完成。

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
不委派该读取；由 primary 在已授权工具中查询后提供最小事实。每次 enforced
read-only 调用前记录 exact protected scope，结束后执行 side-effect audit；发现
意外修改立即停止、保留现场并报告，不能用 usable output 抵消副作用。

## Authorization

An Independent Check does not authorize commit, push, PR, deploy, destructive
operations, external side effects, secret access, or permission expansion。它
只能提出 finding、反驳、方案、patch 或验证建议。
