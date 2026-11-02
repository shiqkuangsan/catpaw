# Changelog

## 5.0.0 - Unreleased

CatPaw becomes a delivery ledger with four concepts (Work, Check, Gap, Note)
and five rules. See [ADR-0035](../../docs/decisions/0035-catpaw-5-delivery-ledger-and-minimal-concepts.md).

- Board schema 3: `.catpaw/catpaw.json`, `work/<ID>/WORK.md` (current state)
  and `work/<ID>/LOG.md` (append-only Checks, Gaps, Notes).
- Checks bind to a per-repository snapshot (`HEAD` plus uncommitted changes),
  covering sibling repositories and worktrees. `finish` and `gate` enforce
  open Gaps, unresolved failures and `risk: high` independent checks.
- New commands: `start`, `check`, `note`, `gap`, `finish`, `block`, `reopen`,
  `drop`, `gate`, `hook session-start`, `convert`, `policy`. Record writes apply
  immediately; only `convert` previews by default.
- Host integration: SessionStart hook brief and a pre-push `gate` snippet.
- One policy file replaces runtime-policy and seven guidance files.
- Removed: Plan, Milestone, Evidence types, Proof/Approval aliases, phases and
  stages, modes, intents and delegation fields, lenses, engineering methods,
  cc/cx transports, runtime install/activation/recovery, adapter merge,
  project registry, schema 1 migration.
- `catpaw convert` maps a schema 2 board to schema 3 and archives the original
  under `.catpaw/archive/schema-2/`. Imported checks never count as current.

Required actions: install the package, then preview and apply `catpaw convert`
per project with separate authorization. Replace CATPAW host snippets with
`snippets/agents.md`.

## 4.x and earlier

Earlier runtime releases, including the schema 1 migration and the `~/.catpaw`
installer, are available in Git history up to the 4.0.2 source commit.
