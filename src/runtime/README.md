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

退出码：0 成功；1 违反完成规则（`finish`、`gate`）或代跑检查未通过；2 参数、环境错误或锁等待超时。

## 看板格式

```text
.catpaw/
  catpaw.json            {"schema": 4}
  work/<ID>/WORK.md      当前状态：frontmatter + Goal / Acceptance / Gaps / Decisions / Next
  work/<ID>/LOG.md       最新在前：Check、Gap、Note、done 等记录
  runs/<ID>/*.log        代跑检查的原始输出；目录自带 .gitignore，不进 Git
  .lock                  写入时的短暂锁；持有进程已退出或超过 60 秒视为失效
  archive/schema-<n>/    convert 后保留的旧看板（如有）
```

`WORK.md` frontmatter：`id`、`title`、`status`（open/blocked/done/dropped）、`risk`（normal/high）、
`repos`（JSON 数组，相对项目根）、`parent`、`created`、`updated`。Gaps 每行
`- [open|accepted] G<n>: <内容>`。除 `status` 和 Gaps 外可以直接编辑；
状态和 Gap 通过命令变更，以便留下记录。

`LOG.md` 每条记录以 `<!-- catpaw {...} -->` 开头，JSON 中含 `at`、`kind`，Check 另含
`result`、`by`、`snapshot`、`repos`，可选 `actor`、`output`；代跑的 Check 另含 `run`
（`command`、`cwd`、`exit`、`ms`，可选 `signal`，运行中文件变化时有 `drift`）。不要改写已有记录。

所有写命令在 `.lock` 下读改写，并发调用不会丢 Gap 或重复分配 id。`finish` 和 `gate` 把
无法解析的内容视为违规：不合格式的 Gaps 行、重复 Gap 编号、未知 status/risk、
frontmatter `id` 与目录不符、损坏的 `LOG.md` 条目。

代跑检查：`catpaw check <id> "<摘要>" [--timeout 秒] -- <命令> [参数]`。命令在当前目录直接执行（不经 shell；
需要管道时用 `sh -c`），退出码 0 记 passed，非 0 或超时记 failed，无法启动或被中断记 blocked；
结果不为 passed 时 CLI exit 1。结果绑定运行前的 snapshot；运行中文件被改动时记录 `drift` 并提示。
不保持锁运行命令。

## 转换旧看板

```bash
catpaw convert            # 预览
catpaw convert --apply    # 执行
```

**schema 3 → 4**：新版仍能读写 schema 3；`status <id>` 始终最新在前，但旧文件在转换前保持原来的顺序。
执行转换会把各 `LOG.md` 的记录顺序倒过来，保留正文、检查结果和原始输出路径；原看板保存在
`archive/schema-3/`。执行前停止该项目的其他 CatPaw 命令，转换后使用 5.2.0 或更新版本。

**schema 2 → 4**：旧 Work 正文、Plan 和 Evidence 原文按时间从新到旧写入对应 `LOG.md`；有结果的 Evidence 变为 Check，
其 snapshot 为 `schema2:<candidate>`，永远不算当前。Milestone 变为 Work，成员通过 `parent` 关联。
topic Evidence、`index.md` 和其他目录只在 `archive/schema-2/` 中保留。转换前后校验条目数和
failed/blocked 数量，旧看板在转换期间被修改则放弃替换。仍在进行的 Work 会在 Next 中提示整理导入内容。
