# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw 是面向 coding agent 的 local-first 可靠执行 runtime。它让 Agent 在已有授权内
持续推进，用可检查的事实支撑完成声明，只在真正属于用户的决策或风险边界前停下。

```text
Work -> 目标、验收、当前进度与 Next
        Evidence 支撑验收；Authorization 约束动作
```

Work 是主要入口。Evidence 是验证记录的首选名称，Proof 保留为兼容称呼；
Authorization 表达动作授权，Approval 保留为兼容称呼。产品决定、动作授权与
风险接受分开记录，已有授权跨步骤持续有效，不增加反复审批。

Source runtime 版本：`4.0.0`。项目工作板保留 **schema 2**，新 Work 使用显式
contract 4 字段。旧记录继续可读；旧 runtime 可能拒绝新记录。无需批量迁移项目。

## 用户模型

### Work

Work 负责把一个用户结果从理解推进到 clean handoff。小型、局部任务可以只存在于
对话；需要跨步骤或跨会话连续性的 Work 会写入仓库，让后续会话恢复目标、进度和
`Next`。

多个相关 Work 可以按需组成 Milestone。用户不需要管理内部风险模式、生命周期阶段
或 Agent topology。

持久 Work 默认只建一份记录，计划写在其中；独立 Plan 按需创建。
`work continue` 保留上一轮完成记录，再开启新的证据周期。

### Evidence（兼容 Proof）

Proof 是支持判断的可检查事实：已经执行的检查、可复现 finding、独立 review，以及
明确的 remaining gap。进程启动、exit zero、session 稳定、代码阅读或 Agent 自称
“完成”，都不能单独作为完成 Proof。

新高风险 Work 要求测试和独立检查均通过，并绑定当前 candidate、验收与周期。
后来的失败会覆盖先前通过。`evidence run` 捕获真实执行结果，但 exit zero 不证明
测试充分，填写 actor 名称也不认证身份；主执行者自审不能满足独立检查。

### Authorization（兼容 Approval）

只有必须由用户提供新增权限或明确接受风险时才需要 Approval，例如：实质改变结果、
缺失必要 Proof、外部或不可逆影响、protected/base 更新、破坏性或改写历史的 Git、
secret access、权限扩张。

Approval 不是 workflow stage。已经授权的 Work 应连续推进，不为每个内部步骤重复
请示。Proof 永远不能制造 Approval。
产品选择、动作授权和风险接受分别记录；接受风险不能把未通过的检查标成通过。

## 可见流程

```text
Understand -> Execute -> Check -> Finish
```

CatPaw 在内部选择轻量、持久或高风险处理，并保留精确生命周期与 metadata 以支持
连续性，但不要求用户操作这些内部概念。

每个 Work 都会经过一次轻量 Understand readiness pass。没有会实质改变交付的歧义时
保持简短并继续推进；当歧义可能改变结果、范围、验收、数据或权限边界、外部或不可逆
选择时，CatPaw 会用紧凑回读说明当前理解，只询问能够解锁首个 slice 的决策。结构复杂
的 Work 还可以按需拆出浅层 scope tree、material dependency edges 和局部
`Confirmed | Proposed | Open` 注记。这不新增 stage、artifact、强制标题或用户概念；
需要持久化时复用 Work 或其可选 Plan。

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

`Work` 映射为 schema 2 Work Item 与可选 Plan；`Proof` facts 映射为 typed Evidence；
`Approval` 仍是用户授权边界，不新增 artifact。Schema 1 migration 可能保留带 checksum
的 `legacy/schema-1/` archive，所有原始材料都会保留。

## CLI

首选命令：

```text
catpaw status
catpaw board init|status|doctor|migrate
catpaw work start|show|update|finish|cancel|continue
catpaw milestone start|show|add|finish|cancel
catpaw evidence add|list|show|run
catpaw proof add|list|show
catpaw runtime inspect|plan|apply|recover
catpaw adapter inspect|plan|apply|recover
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
