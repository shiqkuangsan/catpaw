# CatPaw Source Bootstrap

This file is the source-repository entrypoint for an AI-assisted CatPaw install
or upgrade. Reading or building this checkout does not authorize any write to
the installed runtime, host adapters, registry, or project boards.

## Current State

- Source runtime: `3.0.2`.
- Project board contract: board schema 2.
- Activation: `pending activation` until the installed runtime is explicitly
  upgraded and verified.
- This source refactor performs no global apply and no project migration.

Building source does not automatically install, apply, or migrate CatPaw.

## Package Surfaces

```text
src/runtime/   versioned source
dist/runtime/  generated package
~/.catpaw/     installed runtime
<project>/.catpaw/  project board
```

Generate and inspect the package without activating it:

```bash
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

The build copies only entries declared by
[`src/runtime/runtime-manifest.json`](src/runtime/runtime-manifest.json).
Verification is read-only for the installed runtime and reports an older
installation as `pending activation` by default.

## Explicit Install Or Upgrade

Proceed only after the user asks to install or upgrade:

1. Read [`src/runtime/AI-INSTALL.md`](src/runtime/AI-INSTALL.md) and
   [`src/runtime/guidance/maintenance.md`](src/runtime/guidance/maintenance.md).
2. Build `dist/runtime/` and verify source/dist parity.
3. Compare the generated manifest with `~/.catpaw/`; present the exact dry-run,
   preservation rules, conflicts, and backup target.
4. Obtain explicit approval for runtime activation.
5. Stage and verify the complete managed runtime before publishing it.
6. Verify installed version, manifest/hash, links, CLI smoke, and obvious secret
   findings.

Preserve `~/.catpaw/state/` and unknown user files. Do not copy repository-root
`docs/`, `scripts/`, tests, Git metadata, or other source-only files into the
installed runtime.

Paths listed in `legacyRuntimePaths` are retired managed runtime content, not
unknown user files. Back them up and exclude them from the staged installation.

## Separate Authorization Scopes

Runtime activation does not imply any of the following:

- merging a global or project host adapter;
- mutating the local project registry;
- creating a new project board;
- migrating an existing board from schema 1 to schema 2;
- importing or deleting a legacy project tree.

Each action starts with a dry-run and requires its own explicit approval. In
particular, do not migrate registered projects as a side effect of runtime
activation.

## Verification Note

`node scripts/verify-runtime.mjs --strict-activation` is intended for the point
where installation is expected to match source. Before activation, its version
mismatch is an expected signal and must not be repaired without authorization.
