# 11. Runtime Package

> Status: draft · Last updated: 2026-05-22

This file defines the CatPaw global runtime package: where the full protocol
lives, how agents/providers reference it, and what project initialization copies.

## 1. Principle

CatPaw runtime shape:

```text
CatPaw = installed runtime distribution + always-on thin policy + full specs + explicit commands + safety hooks
```

Locations:

```text
provider adapter (for example ~/.claude/CLAUDE.md, ~/.codex/AGENTS.md, Cursor Rules, ~/.config/opencode/AGENTS.md)
  -> thin CatPaw reference

~/.catpaw/
  -> full runtime reference / runtime assets

~/.catpaw/commands/
  -> explicit operation semantics

hooks
  -> safety guardrails only
```

Principles:

- Provider adapters contain only the thin always-on declaration needed at runtime.
- `~/.catpaw/` is the user's trusted global runtime reference.
- The CatPaw source repo is versioned upstream / design source; normal use after install should not require reading the source repo.
- Project `<project>/.catpaw/` stores project artifacts only and never receives the full runtime package.
- Commands are explicit entrypoints, not a separate source of truth.
- Hooks are safety guardrails, not the workflow brain.

## 2. Source Repository Structure

The source repo root is not the runtime package root. It may contain maintainer
docs, build scripts, generated output, tests, and future resources without
making those files part of the installed runtime.

```text
catpaw/
├── src/
│   └── runtime/      # authored runtime package source
├── scripts/          # source-repo build and verification tooling
├── docs/             # maintainer-only docs and ADRs
└── dist/
    └── runtime/      # generated runtime package root, ignored by git
```

Rules:

- `src/runtime/runtime-manifest.json` declares the runtime package source.
- `canonicalFiles` paths are relative to `src/runtime/`, not the source repo root.
- `scripts/build-runtime.mjs` builds `dist/runtime/` from `src/runtime/`.
- Install / upgrade copies from a resolved runtime package root: `dist/runtime/` for a source checkout, or a provided path that already contains `runtime-manifest.json`.
- Source-repo `docs/`, `scripts/`, root bootstrap files, `.git/`, and future resource directories are not copied to `~/.catpaw/`.

## 3. Global Runtime Package Structure

`runtime-manifest.json` is the authority for the installed runtime tree.
`canonicalFiles` is the canonical file list; do not maintain another full tree
by hand in prose.

Package categories:

- core metadata: `VERSION`, `runtime-manifest.json`, `README.md`, `CHANGELOG.md`;
- thin always-on policy: `runtime-policy.md`;
- operation runbooks: `commands/`;
- full protocol reference: `specs/`;
- artifact templates: `templates/`;
- Expert Council prompts: `roles/`;
- provider adapter snippets and walkthroughs: `snippets/`, `guides/`;
- project schema upgrades: `migrations/`;
- historical source evidence: `source-evidence/`.

## 4. Directory Semantics

Paths are relative to the runtime package root: `src/runtime/` while authoring,
`dist/runtime/` after build, and `~/.catpaw/` after install.

| Path | Meaning | Normally always in context? |
|---|---|---|
| `VERSION` | Runtime version | No; read during install/upgrade |
| `runtime-manifest.json` | Runtime package manifest | No; read during install/upgrade/verification |
| `README.md` | Runtime package entrypoint and navigation | No |
| `AI-INSTALL.md` | AI-facing install / update / project init / legacy migration guide | No; read during install, update, init, migration |
| `CHANGELOG.md` | Release notes | No; read during upgrade assessment |
| `runtime-policy.md` | Thin runtime policy suitable for provider adapters | Yes |
| `specs/` | Full CatPaw protocol reference | No; read as needed |
| `templates/` | Req / plan / review / test matrix / lesson templates | No; read when creating artifacts |
| `roles/` | Expert Council role prompts | No; read during formal review or explicit role use |
| `snippets/` | Provider / project adapter templates | No; read during adapter integration |
| `guides/` | User getting-started and workflow guides | No; read when onboarding or asked |
| `source-evidence/` | gstack / Superpowers source evidence | No; read for traceability |
| `migrations/` | Per-version project artifact schema deltas, replayed by `upgrade-project` | No; read during project upgrades |
| `commands/` | Command semantics / runbook drafts | No; read by command entrypoint |

Local machine state is not part of the runtime package and is not copied,
deleted, overwritten, or distributed:

| Path | Purpose |
|---|---|
| `~/.catpaw/state/projects.json` | Local registry of known project boards, runtime stamps, and recent activity |

## 5. Thin Policy vs Full Spec

`runtime-policy.md` keeps only the minimum always-on rules:

- CatPaw layer boundaries.
- Start-of-task classification: Intent -> Level -> Lifecycle/subsystem -> Role routing -> Artifact -> Verification.
- Minimum L0/L1/L2/L3 triggers.
- `Global spec, local artifacts`.
- Git, external-action, and destructive-operation safety gates.
- Conflict resolution for execution methodology and Expert Council recommendations.

It does not include:

- full design background;
- gstack / Superpowers source evidence;
- full role prompts;
- long templates;
- history and rejected alternatives.

## 6. Project Init Behavior

Before initializing `<project>/.catpaw/`, preview the structure and wait for
user confirmation. The directory name is always `.catpaw/`, with no version
suffix.

Init semantics:

```text
Read from ~/.catpaw/
Instantiate into <project>/.catpaw/
```

The default project board structure is defined by
`specs/03-project-directory.md` and `commands/init-project.md`. This file only
defines the boundary: project `.catpaw/` is an artifact board and must not
receive runtime package files.

Do not copy:

- `specs/`;
- `roles/`;
- `snippets/`;
- `source-evidence/`;
- `commands/`;
- uninstantiated templates.

Exception: for an explicit offline archive or team fork, create:

```text
.catpaw/_spec-snapshot/
```

This is not default init behavior.

## 7. Command Drafts

`commands/` stores command semantics without requiring a bound implementation.

| Command | Purpose |
|---|---|
| `init-project` | Initialize the current project's `.catpaw/` artifact directory |
| `migrate-project` | Migrate older artifact layouts such as `todos/` to `.catpaw/` |
| `upgrade-runtime` | Install/upgrade global runtime to `~/.catpaw/`, then survey or apply registered project-board upgrades |
| `release-runtime` | Prepare runtime source changes for release and decide migration notes, global upgrade, and project impact |
| `upgrade-project` | Dry-run/apply project board upgrades to installed runtime expectations and upsert registry |
| `unregister-project` | Remove a board entry from `~/.catpaw/state/projects.json` without touching board files |
| `registry-doctor` | Dry-run/apply/discover registry consistency checks and stale-entry pruning |
| `classify` | Classify current request by intent and level |
| `plan` | Generate req / plan / verification record |
| `provider` | Orchestrate external providers via CLI/native subagent for ask/discuss/debug/review/implement/summarize |
| `review` | Call Expert Council roles and write review summary |
| `status` | Report active work, blockers, verification state, and next recommended action |
| `doctor` | Read-only scan of `.catpaw/` artifact graph consistency |
| `reconcile` | Dry-run/apply low-risk derived status and link fixes |
| `close` | Dry-run/apply closeout for one req: clean index, archive plan, update links/status |

Rules:

- Commands do not own independent rules; they call `runtime-policy.md` and `specs/`.
- Commands do not automatically commit, push, create PRs, or deploy.
- Commands do not bypass user confirmation.

## 8. Runtime Assembly Order

Recommended source checkout workflow:

1. Edit `VERSION`, `runtime-manifest.json`, `README.md`, `AI-INSTALL.md`, `CHANGELOG.md`, and `runtime-policy.md` under `src/runtime/`.
2. Maintain runtime-facing content under `src/runtime/specs/`, `roles/`, `templates/`, `source-evidence/`, `commands/`, `guides/`, `snippets/`, and `migrations/`.
3. Run `node scripts/build-runtime.mjs` to generate `dist/runtime/`.
4. Copy `canonicalFiles` from `dist/runtime/` or another resolved package root to `~/.catpaw/`.
5. After backing up provider adapters, merge the thin CatPaw reference from `~/.catpaw/snippets/global-adapter.md`.
6. Add hooks only after the runtime is stable.

## 9. Non-goals

CatPaw does not:

- embed the full CatPaw spec into provider adapter files;
- copy the full CatPaw spec into every project;
- install gstack commands or automation chains;
- let hooks perform workflow routing;
- rewrite execution-methodology or provider behavior during migration.
