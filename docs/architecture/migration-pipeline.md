# Board Migration Pipeline

CatPaw 3 converts an existing **schema 1** project board into **schema 2** as an
explicit project operation. Runtime activation and board migration are separate
authorization scopes.

```text
schema 1 board
  -> inventory and dry-run
  -> resolve blockers
  -> stage schema 2 candidate
  -> validate graph and files
  -> backup complete preimage
  -> publish atomically
  -> verify and become idempotent
```

Building or activating the runtime does not automatically migrate any board.

## Target Shape

The converged schema 2 board contains:

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
```

Legacy requirement records become Work Items, active plans bind to Work,
phase groupings become Milestones, and durable research/review/test/reflection
facts become typed Evidence. Unknown or binary files are preserved unless the
user explicitly chooses another disposition.

## Dry-run

```text
catpaw board migrate --project /abs/project
```

The planner inventories the complete board, parses metadata and links, detects
collisions or ambiguous facts, and emits the exact source-to-target operations.
It does not infer status, mode, lifecycle stage, dates, binding, or independence
from directory placement, prose position, Git history, or file time.

Ambiguous facts become a batched blocker list. Dry-run writes no backup, stage,
board file, adapter, or registry entry.

## Stage And Validate

After blockers are resolved and `--apply` is explicitly approved, the engine
builds a complete candidate in a sibling stage. It then validates:

- schema 2 metadata against
  [`board-v2.json`](../../src/runtime/schemas/board-v2.json);
- expected paths and file types;
- Work-to-Plan and Work-to-Evidence bindings;
- Milestone Scope references;
- local links and duplicate identities;
- Gated completion requirements and accepted gaps.

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
exact no-op. Backup cleanup, legacy-tree deletion, adapter edits, and unrelated
project cleanup are not implied.

## Recovery

Failure reports include the stage, findings, and backup path when a backup was
created. Rollback or cleanup remains an explicit operation; CatPaw does not
silently replace a live board with an older copy.

## Related

- [Runtime maintenance guidance](../../src/runtime/guidance/maintenance.md)
- [Schema 2 migration note](../../src/runtime/migrations/schema-2.md)
- [Sync and References](sync-and-references.md)
- [ADR-0019](../decisions/0019-catpaw-3-hybrid-runtime.md)
