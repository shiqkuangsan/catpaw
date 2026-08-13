# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw 是一个面向 coding agent 的 advisory orchestration runtime。它保留一条稳定的
开发 lifecycle，选择最轻且安全的执行模式，提供结构化 subagent Role 与协作指导，
只持久化有长期价值的项目事实，并用可执行检查保证机械一致性。

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

Source runtime 版本：`3.4.0`。项目工作板使用 **board schema 2**。

Activation 是 machine-local 状态，source checkout 不能替所有机器断言 current 或
pending；使用 `node scripts/verify-runtime.mjs` 比较当前机器。Installed runtime
缺失或较旧时是 `pending activation`，与 source 匹配并验证后才是 current。
Building source does not automatically install, apply, or migrate CatPaw。

仓库地址：https://github.com/shiqkuangsan/catpaw

## 核心模型

### Modes

| Mode | 适用场景 | 默认持久化 |
|---|---|---|
| `Direct` | 范围窄、局部、可逆、低风险 | 默认不建 artifact，但仍需验证和汇报 |
| `Tracked` | 多步骤、跨文件、改变共享行为或需要跨会话连续推进 | Work Item + Plan，按需补 Evidence |
| `Gated` | 安全、发布、迁移、外部系统、破坏性操作或高影响 contract | Work Item + Plan + 必需的 Independent Check 与 Evidence |

CatPaw 从 lightest safe mode 开始；范围或风险上升时升级。Mode 从不自动授权外部
操作或破坏性操作。

### Work Board

项目状态位于 `<project>/.catpaw/`：

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
```

Schema 2 只有五类 artifact：

| Artifact | 作用 |
|---|---|
| Index | 当前 dashboard 与 schema 标记 |
| Milestone | 聚合多个 Work Item 的可选阶段目标 |
| Work Item | 最小可验证、可独立收口的持久工作单元 |
| Plan | 与 Work 绑定的 contract、步骤、验收与验证入口 |
| typed Evidence | `research`、`review`、`test`、`provider` 或 `reflection` 事实 |

Schema 1 migration 可能额外生成 `legacy/schema-1/`。它是带 checksum manifest 的
只读迁移归档，不是第六类 artifact；schema 2 的 status、doctor 与 mutation 会忽略它。

普通用户不需要为迁移补 metadata：CatPaw 会依次使用明确事实、canonical 结构、
限定范围的正文与 artifact 关系推断缺失字段，同时保留全部原文件用于审计和回滚。

Direct 工作通常只留在对话中；Tracked/Gated 在持续协作确有价值时才写入工作板。

### Judgment

CatPaw 将判断拆成三个不同问题：

- **Lens**：需要补什么专业视角；
- **Agent**：由谁执行或提供判断；
- **Independent Check**：何时推荐或必须获得非 primary 视角。

五张 Lens 卡是 Value & Scope、System & Contracts、Experience、Security 和
Performance。工程、review、测试、发布、调试与复盘属于 lifecycle method，不再
另建一套角色层级。CatPaw 内置紧凑的 root-cause Debugging 与按风险触发的
RED/GREEN，不要求通用 meta-skill 或逐项设计审批仪式。

CatPaw 向 Agent Executor 提供 advisory orchestration。结构化 Role Catalog 将 Scout、
Architect、Builder、Reviewer、Verifier 和 Integrator 定义为可组合的责任 contract。
一个 Agent 可以承担多个 Role，同一 Role 也可由多个 Agent 实例化；required
independence 仍要求不同 actor。每次实质委派用 bounded Task Envelope 携带 exact
context、scope、deliverable、verification 与 authority。

Executor 选择 Agent、model、transport、Role composition、数量、顺序/并行、fallback、
integration owner 与 final adoption。CatPaw 提供协作 pattern 和 concurrency hazard，
但不生成 mandatory team graph。Hard boundary 是不同 Agent 不得并发写同一个 mutable
surface；位于独立 worktree 的 competing candidates 可以修改同一 logical scope。

CatPaw 内置的 reciprocal read-only transports 是 `cc`（Claude Code）与 `cx`
（Codex），但它们不是 Executor 可用 Agent 的完整 roster。OpenCode 可以作为读取
CatPaw 规则的 host，但不是 CatPaw 管理的直接 transport。

## Hybrid Runtime

Runtime 内部有三个行为表面：

| Surface | 职责 |
|---|---|
| Always-on Rules | 紧凑的路由、安全、进度与授权规则 |
| On-demand Guidance | Workflow、Agent orchestration、engineering methods、Milestone、Independent Check、Lens 与 Agent recipe |
| Executable Tools | Board graph、schema 校验、dry-run patch、迁移和可观察 Agent session |

存储与 activation 链是另一条轴线：

```text
source -> dist -> installed -> project board
```

Agent Executor 负责语境调度与 adoption 判断，CLI 负责确定性记录与校验，用户负责
授权写入和外部影响。设计依据见
[Hybrid Runtime ADR](docs/decisions/0019-catpaw-3-hybrid-runtime.md)。

## 从 Source 开始

```bash
git clone https://github.com/shiqkuangsan/catpaw.git
cd catpaw
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

Build 根据 [`src/runtime/runtime-manifest.json`](src/runtime/runtime-manifest.json)
生成 `dist/runtime/`。Verify 会检查 source/dist、在临时工作板执行 CLI smoke，并把
较旧的 installed runtime 报告为 `pending activation`，不会伪装成已安装。

获得明确授权后，再从 [`AI-INSTALL.md`](AI-INSTALL.md) 开始安装或升级。Runtime
安装、adapter activation 与每个 project board migration 是三个独立操作。

## CLI

生成或安装后的 runtime 提供：

```text
catpaw board init|status|doctor|migrate
catpaw work start|close
catpaw milestone start|add|close
catpaw evidence add
catpaw agent roles|role
catpaw agent check|open|send|status|read|close
```

这里的 `catpaw` 是 executable entrypoint 的简写：source checkout 使用
`src/runtime/bin/catpaw.mjs`，安装后使用 `~/.catpaw/bin/catpaw.mjs`。CatPaw 不会
自动向 `PATH` 添加命令；用户自管的 alias 或 symlink 是另一个显式选择。

Board mutation 默认 dry-run，只有显式 `--apply` 才写入。Agent session status 只
报告 open/closed、changed/stable 与明确 waiting text，不推断任务完成。

## 仓库结构

```text
catpaw/
├── src/runtime/   # 版本化 runtime source
├── scripts/       # 构建与验证工具
├── tests/         # 可执行 contract
├── docs/          # Maintainer 设计依据与 ADR
└── dist/runtime/  # 生成包，Git 忽略
```

Runtime 用户遵循 [`src/runtime/runtime-policy.md`](src/runtime/runtime-policy.md)。
Maintainer 从 [`docs/README.md`](docs/README.md) 开始；贡献说明见
[`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 安全边界

- Runtime 只安装到 `~/.catpaw/`；项目工作板只存项目 artifact。
- Host adapter 只保留 CatPaw 薄引用，不复制完整 runtime。
- Agent output 与 CLI result 是 evidence，不是授权。
- 在已授权的 change/build task 内，Agent Executor 为每个 mutable surface 指定一个
  accountable integration owner。Executor 自己保留该 ownership 时，可在 non-protected
  local task branch/worktree 上为 exact task-owned changes 创建 bounded local commits，
  但必须先完成 review、验证与 credential scan。
- 被委派的 integration owner 只能写 assigned isolated surface；integration ownership
  本身不授予 Git。Candidate/reconciliation commit 需要 Builder Role 与完整 Builder Git
  Envelope；Executor 决定 adoption 后，exact clean inbound fast-forward/cherry-pick 需要
  绑定 assigned non-protected surface、target/base、commit list 与验证的 Integration Git
  Envelope。
- Current-tool Builder 只有在 Task Envelope exact opt-in，并绑定一个 exclusive isolated
  worktree、dedicated non-protected branch/base、exact scope、验证、diff review 与 secret
  scan 时才可创建 Executor 选择的 bounded local commit series；final adoption 仍由
  Executor 决定。
- Scout、Architect、Reviewer、Verifier、未 opt-in Agent 与当前 `cc`/`cx` profiles
  不得 stage/commit；Integrator/integration ownership 本身不授予 Git。
- Push、PR、deploy/publish、对 protected/base branch 的任何 update（direct commit、
  merge、cherry-pick、fast-forward）、history rewrite、force、破坏性 Git/cleanup、
  secret access、权限扩张与其它外部或不可逆影响仍需明确授权。

CatPaw 不隶属于任何模型厂商或同名产品。Attribution 见
[`NOTICE.md`](NOTICE.md)。

## License

MIT. See [`LICENSE`](LICENSE).
