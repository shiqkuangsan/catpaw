# ADR-0029: Method Density Without Concept Growth

Status: Accepted

## Context

CatPaw 3.4 exposes only `Work / Proof / Approval`, the visible flow
`Understand -> Execute -> Check -> Finish`, and the `explore / build / check`
Agent intents. External engineering-skill reviews identified useful methods for
clarifying decisions, tightening diagnosis, separating review concerns, staging
wide refactors, carrying context, and writing instructions for Agents.

Copying those skills as new CatPaw entry points would recreate router concepts,
tracker states, artifacts, mandatory questioning, automatic concurrency, and Git
assumptions that conflict with CatPaw's concept and authority boundaries. Merely
adding more prose would also increase cognitive load and duplicate authority.

## Decision

CatPaw absorbs the methods inside existing runtime authorities:

- Understand resolves every discoverable source-backed fact itself and asks only
  material user decisions or blocking facts that only the user can provide at the
  current decision frontier. Readiness applies to the first delivery slice, so
  contingent or non-blocking unknowns may remain deferred.
- Debugging starts with an exact red-capable feedback loop, minimizes to
  load-bearing inputs, uses ranked falsifiable hypotheses when the search space
  is broad, redacts captured state, cleans tagged instrumentation, and records a
  missing test seam as an architecture finding. Causal fixes and mitigations are
  named separately.
- Check evaluates both the delivery contract and engineering quality. Separate
  actors or contexts are optional and justified by independence or information
  gain; the primary agent verifies, deduplicates, prioritizes, and reaches a
  fixed point or records gaps.
- Execute normally prefers a thin vertical slice. A cross-cutting compatibility
  change may instead use `expand -> migrate bounded batches -> contract`.
- A prototype answers one material question. Its answer may be retained, but its
  code is not automatically adopted.
- Phase boundaries choose among continuing, discarding, portable handoff,
  bounded delegation, or compaction. Stable context is referenced through
  canonical pointers rather than copied wholesale.

Maintainer instructions keep the common path inline, place branch-specific
detail behind trigger-bearing pointers, use observable completion criteria and
real sources of truth, and remove duplicate authority, historical sediment, and
no-op instructions.

These are internal methods. They add no user concept, artifact, board field, CLI
command, persisted decision tree, mandatory Agent call, Git authority, or
Approval source.

## Consequences

- CatPaw gains higher method density without expanding the user's operating
  model or project-board schema.
- The runtime can ask fewer, better-timed questions and distinguish repair from
  mitigation without pretending uncertain causality is complete.
- Guidance becomes more testable, but Markdown contract tests still prove
  wording and authority alignment rather than real-world Agent compliance.
- Maintainers must prefer replacement and canonical pointers over additive
  prose; method growth that does not change action or Proof should be rejected.

## References

- [`runtime-policy.md`](../../src/runtime/runtime-policy.md)
- [`workflow.md`](../../src/runtime/guidance/workflow.md)
- [`engineering-methods.md`](../../src/runtime/guidance/engineering-methods.md)
- [`agent-dispatch.md`](../../src/runtime/guidance/agent-dispatch.md)
- [ADR-0026](0026-user-facing-concept-consolidation.md)
- [ADR-0028](0028-structured-understand-without-new-concepts.md)
- External design input: [`mattpocock/skills` at `6654f6b`](https://github.com/mattpocock/skills/tree/6654f6b)
