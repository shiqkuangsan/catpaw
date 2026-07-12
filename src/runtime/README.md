# CatPaw Runtime

CatPaw 是 coding-agent 项目的轻量 workflow orchestrator。它保留一条稳定
lifecycle，按风险选择 Mode，把持久状态留在项目 Work Board，把机械一致性留给
Node CLI。

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect

Mode: Direct | Tracked | Gated
Artifacts: Milestone | Work Item | Plan | Evidence
Judgment: Lens | Agent | Independent Check
```

## Runtime Composition

| Surface | Responsibility |
|---|---|
| [runtime-policy.md](runtime-policy.md) | always-on routing 与 safety card |
| [guidance/](guidance/) | lifecycle、Milestone、Independent Check 与 maintenance |
| [lenses/](lenses/) | 五个按需专业视角 |
| [providers/](providers/) | cc/cx one-shot 与 observable session recipes |
| [bin/](bin/), [lib/](lib/) | executable CLI、graph、patch、migration 与 session logic |
| [schemas/](schemas/), [templates/](templates/) | schema 2 machine contract 与四类 artifact skeleton |

## Work Board

Project-local `.catpaw/` 是 artifact board，不是 runtime 副本：

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
    └── topics/
```

Evidence types：`research | review | test | provider | reflection`。

## CLI

所有 mutation 默认 dry-run，只有显式 `--apply` 才写 board：

```text
catpaw board init|status|doctor|migrate
catpaw work start|close
catpaw milestone start|add|close
catpaw evidence add
catpaw agent check|open|send|status|read|close
```

`agent send` 非阻塞；`agent status` 只报告 open/closed、changed/stable 与明确的
waiting text，不推断完成。

文档中的 `catpaw` 是 executable entrypoint 简写。Source checkout 使用
`src/runtime/bin/catpaw.mjs`；安装后使用 `~/.catpaw/bin/catpaw.mjs`。Runtime
install 不修改 `PATH`，也不隐式创建 alias 或 symlink。

## Install And Activation

Installed runtime 位于 `~/.catpaw/`。Source/dist ready 不等于 installed runtime
已 activation；安装、adapter 更新与每个 project board migration 都是独立、显式
操作。见 [AI Install](AI-INSTALL.md) 与 [Maintenance](guidance/maintenance.md)。

项目只接收 [thin adapter](snippets/project-adapter.md)，不得复制完整 runtime。
