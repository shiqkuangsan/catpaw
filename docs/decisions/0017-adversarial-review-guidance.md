# ADR-0017: Adversarial Review Guidance

Status: Accepted

## Context

CatPaw already has Contract-First Quality Gates, Expert Council roles, and
provider/subagent routing. Those mechanisms improve review discipline, but they
can still be interpreted as cooperative validation: confirm the plan, confirm
the diff, confirm the tests.

The useful methodology to absorb is narrower than a prompt phrase. It is a
phase shift: before handoff, the agent should deliberately challenge the
solution from the opposing side when risk justifies it.

## Decision

Add `adversarial` as a review mode and lightweight lens. It asks reviewers to
look for false assumptions, simpler alternatives, hostile or weird inputs,
boundary states, and missing evidence.

Keep root-problem framing as a planning reminder for complex bugs,
architecture choices, and behavior-sensitive work. Do not add a standalone
first-principles command or universal template field.

Adversarial review may trigger current-tool subagent or other provider routing
through the existing Subagent Preference Gate or Forced Provider Gate. It does
not authorize multi-provider fan-out by default.

## Consequences

- Review guidance becomes more capable of finding production risks before
  completion.
- CatPaw avoids turning a useful method into a prompt-pack ritual.
- L0/L1 work remains light unless normal risk triggers escalate it.
- Providers and roles remain advisory evidence only; they still do not
  authorize commits, pushes, PRs, deploys, destructive actions, or scope
  expansion.

## References

- `src/runtime/commands/review.md`
- `src/runtime/commands/provider.md`
- `src/runtime/commands/plan.md`
- `src/runtime/templates/review-summary.md`
- `src/runtime/roles/qa-strategist.md`
