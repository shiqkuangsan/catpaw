# catpaw:init-project

Initialize a project-local `.catpaw/` artifact directory from the global CatPaw runtime package.

## Rule

Before creating files, show the user the target directory tree and wait for confirmation.

Default tree:

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

## Behavior

- Use final path name `.catpaw/`; never add `v4` or version suffixes.
- Do not invoke generic `/init` or unrelated project initialization skills for CatPaw project artifact initialization.
- Do not copy `specs/`, `roles/`, `snippets/`, `guides/`, `source-evidence/`, `commands/`, or uninstantiated `templates/` into the project.
- Instantiate only project artifact scaffolding.
- Respect git strategy: normal project repo ignores `.catpaw/`; workspace repo may track it.
- Do not modify `.gitignore` without telling the user what will change.
- Create directories with `mkdir -p`.
- Create new files directly with `Write`; do not `touch` then `Write`.
- If `.catpaw/index.md` or `.catpaw/lessons.md` already exists, read it first and ask before overwriting non-empty content.
## Runtime Stamp

Every freshly created `.catpaw/index.md` must carry a frontmatter stamp recording the installed runtime version. Read `~/.catpaw/VERSION` at init time and write it as `runtime: x.y.z`.

If `~/.catpaw/VERSION` is missing, ask the user to install the runtime first; do not invent a value.

The stamp is what `catpaw:upgrade-project` reads to decide which migration deltas to replay.

## Global Registry Write

After the board scaffold and stamp are written, append an entry to the global registry at `~/.catpaw/state/projects.json`. See `specs/03-project-directory.md` §7 for the contract.

Entry fields:

- `boardPath`: absolute path of the new `.catpaw/` directory.
- `projectRoot`: absolute path of the project (parent of `boardPath`).
- `stamp`: installed runtime version at init time.
- `registeredVia`: `init-project`.
- `registeredAt`: today's date.
- `lastSeenAt`: today's date.
- `lastSeenVia`: `init-project`.

If `~/.catpaw/state/projects.json` does not exist, create it with `{"schemaVersion": 1, "updatedAt": <today>, "projects": []}` then append.

Use atomic write (write `projects.json.tmp`, then rename).

If an entry with the same `boardPath` already exists, treat as a re-init: keep `registeredAt`, update everything else.

## Default File Contents

`.catpaw/index.md`:

```markdown
---
runtime: x.y.z
---

# CatPaw Index

## Active Work

| ID | Title | Status | Links |
|---|---|---|---|

## Active Research

_No active research._

## Active Reviews

_No active reviews._

## Open Lessons / Promotion Candidates

_None._
```

`.catpaw/lessons.md`:

```markdown
# Lessons

Reusable corrections and workflow lessons only.
```
