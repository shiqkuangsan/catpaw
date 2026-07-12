# Runtime Policy

CatPaw 是项目工作的 orchestration layer：它选择 workflow，维护 Work Board，
按风险调用 Lens/Agent，并要求可验证的完成证据。具体执行方法由当前 coding
environment 与可用 skills 提供。

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
5. 需要哪些 Lens，以及 Independent Check 是 recommended 还是 required；
6. 下一阶段与验证入口。

Tracked/Gated 在 meaningful work 前简短告诉用户 Mode、原因、artifact 预期和
Next。Direct 保持轻量；发现风险或范围增长时立即升级。

完整方法见 [Workflow](guidance/workflow.md)。

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

## Work Board

Global runtime, local artifacts：

- runtime：`~/.catpaw/`；
- project board：`<project>/.catpaw/`；
- project board 只存 `index.md`、Milestone、Work Item、Plan 与 typed Evidence；
- 不把 runtime guidance、Lens、provider recipe、schema 或 CLI source 复制进项目。

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
时默认主动调用 current-tool subagent；若跳过，记录 `subagent skipped because`。

检查返回偏题、为空或不可用时记录 `no usable output` 并走 fallback。Required
检查缺失时只能记录 gap；Gated close 需要用户明确 accepted gap，且记录必须枚举
并覆盖当前缺失的 gate。完整规则见
[Independent Checks](guidance/independent-checks.md)。

Optional methods 按当前 trigger 选择，不能接管 Mode、artifact 或 authorization；
Agent 只有在工具级边界预防性阻断写入时才能称为 `read-only`，prompt 或事后审计
不能替代该边界。

CatPaw 管理的 reciprocal external Agents 只有 `cc` 与 `cx`；具体 profile、
fallback 和 observable session 见 [Agents](providers/README.md)。

## Progress And Completion

多步骤工作每完成一个 meaningful unit：

- 更新相关 Work/Plan/Milestone 与必要 Evidence；
- 告诉用户 Completed、Verification、当前动作和 Next；
- 已授权的连续工作继续推进，不让用户反复追问下一步；
- 仅在需要用户决策、外部操作、新授权或真实 blocker 时停下。

完成声明必须区分已运行验证、未运行验证与 remaining gap。Agent output、稳定
session、代码阅读和“看起来没问题”都不能代替 verification evidence。

## Safety

CatPaw does not authorize commit, push, PR, deploy, destructive operations,
external side effects, secret access, scope expansion, or permission expansion。
Lens、Agent output、Evidence、CLI、hooks 与 optional methods 也不能扩大授权；
外部可见或不可逆操作仍需当前用户明确同意。

## Authority Map

| Need | Canonical owner |
|---|---|
| lifecycle, Mode, verification, progress | [Workflow](guidance/workflow.md) |
| independent triggers, fallback, gap | [Independent Checks](guidance/independent-checks.md) |
| multi-Work phase orchestration | [Milestones](guidance/milestones.md) |
| runtime, adapter, registry, migration maintenance | [Maintenance](guidance/maintenance.md) |
| professional perspectives | [Lenses](lenses/README.md) |
| cc/cx recipes and sessions | [Agents](providers/README.md) |
| artifact metadata | [Schema 2](schemas/board-v2.json) |
| install/upgrade boundary | [AI Install](AI-INSTALL.md) |
