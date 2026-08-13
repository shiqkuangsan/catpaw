# CatPaw Workflow

CatPaw 使用一条稳定生命周期，并为任务选择最轻且安全的 Mode：

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

阶段可以快速通过，也可以在发现新事实后回退；不得为了省步骤而隐藏风险、
未决问题或失败证据。

## Modes

### Direct

用于范围窄、局部、可逆且风险低的工作。通常不创建 durable Work Item 或
Plan，但仍须理解问题、实施、检查并报告验证结果。

### Tracked

用于多步骤、跨文件、涉及共享行为，或需要持续追踪的工作。创建 Work Item
和 Plan；按风险记录 research、review、test 或 reflection Evidence。

### Gated

用于安全、发布、迁移、外部操作、破坏性操作或高影响 contract 变更。创建
Work Item 和 Plan，要求 independent check 与完成所需 Evidence；缺口只能由
用户明确接受。

Mode 决定最低证据，不决定 Agent、Role、数量、model/transport 或串并行 topology。
Gated 要求独立 Reviewer 或 Verifier；其它团队组成由 Agent Executor 根据当前上下文
决定。Role Catalog、Task Envelope、advisory scheduling 与 concurrency contract 见
[Agent Orchestration](agent-dispatch.md)。

先选 lightest safe mode。执行中发现范围、不可逆性或风险上升时立即升级；
不得通过降级 Mode 绕过 Evidence 或 authorization gate。

## Optional Execution Methods

CatPaw 根据当前风险和 lifecycle trigger 选择一个 specific method，例如设计探索、
RED/GREEN、系统化调试、并行调查或完成前验证；不把方法路由交给 provider 的
meta-skill，也不以 skill 文件是否加载衡量方法是否执行。CatPaw-owned Debugging 与
RED/GREEN contract 见 [Engineering Methods](engineering-methods.md)。

- 只加载能改变当前动作或证据要求的方法。For the same lifecycle stage and
  unchanged context, do not reload it；trigger、约束或失败假设变化后才重新选择。
- Optional method cannot choose CatPaw Mode, artifact path 或 authorization。Agent
  Executor 在当前用户/项目边界内决定 branch/worktree topology 与 commit cadence；
  optional method 不能替它做 adoption 或扩大权限。
- 方法输出仅在影响 Plan、finding、verification 或 reusable lesson 时写入现有
  Evidence；不创建独立 method ledger、重复 plan 或 provider-specific artifact。
- 评估方法价值看是否真正执行、交付是否 usable、结论是否吸收并验证，而不是
  invocation count、review 轮数或 token 数。

## Lifecycle Methods

### Think

- 回到用户结果、约束、非目标与真实事实源，而不是照搬惯例。
- Bug 或异常先找 root cause；不要只修表象。
- 选择 Mode、需要的 Lens，以及 Independent Check 是否 recommended/required。
- 陌生边界或关键未知量需要持久化时，记录 research Evidence。
- Agent Executor 可使用一个或多个 Scout、Architect、其它可用 Role 或 inline 调查；
  以信息增益、来源独立性和 handoff cost 为调度信号，不以 stage 固定 Role。

### Plan

- 将工作拆成最小可验证单元，写明 contract、验收、验证命令和失败处理。
- Tracked/Gated 维护 Plan；Direct 只需在当前对话中保持清晰步骤。
- 多个连续 Work Item 共享一个阶段目标时使用 Milestone，不用 Milestone 替代
  Work Item。
- 每次实质委派写 bounded Task Envelope；记录真实依赖和 mutable-surface ownership，
  由 Executor 选择串行、并行、competing candidates 或其它 topology。

### Build

- 沿既有 ownership boundary 实施；behavior-sensitive work 按 trigger 使用
  RED/GREEN，bug 或异常先按 Debugging 证明 root cause。
- 保持 patch 紧凑；每个可验证单元完成后同步 Work/Plan/Milestone 状态。
- 发现计划假设错误时返回 Think/Plan，不伪装成正常进展。
- Writer 必须有 exact isolated mutable surface。多个 Builder 可以在独立 worktree 对同一
  logical scope 产出 competing candidates；不得并发写同一个 mutable surface。

### Review

- 以最可能出错的事实、contract、边界和回归为中心进行 adversarial review。
- 选择相关 Lens；需要非 primary 判断时按 Independent Check 规则调用 Agent。
- finding 必须可复现并标明影响；Agent 输出只是证据，不是结论授权。
- Gated review 使用与 Builder 不同的 non-primary Reviewer 或 Verifier。

### Test

- 先运行最小相关验证，再按 blast radius 扩展到集成、回归或交互验证。
- 区分已运行、未运行、失败与环境受限；不要把代码阅读当作 verification evidence。
- Tracked/Gated 在结果影响 closeout 判断时记录 test Evidence。
- 关键 acceptance 需要独立复现时使用 Verifier，不让它顺手修改 business code。
- Evidence 的 Record 必须包含 substantive body；dry-run 可以预览 placeholder，
  `evidence add --apply` 必须提供非空 `--body`。
- `status: done` 的 Gated Work 必须有 usable test + independent review/provider Evidence，
  或存在用户明确接受、逐项列出并覆盖当前缺失 gate 的 gap；close、doctor 与
  migration validation 使用同一判断。

### Ship

- 汇总 diff、verification evidence、未决风险、回滚或恢复路径。
- 在 authorized task 内，Agent Executor 自己保留 integration ownership 时，可按 runtime
  policy 创建 non-protected local task branch/worktree，仅 stage 当前任务拥有的文件，
  并在 exact scope review、相关验证与 credential/secret scan 后创建 bounded local
  commits；不得 stage unrelated、pre-existing user 或其它 Agent 改动。
- 被委派的 integration owner 可写 assigned isolated surface，但 integration ownership
  本身不授予 Git。Candidate/reconciliation commit 需要 Builder Role 与 Builder Git
  Envelope；Executor 决定 adoption 后，exact inbound fast-forward/cherry-pick 需要绑定
  exact target/base/commits 的 Integration Git Envelope。
- Current-tool Builder 默认只交付 worktree changes；只有满足 Agent Orchestration 的
  exact opt-in、exclusive worktree/branch、clean baseline 与 Git Envelope 时才可创建
  bounded local commit series。它不获得 integration ownership；Agent Executor 审查后
  才决定 adoption，并指示 integration owner 是否在 non-protected integration branch
  采用。被委派的 owner 仅可按 Integration Git Envelope 执行 clean inbound adoption；
  出现 conflict、base drift、reconciliation edit 或 unrelated changes 时停止自动 adoption。
- Scout、Architect、Reviewer、Verifier、未 opt-in 的其它 Agent 与 CatPaw 当前 cc/cx
  external profiles must not
  stage or commit；只交付 patch、worktree changes、finding 或 evidence。
- 移除 temporary worktree 前确认它 clean 且没有会变成不可达的 unique commit。
- Push、PR、deploy/publish；对 protected/base branch 的任何 update/integration，包括
  direct commit、merge、cherry-pick、fast-forward；以及 amend、rebase、history rewrite、
  force、reset/clean 和 unsafe branch/worktree deletion 仍需 explicit user authorization。
- Ship readiness、Agent output 或成功的工具结果都不等于外部动作已授权或执行。

### Reflect

- 只提炼能改变后续判断或执行的 reusable lesson。
- 需要持久化时写 reflection Evidence；不维护泛化工作日记或重复规则。
- 报告本段完成项、验证、剩余风险与明确的下一步。

## Continuous Progress

多步骤任务每完成一个 meaningful unit 就更新相关 artifact，并简短告诉用户：
已完成什么、验证结果、正在做什么、下一个 checkpoint。已授权的 Milestone 或
连续 Plan 应继续推进，不要求用户反复询问“下一步”；仅在需要决策、外部操作、
新增授权或真实 blocker 时停下。

CatPaw workflow 提供上述 bounded local Git 默认权限；Review、Lens、Agent output
与 Evidence 不能扩大它。Remote、protected、history-changing、destructive、secret
或 permission-changing 操作仍按明确 authorization 处理。
