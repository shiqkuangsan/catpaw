# Claude Code Agent

Claude Code (`cc`) 是 Codex host 的默认 reciprocal Agent。Review/debug 默认
read-only；prompt 通过 stdin 传入。

## Smoke Test

```bash
printf '%s\n' 'Reply exactly: CC_SMOKE_OK' \
  | claude -p \
      --no-session-persistence \
      --safe-mode \
      --permission-mode plan \
      --tools "" \
      --disallowedTools Edit,Write,NotebookEdit
```

## Read-Only One Shot

```bash
printf '%s\n' "$PROMPT" \
  | claude -p \
      --no-session-persistence \
      --safe-mode \
      --permission-mode plan \
      --tools Read,Glob,Grep \
      --disallowedTools Edit,Write,NotebookEdit
```

`--safe-mode` 禁用 CLAUDE.md、skills、plugins、hooks、MCP、自定义 commands/
agents 等 customization。其代价是必须提供 self-contained prompt：goal、背景、
约束、绝对路径、输出格式、禁止事项与验收重点都要显式写入。
`--tools Read,Glob,Grep` 是预防性 read-only boundary；不要为方便 review 加回 Bash。
需要 diff 或命令输出时，由 primary Agent 放入 prompt 或 Evidence。

## Multiple Directories

```bash
printf '%s\n' "$PROMPT" \
  | claude -p \
      --no-session-persistence \
      --safe-mode \
      --permission-mode plan \
      --tools Read,Glob,Grep \
      --disallowedTools Edit,Write,NotebookEdit \
      --add-dir /abs/worktree-a /abs/worktree-b
```

`--add-dir` 是 variadic。不要把 prompt 接在它后面；始终走 stdin。

## Observable Session

```text
catpaw agent open   --agent cc --label migration-review --project /abs/project
catpaw agent send   --agent cc --label migration-review --project /abs/project --prompt "$PROMPT"
catpaw agent status --agent cc --label migration-review --project /abs/project
catpaw agent read   --agent cc --label migration-review --project /abs/project --lines 200
catpaw agent close  --agent cc --label migration-review --project /abs/project
```

Observable profile 启动 `claude --safe-mode --permission-mode plan`，只开放
Read/Glob/Grep，并显式禁止 Edit/Write/NotebookEdit。`send` 不等待结果；用
`status`/`read` 查看事实。Stable is not completion，明确的 waiting text 也只表示
需要检查输入请求。

Claude output does not authorize commit, push, PR, deploy, destructive actions,
external side effects, secret access, or wider permissions。
