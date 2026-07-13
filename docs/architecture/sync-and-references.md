# Sync And References

CatPaw separates behavior responsibility from storage and activation. Runtime
state moves through four explicit surfaces:

```text
source -> dist -> installed -> project board
```

No arrow is automatic, and a successful earlier step does not prove a later
surface changed.

## Source -> Dist

Authored runtime files live under `src/runtime/`. The build reads
[`runtime-manifest.json`](../../src/runtime/runtime-manifest.json), validates its
canonical entries, and generates `dist/runtime/`.

The manifest is both an allowlist and a completeness contract: declared files
must exist, and generated package files must be covered by a canonical entry.
Source-only docs, tests, and maintainer scripts stay outside the package.

## Dist -> Installed

The installed runtime lives at `~/.catpaw/`. Activation compares dist and the
installed manifest, previews exact managed changes, preserves local state and
unknown files, stages a complete candidate, validates it, and only then
publishes approved changes.

When source/dist are 3.0.4 and the installed runtime is older, the correct
state is `pending activation`. It is neither a broken source build nor a
completed installation.

## Installed -> Project Board

A project board is local project data under `<project>/.catpaw/`. Installation
does not copy runtime files into it. Board creation and schema migration are
independent actions performed through the installed or explicitly selected
CLI, with dry-run before `--apply`.

The board stores only:

```text
index.md
milestones/
work/
plans/
evidence/
```

Schema migration may retain a checksummed `legacy/schema-1/` archive alongside
these roots. It is excluded from the native graph and normal board mutations.

Installing CatPaw does not automatically create, apply, or migrate a project
board.

## Thin Reference Chain

Host configuration remains intentionally small:

```text
host adapter
  -> installed runtime policy
     -> on-demand guidance or executable CLI
        -> project board artifacts
```

An adapter is a managed reference, not a runtime copy. Global and project
adapter merges are separately previewed and authorized. OpenCode may read such
a project rule as a host, but CatPaw directly invokes only the `cc` and `cx`
external Agents.

## Local Registry

`~/.catpaw/state/projects.json` is an advisory per-machine index keyed by
absolute board path. It supports explicit checks and maintenance without
scanning the filesystem, but it never owns project contents. Registry mutation
cannot delete, migrate, or otherwise modify a board.

## Failure Modes Prevented

| Confusion | Correct interpretation |
|---|---|
| Source changed | Dist, installed runtime, and boards are unchanged |
| Dist built successfully | A package is ready; activation may still be pending |
| Runtime installed | Existing boards remain at their current schema |
| Adapter merged | The host can find CatPaw; no board write is implied |
| Board registered | Registry has an observation; ownership stays with the project |

## Related

- [Three Runtime Surfaces](three-layer-model.md)
- [Migration Pipeline](migration-pipeline.md)
- [ADR-0002](../decisions/0002-canonical-files-exclude-state.md)
- [ADR-0005](../decisions/0005-docs-not-distributed.md)
- [ADR-0010](../decisions/0010-source-runtime-package-split.md)
- [ADR-0019](../decisions/0019-catpaw-3-hybrid-runtime.md)
