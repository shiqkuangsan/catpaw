# catpaw:status

Summarize the current CatPaw project state and recommend the next action.

## Mode

Project-artifact read-only. Do not write project `.catpaw/` files.
May update registry `lastSeen` metadata for registered boards as described
below.

## Inputs

- `.catpaw/index.md`
- `.catpaw/reqs/*.md`
- `.catpaw/plans/active/*.md`
- `.catpaw/research/**/*.md`
- `.catpaw/tests/matrices/*.md`
- `.catpaw/reviews/*/summary.md`
- `.catpaw/lessons.md`

## Behavior

- Build a lightweight active-work view from req frontmatter and active plans.
- Treat req files as the source of lifecycle truth.
- Treat `.catpaw/index.md` as an active dashboard, not as durable history.
- Report blockers, stale state, missing verification, and user-decision points.
- Recommend one next action when possible.
- If no next action remains, state the waiting state explicitly instead of
  leaving the user to ask what is next.
- If artifacts are inconsistent, recommend `catpaw:doctor` or `catpaw:reconcile --dry-run`.

## Output

Use this shape:

```text
Dispatch:
Current status:
Progress:
Blocked by:
Changed artifacts:
Verification:
Next recommended action:
Needs user decision:
```

For CatPaw-routed L1/L2/L3 progress handoff during active work, use this compact
form at each user-visible checkpoint and in the final response:

```text
Completed:
Updated artifacts:
Verification:
Next:
Needs user decision:
```

`Next` and `Needs user decision` are required. If no user decision is needed,
say `Needs user decision: no`.

## Registry lastSeen

Opportunistically update `lastSeenAt` and `lastSeenVia: status` for the current board in `~/.catpaw/state/projects.json` when the registry exists and the board is registered. If the registry does not exist or the board is not registered, do not auto-register; mention it as a tail note.

This is the only write this command performs; it does not touch any project `.catpaw/` files.

## Limits

- Do not change `.catpaw/` files.
- Do not close work.
- Do not commit, push, create PRs, deploy, or perform destructive cleanup.
- Do not auto-register the board in the registry.
