# Runtime Policy

CatPaw 是项目工作的 advisory orchestration runtime：它选择 workflow，维护 Work
Board，提供 Role Catalog、协作指导与 hard contract，并要求可验证的完成证据。
Agent Executor 负责上下文团队调度与 final adoption。CatPaw 内置关键 engineering
method contract；其它具体执行方法由当前 coding environment 与可用 skills 提供。

## Activation And Priority

当项目存在 `.catpaw/`、legacy `todos/`，或用户提到 CatPaw、Work、Milestone、
Evidence、迁移、review/plan tracking 时应用本 policy。

```text
current user instruction
> project-local rules
> installed CatPaw runtime
> optional methods and tool defaults
```

正常项目以 `~/.catpaw/` 为 trusted installed runtime。The source repo and
installed runtime are separate surfaces；修改 source repo 不会自动 activation、
安装或升级任何项目。

本文档中的 `catpaw` 是 executable entrypoint 简写：installed runtime 使用
`~/.catpaw/bin/catpaw.mjs`，source checkout 使用
`src/runtime/bin/catpaw.mjs`。CatPaw does not modify `PATH`；alias 或 symlink
由用户在独立授权下自行管理。

## Dispatch

任务开始时依次判断：

1. 用户结果、项目规则、外部操作与安全边界；
2. board 是否存在、是否有 active Work/Milestone、schema 是否需要迁移；
3. Mode：`Direct | Tracked | Gated`；
4. 是否属于现有 Milestone；
5. Agent Executor 是否需要 Agent、如何组合 Role、Task Envelope 与串并行 topology；
6. 需要哪些 Lens，以及 Independent Check 是 recommended 还是 required；
7. 下一阶段与验证入口。

Tracked/Gated 在 meaningful work 前简短告诉用户 Mode、原因、artifact 预期和
Next。Direct 保持轻量；发现风险或范围增长时立即升级。

完整 lifecycle 见 [Workflow](guidance/workflow.md)；root-cause debugging 与
RED/GREEN 的按需规则见 [Engineering Methods](guidance/engineering-methods.md)；
Role Catalog、Task Envelope、协作模式与 concurrency contract 见
[Agent Orchestration](guidance/agent-dispatch.md)。

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

## Work Board

Global runtime, local artifacts：

- runtime：`~/.catpaw/`；
- project board：`<project>/.catpaw/`；
- project board 的 native graph 只存 `index.md`、Milestone、Work Item、Plan 与
  typed Evidence；schema migration 可在 graph 外保留 `legacy/schema-1/` archive；
- 不把 runtime guidance、Lens、Agent recipe、schema 或 CLI source 复制进项目。

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
    └── topics/
```

Schema 与 metadata 的唯一机器契约是
[board-v2.json](schemas/board-v2.json)；CLI 负责 path、graph、dry-run patch、
staged write 与 doctor，不靠 agent 手工猜格式。

## Milestones

Milestone 只用于包含多个 Work Item 的连续阶段目标；Work Item 仍是最小可验证
单元。用户说“继续推进”“推进这一阶段”“后面不用每项都问我”时，先检查 active
Milestone，再按授权连续推进。见 [Milestones](guidance/milestones.md)。

## Independent Checks

Gated Work 和 security/release/migration/external/destructive risk 要求非 primary
判断。Tracked Work 遇到陌生边界、跨共享文件、弱测试、协议一致性或非平凡 UI
时默认建议 non-primary check；Agent Executor 选择 current-tool、reciprocal 或其它
可用 actor。若跳过 recommended check，记录 `subagent skipped because`。

检查返回偏题、为空或不可用时记录 `no usable output`，提供 fallback options，由
Agent Executor 选择下一 surface。Required 检查缺失时只能记录 gap；Gated close 需要
用户明确 accepted gap，且记录必须枚举并覆盖当前缺失的 gate。完整规则见
[Independent Checks](guidance/independent-checks.md)。

Optional methods 按当前 trigger 选择，不能接管 Mode、artifact 或 authorization；
Agent 只有在工具级边界预防性阻断写入时才能称为 `read-only`，prompt 或事后审计
不能替代该边界。

CatPaw 内置管理的 reciprocal read-only transport adapters 只有 `cc` 与 `cx`；它们
不是 Executor 可用 Agent 的完整 roster。具体 profile、fallback options 和 observable
session 见 [Agents](providers/README.md)。

## Progress And Completion

多步骤工作每完成一个 meaningful unit：

- 更新相关 Work/Plan/Milestone 与必要 Evidence；
- 告诉用户 Completed、Verification、当前动作和 Next；
- 已授权的连续工作继续推进，不让用户反复追问下一步；
- 仅在需要用户决策、外部操作、新授权或真实 blocker 时停下。

完成声明必须区分已运行验证、未运行验证与 remaining gap。Agent output、稳定
session、代码阅读和“看起来没问题”都不能代替 verification evidence。

## Git Authority And Safety

用户授权 change/build task 后，Agent Executor 可保留或通过 exact Task Envelope
显式指定一个 integration owner。每个 mutable integration surface 同一时间只能有一个
accountable writer。Executor 自己保留 integration ownership 时，可执行有助交付的本地、
可恢复 Git 操作：inspect，创建或切换 non-protected local task branch，创建 isolated
worktree，仅 stage 当前任务拥有的改动，完成 exact diff review、相关验证与
credential/secret scan 后创建 bounded local commits，以及移除没有未提交内容和 unique
commit 的 clean temporary worktree。这些操作不是强制 cadence；answer-only、review 或
diagnose 请求不隐含 commit。

被委派的 integration owner 只能写 assigned isolated surface。Integration ownership
本身不是 Git grant，也不放宽 Role ceiling、user/project authority 或 transport
enforcement。创建 candidate/reconciliation commit 需要 Builder Role 与 Builder Git
Envelope；把 Executor 已采用的 exact commits 引入 assigned non-protected integration
surface，则需要下述 Integration Git Envelope。

Agent Executor 对 Builder candidate 完成审查并决定 adoption 后，可指示 integration
owner 把 exact commits fast-forward 或 cherry-pick 到 non-protected integration branch；
目标 branch、base/head 与 commit list 必须先复核。发生 conflict、scope drift 或
unrelated changes 时停止自动 adoption，由 Executor 在原任务边界内重新判断。该能力
不覆盖 protected/base integration gate。

被委派的 integration owner 执行上述 adoption mutation 前，Task Envelope 必须明确
`integration adoption: allowed`，并绑定 assigned absolute worktree、non-protected target
branch/base、exact inbound commit list、allowed fast-forward/cherry-pick、verification 与
stop conditions。该 Integration Git Envelope 只允许 clean inbound adoption；出现 conflict、
需要 reconciliation edit 或新建其它 commit 时立即停止。Reconciliation edit/commit 需另行
承担 Builder Role 与完整 Builder Git Envelope。Executor 自己保留 integration ownership
时沿用 task-local Git authority，但仍必须先决定 adoption 并复核同样的 target 与 commits。

以下仍需当前用户明确授权：push、PR、deploy/publish；对 protected/base branch 的任何
update 或 integration，包括 direct commit、merge、cherry-pick 和 fast-forward；以及
amend、rebase、history rewrite、force、reset/clean、删除含用户改动或 unique commit 的
branch/worktree、secret access、scope/permission expansion，或其它外部可见、不可逆、
可能丢失数据的操作。These remote, protected, history-rewriting, or destructive
actions are explicit authorization gates。Project rule 与当前用户指令可以进一步收紧。

Integration owner 对 reconciliation、冲突处理、final verification 与 clean handoff
负责；不得混入 pre-existing 或其它 Agent/user 改动。Final adoption 只由 Agent
Executor 决定。Current-tool Builder 默认不获得 Git authority；只有 Executor 按
[Agent Orchestration](guidance/agent-dispatch.md) 在 Task Envelope 中显式委派
`local commits: allowed`，且 exclusive isolated worktree、dedicated non-protected
branch、clean baseline、exact scope 与 verification/secret-scan gate 全部成立时，
Builder 才可 stage exact task-owned changes 并创建 bounded local commit series。
Commit cadence 由 Executor 选择，但不能越过同一 Envelope、branch/worktree、scope 或
authority ceiling。Builder 不因 commit grant 自动成为 integration owner，Executor 必须
审查 candidate 后决定 reject、保留或采用。仅承担 Integrator Role 或 integration
ownership 不获得 commit authority；candidate/reconciliation commit 需要 Builder Role 与
Builder Git Envelope，exact inbound adoption 需要 Integration Git Envelope。Scout、Architect、Reviewer、Verifier、
未 opt-in Agent 与 CatPaw 当前 cc/cx external profiles must not stage or commit。Lens、
Role、Agent output、Evidence、CLI、hooks 与 optional methods 不能扩大授权，也不能把并发
Agent 变成共享 integration owner。

## Authority Map

| Need | Canonical owner |
|---|---|
| lifecycle, Mode, verification, progress | [Workflow](guidance/workflow.md) |
| Role Catalog, Task Envelope, advisory scheduling, concurrency | [Agent Orchestration](guidance/agent-dispatch.md) |
| debugging and RED/GREEN methods | [Engineering Methods](guidance/engineering-methods.md) |
| independent triggers, fallback, gap | [Independent Checks](guidance/independent-checks.md) |
| multi-Work phase orchestration | [Milestones](guidance/milestones.md) |
| runtime, adapter, registry, migration maintenance | [Maintenance](guidance/maintenance.md) |
| professional perspectives | [Lenses](lenses/README.md) |
| cc/cx recipes and sessions | [Agents](providers/README.md) |
| artifact metadata | [Schema 2](schemas/board-v2.json) |
| install/upgrade boundary | [AI Install](AI-INSTALL.md) |
