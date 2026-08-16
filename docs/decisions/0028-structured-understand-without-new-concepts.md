# ADR-0028: Structured Understand Without New Concepts

Status: Accepted

Date: 2026-08-16

## Context

CatPaw's Understand phase requires outcome, constraints, dependencies,
acceptance, and verification to be clear, but it did not define a compact way to
structure ambiguous Work spanning several concerns or systems. Ad hoc discussion
often mixes containment, dependency, recommendation, decision, and delivery
order. Publishing separate Tree, Map, or decision-ledger concepts would recreate
the vocabulary burden removed by ADR-0026.

## Decision

Add one trigger-based method inside the existing Understand phase:

- Use a shallow scope tree only for containment. It is neither a task hierarchy
  nor a dependency graph.
- Record only dependency edges that affect sequencing, ownership, safe
  parallelism, or risk.
- Mark material local statements or decision points
  `Confirmed | Proposed | Open`. `Confirmed` requires an explicit user decision
  or verified fact. These annotations are not Work status, Proof, Approval, or
  schema metadata.
- Select the first thin end-to-end slice with acceptance and required Proof;
  prefer user-visible value through necessary layers over layer-first delivery.
- Enter Execute when the first slice has no blocking `Open`, material
  dependencies are visible, every blocking dependency is satisfied or has an
  authorized executable resolution with an accountable owner, and acceptance,
  Proof, and future Approval boundaries are named. Otherwise remain in
  Understand; non-blocking unknowns may be deferred.

Direct Work keeps the structure conversational. Tracked and Gated Work persist
only useful parts in the existing Plan. A tree leaf becomes Work only when it
has an independently verifiable outcome; several such Work items may use an
optional Milestone.

No Tree/Map artifact, Plan variant, schema field, CLI command, automatic Work
generation, or mandatory diagram is introduced.

## Consequences

- Complex Work gains a repeatable route from ambiguity to an executable slice.
- Containment, dependency, decision uncertainty, and delivery order remain
  distinct without becoming public concepts.
- Simple Work retains the 3.4 low-ceremony path.
- Plan remains the single durable implementation record, so parallel diagrams
  or ledgers cannot drift into competing authorities.
- The public model remains `Work | Proof | Approval` and the visible flow remains
  `Understand -> Execute -> Check -> Finish`.

## References

- [ADR-0026](0026-user-facing-concept-consolidation.md)
- [Workflow](../../src/runtime/guidance/workflow.md)
- [Plan template](../../src/runtime/templates/plan.md)
- [Milestones](../../src/runtime/guidance/milestones.md)
