# Evidence Contract

## Claim Coverage

证据只支持实际检查过的声明。记录时写清验收范围、候选或环境、原始结果位置及剩余
缺口；引用已有日志和回执，不复制成多份台账。原始材料无法持久保留时，明确复现
入口和限制。保留、共享与访问边界遵循项目约定，不擅自提交私有证据。

局部测试通过，但 Work 验收要求的真实链路尚未验证时，保留局部通过和未验收的事实，
不能据此关闭整项 Work。为整项验收记录 `passed` 前，主 Agent 须确认覆盖全部要求；
尚未执行或受阻的整项结论用 `not-run` 或 `blocked`，实际失败保留为 `failed`。
`evidence run` 自动捕获的 `passed` 只证明该命令执行成功，不是整项验收结论。

`work show` 的 `missingCompletion: []` 只表示记录满足 CLI 门禁。CLI 不解析正文来
判断场景是否齐全，也不认证人工断言。Finish 前由主 Agent 对照当前验收、原始结果和
限制核对覆盖；不能用 board healthy、exit zero 或通过记录数量替代这个判断。
例如，本地测试通过不证明真实服务联调通过；联调通过不证明已经部署到生产。

## Candidate And Continuity

New Work uses explicit `contract: 4` inside schema 2. `acceptance`, `scope`,
`owner` and `cycle` are scalar fields; the Work body outside the managed Progress
block and bound optional Plan bodies/identities also contribute to the candidate.
Plan timestamp-only changes do not invalidate it. Write concrete acceptance before
checking. `work show` returns the candidate SHA-256. Scope is project-relative;
Git projects include tracked and non-ignored untracked files, contents, deletions
and modes. Board/Git state is excluded; non-Git projects include all scoped files.
明确指向嵌套 Git 仓库内部的 scope 使用该子仓库的文件清单与忽略规则，路径仍相对
项目根记录；不会自动遍历 scope 路径之外的其它仓库。
Symlinks and unsupported content refuse hashing. No claim covers ignored files
or effects outside the declared project scope.

`evidence add --result passed --candidate <sha>` records an assertion about that
exact candidate; name the acceptance and original result in its body. The latest
test and independent review/provider result for the same candidate and cycle
win; failed, blocked and not-run results supersede previous passes. Actor names
and independence are asserted, not authenticated. Main-owner self-review cannot
satisfy the independent gate. Reuse valid Evidence; recheck only changed claims.
Contract 4 writes append observations, including same-date/title reruns and
repeated assertions; they never overwrite earlier results. Inspect the latest
record before retrying an uncertain write. Concurrent board drift still refuses
publication; a captured command is never automatically rerun to resolve it.

`status` checks high-risk Evidence against the live candidate, like `work show`.
If the candidate cannot be inspected, it reports `proofCheck: unchecked` with
`missingProof: null`; this is neither a pass nor an assertion that records are
missing. `board status` remains a storage-only view. Legacy JSON `proof` fields
remain compatible names for Evidence.

`evidence run --work <id> --title <purpose> --apply -- <executable> [args]`
executes without a shell and captures exit status, duration and output/command
digests. Its default is a non-executing preview. It never grants execution
authority, persists raw output/arguments, or proves test adequacy. Reading
Evidence never executes its command. A timeout/failure cannot pass the gate.
Timeout closes capture promptly; it cannot prove detached descendants have
terminated. Run only bounded checks within the existing task authorization.

`work finish` pins the accepted candidate. Later source changes do not invalidate
historical completion. `work continue --next <text>` preserves the closure and
starts a new cycle; prior Evidence does not automatically satisfy the new cycle.
Terminal Milestones keep their recorded snapshot. Older runtimes reject contract
4 metadata safely; use 4.x for new records. No fleet migration is implied.

For damaged history, scoped Work/Evidence commands tolerate only attributable
missing-completion findings. Evidence repair may reduce missing gates one at a
time. Schema, path, duplicate identity and unclassified graph errors still block.
The degraded board's dashboard stays unchanged. After repair, run `board doctor`
to validate; the next healthy Work mutation refreshes the managed dashboard.
`board doctor --fix --apply` only restores missing required directories.

## Decisions And Permission Boundaries

Record only consequential decisions, inline in Work: a product decision states
the chosen outcome, a permission note states the user instruction and exact
action/target boundary, and risk acceptance names the actual uncovered risk.
These are references to user decisions, never CLI capabilities. An existing
scope persists across steps. Ask only when a necessary action lies outside it.
Do not create a mandatory Approval artifact or new approval stage.

用户改变交付范围或授予后续动作后，同步更新 Work 中当前有效的目标、Scope、验收、
相关决定与 Next，取代失效的当前限制并保留必要的决定来源。业务范围与动作授权
分别核对；用于文件指纹的 `scope` 字段只界定候选覆盖路径，不能代替其中任何一个。
修改记录不授予权限。按上文 candidate 规则处理证据有效性；可复用的原始结果经核对
后重新关联，并说明复用边界，不伪称重新执行。避免旧正文与新执行事实互相矛盾，
也不为更新记录再次索要已有授权。

当前 `work update` 维护 Phase、Next 与 active/blocked 状态；验收、候选路径、owner
及业务正文由 Agent 精确编辑同一 Work，再用 `work show` / `board doctor` 复查。
不创建第二份契约，也不把手工编辑误称为 CLI 已提供的字段更新功能。
