# catpaw:plan

Create CatPaw req / plan artifacts for L2 or L3 work.

## Inputs

- User request
- Current project context
- Existing `.catpaw/index.md` if present
- Relevant templates from `~/.catpaw/templates/`

## Behavior

- For L2, create req + plan + verification record in plan.
- For L3, create req + plan with Risk Gates and Council sections, plus test matrix skeleton.
- For L2/L3, choose lifecycle roles from the active stage and risk triggers before implementation.
- For behavior-sensitive L2/L3 work, require `Contracts / Invariants`, boundary verification, and a risk ledger before implementation.
- For forced provider triggers, name the required non-primary provider path,
  fallback, and any provider gap before implementation.
- For Subagent Preference Gate triggers, record provider stance as
  `preferred`; if the preferred subagent is not used, keep the stance as
  `preferred` and record provider outcome with `Subagent skipped: <reason>`.
  `skipped` is an outcome, not a provider stance.
- For `preferred`, final plan evidence must show either `Provider outcome:
  used` with subagent findings, or `Provider outcome: skipped` with `Subagent
  skipped: <reason>`.
  Short form: `Provider outcome: used` or `Provider outcome: skipped`.
- For frontend or UI-facing work, name the intended self-verification surface in
  the plan: existing tests, Browser / browser-use / in-app browser, Playwright,
  Chrome DevTools, Computer Use, or a blocked/unavailable reason. Record why
  that surface is sufficient, and promote Computer Use when the flow depends on
  a real window, OS dialog, native app, cross-app interaction, accessibility
  tree, browser extension, profile/session state, or a surface browser
  automation cannot reach.
- Do not implement before the plan is approved when the user is in plan-only / research-first mode.
- Keep plan steps small and verifiable.
- Do not create duplicate active plans for the same req.
- If a new req belongs to an active milestone, link it from the milestone Scope
  table instead of adding milestone frontmatter to the req.
- New req files must use the frontmatter defined in `templates/req.md`.
- Set `closed: null` for non-terminal reqs.

Behavior-sensitive triggers:

- search / query / ranking / filtering
- cache / memoization / dirty state / invalidation
- async lifecycle / UI show-hide / event ordering
- pagination / ordering / consistency
- DB migration / indexes / persistence format
- performance fast path / fallback path
- serialization / payload shape / API contract

Quality gate:

- Contracts must describe what must not change.
- Boundary verification must cover at least one new branch, threshold, fallback, cache state, pagination boundary, or migration path.
- UI verification must exercise the changed flow through the strongest available
  interactive tool before user handoff, unless the plan records why that is
  blocked. The plan should state selected surface, selection reason, expected
  evidence, and remaining gap.
- Risk ledger statuses are limited to `fixed`, `mitigated`, `deferred`, and `not addressed`.
- If no contract can be stated, stop and research before writing implementation code.

Role gate:

- L2 usually names one stage-primary role plus at most one risk role in `Notes.Review`.
- L2 should prefer current-tool subagent unless the work is narrow, local, and
  already well understood.
- L1/L2 work touching 3+ files, shared helpers, public docs/protocols, runtime
  policy/spec/commands/templates, unfamiliar modules, weak tests,
  consistency-sensitive multi-file changes, non-trivial UI/design/QA review, or
  broad completion review should use provider stance `preferred`.
- Behavior-sensitive L2 must include at least one non-primary contract /
  semantic review provider; current-tool subagent is sufficient unless risk
  calls for Laoer / heterogeneous second opinion.
- Cross-boundary L2 must include at least current-tool subagent architecture or
  contract review when it spans 2+ subsystems, frontend/backend or IPC
  boundaries, platform differences, persistent formats, API contracts, or
  long-lived compatibility.
- L3 must fill the plan `Council` section with intended roles and providers,
  including at least one non-primary provider for formal review.
- Release, security, external action, CI/CD, migration, incident, or destructive
  operation gates must attempt Laoer / heterogeneous second opinion first, then
  fall back to current-tool subagent if unavailable.
- Use the lifecycle role routing table in `specs/09-roles.md`: Think, Plan, Build, Review, Test, Ship, Reflect each have different default roles.
- A role may be handled inline by the primary agent only when no forced provider
  trigger or Subagent Preference Gate trigger applies, or when a preference
  trigger is explicitly skipped with a compact reason. Use `catpaw:provider`
  when another provider is required or preferred.
- If a forced provider cannot be reached, record the unavailable reason and
  provider gap in the plan. Do not treat the gate as complete unless the user
  explicitly accepts the gap.
- If a preferred subagent is skipped, record why inline handling is sufficient.

## Artifact Paths

- Req: `.catpaw/reqs/FR-001-<slug>.md`, `.catpaw/reqs/BUG-001-<slug>.md`, or `.catpaw/reqs/CHORE-001-<slug>.md`.
- Milestone: `.catpaw/milestones/MS-001-<slug>.md`.
- Active plan: `.catpaw/plans/active/<req-id>-<slug>.md`.
- L3 test matrix: `.catpaw/tests/matrices/<req-id>-<slug>.md`.
- Review summary when needed: `.catpaw/reviews/<req-id>-<slug>/summary.md`.
- Do not create `.catpaw/lessons/`; append reusable lessons to `.catpaw/lessons.md`.

## Output

Report:

```text
Created/updated:
Level:
Roles:
Review mode:
Provider gate:
Verification plan:
Next action:
```
