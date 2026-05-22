# 12. Runtime Install and Migration Checklist

> Status: draft · Last updated: 2026-05-22

This checklist covers CatPaw runtime install/upgrade and legacy project artifact
migration. It is the long-lived operating checklist and does not depend on early
draft paths.

## 1. Target

Final global runtime directory:

```text
~/.catpaw/
```

Final project artifact directory:

```text
<project>/.catpaw/
```

Use only `CatPaw` / `catpaw` naming. Do not use historical version suffixes.

## 2. Preflight

Before installing or upgrading runtime:

- [ ] Current source repo worktree is clean, or the exact migration-prep files are known.
- [ ] Unrelated untracked files such as local agent files are not included in migration commits.
- [ ] Confirm that the operation is not creating a project `.catpaw/` unless the user explicitly requested project artifact initialization.
- [ ] Confirm whether the operation updates only `~/.catpaw/` or also modifies provider adapters such as `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`, or Cursor rules.

## 3. Backup Rules

If modifying provider adapter files, back them up first according to user/global
rules. Example:

```text
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.YYYY-MM-DD.bak
```

Backup retention:

- Keep at most three date-suffixed backups.
- Remove the oldest beyond three.
- A legacy `CLAUDE.md.bak` baseline snapshot does not count toward the quota and is not deleted.

If only creating/updating `~/.catpaw/`, provider adapter backups are not needed,
but the target file tree should still be listed before writing.

## 4. Canonical File Source

Runtime file mapping is manifest-first:

- Source checkout maintains runtime files under `src/runtime/`.
- `src/runtime/runtime-manifest.json` lists `canonicalFiles`.
- `scripts/build-runtime.mjs` generates `dist/runtime/` from the manifest.
- Install/upgrade copies only manifest-declared files from the resolved package root to `~/.catpaw/`.

Do not maintain a second full file map in this checklist. Directory semantics
live in `specs/11-runtime-package.md`.

## 5. Runtime Directory Preview

Before migration, show the resolved package root and `~/.catpaw/` target summary:

```text
Package root: <path>
Target: ~/.catpaw/
Version: <VERSION>
Canonical entries: <count from runtime-manifest.json>
```

If detailed tree output is needed, generate it from the resolved package root
live rather than copying a static tree into this checklist.

## 6. Migration Steps

Safe migration order:

1. Show runtime directory preview and confirm the write target.
2. Resolve runtime package root: for a source checkout, run `node scripts/build-runtime.mjs` and use `dist/runtime/`; for an already-built package root, use the root that contains `runtime-manifest.json`.
3. Check whether `~/.catpaw/` exists.
4. If it exists, list current files first and do not overwrite unknown content blindly.
5. Create missing directories.
6. Copy only `canonicalFiles` listed in `runtime-manifest.json`.
7. Confirm that `README.md` and `runtime-policy.md` were synced.
8. Run a tree check on `~/.catpaw/`.
9. Run a secrets keyword scan on `~/.catpaw/`.
10. Do not modify provider adapters unless the user explicitly enters that phase.
11. If provider adapter modification is authorized, apply Backup Rules first, then merge the thin declaration from `snippets/global-adapter.md`.

## 7. Provider Adapter Integration

Provider adapters should keep only a thin CatPaw entrypoint. They should not
embed the full spec.

Reference snippets:

```text
~/.catpaw/snippets/global-adapter.md
~/.catpaw/snippets/project-adapter.md
```

Do not paste full `runtime-policy.md` into provider adapters; it makes global
prompts too heavy.

## 8. Project Init Gate

Before initializing any `<project>/.catpaw/`, preview the structure and wait for
user confirmation. Authoritative structure is defined by
`specs/03-project-directory.md` and `commands/init-project.md`.

## 9. Legacy Project Migration

When migrating an older `todos/` layout to current `.catpaw/`, use
non-destructive migration by default:

1. Inventory old structures read-only: `todos/`, `.catpaw/`, `README.md`, `.gitignore`, git repo status, and whether old artifacts are tracked.
2. Create current `.catpaw/` scaffold; do not copy the `~/.catpaw/` runtime package.
3. Keep old `todos/` as legacy reference by default; do not move, delete, or bulk-clean it.
4. Do not migrate root-level legacy index files one-to-one; extract only active work, reusable lessons, and durable archive artifacts.
5. Copy archived plans with decision value into `.catpaw/plans/archive/`, preserving original files.
6. Empty directories are not migration results; use `.gitkeep` only when an empty directory must be tracked.
7. Update README active CatPaw entrypoint from `todos/` to `.catpaw/index.md`, and state that legacy `todos/` must not be deleted without confirmation.
8. Choose `.gitignore` strategy by repo type: ordinary business/app repos ignore `.catpaw/`; workspace/meta repos may track `.catpaw/`.
9. If migration exposes runtime policy / command inconsistencies, fix runtime first, then continue.
10. Deleting old `todos/`, git untrack, or bulk cleanup is destructive cleanup and must list targets and receive explicit confirmation.

Legacy path mapping:

| Legacy path | Current handling |
|---|---|
| `todos/plan.md` | Do not copy directly; write active work into `.catpaw/index.md` or an active plan |
| `todos/reqs.md` | Do not copy directly; split valuable reqs into `.catpaw/reqs/<req-id>-<slug>.md` |
| `todos/tests.md` | Do not copy directly; write useful verification into plan or `.catpaw/tests/matrices/<req-id>-<slug>.md` |
| `todos/lessons.md` | Migrate only reusable corrections into `.catpaw/lessons.md` |
| `todos/plans/active/*` | Copy to `.catpaw/plans/active/`, adding req ID when needed |
| `todos/plans/archive/*` | Copy to `.catpaw/plans/archive/` when it has decision value |
| `todos/research/*` | Copy to `.catpaw/research/<topic>/overview.md` or `.catpaw/research/misc/` when reusable |

## 10. Runtime Change Pipeline

When adding or changing CatPaw runtime capability, use this order:

1. Use `commands/release-runtime.md` to classify the change: docs-only / command semantics / runtime policy / artifact schema / provider adapter / install layout.
2. Update `src/runtime/` source package: `VERSION`, `runtime-manifest.json`, `CHANGELOG.md`, and related commands / specs / templates / guides / snippets / migrations.
3. Decide whether a migration note is needed. Artifact schema, provider adapter, install layout, or project-upgrade behavior changes require one.
4. If the release changes project artifact schema/layout/required content, add `migrations/<version>.md`; otherwise the release is incomplete.
5. Run source verification: `git diff --check`, `node scripts/build-runtime.mjs`, manifest parse, command files exist, secrets scan, conflict marker scan.
6. Commit / push only when explicitly requested by the user.
7. Sync `~/.catpaw/` through `commands/upgrade-runtime.md` only when explicitly requested by the user.
8. For existing projects, prefer registry-aware project survey through `commands/upgrade-runtime.md`; single projects may still run `commands/upgrade-project.md --dry-run`. `upgrade-project` replays all existing `migrations/<version>.md` from stamp to installed runtime; if there is no schema migration, it performs a stamp-only upgrade.

`release-runtime` owns release discipline. `upgrade-runtime` owns global runtime
sync and registry project orchestration. `upgrade-project` owns one project's
artifacts. `migrations/` owns project schema deltas. Do not mix their
responsibilities.

## 11. Non-goals

This migration does not:

- use historical version suffixes for runtime or project artifact directories;
- copy the full spec into every project;
- modify a business project repo unless the user explicitly requested project init;
- automatically modify `.gitignore`;
- automatically commit, push, or create PRs;
- enable hooks;
- install or integrate gstack.
