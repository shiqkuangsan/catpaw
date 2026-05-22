# ADR-0013: Lifecycle Role Orchestration

Status: Accepted
Date: 2026-05-16

## Context

CatPaw had lifecycle vocabulary, an Expert Council role catalog, and provider orchestration, but role selection was still too implicit. Agents could know the role names without knowing when a role should participate, how many roles are reasonable, or where the result belongs.

## Decision

Use lifecycle role orchestration:

```text
stage -> stage-primary role -> risk add-on roles -> provider stance -> artifact location
```

Roles remain provider-agnostic. The primary agent may handle a role inline, use a current-tool subagent, ask Laoer / 老二 / second opinion, ask Laosan / 老三 / third opinion, or call a future provider through `catpaw:provider` when outside judgment materially helps.

The runtime rule is summarized here, with specs and commands remaining authoritative: L0/L1 use no Expert Council by default; L2 usually uses one stage-primary role plus at most one risk role; L3 declares intended roles in the plan and preserves disagreements in formal review.

## Consequences

- Dispatch and plans can name role stance instead of leaving role choice implicit.
- Reviews choose roles by lifecycle stage first, then risk trigger.
- Provider calls remain advisory and bounded by CatPaw gates.
- This changes orchestration guidance only; no project artifact migration is required.

## References

- `src/runtime/runtime-policy.md`
- `src/runtime/specs/09-roles.md`
- `src/runtime/specs/08-operating-rules.md`
- `src/runtime/commands/classify.md`
- `src/runtime/commands/plan.md`
- `src/runtime/commands/review.md`
