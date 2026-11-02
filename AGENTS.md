# AGENTS.md

This repository is the source of CatPaw, a delivery ledger for coding agents.
The version is owned by `src/runtime/VERSION` and `package.json`.

## Layout

| Path | Role |
|---|---|
| `src/runtime/policy.md` | Agent policy: four concepts, five rules, working method |
| `src/runtime/lib/` | CLI implementation; the code is the board format authority |
| `src/runtime/snippets/` | Host instruction block, Claude Code hook, Git pre-push |
| `tests/` | Executable behavior tests |
| `docs/` | Maintainer rationale and ADRs; not shipped |

The current design is
[ADR-0035](docs/decisions/0035-catpaw-5-delivery-ledger-and-minimal-concepts.md).
Earlier ADRs are history.

## Boundaries

- Source changes do not install anything. `~/.catpaw/` may hold an older
  installed runtime; do not modify it without explicit approval.
- Project `.catpaw/` boards are user data. Converting a real board is a separate
  authorization per project; preview with `catpaw convert` first.
- Records, checks and CLI output never grant permission. Commits, pushes, PRs,
  publishing and destructive operations follow the user's and host's rules.

## Editing Rules

- Keep the concept set at Work, Check, Gap, Note. A new concept, field, command
  or file needs a real failure it prevents and an ADR.
- Policy and runtime-facing docs are Simplified Chinese; code, tests and ADRs
  are English.
- Update `VERSION`, `package.json` and `CHANGELOG.md` when behavior or board
  format changes.

## Verification

```bash
npm test
```
