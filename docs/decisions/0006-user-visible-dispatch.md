# ADR-0006: User-visible Workflow Dispatch

Status: Accepted; mode vocabulary amended by ADR-0019 and public progress language superseded by ADR-0026

## Current Interpretation

The retained principle is visible escalation: when handling becomes durable or
high risk, explain the reason, expected Work/Proof, current action, and `Next`
without exposing private reasoning. ADR-0019 keeps `Direct`, `Tracked`, and
`Gated` as internal routing metadata; ADR-0026 replaces workflow-level
onboarding with Work / Proof / Approval and `Understand -> Execute -> Check ->
Finish`. Routing visibility is not an Approval gate.

## Context

CatPaw classifies work into workflow levels before execution. If agents apply that routing silently, users see process, artifacts, or gates without seeing why the task weight changed.

## Decision

Whenever CatPaw routes a task, the agent briefly states the selected level, reason, artifact expectation, verification/review expectation, and next action. Scope escalation or de-escalation must also be visible.

The note exposes the routing decision, not private reasoning.

## Consequences

- Users can see why work is lightweight, structured, or release-grade.
- Artifacts and gates become predictable instead of surprising.
- L0 remains cheap: one compact sentence is enough.
- Dispatch is not itself an approval gate; normal user gates still control risky actions.

## References

- `src/runtime/runtime-policy.md`
- `src/runtime/commands/classify.md`
- `src/runtime/specs/02-workflow-levels.md`
- `src/runtime/specs/08-operating-rules.md`
