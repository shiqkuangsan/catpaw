# CatPaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatPaw is a lightweight workflow runtime for coding agents. It keeps one
development lifecycle, selects the lightest safe operating mode, records only
durable project facts, and uses executable checks for mechanical consistency.

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

Source runtime version: `3.3.0`. Project boards use **board schema 2**.

Activation is machine-local. A source checkout cannot declare the installed
runtime current or pending for every machine: compare it with
`node scripts/verify-runtime.mjs`. An older or missing installation is
`pending activation`; a matching verified installation is current. Building
source does not automatically install, apply, or migrate CatPaw.

Repository: https://github.com/shiqkuangsan/catpaw

## Core Model

### Modes

| Mode | Use when | Durable records |
|---|---|---|
| `Direct` | Work is narrow, local, reversible, and low risk | None by default; still verify and report |
| `Tracked` | Work spans steps or files, changes shared behavior, or needs continuity | Work Item + Plan, with Evidence when useful |
| `Gated` | Work affects security, release, migration, external systems, destructive operations, or high-impact contracts | Work Item + Plan + required Independent Check and Evidence |

CatPaw starts with the lightest safe mode and upgrades it when scope or risk
grows. A mode never grants permission for an external or destructive action.

### Work Board

Project state lives in `<project>/.catpaw/`:

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
```

Schema 2 has five artifact kinds:

| Artifact | Purpose |
|---|---|
| Index | Current board dashboard and schema marker |
| Milestone | Optional phase objective spanning several Work Items |
| Work Item | Smallest durable, independently verifiable unit of work |
| Plan | Work-bound contracts, steps, acceptance, and verification |
| typed Evidence | `research`, `review`, `test`, `provider`, or `reflection` facts |

Schema 1 migration may also create `legacy/schema-1/`. It is a checksummed,
read-only migration archive, not a sixth artifact kind; normal schema 2 status,
doctor, and mutation commands ignore it.

Migration is zero-touch for ordinary users: CatPaw infers missing legacy
metadata from explicit facts, canonical structure, scoped prose, and artifact
relationships, while preserving every original file for audit and rollback.

Direct work normally stays in the conversation. Tracked and Gated work use the
board when durable coordination adds value.

### Judgment

CatPaw separates three concerns:

- **Lens**: what professional perspective is needed.
- **Agent**: who performs work or supplies judgment.
- **Independent Check**: when a non-primary view is recommended or required.

The five Lens cards are Value & Scope, System & Contracts, Experience,
Security, and Performance. Engineering, review, testing, shipping, debugging,
and reflection remain lifecycle methods instead of a second role hierarchy.
CatPaw owns compact root-cause Debugging and risk-triggered RED/GREEN guidance;
it does not require a universal meta-skill or design-approval ritual.

Agent dispatch is risk-based. Each delegated call receives a bounded Task
Envelope and one temporary capability: Scout, Builder, Reviewer, or Verifier.
Parallel calls require independent mutable scope and composable outputs;
available capacity alone is not a reason to dispatch. These prompt contracts do
not create a new role hierarchy or board artifact.

The only directly callable external Agents managed by CatPaw are `cc` (Claude
Code) and `cx` (Codex). OpenCode may host CatPaw instructions, but it is not a
direct invocation target. Current-tool subagents remain the preferred
low-cost option for bounded independent work.

## Hybrid Runtime

The runtime has three behavior surfaces:

| Surface | Responsibility |
|---|---|
| Always-on Rules | Compact routing, safety, progress, and authority rules |
| On-demand Guidance | Workflow, Agent dispatch, engineering methods, Milestones, Independent Checks, Lens cards, and Agent recipes |
| Executable Tools | Board graph, schema validation, dry-run patches, migration, and observable Agent sessions |

Its storage and activation chain is separate:

```text
source -> dist -> installed -> project board
```

Agents make contextual decisions, the CLI records and verifies deterministic
state, and users authorize writes or external effects. See the
[Hybrid Runtime decision](docs/decisions/0019-catpaw-3-hybrid-runtime.md).

## Quick Start From Source

```bash
git clone https://github.com/shiqkuangsan/catpaw.git
cd catpaw
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

The build creates `dist/runtime/` from
[`src/runtime/runtime-manifest.json`](src/runtime/runtime-manifest.json).
Verification checks source and dist, exercises the CLI on a temporary board,
and reports an older installed runtime as `pending activation` by default.

To install or upgrade after explicit approval, start with
[`AI-INSTALL.md`](AI-INSTALL.md). Runtime installation, adapter activation, and
each project board migration are separate actions.

## CLI

The generated or installed runtime exposes:

```text
catpaw board init|status|doctor|migrate
catpaw work start|close
catpaw milestone start|add|close
catpaw evidence add
catpaw agent check|open|send|status|read|close
```

Here `catpaw` is shorthand for the executable entrypoint: use
`src/runtime/bin/catpaw.mjs` in a source checkout or
`~/.catpaw/bin/catpaw.mjs` after installation. CatPaw does not add a command to
`PATH`; a user-managed alias or symlink is a separate, explicit choice.

Board mutations default to dry-run and require explicit `--apply`. Agent
session status reports observable facts such as open/closed, changed/stable,
and explicit waiting text; it does not infer completion.

## Repository Layout

```text
catpaw/
├── src/runtime/   # Versioned runtime source
├── scripts/       # Build and verification tooling
├── tests/         # Executable contracts
├── docs/          # Maintainer rationale and decisions
└── dist/runtime/  # Generated package, ignored by git
```

Runtime users follow [`src/runtime/runtime-policy.md`](src/runtime/runtime-policy.md).
Maintainers can start with [`docs/README.md`](docs/README.md). Contributors
should read [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Safety Boundaries

- Runtime files install only under `~/.catpaw/`; project boards contain only
  project artifacts.
- Thin host adapters reference CatPaw without copying the runtime.
- Agent output and CLI results are evidence, not authorization.
- In an authorized change/build task, the primary integration owner may create
  a non-protected local task branch/worktree and commit only task-owned changes
  after exact review, verification, and a credential scan.
- A current-tool Builder may create one local slice commit only under an exact
  Task Envelope opt-in bound to an exclusive isolated worktree, dedicated
  non-protected branch/base, exact scope, verification, diff review, and secret
  scan. The primary remains the sole integration owner.
- Scout, Reviewer, Verifier, non-opted-in subagents, and external Agents must
  not stage or commit; current `cc`/`cx` profiles remain read-only.
- Push, pull request, deploy/publish, any protected/base branch update (direct
  commit, merge, cherry-pick, fast-forward), history rewrite, force,
  destructive Git/cleanup, secret access, permission expansion, and other
  external or irreversible effects require explicit authorization.

CatPaw is not affiliated with any model vendor or similarly named product. See
[`NOTICE.md`](NOTICE.md) for attribution.

## License

MIT. See [`LICENSE`](LICENSE).
