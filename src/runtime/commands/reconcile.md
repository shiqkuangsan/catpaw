# catpaw:reconcile

Reconcile low-risk derived CatPaw artifact state after a status change.

## Default Mode

Default to `--dry-run`.

```text
catpaw:reconcile [REQ-ID] --dry-run
catpaw:reconcile [REQ-ID] --apply
```

## Scope

Only reconcile CatPaw project artifacts under `.catpaw/`.

Low-risk derived updates may include:

- Regenerating or trimming active entries in `.catpaw/index.md` from req status.
- Regenerating or trimming Active Milestones rows in `.catpaw/index.md` from
  milestone status.
- Updating links from `plans/active/` to `plans/archive/` after a plan is archived.
- Updating lightweight `Status:` fields in plan, review, and test artifacts when the req is terminal and evidence exists.
- Removing stale active-dashboard references to done/cancelled reqs.
- Reporting stale wording that needs human judgment.

Do not rewrite substantive req, plan, review, test, or research content without user confirmation.

## Dry-run Output

Show the intended patch-level summary:

```text
Will update:
- .catpaw/index.md: remove FR-001 from Active Work
- .catpaw/reviews/FR-001-title/summary.md: Plan link active -> archive

Needs user decision:
- .catpaw/tests/matrices/FR-001-title.md still has pending rows.
```

## Apply Behavior

When `--apply` is explicitly requested:

- Apply only the low-risk derived edits listed in the dry-run.
- Preserve user-authored narrative content.
- Re-run doctor-style checks after writing.
- Report changed files and remaining findings.

## Registry lastSeen

On `--apply` success, opportunistically update `lastSeenAt` and `lastSeenVia: reconcile` for the current board in `~/.catpaw/state/projects.json` when the registry exists and the board is registered. Do not auto-register on dry-run; mention as a finding so apply will create the entry only when the user explicitly upgrades or re-inits.

## Guardrails

- Do not mark a req done.
- Do not mark a milestone done.
- Do not close work.
- Do not add or remove reqs from milestone scope.
- Do not archive or delete plans.
- Do not fabricate verification evidence.
- Do not commit, push, create PRs, deploy, or perform destructive cleanup.
- Do not auto-register the board in the registry.
