# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw 是一个面向 AI 编程协作的软件项目工作流 runtime。它不绑定某个 IDE
或模型，而是给 agent 一套轻量协议：判断任务等级、显式告诉用户路由结果、
把重要事项沉淀到项目 `.catpaw/` 工作板、在风险较高时调用专家角色，并在
完成前做验证和收尾。

仓库地址：https://github.com/shiqkuangsan/catpaw

当前 runtime 版本：`2.1.5`。

当前状态：早期公开 runtime，可用，但仍保持小而演进中的设计。

## CatPaw 解决什么问题

AI 编程常见的问题不是“不会写代码”，而是：

- 跨会话后上下文断掉；
- plan、review、test、done 状态散落在对话里；
- agent 不明确告诉用户为什么走轻量流程或重流程；
- 任务做完时 req、plan、index、review、test 状态没有同步；
- commit、push、deploy、destructive 操作缺少明确 gate。

CatPaw 把这些协作约定变成可复用的 runtime。

```text
CatPaw decides what workflow to run.
superpowers defines how to execute well.
Expert Council provides judgment.
Providers perform the work.
```

## 核心组成

| 位置 | 作用 |
|---|---|
| `~/.catpaw/` | 全局 runtime：policy、specs、commands、templates、roles、migrations、guides |
| `<project>/.catpaw/` | 项目工作板：milestones、reqs、plans、research、reviews、tests、lessons、active index |
| Provider adapter | 写进 Claude/Codex/Cursor/OpenCode 等工具的薄声明 |
| `~/.catpaw/state/projects.json` | 本机项目工作板 registry，用于批量升级和健康检查 |

## 快速开始

你可以直接对 coding agent 说：

```text
Install CatPaw from https://github.com/shiqkuangsan/catpaw and enable it in this project.
```

如果使用本地 checkout：

```bash
git clone https://github.com/shiqkuangsan/catpaw.git
cd catpaw
node scripts/build-runtime.mjs
```

然后让 agent 从根目录的 `AI-INSTALL.md` 开始执行。完整 runtime 安装说明在
`src/runtime/AI-INSTALL.md`。

## 工作等级

| Level | 适用场景 | 默认沉淀 |
|---|---|---|
| `L0` | typo、小文档、明确局部修复 | 不写 CatPaw 文件，直接执行、验证、报告 |
| `L1` | 普通单模块任务 | 默认不落盘，轻量 plan + inline verification |
| `L2` | 跨模块、不确定、架构/API/持久化/性能/复杂 UI | 写 req + plan + verification record |
| `L3` | 安全、迁移、发版、CI/CD、破坏性操作、大重构、事故、PR 终审 | 写 req + plan + test matrix + formal review |

当 CatPaw 参与路由时，agent 应先告诉用户类似：

```text
CatPaw dispatch: L2 — cross-module behavior change.
Artifacts: req+plan. Roles: Architecture Reviewer.
Provider: preferred. Verification: record. Next: inspect current flow.
```

## Milestone 与 Subagent

- Milestone 是可选阶段 artifact，适合 L2/L3 中跨多个 FR 的连续目标；FR
  仍然是最小可验证单元。
- Milestone 路径为 `.catpaw/milestones/MS-001-<slug>.md`，用于聚合阶段目标、
  scope、exit criteria、verification 和下一段建议。
- Subagent Preference Gate 不只是“可以考虑”：当 stance 是 `preferred` 时，
  artifact 应记录 `Provider outcome: used` 与 current-tool subagent 证据，或
  `Provider outcome: skipped` 与 `Subagent skipped: <reason>`。

## 仓库结构

```text
catpaw/
├── src/runtime/   # runtime package source
├── scripts/       # build and verification tooling
├── docs/          # maintainer-only design notes and ADRs
└── dist/runtime/  # generated runtime package, ignored by git
```

## 构建与验证

```bash
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

`build-runtime.mjs` 根据 `src/runtime/runtime-manifest.json` 生成
`dist/runtime/`。`verify-runtime.mjs` 会检查 source、dist、已安装 runtime
和 registry 中的项目工作板 stamp。

从 source checkout 只读检查项目 board：

```bash
node scripts/catpaw-project.mjs status --project /path/to/project
node scripts/catpaw-project.mjs doctor --project /path/to/project
node scripts/catpaw-project.mjs doctor --project /path/to/project --json
```

`catpaw-project.mjs` 不写入项目 `.catpaw/`。它会从 project artifact graph
生成 active work 摘要，并在执行未来的 reconcile / close 写操作前报告 closeout
或 registry stamp 漂移。它也会报告 milestone/FR 状态漂移、preferred
subagent outcome 缺失、provider stance drift、L3 test matrix 缺失和 adapter
activation 问题。

Active milestone 和 active work 会以紧凑表格展示，方便用户扫描当前阶段或事项，
并直接跳转到 Milestone、Req、Plan、Tests、Review 或 Research artifact。

## 设计边界

- Global spec, local artifacts：全局 runtime 只放一份；项目 `.catpaw/`
  只存该项目的工作产物。
- CatPaw 可以借鉴 superpowers 的执行方法论，但由 CatPaw 决定 artifact 路径
  和 safety gate。
- Expert Council 只是 advisory layer，不自动授权 commit、push、PR、deploy
  或 destructive 操作。
- gstack 和 Superpowers 是设计灵感来源，不是 CatPaw runtime 依赖。

## 开源说明

CatPaw 不隶属于 Meituan CatPaw、gstack、Superpowers 或任何模型/编辑器厂商。
来源与 attribution 见 [NOTICE.md](NOTICE.md) 和
`src/runtime/source-evidence/`。

## License

MIT. See [LICENSE](LICENSE).
