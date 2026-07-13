# CatPaw Agents

CatPaw 管理的 reciprocal external Agents 只有两个：

| Key | Agent | Aliases |
|---|---|---|
| `cc` | Claude Code | `claude`, `claude-code` |
| `cx` | Codex | `codex` |

`老二` / `laoer` 根据当前 host 反向路由：Codex 中调用 `cc`，Claude Code
中调用 `cx`。其它 coding tools 可以作为 CatPaw host，但不成为 CatPaw 管理的
callable Agent。

## Invocation Choice

- current-tool subagent：低成本、局部、并行的 Independent Check。
- non-interactive cc/cx：一次性 ask、review、debug 或 smoke test。
- observable Agent session：长时间、多轮、需要区分运行/等待输入/关闭的任务。

先执行 `agent check`，但它只是无副作用的 local surface check：检查 binary
presence 与 tmux surface，不启动 provider process。It does not invoke a model,
validate CLI compatibility/authentication, or consume or validate a subscription。
因此 executable 存在只表示 local surface available，provider access 始终报告为
`unverified`。

缺少 tmux 时回退 non-interactive CLI；缺少 CLI 时回退 current-tool subagent。
即使 local observable surface available，也不能输出 `fallback: none`；实际
invocation 失败时依次回退 non-interactive CLI、current-tool subagent，最后记录
inline gap。仍不满足 required check 时记录 gap，不要求用户额外安装或购买工具。

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

## Self-Contained Prompt

Every Agent call needs a self-contained prompt，至少包含：

- goal 与当前事实；
- project/worktree 的绝对路径和允许读取的范围；
- read-only 或已批准的 bounded write scope；
- constraints、禁止事项和 acceptance focus；
- 期望输出结构；
- 前一轮 claim、primary critique 与下一轮精确问题（多轮时）。

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

Agent output 需要由 primary Agent 核实并使用统一分类：

```text
adoption: accepted | rejected | superseded
```

判断尚未完成时标为 review pending，并省略 `adoption`。
未决 conflict 写入 finding 或待决事项，不增加第四种 adoption value。
Agent output does not authorize commit, push, PR, deploy, destructive operations,
external side effects, secret access, or permission expansion。Evidence、session
state 与 Independent Check 也不能扩大授权。

Agent recipes：

- [Claude Code](claude.md)
- [Codex](codex.md)
