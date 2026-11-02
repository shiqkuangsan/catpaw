# CatPaw Runtime

规则见 [policy.md](policy.md)（`catpaw policy` 输出同一内容），命令见 `catpaw --help`。

## 接入

```bash
npm install -g /path/to/catpaw
```

| 宿主 | 接入 |
|---|---|
| Claude Code | 把 [snippets/claude-code-settings.json](snippets/claude-code-settings.json) 的 `SessionStart` hook 合并进 settings；会话开始自动注入当前 Work |
| Codex | 把 [snippets/codex-hooks.json](snippets/codex-hooks.json) 合并进 `~/.codex/hooks.json`，再在 CLI 里用 `/hooks` 审核并信任；hook 定义改动后需重新信任 |
| 其他宿主 | 把 [snippets/agents.md](snippets/agents.md) 加入 `AGENTS.md`；Agent 按其中指引自行运行 `catpaw status` |
| Git | 把 [snippets/pre-push](snippets/pre-push) 放到 `.git/hooks/pre-push`；违反规则的 done Work 会阻止推送 |
| CI / 发布 | `catpaw gate <id>`：该 Work 在当前代码上不满足完成规则时 exit 1 |

退出码：0 成功；1 违反完成规则（`finish`、`gate`）；2 参数或环境错误。

## 看板格式

```text
.catpaw/
  catpaw.json            {"schema": 3}
  work/<ID>/WORK.md      当前状态：frontmatter + Goal / Acceptance / Gaps / Decisions / Next
  work/<ID>/LOG.md       只追加：Check、Gap、Note、done 等记录
  archive/schema-2/      convert 后保留的旧看板（如有）
```

`WORK.md` frontmatter：`id`、`title`、`status`（open/blocked/done/dropped）、`risk`（normal/high）、
`repos`（JSON 数组，相对项目根）、`parent`、`created`、`updated`。Gaps 每行
`- [open|accepted] G<n>: <内容>`。除 `status` 和 Gaps 外可以直接编辑；
状态和 Gap 通过命令变更，以便留下记录。

`LOG.md` 每条记录以 `<!-- catpaw {...} -->` 开头，JSON 中含 `at`、`kind`，Check 另含
`result`、`by`、`snapshot`、`repos`，可选 `actor`、`output`。不要改写已有记录。

## 从 schema 2 转换

```bash
catpaw convert            # 预览
catpaw convert --apply    # 执行
```

旧 Work 正文、Plan 和 Evidence 原文按时间写入对应 `LOG.md`；有结果的 Evidence 变为 Check，
其 snapshot 为 `schema2:<candidate>`，永远不算当前。Milestone 变为 Work，成员通过 `parent` 关联。
topic Evidence、`index.md` 和其他目录只在 `archive/schema-2/` 中保留。转换前后校验条目数和
failed/blocked 数量，旧看板在转换期间被修改则放弃替换。仍在进行的 Work 会在 Next 中提示整理导入内容。
