# Agent Orchestration

CatPaw 向 Agent Executor 提供结构化 Role、协作模式、调度信号与 hard safety
contract。Executor 根据当前任务决定使用哪些 Agent、模型与 transport，如何组合 Role、
调用多少、串行还是并行、何时 fallback，以及最终采用哪些输出。

CatPaw 不生成 mandatory execution graph，也不以 Direct/Tracked/Gated、lifecycle stage、
available slots 或固定 provider 替 Executor 做团队决策。Executor 可以采用、调整或拒绝
调度建议，但不能扩大用户/项目授权，也不能弱化本文件的 hard contract。

## Ownership Boundary

| Layer | Owner | Responsibility |
|---|---|---|
| Hard runtime contracts | CatPaw | authority ceiling、mutable-surface isolation、required independence、Evidence 语义与 delivery/adoption 边界 |
| Advisory orchestration | CatPaw | Role Catalog、collaboration patterns、cost/risk signals、concurrency hazards 与 fallback options |
| Contextual decisions | Agent Executor | Agent/model/transport、Role composition、数量、顺序/并行、fallback、integration owner 与 final adoption |

Executor 指定一个明确的 **integration owner**，对候选输出的 reconciliation、冲突、
final verification 与 clean handoff 负责。它是当前任务的责任 token，不是持久 persona，
也不是第二个 adoption 决策者；final adoption 始终由 Executor 决定。

## Separation

- **Agent Executor** 是当前 host 中负责上下文调度与 final adoption 的 Agent。
- **Agent** 是执行一次或一组 bounded work 的 actor，可以是 current-tool subagent、
  reciprocal external Agent 或 Executor 可用的其它 actor。
- **Role** 是可组合的 responsibility contract，不是 Agent identity、personality、model、
  provider 或权限。一个 Agent 可承担多个 Role；同一 Role 可由多个 Agent 实例化。
- **Lens** 决定专业视角；一个 Agent/Role 可以组合多个 Lens。
- **Transport** 决定如何调用和观察；它不决定 Role、完成或 authority。
- **Task Envelope** 是一次委派的 bounded execution contract；它不是 board artifact、
  invocation ledger、scheduler state 或新的授权来源。
- **Evidence** 记录可复现事实；不 authorize Git、外部动作或权限扩张。

Effective authority 是以下边界的交集：

```text
user/project authority
∩ Role authority ceiling
∩ Executor's explicit Task Envelope grant
∩ transport/tool enforcement
```

任何一层缺失的权限都不能由 Role 名称、prompt、Agent output、Evidence 或可用工具补齐。

## Role Catalog

Canonical machine-readable contract 位于 [`catalog/roles.json`](../catalog/roles.json)，
可用 `catpaw agent roles` 和 `catpaw agent role --role <id>` 只读发现。

| Role | Core responsibility |
|---|---|
| Scout | 收集 source-backed facts、options、dependencies 与 material unknowns |
| Architect | 设计 system boundary、interface、alternatives 与 trade-offs |
| Builder | 实现并局部验证 exact bounded scope |
| Reviewer | 对 Plan、contract 或 change 做 adversarial review |
| Verifier | 独立复现 acceptance、failure path 与 completion evidence |
| Integrator | 组合 isolated outputs、处理 bounded reconciliation、准备 integration candidate |

Role Catalog 是开放的责任 vocabulary，不是封闭的 Agent 名册。Frontend、Backend、
Security 等 domain concern 通常通过 specialization 与 Lens 组合，不需要扩张为永久
persona tree。Required Independent Check 必须使用与被检查 Builder 不同的 actor；同一个
Agent 切换 Role 不产生独立性。

Architect 交付 proposal/contract，不拥有最终设计决策。Integrator 只能在 Executor
指定的 isolated non-protected surface 准备 candidate，不能决定 adoption、更新
protected/base 或执行 external action。

## Task Envelope

每次实质委派使用完整、最小、自包含的 Task Envelope：

```text
objective: <one verifiable outcome>
roles: <one or more catalog role ids>
facts: <source-backed context and current claims>
read scope: <exact paths or surfaces>
write scope: none | <exact isolated paths/surface>
constraints: <project rules, forbidden actions, acceptance focus>
deliverable: <required structure and completion evidence>
verification: <commands, checks, or reproduction expected>
dependency: <inputs, ordering facts, concurrency boundary>
budget: <time, calls, or context bound when useful>
stop condition: <done, blocked, conflict, or uncertainty threshold>
authority: <explicitly allowed actions and Git envelope when applicable>
```

一个 Envelope 可组合多个 Role，不要求 one primary capability。旧 Envelope 的单个
`capability` 可作为单 Role 输入理解，但新委派使用 `roles`。多轮调用应加入上一轮
claim、Executor critique、已采纳事实和缩小后的下一问题；不得依赖 Agent 的全局记忆、
旧 session 或 provider customization 补齐关键约束。

## Advisory Scheduling Signals

Mode 和 lifecycle stage 说明风险与所需证据，不决定 Agent 数量或 Role assignment。
Executor 可以参考这些信号：

| Signal | Possible response, not a mandate |
|---|---|
| material unknown / unfamiliar boundary | Scout，或多个 Scout 并行调查不同事实源 |
| high-impact architecture choice | Architect alternatives、reciprocal critique 或 inline decision |
| exact isolated implementation scope | 一个或多个 Builder；也可由 Executor 直接实现 |
| contract/blast-radius risk | Reviewer with relevant Lens |
| critical completion claim | non-primary Verifier |
| several reviewed isolated outputs | Integrator candidate followed by Executor adoption |
| low information gain or high handoff cost | 不委派或复用已有 Agent/context |

成本、延迟、上下文复制、integration overhead 与 expected information gain 都是调度输入。
CatPaw 不规定 minimum/maximum calls，也不因为任务短就禁止并行或因为 slots 可用就要求
扩编。Executor 应让每次调用产生可采用的 bounded deliverable，而不是为了 invocation
count、仪式或 Role 覆盖率调用 Agent。

## Collaboration Patterns

以下 pattern 可单独或组合使用：

- **Parallel reconnaissance**：多个 Scout 分别调查独立事实源或假设。
- **Competing proposals**：多个 Architect 给出替代方案，由 Executor 比较 trade-off。
- **Isolated build slices**：多个 Builder 在独立 mutable surface 实现可组合 slice。
- **Competing implementations / tournament**：多个 Builder 在独立 worktree 对同一逻辑
  scope 产出候选，由 Reviewer/Verifier 提供事实，Executor 选择或组合。
- **Builder -> Reviewer / Verifier**：实现后交给不同 actor 检查 contract 或 acceptance。
- **Reciprocal critique**：Agent 相互攻击假设或 proposal；Executor 负责收敛。
- **Isolated fan-in**：Integrator 在独立 non-protected surface 组合已知 provenance 的
  outputs，再交给 Reviewer/Verifier 与 Executor。
- **Executor-selected fallback**：delivery partial/empty/failed 时，Executor 从当前可用
  surface 中选择换 Agent、换 transport、缩小任务、inline 处理或记录 gap。

Pattern 不是 workflow stage，也不自动授予 write、Git 或 external authority。

## Concurrency And Isolation Contract

并行的 hard boundary 是：**不同 Agent 不得并发写同一个 mutable surface**。Mutable
surface 包括 worktree、index/staging area、database、runtime state、external system 或
其它会相互覆盖的状态。

- 同一逻辑文件或目标可以被多个 Builder 并行处理，但每个 candidate 必须位于独立
  worktree/state surface；不要求跨独立 worktree 的 logical write scope 互斥。
- 同一个 worktree 或 integration surface 同时只能有一个 accountable writer；需要
  handoff 时先停止上游写入、记录 provenance，再转移 ownership。
- Read-only Agent 可以共享事实源；如果 tool boundary 不能阻断写入，只能标记
  `no-write requested + audited`，不能冒充 enforced read-only。
- 有真实 order dependency 时，后续 Envelope 必须携带已采用的上游事实。Executor 仍可
  并行执行不依赖该事实的其它工作。
- side-effect collision、baseline drift、scope ambiguity、unexpected files 或 conflict
  出现时，对相关 mutable surface 停止并发并重新判断。

这些约束不要求全局串行。CatPaw 提供 hazard，Executor 决定 topology。

## Builder Git Envelope

Current-tool Agent 只有承担 Builder Role，并在已授权 change/build task 中获得显式
Git Envelope 时，才可以在一个 validated exclusive worktree 与 dedicated
non-protected branch 创建 **bounded local commit series**：

- Executor 预先确保或指定 absolute worktree、exact branch/base、clean baseline、
  exact write scope、allowed Git actions、verification 与 stop conditions；
- Envelope 明确写 `local commits: allowed`；省略或写 `forbidden` 时不得 stage/commit；
- Builder 只 stage exact task-owned scope；每次 commit 前检查 staged diff，按 bounded
  change 运行 relevant verification，并在 handoff 前完成 credential/secret scan；
- commit 数量与边界由 Executor 根据可审查性选择，但所有 commit 都必须位于同一
  Envelope、branch、worktree、scope 与 authority ceiling 内；
- handoff 返回 base/head、commit list、committed paths、verification、scan result 与
  worktree status。

Builder 不得 push、创建/修改 PR、merge 到 protected/base、cherry-pick 到其它 surface、
amend、rebase/history rewrite、reset/clean、force、fetch/pull、stash、tag、访问 secret、
删除 branch/worktree 或执行 Envelope 外 Git mutation。出现 drift、scope expansion、
unexpected changes、conflict 或 verification failure 时停止。

仅承担 Integrator Role 或被指定为 integration owner 都不获得 commit authority。
Candidate/reconciliation commit 需要同时承担 Builder Role 与完整 Builder Git Envelope。
Executor 自己保留 integration ownership 时，沿用 runtime policy 的 task-local Git
authority。Scout、Architect、Reviewer、Verifier、未 opt-in 的 Agent 与 CatPaw 当前
cc/cx external profiles must not stage or commit。

## Integration Git Envelope

Agent Executor 明确采用 exact candidate 后，可以向被委派的 integration owner 发出
Integration Git Envelope，把该 candidate cleanly 引入 assigned non-protected integration
surface：

- Envelope 明确写 `integration adoption: allowed`，并绑定 absolute worktree、target
  branch/base、exact inbound commit list、allowed fast-forward/cherry-pick、verification 与
  stop conditions；
- owner 在 mutation 前复核 target、base/head、commit list、clean status 与 candidate
  provenance；mutation 后运行 integration verification 并报告结果；
- 该 Envelope 不允许选择 candidate、扩大 commit list、更新 protected/base、push、处理
  conflict、做 reconciliation edit 或创建 clean cherry-pick 之外的新 commit；
- conflict、base drift、unexpected changes 或 verification failure 立即停止，由 Executor
  重新判断。Reconciliation edit/commit 需要 Builder Role 与独立的 Builder Git Envelope。

Integration Git Envelope 是 Executor adoption 决定的受限执行机制，不是 Integrator Role
或 integration ownership 的隐含权限，也不改变 explicit authorization gates。

## Delivery And Adoption

每个调用返回 bounded deliverable、已运行 verification 与 remaining gap。Delivery 与
adoption 语义由 [Independent Checks](independent-checks.md) 统一定义。ACK、进程启动、
exit zero、session stable 或 Agent 自称完成都不是 adoption。

Integration owner 检查 provenance、candidate diff、verification、credential scan、clean
status 与 conflicts，准备可供选择的结果。只有 Agent Executor 可以将输出标为 adopted、
rejected 或 superseded；Integrator、Reviewer、Verifier、Role Catalog、session、Lens 与
Evidence 都不能替 Executor 采纳，也不能 authorize Git 或 external action。

CatPaw 管理的 cc/cx 只是内置 read-only transport adapters，不是 Executor 可用 Agent
的完整 roster。其 invocation、observation 与 fallback surfaces 见
[Agents](../providers/README.md)。
