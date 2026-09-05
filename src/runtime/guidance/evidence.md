# Evidence Contract

## Candidate And Continuity

New Work uses explicit `contract: 4` inside schema 2. `acceptance`, `scope`,
`owner` and `cycle` are scalar fields; the Work body outside the managed Progress
block and bound optional Plan bodies/identities also contribute to the candidate.
Plan timestamp-only changes do not invalidate it. Write concrete acceptance before
checking. `work show` returns the candidate SHA-256. Scope is project-relative;
Git projects include tracked and non-ignored untracked files, contents, deletions
and modes. Board/Git state is excluded; non-Git projects include all scoped files.
Symlinks and unsupported content refuse hashing. No claim covers ignored files
or effects outside the declared project scope.

`evidence add --result passed --candidate <sha>` records an assertion about that
exact candidate; name the acceptance and original result in its body. The latest
test and independent review/provider result for the same candidate and cycle
win; failed, blocked and not-run results supersede previous passes. Actor names
and independence are asserted, not authenticated. Main-owner self-review cannot
satisfy the independent gate. Reuse valid Evidence; recheck only changed claims.

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
The degraded board's dashboard stays unchanged; run `board doctor` and then
`board doctor --fix --apply` to refresh it after repair.

## Decisions And Authorization

Record only consequential decisions, inline in Work: a product decision states
the chosen outcome, an authorization states the user instruction and exact
action/target boundary, and risk acceptance names the actual uncovered risk.
These are references to user decisions, never CLI capabilities. Existing scoped
authorization persists across steps. Ask only when a necessary decision lies
outside it. Do not create a mandatory Approval artifact or new approval stage.
