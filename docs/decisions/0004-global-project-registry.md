# ADR-0004: Per-Machine Global Project Registry

Status: Accepted; registry shape amended by ADR-0019

## Current Interpretation

ADR-0019 retained the per-machine registry principle while moving its current
shape and operations to
[`guidance/maintenance.md`](../../src/runtime/guidance/maintenance.md). The
absolute board path is the primary key; read-only checks do not refresh
timestamps, and registration/upsert occurs only after an explicitly applied
project activation, legacy import, or schema migration. Registry operations
never mutate or delete project boards and do not imply fleet migration.

## Context

Global operations need to know where project boards live. Re-scanning the filesystem is slow, incomplete, and cannot remember last-seen or stamp information.

## Decision

Maintain a per-machine registry at `~/.catpaw/state/projects.json`. It records board paths, project roots, stamps, registration source, and last-seen metadata.

Lifecycle commands may append, upsert, refresh, unregister, or prune registry entries according to their runbooks. The registry is local state: never synced, never distributed, never used to store artifact contents.

## Consequences

- Batch status and upgrade surveys become first-class.
- Missing or stale boards can be diagnosed without deleting board files.
- Multi-machine users naturally have one registry per machine.
- Commands that touch registered boards must keep lightweight last-seen metadata accurate.

## References

- `src/runtime/specs/03-project-directory.md`
- `src/runtime/commands/registry-doctor.md`
- `src/runtime/commands/unregister-project.md`
- [ADR-0002](0002-canonical-files-exclude-state.md)
- [ADR-0007](0007-runtime-upgrade-project-orchestration.md)
