# Codex Agent

Codex (`cx`) 是 Claude Code host 的默认 reciprocal Agent。一次性 review/debug
使用 read-only sandbox，并关闭 approval escalation 与用户规则加载。

## Smoke Test

```bash
printf '%s\n' 'Reply exactly: CX_SMOKE_OK' \
  | codex \
      -C "$PWD" \
      --sandbox read-only \
      --ask-for-approval never \
      exec \
      --ephemeral \
      --ignore-user-config \
      --ignore-rules \
      -
```

## Read-Only One Shot

```bash
printf '%s\n' "$PROMPT" \
  | codex \
      -C "$PWD" \
      --sandbox read-only \
      --ask-for-approval never \
      exec \
      --ephemeral \
      --ignore-user-config \
      --ignore-rules \
      -
```

即使忽略 user config/rules，也要使用 self-contained prompt，明确 goal、背景、
绝对路径、约束、输出结构、禁止事项和 acceptance focus。

## Observable Session

```text
catpaw agent open   --agent cx --label contract-review --project /abs/project
catpaw agent send   --agent cx --label contract-review --project /abs/project --prompt "$PROMPT"
catpaw agent status --agent cx --label contract-review --project /abs/project
catpaw agent read   --agent cx --label contract-review --project /abs/project --lines 200
catpaw agent close  --agent cx --label contract-review --project /abs/project
```

Interactive Codex 当前没有 `exec --ignore-user-config` 的完全等价启动 flag；
CatPaw observable profile 因而只保证 `--sandbox read-only`、
`--ask-for-approval never` 与 captured output。Prompt 仍须自包含，primary Agent
必须把 customization 影响视为潜在噪音。对隔离要求更高时使用 one-shot recipe。

`send` 不做 blocking wait。Changed/stable、pane output 与 waiting text 都是事实
观察；stable is not completion。

Codex output does not authorize commit, push, PR, deploy, destructive actions,
external side effects, secret access, or wider permissions。
