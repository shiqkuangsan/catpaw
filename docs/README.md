# CatPaw Maintainer Docs

These documents explain the architecture and decisions behind CatPaw 3.4.4
Hybrid Runtime. They are maintainer-facing rationale, not an installed runtime
contract.

## Authority Boundary

Current behavior has one owner per concern:

| Concern | Runtime authority |
|---|---|
| Always-on routing and safety | [`runtime-policy.md`](../src/runtime/runtime-policy.md) |
| Work handling and internal risk routing | [`guidance/workflow.md`](../src/runtime/guidance/workflow.md) |
| Agent intents, delegation, scheduling, concurrency, and context transitions | [`guidance/agent-dispatch.md`](../src/runtime/guidance/agent-dispatch.md) |
| Machine-readable Agent intents | [`catalog/intents.json`](../src/runtime/catalog/intents.json) |
| Debugging, RED/GREEN, review, and prototype methods | [`guidance/engineering-methods.md`](../src/runtime/guidance/engineering-methods.md) |
| Independent judgment | [`guidance/independent-checks.md`](../src/runtime/guidance/independent-checks.md) |
| Multi-Work phases | [`guidance/milestones.md`](../src/runtime/guidance/milestones.md) |
| Runtime and local-state maintenance | [`guidance/maintenance.md`](../src/runtime/guidance/maintenance.md) |
| External Agent operation | [`providers/README.md`](../src/runtime/providers/README.md) |
| Board metadata | [`schemas/board-v2.json`](../src/runtime/schemas/board-v2.json) |
| Deterministic operations | [`bin/catpaw.mjs`](../src/runtime/bin/catpaw.mjs) |

Use `docs/` for the answer to "why is this designed this way?" Use the runtime
authority for "what should an agent or CLI do now?"

## Reading Order And Document State

Read the corpus by authority, not by filename recency:

| Document class | Examples | How to read it |
|---|---|---|
| Current behavioral authority | `src/runtime/runtime-policy.md`, guidance, schema, CLI | Normative for current source behavior |
| Current explanation | root READMEs, `CONTRIBUTING.md`, `docs/architecture/`, `docs/glossary.md` | Maintained to match the authorities, but does not override them |
| Compatibility/storage material | Evidence templates, schema terms, migration guidance | Current internal mechanics, not extra user concepts |
| Historical record | ADR decision bodies, older changelog entries, versioned migration notes | Accurate for the decision/release at that time; never a current command reference by itself |

Retired commands, paths, Role names, or workflow terms may therefore remain in
historical records. A current explanatory or runtime-facing document must not
teach them as live behavior. When an accepted ADR's original body would be
misleading today, a `Current Interpretation` section immediately after its
metadata routes the reader to the controlling later ADR and runtime authority.

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

The `Status` line and any immediately following `Current Interpretation` section
are authoritative for an ADR's current standing:

- `Accepted` means the decision remains current.
- `Accepted; ... amended by ADR-0019` means the principle remains but the named
  later ADR owns the changed vocabulary or implementation.
- `Accepted; ... superseded by ADR-0026` means only the explicitly named
  surface is historical; the rest of the decision remains accepted.
- `Superseded by ADR-0019` means historical rationale only.

ADR bodies and references describe the source tree at decision time and may
name removed paths or commands. They never override the current authority map
above, and historical names must not be copied into new operating guidance.

Current decision ownership is compactly indexed here:

| Concern | Decision |
|---|---|
| Hybrid Runtime | [ADR-0019](decisions/0019-catpaw-3-hybrid-runtime.md) |
| schema 1 conversion | [ADR-0021](decisions/0021-zero-touch-semantic-schema-1-migration.md) |
| local Git and engineering-method foundation | [ADR-0022](decisions/0022-tiered-local-git-authority-and-engineering-methods.md) |
| delegation, isolated commits, contextual orchestration | [ADR-0023](decisions/0023-task-envelopes-and-risk-based-agent-dispatch.md), [ADR-0024](decisions/0024-bounded-builder-slice-commits.md), [ADR-0025](decisions/0025-executor-owned-advisory-orchestration.md) |
| public vocabulary and CLI layers | [ADR-0026](decisions/0026-user-facing-concept-consolidation.md), [ADR-0027](decisions/0027-layered-cli-facade.md) |
| structured Understand method | [ADR-0028](decisions/0028-structured-understand-without-new-concepts.md) |
| internal method density and writing constraints | [ADR-0029](decisions/0029-method-density-without-concept-growth.md) |
| observable Understand and thin authority routing | [ADR-0030](decisions/0030-observable-understand-without-clarification-ceremony.md), [ADR-0031](decisions/0031-thin-entrypoints-and-bound-analysis.md) |

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
