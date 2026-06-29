# 08. Operating Rules

> Status: draft · Last updated: 2026-06-29 (2.1.4: compact execution rules)

This spec records practical execution rules for agents. Structural definitions
live in earlier specs; concrete runbooks live in `commands/`.

## 1. Start-of-task Classification

Classify in this order:

```text
Intent classification
-> Workflow level classification: L0/L1/L2/L3
-> Lifecycle/subsystem decisions: research / plan / review / tests / lessons
-> Workflow state target when tracked
-> Lifecycle role routing
-> Artifact decisions
-> Provider stance
-> Verification level
```

Rules:

- Intent first, then risk/complexity, then artifact needs.
- Workflow level is user-visible: say `CatPaw dispatch: Lx ...` before
  meaningful execution.
- L2/L3 or review-heavy work should name role stance and verification/review
  expectation.
- Explicit user override wins, but required verification and safety gates do
  not disappear.
- `specs/13-workflow-control-model.md` is the canonical decision table for
  level, lifecycle stage, tracked state, artifact policy, roles, provider
  stance, and verification.

## 2. Workflow State and Artifact Policy

Canonical rules live in `specs/13-workflow-control-model.md`.

Minimums:

- L0/L1 usually do not create artifacts.
- L2 defaults to req + plan + verification record in plan.
- L3 defaults to req + plan + test matrix + formal review summary.
- State labels such as `framed`, `planned`, `building`, `reviewing`,
  `verifying`, `done`, `blocked`, and `cancelled` describe progression; they are
  not a new required
  frontmatter schema.
- At user-visible checkpoints, report `Completed`, `Updated artifacts`,
  `Verification`, `Next`, and `Needs user decision`.

## 3. Level Operating Rules

| Level | Operating rule |
|---|---|
| L0 | Execute directly, verify inline, report. Escalate if scope grows. |
| L1 | Use a light plan, avoid durable artifacts by default, verify inline. |
| L2 | Write req + plan; record verification in plan; usually use one or two roles. |
| L3 | Write req + plan + test matrix + formal review; fill Risk Gates and Council; preserve provider evidence or accepted gaps. |

L2 is for cross-module/layer work, uncertainty, API contracts, persistence
formats, performance, and complex UI flows. L3 is for auth/security, secrets,
CI/CD, release/deploy, migration, destructive operations, large refactors,
incidents, and final PR review.

External actions require explicit user confirmation.

## 4. Contract-first Quality Gates

Behavior-sensitive changes must define preserved semantics before optimization
or refactor work begins. Triggers include search/ranking/filtering, cache,
async lifecycle, pagination/order, DB migration/indexes, persistence formats,
performance fast paths, serialization, and API contracts.

Rules:

- `Contracts / Invariants` names user-visible behavior, API semantics,
  consistency, compatibility, security boundaries, or result-set rules.
- `Verification` covers at least one boundary case from branch conditions,
  thresholds, fallback behavior, cache states, or migration paths.
- `Risk Ledger` distinguishes `fixed`, `mitigated`, `deferred`, and
  `not addressed`.
- Treat fast paths as possible semantic changes until equivalence is proven or
  the behavior change is accepted.
- If no contract can be defined, pause into research.

## 5. Frontend / UI Interactive Verification

For UI-facing work, do not hand ordinary verification back to the user while a
usable interactive surface exists.

Preferred surfaces:

1. repo-native browser/component/integration/app tests;
2. Browser / browser-use / in-app browser for local or visible web targets;
3. Playwright or Chrome DevTools for reproducible flows and evidence;
4. Computer Use for real local windows, OS dialogs, native flows,
   accessibility tree checks, browser extensions, profile/session state, or
   browser-automation gaps;
5. manual reasoning only when interactive tools are unavailable or blocked.

Surface selection:

- Browser / browser-use is the default for ordinary local web inspection.
- Playwright or Chrome DevTools is preferred for repeatable console/network,
  screenshot, responsive, or regression evidence.
- Computer Use moves ahead when behavior depends on a real window, OS dialog,
  permission prompt, file picker, native app, cross-app flow, accessibility
  tree, browser extension, profile/session state, or another surface browser
  automation cannot reach.
- Handoff/review names selected surface, selection reason, observed result,
  remaining gap, and blocked/unavailable reason when a stronger surface was
  skipped.

Browser Use and Computer Use are verification surfaces, not permission grants.
They do not authorize external submissions, destructive UI actions, permission
changes, commits, pushes, PRs, deploys, or other visible side effects.

## 6. Lifecycle Role Orchestration

Expert Council roles are chosen first by lifecycle stage, then by risk. Full
stage routing lives in `specs/09-roles.md`.

Rules:

- L0/L1 do not call Expert Council by default; at most apply one inline lens.
- L2 defaults to one or two roles; findings may be inline or in plan
  `Notes.Review`.
- L3 records role + provider in plan `Council` and formal review summary.
- Provider selection follows `commands/provider.md`.
- Role recommendations do not authorize external actions, destructive actions,
  scope expansion, or secret access.

## 7. Provider Selection

Provider stance is the planned selection posture:

| Stance | Meaning |
|---|---|
| `inline` | The primary agent handles the work directly. |
| `preferred` | Current-tool subagent is the default, but may be skipped with a compact reason. |
| `forced` | CatPaw requires a non-primary provider attempt or an explicit provider gap. |

Provider outcome is the observed result and must not be mixed into stance:

| Outcome | Meaning |
|---|---|
| `used` | A provider was consulted and produced usable evidence. |
| `skipped` | A preferred provider was not used; record `Subagent skipped: <reason>`. |
| `unavailable` | A provider could not be reached, timed out, or returned no usable output. |
| `gap` | A forced provider requirement remains unsatisfied. |

Subagent Preference Gate:

- Prefer current-tool subagent for L2 work unless narrow, local, and understood.
- Prefer current-tool subagent for L1 work touching 3+ files, shared helpers,
  public docs/protocols, runtime policy/spec/commands/templates, unfamiliar
  modules, weak tests, consistency-sensitive multi-file changes, non-trivial
  UI/design/QA review, or broad completion review.
- A preference trigger defaults to one bounded read-only subagent check before
  final plan, review, or completion when a native subagent is available.
- For `preferred`, evidence must show `Provider outcome: used` with subagent
  findings, or `Provider outcome: skipped` with `Subagent skipped: <reason>`.
- If skipped, keep stance `preferred` and record `Subagent skipped: <why inline
  handling is sufficient>`.
- Forced Provider Gate has higher priority; if unavailable, record outcome
  `unavailable` and any remaining provider `gap`.

## 8. Provider Availability

Provider availability is based on observable state, not stdout alone. CatPaw is
capability-aware: tmux, Claude Code, Codex, Gemini, OpenCode, and provider
subscriptions are optional user/environment capabilities, not runtime
prerequisites.

Rules:

- No stdout while a provider process or session is still alive is not enough to
  mark the provider `unavailable`.
- Before recording `unavailable`, `timeout`, or provider `gap`, inspect an
  available progress signal: process state, session status, recent pane output,
  provider-native state, or explicit waiting-for-input text.
- Prefer this fallback order: observable provider session -> provider-native or
  non-interactive CLI -> current-tool subagent -> inline role lens with explicit
  provider gap / skip reason.
- For L3 review, release/security/incident gates, multi-round discuss/debug, or
  provider work expected to read many files, prefer observable long-running
  provider mode when available.
- Observable mode does not authorize writes, commits, pushes, PRs, deploys,
  destructive actions, scope expansion, or secret access.
- Missing tmux/provider CLI/subscription or user refusal to use another
  provider should downgrade verification strength honestly, not break ordinary
  L0/L1/L2 CatPaw work.
- Block only when the selected workflow requires non-primary provider evidence
  and the user does not accept the remaining provider gap.

## 9. Escalation And Completion

Escalate when scope, uncertainty, architecture impact, security, release,
migration, CI/CD, destructive risk, or end-to-end mechanism uncertainty appears.
De-escalate when research proves the work is smaller; preserve useful existing
artifacts.

Completion rules:

- For L2/L3, prefer `catpaw:close <REQ-ID> --dry-run`.
- Remove closed work from `.catpaw/index.md`.
- Mark req frontmatter `status: done` and update `updated` / `closed`.
- Archive plans only when they have decision or reuse value.
- Keep tests/reviews only when they preserve evidence or reuse value.
- Write lessons only for reusable corrections.
- Scan stale language such as `pending`, `future`, `in progress`,
  `plans/active`, and `status: active`.

## 10. Reporting And Status Commands

Final reports include what changed, verification results, remaining risks/open
items, key CatPaw links when artifacts were used, and next recommended action.
If no next action remains, say `Next: none`.

For CatPaw-routed L1/L2/L3 work, provide this handoff after each user-visible
checkpoint and in the final response:

```text
Completed:
Updated artifacts:
Verification:
Next:
Needs user decision:
```

If a plan exists, update plan step / verification / risk ledger before the
handoff.

When the user asks for progress, next action, or consistency:

- `catpaw:status` gives the user-readable summary.
- `catpaw:doctor` reports graph health.
- `catpaw:reconcile --dry-run` previews low-risk derived fixes.
- `--apply` only when requested or required by the current task.

`reconcile` may fix derived index entries, active/archive links, and lightweight
status fields. It must not fabricate evidence or mark reqs done; closing a req
is `catpaw:close`.
