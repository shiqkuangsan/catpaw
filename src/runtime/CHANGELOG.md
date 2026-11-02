# Changelog

## 5.1.0 - Unreleased

Restores the ledger's own integrity. See
[ADR-0036](../../docs/decisions/0036-captured-checks-board-lock-and-format-integrity.md).

- `catpaw check <id> <summary> -- <command>` runs the command and records the
  result from its exit code. Output is kept under `.catpaw/runs/` (ignored by
  Git); the entry carries `run` with command, exit and duration, and `drift`
  when files changed during the run. A run that does not pass exits 1.
- All writes take a board lock, so concurrent `gap`, `start` and status
  changes no longer lose updates or reuse ids. Stale locks are taken over.
- `finish` and `gate` reject content the rules cannot read: malformed Gaps
  lines, duplicate gap ids, unknown status or risk, a frontmatter id that does
  not match its directory, and corrupted `LOG.md` entries.

Required actions: none for boards. Update host snippets from
`snippets/agents.md` to prefer captured checks.

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
