# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw is an AI workflow runtime for software projects. It gives coding agents a
small operating protocol: classify the work, expose the workflow level, keep
durable project artifacts, call expert roles when risk justifies it, and close
the loop with verification.

It is deliberately not an IDE, model provider, prompt pack, or task runner.
CatPaw is the coordination layer between a user, their AI agents, and each
project's durable work records.

Repository: https://github.com/shiqkuangsan/catpaw

Status: early public runtime. The protocol is usable, intentionally small, and
still evolving.

## Why It Exists

AI coding sessions fail in familiar ways: decisions disappear between sessions,
plans drift from implementation, reviews happen too late, and "done" often means
"the agent stopped talking." CatPaw turns that implicit collaboration into a
small set of visible contracts.

```text
CatPaw decides what workflow to run.
superpowers defines how to execute well.
Expert Council provides judgment.
Providers perform the work.
```

## What You Get

| Surface | Purpose |
|---|---|
| `~/.catpaw/` | The installed runtime: policy, specs, commands, templates, roles, migrations, guides. |
| `<project>/.catpaw/` | A project board: reqs, plans, research, reviews, tests, lessons, and active status. |
| Provider adapter | A thin global or project instruction that tells an agent to load CatPaw when relevant. |
| Registry | Local machine state at `~/.catpaw/state/projects.json` for batch project upgrades and health checks. |

Core capabilities:

- User-visible workflow classification: `L0` / `L1` / `L2` / `L3`.
- Artifact board for cross-session project memory.
- Runtime commands for init, migration, upgrade, status, doctor, reconcile,
  closeout, provider routing, planning, and review.
- Expert Council roles for product, architecture, engineering, design, QA,
  security, performance, release, debugging, and retrospectives.
- Manifest-first build and verification scripts for runtime releases.

## Quick Start

Ask your coding agent:

```text
Install CatPaw from https://github.com/shiqkuangsan/catpaw and enable it in this project.
```

For a local checkout:

```bash
git clone https://github.com/shiqkuangsan/catpaw.git
cd catpaw
node scripts/build-runtime.mjs
```

Then point the agent at root `AI-INSTALL.md`. The full runtime guide lives at
`src/runtime/AI-INSTALL.md`.

## How CatPaw Routes Work

| Level | Use when | Default artifact behavior |
|---|---|---|
| `L0` | Tiny, clear, local change | No CatPaw files. Execute, verify, report. |
| `L1` | Standard single-module work | Usually no files. Use a light plan and inline verification. |
| `L2` | Cross-module, uncertain, architectural, API, persistence, performance, or complex UI work | Write req + plan + verification record. Use focused review when needed. |
| `L3` | Security, migration, release, CI/CD, destructive ops, large refactor, incident, PR final review | Write req + plan + test matrix + formal review. Require explicit gates. |

When CatPaw applies, the agent should say something like:

```text
CatPaw dispatch: L2 — cross-module behavior change.
Artifacts: req+plan. Roles: Architecture Reviewer.
Verification: record. Next: inspect current flow.
```

## Repository Layout

The source checkout is shaped like a normal project:

```text
catpaw/
├── src/runtime/   # Authored runtime package source
├── scripts/       # Source-repo build and verification tooling
├── docs/          # Maintainer-only design notes and ADRs
└── dist/runtime/  # Generated runtime package, ignored by git
```

The installed runtime still lives at `~/.catpaw/`. Project-local CatPaw boards
still live at `<project>/.catpaw/`.

## Runtime Source

Runtime-facing files are authored under `src/runtime/`:

- `src/runtime/VERSION`
- `src/runtime/runtime-manifest.json`
- `src/runtime/AI-INSTALL.md`
- `src/runtime/runtime-policy.md`
- `src/runtime/commands/`
- `src/runtime/specs/`
- `src/runtime/templates/`
- `src/runtime/roles/`
- `src/runtime/snippets/`
- `src/runtime/guides/`
- `src/runtime/migrations/`
- `src/runtime/source-evidence/`

The manifest's `canonicalFiles` paths are relative to `src/runtime/`, not to
the repository root.

## Build And Verify

Generate the installable runtime package:

```bash
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

`build-runtime.mjs` writes `dist/runtime/` from
`src/runtime/runtime-manifest.json` and verifies that every declared command
file exists.
`verify-runtime.mjs` checks the source package, generated package, installed
runtime when present, protocol invariants, and registered project board stamps.

Inspect a project board from the source checkout:

```bash
node scripts/catpaw-project.mjs status --project /path/to/project
node scripts/catpaw-project.mjs doctor --project /path/to/project
node scripts/catpaw-project.mjs doctor --project /path/to/project --json
```

`catpaw-project.mjs` is read-only. It builds a lightweight project artifact
graph from `.catpaw/`, reports active work, and flags closeout or registry stamp
drift before any future reconcile or close command writes files.

Active work is presented as an `ID / Title / Status / Links` table so users can
scan the current item and jump directly to Req, Plan, Tests, Review, or Research
artifacts.

## Install / Upgrade

For AI-assisted install or upgrade from this source checkout, start with:

```text
AI-INSTALL.md
```

That file is a source-repo bootstrap. The full runtime install guide lives at:

```text
src/runtime/AI-INSTALL.md
```

Do not copy repository-root `docs/`, `scripts/`, `.git/`, or future resource
directories into `~/.catpaw/`.

## Design Boundaries

- Global spec, local artifacts: runtime files live once under `~/.catpaw/`;
  project boards contain project work records only.
- CatPaw may route to superpowers-style execution methods, but CatPaw owns the
  artifact paths and safety gates.
- Expert Council roles are advisory. They never authorize commits, pushes, PRs,
  deploys, or destructive operations automatically.
- gstack and Superpowers are design inspirations, not bundled runtime
  dependencies.

## Relationship To Other Projects

CatPaw was influenced by public AI workflow systems such as gstack and
Superpowers, but it does not vendor them or require them at runtime. See
`NOTICE.md` and `src/runtime/source-evidence/` for attribution and design
evidence.

CatPaw is not affiliated with Meituan CatPaw, gstack, or Superpowers.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short:

```bash
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

Runtime behavior changes should update the relevant command/spec/template files,
`src/runtime/CHANGELOG.md`, and the runtime version when appropriate.

## License

MIT. See `LICENSE`.
