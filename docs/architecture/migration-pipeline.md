# Board Migration Pipeline

CatPaw 3 converts an existing **schema 1** project board into **schema 2** as an
explicit per-project operation. Runtime activation and board migration are
separate authorization scopes.

```text
schema 1 board
  -> inventory and dry-run
  -> infer missing metadata with provenance
  -> resolve structural blockers
  -> stage native graph plus legacy archive
  -> validate graph, checksums, and files
  -> backup complete preimage
  -> publish atomically
  -> verify and become idempotent
```

Building or activating the runtime does not automatically migrate any board.

## Zero-touch Semantic Strategy

The first exhaustive converter turned metadata debt into thousands of blockers.
The later selective converter avoided those blockers by leaving incomplete
history outside the native graph, but that made migrated projects appear to
lose Work, Plans, Milestones, and Evidence. Both behaviors exposed implementation
details to users.

CatPaw 3.0.4 converts every recognized artifact and fills machine metadata
without user input. Explicit metadata wins, followed by canonical structure,
scoped status prose/index/Milestone facts, artifact relationships, and
conservative defaults. Unknown lifecycle state becomes `blocked`; it never
becomes `done` merely because metadata is absent. Inferred fields are reported
as provenance rather than as decisions for the user.

Identity conflict or absence, duplicate IDs, unresolved Plan ownership,
destination collisions, unsafe paths, invalid encoding/source structure, and
transaction failures remain blockers. Historical Gated completion gaps become
explicit reflection records naming the unavailable gates; they do not claim an
Independent Check or grant authority.

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

Schema 1 migration also creates `legacy/schema-1/`. It contains every original
used for conversion and non-artifact legacy material, plus a deterministic
manifest of source/destination, disposition, bytes, mode, and SHA-256. The
archive is not part of the native graph and is ignored by normal schema 2
status and mutation commands. Source directory modes are retained in the
archive as well as file bytes, BOM, and modes.

## Dry-run

```text
catpaw board migrate --project /abs/project
```

The planner inventories the complete board, parses metadata and links, infers
missing fields, detects structural conflicts, and emits native mappings,
aggregated inference warnings, legacy counts, and root blockers. It does not
write a backup, stage, board file, adapter, or registry entry.

## Stage And Validate

After blockers are resolved and `--apply` is explicitly approved, the engine
builds a complete candidate in a sibling stage. It then validates:

- schema 2 metadata against
  [`board-v2.json`](../../src/runtime/schemas/board-v2.json);
- paths, file types, and native graph references;
- Work-to-Plan/Evidence bindings and Milestone Scope;
- Gated `done` Evidence or accepted gaps;
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
- [ADR-0021](../decisions/0021-zero-touch-semantic-schema-1-migration.md)
