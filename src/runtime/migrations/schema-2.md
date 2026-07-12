# Board Schema 2 Migration

Schema 2 is the CatPaw 3 board model. It replaces runtime-version-stamped
project artifacts with a small, explicit artifact graph:

```text
.catpaw/
├── index.md
├── milestones/
├── work/
├── plans/
└── evidence/
    └── topics/
```

Run `catpaw board migrate` to inspect one schema 1 board. The command is a
dry-run unless `--apply` is present. Runtime installation, registry updates,
and migration of other projects are separate actions and are never implied.

## Deterministic Mapping

| Schema 1 | Schema 2 |
|---|---|
| `reqs/*.md` at L2 | Tracked Work Item under `work/` |
| `reqs/*.md` at L3 | Gated Work Item under `work/` |
| `plans/active/*.md`, `plans/archive/*.md` | Plan under `plans/` |
| Milestone Scope table | managed Milestone Scope block |
| test matrix | `test` Evidence |
| review summary | `review` Evidence |
| research | `research` Evidence |
| provider dialogue | `provider` Evidence |

IDs, dates, terminal state, lifecycle stage, narrative content, valid local
links, and unknown files are preserved. Local Markdown links are rewritten
when a mapped artifact changes path. Migration uses create-plus-remove patch
operations with the source regular-file mode carried into each mapped target；
it does not depend on a filesystem move primitive。

## Blockers

Migration stops instead of guessing when it encounters:

- L0/L1 or draft Work that has no schema 2 artifact mapping;
- missing or invalid IDs, dates, lifecycle stages, titles, or Work bindings;
- draft Plan, Milestone, or Evidence content that is not ready to promote;
- duplicate IDs or destination collisions;
- ambiguous Milestone Scope rows;
- substantive `lessons.md` content that cannot be split deterministically;
- broken local links, unsupported filesystem entries, or occupied targets;
- any known or unknown Markdown file that is not valid UTF-8；
- generated metadata or patch operations that fail shared schema checks.

Blocked analysis returns no migration operations. Resolve the findings in the
schema 1 board, then run the dry-run again.

## Apply Transaction

`catpaw board migrate --apply` uses the shared patch engine:

1. Re-read and inventory the schema 1 board.
2. Build an exact patch and reject stale or unsafe paths.
3. Apply the patch to a sibling staged tree.
4. Validate schema 2 metadata, artifact graph references, required layout, and
   terminal Gated completion Evidence/accepted gaps.
5. Copy the complete preimage to
   `${CATPAW_HOME:-~/.catpaw}/backups/<project-key>/<UTC-timestamp>/`.
6. Replace the live board only after staged validation and backup succeed.

A failed preview or staged validation does not create a backup and does not
change the live board. Published backups are never deleted automatically.
Running the command again on a schema 2 board is an exact no-op and creates no
second backup.
