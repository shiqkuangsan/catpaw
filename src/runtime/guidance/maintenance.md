# Runtime Maintenance

本文件保留尚未全部 CLI 化的 runtime、adapter 与 registry 运维能力。它们是
显式 maintenance actions，不属于普通 task dispatch。

## Runtime Inspect And Upgrade

Inspect 分别报告 source、dist 与 installed `VERSION`/manifest/hash。Source ready
而 `~/.catpaw/` 仍旧时，状态是 `pending activation`，不是失败也不是已升级。

Upgrade 默认 dry-run：列出 managed files 的 add/replace/remove、未知文件、
`state/`、adapter impact 与 project migration impact。Apply 前：

- 备份现有 managed runtime；
- preserve `~/.catpaw/state/projects.json` 和整个 `state/`；
- 不删除未知文件；
- backup 并移除 manifest `legacyRuntimePaths` 声明的退役 managed paths；
- 在 stage 中验证 manifest、hash、links 与 CLI smoke；
- 只替换 runtime managed surface。

Do not automatically migrate project boards。Runtime activation 与每个
`catpaw board migrate --apply` 分开授权。

## Adapter Merge

Adapter 只写 managed `<!-- CATPAW:BEGIN --> ... <!-- CATPAW:END -->` block。

Canonical targets：

| Scope | Host | Target |
|---|---|---|
| global | Claude Code | `~/.claude/CLAUDE.md` |
| global | Codex | `~/.codex/AGENTS.md` |
| project | Claude Code | `<project>/CLAUDE.md` |
| project | Codex | `<project>/AGENTS.md` |

其它 host 只有在用户给出实际 rule file 后才能使用同一 project block，不猜路径。
Global block 来自 `snippets/global-adapter.md`，project block 来自
`snippets/project-adapter.md`。

Deterministic merge：

- zero managed blocks -> append 一个 block，并保留原 newline style；
- one managed block -> replace 该 block，不改 block 外内容、mode 或 ownership；
- multiple managed blocks -> block，列出每个 range，不自动选一个；
- 发现 unmanaged CatPaw section 时先报告 overlap，要求 user decision：保留并只加
  managed block，或由用户确认 exact range 后替换；不得静默留下两套 authority。

默认只显示目标文件与 exact patch。Apply 前把原文件备份到
`~/.catpaw/backups/adapters/<target-key>/<UTC-timestamp>/`，recheck preimage digest，
再用同目录 temporary file + atomic rename。Apply 后验证恰好一个 managed block、
runtime-policy link 可读且用户内容 byte-preserved。Source changes 不自动 refresh
adapter，也不把 runtime package 复制进 host config 或 project。

## Project Registry

Registry：`~/.catpaw/state/projects.json`。它是 per-machine advisory index，
primary key 为绝对 `boardPath`，只存 path、board schema、runtimeSeen 与时间信息。

Canonical shape：

```json
{
  "schemaVersion": 1,
  "updatedAt": "YYYY-MM-DD",
  "projects": [
    {
      "boardPath": "/abs/project/.catpaw",
      "projectRoot": "/abs/project",
      "schema": 2,
      "runtimeSeen": "3.0.2",
      "registeredVia": "project-activation | legacy-import | schema-migration",
      "registeredAt": "YYYY-MM-DD",
      "lastSeenAt": "YYYY-MM-DD",
      "lastSeenVia": "project-activation | legacy-import | schema-migration | check"
    }
  ]
}
```

V2 `stamp` 可作为 legacy diagnostic 保留到该 entry 下一次显式 upsert；它不能决定
board migration，只有 board `schema` 可以。

Check 默认 read-only：

- 将输入和 entry 的 `boardPath` 解析为 absolute path；它是唯一 primary key；
- 同一 absolute `boardPath` 出现 duplicate entries -> block，不自动合并；
- path missing -> stale candidate；
- board schema 与 registry 不一致 -> user decision；
- schema 1 -> 建议 `board migrate` dry-run；
- 未注册 board -> report only，不 auto-register；
- check 不写 `lastSeenAt`，避免 read-only 语义漂移。

Register/upsert 只能在 project activation、legacy import 或 schema migration 成功
后显式执行。已有 entry 保留 `registeredAt`，更新其它诊断字段；新 entry 使用上述
完整 shape。

Remove/prune 默认 dry-run，列出将删除的 exact entries、保留项和 reason。Apply 前
取得对 exact entry list 的确认，备份原文件到
`~/.catpaw/backups/registry/<UTC-timestamp>/projects.json`，recheck preimage digest，
然后写 `projects.json.tmp` 并 atomic rename。若期间内容变化则停止重算，不覆盖。
Registry mutation never deletes or modifies the project board。Runtime upgrade 必须
preserve `state/projects.json`。

## Legacy Project Import

遇到 `todos/` 或其它旧 artifact tree：

| Legacy source | Schema 2 target |
|---|---|
| `todos/plan.md`, `todos/reqs.md` | `index.md` narrative 与 Work inventory；不原样复制 |
| `todos/reqs/*` | `work/`，仅当 Work metadata 完整或用户补齐 |
| `todos/plans/active/*`, `todos/plans/archive/*` | `plans/`，要求已有 Work binding；目录名不决定状态 |
| `todos/research/*` | work-bound 或 topic `research Evidence` |
| `todos/tests.md`, `todos/tests/*` | 有验证价值时转成 work-bound `test Evidence` |
| `todos/reviews/*` | 有 finding/decision 价值时转成 `review Evidence` |
| `todos/lessons.md` | 每条可独立复用且来源明确时转成 `reflection Evidence` |
| `.claude/`, `.codex/` | inventory/report only；不复制到 board |

Metadata boundary：可以从明确 ID prefix infer `type`（FR/BUG/CHORE）；do not infer
`status`、Mode、lifecycle `stage`、created/updated/closed date、Evidence binding 或
independence from directory names、prose position、git history 或 file mtime。缺失
事实形成一个 batched user-decision list，不写 placeholder 或 guessed value。

Execution：

1. inventory 完整 legacy tree、tracked/ignored state、links、unknown/binary files；
2. 输出 source -> target mapping、metadata blockers、保留项与 target tree dry-run；
3. 用户补齐全部 required facts 后，在 sibling stage 创建 schema 2 board；
4. 保留原 narrative，重写可确定 local links，unknown files 原样保留或明确 out-of-scope；
5. 对 staged board 运行 `catpaw board doctor --project <stage-project>` 和相关验证；
6. 验证通过且用户确认后发布 board，再按 registry contract 显式注册；
7. preserve the legacy tree as read-only reference by default。

删除、移动、untrack、`.gitignore` 修改或 bulk cleanup 需要独立列出 exact targets
并再次确认。Nested repository 的 legacy tree 默认 out of scope。

## Recovery

Apply 失败时保留 live preimage；已发布 backup 不自动删除。报告 backup path、
失败阶段、验证 finding 与下一步，不把 rollback 或 cleanup 当作隐含授权。
