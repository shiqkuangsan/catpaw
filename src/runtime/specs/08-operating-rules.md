# 08. Operating Rules

> Status: draft · Last updated: 2026-05-25

This file records practical CatPaw usage rules. Earlier specs define structure,
levels, and templates; this file defines how agents classify, escalate, report,
and close work during execution.

## 1. Start-of-task Classification

Classify in this order:

```text
Intent classification
-> Workflow level classification: L0/L1/L2/L3
-> Lifecycle/subsystem decisions: research / plan / review / tests / lessons
-> Lifecycle role routing
-> Artifact decisions: whether .catpaw/ files are needed
-> Verification level
```

Principles:

- Classify user intent first, then risk/complexity, then artifact needs.
- Workflow level belongs only to orchestration; Review / Tests / Lessons use their own lightweight states.
- Workflow level is user-visible. Before meaningful execution, say `CatPaw dispatch: Lx ...` with level, short reason, artifact expectation, role stance, verification/review expectation, and next step.
- L2/L3 or review-heavy work should also name expected role stance: `Roles: none` or a concrete role set.
- Explicit user override wins, but required verification cannot be skipped.

## 2. L0 / L1 Lightweight Execution

Rules:

- Do not write req / plan / tests / reviews by default.
- Execute directly, verify, report.
- Use inline verification.
- If the work becomes more complex, escalate to L2.
- If the user explicitly asks for durable records, write the relevant CatPaw artifacts.

Use for:

- typo or tiny documentation edits;
- clear local bug fixes;
- low-risk single-module work;
- small follow-up tweaks to work just completed.

## 3. L2 Formal Work

Rules:

- Write a req.
- Write a plan.
- Keep the verification record in plan `Verification` by default.
- Choose roles by active lifecycle stage; usually one stage-primary role plus at most one risk role.
- Behavior-sensitive work must fill `Contracts / Invariants`, boundary tests, and a risk ledger.
- Review defaults to light; if no Expert Council is called, review may be none.
- Do not create `tests/matrices/<req-id>-<slug>.md` by default.
- Create tests files only when verification is complex, reusable, multi-environment, multi-platform, or multi-role.

Use for:

- cross-module or cross-layer work;
- high uncertainty or tradeoff analysis;
- API contract changes;
- persistence format changes;
- complex UI flows.

## 4. L3 High-risk Work

Rules:

- Write a req.
- Write a plan.
- The plan must include `Contracts / Invariants`, boundary tests, and a risk ledger.
- The plan must include `Risk Gates` and `Council` sections.
- The plan `Council` section must declare intended roles and provider stance.
- Write a test matrix under `tests/matrices/<req-id>-<slug>.md`.
- Perform formal review and keep at least `reviews/<req-id>-<slug>/summary.md`.
- External actions require explicit user confirmation.
- Multi-provider disagreements must be resolved in the review summary.

Use for:

- auth, permission, or security logic;
- secrets / credentials;
- CI/CD;
- deploy / release;
- data migration;
- large refactors;
- final PR review;
- production incident fixes;
- force push / reset / destructive-operation requests.

## 5. Contract-first Quality Gates

Behavior-sensitive changes must define preserved semantics before optimization
or refactor work begins. Typical triggers:

- search / query / ranking / filtering;
- cache / memoization / dirty state / invalidation;
- async lifecycle / UI show-hide / event ordering;
- pagination / ordering / consistency;
- DB migration / indexes / persistence format;
- performance fast path / fallback path;
- serialization / payload shape / API contract.

Execution rules:

- `Contracts / Invariants` must name user-visible behavior, API semantics, data consistency, compatibility, security boundaries, or result-set rules that must remain true.
- `Verification` must cover at least one boundary case from new branch conditions, thresholds, fallback behavior, cache states, or migration paths.
- `Risk Ledger` must distinguish `fixed`, `mitigated`, `deferred`, and `not addressed`; mitigation is not correctness.
- Treat performance fast paths as possible semantic changes until equivalence is proven or the behavior change is explicitly accepted.
- If no contract can be defined, pause implementation and move into research; return to planning after the conclusion stabilizes.

## 6. Frontend / UI Interactive Verification

For frontend or UI-facing work, the agent should not hand ordinary verification
back to the user while it has a usable interactive surface.

Preferred surfaces, in order when available:

1. repo-native automated browser, component, integration, or app-level tests;
2. Browser / browser-use / in-app browser for local or visible web targets;
3. Playwright or Chrome DevTools for reproducible flows, console/network checks, screenshots, and responsive coverage;
4. Computer Use for real local app/browser-window interaction, OS-level dialogs, native flows, accessibility tree checks, or cases browser automation cannot reach;
5. manual reasoning only when interactive tools are unavailable or blocked.

Surface selection:

- Browser / browser-use / in-app browser is the default for ordinary local web
  UI inspection and simple local click/type flows.
- Playwright or Chrome DevTools is preferred when the result should be
  reproducible, inspect console/network state, compare responsive viewports, or
  become regression evidence.
- Computer Use moves ahead when the behavior depends on a real window, OS
  dialog, permission prompt, file picker, native app, cross-app flow,
  accessibility tree, browser extension, profile/session state, or another
  surface browser automation cannot reach.
- The handoff or review must state the selected surface, selection reason,
  observed result, remaining gap, and blocked/unavailable reason when a stronger
  surface was skipped.

Rules:

- Verification reports should name the URL/app/window, flow, viewport/device when relevant, observed result, and remaining gap.
- Escalate to the user only for credentials, private app state, physical device/permission, blocked environment, or product judgment.
- Browser Use and Computer Use are verification surfaces, not permission grants. They do not authorize external submissions, destructive UI actions, permission changes, commits, pushes, PRs, deploys, or other visible side effects.
- Do not require browser/screenshot evidence for non-UI work.

## 7. Lifecycle Role Orchestration

Expert Council roles are chosen first by lifecycle stage, then by risk.

| Stage | Default role stance | Add-on triggers |
|---|---|---|
| Think | Product Strategy Advisor when scope/value is unclear | Architecture for feasibility; Design for UI/product flow; Developer Experience for developer-facing work |
| Plan | Architecture Reviewer for L2/L3 design | QA for acceptance; Security for auth/secrets/trust; Performance for scale/latency; Developer Experience for API/docs |
| Build | Primary agent executes; no role by default | Engineering for risky branches; Debugging for unclear root cause; Security/Performance for sensitive implementation |
| Review | Engineering Reviewer after L2/L3 implementation | Add Security, Performance, Design, or Release when the diff touches those risks |
| Test | QA Strategist for L3 or complex acceptance | Add Security, Performance, or Design when tests must prove those contracts |
| Ship | Release Strategist for release / deploy / PR / migration / external action | Add QA, Security, or Performance when evidence, exposure, or regression risk requires it |
| Reflect | Retrospective Advisor for reusable lessons or repeated failures | Product for scope lessons; Engineering for technical patterns |

Rules:

- L0/L1 do not call Expert Council by default; at most apply one role lens inline.
- L2 defaults to one or two roles; findings may be inline or recorded in plan `Notes.Review`.
- L3 must record role + provider in plan `Council` and formal review summary.
- Provider selection follows `catpaw:provider`; provider output must be summarized by the primary agent as accepted / rejected / conflicts.
- Role recommendations do not authorize external actions, destructive actions, scope expansion, or secret access.

## 8. Provider Selection

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

- Prefer current-tool subagent for L2 work unless it is narrow, local, and already well understood.
- Prefer current-tool subagent for L1 work touching 3+ files, shared helpers, public docs/protocols, runtime policy/spec/commands/templates, unfamiliar modules, weak tests, consistency-sensitive multi-file changes, non-trivial UI/design/QA review, or broad completion review.
- If a preference trigger applies and no subagent is used, keep provider stance as `preferred` and record `Subagent skipped: <why inline handling is sufficient>`.
- Forced Provider Gate has higher priority. If a forced provider is unavailable, record the provider outcome as `unavailable` and any remaining provider `gap`.

## 9. Escalation / De-escalation

Escalate when:

- L0/L1 discovers cross-module scope, uncertainty, architecture impact, or higher risk -> L2.
- L2 discovers security, permissions, release, data migration, CI/CD, or destructive-operation risk -> L3.
- End-to-end mechanism understanding is needed -> pause execution, enter research, return to plan after conclusions stabilize.
- Escalation must be user-visible, for example `CatPaw dispatch changed: L1 -> L2`, with the trigger.

De-escalate when:

- Research confirms the work is a clear small change -> L1/L0.
- An L2 plan reveals a small implementation scope -> execute as L1 while preserving useful existing artifacts.
- Existing CatPaw artifacts are not deleted just because the level de-escalated; archive or clean them based on value.
- De-escalation must also be user-visible.

## 10. Completion

When a task completes:

- Run closeout reasoning first; for L2/L3 prefer `catpaw:close <REQ-ID> --dry-run` to preview changes.
- Remove active entries from `.catpaw/index.md`.
- Mark req frontmatter `status: done` and update `updated` / `closed`.
- Do not add completed reqs back into `.catpaw/index.md`; keep the index active-only.
- Plans:
  - archive plans with architecture, decision, or reuse value under `plans/archive/`;
  - delete purely procedural plans with no durable value.
- Tests / reviews:
  - keep artifacts with evidence or reuse value;
  - delete purely procedural content when appropriate.
- Lessons:
  - write only when there is a reusable correction.
- Links and status:
  - if a plan moves from `active/` to `archive/`, update review / tests / req links;
  - after close, scan stale language such as `pending`, `future`, `in progress`, `plans/active`, `status: active`;
  - report uncertainty instead of silently rewriting substantive content.

## 11. Reporting

Final reports should include:

- what changed;
- verification results;
- remaining risks or open items;
- key CatPaw artifact links when artifacts were used;
- next recommended action; if none, say `Next: none` and the current waiting state.

Do not turn internal activity logs into user reports. Reports serve user
decisions; CatPaw files serve cross-session continuity.

For CatPaw-routed L1/L2/L3 work, provide progress handoff after each
user-visible checkpoint and in the final response:

```text
Completed:
Updated artifacts:
Verification:
Next:
Needs user decision:
```

If a plan exists, update plan step / verification / risk ledger before the
handoff. The handoff should say what the agent will do next or what decision it
is waiting for.

`Next` and `Needs user decision` are required fields for L1/L2/L3 handoff
self-checks. If no user decision is needed, say so explicitly. L0 may remain a
single concise completion note unless it escalates, touches CatPaw artifacts, or
needs a user decision.

## 11. Status / Doctor / Reconcile

When the user asks for progress, next action, or CatPaw consistency:

- Use `catpaw:status` for a user-readable summary.
- Use `catpaw:doctor` for read-only graph health checks.
- Use `catpaw:reconcile --dry-run` to preview low-risk derived fixes.
- Use `--apply` only when explicitly requested or required by the current task.

`status` output shape:

```text
Dispatch:
Current status:
Progress:
Changed artifacts:
Verification:
Blocked by:
Next recommended action:
Needs user decision:
```

`doctor` groups findings by req ID; findings without a req ID go under `global`.

`reconcile` may fix derived state only:

- index active entries;
- plan active/archive links;
- lightweight `Status:` fields.

It must not fabricate verification evidence or mark reqs done. Closing a req is
`catpaw:close`.
