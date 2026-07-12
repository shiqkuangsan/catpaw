# Board Migrations

CatPaw 3 migrations move a project Work Board between explicit **board schema
versions**. Runtime release versions and board schema versions are separate：a
runtime-only release does not rewrite or restamp project artifacts。

## Current Authority

- [schema-2.md](schema-2.md) describes the schema 1 -> schema 2 transition；
- `catpaw board migrate --project <path>` produces its deterministic dry-run；
- `lib/migrate-v1-v2.mjs` owns mapping logic；
- `lib/commands/migrate.mjs` owns apply orchestration；
- [board-v2.json](../schemas/board-v2.json) and executable tests own the target
  machine contract。

Markdown explains the transition；the CLI, schema, and tests enforce it。Do not
invent migration operations by interpreting prose alone。

## Safety Contract

Every supported board migration follows one transaction：

```text
inventory -> dry-run -> resolve blockers -> stage -> validate -> backup -> publish
```

- dry-run is the default and writes nothing；
- ambiguous metadata, links, identities, or targets block the whole plan；
- stage contains a complete candidate board and must pass schema/graph checks；
- backup stores the complete live preimage only after staged validation；
- publish rechecks the live preimage and replaces it atomically；
- a second run against the target schema is an exact no-op。

Runtime activation, adapter merge, registry mutation, migration of another
board, rollback, and backup cleanup are separate authorization scopes。

## Adding A Future Schema

When a released change requires a new board schema version：

1. update the schema contract and manifest `boardSchemaVersion`；
2. add a version-to-version migration module using the shared patch engine；
3. add a concise `schema-<n>.md` transition note；
4. test deterministic preview, blockers, staged validation, complete backup,
   publication failure, link/file preservation, and idempotence；
5. update install, public, and maintainer documentation without activating or
   batch-migrating real projects。

Do not add an empty migration for a runtime-only guidance or implementation
release。Do not couple board mutation to installed runtime activation。

## Historical Files

`1.1.0.md`, `1.2.0.md`, and `1.3.0.md` are historical records from the schema 1
release-era replay model。CatPaw 3 keeps them for provenance and old-board
analysis；its CLI does not replay them as current operating instructions。
