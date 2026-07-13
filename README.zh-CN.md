# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw 是一个面向 coding agent 的轻量 workflow runtime。它保留一条稳定的开发
lifecycle，选择最轻且安全的执行模式，只持久化有长期价值的项目事实，并用可执行
检查保证机械一致性。

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

Source runtime 版本：`3.0.4`。项目工作板使用 **board schema 2**。

Activation 状态：**pending activation**。在 installed runtime 被显式升级并验证前，
这份 source release 不会生效。Building source 可以生成 `dist/runtime/`。
Building source does not automatically install, apply, or migrate CatPaw。本次
3.0 source 重构不会执行全局 apply。

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
另建一套角色层级。

CatPaw 直接管理的 external Agents 只有 `cc`（Claude Code）与 `cx`（Codex）。
OpenCode 可以作为读取 CatPaw 规则的 host，但不是直接调用目标。边界明确的独立
检查优先使用 current-tool subagent。

## Hybrid Runtime

Runtime 内部有三个行为表面：

| Surface | 职责 |
|---|---|
| Always-on Rules | 紧凑的路由、安全、进度与授权规则 |
| On-demand Guidance | Workflow、Milestone、Independent Check、Lens 与 Agent recipe |
| Executable Tools | Board graph、schema 校验、dry-run patch、迁移和可观察 Agent session |

存储与 activation 链是另一条轴线：

```text
source -> dist -> installed -> project board
```

Agent 负责语境判断，CLI 负责确定性记录与校验，用户负责授权写入和外部影响。设计
依据见 [Hybrid Runtime ADR](docs/decisions/0019-catpaw-3-hybrid-runtime.md)。

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
- Commit、push、PR、deploy、破坏性操作、secret access、权限扩张与其它外部影响
  仍需用户明确授权。

CatPaw 不隶属于任何模型厂商或同名产品。Attribution 见
[`NOTICE.md`](NOTICE.md)。

## License

MIT. See [`LICENSE`](LICENSE).
