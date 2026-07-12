# ADR-0011: Provider CLI Dialogue

Status: Superseded by ADR-0019

## Context

CatPaw separates Expert Council roles from providers, but needed a generic way for the primary agent to ask, debate, debug, review, or delegate implementation with other provider CLIs.

Review is only one case; architecture discussion and debugging hypotheses also need bounded multi-round exchanges.

## Decision

Add `catpaw:provider` as the generic provider orchestration command.

The primary agent remains orchestrator: it chooses mode/provider, sends bounded prompts, reads output, classifies findings, decides whether to continue, and owns the final decision. Provider-native session resume can help, but CatPaw-mediated transcript state is the source of truth when dialogue must be durable.

## Consequences

- `catpaw:review` can stay focused on review semantics.
- Provider CLI details live in one command runbook.
- Providers can advise or implement within explicit bounds, but cannot authorize commit, push, PR, deploy, destructive action, or silent scope expansion.
- Durable dialogues can be recorded as research notes rather than provider-specific artifact trees.

## References

- `src/runtime/commands/provider.md`
- `src/runtime/commands/review.md`
- `src/runtime/specs/09-roles.md`
- `src/runtime/templates/provider-dialogue.md`
