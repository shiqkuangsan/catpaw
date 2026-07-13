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

## Zero-touch Semantic Migration

Migration assigns every schema 1 file one explicit disposition:

| Disposition | Meaning |
|---|---|
| `converted` | Recognized content becomes a native schema 2 artifact. |
| `preserved` | Non-artifact legacy content remains byte-for-byte in the archive. |
| `blocked` | Identity, reference, path, encoding, or transaction safety is unresolved. |

Ordinary users never author metadata for migration. Inference uses this order:

1. explicit valid frontmatter;
2. canonical status aliases and ID normalization;
3. filename, H1, artifact root, and unique path binding;
4. scoped `Status`/`状态` prose, the matching index row, and Milestone FR/Scope;
5. Plan/Test/Review relationships and conservative defaults.

Unknown nonterminal status becomes `blocked`, never `done`. Terminal history may
default to Tracked; unknown nonterminal work defaults to Gated. Stage follows a
terminal state or existing Plan/Test/Review relationships. Dates come from
metadata or body first, then the latest board date, then the migration
observation date. An Evidence record is independent only when both explicit
`independent: true` and a named Agent are present; otherwise it cannot satisfy
an Independent Check. Unbound Evidence maps to `evidence/topics/`.

Negated phrases such as `not done`, `未完成`, or `未取消` never become terminal
facts. Plan, Test, or Review existence may advance stage but does not prove
completion; a graph-derived completion requires an explicitly terminal Plan
and completed Test results. Actual metadata or canonical path binding is used
before basename inference.

Only positive Milestone headings such as `Scope`, `FR`, `包含 FR`, or `候选 FR`
feed managed Scope; `Out of Scope` and non-goals remain narrative. If multiple
Milestones disagree on one Work status, migration chooses the safest
nonterminal/cancellation result and emits provenance. Existing managed Scope
markers and tables must pass the same structural parser used by normal runtime
commands.

Each affected source emits one aggregated `inferred-metadata` warning. This is
provenance, not a user decision list. Explicit facts remain authoritative, and
the original source bytes remain available in the legacy archive.

Strict scalar frontmatter remains the schema 2 output contract, but legacy
input may contain nested YAML or malformed optional values. The migrator
archives the original, recovers safe top-level scalars, ignores unsupported
optional legacy fields, and emits `recovered-frontmatter`. Malformed or invalid
`id`/`work`/`req`, conflicting identity, and unterminated frontmatter still
block; users are never asked to rewrite unrelated old YAML.

For historical Gated Work already closed as `done`, missing modern completion
Evidence becomes a generated reflection that names every missing gate and the
migration reason. It does not claim that a review occurred and grants no
authority. Structural conflicts still block preview.

## Native Mapping And Legacy Archive

Recognized schema 1 artifacts map into the native graph:

| Schema 1 | Schema 2 |
|---|---|
| `reqs/*.md` | inferred Tracked/Gated Work Item under `work/` |
| Plan | Work-bound Plan under `plans/` |
| Milestone | Milestone plus managed Scope block |
| test/review/research/provider record | work-bound or topic typed Evidence |

Original files used for conversion and non-artifact legacy material are stored
under `.catpaw/legacy/schema-1/`. Its `manifest.json` records source,
destination, disposition, byte length, file mode, and SHA-256 checksum; archive
directories retain their source modes. This is a read-only migration archive,
not a sixth schema 2 artifact kind; normal board
status, doctor, and mutation commands ignore it.

A legacy-root symlink is never followed or recreated. Its exact link-target
text is stored in an inert `.symlink-target` archive file and checksummed in the
manifest. The manifest records the alias `sourceMode` separately from the
sidecar `mode`; the alias itself is removed by a leaf-only patch operation.
Non-UTF-8 link targets, symlinks outside recognized legacy roots, and special
filesystem entries remain blockers.

Local Markdown links are rewritten when a mapped artifact changes path. Missing
in-board targets referenced by historical research/provider Evidence or
preserved unknown narrative are preserved with `broken-local-link` warnings;
the migrator does not fabricate files. Missing targets referenced by index,
Work, Plan, or other active
authorities remain blockers. Links to existing project-local files outside
`.catpaw/` remain valid. Missing project targets and links that lexically or
physically escape the project root still block migration. Unknown regular files
are preserved. Unsafe filesystem entries and non-UTF-8 Markdown remain blockers.

## Actionable Blockers

Migration stops instead of guessing when it encounters:

- conflicting, malformed, or missing canonical Work/Milestone identity and
  unterminated legacy frontmatter;
- duplicate IDs, unresolved Plan bindings, or destination collisions;
- malformed, duplicate, missing-pair, or reversed managed Scope markers;
- missing project links or links escaping the project root;
- unsupported non-legacy symlinks, special entries, occupied legacy targets,
  or stale preimages;
- known or unknown Markdown, or a legacy symlink target, that is not valid UTF-8;
- generated metadata or patch operations that fail shared schema checks.

Malformed optional legacy frontmatter, missing historical links from
research/provider Evidence or preserved unknown narrative, missing lifecycle metadata, stale active routing,
absent Evidence binding, and historical completion gaps are normalized or
preserved with warnings instead of becoming user metadata tasks. Blocked
analysis returns no migration operations. Resolve only the structural finding,
then run the dry-run again.

## Apply Transaction

`catpaw board migrate --apply` uses the shared patch engine:

1. Re-read and inventory the schema 1 board.
2. Bind analysis and the exact patch to one source tree digest; reject drift or
   unsafe paths.
3. Apply the patch to a sibling staged tree.
4. Validate schema 2 metadata, graph references, required layout, Gated `done`
   Evidence/accepted gaps, and the legacy checksum manifest.
5. Copy the complete preimage to
   `${CATPAW_HOME:-~/.catpaw}/backups/<project-key>/<UTC-timestamp>/`.
6. Replace the live board only after staged validation and backup succeed.

The engine gates staged schema/archive integrity and atomic publication.
An operator or release completion claim additionally requires
inventory/mapping/disposition count conservation, exact Work/Milestone identity
and Plan/Evidence binding reconciliation, manifest checksum verification
(including symlink-target sidecars), preserved index narrative, an unchanged
non-board worktree baseline, clean staged and live doctor results, and an exact
second-migration no-op. If the live preimage changes during staging, discard
that publication attempt and recompute from the newest snapshot.

A failed preview or staged validation does not create a backup and does not
change the live board. Published backups and the legacy archive are never
deleted automatically. Running the command again is an exact no-op only after
the existing schema 2 graph validates; an invalid board is read-only blocked
and routed to `board doctor`. No second backup is created.
