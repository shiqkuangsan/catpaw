# CatPaw Maintainer Docs

Maintainer rationale only; nothing here is shipped or overrides the runtime.

| Need | Authority |
|---|---|
| Agent behavior | [`src/runtime/policy.md`](../src/runtime/policy.md) |
| Board format and commands | [`src/runtime/lib/`](../src/runtime/lib/) and [`src/runtime/README.md`](../src/runtime/README.md) |
| Current design | [ADR-0035](decisions/0035-catpaw-5-delivery-ledger-and-minimal-concepts.md) |

## Decisions

`decisions/` holds the ADR history. ADR-0035 supersedes the workflow, vocabulary,
delegation, packaging and migration decisions of ADR-0001 through ADR-0034;
those bodies describe CatPaw 4 and earlier and may name removed paths and
commands. They remain as rationale, not as operating guidance.

Record a significant decision as `decisions/NNNN-short-title.md` with Status
(`Proposed`, `Accepted`, or `Superseded by ADR-NNNN`), Context, Decision,
Consequences and References.

## Evaluations

`evaluations/` keeps versioned validation results with their stated limits.
