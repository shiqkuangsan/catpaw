# Board Schema 2 Migration

Schema 2 is the CatPaw 3 board model. It replaces runtime-version-stamped
project artifacts with a small, explicit artifact graph:

```text
.catpaw/
|-- index.md
|-- milestones/
|-- work/
|-- plans/
`-- evidence/
    `-- topics/
```

Run `catpaw board migrate` to inspect one schema 1 board. The command is a
dry-run unless `--apply` is present. Runtime installation, registry updates,
and migration of other projects are separate actions and are never implied.

## Bounded Migration

Migration assigns every schema 1 file one explicit disposition:

| Disposition | Meaning |
|---|---|
| `converted` | Complete content becomes a native schema 2 artifact. |
| `normalized` | A fact is derived only from a canonical source, then converted. |
| `preserved` | Incomplete historical content is retained byte-for-byte outside the live graph. |
| `blocked` | Active state or filesystem safety is ambiguous and requires a decision. |

The active dependency closure must be complete. Active routing comes only from
machine-readable sources: the managed Active Work section, `plans/active/`, or
an explicit active/blocked status. Work listed in an active Milestone Scope is
a required dependency but is not reactivated when already terminal. Prose
position, Git history, and file mtime never make an artifact active.

Safe normalization is deliberately narrow:

- Work or Milestone ID from a canonical filename;
- Work type from the canonical ID prefix;
- exact legacy status aliases such as `completed` or `closed` to `done`;
- terminal Work without a stage to `reflect`;
- a path binding when it resolves to exactly one Work item.

CatPaw does not invent an active lifecycle stage, date, Work binding, status,
mode, or accepted gap. Missing active facts remain blockers.

## Native Mapping And Legacy Archive

Complete schema 1 artifacts map into the native graph:

| Schema 1 | Schema 2 |
|---|---|
| `reqs/*.md` at legacy level 2 | Tracked Work Item under `work/` |
| `reqs/*.md` at legacy level 3 | Gated Work Item under `work/` |
| complete Plan | Plan under `plans/` |
| complete Milestone | managed Milestone Scope block |
| complete test/review/research/provider record | typed Evidence |

Incomplete historical material and original files used for conversion are
stored under `.catpaw/legacy/schema-1/`. Its `manifest.json` records source,
destination, disposition, byte length, file mode, and SHA-256 checksum; archive
directories retain their source modes. This is a read-only migration archive,
not a sixth schema 2 artifact kind; normal board
status, doctor, and mutation commands ignore it.

Local Markdown links are rewritten when a mapped artifact changes path. Links
to existing project-local files outside `.catpaw/` remain valid; missing links
and links that lexically or physically escape the project root block migration.
Unknown regular files are preserved. Unsupported
filesystem entries and non-UTF-8 Markdown remain blockers.

## Actionable Blockers

Migration stops instead of guessing when it encounters:

- incomplete active Work, Plan, Milestone, or Evidence dependencies;
- active filename/frontmatter identity conflicts or terminal routing conflicts;
- duplicate IDs, ambiguous bindings, or destination collisions;
- broken links or links escaping the project root;
- unsupported filesystem entries, occupied legacy targets, or stale preimages;
- known or unknown Markdown that is not valid UTF-8;
- generated metadata or patch operations that fail shared schema checks.

One incomplete active artifact produces one root finding listing the missing
fields; derived metadata failures are not repeated as a cascade. Blocked
analysis returns no migration operations. Resolve the findings in the schema 1
board, then run the dry-run again.

## Apply Transaction

`catpaw board migrate --apply` uses the shared patch engine:

1. Re-read and inventory the schema 1 board.
2. Build an exact patch and reject stale or unsafe paths.
3. Apply the patch to a sibling staged tree.
4. Validate schema 2 metadata, graph references, required layout, terminal
   Gated Evidence/accepted gaps, and the legacy checksum manifest.
5. Copy the complete preimage to
   `${CATPAW_HOME:-~/.catpaw}/backups/<project-key>/<UTC-timestamp>/`.
6. Replace the live board only after staged validation and backup succeed.

A failed preview or staged validation does not create a backup and does not
change the live board. Published backups and the legacy archive are never
deleted automatically. Running the command again is an exact no-op only after
the existing schema 2 graph validates; an invalid board is read-only blocked
and routed to `board doctor`. No second backup is created.
