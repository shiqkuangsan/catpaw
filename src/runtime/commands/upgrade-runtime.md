# catpaw:upgrade-runtime

Install or upgrade the global CatPaw runtime from a CatPaw source checkout, generated runtime package root, or reachable source URL.

## Default Mode

Default behavior is:

```text
sync global runtime -> verify runtime -> survey registered project boards
```

Project-board survey is dry-run by default. It reports what would happen across
`~/.catpaw/state/projects.json` but does not modify any project `.catpaw/`
directory unless `--apply-projects` is explicitly requested.

```text
catpaw:upgrade-runtime
catpaw:upgrade-runtime --runtime-only
catpaw:upgrade-runtime --apply-projects
catpaw:upgrade-runtime --discover-projects [root]
```

## Rule

`~/.catpaw` is the only canonical global runtime path. Do not install runtime
files under provider-specific directories.

Do not delete project-local `.catpaw/` artifacts. They are project data, not
runtime files.

`upgrade-runtime` may orchestrate project-board upgrades through the registry,
but it does not own project data. It delegates project writes to
`catpaw:upgrade-project --apply` and only for boards that are unblocked.

## Preflight

- Confirm the intended source repository, source checkout, or reachable source URL.
- Resolve the runtime package source:
  - If `src/runtime/runtime-manifest.json` exists, treat the path as a source checkout, run `node scripts/build-runtime.mjs`, and use `dist/runtime/`.
  - If `runtime-manifest.json` exists, treat the path as an already-built runtime package root.
  - If neither exists, stop and report that the runtime package root could not be resolved.
- Read `VERSION` and `runtime-manifest.json` from the resolved package root.
- Check whether `~/.catpaw/` exists.
- If `~/.catpaw/VERSION` exists, compare it to source `VERSION`.
- If the installed runtime is newer than source, stop and report.
- If versions match, sync only when source and runtime files differ.
- If `~/.catpaw/` does not exist, perform a fresh runtime install.

## Target Tree

```text
~/.catpaw/
├── VERSION
├── runtime-manifest.json
├── README.md
├── AI-INSTALL.md
├── CHANGELOG.md
├── runtime-policy.md
├── commands/
├── guides/
├── migrations/
├── roles/
├── snippets/
├── source-evidence/
├── specs/
└── templates/
```

## Behavior

- Copy only runtime package files listed in the resolved package root's `runtime-manifest.json`.
- Do not copy `.git/`, source-repo `docs/`, `scripts/`, `assets/`, provider config, local worktrees, or project artifacts.
- Do not modify provider adapter files such as `~/.claude/CLAUDE.md` unless the user explicitly asks.
- Do not create symlinks by default.
- Do not keep or create provider-specific runtime copies.
- Run a tree check after sync.
- Run a secrets keyword scan after sync.

## Project Runtime Target Version

Project boards track the installed runtime version that last processed them.
Their `.catpaw/index.md` `runtime:` stamp must advance to `~/.catpaw/VERSION`
after `upgrade-project --apply`, even when the release has no project schema
migration.

Migration files still control artifact schema rewrites:

```text
migrations replayed = migrations/<version>.md where project stamp < version <= installed runtime VERSION
```

If no migration files exist in the version range, the project upgrade is
stamp-only: update `.catpaw/index.md` `runtime:` and the registry stamp, but do
not rewrite other project artifacts.

Examples:

- Installed runtime `1.4.2`, latest migration `1.3.0`, board stamp `1.3.0` -> stamp-only upgrade to `1.4.2`.
- Installed runtime `1.5.0`, `migrations/1.5.0.md` exists -> replay that migration and stamp `1.5.0`.

This keeps the user's goal simple: after a runtime upgrade, all unblocked
registered projects can report that they are on the latest runtime.

## Project Board Orchestration

After global runtime sync and verification, unless `--runtime-only` is set:

1. Read `~/.catpaw/state/projects.json`.
2. Set the project runtime target to `~/.catpaw/VERSION`.
3. For each registered board:
   - If `boardPath` is missing, report `missing board`; suggest `catpaw:unregister-project`.
   - If registry stamp and board `index.md` stamp disagree, report `stamp mismatch`; do not auto-resolve.
   - If board stamp equals the installed runtime, report `current`.
   - If board stamp is older than the installed runtime, run `catpaw:upgrade-project --dry-run` for that board.
4. Group results:
   - `Current`
   - `Will update`
   - `Needs user decision`
   - `Blocked`
   - `Missing`
   - `Stamp mismatch`

When `--apply-projects` is explicitly requested:

- First run the dry-run survey.
- Apply only boards in `Will update` with no user decisions, no missing board,
  no stamp mismatch, no major-version break, and no doctor-style blocker.
- Leave all blocked or ambiguous boards untouched and report the exact reason.
- Never delete board files.
- Never commit, push, create PRs, deploy, or perform destructive cleanup.

`--discover-projects [root]` may append a registry-doctor style discovery
section. Discovered boards are reported only; they are not auto-registered by
`upgrade-runtime`.

## Project Survey Output

Use this shape:

```text
Installed runtime:
Project runtime target:
Registry path:
Total registered:

Current:
Will update:
Needs user decision:
Blocked:
Missing:
Stamp mismatch:
Discovered:

Applied:
Skipped:
Next recommended action:
Needs user decision:
```

## Completion Report

Report:

- Source version and resolved package root.
- Installed runtime path.
- Files copied or updated.
- Verification commands and results.
- Project runtime target version.
- Project-board survey/apply summary.
- Any provider adapter files that still reference an old runtime path.
