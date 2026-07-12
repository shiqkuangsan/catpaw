# ADR-0019: CatPaw 3 Hybrid Runtime

Status: Accepted

Date: 2026-07-11

## Context

CatPaw had accumulated useful safety, artifact, review, and multi-agent ideas,
but too many parallel concepts increased reading cost and allowed repeated
rules to drift. A prose-only protocol also depended too heavily on agent memory,
while a fully prescriptive engine would be unable to make sound contextual
choices about scope, tradeoffs, or useful evidence.

The 3.0 redesign therefore needed to preserve the proven development flow and
explicit safety gates while reducing user vocabulary, project artifact types,
and duplicated authority.

## Decision

Adopt a **Hybrid Runtime** with the following compact model.

### Stable lifecycle and modes

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

Select one of `Direct`, `Tracked`, or `Gated`. Direct is lightweight; Tracked
creates durable coordination records; Gated adds required independent judgment
and evidence for high-risk work.

### Board schema 2

The project board contains only:

```text
index.md
milestones/
work/
plans/
evidence/
```

Its artifact kinds are Index, Milestone, Work Item, Plan, and typed Evidence.
Work Item is the smallest durable verifiable unit; Milestone is an optional
multi-Work phase objective.

### Judgment model

Separate `Lens`, `Agent`, and `Independent Check`:

- Lens identifies the perspective needed.
- Agent identifies who performs work or supplies judgment.
- Independent Check determines when non-primary judgment is recommended or
  required.

Keep five Lens cards: Value & Scope, System & Contracts, Experience, Security,
and Performance. Lifecycle methods own engineering, review, testing, shipping,
debugging, and reflection behavior.

Callable external Agents are limited to `cc` and `cx`. OpenCode may host a
CatPaw adapter but is not a direct invocation target. Current-tool subagents
remain first-class for bounded independent work.

### Three runtime surfaces

- **Always-on Rules** provide compact routing, progress, safety, and authority.
- **On-demand Guidance** supplies workflow, Milestone, Lens, check, maintenance,
  and Agent detail only when needed.
- **Executable Tools** own schema, graph, dry-run patch, atomic mutation,
  migration, and observable session mechanics.

Agents make contextual decisions, tools record and verify deterministic state,
and users authorize writes, external effects, and accepted risk.

### Explicit activation chain

Keep the storage and activation chain explicit:

```text
source -> dist -> installed -> project board
```

Source version 3.0.0 does not mean the installed runtime or existing project
boards are activated. Build, install, adapter merge, and each board migration
remain separately approved operations.

## Supersession

This ADR supersedes the legacy workflow-level, specialist-council, role-tree,
and provider-state vocabulary as current operating guidance. Historical ADRs
remain evidence for why earlier safeguards were introduced, but their old
operational terms do not override CatPaw 3 authorities.

Specifically, it supersedes ADR-0001, ADR-0003, ADR-0007, ADR-0008, ADR-0009,
ADR-0011, ADR-0013, and ADR-0014. It amends the current implementation or
vocabulary of ADR-0004, ADR-0006, ADR-0012, ADR-0015, ADR-0016, ADR-0017, and
ADR-0018 without discarding their retained principle.

This decision does **not** supersede the earlier source/runtime/storage
separation. In particular, canonical-file isolation, maintainer-doc exclusion,
and source-package splitting remain valid foundations.

## Consequences

- New users learn three modes, five artifact kinds, and three judgment concepts
  instead of several overlapping taxonomies.
- The always-on policy becomes smaller; detailed rules load only when relevant.
- Deterministic board operations become testable and idempotent without turning
  product judgment into a rigid state engine.
- Existing schema 1 boards require explicit migration before using schema 2.
- An older installed runtime is a valid `pending activation` state during the
  source-only transition.
- Agent output, tool success, and independent evidence still cannot authorize
  commit, push, deployment, destructive action, secret access, or permission
  expansion.

## References

- [Runtime policy](../../src/runtime/runtime-policy.md)
- [Workflow guidance](../../src/runtime/guidance/workflow.md)
- [Independent Checks](../../src/runtime/guidance/independent-checks.md)
- [Board schema 2](../../src/runtime/schemas/board-v2.json)
- [CLI entrypoint](../../src/runtime/bin/catpaw.mjs)
- [ADR-0002](0002-canonical-files-exclude-state.md)
- [ADR-0005](0005-docs-not-distributed.md)
- [ADR-0010](0010-source-runtime-package-split.md)
