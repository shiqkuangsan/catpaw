# ADR-0007: Runtime Upgrade Orchestrates Project Boards

Status: Superseded by ADR-0019

## Context

After the registry existed, upgrading CatPaw still risked two user loops: sync the global runtime, then visit each project board manually. Runtime-only releases also needed a clear way to mark boards processed by the latest runtime.

## Decision

`upgrade-runtime` is the horizontal orchestration entrypoint. After syncing and verifying `~/.catpaw/`, it reads the registry and surveys registered boards against the installed runtime.

Project writes remain delegated to `upgrade-project --apply`; `upgrade-runtime --apply-projects` only orchestrates unblocked board upgrades.

## Consequences

- Users get one upgrade entrypoint plus a board survey.
- Blocked or ambiguous boards can be reported without guessing.
- Runtime-only releases can produce stamp-only board updates.
- Registry state remains local and outside runtime file sync.

## References

- `src/runtime/commands/upgrade-runtime.md`
- `src/runtime/commands/upgrade-project.md`
- `src/runtime/commands/registry-doctor.md`
- [migration-pipeline.md](../architecture/migration-pipeline.md)
- [ADR-0004](0004-global-project-registry.md)
- [ADR-0009](0009-project-stamps-track-runtime.md)
