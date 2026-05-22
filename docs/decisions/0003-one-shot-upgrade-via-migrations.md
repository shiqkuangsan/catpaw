# ADR-0003: One-Shot Project Upgrade via `migrations/` Replay

Status: Accepted; amended by ADR-0007 and ADR-0009

## Context

Users skip versions. Static checks against the latest schema work for simple additions, but fail once schema deltas include renames, moves, removals, or user decisions.

## Decision

Use an ordered migration registry. `upgrade-project` reads the board stamp, replays existing `migrations/<version>.md` files in `(stamp, installed-runtime]`, batches user decisions, and presents one dry-run/apply operation.

Migration files must be idempotent and local to the release that introduced the schema delta. Major version breaks must declare an explicit stop/ack path.

## Consequences

- A board can jump from an old runtime to the current runtime in one user-facing operation.
- Maintainers must add migration notes for project schema changes.
- Release checks need a migration gate.
- Runtime-only releases can still advance stamps without schema rewrites; see ADR-0009.

## References

- `src/runtime/commands/upgrade-project.md`
- `src/runtime/commands/release-runtime.md`
- `src/runtime/migrations/README.md`
- [migration-pipeline.md](../architecture/migration-pipeline.md)
- [ADR-0001](0001-version-stamp-on-index.md)
- [ADR-0009](0009-project-stamps-track-runtime.md)
