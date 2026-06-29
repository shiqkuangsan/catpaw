# CatPaw Runtime

CatPaw is a personal AI collaboration runtime: an always-on thin policy, canonical specs, explicit commands, safety-oriented project artifacts, and Expert Council review roles.

Current runtime version: `2.1.5`.

## Quick Start

In your target project, ask your agent:

```text
Please install CatPaw runtime from <catpaw-source-path-or-github-url> and enable CatPaw in the current project.
```

The source can be a local path or a GitHub URL. Users do not need to clone the
repository manually unless they want a local editable copy.

When installing from a source checkout, agents resolve the package source by
building `dist/runtime/` from `src/runtime/`. When installing from an already
built package root, agents copy directly from that root.

Provider-specific guides:

| Provider | Guide |
|---|---|
| Codex | `guides/codex-getting-started.md` |
| Claude Code | `guides/claude-getting-started.md` |
| Cursor | `guides/cursor-getting-started.md` |
| OpenCode | `guides/opencode-getting-started.md` |

AI agents should treat `AI-INSTALL.md` and `commands/*` as the operational
source of truth. The guides are scenario walkthroughs.

## What Gets Installed

| Location | Role | Notes |
|---|---|---|
| `~/.catpaw/` | Global runtime | Installed runtime distribution and agent-facing trusted reference. |
| `<project>/.catpaw/` | Project artifacts | Durable work records for one project. |
| Provider adapter | Agent instructions | Optional global or project declaration, using `snippets/`. |

Do not copy runtime specs, commands, roles, source evidence, or templates into a
project `.catpaw/`. Project-local `.catpaw/` stores only reqs, plans, research,
reviews, tests, lessons, and an active index.

## Runtime Model

```text
CatPaw decides what workflow to run.
superpowers defines how to execute well.
Expert Council provides judgment.
Providers perform the work.
```

CatPaw workflow routing is user-visible. When CatPaw applies to a task, the
agent should state the workflow level (`L0`/`L1`/`L2`/`L3`), the short reason,
artifact expectation, and verification level before doing meaningful work.

Layer boundaries:

| Layer | Professional role | Audience | Contract |
|---|---|---|---|
| Source repo | Versioned upstream / design source | CatPaw maintainers | Defines and evolves CatPaw runtime behavior. |
| Global runtime | Installed runtime distribution / agent-facing trusted reference | CatPaw users and AI agents | Must be self-contained enough for normal use without reading this source repo. |
| Project `.catpaw/` | Project-local artifact board / durable work records | One project team or workspace | Stores only reqs, plans, research, reviews, tests, lessons, and active index. |

Normal CatPaw users should not need this source repo after installation.
Anything required for install, upgrade, project init, migration, routing,
artifact templates, command semantics, or Expert Council roles must be
traceable from the installed runtime at `~/.catpaw/`.

## Project Artifacts

Project-local work artifacts live under each project’s `.catpaw/` directory.

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

`index.md` is active-only, not a historical index. Req files are durable
lifecycle records: they stay in `reqs/` for their whole lifecycle and use YAML
frontmatter (`id`, `type`, `status`, `level`, `priority`, `created`, `updated`,
`closed`) for querying and close-state tracking.

Req paths are identity-stable because req IDs are graph roots for plans,
reviews, tests, and research. Plans may move between `plans/active/` and
`plans/archive/`; req terminal state is represented by frontmatter, not by
`reqs/done/` directories.

## Runtime Package Layout

| Path | Purpose |
|---|---|
| `VERSION` | Runtime version |
| `runtime-manifest.json` | Machine-readable runtime package manifest |
| `AI-INSTALL.md` | AI-facing install, project initialization, and migration guide |
| `CHANGELOG.md` | Human-readable runtime release notes |
| `runtime-policy.md` | Thin always-on routing and safety policy |
| `commands/` | Explicit CatPaw command semantics: release, init, upgrade, migration, registry, provider orchestration, status, artifact health, reconciliation, closeout |
| `guides/` | User-facing getting-started and workflow guides |
| `migrations/` | Per-version project artifact schema delta registry, replayed by `upgrade-project` |
| `specs/` | Full protocol specification |
| `roles/` | Expert Council role definitions |
| `snippets/` | Provider and project adapter declaration templates |
| `templates/` | Project artifact templates |
| `source-evidence/` | Source research and design evidence |
In the source checkout, this runtime package is authored under `src/runtime/`
and generated into `dist/runtime/`. Source-repo `docs/`, `scripts/`, root
bootstrap files, and future resource directories are not part of the installed
runtime distribution.

Per-machine runtime state (not in this repo, not synced):

| Path | Purpose |
|---|---|
| `~/.catpaw/state/projects.json` | Local registry of project boards on this machine. Written by `init-project`, `migrate-project`, `upgrade-project`. Read by `upgrade-runtime`, `registry-doctor`, `unregister-project`. |

## More Detail

- Runtime package architecture: `specs/11-runtime-package.md`
- Workflow levels and routing: `specs/02-workflow-levels.md`
- Project artifact directory: `specs/03-project-directory.md`
- Templates and lifecycle fields: `specs/05-templates.md`
- Status sync and artifact integrity: `commands/status.md`, `commands/doctor.md`, `commands/reconcile.md`, `commands/close.md`
- Runtime release and project upgrade pipeline: `commands/release-runtime.md`, `commands/upgrade-runtime.md`, `commands/upgrade-project.md`, `migrations/README.md`
- Provider CLI orchestration: `commands/provider.md`
- Project board version stamp: `.catpaw/index.md` frontmatter `runtime: x.y.z` records the latest runtime version that has processed the board.
- Global project registry: `specs/03-project-directory.md` §7, `commands/unregister-project.md`, `commands/registry-doctor.md`

## License And Attribution

CatPaw is MIT-licensed in the source repository. It is independent and is not
affiliated with Meituan CatPaw, gstack, Superpowers, or any provider vendor.
See `source-evidence/` for design-inspiration attribution.
