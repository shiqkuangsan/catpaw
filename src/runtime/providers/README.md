# CatPaw-managed Agent Transports

CatPaw 内置管理的 reciprocal external transport adapters 有两个：

| Key | Agent | Aliases |
|---|---|---|
| `cc` | Claude Code | `claude`, `claude-code` |
| `cx` | Codex | `codex` |

`老二` / `laoer` 根据当前 host 反向路由：Codex 中调用 `cc`，Claude Code
中调用 `cx`。其它 coding tools 可以作为 CatPaw host，也可以由 Agent Executor
通过 host 能力使用；它们不因此成为 CatPaw 内置管理的 callable transport。
`cc`/`cx` 不是 Executor 可用 Agent 的完整 roster。

## Invocation Choice

何时委派、如何组合 Role、Task Envelope 与 topology 由 Agent Executor 决定；
[Agent Orchestration](../guidance/agent-dispatch.md) 提供 catalog、patterns 与 hard
contract。本文件只拥有 cc/cx transport、fallback surfaces、session observation 与
transport-specific safety。当前 cc/cx profiles 是 read-only，可承载 Scout、Architect、
Reviewer 或 Verifier；external Builder/Integrator write unavailable，不能用 prompt 把
read-only recipe 升级成 write transport。

- current-tool subagent：host 当前可用的局部 work surface。
- non-interactive cc/cx：一次性 ask、review、debug 或 smoke test surface。
- observable Agent session：长时间、多轮、需要区分运行/等待输入/关闭的 surface。

这些是调度 options，不是固定优先级；Executor 可以基于 independence、context、cost、
latency 与 enforcement 选择或跳过任一 surface。

先执行 `agent check`，但它只是无副作用的 local surface check：检查 binary
presence 与 tmux surface，不启动 provider process。It does not invoke a model,
validate CLI compatibility/authentication, or consume or validate a subscription。
因此 executable 存在只表示 local surface available，provider access 始终报告为
`unverified`。

CLI 报告 ordered `fallbackOptions` 与 `decisionOwner: agent-executor`，供 Executor
选择；兼容字段 `fallback` 在 3.4 仍保留为旧客户端可读的摘要。即使 local observable
surface available，也不能输出 `fallback: none`。仍不满足 required check 时记录 gap，
不要求用户额外安装或购买工具。

## Observable CLI

```text
catpaw agent check  --agent <cc|cx>
catpaw agent open   --agent <cc|cx> --label <purpose> --project <path>
catpaw agent send   --agent <cc|cx> --label <purpose> --project <path> --prompt <text>
catpaw agent status --agent <cc|cx> --label <purpose> --project <path>
catpaw agent read   --agent <cc|cx> --label <purpose> --project <path> --lines <n>
catpaw agent close  --agent <cc|cx> --label <purpose> --project <path>
```

Session key 由 Agent、绝对 project path 与 label 共同决定。`send` 只投递输入，
立即返回；没有 blocking wait。session 使用 `remain-on-exit` 保留 provider
进程终态；`status` 报告 open/failed/exited、provider exit code、输出
changed/stable 和明确 waiting text。非零 provider exit 是进程失败并触发
fallback；zero exit、空 stdout 或 pane 暂时不变仍不证明任务完成。Stable is an
observation, not completion。

## Transport Handoff

Every Agent call carries the complete Task Envelope from
[Agent Orchestration](../guidance/agent-dispatch.md)。Transport handoff 只补充：

- project/worktree 的绝对路径与 provider 可见 surface；
- enforced read-only mechanism，或准确标记 `no-write requested + audited`；
- session label、观察方式与 available fallback surfaces；
- 前一轮 claim、Executor critique 与下一轮精确问题（多轮时）。

不要依赖 Agent 的全局记忆、skills、上次会话或项目 customization 来补齐关键
上下文。

## Sensitive State And Side Effects

Prompt-only read-only 不是权限隔离。只有调用面具备预防性控制、能在约定 scope
阻断 write/delete/rename 时，才称为 read-only；使用真实 sandbox、read-only
mount/URI 或最小 tool allowlist。不要向 Agent 暴露 task scope 之外的 sensitive
state，例如 coding-tool state DB、用户配置、凭据、生产数据或无关 workspace。
需要这些事实时优先提供最小 export/snapshot；若环境不能阻断写入，不委派该敏感
任务。

普通 project/worktree 调用若不能阻断写入，只能标为
`no-write requested + audited`，不能冒充 read-only 或满足 read-only gate。每次
enforced read-only 调用前记录 protected scope，返回后执行 bounded side-effect
audit，检查约定范围内的 write/delete/rename 和 worktree diff。发现副作用时将
delivery 标为 failed，即使输出内容本身可用。

## Evidence And Authority

Agent output 需要由 Agent Executor 核实并使用统一分类：

```text
adoption: accepted | rejected | superseded
```

判断尚未完成时标为 review pending，并省略 `adoption`。
未决 conflict 写入 finding 或待决事项，不增加第四种 adoption value。
Agent output does not authorize Git or external actions。Bounded local Git authority
只来自当前 authorized task、runtime policy 与 exact Task Envelope；Agent Executor
决定 final adoption，指定的 integration owner 负责 clean integration handoff。
Agent Orchestration 允许 exact opt-in 的 current-tool Builder 在 exclusive worktree
创建 bounded local commit series，但当前 cc/cx external profiles 是
read-only，must not stage or commit；它们只交付 patch、worktree changes 或 evidence。
Push、PR、deploy、对 protected/base
branch 的任何 update/integration、history-changing/destructive operations、external
side effects、secret access 或 permission expansion 仍需 explicit user authorization。
Evidence、session state 与 Independent Check 也不能扩大授权。

Agent recipes：

- [Claude Code](claude.md)
- [Codex](codex.md)
