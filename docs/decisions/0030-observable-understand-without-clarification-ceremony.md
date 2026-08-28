# ADR-0030: Observable Understand Without Clarification Ceremony

Status: Accepted

Date: 2026-08-29

## Context

ADR-0028 added optional structure for complex Work. ADR-0029 absorbed external
decision-clarification methods into CatPaw without adding public concepts. The
result protected the concept budget, but its daily behavior remained easy to
miss: the strongest rules lived under an optional complex-Work trigger, the
always-on policy did not define an observable readback, and wording tests could
prove presence but not Agent compliance.

Small requests can still contain material ambiguity. A short request about
"cleanup", "support", "activation", or "proceed" may leave outcome, scope,
acceptance, authority, or reversibility unclear even when no scope tree is
needed. Treating such Work as automatically clear allows execution to drift.
Turning every request into a mandatory interview would create the opposite
failure.

## Decision

Make a lightweight Understand readiness pass an always-on behavior for every
Work, including small Work:

- Material ambiguity is ambiguity that could change the outcome, scope or
  non-goals, acceptance or required Proof, data or permission boundary, or an
  external or irreversible choice.
- The primary agent resolves discoverable source-backed facts itself. It asks
  the user only for material decisions or blocking facts only the user can
  provide.
- Clear Work remains low-ceremony and proceeds. A one-sentence outcome or
  first-slice readback is used only when it prevents drift.
- Material ambiguity produces a compact visible readback before Execute:
  current understanding, relevant verified facts or explicit assumptions, only
  the current decision-frontier questions, why their answers affect delivery,
  and the first slice they unblock. Independent blockers are grouped;
  contingent and non-blocking questions are deferred.
- When the user delegates a material judgment, the primary agent selects and
  states a reversible default within the authorized scope and continues. That
  delegation does not grant scope growth, external effects, irreversibility,
  permission expansion, or acceptance of a required Proof gap.

The scope tree, dependency edges, and `Confirmed | Proposed | Open` annotations
remain optional structure for complex Work. The visible readback has no required
headings and creates no Clarify stage, artifact, schema field, CLI command, or
new Approval source.

## Consequences

- Users can observe when CatPaw has found a delivery-changing ambiguity without
  being interviewed on already discoverable facts.
- Small but ambiguous Work no longer bypasses decision-frontier handling merely
  because its request is short.
- Clear and reversible Work retains the existing direct path.
- The always-on policy is more likely to affect daily host behavior than detail
  reachable only through complex-Work guidance.
- Contract scenarios protect the intended prompt behavior, but cannot prove
  that every host or model complies. Real-world observation remains necessary.

## References

- [Runtime policy](../../src/runtime/runtime-policy.md)
- [Workflow](../../src/runtime/guidance/workflow.md)
- [ADR-0028](0028-structured-understand-without-new-concepts.md)
- [ADR-0029](0029-method-density-without-concept-growth.md)
- External design input: [`mattpocock/skills` at `6654f6b`](https://github.com/mattpocock/skills/tree/6654f6b)
