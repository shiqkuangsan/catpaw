# 03. Project Directory

> Status: draft · Last updated: 2026-05-22

## 1. Canonical Directory

The canonical project workflow directory is:

```text
.catpaw/
```

Decisions:

- Do not keep a long-term `todos/` compatibility mode.
- New and migrated projects use `.catpaw/`.
- `.catpaw/` is the project work directory; whether it is tracked by git depends on the git strategy.
- The directory name is always `.catpaw/`; do not add version suffixes.
- Before initialization, preview the directory structure for the user and create it only after confirmation.

## 2. Global Spec vs Project Artifacts

CatPaw uses:

```text
Global spec, local artifacts.
```

The global runtime reference lives at:

```text
~/.catpaw/
```

Each project stores only project-specific work artifacts:

```text
<project>/.catpaw/
```

| Location | Meaning | Copied into project? |
|---|---|---|
| `~/.catpaw/` | CatPaw runtime specs, roles, templates, source evidence, command runbooks | No |
| `<project>/.catpaw/` | Current project reqs, plans, research, reviews, tests, lessons, index | Yes, as project work artifacts |

Rules:

- Specs and roles are global references and are not copied during project init.
- Templates are instantiated only when creating concrete artifacts such as a plan, review summary, or test matrix.
- Project `.catpaw/` must not vendor the full CatPaw runtime package.
- If offline archive or team fork support is needed, explicitly create `_spec-snapshot/`; it is not default init behavior.

## 3. Directory Structure

```text
.catpaw/
├── index.md
├── reqs/
│   ├── FR-xxx.md
│   ├── BUG-xxx.md
│   └── CHORE-xxx.md
├── plans/
│   ├── active/
│   └── archive/
├── research/
│   ├── <topic>/
│   └── misc/
├── reviews/
│   ├── <req-id>-<slug>/
│   │   ├── summary.md
│   │   ├── engineering.md
│   │   ├── architecture.md
│   │   ├── qa.md
│   │   ├── security.md
│   │   └── release.md
│   └── archive/
├── tests/
│   └── matrices/
│       └── <req-id>-<slug>.md
└── lessons.md
```

## 4. Directory Semantics

| Path | Meaning |
|---|---|
| `index.md` | Active CatPaw dashboard for the current project |
| `reqs/` | What to do: features, bugs, chores |
| `plans/` | How to do it: implementation plans |
| `research/` | What is true / why: mechanism notes, ADRs, tradeoff analysis |
| `reviews/` | What experts found: Expert Council review and strategy findings |
| `tests/` | How to verify: test design, acceptance paths, matrices |
| `lessons.md` | What to avoid next time: short corrective lessons |

Path semantics:

- `reqs/` is an identity-stable store. Req files are artifact graph roots, so lifecycle state lives in frontmatter, not in `active/` or `done/` directories.
- `plans/active/` and `plans/archive/` are state directories because plans are execution artifacts.
- `reviews/<req-id>-<slug>/summary.md` is the normal review entrypoint.
- `reviews/archive/` is for explicitly archived standalone or historical review material, not the default terminal state for req-bound summaries.
- Durable provider dialogues that are not formal reviews may live under `research/<topic>/provider-dialogue.md`.

## 5. `index.md`

`.catpaw/index.md` is an active dashboard, not a historical index.

It is not the full source of truth. Req frontmatter is the lifecycle source of
truth; the index should be derived from active reqs, active plans, open reviews,
and open lessons whenever possible.

Record:

- Active Work;
- Active Research;
- Active Reviews;
- Open Lessons / Promotion Candidates.

Do not record:

- completed work;
- archived plans;
- stale research history;
- every past review;
- every resolved lesson.

Completion rules:

- completed task -> remove it from `index.md`;
- req remains in `reqs/`, with lifecycle state expressed by frontmatter `status`, `updated`, and `closed`;
- valuable plan -> move to `plans/archive/`;
- disposable plan -> delete;
- research remains under `research/` and uses status such as `draft`, `validated`, or `stale`;
- valuable review summary remains under `reviews/`;
- lessons remain in `lessons.md`, while the index lists only open or promotion-worthy items.

Version stamp:

- `index.md` frontmatter `runtime: x.y.z` records the installed runtime version that last processed the board.
- Runtime-only releases without project artifact migrations still advance the stamp through `upgrade-project --apply`.
- Migration files control schema rewrites; the stamp records runtime processing.

## 6. ID System

IDs increment separately by type:

```text
FR-001, FR-002, ...
BUG-001, BUG-002, ...
CHORE-001, CHORE-002, ...
T-001, T-002, ...
```

Bindings:

- req is the primary ID;
- plan / review / tests bind to the req ID;
- research is topic-based and does not require a req ID.

Recommended filenames:

```text
.catpaw/reqs/FR-001-auth-flow.md
.catpaw/plans/active/FR-001-auth-flow.md
.catpaw/tests/matrices/FR-001-auth-flow.md
.catpaw/reviews/FR-001-auth-flow/summary.md
.catpaw/research/auth-session-storage/overview.md
```

Req files do not move based on completion state. Keeping reqs stable avoids
dual state sources such as `reqs/done/` plus `status: done`, and avoids
rewriting graph links when a req closes.

Link style:

```markdown
Links:
- Plan: ../plans/active/FR-001-auth-flow.md
- Tests: ../tests/matrices/FR-001-auth-flow.md
- Reviews: ../reviews/FR-001-auth-flow/summary.md
- Research: ../research/auth-session-storage/overview.md
```

## 7. Global Project Registry

CatPaw maintains a per-machine local registry of project boards for discovery,
batch health checks, and batch upgrades.

Path:

```text
~/.catpaw/state/projects.json
```

Boundaries:

- `state/` is local machine state. It is not in `runtime-manifest.canonicalFiles`, not in the source repo, not copied/deleted/overwritten by runtime file sync, and not verified by `release-runtime`.
- `upgrade-runtime` may read the registry and orchestrate project-board dry-run / safe apply, but project writes must be delegated to `upgrade-project`.
- The registry tracks boards; it never owns or deletes board files.
- The registry stores paths, stamps, and timestamps only. It does not store commit hashes, req content, or user artifacts.

Schema:

```json
{
  "schemaVersion": 1,
  "updatedAt": "YYYY-MM-DD",
  "projects": [
    {
      "boardPath": "/abs/path/to/project/.catpaw",
      "projectRoot": "/abs/path/to/project",
      "stamp": "1.x.y",
      "registeredVia": "init-project | migrate-project | upgrade-project",
      "registeredAt": "YYYY-MM-DD",
      "lastSeenAt": "YYYY-MM-DD",
      "lastSeenVia": "init-project | migrate-project | upgrade-project | status | doctor | reconcile | close"
    }
  ]
}
```

Write rules:

- Primary key: absolute `boardPath`.
- If missing, create `{"schemaVersion": 1, "updatedAt": <today>, "projects": []}`.
- Use atomic writes: write `projects.json.tmp`, then rename to `projects.json`.
- Every write updates top-level `updatedAt`.
- Upsert by `boardPath`: existing entries update `stamp`, `lastSeenAt`, `lastSeenVia`; new entries also set `registeredVia` and `registeredAt`.

Write triggers:

| Command | Behavior |
|---|---|
| `init-project` succeeds | Append entry, `stamp = ~/.catpaw/VERSION` |
| `migrate-project` succeeds | Same |
| `upgrade-project --apply` | Upsert; update `stamp` to installed runtime version |
| `upgrade-runtime` | Read registry for batch dry-run; with `--apply-projects`, delegate unblocked boards to `upgrade-project --apply` |
| `status` / `doctor` / `reconcile` / `close` succeeds on known board | Update `lastSeenAt` / `lastSeenVia`; if unknown, suggest registration |
| `unregister-project` | Remove entry without touching board files |
| `registry-doctor --apply` | Remove stale entries whose `boardPath` no longer exists, after confirmation |

Cross-machine / worktree notes:

- Each machine owns its own `~/.catpaw/state/projects.json`; do not sync it across machines.
- Worktrees and symlinks may produce additional board paths; clean them with `unregister-project` or `registry-doctor --prune`.
- If a project directory is moved, the old entry becomes stale and the new path is an unregistered candidate. Let the user decide when to self-heal.
