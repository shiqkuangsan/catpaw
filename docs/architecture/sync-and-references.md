# Sync and References

This note explains how the three layers move and how agents find the current runtime contract.

## Source -> Global Runtime

Source changes do nothing by themselves. A maintainer must classify the change, build or resolve a runtime package root, then run the explicit runtime upgrade flow.

The manifest boundary matters here: `upgrade-runtime` syncs only `canonicalFiles`. Source-only surfaces such as `docs/`, `scripts/`, root bootstrap files, generated output, and local state are outside that list.

## Global Runtime -> Project Board

Project boards receive no runtime files. They are processed by commands that read the installed runtime and write only board artifacts or board metadata.

Three entrypoints can stamp or register a board:

- `init-project` creates a new board.
- `migrate-project` converts legacy project artifacts into a board.
- `upgrade-project --apply` replays migrations and advances the board stamp.

All three preserve the same boundary: runtime is referenced, not copied.

## Provider Reference Chain

Provider configuration should stay thin:

```text
provider adapter
  -> ~/.catpaw/runtime-policy.md
     -> ~/.catpaw/commands/<command>.md
        -> ~/.catpaw/specs/ + templates/ + migrations/ + roles/
```

The adapter points to CatPaw; it does not embed CatPaw. This keeps provider setup stable while the runtime evolves.

## Horizontal Registry

`~/.catpaw/state/projects.json` is the per-machine index of known boards. It lets global commands survey boards without scanning the filesystem every time.

The registry can be read for status and upgrade surveys, refreshed when a registered board is touched, pruned when paths disappear, or edited by unregister commands. It must not become a source repo artifact, a sync target, or a place to store artifact contents.

## Gate Design

The sync chain deliberately treats external and destructive actions as user-gated operations, not workflow defaults. This keeps orchestration separate from authorization: commands may prepare, survey, or recommend, but binding rules for commit, push, PR, deploy, destructive cleanup, destructive git operations, and project-board writes live in runtime policy and command runbooks.

## Three Easy Confusions

1. **Stamp vs migration version**: a board stamp records the installed runtime that processed it; migrations only describe schema deltas.
2. **`canonicalFiles` vs commands**: `canonicalFiles` is the package sync list; `commands/` is one installed runtime surface.
3. **`state/` vs source repo**: registry state is local machine fact and never belongs in source history.

## Related

- [three-layer-model.md](three-layer-model.md)
- [migration-pipeline.md](migration-pipeline.md)
- [ADR-0001](../decisions/0001-version-stamp-on-index.md)
- [ADR-0004](../decisions/0004-global-project-registry.md)
- [ADR-0007](../decisions/0007-runtime-upgrade-project-orchestration.md)
- [ADR-0009](../decisions/0009-project-stamps-track-runtime.md)
