# Agent Dispatch

CatPaw 只在委派能降低关键未知、隔离工作或提供必要独立判断时调用 Agent。
调度以风险和可交付结果为依据，不以模型数量、available slots 或固定身份为依据。

## Separation

- **Agent** 是实际执行一次调用的主体，可以是 current-tool subagent 或 reciprocal
  external Agent。
- **Capability** 是 temporary、per-call 的任务职责，不是 Agent 的持久身份或权限。
  每次调用只选择 one primary capability。
- **Lens** 决定从哪个专业视角检查问题；Lens 不是 role 或 capability，一个调用可用
  多个 Lens。
- **Transport** 决定如何发送和观察调用；transport 不是 role 或 capability。
- **Task Envelope** 是本次调用的 bounded prompt contract；它不是 board artifact、
  invocation ledger 或新的授权来源。
- **Evidence** 记录可复现事实。Evidence does not authorize Git、外部动作或权限扩张。

## Temporary Capabilities

### Scout

用于 Think/Plan 的 read-only 调查：定位事实、依赖、方案与未知量。交付 source-backed
finding、选项、风险和 remaining unknown；不修改实现。

### Builder

用于边界明确的实现切片。必须有 exact、exclusive write scope，并交付 patch/worktree
changes、已运行验证和 handoff。默认只交付 working-tree changes，不 stage/commit。

Current-tool Builder 只有同时满足下列条件时才可获得一次 `slice commit` authority：

- 当前请求已经授权 change/build，且项目规则没有收紧该能力；
- Primary 预先创建并验证 exclusive isolated worktree 与 dedicated non-protected
  slice branch，记录 exact base commit；Builder 不自行创建、切换或删除 branch/worktree；
- Task Envelope 明确写 `slice commit: allowed`、绝对 worktree、exact branch/base、
  exact write scope 与 verification；省略或写 `forbidden` 时不得 stage/commit；
- baseline clean 且没有 user/other-Agent changes；Builder 只 stage exact scope，完成
  exact staged diff review、relevant verification 与 credential/secret scan；
- 每个 Envelope 最多创建一个 local slice commit，并返回 base/head/commit hash、
  committed paths、verification 与 clean worktree status。

Slice commit 不转移 integration ownership。Builder 不得 push、创建/修改 PR、merge、
cherry-pick、amend、rebase、reset/clean、force、删除 branch/worktree、访问 secret，或
更新 protected/base branch；也不得 fetch/pull、stash、tag，或执行 exact stage + one
commit 之外的任何 Git mutation/remote Git operation。出现 baseline drift、scope
overlap、conflict、额外文件或验证失败立即停止。Primary 独立审查 commit diff 与 handoff 后才可 reject、保留，或在
non-protected integration branch 上采用；protected/base integration 仍需用户明确授权。
Primary 的采用动作可使用已复核的 fast-forward/cherry-pick；若发生 conflict、base
drift 或 unrelated changes，停止自动 adoption，不把 conflict resolution 退回 Builder。

只有 host 能把写入隔离在 declared scope/worktree 且 Primary 能执行 post-handoff
side-effect audit 时才委派 Builder。当前 cc/cx transport 是 read-only，不提供 external
Builder，也不继承此 exception。

### Reviewer

用于对 Plan、diff、contract 或风险做 adversarial、non-primary 判断。默认 no-write；
交付按严重度排序、可复现的 findings 和 remaining risk。

### Verifier

用于独立复现、执行命令或确认 acceptance。默认 no-write，不顺手修 business code；
交付命令、结果、环境限制和 remaining gap。Required Reviewer 与 Verifier 必须是
non-primary，且不得由同一 Builder 对自己的切片充当独立检查。

## Task Envelope

每次委派都提供完整、最小、自包含的 Task Envelope：

```text
objective: <one verifiable outcome>
capability: scout | builder | reviewer | verifier
facts: <source-backed context and current claims>
read scope: <exact paths or surfaces>
write scope: none | <exact exclusive paths>
constraints: <project rules, forbidden actions, acceptance focus>
deliverable: <required structure and completion evidence>
verification: <commands, checks, or reproduction expected>
dependency: <inputs, ordering, concurrency boundary>
budget: <time, calls, or context bound>
stop condition: <done, blocked, conflict, or uncertainty threshold>
authority: <explicitly allowed actions; Builder must state slice commit: allowed | forbidden>
```

Envelope 只携带完成任务所需事实。不得依赖 Agent 的全局记忆、上次 session、skills
或 provider customization 补齐关键约束；多轮调用要加入上一轮 claim、Primary
critique 和缩小后的下一问题。`authority` 只能收窄已有授权，不能由 prompt 扩张。

## Dispatch Triggers

| Mode / stage | Minimum useful dispatch |
|---|---|
| Direct | 默认 inline、不委派；material unknown 调用 Scout；Independent Check trigger 调用 Reviewer/Verifier 或升级 Mode |
| Tracked | 有实质未知、边界明确的独立切片，或 non-primary view 能改变结论时才委派 |
| Gated | Builder 可选；独立 Reviewer 或 Verifier required，并按 Independent Checks 留 Evidence |
| Think / Plan | Scout 只处理会影响 scope、contract 或方案的未知量 |
| Build | Builder 只处理 exact exclusive write scope；否则由 Primary 构建 |
| Review | Reviewer 检查高风险 contract、diff 与回归面 |
| Test | Verifier 独立复现关键 acceptance 或失败路径 |
| Ship / Reflect | Primary-owned；不新派 Builder，Primary 负责 integration、报告与 reusable lesson |

选择达到当前证据要求的最少调用。重复读取同一上下文、可由 Primary 顺手完成的短步骤，
或交付价值低于 handoff/merge 成本时不委派。

## Parallelism Gate

并行不是因为有 available slots。只有同时满足以下条件才并行：

- objectives 独立，且 no shared mutable files、runtime state 或外部 state；
- 没有 order dependency，各调用不依赖另一个调用的未完成结论；
- outputs 可独立采用或 composable，失败一个不会污染另一个；
- 预期节省时间明显大于 Task Envelope、context 和 integration overhead。

多个 Builder 必须各自拥有 dedicated branch + isolated worktree，并具有互斥的 exact
write scope；任何 commit 仍只是各自 slice handoff。Read-only
Scout/Reviewer/Verifier 可以读取同一事实源，但不得产生共享 mutation。任一条件不满足，
otherwise use serial execution；先产出上游事实，再给下游新的 Envelope。

## Delivery And Adoption

每个调用返回 bounded deliverable 和已运行 verification；Independent Check 的
delivery/adoption 分类由 [Independent Checks](independent-checks.md) 负责。Primary
必须读取最终输出、复现关键 finding，并明确 adopt、reject 或用更新事实 supersede。

始终只有 one primary integration owner。Current-tool Builder 可在 exact opt-in 下成为
自己那一个 local commit 的 slice commit owner，但 Primary 仍负责冲突消解、scope
adoption、最终验证与 integration。Primary 采用前检查 base/head、exact commit diff、
verification、secret scan 和 clean status；冲突或 drift 由 Primary 停止/处理，不能让
Builder 扩大 scope。并发 Agent 不能共享 integration ownership。Agent output、session
状态、Lens 与 Evidence 都不能自行 authorize Git、external action、secret access 或
permission expansion。

cc/cx 的 transport、fallback 和 observable session 见 [Agents](../providers/README.md)。
