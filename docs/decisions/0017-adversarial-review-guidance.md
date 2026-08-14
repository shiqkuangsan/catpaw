# ADR-0017: Adversarial Review Guidance

Status: Accepted; integrated into ADR-0019 Independent Checks, amended by ADR-0022, and intent/Proof vocabulary by ADR-0026

## Current Interpretation

Adversarial review remains an optional `check` method selected when risk makes
opposing-side challenge useful. ADR-0019 removed the Expert Council, legacy
commands, and role paths below; ADR-0022 kept the method trigger-based rather
than universal; ADR-0026 expresses its findings as Proof and requires a distinct
actor when the check is independent. Current behavior lives in Agent
collaboration and independent-Proof guidance.

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
- Agents and Lens output remain advisory evidence only and do not expand
  authority. Bounded local Git belongs to the primary under ADR-0022; remote,
  destructive, history-changing, and scope-changing actions remain gated.

## References

- `src/runtime/commands/review.md`
- `src/runtime/commands/provider.md`
- `src/runtime/commands/plan.md`
- `src/runtime/templates/review-summary.md`
- `src/runtime/roles/qa-strategist.md`
