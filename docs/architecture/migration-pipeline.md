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

The current CatPaw 3 converter maps every recognized artifact and fills machine metadata
without user input. Explicit metadata wins, followed by canonical structure,
scoped status prose/index/Milestone facts, artifact relationships, and
conservative defaults. Unknown lifecycle state becomes `blocked`; it never
becomes `done` merely because metadata is absent. Inferred fields are reported
as provenance rather than as decisions for the user.

Source defects and migration hazards are different classes. Nested or malformed
optional artifact frontmatter, missing local targets from historical
research/provider Evidence or preserved unknown narrative, stale routing, and absent lifecycle metadata are
recovered or preserved with warnings. Malformed `id/work/req`, unterminated
frontmatter, active-authority broken links, identity conflicts, duplicate IDs,
unresolved Plan ownership after recovery, destination collisions, path escape,
invalid index authority/encoding, special filesystem entries, and transaction
failures remain blockers. Historical Gated completion gaps become explicit
reflection records naming the unavailable gates; they do not claim an
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

Legacy symlink aliases are not active artifacts and are never dereferenced.
Migration stores valid UTF-8 target text in checksummed inert sidecars and
removes only the alias leaf from the staged board. This preserves provenance
without carrying host-specific or escaping links into schema 2. A non-UTF-8
target blocks instead of being normalized lossily.

## Dry-run

```text
catpaw board migrate --project /abs/project
```

The planner snapshots and inventories the complete board, parses metadata and links, infers
missing fields, detects structural conflicts, and emits native mappings,
aggregated inference warnings, legacy counts, and root blockers. It does not
write a backup, stage, board file, adapter, or registry entry.

The generated operations carry the analysis preimage digest into the patch
planner. Drift before plan creation blocks as `stale-analysis-preimage`; drift
after plan creation remains covered by the atomic publisher's stale checks.
The publisher also verifies that the copied stage starts from that preimage and
that the staged postimage remains byte-identical from validation through the
final publish check.

## Stage And Validate

After blockers are resolved and `--apply` is explicitly approved, the engine
builds a complete candidate in a sibling stage. It then validates:

- schema 2 metadata against
  [`board-v2.json`](../../src/runtime/schemas/board-v2.json);
- paths, file types, and native graph references;
- Work-to-Plan/Evidence bindings and Milestone Scope;
- Gated `done` Evidence or accepted gaps;
- existing, physically project-contained local links and duplicate identities;
- exact manifest/report entries, archive file-set conservation, and every
  legacy bytes/hash/mode/sourceMode claim.

Real-board acceptance additionally reconciles source inventory against native
mappings plus preserved dispositions, compares exact Work/Milestone identities
and Plan/Evidence bindings, checks that human index narrative remains, verifies
that paths outside `.catpaw/` retain their pre-migration worktree state, and
records why generated migration Evidence changes target counts.

A failed stage leaves the live board untouched and creates no success claim.

## Backup And Publish

Only a validated stage may proceed. Before publication, CatPaw stores the
complete live preimage under the configured CatPaw backup root, rechecks that
the live board still matches the planned preimage, and publishes the staged
tree atomically.

If the preimage changed, publication stops and the plan must be recomputed. A
successful migration can then update the registry through its separate,
explicit contract. It never batch-migrates other registered projects.

For an actively used board, the safe pattern is snapshot -> sibling candidate
-> verify -> recheck live tree digest. A changed digest means rebuilding from
the latest board; it does not authorize overwriting or manually merging a stale
candidate.

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
