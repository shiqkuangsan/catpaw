# Codex Agent

Codex (`cx`) 是 Claude Code host 的默认 reciprocal Agent。一次性 review/debug
使用 read-only sandbox，关闭 approval escalation，并忽略 `config.toml` 与
execpolicy `.rules`；不要把它描述成关闭全部用户/项目 instructions。

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

`--ignore-user-config` 只忽略 `$CODEX_HOME/config.toml`；`--ignore-rules` 只忽略
user/project execpolicy `.rules`。两者都没有承诺忽略 `AGENTS.md`，因此不等价于
Claude `--safe-mode`。Prompt 必须 self-contained，并把仍可能加载的 project/user
instructions 视为潜在上下文噪音。

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
必须把 customization 影响视为潜在噪音。One-shot 额外隔离 config 与 execpolicy
`.rules`，但同样不承诺忽略 `AGENTS.md`；需要更强隔离时使用受控输入副本或外部
filesystem sandbox。

`send` 不做 blocking wait。Changed/stable、pane output 与 waiting text 都是事实
观察；stable is not completion。

Codex output does not authorize commit, push, PR, deploy, destructive actions,
external side effects, secret access, or wider permissions。
