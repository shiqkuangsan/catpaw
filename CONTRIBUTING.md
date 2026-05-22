# Contributing

Thanks for considering a CatPaw contribution.

CatPaw is primarily a runtime protocol and documentation package. Most changes
should be small, explicit, and easy for AI agents to follow.

## Development Workflow

1. Make source changes under `src/runtime/`, `docs/`, or `scripts/`.
2. If runtime behavior changes, update `src/runtime/VERSION`,
   `src/runtime/CHANGELOG.md`, and any affected command/spec files.
3. Generate the installable runtime package:

```bash
node scripts/build-runtime.mjs
```

4. Verify source, generated runtime, installed runtime when present, and project
   board stamps:

```bash
node scripts/verify-runtime.mjs
```

5. Before submitting, check for accidental local state or credentials:

```bash
git status --short
rg -n -i 'token|secret|api[_-]?key|bearer|password|passwd|credential|private[_-]?key|client[_-]?secret|access[_-]?key' .
```

## Runtime Boundaries

- `src/runtime/` is the authored runtime package source.
- `dist/runtime/` is generated and should not be committed.
- `docs/` is maintainer-facing rationale and is not installed.
- Project `.catpaw/` directories are user data and must not receive copied
  runtime specs, commands, roles, or templates.
- `~/.catpaw/state/` is local machine state and must not be distributed.

## Pull Request Expectations

Include:

- the problem or behavior being changed;
- the command/spec/template files affected;
- verification output from build and runtime verification;
- migration notes when project artifact schema changes.

Avoid:

- hidden behavior changes without command/spec updates;
- broad rewrites of protocol wording without a focused reason;
- generated files, local agent state, project boards, logs, or credentials.
