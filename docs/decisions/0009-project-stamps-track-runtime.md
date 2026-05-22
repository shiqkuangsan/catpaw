# ADR-0009: Project Stamps Track Installed Runtime

Status: Accepted

## Context

One possible model was to advance project board stamps only when a matching migration file existed. That reduces stamp churn, but it hides whether a board has been processed by the latest runtime policy, commands, and interpretation rules.

Runtime-only releases can change how agents handle a board even when no artifact schema changes.

## Decision

Board stamps track the installed runtime version. `upgrade-project --apply` advances `.catpaw/index.md` `runtime:` and the registry stamp to the installed runtime target.

If there are no migrations in range, the upgrade is stamp-only.

## Consequences

- A board is stale whenever its stamp is older than `~/.catpaw/VERSION`.
- Runtime-only releases intentionally create small stamp-only project updates.
- Migration files remain schema-delta records, not currentness markers.
- `upgrade-runtime --apply-projects` can converge registered boards in one pass.

## References

- `src/runtime/commands/upgrade-runtime.md`
- `src/runtime/commands/upgrade-project.md`
- `src/runtime/commands/registry-doctor.md`
- [ADR-0007](0007-runtime-upgrade-project-orchestration.md)
