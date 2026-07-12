# ADR-0012: Contract-First Quality Gates

Status: Accepted; mode and artifact vocabulary amended by ADR-0019

## Context

Structured plans, reviews, and verification can still miss defects where an implementation optimization silently changes behavior semantics. These risks appear around caches, query rewrites, dirty-state deferral, async lifecycle, pagination, migrations, serialization, and performance fast paths.

The primary workflow should surface the contract before implementation and verification, not rely on external review to discover the contract afterward.

## Decision

Behavior-sensitive L2/L3 work must use a contract-first quality gate. Plans state invariants and boundary tests; reviews check semantic preservation; L3 or standalone verification matrices include contract/boundary rows.

## Consequences

- Optimizations are not treated as safe until semantic equivalence is shown or an intended behavior change is accepted.
- The gate applies to new or materially updated plans/reviews/tests; existing artifacts remain valid.
- L0/L1 and non-behavior-sensitive work stay lightweight.
- External reviewers provide second opinions, not the primary correctness mechanism.

## References

- `src/runtime/runtime-policy.md`
- `src/runtime/specs/08-operating-rules.md`
- `src/runtime/templates/plan.md`
- `src/runtime/templates/review-summary.md`
- `src/runtime/templates/test-matrix.md`
