# catpaw:doctor

Scan a project `.catpaw/` artifact graph for status, link, and stale-state inconsistencies.

## Mode

Project-artifact read-only. Do not write project `.catpaw/` files.
May update registry `lastSeen` metadata for registered boards as described
below.

## Graph Root

Use req IDs as graph roots:

```text
req -> plan -> research -> tests -> reviews -> lessons/docs
```

## Checks

- Req lifecycle:
  - `status: done` or `status: cancelled` must have `closed: YYYY-MM-DD`.
  - Non-terminal reqs must have `closed: null`.
  - `updated` should reflect the last meaningful status/content change.
- Index consistency:
  - Done or cancelled reqs should not remain under Active Work.
  - Active reqs should be discoverable from the dashboard or active plans.
- Plan consistency:
  - Active reqs may point to `plans/active/`.
  - Done/cancelled reqs should not require an active plan unless intentionally left open.
  - Archived plan links should not still point to `plans/active/`.
- Research consistency:
  - Research linked from a closed req should not remain `active` unless it is intentionally continuing.
  - Validated research should not contain unresolved decision wording without a reported risk.
- Test matrix consistency:
  - Closed reqs should not have `pending` results unless reported as unresolved risk.
  - L3 work should have a test matrix.
- Review consistency:
  - Formal review summaries should point to the current plan path.
  - Review decisions should not conflict with req terminal status.
- Stale wording:
  - Flag suspicious closeout leftovers such as `pending`, `future`, `in progress`, `plans/active`, `status: active`, and stale TODO language.
- Lessons:
  - If reviews, closeout notes, or docs contain reusable process corrections, prompt whether a lesson should be appended.

## Output

Group findings by req ID:

```text
FR-001:
  - [index] req status is done, but index still lists it under Active Work.
  - [link] review summary points to plans/active after plan archive.
  - [tests] matrix still contains pending rows.

Suggested:
  catpaw:reconcile FR-001 --dry-run
```

## Severity

- `error`: lifecycle contradiction or broken link.
- `warning`: stale wording, missing evidence, or ambiguous active state.
- `info`: optional cleanup or lesson prompt.

## Registry lastSeen

Opportunistically update `lastSeenAt` and `lastSeenVia: doctor` for the current board in `~/.catpaw/state/projects.json` when the registry exists and the board is registered. If the registry does not exist or the board is not registered, do not auto-register; mention it as a tail note.

For global registry health checks (missing boards, stale stamps, discovery), use `catpaw:registry-doctor` instead.

## Limits

- Do not write project `.catpaw/` files.
- Do not infer success without verification evidence.
- Do not commit, push, create PRs, deploy, or perform destructive cleanup.
- Do not auto-register the board in the registry.
