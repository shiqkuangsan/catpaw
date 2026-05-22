# ADR-0006: User-visible Workflow Dispatch

Status: Accepted

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
