# CatPaw Maintainer Docs

These documents explain the architecture and decisions behind CatPaw 3.0.1
Hybrid Runtime. They are maintainer-facing rationale, not an installed runtime
contract.

## Authority Boundary

Current behavior has one owner per concern:

| Concern | Runtime authority |
|---|---|
| Always-on routing and safety | [`runtime-policy.md`](../src/runtime/runtime-policy.md) |
| Lifecycle and modes | [`guidance/workflow.md`](../src/runtime/guidance/workflow.md) |
| Independent judgment | [`guidance/independent-checks.md`](../src/runtime/guidance/independent-checks.md) |
| Multi-Work phases | [`guidance/milestones.md`](../src/runtime/guidance/milestones.md) |
| Runtime and local-state maintenance | [`guidance/maintenance.md`](../src/runtime/guidance/maintenance.md) |
| External Agent operation | [`providers/README.md`](../src/runtime/providers/README.md) |
| Board metadata | [`schemas/board-v2.json`](../src/runtime/schemas/board-v2.json) |
| Deterministic operations | [`bin/catpaw.mjs`](../src/runtime/bin/catpaw.mjs) |

Use `docs/` for the answer to "why is this designed this way?" Use the runtime
authority for "what should an agent or CLI do now?"

## Architecture Map

- [Three Runtime Surfaces](architecture/three-layer-model.md) explains
  Always-on Rules, On-demand Guidance, and Executable Tools.
- [Sync and References](architecture/sync-and-references.md) explains the
  `source -> dist -> installed -> project board` chain.
- [Migration Pipeline](architecture/migration-pipeline.md) explains explicit,
  staged board conversion from schema 1 to schema 2.
- [Glossary](glossary.md) defines the compact CatPaw 3 vocabulary.

## Document Lifecycle

`docs/` keeps durable maintainer rationale only:

| Surface | Retention rule |
|---|---|
| `architecture/` | Current explanatory models that clarify runtime boundaries |
| `decisions/` | Accepted, amended, and superseded ADR history |
| `glossary.md` | Current maintainer vocabulary |

Temporary design and implementation plans, execution checklists, review
handoffs, and session notes do not belong in `docs/`. While active, they belong
in the project Work Board or local task context. After completion, retain only
the durable outcome in an ADR, architecture note, runtime authority, or test;
delete the process document instead of creating an `archive/` graveyard.

## Distribution Boundary

`docs/` is source-only. It is outside the canonical package list in
[`runtime-manifest.json`](../src/runtime/runtime-manifest.json), is never copied
to `~/.catpaw/`, and never activates an installed runtime or project board.
This preserves the decisions in
[ADR-0005](decisions/0005-docs-not-distributed.md) and
[ADR-0010](decisions/0010-source-runtime-package-split.md).

## Decision History

ADRs are durable records, not automatically current operating instructions.
Earlier ADRs remain useful evidence for storage, packaging, registry, migration,
and safety choices even when CatPaw 3 supersedes some of their workflow terms.

The `Status` line is authoritative for an ADR's current standing:

- `Accepted` means the decision remains current.
- `Accepted; ... amended by ADR-0019` means the principle remains but CatPaw 3
  owns its current vocabulary or implementation.
- `Superseded by ADR-0019` means historical rationale only.

ADR bodies and references describe the source tree at decision time and may
name removed v2 paths. They never override the current authority map above.

The current architecture is owned by
[ADR-0019: CatPaw 3 Hybrid Runtime](decisions/0019-catpaw-3-hybrid-runtime.md)
and [ADR-0020: Selective Schema 1 Migration](decisions/0020-selective-schema-1-migration.md).
ADR-0019 defines the compact runtime model; ADR-0020 makes schema 1 conversion
proportional to active state while preserving incomplete history without
inventing metadata.

## Writing Rules

- Keep architecture notes explanatory and runtime authorities normative.
- Do not retain completed task plans or duplicate runtime instructions in
  `docs/`.
- Prefer one canonical decision table or schema over repeated prose.
- Record a significant decision as
  `decisions/NNNN-short-title.md` with Status, Context, Decision, Consequences,
  and References.
- Do not claim that source, dist, installed runtime, or project boards changed
  merely because another surface changed.
- Release notes belong in
  [`src/runtime/CHANGELOG.md`](../src/runtime/CHANGELOG.md); machine contracts
  belong in schema or executable tests.
