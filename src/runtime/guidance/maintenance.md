# Runtime Maintenance

本文件持有 runtime、adapter 与 registry 运维边界。Runtime/adapter 使用正式 CLI；它们是
显式 maintenance actions，不属于普通 task dispatch。

## Runtime Inspect And Upgrade

Inspect 分别报告 source、dist 与 installed `VERSION`/manifest/hash。Source ready
而 `~/.catpaw/` 仍旧时，状态是 `pending activation`，不是失败也不是已升级。

Upgrade 默认 dry-run：列出 managed files 的 add/replace/remove、未知文件、
`state/`、adapter impact 与 project migration impact。Apply 前：

```text
catpaw runtime inspect --package /abs/dist/runtime --target /abs/installed/runtime
catpaw runtime plan --package /abs/dist/runtime --target /abs/installed/runtime --out /abs/plan.json --apply
catpaw runtime apply --plan-file /abs/plan.json --target /abs/installed/runtime
catpaw runtime apply --plan-file /abs/plan.json --target /abs/installed/runtime --apply
```

`plan --apply` 只保存计划；实际激活由 `runtime apply --apply` 执行。目标和包发生
漂移时重新生成计划，不重放陈旧声明。计划不能携带任意脚本或扩大原有授权。
默认备份位于目标同级 `.catpaw-operations/<target-name>/operation-<UUID>/`；可用
`--backup-root` 指定同一文件系统上、目标和包之外的位置。报告包含持久 receipt。

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

Adapter 仅负责触发、runtime 路径和不扩权提醒，细则由 runtime-policy 及其链接持有。
同步时保留 block 外的个人约束；runtime 的默认许可不能抵消这些明确限制。
分别报告 runtime parity 与实际 host block parity；前者通过不证明后者已同步。

Deterministic merge：

- zero managed blocks -> append 一个 block，并保留原 newline style；
- one managed block -> replace 该 block，不改 block 外内容、mode 或 ownership；
- multiple managed blocks -> block，列出每个 range，不自动选一个；
- 发现 unmanaged CatPaw section 时先报告 overlap，要求 user decision：保留并只加
  managed block，或由用户确认 exact range 后替换；不得静默留下两套 authority。

用 `adapter plan --target /abs/actual-rule-file --scope global|project` 预览；
`--out /abs/adapter-plan.json --apply` 保存计划。随后用
`adapter apply --plan-file /abs/adapter-plan.json --target /abs/actual-rule-file --apply`
写入。备份与 receipt 采用上面的 operation 目录布局；preimage digest 变化即拒绝。
整个操作只接管一个文件，不复制其所在的 Claude/Codex 配置目录。Apply 后验证恰好一个 managed block、
runtime-policy link 可读且用户内容 byte-preserved。Source changes 不自动 refresh
adapter，也不把 runtime package 复制进 host config 或 project。

## Superseded Method Package Retirement

只有 installed CatPaw `3.1.0` 或更高版本的 strict activation 已通过，且实际 host adapters are
current，才可把 Superpowers uninstall 作为独立 global maintenance action 执行。Runtime
source build、pending activation 或单个 adapter 更新都不满足这个前置条件。

Apply 前 inventory 每个 plugin record、enabled config、skill link、checkout/cache，以及
Superpowers 建立或使用的目录；preserve all existing project and worktree directories，
包括 `~/.config/superpowers/worktrees/`。Uninstall must not delete, move, or clean any worktree，
也不删除其中的 branch、未提交内容或 unique commit。插件卸载只处理已确认的
plugin-managed config/cache/skill surface；无法证明归属的目录保持原位并报告。

优先使用 host 官方 plugin remove/uninstall 命令。Apply 后分别确认 Codex/Claude 不再
列出或启用 Superpowers，skill discovery 不再暴露其 skills，既有 worktree list 与
preimage inventory 一致。卸载不隐含 runtime activation、adapter merge、branch cleanup
或 project migration。

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
      "runtimeSeen": "3.4.3",
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

Schema 2 历史漂移先用 `board doctor` 定位，再按原始事实有界修复。Evidence 缺口的
增量修复遵循 [Evidence Contract](evidence.md)；不能关闭检查或捏造验证结果。

已有 schema 1 board 使用 [Schema 2 Migration](../migrations/schema-2.md)。
该文件唯一持有推断顺序、保守默认值、mapping、checksum archive、链接、阻塞条件、
事务和验收规则；维护时不要在本文件再复制一套。

尚未成为 CatPaw board 的 `todos/` 按以下边界导入：

| Legacy source | Schema 2 target |
|---|---|
| `plan.md`, `reqs.md` | `index.md` narrative 与 Work inventory |
| `reqs/*` | `work/` |
| `plans/active/*`, `plans/archive/*` | 有明确 Work binding 的可选 `plans/` |
| `research/*`, `tests.md`, `tests/*`, `reviews/*` | 对应类型的 Work-bound 或 topic Evidence |
| `lessons.md` | 来源明确、可独立复用的 reflection Evidence |
| `.claude/`, `.codex/` | 只做 inventory/report，不复制配置 |

先 inventory 完整 legacy tree、tracked/ignored state、links、unknown/binary files
和 board 外基线，再明确逐项 mapping 与授权范围。CLI 的 schema 1 converter 不等于
任意 `todos/` importer；不支持的历史布局由 Agent 在授权内组织导入，保留原件和
可复核的来源关系。无法安全绑定的结构先报告，不猜身份或伪造完成状态。

发布前核对文件/identity/binding 数量、原件内容与模式、index narrative、schema/graph
及 board 外基线；publish 前 recheck preimage，有并发改动就重新 stage。完成后才按
独立 registry 授权更新索引。Nested repository 的 legacy tree 默认不在范围内。
删除、移动、untrack、`.gitignore` 修改或 bulk cleanup 另列 exact targets；只有
现有授权覆盖这些目标时才执行，不因 import 自动取得清理权。

## Recovery

`runtime recover --receipt /abs/receipt.json --target /abs/runtime` 或对应
`adapter recover` 先预览，`--apply` 才恢复。操作在移动 live 前持久记录阶段；失败
时只有实际旧副本和新候选仍匹配才自动恢复，否则保留所有副本并报告 recovery-required。
Runtime 目录发布使用两个受保护的 rename，存在短暂不可用窗口；这不是跨目录原子
交换，也不是防御同用户恶意绕过协作锁的隔离边界。恢复拒绝覆盖漂移后的用户数据。
成功激活的完整旧 runtime 保留在 receipt 指向的 backup；不自动清理备份。
3.x runtime 恢复后不能写 contract 4 Work；项目 board 从未被 runtime 恢复重写。
