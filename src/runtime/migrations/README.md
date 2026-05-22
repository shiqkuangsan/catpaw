# Migrations

This directory holds the project artifact schema delta registry for CatPaw runtime releases.

## Purpose

`catpaw:upgrade-project` reads `.catpaw/index.md` frontmatter `runtime:` stamp, then replays every migration file in `(stamp, installed-runtime]` order to converge a project board in a single dry-run/apply cycle.

Runtime-only releases without a migration file still advance the project board stamp to the installed runtime; they simply have no schema rewrite operations.

This is the mechanism that lets users jump multiple versions in one shot without per-version manual upgrades.

## When a migration file is required

Add `migrations/<version>.md` for any release that changes:

- Required or expected frontmatter on req / plan / review / test-matrix / index files.
- Project artifact directory layout (paths, names).
- Required content sections in any artifact template.
- Any user-visible behavior that needs existing project boards to be touched.

If a release has no project-side delta, omit the file. Do not create empty placeholders.

## File shape

```markdown
# Migration: <version>

Runtime upgrade: <prev> -> <version>
Project impact: <none | additive | breaking>

## Operations

- add: <path>: <field>: <default or rule>
- rename: <path>: <old> -> <new>
- move: <old-path> -> <new-path>
- drop: <path>: <field>
- rewrite: <path>: <description>

## User Decisions

- <decision-id>: <prompt>; choices: <list>

## Notes

<short rationale>
```

## Replay rules

- Operations across migration files are applied in version order, oldest first.
- Within a single migration file, semantic order is `add` then `rename` then `move` then `drop` then `rewrite`.
- Operations must be idempotent: re-running the same migration on an already-migrated board should be a no-op.
- A `rename` after an earlier `add` collapses to writing the new name directly when replayed from the original `from` stamp.
- A `drop` after an earlier `add` collapses to a no-op when replayed from the original `from` stamp.
- User decisions from all replayed migrations are batched into one dry-run output.

## Related

- `commands/upgrade-project.md` — the consumer.
- `commands/release-runtime.md` — the gate that enforces a migration file when needed.
