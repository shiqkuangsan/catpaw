# 06. Subsystems

> Status: draft · Last updated: 2026-05-25

CatPaw uses L0/L1/L2/L3 only at the task orchestration layer. Subsystems do not
copy that level matrix; they inherit minimum requirements from the task level.

## 1. Level Mapping

Decisions:

- Only task orchestration uses L0/L1/L2/L3.
- Review uses `none / light / formal`.
- Tests use `inline verification / verification record / test matrix`.
- Lessons use `lesson / promotion candidate / rule`.
- Status Sync uses `read-only status / artifact sync / closeout transaction`.
- Artifact Integrity uses `doctor / reconcile / close`.
- Subsystems inherit minimum requirements from the workflow level but do not form independent level matrices.

## 2. Reviews

Review states:

```text
none / light / formal
```

Rules:

- `none`: no Expert Council, no `reviews/`.
- `light`: usually inline report; write `reviews/<req-id>-<slug>/summary.md` only when risk judgment or reusable evidence should persist.
- `formal`: must write `summary.md`; write role files only when useful. L3 requires formal review.
- L2 defaults to light; if no Expert Council is used, it may be none.
- L3 requires formal review.
- Role selection follows lifecycle role orchestration: choose by active stage first, then add risk-specific reviewers.
- Rejected findings are optional for L2 and required for L3.
- Behavior-sensitive review must include contract / semantic checks: confirm that optimization, cache, query, fallback, async, or migration changes do not unintentionally change semantics.
- External provider review is a second opinion; the implementer still needs semantic self-review.

## 3. Tests

Test states:

```text
inline verification / verification record / test matrix
```

Rules:

- `inline verification`: L0/L1 default; do not write `.catpaw/tests/`; report verification in the final answer or light plan.
- `verification record`: L2 default; prefer plan `Verification`; do not create `tests/matrices/<req-id>-<slug>.md` by default.
- `test matrix`: L3 required; write `.catpaw/tests/matrices/<req-id>-<slug>.md`.
- L2 creates a standalone matrix only when there are many test paths, manual steps must be reproduced precisely, environments/platforms/roles vary, regression risk is high, or the user asks.
- Test artifacts record how correctness is proven; they are not activity logs.
- QA Strategist is the default test-stage role. Add Security / Performance / Design only when tests must prove those contracts.
- Behavior-sensitive L2/L3 verification must derive tests from contracts and implementation boundaries. At least one high-risk boundary case should cover new branches, thresholds, fallbacks, cache states, pagination cursor/offset, or migration paths.
- Frontend / UI-facing verification should use the strongest available interactive surface before user handoff: repo-native tests, Browser / browser-use / in-app browser, Playwright, Chrome DevTools, or Computer Use. Browser / browser-use is the default for ordinary local web UI, Playwright or Chrome DevTools is preferred for reproducible browser evidence, and Computer Use moves ahead for real-window, OS-dialog, native, cross-app, accessibility-tree, browser-extension, profile/session, or browser-automation-unreachable flows. If blocked, record the selected surface, blocker, and remaining verification gap.

## 4. Lessons

Lesson states:

```text
lesson / promotion candidate / rule
```

Rules:

- `lesson`: a one-off correction, recorded briefly in `.catpaw/lessons.md`.
- `promotion candidate`: same-project repeated lesson after two occurrences; do not auto-promote.
- `rule`: candidate confirmed by the user or implementer and promoted to project `CLAUDE.md`.
- `global rule`: cross-project repeated lesson after two occurrences and confirmation, promoted to `~/.claude/lessons.md`.
- After promotion, keep a short record under `Promoted` showing where it was promoted.
- Lessons record what to avoid next time. Full retrospectives belong in `research/` or `reviews/`.

## 5. Status Sync

Status Sync is an agent-facing progress synchronization mechanism, not a daemon.

States:

```text
read-only status / artifact sync / closeout transaction
```

Rules:

- `dispatch note`: at task start, tell the user CatPaw level, reason, artifact expectation, verification/review expectation, and next step. This is a user-visible contract and does not write files.
- `read-only status`: read `.catpaw/` artifacts and report current status, blockers, and next recommended action without writing files.
- `artifact sync`: after L2/L3 status changes, update lightweight req / plan / index / tests / reviews state.
- `closeout transaction`: scoped close around one req ID; dry-run by default, apply only when appropriate.
- Status Sync supports user decisions. It does not replace verification or authorize external actions.

### Progress Handoff Contract

For CatPaw-routed L1/L2/L3 work, the primary agent must proactively hand off
status at each user-visible checkpoint and in the final response. The checkpoint
is not complete until the handoff self-check includes `Next` and
`Needs user decision`.

User-visible checkpoints include:

- completing a plan step;
- writing or updating req / plan / research / tests / reviews / lessons;
- completing verification;
- completing review;
- discovering a blocker, scope change, or risk;
- preparing to ask for commit / push / PR / deploy / destructive confirmation;
- changing the next action.

Rules:

- L0 stays lightweight; do not require the structured handoff footer for tiny direct work unless the task escalates, touches CatPaw artifacts, or needs a user decision.
- If a CatPaw plan exists, update the relevant step checkbox/status, verification note, or risk ledger before reporting the handoff.
- If no CatPaw artifacts exist, still provide an inline handoff.
- Keep handoffs short; do not write activity logs.
- Always state `Next` and `Needs user decision` explicitly. If no user decision is needed, say so.
- If there is no next action, say `Next: none; ready for closeout`, `ready for commit`, or `waiting for user review`.
- Do not make the user ask after every phase completion.

Recommended shape:

```text
Completed:
Updated artifacts:
Verification:
Next:
Needs user decision:
```

Triggers:

- task start when CatPaw routes the work;
- req / plan creation or update;
- plan step completion;
- blocker, scope change, or risk discovery;
- verification completion;
- review completion;
- closeout;
- before asking for commit / push / PR / deploy / destructive confirmation.

## 6. Artifact Integrity

Artifact Integrity checks `.catpaw/` graph consistency.

Graph root:

```text
req -> plan -> research -> tests -> reviews -> lessons/docs
```

Command semantics:

- `doctor`: read-only health check; reports status/link/pending/stale/index inconsistencies.
- `reconcile`: dry-run by default; fixes only low-risk derived content such as index entries, path drift, and lightweight status fields.
- `close`: dry-run by default; performs a scoped close transaction for one req.

Hard limits:

- Do not mark work done only because checkboxes are complete.
- Do not fabricate verification evidence.
- Do not rewrite the project globally.
- Do not automatically commit, push, create PRs, or deploy.
- `--apply` writes only explicitly listed `.catpaw/` artifact patches.
