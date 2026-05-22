# Migration Pipeline

Project boards stay current by replaying schema deltas from the board's stamp to the installed runtime in one pass. Users do not walk versions manually.

## The Three Pieces

```text
.catpaw/index.md          ~/.catpaw/migrations/       ~/.catpaw/state/projects.json
runtime: x.y.z     +     ordered deltas        +     local board index
```

- The board stamp says which runtime last processed the board.
- Migration files describe project-side schema changes introduced by specific runtime versions.
- The registry lets runtime-level commands find known boards for surveys and optional batch apply.

## Target Semantics

The target is always the installed runtime version in `~/.catpaw/VERSION`.

Migration files decide whether files need schema rewrites; they do not decide whether a board is current. A runtime-only release can therefore produce a stamp-only project upgrade.

## Replay Model

`upgrade-project` reads the board stamp, enumerates existing migrations in `(stamp, installed-runtime]`, merges their operations, collects user decisions once, and produces one dry-run summary. On apply, it writes the converged result, advances the board stamp to the installed runtime, and upserts the registry entry.

The important property is idempotence: every migration operation must be safe to see again. Re-running an already-applied upgrade should become a no-op.

## Runtime Upgrade Orchestration

`upgrade-runtime` is the horizontal entrypoint. After syncing and verifying the installed runtime, it reads the registry and surveys registered boards against the installed runtime target.

Project writes still belong to `upgrade-project --apply`; `upgrade-runtime --apply-projects` is an orchestrator path, not an independent board writer.

## When Replay Stops

One-shot replay stops before writing when the tool cannot produce a safe converged state: unresolved user decisions, declared major-version incompatibility, invalid migration semantics, missing installed runtime, or blocked board conditions.

## Why This Design

The alternative is per-version manual upgrades. That does not fit how people actually upgrade, repeats the same read/write cycle, and scatters user decisions across multiple runs.

The migration registry localizes each release's schema delta while preserving a single user-facing upgrade operation.

## Operational Sources

- `src/runtime/commands/upgrade-project.md`
- `src/runtime/commands/upgrade-runtime.md`
- `src/runtime/commands/release-runtime.md`
- `src/runtime/migrations/README.md`

## Related

- [ADR-0001](../decisions/0001-version-stamp-on-index.md)
- [ADR-0003](../decisions/0003-one-shot-upgrade-via-migrations.md)
- [ADR-0004](../decisions/0004-global-project-registry.md)
- [ADR-0007](../decisions/0007-runtime-upgrade-project-orchestration.md)
- [ADR-0009](../decisions/0009-project-stamps-track-runtime.md)
