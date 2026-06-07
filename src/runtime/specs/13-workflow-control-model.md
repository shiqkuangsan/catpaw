# 13. Workflow Control Model

> Status: draft · Last updated: 2026-06-07

This spec is the canonical decision table for CatPaw workflow control. It does
not replace L0/L1/L2/L3 or lifecycle stages; it explains how they combine with
artifact policy, roles, providers, and verification.

## 1. Control Vocabulary

CatPaw has four related but separate routing concepts:

| Concept | Purpose | Values |
|---|---|---|
| Workflow level | How heavy the workflow should be | `L0`, `L1`, `L2`, `L3` |
| Lifecycle stage | Which work phase is active | `Think`, `Plan`, `Build`, `Review`, `Test`, `Ship`, `Reflect` |
| Workflow state | Where a tracked task sits | `framed`, `planned`, `building`, `reviewing`, `verifying`, `done`, `blocked`, `cancelled` |
| Provider stance | How non-primary help is selected | `inline`, `preferred`, `forced` |

Rules:

- Workflow state is control vocabulary, not a new required frontmatter schema.
- Project artifact frontmatter may continue to use existing `status` values such
  as `draft`, `active`, `done`, and `cancelled`.
- Lifecycle stages are vocabulary, not mandatory pipeline steps.
- Workflow levels remain the first dispatch weight decision.

## 2. State Machine

Tracked L2/L3 work usually moves through this state model:

```text
framed -> planned -> building -> reviewing -> verifying -> done
                         \             \              \
                          -> blocked     -> blocked     -> blocked
framed -> cancelled
planned -> cancelled
building -> cancelled
```

State meanings:

| State | Meaning | Typical artifact |
|---|---|---|
| `framed` | Req is understood enough to track | req |
| `planned` | Implementation approach and verification expectations are recorded | plan |
| `building` | Primary implementation is underway | plan step updates |
| `reviewing` | Role/provider or self-review is underway | plan note or review summary |
| `verifying` | Tests, doctor, runtime checks, or manual evidence are being gathered | plan verification or test matrix |
| `done` | Scope is complete and closeout evidence exists | terminal req + archived/kept evidence |
| `blocked` | Progress needs user input, unavailable provider, missing credentials, or external state | plan / handoff |
| `cancelled` | Work is intentionally stopped | terminal req |

State reporting is lightweight. Agents should report state only when it helps
the user understand next action, handoff, or blocked status.

## 3. Artifact Policy

Artifact creation is risk-based. Use the lightest artifact set that preserves
decision quality and cross-session continuity.

| Level | Default artifacts | Create more when | Avoid |
|---|---|---|---|
| L0 | none | user explicitly asks for durable record | req/plan noise |
| L1 | none by default | 3+ files, shared helpers, public docs/protocols, weak tests, or user wants tracking | procedural artifacts with no reuse value |
| L2 | req + plan + verification record in plan | formal review value, reusable QA evidence, provider disagreement, durable research | default test matrix unless verification is complex |
| L3 | req + plan + test matrix + formal review summary | release/security/migration/incident evidence needs durable records | closing without provider/gate evidence |

Artifact decisions:

| Trigger | Artifact action |
|---|---|
| User asks to discuss or research only | Inline answer or research note; do not implement before approval |
| Behavior-sensitive L2 | Keep contracts, boundary verification, and risk ledger in plan |
| L3 or formal review | Keep review summary with provider evidence or accepted provider gap |
| Multi-round provider dialogue with decision value | Keep research/provider-dialogue note |
| Completion with reusable process lesson | Append lesson; do not create lessons for one-off noise |
| Procedural plan with no future value | Delete only with explicit user acceptance, otherwise archive if useful |

## 4. Canonical Decision Table

| Situation | Level | State target | Artifacts | Roles | Provider stance | Verification |
|---|---|---|---|---|---|---|
| Tiny local fix | L0 | building -> verifying -> done | none | none | inline | inline check |
| Small multi-step local work | L1 | building -> verifying -> done | none by default | none or one inline lens | inline or preferred | inline check |
| Medium-risk docs/protocol/runtime change | L2 | framed -> planned -> building -> verifying -> done | req + plan | Architecture / DX or QA lens | preferred unless narrow | verifier/tests/doctor |
| Behavior-sensitive L2 | L2 | planned -> reviewing -> verifying | req + plan with contracts | Architecture + QA/Engineering | forced non-primary semantic review | boundary tests |
| L3 release/security/migration/external action | L3 | planned -> reviewing -> verifying -> done | req + plan + tests + review | Release plus risk roles | forced | formal review + matrix + release checks |
| Blocked by credentials/provider/external state | Current level | blocked | update plan or handoff | role depends on blocker | gap/unavailable as outcome | record remaining gap |

## 5. Handoff Contract

For CatPaw-routed L1/L2/L3 work, every user-visible checkpoint should answer:

```text
Completed:
Updated artifacts:
Verification:
Next:
Needs user decision:
```

When a tracked plan exists, update the relevant plan step, verification row, or
risk ledger before the handoff.

`Next` must say the concrete next action or `none`. `Needs user decision` must
say `yes` or `no`.

## 6. Closeout Rules

Before marking work done:

- Verify the implemented behavior or document why verification is blocked.
- Resolve or explicitly defer risk ledger items.
- Move terminal plans out of `plans/active/`.
- Remove terminal reqs from `.catpaw/index.md` Active Work.
- Keep durable review/test evidence only when it has decision value.
- Run doctor-style checks for L2/L3 tracked work.

Closing is not just setting `status: done`; it is a scoped artifact graph
transaction with evidence.
