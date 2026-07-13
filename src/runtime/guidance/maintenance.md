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
      "runtimeSeen": "3.0.4",
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
| `todos/reqs/*` | `work/`；metadata 缺失由 migration inference 补齐 |
| `todos/plans/active/*`, `todos/plans/archive/*` | `plans/`；从明确 binding 或 canonical filename 绑定 Work |
| `todos/research/*` | work-bound 或 topic `research Evidence` |
| `todos/tests.md`, `todos/tests/*` | work-bound 或 topic `test Evidence` |
| `todos/reviews/*` | work-bound 或 topic `review Evidence` |
| `todos/lessons.md` | 每条可独立复用且来源明确时转成 `reflection Evidence` |
| `.claude/`, `.codex/` | inventory/report only；不复制到 board |

Migration metadata 对普通用户是 implementation detail，不形成补录任务。Legacy
artifact frontmatter 先按严格 scalar contract 解析；遇到嵌套字段或其它旧格式时，
migration 保留原件、恢复可安全读取的 top-level scalar，并把其余 optional 字段记为
`recovered-frontmatter` warning。无法解析的 `id/work/req`、invalid explicit identity 与
unterminated frontmatter 属于 identity hazard，继续 block。按下列顺序自动解析，每个
artifact 只报告聚合的 provenance：

1. explicit valid frontmatter；
2. canonical alias normalization；
3. filename、H1、artifact root 与唯一 path binding；
4. `## Status` / `## 状态`、index 中该 ID 的行、Milestone 的 FR/Scope section；
5. Plan/Test/Review graph 与 conservative defaults。

Conservative defaults：未知 nonterminal `status -> blocked`，terminal history
`mode -> tracked`，其它未知 Mode `-> gated`；terminal `stage -> reflect`，其它 stage
按已有 Plan/Test/Review 推断。日期优先使用 metadata/正文中的合法日期，再使用 board
中的最新日期，最后使用 migration observation date。Evidence 只有在 explicit boolean
`independent: true` 且 Agent 非空时才算 independent；无法绑定的 Evidence 转 topic，
不丢弃。原正文不改写语义，原文件全部进入 checksum archive。

只有无法安全决定结构时 block：canonical identity 冲突/缺失、duplicate ID、Plan 无法
绑定现有 Work、target collision、path escape、invalid index authority、invalid UTF-8、
special/unsafe filesystem entry、stale preimage 或 staged validation failure。普通 artifact
的 malformed/nested optional frontmatter 不阻塞；historical research/provider Evidence 或
preserved unknown narrative 的缺失 in-board link 保留原链接并 warning，index/Work/Plan 等
active authority 中的缺失链接仍 block。Legacy root 下的 UTF-8 symlink 只把 link target 文本归档为 inert
sidecar，并在 manifest 分别记录原 alias 的 `sourceMode` 与 sidecar 的 `mode`，然后安全移除
alias；不 dereference、不在 schema 2 active surface 重建。非 UTF-8 target、其它
symlink 与 special entry 仍 block。Stale routing、缺少 lifecycle metadata 与 historical
completion gate 不要求用户补 YAML；前两者归一化并 warning，后者生成明确列出 missing
gates 的 migration reflection gap。

Execution：

1. inventory 完整 legacy tree、tracked/ignored state、links、unknown/binary files，
   并记录 `.catpaw/` 外的 worktree baseline；
2. 把 mapping 分析与 patch plan 绑定到同一 source tree digest；digest 变化即 block 并重算；
3. 输出完整 source -> target mapping、inference summary、结构 blockers 与 target tree dry-run；
4. 无结构 blocker 时，在 sibling stage 创建 schema 2 board；
5. 保留 index narrative 与全部原件，重写可确定 local links，unknown files 原样保留；
6. 对 staged board 运行 `board doctor`、schema/graph 检查，并自动对账 legacy manifest
   的文件集合与 bytes/hash/mode/sourceMode；
7. 验证通过且用户确认后发布 board，再按 registry contract 显式注册；
8. preserve the legacy tree as read-only reference by default。

Operator/release acceptance DoD：source artifact inventory 与 native
mapping/preserved disposition 数量守恒；
Work/Milestone identity 集合及 Plan/Evidence binding 与 mapping report 一致；
manifest 中每个 regular file 的 bytes/hash/mode 可复验，symlink sidecar 的
target/hash/sourceMode/mode 可复验；
index narrative 保留；staged 与 published board 的 `status`/`doctor` 无 finding；再次
`board migrate` 精确 `noop`；`.catpaw/` 外的 tracked/ignored baseline 不因迁移改变。
Board 正在被其它 task 写入时，publish 前必须重算 tree
digest；preimage 有变化就基于最新 snapshot 重新 stage，不覆盖或手工拼接并发改动。

删除、移动、untrack、`.gitignore` 修改或 bulk cleanup 需要独立列出 exact targets
并再次确认。Nested repository 的 legacy tree 默认 out of scope。

## Recovery

Apply 失败时保留 live preimage；已发布 backup 不自动删除。报告 backup path、
失败阶段、验证 finding 与下一步，不把 rollback 或 cleanup 当作隐含授权。
