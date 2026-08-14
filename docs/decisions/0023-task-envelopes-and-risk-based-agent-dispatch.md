# ADR-0023: Task Envelopes And Risk-based Agent Dispatch

Status: Accepted; orchestration ownership amended by ADR-0025, and capability/Role vocabulary superseded by ADR-0026

Date: 2026-08-13

## Current Interpretation

The bounded delegation fields, useful-separation test, one-writer isolation,
and distinct-actor independent check remain current internal contracts. The
temporary capabilities and later Role Catalog are historical vocabulary under
ADR-0026:
investigation/design now use `explore`, implementation/integration use `build`,
and review/verification use `check`. The primary agent owns contextual team
formation and final adoption. Modes, Task Envelope fields, Lens selection, and
typed Evidence remain internal mechanics behind Work / Proof / Approval.

## Context

CatPaw 3 separated Agent, Lens, and Independent Check, but dispatch behavior was
split across workflow, check, and provider documents. It did not define a
compact handoff contract or answer when several capable subagents should run in
parallel. Reintroducing permanent specialist personas would increase routing
cost, duplicate lifecycle ownership, and make capability look like authority.

CatPaw needs enough structure to exploit stronger models without turning every
task into a multi-Agent ceremony or allowing concurrent writers to share Git
integration ownership.

## Decision

### Add one dispatch authority

`guidance/agent-dispatch.md` is the canonical owner for Agent capability, Task
Envelope, risk triggers, and serial/parallel choice. Workflow owns lifecycle and
Mode; Independent Checks own required non-primary judgment and Evidence;
providers own cc/cx transport and observable sessions.

### Use temporary capabilities

Each delegated call selects one temporary capability rather than assigning a
persistent identity:

- **Scout** finds facts, options, dependencies, and unknowns during Think/Plan.
- **Builder** implements one bounded, exclusive write slice.
- **Reviewer** performs adversarial non-primary review.
- **Verifier** independently reproduces acceptance or failure paths.

A Lens remains a professional perspective and can be combined with any
capability. Transport remains an invocation mechanism. Neither changes
authority.

### Require a bounded Task Envelope

Every call receives objective, capability, facts, exact read/write scope,
constraints, deliverable, verification, dependencies, budget, stop condition,
and authority. The Envelope is a prompt/runtime contract, not durable project
state. It can narrow existing authority but cannot expand it.

### Dispatch by risk and useful separation

Direct work stays inline by default. Tracked work delegates only material
unknowns, independent bounded slices, or useful non-primary judgment. Gated work
requires an independent Reviewer or Verifier; Builder remains optional.

Parallel execution requires independent objectives, no shared mutable files or
state, no ordering dependency, and separately usable or composable outputs.
When any condition fails, execution is serial. Available capacity alone is not
a dispatch reason.

### Keep one integration owner

The primary integration owner alone adopts output, resolves conflicts, performs
final verification, and owns any authorized stage/commit. Builder subagents and
external Agents never inherit Git integration authority. A required Reviewer or
Verifier must be non-primary and cannot be the same Builder checking its own
slice.

## Historical Amendment By ADR-0025

The fixed Primary-owned dispatch language above is retained as decision history.
The current contract gives the Agent Executor contextual ownership of Agent,
model, transport, Role composition, topology, fallback, integration ownership,
and final adoption. Temporary capabilities are now published as a composable
Role Catalog. Scheduling rules are advisory; the hard concurrency boundary is
no concurrent write to one shared mutable surface. See ADR-0025 and the current
Agent Orchestration guidance.

## Amendment By ADR-0026

ADR-0026 replaced the Role Catalog and fixed capability labels with exactly
three composable task intents. The Envelope remains an internal bounded grant;
an intent never becomes identity, topology, or Approval. Current discovery uses
`agent intents` and `agent intent --intent <id>`.

## Consequences

- Strong models can receive compact, outcome-specific context without a fixed
  hierarchy or repeated persona material.
- Parallel work is available where it saves time but defaults to serial when
  mutable ownership or dependencies overlap.
- Dispatch decisions remain inspectable without an invocation ledger.
- No new board artifact or schema is introduced; existing schema 2 boards and
  thin CatPaw 3.1 adapters need no migration.
- Agent output, Task Envelopes, Lens findings, and Evidence remain facts, not
  authorization.

## References

- [Agent Dispatch](../../src/runtime/guidance/agent-dispatch.md)
- [Workflow](../../src/runtime/guidance/workflow.md)
- [Independent Checks](../../src/runtime/guidance/independent-checks.md)
- [Agent transports](../../src/runtime/providers/README.md)
- [ADR-0019](0019-catpaw-3-hybrid-runtime.md)
- [ADR-0022](0022-tiered-local-git-authority-and-engineering-methods.md)
- [ADR-0025](0025-executor-owned-advisory-orchestration.md)
- [ADR-0026](0026-user-facing-concept-consolidation.md)
