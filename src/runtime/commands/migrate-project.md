# catpaw:migrate-project

Migrate a project that used an older CatPaw artifact layout, such as `todos/`, to the current project-local `.catpaw/` layout.

## Rule

Default to a non-destructive migration. Do not delete, move, untrack, or bulk-clean legacy artifacts unless the user separately confirms the exact targets.

Before creating files, show the target `.catpaw/` tree and summarize the legacy paths that will be copied or referenced.

## Target Tree

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

## Preflight

- Confirm the current repository and branch.
- Check whether `.catpaw/` already exists.
- Inventory legacy artifact paths such as `todos/`, `todo/`, `.claude/`, `.codex/`, or project-local workflow docs.
- Check whether legacy artifacts are tracked, ignored, or untracked.
- Read project-local `AGENTS.md`, `CLAUDE.md`, `README.md`, and `.gitignore` before editing them.
- Decide git strategy from repository role:
  - normal application repo: `.catpaw/` is personal workflow metadata and should usually be ignored.
  - workspace/meta repo: `.catpaw/` may be tracked when it is the repository's explicit knowledge/workflow layer.

## Mapping

| Legacy path | Current handling |
|---|---|
| `todos/plan.md` | Use as source for `.catpaw/index.md`; do not copy as-is by default. |
| `todos/reqs.md` | Use as source for `.catpaw/index.md`; copy detailed req files if they still have value. |
| `todos/reqs/*` | Copy to `.catpaw/reqs/`, preserving filenames unless renaming is needed for clarity; add req frontmatter when metadata can be inferred safely. |
| `todos/plans/active/*` | Copy to `.catpaw/plans/active/` when still active or pending acceptance. |
| `todos/plans/archive/*` | Copy to `.catpaw/plans/archive/` when it has decision or audit value. |
| `todos/research/*` | Copy to `.catpaw/research/` when it is project workflow evidence rather than stable docs. |
| `todos/tests.md` | Convert useful entries into `.catpaw/index.md` or a test matrix. |
| `todos/tests/*` | Copy to `.catpaw/tests/` only when non-empty and useful. |
| `todos/lessons.md` | Copy reusable corrections into `.catpaw/lessons.md`. |
| `.codex/` | Inventory and report only by default; do not migrate into `.catpaw/` unless the user explicitly asks. |

## Runtime Stamp

The migrated `.catpaw/index.md` must carry a frontmatter stamp recording the installed runtime version at migration time. Read `~/.catpaw/VERSION` and write it as `runtime: x.y.z` at the top of `index.md`. This stamp is what future `catpaw:upgrade-project` runs read to decide which migration deltas to replay.

If `~/.catpaw/VERSION` is missing, stop and ask the user to install the runtime first; do not invent a value.

## Global Registry Write

After migration completes successfully, append an entry to `~/.catpaw/state/projects.json` per the contract in `specs/03-project-directory.md` §7.

Entry fields:

- `boardPath`: absolute path of `.catpaw/`.
- `projectRoot`: absolute path of the project root.
- `stamp`: installed runtime version at migration time.
- `registeredVia`: `migrate-project`.
- `registeredAt`: today's date.
- `lastSeenAt`: today's date.
- `lastSeenVia`: `migrate-project`.

If `~/.catpaw/state/projects.json` does not exist, create it with `{"schemaVersion": 1, "updatedAt": <today>, "projects": []}` then append.

Use atomic write (write `projects.json.tmp`, then rename).

If an entry with the same `boardPath` already exists, keep `registeredAt`, update the rest.

## Behavior

- Create the current `.catpaw/` scaffold first.
- Copy legacy artifacts with original content preserved unless the user asks for rewriting.
- When migrating req files, prefer adding minimal frontmatter (`id`, `type`, `status`, `level`, `priority`, `created`, `updated`, `closed`) over moving completed reqs to a separate archive directory.
- If required metadata cannot be inferred, leave the content intact and report the missing fields instead of inventing facts.
- Prefer references and indexes over rewriting old artifacts into new templates.
- Keep `todos/` as a legacy reference by default.
- Treat nested sub-repository legacy artifacts, such as `subrepo/todos/`, as out of scope unless the user explicitly includes them.
- Update project-local guidance to name `.catpaw/index.md` as the active CatPaw entrypoint.
- Mark legacy paths as read-only/reference material unless the user explicitly wants further cleanup.
- Do not copy the global runtime package into `.catpaw/`.
- Do not create empty placeholder files except `index.md`, `lessons.md`, or explicitly needed `.gitkeep` files.
- Do not modify `.gitignore` without stating the exact change first.

## Completion Report

Report:

- `.catpaw/` path created or updated.
- Legacy paths preserved.
- Files copied or edited.
- Any paths intentionally left unmigrated.
- Nested sub-repository legacy artifacts intentionally left unmigrated.
- Verification commands and results.
- Whether cleanup of legacy artifacts remains a separate optional step.
