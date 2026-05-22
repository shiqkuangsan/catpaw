# ADR-0002: `canonicalFiles` Excludes `state/` and Other Local-Only Surfaces

Status: Accepted

## Context

`~/.catpaw/state/projects.json` is local machine state. If `state/` entered `runtime-manifest.json` `canonicalFiles`, runtime sync could overwrite or delete a user's registry. The same boundary question later applied to source-only maintainer docs.

## Decision

`canonicalFiles` contains only runtime files that ship to every installation. Excluded surfaces include:

- `state/` — per-machine local state.
- `docs/` — source-only maintainer notes.
- repo noise such as `.git/`, `.DS_Store`, and IDE files.

`upgrade-runtime` syncs only manifest-listed paths; `release-runtime` verifies only distribution paths.

## Consequences

- Runtime sync cannot delete the local registry.
- Source history never stores user board paths.
- Adding a new distributed surface requires an explicit manifest update.
- CatPaw has three storage categories: distributed runtime, maintainer-only source docs, and per-machine local state.

## References

- `src/runtime/runtime-manifest.json`
- `src/runtime/commands/upgrade-runtime.md`
- `src/runtime/commands/release-runtime.md`
- [ADR-0004](0004-global-project-registry.md)
- [ADR-0005](0005-docs-not-distributed.md)
