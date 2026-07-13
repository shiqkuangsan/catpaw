# ADR-0020: Selective Schema 1 Migration

Status: Accepted

Date: 2026-07-13

## Context

The CatPaw 3.0.0 migration engine attempted exhaustive conversion. Dry-runs
against 17 registered schema 1 boards produced 3,527 blockers and no migration-
ready board. Most findings were historical metadata debt or cascades derived
from one incomplete artifact, not current operational ambiguity.

Treating all historical files as native schema 2 candidates made manual effort
proportional to archive size. Guessing missing dates, stages, or bindings would
make conversion easier but would corrupt project history and trust.

## Decision

Adopt a bounded hybrid migration strategy.

1. Require a complete **active dependency closure**. Activity is recognized
   only from the managed Active Work section, `plans/active/`, or explicit
   active/blocked metadata. Active Milestone Scope rows extend the required Work
   closure without reactivating terminal Work.
2. Convert complete schema 1 artifacts into the native schema 2 graph.
3. Normalize only canonical facts: filename IDs, ID-prefix type, exact status
   aliases, terminal stage `reflect`, and uniquely resolvable path bindings.
4. Preserve incomplete historical material and converted originals under
   `.catpaw/legacy/schema-1/` with a deterministic SHA-256 checksum manifest.
5. Keep active ambiguity, project-boundary violations, unsupported filesystem
   entries, non-UTF-8 Markdown, collisions, and transaction failures as
   blockers.
6. Collapse derived validation cascades into one actionable root finding per
   incomplete active artifact.
7. Keep migration dry-run by default and apply each project independently.
8. Preserve source directory modes in the legacy archive and validate an
   existing schema 2 board before reporting an idempotent no-op.
9. Evaluate Gated `done` completion before native mapping. Missing completion
   Evidence blocks when the Work is required by the active closure; otherwise
   preserve the historical Work and its bound artifacts outside the live graph.

The legacy archive is not a sixth artifact kind. Schema 2 readers and mutation
commands operate only on the native roots and ignore it.

## Consequences

- Migration work is proportional to current active state instead of total
  historical archive size.
- No missing active contract is silently accepted, and no historical metadata
  is fabricated.
- Historical content remains readable and checksum-verifiable, but incomplete
  records do not become native graph nodes until a later explicit import.
- A migrated board may retain a live legacy archive alongside five native
  artifact kinds; users must not edit or delete it as routine cleanup.
- Board schema remains 2. Existing schema 2 boards are unaffected.
- Schema 1 migration previews produced before 3.0.3 are superseded and should be
  rerun before apply.
- Source release, runtime activation, and each project apply remain separate;
  this decision authorizes none of them by itself.

## References

- [ADR-0019](0019-catpaw-3-hybrid-runtime.md)
- [Migration pipeline](../architecture/migration-pipeline.md)
- [Runtime migration authority](../../src/runtime/migrations/schema-2.md)
- [Board schema 2](../../src/runtime/schemas/board-v2.json)
