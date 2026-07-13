# Board Migration Pipeline

CatPaw 3 converts an existing **schema 1** project board into **schema 2** as an
explicit per-project operation. Runtime activation and board migration are
separate authorization scopes.

```text
schema 1 board
  -> inventory and dry-run
  -> classify active closure and historical material
  -> resolve true blockers
  -> stage native graph plus legacy archive
  -> validate graph, checksums, and files
  -> backup complete preimage
  -> publish atomically
  -> verify and become idempotent
```

Building or activating the runtime does not automatically migrate any board.

## Bounded Hybrid Strategy

Exhaustive conversion made historical metadata debt a release blocker and
encouraged agents to invent dates, stages, or bindings. CatPaw instead uses four
explicit dispositions: convert complete artifacts, apply narrow canonical
normalizations, preserve incomplete historical material, and block only active
closure or safety ambiguity.

Active state comes only from the managed Active Work section,
`plans/active/`, or explicit active/blocked metadata. Prose, Git history, and
file timestamps are not activity signals. An active Milestone Scope extends the
required Work closure without reactivating terminal Work. Every active Work Item
and its live Plan, Milestone, and required Evidence dependency must be complete
before publication.

Safe normalizations are limited to canonical filename IDs, ID-prefix type,
exact terminal status aliases, terminal stage `reflect`, and uniquely
resolvable path bindings. Active dates, stages, modes, bindings, status, and
accepted gaps are never fabricated.

## Target Shape

The native schema 2 graph contains:

```text
.catpaw/
|-- index.md
|-- milestones/
|-- work/
|-- plans/
`-- evidence/
```

Schema 1 migration may also create `legacy/schema-1/`. It contains originals
used for conversion and incomplete historical files, plus a deterministic
manifest of source/destination, disposition, bytes, mode, and SHA-256. The
archive is not part of the native graph and is ignored by normal schema 2
status and mutation commands. Source directory modes are retained in the
archive as well as file bytes, BOM, and modes.

## Dry-run

```text
catpaw board migrate --project /abs/project
```

The planner inventories the complete board, parses metadata and links, detects
collisions or ambiguous facts, and emits native mappings, warnings, preserved
legacy counts, and root blockers. It does not write a backup, stage, board file,
adapter, or registry entry.

## Stage And Validate

After blockers are resolved and `--apply` is explicitly approved, the engine
builds a complete candidate in a sibling stage. It then validates:

- schema 2 metadata against
  [`board-v2.json`](../../src/runtime/schemas/board-v2.json);
- paths, file types, and native graph references;
- Work-to-Plan/Evidence bindings and Milestone Scope;
- terminal Gated Evidence or accepted gaps;
- existing, physically project-contained local links and duplicate identities;
- every legacy manifest checksum and byte length.

A failed stage leaves the live board untouched and creates no success claim.

## Backup And Publish

Only a validated stage may proceed. Before publication, CatPaw stores the
complete live preimage under the configured CatPaw backup root, rechecks that
the live board still matches the planned preimage, and publishes the staged
tree atomically.

If the preimage changed, publication stops and the plan must be recomputed. A
successful migration can then update the registry through its separate,
explicit contract. It never batch-migrates other registered projects.

## Verification And Idempotence

After publish, board doctor validates the live graph and reports any remaining
gap. Running the same migration again against a valid schema 2 board must be an
exact no-op; an invalid schema 2 board is blocked and routed to doctor instead
of being called complete. Backup cleanup, legacy archive deletion, adapter edits, and
unrelated project cleanup are not implied.

## Recovery

Failure reports include the stage, findings, and backup path when a backup was
created. Rollback or cleanup remains an explicit operation; CatPaw does not
silently replace a live board with an older copy.

## Related

- [Runtime maintenance guidance](../../src/runtime/guidance/maintenance.md)
- [Schema 2 migration note](../../src/runtime/migrations/schema-2.md)
- [Sync and References](sync-and-references.md)
- [ADR-0019](../decisions/0019-catpaw-3-hybrid-runtime.md)
- [ADR-0020](../decisions/0020-selective-schema-1-migration.md)
