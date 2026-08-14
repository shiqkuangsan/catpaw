# ADR-0025: Executor-Owned Advisory Orchestration

Status: Accepted; Role Catalog and vocabulary superseded by ADR-0026, CLI facade amended by ADR-0027

Date: 2026-08-13

## Current Interpretation

The accepted core is contextual orchestration by the primary agent, advisory
collaboration patterns, one accountable writer per mutable surface, distinct-
actor independent checking, and primary-agent final adoption. ADR-0026 removed
the six-Role Catalog before release and replaced it with exactly three task
intents: `explore`, `build`, and `check`. Current read-only discovery uses
`intent list` and `intent show --intent <id>` under ADR-0027; the older
`agent intents|intent` forms remain compatible.

The Role Catalog, six Role names, `agent roles`, and `agent role --role <id>` in
the original decision below are historical design state, not current Runtime
commands or concepts. Task Envelopes, ownership tokens, scheduling signals, and
Git grants remain internal implementation contracts and cannot create Approval.

## Context

CatPaw 3.2 introduced bounded Task Envelopes and four temporary capabilities.
Its dispatch guidance also selected minimum calls, mapped lifecycle stages to
roles, prescribed serial fallback, and limited each call to one capability.
Those defaults were useful for weaker executors, but they now make CatPaw own
contextual team decisions that a capable Agent Executor can make better.

Removing dispatch guidance entirely would move CatPaw too far in the opposite
direction. A prose-only list of prompts would not give executors a stable way
to discover responsibilities, compose teams, reason about handoffs, or retain
the proven authority, independence, isolation, and completion contracts.

## Decision

### Make the Agent Executor the orchestration decision owner

CatPaw provides structured roles, collaboration patterns, scheduling signals,
hazards, and deterministic discovery. The Agent Executor chooses the Agents,
models, transports, role composition, count, order, parallelism, fallback, and
final adoption for the current task.

CatPaw does not generate or execute a mandatory team graph. Its advice may be
accepted, adapted, or rejected by the Executor. The Executor's choice cannot
expand user/project authorization or weaken a hard runtime contract.

### Keep three distinct responsibility layers

1. **Hard runtime contracts** own authority ceilings, mutable-surface
   isolation, required independence, Evidence meaning, delivery/adoption, and
   deterministic state.
2. **Advisory orchestration** supplies Role Catalog entries, collaboration
   patterns, cost/risk signals, concurrency hazards, and fallback options.
3. **Executor decisions** own contextual team formation, scheduling, transport
   and model selection, and final adoption.

An explicit integration owner remains accountable for reconciliation, final
verification, and a clean handoff. This is a responsibility token selected by
the Executor, not a permanent persona or a second decision owner. An Integrator
may prepare an integration candidate, but only the Executor decides adoption.
If the Executor retains integration ownership, it keeps the task-local Git
authority defined by runtime policy. A delegated integration owner gains no Git
authority from that token. Candidate or reconciliation commits require the
Builder Role and a complete Builder Git Envelope. Exact clean inbound adoption,
after the Executor's decision, requires an Integration Git Envelope bound to the
assigned non-protected surface, target/base, commit list, allowed
fast-forward/cherry-pick, and verification.

### Historical Role Catalog decision

At the time of this decision, the proposed runtime shipped a machine-readable
catalog with six core roles:

- **Scout** collects source-backed facts, options, dependencies, and unknowns.
- **Architect** designs boundaries, interfaces, alternatives, and trade-offs.
- **Builder** implements a bounded scope and performs relevant local checks.
- **Reviewer** performs adversarial review and reports reproducible findings.
- **Verifier** independently proves acceptance and records remaining gaps.
- **Integrator** composes isolated outputs and prepares a reconciled candidate.

Roles are responsibility contracts, not identities. One Agent may carry
multiple roles, and several Agents may instantiate the same role. A required
Independent Check still needs a distinct actor from the Builder whose work is
being checked. Domain concerns remain Lens/specialization inputs instead of an
unbounded tree of Frontend, Backend, Security, or provider personas.

Each catalog entry defines intent, use/avoid signals, required inputs,
deliverables, Evidence obligations, default side effects, authority ceiling,
independence eligibility, concurrency profile, handoff edges, stop conditions,
compatible Lenses, and anti-patterns. It does not select a model, provider,
Agent count, parallelism, complete prompt, or execution graph.

### Replace scheduling rules with advisory patterns

CatPaw documents parallel reconnaissance, competing proposals, isolated build
slices, competing implementations, Builder-to-Reviewer/Verifier checks,
reciprocal critique, and isolated fan-in integration. These are options for the
Executor, not minimum or maximum call rules.

The hard concurrency boundary is no concurrent write to one shared mutable
surface. Agents may work on the same logical files when each has an isolated
worktree or equivalent state surface. Dependency order, integration overhead,
and expected information gain are scheduling signals rather than automatic
serial gates.

### Bound authority without choosing commit cadence

An opted-in current-tool Builder may create a bounded series of local commits
inside one validated isolated worktree and dedicated non-protected branch. The
Task Envelope binds exact scope, branch/base, allowed Git actions, verification,
diff review, credential scan, and handoff. The Executor chooses useful commit
cadence within that envelope.

This does not grant integration ownership. Push, PR, protected/base updates,
remote Git, history rewrite, force, destructive cleanup, secrets, and permission
expansion remain explicit gates. Reviewers, Verifiers, Scouts, non-opted-in
Agents, and current CatPaw-managed cc/cx profiles remain unable to commit.

### Historical read-only discovery surface

At the time of this decision, the CLI exposed the catalog through `agent roles`
and `agent role --role <id>` in human and JSON forms. ADR-0026 replaced those
commands with intent discovery before 3.4 activation. Neither design adds
`agent plan`, `agent team`, `run-all`, automatic adoption, or a persistent
invocation ledger. Provider availability reports may expose ordered fallback
options and identify the primary agent as the decision owner while retaining
the previous scalar fallback for compatibility.

Board schema remains 2. Transient team, role assignment, scheduling, slot, and
dependency-graph state do not become Work or Evidence metadata.

## Consequences

- CatPaw remains an orchestration runtime instead of shrinking to a prompt
  bundle, while stronger Executors retain contextual control.
- Structured intent discovery is deterministic and testable without making the
  CLI a scheduler.
- Three intents retain the useful behavioral contracts without reviving the
  six-Role or specialist persona hierarchy.
- Isolation and Independent Check gates remain enforceable even when the
  Executor chooses aggressive parallelism or competing implementations.
- Builder handoffs can use natural local commit series without transferring
  adoption, protected integration, or external authority.
- Existing schema 2 boards require no migration. Source build, runtime
  activation, adapter refresh, registry updates, and fleet refresh remain
  separate operations.

## Amendments

- ADR-0019's contextual `Agent` decision owner is clarified as the Agent
  Executor.
- ADR-0022's single Primary integration owner becomes one accountable owner per
  mutable integration surface, explicitly selected by the Executor; its local
  Git safety gates remain.
- ADR-0023's temporary capabilities become composable catalog roles; its fixed
  minimum-call and serial/parallel selection rules are replaced by advisory
  scheduling signals.
- ADR-0024's one-commit limit becomes an Executor-chosen bounded local commit
  series; all authority ceilings and isolation requirements remain.
- ADR-0026 replaces the unreleased Role Catalog and its CLI with three intent
  contracts, while retaining contextual orchestration and every hard bound.

## References

- [Current Intent Catalog](../../src/runtime/catalog/intents.json)
- [Agent orchestration](../../src/runtime/guidance/agent-dispatch.md)
- [Runtime policy](../../src/runtime/runtime-policy.md)
- [Workflow](../../src/runtime/guidance/workflow.md)
- [Independent Checks](../../src/runtime/guidance/independent-checks.md)
- [ADR-0019](0019-catpaw-3-hybrid-runtime.md)
- [ADR-0023](0023-task-envelopes-and-risk-based-agent-dispatch.md)
- [ADR-0024](0024-bounded-builder-slice-commits.md)
- [ADR-0026 amendment](0026-user-facing-concept-consolidation.md)
