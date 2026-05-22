# Three-Layer Model

CatPaw keeps three layers separate, with one additional per-machine local state surface: source authoring, installed runtime, project artifacts, and registry state.

```text
Source repo                    ~/path/to/catpaw
  │ explicit release/build/upgrade
  ▼
Global runtime                 ~/.catpaw/
  │ explicit init/migrate/upgrade
  ▼
Project board                  <project>/.catpaw/
  │
  └─ indexed locally by         ~/.catpaw/state/projects.json
```

## The Layers

| Layer | Holds | Does not hold |
|---|---|---|
| Source repo | Authored runtime package under `src/runtime/`, maintainer docs, build tooling | User board state |
| Global runtime | Installed specs, commands, templates, roles, migrations, thin policy | Source-only docs, build tooling, project artifacts |
| Project board | Req/plan/research/review/test/lesson artifacts and `index.md` stamp | Runtime files |
| Local state | Registry metadata about known boards | Runtime package files or artifact contents |

The core rule is **global spec, local artifacts**. Runtime files live once in `~/.catpaw/`; each project board only records work for that project.

## Why This Exists

Without the split, three kinds of drift get mixed together:

- Source edits could appear installed before a release decision.
- Runtime upgrades could overwrite per-machine registry state.
- Project boards could accidentally vendor stale specs or commands.

The layer boundary keeps each movement explicit: source changes become runtime changes only through release/upgrade actions; runtime changes reach boards only through init/migrate/upgrade actions; registry state remains local to the machine.

## Design Invariants

- `src/runtime/runtime-manifest.json` decides what can enter the runtime package.
- `~/.catpaw/state/` is local state, not a distribution surface.
- `<project>/.catpaw/` never receives `specs/`, `commands/`, `templates/`, `roles/`, or other runtime directories.
- `docs/` explains maintainer rationale and is not installed.
- Cross-layer writes are explicit user-facing operations.

## Where the Operational Rules Live

- Runtime package shape: `src/runtime/specs/11-runtime-package.md`.
- Project board shape: `src/runtime/specs/03-project-directory.md`.
- Install/upgrade behavior: `src/runtime/AI-INSTALL.md`, `src/runtime/commands/upgrade-runtime.md`, `src/runtime/commands/upgrade-project.md`.

## Related

- [sync-and-references.md](sync-and-references.md)
- [migration-pipeline.md](migration-pipeline.md)
- [ADR-0002](../decisions/0002-canonical-files-exclude-state.md)
- [ADR-0005](../decisions/0005-docs-not-distributed.md)
- [ADR-0010](../decisions/0010-source-runtime-package-split.md)
