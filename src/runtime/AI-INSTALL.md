# CatPaw AI Install Guide

> For AI agents helping a user install, initialize, or migrate CatPaw from a source checkout or runtime package root.

## Quick Path

- User wants to install CatPaw from a source checkout or package root: follow section 2, then section 3 only if the user wants provider adapter integration.
- User wants to release or prepare a CatPaw runtime source change: follow `commands/release-runtime.md`.
- User wants to upgrade an existing CatPaw runtime: follow section 2 and `commands/upgrade-runtime.md`; by default it also surveys registered project boards from `~/.catpaw/state/projects.json`.
- User wants to upgrade an existing project `.catpaw/` artifact board to the installed runtime stamp: follow `commands/upgrade-project.md`.
- User wants to initialize CatPaw inside a project: follow section 4 here and `commands/init-project.md`.
- User wants to migrate an older CatPaw project layout, such as `todos/`, to `.catpaw/`: follow section 5 here and `commands/migrate-project.md`.
- User wants CatPaw project status, artifact health, reconciliation, or closeout: follow `commands/status.md`, `commands/doctor.md`, `commands/reconcile.md`, or `commands/close.md`.
- User wants to inspect, prune, or remove entries from the global project registry: follow `commands/registry-doctor.md` or `commands/unregister-project.md`.
- User wants the primary agent to call Laoer / `老二` / second opinion, Laosan / `老三` / third opinion, Claude Code, Codex, Gemini, or a subagent: follow `commands/provider.md`.
- Keep global runtime files, per-machine state (`~/.catpaw/state/`), and project-local `.catpaw/` artifacts separate.

## 1. Scope

This guide covers three separate actions:

1. Install a resolved CatPaw runtime package as the user's provider-neutral global CatPaw runtime at `~/.catpaw/`.
2. Initialize a project-local `.catpaw/` artifact board after the runtime exists.
3. Migrate an older project-local CatPaw artifact layout to `.catpaw/`.

Do not mix these targets:

- `~/.catpaw/` stores the runtime package: specs, roles, templates, source evidence, commands, and thin policy.
- `<project>/.catpaw/` stores only project artifacts: reqs, plans, research, reviews, tests, lessons, and index.
- The source repository is maintainer-facing. Installed runtime files are the
  trusted reference for normal CatPaw users and AI agents.

## 2. Global Runtime Install

Before writing files, show the user the target runtime tree and ask for confirmation.

The CatPaw source may be provided as either:

- A local path to a CatPaw source checkout.
- A local path to a generated runtime package root.
- A GitHub URL or other reachable repository URL.

Do not require the user to manually clone CatPaw. If a URL is provided, fetch or
materialize the source as needed, then proceed with the same install rules.

Resolve the runtime package source before copying:

```text
source checkout with src/runtime/runtime-manifest.json
  -> run node scripts/build-runtime.mjs
  -> copy from dist/runtime/

runtime package root with runtime-manifest.json
  -> copy from that root directly
```

If neither shape exists, stop and report that the CatPaw runtime package root
could not be resolved. Do not guess by copying the repository root.

Target tree:

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

Per-machine state created lazily by command runs (not part of install):

```text
~/.catpaw/state/projects.json
```

Rules:

- Use final path name `catpaw`; never add `v4` or version suffixes.
- If `~/.catpaw/` already exists, list existing files before overwriting.
- Do not delete unknown files.
- Do not copy the runtime package into any project `.catpaw/` directory.
- Do not modify `~/.claude/CLAUDE.md` until the user confirms the runtime install target.
- Scan copied files for obvious secrets before reporting completion.

Recommended install behavior:

1. Confirm this repository is the intended CatPaw source.
2. Resolve the runtime package source. For this source repo, run `node scripts/build-runtime.mjs` and use `dist/runtime/`.
3. Preview the target tree.
4. Check whether `~/.catpaw/` exists.
5. Create missing directories.
6. Copy only `canonicalFiles` from the resolved package root: `VERSION`, `runtime-manifest.json`, `README.md`, `AI-INSTALL.md`, `CHANGELOG.md`, `runtime-policy.md`, `commands/`, `guides/`, `migrations/`, `roles/`, `snippets/`, `source-evidence/`, `specs/`, and `templates/`.
7. Verify the copied tree exists.
8. Run a secrets keyword scan over `~/.catpaw/`.
9. Do not create or copy `~/.catpaw/state/` during install; it is per-machine state created on first registry write.

## 3. CLAUDE.md Integration

Only after global runtime install, ask whether to update `~/.claude/CLAUDE.md`.

Before editing `~/.claude/CLAUDE.md`:

- Create a dated backup: `~/.claude/CLAUDE.md.YYYY-MM-DD.bak`.
- Preserve existing user instructions and red lines.
- Add a thin CatPaw reference instead of embedding the full specs.

Suggested snippet:

```markdown
# CatPaw Protocol

Default to `~/.catpaw/runtime-policy.md` for project workflow routing.
Full specs, commands, templates, roles, and source evidence live under `~/.catpaw/`.

Project-local CatPaw artifacts belong in `<project>/.catpaw/` only when the user asks to initialize or use CatPaw for that project.
```

Do not commit, push, create PRs, or publish anything unless the user explicitly asks.

Provider adapter files should reference `~/.catpaw/`; do not install runtime files
under provider-specific directories. Use `snippets/global-adapter.md` for
global provider files such as `~/.claude/CLAUDE.md` or `~/.codex/AGENTS.md`.

## 4. Project-local `.catpaw/` Init

When the user asks to initialize CatPaw in a project, follow `commands/init-project.md`.

For provider-specific zero-to-project flows, use:

- `guides/codex-getting-started.md`
- `guides/claude-getting-started.md`
- `guides/cursor-getting-started.md`
- `guides/opencode-getting-started.md`

Default preview:

```text
.catpaw/
├── index.md
├── reqs/
├── plans/
│   ├── active/
│   └── archive/
├── research/
│   └── misc/
├── reviews/
│   └── archive/
├── tests/
│   └── matrices/
└── lessons.md
```

Rules:

- Show the project-local tree first and wait for confirmation.
- Instantiate only the artifact scaffold.
- Do not copy `specs/`, `roles/`, `source-evidence/`, `commands/`, or uninstantiated templates into the project.
- If the project should opt in through `AGENTS.md` or `CLAUDE.md`, use `snippets/project-adapter.md` as the declaration template.
- If `.catpaw/index.md` or `.catpaw/lessons.md` already exists, read it first and ask before overwriting non-empty content.
- Normal application repositories usually ignore `.catpaw/`; workspace or meta repositories may track it.
- Do not modify `.gitignore` without telling the user exactly what will change.

## 5. Legacy Project Migration

When the user asks to migrate an older CatPaw project layout, follow `commands/migrate-project.md`.

Default behavior:

- Inventory legacy artifacts first, especially `todos/`.
- Create or update only the project-local `.catpaw/` artifact board.
- Preserve legacy artifacts by default; do not delete, move, untrack, or bulk-clean them without a separate confirmation.
- Update project-local guidance so future CatPaw work enters through `.catpaw/index.md`.
- Keep repository git strategy explicit: normal application repositories usually ignore `.catpaw/`; workspace/meta repositories may track it.

## 6. Completion Report

When reporting completion, include:

- Runtime target path, if installed.
- Runtime version, if installed or upgraded.
- Project-board upgrade summary, if `upgrade-runtime` surveyed the registry.
- CLAUDE.md backup path, if edited.
- Project `.catpaw/` path, if initialized.
- Legacy paths preserved, if migrated.
- Files written or changed.
- Verification evidence, including tree check and secrets scan result.

For project status or closeout work, also include:

- Current status and next recommended action.
- Artifact consistency findings, if any.
- Whether changes were dry-run only or applied.
- Remaining user decisions.

For init/migrate/upgrade-project work, also include:

- Whether the board was added or upserted in `~/.catpaw/state/projects.json`, and the resulting `stamp`.
