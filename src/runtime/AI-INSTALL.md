# AI Install And Upgrade

本文件指导 agent 安装/升级 CatPaw runtime。默认只做 inspect 与 dry-run；用户
明确要求 apply 后才修改 `~/.catpaw/`、adapter、registry 或 project board。

## Surfaces

```text
source repo       versioned source
dist/runtime      generated package
~/.catpaw         installed runtime
<project>/.catpaw project artifact board
```

这些 surface 独立。Source/dist 更新后，installed runtime 仍可处于
`pending activation`；不要把 source build 成功描述为已安装。

## Runtime Install

1. 读取 source/dist 的 `runtime-manifest.json` 与 `VERSION`。
2. 验证 manifest 中每个 canonical file、hash、可执行入口和本地链接。
3. 比较 `~/.catpaw/`，输出 exact dry-run：新增、替换、保留与冲突。
4. 明确保留 `~/.catpaw/state/projects.json`、整个 `state/`、未知用户文件和备份。
5. 将 manifest `legacyRuntimePaths` 视为退役 managed content：先备份，再从 sibling
   stage 排除；不得把它们误当 unknown files 保留在 live runtime。
6. 用户授权后，在 sibling stage 组装完整 runtime，验证后再替换 managed files。
7. 复查 installed `VERSION`、manifest/hash、CLI smoke 与 obvious secret scan。

不要把 runtime 安装到 `~/.claude/`、`~/.codex/` 或项目目录。Provider-specific
目录只允许写 thin adapter，而且仍需用户明确授权。

安装应保留 `bin/catpaw.mjs` 的 executable mode，但不修改 `PATH`。安装后的真实
入口是 `~/.catpaw/bin/catpaw.mjs`；alias 或 symlink 需要用户另行明确选择。

## Project Activation

Project activation 分两步，彼此不隐含：

1. 将 [project adapter](snippets/project-adapter.md) 的 managed block 合并到该
   host 实际读取的 `AGENTS.md`、`CLAUDE.md` 或等价规则文件；不覆盖用户内容。
2. 预览并创建 schema 2 board：

```text
catpaw board init --project /abs/project
catpaw board init --project /abs/project --apply
```

OpenCode/Cursor 可以作为读取同一 adapter 的 host；CatPaw 不因此调用它们作为
external Agent。项目 board 永远只存 artifacts。

## Existing Boards

Schema 1 board 先 dry-run：

```text
catpaw board migrate --project /abs/project
```

Dry-run 需要区分 native mappings、safe normalizations、`preservedLegacy` 与
active/safety blockers。Historical incomplete files 会进入 checksummed
`legacy/schema-1/` archive；它不是第六类 artifact，正常 schema 2 command 会忽略。

只有用户确认 blockers、mappings、legacy archive/manifest、unknown files 与
backup location 后执行：

```text
catpaw board migrate --project /abs/project --apply
```

Apply 在 staged validation 后把完整 preimage 写入
`~/.catpaw/backups/<project-key>/<UTC-timestamp>/`。Do not automatically migrate
registered projects；每个 board 独立授权，第二次运行应为 no-op。

Legacy `todos/` 先 inventory，保留原文件并把可确定内容写入新的 Work Board；
删除或 bulk cleanup 必须单独列出目标并再次确认。

## Global Adapter And Registry

Global adapter 使用 [global adapter snippet](snippets/global-adapter.md)。Registry
位于 `~/.catpaw/state/projects.json`，只用于本机发现与 maintenance；它不拥有、
移动或删除 project board。Runtime upgrade 必须 preserve `state/projects.json`。

具体 inspect、adapter merge、registry prune 与 rollback 见
[Maintenance](guidance/maintenance.md)。
