# AGENTS.md

This repository is the versioned source for CatPaw 3.4.1 Hybrid Runtime.

## Repository Role

- Authored runtime files live under `src/runtime/`.
- `dist/runtime/` is generated from the source manifest and is not committed.
- The installed runtime lives at `~/.catpaw/` and remains the trusted runtime
  for ordinary projects until an explicit activation succeeds.
- Project-local `.catpaw/` directories are schema 2 artifact boards, not
  runtime package copies.
- Source, dist, installed runtime, and project boards are separate surfaces.
  Do not describe a source build as an installation or project migration.
- Do not install or apply the source runtime unless explicitly requested.

The current source may be newer than the installed runtime. Treat that state as
`pending activation`, not as a failure and not as global activation.

## Runtime Authorities

Read the smallest canonical source that owns the operation:

| Need | Authority |
|---|---|
| Always-on routing, progress, safety | `src/runtime/runtime-policy.md` |
| Work handling and internal risk selection | `src/runtime/guidance/workflow.md` |
| Agent intents, bounded delegation, advisory orchestration and concurrency | `src/runtime/guidance/agent-dispatch.md` |
| Root-cause debugging and RED/GREEN | `src/runtime/guidance/engineering-methods.md` |
| Subagent triggers, fallback, accepted gaps | `src/runtime/guidance/independent-checks.md` |
| Multi-Work phase objectives | `src/runtime/guidance/milestones.md` |
| Runtime, adapter, registry, legacy import | `src/runtime/guidance/maintenance.md` |
| External Agent recipes and sessions | `src/runtime/providers/README.md` |
| Board metadata contract | `src/runtime/schemas/board-v2.json` |
| Executable board and Agent operations | `src/runtime/bin/catpaw.mjs` |
| Install and project activation boundary | `src/runtime/AI-INSTALL.md` |

Maintainer rationale lives in `docs/`. It explains decisions but does not
override runtime authorities.

## Runtime Package

`src/runtime/runtime-manifest.json` declares the installable package. Its
canonical entries are relative to `src/runtime/` and currently cover:

```text
VERSION
runtime-manifest.json
README.md
AI-INSTALL.md
CHANGELOG.md
runtime-policy.md
bin/
catalog/
guidance/
lenses/
lib/
migrations/
providers/
schemas/
snippets/
templates/
```

When runtime behavior, schema, install layout, or Agent invocation changes,
check whether `src/runtime/VERSION`, `src/runtime/CHANGELOG.md`,
`src/runtime/runtime-manifest.json`, build verification, and migrations also
need updates.

## Operational Routing

- For source install or upgrade requests, read root `AI-INSTALL.md`, then
  `src/runtime/AI-INSTALL.md` and `src/runtime/guidance/maintenance.md`.
- For board init, status, doctor, schema migration, Work, Milestone, Proof,
  or Agent sessions, inspect the CLI entrypoint and the matching guidance.
- All board mutations default to dry-run and require explicit `--apply`.
- Runtime activation, adapter merge, registry mutation, and each project board
  migration are independent authorization scopes.
- A legacy project tree must be inventoried and preserved unless the user
  separately authorizes exact cleanup targets.

CatPaw-managed reciprocal external transports are limited to read-only `cc` and
`cx` profiles; they are not the primary agent's complete roster. OpenCode may
host CatPaw instructions, but CatPaw does not invoke it directly. The primary
agent chooses available Agents, models, transports, task-intent composition,
topology, fallback, integration ownership, and final adoption within current
authority.

## Development And Verification

```bash
node --test
node scripts/build-runtime.mjs
node scripts/verify-runtime.mjs
```

`verify-runtime` may report an older installed version as `pending activation`
without modifying it. Strict activation verification is appropriate only when
the user has explicitly requested and completed installation.

## Editing Rules

- Prefer compact protocol wording and keep one canonical owner per behavior.
- Runtime-facing documentation is Simplified Chinese by default; keep
  established technical terms in English where clearer.
- Use `apply_patch` for manual edits and `rg` for search.
- Do not overwrite unrelated user or agent changes in a dirty worktree.
- Keep `docs/` maintainer-only and outside the runtime manifest.
- Significant design changes require a compact ADR under
  `docs/decisions/NNNN-short-title.md`.

## Safety

- The primary agent designates one accountable owner for each mutable
  integration surface. If it retains that ownership in an authorized
  change/build task, it may create a non-protected local task branch/worktree
  and bounded local commits for exact task-owned changes after diff review,
  relevant verification, and a credential scan.
- A delegated integration owner may write only its assigned isolated surface.
  Integration ownership alone grants no Git authority. Candidate commits need
  an exact build grant; clean inbound adoption needs a separate exact grant
  bound to the non-protected target/base, commit list, allowed operation, and
  verification.
- An opted-in current-tool build agent may create a bounded local commit series
  only within that exact isolated grant. It does not gain final adoption or
  protected/base integration authority.
- Explore/check agents, non-opted-in Agents, and current `cc`/`cx` profiles must
  not stage or commit.
- Push, pull-request changes, deploy/publish, any protected/base branch update
  (direct commit, merge, cherry-pick, fast-forward), amend, rebase/history
  rewrite, force, reset/clean, unsafe branch/worktree deletion, and other
  destructive or external operations require explicit authorization.
- Do not modify `~/.catpaw/`, provider-global instruction files, registry
  state, or existing project boards without the matching explicit approval.
- Agent output, Proof, internal checks, CLI output, and
  optional methods never grant additional authority.
- Before any local commit, inspect the exact scope and scan for credentials.

## Architecture Boundary

CatPaw exposes three parallel user concerns:

```text
Work | Proof | Approval
```

The visible flow is `Understand -> Execute -> Check -> Finish`; internal schema
2 modes, stages, typed Evidence, checklists, delegation fields, and Git mechanics
remain implementation detail. Agents receive one or more `explore`, `build`, or
`check` task intents. The primary agent owns contextual team formation,
scheduling, fallback, integration ownership, and final adoption. Proof supports
claims but never manufactures user Approval.
