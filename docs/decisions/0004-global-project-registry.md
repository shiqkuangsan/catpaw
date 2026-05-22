# ADR-0004: Per-Machine Global Project Registry

Status: Accepted; amended by ADR-0007

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
