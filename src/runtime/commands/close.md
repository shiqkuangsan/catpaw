# catpaw:close

Close CatPaw-tracked work after verification.

## Default Mode

Default to `--dry-run`.

```text
catpaw:close <REQ-ID|MS-ID> --dry-run
catpaw:close <REQ-ID|MS-ID> --apply
```

Closing is a scoped artifact transaction rooted at one req or milestone ID. It
should not perform global cleanup.

Closeout moves tracked work to the terminal workflow state `done` or
`cancelled`. See `specs/13-workflow-control-model.md` for the canonical
workflow state model and artifact policy.

## Behavior

- Require fresh verification evidence or explicit user confirmation before marking a req terminal.
- Show a dry-run patch summary before writing files.
- Mark req frontmatter as `status: done` or `status: cancelled`; set `updated` and `closed` to the close date.
- Remove the req from `.catpaw/index.md` Active Work.
- For milestone close, mark milestone frontmatter terminal, require included FR
  status evidence, and remove the milestone from Active Milestones.
- Keep `.catpaw/index.md` active-only; do not add completed/reference history entries by default.
- Archive the active plan if it has architecture / decision / reuse value.
- Delete purely procedural plans only when the user explicitly accepts that cleanup.
- Keep tests / reviews only if they contain evidence or reusable decisions.
- Update links from `plans/active/` to `plans/archive/` when a plan is archived.
- Update lightweight `Status:` fields in plan / test / review / research artifacts when safe.
- Scan for stale closeout wording such as `pending`, `future`, `in progress`, `plans/active`, and `status: active`.
- Prompt for a lesson entry when reusable corrections are found.

## Close Decisions

| Artifact | Default | Keep / archive when | Delete / skip when |
|---|---|---|---|
| `.catpaw/index.md` active item | Remove | n/a | Work is closed |
| Req | Keep in `.catpaw/reqs/` with terminal frontmatter | Always keep if it records accepted scope | n/a |
| Milestone | Keep in `.catpaw/milestones/` with terminal frontmatter | Always keep if it records phase scope, verification, and next recommendation | n/a |
| Plan | Delete | Archive only if it records decisions, tradeoffs, or reusable sequencing | Pure checklist with no future value |
| Review | Skip | Keep req-bound summary at `reviews/<req-id>-<slug>/summary.md` if it contains risk calls, disagreements, or release evidence; use `reviews/archive/` only for explicitly archived standalone/historical material | Light review with no durable findings |
| Tests | Skip | Keep matrix/evidence for L3 or reusable verification | Inline verification only |
| Lessons | Skip | Add only reusable corrections or rules | One-off task notes |

## Dry-run Output

Show:

```text
Will update:
- .catpaw/reqs/FR-001-title.md: status active -> done; closed -> YYYY-MM-DD
- .catpaw/index.md: remove FR-001 from Active Work
- .catpaw/plans/active/FR-001-title.md -> .catpaw/plans/archive/FR-001-title.md
- .catpaw/reviews/FR-001-title/summary.md: Plan link active -> archive

Cannot safely update:
- .catpaw/tests/matrices/FR-001-title.md still has pending rows.

Needs user decision:
- Append reusable lesson about closeout verification?
```

## Required Evidence

Before claiming done, report fresh verification evidence:

```text
Completed:
Verification command/manual check:
Result:
Remaining risks:
CatPaw artifacts changed:
Next:
Needs user decision:
```

Do not mark a req `done` only because checklist items are checked. There must be verification evidence or explicit user confirmation.

If no follow-up remains, write `Next: none; work is closed`. If commit, push,
PR, deploy, or destructive cleanup is the natural next action, report it as a
recommendation and wait for explicit user confirmation.

## Req Frontmatter Close Rule

When closing as completed:

```yaml
status: done
updated: YYYY-MM-DD
closed: YYYY-MM-DD
```

When closing as cancelled:

```yaml
status: cancelled
updated: YYYY-MM-DD
closed: YYYY-MM-DD
```

Do not move req files into `reqs/archive/` or `reqs/done/` unless a project-local rule explicitly requires it. Req path is identity-stable; terminal state belongs in frontmatter.

## Relationship to doctor/reconcile

- Run doctor-style checks before and after close when the work has L2/L3 artifacts.
- Use `catpaw:reconcile --dry-run` for low-risk derived cleanup if close discovers link drift or stale active-dashboard content.
- Keep close scoped to one req; use doctor for global health checks.

## Registry lastSeen

On `--apply` success, opportunistically update `lastSeenAt` and `lastSeenVia: close` for the current board in `~/.catpaw/state/projects.json` when the registry exists and the board is registered. Do not auto-register; mention as a tail note.

## Limits

- Do not commit automatically.
- Do not push, create PR, deploy, or perform destructive cleanup without explicit user confirmation.
- Do not auto-register the board in the registry.
