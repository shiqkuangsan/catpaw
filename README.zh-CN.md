# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw 是面向 coding agent 的 local-first 可靠执行 runtime。它让 Agent 在已有授权内
持续推进，用可检查的事实支撑完成声明，只在真正属于用户的决策或风险边界前停下。

```text
Work      要交付什么结果、当前做到哪里、下一步是什么
Proof     检查了什么、事实说明什么、还存在哪些未知或缺口
Approval  哪一项新增权限或风险接受必须由用户决定
```

三者是并列问题，不是强制线性阶段。用户授权任务后，大部分 Work 不需要反复
Approval。

Source runtime 版本：`3.4.0`。项目工作板使用 **schema 2**。

## 用户模型

### Work

Work 负责把一个用户结果从理解推进到 clean handoff。小型、局部任务可以只存在于
对话；需要跨步骤或跨会话连续性的 Work 会写入仓库，让后续会话恢复目标、进度和
`Next`。

多个相关 Work 可以按需组成 Milestone。用户不需要管理内部风险模式、生命周期阶段
或 Agent topology。

### Proof

Proof 是支持判断的可检查事实：已经执行的检查、可复现 finding、独立 review，以及
明确的 remaining gap。进程启动、exit zero、session 稳定、代码阅读或 Agent 自称
“完成”，都不能单独作为完成 Proof。

高风险 Work 必须由不同于实施者的 actor 提供独立 Proof。需要持久化时，Proof 仍以
schema 2 typed `Evidence` 存储；Evidence 是兼容存储术语，不是第四个用户概念。

### Approval

只有必须由用户提供新增权限或明确接受风险时才需要 Approval，例如：实质改变结果、
缺失必要 Proof、外部或不可逆影响、protected/base 更新、破坏性或改写历史的 Git、
secret access、权限扩张。

Approval 不是 workflow stage。已经授权的 Work 应连续推进，不为每个内部步骤重复
请示。Proof 永远不能制造 Approval。

## 可见流程

```text
Understand -> Execute -> Check -> Finish
```

CatPaw 在内部选择轻量、持久或高风险处理，并保留精确生命周期与 metadata 以支持
连续性，但不要求用户操作这些内部概念。

## Agent 协作

CatPaw 对外只提供三种 bounded task intent：

| Intent | 结果 |
|---|---|
| `explore` | 建立事实、边界、备选方案与设计 |
| `build` | 实现或集成 exact isolated scope |
| `check` | 审查缺陷或复现验收 |

Primary agent 决定使用哪些 Agent、model 和 transport，串行还是并行，以及最终接受
哪个 candidate。CatPaw 提供约束和协作选项，不是自动 team scheduler。

不同 Agent 不得并发写同一个 mutable surface。同一逻辑文件的 competing candidate
只能存在于隔离 worktree 或等价状态表面。独立 Proof 必须来自不同 actor，不能靠同一
Agent 换标签获得独立性。

CatPaw 管理的 reciprocal read-only transport 是 `cc`（Claude Code）和 `cx`
（Codex）；它们是第二意见表面，不是 primary agent 的完整 roster。

## 项目记忆

仓库内 `.catpaw/` 工作板只保存有长期价值的项目事实：

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
```

`Work` 映射为 schema 2 Work Item/Plan；`Proof` facts 映射为 typed Evidence；
`Approval` 仍是用户授权边界，不新增 artifact。Schema 1 migration 可能保留带 checksum
的 `legacy/schema-1/` archive，所有原始材料都会保留。

## CLI

首选命令：

```text
catpaw status
catpaw board init|status|doctor|migrate
catpaw work start|show|update|finish|cancel
catpaw milestone start|show|add|finish|cancel
catpaw proof add|list|show
catpaw intent list|show
catpaw transport check|open|send|status|read|close
```

使用 `catpaw --help`、`catpaw <command> --help` 和 `catpaw --version` 发现命令。
`status` 是日常 Work 视图，`board` 保留为存储和维护入口。Mutation 默认 dry-run，
只有显式 `--apply` 才写入。`proof add` 底层仍写入 schema 2 typed Evidence，并支持
inline、文件和 stdin body。旧调用方可以继续使用 `board status`、`work close`、
`milestone close`、`evidence add`、`agent ...` 和
`work start --mode tracked|gated`。

Human output 使用 Work、Proof、visible Phase、Action 和 Next；JSON 保持 schema-shaped
兼容字段。Transport session status 只报告可观察的进程/输出事实，不推断完成。

Source checkout 使用 `src/runtime/bin/catpaw.mjs`；安装后使用
`~/.catpaw/bin/catpaw.mjs`。CatPaw 不修改 `PATH`。

## 安全边界

- Agent output、Proof 和 CLI success 都不能授予 Approval。
- 被委派的 writer 只能写一个 exact isolated mutable surface。
- Bounded local commit 需要显式限定授权、clean baseline、exact diff review、相关验证
  和 credential scan。
- Candidate 不会因为已交付或已 commit 就自动被接受。
- Push、PR、deploy/publish、protected/base 更新、history rewrite、force、破坏性
  cleanup、secret access、权限扩张和其它外部或不可逆影响必须获得明确用户 Approval。

## Build 与 Activation

```bash
git clone https://github.com/shiqkuangsan/catpaw.git
cd catpaw
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

Activation 是 machine-local 状态。Source、生成的 `dist`、installed runtime、host
adapter 和每个 project board 是独立表面：

```text
source -> dist -> installed -> project board
```

Build 不会自动 install、apply、activate 或 migrate CatPaw。获得明确授权后，从
[AI-INSTALL.md](AI-INSTALL.md) 开始安装或升级。

## 仓库

```text
catpaw/
├── src/runtime/   # 版本化 runtime source
├── scripts/       # 构建与验证
├── tests/         # executable contracts
├── docs/          # maintainer rationale 与 ADR
└── dist/runtime/  # 生成包，Git 忽略
```

Runtime 行为由 [runtime-policy.md](src/runtime/runtime-policy.md) 负责；maintainer 从
[docs/README.md](docs/README.md) 开始。

CatPaw 不隶属于任何模型厂商或同名产品。Attribution 见 [NOTICE.md](NOTICE.md)。
MIT License，见 [LICENSE](LICENSE)。
