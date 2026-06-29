# 05. Templates

> Status: draft · Last updated: 2026-05-22

This spec defines CatPaw artifact template rules. Instantiable templates live in
`templates/*.md`; this spec keeps only field constraints, activation rules, and
invariants so prose and templates do not drift.

## 1. Template Files

| Artifact | Canonical template | Notes |
|---|---|---|
| Milestone | `templates/milestone.md` | Optional phase artifact for multi-FR L2/L3 objectives. |
| Req | `templates/req.md` | Base req; BUG / CHORE extensions remain as template comments. |
| Plan | `templates/plan.md` | Base L2 plan; L3 extensions remain as comments. |
| Provider dialogue | `templates/provider-dialogue.md` | Durable multi-round provider discussions with decision value. |
| Review summary | `templates/review-summary.md` | Review entrypoint; role files are created only when useful. |
| Test matrix | `templates/test-matrix.md` | L3 or reusable/high-risk verification matrix. |
| Lessons | `templates/lesson.md` | Short corrective lessons, not full retrospectives. |

## 2. Milestone Rules

Milestones are optional phase artifacts. They group related reqs; they do not
replace reqs and are not a new workflow level.

Milestone frontmatter:

| Field | Required | Values | Notes |
|---|---:|---|---|
| `id` | yes | `MS-001` | Keep aligned with filename and H1. |
| `status` | yes | `draft` / `active` / `blocked` / `done` / `cancelled` | Reuse normal artifact status vocabulary. |
| `created` | yes | `YYYY-MM-DD` | Creation date. |
| `updated` | yes | `YYYY-MM-DD` | Last meaningful status or content update. |
| `closed` | yes | `YYYY-MM-DD` / `null` | Use `null` for non-terminal milestones. |
| `target` | yes | short text / `null` | Optional phase target or release boundary. |

Membership belongs in the body `Scope` table, not in req frontmatter, to avoid
two sources of truth.

## 3. Req Rules

Req frontmatter:

| Field | Required | Values | Notes |
|---|---:|---|---|
| `id` | yes | `FR-001` / `BUG-001` / `CHORE-001` | Primary ID; keep aligned with filename and H1. |
| `type` | yes | `feature` / `bug` / `chore` | Lowercase. |
| `status` | yes | `draft` / `active` / `blocked` / `done` / `cancelled` | Lifecycle state. |
| `level` | yes | `L0` / `L1` / `L2` / `L3` | CatPaw workflow level; L0/L1 reqs are allowed when explicitly recorded. |
| `priority` | yes | `P0` / `P1` / `P2` / `P3` / `null` | Use `null` when priority is unset. |
| `created` | yes | `YYYY-MM-DD` | Creation date. |
| `updated` | yes | `YYYY-MM-DD` | Last meaningful status or content update. |
| `closed` | yes | `YYYY-MM-DD` / `null` | Use `null` for non-terminal states; set close date for done/cancelled. |

Req body must keep:

- Background / Goal / Non-goals.
- Checkbox-style Acceptance Criteria.
- Links to related plan, tests, research, and reviews.
- For `type: bug`: Symptoms, Expected, Actual, Suspected Cause.
- For `type: chore`: Scope, Constraints.

## 4. Plan Rules

One plan template serves both L2 and L3:

- L2 uses the base sections in `templates/plan.md`.
- Behavior-sensitive L2/L3 work must fill `Contracts / Invariants`, boundary verification, and `Risk Ledger` before implementation.
- If L2 uses Expert Council, `Notes.Roles` records stage-primary roles, add-on roles, and provider stance; `Notes.Review` records summary/link.
- If L2 does not use Expert Council, write `Review: not required`.
- L3 must activate the commented `Risk Gates` and `Council` extension sections.
- L3 review details go under `reviews/`; detailed test matrix goes under `tests/`.
- Durable multi-round provider discussions may use `templates/provider-dialogue.md` under `.catpaw/research/<topic>/provider-dialogue.md`.

Allowed `Risk Ledger` status values:

```text
fixed | mitigated | deferred | not addressed
```

Do not present mitigation as correctness.

## 5. Artifact Graph Metadata

Plan, review, and test matrix artifacts should carry lightweight frontmatter so
`doctor`, `reconcile`, and `close` can validate the artifact graph.

| Field | Applies to | Required | Notes |
|---|---|---:|---|
| `id` | plan / test matrix | yes | Artifact ID such as plan slug `FR-001-title` or test ID `T-001`; review summary may omit it. |
| `req` | plan / review / test matrix | yes | Bound req ID, for example `FR-001`. |
| `plan` | review / test matrix | yes | Bound plan slug or ID. |
| `status` | plan / review / test matrix | yes | `draft` / `active` / `blocked` / `done` / `cancelled`. |
| `mode` | review summary | yes | `light` / `formal`. |
| `updated` | plan / review / test matrix | yes | Last meaningful status or content update. |
| `closed` | plan / review / test matrix | yes | `null` for non-terminal artifacts; close date for terminal artifacts. |

## 6. Review Rules

- `summary.md` is always the review entrypoint.
- Formal review writes `.catpaw/reviews/<req-id>-<slug>/summary.md`.
- Role files are optional; write them only when they contain durable evidence, disagreements, or reusable decisions.
- Multi-provider findings belong in the summary or role files; do not create provider-specific files by default.
- Rejected findings remain in `summary.md`; L3 requires them, L2 may omit the section when there are none.
- Behavior-sensitive review summaries must include contract / semantic checks and the risk ledger.

Recommended review directory:

```text
.catpaw/reviews/<req-id>-<slug>/
├── summary.md
├── engineering.md      # optional
├── architecture.md     # optional
├── qa.md               # optional
├── security.md         # optional
└── release.md          # optional
```

## 7. Test Matrix Rules

A test matrix is risk-focused verification, not a full QA plan.

- L3 must create `.catpaw/tests/matrices/<req-id>-<slug>.md`.
- L2 creates a standalone matrix only when verification is complex, reusable, multi-environment, multi-platform, multi-role, high-regression-risk, or explicitly requested.
- Behavior-sensitive L2/L3 verification must cover `Contract` and `Boundary case`; this may live in the matrix or in plan `Verification`.
- L3 must decide whether `Failure mode` and `Rollback` apply; if not, write `not applicable`.
- CI/CD, deploy, migration, and release L3 work must cover rollback / failure modes.
- Security / permission L3 work must cover security / permission areas.
- Multi-platform work must cover cross-platform areas.
- Evidence should summarize commands/manual checks and durable links or artifact paths. Do not paste large logs.

## 8. Lessons Rules

`lessons.md` stores short corrective lessons:

- `Active Lessons` records one-off corrections.
- `Promotion Candidates` records repeated lessons worth considering as project/global rules.
- `Promoted` keeps a short index of promoted rules.
- Promotion evidence needs at least two concise entries.
- Full retrospectives belong in `research/` or `reviews/`, not `lessons.md`.
